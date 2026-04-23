import type { Agent, SkillFile, AgentReport, AgentId, CrimeConfig, GameFlowSheet, GameFlowSection, GameStep, ProblemType, ChatMessage, GameSystemType, BriefingData, CharacterRole, StoryStageKey, WorkshopSession } from '../types'
import { AGENTS } from '../data/agents'
import { XKIT_DEFINITION } from '../data/questData'

const API_KEY = import.meta.env.VITE_ANTHROPIC_API_KEY
const DRIVE_API_KEY = import.meta.env.VITE_GOOGLE_DRIVE_API_KEY

const MODEL_DEEP = 'claude-opus-4-7'
const MODEL_FAST = 'claude-sonnet-4-6'

const THINKING_HEAVY = { type: 'enabled' as const, budget_tokens: 16000 }
const THINKING_DEEP  = { type: 'enabled' as const, budget_tokens: 12000 }
const THINKING_LIGHT = { type: 'enabled' as const, budget_tokens: 8000 }

const QUALITY_DIRECTIVE = `
보고서 품질 원칙 (반드시 준수):
1. 스킬 파일의 레퍼런스를 깊이 분석하고 구체 수치·사례·용어를 직접 인용하세요.
2. 이전 에이전트 보고서가 있다면 모순 없이 연결하고, 누락된 연결고리를 먼저 메꾸세요.
3. 추상적 서술("몰입감 있는", "독창적인") 대신 플레이어의 구체적 행동·감각·상태로 치환하세요.
4. 최소 하나 이상의 대안(Plan B)을 제시하고 선택 근거를 밝히세요.
5. 작성 후 스스로 검증: ① 역할 핵심 산출물 포함? ② 스킬 레퍼런스 반영? ③ 타 에이전트와 정합?
`.trim()

// ── Settings-aware model resolution ────────────────────────────────────────────

type ModelQuality = '절약' | '균형' | '최고'
const SETTINGS_KEY = 'xynaps_v2_settings'

function getQuality(): ModelQuality {
  try { return (JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}').modelQuality ?? '균형') as ModelQuality }
  catch { return '균형' }
}

function isMaxMode(): boolean {
  try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}').useMax === true }
  catch { return false }
}

function resolveModel(purpose: 'fast' | 'deep'): string {
  const q = getQuality()
  if (q === '절약') return MODEL_FAST
  return purpose === 'deep' ? MODEL_DEEP : MODEL_FAST
}

function resolveThinking(purpose: 'fast' | 'deep'): typeof THINKING_DEEP | undefined {
  if (isMaxMode()) return undefined // local server handles model/thinking internally
  if (purpose === 'fast') return undefined
  const q = getQuality()
  if (q === '절약') return undefined
  if (q === '균형') return THINKING_LIGHT
  return THINKING_HEAVY
}

function resolveMaxTokens(purpose: 'fast' | 'deep'): number {
  const q = getQuality()
  const thinkingBudget = resolveThinking(purpose)?.budget_tokens ?? 0
  let tokens: number
  if (q === '절약') tokens = purpose === 'deep' ? 3000 : 1500
  else if (q === '균형') tokens = purpose === 'deep' ? 16000 : 3000
  else tokens = purpose === 'deep' ? 24000 : 8000
  return Math.max(tokens, thinkingBudget + 2000)
}

function resolveApiHeaders(): Record<string, string> {
  if (isMaxMode()) return { 'Content-Type': 'application/json' }
  return {
    'Content-Type': 'application/json',
    'x-api-key': API_KEY,
    'anthropic-version': '2023-06-01',
    'anthropic-dangerous-direct-browser-access': 'true',
  }
}

function getServerUrl(): string {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}').localServerUrl || 'http://localhost:3001'
  } catch { return 'http://localhost:3001' }
}

function resolveEndpoint(): string {
  return isMaxMode()
    ? `${getServerUrl()}/api/messages`
    : 'https://api.anthropic.com/v1/messages'
}

function extractText(data: { content?: Array<{ type: string; text?: string }> }): string {
  return data.content?.find(b => b.type === 'text')?.text ?? ''
}

export type CostActionType = 'full-collaboration' | 'rerun-from-agent' | 'game-flow' | 'regenerate' | 'single-agent-refresh'

export function getEstimatedCost(action: CostActionType): string | null {
  if (isMaxMode()) return null
  const q = getQuality()
  const costs: Record<CostActionType, Record<ModelQuality, string>> = {
    'full-collaboration':    { '절약': '약 2,000~4,000원', '균형': '약 14,000~20,000원', '최고': '약 32,000~45,000원' },
    'rerun-from-agent':      { '절약': '약 300~500원',    '균형': '약 1,800~2,500원',    '최고': '약 4,000~6,000원' },
    'game-flow':             { '절약': '약 200~400원',    '균형': '약 700~1,500원',      '최고': '약 2,000~4,000원' },
    'regenerate':            { '절약': '약 200~400원',    '균형': '약 1,500~2,200원',    '최고': '약 3,500~5,000원' },
    'single-agent-refresh':  { '절약': '약 200~400원',    '균형': '약 1,500~2,200원',    '최고': '약 3,500~5,000원' },
  }
  return costs[action][q]
}

export interface GoogleDriveFileMeta {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  webViewLink?: string
  size?: string
  path: string
  isFolder: boolean
  parentId: string
}

interface GoogleDriveListItem {
  id: string
  name: string
  mimeType: string
  modifiedTime?: string
  webViewLink?: string
  size?: string
}

async function listGoogleDriveChildren(folderId: string, oauthToken?: string): Promise<GoogleDriveListItem[]> {
  const endpoint = 'https://www.googleapis.com/drive/v3/files'
  const fields = encodeURIComponent('nextPageToken,files(id,name,mimeType,modifiedTime,webViewLink,size)')
  const baseQuery = [
    `q=${encodeURIComponent(`'${folderId}' in parents and trashed = false`)}`,
    'includeItemsFromAllDrives=true',
    'supportsAllDrives=true',
    'corpora=allDrives',
    'pageSize=1000',
    `fields=${fields}`,
    oauthToken ? '' : `key=${encodeURIComponent(DRIVE_API_KEY || '')}`,
  ].filter(Boolean).join('&')

  const headers: Record<string, string> = {}
  if (oauthToken) headers.Authorization = `Bearer ${oauthToken}`

  const all: GoogleDriveListItem[] = []
  let pageToken = ''
  while (true) {
    const tokenPart = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''
    const res = await fetch(`${endpoint}?${baseQuery}${tokenPart}`, { headers })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error?.message || '구글드라이브 목록 조회 실패')
    const files = Array.isArray(data.files) ? data.files as GoogleDriveListItem[] : []
    all.push(...files)
    if (!data.nextPageToken) break
    pageToken = String(data.nextPageToken)
  }
  return all
}

export async function listGoogleDriveFolderMetadata(folderId: string, oauthToken?: string): Promise<GoogleDriveFileMeta[]> {
  if (!folderId.trim()) throw new Error('folderId가 필요합니다.')
  if (!oauthToken && !DRIVE_API_KEY) {
    throw new Error('VITE_GOOGLE_DRIVE_API_KEY 설정이 필요합니다. (또는 OAuth 토큰 제공)')
  }

  const queue: Array<{ id: string; path: string }> = [{ id: folderId, path: '' }]
  const out: GoogleDriveFileMeta[] = []
  const visited = new Set<string>()

  while (queue.length > 0) {
    const current = queue.shift()!
    if (visited.has(current.id)) continue
    visited.add(current.id)

    const children = await listGoogleDriveChildren(current.id, oauthToken)
    for (const child of children) {
      const childPath = current.path ? `${current.path}/${child.name}` : child.name
      const isFolder = child.mimeType === 'application/vnd.google-apps.folder'
      out.push({
        id: child.id,
        name: child.name,
        mimeType: child.mimeType,
        modifiedTime: child.modifiedTime,
        webViewLink: child.webViewLink,
        size: child.size,
        path: childPath,
        isFolder,
        parentId: current.id,
      })
      if (isFolder) {
        queue.push({ id: child.id, path: childPath })
      }
    }
  }

  return out
}

const MAX_MODE_TEXT_LIMIT = 15000

function filterBinaryForMaxMode(blocks: unknown[]): unknown[] {
  if (!isMaxMode()) return blocks
  return blocks
    .filter((b: unknown) => {
      const type = (b as { type?: string }).type
      return type !== 'image' && type !== 'document'
    })
    .map((b: unknown) => {
      const block = b as { type?: string; text?: string }
      if (block.type === 'text' && block.text && block.text.length > MAX_MODE_TEXT_LIMIT) {
        return { ...block, text: block.text.slice(0, MAX_MODE_TEXT_LIMIT) + '\n...(이하 생략)' }
      }
      return b
    })
}

