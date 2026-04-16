import type { Project, ProjectVersion, AgentReport, FinalReport, SkillFile, AgentId, BranchCode, CrimeConfig, GameFlowSheet, GameSystemType, ChatMessage, CollaborationStatus, WorkshopSession } from '../types'
import { supabase } from './supabase'

const PROJECTS_KEY = 'xynaps_v2_projects'
const PROJECTS_TRASH_KEY = 'xynaps_v2_projects_trash'
const SKILLS_KEY = 'xynaps_v2_skills'
const COMMON_SKILLS_KEY = 'xynaps_v2_common_skills'

// ── Supabase 동기화 ────────────────────────────────────────────────────────────

async function sbUpsertProject(project: Project): Promise<void> {
  await supabase.from('projects').upsert({
    id: project.id,
    data: project,
    owner_id: project.ownerId ?? null,
    owner_name: project.ownerName ?? null,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  })
}

async function sbDeleteProject(projectId: string): Promise<void> {
  await supabase.from('projects').delete().eq('id', projectId)
}

/** Supabase → localStorage 동기화. 앱 로드 시 호출 */
export async function syncProjectsFromSupabase(): Promise<void> {
  const { data, error } = await supabase
    .from('projects')
    .select('data')
    .order('created_at', { ascending: false })
  if (error || !data) return

  const remoteProjects: Project[] = data.map((row: { data: Project }) => row.data)
  const localProjects = getProjects()

  // updatedAt 기준으로 최신 버전 유지
  const merged = new Map<string, Project>()
  for (const p of [...localProjects, ...remoteProjects]) {
    const existing = merged.get(p.id)
    if (!existing || p.updatedAt > existing.updatedAt) {
      merged.set(p.id, p)
    }
  }

  const sorted = Array.from(merged.values()).sort(
    (a, b) => b.createdAt.localeCompare(a.createdAt)
  )
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(sorted))

  // 로컬에만 있는 프로젝트 Supabase에 업로드
  const remoteIds = new Set(remoteProjects.map(p => p.id))
  for (const p of localProjects) {
    if (!remoteIds.has(p.id)) {
      sbUpsertProject(p)
    }
  }
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

  const trash = getTrashedProjects().filter(p => p.id !== projectId)
  trash.unshift({ ...target, deletedAt: new Date().toISOString() })
  saveTrashedProjects(trash)
  sbDeleteProject(projectId)
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
    all[agentId].push(skill)
    localStorage.setItem(SKILLS_KEY, JSON.stringify(all))
  } catch (e) { console.error(e) }
}

export function removeAgentSkill(agentId: AgentId, skillId: string): void {
  try {
    const all = JSON.parse(localStorage.getItem(SKILLS_KEY) || '{}')
    if (all[agentId]) all[agentId] = all[agentId].filter((s: SkillFile) => s.id !== skillId)
    localStorage.setItem(SKILLS_KEY, JSON.stringify(all))
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

// 공통 스킬 관리
export function getCommonSkills(): SkillFile[] {
  try { return JSON.parse(localStorage.getItem(COMMON_SKILLS_KEY) || '[]') } catch { return [] }
}

export function saveCommonSkill(skill: SkillFile): void {
  try {
    const all = getCommonSkills()
    all.push(skill)
    localStorage.setItem(COMMON_SKILLS_KEY, JSON.stringify(all))
  } catch (e) { console.error(e) }
}

export function removeCommonSkill(skillId: string): void {
  try {
    localStorage.setItem(COMMON_SKILLS_KEY, JSON.stringify(
      getCommonSkills().filter(s => s.id !== skillId)
    ))
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
