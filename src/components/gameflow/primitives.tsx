import { useState } from 'react'

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
