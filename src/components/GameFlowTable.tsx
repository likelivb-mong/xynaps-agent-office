import { useState, useEffect, useRef, Fragment } from 'react'
import type { GameFlowSheet, GameFlowSection, GameStep } from '../types'
import { ExportIcon, PlusIcon, SearchIcon, LockIcon, ZapIcon, GridTableIcon } from './ui/Icon'

// ── Design tokens ──────────────────────────────────────────────────────────
const PALETTES = [
  { accent: '#a78bfa', dim: 'rgba(167,139,250,0.10)', line: 'rgba(167,139,250,0.35)' },
  { accent: '#60a5fa', dim: 'rgba(96,165,250,0.10)',  line: 'rgba(96,165,250,0.35)'  },
  { accent: '#34d399', dim: 'rgba(52,211,153,0.10)',  line: 'rgba(52,211,153,0.35)'  },
  { accent: '#fb923c', dim: 'rgba(251,146,60,0.10)',  line: 'rgba(251,146,60,0.35)'  },
  { accent: '#f472b6', dim: 'rgba(244,114,182,0.10)', line: 'rgba(244,114,182,0.35)' },
]
const COL = {
  xkit: { fg: 'rgba(74,222,128,0.90)',  bg: 'rgba(74,222,128,0.13)',  glow: 'rgba(74,222,128,0.25)',  icon: <SearchIcon width={13} height={13} />, label: 'Xkit'  },
  key:  { fg: 'rgba(251,191,36,0.90)',  bg: 'rgba(251,191,36,0.12)',  glow: 'rgba(251,191,36,0.22)',  icon: <LockIcon  width={13} height={13} />, label: 'Lock'  },
  dev:  { fg: 'rgba(96,165,250,0.90)',  bg: 'rgba(96,165,250,0.13)',  glow: 'rgba(96,165,250,0.25)',  icon: <ZapIcon   width={13} height={13} />, label: 'Dev'   },
}

const FLAG_FIELDS = ['xkit', 'key', 'dev'] as const
type FlagField = typeof FLAG_FIELDS[number]

function getSectionAlphaLabel(index: number): string {
  let n = index + 1
  let label = ''
  while (n > 0) {
    const rem = (n - 1) % 26
    label = String.fromCharCode(65 + rem) + label
    n = Math.floor((n - 1) / 26)
  }
  return label
}

function stepGroupId(step: GameStep): string {
  return step.stepGroup ?? step.id
}

function renumberSteps(steps: GameStep[]): GameStep[] {
  return steps.map((step, index) => ({ ...step, step: index + 1 }))
}

function computeStepLabels(steps: GameStep[]): Record<string, string> {
  const labels: Record<string, string> = {}
  let i = 0
  let main = 0
  while (i < steps.length) {
    const group = stepGroupId(steps[i])
    let j = i + 1
    while (j < steps.length && stepGroupId(steps[j]) === group) j += 1
    main += 1
    const size = j - i
    for (let k = i; k < j; k += 1) {
      labels[steps[k].id] = size === 1 ? `${main}` : `${main}-${k - i + 1}`
    }
    i = j
  }
  return labels
}

