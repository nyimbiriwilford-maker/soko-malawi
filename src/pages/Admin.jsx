import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isListingFeatured } from '../utils/homeUtils'
import {
  adminTransitionVerification,
  ADMIN_ACTIONABLE_STATUSES,
  statusLabel,
  adminConfirmPayment,
  adminRejectPayment,
  getPaymentsForRequest,
  enrichAdminVerificationQueue,
  buildAdminPendingActions,
  getAdminVerificationNotifications,
} from '../lib/verification'
import AdminVerificationDetail from '../components/AdminVerificationDetail'
import AdminVerificationSettings from '../components/AdminVerificationSettings'
import AdminVerifiedSellers from '../components/AdminVerifiedSellers'
import AdminVerificationHub from '../components/AdminVerificationHub'

const TABS = ['Dashboard', 'Featured', 'Listings', 'Users', 'Verifications', 'Verify Settings', 'Shop Reports', 'Broadcast']

export default function Admin() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [tab, setTab] = useState(() => searchParams.get('tab') || 'Dashboard')
  const [listings, setListings] = useState([])
  const [featurePromos, setFeaturePromos] = useState([]) // Phase 5.1 analytics ledger
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [toast, setToast] = useState('')
  const [adminName, setAdminName] = useState('')
  const [freeFeaturedEnabled, setFreeFeaturedEnabled] = useState(true)
  const [settingsLoading, setSettingsLoading] = useState(false)
  const [verifications, setVerifications] = useState([])
  const [verifyLoading, setVerifyLoading] = useState(false)
  const [paymentByRequest, setPaymentByRequest] = useState({}) // requestId -> latest payment
  const [paymentLoading, setPaymentLoading] = useState(null)
  const [selectedVerificationId, setSelectedVerificationId] = useState(() => searchParams.get('request') || null)
  const [verificationView, setVerificationView] = useState('requests') // requests | sellers
  const [adminUserId, setAdminUserId] = useState(null)
  const [adminNotifCount, setAdminNotifCount] = useState(0)
  const [shopReports, setShopReports] = useState([])
  const [reportFilter, setReportFilter] = useState('pending')
  const [reportActionLoading, setReportActionLoading] = useState(null)
  const [broadcastSubject, setBroadcastSubject] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [broadcasting, setBroadcasting] = useState(false)
  const [broadcastResult, setBroadcastResult] = useState(null)
  const [broadcastFilter, setBroadcastFilter] = useState({ role: 'all', city: '' })
  const [selectedUsers, setSelectedUsers] = useState([])

  useEffect(() => { init() }, [])

  // Deep-link: /admin?tab=Verifications&request=...
  useEffect(() => {
    const t = searchParams.get('tab')
    const req = searchParams.get('request')
    if (t && TABS.includes(t)) setTab(t)
    if (req) {
      setTab('Verifications')
      setVerificationView('requests')
      setSelectedVerificationId(req)
    }
  }, [searchParams])

  const verificationBadgeCount = useMemo(() => {
    const enriched = enrichAdminVerificationQueue(verifications, paymentByRequest, null)
    const pending = buildAdminPendingActions(enriched)
    return pending.urgent.length + adminNotifCount
  }, [verifications, paymentByRequest, adminNotifCount])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const n = await getAdminVerificationNotifications({ unreadOnly: true, limit: 50 })
        if (!cancelled) setAdminNotifCount((n || []).length)
      } catch {
        if (!cancelled) setAdminNotifCount(0)
      }
    })()
    return () => { cancelled = true }
  }, [verifications.length, tab])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') { navigate('/'); return }

    setAdminName(profile?.full_name || user.email)
    setAdminUserId(user.id)
    await Promise.all([loadListings(), loadUsers(), loadVerifications(), loadShopReports(), loadSettings()])
    setLoading(false)
  }

  async function loadSettings() {
    const { data } = await supabase.from('app_settings').select('value').eq('key', 'free_featured_enabled').maybeSingle()
    if (data) setFreeFeaturedEnabled(data.value === true)
  }

  async function toggleFreeFeatured() {
    setSettingsLoading(true)
    const next = !freeFeaturedEnabled
    const { error } = await supabase.from('app_settings')
      .update({ value: next, updated_at: new Date().toISOString() })
      .eq('key', 'free_featured_enabled')
    if (error) {
      showToast(`❌ Failed: ${error.message}`)
    } else {
      setFreeFeaturedEnabled(next)
      showToast(next ? '✅ Free featured listing enabled' : '🚫 Free featured listing disabled')
    }
    setSettingsLoading(false)
  }

 async function loadListings() {
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, price, city, category, images, status, featured, is_featured, featured_until, seller_id, created_at, promoted_until')
    .order('created_at', { ascending: false })
  if (error) console.error('Listings error:', error)

  // Phase 2.2: derive featured from featured_until > now()
  const list = (data || []).map(l => ({ ...l, is_featured: isListingFeatured(l) }))
  const sellerIds = [...new Set(list.map(l => l.seller_id).filter(Boolean))]
  if (sellerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', sellerIds)
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    list.forEach(l => { l.profiles = profileMap[l.seller_id] || null })
  }

  // Featured promotions ledger (full) for analytics + per-card latest promo
  const { data: allPromos } = await supabase
    .from('listing_promotions')
    .select('id, listing_id, price_mwk, started_at, expires_at, status, tx_ref, created_at')
    .eq('promotion_type', 'featured')
    .order('created_at', { ascending: false })
    .limit(3000)

  const promos = allPromos || []
  setFeaturePromos(promos)

  const promoMap = {}
  promos.forEach(p => {
    // Most recent per listing (list ordered created_at desc)
    if (!promoMap[p.listing_id]) promoMap[p.listing_id] = p
  })
  list.forEach(l => {
    const p = promoMap[l.id]
    if (p) {
      l.promo_price = p.price_mwk
      l.promo_started_at = p.started_at
      l.promo_expires_at = p.expires_at
      l.promo_status = p.status
      if (p.started_at && p.expires_at) {
        const days = Math.round((new Date(p.expires_at) - new Date(p.started_at)) / 86400000)
        l.promo_duration_days = days
      }
    }
  })

  setListings(list)
}

