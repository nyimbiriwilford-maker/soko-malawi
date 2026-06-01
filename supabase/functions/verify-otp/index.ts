// supabase/functions/verify-otp/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Rate limit config ─────────────────────────────────────
const MAX_VERIFY_ATTEMPTS = 5   // max wrong guesses per code
const WINDOW_MINUTES      = 10  // within the code's lifetime

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { identifier, code, newPassword } = await req.json()

    if (!identifier || !code) {
      return new Response(JSON.stringify({ error: 'Identifier and code required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const isPhone = !identifier.includes('@')
    const field   = isPhone ? 'phone' : 'email'

    // ── Rate limit: count recent failed attempts ──────────
    const windowStart = new Date(Date.now() - WINDOW_MINUTES * 60 * 1000).toISOString()

    const { count: failCount } = await supabase
      .from('otp_attempts')
      .select('*', { count: 'exact', head: true })
      .eq('identifier', identifier)
      .eq('success', false)
      .gte('created_at', windowStart)

    if ((failCount ?? 0) >= MAX_VERIFY_ATTEMPTS) {
      return new Response(JSON.stringify({
        error: 'Too many incorrect attempts. Please request a new code.'
      }), {
        status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Look up OTP ───────────────────────────────────────
    let query = supabase
      .from('otp_codes')
      .select('*')
      .eq(field, identifier)
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    if (!newPassword) {
      query = query.eq('used', false)
    }

    const { data: otpRows, error: fetchError } = await query

    if (fetchError) throw new Error(fetchError.message)

    if (!otpRows || otpRows.length === 0) {
      // Log the failed attempt
      await supabase.from('otp_attempts').insert({
        identifier,
        success: false,
      })

      return new Response(JSON.stringify({ error: 'Invalid or expired code. Please request a new one.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Log successful attempt ────────────────────────────
    await supabase.from('otp_attempts').insert({
      identifier,
      success: true,
    })

    // ── Mark as used (step 2 only) ────────────────────────
    if (!newPassword) {
      await supabase
        .from('otp_codes')
        .update({ used: true })
        .eq('id', otpRows[0].id)

      return new Response(JSON.stringify({ success: true, passwordUpdated: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Step 3: update password ───────────────────────────
    if (newPassword.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers()
    if (listErr) throw new Error(listErr.message)

    let userId: string | null = null

    if (!isPhone) {
      const match = users.find(u => u.email === identifier)
      userId = match?.id ?? null
    } else {
      const normalised = identifier.replace(/[\s\-]/g, '')
      const match = users.find(u => {
        const p = (u.user_metadata?.phone || '').replace(/[\s\-]/g, '')
        return p === normalised
      })
      userId = match?.id ?? null
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: 'No account found for this ' + (isPhone ? 'phone number' : 'email') }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    const { error: updateErr } = await supabase.auth.admin.updateUserById(userId, { password: newPassword })
    if (updateErr) throw new Error('Password update failed: ' + updateErr.message)

    // Clean up OTPs and attempts for this identifier
    await supabase.from('otp_codes').delete().eq(field, identifier)
    await supabase.from('otp_attempts').delete().eq('identifier', identifier)

    return new Response(JSON.stringify({ success: true, passwordUpdated: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    console.error('[verify-otp]', err)
    return new Response(JSON.stringify({ error: err.message || 'Verification failed' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})