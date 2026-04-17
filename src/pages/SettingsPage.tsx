import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSettings } from '../contexts/SettingsContext'

type Column = '절약' | '균형' | '최고/Max'

const COLUMNS: Column[] = ['절약', '균형', '최고/Max']

const COLUMN_COLOR: Record<Column, string> = {
  '절약': '#22c55e',
  '균형': '#6f7dff',
  '최고/Max': '#f59e0b',
}

const TABLE_ROWS = [
  {
    purpose: 'deep',
    label: 'deep',
    desc: '보고서 작성',
    cells: {
      '절약': 'Sonnet 4.6',
      '균형': 'Opus 4.7',
      '최고/Max': 'Opus 4.7\n+ max thinking',
    },
  },
  {
    purpose: 'fast',
    label: 'fast',
    desc: '게임플로우 · 스크립트 · 회의실',
    cells: {
      '절약': 'Sonnet 4.6',
      '균형': 'Sonnet 4.6',
      '최고/Max': 'Opus 4.7',
    },
  },
  {
    purpose: 'cost',
    label: '비용',
    desc: 'API 과금 기준',
    cells: {
      '절약': '약 1,500~3,000원/회',
      '균형': '약 14,000~20,000원/회',
      '최고/Max': '약 32,000~45,000원/회\n또는 무료 (Max 구독)',
    },
  },
]

function columnToTier(col: Column, serverConnected: boolean) {
  if (col === '절약') return '절약' as const
  if (col === '균형') return '균형' as const
  return serverConnected ? 'Max구독연결' as const : '최고' as const
}

function tierToColumn(tier: string): Column {
  if (tier === '절약') return '절약'
  if (tier === '균형') return '균형'
  return '최고/Max'
}

