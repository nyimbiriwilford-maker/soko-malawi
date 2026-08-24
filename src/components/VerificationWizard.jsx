import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  WIZARD_STEPS,
  VERIFICATION_STATUSES,
  getVerificationSettings,
  getActiveVerificationTypes,
  getLatestVerificationRequest,
  getVerificationRequestById,
  getVerificationDocuments,
  ensureVerificationDraft,
  saveVerificationDraft,
  uploadVerificationDocument,
  startVerificationPayment,
  submitVerificationApplication,
  initiatePaychanguCheckout,
  getVerificationPaymentMethods,
  getPaymentsForRequest,
  createVerificationPayment,
  submitPaymentProof,
  uploadPaymentReceipt,
  assertCanStartVerificationPayment,
  getActivePaymentForRequest,
  getSellerProfileForVerification,
  buildVerificationChecklist,
  resolveRequiredDocumentTypes,
  resolveVerificationResumeStep,
  resubmitVerificationApplication,
  replaceVerificationDocument,
  softRemoveVerificationDocument,
  filterActiveVerificationDocuments,
  getVerificationStatusEvents,
  getSellerVerificationStatusMeta,
  checkPaymentRequirement,
  getSellerDisplayStatus,
  resolveEffectiveFee,
  getUserFacingReviewEstimate,
  getValidityLabel,
  friendlyVerificationError,
  formatFee,
  statusLabel,
  paymentStatusLabel,
  docTypeLabel,
  isTrackingStatus,
  getIssuesForRequest,
  PAYMENT_STATUSES,
} from '../lib/verification'

const STEP_IDS = WIZARD_STEPS.map((s) => s.id)

function issueChipStyle(status) {
  const map = {
    open: { background: '#ffedd5', color: '#c2410c' },
    needs_recheck: { background: '#dbeafe', color: '#1d4ed8' },
    resolved: { background: '#e6f4ec', color: '#1a7a4a' },
    waived: { background: '#f3f4f6', color: '#6b7280' },
  }
  const s = map[status] || map.open
  return {
    fontSize: 10,
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: 999,
    ...s,
  }
}

function stepIndex(id) {
  const i = STEP_IDS.indexOf(id)
  return i < 0 ? 0 : i
}

function formatSellerTimelineLabel(ev) {
  const to = ev?.to_status || ''
  const note = String(ev?.note || '').toLowerCase()
  const metaEvent = ev?.meta?.event
  if (metaEvent === 'resubmitted' || note.includes('resubmit')) return 'Information submitted (resubmitted)'
  if (to === 'additional_info_required') return 'Admin requested changes'
  if (to === 'submitted') return 'Application submitted'
  if (to === 'payment_pending') return 'Payment initiated'
  if (to === 'payment_confirmed') return 'Payment completed'
  if (to === 'under_review') return note.includes('resubmit') ? 'Information submitted' : 'Under review'
  if (to === 'approved') return 'Approved'
  if (to === 'rejected') return 'Rejected'
  if (to === 'draft' || note === 'created') return 'Application created'
  if (to === 'admin_note') return 'Admin note'
  return statusLabel(to || 'Update')
}

/**
 * Premium multi-step verification wizard (Phase 2).
 * Drop-in replacement for the old VerificationModal — same props: user, onClose, onSuccess.
 */
