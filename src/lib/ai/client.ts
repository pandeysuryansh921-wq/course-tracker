import { AIProvider } from '@/types/ai';

export interface CompletionRequest {
  provider: AIProvider;
  apiKey: string;
  model: string;
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface ConnectionTestResult {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

/**
 * Extracts and cleans JSON from AI responses that might contain markdown fences or extra commentary.
 */
export function extractAndParseJSON<T = any>(rawText: string): T {
  let cleaned = rawText.trim();

  // Strip markdown code fences if present (```json ... ``` or ``` ...)
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '');
    cleaned = cleaned.replace(/\s*```$/, '');
    cleaned = cleaned.trim();
  }

  // If still contains outer backticks or text, locate first { and last }
  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.substring(firstBrace, lastBrace + 1);
  }

  try {
    return JSON.parse(cleaned) as T;
  } catch (err: any) {
    // Attempt minor recovery for common trailing comma issues
    try {
      const sanitized = cleaned.replace(/,\s*([\]}])/g, '$1');
      return JSON.parse(sanitized) as T;
    } catch {
      console.error('[AI Client] JSON parse failure. Raw payload snippet:', cleaned.substring(0, 300));
      throw new Error(`Failed to parse structured JSON from AI provider: ${err.message}`);
    }
  }
}

/**
 * Calls Google Gemini REST API directly.
 */
async function callGemini(req: CompletionRequest): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(req.model)}:generateContent?key=${encodeURIComponent(req.apiKey)}`;

  const body: any = {
    contents: [
      {
        role: 'user',
        parts: [{ text: req.prompt }]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: req.temperature ?? 0.4,
      maxOutputTokens: req.maxTokens ?? 8192
    }
  };

  if (req.systemPrompt) {
    body.systemInstruction = {
      parts: [{ text: req.systemPrompt }]
    };
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message = errorData?.error?.message || `Gemini API returned status ${res.status}`;
    throw new Error(`[Gemini Error] ${message}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('Gemini returned an empty response candidate.');
  }

  return text;
}

/**
 * Calls OpenAI-compatible endpoints (OpenAI, Groq, OpenRouter).
 */
async function callOpenAICompatible(
  baseUrl: string,
  req: CompletionRequest,
  extraHeaders: Record<string, string> = {}
): Promise<string> {
  const url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;

  const messages: any[] = [];
  if (req.systemPrompt) {
    messages.push({ role: 'system', content: req.systemPrompt });
  }
  messages.push({ role: 'user', content: req.prompt });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${req.apiKey}`,
      'Content-Type': 'application/json',
      ...extraHeaders
    },
    body: JSON.stringify({
      model: req.model,
      messages,
      response_format: { type: 'json_object' },
      temperature: req.temperature ?? 0.4,
      max_tokens: req.maxTokens ?? 4096
    })
  });

  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    const message = errorData?.error?.message || `API returned status ${res.status}`;
    throw new Error(`[${req.provider.toUpperCase()} Error] ${message}`);
  }

  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new Error(`${req.provider} returned an empty message completion.`);
  }

  return text;
}

/**
 * Calls Anthropic Messages API with direct browser access or proxy fallback.
 */
async function callAnthropic(req: CompletionRequest): Promise<string> {
  const payload = {
    model: req.model,
    max_tokens: req.maxTokens ?? 4096,
    system: req.systemPrompt || 'You are an educational curriculum architect. You must output exclusively valid JSON.',
    messages: [{ role: 'user', content: req.prompt }],
    temperature: req.temperature ?? 0.4
  };

  // Try direct browser access first
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': req.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      const data = await res.json();
      const content = data?.content?.[0]?.text;
      if (content) return content;
    } else {
      const errData = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        throw new Error(`[Anthropic Error] ${errData?.error?.message || 'Authentication failed'}`);
      }
    }
  } catch (err: any) {
    // If CORS blocked or direct access disallowed, try the internal proxy route
    if (!err.message?.includes('[Anthropic Error]')) {
      console.warn('[AI Client] Direct Anthropic fetch failed, falling back to proxy route:', err.message);
    } else {
      throw err;
    }
  }

  // Fallback to Next.js API proxy route
  const proxyRes = await fetch('/api/ai/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-provider': 'anthropic',
      'x-api-key': req.apiKey
    },
    body: JSON.stringify(payload)
  });

  if (!proxyRes.ok) {
    const errData = await proxyRes.json().catch(() => ({}));
    throw new Error(`[Anthropic Error] ${errData?.error || `Proxy returned ${proxyRes.status}`}`);
  }

  const proxyData = await proxyRes.json();
  return proxyData?.content?.[0]?.text || '';
}

