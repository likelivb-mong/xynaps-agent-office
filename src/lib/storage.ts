import type { Project, ProjectVersion, AgentReport, FinalReport, SkillFile, AgentId, BranchCode, CrimeConfig, GameFlowSheet, GameSystemType, ChatMessage, CollaborationStatus, WorkshopSession, MeetingMinutes } from '../types'
import { supabase } from './supabase'

const PROJECTS_KEY = 'xynaps_v2_projects'
const PROJECTS_TRASH_KEY = 'xynaps_v2_projects_trash'
const SKILLS_KEY = 'xynaps_v2_skills'
const COMMON_SKILLS_KEY = 'xynaps_v2_common_skills'

// ── Supabase 동기화 ────────────────────────────────────────────────────────────

async function sbUpsertProject(project: Project): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('projects').upsert({
    id: project.id,
    data: project,
    owner_id: project.ownerId ?? null,
    owner_name: project.ownerName ?? null,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  })
  if (error) console.error('[supabase] upsert project failed:', error.message, { id: project.id })
}

async function sbDeleteProject(projectId: string): Promise<void> {
  if (!supabase) return
  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  if (error) console.error('[supabase] delete project failed:', error.message, { id: projectId })
}

// ── Supabase 스킬 동기화 ───────────────────────────────────────────────────────

async function sbUpsertSkill(agentId: string, skill: SkillFile): Promise<void> {
  if (!supabase) return
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { base64, url, ...meta } = skill as SkillFile & { base64?: string; url?: string }
  await supabase.from('agent_skills').upsert({
    id: meta.id,
    owner_id: null,
    agent_id: agentId,
    name: meta.name,
    type: meta.type,
    media_type: meta.mediaType ?? null,
    guide_prompt: meta.guidePrompt ?? null,
    knowledge_summary: meta.knowledgeSummary ?? null,
    enabled: meta.enabled ?? true,
    uploaded_at: meta.uploadedAt ?? new Date().toISOString(),
  })
}

async function sbDeleteSkill(skillId: string): Promise<void> {
  if (!supabase) return
  await supabase.from('agent_skills').delete().eq('id', skillId)
}

export async function syncSkillsFromSupabase(): Promise<void> {
  if (!supabase) return
  const { data, error } = await supabase
    .from('agent_skills')
    .select('agent_id,id,name,type,media_type,guide_prompt,knowledge_summary,enabled,uploaded_at')
  if (error || !data) return

  const byAgent: Record<string, SkillFile[]> = {}
  const commonList: SkillFile[] = []

  for (const row of data) {
    const skill: SkillFile = {
      id: row.id,
      name: row.name,
      type: row.type as SkillFile['type'],
      mediaType: row.media_type ?? undefined,
      guidePrompt: row.guide_prompt ?? undefined,
      knowledgeSummary: row.knowledge_summary ?? undefined,
      enabled: row.enabled ?? true,
      uploadedAt: row.uploaded_at,
    }
    if (row.agent_id === 'common') {
      commonList.push(skill)
    } else {
      if (!byAgent[row.agent_id]) byAgent[row.agent_id] = []
      byAgent[row.agent_id].push(skill)
    }
  }

  // Merge with local (local wins if same id — local may have base64)
  const localSkills = JSON.parse(localStorage.getItem(SKILLS_KEY) || '{}') as Record<string, SkillFile[]>
  const localCommon = JSON.parse(localStorage.getItem(COMMON_SKILLS_KEY) || '[]') as SkillFile[]

  const mergedSkills: Record<string, SkillFile[]> = { ...localSkills }
  for (const [agentId, remoteList] of Object.entries(byAgent)) {
    const localList = localSkills[agentId] ?? []
    const localIds = new Set(localList.map(s => s.id))
    const newFromRemote = remoteList.filter(s => !localIds.has(s.id))
    mergedSkills[agentId] = [...localList, ...newFromRemote]
  }
  localStorage.setItem(SKILLS_KEY, JSON.stringify(mergedSkills))

  const localCommonIds = new Set(localCommon.map(s => s.id))
  const newCommon = commonList.filter(s => !localCommonIds.has(s.id))
  localStorage.setItem(COMMON_SKILLS_KEY, JSON.stringify([...localCommon, ...newCommon]))

  // 로컬에만 있는 스킬 Supabase에 업로드
  const remoteSkillIds = new Set(data.map((r: { id: string }) => r.id))
  for (const [agentId, skillList] of Object.entries(localSkills)) {
    for (const skill of skillList) {
      if (!remoteSkillIds.has(skill.id)) sbUpsertSkill(agentId, skill)
    }
  }
  for (const skill of localCommon) {
    if (!remoteSkillIds.has(skill.id)) sbUpsertSkill('common', skill)
  }
}

