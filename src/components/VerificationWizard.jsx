import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  WIZARD_STEPS,
  VERIFICATION_STATUSES,
  getVerificationSettings,
  getActiveVerificationTypes,
  getLatestVerificationRequest,
  getVerificationDocuments,
  ensureVerificationDraft,
  saveVerificationDraft,
  uploadVerificationDocument,
  deleteVerificationDocument,
  startVerificationPayment,
  submitVerificationApplication,
  initiatePaychanguCheckout,
  getVerificationPaymentMethods,
  getPaymentsForRequest,
  createVerificationPayment,
  submitPaymentProof,
  uploadPaymentReceipt,
  formatFee,
  statusLabel,
  paymentStatusLabel,
  docTypeLabel,
  isTrackingStatus,
  OPEN_VERIFICATION_STATUSES,
  PAYMENT_STATUSES,
} from '../lib/verification'

const STEP_IDS = WIZARD_STEPS.map((s) => s.id)

function stepIndex(id) {
  const i = STEP_IDS.indexOf(id)
  return i < 0 ? 0 : i
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

  const feeAmount = Number(
    selectedType?.default_fee_amount ?? settings?.fee_amount ?? 5000
  )
  const feeLabel = formatFee(settings || undefined, feeAmount)
  const reviewHours = settings?.review_period_hours ?? 24
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
  const latestPayment = payments[0] || null

  const requiredDocs = useMemo(() => {
    const fromType = selectedType?.required_document_types
    if (Array.isArray(fromType) && fromType.length) return fromType
    return (settings?.accepted_document_types || ['national_id', 'selfie']).slice(0, 3)
  }, [selectedType, settings])

  const docsByType = useMemo(() => {
    const map = {}
    docs.forEach((d) => {
      if (!map[d.doc_type]) map[d.doc_type] = []
      map[d.doc_type].push(d)
    })
    return map
  }, [docs])

  const missingDocs = useMemo(() => {
    if (!requireDocs) return []
    return requiredDocs.filter((t) => !(docsByType[t]?.length))
  }, [requireDocs, requiredDocs, docsByType])

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

  const refreshPayments = useCallback(async (requestId) => {
    if (!requestId) {
      setPayments([])
      return
    }
    const list = await getPaymentsForRequest(requestId)
    setPayments(list)
  }, [])

  // Bootstrap
  useEffect(() => {
    if (!user?.id) {
      setBoot(false)
      setError('You must be signed in to get verified.')
      return
    }
    let cancelled = false
    ;(async () => {
      setBoot(true)
      setError('')
      try {
        const [s, t, methods, latest] = await Promise.all([
          getVerificationSettings(),
          getActiveVerificationTypes(),
          getVerificationPaymentMethods(),
          getLatestVerificationRequest(user.id),
        ])
        if (cancelled) return
        setSettings(s)
        setTypes(t?.length ? t : [])
        setPayMethods(methods || [])
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
          await refreshPayments(latest.id)
          const resume = latest.meta?.wizard_step
          setStep(resume && STEP_IDS.includes(resume) && resume !== 'status' ? resume : 'welcome')
        } else if (latest && isTrackingStatus(latest.status)) {
          // Paid / submitted / in review / decided → status tracking
          setRequest(latest)
          setTypeCode(latest.meta?.type_code || defaultCode)
          setNotes(latest.notes || latest.meta?.notes || '')
          setPaymentMethod(latest.payment_method || latest.meta?.payment_method || defaultPay)
          await refreshDocs(latest.id, user.id)
          await refreshPayments(latest.id)
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
          setStep('welcome')
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Could not load verification wizard')
      } finally {
        if (!cancelled) setBoot(false)
      }
    })()
    return () => { cancelled = true }
  }, [user?.id, refreshDocs, refreshPayments])

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
    // Validate before leaving certain steps
    if (step === 'type' && !typeCode) {
      setError('Please choose a verification type.')
      return
    }
    if (step === 'documents' && requireDocs && missingDocs.length && ['review', 'submit'].includes(next)) {
      setError(`Upload required documents: ${missingDocs.map(docTypeLabel).join(', ')}`)
      return
    }
    if (step === 'review' && next === 'submit' && !agreed) {
      setError('Please confirm the accuracy of your information.')
      return
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
    if (!user?.id) return
    if (!enabled) {
      setError('Verification is currently disabled by administrators.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const req = await ensureDraftForPayment()
      const { tx_ref, checkout_url } = await initiatePaychanguCheckout({
        user,
        feeAmount,
        typeCode,
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

      // Phase 3 ledger row (gateway initiated)
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
      setError(e.message || 'Could not start payment')
      setBusy(false)
    }
  }

  /** Manual rails: Airtel / Mpamba / Bank / Card — admin confirms later */
  async function handleManualPaymentSubmit() {
    if (!user?.id) return
    if (!enabled) {
      setError('Verification is currently disabled by administrators.')
      return
    }
    const ref = manualTxRef.trim()
    if (ref.length < 3) {
      setError('Enter your transaction / reference ID (at least 3 characters).')
      return
    }
    setBusy(true)
    setError('')
    try {
      const req = await ensureDraftForPayment()
      await startVerificationPayment({
        paymentRef: ref,
        paymentMethod,
        typeCode,
        userId: user.id,
        feeAmount,
        currency: settings?.fee_currency || 'MWK',
        requestId: req.id,
      })

      let payment = await createVerificationPayment({
        requestId: req.id,
        paymentMethod,
        paymentAmount: feeAmount,
        currency: settings?.fee_currency || 'MWK',
        transactionReference: ref,
        gateway: 'manual',
        status: PAYMENT_STATUSES.AWAITING_CONFIRMATION,
      })

      // If create returned initiated, promote with proof
      if (payment?.id && payment.payment_status !== PAYMENT_STATUSES.AWAITING_CONFIRMATION) {
        payment = await submitPaymentProof({
          paymentId: payment.id,
          transactionReference: ref,
        })
      }

      await refreshPayments(req.id)
      const latest = await getLatestVerificationRequest(user.id)
      if (latest) setRequest(latest)
      setSaveFlash('Payment submitted — awaiting admin confirmation')
      setTimeout(() => setSaveFlash(''), 2500)
      setStep('status')
    } catch (e) {
      setError(e.message || 'Could not submit payment proof')
    } finally {
      setBusy(false)
    }
  }

  async function handleReceiptUpload(e) {
    const file = e.target.files?.[0]
    if (e.target) e.target.value = ''
    if (!file || !user?.id || !latestPayment?.id) {
      setError('Create a payment entry first (enter transaction ID and submit).')
      return
    }
    setUploadBusy(true)
    setError('')
    try {
      const { path, fileName } = await uploadPaymentReceipt({
        userId: user.id,
        paymentId: latestPayment.id,
        file,
      })
      const updated = await submitPaymentProof({
        paymentId: latestPayment.id,
        transactionReference: manualTxRef.trim() || latestPayment.transaction_reference || `RCPT-${Date.now()}`,
        receiptPath: path,
        receiptFileName: fileName,
      })
      setPayments((prev) => [updated, ...prev.filter((p) => p.id !== updated.id)])
      flashSaved()
    } catch (err) {
      setError(err.message || 'Receipt upload failed')
    } finally {
      setUploadBusy(false)
    }
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
      // Prefer first missing required type
      const docType = missingDocs[0] || requiredDocs[0] || 'other'
      await uploadVerificationDocument({
        userId: user.id,
        requestId: req.id,
        file,
        docType,
      })
      await refreshDocs(req.id, user.id)
      flashSaved()
    } catch (err) {
      setError(err.message || 'Upload failed — check verification-docs storage bucket')
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleRemoveDoc(doc) {
    setUploadBusy(true)
    setError('')
    try {
      await deleteVerificationDocument(doc)
      await refreshDocs(request?.id, user.id)
    } catch (e) {
      setError(e.message || 'Could not remove document')
    } finally {
      setUploadBusy(false)
    }
  }

  async function handleSubmit() {
    if (!request?.id) {
      setError('No verification draft found. Go back and try again.')
      return
    }
    if (requireDocs && missingDocs.length) {
      setError(`Missing documents: ${missingDocs.map(docTypeLabel).join(', ')}`)
      setStep('documents')
      return
    }
    if (!agreed) {
      setError('Please confirm your information is accurate.')
      return
    }

    setBusy(true)
    setError('')
    try {
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
      setStep('status')
      onSuccess?.()
    } catch (e) {
      setError(e.message || 'Submit failed')
    } finally {
      setBusy(false)
    }
  }

  const idx = stepIndex(step)
  const canGoBack = idx > 0 && step !== 'status'
  const tracking = request && isTrackingStatus(request.status) && step === 'status'

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

              {step === 'welcome' && (
                <section className="vw-panel" aria-labelledby="vw-welcome-h">
                  <h3 id="vw-welcome-h" className="vw-h">Welcome to SokoMw verification</h3>
                  <p className="vw-lead">
                    Get a verified badge so buyers trust you faster. This wizard walks you through type selection,
                    payment, documents, and tracking — it only takes a few minutes.
                  </p>
                  <ul className="vw-bullets">
                    <li>One-time fee · currently <strong>{feeLabel}</strong></li>
                    <li>Pay securely with mobile money (PayChangu)</li>
                    <li>Upload ID / documents for review</li>
                    <li>Team review usually within <strong>{reviewHours} hours</strong></li>
                    <li>Payment does <strong>not</strong> instantly verify you — admin approval grants the badge</li>
                  </ul>
                  <div className="vw-note">
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
                              onClick={() => {
                                if (!latestPayment?.id) {
                                  setError('Submit transaction ID first, then upload receipt.')
                                  return
                                }
                                receiptRef.current?.click()
                              }}
                            >
                              {uploadBusy ? 'Uploading…' : 'Upload receipt (optional)'}
                            </button>
                            <p className="vw-fine">
                              Submit your reference for admin confirmation. Receipt helps faster review.
                            </p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </section>
              )}

              {step === 'documents' && (
                <section className="vw-panel" aria-labelledby="vw-docs-h">
                  <h3 id="vw-docs-h" className="vw-h">Document upload</h3>
                  <p className="vw-lead">
                    {requireDocs
                      ? 'Upload clear photos or PDFs of the required documents. Files are private to your account.'
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
                    <p className="vw-fine">JPEG, PNG, WebP, or PDF · max 10 MB · next missing type is used</p>
                  </div>

                  {docs.length > 0 && (
                    <ul className="vw-doc-list" aria-label="Uploaded documents">
                      {docs.map((d) => (
                        <li key={d.id} className="vw-doc-item">
                          <div>
                            <strong>{docTypeLabel(d.doc_type)}</strong>
                            <span>{d.file_name || d.storage_path}</span>
                          </div>
                          <button
                            type="button"
                            className="vw-doc-remove"
                            onClick={() => handleRemoveDoc(d)}
                            disabled={uploadBusy}
                            aria-label={`Remove ${d.file_name || 'document'}`}
                          >
                            Remove
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </section>
              )}

              {step === 'review' && (
                <section className="vw-panel" aria-labelledby="vw-review-h">
                  <h3 id="vw-review-h" className="vw-h">Review your application</h3>
                  <p className="vw-lead">Confirm everything looks correct before submitting.</p>
                  <dl className="vw-summary">
                    <div><dt>Type</dt><dd>{selectedType?.name || typeCode}</dd></div>
                    <div><dt>Fee</dt><dd>{feeLabel}</dd></div>
                    <div><dt>Payment method</dt><dd>{docTypeLabel(paymentMethod)}</dd></div>
                    <div><dt>Documents</dt><dd>{docs.length} file{docs.length === 1 ? '' : 's'}{missingDocs.length ? ` · missing ${missingDocs.length}` : ' · complete'}</dd></div>
                    <div><dt>Request status</dt><dd>{statusLabel(request?.status || 'draft')}</dd></div>
                  </dl>
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
                  <h3 id="vw-submit-h" className="vw-h">Submit for review</h3>
                  <p className="vw-lead">
                    Ready to send your application? After submit, track progress on the next step.
                    If you still need to pay, use the Payment step first.
                  </p>
                  <div className="vw-submit-card">
                    <p>
                      Status will become <strong>Submitted</strong> or stay in payment/review pipeline if you already paid.
                    </p>
                    {requireDocs && missingDocs.length > 0 && (
                      <p className="vw-alert is-warn">
                        Missing: {missingDocs.map(docTypeLabel).join(', ')}
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
                      <div className={`vw-status-hero is-${request.status}`}>
                        <strong>{statusLabel(request.status)}</strong>
                        <span>
                          {request.status === VERIFICATION_STATUSES.APPROVED
                            ? 'Your profile badge is active.'
                            : request.status === VERIFICATION_STATUSES.REJECTED
                              ? (request.rejection_reason || 'Your request was not approved.')
                              : request.status === VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED
                                ? (request.additional_info_message || 'Please update documents and resubmit.')
                                : `Typical review window: ~${reviewHours} hours after payment.`}
                        </span>
                      </div>
                      <ol className="vw-timeline" aria-label="Verification timeline">
                        {[
                          { k: 'created', label: 'Draft created', at: request.created_at, on: true },
                          { k: 'pay', label: 'Payment', at: request.payment_confirmed_at, on: !!request.payment_confirmed_at || [VERIFICATION_STATUSES.UNDER_REVIEW, VERIFICATION_STATUSES.APPROVED, VERIFICATION_STATUSES.PAYMENT_CONFIRMED].includes(request.status) },
                          { k: 'sub', label: 'Submitted', at: request.submitted_at, on: !!request.submitted_at },
                          { k: 'rev', label: 'Under review', at: request.under_review_at, on: [VERIFICATION_STATUSES.UNDER_REVIEW, VERIFICATION_STATUSES.APPROVED, VERIFICATION_STATUSES.REJECTED, VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED].includes(request.status) },
                          { k: 'done', label: request.status === VERIFICATION_STATUSES.REJECTED ? 'Decision' : 'Approved', at: request.reviewed_at, on: [VERIFICATION_STATUSES.APPROVED, VERIFICATION_STATUSES.REJECTED].includes(request.status) },
                        ].map((ev) => (
                          <li key={ev.k} className={ev.on ? 'is-on' : ''}>
                            <span className="vw-tl-dot" aria-hidden="true" />
                            <div>
                              <strong>{ev.label}</strong>
                              <em>{ev.at ? new Date(ev.at).toLocaleString() : '—'}</em>
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
                <button type="button" className="vw-btn-primary" onClick={nextStep} disabled={!enabled}>
                  Get started →
                </button>
              )}
              {step === 'type' && (
                <button type="button" className="vw-btn-primary" onClick={nextStep} disabled={!typeCode}>
                  Continue →
                </button>
              )}
              {step === 'payment' && !(
                latestPayment?.payment_status === PAYMENT_STATUSES.CONFIRMED
                || request?.status === VERIFICATION_STATUSES.UNDER_REVIEW
                || request?.status === VERIFICATION_STATUSES.PAYMENT_CONFIRMED
                || request?.status === VERIFICATION_STATUSES.APPROVED
              ) && (
                <>
                  <button type="button" className="vw-btn-secondary" onClick={nextStep} disabled={busy}>
                    Skip for now
                  </button>
                  <button type="button" className="vw-btn-primary" onClick={handlePay} disabled={busy || !enabled}>
                    {busy
                      ? (isGatewayPay ? 'Redirecting…' : 'Submitting…')
                      : (isGatewayPay ? `Pay ${feeLabel} →` : 'Submit payment proof')}
                  </button>
                </>
              )}
              {step === 'payment' && (
                latestPayment?.payment_status === PAYMENT_STATUSES.CONFIRMED
                || request?.status === VERIFICATION_STATUSES.UNDER_REVIEW
                || request?.status === VERIFICATION_STATUSES.PAYMENT_CONFIRMED
                || request?.status === VERIFICATION_STATUSES.APPROVED
              ) && (
                <button type="button" className="vw-btn-primary" onClick={nextStep}>
                  Continue →
                </button>
              )}
              {step === 'documents' && (
                <button type="button" className="vw-btn-primary" onClick={nextStep} disabled={uploadBusy}>
                  Continue →
                </button>
              )}
              {step === 'review' && (
                <button type="button" className="vw-btn-primary" onClick={nextStep} disabled={!agreed}>
                  Continue to submit →
                </button>
              )}
              {step === 'submit' && (
                <button type="button" className="vw-btn-primary" onClick={handleSubmit} disabled={busy}>
                  {busy ? 'Submitting…' : 'Submit application'}
                </button>
              )}
              {step === 'status' && (
                <button
                  type="button"
                  className="vw-btn-primary"
                  onClick={() => {
                    onSuccess?.()
                    onClose?.()
                  }}
                >
                  Done
                </button>
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
