import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useSettings, type ModelTier } from '../contexts/SettingsContext'

const TIERS: Array<{
  id: ModelTier
  label: string
  sub: string
  models: string
  cost: string
  color: string
  note?: string
}> = [
  {
    id: '절약',
    label: '절약',
    sub: 'Economy',
    models: 'Sonnet 4.6 전용 · thinking 없음',
    cost: '약 1,500~3,000원/회',
    color: '#22c55e',
  },
  {
    id: '균형',
    label: '균형',
    sub: 'Balanced',
    models: '보고서 Opus 4.7 · 나머지 Sonnet 4.6 · thinking(light)',
    cost: '약 14,000~20,000원/회',
    color: '#6f7dff',
  },
  {
    id: '최고',
    label: '최고',
    sub: 'Maximum',
    models: '전 단계 Opus 4.7 · 최대 thinking',
    cost: '약 32,000~45,000원/회',
    color: '#f59e0b',
  },
  {
    id: 'Max구독연결',
    label: 'Max 구독',
    sub: 'Free (Max subscription)',
    models: 'Claude Max Pro 구독 사용 · 로컬 서버 필요',
    cost: '무료',
    color: '#ec4899',
    note: '로컬 서버(server/index.js)가 실행 중이어야 합니다.',
  },
]

export function SettingsPage() {
  const { settings, updateSettings } = useSettings()
  const [localServerStatus, setLocalServerStatus] = useState<'checking' | 'connected' | 'disconnected'>('disconnected')

  useEffect(() => {
    if (settings.modelTier === 'Max구독연결') checkLocalServer()
  }, [settings.modelTier])

  async function checkLocalServer() {
    setLocalServerStatus('checking')
    try {
      const res = await fetch('http://localhost:3001/api/health', {
        signal: AbortSignal.timeout(2000),
      })
      setLocalServerStatus(res.ok ? 'connected' : 'disconnected')
    } catch {
      setLocalServerStatus('disconnected')
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117' }}>
      {/* Header */}
      <header style={{
        padding: '16px 28px',
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Link to="/" style={{
            color: 'var(--text-muted)', textDecoration: 'none',
            fontSize: 12, display: 'flex', alignItems: 'center', gap: 5,
          }}>
            ← 홈으로
          </Link>
          <span style={{ color: 'var(--border)', fontSize: 12 }}>|</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
            설정
          </span>
        </div>
      </header>

      <div style={{ maxWidth: 640, margin: '0 auto', padding: '40px 24px' }}>
        {/* Section: AI 품질 */}
        <div style={{ marginBottom: 40 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', color: '#64748b', marginBottom: 16 }}>
            AI 품질 설정
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {TIERS.map(tier => {
              const active = settings.modelTier === tier.id
              return (
                <button
                  key={tier.id}
                  onClick={() => {
                    updateSettings({ modelTier: tier.id })
                    if (tier.id === 'Max구독연결') checkLocalServer()
                  }}
                  style={{
                    background: active ? 'rgba(111,125,255,0.08)' : '#1a1d26',
                    border: `1px solid ${active ? tier.color : '#2a2d36'}`,
                    borderRadius: 12,
                    padding: '16px 18px',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    transition: 'border-color 0.15s, background 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    {/* Radio dot */}
                    <div style={{
                      width: 18, height: 18, borderRadius: '50%',
                      border: `2px solid ${active ? tier.color : '#3f4458'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      {active && (
                        <div style={{
                          width: 9, height: 9, borderRadius: '50%',
                          background: tier.color,
                        }} />
                      )}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 14, fontWeight: 700, color: active ? '#e2e8f0' : '#94a3b8' }}>
                          {tier.label}
                        </span>
                        <span style={{ fontSize: 11, color: '#475569' }}>{tier.sub}</span>
                      </div>
                      <div style={{ fontSize: 11, color: '#475569', marginTop: 3, lineHeight: 1.5 }}>
                        {tier.models}
                      </div>
                      {tier.note && tier.id === 'Max구독연결' && active && (
                        <div style={{
                          fontSize: 11, color: '#f59e0b', marginTop: 5,
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}>
                          <span>⚠</span> {tier.note}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span style={{
                      fontSize: 12, fontWeight: 600,
                      color: tier.id === 'Max구독연결' ? '#22c55e' : tier.id === '절약' ? '#22c55e' : tier.color,
                    }}>
                      {tier.cost}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Max구독 local server status */}
        {settings.modelTier === 'Max구독연결' && (
          <div style={{
            background: '#1a1d26',
            border: '1px solid #2a2d36',
            borderRadius: 12,
            padding: '18px 20px',
            marginBottom: 32,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#64748b', marginBottom: 12 }}>
              로컬 서버 상태
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{
                  width: 8, height: 8, borderRadius: '50%',
                  background: localServerStatus === 'connected' ? '#22c55e'
                    : localServerStatus === 'checking' ? '#f59e0b'
                    : '#ef4444',
                }} />
                <span style={{ fontSize: 13, color: '#e2e8f0' }}>
                  {localServerStatus === 'connected' ? '연결됨 · http://localhost:3001'
                    : localServerStatus === 'checking' ? '확인 중...'
                    : '연결 안됨'}
                </span>
              </div>
              <button
                onClick={checkLocalServer}
                disabled={localServerStatus === 'checking'}
                style={{
                  padding: '5px 12px', borderRadius: 7,
                  border: '1px solid #2f3447',
                  background: 'transparent', color: '#64748b',
                  fontSize: 11, cursor: 'pointer',
                }}
              >
                재확인
              </button>
            </div>
            {localServerStatus === 'disconnected' && (
              <div style={{
                marginTop: 12,
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8, padding: '10px 12px',
                fontSize: 12, color: '#fca5a5', lineHeight: 1.6,
              }}>
                <strong>서버 시작 방법:</strong><br />
                <code style={{ background: '#0f1117', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>
                  cd ~/Downloads/xynaps-agent-office-v2/server && npm install && node index.js
                </code>
              </div>
            )}
          </div>
        )}

        {/* Info box */}
        <div style={{
          background: 'rgba(111,125,255,0.06)',
          border: '1px solid rgba(111,125,255,0.15)',
          borderRadius: 10,
          padding: '14px 16px',
          fontSize: 12, color: '#818cf8', lineHeight: 1.7,
        }}>
          <strong>Max 구독 연결 방법</strong><br />
          로컬 서버가 Claude Code(Max 구독)의 인증을 사용해 API 비용 없이 AI를 실행합니다.<br />
          다른 기기에서 데이터 조회·편집은 Supabase로 자동 동기화되어 가능하지만,
          AI 생성은 서버가 실행 중인 기기에서만 작동합니다.
        </div>
      </div>
    </div>
  )
}