/** Supabase → localStorage 동기화. 앱 로드 시 호출 */
export async function syncProjectsFromSupabase(): Promise<void> {
  if (!supabase) return
  const { data, error } = await supabase
    .from('projects')
    .select('data')
    .order('created_at', { ascending: false })
  if (error) { console.error('[supabase] sync projects failed:', error.message); return }
  if (!data) return

  const allRemote: Project[] = data.map((row: { data: Project }) => row.data)
  const localProjects = getProjects()
  const localTrash = getTrashedProjects()

  // 휴지통 / 일반 분리 (deletedAt 필드 유무로 구분)
  const remoteActive: Project[] = []
  const remoteTrash: TrashedProject[] = []
  for (const p of allRemote) {
    if ((p as TrashedProject).deletedAt) remoteTrash.push(p as TrashedProject)
    else remoteActive.push(p)
  }

  // Supabase 기준으로 일반/휴지통 분류 결정 (다른 기기의 변경이 우선)
  const remoteTrashIds = new Set(remoteTrash.map(p => p.id))
  const remoteActiveIds = new Set(remoteActive.map(p => p.id))

  // 일반 프로젝트 머지: 다른 기기에서 휴지통으로 옮긴 ID는 제외
  const mergedActive = new Map<string, Project>()
  for (const p of [...localProjects, ...remoteActive]) {
    if (remoteTrashIds.has(p.id)) continue
    const existing = mergedActive.get(p.id)
    if (!existing || p.updatedAt > existing.updatedAt) mergedActive.set(p.id, p)
  }
  const sortedActive = Array.from(mergedActive.values()).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt)
  )
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(sortedActive))

  // 휴지통 머지: 다른 기기에서 복원한 ID는 제외
  const mergedTrash = new Map<string, TrashedProject>()
  for (const p of [...localTrash, ...remoteTrash]) {
    if (remoteActiveIds.has(p.id)) continue
    const existing = mergedTrash.get(p.id)
    if (!existing || p.deletedAt > existing.deletedAt) mergedTrash.set(p.id, p)
  }
  const sortedTrash = Array.from(mergedTrash.values()).sort(
    (a, b) => b.deletedAt.localeCompare(a.deletedAt)
  )
  localStorage.setItem(PROJECTS_TRASH_KEY, JSON.stringify(sortedTrash))

  // 로컬에만 있는 항목들 Supabase 업로드 (휴지통 포함)
  const remoteIds = new Set(allRemote.map(p => p.id))
  for (const p of localProjects) if (!remoteIds.has(p.id)) sbUpsertProject(p)
  for (const p of localTrash) if (!remoteIds.has(p.id)) sbUpsertProject(p)
}

// ── 프로젝트 CRUD ───────────────────────────────────────────────────────────────

export function getProjects(): Project[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PROJECTS_KEY) || '[]') as Project[]
    return raw.map(p => ({
      ...p,
      branches: p.branches ?? [],
      attachments: p.attachments ?? [],
      briefings: p.briefings ?? {},
      collaborationStatus: p.collaborationStatus,
    }))
  } catch { return [] }
}

