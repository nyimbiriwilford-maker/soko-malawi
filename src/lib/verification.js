/**
 * SokoMw Verification — Phase 1 backend + Phase 2 wizard helpers
 * Fee, document types, payment methods come from verification_settings.
 */
import { supabase } from './supabase'

/** Canonical pipeline statuses */
export const VERIFICATION_STATUSES = Object.freeze({
  DRAFT: 'draft',
  SUBMITTED: 'submitted',
  PAYMENT_PENDING: 'payment_pending',
  PAYMENT_CONFIRMED: 'payment_confirmed',
  UNDER_REVIEW: 'under_review',
  ADDITIONAL_INFO_REQUIRED: 'additional_info_required',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
})

export const PROFILE_VERIFICATION_NONE = 'none'

/** Statuses that count as "in progress" for UX locks */
export const OPEN_VERIFICATION_STATUSES = [
  VERIFICATION_STATUSES.DRAFT,
  VERIFICATION_STATUSES.SUBMITTED,
  VERIFICATION_STATUSES.PAYMENT_PENDING,
  VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
  VERIFICATION_STATUSES.UNDER_REVIEW,
  VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED,
]

/** Admin queue: needs human action */
export const ADMIN_ACTIONABLE_STATUSES = [
  VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
  VERIFICATION_STATUSES.UNDER_REVIEW,
  VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED,
  'pending',
]

/** Wizard steps (Phase 2) */
export const WIZARD_STEPS = Object.freeze([
  { id: 'welcome', label: 'Welcome', short: 'Start' },
  { id: 'type', label: 'Type', short: 'Type' },
  { id: 'payment', label: 'Payment', short: 'Pay' },
  { id: 'documents', label: 'Documents', short: 'Docs' },
  { id: 'review', label: 'Review', short: 'Review' },
  { id: 'submit', label: 'Submit', short: 'Submit' },
  { id: 'status', label: 'Status', short: 'Status' },
])

const DEFAULT_SETTINGS = Object.freeze({
  fee_amount: 5000,
  fee_currency: 'MWK',
  review_period_hours: 24,
  request_expiry_days: 30,
  additional_info_deadline_days: 7,
  verification_validity_days: null,
  accepted_document_types: [
    'national_id',
    'passport',
    'drivers_license',
    'selfie',
    'business_registration',
    'proof_of_address',
    'other',
  ],
  supported_payment_methods: [
    'pachangu',
    'airtel_money',
    'tnm_mpamba',
    'bank_transfer',
    'card',
  ],
  default_verification_type_code: 'seller',
  auto_submit_on_payment: true,
  require_documents: true,
  is_enabled: true,
})

/** Payment ledger statuses (Phase 3) */
export const PAYMENT_STATUSES = Object.freeze({
  PENDING: 'pending',
  INITIATED: 'initiated',
  /** UI alias for pending/initiated while gateway processes */
  PROCESSING: 'processing',
  AWAITING_CONFIRMATION: 'awaiting_confirmation',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  EXPIRED: 'expired',
})

/** Open (non-terminal) payment rows — one active payment per request */
export const OPEN_PAYMENT_STATUSES = Object.freeze([
  PAYMENT_STATUSES.PENDING,
  PAYMENT_STATUSES.INITIATED,
  PAYMENT_STATUSES.AWAITING_CONFIRMATION,
])

export const TERMINAL_PAYMENT_STATUSES = Object.freeze([
  PAYMENT_STATUSES.CONFIRMED,
  PAYMENT_STATUSES.FAILED,
  PAYMENT_STATUSES.CANCELLED,
  PAYMENT_STATUSES.EXPIRED,
  PAYMENT_STATUSES.REFUNDED,
])

/** Map ledger status → seller-facing UI label */
export function paymentUiState(status) {
  const s = String(status || '').toLowerCase()
  if (s === 'confirmed') return { key: 'success', label: 'Payment successful' }
  if (s === 'failed') return { key: 'failed', label: 'Payment failed' }
  if (s === 'cancelled' || s === 'canceled') return { key: 'cancelled', label: 'Payment cancelled' }
  if (s === 'expired') return { key: 'expired', label: 'Payment expired' }
  if (s === 'awaiting_confirmation') {
    return { key: 'awaiting', label: 'Payment proof submitted — awaiting confirmation' }
  }
  if (['pending', 'initiated', 'processing'].includes(s)) {
    return { key: 'processing', label: 'Processing payment…' }
  }
  return { key: 'unknown', label: paymentStatusLabel(s) || 'Payment status unknown' }
}

const FALLBACK_TYPES = [
  {
    id: 'fallback-seller',
    code: 'seller',
    name: 'Seller verification',
    description: 'Identity-backed badge for individual marketplace sellers',
    default_fee_amount: 5000,
    required_document_types: ['national_id', 'selfie'],
    sort_order: 10,
  },
  {
    id: 'fallback-shop',
    code: 'shop',
    name: 'Shop verification',
    description: 'Business / shop storefront verification',
    default_fee_amount: 5000,
    required_document_types: ['national_id', 'business_registration', 'selfie'],
    sort_order: 20,
  },
  {
    id: 'fallback-business',
    code: 'business',
    name: 'Business verification',
    description: 'Higher-trust verification for organizations',
    default_fee_amount: 15000,
    required_document_types: ['national_id', 'business_registration', 'proof_of_address'],
    sort_order: 30,
  },
]

let _settingsCache = null
let _settingsFetchedAt = 0
const CACHE_MS = 60_000

/**
 * Effective fee for a verification type (promo window + per-type fees).
 */
export function resolveEffectiveFee(selectedType = null, settings = DEFAULT_SETTINGS) {
  const base = Number(
    selectedType?.default_fee_amount != null
      ? selectedType.default_fee_amount
      : (settings?.fee_amount ?? DEFAULT_SETTINGS.fee_amount)
  )
  const promo = settings?.extra?.promotion
  if (!promo || promo.enabled !== true) return base

  const now = Date.now()
  const start = promo.start_date ? new Date(promo.start_date).getTime() : 0
  const end = promo.end_date ? new Date(promo.end_date).getTime() : Number.POSITIVE_INFINITY
  if (Number.isNaN(start) || Number.isNaN(end) || now < start || now > end) return base

  const code = selectedType?.code
  if (code && promo.by_type && promo.by_type[code] != null && promo.by_type[code] !== '') {
    return Number(promo.by_type[code])
  }
  if (promo.amount != null && promo.amount !== '') return Number(promo.amount)
  return base
}

export function formatFee(settings = DEFAULT_SETTINGS, amountOverride = null) {
  // Explicit null breaks default params — always coalesce
  const s = settings && typeof settings === 'object' ? settings : DEFAULT_SETTINGS
  const amount = Number(
    amountOverride != null ? amountOverride : (s.fee_amount ?? DEFAULT_SETTINGS.fee_amount)
  )
  const currency = s.fee_currency || DEFAULT_SETTINGS.fee_currency || 'MWK'
  if (Number.isNaN(amount)) {
    return currency === 'MWK' || currency === 'MK'
      ? `MK ${Number(DEFAULT_SETTINGS.fee_amount).toLocaleString()}`
      : `${currency} ${DEFAULT_SETTINGS.fee_amount}`
  }
  if (currency === 'MWK' || currency === 'MK') {
    return `MK ${amount.toLocaleString()}`
  }
  return `${currency} ${amount.toLocaleString()}`
}

/** Clear cached settings after admin updates */
export function clearVerificationSettingsCache() {
  _settingsCache = null
  _settingsFetchedAt = 0
}

export function getUserFacingReviewEstimate(settings = null) {
  const custom = settings?.extra?.user_facing_estimate
  if (custom && String(custom).trim()) return String(custom).trim()
  const hours = settings?.review_period_hours ?? 24
  const maxH = settings?.extra?.max_review_hours
  if (maxH && Number(maxH) > hours) {
    return `Verification usually takes ${hours}–${maxH} hours.`
  }
  if (hours <= 24) return 'Verification usually takes 24 hours.'
  if (hours <= 48) return 'Verification usually takes 24–48 hours.'
  const days = Math.ceil(hours / 24)
  return `Verification usually takes about ${days} day${days === 1 ? '' : 's'}.`
}

export function getValidityLabel(settings = null) {
  const days = settings?.verification_validity_days
  if (days == null || days === '' || Number(days) <= 0) return 'Never expires'
  if (Number(days) >= 365) {
    const y = Math.round(Number(days) / 365)
    return `${y} year${y === 1 ? '' : 's'}`
  }
  return `${days} days`
}

