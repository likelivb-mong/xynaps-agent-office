import type { GameFlowSheet } from '../types'
import { ExportIcon, PlusIcon, GridTableIcon } from './ui/Icon'
import {
  PALETTES, COL,
  getSectionAlphaLabel, computeStepLabels, useGameFlowEditing,
} from './gameflow/editing'
import { EditableCell, TogglePill, DragHandleDots, TagChip, TagPicker } from './gameflow/primitives'

// ── 작은 안쪽 화살표 아이콘 (In / Out 라벨용) ──────────────────────────────────
function InArrow() {
  return (
    <svg width={12} height={12} viewBox="0 0 12 12" fill="none" stroke="currentColor"
      strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M2 6h6M5.5 3.5L8 6l-2.5 2.5M10 2.5v7" />
    </svg>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────
interface GameFlowCardsProps {
  sheet: GameFlowSheet
  onChange: (sheet: GameFlowSheet) => void
}

export function GameFlowCards({ sheet, onChange }: GameFlowCardsProps) {
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

      {/* ── 섹션 카드 목록 ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {sheet.sections.map((section, si) => {
          const pal = PALETTES[si % PALETTES.length]
          const isCollapsed = collapsed.has(section.id)
          const stepLabels = computeStepLabels(section.steps)
          return (
            <div key={section.id} style={{
              borderRadius: 14, border: '1px solid var(--border)',
              overflow: 'hidden', boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
              background: 'var(--bg-card)',
            }}>
              {/* 섹션 헤더 */}
              <div
                onDragOver={handleSectionDragOver}
                onDrop={(e) => handleSectionDrop(e, section.id)}
                style={{
                  // 모바일: 타이틀이 짓눌리지 않도록 뱃지/버튼이 다음 줄로 흐르게 한다
                  display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
                  padding: '14px 18px',
                  background: pal.dim,
                  borderLeft: `4px solid ${pal.accent}`,
                  borderBottom: isCollapsed ? 'none' : `1px solid ${pal.line}`,
                }}>
                {/* 접기 버튼 */}
                <button onClick={() => toggleCollapse(section.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: pal.accent, fontSize: 13, padding: '2px 4px',
                  opacity: 0.8, lineHeight: 1,
                  transform: isCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s, opacity 0.1s',
                }}>▾</button>

                {/* 섹션 번호 */}
                <span style={{
                  minWidth: 30, height: 30, borderRadius: 9, flexShrink: 0,
                  background: pal.accent, color: '#fff', fontSize: 13,
                  fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 7px',
                }}>{getSectionAlphaLabel(si)}</span>

                {/* 타이틀 편집 — 최소 폭을 확보해 좁은 화면에서 세로 짓눌림 방지 */}
                <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                  <EditableCell
                    value={section.title}
                    onChange={v => updateSection(section.id, { title: v })}
                    placeholder="섹션 이름"
                    style={{ fontWeight: 700, color: pal.accent, fontSize: 16, padding: '2px 6px' }}
                  />
                </div>

                {/* 스텝 수 뱃지 */}
                <span style={{
                  padding: '4px 12px', borderRadius: 20, fontSize: 12, fontWeight: 700,
                  background: `${pal.accent}22`, color: pal.accent, border: `1px solid ${pal.line}`,
                  whiteSpace: 'nowrap',
                }}>
                  {section.steps.length} 스텝
                </span>

                {/* 행 추가 */}
                <button onClick={() => addStep(section.id)} style={{
                  padding: '5px 12px', borderRadius: 8, border: `1px solid ${pal.line}`,
                  background: `${pal.accent}15`, color: pal.accent,
                  fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap',
                }}>+ 스텝</button>

                {/* 섹션 삭제 */}
                <button onClick={() => deleteSection(section.id)} style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: 'rgba(255,80,80,0.45)', fontSize: 18, padding: '0 2px',
                  lineHeight: 1, transition: 'color 0.1s',
                }}
                  onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,80,80,0.9)')}
                  onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,80,80,0.45)')}>
                  ×
                </button>
              </div>

              {/* 스텝 카드들 */}
              {!isCollapsed && section.steps.map((step, rowIdx) => {
                const isAuto = step.auto
                const isHovered = hoveredRow === step.id
                const isLast = rowIdx === section.steps.length - 1
                const isBeingDragged = draggingStep?.stepId === step.id
                const dropBefore = dragOver?.stepId === step.id && dragOver.pos === 'before' && draggingStep?.secId === section.id
                const dropAfter = dragOver?.stepId === step.id && dragOver.pos === 'after' && draggingStep?.secId === section.id
                return (
                  <div key={step.id}
                    draggable={armedDragId === step.id}
                    onDragStart={(e) => handleRowDragStart(e, section.id, step.id)}
                    onDragOver={(e) => handleRowDragOver(e, section.id, step.id)}
                    onDrop={(e) => handleRowDrop(e, section.id, step.id)}
                    onDragEnd={clearDrag}
                    onMouseEnter={() => setHoveredRow(step.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      // 모바일: 본문(단서/스토리/In·Out)이 짓눌리지 않게 토글·삭제가 다음 줄로 흐른다
                      display: 'flex', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap',
                      padding: '14px 18px',
                      borderBottom: isLast ? 'none' : '1px solid rgba(255,255,255,0.05)',
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
                    <div
                      onMouseDown={() => setArmedDragId(step.id)}
                      title="드래그하여 순서 변경"
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        width: 18, height: 28, flexShrink: 0,
                        opacity: isHovered || isBeingDragged ? 0.85 : 0.25,
                        transition: 'opacity 0.15s',
                        cursor: armedDragId === step.id ? 'grabbing' : 'grab',
                        color: 'var(--text-muted)',
                        userSelect: 'none',
                      }}
                    >
                      <DragHandleDots />
                    </div>

                    {/* Step 번호 */}
                    <div style={{
                      minWidth: 38, height: 30, borderRadius: 8, flexShrink: 0,
                      padding: '0 8px',
                      background: isAuto ? 'rgba(100,116,139,0.15)' : `${pal.accent}18`,
                      color: isAuto ? 'var(--text-muted)' : pal.accent,
                      fontSize: 13, fontWeight: 800,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontStyle: isAuto ? 'italic' : 'normal',
                    }}>
                      {stepLabels[step.id] ?? step.step}
                    </div>

                    {/* 본문: 제목 + 설명 + In/Out — 최소 폭 확보(좁으면 우측 토글이 줄바꿈) */}
                    <div style={{ flex: '1 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {/* 제목 (Clue) */}
                      <EditableCell value={step.clue}
                        onChange={v => updateStep(section.id, step.id, { clue: v })}
                        placeholder="단서명"
                        style={{
                          fontSize: 15, fontWeight: 700,
                          color: isAuto ? 'var(--text-muted)' : 'var(--text-primary)',
                          fontStyle: isAuto ? 'italic' : 'normal',
                          padding: '3px 6px',
                        }} />

                      {/* 설명 (Story) */}
                      <EditableCell value={step.story ?? ''}
                        onChange={v => updateStep(section.id, step.id, { story: v })}
                        placeholder="진행 스토리 / 풀이 요약"
                        multiline
                        style={{
                          fontSize: 13, lineHeight: 1.55,
                          color: 'var(--text-muted)',
                          fontStyle: isAuto ? 'italic' : 'normal',
                          padding: '3px 6px',
                        }} />

                      {/* In */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 4 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          flexShrink: 0, color: 'var(--text-muted)', opacity: 0.7,
                          fontSize: 11, fontWeight: 700, paddingTop: 6, minWidth: 34,
                        }}>
                          <InArrow />In
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* IN PUT 분류 태그 (색 구분) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: (step.inputTags?.length ?? 0) > 0 ? 3 : 0, paddingTop: 4 }}>
                            {(step.inputTags ?? []).map(tag => (
                              <TagChip key={tag} label={tag}
                                onRemove={() => updateStep(section.id, step.id, { inputTags: (step.inputTags ?? []).filter(t => t !== tag) })} />
                            ))}
                            <TagPicker
                              tags={step.inputTags ?? []}
                              onChange={next => updateStep(section.id, step.id, { inputTags: next })} />
                          </div>
                          <EditableCell
                            value={step.auto ? `(AUTO) ${step.input}` : step.input}
                            onChange={v => {
                              const a = v.startsWith('(AUTO)')
                              updateStep(section.id, step.id, { input: a ? v.replace('(AUTO)', '').trim() : v, auto: a })
                            }}
                            placeholder="입력값 / 행동"
                            multiline
                            style={{ fontSize: 13, color: 'var(--text-secondary)' }} />
                        </div>
                      </div>

                      {/* Out */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          flexShrink: 0, color: 'var(--accent)', opacity: 0.85,
                          fontSize: 11, fontWeight: 700, paddingTop: 6, minWidth: 34,
                        }}>
                          <InArrow />Out
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          {/* OUT PUT 분류 태그 (색 구분) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginBottom: (step.outputTags?.length ?? 0) > 0 ? 3 : 0, paddingTop: 4 }}>
                            {(step.outputTags ?? []).map(tag => (
                              <TagChip key={tag} label={tag}
                                onRemove={() => updateStep(section.id, step.id, { outputTags: (step.outputTags ?? []).filter(t => t !== tag) })} />
                            ))}
                            <TagPicker
                              tags={step.outputTags ?? []}
                              onChange={next => updateStep(section.id, step.id, { outputTags: next })} />
                          </div>
                          <EditableCell value={step.output}
                            onChange={v => updateStep(section.id, step.id, { output: v })}
                            placeholder="결과 / 열리는 것"
                            multiline
                            style={{ fontSize: 13, color: 'var(--text-secondary)' }} />
                        </div>
                      </div>
                    </div>

                    {/* Xkit / Lock / Dev 토글 */}
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0, paddingTop: 2 }}>
                      {([
                        ['xkit', COL.xkit] as const,
                        ['key',  COL.key ] as const,
                        ['dev',  COL.dev ] as const,
                      ]).map(([field, col]) => (
                        <TogglePill key={field} value={step[field] as boolean}
                          onChange={v => toggleStepFlag(section.id, step.id, field, v)}
                          col={col} />
                      ))}
                    </div>

                    {/* 삭제 */}
                    <button onClick={() => deleteStep(section.id, step.id)} title="스텝 삭제" style={{
                      background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
                      color: 'rgba(255,80,80,0.4)', fontSize: 18, padding: '0 2px',
                      opacity: isHovered ? 1 : 0.3, transition: 'opacity 0.15s, color 0.1s',
                      lineHeight: 1, alignSelf: 'flex-start', marginTop: 4,
                    }}
                      onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,80,80,0.9)')}
                      onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,80,80,0.4)')}>
                      ×
                    </button>
                  </div>
                )
              })}

              {/* 빈 섹션 */}
              {!isCollapsed && section.steps.length === 0 && (
                <div
                  onDragOver={handleSectionDragOver}
                  onDrop={(e) => handleSectionDrop(e, section.id)}
                  style={{
                    padding: '24px', textAlign: 'center',
                    color: 'var(--text-muted)', fontSize: 12,
                    fontStyle: 'italic', letterSpacing: 0.2,
                    background: draggingStep && draggingStep.secId !== section.id ? 'rgba(255,255,255,0.04)' : undefined,
                    outline: draggingStep && draggingStep.secId !== section.id ? '1px dashed var(--accent)' : undefined,
                    outlineOffset: -6,
                  }}>
                  {draggingStep && draggingStep.secId !== section.id
                    ? '여기로 끌어와서 이 섹션에 추가'
                    : '스텝이 없습니다 — "+ 스텝" 버튼으로 추가하세요'}
                </div>
              )}
            </div>
          )
        })}

        {/* 전체 빈 상태 */}
        {sheet.sections.length === 0 && (
          <div style={{
            padding: '48px 24px', textAlign: 'center',
            borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-card)',
          }}>
            <div style={{ marginBottom: 12, opacity: 0.3, color: 'var(--text-muted)' }}>
              <GridTableIcon width={32} height={32} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
              게임 플로우가 비어 있습니다
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', opacity: 0.7 }}>
              우측 상단 + 버튼으로 섹션을 추가하세요
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Style helpers ──────────────────────────────────────────────────────────
function toolIconBtn(color: string): React.CSSProperties {
  return {
    width: 32, height: 32, padding: 0, flexShrink: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    borderRadius: 8, border: `1px solid ${color}44`,
    background: `${color}15`, color,
    cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
  }
}
