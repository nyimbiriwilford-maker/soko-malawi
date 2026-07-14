import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly in development; avoid creating a half-broken client
  console.warn('[SokoMw] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY')
}

/**
 * Browser Supabase client.
 * - PKCE for safer OAuth (no implicit token in URL hash)
 * - Session persisted in localStorage by supabase-js (httpOnly cookies require SSR)
 * - detectSessionInUrl for OAuth callback
 */
export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce',
    // Do not expose session details in URL after parse
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
})
