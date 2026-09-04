import { useEffect, useRef, useState } from 'react'
import type {
  StoryNote, CrimeConfig, StoryPrinciple, CharacterCoreSheet, SpaceNote, RelationArc, PlotPart,
  RoomNavEntry, ForeshadowItem, StoryEndingType, ForeshadowStatus,
} from '../types'
import { Spinner, PlusIcon, TrashIcon, RefreshIcon, ChevronUpIcon, ChevronDownIcon } from './ui/Icon'
import {
  STAGE_PART_LABELS, ENDING_TYPES, FORESHADOW_STATUSES,
  createCharacterSheet, createSpaceNote, createRelationArc, createRoomNavEntry, createForeshadowItem,
  syncStoryNoteWithCrime, crimeRoomNames, characterDisplayName, isStoryNoteEmpty,
} from '../lib/storyNote'

// ── 스토리 노트 패널 ──────────────────────────────────────────────────────────
// 소설가의 작업노트를 방탈출 스토리 설계용으로 옮긴 편집 화면.
// 8개 섹션: 나침반 · 제작 원칙 · 인물 코어시트 · 공간 설정 · 관계선 지도 ·
// 전체 줄거리 구조 · 방(회차) 네비게이션 · 복선 트래커

interface StoryNotePanelProps {
  note: StoryNote
  crime?: CrimeConfig
  onChange: (note: StoryNote) => void
  onGenerateDraft?: () => void
  generating?: boolean
  generateError?: string | null
}

const SECTIONS = [
  { key: 'compass', icon: '📍', label: '나침반' },
  { key: 'principles', icon: '✍️', label: '제작 원칙' },
  { key: 'characters', icon: '👤', label: '인물 코어시트' },
  { key: 'spaces', icon: '🏠', label: '공간 설정' },
  { key: 'relations', icon: '💞', label: '관계선 지도' },
  { key: 'plot', icon: '🗺️', label: '줄거리 구조' },
  { key: 'nav', icon: '📅', label: '방 네비게이션' },
  { key: 'foreshadow', icon: '🧵', label: '복선 트래커' },
] as const

// ── 공용 입력 요소 ─────────────────────────────────────────────────────────

