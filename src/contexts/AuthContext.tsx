import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import type { AppUser } from '../types'
import type { Session } from '@supabase/supabase-js'

// 허용된 사용자 목록 (이메일 → 표시 이름 매핑)
export const ALLOWED_USERS: Record<string, string> = {
  [import.meta.env.VITE_USER_LIBRENA_EMAIL as string]: 'levlena',
  [import.meta.env.VITE_USER_SHAIHU_EMAIL as string]: 'shywho',
}

// 로그인 화면에서 선택할 수 있는 사용자 목록
export const USER_LIST = [
  { displayName: 'levlena', email: import.meta.env.VITE_USER_LIBRENA_EMAIL as string },
  { displayName: 'shywho', email: import.meta.env.VITE_USER_SHAIHU_EMAIL as string },
]

interface AuthContextValue {
  user: AppUser | null
  session: Session | null
  loading: boolean
  signIn: (email: string, pin: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }
    // 현재 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session?.user) {
        const displayName = ALLOWED_USERS[session.user.email ?? ''] ?? session.user.email ?? ''
        setUser({ id: session.user.id, email: session.user.email ?? '', displayName })
      }
      setLoading(false)
    })

    // 세션 변경 감지
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session?.user) {
        const displayName = ALLOWED_USERS[session.user.email ?? ''] ?? session.user.email ?? ''
        setUser({ id: session.user.id, email: session.user.email ?? '', displayName })
      } else {
        setUser(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function signIn(email: string, pin: string): Promise<{ error: string | null }> {
    if (!ALLOWED_USERS[email]) {
      return { error: '접근 권한이 없습니다.' }
    }
    if (!supabase) return { error: 'Supabase가 설정되지 않았습니다.' }
    const { error } = await supabase.auth.signInWithPassword({ email, password: pin })
    if (error) return { error: 'PIN이 올바르지 않습니다.' }
    return { error: null }
  }

  async function signOut() {
    if (supabase) await supabase.auth.signOut()
    setUser(null)
    setSession(null)
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