// ── EditableCell ───────────────────────────────────────────────────────────
function EditableCell({
  value, onChange, multiline = false, placeholder = '', style,
}: {
  value: string; onChange: (v: string) => void
  multiline?: boolean; placeholder?: string; style?: React.CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() { setEditing(false); if (draft !== value) onChange(draft) }

  const baseInput: React.CSSProperties = {
    width: '100%', fontFamily: 'inherit', fontSize: 12,
    background: 'rgba(255,255,255,0.04)', color: 'var(--text-primary)',
    border: '1px solid var(--accent)', borderRadius: 6,
    padding: '5px 8px', outline: 'none', resize: 'none',
    boxSizing: 'border-box', lineHeight: 1.5, ...style,
  }

  if (editing) return multiline
    ? <textarea rows={2} value={draft} autoFocus
        onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        style={baseInput} />
    : <input value={draft} autoFocus
        onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        style={baseInput} />

  return (
    <div onClick={() => { setDraft(value); setEditing(true) }}
      style={{
        cursor: 'text', minHeight: 24, padding: '5px 8px', borderRadius: 6,
        fontSize: 12, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        color: value ? 'var(--text-primary)' : 'var(--text-muted)',
        transition: 'background 0.1s', ...style,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {value || placeholder}
    </div>
  )
}

// ── TogglePill ─────────────────────────────────────────────────────────────
function TogglePill({ value, onChange, col }: {
  value: boolean; onChange: (v: boolean) => void
  col: { fg: string; bg: string; glow: string; icon: React.ReactNode; label: string }
}) {
  return (
    <button onClick={() => onChange(!value)} title={value ? `${col.label} 해제` : `${col.label} 설정`}
      style={{
        width: 30, height: 30, borderRadius: 9, border: 'none', cursor: 'pointer',
        background: value ? col.bg : 'rgba(255,255,255,0.03)',
        color: value ? col.fg : 'rgba(255,255,255,0.18)',
        fontSize: value ? 15 : 13, transition: 'all 0.15s',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: value ? `0 0 10px ${col.glow}` : 'none',
        outline: value ? `1px solid ${col.fg}44` : '1px solid transparent',
      }}>
      {col.icon}
    </button>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
interface GameFlowTableProps {
  sheet: GameFlowSheet
  onChange: (sheet: GameFlowSheet) => void
}

export function GameFlowTable({ sheet, onChange }: GameFlowTableProps) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)
  // 드래그 앤 드롭 상태
  const [armedDragId, setArmedDragId] = useState<string | null>(null)
  const [draggingStep, setDraggingStep] = useState<{ secId: string; stepId: string } | null>(null)
  const [dragOver, setDragOver] = useState<{ stepId: string; pos: 'before' | 'after' } | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // 핸들에서 마우스 떼면 armed 해제 (드래그 시작 안 하고 그냥 클릭한 경우)
  useEffect(() => {
    if (!armedDragId) return
    const onUp = () => setArmedDragId(null)
    window.addEventListener('mouseup', onUp)
    return () => window.removeEventListener('mouseup', onUp)
  }, [armedDragId])

  function updateSection(id: string, patch: Partial<GameFlowSection>) {
    onChange({ ...sheet, sections: sheet.sections.map(s => s.id === id ? { ...s, ...patch } : s) })
  }
  function updateStep(secId: string, stepId: string, patch: Partial<GameStep>) {
    onChange({
      ...sheet,
      sections: sheet.sections.map(s =>
        s.id === secId
          ? { ...s, steps: s.steps.map(st => st.id === stepId ? { ...st, ...patch } : st) }
          : s
      ),
    })
  }
  function addStep(secId: string) {
    const sec = sheet.sections.find(s => s.id === secId)!
    const newStep: GameStep = {
      id: crypto.randomUUID(), step: sec.steps.length + 1,
      clue: '', story: '', input: '', xkit: false, key: false, dev: false,
      output: '', auto: false, problemType: '',
    }
    updateSection(secId, { steps: [...sec.steps, newStep] })
  }
  function deleteStep(secId: string, stepId: string) {
    const sec = sheet.sections.find(s => s.id === secId)!
    updateSection(secId, { steps: renumberSteps(sec.steps.filter(st => st.id !== stepId)) })
  }
  // ── 드래그 앤 드롭 ─────────────────────────────────────────────────────────
  function handleRowDragStart(e: React.DragEvent, secId: string, stepId: string) {
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', `${secId}:${stepId}`)
    setDraggingStep({ secId, stepId })
  }
  function handleRowDragOver(e: React.DragEvent, secId: string, stepId: string) {
    if (!draggingStep || draggingStep.secId !== secId) return // 같은 섹션 내에서만 허용
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after'
    if (dragOver?.stepId !== stepId || dragOver.pos !== pos) {
      setDragOver({ stepId, pos })
    }
  }
  function handleRowDrop(e: React.DragEvent, secId: string, targetStepId: string) {
    if (!draggingStep || draggingStep.secId !== secId) return
    e.preventDefault()
    const sec = sheet.sections.find(s => s.id === secId)
    if (!sec) return
    const fromIdx = sec.steps.findIndex(st => st.id === draggingStep.stepId)
    let toIdx = sec.steps.findIndex(st => st.id === targetStepId)
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) { clearDrag(); return }
    if (dragOver?.pos === 'after') toIdx++
    const steps = [...sec.steps]
    const [moved] = steps.splice(fromIdx, 1)
    if (fromIdx < toIdx) toIdx-- // 제거 후 인덱스 보정
    steps.splice(toIdx, 0, moved)
    updateSection(secId, { steps: renumberSteps(steps) })
    clearDrag()
  }
  function clearDrag() {
    setDraggingStep(null)
    setDragOver(null)
    setArmedDragId(null)
  }
  function toggleStepFlag(secId: string, stepId: string, field: FlagField, nextValue: boolean) {
    const sec = sheet.sections.find(s => s.id === secId)
    if (!sec) return
    const idx = sec.steps.findIndex(st => st.id === stepId)
    if (idx < 0) return
    const step = sec.steps[idx]

    if (!nextValue) {
      updateStep(secId, stepId, { [field]: false } as Partial<GameStep>)
      return
    }

    const selected = FLAG_FIELDS.filter(flag => step[flag])
    if (selected.length === 0) {
      updateStep(secId, stepId, { [field]: true } as Partial<GameStep>)
      return
    }
    if (selected.length === 1 && selected[0] === field) return

    const groupId = step.stepGroup ?? crypto.randomUUID()
    const mergedFlags = FLAG_FIELDS.filter(flag => selected.includes(flag) || flag === field)
    const replacement = mergedFlags.map((flag, rowIndex) => ({
      ...step,
      id: rowIndex === 0 ? step.id : crypto.randomUUID(),
      stepGroup: groupId,
      xkit: false,
      key: false,
      dev: false,
      [flag]: true,
    }))

    const nextSteps = [
      ...sec.steps.slice(0, idx),
      ...replacement,
      ...sec.steps.slice(idx + 1),
    ]
    updateSection(secId, { steps: renumberSteps(nextSteps) })
  }
  function addSection() {
    onChange({ ...sheet, sections: [...sheet.sections, { id: crypto.randomUUID(), title: '새 섹션', steps: [] }] })
  }
  function deleteSection(id: string) {
    if (!confirm('이 섹션을 삭제하시겠어요?')) return
    onChange({ ...sheet, sections: sheet.sections.filter(s => s.id !== id) })
  }
  function toggleCollapse(id: string) {
    setCollapsed(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })
  }
  function exportCSV() {
    const rows = ['섹션,Step,Clue,Story,IN PUT,Xkit,Lock,Dev,OUT PUT,메모']
    sheet.sections.forEach(sec => {
      const labels = computeStepLabels(sec.steps)
      sec.steps.forEach(st => {
        rows.push([sec.title, labels[st.id] ?? st.step, st.clue, st.story || '', st.input, st.xkit ? '✓' : '', st.key ? '✓' : '', st.dev ? '✓' : '', st.output, st.note || '']
        .map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))
      })
    })
    const blob = new Blob(['\uFEFF' + rows.join('\n')], { type: 'text/csv;charset=utf-8' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: '게임플로우시트.csv' })
    a.click(); URL.revokeObjectURL(a.href)
  }

  const totalSteps = sheet.sections.reduce((n, s) => n + s.steps.length, 0)

  return (
    <div style={{ fontFamily: 'inherit' }}>

      {/* ── 툴바 ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20,
        padding: '14px 18px', borderRadius: 14,
        background: 'var(--bg-card)', border: '1px solid var(--border)',
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: -0.3 }}>
            게임 플로우 시트
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            {sheet.sections.length}개 섹션 · {totalSteps}개 스텝
          </div>
        </div>
        <div style={{ flex: 1 }} />

<button onClick={addSection} title="섹션 추가" style={toolIconBtn('var(--accent)')}>
          <PlusIcon width={15} height={15} />
        </button>
        <button onClick={exportCSV} title="CSV 내보내기" style={toolIconBtn('#10b981')}>
          <ExportIcon width={15} height={15} />
        </button>
      </div>

      {/* ── 테이블 ── */}
      <div style={{
        borderRadius: 14, border: '1px solid var(--border)',
        overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
      }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {[
                { label: '', w: 32 },
                { label: 'STEP', w: 42 },
                { label: 'CLUE', w: 120 },
                { label: 'STORY', minW: 160 },
                { label: 'IN PUT', minW: 140 },
                { label: 'Xkit', w: 44 },
                { label: 'Lock', w: 44 },
                { label: 'Dev', w: 44 },
                { label: 'OUT PUT', minW: 140 },
                { label: '', w: 32 },
              ].map(({ label, w, minW }, i) => {
                const colInfo = label === 'Xkit' ? COL.xkit : label === 'Lock' ? COL.key : label === 'Dev' ? COL.dev : null
                return (
                <th key={i} style={{
                  padding: '10px 8px', fontSize: 10, fontWeight: 700,
                  color: colInfo ? colInfo.fg : 'var(--text-muted)',
                  letterSpacing: '0.06em',
                  textAlign: 'center', whiteSpace: 'nowrap',
                  background: colInfo ? colInfo.bg : 'rgba(255,255,255,0.025)',
                  borderBottom: '1px solid var(--border)',
                  position: 'sticky', top: 0, zIndex: 2,
                  width: w, minWidth: minW,
                }}>
                  {label}
                </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sheet.sections.map((section, si) => {
              const pal = PALETTES[si % PALETTES.length]
              const isCollapsed = collapsed.has(section.id)
              const stepLabels = computeStepLabels(section.steps)
              return (
                <Fragment key={section.id}>
                  {/* 섹션 헤더 */}
                  <tr key={`sh-${section.id}`}>
                    <td colSpan={10} style={{ padding: 0 }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 14px',
                        background: pal.dim,
                        borderLeft: `3px solid ${pal.accent}`,
                        borderTop: si > 0 ? '1px solid var(--border)' : undefined,
                        borderBottom: isCollapsed ? 'none' : `1px solid ${pal.line}`,
                      }}>
                        {/* 접기 버튼 */}
                        <button onClick={() => toggleCollapse(section.id)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: pal.accent, fontSize: 11, padding: '2px 4px',
                          opacity: 0.8, lineHeight: 1,
                          transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.2s, opacity 0.1s',
                        }}>▾</button>

                        {/* 섹션 번호 */}
                        <span style={{
                          minWidth: 24, height: 20, borderRadius: 6, flexShrink: 0,
                          background: pal.accent, color: '#fff', fontSize: 10,
                          fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                          padding: '0 5px',
                        }}>{getSectionAlphaLabel(si)}</span>

                        {/* 타이틀 편집 */}
                        <div style={{ flex: 1 }}>
                          <EditableCell
                            value={section.title}
                            onChange={v => updateSection(section.id, { title: v })}
                            placeholder="섹션 이름"
                            style={{ fontWeight: 700, color: pal.accent, fontSize: 13, padding: '2px 6px' }}
                          />
                        </div>

                        {/* 스텝 수 뱃지 */}
                        <span style={{
                          padding: '2px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                          background: `${pal.accent}22`, color: pal.accent, border: `1px solid ${pal.line}`,
                        }}>
                          {section.steps.length}개 스텝
                        </span>

                        {/* 행 추가 */}
                        <button onClick={() => addStep(section.id)} style={{
                          padding: '4px 10px', borderRadius: 8, border: `1px solid ${pal.line}`,
                          background: `${pal.accent}15`, color: pal.accent,
                          fontSize: 11, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                        }}>+ 행</button>

                        {/* 섹션 삭제 */}
                        <button onClick={() => deleteSection(section.id)} style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'rgba(255,80,80,0.45)', fontSize: 16, padding: '0 2px',
                          lineHeight: 1, transition: 'color 0.1s',
                        }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,80,80,0.9)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,80,80,0.45)')}>
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>

                  {/* 스텝 행 */}
                  {!isCollapsed && section.steps.map((step, rowIdx) => {
                    const isAuto = step.auto
                    const isHovered = hoveredRow === step.id
                    const isLast = rowIdx === section.steps.length - 1
                    const isBeingDragged = draggingStep?.stepId === step.id
                    const dropBefore = dragOver?.stepId === step.id && dragOver.pos === 'before' && draggingStep?.secId === section.id
                    const dropAfter = dragOver?.stepId === step.id && dragOver.pos === 'after' && draggingStep?.secId === section.id
                    return (
                      <tr key={step.id}
                        draggable={armedDragId === step.id}
                        onDragStart={(e) => handleRowDragStart(e, section.id, step.id)}
                        onDragOver={(e) => handleRowDragOver(e, section.id, step.id)}
                        onDrop={(e) => handleRowDrop(e, section.id, step.id)}
                        onDragEnd={clearDrag}
                        onMouseEnter={() => setHoveredRow(step.id)}
                        onMouseLeave={() => setHoveredRow(null)}
                        style={{
                          background: isAuto
                            ? 'rgba(100,116,139,0.06)'
                            : isHovered ? 'rgba(255,255,255,0.028)' : 'transparent',
                          transition: 'background 0.1s',
                          opacity: isBeingDragged ? 0.35 : 1,
                          boxShadow: dropBefore
                            ? 'inset 0 2px 0 0 var(--accent)'
                            : dropAfter
                              ? 'inset 0 -2px 0 0 var(--accent)'
                              : undefined,
                        }}>

                        {/* 드래그 핸들 */}
                        <td style={td(isLast)}>
                          <div
                            onMouseDown={() => setArmedDragId(step.id)}
                            title="드래그하여 순서 변경"
                            style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 20, height: 28, margin: '0 auto',
                              opacity: isHovered || isBeingDragged ? 0.85 : 0.25,
                              transition: 'opacity 0.15s',
                              cursor: armedDragId === step.id ? 'grabbing' : 'grab',
                              color: 'var(--text-muted)',
                              userSelect: 'none',
                            }}
                          >
                            <DragHandleDots />
                          </div>
                        </td>

                        {/* Step 번호 */}
                        <td style={{ ...td(isLast), textAlign: 'center' }}>
                          <div style={{
                            width: 26, height: 26, borderRadius: 8, margin: '0 auto',
                            background: isAuto ? 'rgba(100,116,139,0.15)' : `${pal.accent}18`,
                            color: isAuto ? 'var(--text-muted)' : pal.accent,
                            fontSize: 11, fontWeight: 700,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontStyle: isAuto ? 'italic' : 'normal',
                          }}>
                            {stepLabels[step.id] ?? step.step}
                          </div>
                        </td>

                        {/* Clue */}
                        <td style={td(isLast)}>
                          <EditableCell value={step.clue}
                            onChange={v => updateStep(section.id, step.id, { clue: v })}
                            placeholder="단서명"
                            style={isAuto ? { color: 'var(--text-muted)', fontStyle: 'italic' } : undefined} />
                        </td>

                        {/* Story */}
                        <td style={td(isLast)}>
                          <EditableCell value={step.story ?? ''}
                            onChange={v => updateStep(section.id, step.id, { story: v })}
                            placeholder="진행 스토리 / 풀이 요약"
                            multiline
                            style={isAuto ? { color: 'var(--text-muted)', fontStyle: 'italic' } : undefined} />
                        </td>

                        {/* IN PUT */}
                        <td style={td(isLast)}>
                          <EditableCell
                            value={step.auto ? `(AUTO) ${step.input}` : step.input}
                            onChange={v => {
                              const a = v.startsWith('(AUTO)')
                              updateStep(section.id, step.id, { input: a ? v.replace('(AUTO)', '').trim() : v, auto: a })
                            }}
                            placeholder="입력값 / 행동"
                            multiline
                            style={isAuto ? { color: 'var(--text-muted)', fontStyle: 'italic' } : undefined} />
                        </td>

                        {/* Xkit / Lock / Dev 토글 */}
                        {([
                          ['xkit', COL.xkit] as const,
                          ['key',  COL.key ] as const,
                          ['dev',  COL.dev ] as const,
                        ]).map(([field, col]) => (
                          <td key={field} style={{
                            ...td(isLast), textAlign: 'center',
                            background: step[field] ? col.bg : undefined,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              <TogglePill value={step[field] as boolean}
                                onChange={v => toggleStepFlag(section.id, step.id, field, v)}
                                col={col} />
                            </div>
                          </td>
                        ))}

                        {/* OUT PUT */}
                        <td style={td(isLast)}>
                          <EditableCell value={step.output}
                            onChange={v => updateStep(section.id, step.id, { output: v })}
                            placeholder="결과 / 열리는 것"
                            multiline
                            style={isAuto ? { color: 'var(--text-muted)', fontStyle: 'italic' } : undefined} />
                        </td>

                        {/* 삭제 */}
                        <td style={{ ...td(isLast), textAlign: 'center' }}>
                          <button onClick={() => deleteStep(section.id, step.id)} style={{
                            background: 'none', border: 'none', cursor: 'pointer',
                            color: 'rgba(255,80,80,0.4)', fontSize: 16, padding: '0 4px',
                            opacity: isHovered ? 1 : 0.3, transition: 'opacity 0.15s, color 0.1s',
                            lineHeight: 1,
                          }}
                            onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,80,80,0.9)')}
                            onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,80,80,0.4)')}>
                            ×
                          </button>
                        </td>
                      </tr>
                    )
                  })}

                  {/* 빈 섹션 */}
                  {!isCollapsed && section.steps.length === 0 && (
                    <tr key={`empty-${section.id}`}>
                      <td colSpan={10} style={{
                        padding: '20px', textAlign: 'center',
                        color: 'var(--text-muted)', fontSize: 12,
                        borderBottom: '1px solid var(--border)',
                        fontStyle: 'italic', letterSpacing: 0.2,
                      }}>
                        스텝이 없습니다 — "+ 행" 버튼으로 추가하세요
                      </td>
                    </tr>
                  )}
                </Fragment>
              )
            })}

            {/* 전체 빈 상태 */}
            {sheet.sections.length === 0 && (
              <tr>
                <td colSpan={10} style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <div style={{ marginBottom: 12, opacity: 0.3, color: 'var(--text-muted)' }}>
                    <GridTableIcon width={32} height={32} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                    게임 플로우가 비어 있습니다
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', opacity: 0.7 }}>
                    우측 상단 + 버튼으로 섹션을 추가하세요
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} />
    </div>
  )
}

// ── Style helpers ──────────────────────────────────────────────────────────
const td = (isLast: boolean): React.CSSProperties => ({
  borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.04)',
  verticalAlign: 'middle', padding: '2px 4px',
})

function toolIconBtn(color: string): React.CSSProperties {
  return {
    width: 32, height: 32, padding: 0, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, border: `1px solid ${color}44`,
    background: `${color}15`, color,
    cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
  }
}

function DragHandleDots() {
  return (
    <svg width={10} height={16} viewBox="0 0 10 16" fill="currentColor" aria-hidden>
      <circle cx="3" cy="3" r="1.3" />
      <circle cx="7" cy="3" r="1.3" />
      <circle cx="3" cy="8" r="1.3" />
      <circle cx="7" cy="8" r="1.3" />
      <circle cx="3" cy="13" r="1.3" />
      <circle cx="7" cy="13" r="1.3" />
    </svg>
  )
}
