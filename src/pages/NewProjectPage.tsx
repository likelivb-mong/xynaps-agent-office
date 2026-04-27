import { useState, useRef, Fragment, useEffect, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { PaperclipIcon, Spinner, DownloadIcon, WriteIcon } from '../components/ui/Icon'
import { createProject, createDraftVersion, getProjects, saveProject } from '../lib/storage'
import { generateDraftCrimeConfigFromFiles, listGoogleDriveFolderMetadata, generateCombinationSummary } from '../lib/api'
import { BRANCH_CODES } from '../data/questData'
import { CRIME_MOTIVES, CRIME_TYPES, CRIME_CLUES, CRIME_METHODS, GENRES, STORY_STAGES } from '../data/crimeData'
import type { BranchCode, CrimeConfig, SkillFile, Character, CharacterRelation, StoryStage, CharacterRole, RelationType, StoryStageKey, GameSystemType } from '../types'

const STEPS = ['기본 정보', '수사 백과사전', '최종 확인']

const ROLE_COLORS: Record<CharacterRole, string> = {
  '가해자': '#e74c3c',
  '피해자': '#e67e22',
  '목격자': '#1abc9c',
  '주변인물': '#95a5a6',
  '공범': '#9b59b6',
  '의뢰인': '#27ae60',
}

const RELATION_COLORS: Record<RelationType, string> = {
  '원한': '#e74c3c',
  '연인': '#e91e8c',
  '가족': '#e67e22',
  '친구': '#27ae60',
  '동료': '#3498db',
  '공모자': '#9b59b6',
  '피고용': '#95a5a6',
  '피해': '#f39c12',
  '모르는 사이': '#7f8c8d',
  '기타': '#34495e',
}

const CHARACTER_ROLES: CharacterRole[] = ['가해자', '피해자', '목격자', '주변인물', '공범', '의뢰인']
const RELATION_TYPES: RelationType[] = ['원한', '연인', '가족', '친구', '동료', '공모자', '피고용', '피해', '모르는 사이', '기타']
const STAGE_LABELS: Record<StoryStageKey, string> = { '기': '기 (발단)', '승': '승 (전개)', '전': '전 (절정)', '반전': '반전', '결': '결 (결말)' }
const BRANCH_CODE_SET = new Set<BranchCode>(BRANCH_CODES as BranchCode[])
type AutoFillPhase = 'idle' | 'preparing' | 'analyzing' | 'applying' | 'complete'
type KeywordGroupKey = 'A' | 'B' | 'C' | 'D'
type KeywordDropTarget = { type: 'section'; group: KeywordGroupKey; sectionId: string } | { type: 'custom'; group: KeywordGroupKey }
type CrimeKeywordState = {
  id: string
  label: string
  group: KeywordGroupKey
  sectionId: string | null
  isCustom: boolean
  isTemporary: boolean
}
type FixedCrimeKeywordLibrary = Record<KeywordGroupKey, Record<string, string[]>>
type HiddenPresetKeywordLibrary = Record<KeywordGroupKey, string[]>
type CrimePackData = {
  format: 'xynaps-crime-pack'
  version: 1
  project: {
    name: string
    theme: string
    branch: BranchCode | null
  }
  crimeConfig: CrimeConfig
  keywordLayout?: {
    fixedCustomKeywords: FixedCrimeKeywordLibrary
    hiddenPresetKeywords: HiddenPresetKeywordLibrary
  }
}

const FIXED_CRIME_KEYWORDS_KEY = 'xynaps_v2_crime_fixed_keywords'
const HIDDEN_PRESET_KEYWORDS_KEY = 'xynaps_v2_crime_hidden_preset_keywords'
const GENRE_SET = new Set<string>(GENRES)
const GENRE_ALIAS_MAP: Record<string, string> = {
  '미스터리': '미스테리',
  '호러': '공포',
  '서스팬스': '서스펜스',
}

function normalizeGenres(values: readonly string[], allowCustom = true): string[] {
  const next: string[] = []
  for (const raw of values) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const normalized = GENRE_ALIAS_MAP[trimmed] ?? trimmed
    if (!GENRE_SET.has(normalized) && !allowCustom) continue
    if (next.includes(normalized)) continue
    next.push(normalized)
  }
  return next
}

function wait(ms: number) {
  return new Promise(resolve => window.setTimeout(resolve, ms))
}

function getRelationColor(relationType: string) {
  return RELATION_COLORS[relationType as RelationType] ?? RELATION_COLORS['기타']
}

function emptyFixedKeywordLibrary(): FixedCrimeKeywordLibrary {
  return { A: {}, B: {}, C: {}, D: {} }
}

function normalizeFixedKeywordLibrary(raw: unknown): FixedCrimeKeywordLibrary {
  const base = emptyFixedKeywordLibrary()
  if (!raw || typeof raw !== 'object') return base
  for (const group of ['A', 'B', 'C', 'D'] as const) {
    const groupRaw = (raw as Record<string, unknown>)[group]
    if (!groupRaw || typeof groupRaw !== 'object') continue
    for (const [sectionId, labelsRaw] of Object.entries(groupRaw as Record<string, unknown>)) {
      if (!Array.isArray(labelsRaw)) continue
      const labels = labelsRaw
        .map(v => (typeof v === 'string' ? v.trim() : ''))
        .filter(Boolean)
      if (labels.length === 0) continue
      base[group][sectionId] = [...new Set(labels)]
    }
  }
  return base
}

function loadFixedKeywordLibrary(): FixedCrimeKeywordLibrary {
  try {
    return normalizeFixedKeywordLibrary(JSON.parse(localStorage.getItem(FIXED_CRIME_KEYWORDS_KEY) || '{}'))
  } catch {
    return emptyFixedKeywordLibrary()
  }
}

function saveFixedKeywordLibrary(data: FixedCrimeKeywordLibrary) {
  localStorage.setItem(FIXED_CRIME_KEYWORDS_KEY, JSON.stringify(data))
}

function emptyHiddenPresetLibrary(): HiddenPresetKeywordLibrary {
  return { A: [], B: [], C: [], D: [] }
}

function normalizeHiddenPresetLibrary(raw: unknown): HiddenPresetKeywordLibrary {
  const base = emptyHiddenPresetLibrary()
  if (!raw || typeof raw !== 'object') return base
  for (const group of ['A', 'B', 'C', 'D'] as const) {
    const list = (raw as Record<string, unknown>)[group]
    if (!Array.isArray(list)) continue
    base[group] = [...new Set(list.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean))]
  }
  return base
}

function loadHiddenPresetLibrary(): HiddenPresetKeywordLibrary {
  try {
    return normalizeHiddenPresetLibrary(JSON.parse(localStorage.getItem(HIDDEN_PRESET_KEYWORDS_KEY) || '{}'))
  } catch {
    return emptyHiddenPresetLibrary()
  }
}

function saveHiddenPresetLibrary(data: HiddenPresetKeywordLibrary) {
  localStorage.setItem(HIDDEN_PRESET_KEYWORDS_KEY, JSON.stringify(data))
}

function addHiddenPresetKeyword(
  prev: HiddenPresetKeywordLibrary,
  group: KeywordGroupKey,
  label: string,
): HiddenPresetKeywordLibrary {
  const normalized = label.trim()
  if (!normalized) return prev
  return { ...prev, [group]: [...new Set([...(prev[group] ?? []), normalized])] }
}

function removeHiddenPresetKeyword(
  prev: HiddenPresetKeywordLibrary,
  group: KeywordGroupKey,
  label: string,
): HiddenPresetKeywordLibrary {
  const normalized = label.trim()
  if (!normalized) return prev
  return { ...prev, [group]: (prev[group] ?? []).filter(v => v !== normalized) }
}

function decodeBase64Utf8(base64: string): string {
  const binary = atob(base64)
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0))
  return new TextDecoder('utf-8').decode(bytes)
}

function normalizeStringArray(values: unknown): string[] {
  if (!Array.isArray(values)) return []
  return values
    .map(v => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
}

function normalizeCrimePackData(raw: unknown): CrimePackData | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as Record<string, unknown>
  if (obj.format !== 'xynaps-crime-pack' || obj.version !== 1) return null
  const projectRaw = (obj.project && typeof obj.project === 'object') ? obj.project as Record<string, unknown> : {}
  const crimeRaw = (obj.crimeConfig && typeof obj.crimeConfig === 'object') ? obj.crimeConfig as Record<string, unknown> : {}
  const branchRaw = typeof projectRaw.branch === 'string' ? projectRaw.branch : ''
  const branch = BRANCH_CODE_SET.has(branchRaw as BranchCode) ? branchRaw as BranchCode : null
  const charactersRaw = Array.isArray(crimeRaw.characters) ? crimeRaw.characters : []
  const relationsRaw = Array.isArray(crimeRaw.relations) ? crimeRaw.relations : []
  const storyFlowRaw = Array.isArray(crimeRaw.storyFlow) ? crimeRaw.storyFlow : []

  const characters: Character[] = charactersRaw.map(item => {
    const entry = (item && typeof item === 'object') ? item as Record<string, unknown> : {}
    return {
      id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : crypto.randomUUID(),
      role: (typeof entry.role === 'string' && CHARACTER_ROLES.includes(entry.role as CharacterRole)) ? entry.role as CharacterRole : '주변인물',
      name: typeof entry.name === 'string' ? entry.name : '',
      background: typeof entry.background === 'string' ? entry.background : '',
    }
  })
  const characterIds = new Set(characters.map(c => c.id))
  const relations: CharacterRelation[] = relationsRaw
    .map(item => {
      const entry = (item && typeof item === 'object') ? item as Record<string, unknown> : {}
      const relationType = typeof entry.relationType === 'string' && entry.relationType.trim()
        ? entry.relationType.trim()
        : '기타'
      const fromId = typeof entry.fromId === 'string' ? entry.fromId : ''
      const toId = typeof entry.toId === 'string' ? entry.toId : ''
      if (!fromId || !toId || !characterIds.has(fromId) || !characterIds.has(toId) || fromId === toId) return null
      return {
        id: typeof entry.id === 'string' && entry.id.trim() ? entry.id : crypto.randomUUID(),
        fromId,
        relationType,
        toId,
        description: typeof entry.description === 'string' ? entry.description : '',
      }
    })
    .filter((v): v is CharacterRelation => Boolean(v))
  const storyFlowMap = new Map<StoryStageKey, StoryStage>()
  for (const item of storyFlowRaw) {
    const entry = (item && typeof item === 'object') ? item as Record<string, unknown> : {}
    const stage = typeof entry.stage === 'string' && STORY_STAGES.includes(entry.stage as StoryStageKey) ? entry.stage as StoryStageKey : null
    if (!stage) continue
    storyFlowMap.set(stage, {
      stage,
      description: typeof entry.description === 'string' ? entry.description : '',
      roomName: typeof entry.roomName === 'string' ? entry.roomName : '',
    })
  }
  const storyFlow: StoryStage[] = STORY_STAGES.map(stage => storyFlowMap.get(stage as StoryStageKey) ?? { stage: stage as StoryStageKey, description: '', roomName: '' })

  const layoutRaw = (obj.keywordLayout && typeof obj.keywordLayout === 'object') ? obj.keywordLayout as Record<string, unknown> : null
  const keywordLayout = layoutRaw
    ? {
      fixedCustomKeywords: normalizeFixedKeywordLibrary(layoutRaw.fixedCustomKeywords),
      hiddenPresetKeywords: normalizeHiddenPresetLibrary(layoutRaw.hiddenPresetKeywords),
    }
    : undefined

  return {
    format: 'xynaps-crime-pack',
    version: 1,
    project: {
      name: typeof projectRaw.name === 'string' ? projectRaw.name : '',
      theme: typeof projectRaw.theme === 'string' ? projectRaw.theme : '',
      branch,
    },
    crimeConfig: {
      motives: normalizeStringArray(crimeRaw.motives),
      crimeTypes: normalizeStringArray(crimeRaw.crimeTypes),
      clues: normalizeStringArray(crimeRaw.clues),
      methods: normalizeStringArray(crimeRaw.methods),
      location: typeof crimeRaw.location === 'string' ? crimeRaw.location : '',
      characters,
      relations,
      genres: normalizeStringArray(crimeRaw.genres),
      storyFlow,
    },
    keywordLayout,
  }
}

function parseCrimePackFromContent(content: string): CrimePackData | null {
  const blockMatch = content.match(/```xynaps-crime-config\s*([\s\S]*?)```/i)
  if (!blockMatch) return null
  try {
    return normalizeCrimePackData(JSON.parse(blockMatch[1].trim()))
  } catch {
    return null
  }
}

function extractCrimePackFromFiles(files: SkillFile[]): CrimePackData | null {
  for (const file of files) {
    if (!(file.type === 'markdown' || file.type === 'text')) continue
    if (!file.base64) continue
    try {
      const content = decodeBase64Utf8(file.base64)
      const parsed = parseCrimePackFromContent(content)
      if (parsed) return parsed
    } catch {
      continue
    }
  }
  return null
}

function buildCrimePackMarkdown(pack: CrimePackData): string {
  const pretty = JSON.stringify(pack, null, 2)
  return `# XYNAPS 수사 백과사전 패키지

이 파일을 새 프로젝트 > 자료 기반 자동 세팅하기에 업로드하면 현재 설정이 그대로 반영됩니다.

\`\`\`xynaps-crime-config
${pretty}
\`\`\`
`
}

function addFixedKeywordToLibrary(
  prev: FixedCrimeKeywordLibrary,
  group: KeywordGroupKey,
  sectionId: string,
  label: string,
): FixedCrimeKeywordLibrary {
  const normalized = label.trim()
  if (!normalized) return prev
  const currentGroup = prev[group] ?? {}
  const removedEverywhere = Object.fromEntries(
    Object.entries(currentGroup).map(([section, labels]) => [section, labels.filter(v => v !== normalized)]),
  ) as Record<string, string[]>
  const sectionLabels = removedEverywhere[sectionId] ?? []
  return {
    ...prev,
    [group]: {
      ...removedEverywhere,
      [sectionId]: [...new Set([...sectionLabels, normalized])],
    },
  }
}

function removeFixedKeywordFromLibrary(
  prev: FixedCrimeKeywordLibrary,
  group: KeywordGroupKey,
  label: string,
): FixedCrimeKeywordLibrary {
  const normalized = label.trim()
  if (!normalized) return prev
  const currentGroup = prev[group] ?? {}
  const nextGroup: Record<string, string[]> = {}
  for (const [section, labels] of Object.entries(currentGroup)) {
    const filtered = labels.filter(v => v !== normalized)
    if (filtered.length > 0) nextGroup[section] = filtered
  }
  return { ...prev, [group]: nextGroup }
}

