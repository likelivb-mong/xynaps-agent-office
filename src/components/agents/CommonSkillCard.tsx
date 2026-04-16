import { useRef, useState } from 'react'
import type { SkillFile } from '../../types'
import { saveCommonSkill, removeCommonSkill, updateCommonSkillKnowledge, patchCommonSkill } from '../../lib/storage'
import { analyzeSkillFile } from '../../lib/api'
import { PaperclipIcon, DatabaseIcon, CloseIcon, Spinner, AgentIconCommon } from '../ui/Icon'
import { SkillKnowledgeViewer } from './SkillKnowledgeViewer'
import { AgentSkillModal } from './AgentSkillModal'

interface Props {
  skills: SkillFile[]
  onSkillsChange: () => void
}

const COMMON_AGENT = {
  id: '__common__' as const,
  name: '팀 공통',
  role: '전체 에이전트 공유',
  emoji: '📚',
  color: '#6c63f5',
  description: '',
  skills: [],
}

const MAX_SEGS = 8

export function CommonSkillCard({ skills, onSkillsChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [viewerSkill, setViewerSkill] = useState<SkillFile | null>(null)
  const [showManager, setShowManager] = useState(false)

  const busy = uploading || analyzingId !== null
  const activeCount = skills.filter(s => s.enabled !== false).length
  const filledSegs = Math.min(activeCount, MAX_SEGS)

  const uploadTitle = [
    '공통 스킬 추가',
    '모든 에이전트가 함께 참고하는 공유 자료입니다.',
    '예: 브랜드 가이드, 세계관 바이블, 기획 레퍼런스, 클라이언트 요청서',
  ].join('\n')

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }

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
      saveCommonSkill(skill)

      setAnalyzingId(skill.id)
      try {
        const summary = await analyzeSkillFile('ceo' as any, skill)
        if (summary) updateCommonSkillKnowledge(skill.id, summary)
        showToast(`✓ ${file.name} 분석 완료`)
      } catch {
        showToast(`✓ ${file.name} 추가됨`)
      }
      setAnalyzingId(null)
    }

    setUploading(false)
    onSkillsChange()
    if (fileRef.current) fileRef.current.value = ''
  }

  return (
    <>
      <div
        onClick={() => setShowManager(true)}
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          padding: '14px 14px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 0,
          position: 'relative',
          gridColumn: '1 / -1',
          cursor: 'pointer',
          transition: 'border-color 0.2s',
          userSelect: 'none',
        }}
        onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--border-bright)')}
        onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
      >
        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: skills.length > 0 ? 10 : 0 }}>
          {/* Avatar */}
          <div style={{
            width: 36, height: 36, flexShrink: 0,
            background: 'var(--accent-dim)',
            border: '1px solid var(--border-bright)',
            borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--accent)',
          }}>
            <AgentIconCommon width={16} height={16} />
          </div>

          {/* Title + description */}
          <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-primary)', lineHeight: 1.35 }}>
              팀 공통 스킬
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.4 }}>
              모든 에이전트가 함께 참고하는 공유 자료 — 협업 시 전체 맥락으로 활용됩니다
            </div>
          </div>

          {/* Upload button */}
          <button
            onClick={e => { e.stopPropagation(); fileRef.current?.click() }}
            disabled={busy}
            title={uploadTitle}
            style={{
              width: 26, height: 26, padding: 0, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: 7, border: '1px solid var(--border)',
              background: 'transparent',
              color: busy ? 'var(--accent-text)' : 'var(--text-muted)',
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
            {busy ? <Spinner size={11} color="var(--accent-text)" /> : <PaperclipIcon width={12} height={12} />}
          </button>
        </div>

        {/* ── Skill list ── */}
        {skills.length > 0 && (
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: 5,
            borderTop: '1px solid var(--border)',
            paddingTop: 8,
          }}>
            {skills.map(skill => (
              <div key={skill.id} style={{
                display: 'flex', alignItems: 'center', gap: 5,
                background: skill.knowledgeSummary ? 'var(--accent-dim)' : 'var(--bg-secondary)',
                border: `1px solid ${skill.knowledgeSummary ? 'var(--border-bright)' : 'transparent'}`,
                borderRadius: 6, padding: '3px 4px 3px 7px',
                maxWidth: 240,
                transition: 'background 0.15s',
              }}>
                <span style={{
                  fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                  padding: '1px 4px', borderRadius: 3, flexShrink: 0,
                  background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)',
                }}>
                  {skill.type === 'pdf' ? 'PDF' : 'IMG'}
                </span>
                <span style={{
                  flex: 1, minWidth: 0,
                  fontSize: 11, color: 'var(--text-secondary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {skill.name}
                </span>
                <button
                  onClick={e => { e.stopPropagation(); setViewerSkill(skill) }}
                  title={skill.knowledgeSummary ? '분석된 지식 보기' : '분석 중...'}
                  style={{
                    background: 'none', border: 'none', flexShrink: 0,
                    color: skill.knowledgeSummary ? 'var(--accent-text)' : 'var(--text-muted)',
                    cursor: 'pointer', padding: '2px 3px',
                    display: 'flex', alignItems: 'center',
                    opacity: analyzingId === skill.id ? 0.5 : 1,
                  }}>
                  {analyzingId === skill.id
                    ? <Spinner size={9} color="var(--accent-text)" />
                    : <DatabaseIcon width={11} height={11} />}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); removeCommonSkill(skill.id); onSkillsChange() }}
                  title="삭제"
                  style={{
                    background: 'none', border: 'none', flexShrink: 0,
                    color: 'var(--text-muted)', cursor: 'pointer', padding: '2px 3px',
                    display: 'flex', alignItems: 'center',
                  }}>
                  <CloseIcon width={10} height={10} />
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{
          paddingTop: 8, borderTop: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 2, marginTop: skills.length > 0 ? 8 : 10,
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

        <input ref={fileRef} type="file" multiple accept=".pdf,image/*"
          style={{ display: 'none' }} onChange={handleFileUpload} />

        {toastMsg && (
          <div style={{
            position: 'absolute', bottom: -34, left: 0, right: 0,
            background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
            borderRadius: 7, padding: '5px 10px',
            fontSize: 11, color: 'var(--success)', textAlign: 'center',
            zIndex: 10, animation: 'fadeIn 0.2s ease',
          }}>
            {toastMsg}
          </div>
        )}
      </div>

      {showManager && (
        <AgentSkillModal
          agent={COMMON_AGENT as any}
          initialSkills={skills}
          onClose={() => setShowManager(false)}
          onSkillsChange={onSkillsChange}
          persistence={{
            saveSkill: saveCommonSkill,
            removeSkill: removeCommonSkill,
            patchSkill: patchCommonSkill,
            updateKnowledge: updateCommonSkillKnowledge,
            analyzeAgentId: 'ceo',
          }}
        />
      )}

      {viewerSkill && (
        <SkillKnowledgeViewer
          agent={COMMON_AGENT as any}
          skill={viewerSkill}
          onClose={() => setViewerSkill(null)}
        />
      )}
    </>
  )
}
