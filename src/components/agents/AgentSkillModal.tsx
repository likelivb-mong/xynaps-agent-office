import { useState, useRef } from 'react'
import type { Agent, SkillFile, AgentId } from '../../types'
import { saveAgentSkill, removeAgentSkill, updateSkillKnowledge, patchAgentSkill } from '../../lib/storage'
import { analyzeSkillFile } from '../../lib/api'
import { AgentIcon } from '../ui/AgentIcon'
import { CloseIcon, PaperclipIcon, TrashIcon, DatabaseIcon, Spinner } from '../ui/Icon'

function PromptIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M2 3.5C2 2.67 2.67 2 3.5 2h9C13.33 2 14 2.67 14 3.5v7c0 .83-.67 1.5-1.5 1.5H9l-3 2.5V12H3.5C2.67 12 2 11.33 2 10.5v-7z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
      <path d="M5 6h6M5 8.5h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}
import { SkillKnowledgeViewer } from './SkillKnowledgeViewer'

interface Props {
  agent: Agent
  initialSkills: SkillFile[]
  onClose: () => void
  onSkillsChange: () => void
  persistence?: {
    saveSkill: (skill: SkillFile) => void
    removeSkill: (skillId: string) => void
    patchSkill: (skillId: string, updates: Partial<SkillFile>) => void
    updateKnowledge: (skillId: string, summary: string) => void
    analyzeAgentId?: string
  }
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={value}
      onClick={() => onChange(!value)}
      style={{
        width: 34, height: 20, padding: 0, borderRadius: 10, border: 'none',
        background: value ? 'var(--accent)' : 'rgba(255,255,255,0.08)',
        cursor: 'pointer', position: 'relative', flexShrink: 0,
        transition: 'background 0.2s',
      }}
    >
      <span style={{
        position: 'absolute',
        top: 2, left: value ? 16 : 2,
        width: 16, height: 16, borderRadius: '50%',
        background: value ? 'var(--accent-fg)' : '#555',
        transition: 'left 0.18s',
        display: 'block',
      }} />
    </button>
  )
}

