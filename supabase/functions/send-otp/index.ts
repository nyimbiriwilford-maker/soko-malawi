// supabase/functions/send-otp/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Rate limit config ─────────────────────────────────────
const MAX_REQUESTS   = 3    // max OTP requests
const WINDOW_MINUTES = 60   // per this many minutes

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { identifier } = await req.json()

    if (!identifier) {
      return new Response(JSON.stringify({ error: 'Phone or email required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const isPhone = /^\+?\d[\d\s\-]{6,14}$/.test(identifier.trim())
    const isEmail = identifier.includes('@')

    if (!isPhone && !isEmail) {
      return new Response(JSON.stringify({ error: 'Enter a valid phone number or email address' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const field = isPhone ? 'phone' : 'email'

    // ── Rate limit check ─────────────────────────────────
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()

    const { count, error: countErr } = await supabase
      .from('otp_codes')
      .select('*', { count: 'exact', head: true })
      .eq(field, identifier)
      .gte('created_at', windowStart)

    if (countErr) throw new Error('Rate limit check failed: ' + countErr.message)

    if ((count ?? 0) >= MAX_REQUESTS) {
      return new Response(JSON.stringify({
        error: `Too many attempts. Please wait ${WINDOW_MINUTES} minutes before requesting a new code.`
      }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Generate OTP ──────────────────────────────────────
    const code      = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString()

    // Invalidate previous unused OTPs for this identifier
    await supabase
      .from('otp_codes')
      .update({ used: true })
      .eq(field, identifier)
      .eq('used', false)

    const { error: insertError } = await supabase.from('otp_codes').insert({
      [field]: identifier,
      code,
      expires_at: expiresAt,
    })

    if (insertError) throw new Error('Failed to save OTP: ' + insertError.message)

    // ── Send OTP ──────────────────────────────────────────
    if (isPhone) {
      await sendSMS(identifier, code)
    } else {
      await sendEmailBrevo(identifier, code)
    }

    // Tell the client how many attempts remain
    const remaining = MAX_REQUESTS - ((count ?? 0) + 1)

    return new Response(JSON.stringify({
      success: true,
      method: isPhone ? 'sms' : 'email',
      attemptsRemaining: remaining,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('[send-otp]', err)
    return new Response(JSON.stringify({ error: err.message || 'Failed to send OTP' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// ── Africa's Talking SMS ──────────────────────────────────
async function sendSMS(phone: string, code: string) {
  let to = phone.trim().replace(/[\s\-]/g, '')
  if (!to.startsWith('+')) to = '+265' + to.replace(/^0/, '')

  const AT_KEY      = Deno.env.get('AT_API_KEY')!
  const AT_USERNAME = Deno.env.get('AT_USERNAME')!

  const body = new URLSearchParams({
    username: AT_USERNAME,
    to,
    message: `Your Soko Malawi code is: ${code}. It expires in 10 minutes. Do not share it.`,
  })

  const res = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      'apiKey': AT_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body,
  })

  const data = await res.json()
  console.log('[AT SMS]', JSON.stringify(data))
  if (!res.ok) throw new Error('SMS failed: ' + JSON.stringify(data))
}

// ── Brevo Email ───────────────────────────────────────────
async function sendEmailBrevo(email: string, code: string) {
  const BREVO_KEY = Deno.env.get('BREVO_API_KEY')!

  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'api-key': BREVO_KEY,
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
            ${code}
          </div>
          <p style="color:#637068;font-size:14px;">
            This code expires in <strong>10 minutes</strong>.<br>
            If you didn't request this, ignore this email.
          </p>
        </div>
      `,
    }),
  })

  const data = await res.json()
  console.log('[Brevo]', JSON.stringify(data))
  if (!res.ok) throw new Error('Email failed: ' + JSON.stringify(data))
}