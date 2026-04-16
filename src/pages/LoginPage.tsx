import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth, USER_LIST } from '../contexts/AuthContext'

export function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [selectedEmail, setSelectedEmail] = useState<string | null>(null)
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedEmail) return
    setError(null)
    setLoading(true)
    const { error } = await signIn(selectedEmail, pin)
    setLoading(false)
    if (error) {
      setError(error)
      setPin('')
    } else {
      navigate('/')
    }
  }

  function handleSelectUser(email: string) {
    setSelectedEmail(email)
    setPin('')
    setError(null)
  }

  const selectedUser = USER_LIST.find(u => u.email === selectedEmail)

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f1117',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'inherit',
    }}>
      <div style={{ width: 360, display: 'flex', flexDirection: 'column', gap: 32 }}>
        {/* Logo / Title */}
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: '#fff', letterSpacing: '-1px' }}>
            XYNAPS
          </div>
          <div style={{ fontSize: 13, color: '#888', marginTop: 4 }}>
            Agent Office
          </div>
        </div>

        {/* User selection */}
        <div>
          <div style={{ fontSize: 12, color: '#666', marginBottom: 10, textAlign: 'center' }}>
            사용자를 선택하세요
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            {USER_LIST.map(user => {
              const isSelected = selectedEmail === user.email
              return (
                <button
                  key={user.email}
                  onClick={() => handleSelectUser(user.email)}
                  style={{
                    flex: 1,
                    padding: '20px 12px',
                    borderRadius: 12,
                    border: `2px solid ${isSelected ? '#7c5cff' : '#2a2d3a'}`,
                    background: isSelected ? 'rgba(124,92,255,0.12)' : '#1a1d27',
                    color: isSelected ? '#c4b5fd' : '#aaa',
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <div style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    background: isSelected ? '#7c5cff' : '#2a2d3a',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 18,
                    fontWeight: 700,
                    color: isSelected ? '#fff' : '#666',
                    transition: 'all 0.15s',
                  }}>
                    {user.displayName[0]}
                  </div>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{user.displayName}</span>
                </button>
              )
            })}
          </div>
        </div>

        {/* PIN input */}
        {selectedEmail && (
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 8, textAlign: 'center' }}>
                {selectedUser?.displayName}의 PIN 번호를 입력하세요
              </div>
              <input
                type="password"
                inputMode="numeric"
                value={pin}
                onChange={e => { setPin(e.target.value); setError(null) }}
                placeholder="PIN"
                autoFocus
                maxLength={20}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  borderRadius: 10,
                  border: `1.5px solid ${error ? '#f87171' : '#2a2d3a'}`,
                  background: '#1a1d27',
                  color: '#fff',
                  fontSize: 18,
                  letterSpacing: '0.25em',
                  textAlign: 'center',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              {error && (
                <div style={{ fontSize: 12, color: '#f87171', marginTop: 6, textAlign: 'center' }}>
                  {error}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={!pin || loading}
              style={{
                padding: '14px',
                borderRadius: 10,
                border: 'none',
                background: !pin || loading ? '#2a2d3a' : '#7c5cff',
                color: !pin || loading ? '#555' : '#fff',
                fontSize: 15,
                fontWeight: 700,
                cursor: !pin || loading ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {loading ? '로그인 중...' : '입장'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
