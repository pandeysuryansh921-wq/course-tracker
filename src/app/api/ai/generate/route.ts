import { NextRequest, NextResponse } from 'next/server';

/**
 * Ephemeral serverless proxy for AI providers that restrict direct browser CORS (e.g. Anthropic).
 * Keys are passed strictly via incoming request headers ('x-api-key') and are never stored or logged.
 */
export async function POST(req: NextRequest) {
  try {
    const provider = req.headers.get('x-provider') || 'anthropic';
    const apiKey = req.headers.get('x-api-key');

    if (!apiKey) {
      return NextResponse.json(
        { error: 'Missing required API key in request header "x-api-key".' },
        { status: 400 }
      );
    }

    const payload = await req.json();

    if (provider === 'anthropic') {
      const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (!anthropicRes.ok) {
        const errorData = await anthropicRes.json().catch(() => ({}));
        return NextResponse.json(
          { error: errorData?.error?.message || `Anthropic API returned status ${anthropicRes.status}` },
          { status: anthropicRes.status }
        );
      }

      const data = await anthropicRes.json();
      return NextResponse.json(data);
    }

    return NextResponse.json(
      { error: `Provider "${provider}" is not routed through serverless proxy.` },
      { status: 400 }
    );
  } catch (err: any) {
    console.error('[AI Proxy Error]:', err);
    return NextResponse.json(
      { error: err.message || 'Internal proxy error' },
      { status: 500 }
    );
  }
}
