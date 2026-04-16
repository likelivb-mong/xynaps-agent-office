import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { AGENTS } from '../data/agents'
import { BRANCH_CODES } from '../data/questData'
import { AgentCard } from '../components/agents/AgentCard'
import { CommonSkillCard } from '../components/agents/CommonSkillCard'
import { getProjects, duplicateProject, getAllSkills, getCommonSkills, saveProject, getTrashedProjects, moveProjectToTrash, restoreProjectFromTrash, permanentlyDeleteProjectFromTrash, syncProjectsFromSupabase } from '../lib/storage'
import type { Project, SkillFile, AgentId, BranchCode } from '../types'
import { CopyIcon, TrashIcon, WorkflowIcon, WriteIcon, CloseIcon, RefreshIcon } from '../components/ui/Icon'
import { useAuth } from '../contexts/AuthContext'

export function HomePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, signOut } = useAuth()
  const [skills, setSkills] = useState<Record<AgentId, SkillFile[]>>({} as Record<AgentId, SkillFile[]>)
  const [commonSkills, setCommonSkills] = useState<SkillFile[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [trashedProjects, setTrashedProjects] = useState<Array<Project & { deletedAt: string }>>([])
  const [showTrash, setShowTrash] = useState(false)
  const [projectBranchFilter, setProjectBranchFilter] = useState<'all' | BranchCode>('all')
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editName, setEditName] = useState('')
  const [editTheme, setEditTheme] = useState('')
  const [editBranches, setEditBranches] = useState<BranchCode[]>([])

  function reloadSkills() {
    setSkills(getAllSkills())
    setCommonSkills(getCommonSkills())
  }

  useEffect(() => {
    reloadSkills()
    setProjects(getProjects())
    setTrashedProjects(getTrashedProjects())
    // Supabase에서 최신 프로젝트 동기화
    syncProjectsFromSupabase().then(() => {
      setProjects(getProjects())
      setTrashedProjects(getTrashedProjects())
    })
  }, [location])

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProjects(getProjects())
      setTrashedProjects(getTrashedProjects())
    }, 1200)
    return () => window.clearInterval(timer)
  }, [])

  function openEditModal(project: Project) {
    setEditingProject(project)
    setEditName(project.name)
    setEditTheme(project.theme)
    setEditBranches((project.branches ?? []).slice(0, 1))
  }

  function closeEditModal() {
    setEditingProject(null)
    setEditName('')
    setEditTheme('')
    setEditBranches([])
  }

  function toggleBranch(code: BranchCode) {
    setEditBranches([code])
  }

  function saveProjectBasicInfo() {
    if (!editingProject) return
    const trimmedName = editName.trim()
    const trimmedTheme = editTheme.trim()
    if (!trimmedName || !trimmedTheme) return
    saveProject({
      ...editingProject,
      name: trimmedName,
      theme: trimmedTheme,
      branches: editBranches.slice(0, 1),
      updatedAt: new Date().toISOString(),
    })
    setProjects(getProjects())
    closeEditModal()
  }

  function reloadProjectLists() {
    setProjects(getProjects())
    setTrashedProjects(getTrashedProjects())
  }

  const filteredProjects = projectBranchFilter === 'all'
    ? projects
    : projects.filter(project => (project.branches ?? []).includes(projectBranchFilter))

  function getProjectFolderGradient(project: Project, index: number) {
    const seed = (project.id.length + index) % 6
    if (seed === 0) return 'linear-gradient(135deg, #58a9ff 0%, #6f7dff 52%, #0f1534 100%)'
    if (seed === 1) return 'linear-gradient(135deg, #ff8d76 0%, #ff4b61 50%, #5a1f3b 100%)'
    if (seed === 2) return 'linear-gradient(135deg, #63efc7 0%, #39c281 46%, #10291f 100%)'
    if (seed === 3) return 'linear-gradient(135deg, #ffc96d 0%, #ff8c73 48%, #44263a 100%)'
    if (seed === 4) return 'linear-gradient(135deg, #e8a2ff 0%, #8579ff 50%, #2b1d50 100%)'
    return 'linear-gradient(135deg, #90a2ff 0%, #53d5ff 50%, #1a2a44 100%)'
  }

  function hasStudioSaved(projectId: string) {
    const mapRaw = localStorage.getItem(`xynaps_meta_map_${projectId}`)
    if (!mapRaw) return false
    try {
      const parsed = JSON.parse(mapRaw)
      if (Array.isArray(parsed)) return parsed.length > 0
      if (parsed && typeof parsed === 'object') return Object.keys(parsed).length > 0
      return false
    } catch {
      return mapRaw.length > 0
    }
  }

  function getProjectStage(project: Project) {
    const hasReport = project.versions.some(v =>
      (v.agentReports?.length ?? 0) > 0 || !!v.finalReport || v.status === 'completed'
    )
    const hasGameFlow = project.versions.some(v => !!v.gameFlow)
    const hasStudio = hasStudioSaved(project.id)
    if (hasStudio) return '스튜디오'
    if (hasGameFlow) return '게임플로우'
    if (hasReport) return '보고서'
    return '초안'
  }

  function getStageStyle(stage: string) {
    if (stage === '스튜디오') return { bg: '#4ade8022', border: '#4ade8044', color: '#4ade80' }
    if (stage === '게임플로우') return { bg: '#60a5fa22', border: '#60a5fa44', color: '#7cb8ff' }
    if (stage === '보고서') return { bg: '#fbbf2422', border: '#fbbf2444', color: '#facc65' }
    return { bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.15)', color: '#d2d8ec' }
  }

  function formatElapsed(startedAt?: string) {
    if (!startedAt) return '방금 시작'
    const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(startedAt)) / 1000))
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return mins > 0 ? `${mins}분 ${secs.toString().padStart(2, '0')}초 진행` : `${secs}초 진행`
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* 헤더 */}
      <header style={{
        padding: '16px 28px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.5px', color: 'var(--text-primary)' }}>
            XYNAPS
          </div>
          <span style={{
            fontSize: 10, color: 'var(--text-muted)', fontWeight: 400,
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            padding: '2px 7px', borderRadius: 5, letterSpacing: '0.02em',
          }}>
            Agent Office
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <Link to="/workflow" title="협업 플로우" style={{
            padding: '6px 12px', borderRadius: 8,
            border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-muted)',
            fontSize: 12, fontWeight: 500, cursor: 'pointer',
            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5,
            transition: 'border-color 0.15s, color 0.15s',
          }}
            onMouseEnter={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={(e: React.MouseEvent<HTMLAnchorElement>) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <WorkflowIcon />
            협업 플로우
          </Link>
          {user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
              <div style={{
                fontSize: 12, color: 'var(--text-muted)',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                padding: '4px 10px', borderRadius: 6,
              }}>
                {user.displayName}
              </div>
              <button
                onClick={async () => { await signOut(); navigate('/login') }}
                title="로그아웃"
                style={{
                  padding: '5px 10px', borderRadius: 6,
                  border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-muted)',
                  fontSize: 11, cursor: 'pointer',
                  transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={(e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                로그아웃
              </button>
            </div>
          )}
        </div>
      </header>

      <main style={{ flex: 1, padding: '28px', maxWidth: 1200, margin: '0 auto', width: '100%' }}>
        <style>{`
          .home-project-working-led {
            animation: homeProjectPulse 1.2s ease-in-out infinite;
          }
          .home-project-working-bar {
            animation: homeProjectBar 1.5s ease-in-out infinite alternate;
          }
          @keyframes homeProjectPulse {
            0%, 100% { opacity: 0.45; transform: scale(0.94); }
            50% { opacity: 1; transform: scale(1); }
          }
          @keyframes homeProjectBar {
            from { transform: translateX(-8%); }
            to { transform: translateX(4%); }
          }
        `}</style>

        {/* 에이전트 팀 & 스킬 섹션 */}
        <section style={{ marginBottom: 40 }}>
          <div style={{ marginBottom: 16, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
                에이전트 팀
              </h2>
              <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                스킬 파일을 업로드하면 AI가 분석하여 보고서 작성 시 전문 지식으로 활용합니다
              </p>
            </div>
            <button onClick={() => navigate('/new-project')} style={{
              padding: '7px 16px', borderRadius: 8, border: 'none',
              background: 'var(--accent)', color: 'var(--accent-fg)',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
              letterSpacing: '0.01em', flexShrink: 0,
            }}>
              + 새 프로젝트
            </button>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: 12,
          }}>
            <CommonSkillCard
              skills={commonSkills}
              onSkillsChange={reloadSkills}
            />
            {AGENTS.map(agent => (
              <AgentCard
                key={agent.id}
                agent={{ ...agent, skills: skills[agent.id] || [] }}
                skills={skills[agent.id] || []}
                onSkillsChange={reloadSkills}
              />
            ))}
          </div>
        </section>

        {/* 프로젝트 섹션 */}
        <section>
          <div style={{ marginBottom: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 3 }}>
              프로젝트
            </h2>
            <p style={{ fontSize: 11, color: 'var(--text-muted)' }}>
              저장된 방탈출 테마 기획 프로젝트
            </p>
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                <button
                  onClick={() => setProjectBranchFilter('all')}
                  style={{
                    padding: '5px 10px',
                    borderRadius: 8,
                    border: `1px solid ${projectBranchFilter === 'all' ? 'var(--accent)' : 'var(--border)'}`,
                    background: projectBranchFilter === 'all' ? 'var(--accent)' : 'transparent',
                    color: projectBranchFilter === 'all' ? 'var(--accent-fg)' : 'var(--text-secondary)',
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  전체보기
                </button>
                {BRANCH_CODES.map(code => {
                  const active = projectBranchFilter === code
                  return (
                    <button
                      key={code}
                      onClick={() => setProjectBranchFilter(code)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: 8,
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        background: active ? 'var(--accent)' : 'transparent',
                        color: active ? 'var(--accent-fg)' : 'var(--text-secondary)',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        fontFamily: 'monospace',
                        cursor: 'pointer',
                      }}
                    >
                      {code}
                    </button>
                  )
                })}
              </div>
              <button
                onClick={() => setShowTrash(true)}
                title="휴지통"
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  border: '1px solid var(--border)',
                  background: 'var(--bg-card)',
                  color: trashedProjects.length > 0 ? '#fca5a5' : 'var(--text-muted)',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  position: 'relative',
                  flexShrink: 0,
                }}
              >
                <TrashIcon />
                {trashedProjects.length > 0 && (
                  <span style={{
                    position: 'absolute',
                    top: -6,
                    right: -6,
                    minWidth: 16,
                    height: 16,
                    padding: '0 4px',
                    borderRadius: 999,
                    background: '#ef4444',
                    color: '#fff',
                    fontSize: 9,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px solid rgba(0,0,0,0.35)',
                  }}>
                    {trashedProjects.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {filteredProjects.length === 0 ? (
            <div style={{
              textAlign: 'center', padding: '40px 24px',
              border: '1px dashed var(--border)', borderRadius: 14,
              color: 'var(--text-muted)',
            }}>
              {projects.length === 0 ? (
                <>
                  <div style={{ fontSize: 12, marginBottom: 6 }}>아직 프로젝트가 없어요</div>
                  <div style={{ fontSize: 11, opacity: 0.5 }}>+ 새 프로젝트로 시작해보세요</div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: 12, marginBottom: 6 }}>선택한 지점 코드의 프로젝트가 없습니다</div>
                  <div style={{ fontSize: 11, opacity: 0.6 }}>필터를 `전체보기`로 전환해보세요</div>
                </>
              )}
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))',
              gap: 14,
            }}>
              {filteredProjects.map((project, index) => {
                const stage = getProjectStage(project)
                const stageStyle = getStageStyle(stage)
                const collaboration = project.collaborationStatus
                const isWorking = !!collaboration?.active
                const currentAgent = collaboration?.currentAgentId ? AGENTS.find(agent => agent.id === collaboration.currentAgentId) : null
                const progressCount = collaboration?.completedAgentIds?.length ?? 0
                const totalCount = Math.max(1, (project.gameSystemTypes?.includes('surround') ? 1 : 0) + (project.gameSystemTypes?.includes('crimescene') ? 1 : 0) + 6)
                const progressWidth = collaboration?.phase === 'finalizing'
                  ? 92
                  : Math.max(8, Math.min(86, Math.round((progressCount / totalCount) * 100)))
                return (
                <div key={project.id} style={{
                  borderRadius: 22,
                  border: '1px solid rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                  background: '#151822',
                  cursor: 'pointer',
                  transition: 'transform 0.15s, border-color 0.2s, box-shadow 0.2s',
                  boxShadow: '0 10px 24px rgba(0,0,0,0.25)',
                  position: 'relative',
                }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 18px 30px rgba(0,0,0,0.32)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'
                    e.currentTarget.style.transform = 'translateY(0)'
                    e.currentTarget.style.boxShadow = '0 10px 24px rgba(0,0,0,0.25)'
                  }}
                  onClick={() => navigate(`/project/${project.id}`)}
                >
                  <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 3 }} onClick={e => e.stopPropagation()}>
                    <button
                      title="삭제"
                      onClick={() => {
                        if (confirm('휴지통으로 이동할까요?')) {
                          moveProjectToTrash(project.id)
                          reloadProjectLists()
                        }
                      }}
                      style={{
                        width: 22, height: 22, borderRadius: 6, border: '1px solid transparent',
                        background: 'transparent', color: '#f3f5ff',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'color 0.15s, border-color 0.15s',
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.color = '#f87171'
                        e.currentTarget.style.borderColor = 'rgba(248,113,113,0.45)'
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.color = '#f3f5ff'
                        e.currentTarget.style.borderColor = 'transparent'
                      }}
                    >
                      <CloseIcon width={10} height={10} />
                    </button>
                  </div>
                  <div style={{
                    height: 108,
                    background: isWorking
                      ? 'linear-gradient(135deg, #25322d 0%, #18221d 34%, #10151f 100%)'
                      : getProjectFolderGradient(project, index),
                    borderBottom: '1px solid rgba(255,255,255,0.08)',
                    position: 'relative',
                    padding: 12,
                  }}>
                    {isWorking && (
                      <div style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'radial-gradient(circle at top left, rgba(201,255,84,0.16), transparent 36%)',
                        pointerEvents: 'none',
                      }} />
                    )}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      bottom: -18,
                      width: 164,
                      height: 38,
                      borderRadius: '0 14px 0 0',
                      background: '#151822',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderBottom: 'none',
                    }} />
                    {project.branches && project.branches.length > 0 && (
                      <div style={{ position: 'absolute', top: 10, right: 10, display: 'flex', gap: 4 }}>
                        {project.branches.slice(0, 2).map((b: BranchCode) => (
                          <span key={b} style={{
                            fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                            padding: '2px 6px', borderRadius: 999,
                            background: 'rgba(17, 20, 31, 0.56)',
                            border: '1px solid rgba(255,255,255,0.16)',
                            color: '#ecf0ff',
                            backdropFilter: 'blur(8px)',
                          }}>{b}</span>
                        ))}
                      </div>
                    )}
                    {isWorking && (
                      <div style={{
                        position: 'absolute',
                        left: 12,
                        right: 12,
                        top: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 10,
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          <span className="home-project-working-led" style={{
                            width: 10,
                            height: 10,
                            borderRadius: '50%',
                            background: '#c9ff54',
                            boxShadow: '0 0 14px rgba(201,255,84,0.65)',
                          }} />
                          <span style={{ fontSize: 10, fontWeight: 800, color: '#efffb8', letterSpacing: '0.08em' }}>
                            협업 진행중
                          </span>
                        </div>
                        <span style={{
                          fontSize: 9,
                          fontWeight: 700,
                          color: '#efffb8',
                          padding: '3px 7px',
                          borderRadius: 999,
                          background: 'rgba(17,20,31,0.52)',
                          border: '1px solid rgba(201,255,84,0.22)',
                        }}>
                          {collaboration?.phase === 'finalizing' ? '최종 종합' : 'AI WORK'}
                        </span>
                      </div>
                    )}
                  </div>

                  <div style={{ padding: '24px 12px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{
                          fontSize: 14,
                          fontWeight: 700,
                          color: '#f3f5ff',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {project.name}
                        </div>
                        <div style={{
                          fontSize: 11,
                          color: 'var(--text-muted)',
                          marginTop: 3,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {project.theme || '설명 없음'}
                        </div>
                        {project.ownerName && (
                          <div style={{ fontSize: 10, color: '#7c5cff', marginTop: 4, fontWeight: 500 }}>
                            @{project.ownerName}
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                        <button
                          title="편집"
                          onClick={() => openEditModal(project)}
                          style={{
                            width: 24, height: 24, borderRadius: 7, border: '1px solid rgba(255,255,255,0.12)',
                            background: 'transparent', color: 'var(--text-muted)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <WriteIcon />
                        </button>
                      </div>
                    </div>

                    <div style={{
                      marginTop: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}>
                      <span style={{
                        fontSize: 11,
                        fontWeight: 700,
                        borderRadius: 999,
                        padding: '4px 9px',
                        background: stageStyle.bg,
                        border: `1px solid ${stageStyle.border}`,
                        color: stageStyle.color,
                      }}>
                        {stage}
                      </span>
                      <div style={{ display: 'flex', gap: 4 }} onClick={e => e.stopPropagation()}>
                        <button
                          title="복제"
                          onClick={() => { duplicateProject(project); reloadProjectLists() }}
                          style={{
                            width: 22, height: 22, borderRadius: 6, border: '1px solid rgba(255,255,255,0.12)',
                            background: 'transparent', color: 'var(--text-muted)',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}
                        >
                          <CopyIcon />
                        </button>
                      </div>
                    </div>
                    {isWorking && (
                      <div style={{
                        marginTop: 10,
                        padding: '10px 11px',
                        borderRadius: 12,
                        border: '1px solid rgba(201,255,84,0.14)',
                        background: 'rgba(201,255,84,0.06)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 6 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: '#efffb8' }}>
                            {collaboration?.phase === 'finalizing'
                              ? '최종 보고서 정리 중'
                              : `${currentAgent?.name ?? '에이전트'} 작업 중`}
                          </div>
                          <div style={{ fontSize: 9.5, color: 'rgba(239,255,184,0.8)' }}>
                            {formatElapsed(collaboration?.startedAt)}
                          </div>
                        </div>
                        <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                          <div
                            className="home-project-working-bar"
                            style={{
                              width: `${progressWidth}%`,
                              height: '100%',
                              borderRadius: 999,
                              background: 'linear-gradient(90deg, #c9ff54 0%, #8ce8ff 100%)',
                            }}
                          />
                        </div>
                        <div style={{ marginTop: 6, fontSize: 10, color: 'var(--text-secondary)' }}>
                          {collaboration?.phase === 'finalizing'
                            ? '에이전트 결과를 종합해 최종 보고서를 생성하고 있습니다.'
                            : `${progressCount}개 완료${currentAgent ? ` · 현재 ${currentAgent.role}` : ''}`}
                        </div>
                      </div>
                    )}
                    <div style={{ marginTop: 4, fontSize: 10, color: 'var(--text-muted)' }}>
                      {new Date(project.updatedAt).toLocaleDateString('ko-KR')} · {project.versions.length}개 버전
                    </div>
                  </div>
                </div>
              )})}
            </div>
          )}

        </section>
      </main>

      {showTrash && (
        <div
          onClick={() => setShowTrash(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(4, 7, 14, 0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 680, maxHeight: '74vh',
              borderRadius: 14, border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              boxShadow: '0 20px 80px rgba(0,0,0,0.45)',
              overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
                <TrashIcon />
                휴지통 ({trashedProjects.length})
              </div>
              <button
                aria-label="닫기"
                onClick={() => setShowTrash(false)}
                style={{
                  width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <CloseIcon />
              </button>
            </div>

            <div style={{ padding: 14, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {trashedProjects.length === 0 ? (
                <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '16px 6px' }}>휴지통이 비어 있습니다</div>
              ) : trashedProjects.map(project => (
                <div key={`trash-${project.id}`} style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border)',
                  borderRadius: 10,
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 10,
                }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {project.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                      삭제됨: {new Date(project.deletedAt).toLocaleString('ko-KR')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    <button
                      title="복원"
                      onClick={() => { restoreProjectFromTrash(project.id); reloadProjectLists() }}
                      style={{
                        width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
                        background: 'transparent', color: 'var(--text-muted)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <RefreshIcon width={13} height={13} />
                    </button>
                    <button
                      title="영구 삭제"
                      onClick={() => {
                        if (confirm('휴지통에서 영구 삭제할까요?')) {
                          permanentlyDeleteProjectFromTrash(project.id)
                          reloadProjectLists()
                        }
                      }}
                      style={{
                        width: 28, height: 28, borderRadius: 7, border: '1px solid transparent',
                        background: 'transparent', color: 'var(--text-muted)',
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <TrashIcon />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {editingProject && (
        <div
          onClick={closeEditModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(4, 7, 14, 0.72)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 520,
              borderRadius: 14, border: '1px solid var(--border)',
              background: 'var(--bg-card)',
              boxShadow: '0 20px 80px rgba(0,0,0,0.45)',
              overflow: 'hidden',
            }}
          >
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', borderBottom: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>프로젝트 편집</div>
              <button
                aria-label="닫기"
                onClick={closeEditModal}
                style={{
                  width: 28, height: 28, borderRadius: 7, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <CloseIcon />
              </button>
            </div>

            <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>프로젝트 이름</label>
                <input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="프로젝트 이름"
                  style={{
                    width: '100%', borderRadius: 10, padding: '10px 12px',
                    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>테마</label>
                <textarea
                  value={editTheme}
                  onChange={e => setEditTheme(e.target.value)}
                  placeholder="테마"
                  rows={3}
                  style={{
                    width: '100%', borderRadius: 10, padding: '10px 12px',
                    border: '1px solid var(--border)', background: 'var(--bg-secondary)',
                    color: 'var(--text-primary)', fontSize: 13, outline: 'none',
                    resize: 'vertical', fontFamily: 'inherit',
                  }}
                />
              </div>

              <div>
                <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>지점</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {BRANCH_CODES.map(code => {
                    const active = editBranches.includes(code)
                    return (
                      <button
                        key={code}
                        onClick={() => toggleBranch(code)}
                        style={{
                          borderRadius: 8,
                          border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                          background: active ? 'var(--accent)' : 'transparent',
                          color: active ? 'var(--accent-fg)' : 'var(--text-muted)',
                          fontSize: 12, fontWeight: 700, letterSpacing: '0.04em',
                          fontFamily: 'monospace',
                          padding: '6px 10px', cursor: 'pointer',
                        }}
                      >
                        {code}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div style={{
              padding: 16, borderTop: '1px solid var(--border)',
              display: 'flex', justifyContent: 'flex-end', gap: 8,
            }}>
              <button
                onClick={closeEditModal}
                style={{
                  padding: '8px 13px', borderRadius: 8, border: '1px solid var(--border)',
                  background: 'transparent', color: 'var(--text-secondary)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                }}
              >
                취소
              </button>
              <button
                onClick={saveProjectBasicInfo}
                disabled={!editName.trim() || !editTheme.trim()}
                style={{
                  padding: '8px 14px', borderRadius: 8, border: 'none',
                  background: !editName.trim() || !editTheme.trim() ? 'var(--bg-secondary)' : 'var(--accent)',
                  color: !editName.trim() || !editTheme.trim() ? 'var(--text-muted)' : 'var(--accent-fg)',
                  fontSize: 12, fontWeight: 700, cursor: !editName.trim() || !editTheme.trim() ? 'default' : 'pointer',
                }}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
