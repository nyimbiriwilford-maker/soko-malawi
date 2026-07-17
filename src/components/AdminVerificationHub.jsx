import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getVerificationAnalytics,
  getVerificationSettings,
  getAdminVerificationNotifications,
  markAdminVerificationNotificationsRead,
  getVerificationAdminActivityFeed,
  enrichAdminVerificationQueue,
  buildAdminPendingActions,
  filterAdminVerificationQueue,
  statusLabel,
  paymentStatusLabel,
  formatFee,
  ADMIN_ACTIONABLE_STATUSES,
} from '../lib/verification'

const FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'today', label: 'Today' },
  { id: 'pending', label: 'Pending action' },
  { id: 'under_review', label: 'Under review' },
  { id: 'user_responded', label: 'User responded' },
  { id: 'waiting_user', label: 'Waiting for user' },
  { id: 'payment_pending', label: 'Payment pending' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'approved', label: 'Approved' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'expired', label: 'Expired' },
]

const PAY_FILTERS = [
  { id: 'all', label: 'Any payment' },
  { id: 'awaiting', label: 'Awaiting confirm' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'pending', label: 'Open / pending' },
  { id: 'failed', label: 'Failed' },
]

/**
 * Phase 8 — Verification management hub inside existing Admin → Verifications tab.
 * Does not replace Admin shell; composes list, stats, pending actions, notifications.
 */
