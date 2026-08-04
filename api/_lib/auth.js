import { createClient } from '@supabase/supabase-js'

const supabaseUrl = () => process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL

export const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Apply CORS headers (used for dev/localhost:5173 cross-origin). */
export function applyCORS(res) {
  for (const [k, v] of Object.entries(CORS)) res.setHeader(k, v)
}

/** Handle OPTIONS preflight for cross-origin requests (localhost:5173 dev). */
export function handleOptions(req, res) {
  if (req.method !== 'OPTIONS') return false
  res.status(200)
  applyCORS(res)
  res.end('ok')
  return true
}

/** Respond with JSON status + body + CORS headers. */
export function respond(res, status, body) {
  res.setHeader('Content-Type', 'application/json')
  applyCORS(res)
  res.status(status).json(body)
}

/** Auth token from the Authorization: Bearer <token> header. */
export function getBearerToken(req) {
  return (req.headers.authorization || '').replace('Bearer ', '').trim()
}

/** Browser-safe Supabase client from the anon key (used only server-side for getUser). */
export function anonClient() {
  return createClient(
    supabaseUrl(),
    process.env.VITE_SUPABASE_ANON_KEY,
  )
}

/** Service-role client to bypass RLS — NEVER exposed to the client bundle. */
export function adminClient() {
  return createClient(
    supabaseUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  )
}

/**
 * Verify the caller is logged in, mirroring the old verify_jwt=true behaviour.
 * Returns the Supabase user object, or null (after sending a 401).
 */
export async function requireAuth(req, res) {
  const token = getBearerToken(req)
  if (!token) {
    respond(res, 401, { error: 'Missing authorization header' })
    return null
  }
  const { data, error } = await anonClient().auth.getUser(token)
  if (error || !data?.user) {
    respond(res, 401, { error: 'Invalid session' })
    return null
  }
  return data?.user ?? null
}