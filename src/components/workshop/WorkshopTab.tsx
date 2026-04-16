import { useState, useRef, useEffect } from 'react'
import type { Project, ProjectVersion, AgentId, AgentReport, WorkshopSession, WorkshopDecision, WorkshopTopicType } from '../../types'
import { AGENTS } from '../../data/agents'
import { chatWorkshopMultiAgent } from '../../lib/api'
import { saveWorkshopSession, updateProjectBriefing } from '../../lib/storage'

// ── 필수 검토 토픽 ────────────────────────────────────────────────────────────

interface TopicDef {
  type: WorkshopTopicType
  title: string
  description: string
  participants: AgentId[]
  defaultAffectedAgents: AgentId[]
  affectedGameFlow: boolean
  initialPrompt: string
}

const MANDATORY_TOPICS: TopicDef[] = [
  {
    type: 'puzzle-fun',
    title: '이 퍼즐이 재미있는가',
    description: '퍼즐의 재미, 난이도, 연계성 검토',
    participants: ['puzzle', 'pd'],
    defaultAffectedAgents: ['puzzle', 'pd', 'ops'],
    affectedGameFlow: true,
    initialPrompt: '현재 기획된 퍼즐들을 검토해주세요. 각 퍼즐의 재미 요소, 난이도, 연계성을 평가하고 플레이어 관점에서 구체적인 개선점을 제안해주세요.',
  },
  {
    type: 'twist-logic',
    title: '이 반전이 납득되는가',
    description: '스토리 반전의 논리성과 감정적 임팩트 검토',
    participants: ['concept', 'ceo'],
    defaultAffectedAgents: ['concept', 'ceo', 'pd'],
    affectedGameFlow: false,
    initialPrompt: '현재 기획된 스토리의 반전 포인트를 검토해주세요. 플레이어가 납득할 수 있는지, 복선이 충분한지, 감정적 임팩트가 있는지 평가해주세요.',
  },
  {
    type: 'flow-natural',
    title: '이 동선이 자연스러운가',
    description: '공간 동선과 플레이어 이동 흐름 검토',
    participants: ['space', 'pd'],
    defaultAffectedAgents: ['space', 'pd', 'ops'],
    affectedGameFlow: true,
    initialPrompt: '현재 기획된 공간 동선을 검토해주세요. 플레이어의 이동 흐름이 자연스러운지, 막히는 곳은 없는지, 공간 전환이 스토리와 일치하는지 평가해주세요.',
  },
]

const AGENT_RUN_ORDER: AgentId[] = ['ceo', 'concept', 'pd', 'puzzle', 'space', 'ops', 'sound', 'xfiler']

// ── props ─────────────────────────────────────────────────────────────────────

interface WorkshopTabProps {
  project: Project
  activeVersion: ProjectVersion | null
  activeAgentIds: AgentId[]
  running: boolean
  onRerunFromAgent: (agentId: AgentId) => void
  onUpdate: () => void
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export function WorkshopTab({ project, activeVersion, activeAgentIds, running, onRerunFromAgent, onUpdate }: WorkshopTabProps) {
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const sessions: WorkshopSession[] = activeVersion?.workshopSessions ?? []
  const activeSession = sessions.find(s => s.id === activeSessionId) ?? null

  function getSessionForTopic(type: WorkshopTopicType) {
    return sessions
      .filter(s => s.type === type)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] ?? null
  }

  function handleSessionSaved(session: WorkshopSession) {
    if (!activeVersion) return
    saveWorkshopSession(project.id, activeVersion.id, session)
    onUpdate()
  }

  async function handleStartTopic(topic: TopicDef) {
    if (!activeVersion) return
    const session: WorkshopSession = {
      id: crypto.randomUUID(),
      type: topic.type,
      title: topic.title,
      participants: topic.participants.filter(id => activeAgentIds.includes(id)),
      messages: [],
      decisions: [],
      status: 'open',
      applied: false,
      createdAt: new Date().toISOString(),
    }
    saveWorkshopSession(project.id, activeVersion.id, session)
    onUpdate()
    setActiveSessionId(session.id)
  }

