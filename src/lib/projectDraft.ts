/**
 * 새 프로젝트 마법사 임시 저장.
 *
 * 업로드한 파일의 base64 본문은 저장하지 않는다 — localStorage 용량(약 5MB)을
 * 금방 넘겨 저장 자체가 실패하기 때문. 대신 파일명만 남겨 복원 시 다시
 * 붙이도록 안내한다.
 */
import type {
  BranchCode, Character, CharacterRelation, GameSystemType, StoryStage,
} from '../types'

const DRAFT_KEY = 'xynaps_new_project_draft'

export interface ProjectDraft {
  savedAt: string
  step: number
  name: string
  theme: string
  branches: BranchCode[]
  gameSystemTypes: GameSystemType[]
  motives: string[]
  crimeTypes: string[]
  clues: string[]
  methods: string[]
  genres: string[]
  location: string
  characters: Character[]
  relations: CharacterRelation[]
  storyFlow: StoryStage[]
  previewSummary: string | null
  driveFolderLink: string
  driveFolderId: string | null
  /** 저장 시점에 붙어 있던 파일 이름 — 복원 시 다시 첨부하라고 안내하는 용도 */
  attachedFileNames: string[]
}

/** 사용자가 실제로 뭔가 입력했을 때만 임시저장한다 (빈 초안이 쌓이는 걸 방지) */
export function draftHasContent(draft: Omit<ProjectDraft, 'savedAt'>): boolean {
  return Boolean(
    draft.name.trim()
    || draft.theme.trim()
    || draft.motives.length
    || draft.crimeTypes.length
    || draft.clues.length
    || draft.methods.length
    || draft.genres.length
    || draft.location.trim()
    || draft.characters.length
    || draft.relations.length
    || draft.storyFlow.some(s => s.description?.trim() || s.roomName?.trim())
  )
}

export function saveProjectDraft(draft: Omit<ProjectDraft, 'savedAt'>): string | null {
  if (!draftHasContent(draft)) return null
  const savedAt = new Date().toISOString()
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...draft, savedAt }))
    return savedAt
  } catch {
    // 용량 초과 등 — 임시저장 실패가 작성 자체를 막아서는 안 된다
    return null
  }
}

export function loadProjectDraft(): ProjectDraft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as ProjectDraft
    if (!parsed || typeof parsed !== 'object' || !parsed.savedAt) return null
    return parsed
  } catch {
    return null
  }
}

export function clearProjectDraft(): void {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // 무시
  }
}

export function formatDraftTime(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const today = new Date()
  const sameDay = d.toDateString() === today.toDateString()
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return sameDay ? time : `${d.getMonth() + 1}/${d.getDate()} ${time}`
}
