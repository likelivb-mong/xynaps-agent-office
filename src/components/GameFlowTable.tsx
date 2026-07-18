import { Fragment } from 'react'
import type { GameFlowSheet } from '../types'
import { ExportIcon, PlusIcon, GridTableIcon } from './ui/Icon'
import {
  PALETTES, COL,
  getSectionAlphaLabel, computeStepLabels, useGameFlowEditing,
} from './gameflow/editing'
import { EditableCell, TogglePill, DragHandleDots, OutputTagChip, OutputTagPicker } from './gameflow/primitives'

// ── Main ───────────────────────────────────────────────────────────────────
interface GameFlowTableProps {
  sheet: GameFlowSheet
  onChange: (sheet: GameFlowSheet) => void
}

export function GameFlowTable({ sheet, onChange }: GameFlowTableProps) {
  const {
    collapsed, toggleCollapse,
    hoveredRow, setHoveredRow,
    armedDragId, setArmedDragId, draggingStep, dragOver,
    updateSection, updateStep, addStep, deleteStep, toggleStepFlag,
    addSection, deleteSection, exportCSV,
    handleRowDragStart, handleRowDragOver, handleRowDrop,
    handleSectionDragOver, handleSectionDrop, clearDrag,
  } = useGameFlowEditing(sheet, onChange)

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
      {/* 모바일: 컬럼을 짓누르는 대신 표에 최소 폭을 주고 가로 스크롤로 본다 */}
      <div style={{
        borderRadius: 14, border: '1px solid var(--border)',
        overflowX: 'auto', boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
        WebkitOverflowScrolling: 'touch',
      }}>
        <table style={{ width: '100%', minWidth: 820, borderCollapse: 'collapse', fontSize: 12 }}>
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

                        {/* OUT PUT — 분류 태그(색 구분) + 자유 텍스트 */}
                        <td style={td(isLast)}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: (step.outputTags?.length ?? 0) > 0 ? 3 : 0 }}>
                            {(step.outputTags ?? []).map(tag => (
                              <OutputTagChip key={tag} label={tag}
                                onRemove={() => updateStep(section.id, step.id, { outputTags: (step.outputTags ?? []).filter(t => t !== tag) })} />
                            ))}
                            <OutputTagPicker
                              tags={step.outputTags ?? []}
                              onChange={next => updateStep(section.id, step.id, { outputTags: next })} />
                          </div>
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
                    <tr key={`empty-${section.id}`}
                      onDragOver={handleSectionDragOver}
                      onDrop={(e) => handleSectionDrop(e, section.id)}>
                      <td colSpan={10} style={{
                        padding: '20px', textAlign: 'center',
                        color: 'var(--text-muted)', fontSize: 12,
                        borderBottom: '1px solid var(--border)',
                        fontStyle: 'italic', letterSpacing: 0.2,
                        background: draggingStep && draggingStep.secId !== section.id ? 'rgba(255,255,255,0.04)' : undefined,
                        outline: draggingStep && draggingStep.secId !== section.id ? '1px dashed var(--accent)' : undefined,
                        outlineOffset: -4,
                      }}>
                        {draggingStep && draggingStep.secId !== section.id
                          ? '여기로 끌어와서 이 섹션에 추가'
                          : '스텝이 없습니다 — "+ 행" 버튼으로 추가하세요'}
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
