// ── 스토리 작업노트 유틸 ───────────────────────────────────────────────────────
// 웹소설 작업노트(나침반 · 집필 원칙 · 인물 코어시트 · 공간 설정 · 관계선 지도 ·
// 전체 줄거리 구조 · 회차 네비게이션 · 떡밥 트래커)를 방탈출 스토리 설계에 맞게 옮긴 것.
// - 기본값 / 프리셋
// - 수사 백과사전(crimeConfig)과의 동기화 (인물·공간·관계를 노트로 끌어오기)
// - 에이전트 프롬프트용 텍스트 컨텍스트
// - AI 초안 병합 (사용자가 쓴 내용은 절대 덮어쓰지 않는다)

import type {
  CrimeConfig, StoryNote, StoryCompass, StoryPrinciple, CharacterCoreSheet, SpaceNote,
  RelationArc, PlotPart, RoomNavEntry, ForeshadowItem, StoryStageKey, StoryEndingType, ForeshadowStatus,
} from '../types'
import { STORY_STAGES } from '../data/crimeData'

export const STAGE_PART_LABELS: Record<StoryStageKey, string> = {
  '기': '1부 · 기 (발단)',
  '승': '2부 · 승 (전개)',
  '전': '3부 · 전 (절정)',
  '반전': '4부 · 반전',
  '결': '5부 · 결 (결말)',
}

export const ENDING_TYPES: Array<{ key: StoryEndingType; label: string; desc: string }> = [
  { key: '감', label: '감', desc: '감정적 감동' },
  { key: '정', label: '정', desc: '정보의 폭발' },
  { key: '위', label: '위', desc: '위기 발생' },
  { key: '대', label: '대', desc: '대치' },
]

export const FORESHADOW_STATUSES: ForeshadowStatus[] = ['설치', '회수', '미회수', '폐기']

// 전작들 쓰면서 후회했던 것 → 방탈출 제작 버전. 막힐 때 말고, 매 방 설계 전에 한 번씩.
export const DEFAULT_PRINCIPLES: Omit<StoryPrinciple, 'id' | 'note'>[] = [
  {
    title: '강약조절 · 속도감',
    description: '모든 방·퍼즐에 힘주지 않는다. 클라이맥스가 되는 한 장면(방/스텝)을 정하고, 나머지는 그 장면을 위해 흐르게 둔다. 지금 플레이어의 시선이 어디를 향하는지 의식하며 설계한다 — 클로즈업할 방과 빨리 넘길 방을 구분한다.',
    checkQuestion: '이 테마에서 진짜 힘줘야 하는 한 장면은 어디인가? 나머지는 그 장면을 위해 존재하는가?',
  },
  {
    title: '캐릭터는 설정이 아니라 행동 매뉴얼',
    description: '인물 프로필을 적는 게 목적이 아니라, "이 상황이면 이렇게 행동한다"가 바로 떠오를 만큼 구체적으로 만든다. 플레이어가 만나는 메모·음성·소품·단서에서 그 인물이 일관되게 드러나야 한다. 조연도 마찬가지 — 지금 안 써도 나중에 써먹을 설정을 미리 심어둔다.',
    checkQuestion: '이 단서·대사에서 인물이 이렇게 행동하는 게, 코어시트랑 어긋나지 않는가?',
  },
  {
    title: '납득 가능한 서사 — 플레이어는 뒷내용을 모른다',
    description: '제작자는 결말을 알지만 플레이어는 지금 이 방에서 보이는 것만으로 판단한다. 인물의 배경·직업·성격은 실제 소품과 단서 속 디테일로 드러나야 납득된다. (예: 의사가 범인이라면 진료실에 의사다운 디테일이 실제로 보여야 한다)',
    checkQuestion: '이 설정, 플레이어가 지금 이 방만 보고도 믿을 수 있는가?',
  },
]

function newId(): string {
  return crypto.randomUUID()
}

export function createEmptyCompass(): StoryCompass {
  return { logline: '', coreConflict: '', differentiator: '', genreTone: '', freeNotes: '' }
}

