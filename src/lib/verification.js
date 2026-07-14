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
  AWAITING_CONFIRMATION: 'awaiting_confirmation',
  CONFIRMED: 'confirmed',
  FAILED: 'failed',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
  EXPIRED: 'expired',
})

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

export function formatFee(settings = DEFAULT_SETTINGS, amountOverride = null) {
  const amount = Number(
    amountOverride != null ? amountOverride : (settings.fee_amount ?? DEFAULT_SETTINGS.fee_amount)
  )
  const currency = settings.fee_currency || 'MWK'
  if (currency === 'MWK' || currency === 'MK') {
    return `MK ${amount.toLocaleString()}`
  }
  return `${currency} ${amount.toLocaleString()}`
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

/** Latest request for user (any status) */
export async function getLatestVerificationRequest(userId) {
  if (!userId) return null
  const { data, error } = await supabase
    .from('verification_requests')
    .select('*')
    .eq('seller_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) {
    // fallback order by submitted_at
    const { data: d2 } = await supabase
      .from('verification_requests')
      .select('*')
      .eq('seller_id', userId)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    return d2 || null
  }
  return data || null
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
 * After PayChangu confirms — moves to payment_confirmed / under_review.
 * Never sets approved (badge only via admin or approval transition).
 */
export async function confirmVerificationPayment(txRef) {
  if (!txRef) throw new Error('tx_ref required')

  // Prefer Phase 3 gateway confirm (writes verification_payments ledger)
  try {
    const { data: pay, error: payErr } = await supabase.rpc('confirm_verification_gateway_payment', {
      p_tx_ref: txRef,
      p_gateway: 'paychangu',
      p_gateway_payload: { source: 'verify-payment-return' },
    })
    if (!payErr && pay) {
      const row = Array.isArray(pay) ? pay[0] : pay
      if (row?.request_id) {
        const { data: req } = await supabase
          .from('verification_requests')
          .select('*')
          .eq('id', row.request_id)
          .maybeSingle()
        if (req) return req
      }
    }
  } catch { /* fall through */ }

  try {
    const { data, error } = await supabase.rpc('confirm_verification_payment', {
      p_tx_ref: txRef,
    })
    if (!error && data) return Array.isArray(data) ? data[0] : data
  } catch { /* fall through */ }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('verification_requests')
    .update({
      status: VERIFICATION_STATUSES.UNDER_REVIEW,
      payment_confirmed_at: new Date().toISOString(),
      under_review_at: new Date().toISOString(),
      reviewed_at: null,
    })
    .eq('seller_id', user.id)
    .eq('payment_ref', txRef)
    .select('*')

  if (error) throw error
  if (!data?.length) throw new Error('Verification request not found')
  return data[0]
}

export async function cancelVerificationPayment(txRef, userId) {
  if (!txRef) return
  try {
    await supabase
      .from('verification_requests')
      .update({
        status: VERIFICATION_STATUSES.CANCELLED,
        cancelled_at: new Date().toISOString(),
      })
      .eq('seller_id', userId)
      .eq('payment_ref', txRef)
      .in('status', [
        VERIFICATION_STATUSES.DRAFT,
        VERIFICATION_STATUSES.PAYMENT_PENDING,
        VERIFICATION_STATUSES.SUBMITTED,
      ])
  } catch {
    await supabase
      .from('verification_requests')
      .delete()
      .eq('seller_id', userId)
      .eq('payment_ref', txRef)
  }
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
  return Array.isArray(data) ? data[0] : data
}

export async function initiatePaychanguCheckout({
  user,
  feeAmount,
  typeCode = 'seller',
}) {
  const tx_ref = `SOKO-VERIFY-${user.id}-${Date.now()}`
  const baseUrl = window.location.origin
  const { data: fnData, error: fnErr } = await supabase.functions.invoke('initiate-payment', {
    body: {
      seller_id: user.id,
      email: user.email || '',
      first_name: user.user_metadata?.full_name?.split(' ')[0] || 'Seller',
      last_name: user.user_metadata?.full_name?.split(' ')[1] || '',
      tx_ref,
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

export async function getPaymentsForRequest(requestId) {
  if (!requestId) return []
  try {
    const { data, error } = await supabase.rpc('get_verification_payments_for_request', {
      p_request_id: requestId,
    })
    if (!error && Array.isArray(data)) return data
  } catch { /* ignore */ }
  const { data } = await supabase
    .from('verification_payments')
    .select('*')
    .eq('request_id', requestId)
    .order('created_at', { ascending: false })
  return data || []
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
      p_status: status,
    })
    if (!error && data) return Array.isArray(data) ? data[0] : data
    if (error) throw error
  } catch (e) {
    // Fallback insert
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw e
    const { data, error } = await supabase
      .from('verification_payments')
      .insert({
        request_id: requestId,
        seller_id: user.id,
        payment_method: paymentMethod,
        payment_amount: paymentAmount,
        currency,
        transaction_reference: transactionReference,
        payment_status: status,
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
}) {
  try {
    const { data, error } = await supabase.rpc('submit_verification_payment_proof', {
      p_payment_id: paymentId,
      p_transaction_reference: transactionReference,
      p_receipt_path: receiptPath,
      p_receipt_file_name: receiptFileName,
      p_payment_date: paymentDate || new Date().toISOString(),
    })
    if (!error && data) return Array.isArray(data) ? data[0] : data
    if (error) throw error
  } catch (e) {
    const { data, error } = await supabase
      .from('verification_payments')
      .update({
        transaction_reference: transactionReference,
        receipt_path: receiptPath,
        receipt_file_name: receiptFileName,
        payment_date: paymentDate || new Date().toISOString(),
        payment_status: PAYMENT_STATUSES.AWAITING_CONFIRMATION,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paymentId)
      .select('*')
      .single()
    if (error) throw e
    return data
  }
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
  return Array.isArray(data) ? data[0] : data
}

export default {
  VERIFICATION_STATUSES,
  PAYMENT_STATUSES,
  WIZARD_STEPS,
  getVerificationSettings,
  getActiveVerificationTypes,
  getLatestVerificationRequest,
  getVerificationDocuments,
  ensureVerificationDraft,
  saveVerificationDraft,
  uploadVerificationDocument,
  deleteVerificationDocument,
  startVerificationPayment,
  confirmVerificationPayment,
  cancelVerificationPayment,
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
  formatFee,
  statusLabel,
  paymentStatusLabel,
  docTypeLabel,
  isTrackingStatus,
}