export function SettingsPage() {
  const { settings, updateSettings } = useSettings()
  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'disconnected'>('disconnected')

  const selectedCol = tierToColumn(settings.modelTier)

  useEffect(() => {
    checkLocalServer()
  }, [])

  async function checkLocalServer() {
    setServerStatus('checking')
    try {
      const res = await fetch('http://localhost:3001/api/health', {
        signal: AbortSignal.timeout(2000),
      })
      setServerStatus(res.ok ? 'connected' : 'disconnected')
    } catch {
      setServerStatus('disconnected')
    }
  }

  function selectColumn(col: Column) {
    updateSettings({ modelTier: columnToTier(col, serverStatus === 'connected') })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117' }}>
      <header style={{
        padding: '16px 28px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 12 }}>
          ← 홈으로
        </Link>
        <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
          설정
        </span>
      </header>

      <div style={{ maxWidth: 700, margin: '0 auto', padding: '40px 24px' }}>

        {/* Section label */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#64748b', marginBottom: 16 }}>
          AI 품질 설정
        </div>

        {/* Table */}
        <div style={{
          border: '1px solid #2a2d36',
          borderRadius: 14,
          overflow: 'hidden',
          marginBottom: 28,
        }}>
          {/* Column header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
            {/* empty top-left cell */}
            <div style={{
              padding: '14px 16px',
              background: '#13151f',
              borderBottom: '1px solid #2a2d36',
              borderRight: '1px solid #2a2d36',
            }} />
            {COLUMNS.map(col => {
              const active = selectedCol === col
              const color = COLUMN_COLOR[col]
              return (
                <button
                  key={col}
                  onClick={() => selectColumn(col)}
                  style={{
                    padding: '14px 10px',
                    background: active ? `${color}18` : '#13151f',
                    border: 'none',
                    borderBottom: `2px solid ${active ? color : '#2a2d36'}`,
                    borderRight: col !== '최고/Max' ? '1px solid #2a2d36' : 'none',
                    cursor: 'pointer',
                    textAlign: 'center',
                    transition: 'background 0.15s',
                  }}
                >
                  <div style={{
                    fontSize: 13, fontWeight: 700,
                    color: active ? color : '#94a3b8',
                  }}>
                    {col}
                  </div>
                  {col === '최고/Max' && (
                    <div style={{ fontSize: 10, marginTop: 3, color: serverStatus === 'connected' ? '#22c55e' : '#475569' }}>
                      {serverStatus === 'connected' ? 'Max 무료' : 'API 과금'}
                    </div>
                  )}
                </button>
              )
            })}
          </div>

          {/* Data rows */}
          {TABLE_ROWS.map((row, ri) => (
            <div key={row.purpose} style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr 1fr',
              borderBottom: ri < TABLE_ROWS.length - 1 ? '1px solid #1e2130' : 'none',
            }}>
              {/* Row label */}
              <div style={{
                padding: '14px 16px',
                background: '#13151f',
                borderRight: '1px solid #2a2d36',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
              }}>
                {row.purpose !== 'cost' && (
                  <code style={{ fontSize: 11, color: '#6f7dff', marginBottom: 3 }}>{row.label}</code>
                )}
                <span style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{row.desc}</span>
              </div>

              {/* Cells */}
              {COLUMNS.map(col => {
                const active = selectedCol === col
                const color = COLUMN_COLOR[col]
                const text = row.cells[col]
                return (
                  <div
                    key={col}
                    onClick={() => selectColumn(col)}
                    style={{
                      padding: '13px 12px',
                      background: active ? `${color}10` : 'transparent',
                      borderRight: col !== '최고/Max' ? '1px solid #1e2130' : 'none',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'background 0.15s',
                    }}
                  >
                    <span style={{
                      fontSize: 11,
                      color: active
                        ? (row.purpose === 'cost' ? color : '#e2e8f0')
                        : '#64748b',
                      whiteSpace: 'pre-line',
                      lineHeight: 1.5,
                      fontWeight: active && row.purpose !== 'cost' ? 600 : 400,
                    }}>
                      {text}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Local server status */}
        <div style={{
          background: '#1a1d26',
          border: '1px solid #2a2d36',
          borderRadius: 12,
          padding: '16px 18px',
          marginBottom: 24,
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: serverStatus === 'disconnected' ? 12 : 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#64748b' }}>
                로컬 서버 (Max 구독)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: serverStatus === 'connected' ? '#22c55e'
                    : serverStatus === 'checking' ? '#f59e0b' : '#ef4444',
                }} />
                <span style={{ fontSize: 12, color: serverStatus === 'connected' ? '#22c55e' : '#94a3b8' }}>
                  {serverStatus === 'connected' ? '연결됨 · http://localhost:3001'
                    : serverStatus === 'checking' ? '확인 중...' : '연결 안됨'}
                </span>
              </div>
            </div>
            <button
              onClick={checkLocalServer}
              disabled={serverStatus === 'checking'}
              style={{
                padding: '4px 10px', borderRadius: 6,
                border: '1px solid #2f3447',
                background: 'transparent', color: '#64748b',
                fontSize: 11, cursor: 'pointer',
              }}
            >
              재확인
            </button>
          </div>

          {serverStatus === 'disconnected' && (
            <div style={{
              background: 'rgba(239,68,68,0.07)',
              border: '1px solid rgba(239,68,68,0.18)',
              borderRadius: 8, padding: '10px 12px',
              fontSize: 11, color: '#fca5a5', lineHeight: 1.7,
            }}>
              <strong>서버 시작 방법:</strong><br />
              <code style={{ background: '#0f1117', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                cd ~/Downloads/xynaps-agent-office-v2/server && npm install && node index.js
              </code>
            </div>
          )}
        </div>

        {/* Info */}
        <div style={{
          fontSize: 11, color: '#475569', lineHeight: 1.7,
        }}>
          로컬 서버가 연결되면 최고/Max 선택 시 Claude Max 구독을 사용해 API 비용 없이 동일한 품질로 실행됩니다.<br />
          다른 기기에서 데이터 조회·편집은 Supabase로 동기화되지만, AI 생성은 서버가 실행 중인 기기에서만 작동합니다.
        </div>

      </div>
    </div>
  )
}