function buildFileContent(files: SkillFile[]) {
  const blocks: unknown[] = []
  for (const f of files) {
    let fileBlock: unknown = null
    if ((f.type === 'image') && f.base64 && f.mediaType) {
      fileBlock = {
        type: 'image' as const,
        source: { type: 'base64' as const, media_type: f.mediaType as 'image/jpeg' | 'image/png', data: f.base64 }
      }
    } else if (f.type === 'pdf' && f.base64) {
      fileBlock = {
        type: 'document' as const,
        source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: f.base64 }
      }
    } else if ((f.type === 'text' || f.type === 'markdown') && f.base64) {
      if (f.mediaType === 'application/msword' || f.mediaType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
        fileBlock = { type: 'text' as const, text: `[파일: ${f.name}] Word 형식(doc/docx)은 직접 파싱되지 않았습니다. 가능하면 PDF로 변환해 다시 첨부해주세요.` }
      } else {
        try {
          const decoded = decodeURIComponent(escape(atob(f.base64)))
          fileBlock = { type: 'text' as const, text: `[파일: ${f.name}]\n${decoded.slice(0, 120000)}` }
        } catch {
          fileBlock = { type: 'text' as const, text: `[파일: ${f.name}] (텍스트 디코딩 실패)` }
        }
      }
    }
    if (fileBlock) {
      blocks.push(fileBlock)
      if (f.guidePrompt?.trim()) {
        blocks.push({ type: 'text' as const, text: `[위 파일 활용 가이드: ${f.name}]\n${f.guidePrompt.trim()}` })
      }
    } else if (f.knowledgeSummary) {
      // base64가 없을 때(파일 재업로드 없이 세션 간 지속 시) 분석 요약으로 대체
      blocks.push({ type: 'text' as const, text: `[스킬 파일: ${f.name}]\n${f.knowledgeSummary}` })
      if (f.guidePrompt?.trim()) {
        blocks.push({ type: 'text' as const, text: `[위 파일 활용 가이드: ${f.name}]\n${f.guidePrompt.trim()}` })
      }
    }
  }
  return blocks
}

const STAGE_KEYS: StoryStageKey[] = ['기', '승', '전', '반전', '결']
const ROLE_SET = new Set<CharacterRole>(['가해자', '피해자', '목격자', '주변인물', '공범', '의뢰인'])
// const RELATION_SET = new Set<RelationType>(['원한', '연인', '가족', '친구', '동료', '공모자', '피고용', '피해', '모르는 사이', '기타'])

function normStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.map(v => String(v ?? '').trim()).filter(Boolean)
}

function stripMarkdownCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function extractBalancedJsonBlock(text: string): string | null {
  const start = text.search(/[\[{]/)
  if (start < 0) return null

  const stack: string[] = []
  let inString = false
  let escaped = false

  for (let i = start; i < text.length; i += 1) {
    const ch = text[i]

    if (inString) {
      if (escaped) {
        escaped = false
        continue
      }
      if (ch === '\\') {
        escaped = true
        continue
      }
      if (ch === '"') inString = false
      continue
    }

    if (ch === '"') {
      inString = true
      continue
    }
    if (ch === '{' || ch === '[') {
      stack.push(ch)
      continue
    }
    if (ch === '}' || ch === ']') {
      const expected = ch === '}' ? '{' : '['
      if (stack[stack.length - 1] !== expected) return null
      stack.pop()
      if (stack.length === 0) {
        return text.slice(start, i + 1)
      }
    }
  }

  return null
}

function escapeNewlinesInJsonStrings(raw: string): string {
  let result = ''
  let inString = false
  let escaped = false
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i]
    if (escaped) {
      result += ch
      escaped = false
      continue
    }
    if (ch === '\\' && inString) {
      escaped = true
      result += ch
      continue
    }
    if (ch === '"') {
      inString = !inString
      result += ch
      continue
    }
    if (inString && ch === '\n') { result += '\\n'; continue }
    if (inString && ch === '\r') { result += '\\r'; continue }
    if (inString && ch === '\t') { result += '\\t'; continue }
    result += ch
  }
  return result
}

function tryParseJsonCandidate(raw: string): unknown {
  const normalized = escapeNewlinesInJsonStrings(
    raw
      .trim()
      .replace(/^\uFEFF/, '')
      .replace(/^json\s*/i, '')
      .replace(/,\s*([}\]])/g, '$1')
      .trim()
  )
  return JSON.parse(normalized)
}

function normalizeLooseJsonCandidate(raw: string): string {
  return escapeNewlinesInJsonStrings(
    raw
      .trim()
      .replace(/^\uFEFF/, '')
      .replace(/^json\s*/i, '')
      .replace(/,\s*([}\]])/g, '$1')
      .replace(/([{,]\s*)([A-Za-z0-9_\u00C0-\uFFFF]+)\s*:/g, '$1"$2":')
      .replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_match, inner: string) => {
        const escaped = inner
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
        return `"${escaped}"`
      })
      .replace(/`([^`\\]*(?:\\.[^`\\]*)*)`/g, (_match, inner: string) => {
        const escaped = inner
          .replace(/\\/g, '\\\\')
          .replace(/"/g, '\\"')
          .replace(/\n/g, '\\n')
        return `"${escaped}"`
      })
      .trim()
  )
}

function parseTaggedBoolean(value: string): boolean {
  return /^(true|1|yes|y|on)$/i.test(value.trim())
}

function parseTaggedGameFlowResponse(text: string): { sections: Array<{ title: string; steps: Array<Partial<GameStep>> }> } {
  const lines = text
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  const sections: Array<{ title: string; steps: Array<Partial<GameStep>> }> = []
  let currentSection: { title: string; steps: Array<Partial<GameStep>> } | null = null

  for (const line of lines) {
    if (line.startsWith('[SECTION]')) {
      const title = line.replace(/^\[SECTION\]\s*/i, '').trim() || '미정'
      currentSection = { title, steps: [] }
      sections.push(currentSection)
      continue
    }

    if (line.startsWith('[STEP]')) {
      if (!currentSection) {
        currentSection = { title: '미정', steps: [] }
        sections.push(currentSection)
      }

      const payload = line.replace(/^\[STEP\]\s*/i, '')
      const parts = payload.split('||').map(part => part.trim())
      const [stepRaw, clue = '', story = '', input = '', xkitRaw = 'false', keyRaw = 'false', devRaw = 'false', output = '', autoRaw = 'false', problemType = ''] = parts
      const stepNumber = Number.parseInt(stepRaw, 10)

      currentSection.steps.push({
        step: Number.isFinite(stepNumber) ? stepNumber : currentSection.steps.length + 1,
        clue,
        story,
        input,
        xkit: parseTaggedBoolean(xkitRaw),
        key: parseTaggedBoolean(keyRaw),
        dev: parseTaggedBoolean(devRaw),
        output,
        auto: parseTaggedBoolean(autoRaw),
        problemType: problemType as ProblemType,
      })
    }
  }

  return { sections }
}

