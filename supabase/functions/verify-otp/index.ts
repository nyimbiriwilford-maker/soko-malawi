// supabase/functions/verify-otp/index.ts
// Security: CORS allowlist, code_hash compare, profiles.email lookup, consume/peek
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = new Set([
  'https://soko-malawi.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
])

const MAX_VERIFY_ATTEMPTS = 5
const WINDOW_MINUTES = 10
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function corsHeaders(req: Request) {
  const origin = req.headers.get('Origin') || ''
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : 'https://soko-malawi.vercel.app'
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin',
  }
}

async function hashOtp(code: string, identifier: string): Promise<string> {
  const payload = `${identifier.toLowerCase().trim()}:${code}`
  const data = new TextEncoder().encode(payload)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let out = 0
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return out === 0
}

/**
 * Prefer profiles.email unique index (O(1) lookup).
 * Fallback: filtered auth admin list (bounded).
 */
async function findUserIdByEmail(
  supabase: ReturnType<typeof createClient>,
  supabaseUrl: string,
  serviceKey: string,
  email: string
): Promise<string | null> {
  const target = email.toLowerCase()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id')
    .eq('email', target)
    .maybeSingle()

  if (profile?.id) return profile.id

  // Fallback for rows not yet backfilled
  const url =
    `${supabaseUrl}/auth/v1/admin/users?page=1&per_page=5` +
    `&filter=${encodeURIComponent(target)}`
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
    },
  })
  if (!res.ok) return null
  const data = await res.json()
  const users = data?.users ?? []
  const match = Array.isArray(users)
    ? users.find((u: { email?: string }) => (u.email || '').toLowerCase() === target)
    : null
  return match?.id ?? null
}

serve(async (req) => {
  const headers = corsHeaders(req)
  if (req.method === 'OPTIONS') return new Response('ok', { headers })
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }

  try {
    let body: {
      identifier?: string
      code?: string
      newPassword?: string
      consume?: boolean
      action?: string
      password?: string
      username?: string
    }
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const rawId = (body.identifier ?? '').trim()
    const code = String(body.code ?? '').replace(/\D/g, '')
    const newPassword = body.newPassword
    const isSignup = body.action === 'signup'
    const consume = body.consume !== false || Boolean(newPassword) || isSignup

    if (!rawId || !code || !/^\d{6}$/.test(code)) {
      return new Response(JSON.stringify({ error: 'Invalid or expired code. Please request a new one.' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const isEmail = EMAIL_RE.test(rawId.toLowerCase())
    const isPhone = !isEmail && /^\+?\d[\d\s\-]{6,14}$/.test(rawId)
    if (!isEmail && !isPhone) {
      return new Response(JSON.stringify({ error: 'Enter a valid phone number or email address' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const identifier = isEmail ? rawId.toLowerCase() : rawId.replace(/[\s\-]/g, '')
    const field = isPhone ? 'phone' : 'email'
    const codeHash = await hashOtp(code, identifier)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, serviceKey)

    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()
    const { count: failCount } = await supabase
      .from('otp_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('success', false)
      .gte('created_at', windowStart)

    if ((failCount ?? 0) >= MAX_VERIFY_ATTEMPTS) {
      return new Response(JSON.stringify({
        error: 'Too many incorrect attempts. Please request a new code.',
      }), {
        status: 429,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const { data: otpRows, error: fetchError } = await supabase
      .from('otp_codes')
      .select('*')
      .eq(field, identifier)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (fetchError) {
      console.error('[verify-otp] fetch failed')
      return new Response(JSON.stringify({ error: 'Verification failed' }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const row = otpRows?.[0]
    const storedHash = row?.code_hash ? String(row.code_hash) : ''
    const storedCode = row?.code ? String(row.code) : ''

    // Prefer code_hash; accept dual-written hash in `code`; legacy plaintext 6-digit during migration
    const match =
      row &&
      (
        (storedHash && timingSafeEqual(storedHash, codeHash)) ||
        (storedCode.length === 64 && timingSafeEqual(storedCode, codeHash)) ||
        (storedCode.length === 6 && timingSafeEqual(storedCode, code))
      )

    if (!match) {
      await supabase.from('otp_attempts').insert({ identifier, success: false })
      return new Response(JSON.stringify({ error: 'Invalid or expired code. Please request a new one.' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    await supabase.from('otp_attempts').insert({ identifier, success: true })

    // ── Signup: create email-confirmed user via admin API ──
    if (isSignup) {
      const password = body.password
      const username = (body.username ?? '').trim()
      if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }
      if (username.length < 3 || username.length > 20) {
        return new Response(JSON.stringify({ error: 'Choose a valid username' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }

      // Consume OTP before creating user
      await supabase.from('otp_codes').update({ used: true }).eq('id', row.id)

      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: identifier,
        password,
        email_confirm: true,
        user_metadata: { full_name: username },
      })

      if (createErr) {
        const msg = (createErr.message || '').toLowerCase()
        // User may already exist from a prior attempt
        if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
          return new Response(JSON.stringify({ success: true, alreadyExists: true }), {
            headers: { ...headers, 'Content-Type': 'application/json' },
          })
        }
        console.error('[verify-otp] createUser failed')
        return new Response(JSON.stringify({ error: 'Could not create account. Please try again.' }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }

      const userId = created?.user?.id
      if (userId) {
        await supabase.from('profiles').upsert({
          id: userId,
          full_name: username,
          email: identifier,
          updated_at: new Date().toISOString(),
        })
        await supabase.from('users').upsert(
          { id: userId, name: username },
          { onConflict: 'id' }
        )
      }

      return new Response(JSON.stringify({ success: true, signup: true, userId }), {
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    if (newPassword) {
      if (typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
        return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
          status: 400,
          headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }

      let userId: string | null = null
      if (isEmail) {
        userId = await findUserIdByEmail(supabase, supabaseUrl, serviceKey, identifier)
      } else {
        const { data: profileRow } = await supabase
          .from('profiles')
          .select('id')
          .eq('phone', identifier)
          .maybeSingle()
        userId = profileRow?.id ?? null
      }

      if (!userId) {
        return new Response(JSON.stringify({
          error: 'No account found for this ' + (isPhone ? 'phone number' : 'email'),
        }), {
          status: 404,
          headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }

      const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, {
        password: newPassword,
      })
      if (updateErr) {
        console.error('[verify-otp] password update failed')
        return new Response(JSON.stringify({ error: 'Password update failed. Please try again.' }), {
          status: 500,
          headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }

      await supabase.from('otp_codes').delete().eq(field, identifier)
      await supabase.from('otp_attempts').delete().eq('identifier', identifier)

      return new Response(JSON.stringify({ success: true, passwordUpdated: true }), {
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    if (consume) {
      await supabase.from('otp_codes').update({ used: true }).eq('id', row.id)
    }

    return new Response(JSON.stringify({
      success: true,
      passwordUpdated: false,
      consumed: consume,
    }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  } catch {
    console.error('[verify-otp] unexpected error')
    return new Response(JSON.stringify({ error: 'Verification failed' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }
})
