import https from 'https'
import type { IncomingMessage, ServerResponse } from 'http'

// Vercel serverless function: proxies Anthropic API calls from the browser
// Avoids browser CORS restrictions and direct-browser-access header requirements
export default function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.writeHead(204)
    return res.end()
  }

  if (req.method !== 'POST') {
    res.writeHead(405, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: { message: 'Method not allowed' } }))
  }

  const apiKey = process.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey || apiKey === 'your_api_key_here') {
    res.writeHead(400, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify({ error: { message: 'VITE_ANTHROPIC_API_KEY가 서버에 설정되지 않았습니다.' } }))
  }

  const bodyStr = JSON.stringify(req.body)
  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    timeout: 280000,
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(bodyStr),
    },
  }

  const upstream = https.request(options, upRes => {
    res.writeHead(upRes.statusCode ?? 500, { 'Content-Type': 'application/json' })
    upRes.pipe(res)
  })

  upstream.on('timeout', () => {
    upstream.destroy()
    if (!res.headersSent) {
      res.writeHead(504, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: '응답 시간이 초과되었습니다. PDF가 너무 크거나 서버가 느릴 수 있습니다. 잠시 후 다시 시도해주세요.' } }))
    }
  })

  upstream.on('error', err => {
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: { message: err.message } }))
    }
  })

  upstream.write(bodyStr)
  upstream.end()
}
