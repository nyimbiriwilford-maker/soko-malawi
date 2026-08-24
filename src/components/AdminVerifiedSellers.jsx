import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  adminListVerificationProfiles,
  adminManualVerificationAction,
  adminSyncVerifiedBadgesFromRequests,
  getLatestRequestIdForSeller,
  adminManualVerifyUser,
  adminManualUnverifyUser,
  statusLabel,
  friendlyVerificationError,
} from '../lib/verification'

const FILTERS = [
  { id: 'verified', label: 'Verified' },
  { id: 'rejected', label: 'Rejected' },
  { id: 'suspended', label: 'Suspended' },
  { id: 'removed', label: 'Removed / re-verify' },
  { id: 'all', label: 'All with history' },
]

/**
 * Admin tool to manage verified (and related) sellers — badge remove, suspend, re-verify, etc.
 * Mounted inside existing Admin → Verifications tab.
 */
export default function AdminVerifiedSellers({ adminName = '', onToast, onOpenRequest }) {
  const [filter, setFilter] = useState('verified')
  const [search, setSearch] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [note, setNote] = useState('')
  const [selected, setSelected] = useState(null)
  const [error, setError] = useState('')
  const [syncing, setSyncing] = useState(false)
  const [showManualVerifyModal, setShowManualVerifyModal] = useState(false)
  const [manualVerifyForm, setManualVerifyForm] = useState({
    userId: '',
    verificationType: 'seller',
    justification: '',
    adminNote: '',
  })
  const [manualVerifyBusy, setManualVerifyBusy] = useState(false)

  const toast = (m) => onToast?.(m)

  async function syncBadges() {
    setSyncing(true)
    try {
      const res = await adminSyncVerifiedBadgesFromRequests()
      toast(`✅ Synced badges for ${res.updated} of ${res.sellers} approved seller(s)`)
      await load()
    } catch (e) {
      toast(`❌ ${friendlyVerificationError(e) || e.message || 'Sync failed'}`)
    } finally {
      setSyncing(false)
    }
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const list = await adminListVerificationProfiles(filter)
      setRows(Array.isArray(list) ? list : [])
      if (!list?.length && filter === 'verified') {
        setError('') // empty is ok; show empty state, not error
      }
    } catch (e) {
      setError(friendlyVerificationError(e) || 'Could not load sellers')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load()
  }, [load])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((p) => {
      const hay = [
        p.full_name,
        p.city,
        p.phone,
        p.email,
        p.verification_status,
        p.id,
      ].filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [rows, search])

  async function runAction(action, seller) {
    const needsReason = ['remove_badge', 'suspend', 'reject', 'reverify'].includes(action)
    const reason = note.trim()
    if (needsReason && !reason) {
      toast('❌ Enter a reason/note first (fraud, fake docs, user request, etc.)')
      return
    }
    const label = action.replace(/_/g, ' ')
    if (!window.confirm(`${label} for ${seller.full_name || 'this seller'}?`)) return

    setBusyId(seller.id)
    try {
      let requestId = null
      try {
        const latest = await getLatestRequestIdForSeller(seller.id)
        requestId = latest?.id || null
      } catch { /* optional */ }

      await adminManualVerificationAction({
        action,
        sellerId: seller.id,
        requestId,
        note: reason || `${label} by ${adminName || 'admin'}`,
      })
      toast(`✅ ${label} — ${seller.full_name || 'seller'}`)
      setNote('')
      setSelected(null)
      await load()
    } catch (e) {
      // Prefer clear admin-facing message; keep technical detail if not a DB dump
      const raw = e?.message || e?.error_description || ''
      const friendly = friendlyVerificationError(e)
      const msg = /could not complete|check your details|null constraint|postgres|pgrst/i.test(friendly)
        ? (raw && raw.length < 140 ? raw : 'Could not update this seller. Confirm you are logged in as admin and try again.')
        : (friendly || raw || 'Action failed')
      toast(`❌ ${msg}`)
      console.error('adminManualVerificationAction failed', e)
    } finally {
      setBusyId(null)
    }
  }

  async function handleManualVerify() {
    const { userId, verificationType, justification, adminNote } = manualVerifyForm

    if (!userId.trim()) {
      toast('❌ User ID is required')
      return
    }

    if (!justification.trim()) {
      toast('❌ Justification is required')
      return
    }

    if (!window.confirm(`Manually verify user ${userId}? This bypasses the normal verification flow.`)) {
      return
    }

    setManualVerifyBusy(true)
    try {
      const result = await adminManualVerifyUser({
        userId: userId.trim(),
        verificationType,
        adminNote: adminNote.trim() || null,
        justification: justification.trim(),
      })

      toast(`✅ User verified successfully (request ID: ${result.request_id})`)
      setShowManualVerifyModal(false)
      setManualVerifyForm({
        userId: '',
        verificationType: 'seller',
        justification: '',
        adminNote: '',
      })
      await load()
    } catch (e) {
      const raw = e?.message || e?.error_description || ''
      const friendly = friendlyVerificationError(e)
      const msg = friendly || raw || 'Manual verification failed'
      toast(`❌ ${msg}`)
      console.error('adminManualVerifyUser failed', e)
    } finally {
      setManualVerifyBusy(false)
    }
  }

  return (
    <div style={{ padding: '0 0 24px' }}>
      <div style={{
        background: '#fff',
        borderRadius: 16,
        border: '1px solid #e8f0ec',
        overflow: 'hidden',
      }}>
        <div style={{
          padding: '16px 20px',
          borderBottom: '1px solid #e8f0ec',
          display: 'flex',
          flexWrap: 'wrap',
          gap: 12,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>Manage verified sellers</div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 3 }}>
              Remove badges, suspend, re-verify, or reinstate sellers. Reasons are saved on the profile.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setShowManualVerifyModal(true)}
              style={{
                padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, background: '#fef3c7', color: '#b45309',
                fontFamily: 'inherit',
              }}
              title="Manually verify a user without a verification request"
            >
              ⚡ Manual verify user
            </button>
            <button
              type="button"
              onClick={syncBadges}
              disabled={syncing}
              style={{
                padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, background: '#dbeafe', color: '#1d4ed8',
                fontFamily: 'inherit',
              }}
              title="Set is_verified on profiles that have an approved verification request"
            >
              {syncing ? 'Syncing…' : 'Sync badges from approved'}
            </button>
            <button
              type="button"
              onClick={load}
              style={{
                padding: '7px 12px', borderRadius: 8, border: 'none', cursor: 'pointer',
                fontSize: 12, fontWeight: 700, background: '#e6f4ec', color: '#1a7a4a',
                fontFamily: 'inherit',
              }}
            >
              Refresh
            </button>
          </div>
        </div>

        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f5f2', display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              style={{
                padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                fontSize: 11, fontWeight: 700,
                background: filter === f.id ? '#1a7a4a' : '#f0f5f2',
                color: filter === f.id ? '#fff' : '#555',
                fontFamily: 'inherit',
              }}
            >
              {f.label}
            </button>
          ))}
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, city, phone…"
            style={{
              marginLeft: 'auto',
              minWidth: 200,
              flex: '1 1 180px',
              border: '1.5px solid #e0e8e2',
              borderRadius: 10,
              padding: '8px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
            }}
          />
        </div>

        <div style={{ padding: '12px 20px', borderBottom: '1px solid #f0f5f2', background: '#f9fbfa' }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: '#637068', display: 'block', marginBottom: 6 }}>
            Action reason / admin note
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Required for remove / suspend / reject / re-verify — e.g. fraud, fake documents, user request, account violation"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              border: '1.5px solid #e0e8e2',
              borderRadius: 10,
              padding: '10px 12px',
              fontSize: 13,
              fontFamily: 'inherit',
              resize: 'vertical',
            }}
          />
        </div>

        {error && (
          <div style={{ margin: 16, padding: 12, background: '#fef2f2', color: '#b91c1c', borderRadius: 10, fontSize: 13 }}>
            {error}
          </div>
        )}

        {loading && (
          <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>Loading sellers…</div>
        )}

        {!loading && filtered.length === 0 && (
          <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            No sellers match this filter.
            {filter === 'verified' && (
              <div style={{ marginTop: 8, fontSize: 12 }}>
                Tip: try filter <strong>All with history</strong>, or open an approved request and use Approve seller so the badge syncs.
              </div>
            )}
          </div>
        )}

        {!loading && filtered.map((p) => {
          const verified = !!p.is_verified
          const busy = busyId === p.id
          const isOpen = selected === p.id
          return (
            <div
              key={p.id}
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 12,
                alignItems: 'center',
                padding: '14px 20px',
                borderBottom: '1px solid #f0f5f2',
                background: isOpen ? '#f0faf4' : 'transparent',
              }}
            >
              <div style={{
                width: 42, height: 42, borderRadius: '50%', background: '#e6f4ec',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#1a7a4a', fontWeight: 800, overflow: 'hidden', flexShrink: 0,
                fontSize: 15,
              }}>
                {p.avatar_url
                  ? <img src={p.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : (p.full_name || 'S').trim().charAt(0).toUpperCase()}
              </div>

              <div style={{ flex: 1, minWidth: 160 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 13, fontWeight: 800, color: '#111' }}>
                    {p.full_name || 'Name not on profile'}
                  </span>
                  <StatusChip verified={verified} status={p.verification_status} />
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                  {[p.city, p.phone, p.email].filter(Boolean).join(' · ')
                    || (p.full_name ? 'No phone/city on profile' : 'Profile incomplete — ask seller to update Profile')}
                </div>
                {p.verified_at && (
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>
                    Verified {new Date(p.verified_at).toLocaleString()}
                  </div>
                )}
                {p.rejection_reason && (
                  <div style={{ fontSize: 11, color: '#b45309', marginTop: 2 }}>Note: {p.rejection_reason}</div>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setSelected(isOpen ? null : p.id)}
                  style={btn('#0f1f16', '#5de89e')}
                >
                  {isOpen ? 'Hide actions' : 'Manage'}
                </button>
                {onOpenRequest && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={async () => {
                      if (p.latest_request_id) {
                        onOpenRequest(p.latest_request_id)
                        return
                      }
                      const latest = await getLatestRequestIdForSeller(p.id)
                      if (latest?.id) onOpenRequest(latest.id)
                      else toast('No verification request on file for this seller')
                    }}
                    style={btn('#e6f4ec', '#1a7a4a')}
                  >
                    Open request
                  </button>
                )}
              </div>

              {isOpen && (
                <div style={{
                  width: '100%',
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 8,
                  paddingTop: 4,
                }}>
                  {!verified && (
                    <button type="button" disabled={busy} onClick={() => runAction('approve', p)} style={btn('#e6f4ec', '#1a7a4a')}>
                      {busy ? '…' : '✓ Grant verified'}
                    </button>
                  )}
                  {verified && (
                    <>
                      <button type="button" disabled={busy} onClick={() => runAction('remove_badge', p)} style={btn('#ffedd5', '#c2410c')}>
                        Remove badge
                      </button>
                      <button type="button" disabled={busy} onClick={() => runAction('suspend', p)} style={btn('#f3f4f6', '#555')}>
                        Suspend
                      </button>
                      <button type="button" disabled={busy} onClick={() => runAction('reverify', p)} style={btn('#dbeafe', '#1d4ed8')}>
                        Require re-verification
                      </button>
                    </>
                  )}
                  <button type="button" disabled={busy} onClick={() => runAction('reject', p)} style={btn('#fee2e2', '#dc2626')}>
                    Mark rejected
                  </button>
                  {!verified && (
                    <button type="button" disabled={busy} onClick={() => runAction('reactivate', p)} style={btn('#e6f4ec', '#1a7a4a')}>
                      Reactivate badge
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {!loading && (
          <div style={{ padding: '10px 20px', fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>
            Showing {filtered.length} seller{filtered.length === 1 ? '' : 's'}
            {filter === 'verified' ? ' (verified badge or approved request)' : ''}
          </div>
        )}
      </div>
    </div>
  )
}

function StatusChip({ verified, status }) {
  if (verified) {
    return (
      <span style={{
        fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
        background: '#e6f4ec', color: '#1a7a4a',
      }}>
        Verified
      </span>
    )
  }
  const s = String(status || 'none')
  const map = {
    rejected: { bg: '#fee2e2', color: '#dc2626' },
    suspended: { bg: '#f3f4f6', color: '#555' },
    removed: { bg: '#ffedd5', color: '#c2410c' },
    reverification_required: { bg: '#dbeafe', color: '#1d4ed8' },
  }
  const c = map[s] || { bg: '#f3f4f6', color: '#6b7280' }
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
      background: c.bg, color: c.color,
    }}>
      {statusLabel(s)}
    </span>
  )
}

function btn(bg, color) {
  return {
    padding: '6px 12px',
    borderRadius: 8,
    border: 'none',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: 700,
    background: bg,
    color,
    fontFamily: 'inherit',
  }
}
