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

// ── OUT PUT 태그 ────────────────────────────────────────────────────────────
// 노션 멀티셀렉트처럼 프리셋 옵션 + 직접 생성. 색으로 구분해 표시한다.
export const OUTPUT_TAG_OPTIONS: Array<{ label: string; fg: string; bg: string }> = [
  { label: 'X-kit',    fg: '#cbd5e1', bg: 'rgba(148,163,184,0.28)' },
  { label: 'Device',   fg: '#93c5fd', bg: 'rgba(59,130,246,0.30)' },
  { label: 'Keypad',   fg: '#86efac', bg: 'rgba(34,197,94,0.26)' },
  { label: 'Number',   fg: '#fde68a', bg: 'rgba(202,138,4,0.32)' },
  { label: 'Alphabet', fg: '#f0abfc', bg: 'rgba(192,38,211,0.26)' },
  { label: 'Key',      fg: '#fcd34d', bg: 'rgba(146,107,40,0.38)' },
  { label: 'Dial',     fg: '#c4b5fd', bg: 'rgba(124,58,237,0.30)' },
  { label: 'ACTION',   fg: '#fca5a5', bg: 'rgba(220,38,38,0.30)' },
]

export function outputTagColor(label: string): { fg: string; bg: string } {
  const preset = OUTPUT_TAG_OPTIONS.find(o => o.label === label)
  if (preset) return preset
  // 커스텀 태그: 라벨 해시로 프리셋 색을 순환 재사용
  let h = 0
  for (const ch of label) h = (h * 31 + ch.charCodeAt(0)) >>> 0
  const o = OUTPUT_TAG_OPTIONS[h % OUTPUT_TAG_OPTIONS.length]
  return { fg: o.fg, bg: o.bg }
}

export function OutputTagChip({ label, onRemove }: { label: string; onRemove?: () => void }) {
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

export function OutputTagPicker({ tags, onChange }: { tags: string[]; onChange: (next: string[]) => void }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)

  function openPanel(e: React.MouseEvent) {
    e.stopPropagation()
    const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
    setPos({ x: r.left, y: r.bottom + 4 })
    setQuery('')
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

  const q = query.trim()
  const filtered = OUTPUT_TAG_OPTIONS.filter(o => !q || o.label.toLowerCase().includes(q.toLowerCase()))
  const customSelected = tags.filter(t => !OUTPUT_TAG_OPTIONS.some(o => o.label === t))
  const canCreate = q.length > 0
    && !OUTPUT_TAG_OPTIONS.some(o => o.label.toLowerCase() === q.toLowerCase())
    && !tags.some(t => t.toLowerCase() === q.toLowerCase())

  return (
    <>
      <button
        ref={btnRef}
        onClick={openPanel}
        title="OUT PUT 태그 선택"
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
            position: 'fixed', left: Math.min(pos.x, window.innerWidth - 200), top: pos.y, zIndex: 9999,
            width: 188, maxHeight: 260, overflowY: 'auto',
            background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10,
            boxShadow: '0 12px 32px rgba(0,0,0,0.45)', padding: 6,
          }}
        >
          <input
            autoFocus
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && canCreate) { toggle(q); setQuery('') } }}
            placeholder="옵션 선택 또는 생성"
            style={{
              width: '100%', boxSizing: 'border-box', marginBottom: 6,
              background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)',
              borderRadius: 7, padding: '5px 8px', fontSize: 11, color: 'var(--text-primary)', outline: 'none',
            }}
          />
          {[...customSelected.map(label => ({ label })), ...filtered].map(({ label }) => {
            const active = tags.includes(label)
            return (
              <div
                key={label}
                onClick={() => toggle(label)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '4px 6px', borderRadius: 7, cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <OutputTagChip label={label} />
                {active && <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 800 }}>✓</span>}
              </div>
            )
          })}
          {canCreate && (
            <div
              onClick={() => { toggle(q); setQuery('') }}
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
