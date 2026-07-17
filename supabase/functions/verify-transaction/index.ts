// supabase/functions/verify-transaction/index.ts
// Production: PayChangu is source of truth. Browser only triggers this check.
// Phase 0.2: Featured flags are set ONLY via confirm_feature_payment after gateway success.
// Failed/cancelled/expired feature payments call mark_feature_payment_outcome (never leave featured).
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

const PAYCHANGU_SECRET = Deno.env.get('PAYCHANGU_SECRET_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: cors })
}

function mapGatewayStatus(raw: Record<string, unknown> | null): {
  confirmed: boolean
  outcome: 'confirmed' | 'failed' | 'cancelled' | 'expired' | 'pending' | 'unknown'
  message: string
} {
  if (!raw) {
    return { confirmed: false, outcome: 'unknown', message: 'No response from payment provider' }
  }

  const top = String(raw.status || '').toLowerCase()
  const data = (raw.data || {}) as Record<string, unknown>
  const dataStatus = String(data.status || '').toLowerCase()
  const message = String(data.message || raw.message || '')

  if (top === 'success' && dataStatus === 'success') {
    return { confirmed: true, outcome: 'confirmed', message: 'Payment successful' }
  }

  if (
    dataStatus === 'cancelled' || dataStatus === 'canceled'
    || /cancel/i.test(message)
  ) {
    return { confirmed: false, outcome: 'cancelled', message: 'Payment was cancelled' }
  }

  if (
    dataStatus === 'expired' || dataStatus === 'timeout'
    || /expir/i.test(message)
  ) {
    return { confirmed: false, outcome: 'expired', message: 'Payment expired' }
  }

  if (
    dataStatus === 'failed' || dataStatus === 'fail' || dataStatus === 'error'
    || top === 'failed' || top === 'error'
  ) {
    return { confirmed: false, outcome: 'failed', message: 'Payment failed' }
  }

  if (
    dataStatus === 'pending' || dataStatus === 'processing' || dataStatus === 'initiated'
    || top === 'pending'
  ) {
    return { confirmed: false, outcome: 'pending', message: 'Payment is still processing' }
  }

  return { confirmed: false, outcome: 'failed', message: message || 'Payment not confirmed' }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: cors })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const tx_ref = String(body?.tx_ref || '').trim()
    if (!tx_ref) return json({ error: 'tx_ref required', confirmed: false }, 400)

    if (!PAYCHANGU_SECRET) {
      return json({ error: 'Payment provider not configured', confirmed: false }, 500)
    }

    const isFeatureTx = tx_ref.startsWith('SOKO-FEATURE-')

    // 1) Source of truth: PayChangu verify API
    const res = await fetch(`https://api.paychangu.com/verify-payment/${encodeURIComponent(tx_ref)}`, {
      headers: {
        Authorization: `Bearer ${PAYCHANGU_SECRET}`,
        Accept: 'application/json',
      },
    })
    const raw = await res.json().catch(() => null)
    const mapped = mapGatewayStatus(raw)

    // 2) Service-role DB updates (browser never self-confirms gateway)
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    let payment = null
    let request = null
    let ledgerError: string | null = null
    let featureConfirmed = false
    let featureError: string | null = null
    let featureOutcome: Record<string, unknown> | null = null

    // ── Feature listing payments (Phase 0.2) ────────────────
    if (isFeatureTx) {
      if (mapped.confirmed) {
        // ONLY success path may activate featured flags
        const { data: feat, error: featErr } = await admin.rpc('confirm_feature_payment', {
          p_tx_ref: tx_ref,
        })
        if (featErr) {
          featureError = featErr.message
          featureConfirmed = false
        } else {
          const row = Array.isArray(feat) ? feat[0] : feat
          featureConfirmed = !!(row && (row.ok === true || row.featured === true || row.already_active === true))
          featureOutcome = row && typeof row === 'object' ? row as Record<string, unknown> : { data: feat }
        }
      } else if (['failed', 'cancelled', 'expired'].includes(mapped.outcome)) {
        // Failed payments must never leave a listing featured
        try {
          const { data: out } = await admin.rpc('mark_feature_payment_outcome', {
            p_tx_ref: tx_ref,
            p_outcome: mapped.outcome,
            p_reason: mapped.message,
          })
          featureOutcome = (Array.isArray(out) ? out[0] : out) as Record<string, unknown> | null
        } catch {
          /* promo row may not exist yet */
        }
        featureConfirmed = false
      }

      return json({
        confirmed: mapped.confirmed,
        outcome: mapped.outcome,
        message: mapped.message,
        tx_ref,
        payment: null,
        request: null,
        feature_confirmed: featureConfirmed,
        feature_error: featureError,
        feature_outcome: featureOutcome,
        ledger_error: null,
        raw,
      })
    }

    // ── Verification payments (unchanged flow) ──────────────
    if (mapped.confirmed) {
      const { data: pay, error: payErr } = await admin.rpc('confirm_verification_gateway_payment', {
        p_tx_ref: tx_ref,
        p_gateway: 'paychangu',
        p_gateway_payload: {
          source: 'verify-transaction-edge',
          paychangu: raw,
          verified_at: new Date().toISOString(),
        },
      })
      if (payErr) {
        ledgerError = payErr.message
      } else {
        payment = Array.isArray(pay) ? pay[0] : pay
        if (payment?.request_id) {
          const { data: req } = await admin
            .from('verification_requests')
            .select('id, status, payment_confirmed_at, seller_id, payment_ref')
            .eq('id', payment.request_id)
            .maybeSingle()
          request = req
        }
      }
    } else if (['failed', 'cancelled', 'expired'].includes(mapped.outcome)) {
      try {
        const { data: outcomeRow } = await admin.rpc('mark_verification_payment_outcome', {
          p_tx_ref: tx_ref,
          p_outcome: mapped.outcome,
          p_reason: mapped.message,
        })
        payment = Array.isArray(outcomeRow) ? outcomeRow[0] : outcomeRow
      } catch {
        /* optional if migration not applied */
      }
    }

    return json({
      confirmed: mapped.confirmed,
      outcome: mapped.outcome,
      message: mapped.message,
      tx_ref,
      payment,
      request,
      feature_confirmed: false,
      ledger_error: ledgerError,
      raw,
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e)
    return json({ error: message, confirmed: false, outcome: 'failed', feature_confirmed: false }, 500)
  }
})
