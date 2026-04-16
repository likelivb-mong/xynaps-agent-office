import { useRef, useState } from 'react'
import type { Agent, SkillFile } from '../../types'
import { saveAgentSkill, updateSkillKnowledge } from '../../lib/storage'
import { analyzeSkillFile } from '../../lib/api'
import { PaperclipIcon, Spinner } from '../ui/Icon'
import { AgentIcon } from '../ui/AgentIcon'
import { AgentSkillModal } from './AgentSkillModal'

interface Props {
  agent: Agent
  skills: SkillFile[]
  onSkillsChange: () => void
}

const MAX_SEGS = 8

export function AgentCard({ agent, skills, onSkillsChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)

  const busy = uploading || analyzingId !== null
  const activeCount = skills.filter(s => s.enabled !== false).length
  const filledSegs = Math.min(activeCount, MAX_SEGS)

  function fileToBase64(file: File): Promise<string> {
    return new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload = () => res((reader.result as string).split(',')[1])
      reader.onerror = rej
      reader.readAsDataURL(file)
    })
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)

    for (const file of files) {
      const base64 = await fileToBase64(file)
      const type = file.type.includes('pdf') ? 'pdf' : 'image'
      const skill: SkillFile = {
        id: crypto.randomUUID(),
        name: file.name,
        type,
        url: URL.createObjectURL(file),
        base64,
        mediaType: file.type,
        uploadedAt: new Date().toISOString(),
        enabled: true,
      }
      saveAgentSkill(agent.id, skill)

      setAnalyzingId(skill.id)
      try {
        const summary = await analyzeSkillFile(agent.id, skill)
        if (summary) updateSkillKnowledge(agent.id, skill.id, summary)
      } catch { /* silent */ }
      setAnalyzingId(null)
    }

    setUploading(false)
    onSkillsChange()
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <div
        onClick={() => setShowModal(true)}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '14px 14px 12px',
          display: 'flex', flexDirection: 'column', gap: 0,
          cursor: 'pointer',
          transition: 'border-color 0.2s',
          position: 'relative',
          userSelect: 'none',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-bright)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
          <div style={{
            width: 36, height: 36, flexShrink: 0,
            background: agent.color + '15',
            border: `1px solid ${agent.color}25`,
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: agent.color,
          }}>
            <AgentIcon agentId={agent.id} width={16} height={16} />
          </div>

          <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {agent.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', lineHeight: 1.4, marginTop: 1 }}>
              {agent.role}
            </div>
          </div>

          {/* Quick upload — stopPropagation so it doesn't open the modal */}
          <button
            onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
            disabled={busy}
            title="스킬 파일 추가"
            style={{
              width: 26, height: 26, padding: 0, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 7, border: '1px solid var(--border)',
              background: 'transparent',
              color: busy ? 'var(--accent)' : 'var(--text-muted)',
              cursor: busy ? 'default' : 'pointer',
              transition: 'border-color 0.15s, color 0.15s, background 0.15s',
            }}
            onMouseEnter={e => {
              if (!busy) {
                e.currentTarget.style.borderColor = 'var(--border-bright)'
                e.currentTarget.style.color = 'var(--text-primary)'
                e.currentTarget.style.background = 'var(--bg-secondary)'
              }
            }}
            onMouseLeave={e => {
              if (!busy) {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.color = 'var(--text-muted)'
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            {busy ? <Spinner size={11} color="var(--accent)" /> : <PaperclipIcon width={12} height={12} />}
          </button>
        </div>

        {/* ── Description ── */}
        <div style={{
          fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 10,
        }}>
          {agent.description}
        </div>

        {/* ── Level bar ── */}
        <div style={{
          paddingTop: 8, borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 2,
        }}>
          {Array.from({ length: MAX_SEGS }, (_, i) => {
            const isFilled = i < filledSegs
            const isCurrent = isFilled && i === filledSegs - 1
            return (
              <div key={i} style={{
                flex: 1, height: 10, borderRadius: 3,
                background: isFilled ? 'var(--accent)' : 'var(--bg-secondary)',
                border: `1px solid ${isFilled ? 'var(--accent)55' : 'var(--border)'}`,
                boxShadow: isCurrent ? '0 0 8px var(--accent)88' : 'none',
                transition: 'background 0.2s, box-shadow 0.2s',
              }} />
            )
          })}
          {/* Skill count */}
          <div style={{ marginLeft: 6, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: activeCount > 0 ? 'var(--accent)' : 'var(--text-muted)', lineHeight: 1 }}>
              {activeCount}
            </span>
            {skills.length > 0 && activeCount < skills.length && (
              <span style={{ fontSize: 8, color: 'var(--text-muted)', lineHeight: 1, marginTop: 1 }}>
                / {skills.length}
              </span>
            )}
          </div>
        </div>
      </div>

      {showModal && (
        <AgentSkillModal
          agent={agent}
          initialSkills={skills}
          onClose={() => setShowModal(false)}
          onSkillsChange={() => { onSkillsChange(); }}
        />
      )}

      <input ref={fileRef} type="file" multiple accept=".pdf,image/*"
        style={{ display: 'none' }} onChange={handleFileUpload} />
    </>
  )
}
