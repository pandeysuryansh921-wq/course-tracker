import { AIProvider, AIModelOption } from '@/types/ai';

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
  recognizedModel?: string;
  recognizedModels?: AIModelOption[];
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
 * Normalizes Gemini model names to active, non-deprecated models.
 * Automatically catches and upgrades deprecated models (e.g. 1.5, 2.0-flash, 2.5-pro).
 */
export function normalizeGeminiModel(modelName?: string): string {
  if (!modelName || !modelName.trim()) return 'gemini-2.5-flash';
  const clean = modelName.trim().replace(/^models\//, '');
  
  if (
    clean.includes('1.5') || 
    clean.includes('2.0') || 
    clean === 'gemini-2.5-pro' ||
    clean === 'gemini-flash'
  ) {
    return 'gemini-2.5-flash';
  }
  return clean;
}

/**
 * Automatically discovers active models supported by the provided Gemini API key.
 * Queries Google's ModelService directly and filters for functional generateContent models.
 */
export async function discoverGeminiModels(apiKey: string): Promise<AIModelOption[]> {
  const trimmed = apiKey.trim();
  if (!trimmed) return [];

  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(trimmed)}`);
    if (!res.ok) {
      console.warn(`[Gemini Discovery] ListModels returned HTTP ${res.status}`);
      return [];
    }
    const data = await res.json();
    if (!data.models || !Array.isArray(data.models)) return [];

    const activeList: AIModelOption[] = data.models
      .filter((m: any) => {
        const id = (m.name || '').replace(/^models\//, '');
        const methods = m.supportedGenerationMethods || [];
        if (!methods.includes('generateContent')) return false;
        // Filter out non-conversational specialized models
        if (/tts|image|audio|transcribe|robotics|banana|clip|lyria|computer-use/i.test(id)) return false;
        return true;
      })
      .map((m: any) => {
        const id = (m.name || '').replace(/^models\//, '');
        return {
          id,
          name: m.displayName || id,
          provider: 'gemini' as AIProvider,
          description: m.description ? m.description.slice(0, 120) : 'Google Generative Language Model',
          isRecommended: id === 'gemini-2.5-flash' || id === 'gemini-3.6-flash'
        };
      });

    // Priority ordering
    const priority = ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
    activeList.sort((a, b) => {
      const idxA = priority.indexOf(a.id);
      const idxB = priority.indexOf(b.id);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.id.localeCompare(b.id);
    });

    return activeList;
  } catch (err) {
    console.warn('[Gemini Discovery] Failed to discover models:', err);
    return [];
  }
}

/**
 * Calls Google Gemini REST API directly with automatic model fallback resilience.
 */
async function callGemini(req: CompletionRequest): Promise<string> {
  const primaryModel = normalizeGeminiModel(req.model);
  const fallbackModels = ['gemini-2.5-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
  
  // Create candidate list: primary model first, followed by fallbacks without duplicates
  const candidates = [primaryModel, ...fallbackModels.filter(m => m !== primaryModel)];

  let lastError: Error | null = null;

  for (const modelToTry of candidates) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelToTry)}:generateContent?key=${encodeURIComponent(req.apiKey)}`;

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

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const message = errorData?.error?.message || `Gemini API returned status ${res.status}`;
        
        // If 404, not found, or deprecated model, continue to next candidate in fallback chain
        if (res.status === 404 || /not found|no longer available|not supported/i.test(message)) {
          console.warn(`[Gemini Fallback] Model '${modelToTry}' unavailable (${message}). Auto-trying next recognized model...`);
          lastError = new Error(`[Gemini Error] ${message}`);
          continue;
        }
        throw new Error(`[Gemini Error] ${message}`);
      }

      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!text) {
        throw new Error('Gemini returned an empty response candidate.');
      }

      // If a fallback was needed, notify listeners so store can sync active model
      if (typeof window !== 'undefined' && modelToTry !== req.model) {
        window.dispatchEvent(
          new CustomEvent('degreetrack:ai:model-fallback', {
            detail: { model: modelToTry, provider: 'gemini' }
          })
        );
      }

      return text;
    } catch (err: any) {
      lastError = err;
      if (/not found|no longer available|not supported|404/i.test(err.message)) {
        continue;
      }
      throw err;
    }
  }

  throw lastError || new Error('All recognized Gemini models failed.');
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
      // 1. Proactively discover available models directly from Google AI Studio for this specific API key
      const discovered = await discoverGeminiModels(trimmedKey);

      // Determine candidate models to test
      const preferred = normalizeGeminiModel(model);
      const testCandidates = [
        preferred,
        ...(discovered.map((d) => d.id)),
        'gemini-2.5-flash',
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-3.5-flash-lite'
      ];
      // Deduplicate candidate models
      const uniqueCandidates = Array.from(new Set(testCandidates));

      let lastErr = 'Connection failed';
      let workingModel: string | undefined;

      for (const m of uniqueCandidates) {
        try {
          await generateStructuredCompletion({
            provider: 'gemini',
            apiKey: trimmedKey,
            model: m,
            prompt: 'Respond strictly in JSON: {"status":"ok","provider":"gemini"}',
            systemPrompt: 'Respond only in valid JSON with {"status": "ok"}.',
            maxTokens: 50
          });
          workingModel = m;
          break;
        } catch (err: any) {
          lastErr = err.message || 'Model test failed';
          // Continue to test next model if model is deprecated, not found, or temporary 503
          if (/not found|no longer available|not supported|404|503/i.test(err.message)) {
            continue;
          }
          // If auth error or permission denied (400, 403), the key itself is invalid
          throw err;
        }
      }

      if (!workingModel) {
        throw new Error(lastErr);
      }

      const latencyMs = Math.round(performance.now() - startTime);
      return {
        ok: true,
        latencyMs,
        recognizedModel: workingModel,
        recognizedModels: discovered.length > 0 ? discovered : undefined
      };
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