export function createDefaultPrinciples(): StoryPrinciple[] {
  return DEFAULT_PRINCIPLES.map(p => ({ id: newId(), ...p, note: '' }))
}

export function createDefaultPlotParts(): PlotPart[] {
  return STORY_STAGES.map(stage => ({ stage, title: '', goal: '', turningPoint: '', climax: '' }))
}

export function createCharacterSheet(init?: Partial<CharacterCoreSheet>): CharacterCoreSheet {
  return {
    id: newId(), name: '', identity: '', lack: '', lie: '', neverDoes: '', mannerisms: '',
    simulations: [], ...init,
  }
}

export function createSpaceNote(init?: Partial<SpaceNote>): SpaceNote {
  return { id: newId(), roomName: '', purpose: '', duality: '', sensoryDetail: '', keyEvents: '', ...init }
}

export function createRelationArc(init?: Partial<RelationArc>): RelationArc {
  return { id: newId(), fromName: '', toName: '', closenessStart: 2, closenessMid: 2, closenessEnd: 2, howShown: '', ...init }
}

export function createRoomNavEntry(init?: Partial<RoomNavEntry>): RoomNavEntry {
  return {
    id: newId(), label: '', event: '', emotion: '', playerFeels: '', nextHook: '', nextTeaser: '',
    checkPacing: false, checkCharacter: false, checkPlausibility: false, ...init,
  }
}

export function createForeshadowItem(init?: Partial<ForeshadowItem>): ForeshadowItem {
  return { id: newId(), content: '', plantedAt: '', payoffAt: '', status: '설치', memo: '', ...init }
}

export function createEmptyStoryNote(): StoryNote {
  return {
    compass: createEmptyCompass(),
    principles: createDefaultPrinciples(),
    characterSheets: [],
    spaceNotes: [],
    relationArcs: [],
    plotParts: createDefaultPlotParts(),
    roomNav: [],
    foreshadows: [],
    updatedAt: new Date().toISOString(),
  }
}

// 예전 저장본에 필드가 빠져 있어도 화면이 깨지지 않게 보정
export function normalizeStoryNote(raw: Partial<StoryNote> | undefined | null): StoryNote {
  const empty = createEmptyStoryNote()
  if (!raw) return empty
  const stageSet = new Set<string>(STORY_STAGES)
  const plotByStage = new Map((raw.plotParts ?? []).filter(p => p && stageSet.has(p.stage)).map(p => [p.stage, p]))
  return {
    compass: { ...empty.compass, ...(raw.compass ?? {}) },
    principles: (raw.principles?.length ? raw.principles : empty.principles).map(p => ({ ...p, note: p.note ?? '' })),
    characterSheets: (raw.characterSheets ?? []).map(c => ({ ...createCharacterSheet(), ...c, simulations: c.simulations ?? [] })),
    spaceNotes: (raw.spaceNotes ?? []).map(s => ({ ...createSpaceNote(), ...s })),
    relationArcs: (raw.relationArcs ?? []).map(r => ({ ...createRelationArc(), ...r })),
    plotParts: STORY_STAGES.map(stage => ({ ...empty.plotParts.find(p => p.stage === stage)!, ...(plotByStage.get(stage) ?? {}) })),
    roomNav: (raw.roomNav ?? []).map(r => ({ ...createRoomNavEntry(), ...r })),
    foreshadows: (raw.foreshadows ?? []).map(f => ({ ...createForeshadowItem(), ...f })),
    updatedAt: raw.updatedAt ?? empty.updatedAt,
    generatedAt: raw.generatedAt,
  }
}

// ── 수사 백과사전과 동기화 ───────────────────────────────────────────────────

export function characterDisplayName(crime: CrimeConfig | undefined, characterId: string): string {
  const chars = crime?.characters ?? []
  const c = chars.find(x => x.id === characterId)
  if (!c) return '?'
  if (c.name) return c.name
  const sameRole = chars.filter(x => x.role === c.role)
  if (sameRole.length <= 1) return c.role
  const idx = sameRole.findIndex(x => x.id === characterId)
  return `${c.role} ${String.fromCharCode(65 + idx)}`
}