  function handleStartCustom(title: string, participants: AgentId[]) {
    if (!activeVersion || !title.trim() || participants.length === 0) return
    const session: WorkshopSession = {
      id: crypto.randomUUID(),
      type: 'custom',
      title: title.trim(),
      participants,
      messages: [],
      decisions: [],
      status: 'open',
      applied: false,
      createdAt: new Date().toISOString(),
    }
    saveWorkshopSession(project.id, activeVersion.id, session)
    onUpdate()
    setActiveSessionId(session.id)
  }

  const hasReports = (activeVersion?.agentReports?.filter(r => r.status === 'done').length ?? 0) > 0

  if (activeSession) {
    return (
      <SessionView
        project={project}
        activeVersion={activeVersion}
        session={activeSession}
        running={running}
        onBack={() => setActiveSessionId(null)}
        onSave={handleSessionSaved}
        onRerunFromAgent={onRerunFromAgent}
        onUpdate={onUpdate}
      />
    )
  }

  return (
    <SessionList
      sessions={sessions}
      mandatoryTopics={MANDATORY_TOPICS}
      activeAgentIds={activeAgentIds}
      hasReports={hasReports}
      getSessionForTopic={getSessionForTopic}
      onOpenSession={s => setActiveSessionId(s.id)}
      onStartTopic={handleStartTopic}
      onStartCustom={handleStartCustom}
    />
  )
}

// ── 세션 목록 ─────────────────────────────────────────────────────────────────

interface SessionListProps {
  sessions: WorkshopSession[]
  mandatoryTopics: TopicDef[]
  activeAgentIds: AgentId[]
  hasReports: boolean
  getSessionForTopic: (type: WorkshopTopicType) => WorkshopSession | null
  onOpenSession: (session: WorkshopSession) => void
  onStartTopic: (topic: TopicDef) => void
  onStartCustom: (title: string, participants: AgentId[]) => void
}