function parseModelJsonResponse(text: string): unknown {
  const candidates = new Set<string>()
  const trimmed = text.trim()
  if (trimmed) candidates.add(trimmed)

  const unfenced = stripMarkdownCodeFence(trimmed)
  if (unfenced) candidates.add(unfenced)

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fencedMatch?.[1]?.trim()) candidates.add(fencedMatch[1].trim())

  for (const candidate of [...candidates]) {
    const extracted = extractBalancedJsonBlock(candidate)
    if (extracted) candidates.add(extracted)
    const unfencedCandidate = stripMarkdownCodeFence(candidate)
    const extractedUnfenced = extractBalancedJsonBlock(unfencedCandidate)
    if (extractedUnfenced) candidates.add(extractedUnfenced)
  }

  let lastError: unknown = null
  for (const candidate of candidates) {
    try {
      return tryParseJsonCandidate(candidate)
    } catch (error) {
      lastError = error
      try {
        return JSON.parse(normalizeLooseJsonCandidate(candidate))
      } catch (repairError) {
        lastError = repairError
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error('JSON Parse error')
}

async function repairModelJsonResponse(rawText: string, schemaHint: string): Promise<unknown> {
  const response = await fetchAnthropicWithTimeout({
    model: MODEL_FAST,
    max_tokens: 3000,
    system: `당신은 손상된 AI 응답을 엄격한 JSON으로 복구하는 정리기입니다.
반드시 유효한 JSON만 반환하고, 설명/코드펜스/주석/머리말은 절대 포함하지 마세요.
키는 모두 큰따옴표로 감싸고, 문자열도 모두 큰따옴표를 사용하세요.
의미를 추측해 새 내용을 만들지 말고, 원문에 있는 정보만 정리하세요.`,
    messages: [{
      role: 'user',
      content: [{
        type: 'text',
        text: `다음 응답을 엄격한 JSON으로 복구하세요.\n\n반환해야 할 형식 힌트:\n${schemaHint}\n\n원본 응답:\n${rawText}`,
      }],
    }],
  }, { timeoutMs: 45000 })

  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'JSON 복구 API 오류')
  const repairedText: string = data.content[0]?.text || ''
  return parseModelJsonResponse(repairedText)
}

async function generateTaggedGameFlowResponse(
  projectTheme: string,
  crimeContext: string,
  reportsText: string,
  attachmentContent: unknown[],
): Promise<{ sections: Array<{ title: string; steps: Array<Partial<GameStep>> }> }> {
  const response = await fetchAnthropicWithTimeout({
    model: MODEL_DEEP,
    max_tokens: 16000,
    thinking: THINKING_DEEP,
    system: `당신은 방탈출 게임 플로우 시트 전문가입니다.
JSON 대신, 아래 태그 형식의 줄 텍스트만 반환하세요.
설명, 머리말, 코드블록, 번호 목록은 절대 쓰지 마세요.

형식:
[SECTION] 섹션명
[STEP] step번호 || clue || story || input || xkit(true/false) || key(true/false) || dev(true/false) || output || auto(true/false) || problemType

problemType는 반드시 다음 중 하나만 사용:
평면, 입체, 공간, 감각

설계 원칙:
- 모든 에이전트 보고서의 내용이 실제 플레이 순서와 인과로 연결되어야 합니다.
- 각 STEP의 input → output이 다음 STEP의 진입 조건과 맞물리는지 반드시 검증하세요.
- 퍼즐 유형(problemType)은 텍스트 내용이 아니라 실제 조작 방식으로 판단하세요.
- 섹션마다 실제 플레이 순서대로 STEP을 나열하고, STEP이 없는 SECTION은 만들지 마세요.`,
    messages: [{
      role: 'user',
      content: [
        ...attachmentContent,
        {
          type: 'text',
          text: `테마: ${projectTheme}
${crimeContext}

에이전트 기획 결과:
${reportsText}

위 내용을 태그 형식으로만 반환하세요.`,
        },
      ],
    }],
  }, { timeoutMs: 240000 })

  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || '태그 게임 플로우 API 오류')
  const taggedText: string = data.content?.find((b: { type?: string; text?: string }) => b?.type === 'text')?.text || ''
  return parseTaggedGameFlowResponse(taggedText)
}

function toReadableApiError(error: unknown, fallback: string): Error {
  if (error instanceof Error) {
    const message = error.message?.trim() || ''
    // timeout abort must be checked before generic abort
    if ((error.name === 'AbortError' && /timeout/i.test(message)) || /timeout|시간 초과/i.test(message)) {
      return new Error('응답 시간이 초과되었습니다 (AI 생성 시간이 너무 오래 걸렸습니다). 다시 시도해주세요.')
    }
    if (error.name === 'AbortError' || /aborted|취소|중지/i.test(message)) {
      return new Error('작업이 중단되었습니다 (페이지 이탈 또는 요청 취소).')
    }
    if (/json parse error|syntaxerror|property name must be a string literal/i.test(message)) {
      return new Error('AI 응답 형식을 정리하지 못했습니다. 다시 시도해주세요.')
    }
    if (/credit balance is too low|purchase credits|plans?\s*&\s*billing|insufficient credits/i.test(message)) {
      return new Error('Anthropic API 크레딧이 부족합니다. Plans & Billing에서 크레딧을 충전한 뒤 다시 시도해주세요.')
    }
    if (/load failed|failed to fetch|networkerror/i.test(message)) {
      return new Error('네트워크 또는 API 연결에 실패했습니다. 잠시 후 다시 시도해주세요.')
    }
    if (/api key/i.test(message)) {
      return new Error('API 키 설정을 확인해주세요.')
    }
    if (/cors/i.test(message)) {
      return new Error('브라우저에서 API 연결이 차단되었습니다. 연결 설정을 확인해주세요.')
    }
    return error
  }
  return new Error(fallback)
}

async function streamMaxModeRequest(
  body: Record<string, unknown>,
  options?: { signal?: AbortSignal; onChunk?: (accumulated: string) => void }
): Promise<string> {
  const controller = new AbortController()
  const abortForward = () => controller.abort(new DOMException('aborted', 'AbortError'))
  options?.signal?.addEventListener('abort', abortForward)

  try {
    const response = await fetch(resolveEndpoint(), {
      method: 'POST',
      headers: resolveApiHeaders(),
      body: JSON.stringify({ ...body, stream: true }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error?.message || 'API 오류')
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let text = ''
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (!raw || raw === '[DONE]') continue
        let evt: { type: string; text?: string; message?: string }
        try { evt = JSON.parse(raw) } catch { continue }
        if (evt.type === 'delta' && evt.text) {
          text += evt.text
          options?.onChunk?.(text)
        } else if (evt.type === 'error') {
          throw new Error(evt.message || 'CLI 오류')
        }
      }
    }
    return text
  } finally {
    options?.signal?.removeEventListener('abort', abortForward)
  }
}

async function streamAnthropicRequest(
  body: Record<string, unknown>,
  options?: { signal?: AbortSignal; onChunk?: (accumulated: string) => void }
): Promise<string> {
  const controller = new AbortController()
  const abortForward = () => controller.abort(new DOMException('aborted', 'AbortError'))
  options?.signal?.addEventListener('abort', abortForward)

  try {
    const response = await fetch(resolveEndpoint(), {
      method: 'POST',
      headers: resolveApiHeaders(),
      body: JSON.stringify({ ...body, stream: true }),
      signal: controller.signal,
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.error?.message || 'API 오류')
    }

    const reader = response.body!.getReader()
    const decoder = new TextDecoder()
    let text = ''
    let buf = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buf += decoder.decode(value, { stream: true })
      const lines = buf.split('\n')
      buf = lines.pop() ?? ''
      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const raw = line.slice(6).trim()
        if (!raw || raw === '[DONE]') continue
        try {
          const evt = JSON.parse(raw)
          if (evt.type === 'content_block_delta' && evt.delta?.type === 'text_delta') {
            text += evt.delta.text
            options?.onChunk?.(text)
          }
        } catch { /* skip malformed */ }
      }
    }
    return text
  } finally {
    options?.signal?.removeEventListener('abort', abortForward)
  }
}

