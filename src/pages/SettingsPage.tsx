import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSettings, type ModelQuality } from '../contexts/SettingsContext'

const QUALITIES: ModelQuality[] = ['절약', '균형', '최고']

const QUALITY_COLOR: Record<ModelQuality, string> = {
  '절약': '#22c55e',
  '균형': '#6f7dff',
  '최고': '#f59e0b',
}

const TABLE_ROWS = [
  {
    key: 'deep',
    label: 'deep',
    desc: '보고서 작성',
    cells: { '절약': 'Sonnet 4.6', '균형': 'Opus 4.7', '최고': 'Opus 4.7\n+ max thinking' },
  },
  {
    key: 'fast',
    label: 'fast',
    desc: '게임플로우 · 스크립트 · 회의실',
    cells: { '절약': 'Sonnet 4.6', '균형': 'Sonnet 4.6', '최고': 'Opus 4.7' },
  },
  {
    key: 'cost',
    label: '비용',
    desc: 'API 과금 기준',
    cells: { '절약': '약 1,500~3,000원/회', '균형': '약 14,000~20,000원/회', '최고': '약 32,000~45,000원/회' },
  },
]

export function SettingsPage() {
  const { settings, updateSettings } = useSettings()
  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'disconnected'>('disconnected')
  const [urlInput, setUrlInput] = useState(settings.localServerUrl || 'http://localhost:3001')

  useEffect(() => { checkLocalServer() }, [])

  async function checkLocalServer() {
    const url = settings.localServerUrl || 'http://localhost:3001'
    setServerStatus('checking')
    try {
      const res = await fetch(`${url}/api/health`, { signal: AbortSignal.timeout(3000) })
      setServerStatus(res.ok ? 'connected' : 'disconnected')
    } catch {
      setServerStatus('disconnected')
    }
  }

  function saveUrl() {
    const trimmed = urlInput.trim().replace(/\/$/, '')
    updateSettings({ localServerUrl: trimmed })
  }

  const selectedQ = settings.modelQuality
  const useMax = settings.useMax

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117' }}>
      <header style={{
        padding: '16px 28px', borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <Link to="/" style={{ color: 'var(--text-muted)', textDecoration: 'none', fontSize: 12 }}>← 홈으로</Link>
        <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>설정</span>
      </header>

      <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 24px' }}>

        {/* Section label */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#64748b', marginBottom: 16 }}>
          AI 품질 설정
        </div>

        {/* Quality table */}
        <div style={{ border: '1px solid #2a2d36', borderRadius: 14, overflow: 'hidden', marginBottom: 20 }}>
          {/* Header row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr' }}>
            <div style={{ padding: '14px 16px', background: '#13151f', borderBottom: '1px solid #2a2d36', borderRight: '1px solid #2a2d36' }} />
            {QUALITIES.map((q, i) => {
              const active = selectedQ === q
              const color = QUALITY_COLOR[q]
              return (
                <button key={q} onClick={() => updateSettings({ modelQuality: q })} style={{
                  padding: '14px 10px', background: active ? `${color}18` : '#13151f',
                  border: 'none', borderBottom: `2px solid ${active ? color : '#2a2d36'}`,
                  borderRight: i < 2 ? '1px solid #2a2d36' : 'none',
                  cursor: 'pointer', textAlign: 'center', transition: 'background 0.15s',
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: active ? color : '#94a3b8' }}>{q}</div>
                </button>
              )
            })}
          </div>

          {/* Data rows */}
          {TABLE_ROWS.map((row, ri) => (
            <div key={row.key} style={{
              display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr',
              borderBottom: ri < TABLE_ROWS.length - 1 ? '1px solid #1e2130' : 'none',
            }}>
              <div style={{
                padding: '13px 16px', background: '#13151f', borderRight: '1px solid #2a2d36',
                display: 'flex', flexDirection: 'column', justifyContent: 'center',
              }}>
                {row.key !== 'cost' && <code style={{ fontSize: 11, color: '#6f7dff', marginBottom: 3 }}>{row.label}</code>}
                <span style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{row.desc}</span>
              </div>
              {QUALITIES.map((q, i) => {
                const active = selectedQ === q
                const color = QUALITY_COLOR[q]
                return (
                  <div key={q} onClick={() => updateSettings({ modelQuality: q })} style={{
                    padding: '12px 10px', background: active ? `${color}10` : 'transparent',
                    borderRight: i < 2 ? '1px solid #1e2130' : 'none',
                    cursor: 'pointer', textAlign: 'center', transition: 'background 0.15s',
                  }}>
                    <span style={{
                      fontSize: 11, whiteSpace: 'pre-line', lineHeight: 1.5,
                      color: active ? (row.key === 'cost' ? color : '#e2e8f0') : '#64748b',
                      fontWeight: active && row.key !== 'cost' ? 600 : 400,
                    }}>
                      {row.cells[q]}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Payment method */}
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#64748b', marginBottom: 12 }}>
          결제 방식
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
          {/* API */}
          <button onClick={() => updateSettings({ useMax: false })} style={{
            padding: '14px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
            background: !useMax ? 'rgba(100,116,139,0.1)' : '#1a1d26',
            border: `1px solid ${!useMax ? '#64748b' : '#2a2d36'}`,
            transition: 'border-color 0.15s, background 0.15s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                border: `2px solid ${!useMax ? '#94a3b8' : '#3f4458'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {!useMax && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#94a3b8' }} />}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: !useMax ? '#e2e8f0' : '#64748b' }}>API 직접</span>
            </div>
            <div style={{ fontSize: 11, color: '#475569', paddingLeft: 22, lineHeight: 1.4 }}>
              Anthropic API 키 사용<br />선택한 품질 기준 과금
            </div>
          </button>

          {/* Max */}
          <button onClick={() => { updateSettings({ useMax: true }); checkLocalServer() }} style={{
            padding: '14px 16px', borderRadius: 12, cursor: 'pointer', textAlign: 'left',
            background: useMax ? 'rgba(236,72,153,0.08)' : '#1a1d26',
            border: `1px solid ${useMax ? '#ec4899' : '#2a2d36'}`,
            transition: 'border-color 0.15s, background 0.15s',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{
                width: 14, height: 14, borderRadius: '50%',
                border: `2px solid ${useMax ? '#ec4899' : '#3f4458'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {useMax && <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ec4899' }} />}
              </div>
              <span style={{ fontSize: 13, fontWeight: 700, color: useMax ? '#f9a8d4' : '#64748b' }}>Max 구독</span>
              <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 600 }}>무료</span>
            </div>
            <div style={{ fontSize: 11, color: '#475569', paddingLeft: 22, lineHeight: 1.4 }}>
              로컬 서버 경유<br />선택한 품질로 API 비용 없이 실행
            </div>
          </button>
        </div>

        {/* Local server status */}
        <div style={{
          background: '#1a1d26', border: '1px solid #2a2d36', borderRadius: 12, padding: '16px 18px', marginBottom: 24,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#64748b' }}>로컬 서버 (Max 구독)</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: serverStatus === 'connected' ? '#22c55e' : serverStatus === 'checking' ? '#f59e0b' : '#ef4444',
                }} />
                <span style={{ fontSize: 12, color: serverStatus === 'connected' ? '#22c55e' : '#94a3b8' }}>
                  {serverStatus === 'connected' ? '연결됨' : serverStatus === 'checking' ? '확인 중...' : '연결 안됨'}
                </span>
              </div>
            </div>
            <button onClick={checkLocalServer} disabled={serverStatus === 'checking'} style={{
              padding: '4px 10px', borderRadius: 6, border: '1px solid #2f3447',
              background: 'transparent', color: '#64748b', fontSize: 11, cursor: 'pointer',
            }}>재확인</button>
          </div>

          {/* Server URL input */}
          <div style={{ display: 'flex', gap: 8, marginBottom: serverStatus === 'disconnected' ? 12 : 0 }}>
            <input
              value={urlInput}
              onChange={e => setUrlInput(e.target.value)}
              onBlur={saveUrl}
              placeholder="http://localhost:3001"
              style={{
                flex: 1, padding: '7px 10px', borderRadius: 7,
                border: '1px solid #2f3447', background: '#0f1117',
                color: '#e2e8f0', fontSize: 12, outline: 'none',
              }}
            />
            <button onClick={() => { saveUrl(); checkLocalServer() }} style={{
              padding: '7px 14px', borderRadius: 7, border: '1px solid #2f3447',
              background: 'transparent', color: '#94a3b8', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
            }}>연결 확인</button>
          </div>

          {serverStatus === 'disconnected' && (
            <div style={{
              background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)',
              borderRadius: 8, padding: '10px 12px', fontSize: 11, color: '#fca5a5', lineHeight: 1.7,
            }}>
              <strong>서버 시작 방법:</strong><br />
              <code style={{ background: '#0f1117', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                cd ~/Downloads/xynaps-agent-office/server && npm start
              </code>
              <br />
              <span style={{ color: '#94a3b8' }}>외부 접속 시 ngrok 사용: </span>
              <code style={{ background: '#0f1117', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                ngrok http 3001
              </code>
              <span style={{ color: '#94a3b8' }}> → 위 URL란에 입력</span>
            </div>
          )}
        </div>

        <div style={{ fontSize: 11, color: '#475569', lineHeight: 1.7 }}>
          Max 구독 선택 시 로컬 서버가 Claude Max 구독 인증을 사용해 API 비용 없이 선택한 품질로 실행합니다.<br />
          다른 기기에서 데이터 조회·편집은 Supabase로 동기화되지만, AI 생성은 서버가 실행 중인 기기에서만 작동합니다.
        </div>
      </div>
    </div>
  )
}
