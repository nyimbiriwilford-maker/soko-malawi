import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getAdminVerificationDetail,
  getAdminApprovalReadiness,
  getVerificationSettings,
  adminApproveVerification,
  adminRejectVerification,
  adminRequestMoreInfo,
  adminConfirmPayment,
  adminRejectPayment,
  appendVerificationAdminNote,
  createVerificationDocSignedUrl,
  statusLabel,
  paymentStatusLabel,
  docTypeLabel,
  VERIFICATION_STATUSES,
  PAYMENT_STATUSES,
  friendlyVerificationError,
  getVerificationIssueCatalog,
  adminFlagIssues,
  getIssuesForRequest,
  adminResolveIssue,
  resolveOpenIssuesForRequest,
  adminExtendInfoDeadline,
  adminOverrideStatus,
  getVerificationAnomalies,
  stageOfStatus,
  ADMIN_OVERRIDE_TARGETS,
  adminAutoExpireOverdueRequests,
} from '../lib/verification'

/**
 * Full-screen-friendly slide-over for one verification request.
 * Used inside existing Admin → Verifications tab (not a new dashboard).
 */
export default function AdminVerificationDetail({
  requestId,
  onClose,
  onUpdated,
  adminName = '',
  adminId = null,
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [detail, setDetail] = useState(null)
  const [settings, setSettings] = useState(null)
  const [busy, setBusy] = useState(null) // action key
  const [actionMsg, setActionMsg] = useState('')
  const [rejectReason, setRejectReason] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [approveNote, setApproveNote] = useState('')
  const [internalNote, setInternalNote] = useState('')
  const [preview, setPreview] = useState(null) // { url, name, mime, kind }
  const [payNote, setPayNote] = useState('')

  // Structured issues
  const [issues, setIssues] = useState([])
  const [issueCatalog, setIssueCatalog] = useState([])
  const [flagSelected, setFlagSelected] = useState([]) // catalog codes
  const [flagFixes, setFlagFixes] = useState({}) // code -> edited suggested_fix
  const [flagMessage, setFlagMessage] = useState('')

  // Override modal
  const [showOverride, setShowOverride] = useState(false)
  const [overrideTarget, setOverrideTarget] = useState('')
  const [overrideJust, setOverrideJust] = useState('')

  // Inline confirm rows (replace window.confirm / window.prompt)
  const [confirmApprove, setConfirmApprove] = useState(false)
  const [confirmReject, setConfirmReject] = useState(false)
  const [confirmPayReject, setConfirmPayReject] = useState(null) // payment id
  const [payRejectNote, setPayRejectNote] = useState('')

  const [openAnomalies, setOpenAnomalies] = useState(0)

  const load = useCallback(async (signal = { cancelled: false }) => {
    if (!requestId) return
    // Defer state updates so callers (effects) stay lint-clean
    await Promise.resolve()
    if (!signal.cancelled) setLoading(true)
    try {
      const [d, s, iss, anom] = await Promise.all([
        getAdminVerificationDetail(requestId),
        getVerificationSettings().catch(() => null),
        getIssuesForRequest(requestId).catch(() => []),
        getVerificationAnomalies({ status: 'open', limit: 50, requestId }).catch(() => []),
      ])
      if (signal.cancelled) return
      setDetail(d)
      setSettings(s)
      setIssues(Array.isArray(iss) ? iss : [])
      setOpenAnomalies(Array.isArray(anom) ? anom.length : 0)
      setRejectReason(d.request?.rejection_reason || '')
      setInfoMessage(d.request?.additional_info_message || '')
      setError('')
    } catch (e) {
      if (signal.cancelled) return
      setError(friendlyVerificationError(e) || 'Could not load verification detail')
      setDetail(null)
    } finally {
      if (!signal.cancelled) setLoading(false)
    }
  }, [requestId])

  useEffect(() => {
    const signal = { cancelled: false }
    // Standard async fetch-on-mount; state updates happen after await.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load detail when requestId changes
    void load(signal)
    return () => { signal.cancelled = true }
  }, [load])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) {
        if (preview) setPreview(null)
        else onClose?.()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, preview, onClose])

  const readiness = useMemo(() => {
    if (!detail) return null
    return getAdminApprovalReadiness({
      request: detail.request,
      payments: detail.payments,
      docs: detail.docs,
      verificationType: detail.verificationType,
      settings,
    })
  }, [detail, settings])

  const internalNotes = useMemo(() => {
    const list = detail?.request?.meta?.internal_notes
    return Array.isArray(list) ? [...list].reverse() : []
  }, [detail?.request?.meta?.internal_notes])

  const typeLabel = detail?.verificationType?.name
    || docTypeLabel(detail?.typeCode || 'seller')

  async function refreshAndNotify() {
    await load()
    onUpdated?.()
  }

  async function run(key, fn) {
    setBusy(key)
    setActionMsg('')
    try {
      await fn()
      await refreshAndNotify()
    } catch (e) {
      setActionMsg(friendlyVerificationError(e) || e.message || 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  function handleApprove() {
    if (!detail) return
    const isConfirming = readiness && !readiness.ok
    if (!confirmApprove) {
      setConfirmApprove(true)
      return
    }
    setConfirmApprove(false)
    return run('approve', () => adminApproveVerification(detail.request.id, approveNote || null, {
      force: isConfirming,
      readiness,
    }))
  }

  function handleReject() {
    if (!detail) return
    const reason = rejectReason.trim()
    if (!reason) {
      setActionMsg('Rejection reason is required.')
      return
    }
    if (!confirmReject) {
      setConfirmReject(true)
      return
    }
    setConfirmReject(false)
    return run('reject', () => adminRejectVerification(detail.request.id, reason))
  }

  function handleNeedInfo() {
    if (!detail) return
    const msg = infoMessage.trim()
    if (!msg && !flagSelected.length) {
      setActionMsg('Please describe what additional information is needed.')
      return
    }
    return run('info', async () => {
      await adminRequestMoreInfo(detail.request.id, msg || 'Please provide the requested items.')
      setActionMsg('Seller notified — additional information requested.')
    })
  }

  function handleConfirmPay(payment) {
    if (!payment?.id) return
    return run(`pay-ok-${payment.id}`, async () => {
      await adminConfirmPayment(payment.id, payNote || null, true)
      setActionMsg('Payment confirmed.')
    })
  }

  function handleRejectPay(payment) {
    if (!payment?.id) return
    if (confirmPayReject !== payment.id) {
      setConfirmPayReject(payment.id)
      setPayRejectNote(payNote)
      return
    }
    const note = (payRejectNote || payNote || '').trim()
    if (!note) {
      setActionMsg('A reason is required to reject payment.')
      return
    }
    setConfirmPayReject(null)
    return run(`pay-no-${payment.id}`, async () => {
      await adminRejectPayment(payment.id, note)
      setActionMsg('Payment rejected.')
    })
  }

  // ── Structured issues ──────────────────────────────────────
  useEffect(() => {
    if (!detail) return
    let cancelled = false
    void getVerificationIssueCatalog({ activeOnly: true })
      .then((list) => { if (!cancelled) setIssueCatalog(list) })
      .catch(() => { if (!cancelled) setIssueCatalog([]) })
    return () => { cancelled = true }
  }, [detail?.request?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  function toggleFlagCode(code) {
    setFlagSelected((sel) => (sel.includes(code) ? sel.filter((c) => c !== code) : [...sel, code]))
  }

  function handleFlagIssues() {
    if (!detail) return
    const items = flagSelected.map((code) => {
      const cat = issueCatalog.find((c) => c.code === code)
      return {
        category_code: code,
        suggested_fix: (flagFixes[code] ?? '').trim() || cat?.default_suggested_fix || null,
        next_action: cat?.default_next_action || null,
      }
    })
    return run('flag-issues', async () => {
      const n = await adminFlagIssues(
        detail.request.id,
        items,
        flagMessage.trim() || null
      )
      setFlagSelected([])
      setFlagFixes({})
      setFlagMessage('')
      setActionMsg(`Flagged ${n} issue${n === 1 ? '' : 's'} — seller notified.`)
    })
  }

  function handleResolveIssue(issue, status) {
    if (!issue?.id) return
    return run(`issue-${issue.id}`, async () => {
      await adminResolveIssue(issue.id, status)
      setActionMsg(`Issue ${status === 'waived' ? 'waived' : 'resolved'}.`)
    })
  }

  function handleExtendDeadline() {
    if (!detail) return
    return run('extend-deadline', async () => {
      await adminExtendInfoDeadline(detail.request.id, 3)
      setActionMsg('Deadline extended by +3 days.')
    })
  }

  function handleWaiveAllIssues() {
    if (!detail) return
    return run('waive-all', async () => {
      const n = await resolveOpenIssuesForRequest(detail.request.id, 'waived')
      setActionMsg(`Waived ${n} open issue${n === 1 ? '' : 's'}.`)
    })
  }

  function handleAutoExpireThis() {
    if (!detail) return
    return run('auto-expire', async () => {
      const result = await adminAutoExpireOverdueRequests()
      if (result.requestIds.includes(detail.request.id)) {
        setActionMsg('This request has been expired due to missed deadline.')
      } else {
        setActionMsg(`Expired ${result.count} overdue request${result.count === 1 ? '' : 's'} (this one may not have qualified).`)
      }
    })
  }

  // ── Override ───────────────────────────────────────────────
  function handleOverride() {
    if (!detail) return
    if (!overrideTarget) {
      setActionMsg('Pick a target status.')
      return
    }
    const just = overrideJust.trim()
    if (!just) {
      setActionMsg('A justification is required to override status.')
      return
    }
    return run('override', async () => {
      await adminOverrideStatus(detail.request.id, overrideTarget, just)
      setShowOverride(false)
      setOverrideTarget('')
      setOverrideJust('')
      setActionMsg(`Status overridden to ${statusLabel(overrideTarget)}.`)
    })
  }

  function handleSaveNote() {
    if (!detail) return
    const text = internalNote.trim()
    if (!text) {
      setActionMsg('Write a note before saving.')
      return
    }
    return run('note', async () => {
      await appendVerificationAdminNote(detail.request.id, text, {
        adminId,
        adminName,
      })
      setInternalNote('')
      setActionMsg('Internal note saved.')
    })
  }

  async function openDoc(doc) {
    let url = doc.signedUrl
    if (!url && doc.storage_path) {
      try {
        url = await createVerificationDocSignedUrl(doc.storage_path)
      } catch {
        setActionMsg('Could not open document (signed URL failed).')
        return
      }
    }
    if (!url) {
      setActionMsg('Document file is not available.')
      return
    }
    setPreview({
      url,
      name: doc.file_name || doc.storage_path || 'Document',
      mime: doc.mime_type || '',
      kind: 'document',
    })
  }

  async function openReceipt(pay) {
    let url = pay.receiptUrl
    if (!url && pay.receipt_path) {
      try {
        url = await createVerificationDocSignedUrl(pay.receipt_path)
      } catch {
        setActionMsg('Could not open receipt.')
        return
      }
    }
    if (!url) {
      setActionMsg('No receipt on file.')
      return
    }
    setPreview({
      url,
      name: pay.receipt_file_name || 'Payment receipt',
      mime: '',
      kind: 'receipt',
    })
  }

  function downloadUrl(url, name) {
    if (!url) return
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    a.download = name || 'download'
    a.click()
  }

  const req = detail?.request
  const profile = detail?.profile
  const isFinal = req && [VERIFICATION_STATUSES.APPROVED, VERIFICATION_STATUSES.REJECTED].includes(req.status)

  return (
    <div style={styles.overlay} role="presentation" onClick={(e) => {
      if (e.target === e.currentTarget && !busy) onClose?.()
    }}>
      <aside
        style={styles.drawer}
        role="dialog"
        aria-modal="true"
        aria-labelledby="avd-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header style={styles.header}>
          <div style={{ minWidth: 0 }}>
            <div style={styles.kicker}>Verification review</div>
            <h2 id="avd-title" style={styles.title}>
              {profile?.full_name || 'Seller'} · {typeLabel}
            </h2>
            {req && (
              <div style={styles.sub}>
                Status: <strong>{statusLabel(req.status)}</strong>
                {' · '}
                Updated {fmtDate(req.updated_at || req.created_at)}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              type="button"
              style={styles.ghostBtn}
              onClick={() => { void load() }}
              disabled={!!busy || loading}
            >
              Refresh
            </button>
            <button type="button" style={styles.closeBtn} onClick={() => onClose?.()} aria-label="Close">
              ×
            </button>
          </div>
        </header>

        <div style={styles.body}>
          {loading && (
            <div style={styles.center}>
              <div style={styles.spinner} />
              <p style={{ color: '#6b7280', fontSize: 13 }}>Loading request…</p>
            </div>
          )}

          {!loading && error && (
            <div style={styles.alert}>{error}</div>
          )}

          {!loading && detail && (
            <>
              {actionMsg && (
                <div style={{
                  ...styles.alert,
                  background: actionMsg.toLowerCase().includes('saved') || actionMsg.toLowerCase().includes('confirm')
                    ? '#e6f4ec' : '#fff7ed',
                  borderColor: actionMsg.toLowerCase().includes('saved') || actionMsg.toLowerCase().includes('confirm')
                    ? '#bbf7d0' : '#fed7aa',
                  color: actionMsg.toLowerCase().includes('saved') || actionMsg.toLowerCase().includes('confirm')
                    ? '#1a7a4a' : '#9a3412',
                }}>
                  {actionMsg}
                </div>
              )}

              {openAnomalies > 0 && (
                <a
                  href="/admin?tab=Anomalies"
                  style={{
                    display: 'block',
                    background: '#fff7ed',
                    border: '1px solid #fed7aa',
                    color: '#9a3412',
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  ⚠ {openAnomalies} open anomaly{openAnomalies === 1 ? '' : 'ies'} linked to this request — open the Anomalies tab
                </a>
              )}

              {/* USER — compact; full field list expands on demand */}
              <section style={styles.card}>
                <h3 style={styles.sectionTitle}>User information</h3>
                <div style={styles.userRow}>
                  <div style={styles.avatar}>
                    {profile?.avatar_url
                      ? <img src={profile.avatar_url} alt="" style={styles.avatarImg} />
                      : (profile?.full_name || '?')[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.name}>
                      {profile?.full_name || profile?.shop_name || 'Unknown seller'}
                    </div>
                    <div style={styles.metaLine}>
                      {[
                        profile?.city,
                        profile?.phone || profile?.auth_phone,
                        profile?.listing_count != null ? `${profile.listing_count} listings` : null,
                        Array.isArray(profile?.shops) && profile.shops.length
                          ? `${profile.shops.length} shop${profile.shops.length === 1 ? '' : 's'}`
                          : null,
                      ].filter(Boolean).join(' · ') || 'Seller profile'}
                    </div>
                    {profile?.is_verified && (
                      <div style={{ ...styles.metaLine, color: '#1a7a4a', fontWeight: 700 }}>
                        ✓ Verified badge active
                      </div>
                    )}
                    {profile?._missing && (
                      <div style={{ ...styles.metaLine, color: '#b45309' }}>
                        Profile row not found for this seller id.
                      </div>
                    )}
                  </div>
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {(profile?.id || req?.seller_id) && (
                    <a
                      href={`/profile/${profile?.id || req.seller_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.linkBtn}
                    >
                      Open profile ↗
                    </a>
                  )}
                  {(profile?.shops || []).filter((s) => shopHref(s)).map((s) => (
                    <a
                      key={`btn-${s.id || s.slug}`}
                      href={shopHref(s)}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={styles.linkBtn}
                    >
                      Open {s.name || 'shop'} ↗
                    </a>
                  ))}
                </div>

                <details style={{ marginTop: 12 }}>
                  <summary style={{
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 800,
                    color: '#1a7a4a',
                    listStyle: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 0',
                    userSelect: 'none',
                  }}>
                    <span aria-hidden="true">▸</span>
                    Show full user details
                  </summary>

                  <div style={{ ...styles.kvList, marginTop: 4 }}>
                    <InfoRow label="Full name" value={profile?.full_name || '—'} />
                    <InfoRow label="User ID" value={
                      <code style={{ fontSize: 11, wordBreak: 'break-all' }}>
                        {profile?.id || req?.seller_id || '—'}
                      </code>
                    } />
                    <InfoRow
                      label="Phone"
                      value={profile?.phone || profile?.auth_phone || profile?.whatsapp || 'Not on profile'}
                    />
                    {(profile?.whatsapp && profile.whatsapp !== profile.phone) && (
                      <InfoRow label="WhatsApp" value={profile.whatsapp} />
                    )}
                    <InfoRow
                      label="Email"
                      value={profile?.email || profile?.auth_email || 'Not on profile / auth'}
                    />
                    {profile?.auth_email && profile.email && profile.auth_email !== profile.email && (
                      <InfoRow label="Auth email" value={profile.auth_email} />
                    )}
                    <InfoRow label="City" value={profile?.city || '—'} />
                    <InfoRow
                      label="Location"
                      value={profile?.location || profile?.address || '—'}
                    />
                    {profile?.address && profile?.location && profile.address !== profile.location && (
                      <InfoRow label="Address" value={profile.address} />
                    )}
                    <InfoRow label="Role" value={profile?.role || 'user'} />
                    <InfoRow
                      label="Profile verification"
                      value={
                        profile?.is_verified
                          ? `Verified badge ON${profile.verification_status ? ` · ${statusLabel(profile.verification_status)}` : ''}`
                          : (req?.status === VERIFICATION_STATUSES.APPROVED
                            ? 'Badge not synced (request is Approved — use Manage verified sellers → sync if needed)'
                            : (profile?.verification_status
                              ? statusLabel(profile.verification_status)
                              : 'Not verified'))
                      }
                    />
                    <InfoRow label="This request" value={statusLabel(req?.status)} />
                    {profile?.verified_at && (
                      <InfoRow label="Verified at" value={fmtDate(profile.verified_at)} />
                    )}
                    {profile?.rejection_reason && (
                      <InfoRow label="Profile reject note" value={profile.rejection_reason} />
                    )}
                    <InfoRow
                      label="Joined"
                      value={fmtDate(profile?.created_at || profile?.auth_created_at)}
                    />
                    {profile?.auth_created_at && profile?.created_at
                      && profile.auth_created_at !== profile.created_at && (
                      <InfoRow label="Auth account created" value={fmtDate(profile.auth_created_at)} />
                    )}
                    {profile?.updated_at && (
                      <InfoRow label="Profile updated" value={fmtDate(profile.updated_at)} />
                    )}
                    <InfoRow
                      label="Last seen"
                      value={fmtDate(profile?.last_seen || profile?.last_sign_in_at)}
                    />
                    {profile?.last_sign_in_at && (
                      <InfoRow label="Last sign-in" value={fmtDate(profile.last_sign_in_at)} />
                    )}
                    {profile?.email_confirmed_at && (
                      <InfoRow label="Email confirmed" value={fmtDate(profile.email_confirmed_at)} />
                    )}
                    {profile?.phone_confirmed_at && (
                      <InfoRow label="Phone confirmed" value={fmtDate(profile.phone_confirmed_at)} />
                    )}
                    {profile?.bio && (
                      <InfoRow label="Bio" value={profile.bio} />
                    )}
                    {profile?.shop_name && (
                      <InfoRow label="Shop name (profile)" value={profile.shop_name} />
                    )}
                    {profile?.listing_count != null && (
                      <InfoRow label="Listings" value={String(profile.listing_count)} />
                    )}
                    <InfoRow label="Request seller_id" value={
                      <code style={{ fontSize: 11, wordBreak: 'break-all' }}>{req?.seller_id || '—'}</code>
                    } />
                  </div>

                  {/* Shops — openable by admin (inside expand) */}
                  {Array.isArray(profile?.shops) && profile.shops.length > 0 && (
                    <div style={{ marginTop: 14 }}>
                      <div style={{
                        fontSize: 11, fontWeight: 800, color: '#9ca3af',
                        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8,
                      }}>
                        Shops ({profile.shops.length})
                      </div>
                      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {profile.shops.map((s) => {
                          const href = shopHref(s)
                          return (
                            <li
                              key={s.id || s.slug || s.name}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '10px 12px',
                                borderRadius: 12,
                                border: '1px solid #e8f0ec',
                                background: '#f9fbfa',
                              }}
                            >
                              <div style={{
                                width: 36, height: 36, borderRadius: 10, overflow: 'hidden',
                                background: '#e8f0ec', flexShrink: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 800, color: '#1a7a4a', fontSize: 13,
                              }}>
                                {s.logo_url
                                  ? <img src={s.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : (s.name || 'S')[0].toUpperCase()}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 800, color: '#0f1410' }}>
                                  {s.name || s.slug || 'Shop'}
                                  {s.is_verified ? (
                                    <span style={{ marginLeft: 6, fontSize: 10, color: '#1a7a4a' }}>✓ verified</span>
                                  ) : null}
                                </div>
                                <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                                  {[s.city, s.phone, s.slug ? `/${s.slug}` : null].filter(Boolean).join(' · ') || '—'}
                                </div>
                              </div>
                              {href ? (
                                <a
                                  href={href}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ ...styles.linkBtn, flexShrink: 0 }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  Open shop ↗
                                </a>
                              ) : (
                                <span style={{ fontSize: 11, color: '#9ca3af' }}>No slug</span>
                              )}
                            </li>
                          )
                        })}
                      </ul>
                    </div>
                  )}

                  {profile?.extra_fields && Object.keys(profile.extra_fields).length > 0 && (
                    <details style={{ marginTop: 12 }}>
                      <summary style={{
                        cursor: 'pointer', fontSize: 12, fontWeight: 800, color: '#1a7a4a',
                      }}>
                        All profile / auth fields ({Object.keys(profile.extra_fields).length})
                      </summary>
                      <div style={{ ...styles.kvList, marginTop: 8 }}>
                        {Object.entries(profile.extra_fields)
                          .sort(([a], [b]) => a.localeCompare(b))
                          .map(([k, v]) => (
                            <InfoRow
                              key={k}
                              label={k}
                              value={
                                typeof v === 'boolean'
                                  ? (v ? 'Yes' : 'No')
                                  : (String(k).includes('_at') || String(k).includes('date')
                                    ? fmtDate(v)
                                    : String(v))
                              }
                            />
                          ))}
                      </div>
                    </details>
                  )}

                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
                    {profile?.phone && (
                      <a href={`tel:${profile.phone}`} style={styles.linkBtn}>
                        Call {profile.phone}
                      </a>
                    )}
                    {profile?.email && (
                      <a href={`mailto:${profile.email}`} style={styles.linkBtn}>
                        Email seller
                      </a>
                    )}
                    {profile?.whatsapp && (
                      <a
                        href={`https://wa.me/${String(profile.whatsapp).replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.linkBtn}
                      >
                        WhatsApp
                      </a>
                    )}
                  </div>
                </details>
              </section>

              {/* VERIFICATION INFO */}
              <section style={styles.card}>
                <h3 style={styles.sectionTitle}>Verification information</h3>
                <div style={styles.kvList}>
                  <InfoRow label="Type" value={typeLabel} />
                  <InfoRow label="Request date" value={fmtDate(req.submitted_at || req.created_at)} />
                  <InfoRow label="Current status" value={<StatusPill status={req.status} />} />
                  <InfoRow label="Last updated" value={fmtDate(req.updated_at)} />
                  <InfoRow label="Fee" value={`MK ${Number(req.amount_due || req.amount_paid || 0).toLocaleString()}`} />
                  {req.notes && <InfoRow label="Seller notes" value={req.notes} />}
                </div>
                {readiness && (
                  <div style={{
                    marginTop: 12,
                    padding: 10,
                    borderRadius: 10,
                    background: readiness.ok ? '#f0faf4' : '#fffbeb',
                    border: `1px solid ${readiness.ok ? '#bbf7d0' : '#fde68a'}`,
                    fontSize: 12,
                    color: readiness.ok ? '#1a7a4a' : '#92400e',
                  }}>
                    <strong>Pre-approval check:</strong>{' '}
                    {readiness.ok
                      ? 'Payment and required documents look ready.'
                      : readiness.blockers.join(' ')}
                  </div>
                )}
              </section>

              {/* DOCUMENTS */}
              <section style={styles.card}>
                <h3 style={styles.sectionTitle}>Documents</h3>
                {(!detail.docs || detail.docs.length === 0) && (
                  <p style={styles.empty}>No documents uploaded for this request.</p>
                )}
                <ul style={styles.list}>
                  {(detail.docs || []).map((doc) => {
                    const isPdf = (doc.mime_type || '').includes('pdf')
                      || String(doc.file_name || '').toLowerCase().endsWith('.pdf')
                    return (
                      <li key={doc.id} style={styles.docItem}>
                        <div style={styles.docPreviewBox}>
                          {doc.signedUrl && !isPdf ? (
                            <img src={doc.signedUrl} alt="" style={styles.docThumb} />
                          ) : (
                            <span style={{ fontSize: 11, fontWeight: 700, color: '#6b7280' }}>
                              {isPdf ? 'PDF' : 'FILE'}
                            </span>
                          )}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700 }}>{docTypeLabel(doc.doc_type)}</div>
                          <div style={styles.metaLine}>{doc.file_name || doc.storage_path}</div>
                          <div style={styles.metaLine}>
                            Uploaded {fmtDate(doc.created_at)}
                            {' · '}
                            {statusLabel(doc.status || 'uploaded')}
                          </div>
                        </div>
                        <div style={styles.btnCol}>
                          <button type="button" style={styles.secondaryBtn} onClick={() => openDoc(doc)}>
                            View
                          </button>
                          <button
                            type="button"
                            style={styles.ghostBtn}
                            onClick={() => downloadUrl(doc.signedUrl, doc.file_name)}
                            disabled={!doc.signedUrl}
                          >
                            Download
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>

              {/* ISSUES */}
              <section style={styles.card}>
                <h3 style={styles.sectionTitle}>Issues</h3>

                {issues.length === 0 && (
                  <p style={styles.empty}>No issues flagged for this request.</p>
                )}
                {issues.length > 0 && (
                  <ul style={styles.list}>
                    {issues.map((iss) => (
                      <li key={iss.id} style={styles.docItem}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 800 }}>
                            {iss.label || iss.category_code}
                            <span style={{
                              marginLeft: 8,
                              fontSize: 10,
                              fontWeight: 800,
                              padding: '2px 8px',
                              borderRadius: 999,
                              background: iss.status === 'open' ? '#fef3c7'
                                : iss.status === 'needs_recheck' ? '#dbeafe'
                                  : '#f3f4f6',
                              color: iss.status === 'open' ? '#b45309'
                                : iss.status === 'needs_recheck' ? '#1d4ed8' : '#6b7280',
                            }}>
                              {iss.status}
                            </span>
                          </div>
                          {iss.suggested_fix && (
                            <div style={styles.metaLine}>Fix: {iss.suggested_fix}</div>
                          )}
                          {iss.next_action && (
                            <div style={styles.metaLine}>Next: {iss.next_action}</div>
                          )}
                          <div style={styles.metaLine}>Flagged {fmtDate(iss.flagged_at)}</div>
                        </div>
                        {(iss.status === 'open' || iss.status === 'needs_recheck') && (
                          <div style={styles.btnCol}>
                            <button
                              type="button"
                              style={styles.secondaryBtn}
                              disabled={!!busy}
                              onClick={() => handleResolveIssue(iss, 'resolved')}
                            >
                              {busy === `issue-${iss.id}` ? '…' : 'Resolve'}
                            </button>
                            <button
                              type="button"
                              style={styles.ghostBtn}
                              disabled={!!busy}
                              onClick={() => handleResolveIssue(iss, 'waived')}
                            >
                              Waive
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {(issues.some((i) => i.status === 'open' || i.status === 'needs_recheck')) && (
                  <button
                    type="button"
                    style={{ ...styles.ghostBtn, marginTop: 10 }}
                    disabled={!!busy}
                    onClick={handleWaiveAllIssues}
                  >
                    {busy === 'waive-all' ? '…' : 'Waive all open issues'}
                  </button>
                )}

                {/* Flag new issues */}
                <div style={{ marginTop: 14, borderTop: '1px solid #f0f5f2', paddingTop: 12 }}>
                  <strong style={{ fontSize: 12, color: '#555' }}>Flag issues & notify seller</strong>
                  {issueCatalog.length === 0 && (
                    <p style={{ ...styles.metaLine, marginTop: 6 }}>
                      Issue catalog unavailable (run the issues migration first).
                    </p>
                  )}
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
                    {issueCatalog.map((c) => {
                      const on = flagSelected.includes(c.code)
                      return (
                        <button
                          key={c.code}
                          type="button"
                          onClick={() => toggleFlagCode(c.code)}
                          style={{
                            border: `1.5px solid ${on ? '#b45309' : '#e8f0ec'}`,
                            background: on ? '#fef3c7' : '#fff',
                            color: on ? '#92400e' : '#555',
                            borderRadius: 999,
                            padding: '5px 10px',
                            fontSize: 11,
                            fontWeight: 700,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          {c.label}
                        </button>
                      )
                    })}
                  </div>
                  {flagSelected.map((code) => {
                    const cat = issueCatalog.find((c) => c.code === code)
                    return (
                      <label key={code} style={{ ...styles.label, marginTop: 8 }}>
                        Fix shown to seller — {cat?.label || code}
                        <input
                          style={styles.input}
                          value={flagFixes[code] ?? cat?.default_suggested_fix ?? ''}
                          onChange={(e) => setFlagFixes((m) => ({ ...m, [code]: e.target.value }))}
                        />
                      </label>
                    )
                  })}
                  <label style={{ ...styles.label, marginTop: 10 }}>
                    Message to seller (optional — defaults to issue list)
                    <input
                      style={styles.input}
                      value={flagMessage}
                      onChange={(e) => setFlagMessage(e.target.value)}
                      placeholder="Optional extra instructions"
                    />
                  </label>
                  <button
                    type="button"
                    style={{ ...styles.warnBtn, width: '100%', marginTop: 8 }}
                    disabled={!!busy || flagSelected.length === 0}
                    onClick={handleFlagIssues}
                  >
                    {busy === 'flag-issues' ? 'Sending…' : `Flag ${flagSelected.length || ''} issues & notify`.replace('Flag  issues', 'Flag issues')}
                  </button>
                </div>
              </section>

              {/* PAYMENT */}
              <section style={styles.card}>
                <h3 style={styles.sectionTitle}>Payment</h3>
                {(!detail.payments || detail.payments.length === 0) && (
                  <div>
                    <p style={styles.empty}>No payment ledger rows yet.</p>
                    <div style={styles.kvList}>
                      <InfoRow label="Method (request)" value={formatPayMethod(req.payment_method || '—')} />
                      <InfoRow label="Reference" value={req.payment_ref || '—'} />
                      <InfoRow
                        label="Confirmed at"
                        value={req.payment_confirmed_at ? fmtDate(req.payment_confirmed_at) : '—'}
                      />
                    </div>
                  </div>
                )}
                {(detail.payments || []).map((pay) => {
                  const awaiting = ['awaiting_confirmation', 'initiated', 'pending'].includes(pay.payment_status)
                  return (
                    <div key={pay.id} style={styles.payCard}>
                      <div style={styles.kvList}>
                        <InfoRow label="Method" value={formatPayMethod(pay.payment_method || pay.gateway)} />
                        <InfoRow
                          label="Amount"
                          value={`${pay.currency || 'MWK'} ${Number(pay.payment_amount || 0).toLocaleString()}`}
                        />
                        <InfoRow label="Reference" value={pay.transaction_reference || '—'} />
                        <InfoRow label="Status" value={paymentStatusLabel(pay.payment_status)} />
                        <InfoRow
                          label="Payment date"
                          value={fmtDate(pay.payment_date || pay.confirmed_at || pay.created_at)}
                        />
                        {pay.admin_notes && (
                          <InfoRow label="Admin notes" value={pay.admin_notes} />
                        )}
                      </div>
                      {pay.receipt_path && (
                        <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                          {pay.receiptUrl && isLikelyImage(pay.receipt_file_name || pay.receipt_path) && (
                            <img
                              src={pay.receiptUrl}
                              alt="Receipt"
                              style={{ width: 96, height: 96, objectFit: 'cover', borderRadius: 10, border: '1px solid #e8f0ec' }}
                            />
                          )}
                          <button type="button" style={styles.secondaryBtn} onClick={() => openReceipt(pay)}>
                            View proof
                          </button>
                        </div>
                      )}
                      {awaiting && confirmPayReject === pay.id && (
                        <div style={{
                          marginTop: 8,
                          padding: 10,
                          borderRadius: 10,
                          background: '#fef2f2',
                          border: '1px solid #fecaca',
                        }}>
                          <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#b91c1c' }}>
                            Reject this payment? The seller will have to pay again.
                          </p>
                          <input
                            style={{ ...styles.input, marginTop: 8 }}
                            value={payRejectNote}
                            onChange={(e) => setPayRejectNote(e.target.value)}
                            placeholder="Reason (required)"
                          />
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button
                              type="button"
                              style={styles.dangerBtn}
                              disabled={!!busy}
                              onClick={() => handleRejectPay(pay)}
                            >
                              {busy === `pay-no-${pay.id}` ? '…' : 'Confirm rejection'}
                            </button>
                            <button
                              type="button"
                              style={styles.ghostBtn}
                              onClick={() => setConfirmPayReject(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      {awaiting && confirmPayReject !== pay.id && (
                        <div style={{ marginTop: 12 }}>
                          <label style={styles.label}>
                            Payment note (optional)
                            <input
                              style={styles.input}
                              value={payNote}
                              onChange={(e) => setPayNote(e.target.value)}
                              placeholder="e.g. Matched Airtel ref"
                            />
                          </label>
                          <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                            <button
                              type="button"
                              style={styles.primaryBtn}
                              disabled={!!busy}
                              onClick={() => handleConfirmPay(pay)}
                            >
                              {busy === `pay-ok-${pay.id}` ? '…' : '✓ Confirm payment'}
                            </button>
                            <button
                              type="button"
                              style={styles.dangerBtn}
                              disabled={!!busy}
                              onClick={() => handleRejectPay(pay)}
                            >
                              {busy === `pay-no-${pay.id}` ? '…' : 'Reject payment'}
                            </button>
                          </div>
                        </div>
                      )}
                      {pay.payment_status === PAYMENT_STATUSES.CONFIRMED && (
                        <div style={{ ...styles.okBanner, marginTop: 10 }}>Payment confirmed</div>
                      )}
                    </div>
                  )
                })}
              </section>

              {/* TIMELINE */}
              <section style={styles.card}>
                <h3 style={styles.sectionTitle}>Verification timeline</h3>
                {(!detail.timeline || detail.timeline.length === 0) && (
                  <p style={styles.empty}>No status events yet.</p>
                )}
                <ol style={styles.timeline}>
                  {(detail.timeline || []).map((ev, i) => (
                    <li key={ev.id || i} style={styles.tlItem}>
                      <span style={styles.tlDot} aria-hidden="true" />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
                          {ev.label || statusLabel(ev.to_status)}
                        </div>
                        <div style={styles.metaLine}>
                          {fmtDate(ev.created_at)}
                          {' · '}
                          {actorLabel(ev)}
                        </div>
                        {ev.note && ev.note !== 'created' && (
                          <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>{ev.note}</div>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </section>

              {/* ADMIN NOTES */}
              <section style={styles.card}>
                <h3 style={styles.sectionTitle}>Admin notes (internal)</h3>
                {req.admin_note && (
                  <div style={{ ...styles.okBanner, background: '#f3f4f6', color: '#374151', marginBottom: 10 }}>
                    Latest: {req.admin_note}
                  </div>
                )}
                {internalNotes.length > 0 && (
                  <ul style={{ ...styles.list, marginBottom: 12 }}>
                    {internalNotes.map((n, i) => (
                      <li key={`${n.at}-${i}`} style={{ ...styles.docItem, padding: '8px 0' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13 }}>{n.note}</div>
                          <div style={styles.metaLine}>
                            {n.admin_name || 'Admin'} · {fmtDate(n.at)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                <label style={styles.label}>
                  Add review note
                  <textarea
                    style={{ ...styles.input, minHeight: 72, resize: 'vertical' }}
                    value={internalNote}
                    onChange={(e) => setInternalNote(e.target.value)}
                    placeholder="Review comments, reasons, follow-up…"
                    maxLength={1000}
                  />
                </label>
                <button
                  type="button"
                  style={{ ...styles.secondaryBtn, marginTop: 8 }}
                  disabled={!!busy || !internalNote.trim()}
                  onClick={handleSaveNote}
                >
                  {busy === 'note' ? 'Saving…' : 'Save note'}
                </button>
              </section>

              {/* ACTIONS */}
              {!isFinal && (
                <section style={styles.card}>
                  <h3 style={styles.sectionTitle}>Admin actions</h3>

                  {/* Overdue deadline warning */}
                  {req.status === VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED
                    && req.additional_info_deadline_at
                    && new Date(req.additional_info_deadline_at) < new Date() && (
                    <div style={{
                      background: '#fee2e2',
                      border: '1px solid #fecaca',
                      color: '#b91c1c',
                      borderRadius: 10,
                      padding: '10px 12px',
                      fontSize: 13,
                      fontWeight: 700,
                      marginBottom: 12,
                    }}>
                      ⚠ Deadline passed: {new Date(req.additional_info_deadline_at).toLocaleString()}
                      <p style={{ margin: '6px 0 0', fontSize: 12, fontWeight: 600 }}>
                        Seller has not resubmitted after the deadline. Take action below.
                      </p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          style={styles.dangerBtn}
                          disabled={!!busy}
                          onClick={handleAutoExpireThis}
                        >
                          {busy === 'auto-expire' ? 'Expiring…' : 'Auto-expire this request'}
                        </button>
                        <button
                          type="button"
                          style={styles.secondaryBtn}
                          disabled={!!busy}
                          onClick={handleExtendDeadline}
                        >
                          {busy === 'extend-deadline' ? '…' : 'Extend deadline +3 days'}
                        </button>
                      </div>
                    </div>
                  )}

                  <label style={styles.label}>
                    Approve note (optional)
                    <input
                      style={styles.input}
                      value={approveNote}
                      onChange={(e) => setApproveNote(e.target.value)}
                      placeholder="Optional note on approval"
                    />
                  </label>
                  <button
                    type="button"
                    style={{ ...styles.primaryBtn, width: '100%', marginTop: 8 }}
                    disabled={!!busy}
                    onClick={handleApprove}
                  >
                    {busy === 'approve' ? 'Approving…' : '✓ Approve verification'}
                  </button>
                  {confirmApprove && (
                    <div style={{
                      marginTop: 8, padding: 10, borderRadius: 10,
                      background: readiness?.ok === false ? '#fffbeb' : '#f0faf4',
                      border: `1px solid ${readiness?.ok === false ? '#fde68a' : '#bbf7d0'}`,
                    }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: readiness?.ok === false ? '#92400e' : '#1a7a4a' }}>
                        {readiness?.ok === false
                          ? `Requirements not fully met: ${readiness.blockers.join(' · ')}. Approve anyway?`
                          : 'Approve this verification? The seller will receive a verified badge.'}
                      </p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button type="button" style={styles.primaryBtn} disabled={!!busy} onClick={handleApprove}>
                          Confirm approve
                        </button>
                        <button type="button" style={styles.ghostBtn} onClick={() => setConfirmApprove(false)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {req.status === VERIFICATION_STATUSES.ADDITIONAL_INFO_REQUIRED && (
                    <button
                      type="button"
                      style={{ ...styles.secondaryBtn, width: '100%', marginTop: 12 }}
                      disabled={!!busy}
                      onClick={handleExtendDeadline}
                    >
                      {busy === 'extend-deadline' ? '…' : 'Extend resubmit deadline +3 days'}
                    </button>
                  )}

                  <label style={{ ...styles.label, marginTop: 16 }}>
                    Request more information (required message)
                    <textarea
                      style={{ ...styles.input, minHeight: 64, resize: 'vertical' }}
                      value={infoMessage}
                      onChange={(e) => setInfoMessage(e.target.value)}
                      placeholder='e.g. Please upload a clearer ID document.'
                    />
                  </label>
                  <button
                    type="button"
                    style={{ ...styles.warnBtn, width: '100%', marginTop: 8 }}
                    disabled={!!busy}
                    onClick={handleNeedInfo}
                  >
                    {busy === 'info' ? 'Sending…' : 'Request more information'}
                  </button>

                  <label style={{ ...styles.label, marginTop: 16 }}>
                    Reject (reason required)
                    <textarea
                      style={{ ...styles.input, minHeight: 64, resize: 'vertical' }}
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Why is this request rejected?"
                    />
                  </label>
                  <button
                    type="button"
                    style={{ ...styles.dangerBtn, width: '100%', marginTop: 8 }}
                    disabled={!!busy}
                    onClick={handleReject}
                  >
                    {busy === 'reject' ? 'Rejecting…' : '✕ Reject verification'}
                  </button>
                  {confirmReject && (
                    <div style={{
                      marginTop: 8, padding: 10, borderRadius: 10,
                      background: '#fef2f2', border: '1px solid #fecaca',
                    }}>
                      <p style={{ margin: 0, fontSize: 12, fontWeight: 800, color: '#b91c1c' }}>
                        Reject this verification request? The seller can no longer resubmit it.
                      </p>
                      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                        <button type="button" style={styles.dangerBtn} disabled={!!busy} onClick={handleReject}>
                          Confirm reject
                        </button>
                        <button type="button" style={styles.ghostBtn} onClick={() => setConfirmReject(false)}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {isFinal && (
                <section style={styles.card}>
                  <div style={req.status === VERIFICATION_STATUSES.APPROVED ? styles.okBanner : styles.alert}>
                    This request is <strong>{statusLabel(req.status)}</strong>
                    {req.rejection_reason ? ` — ${req.rejection_reason}` : ''}.
                  </div>
                  <p style={{ ...styles.metaLine, marginTop: 8 }}>
                    No actions available in this stage. Use Override below to reopen it (justification required).
                  </p>
                </section>
              )}

              {/* OVERRIDE — available on all stages incl. terminal */}
              <section style={styles.card}>
                <h3 style={styles.sectionTitle}>Override status</h3>
                <p style={{ ...styles.metaLine, margin: '0 0 10px' }}>
                  Force any status transition — including reopening a terminal request. Requires a written
                  justification and is fully audited. Stage: <strong>{stageOfStatus(req.status)}</strong>.
                </p>
                {[VERIFICATION_STATUSES.PAYMENT_PENDING, VERIFICATION_STATUSES.PAYMENT_CONFIRMED].includes(req.status) && (
                  <div style={{
                    background: '#fffbeb', border: '1px solid #fde68a', color: '#92400e',
                    borderRadius: 10, padding: '8px 10px', fontSize: 12, fontWeight: 700, marginBottom: 10,
                  }}>
                    Payment stage: prefer the Confirm payment / Reject payment actions instead.
                  </div>
                )}
                <button
                  type="button"
                  style={{ ...styles.secondaryBtn, width: '100%' }}
                  onClick={() => {
                    setShowOverride(true)
                    setOverrideTarget('')
                    setOverrideJust('')
                  }}
                >
                  Override status…
                </button>
              </section>
            </>
          )}
        </div>
      </aside>

      {/* Override modal */}
      {showOverride && (
        <div style={styles.previewOverlay} role="presentation" onClick={() => !busy && setShowOverride(false)}>
          <div
            style={{ background: '#fff', borderRadius: 16, padding: 18, width: 'min(480px, 94vw)', maxHeight: '86vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Override verification status"
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: 14 }}>Override status</strong>
              <button type="button" style={styles.closeBtn} onClick={() => !busy && setShowOverride(false)}>×</button>
            </div>
            <p style={{ ...styles.metaLine, marginTop: 6 }}>
              Current: <strong>{statusLabel(req.status)}</strong> (stage <strong>{stageOfStatus(req.status)}</strong>).
              This is fully audited and allows any transition, including reopening closed requests.
            </p>
            <label style={{ ...styles.label, marginTop: 10 }}>
              New status
              <select
                style={styles.input}
                value={overrideTarget}
                onChange={(e) => setOverrideTarget(e.target.value)}
              >
                <option value="">— choose target status —</option>
                {ADMIN_OVERRIDE_TARGETS.filter((s) => s !== req.status).map((s) => (
                  <option key={s} value={s}>{statusLabel(s)} ({stageOfStatus(s)})</option>
                ))}
              </select>
            </label>
            <label style={{ ...styles.label, marginTop: 10 }}>
              Justification (required)
              <textarea
                style={{ ...styles.input, minHeight: 80, resize: 'vertical' }}
                value={overrideJust}
                onChange={(e) => setOverrideJust(e.target.value)}
                placeholder="Why is this override needed? This is stored in the audit trail."
              />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button
                type="button"
                style={styles.primaryBtn}
                disabled={!!busy || !overrideTarget || !overrideJust.trim()}
                onClick={handleOverride}
              >
                {busy === 'override' ? 'Overriding…' : 'Apply override'}
              </button>
              <button type="button" style={styles.ghostBtn} disabled={!!busy} onClick={() => setShowOverride(false)}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Document / receipt lightbox */}
      {preview && (
        <div
          style={styles.previewOverlay}
          role="presentation"
          onClick={() => setPreview(null)}
        >
          <div style={styles.previewBox} onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Document preview">
            <div style={styles.previewHeader}>
              <strong style={{ fontSize: 13 }}>{preview.name}</strong>
              <div style={{ display: 'flex', gap: 8 }}>
                <a href={preview.url} target="_blank" rel="noopener noreferrer" style={styles.secondaryBtn}>
                  Open tab
                </a>
                <button type="button" style={styles.closeBtn} onClick={() => setPreview(null)}>×</button>
              </div>
            </div>
            <div style={styles.previewBody}>
              {(preview.mime || '').includes('pdf') || String(preview.name).toLowerCase().endsWith('.pdf') ? (
                <iframe title={preview.name} src={preview.url} style={styles.pdfFrame} />
              ) : (
                <img src={preview.url} alt={preview.name} style={styles.previewImg} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '140px 1fr',
      gap: 8,
      padding: '7px 0',
      borderBottom: '1px solid #f0f5f2',
      fontSize: 13,
    }}>
      <span style={{ color: '#9ca3af', fontWeight: 600 }}>{label}</span>
      <span style={{ fontWeight: 700, color: '#111', wordBreak: 'break-word' }}>{value ?? '—'}</span>
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    approved: { bg: '#e6f4ec', color: '#1a7a4a' },
    rejected: { bg: '#fee2e2', color: '#dc2626' },
    under_review: { bg: '#dbeafe', color: '#1d4ed8' },
    payment_confirmed: { bg: '#dbeafe', color: '#1d4ed8' },
    payment_pending: { bg: '#fef3c7', color: '#b45309' },
    additional_info_required: { bg: '#fef3c7', color: '#b45309' },
    submitted: { bg: '#ede9fe', color: '#7c3aed' },
    draft: { bg: '#f3f4f6', color: '#6b7280' },
  }
  const s = map[status] || { bg: '#f3f4f6', color: '#555' }
  return (
    <span style={{
      display: 'inline-block',
      fontSize: 11,
      fontWeight: 800,
      padding: '3px 10px',
      borderRadius: 20,
      background: s.bg,
      color: s.color,
    }}>
      {statusLabel(status)}
    </span>
  )
}

function fmtDate(v) {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleString()
  } catch {
    return '—'
  }
}

function actorLabel(ev) {
  if (!ev.actor_id) return 'System'
  const role = ev.actor_role === 'seller' ? 'Seller' : ev.actor_role === 'admin' ? 'Admin' : 'Staff'
  return ev.actor_name ? `${role}: ${ev.actor_name}` : role
}

function formatPayMethod(code) {
  const c = String(code || '').toLowerCase()
  if (c.includes('pachangu') || c === 'paychangu') return 'PayChangu'
  if (c.includes('airtel')) return 'Airtel Money'
  if (c.includes('mpamba') || c.includes('tnm')) return 'TNM Mpamba'
  if (c.includes('bank')) return 'Bank'
  if (c.includes('card')) return 'Card'
  return docTypeLabel(code || 'unknown')
}

/** Public shop URL for admin open-in-new-tab */
function shopHref(shop) {
  if (!shop) return null
  if (shop.slug) return `/shop/${encodeURIComponent(shop.slug)}`
  if (shop.id) return `/shop/${encodeURIComponent(shop.id)}`
  return null
}

function isLikelyImage(name) {
  return /\.(jpe?g|png|webp|gif)$/i.test(String(name || ''))
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    background: 'rgba(15, 31, 22, 0.45)',
    display: 'flex',
    justifyContent: 'flex-end',
  },
  drawer: {
    width: 'min(560px, 100%)',
    height: '100%',
    background: '#f4f7f5',
    boxShadow: '-12px 0 40px rgba(0,0,0,0.18)',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    padding: '16px 18px',
    background: '#fff',
    borderBottom: '1px solid #e8f0ec',
    position: 'sticky',
    top: 0,
    zIndex: 2,
  },
  kicker: {
    fontSize: 10,
    fontWeight: 800,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: '#9ca3af',
  },
  title: {
    margin: '4px 0 0',
    fontSize: 16,
    fontWeight: 800,
    color: '#0f1410',
  },
  sub: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
  },
  card: {
    background: '#fff',
    borderRadius: 14,
    border: '1px solid #e8f0ec',
    padding: 14,
  },
  sectionTitle: {
    margin: '0 0 12px',
    fontSize: 12,
    fontWeight: 800,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    color: '#555',
  },
  userRow: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: '50%',
    background: '#e6f4ec',
    color: '#1a7a4a',
    fontWeight: 800,
    fontSize: 20,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  name: { fontSize: 15, fontWeight: 800, color: '#111' },
  metaLine: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  kvList: { display: 'flex', flexDirection: 'column' },
  empty: { fontSize: 13, color: '#9ca3af', margin: 0 },
  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: 10 },
  docItem: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
    padding: 8,
    borderRadius: 12,
    background: '#f9fbfa',
    border: '1px solid #f0f5f2',
  },
  docPreviewBox: {
    width: 52,
    height: 52,
    borderRadius: 10,
    background: '#eef2f0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
  docThumb: { width: '100%', height: '100%', objectFit: 'cover' },
  btnCol: { display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 },
  payCard: {
    padding: 12,
    borderRadius: 12,
    background: '#f9fbfa',
    border: '1px solid #e8f0ec',
    marginBottom: 10,
  },
  timeline: { listStyle: 'none', margin: 0, padding: 0 },
  tlItem: {
    display: 'flex',
    gap: 12,
    padding: '10px 0',
    borderLeft: '2px solid #e0ebe3',
    marginLeft: 5,
    paddingLeft: 14,
    position: 'relative',
  },
  tlDot: {
    position: 'absolute',
    left: -6,
    top: 14,
    width: 10,
    height: 10,
    borderRadius: '50%',
    background: '#1a7a4a',
    boxShadow: '0 0 0 3px #e6f4ec',
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 12,
    fontWeight: 700,
    color: '#555',
  },
  input: {
    border: '1.5px solid #e0e8e2',
    borderRadius: 10,
    padding: '9px 12px',
    fontSize: 13,
    fontFamily: 'inherit',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    background: '#fff',
  },
  primaryBtn: {
    background: '#1a7a4a',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  secondaryBtn: {
    background: '#e6f4ec',
    color: '#1a7a4a',
    border: 'none',
    borderRadius: 9,
    padding: '7px 12px',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'none',
    display: 'inline-block',
    textAlign: 'center',
  },
  linkBtn: {
    background: '#f0f5f2',
    color: '#1a7a4a',
    border: '1px solid #d8e5dc',
    borderRadius: 9,
    padding: '7px 12px',
    fontSize: 12,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
    textDecoration: 'none',
    display: 'inline-block',
  },
  warnBtn: {
    background: '#fef3c7',
    color: '#b45309',
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  dangerBtn: {
    background: '#fee2e2',
    color: '#dc2626',
    border: 'none',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 13,
    fontWeight: 800,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  ghostBtn: {
    background: '#f3f4f6',
    color: '#555',
    border: 'none',
    borderRadius: 9,
    padding: '7px 12px',
    fontSize: 12,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    background: '#f3f4f6',
    color: '#555',
    fontSize: 22,
    cursor: 'pointer',
    lineHeight: 1,
  },
  alert: {
    background: '#fee2e2',
    border: '1px solid #fecaca',
    color: '#b91c1c',
    borderRadius: 12,
    padding: '10px 12px',
    fontSize: 13,
  },
  okBanner: {
    background: '#e6f4ec',
    color: '#1a7a4a',
    borderRadius: 10,
    padding: '10px 12px',
    fontSize: 13,
    fontWeight: 600,
  },
  center: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    padding: 48,
  },
  spinner: {
    width: 28,
    height: 28,
    border: '3px solid #e0ebe3',
    borderTopColor: '#1a7a4a',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  previewOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 2100,
    background: 'rgba(0,0,0,0.65)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  previewBox: {
    width: 'min(900px, 100%)',
    maxHeight: '92vh',
    background: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
  },
  previewHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 14px',
    borderBottom: '1px solid #e8f0ec',
  },
  previewBody: {
    flex: 1,
    overflow: 'auto',
    background: '#111',
    minHeight: 320,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImg: { maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' },
  pdfFrame: { width: '100%', height: '80vh', border: 'none', background: '#fff' },
}