async function fetchAnthropicWithTimeout(
  body: unknown,
  options?: {
    signal?: AbortSignal
    timeoutMs?: number
  }
) {
  const controller = new AbortController()
  const timeoutMs = options?.timeoutMs ?? 120000
  const timer = window.setTimeout(() => controller.abort(new DOMException('timeout', 'AbortError')), timeoutMs)

  const abortForward = () => controller.abort(new DOMException('aborted', 'AbortError'))
  options?.signal?.addEventListener('abort', abortForward)

  try {
    return await fetch(resolveEndpoint(), {
      method: 'POST',
      headers: resolveApiHeaders(),
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } finally {
    window.clearTimeout(timer)
    options?.signal?.removeEventListener('abort', abortForward)
  }
}

export async function generateDraftCrimeConfigFromFiles(
  projectTheme: string,
  currentCrimeConfig: CrimeConfig | undefined,
  attachments: SkillFile[],
): Promise<CrimeConfig> {
  const fileContent = filterBinaryForMaxMode(buildFileContent(attachments ?? []))
  const currentContext = currentCrimeConfig ? buildCrimeContext(currentCrimeConfig) : '현재 사건 설정 없음'
  const system = `당신은 방탈출/크라임씬 기획 PM입니다.
첨부 문서를 읽고 사건수사 설정 초안을 JSON으로만 반환하세요.
반드시 유효한 JSON만 반환하고 설명문은 금지합니다.`
  const prompt = `프로젝트 테마: ${projectTheme}

현재 설정:
${currentContext}

요청:
- 첨부 파일 내용을 우선 반영하여 사건 설정 초안을 완성
- 빈 항목은 첨부 맥락에 맞게 합리적으로 보완
- 과장 금지, 실제 파일 근거 중심

반환 JSON 형식:
{
  "motives": ["..."],
  "crimeTypes": ["..."],
  "clues": ["..."],
  "methods": ["..."],
  "location": "...",
  "genres": ["..."],
  "characters": [
    { "role": "가해자|피해자|목격자|주변인물|공범|의뢰인", "name": "...", "background": "..." }
  ],
  "relations": [
    { "fromName": "...", "relationType": "원한|연인|가족|친구|동료|공모자|피고용|피해|모르는 사이|기타", "toName": "...", "description": "..." }
  ],
  "storyFlow": [
    { "stage": "기", "roomName": "...", "description": "플레이어가 게임 초반에 처음 알게 되는 정보와 상황" },
    { "stage": "승", "roomName": "...", "description": "플레이어가 중반에 추가로 발견하는 단서와 전개" },
    { "stage": "전", "roomName": "...", "description": "플레이어가 위기 또는 핵심 사건을 체감하는 순간" },
    { "stage": "반전", "roomName": "...", "description": "플레이어가 반전 정보나 진실 일부를 깨닫는 순간" },
    { "stage": "결", "roomName": "...", "description": "플레이어가 마지막에 도달하는 진실과 결말" }
  ]
}

중요:
- storyFlow는 실제 사건의 시간순 정리가 아니라, 플레이어가 게임을 하면서 순서대로 알게 되는 "게임 플레이 스토리 흐름"이어야 합니다.
- 각 description은 플레이어 관점에서 작성하세요.`

  const content: unknown[] = [...fileContent, { type: 'text', text: prompt }]
  const response = await fetchAnthropicWithTimeout({
    model: resolveModel('fast'),
    max_tokens: resolveMaxTokens('fast'),
    system,
    messages: [{ role: 'user', content }],
  }, { timeoutMs: 300000 })
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || '외부 파일 반영 실패')
  const text: string = extractText(data)
  let parsed: Record<string, unknown>
  try {
    parsed = parseModelJsonResponse(text) as Record<string, unknown>
  } catch {
    parsed = await repairModelJsonResponse(text, `{
  "motives": ["..."],
  "crimeTypes": ["..."],
  "clues": ["..."],
  "methods": ["..."],
  "location": "...",
  "genres": ["..."],
  "characters": [{ "role": "가해자", "name": "...", "background": "..." }],
  "relations": [{ "fromName": "...", "relationType": "원한", "toName": "...", "description": "..." }],
  "storyFlow": [{ "stage": "기", "roomName": "...", "description": "..." }]
}`) as Record<string, unknown>
  }

  const charactersRaw = Array.isArray(parsed.characters) ? parsed.characters : []
  const characters: Array<{ id: string; role: CharacterRole; name: string; background: string }> = charactersRaw
    .map((c: { role?: string; name?: string; background?: string }) => ({
      id: crypto.randomUUID(),
      role: ROLE_SET.has(c.role as CharacterRole) ? (c.role as CharacterRole) : '주변인물',
      name: String(c.name ?? '').trim(),
      background: String(c.background ?? '').trim(),
    }))
    .filter((c: { id: string; role: CharacterRole; name: string; background: string }) => c.name || c.background)

  const nameToId = new Map<string, string>()
  characters.forEach((c: { id: string; role: CharacterRole; name: string; background: string }) => {
    if (c.name) nameToId.set(c.name, c.id)
  })
  const relationsRaw = Array.isArray(parsed.relations) ? parsed.relations : []
  const relations = relationsRaw
    .map((r: { fromName?: string; relationType?: string; toName?: string; description?: string }) => {
      const fromId = nameToId.get(String(r.fromName ?? '').trim() || '')
      const toId = nameToId.get(String(r.toName ?? '').trim() || '')
      if (!fromId || !toId || fromId === toId) return null
      const relationType = String(r.relationType ?? '').trim() || '기타'
      return {
        id: crypto.randomUUID(),
        fromId,
        toId,
        relationType,
        description: String(r.description ?? '').trim(),
      }
    })
    .filter(Boolean) as CrimeConfig['relations']

  const flowByStage = new Map<StoryStageKey, { stage: StoryStageKey; roomName: string; description: string }>()
  const parsedFlow = Array.isArray(parsed.storyFlow) ? parsed.storyFlow : []
  parsedFlow.forEach((s: { stage?: string; roomName?: string; description?: string }) => {
    if (!STAGE_KEYS.includes(s.stage as StoryStageKey)) return
    flowByStage.set(s.stage as StoryStageKey, {
      stage: s.stage as StoryStageKey,
      roomName: String(s.roomName ?? '').trim(),
      description: String(s.description ?? '').trim(),
    })
  })
  const storyFlow = STAGE_KEYS.map(stage => flowByStage.get(stage) ?? { stage, roomName: '', description: '' })

  return {
    motives: normStringArray(parsed.motives),
    crimeTypes: normStringArray(parsed.crimeTypes),
    clues: normStringArray(parsed.clues),
    methods: normStringArray(parsed.methods),
    location: String(parsed.location ?? '').trim(),
    genres: normStringArray(parsed.genres),
    characters,
    relations,
    storyFlow,
  }
}

function buildCrimeContext(crime: CrimeConfig): string {
  const lines: string[] = ['📋 사건수사 설정:']
  if (crime.genres?.length) lines.push(`[장르] ${crime.genres.join(', ')}`)
  if (crime.motives.length) lines.push(`[A] 범행동기: ${crime.motives.join(', ')}`)
  if (crime.crimeTypes.length) lines.push(`[B] 범행종류: ${crime.crimeTypes.join(', ')}`)
  if (crime.clues.length) lines.push(`[C] 수사단서: ${crime.clues.join(', ')}`)
  if (crime.methods.length) lines.push(`[D] 수사기법: ${crime.methods.join(', ')}`)
  if (crime.location) lines.push(`[장소] ${crime.location}`)

  if (crime.characters?.length) {
    lines.push('[등장인물]')
    crime.characters.forEach(c => {
      let line = `  - ${c.role}${c.name ? ` (${c.name})` : ''}`
      if (c.background) line += `: ${c.background}`
      lines.push(line)
    })
  }

  if (crime.relations?.length && crime.characters?.length) {
    lines.push('[인물 관계도]')
    crime.relations.forEach(r => {
      const a = crime.characters.find(c => c.id === r.fromId)
      const b = crime.characters.find(c => c.id === r.toId)
      const aName = a?.name || a?.role || '?'
      const bName = b?.name || b?.role || '?'
      let line = `  ${aName} → [${r.relationType}] → ${bName}`
      if (r.description) line += `: ${r.description}`
      lines.push(line)
    })
  }

  if (crime.storyFlow?.some(s => s.description || s.roomName)) {
    lines.push('[게임 플레이 스토리 흐름]')
    crime.storyFlow.forEach(s => {
      if (!s.description && !s.roomName) return
      let line = `  ${s.stage}.`
      if (s.roomName) line += ` [공간: ${s.roomName}]`
      if (s.description) line += ` ${s.description}`
      lines.push(line)
    })
    const hasRoomNames = crime.storyFlow.some(s => s.roomName)
    if (hasRoomNames) {
      lines.push('[도면 안내] 첨부된 도면의 방 이름은 위 게임 플레이 스토리 흐름의 공간명과 일치합니다. 도면을 참고하여 각 공간의 구성과 플레이 동선을 파악하세요.')
    }
  }

  const perp = crime.characters?.find(c => c.role === '가해자')
  const vic = crime.characters?.find(c => c.role === '피해자')
  const perpName = perp?.name || perp?.role
  const vicName = vic?.name || vic?.role

  const hasParts = crime.motives.length || crime.crimeTypes.length || crime.clues.length || crime.methods.length
  if (hasParts || perpName || vicName) {
    const sentence = [
      perpName && `${perpName}가`,
      crime.motives.length && `${crime.motives[0]}을(를) 이유로`,
      vicName && `${vicName}에게`,
      crime.crimeTypes.length && `${crime.crimeTypes[0]} 사건 발생.`,
      crime.location && `${crime.location}에서`,
      crime.clues.length && `${crime.clues[0]}를 찾아내`,
      crime.methods.length && `${crime.methods[0]} 방식으로 수사.`,
    ].filter(Boolean).join(' ')
    if (sentence) lines.push(`\n💡 조합: ${sentence}`)
  }
  return lines.join('\n')
}

function getSystemPrompt(agent: Agent, projectContext?: string): string {
  const roleGuide: Record<string, string> = {
    ceo: `당신은 방탈출 테마 기획의 총괄 크리에이티브 디렉터입니다.
담당 영역: 테마 정체성·감성 방향 설정, 장르 전략, 핵심 콘셉트 정의.
도면과 첨부파일이 있는 경우 반드시 분석하여 공간 구조를 파악하세요.`,
    concept: `당신은 방탈출 스토리 아키텍트입니다.
담당 영역: 세계관, 등장인물 핵심 설정·관계, 사건 타임라인, 서사 구조.
핵심 정보를 명확하고 간결하게 전달하세요. 장황한 서술 없이 핵심만 담으세요.`,
    pd: `당신은 방탈출 게임 디렉터입니다.
담당 영역: 전체 플레이 타임라인, 단계별 플레이어 행동 흐름, 난이도 밸런스, 엔딩 조건.
플레이어가 각 방에서 무엇을 경험하는지 구체적으로 기획하세요.`,
    puzzle: `당신은 방탈출 퍼즐 마스터입니다.
담당 영역: 퍼즐 유형·풀이 구조, 잠금장치, 단서 배치, 힌트 체계, 연쇄 잠금 설계.

문제 유형 분류 체계:
- 평면(Plane): 텍스트(종이·벽·보드) / 영상(TV·빔) / x-kit(JPG·GIF·MP3·AVI) / UV(자외선)
- 입체(Solid): 물품(원형·변형·제작) / 장치(회로·키트·기계·기계제어)
- 공간(Space): 공간배치 / 협동
- 감각(Sense): 시각·청각·후각·미각·촉각

${XKIT_DEFINITION}

수사단서(C)와 수사기법(D) 설정을 퍼즐 메커니즘과 연결하세요.`,
    space: `당신은 방탈출 스페이스 디자이너입니다.
담당 영역: 도면 기반 방별 소품 배치, 동선 설계, 조명·사운드 연출, 공간별 서사 연계.
도면의 방 이름과 스토리 흐름의 공간명을 매핑하여 각 공간의 역할을 설계하세요.`,
    ops: `당신은 방탈출 오퍼레이션 매니저입니다.
담당 영역: 플레이어 브리핑/디브리핑, 회차 운영 체크리스트, 안전 관리, 현장 진행 동선.
실제 오프라인 운영 현장의 관점에서 구체적인 실행 계획을 수립하세요.`,
  }

  const extendedRoleGuide: Record<string, string> = {
    sound: `당신은 방탈출 서라운드 게임 전문 음향술사입니다.
담당 영역: 헤드셋 기반 3D 서라운드 오디오 스크립트, 장면별 사운드 레이어 설계, 포지셔닝(L/C/R/SL/SR), 나레이션 큐, 감정 연출.
서라운드 게임은 완전한 어둠 속에서 헤드셋으로 진행되므로 청각이 유일한 정보 채널입니다. 모든 단서와 연출을 사운드로 설계하세요.`,
    xfiler: `당신은 크라임씬 게임 전문 엑스파일러입니다.
담당 영역: CSI형 증거 배치, 수사 흐름 설계, 용의자 프로파일링, 마네킹·시체 모형 배치, 검거 조건 설정.
크라임씬 게임은 탈출이 아닌 범인 검거가 목표입니다. 플레이어를 프로파일러로 몰입시키세요.`,
  }

  return `당신은 XYNAPS 에이전트 오피스의 ${agent.emoji} ${agent.name}입니다.
역할: ${agent.role}

${extendedRoleGuide[agent.id] || roleGuide[agent.id] || agent.description}

${projectContext ? `\n현재 프로젝트 맥락:\n${projectContext}` : ''}

스킬 파일이 제공된 경우 해당 내용을 전문 지식으로 활용하여 더 깊이 있는 답변을 제공하세요.
답변은 한국어로 작성하세요.

${QUALITY_DIRECTIVE}

중요 금지 규칙:
- "07 운영 · 예산" 섹션을 생성하지 마세요.
- "힌트 프로토콜" 및 "예산 추정/견적" 항목을 보고서에서 기획하지 마세요.
- 위 내용이 기존 맥락에 있더라도 최종 결과에서는 제외하세요.`
}

export async function callAgent(
  agent: Agent,
  userMessage: string,
  projectContext?: string,
  options?: { signal?: AbortSignal; timeoutMs?: number; mode?: 'fast' | 'deep' }
): Promise<string> {
  const mode = options?.mode ?? 'deep'
  const skillContent = filterBinaryForMaxMode(buildFileContent(agent.skills))
  const userContent: unknown[] = [
    ...skillContent,
    { type: 'text', text: userMessage }
  ]

  const thinking = resolveThinking(mode)
  const response = await fetchAnthropicWithTimeout({
    model: resolveModel(mode),
    max_tokens: resolveMaxTokens(mode),
    ...(thinking ? { thinking } : {}),
    system: getSystemPrompt(agent, projectContext),
    messages: [{ role: 'user', content: userContent }],
  }, options)

  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'API 오류')
  return extractText(data)
}