export function AgentSkillModal({ agent, initialSkills, onClose, onSkillsChange, persistence }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const saveSkill = persistence?.saveSkill ?? ((skill: SkillFile) => saveAgentSkill(agent.id as AgentId, skill))
  const removeSkill = persistence?.removeSkill ?? ((skillId: string) => removeAgentSkill(agent.id as AgentId, skillId))
  const patchSkill = persistence?.patchSkill ?? ((skillId: string, updates: Partial<SkillFile>) => patchAgentSkill(agent.id as AgentId, skillId, updates))
  const updateKnowledge = persistence?.updateKnowledge ?? ((skillId: string, summary: string) => updateSkillKnowledge(agent.id as AgentId, skillId, summary))
  const analyzeTarget = persistence?.analyzeAgentId ?? agent.id

  // Local draft: tracks enabled state per skill id
  const [enabledMap, setEnabledMap] = useState<Record<string, boolean>>(() => {
    const m: Record<string, boolean> = {}
    initialSkills.forEach(s => { m[s.id] = s.enabled !== false })
    return m
  })

  const [skills, setSkills] = useState<SkillFile[]>(initialSkills)
  const [analyzingId, setAnalyzingId] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [viewerSkill, setViewerSkill] = useState<SkillFile | null>(null)
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [toastMsg, setToastMsg] = useState<string | null>(null)
  const [promptEditingId, setPromptEditingId] = useState<string | null>(null)
  const [promptDraft, setPromptDraft] = useState('')

  const busy = uploading || analyzingId !== null

  // Dirty: any toggle differs from the initial saved state
  const isDirty = skills.some(s => {
    const init = initialSkills.find(i => i.id === s.id)
    if (!init) return false
    return (init.enabled !== false) !== (enabledMap[s.id] ?? true)
  })

  function showToast(msg: string) {
    setToastMsg(msg)
    setTimeout(() => setToastMsg(null), 2500)
  }

  function handleToggle(skillId: string, val: boolean) {
    setEnabledMap(m => ({ ...m, [skillId]: val }))
  }

  function handleSave() {
    skills.forEach(s => {
      patchSkill(s.id, { enabled: enabledMap[s.id] ?? true })
    })
    onSkillsChange()
    onClose()
  }

  function handleCloseAttempt() {
    if (isDirty) setShowCloseConfirm(true)
    else onClose()
  }

  function handleDiscardClose() {
    // Revert storage changes? No — we haven't written toggle to storage yet, only to local state.
    onClose()
  }

  async function handleDelete(skillId: string) {
    removeSkill(skillId)
    setSkills(prev => prev.filter(s => s.id !== skillId))
    setEnabledMap(m => { const n = { ...m }; delete n[skillId]; return n })
    setDeleteConfirmId(null)
    onSkillsChange()
    showToast('파일이 영구 삭제되었습니다')
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
      saveSkill(skill)
      setSkills(prev => [...prev, skill])
      setEnabledMap(m => ({ ...m, [skill.id]: true }))

      setAnalyzingId(skill.id)
      try {
        const summary = await analyzeSkillFile(analyzeTarget as AgentId, skill)
        if (summary) {
          updateKnowledge(skill.id, summary)
          setSkills(prev => prev.map(s => s.id === skill.id ? { ...s, knowledgeSummary: summary } : s))
        }
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

  const enabledCount = skills.filter(s => enabledMap[s.id] !== false).length

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(0,0,0,0.78)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
      onClick={e => e.target === e.currentTarget && handleCloseAttempt()}
    >
      <div style={{
        width: '100%', maxWidth: 480,
        background: 'var(--bg-card)',
        border: '1px solid var(--border-bright)',
        borderRadius: 16,
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        maxHeight: '82vh',
        position: 'relative',
      }}>

        {/* ── Header ── */}
        <div style={{
          padding: '14px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', gap: 10,
          flexShrink: 0,
        }}>
          <div style={{
            width: 34, height: 34, borderRadius: 9, flexShrink: 0,
            background: agent.color + '18',
            border: `1px solid ${agent.color}28`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: agent.color,
          }}>
            <AgentIcon agentId={agent.id} width={15} height={15} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', lineHeight: 1.3 }}>
              {agent.name}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 1 }}>{agent.role}</div>
          </div>
          <button onClick={handleCloseAttempt} style={{
            width: 28, height: 28, padding: 0, borderRadius: 7,
            border: '1px solid var(--border)', background: 'none',
            color: 'var(--text-muted)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <CloseIcon width={11} height={11} />
          </button>
        </div>

        {/* ── Subheader: count + upload button ── */}
        <div style={{
          padding: '9px 16px',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>스킬 파일</span>
            <span style={{
              fontSize: 10, fontWeight: 700, color: 'var(--accent)',
              background: 'var(--accent-dim)', border: '1px solid var(--accent)33',
              borderRadius: 5, padding: '1px 7px',
            }}>
              {skills.length}개
            </span>
            {skills.length > 0 && enabledCount < skills.length && (
              <span style={{
                fontSize: 10, color: 'var(--text-muted)',
                background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                borderRadius: 5, padding: '1px 7px',
              }}>
                {enabledCount}개 활성
              </span>
            )}
          </div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 7,
              border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-secondary)',
              fontSize: 11, fontWeight: 600, cursor: busy ? 'default' : 'pointer',
              transition: 'border-color 0.15s, color 0.15s',
              opacity: busy ? 0.6 : 1,
            }}
            onMouseEnter={e => { if (!busy) { e.currentTarget.style.borderColor = 'var(--border-bright)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
            onMouseLeave={e => { if (!busy) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
          >
            {busy ? <Spinner size={10} color="var(--text-muted)" /> : <PaperclipIcon width={11} height={11} />}
            파일 추가
          </button>
        </div>

        {/* ── Skill list ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
          {skills.length === 0 ? (
            <div style={{
              padding: '36px 16px', textAlign: 'center',
              color: 'var(--text-muted)', fontSize: 12,
            }}>
              업로드된 스킬 파일이 없습니다
              <div style={{ fontSize: 11, marginTop: 5, opacity: 0.55, lineHeight: 1.6 }}>
                파일을 추가하면 AI가 분석하여<br />이 에이전트의 전문 지식으로 활용합니다
              </div>
            </div>
          ) : (
            skills.map(skill => {
              const enabled = enabledMap[skill.id] ?? true
              const isDeleting = deleteConfirmId === skill.id
              return (
                <div key={skill.id} style={{
                  marginBottom: 5, borderRadius: 9,
                  border: `1px solid ${isDeleting ? '#e0555540' : 'var(--border)'}`,
                  background: isDeleting ? '#e0555510' : 'var(--bg-secondary)',
                  overflow: 'hidden',
                  transition: 'all 0.15s',
                  opacity: enabled ? 1 : 0.45,
                }}>
                  {/* Main row */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px',
                  }}>
                    {/* Type badge */}
                    <span style={{
                      fontSize: 8, fontWeight: 700, letterSpacing: '0.06em',
                      padding: '2px 5px', borderRadius: 3, flexShrink: 0,
                      background: skill.type === 'pdf' ? '#e0555522' : '#4488ff22',
                      color: skill.type === 'pdf' ? '#e08888' : '#6699ff',
                      border: `1px solid ${skill.type === 'pdf' ? '#e0555533' : '#4488ff33'}`,
                    }}>
                      {skill.type === 'pdf' ? 'PDF' : 'IMG'}
                    </span>

                    {/* Filename */}
                    <span style={{
                      flex: 1, minWidth: 0, fontSize: 12,
                      color: enabled ? 'var(--text-primary)' : 'var(--text-muted)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      lineHeight: 1.4,
                    }}>
                      {skill.name}
                    </span>

                    {/* Guide prompt button */}
                    <button
                      onClick={() => {
                        if (promptEditingId === skill.id) {
                          setPromptEditingId(null)
                        } else {
                          setPromptDraft(skill.guidePrompt ?? '')
                          setPromptEditingId(skill.id)
                        }
                      }}
                      title={skill.guidePrompt ? '가이드 프롬프트 편집' : '가이드 프롬프트 추가'}
                      style={{
                        background: 'none', border: 'none', flexShrink: 0,
                        color: skill.guidePrompt ? '#a78bfa' : 'var(--text-muted)',
                        cursor: 'pointer', padding: '2px 3px',
                        display: 'flex', alignItems: 'center',
                      }}>
                      <PromptIcon />
                    </button>

                    {/* AI knowledge indicator */}
                    <button
                      onClick={() => setViewerSkill(skill)}
                      title={skill.knowledgeSummary ? 'AI 분석 결과 보기' : '분석 대기 중'}
                      style={{
                        background: 'none', border: 'none', flexShrink: 0,
                        color: skill.knowledgeSummary ? 'var(--accent)' : 'var(--text-muted)',
                        cursor: 'pointer', padding: '2px 3px',
                        display: 'flex', alignItems: 'center',
                        opacity: analyzingId === skill.id ? 0.5 : 1,
                      }}>
                      {analyzingId === skill.id
                        ? <Spinner size={10} color="var(--accent)" />
                        : <DatabaseIcon width={11} height={11} />}
                    </button>

                    {/* Enable/disable toggle */}
                    <Toggle value={enabled} onChange={v => handleToggle(skill.id, v)} />

                    {/* Delete button */}
                    <button
                      onClick={() => setDeleteConfirmId(isDeleting ? null : skill.id)}
                      title="영구 삭제"
                      style={{
                        background: 'none', border: 'none', flexShrink: 0,
                        color: isDeleting ? '#e08080' : 'var(--text-muted)',
                        cursor: 'pointer', padding: '2px 3px',
                        display: 'flex', alignItems: 'center',
                        transition: 'color 0.15s',
                      }}>
                      <TrashIcon width={11} height={11} />
                    </button>
                  </div>

                  {/* Inline guide prompt editor */}
                  {promptEditingId === skill.id && (
                    <div style={{
                      padding: '8px 10px',
                      borderTop: '1px solid #a78bfa22',
                      background: '#a78bfa08',
                    }}>
                      <div style={{ fontSize: 10, color: '#a78bfa', fontWeight: 600, marginBottom: 5 }}>
                        가이드 프롬프트
                      </div>
                      <textarea
                        autoFocus
                        value={promptDraft}
                        onChange={e => setPromptDraft(e.target.value)}
                        placeholder="예: 이 파일은 예시입니다. 동일한 형식과 구성 방식으로 완성해주세요."
                        rows={3}
                        style={{
                          width: '100%', boxSizing: 'border-box',
                          background: 'var(--bg-card)', border: '1px solid #a78bfa44',
                          borderRadius: 6, padding: '6px 8px',
                          fontSize: 11, color: 'var(--text-primary)',
                          resize: 'vertical', outline: 'none', lineHeight: 1.5,
                          fontFamily: 'inherit',
                        }}
                      />
                      <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6 }}>
                        <button
                          onClick={() => setPromptEditingId(null)}
                          style={{
                            padding: '3px 10px', borderRadius: 6,
                            border: '1px solid var(--border)', background: 'transparent',
                            color: 'var(--text-muted)', fontSize: 11, cursor: 'pointer',
                          }}>취소</button>
                        <button
                          onClick={() => {
                            const trimmed = promptDraft.trim()
                            patchSkill(skill.id, { guidePrompt: trimmed || undefined })
                            setSkills(prev => prev.map(s =>
                              s.id === skill.id ? { ...s, guidePrompt: trimmed || undefined } : s
                            ))
                            setPromptEditingId(null)
                            onSkillsChange()
                          }}
                          style={{
                            padding: '3px 10px', borderRadius: 6, border: 'none',
                            background: '#a78bfa', color: '#fff',
                            fontSize: 11, fontWeight: 700, cursor: 'pointer',
                          }}>적용</button>
                      </div>
                    </div>
                  )}

                  {/* Inline delete confirmation */}
                  {isDeleting && (
                    <div style={{
                      padding: '7px 10px',
                      borderTop: '1px solid #e0555522',
                      background: '#e0555508',
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span style={{ flex: 1, fontSize: 11, color: '#e08888', lineHeight: 1.4 }}>
                        영구 삭제합니다. 복구할 수 없습니다.
                      </span>
                      <button onClick={() => setDeleteConfirmId(null)} style={{
                        padding: '3px 10px', borderRadius: 6, border: '1px solid var(--border)',
                        background: 'transparent', color: 'var(--text-muted)',
                        fontSize: 11, cursor: 'pointer',
                      }}>취소</button>
                      <button onClick={() => handleDelete(skill.id)} style={{
                        padding: '3px 10px', borderRadius: 6,
                        border: '1px solid #e0555566',
                        background: '#e0555520', color: '#e08080',
                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                      }}>삭제</button>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>

        {/* ── Footer: normal or close-confirm ── */}
        {!showCloseConfirm ? (
          <div style={{
            padding: '10px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', gap: 8,
            flexShrink: 0,
          }}>
            {isDirty && (
              <span style={{ flex: 1, fontSize: 11, color: 'var(--text-muted)' }}>
                저장되지 않은 변경사항이 있습니다
              </span>
            )}
            {!isDirty && <span style={{ flex: 1 }} />}
            <button onClick={handleCloseAttempt} style={{
              padding: '7px 16px', borderRadius: 8,
              border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--text-secondary)',
              fontSize: 12, cursor: 'pointer',
            }}>닫기</button>
            {isDirty && (
              <button onClick={handleSave} style={{
                padding: '7px 18px', borderRadius: 8, border: 'none',
                background: 'var(--accent)', color: 'var(--accent-fg)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>저장</button>
            )}
          </div>
        ) : (
          <div style={{
            padding: '14px 16px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-secondary)',
            flexShrink: 0,
          }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4 }}>
              저장하지 않은 변경사항이 있습니다
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 12, lineHeight: 1.5 }}>
              토글 설정을 저장하고 닫으시겠습니까?
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={() => setShowCloseConfirm(false)} style={{
                padding: '7px 14px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text-muted)', fontSize: 12, cursor: 'pointer',
              }}>계속 편집</button>
              <button onClick={handleDiscardClose} style={{
                padding: '7px 14px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'transparent',
                color: 'var(--text-secondary)', fontSize: 12, cursor: 'pointer',
              }}>저장 안 함</button>
              <button onClick={handleSave} style={{
                padding: '7px 18px', borderRadius: 8, border: 'none',
                background: 'var(--accent)', color: 'var(--accent-fg)',
                fontSize: 12, fontWeight: 700, cursor: 'pointer',
              }}>저장하기</button>
            </div>
          </div>
        )}

        {/* Toast */}
        {toastMsg && (
          <div style={{
            position: 'absolute', bottom: 70, left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--bg-card)', border: '1px solid var(--border-bright)',
            borderRadius: 8, padding: '6px 14px',
            fontSize: 11, color: 'var(--success)',
            whiteSpace: 'nowrap', zIndex: 10,
          }}>
            {toastMsg}
          </div>
        )}
      </div>

      <input ref={fileRef} type="file" multiple accept=".pdf,image/*"
        style={{ display: 'none' }} onChange={handleFileUpload} />

      {viewerSkill && (
        <SkillKnowledgeViewer
          agent={agent}
          skill={viewerSkill}
          onClose={() => setViewerSkill(null)}
        />
      )}
    </div>
  )
}