async function loadVerifications() {
  let rows = []
  // Progressive selects — FK embed names differ by environment; never leave admin blank
  const attempts = [
    { sel: '*, profiles!seller_id(full_name, avatar_url, city, phone, email, created_at)', order: 'created_at' },
    { sel: '*, profiles!seller_id(full_name, avatar_url, city)', order: 'created_at' },
    { sel: '*, profiles!seller_id(full_name, avatar_url, city)', order: 'updated_at' },
    { sel: '*', order: 'created_at' },
    { sel: '*', order: 'updated_at' },
    { sel: 'id, seller_id, status, payment_method, payment_ref, amount_due, amount_paid, currency, admin_note, additional_info_message, rejection_reason, submitted_at, reviewed_at, under_review_at, payment_confirmed_at, created_at, updated_at, meta, notes', order: 'created_at' },
  ]
  for (const a of attempts) {
    const { data, error } = await supabase
      .from('verification_requests')
      .select(a.sel)
      .order(a.order, { ascending: false })
      .limit(300)
    if (!error && data) {
      rows = data
      break
    }
  }

  // If profiles embed missing, batch-load seller profiles
  const needProfiles = rows.some((r) => !r.profiles && r.seller_id)
  if (needProfiles) {
    const ids = [...new Set(rows.map((r) => r.seller_id).filter(Boolean))]
    if (ids.length) {
      let profileMap = {}
      for (const cols of [
        'id, full_name, avatar_url, city, phone, email, created_at',
        'id, full_name, avatar_url, city',
        'id, full_name, avatar_url',
      ]) {
        const { data: ps, error } = await supabase.from('profiles').select(cols).in('id', ids)
        if (!error && ps?.length) {
          profileMap = Object.fromEntries(ps.map((p) => [p.id, p]))
          break
        }
      }
      rows = rows.map((r) => ({
        ...r,
        profiles: r.profiles || profileMap[r.seller_id] || null,
      }))
    }
  }

  setVerifications(rows)

  // Load latest payment per request (prefer confirmed)
  const map = {}
  await Promise.all(
    rows.slice(0, 80).map(async (r) => {
      try {
        const pays = await getPaymentsForRequest(r.id, {
          paymentRef: r.payment_ref,
          sellerId: r.seller_id,
        })
        if (pays?.[0]) map[r.id] = pays[0]
      } catch { /* migration optional */ }
    })
  )
  // Also load awaiting_confirmation globally for admin queue
  try {
    const { data: openPays } = await supabase
      .from('verification_payments')
      .select('*')
      .in('payment_status', ['awaiting_confirmation', 'initiated', 'pending'])
      .order('created_at', { ascending: false })
      .limit(50)
    ;(openPays || []).forEach((p) => {
      if (p.request_id && !map[p.request_id]) map[p.request_id] = p
      else if (p.request_id) {
        // prefer awaiting_confirmation
        const cur = map[p.request_id]
        if (p.payment_status === 'awaiting_confirmation') map[p.request_id] = p
        else if (!cur) map[p.request_id] = p
      }
    })
  } catch { /* table may not exist yet */ }
  setPaymentByRequest(map)
}

async function loadShopReports() {
  const { data, error } = await supabase
    .from('shop_reports')
    .select('*, shops(name, slug, logo_url)')
    .order('created_at', { ascending: false })
  if (error) console.error('Shop reports error:', error)
  setShopReports(data || [])
}