export function saveProject(project: Project): void {
  const projects = getProjects()
  const idx = projects.findIndex(p => p.id === project.id)
  if (idx >= 0) projects[idx] = project
  else projects.unshift(project)
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
  // 백그라운드로 Supabase 동기화
  sbUpsertProject(project)
}

type TrashedProject = Project & { deletedAt: string }

export function getTrashedProjects(): TrashedProject[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PROJECTS_TRASH_KEY) || '[]') as TrashedProject[]
    return raw
  } catch { return [] }
}

function saveTrashedProjects(projects: TrashedProject[]): void {
  localStorage.setItem(PROJECTS_TRASH_KEY, JSON.stringify(projects))
}

export function moveProjectToTrash(projectId: string): void {
  const projects = getProjects()
  const target = projects.find(p => p.id === projectId)
  if (!target) return
  const nextProjects = projects.filter(p => p.id !== projectId)
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(nextProjects))

  const trashed: TrashedProject = { ...target, deletedAt: new Date().toISOString() }
  const trash = getTrashedProjects().filter(p => p.id !== projectId)
  trash.unshift(trashed)
  saveTrashedProjects(trash)
  // 휴지통도 동기화: 영구 삭제 대신 deletedAt 포함해 upsert
  sbUpsertProject(trashed)
}

export function restoreProjectFromTrash(projectId: string): void {
  const trash = getTrashedProjects()
  const target = trash.find(p => p.id === projectId)
  if (!target) return
  const nextTrash = trash.filter(p => p.id !== projectId)
  saveTrashedProjects(nextTrash)

  const restored: Project = {
    id: target.id,
    name: target.name,
    theme: target.theme,
    branches: target.branches ?? [],
    sourceDriveLink: target.sourceDriveLink,
    sourceDriveFolderId: target.sourceDriveFolderId,
    gameSystemTypes: target.gameSystemTypes,
    crimeConfig: target.crimeConfig,
    attachments: target.attachments ?? [],
    briefings: target.briefings ?? {},
    createdAt: target.createdAt,
    updatedAt: new Date().toISOString(),
    versions: target.versions ?? [],
  }
  saveProject(restored)
}

export function permanentlyDeleteProjectFromTrash(projectId: string): void {
  const nextTrash = getTrashedProjects().filter(p => p.id !== projectId)
  saveTrashedProjects(nextTrash)
  sbDeleteProject(projectId)
}