export default function AdminVerificationHub({
  verifications = [],
  paymentByRequest = {},
  selectedId = null,
  onSelect,
  onRefresh,
  onOpenSettings,
  onOpenSellers,
  onConfirmPayment,
  onRejectPayment,
  onQuickApprove,
  onQuickNeedInfo,
  onQuickReject,
  verifyLoading = null,
  paymentLoading = null,
  adminName = '',
}) {
  const [analytics, setAnalytics] = useState(null)
  const [settings, setSettings] = useState(null)
  const [notifs, setNotifs] = useState([])
  const [activity, setActivity] = useState([])
  const [statusFilter, setStatusFilter] = useState('pending')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [showActivity, setShowActivity] = useState(false)
  const [showNotifs, setShowNotifs] = useState(true)
  const [loadingMeta, setLoadingMeta] = useState(true)

  const loadMeta = useCallback(async () => {
    setLoadingMeta(true)
    try {
      const [a, s, n, feed] = await Promise.all([
        getVerificationAnalytics().catch(() => null),
        getVerificationSettings().catch(() => null),
        getAdminVerificationNotifications({ limit: 30 }).catch(() => []),
        getVerificationAdminActivityFeed(30).catch(() => []),
      ])
      setAnalytics(a)
      setSettings(s)
      setNotifs(n || [])
      setActivity(feed || [])
    } finally {
      setLoadingMeta(false)
    }
  }, [])

  useEffect(() => {
    void loadMeta()
    const t = setInterval(() => {
      void loadMeta()
    }, 45000)
    return () => clearInterval(t)
  }, [loadMeta])

  // Refresh meta when parent reloads verifications
  useEffect(() => {
    void loadMeta()
  }, [verifications.length, loadMeta])

  const enriched = useMemo(
    () => enrichAdminVerificationQueue(verifications, paymentByRequest, settings),
    [verifications, paymentByRequest, settings]
  )

  const pending = useMemo(() => buildAdminPendingActions(enriched), [enriched])

  const filtered = useMemo(
    () => filterAdminVerificationQueue(enriched, {
      statusFilter,
      paymentFilter,
      typeFilter,
      search,
    }),
    [enriched, statusFilter, paymentFilter, typeFilter, search]
  )

  const unreadNotifs = useMemo(() => (notifs || []).filter((n) => !n.read), [notifs])
  const badgeCount = pending.urgent.length + unreadNotifs.length

  const stats = useMemo(() => {
    const a = analytics || {}
    const local = {
      total: a.total_requests ?? verifications.length,
      under_review: a.under_review ?? verifications.filter((v) => v.status === 'under_review').length,
      additional_info: a.additional_info ?? verifications.filter((v) => v.status === 'additional_info_required').length,
      payment_pending: a.payment_pending
        ?? verifications.filter((v) => v.status === 'payment_pending').length,
      approved: a.approved ?? verifications.filter((v) => v.status === 'approved').length,
      rejected: a.rejected ?? verifications.filter((v) => v.status === 'rejected').length,
      expired: a.expired ?? verifications.filter((v) => v.status === 'expired').length,
      today_completed: a.today_completed ?? 0,
      today_requests: a.today_requests ?? 0,
      revenue: a.total_revenue ?? 0,
      pending_review: a.pending
        ?? verifications.filter((v) => ADMIN_ACTIONABLE_STATUSES.includes(v.status) || v.status === 'pending').length,
    }
    return local
  }, [analytics, verifications])

  async function markNotifsRead() {
    await markAdminVerificationNotificationsRead()
    setNotifs((list) => list.map((n) => ({ ...n, read: true })))
  }

  const reviewHours = settings?.review_period_hours ?? 24

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Header tools */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 900, color: '#0f1410' }}>Verification management</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            Queue health · payments · documents · review deadlines
            {adminName ? ` · ${adminName}` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {badgeCount > 0 && (
            <span style={pill('#fee2e2', '#b91c1c')}>
              {badgeCount} need attention
            </span>
          )}
          <button type="button" style={btnSecondary} onClick={() => { onRefresh?.(); loadMeta() }}>
            Refresh
          </button>
          <button type="button" style={btnSecondary} onClick={() => setShowActivity((v) => !v)}>
            {showActivity ? 'Hide activity' : 'Activity log'}
          </button>
          <button type="button" style={btnSecondary} onClick={onOpenSellers}>
            Verified sellers
          </button>
          <button type="button" style={btnPrimary} onClick={onOpenSettings}>
            Verification settings
          </button>
        </div>
      </div>

      {/* 1. Dashboard overview */}
      <div style={statGrid}>
        <StatCard label="Total requests" value={stats.total} color="#0f1410" bg="#fff" onClick={() => setStatusFilter('all')} />
        <StatCard label="Pending review" value={stats.pending_review} color="#b45309" bg="#fffbeb" onClick={() => setStatusFilter('pending')} />
        <StatCard label="Need info" value={stats.additional_info} color="#c2410c" bg="#fff7ed" onClick={() => setStatusFilter('waiting_user')} />
        <StatCard label="Payment pending" value={stats.payment_pending} color="#1d4ed8" bg="#eff6ff" onClick={() => setStatusFilter('payment_pending')} />
        <StatCard label="Approved" value={stats.approved} color="#1a7a4a" bg="#e6f4ec" onClick={() => setStatusFilter('approved')} />
        <StatCard label="Rejected" value={stats.rejected} color="#dc2626" bg="#fef2f2" onClick={() => setStatusFilter('rejected')} />
        <StatCard label="Expired" value={stats.expired} color="#6b7280" bg="#f3f4f6" onClick={() => setStatusFilter('expired')} />
        <StatCard label="Done today" value={stats.today_completed} color="#0f766e" bg="#ecfdf5" onClick={() => setStatusFilter('today')} />
        <StatCard
          label="Verification revenue"
          value={`MWK ${Number(stats.revenue || 0).toLocaleString()}`}
          color="#1a7a4a"
          bg="#f0faf4"
          small
        />
      </div>

      {/* Settings shortcut strip */}
      <div style={{
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
        background: '#fff', border: '1px solid #e8f0ec', borderRadius: 14, padding: '12px 14px',
      }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: '#374151' }}>Quick settings</span>
        <span style={chip}>Fee: {formatFee(settings || undefined)}</span>
        <span style={chip}>Review ~{reviewHours}h</span>
        <span style={chip}>
          Validity: {settings?.verification_validity_days
            ? `${settings.verification_validity_days} days`
            : 'Lifetime'}
        </span>
        <span style={chip}>
          Verification: {settings?.is_enabled === false ? 'Disabled' : 'Enabled'}
        </span>
        <button type="button" style={{ ...btnGhost, marginLeft: 'auto' }} onClick={onOpenSettings}>
          Open settings →
        </button>
      </div>

      <div className="avh-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(260px, 320px)', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, minWidth: 0 }}>
          {/* 3. Pending actions */}
          <section style={card}>
            <div style={cardHead}>
              <div>
                <div style={cardTitle}>Pending actions</div>
                <div style={cardSub}>
                  Urgent items surface first — payments, resubmissions, overdue reviews
                </div>
              </div>
              <span style={pill('#ffedd5', '#c2410c')}>{pending.urgent.length} urgent</span>
            </div>
            {pending.all.length === 0 ? (
              <div style={empty}>No pending verification actions. Queue is clear.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {pending.urgent.slice(0, 8).map((item) => (
                  <PendingRow
                    key={item.id}
                    item={item}
                    onOpen={() => onSelect?.(item.id)}
                    urgent
                  />
                ))}
                {pending.waiting.slice(0, 4).map((item) => (
                  <PendingRow
                    key={item.id}
                    item={item}
                    onOpen={() => onSelect?.(item.id)}
                  />
                ))}
              </div>
            )}
          </section>

          {/* 4–9. Request list */}
          <section style={card}>
            <div style={cardHead}>
              <div>
                <div style={cardTitle}>Verification requests</div>
                <div style={cardSub}>
                  Click a row for full review (documents, payment, timeline). Review window ~{reviewHours}h.
                </div>
              </div>
            </div>

            <div style={{ padding: '0 14px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search name, city, ref, phone…"
                  style={searchInput}
                />
                <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={select}>
                  <option value="all">All types</option>
                  <option value="seller">Seller</option>
                  <option value="shop">Shop</option>
                  <option value="business">Business</option>
                </select>
                <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} style={select}>
                  {PAY_FILTERS.map((f) => (
                    <option key={f.id} value={f.id}>{f.label}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {FILTERS.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setStatusFilter(f.id)}
                    style={{
                      ...filterBtn,
                      background: statusFilter === f.id ? '#1a7a4a' : '#f0f5f2',
                      color: statusFilter === f.id ? '#fff' : '#374151',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {filtered.length === 0 ? (
              <div style={empty}>No requests match these filters.</div>
            ) : (
              filtered.map((v) => (
                <RequestRow
                  key={v.id}
                  v={v}
                  selected={selectedId === v.id}
                  reviewHours={reviewHours}
                  verifyLoading={verifyLoading}
                  paymentLoading={paymentLoading}
                  onSelect={() => onSelect?.(v.id)}
                  onConfirmPayment={() => onConfirmPayment?.(v.id)}
                  onRejectPayment={() => onRejectPayment?.(v.id)}
                  onApprove={() => onQuickApprove?.(v.id)}
                  onNeedInfo={() => onQuickNeedInfo?.(v.id)}
                  onReject={() => onQuickReject?.(v.id)}
                />
              ))
            )}
          </section>
        </div>

        {/* Right rail: notifications + activity */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section style={card}>
            <div style={cardHead}>
              <div style={cardTitle}>Admin notifications</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {unreadNotifs.length > 0 && (
                  <button type="button" style={btnGhost} onClick={markNotifsRead}>
                    Mark read
                  </button>
                )}
                <button type="button" style={btnGhost} onClick={() => setShowNotifs((x) => !x)}>
                  {showNotifs ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {showNotifs && (
              <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                {loadingMeta && notifs.length === 0 ? (
                  <div style={empty}>Loading…</div>
                ) : notifs.length === 0 ? (
                  <div style={empty}>No verification notifications yet.</div>
                ) : (
                  notifs.map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        const rid = n.data?.request_id || n.meta?.request_id
                        if (rid) onSelect?.(rid)
                        if (!n.read) {
                          markAdminVerificationNotificationsRead([n.id])
                          setNotifs((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)))
                        }
                      }}
                      style={{
                        display: 'block', width: '100%', textAlign: 'left',
                        border: 'none', borderBottom: '1px solid #f0f5f2',
                        background: n.read ? '#fff' : '#f0faf4',
                        padding: '12px 14px', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                        {!n.read && <span style={dot} />}
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 12, fontWeight: 800, color: '#0f1410' }}>{n.title}</div>
                          {(n.body || n.message) && (
                            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 3, lineHeight: 1.4 }}>
                              {n.body || n.message}
                            </div>
                          )}
                          <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                            {n.created_at ? new Date(n.created_at).toLocaleString() : ''}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </section>

          {showActivity && (
            <section style={card}>
              <div style={cardHead}>
                <div style={cardTitle}>Activity log</div>
              </div>
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {activity.length === 0 ? (
                  <div style={empty}>No recent verification activity.</div>
                ) : (
                  activity.map((ev) => (
                    <div key={ev.id} style={{ padding: '10px 14px', borderBottom: '1px solid #f0f5f2' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#111' }}>
                        {formatActivityAction(ev)}
                      </div>
                      {ev.note && (
                        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{ev.note}</div>
                      )}
                      <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>
                        {ev.created_at ? new Date(ev.created_at).toLocaleString() : '—'}
                        {ev.request_id ? (
                          <>
                            {' · '}
                            <button
                              type="button"
                              style={{ border: 'none', background: 'none', color: '#1a7a4a', fontWeight: 700, cursor: 'pointer', padding: 0, fontSize: 10 }}
                              onClick={() => onSelect?.(ev.request_id)}
                            >
                              Open request
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </aside>
      </div>

      <style>{`
        @media (max-width: 960px) {
          .avh-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

function StatCard({ label, value, color, bg, onClick, small }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      style={{
        border: '1px solid #e8f0ec',
        borderRadius: 14,
        padding: '14px 16px',
        background: bg,
        textAlign: 'left',
        cursor: onClick ? 'pointer' : 'default',
        fontFamily: 'inherit',
        minHeight: 78,
      }}
    >
      <div style={{
        fontSize: small ? 16 : 26,
        fontWeight: 900,
        color,
        lineHeight: 1.1,
        wordBreak: 'break-word',
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#6b7280', marginTop: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
        {label}
      </div>
    </button>
  )
}

function PendingRow({ item, onOpen, urgent }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '12px 16px', border: 'none', borderBottom: '1px solid #f0f5f2',
        background: item.userResponded ? '#eff6ff' : urgent ? '#fffbeb' : '#fff',
        cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
          {item.isNew && <span style={pill('#dbeafe', '#1d4ed8')}>NEW</span>}
          {item.userResponded && <span style={pill('#dbeafe', '#1d4ed8')}>USER HAS RESPONDED</span>}
          {item.overdue && <span style={pill('#fee2e2', '#dc2626')}>OVERDUE</span>}
          {urgent && item.action?.key === 'confirm_payment' && (
            <span style={pill('#ffedd5', '#c2410c')}>URGENT</span>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#0f1410' }}>{item.sellerName}</div>
        <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
          {item.typeName} · {statusLabel(item.status)}
          {item.submittedAt ? ` · ${relTime(item.submittedAt)}` : ''}
        </div>
      </div>
      <div style={{ flexShrink: 0, textAlign: 'right' }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: '#1a7a4a' }}>{item.action?.label}</div>
        <div style={{ fontSize: 10, color: '#9ca3af', marginTop: 2 }}>Open →</div>
      </div>
    </button>
  )
}

function RequestRow({
  v,
  selected,
  reviewHours,
  verifyLoading,
  paymentLoading,
  onSelect,
  onConfirmPayment,
  onRejectPayment,
  onApprove,
  onNeedInfo,
  onReject,
}) {
  const pay = v.payment
  const payAwaiting = pay && pay.payment_status === 'awaiting_confirmation'
  const actionable = ADMIN_ACTIONABLE_STATUSES.includes(v.status) || v.status === 'pending' || v.userResponded

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect?.()
        }
      }}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 14,
        padding: '14px 16px', borderBottom: '1px solid #f0f5f2',
        cursor: 'pointer',
        background: selected
          ? '#f0faf4'
          : v.userResponded
            ? '#f8fbff'
            : v.overdue
              ? '#fffafa'
              : 'transparent',
        borderLeft: v.userResponded
          ? '3px solid #2563eb'
          : v.overdue
            ? '3px solid #dc2626'
            : '3px solid transparent',
      }}
    >
      <div style={avatar}>
        {v.sellerAvatar
          ? <img src={v.sellerAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
          : (v.sellerName || '?')[0].toUpperCase()}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 800, color: '#0f1410' }}>{v.sellerName}</span>
          {v.isNew && <span style={pill('#dbeafe', '#1d4ed8')}>NEW</span>}
          {v.userResponded && <span style={pill('#dbeafe', '#1d4ed8')}>USER HAS RESPONDED</span>}
          {v.overdue && <span style={pill('#fee2e2', '#dc2626')}>OVERDUE</span>}
          <span style={pill(v.tone.bg, v.tone.color)}>{v.tone.label}</span>
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
          {v.typeName}
          {v.profiles?.city ? ` · ${v.profiles.city}` : ''}
          {' · '}
          {statusLabel(v.status)}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3, display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
          <span>Submitted {fmtDate(v.submitted_at || v.created_at)}</span>
          <span>Last activity {fmtDate(v.lastActivityAt)}</span>
          {v.deadline && (
            <span style={{ color: v.overdue ? '#dc2626' : '#6b7280', fontWeight: v.overdue ? 700 : 500 }}>
              Review by {fmtDate(v.deadline)} (~{reviewHours}h window)
            </span>
          )}
        </div>

        {/* Payment strip */}
        <div style={{
          marginTop: 8, padding: '8px 10px', borderRadius: 10,
          background: '#f9fbfa', border: '1px solid #eef3f0',
          fontSize: 11, color: '#374151',
        }}>
          <strong>Payment:</strong>{' '}
          {pay?.payment_method || v.payment_method || '—'}
          {' · '}
          <span style={{
            fontWeight: 800,
            color: pay?.payment_status === 'confirmed' || v.payment_confirmed_at
              ? '#1a7a4a'
              : payAwaiting ? '#c2410c' : '#6b7280',
          }}>
            {pay
              ? paymentStatusLabel(pay.payment_status)
              : (v.payment_confirmed_at ? 'Confirmed' : 'No payment row')}
          </span>
          {' · '}
          MWK {Number(pay?.payment_amount || v.amount_paid || v.amount_due || 0).toLocaleString()}
          {(pay?.transaction_reference || v.payment_ref) && (
            <> · Ref <code style={{ fontSize: 10 }}>{pay?.transaction_reference || v.payment_ref}</code></>
          )}
          {pay?.receipt_path && <span> · receipt attached</span>}
          {(pay?.payment_date || pay?.confirmed_at || v.payment_confirmed_at) && (
            <> · {fmtDate(pay?.payment_date || pay?.confirmed_at || v.payment_confirmed_at)}</>
          )}
        </div>

        {v.status === 'additional_info_required' && (
          <div style={{
            marginTop: 8, padding: '8px 10px', borderRadius: 10,
            background: '#fff7ed', border: '1px solid #fed7aa', fontSize: 11, color: '#9a3412',
          }}>
            <strong>Waiting for user response.</strong>
            {v.additional_info_message && (
              <div style={{ marginTop: 4 }}>{v.additional_info_message}</div>
            )}
          </div>
        )}

        {v.userResponded && (
          <div style={{
            marginTop: 8, padding: '8px 10px', borderRadius: 10,
            background: '#eff6ff', border: '1px solid #bfdbfe', fontSize: 12, fontWeight: 800, color: '#1d4ed8',
          }}>
            USER HAS RESPONDED — ready for review
          </div>
        )}
      </div>

      <div
        style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'flex-end', flexShrink: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 13, fontWeight: 900, color: '#1a7a4a' }}>
          MWK {Number(pay?.payment_amount || v.amount_paid || v.amount_due || 0).toLocaleString()}
        </div>
        <button type="button" onClick={onSelect} style={btnDark}>
          Open review →
        </button>
        {payAwaiting && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              disabled={paymentLoading === pay.id}
              onClick={onConfirmPayment}
              style={{ ...btnMini, background: '#dbeafe', color: '#1d4ed8' }}
            >
              {paymentLoading === pay.id ? '…' : 'Confirm payment'}
            </button>
            <button
              type="button"
              disabled={paymentLoading === pay.id}
              onClick={onRejectPayment}
              style={{ ...btnMini, background: '#fee2e2', color: '#dc2626' }}
            >
              Reject payment
            </button>
          </div>
        )}
        {actionable && !payAwaiting && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              type="button"
              disabled={verifyLoading === v.id}
              onClick={onApprove}
              style={{ ...btnMini, background: '#e6f4ec', color: '#1a7a4a' }}
            >
              {verifyLoading === v.id ? '…' : 'Approve'}
            </button>
            <button
              type="button"
              disabled={verifyLoading === v.id}
              onClick={onNeedInfo}
              style={{ ...btnMini, background: '#fef3c7', color: '#b45309' }}
            >
              Need info
            </button>
            <button
              type="button"
              disabled={verifyLoading === v.id}
              onClick={onReject}
              style={{ ...btnMini, background: '#fee2e2', color: '#dc2626' }}
            >
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function formatActivityAction(ev) {
  if (ev.kind === 'audit') return String(ev.action || 'Admin action').replace(/_/g, ' ')
  if (ev.to_status === 'additional_info_required') return 'Admin requested additional documents'
  if (ev.to_status === 'approved') return 'Admin approved verification'
  if (ev.to_status === 'rejected') return 'Admin rejected verification'
  if (ev.meta?.event === 'resubmitted' || String(ev.note || '').toLowerCase().includes('resubmit')) {
    return 'User uploaded requested documents / resubmitted'
  }
  if (ev.to_status === 'payment_confirmed' || String(ev.action || '').includes('payment')) {
    return 'Payment confirmed'
  }
  if (ev.to_status === 'under_review') return 'Moved to under review'
  return String(ev.action || 'Status update').replace(/_/g, ' ')
}

function relTime(iso) {
  if (!iso) return ''
  const ms = Date.now() - new Date(iso).getTime()
  const m = Math.floor(ms / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m} min ago`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h ago`
  const d = Math.floor(h / 24)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

function fmtDate(v) {
  if (!v) return '—'
  try {
    return new Date(v).toLocaleString()
  } catch {
    return '—'
  }
}

function pill(bg, color) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    fontSize: 10,
    fontWeight: 800,
    padding: '2px 8px',
    borderRadius: 999,
    background: bg,
    color,
    letterSpacing: 0.2,
  }
}

const chip = {
  fontSize: 11,
  fontWeight: 700,
  padding: '4px 10px',
  borderRadius: 999,
  background: '#f0f5f2',
  color: '#374151',
}

const statGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
  gap: 10,
}

const card = {
  background: '#fff',
  borderRadius: 16,
  border: '1px solid #e8f0ec',
  overflow: 'hidden',
}

const cardHead = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 10,
  padding: '14px 16px',
  borderBottom: '1px solid #eef3f0',
}

const cardTitle = { fontSize: 14, fontWeight: 900, color: '#0f1410' }
const cardSub = { fontSize: 11, color: '#9ca3af', marginTop: 3 }
const empty = { padding: 28, textAlign: 'center', color: '#9ca3af', fontSize: 13 }

const avatar = {
  width: 42,
  height: 42,
  borderRadius: '50%',
  background: '#e8f0ec',
  color: '#1a7a4a',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 800,
  fontSize: 15,
  flexShrink: 0,
  overflow: 'hidden',
}

const searchInput = {
  flex: 1,
  minWidth: 180,
  border: '1px solid #e0e8e2',
  borderRadius: 10,
  padding: '8px 12px',
  fontSize: 13,
  fontFamily: 'inherit',
  outline: 'none',
}

const select = {
  border: '1px solid #e0e8e2',
  borderRadius: 10,
  padding: '8px 10px',
  fontSize: 12,
  fontFamily: 'inherit',
  background: '#fff',
}

const filterBtn = {
  padding: '5px 12px',
  borderRadius: 20,
  border: 'none',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 700,
  fontFamily: 'inherit',
}

const btnPrimary = {
  padding: '8px 14px',
  borderRadius: 10,
  border: 'none',
  background: '#1a7a4a',
  color: '#fff',
  fontWeight: 800,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const btnSecondary = {
  padding: '8px 14px',
  borderRadius: 10,
  border: '1px solid #e0e8e2',
  background: '#fff',
  color: '#374151',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const btnGhost = {
  padding: '4px 8px',
  borderRadius: 8,
  border: 'none',
  background: 'transparent',
  color: '#1a7a4a',
  fontWeight: 700,
  fontSize: 11,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const btnDark = {
  padding: '6px 12px',
  borderRadius: 8,
  border: 'none',
  background: '#0f1f16',
  color: '#5de89e',
  fontWeight: 700,
  fontSize: 12,
  cursor: 'pointer',
  fontFamily: 'inherit',
}

const btnMini = {
  padding: '5px 10px',
  borderRadius: 8,
  border: 'none',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 700,
  fontFamily: 'inherit',
}

const dot = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: '#1a7a4a',
  marginTop: 4,
  flexShrink: 0,
}