export async function chatWithAgent(
  agentId: AgentId,
  chatHistory: ChatMessage[],
  projectContext: string,
): Promise<string> {
  const agentDef = AGENTS.find(a => a.id === agentId)!
  const systemPrompt = `${getSystemPrompt(agentDef, projectContext)}

당신은 지금 사용자와 기획 개선을 위한 전문가 회의를 하고 있습니다.
이미 작성된 보고서를 기반으로 사용자의 아이디어와 피드백을 논의하세요.
자연스러운 대화체로 응답하되, 내용은 전문적이고 구체적으로 유지하세요.
HTML 형식 없이 일반 텍스트로 응답하세요.

보고서 업그레이드 제안 원칙:
- 기존 보고서 양식보다 더 나은 구조가 있다고 판단되면 먼저 제안한 뒤 승인을 받고 작성하세요.
- 제안 형식: "현재 [X] 구조보다 [Y] 방식이 더 효과적일 것 같습니다. [이유]. 이 방향으로 재작성해드릴까요?"
- 사용자가 승인하면 전체 보고서를 새 구조로 재작성하고, 거절하면 기존 구조로 계속 진행하세요.`

  const messages = chatHistory.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const response = await fetchAnthropicWithTimeout({
    model: MODEL_FAST,
    max_tokens: 2000,
    system: systemPrompt,
    messages,
  }, { timeoutMs: 60000 })

  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'API 오류')
  return extractText(data)
}

export async function analyzeSkillFile(
  agentId: AgentId,
  skill: SkillFile,
): Promise<string> {
  const agentDef = AGENTS.find(a => a.id === agentId)!
  const fileContent = filterBinaryForMaxMode(buildFileContent([skill]))
  if (fileContent.length === 0) return ''

  const systemPrompt = `당신은 ${agentDef.emoji} ${agentDef.name}입니다. 역할: ${agentDef.role}

업로드된 파일을 읽고, 당신의 역할 관점에서 핵심 내용을 구조화하여 아래 형식으로 요약하세요.

## 핵심 개념
(파일의 핵심 개념들을 역할 관점에서 항목별로 정리)

## 역할 활용 포인트
(이 내용을 보고서 작성 시 어떻게 활용할지)

## 주요 데이터·수치
(중요한 수치, 목록, 규격, 이름 등)

답변은 한국어로 작성하세요. HTML 없이 마크다운 형식으로만 작성하세요.`

  const response = await fetch(resolveEndpoint(), {
    method: 'POST',
    headers: resolveApiHeaders(),
    body: JSON.stringify({
      model: resolveModel('fast'),
      max_tokens: resolveMaxTokens('fast'),
      system: systemPrompt,
      messages: [{ role: 'user', content: [...fileContent, { type: 'text', text: '이 파일의 내용을 분석하고 요약해주세요.' }] }],
    }),
  })

  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'API 오류')
  return extractText(data)
}

