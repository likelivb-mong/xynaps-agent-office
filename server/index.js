/**
 * XYNAPS 로컬 서버 — Max Pro 구독 연결
 *
 * 사용법:
 *   cd server && npm install && node index.js
 *
 * 텍스트 전용 요청 → claude CLI (Max 구독, 무료)
 * 이미지/PDF 포함 요청 → Anthropic API 직접 호출 (ANTHROPIC_API_KEY 필요)
 */

const express = require('express')
const cors = require('cors')
const { spawn } = require('child_process')
const https = require('https')
const fs = require('fs')
const path = require('path')

const app = express()
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Private-Network', 'true')
  next()
})
app.use(cors({ origin: '*' }))
app.use(express.json({ limit: '50mb' }))

const PORT = 3001

// ── Health check ────────────────────────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, version: '1.0', mode: 'max-subscription' })
})

// ── Main proxy ──────────────────────────────────────────────────────────────
app.post('/api/messages', async (req, res) => {
  const body = req.body

  // Detect binary content blocks (images / PDFs)
  const hasBinary = (body.messages || []).some(m =>
    Array.isArray(m.content) && m.content.some(b =>
      (b.type === 'image' || b.type === 'document') &&
      b.source && b.source.type !== 'text'
    )
  )

  if (hasBinary) {
    // Fall back to Anthropic API with key
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      return res.status(400).json({
        error: {
          message: '이미지/PDF 처리에는 ANTHROPIC_API_KEY가 필요합니다. server/.env 또는 환경변수에 설정해주세요.'
        }
      })
    }
    return proxyToAnthropic(body, apiKey, res)
  }

  // Extract text content for claude CLI
  const systemPrompt = typeof body.system === 'string' ? body.system : ''
  const userMsg = body.messages?.find(m => m.role === 'user')
  const userText = typeof userMsg?.content === 'string'
    ? userMsg.content
    : Array.isArray(userMsg?.content)
      ? userMsg.content.find(b => b.type === 'text')?.text || ''
      : ''

  // Combine system + user into single prompt for claude CLI
  const fullPrompt = systemPrompt
    ? `<system>\n${systemPrompt}\n</system>\n\n${userText}`
    : userText

  const wantStream = body.stream === true
  if (wantStream) {
    callClaudeCliStream(fullPrompt, res)
  } else {
    callClaudeCli(fullPrompt, res)
  }
})

