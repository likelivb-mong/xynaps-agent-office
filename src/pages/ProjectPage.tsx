import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Spinner, DownloadIcon, RefreshIcon, EyeIcon, ListIcon, AgentIconCeo, SaveDiskIcon, CheckIcon, HistoryIcon, WriteIcon } from '../components/ui/Icon'
import { getProjects, updateVersionReports, updateVersionGameFlow, updateVersionAudioScript, updateAgentReportChat, saveProject, deleteAgentReportVersion, setAgentReportActiveVersion } from '../lib/storage'
import { AgentBriefingCard } from '../components/briefing/AgentBriefingCard'
import { compileGameFlow } from '../lib/api'
import { useCostConfirm } from '../components/ui/CostConfirmModal'
import { cancelCollaborationRunner, getCollaborationSnapshot, isFailedAgentReport, rerunEntireCollaboration, rerunFromAgent, rerunFinalReportOnly, rerunSingleAgent, isSingleAgentRunning, startCollaborationRunner, subscribeCollaboration } from '../lib/collaborationRunner'
import { ReportCard } from '../components/reports/ReportCard'
import { GameFlowTable } from '../components/GameFlowTable'
import { GameFlowMap } from '../components/GameFlowMap'
import AudioScriptTable from '../components/AudioScriptTable'
import { MetaStudio } from '../components/MetaStudio'
import { WorkshopTab } from '../components/workshop/WorkshopTab'
import { AGENTS } from '../data/agents'
import { BRANCH_CODES } from '../data/questData'
import type { Project, AgentReport, FinalReport, AgentId, GameFlowSheet, AudioScript, ChatMessage, DetailVersion, BranchCode, CrimeConfig, CharacterRole, StoryStageKey } from '../types'

// ─── 브리핑 섹션 ────────────────────────────────────────────────────────────
function BriefingSection({
  project, activeAgentIds, onUpdate,
}: { project: Project; activeAgentIds: AgentId[]; onUpdate: () => void }) {
  const briefingAgents = AGENTS.filter(a => activeAgentIds.includes(a.id))
  const projectContext = `프로젝트명: ${project.name}\n테마: ${project.theme}${
    project.crimeConfig
      ? `\n장르: ${project.crimeConfig.genres?.join(', ')}\n장소: ${project.crimeConfig.location}`
      : ''
  }`
  const briefedCount = Object.values(project.briefings ?? {}).filter(b => b?.completedAt).length

  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 16, padding: 20, marginBottom: 20,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>에이전트 사전 브리핑</div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
            선택 사항 · 보고서 생성 전에 각 에이전트와 프로젝트를 논의하세요
          </div>
        </div>
        {briefedCount > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 700, color: '#3fb950',
            background: '#3fb95022', border: '1px solid #3fb95044',
            borderRadius: 10, padding: '3px 10px',
          }}>
            {briefedCount}/{briefingAgents.length} 완료
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {briefingAgents.map(agent => (
          <AgentBriefingCard
            key={agent.id}
            agent={agent}
            briefing={project.briefings?.[agent.id]}
            projectContext={projectContext}
            projectId={project.id}
            onUpdate={onUpdate}
          />
        ))}
      </div>
    </div>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

