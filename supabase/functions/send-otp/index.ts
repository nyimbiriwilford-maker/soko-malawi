// supabase/functions/send-otp/index.ts
// Security: CORS allowlist, crypto OTP, code_hash storage, Turnstile CAPTCHA, rate limits
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const ALLOWED_ORIGINS = new Set([
  'https://soko-malawi.vercel.app',
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'http://127.0.0.1:4173',
])

const MAX_REQUESTS = 3
const WINDOW_MINUTES = 60
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

function generateOtp(): string {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return String(100000 + (buf[0] % 900000))
}

async function hashOtp(code: string, identifier: string): Promise<string> {
  const payload = `${identifier.toLowerCase().trim()}:${code}`
  const data = new TextEncoder().encode(payload)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

/** Cloudflare Turnstile server verify */
async function verifyTurnstile(token: string, ip: string | null): Promise<boolean> {
  const secret = Deno.env.get('TURNSTILE_SECRET_KEY')
  // If not configured, skip CAPTCHA (local/dev). Always set in production.
  if (!secret) {
    console.warn('[send-otp] TURNSTILE_SECRET_KEY not set — captcha skipped')
    return true
  }
  if (!token) return false

  const body = new URLSearchParams({
    secret,
    response: token,
  })
  if (ip) body.set('remoteip', ip)

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })
  if (!res.ok) return false
  const data = await res.json()
  return Boolean(data?.success)
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
    let body: { identifier?: string; captchaToken?: string; action?: string }
    try {
      body = await req.json()
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const ip =
      req.headers.get('cf-connecting-ip') ||
      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      null

    const captchaOk = await verifyTurnstile(body.captchaToken || '', ip)
    if (!captchaOk) {
      return new Response(JSON.stringify({ error: 'Captcha verification failed. Please try again.' }), {
        status: 403,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const raw = (body.identifier ?? '').trim()
    if (!raw) {
      return new Response(JSON.stringify({ error: 'Phone or email required' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const isPhone = /^\+?\d[\d\s\-]{6,14}$/.test(raw)
    const isEmail = EMAIL_RE.test(raw.toLowerCase())
    if (!isPhone && !isEmail) {
      return new Response(JSON.stringify({ error: 'Enter a valid phone number or email address' }), {
        status: 400,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const identifier = isEmail ? raw.toLowerCase() : raw.replace(/[\s\-]/g, '')
    const field = isPhone ? 'phone' : 'email'

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Signup: deny if the email is already registered (check via profiles mirror)
    if (isEmail && body.action !== 'reset') {
      const { data: existing, error: existingErr } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', identifier)
        .limit(1)

      if (!existingErr && existing && existing.length > 0) {
        return new Response(JSON.stringify({
          error: 'This email is already registered. Please sign in instead.',
        }), {
          status: 409,
          headers: { ...headers, 'Content-Type': 'application/json' },
        })
      }
    }

    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()
    const { count, error: countErr } = await supabase
      .from('otp_codes')
      .select('*', { count: 'exact', head: true })
      .eq(field, identifier)
      .gte('created_at', windowStart)

    if (countErr) {
      console.error('[send-otp] rate limit check failed')
      return new Response(JSON.stringify({ error: 'Unable to send code. Please try again.' }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    if ((count ?? 0) >= MAX_REQUESTS) {
      return new Response(JSON.stringify({
        error: `Too many attempts. Please wait ${WINDOW_MINUTES} minutes before requesting a new code.`,
      }), {
        status: 429,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    const code = generateOtp()
    const codeHash = await hashOtp(code, identifier)
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    await supabase
      .from('otp_codes')
      .update({ used: true })
      .eq(field, identifier)
      .eq('used', false)

    // Store hash only in code_hash; leave code null/empty when column allows
    const { error: insertError } = await supabase.from('otp_codes').insert({
      [field]: identifier,
      code_hash: codeHash,
      code: codeHash, // dual-write for DBs that still require code NOT NULL
      expires_at: expiresAt,
      used: false,
    })

    if (insertError) {
      console.error('[send-otp] insert failed')
      return new Response(JSON.stringify({ error: 'Unable to send code. Please try again.' }), {
        status: 500,
        headers: { ...headers, 'Content-Type': 'application/json' },
      })
    }

    if (isPhone) await sendSMS(identifier, code)
    else await sendEmailBrevo(identifier, code)

    return new Response(JSON.stringify({
      success: true,
      method: isPhone ? 'sms' : 'email',
      attemptsRemaining: MAX_REQUESTS - ((count ?? 0) + 1),
    }), {
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  } catch {
    console.error('[send-otp] unexpected error')
    return new Response(JSON.stringify({ error: 'Failed to send OTP' }), {
      status: 500,
      headers: { ...headers, 'Content-Type': 'application/json' },
    })
  }
})

async function sendSMS(phone: string, code: string) {
  let to = phone.trim().replace(/[\s\-]/g, '')
  if (!to.startsWith('+')) to = '+265' + to.replace(/^0/, '')

  const body = new URLSearchParams({
    username: Deno.env.get('AT_USERNAME')!,
    to,
    message: `Your Soko Malawi code is: ${code}. It expires in 10 minutes. Do not share it.`,
  })

  const res = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      apiKey: Deno.env.get('AT_API_KEY')!,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body,
  })
  if (!res.ok) {
    console.error('[send-otp] SMS provider error', res.status)
    throw new Error('SMS failed')
  }
}

async function sendEmailBrevo(email: string, code: string) {
  const safeCode = code.replace(/[^\d]/g, '')
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': Deno.env.get('BREVO_API_KEY')!,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sender: { name: 'Soko Malawi', email: 'nyimbiriwilford@gmail.com' },
      to: [{ email }],
      subject: 'Your Soko Malawi verification code',
      htmlContent: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="color:#1a7a4a;">Soko Malawi</h2>
          <p>Your verification code is:</p>
          <div style="font-size:48px;font-weight:900;letter-spacing:10px;color:#0f1410;margin:24px 0;">
            ${safeCode}
          </div>
          <p style="color:#637068;font-size:14px;">
            This code expires in <strong>10 minutes</strong>.
            If you didn't request this, ignore this email.
          </p>
        </div>
      `,
    }),
  })
  if (!res.ok) {
    console.error('[send-otp] email provider error', res.status)
    throw new Error('Email failed')
  }
}
