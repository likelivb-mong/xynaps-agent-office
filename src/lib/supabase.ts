import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// 보관(보기 전용) 모드: Supabase 없이 이 브라우저에 저장된 데이터만 보여준다.
// 다시 편집·동기화가 필요하면 Vercel 환경변수 VITE_ARCHIVE_MODE=false 로 되돌린다.
export const isArchiveMode = import.meta.env.VITE_ARCHIVE_MODE !== 'false'

export const isSupabaseConfigured = !isArchiveMode && Boolean(supabaseUrl && supabaseAnonKey)

if (isArchiveMode) {
  console.info('[supabase] archive mode — read-only, no sync')
} else if (!isSupabaseConfigured) {
  console.warn('[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY missing — cross-device sync disabled')
}

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!)
  : null

export type SupabaseUser = {
  id: string
  email: string
  displayName: string
}