export function createProject(
  name: string,
  theme: string,
  branches: BranchCode[] = [],
  crimeConfig?: CrimeConfig,
  attachments?: SkillFile[],
  gameSystemTypes?: GameSystemType[],
  sourceDriveLink?: string,
  sourceDriveFolderId?: string,
  ownerId?: string,
  ownerName?: string,
): Project {
  const project: Project = {
    id: crypto.randomUUID(),
    name,
    theme,
    branches,
    sourceDriveLink,
    sourceDriveFolderId,
    gameSystemTypes: gameSystemTypes ?? ['escape'],
    crimeConfig,
    attachments: attachments ?? [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    versions: [],
    ownerId,
    ownerName,
  }
  saveProject(project)
  return project
}

export function createDraftVersion(projectId: string): ProjectVersion {
  const projects = getProjects()
  const project = projects.find(p => p.id === projectId)!
  const version: ProjectVersion = {
    id: crypto.randomUUID(),
    versionName: '초안',
    createdAt: new Date().toISOString(),
    agentReports: [],
    status: 'draft',
  }
  project.versions.unshift(version)
  project.updatedAt = new Date().toISOString()
  saveProject(project)
  return version
}

export function duplicateProject(project: Project): Project {
  const copy: Project = {
    ...project,
    id: crypto.randomUUID(),
    name: `${project.name} (사본)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    versions: project.versions.map(v => ({
      ...v,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString(),
    })),
  }
  saveProject(copy)
  return copy
}

export function addVersionToProject(projectId: string, versionName: string): ProjectVersion {
  const projects = getProjects()
  const project = projects.find(p => p.id === projectId)!
  const version: ProjectVersion = {
    id: crypto.randomUUID(),
    versionName,
    createdAt: new Date().toISOString(),
    agentReports: [],
    status: 'in-progress',
  }
  project.versions.push(version)
  project.updatedAt = new Date().toISOString()
  saveProject(project)
  return version
}

export function updateVersionReports(
  projectId: string,
  versionId: string,
  reports: AgentReport[],
  finalReport?: FinalReport
): void {
  const projects = getProjects()
  const project = projects.find(p => p.id === projectId)!
  const version = project.versions.find(v => v.id === versionId)!
  version.agentReports = reports
  if (finalReport) version.finalReport = finalReport
  version.status = 'completed'
  project.updatedAt = new Date().toISOString()
  saveProject(project)
}

export function updateProjectCollaborationStatus(
  projectId: string,
  status: CollaborationStatus | null,
): void {
  const projects = getProjects()
  const project = projects.find(p => p.id === projectId)
  if (!project) return
  if (status) {
    project.collaborationStatus = status
  } else {
    delete project.collaborationStatus
  }
  project.updatedAt = new Date().toISOString()
  saveProject(project)
}

// 앱 부팅 시점에 호출. 협업 러너는 in-memory 상태이므로 페이지 새로고침/탭 닫기로 죽으면
// 메모리에 남은 컨트롤러가 없는데도 localStorage 의 collaborationStatus.active 가 true 로 박혀
// 메인 화면에 "협업 진행중" 카드가 stale 하게 남는 문제를 정리한다.
export function clearStaleCollaborationStatuses(): void {
  const projects = getProjects()
  let changed = false
  for (const project of projects) {
    if (project.collaborationStatus?.active) {
      delete project.collaborationStatus
      project.updatedAt = new Date().toISOString()
      changed = true
    }
  }
  if (changed) {
    localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
  }
}

export function updateVersionGameFlow(
  projectId: string,
  versionId: string,
  gameFlow: GameFlowSheet
): void {
  const projects = getProjects()
  const project = projects.find(p => p.id === projectId)!
  const version = project.versions.find(v => v.id === versionId)!
  version.gameFlow = gameFlow
  project.updatedAt = new Date().toISOString()
  saveProject(project)
}

export function updateVersionAudioScript(
  projectId: string,
  versionId: string,
  audioScript: import('../types').AudioScript
): void {
  const projects = getProjects()
  const project = projects.find(p => p.id === projectId)!
  const version = project.versions.find(v => v.id === versionId)!
  version.audioScript = audioScript
  project.updatedAt = new Date().toISOString()
  saveProject(project)
}

export function updateAgentReportChat(
  projectId: string,
  versionId: string,
  agentId: AgentId,
  chatHistory: import('../types').ChatMessage[],
  newDetailVersion?: import('../types').DetailVersion
): void {
  const projects = getProjects()
  const project = projects.find(p => p.id === projectId)!
  const version = project.versions.find(v => v.id === versionId)!
  const reportIdx = version.agentReports.findIndex(r => r.agentId === agentId)
  if (reportIdx < 0) return
  const report = version.agentReports[reportIdx]
  report.chatHistory = chatHistory
  if (newDetailVersion) {
    const existing = report.detailVersions ?? []
    // Auto-seed original as v1 if this is the first regeneration
    if (existing.length === 0) {
      existing.push({
        id: 'original',
        summary: report.summary,
        detail: report.detail,
        createdAt: version.createdAt,
        label: '원본',
      })
    }
    existing.push(newDetailVersion)
    report.detailVersions = existing
    report.activeVersionId = newDetailVersion.id
  }
  version.agentReports[reportIdx] = report
  project.updatedAt = new Date().toISOString()
  saveProject(project)
}

export function deleteAgentReportVersion(
  projectId: string,
  versionId: string,
  agentId: AgentId,
  detailVersionId: string
): void {
  const projects = getProjects()
  const project = projects.find(p => p.id === projectId)!
  const version = project.versions.find(v => v.id === versionId)!
  const report = version.agentReports.find(r => r.agentId === agentId)
  if (!report || !report.detailVersions) return
  const remaining = report.detailVersions.filter(v => v.id !== detailVersionId)
  report.detailVersions = remaining
  if (report.activeVersionId === detailVersionId) {
    report.activeVersionId = remaining[remaining.length - 1]?.id ?? undefined
  }
  project.updatedAt = new Date().toISOString()
  saveProject(project)
}

export function setAgentReportActiveVersion(
  projectId: string,
  versionId: string,
  agentId: AgentId,
  activeVersionId: string
): void {
  const projects = getProjects()
  const project = projects.find(p => p.id === projectId)!
  const version = project.versions.find(v => v.id === versionId)!
  const report = version.agentReports.find(r => r.agentId === agentId)
  if (!report) return
  report.activeVersionId = activeVersionId
  project.updatedAt = new Date().toISOString()
  saveProject(project)
}

export function deleteProject(projectId: string): void {
  const projects = getProjects().filter(p => p.id !== projectId)
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects))
  sbDeleteProject(projectId)
}

// 스킬 파일 관리
export function getAgentSkills(agentId: AgentId): SkillFile[] {
  try {
    const all = JSON.parse(localStorage.getItem(SKILLS_KEY) || '{}')
    return all[agentId] || []
  } catch { return [] }
}

export function saveAgentSkill(agentId: AgentId, skill: SkillFile): void {
  try {
    const all = JSON.parse(localStorage.getItem(SKILLS_KEY) || '{}')
    if (!all[agentId]) all[agentId] = []
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { base64, url, ...meta } = skill
    all[agentId].push(meta)
    localStorage.setItem(SKILLS_KEY, JSON.stringify(all))
    sbUpsertSkill(agentId, skill)
  } catch (e) { console.error(e) }
}

export function removeAgentSkill(agentId: AgentId, skillId: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(SKILLS_KEY) || '{}')
    if (all[agentId]) all[agentId] = all[agentId].filter((s: SkillFile) => s.id !== skillId)
    localStorage.setItem(SKILLS_KEY, JSON.stringify(all))
    sbDeleteSkill(skillId)
  } catch (e) { console.error(e) }
}

export function getAllSkills(): Record<AgentId, SkillFile[]> {
  try {
    return JSON.parse(localStorage.getItem(SKILLS_KEY) || '{}')
  } catch { return {} as Record<AgentId, SkillFile[]> }
}

export function updateProjectBriefing(
  projectId: string,
  agentId: AgentId,
  messages: ChatMessage[],
  complete?: boolean,
): void {
  const projects = getProjects()
  const project = projects.find(p => p.id === projectId)
  if (!project) return
  if (!project.briefings) project.briefings = {}
  project.briefings[agentId] = {
    messages,
    completedAt: complete
      ? new Date().toISOString()
      : project.briefings[agentId]?.completedAt,
  }
  project.updatedAt = new Date().toISOString()
  saveProject(project)
}

export function saveGroupBriefing(
  projectId: string,
  agentIds: AgentId[],
  messages: ChatMessage[],
): void {
  const projects = getProjects()
  const project = projects.find(p => p.id === projectId)
  if (!project) return
  if (!project.briefings) project.briefings = {}
  const briefingData = { messages, completedAt: undefined as string | undefined }
  agentIds.forEach(id => { project.briefings![id] = briefingData })
  project.updatedAt = new Date().toISOString()
  saveProject(project)
}

export function completeGroupBriefing(
  projectId: string,
  agentIds: AgentId[],
  messages: ChatMessage[],
  minutes: MeetingMinutes,
): void {
  const projects = getProjects()
  const project = projects.find(p => p.id === projectId)
  if (!project) return
  if (!project.briefings) project.briefings = {}
  const completedAt = new Date().toISOString()
  agentIds.forEach(id => {
    project.briefings![id] = { messages, completedAt }
  })
  if (!project.meetingMinutes) project.meetingMinutes = []
  project.meetingMinutes.push(minutes)
  project.updatedAt = completedAt
  saveProject(project)
}

// 공통 스킬 관리
export function getCommonSkills(): SkillFile[] {
  try { return JSON.parse(localStorage.getItem(COMMON_SKILLS_KEY) || '[]') } catch { return [] }
}

export function saveCommonSkill(skill: SkillFile): void {
  try {
    const all = getCommonSkills()
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { base64, url, ...meta } = skill
    all.push(meta)
    localStorage.setItem(COMMON_SKILLS_KEY, JSON.stringify(all))
    sbUpsertSkill('common', skill)
  } catch (e) { console.error(e) }
}

export function removeCommonSkill(skillId: string): void {
  try {
    localStorage.setItem(COMMON_SKILLS_KEY, JSON.stringify(
      getCommonSkills().filter(s => s.id !== skillId)
    ))
    sbDeleteSkill(skillId)
  } catch (e) { console.error(e) }
}

export function updateCommonSkillKnowledge(skillId: string, summary: string): void {
  try {
    const skills = getCommonSkills()
    const idx = skills.findIndex(s => s.id === skillId)
    if (idx >= 0) skills[idx] = { ...skills[idx], knowledgeSummary: summary }
    localStorage.setItem(COMMON_SKILLS_KEY, JSON.stringify(skills))
  } catch (e) { console.error(e) }
}

export function patchCommonSkill(skillId: string, updates: Partial<import('../types').SkillFile>): void {
  try {
    const skills = getCommonSkills()
    const idx = skills.findIndex(s => s.id === skillId)
    if (idx >= 0) skills[idx] = { ...skills[idx], ...updates }
    localStorage.setItem(COMMON_SKILLS_KEY, JSON.stringify(skills))
  } catch (e) { console.error(e) }
}

export function patchAgentSkill(agentId: AgentId, skillId: string, updates: Partial<import('../types').SkillFile>): void {
  try {
    const all = JSON.parse(localStorage.getItem(SKILLS_KEY) || '{}')
    const skills: import('../types').SkillFile[] = all[agentId] || []
    const idx = skills.findIndex(s => s.id === skillId)
    if (idx >= 0) skills[idx] = { ...skills[idx], ...updates }
    all[agentId] = skills
    localStorage.setItem(SKILLS_KEY, JSON.stringify(all))
  } catch (e) { console.error(e) }
}

export function updateSkillKnowledge(agentId: AgentId, skillId: string, summary: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(SKILLS_KEY) || '{}')
    const skills: SkillFile[] = all[agentId] || []
    const idx = skills.findIndex((s: SkillFile) => s.id === skillId)
    if (idx >= 0) skills[idx] = { ...skills[idx], knowledgeSummary: summary }
    all[agentId] = skills
    localStorage.setItem(SKILLS_KEY, JSON.stringify(all))
  } catch (e) { console.error(e) }
}

// ── 회의실 (Workshop) ──────────────────────────────────────────────────────────

export function getWorkshopSessions(projectId: string, versionId: string): WorkshopSession[] {
  const project = getProjects().find(p => p.id === projectId)
  if (!project) return []
  const version = project.versions.find(v => v.id === versionId)
  if (!version) return []
  return version.workshopSessions ?? []
}

export function saveWorkshopSession(projectId: string, versionId: string, session: WorkshopSession): void {
  const projects = getProjects()
  const project = projects.find(p => p.id === projectId)
  if (!project) return
  const version = project.versions.find(v => v.id === versionId)
  if (!version) return
  if (!version.workshopSessions) version.workshopSessions = []
  const idx = version.workshopSessions.findIndex(s => s.id === session.id)
  if (idx >= 0) version.workshopSessions[idx] = session
  else version.workshopSessions.push(session)
  project.updatedAt = new Date().toISOString()
  saveProject(project)
}