function stripOperatingBudgetSectionText(input: string): string {
  if (!input) return input
  return input
    .replace(
      /(?:^|\n)\s*(?:#{1,6}\s*)?(?:0?7[\.\)\-:\s]*)?운영\s*예산[^\n]*\n[\s\S]*?(?=\n\s*(?:#{1,6}\s*)?(?:0?[1-9]|1[0-9])[\.\)\-:\s]+[^\n]*|\n\s*$)/gi,
      '\n',
    )
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function stripOperatingBudgetSectionHtml(input: string): string {
  if (!input) return input
  return input
    .replace(/<h[1-6][^>]*>[^<]*운영\s*예산[^<]*<\/h[1-6]>[\s\S]*?(?=<h[1-6][^>]*>|$)/gi, '')
    .replace(/<p[^>]*>\s*(?:0?7[\.\)\-:\s]*)?운영\s*예산[^<]*<\/p>[\s\S]*?(?=<h[1-6][^>]*>|$)/gi, '')
    .trim()
}

function looksLikeHtml(text: string): boolean {
  const t = text.trimStart()
  return /^<(div|section|article|main|p|h[1-6]|span|table|ul|ol)\b/i.test(t) || t.includes('<div style=')
}

function splitReportDetail(detail: string): { plain: string; html: string | null } {
  const markerRegex = /<\s*!?--\s*XYNAPS_HTML\s*-->/i
  const match = markerRegex.exec(detail)
  if (!match || match.index === undefined) {
    // 마커 없이도 HTML처럼 생겼으면 그대로 HTML 렌더링
    if (looksLikeHtml(detail)) return { plain: '', html: detail }
    return { plain: detail, html: null }
  }
  const markerStart = match.index
  const markerEnd = markerStart + match[0].length
  return {
    plain: detail.slice(0, markerStart).trim(),
    html: detail.slice(markerEnd).trim(),
  }
}

export function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { requireConfirm, modal: costConfirmModal } = useCostConfirm()
  const [project, setProject] = useState<Project | null>(null)
  const [activeVersionId, setActiveVersionId] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [runningAgentId, setRunningAgentId] = useState<AgentId | null>(null)
  const [liveReports, setLiveReports] = useState<AgentReport[]>([])
  const [finalReport, setFinalReport] = useState<FinalReport | null>(null)
  const [generatingFinal, setGeneratingFinal] = useState(false)
  const [showDetail, setShowDetail] = useState(false)
  const [finalEditMode, setFinalEditMode] = useState(false)
  const [finalEditSummary, setFinalEditSummary] = useState('')
  const [finalEditDetail, setFinalEditDetail] = useState('')
  const [activeTab, setActiveTab] = useState<'setup' | 'draft' | 'reports' | 'gameflow' | 'studio' | 'workshop'>('reports')
  const [gameflowView, setGameflowView] = useState<'table' | 'map' | 'user' | 'script'>('table')
  const [generatingGameFlow, setGeneratingGameFlow] = useState(false)
  const [gameFlowElapsed, setGameFlowElapsed] = useState(0)
  const [gameFlowError, setGameFlowError] = useState<string | null>(null)
  const [gameFlowSyncedAt, setGameFlowSyncedAt] = useState<string | null>(null)
  const [workspaceSaveStatus, setWorkspaceSaveStatus] = useState<'idle' | 'saved'>('idle')
  const [showWorkspaceHistory, setShowWorkspaceHistory] = useState(false)
  const [showVersionMenu, setShowVersionMenu] = useState(false)
  const [workspaceHistory, setWorkspaceHistory] = useState<Array<{ id: string; savedAt: string; payload: unknown }>>([])
  const [studioMountKey, setStudioMountKey] = useState(0)
  const [draftMetaName, setDraftMetaName] = useState('')
  const [draftMetaTheme, setDraftMetaTheme] = useState('')
  const [draftMetaBranches, setDraftMetaBranches] = useState<BranchCode[]>([])
  const [collaborationStartedAt, setCollaborationStartedAt] = useState<number | null>(null)
  const [progressClock, setProgressClock] = useState(() => Date.now())
  const [collaborationLogs, setCollaborationLogs] = useState<Array<{ id: string; at: string; level: 'info' | 'success' | 'warning' | 'error'; message: string }>>([])
  const [refreshingAgents, setRefreshingAgents] = useState<Set<AgentId>>(new Set())
  const [draftCrimeEditMode, setDraftCrimeEditMode] = useState(false)
  const [draftCrimeEditError, setDraftCrimeEditError] = useState<string | null>(null)
  const [draftCrimeRaw, setDraftCrimeRaw] = useState({
    genres: '',
    location: '',
    motives: '',
    crimeTypes: '',
    clues: '',
    methods: '',
    characters: '',
    relations: '',
    storyFlow: '',
  })
  const versionMenuRef = useRef<HTMLDivElement>(null)

  const PAGE_HISTORY_MAX = 10

  function getWorkspaceHistoryKey(tab: 'setup' | 'draft' | 'reports' | 'gameflow' | 'studio' | 'workshop') {
    if (!project || !activeVersion) return null
    return `xynaps_workspace_hist_${project.id}_${activeVersion.id}_${tab}`
  }

  function loadWorkspaceHistory(tab: 'setup' | 'draft' | 'reports' | 'gameflow' | 'studio' | 'workshop') {
    const key = getWorkspaceHistoryKey(tab)
    if (!key) return []
    try {
      const parsed = JSON.parse(localStorage.getItem(key) || '[]')
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  function saveWorkspaceHistory(tab: 'setup' | 'draft' | 'reports' | 'gameflow' | 'studio' | 'workshop', history: Array<{ id: string; savedAt: string; payload: unknown }>) {
    const key = getWorkspaceHistoryKey(tab)
    if (!key) return
    localStorage.setItem(key, JSON.stringify(history))
  }

  function reload() {
    const p = getProjects().find(p => p.id === id)
    if (!p) { navigate('/'); return }
    setProject(p)
    if (!activeVersionId && p.versions.length > 0) {
      setActiveVersionId(p.versions[p.versions.length - 1].id)
    }
  }

  useEffect(() => { reload() }, [id])

  const activeVersion = project?.versions.find(v => v.id === activeVersionId) || null

  useEffect(() => {
    if (!project || !activeVersion) return
    setWorkspaceHistory(loadWorkspaceHistory(activeTab))
    setShowWorkspaceHistory(false)
    setWorkspaceSaveStatus('idle')
  }, [activeTab, project?.id, activeVersion?.id])

  useEffect(() => {
    if (!project) return
    const snapshot = getCollaborationSnapshot(project.id)
    if (snapshot) {
      setRunning(snapshot.running)
      setGeneratingFinal(snapshot.generatingFinal)
      setRunningAgentId(snapshot.runningAgentId)
      setLiveReports(snapshot.reports)
      setFinalReport(snapshot.finalReport)
      setCollaborationStartedAt(Date.parse(snapshot.startedAt))
      setCollaborationLogs(snapshot.logs)
    } else if (!project.collaborationStatus?.active) {
      setRunning(false)
      setGeneratingFinal(false)
      setRunningAgentId(null)
      setCollaborationStartedAt(null)
      setCollaborationLogs([])
    }

    return subscribeCollaboration(project.id, next => {
      setRunning(next.running)
      setGeneratingFinal(next.generatingFinal)
      setRunningAgentId(next.runningAgentId)
      setLiveReports(next.reports)
      setFinalReport(next.finalReport)
      setCollaborationStartedAt(Date.parse(next.startedAt))
      setCollaborationLogs(next.logs)
      if (!next.running && !next.generatingFinal) reload()
    })
  }, [project?.id])

  useEffect(() => {
    if (!showVersionMenu) return
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node
      if (!versionMenuRef.current?.contains(target)) {
        setShowVersionMenu(false)
      }
    }
    document.addEventListener('mousedown', handleOutsideClick)
    return () => document.removeEventListener('mousedown', handleOutsideClick)
  }, [showVersionMenu])

  useEffect(() => {
    const source = finalReport || activeVersion?.finalReport || null
    const cleanedDetail = stripOperatingBudgetSectionText(source?.detail ?? '')
    const split = splitReportDetail(cleanedDetail)
    setFinalEditMode(false)
    setFinalEditSummary(stripOperatingBudgetSectionText(source?.summary ?? ''))
    setFinalEditDetail((split.plain || cleanedDetail).trim())
  }, [finalReport, activeVersion?.id, activeVersion?.finalReport?.summary, activeVersion?.finalReport?.detail])

  useEffect(() => {
    if (!project) return
    setDraftMetaName(project.name ?? '')
    setDraftMetaTheme(project.theme ?? '')
    setDraftMetaBranches((project.branches ?? []).slice(0, 1))
  }, [project?.id, project?.name, project?.theme, project?.branches])

  useEffect(() => {
    const crime = project?.crimeConfig
    if (!crime) return
    const genres = (crime.genres ?? []).join(', ')
    const location = crime.location ?? ''
    const motives = (crime.motives ?? []).join('\n')
    const crimeTypes = (crime.crimeTypes ?? []).join('\n')
    const clues = (crime.clues ?? []).join('\n')
    const methods = (crime.methods ?? []).join('\n')
    const characters = (crime.characters ?? [])
      .map(c => `${c.role} | ${c.name ?? ''} | ${c.background ?? ''}`)
      .join('\n')
    const nameById = new Map((crime.characters ?? []).map(c => [c.id, c.name || c.role]))
    const relations = (crime.relations ?? [])
      .map(r => `${nameById.get(r.fromId) ?? ''} | ${r.relationType} | ${nameById.get(r.toId) ?? ''} | ${r.description ?? ''}`)
      .join('\n')
    const stageOrder: StoryStageKey[] = ['기', '승', '전', '반전', '결']
    const stageMap = new Map((crime.storyFlow ?? []).map(s => [s.stage, s]))
    const storyFlow = stageOrder
      .map(stage => {
        const item = stageMap.get(stage)
        return `${stage} | ${item?.roomName ?? ''} | ${item?.description ?? ''}`
      })
      .join('\n')
    setDraftCrimeRaw({ genres, location, motives, crimeTypes, clues, methods, characters, relations, storyFlow })
    setDraftCrimeEditError(null)
  }, [project?.id, project?.crimeConfig])

  async function startCollaboration() {
    if (!project) return
    requireConfirm('full-collaboration', () => _doStartCollaboration())
  }

  function _doStartCollaboration() {
    if (!project) return
    const { versionId } = startCollaborationRunner(project.id)
    const snapshot = getCollaborationSnapshot(project.id)
    reload()
    setActiveVersionId(versionId)
    if (snapshot) {
      setRunning(snapshot.running)
      setGeneratingFinal(snapshot.generatingFinal)
      setRunningAgentId(snapshot.runningAgentId)
      setLiveReports(snapshot.reports)
      setFinalReport(snapshot.finalReport)
      setCollaborationStartedAt(Date.parse(snapshot.startedAt))
      setCollaborationLogs(snapshot.logs)
    }
  }

  function handleRerunAll() {
    if (!project || !activeVersion) return
    requireConfirm('full-collaboration', () => {
      const { versionId } = rerunEntireCollaboration(project.id, activeVersion.id)
      const snapshot = getCollaborationSnapshot(project.id)
      setActiveVersionId(versionId)
      if (snapshot) {
        setRunning(snapshot.running)
        setGeneratingFinal(snapshot.generatingFinal)
        setRunningAgentId(snapshot.runningAgentId)
        setLiveReports(snapshot.reports)
        setFinalReport(snapshot.finalReport)
        setCollaborationStartedAt(Date.parse(snapshot.startedAt))
        setCollaborationLogs(snapshot.logs)
      }
    })
  }

  function handleRerunFinalOnly() {
    if (!project || !activeVersion) return
    const { alreadyRunning } = rerunFinalReportOnly(project.id, activeVersion.id)
    if (alreadyRunning) return
    const snapshot = getCollaborationSnapshot(project.id)
    if (snapshot) {
      setRunning(snapshot.running)
      setGeneratingFinal(snapshot.generatingFinal)
      setRunningAgentId(snapshot.runningAgentId)
      setLiveReports(snapshot.reports)
      setFinalReport(snapshot.finalReport)
      setCollaborationStartedAt(Date.parse(snapshot.startedAt))
      setCollaborationLogs(snapshot.logs)
    }
  }

  function handleRefreshSingleAgent(agentId: AgentId) {
    if (!project || !activeVersion) return
    if (running || generatingFinal) return
    if (isSingleAgentRunning(project.id, agentId)) return
    requireConfirm('single-agent-refresh', () => _doRefreshSingleAgent(agentId))
  }

  function _doRefreshSingleAgent(agentId: AgentId) {
    if (!project || !activeVersion) return
    setRefreshingAgents(prev => new Set(prev).add(agentId))
    try {
      rerunSingleAgent(project.id, activeVersion.id, agentId)
    } catch {
      setRefreshingAgents(prev => { const next = new Set(prev); next.delete(agentId); return next })
      return
    }
    // Poll snapshot subscription to detect when this agent finishes
    const unsubscribe = subscribeCollaboration(project.id, next => {
      const agentReport = next.reports.find(r => r.agentId === agentId)
      const stillRunning = next.runningAgentId === agentId || isSingleAgentRunning(project.id, agentId)
      if (!stillRunning && agentReport?.status === 'done') {
        setRefreshingAgents(prev => { const s = new Set(prev); s.delete(agentId); return s })
        reload()
        unsubscribe()
      }
    })
  }

  function handleRerunFromAgent(agentId: AgentId) {
    if (!project || !activeVersion) return
    requireConfirm('rerun-from-agent', () => {
      const { versionId } = rerunFromAgent(project.id, activeVersion.id, agentId)
      const snapshot = getCollaborationSnapshot(project.id)
      setActiveVersionId(versionId)
      if (snapshot) {
        setRunning(snapshot.running)
        setGeneratingFinal(snapshot.generatingFinal)
        setRunningAgentId(snapshot.runningAgentId)
        setLiveReports(snapshot.reports)
        setFinalReport(snapshot.finalReport)
        setCollaborationStartedAt(Date.parse(snapshot.startedAt))
      }
    })
  }

  function handleStopCollaboration() {
    if (!project) return
    cancelCollaborationRunner(project.id)
  }

  function handleNewVersion(agentId: string, chatHistory: ChatMessage[], newVersion: DetailVersion) {
    if (!project || !activeVersion) return
    updateAgentReportChat(project.id, activeVersion.id, agentId as AgentId, chatHistory, newVersion)
    reload()
  }

  function handleDeleteVersion(agentId: string, detailVersionId: string) {
    if (!project || !activeVersion) return
    deleteAgentReportVersion(project.id, activeVersion.id, agentId as AgentId, detailVersionId)
    reload()
  }

  function handleSetActiveVersion(agentId: string, detailVersionId: string) {
    if (!project || !activeVersion) return
    setAgentReportActiveVersion(project.id, activeVersion.id, agentId as AgentId, detailVersionId)
    reload()
  }

  function handleChatSave(agentId: string, chatHistory: ChatMessage[]) {
    if (!project || !activeVersion) return
    updateAgentReportChat(project.id, activeVersion.id, agentId as AgentId, chatHistory)
  }

  function saveFinalReportManualEdit() {
    if (!project || !activeVersion) return
    const nextFinal: FinalReport = {
      summary: stripOperatingBudgetSectionText(finalEditSummary.trim()),
      detail: stripOperatingBudgetSectionText(finalEditDetail.trim()),
      createdAt: new Date().toISOString(),
    }
    updateVersionReports(project.id, activeVersion.id, activeVersion.agentReports ?? [], nextFinal)
    setFinalReport(nextFinal)
    setFinalEditMode(false)
    reload()
  }

  async function generateGameFlow() {
    if (!project || !activeVersion) return
    requireConfirm('game-flow', () => _doGenerateGameFlow())
  }

  async function _doGenerateGameFlow() {
    if (!project || !activeVersion) return
    setGeneratingGameFlow(true)
    setGameFlowElapsed(0)
    setGameFlowError(null)
    try {
      // Resolve each report to its active version's content
      const resolvedReports = activeVersion.agentReports.map(r => {
        const activeVer = r.detailVersions?.find(v => v.id === r.activeVersionId)
        return activeVer ? { ...r, summary: activeVer.summary, detail: activeVer.detail } : r
      })
      const sheet = await compileGameFlow(
        project.theme,
        project.crimeConfig,
        resolvedReports,
        project.attachments
      )
      updateVersionGameFlow(project.id, activeVersion.id, sheet)
      setGameFlowSyncedAt(new Date().toISOString())
      reload()
    } catch (e) {
      setGameFlowError(e instanceof Error ? e.message : String(e))
    } finally {
      setGeneratingGameFlow(false)
    }
  }

  function handleGameFlowChange(sheet: GameFlowSheet) {
    if (!project || !activeVersion) return
    updateVersionGameFlow(project.id, activeVersion.id, sheet)
    reload()
  }

  function handleAudioScriptChange(script: AudioScript) {
    if (!project || !activeVersion) return
    updateVersionAudioScript(project.id, activeVersion.id, script)
    reload()
  }

  function handleWorkspaceSave() {
    if (!project || !activeVersion) return
    let payload: unknown = null
    if (activeTab === 'reports') {
      payload = {
        agentReports: activeVersion.agentReports ?? [],
        finalReport: activeVersion.finalReport ?? null,
      }
    } else if (activeTab === 'gameflow') {
      payload = {
        gameFlow: activeVersion.gameFlow ?? null,
      }
    } else {
      payload = {
        studioMap: localStorage.getItem(`xynaps_meta_map_${project.id}`),
        studioHistory: localStorage.getItem(`xynaps_meta_hist_${project.id}`),
      }
    }
    const entry = {
      id: crypto.randomUUID(),
      savedAt: new Date().toISOString(),
      payload,
    }
    const next = [entry, ...workspaceHistory].slice(0, PAGE_HISTORY_MAX)
    setWorkspaceHistory(next)
    saveWorkspaceHistory(activeTab, next)
    setWorkspaceSaveStatus('saved')
    setShowWorkspaceHistory(false)
    setTimeout(() => setWorkspaceSaveStatus('idle'), 1600)
  }

  function handleWorkspaceRestore(entry: { id: string; savedAt: string; payload: unknown }) {
    if (!project || !activeVersion) return
    try {
      if (activeTab === 'reports') {
        const payload = entry.payload as { agentReports?: AgentReport[]; finalReport?: FinalReport | null }
        updateVersionReports(project.id, activeVersion.id, payload.agentReports ?? [], payload.finalReport ?? undefined)
        reload()
      } else if (activeTab === 'gameflow') {
        const payload = entry.payload as { gameFlow?: GameFlowSheet | null }
        if (payload.gameFlow) {
          updateVersionGameFlow(project.id, activeVersion.id, payload.gameFlow)
          reload()
        }
      } else {
        const payload = entry.payload as { studioMap?: string | null; studioHistory?: string | null }
        if (payload.studioMap !== undefined && payload.studioMap !== null) {
          localStorage.setItem(`xynaps_meta_map_${project.id}`, payload.studioMap)
        }
        if (payload.studioHistory !== undefined && payload.studioHistory !== null) {
          localStorage.setItem(`xynaps_meta_hist_${project.id}`, payload.studioHistory)
        }
        setStudioMountKey(prev => prev + 1)
      }
      setShowWorkspaceHistory(false)
    } catch {
      setShowWorkspaceHistory(false)
    }
  }

  function toggleDraftBranch(code: BranchCode) {
    setDraftMetaBranches([code])
  }

  function parseLines(text: string) {
    return text
      .split('\n')
      .map(v => v.trim())
      .filter(Boolean)
  }

  function parseCsv(text: string) {
    return text
      .split(',')
      .map(v => v.trim())
      .filter(Boolean)
  }

  function saveDraftCrimeConfigEdits() {
    if (!project) return
    setDraftCrimeEditError(null)
    try {
      const trimmedName = draftMetaName.trim()
      const trimmedTheme = draftMetaTheme.trim()
      if (!trimmedName || !trimmedTheme) {
        setDraftCrimeEditError('프로젝트 이름과 테마를 입력해주세요.')
        return
      }
      const validRoles = new Set<CharacterRole>(['가해자', '피해자', '목격자', '주변인물', '공범', '의뢰인'])
      const validStages = new Set<StoryStageKey>(['기', '승', '전', '반전', '결'])

      const characters = parseLines(draftCrimeRaw.characters).map(line => {
        const [roleRaw, nameRaw = '', bgRaw = ''] = line.split('|').map(v => v.trim())
        const role = validRoles.has(roleRaw as CharacterRole) ? (roleRaw as CharacterRole) : '주변인물'
        return { id: crypto.randomUUID(), role, name: nameRaw, background: bgRaw }
      })
      const nameToId = new Map(characters.map(c => [c.name || c.role, c.id]))

      const relations = parseLines(draftCrimeRaw.relations)
        .map(line => {
          const [fromNameRaw = '', relTypeRaw = '', toNameRaw = '', descRaw = ''] = line.split('|').map(v => v.trim())
          const fromId = nameToId.get(fromNameRaw)
          const toId = nameToId.get(toNameRaw)
          if (!fromId || !toId || fromId === toId) return null
          const relationType = relTypeRaw || '기타'
          return { id: crypto.randomUUID(), fromId, toId, relationType, description: descRaw }
        })
        .filter(Boolean) as CrimeConfig['relations']

      const storyFlowParsed = parseLines(draftCrimeRaw.storyFlow)
        .map(line => {
          const [stageRaw = '', roomName = '', description = ''] = line.split('|').map(v => v.trim())
          if (!validStages.has(stageRaw as StoryStageKey)) return null
          return { stage: stageRaw as StoryStageKey, roomName, description }
        })
        .filter(Boolean) as CrimeConfig['storyFlow']
      const stageOrder: StoryStageKey[] = ['기', '승', '전', '반전', '결']
      const byStage = new Map(storyFlowParsed.map(s => [s.stage, s]))
      const storyFlow = stageOrder.map(stage => byStage.get(stage) ?? { stage, roomName: '', description: '' })

      const nextCrime: CrimeConfig = {
        motives: parseLines(draftCrimeRaw.motives),
        crimeTypes: parseLines(draftCrimeRaw.crimeTypes),
        clues: parseLines(draftCrimeRaw.clues),
        methods: parseLines(draftCrimeRaw.methods),
        location: draftCrimeRaw.location.trim(),
        genres: parseCsv(draftCrimeRaw.genres),
        characters,
        relations,
        storyFlow,
      }

      saveProject({
        ...project,
        name: trimmedName,
        theme: trimmedTheme,
        branches: draftMetaBranches.slice(0, 1),
        crimeConfig: nextCrime,
        updatedAt: new Date().toISOString(),
      })
      setDraftCrimeEditMode(false)
      reload()
    } catch (e) {
      setDraftCrimeEditError(`편집 저장 실패: ${String(e)}`)
    }
  }

  function activeAgentIds(): AgentId[] {
    const gameSystemTypes = project?.gameSystemTypes ?? ['escape']
    const base: AgentId[] = ['ceo', 'concept', 'pd', 'puzzle', 'space', 'ops']
    const extra: AgentId[] = []
    if (gameSystemTypes.includes('surround')) extra.push('sound')
    if (gameSystemTypes.includes('crimescene')) extra.push('xfiler')
    return [...base, ...extra]
  }

  function getNextVersionName(targetProject: Project) {
    const numbers = targetProject.versions
      .map(v => {
        const m = /^v(\d+)\.0$/i.exec(v.versionName.trim())
        return m ? Number(m[1]) : null
      })
      .filter((n): n is number => n !== null)
    const next = numbers.length > 0 ? Math.max(...numbers) + 1 : 2
    return `v${next}.0`
  }

  function duplicateActiveVersion() {
    if (!project || !activeVersion) return
    const snapshot = JSON.parse(JSON.stringify(activeVersion))
    const duplicatedVersion = {
      ...snapshot,
      id: crypto.randomUUID(),
      versionName: getNextVersionName(project),
      createdAt: new Date().toISOString(),
    }
    const nextProject: Project = {
      ...project,
      versions: [...project.versions, duplicatedVersion],
      updatedAt: new Date().toISOString(),
    }
    saveProject(nextProject)
    setProject(nextProject)
    setActiveVersionId(duplicatedVersion.id)
    setLiveReports([])
    setFinalReport(null)
    setShowWorkspaceHistory(false)
    setShowVersionMenu(false)
  }

  function removeVersion(versionId: string) {
    if (!project) return
    if (project.versions.length <= 1) return
    const target = project.versions.find(v => v.id === versionId)
    if (!target) return
    if (!confirm(`${target.versionName} 버전을 영구 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.`)) return

    const nextVersions = project.versions.filter(v => v.id !== versionId)
    const nextProject: Project = {
      ...project,
      versions: nextVersions,
      updatedAt: new Date().toISOString(),
    }
    saveProject(nextProject)
    setProject(nextProject)

    if (activeVersionId === versionId) {
      const fallback = nextVersions[nextVersions.length - 1]
      setActiveVersionId(fallback?.id ?? null)
      setLiveReports([])
      setFinalReport(null)
    }
  }

  const displayReports = running ? liveReports : (activeVersion?.agentReports || [])
  const displayFinal = generatingFinal ? null : (finalReport || activeVersion?.finalReport || null)
  const displayFinalClean = displayFinal ? {
    ...displayFinal,
    summary: stripOperatingBudgetSectionText(displayFinal.summary ?? ''),
    detail: stripOperatingBudgetSectionText(displayFinal.detail ?? ''),
  } : null
  const finalDetailSplit = displayFinalClean ? splitReportDetail(displayFinalClean.detail ?? '') : null
  const hasCompletedReports = (activeVersion?.agentReports?.length ?? 0) > 0
  const showSetupView = !running && activeTab === 'setup' && hasCompletedReports
  const showDraftView = !running && (
    activeVersion?.status === 'draft' ||
    (activeTab === 'draft' && hasCompletedReports)
  )
  const isReadonlyDraftView = activeVersion?.status !== 'draft'
  const completedReportCount = displayReports.filter(r => r.status === 'done').length
  const totalWorkUnits = displayReports.length > 0 ? displayReports.length + 1 : 0
  const finishedUnits = completedReportCount + (generatingFinal ? 0 : (displayFinalClean ? 1 : 0))
  const collaborationElapsedSeconds = collaborationStartedAt ? Math.max(0, Math.floor((progressClock - collaborationStartedAt) / 1000)) : 0
  const estimatedTotalSeconds = totalWorkUnits > 0 ? (displayReports.length * 42) + 20 : 0
  const estimatedRemainingSeconds = collaborationStartedAt
    ? Math.max(generatingFinal ? 8 : (running ? 12 : 0), estimatedTotalSeconds - collaborationElapsedSeconds)
    : estimatedTotalSeconds
  const collaborationPercent = totalWorkUnits > 0
    ? Math.min(100, Math.max(4, Math.round((finishedUnits / totalWorkUnits) * 100)))
    : 0
  const currentAgentDef = runningAgentId ? AGENTS.find(a => a.id === runningAgentId) : null
  const workflowAgentIds = displayReports.map(r => r.agentId as AgentId)
  const firstFailedAgentId = displayReports.find(report => isFailedAgentReport(report))?.agentId ?? null

  // GameFlow stale: any agent report has a regenerated version newer than the last gameFlow compile
  const isGameFlowStale = !!(activeVersion?.gameFlow && activeVersion.agentReports.some(r =>
    r.detailVersions?.some(v =>
      v.label !== '원본' && new Date(v.createdAt) > new Date(activeVersion.gameFlow!.generatedAt)
    )
  ))
  const hasSurround = (project?.gameSystemTypes ?? []).includes('surround')
  const isWideCanvasLayout =
    (activeTab === 'gameflow' && (gameflowView === 'map' || gameflowView === 'user')) ||
    activeTab === 'studio'


  function formatDuration(totalSeconds: number) {
    const seconds = Math.max(0, Math.floor(totalSeconds))
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}분 ${secs.toString().padStart(2, '0')}초` : `${secs}초`
  }

  useEffect(() => {
    if (!(running || generatingFinal)) return
    setProgressClock(Date.now())
    const timer = window.setInterval(() => setProgressClock(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [running, generatingFinal])

  useEffect(() => {
    if (!generatingGameFlow) return
    const timer = window.setInterval(() => setGameFlowElapsed(s => s + 1), 1000)
    return () => window.clearInterval(timer)
  }, [generatingGameFlow])

  useEffect(() => {
    if (!generatingGameFlow) return
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = '게임 플로우 생성이 진행 중입니다. 페이지를 나가면 작업이 중단됩니다.'
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [generatingGameFlow])

  if (!project) return null

  return (
    <div
      className="project-page"
      style={{
        minHeight: '100vh',
        color: '#dbe3f3',
        ['--text-primary' as string]: '#f4f7ff',
        ['--text-secondary' as string]: '#d7e0f0',
        ['--text-muted' as string]: '#aab6ca',
        ['--border' as string]: '#313949',
        ['--border-bright' as string]: '#4d5972',
      }}
    >
      <style>{`
        .project-page input,
        .project-page textarea,
        .project-page select {
          color: var(--text-primary);
        }
        .project-page input::placeholder,
        .project-page textarea::placeholder {
          color: #8592a9;
          opacity: 1;
        }
        .project-working-led {
          animation: projectWorkingPulse 1.2s ease-in-out infinite;
        }
        .project-working-scan {
          animation: projectWorkingScan 3.8s linear infinite;
        }
        .project-working-progress {
          animation: projectWorkingBar 1.6s ease-in-out infinite alternate;
        }
        .project-working-frame {
          position: relative;
          overflow: hidden;
        }
        .project-working-frame::after {
          content: '';
          position: absolute;
          inset: 0;
          background: linear-gradient(120deg, transparent 0%, rgba(201,255,84,0.08) 45%, transparent 70%);
          transform: translateX(-110%);
          animation: projectWorkingSweep 3.2s ease-in-out infinite;
          pointer-events: none;
        }
        @keyframes projectWorkingPulse {
          0%, 100% { opacity: 0.45; transform: scale(0.94); }
          50% { opacity: 1; transform: scale(1); }
        }
        @keyframes projectWorkingScan {
          0% { transform: translateY(-110%); opacity: 0; }
          8% { opacity: 1; }
          50% { opacity: 0.85; }
          100% { transform: translateY(120%); opacity: 0; }
        }
        @keyframes projectWorkingBar {
          from { transform: translateX(-6%); filter: saturate(0.95); }
          to { transform: translateX(4%); filter: saturate(1.1); }
        }
        @keyframes projectWorkingSweep {
          0% { transform: translateX(-110%); }
          100% { transform: translateX(110%); }
        }
      `}</style>
      {/* 헤더 */}
      <header style={{
        padding: '14px 28px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <button onClick={() => {
          if (generatingGameFlow && !window.confirm('게임 플로우 생성이 진행 중입니다. 홈으로 나가면 작업이 중단될 수 있습니다. 계속하시겠습니까?')) return
          navigate('/')
        }} style={{
          background: 'none', border: '1px solid var(--border)',
          color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
          padding: '5px 10px', borderRadius: 7, transition: 'border-color 0.15s, color 0.15s',
          display: 'flex', alignItems: 'center', gap: 4,
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >← 홈</button>
        <div style={{ width: 1, height: 18, background: 'var(--border)' }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{project.name}</span>
            {project.branches?.map(b => (
              <span key={b} style={{
                fontSize: 9, fontWeight: 700, padding: '2px 5px', borderRadius: 4,
                background: 'var(--bg-secondary)', color: 'var(--text-muted)',
                border: '1px solid var(--border)', letterSpacing: '0.05em',
              }}>{b}</span>
            ))}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{project.theme}</div>
        </div>
        <div ref={versionMenuRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{
            fontSize: 12,
            fontWeight: 700,
            color: 'var(--text-primary)',
            padding: '6px 10px',
            borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'var(--bg-card)',
          }}>
            {activeVersion?.versionName ?? 'v1.0'}
          </span>
          <button
            onClick={() => setShowVersionMenu(v => !v)}
            style={{
              height: 32,
              padding: '0 12px',
              borderRadius: 8,
              border: showVersionMenu ? '1px solid var(--accent)' : '1px solid var(--border)',
              background: showVersionMenu ? 'var(--accent-dim)' : 'var(--bg-secondary)',
              color: showVersionMenu ? 'var(--accent)' : 'var(--text-primary)',
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            Ver
            <span style={{ fontSize: 10, lineHeight: 1 }}>{showVersionMenu ? '▲' : '▼'}</span>
          </button>
          {showVersionMenu && (
            <div style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: 248,
              border: '1px solid var(--border)',
              borderRadius: 10,
              background: 'var(--bg-card)',
              boxShadow: '0 12px 28px rgba(0,0,0,0.36)',
              zIndex: 140,
              overflow: 'hidden',
            }}>
              <button
                onClick={duplicateActiveVersion}
                style={{
                  width: '100%',
                  border: 'none',
                  borderBottom: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'var(--accent)',
                  padding: '10px 12px',
                  fontSize: 12,
                  fontWeight: 700,
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.background = 'var(--accent-dim)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
              >
                + 현재 버전 사본 생성
              </button>
              <div style={{ maxHeight: 280, overflowY: 'auto' }}>
                {project.versions.map(v => {
                  const isActive = activeVersionId === v.id
                  const isDraft = v.status === 'draft'
                  const isCompleted = v.status === 'completed'
                  return (
                    <div key={v.id} style={{ display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                      <button
                        onClick={() => {
                          setActiveVersionId(v.id)
                          setLiveReports([])
                          setFinalReport(null)
                          setShowVersionMenu(false)
                        }}
                        style={{
                          flex: 1,
                          border: 'none',
                          background: isActive ? 'var(--bg-secondary)' : 'transparent',
                          color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          textAlign: 'left',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          fontSize: 12,
                          fontWeight: isActive ? 700 : 500,
                        }}
                      >
                        {isDraft && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--warning)', flexShrink: 0 }} />}
                        <span>{v.versionName}</span>
                        {isCompleted && <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--success)', flexShrink: 0 }} />}
                      </button>
                      {project.versions.length > 1 && (
                        <button
                          onClick={() => {
                            removeVersion(v.id)
                            setShowVersionMenu(false)
                          }}
                          title={`${v.versionName} 삭제`}
                          style={{
                            width: 30,
                            height: 30,
                            marginRight: 6,
                            borderRadius: 6,
                            border: '1px solid transparent',
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: 14,
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.color = '#f87171'
                            e.currentTarget.style.borderColor = 'rgba(248,113,113,0.45)'
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.color = 'var(--text-muted)'
                            e.currentTarget.style.borderColor = 'transparent'
                          }}
                        >
                          ×
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </header>

      <main style={{
        padding: isWideCanvasLayout ? '20px 24px 28px' : '24px 32px',
        maxWidth: isWideCanvasLayout ? 1680 : 900,
        margin: '0 auto',
        width: '100%',
      }}>
        {/* 탭 네비게이션 */}
        {hasCompletedReports && !running && (
          <div style={{ display: 'flex', marginBottom: 24, borderBottom: '1px solid var(--border)', alignItems: 'stretch' }}>
            <div style={{ display: 'flex', gap: 0 }}>
              {[
                { key: 'setup', label: '기본 정보', stale: false },
                { key: 'draft', label: '초안', stale: false },
                { key: 'reports', label: '보고서', stale: false },
                { key: 'gameflow', label: '게임 플로우', stale: isGameFlowStale },
                { key: 'workshop', label: '회의실', stale: false },
                { key: 'studio', label: '스튜디오', stale: false },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key as 'setup' | 'draft' | 'reports' | 'gameflow' | 'studio' | 'workshop')} style={{
                  padding: '9px 16px', border: 'none', background: 'transparent',
                  color: activeTab === tab.key ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
                  cursor: 'pointer',
                  borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
                  marginBottom: -1, transition: 'color 0.15s',
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  {tab.label}
                  {tab.stale && (
                    <span style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--warning)', flexShrink: 0,
                    }} />
                  )}
                </button>
              ))}
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 6, position: 'relative', paddingRight: 2 }}>
              <button
                onClick={handleWorkspaceSave}
                title={`${activeTab === 'setup' ? '기본 정보' : activeTab === 'draft' ? '초안' : activeTab === 'reports' ? '보고서' : activeTab === 'gameflow' ? '게임 플로우' : activeTab === 'workshop' ? '회의실' : '스튜디오'} 저장`}
                style={{
                  width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)',
                  background: workspaceSaveStatus === 'saved' ? '#1a4a2a' : 'var(--bg-secondary)',
                  color: workspaceSaveStatus === 'saved' ? '#4ade80' : 'var(--text-muted)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', marginBottom: -1,
                }}
              >
                {workspaceSaveStatus === 'saved' ? <CheckIcon width={13} height={13} /> : <SaveDiskIcon width={13} height={13} />}
              </button>
              <button
                onClick={() => setShowWorkspaceHistory(v => !v)}
                title="히스토리"
                style={{
                  height: 30, minWidth: 42, padding: '0 8px', borderRadius: 8,
                  border: showWorkspaceHistory ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: showWorkspaceHistory ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                  color: showWorkspaceHistory ? 'var(--accent)' : 'var(--text-muted)',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  cursor: 'pointer', marginBottom: -1, fontSize: 11, fontWeight: 600,
                }}
              >
                <HistoryIcon width={12} height={12} />
                <span>{workspaceHistory.length}</span>
              </button>

              {showWorkspaceHistory && (
                <div style={{
                  position: 'absolute', top: 'calc(100% + 8px)', right: 0, zIndex: 120,
                  minWidth: 240, maxWidth: 280,
                  border: '1px solid var(--border)', borderRadius: 10, background: 'var(--bg-card)',
                  boxShadow: '0 10px 26px rgba(0,0,0,0.35)', overflow: 'hidden',
                }}>
                  <div style={{ padding: '8px 11px', borderBottom: '1px solid var(--border)', fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>
                    저장 히스토리 ({workspaceHistory.length}/{PAGE_HISTORY_MAX})
                  </div>
                  {workspaceHistory.length === 0 ? (
                    <div style={{ padding: '12px 11px', fontSize: 11, color: 'var(--text-muted)' }}>저장 내역이 없습니다</div>
                  ) : (
                    workspaceHistory.map((entry, index) => {
                      const d = new Date(entry.savedAt)
                      const label = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
                      return (
                        <button
                          key={entry.id}
                          onClick={() => handleWorkspaceRestore(entry)}
                          style={{
                            width: '100%', padding: '9px 11px', border: 'none',
                            borderBottom: index < workspaceHistory.length - 1 ? '1px solid var(--border)' : 'none',
                            background: 'transparent', cursor: 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
                            textAlign: 'left',
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-secondary)' }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: index === 0 ? 700 : 500 }}>
                              {index === 0 ? '최신 저장' : `저장 ${workspaceHistory.length - index}`}
                            </div>
                            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{label}</div>
                          </div>
                          <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, flexShrink: 0 }}>복원</span>
                        </button>
                      )
                    })
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {showSetupView && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 24 }}>
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: '16px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 14 }}>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>기본 정보</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 3 }}>새 프로젝트 단계에서 입력한 내용을 읽기 전용으로 다시 볼 수 있습니다.</div>
                </div>
                <span style={{
                  padding: '5px 10px',
                  borderRadius: 999,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-secondary)',
                  fontSize: 11,
                  fontWeight: 700,
                }}>
                  읽기 전용
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                {[
                  { label: '프로젝트 이름', value: project.name || '-' },
                  { label: '테마 한 줄 설명', value: project.theme || '-' },
                  { label: '지점 코드', value: project.branches?.join(', ') || '-' },
                  { label: '게임 시스템', value: (project.gameSystemTypes ?? ['escape']).map(type => type === 'escape' ? '방탈출' : type === 'surround' ? '서라운드' : '크라임씬').join(', ') },
                  { label: '첨부 자료', value: `${project.attachments?.length ?? 0}개` },
                  { label: 'Drive 연동', value: project.sourceDriveFolderId ? '연결됨' : '없음' },
                ].map(item => (
                  <div key={item.label} style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border)',
                    borderRadius: 12,
                    padding: '12px 13px',
                  }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{item.label}</div>
                    <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700, lineHeight: 1.6 }}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 16,
              padding: '16px 18px',
            }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 12 }}>수사 백과사전</div>
              {project.crimeConfig ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { label: '장르', value: project.crimeConfig.genres?.join(', ') || '-' },
                    { label: '배경 장소', value: project.crimeConfig.location || '-' },
                    { label: '등장인물', value: `${project.crimeConfig.characters?.length ?? 0}명` },
                    { label: '인물 관계', value: `${project.crimeConfig.relations?.length ?? 0}개` },
                    { label: '게임 플레이 스토리 흐름', value: `${project.crimeConfig.storyFlow?.filter(s => s.description || s.roomName).length ?? 0}단계` },
                    { label: '핵심 키워드', value: [
                      ...(project.crimeConfig.motives ?? []).slice(0, 2),
                      ...(project.crimeConfig.clues ?? []).slice(0, 2),
                    ].join(' · ') || '-' },
                  ].map(item => (
                    <div key={item.label} style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid var(--border)',
                      borderRadius: 12,
                      padding: '12px 13px',
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>{item.label}</div>
                      <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700, lineHeight: 1.6 }}>{item.value}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>저장된 수사 백과사전 정보가 없습니다.</div>
              )}
            </div>
          </div>
        )}

        {/* 초안 뷰 — 사건 설정 요약 */}
        {showDraftView && (
          <div>
            <div style={{
              marginBottom: 12,
              background: 'transparent',
              border: 'none',
              borderRadius: 0,
              padding: 0,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: isReadonlyDraftView ? 'space-between' : 'flex-end', gap: 8, marginBottom: 4 }}>
                {isReadonlyDraftView && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    협업 전 단계의 초안 화면입니다. 완료된 버전이므로 읽기만 가능합니다.
                  </div>
                )}
                {!isReadonlyDraftView && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button
                      onClick={() => setDraftCrimeEditMode(v => !v)}
                      style={{
                        width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border)',
                        background: draftCrimeEditMode ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                        color: draftCrimeEditMode ? 'var(--accent)' : 'var(--text-primary)',
                        cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      title={draftCrimeEditMode ? '편집 닫기' : '편집 열기'}
                    >
                      <WriteIcon width={13} height={13} />
                    </button>
                    {draftCrimeEditMode && (
                      <button
                        onClick={saveDraftCrimeConfigEdits}
                        style={{
                          width: 32, height: 32, borderRadius: 9, border: 'none',
                          background: 'var(--accent)', color: '#111111',
                          cursor: 'pointer',
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}
                        title="편집 저장"
                      >
                        <CheckIcon width={13} height={13} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {!isReadonlyDraftView && draftCrimeEditMode && (
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 14, padding: 12, marginBottom: 12,
                display: 'flex', flexDirection: 'column', gap: 10,
                boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
              }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>
                  프로젝트 정보
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr', gap: 8 }}>
                  <input
                    value={draftMetaName}
                    onChange={e => setDraftMetaName(e.target.value)}
                    placeholder="프로젝트 이름"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
                  />
                  <input
                    value={draftMetaTheme}
                    onChange={e => setDraftMetaTheme(e.target.value)}
                    placeholder="프로젝트 설명/테마"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {BRANCH_CODES.map(code => {
                    const active = draftMetaBranches.includes(code)
                    return (
                      <button
                        key={code}
                        onClick={() => toggleDraftBranch(code)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: 7,
                          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          background: active ? 'var(--accent)' : 'transparent',
                          color: active ? '#111111' : 'var(--text-secondary)',
                          fontSize: 11,
                          fontWeight: active ? 700 : 500,
                          cursor: 'pointer',
                          fontFamily: 'monospace',
                          letterSpacing: '0.04em',
                        }}
                      >
                        {code}
                      </button>
                    )
                  })}
                </div>
                <div style={{ height: 1, background: 'var(--border)', margin: '2px 0 4px' }} />
                <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>
                  초안 기획 요소
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <input
                    value={draftCrimeRaw.genres}
                    onChange={e => setDraftCrimeRaw(prev => ({ ...prev, genres: e.target.value }))}
                    placeholder="장르 (쉼표 구분)"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
                  />
                  <input
                    value={draftCrimeRaw.location}
                    onChange={e => setDraftCrimeRaw(prev => ({ ...prev, location: e.target.value }))}
                    placeholder="배경 장소"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none' }}
                  />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <textarea value={draftCrimeRaw.motives} onChange={e => setDraftCrimeRaw(prev => ({ ...prev, motives: e.target.value }))} placeholder="[A] 범행동기 (줄바꿈 구분)" rows={4} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                  <textarea value={draftCrimeRaw.crimeTypes} onChange={e => setDraftCrimeRaw(prev => ({ ...prev, crimeTypes: e.target.value }))} placeholder="[B] 범행종류 (줄바꿈 구분)" rows={4} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                  <textarea value={draftCrimeRaw.clues} onChange={e => setDraftCrimeRaw(prev => ({ ...prev, clues: e.target.value }))} placeholder="[C] 수사단서 (줄바꿈 구분)" rows={4} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                  <textarea value={draftCrimeRaw.methods} onChange={e => setDraftCrimeRaw(prev => ({ ...prev, methods: e.target.value }))} placeholder="[D] 수사기법 (줄바꿈 구분)" rows={4} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                </div>
                <textarea value={draftCrimeRaw.characters} onChange={e => setDraftCrimeRaw(prev => ({ ...prev, characters: e.target.value }))} placeholder="등장인물 (줄바꿈 구분): 역할 | 이름 | 배경" rows={5} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                <textarea value={draftCrimeRaw.relations} onChange={e => setDraftCrimeRaw(prev => ({ ...prev, relations: e.target.value }))} placeholder="관계도 (줄바꿈 구분): from이름 | 관계타입 | to이름 | 설명" rows={4} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                <textarea value={draftCrimeRaw.storyFlow} onChange={e => setDraftCrimeRaw(prev => ({ ...prev, storyFlow: e.target.value }))} placeholder="게임 플레이 스토리 흐름 (줄바꿈 구분): 기|공간|설명 / 승|공간|설명 / 전|공간|설명 / 반전|공간|설명 / 결|공간|설명" rows={5} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text-primary)', fontSize: 12, fontFamily: 'inherit', outline: 'none', resize: 'vertical' }} />
                {draftCrimeEditError && <div style={{ fontSize: 11, color: '#f59e0b' }}>{draftCrimeEditError}</div>}
              </div>
            )}
            {project.crimeConfig && (() => {
              const crime = project.crimeConfig!
              const ROLE_COLORS: Record<string, string> = { '가해자': '#e74c3c', '피해자': '#e67e22', '목격자': '#1abc9c', '주변인물': '#95a5a6', '공범': '#9b59b6', '의뢰인': '#27ae60' }
              function charLabel(chars: typeof crime.characters, id: string) {
                const c = chars?.find(x => x.id === id)
                if (!c) return '?'
                if (c.name) return c.name
                const sameRole = chars!.filter(x => x.role === c.role)
                if (sameRole.length <= 1) return c.role
                const idx = sameRole.findIndex(x => x.id === id)
                return `${c.role} ${String.fromCharCode(65 + idx)}`
              }
              const RELATION_COLORS: Record<string, string> = { '원한': '#e74c3c', '연인': '#e91e8c', '가족': '#e67e22', '친구': '#27ae60', '동료': '#3498db', '공모자': '#9b59b6', '피고용': '#95a5a6', '피해': '#f39c12', '모르는 사이': '#7f8c8d', '기타': '#34495e' }
              const STAGE_LABELS: Record<string, string> = { '기': '기(발단)', '승': '승(전개)', '전': '전(절정)', '반전': '반전', '결': '결(결말)' }
              const perp = crime.characters?.find(c => c.role === '가해자')
              const vic = crime.characters?.find(c => c.role === '피해자')
              const perpName = perp?.name || perp?.role
              const vicName = vic?.name || vic?.role
              const hasCombination = crime.motives?.length || crime.crimeTypes?.length || perpName || vicName

              return (
                <div style={{ marginBottom: 16 }}>
                  {/* 장르 */}
                  {crime.genres?.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                      {crime.genres.map(g => <span key={g} style={{ fontSize: 11, padding: '3px 10px', borderRadius: 8, background: 'var(--accent-dim)', color: 'var(--accent)', fontWeight: 600 }}>{g}</span>)}
                    </div>
                  )}

                  {/* 조합 미리보기 */}
                  {hasCombination && (
                    <div style={{ background: 'linear-gradient(135deg, #1b2338 0%, #18263f 100%)', border: '1px solid rgba(180,255,80,0.55)', borderRadius: 16, padding: '18px 20px', marginBottom: 14, boxShadow: '0 10px 26px rgba(0,0,0,0.18)' }}>
                      <div style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 800, marginBottom: 10 }}>사건 조합</div>
                      <div style={{ fontSize: 14, lineHeight: 1.75, color: 'var(--text-primary)' }}>
                        {[
                          perpName && `${perpName}가`,
                          crime.motives?.[0] && `'${crime.motives[0]}' 동기로`,
                          vicName && `${vicName}를`,
                          crime.crimeTypes?.[0] && `${crime.crimeTypes[0]} 사건 발생.`,
                          crime.location && `${crime.location}에서`,
                          crime.clues?.[0] && `${crime.clues[0]}를 찾아내`,
                          crime.methods?.[0] && `${crime.methods[0]} 방식으로 수사.`,
                        ].filter(Boolean).join(' ')}
                      </div>
                    </div>
                  )}

                  {/* ABCD 요약 */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                    {[
                      { label: '[A] 범행동기', items: crime.motives ?? [], color: '#e74c3c' },
                      { label: '[B] 범행종류', items: crime.crimeTypes ?? [], color: '#e67e22' },
                      { label: '[C] 수사단서', items: crime.clues ?? [], color: '#27ae60' },
                      { label: '[D] 수사기법', items: crime.methods ?? [], color: '#3498db' },
                    ].map(({ label, items, color }) => items.length > 0 && (
                      <div key={label} style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${color}33`, borderRadius: 12, padding: '14px 15px' }}>
                        <div style={{ fontSize: 12, fontWeight: 800, color, marginBottom: 8 }}>{label}</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                          {items.map(item => <span key={item} style={{ fontSize: 12, padding: '3px 8px', borderRadius: 9, background: `${color}22`, color, fontWeight: 600 }}>{item}</span>)}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* 등장인물 */}
                  {crime.characters?.length > 0 && (
                    <div style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 15px', marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>등장인물</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {crime.characters.map(c => {
                          const color = ROLE_COLORS[c.role] ?? '#888'
                          const label = charLabel(crime.characters, c.id)
                          return (
                            <div key={c.id} style={{ background: `${color}22`, border: `1px solid ${color}44`, borderRadius: 8, padding: '5px 10px' }}>
                              <div style={{ fontSize: 12, fontWeight: 800, color }}>{label}</div>
                              {c.background && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.55 }}>{c.background}</div>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 관계도 */}
                  {crime.relations?.length > 0 && (
                    <div style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 15px', marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>인물 관계도</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {crime.relations.map(r => {
                          const color = RELATION_COLORS[r.relationType] ?? '#888'
                          return (
                            <div key={r.id} style={{ fontSize: 13, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                              <span style={{ fontWeight: 700 }}>{charLabel(crime.characters, r.fromId)}</span>
                              <span style={{ color: 'var(--text-muted)' }}>──</span>
                              <span style={{ padding: '2px 8px', borderRadius: 8, background: color, color: 'white', fontSize: 12, fontWeight: 800 }}>{r.relationType}</span>
                              <span style={{ color: 'var(--text-muted)' }}>──▶</span>
                              <span style={{ fontWeight: 700 }}>{charLabel(crime.characters, r.toId)}</span>
                              {r.description && <span style={{ color: 'var(--text-secondary)' }}>: {r.description}</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* 게임 플레이 스토리 흐름 */}
                  {crime.storyFlow?.some(s => s.description || s.roomName) && (
                    <div style={{ background: 'rgba(255,255,255,0.018)', border: '1px solid var(--border)', borderRadius: 14, padding: '14px 15px', marginBottom: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 10 }}>게임 플레이 스토리 흐름</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        {crime.storyFlow.filter(s => s.description || s.roomName).map(s => (
                          <div key={s.stage} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, fontSize: 13, lineHeight: 1.65 }}>
                            <span style={{ fontWeight: 700, color: 'var(--accent)', minWidth: 28 }}>{STAGE_LABELS[s.stage] || s.stage}</span>
                            <div>
                              {s.roomName && <span style={{ background: 'var(--bg-secondary)', borderRadius: 5, padding: '2px 7px', fontSize: 12, marginRight: 6, color: 'var(--text-primary)' }}>📍 {s.roomName}</span>}
                              {s.description && <span style={{ color: 'var(--text-secondary)' }}>{s.description}</span>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )
            })()}
            {/* 사전 브리핑 섹션 — 드래프트 */}
            {!isReadonlyDraftView && (
              <>
                <BriefingSection project={project} activeAgentIds={activeAgentIds()} onUpdate={reload} />

                <div style={{ textAlign: 'center', padding: '28px 24px', background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>에이전트 협업 시작</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 20 }}>
                    에이전트들이 사건 설정을 바탕으로 기획안을 작성합니다
                  </div>
                  {(() => {
                    const briefedCount = Object.values(project.briefings ?? {}).filter(b => b?.completedAt).length
                    return (
                      <button onClick={startCollaboration} style={{
                        padding: '10px 28px', borderRadius: 10, border: 'none',
                        background: 'var(--accent)', color: 'var(--accent-fg)',
                        fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      }}>
                        {briefedCount > 0 ? `협업 시작 (브리핑 ${briefedCount}개 반영)` : '협업 시작하기'}
                      </button>
                    )
                  })()}
                </div>
              </>
            )}
          </div>
        )}

        {/* 협업 실행 버튼 (일반 버전) */}
        {!running && displayReports.length === 0 && activeVersion?.status !== 'draft' && (
          <div style={{ padding: '24px 0' }}>
            <BriefingSection project={project} activeAgentIds={activeAgentIds()} onUpdate={reload} />

            <div style={{ textAlign: 'center', padding: '32px 24px' }}>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8 }}>에이전트 협업 시작</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 24 }}>
                에이전트들이 순서대로 기획안을 작성하고 최종 보고서를 생성합니다
              </div>
              {(() => {
                const briefedCount = Object.values(project.briefings ?? {}).filter(b => b?.completedAt).length
                return (
                  <button onClick={startCollaboration} style={{
                    padding: '10px 28px', borderRadius: 10, border: 'none',
                    background: 'var(--accent)', color: 'var(--accent-fg)',
                    fontSize: 13, fontWeight: 700, cursor: 'pointer',
                  }}>
                    {briefedCount > 0 ? `협업 시작 (브리핑 ${briefedCount}개 반영)` : '협업 시작하기'}
                  </button>
                )
              })()}
            </div>
          </div>
        )}

        {/* 진행 중 or 완료된 보고서 */}
        {displayReports.length > 0 && (running || activeTab === 'reports') && (
          <>
            {(running || generatingFinal) && (
              <div
                className="project-working-frame"
                style={{
                  position: 'relative',
                  marginBottom: 16,
                  padding: '18px 20px',
                  borderRadius: 18,
                  border: '1px solid rgba(201,255,84,0.18)',
                  background: 'radial-gradient(circle at top left, rgba(201,255,84,0.12), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.015))',
                  boxShadow: '0 18px 34px rgba(0,0,0,0.22)',
                  overflow: 'hidden',
                }}
              >
                <div
                  className="project-working-scan"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: 'linear-gradient(180deg, transparent 0%, rgba(201,255,84,0.08) 48%, transparent 100%)',
                    pointerEvents: 'none',
                  }}
                />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 260, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                      <span className="project-working-led" style={{
                        width: 11,
                        height: 11,
                        borderRadius: '50%',
                        background: '#c9ff54',
                        boxShadow: '0 0 16px rgba(201,255,84,0.72)',
                      }} />
                      <span style={{ fontSize: 12, fontWeight: 800, color: '#efffb8', letterSpacing: '0.12em' }}>
                        AI COLLABORATION WORK MODE
                      </span>
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 6 }}>
                      {generatingFinal
                        ? '최종 보고서 종합 중'
                        : `${currentAgentDef?.name ?? '에이전트'} 작업 실행 중`}
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: 14, maxWidth: 720 }}>
                      {generatingFinal
                        ? '각 에이전트 결과를 취합해 크리에이티브 디렉터 최종 보고서를 정리하고 있습니다.'
                        : `${currentAgentDef?.role ?? '기획 담당'} 관점에서 브리핑, 사건 설정, 첨부 맥락을 결합해 보고서를 생성하고 있습니다.`}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
                      {[
                        { label: '경과 시간', value: formatDuration(collaborationElapsedSeconds) },
                        { label: '예상 남은 시간', value: formatDuration(estimatedRemainingSeconds) },
                        { label: '예상 완료', value: collaborationStartedAt ? new Date(progressClock + (estimatedRemainingSeconds * 1000)).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-' },
                      ].map(item => (
                        <div key={item.label} style={{
                          padding: '8px 10px',
                          borderRadius: 12,
                          border: '1px solid rgba(255,255,255,0.08)',
                          background: 'rgba(255,255,255,0.025)',
                          minWidth: 118,
                        }}>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginBottom: 3 }}>{item.label}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 700 }}>{item.value}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 }}>
                        <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>진행률</span>
                        <span style={{ fontSize: 12, color: '#efffb8', fontWeight: 800 }}>{collaborationPercent}%</span>
                      </div>
                      <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.04)' }}>
                        <div
                          className="project-working-progress"
                          style={{
                            width: `${collaborationPercent}%`,
                            height: '100%',
                            borderRadius: 999,
                            background: 'linear-gradient(90deg, #c9ff54 0%, #8ce8ff 52%, #9d7bff 100%)',
                            boxShadow: '0 0 14px rgba(201,255,84,0.25)',
                          }}
                        />
                      </div>
                    </div>
                    <div style={{
                      marginTop: 14,
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 14,
                      background: 'rgba(255,255,255,0.018)',
                      padding: '11px 12px',
                    }}>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 8 }}>실행 로그</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 130, overflowY: 'auto' }}>
                        {collaborationLogs.length === 0 ? (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>아직 기록된 로그가 없습니다.</div>
                        ) : collaborationLogs.map(log => (
                          <div key={log.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                            <span style={{
                              width: 7,
                              height: 7,
                              marginTop: 5,
                              borderRadius: '50%',
                              background: log.level === 'success'
                                ? '#4ade80'
                                : log.level === 'warning'
                                  ? '#facc15'
                                  : log.level === 'error'
                                    ? '#f87171'
                                    : '#8ce8ff',
                              flexShrink: 0,
                            }} />
                            <div style={{ minWidth: 0 }}>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                                {new Date(log.at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </div>
                              <div style={{ fontSize: 11.5, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                                {log.message}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div style={{
                    width: 320,
                    maxWidth: '100%',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 16,
                    background: 'rgba(8,10,14,0.24)',
                    padding: '14px 14px 12px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>작업 파이프라인</span>
                      <button
                        onClick={handleStopCollaboration}
                        style={{
                          display: 'inline-flex', alignItems: 'center', gap: 5,
                          padding: '5px 12px',
                          borderRadius: 8,
                          border: '1.5px solid rgba(248,113,113,0.5)',
                          background: 'rgba(248,113,113,0.12)',
                          color: '#fca5a5',
                          fontSize: 11.5,
                          fontWeight: 700,
                          cursor: 'pointer',
                          letterSpacing: '0.03em',
                        }}
                      >
                        <svg width="9" height="9" viewBox="0 0 9 9" fill="currentColor"><rect width="9" height="9" rx="1.5"/></svg>
                        작업 중지
                      </button>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {workflowAgentIds.map((agentId, index) => {
                        const agent = AGENTS.find(a => a.id === agentId)
                        const agentReport = displayReports.find(r => r.agentId === agentId)
                        const isDone = agentReport?.status === 'done'
                        const isFailed = isDone && (agentReport?.summary ?? '').includes('오류')
                        const isActive = !generatingFinal && runningAgentId === agentId
                        const dotColor = isFailed ? '#ef4444' : isDone ? 'var(--success)' : isActive ? '#c9ff54' : 'rgba(148,163,184,0.55)'
                        return (
                          <div key={agentId} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 10,
                            padding: '8px 10px',
                            borderRadius: 11,
                            border: `1px solid ${isActive ? `${agent?.color ?? '#c9ff54'}44` : isFailed ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.05)'}`,
                            background: isActive ? `${agent?.color ?? '#c9ff54'}14` : isFailed ? 'rgba(239,68,68,0.06)' : 'rgba(255,255,255,0.015)',
                          }}>
                            <span style={{
                              width: 9,
                              height: 9,
                              borderRadius: '50%',
                              background: dotColor,
                              boxShadow: isActive ? '0 0 12px rgba(201,255,84,0.65)' : isFailed ? '0 0 6px rgba(239,68,68,0.4)' : 'none',
                              animation: isActive ? 'projectWorkingPulse 1.2s ease-in-out infinite' : 'none',
                              flexShrink: 0,
                            }} />
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 12.5, color: isFailed ? '#fca5a5' : 'var(--text-primary)', fontWeight: 700 }}>{agent?.name ?? agentId}</div>
                              <div style={{ fontSize: 10.5, color: isFailed ? '#fca5a5' : 'var(--text-muted)', marginTop: 2 }}>
                                {isFailed ? '오류' : isDone ? '완료' : isActive ? '생성 중' : `대기 ${index + 1}`}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                      <div style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '8px 10px',
                        borderRadius: 11,
                        border: `1px solid ${generatingFinal ? 'rgba(201,255,84,0.26)' : 'rgba(255,255,255,0.05)'}`,
                        background: generatingFinal ? 'rgba(201,255,84,0.09)' : 'rgba(255,255,255,0.015)',
                      }}>
                        <span style={{
                          width: 9,
                          height: 9,
                          borderRadius: '50%',
                          background: displayFinalClean ? 'var(--success)' : generatingFinal ? '#c9ff54' : 'rgba(148,163,184,0.55)',
                          boxShadow: generatingFinal ? '0 0 12px rgba(201,255,84,0.65)' : 'none',
                          animation: generatingFinal ? 'projectWorkingPulse 1.2s ease-in-out infinite' : 'none',
                          flexShrink: 0,
                        }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12.5, color: 'var(--text-primary)', fontWeight: 700 }}>최종 보고서 종합</div>
                          <div style={{ fontSize: 10.5, color: 'var(--text-muted)', marginTop: 2 }}>
                            {displayFinalClean ? '완료' : generatingFinal ? '종합 중' : '대기'}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            {!running && !generatingFinal && activeTab === 'reports' && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <button
                  onClick={handleRerunAll}
                  style={{
                    padding: '9px 14px',
                    borderRadius: 10,
                    border: '1px solid rgba(251,191,36,0.34)',
                    background: 'rgba(251,191,36,0.1)',
                    color: '#fcd34d',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                  }}
                >
                  <RefreshIcon width={13} height={13} />
                  전체 재실행
                </button>
                {displayFinalClean?.summary?.includes('오류') && (
                  <button
                    onClick={handleRerunFinalOnly}
                    style={{
                      padding: '9px 14px',
                      borderRadius: 10,
                      border: '1px solid rgba(99,179,237,0.34)',
                      background: 'rgba(99,179,237,0.1)',
                      color: '#90cdf4',
                      fontSize: 12,
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                    }}
                  >
                    <RefreshIcon width={13} height={13} />
                    최종 보고서만 재시도
                  </button>
                )}
              </div>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
              {displayReports.map((report, index) => (
                <ReportCard
                  key={report.agentId}
                  report={report}
                  isRunning={runningAgentId === report.agentId}
                  queuePosition={runningAgentId === report.agentId ? undefined : (report.status === 'pending' ? index + 1 : undefined)}
                  showRetryFromHere={report.agentId === firstFailedAgentId}
                  onRetryFromHere={() => handleRerunFromAgent(report.agentId)}
                  onRefresh={!running && !generatingFinal && report.status === 'done' ? () => handleRefreshSingleAgent(report.agentId) : undefined}
                  isRefreshing={refreshingAgents.has(report.agentId)}
                  projectContext={`프로젝트: ${project.theme}\n${project.crimeConfig ? `장르: ${project.crimeConfig.genres?.join(', ')} / 장소: ${project.crimeConfig.location}` : ''}`}
                  previousReports={displayReports.filter(r => r.agentId !== report.agentId)}
                  onNewVersion={handleNewVersion}
                  onChatSave={handleChatSave}
                  onDeleteVersion={handleDeleteVersion}
                  onSetActiveVersion={handleSetActiveVersion}
                />
              ))}
            </div>

            {/* 팀장 최종 보고서 */}
            {generatingFinal && (
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--accent)44',
                borderRadius: 14, padding: '16px 20px',
                display: 'flex', alignItems: 'center', gap: 10,
              }}>
                <Spinner size={14} color="var(--accent)" />
                <span style={{ fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>CD 최종 보고서 작성 중...</span>
              </div>
            )}

            {displayFinalClean && (
              <div style={{
                background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 14, overflow: 'hidden', marginTop: 10,
                boxShadow: '0 8px 18px rgba(0,0,0,0.08)',
              }}>
                {/* 최종 보고서 헤더 */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '14px 16px',
                  borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 32, height: 32, flexShrink: 0,
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                    borderRadius: 10,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--accent)',
                  }}>
                    <AgentIconCeo width={15} height={15} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>최종 보고서</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>크리에이티브 디렉터 종합</div>
                  </div>
                  <div style={{ display: 'flex', gap: 5 }}>
                    {[
                      { active: !showDetail, onClick: () => setShowDetail(false), title: '요약 보기', icon: <ListIcon width={13} height={13} /> },
                      { active: showDetail, onClick: () => setShowDetail(true), title: '상세 보기', icon: <EyeIcon width={13} height={13} /> },
                    ].map((btn, i) => (
                      <button key={i} onClick={btn.onClick} title={btn.title} style={{
                        width: 28, height: 28, padding: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 8,
                        border: `1px solid ${btn.active ? 'var(--border-bright)' : 'var(--border)'}`,
                        background: btn.active ? 'var(--bg-secondary)' : 'transparent',
                        color: btn.active ? 'var(--text-primary)' : 'var(--text-muted)', cursor: 'pointer',
                      }}>{btn.icon}</button>
                    ))}
                    <button onClick={handleRerunAll} title="전체 재실행" style={{
                      width: 28, height: 28, padding: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      borderRadius: 8, border: '1px solid var(--accent)44',
                      background: 'var(--accent-dim)', color: 'var(--accent-text)', cursor: 'pointer',
                    }}>
                      <DownloadIcon width={13} height={13} />
                    </button>
                  </div>
                </div>

                {/* 최종 보고서 내용 */}
                <div style={{ padding: '16px' }}>
                  {finalEditMode ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>요약</div>
                      <textarea
                        value={finalEditSummary}
                        onChange={e => setFinalEditSummary(e.target.value)}
                        rows={6}
                        style={{
                          width: '100%',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: '10px 11px',
                          color: 'var(--text-primary)',
                          fontSize: 12.5,
                          lineHeight: 1.65,
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          outline: 'none',
                        }}
                      />
                      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>상세</div>
                      <textarea
                        value={finalEditDetail}
                        onChange={e => setFinalEditDetail(e.target.value)}
                        rows={16}
                        style={{
                          width: '100%',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border)',
                          borderRadius: 8,
                          padding: '10px 11px',
                          color: 'var(--text-primary)',
                          fontSize: 12.5,
                          lineHeight: 1.65,
                          resize: 'vertical',
                          fontFamily: 'inherit',
                          outline: 'none',
                          whiteSpace: 'pre-wrap',
                        }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button
                          onClick={() => {
                            setFinalEditMode(false)
                            setFinalEditSummary(displayFinalClean.summary ?? '')
                            setFinalEditDetail((finalDetailSplit?.plain || displayFinalClean.detail || '').trim())
                          }}
                          style={{
                            height: 30,
                            padding: '0 12px',
                            borderRadius: 8,
                            border: '1px solid var(--border)',
                            background: 'transparent',
                            color: 'var(--text-muted)',
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: 'pointer',
                          }}
                        >
                          취소
                        </button>
                        <button
                          onClick={saveFinalReportManualEdit}
                          style={{
                            height: 30,
                            padding: '0 12px',
                            borderRadius: 8,
                            border: '1px solid var(--accent)',
                            background: 'var(--accent)',
                            color: 'var(--accent-fg)',
                            fontSize: 12,
                            fontWeight: 700,
                            cursor: 'pointer',
                          }}
                        >
                          저장
                        </button>
                      </div>
                    </div>
                  ) : showDetail ? (() => {
                    if (finalDetailSplit?.html) {
                      const html = finalDetailSplit.html
                      return (
                        <div
                          data-report-html
                          style={{ fontSize: 12.5, lineHeight: 1.72, color: 'var(--text-secondary)', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: 16, overflowX: 'auto' }}
                          dangerouslySetInnerHTML={{ __html: stripOperatingBudgetSectionHtml(html) }}
                        />
                      )
                    }
                    return <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.72, whiteSpace: 'pre-wrap', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 10, padding: 16 }}>{finalDetailSplit?.plain || displayFinalClean.detail}</div>
                  })() : (
                    <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.72, whiteSpace: 'pre-wrap' }}>{displayFinalClean.summary}</div>
                  )}
                </div>
              </div>
            )}
          </>
        )}

        {/* 게임 플로우 시트 탭 */}
        {!running && activeTab === 'gameflow' && hasCompletedReports && (
          <div>
            {activeVersion?.gameFlow ? (
              <>
                {/* 에러 배너 */}
                {gameFlowError && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.35)',
                    borderRadius: 10, padding: '10px 16px', marginBottom: 14,
                  }}>
                    <div style={{ fontSize: 12, color: '#f87171' }}>
                      ❌ <strong>보고서 반영 실패:</strong>{' '}
                      <span style={{ color: '#94a3b8' }}>{gameFlowError}</span>
                    </div>
                    <button onClick={() => setGameFlowError(null)} style={{
                      background: 'none', border: 'none', color: '#94a3b8',
                      fontSize: 16, cursor: 'pointer', flexShrink: 0, marginLeft: 12, lineHeight: 1,
                    }}>×</button>
                  </div>
                )}

                {/* Stale 경고 배너 */}
                {isGameFlowStale && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    background: '#3a2a0066', border: '1px solid #f59e0b55',
                    borderRadius: 10, padding: '10px 16px', marginBottom: 14,
                  }}>
                    <div style={{ fontSize: 12, color: '#fbbf24' }}>
                      ⚠ <strong>에이전트 보고서가 업데이트되었습니다.</strong>{' '}
                      <span style={{ color: '#94a3b8' }}>최신 보고서를 게임 플로우 시트에 반영하세요.</span>
                    </div>
                    <button onClick={generateGameFlow} disabled={generatingGameFlow}
                      title="보고서 반영하기"
                      style={{
                        width: 32, height: 32, padding: 0, flexShrink: 0, marginLeft: 12,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        borderRadius: 8, border: 'none',
                        background: '#f59e0b', color: '#000',
                        cursor: generatingGameFlow ? 'not-allowed' : 'pointer',
                        opacity: generatingGameFlow ? 0.5 : 1,
                      }}>
                      {generatingGameFlow ? <Spinner size={13} color="#000" /> : <DownloadIcon width={15} height={15} />}
                    </button>
                  </div>
                )}
                {/* 테이블/맵 뷰 토글 */}
                {(() => {
                  const syncedAt = gameFlowSyncedAt || activeVersion?.gameFlow?.generatedAt
                  const syncLabel = syncedAt ? (() => {
                    const d = new Date(syncedAt)
                    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
                  })() : null
                  const syncTitle = generatingGameFlow
                    ? '반영 중...'
                    : isGameFlowStale
                      ? `보고서 재반영${syncLabel ? ` · 마지막: ${syncLabel}` : ''}`
                      : syncLabel
                        ? `보고서 반영하기 · 마지막: ${syncLabel}`
                        : '보고서 반영하기'
                  const dotColor = isGameFlowStale ? '#f59e0b' : syncedAt ? '#3fb950' : null

                  return (
                    <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center', overflow: 'visible', paddingBottom: 4 }}>
                      {[
                        { key: 'table', label: 'Step Table' },
                        { key: 'map', label: 'Pass Map' },
                        { key: 'user', label: 'User Flow' },
                        ...(hasSurround ? [{ key: 'script', label: '🎧 Script' }] : []),
                      ].map(v => (
                        <button key={v.key} onClick={() => setGameflowView(v.key as 'table' | 'map' | 'user' | 'script')} style={{
                          padding: '6px 14px', borderRadius: 8, border: 'none',
                          background: gameflowView === v.key ? (v.key === 'script' ? '#8b5cf6' : 'var(--accent)') : 'var(--bg-card)',
                          color: gameflowView === v.key ? (v.key === 'script' ? '#fff' : 'var(--accent-fg)') : v.key === 'script' ? '#a78bfa' : 'var(--text-muted)',
                          fontSize: 12, fontWeight: gameflowView === v.key ? 700 : 400,
                          cursor: 'pointer', transition: 'all 0.15s',
                          outline: v.key === 'script' && gameflowView !== 'script' ? '1px solid rgba(167,139,250,0.3)' : 'none',
                        }}>{v.label}</button>
                      ))}

                      {/* 테이블 뷰: 보고서 반영 / 맵 뷰: 테이블 반영 */}
                      {gameflowView === 'table' ? (
                        <div style={{ marginLeft: 'auto', position: 'relative', display: 'flex', alignItems: 'center', overflow: 'visible', minHeight: 36 }}>
                          <button onClick={generateGameFlow} disabled={generatingGameFlow} title={syncTitle} style={{
                            width: 32, height: 32, padding: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            borderRadius: 8,
                            border: `1px solid ${isGameFlowStale ? '#f59e0b66' : 'var(--border)'}`,
                            background: isGameFlowStale ? '#3a2a0055' : 'transparent',
                            color: isGameFlowStale ? '#fbbf24' : 'var(--text-muted)',
                            cursor: generatingGameFlow ? 'not-allowed' : 'pointer',
                            opacity: generatingGameFlow ? 0.6 : 1,
                            transition: 'background 0.15s, border-color 0.15s',
                          }}>
                            {generatingGameFlow
                              ? <Spinner size={13} />
                              : isGameFlowStale
                                ? <RefreshIcon width={15} height={15} />
                                : <DownloadIcon width={15} height={15} />}
                          </button>
                          {dotColor && (
                            <span style={{
                              position: 'absolute', bottom: -2, right: -2,
                              width: 8, height: 8, borderRadius: '50%',
                              background: dotColor,
                              border: '1.5px solid var(--bg-primary)',
                              pointerEvents: 'none',
                            }} />
                          )}
                        </div>
                      ) : gameflowView === 'map' ? (
                        <div style={{ marginLeft: 'auto', position: 'relative', display: 'flex', alignItems: 'center', overflow: 'visible', minHeight: 36 }}>
                          <button aria-label="테이블 반영하기 — 스텝을 패스맵에 자동 배치" onClick={() => {
                            if (!activeVersion?.gameFlow) return
                            const sheet = activeVersion.gameFlow
                            const cols = 5
                            const colGap = 18, rowGap = 22
                            const startX = 8, startY = 12
                            let globalIdx = 0
                            const newSheet = {
                              ...sheet,
                              sections: sheet.sections.map((sec, si) => ({
                                ...sec,
                                // 규칙: 테이블 반영 시 섹션 모양(도형/셀)은 절대 변경하지 않는다.
                                mapBox: sec.mapBox,
                                mapCells: sec.mapCells,
                                steps: sec.steps.map((step, _stepIdx) => {
                                  const col = globalIdx % cols
                                  const pinX = startX + col * colGap
                                  const pinY = startY + (si * rowGap) + (Math.floor(globalIdx / cols) * rowGap)
                                  globalIdx++
                                  return { ...step, pinX: Math.min(pinX, 92), pinY: Math.min(pinY, 88) }
                                }),
                              })),
                            }
                            handleGameFlowChange(newSheet)
                          }} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                            height: 32, padding: '0 12px',
                            borderRadius: 8, border: '1px solid var(--accent)55',
                            background: 'var(--accent-dim)', color: 'var(--accent)',
                            cursor: 'pointer', transition: 'background 0.15s',
                            whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700,
                          }}>
                            <DownloadIcon width={15} height={15} />
                            <span>테이블 반영</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  )
                })()}

                {gameflowView === 'table' && (
                  <GameFlowTable
                    sheet={activeVersion.gameFlow}
                    onChange={handleGameFlowChange}
                  />
                )}
                {gameflowView === 'map' && (
                  <GameFlowMap
                    sheet={activeVersion.gameFlow}
                    floorPlanImage={project.attachments?.find(a => a.type === 'image') ?? null}
                    onChange={handleGameFlowChange}
                    mode="path"
                    projectName={project.name}
                  />
                )}
                {gameflowView === 'user' && (
                  <GameFlowMap
                    sheet={activeVersion.gameFlow}
                    floorPlanImage={project.attachments?.find(a => a.type === 'image') ?? null}
                    onChange={handleGameFlowChange}
                    mode="user"
                    projectName={project.name}
                  />
                )}
                {gameflowView === 'script' && hasSurround && (
                  <AudioScriptTable
                    script={activeVersion.audioScript}
                    onChange={handleAudioScriptChange}
                  />
                )}
              </>
            ) : (
              <div style={{ textAlign: 'center', padding: '64px 24px', background: 'var(--bg-card)', borderRadius: 16, border: '1px solid var(--border)' }}>
                {generatingGameFlow ? (() => {
                  const GF_LOGS = [
                    { at: 0,  msg: '에이전트 보고서 로드 완료', done: true },
                    { at: 2,  msg: '섹션·단계 구조 분석 중...', done: false },
                    { at: 15, msg: 'AI에 게임 플로우 생성 요청 완료', done: true },
                    { at: 20, msg: 'JSON 플로우 시트 생성 중...', done: false },
                    { at: 60, msg: '복잡한 구조 처리 중... (정상)', done: false },
                    { at: 120, msg: '스텝 배치 마무리 중...', done: false },
                  ]
                  const fmtT = (s: number) => `${Math.floor(s/60).toString().padStart(2,'0')}:${(s%60).toString().padStart(2,'0')}`
                  const visibleLogs = GF_LOGS.filter(l => gameFlowElapsed >= l.at)
                  return (
                    <div style={{ textAlign: 'left', maxWidth: 480, margin: '0 auto' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)', animation: 'pulse 1.5s ease-in-out infinite' }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.08em' }}>GAME FLOW COMPILING</span>
                        <span style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>{fmtT(gameFlowElapsed)}</span>
                      </div>
                      <div style={{ background: '#0a0a0d', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', fontFamily: 'monospace', fontSize: 12, display: 'flex', flexDirection: 'column', gap: 6, minHeight: 120 }}>
                        {visibleLogs.map((l, i) => (
                          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                            <span style={{ color: 'var(--text-muted)', flexShrink: 0 }}>{fmtT(l.at)}</span>
                            <span style={{ color: l.done ? '#c8ff40' : '#909098' }}>{l.done ? '✓' : '›'}</span>
                            <span style={{ color: l.done ? '#c8ff40' : 'var(--text-secondary)' }}>{l.msg}</span>
                            {i === visibleLogs.length - 1 && !l.done && (
                              <span style={{ display: 'inline-block', width: 8, height: 13, background: 'var(--text-muted)', animation: 'pulse 1s ease-in-out infinite', verticalAlign: 'middle', marginLeft: 2 }} />
                            )}
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 10, height: 3, background: 'var(--bg-secondary)', borderRadius: 99, overflow: 'hidden' }}>
                        <div style={{ height: '100%', background: 'linear-gradient(90deg, var(--accent), #60b8ff)', borderRadius: 99, animation: 'gameflow-progress 2s ease-in-out infinite', width: '40%' }} />
                      </div>
                      <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text-muted)', textAlign: 'center' }}>
                        페이지를 나가면 작업이 중단될 수 있습니다
                      </div>
                      <style>{`@keyframes gameflow-progress { 0%{transform:translateX(-100%)} 100%{transform:translateX(350%)} }`}</style>
                    </div>
                  )
                })()
                ) : (
                  <>
                    <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.25 }}>◈</div>
                    <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>게임 플로우 미생성</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24, maxWidth: 400, margin: '0 auto 24px' }}>
                      에이전트 보고서를 기반으로 섹션·단계별 게임 플로우를 자동 구조화합니다
                    </div>
                    {gameFlowError && (
                      <div style={{
                        maxWidth: 520,
                        margin: '0 auto 18px',
                        padding: '12px 14px',
                        borderRadius: 12,
                        background: 'rgba(239,68,68,0.1)',
                        border: '1px solid rgba(239,68,68,0.35)',
                        color: '#fca5a5',
                        fontSize: 12.5,
                        lineHeight: 1.6,
                      }}>
                        <strong style={{ color: '#f87171' }}>보고서 반영 실패</strong>
                        <div style={{ marginTop: 4, color: '#cbd5e1' }}>{gameFlowError}</div>
                      </div>
                    )}
                    <button onClick={generateGameFlow} style={{
                      padding: '12px 32px', borderRadius: 12, border: 'none',
                      background: 'var(--accent)', color: 'var(--accent-fg)',
                      fontSize: 15, fontWeight: 700, cursor: 'pointer',
                    }}>
                      에이전트 보고서 반영하기
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* 기획 회의실 탭 */}
        {activeTab === 'workshop' && hasCompletedReports && (
          <WorkshopTab
            project={project}
            activeVersion={activeVersion}
            activeAgentIds={activeAgentIds()}
            running={running}
            onRerunFromAgent={handleRerunFromAgent}
            onUpdate={reload}
          />
        )}

        {/* 메타 스튜디오 탭 */}
        {!running && activeTab === 'studio' && hasCompletedReports && (
          <MetaStudio key={`${project.id}-${studioMountKey}`} gameFlowSheet={activeVersion?.gameFlow} showEmbeddedSaveHistory={false} />
        )}
      </main>

      {costConfirmModal}
    </div>
  )
}