export function crimeRoomNames(crime: CrimeConfig | undefined): string[] {
  const names: string[] = []
  for (const s of crime?.storyFlow ?? []) {
    const n = (s.roomName ?? '').trim()
    if (n && !names.includes(n)) names.push(n)
  }
  return names
}

/**
 * 수사 백과사전의 인물·공간·관계 중 노트에 아직 없는 것만 빈 시트로 추가한다.
 * 이미 있는 항목은 건드리지 않는다. 변경이 없으면 같은 객체를 돌려준다.
 */
export function syncStoryNoteWithCrime(note: StoryNote, crime: CrimeConfig | undefined): StoryNote {
  if (!crime) return note
  let changed = false

  const characterSheets = [...note.characterSheets]
  for (const c of crime.characters ?? []) {
    const label = characterDisplayName(crime, c.id)
    const exists = characterSheets.some(s => s.characterId === c.id || (s.name && s.name === label))
    if (!exists) {
      characterSheets.push(createCharacterSheet({ characterId: c.id, name: label }))
      changed = true
    }
  }

  const spaceNotes = [...note.spaceNotes]
  for (const room of crimeRoomNames(crime)) {
    if (!spaceNotes.some(s => s.roomName.trim() === room)) {
      spaceNotes.push(createSpaceNote({ roomName: room }))
      changed = true
    }
  }

  const relationArcs = [...note.relationArcs]
  for (const r of crime.relations ?? []) {
    const fromName = characterDisplayName(crime, r.fromId)
    const toName = characterDisplayName(crime, r.toId)
    const exists = relationArcs.some(a => a.relationId === r.id || (a.fromName === fromName && a.toName === toName))
    if (!exists) {
      relationArcs.push(createRelationArc({ relationId: r.id, fromName, toName }))
      changed = true
    }
  }

  const roomNav = [...note.roomNav]
  if (roomNav.length === 0) {
    for (const room of crimeRoomNames(crime)) {
      roomNav.push(createRoomNavEntry({ label: room }))
      changed = true
    }
  }

  if (!changed) return note
  return { ...note, characterSheets, spaceNotes, relationArcs, roomNav, updatedAt: new Date().toISOString() }
}

// ── 프롬프트 컨텍스트 ────────────────────────────────────────────────────────

function has(s: string | undefined): s is string {
  return Boolean(s && s.trim())
}

export function isStoryNoteEmpty(note: StoryNote | undefined): boolean {
  if (!note) return true
  const c = note.compass
  if ([c.logline, c.coreConflict, c.differentiator, c.genreTone, c.freeNotes].some(has)) return false
  if (note.principles.some(p => has(p.note))) return false
  if (note.characterSheets.some(s => [s.identity, s.lack, s.lie, s.neverDoes, s.mannerisms].some(has) || s.simulations.some(x => has(x.situation) || has(x.reaction)))) return false
  if (note.spaceNotes.some(s => [s.purpose, s.duality, s.sensoryDetail, s.keyEvents].some(has))) return false
  if (note.relationArcs.some(r => has(r.howShown))) return false
  if (note.plotParts.some(p => [p.title, p.goal, p.turningPoint, p.climax].some(has))) return false
  if (note.roomNav.some(r => [r.event, r.emotion, r.playerFeels, r.nextHook, r.nextTeaser].some(has))) return false
  if (note.foreshadows.some(f => has(f.content))) return false
  return true
}

const CLOSENESS_LABEL = ['멀어짐', '소원', '보통', '가까움', '매우 가까움']

