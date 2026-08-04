import { supabase } from './supabase'

/**
 * Call one of the SokoMW Vercel serverless AI functions.
 * Mirrors the old supabase.functions.invoke() contract but hits /api/* on the
 * same origin and forwards the user's Supabase access token in a Bearer header
 * so the server can verify the session (verify_jwt=true equivalent).
 *
 * Returns { data, error } — data when res.ok, error = { message, status }.
 */
export async function invokeApi(fn, { body } = {}) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token || ''

    const res = await fetch(`/api/${fn}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    })

    if (!res.ok) {
      let message = `Request failed with status ${res.status}`
      try {
        const j = await res.json()
        if (j && j.error) message = j.error
      } catch { /* non-JSON body */ }
      return { data: null, error: { message, status: res.status } }
    }

    const data = await res.json()
    return { data, error: null }
  } catch (err) {
    return { data: null, error: { message: err.message || 'Network error' } }
  }
}