async function handleReportAction(id, status) {
  setReportActionLoading(id)
  const note = status === 'dismissed' ? (window.prompt('Note (optional):') || null) : null
  await supabase.from('shop_reports').update({
    status,
    admin_note: note,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id)
  setShopReports(rs => rs.map(r => r.id === id ? { ...r, status, admin_note: note } : r))
  showToast(status === 'reviewed' ? '✅ Marked as reviewed' : '✕ Report dismissed')
  setReportActionLoading(null)
}

async function handleVerify(id, status, note = '') {
  setVerifyLoading(id)
  try {
    // Prefer helpers that notify seller (need-info / approve / reject)
    if (status === 'additional_info_required') {
      const { adminRequestMoreInfo } = await import('../lib/verification')
      await adminRequestMoreInfo(id, note || 'Please provide the requested documents.')
    } else if (status === 'approved') {
      const { adminApproveVerification } = await import('../lib/verification')
      await adminApproveVerification(id, note || null, { force: true })
    } else if (status === 'rejected') {
      const { adminRejectVerification } = await import('../lib/verification')
      await adminRejectVerification(id, note || 'Request rejected')
    } else {
      try {
        await adminTransitionVerification(id, status, note || null)
      } catch {
        await supabase.from('verification_requests').update({
          status,
          admin_note: note || null,
          additional_info_message: status === 'additional_info_required' ? (note || null) : undefined,
          rejection_reason: status === 'rejected' ? (note || null) : null,
          reviewed_at: new Date().toISOString(),
          under_review_at: status === 'under_review' ? new Date().toISOString() : undefined,
        }).eq('id', id)
      }
    }

    setVerifications(vs => vs.map(v => v.id === id
      ? {
          ...v,
          status,
          admin_note: note || v.admin_note,
          additional_info_message: status === 'additional_info_required' ? (note || v.additional_info_message) : v.additional_info_message,
          rejection_reason: status === 'rejected' ? (note || null) : v.rejection_reason,
        }
      : v
    ))
    showToast(
      status === 'approved' ? '✅ Seller verified!'
        : status === 'rejected' ? '❌ Request rejected'
          : status === 'additional_info_required' ? 'ℹ️ Additional info requested — seller notified'
            : `Status → ${statusLabel(status)}`
    )
  } catch (e) {
    showToast(e.message || 'Verification update failed')
  }
  setVerifyLoading(null)
}

function isVerificationActionable(status) {
  return ADMIN_ACTIONABLE_STATUSES.includes(status) || status === 'pending'
}

async function handleConfirmPayment(requestId) {
  const pay = paymentByRequest[requestId]
  if (!pay?.id) {
    showToast('No payment record found for this request')
    return
  }
  const note = window.prompt('Admin notes (optional):') || null
  setPaymentLoading(pay.id)
  try {
    const confirmed = await adminConfirmPayment(pay.id, note, true)
    setPaymentByRequest((m) => ({ ...m, [requestId]: confirmed }))
    await loadVerifications()
    showToast('✅ Payment confirmed — request advanced if applicable')
  } catch (e) {
    showToast(e.message || 'Could not confirm payment')
  }
  setPaymentLoading(null)
}

async function handleRejectPayment(requestId) {
  const pay = paymentByRequest[requestId]
  if (!pay?.id) {
    showToast('No payment record found')
    return
  }
  const note = window.prompt('Why reject this payment?') || 'Payment rejected'
  setPaymentLoading(pay.id)
  try {
    const rejected = await adminRejectPayment(pay.id, note)
    setPaymentByRequest((m) => ({ ...m, [requestId]: rejected }))
    showToast('Payment marked failed')
  } catch (e) {
    showToast(e.message || 'Could not reject payment')
  }
  setPaymentLoading(null)
}

function getBroadcastFiltered() {
  return users.filter(u => {
    const matchRole = broadcastFilter.role === 'all' || u.role === broadcastFilter.role
    const matchCity = !broadcastFilter.city || (u.city || '').toLowerCase().includes(broadcastFilter.city.toLowerCase())
    return matchRole && matchCity
  })
}

function toggleSelectUser(id) {
  setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
}

function toggleSelectAll() {
  const filtered = getBroadcastFiltered()
  const allSelected = filtered.every(u => selectedUsers.includes(u.id))
  if (allSelected) setSelectedUsers([])
  else setSelectedUsers(filtered.map(u => u.id))
}

async function handleBroadcast() {
  if (!broadcastSubject.trim() || !broadcastMessage.trim()) {
    showToast('Please fill in subject and message')
    return
  }
  if (selectedUsers.length === 0) {
    showToast('Select at least one user')
    return
  }
  if (!window.confirm(`Send this email to ${selectedUsers.length} selected user(s)?`)) return

  setBroadcasting(true)
  setBroadcastResult(null)

  try {
    const { data, error } = await supabase.functions.invoke('broadcast-email', {
      body: { subject: broadcastSubject.trim(), message: broadcastMessage.trim(), userIds: selectedUsers }
    })
    if (error) throw error
    setBroadcastResult({ success: true, sent: data?.sent || selectedUsers.length })
showToast(`✅ Email sent to ${data?.sent || selectedUsers.length} users`)
    setSelectedUsers([])
  } catch (err) {
    setBroadcastResult({ success: false, error: err.message })
    showToast('❌ Failed to send emails')
  } finally {
    setBroadcasting(false)
  }
}

async function loadUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
  if (error) console.error('Users error:', error)
  setUsers(data || [])
}
  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  /**
   * Phase 1.3 — Admin feature control via RPC only.
   * Never writes is_featured / featured / promoted_until from the client.
   * Sellers cannot call these RPCs (is_admin() enforced server-side).
   */
  async function toggleFeatured(listing) {
    setToggling(listing.id)
    try {
      if (!listing.is_featured) {
        const daysInput = window.prompt('Feature this listing for how many days?', '14')
        const days = parseInt(daysInput, 10)
        if (!daysInput || !days || days <= 0) return

        const { error } = await supabase.rpc('admin_set_listing_featured', {
          p_listing_id: listing.id,
          p_duration_days: days,
        })
        if (error) throw error

        showToast(`Featured for ${days} days ⭐`)
        await loadListings()
      } else {
        const { error } = await supabase.rpc('admin_unset_listing_featured', {
          p_listing_id: listing.id,
        })
        if (error) throw error

        showToast('Removed from featured')
        await loadListings()
      }
    } catch (e) {
      showToast(`❌ ${e?.message || 'Feature update failed'}`)
    } finally {
      setToggling(null)
    }
  }

  async function toggleStatus(listing) {
    const next = listing.status === 'active' ? 'inactive' : 'active'
    await supabase.from('listings').update({ status: next }).eq('id', listing.id)
    setListings(ls => ls.map(l => l.id === listing.id ? { ...l, status: next } : l))
    showToast(`Listing ${next === 'active' ? 'activated ✓' : 'deactivated'}`)
  }

  async function deleteListing(id) {
    if (!window.confirm('Delete this listing permanently?')) return
    await supabase.from('listings').delete().eq('id', id)
    setListings(ls => ls.filter(l => l.id !== id))
    showToast('Listing deleted')
  }

  async function toggleAccess(u) {
    const next = u.is_disabled ? false : true
    const { error } = await supabase.from('profiles').update({ is_disabled: next }).eq('id', u.id)
    if (error) {
      showToast(`❌ Failed: ${error.message}`)
      return
    }
    const { data: updated } = await supabase.from('profiles').select('is_disabled').eq('id', u.id).single()
    setUsers(us => us.map(x => x.id === u.id ? { ...x, is_disabled: updated?.is_disabled } : x))
    showToast(updated?.is_disabled ? `🚫 ${u.full_name || 'User'} access disabled` : `✅ ${u.full_name || 'User'} access restored`)
  }

  async function toggleRole(u) {
    const next = u.role === 'admin' ? 'user' : 'admin'
    await supabase.from('profiles').update({ role: next }).eq('id', u.id)
    setUsers(us => us.map(x => x.id === u.id ? { ...x, role: next } : x))
    showToast(`${u.full_name || 'User'} is now ${next}`)
  }

  // Home publishes as `published`; some rows use `active`. Treat both as live.
  const isLiveStatus = (s) => s === 'published' || s === 'active'

  const stats = {
    total: listings.length,
    active: listings.filter(l => isLiveStatus(l.status)).length,
    featured: listings.filter(l => l.is_featured).length,
    inactive: listings.filter(l => l.status === 'inactive' || l.status === 'draft').length,
    users: users.length,
    admins: users.filter(u => u.role === 'admin').length,
  }

  const featuredListings = listings.filter(l => l.is_featured)
  const unfeaturedListings = listings.filter(l => !l.is_featured && isLiveStatus(l.status))

  // Phase 5.1 — featured listing analytics (from ledger + active windows)
  const featuredAnalytics = useMemo(() => {
    const now = Date.now()
    const in48h = now + 48 * 3600 * 1000
    const in7d = now + 7 * 24 * 3600 * 1000

    const paidSuccess = featurePromos.filter(
      p => (p.status === 'active' || p.status === 'expired') && Number(p.price_mwk || 0) > 0,
    )
    const revenue = paidSuccess.reduce((sum, p) => sum + Number(p.price_mwk || 0), 0)

    const freeAll = featurePromos.filter(
      p => Number(p.price_mwk || 0) === 0 && (p.status === 'active' || p.status === 'expired'),
    )
    const freeActive = featurePromos.filter(
      p => p.status === 'active' && Number(p.price_mwk || 0) === 0,
    )
    const paidActive = featurePromos.filter(
      p => p.status === 'active' && Number(p.price_mwk || 0) > 0,
    )

    // Failed activations: paid pending that failed/cancelled/expired without activating
    const failed = featurePromos.filter(
      p => Number(p.price_mwk || 0) > 0 && (p.status === 'failed' || p.status === 'cancelled'),
    )
    // Still pending paid (stuck / abandoned checkout)
    const pendingPaid = featurePromos.filter(
      p => p.status === 'pending' && Number(p.price_mwk || 0) > 0,
    )

    const activeCount = featuredListings.length
    const expiringSoon = featuredListings.filter(l => {
      const end = l.featured_until || l.promoted_until || l.promo_expires_at
      if (!end) return false
      const t = new Date(end).getTime()
      return t > now && t <= in48h
    })
    const expiringWeek = featuredListings.filter(l => {
      const end = l.featured_until || l.promoted_until || l.promo_expires_at
      if (!end) return false
      const t = new Date(end).getTime()
      return t > now && t <= in7d
    })

    return {
      revenue,
      paidActivations: paidSuccess.length,
      activeCount,
      expiringSoon: expiringSoon.length,
      expiringWeek: expiringWeek.length,
      freeActive: freeActive.length,
      paidActive: paidActive.length,
      freeAllTime: freeAll.length,
      failedActivations: failed.length,
      pendingPaid: pendingPaid.length,
      expiringList: expiringSoon
        .slice()
        .sort((a, b) => {
          const ta = new Date(a.featured_until || a.promoted_until || 0).getTime()
          const tb = new Date(b.featured_until || b.promoted_until || 0).getTime()
          return ta - tb
        })
        .slice(0, 8),
    }
  }, [featurePromos, featuredListings])

  const filteredListings = listings.filter(l => {
    const matchSearch = !search ||
      l.title?.toLowerCase().includes(search.toLowerCase()) ||
      l.city?.toLowerCase().includes(search.toLowerCase()) ||
      l.profiles?.full_name?.toLowerCase().includes(search.toLowerCase())
    let matchStatus = true
    if (statusFilter === 'active') matchStatus = isLiveStatus(l.status)
    else if (statusFilter === 'inactive') matchStatus = l.status === 'inactive' || l.status === 'draft'
    else if (statusFilter !== 'all') matchStatus = l.status === statusFilter
    return matchSearch && matchStatus
  })

  if (loading) return (
    <div style={S.loadWrap}>
      <div style={S.spinner} />
      <p style={{ color: '#888', marginTop: 12, fontSize: 13 }}>Loading admin panel…</p>
    </div>
  )

  const TAB_ICONS = {
    Dashboard: '📊', Featured: '⭐', Listings: '📦', Users: '👥',
    Verifications: '✅', 'Verify Settings': '⚙️', 'Shop Reports': '🚩', Broadcast: '📣',
  }

  return (
    <div style={S.shell}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
        * { box-sizing: border-box; }
        body { margin: 0; }
        .row-hover:hover { background: #f8faf9 !important; }
        .tab-btn:hover { background: #f0f5f2 !important; }
        .act-btn:hover { opacity: 0.75; }
        .nav-item:hover { background: rgba(255,255,255,0.08) !important; }
        .feat-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
        input:focus { border-color: #1a7a4a !important; outline: none; }
        select:focus { outline: none; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d0dbd4; border-radius: 10px; }
      `}</style>

      {/* ── Toast ── */}
      {toast && <div style={S.toast}>{toast}</div>}

      {/* ── Sidebar ── */}
      <aside style={S.sidebar}>
        <div style={S.sidebarTop}>
          <div style={S.brand}>
            <div style={S.brandIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22" fill="none" stroke="#fff" strokeWidth="1.5"/>
              </svg>
            </div>
            <div>
              <div style={S.brandName}>SokoMW</div>
              <div style={S.brandBadge}>ADMIN PANEL</div>
            </div>
          </div>

          <nav style={{ marginTop: 32 }}>
            <div style={S.navLabel}>MAIN MENU</div>
            {TABS.map(t => (
              <button
                key={t}
                className="nav-item"
                onClick={() => setTab(t)}
                style={{
                  ...S.navItem,
                  ...(tab === t ? S.navItemActive : {}),
                }}
              >
                <span style={{ fontSize: 16 }}>{TAB_ICONS[t]}</span>
                {t}
                {t === 'Featured' && (
                  <span style={S.navPill}>{stats.featured}</span>
                )}
               {t === 'Users' && (
  <span style={S.navPill}>{stats.users}</span>
)}
{t === 'Verifications' && verificationBadgeCount > 0 && (
  <span style={{ ...S.navPill, background: '#dc2626' }}>
    {verificationBadgeCount}
  </span>
)}
{t === 'Shop Reports' && shopReports.filter(r => r.status === 'pending').length > 0 && (
  <span style={{ ...S.navPill, background: '#dc2626' }}>
    {shopReports.filter(r => r.status === 'pending').length}
  </span>
)}
              </button>
            ))}
          </nav>
        </div>

        <div style={S.sidebarBottom}>
          <div style={S.adminCard}>
            <div style={S.adminAvatar}>
              {(adminName[0] || 'A').toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.adminName}>{adminName}</div>
              <div style={S.adminRole}>Super Admin</div>
            </div>
          </div>
          <button style={S.logoutBtn} onClick={handleLogout}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={S.main}>

        {/* Topbar */}
        <div style={S.topbar}>
          <div>
            <div style={S.topbarTitle}>{tab}</div>
            <div style={S.topbarSub}>
              {tab === 'Dashboard' && 'Platform overview'}
              {tab === 'Featured' && 'Control homepage spotlight'}
              {tab === 'Listings' && `${filteredListings.length} listings`}
              {tab === 'Users' && `${stats.users} accounts`}
              {tab === 'Verifications' && 'Review seller applications'}
              {tab === 'Verify Settings' && 'Fees, docs, methods & analytics'}
            </div>
          </div>
          {(tab === 'Listings') && (
            <div style={S.searchBar}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="#aaa" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                style={S.searchInput}
                placeholder="Search listings…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select
                style={S.filterSelect}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="active">Active / Published</option>
                <option value="inactive">Inactive / Draft</option>
                <option value="sold">Sold</option>
                <option value="published">Published only</option>
              </select>
            </div>
          )}
        </div>

        {/* ══ TAB: DASHBOARD ══ */}
        {tab === 'Dashboard' && (
          <div style={S.content}>
            <div style={S.statsGrid}>
              {[
                { label: 'Total Listings', value: stats.total, color: '#1a7a4a', bg: '#e6f4ec', icon: '📦' },
                { label: 'Active Listings', value: stats.active, color: '#1d4ed8', bg: '#dbeafe', icon: '✅' },
                { label: 'Featured', value: stats.featured, color: '#b45309', bg: '#fef3c7', icon: '⭐' },
                { label: 'Feature revenue', value: `MWK ${Number(featuredAnalytics.revenue || 0).toLocaleString()}`, color: '#15803d', bg: '#dcfce7', icon: '💰' },
                { label: 'Expiring (48h)', value: featuredAnalytics.expiringSoon, color: '#c2410c', bg: '#ffedd5', icon: '⏳' },
                { label: 'Failed features', value: featuredAnalytics.failedActivations, color: '#dc2626', bg: '#fee2e2', icon: '❌' },
                { label: 'Total Users', value: stats.users, color: '#7c3aed', bg: '#ede9fe', icon: '👥' },
                { label: 'Inactive', value: stats.inactive, color: '#dc2626', bg: '#fee2e2', icon: '⛔' },
                { label: 'Admins', value: stats.admins, color: '#0f766e', bg: '#ccfbf1', icon: '🛡️' },
              ].map(s => (
                <div key={s.label} style={{ ...S.statCard, background: s.bg }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{
                    ...S.statVal,
                    color: s.color,
                    fontSize: typeof s.value === 'string' && String(s.value).length > 10 ? 20 : 32,
                  }}>{s.value}</div>
                  <div style={{ ...S.statLabel, color: s.color + 'aa' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Recent listings */}
            <div style={S.tableCard}>
              <div style={S.tableHeader}>
                <div style={S.tableTitle}>Recent Listings</div>
                <button style={S.viewAllBtn} onClick={() => setTab('Listings')}>View all →</button>
              </div>
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    <th style={S.th}>Listing</th>
                    <th style={S.th}>Price</th>
                    <th style={S.th}>City</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Featured</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.slice(0, 8).map(l => (
                    <tr key={l.id} className="row-hover" style={S.tr}>
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={S.thumbBox}>
                            {l.images?.[0]
                              ? <img src={l.images[0]} alt="" style={S.thumbImg} />
                              : <span style={{ fontSize: 16 }}>📦</span>}
                          </div>
                          <div>
                            <div style={S.listingTitle}>{l.title}</div>
                            <div style={S.listingMeta}>{l.category}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...S.td, fontWeight: 700, color: '#1a7a4a', fontSize: 13 }}>
                        MWK {Number(l.price || 0).toLocaleString()}
                      </td>
                      <td style={S.td}><span style={S.cityBadge}>{l.city}</span></td>
                      <td style={S.td}><StatusBadge status={l.status} /></td>
                      <td style={S.td}>
                        {l.is_featured
                          ? <span style={{ ...S.badge, background: '#fef3c7', color: '#b45309' }}>⭐ Yes</span>
                          : <span style={{ color: '#ccc', fontSize: 13 }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ TAB: FEATURED ══ */}
        {tab === 'Featured' && (
          <div style={S.content}>
            {/* Phase 5.1 — Featured analytics (same stat card language as Dashboard) */}
            <div style={S.statsGrid}>
              {[
                {
                  label: 'Feature revenue',
                  value: `MWK ${Number(featuredAnalytics.revenue || 0).toLocaleString()}`,
                  color: '#1a7a4a',
                  bg: '#e6f4ec',
                  icon: '💰',
                  sub: `${featuredAnalytics.paidActivations} paid activations`,
                },
                {
                  label: 'Active featured',
                  value: featuredAnalytics.activeCount,
                  color: '#b45309',
                  bg: '#fef3c7',
                  icon: '⭐',
                  sub: `${featuredAnalytics.paidActive} paid · ${featuredAnalytics.freeActive} free`,
                },
                {
                  label: 'Expiring soon',
                  value: featuredAnalytics.expiringSoon,
                  color: '#c2410c',
                  bg: '#ffedd5',
                  icon: '⏳',
                  sub: `${featuredAnalytics.expiringWeek} within 7 days`,
                },
                {
                  label: 'Free vs paid (active)',
                  value: `${featuredAnalytics.freeActive} / ${featuredAnalytics.paidActive}`,
                  color: '#7c3aed',
                  bg: '#ede9fe',
                  icon: '🆓',
                  sub: `${featuredAnalytics.freeAllTime} free all-time`,
                },
                {
                  label: 'Failed activations',
                  value: featuredAnalytics.failedActivations,
                  color: '#dc2626',
                  bg: '#fee2e2',
                  icon: '❌',
                  sub: `${featuredAnalytics.pendingPaid} paid still pending`,
                },
                {
                  label: 'Available to feature',
                  value: unfeaturedListings.length,
                  color: '#0f766e',
                  bg: '#ccfbf1',
                  icon: '➕',
                  sub: 'Live listings not featured',
                },
              ].map(s => (
                <div key={s.label} style={{ ...S.statCard, background: s.bg }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ ...S.statVal, color: s.color, fontSize: typeof s.value === 'string' && s.value.length > 8 ? 22 : 32 }}>
                    {s.value}
                  </div>
                  <div style={{ ...S.statLabel, color: s.color + 'aa' }}>{s.label}</div>
                  {s.sub && (
                    <div style={{ fontSize: 11, fontWeight: 600, color: s.color + '99', marginTop: 6 }}>
                      {s.sub}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {featuredAnalytics.expiringList.length > 0 && (
              <div style={{ ...S.tableCard, marginBottom: 20 }}>
                <div style={S.tableHeader}>
                  <div style={S.tableTitle}>Expiring within 48 hours</div>
                  <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600 }}>
                    {featuredAnalytics.expiringSoon} listing{featuredAnalytics.expiringSoon === 1 ? '' : 's'}
                  </span>
                </div>
                <table style={S.table}>
                  <thead>
                    <tr style={S.thead}>
                      <th style={S.th}>Listing</th>
                      <th style={S.th}>Seller</th>
                      <th style={S.th}>Expires</th>
                      <th style={S.th}>Type</th>
                    </tr>
                  </thead>
                  <tbody>
                    {featuredAnalytics.expiringList.map(l => {
                      const end = l.featured_until || l.promoted_until || l.promo_expires_at
                      const isFree = !(Number(l.promo_price) > 0)
                      return (
                        <tr key={l.id} className="row-hover" style={S.tr}>
                          <td style={S.td}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <div style={S.thumbBox}>
                                {l.images?.[0]
                                  ? <img src={l.images[0]} alt="" style={S.thumbImg} />
                                  : <span style={{ fontSize: 16 }}>⭐</span>}
                              </div>
                              <div style={S.listingTitle}>{l.title}</div>
                            </div>
                          </td>
                          <td style={S.td}>
                            <span style={S.listingMeta}>{l.profiles?.full_name || '—'}</span>
                          </td>
                          <td style={{ ...S.td, fontWeight: 700, color: '#c2410c', fontSize: 12 }}>
                            {end ? new Date(end).toLocaleString() : '—'}
                          </td>
                          <td style={S.td}>
                            <span style={{
                              ...S.badge,
                              background: isFree ? '#ede9fe' : '#e6f4ec',
                              color: isFree ? '#7c3aed' : '#1a7a4a',
                            }}>
                              {isFree ? 'Free' : `Paid · MWK ${Number(l.promo_price).toLocaleString()}`}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: '#fff', border: '1px solid #e8f0ec', borderRadius: 14,
              padding: '16px 20px', marginBottom: 20,
            }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#111' }}>Free First Featured Listing</div>
                <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                  {freeFeaturedEnabled
                    ? 'New sellers get their first featured listing for free.'
                    : 'The free first-feature perk is currently turned off for all sellers.'}
                </div>
              </div>
              <button
                onClick={toggleFreeFeatured}
                disabled={settingsLoading}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: freeFeaturedEnabled ? '#e6f4ec' : '#fee2e2',
                  color: freeFeaturedEnabled ? '#1a7a4a' : '#dc2626',
                  border: 'none', borderRadius: 10, padding: '10px 18px',
                  fontSize: 13, fontWeight: 700, cursor: settingsLoading ? 'not-allowed' : 'pointer',
                  fontFamily: "'DM Sans', system-ui, sans-serif",
                }}
              >
                {settingsLoading ? <div style={S.miniSpinner} /> : (freeFeaturedEnabled ? '✓ Enabled — Turn Off' : '✕ Disabled — Turn On')}
              </button>
            </div>

            <SectionLabel icon="⭐" text={`Currently Featured (${featuredListings.length})`} />
            {featuredListings.length === 0
              ? <EmptyBox text="No featured listings yet." />
              : <div style={S.featGrid}>
                  {featuredListings.map(l => (
                    <FeatCard key={l.id} listing={l} featured toggling={toggling === l.id}
                      onToggle={() => toggleFeatured(l)} onView={() => navigate('/listing/' + l.id)} />
                  ))}
                </div>
            }

            <div style={{ marginTop: 28 }} />
            <SectionLabel icon="➕" text={`Available to Feature (${unfeaturedListings.length})`} />
            {unfeaturedListings.length === 0
              ? <EmptyBox text="All live (published/active) listings are already featured." />
              : <div style={S.featGrid}>
                  {unfeaturedListings.map(l => (
                    <FeatCard key={l.id} listing={l} featured={false} toggling={toggling === l.id}
                      onToggle={() => toggleFeatured(l)} onView={() => navigate('/listing/' + l.id)} />
                  ))}
                </div>
            }
          </div>
        )}

        {/* ══ TAB: LISTINGS ══ */}
        {tab === 'Listings' && (
          <div style={S.content}>
            <div style={S.tableCard}>
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    <th style={S.th}>Listing</th>
                    <th style={S.th}>Seller</th>
                    <th style={S.th}>Price</th>
                    <th style={S.th}>City</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredListings.map(l => (
                    <tr key={l.id} className="row-hover" style={S.tr}>
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={S.thumbBox}>
                            {l.images?.[0]
                              ? <img src={l.images[0]} alt="" style={S.thumbImg} />
                              : <span style={{ fontSize: 16 }}>📦</span>}
                          </div>
                          <div>
                            <div style={S.listingTitle}>{l.title}</div>
                            <div style={S.listingMeta}>{l.category}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...S.td, fontSize: 13, color: '#555' }}>
                        {l.profiles?.full_name || '—'}
                      </td>
                      <td style={{ ...S.td, fontWeight: 700, color: '#1a7a4a', fontSize: 13 }}>
                        MWK {Number(l.price || 0).toLocaleString()}
                      </td>
                      <td style={S.td}><span style={S.cityBadge}>{l.city}</span></td>
                      <td style={S.td}><StatusBadge status={l.status} /></td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <ActionBtn
                            title={l.is_featured ? 'Unfeature' : 'Feature'}
                            bg={l.is_featured ? '#fef3c7' : '#f3f4f6'}
                            color={l.is_featured ? '#b45309' : '#aaa'}
                            disabled={toggling === l.id}
                            onClick={() => toggleFeatured(l)}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24"
                              fill={l.is_featured ? '#b45309' : 'none'}
                              stroke="currentColor" strokeWidth="2.2">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                          </ActionBtn>
                          <ActionBtn
                            title={l.status === 'active' ? 'Deactivate' : 'Activate'}
                            bg={l.status === 'active' ? '#e6f4ec' : '#fee2e2'}
                            color={l.status === 'active' ? '#1a7a4a' : '#dc2626'}
                            onClick={() => toggleStatus(l)}
                          >
                            {l.status === 'active'
                              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            }
                          </ActionBtn>
                          <ActionBtn
                            title="Delete"
                            bg="#fee2e2" color="#dc2626"
                            onClick={() => deleteListing(l.id)}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            </svg>
                          </ActionBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredListings.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                      No listings match your search.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ TAB: USERS ══ */}
        {tab === 'Verifications' && (
  <div style={S.content}>
    {/* Sub-nav: requests vs verified seller management */}
    <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
      <button
        type="button"
        onClick={() => setVerificationView('requests')}
        style={{
          padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 800, fontFamily: 'inherit',
          background: verificationView === 'requests' ? '#1a7a4a' : '#fff',
          color: verificationView === 'requests' ? '#fff' : '#555',
          boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
          borderWidth: 1, borderStyle: 'solid', borderColor: verificationView === 'requests' ? '#1a7a4a' : '#e8f0ec',
        }}
      >
        Requests & payments
        {verificationBadgeCount > 0 && (
          <span style={{
            marginLeft: 8,
            background: verificationView === 'requests' ? 'rgba(255,255,255,0.25)' : '#fee2e2',
            color: verificationView === 'requests' ? '#fff' : '#b91c1c',
            fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 999,
          }}>
            {verificationBadgeCount}
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => setVerificationView('sellers')}
        style={{
          padding: '8px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 800, fontFamily: 'inherit',
          background: verificationView === 'sellers' ? '#1a7a4a' : '#fff',
          color: verificationView === 'sellers' ? '#fff' : '#555',
          boxShadow: '0 1px 0 rgba(0,0,0,0.04)',
          borderWidth: 1, borderStyle: 'solid', borderColor: verificationView === 'sellers' ? '#1a7a4a' : '#e8f0ec',
        }}
      >
        Manage verified sellers
      </button>
    </div>

    {verificationView === 'sellers' && (
      <AdminVerifiedSellers
        adminName={adminName}
        onToast={showToast}
        onOpenRequest={(id) => {
          setVerificationView('requests')
          setSelectedVerificationId(id)
        }}
      />
    )}

    {verificationView === 'requests' && (
    <>
    <AdminVerificationHub
      verifications={verifications}
      paymentByRequest={paymentByRequest}
      selectedId={selectedVerificationId}
      adminName={adminName}
      verifyLoading={verifyLoading}
      paymentLoading={paymentLoading}
      onSelect={(id) => setSelectedVerificationId(id)}
      onRefresh={() => loadVerifications()}
      onOpenSettings={() => setTab('Verify Settings')}
      onOpenSellers={() => setVerificationView('sellers')}
      onConfirmPayment={(id) => handleConfirmPayment(id)}
      onRejectPayment={(id) => handleRejectPayment(id)}
      onQuickApprove={(id) => handleVerify(id, 'approved')}
      onQuickNeedInfo={(id) => {
        const note = window.prompt('What additional info do you need?') || ''
        if (!note) return
        handleVerify(id, 'additional_info_required', note)
      }}
      onQuickReject={(id) => {
        const note = window.prompt('Rejection reason:') || ''
        if (!note.trim()) {
          showToast('Rejection reason is required')
          return
        }
        handleVerify(id, 'rejected', note)
      }}
    />

    {selectedVerificationId && (
      <AdminVerificationDetail
        requestId={selectedVerificationId}
        adminName={adminName}
        adminId={adminUserId}
        onClose={() => {
          setSelectedVerificationId(null)
          if (searchParams.get('request')) {
            const next = new URLSearchParams(searchParams)
            next.delete('request')
            setSearchParams(next, { replace: true })
          }
        }}
        onUpdated={() => {
          loadVerifications()
        }}
      />
    )}
    </>
    )}
  </div>
)}

{tab === 'Verify Settings' && (
  <AdminVerificationSettings
    adminName={adminName}
    onToast={showToast}
  />
)}

{tab === 'Shop Reports' && (
  <div style={S.content}>
    <div style={S.tableCard}>
      <div style={S.tableHeader}>
        <div style={S.tableTitle}>Shop Reports</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all','pending','reviewed','dismissed'].map(f => (
            <button key={f} onClick={() => setReportFilter(f)} style={{
              padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700,
              background: reportFilter === f ? '#1a7a4a' : '#f0f5f2',
              color: reportFilter === f ? '#fff' : '#555',
            }}>{f}</button>
          ))}
        </div>
      </div>
      {shopReports
        .filter(r => reportFilter === 'all' || r.status === reportFilter)
        .map(r => (
        <div key={r.id} style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 20px', borderBottom: '1px solid #f0f5f2',
        }}>
          {/* Shop avatar */}
          <div style={{ ...S.userAvatar, flexShrink: 0, borderRadius: 10 }}>
            {r.shops?.logo_url
              ? <img src={r.shops.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
              : (r.shops?.name || '?')[0].toUpperCase()
            }
          </div>
          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
              {r.shops?.name || 'Unknown shop'}
            </div>
            <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2, fontWeight: 700, textTransform: 'capitalize' }}>
              🚩 {r.reason?.replace(/_/g, ' ')}
            </div>
            {r.details && (
              <div style={{ fontSize: 11.5, color: '#555', marginTop: 3, maxWidth: 480 }}>{r.details}</div>
            )}
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
              Reported: {new Date(r.created_at).toLocaleString()}
            </div>
            {r.admin_note && (
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>Note: {r.admin_note}</div>
            )}
          </div>
          {/* Status + actions */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <StatusBadge status={r.status === 'pending' ? 'inactive' : r.status === 'reviewed' ? 'active' : 'sold'} />
            {r.shops?.slug && (
              <button
                onClick={() => navigate('/shop/' + r.shops.slug)}
                style={{ fontSize: 11, fontWeight: 700, color: '#1a7a4a', background: 'none', border: 'none', cursor: 'pointer' }}
              >View shop →</button>
            )}
            {r.status === 'pending' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  disabled={reportActionLoading === r.id}
                  onClick={() => handleReportAction(r.id, 'reviewed')}
                  style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: '#e6f4ec', color: '#1a7a4a' }}
                >
                  {reportActionLoading === r.id ? '…' : '✓ Mark Reviewed'}
                </button>
                <button
                  disabled={reportActionLoading === r.id}
                  onClick={() => handleReportAction(r.id, 'dismissed')}
                  style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: '#fee2e2', color: '#dc2626' }}
                >
                  ✕ Dismiss
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
      {shopReports.filter(r => reportFilter === 'all' || r.status === reportFilter).length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 13 }}>No reports.</div>
      )}
    </div>
  </div>
)}

{tab === 'Broadcast' && (() => {
  const filtered = getBroadcastFiltered()
  const allSelected = filtered.length > 0 && filtered.every(u => selectedUsers.includes(u.id))
  const cities = [...new Set(users.map(u => u.city).filter(Boolean))].sort()

  return (
    <div style={S.content}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── Left: Compose ── */}
        <div style={{ ...S.tableCard, padding: 24, flex: '1 1 340px' }}>
          <div style={S.tableTitle}>📣 Compose Message</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, marginBottom: 20 }}>
            {selectedUsers.length === 0
              ? 'No users selected yet'
              : <span style={{ color: '#1a7a4a', fontWeight: 700 }}>{selectedUsers.length} user(s) selected</span>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>Subject</label>
            <input
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e8e2', fontSize: 13, fontFamily: "'DM Sans', system-ui, sans-serif", outline: 'none', boxSizing: 'border-box', display: 'block' }}
              placeholder="e.g. Important update about SokoMW"
              value={broadcastSubject}
              onChange={e => setBroadcastSubject(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>Message</label>
            <textarea
              rows={8}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e8e2', fontSize: 13, fontFamily: "'DM Sans', system-ui, sans-serif", outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6, display: 'block' }}
              placeholder="Write your message here…"
              value={broadcastMessage}
              onChange={e => setBroadcastMessage(e.target.value)}
            />
          </div>

          {broadcastResult && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600,
              background: broadcastResult.success ? '#e6f4ec' : '#fee2e2',
              color: broadcastResult.success ? '#1a7a4a' : '#dc2626',
            }}>
              {broadcastResult.success ? `✅ Sent to ${broadcastResult.sent} users` : `❌ ${broadcastResult.error}`}
            </div>
          )}

          <button
            disabled={broadcasting || selectedUsers.length === 0}
            onClick={handleBroadcast}
            style={{
              background: broadcasting || selectedUsers.length === 0 ? '#9ca3af' : '#1a7a4a',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '12px 24px', fontSize: 14, fontWeight: 700,
              cursor: broadcasting || selectedUsers.length === 0 ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans', system-ui, sans-serif",
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center',
            }}
          >
            {broadcasting ? <><div style={S.miniSpinner} /> Sending…</> : `📣 Send to ${selectedUsers.length || 0} User(s)`}
          </button>
        </div>

        {/* ── Right: User selector ── */}
        <div style={{ ...S.tableCard, flex: '1 1 340px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8f0ec', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              style={{ background: '#f4f7f5', border: '1px solid #e0e8e2', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontFamily: "'DM Sans', system-ui, sans-serif", cursor: 'pointer' }}
              value={broadcastFilter.role}
              onChange={e => { setBroadcastFilter(f => ({ ...f, role: e.target.value })); setSelectedUsers([]) }}
            >
              <option value="all">All roles</option>
              <option value="user">Users only</option>
              <option value="admin">Admins only</option>
            </select>

            <select
              style={{ background: '#f4f7f5', border: '1px solid #e0e8e2', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontFamily: "'DM Sans', system-ui, sans-serif", cursor: 'pointer' }}
              value={broadcastFilter.city}
              onChange={e => { setBroadcastFilter(f => ({ ...f, city: e.target.value })); setSelectedUsers([]) }}
            >
              <option value="">All cities</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>{filtered.length} user(s) found</span>
          </div>

          <div style={{ padding: '10px 20px', borderBottom: '1px solid #f0f5f2', display: 'flex', alignItems: 'center', gap: 10, background: '#f9fbfa' }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#1a7a4a' }}
            />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>
              {allSelected ? 'Deselect all' : `Select all ${filtered.length}`}
            </span>
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 13 }}>No users match filter.</div>
            )}
            {filtered.map(u => (
              <div
                key={u.id}
                onClick={() => toggleSelectUser(u.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 20px', borderBottom: '1px solid #f0f5f2',
                  cursor: 'pointer',
                  background: selectedUsers.includes(u.id) ? '#f0faf4' : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(u.id)}
                  onChange={() => toggleSelectUser(u.id)}
                  onClick={e => e.stopPropagation()}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#1a7a4a', flexShrink: 0 }}
                />
                <div style={S.userAvatar}>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : (u.full_name || 'U')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {u.full_name || 'No name'}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                    {u.city || 'No city'} · {u.role || 'user'}
                  </div>
                </div>
                {selectedUsers.includes(u.id) && <span style={{ fontSize: 11, fontWeight: 700, color: '#1a7a4a' }}>✓</span>}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
})()}

{tab === 'Users' && (
          <div style={S.content}>
            <div style={S.tableCard}>
              <div style={S.tableHeader}>
                <div style={S.tableTitle}>All Users</div>
                <div style={{ ...S.badge, background: '#ede9fe', color: '#7c3aed' }}>
                  {stats.admins} admin{stats.admins !== 1 ? 's' : ''}
                </div>
              </div>
              {users.map(u => (
                <div key={u.id} className="row-hover" style={S.userRow}>
                  <div style={S.userAvatar}>
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : (u.full_name || u.id || 'U')[0].toUpperCase()
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={S.userName}>{u.full_name || 'No name'}</div>
                      {u.is_disabled && (
                        <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: '#fee2e2', color: '#dc2626' }}>DISABLED</span>
                      )}
                    </div>
                    <div style={S.userMeta}>{u.city || 'No city'}</div>
                  </div>
                  <span style={{
                    ...S.badge,
                    background: u.role === 'admin' ? '#fef3c7' : '#f3f4f6',
                    color: u.role === 'admin' ? '#b45309' : '#888',
                  }}>
                    {u.role === 'admin' ? '⭐ Admin' : 'User'}
                  </span>
                  <button
                    style={{
                      ...S.roleBtn,
                      background: u.role === 'admin' ? '#fee2e2' : '#e6f4ec',
                      color: u.role === 'admin' ? '#dc2626' : '#1a7a4a',
                    }}
                    onClick={() => toggleRole(u)}
                  >
                    {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                  </button>
                  <button
                    style={{
                      ...S.roleBtn,
                      background: u.is_disabled ? '#fef3c7' : '#fee2e2',
                      color: u.is_disabled ? '#b45309' : '#dc2626',
                    }}
                    onClick={() => toggleAccess(u)}
                  >
                    {u.is_disabled ? '✓ Restore access' : '🚫 Disable access'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    active: { bg: '#e6f4ec', color: '#1a7a4a' },
    inactive: { bg: '#fee2e2', color: '#dc2626' },
    sold: { bg: '#ede9fe', color: '#7c3aed' },
  }
  const s = map[status] || { bg: '#f3f4f6', color: '#888' }
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color }}>{status}</span>
}

function SectionLabel({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.6 }}>
      {icon} {text}
    </div>
  )
}

function EmptyBox({ text }) {
  return (
    <div style={{ background: '#fff', border: '1.5px dashed #dde8e2', borderRadius: 14, padding: 24, textAlign: 'center', fontSize: 13, color: '#aaa' }}>
      {text}
    </div>
  )
}

function timeRemaining(expiresAt) {
  if (!expiresAt) return null
  const diffMs = new Date(expiresAt).getTime() - Date.now()
  if (diffMs <= 0) return { label: 'Expired', urgent: true }

  const days = Math.floor(diffMs / 86400000)
  const hours = Math.floor((diffMs % 86400000) / 3600000)

  if (days >= 1) {
    return { label: `${days}d ${hours}h left`, urgent: days < 2 }
  }
  const mins = Math.floor((diffMs % 3600000) / 60000)
  if (hours >= 1) {
    return { label: `${hours}h ${mins}m left`, urgent: true }
  }
  return { label: `${mins}m left`, urgent: true }
}

function FeatCard({ listing, featured, toggling, onToggle, onView }) {
  const remaining = featured ? timeRemaining(listing.promoted_until || listing.promo_expires_at) : null
  return (
    <div className="feat-card" style={S.featCard}>
      <div style={{ position: 'relative', height: 120, background: '#f0f5f1', cursor: 'pointer' }} onClick={onView}>
        {listing.images?.[0]
          ? <img src={listing.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>📦</div>
        }
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)' }} />
        <div style={{ position: 'absolute', bottom: 8, left: 10, fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>
          MWK {Number(listing.price || 0).toLocaleString()}
        </div>
        {featured && (
          <div style={{
            position: 'absolute', top: 8, right: 8,
            background: listing.promo_price ? 'rgba(180,83,9,0.92)' : 'rgba(26,122,74,0.9)',
            color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 20, padding: '3px 9px',
          }}>
            {listing.promo_price ? `MWK ${Number(listing.promo_price).toLocaleString()}` : 'FREE'}
          </div>
        )}
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{listing.title}</div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{listing.city} · {listing.category}</div>
        {featured && listing.promo_duration_days != null && (
          <div style={{ fontSize: 10.5, color: '#1a7a4a', marginTop: 4, fontWeight: 600 }}>
            {listing.promo_duration_days} day{listing.promo_duration_days !== 1 ? 's' : ''} featured
          </div>
        )}
        {featured && listing.promoted_until && (
          <div style={{ fontSize: 10.5, color: '#b45309', marginTop: 2, fontWeight: 600 }}>
            Expires {new Date(listing.promoted_until).toLocaleDateString()}
          </div>
        )}
        {remaining && (
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10.5, fontWeight: 700, marginTop: 6,
            padding: '2px 8px', borderRadius: 20,
            background: remaining.urgent ? '#fee2e2' : '#e6f4ec',
            color: remaining.urgent ? '#dc2626' : '#1a7a4a',
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {remaining.label}
          </div>
        )}
      </div>
      <div style={{ padding: '0 12px 12px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          style={{ ...S.starBtn, background: featured ? '#f59e0b' : '#e8e8e8' }}
          onClick={onToggle}
          disabled={toggling}
          title={featured ? 'Remove from featured' : 'Add to featured'}
        >
          {toggling
            ? <div style={S.miniSpinner} />
            : <svg width="14" height="14" viewBox="0 0 24 24"
                fill={featured ? '#fff' : 'none'}
                stroke={featured ? '#fff' : '#999'} strokeWidth="2.2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
          }
        </button>
      </div>
    </div>
  )
}

function ActionBtn({ children, bg, color, onClick, disabled, title }) {
  return (
    <button
      className="act-btn"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.15s' }}
    >
      {children}
    </button>
  )
}

// ── Styles ───────────────────────────────────────────────
const S = {
  shell:       { display: 'flex', minHeight: '100vh', background: '#f4f7f5', fontFamily: "'DM Sans', system-ui, sans-serif" },
  loadWrap:    { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f4f7f5' },
  spinner:     { width: 30, height: 30, border: '3px solid #e0ebe3', borderTopColor: '#1a7a4a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  miniSpinner: { width: 13, height: 13, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },

  // Sidebar
  sidebar:       { width: 240, background: '#0f1f16', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100vh', flexShrink: 0, position: 'sticky', top: 0 },
  sidebarTop:    { padding: '24px 16px 16px' },
  sidebarBottom: { padding: '16px' },
  brand:         { display: 'flex', alignItems: 'center', gap: 12 },
  brandIcon:     { width: 38, height: 38, background: '#1a7a4a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  brandName:     { fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' },
  brandBadge:    { fontSize: 9, fontWeight: 700, color: '#5de89e', letterSpacing: 1, marginTop: 1 },
  navLabel:      { fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: 1.2, marginBottom: 6, paddingLeft: 12 },
  navItem:       { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', background: 'none', color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: "'DM Sans', system-ui, sans-serif", marginBottom: 2 },
  navItemActive: { background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700 },
  navPill:       { marginLeft: 'auto', background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 },
  adminCard:     { display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 },
  adminAvatar:   { width: 34, height: 34, borderRadius: '50%', background: '#1a7a4a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 },
  adminName:     { fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  adminRole:     { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 },
  logoutBtn:     { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '9px', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', system-ui, sans-serif", transition: 'background 0.15s' },

  // Main
  main:     { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' },
  topbar:   { background: '#fff', borderBottom: '1px solid #e8f0ec', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 },
  topbarTitle: { fontSize: 18, fontWeight: 800, color: '#0f1410' },
  topbarSub:   { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  searchBar:   { display: 'flex', alignItems: 'center', gap: 8, background: '#f4f7f5', border: '1px solid #e0e8e2', borderRadius: 10, padding: '8px 12px' },
  searchInput: { border: 'none', background: 'none', outline: 'none', fontSize: 13, color: '#111', width: 180, fontFamily: "'DM Sans', system-ui, sans-serif" },
  filterSelect: { border: 'none', background: 'none', fontSize: 12, color: '#555', cursor: 'pointer', fontFamily: "'DM Sans', system-ui, sans-serif" },
  content:  { padding: 24, animation: 'fadeUp 0.25s ease', overflowY: 'auto' },

  // Stats
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 },
  statCard:  { borderRadius: 14, padding: '20px', animation: 'fadeUp 0.3s ease both' },
  statVal:   { fontSize: 32, fontWeight: 900, lineHeight: 1 },
  statLabel: { fontSize: 12, fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Table
  tableCard:   { background: '#fff', borderRadius: 16, border: '1px solid #e8f0ec', overflow: 'hidden' },
  tableHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e8f0ec' },
  tableTitle:  { fontSize: 14, fontWeight: 800, color: '#111' },
  viewAllBtn:  { background: '#e6f4ec', color: '#1a7a4a', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', system-ui, sans-serif" },
  table:       { width: '100%', borderCollapse: 'collapse' },
  thead:       { background: '#f9fbfa' },
  th:          { padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: '1px solid #e8f0ec' },
  tr:          { transition: 'background 0.1s' },
  td:          { padding: '12px 16px', fontSize: 13, color: '#111', borderBottom: '1px solid #f0f5f2', verticalAlign: 'middle' },
  thumbBox:    { width: 38, height: 38, borderRadius: 8, background: '#f0f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  thumbImg:    { width: '100%', height: '100%', objectFit: 'cover' },
  listingTitle: { fontSize: 13, fontWeight: 700, color: '#111' },
  listingMeta:  { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  cityBadge:   { background: '#f3f4f6', color: '#555', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20 },
  badge:       { display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20 },

  // Users
  userRow:    { display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: '1px solid #f0f5f2', transition: 'background 0.1s' },
  userAvatar: { width: 40, height: 40, borderRadius: '50%', background: '#e6f4ec', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a7a4a', fontSize: 15, fontWeight: 800, flexShrink: 0, overflow: 'hidden' },
  userName:   { fontSize: 13, fontWeight: 700, color: '#111' },
  userMeta:   { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  roleBtn:    { fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 9, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'DM Sans', system-ui, sans-serif" },

  // Featured
  featGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 },
  featCard: { background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e8f0ec', transition: 'transform 0.18s, box-shadow 0.18s' },
  starBtn:  { width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' },

  // Toast
  toast: { position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#0f1f16', color: '#5de89e', fontSize: 13, fontWeight: 700, padding: '11px 22px', borderRadius: 30, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', animation: 'fadeUp 0.25s ease', whiteSpace: 'nowrap', pointerEvents: 'none' },
}