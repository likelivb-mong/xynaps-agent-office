import { useState, useRef, useEffect } from 'react'
import type { AgentReport, ChatMessage, DetailVersion } from '../../types'
import { AGENTS } from '../../data/agents'
import { chatWithAgent, regenerateAgentDetail } from '../../lib/api'
import type { AgentReport as AR } from '../../types'
import { Spinner, WriteIcon, ChevronUpIcon } from '../ui/Icon'
import { AgentIcon } from '../ui/AgentIcon'

interface Props {
  report: AgentReport
  projectContext: string
  previousReports: AR[]
  onNewVersion: (chatHistory: ChatMessage[], newVersion: DetailVersion) => void
  onChatSave: (chatHistory: ChatMessage[]) => void
}

export function AgentChatPanel({ report, projectContext, previousReports, onNewVersion, onChatSave }: Props) {
  const agentDef = AGENTS.find(a => a.id === report.agentId)!
  const [messages, setMessages] = useState<ChatMessage[]>(report.chatHistory ?? [])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const messageListRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = messageListRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages, sending])

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  async function sendMessage() {
    const text = input.trim()
    if (!text || sending || regenerating) return

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(), role: 'user', content: text,
      createdAt: new Date().toISOString(),
    }
    const nextHistory = [...messages, userMsg]
    setMessages(nextHistory)
    setInput('')
    setSending(true)

    try {
      const reply = await chatWithAgent(report.agentId, nextHistory, projectContext)
      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(), role: 'assistant', content: reply,
        agentId: report.agentId, createdAt: new Date().toISOString(),
      }
      const finalHistory = [...nextHistory, assistantMsg]
      setMessages(finalHistory)
      onChatSave(finalHistory)
    } catch (e) {
      setMessages(prev => [...prev, {
        id: crypto.randomUUID(), role: 'assistant',
        content: `오류: ${e instanceof Error ? e.message : String(e)}`,
        agentId: report.agentId, createdAt: new Date().toISOString(),
      }])
    } finally {
      setSending(false)
    }
  }

  async function handleRegenerate() {
    if (regenerating || sending) return
    setRegenerating(true)
    try {
      const { summary, detail } = await regenerateAgentDetail(
        report.agentId, messages, projectContext, previousReports,
      )
      const regenCount = (report.detailVersions?.filter(v => v.label !== '원본').length ?? 0) + 1
      const newVersion: DetailVersion = {
        id: crypto.randomUUID(), summary, detail,
        createdAt: new Date().toISOString(),
        label: `업데이트 ${regenCount}`,
      }
      onNewVersion(messages, newVersion)
    } catch (e) {
      alert(`업데이트 오류: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setRegenerating(false)
    }
  }

  const regenCount = report.detailVersions?.filter(v => v.label !== '원본').length ?? 0
  const busy = sending || regenerating
  const canRegen = messages.length > 0 && !busy

  return (
    <div style={{
      background: 'linear-gradient(180deg, rgba(26,28,34,0.98), rgba(19,21,27,0.98))',
      border: '1px solid var(--border)',
      borderRadius: 16,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
      minHeight: 460,
      boxShadow: '0 18px 40px rgba(0,0,0,0.28)',
      backdropFilter: 'blur(12px)',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{
          width: 22, height: 22, flexShrink: 0,
          background: agentDef.color + '15',
          border: `1px solid ${agentDef.color}22`,
          borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: agentDef.color,
        }}>
          <AgentIcon agentId={agentDef.id} width={11} height={11} />
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{agentDef.name}</div>
          <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>채팅</div>
        </div>

        {regenCount > 0 && (
          <span style={{
            fontSize: 9, color: 'var(--text-muted)', fontWeight: 600,
            background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)',
            borderRadius: 8, padding: '1px 6px', letterSpacing: '0.03em',
          }}>
            {regenCount}회 업데이트
          </span>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, alignItems: 'center' }}>
          <button
            onClick={handleRegenerate}
            disabled={!canRegen}
            title={canRegen ? '채팅 내용을 반영해 보고서 업데이트' : '채팅 후 사용 가능'}
            style={{
              width: 28, height: 28, padding: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 7, border: 'none',
              background: canRegen ? 'var(--accent)' : 'rgba(255,255,255,0.05)',
              color: canRegen ? 'var(--accent-fg)' : 'var(--text-muted)',
              cursor: canRegen ? 'pointer' : 'not-allowed',
              opacity: canRegen ? 1 : 0.4,
              transition: 'opacity 0.15s',
            }}
          >
            {regenerating ? <Spinner size={11} color="var(--accent-fg)" /> : <WriteIcon width={13} height={13} />}
          </button>
        </div>
      </div>

      {/* ── Messages ── */}
      <div style={{
        flex: 1, minHeight: 0, overflowY: 'auto',
        padding: '12px 12px 8px',
        display: 'flex', flexDirection: 'column', gap: 8,
      }} ref={messageListRef}>
        {messages.length === 0 && (
          <div style={{
            flex: 1, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: 6, color: 'var(--text-muted)',
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: agentDef.color + '15', border: `1px solid ${agentDef.color}22`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: agentDef.color,
            }}>
              <AgentIcon agentId={agentDef.id} width={16} height={16} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-secondary)' }}>
              {agentDef.name}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', textAlign: 'center', maxWidth: 240, lineHeight: 1.6 }}>
              기획에 대한 의견이나 수정 요청을 입력하세요.{'\n'}
              채팅 후 보고서 업데이트 버튼으로 반영합니다.
            </span>
          </div>
        )}

        {messages.map(msg => (
          <div key={msg.id} style={{
            display: 'flex', gap: 7,
            justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            alignItems: 'flex-end',
          }}>
            {msg.role === 'assistant' && (
              <div style={{
                width: 20, height: 20, flexShrink: 0,
                background: agentDef.color + '15', border: `1px solid ${agentDef.color}22`,
                borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: agentDef.color,
              }}>
                <AgentIcon agentId={agentDef.id} width={10} height={10} />
              </div>
            )}
            <div style={{
              maxWidth: '78%',
              padding: '8px 11px',
              borderRadius: msg.role === 'user' ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
              background: msg.role === 'user' ? 'var(--accent-dim)' : 'var(--bg-card)',
              border: `1px solid ${msg.role === 'user' ? 'var(--border-bright)' : 'var(--border)'}`,
              fontSize: 12, color: 'var(--text-primary)', lineHeight: 1.65,
              whiteSpace: 'pre-wrap',
            }}>
              {msg.content}
            </div>
          </div>
        ))}

        {sending && (
          <div style={{ display: 'flex', gap: 7, alignItems: 'flex-end' }}>
            <div style={{
              width: 20, height: 20, flexShrink: 0,
              background: agentDef.color + '15', border: `1px solid ${agentDef.color}22`,
              borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: agentDef.color,
            }}>
              <AgentIcon agentId={agentDef.id} width={10} height={10} />
            </div>
            <div style={{
              padding: '8px 12px',
              borderRadius: '12px 12px 12px 3px',
              background: 'var(--bg-card)', border: '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <Spinner size={10} color="var(--text-muted)" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>입력 중</span>
            </div>
          </div>
        )}

      </div>

      {/* ── Input ── */}
      <div style={{
        padding: '8px 10px',
        borderTop: '1px solid var(--border)',
        display: 'flex', gap: 7, alignItems: 'flex-end',
      }}>
        <textarea
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
          }}
          placeholder={`${agentDef.name}에게 메시지...`}
          rows={2}
          style={{
            flex: 1,
            background: 'var(--bg-card)',
            border: '1px solid var(--border)',
            borderRadius: 9, padding: '7px 10px',
            color: 'var(--text-primary)', fontSize: 12,
            resize: 'none', fontFamily: 'inherit', outline: 'none',
            lineHeight: 1.5,
          }}
        />
        <button
          onClick={sendMessage}
          disabled={!input.trim() || busy}
          title="전송 (Enter)"
          style={{
            width: 34, height: 34, padding: 0, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderRadius: 9, border: 'none',
            background: input.trim() && !busy ? 'var(--accent)' : 'var(--border)',
            color: input.trim() && !busy ? 'var(--accent-fg)' : 'var(--text-muted)',
            cursor: input.trim() && !busy ? 'pointer' : 'not-allowed',
            opacity: !input.trim() || busy ? 0.5 : 1,
            transition: 'background 0.15s, opacity 0.15s',
          }}
        >
          <ChevronUpIcon width={14} height={14} />
        </button>
      </div>
    </div>
  )
}
