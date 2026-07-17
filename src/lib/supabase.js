import { createClient } from '@supabase/supabase-js'

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()

/** True when build-time Vite env includes a real Supabase project. */
export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

if (!isSupabaseConfigured) {
  // Missing env white-screens createClient('') — warn and use a inert placeholder
  // so the UI can still render (auth/API calls will fail until env is set on Vercel).
  console.error(
    '[SokoMw] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
    'Set them in the Vercel project Environment Variables and redeploy.',
  )
}

/**
 * Browser Supabase client.
 * - PKCE for safer OAuth (no implicit token in URL hash)
 * - Session persisted in localStorage by supabase-js (httpOnly cookies require SSR)
 * - detectSessionInUrl for OAuth callback
 *
 * Never pass empty strings — supabase-js throws "supabaseUrl is required" and
 * blanks the whole app (white page).
 */
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseAnonKey : 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.e30.placeholder',
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      flowType: 'pkce',
      // Do not expose session details in URL after parse
      storage: typeof window !== 'undefined' ? window.localStorage : undefined,
    },
  },
)
