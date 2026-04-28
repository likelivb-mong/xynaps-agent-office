import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type ModelQuality = '절약' | '균형' | '최고'

export interface AppSettings {
  modelQuality: ModelQuality
  useMax: boolean
  localServerUrl: string
}

export const SETTINGS_KEY = 'xynaps_v2_settings'
// 로컬 서버는 self-signed cert 로 HTTPS 만 listen 하므로 http:// 로 호출하면 즉시 실패.
// 또한 Chrome 의 Private Network Access(PNA) 정책상 공개 오리진 → loopback 접근에는
// 추가 preflight 가 필요하며, http→loopback 은 거의 항상 차단됨.
export const DEFAULT_SETTINGS: AppSettings = { modelQuality: '균형', useMax: false, localServerUrl: 'https://localhost:3001' }

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    let mutated = false
    // migrate legacy modelTier field
    if (parsed.modelTier && !parsed.modelQuality) {
      const tier = parsed.modelTier
      parsed.modelQuality = tier === 'Max구독연결' ? '최고' : (tier ?? '균형')
      parsed.useMax = tier === 'Max구독연결'
      mutated = true
    }
    // legacy 'http://localhost:3001' 사용자는 자동 https:// 로 마이그레이션.
    // 직접 입력한 ngrok 등 외부 URL 은 그대로 둠.
    if (parsed.localServerUrl === 'http://localhost:3001') {
      parsed.localServerUrl = 'https://localhost:3001'
      mutated = true
    }
    // 마이그레이션 결과를 localStorage 에 즉시 persist — 그렇지 않으면 api.ts 의
    // getServerUrl() 처럼 React state 를 거치지 않고 localStorage 를 직접 읽는
    // 코드가 다음 호출에서 옛 값을 그대로 쓰게 됨(이번 puzzle 실패의 직접 원인).
    if (mutated) {
      try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(parsed)) } catch { /* ignore quota */ }
    }
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch { return DEFAULT_SETTINGS }
}

interface SettingsContextValue {
  settings: AppSettings
  updateSettings: (patch: Partial<AppSettings>) => void
}

const SettingsContext = createContext<SettingsContextValue | null>(null)

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings)

  const updateSettings = useCallback((patch: Partial<AppSettings>) => {
    setSettings(prev => {
      const next = { ...prev, ...patch }
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
      return next
    })
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  if (!ctx) throw new Error('useSettings must be used within SettingsProvider')
  return ctx
}