// ── claude CLI subprocess (non-streaming) ───────────────────────────────────
function callClaudeCli(prompt, res) {
  const chunks = []
  const errChunks = []
  let settled = false

  const proc = spawn('claude', ['-p', '--output-format', 'text'], {
    env: process.env,
    maxBuffer: 20 * 1024 * 1024,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  proc.stdin.write(prompt)
  proc.stdin.end()

  const killTimer = setTimeout(() => {
    if (settled) return
    settled = true
    proc.kill()
    res.status(500).json({ error: { message: 'Claude CLI 응답 시간이 초과되었습니다 (15분). 다시 시도해주세요.' } })
  }, 900000)

  proc.stdout.on('data', d => chunks.push(d))
  proc.stderr.on('data', d => errChunks.push(d))

  proc.on('close', code => {
    clearTimeout(killTimer)
    if (settled) return
    settled = true
    if (code !== 0) {
      const errMsg = Buffer.concat(errChunks).toString().trim()
      return res.status(500).json({
        error: { message: `Claude CLI 오류 (exit ${code}): ${errMsg || '알 수 없는 오류'}` }
      })
    }
    const text = Buffer.concat(chunks).toString().trim()
    res.json({
      content: [{ type: 'text', text }],
      model: 'max-subscription',
      stop_reason: 'end_turn',
      usage: { input_tokens: 0, output_tokens: 0 },
    })
  })

  proc.on('error', err => {
    clearTimeout(killTimer)
    if (settled) return
    settled = true
    if (err.code === 'ENOENT') {
      res.status(500).json({
        error: {
          message: 'claude CLI를 찾을 수 없습니다. Claude Code(https://claude.ai/code)가 설치되어 있고 PATH에 있는지 확인해주세요.'
        }
      })
    } else {
      res.status(500).json({ error: { message: err.message } })
    }
  })
}

// ── claude CLI subprocess (SSE streaming) ───────────────────────────────────
function callClaudeCliStream(prompt, res) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const errChunks = []
  let settled = false

  const proc = spawn('claude', ['-p', '--output-format', 'text'], {
    env: process.env,
    stdio: ['pipe', 'pipe', 'pipe'],
  })
  proc.stdin.write(prompt)
  proc.stdin.end()

  const killTimer = setTimeout(() => {
    if (settled) return
    settled = true
    proc.kill()
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'Claude CLI 응답 시간이 초과되었습니다 (15분). 다시 시도해주세요.' })}\n\n`)
    res.end()
  }, 900000)

  proc.stdout.on('data', chunk => {
    res.write(`data: ${JSON.stringify({ type: 'delta', text: chunk.toString() })}\n\n`)
  })

  proc.stderr.on('data', d => errChunks.push(d))

  proc.on('close', code => {
    clearTimeout(killTimer)
    if (settled) return
    settled = true
    if (code !== 0) {
      const errMsg = Buffer.concat(errChunks).toString().trim()
      res.write(`data: ${JSON.stringify({ type: 'error', message: `Claude CLI 오류 (exit ${code}): ${errMsg || '알 수 없는 오류'}` })}\n\n`)
    } else {
      res.write('data: [DONE]\n\n')
    }
    res.end()
  })

  proc.on('error', err => {
    clearTimeout(killTimer)
    if (settled) return
    settled = true
    const message = err.code === 'ENOENT'
      ? 'claude CLI를 찾을 수 없습니다. Claude Code(https://claude.ai/code)가 설치되어 있고 PATH에 있는지 확인해주세요.'
      : err.message
    res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
    res.end()
  })

  res.on('close', () => {
    if (!settled) {
      settled = true
      clearTimeout(killTimer)
      proc.kill()
    }
  })
}

// ── Anthropic API fallback (binary content) ─────────────────────────────────
function proxyToAnthropic(body, apiKey, res) {
  const bodyStr = JSON.stringify(body)
  const options = {
    hostname: 'api.anthropic.com',
    path: '/v1/messages',
    method: 'POST',
    timeout: 280000, // 4분40초 — 클라이언트 5분 타임아웃보다 먼저 끊어 명확한 오류 반환
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Length': Buffer.byteLength(bodyStr),
    },
  }

  const req = https.request(options, upstream => {
    let data = ''
    upstream.on('data', chunk => { data += chunk })
    upstream.on('end', () => {
      res.status(upstream.statusCode).set('Content-Type', 'application/json').send(data)
    })
  })

  req.on('timeout', () => {
    req.destroy()
    res.status(504).json({ error: { message: 'Anthropic API 응답 시간이 초과되었습니다. PDF가 너무 크거나 서버가 느릴 수 있습니다. 잠시 후 다시 시도해주세요.' } })
  })
  req.on('error', err => {
    if (res.headersSent) return
    res.status(500).json({ error: { message: err.message } })
  })
  req.write(bodyStr)
  req.end()
}

// ── Start ───────────────────────────────────────────────────────────────────
const sslOptions = {
  key: fs.readFileSync(path.join(__dirname, 'localhost-key.pem')),
  cert: fs.readFileSync(path.join(__dirname, 'localhost.pem')),
}

https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`\nXYNAPS 로컬 서버 실행 중 → https://localhost:${PORT}`)
  console.log('Claude Max Pro 구독으로 AI를 무료로 사용합니다.')
  console.log('\n[이미지/PDF] 처리 시 ANTHROPIC_API_KEY 환경변수가 필요합니다.')
  console.log('종료: Ctrl+C\n')
})
