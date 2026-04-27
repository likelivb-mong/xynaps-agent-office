import { AGENTS } from '../data/agents'
import { addVersionToProject, getAllSkills, getCommonSkills, getProjects, updateProjectCollaborationStatus, updateVersionReports } from './storage'
import { runFinalReport, runProjectCollaboration } from './api'
import type { AgentId, AgentReport, FinalReport, Project, ProjectVersion } from '../types'

// Tracks in-flight single-agent refresh jobs: key = `${projectId}:${agentId}`
const singleAgentJobs = new Map<string, Promise<void>>()
// 단일 에이전트 재실행을 사용자가 작업 중지 버튼으로 취소할 수 있도록 controller도 같이 추적.
const singleAgentControllers = new Map<string, AbortController>()

export interface CollaborationSnapshot {
  projectId: string
  versionId: string
  versionName: string
  startedAt: string
  running: boolean
  generatingFinal: boolean
  runningAgentId: AgentId | null
  reports: AgentReport[]
  finalReport: FinalReport | null
  error?: string | null
  logs: Array<{
    id: string
    at: string
    level: 'info' | 'success' | 'warning' | 'error'
    message: string
  }>
}

type SnapshotListener = (snapshot: CollaborationSnapshot) => void
type RerunMode = 'full' | 'from-agent'

const snapshots = new Map<string, CollaborationSnapshot>()
const listeners = new Map<string, Set<SnapshotListener>>()
const activeJobs = new Map<string, Promise<void>>()
const activeControllers = new Map<string, AbortController>()

function notify(projectId: string) {
  const snapshot = snapshots.get(projectId)
  if (!snapshot) return
  listeners.get(projectId)?.forEach(listener => listener(snapshot))
}

function setSnapshot(projectId: string, next: CollaborationSnapshot) {
  snapshots.set(projectId, next)
  notify(projectId)
}

function appendLog(projectId: string, entry: CollaborationSnapshot['logs'][number]) {
  const current = snapshots.get(projectId)
  if (!current) return
  setSnapshot(projectId, {
    ...current,
    logs: [entry, ...current.logs].slice(0, 24),
  })
}

function buildActiveAgentIds(project: Project): AgentId[] {
  const gameSystemTypes = project.gameSystemTypes ?? ['escape']
  const base: AgentId[] = ['ceo', 'concept', 'pd', 'puzzle', 'space', 'ops']
  const extra: AgentId[] = []
  if (gameSystemTypes.includes('surround')) extra.push('sound')
  if (gameSystemTypes.includes('crimescene')) extra.push('xfiler')
  return [...base, ...extra]
}

function parseReportResult(result: string, fallbackAgentName: string): Pick<AgentReport, 'summary' | 'detail'> {
  return {
    summary: result.match(/\[요약\]([\s\S]*?)(?=\[상세\]|$)/)?.[1]?.trim() || result.slice(0, 200) || `${fallbackAgentName} 보고서`,
    detail: result.match(/\[상세\]([\s\S]*)$/)?.[1]?.trim() || result,
  }
}

function isFailedReport(report: AgentReport): boolean {
  return (report.summary ?? '').includes('오류')
}

function resolveVersion(project: Project, versionId?: string | null): ProjectVersion | null {
  if (!versionId) return null
  return project.versions.find(version => version.id === versionId) ?? null
}

function createInitialReports(project: Project): AgentReport[] {
  const activeAgentIds = buildActiveAgentIds(project)
  return AGENTS
    .filter(agent => activeAgentIds.includes(agent.id))
    .map(agent => ({
      agentId: agent.id,
      agentName: agent.name,
      summary: '',
      detail: '',
      status: 'pending',
    }))
}

function createReportsForRerun(baseReports: AgentReport[], agentOrder: AgentId[], mode: RerunMode, startAgentId?: AgentId): AgentReport[] {
  if (mode === 'full') {
    return baseReports.map(report => ({ ...report, summary: '', detail: '', status: 'pending' as const }))
  }
  const startIndex = Math.max(0, agentOrder.indexOf(startAgentId ?? agentOrder[0]))
  return baseReports.map(report => {
    const idx = agentOrder.indexOf(report.agentId)
    if (idx < startIndex) return { ...report, status: 'done' as const }
    return { ...report, summary: idx === startIndex ? '' : '', detail: '', status: 'pending' as const }
  })
}