export async function briefAgent(
  agentId: AgentId,
  chatHistory: ChatMessage[],
  projectContext: string,
): Promise<string> {
  const agentDef = AGENTS.find(a => a.id === agentId)!
  const isFirstMessage = chatHistory.length === 0

  const systemPrompt = `당신은 ${agentDef.emoji} ${agentDef.name}입니다. 역할: ${agentDef.role}

지금은 프로젝트 기획 보고서 작성 전 사전 브리핑 단계입니다.
${isFirstMessage
    ? `더 완성도 높은 보고서를 작성하기 위해 당신의 역할에서 꼭 파악해야 할 핵심 사항을 확인하는 시간입니다.
사용자에게 역할에 맞는 핵심 질문을 2-3가지 자연스럽게 제시하세요. 번호를 붙여서 명확하게 물어보세요.`
    : `사용자의 답변을 바탕으로 추가 질문하거나, 이해한 내용을 정리하며 확인하세요.
필요하다면 더 구체적인 정보를 요청하세요. 충분히 파악됐다면 "감사합니다, 브리핑을 완료하겠습니다" 같이 마무리해도 됩니다.`
  }

현재 프로젝트 맥락: ${projectContext}

일반 텍스트로 자연스럽게 응답하세요. HTML 없이 대화체로 작성하세요.`

  const messages = chatHistory.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  if (isFirstMessage) {
    messages.push({ role: 'user', content: '안녕하세요, 브리핑을 시작해주세요.' })
  }

  try {
    const response = await fetch(resolveEndpoint(), {
      method: 'POST',
      headers: resolveApiHeaders(),
      body: JSON.stringify({
        model: resolveModel('fast'),
        max_tokens: resolveMaxTokens('fast'),
        system: systemPrompt,
        messages,
      }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || '브리핑 요청에 실패했습니다.')
    const text = extractText(data).trim()
    if (!text) throw new Error('브리핑 응답이 비어 있습니다. 잠시 후 다시 시도해주세요.')
    return text
  } catch (error) {
    throw toReadableApiError(error, '브리핑 요청에 실패했습니다.')
  }
}

export async function regenerateAgentDetail(
  agentId: AgentId,
  chatHistory: ChatMessage[],
  projectContext: string,
  previousReports: AgentReport[],
  skills?: SkillFile[],
): Promise<{ summary: string; detail: string }> {
  const agentDef = AGENTS.find(a => a.id === agentId)!
  const agentWithSkills: Agent = { ...agentDef, skills: skills ?? [] }

  const chatSummary = chatHistory.length > 0
    ? `\n\n== 사용자와의 회의 내용 ==\n${chatHistory.map(m => `[${m.role === 'user' ? '사용자' : '에이전트'}] ${m.content}`).join('\n')}\n== 회의 끝 ==\n\n위 회의 내용을 반드시 반영하여 보고서를 개선하세요.`
    : ''

  const contextReports = previousReports
    .filter(r => r.agentId !== agentId && r.status === 'done')
    .map(r => `[${r.agentName}] ${r.summary}`)
    .join('\n')

  const prompt = `${contextReports ? `이전 에이전트 보고서 요약:\n${contextReports}\n\n` : ''}${AGENT_PROMPT_TEXTS[agentId]}

추가 금지 규칙:
- "07 운영 · 예산" 섹션은 작성하지 마세요.
- "힌트 프로토콜" 및 "예산 추정/견적"은 결과에서 제외하세요.
${chatSummary}`

  const result = await callAgent(agentWithSkills, prompt, projectContext)

  // Parse summary / detail
  const summaryMatch = result.match(/\[요약\]([\s\S]*?)(?=\[상세\]|<!--XYNAPS_HTML-->|$)/)
  const detailMatch = result.match(/\[상세\]([\s\S]*)$/)
  const summary = summaryMatch?.[1]?.trim() || result.slice(0, 200)
  const detail = detailMatch?.[1]?.trim() || result

  return { summary, detail }
}

const HTML_STYLE_GUIDE = `
상세 보고서는 반드시 아래 형식으로 작성하세요:

[요약]
(3-5줄 순수 텍스트만. 이모지·마크다운·섹션 번호 없이 핵심 내용만 서술)

[상세]
<!--XYNAPS_HTML-->
(다크 테마 인라인 스타일 HTML 시각화)

보고서 구조 원칙:
- 보고서 형식은 고정 템플릿을 따르지 않습니다.
- 스킬 파일의 레퍼런스를 참고해 해당 테마와 산출물 성격에 가장 적합한 구조로 설계하세요.
- 이모지(emoji) 사용 금지 — 요약과 HTML 상세 보고서 전체에서 이모지를 사용하지 마세요.

HTML 작성 규칙 (반드시 준수):
- 모든 style은 inline으로만 작성 (외부 CSS, class 사용 금지)
- font-family: -apple-system,BlinkMacSystemFont,'Segoe UI','Apple Color Emoji','Segoe UI Emoji','Noto Color Emoji',sans-serif
- 기본 텍스트: color:#e2e8f0
- 카드: background:#1e293b;border:1px solid #334155;border-radius:10px;padding:12px
- 서브텍스트: color:#94a3b8 또는 color:#64748b
- 섹션 레이블: font-size:10px;font-weight:700;letter-spacing:0.12em;color:#64748b (또는 강조색)
- 배지: border-radius:20px;padding:3px 10px;font-size:11px;font-weight:600;background+color+border 조합
- 테이블 필수 규칙: border-collapse:collapse; width:100%; table-layout:fixed
  - thead: background:#1e293b
  - th: padding:8px 12px; font-size:11px; font-weight:700; color:#64748b; text-align:left; border-bottom:2px solid #334155
  - td: padding:8px 12px; font-size:12px; color:#e2e8f0; border-bottom:1px solid #1e293b; vertical-align:top; word-break:break-word; overflow-wrap:break-word
  - 텍스트가 긴 컬럼(핵심행동·설명 등)은 반드시 width:35% 이상 지정하고 line-height:1.6 적용
  - 짧은 컬럼(시간·수량·난이도 등)은 width:8~12% 지정 (white-space:nowrap 사용 금지 — 오버플로우 원인)
- 색상 포인트는 에이전트 고유색 계열 사용
- 한국어 텍스트 사용
- 금지: "07 운영 · 예산" 섹션, "힌트 프로토콜", "예산 추정/견적" 관련 내용
`

const AGENT_PROMPT_TEXTS: Record<AgentId, string> = {
  ceo: `크리에이티브 디렉터 관점에서 HTML 시각화 기획안을 작성해주세요.
스킬 파일의 레퍼런스를 참고해 이 테마에 가장 적합한 구조로 자유롭게 설계하세요.
핵심 산출물(테마 정체성·장르 전략·콘셉트 방향성)은 반드시 포함되어야 합니다.
${HTML_STYLE_GUIDE}`,
  concept: `스토리 아키텍트 관점에서 HTML 시각화 기획안을 작성해주세요.
핵심 산출물(세계관·인물 설정·스토리 흐름·Plan B)을 최대 7개 섹션으로 간결하게 구성하세요.
각 섹션은 핵심 정보만 담고, 장황한 반복 서술 없이 명확하게 작성하세요.

⚠️ 중요: 반드시 아래 [요약]/[상세] 형식을 따르고 [상세] 섹션은 반드시 <!--XYNAPS_HTML-->로 시작하는 인라인 스타일 HTML로 작성하세요. Markdown(#, **, -, |) 출력 절대 금지.
${HTML_STYLE_GUIDE}`,
  pd: `게임 디렉터 관점에서 HTML 시각화 기획안을 작성해주세요.
스킬 파일의 레퍼런스를 참고해 이 게임 구조에 가장 적합한 형식으로 자유롭게 설계하세요.
핵심 산출물(플레이 타임라인·난이도 밸런스·엔딩 조건)은 반드시 포함되어야 합니다.
${HTML_STYLE_GUIDE}`,
  puzzle: `퍼즐 마스터 관점에서 HTML 시각화 기획안을 작성해주세요.
스킬 파일의 레퍼런스를 참고해 이 퍼즐 구성에 가장 적합한 형식으로 자유롭게 설계하세요.
핵심 산출물(퍼즐 흐름·X-KIT/Key/Dev 분류·잠금 연쇄 구조)은 반드시 포함되어야 합니다.
${HTML_STYLE_GUIDE}`,
  space: `스페이스 디자이너 관점에서 HTML 시각화 기획안을 작성해주세요.
스킬 파일의 레퍼런스를 참고해 이 공간 구성에 가장 적합한 형식으로 자유롭게 설계하세요.
핵심 산출물(방별 소품 배치·조명·사운드 연출·동선)은 반드시 포함되어야 합니다.
${HTML_STYLE_GUIDE}`,
  ops: `오퍼레이션 매니저 관점에서 HTML 시각화 기획안을 작성해주세요.
스킬 파일의 레퍼런스를 참고해 이 운영 환경에 가장 적합한 형식으로 자유롭게 설계하세요.
핵심 산출물(브리핑·운영 체크리스트·안전 대응·현장 동선)은 반드시 포함되어야 합니다.
${HTML_STYLE_GUIDE}`,
  sound: `음향술사 관점에서 서라운드 오디오 스크립트를 HTML 시각화로 작성해주세요.
스킬 파일의 레퍼런스를 참고해 이 사운드 연출에 가장 적합한 구조로 자유롭게 설계하세요.
핵심 산출물(장면별 사운드 레이어·서라운드 포지션·타이밍 큐·감정 강도)은 반드시 포함되어야 합니다.
${HTML_STYLE_GUIDE}`,
  xfiler: `엑스파일러 관점에서 크라임씬 수사 시스템을 HTML 시각화로 작성해주세요.
스킬 파일의 레퍼런스를 참고해 이 사건 구조에 가장 적합한 형식으로 자유롭게 설계하세요.
핵심 산출물(증거 목록·수사 플로우·용의자 프로파일·검거 조건)은 반드시 포함되어야 합니다.
${HTML_STYLE_GUIDE}`,
}

export async function runProjectCollaboration(
  projectName: string,
  projectTheme: string,
  agentSkills: Record<string, SkillFile[]>,
  onProgress: (agentId: AgentId, status: 'running' | 'streaming' | 'done', result?: string) => void,
  crimeConfig?: CrimeConfig,
  attachments?: SkillFile[],
  gameSystemTypes?: GameSystemType[],
  briefings?: Partial<Record<AgentId, BriefingData>>,
  commonSkills?: SkillFile[],
  options?: {
    startFromAgentId?: AgentId
    endAtAgentId?: AgentId
    seedReports?: AgentReport[]
    signal?: AbortSignal
    timeoutMs?: number
  }
): Promise<AgentReport[]> {
  const reports: AgentReport[] = [...(options?.seedReports ?? [])]
  let cumulativeContext = `프로젝트 공식 이름: ${projectName}\n프로젝트 테마: ${projectTheme}\n\n`

  if (crimeConfig) {
    cumulativeContext += buildCrimeContext(crimeConfig) + '\n\n'
  }

  const systemTypeCtx = gameSystemTypes?.length
    ? `\n게임 시스템 타입: ${gameSystemTypes.map(t => t === 'escape' ? '방탈출' : t === 'surround' ? '서라운드' : '크라임씬').join(', ')}\n`
    : ''
  cumulativeContext += systemTypeCtx

  // 첨부파일 (도면 포함)
  const attachmentContent = filterBinaryForMaxMode(buildFileContent(attachments ?? []))

  const baseOrder: AgentId[] = ['ceo', 'concept', 'pd', 'puzzle', 'space', 'ops']
  const extraOrder: AgentId[] = []
  if (gameSystemTypes?.includes('surround')) extraOrder.push('sound')
  if (gameSystemTypes?.includes('crimescene')) extraOrder.push('xfiler')
  const agentOrder: AgentId[] = [...baseOrder, ...extraOrder]
  const startIndex = options?.startFromAgentId ? Math.max(0, agentOrder.indexOf(options.startFromAgentId)) : 0
  const endIndex = options?.endAtAgentId ? agentOrder.indexOf(options.endAtAgentId) : -1
  const rerunOrder = endIndex >= startIndex
    ? agentOrder.slice(startIndex, endIndex + 1)
    : agentOrder.slice(startIndex)

  for (const seeded of options?.seedReports ?? []) {
    if (seeded.summary?.trim()) {
      cumulativeContext += `\n--- ${seeded.agentName} 기획안 ---\n${seeded.summary.trim()}\n`
    }
  }

  for (const agentId of rerunOrder) {
    const agentDef = AGENTS.find(a => a.id === agentId)!
    const agent = { ...agentDef, skills: [...(commonSkills ?? []), ...(agentSkills[agentId] || [])].filter(s => s.enabled !== false) }

    onProgress(agentId, 'running')

    // 브리핑 내용을 컨텍스트에 추가
    const agentBriefing = briefings?.[agentId]
    const briefingContext = agentBriefing?.messages.length
      ? `\n\n== 사전 브리핑 내용 (사용자와의 사전 논의) ==\n` +
        agentBriefing.messages.map(m =>
          `[${m.role === 'user' ? '사용자' : '에이전트'}] ${m.content}`
        ).join('\n') +
        `\n== 브리핑 끝 ==\n위 브리핑 내용을 보고서에 충분히 반영하세요.`
      : ''

    const promptText = `위의 프로젝트 맥락을 바탕으로 ${AGENT_PROMPT_TEXTS[agentId]}${briefingContext}

중요:
- 프로젝트의 공식 이름은 반드시 "${projectName}" 입니다.
- 다른 제목, 부제, 대체 이름을 새로 만들거나 임의로 바꾸지 마세요.
- 보고서 안에서 프로젝트명을 언급할 때는 항상 "${projectName}"만 사용하세요.`

    try {
      // 첫 에이전트에게만 첨부파일 포함 (컨텍스트 공유)
      const useAttachments = agentId === 'ceo' && attachmentContent.length > 0
      const skillContent = filterBinaryForMaxMode(buildFileContent(agent.skills))
      const userContent: unknown[] = [
        ...(useAttachments ? attachmentContent : []),
        ...skillContent,
        { type: 'text', text: promptText }
      ]

      const thinkingOpts = resolveThinking('deep')
      const onChunk = (text: string) => onProgress(agentId, 'streaming', text)
      const result = isMaxMode()
        // Max mode: stream SSE from local CLI server
        ? await streamMaxModeRequest({
            model: resolveModel('deep'),
            max_tokens: resolveMaxTokens('deep'),
            ...(thinkingOpts ? { thinking: thinkingOpts } : {}),
            system: getSystemPrompt(agent, cumulativeContext),
            messages: [{ role: 'user', content: userContent }],
          }, { signal: options?.signal, onChunk })
        // Direct API: stream SSE from Anthropic
        : await streamAnthropicRequest({
            model: resolveModel('deep'),
            max_tokens: resolveMaxTokens('deep'),
            ...(thinkingOpts ? { thinking: thinkingOpts } : {}),
            system: getSystemPrompt(agent, cumulativeContext),
            messages: [{ role: 'user', content: userContent }],
          }, { signal: options?.signal, onChunk })

      const summaryMatch = result.match(/\[요약\]([\s\S]*?)(?=\[상세\]|<!--XYNAPS_HTML-->|$)/)
      const detailMatch = result.match(/\[상세\]([\s\S]*)$/)
      const htmlMarkerIdx = result.indexOf('<!--XYNAPS_HTML-->')
      const summary = summaryMatch?.[1]?.trim() || (htmlMarkerIdx > 0 ? result.slice(0, htmlMarkerIdx).replace('[요약]','').trim() : result.slice(0, 300))
      const detail = detailMatch?.[1]?.trim() || result

      const report: AgentReport = {
        agentId,
        agentName: agent.name,
        summary,
        detail,
        status: 'done',
      }

      const existingIndex = reports.findIndex(item => item.agentId === agentId)
      if (existingIndex >= 0) reports[existingIndex] = report
      else reports.push(report)
      // 누적 컨텍스트엔 요약만 포함 (HTML 제외)
      cumulativeContext += `\n--- ${agent.name} 기획안 ---\n${summary}\n`
      onProgress(agentId, 'done', result)
    } catch (e) {
      console.error(`[${agent.name}] 에이전트 오류 (raw):`, e)
      const readableError = toReadableApiError(e, `${agent.name} 협업 생성에 실패했습니다.`)
      const report: AgentReport = {
        agentId,
        agentName: agent.name,
        summary: '오류가 발생했습니다',
        detail: readableError.message,
        status: 'done',
      }
      const existingIndex = reports.findIndex(item => item.agentId === agentId)
      if (existingIndex >= 0) reports[existingIndex] = report
      else reports.push(report)
      onProgress(agentId, 'done')
    }
  }

  return reports.sort((a, b) => agentOrder.indexOf(a.agentId) - agentOrder.indexOf(b.agentId))
}

export async function runFinalReport(
  projectName: string,
  reports: AgentReport[],
  pdAgent: Agent,
  options?: { signal?: AbortSignal; timeoutMs?: number }
): Promise<{ summary: string; detail: string }> {
  const reportsText = reports.map(r =>
    `## ${r.agentName}\n${r.summary}`
  ).join('\n\n')

const prompt = `프로젝트 공식 이름은 "${projectName}" 입니다.
문서 안의 프로젝트명 표기는 반드시 "${projectName}"만 사용하세요.

다음은 전문 에이전트 팀의 핵심 요약입니다:

${reportsText}

아래 형식으로 간결한 최종 기획 개요를 작성하세요. 에이전트 보고서를 중복 나열하지 말고, 통합·압축하세요.

[요약]
프로젝트의 핵심 정체성과 플레이 경험을 3줄로 요약하세요.

[상세]
<!--XYNAPS_HTML-->
다크 테마 인라인 스타일 HTML로 아래 3개 섹션만 작성하세요 (간결하게, 불필요한 반복 금지).
모든 style은 inline, font-family: -apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif.
전체 배경: background:#0f172a; color:#e2e8f0; padding:24px; border-radius:16px

① 프로젝트 헤더
- 프로젝트명(대형 텍스트), 장르·시간·난이도 서브타이틀
- 핵심 키워드 배지 3~4개 (border-radius:20px; padding:3px 10px; font-size:11px)
- 플레이타임·섹션수·퍼즐수·난이도 지표 가로 4칸 카드

② 게임 플로우 테이블 (핵심)
- table-layout:fixed; width:100%; border-collapse:collapse
- 컬럼: 섹션명(20%) | 시간(10%) | 핵심 퍼즐·장치(35%) | 감정 포인트(35%)
- td: word-break:break-word; padding:8px 10px; font-size:12px; border-bottom:1px solid #1e293b; vertical-align:top

③ 에이전트 핵심 결론 카드 그리드 (2열)
- 각 에이전트별 카드: 역할명 + 핵심 결론 1~2줄
- background:#1e293b; border:1px solid #334155; border-radius:8px; padding:12px`

  const skillContent = filterBinaryForMaxMode(buildFileContent(pdAgent.skills))
  const response = await fetchAnthropicWithTimeout({
    model: MODEL_FAST,
    max_tokens: 3500,
    system: getSystemPrompt(pdAgent),
    messages: [{ role: 'user', content: [...skillContent, { type: 'text', text: prompt }] }],
  }, options)
  const data = await response.json()
  if (!response.ok) throw new Error(data.error?.message || 'API 오류')
  const result = extractText(data)
  const summaryMatch = result.match(/\[요약\]([\s\S]*?)(?=\[상세\]|$)/)
  const detailMatch = result.match(/\[상세\]([\s\S]*)$/)

  return {
    summary: summaryMatch?.[1]?.trim() || result.slice(0, 300),
    detail: detailMatch?.[1]?.trim() || result,
  }
}

export async function compileGameFlow(
  projectTheme: string,
  crimeConfig: CrimeConfig | undefined,
  agentReports: AgentReport[],
  attachments?: SkillFile[],
  onProgress?: (status: 'running' | 'done') => void
): Promise<GameFlowSheet> {
  onProgress?.('running')

  const reportsText = agentReports.map(r =>
    `### ${r.agentName} (${r.agentId})\n${r.summary || r.detail}`
  ).join('\n\n')

  const crimeContext = crimeConfig ? buildCrimeContext(crimeConfig) : ''
  const attachmentContent = filterBinaryForMaxMode(buildFileContent(attachments ?? []))

  const systemPrompt = `방탈출 게임 플로우 시트 전문가. 유효한 JSON만 반환, 다른 텍스트 없음.
Xkit=디지털파일장치 Key=물리잠금 Dev=전자센서/트리거
문제유형: 평면(텍스트/영상/x-kit/UV) 입체(물품/장치) 공간(배치/협동) 감각`

  const userPrompt = `테마: ${projectTheme}
${crimeContext ? crimeContext.split('\n').slice(0, 10).join('\n') : ''}

에이전트 요약:
${reportsText}

게임 플로우 JSON 작성 (30스텝 이내, 핵심만):
- 공간별 섹션, 플레이어 진행순
- story: 핵심행동 1문장

반환 형식 (JSON만, 다른 텍스트 없이):
{
  "sections": [
    {
      "title": "섹션명 (예: 서재 입장)",
      "steps": [
        {
          "step": 1,
          "clue": "단서/소품 이름",
          "story": "이 단계의 게임 진행 스토리와 풀이 흐름을 1~2문장으로 요약",
          "input": "플레이어 입력값 또는 행동",
          "xkit": false,
          "key": false,
          "dev": false,
          "output": "결과 / 열리는 것 / 다음 단계",
          "auto": false,
          "problemType": "평면"
        }
      ]
    }
  ]
}`

  const userContent: unknown[] = [
    ...(attachmentContent.length > 0 ? attachmentContent : []),
    { type: 'text', text: userPrompt }
  ]

  try {
    const thinkingFinal = resolveThinking('deep')
    const response = await fetchAnthropicWithTimeout({
      model: resolveModel('deep'),
      max_tokens: resolveMaxTokens('deep'),
      ...(thinkingFinal ? { thinking: thinkingFinal } : {}),
      system: systemPrompt,
      messages: [{ role: 'user', content: userContent }],
    }, { timeoutMs: 720000 })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || 'API 오류')
    const text: string = extractText(data)

    // JSON 파싱 — 1차 직접 파싱, 실패 시 2차 엄격 JSON 복구, 그래도 실패하면 태그 포맷 재생성
    let parsed: { sections?: Array<{ title?: string; steps?: unknown[] }> }
    try {
      parsed = parseModelJsonResponse(text) as { sections?: Array<{ title?: string; steps?: unknown[] }> }
    } catch {
      try {
        parsed = await repairModelJsonResponse(text, `{
  "sections": [
    {
      "title": "섹션명",
      "steps": [
        {
          "step": 1,
          "clue": "단서/소품 이름",
          "story": "진행 스토리 요약",
          "input": "입력값 또는 행동",
          "xkit": false,
          "key": false,
          "dev": false,
          "output": "결과",
          "auto": false,
          "problemType": "평면"
        }
      ]
    }
  ]
}`) as { sections?: Array<{ title?: string; steps?: unknown[] }> }
      } catch {
        parsed = await generateTaggedGameFlowResponse(
          projectTheme,
          crimeContext,
          reportsText,
          attachmentContent,
        ) as { sections?: Array<{ title?: string; steps?: unknown[] }> }
      }
    }

    const sections: GameFlowSection[] = (parsed.sections || []).map((sec: { title?: string; steps?: unknown[] }) => {
      const safeSteps: Partial<GameStep>[] = Array.isArray(sec.steps)
        ? sec.steps as Partial<GameStep>[]
        : []
      return {
        id: crypto.randomUUID(),
        title: sec.title || '미정',
        steps: safeSteps.map((s, i) => ({
          id: crypto.randomUUID(),
          step: s.step ?? i + 1,
          clue: s.clue || '',
          story: s.story || '',
          input: s.input || '',
          xkit: Boolean(s.xkit),
          key: Boolean(s.key),
          dev: Boolean(s.dev),
          output: s.output || '',
          auto: Boolean(s.auto),
          problemType: (s.problemType || '') as ProblemType,
          note: s.note,
        })),
      }
    })

    onProgress?.('done')
    return { sections, generatedAt: new Date().toISOString() }
  } catch (error) {
    onProgress?.('done')
    throw toReadableApiError(error, '게임 플로우 생성에 실패했습니다.')
  }
}

export async function compileAudioScript(soundReportText: string): Promise<import('../types').AudioScript> {
  try {
    const response = await fetchAnthropicWithTimeout({
      model: MODEL_FAST,
      max_tokens: 8000,
      system: '오디오 스크립트를 JSON으로 변환합니다. 유효한 JSON만 반환하세요.',
      messages: [{
        role: 'user',
        content: [{
          type: 'text',
          text: `다음 음향 보고서 텍스트를 AudioScript JSON 형식으로 변환해주세요.\n\n반환 형식:\n{\n  "tracks": [\n    {\n      "trackNum": 1,\n      "title": "트랙 제목",\n      "timeStart": "00:00",\n      "timeEnd": "01:30",\n      "rows": [\n        { "kind": "line", "channel": "L+R", "content": "내용" },\n        { "kind": "cue", "content": "큐 마커 메모" }\n      ]\n    }\n  ]\n}\n\n유효한 channel 값: "L", "R", "C", "L+R", "SFX", "전환"\n유효한 kind 값: "line", "cue"\n\n음향 보고서:\n${soundReportText}`,
        }],
      }],
    }, { timeoutMs: 300000 })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || 'AudioScript 생성 API 오류')
    const text: string = extractText(data)

    const parsed = parseModelJsonResponse(text) as { tracks?: Array<{
      trackNum?: number
      title?: string
      timeStart?: string
      timeEnd?: string
      rows?: Array<{ kind?: string; channel?: string; content?: string }>
    }> }

    const tracks: import('../types').AudioScriptTrack[] = (parsed.tracks ?? []).map(t => ({
      id: crypto.randomUUID(),
      trackNum: t.trackNum ?? 1,
      title: String(t.title ?? '').trim(),
      timeStart: String(t.timeStart ?? '00:00').trim(),
      timeEnd: String(t.timeEnd ?? '00:00').trim(),
      rows: (t.rows ?? []).map(r => ({
        id: crypto.randomUUID(),
        kind: (r.kind === 'cue' ? 'cue' : 'line') as import('../types').AudioRowKind,
        channel: r.channel as import('../types').AudioChannel | undefined,
        content: String(r.content ?? '').trim(),
      })),
    }))

    return { tracks, generatedAt: new Date().toISOString() }
  } catch (error) {
    throw toReadableApiError(error, 'AudioScript 생성에 실패했습니다.')
  }
}

