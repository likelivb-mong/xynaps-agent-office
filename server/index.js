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

/**
 * claude CLI 가 0 이 아닌 코드로 끝났을 때 사람이 읽을 수 있는 메시지를 만든다.
 *
 * CLI 는 "Not logged in · Please run /login" 같은 실패 사유를 stderr 가 아니라
 * stdout 으로 내보낸다. stderr 만 보면 항상 비어 있어서 '알 수 없는 오류'가 됐다.
 */
function describeCliFailure(code, stdout, stderr) {
  const out = (stdout || '').trim()
  const err = (stderr || '').trim()
  const detail = err || out

  console.error(`[claude CLI] exit ${code}${detail ? ` — ${detail}` : ' — (출력 없음)'}`)

  if (/not logged in|please run \/login/i.test(detail)) {
    return 'Claude CLI에 로그인되어 있지 않습니다. 이 서버를 실행한 터미널에서 claude 를 실행해 /login 으로 로그인한 뒤, 서버를 다시 시작해주세요.'
  }
  if (/usage limit|rate limit/i.test(detail)) {
    return `Claude 사용량 한도에 걸렸습니다. 잠시 후 다시 시도해주세요. (${detail})`
  }
  return `Claude CLI 오류 (exit ${code}): ${detail || '출력이 없습니다. 서버를 실행한 터미널 창의 로그를 확인해주세요.'}`
}

// 클라이언트가 보낸 Anthropic 모델 ID 를 Claude CLI 의 --model alias 로 매핑.
// 알 수 없는 ID 는 null → CLI 기본 모델 사용.
function resolveCliModel(modelId) {
  if (typeof modelId !== 'string') return null
  const id = modelId.toLowerCase()
  if (id.includes('haiku')) return 'haiku'
  if (id.includes('sonnet')) return 'sonnet'
  if (id.includes('opus')) return 'opus'
  return null
}

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

  // system 은 --system-prompt 로 넘겨 Claude Code 기본 시스템 프롬프트를 대체한다.
  //
  // 예전에는 <system>...</system> 로 감싸 사용자 메시지 안에 넣었는데, 그러면
  // "코딩 에이전트" 라는 CLI 기본 페르소나가 그대로 남아 앱의 출력 형식 지시를
  // 눌러버렸다. 그 결과 [요약]/[상세] + <!--XYNAPS_HTML--> 조각 대신 <!DOCTYPE html>
  // 로 시작하는 완성된 HTML 문서를 내놓았고, 앱은 마커가 없으니 렌더링하지 못하고
  // 코드를 그대로 화면에 보여줬다.
  //
  // 인자 길이 제한(ARG_MAX)에 걸릴 만큼 큰 시스템 프롬프트는 예전 방식으로 되돌린다.
  const MAX_SYSTEM_ARG = 120000
  const useSystemFlag = systemPrompt.length > 0 && systemPrompt.length <= MAX_SYSTEM_ARG
  const fullPrompt = useSystemFlag
    ? userText
    : (systemPrompt ? `<system>\n${systemPrompt}\n</system>\n\n${userText}` : userText)
  const systemArg = useSystemFlag ? systemPrompt : null
  if (systemPrompt.length > MAX_SYSTEM_ARG) {
    console.warn(`[claude CLI] system 프롬프트가 너무 커서(${systemPrompt.length}자) 본문에 포함시킵니다.`)
  }

  // 클라이언트가 지정한 모델 (e.g. 'claude-haiku-4-5-20251001') 을 CLI alias 로 변환.
  // 이전에는 항상 Claude CLI 기본 모델(보통 Sonnet/Opus)을 사용해서 puzzle 처럼
  // Haiku 가 적합한 케이스에서도 5~10분 걸리던 문제를 해결.
  const cliModel = resolveCliModel(body.model)
  const wantStream = body.stream === true
  if (wantStream) {
    callClaudeCliStream(fullPrompt, res, cliModel, systemArg)
  } else {
    callClaudeCli(fullPrompt, res, cliModel, systemArg)
  }
})

/** claude -p 공통 인자 구성 */
function buildCliArgs(cliModel, systemArg) {
  const args = ['-p', '--output-format', 'text']
  if (cliModel) args.push('--model', cliModel)
  if (systemArg) args.push('--system-prompt', systemArg)
  return args
}

// ── claude CLI subprocess (non-streaming) ───────────────────────────────────
function callClaudeCli(prompt, res, cliModel, systemArg) {
  const chunks = []
  const errChunks = []
  let settled = false

  const args = buildCliArgs(cliModel, systemArg)
  const proc = spawn('claude', args, {
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
      return res.status(500).json({
        error: {
          message: describeCliFailure(
            code,
            Buffer.concat(chunks).toString(),
            Buffer.concat(errChunks).toString(),
          ),
        },
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
function callClaudeCliStream(prompt, res, cliModel, systemArg) {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  const errChunks = []
  const outChunks = [] // 실패했을 때 사유가 stdout 으로 오므로 함께 모아둔다
  let settled = false

  const args = buildCliArgs(cliModel, systemArg)
  const proc = spawn('claude', args, {
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
    outChunks.push(chunk)
    res.write(`data: ${JSON.stringify({ type: 'delta', text: chunk.toString() })}\n\n`)
  })

  proc.stderr.on('data', d => errChunks.push(d))

  proc.on('close', code => {
    clearTimeout(killTimer)
    if (settled) return
    settled = true
    if (code !== 0) {
      const message = describeCliFailure(
        code,
        Buffer.concat(outChunks).toString(),
        Buffer.concat(errChunks).toString(),
      )
      res.write(`data: ${JSON.stringify({ type: 'error', message })}\n\n`)
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
