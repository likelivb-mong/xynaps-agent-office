import { useState, useRef, useEffect } from 'react'
import type { Agent, ChatMessage, MeetingMinutes } from '../../types'
import type { AgentId } from '../../types'
import { briefGroupAgents, generateMeetingMinutes } from '../../lib/api'
import { saveGroupBriefing, completeGroupBriefing } from '../../lib/storage'
import { AgentIcon } from '../ui/AgentIcon'
import { Spinner } from '../ui/Icon'
import { AGENTS } from '../../data/agents'

interface Props {
  agents: Agent[]
  projectContext: string
  projectId: string
  initialMessages?: ChatMessage[]
  initialCompleted?: boolean
  onUpdate: () => void
}

export function GroupBriefingChat({
  agents, projectContext, projectId, initialMessages = [], initialCompleted = false, onUpdate,
}: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages)
  const [completed, setCompleted] = useState(initialCompleted)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const agentIds = agents.map(a => a.id) as AgentId[]

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, loading])

  async function startChat() {
    setOpen(true)
    if (messages.length > 0) return
    setLoading(true)
    setError(null)
    try {
      const results = await briefGroupAgents(agentIds, [], projectContext)
      const agentMsgs: ChatMessage[] = results.map(r => ({
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: r.text,
        agentId: r.agentId,
        createdAt: new Date().toISOString(),
      }))
      setMessages(agentMsgs)
      saveGroupBriefing(projectId, agentIds, agentMsgs)
    } catch (e) {
      setError(e instanceof Error ? e.message : '브리핑 시작에 실패했습니다.')
    }
    setLoading(false)
  }

  async function sendMessage() {
    const text = input.trim()
    if (!text || loading) return
    setInput('')

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      createdAt: new Date().toISOString(),
    }
    const withUser = [...messages, userMsg]
    setMessages(withUser)
    saveGroupBriefing(projectId, agentIds, withUser)

    setLoading(true)
    setError(null)
    try {
      const results = await briefGroupAgents(agentIds, withUser, projectContext)
      const agentMsgs: ChatMessage[] = results.map(r => ({
        id: crypto.randomUUID(),
        role: 'assistant' as const,
        content: r.text,
        agentId: r.agentId,
        createdAt: new Date().toISOString(),
      }))
      const final = [...withUser, ...agentMsgs]
      setMessages(final)
      saveGroupBriefing(projectId, agentIds, final)
      onUpdate()
    } catch (e) {
      setError(e instanceof Error ? e.message : '에이전트 답변을 가져오지 못했습니다.')
    }
    setLoading(false)
  }

  async function handleComplete() {
    if (messages.length === 0) return
    setCompleting(true)
    try {
      const summary = await generateMeetingMinutes(messages, projectContext, agentIds)
      const projects = (await import('../../lib/storage')).getProjects()
      const project = projects.find(p => p.id === projectId)
      const existingCount = project?.meetingMinutes?.length ?? 0
      const minutes: MeetingMinutes = {
        id: crypto.randomUUID(),
        order: existingCount + 1,
        createdAt: new Date().toISOString(),
        summary,
        messages,
      }
      completeGroupBriefing(projectId, agentIds, messages, minutes)
      setCompleted(true)
      setOpen(false)
      onUpdate()
    } catch (e) {
      setError(e instanceof Error ? e.message : '회의록 생성에 실패했습니다.')
    }
    setCompleting(false)
  }

  const agentMap = new Map(AGENTS.map(a => [a.id, a]))
  const roundCount = messages.filter(m => m.role === 'user').length

  return (
    <div style={{
      border: `1px solid ${completed ? 'var(--border-bright)' : 'var(--border)'}`,
      borderRadius: 14,
      background: 'var(--bg-card)',
      overflow: 'hidden',
    }}>
      <style>{`
        @keyframes briefing-dot-bounce {
          0%, 60%, 100% { transform: translateY(0); opacity: 0.35; }
          30% { transform: translateY(-5px); opacity: 1; }
        }
        .briefing-typing-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--text-muted);
          animation: briefing-dot-bounce 1.2s ease-in-out infinite;
          display: inline-block;
        }
        .briefing-typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .briefing-typing-dot:nth-child(3) { animation-delay: 0.4s; }
      `}</style>

      {/* 헤더 */}
      <div
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', cursor: 'pointer' }}
        onClick={() => open ? setOpen(false) : startChat()}
      >
        <div style={{ display: 'flex', marginRight: 4 }}>
          {agents.slice(0, 5).map((agent, i) => (
            <div key={agent.id} style={{
              width: 26, height: 26, borderRadius: '50%',
              background: agent.color + '22',
              border: `1.5px solid ${agent.color}55`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginLeft: i === 0 ? 0 : -8,
              zIndex: agents.length - i,
              position: 'relative',
            }}>
              <AgentIcon agentId={agent.id} width={12} height={12} />
            </div>
          ))}
          {agents.length > 5 && (
            <div style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'var(--bg-secondary)',
              border: '1.5px solid var(--border)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginLeft: -8, fontSize: 9, color: 'var(--text-muted)', fontWeight: 700,
            }}>+{agents.length - 5}</div>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>팀 브리핑 채팅</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{agents.length}명 에이전트 참여</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {roundCount > 0 && !completed && (
            <span style={{ fontSize: 10, background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)', borderRadius: 10, padding: '1px 7px', fontWeight: 500 }}>
              {roundCount}회
            </span>
          )}
          {completed ? (
            <span style={{ fontSize: 11, color: 'var(--success)', fontWeight: 600, background: 'var(--success-dim)', border: '1px solid var(--success)22', borderRadius: 8, padding: '2px 8px' }}>
              완료
            </span>
          ) : (
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>
              {open ? '▲' : (messages.length > 0 ? '이어보기' : '시작')} ›
            </span>
          )}
        </div>
      </div>

      {/* 채팅 영역 */}
      {open && (
        <div style={{ borderTop: '1px solid var(--border)', minHeight: 360, maxHeight: '72vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.length === 0 && loading && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 60 }}>
                에이전트들 준비 중...
              </div>
            )}
            {messages.map(msg => {
              const agentDef = msg.agentId ? agentMap.get(msg.agentId) : null
              return (
                <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                  {msg.role === 'assistant' && agentDef && (
                    <div style={{
                      width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                      background: agentDef.color + '22', border: `1.5px solid ${agentDef.color}55`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      marginRight: 6, marginTop: 2,
                    }}>
                      <AgentIcon agentId={agentDef.id} width={11} height={11} />
                    </div>
                  )}
                  <div style={{
                    maxWidth: '76%',
                    background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-secondary)',
                    border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                    borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                    padding: '8px 12px',
                    fontSize: 12, lineHeight: 1.6,
                    color: msg.role === 'user' ? '#111111' : 'var(--text-primary)',
                    whiteSpace: 'pre-wrap', fontWeight: msg.role === 'user' ? 700 : 500,
                  }}>
                    {msg.role === 'assistant' && agentDef && (
                      <div style={{ fontSize: 10, fontWeight: 700, color: agentDef.color, marginBottom: 3 }}>
                        {agentDef.emoji} {agentDef.name}
                      </div>
                    )}
                    {msg.content}
                  </div>
                </div>
              )
            })}
            {error && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{ maxWidth: '92%', background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 10, padding: '8px 10px', fontSize: 12, color: '#fca5a5', whiteSpace: 'pre-wrap' }}>
                  {error}
                </div>
              </div>
            )}
            {loading && messages.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', alignItems: 'center', gap: 6 }}>
                <div style={{ display: 'flex' }}>
                  {agents.slice(0, 3).map(a => (
                    <div key={a.id} style={{ width: 18, height: 18, borderRadius: '50%', background: a.color + '22', border: `1px solid ${a.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginLeft: -4 }}>
                      <AgentIcon agentId={a.id} width={9} height={9} />
                    </div>
                  ))}
                </div>
                <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px 12px 12px 2px', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span className="briefing-typing-dot" />
                  <span className="briefing-typing-dot" />
                  <span className="briefing-typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력 영역 */}
          <div style={{ borderTop: '1px solid var(--border)', padding: '10px 12px', display: 'flex', gap: 8, alignItems: 'flex-end', background: 'var(--bg-secondary)', flexShrink: 0 }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() } }}
              placeholder="답변 입력... (Enter 전송, Shift+Enter 줄바꿈)"
              disabled={loading || completing}
              rows={2}
              style={{ flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', fontSize: 12, color: 'var(--text-primary)', resize: 'none', outline: 'none', fontFamily: 'inherit' }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading || completing}
                style={{ padding: '6px 12px', borderRadius: 7, border: 'none', background: input.trim() && !loading && !completing ? 'var(--accent)' : 'var(--border)', color: input.trim() && !loading && !completing ? '#111111' : 'var(--text-muted)', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}
              >
                전송
              </button>
              <button
                onClick={handleComplete}
                disabled={messages.length === 0 || completing}
                style={{ padding: '6px 12px', borderRadius: 7, border: '1px solid #3fb95066', background: 'transparent', color: '#3fb950', fontSize: 11, fontWeight: 700, cursor: 'pointer', opacity: messages.length === 0 || completing ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
              >
                {completing ? <><Spinner size={10} color="#3fb950" /> 회의록 작성 중...</> : '브리핑 완료 ✓'}
              </button>
            </div>
          </div>
          <div style={{ padding: '0 12px 10px', background: 'var(--bg-secondary)', color: 'var(--text-muted)', fontSize: 11, lineHeight: 1.5, flexShrink: 0 }}>
            대화 내용은 자동 저장되어 보고서에 반영됩니다. &apos;브리핑 완료&apos;를 누르면 회의록이 자동 작성됩니다.
          </div>
        </div>
      )}
    </div>
  )
}