export default function VerificationWizard({ user, onClose, onSuccess }) {
  const [boot, setBoot] = useState(true)
  const [settings, setSettings] = useState(null)
  const [types, setTypes] = useState([])
  const [payMethods, setPayMethods] = useState([])
  const [payments, setPayments] = useState([])
  const [step, setStep] = useState('welcome')
  const [request, setRequest] = useState(null)
  const [docs, setDocs] = useState([])
  const [typeCode, setTypeCode] = useState('seller')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('pachangu')
  const [manualTxRef, setManualTxRef] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [busy, setBusy] = useState(false)
  const [uploadBusy, setUploadBusy] = useState(false)
  const [saveFlash, setSaveFlash] = useState('')
  const [agreed, setAgreed] = useState(false)
  const [profile, setProfile] = useState(null)
  const [selectedDocType, setSelectedDocType] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [timelineEvents, setTimelineEvents] = useState([])
  const [replaceDocId, setReplaceDocId] = useState(null)
  const fileRef = useRef(null)
  const receiptRef = useRef(null)
  const saveTimer = useRef(null)
  const dialogRef = useRef(null)
  const titleId = 'vw-title'
  const descId = 'vw-desc'

  const selectedType = useMemo(
    () => types.find((t) => t.code === typeCode) || types[0] || null,
    [types, typeCode]
  )

  const feeAmount = resolveEffectiveFee(selectedType, settings || undefined)
  const feeLabel = formatFee(settings || undefined, feeAmount)
  const reviewHours = settings?.review_period_hours ?? 24
  const reviewEstimate = getUserFacingReviewEstimate(settings)
  const validityLabel = getValidityLabel(settings)
  const requireDocs = settings?.require_documents !== false
  const enabled = settings?.is_enabled !== false

  const activePayMethods = useMemo(() => {
    if (payMethods?.length) return payMethods
    const codes = settings?.supported_payment_methods || ['pachangu', 'airtel_money', 'tnm_mpamba']
    return codes.map((code) => ({
      code,
      name: docTypeLabel(code),
      channel: code === 'pachangu' ? 'gateway' : code === 'bank_transfer' ? 'bank' : code === 'card' ? 'card' : 'mobile_money',
      supports_auto_confirm: code === 'pachangu',
    }))
  }, [payMethods, settings])

  const selectedPayMethod = useMemo(
    () => activePayMethods.find((m) => m.code === paymentMethod) || activePayMethods[0],
    [activePayMethods, paymentMethod]
  )
  const isGatewayPay = selectedPayMethod?.supports_auto_confirm || paymentMethod === 'pachangu'

  // Prefer confirmed payment for display (not a newer open row)
  const latestPayment = useMemo(() => {
    if (!payments?.length) return null
    return payments.find((p) => String(p.payment_status || '').toLowerCase() === 'confirmed')
      || payments.find((p) => String(p.payment_status || '').toLowerCase() === 'awaiting_confirmation')
      || payments[0]
      || null
  }, [payments])

  const paymentCheck = useMemo(
    () => checkPaymentRequirement(request, payments),
    [request, payments]
  )
  const paymentConfirmed = paymentCheck.confirmed === true

  const requiredDocs = useMemo(
    () => resolveRequiredDocumentTypes(selectedType, settings),
    [selectedType, settings]
  )

  const activeDocs = useMemo(() => filterActiveVerificationDocuments(docs), [docs])

  const docsByType = useMemo(() => {
    const map = {}
    activeDocs.forEach((d) => {
      if (!map[d.doc_type]) map[d.doc_type] = []
      map[d.doc_type].push(d)
    })
    return map
  }, [activeDocs])

  const missingDocs = useMemo(() => {
    if (!requireDocs) return []
    return requiredDocs.filter((t) => !(docsByType[t]?.length))
  }, [requireDocs, requiredDocs, docsByType])

  const rejectedDocs = useMemo(
    () => (docs || []).filter((d) =>
      ['rejected', 'needs_replacement', 'invalid'].includes(String(d.status || '').toLowerCase())
    ),
    [docs]
  )

  const checklist = useMemo(
    () => buildVerificationChecklist({
      profile,
      userEmail: user?.email,
      typeCode,
      selectedType,
      settings,
      docs: activeDocs,
      payments,
      request,
      agreed,
    }),
    [profile, user?.email, typeCode, selectedType, settings, activeDocs, payments, request, agreed]
  )

  const profileReady = checklist.profileCheck?.ok !== false
  const paymentSatisfied = paymentConfirmed || checklist.paymentCheck?.ok === true

  // Admin message or status = need info (even if status field lags)
  const needsMoreInfo = request?.status === VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED
    || (!!request?.additional_info_message
      && ![
        VERIFICATION_STATUSES.APPROVED,
        VERIFICATION_STATUSES.REJECTED,
        VERIFICATION_STATUSES.DRAFT,
        VERIFICATION_STATUSES.CANCELLED,
        VERIFICATION_STATUSES.EXPIRED,
      ].includes(request?.status))
  const isResubmitFlow = needsMoreInfo

  // Structured admin-flagged issues (shown only on the status step)
  const [issues, setIssues] = useState([])
  useEffect(() => {
    if (!needsMoreInfo || !request?.id) {
      setIssues([])
      return
    }
    let cancelled = false
    void getIssuesForRequest(request.id).then((list) => {
      if (!cancelled) setIssues(Array.isArray(list) ? list : [])
    })
    return () => { cancelled = true }
  }, [needsMoreInfo, request?.id, request?.status, request?.updated_at])
  const openIssues = issues.filter((i) => i.status === 'open' || i.status === 'needs_recheck')
  const deadlineAt = request?.additional_info_deadline_at || null

  // Calculate deadline status
  const deadlineStatus = useMemo(() => {
    if (!deadlineAt) return null
    const deadline = new Date(deadlineAt)
    const now = new Date()
    const hoursRemaining = (deadline - now) / (1000 * 60 * 60)

    if (hoursRemaining < 0) {
      return { status: 'expired', message: 'Deadline has passed', color: '#b91c1c', bg: '#fee2e2' }
    } else if (hoursRemaining < 24) {
      return { status: 'urgent', message: `Less than ${Math.floor(hoursRemaining)} hours remaining`, color: '#c2410c', bg: '#ffedd5' }
    } else if (hoursRemaining < 72) {
      return { status: 'soon', message: `${Math.floor(hoursRemaining / 24)} days remaining`, color: '#b45309', bg: '#fef3c7' }
    }
    return { status: 'ok', message: `Deadline: ${deadline.toLocaleString()}`, color: '#9a3412', bg: null }
  }, [deadlineAt])

  // Display status for seller (never "payment pending" when payment is confirmed / need-info)
  const displayStatus = useMemo(
    () => getSellerDisplayStatus(request, payments),
    [request, payments]
  )

  const statusMeta = getSellerVerificationStatusMeta(displayStatus)

  const progressPct = useMemo(() => {
    const i = stepIndex(step)
    return Math.round(((i + 1) / WIZARD_STEPS.length) * 100)
  }, [step])

  const flashSaved = () => {
    setSaveFlash('Draft saved')
    setTimeout(() => setSaveFlash(''), 1600)
  }

  const refreshDocs = useCallback(async (requestId, uid) => {
    const list = await getVerificationDocuments(requestId, uid)
    setDocs(list)
  }, [])

  const refreshPayments = useCallback(async (requestId, opts = {}) => {
    if (!requestId && !opts.paymentRef) {
      setPayments([])
      return []
    }
    const list = await getPaymentsForRequest(requestId, {
      paymentRef: opts.paymentRef || null,
      sellerId: opts.sellerId || user?.id || null,
    })
    setPayments(list)
    return list
  }, [user?.id])

  const refreshTimeline = useCallback(async (requestId) => {
    if (!requestId) {
      setTimelineEvents([])
      return
    }
    const events = await getVerificationStatusEvents(requestId)
    setTimelineEvents(events || [])
  }, [])

  // Bootstrap
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    ;(async () => {
      setBoot(true)
      setError('')
      try {
        const [s, t, methods, latest, sellerProfile] = await Promise.all([
          getVerificationSettings(),
          getActiveVerificationTypes(),
          getVerificationPaymentMethods(),
          getLatestVerificationRequest(user.id),
          getSellerProfileForVerification(user.id),
        ])
        if (cancelled) return
        setSettings(s)
        setTypes(t?.length ? t : [])
        setPayMethods(methods || [])
        setProfile(sellerProfile)
        const defaultCode = s.default_verification_type_code || t?.[0]?.code || 'seller'
        const defaultPay = methods?.[0]?.code
          || (s.supported_payment_methods || ['pachangu'])[0]
          || 'pachangu'
        setPaymentMethod(defaultPay)

        if (latest?.status === VERIFICATION_STATUSES.DRAFT) {
          setRequest(latest)
          setTypeCode(latest.meta?.type_code || defaultCode)
          setNotes(latest.notes || latest.meta?.notes || '')
          setPaymentMethod(
            latest.payment_method
            || latest.meta?.payment_method
            || (s.supported_payment_methods || [])[0]
            || 'pachangu'
          )
          await refreshDocs(latest.id, user.id)
          await refreshPayments(latest.id, {
            paymentRef: latest.payment_ref,
            sellerId: user.id,
          })
          await refreshTimeline(latest.id)
          const resume = latest.meta?.wizard_step
          setStep(resume && STEP_IDS.includes(resume) && resume !== 'status' ? resume : 'welcome')
        } else if (
          latest?.status === VERIFICATION_STATUSES.PAYMENT_PENDING
          || latest?.status === VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED
          || latest?.additional_info_message
          || latest?.payment_confirmed_at
          || Number(latest?.amount_paid) > 0
        ) {
          // Resume editable steps — do not restart wizard
          // Fresh row by id (avoids stale list row after admin need-info / pay confirm)
          const fresh = (await getVerificationRequestById(latest.id)) || latest
          setRequest(fresh)
          const code = fresh.meta?.type_code || defaultCode
          setTypeCode(code)
          setNotes(fresh.notes || fresh.meta?.notes || '')
          setPaymentMethod(fresh.payment_method || fresh.meta?.payment_method || defaultPay)
          await refreshDocs(fresh.id, user.id)
          const pays = await refreshPayments(fresh.id, {
            paymentRef: fresh.payment_ref,
            sellerId: user.id,
          })
          await refreshTimeline(fresh.id)
          // Re-pick best request (admin may have moved another open request to need-info)
          const refreshed = await getLatestVerificationRequest(user.id)
          const activeReq = refreshed
            ? ((await getVerificationRequestById(refreshed.id)) || refreshed)
            : fresh
          if (activeReq?.id !== fresh.id) {
            setRequest(activeReq)
            await refreshDocs(activeReq.id, user.id)
            await refreshPayments(activeReq.id, {
              paymentRef: activeReq.payment_ref,
              sellerId: user.id,
            })
            await refreshTimeline(activeReq.id)
          } else {
            setRequest(activeReq)
          }
          const paysForActive = activeReq?.id === fresh.id
            ? pays
            : await getPaymentsForRequest(activeReq.id, {
              paymentRef: activeReq.payment_ref,
              sellerId: user.id,
            })
          if (activeReq?.id !== fresh.id) setPayments(paysForActive)
          const docsList = await getVerificationDocuments(activeReq.id, user.id)
          const payOk = checkPaymentRequirement(activeReq, paysForActive)
          const tSel = (t || []).find((x) => x.code === code) || null
          const needsInfo = activeReq.status === VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED
            || !!activeReq.additional_info_message
          if (needsInfo) {
            // Start on status so admin message is visible
            setStep('status')
          } else if (payOk.confirmed) {
            // Paid — always land on status (under review / waiting for admin), not pay wall
            setStep('status')
          } else {
            const resumeStep = resolveVerificationResumeStep({
              request: activeReq,
              profile: sellerProfile,
              docs: docsList,
              payments: paysForActive,
              selectedType: tSel,
              settings: s,
              typeCode: code,
            })
            setStep(resumeStep === 'payment' && payOk.confirmed ? 'status' : resumeStep)
          }
        } else if (latest && isTrackingStatus(latest.status)) {
          // Submitted / under review / decided → status tracking only
          const fresh = (await getVerificationRequestById(latest.id)) || latest
          setRequest(fresh)
          setTypeCode(fresh.meta?.type_code || defaultCode)
          setNotes(fresh.notes || fresh.meta?.notes || '')
          setPaymentMethod(fresh.payment_method || fresh.meta?.payment_method || defaultPay)
          await refreshDocs(fresh.id, user.id)
          await refreshPayments(fresh.id, {
            paymentRef: fresh.payment_ref,
            sellerId: user.id,
          })
          await refreshTimeline(fresh.id)
          setStep('status')
        } else {
          setTypeCode(defaultCode)
          const draft = await ensureVerificationDraft({
            userId: user.id,
            typeCode: defaultCode,
            typeId: t.find((x) => x.code === defaultCode)?.id,
            settings: s,
            wizardStep: 'welcome',
          })
          if (cancelled) return
          setRequest(draft)
          await refreshDocs(draft?.id, user.id)
          await refreshPayments(draft?.id)
          await refreshTimeline(draft?.id)
          setStep('welcome')
        }
      } catch (e) {
        if (!cancelled) setError(friendlyVerificationError(e) || 'Could not load verification wizard')
      } finally {
        if (!cancelled) setBoot(false)
      }
    })()
    return () => { cancelled = true }
  }, [user?.id, refreshDocs, refreshPayments, refreshTimeline])

  // Focus dialog on open
  useEffect(() => {
    const t = setTimeout(() => {
      dialogRef.current?.querySelector('button, [href], input, select, textarea')?.focus?.()
    }, 50)
    return () => clearTimeout(t)
  }, [step, boot])

  // Escape to close
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy && !uploadBusy) onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, busy, uploadBusy])

  // Keep status step in sync with admin actions (pay confirm / need-info)
  useEffect(() => {
    if (boot || !user?.id) return
    if (step !== 'status' && !needsMoreInfo) return

    let cancelled = false
    const sync = async () => {
      try {
        const latest = await getLatestVerificationRequest(user.id)
        if (cancelled || !latest) return
        const fresh = (await getVerificationRequestById(latest.id)) || latest
        if (cancelled || !fresh) return
        setRequest((prev) => {
          if (!prev) return fresh
          if (prev.id !== fresh.id) return fresh
          if (
            prev.status !== fresh.status
            || prev.updated_at !== fresh.updated_at
            || prev.additional_info_message !== fresh.additional_info_message
            || prev.payment_confirmed_at !== fresh.payment_confirmed_at
            || Number(prev.amount_paid || 0) !== Number(fresh.amount_paid || 0)
          ) {
            return fresh
          }
          return prev
        })
        await refreshPayments(fresh.id, {
          paymentRef: fresh.payment_ref,
          sellerId: user.id,
        })
        await refreshTimeline(fresh.id)
      } catch { /* soft */ }
    }

    // Immediate re-sync when landing on status (catches admin updates since bootstrap)
    void sync()
    const interval = setInterval(sync, 8000)
    const onFocus = () => { void sync() }
    const onVis = () => {
      if (document.visibilityState === 'visible') void sync()
    }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [boot, user?.id, step, needsMoreInfo, refreshPayments, refreshTimeline])

  const scheduleAutosave = useCallback((patch) => {
    if (!request?.id) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSaving(true)
      try {
        const saved = await saveVerificationDraft(request.id, {
          typeId: selectedType?.id,
          typeCode,
          notes,
          wizardStep: step,
          paymentMethod,
          amountDue: feeAmount,
          ...patch,
        })
        if (saved) setRequest(saved)
        flashSaved()
      } catch {
        /* soft-fail autosave */
      } finally {
        setSaving(false)
      }
    }, 700)
  }, [request?.id, selectedType?.id, typeCode, notes, step, paymentMethod, feeAmount])

  // Autosave when fields change
  useEffect(() => {
    if (boot || !request?.id) return
    if (![VERIFICATION_STATUSES.DRAFT, VERIFICATION_STATUSES.PAYMENT_PENDING, VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED].includes(request.status)
      && request.status !== 'pending') return
    scheduleAutosave({})
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current)
    }
  }, [typeCode, notes, paymentMethod, step, boot, request?.id, request?.status, scheduleAutosave])

  async function goTo(next) {
    setError('')
    const advancing = stepIndex(next) > stepIndex(step)

    // Validate before advancing past gated steps
    if (advancing) {
      if (!profileReady && ['type', 'payment', 'documents', 'review', 'submit'].includes(next)) {
        setError('Complete your profile before requesting verification.')
        return
      }
      if (step === 'type' && !typeCode) {
        setError('Please choose a verification type (Seller, Shop, or Business).')
        return
      }
      if (step === 'type' && typeCode && !selectedType && !types.some((t) => t.code === typeCode)) {
        setError('Please choose a valid verification type.')
        return
      }
      if (step === 'documents' && requireDocs && missingDocs.length && ['review', 'submit'].includes(next)) {
        setError(
          missingDocs.length
            ? `Missing documents: ${missingDocs.map(docTypeLabel).join(', ')}.`
            : 'Please upload your required documents before continuing.'
        )
        return
      }
      if (step === 'payment' && ['review', 'submit'].includes(next) && !paymentSatisfied) {
        // Allow moving forward to docs even without payment; block only final review/submit later
        // Payment is enforced on submit — soft warn when jumping past pay into review
      }
      if (step === 'review' && next === 'submit') {
        if (!agreed) {
          setError('Please confirm the accuracy of your information.')
          return
        }
        const pre = buildVerificationChecklist({
          profile,
          userEmail: user?.email,
          typeCode,
          selectedType,
          settings,
          docs,
          payments,
          request,
          agreed: true,
        })
        if (!pre.ok) {
          setError(pre.primaryMessage || 'Please complete all required items before submitting.')
          // Jump to first incomplete section when possible
          const firstBad = pre.sections.find((s) => !s.ok)
          if (firstBad?.editStep) setStep(firstBad.editStep)
          return
        }
      }
    }

    if (request?.id) {
      try {
        setSaving(true)
        const saved = await saveVerificationDraft(request.id, {
          typeId: selectedType?.id,
          typeCode,
          notes,
          wizardStep: next,
          paymentMethod,
          amountDue: feeAmount,
        })
        if (saved) setRequest(saved)
      } catch { /* ignore */ }
      finally { setSaving(false) }
    }
    setStep(next)
  }

  function nextStep() {
    const i = stepIndex(step)
    if (i < STEP_IDS.length - 1) goTo(STEP_IDS[i + 1])
  }

  function prevStep() {
    const i = stepIndex(step)
    if (i > 0) goTo(STEP_IDS[i - 1])
  }

  async function ensureDraftForPayment() {
    let req = request
    if (!req?.id) {
      req = await ensureVerificationDraft({
        userId: user.id,
        typeCode,
        typeId: selectedType?.id,
        settings,
        wizardStep: 'payment',
        notes,
      })
      setRequest(req)
    } else {
      await saveVerificationDraft(req.id, {
        typeId: selectedType?.id,
        typeCode,
        notes,
        wizardStep: 'payment',
        paymentMethod,
        amountDue: feeAmount,
      })
    }
    return req
  }

  /** PayChangu / auto-confirm gateways */
  async function handleGatewayPay() {
    if (!user?.id || busy) return
    if (!enabled) {
      setError('Verification is currently disabled by administrators.')
      return
    }
    if (!profileReady) {
      setError('Complete your profile before requesting verification.')
      return
    }
    if (!typeCode) {
      setError('Please choose a verification type before payment.')
      setStep('type')
      return
    }
    setBusy(true)
    setError('')
    try {
      const req = await ensureDraftForPayment()

      // Duplicate / already-paid guard
      const gate = await assertCanStartVerificationPayment(req.id)
      if (gate.alreadyPaid) {
        setError(gate.message || 'Payment already confirmed.')
        await refreshPayments(req.id)
        setBusy(false)
        return
      }

      const { tx_ref, checkout_url } = await initiatePaychanguCheckout({
        user,
        feeAmount,
        typeCode,
        requestId: req.id,
      })

      await startVerificationPayment({
        paymentRef: tx_ref,
        paymentMethod,
        typeCode,
        userId: user.id,
        feeAmount,
        currency: settings?.fee_currency || 'MWK',
        requestId: req.id,
      })

      // Ledger row — reuses open payment; never creates second active payment
      try {
        await createVerificationPayment({
          requestId: req.id,
          paymentMethod: paymentMethod || 'pachangu',
          paymentAmount: feeAmount,
          currency: settings?.fee_currency || 'MWK',
          transactionReference: tx_ref,
          gateway: 'paychangu',
          gatewaySessionId: tx_ref,
          gatewayPayload: { purpose: 'verification', type_code: typeCode },
          status: PAYMENT_STATUSES.INITIATED,
        })
      } catch { /* ledger optional if migration not run */ }

      window.location.href = checkout_url
    } catch (e) {
      if (e?.code === 'ALREADY_PAID') {
        setError(e.message)
      } else {
        setError(friendlyVerificationError(e) || 'Could not start payment')
      }
      setBusy(false)
    }
  }

  /** Manual rails: Airtel / Mpamba / Bank / Card — admin confirms later */
  async function handleManualPaymentSubmit() {
    if (!user?.id || busy) return
    if (!enabled) {
      setError('Verification is currently disabled by administrators.')
      return
    }
    if (!profileReady) {
      setError('Complete your profile before requesting verification.')
      return
    }
    if (!typeCode) {
      setError('Please choose a verification type before payment.')
      setStep('type')
      return
    }
    const ref = manualTxRef.trim()
    if (ref.length < 3) {
      setError('Enter your transaction / reference ID (at least 3 characters).')
      return
    }
    if (!paymentMethod) {
      setError('Select a payment method (Airtel Money, Mpamba, or Bank).')
      return
    }

    setBusy(true)
    setError('')
    try {
      const req = await ensureDraftForPayment()

      const gate = await assertCanStartVerificationPayment(req.id)
      if (gate.alreadyPaid) {
        setError(gate.message || 'Payment already confirmed.')
        setBusy(false)
        return
      }

      await startVerificationPayment({
        paymentRef: ref,
        paymentMethod,
        typeCode,
        userId: user.id,
        feeAmount,
        currency: settings?.fee_currency || 'MWK',
        requestId: req.id,
      })

      // Create or reuse open ledger row (never duplicate active payments)
      let payment = await createVerificationPayment({
        requestId: req.id,
        paymentMethod,
        paymentAmount: feeAmount,
        currency: settings?.fee_currency || 'MWK',
        transactionReference: ref,
        gateway: 'manual',
        status: PAYMENT_STATUSES.INITIATED,
      })
      await refreshPayments(req.id)
      const active = await getActivePaymentForRequest(req.id)
      if (active) payment = active

      // Manual methods require transaction ref + payment proof
      if (!payment?.receipt_path) {
        setError(
          'Upload payment proof (receipt image or PDF), then click “Submit payment proof” again. Transaction reference and method are required.'
        )
        setBusy(false)
        return
      }

      payment = await submitPaymentProof({
        paymentId: payment.id,
        transactionReference: ref,
        receiptPath: payment.receipt_path,
        receiptFileName: payment.receipt_file_name,
        requireReceipt: true,
      })

      await refreshPayments(req.id)
      const latest = await getLatestVerificationRequest(user.id)
      if (latest) setRequest(latest)
      setSaveFlash('Payment proof submitted — awaiting admin confirmation')
      setTimeout(() => setSaveFlash(''), 2500)
      // Do NOT treat as verified
      setStep('documents')
    } catch (e) {
      setError(friendlyVerificationError(e) || 'Could not submit payment proof')
    } finally {
      setBusy(false)
    }
  }

  async function handleReceiptUpload(e) {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file || !user?.id) return

    setUploadBusy(true)
    setError('')
    try {
      // Ensure an open payment row exists so receipt can attach
      let pay = latestPayment
      if (!pay?.id || !OPEN_OR_CREATE_PAYABLE(pay)) {
        const req = await ensureDraftForPayment()
        pay = await createVerificationPayment({
          requestId: req.id,
          paymentMethod,
          paymentAmount: feeAmount,
          currency: settings?.fee_currency || 'MWK',
          transactionReference: manualTxRef.trim() || null,
          gateway: 'manual',
          status: PAYMENT_STATUSES.INITIATED,
        })
        await refreshPayments(req.id)
      }
      if (!pay?.id) {
        setError('Could not create payment entry for receipt. Try again.')
        return
      }

      const { path, fileName } = await uploadPaymentReceipt({
        userId: user.id,
        paymentId: pay.id,
        file,
      })
      // Attach path without promoting to awaiting until full submit
      const { data: patched, error: patchErr } = await supabase
        .from('verification_payments')
        .update({
          receipt_path: path,
          receipt_file_name: fileName,
          updated_at: new Date().toISOString(),
        })
        .eq('id', pay.id)
        .select('*')
        .single()
      if (patchErr) {
        // Fallback: submit proof if update blocked
        const updated = await submitPaymentProof({
          paymentId: pay.id,
          transactionReference: manualTxRef.trim() || pay.transaction_reference || `RCPT-${pay.id.slice(0, 8)}`,
          receiptPath: path,
          receiptFileName: fileName,
        })
        setPayments((prev) => [updated, ...prev.filter((p) => p.id !== updated.id)])
      } else {
        setPayments((prev) => [patched, ...prev.filter((p) => p.id !== patched.id)])
      }
      flashSaved()
      setSaveFlash('Receipt uploaded — enter ref and submit proof')
      setTimeout(() => setSaveFlash(''), 2200)
    } catch (err) {
      setError(friendlyVerificationError(err) || 'Receipt upload failed')
    } finally {
      setUploadBusy(false)
    }
  }

  function OPEN_OR_CREATE_PAYABLE(pay) {
    if (!pay) return false
    return ['pending', 'initiated', 'awaiting_confirmation', 'failed', 'cancelled', 'expired']
      .includes(String(pay.payment_status || ''))
  }

  async function handlePay() {
    if (isGatewayPay) return handleGatewayPay()
    return handleManualPaymentSubmit()
  }

  async function handleUpload(e) {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file || !user?.id) return

    if (file.size > 10 * 1024 * 1024) {
      setError('File too large. Max 10 MB.')
      return
    }
    const okTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (file.type && !okTypes.includes(file.type)) {
      setError('Use JPEG, PNG, WebP, or PDF.')
      return
    }

    setUploadBusy(true)
    setError('')
    try {
      let req = request
      if (!req?.id) {
        req = await ensureVerificationDraft({
          userId: user.id,
          typeCode,
          typeId: selectedType?.id,
          settings,
          wizardStep: 'documents',
          notes,
        })
        setRequest(req)
      }
      const docType = selectedDocType || missingDocs[0] || requiredDocs[0] || 'other'
      const previous = replaceDocId
        ? docs.find((d) => d.id === replaceDocId)
        : (docsByType[docType]?.[0] || null)

      if (previous && (needsMoreInfo || replaceDocId)) {
        await replaceVerificationDocument({
          userId: user.id,
          requestId: req.id,
          file,
          docType,
          previousDoc: previous,
        })
      } else {
        await uploadVerificationDocument({
          userId: user.id,
          requestId: req.id,
          file,
          docType,
        })
      }
      await refreshDocs(req.id, user.id)
      setSelectedDocType('')
      setReplaceDocId(null)
      flashSaved()
    } catch (err) {
      setError(friendlyVerificationError(err) || 'Please upload your required documents before continuing.')
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleRemoveDoc(doc) {
    setUploadBusy(true)
    setError('')
    try {
      const hard = request?.status === VERIFICATION_STATUSES.DRAFT
      await softRemoveVerificationDocument(doc, { hard })
      await refreshDocs(request?.id, user.id)
    } catch (e) {
      setError(friendlyVerificationError(e) || 'Could not remove document')
    } finally {
      setUploadBusy(false)
    }
  }

  function continueAdditionalInfo() {
    const resumeStep = resolveVerificationResumeStep({
      request,
      profile,
      docs,
      payments,
      selectedType,
      settings,
      typeCode,
    })
    setError('')
    setStep(resumeStep)
  }

  async function handleSubmit() {
    if (submitting || busy) return

    if (!request?.id) {
      setError('No verification draft found. Go back and try again.')
      return
    }

    // Block duplicate submissions (except additional_info resubmit)
    if ([
      VERIFICATION_STATUSES.SUBMITTED,
      VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
      VERIFICATION_STATUSES.UNDER_REVIEW,
      VERIFICATION_STATUSES.APPROVED,
      'pending',
    ].includes(request.status)) {
      setError(
        `You already have an active verification request (${statusLabel(request.status)}). Track it on the status screen.`
      )
      setStep('status')
      return
    }

    const pre = buildVerificationChecklist({
      profile,
      userEmail: user?.email,
      typeCode,
      selectedType,
      settings,
      docs: activeDocs,
      payments,
      request,
      agreed,
    })

    if (!pre.ok) {
      const firstBad = pre.sections.find((s) => !s.ok)
      if (firstBad?.id === 'profile' || firstBad?.id === 'contact') {
        setError(firstBad.message || 'Complete your profile before requesting verification.')
      } else if (firstBad?.id === 'documents') {
        setError(
          firstBad.missingList?.length
            ? `Missing documents: ${firstBad.missingList.join(', ')}.`
            : 'Missing documents'
        )
        setStep('documents')
      } else if (firstBad?.editStep) {
        setError(firstBad.message || pre.primaryMessage)
        setStep(firstBad.editStep)
      } else {
        setError(pre.primaryMessage || 'Please complete all required items before submitting.')
      }
      return
    }

    setSubmitting(true)
    setBusy(true)
    setError('')
    try {
      const latest = await getLatestVerificationRequest(user.id)

      if (
        (latest?.status === VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED
          || request.status === VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED)
        && (!latest || latest.id === request.id)
      ) {
        await saveVerificationDraft(request.id, {
          typeId: selectedType?.id,
          typeCode,
          notes,
          wizardStep: 'status',
          paymentMethod,
          amountDue: feeAmount,
          metaExtra: { resubmit_ready: true },
        })
        const resubmitted = await resubmitVerificationApplication(request.id, {
          notes,
          message: notes || 'Seller resubmitted after providing additional information',
        })
        setRequest(resubmitted)
        await refreshTimeline(request.id)
        setStep('status')
        onSuccess?.()
        return
      }

      if (latest && latest.id !== request.id
        && [
          VERIFICATION_STATUSES.SUBMITTED,
          VERIFICATION_STATUSES.UNDER_REVIEW,
          VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
          VERIFICATION_STATUSES.APPROVED,
          'pending',
        ].includes(latest.status)) {
        setRequest(latest)
        setError(`You already have an active verification request (${statusLabel(latest.status)}).`)
        setStep('status')
        return
      }
      if (latest && latest.id === request.id
        && [
          VERIFICATION_STATUSES.SUBMITTED,
          VERIFICATION_STATUSES.UNDER_REVIEW,
          VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
          VERIFICATION_STATUSES.APPROVED,
        ].includes(latest.status)) {
        setRequest(latest)
        setStep('status')
        return
      }

      await saveVerificationDraft(request.id, {
        typeId: selectedType?.id,
        typeCode,
        notes,
        wizardStep: 'status',
        paymentMethod,
        amountDue: feeAmount,
      })
      const submitted = await submitVerificationApplication(request.id, { notes })
      setRequest(submitted)
      await refreshTimeline(request.id)
      setStep('status')
      onSuccess?.()
    } catch (e) {
      setError(friendlyVerificationError(e) || 'Could not submit your application. Please try again.')
    } finally {
      setBusy(false)
      setSubmitting(false)
    }
  }

  const idx = stepIndex(step)
  const canGoBack = idx > 0 && step !== 'status'

  if (!user?.id) {
    return (
      <div className="vw-overlay" role="presentation" onClick={() => onClose?.()}>
        <style>{vwCss}</style>
        <div className="vw-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId}>
          <header className="vw-header">
            <div className="vw-brand">
              <div className="vw-brand-mark" aria-hidden="true">✓</div>
              <div>
                <h2 id={titleId} className="vw-title">Get verified</h2>
                <p className="vw-sub">Sign in required</p>
              </div>
            </div>
            <button type="button" className="vw-close" onClick={() => onClose?.()} aria-label="Close">×</button>
          </header>
          <div className="vw-body">
            <div className="vw-alert" role="alert">You must be signed in to get verified.</div>
          </div>
          <footer className="vw-footer">
            <div className="vw-footer-right">
              <button type="button" className="vw-btn-primary" onClick={() => onClose?.()}>Close</button>
            </div>
          </footer>
        </div>
      </div>
    )
  }

  return (
    <div
      className="vw-overlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy && !uploadBusy) onClose?.()
      }}
    >
      <style>{vwCss}</style>
      <div
        ref={dialogRef}
        className="vw-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
      >
        {/* Header */}
        <header className="vw-header">
          <div className="vw-brand">
            <span className="vw-brand-mark" aria-hidden="true">✓</span>
            <div>
              <h2 id={titleId} className="vw-title">Seller verification</h2>
              <p id={descId} className="vw-sub">
                Secure · PayChangu · Review ~{reviewHours}h
              </p>
            </div>
          </div>
          <div className="vw-header-right">
            {(saving || saveFlash) && (
              <span className="vw-save-pill" aria-live="polite">
                {saving ? 'Saving…' : saveFlash}
              </span>
            )}
            <button
              type="button"
              className="vw-close"
              onClick={onClose}
              aria-label="Close verification wizard"
              disabled={busy}
            >
              ×
            </button>
          </div>
        </header>

        {/* Progress */}
        <div className="vw-progress" aria-hidden="true">
          <div className="vw-progress-bar" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Stepper */}
        <nav className="vw-stepper" aria-label="Verification steps">
          <ol className="vw-steps">
            {WIZARD_STEPS.map((s, i) => {
              const done = i < idx
              const current = s.id === step
              return (
                <li
                  key={s.id}
                  className={`vw-step${done ? ' is-done' : ''}${current ? ' is-current' : ''}`}
                >
                  <button
                    type="button"
                    className="vw-step-btn"
                    onClick={() => {
                      if (done || current) goTo(s.id)
                    }}
                    disabled={!done && !current}
                    aria-current={current ? 'step' : undefined}
                    aria-label={`${s.label}${done ? ', completed' : current ? ', current' : ''}`}
                  >
                    <span className="vw-step-dot" aria-hidden="true">
                      {done ? '✓' : i + 1}
                    </span>
                    <span className="vw-step-label">{s.short}</span>
                  </button>
                </li>
              )
            })}
          </ol>
        </nav>

        {/* Body */}
        <div className="vw-body">
          {boot ? (
            <div className="vw-loading" role="status" aria-live="polite">
              <div className="vw-spinner" aria-hidden="true" />
              <p>Loading verification wizard…</p>
            </div>
          ) : (
            <>
              {error && (
                <div className="vw-alert" role="alert">
                  {error}
                </div>
              )}
              {!enabled && step !== 'status' && (
                <div className="vw-alert is-warn" role="status">
                  Verification is temporarily disabled by administrators.
                </div>
              )}

              {needsMoreInfo && step !== 'status' && (
                <div className="vw-alert is-action" role="status">
                  <strong>Your verification needs more information</strong>
                  <p style={{ margin: '6px 0 0' }}>
                    {request.additional_info_message || 'Please update the items below and resubmit.'}
                  </p>
                  {deadlineAt && deadlineStatus && (
                    <p style={{
                      margin: '4px 0 0',
                      fontSize: 12,
                      fontWeight: 700,
                      color: deadlineStatus.color,
                      padding: deadlineStatus.bg ? '4px 8px' : 0,
                      background: deadlineStatus.bg || 'transparent',
                      borderRadius: deadlineStatus.bg ? 6 : 0,
                      display: 'inline-block',
                    }}>
                      {deadlineStatus.status === 'expired' && '⚠ '}
                      {deadlineStatus.message}
                      {deadlineStatus.status === 'expired' && ' — your request may be auto-expired'}
                    </p>
                  )}
                  {request.reviewed_at && (
                    <p className="vw-fine" style={{ marginTop: 4, color: '#9a3412' }}>
                      Requested {new Date(request.reviewed_at || request.updated_at).toLocaleString()}
                    </p>
                  )}
                </div>
              )}

              {step === 'welcome' && (
                <section className="vw-panel" aria-labelledby="vw-welcome-h">
                  <h3 id="vw-welcome-h" className="vw-h">Welcome to SokoMw verification</h3>
                  {!enabled ? (
                    <div className="vw-alert is-warn" role="status">
                      Verification services are temporarily unavailable.
                    </div>
                  ) : (
                    <p className="vw-lead">
                      Get a verified badge so buyers trust you faster. Review fees, time, and documents before you begin.
                    </p>
                  )}
                  <ul className="vw-bullets">
                    <li>Verification fee: <strong>{feeLabel}</strong>
                      {selectedType ? ` (${selectedType.name})` : ''}
                    </li>
                    <li>Estimated review time: <strong>{reviewEstimate}</strong></li>
                    <li>Verification validity: <strong>{validityLabel}</strong></li>
                    <li>
                      Required documents:{' '}
                      <strong>
                        {requiredDocs.length
                          ? requiredDocs.map(docTypeLabel).join(', ')
                          : 'Set by your verification type'}
                      </strong>
                    </li>
                    <li>Payment does <strong>not</strong> instantly verify you — admin approval grants the badge</li>
                  </ul>

                  <div className="vw-checklist-card" aria-label="Profile readiness">
                    <h4 className="vw-checklist-title">Before you start — seller profile</h4>
                    <ul className="vw-check-list">
                      {(checklist.profileCheck?.items || []).map((item) => (
                        <li key={item.key} className={item.ok ? 'is-ok' : 'is-miss'}>
                          <span aria-hidden="true">{item.ok ? '✓' : '○'}</span>
                          {item.label}
                        </li>
                      ))}
                    </ul>
                    {!profileReady && (
                      <p className="vw-alert is-warn" style={{ marginBottom: 0 }}>
                        Complete your profile before requesting verification.
                        {' '}Add your full name, photo, phone, and city on your Profile page, then reopen this wizard.
                      </p>
                    )}
                    {profileReady && (
                      <p className="vw-fine" style={{ marginTop: 8, color: '#0a7a44' }}>
                        Profile ready — you can continue.
                      </p>
                    )}
                  </div>

                  {request && isTrackingStatus(request.status) && request.status !== VERIFICATION_STATUSES.DRAFT && (
                    <div className="vw-note" style={{ marginTop: 12 }}>
                      Current request status: <strong>{statusLabel(request.status)}</strong>
                    </div>
                  )}

                  <div className="vw-note" style={{ marginTop: 12 }}>
                    Your progress autosaves as a draft so you can leave and continue later.
                  </div>
                </section>
              )}

              {step === 'type' && (
                <section className="vw-panel" aria-labelledby="vw-type-h">
                  <h3 id="vw-type-h" className="vw-h">Choose verification type</h3>
                  <p className="vw-lead">Select the option that best matches how you sell on SokoMw.</p>
                  <div className="vw-type-grid" role="radiogroup" aria-label="Verification type">
                    {types.map((t) => {
                      const active = typeCode === t.code
                      const fee = formatFee(settings || undefined, t.default_fee_amount ?? feeAmount)
                      return (
                        <button
                          key={t.code}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className={`vw-type-card${active ? ' is-active' : ''}`}
                          onClick={() => setTypeCode(t.code)}
                        >
                          <span className="vw-type-radio" aria-hidden="true" />
                          <strong className="vw-type-name">{t.name}</strong>
                          <span className="vw-type-desc">{t.description}</span>
                          <em className="vw-type-fee">{fee}</em>
                          {Array.isArray(t.required_document_types) && t.required_document_types.length > 0 && (
                            <span className="vw-type-docs">
                              Docs: {t.required_document_types.map(docTypeLabel).join(', ')}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </section>
              )}

              {step === 'payment' && (
                <section className="vw-panel" aria-labelledby="vw-pay-h">
                  <h3 id="vw-pay-h" className="vw-h">Payment</h3>
                  <p className="vw-lead">
                    Pay <strong>{feeLabel}</strong> using a supported method. Gateway payments confirm automatically when the provider reports success;
                    mobile money / bank / card proofs are confirmed by an administrator.
                  </p>

                  {latestPayment?.payment_status === PAYMENT_STATUSES.CONFIRMED
                    || request?.status === VERIFICATION_STATUSES.UNDER_REVIEW
                    || request?.status === VERIFICATION_STATUSES.PAYMENT_CONFIRMED
                    || request?.status === VERIFICATION_STATUSES.APPROVED ? (
                    <div className="vw-success-box">
                      Payment {latestPayment ? paymentStatusLabel(latestPayment.payment_status) : 'recorded'}
                      {' · request: '}<strong>{statusLabel(request?.status)}</strong>
                      {latestPayment?.transaction_reference && (
                        <span className="vw-fine">Ref: {latestPayment.transaction_reference}</span>
                      )}
                      <button type="button" className="vw-linkish" onClick={() => setStep('status')}>
                        View status →
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="vw-pay-card">
                        <div className="vw-pay-row">
                          <span>Verification type</span>
                          <strong>{selectedType?.name || typeCode}</strong>
                        </div>
                        <div className="vw-pay-row">
                          <span>Amount due</span>
                          <strong className="vw-pay-amt">{feeLabel}</strong>
                        </div>
                        {latestPayment && (
                          <div className="vw-pay-row">
                            <span>Payment status</span>
                            <strong>{paymentStatusLabel(latestPayment.payment_status)}</strong>
                          </div>
                        )}
                      </div>

                      <fieldset className="vw-fieldset">
                        <legend>Payment method</legend>
                        <div className="vw-methods">
                          {activePayMethods.map((m) => {
                            const code = m.code || m
                            const name = m.name || docTypeLabel(code)
                            return (
                              <label key={code} className={`vw-method${paymentMethod === code ? ' is-on' : ''}`}>
                                <input
                                  type="radio"
                                  name="vw-pay-method"
                                  value={code}
                                  checked={paymentMethod === code}
                                  onChange={() => setPaymentMethod(code)}
                                />
                                <span>{name}</span>
                              </label>
                            )
                          })}
                        </div>
                        {selectedPayMethod?.instructions && (
                          <p className="vw-fine" style={{ marginTop: 10 }}>{selectedPayMethod.instructions}</p>
                        )}
                      </fieldset>

                      {isGatewayPay ? (
                        <p className="vw-fine">
                          You will be redirected to a secure checkout. After payment, your request moves to <strong>under review</strong> — not approved yet.
                        </p>
                      ) : (
                        <div className="vw-manual-pay">
                          <label className="vw-notes">
                            <span>Transaction / reference ID</span>
                            <input
                              type="text"
                              className="vw-input"
                              value={manualTxRef}
                              onChange={(e) => setManualTxRef(e.target.value)}
                              placeholder="e.g. MP2501… or bank ref"
                              autoComplete="off"
                            />
                          </label>
                          <div className="vw-upload-zone" style={{ marginTop: 12 }}>
                            <input
                              ref={receiptRef}
                              type="file"
                              accept="image/jpeg,image/png,image/webp,application/pdf"
                              className="vw-file"
                              onChange={handleReceiptUpload}
                              disabled={uploadBusy || !latestPayment?.id}
                              aria-label="Upload payment receipt"
                            />
                            <button
                              type="button"
                              className="vw-btn-secondary"
                              disabled={uploadBusy}
                              onClick={() => receiptRef.current?.click()}
                            >
                              {uploadBusy ? 'Uploading…' : 'Upload payment proof (required)'}
                            </button>
                            <p className="vw-fine">
                              Manual payments need: payment method, transaction reference, and receipt (JPEG/PNG/PDF).
                              Admin will confirm or reject — you can retry if rejected.
                            </p>
                            {latestPayment?.receipt_path && (
                              <p className="vw-fine" style={{ color: '#0a7a44', marginTop: 6 }}>
                                ✓ Proof attached — enter reference and submit
                              </p>
                            )}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}

              {step === 'documents' && (
                <section className="vw-panel" aria-labelledby="vw-docs-h">
                  <h3 id="vw-docs-h" className="vw-h">
                    {needsMoreInfo ? 'Update your documents' : 'Document upload'}
                  </h3>
                  <p className="vw-lead">
                    {needsMoreInfo
                      ? 'Upload missing files or replace unclear ones. Previous files are kept in history for review.'
                      : requireDocs
                        ? `Required for ${selectedType?.name || typeCode || 'your type'}. Upload clear photos or PDFs. Files are private to your account.`
                        : 'Documents are optional for now — you can still upload supporting files.'}
                  </p>

                  <ul className="vw-req-list" aria-label="Required documents">
                    {requiredDocs.map((t) => {
                      const has = !!docsByType[t]?.length
                      return (
                        <li key={t} className={has ? 'is-ok' : 'is-miss'}>
                          <span aria-hidden="true">{has ? '✓' : '○'}</span>
                          {docTypeLabel(t)}
                          {has ? ' · uploaded' : ' · required'}
                        </li>
                      )
                    })}
                  </ul>

                  {requireDocs && missingDocs.length > 0 && (
                    <div className="vw-alert is-warn" role="status">
                      <strong>Missing documents</strong>
                      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                        {missingDocs.map((t) => (
                          <li key={t}>{docTypeLabel(t)}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {rejectedDocs.length > 0 && (
                    <div className="vw-alert is-action" role="status">
                      <strong>Documents to replace</strong>
                      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                        {rejectedDocs.map((d) => (
                          <li key={d.id}>
                            {docTypeLabel(d.doc_type)} — {d.file_name || 'file'}
                            <button
                              type="button"
                              className="vw-linkish"
                              style={{ marginLeft: 8 }}
                              onClick={() => {
                                setReplaceDocId(d.id)
                                setSelectedDocType(d.doc_type)
                                fileRef.current?.click()
                              }}
                            >
                              Replace
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <label className="vw-notes" style={{ marginBottom: 12 }}>
                    <span>Document type for next upload</span>
                    <select
                      className="vw-input"
                      value={selectedDocType || missingDocs[0] || requiredDocs[0] || 'other'}
                      onChange={(e) => setSelectedDocType(e.target.value)}
                    >
                      {requiredDocs.map((t) => (
                        <option key={t} value={t}>
                          {docTypeLabel(t)}{docsByType[t]?.length ? ' (uploaded)' : ' (required)'}
                        </option>
                      ))}
                      <option value="other">Other</option>
                    </select>
                  </label>

                  <div className="vw-upload-zone">
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,application/pdf"
                      className="vw-file"
                      onChange={handleUpload}
                      disabled={uploadBusy || !user?.id}
                      aria-label="Upload verification document"
                    />
                    <button
                      type="button"
                      className="vw-btn-secondary"
                      disabled={uploadBusy}
                      onClick={() => fileRef.current?.click()}
                    >
                      {uploadBusy ? 'Uploading…' : 'Choose file'}
                    </button>
                    <p className="vw-fine">JPEG, PNG, WebP, or PDF · max 10 MB</p>
                  </div>

                  {activeDocs.length > 0 && (
                    <ul className="vw-doc-list" aria-label="Uploaded documents">
                      {activeDocs.map((d) => (
                        <li key={d.id} className="vw-doc-item">
                          <div>
                            <strong>{docTypeLabel(d.doc_type)}</strong>
                            <span>{d.file_name || d.storage_path}{d.status ? ` · ${statusLabel(d.status)}` : ''}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                            {needsMoreInfo && (
                              <button
                                type="button"
                                className="vw-btn-secondary"
                                style={{ padding: '6px 10px', fontSize: '0.72rem' }}
                                onClick={() => {
                                  setReplaceDocId(d.id)
                                  setSelectedDocType(d.doc_type)
                                  fileRef.current?.click()
                                }}
                                disabled={uploadBusy}
                              >
                                Replace
                              </button>
                            )}
                            <button
                              type="button"
                              className="vw-doc-remove"
                              onClick={() => handleRemoveDoc(d)}
                              disabled={uploadBusy}
                              aria-label={`Remove ${d.file_name || 'document'}`}
                            >
                              Remove
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                  {docs.some((d) => ['replaced', 'superseded'].includes(String(d.status || '').toLowerCase())) && (
                    <p className="vw-fine" style={{ marginTop: 10 }}>
                      Earlier versions are kept for admin audit and are not shown as active uploads.
                    </p>
                  )}
                </section>
              )}

              {step === 'review' && (
                <section className="vw-panel" aria-labelledby="vw-review-h">
                  <h3 id="vw-review-h" className="vw-h">Review your application</h3>
                  <p className="vw-lead">
                    Verification summary — fix anything incomplete before you submit. Payment alone never grants the verified badge.
                  </p>

                  <ul className="vw-summary-check" aria-label="Verification summary">
                    {checklist.sections.map((sec) => (
                      <li key={sec.id} className={sec.ok ? 'is-ok' : 'is-miss'}>
                        <div className="vw-summary-main">
                          <span className="vw-summary-mark" aria-hidden="true">{sec.ok ? '✓' : '!'}</span>
                          <div>
                            <strong>{sec.label}</strong>
                            <em>{sec.ok ? (sec.detail || 'Complete') : (sec.detail || 'Incomplete')}</em>
                            {!sec.ok && sec.missingList?.length > 0 && (
                              <span className="vw-fine" style={{ display: 'block', color: '#b45309' }}>
                                Required: {sec.missingList.join(', ')}
                              </span>
                            )}
                          </div>
                        </div>
                        {sec.editStep ? (
                          <button
                            type="button"
                            className="vw-linkish"
                            onClick={() => goTo(sec.editStep)}
                          >
                            Edit
                          </button>
                        ) : (
                          !sec.ok && sec.editHint && (
                            <span className="vw-fine">{sec.editHint}</span>
                          )
                        )}
                      </li>
                    ))}
                  </ul>

                  <dl className="vw-summary">
                    <div><dt>Type</dt><dd>{selectedType?.name || typeCode}</dd></div>
                    <div><dt>Fee</dt><dd>{feeLabel}</dd></div>
                    <div><dt>Payment method</dt><dd>{docTypeLabel(paymentMethod)}</dd></div>
                    <div>
                      <dt>Documents</dt>
                      <dd>
                        {docs.length} file{docs.length === 1 ? '' : 's'}
                        {missingDocs.length ? ` · missing ${missingDocs.length}` : ' · complete'}
                      </dd>
                    </div>
                    <div><dt>Request status</dt><dd>{statusLabel(request?.status || 'draft')}</dd></div>
                  </dl>

                  {checklist.blockers.length > 0 && (
                    <div className="vw-alert is-warn" role="status">
                      <strong>Before you can submit</strong>
                      <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                        {checklist.blockers.map((b) => (
                          <li key={b}>{b}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <label className="vw-check">
                    <input
                      type="checkbox"
                      checked={agreed}
                      onChange={(e) => setAgreed(e.target.checked)}
                    />
                    <span>I confirm the information and documents I provided are accurate and mine.</span>
                  </label>
                  <label className="vw-notes">
                    <span>Notes for reviewers (optional)</span>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Anything the review team should know…"
                      maxLength={500}
                    />
                  </label>
                </section>
              )}

              {step === 'submit' && (
                <section className="vw-panel" aria-labelledby="vw-submit-h">
                  <h3 id="vw-submit-h" className="vw-h">
                    {isResubmitFlow ? 'Resubmit verification' : 'Submit for review'}
                  </h3>
                  <p className="vw-lead">
                    {isResubmitFlow
                      ? 'You updated the requested information. Resubmit to send your application back for admin review.'
                      : 'Ready to send your application? After submit, our team reviews it — payment does not auto-verify you.'}
                  </p>
                  <div className="vw-submit-card">
                    <ul className="vw-check-list" style={{ marginBottom: 12 }}>
                      {checklist.sections.map((sec) => (
                        <li key={sec.id} className={sec.ok ? 'is-ok' : 'is-miss'}>
                          <span aria-hidden="true">{sec.ok ? '✓' : '○'}</span>
                          {sec.label}: {sec.detail}
                        </li>
                      ))}
                    </ul>
                    {checklist.ok ? (
                      <p>
                        {isResubmitFlow
                          ? <>All set. Resubmitting moves status to <strong>Under review</strong>.</>
                          : <>All required items are complete. Submitting will send your application for admin review.</>}
                      </p>
                    ) : (
                      <p className="vw-alert is-warn" style={{ margin: 0 }}>
                        {checklist.primaryMessage || 'Complete all checklist items before submitting.'}
                      </p>
                    )}
                  </div>
                </section>
              )}

              {step === 'status' && (
                <section className="vw-panel" aria-labelledby="vw-status-h">
                  <h3 id="vw-status-h" className="vw-h">Status tracking</h3>
                  {!request ? (
                    <p className="vw-lead">No verification request found yet.</p>
                  ) : (
                    <>
                      <div
                        className={`vw-status-hero is-${displayStatus || request.status}`}
                        style={needsMoreInfo ? { background: '#ffedd5', borderColor: '#fdba74' } : (
                          paymentConfirmed ? { background: '#eff6ff', borderColor: '#93c5fd' } : undefined
                        )}
                      >
                        <strong style={needsMoreInfo ? { color: '#c2410c' } : (
                          paymentConfirmed && !needsMoreInfo ? { color: '#1d4ed8' } : undefined
                        )}>
                          {needsMoreInfo
                            ? 'Additional information required'
                            : (statusMeta.label || statusLabel(displayStatus || request.status))}
                        </strong>
                        <span>
                          {needsMoreInfo
                            ? 'Your verification needs more information. Update the missing items and resubmit.'
                            : displayStatus === VERIFICATION_STATUSES.DRAFT
                              ? 'Your application is still a draft. Complete payment and documents, then submit.'
                              : displayStatus === VERIFICATION_STATUSES.APPROVED
                                ? 'Your profile badge is active. You do not need to submit again.'
                                : displayStatus === VERIFICATION_STATUSES.REJECTED
                                  ? (request.rejection_reason || 'Your request was not approved. You may start a new application later.')
                                  : displayStatus === VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED
                                    ? 'Your verification needs more information. Update the missing items and resubmit.'
                                    : paymentConfirmed
                                      || displayStatus === VERIFICATION_STATUSES.UNDER_REVIEW
                                      || displayStatus === VERIFICATION_STATUSES.PAYMENT_CONFIRMED
                                      || displayStatus === VERIFICATION_STATUSES.SUBMITTED
                                      || displayStatus === 'pending'
                                      ? `Payment confirmed. Your application is under review. Typical window: ~${reviewHours} hours.`
                                      : displayStatus === VERIFICATION_STATUSES.PAYMENT_PENDING
                                        ? (paymentCheck.awaiting
                                          ? 'Payment proof submitted — waiting for admin confirmation. You do not need to pay again.'
                                          : 'Payment is pending. Complete payment to continue.')
                                        : `Typical review window: ~${reviewHours} hours after payment.`}
                        </span>
                      </div>

                      {needsMoreInfo && (
                        <div className="vw-alert is-action" role="alert" style={{ marginTop: 4 }}>
                          <strong>Your verification needs more information</strong>
                          <p style={{ margin: '8px 0 0', fontSize: '0.88rem', lineHeight: 1.45 }}>
                            {request.additional_info_message
                              || request.admin_note
                              || 'Please upload clearer documents or complete the missing items.'}
                          </p>
                          {deadlineAt && deadlineStatus && (
                            <p style={{
                              margin: '6px 0 0',
                              fontSize: 12,
                              fontWeight: 700,
                              color: deadlineStatus.color,
                              padding: deadlineStatus.bg ? '6px 10px' : 0,
                              background: deadlineStatus.bg || 'transparent',
                              borderRadius: deadlineStatus.bg ? 8 : 0,
                              display: 'inline-block',
                            }}>
                              {deadlineStatus.status === 'expired' && '⚠ '}
                              {deadlineStatus.message}
                              {deadlineStatus.status === 'expired' && ' — submit quickly to avoid auto-expiry'}
                            </p>
                          )}
                          <p className="vw-fine" style={{ marginTop: 8, color: '#9a3412' }}>
                            Requested{' '}
                            {new Date(request.reviewed_at || request.updated_at || request.created_at).toLocaleString()}
                          </p>

                          {issues.length > 0 && (
                            <div style={{ marginTop: 12 }}>
                              <strong style={{ fontSize: 12 }}>
                                Items to fix ({openIssues.length} open)
                              </strong>
                              <ul style={{ listStyle: 'none', margin: '6px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                                {issues.map((issue) => (
                                  <li
                                    key={issue.id}
                                    style={{
                                      border: '1px solid #fdba74',
                                      borderRadius: 10,
                                      background: '#fff8f2',
                                      padding: '8px 10px',
                                    }}
                                  >
                                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                                      <strong style={{ fontSize: 13 }}>{issue.label || issue.category_code}</strong>
                                      <span style={issueChipStyle(issue.status)}>
                                        {issue.status === 'needs_recheck' ? 'Awaiting recheck' : issue.status}
                                      </span>
                                    </div>
                                    {issue.suggested_fix && (
                                      <p style={{ margin: '6px 0 0', fontSize: 12, color: '#7c3a07' }}>
                                        <em>What's wrong:</em> {issue.suggested_fix}
                                      </p>
                                    )}
                                    {issue.next_action && (
                                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#1f2937' }}>
                                        <em>What to do:</em> {issue.next_action}
                                      </p>
                                    )}
                                    {issue.note && (
                                      <p style={{ margin: '4px 0 0', fontSize: 12, color: '#6b7280' }}>
                                        Note: {issue.note}
                                      </p>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {(missingDocs.length > 0 || rejectedDocs.length > 0) && (
                            <div style={{ marginTop: 10 }}>
                              <strong style={{ fontSize: 12 }}>Missing / update items</strong>
                              <ul style={{ margin: '6px 0 0', paddingLeft: 18, fontSize: 13 }}>
                                {missingDocs.map((t) => (
                                  <li key={t}>{docTypeLabel(t)} (required)</li>
                                ))}
                                {rejectedDocs.map((d) => (
                                  <li key={d.id}>{docTypeLabel(d.doc_type)} — replace this file</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {paymentConfirmed && (
                            <p style={{ margin: '8px 0 0', fontSize: 13, color: '#1a7a4a', fontWeight: 700 }}>
                              ✓ Payment already confirmed — only documents/info still needed
                            </p>
                          )}
                          {!paymentConfirmed && !paymentSatisfied && (
                            <p style={{ margin: '8px 0 0', fontSize: 13 }}>Payment still needs to be completed or confirmed.</p>
                          )}
                          {!profileReady && (
                            <p style={{ margin: '8px 0 0', fontSize: 13 }}>Complete your seller profile (name, photo, phone, city).</p>
                          )}
                        </div>
                      )}

                      {(latestPayment || paymentConfirmed) && (
                        <p className="vw-fine">
                          Payment:{' '}
                          <strong style={{ color: paymentConfirmed ? '#1a7a4a' : undefined }}>
                            {paymentConfirmed
                              ? 'Confirmed'
                              : paymentStatusLabel(latestPayment?.payment_status || 'pending')}
                          </strong>
                          {(latestPayment?.transaction_reference || request.payment_ref)
                            ? ` · Ref ${latestPayment?.transaction_reference || request.payment_ref}`
                            : ''}
                        </p>
                      )}

                      <h4 className="vw-h" style={{ fontSize: '0.95rem', marginTop: 16 }}>Activity history</h4>
                      <ol className="vw-timeline" aria-label="Verification activity history">
                        {(timelineEvents.length > 0
                          ? timelineEvents.map((ev) => ({
                              k: ev.id,
                              label: formatSellerTimelineLabel(ev),
                              at: ev.created_at,
                              on: true,
                              note: ev.note,
                              actor: ev.actor_id === user?.id ? 'You' : (ev.actor_id ? 'Admin / system' : 'System'),
                            }))
                          : [
                              { k: 'created', label: 'Application created', at: request.created_at, on: true },
                              {
                                k: 'pay',
                                label: paymentConfirmed ? 'Payment confirmed' : 'Payment',
                                at: request.payment_confirmed_at || latestPayment?.confirmed_at || latestPayment?.payment_date,
                                on: paymentConfirmed || !!request.payment_confirmed_at || [
                                  VERIFICATION_STATUSES.UNDER_REVIEW,
                                  VERIFICATION_STATUSES.APPROVED,
                                  VERIFICATION_STATUSES.PAYMENT_CONFIRMED,
                                  VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED,
                                ].includes(request.status),
                              },
                              { k: 'sub', label: 'Submitted', at: request.submitted_at, on: !!request.submitted_at },
                              {
                                k: 'rev',
                                label: needsMoreInfo ? 'Additional information required' : 'Under review',
                                at: request.under_review_at || (needsMoreInfo ? request.reviewed_at : null),
                                on: needsMoreInfo || [
                                  VERIFICATION_STATUSES.UNDER_REVIEW,
                                  VERIFICATION_STATUSES.APPROVED,
                                  VERIFICATION_STATUSES.REJECTED,
                                  VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED,
                                ].includes(request.status) || (paymentConfirmed && request.status !== VERIFICATION_STATUSES.DRAFT),
                              },
                              { k: 'done', label: request.status === VERIFICATION_STATUSES.REJECTED ? 'Rejected' : 'Approved', at: request.reviewed_at, on: [VERIFICATION_STATUSES.APPROVED, VERIFICATION_STATUSES.REJECTED].includes(request.status) },
                            ]
                        ).map((ev) => (
                          <li key={ev.k} className={ev.on ? 'is-on' : ''}>
                            <span className="vw-tl-dot" aria-hidden="true" />
                            <div>
                              <strong>{ev.label}</strong>
                              <em>
                                {ev.at ? new Date(ev.at).toLocaleString() : '—'}
                                {ev.actor ? ` · ${ev.actor}` : ''}
                              </em>
                              {ev.note && ev.note !== 'created' && ev.note !== 'resubmitted' && (
                                <span className="vw-fine" style={{ display: 'block', marginTop: 2 }}>{ev.note}</span>
                              )}
                            </div>
                          </li>
                        ))}
                      </ol>
                      {request.payment_ref && (
                        <p className="vw-fine">Payment ref: <code>{request.payment_ref}</code></p>
                      )}
                    </>
                  )}
                </section>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        {!boot && (
          <footer className="vw-footer">
            <div className="vw-footer-left">
              {canGoBack && (
                <button type="button" className="vw-btn-ghost" onClick={prevStep} disabled={busy || uploadBusy}>
                  ← Back
                </button>
              )}
            </div>
            <div className="vw-footer-right">
              {step === 'welcome' && (
                <button
                  type="button"
                  className="vw-btn-primary"
                  onClick={nextStep}
                  disabled={!enabled || !profileReady}
                >
                  {profileReady ? 'Get started →' : 'Complete profile first'}
                </button>
              )}
              {step === 'type' && (
                <button type="button" className="vw-btn-primary" onClick={nextStep} disabled={!typeCode}>
                  Continue →
                </button>
              )}
              {step === 'payment' && !(
                latestPayment?.payment_status === PAYMENT_STATUSES.CONFIRMED
                || latestPayment?.payment_status === PAYMENT_STATUSES.AWAITING_CONFIRMATION
                || request?.status === VERIFICATION_STATUSES.UNDER_REVIEW
                || request?.status === VERIFICATION_STATUSES.PAYMENT_CONFIRMED
                || request?.status === VERIFICATION_STATUSES.APPROVED
                || paymentSatisfied
              ) && (
                <>
                  <button
                    type="button"
                    className="vw-btn-secondary"
                    onClick={() => {
                      setError('Payment is required before final submission. You can upload documents now and pay before submitting.')
                      nextStep()
                    }}
                    disabled={busy}
                  >
                    Upload docs first
                  </button>
                  <button type="button" className="vw-btn-primary" onClick={handlePay} disabled={busy || !enabled || !profileReady}>
                    {busy
                      ? (isGatewayPay ? 'Redirecting…' : 'Submitting…')
                      : (isGatewayPay ? `Pay ${feeLabel} →` : 'Submit payment proof')}
                  </button>
                </>
              )}
              {step === 'payment' && (
                latestPayment?.payment_status === PAYMENT_STATUSES.CONFIRMED
                || latestPayment?.payment_status === PAYMENT_STATUSES.AWAITING_CONFIRMATION
                || request?.status === VERIFICATION_STATUSES.UNDER_REVIEW
                || request?.status === VERIFICATION_STATUSES.PAYMENT_CONFIRMED
                || request?.status === VERIFICATION_STATUSES.APPROVED
                || paymentSatisfied
              ) && (
                <button type="button" className="vw-btn-primary" onClick={nextStep}>
                  Continue →
                </button>
              )}
              {step === 'documents' && (
                <button
                  type="button"
                  className="vw-btn-primary"
                  onClick={nextStep}
                  disabled={uploadBusy || (requireDocs && missingDocs.length > 0)}
                >
                  {requireDocs && missingDocs.length > 0
                    ? `Upload ${missingDocs.length} more…`
                    : 'Continue →'}
                </button>
              )}
              {step === 'review' && (
                <button
                  type="button"
                  className="vw-btn-primary"
                  onClick={nextStep}
                  disabled={!agreed || checklist.sections.some((s) => !s.ok)}
                >
                  Continue to submit →
                </button>
              )}
              {step === 'submit' && (
                <button
                  type="button"
                  className="vw-btn-primary"
                  onClick={handleSubmit}
                  disabled={busy || submitting || !checklist.ok}
                >
                  {busy || submitting
                    ? (isResubmitFlow ? 'Resubmitting…' : 'Submitting…')
                    : (isResubmitFlow ? 'Resubmit verification' : 'Submit verification')}
                </button>
              )}
              {step === 'status' && (
                <>
                  {(
                    needsMoreInfo
                    || [
                      VERIFICATION_STATUSES.DRAFT,
                      VERIFICATION_STATUSES.PAYMENT_PENDING,
                      VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED,
                    ].includes(request?.status)
                  ) && !(paymentConfirmed && !needsMoreInfo && request?.status === VERIFICATION_STATUSES.PAYMENT_PENDING && !request?.additional_info_message) && (
                    <button
                      type="button"
                      className="vw-btn-primary"
                      onClick={continueAdditionalInfo}
                    >
                      {needsMoreInfo ? 'Upload documents' : (paymentConfirmed ? 'Continue application' : 'Continue application')}
                    </button>
                  )}
                  {paymentConfirmed && !needsMoreInfo && (
                    <button
                      type="button"
                      className="vw-btn-primary"
                      onClick={() => setStep('documents')}
                    >
                      View / add documents
                    </button>
                  )}
                  <button
                    type="button"
                    className="vw-btn-secondary"
                    onClick={() => {
                      onSuccess?.()
                      onClose?.()
                    }}
                  >
                    Done
                  </button>
                </>
              )}
            </div>
          </footer>
        )}
      </div>
    </div>
  )
}

const vwCss = `
  .vw-overlay {
    position: fixed; inset: 0; z-index: 1200;
    background: rgba(15, 20, 16, 0.55);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    display: flex; align-items: center; justify-content: center;
    padding: 12px;
    animation: vw-fade 180ms ease both;
  }
  @keyframes vw-fade { from { opacity: 0 } to { opacity: 1 } }
  .vw-dialog {
    width: min(720px, 100%);
    max-height: min(920px, calc(100vh - 24px));
    background: #fff;
    border-radius: 22px;
    box-shadow: 0 24px 64px rgba(15, 20, 16, 0.22);
    display: flex; flex-direction: column;
    overflow: hidden;
    border: 1px solid rgba(15, 23, 42, 0.06);
    animation: vw-up 260ms cubic-bezier(.22,1,.36,1) both;
    font-family: 'DM Sans', system-ui, sans-serif;
    color: #0f1410;
  }
  @keyframes vw-up { from { opacity: 0; transform: translateY(12px) scale(.98) } to { opacity: 1; transform: none } }
  .vw-header {
    display: flex; align-items: center; justify-content: space-between;
    gap: 12px; padding: 16px 18px 12px;
  }
  .vw-brand { display: flex; align-items: center; gap: 12px; min-width: 0; }
  .vw-brand-mark {
    width: 42px; height: 42px; border-radius: 14px;
    display: grid; place-items: center;
    background: linear-gradient(135deg, #e8f5ee, #d1fae5);
    color: #0a7a44; font-weight: 900; font-size: 1.1rem;
    border: 1px solid rgba(15, 157, 88, 0.15);
    flex-shrink: 0;
  }
  .vw-title {
    margin: 0; font-family: 'Sora', system-ui, sans-serif;
    font-size: 1.05rem; font-weight: 800; letter-spacing: -0.02em;
  }
  .vw-sub { margin: 2px 0 0; font-size: 0.75rem; color: #637068; }
  .vw-header-right { display: flex; align-items: center; gap: 8px; }
  .vw-save-pill {
    font-size: 0.68rem; font-weight: 700; color: #0a7a44;
    background: #e8f5ee; border-radius: 999px; padding: 4px 10px;
  }
  .vw-close {
    width: 36px; height: 36px; border-radius: 50%; border: none;
    background: #f1f3f2; color: #637068; font-size: 1.25rem; cursor: pointer;
    display: grid; place-items: center;
  }
  .vw-close:hover { background: #e8ece9; color: #0f1410; }
  .vw-progress { height: 3px; background: #eef1ef; }
  .vw-progress-bar {
    height: 100%;
    background: linear-gradient(90deg, #0F9D58, #16a34a);
    transition: width 280ms ease;
  }
  .vw-stepper {
    padding: 12px 12px 4px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
  .vw-steps {
    list-style: none; margin: 0; padding: 0;
    display: flex; gap: 4px; min-width: max-content;
  }
  .vw-step-btn {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    border: none; background: transparent; cursor: pointer;
    padding: 6px 8px; min-width: 56px; color: #9aafa0;
  }
  .vw-step-btn:disabled { cursor: default; opacity: 0.55; }
  .vw-step-dot {
    width: 28px; height: 28px; border-radius: 50%;
    display: grid; place-items: center;
    font-size: 0.7rem; font-weight: 800;
    background: #f1f3f2; color: #637068;
    border: 1.5px solid transparent;
  }
  .vw-step.is-current .vw-step-dot {
    background: #0F9D58; color: #fff;
    box-shadow: 0 0 0 3px rgba(15, 157, 88, 0.18);
  }
  .vw-step.is-done .vw-step-dot {
    background: #e8f5ee; color: #0a7a44; border-color: rgba(15, 157, 88, 0.25);
  }
  .vw-step.is-current .vw-step-label { color: #0a7a44; font-weight: 800; }
  .vw-step-label { font-size: 0.62rem; font-weight: 700; letter-spacing: 0.02em; }
  .vw-body {
    flex: 1; overflow: auto; padding: 8px 18px 16px;
  }
  .vw-loading {
    display: flex; flex-direction: column; align-items: center; gap: 12px;
    padding: 48px 16px; color: #637068; font-size: 0.9rem;
  }
  .vw-spinner {
    width: 32px; height: 32px; border-radius: 50%;
    border: 3px solid #e8f5ee; border-top-color: #0F9D58;
    animation: vw-spin .8s linear infinite;
  }
  @keyframes vw-spin { to { transform: rotate(360deg) } }
  .vw-panel { animation: vw-up 220ms ease both; }
  .vw-h {
    margin: 0 0 8px; font-family: 'Sora', system-ui, sans-serif;
    font-size: 1.15rem; font-weight: 800; letter-spacing: -0.02em;
  }
  .vw-lead { margin: 0 0 16px; font-size: 0.9rem; color: #637068; line-height: 1.5; }
  .vw-bullets {
    margin: 0 0 16px; padding: 0 0 0 18px;
    font-size: 0.88rem; line-height: 1.65; color: #2d3a32;
  }
  .vw-note {
    background: #f0faf4; border: 1px solid rgba(15, 157, 88, 0.15);
    border-radius: 12px; padding: 12px 14px; font-size: 0.82rem; color: #0a7a44;
  }
  .vw-alert {
    background: #fef2f2; border: 1px solid #fecaca; color: #b91c1c;
    border-radius: 12px; padding: 10px 12px; font-size: 0.82rem; margin-bottom: 12px;
  }
  .vw-alert.is-warn {
    background: #fffbeb; border-color: #fde68a; color: #b45309;
  }
  .vw-alert.is-action {
    background: #ffedd5; border-color: #fdba74; color: #9a3412;
  }
  .vw-status-hero.is-additional_info_required {
    background: #ffedd5; border-color: #fdba74;
  }
  .vw-status-hero.is-additional_info_required strong { color: #c2410c; }
  .vw-status-hero.is-draft, .vw-status-hero.is-payment_pending {
    background: #fef3c7; border-color: #fde68a;
  }
  .vw-status-hero.is-rejected { background: #fef2f2; border-color: #fecaca; }
  .vw-status-hero.is-approved { background: #e8f5ee; border-color: rgba(15,157,88,.25); }
  .vw-type-grid {
    display: grid; gap: 10px;
    grid-template-columns: 1fr;
  }
  @media (min-width: 560px) {
    .vw-type-grid { grid-template-columns: 1fr 1fr; }
  }
  .vw-type-card {
    text-align: left; border: 1.5px solid rgba(15, 23, 42, 0.08);
    background: #fafbfa; border-radius: 16px; padding: 14px;
    cursor: pointer; display: flex; flex-direction: column; gap: 6px;
    font: inherit; color: inherit; transition: border-color .15s, box-shadow .15s, transform .12s;
  }
  .vw-type-card:hover { border-color: rgba(15, 157, 88, 0.3); transform: translateY(-1px); }
  .vw-type-card.is-active {
    border-color: #0F9D58; background: #f4fbf6;
    box-shadow: 0 0 0 3px rgba(15, 157, 88, 0.12);
  }
  .vw-type-radio {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2px solid #c5d0c9; margin-bottom: 2px;
  }
  .vw-type-card.is-active .vw-type-radio {
    border-color: #0F9D58; box-shadow: inset 0 0 0 4px #0F9D58;
  }
  .vw-type-name { font-size: 0.92rem; font-weight: 800; }
  .vw-type-desc { font-size: 0.78rem; color: #637068; line-height: 1.4; }
  .vw-type-fee { font-style: normal; font-weight: 800; color: #d4920a; font-size: 0.9rem; }
  .vw-type-docs { font-size: 0.7rem; color: #9aafa0; }
  .vw-pay-card {
    border-radius: 14px; border: 1px solid rgba(15, 23, 42, 0.08);
    background: #f7f9f8; padding: 12px 14px; margin-bottom: 14px;
  }
  .vw-pay-row {
    display: flex; justify-content: space-between; gap: 12px;
    padding: 8px 0; font-size: 0.88rem;
    border-bottom: 1px solid rgba(15, 23, 42, 0.05);
  }
  .vw-pay-row:last-child { border-bottom: none; }
  .vw-pay-amt { color: #0a7a44; font-size: 1.05rem; }
  .vw-fieldset { border: none; margin: 0 0 12px; padding: 0; }
  .vw-fieldset legend {
    font-size: 0.72rem; font-weight: 800; text-transform: uppercase;
    letter-spacing: .06em; color: #9aafa0; margin-bottom: 8px;
  }
  .vw-methods { display: flex; flex-wrap: wrap; gap: 8px; }
  .vw-method {
    display: inline-flex; align-items: center; gap: 8px;
    border: 1.5px solid rgba(15, 23, 42, 0.1); border-radius: 999px;
    padding: 8px 12px; font-size: 0.8rem; font-weight: 600; cursor: pointer;
    background: #fff;
  }
  .vw-method.is-on { border-color: #0F9D58; background: #e8f5ee; color: #0a7a44; }
  .vw-method input { accent-color: #0F9D58; }
  .vw-fine { font-size: 0.78rem; color: #9aafa0; line-height: 1.45; margin: 8px 0 0; }
  .vw-req-list {
    list-style: none; margin: 0 0 14px; padding: 0;
    display: flex; flex-direction: column; gap: 6px;
  }
  .vw-req-list li {
    display: flex; align-items: center; gap: 8px;
    font-size: 0.85rem; padding: 8px 10px; border-radius: 10px;
    background: #f7f9f8;
  }
  .vw-req-list li.is-ok { background: #e8f5ee; color: #0a7a44; font-weight: 600; }
  .vw-req-list li.is-miss { color: #637068; }
  .vw-upload-zone {
    border: 1.5px dashed rgba(15, 157, 88, 0.35);
    border-radius: 16px; padding: 18px; text-align: center;
    background: #f8fcf9; margin-bottom: 12px;
  }
  .vw-file { position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden; }
  .vw-doc-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
  .vw-doc-item {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 10px 12px; border-radius: 12px; background: #f7f9f8; border: 1px solid rgba(15,23,42,.06);
  }
  .vw-doc-item strong { display: block; font-size: 0.82rem; }
  .vw-doc-item span { font-size: 0.72rem; color: #9aafa0; word-break: break-all; }
  .vw-doc-remove {
    border: none; background: #fee2e2; color: #b91c1c;
    border-radius: 999px; padding: 6px 10px; font-size: 0.72rem; font-weight: 700; cursor: pointer;
  }
  .vw-summary {
    margin: 0 0 14px; display: grid; gap: 0;
    border: 1px solid rgba(15, 23, 42, 0.08); border-radius: 14px; overflow: hidden;
  }
  .vw-summary > div {
    display: grid; grid-template-columns: 120px 1fr; gap: 8px;
    padding: 10px 14px; font-size: 0.85rem;
    border-bottom: 1px solid rgba(15, 23, 42, 0.05);
  }
  .vw-summary > div:last-child { border-bottom: none; }
  .vw-summary dt { color: #9aafa0; font-weight: 600; margin: 0; }
  .vw-summary dd { margin: 0; font-weight: 700; }
  .vw-checklist-card {
    border: 1px solid rgba(15, 23, 42, 0.08); border-radius: 14px;
    padding: 12px 14px; background: #f7f9f8; margin: 0 0 4px;
  }
  .vw-checklist-title {
    margin: 0 0 8px; font-size: 0.78rem; font-weight: 800;
    text-transform: uppercase; letter-spacing: .04em; color: #637068;
  }
  .vw-check-list {
    list-style: none; margin: 0; padding: 0;
    display: flex; flex-direction: column; gap: 6px;
  }
  .vw-check-list li {
    display: flex; align-items: center; gap: 8px;
    font-size: 0.85rem; color: #637068;
  }
  .vw-check-list li.is-ok { color: #0a7a44; font-weight: 600; }
  .vw-check-list li.is-miss { color: #637068; }
  .vw-summary-check {
    list-style: none; margin: 0 0 14px; padding: 0;
    border: 1px solid rgba(15, 23, 42, 0.08); border-radius: 14px; overflow: hidden;
  }
  .vw-summary-check > li {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    padding: 12px 14px; border-bottom: 1px solid rgba(15, 23, 42, 0.05);
    background: #fafbfa;
  }
  .vw-summary-check > li:last-child { border-bottom: none; }
  .vw-summary-check > li.is-ok { background: #f4fbf6; }
  .vw-summary-check > li.is-miss { background: #fffbeb; }
  .vw-summary-main { display: flex; align-items: flex-start; gap: 10px; min-width: 0; }
  .vw-summary-mark {
    width: 22px; height: 22px; border-radius: 50%;
    display: grid; place-items: center; flex-shrink: 0;
    font-size: 0.72rem; font-weight: 900;
    background: #e8f5ee; color: #0a7a44;
  }
  .vw-summary-check > li.is-miss .vw-summary-mark {
    background: #fef3c7; color: #b45309;
  }
  .vw-summary-main strong { display: block; font-size: 0.86rem; }
  .vw-summary-main em {
    font-style: normal; font-size: 0.78rem; color: #637068;
  }
  .vw-notes select.vw-input {
    appearance: auto; background: #fff;
  }
  .vw-check {
    display: flex; gap: 10px; align-items: flex-start;
    font-size: 0.85rem; line-height: 1.4; margin-bottom: 12px; cursor: pointer;
  }
  .vw-check input { margin-top: 3px; accent-color: #0F9D58; }
  .vw-notes { display: flex; flex-direction: column; gap: 6px; font-size: 0.8rem; font-weight: 600; color: #637068; }
  .vw-notes textarea, .vw-input {
    border: 1.5px solid rgba(15, 23, 42, 0.1); border-radius: 12px;
    padding: 10px 12px; font: inherit; width: 100%; box-sizing: border-box;
  }
  .vw-notes textarea { resize: vertical; min-height: 72px; }
  .vw-notes textarea:focus, .vw-input:focus {
    outline: none; border-color: rgba(15, 157, 88, 0.45); box-shadow: 0 0 0 3px rgba(15,157,88,.12);
  }
  .vw-manual-pay { margin-top: 4px; }
  .vw-submit-card {
    background: #f0faf4; border-radius: 14px; padding: 16px;
    font-size: 0.9rem; line-height: 1.5; color: #2d3a32;
  }
  .vw-status-hero {
    border-radius: 16px; padding: 16px; margin-bottom: 16px;
    background: #f7f9f8; border: 1px solid rgba(15, 23, 42, 0.08);
    display: flex; flex-direction: column; gap: 6px;
  }
  .vw-status-hero strong { font-size: 1.1rem; font-family: 'Sora', system-ui, sans-serif; }
  .vw-status-hero span { font-size: 0.85rem; color: #637068; line-height: 1.45; }
  .vw-status-hero.is-approved { background: #e8f5ee; border-color: rgba(15,157,88,.25); }
  .vw-status-hero.is-approved strong { color: #0a7a44; }
  .vw-status-hero.is-rejected { background: #fef2f2; border-color: #fecaca; }
  .vw-status-hero.is-rejected strong { color: #b91c1c; }
  .vw-status-hero.is-under_review, .vw-status-hero.is-payment_confirmed, .vw-status-hero.is-submitted {
    background: #eff6ff; border-color: #bfdbfe;
  }
  .vw-timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0; }
  .vw-timeline li {
    display: flex; gap: 12px; padding: 10px 0; position: relative;
    opacity: 0.45;
  }
  .vw-timeline li.is-on { opacity: 1; }
  .vw-tl-dot {
    width: 12px; height: 12px; border-radius: 50%; margin-top: 4px;
    background: #d1d9d4; flex-shrink: 0;
  }
  .vw-timeline li.is-on .vw-tl-dot { background: #0F9D58; box-shadow: 0 0 0 3px rgba(15,157,88,.15); }
  .vw-timeline strong { display: block; font-size: 0.85rem; }
  .vw-timeline em { font-style: normal; font-size: 0.72rem; color: #9aafa0; }
  .vw-success-box {
    background: #e8f5ee; border-radius: 14px; padding: 14px;
    font-size: 0.88rem; color: #0a7a44; display: flex; flex-direction: column; gap: 8px;
  }
  .vw-linkish {
    border: none; background: none; color: #0a7a44; font-weight: 800;
    cursor: pointer; text-align: left; padding: 0; font-size: 0.85rem;
  }
  .vw-footer {
    display: flex; align-items: center; justify-content: space-between;
    gap: 10px; padding: 12px 16px 16px;
    border-top: 1px solid rgba(15, 23, 42, 0.06);
    background: #fbfcfb;
    flex-wrap: wrap;
  }
  .vw-footer-right { display: flex; gap: 8px; flex-wrap: wrap; margin-left: auto; }
  .vw-btn-primary, .vw-btn-secondary, .vw-btn-ghost {
    border-radius: 12px; padding: 11px 16px; font-size: 0.88rem; font-weight: 800;
    cursor: pointer; font-family: inherit; border: none;
    transition: transform .1s, box-shadow .15s, background .15s;
  }
  .vw-btn-primary {
    background: linear-gradient(135deg, #0F9D58, #0a7a44);
    color: #fff; box-shadow: 0 6px 16px rgba(15, 157, 88, 0.28);
  }
  .vw-btn-primary:hover:not(:disabled) { transform: translateY(-1px); }
  .vw-btn-primary:disabled { opacity: 0.55; cursor: not-allowed; box-shadow: none; }
  .vw-btn-secondary {
    background: #fff; color: #0a7a44;
    border: 1.5px solid rgba(15, 157, 88, 0.3);
  }
  .vw-btn-ghost {
    background: transparent; color: #637068;
  }
  .vw-btn-ghost:hover { color: #0f1410; background: #f1f3f2; }
  @media (max-width: 480px) {
    .vw-dialog { border-radius: 18px 18px 12px 12px; max-height: calc(100vh - 12px); }
    .vw-step-label { display: none; }
    .vw-step-btn { min-width: 40px; padding: 6px 4px; }
    .vw-summary > div { grid-template-columns: 1fr; gap: 2px; }
    .vw-footer { flex-direction: column-reverse; align-items: stretch; }
    .vw-footer-right, .vw-footer-left { width: 100%; }
    .vw-footer-right { margin-left: 0; }
    .vw-btn-primary, .vw-btn-secondary { flex: 1; }
  }
`