/** 에이전트·게임플로우·비트 시트 프롬프트에 함께 넣는 텍스트. 빈 항목은 생략. */
export function buildStoryNoteContext(note: StoryNote | undefined): string {
  if (!note || isStoryNoteEmpty(note)) return ''
  const lines: string[] = ['📝 스토리 작업노트 (기획자가 직접 정리한 서사 설계 — 최우선 준수):']

  const c = note.compass
  const compass: string[] = []
  if (has(c.logline)) compass.push(`  로그라인: ${c.logline.trim()}`)
  if (has(c.coreConflict)) compass.push(`  핵심 갈등: ${c.coreConflict.trim()}`)
  if (has(c.differentiator)) compass.push(`  차별점: ${c.differentiator.trim()}`)
  if (has(c.genreTone)) compass.push(`  장르·톤·뒷맛: ${c.genreTone.trim()}`)
  if (has(c.freeNotes)) compass.push(`  메모: ${c.freeNotes.trim()}`)
  if (compass.length) lines.push('[스토리 나침반]', ...compass)

  const principles = note.principles.filter(p => has(p.note))
  if (principles.length) {
    lines.push('[제작 원칙 — 이 프로젝트 적용]')
    principles.forEach(p => lines.push(`  - ${p.title}: ${p.note.trim()}`))
  }

  const sheets = note.characterSheets.filter(s => [s.identity, s.lack, s.lie, s.neverDoes, s.mannerisms].some(has) || s.simulations.some(x => has(x.situation)))
  if (sheets.length) {
    lines.push('[인물 코어시트]')
    sheets.forEach(s => {
      lines.push(`  ■ ${s.name || '(이름 없음)'}${has(s.identity) ? ` — ${s.identity.trim()}` : ''}`)
      if (has(s.lack)) lines.push(`    결핍(진짜 원하는 것): ${s.lack.trim()}`)
      if (has(s.lie)) lines.push(`    거짓말(스스로·세상에게): ${s.lie.trim()}`)
      if (has(s.neverDoes)) lines.push(`    절대 하지 않을 행동: ${s.neverDoes.trim()}`)
      if (has(s.mannerisms)) lines.push(`    말투·습관: ${s.mannerisms.trim()}`)
      s.simulations.filter(x => has(x.situation) || has(x.reaction)).forEach(x => {
        lines.push(`    상황→행동: ${x.situation.trim()} → ${x.reaction.trim()}`)
      })
    })
  }

  const spaces = note.spaceNotes.filter(s => [s.purpose, s.duality, s.sensoryDetail, s.keyEvents].some(has))
  if (spaces.length) {
    lines.push('[공간 설정 노트]')
    spaces.forEach(s => {
      lines.push(`  ■ ${s.roomName || '(공간명 없음)'}`)
      if (has(s.purpose)) lines.push(`    기능(왜 필요한가): ${s.purpose.trim()}`)
      if (has(s.duality)) lines.push(`    이중성·대비: ${s.duality.trim()}`)
      if (has(s.sensoryDetail)) lines.push(`    감각 디테일: ${s.sensoryDetail.trim()}`)
      if (has(s.keyEvents)) lines.push(`    핵심 사건·퍼즐: ${s.keyEvents.trim()}`)
    })
  }

  const arcs = note.relationArcs.filter(r => r.fromName && r.toName)
  if (arcs.length) {
    lines.push('[관계선 지도 — 시작 → 중간 → 결말]')
    arcs.forEach(r => {
      const lbl = (n: number) => CLOSENESS_LABEL[Math.max(0, Math.min(4, Math.round(n)))]
      let line = `  ${r.fromName} ↔ ${r.toName}: ${lbl(r.closenessStart)} → ${lbl(r.closenessMid)} → ${lbl(r.closenessEnd)}`
      if (has(r.howShown)) line += ` / 보여주는 방식: ${r.howShown.trim()}`
      lines.push(line)
    })
  }

  const parts = note.plotParts.filter(p => [p.title, p.goal, p.turningPoint, p.climax].some(has))
  if (parts.length) {
    lines.push('[전체 줄거리 구조 — 5부]')
    parts.forEach(p => {
      lines.push(`  ${STAGE_PART_LABELS[p.stage]}${has(p.title) ? ` "${p.title.trim()}"` : ''}`)
      if (has(p.goal)) lines.push(`    목표: ${p.goal.trim()}`)
      if (has(p.turningPoint)) lines.push(`    전환점: ${p.turningPoint.trim()}`)
      if (has(p.climax)) lines.push(`    클라이맥스: ${p.climax.trim()}`)
    })
  }

  const nav = note.roomNav.filter(r => [r.event, r.emotion, r.playerFeels, r.nextHook, r.nextTeaser].some(has))
  if (nav.length) {
    lines.push('[방(회차) 네비게이션 — 이 방이 왜 존재하는지 / 다음 방 훅]')
    nav.forEach((r, i) => {
      const ending = r.endingType ? ` (엔딩: ${ENDING_TYPES.find(e => e.key === r.endingType)?.desc ?? r.endingType})` : ''
      lines.push(`  ${i + 1}. ${r.label || '(구간명 없음)'}${ending}`)
      if (has(r.event)) lines.push(`    사건: ${r.event.trim()}`)
      if (has(r.emotion)) lines.push(`    이번 방 감정: ${r.emotion.trim()}`)
      if (has(r.playerFeels)) lines.push(`    플레이어가 느낄 것: ${r.playerFeels.trim()}`)
      if (has(r.nextHook)) lines.push(`    다음 방 훅: ${r.nextHook.trim()}`)
      if (has(r.nextTeaser)) lines.push(`    다음 방 예고: ${r.nextTeaser.trim()}`)
    })
  }

  const fs = note.foreshadows.filter(f => has(f.content))
  if (fs.length) {
    lines.push('[복선·떡밥 트래커 — 설치한 것은 반드시 회수]')
    fs.forEach(f => {
      let line = `  - [${f.status}] ${f.content.trim()}`
      if (has(f.plantedAt)) line += ` / 설치: ${f.plantedAt.trim()}`
      if (has(f.payoffAt)) line += ` / 회수: ${f.payoffAt.trim()}`
      if (has(f.memo)) line += ` / ${f.memo.trim()}`
      lines.push(line)
    })
  }

  return lines.join('\n')
}

