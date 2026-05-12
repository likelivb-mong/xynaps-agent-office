import { useState } from 'react'
import type { AudioScript, AudioScriptTrack, AudioScriptRow, AudioChannel, AudioRowKind } from '../types'
import { PlusIcon } from './ui/Icon'

// ── Channel config ──────────────────────────────────────────────────────────
const CHANNEL_CONFIG: Record<AudioChannel, { label: string; color: string; bg: string; border: string }> = {
  'L':   { label: 'L',   color: '#93c5fd', bg: 'rgba(147,197,253,0.12)', border: 'rgba(147,197,253,0.35)' },
  'R':   { label: 'R',   color: '#a5b4fc', bg: 'rgba(165,180,252,0.12)', border: 'rgba(165,180,252,0.35)' },
  'C':   { label: 'C',   color: '#67e8f9', bg: 'rgba(103,232,249,0.12)', border: 'rgba(103,232,249,0.35)' },
  'L+R': { label: 'L+R', color: '#6ee7b7', bg: 'rgba(110,231,183,0.12)', border: 'rgba(110,231,183,0.35)' },
  'SFX': { label: 'SFX', color: '#fb923c', bg: 'rgba(251,146,60,0.12)',  border: 'rgba(251,146,60,0.35)'  },
  '전환': { label: '전환', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)',  border: 'rgba(251,191,36,0.35)'  },
}
const CHANNELS: AudioChannel[] = ['L', 'R', 'C', 'L+R', 'SFX', '전환']

function newRow(kind: AudioRowKind, channel?: AudioChannel): AudioScriptRow {
  return { id: crypto.randomUUID(), kind, channel: kind === 'line' ? (channel ?? 'C') : undefined, content: '' }
}

function newTrack(trackNum: number): AudioScriptTrack {
  return {
    id: crypto.randomUUID(),
    trackNum,
    title: `트랙 ${String(trackNum).padStart(2, '0')}`,
    timeStart: '00:00',
    timeEnd: '00:00',
    rows: [newRow('line', 'C')],
  }
}

function emptyScript(): AudioScript {
  return { tracks: [newTrack(1)], generatedAt: new Date().toISOString() }
}