function normalizeReports(reports: AgentReport[]): AgentReport[] {
  return reports.map(report => ({ ...report, status: 'done' as const }))
}

// function getStartedAt(snapshot?: CollaborationSnapshot | null) {
//   return snapshot?.startedAt ?? new Date().toISOString()
// }

function runJob(project: Project, version: ProjectVersion, mode: RerunMode, startAgentId?: AgentId) {
  const abortController = new AbortController()
  activeControllers.set(project.id, abortController)
  const startedAt = new Date().toISOString()
  const agentOrder = buildActiveAgentIds(project)
  const previousReports = version.agentReports?.length ? version.agentReports : createInitialReports(project)
  const seedReports = mode === 'from-agent'
    ? previousReports.filter(report => agentOrder.indexOf(report.agentId) < agentOrder.indexOf(startAgentId ?? agentOrder[0]))
    : []
  const activeReports = createReportsForRerun(previousReports, agentOrder, mode, startAgentId)

  setSnapshot(project.id, {
    projectId: project.id,
    versionId: version.id,
    versionName: version.versionName,
    startedAt,
    running: true,
    generatingFinal: false,
    runningAgentId: null,
    reports: activeReports,
    finalReport: mode === 'full' ? null : (version.finalReport ?? null),
    error: null,
    logs: [{
      id: crypto.randomUUID(),
      at: startedAt,
      level: 'info',
      message: mode === 'full'
        ? `${version.versionName} 협업 실행을 시작했습니다.`
        : `${version.versionName}에서 ${startAgentId ?? '선택한 에이전트'}부터 재실행합니다.`,
    }],
  })

  updateProjectCollaborationStatus(project.id, {
    active: true,
    startedAt,
    phase: 'running',
    completedAgentIds: seedReports.map(report => report.agentId),
    versionId: version.id,
    versionName: version.versionName,
  })

  const job = (async () => {
    let completedAgentIds: AgentId[] = seedReports.map(report => report.agentId)
    try {
      const freshProject = getProjects().find(item => item.id === project.id)
      if (!freshProject) throw new Error('프로젝트를 다시 불러오지 못했습니다.')
      const allSkills = getAllSkills()
      const reports = await runProjectCollaboration(
        freshProject.name,
        freshProject.theme,
        allSkills,
        (agentId, status, result) => {
          const current = snapshots.get(project.id)
          if (!current) return
          if (status === 'running') {
            setSnapshot(project.id, {
              ...current,
              runningAgentId: agentId,
              error: null,
            })
            appendLog(project.id, {
              id: crypto.randomUUID(),
              at: new Date().toISOString(),
              level: 'info',
              message: `${AGENTS.find(agent => agent.id === agentId)?.name ?? agentId} 작업 시작`,
            })
            updateProjectCollaborationStatus(project.id, {
              active: true,
              startedAt,
              phase: 'running',
              currentAgentId: agentId,
              completedAgentIds,
              versionId: version.id,
              versionName: version.versionName,
            })
            return
          }

          if (status === 'streaming') {
            setSnapshot(project.id, {
              ...current,
              reports: current.reports.map(r =>
                r.agentId === agentId ? { ...r, detail: result ?? '' } : r
              ),
            })
            return
          }

          const targetAgent = AGENTS.find(agent => agent.id === agentId)
          const parsed = result ? parseReportResult(result, targetAgent?.name ?? agentId) : null
          const nextReports = current.reports.map(report =>
            report.agentId === agentId
              ? {
                ...report,
                summary: parsed?.summary ?? report.summary,
                detail: parsed?.detail ?? report.detail,
                status: 'done' as const,
              }
              : report
          )
          completedAgentIds = completedAgentIds.includes(agentId) ? completedAgentIds : [...completedAgentIds, agentId]
          setSnapshot(project.id, {
            ...current,
            runningAgentId: null,
            reports: nextReports,
          })
          // Persist incrementally so completed results survive errors mid-run
          const doneReports = nextReports.filter(r => r.status === 'done' && r.summary)
          if (doneReports.length > 0) updateVersionReports(project.id, version.id, doneReports)
          const failed = !parsed || parsed.summary.includes('오류')
          appendLog(project.id, {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            level: failed ? 'error' : 'success',
            message: failed
              ? `${targetAgent?.name ?? agentId} 작업 실패`
              : `${targetAgent?.name ?? agentId} 작업 완료`,
          })
          updateProjectCollaborationStatus(project.id, {
            active: true,
            startedAt,
            phase: 'running',
            completedAgentIds,
            versionId: version.id,
            versionName: version.versionName,
          })
        },
        freshProject.crimeConfig,
        freshProject.attachments,
        freshProject.gameSystemTypes ?? ['escape'],
        freshProject.briefings,
        getCommonSkills(),
        {
          startFromAgentId: mode === 'from-agent' ? startAgentId : undefined,
          seedReports,
          signal: abortController.signal,
          timeoutMs: 660000,
        },
      )

      const normalizedReports = normalizeReports(reports)
      const current = snapshots.get(project.id)
      setSnapshot(project.id, {
        ...(current ?? {
          projectId: project.id,
          versionId: version.id,
          versionName: version.versionName,
          startedAt,
          running: false,
          generatingFinal: false,
          runningAgentId: null,
          reports: normalizedReports,
          finalReport: null,
          error: null,
          logs: [],
        }),
        running: false,
        runningAgentId: null,
        reports: normalizedReports,
      })
      appendLog(project.id, {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        level: 'info',
        message: '에이전트 보고서 생성이 완료되어 최종 종합을 시작합니다.',
      })
      updateVersionReports(project.id, version.id, normalizedReports)

      updateProjectCollaborationStatus(project.id, {
        active: true,
        startedAt,
        phase: 'finalizing',
        completedAgentIds,
        versionId: version.id,
        versionName: version.versionName,
      })

      const beforeFinal = snapshots.get(project.id)
      if (beforeFinal) {
        setSnapshot(project.id, {
          ...beforeFinal,
          running: false,
          generatingFinal: true,
          runningAgentId: null,
        })
      }

      try {
        const ceoAgent = AGENTS.find(agent => agent.id === 'ceo')!
        const final = await runFinalReport(freshProject.name, normalizedReports, { ...ceoAgent, skills: getAllSkills().ceo || [] }, {
          signal: abortController.signal,
          timeoutMs: 90000,
        })
        const finalReport: FinalReport = { ...final, createdAt: new Date().toISOString() }
        updateVersionReports(project.id, version.id, normalizedReports, finalReport)
        const afterFinal = snapshots.get(project.id)
        if (afterFinal) {
          setSnapshot(project.id, {
            ...afterFinal,
            generatingFinal: false,
            finalReport,
            error: null,
          })
        }
        appendLog(project.id, {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          level: 'success',
          message: '최종 보고서 종합이 완료되었습니다.',
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        const fallbackFinal: FinalReport = {
          summary: '최종 보고서 생성 중 오류가 발생했습니다',
          detail: `에이전트별 보고서는 저장되었지만 최종 종합 단계에서 오류가 발생했습니다.\n\n원인:\n${message}`,
          createdAt: new Date().toISOString(),
        }
        updateVersionReports(project.id, version.id, normalizedReports, fallbackFinal)
        const afterFinal = snapshots.get(project.id)
        if (afterFinal) {
          setSnapshot(project.id, {
            ...afterFinal,
            generatingFinal: false,
            finalReport: fallbackFinal,
            error: message,
          })
        }
        appendLog(project.id, {
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          level: message.includes('시간 초과') ? 'warning' : 'error',
          message: `최종 보고서 종합 실패: ${message}`,
        })
      } finally {
        updateProjectCollaborationStatus(project.id, null)
        activeControllers.delete(project.id)
        activeJobs.delete(project.id)
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const current = snapshots.get(project.id)
      const fallbackReports = current?.reports?.length
        ? current.reports.map((report, index) => index === 0 ? {
          ...report,
          summary: report.summary || '협업 실행 중 오류가 발생했습니다',
          detail: report.detail || message,
          status: 'done' as const,
        } : report)
        : []
      const fallbackFinal: FinalReport = {
        summary: message.includes('중지') ? '협업이 중지되었습니다' : '협업 실행 실패',
        detail: message.includes('중지')
          ? '사용자 요청 또는 시간 초과로 협업 작업이 중지되었습니다.\n\n필요하면 전체 재실행 또는 이 에이전트부터 재실행을 눌러 다시 시작해주세요.'
          : `협업 실행 도중 오류가 발생했습니다.\n\n${message}`,
        createdAt: new Date().toISOString(),
      }
      const fallbackLogLevel: 'warning' | 'error' =
        (message.includes('시간 초과') || message.includes('중지')) ? 'warning' : 'error'
      updateVersionReports(project.id, version.id, fallbackReports, fallbackFinal)
      setSnapshot(project.id, {
        projectId: project.id,
        versionId: version.id,
        versionName: version.versionName,
        startedAt,
        running: false,
        generatingFinal: false,
        runningAgentId: null,
        reports: fallbackReports,
        finalReport: fallbackFinal,
        error: message,
        logs: [{
          id: crypto.randomUUID(),
          at: new Date().toISOString(),
          level: fallbackLogLevel,
          message: message.includes('중지')
            ? '협업 작업이 중지되었습니다.'
            : `협업 실행 실패: ${message}`,
        }, ...(current?.logs ?? [])].slice(0, 24),
      })
      updateProjectCollaborationStatus(project.id, null)
      activeControllers.delete(project.id)
      activeJobs.delete(project.id)
    }
  })()

  activeJobs.set(project.id, job)
}

export function getCollaborationSnapshot(projectId: string): CollaborationSnapshot | null {
  return snapshots.get(projectId) ?? null
}

export function subscribeCollaboration(projectId: string, listener: SnapshotListener) {
  const set = listeners.get(projectId) ?? new Set<SnapshotListener>()
  set.add(listener)
  listeners.set(projectId, set)
  const snapshot = snapshots.get(projectId)
  if (snapshot) listener(snapshot)
  return () => {
    const current = listeners.get(projectId)
    if (!current) return
    current.delete(listener)
    if (current.size === 0) listeners.delete(projectId)
  }
}

export function startCollaborationRunner(projectId: string): { versionId: string; versionName: string; alreadyRunning: boolean } {
  const runningSnapshot = snapshots.get(projectId)
  if (runningSnapshot && activeJobs.has(projectId)) {
    return { versionId: runningSnapshot.versionId, versionName: runningSnapshot.versionName, alreadyRunning: true }
  }
  const project = getProjects().find(item => item.id === projectId)
  if (!project) throw new Error('프로젝트를 찾을 수 없습니다.')
  const versionName = `v${project.versions.length + 1}.0`
  const version = addVersionToProject(project.id, versionName)
  const refreshedProject = getProjects().find(item => item.id === projectId) ?? project
  runJob(refreshedProject, version, 'full')
  return { versionId: version.id, versionName, alreadyRunning: false }
}

export function rerunEntireCollaboration(projectId: string, versionId: string): { versionId: string; versionName: string; alreadyRunning: boolean } {
  const runningSnapshot = snapshots.get(projectId)
  if (runningSnapshot && activeJobs.has(projectId)) {
    return { versionId: runningSnapshot.versionId, versionName: runningSnapshot.versionName, alreadyRunning: true }
  }
  const project = getProjects().find(item => item.id === projectId)
  const version = project ? resolveVersion(project, versionId) : null
  if (!project || !version) throw new Error('재실행할 버전을 찾을 수 없습니다.')
  runJob(project, version, 'full')
  return { versionId: version.id, versionName: version.versionName, alreadyRunning: false }
}

export function rerunFromAgent(projectId: string, versionId: string, agentId: AgentId): { versionId: string; versionName: string; alreadyRunning: boolean } {
  const runningSnapshot = snapshots.get(projectId)
  if (runningSnapshot && activeJobs.has(projectId)) {
    return { versionId: runningSnapshot.versionId, versionName: runningSnapshot.versionName, alreadyRunning: true }
  }
  const project = getProjects().find(item => item.id === projectId)
  const version = project ? resolveVersion(project, versionId) : null
  if (!project || !version) throw new Error('재실행할 버전을 찾을 수 없습니다.')
  runJob(project, version, 'from-agent', agentId)
  return { versionId: version.id, versionName: version.versionName, alreadyRunning: false }
}

export function rerunFinalReportOnly(projectId: string, versionId: string): { alreadyRunning: boolean } {
  const runningSnapshot = snapshots.get(projectId)
  if (runningSnapshot && activeJobs.has(projectId)) return { alreadyRunning: true }

  const project = getProjects().find(item => item.id === projectId)
  const version = project ? resolveVersion(project, versionId) : null
  if (!project || !version) throw new Error('버전을 찾을 수 없습니다.')

  const abortController = new AbortController()
  activeControllers.set(projectId, abortController)
  const startedAt = new Date().toISOString()
  const existingReports = version.agentReports ?? []

  const current = snapshots.get(projectId)
  setSnapshot(projectId, {
    projectId,
    versionId: version.id,
    versionName: version.versionName,
    startedAt,
    running: false,
    generatingFinal: true,
    runningAgentId: null,
    reports: existingReports,
    finalReport: null,
    error: null,
    logs: [
      { id: crypto.randomUUID(), at: startedAt, level: 'info', message: '최종 보고서만 재시도합니다.' },
      ...(current?.logs ?? []),
    ],
  })

  updateProjectCollaborationStatus(projectId, {
    active: true,
    startedAt,
    phase: 'finalizing',
    completedAgentIds: existingReports.map(r => r.agentId),
    versionId: version.id,
    versionName: version.versionName,
  })

  const job = (async () => {
    try {
      const ceoAgent = AGENTS.find(a => a.id === 'ceo')!
      const final = await runFinalReport(project.name, existingReports, { ...ceoAgent, skills: getAllSkills().ceo || [] }, {
        signal: abortController.signal,
        timeoutMs: 90000,
      })
      const finalReport: FinalReport = { ...final, createdAt: new Date().toISOString() }
      updateVersionReports(projectId, version.id, existingReports, finalReport)
      const after = snapshots.get(projectId)
      if (after) setSnapshot(projectId, { ...after, generatingFinal: false, finalReport, error: null })
      appendLog(projectId, { id: crypto.randomUUID(), at: new Date().toISOString(), level: 'success', message: '최종 보고서 종합이 완료되었습니다.' })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const fallbackFinal: FinalReport = {
        summary: '최종 보고서 생성 중 오류가 발생했습니다',
        detail: `에이전트별 보고서는 저장되었지만 최종 종합 단계에서 오류가 발생했습니다.\n\n원인:\n${message}`,
        createdAt: new Date().toISOString(),
      }
      updateVersionReports(projectId, version.id, existingReports, fallbackFinal)
      const after = snapshots.get(projectId)
      if (after) setSnapshot(projectId, { ...after, generatingFinal: false, finalReport: fallbackFinal, error: message })
      appendLog(projectId, { id: crypto.randomUUID(), at: new Date().toISOString(), level: 'error', message: `최종 보고서 종합 실패: ${message}` })
    } finally {
      updateProjectCollaborationStatus(projectId, null)
      activeControllers.delete(projectId)
      activeJobs.delete(projectId)
    }
  })()

  activeJobs.set(projectId, job)
  return { alreadyRunning: false }
}

export function cancelCollaborationRunner(projectId: string): boolean {
  let cancelled = false
  // 전체 협업 controller
  const controller = activeControllers.get(projectId)
  if (controller) {
    controller.abort()
    cancelled = true
  }
  // 진행 중인 모든 단일 에이전트 재실행 controller도 취소
  for (const [key, ctrl] of singleAgentControllers.entries()) {
    if (key.startsWith(`${projectId}:`)) {
      ctrl.abort()
      cancelled = true
    }
  }
  return cancelled
}

export function hasFailedReports(reports: AgentReport[]): boolean {
  return reports.some(isFailedReport)
}

export function isFailedAgentReport(report: AgentReport): boolean {
  return isFailedReport(report)
}

export function isSingleAgentRunning(projectId: string, agentId: AgentId): boolean {
  return singleAgentJobs.has(`${projectId}:${agentId}`)
}

export function rerunSingleAgent(projectId: string, versionId: string, agentId: AgentId): { alreadyRunning: boolean } {
  const jobKey = `${projectId}:${agentId}`
  if (singleAgentJobs.has(jobKey)) return { alreadyRunning: true }
  // Don't allow if a full collaboration job is already running for this project
  if (activeJobs.has(projectId)) return { alreadyRunning: true }

  const project = getProjects().find(item => item.id === projectId)
  const version = project ? resolveVersion(project, versionId) : null
  if (!project || !version) throw new Error('버전을 찾을 수 없습니다.')

  const agentOrder = buildActiveAgentIds(project)
  const agentIndex = agentOrder.indexOf(agentId)
  const existingReports: AgentReport[] = version.agentReports ?? []

  // Seed reports = all agents that ran before this one (keep their results for context)
  const seedReports = existingReports.filter(r => agentOrder.indexOf(r.agentId) < agentIndex)

  // 단일 에이전트 재실행도 작업 중지 버튼으로 취소할 수 있도록 controller 등록
  const abortController = new AbortController()
  singleAgentControllers.set(jobKey, abortController)

  // Update snapshot: mark only this agent as running
  // activeVersionId 도 리셋해 옛 버전(과거 에러·이전 편집)이 화면에 남는 문제 차단
  const current = snapshots.get(projectId)
  const baseReports = existingReports.length
    ? existingReports.map(r =>
        r.agentId === agentId ? { ...r, status: 'pending' as const, summary: '', detail: '', activeVersionId: undefined } : r
      )
    : agentOrder.map(id => {
        const existing = existingReports.find(r => r.agentId === id)
        if (existing) return existing
        const def = AGENTS.find(a => a.id === id)!
        return { agentId: id, agentName: def.name, summary: '', detail: '', status: 'pending' as const }
      })

  const startedAt = new Date().toISOString()
  setSnapshot(projectId, {
    projectId,
    versionId: version.id,
    versionName: version.versionName,
    startedAt: current?.startedAt ?? startedAt,
    running: false,
    generatingFinal: false,
    runningAgentId: agentId,
    reports: baseReports,
    finalReport: current?.finalReport ?? version.finalReport ?? null,
    error: null,
    logs: [
      { id: crypto.randomUUID(), at: startedAt, level: 'info' as const, message: `${AGENTS.find(a => a.id === agentId)?.name ?? agentId} 단독 재실행을 시작합니다.` },
      ...(current?.logs ?? []),
    ].slice(0, 24),
  })

  const job = (async () => {
    try {
      const freshProject = getProjects().find(item => item.id === projectId)
      if (!freshProject) throw new Error('프로젝트를 다시 불러오지 못했습니다.')

      const allSkills = getAllSkills()
      const commonSkills = getCommonSkills()

      // Run collaboration for just this one agent (startFromAgentId = agentId, seedReports = prior agents)
      // We pass the full existing reports as seed but tell the runner to start from agentId
      const updatedReports = await runProjectCollaboration(
        freshProject.name,
        freshProject.theme,
        allSkills,
        (progressAgentId, status, result) => {
          const snap = snapshots.get(projectId)
          if (!snap) return
          if (status === 'running') {
            setSnapshot(projectId, { ...snap, runningAgentId: progressAgentId })
            return
          }
          if (status === 'streaming') {
            setSnapshot(projectId, {
              ...snap,
              reports: snap.reports.map(r =>
                r.agentId === progressAgentId ? { ...r, detail: result ?? '' } : r
              ),
            })
            return
          }
          const agentDef = AGENTS.find(a => a.id === progressAgentId)
          const parsed = result ? parseReportResult(result, agentDef?.name ?? progressAgentId) : null
          const nextReports = snap.reports.map(r =>
            r.agentId === progressAgentId
              ? { ...r, summary: parsed?.summary ?? r.summary, detail: parsed?.detail ?? r.detail, status: 'done' as const }
              : r
          )
          const failed = !parsed || parsed.summary.includes('오류')
          setSnapshot(projectId, { ...snap, runningAgentId: null, reports: nextReports })
          appendLog(projectId, {
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            level: failed ? 'error' : 'success',
            message: failed
              ? `${agentDef?.name ?? progressAgentId} 재실행 실패`
              : `${agentDef?.name ?? progressAgentId} 재실행 완료`,
          })
        },
        freshProject.crimeConfig,
        freshProject.attachments,
        freshProject.gameSystemTypes ?? ['escape'],
        freshProject.briefings,
        commonSkills,
        {
          startFromAgentId: agentId,
          endAtAgentId: agentId,
          seedReports,
          signal: abortController.signal,
        },
      )

      // Merge the refreshed agent result back into the full report list.
      // 기존 detailVersions / chatHistory / feedback 은 보존 (재실행으로 사용자 편집·채팅 기록 손실 방지).
      // activeVersionId 는 새 결과를 보여주기 위해 undefined 로 리셋.
      const refreshedAgent = updatedReports.find(r => r.agentId === agentId)
      if (refreshedAgent) {
        const existing = existingReports.find(r => r.agentId === agentId)
        const refreshedWithHistory: AgentReport = {
          ...refreshedAgent,
          detailVersions: existing?.detailVersions,
          activeVersionId: undefined,
          chatHistory: existing?.chatHistory,
          feedback: existing?.feedback,
        }
        const mergedReports = existingReports.map(r => r.agentId === agentId ? refreshedWithHistory : r)
        if (!existingReports.find(r => r.agentId === agentId)) mergedReports.push(refreshedWithHistory)
        updateVersionReports(projectId, version.id, mergedReports, version.finalReport ?? undefined)

        const afterSnap = snapshots.get(projectId)
        if (afterSnap) {
          setSnapshot(projectId, {
            ...afterSnap,
            runningAgentId: null,
            reports: afterSnap.reports.map(r => r.agentId === agentId ? refreshedWithHistory : r),
          })
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      const agentDef = AGENTS.find(a => a.id === agentId)
      const isAbort = abortController.signal.aborted || /aborted|중지|중단/i.test(message)
      // 사용자가 작업 중지를 누른 경우와 일반 에러를 구분.
      // 기존 detailVersions / chatHistory 는 에러 시에도 보존 — 재실행 실패가 사용자 편집을 날리지 않도록.
      const existing = existingReports.find(r => r.agentId === agentId)
      const errorReport: AgentReport = {
        agentId,
        agentName: agentDef?.name ?? agentId,
        summary: isAbort ? '재실행이 중지되었습니다' : '재실행 중 오류가 발생했습니다',
        detail: isAbort ? '사용자 요청으로 재실행이 중지되었습니다. 다시 시도하거나 그대로 두셔도 됩니다.' : message,
        status: 'done',
        detailVersions: existing?.detailVersions,
        activeVersionId: undefined,
        chatHistory: existing?.chatHistory,
        feedback: existing?.feedback,
      }
      const mergedReports = existingReports.map(r => r.agentId === agentId ? errorReport : r)
      if (!existingReports.find(r => r.agentId === agentId)) mergedReports.push(errorReport)
      updateVersionReports(projectId, version.id, mergedReports, version.finalReport ?? undefined)
      const afterSnap = snapshots.get(projectId)
      if (afterSnap) {
        setSnapshot(projectId, {
          ...afterSnap,
          runningAgentId: null,
          reports: afterSnap.reports.map(r => r.agentId === agentId ? errorReport : r),
          error: isAbort ? null : message,
        })
      }
      appendLog(projectId, {
        id: crypto.randomUUID(),
        at: new Date().toISOString(),
        level: isAbort ? 'warning' : 'error',
        message: isAbort
          ? `${agentDef?.name ?? agentId} 재실행 중지됨`
          : `${agentDef?.name ?? agentId} 재실행 실패: ${message}`,
      })
    } finally {
      singleAgentJobs.delete(jobKey)
      singleAgentControllers.delete(jobKey)
    }
  })()

  singleAgentJobs.set(jobKey, job)
  return { alreadyRunning: false }
}
