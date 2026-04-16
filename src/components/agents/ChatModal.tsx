import { useState, useRef, useEffect } from 'react'
import type { Agent, ChatMessage } from '../../types'
import { callAgent } from '../../lib/api'
import { AgentIcon } from '../ui/AgentIcon'
import { CloseIcon, Spinner, ChevronUpIcon } from '../ui/Icon'

interface Props {
  agent: Agent
  onClose: () => void
}

export function ChatModal({ agent, onClose }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!input.trim() || loading) return
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(), role: 'user', content: input,
      agentId: agent.id, createdAt: new Date().toISOString(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput('')
    setLoading(true)

    try {
      const reply = await callAgent(agent, input)
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(), role: 'assistant', content: reply,
        agentId: agent.id, createdAt: new Date().toISOString(),
      }
      setMessages(prev => [...prev, assistantMsg])
    } catch (e) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant',
        content: `오류: ${String(e)}`,
        agentId: agent.id, createdAt: new Date().toISOString(),
      }])
    }
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.8)', display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: 24,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: '100%', maxWidth: 560, height: '78vh',
        background: 'var(--bg-card)', borderRadius: 16,
        border: '1px solid var(--border-bright)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div style={{
          padding: '13px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9,
              background: agent.color + '15',
              border: `1px solid ${agent.color}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: agent.color,
            }}>
              <AgentIcon agentId={agent.id} width={15} height={15} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)' }}>{agent.name}</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>{agent.role}</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, padding: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'none', border: '1px solid var(--border)',
            borderRadius: 7, color: 'var(--text-muted)', cursor: 'pointer',
          }}>
            <CloseIcon width={11} height={11} />
          </button>
        </div>

        {/* 메시지 목록 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 40, fontSize: 13 }}>
              {agent.name}에게 질문해보세요
              {agent.skills.length > 0 && (
                <div style={{ fontSize: 11, marginTop: 6, color: 'var(--text-muted)' }}>
                  스킬 파일 {agent.skills.length}개 적용됨
                </div>
              )}
            </div>
          )}
          {messages.map(msg => (
            <div key={msg.id} style={{
              display: 'flex',
              justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '80%', padding: '9px 13px', borderRadius: 11,
                background: msg.role === 'user' ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                border: `1px solid ${msg.role === 'user' ? 'var(--border-bright)' : 'var(--border)'}`,
                fontSize: 13, lineHeight: 1.65, color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap',
              }}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: '9px 14px', borderRadius: 11,
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', gap: 7,
              }}>
                <Spinner size={11} color="var(--text-muted)" />
                <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>생각 중...</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* 입력창 */}
        <div style={{
          padding: '10px 12px', borderTop: '1px solid var(--border)',
          display: 'flex', gap: 8, alignItems: 'flex-end',
        }}>
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), send())}
            placeholder="메시지 입력... (Shift+Enter 줄바꿈)"
            style={{
              flex: 1, background: 'var(--bg-secondary)', border: '1px solid var(--border)',
              borderRadius: 9, padding: '8px 12px', color: 'var(--text-primary)',
              fontSize: 13, resize: 'none', height: 42, fontFamily: 'inherit', outline: 'none',
            }}
          />
          <button onClick={send} disabled={loading || !input.trim()} style={{
            width: 36, height: 36, padding: 0, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 9, border: 'none',
            background: !loading && input.trim() ? 'var(--accent)' : 'var(--border)',
            color: !loading && input.trim() ? 'var(--accent-fg)' : 'var(--text-muted)',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !input.trim() ? 0.5 : 1,
            transition: 'background 0.15s',
          }}>
            <ChevronUpIcon width={14} height={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