export function statusLabel(status) {
  if (!status || status === 'none') return 'Not started'
  return String(status)
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function docTypeLabel(code) {
  return String(code || 'document')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function isTrackingStatus(status) {
  return [
    VERIFICATION_STATUSES.PAYMENT_PENDING,
    VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
    VERIFICATION_STATUSES.SUBMITTED,
    VERIFICATION_STATUSES.UNDER_REVIEW,
    VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED,
    VERIFICATION_STATUSES.APPROVED,
    VERIFICATION_STATUSES.REJECTED,
    VERIFICATION_STATUSES.EXPIRED,
    VERIFICATION_STATUSES.CANCELLED,
    'pending',
  ].includes(status)
}

export async function getVerificationSettings({ force = false } = {}) {
  const now = Date.now()
  if (!force && _settingsCache && now - _settingsFetchedAt < CACHE_MS) {
    return _settingsCache
  }

  try {
    const { data, error } = await supabase.rpc('get_verification_settings')
    if (!error && data) {
      const row = Array.isArray(data) ? data[0] : data
      if (row) {
        _settingsCache = { ...DEFAULT_SETTINGS, ...row }
        _settingsFetchedAt = now
        return _settingsCache
      }
    }
  } catch { /* RPC not migrated yet */ }

  try {
    const { data, error } = await supabase
      .from('verification_settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle()
    if (!error && data) {
      _settingsCache = { ...DEFAULT_SETTINGS, ...data }
      _settingsFetchedAt = now
      return _settingsCache
    }
  } catch { /* ignore */ }

  _settingsCache = { ...DEFAULT_SETTINGS }
  _settingsFetchedAt = now
  return _settingsCache
}

export async function getActiveVerificationTypes() {
  try {
    const { data, error } = await supabase.rpc('get_active_verification_types')
    if (!error && Array.isArray(data) && data.length) return data
  } catch { /* ignore */ }
  try {
    const { data } = await supabase
      .from('verification_types')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    if (data?.length) return data
  } catch { /* ignore */ }
  return FALLBACK_TYPES
}

/**
 * Best active verification request for a seller.
 * Prefers open/actionable statuses (need-info, under review) over older drafts,
 * and uses updated_at so admin status changes surface immediately.
 * Among the same priority, prefers paid / recently updated rows.
 */
export async function getLatestVerificationRequest(userId) {
  if (!userId) return null

  const statusRank = (status) => {
    const priority = [
      VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED,
      VERIFICATION_STATUSES.UNDER_REVIEW,
      VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
      VERIFICATION_STATUSES.SUBMITTED,
      'pending',
      VERIFICATION_STATUSES.PAYMENT_PENDING,
      VERIFICATION_STATUSES.DRAFT,
      VERIFICATION_STATUSES.REJECTED,
      VERIFICATION_STATUSES.APPROVED,
      VERIFICATION_STATUSES.EXPIRED,
      VERIFICATION_STATUSES.CANCELLED,
    ]
    const i = priority.indexOf(status)
    return i === -1 ? 100 : i
  }

  const isPaidRow = (r) => !!(
    r?.payment_confirmed_at
    || Number(r?.amount_paid) > 0
    || [
      VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
      VERIFICATION_STATUSES.UNDER_REVIEW,
      VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED,
      VERIFICATION_STATUSES.APPROVED,
    ].includes(r?.status)
  )

  const pickBest = (rows) => {
    if (!rows?.length) return null
    // Prefer need-info / in-review even if an older draft was updated more recently
    const scored = [...rows].sort((a, b) => {
      const ra = statusRank(a.status)
      const rb = statusRank(b.status)
      if (ra !== rb) return ra - rb
      // Same status rank: prefer paid applications over unpaid stubs
      const pa = isPaidRow(a) ? 1 : 0
      const pb = isPaidRow(b) ? 1 : 0
      if (pa !== pb) return pb - pa
      const ta = new Date(a.updated_at || a.created_at || 0).getTime()
      const tb = new Date(b.updated_at || b.created_at || 0).getTime()
      return tb - ta
    })
    return scored[0]
  }

  // Prefer recent updates first (admin need-info / payment confirm)
  let { data, error } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('seller_id', userId)
    .order('updated_at', { ascending: false })
    .limit(25)

  if (error || !data?.length) {
    const r2 = await supabase
      .from('verification_requests')
      .select('*')
      .eq('seller_id', userId)
      .order('created_at', { ascending: false })
      .limit(25)
    data = r2.data
    error = r2.error
  }

  if (error || !data?.length) {
    const r3 = await supabase
      .from('verification_requests')
      .select('*')
      .eq('seller_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(25)
    data = r3.data
  }

  return pickBest(data || [])
}

/**
 * Re-fetch a single verification request by id (fresh status after admin actions).
 */
export async function getVerificationRequestById(requestId) {
  if (!requestId) return null
  const { data, error } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()
  if (error) return null
  return data
}

export async function getVerificationDocuments(requestId, userId) {
  if (!userId) return []
  let q = supabase
    .from('verification_documents')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (requestId) q = q.eq('request_id', requestId)
  const { data, error } = await q
  if (error) return []
  return data || []
}

/**
 * Ensure a draft request exists for the wizard (autosave target).
 */
export async function ensureVerificationDraft({
  userId,
  typeCode = 'seller',
  typeId = null,
  settings = DEFAULT_SETTINGS,
  wizardStep = 'welcome',
  notes = '',
}) {
  if (!userId) throw new Error('Not authenticated')

  const latest = await getLatestVerificationRequest(userId)
  if (latest) {
    if (latest.status === VERIFICATION_STATUSES.APPROVED) {
      return latest
    }
    if (OPEN_VERIFICATION_STATUSES.includes(latest.status) || latest.status === 'pending') {
      // Resume existing open request
      const meta = {
        ...(latest.meta || {}),
        wizard_step: wizardStep,
        notes: notes || latest.meta?.notes || '',
        type_code: typeCode || latest.meta?.type_code,
      }
      if (latest.status === VERIFICATION_STATUSES.DRAFT) {
        const patch = {
          meta,
          notes: notes || latest.notes || null,
          updated_at: new Date().toISOString(),
        }
        if (typeId && !String(typeId).startsWith('fallback-')) {
          patch.verification_type_id = typeId
        }
        const { data } = await supabase
          .from('verification_requests')
          .update(patch)
          .eq('id', latest.id)
          .select('*')
          .single()
        return data || latest
      }
      return latest
    }
  }

  // Create new draft
  const insert = {
    seller_id: userId,
    status: VERIFICATION_STATUSES.DRAFT,
    amount_due: settings.fee_amount ?? 5000,
    amount_paid: 0,
    currency: settings.fee_currency || 'MWK',
    notes: notes || null,
    meta: {
      wizard_step: wizardStep,
      type_code: typeCode,
      notes: notes || '',
    },
  }
  if (typeId && !String(typeId).startsWith('fallback-')) {
    insert.verification_type_id = typeId
  }

  const { data, error } = await supabase
    .from('verification_requests')
    .insert(insert)
    .select('*')
    .single()
  if (error) throw error
  return data
}

/** Debounced autosave payload for draft */
export async function saveVerificationDraft(requestId, {
  typeId = null,
  typeCode = null,
  notes = null,
  wizardStep = null,
  paymentMethod = null,
  amountDue = null,
  metaExtra = {},
}) {
  if (!requestId) return null

  const { data: current } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()

  if (!current) return null
  // Only mutate drafts / payment_pending lightly
  if (![VERIFICATION_STATUSES.DRAFT, VERIFICATION_STATUSES.PAYMENT_PENDING, VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED].includes(current.status)
    && current.status !== 'pending') {
    return current
  }

  const meta = {
    ...(current.meta || {}),
    ...metaExtra,
  }
  if (wizardStep) meta.wizard_step = wizardStep
  if (typeCode) meta.type_code = typeCode
  if (notes != null) meta.notes = notes
  if (paymentMethod) meta.payment_method = paymentMethod

  const patch = {
    meta,
    updated_at: new Date().toISOString(),
  }
  if (notes != null) patch.notes = notes
  if (paymentMethod) patch.payment_method = paymentMethod
  if (amountDue != null) patch.amount_due = amountDue
  if (typeId && !String(typeId).startsWith('fallback-')) {
    patch.verification_type_id = typeId
  }

  const { data, error } = await supabase
    .from('verification_requests')
    .update(patch)
    .eq('id', requestId)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function uploadVerificationDocument({
  userId,
  requestId,
  file,
  docType = 'national_id',
}) {
  if (!userId || !file) throw new Error('Missing file or user')
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const safeType = String(docType || 'other').replace(/[^a-z0-9_]/gi, '_')
  const path = `${userId}/${requestId || 'draft'}/${safeType}_${Date.now()}.${ext}`

  const { error: upErr } = await supabase.storage
    .from('verification-docs')
    .upload(path, file, { upsert: false, contentType: file.type || undefined })
  if (upErr) throw upErr

  const row = {
    user_id: userId,
    request_id: requestId || null,
    doc_type: docType,
    storage_path: path,
    file_name: file.name,
    mime_type: file.type || null,
    status: 'uploaded',
  }

  const { data, error } = await supabase
    .from('verification_documents')
    .insert(row)
    .select('*')
    .single()
  if (error) {
    // cleanup storage on DB failure
    try { await supabase.storage.from('verification-docs').remove([path]) } catch { /* ignore */ }
    throw error
  }
  return data
}

export async function deleteVerificationDocument(doc) {
  if (!doc?.id) return
  if (doc.storage_path) {
    try {
      await supabase.storage.from('verification-docs').remove([doc.storage_path])
    } catch { /* ignore */ }
  }
  await supabase.from('verification_documents').delete().eq('id', doc.id)
}

/**
 * Create / refresh a payment_pending verification request.
 * Uses RPC when available; falls back to direct insert/update.
 */
export async function startVerificationPayment({
  paymentRef,
  paymentMethod = 'pachangu',
  typeCode = null,
  userId,
  feeAmount,
  currency = 'MWK',
  requestId = null,
}) {
  if (!paymentRef) throw new Error('paymentRef required')

  try {
    const { data, error } = await supabase.rpc('start_verification_payment', {
      p_payment_ref: paymentRef,
      p_payment_method: paymentMethod,
      p_type_code: typeCode,
    })
    if (!error && data) return Array.isArray(data) ? data[0] : data
    if (error) {
      const msg = error.message || ''
      if (/already verified|in progress|disabled/i.test(msg)) throw error
    }
  } catch (e) {
    if (/already verified|in progress|disabled/i.test(e.message || '')) throw e
  }

  if (!userId) {
    const { data: { user } } = await supabase.auth.getUser()
    userId = user?.id
  }
  if (!userId) throw new Error('Not authenticated')

  // Prefer updating existing draft/payment_pending
  if (requestId) {
    const { data, error } = await supabase
      .from('verification_requests')
      .update({
        payment_ref: paymentRef,
        payment_method: paymentMethod,
        status: VERIFICATION_STATUSES.PAYMENT_PENDING,
        amount_due: feeAmount ?? DEFAULT_SETTINGS.fee_amount,
        currency,
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .eq('seller_id', userId)
      .select('*')
      .single()
    if (!error && data) return data
  }

  const insert = {
    seller_id: userId,
    payment_ref: paymentRef,
    payment_method: paymentMethod,
    amount_paid: 0,
    amount_due: feeAmount ?? DEFAULT_SETTINGS.fee_amount,
    currency,
    status: VERIFICATION_STATUSES.PAYMENT_PENDING,
    submitted_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('verification_requests')
    .insert(insert)
    .select('*')
    .single()
  if (error) throw error
  return data
}

/**
 * Reconcile payment with PayChangu via edge function (source of truth).
 * Browser return pages must call this — never trust query-string status alone.
 * Edge function verifies gateway then confirms via service role.
 *
 * @returns {{
 *   confirmed: boolean,
 *   outcome: string,
 *   message: string,
 *   payment: object|null,
 *   request: object|null,
 *   feature_confirmed?: boolean,
 * }}
 */
export async function reconcileVerificationPayment(txRef) {
  if (!txRef) throw new Error('tx_ref required')

  const { data, error } = await supabase.functions.invoke('verify-transaction', {
    body: { tx_ref: txRef },
  })

  if (error) {
    throw new Error(typeof error === 'string' ? error : (error.message || 'Could not verify payment'))
  }

  return {
    confirmed: !!data?.confirmed,
    outcome: data?.outcome || (data?.confirmed ? 'confirmed' : 'failed'),
    message: data?.message || (data?.confirmed ? 'Payment successful' : 'Payment was not completed'),
    payment: data?.payment || null,
    request: data?.request || null,
    // Phase 0.2: featured activation only when edge confirms gateway AND confirm_feature_payment
    feature_confirmed: !!data?.feature_confirmed,
    feature_error: data?.feature_error || null,
    feature_outcome: data?.feature_outcome || null,
    raw: data?.raw || null,
    ledger_error: data?.ledger_error || null,
  }
}

/**
 * Phase 0.2 — mark a failed/cancelled/expired feature payment so the listing
 * is never left featured. Safe no-op if promo row missing.
 */
export async function markFeaturePaymentOutcome(txRef, outcome = 'failed', reason = null) {
  if (!txRef || !String(txRef).startsWith('SOKO-FEATURE-')) return null
  const { data, error } = await supabase.rpc('mark_feature_payment_outcome', {
    p_tx_ref: txRef,
    p_outcome: outcome,
    p_reason: reason,
  })
  if (error) {
    // Soft-fail: do not block UX if RPC unavailable
    console.warn('[markFeaturePaymentOutcome]', error.message)
    return null
  }
  return data
}

/**
 * After gateway verify edge confirms — load request.
 * Prefer reconcileVerificationPayment; this remains for compatibility.
 * Never marks confirmed client-side without edge verify.
 */
export async function confirmVerificationPayment(txRef) {
  if (!txRef) throw new Error('tx_ref required')

  const result = await reconcileVerificationPayment(txRef)
  if (!result.confirmed) {
    const err = new Error(result.message || 'Payment was not completed. You can try again.')
    err.outcome = result.outcome
    err.reconcile = result
    throw err
  }

  const { data: { user } } = await supabase.auth.getUser()
  let req = result.request || null

  if (!req && user) {
    const { data } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('seller_id', user.id)
      .eq('payment_ref', txRef)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    req = data
  }

  if (!req && user) {
    const { data: byStatus } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('seller_id', user.id)
      .in('status', [
        VERIFICATION_STATUSES.UNDER_REVIEW,
        VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
        VERIFICATION_STATUSES.APPROVED,
      ])
      .order('payment_confirmed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    req = byStatus
  }

  if (!req) throw new Error('Payment confirmed but verification request was not found')

  try {
    const uid = req.seller_id || user?.id
    if (uid) {
      await notifyVerificationLifecycle({
        userId: uid,
        event: 'payment_confirmed',
        requestId: req.id,
      })
    }
  } catch { /* soft */ }

  return req
}

/**
 * Cancel / abandon a gateway attempt — keeps verification request open for retry.
 * Does NOT permanently cancel the seller's verification application.
 */
export async function cancelVerificationPayment(txRef, userId) {
  if (!txRef) return null

  try {
    const { data, error } = await supabase.rpc('mark_verification_payment_outcome', {
      p_tx_ref: txRef,
      p_outcome: 'cancelled',
      p_reason: 'User cancelled at gateway',
    })
    if (!error && data) return Array.isArray(data) ? data[0] : data
  } catch { /* fall through */ }

  // Fallback: mark payment cancelled; re-open request as draft
  try {
    await supabase
      .from('verification_payments')
      .update({
        payment_status: PAYMENT_STATUSES.CANCELLED,
        failure_reason: 'User cancelled at gateway',
        updated_at: new Date().toISOString(),
      })
      .or(`transaction_reference.eq.${txRef},gateway_session_id.eq.${txRef}`)
      .eq('seller_id', userId)
      .in('payment_status', OPEN_PAYMENT_STATUSES)

    await supabase
      .from('verification_requests')
      .update({
        status: VERIFICATION_STATUSES.DRAFT,
        updated_at: new Date().toISOString(),
        meta: { last_payment_outcome: 'cancelled', last_payment_tx_ref: txRef },
      })
      .eq('seller_id', userId)
      .eq('payment_ref', txRef)
      .in('status', [
        VERIFICATION_STATUSES.DRAFT,
        VERIFICATION_STATUSES.PAYMENT_PENDING,
        VERIFICATION_STATUSES.SUBMITTED,
      ])
  } catch { /* soft */ }
  return null
}

/**
 * Find non-terminal payment for a request (duplicate prevention).
 */
export async function getActivePaymentForRequest(requestId) {
  if (!requestId) return null
  const list = await getPaymentsForRequest(requestId)
  const confirmed = list.find((p) => p.payment_status === PAYMENT_STATUSES.CONFIRMED)
  if (confirmed) return confirmed
  return list.find((p) => OPEN_PAYMENT_STATUSES.includes(p.payment_status)) || null
}

/**
 * Before starting checkout: block if already paid; reuse open initiated row.
 */
export async function assertCanStartVerificationPayment(requestId) {
  if (!requestId) return { ok: true, payment: null }
  const active = await getActivePaymentForRequest(requestId)
  if (!active) return { ok: true, payment: null }
  if (active.payment_status === PAYMENT_STATUSES.CONFIRMED) {
    return {
      ok: false,
      alreadyPaid: true,
      payment: active,
      message: 'Payment is already confirmed for this verification.',
    }
  }
  if (active.payment_status === PAYMENT_STATUSES.AWAITING_CONFIRMATION) {
    return {
      ok: true,
      payment: active,
      awaiting: true,
      message: 'A payment proof is already awaiting admin confirmation.',
    }
  }
  // pending/initiated — allow reuse (same open row will be updated)
  return { ok: true, payment: active, reuse: true }
}

/**
 * Final submit after docs + (optional) payment intent.
 * If already paid/under_review, just mark submitted_at and keep status.
 * If draft unpaid, set submitted (admin can still require payment).
 */
export async function submitVerificationApplication(requestId, { notes = null } = {}) {
  if (!requestId) throw new Error('Request required')

  const { data: current, error: loadErr } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('id', requestId)
    .single()
  if (loadErr || !current) throw loadErr || new Error('Request not found')

  // Prefer RPC when already in review pipeline
  if ([VERIFICATION_STATUSES.PAYMENT_CONFIRMED, VERIFICATION_STATUSES.UNDER_REVIEW].includes(current.status)) {
    return current
  }

  if (current.status === VERIFICATION_STATUSES.PAYMENT_PENDING && current.payment_ref) {
    // Waiting for PayChangu return — keep status
    const { data } = await supabase
      .from('verification_requests')
      .update({
        notes: notes ?? current.notes,
        submitted_at: current.submitted_at || new Date().toISOString(),
        meta: { ...(current.meta || {}), wizard_step: 'status', submitted: true },
        updated_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select('*')
      .single()
    return data || current
  }

  // Draft → submitted (or under_review if docs complete and no payment required path)
  try {
    const { data, error } = await supabase.rpc('transition_verification_status', {
      p_request_id: requestId,
      p_to_status: VERIFICATION_STATUSES.SUBMITTED,
      p_note: notes,
    })
    if (!error && data) return Array.isArray(data) ? data[0] : data
  } catch { /* fall through */ }

  const { data, error } = await supabase
    .from('verification_requests')
    .update({
      status: VERIFICATION_STATUSES.SUBMITTED,
      notes: notes ?? current.notes,
      submitted_at: new Date().toISOString(),
      meta: { ...(current.meta || {}), wizard_step: 'status', submitted: true },
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select('*')
    .single()
  if (error) throw error

  try {
    if (data?.seller_id || current.seller_id) {
      await notifyVerificationLifecycle({
        userId: data?.seller_id || current.seller_id,
        event: 'submitted',
        requestId,
      })
    }
  } catch { /* soft */ }

  return data
}

export async function adminTransitionVerification(requestId, toStatus, note = null) {
  const { data, error } = await supabase.rpc('transition_verification_status', {
    p_request_id: requestId,
    p_to_status: toStatus,
    p_note: note,
    p_rejection_reason: toStatus === 'rejected' ? note : null,
    p_additional_info_message: toStatus === 'additional_info_required' ? note : null,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data

  // Always notify seller on key transitions (list buttons + detail drawer)
  try {
    const sellerId = row?.seller_id
    if (sellerId) {
      if (toStatus === VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED) {
        await notifyVerificationLifecycle({
          userId: sellerId,
          event: 'additional_info',
          requestId,
          message: note,
        })
      } else if (toStatus === VERIFICATION_STATUSES.APPROVED) {
        await notifyVerificationLifecycle({
          userId: sellerId,
          event: 'approved',
          requestId,
          message: note,
        })
      } else if (toStatus === VERIFICATION_STATUSES.REJECTED) {
        await notifyVerificationLifecycle({
          userId: sellerId,
          event: 'rejected',
          requestId,
          message: note,
        })
      } else if (toStatus === VERIFICATION_STATUSES.UNDER_REVIEW) {
        await notifyVerificationLifecycle({
          userId: sellerId,
          event: 'under_review',
          requestId,
          message: note,
        })
      }
    }
  } catch (e) {
    console.warn('adminTransitionVerification notify failed', e?.message || e)
  }

  return row
}

export async function initiatePaychanguCheckout({
  user,
  feeAmount,
  typeCode = 'seller',
  requestId = null,
}) {
  // Prevent parallel checkouts when an open payment already exists
  if (requestId) {
    const gate = await assertCanStartVerificationPayment(requestId)
    if (gate.alreadyPaid) {
      const err = new Error(gate.message)
      err.code = 'ALREADY_PAID'
      err.payment = gate.payment
      throw err
    }
  }

  const tx_ref = `SOKO-VERIFY-${user.id}-${Date.now()}`
  const baseUrl = window.location.origin
  const { data: fnData, error: fnErr } = await supabase.functions.invoke('initiate-payment', {
    body: {
      seller_id: user.id,
      email: user.email || '',
      first_name: user.user_metadata?.full_name?.split(' ')[0] || 'Seller',
      last_name: user.user_metadata?.full_name?.split(' ')[1] || '',
      tx_ref,
      // callback_url = server/webhook style; return_url = browser
      callback_url: `${baseUrl}/verify-payment`,
      return_url: `${baseUrl}/verify-payment`,
      amount: feeAmount,
      purpose: 'verification',
      title: 'SokoMW Seller Verification',
      description: `Seller verification fee (${typeCode})`,
    },
  })
  if (fnErr) throw new Error(typeof fnErr === 'string' ? fnErr : (fnErr.message || JSON.stringify(fnErr)))
  if (!fnData?.data?.checkout_url) throw new Error(JSON.stringify(fnData))
  return { tx_ref, checkout_url: fnData.data.checkout_url }
}

// ─── Phase 3: verification payments ───────────────────────────

export function paymentStatusLabel(status) {
  return statusLabel(status)
}

export async function getVerificationPaymentMethods() {
  try {
    const { data, error } = await supabase.rpc('get_verification_payment_methods')
    if (!error && Array.isArray(data) && data.length) return data
  } catch { /* ignore */ }
  try {
    const { data } = await supabase
      .from('verification_payment_methods')
      .select('*')
      .eq('is_active', true)
      .order('sort_order')
    if (data?.length) return data
  } catch { /* ignore */ }
  // Fallback catalog
  return [
    { code: 'pachangu', name: 'PayChangu (Mobile Money)', channel: 'gateway', supports_auto_confirm: true, sort_order: 5 },
    { code: 'airtel_money', name: 'Airtel Money', channel: 'mobile_money', supports_auto_confirm: false, sort_order: 10 },
    { code: 'tnm_mpamba', name: 'TNM Mpamba', channel: 'mobile_money', supports_auto_confirm: false, sort_order: 20 },
    { code: 'bank_transfer', name: 'Bank Transfer', channel: 'bank', supports_auto_confirm: false, sort_order: 30 },
    { code: 'card', name: 'Card Payment', channel: 'card', supports_auto_confirm: false, sort_order: 40 },
  ]
}

export async function getPaymentsForRequest(requestId, { paymentRef = null, sellerId = null } = {}) {
  if (!requestId && !paymentRef && !sellerId) return []

  let list = []
  if (requestId) {
    try {
      const { data, error } = await supabase.rpc('get_verification_payments_for_request', {
        p_request_id: requestId,
      })
      if (!error && Array.isArray(data)) list = data
    } catch { /* ignore */ }
    if (!list.length) {
      const { data } = await supabase
        .from('verification_payments')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })
      list = data || []
    }
  }

  // Fallback: match by payment_ref / seller (ledger may outlive a stale request row)
  if (!list.some((p) => String(p.payment_status || '').toLowerCase() === 'confirmed')) {
    if (paymentRef) {
      const ref = String(paymentRef).replace(/"/g, '')
      const { data: byRef } = await supabase
        .from('verification_payments')
        .select('*')
        .or(`transaction_reference.eq."${ref}",gateway_session_id.eq."${ref}"`)
        .order('created_at', { ascending: false })
        .limit(10)
      if (byRef?.length) {
        const merged = [...list]
        byRef.forEach((p) => {
          if (!merged.some((x) => x.id === p.id)) merged.push(p)
        })
        list = merged
      }
    }
    if (sellerId && requestId) {
      const { data: bySeller } = await supabase
        .from('verification_payments')
        .select('*')
        .eq('seller_id', sellerId)
        .eq('request_id', requestId)
        .order('created_at', { ascending: false })
        .limit(10)
      if (bySeller?.length) {
        const merged = [...list]
        bySeller.forEach((p) => {
          if (!merged.some((x) => x.id === p.id)) merged.push(p)
        })
        list = merged
      }
    }
  }

  // Confirmed first for stable UI
  return [...list].sort((a, b) => {
    const ac = String(a.payment_status || '').toLowerCase() === 'confirmed' ? 1 : 0
    const bc = String(b.payment_status || '').toLowerCase() === 'confirmed' ? 1 : 0
    if (ac !== bc) return bc - ac
    return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  })
}

export async function createVerificationPayment({
  requestId,
  paymentMethod,
  paymentAmount,
  currency = 'MWK',
  transactionReference = null,
  gateway = 'manual',
  gatewaySessionId = null,
  gatewayPayload = {},
  status = 'initiated',
}) {
  // Never allow client to create as confirmed
  const safeStatus = status === PAYMENT_STATUSES.CONFIRMED
    ? PAYMENT_STATUSES.INITIATED
    : (status || PAYMENT_STATUSES.INITIATED)

  // Duplicate guard
  if (requestId) {
    const gate = await assertCanStartVerificationPayment(requestId)
    if (gate.alreadyPaid) return gate.payment
  }

  try {
    const { data, error } = await supabase.rpc('create_verification_payment', {
      p_request_id: requestId,
      p_payment_method: paymentMethod,
      p_payment_amount: paymentAmount,
      p_currency: currency,
      p_transaction_reference: transactionReference,
      p_gateway: gateway,
      p_gateway_session_id: gatewaySessionId,
      p_gateway_payload: gatewayPayload,
      p_status: safeStatus,
    })
    if (!error && data) return Array.isArray(data) ? data[0] : data
    if (error) throw error
  } catch (e) {
    // Fallback: reuse open row or insert non-confirmed
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw e

    const existing = await getActivePaymentForRequest(requestId)
    if (existing?.payment_status === PAYMENT_STATUSES.CONFIRMED) return existing
    if (existing && OPEN_PAYMENT_STATUSES.includes(existing.payment_status)) {
      const { data: updated, error: upErr } = await supabase
        .from('verification_payments')
        .update({
          payment_method: paymentMethod,
          transaction_reference: transactionReference || existing.transaction_reference,
          payment_status: safeStatus === PAYMENT_STATUSES.CONFIRMED
            ? PAYMENT_STATUSES.INITIATED
            : safeStatus,
          gateway,
          gateway_session_id: gatewaySessionId || existing.gateway_session_id,
          gateway_payload: { ...(existing.gateway_payload || {}), ...gatewayPayload },
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .eq('seller_id', user.id)
        .select('*')
        .single()
      if (!upErr && updated) return updated
    }

    const { data, error } = await supabase
      .from('verification_payments')
      .insert({
        request_id: requestId,
        seller_id: user.id,
        payment_method: paymentMethod,
        payment_amount: paymentAmount,
        currency,
        transaction_reference: transactionReference,
        payment_status: safeStatus === PAYMENT_STATUSES.CONFIRMED
          ? PAYMENT_STATUSES.INITIATED
          : safeStatus,
        gateway,
        gateway_session_id: gatewaySessionId,
        gateway_payload: gatewayPayload,
      })
      .select('*')
      .single()
    if (error) throw error
    return data
  }
}

export async function submitPaymentProof({
  paymentId,
  transactionReference,
  receiptPath = null,
  receiptFileName = null,
  paymentDate = null,
  requireReceipt = false,
}) {
  const ref = String(transactionReference || '').trim()
  if (ref.length < 3) throw new Error('Enter a valid transaction / reference ID (at least 3 characters).')
  if (requireReceipt && !receiptPath) {
    throw new Error('Upload payment proof (receipt) before submitting.')
  }

  let row = null
  try {
    const { data, error } = await supabase.rpc('submit_verification_payment_proof', {
      p_payment_id: paymentId,
      p_transaction_reference: ref,
      p_receipt_path: receiptPath,
      p_receipt_file_name: receiptFileName,
      p_payment_date: paymentDate || new Date().toISOString(),
    })
    if (!error && data) row = Array.isArray(data) ? data[0] : data
    else if (error) throw error
  } catch (e) {
    // Never allow seller to set confirmed here
    const { data, error } = await supabase
      .from('verification_payments')
      .update({
        transaction_reference: ref,
        receipt_path: receiptPath,
        receipt_file_name: receiptFileName,
        payment_date: paymentDate || new Date().toISOString(),
        payment_status: PAYMENT_STATUSES.AWAITING_CONFIRMATION,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .in('payment_status', OPEN_PAYMENT_STATUSES)
      .select('*')
      .single()
    if (error) throw e
    row = data
  }

  try {
    await notifyAdminsVerificationEvent({
      event: ADMIN_VERIFICATION_EVENTS.PAYMENT_AWAITING,
      title: 'Manual payment awaiting confirmation',
      body: `Payment proof submitted (ref ${ref}). Confirm or reject in Verifications.`,
      requestId: row?.request_id || null,
      sellerId: row?.seller_id || null,
      data: { payment_id: paymentId, transaction_reference: ref },
    })
  } catch { /* soft */ }

  return row
}

export async function uploadPaymentReceipt({ userId, paymentId, file }) {
  if (!userId || !file || !paymentId) throw new Error('Missing receipt upload args')
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
  const path = `${userId}/payments/${paymentId}/receipt_${Date.now()}.${ext}`
  const { error: upErr } = await supabase.storage
    .from('verification-docs')
    .upload(path, file, { upsert: false, contentType: file.type || undefined })
  if (upErr) throw upErr
  return { path, fileName: file.name }
}

export async function adminConfirmPayment(paymentId, adminNotes = null, advanceRequest = true) {
  const { data, error } = await supabase.rpc('admin_confirm_verification_payment', {
    p_payment_id: paymentId,
    p_admin_notes: adminNotes,
    p_advance_request: advanceRequest,
  })
  if (error) throw error
  return Array.isArray(data) ? data[0] : data
}

export async function adminRejectPayment(paymentId, adminNotes = null) {
  const { data, error } = await supabase.rpc('admin_reject_verification_payment', {
    p_payment_id: paymentId,
    p_admin_notes: adminNotes,
  })
  if (error) throw error
  const row = Array.isArray(data) ? data[0] : data
  try {
    const sellerId = row?.seller_id
    if (sellerId) {
      await notifyVerificationLifecycle({
        userId: sellerId,
        event: 'payment_rejected',
        requestId: row?.request_id || null,
        message: adminNotes || 'Your payment proof was rejected. Please upload a valid receipt.',
      })
    }
  } catch { /* soft */ }
  return row
}

// ─── Admin verification review (detail drawer) ─────────────

const SIGNED_URL_TTL_SEC = 60 * 30 // 30 minutes

/**
 * Private verification-docs signed URL (never public).
 */
export async function createVerificationDocSignedUrl(storagePath, expiresIn = SIGNED_URL_TTL_SEC) {
  if (!storagePath) return null
  const { data, error } = await supabase.storage
    .from('verification-docs')
    .createSignedUrl(storagePath, expiresIn)
  if (error) throw error
  return data?.signedUrl || null
}

/**
 * Admin: documents for a request (no seller-id filter).
 */
export async function getAdminVerificationDocuments(requestId) {
  if (!requestId) return []
  const { data, error } = await supabase
    .from('verification_documents')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false })
  if (error) {
    // Fallback: some rows may only be keyed by user
    return []
  }
  return data || []
}

/**
 * Chronological status timeline for a request.
 */
export async function getVerificationStatusEvents(requestId) {
  if (!requestId) return []
  const { data, error } = await supabase
    .from('verification_status_events')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: true })
  if (error) return []
  return data || []
}

/**
 * Load full seller profile for admin review.
 * - Prefer select('*') so no columns are dropped by progressive fails
 * - Merge auth.users email/phone via admin_get_seller_contact RPC when available
 * - Fill gaps from shops / listings / request meta
 */
export async function getAdminSellerProfile(sellerId, { request = null } = {}) {
  if (!sellerId) return null

  let profile = null

  // 1) SECURITY DEFINER RPC: profiles row + auth.users contact (best source for email/phone)
  try {
    const { data, error } = await supabase.rpc('admin_get_seller_contact', {
      p_user_id: sellerId,
    })
    if (!error && data) {
      const payload = typeof data === 'string' ? JSON.parse(data) : data
      if (payload && typeof payload === 'object') {
        const nested = payload.profile && typeof payload.profile === 'object' ? payload.profile : {}
        // RPC flattens auth + profile fields on the root
        const { profile: _nestedProfile, raw_user_meta_data: meta, ...rest } = payload
        const metaObj = meta && typeof meta === 'object' ? meta : {}
        profile = {
          ...nested,
          ...rest,
          id: payload.id || nested.id || sellerId,
          full_name: nested.full_name || rest.full_name || metaObj.full_name || metaObj.name || null,
          avatar_url: nested.avatar_url || rest.avatar_url || metaObj.avatar_url || null,
          email: rest.email || rest.auth_email || nested.email || metaObj.email || null,
          phone: rest.phone || rest.auth_phone || nested.phone || nested.whatsapp
            || metaObj.phone || metaObj.phone_number || null,
          city: nested.city || rest.city || metaObj.city || null,
          created_at: nested.created_at || rest.created_at || rest.auth_created_at || null,
          auth_email: rest.auth_email || null,
          auth_phone: rest.auth_phone || null,
          auth_created_at: rest.auth_created_at || null,
          last_sign_in_at: rest.last_sign_in_at || null,
          email_confirmed_at: rest.email_confirmed_at || null,
          phone_confirmed_at: rest.phone_confirmed_at || null,
        }
      }
    }
  } catch { /* RPC may not be applied yet */ }

  // 2) Always try full row (* first — never drop created_at/phone because of missing optional cols)
  if (!profile || !profile.full_name) {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', sellerId)
      .maybeSingle()
    if (!error && data) {
      profile = { ...(profile || {}), ...data }
    }
  }

  // 3) Progressive fallbacks if * failed (rare)
  if (!profile) {
    const selects = [
      'id, full_name, avatar_url, phone, city, email, role, is_verified, verification_status, created_at, updated_at, last_seen',
      'id, full_name, avatar_url, phone, city, created_at, role, is_verified',
      'id, full_name, avatar_url, city, created_at',
      'id, full_name, avatar_url, city',
    ]
    for (const sel of selects) {
      const { data, error } = await supabase
        .from('profiles')
        .select(sel)
        .eq('id', sellerId)
        .maybeSingle()
      if (!error && data) {
        profile = data
        break
      }
    }
  }

  if (!profile) {
    profile = {
      id: sellerId,
      full_name: null,
      avatar_url: null,
      phone: null,
      city: null,
      email: null,
      _missing: true,
    }
  }

  // Normalize alternate column names some DBs use
  const pick = (...keys) => {
    for (const k of keys) {
      const v = profile[k]
      if (v != null && String(v).trim() !== '') return v
    }
    return null
  }

  profile.phone = pick('phone', 'phone_number', 'mobile', 'mobile_number', 'contact_phone', 'whatsapp', 'auth_phone')
  profile.email = pick('email', 'email_address', 'contact_email', 'auth_email')
  profile.city = pick('city', 'town', 'district')
  profile.location = pick('location', 'address', 'area', 'suburb')
  profile.created_at = pick('created_at', 'inserted_at', 'joined_at', 'auth_created_at') || profile.created_at

  // Request meta may hold contact from wizard
  const meta = request?.meta || {}
  if (!profile.phone) {
    profile.phone = meta.phone || meta.contact_phone || meta.whatsapp || null
  }
  if (!profile.email) {
    profile.email = meta.email || meta.contact_email || null
  }

  // Shops — often have city / contact
  let shops = []
  try {
    const shopSelects = [
      'id, name, slug, logo_url, city, phone, email, whatsapp, is_verified, created_at, address, location',
      'id, name, slug, logo_url, city, phone, is_verified, created_at',
      'id, name, slug, logo_url, city, is_verified, created_at',
      'id, name, slug, logo_url, city, created_at',
    ]
    for (const sel of shopSelects) {
      const { data: shopRows, error } = await supabase
        .from('shops')
        .select(sel)
        .eq('owner_id', sellerId)
        .limit(10)
      if (!error && shopRows) {
        shops = shopRows
        break
      }
    }
  } catch { /* shops optional */ }

  if (!profile.phone) {
    const shopPhone = shops.find((s) => s.phone || s.whatsapp)
    if (shopPhone) profile.phone = shopPhone.phone || shopPhone.whatsapp
  }
  if (!profile.email) {
    const shopEmail = shops.find((s) => s.email)
    if (shopEmail) profile.email = shopEmail.email
  }
  if (!profile.city) {
    const shopCity = shops.find((s) => s.city)
    if (shopCity) profile.city = shopCity.city
  }
  if (!profile.location) {
    const shopLoc = shops.find((s) => s.location || s.address)
    if (shopLoc) profile.location = shopLoc.location || shopLoc.address
  }

  // Listing count + sample cities from listings
  let listingCount = null
  try {
    const { count } = await supabase
      .from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', sellerId)
    listingCount = count
  } catch { /* optional */ }

  // Display helpers (never leave blank when auth data exists)
  const displayPhone = profile.phone || profile.auth_phone || null
  const displayEmail = profile.email || profile.auth_email || null
  const displayJoined = profile.created_at || profile.auth_created_at || null

  // Every non-empty raw field for "All profile fields" UI
  const extraFields = {}
  Object.keys(profile).forEach((k) => {
    if (['shops', 'listing_count', 'extra_fields', '_missing'].includes(k)) return
    const v = profile[k]
    if (v == null || v === '') return
    if (typeof v === 'object') return
    extraFields[k] = v
  })

  return {
    ...profile,
    phone: displayPhone,
    email: displayEmail,
    created_at: displayJoined,
    shops,
    listing_count: listingCount,
    extra_fields: extraFields,
  }
}

/**
 * Full admin detail payload: request, profile, type, docs, payments, events.
 */
export async function getAdminVerificationDetail(requestId) {
  if (!requestId) throw new Error('Request id required')

  let request = null
  const { data: row, error } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('id', requestId)
    .maybeSingle()
  if (error) throw error
  request = row
  if (!request) throw new Error('Verification request not found')

  let profile = null
  if (request.seller_id) {
    profile = await getAdminSellerProfile(request.seller_id, { request })
  }

  let verificationType = null
  if (request.verification_type_id) {
    const { data: t } = await supabase
      .from('verification_types')
      .select('*')
      .eq('id', request.verification_type_id)
      .maybeSingle()
    verificationType = t
  }
  if (!verificationType && request.meta?.type_code) {
    const { data: t2 } = await supabase
      .from('verification_types')
      .select('*')
      .eq('code', request.meta.type_code)
      .maybeSingle()
    verificationType = t2
  }

  let docs = await getAdminVerificationDocuments(requestId)
  if ((!docs || !docs.length) && request.seller_id) {
    docs = await getVerificationDocuments(requestId, request.seller_id)
  }

  const payments = await getPaymentsForRequest(requestId)
  const events = await getVerificationStatusEvents(requestId)

  // Resolve actor display names for timeline (batch)
  const actorIds = [...new Set(events.map((e) => e.actor_id).filter(Boolean))]
  let actorMap = {}
  if (actorIds.length) {
    const { data: actors } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('id', actorIds)
    actorMap = Object.fromEntries((actors || []).map((a) => [a.id, a]))
  }

  const timeline = events.map((ev) => {
    const actor = ev.actor_id ? actorMap[ev.actor_id] : null
    let actorRole = 'system'
    if (ev.actor_id) {
      if (ev.actor_id === request.seller_id) actorRole = 'seller'
      else if (actor?.role === 'admin') actorRole = 'admin'
      else actorRole = 'admin' // non-seller actor treating as staff/system-admin
    }
    return {
      ...ev,
      actor_name: actor?.full_name || null,
      actor_role: actorRole,
      label: formatTimelineLabel(ev),
    }
  })

  // Signed URLs for docs + payment receipts (private bucket)
  const docsWithUrls = await Promise.all(
    (docs || []).map(async (d) => {
      let signedUrl = null
      try {
        if (d.storage_path) signedUrl = await createVerificationDocSignedUrl(d.storage_path)
      } catch { /* leave null */ }
      return { ...d, signedUrl }
    })
  )

  const paymentsWithUrls = await Promise.all(
    (payments || []).map(async (p) => {
      let receiptUrl = null
      try {
        if (p.receipt_path) receiptUrl = await createVerificationDocSignedUrl(p.receipt_path)
      } catch { /* leave null */ }
      return { ...p, receiptUrl }
    })
  )

  return {
    request,
    profile,
    verificationType,
    docs: docsWithUrls,
    payments: paymentsWithUrls,
    timeline,
    typeCode: verificationType?.code || request.meta?.type_code || 'seller',
  }
}

function formatTimelineLabel(ev) {
  const to = ev.to_status || ''
  const note = (ev.note || '').toLowerCase()
  if (note === 'created' || !ev.from_status) return 'Application created'
  if (to === 'submitted') return 'Application submitted'
  if (to === 'payment_pending') return 'Payment initiated'
  if (to === 'payment_confirmed') return 'Payment confirmed'
  if (to === 'under_review') return 'Under review'
  if (to === 'additional_info_required') return 'Additional information requested'
  if (to === 'approved') return 'Approved'
  if (to === 'rejected') return 'Rejected'
  if (to === 'cancelled') return 'Cancelled'
  if (to === 'expired') return 'Expired'
  if (to === 'draft') return 'Draft saved'
  return `Status → ${statusLabel(to)}`
}

/**
 * Pre-approve checks for admin UI.
 */
export function getAdminApprovalReadiness({ request, payments = [], docs = [], verificationType = null, settings = null } = {}) {
  const paymentOk = checkPaymentRequirement(request, payments).ok
    || !!request?.payment_confirmed_at
    || [VERIFICATION_STATUSES.PAYMENT_CONFIRMED, VERIFICATION_STATUSES.UNDER_REVIEW, VERIFICATION_STATUSES.APPROVED]
      .includes(request?.status)

  const required = resolveRequiredDocumentTypes(
    verificationType || { code: request?.meta?.type_code || 'seller' },
    settings
  )
  const requireDocuments = settings?.require_documents !== false
  const docsCheck = checkDocumentRequirements(docs, required, { requireDocuments })

  const blockers = []
  if (!paymentOk) blockers.push('Payment is not confirmed (or manual proof is not awaiting confirmation).')
  if (!docsCheck.ok) {
    blockers.push(
      docsCheck.missingLabels?.length
        ? `Missing required documents: ${docsCheck.missingLabels.join(', ')}.`
        : 'Required documents are missing.'
    )
  }

  return {
    ok: blockers.length === 0,
    paymentOk,
    docsOk: docsCheck.ok,
    requiredDocs: required,
    docsCheck,
    blockers,
  }
}

/**
 * Append an internal admin note (does not change request status).
 * Stores latest on admin_note and history on meta.internal_notes.
 */
export async function appendVerificationAdminNote(requestId, note, { adminId = null, adminName = null } = {}) {
  const text = String(note || '').trim()
  if (!requestId || !text) throw new Error('Note is required')

  const { data: current, error: loadErr } = await supabase
    .from('verification_requests')
    .select('id, admin_note, meta')
    .eq('id', requestId)
    .single()
  if (loadErr || !current) throw loadErr || new Error('Request not found')

  const entry = {
    note: text,
    admin_id: adminId,
    admin_name: adminName,
    at: new Date().toISOString(),
  }
  const prev = Array.isArray(current.meta?.internal_notes) ? current.meta.internal_notes : []
  const meta = {
    ...(current.meta || {}),
    internal_notes: [...prev, entry],
  }

  const { data, error } = await supabase
    .from('verification_requests')
    .update({
      admin_note: text,
      meta,
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .select('*')
    .single()
  if (error) throw error

  // Best-effort audit row (status unchanged)
  try {
    await supabase.from('verification_status_events').insert({
      request_id: requestId,
      from_status: null,
      to_status: 'admin_note',
      actor_id: adminId,
      note: text,
      meta: { kind: 'internal_note' },
    })
  } catch { /* RLS may block if status enum constrained elsewhere — ignore */ }

  return data
}

/**
 * Approve with readiness check. Uses RPC so profiles + shops sync via triggers.
 * Shop/business types still get shops.is_verified via DB trigger; fallback updates shops when type is shop.
 */
export async function adminApproveVerification(requestId, note = null, { force = false, readiness = null } = {}) {
  if (!force && readiness && !readiness.ok) {
    const err = new Error(readiness.blockers?.[0] || 'Cannot approve — requirements not met')
    err.code = 'APPROVAL_BLOCKED'
    err.blockers = readiness.blockers
    throw err
  }
  const updated = await adminTransitionVerification(requestId, VERIFICATION_STATUSES.APPROVED, note)
  // Belt-and-suspenders shop flag for shop/business (trigger also does this)
  try {
    const typeCode = updated?.meta?.type_code
    let code = typeCode
    if (!code && updated?.verification_type_id) {
      const { data: t } = await supabase
        .from('verification_types')
        .select('code')
        .eq('id', updated.verification_type_id)
        .maybeSingle()
      code = t?.code
    }
    if (updated?.seller_id && (code === 'shop' || code === 'business')) {
      await supabase.from('shops').update({ is_verified: true }).eq('owner_id', updated.seller_id)
    }
  } catch { /* optional */ }
  // Notification sent inside adminTransitionVerification
  return updated
}

export async function adminRejectVerification(requestId, reason) {
  const text = String(reason || '').trim()
  if (!text) throw new Error('Rejection reason is required')
  // Notification sent inside adminTransitionVerification
  return adminTransitionVerification(requestId, VERIFICATION_STATUSES.REJECTED, text)
}

export async function adminRequestMoreInfo(requestId, message) {
  const text = String(message || '').trim()
  if (!text) throw new Error('Please describe what additional information is needed')
  // Sets status + additional_info_message and notifies seller
  return adminTransitionVerification(
    requestId,
    VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED,
    text
  )
}

// ─── Admin Verification Settings module ───────────────────

export async function adminUpdateVerificationSettings(patch = {}) {
  const { data, error } = await supabase.rpc('admin_update_verification_settings', {
    p_patch: patch,
  })
  clearVerificationSettingsCache()
  if (error) {
    // Fallback: read-merge extra then update (admin RLS)
    let extra = patch.extra
    if (patch.extra) {
      const { data: cur } = await supabase
        .from('verification_settings')
        .select('extra')
        .eq('id', 1)
        .maybeSingle()
      extra = { ...(cur?.extra || {}), ...patch.extra }
    }
    const body = { ...patch, updated_at: new Date().toISOString() }
    if (extra) body.extra = extra
    const { data: row, error: e2 } = await supabase
      .from('verification_settings')
      .update(body)
      .eq('id', 1)
      .select('*')
      .single()
    if (e2) throw error
    return row
  }
  return Array.isArray(data) ? data[0] : data
}

export async function adminUpdateVerificationType({
  code,
  name = null,
  description = null,
  defaultFeeAmount = null,
  requiredDocumentTypes = null,
  isActive = null,
  sortOrder = null,
  meta = null,
}) {
  const { data, error } = await supabase.rpc('admin_update_verification_type', {
    p_code: code,
    p_name: name,
    p_description: description,
    p_default_fee_amount: defaultFeeAmount,
    p_required_document_types: requiredDocumentTypes,
    p_is_active: isActive,
    p_sort_order: sortOrder,
    p_meta: meta,
  })
  if (error) {
    const patch = {
      updated_at: new Date().toISOString(),
    }
    if (name != null) patch.name = name
    if (description != null) patch.description = description
    if (defaultFeeAmount != null) patch.default_fee_amount = defaultFeeAmount
    if (requiredDocumentTypes != null) patch.required_document_types = requiredDocumentTypes
    if (isActive != null) patch.is_active = isActive
    if (sortOrder != null) patch.sort_order = sortOrder
    if (meta != null) patch.meta = meta
    const { data: row, error: e2 } = await supabase
      .from('verification_types')
      .update(patch)
      .eq('code', code)
      .select('*')
      .single()
    if (e2) throw error
    return row
  }
  return Array.isArray(data) ? data[0] : data
}

export async function adminUpdatePaymentMethod({
  code,
  isActive = null,
  instructions = null,
  name = null,
  sortOrder = null,
  meta = null,
}) {
  const { data, error } = await supabase.rpc('admin_update_verification_payment_method', {
    p_code: code,
    p_is_active: isActive,
    p_instructions: instructions,
    p_name: name,
    p_sort_order: sortOrder,
    p_meta: meta,
  })
  if (error) {
    const patch = { updated_at: new Date().toISOString() }
    if (isActive != null) patch.is_active = isActive
    if (instructions != null) patch.instructions = instructions
    if (name != null) patch.name = name
    if (sortOrder != null) patch.sort_order = sortOrder
    if (meta != null) patch.meta = meta
    const { data: row, error: e2 } = await supabase
      .from('verification_payment_methods')
      .update(patch)
      .eq('code', code)
      .select('*')
      .single()
    if (e2) throw error
    return row
  }
  return Array.isArray(data) ? data[0] : data
}

/**
 * Progressive profile update — strips columns that don't exist on older DBs.
 * Admin RLS allows is_admin() updates on profiles.
 */
async function adminUpdateSellerProfile(sellerId, patches) {
  if (!sellerId) throw new Error('Seller id required')
  let lastErr = null
  for (const patch of patches) {
    const body = { ...patch }
    // Never send undefined
    Object.keys(body).forEach((k) => {
      if (body[k] === undefined) delete body[k]
    })
    const { data, error } = await supabase
      .from('profiles')
      .update(body)
      .eq('id', sellerId)
      .select('id, is_verified, full_name')
      .maybeSingle()
    if (!error) {
      // Ensure a row was actually updated (RLS can return 0 rows without error)
      if (data?.id) return data
      // Retry without select in case select columns blocked
      const { error: e2 } = await supabase
        .from('profiles')
        .update(body)
        .eq('id', sellerId)
      if (!e2) {
        // Verify flag stuck
        const { data: check } = await supabase
          .from('profiles')
          .select('id, is_verified')
          .eq('id', sellerId)
          .maybeSingle()
        if (check?.id) return check
        lastErr = new Error('Update blocked — no profile row changed. Confirm your role is admin.')
        continue
      }
      lastErr = e2
      continue
    }
    lastErr = error
    const msg = String(error.message || '')
    // Unknown column → try next smaller patch
    if (/column|schema cache|Could not find/i.test(msg)) continue
    // Permission → stop
    if (/policy|permission|rls|not allowed|42501/i.test(msg)) break
  }
  throw lastErr || new Error('Could not update seller profile. Ensure your account has admin role.')
}

async function adminSoftUpdateRequest(requestId, patch) {
  if (!requestId) return
  try {
    const body = { ...patch, updated_at: new Date().toISOString() }
    Object.keys(body).forEach((k) => { if (body[k] === undefined) delete body[k] })
    await supabase.from('verification_requests').update(body).eq('id', requestId)
  } catch { /* soft */ }
}

async function adminSoftLogEvent(requestId, fromStatus, toStatus, note, meta = {}) {
  if (!requestId) return
  try {
    await supabase.from('verification_status_events').insert({
      request_id: requestId,
      from_status: fromStatus,
      to_status: toStatus,
      note,
      meta: { ...meta, admin: true },
    })
  } catch { /* soft — insert often admin-only without SECURITY DEFINER */ }
}

export async function adminManualVerificationAction({
  action,
  sellerId = null,
  requestId = null,
  note = null,
}) {
  const act = String(action || '').toLowerCase().trim()
  const reason = String(note || '').trim() || 'Admin action'

  if (!sellerId) throw new Error('Seller id required')

  // 1) Prefer SECURITY DEFINER RPC (bypasses RLS / column quirks)
  try {
    const { data, error } = await supabase.rpc('admin_manual_verification_action', {
      p_action: act,
      p_seller_id: sellerId,
      p_request_id: requestId,
      p_note: reason,
    })
    if (!error && data) {
      try {
        const event =
          act === 'approve' || act === 'reactivate' ? 'approved'
            : act === 'reject' ? 'rejected'
              : act === 'remove_badge' || act === 'suspend' ? 'removed'
                : act === 'reverify' || act === 'request_reverification' ? 'reverify'
                  : null
        if (event) {
          await notifyVerificationLifecycle({
            userId: sellerId,
            event,
            requestId,
            message: reason,
          })
        }
      } catch { /* soft */ }
      return data
    }
    // Fall through on any RPC error (missing migration, SQL error, etc.)
  } catch { /* fall through to client path */ }

  // 2) Client path — progressive profile updates
  const now = new Date().toISOString()

  if (act === 'remove_badge' || act === 'suspend') {
    const status = act === 'suspend' ? 'suspended' : 'removed'
    await adminUpdateSellerProfile(sellerId, [
      {
        is_verified: false,
        verification_status: status,
        verified_at: null,
        rejection_reason: reason,
        updated_at: now,
      },
      {
        is_verified: false,
        verification_status: status,
        verified_at: null,
        updated_at: now,
      },
      { is_verified: false, verified_at: null, updated_at: now },
      { is_verified: false },
    ])
    try {
      await supabase.from('shops').update({ is_verified: false }).eq('owner_id', sellerId)
    } catch { /* optional */ }
    await adminSoftUpdateRequest(requestId, {
      admin_note: reason,
      ...(act === 'suspend' ? { status: 'cancelled' } : {}),
    })
    await adminSoftLogEvent(
      requestId,
      'approved',
      act === 'suspend' ? 'cancelled' : 'approved',
      reason,
      { event: act === 'suspend' ? 'suspended' : 'badge_removed' },
    )
    try {
      await notifyVerificationLifecycle({
        userId: sellerId,
        event: 'removed',
        requestId,
        message: reason,
      })
    } catch { /* soft */ }
    return { ok: true, action: act, seller_id: sellerId, fallback: true }
  }

  if (act === 'approve' || act === 'reactivate') {
    await adminUpdateSellerProfile(sellerId, [
      {
        is_verified: true,
        verification_status: 'approved',
        verified_at: now,
        rejection_reason: null,
        updated_at: now,
      },
      { is_verified: true, verification_status: 'approved', verified_at: now, updated_at: now },
      { is_verified: true, verified_at: now },
      { is_verified: true },
    ])
    try {
      await supabase.from('shops').update({ is_verified: true }).eq('owner_id', sellerId)
    } catch { /* optional */ }
    if (requestId) {
      try {
        await adminTransitionVerification(requestId, VERIFICATION_STATUSES.APPROVED, reason)
      } catch {
        await adminSoftUpdateRequest(requestId, {
          status: 'approved',
          admin_note: reason,
          reviewed_at: now,
        })
      }
    }
    try {
      await notifyVerificationLifecycle({
        userId: sellerId,
        event: 'approved',
        requestId,
        message: reason,
      })
    } catch { /* soft */ }
    return { ok: true, action: act, seller_id: sellerId, fallback: true }
  }

  if (act === 'reject') {
    await adminUpdateSellerProfile(sellerId, [
      {
        is_verified: false,
        verification_status: 'rejected',
        rejection_reason: reason,
        verified_at: null,
        updated_at: now,
      },
      { is_verified: false, verification_status: 'rejected', verified_at: null, updated_at: now },
      { is_verified: false, verified_at: null },
      { is_verified: false },
    ])
    try {
      await supabase.from('shops').update({ is_verified: false }).eq('owner_id', sellerId)
    } catch { /* optional */ }
    if (requestId) {
      try {
        await adminTransitionVerification(requestId, VERIFICATION_STATUSES.REJECTED, reason)
      } catch {
        await adminSoftUpdateRequest(requestId, {
          status: 'rejected',
          rejection_reason: reason,
          admin_note: reason,
          reviewed_at: now,
        })
      }
    }
    try {
      await notifyVerificationLifecycle({
        userId: sellerId,
        event: 'rejected',
        requestId,
        message: reason,
      })
    } catch { /* soft */ }
    return { ok: true, action: act, seller_id: sellerId, fallback: true }
  }

  if (act === 'reverify' || act === 'request_reverification') {
    await adminUpdateSellerProfile(sellerId, [
      {
        is_verified: false,
        verification_status: 'reverification_required',
        rejection_reason: reason,
        verified_at: null,
        updated_at: now,
      },
      {
        is_verified: false,
        verification_status: 'reverification_required',
        verified_at: null,
        updated_at: now,
      },
      { is_verified: false, verified_at: null },
      { is_verified: false },
    ])
    try {
      await supabase.from('shops').update({ is_verified: false }).eq('owner_id', sellerId)
    } catch { /* optional */ }
    await adminSoftUpdateRequest(requestId, {
      admin_note: reason,
      status: 'expired',
    })
    await adminSoftLogEvent(requestId, 'approved', 'expired', reason, { event: 'reverification_required' })
    try {
      await notifyVerificationLifecycle({
        userId: sellerId,
        event: 'reverify',
        requestId,
        message: reason,
      })
    } catch { /* soft */ }
    return { ok: true, action: act, seller_id: sellerId, fallback: true }
  }

  throw new Error(`Unknown action: ${action}`)
}

export async function getVerificationAnalytics() {
  const { data, error } = await supabase.rpc('get_verification_analytics')
  if (!error && data) {
    const row = Array.isArray(data) ? data[0] : data
    // Enrich with today_completed if RPC omitted it
    if (row && row.today_completed == null) {
      try {
        const start = new Date()
        start.setHours(0, 0, 0, 0)
        const { count } = await supabase
          .from('verification_requests')
          .select('id', { count: 'exact', head: true })
          .in('status', ['approved', 'rejected'])
          .gte('reviewed_at', start.toISOString())
        row.today_completed = count || 0
      } catch { row.today_completed = 0 }
    }
    return row
  }
  // Soft fallback counts
  const { data: rows } = await supabase
    .from('verification_requests')
    .select('status, created_at, reviewed_at, amount_paid')
  const list = rows || []
  const count = (s) => list.filter((r) => r.status === s).length
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const todayIso = start.toISOString()
  let revenue = 0
  try {
    const { data: pays } = await supabase
      .from('verification_payments')
      .select('payment_amount')
      .eq('payment_status', 'confirmed')
    revenue = (pays || []).reduce((s, p) => s + Number(p.payment_amount || 0), 0)
  } catch { /* optional */ }
  return {
    total_requests: list.length,
    approved: count('approved'),
    rejected: count('rejected'),
    pending: list.filter((r) => ['pending', 'submitted', 'payment_pending', 'payment_confirmed'].includes(r.status)).length,
    under_review: count('under_review'),
    additional_info: count('additional_info_required'),
    payment_pending: count('payment_pending'),
    draft: count('draft'),
    expired: count('expired'),
    cancelled: count('cancelled'),
    total_revenue: revenue,
    approval_rate: 0,
    today_requests: list.filter((r) => r.created_at && r.created_at >= todayIso).length,
    today_completed: list.filter((r) =>
      ['approved', 'rejected'].includes(r.status) && r.reviewed_at && r.reviewed_at >= todayIso
    ).length,
    month_requests: 0,
    verified_profiles: 0,
    manually_removed: 0,
  }
}

/** Admin-facing notification event kinds */
export const ADMIN_VERIFICATION_EVENTS = Object.freeze({
  NEW_REQUEST: 'admin_verification_new',
  RESUBMITTED: 'admin_verification_resubmitted',
  DOCS_UPLOADED: 'admin_verification_docs',
  PAYMENT_PROOF: 'admin_verification_payment_proof',
  PAYMENT_AWAITING: 'admin_verification_payment_awaiting',
  APPROVED: 'admin_verification_approved',
  REJECTED: 'admin_verification_rejected',
  REMOVED: 'admin_verification_removed',
  EXPIRED: 'admin_verification_expired',
  USER_RESPONDED: 'admin_verification_user_responded',
})

/**
 * Notify all admin accounts about a verification queue event.
 * Uses notify_admins RPC when available; else fans out notify_user to each admin.
 */
export async function notifyAdminsVerificationEvent({
  event,
  title,
  body,
  requestId = null,
  sellerId = null,
  sellerName = null,
  data = {},
}) {
  if (!title) return null
  const type = event || ADMIN_VERIFICATION_EVENTS.NEW_REQUEST
  const payload = {
    ...data,
    request_id: requestId,
    seller_id: sellerId,
    seller_name: sellerName,
    kind: type,
    admin_verification: true,
    open_admin_verify: true,
  }
  const link = requestId ? `/admin?tab=Verifications&request=${requestId}` : '/admin?tab=Verifications'

  try {
    const { data: n, error } = await supabase.rpc('notify_admins', {
      p_type: type,
      p_title: title,
      p_body: body || title,
      p_link: link,
      p_data: payload,
    })
    if (!error && n != null) return { count: n, via: 'rpc' }
  } catch { /* fall through */ }

  // Fallback: notify each admin profile
  try {
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin')
    const ids = (admins || []).map((a) => a.id).filter(Boolean)
    let count = 0
    for (const adminId of ids) {
      try {
        const row = await notifySellerVerificationEvent({
          userId: adminId,
          type,
          title,
          body: body || title,
          requestId,
          link,
          persistent: true,
        })
        if (row) count += 1
      } catch { /* skip */ }
    }
    return { count, via: 'fanout' }
  } catch (e) {
    console.warn('notifyAdminsVerificationEvent failed', e?.message || e)
    return null
  }
}

/**
 * Unread admin verification notifications for the signed-in admin.
 */
export async function getAdminVerificationNotifications({ limit = 40, unreadOnly = false } = {}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  let q = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', user.id)
    .or(
      'type.like.admin_verification%,type.eq.verification_submitted,type.eq.verification_resubmitted'
    )
    .order('created_at', { ascending: false })
    .limit(limit)
  if (unreadOnly) q = q.eq('read', false)
  const { data, error } = await q
  if (error) {
    // Broader fallback without or filter
    const { data: d2 } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(limit)
    return (d2 || []).filter((n) =>
      String(n.type || '').startsWith('admin_verification')
      || String(n.data?.kind || n.meta?.kind || '').startsWith('admin_verification')
      || n.data?.admin_verification
      || n.meta?.admin_verification
    )
  }
  return data || []
}

export async function markAdminVerificationNotificationsRead(ids = null) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return
  try {
    let q = supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
    if (ids?.length) {
      q = q.in('id', ids)
    } else {
      q = q.or('type.like.admin_verification%,data->>admin_verification.eq.true')
    }
    await q
  } catch { /* soft */ }
}

/**
 * Combined activity feed for admin (audit + recent status events).
 */
export async function getVerificationAdminActivityFeed(limit = 40) {
  const out = []
  try {
    const audit = await getVerificationAdminAudit(limit)
    ;(audit || []).forEach((a) => {
      out.push({
        id: `audit-${a.id}`,
        kind: 'audit',
        action: a.action || a.event || 'admin_action',
        note: a.note || a.reason || a.details || null,
        request_id: a.request_id || null,
        seller_id: a.seller_id || a.target_user_id || null,
        actor_id: a.admin_id || a.actor_id || null,
        created_at: a.created_at,
        raw: a,
      })
    })
  } catch { /* optional table */ }

  try {
    const { data: events } = await supabase
      .from('verification_status_events')
      .select('id, request_id, from_status, to_status, actor_id, note, meta, created_at')
      .order('created_at', { ascending: false })
      .limit(limit)
    ;(events || []).forEach((ev) => {
      out.push({
        id: `ev-${ev.id}`,
        kind: 'status',
        action: ev.meta?.event || `${ev.from_status || '—'} → ${ev.to_status || '—'}`,
        note: ev.note || null,
        request_id: ev.request_id,
        seller_id: null,
        actor_id: ev.actor_id,
        created_at: ev.created_at,
        to_status: ev.to_status,
        from_status: ev.from_status,
        raw: ev,
      })
    })
  } catch { /* soft */ }

  out.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
  return out.slice(0, limit)
}

/**
 * Color / tone for admin verification list badges.
 * green | yellow | orange | blue | red | muted
 */
export function getAdminVerificationTone(request, payment = null) {
  const status = request?.status
  const userResponded = isUserRespondedToAdmin(request)
  if (status === VERIFICATION_STATUSES.APPROVED) return { key: 'green', label: 'Approved', color: '#1a7a4a', bg: '#e6f4ec' }
  if (status === VERIFICATION_STATUSES.REJECTED) return { key: 'red', label: 'Rejected', color: '#dc2626', bg: '#fee2e2' }
  if (status === VERIFICATION_STATUSES.EXPIRED || status === VERIFICATION_STATUSES.CANCELLED) {
    return { key: 'muted', label: statusLabel(status), color: '#6b7280', bg: '#f3f4f6' }
  }
  if (userResponded) return { key: 'blue', label: 'User has responded', color: '#1d4ed8', bg: '#dbeafe' }
  if (
    status === VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED
    || payment?.payment_status === 'awaiting_confirmation'
  ) {
    return { key: 'orange', label: 'Action required', color: '#c2410c', bg: '#ffedd5' }
  }
  if ([
    VERIFICATION_STATUSES.UNDER_REVIEW,
    VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
    VERIFICATION_STATUSES.SUBMITTED,
    'pending',
  ].includes(status)) {
    return { key: 'yellow', label: 'Under review', color: '#b45309', bg: '#fef3c7' }
  }
  if (status === VERIFICATION_STATUSES.PAYMENT_PENDING) {
    return { key: 'orange', label: 'Payment pending', color: '#b45309', bg: '#fef3c7' }
  }
  return { key: 'muted', label: statusLabel(status), color: '#6b7280', bg: '#f3f4f6' }
}

/** Seller resubmitted / uploaded after admin need-info */
export function isUserRespondedToAdmin(request) {
  if (!request) return false
  const meta = request.meta || {}
  if (meta.resubmitted || meta.resubmitted_at || meta.user_responded_at) {
    if (request.status === VERIFICATION_STATUSES.UNDER_REVIEW
      || request.status === VERIFICATION_STATUSES.PAYMENT_CONFIRMED
      || request.status === VERIFICATION_STATUSES.SUBMITTED
      || request.status === 'pending') {
      return true
    }
  }
  // under_review after need-info message still present = resubmit cycle
  if (
    request.status === VERIFICATION_STATUSES.UNDER_REVIEW
    && request.additional_info_message
    && request.under_review_at
    && request.reviewed_at
  ) {
    return new Date(request.under_review_at).getTime() >= new Date(request.reviewed_at).getTime()
  }
  return false
}

export function isVerificationOverdue(request, reviewPeriodHours = 24) {
  if (!request) return false
  const actionable = [
    VERIFICATION_STATUSES.UNDER_REVIEW,
    VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
    VERIFICATION_STATUSES.SUBMITTED,
    'pending',
  ].includes(request.status)
  if (!actionable && !isUserRespondedToAdmin(request)) return false
  const start = request.under_review_at
    || request.submitted_at
    || request.payment_confirmed_at
    || request.updated_at
    || request.created_at
  if (!start) return false
  const hours = Number(reviewPeriodHours) > 0 ? Number(reviewPeriodHours) : 24
  const deadline = new Date(start).getTime() + hours * 3600 * 1000
  return Date.now() > deadline
}

export function getVerificationReviewDeadline(request, reviewPeriodHours = 24) {
  const start = request?.under_review_at
    || request?.submitted_at
    || request?.payment_confirmed_at
    || request?.created_at
  if (!start) return null
  const hours = Number(reviewPeriodHours) > 0 ? Number(reviewPeriodHours) : 24
  return new Date(new Date(start).getTime() + hours * 3600 * 1000)
}

/**
 * Required action label for pending queue cards.
 */
export function getAdminRequiredAction(request, payment = null) {
  if (!request) return null
  const payStatus = String(payment?.payment_status || '').toLowerCase()
  if (payStatus === 'awaiting_confirmation') {
    return { key: 'confirm_payment', label: 'Confirm payment', urgent: true }
  }
  if (isUserRespondedToAdmin(request)) {
    return { key: 'review_resubmission', label: 'Review resubmission', urgent: true }
  }
  if (request.status === VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED) {
    return { key: 'waiting_user', label: 'Waiting for user response', urgent: false }
  }
  if ([
    VERIFICATION_STATUSES.UNDER_REVIEW,
    VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
    VERIFICATION_STATUSES.SUBMITTED,
    'pending',
  ].includes(request.status)) {
    return { key: 'approve', label: 'Approve verification', urgent: isVerificationOverdue(request) }
  }
  if (request.status === VERIFICATION_STATUSES.PAYMENT_PENDING) {
    return { key: 'await_payment', label: 'Awaiting payment', urgent: false }
  }
  return null
}

/**
 * Enrich verification rows for admin queue UI.
 * paymentsMap: { [requestId]: paymentRow }
 * settings: verification_settings (for review hours)
 */
export function enrichAdminVerificationQueue(requests = [], paymentsMap = {}, settings = null) {
  const hours = settings?.review_period_hours ?? 24
  const now = Date.now()
  return (requests || []).map((r) => {
    const payment = paymentsMap[r.id] || null
    const tone = getAdminVerificationTone(r, payment)
    const userResponded = isUserRespondedToAdmin(r)
    const overdue = isVerificationOverdue(r, hours)
    const deadline = getVerificationReviewDeadline(r, hours)
    const action = getAdminRequiredAction(r, payment)
    const submittedAt = r.submitted_at || r.created_at
    const isNew = submittedAt
      && (now - new Date(submittedAt).getTime()) < 24 * 3600 * 1000
      && ![VERIFICATION_STATUSES.APPROVED, VERIFICATION_STATUSES.REJECTED, VERIFICATION_STATUSES.EXPIRED, VERIFICATION_STATUSES.CANCELLED].includes(r.status)
    const typeCode = r.meta?.type_code || r.verification_type?.code || 'seller'
    const typeName = r.verification_type?.name
      || (typeCode === 'shop' ? 'Shop verification'
        : typeCode === 'business' ? 'Business verification'
          : 'Seller verification')
    return {
      ...r,
      payment,
      tone,
      userResponded,
      overdue,
      deadline,
      action,
      isNew,
      typeCode,
      typeName,
      sellerName: r.profiles?.full_name || r.full_name || 'Unknown seller',
      sellerAvatar: r.profiles?.avatar_url || null,
      lastActivityAt: r.updated_at || r.reviewed_at || r.submitted_at || r.created_at,
    }
  })
}

/**
 * Build pending-action items sorted by urgency.
 */
export function buildAdminPendingActions(enriched = []) {
  const urgent = []
  const waiting = []
  for (const r of enriched) {
    if (!r.action) continue
    const item = {
      id: r.id,
      request: r,
      sellerName: r.sellerName,
      typeName: r.typeName,
      status: r.status,
      submittedAt: r.submitted_at || r.created_at,
      action: r.action,
      userResponded: r.userResponded,
      overdue: r.overdue,
      isNew: r.isNew,
      payment: r.payment,
    }
    if (r.action.urgent || r.userResponded || r.overdue || r.action.key === 'confirm_payment') {
      urgent.push(item)
    } else if (r.action.key === 'waiting_user') {
      waiting.push(item)
    } else {
      urgent.push(item)
    }
  }
  const rank = (a) => {
    let s = 0
    if (a.userResponded) s += 100
    if (a.action?.key === 'confirm_payment') s += 90
    if (a.overdue) s += 80
    if (a.isNew) s += 40
    if (a.action?.urgent) s += 20
    return s
  }
  urgent.sort((a, b) => rank(b) - rank(a) || new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0))
  waiting.sort((a, b) => new Date(b.submittedAt || 0) - new Date(a.submittedAt || 0))
  return { urgent, waiting, all: [...urgent, ...waiting] }
}

/**
 * Client-side filter for admin request list.
 */
export function filterAdminVerificationQueue(enriched = [], {
  statusFilter = 'all',
  paymentFilter = 'all',
  typeFilter = 'all',
  search = '',
  dateFilter = 'all',
} = {}) {
  const q = String(search || '').trim().toLowerCase()
  const startToday = new Date()
  startToday.setHours(0, 0, 0, 0)

  return enriched.filter((r) => {
    if (statusFilter && statusFilter !== 'all') {
      if (statusFilter === 'pending') {
        if (![
          VERIFICATION_STATUSES.UNDER_REVIEW,
          VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
          VERIFICATION_STATUSES.SUBMITTED,
          VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED,
          'pending',
        ].includes(r.status) && !r.userResponded
          && r.payment?.payment_status !== 'awaiting_confirmation') return false
      } else if (statusFilter === 'waiting_user') {
        if (r.status !== VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED) return false
      } else if (statusFilter === 'user_responded') {
        if (!r.userResponded) return false
      } else if (statusFilter === 'overdue') {
        if (!r.overdue) return false
      } else if (statusFilter === 'today') {
        const t = r.submitted_at || r.created_at
        if (!t || new Date(t) < startToday) return false
      } else if (r.status !== statusFilter) {
        return false
      }
    }
    if (paymentFilter && paymentFilter !== 'all') {
      const ps = String(r.payment?.payment_status || (r.payment_confirmed_at ? 'confirmed' : 'none')).toLowerCase()
      if (paymentFilter === 'confirmed' && ps !== 'confirmed' && !r.payment_confirmed_at) return false
      if (paymentFilter === 'awaiting' && ps !== 'awaiting_confirmation') return false
      if (paymentFilter === 'pending' && !['pending', 'initiated', 'awaiting_confirmation'].includes(ps)) return false
      if (paymentFilter === 'failed' && !['failed', 'rejected', 'cancelled', 'expired'].includes(ps)) return false
      if (paymentFilter === 'none' && (r.payment || r.payment_confirmed_at)) return false
    }
    if (typeFilter && typeFilter !== 'all') {
      if (r.typeCode !== typeFilter) return false
    }
    if (dateFilter === 'today') {
      const t = r.submitted_at || r.created_at
      if (!t || new Date(t) < startToday) return false
    }
    if (q) {
      const hay = [
        r.sellerName,
        r.profiles?.email,
        r.profiles?.phone,
        r.profiles?.city,
        r.payment_ref,
        r.payment?.transaction_reference,
        r.typeName,
        r.status,
        r.admin_note,
      ].filter(Boolean).join(' ').toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  }).sort((a, b) => {
    // User responded first, then overdue, then new, then activity
    const score = (x) => (x.userResponded ? 1000 : 0)
      + (x.overdue ? 500 : 0)
      + (x.action?.key === 'confirm_payment' ? 400 : 0)
      + (x.isNew ? 100 : 0)
    const d = score(b) - score(a)
    if (d) return d
    return new Date(b.lastActivityAt || 0) - new Date(a.lastActivityAt || 0)
  })
}

/**
 * List sellers for admin verified-seller management.
 * Uses the same profiles!seller_id join as the Verifications request list
 * so names/avatars show correctly (not "Seller abc123…").
 */
export async function adminListVerificationProfiles(filter = 'verified') {
  // 1) Prefer RPC when it returns complete rows with names
  try {
    const { data, error } = await supabase.rpc('admin_list_verification_profiles', {
      p_filter: filter,
    })
    if (!error && Array.isArray(data) && data.length > 0) {
      const mapped = data.map(normalizeAdminSellerRow)
      // If RPC only returned ids without names, fall through to joins
      if (mapped.some((r) => r.full_name && !String(r.full_name).startsWith('Seller '))) {
        return mapped
      }
    }
  } catch { /* fall through */ }

  const byId = new Map()

  const mergeRow = (row) => {
    if (!row?.id) return
    const prev = byId.get(row.id) || {}
    // Prefer a row that already has a real name/avatar
    const next = normalizeAdminSellerRow({ ...prev, ...row })
    if (!next.full_name && prev.full_name) next.full_name = prev.full_name
    if (!next.avatar_url && prev.avatar_url) next.avatar_url = prev.avatar_url
    if (!next.city && prev.city) next.city = prev.city
    if (!next.phone && prev.phone) next.phone = prev.phone
    if (!next.email && prev.email) next.email = prev.email
    byId.set(row.id, next)
  }

  // 2) Approved requests + joined profile (same pattern as Admin loadVerifications)
  const reqJoins = [
    'id, seller_id, status, reviewed_at, created_at, admin_note, rejection_reason, profiles!seller_id(id, full_name, avatar_url, city, phone, email, is_verified, verification_status, verified_at, rejection_reason, created_at)',
    'id, seller_id, status, reviewed_at, created_at, admin_note, rejection_reason, profiles!seller_id(id, full_name, avatar_url, city, is_verified, verification_status, verified_at, created_at)',
    'id, seller_id, status, reviewed_at, created_at, admin_note, profiles!seller_id(full_name, avatar_url, city, is_verified)',
    'id, seller_id, status, reviewed_at, created_at, profiles!seller_id(full_name, avatar_url, city)',
  ]

  let approvedReqs = []
  for (const sel of reqJoins) {
    const { data, error } = await supabase
      .from('verification_requests')
      .select(sel)
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(300)
    if (!error && data) {
      approvedReqs = data
      break
    }
  }

  // Fallback: requests without embed, then batch-load profiles
  if (!approvedReqs.length) {
    const { data } = await supabase
      .from('verification_requests')
      .select('id, seller_id, status, reviewed_at, created_at, admin_note, rejection_reason')
      .eq('status', 'approved')
      .order('created_at', { ascending: false })
      .limit(300)
    approvedReqs = data || []
  }

  const sellerIdsFromReqs = [...new Set(approvedReqs.map((r) => r.seller_id).filter(Boolean))]

  // Batch fetch any profiles not embedded
  const embeddedOk = approvedReqs.some((r) => r.profiles && (r.profiles.full_name || r.profiles.avatar_url))
  if (!embeddedOk && sellerIdsFromReqs.length) {
    const profileCols = [
      'id, full_name, avatar_url, city, phone, email, is_verified, verification_status, verified_at, rejection_reason, created_at',
      'id, full_name, avatar_url, city, is_verified, verification_status, verified_at, created_at',
      'id, full_name, avatar_url, city, is_verified, created_at',
      'id, full_name, avatar_url, city',
      'id, full_name, avatar_url',
    ]
    for (const cols of profileCols) {
      const { data, error } = await supabase.from('profiles').select(cols).in('id', sellerIdsFromReqs)
      if (!error && data?.length) {
        const map = Object.fromEntries(data.map((p) => [p.id, p]))
        approvedReqs = approvedReqs.map((r) => ({
          ...r,
          profiles: r.profiles || map[r.seller_id] || null,
        }))
        break
      }
    }
  }

  approvedReqs.forEach((r) => {
    // Supabase may return object or single-element array for FK embed
    const raw = r.profiles
    const p = Array.isArray(raw) ? (raw[0] || {}) : (raw || {})
    const pid = p.id || r.seller_id
    if (!pid) return
    mergeRow({
      id: pid,
      full_name: p.full_name || null,
      avatar_url: p.avatar_url || null,
      city: p.city || null,
      phone: p.phone || null,
      email: p.email || null,
      is_verified: p.is_verified !== false, // approved request ⇒ treat as verified for this list
      verification_status: p.verification_status || 'approved',
      verified_at: p.verified_at || r.reviewed_at || r.created_at || null,
      rejection_reason: p.rejection_reason || r.admin_note || r.rejection_reason || null,
      created_at: p.created_at || r.created_at || null,
      latest_request_id: r.id,
    })
  })

  // 3) Also include profiles flagged is_verified even without request row
  const flagCols = [
    'id, full_name, avatar_url, city, phone, email, is_verified, verification_status, verified_at, rejection_reason, created_at',
    'id, full_name, avatar_url, city, is_verified, verification_status, verified_at, created_at',
    'id, full_name, avatar_url, city, is_verified, created_at',
  ]
  for (const cols of flagCols) {
    const { data, error } = await supabase
      .from('profiles')
      .select(cols)
      .eq('is_verified', true)
      .limit(300)
    if (!error && data) {
      data.forEach((p) => mergeRow({
        ...p,
        is_verified: true,
        verification_status: p.verification_status || 'approved',
      }))
      break
    }
  }

  // 4) Other statuses for non-verified filters
  if (filter !== 'verified') {
    const statusMap = {
      rejected: ['rejected'],
      suspended: ['suspended'],
      removed: ['removed', 'reverification_required'],
    }
    if (statusMap[filter]) {
      for (const cols of flagCols) {
        const { data, error } = await supabase
          .from('profiles')
          .select(cols)
          .in('verification_status', statusMap[filter])
          .limit(300)
        if (!error && data) {
          data.forEach((p) => mergeRow(p))
          break
        }
      }
    } else if (filter === 'all') {
      // Pull recent requests of any status with profile join
      const { data: allReqs } = await supabase
        .from('verification_requests')
        .select('id, seller_id, status, reviewed_at, created_at, admin_note, rejection_reason, profiles!seller_id(id, full_name, avatar_url, city, phone, is_verified, verification_status, verified_at)')
        .order('created_at', { ascending: false })
        .limit(300)
      ;(allReqs || []).forEach((r) => {
        const raw = r.profiles
        const p = Array.isArray(raw) ? (raw[0] || {}) : (raw || {})
        const pid = p.id || r.seller_id
        if (!pid) return
        mergeRow({
          id: pid,
          full_name: p.full_name,
          avatar_url: p.avatar_url,
          city: p.city,
          phone: p.phone,
          is_verified: !!p.is_verified || r.status === 'approved',
          verification_status: p.verification_status || r.status,
          verified_at: p.verified_at || r.reviewed_at,
          rejection_reason: p.rejection_reason || r.rejection_reason || r.admin_note,
          latest_request_id: r.id,
        })
      })
    }
  }

  let list = [...byId.values()]

  if (filter === 'verified') {
    list = list.filter((p) => p.is_verified || p.verification_status === 'approved')
  } else if (filter === 'rejected') {
    list = list.filter((p) => p.verification_status === 'rejected' || (!!p.rejection_reason && !p.is_verified))
  } else if (filter === 'suspended') {
    list = list.filter((p) => p.verification_status === 'suspended')
  } else if (filter === 'removed') {
    list = list.filter((p) => ['removed', 'reverification_required'].includes(p.verification_status))
  }

  list.sort((a, b) => {
    const ta = new Date(a.verified_at || a.updated_at || a.created_at || 0).getTime()
    const tb = new Date(b.verified_at || b.updated_at || b.created_at || 0).getTime()
    return tb - ta
  })

  return list
}

function normalizeAdminSellerRow(p = {}) {
  const verified = p.is_verified === true
    || p.is_verified === 'true'
    || p.is_verified === 1
    || p.verified === true
    || p.verified === 'true'
    || p.verification_status === 'approved'
  const name = p.full_name && String(p.full_name).trim() ? p.full_name.trim() : null
  return {
    id: p.id,
    full_name: name,
    avatar_url: p.avatar_url || null,
    city: p.city || null,
    phone: p.phone || null,
    email: p.email || null,
    is_verified: verified,
    verification_status: p.verification_status || (verified ? 'approved' : null),
    verified_at: p.verified_at || null,
    rejection_reason: p.rejection_reason || p.admin_note || null,
    created_at: p.created_at || null,
    updated_at: p.updated_at || null,
    latest_request_id: p.latest_request_id || null,
  }
}

/**
 * Latest verification request id for a seller (admin management).
 */
export async function getLatestRequestIdForSeller(sellerId) {
  if (!sellerId) return null
  const { data } = await supabase
    .from('verification_requests')
    .select('id, status')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data || null
}

/**
 * Sync profile badges from approved verification requests.
 * Fixes dashboards showing approved requests while Manage list looked empty
 * because profiles.is_verified was never set.
 */
export async function adminSyncVerifiedBadgesFromRequests() {
  const { data: approved, error } = await supabase
    .from('verification_requests')
    .select('seller_id, id, reviewed_at')
    .eq('status', 'approved')
  if (error) throw error

  const sellerIds = [...new Set((approved || []).map((r) => r.seller_id).filter(Boolean))]
  let updated = 0
  for (const sellerId of sellerIds) {
    const req = (approved || []).find((r) => r.seller_id === sellerId)
    try {
      await adminUpdateSellerProfile(sellerId, [
        {
          is_verified: true,
          verification_status: 'approved',
          verified_at: req?.reviewed_at || new Date().toISOString(),
          rejection_reason: null,
          updated_at: new Date().toISOString(),
        },
        {
          is_verified: true,
          verification_status: 'approved',
          verified_at: req?.reviewed_at || new Date().toISOString(),
        },
        { is_verified: true },
      ])
      updated += 1
      try {
        await supabase.from('shops').update({ is_verified: true }).eq('owner_id', sellerId)
      } catch { /* optional */ }
    } catch { /* skip one seller */ }
  }
  return { sellers: sellerIds.length, updated }
}

export async function getVerificationAdminAudit(limit = 50) {
  const { data } = await supabase
    .from('verification_admin_audit')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}

/** Notification types used by notification center + click routing */
export const VERIFICATION_NOTIF_TYPES = Object.freeze({
  SUBMITTED: 'verification_submitted',
  PAYMENT_CONFIRMED: 'verification_payment_confirmed',
  PAYMENT_REJECTED: 'verification_payment_rejected',
  UNDER_REVIEW: 'verification_under_review',
  ADDITIONAL_INFO: 'verification_additional_info',
  DOCS_REJECTED: 'verification_documents_rejected',
  APPROVED: 'verification_approved',
  REJECTED: 'verification_rejected',
  REMOVED: 'verification_removed',
  EXPIRED: 'verification_expired',
  RESUBMITTED: 'verification_resubmitted',
})

/**
 * In-app notification for verification events (uses existing notifications table).
 * Prefer SECURITY DEFINER notify_user RPC so admins can notify sellers (RLS safe).
 * Click targets /profile with openVerify so wizard resumes.
 */
export async function notifySellerVerificationEvent({
  userId,
  type = 'verification',
  title,
  body,
  requestId = null,
  link = '/profile?verify=1',
  persistent = false,
}) {
  if (!userId || !title) return null
  const payload = {
    request_id: requestId,
    kind: type,
    open_verify: true,
    persistent: !!persistent,
  }
  const text = body || title

  // 1) RPC (admin → seller works even with strict RLS)
  try {
    const { data: id, error } = await supabase.rpc('notify_user', {
      p_user_id: userId,
      p_type: type,
      p_title: title,
      p_body: text,
      p_link: link,
      p_data: payload,
    })
    if (!error && id) return { id, user_id: userId, type, title, body: text }
  } catch { /* fall through */ }

  // 2) Direct insert (works for self-notify or if admin insert policy exists)
  const row = {
    user_id: userId,
    type,
    title,
    body: text,
    message: text,
    link,
    read: false,
    data: payload,
    meta: payload,
  }
  const { data, error } = await supabase.from('notifications').insert(row).select('*').maybeSingle()
  if (!error && data) return data

  const { data: d2, error: e2 } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    body: text,
    read: false,
  }).select('*').maybeSingle()
  if (e2) {
    console.warn('notifySellerVerificationEvent failed', e2.message || e2)
    return null
  }
  return d2
}

/**
 * Lifecycle helper — maps known events to notification copy + type.
 */
export async function notifyVerificationLifecycle({
  userId,
  event,
  requestId = null,
  message = null,
}) {
  if (!userId || !event) return null
  const map = {
    submitted: {
      type: VERIFICATION_NOTIF_TYPES.SUBMITTED,
      title: 'Verification submitted',
      body: 'Your verification request was submitted and is waiting for review.',
    },
    resubmitted: {
      type: VERIFICATION_NOTIF_TYPES.RESUBMITTED,
      title: 'Verification resubmitted',
      body: 'Thanks — your updated verification is back under review.',
    },
    payment_confirmed: {
      type: VERIFICATION_NOTIF_TYPES.PAYMENT_CONFIRMED,
      title: 'Verification payment confirmed',
      body: 'Your payment was confirmed. Your application is now under review.',
    },
    payment_rejected: {
      type: VERIFICATION_NOTIF_TYPES.PAYMENT_REJECTED,
      title: 'Payment proof was rejected',
      body: message || 'Please upload a valid receipt and try again.',
      persistent: true,
    },
    under_review: {
      type: VERIFICATION_NOTIF_TYPES.UNDER_REVIEW,
      title: 'Verification under review',
      body: 'Your verification request has been received and is being reviewed by our team.',
    },
    additional_info: {
      type: VERIFICATION_NOTIF_TYPES.ADDITIONAL_INFO,
      title: 'Your verification requires additional information',
      body: message || 'Please upload the requested documents to continue verification.',
      persistent: true,
    },
    documents_rejected: {
      type: VERIFICATION_NOTIF_TYPES.DOCS_REJECTED,
      title: 'Documents need attention',
      body: message || 'Please upload a clearer copy of your documents.',
      persistent: true,
    },
    approved: {
      type: VERIFICATION_NOTIF_TYPES.APPROVED,
      title: 'You are verified!',
      body: 'Your SokoMw verification was approved. Your verified badge is now active.',
    },
    rejected: {
      type: VERIFICATION_NOTIF_TYPES.REJECTED,
      title: 'Verification not approved',
      body: message || 'Your verification request was rejected. Open verification for details.',
    },
    removed: {
      type: VERIFICATION_NOTIF_TYPES.REMOVED,
      title: 'Verification badge removed',
      body: message || 'An administrator removed your verified badge.',
    },
    expired: {
      type: VERIFICATION_NOTIF_TYPES.EXPIRED,
      title: 'Verification expired',
      body: message || 'Your verification has expired. Please re-verify to restore your badge.',
    },
    reverify: {
      type: VERIFICATION_NOTIF_TYPES.EXPIRED,
      title: 'Re-verification required',
      body: message || 'Please complete verification again to restore your badge.',
      persistent: true,
    },
  }
  const cfg = map[event]
  if (!cfg) return null
  const sellerNotif = await notifySellerVerificationEvent({
    userId,
    type: cfg.type,
    title: cfg.title,
    body: cfg.body,
    requestId,
    persistent: !!cfg.persistent,
  })

  // Fan out to admins for seller-originated / queue-relevant events
  try {
    const adminMap = {
      submitted: {
        event: ADMIN_VERIFICATION_EVENTS.NEW_REQUEST,
        title: 'New verification request submitted',
        body: message || 'A seller submitted a verification request and is waiting for review.',
      },
      resubmitted: {
        event: ADMIN_VERIFICATION_EVENTS.USER_RESPONDED,
        title: 'User has responded — resubmission ready for review',
        body: message || 'A seller resubmitted verification after providing additional information.',
      },
      payment_rejected: null, // admin action — no need to notify admins
      additional_info: null,
      approved: {
        event: ADMIN_VERIFICATION_EVENTS.APPROVED,
        title: 'Verification approved',
        body: message || 'A verification request was marked approved.',
      },
      rejected: {
        event: ADMIN_VERIFICATION_EVENTS.REJECTED,
        title: 'Verification rejected',
        body: message || 'A verification request was rejected.',
      },
      removed: {
        event: ADMIN_VERIFICATION_EVENTS.REMOVED,
        title: 'Verification badge removed',
        body: message || 'A verified badge was removed by an administrator.',
      },
      expired: {
        event: ADMIN_VERIFICATION_EVENTS.EXPIRED,
        title: 'Verification expired',
        body: message || 'A verification request expired.',
      },
    }
    const adminCfg = adminMap[event]
    if (adminCfg) {
      await notifyAdminsVerificationEvent({
        event: adminCfg.event,
        title: adminCfg.title,
        body: adminCfg.body,
        requestId,
        sellerId: userId,
        data: { lifecycle_event: event },
      })
    }
  } catch { /* soft */ }

  return sellerNotif
}

/** Mark action-required verification notifications as read after seller resubmits */
export async function markVerificationActionNotificationsRead(userId) {
  if (!userId) return
  try {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
      .in('type', [
        VERIFICATION_NOTIF_TYPES.ADDITIONAL_INFO,
        VERIFICATION_NOTIF_TYPES.DOCS_REJECTED,
        VERIFICATION_NOTIF_TYPES.PAYMENT_REJECTED,
      ])
  } catch { /* soft */ }
}

/**
 * Full seller-facing attention payload for banners / cards / continue flow.
 */
export async function getSellerVerificationAttention(userId) {
  if (!userId) {
    return { show: false, actionRequired: false, request: null }
  }

  const [request, settings, profile] = await Promise.all([
    getLatestVerificationRequest(userId),
    getVerificationSettings().catch(() => null),
    getSellerProfileForVerification(userId).catch(() => null),
  ])

  if (!request) {
    return {
      show: false,
      actionRequired: false,
      request: null,
      settings,
      profile,
      status: 'none',
      headline: null,
    }
  }

  // Fresh row so admin need-info / pay confirm is never one list-query behind
  const freshRequest = (await getVerificationRequestById(request.id)) || request
  const status = freshRequest.status
  const docs = await getVerificationDocuments(freshRequest.id, userId)
  const payments = await getPaymentsForRequest(freshRequest.id, {
    paymentRef: freshRequest.payment_ref,
    sellerId: userId,
  })
  const activeDocs = filterActiveVerificationDocuments(docs)
  const typeCode = freshRequest.meta?.type_code || 'seller'
  let selectedType = null
  try {
    const types = await getActiveVerificationTypes()
    selectedType = types.find((t) => t.code === typeCode) || types[0] || null
  } catch { /* ignore */ }

  const requiredDocs = resolveRequiredDocumentTypes(selectedType || { code: typeCode }, settings)
  const docsCheck = checkDocumentRequirements(activeDocs, requiredDocs, {
    requireDocuments: settings?.require_documents !== false,
  })
  const paymentCheck = checkPaymentRequirement(freshRequest, payments)
  const profileCheck = checkProfileCompleteness(profile)

  // Statuses that mean payment stage is finished (even if ledger row is messy)
  const pastPaymentStage = [
    VERIFICATION_STATUSES.UNDER_REVIEW,
    VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
    VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED,
    VERIFICATION_STATUSES.APPROVED,
    VERIFICATION_STATUSES.REJECTED,
  ].includes(status)

  const paymentConfirmed = !!(
    paymentCheck.confirmed
    || pastPaymentStage
    || !!freshRequest?.payment_confirmed_at
    || Number(freshRequest?.amount_paid) > 0
  )

  // If admin already confirmed payment but request status lagged on payment_pending,
  // treat UI as under review (do not nag seller to pay again).
  const effectiveStatus = getSellerDisplayStatus(freshRequest, payments) || status

  const missingLabels = (docsCheck.missingLabels || []).slice()
  const docChecklist = requiredDocs.map((code) => ({
    code,
    label: docTypeLabel(code),
    uploaded: !!(activeDocs || []).some((d) => d.doc_type === code
      && !['rejected', 'needs_replacement', 'invalid', 'replaced', 'superseded']
        .includes(String(d.status || '').toLowerCase())),
  }))

  // CRITICAL: additional_info always wins over payment messaging
  const needsMoreInfo = status === VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED
    || String(status || '').toLowerCase() === 'additional_info_required'
    || (!!freshRequest.additional_info_message
      && ![
        VERIFICATION_STATUSES.APPROVED,
        VERIFICATION_STATUSES.REJECTED,
        VERIFICATION_STATUSES.DRAFT,
        VERIFICATION_STATUSES.CANCELLED,
        VERIFICATION_STATUSES.EXPIRED,
      ].includes(status))

  // Payment only requires action when NOT confirmed yet
  const needsPaymentAction = !paymentConfirmed && !needsMoreInfo && (
    status === VERIFICATION_STATUSES.PAYMENT_PENDING
    || (status === VERIFICATION_STATUSES.DRAFT && !paymentCheck.ok)
    || (!paymentCheck.ok && status === VERIFICATION_STATUSES.SUBMITTED && !pastPaymentStage)
  )

  const actionRequired = needsMoreInfo
    || needsPaymentAction
    || (status === VERIFICATION_STATUSES.DRAFT && !paymentConfirmed && !pastPaymentStage)

  const underReview = !needsMoreInfo && (
    [
      VERIFICATION_STATUSES.UNDER_REVIEW,
      VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
      VERIFICATION_STATUSES.SUBMITTED,
      'pending',
    ].includes(effectiveStatus)
    || (paymentConfirmed && status === VERIFICATION_STATUSES.PAYMENT_PENDING)
  )

  const meta = getSellerVerificationStatusMeta(
    needsMoreInfo ? VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED : effectiveStatus
  )

  let headline = meta.label
  let detail = null
  let ctaLabel = 'Continue verification'
  let tone = meta.tone || 'pending'

  if (needsMoreInfo) {
    headline = 'Verification Pending — Action Required'
    detail = freshRequest.additional_info_message
      || freshRequest.admin_note
      || 'Additional documents or information are required before we can verify your account.'
    ctaLabel = 'Upload documents'
    tone = 'action'
  } else if (needsPaymentAction) {
    headline = paymentCheck.awaiting && !paymentConfirmed
      ? 'Payment proof submitted — awaiting confirmation'
      : 'Payment pending for verification'
    detail = paymentCheck.awaiting && !paymentConfirmed
      ? 'We received your payment proof. An admin will confirm it shortly — you do not need to pay again.'
      : 'Complete payment or submit payment proof to continue verification.'
    ctaLabel = paymentCheck.awaiting && !paymentConfirmed ? 'View status' : 'Continue payment'
    tone = 'pending'
  } else if (status === VERIFICATION_STATUSES.DRAFT && !paymentConfirmed) {
    headline = 'Finish your verification application'
    detail = 'Your draft is saved. Continue to complete payment and documents.'
    ctaLabel = 'Continue verification'
    tone = 'pending'
  } else if (underReview) {
    headline = 'Your verification is currently under review'
    detail = paymentConfirmed
      ? 'Payment confirmed. Your verification request is being reviewed by our team.'
      : 'Your verification request has been received and is currently being reviewed by our team.'
    ctaLabel = 'View status'
    tone = 'pending'
  } else if (status === VERIFICATION_STATUSES.APPROVED) {
    headline = 'You are verified'
    detail = 'Your verified badge is active on SokoMw.'
    ctaLabel = 'View status'
    tone = 'ok'
  } else if (status === VERIFICATION_STATUSES.REJECTED) {
    headline = 'Verification not approved'
    detail = freshRequest.rejection_reason || 'Your verification request was not approved.'
    ctaLabel = 'View details'
    tone = 'bad'
  }

  const show = actionRequired || underReview || status === VERIFICATION_STATUSES.REJECTED || needsMoreInfo

  const paymentLabel = paymentConfirmed
    ? 'Payment confirmed'
    : paymentCheck.label

  const resumeStep = resolveVerificationResumeStep({
    request: { ...freshRequest, status: effectiveStatus },
    profile,
    docs: activeDocs,
    payments,
    selectedType,
    settings,
    typeCode,
  })

  return {
    show,
    actionRequired: !!actionRequired || needsMoreInfo,
    persistentAction: needsMoreInfo,
    request: freshRequest,
    settings,
    profile,
    docs: activeDocs,
    payments,
    status: needsMoreInfo ? VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED : effectiveStatus,
    rawStatus: status,
    statusMeta: needsMoreInfo
      ? getSellerVerificationStatusMeta(VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED)
      : meta,
    typeCode,
    typeName: selectedType?.name || docTypeLabel(typeCode),
    requiredDocs,
    docChecklist,
    missingDocs: docsCheck.missing || [],
    missingLabels,
    paymentOk: paymentConfirmed || paymentCheck.ok,
    paymentConfirmed,
    paymentLabel,
    profileOk: profileCheck.ok,
    adminMessage: freshRequest.additional_info_message
      || (needsMoreInfo ? freshRequest.admin_note : null)
      || freshRequest.rejection_reason
      || null,
    resumeStep: needsMoreInfo
      ? (resumeStep === 'payment' && paymentConfirmed ? 'documents' : resumeStep)
      : (needsPaymentAction ? 'payment' : (underReview ? 'status' : resumeStep)),
    headline,
    detail,
    ctaLabel,
    tone,
    estimate: getUserFacingReviewEstimate(settings),
    submittedAt: freshRequest.submitted_at || freshRequest.created_at,
    feeLabel: formatFee(settings, resolveEffectiveFee(selectedType, settings)),
  }
}

/**
 * Human labels + UI tone for seller-facing verification statuses.
 */
export function getSellerVerificationStatusMeta(status) {
  const s = String(status || 'none').toLowerCase()
  const map = {
    none: { label: 'Not started', tone: 'muted', color: '#6b7280', bg: '#f3f4f6' },
    draft: { label: 'Draft', tone: 'pending', color: '#b45309', bg: '#fef3c7' },
    payment_pending: { label: 'Payment pending', tone: 'pending', color: '#b45309', bg: '#fef3c7' },
    payment_confirmed: { label: 'Payment confirmed', tone: 'pending', color: '#b45309', bg: '#fef3c7' },
    submitted: { label: 'Under review', tone: 'pending', color: '#b45309', bg: '#fef3c7' },
    under_review: { label: 'Under review', tone: 'pending', color: '#b45309', bg: '#fef3c7' },
    pending: { label: 'Under review', tone: 'pending', color: '#b45309', bg: '#fef3c7' },
    additional_info_required: {
      label: 'Additional information required',
      tone: 'action',
      color: '#c2410c',
      bg: '#ffedd5',
    },
    approved: { label: 'Approved', tone: 'ok', color: '#1a7a4a', bg: '#e6f4ec' },
    rejected: { label: 'Rejected', tone: 'bad', color: '#dc2626', bg: '#fee2e2' },
    expired: { label: 'Expired', tone: 'muted', color: '#6b7280', bg: '#f3f4f6' },
    cancelled: { label: 'Cancelled', tone: 'muted', color: '#6b7280', bg: '#f3f4f6' },
  }
  return map[s] || { label: statusLabel(s), tone: 'muted', color: '#6b7280', bg: '#f3f4f6' }
}

/**
 * Pick wizard step to resume for additional-info / incomplete applications.
 */
export function resolveVerificationResumeStep({
  request = null,
  profile = null,
  docs = [],
  payments = [],
  selectedType = null,
  settings = null,
  typeCode = null,
} = {}) {
  if (!request) return 'welcome'

  const profileCheck = checkProfileCompleteness(profile)
  if (!profileCheck.ok) return 'welcome'

  const paymentCheck = checkPaymentRequirement(request, payments)
  // Only open payment step if not already confirmed by admin/gateway
  if (!paymentCheck.confirmed && !paymentCheck.ok) return 'payment'
  if (!paymentCheck.confirmed && paymentCheck.awaiting) {
    // Proof already submitted — show status, not pay again
    if (request.status === VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED) {
      /* fall through to docs */
    } else {
      return 'status'
    }
  }

  const required = resolveRequiredDocumentTypes(
    selectedType || { code: typeCode || request.meta?.type_code || 'seller' },
    settings
  )
  const docsCheck = checkDocumentRequirements(docs, required, {
    requireDocuments: settings?.require_documents !== false,
  })

  // Prefer rejected/flagged docs when admin asked for clearer uploads
  const hasRejectedDocs = (docs || []).some((d) =>
    ['rejected', 'needs_replacement', 'invalid'].includes(String(d.status || '').toLowerCase())
  )

  if (request.status === VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED) {
    if (!docsCheck.ok || hasRejectedDocs) return 'documents'
    if (!paymentCheck.ok) return 'payment'
    return 'review'
  }

  if (!docsCheck.ok || hasRejectedDocs) return 'documents'
  if (request.status === VERIFICATION_STATUSES.DRAFT) {
    return request.meta?.wizard_step && STEP_IDS_SAFE.includes(request.meta.wizard_step)
      ? request.meta.wizard_step
      : 'type'
  }
  return 'review'
}

const STEP_IDS_SAFE = ['welcome', 'type', 'payment', 'documents', 'review', 'submit', 'status']

/**
 * Soft-replace a document: mark previous as replaced (audit kept), upload new row.
 */
export async function replaceVerificationDocument({
  userId,
  requestId,
  file,
  docType = 'national_id',
  previousDoc = null,
}) {
  if (!userId || !file) throw new Error('Missing file or user')

  if (previousDoc?.id) {
    try {
      await supabase
        .from('verification_documents')
        .update({
          status: 'replaced',
          // keep storage_path for audit; do not remove from storage
        })
        .eq('id', previousDoc.id)
        .eq('user_id', userId)
    } catch { /* soft */ }
  }

  return uploadVerificationDocument({
    userId,
    requestId,
    file,
    docType,
  })
}

/**
 * Soft-remove: mark superseded instead of hard delete when request is in review pipeline.
 * Hard delete only for pure drafts if no audit needed.
 */
export async function softRemoveVerificationDocument(doc, { hard = false } = {}) {
  if (!doc?.id) return
  if (hard) {
    return deleteVerificationDocument(doc)
  }
  const { error } = await supabase
    .from('verification_documents')
    .update({ status: 'superseded' })
    .eq('id', doc.id)
  if (error) {
    // Fallback hard delete only if update not allowed
    return deleteVerificationDocument(doc)
  }
  return true
}

/**
 * Seller resubmits after additional_info_required → under_review.
 * Creates status event (trigger + explicit resubmitted note).
 */
export async function resubmitVerificationApplication(requestId, { notes = null, message = null } = {}) {
  if (!requestId) throw new Error('Request required')

  const { data: current, error: loadErr } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('id', requestId)
    .single()
  if (loadErr || !current) throw loadErr || new Error('Request not found')

  if (current.status !== VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED
    && current.status !== VERIFICATION_STATUSES.DRAFT
    && current.status !== 'pending') {
    // Allow normal submit path for drafts via existing helper
    if ([VERIFICATION_STATUSES.DRAFT, VERIFICATION_STATUSES.PAYMENT_PENDING].includes(current.status)) {
      return submitVerificationApplication(requestId, { notes })
    }
  }

  const resubmitNote = message || notes || 'Seller resubmitted after providing additional information'

  // Prefer RPC (SECURITY DEFINER) after migration
  try {
    const { data, error } = await supabase.rpc('transition_verification_status', {
      p_request_id: requestId,
      p_to_status: VERIFICATION_STATUSES.UNDER_REVIEW,
      p_note: resubmitNote,
    })
    if (!error && data) {
      const row = Array.isArray(data) ? data[0] : data
      await logResubmitEvent(requestId, resubmitNote, current.status)
      try {
        const uid = row?.seller_id || current.seller_id
        if (uid) {
          await markVerificationActionNotificationsRead(uid)
          await notifyVerificationLifecycle({
            userId: uid,
            event: 'resubmitted',
            requestId,
          })
        }
      } catch { /* soft */ }
      return row
    }
  } catch { /* fall through */ }

  // Direct update (RLS allows seller update while status = additional_info_required)
  const { data: { user } } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('verification_requests')
    .update({
      status: VERIFICATION_STATUSES.UNDER_REVIEW,
      notes: notes ?? current.notes,
      submitted_at: new Date().toISOString(),
      under_review_at: new Date().toISOString(),
      meta: {
        ...(current.meta || {}),
        wizard_step: 'status',
        resubmitted: true,
        resubmitted_at: new Date().toISOString(),
        resubmit_note: resubmitNote,
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', requestId)
    .eq('seller_id', user?.id || current.seller_id)
    .select('*')
    .single()
  if (error) throw error

  await logResubmitEvent(requestId, resubmitNote, current.status)
  try {
    const uid = data?.seller_id || current.seller_id || user?.id
    if (uid) {
      await markVerificationActionNotificationsRead(uid)
      await notifyVerificationLifecycle({
        userId: uid,
        event: 'resubmitted',
        requestId,
      })
    }
  } catch { /* soft */ }
  return data
}

async function logResubmitEvent(requestId, note, fromStatus) {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('verification_status_events').insert({
      request_id: requestId,
      from_status: fromStatus || null,
      to_status: VERIFICATION_STATUSES.UNDER_REVIEW,
      actor_id: user?.id || null,
      note: note || 'resubmitted',
      meta: { event: 'resubmitted', message: note || 'resubmitted' },
    })
  } catch { /* trigger may already log status change */ }
}

/**
 * Active docs only (exclude replaced/superseded) for checklist & display.
 */
export function filterActiveVerificationDocuments(docs = []) {
  return (docs || []).filter((d) => {
    const st = String(d.status || 'uploaded').toLowerCase()
    return !['replaced', 'superseded', 'deleted'].includes(st)
  })
}

// ─── Submission checklist & friendly errors (seller wizard) ───

/** Document statuses that count as a valid upload for checklist purposes */
export const VALID_DOCUMENT_STATUSES = Object.freeze([
  'uploaded',
  'pending',
  'pending_review',
  'under_review',
  'approved',
  'accepted',
])

/** Request statuses that block starting / re-submitting a new application */
export const BLOCKING_SUBMISSION_STATUSES = Object.freeze([
  VERIFICATION_STATUSES.SUBMITTED,
  VERIFICATION_STATUSES.PAYMENT_PENDING,
  VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
  VERIFICATION_STATUSES.UNDER_REVIEW,
  VERIFICATION_STATUSES.APPROVED,
])

/**
 * Load seller profile fields needed for verification checklist.
 */
export async function getSellerProfileForVerification(userId) {
  if (!userId) return null
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, phone, city, email, location, address')
      .eq('id', userId)
      .maybeSingle()
    if (!error && data) return data
  } catch { /* column may be missing */ }

  // Retry with core columns only (older DBs)
  try {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, phone, city')
      .eq('id', userId)
      .maybeSingle()
    return data || null
  } catch {
    return null
  }
}

/**
 * Required seller profile fields before requesting verification.
 * Returns { ok, missing, items, message }
 */
export function checkProfileCompleteness(profile) {
  const items = [
    {
      key: 'full_name',
      label: 'Full name',
      ok: !!(profile?.full_name && String(profile.full_name).trim().length > 1),
    },
    {
      key: 'avatar_url',
      label: 'Profile photo',
      ok: !!(profile?.avatar_url && String(profile.avatar_url).trim()),
    },
    {
      key: 'phone',
      label: 'Phone number',
      ok: !!(profile?.phone && String(profile.phone).trim().length >= 7),
    },
    {
      key: 'city',
      label: 'Location / city',
      ok: !!(
        (profile?.city && String(profile.city).trim())
        || (profile?.location && String(profile.location).trim())
        || (profile?.address && String(profile.address).trim())
      ),
    },
  ]
  const missing = items.filter((i) => !i.ok)
  return {
    ok: missing.length === 0,
    missing,
    items,
    message: missing.length
      ? 'Complete your profile before requesting verification.'
      : 'Profile complete',
  }
}

/**
 * Contact checks: phone always; email/address when settings.extra flags require them.
 */
export function checkContactInformation(profile, settings = {}, userEmail = null) {
  const extra = settings?.extra || {}
  const requireEmail = extra.require_email === true || settings?.require_email === true
  const requireAddress = extra.require_address === true || settings?.require_address === true

  const phoneOk = !!(profile?.phone && String(profile.phone).trim().length >= 7)
  const emailVal = profile?.email || userEmail || ''
  const emailOk = !requireEmail || !!(emailVal && String(emailVal).includes('@'))
  const addressVal = profile?.city || profile?.location || profile?.address || ''
  const addressOk = !requireAddress || !!(addressVal && String(addressVal).trim())

  const locationOk = !!(addressVal && String(addressVal).trim())
  const items = [
    { key: 'phone', label: 'Phone number', ok: phoneOk, required: true },
    { key: 'email', label: 'Email', ok: emailOk, required: requireEmail },
    // Location always required for verification (same as profile city)
    {
      key: 'address',
      label: 'Address / location',
      ok: requireAddress ? addressOk : locationOk,
      required: true,
    },
  ]

  const missing = items.filter((i) => i.required && !i.ok)
  return {
    ok: missing.length === 0,
    missing,
    items,
    message: missing.length
      ? `Missing contact information: ${missing.map((m) => m.label).join(', ')}.`
      : 'Contact information complete',
  }
}

/**
 * Resolve required document types for a verification type (from type row, then settings).
 */
export function resolveRequiredDocumentTypes(selectedType, settings = null) {
  const fromType = selectedType?.required_document_types
  if (Array.isArray(fromType) && fromType.length) return [...fromType]
  const accepted = settings?.accepted_document_types
  if (Array.isArray(accepted) && accepted.length) {
    // Sensible defaults per code when type row has empty array
    const code = selectedType?.code || settings?.default_verification_type_code || 'seller'
    if (code === 'shop') {
      return ['national_id', 'business_registration', 'selfie'].filter((t) => accepted.includes(t) || true)
    }
    if (code === 'business') {
      return ['national_id', 'business_registration', 'proof_of_address']
    }
    return ['national_id', 'selfie']
  }
  return ['national_id', 'selfie']
}

/**
 * Check required documents are uploaded with a valid status.
 */
export function checkDocumentRequirements(docs = [], requiredTypes = [], { requireDocuments = true } = {}) {
  if (!requireDocuments) {
    return {
      ok: true,
      missing: [],
      uploadedCount: Array.isArray(docs) ? docs.length : 0,
      requiredCount: 0,
      message: 'Documents optional',
    }
  }
  const list = filterActiveVerificationDocuments(Array.isArray(docs) ? docs : [])
  const byType = {}
  list.forEach((d) => {
    const status = String(d.status || 'uploaded').toLowerCase()
    if (['rejected', 'needs_replacement', 'invalid'].includes(status)) return
    const valid = VALID_DOCUMENT_STATUSES.includes(status) || !d.status
    if (!valid) return
    if (!d.storage_path && !d.file_name && !d.file_url) return
    if (!byType[d.doc_type]) byType[d.doc_type] = []
    byType[d.doc_type].push(d)
  })

  const missing = (requiredTypes || []).filter((t) => !(byType[t]?.length))
  const uploadedRequired = (requiredTypes || []).filter((t) => byType[t]?.length).length

  return {
    ok: missing.length === 0,
    missing,
    missingLabels: missing.map(docTypeLabel),
    uploadedCount: list.length,
    requiredCount: requiredTypes?.length || 0,
    uploadedRequired,
    byType,
    message: missing.length
      ? `Missing documents: ${missing.map(docTypeLabel).join(', ')}.`
      : `${uploadedRequired} of ${requiredTypes.length} required documents uploaded`,
  }
}

/**
 * Payment gate for final submit:
 * - confirmed (any ledger row or request flags), OR
 * - manual: proof uploaded / awaiting confirmation
 * Never treats payment as "verified" — only as fee completed for review pipeline.
 */
export function checkPaymentRequirement(request = null, payments = []) {
  const list = Array.isArray(payments) ? payments : []
  // Prefer most relevant payment: confirmed > awaiting > latest open
  const isConfirmedStatus = (s) => {
    const v = String(s || '').toLowerCase()
    return v === 'confirmed' || v === 'success' || v === 'paid' || v === PAYMENT_STATUSES.CONFIRMED
  }
  const isAwaitingStatus = (s) => {
    const v = String(s || '').toLowerCase()
    return v === PAYMENT_STATUSES.AWAITING_CONFIRMATION || v === 'awaiting_confirmation'
  }

  const confirmedRow = list.find((p) => isConfirmedStatus(p.payment_status)) || null
  const awaitingRow = list.find((p) => isAwaitingStatus(p.payment_status)) || null
  const latest = confirmedRow || awaitingRow || list[0] || null
  const payStatus = latest?.payment_status || null

  // Statuses past the payment gate (admin already treated fee as settled)
  const pastPaymentStage = [
    VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
    VERIFICATION_STATUSES.UNDER_REVIEW,
    VERIFICATION_STATUSES.APPROVED,
    VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED,
    VERIFICATION_STATUSES.REJECTED,
  ].includes(request?.status)

  const requestPaid = pastPaymentStage
    || !!request?.payment_confirmed_at
    || (Number(request?.amount_paid) > 0)

  const ledgerConfirmed = list.some((p) => isConfirmedStatus(p.payment_status))
  const confirmed = ledgerConfirmed || requestPaid

  const hasProof = !!(
    latest?.transaction_reference
    || latest?.receipt_path
    || latest?.receipt_file_name
    || request?.payment_ref
    || list.some((p) => p.transaction_reference || p.receipt_path)
  )

  const awaiting =
    !confirmed && (
      isAwaitingStatus(payStatus)
      || list.some((p) => isAwaitingStatus(p.payment_status))
      || (
        (String(payStatus || '').toLowerCase() === PAYMENT_STATUSES.INITIATED
          || String(payStatus || '').toLowerCase() === PAYMENT_STATUSES.PENDING)
        && hasProof
      )
      || (
        request?.status === VERIFICATION_STATUSES.PAYMENT_PENDING
        && hasProof
      )
    )

  const ok = confirmed || awaiting

  let label = 'Not started'
  if (confirmed) label = 'Payment confirmed'
  else if (awaiting) label = 'Awaiting confirmation'
  else if (payStatus) label = paymentStatusLabel(payStatus)
  else if (request?.status === VERIFICATION_STATUSES.PAYMENT_PENDING) label = 'Payment pending'

  return {
    ok,
    confirmed,
    awaiting: !!awaiting,
    hasProof,
    latest: confirmedRow || latest,
    label,
    message: ok
      ? (confirmed
        ? 'Payment confirmed'
        : 'Payment proof submitted — awaiting admin confirmation')
      : 'Complete payment (or submit payment proof) before submitting verification.',
  }
}

/**
 * Seller-facing effective status for UI (never show payment_pending when paid / need-info).
 */
export function getSellerDisplayStatus(request, payments = []) {
  if (!request) return null
  const status = request.status
  const needsMoreInfo = status === VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED
    || (!!request.additional_info_message
      && ![
        VERIFICATION_STATUSES.APPROVED,
        VERIFICATION_STATUSES.REJECTED,
        VERIFICATION_STATUSES.DRAFT,
        VERIFICATION_STATUSES.CANCELLED,
        VERIFICATION_STATUSES.EXPIRED,
      ].includes(status))
  if (needsMoreInfo) return VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED

  const paymentCheck = checkPaymentRequirement(request, payments)
  if (paymentCheck.confirmed && (
    status === VERIFICATION_STATUSES.PAYMENT_PENDING
    || status === VERIFICATION_STATUSES.DRAFT
    || status === VERIFICATION_STATUSES.SUBMITTED
  )) {
    return VERIFICATION_STATUSES.UNDER_REVIEW
  }
  return status
}

/**
 * Whether an existing request blocks a new / duplicate submit.
 */
export function getActiveRequestBlock(request) {
  if (!request?.status) return { blocked: false, status: null, message: '' }

  if (request.status === VERIFICATION_STATUSES.APPROVED) {
    return {
      blocked: true,
      status: request.status,
      message: 'You are already verified. No new application is needed.',
    }
  }

  if (request.status === VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED) {
    return {
      blocked: false,
      status: request.status,
      canResume: true,
      message: request.additional_info_message
        || 'Additional information is required. Update documents and resubmit.',
    }
  }

  if (BLOCKING_SUBMISSION_STATUSES.includes(request.status)
    || request.status === 'pending') {
    // payment_pending / submitted / under_review — show status, don't open second request
    if (request.status === VERIFICATION_STATUSES.DRAFT) {
      return { blocked: false, status: request.status, message: '' }
    }
    if ([
      VERIFICATION_STATUSES.SUBMITTED,
      VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
      VERIFICATION_STATUSES.UNDER_REVIEW,
      'pending',
    ].includes(request.status)) {
      return {
        blocked: true,
        status: request.status,
        message: `You already have an active verification request (${statusLabel(request.status)}). Track it below instead of submitting again.`,
      }
    }
    // payment_pending: allow completing docs/payment but not double-submit as new app
    if (request.status === VERIFICATION_STATUSES.PAYMENT_PENDING) {
      return {
        blocked: false,
        status: request.status,
        canResume: true,
        message: 'Payment is pending confirmation. You can finish documents and wait for confirmation.',
      }
    }
  }

  return { blocked: false, status: request.status, message: '' }
}

/**
 * Full pre-submit checklist for the verification wizard.
 */
export function buildVerificationChecklist({
  profile = null,
  userEmail = null,
  typeCode = null,
  selectedType = null,
  settings = null,
  docs = [],
  payments = [],
  request = null,
  agreed = false,
} = {}) {
  const profileCheck = checkProfileCompleteness(profile)
  const contactCheck = checkContactInformation(profile, settings || {}, userEmail)

  // Accept catalog type codes (seller / shop / business and any active type)
  const typeSelected = !!(typeCode && String(typeCode).trim())
    && !!(selectedType?.code || ['seller', 'shop', 'business'].includes(String(typeCode)))

  const requiredDocs = resolveRequiredDocumentTypes(
    selectedType || (typeCode ? { code: typeCode } : null),
    settings
  )
  const requireDocuments = settings?.require_documents !== false
  const docsCheck = checkDocumentRequirements(docs, requiredDocs, { requireDocuments })
  const paymentCheck = checkPaymentRequirement(request, payments)
  const activeBlock = getActiveRequestBlock(request)

  // Duplicate active submission (not draft / not additional_info)
  const duplicateBlocked = activeBlock.blocked
    && request?.status !== VERIFICATION_STATUSES.DRAFT
    && request?.status !== VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED
    && request?.status !== VERIFICATION_STATUSES.PAYMENT_PENDING

  const sections = [
    {
      id: 'profile',
      label: 'Personal information',
      ok: profileCheck.ok,
      detail: profileCheck.ok ? 'Complete' : profileCheck.missing.map((m) => m.label).join(', '),
      editStep: null,
      editHint: 'Update your profile from the Profile page',
      message: profileCheck.message,
    },
    {
      id: 'type',
      label: 'Verification type',
      ok: typeSelected,
      detail: typeSelected
        ? (selectedType?.name || docTypeLabel(typeCode))
        : 'Not selected',
      editStep: 'type',
      message: typeSelected ? null : 'Select a verification type (Seller, Shop, or Business).',
    },
    {
      id: 'documents',
      label: 'Documents',
      ok: docsCheck.ok,
      detail: docsCheck.ok
        ? `${docsCheck.uploadedRequired || docsCheck.uploadedCount} uploaded`
        : `Missing: ${(docsCheck.missingLabels || []).join(', ')}`,
      editStep: 'documents',
      message: docsCheck.ok ? null : 'Missing documents',
      missingList: docsCheck.missingLabels || [],
    },
    {
      id: 'contact',
      label: 'Contact information',
      ok: contactCheck.ok,
      detail: contactCheck.ok ? 'Complete' : contactCheck.missing.map((m) => m.label).join(', '),
      editStep: null,
      editHint: 'Update phone and location on your profile',
      message: contactCheck.message,
    },
    {
      id: 'payment',
      label: 'Payment',
      ok: paymentCheck.ok,
      detail: paymentCheck.label,
      editStep: 'payment',
      message: paymentCheck.ok ? null : paymentCheck.message,
    },
  ]

  const blockers = []
  if (!profileCheck.ok) blockers.push(profileCheck.message)
  if (!typeSelected) blockers.push('Select a verification type before submitting.')
  if (!docsCheck.ok) {
    blockers.push(
      docsCheck.missing.length
        ? `Missing documents: ${docsCheck.missingLabels.join(', ')}.`
        : 'Please upload your required documents before continuing.'
    )
  }
  if (!contactCheck.ok) blockers.push(contactCheck.message)
  if (!paymentCheck.ok) blockers.push(paymentCheck.message)
  if (duplicateBlocked) blockers.push(activeBlock.message)
  if (!agreed) blockers.push('Please confirm your information is accurate before submitting.')

  // Ready for submit: all checklist ok + agreement + not hard-blocked
  // payment_pending with proof is allowed (awaiting confirmation)
  const canSubmit = sections.every((s) => s.ok)
    && agreed
    && !duplicateBlocked
    && !!(request?.id)
    && [
      VERIFICATION_STATUSES.DRAFT,
      VERIFICATION_STATUSES.PAYMENT_PENDING,
      VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED,
      'pending',
    ].includes(request?.status)

  return {
    ok: canSubmit,
    sections,
    blockers,
    profileCheck,
    contactCheck,
    docsCheck,
    paymentCheck,
    activeBlock,
    typeSelected,
    requiredDocs,
    primaryMessage: blockers[0] || null,
  }
}

/**
 * Map technical / database errors to friendly seller-facing messages.
 */
export function friendlyVerificationError(err) {
  const raw = typeof err === 'string'
    ? err
    : (err?.message || err?.error_description || err?.details || '')
  const msg = String(raw || '').toLowerCase()

  if (!msg) return 'Something went wrong. Please try again.'

  if (/null value|not-null|null constraint|violates not-null/i.test(msg)) {
    return 'Please upload your required documents before continuing.'
  }
  if (/duplicate|unique constraint|already exists|23505/i.test(msg)) {
    return 'You already have an active verification request. Open status tracking to continue.'
  }
  if (/already verified/i.test(msg)) {
    return 'You are already verified.'
  }
  if (/in progress|active request/i.test(msg)) {
    return 'You already have a verification request in progress.'
  }
  if (/disabled/i.test(msg)) {
    return 'Verification is temporarily disabled. Please try again later.'
  }
  if (/storage|bucket|payload too large|entity too large|mime/i.test(msg)) {
    return 'Document upload failed. Use JPEG, PNG, WebP, or PDF under 10 MB and try again.'
  }
  if (/jwt|not authenticated|auth|session|row-level security|rls|permission denied|42501/i.test(msg)) {
    return 'Please sign in again to continue verification.'
  }
  if (/network|fetch|failed to fetch|timeout/i.test(msg)) {
    return 'Network error. Check your connection and try again.'
  }
  if (/payment|checkout|paychangu/i.test(msg) && /fail|error|invalid/i.test(msg)) {
    return 'Payment could not be started. Try again or choose another payment method.'
  }
  // Avoid leaking raw SQL / PostgREST noise
  if (/^[{[]/.test(String(raw).trim()) || /postgres|pgrst|sqlstate|column|relation/i.test(msg)) {
    return 'We could not complete that step. Check your details and try again.'
  }

  // Keep short readable messages; truncate noisy ones
  const clean = String(raw).replace(/\s+/g, ' ').trim()
  if (clean.length > 160) {
    return 'Something went wrong while saving your application. Please try again.'
  }
  return clean
}

export default {
  VERIFICATION_STATUSES,
  PAYMENT_STATUSES,
  WIZARD_STEPS,
  getVerificationSettings,
  getActiveVerificationTypes,
  getLatestVerificationRequest,
  getVerificationRequestById,
  getVerificationDocuments,
  ensureVerificationDraft,
  saveVerificationDraft,
  uploadVerificationDocument,
  deleteVerificationDocument,
  startVerificationPayment,
  confirmVerificationPayment,
  reconcileVerificationPayment,
  cancelVerificationPayment,
  getActivePaymentForRequest,
  assertCanStartVerificationPayment,
  paymentUiState,
  submitVerificationApplication,
  adminTransitionVerification,
  initiatePaychanguCheckout,
  getVerificationPaymentMethods,
  getPaymentsForRequest,
  createVerificationPayment,
  submitPaymentProof,
  uploadPaymentReceipt,
  adminConfirmPayment,
  adminRejectPayment,
  createVerificationDocSignedUrl,
  getAdminVerificationDocuments,
  getVerificationStatusEvents,
  getAdminVerificationDetail,
  getAdminSellerProfile,
  getAdminApprovalReadiness,
  appendVerificationAdminNote,
  adminApproveVerification,
  adminRejectVerification,
  adminRequestMoreInfo,
  adminUpdateVerificationSettings,
  adminUpdateVerificationType,
  adminUpdatePaymentMethod,
  adminManualVerificationAction,
  getVerificationAnalytics,
  adminListVerificationProfiles,
  getVerificationAdminAudit,
  getVerificationAdminActivityFeed,
  getLatestRequestIdForSeller,
  adminSyncVerifiedBadgesFromRequests,
  resolveEffectiveFee,
  clearVerificationSettingsCache,
  getUserFacingReviewEstimate,
  getValidityLabel,
  notifySellerVerificationEvent,
  notifyVerificationLifecycle,
  notifyAdminsVerificationEvent,
  getAdminVerificationNotifications,
  markAdminVerificationNotificationsRead,
  markVerificationActionNotificationsRead,
  getSellerVerificationAttention,
  VERIFICATION_NOTIF_TYPES,
  ADMIN_VERIFICATION_EVENTS,
  enrichAdminVerificationQueue,
  buildAdminPendingActions,
  filterAdminVerificationQueue,
  getAdminVerificationTone,
  isUserRespondedToAdmin,
  isVerificationOverdue,
  getVerificationReviewDeadline,
  getAdminRequiredAction,
  getSellerVerificationStatusMeta,
  resolveVerificationResumeStep,
  replaceVerificationDocument,
  softRemoveVerificationDocument,
  resubmitVerificationApplication,
  filterActiveVerificationDocuments,
  getSellerProfileForVerification,
  checkProfileCompleteness,
  checkContactInformation,
  resolveRequiredDocumentTypes,
  checkDocumentRequirements,
  checkPaymentRequirement,
  getSellerDisplayStatus,
  getActiveRequestBlock,
  buildVerificationChecklist,
  friendlyVerificationError,
  formatFee,
  statusLabel,
  paymentStatusLabel,
  docTypeLabel,
  isTrackingStatus,
}
