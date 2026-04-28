// Vercel Edge Function: streams Anthropic API responses without buffering.
// Edge runtime is required because the Hobby Node-serverless cap (60s) was
// killing long generations (especially the puzzle agent's HTML). Edge keeps
// the connection open as long as bytes are flowing, and piping upstream.body
// directly preserves real SSE streaming so the client's idle/initial
// timeouts work as designed.
export const config = { runtime: 'edge' }

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS })
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: { message: 'Method not allowed' } }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    })
  }

  const apiKey = process.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_api_key_here') {
    return new Response(
      JSON.stringify({ error: { message: 'VITE_ANTHROPIC_API_KEY가 서버에 설정되지 않았습니다.' } }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }

  const bodyText = await req.text()

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: bodyText,
    })

    // Pipe Anthropic's response body straight through. Reading it with
    // .text() first would buffer the entire SSE stream until completion,
    // which both defeats streaming UX and trips Vercel's function timeout
    // for long puzzle-agent generations.
    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        'Content-Type': upstream.headers.get('content-type') ?? 'application/json',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        ...CORS_HEADERS,
      },
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return new Response(
      JSON.stringify({ error: { message: `업스트림 호출 실패: ${msg}` } }),
      { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    )
  }
}
