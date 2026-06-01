// supabase/functions/verify-otp/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    // ── Look up OTP ─────────────────────────────────────
    // If newPassword is provided, the OTP may already be marked used (step 3 flow).
    // So we allow used=true if newPassword is present — we just check it exists and
    // is not expired.
    let query = supabase
      .from('otp_codes')
      .select('*')
      .eq(field, identifier)
      .eq('code', code)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(1)

    // Step 2 (just verifying): must be unused
    // Step 3 (setting password): allow already-used (same session)
    if (!newPassword) {
      query = query.eq('used', false)
    }

    const { data: otpRows, error: fetchError } = await query

    if (fetchError) throw new Error(fetchError.message)

    if (!otpRows || otpRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Invalid or expired code. Please request a new one.' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Mark as used (step 2 only) ───────────────────────
    if (!newPassword) {
      await supabase
        .from('otp_codes')
        .update({ used: true })
        .eq('id', otpRows[0].id)

      // OTP verified, no password yet — frontend shows new password form
      return new Response(JSON.stringify({ success: true, passwordUpdated: false }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // ── Step 3: update password ──────────────────────────
    if (newPassword.length < 8) {
      return new Response(JSON.stringify({ error: 'Password must be at least 8 characters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Find user by email or phone metadata
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

    // Clean up — delete all OTPs for this identifier
    await supabase.from('otp_codes').delete().eq(field, identifier)

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