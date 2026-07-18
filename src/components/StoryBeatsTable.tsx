import { Fragment } from 'react'
import type { StoryBeatsSheet, StoryBeat } from '../types'
import { PlusIcon } from './ui/Icon'
import { PALETTES } from './gameflow/editing'
import { EditableCell } from './gameflow/primitives'

// ── Main ───────────────────────────────────────────────────────────────────
interface StoryBeatsTableProps {
  sheet: StoryBeatsSheet
  onChange: (sheet: StoryBeatsSheet) => void
}

// 연속으로 같은 room을 가진 비트들을 묶는다 (공간 셀 병합 표시용)
function groupByRoom(beats: StoryBeat[]): { room: string; roomTag?: string; start: number; size: number }[] {
  const groups: { room: string; roomTag?: string; start: number; size: number }[] = []
  beats.forEach((b, i) => {
    const last = groups[groups.length - 1]
    if (last && last.room === b.room) {
      last.size += 1
      if (!last.roomTag && b.roomTag) last.roomTag = b.roomTag
    } else {
      groups.push({ room: b.room, roomTag: b.roomTag, start: i, size: 1 })
    }
  })
  return groups
}

export function StoryBeatsTable({ sheet, onChange }: StoryBeatsTableProps) {
  function commit(beats: StoryBeat[]) {
    onChange({ ...sheet, beats, updatedAt: new Date().toISOString() })
  }
  function updateBeat(id: string, patch: Partial<StoryBeat>) {
    commit(sheet.beats.map(b => b.id === id ? { ...b, ...patch } : b))
  }
  function insertAfter(index: number) {
    const prev = sheet.beats[index]
    const newBeat: StoryBeat = {
      id: crypto.randomUUID(),
      room: prev?.room ?? '새 공간',
      roomTag: prev?.roomTag ?? '',
      beat: '새 비트',
      beatSub: '',
      content: '',
    }
    const beats = [...sheet.beats]
    beats.splice(index + 1, 0, newBeat)
    commit(beats)
  }
  function deleteBeat(id: string) {
    commit(sheet.beats.filter(b => b.id !== id))
  }
  function addBeat() {
    insertAfter(sheet.beats.length - 1)
  }

  const groups = groupByRoom(sheet.beats)
  // 각 비트 인덱스 → 그룹 인덱스 매핑 (색상용)
  const groupIndexOf: number[] = []
  groups.forEach((g, gi) => { for (let k = 0; k < g.size; k += 1) groupIndexOf[g.start + k] = gi })

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
            스토리 비트 시트 <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-muted)' }}>— 게임 플로우 초안</span>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
            시드 필드 3막 구조 · {groups.length}개 공간 · {sheet.beats.length}개 비트
          </div>
        </div>
        <div style={{ flex: 1 }} />
        <button onClick={addBeat} title="비트 추가" style={{
          width: 32, height: 32, padding: 0, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 8, border: '1px solid var(--accent)44',
          background: 'var(--accent)15', color: 'var(--accent)',
          cursor: 'pointer', transition: 'background 0.15s, border-color 0.15s',
        }}>
          <PlusIcon width={15} height={15} />
        </button>
      </div>

      {/* ── 비트 테이블 ── */}
      {/* 모바일: 컬럼을 짓누르는 대신 표에 최소 폭을 주고 가로 스크롤로 본다 */}
      <div style={{
        borderRadius: 14, border: '1px solid var(--border)',
        overflowX: 'auto', boxShadow: '0 2px 16px rgba(0,0,0,0.25)',
        background: 'var(--bg-card)',
        WebkitOverflowScrolling: 'touch',
      }}>
        <table style={{ width: '100%', minWidth: 640, borderCollapse: 'collapse', fontSize: 12, tableLayout: 'fixed' }}>
          <thead>
            <tr>
              {[
                { label: '공간', w: 150 },
                { label: '비트', w: 190 },
                { label: '내용' },
                { label: '', w: 36 },
              ].map(({ label, w }, i) => (
                <th key={i} style={{
                  padding: '10px 14px', fontSize: 10, fontWeight: 700,
                  color: 'var(--text-muted)', letterSpacing: '0.06em',
                  textAlign: 'left', whiteSpace: 'nowrap',
                  background: 'rgba(255,255,255,0.025)',
                  borderBottom: '1px solid var(--border)',
                  width: w,
                }}>
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sheet.beats.map((b, i) => {
              const gi = groupIndexOf[i]
              const group = groups[gi]
              const pal = PALETTES[gi % PALETTES.length]
              const isGroupStart = group.start === i
              const isLastRow = i === sheet.beats.length - 1
              const isGroupEnd = i === group.start + group.size - 1
              return (
                <Fragment key={b.id}>
                  <tr className="beat-row">
                    {/* 공간 (연속 동일 공간은 rowSpan 병합) */}
                    {isGroupStart && (
                      <td rowSpan={group.size} style={{
                        verticalAlign: 'middle', textAlign: 'center',
                        padding: '16px 10px',
                        background: pal.dim,
                        borderLeft: `4px solid ${pal.accent}`,
                        borderBottom: isLastRow || isGroupEnd ? '1px solid var(--border)' : undefined,
                      }}>
                        <EditableCell
                          value={b.room}
                          onChange={v => {
                            // 그룹 전체의 room 이름을 함께 변경 (병합 유지)
                            const ids = sheet.beats.slice(group.start, group.start + group.size).map(x => x.id)
                            commit(sheet.beats.map(x => ids.includes(x.id) ? { ...x, room: v } : x))
                          }}
                          placeholder="공간 이름"
                          multiline
                          style={{ fontWeight: 800, color: pal.accent, fontSize: 13, textAlign: 'center', lineHeight: 1.4 }}
                        />
                        <div style={{ marginTop: 8, display: 'flex', justifyContent: 'center' }}>
                          <EditableCell
                            value={b.roomTag ?? ''}
                            onChange={v => updateBeat(b.id, { roomTag: v })}
                            placeholder="막 라벨"
                            style={{
                              fontSize: 10, fontWeight: 700, color: pal.accent,
                              background: `${pal.accent}22`, border: `1px solid ${pal.line}`,
                              borderRadius: 6, padding: '3px 8px', minHeight: 0,
                              textAlign: 'center', whiteSpace: 'nowrap',
                            }}
                          />
                        </div>
                      </td>
                    )}

                    {/* 비트 제목 + 부제 */}
                    <td style={{
                      verticalAlign: 'middle', padding: '14px 10px',
                      borderBottom: isLastRow ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <EditableCell
                        value={b.beat}
                        onChange={v => updateBeat(b.id, { beat: v })}
                        placeholder="비트 제목"
                        style={{ fontWeight: 700, fontSize: 13.5, color: 'var(--text-primary)' }}
                      />
                      <EditableCell
                        value={b.beatSub ?? ''}
                        onChange={v => updateBeat(b.id, { beatSub: v })}
                        placeholder="부제 / 핵심 소재"
                        style={{ fontSize: 11, color: 'var(--text-muted)', paddingTop: 2 }}
                      />
                    </td>

                    {/* 내용 */}
                    <td style={{
                      verticalAlign: 'middle', padding: '14px 12px',
                      borderBottom: isLastRow ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <EditableCell
                        value={b.content}
                        onChange={v => updateBeat(b.id, { content: v })}
                        placeholder="이 비트에서 플레이어가 겪는 사건 · 발견 · 감정"
                        multiline
                        style={{ fontSize: 12.5, lineHeight: 1.7, color: 'var(--text-secondary)' }}
                      />
                    </td>

                    {/* 행 액션: 아래 삽입 / 삭제 */}
                    <td className="beat-actions" style={{
                      verticalAlign: 'middle', textAlign: 'center', padding: '4px 4px',
                      borderBottom: isLastRow ? 'none' : '1px solid rgba(255,255,255,0.05)',
                    }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
                        <button onClick={() => insertAfter(i)} title="아래에 비트 추가" style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'var(--accent)', fontSize: 14, padding: '0 4px', lineHeight: 1,
                          opacity: 0.5,
                        }}
                          onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>
                          +
                        </button>
                        <button onClick={() => deleteBeat(b.id)} title="비트 삭제" style={{
                          background: 'none', border: 'none', cursor: 'pointer',
                          color: 'rgba(255,80,80,0.5)', fontSize: 15, padding: '0 4px', lineHeight: 1,
                        }}
                          onMouseEnter={e => (e.currentTarget.style.color = 'rgba(255,80,80,0.9)')}
                          onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255,80,80,0.5)')}>
                          ×
                        </button>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              )
            })}

            {/* 빈 상태 */}
            {sheet.beats.length === 0 && (
              <tr>
                <td colSpan={4} style={{ padding: '48px 24px', textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-muted)', marginBottom: 6 }}>
                    비트가 없습니다
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', opacity: 0.7 }}>
                    우측 상단 + 버튼으로 비트를 추가하거나, 보고서 반영하기로 초안을 생성하세요
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