function buildSectionIdMap(groups: readonly { group: string; items: readonly string[] }[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const section of groups) {
    for (const item of section.items) {
      if (!map.has(item)) map.set(item, section.group)
    }
  }
  return map
}

function syncKeywordStates(
  selected: string[],
  group: KeywordGroupKey,
  prev: CrimeKeywordState[],
  sectionMap: Map<string, string>,
  presetSet: Set<string>,
  fixedLibrary: Record<string, string[]>,
): CrimeKeywordState[] {
  const fixedByLabel = new Map<string, string>()
  for (const [sectionId, labels] of Object.entries(fixedLibrary)) {
    for (const label of labels) {
      if (!fixedByLabel.has(label)) fixedByLabel.set(label, sectionId)
    }
  }
  const mergedLabels = [...new Set([...fixedByLabel.keys(), ...selected])]
  const prevByLabel = new Map(prev.map(item => [item.label, item]))
  const next: CrimeKeywordState[] = []
  for (const label of mergedLabels) {
    const existing = prevByLabel.get(label)
    const fixedSectionId = fixedByLabel.get(label) ?? null
    if (existing) {
      if (fixedSectionId && (!existing.sectionId || existing.isTemporary)) {
        next.push({ ...existing, sectionId: fixedSectionId, isTemporary: false })
      } else {
        next.push(existing)
      }
      continue
    }
    const isCustom = !presetSet.has(label)
    const fromFixed = Boolean(fixedSectionId)
    next.push({
      id: crypto.randomUUID(),
      label,
      group,
      sectionId: fromFixed ? fixedSectionId : (isCustom ? null : (sectionMap.get(label) ?? null)),
      isCustom,
      isTemporary: fromFixed ? false : isCustom,
    })
  }
  return next
}

const MOTIVE_PRESET_SET = new Set(CRIME_MOTIVES.flatMap(g => [...g.items]))
const CRIME_TYPE_PRESET_SET = new Set(CRIME_TYPES.flatMap(g => [...g.items]))
const CLUE_PRESET_SET = new Set(CRIME_CLUES.flatMap(g => [...g.items]))
const METHOD_PRESET_SET = new Set(CRIME_METHODS.flatMap(g => [...g.items]))
const PRESET_SET_BY_GROUP: Record<KeywordGroupKey, Set<string>> = {
  A: MOTIVE_PRESET_SET,
  B: CRIME_TYPE_PRESET_SET,
  C: CLUE_PRESET_SET,
  D: METHOD_PRESET_SET,
}

const MOTIVE_SECTION_MAP = buildSectionIdMap(CRIME_MOTIVES)
const CRIME_TYPE_SECTION_MAP = buildSectionIdMap(CRIME_TYPES)
const CLUE_SECTION_MAP = buildSectionIdMap(CRIME_CLUES)
const METHOD_SECTION_MAP = buildSectionIdMap(CRIME_METHODS)
const SECTION_MAP_BY_GROUP: Record<KeywordGroupKey, Map<string, string>> = {
  A: MOTIVE_SECTION_MAP,
  B: CRIME_TYPE_SECTION_MAP,
  C: CLUE_SECTION_MAP,
  D: METHOD_SECTION_MAP,
}

function baseFileName(name: string): string {
  return name.replace(/\.[^/.]+$/, '')
}

function looksLikePassMapFile(name: string): boolean {
  const lower = name.toLowerCase()
  return lower.includes('passmap') || name.includes('패스맵')
}

function looksLikeThemePlanFile(name: string): boolean {
  const lower = name.toLowerCase()
  return /theme[\s_-]*plan/.test(lower) || name.includes('테마기획서')
}

function inferBranchCodeFromFiles(files: SkillFile[]): BranchCode | null {
  const regex = /(GDXC|GDXR|NWXC|GNXC|SWXC)/i
  for (const f of files) {
    const m = regex.exec(f.name)
    if (!m) continue
    const code = m[1].toUpperCase() as BranchCode
    if (BRANCH_CODE_SET.has(code)) return code
  }
  return null
}

function inferThemeNameFromFiles(files: SkillFile[]): string {
  const prioritized = files.some(f => looksLikeThemePlanFile(f.name))
    ? files.filter(f => looksLikeThemePlanFile(f.name))
    : files
  const pieces: string[] = []
  for (const f of prioritized) {
    let base = baseFileName(f.name)
    base = base.replace(/^(passmap|flowstep|poster|theme[\s_-]*plan|테마\s*기획서)[_\-\s]*/i, '')
    base = base.replace(/[_\-\s]*(수사\s*종결\s*보고서|수사종결보고서|종결\s*보고서|종결보고서)/ig, '')
    base = base.replace(/[_\-\s]*(GDXC|GDXR|NWXC|GNXC|SWXC)\b/ig, '')
    base = base.replace(/[_\-]+/g, ' ').trim()
    if (!base) continue
    pieces.push(base)
  }
  if (pieces.length === 0) return ''
  const score = new Map<string, number>()
  pieces.forEach(p => score.set(p, (score.get(p) ?? 0) + 1))
  return [...score.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? pieces[0]
}

function extractGoogleDriveFolderId(link: string): string | null {
  const text = link.trim()
  if (!text) return null
  const folderPathMatch = text.match(/\/folders\/([a-zA-Z0-9_-]{10,})/i)
  if (folderPathMatch) return folderPathMatch[1]
  const idQueryMatch = text.match(/[?&]id=([a-zA-Z0-9_-]{10,})/i)
  if (idQueryMatch) return idQueryMatch[1]
  if (/^[a-zA-Z0-9_-]{10,}$/.test(text)) return text
  return null
}

function mapDriveMimeTypeToSkillType(mimeType: string): SkillFile['type'] {
  if (mimeType === 'application/pdf') return 'pdf'
  if (mimeType.startsWith('image/')) return 'image'
  if (mimeType === 'text/markdown') return 'markdown'
  return 'text'
}

function mapDriveMetaToSkillFile(entry: { id: string; name: string; mimeType: string; modifiedTime?: string; webViewLink?: string; path: string }): SkillFile {
  const safeUrl = entry.webViewLink || `https://drive.google.com/file/d/${entry.id}/view`
  return {
    id: entry.id,
    name: entry.name,
    type: mapDriveMimeTypeToSkillType(entry.mimeType),
    url: safeUrl,
    relativePath: entry.path,
    mediaType: entry.mimeType,
    uploadedAt: entry.modifiedTime || new Date().toISOString(),
  }
}

function hasAiReadableContent(files: SkillFile[]): boolean {
  return files.some(f => Boolean(f.base64))
}

function splitThemeBundleFiles(files: SkillFile[]): { floorPlans: SkillFile[]; attachments: SkillFile[] } {
  const floorPlanCandidates = files.filter(f => looksLikePassMapFile(f.name))
  const otherFiles = files.filter(f => !looksLikePassMapFile(f.name))
  const normalizedFloorPlans = floorPlanCandidates.length > 0 ? floorPlanCandidates : files.filter(f => f.type === 'image')
  const normalizedAttachments = otherFiles.length > 0 ? otherFiles : files
  return { floorPlans: normalizedFloorPlans, attachments: normalizedAttachments }
}

function sortFilesForAutoFill(files: SkillFile[]): SkillFile[] {
  return [...files].sort((a, b) => {
    const score = (name: string) => {
      if (looksLikeThemePlanFile(name)) return 0
      if (looksLikePassMapFile(name)) return 1
      return 2
    }
    const sa = score(a.name)
    const sb = score(b.name)
    if (sa !== sb) return sa - sb
    return a.name.localeCompare(b.name, 'ko')
  })
}

// ── 칩 그룹 ───────────────────────────────────────────────
function ChipGroup({
  items, selected, onChange, accent = 'var(--accent)',
}: {
  items: readonly string[]
  selected: string[]
  onChange: (next: string[]) => void
  accent?: string
}) {
  const activeTextColor = accent === 'var(--accent)' ? '#111111' : 'white'
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 10 }}>
      {items.map(item => {
        const active = selected.includes(item)
        return (
          <button key={item} onClick={() => onChange(active ? selected.filter(v => v !== item) : [...selected, item])} style={{
            padding: '5px 12px', borderRadius: 16, fontSize: 12, cursor: 'pointer',
            border: `1px solid ${active ? accent : 'var(--border)'}`,
            background: active ? accent : 'transparent',
            color: active ? activeTextColor : 'var(--text-secondary)',
            fontWeight: active ? 600 : 400, transition: 'all 0.12s',
          }}>{item}</button>
        )
      })}
    </div>
  )
}

// ── 접기/펼치기 그룹 ──────────────────────────────────────
function CollapsibleGroup({
  group, items, selected, onChange, accent,
  allowCustom, allPresetItems, groupKey, keywordStates, draggingKeyword, dragOverTarget,
  onDragKeywordStart, onDragKeywordEnd, onDragOverTarget, onDropToTarget, hiddenPresetLabels,
}: {
  group: string
  items: readonly string[]
  selected: string[]
  onChange: (next: string[]) => void
  accent?: string
  allowCustom?: boolean
  allPresetItems?: readonly string[]
  groupKey: KeywordGroupKey
  keywordStates: CrimeKeywordState[]
  draggingKeyword: CrimeKeywordState | null
  dragOverTarget: KeywordDropTarget | null
  onDragKeywordStart: (keyword: CrimeKeywordState) => void
  onDragKeywordEnd: () => void
  onDragOverTarget: (target: KeywordDropTarget | null) => void
  onDropToTarget: (target: KeywordDropTarget) => void
  hiddenPresetLabels: Set<string>
}) {
  const [open, setOpen] = useState(false)
  const hiddenLabels = new Set(
    keywordStates
      .filter(k => k.isTemporary && selected.includes(k.label))
      .map(k => k.label),
  )
  const fixedInSectionAll = keywordStates.filter(k =>
    !k.isTemporary
    && k.sectionId === group
    && (group !== '기타' || selected.includes(k.label)),
  )
  const fixedInSection = fixedInSectionAll.filter(k => selected.includes(k.label))
  const fixedLabels = fixedInSectionAll.map(k => k.label)
  const displayItems = [
    ...items.filter(item => !hiddenLabels.has(item) && !hiddenPresetLabels.has(item)),
    ...fixedLabels.filter(label => !items.includes(label)),
  ]
  const temporaryCount = allowCustom ? keywordStates.filter(k => k.isTemporary && selected.includes(k.label)).length : 0
  const activeCount = fixedInSection.length + temporaryCount
  const isSectionDropOver = dragOverTarget?.type === 'section'
    && dragOverTarget.group === groupKey
    && dragOverTarget.sectionId === group
  const sectionBorderColor = isSectionDropOver ? (accent || 'var(--accent)') : 'var(--border)'
  const sectionBorderWidth = isSectionDropOver ? '2px' : '1px'

  function toggleItem(label: string) {
    const active = selected.includes(label)
    if (active) {
      onChange(selected.filter(v => v !== label))
      return
    }
    onChange([...selected, label])
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <button onClick={() => setOpen(!open)} style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: open ? 'var(--bg-secondary)' : 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 8, padding: '7px 14px', cursor: 'pointer',
        fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600,
        width: '100%', textAlign: 'left',
      }}>
        <span style={{ flex: 1 }}>{group}</span>
        {activeCount > 0 && (
          <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 10, background: accent || 'var(--accent)', color: (accent || 'var(--accent)') === 'var(--accent)' ? '#111111' : 'white' }}>{activeCount}</span>
        )}
        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div
          onDragOver={e => {
            e.preventDefault()
            if (!draggingKeyword || draggingKeyword.group !== groupKey) return
            onDragOverTarget({ type: 'section', group: groupKey, sectionId: group })
          }}
          onDragLeave={() => {
            if (isSectionDropOver) onDragOverTarget(null)
          }}
          onDrop={e => {
            e.preventDefault()
            onDropToTarget({ type: 'section', group: groupKey, sectionId: group })
          }}
          style={{ border: `${sectionBorderWidth} solid ${sectionBorderColor}`, borderTop: 'none', borderRadius: '0 0 8px 8px', padding: '12px 14px', background: 'var(--bg-secondary)', transition: 'border-color 0.12s' }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, paddingTop: 10 }}>
            {displayItems.map(item => {
              const keyword = keywordStates.find(k => k.label === item)
              const active = selected.includes(item)
              const canDrag = Boolean(active && (!keyword || (!keyword.isTemporary && keyword.sectionId === group)))
              const activeTextColor = (accent || 'var(--accent)') === 'var(--accent)' ? '#111111' : 'white'
              return (
                <button
                  key={item}
                  draggable={canDrag}
                  onDragStart={e => {
                    if (!canDrag) return
                    e.dataTransfer.effectAllowed = 'move'
                    onDragKeywordStart(keyword ?? {
                      id: `fallback-${groupKey}-${group}-${item}`,
                      label: item,
                      group: groupKey,
                      sectionId: group,
                      isCustom: false,
                      isTemporary: false,
                    })
                  }}
                  onDragEnd={onDragKeywordEnd}
                  onClick={() => toggleItem(item)}
                  style={{
                    padding: '5px 12px',
                    borderRadius: 16,
                    fontSize: 12,
                    cursor: 'pointer',
                    border: `1px solid ${active ? (accent || 'var(--accent)') : 'var(--border)'}`,
                    background: active ? (accent || 'var(--accent)') : 'transparent',
                    color: active ? activeTextColor : 'var(--text-secondary)',
                    fontWeight: active ? 600 : 400,
                    transition: 'all 0.12s',
                    opacity: draggingKeyword?.id === keyword?.id ? 0.5 : 1,
                  }}
                >
                  {item}
                </button>
              )
            })}
          </div>
          {allowCustom && allPresetItems && (
            <CustomInput
              selected={selected}
              presetItems={allPresetItems}
              onChange={onChange}
              accent={accent || 'var(--accent)'}
              groupKey={groupKey}
              keywordStates={keywordStates}
              draggingKeyword={draggingKeyword}
              dragOverTarget={dragOverTarget}
              onDragKeywordStart={onDragKeywordStart}
              onDragKeywordEnd={onDragKeywordEnd}
              onDragOverTarget={onDragOverTarget}
              onDropToTarget={onDropToTarget}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── 기타 직접 입력 ────────────────────────────────────────
function CustomInput({
  selected, presetItems, onChange, accent,
  groupKey, keywordStates, draggingKeyword, dragOverTarget,
  onDragKeywordStart, onDragKeywordEnd, onDragOverTarget, onDropToTarget,
}: {
  selected: string[]
  presetItems: readonly string[]
  onChange: (next: string[]) => void
  accent: string
  groupKey?: KeywordGroupKey
  keywordStates?: CrimeKeywordState[]
  draggingKeyword?: CrimeKeywordState | null
  dragOverTarget?: KeywordDropTarget | null
  onDragKeywordStart?: (keyword: CrimeKeywordState) => void
  onDragKeywordEnd?: () => void
  onDragOverTarget?: (target: KeywordDropTarget | null) => void
  onDropToTarget?: (target: KeywordDropTarget) => void
}) {
  const [open, setOpen] = useState(false)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const customItems = keywordStates
    ? keywordStates.filter(k => k.isTemporary && selected.includes(k.label))
    : selected
      .filter(s => !presetItems.includes(s))
      .map(label => ({ id: label, label, group: groupKey ?? 'A', sectionId: null, isCustom: true, isTemporary: true } as CrimeKeywordState))
  const accentTextColor = accent === 'var(--accent)' ? '#111111' : 'white'
  const dndEnabled = Boolean(groupKey && keywordStates && onDragKeywordStart && onDragKeywordEnd && onDragOverTarget && onDropToTarget)
  const isCustomDropOver = Boolean(dndEnabled && groupKey && dragOverTarget?.type === 'custom' && dragOverTarget.group === groupKey)

  useEffect(() => {
    if (!open) return
    const onPointerDown = (e: PointerEvent) => {
      const container = wrapRef.current
      const target = e.target as Node | null
      if (!container || !target) return
      if (container.contains(target)) return
      setOpen(false)
      setValue('')
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  function add() {
    const val = value.trim()
    if (!val) return
    if (!selected.includes(val)) onChange([...selected, val])
    setValue('')
    inputRef.current?.focus()
  }

  return (
    <div
      ref={wrapRef}
      style={{
        marginTop: 10,
        border: isCustomDropOver ? `2px dashed ${accent}` : '1px dashed transparent',
        borderRadius: 10,
        padding: isCustomDropOver ? '7px 8px' : '8px 9px',
        transition: 'all 0.12s',
      }}
      onDragOver={e => {
        if (!dndEnabled || !groupKey || !onDragOverTarget) return
        e.preventDefault()
        if (!draggingKeyword || draggingKeyword.group !== groupKey) return
        onDragOverTarget({ type: 'custom', group: groupKey })
      }}
      onDrop={e => {
        if (!dndEnabled || !groupKey || !onDropToTarget) return
        e.preventDefault()
        onDropToTarget({ type: 'custom', group: groupKey })
      }}
      onDragLeave={() => {
        if (!dndEnabled || !onDragOverTarget) return
        if (isCustomDropOver) onDragOverTarget(null)
      }}
    >
      {customItems.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {customItems.map(keyword => (
            <span
              key={keyword.id}
              draggable={dndEnabled}
              onDragStart={e => {
                if (!dndEnabled || !onDragKeywordStart) return
                e.dataTransfer.effectAllowed = 'move'
                onDragKeywordStart(keyword)
              }}
              onDragEnd={() => onDragKeywordEnd?.()}
              onClick={() => onChange(selected.filter(s => s !== keyword.label))}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '4px 10px',
                borderRadius: 16,
                fontSize: 12,
                background: accent,
                color: accentTextColor,
                fontWeight: 600,
                opacity: draggingKeyword?.id === keyword.id ? 0.5 : 1,
                cursor: dndEnabled ? 'grab' : 'default',
              }}
            >
              {keyword.label}
              <button
                onClick={e => {
                  e.stopPropagation()
                  onChange(selected.filter(s => s !== keyword.label))
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: accentTextColor, fontSize: 13, padding: '0 2px', lineHeight: 1, opacity: 0.8 }}
              >×</button>
            </span>
          ))}
        </div>
      )}
	      {!open ? (
	        <button
            type="button"
            title="직접 입력"
            aria-label="직접 입력"
            onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 50) }}
            style={{
	          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
	          width: 28, height: 28, borderRadius: '50%', fontSize: 16, cursor: 'pointer',
	          border: `1px solid ${accent}`, background: 'transparent', color: accent, fontWeight: 700,
	        }}
          >+</button>
	      ) : (
	        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
	          <input ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
	            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); add() } }}
	            placeholder="직접 입력 후 Enter"
	            style={{ flex: 1, background: 'var(--bg-card)', border: `1px solid ${accent}`, borderRadius: 8, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
	          <button onClick={add} style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: accent, color: accentTextColor, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>추가</button>
	        </div>
	      )}
	    </div>
  )
}

