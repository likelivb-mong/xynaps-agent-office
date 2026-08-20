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

const SERVER_DIR = '~/Downloads/xynaps-agent-office/server'

const CERT_CMD = `cd ${SERVER_DIR} && openssl req -x509 -newkey rsa:2048 -sha256 -days 3650 -nodes -keyout localhost-key.pem -out localhost.pem -subj "/CN=localhost" -addext "subjectAltName=DNS:localhost,IP:127.0.0.1"`

const START_CMD = `cd ${SERVER_DIR} && npm start`

// 최초 1회만 — 이 맥에서 처음 쓸 때. 인증서(.pem)는 보안상 깃허브에 포함되지 않아 기기마다 직접 만들어야 한다.
const SETUP_STEPS = [
  {
    title: '폴더 받기',
    note: '폴더가 이미 있으면 건너뛰세요.',
    cmd: 'git clone https://github.com/likelivb-mong/xynaps-agent-office.git ~/Downloads/xynaps-agent-office',
  },
  {
    title: '설치',
    cmd: `cd ${SERVER_DIR} && npm install`,
  },
  {
    title: 'HTTPS 인증서 만들기',
    note: '깃허브에 올라가지 않는 파일이라 기기마다 한 번씩 만들어야 합니다.',
    cmd: CERT_CMD,
  },
]

function CopyableCommand({ cmd }: { cmd: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, marginTop: 4 }}>
      <code style={{
        flex: 1, background: '#0f1117', padding: '5px 8px', borderRadius: 4,
        fontSize: 10.5, color: '#cbd5e1', lineHeight: 1.6,
        wordBreak: 'break-all', whiteSpace: 'pre-wrap',
      }}>{cmd}</code>
      <button
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(cmd)
          } catch {
            // 클립보드 권한이 없는 브라우저 — 임시 textarea 로 대체
            const ta = document.createElement('textarea')
            ta.value = cmd
            document.body.appendChild(ta)
            ta.select()
            document.execCommand('copy')
            document.body.removeChild(ta)
          }
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        }}
        style={{
          padding: '4px 8px', borderRadius: 5, border: '1px solid #2f3447',
          background: 'transparent', color: copied ? '#22c55e' : '#64748b',
          fontSize: 10, cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >{copied ? '복사됨' : '복사'}</button>
    </div>
  )
}

export function SettingsPage() {
  const { settings, updateSettings } = useSettings()
  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'disconnected'>('disconnected')
  const [urlInput, setUrlInput] = useState(settings.localServerUrl || 'https://localhost:3001')

  useEffect(() => { checkLocalServer() }, [])

  async function checkLocalServer() {
    const url = settings.localServerUrl || 'https://localhost:3001'
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
              placeholder="https://localhost:3001"
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
              <strong style={{ fontSize: 12 }}>매번 — AI 쓰기 전에 서버 켜기</strong>
              <div style={{ color: '#94a3b8', marginTop: 2 }}>
                맥의 <strong style={{ color: '#cbd5e1' }}>터미널</strong> 앱을 열고 아래를 붙여넣어 실행하세요.
                실행 후 <strong style={{ color: '#cbd5e1' }}>터미널 창을 닫지 마세요</strong> — 닫으면 서버가 꺼집니다.
              </div>
              <CopyableCommand cmd={START_CMD} />
              <div style={{ color: '#94a3b8', marginTop: 6 }}>
                그 다음 위 <strong style={{ color: '#cbd5e1' }}>[연결 확인]</strong> 버튼을 누르면 "연결됨"으로 바뀝니다.
              </div>

              <div style={{ height: 1, background: 'rgba(239,68,68,0.18)', margin: '12px 0' }} />

              <details>
                <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#fca5a5' }}>
                  처음 쓰는 맥이거나 위 명령이 안 될 때 — 최초 1회 설정 (펼치기)
                </summary>

                <div style={{ marginTop: 8 }}>
                  <div style={{ color: '#94a3b8', marginBottom: 8 }}>
                    <code style={{ background: '#0f1117', padding: '1px 5px', borderRadius: 3 }}>no such file or directory</code> 오류가 나면
                    폴더가 없는 것이고, <code style={{ background: '#0f1117', padding: '1px 5px', borderRadius: 3 }}>localhost.pem</code> 오류가 나면
                    인증서가 없는 것입니다. 아래를 순서대로 한 번씩 실행하세요.
                  </div>

                  {SETUP_STEPS.map((step, i) => (
                    <div key={step.title} style={{ marginBottom: 10 }}>
                      <div style={{ color: '#e2e8f0', fontWeight: 600 }}>{i + 1}. {step.title}</div>
                      {step.note && <div style={{ color: '#94a3b8' }}>{step.note}</div>}
                      <CopyableCommand cmd={step.cmd} />
                    </div>
                  ))}

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ color: '#e2e8f0', fontWeight: 600 }}>4. 서버 켜기</div>
                    <CopyableCommand cmd={START_CMD} />
                  </div>

                  <div style={{ marginBottom: 10 }}>
                    <div style={{ color: '#e2e8f0', fontWeight: 600 }}>5. 크롬에서 인증서 1회 허용</div>
                    <div style={{ color: '#94a3b8' }}>
                      크롬 새 탭에서{' '}
                      <code style={{ background: '#0f1117', padding: '1px 5px', borderRadius: 3 }}>https://localhost:3001/api/health</code>{' '}
                      접속 → 빨간 경고 화면에서 <strong style={{ color: '#cbd5e1' }}>[고급]</strong> →{' '}
                      <strong style={{ color: '#cbd5e1' }}>[localhost(안전하지 않음)으로 이동]</strong> 클릭.{' '}
                      <code style={{ background: '#0f1117', padding: '1px 5px', borderRadius: 3 }}>{'{"ok":true}'}</code>{' '}
                      가 보이면 완료입니다. 내 컴퓨터 안에서만 도는 서버라 안전하며, 이 승인은 한 번만 하면 됩니다.
                    </div>
                  </div>

                  <div style={{ color: '#94a3b8', marginTop: 12 }}>
                    <strong style={{ color: '#e2e8f0' }}>전제 조건:</strong> Claude Max 구독으로 로그인된{' '}
                    <code style={{ background: '#0f1117', padding: '1px 5px', borderRadius: 3 }}>claude</code> CLI가 이 맥에 설치돼 있어야 합니다.
                    이미지·PDF를 첨부하는 작업은 Max 구독으로 처리되지 않아{' '}
                    <code style={{ background: '#0f1117', padding: '1px 5px', borderRadius: 3 }}>ANTHROPIC_API_KEY</code>가 따로 필요합니다.
                  </div>

                  <div style={{ color: '#94a3b8', marginTop: 8 }}>
                    <strong style={{ color: '#e2e8f0' }}>다른 기기에서 접속하려면:</strong>{' '}
                    <code style={{ background: '#0f1117', padding: '1px 5px', borderRadius: 3 }}>ngrok http 3001</code>{' '}
                    실행 후 나온 주소를 위 URL란에 입력하세요.
                  </div>
                </div>
              </details>
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