function SessionList({
  sessions, mandatoryTopics, activeAgentIds, hasReports,
  getSessionForTopic, onOpenSession, onStartTopic, onStartCustom,
}: SessionListProps) {
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customTitle, setCustomTitle] = useState('')
  const [customParticipants, setCustomParticipants] = useState<AgentId[]>([])

  const customSessions = sessions
    .filter(s => s.type === 'custom')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  function toggleParticipant(id: AgentId) {
    setCustomParticipants(prev =>
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    )
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 5 }}>
          기획 회의실
        </div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
          보고서를 기반으로 핵심 기획 요소를 에이전트와 함께 검토하고, 결정사항을 보고서에 반영합니다.
          {!hasReports && (
            <span style={{ color: 'var(--warning)', marginLeft: 8 }}>
              보고서를 먼저 생성해야 회의를 시작할 수 있습니다.
            </span>
          )}
        </div>
      </div>

      {/* 필수 검토 항목 */}
      <div style={{ marginBottom: 32 }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
          letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10,
        }}>
          필수 검토 항목
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {mandatoryTopics.map(topic => {
            const existing = getSessionForTopic(topic.type)
            const isApplied = existing?.applied
            const isClosed = existing?.status === 'closed'
            const decisionCount = existing?.decisions.filter(d => d.accepted).length ?? 0
            const participantAgents = AGENTS.filter(a =>
              topic.participants.includes(a.id) && activeAgentIds.includes(a.id)
            )

            return (
              <div key={topic.type} style={{
                background: 'var(--bg-card)',
                border: `1px solid ${isApplied ? 'var(--success-dim)' : 'var(--border)'}`,
                borderRadius: 14,
                padding: '14px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                transition: 'border-color 0.2s',
              }}>
                {/* 에이전트 아바타 스택 */}
                <div style={{ display: 'flex', gap: -4, flexShrink: 0 }}>
                  {participantAgents.map(a => (
                    <div key={a.id} style={{
                      width: 32, height: 32,
                      background: `${a.color}18`,
                      border: `1px solid ${a.color}33`,
                      borderRadius: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15,
                    }}>
                      {a.emoji}
                    </div>
                  ))}
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                    <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                      {topic.title}
                    </span>
                    {isApplied && <StatusBadge label="반영 완료" variant="success" />}
                    {isClosed && !isApplied && <StatusBadge label="종료" variant="muted" />}
                    {decisionCount > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>결정 {decisionCount}건</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{topic.description}</div>
                  <div style={{ display: 'flex', gap: 5, marginTop: 6 }}>
                    {participantAgents.map(a => (
                      <span key={a.id} style={{
                        fontSize: 10, color: 'var(--text-muted)',
                        background: 'var(--bg-secondary)',
                        border: '1px solid var(--border)',
                        borderRadius: 6, padding: '2px 7px',
                      }}>
                        {a.name}
                      </span>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {existing && (
                    <Btn variant="ghost" onClick={() => onOpenSession(existing)}>
                      {isClosed ? '회의록' : '이어하기'}
                    </Btn>
                  )}
                  <Btn variant="primary" disabled={!hasReports} onClick={() => hasReports && onStartTopic(topic)}>
                    {existing ? '새로 시작' : '시작'}
                  </Btn>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 자유 회의 */}
      <div>
        <div style={{
          display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', marginBottom: 10,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
            letterSpacing: '0.08em', textTransform: 'uppercase',
          }}>
            자유 회의
          </div>
          {hasReports && (
            <Btn variant="ghost" onClick={() => setShowCustomForm(v => !v)}>
              + 새 회의
            </Btn>
          )}
        </div>

        {showCustomForm && (
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 16, marginBottom: 10,
          }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 10 }}>
              새 회의
            </div>
            <input
              value={customTitle}
              onChange={e => setCustomTitle(e.target.value)}
              placeholder="회의 주제 (예: 오프닝 연출 강화)"
              style={inputStyle}
            />
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 7 }}>참여 에이전트</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {AGENTS.map(a => {
                const active = customParticipants.includes(a.id)
                return (
                  <button key={a.id} onClick={() => toggleParticipant(a.id)} style={{
                    padding: '4px 10px', borderRadius: 8, fontSize: 11, cursor: 'pointer',
                    border: active ? `1px solid ${a.color}55` : '1px solid var(--border)',
                    background: active ? `${a.color}18` : 'var(--bg-secondary)',
                    color: active ? a.color : 'var(--text-muted)',
                    fontWeight: active ? 600 : 400,
                    transition: 'all 0.15s',
                  }}>
                    {a.name}
                  </button>
                )
              })}
            </div>
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <Btn variant="ghost" onClick={() => setShowCustomForm(false)}>취소</Btn>
              <Btn
                variant="primary"
                disabled={!customTitle.trim() || customParticipants.length === 0}
                onClick={() => {
                  onStartCustom(customTitle, customParticipants)
                  setShowCustomForm(false)
                  setCustomTitle('')
                  setCustomParticipants([])
                }}
              >
                시작
              </Btn>
            </div>
          </div>
        )}

        {customSessions.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {customSessions.map(session => {
              const participantAgents = AGENTS.filter(a => session.participants.includes(a.id))
              const decisionCount = session.decisions.filter(d => d.accepted).length
              return (
                <div key={session.id} style={{
                  background: 'var(--bg-card)', border: '1px solid var(--border)',
                  borderRadius: 14, padding: '12px 14px',
                  display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>
                        {session.title}
                      </span>
                      {session.applied && <StatusBadge label="반영 완료" variant="success" />}
                      {session.status === 'closed' && !session.applied && (
                        <StatusBadge label="종료" variant="muted" />
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                      {participantAgents.map(a => (
                        <span key={a.id} style={{ fontSize: 10, color: 'var(--text-muted)' }}>{a.name}</span>
                      ))}
                      {decisionCount > 0 && (
                        <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>· 결정 {decisionCount}건</span>
                      )}
                      <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                        · 메시지 {session.messages.length}개
                      </span>
                    </div>
                  </div>
                  <Btn variant="ghost" onClick={() => onOpenSession(session)}>열기</Btn>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', padding: '20px 0' }}>
            자유 주제 회의가 없습니다
          </div>
        )}
      </div>
    </div>
  )
}

// ── 세션 상세 ─────────────────────────────────────────────────────────────────

interface SessionViewProps {
  project: Project
  activeVersion: ProjectVersion | null
  session: WorkshopSession
  running: boolean
  onBack: () => void
  onSave: (session: WorkshopSession) => void
  onRerunFromAgent: (agentId: AgentId) => void
  onUpdate: () => void
}

function SessionView({
  project, activeVersion, session: initialSession,
  running, onBack, onSave, onRerunFromAgent, onUpdate,
}: SessionViewProps) {
  const [session, setSession] = useState<WorkshopSession>(initialSession)
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [applying, setApplying] = useState(false)
  const [newDecision, setNewDecision] = useState('')
  const [newDecisionAgents, setNewDecisionAgents] = useState<AgentId[]>([])
  const [newDecisionGameFlow, setNewDecisionGameFlow] = useState(false)
  const [showDecisionForm, setShowDecisionForm] = useState(false)
  const autoOpened = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const agentReports: AgentReport[] = activeVersion?.agentReports ?? []
  const participantAgents = AGENTS.filter(a => session.participants.includes(a.id))
  const isClosed = session.status === 'closed'
  const acceptedCount = session.decisions.filter(d => d.accepted).length

  // 첫 오픈 시 에이전트 오프닝 자동 생성
  useEffect(() => {
    if (autoOpened.current || session.messages.length > 0) { autoOpened.current = true; return }
    autoOpened.current = true

    const topic = MANDATORY_TOPICS.find(t => t.type === session.type)
    if (!topic) return

    setSending(true)
    const openingUserMsg = msg('user', topic.initialPrompt)
    const withUser: WorkshopSession = { ...session, messages: [openingUserMsg] }

    chatWorkshopMultiAgent(withUser, agentReports, buildContext(project, activeVersion))
      .then(response => {
        const agentMsg = msg('agents', response)
        const updated: WorkshopSession = { ...withUser, messages: [openingUserMsg, agentMsg] }
        setSession(updated)
        onSave(updated)
      })
      .catch(console.error)
      .finally(() => setSending(false))
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [session.messages.length, sending])

  function save(updated: WorkshopSession) {
    setSession(updated)
    onSave(updated)
  }

  async function handleSend() {
    if (!input.trim() || sending || isClosed) return
    const userMsg = msg('user', input.trim())
    const withUser: WorkshopSession = { ...session, messages: [...session.messages, userMsg] }
    setSession(withUser)
    setInput('')
    setSending(true)
    try {
      const response = await chatWorkshopMultiAgent(
        withUser, agentReports, buildContext(project, activeVersion)
      )
      const agentMsg = msg('agents', response)
      save({ ...withUser, messages: [...withUser.messages, agentMsg] })
    } catch (e) { console.error(e) }
    finally { setSending(false) }
  }

  function addDecision() {
    if (!newDecision.trim()) return
    const decision: WorkshopDecision = {
      id: crypto.randomUUID(),
      content: newDecision.trim(),
      accepted: true,
      affectedAgents: newDecisionAgents,
      affectedGameFlow: newDecisionGameFlow,
      applied: false,
    }
    save({ ...session, decisions: [...session.decisions, decision] })
    setNewDecision('')
    setNewDecisionAgents([])
    setNewDecisionGameFlow(false)
    setShowDecisionForm(false)
  }

  async function handleApply() {
    if (!activeVersion || applying || running) return
    const accepted = session.decisions.filter(d => d.accepted && !d.applied)
    if (accepted.length === 0) return
    setApplying(true)
    try {
      const affectedSet = new Set<AgentId>()
      accepted.forEach(d => d.affectedAgents.forEach(a => affectedSet.add(a)))
      const directiveText = accepted.map(d => `- ${d.content}`).join('\n')
      const directive = `[회의 결정사항 · "${session.title}"]\n${directiveText}\n\n위 결정사항을 보고서에 반영해주세요.`

      for (const agentId of affectedSet) {
        const existing = project.briefings?.[agentId]?.messages ?? []
        updateProjectBriefing(project.id, agentId, [
          ...existing,
          { id: crypto.randomUUID(), role: 'assistant' as const, content: directive, agentId, createdAt: new Date().toISOString() },
        ])
      }

      save({
        ...session,
        decisions: session.decisions.map(d => d.accepted ? { ...d, applied: true } : d),
        status: 'closed',
        applied: true,
        closedAt: new Date().toISOString(),
      })

      const earliest = AGENT_RUN_ORDER.find(id => affectedSet.has(id))
      if (earliest) onRerunFromAgent(earliest)
      onUpdate()
    } finally { setApplying(false) }
  }

  return (
    <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column', height: 'calc(100vh - 176px)', minHeight: 520 }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexShrink: 0 }}>
        <button onClick={onBack} style={{
          background: 'none', border: '1px solid var(--border)',
          color: 'var(--text-muted)', fontSize: 12, padding: '5px 10px',
          borderRadius: 7, cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s',
        }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
        >
          ← 목록
        </button>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)' }}>
              {session.title}
            </span>
            {isClosed && (
              <StatusBadge label={session.applied ? '반영 완료' : '종료됨'} variant={session.applied ? 'success' : 'muted'} />
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {participantAgents.map(a => (
              <span key={a.id} style={{
                fontSize: 10, color: 'var(--text-muted)',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 6, padding: '2px 7px',
              }}>
                {a.name}
              </span>
            ))}
          </div>
        </div>

        {!isClosed && (
          <Btn variant="ghost" onClick={() => save({ ...session, status: 'closed', closedAt: new Date().toISOString() })}>
            회의 종료
          </Btn>
        )}
      </div>

      {/* 본문 */}
      <div style={{ display: 'flex', gap: 14, flex: 1, minHeight: 0 }}>
        {/* 대화창 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={{
            flex: 1, overflowY: 'auto',
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 14,
            padding: 16,
            display: 'flex', flexDirection: 'column', gap: 12,
          }}>
            {session.messages.length === 0 && !sending && (
              <div style={{ color: 'var(--text-muted)', fontSize: 13, margin: 'auto', textAlign: 'center' }}>
                에이전트가 현재 기획을 검토하고 있습니다
              </div>
            )}
            {session.messages.map(m => (
              <MessageBubble key={m.id} msg={m} participantAgents={participantAgents} />
            ))}
            {sending && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: `${participantAgents[0]?.color ?? '#888'}18`,
                  border: `1px solid ${participantAgents[0]?.color ?? '#888'}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, flexShrink: 0,
                }}>
                  {participantAgents[0]?.emoji ?? '·'}
                </div>
                <div style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: '4px 10px 10px 10px',
                  padding: '8px 12px', fontSize: 12,
                  color: 'var(--text-muted)',
                }}>
                  검토 중...
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {!isClosed && (
            <div style={{ marginTop: 8, flexShrink: 0 }}>
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend() }}
                placeholder="의견을 입력하세요  ·  Cmd+Enter 전송"
                disabled={sending}
                rows={3}
                style={{ ...inputStyle, resize: 'none', opacity: sending ? 0.5 : 1 }}
              />
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}>
                <Btn variant="primary" disabled={!input.trim() || sending} onClick={handleSend}>
                  전송
                </Btn>
              </div>
            </div>
          )}
        </div>

        {/* 결정사항 패널 */}
        <div style={{ width: 248, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 14, padding: 14,
            flex: 1, overflowY: 'auto',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              justifyContent: 'space-between', marginBottom: 12,
            }}>
              <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--text-primary)' }}>결정사항</span>
              {acceptedCount > 0 && (
                <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>채택 {acceptedCount}건</span>
              )}
            </div>

            {session.decisions.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
                회의에서 결정된 사항을 추가하세요
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              {session.decisions.map(d => (
                <DecisionItem
                  key={d.id}
                  decision={d}
                  isClosed={isClosed}
                  onToggle={() => save({ ...session, decisions: session.decisions.map(x => x.id === d.id ? { ...x, accepted: !x.accepted } : x) })}
                  onRemove={() => save({ ...session, decisions: session.decisions.filter(x => x.id !== d.id) })}
                />
              ))}
            </div>

            {!isClosed && !showDecisionForm && (
              <button
                onClick={() => setShowDecisionForm(true)}
                style={{
                  width: '100%', background: 'none',
                  border: '1px dashed var(--border)',
                  borderRadius: 8, padding: '7px 0',
                  fontSize: 11, color: 'var(--text-muted)',
                  cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                + 결정사항 추가
              </button>
            )}

            {showDecisionForm && (
              <DecisionForm
                value={newDecision}
                selectedAgents={newDecisionAgents}
                affectsGameFlow={newDecisionGameFlow}
                onChange={setNewDecision}
                onToggleAgent={id => setNewDecisionAgents(prev =>
                  prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
                )}
                onToggleGameFlow={() => setNewDecisionGameFlow(v => !v)}
                onAdd={addDecision}
                onCancel={() => { setShowDecisionForm(false); setNewDecision('') }}
              />
            )}
          </div>

          {/* 반영 버튼 */}
          {acceptedCount > 0 && !session.applied && (
            <button
              onClick={handleApply}
              disabled={applying || running}
              style={{
                width: '100%', padding: '10px 0',
                borderRadius: 10, border: 'none',
                background: applying || running ? 'var(--bg-secondary)' : 'var(--accent)',
                color: applying || running ? 'var(--text-muted)' : 'var(--accent-fg)',
                fontSize: 12, fontWeight: 700,
                cursor: applying || running ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s',
                opacity: applying || running ? 0.6 : 1,
              }}
            >
              {applying ? '반영 중...' : running ? '실행 중 대기' : `결정사항 반영 & 재실행  (${acceptedCount}건)`}
            </button>
          )}
          {session.applied && (
            <div style={{
              textAlign: 'center', fontSize: 11,
              color: 'var(--success)', padding: '8px 0',
            }}>
              결정사항이 보고서에 반영되었습니다
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── 메시지 버블 ───────────────────────────────────────────────────────────────

function MessageBubble({ msg: m, participantAgents }: {
  msg: WorkshopSession['messages'][0]
  participantAgents: typeof AGENTS
}) {
  if (m.role === 'user') {
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <div style={{
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)',
          borderRadius: '10px 4px 10px 10px',
          padding: '8px 12px', maxWidth: '80%',
          fontSize: 13, color: 'var(--text-primary)',
          whiteSpace: 'pre-wrap', lineHeight: 1.6,
        }}>
          {m.content}
        </div>
      </div>
    )
  }

  const parts = parseAgentResponse(m.content)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {parts.map((part, i) => {
        const agent = AGENTS.find(a => a.name === part.agentName) ?? participantAgents[0]
        return (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{
              width: 28, height: 28, flexShrink: 0,
              background: `${agent?.color ?? '#888'}18`,
              border: `1px solid ${agent?.color ?? '#888'}33`,
              borderRadius: 7,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, marginTop: 2,
            }}>
              {part.emoji}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 10, fontWeight: 700,
                color: agent?.color ?? 'var(--text-muted)',
                marginBottom: 3,
              }}>
                {part.agentName}
              </div>
              <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '4px 10px 10px 10px',
                padding: '8px 12px',
                fontSize: 13, color: 'var(--text-secondary)',
                whiteSpace: 'pre-wrap', lineHeight: 1.6,
              }}>
                {part.text}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function parseAgentResponse(content: string) {
  const parts: { emoji: string; agentName: string; text: string }[] = []
  const re = /\[([^\]]+)\]\n/g
  let last = 0; let m: RegExpExecArray | null
  while ((m = re.exec(content)) !== null) {
    if (m.index > last && parts.length > 0) parts[parts.length - 1].text += content.slice(last, m.index)
    const label = m[1]
    const sp = label.indexOf(' ')
    parts.push({ emoji: sp >= 0 ? label.slice(0, sp) : '', agentName: sp >= 0 ? label.slice(sp + 1) : label, text: '' })
    last = m.index + m[0].length
  }
  if (parts.length === 0) return [{ emoji: '', agentName: '에이전트', text: content }]
  parts[parts.length - 1].text += content.slice(last)
  return parts.map(p => ({ ...p, text: p.text.trim() }))
}

// ── 결정사항 아이템 ───────────────────────────────────────────────────────────

function DecisionItem({ decision: d, isClosed, onToggle, onRemove }: {
  decision: WorkshopDecision; isClosed: boolean
  onToggle: () => void; onRemove: () => void
}) {
  const names = AGENTS.filter(a => d.affectedAgents.includes(a.id)).map(a => a.name).join(', ')
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: `1px solid ${d.accepted ? 'var(--border-bright)' : 'var(--border)'}`,
      borderRadius: 8, padding: '8px 10px',
      opacity: d.accepted ? 1 : 0.45, transition: 'opacity 0.15s',
    }}>
      <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
        {!isClosed ? (
          <button onClick={onToggle} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 0, flexShrink: 0, marginTop: 1,
            width: 14, height: 14,
            borderRadius: 3,
            outline: d.accepted ? `2px solid var(--accent)` : `1px solid var(--border)`,
            outlineOffset: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {d.accepted && (
              <div style={{ width: 8, height: 8, borderRadius: 2, background: 'var(--accent)' }} />
            )}
          </button>
        ) : (
          <div style={{
            width: 14, height: 14, flexShrink: 0, borderRadius: 3, marginTop: 1,
            background: d.accepted ? 'var(--success-dim)' : 'var(--bg-card)',
            border: `1px solid ${d.accepted ? 'var(--success)' : 'var(--border)'}`,
          }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: 'var(--text-primary)', lineHeight: 1.5 }}>{d.content}</div>
          {(names || d.affectedGameFlow) && (
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
              {names && `→ ${names}`}{d.affectedGameFlow && ' · 게임플로우'}
            </div>
          )}
          {d.applied && <div style={{ fontSize: 10, color: 'var(--success)', marginTop: 2 }}>반영됨</div>}
        </div>
        {!isClosed && (
          <button onClick={onRemove} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: 12, padding: 0, flexShrink: 0,
            lineHeight: 1,
          }}>×</button>
        )}
      </div>
    </div>
  )
}

// ── 결정사항 추가 폼 ──────────────────────────────────────────────────────────

function DecisionForm({ value, selectedAgents, affectsGameFlow, onChange, onToggleAgent, onToggleGameFlow, onAdd, onCancel }: {
  value: string; selectedAgents: AgentId[]; affectsGameFlow: boolean
  onChange: (v: string) => void; onToggleAgent: (id: AgentId) => void
  onToggleGameFlow: () => void; onAdd: () => void; onCancel: () => void
}) {
  return (
    <div style={{ marginTop: 8 }}>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder="결정된 사항을 입력하세요"
        rows={2}
        style={{ ...inputStyle, resize: 'none', fontSize: 11, padding: '7px 10px', marginBottom: 8 }}
      />
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6 }}>영향 에이전트</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
        {AGENTS.slice(0, 6).map(a => {
          const on = selectedAgents.includes(a.id)
          return (
            <button key={a.id} onClick={() => onToggleAgent(a.id)} style={{
              padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
              border: on ? `1px solid ${a.color}55` : '1px solid var(--border)',
              background: on ? `${a.color}18` : 'var(--bg-card)',
              color: on ? a.color : 'var(--text-muted)',
              transition: 'all 0.15s',
            }}>
              {a.name}
            </button>
          )
        })}
        <button onClick={onToggleGameFlow} style={{
          padding: '3px 8px', borderRadius: 6, fontSize: 10, cursor: 'pointer',
          border: affectsGameFlow ? '1px solid var(--border-bright)' : '1px solid var(--border)',
          background: affectsGameFlow ? 'var(--bg-secondary)' : 'var(--bg-card)',
          color: affectsGameFlow ? 'var(--text-primary)' : 'var(--text-muted)',
          transition: 'all 0.15s',
        }}>
          게임플로우
        </button>
      </div>
      <div style={{ display: 'flex', gap: 5 }}>
        <Btn variant="ghost" onClick={onCancel} style={{ flex: 1, fontSize: 11 }}>취소</Btn>
        <Btn variant="primary" disabled={!value.trim()} onClick={onAdd} style={{ flex: 1, fontSize: 11 }}>추가</Btn>
      </div>
    </div>
  )
}

// ── 공용 컴포넌트 ─────────────────────────────────────────────────────────────

function StatusBadge({ label, variant }: { label: string; variant: 'success' | 'muted' }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 700,
      background: variant === 'success' ? 'var(--success-dim)' : 'var(--bg-secondary)',
      color: variant === 'success' ? 'var(--success)' : 'var(--text-muted)',
      border: `1px solid ${variant === 'success' ? 'var(--success)33' : 'var(--border)'}`,
      borderRadius: 6, padding: '2px 7px',
    }}>
      {label}
    </span>
  )
}

function Btn({ variant, disabled = false, onClick, children, style }: {
  variant: 'primary' | 'ghost'
  disabled?: boolean
  onClick?: () => void
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  const base: React.CSSProperties = {
    border: 'none', borderRadius: 8,
    padding: '6px 12px', fontSize: 12, fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.45 : 1,
    transition: 'background 0.15s, opacity 0.15s',
    ...style,
  }
  if (variant === 'primary') {
    return (
      <button disabled={disabled} onClick={onClick} style={{
        ...base,
        background: 'var(--accent)', color: 'var(--accent-fg)',
      }}>
        {children}
      </button>
    )
  }
  return (
    <button disabled={disabled} onClick={onClick} style={{
      ...base,
      background: 'var(--bg-secondary)',
      color: 'var(--text-muted)',
      border: '1px solid var(--border)',
    }}
      onMouseEnter={e => { if (!disabled) { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}
    >
      {children}
    </button>
  )
}

// ── 유틸리티 ──────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: 8, padding: '8px 10px',
  fontSize: 12, color: 'var(--text-primary)',
  outline: 'none', marginBottom: 10,
  fontFamily: 'inherit',
}

function msg(role: 'user' | 'agents', content: string): WorkshopSession['messages'][0] {
  return { id: crypto.randomUUID(), role, content, createdAt: new Date().toISOString() }
}

function buildContext(project: Project, activeVersion: ProjectVersion | null): string {
  const reports = activeVersion?.agentReports ?? []
  const summary = reports
    .filter(r => r.status === 'done' && r.summary?.trim())
    .map(r => `[${r.agentName}]\n${r.summary.trim()}`)
    .join('\n\n')
  return `프로젝트명: ${project.name}\n테마: ${project.theme}${project.crimeConfig ? `\n장소: ${project.crimeConfig.location}\n장르: ${(project.crimeConfig.genres ?? []).join(', ')}` : ''}${summary ? `\n\n현재 기획 요약:\n${summary}` : ''}`
}
