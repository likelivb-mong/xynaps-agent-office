import type { Agent, SkillFile } from '../../types'
import { AgentIcon } from '../ui/AgentIcon'
import { CloseIcon } from '../ui/Icon'

interface Props {
  agent: Agent
  skill: SkillFile
  onClose: () => void
}

export function SkillKnowledgeViewer({ agent, skill, onClose }: Props) {
  const lines = skill.knowledgeSummary?.split('\n') ?? []

  function renderLine(line: string, idx: number) {
    if (line.startsWith('## ')) {
      return (
        <div key={idx} style={{
          color: 'var(--accent)',
          fontWeight: 700,
          fontSize: 12,
          marginTop: 16,
          marginBottom: 4,
        }}>
          {line.replace('## ', '')}
        </div>
      )
    }
    if (line.startsWith('- ') || line.startsWith('* ')) {
      return (
        <div key={idx} style={{ color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.7, paddingLeft: 12 }}>
          <span style={{ color: 'var(--text-muted)' }}>›</span> {line.slice(2)}
        </div>
      )
    }
    if (line.trim() === '') {
      return <div key={idx} style={{ height: 4 }} />
    }
    return (
      <div key={idx} style={{ color: 'var(--text-secondary)', fontSize: 11, lineHeight: 1.7 }}>
        {line}
      </div>
    )
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.8)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 9999,
    }} onClick={onClose}>
      <div style={{
        width: 540, maxHeight: '78vh',
        background: 'var(--bg-card)',
        border: '1px solid var(--border-bright)',
        borderRadius: 14,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: '"JetBrains Mono", "Fira Code", "Courier New", monospace',
      }} onClick={e => e.stopPropagation()}>

        {/* 헤더 */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border)',
          padding: '10px 16px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 28, height: 28,
              background: agent.color + '15',
              border: `1px solid ${agent.color}22`,
              borderRadius: 8,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: agent.color,
            }}>
              <AgentIcon agentId={agent.id} width={13} height={13} />
            </div>
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', fontWeight: 600 }}>
                {agent.name} · 지식 DB
              </div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>
                {skill.name} · {new Date(skill.uploadedAt).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
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

        {/* 코드 영역 */}
        <div style={{
          padding: '14px 18px',
          overflowY: 'auto',
          flex: 1,
        }}>
          {/* 주석 헤더 */}
          <div style={{ color: 'var(--text-muted)', fontSize: 10, marginBottom: 12, lineHeight: 1.8 }}>
            <div>// AGENT: {agent.name} · {agent.role}</div>
            <div>// FILE: {skill.name}</div>
            <div>// ANALYZED: {new Date(skill.uploadedAt).toLocaleString('ko-KR')}</div>
          </div>

          {skill.knowledgeSummary
            ? lines.map((line, idx) => renderLine(line, idx))
            : (
              <div style={{ color: 'var(--text-muted)', fontSize: 11, fontStyle: 'italic', textAlign: 'center', marginTop: 40 }}>
                // 분석 데이터 없음 — 파일을 다시 업로드해주세요
              </div>
            )
          }
        </div>

        {/* 상태 바 */}
        <div style={{
          background: 'var(--bg-secondary)',
          borderTop: '1px solid var(--border)',
          padding: '6px 16px',
          display: 'flex', alignItems: 'center', gap: 8,
        }}>
          <div style={{
            width: 7, height: 7, borderRadius: '50%',
            background: skill.knowledgeSummary ? 'var(--success)' : 'var(--text-muted)',
          }} />
          <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>
            {skill.knowledgeSummary ? '분석 완료 — 협업 시 이 지식이 활용됩니다' : '분석 대기 중'}
          </span>
        </div>
      </div>
    </div>
  )
}