/**
 * Universal completion runner for any supported provider.
 */
export async function generateStructuredCompletion<T = any>(req: CompletionRequest): Promise<T> {
  let rawResponse = '';

  switch (req.provider) {
    case 'gemini':
      rawResponse = await callGemini(req);
      break;

    case 'openai':
      rawResponse = await callOpenAICompatible('https://api.openai.com/v1', req);
      break;

    case 'groq':
      rawResponse = await callOpenAICompatible('https://api.groq.com/openai/v1', req);
      break;

    case 'openrouter':
      rawResponse = await callOpenAICompatible('https://openrouter.ai/api/v1', req, {
        'HTTP-Referer': 'https://degreetrack.app',
        'X-Title': 'DegreeTrack'
      });
      break;

    case 'anthropic':
      rawResponse = await callAnthropic(req);
      break;

    default:
      throw new Error(`Unsupported AI Provider: ${req.provider}`);
  }

  return extractAndParseJSON<T>(rawResponse);
}

/**
 * Validates connection and measures latency for any AI provider or tool key.
 */
export async function testConnection(
  providerOrTool: AIProvider | 'tavily' | 'youtube' | 'github',
  apiKey: string,
  model?: string
): Promise<ConnectionTestResult> {
  const startTime = performance.now();

  try {
    if (!apiKey || !apiKey.trim()) {
      return { ok: false, latencyMs: 0, error: 'API key cannot be blank.' };
    }

    const trimmedKey = apiKey.trim();

    if (providerOrTool === 'gemini') {
      const targetModel = model || 'gemini-2.0-flash';
      await generateStructuredCompletion({
        provider: 'gemini',
        apiKey: trimmedKey,
        model: targetModel,
        prompt: 'Respond strictly in JSON: {"status":"ok","provider":"gemini"}',
        systemPrompt: 'Respond only in valid JSON with {"status": "ok"}.',
        maxTokens: 50
      });
    } else if (providerOrTool === 'groq') {
      const targetModel = model || 'llama-3.1-8b-instant';
      await generateStructuredCompletion({
        provider: 'groq',
        apiKey: trimmedKey,
        model: targetModel,
        prompt: 'Respond strictly in JSON: {"status":"ok","provider":"groq"}',
        maxTokens: 50
      });
    } else if (providerOrTool === 'openai') {
      const targetModel = model || 'gpt-4o-mini';
      await generateStructuredCompletion({
        provider: 'openai',
        apiKey: trimmedKey,
        model: targetModel,
        prompt: 'Respond strictly in JSON: {"status":"ok","provider":"openai"}',
        maxTokens: 50
      });
    } else if (providerOrTool === 'openrouter') {
      const targetModel = model || 'google/gemini-2.0-flash-001';
      await generateStructuredCompletion({
        provider: 'openrouter',
        apiKey: trimmedKey,
        model: targetModel,
        prompt: 'Respond strictly in JSON: {"status":"ok","provider":"openrouter"}',
        maxTokens: 50
      });
    } else if (providerOrTool === 'anthropic') {
      const targetModel = model || 'claude-3-5-haiku-20241022';
      await generateStructuredCompletion({
        provider: 'anthropic',
        apiKey: trimmedKey,
        model: targetModel,
        prompt: 'Respond strictly in JSON: {"status":"ok","provider":"anthropic"}',
        maxTokens: 50
      });
    } else if (providerOrTool === 'tavily') {
      const res = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: trimmedKey,
          query: 'DegreeTrack ping',
          max_results: 1
        })
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || `Tavily returned HTTP ${res.status}`);
      }
    } else if (providerOrTool === 'youtube') {
      const res = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=test&maxResults=1&key=${encodeURIComponent(trimmedKey)}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message || `YouTube API returned HTTP ${res.status}`);
      }
    } else if (providerOrTool === 'github') {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${trimmedKey}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'DegreeTrack-Client'
        }
      });
      if (!res.ok) {
        throw new Error(`GitHub token verification returned HTTP ${res.status}`);
      }
    }

    const latencyMs = Math.round(performance.now() - startTime);
    return { ok: true, latencyMs };
  } catch (err: any) {
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      ok: false,
      latencyMs,
      error: err.message || 'Connection test failed.'
    };
  }
}