// ── AI 초안 병합 ─────────────────────────────────────────────────────────────

/** AI 가 돌려주는 초안 형식 (느슨한 부분 타입) */
export interface StoryNoteDraft {
  compass?: Partial<StoryCompass>
  principles?: Array<{ title?: string; note?: string }>
  characterSheets?: Array<Partial<Omit<CharacterCoreSheet, 'id' | 'simulations'>> & { simulations?: Array<{ situation?: string; reaction?: string }> }>
  spaceNotes?: Array<Partial<Omit<SpaceNote, 'id'>>>
  relationArcs?: Array<Partial<Omit<RelationArc, 'id'>>>
  plotParts?: Array<Partial<PlotPart>>
  roomNav?: Array<Partial<Omit<RoomNavEntry, 'id'>>>
  foreshadows?: Array<Partial<Omit<ForeshadowItem, 'id'>>>
}

function fill(current: string, draft: unknown): string {
  if (has(current)) return current
  return typeof draft === 'string' ? draft.trim() : current
}

function clampCloseness(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(4, Math.round(n)))
}

/**
 * AI 초안을 현재 노트 위에 "빈 칸만 채우기" 방식으로 병합한다.
 * - 사용자가 이미 쓴 문자열은 유지
 * - 인물/공간/관계/구간은 이름으로 매칭, 없으면 새로 추가
 */
