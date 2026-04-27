import { useState, useRef, useEffect } from 'react'
import type { Agent, ChatMessage, BriefingData } from '../../types'
import { briefAgent } from '../../lib/api'
import { updateProjectBriefing } from '../../lib/storage'
import { AgentIcon } from '../ui/AgentIcon'

interface Props {
  agent: Agent
  briefing?: BriefingData
  projectContext: string
  projectId: string
  onUpdate: () => void
}

export function AgentBriefingCard({ agent, briefing, projectContext, projectId, onUpdate }: Props) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>(briefing?.messages ?? [])
  const [completed, setCompleted] = useState(!!briefing?.completedAt)
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setMessages(briefing?.messages ?? [])
    setCompleted(!!briefing?.completedAt)
  }, [briefing?.messages, briefing?.completedAt])

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  async function startBriefing() {
    setOpen(true)
    if (messages.length > 0) return  // 이미 시작된 경우 그냥 열기
    setLoading(true)
    setError(null)
    try {
      const text = await briefAgent(agent.id, [], projectContext)
      const agentMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: text,
        agentId: agent.id,
        createdAt: new Date().toISOString(),
      }
      const next = [agentMsg]
      setMessages(next)
      updateProjectBriefing(projectId, agent.id, next)
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : '브리핑 질문을 불러오지 못했습니다.')
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
    updateProjectBriefing(projectId, agent.id, withUser)

    setLoading(true)
    setError(null)
    try {
      const response = await briefAgent(agent.id, withUser, projectContext)
      const agentMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response,
        agentId: agent.id,
        createdAt: new Date().toISOString(),
      }
      const final = [...withUser, agentMsg]
      setMessages(final)
      updateProjectBriefing(projectId, agent.id, final)
      onUpdate()
    } catch (e) {
      console.error(e)
      setError(e instanceof Error ? e.message : '에이전트 답변을 가져오지 못했습니다.')
    }
    setLoading(false)
  }

  function completeBriefing() {
    setCompleted(true)
    updateProjectBriefing(projectId, agent.id, messages, true)
    setOpen(false)
    onUpdate()
  }

  const msgCount = messages.length

  return (
    <div style={{
      border: `1px solid ${completed ? 'var(--border-bright)' : 'var(--border)'}`,
      borderRadius: 10,
      background: 'var(--bg-card)',
      transition: 'all 0.2s',
      overflow: 'hidden',
    }}>
      {/* 카드 헤더 */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '11px 14px', cursor: 'pointer',
        }}
        onClick={() => open ? setOpen(false) : startBriefing()}
      >
        <div style={{
          width: 30, height: 30, flexShrink: 0,
          background: agent.color + '15',
          border: `1px solid ${agent.color}22`,
          borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: agent.color,
        }}>
          <AgentIcon agentId={agent.id} width={14} height={14} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
            {agent.name}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{agent.role}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {msgCount > 0 && !completed && (
            <span style={{
              fontSize: 10, background: 'var(--bg-secondary)', color: 'var(--text-muted)',
              border: '1px solid var(--border)',
              borderRadius: 10, padding: '1px 7px', fontWeight: 500,
            }}>
              {Math.ceil(msgCount / 2)}회
            </span>
          )}
          {completed ? (
            <span style={{
              fontSize: 11, color: 'var(--success)', fontWeight: 600,
              background: 'var(--success-dim)', border: '1px solid var(--success)22',
              borderRadius: 8, padding: '2px 8px',
            }}>
              완료
            </span>
          ) : (
            <span style={{
              fontSize: 11, color: 'var(--text-muted)', fontWeight: 500,
            }}>
              {open ? '▲' : (msgCount > 0 ? '이어보기' : '시작')} ›
            </span>
          )}
        </div>
      </div>

      {/* 펼쳐진 채팅 영역 */}
      {open && (
        <div style={{
          borderTop: `1px solid var(--border)`,
          minHeight: 340,
          height: 360,
          maxHeight: '72vh',
          resize: 'vertical',
          overflow: 'auto',
          display: 'flex',
          flexDirection: 'column',
        }}>
          {/* 메시지 목록 */}
          <div style={{
            flex: 1, minHeight: 180, overflowY: 'auto',
            padding: '12px 16px',
            display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            {messages.length === 0 && loading && (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12, marginTop: 60 }}>
                {agent.name} 준비 중...
              </div>
            )}
            {messages.map(msg => (
              <div key={msg.id} style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '80%',
                  background: msg.role === 'user' ? 'var(--accent)' : 'var(--bg-secondary)',
                  border: msg.role === 'assistant' ? '1px solid var(--border)' : 'none',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  padding: '8px 12px',
                  fontSize: 12, lineHeight: 1.6,
                  color: msg.role === 'user' ? '#111111' : 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  fontWeight: msg.role === 'user' ? 700 : 500,
                }}>
                  {msg.role === 'assistant' && (
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600, marginBottom: 3 }}>
                      {agent.name}
                    </div>
                  )}
                  {msg.content}
                </div>
              </div>
            ))}
            {error && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  maxWidth: '92%',
                  background: 'rgba(248,113,113,0.12)',
                  border: '1px solid rgba(248,113,113,0.35)',
                  borderRadius: 10,
                  padding: '8px 10px',
                  fontSize: 12,
                  lineHeight: 1.55,
                  color: '#fca5a5',
                  whiteSpace: 'pre-wrap',
                }}>
                  {error}
                </div>
              </div>
            )}
            {loading && messages.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
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
                <div style={{
                  background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                  borderRadius: '12px 12px 12px 2px',
                  padding: '10px 14px',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <span className="briefing-typing-dot" />
                  <span className="briefing-typing-dot" />
                  <span className="briefing-typing-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* 입력 영역 */}
          <div style={{
            borderTop: '1px solid var(--border)',
            padding: '10px 12px',
            display: 'flex', gap: 8, alignItems: 'flex-end',
            background: 'var(--bg-secondary)',
            flexShrink: 0,
          }}>
            <textarea
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
              }}
              placeholder="답변 입력... (Enter 전송, Shift+Enter 줄바꿈)"
              disabled={loading}
              rows={2}
              style={{
                flex: 1, background: 'var(--bg-card)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '7px 10px', fontSize: 12,
                color: 'var(--text-primary)', resize: 'none', outline: 'none',
                fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                style={{
                  padding: '6px 12px', borderRadius: 7, border: 'none',
                  background: input.trim() && !loading ? 'var(--accent)' : 'var(--border)',
                  color: input.trim() && !loading ? '#111111' : 'var(--text-muted)',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  transition: 'background 0.15s',
                }}>
                전송
              </button>
              <button
                onClick={completeBriefing}
                disabled={messages.length === 0}
                style={{
                  padding: '6px 12px', borderRadius: 7,
                  border: `1px solid #3fb95066`,
                  background: 'transparent', color: '#3fb950',
                  fontSize: 11, fontWeight: 700, cursor: 'pointer',
                  opacity: messages.length === 0 ? 0.4 : 1,
                }}>
                브리핑 완료 ✓
              </button>
            </div>
          </div>
          <div style={{
            padding: '0 12px 10px',
            background: 'var(--bg-secondary)',
            color: 'var(--text-muted)',
            fontSize: 11,
            lineHeight: 1.5,
            flexShrink: 0,
          }}>
            대화 내용은 자동 저장되어 바로 반영됩니다. `브리핑 완료`는 이 에이전트와의 사전 논의를 마쳤다는 표시입니다.
          </div>
        </div>
      )}
    </div>
  )
}
