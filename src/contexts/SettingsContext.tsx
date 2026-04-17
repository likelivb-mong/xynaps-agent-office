import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

export type ModelQuality = '절약' | '균형' | '최고'

export interface AppSettings {
  modelQuality: ModelQuality
  useMax: boolean
}

export const SETTINGS_KEY = 'xynaps_v2_settings'
export const DEFAULT_SETTINGS: AppSettings = { modelQuality: '균형', useMax: false }

export function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw)
    // migrate legacy modelTier field
    if (parsed.modelTier && !parsed.modelQuality) {
      const tier = parsed.modelTier
      parsed.modelQuality = tier === 'Max구독연결' ? '최고' : (tier ?? '균형')
      parsed.useMax = tier === 'Max구독연결'
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