export function mergeStoryNoteDraft(current: StoryNote, draft: StoryNoteDraft): StoryNote {
  const next = normalizeStoryNote(current)

  const dc = draft.compass ?? {}
  next.compass = {
    logline: fill(next.compass.logline, dc.logline),
    coreConflict: fill(next.compass.coreConflict, dc.coreConflict),
    differentiator: fill(next.compass.differentiator, dc.differentiator),
    genreTone: fill(next.compass.genreTone, dc.genreTone),
    freeNotes: fill(next.compass.freeNotes, dc.freeNotes),
  }

  for (const dp of draft.principles ?? []) {
    const target = next.principles.find(p => p.title === dp.title) ?? next.principles.find(p => dp.title && p.title.includes(dp.title))
    if (target) target.note = fill(target.note, dp.note)
  }

  for (const ds of draft.characterSheets ?? []) {
    const name = (ds.name ?? '').trim()
    if (!name) continue
    let sheet = next.characterSheets.find(s => s.name.trim() === name)
    if (!sheet) { sheet = createCharacterSheet({ name }); next.characterSheets.push(sheet) }
    sheet.identity = fill(sheet.identity, ds.identity)
    sheet.lack = fill(sheet.lack, ds.lack)
    sheet.lie = fill(sheet.lie, ds.lie)
    sheet.neverDoes = fill(sheet.neverDoes, ds.neverDoes)
    sheet.mannerisms = fill(sheet.mannerisms, ds.mannerisms)
    if (sheet.simulations.every(x => !has(x.situation) && !has(x.reaction))) {
      const sims = (ds.simulations ?? []).filter(x => has(x.situation) || has(x.reaction)).slice(0, 3)
      if (sims.length) sheet.simulations = sims.map(x => ({ id: newId(), situation: (x.situation ?? '').trim(), reaction: (x.reaction ?? '').trim() }))
    }
  }

  for (const dsp of draft.spaceNotes ?? []) {
    const room = (dsp.roomName ?? '').trim()
    if (!room) continue
    let sp = next.spaceNotes.find(s => s.roomName.trim() === room)
    if (!sp) { sp = createSpaceNote({ roomName: room }); next.spaceNotes.push(sp) }
    sp.purpose = fill(sp.purpose, dsp.purpose)
    sp.duality = fill(sp.duality, dsp.duality)
    sp.sensoryDetail = fill(sp.sensoryDetail, dsp.sensoryDetail)
    sp.keyEvents = fill(sp.keyEvents, dsp.keyEvents)
  }

  for (const da of draft.relationArcs ?? []) {
    const from = (da.fromName ?? '').trim(); const to = (da.toName ?? '').trim()
    if (!from || !to) continue
    let arc = next.relationArcs.find(a => (a.fromName === from && a.toName === to) || (a.fromName === to && a.toName === from))
    const isNew = !arc
    if (!arc) { arc = createRelationArc({ fromName: from, toName: to }); next.relationArcs.push(arc) }
    if (isNew || !has(arc.howShown)) {
      arc.closenessStart = clampCloseness(da.closenessStart, arc.closenessStart)
      arc.closenessMid = clampCloseness(da.closenessMid, arc.closenessMid)
      arc.closenessEnd = clampCloseness(da.closenessEnd, arc.closenessEnd)
    }
    arc.howShown = fill(arc.howShown, da.howShown)
  }

  for (const dp of draft.plotParts ?? []) {
    const part = next.plotParts.find(p => p.stage === dp.stage)
    if (!part) continue
    part.title = fill(part.title, dp.title)
    part.goal = fill(part.goal, dp.goal)
    part.turningPoint = fill(part.turningPoint, dp.turningPoint)
    part.climax = fill(part.climax, dp.climax)
  }

  for (const dr of draft.roomNav ?? []) {
    const label = (dr.label ?? '').trim()
    if (!label) continue
    let entry = next.roomNav.find(r => r.label.trim() === label)
    if (!entry) { entry = createRoomNavEntry({ label }); next.roomNav.push(entry) }
    entry.event = fill(entry.event, dr.event)
    entry.emotion = fill(entry.emotion, dr.emotion)
    entry.playerFeels = fill(entry.playerFeels, dr.playerFeels)
    entry.nextHook = fill(entry.nextHook, dr.nextHook)
    entry.nextTeaser = fill(entry.nextTeaser, dr.nextTeaser)
    if (!entry.endingType && dr.endingType && ENDING_TYPES.some(e => e.key === dr.endingType)) entry.endingType = dr.endingType
  }

  const existingContents = new Set(next.foreshadows.map(f => f.content.trim()))
  for (const df of draft.foreshadows ?? []) {
    const content = (df.content ?? '').trim()
    if (!content || existingContents.has(content)) continue
    next.foreshadows.push(createForeshadowItem({
      content,
      plantedAt: (df.plantedAt ?? '').trim(),
      payoffAt: (df.payoffAt ?? '').trim(),
      status: FORESHADOW_STATUSES.includes(df.status as ForeshadowStatus) ? (df.status as ForeshadowStatus) : '설치',
      memo: (df.memo ?? '').trim(),
    }))
    existingContents.add(content)
  }

  next.updatedAt = new Date().toISOString()
  next.generatedAt = new Date().toISOString()
  return next
}
