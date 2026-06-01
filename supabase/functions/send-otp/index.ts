// supabase/functions/send-otp/index.ts
// Sends a 6-digit OTP via SMS (Africa's Talking) or email (Resend)
// depending on whether the user provides a phone or email.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { identifier } = await req.json()
    // identifier = phone number OR email address

    if (!identifier) {
      return new Response(JSON.stringify({ error: 'Phone or email required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Determine type ──────────────────────────────────
    const isPhone = /^\+?\d[\d\s\-]{6,14}$/.test(identifier.trim())
    const isEmail = identifier.includes('@')

    if (!isPhone && !isEmail) {
      return new Response(JSON.stringify({ error: 'Enter a valid phone number or email address' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Generate 6-digit OTP ────────────────────────────
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes

    // ── Save OTP to Supabase ────────────────────────────
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Invalidate any existing unused OTPs for this identifier
    await supabase
      .from('otp_codes')
      .update({ used: true })
      .eq(isPhone ? 'phone' : 'email', identifier)
      .eq('used', false)

    // Insert new OTP
    const { error: insertError } = await supabase.from('otp_codes').insert({
      [isPhone ? 'phone' : 'email']: identifier,
      code,
      expires_at: expiresAt,
    })

    if (insertError) throw new Error('Failed to save OTP: ' + insertError.message)

    // ── Send OTP ────────────────────────────────────────
    if (isPhone) {
      await sendSMS(identifier, code)
    } else {
      await sendEmail(identifier, code)
    }

    return new Response(JSON.stringify({ success: true, method: isPhone ? 'sms' : 'email' }), {
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
  // Normalise to +265 format
  let to = phone.trim().replace(/[\s\-]/g, '')
  if (!to.startsWith('+')) to = '+265' + to.replace(/^0/, '')

  const AT_KEY      = Deno.env.get('AT_API_KEY')!
  const AT_USERNAME = Deno.env.get('AT_USERNAME')!   // 'sandbox' for testing

  const body = new URLSearchParams({
    username: AT_USERNAME,
    to,
    message: `Your Soko Malawi reset code is: ${code}. It expires in 10 minutes. Do not share it.`,
  })

  const res = await fetch('https://api.sandbox.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      'apiKey': AT_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
    },
    body,
  })

  // When going LIVE change the URL to:
  // https://api.africastalking.com/version1/messaging
  // and update AT_USERNAME to your live app name

  const data = await res.json()
  console.log('[AT SMS]', JSON.stringify(data))

  if (!res.ok) throw new Error('SMS failed: ' + JSON.stringify(data))
}

// ── Resend Email ──────────────────────────────────────────
async function sendEmail(email: string, code: string) {
  const RESEND_KEY = Deno.env.get('RESEND_API_KEY')!

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Soko Malawi <onboarding@resend.dev>',  // change to your verified Resend domain
      to: [email],
      subject: 'Your Soko Malawi password reset code',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;">
          <h2 style="color:#1a7a4a;">Soko Malawi</h2>
          <p>Your password reset code is:</p>
          <div style="font-size:40px;font-weight:900;letter-spacing:8px;color:#0f1410;margin:24px 0;">
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
  console.log('[Resend]', JSON.stringify(data))

  if (!res.ok) throw new Error('Email failed: ' + JSON.stringify(data))
}