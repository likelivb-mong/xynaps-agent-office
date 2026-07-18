import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// 편집 textarea 높이를 내용 전체가 보이도록 자동 조절
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight + 2}px`
}

// ── EditableCell ───────────────────────────────────────────────────────────
export function EditableCell({
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
        ref={autoGrow}
        onChange={e => { setDraft(e.target.value); autoGrow(e.target) }} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        style={{ ...baseInput, overflow: 'hidden', minHeight: 48 }} />
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
export function TogglePill({ value, onChange, col }: {
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

// ── 분류 태그 (IN PUT / OUT PUT) ────────────────────────────────────────────
// 노션 멀티셀렉트처럼 옵션 선택·생성·순서 편집·삭제. 색으로 구분해 표시한다.
// IN PUT 과 OUT PUT 은 서로 다른 옵션 목록을 갖는다(각각 localStorage 저장):
// - IN PUT: 자물쇠/입력 유형 — 자동 태그(Number/Alphabet/Keypad/X-kit) 포함
// - OUT PUT: 획득물 유형 — 자물쇠 답 유형(Number/Alphabet/Keypad)은 제외, Item 포함
export type TagKind = 'input' | 'output'
const TAG_OPTIONS_LS_KEYS: Record<TagKind, string> = {
  input: 'xynaps_gameflow_tag_options_in',
  output: 'xynaps_gameflow_tag_options_out',
}
const DEFAULT_TAG_OPTIONS: Record<TagKind, string[]> = {
  input: ['X-kit', 'Device', 'Keypad', 'Number', 'Alphabet', 'Key', 'Dial', 'ACTION', 'MP3', 'Video'],
  output: ['X-kit', 'Device', 'Key', 'Dial', 'ACTION', 'MP3', 'Video', 'Item'],
}

const TAG_COLOR_PRESETS: Record<string, { fg: string; bg: string }> = {
  'X-kit':    { fg: '#cbd5e1', bg: 'rgba(148,163,184,0.28)' },
  'Device':   { fg: '#93c5fd', bg: 'rgba(59,130,246,0.30)' },
  'Keypad':   { fg: '#86efac', bg: 'rgba(34,197,94,0.26)' },
  'Number':   { fg: '#fde68a', bg: 'rgba(202,138,4,0.32)' },
  'Alphabet': { fg: '#f0abfc', bg: 'rgba(192,38,211,0.26)' },
  'Key':      { fg: '#fcd34d', bg: 'rgba(146,107,40,0.38)' },
  'Dial':     { fg: '#c4b5fd', bg: 'rgba(124,58,237,0.30)' },
  'ACTION':   { fg: '#fca5a5', bg: 'rgba(220,38,38,0.30)' },
  'MP3':      { fg: '#67e8f9', bg: 'rgba(6,182,212,0.26)' },
  'Video':    { fg: '#fdba74', bg: 'rgba(234,88,12,0.28)' },
  'Item':     { fg: '#6ee7b7', bg: 'rgba(16,185,129,0.26)' },
}
const TAG_COLOR_CYCLE = Object.values(TAG_COLOR_PRESETS)

export function loadTagOptions(kind: TagKind): string[] {
  try {
    const raw = localStorage.getItem(TAG_OPTIONS_LS_KEYS[kind])
    if (raw) {
      const arr = JSON.parse(raw)
      if (Array.isArray(arr) && arr.every(x => typeof x === 'string')) return arr
    }
  } catch { /* ignore */ }
  return [...DEFAULT_TAG_OPTIONS[kind]]
}

function saveTagOptions(kind: TagKind, opts: string[]): void {
  try { localStorage.setItem(TAG_OPTIONS_LS_KEYS[kind], JSON.stringify(opts)) } catch { /* ignore */ }
}

// ── IN PUT 자동 태그 추론 ────────────────────────────────────────────────────
// 답 텍스트로 자물쇠/입력 유형을 자동 판별한다:
// 한글 포함 → X-kit / 숫자 ≤4자리 → Number / 영문 ≤5자리 → Alphabet
// 그 외 영숫자 ≤8자리 → Keypad / 8자리 초과 → X-kit
export const AUTO_INPUT_TAGS = ['Number', 'Alphabet', 'Keypad', 'X-kit']
export function inferInputTag(raw: string): string | null {
  const v = raw.replace(/^\(AUTO\)/, '').trim()
  if (!v) return null
  if (/[가-힣ㄱ-ㅎㅏ-ㅣ]/.test(v)) return 'X-kit'
  // 구분 기호(공백·하이픈·쉼표 등)를 제거하고 실제 입력 자릿수만 센다
  const compact = v.replace(/[\s\-–—·.,>/|]/g, '')
  if (!compact) return null
  if (/^\d+$/.test(compact)) {
    if (compact.length <= 4) return 'Number'
    if (compact.length <= 8) return 'Keypad'
    return 'X-kit'
  }
  if (/^[A-Za-z]+$/.test(compact)) {
    if (compact.length <= 5) return 'Alphabet'
    if (compact.length <= 8) return 'Keypad'
    return 'X-kit'
  }
  if (/^[A-Za-z0-9]+$/.test(compact)) {
    return compact.length <= 8 ? 'Keypad' : 'X-kit'
  }
  return null // 그 외(특수문자 답 등)는 자동 지정하지 않음
}

export function outputTagColor(label: string): { fg: string; bg: string } {
  const preset = TAG_COLOR_PRESETS[label]
  if (preset) return preset
  // 커스텀 태그: 라벨 해시로 프리셋 색을 순환 재사용
  let h = 0
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  return TAG_COLOR_CYCLE[h % TAG_COLOR_CYCLE.length]
}

export function TagChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
  const c = outputTagColor(label)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      fontSize: 10, fontWeight: 700, color: c.fg, background: c.bg,
      borderRadius: 6, padding: '1px 6px', whiteSpace: 'nowrap', lineHeight: 1.7,
    }}>
      {label}
      {onRemove && (
        <span
          onClick={e => { e.stopPropagation(); onRemove() }}
          style={{ cursor: 'pointer', opacity: 0.65, fontSize: 11, lineHeight: 1 }}
          title="태그 제거"
        >×</span>
      )}
    </span>
  )
}

export function TagPicker({ tags, onChange, kind = 'output' }: { tags: string[]; onChange: (next: string[]) => void; kind?: TagKind }) {
  const [open, setOpen] = useState(false)
  const [manage, setManage] = useState(false)
  const [query, setQuery] = useState('')
  const [options, setOptions] = useState<string[]>([])
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  function openPanel(e: React.MouseEvent) {
    e.stopPropagation()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPos({ x: r.left, y: r.bottom + 4 })
    setQuery('')
    setManage(false)
    setOptions(loadTagOptions(kind))
    setOpen(v => !v)
  }

  // 바깥 클릭 / Esc 로 닫기
  useEffect(() => {
    if (!open) return
    function onDown(ev: MouseEvent) {
      const t = ev.target as Node
      if (panelRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    function onKey(ev: KeyboardEvent) { if (ev.key === 'Escape') setOpen(false) }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('mousedown', onDown); window.removeEventListener('keydown', onKey) }
  }, [open])

  function toggle(label: string) {
    onChange(tags.includes(label) ? tags.filter(t => t !== label) : [...tags, label])
  }
  function createOption(label: string) {
    if (!options.includes(label)) {
      const next = [...options, label]
      setOptions(next)
      saveTagOptions(kind, next)
    }
    if (!tags.includes(label)) onChange([...tags, label])
    setQuery('')
  }
  function moveOption(label: string, dir: -1 | 1) {
    const i = options.indexOf(label)
    const j = i + dir
    if (i < 0 || j < 0 || j >= options.length) return
    const next = [...options]
    ;[next[i], next[j]] = [next[j], next[i]]
    setOptions(next)
    saveTagOptions(kind, next)
  }
  function deleteOption(label: string) {
    const next = options.filter(o => o !== label)
    setOptions(next)
    saveTagOptions(kind, next)
  }

  const q = query.trim()
  const filtered = options.filter(o => !q || o.toLowerCase().includes(q.toLowerCase()))
  const orphanSelected = tags.filter(t => !options.includes(t))
  const canCreate = q.length > 0 && !options.some(o => o.toLowerCase() === q.toLowerCase())

  const miniBtn: React.CSSProperties = {
    width: 18, height: 18, borderRadius: 5, border: '1px solid var(--border)',
    background: 'transparent', color: 'var(--text-muted)', fontSize: 10, lineHeight: 1,
    cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0,
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={openPanel}
        title="분류 태그 선택"
        style={{
          width: 18, height: 18, borderRadius: 6, flexShrink: 0,
          border: '1px dashed var(--border)', background: 'transparent',
          color: 'var(--text-muted)', fontSize: 11, fontWeight: 700, lineHeight: 1,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          opacity: open ? 1 : 0.6,
        }}
      >＋</button>
      {open && pos && createPortal(
        <div
          ref={panelRef}
          style={{
            position: 'fixed', left: Math.min(pos.x, window.innerWidth - 220), top: pos.y, zIndex: 9999,
            width: 208, maxHeight: 300, overflowY: 'auto',
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)', padding: 6,
          }}
        >
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            <input
              autoFocus
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canCreate) createOption(q) }}
              placeholder="옵션 선택 또는 생성"
              style={{
                flex: 1, minWidth: 0, boxSizing: 'border-box',
                background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
                borderRadius: 7, padding: '5px 8px', fontSize: 11, color: 'var(--text-primary)', outline: 'none',
              }}
            />
            <button
              onClick={() => setManage(v => !v)}
              title={manage ? '편집 완료' : '옵션 편집 (순서·삭제)'}
              style={{
                flexShrink: 0, width: 26, borderRadius: 7,
                border: manage ? '1px solid var(--accent)' : '1px solid var(--border)',
                background: manage ? 'var(--accent-dim)' : 'transparent',
                color: manage ? 'var(--accent)' : 'var(--text-muted)',
                fontSize: 12, cursor: 'pointer',
              }}
            >{manage ? '✓' : '⚙'}</button>
          </div>
          {orphanSelected.map(label => (
            <div
              key={`orphan-${label}`}
              onClick={() => toggle(label)}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', borderRadius: 7, cursor: 'pointer' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              <TagChip label={label} />
              <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 800 }}>✓</span>
            </div>
          ))}
          {filtered.map(label => {
            const active = tags.includes(label)
            return (
              <div
                key={label}
                onClick={() => { if (!manage) toggle(label) }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6,
                  padding: '4px 6px', borderRadius: 7, cursor: manage ? 'default' : 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <TagChip label={label} />
                {manage ? (
                  <span style={{ display: 'inline-flex', gap: 3, flexShrink: 0 }}>
                    <button style={miniBtn} title="위로" onClick={e => { e.stopPropagation(); moveOption(label, -1) }}>↑</button>
                    <button style={miniBtn} title="아래로" onClick={e => { e.stopPropagation(); moveOption(label, 1) }}>↓</button>
                    <button style={{ ...miniBtn, color: 'rgba(255,90,90,0.8)' }} title="옵션 삭제"
                      onClick={e => { e.stopPropagation(); deleteOption(label) }}>×</button>
                  </span>
                ) : (
                  active && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 800 }}>✓</span>
                )}
              </div>
            )
          })}
          {canCreate && !manage && (
            <div
              onClick={() => createOption(q)}
              style={{ padding: '5px 6px', borderRadius: 7, cursor: 'pointer', fontSize: 11, color: 'var(--text-muted)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              ＋ &ldquo;{q}&rdquo; 생성
            </div>
          )}
        </div>,
        document.body
      )}
    </>
  )
}

// 기존 사용처 호환 별칭
export const OutputTagChip = TagChip
export const OutputTagPicker = TagPicker

export function DragHandleDots() {
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