// ── 회의실 멀티 에이전트 채팅 ──────────────────────────────────────────────────

export async function chatWorkshopMultiAgent(
  session: WorkshopSession,
  agentReports: AgentReport[],
  projectContext: string,
): Promise<string> {
  const reportsContext = agentReports
    .filter(r => r.status === 'done' && r.summary?.trim())
    .map(r => `[${r.agentName}] ${r.summary.trim()}`)
    .join('\n')

  const conversationHistory = session.messages.map(m => ({
    role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: m.content,
  }))

  const responses: string[] = []

  for (const agentId of session.participants) {
    const agentDef = AGENTS.find(a => a.id === agentId)
    if (!agentDef) continue

    const systemPrompt = `${getSystemPrompt(agentDef, projectContext)}

현재 작성된 에이전트 보고서 요약:
${reportsContext || '(아직 보고서가 없습니다)'}

당신은 지금 방탈출 기획 개선을 위한 전문가 회의에 참여 중입니다.
회의 주제: ${session.title}
당신의 전문 영역(${agentDef.role})에서 구체적이고 실용적인 의견을 제시하세요.
자연스러운 대화체로 응답하되, 추상적인 표현을 피하고 실제 기획 내용을 언급하세요.
HTML 없이 일반 텍스트로만 응답하세요.
응답 시작에 자신의 이름을 포함하지 마세요.`

    const messages = [...conversationHistory]

    if (responses.length > 0) {
      messages.push({
        role: 'user',
        content: `(앞선 참여자 의견:\n${responses.join('\n\n')})\n\n위 의견을 참고하여 ${agentDef.role} 관점에서 의견을 추가해주세요.`,
      })
    }

    const response = await fetch(resolveEndpoint(), {
      method: 'POST',
      headers: resolveApiHeaders(),
      body: JSON.stringify({
        model: resolveModel('fast'),
        max_tokens: resolveMaxTokens('fast'),
        system: systemPrompt,
        messages,
      }),
    })

    const data = await response.json()
    if (!response.ok) throw new Error(data.error?.message || 'API 오류')
    const text: string = extractText(data)
    responses.push(`[${agentDef.emoji} ${agentDef.name}]\n${text}`)
  }

  return responses.join('\n\n')
}