// ── 파일 업로드 ───────────────────────────────────────────
function FileUploader({ files, onChange, label = '참고 파일 첨부', hint = '(선택 · PDF, JPG, PNG, MD)', accept = '.pdf,.jpg,.jpeg,.png,.md,.txt', multiple = true, allowDirectory = false, disabled = false, compact = false }: {
  files: SkillFile[]
  onChange: (files: SkillFile[]) => void
  label?: string
  hint?: string
  accept?: string
  multiple?: boolean
  allowDirectory?: boolean
  disabled?: boolean
  compact?: boolean
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const dirInputRef = useRef<HTMLInputElement>(null)
  const [loading, setLoading] = useState(false)
  const [dragging, setDragging] = useState(false)

  async function handleFiles(fileList: FileList) {
    setLoading(true)
    const newFiles: SkillFile[] = []
    for (const file of Array.from(fileList)) {
      const ext = file.name.split('.').pop()?.toLowerCase()
      const isPdf = file.type === 'application/pdf' || ext === 'pdf'
      const isImage = file.type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'webp'].includes(ext || '')
      const isMarkdown = file.type === 'text/markdown' || ext === 'md'
      const isText = file.type === 'text/plain' || ext === 'txt'
      const isWord = file.type === 'application/msword'
        || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        || ext === 'doc'
        || ext === 'docx'
      if (!(isPdf || isImage || isMarkdown || isText || isWord)) continue
      const base64 = await new Promise<string>((res, rej) => {
        const reader = new FileReader()
        reader.onload = e => res((e.target?.result as string).split(',')[1])
        reader.onerror = rej
        reader.readAsDataURL(file)
      })
      const type: SkillFile['type'] = isImage ? 'image' : isPdf ? 'pdf' : isMarkdown ? 'markdown' : 'text'
      const mediaType = file.type
        || (isWord ? (ext === 'docx' ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' : 'application/msword')
          : isMarkdown ? 'text/markdown'
            : isText ? 'text/plain'
              : isPdf ? 'application/pdf'
                : 'application/octet-stream')
      newFiles.push({
        id: crypto.randomUUID(),
        name: file.name,
        type,
        url: URL.createObjectURL(file),
        relativePath: (file as File & { webkitRelativePath?: string }).webkitRelativePath || undefined,
        base64,
        mediaType,
        uploadedAt: new Date().toISOString(),
      })
    }
    onChange(multiple ? [...files, ...newFiles] : newFiles.slice(0, 1))
    setLoading(false)
  }

  return (
    <div>
      {compact ? (
        <>
          {label && <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 8 }}>{label} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{hint}</span></div>}
          <div
            onClick={() => { if (!disabled) inputRef.current?.click() }}
            onDragOver={e => { if (disabled) return; e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { if (disabled) return; e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              minHeight: 44,
              padding: '10px 12px',
              borderRadius: 12,
              border: `1px dashed ${dragging && !disabled ? 'var(--accent)' : 'var(--border)'}`,
              background: 'var(--bg-secondary)',
              cursor: disabled ? 'default' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              transition: 'all 0.15s',
            }}
          >
            <div style={{ width: 26, height: 26, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexShrink: 0 }}>
              <PaperclipIcon width={14} height={14} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--accent)' }}>
                  <Spinner size={14} color="var(--accent)" />
                  <span style={{ fontSize: 12 }}>업로드 중...</span>
                </div>
              ) : files.length > 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {files[0].name}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {disabled ? '일반 자료 업로드 사용 중' : 'crime-pack.md 드래그 또는 클릭 업로드'}
                </div>
              )}
            </div>
            {files.length > 0 && (
              <button
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  onChange([])
                }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: '0 2px', flexShrink: 0 }}
              >
                ×
              </button>
            )}
          </div>
          <input ref={inputRef} type="file" multiple={multiple} accept={accept} style={{ display: 'none' }} onChange={e => e.target.files && handleFiles(e.target.files)} disabled={disabled} />
        </>
      ) : (
        <>
      {label && <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>{label} <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 400 }}>{hint}</span></div>}
      {allowDirectory && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>로컬 자료 업로드</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                if (disabled) return
                inputRef.current?.click()
              }}
              style={{
                height: 30,
                padding: '0 11px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.45 : 1,
              }}
              disabled={disabled}
            >
              파일 선택
            </button>
            <button
              type="button"
              onClick={e => {
                e.stopPropagation()
                if (disabled) return
                dirInputRef.current?.click()
              }}
              style={{
                height: 30,
                padding: '0 11px',
                borderRadius: 8,
                border: '1px solid var(--border)',
                background: 'var(--bg-card)',
                color: 'var(--text-secondary)',
                fontSize: 12,
                fontWeight: 600,
                cursor: disabled ? 'default' : 'pointer',
                opacity: disabled ? 0.45 : 1,
              }}
              disabled={disabled}
            >
              폴더 선택
            </button>
          </div>
        </div>
      )}
      <div onDragOver={e => { if (disabled) return; e.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)}
        onDrop={e => { if (disabled) return; e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }}
        onClick={() => { if (!disabled) inputRef.current?.click() }}
        style={{ border: `2px dashed ${dragging && !disabled ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 12, padding: '16px', textAlign: 'center', cursor: disabled ? 'default' : 'pointer', background: dragging && !disabled ? 'var(--accent-dim)' : 'transparent', transition: 'all 0.15s', opacity: disabled ? 0.55 : 1 }}>
        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--accent)' }}>
            <Spinner size={16} color="var(--accent)" />
            <span style={{ fontSize: 13 }}>업로드 중...</span>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 6, color: 'var(--text-muted)', display: 'flex', justifyContent: 'center' }}><PaperclipIcon width={20} height={20} /></div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              {disabled ? '복원용 MD가 선택되어 비활성화됨' : allowDirectory ? '파일/폴더를 여기로 드래그' : '클릭 또는 드래그'}
            </div>
          </>
        )}
        <input ref={inputRef} type="file" multiple={multiple} accept={accept} style={{ display: 'none' }} onChange={e => e.target.files && handleFiles(e.target.files)} disabled={disabled} />
        <input
          ref={dirInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={e => e.target.files && handleFiles(e.target.files)}
          disabled={disabled}
          {...(allowDirectory ? ({ webkitdirectory: '', directory: '' } as Record<string, string>) : {})}
        />
      </div>
      {files.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {files.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px' }}>
              {f.type === 'image'
                ? <img src={f.url} alt={f.name} style={{ width: 32, height: 32, objectFit: 'cover', borderRadius: 4 }} />
                : <div style={{ width: 32, height: 32, borderRadius: 4, background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.04em' }}>{f.type === 'pdf' ? 'PDF' : 'TXT'}</div>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {f.type}{f.relativePath ? ` · ${f.relativePath}` : ''}
                </div>
              </div>
              <button onClick={() => onChange(files.filter(x => x.id !== f.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: '0 2px' }}>×</button>
            </div>
          ))}
        </div>
      )}
        </>
      )}
    </div>
  )
}

// ── 메인 페이지 ───────────────────────────────────────────
export function NewProjectPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams] = useSearchParams()
  const editProjectId = searchParams.get('editProjectId')
  const editingProject = useMemo(() => {
    if (!editProjectId) return null
    return getProjects().find(p => p.id === editProjectId) ?? null
  }, [editProjectId])
  const isEditMode = Boolean(editingProject)
  const [step, setStep] = useState(isEditMode ? 1 : 0)
  const hasDriveApiKey = Boolean(import.meta.env.VITE_GOOGLE_DRIVE_API_KEY)

  // Step 1
  const [name, setName] = useState(editingProject?.name ?? '')
  const [theme, setTheme] = useState(editingProject?.theme ?? '')
  const [branches, setBranches] = useState<BranchCode[]>(editingProject?.branches ?? [])
  const [gameSystemTypes, setGameSystemTypes] = useState<GameSystemType[]>(editingProject?.gameSystemTypes ?? ['escape'])

  // Step 2 — 수사 백과사전
  const [motives, setMotives] = useState<string[]>(editingProject?.crimeConfig?.motives ?? [])
  const [crimeTypes, setCrimeTypes] = useState<string[]>(editingProject?.crimeConfig?.crimeTypes ?? [])
  const [clues, setClues] = useState<string[]>(editingProject?.crimeConfig?.clues ?? [])
  const [methods, setMethods] = useState<string[]>(editingProject?.crimeConfig?.methods ?? [])
  const [genres, setGenres] = useState<string[]>(editingProject?.crimeConfig?.genres ?? [])
  const [location, setLocation] = useState(editingProject?.crimeConfig?.location ?? '')
  const [characters, setCharacters] = useState<Character[]>(editingProject?.crimeConfig?.characters ?? [])
  const [relations, setRelations] = useState<CharacterRelation[]>(editingProject?.crimeConfig?.relations ?? [])
  const [storyFlow, setStoryFlow] = useState<StoryStage[]>(() => {
    const existing = editingProject?.crimeConfig?.storyFlow
    if (existing && existing.length > 0) {
      return STORY_STAGES.map(stage => {
        const match = existing.find(s => s.stage === stage)
        return match ?? { stage: stage as StoryStageKey, description: '', roomName: '' }
      })
    }
    return STORY_STAGES.map(stage => ({ stage: stage as StoryStageKey, description: '', roomName: '' }))
  })
  const [floorPlans, setFloorPlans] = useState<SkillFile[]>([])
  const [attachments, setAttachments] = useState<SkillFile[]>(editingProject?.attachments ?? [])
  const [crimePackFiles, setCrimePackFiles] = useState<SkillFile[]>([])
  const [themeBundleFiles, setThemeBundleFiles] = useState<SkillFile[]>([])
  const [driveFolderLink, setDriveFolderLink] = useState(editingProject?.sourceDriveLink ?? '')
  const [driveFolderId, setDriveFolderId] = useState<string | null>(editingProject?.sourceDriveFolderId ?? null)
  const [driveLinkError, setDriveLinkError] = useState<string | null>(null)
  const [driveSyncing, setDriveSyncing] = useState(false)
  const [driveSyncSummary, setDriveSyncSummary] = useState<string | null>(null)
  const [_autoFilling, setAutoFilling] = useState(false)
  const [autoFillError, setAutoFillError] = useState<string | null>(null)
  const [autoFillSummary, setAutoFillSummary] = useState<string | null>(null)
  const [autoFillPhase, setAutoFillPhase] = useState<AutoFillPhase>('idle')
  const [showImportGuide, setShowImportGuide] = useState(false)
  const [fixedKeywordLibrary, setFixedKeywordLibrary] = useState<FixedCrimeKeywordLibrary>(() => loadFixedKeywordLibrary())
  const [hiddenPresetLibrary, setHiddenPresetLibrary] = useState<HiddenPresetKeywordLibrary>(() => loadHiddenPresetLibrary())
  const [keywordStates, setKeywordStates] = useState<Record<KeywordGroupKey, CrimeKeywordState[]>>({
    A: [],
    B: [],
    C: [],
    D: [],
  })
  const [draggingKeyword, setDraggingKeyword] = useState<CrimeKeywordState | null>(null)
  const [dragOverTarget, setDragOverTarget] = useState<KeywordDropTarget | null>(null)
  const [combinationSaving, setCombinationSaving] = useState(false)
  const [previewSummary, setPreviewSummary] = useState<string | null>(editingProject?.crimeConfig?.combinationSummary ?? null)

  // 관계 추가 폼 상태
  const [showRelationForm, setShowRelationForm] = useState(false)
  const [editingRelationId, setEditingRelationId] = useState<string | null>(null)
  const [relFrom, setRelFrom] = useState('')
  const [relType, setRelType] = useState<RelationType>('원한')
  const [relCustomType, setRelCustomType] = useState('')
  const [relTo, setRelTo] = useState('')
  const [relDesc, setRelDesc] = useState('')

  const autoFillBusy = autoFillPhase !== 'idle'
  const hasCrimePackUpload = Boolean(extractCrimePackFromFiles(crimePackFiles))
  const canNext = step === 0 ? name.trim() !== '' && theme.trim() !== '' && !autoFillBusy : true

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.035)', border: '1px solid var(--border-bright)',
    borderRadius: 12, padding: '12px 14px', color: 'var(--text-primary)',
    fontSize: 15, fontFamily: 'inherit', outline: 'none', width: '100%', boxSizing: 'border-box',
    lineHeight: 1.45,
  }
  const smallInput: React.CSSProperties = { ...inputStyle, fontSize: 14, padding: '9px 12px' }
  const selectWrapStyle: React.CSSProperties = {
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
  }
  const selectChevronStyle: React.CSSProperties = {
    position: 'absolute',
    right: 10,
    fontSize: 10,
    color: 'var(--text-muted)',
    pointerEvents: 'none',
    lineHeight: 1,
  }
  const appleSelectBaseStyle: React.CSSProperties = {
    appearance: 'none',
    WebkitAppearance: 'none',
    MozAppearance: 'none',
    background: 'rgba(255,255,255,0.035)',
    border: '1px solid var(--border-bright)',
    borderRadius: 10,
    color: 'var(--text-primary)',
    fontSize: 13,
    fontWeight: 700,
    lineHeight: 1.2,
    padding: '7px 28px 7px 11px',
    fontFamily: 'inherit',
    cursor: 'pointer',
    backdropFilter: 'blur(8px)',
    boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.02)',
    transition: 'border-color 0.15s, background 0.15s',
  }
  const autoFillSteps: { key: Exclude<AutoFillPhase, 'idle' | 'complete'>; label: string; description: string }[] = [
    { key: 'preparing', label: '자료 정리', description: '업로드된 파일과 폴더 구조를 분류하고 있습니다.' },
    { key: 'analyzing', label: '수사 백과사전 생성', description: '문서 내용을 읽어 수사 키워드와 사건 구조를 만드는 중입니다.' },
    { key: 'applying', label: '2페이지 반영', description: '수사 백과사전 입력칸에 결과를 반영하고 마무리 중입니다.' },
  ]
  const autoFillPhaseText = autoFillPhase === 'complete'
    ? '수사 백과사전 반영 완료 · 잠시 후 자동으로 다음 단계로 이동합니다.'
    : autoFillSteps.find(item => item.key === autoFillPhase)?.description ?? null
  const activeAutoFillIndex = autoFillPhase === 'complete'
    ? autoFillSteps.length - 1
    : Math.max(autoFillSteps.findIndex(item => item.key === autoFillPhase), 0)
  const autoFillProgressValue = autoFillPhase === 'complete'
    ? 100
    : autoFillPhase === 'applying'
      ? 86
      : autoFillPhase === 'analyzing'
        ? 58
        : autoFillPhase === 'preparing'
          ? 24
          : 0
  function addCharacter() {
    setCharacters(prev => [...prev, { id: crypto.randomUUID(), role: '피해자', name: '', background: '' }])
  }

  function updateCharacter(id: string, patch: Partial<Character>) {
    setCharacters(prev => prev.map(c => c.id === id ? { ...c, ...patch } : c))
  }

  function removeCharacter(id: string) {
    setCharacters(prev => prev.filter(c => c.id !== id))
    setRelations(prev => prev.filter(r => r.fromId !== id && r.toId !== id))
  }

  function resetRelationForm() {
    setEditingRelationId(null)
    setRelFrom('')
    setRelType('원한')
    setRelCustomType('')
    setRelTo('')
    setRelDesc('')
    setShowRelationForm(false)
  }

  function openCreateRelationForm() {
    setEditingRelationId(null)
    setRelFrom('')
    setRelType('원한')
    setRelCustomType('')
    setRelTo('')
    setRelDesc('')
    setShowRelationForm(true)
  }

  function openEditRelationForm(relationId: string) {
    const relation = relations.find(item => item.id === relationId)
    if (!relation) return
    const isPresetRelationType = RELATION_TYPES.includes(relation.relationType as RelationType)
    setEditingRelationId(relation.id)
    setRelFrom(relation.fromId)
    setRelType(isPresetRelationType ? relation.relationType as RelationType : '기타')
    setRelCustomType(isPresetRelationType ? '' : relation.relationType)
    setRelTo(relation.toId)
    setRelDesc(relation.description)
    setShowRelationForm(true)
  }

  function submitRelation() {
    const resolvedRelationType = relType === '기타'
      ? (relCustomType.trim() || '기타')
      : relType
    if (!relFrom || !relTo || relFrom === relTo) return
    if (editingRelationId) {
      setRelations(prev => prev.map(item => item.id === editingRelationId
        ? { ...item, fromId: relFrom, relationType: resolvedRelationType, toId: relTo, description: relDesc.trim() }
        : item))
      resetRelationForm()
      return
    }
    setRelations(prev => [...prev, { id: crypto.randomUUID(), fromId: relFrom, relationType: resolvedRelationType, toId: relTo, description: relDesc.trim() }])
    resetRelationForm()
  }

  function updateStoryFlow(idx: number, patch: Partial<StoryStage>) {
    setStoryFlow(prev => prev.map((s, i) => i === idx ? { ...s, ...patch } : s))
  }

  function charLabel(id: string) {
    const c = characters.find(x => x.id === id)
    if (!c) return '?'
    if (c.name) return c.name
    const sameRole = characters.filter(x => x.role === c.role)
    if (sameRole.length <= 1) return c.role
    const idx = sameRole.findIndex(x => x.id === id)
    return `${c.role} ${String.fromCharCode(65 + idx)}`
  }

  function buildPreviewSentence() {
    const perp = characters.find(c => c.role === '가해자')
    const vic = characters.find(c => c.role === '피해자')
    const perpName = perp?.name || perp?.role
    const vicName = vic?.name || vic?.role
    const parts = [
      perpName && `${perpName}가`,
      motives.length && `'${motives[0]}' 동기로`,
      vicName && `${vicName}를`,
      crimeTypes.length && `${crimeTypes[0]} 사건 발생.`,
      location && `${location}에서`,
      clues.length && `${clues[0]}를 찾아내`,
      methods.length && `${methods[0]} 방식으로 수사.`,
    ].filter(Boolean)
    return parts.length > 0 ? parts.join(' ') : null
  }

  function toggleGameSystem(type: GameSystemType) {
    if (type === 'escape') return // 방탈출은 항상 포함
    setGameSystemTypes(prev =>
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  useEffect(() => {
    const normalized = splitThemeBundleFiles(themeBundleFiles)
    setFloorPlans(normalized.floorPlans)
    setAttachments(normalized.attachments)
  }, [themeBundleFiles])

  useEffect(() => {
    setKeywordStates(prev => ({ ...prev, A: syncKeywordStates(motives, 'A', prev.A, MOTIVE_SECTION_MAP, MOTIVE_PRESET_SET, fixedKeywordLibrary.A) }))
  }, [motives, fixedKeywordLibrary.A])

  useEffect(() => {
    setKeywordStates(prev => ({ ...prev, B: syncKeywordStates(crimeTypes, 'B', prev.B, CRIME_TYPE_SECTION_MAP, CRIME_TYPE_PRESET_SET, fixedKeywordLibrary.B) }))
  }, [crimeTypes, fixedKeywordLibrary.B])

  useEffect(() => {
    setKeywordStates(prev => ({ ...prev, C: syncKeywordStates(clues, 'C', prev.C, CLUE_SECTION_MAP, CLUE_PRESET_SET, fixedKeywordLibrary.C) }))
  }, [clues, fixedKeywordLibrary.C])

  useEffect(() => {
    setKeywordStates(prev => ({ ...prev, D: syncKeywordStates(methods, 'D', prev.D, METHOD_SECTION_MAP, METHOD_PRESET_SET, fixedKeywordLibrary.D) }))
  }, [methods, fixedKeywordLibrary.D])

  function handleKeywordDragStart(keyword: CrimeKeywordState) {
    setDraggingKeyword(keyword)
  }

  function handleKeywordDragEnd() {
    setDraggingKeyword(null)
    setDragOverTarget(null)
  }

  function handleKeywordDrop(target: KeywordDropTarget) {
    if (!draggingKeyword) return
    if (draggingKeyword.group !== target.group) {
      setDragOverTarget(null)
      return
    }
    const list = keywordStates[target.group]
    const source = list.find(k => k.id === draggingKeyword.id)
      ?? list.find(k =>
        k.label === draggingKeyword.label
        && !k.isTemporary
        && k.sectionId === draggingKeyword.sectionId,
      )
    if (!source) {
      setDragOverTarget(null)
      setDraggingKeyword(null)
      return
    }
    let persistAction: { type: 'add'; group: KeywordGroupKey; sectionId: string; label: string } | { type: 'remove'; group: KeywordGroupKey; label: string } | null = null
    let hiddenPresetAction: { type: 'add'; group: KeywordGroupKey; label: string } | { type: 'remove'; group: KeywordGroupKey; label: string } | null = null
    let nextList = list

    if (target.type === 'section') {
      if (source.sectionId === target.sectionId && !source.isTemporary) {
        setDragOverTarget(null)
        setDraggingKeyword(null)
        return
      }
      const exists = list.some(k => k.id !== source.id && k.label === source.label && k.sectionId === target.sectionId && !k.isTemporary)
      if (exists) {
        setDragOverTarget(null)
        setDraggingKeyword(null)
        return
      }
      nextList = list.map(k => k.id === source.id ? { ...k, sectionId: target.sectionId, isTemporary: false } : k)
      if (source.isCustom) persistAction = { type: 'add', group: target.group, sectionId: target.sectionId, label: source.label }
      else if (PRESET_SET_BY_GROUP[target.group].has(source.label)) {
        const originalSectionId = SECTION_MAP_BY_GROUP[target.group].get(source.label)
        if (originalSectionId && target.sectionId !== originalSectionId) {
          hiddenPresetAction = { type: 'add', group: target.group, label: source.label }
        } else {
          hiddenPresetAction = { type: 'remove', group: target.group, label: source.label }
        }
      }
    } else {
      if (source.sectionId === null && source.isTemporary) {
        setDragOverTarget(null)
        setDraggingKeyword(null)
        return
      }
      const existsInCustom = list.some(k => k.id !== source.id && k.label === source.label && k.sectionId === null && k.isTemporary)
      if (existsInCustom) {
        setDragOverTarget(null)
        setDraggingKeyword(null)
        return
      }
      nextList = list.map(k => k.id === source.id ? { ...k, sectionId: null, isTemporary: true } : k)
      if (source.isCustom) persistAction = { type: 'remove', group: target.group, label: source.label }
      else if (PRESET_SET_BY_GROUP[target.group].has(source.label)) hiddenPresetAction = { type: 'add', group: target.group, label: source.label }
    }

    setKeywordStates(prev => ({ ...prev, [target.group]: nextList }))
    if (persistAction) {
      const action = persistAction
      setFixedKeywordLibrary(prevLib => {
        const nextLib = action.type === 'add'
          ? addFixedKeywordToLibrary(prevLib, action.group, action.sectionId, action.label)
          : removeFixedKeywordFromLibrary(prevLib, action.group, action.label)
        saveFixedKeywordLibrary(nextLib)
        return nextLib
      })
    }
    if (hiddenPresetAction) {
      const action = hiddenPresetAction
      setHiddenPresetLibrary(prevLib => {
        const nextLib = action.type === 'add'
          ? addHiddenPresetKeyword(prevLib, action.group, action.label)
          : removeHiddenPresetKeyword(prevLib, action.group, action.label)
        saveHiddenPresetLibrary(nextLib)
        return nextLib
      })
    }
    setDragOverTarget(null)
    setDraggingKeyword(null)
  }

  async function handleStart() {
    const normalized = splitThemeBundleFiles(themeBundleFiles)
    const finalFloorPlans = floorPlans.length > 0 ? floorPlans : normalized.floorPlans
    const finalAttachments = attachments.length > 0 ? attachments : normalized.attachments
    const crimeConfig: CrimeConfig = {
      motives, crimeTypes, clues, methods, location,
      genres: normalizeGenres(genres), characters, relations, storyFlow,
    }
    if (editingProject) {
      if (previewSummary) {
        // 이미 재생성 버튼으로 생성된 결과가 있으면 그대로 사용
        crimeConfig.combinationSummary = previewSummary
      } else {
        // 재생성하지 않은 경우 저장 시 한 번 생성
        setCombinationSaving(true)
        try {
          const summary = await generateCombinationSummary(crimeConfig)
          crimeConfig.combinationSummary = summary
          setPreviewSummary(summary)
        } catch {
          crimeConfig.combinationSummary = editingProject.crimeConfig?.combinationSummary
        } finally {
          setCombinationSaving(false)
        }
      }
      const updated = {
        ...editingProject,
        name: name.trim(),
        theme: theme.trim(),
        branches,
        gameSystemTypes,
        crimeConfig,
        attachments: [...finalFloorPlans, ...finalAttachments],
        sourceDriveLink: driveFolderLink.trim() || undefined,
        sourceDriveFolderId: driveFolderId || undefined,
        updatedAt: new Date().toISOString(),
      }
      saveProject(updated)
      navigate(`/project/${editingProject.id}`)
      return
    }
    const project = createProject(
      name.trim(),
      theme.trim(),
      branches,
      crimeConfig,
      [...finalFloorPlans, ...finalAttachments],
      gameSystemTypes,
      driveFolderLink.trim() || undefined,
      driveFolderId || undefined,
      user?.id,
      user?.displayName,
    )
    createDraftVersion(project.id)
    navigate(`/project/${project.id}`)
  }

  function handleCrimePackFilesChange(nextFiles: SkillFile[]) {
    const next = nextFiles.slice(0, 1)
    setCrimePackFiles(next)
    if (extractCrimePackFromFiles(next)) {
      setThemeBundleFiles([])
      setDriveFolderLink('')
      setDriveFolderId(null)
      setDriveLinkError(null)
      setDriveSyncSummary(null)
    }
  }

  function buildCurrentCrimePack(): CrimePackData {
    return {
      format: 'xynaps-crime-pack',
      version: 1,
      project: {
        name: name.trim(),
        theme: theme.trim(),
        branch: branches[0] ?? null,
      },
      crimeConfig: {
        motives,
        crimeTypes,
        clues,
        methods,
        location,
        characters,
        relations,
        genres: normalizeGenres(genres),
        storyFlow,
      },
      keywordLayout: {
        fixedCustomKeywords: fixedKeywordLibrary,
        hiddenPresetKeywords: hiddenPresetLibrary,
      },
    }
  }

  function downloadCrimePackTemplate() {
    const pack = buildCurrentCrimePack()
    const md = buildCrimePackMarkdown(pack)
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const safeName = (name.trim() || 'xynaps-crime-pack').replace(/[\\/:*?"<>|]+/g, '_')
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${safeName}_crime-pack.md`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    URL.revokeObjectURL(url)
  }

  async function autoFillFromFiles(
    allFiles: SkillFile[],
    themeText: string,
    onPhaseChange?: (phase: AutoFillPhase) => void,
  ) {
    if (allFiles.length === 0) {
      setAutoFillError('먼저 도면/운영 파일을 1개 이상 업로드해주세요.')
      return false
    }
    setAutoFilling(true)
    setAutoFillError(null)
    setAutoFillSummary(null)
    try {
      onPhaseChange?.('preparing')
      const sortedFiles = sortFilesForAutoFill(allFiles)
      const pack = extractCrimePackFromFiles(sortedFiles)
      if (pack) {
        onPhaseChange?.('applying')
        if (pack.project.name) setName(pack.project.name)
        if (pack.project.theme) setTheme(pack.project.theme)
        if (pack.project.branch) setBranches([pack.project.branch])
        setGenres(normalizeGenres(pack.crimeConfig.genres))
        setMotives(pack.crimeConfig.motives)
        setCrimeTypes(pack.crimeConfig.crimeTypes)
        setClues(pack.crimeConfig.clues)
        setMethods(pack.crimeConfig.methods)
        setLocation(pack.crimeConfig.location)
        setCharacters(pack.crimeConfig.characters)
        setRelations(pack.crimeConfig.relations)
        setStoryFlow(pack.crimeConfig.storyFlow)
        if (pack.keywordLayout) {
          setFixedKeywordLibrary(pack.keywordLayout.fixedCustomKeywords)
          saveFixedKeywordLibrary(pack.keywordLayout.fixedCustomKeywords)
          setHiddenPresetLibrary(pack.keywordLayout.hiddenPresetKeywords)
          saveHiddenPresetLibrary(pack.keywordLayout.hiddenPresetKeywords)
        }
        setAutoFillSummary('MD 패키지 반영 완료 · 최종확인에서 내보낸 설정을 그대로 적용했습니다.')
        return true
      }
      if (!themeText.trim()) {
        setAutoFillError('테마 한 줄 설명을 먼저 입력해주세요.')
        return false
      }
      onPhaseChange?.('analyzing')
      const currentCrimeConfig: CrimeConfig = {
        motives,
        crimeTypes,
        clues,
        methods,
        location,
        genres,
        characters,
        relations,
        storyFlow,
      }
      const generated = await generateDraftCrimeConfigFromFiles(
        themeText.trim(),
        currentCrimeConfig,
        sortedFiles,
      )
      onPhaseChange?.('applying')
      setMotives(generated.motives ?? [])
      setCrimeTypes(generated.crimeTypes ?? [])
      setClues(generated.clues ?? [])
      setMethods(generated.methods ?? [])
      setLocation(generated.location ?? '')
      setGenres(normalizeGenres(generated.genres ?? []))
      setCharacters(generated.characters ?? [])
      setRelations(generated.relations ?? [])
      setStoryFlow((generated.storyFlow?.length ? generated.storyFlow : STORY_STAGES.map(stage => ({ stage: stage as StoryStageKey, description: '', roomName: '' }))) as StoryStage[])

      const counts = [
        `동기 ${generated.motives?.length ?? 0}`,
        `범행 ${generated.crimeTypes?.length ?? 0}`,
        `단서 ${generated.clues?.length ?? 0}`,
        `기법 ${generated.methods?.length ?? 0}`,
        `인물 ${generated.characters?.length ?? 0}`,
      ]
      setAutoFillSummary(`자동 반영 완료 · ${counts.join(' · ')}`)
      return true
    } catch (e) {
      setAutoFillError(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      setAutoFilling(false)
    }
  }

  function connectDriveFolderLink() {
    const id = extractGoogleDriveFolderId(driveFolderLink)
    if (!id) {
      setDriveFolderId(null)
      setDriveLinkError('유효한 구글드라이브 폴더 링크(또는 folderId)를 입력해주세요.')
      setDriveSyncSummary(null)
      return
    }
    setDriveFolderId(id)
    setDriveLinkError(null)
    setDriveSyncSummary('링크 연결 완료 · 목록 반영을 누르면 파일명/폴더 구조를 메타데이터로 가져옵니다.')
  }

  async function syncThemeBundleFromDriveFolder() {
    if (!driveFolderId) {
      setDriveLinkError('먼저 폴더 링크를 연결해주세요.')
      return
    }
    if (!hasDriveApiKey) {
      // API 키 미설정은 오류로 노출하지 않고, 하단 안내 문구만 표시한다.
      return
    }
    setDriveSyncing(true)
    setDriveLinkError(null)
    try {
      const driveEntries = await listGoogleDriveFolderMetadata(driveFolderId)
      const fileEntries = driveEntries
        .filter(entry => !entry.isFolder)
        .filter(entry => entry.name !== '.DS_Store')
      const mapped = fileEntries.map(mapDriveMetaToSkillFile)

      if (mapped.length === 0) {
        setThemeBundleFiles([])
        setDriveSyncSummary('폴더를 읽었지만 파일이 없습니다. (폴더만 있거나 접근 권한 제한일 수 있습니다)')
        return
      }

      setThemeBundleFiles(mapped)
      const folderCount = driveEntries.filter(entry => entry.isFolder).length
      setDriveSyncSummary(`드라이브 메타데이터 반영 완료 · 파일 ${mapped.length}개 · 폴더 ${folderCount}개`)
      setAutoFillSummary('파일 본문 업로드 없이 파일명/경로 메타데이터만 반영되었습니다.')
    } catch (e) {
      setDriveLinkError(e instanceof Error ? e.message : String(e))
    } finally {
      setDriveSyncing(false)
    }
  }

  async function handleNextClick() {
    if (step === 0) {
      const hasFiles = themeBundleFiles.length > 0 || crimePackFiles.length > 0
      if (hasFiles) {
        await applyThemeBundleFiles() // 내부에서 setStep(1) 호출
      } else {
        if (canNext) setStep(1)
      }
    } else {
      if (canNext) setStep(step + 1)
    }
  }

  async function applyThemeBundleFiles() {
    if (themeBundleFiles.length === 0 && crimePackFiles.length === 0) {
      setAutoFillError('가져올 자료를 먼저 추가해주세요.')
      return
    }

    try {
      setAutoFillError(null)
      setAutoFillSummary(null)
      setAutoFillPhase('preparing')

      const normalized = splitThemeBundleFiles(themeBundleFiles)
      const normalizedFloorPlans = normalized.floorPlans
      const normalizedAttachments = normalized.attachments

      setFloorPlans(normalizedFloorPlans)
      setAttachments(normalizedAttachments)

      const inferenceSourceFiles = [...crimePackFiles, ...themeBundleFiles]

      if (!name.trim()) {
        const inferredName = inferThemeNameFromFiles(inferenceSourceFiles)
        if (inferredName) setName(inferredName)
      }
      const inferredTheme = !theme.trim() ? inferThemeNameFromFiles(inferenceSourceFiles) : ''
      if (!theme.trim()) {
        if (inferredTheme) setTheme(`${inferredTheme} 오프라인 운영 테마`)
      }
      const effectiveTheme = theme.trim() || (inferredTheme ? `${inferredTheme} 오프라인 운영 테마` : '')
      const inferredBranch = inferBranchCodeFromFiles(inferenceSourceFiles)
      if (inferredBranch) setBranches([inferredBranch])

      const combined = [...crimePackFiles, ...normalizedFloorPlans, ...normalizedAttachments]
      let success = false
      if (hasAiReadableContent(combined)) {
        success = await autoFillFromFiles(combined, effectiveTheme, setAutoFillPhase)
      } else {
        setAutoFillPhase('applying')
        setAutoFillSummary('파일명/폴더 구조 기반 자동 세팅 완료 · 본문 분석은 실제 파일 업로드 시 반영됩니다.')
        success = true
      }

      if (!success) {
        setAutoFillPhase('idle')
        return
      }

      setAutoFillPhase('complete')
      await wait(900)
      if (step === 0) {
        setStep(1)
      }
      setAutoFillPhase('idle')
    } catch (e) {
      setAutoFillError(e instanceof Error ? e.message : String(e))
      setAutoFillPhase('idle')
    }
  }

  // ── 카드 스타일 ──
  const card = (mb = 12): React.CSSProperties => ({
    background: 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.012))',
    border: '1px solid var(--border)',
    borderRadius: 16, padding: '20px 22px', marginBottom: mb,
    boxShadow: '0 16px 34px rgba(0,0,0,0.16)',
  })

  return (
    <div
      className="new-project-page"
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        color: '#d9e1f0',
        ['--text-primary' as string]: '#f3f6ff',
        ['--text-secondary' as string]: '#d8e1f2',
        ['--text-muted' as string]: '#aab6ca',
        ['--border' as string]: '#313949',
        ['--border-bright' as string]: '#4d5972',
      }}
    >
      <style>{`
        .new-project-page main {
          color: var(--text-secondary);
        }
        .new-project-page label {
          color: var(--text-secondary) !important;
          font-size: 13px !important;
          font-weight: 700 !important;
          letter-spacing: -0.01em;
        }
        .new-project-page input,
        .new-project-page textarea,
        .new-project-page select {
          color: var(--text-primary) !important;
        }
        .new-project-page input::placeholder,
        .new-project-page textarea::placeholder {
          color: #8692a8;
          opacity: 1;
        }
        .new-project-page button {
          letter-spacing: -0.01em;
        }
        @keyframes new-project-autofill-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(180,255,80,0.10); }
          50% { box-shadow: 0 0 0 10px rgba(180,255,80,0.02); }
        }
        @keyframes new-project-autofill-scan {
          0% { transform: translateY(-110%); opacity: 0; }
          20% { opacity: 0.95; }
          100% { transform: translateY(430%); opacity: 0; }
        }
        @keyframes new-project-autofill-dots {
          0% { transform: scale(0.75); opacity: 0.3; }
          50% { transform: scale(1); opacity: 1; }
          100% { transform: scale(0.75); opacity: 0.3; }
        }
        @keyframes new-project-autofill-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-4px); }
        }
        @keyframes new-project-autofill-bar {
          0% { background-position: 0% 50%; }
          100% { background-position: 100% 50%; }
        }
        @keyframes new-project-autofill-pulse {
          0%, 100% { opacity: 0.48; }
          50% { opacity: 1; }
        }
      `}</style>

      <header style={{ padding: '18px 32px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.015)' }}>
        <button onClick={() => navigate(isEditMode && editingProject ? `/project/${editingProject.id}` : '/')} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
          {isEditMode ? '← 프로젝트' : '← 홈'}
        </button>
        <span style={{ color: 'var(--border)' }}>|</span>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text-primary)' }}>{isEditMode ? '수사 백과사전 편집' : '새 프로젝트'}</div>
      </header>

      <main style={{ padding: '34px 32px 40px', maxWidth: 780, margin: '0 auto', boxSizing: 'border-box' }}>

        {/* 스텝 인디케이터 */}
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 36 }}>
          {STEPS.map((label, i) => (
            <Fragment key={i}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: i < step ? 'pointer' : 'default' }} onClick={() => i < step && setStep(i)}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: i < step ? '#00d4aa' : i === step ? 'var(--accent)' : 'var(--bg-card)', border: i > step ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: i <= step ? '#111111' : 'var(--text-muted)' }}>
                  {i < step ? '✓' : i + 1}
                </div>
                <div style={{ fontSize: 12, color: i === step ? 'var(--accent)' : 'var(--text-muted)', fontWeight: i === step ? 800 : 600, whiteSpace: 'nowrap', letterSpacing: '-0.01em' }}>{label}</div>
              </div>
              {i < STEPS.length - 1 && <div style={{ flex: 1, height: 1, background: i < step ? '#00d4aa' : 'var(--border)', margin: '0 8px', marginBottom: 20 }} />}
            </Fragment>
          ))}
        </div>

        {/* ── STEP 1 ── */}
        {step === 0 && (
          <div>
            <div style={card()}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 18, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>프로젝트 기본 정보</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 10 }}>지점 선택</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {BRANCH_CODES.map(code => {
                      const active = branches[0] === code
                      return (
                        <button
                          key={code}
                          onClick={() => setBranches([code])}
                          style={{
                            padding: '8px 18px',
                            borderRadius: 8,
                            fontSize: 14,
                            cursor: 'pointer',
                            border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                            background: active ? 'var(--accent)' : 'transparent',
                            color: active ? '#111111' : 'var(--text-secondary)',
                            fontWeight: active ? 700 : 500,
                            fontFamily: 'monospace',
                            letterSpacing: '0.5px',
                          }}
                        >
                          {code}
                        </button>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 7 }}>프로젝트 이름 *</label>
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="" style={inputStyle} />
                </div>
                <div>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 7 }}>테마 한 줄 설명 *</label>
                  <input value={theme} onChange={e => setTheme(e.target.value)} placeholder="AI 반영용(구체 키워드 포함)으로 쓰면 정확도가 가장 좋아요." style={inputStyle} />
                </div>
              </div>
            </div>

            <div style={card()}>
              <div style={{ marginBottom: 8 }}>
                <div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, position: 'relative' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>{hasCrimePackUpload ? '최종 MD 복원하기' : '자료 기반 자동 세팅하기'}</div>
                    <button
                      type="button"
                      aria-label="자료 업로드 가이드"
                      onMouseEnter={() => setShowImportGuide(true)}
                      onMouseLeave={() => setShowImportGuide(false)}
                      onFocus={() => setShowImportGuide(true)}
                      onBlur={() => setShowImportGuide(false)}
                      onClick={() => setShowImportGuide(v => !v)}
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: '50%',
                        border: '1px solid var(--border)',
                        background: 'var(--bg-secondary)',
                        color: 'var(--text-secondary)',
                        fontSize: 11,
                        fontWeight: 700,
                        cursor: 'pointer',
                        padding: 0,
                        lineHeight: 1,
                      }}
                    >
                      ?
                    </button>
                    {showImportGuide && (
                      <div
                        onMouseEnter={() => setShowImportGuide(true)}
                        onMouseLeave={() => setShowImportGuide(false)}
                        style={{
                          position: 'absolute',
                          top: 24,
                          left: 0,
                          zIndex: 40,
                          width: 470,
                          maxWidth: 'min(470px, calc(100vw - 72px))',
                          background: '#101522',
                          border: '1px solid var(--border-bright)',
                          borderRadius: 12,
                          padding: '12px 13px',
                          boxShadow: '0 14px 34px rgba(0,0,0,0.32)',
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          lineHeight: 1.55,
                        }}
                      >
                        <div style={{ fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>
                          자료 기반 자동 세팅하기 가이드
                        </div>
                        <div style={{ marginBottom: 8, color: '#c9d5ef' }}>
                          파일명 규칙은 <strong style={{ color: '#dfffa8' }}>선택 사항</strong>입니다. 규칙이 없어도 문서/이미지 내용을 우선 분석해 자동 반영합니다.
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <span style={{ color: '#9fb4dd' }}>정확도 권장:</span>{' '}
                          <strong style={{ color: '#dfffa8' }}>PDF &gt; PNG/JPG &gt; TXT/MD &gt; DOC/DOCX</strong>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ color: '#9fb4dd', marginBottom: 3 }}>신규 테마 기획서 핵심 파일명</div>
                          <code style={{ color: '#dfffa8' }}>Theme_plan_테마명_지점코드.pdf</code><br />
                          <code style={{ color: '#dfffa8' }}>Theme-plan-테마명-지점코드.docx</code>
                        </div>
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ color: '#9fb4dd', marginBottom: 3 }}>수사 종결보고서 권장 파일명</div>
                          <code style={{ color: '#dfffa8' }}>테마명_지점코드_수사종결보고서.pdf</code><br />
                          <code style={{ color: '#dfffa8' }}>수사종결보고서_테마명_지점코드.pdf</code>
                        </div>
                        <div style={{ color: 'var(--text-muted)', fontSize: 11 }}>
                          띄어쓰기/하이픈/언더스코어는 유연하게 인식합니다.
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>
                    {hasCrimePackUpload
                      ? '복원용 MD가 선택되었습니다. 자동 세팅 시 저장된 설정만 복원하며 AI 토큰은 사용되지 않습니다.'
                      : <>형식 제한 없이 올릴 수 있어요. 상세 권장 규칙은 <strong style={{ color: 'var(--text-secondary)' }}>?</strong> 안내에서 확인하세요.</>}
                  </div>
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <FileUploader
                  files={crimePackFiles}
                  onChange={handleCrimePackFilesChange}
                  label="복원용 최종 MD 업로드"
                  hint="(선택 · crime-pack.md / 토큰 없음)"
                  accept=".md,.txt"
                  multiple={false}
                  compact={true}
                  disabled={themeBundleFiles.length > 0}
                />
                {hasCrimePackUpload ? (
                  <div style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: '#3fb950',
                    background: '#3fb9501a',
                    border: '1px solid #3fb95044',
                    borderRadius: 8,
                    padding: '8px 10px',
                  }}>
                    복원 모드가 활성화되었습니다. 일반 자료는 함께 업로드할 수 없고, 자동 세팅 시 저장된 설정만 그대로 복원합니다.
                  </div>
                ) : themeBundleFiles.length > 0 ? (
                  <div style={{
                    marginTop: 8,
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 8,
                    padding: '8px 10px',
                  }}>
                    일반 자료 업로드가 있는 동안에는 복원용 MD를 함께 선택할 수 없습니다.
                  </div>
                ) : null}
              </div>
              <FileUploader
                files={themeBundleFiles}
                onChange={setThemeBundleFiles}
                label=""
                hint=""
                accept=".pdf,.jpg,.jpeg,.png,.md,.txt,.doc,.docx"
                multiple={true}
                allowDirectory={true}
                disabled={hasCrimePackUpload}
              />
              {autoFillBusy && (
                <div
                  style={{
                    marginTop: 12,
                    borderRadius: 14,
                    border: `1px solid ${autoFillPhase === 'complete' ? 'rgba(63,185,80,0.42)' : 'rgba(180,255,80,0.26)'}`,
                    background: autoFillPhase === 'complete'
                      ? 'linear-gradient(180deg, rgba(63,185,80,0.12), rgba(63,185,80,0.04))'
                      : 'linear-gradient(135deg, rgba(180,255,80,0.14), rgba(17,24,18,0.92) 42%, rgba(9,12,18,0.98))',
                    padding: '14px 14px 13px',
                    animation: autoFillPhase === 'complete' ? 'none' : 'new-project-autofill-glow 1.7s ease-in-out infinite',
                    overflow: 'hidden',
                    position: 'relative',
                  }}
                >
                  {autoFillPhase !== 'complete' && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        pointerEvents: 'none',
                        background: 'linear-gradient(180deg, transparent 0%, rgba(180,255,80,0.03) 32%, rgba(180,255,80,0.10) 50%, rgba(180,255,80,0.03) 68%, transparent 100%)',
                        animation: 'new-project-autofill-scan 2.2s linear infinite',
                      }}
                    />
                  )}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background: autoFillPhase === 'complete' ? 'rgba(63,185,80,0.16)' : 'rgba(180,255,80,0.14)',
                        border: `1px solid ${autoFillPhase === 'complete' ? 'rgba(63,185,80,0.28)' : 'rgba(180,255,80,0.24)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: autoFillPhase === 'complete' ? '#79e596' : 'var(--accent)',
                        flexShrink: 0,
                        animation: autoFillPhase === 'complete' ? 'none' : 'new-project-autofill-float 1.9s ease-in-out infinite',
                      }}
                    >
                      {autoFillPhase === 'complete' ? '✓' : <Spinner size={15} color="currentColor" />}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>
                        {autoFillPhase === 'complete' ? '자료 반영 완료' : '자료 기반 자동 세팅 진행 중'}
                      </div>
                      {autoFillPhaseText && (
                        <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3 }}>
                          {autoFillPhaseText}
                        </div>
                      )}
                    </div>
                    {autoFillPhase !== 'complete' && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 'auto' }}>
                        {[0, 1, 2].map(i => (
                          <span
                            key={i}
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: 'var(--accent)',
                              opacity: 0.35,
                              animation: `new-project-autofill-dots 1.1s ease-in-out ${i * 0.15}s infinite`,
                            }}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  <div style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 999,
                        background: 'rgba(255,255,255,0.08)',
                        overflow: 'hidden',
                        border: '1px solid rgba(255,255,255,0.05)',
                      }}
                    >
                      <div
                        style={{
                          width: `${autoFillProgressValue}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: autoFillPhase === 'complete'
                            ? 'linear-gradient(90deg, #3fb950, #79e596)'
                            : 'linear-gradient(90deg, rgba(180,255,80,0.75), rgba(180,255,80,1), rgba(225,255,163,0.95))',
                          backgroundSize: '200% 100%',
                          animation: autoFillPhase === 'complete' ? 'none' : 'new-project-autofill-bar 1.7s linear infinite',
                          boxShadow: autoFillPhase === 'complete' ? '0 0 18px rgba(63,185,80,0.25)' : '0 0 18px rgba(180,255,80,0.22)',
                          transition: 'width 220ms ease',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 7, gap: 10 }}>
                      <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                        AI Investigation Pipeline
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: autoFillPhase === 'complete' ? '#79e596' : 'var(--accent)' }}>
                        {autoFillProgressValue}%
                      </div>
                    </div>
                  </div>
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 1.5fr)',
                      gap: 10,
                      marginBottom: 12,
                    }}
                  >
                    <div
                      style={{
                        position: 'relative',
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
                        padding: '12px 12px 10px',
                        minHeight: 116,
                        overflow: 'hidden',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>분석 중인 자료</div>
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 10,
                            color: autoFillPhase === 'complete' ? '#79e596' : 'var(--accent)',
                            fontWeight: 700,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: 'currentColor',
                              animation: autoFillPhase === 'complete' ? 'none' : 'new-project-autofill-pulse 1.1s ease-in-out infinite',
                            }}
                          />
                          {themeBundleFiles.length} FILES
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                        {themeBundleFiles.slice(0, 3).map((file, index) => (
                          <div
                            key={file.id}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '7px 8px',
                              borderRadius: 9,
                              border: '1px solid rgba(255,255,255,0.07)',
                              background: index === 0 && autoFillPhase !== 'complete'
                                ? 'rgba(180,255,80,0.08)'
                                : 'rgba(255,255,255,0.03)',
                              transform: index === 0 && autoFillPhase !== 'complete' ? 'translateX(2px)' : 'none',
                              transition: 'transform 180ms ease',
                            }}
                          >
                            <div
                              style={{
                                width: 20,
                                height: 24,
                                borderRadius: 6,
                                background: 'rgba(255,255,255,0.08)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 9,
                                fontWeight: 800,
                                color: index === 0 && autoFillPhase !== 'complete' ? 'var(--accent)' : 'var(--text-muted)',
                                flexShrink: 0,
                              }}
                            >
                              {file.type === 'pdf' ? 'PDF' : file.type === 'image' ? 'IMG' : 'TXT'}
                            </div>
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {file.name}
                              </div>
                              <div style={{ fontSize: 9, color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {index === 0 && autoFillPhase !== 'complete' ? '현재 읽는 중' : '대기 중'}
                              </div>
                            </div>
                          </div>
                        ))}
                        {themeBundleFiles.length > 3 && (
                          <div style={{ fontSize: 10, color: 'var(--text-muted)', paddingLeft: 2 }}>
                            +{themeBundleFiles.length - 3}개 자료를 순차 반영 중
                          </div>
                        )}
                      </div>
                    </div>
                    <div
                      style={{
                        borderRadius: 12,
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'linear-gradient(180deg, rgba(5,8,12,0.30), rgba(255,255,255,0.03))',
                        padding: '12px 12px 10px',
                      }}
                    >
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 10 }}>
                        생성 예정 출력
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
                        {[
                          '동기 / 범행',
                          '수사 단서',
                          '등장인물',
                          '플레이 흐름',
                        ].map((label, index) => (
                          <div
                            key={label}
                            style={{
                              borderRadius: 10,
                              padding: '9px 9px 8px',
                              border: '1px solid rgba(255,255,255,0.07)',
                              background: 'rgba(255,255,255,0.03)',
                            }}
                          >
                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 5 }}>
                              {label}
                            </div>
                            <div style={{ display: 'flex', gap: 4 }}>
                              {[0, 1, 2].map(line => (
                                <span
                                  key={line}
                                  style={{
                                    display: 'block',
                                    height: 4,
                                    borderRadius: 999,
                                    flex: line === 2 ? 0.55 : 1,
                                    background: index <= activeAutoFillIndex
                                      ? 'rgba(180,255,80,0.45)'
                                      : 'rgba(255,255,255,0.08)',
                                    animation: autoFillPhase === 'complete' ? 'none' : `new-project-autofill-pulse 1.4s ease-in-out ${line * 0.12}s infinite`,
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
                    {autoFillSteps.map((item, index) => {
                      const done = autoFillPhase === 'complete' || index < activeAutoFillIndex
                      const active = autoFillPhase !== 'complete' && index === activeAutoFillIndex
                      return (
                        <div
                          key={item.key}
                          style={{
                            borderRadius: 10,
                            border: `1px solid ${done ? 'rgba(63,185,80,0.35)' : active ? 'rgba(180,255,80,0.32)' : 'var(--border)'}`,
                            background: done
                              ? 'rgba(63,185,80,0.10)'
                              : active
                                ? 'rgba(180,255,80,0.10)'
                                : 'rgba(255,255,255,0.02)',
                            padding: '10px 10px 9px',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 5 }}>
                            <div
                              style={{
                                width: 18,
                                height: 18,
                                borderRadius: '50%',
                                background: done ? '#3fb950' : active ? 'var(--accent)' : 'var(--bg-card)',
                                color: done || active ? '#111111' : 'var(--text-muted)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                fontWeight: 800,
                                flexShrink: 0,
                              }}
                            >
                              {done ? '✓' : index + 1}
                            </div>
                            <div style={{ fontSize: 11, fontWeight: 700, color: done || active ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                              {item.label}
                            </div>
                          </div>
                          <div style={{ fontSize: 10, lineHeight: 1.45, color: done || active ? 'var(--text-secondary)' : 'var(--text-muted)' }}>
                            {item.description}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
              <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Google Drive 폴더 연동 (선택)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center' }}>
                  <input
                    value={driveFolderLink}
                    onChange={e => {
                      setDriveFolderLink(e.target.value)
                      if (driveLinkError) setDriveLinkError(null)
                    }}
                    placeholder="폴더 링크 또는 folderId 입력"
                    style={{
                      ...smallInput,
                      flex: 1,
                      margin: 0,
                      opacity: hasCrimePackUpload ? 0.55 : 1,
                    }}
                    disabled={hasCrimePackUpload}
                  />
                  <button
                    type="button"
                    onClick={connectDriveFolderLink}
                    disabled={hasCrimePackUpload}
                    style={{
                      height: 34,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: '1px solid var(--border)',
                      background: 'var(--bg-secondary)',
                      color: 'var(--text-secondary)',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: hasCrimePackUpload ? 'default' : 'pointer',
                      opacity: hasCrimePackUpload ? 0.45 : 1,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    연결
                  </button>
                  <button
                    type="button"
                    onClick={syncThemeBundleFromDriveFolder}
                    disabled={hasCrimePackUpload || !driveFolderId || driveSyncing || !hasDriveApiKey}
                    style={{
                      height: 34,
                      padding: '0 12px',
                      borderRadius: 8,
                      border: `1px solid ${(hasCrimePackUpload || !driveFolderId || driveSyncing || !hasDriveApiKey) ? 'var(--border)' : 'var(--accent)'}`,
                      background: (hasCrimePackUpload || !driveFolderId || driveSyncing || !hasDriveApiKey) ? 'var(--bg-secondary)' : 'var(--accent)',
                      color: (hasCrimePackUpload || !driveFolderId || driveSyncing || !hasDriveApiKey) ? 'var(--text-muted)' : '#111111',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: (hasCrimePackUpload || !driveFolderId || driveSyncing || !hasDriveApiKey) ? 'default' : 'pointer',
                      opacity: hasCrimePackUpload ? 0.45 : 1,
                      whiteSpace: 'nowrap',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {driveSyncing && <Spinner size={11} color="var(--text-muted)" />}
                    {driveSyncing ? '불러오는 중...' : '목록 반영'}
                  </button>
                </div>
                {driveFolderId && !driveLinkError && (
                  <div style={{
                    fontSize: 11,
                    color: '#3fb950',
                    background: '#3fb9501a',
                    border: '1px solid #3fb95044',
                    borderRadius: 8,
                    padding: '8px 10px',
                  }}>
                    드라이브 폴더 연결됨 · folderId: <code>{driveFolderId}</code>
                  </div>
                )}
                {driveSyncSummary && !driveLinkError && (
                  <div style={{
                    fontSize: 11,
                    color: '#3fb950',
                    background: '#3fb9501a',
                    border: '1px solid #3fb95044',
                    borderRadius: 8,
                    padding: '8px 10px',
                  }}>
                    {driveSyncSummary}
                  </div>
                )}
                {driveLinkError && (
                  <div style={{
                    fontSize: 11,
                    color: '#f87171',
                    background: 'rgba(248,113,113,0.12)',
                    border: '1px solid rgba(248,113,113,0.38)',
                    borderRadius: 8,
                    padding: '8px 10px',
                  }}>
                    {driveLinkError}
                  </div>
                )}
                {!hasDriveApiKey && !driveLinkError && (
                  <div style={{
                    fontSize: 11,
                    color: '#fbbf24',
                    background: 'rgba(251,191,36,0.12)',
                    border: '1px solid rgba(251,191,36,0.35)',
                    borderRadius: 8,
                    padding: '8px 10px',
                  }}>
                    현재 환경에서는 Drive 목록 반영이 비활성화되어 있습니다. 로컬 파일/폴더 업로드는 정상 사용 가능합니다.
                  </div>
                )}
                {hasCrimePackUpload && (
                  <div style={{
                    fontSize: 11,
                    color: '#fbbf24',
                    background: 'rgba(251,191,36,0.12)',
                    border: '1px solid rgba(251,191,36,0.35)',
                    borderRadius: 8,
                    padding: '8px 10px',
                  }}>
                    복원용 MD 업로드 모드에서는 Drive/로컬 분석이 비활성화됩니다. 설정 복원만 진행되며 AI 토큰은 사용되지 않습니다.
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.6 }}>
                  실파일 업로드 없이도 링크 연결 후 목록 반영으로 파일명/경로 구조 메타데이터를 반영할 수 있습니다.
                  (정밀 자동반영은 PDF/JPG/PNG/TXT/MD 권장, DOC/DOCX는 제목/파일명 중심으로 반영)
                </div>
              </div>
              {autoFillSummary && (
                <div style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: '#3fb950',
                  background: '#3fb9501a',
                  border: '1px solid #3fb95044',
                  borderRadius: 8,
                  padding: '8px 10px',
                }}>
                  {autoFillSummary}
                </div>
              )}
              {autoFillError && (
                <div style={{
                  marginTop: 8,
                  fontSize: 11,
                  color: '#f87171',
                  background: 'rgba(248,113,113,0.12)',
                  border: '1px solid rgba(248,113,113,0.38)',
                  borderRadius: 8,
                  padding: '8px 10px',
                  whiteSpace: 'pre-wrap',
                }}>
                  자동 반영 실패: {autoFillError}
                </div>
              )}
            </div>
            {/* 게임 시스템 타입 */}
            <div style={card()}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>게임 시스템 타입 <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>(중복 선택 가능)</span></div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16, lineHeight: 1.6 }}>선택한 타입에 따라 전문 AI 에이전트가 자동으로 활성화됩니다</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {([
                  {
                    type: 'escape' as GameSystemType,
                    emoji: '🔓', label: '방탈출 게임', locked: true,
                    color: '#9b6dff', bg: '#1e1b4b',
                    desc: '공간 탐색 · 퍼즐 해결 · 잠금장치 · 타이머 탈출',
                    agents: ['크리에이티브 디렉터', '스토리 아키텍트', '게임 디렉터', '퍼즐 마스터', '스페이스 디자이너', '오퍼레이션 매니저'],
                    agentColor: '#9b6dff',
                  },
                  {
                    type: 'surround' as GameSystemType,
                    emoji: '🎧', label: '서라운드 게임', locked: false,
                    color: '#8b5cf6', bg: '#1e1535',
                    desc: '완전한 어둠 · 헤드셋 필수 · 3D 사운드 몰입 · 청각 단서',
                    agents: ['🎧 음향술사 (서라운드 오디오 스크립트 전담)'],
                    agentColor: '#8b5cf6',
                  },
                  {
                    type: 'crimescene' as GameSystemType,
                    emoji: '🔍', label: '크라임씬 게임', locked: false,
                    color: '#ef4444', bg: '#1f0a0a',
                    desc: '살인현장 · 마네킹 시체 모형 · CSI 수사 · 범인 검거',
                    agents: ['🔍 엑스파일러 (수사·증거·검거 시스템 전담)'],
                    agentColor: '#ef4444',
                  },
                ] as const).map(({ type, emoji, label, locked, color, bg, desc, agents, agentColor }) => {
                  const active = gameSystemTypes.includes(type)
                  return (
                    <div
                      key={type}
                      onClick={() => !locked && toggleGameSystem(type)}
                      style={{
                        border: `1.5px solid ${active ? color : 'var(--border)'}`,
                        borderRadius: 12, padding: '14px 16px',
                        background: active ? bg : 'transparent',
                        cursor: locked ? 'default' : 'pointer',
                        transition: 'all 0.15s',
                        opacity: 1,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        <span style={{ fontSize: 22 }}>{emoji}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontWeight: 700, fontSize: 14, color: active ? color : 'var(--text-primary)' }}>{label}</span>
                            {locked && <span style={{ fontSize: 10, background: `${color}33`, color, border: `1px solid ${color}55`, borderRadius: 10, padding: '1px 7px', fontWeight: 700 }}>기본 포함</span>}
                            {!locked && active && <span style={{ fontSize: 10, background: `${color}33`, color, border: `1px solid ${color}55`, borderRadius: 10, padding: '1px 7px', fontWeight: 700 }}>✓ 선택됨</span>}
                          </div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{desc}</div>
                        </div>
                        {!locked && (
                          <div style={{
                            width: 20, height: 20, borderRadius: '50%',
                            border: `2px solid ${active ? color : 'var(--border)'}`,
                            background: active ? color : 'transparent',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 11, color: 'white', fontWeight: 900, flexShrink: 0,
                          }}>
                            {active ? '✓' : ''}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4, paddingLeft: 32 }}>
                        {agents.map(a => (
                          <span key={a} style={{
                            fontSize: 10, background: `${agentColor}18`,
                            border: `1px solid ${agentColor}44`,
                            color: active ? agentColor : 'var(--text-muted)',
                            borderRadius: 6, padding: '2px 8px',
                          }}>{a}</span>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 1 && (
          <div>
            {/* 테마 장르 */}
            <div style={card()}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 6, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>테마 장르 <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>(고정 키워드 + 직접 입력 가능 · 중복 선택 가능)</span></div>
              <ChipGroup items={GENRES} selected={genres} onChange={next => setGenres(normalizeGenres(next))} accent="var(--accent)" />
              <CustomInput
                selected={genres}
                presetItems={GENRES}
                onChange={next => setGenres(normalizeGenres(next))}
                accent="var(--accent)"
              />
            </div>

            {/* [A] 범행동기 */}
            <div style={card()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}><span style={{ color: '#e74c3c', marginRight: 6 }}>[A]</span>범행동기</div>
                {motives.length > 0 && <span style={{ fontSize: 11, color: '#e74c3c' }}>{motives.length}개 선택</span>}
              </div>
              {[...CRIME_MOTIVES, { group: '기타', items: [] as readonly string[] }].map(({ group, items }) => (
                <CollapsibleGroup
                  key={group}
                  group={group}
                  items={items}
                  selected={motives}
                  onChange={setMotives}
                  accent="#e74c3c"
                  allowCustom={group === '기타'}
                  allPresetItems={group === '기타' ? CRIME_MOTIVES.flatMap(g => g.items) : undefined}
                  groupKey="A"
                  keywordStates={keywordStates.A}
                  draggingKeyword={draggingKeyword}
                  dragOverTarget={dragOverTarget}
                  onDragKeywordStart={handleKeywordDragStart}
                  onDragKeywordEnd={handleKeywordDragEnd}
                  onDragOverTarget={setDragOverTarget}
                  onDropToTarget={handleKeywordDrop}
                  hiddenPresetLabels={new Set(hiddenPresetLibrary.A)}
                />
              ))}
            </div>

            {/* [B] 범행종류 */}
            <div style={card()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}><span style={{ color: '#e67e22', marginRight: 6 }}>[B]</span>범행종류</div>
                {crimeTypes.length > 0 && <span style={{ fontSize: 11, color: '#e67e22' }}>{crimeTypes.length}개 선택</span>}
              </div>
              {[...CRIME_TYPES, { group: '기타', items: [] as readonly string[] }].map(({ group, items }) => (
                <CollapsibleGroup
                  key={group}
                  group={group}
                  items={items}
                  selected={crimeTypes}
                  onChange={setCrimeTypes}
                  accent="#e67e22"
                  allowCustom={group === '기타'}
                  allPresetItems={group === '기타' ? CRIME_TYPES.flatMap(g => g.items) : undefined}
                  groupKey="B"
                  keywordStates={keywordStates.B}
                  draggingKeyword={draggingKeyword}
                  dragOverTarget={dragOverTarget}
                  onDragKeywordStart={handleKeywordDragStart}
                  onDragKeywordEnd={handleKeywordDragEnd}
                  onDragOverTarget={setDragOverTarget}
                  onDropToTarget={handleKeywordDrop}
                  hiddenPresetLabels={new Set(hiddenPresetLibrary.B)}
                />
              ))}
            </div>

            {/* [C] 수사단서 */}
            <div style={card()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}><span style={{ color: '#27ae60', marginRight: 6 }}>[C]</span>수사단서</div>
                {clues.length > 0 && <span style={{ fontSize: 11, color: '#27ae60' }}>{clues.length}개 선택</span>}
              </div>
              {[...CRIME_CLUES, { group: '기타', items: [] as readonly string[] }].map(({ group, items }) => (
                <CollapsibleGroup
                  key={group}
                  group={group}
                  items={items}
                  selected={clues}
                  onChange={setClues}
                  accent="#27ae60"
                  allowCustom={group === '기타'}
                  allPresetItems={group === '기타' ? CRIME_CLUES.flatMap(g => g.items) : undefined}
                  groupKey="C"
                  keywordStates={keywordStates.C}
                  draggingKeyword={draggingKeyword}
                  dragOverTarget={dragOverTarget}
                  onDragKeywordStart={handleKeywordDragStart}
                  onDragKeywordEnd={handleKeywordDragEnd}
                  onDragOverTarget={setDragOverTarget}
                  onDropToTarget={handleKeywordDrop}
                  hiddenPresetLabels={new Set(hiddenPresetLibrary.C)}
                />
              ))}
            </div>

            {/* [D] 수사기법 */}
            <div style={card()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}><span style={{ color: '#3498db', marginRight: 6 }}>[D]</span>수사기법</div>
                {methods.length > 0 && <span style={{ fontSize: 11, color: '#3498db' }}>{methods.length}개 선택</span>}
              </div>
              {[...CRIME_METHODS, { group: '기타', items: [] as readonly string[] }].map(({ group, items }) => (
                <CollapsibleGroup
                  key={group}
                  group={group}
                  items={items}
                  selected={methods}
                  onChange={setMethods}
                  accent="#3498db"
                  allowCustom={group === '기타'}
                  allPresetItems={group === '기타' ? CRIME_METHODS.flatMap(g => g.items) : undefined}
                  groupKey="D"
                  keywordStates={keywordStates.D}
                  draggingKeyword={draggingKeyword}
                  dragOverTarget={dragOverTarget}
                  onDragKeywordStart={handleKeywordDragStart}
                  onDragKeywordEnd={handleKeywordDragEnd}
                  onDragOverTarget={setDragOverTarget}
                  onDropToTarget={handleKeywordDrop}
                  hiddenPresetLabels={new Set(hiddenPresetLibrary.D)}
                />
              ))}
            </div>

            {/* 배경 장소 */}
            <div style={card()}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>배경 장소</div>
              <input value={location} onChange={e => setLocation(e.target.value)} placeholder="예: 1960년대 유서 깊은 고택" style={smallInput} />
            </div>

            {/* 등장인물 */}
            <div style={card()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>등장인물 <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>(선택)</span></div>
                <button onClick={addCharacter} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ 인물 추가</button>
              </div>
              {characters.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '12px 0' }}>인물을 추가하지 않으면 에이전트가 설정합니다</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {characters.map(c => {
                    const color = ROLE_COLORS[c.role]
                    const autoLabel = charLabel(c.id)
                    const sameRole = characters.filter(x => x.role === c.role)
                    const suffix = !c.name && sameRole.length > 1
                      ? String.fromCharCode(65 + sameRole.findIndex(x => x.id === c.id))
                      : null
                    return (
                      <div key={c.id} style={{ background: 'var(--bg-secondary)', border: `1px solid ${color}44`, borderRadius: 10, padding: '12px 14px' }}>
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8 }}>
                          <div style={selectWrapStyle}>
                            <select value={c.role} onChange={e => updateCharacter(c.id, { role: e.target.value as CharacterRole })}
                              style={{
                                ...appleSelectBaseStyle,
                                border: `1px solid ${color}66`,
                                background: `${color}22`,
                                color,
                                fontWeight: 700,
                                paddingRight: suffix ? '38px' : '28px',
                                minWidth: 78,
                              }}>
                              {CHARACTER_ROLES.map(r => <option key={r} value={r} style={{ background: '#10131d', color: '#dbe2f0' }}>{r}</option>)}
                            </select>
                            <span style={{ ...selectChevronStyle, color }}>{'▾'}</span>
                            {suffix && (
                              <span style={{ position: 'absolute', right: 20, fontSize: 10, fontWeight: 800, color, pointerEvents: 'none' }}>{suffix}</span>
                            )}
                          </div>
                          <input value={c.name} onChange={e => updateCharacter(c.id, { name: e.target.value })}
                            placeholder={`이름 입력 (미입력 시: ${autoLabel})`}
                            style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 13, fontFamily: 'inherit', outline: 'none' }} />
                          <button onClick={() => removeCharacter(c.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 18, padding: '0 4px', lineHeight: 1 }}>×</button>
                        </div>
                        <input value={c.background} onChange={e => updateCharacter(c.id, { background: e.target.value })} placeholder="역할·스토리·배경 (선택)"
                          style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box' }} />
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

            {/* 인물 관계도 */}
            {characters.length >= 2 && (
              <div style={card()}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>인물 관계도 <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>(선택)</span></div>
                  {!showRelationForm && (
                    <button onClick={openCreateRelationForm} style={{ padding: '6px 14px', borderRadius: 8, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+ 관계 추가</button>
                  )}
                </div>

                {/* 기존 관계 목록 */}
                {relations.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                    {relations.map(r => {
                      const color = getRelationColor(r.relationType)
                      return (
                        <div key={r.id} style={{ background: 'var(--bg-secondary)', border: `1px solid ${color}44`, borderRadius: 10, padding: '10px 14px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: r.description ? 4 : 0 }}>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{charLabel(r.fromId)}</span>
                            <span style={{ fontSize: 11 }}>──</span>
                            <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: color, color: 'white', fontWeight: 700 }}>{r.relationType}</span>
                            <span style={{ fontSize: 11 }}>──▶</span>
                            <span style={{ fontSize: 13, fontWeight: 700 }}>{charLabel(r.toId)}</span>
                            <button
                              onClick={() => openEditRelationForm(r.id)}
                              title="관계 수정"
                              aria-label="관계 수정"
                              style={{
                                marginLeft: 'auto',
                                width: 26,
                                height: 26,
                                borderRadius: 7,
                                border: '1px solid var(--border)',
                                background: 'transparent',
                                color: 'var(--text-secondary)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                padding: 0,
                              }}
                            >
                              <WriteIcon width={13} height={13} />
                            </button>
                            <button onClick={() => setRelations(prev => prev.filter(x => x.id !== r.id))} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: '0 2px' }}>×</button>
                          </div>
                          {r.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', paddingLeft: 2 }}>{r.description}</div>}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* 관계 추가 폼 */}
                {showRelationForm && (
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px' }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
                      <div style={selectWrapStyle}>
                        <select value={relFrom} onChange={e => setRelFrom(e.target.value)}
                          style={{ ...appleSelectBaseStyle, minWidth: 108 }}>
                          <option value="">인물 A 선택</option>
                          {characters.map(c => <option key={c.id} value={c.id}>{charLabel(c.id)}</option>)}
                        </select>
                        <span style={selectChevronStyle}>{'▾'}</span>
                      </div>
                      <div style={selectWrapStyle}>
                        <select value={relType} onChange={e => setRelType(e.target.value as RelationType)}
                          style={{
                            ...appleSelectBaseStyle,
                            border: `1px solid ${getRelationColor(relType)}66`,
                            background: `${getRelationColor(relType)}20`,
                            color: getRelationColor(relType),
                            fontWeight: 700,
                          }}>
                          {RELATION_TYPES.map(t => <option key={t} value={t} style={{ background: '#10131d', color: '#dbe2f0' }}>{t}</option>)}
                        </select>
                        <span style={{ ...selectChevronStyle, color: getRelationColor(relType) }}>{'▾'}</span>
                      </div>
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>──▶</span>
                      <div style={selectWrapStyle}>
                        <select value={relTo} onChange={e => setRelTo(e.target.value)}
                          style={{ ...appleSelectBaseStyle, minWidth: 108 }}>
                          <option value="">인물 B 선택</option>
                          {characters.filter(c => c.id !== relFrom).map(c => <option key={c.id} value={c.id}>{charLabel(c.id)}</option>)}
                        </select>
                        <span style={selectChevronStyle}>{'▾'}</span>
                      </div>
                    </div>
                    {relType === '기타' && (
                      <input
                        value={relCustomType}
                        onChange={e => setRelCustomType(e.target.value)}
                        placeholder="직접 관계명을 입력하세요"
                        style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }}
                      />
                    )}
                    <input value={relDesc} onChange={e => setRelDesc(e.target.value)} placeholder="관계 서사·배경 (선택)"
                      style={{ width: '100%', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box', marginBottom: 8 }} />
                    <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                      <button onClick={resetRelationForm} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer' }}>취소</button>
                      <button onClick={submitRelation} style={{ padding: '6px 14px', borderRadius: 8, border: 'none', background: 'var(--accent)', color: '#111111', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{editingRelationId ? '수정' : '추가'}</button>
                    </div>
                  </div>
                )}

                {relations.length === 0 && !showRelationForm && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'center', padding: '8px 0' }}>관계를 추가하지 않으면 에이전트가 설정합니다</div>
                )}
              </div>
            )}

            {/* 게임 플레이 스토리 흐름 */}
            <div style={card()}>
              <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>게임 플레이 스토리 흐름 <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>(선택 · 플레이어가 게임 중 알게 되는 흐름)</span></div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {storyFlow.map((s, idx) => (
                  <div key={s.stage} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', marginBottom: 8 }}>{STAGE_LABELS[s.stage]}</div>
                    <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 8, alignItems: 'start' }}>
                      <input value={s.roomName} onChange={e => updateStoryFlow(idx, { roomName: e.target.value })} placeholder="공간명 (예: 서재)"
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }} />
                      <textarea value={s.description} onChange={e => updateStoryFlow(idx, { description: e.target.value })} placeholder="플레이어가 이 단계에서 무엇을 발견하고 이해하는지 입력"
                        rows={3}
                        style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 10px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none', resize: 'vertical', minHeight: 76 }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 테마 도면 첨부 */}
            <div style={card()}>
              <FileUploader
                files={floorPlans}
                onChange={setFloorPlans}
                label="테마 도면 첨부"
                hint="(선택 · JPG, PNG, PDF)"
                accept=".jpg,.jpeg,.png,.pdf"
              />
              <div style={{ marginTop: 10, padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: 8, fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.7 }}>
                💡 도면에 표기된 <strong style={{ color: 'var(--text-secondary)' }}>방 이름</strong>을 위 <strong style={{ color: 'var(--accent)' }}>게임 플레이 스토리 흐름</strong>의 <strong style={{ color: 'var(--accent)' }}>공간명</strong>과 동일하게 입력하면,<br />
                에이전트가 도면과 게임 플레이 흐름을 자동으로 연결하여 공간 구성과 플레이 동선을 파악합니다.
              </div>
            </div>

            <div style={{ marginTop: -2, marginBottom: 2, fontSize: 11, color: 'var(--text-muted)' }}>
              참고 파일은 <strong style={{ color: 'var(--text-secondary)' }}>1단계 기본정보 &gt; 자료 기반 자동 세팅하기</strong>에서 통합 관리됩니다.
            </div>
          </div>
        )}

        {/* ── STEP 3: 최종 확인 ── */}
        {step === 2 && (
          <div>
            {/* 프로젝트 정보 */}
            <div style={card()}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-primary)' }}>프로젝트 정보</div>
                <button
                  type="button"
                  onClick={downloadCrimePackTemplate}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 30,
                    padding: '0 10px',
                    borderRadius: 8,
                    border: '1px solid var(--border)',
                    background: 'var(--bg-secondary)',
                    color: 'var(--text-secondary)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  <DownloadIcon width={12} height={12} />
                  MD 다운로드
                </button>
              </div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 4 }}>{name}</div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>{theme}</div>
              {branches[0] && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: genres.length > 0 ? 10 : 0 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4, background: 'var(--accent-dim)', color: 'var(--accent)', fontFamily: 'monospace' }}>{branches[0]}</span>
                </div>
              )}
              {genres.length > 0 && (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {genres.map(g => <span key={g} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 8, background: 'var(--accent-dim)', color: 'var(--accent)' }}>{g}</span>)}
                </div>
              )}
            </div>

            {/* 조합 미리보기 */}
            <div style={{ background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)', border: '1px solid var(--accent)', borderRadius: 14, padding: '18px 20px', marginBottom: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700 }}>💡 사건 조합 미리보기</div>
                <button
                  type="button"
                  disabled={combinationSaving}
                  onClick={async () => {
                    setCombinationSaving(true)
                    try {
                      const crimeConfig: CrimeConfig = { motives, crimeTypes, clues, methods, location, genres: normalizeGenres(genres), characters, relations, storyFlow }
                      const summary = await generateCombinationSummary(crimeConfig)
                      setPreviewSummary(summary)
                    } catch { /* 실패 시 기존 유지 */ } finally {
                      setCombinationSaving(false)
                    }
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 7, border: '1px solid var(--accent)', background: 'transparent', color: 'var(--accent)', fontSize: 11, fontWeight: 700, cursor: combinationSaving ? 'not-allowed' : 'pointer', opacity: combinationSaving ? 0.5 : 1 }}
                >
                  {combinationSaving ? <Spinner size={10} color="var(--accent)" /> : '↻'} 재생성
                </button>
              </div>
              {combinationSaving
                ? <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--text-muted)' }}><Spinner size={13} color="var(--accent)" /> 사건 조합 생성 중...</div>
                : <div style={{ fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.7 }}>{previewSummary ?? buildPreviewSentence()}</div>
              }
            </div>

            {/* ABCD 요약 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
              {[
                { label: '[A] 범행동기', items: motives, color: '#e74c3c' },
                { label: '[B] 범행종류', items: crimeTypes, color: '#e67e22' },
                { label: '[C] 수사단서', items: clues, color: '#27ae60' },
                { label: '[D] 수사기법', items: methods, color: '#3498db' },
              ].map(({ label, items, color }) => (
                <div key={label} style={{ background: 'var(--bg-card)', border: `1px solid ${color}22`, borderRadius: 12, padding: '14px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 800, color, marginBottom: 8 }}>{label}</div>
                  {items.length === 0 ? <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>선택 없음</div>
                    : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{items.map(item => <span key={item} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: `${color}22`, color }}>{item}</span>)}</div>}
                </div>
              ))}
            </div>

            {/* 등장인물 요약 */}
            {characters.length > 0 && (
              <div style={card()}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>등장인물</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {characters.map(c => {
                    const color = ROLE_COLORS[c.role]
                    return (
                      <div key={c.id} style={{ background: `${color}22`, border: `1px solid ${color}44`, borderRadius: 8, padding: '6px 10px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color }}>{c.role}{c.name && ` · ${c.name}`}</div>
                        {c.background && <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2, maxWidth: 160 }}>{c.background}</div>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 관계도 요약 */}
            {relations.length > 0 && (
              <div style={card()}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>인물 관계도</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {relations.map(r => {
                    const color = getRelationColor(r.relationType)
                    return (
                      <div key={r.id} style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 700 }}>{charLabel(r.fromId)}</span>
                        <span style={{ color: 'var(--text-muted)' }}>──</span>
                        <span style={{ padding: '1px 7px', borderRadius: 8, background: color, color: 'white', fontSize: 11, fontWeight: 700 }}>{r.relationType}</span>
                        <span style={{ color: 'var(--text-muted)' }}>──▶</span>
                        <span style={{ fontWeight: 700 }}>{charLabel(r.toId)}</span>
                        {r.description && <span style={{ color: 'var(--text-muted)' }}>: {r.description}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* 게임 플레이 스토리 흐름 요약 */}
            {storyFlow.some(s => s.description || s.roomName) && (
              <div style={card()}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 8 }}>게임 플레이 스토리 흐름</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {storyFlow.filter(s => s.description || s.roomName).map(s => (
                    <div key={s.stage} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontSize: 12 }}>
                      <span style={{ fontWeight: 700, color: 'var(--accent)', minWidth: 32 }}>{s.stage}</span>
                      <div style={{ flex: 1 }}>
                        {s.roomName && <span style={{ background: 'var(--bg-secondary)', borderRadius: 4, padding: '1px 6px', fontSize: 11, marginRight: 6 }}>📍 {s.roomName}</span>}
                        {s.description && <span style={{ color: 'var(--text-secondary)' }}>{s.description}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 배경 장소 */}
            {location && (
              <div style={card()}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 4 }}>배경 장소</div>
                <div style={{ fontSize: 13 }}>📍 {location}</div>
              </div>
            )}

            {/* 도면 요약 */}
            {floorPlans.length > 0 && (
              <div style={card()}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>테마 도면 ({floorPlans.length})</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {floorPlans.map(f => (
                    <span key={f.id} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: 6 }}>
                      {f.type === 'pdf' ? 'PDF' : 'IMG'} {f.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 첨부파일 요약 */}
            {attachments.length > 0 && (
              <div style={card(0)}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>참고 파일 ({attachments.length})</div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {attachments.map(f => <span key={f.id} style={{ fontSize: 11, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '3px 8px', borderRadius: 6 }}>{f.type === 'pdf' ? 'PDF' : f.type === 'image' ? 'IMG' : 'TXT'} · {f.name}</span>)}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 하단 버튼 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20, paddingTop: 20, borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => {
              if (isEditMode && step === 1 && editingProject) { navigate(`/project/${editingProject.id}`); return }
              if (step === 0) { navigate('/'); return }
              setStep(step - 1)
            }}
            style={{ padding: '10px 24px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-secondary)', fontSize: 14, cursor: 'pointer' }}
          >
            {(isEditMode && step === 1) || step === 0 ? '취소' : '← 이전'}
          </button>
          {step < 2 ? (
            <button
              onClick={handleNextClick}
              disabled={!canNext || autoFillBusy}
              style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: (canNext && !autoFillBusy) ? 'var(--accent)' : 'var(--bg-card)', color: (canNext && !autoFillBusy) ? '#111111' : 'var(--text-muted)', fontSize: 14, fontWeight: 700, cursor: (canNext && !autoFillBusy) ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {autoFillBusy ? <><Spinner size={12} color="var(--text-muted)" /> 반영 중...</> : step === 0 && (themeBundleFiles.length > 0 || crimePackFiles.length > 0) ? '반영 후 다음 →' : '다음 →'}
            </button>
          ) : (
            <button
              onClick={handleStart}
              disabled={combinationSaving}
              style={{ padding: '10px 28px', borderRadius: 10, border: 'none', background: combinationSaving ? 'var(--bg-card)' : 'var(--accent)', color: combinationSaving ? 'var(--text-muted)' : '#111111', fontSize: 14, fontWeight: 700, cursor: combinationSaving ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              {combinationSaving ? <><Spinner size={12} color="var(--text-muted)" /> 저장 중...</> : isEditMode ? '💾 편집 저장' : '🚀 프로젝트 시작'}
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