// ── EditableCell ─────────────────────────────────────────────────────────────
function EditableCell({
  value, onChange, placeholder = '', multiline = false, style,
}: {
  value: string; onChange: (v: string) => void
  placeholder?: string; multiline?: boolean; style?: React.CSSProperties
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)

  function commit() { setEditing(false); if (draft !== value) onChange(draft) }

  const inputStyle: React.CSSProperties = {
    width: '100%', fontFamily: 'inherit', fontSize: 12,
    background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)',
    border: '1px solid var(--accent)', borderRadius: 5,
    padding: '4px 8px', outline: 'none', resize: 'none',
    boxSizing: 'border-box', lineHeight: 1.6, ...style,
  }

  if (editing) return multiline
    ? <textarea rows={2} value={draft} autoFocus
        onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        style={inputStyle} />
    : <input value={draft} autoFocus
        onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
        style={inputStyle} />

  return (
    <div onClick={() => { setDraft(value); setEditing(true) }}
      style={{
        cursor: 'text', minHeight: 22, padding: '4px 8px', borderRadius: 5,
        fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word',
        color: value ? 'var(--text-primary)' : 'var(--text-muted)',
        transition: 'background 0.1s', ...style,
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
      {value || <span style={{ opacity: 0.35 }}>{placeholder}</span>}
    </div>
  )
}

// ── ChannelBadge ─────────────────────────────────────────────────────────────
function ChannelBadge({ channel, onChange }: { channel: AudioChannel; onChange: (c: AudioChannel) => void }) {
  const [open, setOpen] = useState(false)
  const cfg = CHANNEL_CONFIG[channel]
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => setOpen(v => !v)} style={{
        minWidth: 44, height: 26, borderRadius: 6, border: `1px solid ${cfg.border}`,
        background: cfg.bg, color: cfg.color,
        fontSize: 11, fontWeight: 700, cursor: 'pointer',
        padding: '0 8px', letterSpacing: 0.5, transition: 'all 0.1s',
      }}>{cfg.label}</button>
      {open && (
        <div style={{
          position: 'absolute', top: 30, left: 0, zIndex: 100,
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          borderRadius: 8, padding: 4, display: 'flex', flexDirection: 'column', gap: 2,
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: 72,
        }}>
          {CHANNELS.map(ch => {
            const c = CHANNEL_CONFIG[ch]
            return (
              <button key={ch} onClick={() => { onChange(ch); setOpen(false) }} style={{
                padding: '4px 10px', borderRadius: 5, border: 'none', cursor: 'pointer',
                background: channel === ch ? c.bg : 'transparent',
                color: c.color, fontSize: 11, fontWeight: 700, textAlign: 'left',
                transition: 'background 0.1s',
              }}
                onMouseEnter={e => (e.currentTarget.style.background = c.bg)}
                onMouseLeave={e => (e.currentTarget.style.background = channel === ch ? c.bg : 'transparent')}>
                {c.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── TimeField ────────────────────────────────────────────────────────────────
function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  function commit() { setEditing(false); if (draft !== value) onChange(draft) }

  if (editing) return (
    <input value={draft} autoFocus
      onChange={e => setDraft(e.target.value)} onBlur={commit}
      onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(value); setEditing(false) } }}
      style={{
        width: 52, fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
        background: 'rgba(255,255,255,0.05)', color: '#fbbf24',
        border: '1px solid var(--accent)', borderRadius: 4,
        padding: '2px 4px', outline: 'none', textAlign: 'center',
      }} />
  )
  return (
    <span onClick={() => { setDraft(value); setEditing(true) }}
      style={{ cursor: 'text', color: '#fbbf24', fontWeight: 600, fontSize: 12, padding: '2px 2px' }}>
      {value}
    </span>
  )
}

// ── TrackHeader ──────────────────────────────────────────────────────────────
function TrackHeader({
  track, onUpdate, onDelete, onAddRow, onAddCue, collapsed, onToggleCollapse,
}: {
  track: AudioScriptTrack
  onUpdate: (t: AudioScriptTrack) => void
  onDelete: () => void
  onAddRow: () => void
  onAddCue: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 12px',
      background: 'rgba(255,255,255,0.03)',
      borderBottom: '1px solid rgba(255,255,255,0.07)',
      borderRadius: collapsed ? '10px' : '10px 10px 0 0',
    }}>
      {/* collapse */}
      <button onClick={onToggleCollapse} style={{
        width: 20, height: 20, borderRadius: 4, border: 'none',
        background: 'transparent', color: 'var(--text-muted)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 10, flexShrink: 0, transition: 'transform 0.15s',
        transform: collapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
      }}>▾</button>

      {/* TRACK NUM */}
      <span style={{ color: 'rgba(148,163,184,0.6)', fontSize: 10, fontWeight: 700, letterSpacing: 1, flexShrink: 0 }}>
        TRACK {String(track.trackNum).padStart(2, '0')}
      </span>

      {/* Title */}
      <div style={{ flex: 1, minWidth: 80 }}>
        <EditableCell value={track.title} onChange={v => onUpdate({ ...track, title: v })} placeholder="트랙 제목" />
      </div>

      {/* Time range */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
        <TimeField value={track.timeStart} onChange={v => onUpdate({ ...track, timeStart: v })} />
        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
        <TimeField value={track.timeEnd} onChange={v => onUpdate({ ...track, timeEnd: v })} />
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
        <button onClick={onAddRow} title="채널 줄 추가" style={actionBtnStyle('#60a5fa')}>+ 채널</button>
        <button onClick={onAddCue} title="큐 마커 추가" style={actionBtnStyle('#94a3b8')}>▸ 큐</button>
        <button onClick={onDelete} title="트랙 삭제" style={actionBtnStyle('#f87171', true)}>✕</button>
      </div>
    </div>
  )
}

function actionBtnStyle(color: string, danger?: boolean): React.CSSProperties {
  return {
    height: 24, padding: '0 8px', borderRadius: 5, border: `1px solid ${color}44`,
    background: danger ? 'rgba(248,113,113,0.08)' : `${color}11`,
    color, fontSize: 11, fontWeight: 600, cursor: 'pointer', transition: 'all 0.1s',
    whiteSpace: 'nowrap',
  }
}

// ── ScriptRow ────────────────────────────────────────────────────────────────
function ScriptRow({
  row, onUpdate, onDelete,
}: {
  row: AudioScriptRow
  onUpdate: (r: AudioScriptRow) => void
  onDelete: () => void
}) {
  const [hovered, setHovered] = useState(false)

  if (row.kind === 'cue') {
    return (
      <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '3px 12px',
          background: 'rgba(148,163,184,0.05)',
          borderBottom: '1px solid rgba(255,255,255,0.03)',
          minHeight: 30,
        }}>
        <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 11, flexShrink: 0 }}>▸</span>
        <div style={{ flex: 1 }}>
          <EditableCell
            value={row.content}
            onChange={v => onUpdate({ ...row, content: v })}
            placeholder="큐 마커 / 타이밍 메모"
            style={{ fontSize: 11, color: 'rgba(148,163,184,0.7)', fontStyle: 'italic' }}
          />
        </div>
        {hovered && (
          <button onClick={onDelete} style={{
            width: 18, height: 18, borderRadius: 4, border: 'none',
            background: 'rgba(248,113,113,0.12)', color: '#f87171',
            fontSize: 10, cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        )}
      </div>
    )
  }

  return (
    <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: '4px 12px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        minHeight: 34,
      }}>
      {/* Channel badge */}
      <div style={{ paddingTop: 4, flexShrink: 0 }}>
        <ChannelBadge
          channel={row.channel ?? 'C'}
          onChange={ch => onUpdate({ ...row, channel: ch })}
        />
      </div>
      {/* Content */}
      <div style={{ flex: 1 }}>
        <EditableCell
          value={row.content}
          onChange={v => onUpdate({ ...row, content: v })}
          placeholder="내용 입력..."
          multiline
        />
      </div>
      {/* Delete */}
      {hovered && (
        <button onClick={onDelete} style={{
          width: 20, height: 20, borderRadius: 4, border: 'none', marginTop: 6,
          background: 'rgba(248,113,113,0.12)', color: '#f87171',
          fontSize: 10, cursor: 'pointer', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>✕</button>
      )}
    </div>
  )
}

// ── Main ─────────────────────────────────────────────────────────────────────
interface AudioScriptTableProps {
  script: AudioScript | undefined
  onChange: (script: AudioScript) => void
}

export default function AudioScriptTable({ script, onChange }: AudioScriptTableProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const activeScript = script ?? emptyScript()

  function updateTrack(trackId: string, updated: AudioScriptTrack) {
    onChange({
      ...activeScript,
      tracks: activeScript.tracks.map(t => t.id === trackId ? updated : t),
    })
  }

  function deleteTrack(trackId: string) {
    onChange({
      ...activeScript,
      tracks: activeScript.tracks.filter(t => t.id !== trackId),
    })
  }

  function addTrack() {
    const maxNum = activeScript.tracks.reduce((m, t) => Math.max(m, t.trackNum), 0)
    onChange({
      ...activeScript,
      tracks: [...activeScript.tracks, newTrack(maxNum + 1)],
    })
  }

  function updateRow(trackId: string, rowId: string, updated: AudioScriptRow) {
    const track = activeScript.tracks.find(t => t.id === trackId)!
    updateTrack(trackId, {
      ...track,
      rows: track.rows.map(r => r.id === rowId ? updated : r),
    })
  }

  function deleteRow(trackId: string, rowId: string) {
    const track = activeScript.tracks.find(t => t.id === trackId)!
    updateTrack(trackId, { ...track, rows: track.rows.filter(r => r.id !== rowId) })
  }

  function addRow(trackId: string, kind: AudioRowKind) {
    const track = activeScript.tracks.find(t => t.id === trackId)!
    updateTrack(trackId, { ...track, rows: [...track.rows, newRow(kind)] })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Channel legend */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
        padding: '10px 16px',
        background: 'var(--bg-card)', borderRadius: 10,
        border: '1px solid var(--border)',
      }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, letterSpacing: 0.5 }}>채널 범례</span>
        {CHANNELS.map(ch => {
          const cfg = CHANNEL_CONFIG[ch]
          return (
            <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                padding: '2px 8px', borderRadius: 5,
                background: cfg.bg, color: cfg.color,
                border: `1px solid ${cfg.border}`,
                fontSize: 11, fontWeight: 700,
              }}>{cfg.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                {ch === 'L' ? '왼쪽 귀' : ch === 'R' ? '오른쪽 귀' : ch === 'C' ? '중앙/양쪽' : ch === 'L+R' ? '전방향' : ch === 'SFX' ? '효과음' : '채널 전환'}
              </span>
            </div>
          )
        })}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'rgba(148,163,184,0.5)', fontSize: 13 }}>▸</span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>큐 마커</span>
        </div>
      </div>

      {/* Tracks */}
      {activeScript.tracks.map(track => (
        <div key={track.id} style={{
          border: '1px solid var(--border)',
          borderRadius: 10,
          background: 'var(--bg-card)',
        }}>
          <TrackHeader
            track={track}
            onUpdate={updated => updateTrack(track.id, updated)}
            onDelete={() => deleteTrack(track.id)}
            onAddRow={() => addRow(track.id, 'line')}
            onAddCue={() => addRow(track.id, 'cue')}
            collapsed={!!collapsed[track.id]}
            onToggleCollapse={() => setCollapsed(prev => ({ ...prev, [track.id]: !prev[track.id] }))}
          />
          {!collapsed[track.id] && (
            <div>
              {track.rows.length === 0 ? (
                <div style={{ padding: '16px 12px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 12 }}>
                  줄이 없습니다. 채널 줄 또는 큐 마커를 추가하세요.
                </div>
              ) : (
                track.rows.map(row => (
                  <ScriptRow
                    key={row.id}
                    row={row}
                    onUpdate={updated => updateRow(track.id, row.id, updated)}
                    onDelete={() => deleteRow(track.id, row.id)}
                  />
                ))
              )}
            </div>
          )}
        </div>
      ))}

      {/* Add track */}
      <button onClick={addTrack} style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: '10px 0', borderRadius: 10,
        border: '1px dashed var(--border)',
        background: 'transparent', color: 'var(--text-muted)',
        fontSize: 12, cursor: 'pointer', transition: 'all 0.15s',
        width: '100%',
      }}
        onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-muted)' }}>
        <PlusIcon width={14} height={14} />
        트랙 추가
      </button>
    </div>
  )
}