function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight + 2}px`
}

const inputBase: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box', fontFamily: 'inherit', fontSize: 12.5, lineHeight: 1.6,
  background: 'rgba(255,255,255,0.03)', color: 'var(--text-primary)',
  border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', outline: 'none',
}

function TextArea({ value, onChange, placeholder, minRows = 2, style }: {
  value: string; onChange: (v: string) => void; placeholder?: string; minRows?: number; style?: React.CSSProperties
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { autoGrow(ref.current) }, [value])
  return (
    <textarea
      ref={ref}
      rows={minRows}
      value={value}
      placeholder={placeholder}
      onChange={e => { onChange(e.target.value); autoGrow(e.target) }}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
      style={{ ...inputBase, resize: 'none', overflow: 'hidden', minHeight: 20 + minRows * 20, ...style }}
    />
  )
}

function TextInput({ value, onChange, placeholder, style }: {
  value: string; onChange: (v: string) => void; placeholder?: string; style?: React.CSSProperties
}) {
  return (
    <input
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
      onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
      style={{ ...inputBase, ...style }}
    />
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)', marginBottom: hint ? 2 : 6 }}>{label}</div>
      {hint && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, lineHeight: 1.5 }}>{hint}</div>}
      {children}
    </div>
  )
}

function Section({ id, icon, title, subtitle, actions, children }: {
  id: string; icon: string; title: string; subtitle?: string; actions?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section id={`storynote-${id}`} style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '18px 20px',
      scrollMarginTop: 90,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>{icon}</span>{title}
          </div>
          {subtitle && <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.55 }}>{subtitle}</div>}
        </div>
        {actions && <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{actions}</div>}
      </div>
      {children}
    </section>
  )
}

function SmallButton({ onClick, children, tone = 'default', title, disabled }: {
  onClick: () => void; children: React.ReactNode; tone?: 'default' | 'accent' | 'danger'; title?: string; disabled?: boolean
}) {
  const color = tone === 'accent' ? 'var(--accent)' : tone === 'danger' ? '#f87171' : 'var(--text-secondary)'
  const border = tone === 'accent' ? 'var(--accent)' : 'var(--border)'
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 10px', borderRadius: 8,
        border: `1px solid ${border}`, background: tone === 'accent' ? 'var(--accent-dim)' : 'transparent',
        color, fontSize: 11.5, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}

function IconButton({ onClick, title, danger, children }: { onClick: () => void; title: string; danger?: boolean; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      style={{
        width: 26, height: 26, borderRadius: 7, border: '1px solid transparent', background: 'transparent',
        color: 'var(--text-muted)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      }}
      onMouseEnter={e => { e.currentTarget.style.color = danger ? '#f87171' : 'var(--text-primary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
      onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'transparent' }}
    >
      {children}
    </button>
  )
}

function Card({ children, accent }: { children: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.018)', border: `1px solid ${accent ? `${accent}55` : 'var(--border)'}`,
      borderRadius: 12, padding: '14px 15px', display: 'flex', flexDirection: 'column', gap: 12,
    }}>
      {children}
    </div>
  )
}

function Badge({ children, color = 'var(--accent)' }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{ fontSize: 10.5, fontWeight: 800, padding: '2px 8px', borderRadius: 999, background: `${color}22`, color, whiteSpace: 'nowrap' }}>
      {children}
    </span>
  )
}

// ── 관계선 미니 그래프 ──────────────────────────────────────────────────────
// 시작 → 중간 → 결말, 세로축 가까움(4) ~ 멀어짐(0). PDF의 격자 페이지를 그대로 옮긴 것.
function RelationGraph({ arc, onChange }: { arc: RelationArc; onChange: (patch: Partial<RelationArc>) => void }) {
  const W = 300, H = 120, padX = 28, padY = 12
  const xs = [padX, W / 2, W - padX]
  const y = (v: number) => padY + (4 - v) * ((H - padY * 2) / 4)
  const values = [arc.closenessStart, arc.closenessMid, arc.closenessEnd]
  const keys: Array<keyof RelationArc> = ['closenessStart', 'closenessMid', 'closenessEnd']
  const labels = ['시작', '중간', '결말']
  const path = values.map((v, i) => `${i === 0 ? 'M' : 'L'} ${xs[i]} ${y(v)}`).join(' ')
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'stretch', flexWrap: 'wrap' }}>
      <svg viewBox={`0 0 ${W} ${H + 18}`} width={W} style={{ maxWidth: '100%', height: 'auto', flexShrink: 0 }}>
        {[0, 1, 2, 3, 4].map(v => (
          <line key={v} x1={padX} x2={W - padX} y1={y(v)} y2={y(v)} stroke="var(--border)" strokeWidth={1} strokeDasharray={v === 0 || v === 4 ? undefined : '3 3'} />
        ))}
        {xs.map((x, i) => (
          <g key={i}>
            <line x1={x} x2={x} y1={padY} y2={H - padY} stroke="var(--border)" strokeWidth={1} strokeDasharray="3 3" />
            <text x={x} y={H + 12} textAnchor="middle" fontSize={10} fill="var(--text-muted)">{labels[i]}</text>
          </g>
        ))}
        <text x={padX - 4} y={y(4) + 3} textAnchor="end" fontSize={9} fill="var(--text-muted)">가까움</text>
        <text x={padX - 4} y={y(0) + 3} textAnchor="end" fontSize={9} fill="var(--text-muted)">멀어짐</text>
        <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        {values.map((v, i) => (
          <circle key={i} cx={xs[i]} cy={y(v)} r={5} fill="var(--accent)" stroke="var(--bg-card)" strokeWidth={2} />
        ))}
      </svg>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, justifyContent: 'center', minWidth: 150 }}>
        {keys.map((k, i) => (
          <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', width: 28 }}>{labels[i]}</span>
            <input
              type="range" min={0} max={4} step={1} value={values[i]}
              onChange={e => onChange({ [k]: Number(e.target.value) } as Partial<RelationArc>)}
              style={{ flex: 1, accentColor: 'var(--accent)' }}
            />
            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)', width: 14, textAlign: 'right' }}>{values[i]}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── 메인 패널 ────────────────────────────────────────────────────────────────

export function StoryNotePanel({ note, crime, onChange, onGenerateDraft, generating, generateError }: StoryNotePanelProps) {
  const [activeSection, setActiveSection] = useState<string>('compass')

  function commit(patch: Partial<StoryNote>) {
    onChange({ ...note, ...patch, updatedAt: new Date().toISOString() })
  }
  function updateList<K extends 'principles' | 'characterSheets' | 'spaceNotes' | 'relationArcs' | 'roomNav' | 'foreshadows'>(
    key: K, id: string, patch: Partial<StoryNote[K][number]>,
  ) {
    const list = (note[key] as Array<{ id: string }>).map(item => item.id === id ? { ...item, ...patch } : item)
    commit({ [key]: list } as Partial<StoryNote>)
  }
  function removeFromList(key: 'principles' | 'characterSheets' | 'spaceNotes' | 'relationArcs' | 'roomNav' | 'foreshadows', id: string) {
    const list = (note[key] as Array<{ id: string }>).filter(item => item.id !== id)
    commit({ [key]: list } as Partial<StoryNote>)
  }
  function moveInList(key: 'roomNav' | 'foreshadows', id: string, dir: -1 | 1) {
    const list = [...(note[key] as Array<{ id: string }>)]
    const idx = list.findIndex(i => i.id === id)
    const to = idx + dir
    if (idx < 0 || to < 0 || to >= list.length) return
    const [item] = list.splice(idx, 1)
    list.splice(to, 0, item)
    commit({ [key]: list } as Partial<StoryNote>)
  }

  function syncFromCrime() {
    const next = syncStoryNoteWithCrime(note, crime)
    if (next !== note) onChange(next)
  }

  function scrollTo(key: string) {
    setActiveSection(key)
    document.getElementById(`storynote-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const characterNames = (crime?.characters ?? []).map(c => characterDisplayName(crime, c.id))
  const roomNames = crimeRoomNames(crime)
  const hasCrime = Boolean(crime && ((crime.characters?.length ?? 0) > 0 || roomNames.length > 0 || (crime.relations?.length ?? 0) > 0))
  const empty = isStoryNoteEmpty(note)

  const foreshadowCounts = FORESHADOW_STATUSES.reduce<Record<ForeshadowStatus, number>>((acc, s) => {
    acc[s] = note.foreshadows.filter(f => f.status === s && f.content.trim()).length
    return acc
  }, { '설치': 0, '회수': 0, '미회수': 0, '폐기': 0 })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {/* 헤더 */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 240, flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>스토리 노트</div>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4, lineHeight: 1.6 }}>
              장편 쓰다 산으로 가지 않으려고 만든 소설 작업노트를 방탈출용으로 옮겼습니다.
              막힐 때 3초 안에 방향을 다시 잡는 나침반부터, 설치한 복선을 회수했는지 확인하는 트래커까지.
              여기 적은 내용은 에이전트 협업·초안(비트 시트)·게임 플로우 생성에 그대로 반영됩니다.
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {note.generatedAt && <span>AI 초안 {new Date(note.generatedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
              <span>마지막 수정 {new Date(note.updatedAt).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
              <span>자동 저장</span>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {hasCrime && (
              <SmallButton onClick={syncFromCrime} title="수사 백과사전의 인물·공간·관계 중 노트에 없는 것만 빈 시트로 추가합니다">
                <RefreshIcon width={12} height={12} /> 백과사전 동기화
              </SmallButton>
            )}
            {onGenerateDraft && (
              <SmallButton onClick={onGenerateDraft} tone="accent" disabled={generating} title="테마·수사 백과사전을 바탕으로 빈 칸을 AI가 채웁니다. 직접 쓴 내용은 유지됩니다.">
                {generating ? <Spinner size={11} color="var(--accent)" /> : '✨'} {generating ? '초안 작성 중…' : (empty ? 'AI 초안 채우기' : 'AI로 빈 칸 채우기')}
              </SmallButton>
            )}
          </div>
        </div>
        {generateError && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#fca5a5', background: '#3b1d1d', border: '1px solid rgba(248,113,113,0.35)', borderRadius: 8, padding: '8px 10px' }}>
            {generateError}
          </div>
        )}
        {/* 섹션 네비 */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
          {SECTIONS.map(s => {
            const active = activeSection === s.key
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => scrollTo(s.key)}
                style={{
                  padding: '5px 11px', borderRadius: 999, fontSize: 11.5, fontWeight: active ? 700 : 500,
                  border: active ? '1px solid var(--accent)' : '1px solid var(--border)',
                  background: active ? 'var(--accent-dim)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                }}
              >
                <span>{s.icon}</span>{s.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* 1. 나침반 */}
      <Section id="compass" icon="📍" title="스토리 나침반" subtitle="로그라인 · 핵심 갈등 · 차별점. 막힐 때 3초 안에 방향을 다시 잡는 페이지.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--border-bright)', borderRadius: 12, padding: '12px 14px' }}>
            <Field label="로그라인" hint="이 한 줄만 보고도 테마 전체가 떠올라야 한다">
              <TextArea value={note.compass.logline} onChange={v => commit({ compass: { ...note.compass, logline: v } })} placeholder="예: 폐쇄된 정신병원에서 실종된 간호사의 마지막 근무 기록을 따라가던 팀은, 그녀가 숨긴 것이 환자가 아니라 자신이었음을 알게 된다." minRows={2} style={{ fontSize: 13.5, fontWeight: 600 }} />
            </Field>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            <Card>
              <Field label="핵심 갈등" hint="인물이 진짜 싸우고 있는 것 — 예: 원수를 사랑하게 된 나 자신을 용서할 수 있는가">
                <TextArea value={note.compass.coreConflict} onChange={v => commit({ compass: { ...note.compass, coreConflict: v } })} minRows={4} />
              </Field>
            </Card>
            <Card>
              <Field label="차별점" hint="다른 방탈출 테마와 다른 단 하나의 지점">
                <TextArea value={note.compass.differentiator} onChange={v => commit({ compass: { ...note.compass, differentiator: v } })} minRows={4} />
              </Field>
            </Card>
            <Card>
              <Field label="장르 · 톤" hint="장르, 분위기, 플레이 후 남아야 할 뒷맛">
                <TextArea value={note.compass.genreTone} onChange={v => commit({ compass: { ...note.compass, genreTone: v } })} minRows={4} placeholder={crime?.genres?.length ? `백과사전 장르: ${crime.genres.join(', ')}` : undefined} />
              </Field>
            </Card>
          </div>
          <Field label="그래도 감이 안 잡히면" hint="오늘 문득 떠오른 대사 한 줄 · 장면 이미지 · 지금 이 인물이 느낄 것 같은 감정 · 안 풀리는 지점 — 형식 없이 아무거나 적어도 됨">
            <TextArea value={note.compass.freeNotes} onChange={v => commit({ compass: { ...note.compass, freeNotes: v } })} minRows={4} />
          </Field>
        </div>
      </Section>

      {/* 2. 제작 원칙 */}
      <Section
        id="principles" icon="✍️" title="제작 원칙"
        subtitle="전작들 만들면서 후회했던 것 — 막힐 때 말고, 매 방 설계 전에 한 번씩. 각 원칙 아래에 이 프로젝트에서의 적용 메모를 적습니다."
        actions={<SmallButton onClick={() => commit({ principles: [...note.principles, { id: crypto.randomUUID(), title: '새 원칙', description: '', checkQuestion: '', note: '' }] })}><PlusIcon width={11} height={11} /> 원칙 추가</SmallButton>}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {note.principles.map((p: StoryPrinciple, idx) => (
            <Card key={p.id}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <Badge>{idx + 1}</Badge>
                    <input
                      value={p.title}
                      onChange={e => updateList('principles', p.id, { title: e.target.value })}
                      style={{ ...inputBase, background: 'transparent', border: '1px solid transparent', padding: '2px 6px', fontSize: 13.5, fontWeight: 800 }}
                      onFocus={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
                      onBlur={e => { e.currentTarget.style.borderColor = 'transparent' }}
                    />
                  </div>
                  <TextArea value={p.description} onChange={v => updateList('principles', p.id, { description: v })} placeholder="원칙 설명" minRows={2} style={{ background: 'transparent', border: '1px solid transparent', color: 'var(--text-secondary)', padding: '2px 6px' }} />
                </div>
                <IconButton onClick={() => removeFromList('principles', p.id)} title="원칙 삭제" danger><TrashIcon width={12} height={12} /></IconButton>
              </div>
              <Field label="이 프로젝트에서는">
                <TextArea value={p.note} onChange={v => updateList('principles', p.id, { note: v })} placeholder="예: 클라이맥스는 3번 방 '수술실' 암전 순간. 1·2번 방은 그 장면을 위해 존재한다." minRows={2} />
              </Field>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12, color: 'var(--accent)', background: 'var(--accent-dim)', borderRadius: 8, padding: '8px 10px' }}>
                <span style={{ flexShrink: 0 }}>☑</span>
                <input
                  value={p.checkQuestion}
                  onChange={e => updateList('principles', p.id, { checkQuestion: e.target.value })}
                  placeholder="스스로 던지는 확인 질문"
                  style={{ ...inputBase, background: 'transparent', border: 'none', padding: 0, color: 'var(--accent)', fontStyle: 'italic', fontSize: 12 }}
                />
              </div>
            </Card>
          ))}
        </div>
      </Section>

      {/* 3. 인물 코어시트 */}
      <Section
        id="characters" icon="👤" title="인물 코어시트"
        subtitle={'성격 말고 "이 상황이면 이렇게 행동한다"까지 적어서 캐릭터가 안 흔들리게. 플레이어가 만나는 메모·음성·단서의 톤이 여기서 나옵니다.'}
        actions={<>
          {characterNames.length > 0 && <SmallButton onClick={syncFromCrime} title="백과사전 등장인물 중 시트가 없는 인물을 추가"><RefreshIcon width={11} height={11} /> 등장인물 불러오기</SmallButton>}
          <SmallButton onClick={() => commit({ characterSheets: [...note.characterSheets, createCharacterSheet()] })}><PlusIcon width={11} height={11} /> 인물 추가</SmallButton>
        </>}
      >
        {note.characterSheets.length === 0 ? (
          <EmptyHint text={characterNames.length ? '아직 코어시트가 없습니다. "등장인물 불러오기"로 수사 백과사전의 인물을 가져오세요.' : '아직 코어시트가 없습니다. 인물을 추가하거나 수사 백과사전에 등장인물을 먼저 입력하세요.'} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
            {note.characterSheets.map((s: CharacterCoreSheet) => {
              const linked = s.characterId ? crime?.characters?.find(c => c.id === s.characterId) : undefined
              return (
                <Card key={s.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <TextInput value={s.name} onChange={v => updateList('characterSheets', s.id, { name: v })} placeholder="이름" style={{ fontWeight: 800, fontSize: 13.5, flex: 1 }} />
                    {linked && <Badge>{linked.role}</Badge>}
                    <IconButton onClick={() => removeFromList('characterSheets', s.id)} title="시트 삭제" danger><TrashIcon width={12} height={12} /></IconButton>
                  </div>
                  <TextInput value={s.identity} onChange={v => updateList('characterSheets', s.id, { identity: v })} placeholder="한 줄 정체성 — 예: 환자를 살리려다 자신을 잃은 야간 간호사" />
                  {linked?.background && <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5, marginTop: -4 }}>백과사전: {linked.background}</div>}
                  <Field label="결핍 — 이 인물이 진짜로 원하는 것" hint="겉으로 원한다고 말하는 것 말고, 근본적으로 채워지지 않은 것">
                    <TextArea value={s.lack} onChange={v => updateList('characterSheets', s.id, { lack: v })} minRows={2} />
                  </Field>
                  <Field label="거짓말 — 자신 또는 세상에게 하고 있는 거짓말" hint="스스로 믿고 있지만 사실이 아닌 것. 용의자라면 알리바이·은폐도 여기에">
                    <TextArea value={s.lie} onChange={v => updateList('characterSheets', s.id, { lie: v })} minRows={2} />
                  </Field>
                  <Field label="절대 하지 않을 행동" hint="아무리 몰려도 이 인물이라면 하지 않을 선택">
                    <TextArea value={s.neverDoes} onChange={v => updateList('characterSheets', s.id, { neverDoes: v })} minRows={2} />
                  </Field>
                  <Field label="말투 · 습관의 특징" hint="이 인물만의 말버릇, 몸짓, 반복되는 표현 — 음성 녹음·메모·일기 단서의 톤">
                    <TextArea value={s.mannerisms} onChange={v => updateList('characterSheets', s.id, { mannerisms: v })} minRows={2} />
                  </Field>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-primary)' }}>상황 → 행동 시뮬레이션</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>이럴 때, 이 인물이라면 어떻게 반응하는가 (2~3개만)</div>
                      </div>
                      <SmallButton onClick={() => updateList('characterSheets', s.id, { simulations: [...s.simulations, { id: crypto.randomUUID(), situation: '', reaction: '' }] })}><PlusIcon width={10} height={10} /></SmallButton>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {s.simulations.map(sim => (
                        <div key={sim.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr auto', gap: 6, alignItems: 'center' }}>
                          <TextInput value={sim.situation} onChange={v => updateList('characterSheets', s.id, { simulations: s.simulations.map(x => x.id === sim.id ? { ...x, situation: v } : x) })} placeholder="상황" />
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>→</span>
                          <TextInput value={sim.reaction} onChange={v => updateList('characterSheets', s.id, { simulations: s.simulations.map(x => x.id === sim.id ? { ...x, reaction: v } : x) })} placeholder="행동" />
                          <IconButton onClick={() => updateList('characterSheets', s.id, { simulations: s.simulations.filter(x => x.id !== sim.id) })} title="삭제" danger><TrashIcon width={11} height={11} /></IconButton>
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </Section>

      {/* 4. 공간 설정 노트 */}
      <Section
        id="spaces" icon="🏠" title="공간 설정 노트"
        subtitle="자주 나오는 공간의 기능 · 이중성까지 미리 정리. 방탈출에서는 방 하나하나가 곧 장면이라, 겉보기와 실제의 차이가 퍼즐과 연출이 됩니다."
        actions={<>
          {roomNames.length > 0 && <SmallButton onClick={syncFromCrime} title="게임 플레이 스토리 흐름의 공간명 중 노트가 없는 공간을 추가"><RefreshIcon width={11} height={11} /> 공간 불러오기</SmallButton>}
          <SmallButton onClick={() => commit({ spaceNotes: [...note.spaceNotes, createSpaceNote()] })}><PlusIcon width={11} height={11} /> 공간 추가</SmallButton>
        </>}
      >
        {note.spaceNotes.length === 0 ? (
          <EmptyHint text={roomNames.length ? '아직 공간 노트가 없습니다. "공간 불러오기"로 스토리 흐름의 공간을 가져오세요.' : '아직 공간 노트가 없습니다. 공간을 추가하거나 수사 백과사전의 스토리 흐름에 공간명을 먼저 입력하세요.'} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
            {note.spaceNotes.map((sp: SpaceNote) => (
              <Card key={sp.id}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 14 }}>📍</span>
                  <TextInput value={sp.roomName} onChange={v => updateList('spaceNotes', sp.id, { roomName: v })} placeholder="공간 이름" style={{ fontWeight: 800, fontSize: 13.5, flex: 1 }} />
                  <IconButton onClick={() => removeFromList('spaceNotes', sp.id)} title="공간 삭제" danger><TrashIcon width={12} height={12} /></IconButton>
                </div>
                <Field label="이 공간의 기능 — 왜 이 공간이 필요한가" hint="플롯상 이 공간이 없으면 무너지는 것">
                  <TextArea value={sp.purpose} onChange={v => updateList('spaceNotes', sp.id, { purpose: v })} minRows={2} />
                </Field>
                <Field label="공간의 이중성 · 대비" hint="겉보기와 실제, 또는 조명이 켜졌을 때와 꺼졌을 때의 차이 — 숨겨진 문, UV로만 보이는 글씨">
                  <TextArea value={sp.duality} onChange={v => updateList('spaceNotes', sp.id, { duality: v })} minRows={2} />
                </Field>
                <Field label="감각적 디테일" hint="보이는 것 · 들리는 것 · 냄새 · 온도 — 연출·음향·소품에 실제로 쓸 수 있는 구체적 묘사">
                  <TextArea value={sp.sensoryDetail} onChange={v => updateList('spaceNotes', sp.id, { sensoryDetail: v })} minRows={2} />
                </Field>
                <Field label="이 공간에서 벌어지는 핵심 사건 · 퍼즐" hint="이 공간이 아니면 일어날 수 없는 사건들">
                  <TextArea value={sp.keyEvents} onChange={v => updateList('spaceNotes', sp.id, { keyEvents: v })} minRows={2} />
                </Field>
              </Card>
            ))}
          </div>
        )}
      </Section>

      {/* 5. 관계선 지도 */}
      <Section
        id="relations" icon="💞" title="관계선 지도"
        subtitle="인물 A ↔ 인물 B, 이 관계가 시작에서 결말까지 어떻게 휘어지는지. 플레이어는 대사가 아니라 단서·소품·연출로 이 변화를 읽습니다."
        actions={<>
          {(crime?.relations?.length ?? 0) > 0 && <SmallButton onClick={syncFromCrime} title="백과사전 인물 관계 중 지도가 없는 관계를 추가"><RefreshIcon width={11} height={11} /> 관계 불러오기</SmallButton>}
          <SmallButton onClick={() => commit({ relationArcs: [...note.relationArcs, createRelationArc()] })}><PlusIcon width={11} height={11} /> 관계 추가</SmallButton>
        </>}
      >
        {note.relationArcs.length === 0 ? (
          <EmptyHint text="아직 관계선이 없습니다. 관계를 추가하거나 수사 백과사전의 인물 관계를 불러오세요." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {note.relationArcs.map((arc: RelationArc) => {
              const linked = arc.relationId ? crime?.relations?.find(r => r.id === arc.relationId) : undefined
              return (
                <Card key={arc.id}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <NameInput value={arc.fromName} onChange={v => updateList('relationArcs', arc.id, { fromName: v })} options={characterNames} placeholder="인물 A" />
                    <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>↔</span>
                    <NameInput value={arc.toName} onChange={v => updateList('relationArcs', arc.id, { toName: v })} options={characterNames} placeholder="인물 B" />
                    {linked && <Badge color="#9b59b6">{linked.relationType}</Badge>}
                    <div style={{ flex: 1 }} />
                    <IconButton onClick={() => removeFromList('relationArcs', arc.id)} title="관계 삭제" danger><TrashIcon width={12} height={12} /></IconButton>
                  </div>
                  {linked?.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: -4 }}>백과사전: {linked.description}</div>}
                  <RelationGraph arc={arc} onChange={patch => updateList('relationArcs', arc.id, patch)} />
                  <Field label="이 변화, 어떤 장면(연출)으로 보여줄 것인가" hint="설명하는 대사 말고, 행동 · 표정 · 공간 · 거리로 — 방탈출에서는 사진의 위치, 지워진 이름, 잠긴 서랍 같은 물성으로">
                    <TextArea value={arc.howShown} onChange={v => updateList('relationArcs', arc.id, { howShown: v })} minRows={2} />
                  </Field>
                </Card>
              )
            })}
          </div>
        )}
      </Section>

      {/* 6. 전체 줄거리 구조 */}
      <Section id="plot" icon="🗺️" title="전체 줄거리 구조" subtitle="전체를 5부로 나눠서 한눈에 조망. 지금 어느 부를 설계하고 있는지 항상 여기서 확인. 기 · 승 · 전 · 반전 · 결이 곧 1~5부입니다.">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {note.plotParts.map((part: PlotPart, idx) => {
            const flow = crime?.storyFlow?.find(s => s.stage === part.stage)
            return (
              <div key={part.stage} style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 190px) 1fr', gap: 12, alignItems: 'stretch' }}>
                <div style={{ background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 12, padding: '12px 13px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 800 }}>{idx + 1}부</div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-primary)' }}>{STAGE_PART_LABELS[part.stage].split(' · ')[1]}</div>
                  <TextInput value={part.title} onChange={v => commit({ plotParts: note.plotParts.map(p => p.stage === part.stage ? { ...p, title: v } : p) })} placeholder="부 제목" style={{ fontSize: 12 }} />
                  {flow?.roomName && <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>📍 {flow.roomName}</div>}
                  {flow?.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', lineHeight: 1.5 }}>{flow.description}</div>}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                  {([['goal', '목표'], ['turningPoint', '전환점'], ['climax', '클라이맥스']] as const).map(([key, label]) => (
                    <Card key={key}>
                      <Field label={label}>
                        <TextArea value={part[key]} onChange={v => commit({ plotParts: note.plotParts.map(p => p.stage === part.stage ? { ...p, [key]: v } : p) })} minRows={3} />
                      </Field>
                    </Card>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </Section>

      {/* 7. 방(회차) 네비게이션 */}
      <Section
        id="nav" icon="📅" title="방(회차) 네비게이션"
        subtitle="몇 개의 퍼즐을 넣었는지 말고, 이 방이 왜 존재하는지 / 다음 방 훅이 뭔지. 엔딩 유형은 방마다 하나씩 골라 동그라미 — 감=감정적 감동 · 정=정보의 폭발 · 위=위기 발생 · 대=대치. 셀프체크는 강약조절 / 캐릭터 일관성 / 서사 개연성, 이 세 개만."
        actions={<>
          {roomNames.length > 0 && note.roomNav.length === 0 && <SmallButton onClick={syncFromCrime}><RefreshIcon width={11} height={11} /> 공간 순서로 만들기</SmallButton>}
          <SmallButton onClick={() => commit({ roomNav: [...note.roomNav, createRoomNavEntry()] })}><PlusIcon width={11} height={11} /> 구간 추가</SmallButton>
        </>}
      >
        {note.roomNav.length === 0 ? (
          <EmptyHint text="아직 구간이 없습니다. 방 하나가 한 회차입니다. 구간을 추가하거나 스토리 흐름의 공간 순서로 만들어 보세요." />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {note.roomNav.map((r: RoomNavEntry, idx) => {
              const checks = [r.checkPacing, r.checkCharacter, r.checkPlausibility].filter(Boolean).length
              return (
                <Card key={r.id} accent={checks === 3 ? 'var(--success)' : undefined}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Badge>{idx + 1}</Badge>
                    <TextInput value={r.label} onChange={v => updateList('roomNav', r.id, { label: v })} placeholder="방 · 구간 이름" style={{ fontWeight: 800, fontSize: 13.5, flex: 1, minWidth: 140 }} />
                    <div style={{ display: 'flex', gap: 4 }} title="엔딩 유형 (하나만)">
                      {ENDING_TYPES.map(e => {
                        const on = r.endingType === e.key
                        return (
                          <button
                            key={e.key} type="button" title={e.desc}
                            onClick={() => updateList('roomNav', r.id, { endingType: on ? undefined : (e.key as StoryEndingType) })}
                            style={{
                              width: 26, height: 26, borderRadius: '50%', fontSize: 11.5, fontWeight: 800, cursor: 'pointer',
                              border: `1.5px solid ${on ? 'var(--accent)' : 'var(--border)'}`,
                              background: on ? 'var(--accent)' : 'transparent', color: on ? 'var(--accent-fg)' : 'var(--text-muted)',
                            }}
                          >{e.label}</button>
                        )
                      })}
                    </div>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 4 }} title="셀프체크: 강약조절 / 캐릭터 일관성 / 서사 개연성">
                      <span style={{ fontSize: 10.5, color: 'var(--text-muted)' }}>셀프체크</span>
                      {([['checkPacing', '강'], ['checkCharacter', '인'], ['checkPlausibility', '서']] as const).map(([key, label]) => (
                        <label key={key} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11, color: r[key] ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer', fontWeight: 700 }}>
                          <input type="checkbox" checked={r[key]} onChange={e => updateList('roomNav', r.id, { [key]: e.target.checked })} style={{ accentColor: 'var(--success)' }} />
                          {label}
                        </label>
                      ))}
                    </div>
                    <div style={{ display: 'flex' }}>
                      <IconButton onClick={() => moveInList('roomNav', r.id, -1)} title="위로"><ChevronUpIcon width={12} height={12} /></IconButton>
                      <IconButton onClick={() => moveInList('roomNav', r.id, 1)} title="아래로"><ChevronDownIcon width={12} height={12} /></IconButton>
                      <IconButton onClick={() => removeFromList('roomNav', r.id)} title="구간 삭제" danger><TrashIcon width={12} height={12} /></IconButton>
                    </div>
                  </div>
                  <Field label="사건" hint="이 방에서 벌어지는 일 — 이 방이 왜 존재하는가">
                    <TextArea value={r.event} onChange={v => updateList('roomNav', r.id, { event: v })} minRows={2} />
                  </Field>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                    <Field label="이번 방 감정">
                      <TextArea value={r.emotion} onChange={v => updateList('roomNav', r.id, { emotion: v })} minRows={1} />
                    </Field>
                    <Field label="플레이어가 느낄 것">
                      <TextArea value={r.playerFeels} onChange={v => updateList('roomNav', r.id, { playerFeels: v })} minRows={1} />
                    </Field>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
                    <Field label="다음 방 훅" hint="이 방을 나서게 만드는 힘">
                      <TextArea value={r.nextHook} onChange={v => updateList('roomNav', r.id, { nextHook: v })} minRows={1} />
                    </Field>
                    <Field label="다음 방 예고" hint="플레이어에게 살짝 보여줄 것">
                      <TextArea value={r.nextTeaser} onChange={v => updateList('roomNav', r.id, { nextTeaser: v })} minRows={1} />
                    </Field>
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </Section>

      {/* 8. 복선 트래커 */}
      <Section
        id="foreshadow" icon="🧵" title="복선 · 떡밥 트래커"
        subtitle="설치해둔 떡밥이 회수됐는지, 여기서만 확인하면 되게. 설치 위치와 회수 위치는 방 이름이나 스텝 번호로."
        actions={<SmallButton onClick={() => commit({ foreshadows: [...note.foreshadows, createForeshadowItem()] })}><PlusIcon width={11} height={11} /> 떡밥 추가</SmallButton>}
      >
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          {FORESHADOW_STATUSES.map(s => (
            <Badge key={s} color={statusColor(s)}>{s} {foreshadowCounts[s]}</Badge>
          ))}
          {foreshadowCounts['미회수'] > 0 && <span style={{ fontSize: 11, color: 'var(--warning)', fontWeight: 700 }}>⚠ 회수되지 않은 복선이 있습니다</span>}
        </div>
        {note.foreshadows.length === 0 ? (
          <EmptyHint text="아직 등록된 복선이 없습니다. 1번 방에 심은 것이 마지막 방에서 터지도록, 설치와 회수를 짝지어 관리하세요." />
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, minWidth: 720 }}>
              <thead>
                <tr>
                  {['떡밥 내용', '설치 위치', '회수 위치', '상태', '메모', ''].map((h, i) => (
                    <th key={i} style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', padding: '6px 8px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {note.foreshadows.map((f: ForeshadowItem) => (
                  <tr key={f.id}>
                    <td style={{ padding: '6px 6px 6px 0', verticalAlign: 'top', minWidth: 220 }}><TextArea value={f.content} onChange={v => updateList('foreshadows', f.id, { content: v })} minRows={1} /></td>
                    <td style={{ padding: 6, verticalAlign: 'top', width: 130 }}><NameInput value={f.plantedAt} onChange={v => updateList('foreshadows', f.id, { plantedAt: v })} options={roomNames} placeholder="방/스텝" /></td>
                    <td style={{ padding: 6, verticalAlign: 'top', width: 130 }}><NameInput value={f.payoffAt} onChange={v => updateList('foreshadows', f.id, { payoffAt: v })} options={roomNames} placeholder="방/스텝" /></td>
                    <td style={{ padding: 6, verticalAlign: 'top', width: 92 }}>
                      <select
                        value={f.status}
                        onChange={e => updateList('foreshadows', f.id, { status: e.target.value as ForeshadowStatus })}
                        style={{ ...inputBase, padding: '7px 6px', color: statusColor(f.status), fontWeight: 700, cursor: 'pointer' }}
                      >
                        {FORESHADOW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: 6, verticalAlign: 'top', minWidth: 160 }}><TextArea value={f.memo} onChange={v => updateList('foreshadows', f.id, { memo: v })} minRows={1} /></td>
                    <td style={{ padding: '6px 0', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                      <IconButton onClick={() => moveInList('foreshadows', f.id, -1)} title="위로"><ChevronUpIcon width={11} height={11} /></IconButton>
                      <IconButton onClick={() => moveInList('foreshadows', f.id, 1)} title="아래로"><ChevronDownIcon width={11} height={11} /></IconButton>
                      <IconButton onClick={() => removeFromList('foreshadows', f.id)} title="삭제" danger><TrashIcon width={11} height={11} /></IconButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>
    </div>
  )
}

function statusColor(s: ForeshadowStatus): string {
  return s === '회수' ? 'var(--success)' : s === '미회수' ? 'var(--warning)' : s === '폐기' ? '#7f8c8d' : 'var(--accent)'
}

function EmptyHint({ text }: { text: string }) {
  return (
    <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '14px 12px', border: '1px dashed var(--border)', borderRadius: 10, lineHeight: 1.6 }}>
      {text}
    </div>
  )
}

// 자유 입력 + 백과사전 이름 datalist 제안
let datalistSeq = 0
function NameInput({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  const idRef = useRef<string>('')
  if (!idRef.current) idRef.current = `storynote-dl-${++datalistSeq}`
  return (
    <>
      <input
        value={value}
        list={options.length ? idRef.current : undefined}
        placeholder={placeholder}
        onChange={e => onChange(e.target.value)}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)' }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
        style={{ ...inputBase, width: 'auto', minWidth: 110, maxWidth: '100%', padding: '6px 9px' }}
      />
      {options.length > 0 && (
        <datalist id={idRef.current}>
          {options.map(o => <option key={o} value={o} />)}
        </datalist>
      )}
    </>
  )
}
