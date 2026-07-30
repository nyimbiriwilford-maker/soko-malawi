import { useEffect, useState, useRef, useMemo } from 'react'
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { uploadToR2, getR2Url, deleteFromR2 } from '../lib/r2'
import { isListingFeatured } from '../utils/homeUtils'
import { featureExistingListing } from '../lib/featureListing'
import { featuredPriceLabel, FEATURED_DURATION_DAYS } from '../constants/featuredPricing'
import VouchSection from '../components/VouchSection'
import TrustBadge from '../components/TrustBadge'
import StatusPicker from '../components/StatusPicker'
import { useStatuses } from '../hooks/useStatuses'
import { useVouchData } from '../hooks/useVouchData'
import useProfileDashboard, {
  syncProfileCompletion,
  recordListingShare,
  blockUser,
  bulkListingStatus,
  bulkListingDelete,
  followSeller,
  parseDeviceFromUserAgent,
} from '../hooks/useProfileDashboard'
import VerificationModal from '../components/VerificationModal'
import SellerVerificationBanner from '../components/SellerVerificationBanner'
import PendingVerificationCard from '../components/PendingVerificationCard'
import {
  MpIcon,
  Badge,
  Chip,
  IconButton,
  SectionHeader as DsSectionHeader,
  StatCard,
  ActionCard,
  EmptyState as DsEmptyState,
  Timeline as DsTimeline,
  SkeletonLoader,
  sellerLevelIcon,
} from '../components/profile/ProfileUI'

/* ═══════════════════════════════════════════════════════════════════════════
   SokoMW Profile — premium marketplace seller dashboard (buyer + seller)

   UI-only redesign. All data, routes, hooks, and handlers are preserved.
   Layout: sticky vertical nav (desktop) · bottom section nav (mobile) · detail.

   Function map for maintainers (search by name; full guide in docs/PROFILE_PAGE.md):
   Top-level: VerifiedSeal · profileCompleteness · getOnlineStatus · NetworkTab
   NetworkTab: flash · removeFollower · unfollow · messageUser · inviteToShop ·
     blockPerson · followSuggested · timeAgo · durationLabel · normalize
   Overview UI: SectionHeader · AnalyticsCard · QuickActionCard · InsightCard ·
     EmptyState · ActivityTimeline · OverviewSkeleton
   Profile(): openGroup · isNavActive · profilePublicUrl · shareProfile ·
     copyProfileLink · init · loadProfile · loadListings · loadNetworkCounts ·
     loadShop · saveProfile · uploadAvatar · uploadCover · removeCover ·
     toggleSold · deleteListing · shareListing · bulkMarkSold · bulkRelist ·
     bulkDeleteSelected · featureListing · bulkBoostSelected · ensureSaleOrder ·
     showSaleInvoice · downloadSaleReceipt · cycleDeliveryStatus ·
     showBuyerReviews · setInventoryStatus · toggleInvSelect ·
     toggleSelectAllInventory · signOut · confirmSignOut · handleRevokeSession ·
     openFeatureChoice · chooseFeatureNewListing · chooseFeatureExisting ·
     timeAgoShort · handleNextCompleteness · buyerBadge
   ═══════════════════════════════════════════════════════════════════════════ */

const CITIES = [
  'Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Kasungu',
  'Mangochi', 'Karonga', 'Salima', 'Other',
]

const VerifiedSeal = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#16a34a" d="M12 0a4 4 0 0 1 3.2 1.6 4 4 0 0 1 3.6 1 4 4 0 0 1 1 3.6A4 4 0 0 1 21.4 9.4a4 4 0 0 1 0 5.2A4 4 0 0 1 19.8 17.8a4 4 0 0 1-1 3.6 4 4 0 0 1-3.6 1A4 4 0 0 1 12 24a4 4 0 0 1-3.2-1.6 4 4 0 0 1-3.6-1 4 4 0 0 1-1-3.6A4 4 0 0 1 2.6 14.6a4 4 0 0 1 0-5.2A4 4 0 0 1 4.2 6.2a4 4 0 0 1 1-3.6 4 4 0 0 1 3.6-1A4 4 0 0 1 12 0Z" />
    <path d="m7.5 12.5 3 3 6-7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function profileCompleteness(profile, user) {
  const checks = [
    { key: 'name', ok: !!(profile.full_name && profile.full_name.trim().length > 1), label: 'Full name', tip: 'Add your real name so buyers trust you' },
    { key: 'photo', ok: !!profile.avatar_url, label: 'Profile photo', tip: 'Add a clear photo of yourself' },
    { key: 'city', ok: !!profile.city, label: 'City / district', tip: 'Set your city so nearby buyers find you' },
    { key: 'phone', ok: !!(profile.phone && String(profile.phone).trim().length >= 7), label: 'Phone number', tip: 'Add a phone so buyers can call you' },
    { key: 'verified', ok: !!profile.is_verified, label: 'Identity verified', tip: 'Get verified to sell faster' },
    { key: 'email', ok: !!(user?.email || profile.email), label: 'Email on file', tip: 'Confirm your email' },
  ]
  const done = checks.filter(c => c.ok).length
  const next = checks.find(c => !c.ok) || null
  return { checks, done, total: checks.length, pct: Math.round((done / checks.length) * 100), next }
}

function getOnlineStatus(lastSeen) {
  if (!lastSeen) return null
  const mins = Math.floor((Date.now() - new Date(lastSeen).getTime()) / 60000)
  if (mins < 5) return { label: 'Online now', color: '#15803d' }
  if (mins < 60) return { label: `Active ${mins}m ago`, color: '#d97706' }
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return { label: `Active ${hrs}h ago`, color: '#9ca3af' }
  return { label: 'Offline', color: '#9ca3af' }
}

// ─── NetworkTab — Phase 10 relationship dashboard (live follows + suggestions) ─
function NetworkTab({ sellerId, userId, suggestions = [], onFollowSuggestion, shopId = null }) {
  const [followers, setFollowers] = useState([])
  const [following, setFollowing] = useState([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState(null)
  const [netTab, setNetTab] = useState('followers') // followers | following
  const [netSearch, setNetSearch] = useState('')
  const [netSort, setNetSort] = useState('newest') // newest | oldest | verified | mutual
  const [netFilter, setNetFilter] = useState('all') // all | verified | mutual
  const [feedback, setFeedback] = useState('')
  const [actionBusy, setActionBusy] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!userId) return
    Promise.all([
      supabase.from('seller_follows')
        .select('id, follower_id, created_at, follower:profiles!seller_follows_follower_id_fkey(full_name, avatar_url, is_verified, city, last_seen)')
        .eq('seller_id', sellerId),
      supabase.from('seller_follows')
        .select('id, seller_id, created_at, seller:profiles!seller_follows_seller_id_fkey(full_name, avatar_url, is_verified, city, last_seen)')
        .eq('follower_id', userId),
    ]).then(([{ data: f }, { data: g }]) => {
      setFollowers(f || [])
      setFollowing(g || [])
      setLoading(false)
    })
  }, [userId, sellerId])

  const followerIds = new Set(followers.map(f => f.follower_id))
  const followingIds = new Set(following.map(f => f.seller_id))

  const flash = (msg) => {
    setFeedback(msg)
    setTimeout(() => setFeedback(''), 2200)
  }

  const removeFollower = async (id, name) => {
    if (!window.confirm(`Remove ${name || 'this follower'}? They will no longer follow you.`)) return
    setRemoving(id)
    await supabase.from('seller_follows').delete().eq('id', id)
    setFollowers(p => p.filter(f => f.id !== id))
    setRemoving(null)
    flash('Follower removed')
  }

  const unfollow = async (id, name) => {
    if (!window.confirm(`Unfollow ${name || 'this seller'}?`)) return
    setRemoving(id)
    await supabase.from('seller_follows').delete().eq('id', id)
    setFollowing(p => p.filter(f => f.id !== id))
    setRemoving(null)
    flash('Unfollowed')
  }

  const messageUser = (personId) => {
    if (!personId) return
    navigate(`/chats?with=${personId}`)
  }

  const inviteToShop = async (personId, name) => {
    if (!personId || !shopId) {
      flash(shopId ? 'Could not invite' : 'Create a shop first to invite members')
      return
    }
    setActionBusy(`invite-${personId}`)
    try {
      const { error } = await supabase.from('shop_invites').insert({
        shop_id: shopId,
        inviter_id: userId,
        invitee_id: personId,
        status: 'pending',
        message: `Join my shop on SokoMw`,
      })
      if (error) throw error
      flash(`Invite sent to ${name || 'seller'}`)
    } catch (e) {
      flash(e.message || 'Invite failed — table may need migration')
    }
    setActionBusy(null)
  }

  const blockPerson = async (personId, name) => {
    if (!personId) return
    if (!window.confirm(`Block ${name || 'this user'}? They will be removed from your network.`)) return
    setActionBusy(`block-${personId}`)
    try {
      await blockUser(personId)
      setFollowers(p => p.filter(f => f.follower_id !== personId))
      setFollowing(p => p.filter(f => f.seller_id !== personId))
      flash(`${name || 'User'} blocked`)
    } catch (e) {
      flash(e.message || 'Block failed — run security migration')
    }
    setActionBusy(null)
  }

  const followSuggested = async (sid, name) => {
    if (!sid || !userId) return
    setActionBusy(`follow-${sid}`)
    try {
      if (onFollowSuggestion) await onFollowSuggestion(sid)
      else await followSeller(sid, userId)
      flash(`Following ${name || 'seller'}`)
    } catch (e) {
      flash(e.message || 'Could not follow')
    }
    setActionBusy(null)
  }

  const timeAgo = (ts) => {
    if (!ts) return ''
    const diff = Date.now() - new Date(ts).getTime()
    const d = Math.floor(diff / 86400000)
    const h = Math.floor(diff / 3600000)
    const m = Math.floor(diff / 60000)
    if (d > 0) return d === 1 ? '1 day ago' : `${d} days ago`
    if (h > 0) return h === 1 ? '1 hour ago' : `${h} hours ago`
    if (m > 0) return m === 1 ? '1 minute ago' : `${m} minutes ago`
    return 'Just now'
  }

  const durationLabel = (ts, mode) => {
    if (!ts) return mode === 'following' ? 'Following recently' : 'Followed recently'
    return mode === 'following'
      ? `Following since ${timeAgo(ts)}`
      : `Followed you ${timeAgo(ts)}`
  }

  const normalize = (row, mode) => {
    if (mode === 'followers') {
      const p = row.follower || {}
      const personId = row.follower_id
      return {
        id: row.id,
        personId,
        name: p.full_name || 'Unknown',
        avatar: p.avatar_url,
        verified: !!p.is_verified,
        city: p.city || null,
        lastSeen: p.last_seen || null,
        createdAt: row.created_at,
        isMutual: followingIds.has(personId),
        mode: 'followers',
      }
    }
    const p = row.seller || {}
    const personId = row.seller_id
    return {
      id: row.id,
      personId,
      name: p.full_name || 'Unknown',
      avatar: p.avatar_url,
      verified: !!p.is_verified,
      city: p.city || null,
      lastSeen: p.last_seen || null,
      createdAt: row.created_at,
      isMutual: followerIds.has(personId),
      mode: 'following',
    }
  }

  const sourceRows = netTab === 'followers' ? followers : following
  let list = sourceRows.map(r => normalize(r, netTab))
  const q = netSearch.trim().toLowerCase()
  if (q) {
    list = list.filter(r => `${r.name} ${r.city || ''}`.toLowerCase().includes(q))
  }
  if (netFilter === 'verified') list = list.filter(r => r.verified)
  if (netFilter === 'mutual') list = list.filter(r => r.isMutual)
  list = [...list].sort((a, b) => {
    if (netSort === 'oldest') {
      return new Date(a.createdAt || 0) - new Date(b.createdAt || 0)
    }
    if (netSort === 'verified') {
      if (a.verified !== b.verified) return a.verified ? -1 : 1
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    }
    if (netSort === 'mutual') {
      if (a.isMutual !== b.isMutual) return a.isMutual ? -1 : 1
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
    }
    return new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
  })

  let mutualCount = 0
  followers.forEach(f => { if (followingIds.has(f.follower_id)) mutualCount += 1 })

  if (loading) {
    return (
      <div className="mp-nd mp-nd-skel" aria-busy="true" aria-label="Loading network">
        <div className="mp-nd-stats">
          <div className="mp-nd-skel-card" />
          <div className="mp-nd-skel-card" />
          <div className="mp-nd-skel-card" />
        </div>
        <div className="mp-nd-skel-toolbar" />
        <div className="mp-nd-grid">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="mp-nd-skel-card mp-nd-skel-person" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mp-nd">
      {/* Stat cards */}
      <section className="mp-nd-stats" aria-label="Network statistics">
        <button
          type="button"
          className={`mp-nd-stat${netTab === 'followers' ? ' is-active' : ''}`}
          onClick={() => setNetTab('followers')}
        >
          <span className="mp-nd-stat-ic" aria-hidden="true"><MpIcon name="users" size={18} /></span>
          <strong className="mp-nd-stat-n">{followers.length}</strong>
          <span className="mp-nd-stat-l">Followers</span>
        </button>
        <button
          type="button"
          className={`mp-nd-stat${netTab === 'following' ? ' is-active' : ''}`}
          onClick={() => setNetTab('following')}
        >
          <span className="mp-nd-stat-ic" aria-hidden="true"><MpIcon name="link2" size={18} /></span>
          <strong className="mp-nd-stat-n">{following.length}</strong>
          <span className="mp-nd-stat-l">Following</span>
        </button>
        <div className="mp-nd-stat is-soft">
          <span className="mp-nd-stat-ic" aria-hidden="true"><MpIcon name="refreshCw" size={18} /></span>
          <strong className="mp-nd-stat-n">{mutualCount}</strong>
          <span className="mp-nd-stat-l">Mutual</span>
        </div>
      </section>

      {/* Primary tabs */}
      <div className="mp-nd-tabs" role="tablist" aria-label="Network lists">
        <button
          type="button"
          role="tab"
          aria-selected={netTab === 'followers'}
          className={`mp-nd-tab${netTab === 'followers' ? ' is-active' : ''}`}
          onClick={() => setNetTab('followers')}
        >
          Followers <em>{followers.length}</em>
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={netTab === 'following'}
          className={`mp-nd-tab${netTab === 'following' ? ' is-active' : ''}`}
          onClick={() => setNetTab('following')}
        >
          Following <em>{following.length}</em>
        </button>
      </div>

      {/* Sticky toolbar */}
      <div className="mp-nd-toolbar" role="search" aria-label="Network filters">
        <label className="mp-nd-search">
          <span className="mp-nd-search-ic" aria-hidden="true">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
            </svg>
          </span>
          <input
            type="search"
            className="mp-nd-search-input"
            placeholder={netTab === 'followers' ? 'Search followers…' : 'Search following…'}
            value={netSearch}
            onChange={e => setNetSearch(e.target.value)}
            aria-label="Search network"
          />
          {netSearch && (
            <button type="button" className="mp-nd-search-clear" onClick={() => setNetSearch('')} aria-label="Clear search">✕</button>
          )}
        </label>
        <label className="mp-nd-field">
          <span className="mp-nd-field-label">Sort</span>
          <select className="mp-nd-select" value={netSort} onChange={e => setNetSort(e.target.value)} aria-label="Sort network">
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="verified">Verified first</option>
            <option value="mutual">Mutual first</option>
          </select>
        </label>
        <label className="mp-nd-field">
          <span className="mp-nd-field-label">Filter</span>
          <select className="mp-nd-select" value={netFilter} onChange={e => setNetFilter(e.target.value)} aria-label="Filter network">
            <option value="all">All</option>
            <option value="verified">Verified only</option>
            <option value="mutual">Mutual only</option>
          </select>
        </label>
      </div>

      <div className="mp-nd-meta">
        <p className="mp-nd-count">
          {list.length} {netTab === 'followers' ? 'follower' : 'seller'}{list.length === 1 ? '' : 's'}
          {(netSearch || netFilter !== 'all') ? ' match your filters' : ''}
        </p>
      </div>

      {/* Cards */}
      <section className="mp-nd-list" aria-label={netTab === 'followers' ? 'Followers' : 'Following'}>
        {list.length === 0 ? (
          <div className="mp-nd-empty">
            <div className="mp-nd-empty-art" aria-hidden="true">
              <div className="mp-nd-empty-blob" />
              <span className="mp-nd-empty-emoji">
                <MpIcon
                  name={netSearch || netFilter !== 'all' ? 'search' : netTab === 'followers' ? 'sparkles' : 'link2'}
                  size={28}
                />
              </span>
            </div>
            <h3>
              {netSearch || netFilter !== 'all'
                ? 'No matches'
                : netTab === 'followers'
                  ? 'No followers yet'
                  : 'Not following anyone yet'}
            </h3>
            <p>
              {netSearch || netFilter !== 'all'
                ? 'Try another search or clear filters to see more people.'
                : netTab === 'followers'
                  ? 'Post regularly, complete your profile, and engage buyers to grow your audience.'
                  : 'Follow sellers you trust to see their updates and build mutual connections.'}
            </p>
            <div className="mp-nd-empty-actions">
              {(netSearch || netFilter !== 'all') && (
                <button
                  type="button"
                  className="mp-btn-secondary"
                  onClick={() => { setNetSearch(''); setNetFilter('all') }}
                >
                  Clear filters
                </button>
              )}
              <button type="button" className="mp-btn-primary" onClick={() => navigate('/shops')}>
                Discover sellers
              </button>
              {netTab === 'followers' && (
                <button type="button" className="mp-btn-secondary" onClick={() => navigate('/post')}>
                  Post a listing
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="mp-nd-grid">
            {list.map((person) => {
              const online = getOnlineStatus(person.lastSeen)
              const initials = (person.name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
              const busy = removing === person.id
              return (
                <article key={person.id} className={`mp-nd-card${person.isMutual ? ' is-mutual' : ''}`}>
                  <div className="mp-nd-card-top">
                    <button
                      type="button"
                      className="mp-nd-avatar-btn"
                      onClick={() => navigate('/profile/' + person.personId)}
                      aria-label={`View ${person.name}`}
                    >
                      <div className={`mp-nd-avatar mp-nd-avatar--${person.mode === 'followers' ? 'green' : 'amber'}`}>
                        {person.avatar
                          ? <img src={person.avatar} alt="" loading="lazy" />
                          : initials}
                      </div>
                      {online && (
                        <span
                          className={`mp-nd-online-dot${online.label === 'Online now' ? ' is-live' : ''}`}
                          title={online.label}
                          aria-label={online.label}
                        />
                      )}
                    </button>
                    <div className="mp-nd-card-id">
                      <div className="mp-nd-name-row">
                        <button
                          type="button"
                          className="mp-nd-name"
                          onClick={() => navigate('/profile/' + person.personId)}
                        >
                          {person.name}
                        </button>
                        {person.verified && <VerifiedSeal size={15} />}
                      </div>
                      <div className="mp-nd-card-meta">
                        {person.city && <span>{person.city}</span>}
                        {online && <span className="mp-nd-online-txt" style={{ color: online.color }}>{online.label}</span>}
                      </div>
                      <div className="mp-nd-pills">
                        {person.isMutual && <span className="mp-nd-pill is-mutual">Mutual</span>}
                        {person.verified && <span className="mp-nd-pill is-ok">Verified</span>}
                        <span className="mp-nd-pill is-soft">
                          {person.verified ? 'Trusted seller' : 'Seller'}
                        </span>
                        <span className="mp-nd-pill is-soft" title="Trust score coming soon">Trust —</span>
                      </div>
                      <p className="mp-nd-duration">{durationLabel(person.createdAt, person.mode)}</p>
                    </div>
                  </div>

                  <div className="mp-nd-card-actions" role="group" aria-label="Connection actions">
                    <button
                      type="button"
                      className="mp-nd-icon-btn is-primary"
                      title="View profile"
                      aria-label="View profile"
                      onClick={() => navigate('/profile/' + person.personId)}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
                      </svg>
                      <span className="mp-nd-icon-txt">View</span>
                    </button>
                    <button
                      type="button"
                      className="mp-nd-icon-btn is-danger"
                      title={person.mode === 'followers' ? 'Remove follower' : 'Unfollow'}
                      aria-label={person.mode === 'followers' ? 'Remove follower' : 'Unfollow'}
                      disabled={busy}
                      onClick={() => (
                        person.mode === 'followers'
                          ? removeFollower(person.id, person.name)
                          : unfollow(person.id, person.name)
                      )}
                    >
                      {busy ? (
                        <span className="mp-nd-btn-spin" aria-hidden="true" />
                      ) : (
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          {person.mode === 'followers'
                            ? <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="17" y1="8" x2="22" y2="13" /><line x1="22" y1="8" x2="17" y2="13" /></>
                            : <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="18" y1="8" x2="23" y2="13" /><line x1="23" y1="8" x2="18" y2="13" /></>}
                        </svg>
                      )}
                      <span className="mp-nd-icon-txt">
                        {busy ? '…' : person.mode === 'followers' ? 'Remove' : 'Unfollow'}
                      </span>
                    </button>
                    <span className="mp-nd-action-divider" aria-hidden="true" />
                    <button
                      type="button"
                      className="mp-nd-icon-btn"
                      title="Send message"
                      aria-label="Send message"
                      onClick={() => messageUser(person.personId)}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="mp-nd-icon-btn"
                      title={shopId ? 'Invite to shop' : 'Create a shop to invite'}
                      aria-label="Invite to shop"
                      disabled={actionBusy === `invite-${person.personId}`}
                      onClick={() => inviteToShop(person.personId, person.name)}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      className="mp-nd-icon-btn is-danger"
                      title="Block user"
                      aria-label="Block user"
                      disabled={actionBusy === `block-${person.personId}`}
                      onClick={() => blockPerson(person.personId, person.name)}
                    >
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" /><line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
                      </svg>
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      {/* People You May Know — live 2nd-degree suggestions */}
      <section className="mp-nd-suggest" aria-label="People you may know">
        <div className="mp-nd-suggest-head">
          <h3 className="mp-nd-suggest-title">People you may know</h3>
          <p className="mp-nd-suggest-sub">
            {suggestions.length
              ? 'Suggested from mutual connections in your network.'
              : 'Follow more sellers to unlock mutual-connection suggestions.'}
          </p>
        </div>
        <div className="mp-nd-suggest-grid">
          {suggestions.length === 0 ? (
            <div className="mp-nd-suggest-card">
              <div className="mp-nd-suggest-avatar" aria-hidden="true">
                <MpIcon name="users" size={20} />
              </div>
              <strong>No suggestions yet</strong>
              <span>Grow your network to see people you may know</span>
              <button type="button" className="mp-btn-secondary" onClick={() => navigate('/shops')}>
                Discover sellers
              </button>
            </div>
          ) : (
            suggestions.map((s) => {
              const sid = s.user_id
              const name = s.full_name || 'Seller'
              const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
              const busy = actionBusy === `follow-${sid}`
              return (
                <div key={sid} className="mp-nd-suggest-card">
                  <button
                    type="button"
                    className="mp-nd-suggest-avatar"
                    onClick={() => navigate('/profile/' + sid)}
                    aria-label={`View ${name}`}
                    style={{ border: 'none', cursor: 'pointer', overflow: 'hidden' }}
                  >
                    {s.avatar_url
                      ? <img src={s.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : initials}
                  </button>
                  <strong>{name}</strong>
                  <span>
                    {s.reason || (s.city ? s.city : 'Suggested seller')}
                    {s.is_verified ? ' · Verified' : ''}
                  </span>
                  <button
                    type="button"
                    className="mp-btn-secondary"
                    disabled={busy}
                    onClick={() => followSuggested(sid, name)}
                  >
                    {busy ? '…' : 'Follow'}
                  </button>
                </div>
              )
            })
          )}
        </div>
      </section>

      {feedback && (
        <div className="mp-nd-toast" role="status">{feedback}</div>
      )}
    </div>
  )
}

// ─── Overview dashboard primitives (UI-only, reusable) ─────────────────────────
function SectionHeader({ title, subtitle, action, actionLabel, onAction, className = '' }) {
  return (
    <div className={`mp-od-head ${className}`.trim()}>
      <div className="mp-od-head-text">
        <h3 className="mp-od-title">{title}</h3>
        {subtitle ? <p className="mp-od-sub">{subtitle}</p> : null}
      </div>
      {action || (actionLabel && onAction) ? (
        <div className="mp-od-head-action">
          {action || (
            <button type="button" className="mp-od-link" onClick={onAction}>
              {actionLabel}
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}

function AnalyticsCard({
  icon,
  label,
  value,
  hint,
  trend,
  trendUp,
  onClick,
  placeholder,
}) {
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`mp-od-stat mp-ds-stat${onClick ? ' is-clickable' : ''}${placeholder ? ' is-placeholder' : ''}`}
      onClick={onClick}
    >
      <div className="mp-od-stat-top">
        <span className="mp-od-stat-ic" aria-hidden="true">
          {typeof icon === 'string' ? <MpIcon name={icon} size={18} /> : icon}
        </span>
        {trend ? (
          <span className={`mp-od-stat-trend${trendUp === false ? ' is-down' : trendUp ? ' is-up' : ''}`}>
            {trend}
          </span>
        ) : null}
      </div>
      <strong className="mp-od-stat-value">{value}</strong>
      <span className="mp-od-stat-label">{label}</span>
      {hint ? <span className="mp-od-stat-hint">{hint}</span> : null}
    </Tag>
  )
}

function QuickActionCard({ icon, label, sub, onClick, accent }) {
  return (
    <button
      type="button"
      className={`mp-od-action mp-ds-action${accent ? ` mp-od-action--${accent}` : ''}`}
      onClick={onClick}
    >
      <span className="mp-od-action-ic" aria-hidden="true">
        {typeof icon === 'string' ? <MpIcon name={icon} size={20} /> : icon}
      </span>
      <span className="mp-od-action-copy">
        <span className="mp-od-action-label">{label}</span>
        {sub ? <span className="mp-od-action-sub">{sub}</span> : null}
      </span>
      <span className="mp-od-action-arrow" aria-hidden="true">
        <MpIcon name="chevronRight" size={16} />
      </span>
    </button>
  )
}

function InsightCard({ title, children, footer, className = '' }) {
  return (
    <div className={`mp-od-insight ${className}`.trim()}>
      <div className="mp-od-insight-label">{title}</div>
      <div className="mp-od-insight-body">{children}</div>
      {footer ? <div className="mp-od-insight-foot">{footer}</div> : null}
    </div>
  )
}

function EmptyState({ icon = '📭', title, text, actionLabel, onAction }) {
  return (
    <div className="mp-od-empty">
      <div className="mp-od-empty-ic" aria-hidden="true">{icon}</div>
      {title ? <h4 className="mp-od-empty-title">{title}</h4> : null}
      {text ? <p className="mp-od-empty-text">{text}</p> : null}
      {actionLabel && onAction ? (
        <button type="button" className="mp-btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  )
}

function ActivityTimeline({ items, empty, onItemClick, timeAgo }) {
  if (!items?.length) {
    return empty || (
      <EmptyState
        icon="🗂️"
        title="No activity yet"
        text="Post a listing or complete a sale to see activity here."
      />
    )
  }
  return (
    <ul className="mp-od-timeline">
      {items.map((item) => (
        <li key={item.id} className={`mp-od-tl-item mp-od-tl-item--${item.tone || 'default'}`}>
          <span className="mp-od-tl-dot" aria-hidden="true">
            {typeof item.icon === 'string' ? <MpIcon name={item.icon} size={14} /> : (item.icon || <MpIcon name="circle" size={12} />)}
          </span>
          {item.onClick || onItemClick ? (
            <button
              type="button"
              className="mp-od-tl-btn"
              onClick={() => (item.onClick ? item.onClick() : onItemClick?.(item))}
            >
              <span className="mp-od-tl-text">{item.text}</span>
              <span className="mp-od-tl-time">{item.whenLabel || (item.when && timeAgo ? `${timeAgo(item.when)} ago` : '')}</span>
            </button>
          ) : (
            <div className="mp-od-tl-static">
              <span className="mp-od-tl-text">{item.text}</span>
              <span className="mp-od-tl-time">{item.whenLabel || (item.when && timeAgo ? `${timeAgo(item.when)} ago` : '')}</span>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

function OverviewSkeleton() {
  return (
    <div className="mp-odash mp-odash-skel" aria-busy="true" aria-label="Loading dashboard">
      <div className="mp-od-skel mp-od-skel-welcome" />
      <div className="mp-od-skel-grid mp-od-skel-stats">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="mp-od-skel mp-od-skel-card" />
        ))}
      </div>
      <div className="mp-od-skel-grid mp-od-skel-actions">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="mp-od-skel mp-od-skel-card" />
        ))}
      </div>
      <div className="mp-od-skel-grid mp-od-skel-insights">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="mp-od-skel mp-od-skel-card mp-od-skel-tall" />
        ))}
      </div>
      <div className="mp-od-skel mp-od-skel-timeline" />
    </div>
  )
}

// ─── Profile hub ───────────────────────────────────────────────────────────────
export default function Profile() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const fileRef = useRef()
  const coverRef = useRef()

  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState({ full_name: '', city: '', avatar_url: '', phone: '', cover_url: '' })
  const [listings, setListings] = useState([])
  const [shop, setShop] = useState(null)
  const [followerCount, setFollowerCount] = useState(0)
  const [followingCount, setFollowingCount] = useState(0)
  /** Recent follow rows (with created_at) for real activity timeline */
  const [recentFollowEvents, setRecentFollowEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [uploadingCover, setUploadingCover] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({ full_name: '', city: '', phone: '' })
  const [activeGroup, setActiveGroup] = useState('overview')
  const [navKey, setNavKey] = useState('overview') // UI highlight key (sold/profile/account etc.)
  const [sellingTab, setSellingTab] = useState('active') // 'active' | 'sold' — UI only within Selling
  const [invSearch, setInvSearch] = useState('')
  const [invCategory, setInvCategory] = useState('all')
  const [invStatus, setInvStatus] = useState('active') // active | sold | all | featured
  const [invSort, setInvSort] = useState('newest')
  const [invView, setInvView] = useState('grid') // grid | list
  const [invSelected, setInvSelected] = useState([])
  const [invSelectMode, setInvSelectMode] = useState(false)
  const [featuringId, setFeaturingId] = useState(null)
  const [showFeatureChoice, setShowFeatureChoice] = useState(false)
  const [buyerStats, setBuyerStats] = useState({
    loading: false,
    saved: null,
    unread: null,
    lookingFor: null,
    notifs: null,
  })
  const [mobileDetail, setMobileDetail] = useState(false)
  const [navSearch, setNavSearch] = useState('')
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const [mobileSectionMenuOpen, setMobileSectionMenuOpen] = useState(false)
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const [showVerify, setShowVerify] = useState(false)
  const [shareToast, setShareToast] = useState('')
  const [heroMoreOpen, setHeroMoreOpen] = useState(false)
  const heroMoreRef = useRef(null)
  const mobileMoreRef = useRef(null)
  const mobileSectionMenuRef = useRef(null)
  const mobileSearchInputRef = useRef(null)
  const settingsProfileRef = useRef(null)
  const settingsAccountRef = useRef(null)

  // Open verification wizard from Home banner / notifications (?verify=1 or state.openVerify)
  useEffect(() => {
    const q = searchParams.get('verify')
    const fromState = location.state?.openVerify
    if (q === '1' || q === 'true' || fromState) {
      setShowVerify(true)
      if (q) {
        const next = new URLSearchParams(searchParams)
        next.delete('verify')
        setSearchParams(next, { replace: true })
      }
      if (fromState) {
        navigate(location.pathname, { replace: true, state: {} })
      }
    }
  }, [searchParams, location.state, location.pathname, navigate, setSearchParams])

  // Home "Get Featured" / See Pricing → open Selling inventory (?tab=selling)
  useEffect(() => {
    const tab = searchParams.get('tab') || searchParams.get('group')
    if (tab === 'selling' || tab === 'inventory' || tab === 'featured') {
      openGroup('selling')
      const next = new URLSearchParams(searchParams)
      next.delete('tab')
      next.delete('group')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- openGroup is stable enough; avoid re-open loops
  }, [searchParams])

  useEffect(() => {
    if (!heroMoreOpen) return
    const onDoc = (e) => {
      if (heroMoreRef.current && !heroMoreRef.current.contains(e.target)) {
        setHeroMoreOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setHeroMoreOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [heroMoreOpen])

  useEffect(() => {
    if (!mobileMoreOpen) return
    const onDoc = (e) => {
      if (mobileMoreRef.current && !mobileMoreRef.current.contains(e.target)) {
        setMobileMoreOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileMoreOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [mobileMoreOpen])

  useEffect(() => {
    if (!mobileSectionMenuOpen) return
    const onDoc = (e) => {
      if (mobileSectionMenuRef.current && !mobileSectionMenuRef.current.contains(e.target)) {
        setMobileSectionMenuOpen(false)
      }
    }
    const onKey = (e) => {
      if (e.key === 'Escape') setMobileSectionMenuOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onKey)
    }
  }, [mobileSectionMenuOpen])

  useEffect(() => {
    if (!mobileSearchOpen) return
    const t = setTimeout(() => mobileSearchInputRef.current?.focus?.(), 60)
    return () => clearTimeout(t)
  }, [mobileSearchOpen])

  // Close mobile search when leaving inventory sections
  useEffect(() => {
    if (activeGroup !== 'selling') setMobileSearchOpen(false)
  }, [activeGroup])

  function openGroup(id, { edit } = {}) {
    // Map all nav / legacy ids into content panels — preserve every feature
    let next = id
    let key = id

    if (id === 'profile' || id === 'profile-settings' || id === 'settings') {
      next = 'settings'
      key = id === 'account' ? 'account' : 'profile'
      if (id === 'settings') key = 'profile'
    } else if (id === 'account') {
      next = 'settings'
      key = 'account'
    } else if (id === 'discover') {
      next = 'buying'
      key = 'buying'
    } else if (id === 'sold') {
      next = 'selling'
      key = 'sold'
      setSellingTab('sold')
      setInvStatus('sold')
    } else if (id === 'selling') {
      next = 'selling'
      key = 'selling'
      setSellingTab('active')
      setInvStatus('active')
    }

    setActiveGroup(next)
    setNavKey(key)
    setMobileDetail(true)
    setMobileMoreOpen(false)
    setMobileSectionMenuOpen(false)
    if (edit) setEditMode(true)
    else if (next !== 'settings') setEditMode(false)

    // Bring section content into view (especially after mobile bottom-nav taps)
    setTimeout(() => {
      if (next === 'settings') {
        const el = key === 'account' ? settingsAccountRef.current : settingsProfileRef.current
        el?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })
        return
      }
      const detail = document.querySelector('.mp-col-detail')
      if (detail) {
        const top = detail.getBoundingClientRect().top + window.scrollY - 72
        window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
      }
    }, 60)
  }

  function isNavActive(itemId) {
    if (itemId === 'sold') return activeGroup === 'selling' && sellingTab === 'sold'
    if (itemId === 'selling') return activeGroup === 'selling' && sellingTab !== 'sold'
    if (itemId === 'profile') return activeGroup === 'settings' && navKey !== 'account'
    if (itemId === 'account') return activeGroup === 'settings' && navKey === 'account'
    return activeGroup === itemId
  }

  function profilePublicUrl() {
    if (!user?.id) return ''
    return `${window.location.origin}/profile/${user.id}`
  }

  async function shareProfile() {
    if (!user?.id) return
    const url = profilePublicUrl()
    const title = profile.full_name || 'My SokoMw profile'
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `Check out ${title} on SokoMw`, url })
        return
      }
    } catch {
      /* user cancelled share sheet */
      return
    }
    await copyProfileLink()
  }

  async function copyProfileLink() {
    const url = profilePublicUrl()
    if (!url) return
    try {
      await navigator.clipboard?.writeText(url)
      setShareToast('Profile link copied')
    } catch {
      setShareToast(url)
    }
    setHeroMoreOpen(false)
    setTimeout(() => setShareToast(''), 2500)
  }
  const { statuses: myStatuses } = useStatuses(user?.id)
  const activeStatus = myStatuses[0] || null
  const {
    trustScore,
    dealCount,
    loading: trustLoading,
    vouchesIn,
  } = useVouchData(user?.id, user?.id)

  const {
    dashboardStats,
    analyticsSeries,
    achievements: liveAchievements,
    activityFeed,
    trustEvents,
    securityEvents,
    sessions,
    suggestions,
    recommended,
    recentlyViewed,
    jobApps,
    serviceReqs,
    refresh: refreshDashboard,
    revokeSession,
  } = useProfileDashboard(user?.id)

  useEffect(() => { init() }, [])

  // Phone always shows the current section; tablet/desktop keep multi-pane open
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const sync = () => setMobileDetail(true)
    sync()
    mq.addEventListener?.('change', sync)
    return () => mq.removeEventListener?.('change', sync)
  }, [])

  // Buying dashboard stats — live table counts
  useEffect(() => {
    if (activeGroup !== 'buying' || !user?.id) return
    let cancelled = false
    setBuyerStats(s => ({ ...s, loading: true }))
    Promise.all([
      supabase.from('saved_statuses').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      supabase.from('messages').select('id', { count: 'exact', head: true }).eq('to_user', user.id).eq('read', false),
      supabase.from('buyer_requests').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('status', 'open'),
      supabase.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
      supabase.from('listing_saves').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
    ]).then(([saved, unread, lf, notif, listingSaves]) => {
      if (cancelled) return
      const savedTotal = (saved.count ?? 0) + (listingSaves.count ?? 0)
      setBuyerStats({
        loading: false,
        saved: savedTotal,
        unread: unread.count ?? 0,
        lookingFor: lf.count ?? 0,
        notifs: notif.count ?? 0,
      })
    }).catch(() => {
      if (cancelled) return
      setBuyerStats({ loading: false, saved: null, unread: null, lookingFor: null, notifs: null })
    })
    return () => { cancelled = true }
  }, [activeGroup, user?.id])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }
    setUser(user)
    await Promise.all([
      loadProfile(user.id),
      loadListings(user.id),
      loadNetworkCounts(user.id),
      loadShop(user.id),
    ])
    setLoading(false)
  }

  async function loadProfile(uid) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (data) {
      setProfile(data)
      setForm({
        full_name: data.full_name || '',
        city: data.city || '',
        phone: data.phone || '',
      })
    }
  }

  async function loadListings(uid) {
    const { data } = await supabase
      .from('listings')
      .select('*')
      .eq('seller_id', uid)
      .order('created_at', { ascending: false })
    setListings(data || [])
  }

  async function loadNetworkCounts(uid) {
    const [fol, fing, recentFol] = await Promise.all([
      supabase.from('seller_follows').select('id', { count: 'exact', head: true }).eq('seller_id', uid),
      supabase.from('seller_follows').select('id', { count: 'exact', head: true }).eq('follower_id', uid),
      supabase
        .from('seller_follows')
        .select('id, follower_id, created_at, follower:profiles!seller_follows_follower_id_fkey(full_name)')
        .eq('seller_id', uid)
        .order('created_at', { ascending: false })
        .limit(8),
    ])
    setFollowerCount(fol.count || 0)
    setFollowingCount(fing.count || 0)
    setRecentFollowEvents(recentFol.data || [])
  }

  async function loadShop(uid) {
    const { data } = await supabase
      .from('shops')
      .select('id, name, slug, is_verified, logo_url, city, created_at, updated_at')
      .eq('owner_id', uid)
      .maybeSingle()
    setShop(data || null)
  }

  async function saveProfile() {
    setSaving(true)
    setSaveMsg('')
    const payload = {
      id: user.id,
      full_name: form.full_name.trim(),
      city: form.city,
      phone: form.phone.trim() || null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('profiles').upsert(payload)
    setSaving(false)
    if (error) {
      // phone column may be missing on older DBs — retry without it
      if (String(error.message || '').toLowerCase().includes('phone')) {
        const { error: err2 } = await supabase.from('profiles').upsert({
          id: user.id,
          full_name: form.full_name.trim(),
          city: form.city,
          updated_at: new Date().toISOString(),
        })
        if (err2) { setSaveMsg('Error: ' + err2.message); return }
        setProfile(p => ({ ...p, full_name: form.full_name.trim(), city: form.city }))
        setSaveMsg('Saved (phone field not available yet)')
        setEditMode(false)
        setTimeout(() => setSaveMsg(''), 2500)
        return
      }
      setSaveMsg('Error: ' + error.message)
      return
    }
    setProfile(p => ({
      ...p,
      full_name: form.full_name.trim(),
      city: form.city,
      phone: form.phone.trim() || null,
    }))
    setSaveMsg('Profile saved')
    setEditMode(false)
    setTimeout(() => setSaveMsg(''), 2000)
  }

  async function uploadAvatar(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (e.target) e.target.value = ''
    setUploadingAvatar(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = user.id + '/avatar.' + ext
    const publicUrl = await uploadToR2(file, 'avatars/' + path)
    if (!publicUrl) { setUploadingAvatar(false); alert('Upload failed'); return }
    const url = publicUrl + (publicUrl.includes('?') ? '&' : '?') + 't=' + Date.now()
    const { error } = await supabase.from('profiles').upsert({ id: user.id, avatar_url: publicUrl })
    if (error) { setUploadingAvatar(false); alert('Could not save photo: ' + error.message); return }
    setProfile(p => ({ ...p, avatar_url: url }))
    setUploadingAvatar(false)
  }

  async function uploadCover(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (e.target) e.target.value = ''
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file')
      return
    }
    // Soft size guard (~8MB)
    if (file.size > 8 * 1024 * 1024) {
      alert('Cover photo is too large. Use an image under 8 MB.')
      return
    }
    setUploadingCover(true)
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
    const path = user.id + '/cover.' + ext
    // Prefer dedicated covers bucket; fall back to avatars if bucket missing
    let publicUrl = await uploadToR2(file, 'covers/' + path)
    if (!publicUrl) {
      publicUrl = await uploadToR2(file, 'avatars/' + path)
    }
    if (!publicUrl) {
      setUploadingCover(false)
      alert('Cover upload failed')
      return
    }
    const url = publicUrl + (publicUrl.includes('?') ? '&' : '?') + 't=' + Date.now()
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      cover_url: publicUrl,
      updated_at: new Date().toISOString(),
    })
    if (error) {
      setUploadingCover(false)
      alert(
        error.message?.toLowerCase().includes('cover_url')
          ? 'Cover photo is not enabled on the database yet. Run the cover_url migration, then try again.'
          : 'Could not save cover: ' + error.message
      )
      return
    }
    setProfile(p => ({ ...p, cover_url: url }))
    setUploadingCover(false)
  }

  async function removeCover() {
    if (!profile.cover_url) return
    if (!window.confirm('Remove your cover photo?')) return
    setUploadingCover(true)
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      cover_url: null,
      updated_at: new Date().toISOString(),
    })
    setUploadingCover(false)
    if (error) { alert('Could not remove cover: ' + error.message); return }
    setProfile(p => ({ ...p, cover_url: null }))
  }

 async function toggleSold(listing) {
  const newStatus = listing.status === 'sold' ? 'active' : 'sold'
  const { error } = await supabase.from('listings').update({ status: newStatus }).eq('id', listing.id)
  if (error) {
    console.error('Failed to update listing status:', error)
    setShareToast('Could not update — try again')
    setTimeout(() => setShareToast(''), 2000)
    return
  }
  setListings(ls => ls.map(l => l.id === listing.id ? { ...l, status: newStatus } : l))
}

  async function deleteListing(id) {
    await supabase.from('listings').delete().eq('id', id)
    setListings(ls => ls.filter(l => l.id !== id))
    setInvSelected(sel => sel.filter(x => x !== id))
    setDeleteConfirm(null)
  }

  async function shareListing(listing) {
    if (!listing?.id) return
    const url = `${window.location.origin}/listing/${listing.id}`
    const title = listing.title || 'SokoMw listing'
    let shared = false
    try {
      if (navigator.share) {
        await navigator.share({ title, text: title, url })
        shared = true
      }
    } catch {
      /* cancelled */
    }
    if (!shared) {
      try {
        await navigator.clipboard?.writeText(url)
        setShareToast('Listing link copied')
        setTimeout(() => setShareToast(''), 2500)
        shared = true
      } catch {
        setShareToast(url)
        setTimeout(() => setShareToast(''), 2500)
      }
    }
    if (shared) {
      await recordListingShare(listing.id, navigator.share ? 'native' : 'clipboard')
      setListings(ls => ls.map(l =>
        l.id === listing.id ? { ...l, share_count: (l.share_count || 0) + 1 } : l
      ))
    }
  }

  async function bulkMarkSold() {
    if (!invSelected.length) return
    if (!window.confirm(`Mark ${invSelected.length} listing(s) as sold?`)) return
    try {
      await bulkListingStatus(invSelected, 'sold')
      setListings(ls => ls.map(l => invSelected.includes(l.id) ? { ...l, status: 'sold' } : l))
      setInvSelected([])
      setShareToast('Listings marked sold')
      setTimeout(() => setShareToast(''), 2000)
      refreshDashboard()
    } catch (e) {
      // fallback per-row
      await Promise.all(invSelected.map(id =>
        supabase.from('listings').update({ status: 'sold' }).eq('id', id)
      ))
      setListings(ls => ls.map(l => invSelected.includes(l.id) ? { ...l, status: 'sold' } : l))
      setInvSelected([])
    }
  }

  async function bulkRelist() {
    if (!invSelected.length) return
    if (!window.confirm(`Relist ${invSelected.length} listing(s) as active?`)) return
    try {
      await bulkListingStatus(invSelected, 'active')
    } catch {
      await Promise.all(invSelected.map(id =>
        supabase.from('listings').update({ status: 'active' }).eq('id', id)
      ))
    }
    setListings(ls => ls.map(l => invSelected.includes(l.id) ? { ...l, status: 'active' } : l))
    setInvSelected([])
    setShareToast('Listings relisted')
    setTimeout(() => setShareToast(''), 2000)
    refreshDashboard()
  }

  async function bulkDeleteSelected() {
    if (!invSelected.length) return
    if (!window.confirm(`Permanently delete ${invSelected.length} listing(s)?`)) return
    try {
      await bulkListingDelete(invSelected)
    } catch {
      await Promise.all(invSelected.map(id =>
        supabase.from('listings').delete().eq('id', id)
      ))
    }
    setListings(ls => ls.filter(l => !invSelected.includes(l.id)))
    setInvSelected([])
    setShareToast('Listings deleted')
    setTimeout(() => setShareToast(''), 2000)
    refreshDashboard()
  }

  // Phase 4.2 — feature an existing listing (free RPC or PayChangu; no free bulk)
  async function featureListing(listing) {
    if (!listing?.id || featuringId) return
    if (isListingFeatured(listing)) {
      setShareToast('This listing is already featured')
      setTimeout(() => setShareToast(''), 3000)
      return
    }
    if (listing.status === 'sold' || listing.status === 'deleted' || listing.status === 'draft') {
      setShareToast('Only active listings can be featured')
      setTimeout(() => setShareToast(''), 3000)
      return
    }
    // Ensure seller_id is present for ownership checks
    const listingPayload = {
      ...listing,
      seller_id: listing.seller_id || user?.id,
    }
    setFeaturingId(listing.id)
    try {
      const result = await featureExistingListing({
        listing: listingPayload,
        user,
        profileName: profile?.full_name || profile?.name,
      })
      if (result?.redirecting) {
        // Navigating to PayChangu — keep button busy
        return
      }
      if (result?.free) {
        setShareToast('Listing featured on the homepage!')
        setTimeout(() => setShareToast(''), 3500)
        if (user?.id) await loadListings(user.id)
        refreshDashboard?.()
      }
    } catch (e) {
      const msg = e?.message || 'Could not feature listing'
      console.error('[Profile] featureListing failed', e)
      setShareToast(msg)
      setTimeout(() => setShareToast(''), 6000)
      // Always surface failure (toast can be easy to miss)
      window.alert(msg)
    } finally {
      setFeaturingId(null)
    }
  }

  function bulkBoostSelected() {
    setShareToast('Feature listings one at a time with the star button.')
    setTimeout(() => setShareToast(''), 4000)
  }

  async function ensureSaleOrder(listing) {
    if (!listing?.id || !user?.id) return null
    const { data: existing } = await supabase
      .from('sale_orders')
      .select('*')
      .eq('listing_id', listing.id)
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (existing) return existing
    const inv = `INV-${String(listing.id).slice(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`
    const { data, error } = await supabase.from('sale_orders').insert({
      listing_id: listing.id,
      seller_id: user.id,
      amount: listing.sold_price ?? listing.price ?? 0,
      currency: 'MWK',
      status: 'completed',
      delivery_status: listing.delivery_status || 'none',
      invoice_number: inv,
      sold_at: listing.sold_at || listing.updated_at || new Date().toISOString(),
    }).select('*').single()
    if (error) throw error
    return data
  }

  async function showSaleInvoice(listing) {
    try {
      const order = await ensureSaleOrder(listing)
      const text = [
        `Invoice ${order.invoice_number || '—'}`,
        `Item: ${listing.title}`,
        `Amount: MWK ${Number(order.amount || 0).toLocaleString()}`,
        `Status: ${order.status}`,
        `Delivery: ${order.delivery_status}`,
        `Date: ${order.sold_at ? new Date(order.sold_at).toLocaleString() : '—'}`,
      ].join('\n')
      try {
        await navigator.clipboard?.writeText(text)
        setShareToast('Invoice copied to clipboard')
      } catch {
        alert(text)
      }
      setTimeout(() => setShareToast(''), 2500)
    } catch (e) {
      alert(e.message || 'Invoice requires sale_orders migration')
    }
  }

  async function downloadSaleReceipt(listing) {
    try {
      const order = await ensureSaleOrder(listing)
      const body = [
        'SokoMw Sale Receipt',
        '====================',
        `Invoice: ${order.invoice_number || '—'}`,
        `Listing: ${listing.title}`,
        `Amount: MWK ${Number(order.amount || 0).toLocaleString()}`,
        `Seller: ${profile.full_name || user?.email || user?.id}`,
        `Sold: ${order.sold_at ? new Date(order.sold_at).toLocaleString() : '—'}`,
        `Delivery: ${order.delivery_status}`,
      ].join('\n')
      const blob = new Blob([body], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${order.invoice_number || 'receipt'}.txt`
      a.click()
      URL.revokeObjectURL(url)
      setShareToast('Receipt downloaded')
      setTimeout(() => setShareToast(''), 2000)
    } catch (e) {
      alert(e.message || 'Receipt requires sale_orders migration')
    }
  }

  async function cycleDeliveryStatus(listing) {
    const cycle = ['none', 'pending', 'in_transit', 'delivered']
    try {
      const order = await ensureSaleOrder(listing)
      const cur = order.delivery_status || 'none'
      const next = cycle[(cycle.indexOf(cur) + 1) % cycle.length]
      await supabase.from('sale_orders').update({
        delivery_status: next,
        updated_at: new Date().toISOString(),
      }).eq('id', order.id)
      await supabase.from('listings').update({ delivery_status: next }).eq('id', listing.id)
      setListings(ls => ls.map(l => l.id === listing.id ? { ...l, delivery_status: next } : l))
      setShareToast(`Delivery: ${next.replace('_', ' ')}`)
      setTimeout(() => setShareToast(''), 2000)
    } catch (e) {
      alert(e.message || 'Delivery status requires sale_orders migration')
    }
  }

  async function showBuyerReviews(listing) {
    try {
      const { data, error } = await supabase
        .from('sale_reviews')
        .select('id, rating, body, created_at, buyer_id')
        .eq('listing_id', listing.id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (error) throw error
      if (!data?.length) {
        setShareToast('No buyer reviews yet for this sale')
        setTimeout(() => setShareToast(''), 2500)
        return
      }
      const summary = data
        .map(r => `★${r.rating}${r.body ? ` — ${r.body}` : ''}`)
        .join('\n')
      alert(`Buyer reviews (${data.length})\n\n${summary}`)
    } catch (e) {
      alert(e.message || 'Reviews require sale_reviews migration')
    }
  }

  function setInventoryStatus(status) {
    setInvStatus(status)
    setInvSelected([])
    if (status === 'sold') {
      setSellingTab('sold')
      setNavKey('sold')
    } else if (status === 'active' || status === 'featured') {
      setSellingTab('active')
      setNavKey('selling')
    }
  }

  function toggleInvSelect(id) {
    setInvSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]))
  }

  function toggleSelectAllInventory(ids) {
    setInvSelected(prev => (prev.length === ids.length ? [] : [...ids]))
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  function confirmSignOut() {
    if (!window.confirm('Sign out of SokoMw on this device?')) return
    signOut()
  }

  const signInMethod = (() => {
    const provider = user?.app_metadata?.provider
      || user?.identities?.[0]?.provider
      || 'email'
    if (provider === 'email') return 'Email & password'
    if (provider === 'google') return 'Google'
    if (provider === 'phone') return 'Phone'
    return String(provider).charAt(0).toUpperCase() + String(provider).slice(1)
  })()

  const lastLoginLabel = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : null

  /** Connected devices — human labels, current session flag, sort by activity */
  const connectedDevices = useMemo(() => {
    const uaNow = typeof navigator !== 'undefined' ? (navigator.userAgent || '') : ''
    const uaKey = uaNow.slice(0, 80)
    const list = (sessions || []).map((s) => {
      const raw = s.user_agent || s.device_label || ''
      const parsed = parseDeviceFromUserAgent(raw)
      // Prefer stored clean label when it looks human (e.g. "Chrome · Windows")
      const stored = (s.device_label || '').trim()
      const looksHuman = stored && !/mozilla\//i.test(stored) && stored.length <= 60
      const label = looksHuman ? stored : parsed.label
      return {
        id: s.id,
        label,
        browser: parsed.browser,
        os: parsed.os,
        kind: parsed.kind,
        lastActive: s.last_active_at || s.created_at,
        createdAt: s.created_at,
        isCurrent: false,
        _rawUa: s.user_agent || '',
      }
    })

    // Mark a single current device (best UA match, else most recently active)
    let currentIdx = list.findIndex((d) => d._rawUa && uaKey && d._rawUa.slice(0, 80) === uaKey)
    if (currentIdx < 0 && list.length) {
      // sessions already ordered by last_active_at desc from API
      currentIdx = 0
    }
    if (currentIdx >= 0) list[currentIdx].isCurrent = true

    return list
      .map(({ _rawUa, ...rest }) => rest)
      .sort((a, b) => {
        if (a.isCurrent !== b.isCurrent) return a.isCurrent ? -1 : 1
        return new Date(b.lastActive || 0) - new Date(a.lastActive || 0)
      })
  }, [sessions])

  const [revokingSessionId, setRevokingSessionId] = useState(null)

  async function handleRevokeSession(device) {
    if (!device?.id) return
    if (device.isCurrent) {
      if (!window.confirm('Sign out of this device? You will need to log in again.')) return
      await revokeSession(device.id)
      await signOut()
      return
    }
    if (!window.confirm(`Remove “${device.label}” from your connected devices?`)) return
    setRevokingSessionId(device.id)
    const ok = await revokeSession(device.id)
    setRevokingSessionId(null)
    if (ok) {
      setShareToast('Device removed')
      setTimeout(() => setShareToast(''), 2500)
    } else {
      setShareToast('Could not remove device')
      setTimeout(() => setShareToast(''), 3000)
    }
  }

  const activeListing = useMemo(
    () => listings.filter(l => l.status !== 'sold' && l.status !== 'deleted'),
    [listings]
  )
  /** Unfeatured active listings eligible for Feature another / choice modal */
  const featureableListings = useMemo(
    () => activeListing.filter(l => !isListingFeatured(l)),
    [activeListing],
  )

  function openFeatureChoice() {
    setShowFeatureChoice(true)
  }

  function chooseFeatureNewListing() {
    setShowFeatureChoice(false)
    navigate('/post', { state: { preselectFeature: true } })
  }

  function chooseFeatureExisting(listing) {
    if (!listing) return
    setShowFeatureChoice(false)
    featureListing(listing)
  }

  const soldListings = useMemo(
    () => listings.filter(l => l.status === 'sold'),
    [listings]
  )

  const completeness = useMemo(
    () => profileCompleteness(profile, user),
    [profile, user]
  )

  // UI-only seller tier from already-loaded marketplace signals (no new queries)
  const sellerLevel = useMemo(() => {
    const deals = dealCount || 0
    const sold = soldListings.length
    const active = activeListing.length
    const followers = followerCount || 0
    const points =
      deals * 4 +
      sold * 3 +
      Math.min(active, 12) +
      Math.min(followers, 25) +
      (profile.is_verified ? 12 : 0) +
      Math.floor(completeness.pct / 10)

    if (points >= 55) {
      return { name: 'Elite seller', tier: 4, label: 'Top marketplace reputation', pct: 100, next: null }
    }
    if (points >= 28) {
      return {
        name: 'Pro seller',
        tier: 3,
        label: 'Strong closer',
        pct: Math.min(99, 55 + Math.round(((points - 28) / 27) * 44)),
        next: 'Elite seller',
        tip: 'More confirmed deals and followers unlock Elite',
      }
    }
    if (points >= 12) {
      return {
        name: 'Rising seller',
        tier: 2,
        label: 'Gaining traction',
        pct: Math.min(99, 30 + Math.round(((points - 12) / 16) * 40)),
        next: 'Pro seller',
        tip: 'Mark sold items and collect deals to reach Pro',
      }
    }
    return {
      name: 'New seller',
      tier: 1,
      label: 'Just getting started',
      pct: Math.max(8, Math.min(29, points * 2)),
      next: 'Rising seller',
      tip: 'Complete your profile and post your first listings',
    }
  }, [dealCount, soldListings.length, activeListing.length, followerCount, profile.is_verified, completeness.pct])

  /** Sidebar strip — latest real listing lifecycle moments */
  const recentActivity = useMemo(() => {
    const items = []
    for (const l of listings) {
      if (!l || l.status === 'deleted') continue
      const title = l.title || 'Untitled'
      if (l.status === 'sold') {
        items.push({
          id: `sold-${l.id}`,
          text: `Sold · ${title}`,
          when: l.sold_at || l.updated_at || l.created_at,
          status: 'sold',
        })
      } else if (isListingFeatured(l)) {
        const until = l.featured_until ? new Date(l.featured_until).getTime() : 0
        const start = until
          ? new Date(until - FEATURED_DURATION_DAYS * 86400000).toISOString()
          : (l.updated_at || l.created_at)
        items.push({
          id: `feat-${l.id}`,
          text: `Featured · ${title}`,
          when: start,
          status: l.status,
        })
      } else {
        const created = new Date(l.created_at || 0).getTime()
        const updated = new Date(l.updated_at || l.created_at || 0).getTime()
        const wasUpdated = updated - created > 120000
        items.push({
          id: wasUpdated ? `upd-${l.id}` : `list-${l.id}`,
          text: wasUpdated ? `Updated · ${title}` : `Listed · ${title}`,
          when: wasUpdated ? l.updated_at : l.created_at,
          status: l.status,
        })
      }
    }
    return items
      .filter(i => i.when)
      .sort((a, b) => new Date(b.when) - new Date(a.when))
      .slice(0, 6)
  }, [listings])

  /**
   * Overview timeline from real timestamps only (no snapshot “status cards”
   * stamped with profile.updated_at that look like fresh activity).
   */
  const dashboardTimeline = useMemo(() => {
    const events = []
    const ms = (v) => (v ? new Date(v).getTime() : 0)

    for (const l of listings) {
      if (!l?.id || l.status === 'deleted' || l.status === 'draft') continue
      const title = l.title || 'Untitled'
      const go = () => navigate('/listing/' + l.id)

      // Always record the original list event when we have created_at
      if (l.created_at) {
        events.push({
          id: `listed-${l.id}`,
          listingId: l.id,
          when: l.created_at,
          text: `Listed · ${title}`,
          icon: 'package',
          tone: 'list',
          onClick: go,
        })
      }

      // Material edit after create (not the same second as insert)
      if (l.updated_at && l.created_at && ms(l.updated_at) - ms(l.created_at) > 120000 && l.status !== 'sold') {
        events.push({
          id: `updated-${l.id}`,
          listingId: l.id,
          when: l.updated_at,
          text: `Listing updated · ${title}`,
          icon: 'pencil',
          tone: 'list',
          onClick: go,
        })
      }

      if (l.status === 'sold') {
        events.push({
          id: `sold-${l.id}`,
          listingId: l.id,
          when: l.sold_at || l.updated_at || l.created_at,
          text: `Sold · ${title}`,
          icon: 'checkCircle',
          tone: 'sold',
          onClick: go,
        })
      }

      if (isListingFeatured(l) && l.status !== 'sold') {
        let when = l.updated_at || l.created_at
        if (l.featured_until) {
          const startMs = ms(l.featured_until) - FEATURED_DURATION_DAYS * 86400000
          if (startMs > 0) when = new Date(startMs).toISOString()
        }
        events.push({
          id: `featured-${l.id}`,
          listingId: l.id,
          when,
          text: `Featured · ${title}`,
          icon: 'star',
          tone: 'feat',
          onClick: go,
        })
      }
    }

    // Real follow events (timestamp = when they followed)
    for (const f of recentFollowEvents) {
      const name = f.follower?.full_name?.trim()
      events.push({
        id: `follow-${f.id}`,
        when: f.created_at,
        text: name ? `${name} followed you` : 'New follower joined your network',
        icon: 'users',
        tone: 'net',
        onClick: () => openGroup('network'),
      })
    }

    // Vouches with real created_at
    for (const v of (vouchesIn || []).slice(0, 6)) {
      const name = v.voucher?.full_name || v.profiles?.full_name
      events.push({
        id: `vouch-${v.id}`,
        when: v.created_at,
        text: name ? `Vouch received · ${name}` : 'New vouch on your profile',
        icon: 'heart',
        tone: 'vouch',
        onClick: () => openGroup('trust'),
      })
    }

    // Trust events from DB (sales, verify, etc.)
    for (const ev of (trustEvents || []).slice(0, 8)) {
      const t = (ev.event_type || '').toLowerCase()
      events.push({
        id: `trust-${ev.id}`,
        when: ev.created_at,
        text: ev.title || 'Trust event',
        icon: t.includes('sale') || t.includes('sold')
          ? 'checkCircle'
          : t.includes('verify')
            ? 'shieldCheck'
            : 'badgeCheck',
        tone: t.includes('sale') || t.includes('sold') ? 'sold' : 'ok',
        onClick: ev.listing_id || ev.meta?.listing_id
          ? () => navigate('/listing/' + (ev.listing_id || ev.meta.listing_id))
          : undefined,
      })
    }

    // Identity verified — only with a real verified_at (not profile.updated_at)
    if (profile.is_verified && profile.verified_at) {
      events.push({
        id: 'verify-ok',
        when: profile.verified_at,
        text: 'Identity verified — buyers can trust your profile',
        icon: 'shieldCheck',
        tone: 'ok',
        onClick: () => openGroup('trust'),
      })
    }

    // Shop created (real created_at only)
    if (shop?.created_at) {
      events.push({
        id: `shop-${shop.id}`,
        when: shop.created_at,
        text: `Shop opened · ${shop.name || 'Your shop'}`,
        icon: 'store',
        tone: 'shop',
        onClick: () => navigate(shop.slug ? `/shop/${shop.slug}` : `/shop/${shop.id}`),
      })
    }

    // Account joined
    if (profile.created_at) {
      events.push({
        id: 'joined',
        when: profile.created_at,
        text: 'Joined SokoMw',
        icon: 'sparkles',
        tone: 'ok',
      })
    }

    // Dedupe: same text + same calendar day
    const seen = new Set()
    return events
      .filter((e) => e.when && e.text)
      .sort((a, b) => ms(b.when) - ms(a.when))
      .filter((e) => {
        const day = String(e.when).slice(0, 10)
        const k = `${e.text}|${day}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .slice(0, 12)
  }, [
    listings,
    recentFollowEvents,
    vouchesIn,
    trustEvents,
    profile.is_verified,
    profile.verified_at,
    profile.created_at,
    shop,
  ])

  const featuredListings = useMemo(
    () => activeListing.filter(l => isListingFeatured(l)),
    [activeListing]
  )

  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null

  const online = getOnlineStatus(profile.last_seen)
  const accountType = profile.account_type === 'shop' ? 'Shop account' : 'Personal account'
  const shopPath = shop
    ? (shop.slug ? `/shop/${shop.slug}` : `/shop/${shop.id}`)
    : '/shop-setup'

  function timeAgoShort(ts) {
    if (!ts) return ''
    const diff = Date.now() - new Date(ts).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 60) return `${Math.max(1, m)}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}h`
    const d = Math.floor(h / 24)
    return `${d}d`
  }

  function handleNextCompleteness() {
    if (!completeness.next) return
    if (completeness.next.key === 'verified') {
      setShowVerify(true)
      return
    }
    if (completeness.next.key === 'photo') {
      fileRef.current?.click()
      return
    }
    openGroup('profile', { edit: true })
  }

  const insightTips = useMemo(() => {
    const tips = []
    if (completeness.next) {
      tips.push({
        id: 'complete',
        text: completeness.next.tip,
        cta: 'Fix now',
        onClick: () => {
          if (completeness.next?.key === 'verified') setShowVerify(true)
          else if (completeness.next?.key === 'photo') fileRef.current?.click()
          else openGroup('profile', { edit: true })
        },
      })
    }
    if (!profile.is_verified) {
      tips.push({
        id: 'verify',
        text: 'Get identity verified to sell faster and earn more trust.',
        cta: 'Verify',
        onClick: () => setShowVerify(true),
      })
    }
    if (activeListing.length === 0) {
      tips.push({
        id: 'post',
        text: 'Post your first listing to appear in local search.',
        cta: 'Post',
        onClick: () => navigate('/post'),
      })
    } else if (featuredListings.length === 0) {
      tips.push({
        id: 'feature',
        text: 'Feature a listing to reach more buyers this week.',
        cta: 'Feature',
        onClick: () => navigate(`/post/edit/${activeListing[0].id}`),
      })
    }
    if (!activeStatus) {
      tips.push({
        id: 'status',
        text: 'Post availability so nearby buyers know you are free.',
        cta: 'Go live',
        onClick: () => setShowStatusPicker(true),
      })
    }
    if (tips.length === 0) {
      tips.push({
        id: 'good',
        text: 'You look strong — keep responding quickly in chats.',
        cta: 'Trust',
        onClick: () => openGroup('trust'),
      })
    }
    return tips.slice(0, 3)
  }, [
    completeness.next,
    profile.is_verified,
    activeListing,
    featuredListings.length,
    activeStatus,
  ])

  const invCategories = useMemo(() => {
    const set = new Set()
    listings.forEach(l => {
      const c = (l.category || l.category_name || '').trim()
      if (c) set.add(c)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [listings])

  const inventoryList = useMemo(() => {
    let base
    if (invStatus === 'sold') base = soldListings
    else if (invStatus === 'featured') {
      base = listings.filter(
        l => l.status !== 'sold' && l.status !== 'deleted' && isListingFeatured(l)
      )
    } else if (invStatus === 'all') {
      base = listings.filter(l => l.status !== 'deleted')
    } else {
      base = activeListing
    }

    const q = invSearch.trim().toLowerCase()
    let rows = base
    if (q) {
      rows = rows.filter(l => {
        const hay = `${l.title || ''} ${l.district || ''} ${l.city || ''} ${l.category || ''} ${l.description || ''}`.toLowerCase()
        return hay.includes(q)
      })
    }
    if (invCategory !== 'all') {
      rows = rows.filter(l => (l.category || l.category_name || '') === invCategory)
    }

    const sorted = [...rows]
    sorted.sort((a, b) => {
      if (invSort === 'oldest') {
        return new Date(a.created_at || 0) - new Date(b.created_at || 0)
      }
      if (invSort === 'price_asc') return Number(a.price || 0) - Number(b.price || 0)
      if (invSort === 'price_desc') return Number(b.price || 0) - Number(a.price || 0)
      if (invSort === 'title') return String(a.title || '').localeCompare(String(b.title || ''))
      const ta = new Date(a.updated_at || a.created_at || 0).getTime()
      const tb = new Date(b.updated_at || b.created_at || 0).getTime()
      return tb - ta
    })
    return sorted
  }, [invStatus, soldListings, activeListing, listings, invSearch, invCategory, invSort])

  // Sold dashboard KPIs — prefer RPC stats, fallback to local listings
  const soldDashboardStats = useMemo(() => {
    const totalSold = dashboardStats.sold_listings ?? soldListings.length
    const totalDeals = dashboardStats.deals ?? dealCount ?? 0
    const poolActive = dashboardStats.active_listings ?? activeListing.length
    const pool = poolActive + totalSold
    let salesRate = dashboardStats.sales_rate_pct
    if (salesRate == null && pool > 0) {
      salesRate = Math.round((totalSold / pool) * 100)
    }
    let avgAgeDays = dashboardStats.avg_listing_age_days
    if (avgAgeDays == null && soldListings.length > 0) {
      const ages = soldListings.map((l) => {
        const start = new Date(l.created_at || 0).getTime()
        const end = new Date(l.sold_at || l.updated_at || l.created_at || 0).getTime()
        if (!start || !end || end < start) return null
        return Math.round((end - start) / 86400000)
      }).filter(n => n != null)
      if (ages.length) {
        avgAgeDays = Math.round(ages.reduce((a, b) => a + b, 0) / ages.length)
      }
    }
    return { totalSold, totalDeals, salesRate, avgAgeDays }
  }, [soldListings, activeListing.length, dealCount, dashboardStats])

  const profileViewsCount = dashboardStats.profile_views ?? profile.profile_view_count ?? null
  const listingViewsTotal = dashboardStats.listing_views ?? null

  const analyticsBars = useMemo(() => {
    if (!analyticsSeries?.length) return null
    const vals = analyticsSeries.map(
      (d) => (d.profile_views || 0) + (d.listing_views || 0) + (d.sales || 0) * 3
    )
    const max = Math.max(...vals, 1)
    return analyticsSeries.map((d, i) => ({
      key: d.day || i,
      height: Math.max(8, Math.round((vals[i] / max) * 100)),
      label: d.day,
      views: (d.profile_views || 0) + (d.listing_views || 0),
      sales: d.sales || 0,
    }))
  }, [analyticsSeries])

  const soldCategories = useMemo(() => {
    const set = new Set()
    soldListings.forEach(l => {
      const c = (l.category || l.category_name || '').trim()
      if (c) set.add(c)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [soldListings])

  // Trust Center — UI composition only (existing data / placeholders)
  const trustScoreTotal = trustScore?.total_score ?? 0
  const trustScorePct = Math.min(100, Math.round((Number(trustScoreTotal) / 30) * 100))

  const trustChecklist = useMemo(() => {
    const items = [
      {
        id: 'identity',
        label: 'Use a real photo and full name',
        done: !!(profile.avatar_url && profile.full_name && profile.full_name.trim().length > 1),
        action: () => openGroup('profile', { edit: true }),
        cta: 'Edit profile',
      },
      {
        id: 'verify',
        label: 'Complete identity verification',
        done: !!profile.is_verified,
        action: () => setShowVerify(true),
        cta: 'Get verified',
      },
      {
        id: 'sold',
        label: 'Mark items sold after successful deals',
        done: soldListings.length > 0,
        action: () => openGroup('selling'),
        cta: 'Open inventory',
      },
      {
        id: 'respond',
        label: 'Respond quickly in chats',
        done: !!profile.fast_responder || (profile.response_sample_count >= 5 && (profile.avg_response_seconds || 9999) <= 1800),
        action: () => navigate('/chats'),
        cta: 'Open chats',
        placeholder: false,
      },
      {
        id: 'vouches',
        label: 'Collect vouches from people you\'ve dealt with',
        done: (vouchesIn?.length || 0) > 0,
        action: null,
        cta: null,
      },
    ]
    const done = items.filter(i => i.done).length
    const next = items.find(i => !i.done) || null
    return { items, done, total: items.length, pct: Math.round((done / items.length) * 100), next }
  }, [
    profile.avatar_url,
    profile.full_name,
    profile.is_verified,
    soldListings.length,
    vouchesIn,
    profile.fast_responder,
    profile.response_sample_count,
    profile.avg_response_seconds,
  ])

  const trustAchievements = useMemo(() => {
    if (liveAchievements?.length) return liveAchievements
    const score = Number(trustScoreTotal) || 0
    const isFast = !!profile.fast_responder || (profile.response_sample_count >= 5 && (profile.avg_response_seconds || 9999) <= 1800)
    const earlyCut = new Date('2026-06-01T00:00:00Z').getTime()
    const isEarly = profile.created_at && new Date(profile.created_at).getTime() < earlyCut
    return [
      {
        id: 'verified',
        icon: 'shieldCheck',
        name: 'Verified Seller',
        desc: 'Identity confirmed on SokoMw',
        unlocked: !!profile.is_verified,
        req: 'Complete identity verification',
      },
      {
        id: 'trusted',
        icon: 'star',
        name: 'Trusted Seller',
        desc: 'Strong trust score with buyers',
        unlocked: score >= 30 || (dealCount || 0) >= 5,
        req: 'Reach trust score 30 or 5 confirmed deals',
      },
      {
        id: 'active',
        icon: 'package',
        name: 'Active Seller',
        desc: 'Keeping inventory live',
        unlocked: activeListing.length >= 1,
        req: 'Post at least 1 active listing',
      },
      {
        id: 'fast',
        icon: 'activity',
        name: 'Fast Responder',
        desc: 'Reply to buyers quickly',
        unlocked: isFast,
        req: 'Avg reply under 30 minutes (5+ samples)',
      },
      {
        id: 'community',
        icon: 'users',
        name: 'Community Member',
        desc: 'Part of the local network',
        unlocked: (followerCount || 0) >= 1 || (followingCount || 0) >= 1,
        req: 'Gain a follower or follow a seller',
      },
      {
        id: 'top',
        icon: 'crown',
        name: 'Top Seller',
        desc: 'Elite marketplace reputation',
        unlocked: sellerLevel.tier >= 3,
        req: 'Reach Pro or Elite seller level',
      },
      {
        id: 'early',
        icon: 'sparkles',
        name: 'Early Adopter',
        desc: 'Joined SokoMw early',
        unlocked: !!isEarly,
        req: 'Joined during launch window',
      },
    ]
  }, [
    liveAchievements,
    profile.is_verified,
    profile.fast_responder,
    profile.response_sample_count,
    profile.avg_response_seconds,
    profile.created_at,
    trustScoreTotal,
    dealCount,
    activeListing.length,
    followerCount,
    followingCount,
    sellerLevel.tier,
  ])

  // Persist completion % + seller level cache when profile is loaded
  useEffect(() => {
    if (!user?.id || loading) return
    syncProfileCompletion(user.id, completeness.pct, sellerLevel)
  }, [user?.id, loading, completeness.pct, sellerLevel.tier, sellerLevel.name])

  const trustTimeline = useMemo(() => {
    const events = []

    // Prefer persisted trust_events from DB
    if (trustEvents?.length) {
      trustEvents.forEach((ev) => {
        events.push({
          id: ev.id,
          icon: ev.event_type === 'sale' ? '✓' : ev.event_type === 'verify' ? '🛡️' : '⭐',
          tone: ev.event_type === 'sale' ? 'sold' : 'ok',
          text: ev.title,
          when: ev.created_at,
        })
      })
    }

    if (profile.created_at) {
      events.push({
        id: 'joined',
        icon: '🎉',
        tone: 'ok',
        text: 'Joined SokoMw',
        when: profile.created_at,
      })
    }
    if (completeness.pct >= 100 || (completeness.done === completeness.total)) {
      events.push({
        id: 'profile-complete',
        icon: '✅',
        tone: 'ok',
        text: 'Profile strength fully completed',
        when: profile.updated_at || profile.created_at,
      })
    } else if (completeness.done > 0) {
      events.push({
        id: 'profile-progress',
        icon: '📈',
        tone: 'mid',
        text: `Profile strength at ${completeness.pct}%`,
        when: profile.updated_at || profile.created_at,
      })
    }
    if (profile.is_verified) {
      events.push({
        id: 'verified',
        icon: '🛡️',
        tone: 'ok',
        text: 'Identity verified',
        when: profile.updated_at || profile.created_at,
      })
    }
    soldListings.slice(0, 4).forEach((l) => {
      events.push({
        id: `sold-${l.id}`,
        icon: '✓',
        tone: 'sold',
        text: `Sale completed · ${l.title}`,
        when: l.sold_at || l.updated_at || l.created_at,
        onClick: () => navigate('/listing/' + l.id),
      })
    })
    if ((dealCount || 0) > 0) {
      events.push({
        id: 'deals',
        icon: '🤝',
        tone: 'ok',
        text: `${dealCount} confirmed deal${dealCount === 1 ? '' : 's'} on record`,
        when: profile.updated_at || profile.created_at,
      })
    }
    ;(vouchesIn || []).slice(0, 4).forEach((v, i) => {
      const name = v.voucher?.full_name || v.profiles?.full_name || 'A buyer'
      events.push({
        id: `vouch-${v.id || i}`,
        icon: '💬',
        tone: 'vouch',
        text: `Vouch received · ${name}`,
        when: v.created_at || profile.updated_at,
      })
    })
    if (events.length === 0) {
      events.push({
        id: 'start',
        icon: '🌱',
        tone: 'mid',
        text: 'Start building trust — verify, sell, and collect vouches',
        when: null,
        whenLabel: 'Now',
      })
    }
    // Dedupe by text+when day
    const seen = new Set()
    return events
      .sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0))
      .filter((e) => {
        const k = `${e.text}|${String(e.when || '').slice(0, 10)}`
        if (seen.has(k)) return false
        seen.add(k)
        return true
      })
      .slice(0, 12)
  }, [
    trustEvents,
    profile.created_at,
    profile.updated_at,
    profile.is_verified,
    completeness.pct,
    completeness.done,
    completeness.total,
    soldListings,
    dealCount,
    vouchesIn,
  ])

  // Prefer marketplace_activity rows when present; fill with derived real events
  const liveDashboardTimeline = useMemo(() => {
    const mapActivityIcon = (type = '') => {
      const t = String(type).toLowerCase()
      if (t.includes('sold') || t.includes('sale')) return { icon: 'checkCircle', tone: 'sold' }
      if (t.includes('feature') || t.includes('boost')) return { icon: 'star', tone: 'feat' }
      if (t.includes('follow')) return { icon: 'users', tone: 'net' }
      if (t.includes('verify')) return { icon: 'shieldCheck', tone: 'ok' }
      if (t.includes('relist')) return { icon: 'refreshCw', tone: 'list' }
      if (t.includes('vouch')) return { icon: 'heart', tone: 'vouch' }
      if (t.includes('created') || t.includes('list')) return { icon: 'package', tone: 'list' }
      return { icon: 'activity', tone: 'list' }
    }

    const fromDb = (activityFeed || []).slice(0, 20).map((a) => {
      const { icon, tone } = mapActivityIcon(a.activity_type)
      const listingId = a.entity_type === 'listing' ? a.entity_id : null
      return {
        id: `db-${a.id}`,
        listingId,
        when: a.created_at,
        text: a.title || a.body || 'Activity',
        icon,
        tone,
        onClick: listingId
          ? () => navigate('/listing/' + listingId)
          : a.activity_type?.includes('follow')
            ? () => openGroup('network')
            : a.activity_type?.includes('verify')
              ? () => openGroup('trust')
              : undefined,
      }
    })

    if (!fromDb.length) return dashboardTimeline

    const seen = new Set()
    const merged = []
    // DB activity first (authoritative event log), then client-derived real events
    ;[...fromDb, ...dashboardTimeline].forEach((e) => {
      if (!e?.when || !e?.text) return
      const day = String(e.when).slice(0, 10)
      const k = `${String(e.text).toLowerCase()}|${day}`
      if (seen.has(k)) return
      seen.add(k)
      merged.push(e)
    })
    return merged
      .sort((a, b) => new Date(b.when || 0) - new Date(a.when || 0))
      .slice(0, 12)
  }, [activityFeed, dashboardTimeline])

  if (loading) {
    return (
      <div className="mp-page">
        <style>{css}</style>
        <div className="mp-loading-shell">
          <div className="mp-od-skel mp-od-skel-topbar" />
          <div className="mp-od-skel mp-od-skel-hero" />
          <OverviewSkeleton />
        </div>
      </div>
    )
  }

  // Full nav catalog — Lucide icon keys (Phase 13); all existing features preserved
  const NAV_GROUPS = [
    { id: 'overview', icon: 'home', label: 'Overview', hint: 'Dashboard snapshot', keywords: 'home dashboard summary kpis' },
    { id: 'profile', icon: 'user', label: 'Profile Settings', hint: 'Name, photo & contact', keywords: 'edit identity phone city cover' },
    { id: 'selling', icon: 'package', label: 'Selling', hint: 'Active listings & shop', count: activeListing.length, keywords: 'listings inventory post shop' },
    { id: 'sold', icon: 'checkCircle', label: 'Sold', hint: 'Completed sales', count: soldListings.length, keywords: 'sold history completed deals' },
    { id: 'trust', icon: 'shieldCheck', label: 'Trust & Reputation', hint: 'Verification & vouches', keywords: 'verify badge vouch deals score' },
    { id: 'network', icon: 'users', label: 'Network', hint: 'Followers & following', count: followerCount, keywords: 'followers following social' },
    { id: 'buying', icon: 'shoppingBag', label: 'Buying & Discover', hint: 'Chats, saved, jobs', keywords: 'messages looking for shops services' },
    { id: 'account', icon: 'settings', label: 'Account & Security', hint: 'Sign-in & session', keywords: 'email password logout security member' },
  ]

  // Desktop groups (premium sidebar categories)
  const NAV_SECTIONS = [
    {
      title: 'Marketplace',
      items: NAV_GROUPS.filter(g => ['overview', 'selling', 'sold'].includes(g.id)),
    },
    {
      title: 'Profile',
      items: NAV_GROUPS.filter(g => ['profile', 'trust', 'network'].includes(g.id)),
    },
    {
      title: 'Account',
      items: NAV_GROUPS.filter(g => ['buying', 'account'].includes(g.id)),
    },
  ]

  const navQuery = navSearch.trim().toLowerCase()
  const NAV_SECTIONS_FILTERED = navQuery
    ? NAV_SECTIONS.map(section => ({
        ...section,
        items: section.items.filter(g => {
          const hay = `${g.label} ${g.hint} ${g.keywords || ''}`.toLowerCase()
          return hay.includes(navQuery)
        }),
      })).filter(section => section.items.length > 0)
    : NAV_SECTIONS

  // Mobile primary (6) + remaining in More
  const MOBILE_PRIMARY_IDS = ['overview', 'selling', 'network', 'buying', 'trust', 'account']
  const MOBILE_PRIMARY = MOBILE_PRIMARY_IDS.map(id => NAV_GROUPS.find(g => g.id === id)).filter(Boolean)
  const MOBILE_MORE = NAV_GROUPS.filter(g => !MOBILE_PRIMARY_IDS.includes(g.id))

  const activeNav =
    NAV_GROUPS.find(g => g.id === navKey) ||
    NAV_GROUPS.find(g => g.id === activeGroup) ||
    NAV_GROUPS[0]

  const BUYING_ITEMS = [
    { id: 'chats', icon: 'messageCircle', label: 'Messages', sub: 'Buyer & seller chats', path: '/chats', accent: 'green', badgeKey: 'unread', onClick: () => navigate('/chats') },
    { id: 'lf', icon: 'search', label: 'Looking for', sub: 'Post what you need · get offers', path: '/looking-for', accent: 'amber', badgeKey: 'lookingFor', onClick: () => navigate('/looking-for') },
    { id: 'saved', icon: 'heart', label: 'Saved items', sub: 'Statuses & items you bookmarked', path: '/saved-statuses', accent: 'blue', badgeKey: 'saved', onClick: () => navigate('/saved-statuses') },
    { id: 'shops', icon: 'store', label: 'Browse shops', sub: 'Local businesses & storefronts', path: '/shops', accent: 'green', onClick: () => navigate('/shops') },
    { id: 'jobs', icon: 'briefcase', label: 'Jobs', sub: 'Work near you in Malawi', path: '/jobs', accent: 'blue', onClick: () => navigate('/jobs') },
    { id: 'services', icon: 'wrench', label: 'Services', sub: 'Hire or offer skilled help', path: '/services', accent: 'amber', onClick: () => navigate('/services') },
    { id: 'notif', icon: 'bell', label: 'Notifications', sub: 'Alerts, deals & updates', path: '/notifications', accent: 'red', badgeKey: 'notifs', onClick: () => navigate('/notifications') },
  ]

  const TRENDING_CATEGORIES = [
    { id: 'electronics', label: 'Electronics', icon: 'smartphone', q: 'Electronics' },
    { id: 'furniture', label: 'Furniture', icon: 'sofa', q: 'Furniture' },
    { id: 'vehicles', label: 'Vehicles', icon: 'car', q: 'Vehicles' },
    { id: 'fashion', label: 'Clothing', icon: 'shirt', q: 'Clothing' },
    { id: 'property', label: 'Property', icon: 'building2', q: 'Property' },
    { id: 'agri', label: 'Agriculture', icon: 'wheat', q: 'Agriculture' },
    { id: 'food', label: 'Food', icon: 'utensils', q: 'Food' },
    { id: 'services', label: 'Services', icon: 'wrench', q: 'Services' },
  ]

  const buyerContinue = [
    { id: 'c-chats', icon: 'messageCircle', title: 'Continue chatting', sub: buyerStats.unread > 0 ? `${buyerStats.unread} unread message${buyerStats.unread === 1 ? '' : 's'}` : 'Pick up a conversation', onClick: () => navigate('/chats'), hot: (buyerStats.unread || 0) > 0 },
    { id: 'c-lf', icon: 'search', title: 'Your Looking for requests', sub: buyerStats.lookingFor > 0 ? `${buyerStats.lookingFor} active request${buyerStats.lookingFor === 1 ? '' : 's'}` : 'Post what you need', onClick: () => navigate('/looking-for'), hot: (buyerStats.lookingFor || 0) > 0 },
    { id: 'c-saved', icon: 'heart', title: 'Saved for later', sub: buyerStats.saved > 0 ? `${buyerStats.saved} saved item${buyerStats.saved === 1 ? '' : 's'}` : 'Browse and save favourites', onClick: () => navigate('/saved-statuses'), hot: (buyerStats.saved || 0) > 0 },
    { id: 'c-shops', icon: 'store', title: 'Browse local shops', sub: 'Discover storefronts near you', onClick: () => navigate('/shops'), hot: false },
  ]

  const buyerBadge = (key) => {
    if (!key) return null
    const n = buyerStats[key]
    if (n == null || n <= 0) return null
    return n > 99 ? '99+' : n
  }

  const SELLING_ACTIONS = [
    { id: 'post', icon: 'plusCircle', label: 'Post listing', sub: 'Sell something new', accent: 'green', onClick: () => navigate('/post') },
    {
      id: 'shop',
      icon: 'store',
      label: shop ? 'View shop' : 'Create shop',
      sub: shop ? shop.name : 'Business storefront',
      accent: 'amber',
      onClick: () => navigate(shopPath),
    },
    {
      id: 'status',
      icon: 'megaphone',
      label: 'Post availability',
      sub: activeStatus ? 'Live now — update' : "Let buyers know you're free",
      accent: 'blue',
      onClick: () => setShowStatusPicker(true),
    },
    {
      id: 'public',
      icon: 'eye',
      label: 'View public profile',
      sub: 'How buyers see you',
      accent: 'slate',
      onClick: () => navigate('/profile/' + user.id),
    },
  ]
  const invFeaturedCount = featuredListings.length

  return (
    <div className="mp-page">
      <style>{css}</style>

      {/* Branded top bar — full width on all devices */}
      <header className={`mp-topbar${mobileSearchOpen ? ' is-search-open' : ''}${mobileSectionMenuOpen ? ' is-menu-open' : ''}`}>
        <div className="mp-topbar-inner">
          {/* Desktop brand */}
          <div className="mp-brand-block mp-brand-desk">
            <button
              type="button"
              className="mp-wordmark-btn"
              onClick={() => navigate('/')}
              aria-label="SokoMw home"
            >
              <span className="mp-wordmark-soko">Soko</span>
              <span className="mp-wordmark-mw">Mw</span>
            </button>
            <div className="mp-topbar-divider" aria-hidden="true" />
            <div className="mp-topbar-titles">
              <h1 className="mp-topbar-title">
                <span className="mp-title-phone">Profile</span>
                <span className="mp-title-desk">Seller dashboard</span>
              </h1>
              <p className="mp-topbar-kicker">Marketplace control center</p>
            </div>
          </div>

          {/* Mobile: clean section switcher (no wordmark) */}
          <div className="mp-mob-section-dd" ref={mobileSectionMenuRef}>
            <button
              type="button"
              className={`mp-mob-section-btn${mobileSectionMenuOpen ? ' is-open' : ''}`}
              onClick={() => {
                setMobileSectionMenuOpen(v => !v)
                setMobileSearchOpen(false)
              }}
              aria-expanded={mobileSectionMenuOpen}
              aria-haspopup="menu"
              aria-label="Dashboard section"
            >
              <MpIcon name={activeNav.icon || activeNav.id || 'home'} size={18} />
              <span className="mp-mob-section-label">{activeNav.label}</span>
              <span className={`mp-mob-section-chev${mobileSectionMenuOpen ? ' is-open' : ''}`} aria-hidden="true">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </span>
            </button>
            {mobileSectionMenuOpen && (
              <>
                <button
                  type="button"
                  className="mp-mob-section-scrim"
                  aria-label="Close menu"
                  onClick={() => setMobileSectionMenuOpen(false)}
                />
                <div className="mp-mob-section-menu" role="menu" aria-label="Profile sections">
                  {NAV_GROUPS.map(g => {
                    const active = isNavActive(g.id)
                    return (
                      <button
                        key={g.id}
                        type="button"
                        role="menuitem"
                        className={`mp-mob-section-item${active ? ' is-active' : ''}`}
                        onClick={() => openGroup(g.id)}
                      >
                        <span className="mp-mob-section-item-ic" aria-hidden="true">
                          <MpIcon name={g.icon || g.id} size={18} />
                        </span>
                        <span className="mp-mob-section-item-copy">
                          <strong>{g.label}</strong>
                          <span>{g.hint}</span>
                        </span>
                        {typeof g.count === 'number' && g.count > 0 && (
                          <em className="mp-mob-section-item-count">{g.count > 99 ? '99+' : g.count}</em>
                        )}
                        {active && (
                          <span className="mp-mob-section-check" aria-hidden="true">
                            <MpIcon name="check" size={16} />
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </div>

          <div className="mp-topbar-actions">
            <button
              type="button"
              className={`mp-top-btn mp-top-btn-search${mobileSearchOpen ? ' is-active' : ''}`}
              onClick={() => {
                if (activeGroup !== 'selling') {
                  openGroup('selling')
                  setMobileSearchOpen(true)
                  setMobileSectionMenuOpen(false)
                  return
                }
                setMobileSearchOpen(v => !v)
                setMobileSectionMenuOpen(false)
              }}
              aria-label={mobileSearchOpen ? 'Close search' : 'Search listings'}
              aria-expanded={mobileSearchOpen}
              title="Search listings"
            >
              {mobileSearchOpen ? (
                <MpIcon name="x" size={18} />
              ) : (
                <MpIcon name="search" size={18} />
              )}
            </button>
            <button
              type="button"
              className="mp-top-btn mp-top-btn-public"
              onClick={() => navigate('/profile/' + user.id)}
              title="Public profile"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              <span>Public</span>
            </button>
            <button
              type="button"
              className="mp-top-btn mp-top-btn-out"
              onClick={confirmSignOut}
              title="Sign out"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              <span>Sign out</span>
            </button>
          </div>
        </div>

        {/* Mobile only: search panel */}
        {mobileSearchOpen && (
          <div className="mp-mob-search-panel" role="search" aria-label="Search listings">
            <label className="mp-inv-search mp-mob-search-field">
              <span className="mp-inv-search-ic" aria-hidden="true">
                <MpIcon name="search" size={15} />
              </span>
              <input
                ref={mobileSearchInputRef}
                type="search"
                className="mp-inv-search-input"
                placeholder={invStatus === 'sold' ? 'Search sold listings…' : 'Search title, place, category…'}
                value={invSearch}
                onChange={e => setInvSearch(e.target.value)}
                aria-label="Search listings"
              />
              {invSearch && (
                <button type="button" className="mp-inv-search-clear" onClick={() => setInvSearch('')} aria-label="Clear search">✕</button>
              )}
            </label>
            <div className="mp-mob-search-filters">
              <label className="mp-inv-field">
                <span className="mp-inv-field-label">Category</span>
                <select
                  className="mp-inv-select"
                  value={invCategory}
                  onChange={e => { setInvCategory(e.target.value); setInvSelected([]) }}
                  aria-label="Filter by category"
                >
                  <option value="all">All categories</option>
                  {(invStatus === 'sold' ? soldCategories : invCategories).map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>
              {invStatus !== 'sold' && (
                <label className="mp-inv-field">
                  <span className="mp-inv-field-label">Status</span>
                  <select
                    className="mp-inv-select"
                    value={invStatus}
                    onChange={e => setInventoryStatus(e.target.value)}
                    aria-label="Filter by status"
                  >
                    <option value="active">Active ({activeListing.length})</option>
                    <option value="sold">Sold ({soldListings.length})</option>
                    <option value="featured">Featured ({invFeaturedCount})</option>
                    <option value="all">All listings</option>
                  </select>
                </label>
              )}
              <label className="mp-inv-field">
                <span className="mp-inv-field-label">Sort</span>
                <select
                  className="mp-inv-select"
                  value={invSort}
                  onChange={e => setInvSort(e.target.value)}
                  aria-label="Sort listings"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="price_desc">Price · high to low</option>
                  <option value="price_asc">Price · low to high</option>
                  <option value="title">Title A–Z</option>
                </select>
              </label>
            </div>
            {(invSearch || invCategory !== 'all' || (invStatus !== 'active' && invStatus !== 'sold')) && (
              <button
                type="button"
                className="mp-mob-search-clear-all"
                onClick={() => {
                  setInvSearch('')
                  setInvCategory('all')
                  if (invStatus !== 'sold') setInventoryStatus('active')
                }}
              >
                Clear filters
              </button>
            )}
          </div>
        )}
      </header>

      {/* ═══ STEP 4 — Premium marketplace hero (UI only) ═══ */}
      <section className="mp-hero-premium" aria-label="Profile identity">
        {/* Media stage: cover + overlays only (no empty content zone) */}
        <div className={`mp-hero-media${profile.cover_url ? ' has-photo' : ''}`}>
          <div
            className="mp-hero-cover"
            role="img"
            aria-label={profile.cover_url ? 'Profile cover photo' : 'Marketplace profile cover'}
          >
            {profile.cover_url ? (
              <img className="mp-hero-cover-img" src={profile.cover_url} alt="" decoding="async" />
            ) : (
              <div className="mp-hero-cover-fallback" aria-hidden="true">
                <div className="mp-hero-blob mp-hero-blob-a" />
                <div className="mp-hero-blob mp-hero-blob-b" />
                <div className="mp-hero-blob mp-hero-blob-c" />
                <div className="mp-hero-market-grid" />
                <div className="mp-hero-pattern" />
                <div className="mp-hero-banner-label">
                  <span className="mp-hero-banner-brand">Soko<span>Mw</span></span>
                  <span className="mp-hero-banner-tag">Malawi marketplace</span>
                </div>
              </div>
            )}
          </div>
          <div className="mp-hero-overlay-dark" aria-hidden="true" />
          <div className="mp-hero-overlay-grad" aria-hidden="true" />
          <div className="mp-hero-overlay-blur" aria-hidden="true" />

          <div className="mp-cover-actions">
            <button
              type="button"
              className="mp-cover-btn"
              onClick={() => coverRef.current?.click()}
              disabled={uploadingCover}
              title="Recommended: wide landscape photo (about 1200×450)"
            >
              {uploadingCover ? 'Uploading…' : profile.cover_url ? 'Change cover' : 'Add cover'}
            </button>
            {profile.cover_url && !uploadingCover && (
              <button type="button" className="mp-cover-btn mp-cover-btn-ghost" onClick={removeCover}>Remove</button>
            )}
          </div>
        </div>

        {/* Compact 3-col dashboard body */}
        <div className="mp-hero-panel">
          <div className="mp-hero-panel-inner">
            <div className="mp-hero-grid">
              {/* LEFT — compact profile identity */}
              <div className="mp-hero-col mp-hero-col-id">
                <div className="mp-hero-id-block">
                  <button
                    type="button"
                    className="mp-avatar-btn mp-hero-avatar"
                    onClick={() => fileRef.current?.click()}
                    disabled={uploadingAvatar}
                    aria-label="Change profile photo"
                  >
                    <div className="mp-avatar-ring">
                      <div className="mp-avatar">
                        {profile.avatar_url
                          ? <img src={profile.avatar_url} alt="" />
                          : <span>{(profile.full_name || user.email || 'U')[0].toUpperCase()}</span>}
                        {uploadingAvatar && <div className="mp-avatar-overlay"><div className="mp-spinner" /></div>}
                      </div>
                    </div>
                    <span className="mp-avatar-cam" aria-hidden="true">📷</span>
                  </button>

                  <div className="mp-hero-id">
                    <div className="mp-hero-name-row">
                      <h2 className="mp-name" title={profile.full_name || ''}>
                        <span className="mp-name-text">{profile.full_name || 'Add your name'}</span>
                        {profile.is_verified && (
                          <span className="mp-name-seal" title="Verified"><VerifiedSeal size={18} /></span>
                        )}
                      </h2>
                    </div>
                    {online && (
                      <span className="mp-online" style={{ color: online.color }}>
                        <i style={{ background: online.color }} />
                        {online.label}
                      </span>
                    )}
                    <div className="mp-hero-meta-row">
                      <span className="mp-hero-meta-item">
                        <span className="mp-hero-meta-ic" aria-hidden="true">📍</span>
                        {profile.city || 'City not set'}
                      </span>
                    </div>
                    <div
                      className={`mp-hero-level mp-level-badge--t${sellerLevel.tier}`}
                      title={`${sellerLevel.name} — ${sellerLevel.label}`}
                    >
                      <span className="mp-hero-level-ic" aria-hidden="true">
                        <MpIcon name={sellerLevelIcon(sellerLevel.tier)} size={14} />
                      </span>
                      <span className="mp-hero-level-text">
                        <strong title={sellerLevel.name}>{sellerLevel.name}</strong>
                        <em title={sellerLevel.label}>Seller level</em>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Compact premium trust card under identity */}
                <div className="mp-trust-card">
                  <div className="mp-trust-card-top">
                    <span className="mp-trust-card-label">Trust</span>
                    {!trustLoading && <TrustBadge trustScore={trustScore} dealCount={dealCount} />}
                  </div>
                  <div className="mp-trust-card-foot">
                    <span>{profile.is_verified ? 'Verified · ' : ''}{dealCount || 0} deals</span>
                    <button type="button" className="mp-link" onClick={() => openGroup('trust')}>Open</button>
                  </div>
                </div>
              </div>

              {/* CENTER — dashboard: stats under identity band, then actions */}
              <div className="mp-hero-col mp-hero-col-main">
                <div className="mp-hero-stats" aria-label="Marketplace activity">
                  <button type="button" className="mp-hero-stat" onClick={() => openGroup('network')}>
                    <span className="mp-hero-stat-ic" aria-hidden="true"><MpIcon name="users" size={16} /></span>
                    <strong className="mp-hero-stat-n">{followerCount}</strong>
                    <span className="mp-hero-stat-l">Followers</span>
                  </button>
                  <button type="button" className="mp-hero-stat" onClick={() => openGroup('network')}>
                    <span className="mp-hero-stat-ic" aria-hidden="true"><MpIcon name="link2" size={16} /></span>
                    <strong className="mp-hero-stat-n">{followingCount}</strong>
                    <span className="mp-hero-stat-l">Following</span>
                  </button>
                  <button type="button" className="mp-hero-stat" onClick={() => openGroup('trust')}>
                    <span className="mp-hero-stat-ic" aria-hidden="true"><MpIcon name="badgeCheck" size={16} /></span>
                    <strong className="mp-hero-stat-n">{dealCount || 0}</strong>
                    <span className="mp-hero-stat-l">Deals</span>
                  </button>
                  <button type="button" className="mp-hero-stat" onClick={() => openGroup('selling')}>
                    <span className="mp-hero-stat-ic" aria-hidden="true"><MpIcon name="package" size={16} /></span>
                    <strong className="mp-hero-stat-n">{activeListing.length}</strong>
                    <span className="mp-hero-stat-l">Listings</span>
                  </button>
                </div>

                <div className="mp-hero-actions" aria-label="Primary actions">
                  <button type="button" className="mp-hbtn mp-hbtn-primary" onClick={() => navigate('/post')}>
                    Post listing
                  </button>
                  <button type="button" className="mp-hbtn" onClick={() => navigate('/profile/' + user.id)}>
                    View public profile
                  </button>
                  <button type="button" className="mp-hbtn" onClick={() => openGroup('settings', { edit: true })}>
                    Edit profile
                  </button>
                  <button type="button" className="mp-hbtn" onClick={shareProfile}>
                    Share profile
                  </button>
                  <div className="mp-hero-more" ref={heroMoreRef}>
                    <button
                      type="button"
                      className={`mp-hbtn mp-hbtn-more${heroMoreOpen ? ' is-open' : ''}`}
                      onClick={() => setHeroMoreOpen(v => !v)}
                      aria-expanded={heroMoreOpen}
                      aria-haspopup="menu"
                    >
                      More <span aria-hidden="true">▾</span>
                    </button>
                    {heroMoreOpen && (
                      <div className="mp-hero-more-menu" role="menu">
                        <button type="button" role="menuitem" onClick={() => { setHeroMoreOpen(false); setShowStatusPicker(true) }}>
                          Post availability
                        </button>
                        {!profile.is_verified && (
                          <button type="button" role="menuitem" onClick={() => { setHeroMoreOpen(false); setShowVerify(true) }}>
                            Get verified
                          </button>
                        )}
                        <button type="button" role="menuitem" onClick={copyProfileLink}>
                          Copy profile link
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mp-hero-chips" aria-label="Marketplace shortcuts">
                  <button type="button" className="mp-hchip" onClick={() => setShowStatusPicker(true)}>
                    <span aria-hidden="true"><MpIcon name="megaphone" size={14} /></span>
                    Availability
                  </button>
                  {!profile.is_verified ? (
                    <button type="button" className="mp-hchip mp-hchip-blue" onClick={() => setShowVerify(true)}>
                      <span aria-hidden="true"><MpIcon name="shieldCheck" size={14} /></span>
                      Get verified
                    </button>
                  ) : (
                    <button type="button" className="mp-hchip mp-hchip-ok" onClick={() => openGroup('trust')}>
                      <span aria-hidden="true"><MpIcon name="badgeCheck" size={14} /></span>
                      Verified
                    </button>
                  )}
                  <button type="button" className="mp-hchip" onClick={() => navigate(shopPath)}>
                    <span aria-hidden="true"><MpIcon name="store" size={14} /></span>
                    My shop
                  </button>
                  <button type="button" className="mp-hchip" onClick={() => openGroup('selling')}>
                    <span aria-hidden="true"><MpIcon name="package" size={14} /></span>
                    Active listings
                  </button>
                </div>
                {shareToast && <div className="mp-share-toast" role="status">{shareToast}</div>}
              </div>

              {/* RIGHT — Profile Strength only (keeps hero short) */}
              <aside className="mp-hero-col mp-hero-col-side" aria-label="Profile strength">
                <div className="mp-hero-insight-card mp-hero-strength-card">
                  <div className="mp-hero-insight-label">Profile strength</div>
                  <div className="mp-hero-strength">
                    <div
                      className="mp-hero-ring"
                      style={{ background: `conic-gradient(#0F9D58 ${completeness.pct * 3.6}deg, #e6ebe7 0deg)` }}
                      aria-hidden="true"
                    >
                      <div className="mp-hero-ring-hole">
                        <strong>{completeness.pct}%</strong>
                      </div>
                    </div>
                    <div className="mp-hero-strength-copy">
                      <strong className="mp-hero-strength-frac">{completeness.done}/{completeness.total}</strong>
                      <span>checks complete</span>
                    </div>
                  </div>
                  {completeness.next ? (
                    <button type="button" className="mp-hero-next" onClick={handleNextCompleteness}>
                      <span className="mp-hero-next-k">Next step</span>
                      <strong>{completeness.next.tip}</strong>
                      <em>Complete {completeness.next.label} →</em>
                    </button>
                  ) : (
                    <p className="mp-hero-strength-ok">Profile is complete — buyers will trust you more.</p>
                  )}
                </div>
              </aside>
            </div>
          </div>
        </div>

        <input ref={fileRef} type="file" accept="image/*" hidden onChange={uploadAvatar} />
        <input ref={coverRef} type="file" accept="image/jpeg,image/png,image/webp,image/*" hidden onChange={uploadCover} />
      </section>

      {/* ═══ Body: sticky vertical nav (desktop) · bottom nav (mobile) ═══ */}
      <div className="mp-shell is-detail">
      {/* LEFT — Premium desktop navigation card */}
      <aside className="mp-col mp-col-nav" aria-label="Dashboard navigation">
        <nav className="mp-pnav-desk" aria-label="Profile sections">
          <div className="mp-pnav-desk-head">
            <span className="mp-pnav-desk-badge">Navigate</span>
            <p className="mp-pnav-desk-title">Your dashboard</p>
            <p className="mp-pnav-desk-desc">Jump to any marketplace section</p>
            <label className="mp-pnav-search">
              <span className="mp-pnav-search-ic" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20l-3.5-3.5" />
                </svg>
              </span>
              <input
                type="search"
                className="mp-pnav-search-input"
                placeholder="Search sections…"
                value={navSearch}
                onChange={e => setNavSearch(e.target.value)}
                aria-label="Search profile sections"
                autoComplete="off"
              />
              {navSearch && (
                <button
                  type="button"
                  className="mp-pnav-search-clear"
                  onClick={() => setNavSearch('')}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </label>
          </div>

          {/* Scrollable section list — keeps search fixed, nav items scroll */}
          <div className="mp-pnav-desk-body">
            {NAV_SECTIONS_FILTERED.length === 0 ? (
              <p className="mp-pnav-empty">No sections match “{navSearch.trim()}”.</p>
            ) : (
              NAV_SECTIONS_FILTERED.map(section => (
                <div key={section.title} className="mp-pnav-section" role="group" aria-label={section.title}>
                  <div className="mp-pnav-section-label">{section.title}</div>
                  {section.items.map(g => {
                    const active = isNavActive(g.id)
                    return (
                      <button
                        key={g.id}
                        type="button"
                        className={`mp-pnav-item${active ? ' is-active' : ''}`}
                        onClick={() => openGroup(g.id)}
                        aria-current={active ? 'page' : undefined}
                      >
                        <span className="mp-pnav-item-bar" aria-hidden="true" />
                        <span className="mp-pnav-item-ic" aria-hidden="true">
                          <MpIcon name={g.icon || g.id} size={18} />
                        </span>
                        <span className="mp-pnav-item-copy">
                          <span className="mp-pnav-item-label">{g.label}</span>
                          <span className="mp-pnav-item-hint">{g.hint}</span>
                        </span>
                        {typeof g.count === 'number' && (
                          <em className="mp-pnav-item-count">{g.count}</em>
                        )}
                      </button>
                    )
                  })}
                </div>
              ))
            )}
          </div>
        </nav>
      </aside>

      {/* CENTER — Current section */}
      <div className="mp-col mp-col-detail" role="region" aria-label={activeNav.label}>
        <div className="mp-detail-bar">
          <div className="mp-detail-title-wrap">
            <span className="mp-detail-ic" aria-hidden="true">
              <MpIcon name={activeNav.icon || activeNav.id} size={18} />
            </span>
            <div>
              <h2 className="mp-detail-title">{activeNav.label}</h2>
              <p className="mp-detail-sub">{activeNav.hint}</p>
            </div>
          </div>
          {activeGroup === 'selling' && (
            <button type="button" className="mp-btn-primary mp-detail-cta" onClick={() => navigate('/post')}>
              + Post listing
            </button>
          )}
          {activeGroup === 'settings' && (
            <button type="button" className="mp-btn-secondary mp-detail-cta" onClick={() => setEditMode(true)}>
              Edit profile
            </button>
          )}
        </div>

        <div className="mp-detail-body">
      {/* OVERVIEW — Phase 6 premium seller control center */}
      {activeGroup === 'overview' && (
        <div className="mp-odash">
          {/* 1. Welcome Dashboard */}
          <section className="mp-od-welcome" aria-label="Welcome dashboard">
            <div className="mp-od-welcome-main">
              <p className="mp-od-welcome-kicker">Seller control center</p>
              <h3 className="mp-od-welcome-hello">
                Welcome back{profile.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
              </h3>
              <p className="mp-od-welcome-lead">
                {profile.city ? `${profile.city} · ` : ''}
                {accountType}
                {memberSince ? ` · Member since ${memberSince}` : ''}
                {online ? ` · ${online.label}` : ''}
              </p>
              <div className="mp-od-welcome-chips">
                <div className={`mp-od-chip mp-od-chip-level mp-level-badge--t${sellerLevel.tier}`}>
                  <span aria-hidden="true">
                    <MpIcon name={sellerLevelIcon(sellerLevel.tier)} size={14} />
                  </span>
                  <div>
                    <strong>{sellerLevel.name}</strong>
                    <em>{sellerLevel.label}</em>
                  </div>
                </div>
                <div className="mp-od-chip mp-od-chip-trust">
                  <span className="mp-od-chip-k">Trust</span>
                  {!trustLoading ? (
                    <TrustBadge trustScore={trustScore} dealCount={dealCount} />
                  ) : (
                    <span className="mp-od-skel mp-od-skel-inline" aria-hidden="true" />
                  )}
                </div>
                <div className="mp-od-chip">
                  <span className="mp-od-chip-k">Strength</span>
                  <strong>{completeness.pct}%</strong>
                </div>
                <div className="mp-od-chip">
                  <span className="mp-od-chip-k">Live</span>
                  <strong>{activeListing.length} listings</strong>
                </div>
              </div>
            </div>
            <div className="mp-od-welcome-side">
              <div className="mp-od-welcome-summary">
                <div className="mp-od-summary-row">
                  <span>Deals</span><strong>{dealCount || 0}</strong>
                </div>
                <div className="mp-od-summary-row">
                  <span>Sold</span><strong>{soldListings.length}</strong>
                </div>
                <div className="mp-od-summary-row">
                  <span>Followers</span><strong>{followerCount}</strong>
                </div>
                <div className="mp-od-summary-row">
                  <span>Identity</span>
                  <strong>{profile.is_verified ? 'Verified' : 'Pending'}</strong>
                </div>
              </div>
              <div className="mp-od-welcome-cta">
                <button type="button" className="mp-btn-primary" onClick={() => navigate('/post')}>
                  + Post listing
                </button>
                <button type="button" className="mp-btn-secondary" onClick={() => openGroup('trust')}>
                  View trust
                </button>
              </div>
            </div>
          </section>

          {/* Contact & business — preserved features */}
          <section className="mp-od-panel mp-od-contact" aria-label="Contact and business">
            <SectionHeader
              title="Contact & business"
              subtitle="Details buyers see on your listings and storefront."
              actionLabel="Edit profile →"
              onAction={() => openGroup('profile', { edit: true })}
            />
            <div className="mp-od-contact-grid">
              <div className="mp-od-contact-item">
                <span className="mp-od-contact-k">Location</span>
                <strong>{profile.city || 'Not set'}</strong>
              </div>
              <div className="mp-od-contact-item">
                <span className="mp-od-contact-k">Phone</span>
                <strong className={!profile.phone ? 'is-miss' : ''}>{profile.phone || 'Add number'}</strong>
                {!profile.phone && (
                  <button type="button" className="mp-link" onClick={() => openGroup('profile', { edit: true })}>Add</button>
                )}
              </div>
              <div className="mp-od-contact-item">
                <span className="mp-od-contact-k">Email</span>
                <strong className="mp-od-contact-muted" title={user.email}>{user.email}</strong>
              </div>
              <button type="button" className="mp-od-contact-item mp-od-contact-shop" onClick={() => navigate(shopPath)}>
                <span className="mp-od-contact-k">{shop ? 'Your shop' : 'Shop'}</span>
                <strong>{shop ? shop.name : 'Create a storefront'}</strong>
                <span className="mp-od-contact-chev">{shop ? 'Open' : 'Set up'} →</span>
              </button>
            </div>
          </section>

          {/* 2. Marketplace Statistics */}
          <section className="mp-od-section" aria-label="Marketplace statistics">
            <SectionHeader
              title="Marketplace statistics"
              subtitle="Live snapshot of your selling performance."
              actionLabel="Open inventory →"
              onAction={() => openGroup('selling')}
            />
            <div className="mp-od-stats-grid">
              <StatCard
                icon="package"
                label="Active listings"
                value={activeListing.length}
                hint="In your inventory"
                trend={activeListing.length > 0 ? 'Live' : 'Empty'}
                trendUp={activeListing.length > 0}
                onClick={() => openGroup('selling')}
              />
              <StatCard
                icon="checkCircle"
                label="Sold listings"
                value={soldListings.length}
                hint="Completed sales"
                trend={soldListings.length > 0 ? 'Sales' : '—'}
                trendUp={soldListings.length > 0}
                onClick={() => openGroup('sold')}
              />
              <StatCard
                icon="users"
                label="Followers"
                value={followerCount}
                hint="People following you"
                onClick={() => openGroup('network')}
              />
              <StatCard
                icon="link2"
                label="Following"
                value={followingCount}
                hint="Sellers you follow"
                onClick={() => openGroup('network')}
              />
              <StatCard
                icon="badgeCheck"
                label="Deals"
                value={dealCount || 0}
                hint="Confirmed trades"
                onClick={() => openGroup('trust')}
              />
              <StatCard
                icon="eye"
                label="Profile views"
                value={profileViewsCount != null ? profileViewsCount : '—'}
                hint={listingViewsTotal != null ? `${listingViewsTotal} listing views` : 'Public profile visits'}
                trend={profileViewsCount != null ? 'Live' : '—'}
                trendUp={profileViewsCount > 0}
                placeholder={profileViewsCount == null}
              />
            </div>
          </section>

          {/* 3. Quick Actions */}
          <section className="mp-od-section" aria-label="Quick actions">
            <SectionHeader
              title="Quick actions"
              subtitle="Jump into the tools you use most."
            />
            <div className="mp-od-actions-grid">
              <QuickActionCard
                icon="plusCircle"
                label="Post listing"
                sub="Sell something new"
                accent="green"
                onClick={() => navigate('/post')}
              />
              <QuickActionCard
                icon="store"
                label={shop ? 'View shop' : 'Create shop'}
                sub={shop ? shop.name : 'Business storefront'}
                onClick={() => navigate(shopPath)}
              />
              <QuickActionCard
                icon="megaphone"
                label="Post availability"
                sub={activeStatus ? 'Live now — update' : "Let buyers know you're free"}
                onClick={() => setShowStatusPicker(true)}
              />
              <QuickActionCard
                icon="eye"
                label="View public profile"
                sub="How buyers see you"
                onClick={() => navigate('/profile/' + user.id)}
              />
              <QuickActionCard
                icon="shieldCheck"
                label={profile.is_verified ? 'Verified' : 'Get verified'}
                sub={profile.is_verified ? 'Identity confirmed' : 'Sell faster with trust'}
                accent={profile.is_verified ? 'ok' : 'blue'}
                onClick={() => (profile.is_verified ? openGroup('trust') : setShowVerify(true))}
              />
            </div>
          </section>

          {/* 4. Seller Insights */}
          <section className="mp-od-section" aria-label="Seller insights">
            <SectionHeader
              title="Seller insights"
              subtitle="Strength, trust, tips, and growth signals."
              actionLabel="Full trust →"
              onAction={() => openGroup('trust')}
            />
            <div className="mp-od-insights-grid">
              <InsightCard
                title="Profile strength"
                footer={
                  completeness.next ? (
                    <button type="button" className="mp-od-link" onClick={handleNextCompleteness}>
                      Next: {completeness.next.label} →
                    </button>
                  ) : (
                    <span className="mp-od-muted">Profile complete for buyers</span>
                  )
                }
              >
                <div className="mp-od-strength">
                  <div
                    className="mp-od-ring"
                    style={{ background: `conic-gradient(#0F9D58 ${completeness.pct * 3.6}deg, #e8ece9 0deg)` }}
                    aria-hidden="true"
                  >
                    <div className="mp-od-ring-hole"><strong>{completeness.pct}%</strong></div>
                  </div>
                  <div>
                    <strong className="mp-od-strength-frac">{completeness.done}/{completeness.total}</strong>
                    <span className="mp-od-muted"> checks complete</span>
                    {completeness.next && (
                      <p className="mp-od-strength-tip">{completeness.next.tip}</p>
                    )}
                  </div>
                </div>
              </InsightCard>

              <InsightCard
                title="Trust summary"
                footer={
                  <button type="button" className="mp-od-link" onClick={() => openGroup('trust')}>
                    Open trust panel →
                  </button>
                }
              >
                <ul className="mp-od-kv">
                  <li><span>Deals</span><strong>{dealCount || 0}</strong></li>
                  <li><span>Identity</span><strong>{profile.is_verified ? 'Verified' : 'Pending'}</strong></li>
                  <li><span>Sold</span><strong>{soldListings.length}</strong></li>
                  <li><span>Score</span><strong>{trustLoading ? '…' : (trustScore?.total_score ?? '—')}</strong></li>
                </ul>
              </InsightCard>

              <InsightCard title="Tips">
                {insightTips[0] ? (
                  <div className="mp-od-tip">
                    <p>{insightTips[0].text}</p>
                    <button type="button" className="mp-tip-cta" onClick={insightTips[0].onClick}>
                      {insightTips[0].cta}
                    </button>
                  </div>
                ) : (
                  <p className="mp-od-muted">You&apos;re in great shape — keep listing and responding fast.</p>
                )}
                {insightTips.length > 1 && (
                  <ul className="mp-od-tip-extra">
                    {insightTips.slice(1).map(tip => (
                      <li key={tip.id}>
                        <span>{tip.text}</span>
                        <button type="button" className="mp-link" onClick={tip.onClick}>{tip.cta}</button>
                      </li>
                    ))}
                  </ul>
                )}
              </InsightCard>

              <InsightCard
                title="Recent activity"
                footer={
                  <button type="button" className="mp-od-link" onClick={() => openGroup('selling')}>
                    View inventory →
                  </button>
                }
              >
                {recentActivity.length === 0 ? (
                  <p className="mp-od-muted">No listing activity yet</p>
                ) : (
                  <ul className="mp-od-mini-act">
                    {recentActivity.slice(0, 4).map(item => (
                      <li key={item.id}>
                        <button type="button" className="mp-od-mini-act-btn" onClick={() => navigate('/listing/' + item.id)}>
                          <span>{item.text}</span>
                          <em>{timeAgoShort(item.when)}</em>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </InsightCard>

              <InsightCard title="Seller level" className="mp-od-insight-level">
                <div className="mp-od-level">
                  <div className={`mp-level-badge mp-level-badge--t${sellerLevel.tier}`} aria-hidden="true">
                    <MpIcon name={sellerLevelIcon(sellerLevel.tier)} size={16} />
                  </div>
                  <div>
                    <strong>{sellerLevel.name}</strong>
                    <span className="mp-od-muted">{sellerLevel.label}</span>
                  </div>
                </div>
                <div className="mp-complete-bar mp-od-level-bar">
                  <div className="mp-complete-fill" style={{ width: `${sellerLevel.pct}%` }} />
                </div>
                <p className="mp-od-muted">
                  {sellerLevel.next
                    ? <>Next: <strong>{sellerLevel.next}</strong>{sellerLevel.tip ? ` — ${sellerLevel.tip}` : ''}</>
                    : 'Top seller tier on SokoMw.'}
                </p>
              </InsightCard>

              <InsightCard title="Analytics (14 days)" className={analyticsBars ? '' : 'mp-od-insight-placeholder'}>
                {analyticsBars ? (
                  <>
                    <p className="mp-od-muted">
                      Views &amp; sales activity over the last two weeks.
                    </p>
                    <div className="mp-od-placeholder-bars" aria-hidden="true" title="Daily activity">
                      {analyticsBars.slice(-10).map((b) => (
                        <span
                          key={b.key}
                          style={{ height: `${b.height}%` }}
                          title={`${b.label || ''}: ${b.views} views, ${b.sales} sales`}
                        />
                      ))}
                    </div>
                    <em className="mp-od-soon">
                      {analyticsBars.reduce((s, b) => s + b.views, 0)} views ·{' '}
                      {analyticsBars.reduce((s, b) => s + b.sales, 0)} sales in period
                    </em>
                  </>
                ) : (
                  <>
                    <p className="mp-od-muted">
                      Daily rollups appear once profile/listing views are recorded. Stats RPC is ready.
                    </p>
                    <div className="mp-od-placeholder-bars" aria-hidden="true">
                      <span style={{ height: '20%' }} />
                      <span style={{ height: '35%' }} />
                      <span style={{ height: '28%' }} />
                      <span style={{ height: '42%' }} />
                      <span style={{ height: '30%' }} />
                    </div>
                    <em className="mp-od-soon">
                      {profileViewsCount != null || listingViewsTotal != null
                        ? `${profileViewsCount ?? 0} profile · ${listingViewsTotal ?? 0} listing views total`
                        : 'Waiting for first tracked views'}
                    </em>
                  </>
                )}
              </InsightCard>
            </div>
          </section>

          {/* 5. Latest Marketplace Activity */}
          <section className="mp-od-section mp-od-activity-section" aria-label="Latest marketplace activity">
            <SectionHeader
              title="Latest marketplace activity"
              subtitle="Real events from your listings, sales, follows, and trust history."
              actionLabel="Selling →"
              onAction={() => openGroup('selling')}
            />
            <div className="mp-od-panel mp-od-activity-panel">
              <ActivityTimeline
                items={liveDashboardTimeline}
                timeAgo={timeAgoShort}
                empty={
                  <EmptyState
                    icon="🚀"
                    title="Your timeline is ready"
                    text="Post a listing, get verified, or grow your network to fill this feed."
                    actionLabel="+ Post listing"
                    onAction={() => navigate('/post')}
                  />
                }
              />
            </div>
          </section>
        </div>
      )}

      {/* SELLING — Phase 7 premium inventory dashboard */}
      {activeGroup === 'selling' && invStatus !== 'sold' && (
        <div className="mp-inv">
          {/* Dashboard header */}
          <header className="mp-inv-hero" aria-label="Inventory overview">
            <div className="mp-inv-hero-copy">
              <p className="mp-inv-kicker">Seller inventory</p>
              <h2 className="mp-inv-hero-title">Manage your listings</h2>
              <p className="mp-inv-hero-sub">
                Search, filter, and update stock like a modern marketplace host.
              </p>
            </div>
            <div className="mp-inv-kpi-strip" aria-label="Inventory snapshot">
              <button type="button" className="mp-inv-kpi" onClick={() => setInventoryStatus('active')}>
                <strong>{activeListing.length}</strong>
                <span>Active</span>
              </button>
              <button type="button" className="mp-inv-kpi" onClick={() => setInventoryStatus('featured')}>
                <strong>{invFeaturedCount}</strong>
                <span>Featured</span>
              </button>
              <button type="button" className="mp-inv-kpi" onClick={() => openGroup('sold')}>
                <strong>{soldListings.length}</strong>
                <span>Sold</span>
              </button>
              <button type="button" className="mp-inv-kpi" onClick={() => setInventoryStatus('all')}>
                <strong>{listings.filter(l => l.status !== 'deleted').length}</strong>
                <span>All</span>
              </button>
            </div>
          </header>

          {/* Sticky toolbar — Search · Category · Status · Sort · Grid/List */}
          <div className="mp-inv-toolbar" role="search" aria-label="Inventory filters">
            <label className="mp-inv-search">
              <span className="mp-inv-search-ic" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
                </svg>
              </span>
              <input
                type="search"
                className="mp-inv-search-input"
                placeholder="Search title, place, category…"
                value={invSearch}
                onChange={e => setInvSearch(e.target.value)}
                aria-label="Search listings"
              />
              {invSearch && (
                <button type="button" className="mp-inv-search-clear" onClick={() => setInvSearch('')} aria-label="Clear search">✕</button>
              )}
            </label>

            <div className="mp-inv-filters">
              <label className="mp-inv-field">
                <span className="mp-inv-field-label">Category</span>
                <select
                  className="mp-inv-select"
                  value={invCategory}
                  onChange={e => { setInvCategory(e.target.value); setInvSelected([]) }}
                  aria-label="Filter by category"
                >
                  <option value="all">All categories</option>
                  {invCategories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label className="mp-inv-field">
                <span className="mp-inv-field-label">Status</span>
                <select
                  className="mp-inv-select"
                  value={invStatus}
                  onChange={e => setInventoryStatus(e.target.value)}
                  aria-label="Filter by status"
                >
                  <option value="active">Active ({activeListing.length})</option>
                  <option value="sold">Sold ({soldListings.length})</option>
                  <option value="featured">Featured ({invFeaturedCount})</option>
                  <option value="all">All listings</option>
                </select>
              </label>

              <label className="mp-inv-field">
                <span className="mp-inv-field-label">Sort</span>
                <select
                  className="mp-inv-select"
                  value={invSort}
                  onChange={e => setInvSort(e.target.value)}
                  aria-label="Sort listings"
                >
                  <option value="newest">Newest first</option>
                  <option value="oldest">Oldest first</option>
                  <option value="price_desc">Price · high to low</option>
                  <option value="price_asc">Price · low to high</option>
                  <option value="title">Title A–Z</option>
                </select>
              </label>

              <div className="mp-inv-view-toggle" role="group" aria-label="View mode">
                <button
                  type="button"
                  className={`mp-inv-view-btn${invView === 'grid' ? ' is-active' : ''}`}
                  onClick={() => setInvView('grid')}
                  aria-pressed={invView === 'grid'}
                  title="Grid view"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" />
                    <rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" />
                  </svg>
                  <span className="mp-inv-view-txt">Grid</span>
                </button>
                <button
                  type="button"
                  className={`mp-inv-view-btn${invView === 'list' ? ' is-active' : ''}`}
                  onClick={() => setInvView('list')}
                  aria-pressed={invView === 'list'}
                  title="List view"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  <span className="mp-inv-view-txt">List</span>
                </button>
              </div>
            </div>
          </div>

          {/* Quick actions — compact premium cards (same routes/handlers) */}
          <section className="mp-inv-actions" aria-label="Selling tools">
            {SELLING_ACTIONS.map(item => (
              <button
                key={item.id}
                type="button"
                className={`mp-inv-action mp-inv-action--${item.accent || 'green'}`}
                onClick={item.onClick}
              >
                <span className="mp-inv-action-ic" aria-hidden="true">
                  <MpIcon name={item.icon || 'package'} size={18} />
                </span>
                <span className="mp-inv-action-copy">
                  <span className="mp-inv-action-label">{item.label}</span>
                  <span className="mp-inv-action-sub">{item.sub}</span>
                </span>
                <span className="mp-inv-action-chev" aria-hidden="true">→</span>
              </button>
            ))}
          </section>

          {/* Inventory meta + select mode */}
          <div className="mp-inv-meta">
            <div className="mp-inv-meta-left">
              <h3 className="mp-inv-heading">
                {invStatus === 'sold' ? 'Sold inventory' : invStatus === 'featured' ? 'Featured listings' : invStatus === 'all' ? 'All inventory' : 'Active inventory'}
              </h3>
              <p className="mp-inv-count">
                {inventoryList.length} listing{inventoryList.length === 1 ? '' : 's'}
                {(invSearch || invCategory !== 'all') ? ' match your filters' : ''}
                {' · '}
                <span className="mp-inv-view-hint">{invView === 'grid' ? 'Grid view' : 'List view'}</span>
              </p>
            </div>
            <div className="mp-inv-meta-right">
              <button
                type="button"
                className={`mp-inv-select-toggle${invSelectMode ? ' is-on' : ''}`}
                onClick={() => {
                  setInvSelectMode(v => !v)
                  setInvSelected([])
                }}
                aria-pressed={invSelectMode}
              >
                {invSelectMode ? 'Cancel select' : 'Select'}
              </button>
              {invSelectMode && inventoryList.length > 0 && (
                <button
                  type="button"
                  className="mp-inv-select-all"
                  onClick={() => toggleSelectAllInventory(inventoryList.map(l => l.id))}
                >
                  {invSelected.length === inventoryList.length ? 'Clear all' : 'Select all'}
                </button>
              )}
            </div>
          </div>

          {/* Listings — skeleton while initial load, else cards */}
          <section className="mp-inv-listings" aria-label="Your listings" aria-busy={loading}>
            {loading ? (
              <div className={`mp-inv-grid mp-inv-grid--${invView}`} aria-hidden="true">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="mp-inv-skel-card">
                    <div className="mp-inv-skel-thumb" />
                    <div className="mp-inv-skel-lines">
                      <span /><span /><span />
                    </div>
                  </div>
                ))}
              </div>
            ) : inventoryList.length === 0 ? (
              <div className="mp-inv-empty">
                <div className="mp-inv-empty-art" aria-hidden="true">
                  <div className="mp-inv-empty-blob" />
                  <span className="mp-inv-empty-emoji">
                    <MpIcon name={invSearch || invCategory !== 'all' ? 'search' : invStatus === 'sold' ? 'checkCircle' : 'shoppingBag'} size={28} />
                  </span>
                </div>
                <h3>
                  {invSearch || invCategory !== 'all'
                    ? 'No listings match'
                    : invStatus === 'sold'
                      ? 'No sold items yet'
                      : invStatus === 'featured'
                        ? 'No featured listings'
                        : 'Your shelves are empty'}
                </h3>
                <p>
                  {invSearch || invCategory !== 'all'
                    ? 'Try a different search or clear filters to see more inventory.'
                    : invStatus === 'sold'
                      ? 'Mark a listing as sold when a buyer completes the deal — it builds your reputation.'
                      : invStatus === 'featured'
                        ? 'Feature a listing from edit to boost reach across SokoMw.'
                        : 'Post something to start selling on SokoMw. Complete listings sell faster.'}
                </p>
                <div className="mp-inv-empty-actions">
                  {(invSearch || invCategory !== 'all' || invStatus === 'featured') && (
                    <button
                      type="button"
                      className="mp-btn-secondary"
                      onClick={() => {
                        setInvSearch('')
                        setInvCategory('all')
                        setInventoryStatus('active')
                      }}
                    >
                      Clear filters
                    </button>
                  )}
                  {invStatus !== 'sold' && (
                    <button type="button" className="mp-btn-primary" onClick={() => navigate('/post')}>
                      Create Your First Listing
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div
                className={`mp-inv-grid mp-inv-grid--${invView}`}
              >
                {inventoryList.map((listing, idx) => {
                  const img = Array.isArray(listing.images) ? listing.images[0] : null
                  const isSold = listing.status === 'sold'
                  const isFeat = isListingFeatured(listing)
                  const selected = invSelected.includes(listing.id)
                  const place = listing.district || listing.city || '—'
                  const posted = listing.created_at || listing.updated_at
                  const views = listing.views ?? listing.view_count ?? null
                  const saves = listing.saves ?? listing.save_count ?? listing.favorites ?? null
                  return (
                    <article
                      key={listing.id}
                      className={`mp-inv-card${selected ? ' is-selected' : ''}${isSold ? ' is-sold' : ''}${isFeat ? ' is-feat' : ''}`}
                      style={{ animationDelay: `${Math.min(idx, 12) * 28}ms` }}
                    >
                      {invSelectMode && (
                        <label className="mp-inv-check">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleInvSelect(listing.id)}
                            aria-label={`Select ${listing.title || 'listing'}`}
                          />
                          <span className="mp-inv-check-box" aria-hidden="true" />
                        </label>
                      )}

                      <button
                        type="button"
                        className="mp-inv-thumb"
                        onClick={() => navigate('/listing/' + listing.id)}
                      >
                        {img ? (
                          <img src={img} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <span className="mp-inv-thumb-ph" aria-hidden="true"><MpIcon name="package" size={28} /></span>
                        )}
                        {isSold && <span className="mp-inv-badge mp-inv-badge-sold">Sold</span>}
                        {isFeat && !isSold && <span className="mp-inv-badge mp-inv-badge-feat">Featured</span>}
                        {!isSold && !isFeat && (
                          <span className="mp-inv-badge mp-inv-badge-live">Active</span>
                        )}
                      </button>

                      <div className="mp-inv-card-body">
                        <button
                          type="button"
                          className="mp-inv-card-main"
                          onClick={() => navigate('/listing/' + listing.id)}
                        >
                          <h4 className="mp-inv-card-title">{listing.title || 'Untitled'}</h4>
                          <div className="mp-inv-card-price">
                            MWK {Number(listing.price || 0).toLocaleString()}
                          </div>
                          <div className="mp-inv-card-meta">
                            <span className="mp-inv-meta-loc">
                              <MpIcon name="mapPin" size={11} /> {place}
                            </span>
                            <span aria-hidden="true">·</span>
                            <span>{posted ? `${timeAgoShort(posted)} ago` : '—'}</span>
                          </div>
                          <div className="mp-inv-card-stats">
                            <span title="Views" className="mp-inv-stat-chip">
                              <MpIcon name="eye" size={11} /> {views != null ? views : '—'}
                            </span>
                            <span title="Saves" className="mp-inv-stat-chip">
                              <MpIcon name="heart" size={11} /> {saves != null ? saves : '—'}
                            </span>
                            {listing.category || listing.category_name ? (
                              <span className="mp-inv-cat">{listing.category || listing.category_name}</span>
                            ) : null}
                          </div>
                        </button>

                        <div className="mp-inv-card-actions" role="group" aria-label="Listing actions">
                          <button
                            type="button"
                            className="mp-inv-icon-btn"
                            title="Edit"
                            aria-label="Edit listing"
                            onClick={() => navigate('/post/edit/' + listing.id)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className={`mp-inv-icon-btn${isSold ? '' : ' is-green'}`}
                            title={isSold ? 'Relist' : 'Mark as sold'}
                            aria-label={isSold ? 'Relist listing' : 'Mark as sold'}
                            onClick={() => toggleSold(listing)}
                          >
                            {isSold ? (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4" />
                              </svg>
                            ) : (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M20 6 9 17l-5-5" />
                              </svg>
                            )}
                          </button>
                          <button
                            type="button"
                            className="mp-inv-icon-btn"
                            title="Share"
                            aria-label="Share listing"
                            onClick={() => shareListing(listing)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                              <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="mp-inv-icon-btn is-boost"
                            title={
                              isFeat
                                ? 'Already featured'
                                : `Feature this listing (${featuredPriceLabel()} or free entitlement)`
                            }
                            aria-label={isFeat ? 'Already featured' : 'Feature this listing'}
                            disabled={!!featuringId || isFeat || isSold}
                            aria-disabled={!!featuringId || isFeat || isSold}
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              featureListing(listing)
                            }}
                          >
                            {featuringId === listing.id ? (
                              <span style={{ fontSize: 10, fontWeight: 700 }}>…</span>
                            ) : (
                              <svg width="15" height="15" viewBox="0 0 24 24" fill={isFeat ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                            )}
                          </button>
                          <button
                            type="button"
                            className="mp-inv-icon-btn is-danger"
                            title="Delete"
                            aria-label="Delete listing"
                            onClick={() => setDeleteConfirm(listing.id)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          {/* Bulk action bar — sticky; handlers preserved */}
          {invSelectMode && invSelected.length > 0 && (
            <div className="mp-inv-bulk" role="region" aria-label="Bulk actions">
              <span className="mp-inv-bulk-count">{invSelected.length} selected</span>
              <div className="mp-inv-bulk-actions">
                <button type="button" className="mp-inv-bulk-btn is-live" onClick={bulkMarkSold}>
                  Mark sold
                </button>
                <button type="button" className="mp-inv-bulk-btn is-live" onClick={bulkRelist}>
                  Relist
                </button>
                <button
                  type="button"
                  className="mp-inv-bulk-btn is-live"
                  onClick={bulkBoostSelected}
                  disabled
                  aria-disabled="true"
                  title="Bulk boost disabled — feature when posting"
                >
                  Boost
                </button>
                <button type="button" className="mp-inv-bulk-btn is-live is-danger" onClick={bulkDeleteSelected}>
                  Delete
                </button>
              </div>
              <p className="mp-inv-bulk-note">Applies to selected listings you own.</p>
            </div>
          )}

          {shareToast && activeGroup === 'selling' && invStatus !== 'sold' && (
            <div className="mp-share-toast mp-inv-toast" role="status">{shareToast}</div>
          )}
        </div>
      )}

      {/* SOLD — Phase 8 premium completed-sales dashboard */}
      {activeGroup === 'selling' && invStatus === 'sold' && (
        <div className="mp-sold">
          {/* KPI strip */}
          <section className="mp-sold-kpis" aria-label="Sold sales summary">
            <div className="mp-sold-kpi">
              <span className="mp-sold-kpi-ic" aria-hidden="true"><MpIcon name="checkCircle" size={18} /></span>
              <div>
                <span className="mp-sold-kpi-label">Total sold</span>
                <strong className="mp-sold-kpi-value">{soldDashboardStats.totalSold}</strong>
              </div>
            </div>
            <div className="mp-sold-kpi">
              <span className="mp-sold-kpi-ic" aria-hidden="true"><MpIcon name="badgeCheck" size={18} /></span>
              <div>
                <span className="mp-sold-kpi-label">Total deals</span>
                <strong className="mp-sold-kpi-value">{soldDashboardStats.totalDeals}</strong>
              </div>
            </div>
            <div className={`mp-sold-kpi${soldDashboardStats.salesRate == null ? ' is-placeholder' : ''}`}>
              <span className="mp-sold-kpi-ic" aria-hidden="true"><MpIcon name="trendingUp" size={18} /></span>
              <div>
                <span className="mp-sold-kpi-label">Sales rate</span>
                <strong className="mp-sold-kpi-value">
                  {soldDashboardStats.salesRate != null ? `${soldDashboardStats.salesRate}%` : '—'}
                </strong>
                <em className="mp-sold-kpi-hint">
                  {soldDashboardStats.salesRate != null ? 'Sold ÷ all listings' : 'No listings yet'}
                </em>
              </div>
            </div>
            <div className={`mp-sold-kpi${soldDashboardStats.avgAgeDays == null ? ' is-placeholder' : ''}`}>
              <span className="mp-sold-kpi-ic" aria-hidden="true"><MpIcon name="calendar" size={18} /></span>
              <div>
                <span className="mp-sold-kpi-label">Avg listing age</span>
                <strong className="mp-sold-kpi-value">
                  {soldDashboardStats.avgAgeDays != null ? `${soldDashboardStats.avgAgeDays}d` : '—'}
                </strong>
                <em className="mp-sold-kpi-hint">
                  {soldDashboardStats.avgAgeDays != null ? 'Create → sold' : 'Mark items sold'}
                </em>
              </div>
            </div>
          </section>

          {/* Sticky toolbar — Search, Category, Sort, Grid/List (no active inventory status) */}
          <div className="mp-inv-toolbar mp-sold-toolbar" role="search" aria-label="Sold listings filters">
            <label className="mp-inv-search">
              <span className="mp-inv-search-ic" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" />
                </svg>
              </span>
              <input
                type="search"
                className="mp-inv-search-input"
                placeholder="Search sold listings…"
                value={invSearch}
                onChange={e => setInvSearch(e.target.value)}
                aria-label="Search sold listings"
              />
              {invSearch && (
                <button type="button" className="mp-inv-search-clear" onClick={() => setInvSearch('')} aria-label="Clear search">✕</button>
              )}
            </label>

            <div className="mp-inv-filters">
              <label className="mp-inv-field">
                <span className="mp-inv-field-label">Category</span>
                <select
                  className="mp-inv-select"
                  value={invCategory}
                  onChange={e => setInvCategory(e.target.value)}
                  aria-label="Filter sold by category"
                >
                  <option value="all">All categories</option>
                  {soldCategories.map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </label>

              <label className="mp-inv-field">
                <span className="mp-inv-field-label">Sort</span>
                <select
                  className="mp-inv-select"
                  value={invSort}
                  onChange={e => setInvSort(e.target.value)}
                  aria-label="Sort sold listings"
                >
                  <option value="newest">Sold recently</option>
                  <option value="oldest">Sold longest ago</option>
                  <option value="price_desc">Price · high to low</option>
                  <option value="price_asc">Price · low to high</option>
                  <option value="title">Title A–Z</option>
                </select>
              </label>

              <div className="mp-inv-view-toggle" role="group" aria-label="View mode">
                <button
                  type="button"
                  className={`mp-inv-view-btn${invView === 'grid' ? ' is-active' : ''}`}
                  onClick={() => setInvView('grid')}
                  aria-pressed={invView === 'grid'}
                  title="Grid view"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <rect x="3" y="3" width="8" height="8" rx="1.5" /><rect x="13" y="3" width="8" height="8" rx="1.5" />
                    <rect x="3" y="13" width="8" height="8" rx="1.5" /><rect x="13" y="13" width="8" height="8" rx="1.5" />
                  </svg>
                  <span className="mp-inv-view-txt">Grid</span>
                </button>
                <button
                  type="button"
                  className={`mp-inv-view-btn${invView === 'list' ? ' is-active' : ''}`}
                  onClick={() => setInvView('list')}
                  aria-pressed={invView === 'list'}
                  title="List view"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
                    <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" />
                    <line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
                  </svg>
                  <span className="mp-inv-view-txt">List</span>
                </button>
              </div>
            </div>
          </div>

          <div className="mp-sold-meta">
            <div>
              <h3 className="mp-sold-heading">Completed sales</h3>
              <p className="mp-sold-count">
                {inventoryList.length} sold listing{inventoryList.length === 1 ? '' : 's'}
                {(invSearch || invCategory !== 'all') ? ' match your filters' : ''}
              </p>
            </div>
            <div className="mp-sold-meta-actions">
              <button type="button" className="mp-btn-secondary" onClick={() => setInventoryStatus('active')}>
                View active inventory
              </button>
              <button type="button" className="mp-btn-primary" onClick={() => navigate('/post')}>
                + Post listing
              </button>
            </div>
          </div>

          <section className="mp-sold-listings" aria-label="Sold listings">
            {inventoryList.length === 0 ? (
              <div className="mp-sold-empty">
                <div className="mp-sold-empty-art" aria-hidden="true">
                  <div className="mp-sold-empty-ring" />
                  <span className="mp-sold-empty-emoji">
                    <MpIcon name={invSearch || invCategory !== 'all' ? 'search' : 'sparkles'} size={28} />
                  </span>
                </div>
                <h3>
                  {invSearch || invCategory !== 'all'
                    ? 'No sold items match'
                    : 'No completed sales yet'}
                </h3>
                <p>
                  {invSearch || invCategory !== 'all'
                    ? 'Try another search or clear filters to see your sales history.'
                    : 'When you mark a listing as sold, it will appear here as part of your sales history — great for tracking reputation and deals.'}
                </p>
                <div className="mp-sold-empty-actions">
                  {(invSearch || invCategory !== 'all') && (
                    <button
                      type="button"
                      className="mp-btn-secondary"
                      onClick={() => { setInvSearch(''); setInvCategory('all') }}
                    >
                      Clear filters
                    </button>
                  )}
                  <button
                    type="button"
                    className="mp-btn-primary"
                    onClick={() => (activeListing.length > 0 ? setInventoryStatus('active') : navigate('/post'))}
                  >
                    {activeListing.length > 0 ? 'Relist an Item' : 'Post New Listing'}
                  </button>
                </div>
              </div>
            ) : (
              <div className={`mp-sold-grid mp-sold-grid--${invView}`}>
                {inventoryList.map((listing) => {
                  const img = Array.isArray(listing.images) ? listing.images[0] : null
                  const place = listing.district || listing.city || '—'
                  const soldWhen = listing.sold_at || listing.updated_at || listing.created_at
                  return (
                    <article key={listing.id} className="mp-sold-card">
                      <button
                        type="button"
                        className="mp-sold-thumb"
                        onClick={() => navigate('/listing/' + listing.id)}
                      >
                        {img ? (
                          <img src={img} alt="" loading="lazy" decoding="async" />
                        ) : (
                          <span className="mp-sold-thumb-ph" aria-hidden="true"><MpIcon name="package" size={28} /></span>
                        )}
                        <span className="mp-sold-badge">
                          <span aria-hidden="true">✓</span> Sold
                        </span>
                        <span className="mp-sold-status-dot" title="Completed" aria-label="Completed sale">
                          Completed
                        </span>
                      </button>

                      <div className="mp-sold-card-body">
                        <button
                          type="button"
                          className="mp-sold-card-main"
                          onClick={() => navigate('/listing/' + listing.id)}
                        >
                          <h4 className="mp-sold-card-title">{listing.title || 'Untitled'}</h4>
                          <div className="mp-sold-card-price">
                            MWK {Number(listing.price || 0).toLocaleString()}
                          </div>
                          <div className="mp-sold-card-meta">
                            <span>{place}</span>
                            <span aria-hidden="true">·</span>
                            <span>Sold {soldWhen ? `${timeAgoShort(soldWhen)} ago` : '—'}</span>
                          </div>
                          {(listing.category || listing.category_name) && (
                            <span className="mp-sold-cat">{listing.category || listing.category_name}</span>
                          )}
                        </button>

                        <div className="mp-sold-card-actions" role="group" aria-label="Sold listing actions">
                          <button
                            type="button"
                            className="mp-sold-icon-btn is-primary"
                            title="Relist"
                            aria-label="Relist listing"
                            onClick={() => toggleSold(listing)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 .49-4" />
                            </svg>
                            <span className="mp-sold-icon-txt">Relist</span>
                          </button>
                          <button
                            type="button"
                            className="mp-sold-icon-btn"
                            title="Share"
                            aria-label="Share listing"
                            onClick={() => shareListing(listing)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                              <path d="m8.59 13.51 6.83 3.98M15.41 6.51l-6.82 3.98" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="mp-sold-icon-btn is-danger"
                            title="Delete"
                            aria-label="Delete listing"
                            onClick={() => setDeleteConfirm(listing.id)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                            </svg>
                          </button>
                          <span className="mp-sold-action-divider" aria-hidden="true" />
                          <button
                            type="button"
                            className="mp-sold-icon-btn"
                            title="Buyer reviews"
                            aria-label="Buyer reviews"
                            onClick={() => showBuyerReviews(listing)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <polygon points="12 2 15 9 22 9 17 14 19 21 12 17 5 21 7 14 2 9 9 9" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="mp-sold-icon-btn"
                            title={`Delivery: ${listing.delivery_status || 'none'} (tap to cycle)`}
                            aria-label="Cycle delivery status"
                            onClick={() => cycleDeliveryStatus(listing)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <rect x="1" y="3" width="15" height="13" rx="1" /><path d="M16 8h4l3 5v3h-7V8z" /><circle cx="5.5" cy="18.5" r="2.5" /><circle cx="18.5" cy="18.5" r="2.5" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="mp-sold-icon-btn"
                            title="Copy invoice"
                            aria-label="Copy invoice"
                            onClick={() => showSaleInvoice(listing)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M14 2H6a2 2 0 0 0-2 2v16l4-2 4 2 4-2 4 2V8z" /><path d="M14 2v6h6" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            className="mp-sold-icon-btn"
                            title="Download receipt"
                            aria-label="Download receipt"
                            onClick={() => downloadSaleReceipt(listing)}
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
                            </svg>
                          </button>
                        </div>
                      </div>
                    </article>
                  )
                })}
              </div>
            )}
          </section>

          {shareToast && (
            <div className="mp-share-toast mp-inv-toast" role="status">{shareToast}</div>
          )}
        </div>
      )}

      {/* TRUST — Phase 9 premium Trust Center */}
      {activeGroup === 'trust' && (
        <div className="mp-tc">
          {/* Hero */}
          <section className="mp-tc-hero" aria-label="Trust score overview">
            <div className="mp-tc-hero-score">
              {trustLoading ? (
                <div className="mp-tc-skel-ring" aria-hidden="true" />
              ) : (
                <div
                  className="mp-tc-ring"
                  style={{
                    background: `conic-gradient(#0F9D58 ${trustScorePct * 3.6}deg, #e6ebe7 0deg)`,
                  }}
                  role="img"
                  aria-label={`Trust score ${Math.round(trustScoreTotal)} of 30`}
                >
                  <div className="mp-tc-ring-hole">
                    <strong>{Math.round(trustScoreTotal)}</strong>
                    <span>score</span>
                  </div>
                </div>
              )}
              <div className="mp-tc-hero-copy">
                <p className="mp-tc-kicker">Trust Center</p>
                <h3 className="mp-tc-hero-title">Your marketplace reputation</h3>
                <p className="mp-tc-hero-lead">
                  Buyers check verification, deals, and vouches before messaging.
                  Strong trust signals help you sell faster and safer.
                </p>
                <div className="mp-tc-hero-badges">
                  {!trustLoading && (
                    <TrustBadge trustScore={trustScore} dealCount={dealCount} />
                  )}
                  <div className={`mp-tc-pill mp-level-badge--t${sellerLevel.tier}`}>
                    <span aria-hidden="true">
                      <MpIcon name={sellerLevelIcon(sellerLevel.tier)} size={14} />
                    </span>
                    <strong>{sellerLevel.name}</strong>
                  </div>
                  <div className={`mp-tc-pill${profile.is_verified ? ' is-ok' : ' is-warn'}`}>
                    {profile.is_verified ? (
                      <>
                        <VerifiedSeal size={14} />
                        <strong>Verified</strong>
                      </>
                    ) : (
                      <strong>Verification pending</strong>
                    )}
                  </div>
                  <div className="mp-tc-pill">
                    <span aria-hidden="true">🤝</span>
                    <strong>{dealCount || 0} deals</strong>
                  </div>
                </div>
              </div>
            </div>
            <div className="mp-tc-hero-cta">
              {!profile.is_verified ? (
                <>
                  <p className="mp-tc-cta-lead">Unlock more trust with buyers</p>
                  <button type="button" className="mp-btn-verify mp-tc-verify-btn" onClick={() => setShowVerify(true)}>
                    Get identity verified
                  </button>
                  <p className="mp-tc-cta-hint">Complete verification to earn a trusted badge.</p>
                </>
              ) : (
                <>
                  <p className="mp-tc-cta-lead">You&apos;re verified</p>
                  <p className="mp-tc-cta-hint">Keep completing deals and collecting vouches to climb seller levels.</p>
                  <button type="button" className="mp-btn-secondary" onClick={() => openGroup('sold')}>
                    View sales history
                  </button>
                </>
              )}
            </div>
          </section>

          {/* Live verification status / additional-info action */}
          <SellerVerificationBanner
            userId={user?.id}
            isVerified={!!profile.is_verified}
            onContinue={() => setShowVerify(true)}
          />
          <PendingVerificationCard
            userId={user?.id}
            isVerified={!!profile.is_verified}
            onContinue={() => setShowVerify(true)}
          />

          {/* Six metric cards */}
          <section className="mp-tc-section" aria-label="Trust metrics">
            <div className="mp-tc-section-head">
              <h3 className="mp-tc-section-title">Trust metrics</h3>
              <p className="mp-tc-section-sub">Live signals buyers see on your reputation.</p>
            </div>
            <div className="mp-tc-metrics">
              <button type="button" className={`mp-tc-metric${profile.is_verified ? ' is-ok' : ' is-warn'}`} onClick={() => setShowVerify(true)}>
                <span className="mp-tc-metric-ic" aria-hidden="true"><MpIcon name="shieldCheck" size={18} /></span>
                <span className="mp-tc-metric-label">Verification status</span>
                <strong className="mp-tc-metric-value">{profile.is_verified ? 'Verified' : 'See status'}</strong>
                <span className="mp-tc-metric-desc">
                  {profile.is_verified ? 'Identity confirmed for safer deals' : 'Open verification for live status'}
                </span>
                <span className={`mp-tc-metric-bar${profile.is_verified ? ' is-full' : ''}`}>
                  <i style={{ width: profile.is_verified ? '100%' : '28%' }} />
                </span>
              </button>

              <div className="mp-tc-metric is-ok">
                <span className="mp-tc-metric-ic" aria-hidden="true"><MpIcon name="badgeCheck" size={18} /></span>
                <span className="mp-tc-metric-label">Confirmed deals</span>
                <strong className="mp-tc-metric-value">{dealCount || 0}</strong>
                <span className="mp-tc-metric-desc">Trades confirmed through SokoMw</span>
                <span className="mp-tc-metric-bar">
                  <i style={{ width: `${Math.min(100, (dealCount || 0) * 12)}%` }} />
                </span>
              </div>

              <button type="button" className="mp-tc-metric is-ok" onClick={() => openGroup('sold')}>
                <span className="mp-tc-metric-ic" aria-hidden="true"><MpIcon name="checkCircle" size={18} /></span>
                <span className="mp-tc-metric-label">Completed sales</span>
                <strong className="mp-tc-metric-value">{soldListings.length}</strong>
                <span className="mp-tc-metric-desc">Listings marked sold</span>
                <span className="mp-tc-metric-bar">
                  <i style={{ width: `${Math.min(100, soldListings.length * 10)}%` }} />
                </span>
              </button>

              <button type="button" className="mp-tc-metric" onClick={() => openGroup('selling')}>
                <span className="mp-tc-metric-ic" aria-hidden="true"><MpIcon name="package" size={18} /></span>
                <span className="mp-tc-metric-label">Active listings</span>
                <strong className="mp-tc-metric-value">{activeListing.length}</strong>
                <span className="mp-tc-metric-desc">Live inventory right now</span>
                <span className="mp-tc-metric-bar">
                  <i style={{ width: `${Math.min(100, activeListing.length * 12)}%` }} />
                </span>
              </button>

              <button type="button" className="mp-tc-metric" onClick={() => openGroup('network')}>
                <span className="mp-tc-metric-ic" aria-hidden="true"><MpIcon name="users" size={18} /></span>
                <span className="mp-tc-metric-label">Followers</span>
                <strong className="mp-tc-metric-value">{followerCount}</strong>
                <span className="mp-tc-metric-desc">People following your storefront</span>
                <span className="mp-tc-metric-bar">
                  <i style={{ width: `${Math.min(100, followerCount * 8)}%` }} />
                </span>
              </button>

              <button type="button" className="mp-tc-metric" onClick={() => openGroup('profile')}>
                <span className="mp-tc-metric-ic" aria-hidden="true"><MpIcon name="trendingUp" size={18} /></span>
                <span className="mp-tc-metric-label">Profile strength</span>
                <strong className="mp-tc-metric-value">{completeness.pct}%</strong>
                <span className="mp-tc-metric-desc">{completeness.done}/{completeness.total} profile checks complete</span>
                <span className="mp-tc-metric-bar">
                  <i style={{ width: `${completeness.pct}%` }} />
                </span>
              </button>
            </div>
          </section>

          {/* Interactive trust checklist */}
          <section className="mp-tc-section" aria-label="How to build trust">
            <div className="mp-tc-section-head mp-tc-section-head-row">
              <div>
                <h3 className="mp-tc-section-title">Trust checklist</h3>
                <p className="mp-tc-section-sub">Complete these steps to strengthen buyer confidence.</p>
              </div>
              <div className="mp-tc-check-progress" aria-label={`${trustChecklist.done} of ${trustChecklist.total} complete`}>
                <strong>{trustChecklist.done}/{trustChecklist.total}</strong>
                <span>{trustChecklist.pct}%</span>
              </div>
            </div>
            <div className="mp-tc-check-bar" aria-hidden="true">
              <i style={{ width: `${trustChecklist.pct}%` }} />
            </div>
            <ul className="mp-tc-checklist">
              {trustChecklist.items.map((item) => (
                <li key={item.id} className={`mp-tc-check-item${item.done ? ' is-done' : ''}${trustChecklist.next?.id === item.id ? ' is-next' : ''}`}>
                  <span className="mp-tc-check-mark" aria-hidden="true">
                    {item.done ? '✓' : trustChecklist.next?.id === item.id ? '→' : '○'}
                  </span>
                  <div className="mp-tc-check-copy">
                    <strong>{item.label}</strong>
                    {item.id === 'respond' && !item.done && (
                      <span className="mp-tc-check-note">Reply to buyers promptly — unlocks after enough chat samples</span>
                    )}
                    {trustChecklist.next?.id === item.id && !item.done && (
                      <span className="mp-tc-check-next">Recommended next</span>
                    )}
                  </div>
                  {!item.done && item.action && item.cta && (
                    <button type="button" className="mp-tc-check-cta" onClick={item.action}>
                      {item.cta}
                    </button>
                  )}
                  {item.done && <span className="mp-tc-check-done-label">Done</span>}
                </li>
              ))}
            </ul>
          </section>

          {/* Vouches — existing component, premium shell */}
          <section className="mp-tc-section mp-tc-vouch-section" aria-label="Vouches">
            <div className="mp-tc-section-head">
              <h3 className="mp-tc-section-title">Vouches &amp; social proof</h3>
              <p className="mp-tc-section-sub">Recommendations from people you&apos;ve dealt with — unchanged vouch system.</p>
            </div>
            <div className="mp-tc-vouch-card">
              <div className="mp-vouch-wrap">
                <VouchSection targetUserId={user?.id} viewerUserId={user?.id} />
              </div>
            </div>
          </section>

          {/* Achievements — live catalog + unlocks (with client fallback) */}
          <section className="mp-tc-section" aria-label="Achievements">
            <div className="mp-tc-section-head">
              <h3 className="mp-tc-section-title">Achievements</h3>
              <p className="mp-tc-section-sub">
                {liveAchievements?.length
                  ? 'Synced from your account activity.'
                  : 'Badges unlock as you grow. Locked items show how to earn them.'}
              </p>
            </div>
            <div className="mp-tc-achieve-grid">
              {trustAchievements.map((a) => (
                <div
                  key={a.id}
                  className={`mp-tc-achieve${a.unlocked ? ' is-unlocked' : ' is-locked'}${a.placeholder ? ' is-placeholder' : ''}`}
                >
                  <span className="mp-tc-achieve-ic" aria-hidden="true">
                    <MpIcon name={a.icon} size={22} />
                  </span>
                  <strong className="mp-tc-achieve-name">{a.name}</strong>
                  <span className="mp-tc-achieve-desc">{a.desc}</span>
                  {a.unlocked ? (
                    <em className="mp-tc-achieve-status is-on">Unlocked</em>
                  ) : (
                    <em className="mp-tc-achieve-status">{a.req}</em>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* Trust timeline */}
          <section className="mp-tc-section" aria-label="Trust timeline">
            <div className="mp-tc-section-head">
              <h3 className="mp-tc-section-title">Trust timeline</h3>
              <p className="mp-tc-section-sub">Key reputation events from your account activity.</p>
            </div>
            <div className="mp-tc-timeline-card">
              <ul className="mp-tc-timeline">
                {trustTimeline.map((ev) => (
                  <li key={ev.id} className={`mp-tc-tl-item mp-tc-tl-item--${ev.tone || 'mid'}`}>
                    <span className="mp-tc-tl-dot" aria-hidden="true">{ev.icon}</span>
                    {ev.onClick ? (
                      <button type="button" className="mp-tc-tl-btn" onClick={ev.onClick}>
                        <span className="mp-tc-tl-text">{ev.text}</span>
                        <span className="mp-tc-tl-time">
                          {ev.whenLabel || (ev.when ? `${timeAgoShort(ev.when)} ago` : '')}
                        </span>
                      </button>
                    ) : (
                      <div className="mp-tc-tl-static">
                        <span className="mp-tc-tl-text">{ev.text}</span>
                        <span className="mp-tc-tl-time">
                          {ev.whenLabel || (ev.when ? `${timeAgoShort(ev.when)} ago` : '')}
                        </span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </section>
        </div>
      )}

      {/* NETWORK — Phase 10 premium relationship dashboard */}
      {activeGroup === 'network' && (
        <div className="mp-network-wrap">
          <NetworkTab
            sellerId={user?.id}
            userId={user?.id}
            suggestions={suggestions}
            shopId={shop?.id || null}
            onFollowSuggestion={async (sid) => {
              await followSeller(sid, user.id)
              await loadNetworkCounts(user.id)
              refreshDashboard()
            }}
          />
        </div>
      )}

      {/* BUYING — Phase 11 premium buyer / discover dashboard */}
      {activeGroup === 'buying' && (
        <div className="mp-buy">
          {/* Personalized header */}
          <section className="mp-buy-hero" aria-label="Buyer dashboard">
            <div className="mp-buy-hero-copy">
              <p className="mp-buy-kicker">Buying &amp; Discover</p>
              <h3 className="mp-buy-hello">
                {profile.full_name
                  ? `Hi ${profile.full_name.split(' ')[0]}, find what you need`
                  : 'Find what you need on SokoMw'}
              </h3>
              <p className="mp-buy-lead">
                Messages, saved items, shops, jobs, and services — all in one buyer hub.
                {profile.city ? ` Exploring from ${profile.city}.` : ''}
              </p>
            </div>
            <div className="mp-buy-hero-actions">
              <button type="button" className="mp-btn-primary" onClick={() => navigate('/')}>
                Browse listings
              </button>
              <button type="button" className="mp-btn-secondary" onClick={() => navigate('/looking-for')}>
                Post Looking for
              </button>
            </div>
          </section>

          {/* Quick stats */}
          <section className="mp-buy-stats" aria-label="Buyer statistics">
            {buyerStats.loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="mp-buy-skel mp-buy-skel-stat" aria-hidden="true" />
              ))
            ) : (
              <>
                <button type="button" className="mp-buy-stat" onClick={() => navigate('/saved-statuses')}>
                  <span className="mp-buy-stat-ic" aria-hidden="true"><MpIcon name="heart" size={18} /></span>
                  <strong className="mp-buy-stat-n">{buyerStats.saved ?? '—'}</strong>
                  <span className="mp-buy-stat-l">Saved items</span>
                </button>
                <button type="button" className="mp-buy-stat" onClick={() => navigate('/chats')}>
                  <span className="mp-buy-stat-ic" aria-hidden="true"><MpIcon name="messageCircle" size={18} /></span>
                  <strong className="mp-buy-stat-n">{buyerStats.unread ?? '—'}</strong>
                  <span className="mp-buy-stat-l">Unread messages</span>
                </button>
                <button type="button" className="mp-buy-stat" onClick={() => navigate('/looking-for')}>
                  <span className="mp-buy-stat-ic" aria-hidden="true"><MpIcon name="search" size={18} /></span>
                  <strong className="mp-buy-stat-n">{buyerStats.lookingFor ?? '—'}</strong>
                  <span className="mp-buy-stat-l">Active Looking for</span>
                </button>
                <button
                  type="button"
                  className={`mp-buy-stat${jobApps == null ? ' is-placeholder' : ''}`}
                  title={jobApps == null ? 'Table not available yet' : 'Your job applications'}
                  onClick={() => navigate('/jobs')}
                >
                  <span className="mp-buy-stat-ic" aria-hidden="true"><MpIcon name="briefcase" size={18} /></span>
                  <strong className="mp-buy-stat-n">{jobApps ?? '—'}</strong>
                  <span className="mp-buy-stat-l">Job applications</span>
                  {jobApps == null && <em className="mp-buy-stat-soon">Setup</em>}
                </button>
                <button
                  type="button"
                  className={`mp-buy-stat${serviceReqs == null ? ' is-placeholder' : ''}`}
                  title={serviceReqs == null ? 'Table not available yet' : 'Your service requests'}
                  onClick={() => navigate('/services')}
                >
                  <span className="mp-buy-stat-ic" aria-hidden="true"><MpIcon name="wrench" size={18} /></span>
                  <strong className="mp-buy-stat-n">{serviceReqs ?? '—'}</strong>
                  <span className="mp-buy-stat-l">Service requests</span>
                  {serviceReqs == null && <em className="mp-buy-stat-soon">Setup</em>}
                </button>
                <button type="button" className="mp-buy-stat" onClick={() => navigate('/notifications')}>
                  <span className="mp-buy-stat-ic" aria-hidden="true"><MpIcon name="bell" size={18} /></span>
                  <strong className="mp-buy-stat-n">{buyerStats.notifs ?? '—'}</strong>
                  <span className="mp-buy-stat-l">Notifications</span>
                </button>
              </>
            )}
          </section>

          {/* Destinations — same routes as before */}
          <section className="mp-buy-section" aria-label="Buyer destinations">
            <div className="mp-buy-section-head">
              <h3 className="mp-buy-section-title">Explore destinations</h3>
              <p className="mp-buy-section-sub">Jump into chats, saved items, shops, jobs, and more.</p>
            </div>
            <div className="mp-buy-dest-grid">
              {BUYING_ITEMS.map(item => {
                const badge = buyerBadge(item.badgeKey)
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`mp-buy-dest mp-buy-dest--${item.accent || 'green'}`}
                    onClick={item.onClick}
                  >
                    <span className="mp-buy-dest-ic" aria-hidden="true">
                      <MpIcon name={item.icon} size={20} />
                    </span>
                    <span className="mp-buy-dest-copy">
                      <span className="mp-buy-dest-label">{item.label}</span>
                      <span className="mp-buy-dest-sub">{item.sub}</span>
                    </span>
                    {badge != null && (
                      <em className="mp-buy-dest-badge">{badge}</em>
                    )}
                    <span className="mp-buy-dest-arrow" aria-hidden="true">→</span>
                  </button>
                )
              })}
            </div>
          </section>

          {/* Continue where you left off */}
          <section className="mp-buy-section" aria-label="Continue where you left off">
            <div className="mp-buy-section-head">
              <h3 className="mp-buy-section-title">Continue where you left off</h3>
              <p className="mp-buy-section-sub">Pick up recent buyer activity based on your account.</p>
            </div>
            <div className="mp-buy-continue-grid">
              {buyerContinue.map(item => (
                <button
                  key={item.id}
                  type="button"
                  className={`mp-buy-continue${item.hot ? ' is-hot' : ''}`}
                  onClick={item.onClick}
                >
                  <span className="mp-buy-continue-ic" aria-hidden="true">
                    <MpIcon name={item.icon} size={18} />
                  </span>
                  <span className="mp-buy-continue-copy">
                    <strong>{item.title}</strong>
                    <span>{item.sub}</span>
                  </span>
                  {item.hot && <em className="mp-buy-continue-hot">Active</em>}
                </button>
              ))}
              {/* Seller-side recent listing activity as optional resume cards */}
              {recentActivity.slice(0, 2).map(item => (
                <button
                  key={`ra-${item.id}`}
                  type="button"
                  className="mp-buy-continue"
                  onClick={() => navigate('/listing/' + item.id)}
                >
                  <span className="mp-buy-continue-ic" aria-hidden="true">📦</span>
                  <span className="mp-buy-continue-copy">
                    <strong>{item.text}</strong>
                    <span>{timeAgoShort(item.when)} ago · your listing</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          {/* Recommended for you — live marketplace picks */}
          <section className="mp-buy-section" aria-label="Recommended for you">
            <div className="mp-buy-section-head">
              <h3 className="mp-buy-section-title">Recommended for you</h3>
              <p className="mp-buy-section-sub">
                {recommended.length
                  ? 'Fresh listings from other sellers on SokoMw.'
                  : 'Browse the marketplace — recommendations fill in as inventory grows.'}
              </p>
            </div>
            <div className="mp-buy-reco-grid">
              {recommended.length === 0 ? (
                [1, 2, 3, 4].map(i => (
                  <button
                    key={i}
                    type="button"
                    className="mp-buy-reco"
                    onClick={() => navigate('/')}
                  >
                    <div className="mp-buy-reco-media" aria-hidden="true">
                      <span>{['📱', '🛋️', '🚗', '🏠'][i - 1]}</span>
                    </div>
                    <div className="mp-buy-reco-body">
                      <strong>Browse marketplace</strong>
                      <span>Discover listings near you</span>
                      <em>Open home</em>
                    </div>
                  </button>
                ))
              ) : (
                recommended.slice(0, 4).map((item) => {
                  const img = Array.isArray(item.images) ? item.images[0] : item.images
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="mp-buy-reco"
                      onClick={() => navigate('/listing/' + item.id)}
                    >
                      <div className="mp-buy-reco-media" aria-hidden="true">
                        {img
                          ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span>📦</span>}
                      </div>
                      <div className="mp-buy-reco-body">
                        <strong>{item.title || 'Listing'}</strong>
                        <span>{item.city || item.district || item.category || 'SokoMw'}</span>
                        <em>
                          {item.price != null
                            ? `MWK ${Number(item.price).toLocaleString()}`
                            : 'Price on request'}
                        </em>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </section>

          {/* Trending categories */}
          <section className="mp-buy-section" aria-label="Trending categories">
            <div className="mp-buy-section-head">
              <h3 className="mp-buy-section-title">Trending categories</h3>
              <p className="mp-buy-section-sub">Quick discovery across the marketplace.</p>
            </div>
            <div className="mp-buy-cats">
              {TRENDING_CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  className="mp-buy-cat"
                  onClick={() => navigate(`/?category=${encodeURIComponent(cat.q)}`)}
                >
                  <span aria-hidden="true"><MpIcon name={cat.icon} size={15} /></span>
                  {cat.label}
                </button>
              ))}
            </div>
          </section>

          {/* Recently viewed — from listing_views */}
          <section className="mp-buy-section" aria-label="Recently viewed">
            <div className="mp-buy-section-head">
              <h3 className="mp-buy-section-title">Recently viewed</h3>
              <p className="mp-buy-section-sub">
                {recentlyViewed.length
                  ? 'Pick up where you left off.'
                  : 'Listings you open are saved here for quick return visits.'}
              </p>
            </div>
            {recentlyViewed.length > 0 ? (
              <div className="mp-buy-reco-grid">
                {recentlyViewed.map((item) => {
                  const img = Array.isArray(item.images) ? item.images[0] : item.images
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className="mp-buy-reco"
                      onClick={() => navigate('/listing/' + item.id)}
                    >
                      <div className="mp-buy-reco-media" aria-hidden="true">
                        {img
                          ? <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : <span>👁️</span>}
                      </div>
                      <div className="mp-buy-reco-body">
                        <strong>{item.title || 'Listing'}</strong>
                        <span>{item.city || item.district || 'Viewed recently'}</span>
                        <em>
                          {item.price != null
                            ? `MWK ${Number(item.price).toLocaleString()}`
                            : 'Open again'}
                        </em>
                      </div>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="mp-buy-recent-empty">
                <div className="mp-buy-empty-art" aria-hidden="true">
                  <div className="mp-buy-empty-blob" />
                  <span className="mp-buy-empty-emoji">👁️</span>
                </div>
                <h4>No recently viewed items yet</h4>
                <p>Browse the marketplace and your history will land here for quick return visits.</p>
                <div className="mp-buy-empty-actions">
                  <button type="button" className="mp-btn-primary" onClick={() => navigate('/')}>
                    Browse listings
                  </button>
                  <button type="button" className="mp-btn-secondary" onClick={() => navigate('/shops')}>
                    Browse shops
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Discovery empty-state CTA strip when buyer is quiet */}
          {(buyerStats.saved === 0 && buyerStats.unread === 0 && buyerStats.lookingFor === 0 && !buyerStats.loading) && (
            <section className="mp-buy-kickstart" aria-label="Get started buying">
              <div className="mp-buy-kickstart-inner">
                <div className="mp-buy-empty-art" aria-hidden="true">
                  <div className="mp-buy-empty-blob" />
                  <span className="mp-buy-empty-emoji">🛍️</span>
                </div>
                <h3>Start discovering SokoMw</h3>
                <p>
                  Browse listings, follow local shops, post a Looking for request, or hire a service —
                  your buyer hub fills up as you explore.
                </p>
                <div className="mp-buy-empty-actions">
                  <button type="button" className="mp-btn-primary" onClick={() => navigate('/')}>Browse listings</button>
                  <button type="button" className="mp-btn-secondary" onClick={() => navigate('/jobs')}>Find jobs</button>
                  <button type="button" className="mp-btn-secondary" onClick={() => navigate('/services')}>Find services</button>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* SETTINGS — profile identity + account security */}
      {activeGroup === 'settings' && (
        <>
          <section
            ref={settingsProfileRef}
            id="mp-settings-profile"
            className={`mp-card mp-account${navKey === 'profile' ? ' is-nav-focus' : ''}`}
          >
            <h3 className="mp-section-title">Profile settings</h3>
            <p className="mp-section-lead">Update how buyers see you on SokoMw.</p>

            {editMode ? (
              <div className="mp-edit-form mp-edit-panel">
                <div className="mp-edit-head">
                  <h3>Edit profile</h3>
                  <p>Name, city and phone buyers see on SokoMw</p>
                </div>
                <label className="mp-label">Full name</label>
                <input
                  className="mp-input"
                  placeholder="How buyers will see you"
                  value={form.full_name}
                  onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
                />
                <label className="mp-label">City / district</label>
                <select
                  className="mp-input"
                  value={form.city}
                  onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
                >
                  <option value="">Select city</option>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                  {form.city && !CITIES.includes(form.city) && (
                    <option value={form.city}>{form.city}</option>
                  )}
                </select>
                <label className="mp-label">Phone (for Call Seller)</label>
                <input
                  className="mp-input"
                  type="tel"
                  inputMode="tel"
                  placeholder="+265 …"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                />
                <p className="mp-field-hint">Used when buyers tap Call Seller on your listings.</p>
                {saveMsg && <p className="mp-save-msg">{saveMsg}</p>}
                <div className="mp-edit-btns">
                  <button
                    type="button"
                    className="mp-btn-secondary"
                    onClick={() => {
                      setEditMode(false)
                      setForm({
                        full_name: profile.full_name || '',
                        city: profile.city || '',
                        phone: profile.phone || '',
                      })
                    }}
                  >
                    Cancel
                  </button>
                  <button type="button" className="mp-btn-primary" onClick={saveProfile} disabled={saving}>
                    {saving ? 'Saving…' : 'Save changes'}
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="mp-settings-group">
                  <div className="mp-settings-group-head">
                    <span className="mp-settings-group-ic" aria-hidden="true">👤</span>
                    <div>
                      <div className="mp-settings-group-title">Identity</div>
                      <div className="mp-settings-group-hint">Photo, name, and contact</div>
                    </div>
                  </div>
                  <div className="mp-account-rows">
                    <div className="mp-account-row"><span>Full name</span><strong>{profile.full_name || 'Not set'}</strong></div>
                    <div className="mp-account-row"><span>Phone</span><strong>{profile.phone || 'Not set'}</strong></div>
                    <div className="mp-account-row"><span>City</span><strong>{profile.city || 'Not set'}</strong></div>
                    <div className="mp-account-row">
                      <span>Public profile</span>
                      <button type="button" className="mp-link" onClick={() => navigate('/profile/' + user.id)}>Open →</button>
                    </div>
                  </div>
                  <div className="mp-settings-actions">
                    <button type="button" className="mp-btn-secondary" onClick={() => setEditMode(true)}>Edit name, city &amp; phone</button>
                    <button type="button" className="mp-btn-secondary" onClick={() => fileRef.current?.click()}>Change photo</button>
                    <button type="button" className="mp-btn-secondary" onClick={() => coverRef.current?.click()}>
                      {profile.cover_url ? 'Change cover' : 'Add cover'}
                    </button>
                  </div>
                </div>

                <div className="mp-settings-group mp-settings-group-last">
                  <div className="mp-settings-group-head">
                    <span className="mp-settings-group-ic" aria-hidden="true">📈</span>
                    <div>
                      <div className="mp-settings-group-title">Profile strength</div>
                      <div className="mp-settings-group-hint">{completeness.done}/{completeness.total} complete · {completeness.pct}%</div>
                    </div>
                  </div>
                  <div className="mp-complete" style={{ margin: 0 }}>
                    <div className="mp-complete-bar">
                      <div className="mp-complete-fill" style={{ width: `${completeness.pct}%` }} />
                    </div>
                    {completeness.next && (
                      <button type="button" className="mp-next-tip" onClick={handleNextCompleteness}>
                        <span>Next step</span>
                        <strong>{completeness.next.tip}</strong>
                      </button>
                    )}
                  </div>
                </div>
              </>
            )}
          </section>

          {/* PHASE 12 — Premium Account & Security Center (repolished) */}
          <div
            ref={settingsAccountRef}
            id="mp-settings-account"
            className={`mp-ac${navKey === 'account' ? ' is-nav-focus' : ''}`}
          >
            <header className="mp-ac-hero">
              <div className="mp-ac-hero-main">
                <p className="mp-ac-kicker">Account center</p>
                <h3 className="mp-ac-title">Account &amp; security</h3>
                <p className="mp-ac-lead">
                  Membership, business links, trust, and session — everything in one place.
                </p>
                <div className="mp-ac-hero-pills">
                  <span className={`mp-ac-pill${profile.is_verified ? ' is-ok' : ' is-warn'}`}>
                    <MpIcon name={profile.is_verified ? 'badgeCheck' : 'alertCircle'} size={13} />
                    {profile.is_verified ? 'Verified' : 'Unverified'}
                  </span>
                  <span className="mp-ac-pill">
                    <MpIcon name="user" size={13} />
                    {accountType}
                  </span>
                  <span className="mp-ac-pill">
                    <MpIcon name="trendingUp" size={13} />
                    Profile {completeness.pct}%
                  </span>
                  {memberSince && (
                    <span className="mp-ac-pill">
                      <MpIcon name="calendar" size={13} />
                      Since {memberSince}
                    </span>
                  )}
                </div>
              </div>
              <div className="mp-ac-hero-side">
                <div className="mp-ac-hero-email" title={user.email}>
                  <MpIcon name="mail" size={15} />
                  <span>{user.email}</span>
                </div>
                <button type="button" className="mp-ac-signout-btn" onClick={confirmSignOut}>
                  <MpIcon name="logOut" size={16} />
                  Sign out
                </button>
              </div>
            </header>

            <div className="mp-ac-grid">
              {/* 1. Account Information */}
              <section className="mp-ac-card" aria-labelledby="mp-ac-info-title">
                <div className="mp-ac-card-head">
                  <span className="mp-ac-card-ic" aria-hidden="true"><MpIcon name="userCircle" size={18} /></span>
                  <div className="mp-ac-card-head-text">
                    <h4 id="mp-ac-info-title" className="mp-ac-card-title">Account information</h4>
                    <p className="mp-ac-card-sub">Identity on file for SokoMw</p>
                  </div>
                </div>
                <ul className="mp-ac-rows">
                  <li className="mp-ac-row">
                    <span className="mp-ac-row-ic" aria-hidden="true"><MpIcon name="mail" size={15} /></span>
                    <span className="mp-ac-row-meta">
                      <span className="mp-ac-row-k">Email</span>
                      <strong className="mp-ac-row-v" title={user.email}>{user.email}</strong>
                    </span>
                  </li>
                  <li className="mp-ac-row">
                    <span className="mp-ac-row-ic" aria-hidden="true"><MpIcon name="calendar" size={15} /></span>
                    <span className="mp-ac-row-meta">
                      <span className="mp-ac-row-k">Member since</span>
                      <strong className="mp-ac-row-v">{memberSince || '—'}</strong>
                    </span>
                  </li>
                  <li className="mp-ac-row">
                    <span className="mp-ac-row-ic" aria-hidden="true"><MpIcon name="keyRound" size={15} /></span>
                    <span className="mp-ac-row-meta">
                      <span className="mp-ac-row-k">User ID</span>
                      <strong className="mp-ac-row-v mp-mono" title={user.id}>{user.id.slice(0, 8)}…</strong>
                    </span>
                    <button
                      type="button"
                      className="mp-ac-copy"
                      onClick={async () => {
                        try {
                          await navigator.clipboard?.writeText(user.id)
                          setShareToast('User ID copied')
                          setTimeout(() => setShareToast(''), 2000)
                        } catch { /* ignore */ }
                      }}
                    >
                      Copy
                    </button>
                  </li>
                  <li className="mp-ac-row">
                    <span className="mp-ac-row-ic" aria-hidden="true"><MpIcon name="user" size={15} /></span>
                    <span className="mp-ac-row-meta">
                      <span className="mp-ac-row-k">Account type</span>
                      <strong className="mp-ac-row-v">{accountType}</strong>
                    </span>
                  </li>
                  <li className="mp-ac-row mp-ac-row-progress">
                    <span className="mp-ac-row-ic" aria-hidden="true"><MpIcon name="trendingUp" size={15} /></span>
                    <span className="mp-ac-row-meta">
                      <span className="mp-ac-row-k">Profile status</span>
                      <strong className="mp-ac-row-v">
                        {completeness.pct}% complete
                        <span className={`mp-ac-status-dot${profile.is_verified ? ' is-ok' : ''}`}>
                          {profile.is_verified ? 'Verified' : 'Unverified'}
                        </span>
                      </strong>
                      <span className="mp-ac-mini-bar" aria-hidden="true">
                        <i style={{ width: `${completeness.pct}%` }} />
                      </span>
                    </span>
                    <button type="button" className="mp-link" onClick={() => openGroup('profile')}>Edit →</button>
                  </li>
                </ul>
              </section>

              {/* 2. Business */}
              <section className="mp-ac-card" aria-labelledby="mp-ac-biz-title">
                <div className="mp-ac-card-head">
                  <span className="mp-ac-card-ic" aria-hidden="true"><MpIcon name="store" size={18} /></span>
                  <div className="mp-ac-card-head-text">
                    <h4 id="mp-ac-biz-title" className="mp-ac-card-title">Business</h4>
                    <p className="mp-ac-card-sub">Shop, inventory, and marketplace links</p>
                  </div>
                  <span className={`mp-ac-live-badge${shop ? ' is-on' : ''}`}>
                    {shop ? 'Live' : 'Setup'}
                  </span>
                </div>
                <ul className="mp-ac-rows">
                  <li className="mp-ac-row">
                    <span className="mp-ac-row-ic" aria-hidden="true"><MpIcon name="store" size={15} /></span>
                    <span className="mp-ac-row-meta">
                      <span className="mp-ac-row-k">Shop status</span>
                      <strong className="mp-ac-row-v">{shop ? 'Active storefront' : 'No shop yet'}</strong>
                    </span>
                  </li>
                  <li className="mp-ac-row">
                    <span className="mp-ac-row-ic" aria-hidden="true"><MpIcon name="link2" size={15} /></span>
                    <span className="mp-ac-row-meta">
                      <span className="mp-ac-row-k">Shop link</span>
                      <strong className="mp-ac-row-v">{shop ? shop.name : 'Set up a storefront'}</strong>
                    </span>
                    <button type="button" className="mp-ac-row-action" onClick={() => navigate(shopPath)}>
                      {shop ? 'Open' : 'Create'}
                      <MpIcon name="chevronRight" size={14} />
                    </button>
                  </li>
                  <li className="mp-ac-row">
                    <span className="mp-ac-row-ic" aria-hidden="true"><MpIcon name="package" size={15} /></span>
                    <span className="mp-ac-row-meta">
                      <span className="mp-ac-row-k">Active listings</span>
                      <strong className="mp-ac-row-v">{activeListing.length}</strong>
                    </span>
                    <button type="button" className="mp-ac-row-action" onClick={() => openGroup('selling')}>
                      Inventory
                      <MpIcon name="chevronRight" size={14} />
                    </button>
                  </li>
                </ul>
                <div className="mp-ac-shortcuts">
                  <button type="button" className="mp-ac-chip" onClick={() => navigate('/post')}>
                    <MpIcon name="plusCircle" size={14} /> Post listing
                  </button>
                  <button type="button" className="mp-ac-chip" onClick={() => openGroup('sold')}>
                    <MpIcon name="checkCircle" size={14} /> Sold history
                  </button>
                  <button type="button" className="mp-ac-chip" onClick={() => navigate('/profile/' + user.id)}>
                    <MpIcon name="eye" size={14} /> Public profile
                  </button>
                </div>
              </section>

              {/* 3. Trust & Verification */}
              <section className="mp-ac-card mp-ac-card-trust" aria-labelledby="mp-ac-trust-title">
                <div className="mp-ac-card-head">
                  <span className="mp-ac-card-ic" aria-hidden="true"><MpIcon name="shieldCheck" size={18} /></span>
                  <div className="mp-ac-card-head-text">
                    <h4 id="mp-ac-trust-title" className="mp-ac-card-title">Trust &amp; verification</h4>
                    <p className="mp-ac-card-sub">Reputation signals buyers check</p>
                  </div>
                </div>
                <div className="mp-ac-trust-summary" aria-label="Trust overview">
                  <div className="mp-ac-trust-score-wrap">
                    {trustLoading ? (
                      <div className="mp-ac-trust-score-skel" aria-hidden="true" />
                    ) : (
                      <div
                        className="mp-ac-trust-ring"
                        style={{
                          background: `conic-gradient(#0F9D58 ${Math.min(100, Math.round(((trustScore?.total_score ?? 0) / 30) * 100)) * 3.6}deg, #e6ebe7 0deg)`,
                        }}
                        role="img"
                        aria-label={`Trust score ${Math.round(trustScore?.total_score ?? 0)} of 30`}
                      >
                        <div className="mp-ac-trust-ring-hole">
                          <strong>{trustScore?.total_score != null ? Math.round(trustScore.total_score) : 0}</strong>
                          <span>/30</span>
                        </div>
                      </div>
                    )}
                    <div className="mp-ac-trust-score-label">
                      <span className="mp-ac-trust-score-k">Trust score</span>
                      <p className="mp-ac-trust-score-msg">
                        {(trustScore?.total_score ?? 0) >= 30
                          ? 'Excellent standing'
                          : (trustScore?.total_score ?? 0) >= 15
                            ? 'Growing reputation'
                            : (trustScore?.total_score ?? 0) > 0
                              ? 'Getting started'
                              : 'Build score with deals'}
                      </p>
                    </div>
                  </div>

                  <div className="mp-ac-trust-panels">
                    <div className="mp-ac-trust-panel">
                      <span className="mp-ac-trust-panel-ic" aria-hidden="true">
                        <MpIcon name="badgeCheck" size={16} />
                      </span>
                      <div className="mp-ac-trust-panel-text">
                        <strong className="mp-ac-trust-panel-value">{dealCount || 0}</strong>
                        <span className="mp-ac-trust-panel-label">Confirmed deals</span>
                      </div>
                    </div>
                    <div
                      className={`mp-ac-trust-panel mp-ac-trust-level mp-level-badge--t${sellerLevel.tier}`}
                      title={`${sellerLevel.name} — ${sellerLevel.label}`}
                    >
                      <span className="mp-ac-trust-panel-ic" aria-hidden="true">
                        <MpIcon name={sellerLevelIcon(sellerLevel.tier)} size={16} />
                      </span>
                      <div className="mp-ac-trust-panel-text">
                        <strong
                          className="mp-ac-trust-panel-value"
                          title={sellerLevel.name}
                        >
                          {sellerLevel.name}
                        </strong>
                        <span
                          className="mp-ac-trust-panel-label"
                          title={sellerLevel.label}
                        >
                          {sellerLevel.label}
                        </span>
                      </div>
                      <div className="mp-ac-level-bar" aria-hidden="true">
                        <i style={{ width: `${sellerLevel.pct || 8}%` }} />
                      </div>
                    </div>
                  </div>

                  {!trustLoading && (
                    <div className="mp-ac-trust-badge-row">
                      <TrustBadge trustScore={trustScore} dealCount={dealCount} />
                    </div>
                  )}
                </div>
                <ul className="mp-ac-rows">
                  <li className="mp-ac-row">
                    <span className="mp-ac-row-ic" aria-hidden="true"><MpIcon name="badgeCheck" size={15} /></span>
                    <span className="mp-ac-row-meta">
                      <span className="mp-ac-row-k">Verification status</span>
                      <strong className={`mp-ac-row-v${profile.is_verified ? ' is-ok' : ' is-warn'}`}>
                        {profile.is_verified ? 'Verified' : 'Not verified'}
                      </strong>
                    </span>
                    {profile.is_verified && <VerifiedSeal size={16} />}
                  </li>
                  <li className="mp-ac-row">
                    <span className="mp-ac-row-ic" aria-hidden="true"><MpIcon name="badgeCheck" size={15} /></span>
                    <span className="mp-ac-row-meta">
                      <span className="mp-ac-row-k">Confirmed deals</span>
                      <strong className="mp-ac-row-v">{dealCount || 0}</strong>
                    </span>
                  </li>
                </ul>
                <div className="mp-ac-card-actions">
                  {!profile.is_verified ? (
                    <button type="button" className="mp-btn-verify" onClick={() => setShowVerify(true)}>
                      <MpIcon name="shieldCheck" size={15} /> Get verified
                    </button>
                  ) : (
                    <button type="button" className="mp-btn-secondary" onClick={() => openGroup('trust')}>
                      Open Trust Center
                    </button>
                  )}
                  <button type="button" className="mp-btn-secondary" onClick={() => openGroup('trust')}>
                    Trust panel
                    <MpIcon name="chevronRight" size={14} />
                  </button>
                </div>
              </section>

              {/* 4. Security */}
              <section className="mp-ac-card" aria-labelledby="mp-ac-sec-title">
                <div className="mp-ac-card-head">
                  <span className="mp-ac-card-ic" aria-hidden="true"><MpIcon name="lock" size={18} /></span>
                  <div className="mp-ac-card-head-text">
                    <h4 id="mp-ac-sec-title" className="mp-ac-card-title">Security</h4>
                    <p className="mp-ac-card-sub">Sign-in and session preferences</p>
                  </div>
                </div>
                <ul className="mp-ac-rows">
                  <li className="mp-ac-row">
                    <span className="mp-ac-row-ic" aria-hidden="true"><MpIcon name="keyRound" size={15} /></span>
                    <span className="mp-ac-row-meta">
                      <span className="mp-ac-row-k">Sign-in method</span>
                      <strong className="mp-ac-row-v">{signInMethod}</strong>
                    </span>
                  </li>
                  <li className="mp-ac-row">
                    <span className="mp-ac-row-ic" aria-hidden="true"><MpIcon name="calendar" size={15} /></span>
                    <span className="mp-ac-row-meta">
                      <span className="mp-ac-row-k">Last login</span>
                      <strong className="mp-ac-row-v">{lastLoginLabel || '—'}</strong>
                    </span>
                    {!lastLoginLabel && <em className="mp-ac-soon">Unavailable</em>}
                  </li>
                  <li className="mp-ac-row">
                    <span className="mp-ac-row-ic" aria-hidden="true"><MpIcon name="lock" size={15} /></span>
                    <span className="mp-ac-row-meta">
                      <span className="mp-ac-row-k">Password &amp; authentication</span>
                      <strong className="mp-ac-row-v">
                        {signInMethod === 'Email & password'
                          ? 'Email login enabled'
                          : `Signed in with ${signInMethod}`}
                      </strong>
                    </span>
                    <button
                      type="button"
                      className="mp-ac-link-btn"
                      onClick={() => navigate('/reset-password')}
                      title="Open password recovery"
                    >
                      Manage
                    </button>
                  </li>
                </ul>

                <div className="mp-ac-devices" aria-label="Connected devices">
                  <div className="mp-ac-devices-head">
                    <span className="mp-ac-devices-title">
                      <MpIcon name="monitor" size={15} />
                      Connected devices
                    </span>
                    <span className="mp-ac-devices-count">
                      {connectedDevices.length
                        ? `${connectedDevices.length} active`
                        : 'This browser'}
                    </span>
                  </div>

                  {connectedDevices.length === 0 ? (
                    <div className="mp-ac-device is-current">
                      <span className="mp-ac-device-ic" aria-hidden="true">
                        <MpIcon name="monitor" size={18} />
                      </span>
                      <span className="mp-ac-device-meta">
                        <strong className="mp-ac-device-name">
                          {parseDeviceFromUserAgent(
                            typeof navigator !== 'undefined' ? navigator.userAgent : ''
                          ).label}
                        </strong>
                        <span className="mp-ac-device-sub">
                          <span className="mp-ac-device-pill is-now">This device</span>
                          Active now
                        </span>
                      </span>
                    </div>
                  ) : (
                    <ul className="mp-ac-device-list">
                      {connectedDevices.map((d) => (
                        <li key={d.id} className={`mp-ac-device${d.isCurrent ? ' is-current' : ''}`}>
                          <span className="mp-ac-device-ic" aria-hidden="true">
                            <MpIcon
                              name={d.kind === 'mobile' || d.kind === 'tablet' ? 'smartphone' : 'monitor'}
                              size={18}
                            />
                          </span>
                          <span className="mp-ac-device-meta">
                            <strong className="mp-ac-device-name">{d.label}</strong>
                            <span className="mp-ac-device-sub">
                              {d.isCurrent ? (
                                <span className="mp-ac-device-pill is-now">This device</span>
                              ) : null}
                              {d.lastActive
                                ? d.isCurrent
                                  ? 'Active now'
                                  : `Last active ${timeAgoShort(d.lastActive)} ago`
                                : 'Session recorded'}
                            </span>
                          </span>
                          <button
                            type="button"
                            className="mp-ac-device-revoke"
                            disabled={revokingSessionId === d.id}
                            onClick={() => handleRevokeSession(d)}
                            title={d.isCurrent ? 'Sign out this device' : 'Remove this device'}
                          >
                            {revokingSessionId === d.id
                              ? '…'
                              : d.isCurrent
                                ? 'Sign out'
                                : 'Remove'}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {securityEvents?.length > 0 && (
                    <p className="mp-ac-devices-foot">
                      Last security event: {securityEvents[0].title}
                    </p>
                  )}
                </div>
              </section>

              {/* 5. Danger Zone */}
              <section className="mp-ac-card mp-ac-card-danger" aria-labelledby="mp-ac-danger-title">
                <div className="mp-ac-card-head">
                  <span className="mp-ac-card-ic is-danger" aria-hidden="true"><MpIcon name="alertCircle" size={18} /></span>
                  <div className="mp-ac-card-head-text">
                    <h4 id="mp-ac-danger-title" className="mp-ac-card-title">Danger zone</h4>
                    <p className="mp-ac-card-sub">Sensitive account actions — confirm before continuing</p>
                  </div>
                </div>
                <div className="mp-ac-danger-grid">
                  <div className="mp-ac-danger-item is-live">
                    <div className="mp-ac-danger-copy">
                      <strong>Sign out</strong>
                      <span>End your session on this device</span>
                    </div>
                    <button type="button" className="mp-ac-danger-btn" onClick={confirmSignOut}>
                      <MpIcon name="logOut" size={15} />
                      Sign out
                    </button>
                  </div>
                  <div className="mp-ac-danger-item is-soon">
                    <div className="mp-ac-danger-copy">
                      <strong>Delete account</strong>
                      <span>Permanently remove your SokoMw account</span>
                    </div>
                    <button type="button" className="mp-ac-btn-disabled" disabled title="Coming soon">
                      <MpIcon name="trash2" size={14} /> Delete
                    </button>
                    <em className="mp-ac-soon">Coming soon</em>
                  </div>
                  <div className="mp-ac-danger-item is-soon">
                    <div className="mp-ac-danger-copy">
                      <strong>Download my data</strong>
                      <span>Export a copy of your account data</span>
                    </div>
                    <button type="button" className="mp-ac-btn-disabled" disabled title="Coming soon">
                      <MpIcon name="download" size={14} /> Download
                    </button>
                    <em className="mp-ac-soon">Coming soon</em>
                  </div>
                  <div className="mp-ac-danger-item is-soon">
                    <div className="mp-ac-danger-copy">
                      <strong>Export listings</strong>
                      <span>Download inventory as a file</span>
                    </div>
                    <button type="button" className="mp-ac-btn-disabled" disabled title="Coming soon">
                      <MpIcon name="fileDown" size={14} /> Export
                    </button>
                    <em className="mp-ac-soon">Coming soon</em>
                  </div>
                  <div className="mp-ac-danger-item is-soon">
                    <div className="mp-ac-danger-copy">
                      <strong>Privacy controls</strong>
                      <span>Visibility and data sharing preferences</span>
                    </div>
                    <button type="button" className="mp-ac-btn-disabled" disabled title="Coming soon">
                      <MpIcon name="shield" size={14} /> Open
                    </button>
                    <em className="mp-ac-soon">Coming soon</em>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </>
      )}
        </div>
      </div>

      {/* RIGHT — Insights panel */}
      <aside
        className={`mp-col mp-col-insights${activeGroup === 'overview' ? ' is-overview' : ''}`}
        aria-label="Insights"
      >
        <div className="mp-insights">
          <div className="mp-insights-head">
            <h3 className="mp-insights-title">Insights</h3>
            <p className="mp-insights-sub">Strength · trust · growth · feature</p>
          </div>

          {/* 1. Profile Strength */}
          <div className="mp-insights-card">
            <div className="mp-insights-card-label">Profile strength</div>
            <div className="mp-complete-head">
              <span className="mp-complete-sub">{completeness.done}/{completeness.total} complete</span>
              <strong className="mp-complete-pct">{completeness.pct}%</strong>
            </div>
            <div className="mp-complete-bar">
              <div className="mp-complete-fill" style={{ width: `${completeness.pct}%` }} />
            </div>
            {completeness.next ? (
              <button type="button" className="mp-next-tip" onClick={handleNextCompleteness}>
                <span>Next step</span>
                <strong>{completeness.next.tip}</strong>
              </button>
            ) : (
              <p className="mp-complete-done">Profile looks complete for buyers.</p>
            )}
            {completeness.checks.some(c => !c.ok) && (
              <div className="mp-missing">
                <span className="mp-missing-label">Still needed</span>
                <div className="mp-missing-list">
                  {completeness.checks.filter(c => !c.ok).map(c => (
                    <button key={c.key} type="button" className="mp-missing-chip" onClick={handleNextCompleteness}>{c.label}</button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 2. Trust Score */}
          <div className="mp-insights-card">
            <div className="mp-insights-card-label">Trust score</div>
            {!trustLoading && (
              <div className="mp-trust-strip">
                <TrustBadge trustScore={trustScore} dealCount={dealCount} />
              </div>
            )}
            <ul className="mp-insights-stats">
              <li><span>Confirmed deals</span><strong>{dealCount || 0}</strong></li>
              <li><span>Identity</span><strong>{profile.is_verified ? 'Verified' : 'Not verified'}</strong></li>
              <li><span>Sold items</span><strong>{soldListings.length}</strong></li>
            </ul>
            <div className="mp-insights-actions">
              {!profile.is_verified && (
                <button type="button" className="mp-btn-verify" onClick={() => setShowVerify(true)}>Get verified</button>
              )}
              <button type="button" className="mp-btn-secondary" onClick={() => openGroup('trust')}>View trust</button>
            </div>
          </div>

          {/* 3. Seller Level */}
          <div className="mp-insights-card mp-level-card">
            <div className="mp-insights-card-label">Seller level</div>
            <div className="mp-level-row">
              <div className={`mp-level-badge mp-level-badge--t${sellerLevel.tier}`} aria-hidden="true">
                {sellerLevel.tier === 4 ? '♛' : sellerLevel.tier === 3 ? '★' : sellerLevel.tier === 2 ? '◆' : '●'}
              </div>
              <div className="mp-level-copy">
                <strong className="mp-level-name">{sellerLevel.name}</strong>
                <span className="mp-level-label">{sellerLevel.label}</span>
              </div>
            </div>
            <div className="mp-complete-bar mp-level-bar">
              <div className="mp-complete-fill" style={{ width: `${sellerLevel.pct}%` }} />
            </div>
            {sellerLevel.next ? (
              <p className="mp-level-next">
                Next: <strong>{sellerLevel.next}</strong>
                {sellerLevel.tip ? ` — ${sellerLevel.tip}` : ''}
              </p>
            ) : (
              <p className="mp-level-next">You are at the top seller tier on SokoMw.</p>
            )}
          </div>

          {/* 4. Availability */}
          <div className="mp-insights-card">
            <div className="mp-insights-card-label">Availability</div>
            {activeStatus ? (
              <div className="mp-status-active mp-status-active-compact">
                <div className="mp-status-body">
                  <div className="mp-status-kicker">Live now</div>
                  <div className="mp-status-text">{activeStatus.content}</div>
                </div>
                <button type="button" className="mp-btn-secondary mp-btn-sm" onClick={() => setShowStatusPicker(true)}>Update</button>
              </div>
            ) : (
              <button type="button" className="mp-status-cta" onClick={() => setShowStatusPicker(true)}>
                <span className="mp-status-cta-ic" aria-hidden="true">📢</span>
                <span className="mp-status-cta-copy">
                  <strong>Post availability</strong>
                  <span>Let buyers know you&apos;re free</span>
                </span>
              </button>
            )}
          </div>

          {/* 5. Quick Actions */}
          <div className="mp-insights-card">
            <div className="mp-insights-card-label">Quick actions</div>
            <div className="mp-insight-qactions">
              <button type="button" className="mp-iqbtn" onClick={() => navigate('/post')}>+ Listing</button>
              <button type="button" className="mp-iqbtn" onClick={() => openGroup('selling')}>Inventory</button>
              <button type="button" className="mp-iqbtn" onClick={() => navigate('/chats')}>Messages</button>
              <button type="button" className="mp-iqbtn" onClick={() => navigate(shopPath)}>{shop ? 'My shop' : 'Create shop'}</button>
              <button type="button" className="mp-iqbtn" onClick={() => openGroup('network')}>Network</button>
              <button type="button" className="mp-iqbtn" onClick={() => navigate('/notifications')}>Alerts</button>
            </div>
          </div>

          {/* 6. Recent Activity */}
          <div className="mp-insights-card">
            <div className="mp-insights-card-label">Recent activity</div>
            {recentActivity.length === 0 ? (
              <p className="mp-insights-empty">No listing activity yet. Post something to get started.</p>
            ) : (
              <ul className="mp-activity-list">
                {recentActivity.map(item => (
                  <li key={item.id}>
                    <button type="button" className="mp-activity-item" onClick={() => navigate('/listing/' + item.id)}>
                      <span className={`mp-activity-dot${item.status === 'sold' ? ' is-sold' : ''}`} aria-hidden="true" />
                      <span className="mp-activity-text">{item.text}</span>
                      <span className="mp-activity-time">{timeAgoShort(item.when)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="mp-link mp-insights-more" onClick={() => openGroup('selling')}>
              View inventory →
            </button>
          </div>

          {/* 7. Tips */}
          <div className="mp-insights-card">
            <div className="mp-insights-card-label">Tips</div>
            <ul className="mp-tips-list">
              {insightTips.map(tip => (
                <li key={tip.id} className="mp-tip-row">
                  <p className="mp-tip-text">{tip.text}</p>
                  <button type="button" className="mp-tip-cta" onClick={tip.onClick}>{tip.cta}</button>
                </li>
              ))}
            </ul>
          </div>

          {/* 8. Featured Promotion */}
          <div className="mp-insights-card mp-promo-card">
            <div className="mp-promo-head">
              <span className="mp-promo-head-icon" aria-hidden="true">
                <MpIcon name="crown" size={16} />
              </span>
              <div className="mp-promo-head-text">
                <div className="mp-insights-card-label mp-promo-label">Featured</div>
                <p className="mp-promo-head-sub">Homepage boost</p>
              </div>
              {featuredListings.length > 0 && (
                <span className="mp-promo-count-pill" title="Active featured listings">
                  <MpIcon name="sparkles" size={12} />
                  {featuredListings.length}
                </span>
              )}
            </div>

            {featuredListings.length > 0 ? (
              <>
                <p className="mp-promo-lead">
                  <strong>{featuredListings.length}</strong>
                  {' '}live · boosting reach
                </p>
                <ul className="mp-promo-list">
                  {featuredListings.slice(0, 3).map(l => {
                    const img = Array.isArray(l.images) ? l.images[0] : null
                    return (
                      <li key={l.id}>
                        <button
                          type="button"
                          className="mp-promo-item"
                          onClick={() => navigate('/listing/' + l.id)}
                        >
                          <span className="mp-promo-thumb">
                            {img ? (
                              <img src={img} alt="" loading="lazy" decoding="async" />
                            ) : (
                              <span className="mp-promo-thumb-ph" aria-hidden="true">
                                <MpIcon name="package" size={18} />
                              </span>
                            )}
                            <span className="mp-promo-thumb-badge" aria-hidden="true">
                              <MpIcon name="star" size={9} />
                            </span>
                          </span>
                          <span className="mp-promo-meta">
                            <span className="mp-promo-title">{l.title || 'Untitled'}</span>
                            <span className="mp-promo-price">
                              MWK {Number(l.price || 0).toLocaleString()}
                            </span>
                          </span>
                          <span className="mp-promo-go" aria-hidden="true">
                            <MpIcon name="chevronRight" size={16} />
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {featuredListings.length > 3 && (
                  <button
                    type="button"
                    className="mp-promo-more"
                    onClick={() => openGroup('selling')}
                  >
                    +{featuredListings.length - 3} more in inventory
                  </button>
                )}
                <button
                  type="button"
                  className="mp-promo-cta-btn"
                  onClick={openFeatureChoice}
                >
                  <MpIcon name="plusCircle" size={16} />
                  Feature another
                </button>
              </>
            ) : (
              <>
                <div className="mp-promo-empty">
                  <span className="mp-promo-empty-icon" aria-hidden="true">
                    <MpIcon name="trendingUp" size={22} />
                  </span>
                  <p className="mp-promo-lead mp-promo-lead-empty">
                    Put a listing on the homepage for more views.
                  </p>
                  <p className="mp-promo-note">
                    {featuredPriceLabel()}, or free entitlement if available.
                  </p>
                </div>
                <button
                  type="button"
                  className="mp-promo-cta-btn mp-promo-cta-btn-primary"
                  onClick={openFeatureChoice}
                >
                  <MpIcon name={activeListing.length ? 'sparkles' : 'plusCircle'} size={16} />
                  {activeListing.length ? 'Feature a listing' : 'Post & feature'}
                </button>
              </>
            )}
          </div>
        </div>
      </aside>
      </div>

      {/* Feature another — choose existing listing or create new */}
      {showFeatureChoice && (
        <div className="mp-overlay" onClick={() => setShowFeatureChoice(false)}>
          <div className="mp-modal mp-feature-choice-modal" onClick={e => e.stopPropagation()} role="dialog" aria-labelledby="mp-feature-choice-title">
            <div className="mp-fc-head">
              <div className="mp-fc-head-icon" aria-hidden="true">
                <MpIcon name="crown" size={22} />
              </div>
              <div className="mp-fc-head-text">
                <h3 id="mp-feature-choice-title">Feature a listing</h3>
                <p>Homepage boost · gold badge · more views</p>
              </div>
              <button
                type="button"
                className="mp-fc-close"
                onClick={() => setShowFeatureChoice(false)}
                aria-label="Close"
              >
                <MpIcon name="x" size={18} />
              </button>
            </div>

            <div className="mp-fc-options">
              <button
                type="button"
                className="mp-fc-option mp-fc-option-new"
                onClick={chooseFeatureNewListing}
              >
                <span className="mp-fc-option-icon mp-fc-option-icon-new" aria-hidden="true">
                  <MpIcon name="plusCircle" size={22} />
                </span>
                <span className="mp-fc-option-body">
                  <span className="mp-fc-option-title">New listing</span>
                  <span className="mp-fc-option-desc">Create one — Feature is pre-selected</span>
                </span>
                <span className="mp-fc-option-chevron" aria-hidden="true">
                  <MpIcon name="chevronRight" size={18} />
                </span>
              </button>

              <div className={`mp-fc-option mp-fc-option-existing${featureableListings.length === 0 ? ' is-disabled' : ''}`}>
                <span className="mp-fc-option-icon mp-fc-option-icon-exist" aria-hidden="true">
                  <MpIcon name="package" size={22} />
                </span>
                <span className="mp-fc-option-body">
                  <span className="mp-fc-option-title">Existing listing</span>
                  <span className="mp-fc-option-desc">
                    {featureableListings.length === 0
                      ? 'No unfeatured active listings yet'
                      : featureableListings.length === 1
                        ? 'Tap the product below to feature it'
                        : `Tap a product · ${featureableListings.length} available`}
                  </span>
                </span>
                {featureableListings.length > 0 && (
                  <span className="mp-fc-option-count" aria-hidden="true">
                    {featureableListings.length}
                  </span>
                )}
              </div>
            </div>

            {featureableListings.length > 0 && (
              <div className="mp-fc-picker">
                <div className="mp-fc-picker-label">
                  <MpIcon name="sparkles" size={14} />
                  <span>Your products</span>
                </div>
                <ul className="mp-fc-product-list">
                  {featureableListings.map(l => {
                    const img = Array.isArray(l.images) ? l.images[0] : null
                    const busy = featuringId === l.id
                    return (
                      <li key={l.id}>
                        <button
                          type="button"
                          className={`mp-fc-product${busy ? ' is-busy' : ''}`}
                          disabled={!!featuringId}
                          onClick={() => chooseFeatureExisting(l)}
                        >
                          <span className="mp-fc-product-thumb">
                            {img ? (
                              <img src={img} alt="" loading="lazy" decoding="async" />
                            ) : (
                              <span className="mp-fc-product-thumb-ph" aria-hidden="true">
                                <MpIcon name="package" size={22} />
                              </span>
                            )}
                          </span>
                          <span className="mp-fc-product-meta">
                            <span className="mp-fc-product-title">{l.title || 'Untitled'}</span>
                            <span className="mp-fc-product-price">
                              MWK {Number(l.price || 0).toLocaleString()}
                            </span>
                            {(l.district || l.city) && (
                              <span className="mp-fc-product-loc">
                                <MpIcon name="mapPin" size={11} />
                                {l.district || l.city}
                              </span>
                            )}
                          </span>
                          <span className="mp-fc-product-action" aria-hidden="true">
                            {busy ? (
                              <MpIcon name="loaderCircle" size={18} className="mp-fc-spin" />
                            ) : (
                              <span className="mp-fc-product-boost">
                                <MpIcon name="star" size={14} />
                                Feature
                              </span>
                            )}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            )}

            {featureableListings.length === 0 && (
              <div className="mp-fc-empty">
                <span className="mp-fc-empty-icon" aria-hidden="true">
                  <MpIcon name="package" size={28} />
                </span>
                <p>Post a listing first, then feature it for homepage placement.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="mp-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="mp-modal" onClick={e => e.stopPropagation()}>
            <h3>Delete listing?</h3>
            <p>This cannot be undone.</p>
            <div className="mp-modal-btns">
              <button type="button" className="mp-btn-secondary" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button type="button" className="mp-btn-danger" onClick={() => deleteListing(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {showStatusPicker && (
        <div className="mp-overlay bottom" onClick={() => setShowStatusPicker(false)}>
          <div className="mp-sheet" onClick={e => e.stopPropagation()}>
            <div className="mp-sheet-head">
              <h3>Post a status</h3>
              <button type="button" className="mp-sheet-close" onClick={() => setShowStatusPicker(false)}>✕</button>
            </div>
            <StatusPicker userId={user?.id} onDone={() => setShowStatusPicker(false)} />
          </div>
        </div>
      )}

      {showVerify && (
        <VerificationModal
          user={user}
          onClose={() => setShowVerify(false)}
          onSuccess={() => {
            setShowVerify(false)
            loadProfile(user.id)
          }}
        />
      )}
    </div>
  )
}

const css = `
  /* ═══════════════════════════════════════════════════════════════════════
     SokoMW Profile — design system (scoped under .mp-page)
     Tokens · type · surfaces · interaction · layout · responsive
     ═══════════════════════════════════════════════════════════════════════ */

  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');

  .mp-page {
    /* Brand */
    --mp-green: #0F9D58;
    --mp-green-d: #0a7a44;
    --mp-green-deep: #063d23;
    --mp-green-l: #e8f5ee;
    --mp-green-mist: #f6fbf8;
    --mp-amber: #F9AB00;
    --mp-amber-soft: #ffd666;
    --mp-blue: #1A73E8;
    --mp-blue-d: #1557b0;
    --mp-blue-l: #e8f0fe;
    --mp-red: #ea4335;
    --mp-red-d: #c5221f;
    --mp-red-l: #fce8e6;
    --mp-orange: #FF7A1A;

    /* Neutrals */
    --mp-ink: #0f1410;
    --mp-ink-soft: #0a0f0c;
    --mp-muted: #5f6368;
    --mp-subtle: #80868b;
    --mp-faint: #9aa0a6;
    --mp-line: #e8f0eb;
    --mp-line-soft: #eef2ef;
    --mp-line-strong: #e0ebe3;
    --mp-surface: #ffffff;
    --mp-surface-2: #fafcfb;
    --mp-surface-3: #f8fbf9;
    --mp-bg: #f4f7f5;

    /* Type */
    --mp-font: Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
    --mp-display: Sora, Inter, system-ui, sans-serif;

    /* Radii / shadow / motion */
    --mp-r-sm: 10px;
    --mp-r-md: 12px;
    --mp-r-lg: 16px;
    --mp-r-xl: 18px;
    --mp-r-pill: 999px;
    --mp-shadow-xs: 0 1px 2px rgba(6, 61, 35, 0.04);
    --mp-shadow-sm: 0 2px 10px rgba(6, 61, 35, 0.05);
    --mp-shadow-md: 0 4px 18px rgba(6, 61, 35, 0.07);
    --mp-shadow-lg: 0 10px 32px rgba(6, 61, 35, 0.10);
    --mp-shadow-green: 0 4px 14px rgba(15, 157, 88, 0.22);
    --mp-shadow-blue: 0 4px 14px rgba(26, 115, 232, 0.22);
    --mp-ease: cubic-bezier(0.22, 1, 0.36, 1);
    --mp-dur: 160ms;

    /* Layout */
    --mp-pad-x: max(12px, env(safe-area-inset-left, 0px));
    --mp-pad-r: max(12px, env(safe-area-inset-right, 0px));
    --mp-nav-w: 280px;
    --mp-topbar-h: 52px;
    --mp-pnav-mob-h: 48px;
    --mp-app-nav-h: 62px;
    /* App BottomNav only at bottom (+ safe area) — section chips live under top bar */
    --mp-bottom-clear: calc(72px + env(safe-area-inset-bottom, 0px));

    width: 100%;
    min-width: 0;
    min-height: 100dvh;
    min-height: 100vh;
    background:
      radial-gradient(ellipse 90% 42% at 50% -12%, rgba(15, 157, 88, 0.11), transparent 58%),
      radial-gradient(ellipse 48% 28% at 100% 18%, rgba(249, 171, 0, 0.07), transparent 52%),
      radial-gradient(ellipse 40% 24% at 0% 60%, rgba(15, 157, 88, 0.04), transparent 50%),
      var(--mp-bg);
    padding-bottom: var(--mp-bottom-clear);
    font-family: var(--mp-font);
    color: var(--mp-ink);
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    text-rendering: optimizeLegibility;
    /* Only clip horizontal overflow — do not create a broken nested scroll trap */
    overflow-x: clip;
    overflow-y: visible;
    line-height: 1.45;
  }

  /* ── Phase 13 design system tokens ── */
  .mp-icon {
    display: inline-block;
    vertical-align: middle;
    flex-shrink: 0;
    color: currentColor;
  }
  .mp-pnav-item-ic .mp-icon,
  .mp-pnav-mob-ic .mp-icon,
  .mp-pnav-more-ic .mp-icon,
  .mp-hero-stat-ic .mp-icon,
  .mp-od-stat-ic .mp-icon,
  .mp-od-action-ic .mp-icon,
  .mp-buy-stat-ic .mp-icon,
  .mp-buy-dest-ic .mp-icon,
  .mp-tc-metric-ic .mp-icon,
  .mp-nd-stat-ic .mp-icon,
  .mp-sold-kpi-ic .mp-icon,
  .mp-inv-action-ic .mp-icon,
  .mp-detail-ic .mp-icon {
    display: block;
  }
  .mp-pnav-item-ic,
  .mp-od-stat-ic,
  .mp-od-action-ic,
  .mp-buy-dest-ic,
  .mp-tc-metric-ic,
  .mp-nd-stat-ic,
  .mp-sold-kpi-ic,
  .mp-inv-action-ic,
  .mp-buy-stat-ic,
  .mp-buy-continue-ic,
  .mp-tc-achieve-ic,
  .mp-hero-stat-ic {
    color: var(--mp-green-d);
  }
  .mp-pnav-item.is-active .mp-pnav-item-ic,
  .mp-od-action--green .mp-od-action-ic,
  .mp-pnav-mob-item.is-active .mp-pnav-mob-ic {
    color: #fff;
  }
  .mp-hchip .mp-icon { color: currentColor; }
  .mp-ds-kicker,
  .mp-ds-section-title,
  .mp-ds-page-title {
    font-family: var(--mp-display);
  }
  .mp-ds-section-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 0 4px;
  }
  .mp-ds-section-title {
    margin: 0;
    font-size: 1.05rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--mp-ink);
  }
  .mp-ds-section-sub {
    margin: 4px 0 0;
    font-size: 0.78rem;
    color: var(--mp-muted);
    font-weight: 500;
  }
  .mp-ds-link {
    border: none;
    background: none;
    color: var(--mp-green-d);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    padding: 4px 0;
  }
  .mp-ds-link:hover { text-decoration: underline; }
  .mp-ds-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    border-radius: 999px;
    padding: 3px 8px;
  }
  .mp-ds-badge--neutral { background: #eef0f0; color: var(--mp-subtle); }
  .mp-ds-badge--success { background: rgba(15, 157, 88, 0.12); color: var(--mp-green-d); }
  .mp-ds-badge--warn { background: rgba(249, 171, 0, 0.16); color: #b45309; }
  .mp-ds-badge--danger { background: #fee2e2; color: #b91c1c; }
  .mp-ds-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1.5px solid rgba(15, 23, 42, 0.08);
    background: var(--mp-surface);
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--mp-ink);
    cursor: pointer;
    transition: background 140ms var(--mp-ease), border-color 140ms var(--mp-ease), transform 100ms var(--mp-ease);
  }
  .mp-ds-chip:hover {
    background: var(--mp-green-mist);
    border-color: rgba(15, 157, 88, 0.22);
  }
  .mp-ds-chip.is-active {
    background: rgba(15, 157, 88, 0.12);
    border-color: rgba(15, 157, 88, 0.28);
    color: var(--mp-green-d);
  }
  .mp-ds-chip:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
  }
  .mp-ds-icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    min-height: 40px;
    min-width: 40px;
    padding: 0 10px;
    border-radius: 12px;
    border: 1.5px solid rgba(15, 23, 42, 0.08);
    background: #fff;
    color: var(--mp-muted);
    cursor: pointer;
    font-size: 0.72rem;
    font-weight: 700;
    transition: background 140ms var(--mp-ease), border-color 140ms var(--mp-ease), color 140ms var(--mp-ease), transform 100ms var(--mp-ease);
  }
  .mp-ds-icon-btn:hover:not(:disabled) {
    background: var(--mp-green-mist);
    border-color: rgba(15, 157, 88, 0.22);
    color: var(--mp-green-d);
  }
  .mp-ds-icon-btn:active:not(:disabled) { transform: scale(0.96); }
  .mp-ds-icon-btn:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
  }
  .mp-ds-icon-btn:disabled { opacity: 0.42; cursor: not-allowed; }
  .mp-ds-icon-btn--primary {
    background: linear-gradient(135deg, var(--mp-green), var(--mp-green-d));
    border-color: transparent;
    color: #fff;
  }
  .mp-ds-icon-btn--danger:hover:not(:disabled) {
    background: #fff5f4;
    border-color: #f5c6c2;
    color: var(--mp-red);
  }
  .mp-ds-icon-btn--sm { min-height: 36px; min-width: 36px; }
  .mp-ds-icon-btn-txt { display: none; }
  @media (min-width: 480px) {
    .mp-ds-icon-btn-txt { display: inline; }
  }
  .mp-ds-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    padding: 36px 20px;
    border-radius: 20px;
    background: linear-gradient(165deg, rgba(232, 245, 238, 0.4), #fff 55%);
    border: 1px dashed rgba(15, 157, 88, 0.22);
  }
  .mp-ds-empty-art {
    position: relative;
    width: 80px;
    height: 80px;
    display: grid;
    place-items: center;
  }
  .mp-ds-empty-blob {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle at 40% 40%, rgba(15, 157, 88, 0.16), transparent 68%);
  }
  .mp-ds-empty-ic {
    position: relative;
    z-index: 1;
    color: var(--mp-green-d);
  }
  .mp-ds-empty-title {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--mp-ink);
  }
  .mp-ds-empty-text {
    margin: 0;
    max-width: 360px;
    font-size: 0.84rem;
    color: var(--mp-muted);
    line-height: 1.45;
  }
  .mp-ds-empty-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 4px;
  }
  .mp-ds-skel {
    border-radius: 20px;
    background: linear-gradient(90deg, #eef1ef 0%, #f7f8f7 45%, #eef1ef 100%);
    background-size: 200% 100%;
    animation: mp-od-shimmer 1.2s ease-in-out infinite;
  }
  .mp-ds-skel-stat { height: 96px; }
  .mp-ds-skel-card { height: 120px; }
  .mp-ds-skel-line { height: 12px; border-radius: 8px; margin: 6px 0; }
  .mp-ds-skel-avatar { width: 48px; height: 48px; border-radius: 50%; }
  .mp-ds-skel-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
    gap: 10px;
  }
  .mp-ds-verified { color: var(--mp-green); }

  .mp-page *,
  .mp-page *::before,
  .mp-page *::after { box-sizing: border-box; }

  .mp-page button {
    font-family: inherit;
    -webkit-tap-highlight-color: transparent;
  }

  .mp-page button:focus-visible,
  .mp-page a:focus-visible,
  .mp-page input:focus-visible,
  .mp-page select:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .mp-page *,
    .mp-page *::before,
    .mp-page *::after {
      animation-duration: 0.01ms !important;
      animation-iteration-count: 1 !important;
      transition-duration: 0.01ms !important;
      scroll-behavior: auto !important;
    }
  }

  /* ── Shell (3-col on desktop) ── */
  .mp-shell {
    width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .mp-col { min-width: 0; }
  .mp-shell.is-nav .mp-col-detail { display: none; }
  .mp-shell.is-detail .mp-col-nav { display: none; }
  /* Insights follow the detail pane on phone; always visible from tablet up */
  .mp-shell.is-nav .mp-col-insights { display: none; }

  /* ── PHASE 4 FINAL — tight 3-col premium hero ── */
  .mp-hero-premium {
    position: relative;
    margin: 0;
    width: 100%;
    animation: mp-hero-in 380ms var(--mp-ease) both;
  }
  @keyframes mp-hero-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }

  .mp-hero-media {
    position: relative;
    /* Compact premium cover — prioritizes profile dashboard below */
    height: 130px;
    max-height: 130px;
    width: 100%;
    overflow: hidden;
    isolation: isolate;
    background: #0b1a12;
  }
  .mp-hero-cover { position: absolute; inset: 0; z-index: 0; }
  .mp-hero-cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center 40%;
    display: block;
  }
  /* Malawi marketplace cover — warm market stalls, not flat login green */
  .mp-hero-cover-fallback {
    position: absolute;
    inset: 0;
    background:
      radial-gradient(ellipse 40% 55% at 18% 40%, rgba(249, 171, 0, 0.42), transparent 58%),
      radial-gradient(ellipse 35% 50% at 78% 25%, rgba(234, 88, 12, 0.22), transparent 52%),
      radial-gradient(ellipse 50% 45% at 55% 95%, rgba(26, 115, 232, 0.16), transparent 55%),
      linear-gradient(118deg, #041c10 0%, #0a4a2c 32%, #0d7a45 58%, #1b6b3a 82%, #0a3d24 100%);
  }
  .mp-hero-blob {
    position: absolute;
    border-radius: 50%;
    filter: blur(30px);
    opacity: 0.48;
    pointer-events: none;
  }
  .mp-hero-blob-a { width: 150px; height: 150px; top: -30px; left: 10%; background: rgba(249,171,0,.55); }
  .mp-hero-blob-b { width: 190px; height: 190px; right: -36px; bottom: -60px; background: rgba(255,255,255,.14); }
  .mp-hero-blob-c { width: 100px; height: 100px; left: 52%; top: 28%; background: rgba(15,157,88,.4); }
  .mp-hero-market-grid {
    position: absolute;
    inset: 18% 8% 22%;
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    gap: 8px;
    opacity: 0.22;
    pointer-events: none;
  }
  .mp-hero-market-grid::before,
  .mp-hero-market-grid::after {
    content: '';
    grid-column: span 2;
    border-radius: 10px 10px 4px 4px;
    background: linear-gradient(180deg, rgba(255,255,255,.55), rgba(255,255,255,.12));
    box-shadow: inset 0 -8px 0 rgba(0,0,0,.08);
  }
  .mp-hero-market-grid::after {
    grid-column: 3 / span 3;
    opacity: 0.85;
    background: linear-gradient(180deg, rgba(249,171,0,.5), rgba(255,255,255,.1));
  }
  .mp-hero-pattern {
    position: absolute;
    inset: 0;
    opacity: 0.09;
    background-image:
      radial-gradient(circle at 2px 2px, rgba(255,255,255,.9) 1px, transparent 0);
    background-size: 16px 16px;
    pointer-events: none;
  }
  .mp-hero-overlay-dark {
    position: absolute; inset: 0; z-index: 1; pointer-events: none;
    background: linear-gradient(180deg, rgba(0,0,0,.18) 0%, rgba(0,0,0,.06) 50%, rgba(0,0,0,.22) 100%);
  }
  .mp-hero-overlay-grad {
    position: absolute; inset: 0; z-index: 2; pointer-events: none;
    background: linear-gradient(100deg, rgba(5,40,22,.4) 0%, transparent 55%);
  }
  .mp-hero-overlay-blur {
    position: absolute; left: 0; right: 0; bottom: 0; height: 42%; z-index: 3; pointer-events: none;
    background: linear-gradient(180deg, transparent, rgba(250,251,252,.55) 70%, #fafbfc);
  }
  .mp-hero-media .mp-cover-actions { z-index: 6; }
  .mp-hero-media .mp-hero-banner-label {
    position: absolute; right: 16px; top: 14px; z-index: 4;
    text-align: right; pointer-events: none;
    text-shadow: 0 2px 10px rgba(0,0,0,.4);
  }

  /* Tight surface panel — height from content only */
  .mp-hero-panel {
    position: relative;
    z-index: 5;
    /* Minimal lift — avatar creates the overlap, not large empty gaps */
    margin-top: -8px;
    width: 100%;
    padding: 0 12px 0;
  }
  .mp-hero-panel-inner {
    width: 100%;
    max-width: none;
    margin: 0;
    background: #fafbfc;
    border: 1px solid rgba(15, 23, 42, 0.06);
    border-radius: 16px;
    box-shadow: 0 6px 22px rgba(15, 23, 42, 0.055);
    padding: 8px;
  }

  /*
    Two-row responsive grid (desktop becomes 280 / 1fr / 340):
    Row fills with identity | dashboard | insights; columns stretch
    so no large empty white voids next to the tallest column.
  */
  .mp-hero-grid {
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: auto;
    gap: 8px;
    align-items: stretch;
    width: 100%;
  }
  .mp-hero-col {
    min-width: 0;
    min-height: 0;
  }
  .mp-hero-col-id {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    /* ~45% of avatar sits over the banner bottom */
    margin-top: -46px;
    height: 100%;
  }
  .mp-hero-col-main {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
    height: 100%;
  }
  .mp-hero-col-side {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: auto;
    align-self: start;
  }
  .mp-hero-strength-card {
    height: auto;
  }

  /* Overview — Seller Insights (moved from hero) */
  .mp-seller-insights-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .mp-si-card {
    background: #fff;
    border: 1px solid rgba(15, 23, 42, 0.06);
    border-radius: 14px;
    padding: 12px 14px;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
    min-width: 0;
  }
  .mp-si-label {
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mp-subtle);
    margin-bottom: 8px;
  }
  .mp-si-tips-extra {
    list-style: none;
    margin: 10px 0 0;
    padding: 8px 0 0;
    border-top: 1px solid var(--mp-line-soft);
  }
  .mp-si-tips-extra li {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    padding: 6px 0;
    font-size: 0.75rem;
    color: var(--mp-muted);
  }
  .mp-si-more {
    display: inline-block;
    margin-top: 10px;
  }
  .mp-section-lead-tight {
    margin-bottom: 12px;
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PHASE 6 — Premium Overview dashboard
     ═══════════════════════════════════════════════════════════════════════ */
  .mp-odash {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 0 var(--mp-pad-r) 8px var(--mp-pad-x);
    animation: mp-fade-in 320ms var(--mp-ease) both;
  }
  .mp-od-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .mp-od-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 0 4px;
  }
  .mp-od-title {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1.05rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--mp-ink);
  }
  .mp-od-sub {
    margin: 4px 0 0;
    font-size: 0.78rem;
    color: var(--mp-muted);
    font-weight: 500;
    line-height: 1.4;
  }
  .mp-od-link {
    border: none;
    background: none;
    color: var(--mp-green-d);
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    padding: 4px 0;
    white-space: nowrap;
  }
  .mp-od-link:hover { text-decoration: underline; }
  .mp-od-muted {
    font-size: 0.78rem;
    color: var(--mp-muted);
    font-weight: 500;
    line-height: 1.4;
  }
  .mp-od-panel {
    background: var(--mp-surface);
    border: 1px solid rgba(15, 23, 42, 0.06);
    border-radius: 20px;
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.04),
      0 8px 24px rgba(15, 23, 42, 0.04);
    padding: 16px;
  }

  /* Welcome */
  .mp-od-welcome {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 20px;
    border-radius: 20px;
    background:
      linear-gradient(145deg, rgba(232, 245, 238, 0.9) 0%, #fff 48%, #fff 100%);
    border: 1px solid rgba(15, 157, 88, 0.12);
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.04),
      0 12px 32px rgba(6, 61, 35, 0.06);
  }
  .mp-od-welcome-kicker {
    margin: 0 0 6px;
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mp-green-d);
  }
  .mp-od-welcome-hello {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1.35rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--mp-ink);
    line-height: 1.2;
  }
  .mp-od-welcome-lead {
    margin: 8px 0 0;
    font-size: 0.8rem;
    color: var(--mp-muted);
    font-weight: 500;
    line-height: 1.45;
  }
  .mp-od-welcome-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }
  .mp-od-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 12px;
    background: rgba(255, 255, 255, 0.88);
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
    min-height: 44px;
  }
  .mp-od-chip-k {
    font-size: 0.6rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--mp-subtle);
  }
  .mp-od-chip strong {
    font-size: 0.82rem;
    font-weight: 800;
    color: var(--mp-ink);
  }
  .mp-od-chip-level {
    gap: 10px;
  }
  .mp-od-chip-level > span:first-child {
    width: 28px;
    height: 28px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    background: var(--mp-green-l);
    font-size: 0.9rem;
  }
  .mp-od-chip-level strong {
    display: block;
    font-size: 0.8rem;
    line-height: 1.15;
  }
  .mp-od-chip-level em {
    display: block;
    font-style: normal;
    font-size: 0.65rem;
    color: var(--mp-muted);
    font-weight: 500;
  }
  .mp-od-chip-trust {
    flex-wrap: wrap;
  }
  .mp-od-welcome-side {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .mp-od-welcome-summary {
    background: rgba(255, 255, 255, 0.75);
    border: 1px solid rgba(15, 23, 42, 0.05);
    border-radius: 14px;
    padding: 4px 12px;
  }
  .mp-od-summary-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border-bottom: 1px solid rgba(15, 23, 42, 0.05);
    font-size: 0.78rem;
  }
  .mp-od-summary-row:last-child { border-bottom: none; }
  .mp-od-summary-row span { color: var(--mp-muted); font-weight: 500; }
  .mp-od-summary-row strong { color: var(--mp-ink); font-weight: 800; }
  .mp-od-welcome-cta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .mp-od-welcome-cta .mp-btn-primary,
  .mp-od-welcome-cta .mp-btn-secondary {
    flex: 1 1 auto;
    min-width: 120px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  /* Contact strip */
  .mp-od-contact .mp-od-head { margin-bottom: 12px; padding: 0; }
  .mp-od-contact-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
  }
  .mp-od-contact-item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 12px 14px;
    border-radius: 14px;
    background: #f8faf9;
    border: 1px solid rgba(15, 23, 42, 0.04);
    text-align: left;
    min-width: 0;
  }
  .mp-od-contact-k {
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--mp-subtle);
  }
  .mp-od-contact-item strong {
    font-size: 0.88rem;
    font-weight: 700;
    color: var(--mp-ink);
    word-break: break-word;
  }
  .mp-od-contact-item strong.is-miss { color: var(--mp-amber, #d97706); }
  .mp-od-contact-muted {
    font-weight: 600 !important;
    color: var(--mp-muted) !important;
    font-size: 0.8rem !important;
  }
  .mp-od-contact-shop {
    border: none;
    cursor: pointer;
    width: 100%;
    transition: background 160ms var(--mp-ease), transform 120ms var(--mp-ease), box-shadow 160ms var(--mp-ease);
  }
  .mp-od-contact-shop:hover {
    background: var(--mp-green-mist);
    box-shadow: 0 4px 12px rgba(15, 157, 88, 0.08);
  }
  .mp-od-contact-shop:active { transform: scale(0.99); }
  .mp-od-contact-chev {
    margin-top: 4px;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--mp-green-d);
  }

  /* Stats grid */
  .mp-od-stats-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .mp-od-stat {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 16px;
    border-radius: 20px;
    background: var(--mp-surface);
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.03),
      0 6px 16px rgba(15, 23, 42, 0.04);
    text-align: left;
    color: inherit;
    min-width: 0;
    transition:
      transform 160ms var(--mp-ease),
      box-shadow 160ms var(--mp-ease),
      border-color 160ms var(--mp-ease);
    animation: mp-od-rise 400ms var(--mp-ease) both;
  }
  .mp-od-stats-grid > :nth-child(1) { animation-delay: 0ms; }
  .mp-od-stats-grid > :nth-child(2) { animation-delay: 40ms; }
  .mp-od-stats-grid > :nth-child(3) { animation-delay: 80ms; }
  .mp-od-stats-grid > :nth-child(4) { animation-delay: 120ms; }
  .mp-od-stats-grid > :nth-child(5) { animation-delay: 160ms; }
  .mp-od-stats-grid > :nth-child(6) { animation-delay: 200ms; }
  @keyframes mp-od-rise {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: none; }
  }
  .mp-od-stat.is-clickable {
    border: none;
    cursor: pointer;
    font: inherit;
  }
  .mp-od-stat.is-clickable:hover {
    transform: translateY(-2px);
    box-shadow:
      0 4px 8px rgba(15, 23, 42, 0.04),
      0 12px 28px rgba(15, 157, 88, 0.1);
    border-color: rgba(15, 157, 88, 0.18);
  }
  .mp-od-stat.is-clickable:active { transform: translateY(0) scale(0.99); }
  .mp-od-stat.is-clickable:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
  }
  .mp-od-stat.is-placeholder {
    background: linear-gradient(160deg, #fafbfa, #f3f5f4);
  }
  .mp-od-stat-top {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 8px;
  }
  .mp-od-stat-ic {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: var(--mp-green-l);
    border: 1px solid rgba(15, 157, 88, 0.1);
    font-size: 1rem;
  }
  .mp-od-stat-trend {
    font-size: 0.62rem;
    font-weight: 800;
    padding: 3px 8px;
    border-radius: 999px;
    background: #eef0f0;
    color: var(--mp-subtle);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .mp-od-stat-trend.is-up {
    background: rgba(15, 157, 88, 0.12);
    color: var(--mp-green-d);
  }
  .mp-od-stat-trend.is-down {
    background: rgba(220, 38, 38, 0.1);
    color: #b91c1c;
  }
  .mp-od-stat-value {
    font-family: var(--mp-display);
    font-size: 1.75rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--mp-ink);
    line-height: 1.05;
  }
  .mp-od-stat-label {
    font-size: 0.8rem;
    font-weight: 700;
    color: var(--mp-ink);
  }
  .mp-od-stat-hint {
    font-size: 0.7rem;
    color: var(--mp-faint);
    font-weight: 500;
  }

  /* Quick actions */
  .mp-od-actions-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .mp-od-action {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 20px;
    background: var(--mp-surface);
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
    cursor: pointer;
    text-align: left;
    color: inherit;
    font: inherit;
    transition:
      transform 160ms var(--mp-ease),
      box-shadow 160ms var(--mp-ease),
      border-color 160ms var(--mp-ease),
      background 160ms var(--mp-ease);
  }
  .mp-od-action:hover {
    transform: translateY(-2px);
    border-color: rgba(15, 157, 88, 0.2);
    box-shadow: 0 8px 22px rgba(15, 157, 88, 0.1);
    background: #fbfffc;
  }
  .mp-od-action:active { transform: scale(0.99); }
  .mp-od-action:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
  }
  .mp-od-action-ic {
    width: 42px;
    height: 42px;
    border-radius: 14px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    font-size: 1.15rem;
    background: #f3f5f4;
    border: 1px solid rgba(15, 23, 42, 0.05);
    transition: transform 160ms var(--mp-ease);
  }
  .mp-od-action:hover .mp-od-action-ic { transform: scale(1.05); }
  .mp-od-action--green .mp-od-action-ic {
    background: linear-gradient(145deg, var(--mp-green), var(--mp-green-d));
    color: #fff;
    border: none;
  }
  .mp-od-action--blue .mp-od-action-ic {
    background: linear-gradient(145deg, var(--mp-blue), var(--mp-blue-d));
    color: #fff;
    border: none;
  }
  .mp-od-action--ok .mp-od-action-ic {
    background: var(--mp-green-l);
    color: var(--mp-green-d);
  }
  .mp-od-action-copy {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mp-od-action-label {
    font-size: 0.9rem;
    font-weight: 750;
    color: var(--mp-ink);
    letter-spacing: -0.01em;
  }
  .mp-od-action-sub {
    font-size: 0.72rem;
    color: var(--mp-faint);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mp-od-action-arrow {
    color: #c5cdd0;
    font-size: 1rem;
    font-weight: 600;
    transition: color 160ms var(--mp-ease), transform 160ms var(--mp-ease);
  }
  .mp-od-action:hover .mp-od-action-arrow {
    color: var(--mp-green);
    transform: translateX(3px);
  }

  /* Insights */
  .mp-od-insights-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .mp-od-insight {
    background: var(--mp-surface);
    border: 1px solid rgba(15, 23, 42, 0.06);
    border-radius: 20px;
    padding: 16px;
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: box-shadow 160ms var(--mp-ease), transform 160ms var(--mp-ease);
  }
  .mp-od-insight:hover {
    box-shadow: 0 8px 22px rgba(15, 23, 42, 0.06);
  }
  .mp-od-insight-label {
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--mp-subtle);
  }
  .mp-od-insight-body { flex: 1; min-width: 0; }
  .mp-od-insight-foot { margin-top: 4px; }
  .mp-od-strength {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .mp-od-ring {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  .mp-od-ring-hole {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #fff;
    display: grid;
    place-items: center;
  }
  .mp-od-ring-hole strong {
    font-family: var(--mp-display);
    font-size: 0.8rem;
    font-weight: 800;
    color: var(--mp-green-d);
  }
  .mp-od-strength-frac {
    font-family: var(--mp-display);
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--mp-ink);
  }
  .mp-od-strength-tip {
    margin: 6px 0 0;
    font-size: 0.72rem;
    color: var(--mp-muted);
    line-height: 1.35;
  }
  .mp-od-kv {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .mp-od-kv li {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid rgba(15, 23, 42, 0.05);
    font-size: 0.8rem;
  }
  .mp-od-kv li:last-child { border-bottom: none; }
  .mp-od-kv span { color: var(--mp-muted); }
  .mp-od-kv strong { color: var(--mp-ink); font-weight: 750; }
  .mp-od-tip p {
    margin: 0 0 10px;
    font-size: 0.82rem;
    color: var(--mp-ink);
    line-height: 1.4;
    font-weight: 500;
  }
  .mp-od-tip-extra {
    list-style: none;
    margin: 12px 0 0;
    padding: 10px 0 0;
    border-top: 1px solid rgba(15, 23, 42, 0.05);
  }
  .mp-od-tip-extra li {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    padding: 6px 0;
    font-size: 0.74rem;
    color: var(--mp-muted);
  }
  .mp-od-mini-act {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .mp-od-mini-act-btn {
    width: 100%;
    display: flex;
    justify-content: space-between;
    gap: 10px;
    border: none;
    background: none;
    padding: 8px 0;
    border-bottom: 1px solid rgba(15, 23, 42, 0.05);
    cursor: pointer;
    text-align: left;
    font: inherit;
  }
  .mp-od-mini-act li:last-child .mp-od-mini-act-btn { border-bottom: none; }
  .mp-od-mini-act-btn span {
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--mp-ink);
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mp-od-mini-act-btn em {
    font-style: normal;
    font-size: 0.68rem;
    color: var(--mp-faint);
    font-weight: 600;
    flex-shrink: 0;
  }
  .mp-od-mini-act-btn:hover span { color: var(--mp-green-d); }
  .mp-od-level {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }
  .mp-od-level strong {
    display: block;
    font-size: 0.95rem;
    font-weight: 800;
  }
  .mp-od-level-bar { margin-bottom: 8px; }
  .mp-od-insight-placeholder .mp-od-placeholder-bars {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    height: 56px;
    margin: 12px 0 8px;
  }
  .mp-od-placeholder-bars span {
    flex: 1;
    border-radius: 6px 6px 2px 2px;
    background: linear-gradient(180deg, rgba(15, 157, 88, 0.35), rgba(15, 157, 88, 0.08));
  }
  .mp-od-soon {
    font-style: normal;
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--mp-subtle);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Timeline */
  .mp-od-activity-panel { padding: 8px 12px 12px; }
  .mp-od-timeline {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .mp-od-tl-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 8px;
    border-bottom: 1px solid rgba(15, 23, 42, 0.05);
  }
  .mp-od-tl-item:last-child { border-bottom: none; }
  .mp-od-tl-dot {
    width: 32px;
    height: 32px;
    border-radius: 10px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    font-size: 0.85rem;
    background: #f3f5f4;
    border: 1px solid rgba(15, 23, 42, 0.05);
  }
  .mp-od-tl-item--sold .mp-od-tl-dot {
    background: rgba(15, 157, 88, 0.12);
    color: var(--mp-green-d);
  }
  .mp-od-tl-item--feat .mp-od-tl-dot {
    background: rgba(249, 171, 0, 0.18);
  }
  .mp-od-tl-item--ok .mp-od-tl-dot {
    background: rgba(15, 157, 88, 0.14);
  }
  .mp-od-tl-item--warn .mp-od-tl-dot {
    background: rgba(249, 171, 0, 0.2);
  }
  .mp-od-tl-btn,
  .mp-od-tl-static {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
    border: none;
    background: none;
    padding: 0;
    font: inherit;
    color: inherit;
  }
  .mp-od-tl-btn { cursor: pointer; }
  .mp-od-tl-btn:hover .mp-od-tl-text { color: var(--mp-green-d); }
  .mp-od-tl-btn:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
    border-radius: 6px;
  }
  .mp-od-tl-text {
    font-size: 0.86rem;
    font-weight: 650;
    color: var(--mp-ink);
    line-height: 1.35;
  }
  .mp-od-tl-time {
    font-size: 0.7rem;
    color: var(--mp-faint);
    font-weight: 500;
  }

  /* Empty */
  .mp-od-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
    padding: 28px 16px;
  }
  .mp-od-empty-ic { font-size: 1.75rem; line-height: 1; }
  .mp-od-empty-title {
    margin: 0;
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--mp-ink);
  }
  .mp-od-empty-text {
    margin: 0 0 8px;
    font-size: 0.8rem;
    color: var(--mp-muted);
    max-width: 320px;
    line-height: 1.45;
  }

  /* Skeletons */
  .mp-loading-shell {
    width: 100%;
    max-width: 1100px;
    margin: 0 auto;
    padding: 16px;
  }
  .mp-od-skel {
    background: linear-gradient(90deg, #eef1ef 0%, #f7f8f7 45%, #eef1ef 100%);
    background-size: 200% 100%;
    animation: mp-od-shimmer 1.2s ease-in-out infinite;
    border-radius: 16px;
  }
  @keyframes mp-od-shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }
  .mp-od-skel-topbar { height: 56px; margin-bottom: 12px; border-radius: 12px; }
  .mp-od-skel-hero { height: 160px; margin-bottom: 16px; border-radius: 20px; }
  .mp-odash-skel { gap: 12px; margin: 0; }
  .mp-od-skel-welcome { height: 140px; border-radius: 20px; }
  .mp-od-skel-grid {
    display: grid;
    gap: 12px;
  }
  .mp-od-skel-stats { grid-template-columns: repeat(2, 1fr); }
  .mp-od-skel-actions { grid-template-columns: 1fr; }
  .mp-od-skel-insights { grid-template-columns: 1fr; }
  .mp-od-skel-card { height: 96px; border-radius: 20px; }
  .mp-od-skel-tall { height: 140px; }
  .mp-od-skel-timeline { height: 200px; border-radius: 20px; }
  .mp-od-skel-inline {
    display: inline-block;
    width: 72px;
    height: 22px;
    border-radius: 8px;
    vertical-align: middle;
  }

  @media (min-width: 480px) {
    .mp-od-contact-grid { grid-template-columns: 1fr 1fr; }
    .mp-od-actions-grid { grid-template-columns: 1fr 1fr; }
    .mp-od-skel-actions { grid-template-columns: 1fr 1fr; }
  }
  @media (min-width: 768px) {
    .mp-odash { margin-left: 0; margin-right: 0; gap: 20px; }
    .mp-od-welcome {
      grid-template-columns: minmax(0, 1.4fr) minmax(220px, 0.7fr);
      align-items: stretch;
      padding: 24px;
    }
    .mp-od-welcome-hello { font-size: 1.5rem; }
    .mp-od-stats-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .mp-od-actions-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .mp-od-insights-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .mp-od-contact-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .mp-od-skel-stats { grid-template-columns: repeat(3, 1fr); }
    .mp-od-skel-insights { grid-template-columns: 1fr 1fr; }
  }
  @media (min-width: 1100px) {
    .mp-od-stats-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .mp-od-actions-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .mp-od-insights-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .mp-od-stat-value { font-size: 1.9rem; }
  }
  @media (min-width: 1280px) {
    .mp-od-stats-grid { grid-template-columns: repeat(6, minmax(0, 1fr)); }
    .mp-od-actions-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .mp-od-stat-value { font-size: 1.55rem; }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PHASE 7 — Premium Selling / inventory dashboard
      ═══════════════════════════════════════════════════════════════════════ */
  .mp-inv {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 0 var(--mp-pad-r) 16px var(--mp-pad-x);
    animation: mp-fade-in 280ms var(--mp-ease) both;
    position: relative;
    --inv-r: 20px;
  }
  .mp-inv-hero {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 16px 16px 14px;
    border-radius: var(--inv-r);
    background:
      radial-gradient(120% 100% at 0% 0%, rgba(15, 157, 88, 0.12), transparent 55%),
      radial-gradient(80% 80% at 100% 0%, rgba(249, 171, 0, 0.1), transparent 50%),
      linear-gradient(180deg, #ffffff 0%, #f7faf8 100%);
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.03),
      0 12px 32px rgba(15, 23, 42, 0.05);
  }
  .mp-inv-kicker {
    margin: 0 0 4px;
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mp-green-d);
  }
  .mp-inv-hero-title {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1.35rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--mp-ink);
    line-height: 1.2;
  }
  .mp-inv-hero-sub {
    margin: 6px 0 0;
    font-size: 0.82rem;
    color: var(--mp-muted);
    line-height: 1.45;
    max-width: 42ch;
  }
  .mp-inv-kpi-strip {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }
  .mp-inv-kpi {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 10px 12px;
    border-radius: 14px;
    border: 1px solid rgba(15, 23, 42, 0.06);
    background: rgba(255, 255, 255, 0.85);
    cursor: pointer;
    font: inherit;
    color: inherit;
    text-align: left;
    transition: transform 140ms var(--mp-ease), box-shadow 160ms var(--mp-ease), border-color 160ms var(--mp-ease);
  }
  .mp-inv-kpi:hover {
    transform: translateY(-1px);
    border-color: rgba(15, 157, 88, 0.22);
    box-shadow: 0 6px 16px rgba(15, 157, 88, 0.1);
  }
  .mp-inv-kpi:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
  }
  .mp-inv-kpi strong {
    font-family: var(--mp-display);
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--mp-ink);
    letter-spacing: -0.02em;
  }
  .mp-inv-kpi span {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--mp-subtle);
  }
  .mp-inv-view-hint {
    color: var(--mp-faint);
    font-weight: 600;
  }
  .mp-inv-toolbar {
    position: sticky;
    top: calc(var(--mp-topbar-h) + 8px);
    z-index: 25;
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.96);
    backdrop-filter: blur(16px) saturate(1.15);
    -webkit-backdrop-filter: blur(16px) saturate(1.15);
    border: 1px solid rgba(15, 23, 42, 0.07);
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.04),
      0 12px 32px rgba(15, 23, 42, 0.07);
  }
  .mp-inv-search {
    position: relative;
    display: flex;
    align-items: center;
    width: 100%;
  }
  .mp-inv-search-ic {
    position: absolute;
    left: 12px;
    color: var(--mp-subtle);
    display: grid;
    place-items: center;
    pointer-events: none;
  }
  .mp-inv-search-input {
    width: 100%;
    border: 1.5px solid rgba(15, 23, 42, 0.08);
    background: #f7f9f8;
    border-radius: 12px;
    padding: 10px 36px 10px 36px;
    font-size: 0.84rem;
    font-weight: 500;
    color: var(--mp-ink);
    outline: none;
    transition: border-color 160ms var(--mp-ease), box-shadow 160ms var(--mp-ease), background 160ms var(--mp-ease);
  }
  .mp-inv-search-input:focus {
    border-color: rgba(15, 157, 88, 0.45);
    background: #fff;
    box-shadow: 0 0 0 3px rgba(15, 157, 88, 0.12);
  }
  .mp-inv-search-clear {
    position: absolute;
    right: 8px;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 50%;
    background: rgba(15, 23, 42, 0.06);
    color: var(--mp-muted);
    font-size: 0.65rem;
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .mp-inv-filters {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .mp-inv-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .mp-inv-field-label {
    font-size: 0.6rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mp-subtle);
    padding-left: 2px;
  }
  .mp-inv-select {
    width: 100%;
    border: 1.5px solid rgba(15, 23, 42, 0.08);
    background: #fff;
    border-radius: 10px;
    padding: 8px 10px;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--mp-ink);
    cursor: pointer;
    outline: none;
  }
  .mp-inv-select:focus {
    border-color: rgba(15, 157, 88, 0.4);
    box-shadow: 0 0 0 3px rgba(15, 157, 88, 0.1);
  }
  .mp-inv-view-toggle {
    grid-column: 1 / -1;
    display: inline-flex;
    align-self: end;
    justify-self: stretch;
    background: #f1f3f2;
    border-radius: 12px;
    padding: 3px;
    gap: 2px;
  }
  .mp-inv-view-btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border: none;
    background: transparent;
    border-radius: 10px;
    padding: 8px 10px;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--mp-muted);
    cursor: pointer;
    transition: background 140ms var(--mp-ease), color 140ms var(--mp-ease), box-shadow 140ms var(--mp-ease);
  }
  .mp-inv-view-btn.is-active {
    background: #fff;
    color: var(--mp-green-d);
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
  }
  .mp-inv-view-btn:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 1px;
  }

  .mp-inv-actions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .mp-inv-action {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 12px;
    border-radius: 16px;
    border: 1px solid rgba(15, 23, 42, 0.06);
    background: var(--mp-surface);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
    cursor: pointer;
    text-align: left;
    color: inherit;
    font: inherit;
    transition: transform 140ms var(--mp-ease), box-shadow 160ms var(--mp-ease), border-color 160ms var(--mp-ease);
  }
  .mp-inv-action:hover {
    transform: translateY(-2px);
    border-color: rgba(15, 157, 88, 0.2);
    box-shadow: 0 8px 20px rgba(15, 157, 88, 0.1);
  }
  .mp-inv-action:active { transform: scale(0.99); }
  .mp-inv-action:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
  }
  .mp-inv-action-ic {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    background: var(--mp-green-l);
    font-size: 1rem;
    border: 1px solid rgba(15, 157, 88, 0.12);
    color: var(--mp-green-d);
  }
  .mp-inv-action--amber .mp-inv-action-ic {
    background: #fff8e8;
    border-color: rgba(249, 171, 0, 0.25);
    color: #b45309;
  }
  .mp-inv-action--blue .mp-inv-action-ic {
    background: #eef4ff;
    border-color: rgba(26, 115, 232, 0.18);
    color: #1557b0;
  }
  .mp-inv-action--slate .mp-inv-action-ic {
    background: #f1f3f4;
    border-color: rgba(15, 23, 42, 0.08);
    color: #475569;
  }
  .mp-inv-action--amber:hover {
    border-color: rgba(249, 171, 0, 0.35);
    box-shadow: 0 10px 24px rgba(249, 171, 0, 0.12);
  }
  .mp-inv-action--blue:hover {
    border-color: rgba(26, 115, 232, 0.28);
    box-shadow: 0 10px 24px rgba(26, 115, 232, 0.1);
  }
  .mp-inv-action-copy {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
    flex: 1;
  }
  .mp-inv-action-label {
    font-size: 0.8rem;
    font-weight: 750;
    color: var(--mp-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mp-inv-action-sub {
    font-size: 0.65rem;
    color: var(--mp-faint);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mp-inv-action-chev {
    flex-shrink: 0;
    font-size: 0.85rem;
    font-weight: 700;
    color: var(--mp-subtle);
    opacity: 0.55;
    transition: transform 140ms var(--mp-ease), opacity 140ms var(--mp-ease);
  }
  .mp-inv-action:hover .mp-inv-action-chev {
    transform: translateX(2px);
    opacity: 1;
    color: var(--mp-green-d);
  }

  .mp-inv-meta {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 0 4px;
  }
  .mp-inv-heading {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1.05rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--mp-ink);
  }
  .mp-inv-count {
    margin: 4px 0 0;
    font-size: 0.78rem;
    color: var(--mp-muted);
    font-weight: 500;
  }
  .mp-inv-meta-right {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .mp-inv-select-toggle,
  .mp-inv-select-all {
    border: 1.5px solid rgba(15, 23, 42, 0.1);
    background: #fff;
    border-radius: 999px;
    padding: 7px 12px;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--mp-muted);
    cursor: pointer;
    transition: background 140ms var(--mp-ease), border-color 140ms var(--mp-ease), color 140ms var(--mp-ease);
  }
  .mp-inv-select-toggle.is-on {
    background: rgba(15, 157, 88, 0.1);
    border-color: rgba(15, 157, 88, 0.28);
    color: var(--mp-green-d);
  }
  .mp-inv-select-toggle:hover,
  .mp-inv-select-all:hover {
    border-color: rgba(15, 157, 88, 0.25);
    color: var(--mp-green-d);
  }

  .mp-inv-grid {
    display: grid;
    gap: 12px;
    transition: opacity 220ms var(--mp-ease), transform 220ms var(--mp-ease);
    animation: mp-inv-view-in 280ms var(--mp-ease) both;
  }
  @keyframes mp-inv-view-in {
    from { opacity: 0.55; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }
  .mp-inv-skel-card {
    border-radius: 20px;
    border: 1px solid rgba(15, 23, 42, 0.05);
    background: var(--mp-surface);
    overflow: hidden;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
  }
  .mp-inv-skel-thumb {
    aspect-ratio: 4 / 3;
    background: linear-gradient(90deg, #eef1ef 25%, #f6f8f7 50%, #eef1ef 75%);
    background-size: 200% 100%;
    animation: mp-inv-shimmer 1.2s ease-in-out infinite;
  }
  .mp-inv-skel-lines {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px;
  }
  .mp-inv-skel-lines span {
    display: block;
    height: 10px;
    border-radius: 6px;
    background: linear-gradient(90deg, #eef1ef 25%, #f6f8f7 50%, #eef1ef 75%);
    background-size: 200% 100%;
    animation: mp-inv-shimmer 1.2s ease-in-out infinite;
  }
  .mp-inv-skel-lines span:nth-child(1) { width: 72%; height: 12px; }
  .mp-inv-skel-lines span:nth-child(2) { width: 40%; }
  .mp-inv-skel-lines span:nth-child(3) { width: 55%; }
  @keyframes mp-inv-shimmer {
    0% { background-position: 100% 0; }
    100% { background-position: -100% 0; }
  }
  .mp-inv-grid--list .mp-inv-skel-card { display: flex; flex-direction: row; }
  .mp-inv-grid--list .mp-inv-skel-thumb { width: 132px; min-width: 132px; aspect-ratio: 1; }
  .mp-inv-grid--list .mp-inv-skel-lines { flex: 1; justify-content: center; }
  .mp-inv-meta-loc {
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }
  .mp-inv-stat-chip {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 7px;
    border-radius: 999px;
    background: #f3f5f4;
    color: var(--mp-muted);
  }
  .mp-inv-grid--grid {
    grid-template-columns: 1fr;
  }
  .mp-inv-grid--list {
    grid-template-columns: 1fr;
  }

  .mp-inv-card {
    position: relative;
    display: flex;
    flex-direction: column;
    background: var(--mp-surface);
    border: 1px solid rgba(15, 23, 42, 0.06);
    border-radius: 20px;
    overflow: hidden;
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.03),
      0 8px 22px rgba(15, 23, 42, 0.05);
    transition:
      transform 160ms var(--mp-ease),
      box-shadow 160ms var(--mp-ease),
      border-color 160ms var(--mp-ease);
    animation: mp-od-rise 360ms var(--mp-ease) both;
    content-visibility: auto;
    contain-intrinsic-size: 320px;
  }
  .mp-inv-card:hover {
    transform: translateY(-3px);
    box-shadow:
      0 4px 10px rgba(15, 23, 42, 0.05),
      0 16px 36px rgba(15, 157, 88, 0.12);
    border-color: rgba(15, 157, 88, 0.16);
  }
  .mp-inv-card.is-feat {
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.03),
      0 8px 22px rgba(245, 158, 11, 0.08);
  }
  .mp-inv-card.is-selected {
    border-color: rgba(15, 157, 88, 0.4);
    box-shadow: 0 0 0 2px rgba(15, 157, 88, 0.15);
  }
  .mp-inv-card.is-sold { opacity: 0.96; }
  .mp-inv-grid--list .mp-inv-card {
    flex-direction: row;
    align-items: stretch;
  }

  .mp-inv-check {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 4;
    cursor: pointer;
  }
  .mp-inv-check input {
    position: absolute;
    opacity: 0;
    width: 0;
    height: 0;
  }
  .mp-inv-check-box {
    width: 22px;
    height: 22px;
    border-radius: 7px;
    border: 2px solid rgba(255, 255, 255, 0.9);
    background: rgba(15, 23, 42, 0.25);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    display: block;
    transition: background 120ms var(--mp-ease), border-color 120ms var(--mp-ease);
  }
  .mp-inv-check input:checked + .mp-inv-check-box {
    background: var(--mp-green);
    border-color: var(--mp-green);
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='none' stroke='white' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='3.5 8.5 6.5 11.5 12.5 4.5'/%3E%3C/svg%3E");
    background-size: 14px;
    background-repeat: no-repeat;
    background-position: center;
  }
  .mp-inv-check input:focus-visible + .mp-inv-check-box {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
  }

  .mp-inv-thumb {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    border: none;
    padding: 0;
    margin: 0;
    background: #eef1ef;
    cursor: pointer;
    overflow: hidden;
  }
  .mp-inv-grid--list .mp-inv-thumb {
    width: 132px;
    min-width: 132px;
    aspect-ratio: 1;
    flex-shrink: 0;
  }
  .mp-inv-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    transition: transform 280ms var(--mp-ease);
  }
  .mp-inv-card:hover .mp-inv-thumb img { transform: scale(1.04); }
  .mp-inv-thumb-ph {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    font-size: 2rem;
    color: var(--mp-subtle);
    background: linear-gradient(145deg, #eef2ef, #e4e9e6);
  }
  .mp-inv-badge {
    position: absolute;
    top: 10px;
    right: 10px;
    z-index: 2;
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 4px 8px;
    border-radius: 999px;
    color: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
  }
  .mp-inv-badge-feat {
    background: linear-gradient(135deg, #f59e0b, #d97706);
  }
  .mp-inv-badge-sold {
    background: linear-gradient(135deg, #64748b, #475569);
  }
  .mp-inv-badge-live {
    background: linear-gradient(135deg, var(--mp-green), var(--mp-green-d));
  }

  .mp-inv-card-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px 14px 14px;
    min-width: 0;
    flex: 1;
  }
  .mp-inv-grid--list .mp-inv-card-body {
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
  }
  .mp-inv-card-main {
    border: none;
    background: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font: inherit;
    color: inherit;
  }
  .mp-inv-card-main:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
    border-radius: 8px;
  }
  .mp-inv-card-title {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 750;
    color: var(--mp-ink);
    letter-spacing: -0.01em;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .mp-inv-card-price {
    font-family: var(--mp-display);
    font-size: 1.05rem;
    font-weight: 800;
    color: var(--mp-green-d);
    letter-spacing: -0.02em;
  }
  .mp-inv-card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 0.72rem;
    color: var(--mp-muted);
    font-weight: 500;
  }
  .mp-inv-card-stats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 2px;
    font-size: 0.68rem;
    color: var(--mp-faint);
    font-weight: 600;
  }
  .mp-inv-cat {
    background: #f1f3f2;
    color: var(--mp-muted);
    border-radius: 999px;
    padding: 2px 8px;
  }

  .mp-inv-card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .mp-inv-grid--list .mp-inv-card-actions {
    flex-shrink: 0;
  }
  .mp-inv-icon-btn {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1.5px solid rgba(15, 23, 42, 0.08);
    background: #fff;
    color: var(--mp-muted);
    display: grid;
    place-items: center;
    cursor: pointer;
    transition:
      background 140ms var(--mp-ease),
      border-color 140ms var(--mp-ease),
      color 140ms var(--mp-ease),
      transform 100ms var(--mp-ease);
  }
  .mp-inv-icon-btn:hover:not(:disabled) {
    background: var(--mp-green-mist);
    border-color: rgba(15, 157, 88, 0.22);
    color: var(--mp-green-d);
  }
  .mp-inv-icon-btn:active:not(:disabled) { transform: scale(0.94); }
  .mp-inv-icon-btn:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 1px;
  }
  .mp-inv-icon-btn.is-green {
    color: var(--mp-green-d);
    border-color: rgba(15, 157, 88, 0.22);
    background: rgba(15, 157, 88, 0.06);
  }
  .mp-inv-icon-btn.is-danger:hover:not(:disabled) {
    background: #fff5f4;
    border-color: #f5c6c2;
    color: var(--mp-red);
  }
  .mp-inv-icon-btn.is-boost:disabled,
  .mp-inv-icon-btn:disabled {
    opacity: 0.42;
    cursor: not-allowed;
    background: #f5f6f6;
  }

  .mp-inv-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    padding: 40px 20px;
    border-radius: 20px;
    background: var(--mp-surface);
    border: 1px dashed rgba(15, 157, 88, 0.22);
    box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04);
  }
  .mp-inv-empty-art {
    position: relative;
    width: 88px;
    height: 88px;
    display: grid;
    place-items: center;
    margin-bottom: 4px;
  }
  .mp-inv-empty-blob {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle at 40% 40%, rgba(15, 157, 88, 0.18), rgba(249, 171, 0, 0.12) 55%, transparent 70%);
  }
  .mp-inv-empty-emoji { font-size: 2.4rem; position: relative; z-index: 1; }
  .mp-inv-empty h3 {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--mp-ink);
  }
  .mp-inv-empty p {
    margin: 0;
    max-width: 360px;
    font-size: 0.85rem;
    color: var(--mp-muted);
    line-height: 1.45;
  }
  .mp-inv-empty-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 8px;
  }

  .mp-inv-bulk {
    position: sticky;
    bottom: calc(var(--mp-pnav-mob-h, 56px) + var(--mp-app-nav-h, 62px) + env(safe-area-inset-bottom, 0px) + 8px);
    z-index: 30;
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 16px;
    background: rgba(15, 23, 42, 0.94);
    color: #fff;
    box-shadow: 0 10px 32px rgba(15, 23, 42, 0.28);
    backdrop-filter: blur(10px);
  }
  .mp-inv-bulk-count {
    font-size: 0.8rem;
    font-weight: 700;
  }
  .mp-inv-bulk-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .mp-inv-bulk-btn {
    border: 1px solid rgba(255, 255, 255, 0.18);
    background: rgba(255, 255, 255, 0.08);
    color: rgba(255, 255, 255, 0.55);
    border-radius: 999px;
    padding: 7px 12px;
    font-size: 0.72rem;
    font-weight: 700;
    cursor: not-allowed;
  }
  .mp-inv-bulk-btn.is-live {
    cursor: pointer;
    color: #fff;
    background: rgba(255, 255, 255, 0.12);
    border-color: rgba(255, 255, 255, 0.28);
    transition: background 140ms var(--mp-ease), transform 100ms var(--mp-ease);
  }
  .mp-inv-bulk-btn.is-live:hover {
    background: rgba(15, 157, 88, 0.55);
    border-color: rgba(15, 157, 88, 0.7);
  }
  .mp-inv-bulk-btn.is-live:active { transform: scale(0.97); }
  .mp-inv-bulk-btn.is-danger {
    border-color: rgba(248, 113, 113, 0.35);
    color: rgba(252, 165, 165, 0.7);
  }
  .mp-inv-bulk-btn.is-live.is-danger {
    color: #fecaca;
    border-color: rgba(248, 113, 113, 0.5);
  }
  .mp-inv-bulk-btn.is-live.is-danger:hover {
    background: rgba(220, 38, 38, 0.45);
    border-color: rgba(248, 113, 113, 0.75);
    color: #fff;
  }
  .mp-inv-bulk-note {
    margin: 0;
    font-size: 0.68rem;
    color: rgba(255, 255, 255, 0.55);
    line-height: 1.35;
  }
  .mp-inv-toast {
    position: fixed;
    left: 50%;
    bottom: calc(var(--mp-app-nav-h, 62px) + env(safe-area-inset-bottom, 0px) + 20px);
    transform: translateX(-50%);
    z-index: 50;
  }

  @media (min-width: 480px) {
    .mp-inv-actions { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .mp-inv-grid--grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .mp-inv-hero {
      flex-direction: row;
      align-items: flex-end;
      justify-content: space-between;
      gap: 16px;
    }
    .mp-inv-kpi-strip { min-width: 280px; max-width: 360px; }
  }
  @media (min-width: 768px) {
    .mp-inv { margin-left: 0; margin-right: 0; gap: 18px; }
    .mp-inv-toolbar {
      top: calc(var(--mp-topbar-h) + 12px);
      flex-direction: row;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 10px 12px;
      padding: 14px;
    }
    .mp-inv-search { flex: 1 1 220px; min-width: 180px; }
    .mp-inv-filters {
      flex: 1 1 auto;
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 8px;
      grid-template-columns: none;
    }
    .mp-inv-field { min-width: 120px; }
    .mp-inv-view-toggle {
      grid-column: auto;
      flex: 0 0 auto;
      justify-self: auto;
      width: auto;
    }
    .mp-inv-view-txt { display: inline; }
    .mp-inv-grid--grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
    .mp-inv-bulk {
      bottom: 24px;
      flex-direction: row;
      align-items: center;
      flex-wrap: wrap;
    }
    .mp-inv-bulk-note { flex: 1 1 100%; }
  }
  @media (min-width: 1100px) {
    .mp-inv-grid--grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .mp-inv-grid--list .mp-inv-thumb {
      width: 148px;
      min-width: 148px;
    }
  }
  @media (min-width: 1280px) {
    .mp-inv-grid--grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  @media (max-width: 380px) {
    .mp-inv-view-txt { display: none; }
    .mp-inv-kpi-strip { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .mp-inv-grid--list .mp-inv-thumb {
      width: 100px;
      min-width: 100px;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PHASE 8 — Premium Sold / completed-sales dashboard
     ═══════════════════════════════════════════════════════════════════════ */
  .mp-sold {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 0 var(--mp-pad-r) 16px var(--mp-pad-x);
    animation: mp-fade-in 280ms var(--mp-ease) both;
  }
  .mp-sold-kpis {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .mp-sold-kpi {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 14px;
    border-radius: 20px;
    background:
      linear-gradient(155deg, rgba(232, 245, 238, 0.95) 0%, #fff 55%);
    border: 1px solid rgba(15, 157, 88, 0.14);
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.03),
      0 8px 20px rgba(15, 157, 88, 0.06);
    min-width: 0;
    transition: transform 160ms var(--mp-ease), box-shadow 160ms var(--mp-ease);
  }
  .mp-sold-kpi:hover {
    transform: translateY(-1px);
    box-shadow: 0 10px 24px rgba(15, 157, 88, 0.1);
  }
  .mp-sold-kpi.is-placeholder {
    background: linear-gradient(155deg, #f7f9f8 0%, #fff 60%);
    border-color: rgba(15, 23, 42, 0.06);
  }
  .mp-sold-kpi-ic {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: rgba(15, 157, 88, 0.12);
    font-size: 1rem;
    flex-shrink: 0;
  }
  .mp-sold-kpi-label {
    display: block;
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mp-subtle);
    margin-bottom: 2px;
  }
  .mp-sold-kpi-value {
    display: block;
    font-family: var(--mp-display);
    font-size: 1.35rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--mp-green-d);
    line-height: 1.1;
  }
  .mp-sold-kpi-hint {
    display: block;
    margin-top: 2px;
    font-style: normal;
    font-size: 0.65rem;
    color: var(--mp-faint);
    font-weight: 500;
  }
  .mp-sold-toolbar {
    border-color: rgba(15, 157, 88, 0.12);
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.03),
      0 10px 28px rgba(15, 157, 88, 0.07);
  }
  .mp-sold-toolbar .mp-inv-view-btn.is-active {
    color: var(--mp-green-d);
  }
  .mp-sold-meta {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
    padding: 0 4px;
  }
  .mp-sold-heading {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1.08rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--mp-ink);
  }
  .mp-sold-count {
    margin: 4px 0 0;
    font-size: 0.78rem;
    color: var(--mp-muted);
    font-weight: 500;
  }
  .mp-sold-meta-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .mp-sold-grid {
    display: grid;
    gap: 12px;
  }
  .mp-sold-grid--grid { grid-template-columns: 1fr; }
  .mp-sold-grid--list { grid-template-columns: 1fr; }

  .mp-sold-card {
    display: flex;
    flex-direction: column;
    background: var(--mp-surface);
    border: 1px solid rgba(15, 157, 88, 0.1);
    border-radius: 20px;
    overflow: hidden;
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.03),
      0 8px 22px rgba(15, 157, 88, 0.06);
    transition:
      transform 160ms var(--mp-ease),
      box-shadow 160ms var(--mp-ease),
      border-color 160ms var(--mp-ease);
    animation: mp-od-rise 360ms var(--mp-ease) both;
  }
  .mp-sold-card:hover {
    transform: translateY(-2px);
    border-color: rgba(15, 157, 88, 0.22);
    box-shadow:
      0 6px 14px rgba(15, 23, 42, 0.05),
      0 14px 32px rgba(15, 157, 88, 0.12);
  }
  .mp-sold-grid--list .mp-sold-card {
    flex-direction: row;
    align-items: stretch;
  }

  .mp-sold-thumb {
    position: relative;
    display: block;
    width: 100%;
    aspect-ratio: 4 / 3;
    border: none;
    padding: 0;
    margin: 0;
    background: #e8f5ee;
    cursor: pointer;
    overflow: hidden;
  }
  .mp-sold-grid--list .mp-sold-thumb {
    width: 132px;
    min-width: 132px;
    aspect-ratio: 1;
    flex-shrink: 0;
  }
  .mp-sold-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
    filter: saturate(0.92);
    transition: transform 280ms var(--mp-ease), filter 280ms var(--mp-ease);
  }
  .mp-sold-card:hover .mp-sold-thumb img {
    transform: scale(1.04);
    filter: saturate(1);
  }
  .mp-sold-thumb-ph {
    width: 100%;
    height: 100%;
    display: grid;
    place-items: center;
    font-size: 2rem;
    background: linear-gradient(145deg, #e8f5ee, #dceee4);
  }
  .mp-sold-badge {
    position: absolute;
    top: 10px;
    left: 10px;
    z-index: 2;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 5px 10px;
    border-radius: 999px;
    color: #fff;
    background: linear-gradient(135deg, var(--mp-green), var(--mp-green-d));
    box-shadow: 0 4px 12px rgba(15, 157, 88, 0.35);
  }
  .mp-sold-status-dot {
    position: absolute;
    bottom: 10px;
    right: 10px;
    z-index: 2;
    font-size: 0.6rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 4px 8px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.95);
    color: var(--mp-green-d);
    border: 1px solid rgba(15, 157, 88, 0.2);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
  }

  .mp-sold-card-body {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 14px;
    min-width: 0;
    flex: 1;
  }
  .mp-sold-grid--list .mp-sold-card-body {
    flex-direction: row;
    align-items: center;
    gap: 12px;
  }
  .mp-sold-card-main {
    border: none;
    background: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
    font: inherit;
    color: inherit;
  }
  .mp-sold-card-main:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
    border-radius: 8px;
  }
  .mp-sold-card-title {
    margin: 0;
    font-size: 0.92rem;
    font-weight: 750;
    color: var(--mp-ink);
    letter-spacing: -0.01em;
    line-height: 1.3;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .mp-sold-card-price {
    font-family: var(--mp-display);
    font-size: 1.08rem;
    font-weight: 800;
    color: var(--mp-green-d);
    letter-spacing: -0.02em;
  }
  .mp-sold-card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    font-size: 0.72rem;
    color: var(--mp-muted);
    font-weight: 500;
  }
  .mp-sold-cat {
    align-self: flex-start;
    margin-top: 4px;
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--mp-green-d);
    background: rgba(15, 157, 88, 0.1);
    border-radius: 999px;
    padding: 3px 8px;
  }

  .mp-sold-card-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .mp-sold-grid--list .mp-sold-card-actions { flex-shrink: 0; }
  .mp-sold-icon-btn {
    min-width: 36px;
    height: 36px;
    padding: 0 8px;
    border-radius: 10px;
    border: 1.5px solid rgba(15, 23, 42, 0.08);
    background: #fff;
    color: var(--mp-muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    cursor: pointer;
    font-size: 0.68rem;
    font-weight: 700;
    transition:
      background 140ms var(--mp-ease),
      border-color 140ms var(--mp-ease),
      color 140ms var(--mp-ease),
      transform 100ms var(--mp-ease);
  }
  .mp-sold-icon-btn:hover:not(:disabled) {
    background: var(--mp-green-mist);
    border-color: rgba(15, 157, 88, 0.22);
    color: var(--mp-green-d);
  }
  .mp-sold-icon-btn:active:not(:disabled) { transform: scale(0.95); }
  .mp-sold-icon-btn:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 1px;
  }
  .mp-sold-icon-btn.is-primary {
    background: linear-gradient(135deg, var(--mp-green), var(--mp-green-d));
    border-color: transparent;
    color: #fff;
    box-shadow: 0 4px 12px rgba(15, 157, 88, 0.28);
  }
  .mp-sold-icon-btn.is-primary:hover:not(:disabled) {
    filter: brightness(1.05);
    color: #fff;
    background: linear-gradient(135deg, var(--mp-green), var(--mp-green-d));
  }
  .mp-sold-icon-btn.is-danger:hover:not(:disabled) {
    background: #fff5f4;
    border-color: #f5c6c2;
    color: var(--mp-red);
  }
  .mp-sold-icon-btn.is-future:disabled,
  .mp-sold-icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
    background: #f5f6f6;
  }
  .mp-sold-icon-txt {
    display: none;
  }
  .mp-sold-action-divider {
    width: 1px;
    height: 22px;
    background: rgba(15, 23, 42, 0.08);
    margin: 0 2px;
  }

  .mp-sold-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    padding: 44px 20px;
    border-radius: 20px;
    background:
      linear-gradient(165deg, rgba(232, 245, 238, 0.55) 0%, #fff 50%);
    border: 1px dashed rgba(15, 157, 88, 0.28);
    box-shadow: 0 4px 18px rgba(15, 157, 88, 0.06);
  }
  .mp-sold-empty-art {
    position: relative;
    width: 96px;
    height: 96px;
    display: grid;
    place-items: center;
  }
  .mp-sold-empty-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    border: 3px solid rgba(15, 157, 88, 0.15);
    background: radial-gradient(circle at 40% 35%, rgba(15, 157, 88, 0.18), transparent 65%);
  }
  .mp-sold-empty-emoji {
    position: relative;
    z-index: 1;
    font-size: 2.5rem;
  }
  .mp-sold-empty h3 {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1.18rem;
    font-weight: 800;
    color: var(--mp-ink);
  }
  .mp-sold-empty p {
    margin: 0;
    max-width: 380px;
    font-size: 0.85rem;
    color: var(--mp-muted);
    line-height: 1.45;
  }
  .mp-sold-empty-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 8px;
  }

  @media (min-width: 480px) {
    .mp-sold-kpis { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    .mp-sold-grid--grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .mp-sold-icon-txt { display: inline; }
  }
  @media (min-width: 768px) {
    .mp-sold { margin-left: 0; margin-right: 0; gap: 18px; }
    .mp-sold-kpi-value { font-size: 1.5rem; }
    .mp-sold-grid--grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
  }
  @media (min-width: 1100px) {
    .mp-sold-grid--grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .mp-sold-grid--list .mp-sold-thumb {
      width: 148px;
      min-width: 148px;
    }
  }
  @media (max-width: 380px) {
    .mp-sold-grid--list .mp-sold-thumb {
      width: 100px;
      min-width: 100px;
    }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PHASE 9 — Premium Trust Center
     ═══════════════════════════════════════════════════════════════════════ */
  .mp-tc {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 0 var(--mp-pad-r) 16px var(--mp-pad-x);
    animation: mp-fade-in 300ms var(--mp-ease) both;
  }
  .mp-tc-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .mp-tc-section-head-row {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    flex-wrap: wrap;
  }
  .mp-tc-section-title {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1.05rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--mp-ink);
  }
  .mp-tc-section-sub {
    margin: 4px 0 0;
    font-size: 0.78rem;
    color: var(--mp-muted);
    font-weight: 500;
    line-height: 1.4;
  }

  /* Hero */
  .mp-tc-hero {
    display: grid;
    grid-template-columns: 1fr;
    gap: 16px;
    padding: 20px;
    border-radius: 20px;
    background:
      linear-gradient(145deg, rgba(232, 245, 238, 0.95) 0%, #fff 48%, #fff 100%);
    border: 1px solid rgba(15, 157, 88, 0.14);
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.04),
      0 12px 32px rgba(15, 157, 88, 0.08);
  }
  .mp-tc-hero-score {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 16px;
    text-align: center;
  }
  .mp-tc-ring {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    box-shadow: 0 8px 24px rgba(15, 157, 88, 0.15);
  }
  .mp-tc-ring-hole {
    width: 92px;
    height: 92px;
    border-radius: 50%;
    background: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0;
  }
  .mp-tc-ring-hole strong {
    font-family: var(--mp-display);
    font-size: 1.75rem;
    font-weight: 800;
    color: var(--mp-green-d);
    letter-spacing: -0.03em;
    line-height: 1;
  }
  .mp-tc-ring-hole span {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mp-subtle);
    margin-top: 4px;
  }
  .mp-tc-skel-ring {
    width: 120px;
    height: 120px;
    border-radius: 50%;
    background: linear-gradient(90deg, #eef1ef 0%, #f7f8f7 45%, #eef1ef 100%);
    background-size: 200% 100%;
    animation: mp-od-shimmer 1.2s ease-in-out infinite;
  }
  .mp-tc-kicker {
    margin: 0 0 6px;
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mp-green-d);
  }
  .mp-tc-hero-title {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1.3rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--mp-ink);
    line-height: 1.2;
  }
  .mp-tc-hero-lead {
    margin: 8px 0 0;
    font-size: 0.82rem;
    color: var(--mp-muted);
    line-height: 1.45;
    max-width: 420px;
  }
  .mp-tc-hero-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
    justify-content: center;
  }
  .mp-tc-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.9);
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
    font-size: 0.75rem;
  }
  .mp-tc-pill strong { font-weight: 750; color: var(--mp-ink); }
  .mp-tc-pill.is-ok {
    background: rgba(15, 157, 88, 0.1);
    border-color: rgba(15, 157, 88, 0.2);
    color: var(--mp-green-d);
  }
  .mp-tc-pill.is-ok strong { color: var(--mp-green-d); }
  .mp-tc-pill.is-warn {
    background: rgba(249, 171, 0, 0.12);
    border-color: rgba(217, 119, 6, 0.2);
  }
  .mp-tc-hero-cta {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: 8px;
    padding: 16px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.75);
    border: 1px solid rgba(15, 23, 42, 0.05);
  }
  .mp-tc-cta-lead {
    margin: 0;
    font-size: 0.88rem;
    font-weight: 750;
    color: var(--mp-ink);
  }
  .mp-tc-cta-hint {
    margin: 0;
    font-size: 0.72rem;
    color: var(--mp-faint);
    line-height: 1.35;
  }
  .mp-tc-verify-btn {
    width: 100%;
    justify-content: center;
    padding: 12px 16px !important;
    font-size: 0.88rem !important;
    border-radius: 12px !important;
  }

  /* Metrics */
  .mp-tc-metrics {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .mp-tc-metric {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 16px;
    border-radius: 20px;
    background: var(--mp-surface);
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
    text-align: left;
    font: inherit;
    color: inherit;
    min-width: 0;
    transition: transform 160ms var(--mp-ease), box-shadow 160ms var(--mp-ease), border-color 160ms var(--mp-ease);
  }
  button.mp-tc-metric { cursor: pointer; }
  .mp-tc-metric:hover {
    transform: translateY(-2px);
    box-shadow: 0 10px 24px rgba(15, 157, 88, 0.1);
    border-color: rgba(15, 157, 88, 0.16);
  }
  .mp-tc-metric:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
  }
  .mp-tc-metric.is-ok { border-color: rgba(15, 157, 88, 0.12); }
  .mp-tc-metric.is-warn { border-color: rgba(217, 119, 6, 0.18); }
  .mp-tc-metric-ic {
    width: 36px;
    height: 36px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: var(--mp-green-l);
    font-size: 1rem;
    margin-bottom: 6px;
  }
  .mp-tc-metric.is-warn .mp-tc-metric-ic {
    background: rgba(249, 171, 0, 0.18);
  }
  .mp-tc-metric-label {
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mp-subtle);
  }
  .mp-tc-metric-value {
    font-family: var(--mp-display);
    font-size: 1.35rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--mp-ink);
    line-height: 1.1;
  }
  .mp-tc-metric.is-ok .mp-tc-metric-value { color: var(--mp-green-d); }
  .mp-tc-metric-desc {
    font-size: 0.72rem;
    color: var(--mp-muted);
    line-height: 1.35;
    margin-bottom: 6px;
  }
  .mp-tc-metric-bar {
    display: block;
    width: 100%;
    height: 6px;
    border-radius: 999px;
    background: #eef0f0;
    overflow: hidden;
    margin-top: 2px;
  }
  .mp-tc-metric-bar i {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--mp-amber), var(--mp-green) 55%, var(--mp-green-d));
    transition: width 320ms var(--mp-ease);
  }

  /* Checklist */
  .mp-tc-check-progress {
    display: flex;
    align-items: baseline;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 12px;
    background: rgba(15, 157, 88, 0.08);
  }
  .mp-tc-check-progress strong {
    font-family: var(--mp-display);
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--mp-green-d);
  }
  .mp-tc-check-progress span {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--mp-muted);
  }
  .mp-tc-check-bar {
    height: 8px;
    border-radius: 999px;
    background: #eef0f0;
    overflow: hidden;
  }
  .mp-tc-check-bar i {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--mp-green), var(--mp-green-d));
    transition: width 320ms var(--mp-ease);
  }
  .mp-tc-checklist {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mp-tc-check-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 16px;
    background: var(--mp-surface);
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
    transition: border-color 160ms var(--mp-ease), box-shadow 160ms var(--mp-ease);
  }
  .mp-tc-check-item.is-done {
    background: rgba(232, 245, 238, 0.55);
    border-color: rgba(15, 157, 88, 0.14);
  }
  .mp-tc-check-item.is-next {
    border-color: rgba(15, 157, 88, 0.35);
    box-shadow: 0 4px 16px rgba(15, 157, 88, 0.1);
  }
  .mp-tc-check-mark {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    font-size: 0.8rem;
    font-weight: 800;
    background: #f1f3f2;
    color: var(--mp-subtle);
  }
  .mp-tc-check-item.is-done .mp-tc-check-mark {
    background: var(--mp-green);
    color: #fff;
  }
  .mp-tc-check-item.is-next .mp-tc-check-mark {
    background: rgba(15, 157, 88, 0.15);
    color: var(--mp-green-d);
  }
  .mp-tc-check-copy {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mp-tc-check-copy strong {
    font-size: 0.86rem;
    font-weight: 700;
    color: var(--mp-ink);
    line-height: 1.3;
  }
  .mp-tc-check-item.is-done .mp-tc-check-copy strong {
    color: var(--mp-green-d);
  }
  .mp-tc-check-note,
  .mp-tc-check-next {
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--mp-faint);
  }
  .mp-tc-check-next { color: var(--mp-green-d); }
  .mp-tc-check-cta {
    flex-shrink: 0;
    border: none;
    background: linear-gradient(135deg, var(--mp-green), var(--mp-green-d));
    color: #fff;
    font-size: 0.72rem;
    font-weight: 700;
    padding: 8px 12px;
    border-radius: 999px;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(15, 157, 88, 0.25);
    white-space: nowrap;
  }
  .mp-tc-check-cta:hover { filter: brightness(1.05); }
  .mp-tc-check-cta:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
  }
  .mp-tc-check-done-label {
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--mp-green-d);
    flex-shrink: 0;
  }

  /* Vouch shell */
  .mp-tc-vouch-card {
    background: var(--mp-surface);
    border: 1px solid rgba(15, 23, 42, 0.06);
    border-radius: 20px;
    padding: 8px 12px 16px;
    box-shadow: 0 2px 12px rgba(15, 23, 42, 0.04);
  }
  .mp-tc-vouch-card .mp-vouch-wrap {
    margin: 0;
    padding: 0;
  }

  /* Achievements */
  .mp-tc-achieve-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .mp-tc-achieve {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 14px;
    border-radius: 20px;
    background: var(--mp-surface);
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
    min-width: 0;
    transition: transform 160ms var(--mp-ease), box-shadow 160ms var(--mp-ease);
  }
  .mp-tc-achieve.is-unlocked:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(15, 157, 88, 0.1);
  }
  .mp-tc-achieve.is-locked {
    filter: grayscale(1);
    opacity: 0.72;
    background: #f7f8f7;
  }
  .mp-tc-achieve.is-unlocked {
    border-color: rgba(15, 157, 88, 0.16);
    background: linear-gradient(160deg, rgba(232, 245, 238, 0.5), #fff 60%);
  }
  .mp-tc-achieve-ic {
    font-size: 1.4rem;
    line-height: 1;
    margin-bottom: 4px;
  }
  .mp-tc-achieve-name {
    font-size: 0.82rem;
    font-weight: 800;
    color: var(--mp-ink);
    letter-spacing: -0.01em;
  }
  .mp-tc-achieve-desc {
    font-size: 0.7rem;
    color: var(--mp-muted);
    line-height: 1.35;
  }
  .mp-tc-achieve-status {
    margin-top: 6px;
    font-style: normal;
    font-size: 0.65rem;
    font-weight: 700;
    color: var(--mp-faint);
    line-height: 1.3;
  }
  .mp-tc-achieve-status.is-on {
    color: var(--mp-green-d);
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  /* Timeline */
  .mp-tc-timeline-card {
    background: var(--mp-surface);
    border: 1px solid rgba(15, 23, 42, 0.06);
    border-radius: 20px;
    padding: 8px 12px;
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
  }
  .mp-tc-timeline {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .mp-tc-tl-item {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 6px;
    border-bottom: 1px solid rgba(15, 23, 42, 0.05);
  }
  .mp-tc-tl-item:last-child { border-bottom: none; }
  .mp-tc-tl-dot {
    width: 34px;
    height: 34px;
    border-radius: 10px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    font-size: 0.9rem;
    background: #f3f5f4;
    border: 1px solid rgba(15, 23, 42, 0.05);
  }
  .mp-tc-tl-item--ok .mp-tc-tl-dot,
  .mp-tc-tl-item--sold .mp-tc-tl-dot {
    background: rgba(15, 157, 88, 0.12);
  }
  .mp-tc-tl-item--vouch .mp-tc-tl-dot {
    background: rgba(26, 115, 232, 0.1);
  }
  .mp-tc-tl-btn,
  .mp-tc-tl-static {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    text-align: left;
    border: none;
    background: none;
    padding: 0;
    font: inherit;
    color: inherit;
  }
  .mp-tc-tl-btn { cursor: pointer; }
  .mp-tc-tl-btn:hover .mp-tc-tl-text { color: var(--mp-green-d); }
  .mp-tc-tl-btn:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
    border-radius: 6px;
  }
  .mp-tc-tl-text {
    font-size: 0.86rem;
    font-weight: 650;
    color: var(--mp-ink);
    line-height: 1.35;
  }
  .mp-tc-tl-time {
    font-size: 0.7rem;
    color: var(--mp-faint);
    font-weight: 500;
  }

  @media (min-width: 480px) {
    .mp-tc-metrics { grid-template-columns: 1fr 1fr; }
    .mp-tc-achieve-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  @media (min-width: 768px) {
    .mp-tc { margin-left: 0; margin-right: 0; gap: 20px; }
    .mp-tc-hero {
      grid-template-columns: minmax(0, 1.45fr) minmax(200px, 0.7fr);
      align-items: stretch;
      padding: 24px;
    }
    .mp-tc-hero-score {
      flex-direction: row;
      text-align: left;
      align-items: center;
    }
    .mp-tc-hero-badges { justify-content: flex-start; }
    .mp-tc-hero-lead { max-width: none; }
    .mp-tc-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .mp-tc-achieve-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
  @media (min-width: 1100px) {
    .mp-tc-metrics { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .mp-tc-achieve-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
  @media (max-width: 380px) {
    .mp-tc-check-item { flex-wrap: wrap; }
    .mp-tc-check-cta { width: 100%; }
    .mp-tc-achieve-grid { grid-template-columns: 1fr 1fr; }
  }

  .mp-hero-id-block {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 8px;
  }
  .mp-hero-avatar .mp-avatar {
    width: 100px;
    height: 100px;
    font-size: 2rem;
    border-width: 4px;
  }
  .mp-hero-avatar .mp-avatar-ring {
    padding: 3px;
    background: linear-gradient(145deg, var(--mp-amber), var(--mp-green) 55%, var(--mp-green-d));
    box-shadow: 0 8px 20px rgba(6, 61, 35, 0.14), 0 0 0 3px #fafbfc;
    transition: transform 160ms var(--mp-ease), box-shadow 160ms var(--mp-ease);
  }
  .mp-hero-avatar:hover .mp-avatar-ring {
    transform: translateY(-2px) scale(1.02);
    box-shadow: 0 12px 26px rgba(6, 61, 35, 0.18), 0 0 0 3px #fafbfc;
  }
  .mp-hero-id {
    width: 100%;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
  }
  .mp-hero-name-row { justify-content: center; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
  .mp-hero-premium .mp-name {
    margin: 0;
    color: var(--mp-ink);
    font-size: clamp(1.15rem, 2.8vw, 1.3rem);
    text-shadow: none;
    line-height: 1.2;
  }
  .mp-hero-premium .mp-name-text { color: var(--mp-ink); }
  .mp-hero-premium .mp-online {
    background: #fff;
    border: 1px solid var(--mp-line);
  }
  .mp-hero-meta-row {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 6px 10px;
  }
  .mp-hero-meta-item {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--mp-muted);
  }
  .mp-hero-meta-ic { font-size: 0.78rem; }

  .mp-hero-level {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 10px;
    padding: 5px 8px 5px 5px;
    color: #fff;
    box-shadow: var(--mp-shadow-xs);
  }
  .mp-hero-level-ic {
    width: 24px; height: 24px; border-radius: 7px;
    display: grid; place-items: center;
    background: rgba(255,255,255,.2); font-size: 0.78rem;
  }
  .mp-hero-level-text { display: flex; flex-direction: column; line-height: 1.1; text-align: left; }
  .mp-hero-level-text strong { font-size: 0.72rem; font-weight: 800; }
  .mp-hero-level-text em {
    font-style: normal; font-size: 0.55rem; opacity: .88; font-weight: 600;
    text-transform: uppercase; letter-spacing: .04em;
  }

  /* Compact premium trust card */
  .mp-trust-card {
    width: 100%;
    padding: 8px 10px;
    border-radius: 12px;
    background: rgba(255,255,255,.8);
    border: 1px solid rgba(15,157,88,.12);
    box-shadow: 0 2px 10px rgba(15,23,42,.03);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    text-align: left;
  }
  .mp-trust-card-top {
    display: flex; justify-content: space-between; align-items: center; gap: 8px;
  }
  .mp-trust-card-label {
    font-size: 0.58rem; font-weight: 800; text-transform: uppercase;
    letter-spacing: .05em; color: var(--mp-subtle);
  }
  .mp-trust-card-foot {
    display: flex; justify-content: space-between; align-items: center;
    gap: 8px; font-size: 0.68rem; color: var(--mp-muted); font-weight: 500;
    margin-top: 6px; padding-top: 6px;
    border-top: 1px solid var(--mp-line-soft);
  }

  /* Stats — larger numbers, glass, under identity hierarchy */
  .mp-hero-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .mp-hero-stat {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    border: 1px solid rgba(15, 157, 88, 0.1);
    background: rgba(255,255,255,.9);
    border-radius: 12px;
    padding: 10px 10px 8px;
    cursor: pointer;
    box-shadow: 0 2px 8px rgba(15,23,42,.04);
    backdrop-filter: blur(8px);
    transition: transform 150ms var(--mp-ease), box-shadow 150ms var(--mp-ease), border-color 150ms var(--mp-ease);
  }
  .mp-hero-stat:hover {
    transform: translateY(-2px);
    border-color: rgba(15,157,88,.28);
    box-shadow: 0 8px 18px rgba(15,157,88,.1);
  }
  .mp-hero-stat-ic { font-size: 0.9rem; opacity: .9; line-height: 1; }
  .mp-hero-stat-n {
    font-family: var(--mp-display);
    font-size: 1.5rem;
    font-weight: 800;
    color: var(--mp-green-d);
    letter-spacing: -0.04em;
    line-height: 1.05;
    animation: mp-stat-pop 420ms var(--mp-ease) both;
  }
  @keyframes mp-stat-pop {
    from { opacity: 0; transform: translateY(3px); }
    to { opacity: 1; transform: none; }
  }
  .mp-hero-stat-l {
    font-size: 0.6rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: .05em; color: var(--mp-faint);
  }

  .mp-hero-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    margin-top: 0;
  }
  .mp-hbtn {
    border: 1.5px solid var(--mp-line-strong);
    background: #fff;
    color: var(--mp-ink);
    border-radius: 999px;
    padding: 8px 14px;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 150ms var(--mp-ease), border-color 150ms var(--mp-ease), box-shadow 150ms var(--mp-ease), transform 120ms var(--mp-ease);
  }
  .mp-hbtn:hover {
    background: var(--mp-green-mist);
    border-color: rgba(15,157,88,.3);
    box-shadow: var(--mp-shadow-xs);
  }
  .mp-hbtn:active { transform: scale(0.98); }
  .mp-hbtn-primary {
    background: linear-gradient(135deg, var(--mp-green), var(--mp-green-d));
    border-color: transparent;
    color: #fff;
    box-shadow: var(--mp-shadow-green);
  }
  .mp-hbtn-primary:hover {
    filter: brightness(1.04);
    box-shadow: 0 6px 16px rgba(15,157,88,.32);
  }
  .mp-hbtn-compact {
    width: 100%;
    margin-top: 8px;
    text-align: center;
    padding: 7px 10px;
    font-size: 0.72rem;
  }
  .mp-hbtn-more.is-open {
    background: var(--mp-green-l);
    border-color: rgba(15,157,88,.35);
  }
  .mp-hero-more { position: relative; }
  .mp-hero-more-menu {
    position: absolute; right: 0; top: calc(100% + 6px);
    min-width: 196px; background: #fff;
    border: 1px solid var(--mp-line); border-radius: 12px;
    box-shadow: var(--mp-shadow-lg); padding: 6px; z-index: 40;
    animation: mp-hero-in 150ms var(--mp-ease) both;
  }
  .mp-hero-more-menu button {
    width: 100%; border: none; background: transparent;
    text-align: left; padding: 9px 11px; border-radius: 8px;
    font-size: 0.78rem; font-weight: 650; color: var(--mp-ink); cursor: pointer;
  }
  .mp-hero-more-menu button:hover {
    background: var(--mp-green-mist); color: var(--mp-green-d);
  }

  .mp-hero-chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 8px;
    padding-top: 0;
  }
  .mp-hchip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid rgba(15,23,42,.08);
    background: rgba(255,255,255,.9);
    border-radius: 999px;
    padding: 7px 12px;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--mp-muted);
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(15,23,42,.03);
    transition: background 150ms var(--mp-ease), border-color 150ms var(--mp-ease), color 150ms var(--mp-ease), transform 120ms var(--mp-ease);
  }
  .mp-hchip:hover {
    background: var(--mp-green-l);
    border-color: rgba(15,157,88,.28);
    color: var(--mp-green-d);
    transform: translateY(-1px);
  }
  .mp-hchip-blue {
    background: var(--mp-blue-l);
    border-color: rgba(26,115,232,.2);
    color: var(--mp-blue);
  }
  .mp-hchip-ok {
    background: var(--mp-green-l);
    border-color: rgba(15,157,88,.2);
    color: var(--mp-green-d);
  }

  .mp-hero-insight-card {
    background: rgba(255,255,255,.92);
    border: 1px solid rgba(15,23,42,.06);
    border-radius: 12px;
    padding: 8px 10px;
    box-shadow: 0 2px 8px rgba(15,23,42,.03);
  }
  .mp-hero-insight-label {
    font-size: 0.58rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .06em;
    color: var(--mp-subtle);
    margin-bottom: 6px;
  }
  .mp-hero-strength {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .mp-hero-ring {
    width: 52px; height: 52px; border-radius: 50%;
    display: grid; place-items: center; flex-shrink: 0;
  }
  .mp-hero-ring-hole {
    width: 38px; height: 38px; border-radius: 50%;
    background: #fafbfc;
    display: grid; place-items: center;
  }
  .mp-hero-ring-hole strong {
    font-family: var(--mp-display);
    font-size: 0.7rem;
    font-weight: 800;
    color: var(--mp-green-d);
  }
  .mp-hero-strength-copy {
    display: flex; flex-direction: column; gap: 1px;
    font-size: 0.68rem; color: var(--mp-muted); font-weight: 500;
  }
  .mp-hero-strength-frac {
    font-family: var(--mp-display);
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--mp-ink);
    letter-spacing: -0.02em;
  }
  .mp-hero-strength-ok {
    margin: 8px 0 0;
    font-size: 0.7rem;
    color: var(--mp-green-d);
    font-weight: 650;
    line-height: 1.35;
  }
  .mp-hero-next {
    width: 100%;
    margin-top: 8px;
    border: 1px solid rgba(26,115,232,.18);
    background: linear-gradient(135deg, #f5f9ff, #e8f0fe);
    border-radius: 10px;
    padding: 8px 10px;
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition: box-shadow 150ms var(--mp-ease), border-color 150ms var(--mp-ease);
  }
  .mp-hero-next:hover {
    border-color: rgba(26,115,232,.35);
    box-shadow: 0 4px 12px rgba(26,115,232,.1);
  }
  .mp-hero-next-k {
    font-size: 0.55rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: .05em;
    color: var(--mp-blue);
  }
  .mp-hero-next strong {
    font-size: 0.72rem;
    font-weight: 700;
    color: #174ea6;
    line-height: 1.3;
  }
  .mp-hero-next em {
    font-style: normal;
    font-size: 0.68rem;
    font-weight: 750;
    color: var(--mp-blue);
  }
  .mp-hero-insight-list {
    list-style: none; margin: 0 0 2px; padding: 0;
  }
  .mp-hero-insight-list li {
    display: flex; justify-content: space-between; gap: 8px;
    padding: 3px 0; font-size: 0.72rem;
    border-bottom: 1px solid var(--mp-line-soft);
  }
  .mp-hero-insight-list li:last-child { border-bottom: none; }
  .mp-hero-insight-list span { color: var(--mp-subtle); }
  .mp-hero-insight-list strong { color: var(--mp-ink); font-weight: 750; }
  .mp-hero-tip p {
    margin: 0 0 6px; font-size: 0.7rem; color: var(--mp-muted); line-height: 1.35;
  }
  .mp-hero-empty {
    margin: 0; font-size: 0.7rem; color: var(--mp-faint);
  }

  /* Modern activity timeline */
  .mp-hero-timeline {
    list-style: none;
    margin: 0;
    padding: 0 0 0 2px;
    position: relative;
  }
  .mp-hero-tl-item {
    display: flex;
    gap: 8px;
    align-items: flex-start;
    position: relative;
    padding: 0 0 8px;
  }
  .mp-hero-tl-item:last-child { padding-bottom: 0; }
  .mp-hero-tl-item:not(:last-child)::before {
    content: '';
    position: absolute;
    left: 7px;
    top: 16px;
    bottom: 0;
    width: 2px;
    background: #e8eee9;
  }
  .mp-hero-tl-dot {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    font-size: 0.55rem;
    font-weight: 800;
    color: #fff;
    background: var(--mp-green);
    box-shadow: 0 0 0 3px #fafbfc;
    z-index: 1;
  }
  .mp-hero-tl-dot.is-sold { background: #e69100; }
  .mp-hero-tl-btn {
    flex: 1;
    min-width: 0;
    border: none;
    background: none;
    padding: 0;
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .mp-hero-tl-text {
    font-size: 0.7rem;
    font-weight: 650;
    color: var(--mp-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mp-hero-tl-time {
    font-size: 0.6rem;
    font-weight: 600;
    color: var(--mp-faint);
  }
  .mp-hero-tl-btn:hover .mp-hero-tl-text { color: var(--mp-green-d); }

  .mp-share-toast {
    margin-top: 8px;
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--mp-green-d);
    background: var(--mp-green-l);
    border-radius: 10px;
    padding: 6px 10px;
  }
  .mp-overview-card .mp-info-panel-flat {
    margin-top: 0; border: none; background: transparent; border-radius: 0;
  }
  .mp-overview-card .mp-info-section { padding: 0; }
  .mp-overview-card .mp-info-section + .mp-info-section {
    border-top: none; padding-top: 8px;
  }

  .mp-qbtn {
    border: 1.5px solid var(--mp-line-strong);
    background: #fff; color: var(--mp-ink);
    border-radius: var(--mp-r-pill);
    padding: 9px 14px; font-size: 0.78rem; font-weight: 700; cursor: pointer;
  }

  /* Legacy qbtn styles if referenced elsewhere */
  .mp-qbtn {
    border: 1.5px solid var(--mp-line-strong);
    background: #fff;
    color: var(--mp-ink);
    border-radius: var(--mp-r-pill);
    padding: 9px 14px;
    font-size: 0.78rem;
    font-weight: 700;
    cursor: pointer;
  }

  /* ── Insights (right rail) ── */
  .mp-col-insights { min-width: 0; }
  .mp-insights {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .mp-insights-head {
    padding: 4px 2px 0;
  }
  .mp-insights-title {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--mp-ink);
  }
  .mp-insights-sub {
    margin: 3px 0 0;
    font-size: 0.75rem;
    color: var(--mp-faint);
    font-weight: 500;
  }
  .mp-insights-card {
    background: var(--mp-surface);
    border: 1px solid rgba(15, 157, 88, 0.1);
    border-radius: var(--mp-r-lg);
    box-shadow: var(--mp-shadow-sm);
    padding: 14px;
  }
  .mp-insights-card-label {
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--mp-subtle);
    margin-bottom: 10px;
  }
  .mp-insights-stats {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .mp-insights-stats li {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid var(--mp-line-soft);
    font-size: 0.8125rem;
  }
  .mp-insights-stats li:last-child { border-bottom: none; }
  .mp-insights-stats span { color: var(--mp-subtle); font-weight: 500; }
  .mp-insights-stats strong {
    font-family: var(--mp-display);
    font-weight: 800;
    color: var(--mp-green-d);
  }
  .mp-insights-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    font-size: 0.8125rem;
    margin-top: 10px;
  }
  .mp-insights-row span { color: var(--mp-subtle); }
  .mp-insights-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 12px;
  }
  .mp-insights-shop {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    border: 1.5px dashed rgba(15, 157, 88, 0.35);
    background: var(--mp-green-mist);
    border-radius: var(--mp-r-md);
    padding: 12px;
    cursor: pointer;
    text-align: left;
  }
  .mp-insights-shop-name {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--mp-green-d);
  }
  .mp-insights-shop-go {
    font-size: 0.75rem;
    font-weight: 800;
    color: var(--mp-green);
  }
  .mp-status-active-compact { margin-top: 0; }
  .mp-insights-empty {
    margin: 0;
    font-size: 0.78rem;
    color: var(--mp-faint);
    line-height: 1.45;
  }
  .mp-insights-more {
    display: inline-block;
    margin-top: 10px;
  }

  /* Seller level */
  .mp-level-card {
    background:
      linear-gradient(165deg, #fff 0%, #f6fbf8 55%, #fffbeb 100%);
  }
  .mp-level-row {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 10px;
  }
  .mp-level-badge {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    font-size: 1.15rem;
    color: #fff;
    flex-shrink: 0;
    box-shadow: var(--mp-shadow-sm);
  }
  .mp-level-badge--t1 { background: linear-gradient(135deg, #9aa0a6, #5f6368); }
  .mp-level-badge--t2 { background: linear-gradient(135deg, #34a853, #0a7a44); }
  .mp-level-badge--t3 { background: linear-gradient(135deg, #f9ab00, #e69100); }
  .mp-level-badge--t4 { background: linear-gradient(135deg, #1a73e8, #0F9D58); }
  .mp-level-copy { min-width: 0; }
  .mp-level-name {
    display: block;
    font-family: var(--mp-display);
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--mp-ink);
    letter-spacing: -0.02em;
  }
  .mp-level-label {
    display: block;
    margin-top: 2px;
    font-size: 0.72rem;
    color: var(--mp-faint);
    font-weight: 500;
  }
  .mp-level-bar { margin-top: 2px; }
  .mp-level-next {
    margin: 10px 0 0;
    font-size: 0.72rem;
    color: var(--mp-muted);
    line-height: 1.4;
  }
  .mp-level-next strong { color: var(--mp-green-d); }

  /* Insight quick actions */
  .mp-insight-qactions {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .mp-iqbtn {
    border: 1px solid var(--mp-line);
    background: #fff;
    border-radius: var(--mp-r-md);
    padding: 10px 10px;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--mp-ink);
    cursor: pointer;
    text-align: center;
    transition:
      background var(--mp-dur) var(--mp-ease),
      border-color var(--mp-dur) var(--mp-ease),
      box-shadow var(--mp-dur) var(--mp-ease);
  }
  .mp-iqbtn:hover {
    background: var(--mp-green-mist);
    border-color: rgba(15, 157, 88, 0.3);
    box-shadow: var(--mp-shadow-xs);
  }

  /* Recent activity */
  .mp-activity-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .mp-activity-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 8px;
    border: none;
    background: transparent;
    padding: 8px 0;
    border-bottom: 1px solid var(--mp-line-soft);
    cursor: pointer;
    text-align: left;
  }
  .mp-activity-list li:last-child .mp-activity-item { border-bottom: none; }
  .mp-activity-item:hover .mp-activity-text { color: var(--mp-green-d); }
  .mp-activity-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--mp-green);
    flex-shrink: 0;
  }
  .mp-activity-dot.is-sold { background: var(--mp-amber); }
  .mp-activity-text {
    flex: 1;
    min-width: 0;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--mp-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mp-activity-time {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--mp-faint);
    flex-shrink: 0;
  }

  /* Tips */
  .mp-tips-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .mp-tip-row {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 10px;
    background: var(--mp-surface-2);
    border: 1px solid var(--mp-line-soft);
    border-radius: var(--mp-r-md);
  }
  .mp-tip-text {
    flex: 1;
    margin: 0;
    font-size: 0.78rem;
    color: var(--mp-muted);
    line-height: 1.4;
    font-weight: 500;
  }
  .mp-tip-cta {
    flex-shrink: 0;
    border: none;
    background: var(--mp-green-l);
    color: var(--mp-green-d);
    font-size: 0.7rem;
    font-weight: 800;
    border-radius: var(--mp-r-pill);
    padding: 6px 10px;
    cursor: pointer;
  }
  .mp-tip-cta:hover { background: #dcf0e4; }

  /* Featured promotion — premium product strip */
  .mp-promo-card {
    border-color: rgba(249, 171, 0, 0.32) !important;
    background:
      linear-gradient(165deg, #fffbeb 0%, #fffdf7 38%, #ffffff 100%) !important;
    overflow: hidden;
  }
  .mp-promo-head {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 12px;
  }
  .mp-promo-head-icon {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: linear-gradient(145deg, #f59e0b, #d4920a 55%, #b45309);
    box-shadow: 0 4px 12px -3px rgba(180, 83, 9, 0.45);
  }
  .mp-promo-head-text { flex: 1; min-width: 0; }
  .mp-promo-label {
    margin: 0 !important;
    letter-spacing: 0.06em;
  }
  .mp-promo-head-sub {
    margin: 2px 0 0;
    font-size: 0.68rem;
    font-weight: 600;
    color: var(--mp-muted);
    line-height: 1.2;
  }
  .mp-promo-count-pill {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 9px;
    border-radius: 999px;
    font-size: 0.72rem;
    font-weight: 800;
    color: #92400e;
    background: linear-gradient(145deg, #fef3c7, #fde68a);
    border: 1px solid rgba(217, 119, 6, 0.28);
    font-family: var(--mp-display, inherit);
  }
  .mp-promo-lead {
    margin: 0 0 10px;
    font-size: 0.78rem;
    color: var(--mp-muted);
    line-height: 1.4;
    font-weight: 500;
  }
  .mp-promo-lead strong {
    color: #a16207;
    font-family: var(--mp-display);
    font-size: 1.05rem;
    font-weight: 800;
  }
  .mp-promo-lead-empty {
    margin-bottom: 4px !important;
    text-align: center;
  }
  .mp-promo-list {
    list-style: none;
    margin: 0 0 10px;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .mp-promo-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1.5px solid rgba(217, 119, 6, 0.12);
    background: rgba(255, 255, 255, 0.92);
    border-radius: 12px;
    padding: 6px 8px 6px 6px;
    cursor: pointer;
    text-align: left;
    font: inherit;
    color: inherit;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s, transform 0.15s;
  }
  .mp-promo-item:hover {
    border-color: rgba(217, 119, 6, 0.35);
    background: #fffdf7;
    box-shadow: 0 6px 14px -8px rgba(180, 83, 9, 0.3);
    transform: translateY(-1px);
  }
  .mp-promo-thumb {
    position: relative;
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    overflow: hidden;
    background: var(--mp-surface, #f0f4f1);
    border: 1px solid rgba(15, 20, 16, 0.06);
  }
  .mp-promo-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .mp-promo-thumb-ph {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--mp-faint, #9aafa0);
    background: linear-gradient(145deg, #f4f8f5, #e8f0ea);
  }
  .mp-promo-thumb-badge {
    position: absolute;
    right: 2px;
    bottom: 2px;
    width: 16px;
    height: 16px;
    border-radius: 5px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: linear-gradient(145deg, #f59e0b, #b45309);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
  }
  .mp-promo-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mp-promo-title {
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--mp-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    letter-spacing: -0.01em;
  }
  .mp-promo-price {
    font-size: 0.7rem;
    font-weight: 800;
    color: #0d4a2c;
    font-family: var(--mp-display, inherit);
  }
  .mp-promo-go {
    flex-shrink: 0;
    color: #d97706;
    opacity: 0.65;
    display: flex;
  }
  .mp-promo-item:hover .mp-promo-go { opacity: 1; }
  .mp-promo-more {
    display: block;
    width: 100%;
    margin: -2px 0 8px;
    border: none;
    background: none;
    padding: 0;
    font-size: 0.7rem;
    font-weight: 700;
    color: #a16207;
    cursor: pointer;
    text-align: left;
  }
  .mp-promo-more:hover { text-decoration: underline; }
  .mp-promo-cta,
  .mp-promo-cta-btn {
    width: 100%;
    text-align: center;
  }
  .mp-promo-cta-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    padding: 10px 12px;
    border-radius: 11px;
    border: 1.5px solid rgba(26, 122, 74, 0.28);
    background: #fff;
    color: var(--mp-green-d, #0d4a2c);
    font: inherit;
    font-size: 0.8rem;
    font-weight: 800;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  }
  .mp-promo-cta-btn:hover {
    background: #eef8f2;
    border-color: rgba(26, 122, 74, 0.45);
    box-shadow: 0 4px 12px -6px rgba(13, 74, 44, 0.25);
  }
  .mp-promo-cta-btn-primary {
    border: none;
    color: #fff;
    background: linear-gradient(145deg, #22a05e, #0d4a2c);
    box-shadow: 0 6px 14px -6px rgba(13, 74, 44, 0.4);
  }
  .mp-promo-cta-btn-primary:hover {
    background: linear-gradient(145deg, #1a8f52, #0a3d24);
    color: #fff;
    border: none;
  }
  .mp-promo-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 6px 4px 12px;
  }
  .mp-promo-empty-icon {
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 10px;
    color: #b45309;
    background: linear-gradient(145deg, #fef3c7, #fde68a);
    border: 1px solid rgba(217, 119, 6, 0.2);
  }

  /* Feature choice modal — modern product picker */
  .mp-feature-choice-modal {
    max-width: 420px !important;
    width: calc(100% - 28px);
    padding: 0 !important;
    text-align: left !important;
    overflow: hidden;
    border-radius: 18px !important;
    box-shadow:
      0 0 0 1px rgba(15, 20, 16, 0.06),
      0 24px 48px -12px rgba(15, 20, 16, 0.22) !important;
  }
  .mp-feature-choice-modal h3 {
    margin: 0 !important;
    font-size: 1.05rem !important;
    font-weight: 800 !important;
    letter-spacing: -0.02em;
    color: var(--mp-ink, #0f1410) !important;
  }
  .mp-feature-choice-modal > p { display: none; }
  .mp-fc-head {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 18px 16px 14px;
    background:
      linear-gradient(145deg, #fffbeb 0%, #fff8e6 40%, #ffffff 100%);
    border-bottom: 1px solid rgba(217, 119, 6, 0.12);
  }
  .mp-fc-head-icon {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    background: linear-gradient(145deg, #f59e0b, #d4920a 55%, #b45309);
    box-shadow: 0 6px 16px -4px rgba(180, 83, 9, 0.45);
  }
  .mp-fc-head-text { flex: 1; min-width: 0; }
  .mp-fc-head-text p {
    margin: 3px 0 0 !important;
    font-size: 0.75rem !important;
    color: var(--mp-muted, #637068) !important;
    line-height: 1.35 !important;
    font-weight: 500;
  }
  .mp-fc-close {
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border: none;
    border-radius: 10px;
    background: rgba(15, 20, 16, 0.05);
    color: var(--mp-muted, #637068);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .mp-fc-close:hover {
    background: rgba(15, 20, 16, 0.1);
    color: var(--mp-ink, #0f1410);
  }
  .mp-fc-options {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 14px 14px 6px;
  }
  .mp-fc-option {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    text-align: left;
    padding: 12px 12px;
    border-radius: 14px;
    border: 1.5px solid var(--mp-border, #d8e5dc);
    background: #fff;
    cursor: default;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s, transform 0.15s;
  }
  button.mp-fc-option {
    cursor: pointer;
    font: inherit;
    color: inherit;
  }
  button.mp-fc-option:hover {
    border-color: #d97706;
    background: linear-gradient(165deg, #fffbeb 0%, #fff 80%);
    box-shadow: 0 8px 20px -10px rgba(180, 83, 9, 0.35);
    transform: translateY(-1px);
  }
  button.mp-fc-option:active { transform: translateY(0); }
  .mp-fc-option.is-disabled {
    opacity: 0.58;
  }
  .mp-fc-option-icon {
    flex-shrink: 0;
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .mp-fc-option-icon-new {
    color: #b45309;
    background: linear-gradient(145deg, #fef3c7, #fde68a);
  }
  .mp-fc-option-icon-exist {
    color: #0d4a2c;
    background: linear-gradient(145deg, #e6f7ee, #c8ebd6);
  }
  .mp-fc-option-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mp-fc-option-title {
    font-size: 0.92rem;
    font-weight: 800;
    color: var(--mp-ink, #0f1410);
    letter-spacing: -0.01em;
  }
  .mp-fc-option-desc {
    font-size: 0.74rem;
    color: var(--mp-muted, #637068);
    line-height: 1.35;
    font-weight: 500;
  }
  .mp-fc-option-chevron {
    flex-shrink: 0;
    color: #d97706;
    opacity: 0.85;
  }
  .mp-fc-option-count {
    flex-shrink: 0;
    min-width: 26px;
    height: 26px;
    padding: 0 7px;
    border-radius: 999px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 0.72rem;
    font-weight: 800;
    color: #0d4a2c;
    background: #e6f7ee;
  }
  .mp-fc-picker {
    padding: 4px 14px 16px;
  }
  .mp-fc-picker-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--mp-muted, #637068);
    margin-bottom: 10px;
  }
  .mp-fc-picker-label svg { color: #d97706; }
  .mp-fc-product-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: min(42vh, 280px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  .mp-fc-product {
    display: flex;
    align-items: center;
    gap: 12px;
    width: 100%;
    text-align: left;
    padding: 8px;
    border-radius: 14px;
    border: 1.5px solid var(--mp-border, #e8ede9);
    background: #fff;
    cursor: pointer;
    font: inherit;
    color: inherit;
    transition: border-color 0.15s, background 0.15s, box-shadow 0.15s;
  }
  .mp-fc-product:hover:not(:disabled) {
    border-color: #f0d28a;
    background: #fffdf7;
    box-shadow: 0 6px 16px -8px rgba(180, 83, 9, 0.28);
  }
  .mp-fc-product:disabled {
    opacity: 0.7;
    cursor: wait;
  }
  .mp-fc-product.is-busy {
    border-color: #f0d28a;
    background: #fffbeb;
  }
  .mp-fc-product-thumb {
    flex-shrink: 0;
    width: 56px;
    height: 56px;
    border-radius: 12px;
    overflow: hidden;
    background: var(--mp-surface, #f0f4f1);
    border: 1px solid rgba(15, 20, 16, 0.06);
  }
  .mp-fc-product-thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .mp-fc-product-thumb-ph {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--mp-faint, #9aafa0);
    background: linear-gradient(145deg, #f4f8f5, #e8f0ea);
  }
  .mp-fc-product-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mp-fc-product-title {
    font-size: 0.86rem;
    font-weight: 700;
    color: var(--mp-ink, #0f1410);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    letter-spacing: -0.01em;
  }
  .mp-fc-product-price {
    font-size: 0.8rem;
    font-weight: 800;
    color: #0d4a2c;
    font-family: var(--mp-display, inherit);
  }
  .mp-fc-product-loc {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 0.68rem;
    font-weight: 500;
    color: var(--mp-muted, #637068);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mp-fc-product-action {
    flex-shrink: 0;
    display: flex;
    align-items: center;
  }
  .mp-fc-product-boost {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 10px;
    border-radius: 999px;
    font-size: 0.7rem;
    font-weight: 800;
    color: #92400e;
    background: linear-gradient(145deg, #fef3c7, #fde68a);
    border: 1px solid rgba(217, 119, 6, 0.25);
  }
  .mp-fc-product:hover:not(:disabled) .mp-fc-product-boost {
    color: #fff;
    background: linear-gradient(145deg, #f59e0b, #d4920a);
    border-color: transparent;
  }
  .mp-fc-spin {
    animation: mp-fc-spin 0.8s linear infinite;
    color: #d97706;
  }
  @keyframes mp-fc-spin {
    to { transform: rotate(360deg); }
  }
  .mp-fc-empty {
    margin: 4px 14px 18px;
    padding: 20px 16px;
    border-radius: 14px;
    border: 1.5px dashed var(--mp-border, #d8e5dc);
    background: var(--mp-surface, #f4f8f5);
    text-align: center;
  }
  .mp-fc-empty-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 16px;
    margin-bottom: 10px;
    color: var(--mp-muted, #637068);
    background: #fff;
    border: 1px solid var(--mp-border, #e8ede9);
  }
  .mp-fc-empty p {
    margin: 0 !important;
    font-size: 0.8rem !important;
    color: var(--mp-muted, #637068) !important;
    line-height: 1.45 !important;
    font-weight: 500;
  }
  .mp-promo-note {
    margin: 10px 0 0;
    font-size: 0.68rem;
    color: var(--mp-faint);
    line-height: 1.35;
  }

  /* ── PHASE 5 — Premium desktop vertical nav ── */
  .mp-pnav-desk {
    display: none; /* phone: bottom nav; shown from tablet up */
    flex-direction: column;
    width: 100%;
    max-width: 280px;
    min-height: 0;
    max-height: 100%;
    background: var(--mp-surface);
    border: 1px solid rgba(15, 23, 42, 0.07);
    border-radius: 16px;
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.04),
      0 8px 24px rgba(15, 23, 42, 0.05);
    overflow: hidden; /* radius clip — scrolling lives on .mp-pnav-desk-body */
  }
  .mp-pnav-desk-head {
    flex-shrink: 0;
    padding: 16px 14px 12px;
    border-bottom: 1px solid rgba(15, 23, 42, 0.05);
    background:
      linear-gradient(165deg, rgba(232, 245, 238, 0.55) 0%, #fff 70%);
  }
  .mp-pnav-desk-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-x: hidden;
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    padding: 0 0 10px;
    scrollbar-width: thin;
    scrollbar-color: rgba(15, 157, 88, 0.35) transparent;
  }
  .mp-pnav-desk-body::-webkit-scrollbar { width: 6px; }
  .mp-pnav-desk-body::-webkit-scrollbar-thumb {
    background: rgba(15, 157, 88, 0.3);
    border-radius: 999px;
  }
  .mp-pnav-desk-badge {
    display: inline-flex;
    padding: 3px 9px;
    border-radius: var(--mp-r-pill);
    background: rgba(15, 157, 88, 0.1);
    color: var(--mp-green-d);
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .mp-pnav-desk-title {
    margin: 8px 0 0;
    font-family: var(--mp-display);
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--mp-ink);
    letter-spacing: -0.02em;
  }
  .mp-pnav-desk-desc {
    margin: 2px 0 0;
    font-size: 0.72rem;
    color: var(--mp-faint);
    font-weight: 500;
  }
  .mp-pnav-search {
    position: relative;
    display: flex;
    align-items: center;
    margin-top: 12px;
    gap: 0;
  }
  .mp-pnav-search-ic {
    position: absolute;
    left: 10px;
    color: var(--mp-subtle);
    display: grid;
    place-items: center;
    pointer-events: none;
  }
  .mp-pnav-search-input {
    width: 100%;
    border: 1.5px solid rgba(15, 23, 42, 0.08);
    background: #f8faf9;
    border-radius: 10px;
    padding: 9px 32px 9px 32px;
    font-size: 0.78rem;
    font-weight: 500;
    color: var(--mp-ink);
    outline: none;
    transition:
      border-color 160ms var(--mp-ease),
      background 160ms var(--mp-ease),
      box-shadow 160ms var(--mp-ease);
  }
  .mp-pnav-search-input::placeholder { color: var(--mp-faint); }
  .mp-pnav-search-input:hover { border-color: rgba(15, 157, 88, 0.22); }
  .mp-pnav-search-input:focus {
    border-color: rgba(15, 157, 88, 0.45);
    background: #fff;
    box-shadow: 0 0 0 3px rgba(15, 157, 88, 0.12);
  }
  .mp-pnav-search-clear {
    position: absolute;
    right: 6px;
    border: none;
    background: rgba(15, 23, 42, 0.06);
    color: var(--mp-muted);
    width: 22px;
    height: 22px;
    border-radius: 50%;
    font-size: 0.65rem;
    cursor: pointer;
    display: grid;
    place-items: center;
    line-height: 1;
  }
  .mp-pnav-search-clear:hover { background: rgba(15, 23, 42, 0.1); }
  .mp-pnav-empty {
    margin: 16px 14px;
    font-size: 0.78rem;
    color: var(--mp-muted);
    line-height: 1.4;
  }
  .mp-pnav-section {
    padding: 4px 0 2px;
  }
  .mp-pnav-section + .mp-pnav-section {
    border-top: 1px solid rgba(15, 23, 42, 0.05);
    margin-top: 4px;
    padding-top: 6px;
  }
  .mp-pnav-section-label {
    padding: 10px 16px 6px;
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--mp-subtle);
  }
  .mp-pnav-item {
    position: relative;
    width: calc(100% - 12px);
    margin: 2px 6px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 10px 10px 12px;
    border: none;
    border-radius: 12px;
    background: transparent;
    cursor: pointer;
    text-align: left;
    color: inherit;
    transition:
      background 160ms var(--mp-ease),
      transform 120ms var(--mp-ease),
      box-shadow 160ms var(--mp-ease);
  }
  .mp-pnav-item:hover {
    background: rgba(15, 157, 88, 0.06);
  }
  .mp-pnav-item:active { transform: scale(0.985); }
  .mp-pnav-item:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 1px;
  }
  .mp-pnav-item-bar {
    position: absolute;
    left: 0;
    top: 10px;
    bottom: 10px;
    width: 3px;
    border-radius: 0 3px 3px 0;
    background: transparent;
    transition: background 160ms var(--mp-ease), transform 160ms var(--mp-ease);
    transform: scaleY(0.4);
  }
  .mp-pnav-item.is-active {
    background: linear-gradient(90deg, rgba(232, 245, 238, 0.98), rgba(246, 251, 248, 0.72));
    box-shadow: inset 0 0 0 1px rgba(15, 157, 88, 0.08);
  }
  .mp-pnav-item.is-active .mp-pnav-item-bar {
    background: var(--mp-green);
    transform: scaleY(1);
  }
  .mp-pnav-item.is-active .mp-pnav-item-label {
    color: var(--mp-green-d);
  }
  .mp-pnav-item-ic {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    font-size: 1rem;
    background: #f3f5f4;
    border: 1px solid rgba(15, 23, 42, 0.05);
    transition:
      background 160ms var(--mp-ease),
      border-color 160ms var(--mp-ease),
      transform 160ms var(--mp-ease),
      box-shadow 160ms var(--mp-ease),
      color 160ms var(--mp-ease);
  }
  .mp-pnav-item:hover .mp-pnav-item-ic {
    transform: scale(1.04);
    background: var(--mp-green-l);
    border-color: rgba(15, 157, 88, 0.14);
  }
  .mp-pnav-item.is-active .mp-pnav-item-ic {
    background: linear-gradient(145deg, var(--mp-green), var(--mp-green-d));
    border-color: transparent;
    box-shadow: 0 4px 12px rgba(15, 157, 88, 0.28);
    filter: grayscale(0) saturate(1.1);
  }
  .mp-pnav-item-copy {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .mp-pnav-item-label {
    font-size: 0.84rem;
    font-weight: 700;
    color: var(--mp-ink);
    letter-spacing: -0.01em;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mp-pnav-item-hint {
    font-size: 0.68rem;
    color: var(--mp-faint);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 1.3;
  }
  .mp-pnav-item-count {
    font-style: normal;
    font-size: 0.68rem;
    font-weight: 800;
    background: var(--mp-green-l);
    color: var(--mp-green-d);
    border-radius: var(--mp-r-pill);
    padding: 3px 8px;
    min-width: 22px;
    text-align: center;
    line-height: 1.2;
    flex-shrink: 0;
  }
  .mp-pnav-item.is-active .mp-pnav-item-count {
    background: var(--mp-green);
    color: #fff;
  }

  /* ── PHASE 5 — Mobile header section dropdown + search ── */
  .mp-brand-desk { display: flex; }
  .mp-mob-section-dd {
    display: none;
    position: relative;
    min-width: 0;
    flex: 1 1 auto;
    z-index: 60;
  }
  .mp-mob-section-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    max-width: 100%;
    min-height: 40px;
    padding: 8px 10px 8px 4px;
    border: none;
    border-radius: 10px;
    background: transparent;
    color: var(--mp-ink);
    font: inherit;
    font-size: 1.05rem;
    font-weight: 700;
    letter-spacing: -0.03em;
    cursor: pointer;
  }
  .mp-mob-section-btn:active { opacity: 0.75; }
  .mp-mob-section-btn.is-open { color: var(--mp-green); }
  .mp-mob-section-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
  }
  .mp-mob-section-chev {
    display: inline-flex;
    flex-shrink: 0;
    color: #9ca3af;
    transition: transform 0.18s ease, color 0.15s ease;
  }
  .mp-mob-section-chev.is-open,
  .mp-mob-section-btn.is-open .mp-mob-section-chev {
    transform: rotate(180deg);
    color: var(--mp-green);
  }
  .mp-mob-section-scrim {
    position: fixed;
    inset: 0;
    z-index: 55;
    border: none;
    margin: 0;
    padding: 0;
    background: rgba(15, 23, 42, 0.2);
    cursor: pointer;
  }
  .mp-mob-section-menu {
    position: absolute;
    top: calc(100% + 8px);
    left: 0;
    width: min(300px, calc(100vw - 24px));
    max-height: min(70vh, 420px);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    background: #fff;
    border: 1px solid rgba(15, 23, 42, 0.08);
    border-radius: 14px;
    box-shadow: 0 12px 36px rgba(15, 23, 42, 0.12);
    padding: 6px;
    z-index: 70;
  }
  .mp-mob-section-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
    border: none;
    background: transparent;
    border-radius: 10px;
    padding: 11px 10px;
    cursor: pointer;
    font: inherit;
    color: inherit;
  }
  .mp-mob-section-item:hover { background: #f4f5f4; }
  .mp-mob-section-item.is-active {
    background: #f3f4f6;
  }
  .mp-mob-section-item-ic {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    background: #f3f4f6;
    color: #374151;
  }
  .mp-mob-section-item.is-active .mp-mob-section-item-ic {
    background: #e8f5ee;
    color: var(--mp-green);
  }
  .mp-mob-section-item-copy {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .mp-mob-section-item-copy strong {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--mp-ink);
  }
  .mp-mob-section-item-copy span {
    font-size: 0.7rem;
    color: #9ca3af;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mp-mob-section-item-count {
    font-style: normal;
    font-size: 0.7rem;
    font-weight: 700;
    color: #6b7280;
    background: #f3f4f6;
    border-radius: 999px;
    padding: 2px 8px;
  }
  .mp-mob-section-check {
    display: inline-flex;
    color: var(--mp-green);
    flex-shrink: 0;
  }
  .mp-top-btn-search {
    display: none;
  }
  .mp-mob-search-panel {
    display: none;
  }
  /* Legacy chip bar removed from mobile layout */
  .mp-pnav-mob { display: none !important; }
  .mp-pnav-more-sheet {
    position: absolute;
    top: calc(100% + 8px);
    right: 0;
    bottom: auto;
    width: min(280px, calc(100vw - 24px));
    background: #fff;
    border: 1px solid rgba(15, 23, 42, 0.08);
    border-radius: 14px;
    box-shadow:
      0 8px 28px rgba(15, 23, 42, 0.14),
      0 2px 8px rgba(15, 23, 42, 0.06);
    padding: 8px;
    z-index: 95;
    animation: mp-fade-in 160ms var(--mp-ease) both;
  }
  .mp-pnav-more-head {
    padding: 8px 10px 6px;
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--mp-subtle);
  }
  .mp-pnav-more-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    border: none;
    background: transparent;
    border-radius: 10px;
    padding: 10px;
    cursor: pointer;
    text-align: left;
    transition: background 140ms var(--mp-ease);
  }
  .mp-pnav-more-item:hover { background: rgba(15, 157, 88, 0.06); }
  .mp-pnav-more-item.is-active {
    background: rgba(15, 157, 88, 0.1);
  }
  .mp-pnav-more-item:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 1px;
  }
  .mp-pnav-more-ic {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: #f3f5f4;
    font-size: 1rem;
    flex-shrink: 0;
  }
  .mp-pnav-more-item.is-active .mp-pnav-more-ic {
    background: linear-gradient(145deg, var(--mp-green), var(--mp-green-d));
  }
  .mp-pnav-more-copy {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .mp-pnav-more-copy strong {
    font-size: 0.84rem;
    font-weight: 700;
    color: var(--mp-ink);
  }
  .mp-pnav-more-copy span {
    font-size: 0.68rem;
    color: var(--mp-faint);
    font-weight: 500;
  }
  .mp-pnav-more-item em {
    font-style: normal;
    font-size: 0.68rem;
    font-weight: 800;
    background: var(--mp-green-l);
    color: var(--mp-green-d);
    border-radius: var(--mp-r-pill);
    padding: 2px 7px;
  }
  .mp-account.is-nav-focus {
    box-shadow:
      0 0 0 2px rgba(15, 157, 88, 0.18),
      var(--mp-shadow-sm);
  }
  #mp-settings-profile,
  #mp-settings-account {
    scroll-margin-top: calc(var(--mp-topbar-h) + 16px);
  }

  /* ── Loading ── */
  .mp-loading {
    min-height: 100dvh;
    display: grid;
    place-items: center;
  }
  .mp-spinner {
    width: 28px;
    height: 28px;
    border: 3px solid var(--mp-line-strong);
    border-top-color: var(--mp-green);
    border-radius: 50%;
    animation: mp-spin 0.75s linear infinite;
  }
  @keyframes mp-spin { to { transform: rotate(360deg); } }
  @keyframes mp-fade-in {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: none; }
  }

  /* ── Top bar ── */
  .mp-topbar {
    position: sticky;
    top: 0;
    z-index: 50;
    width: 100%;
    background: #fff;
    border-bottom: 1px solid rgba(15, 23, 42, 0.08);
    box-shadow: 0 1px 0 rgba(15, 23, 42, 0.02);
    overflow: visible;
  }
  .mp-topbar::before { display: none; }
  .mp-topbar-inner {
    position: relative;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px var(--mp-pad-r) 11px var(--mp-pad-x);
    min-height: var(--mp-topbar-h);
    overflow: visible;
  }
  .mp-brand-block {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .mp-back-home {
    display: none; /* removed — home via wordmark / BottomNav */
    flex-shrink: 0;
    width: 38px;
    height: 38px;
    border: 1.5px solid var(--mp-line-strong);
    border-radius: var(--mp-r-sm);
    background: var(--mp-green-mist);
    color: var(--mp-green-d);
    cursor: pointer;
    display: grid;
    place-items: center;
    padding: 0;
    transition:
      background var(--mp-dur) var(--mp-ease),
      border-color var(--mp-dur) var(--mp-ease),
      transform var(--mp-dur) var(--mp-ease),
      box-shadow var(--mp-dur) var(--mp-ease);
  }
  .mp-back-home:hover {
    background: var(--mp-green-l);
    border-color: rgba(15, 157, 88, 0.35);
    box-shadow: var(--mp-shadow-xs);
  }
  .mp-back-home:active { transform: scale(0.96); }
  .mp-wordmark-btn {
    flex-shrink: 0;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    font-family: var(--mp-display);
    font-size: 1.2rem;
    font-weight: 800;
    letter-spacing: -0.04em;
    line-height: 1;
    display: inline-flex;
    align-items: baseline;
  }
  .mp-wordmark-btn:hover .mp-wordmark-soko { color: var(--mp-green-d); }
  .mp-wordmark-btn:active { opacity: 0.85; }
  .mp-wordmark-soko {
    color: var(--mp-green);
    transition: color var(--mp-dur) var(--mp-ease);
  }
  .mp-wordmark-mw { color: var(--mp-amber); }
  .mp-topbar-divider {
    width: 1px;
    height: 22px;
    flex-shrink: 0;
    background: linear-gradient(180deg, transparent, #d5e6db 18%, #d5e6db 82%, transparent);
    margin: 0 2px;
  }
  .mp-topbar-titles {
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .mp-topbar-title {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--mp-ink);
    line-height: 1.15;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  }
  .mp-title-phone { display: inline; }
  .mp-title-desk { display: none; }
  .mp-topbar-kicker {
    margin: 0;
    font-size: 0.65rem;
    font-weight: 600;
    color: var(--mp-faint);
    letter-spacing: 0.04em;
    text-transform: uppercase;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Phone horizontal section chips */
  .mp-mobile-sections {
    display: flex;
    flex-wrap: nowrap;
    gap: 8px;
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    padding: 0 max(12px, env(safe-area-inset-left, 0px)) 12px max(12px, env(safe-area-inset-right, 0px));
  }
  .mp-mobile-sections::-webkit-scrollbar { display: none; }
  .mp-mobile-chip {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1.5px solid var(--mp-line);
    background: var(--mp-surface);
    border-radius: var(--mp-r-pill);
    padding: 8px 12px;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--mp-muted);
    cursor: pointer;
    box-shadow: var(--mp-shadow-xs);
    transition:
      background var(--mp-dur) var(--mp-ease),
      border-color var(--mp-dur) var(--mp-ease),
      color var(--mp-dur) var(--mp-ease),
      box-shadow var(--mp-dur) var(--mp-ease);
  }
  .mp-mobile-chip.is-active {
    background: linear-gradient(135deg, var(--mp-green), var(--mp-green-d));
    border-color: transparent;
    color: #fff;
    box-shadow: var(--mp-shadow-green);
  }
  .mp-mobile-chip-ic { font-size: 0.9rem; line-height: 1; }
  .mp-mobile-chip-label { white-space: nowrap; }
  .mp-mobile-chip-count {
    font-style: normal;
    font-size: 0.65rem;
    font-weight: 800;
    background: rgba(0, 0, 0, 0.08);
    border-radius: var(--mp-r-pill);
    padding: 1px 6px;
    min-width: 18px;
    text-align: center;
  }
  .mp-mobile-chip.is-active .mp-mobile-chip-count {
    background: rgba(255, 255, 255, 0.22);
    color: #fff;
  }
  .mp-topbar-actions {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .mp-top-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    border-radius: var(--mp-r-pill);
    padding: 8px 13px;
    font-size: 0.75rem;
    font-weight: 700;
    cursor: pointer;
    white-space: nowrap;
    transition:
      background var(--mp-dur) var(--mp-ease),
      border-color var(--mp-dur) var(--mp-ease),
      box-shadow var(--mp-dur) var(--mp-ease),
      color var(--mp-dur) var(--mp-ease),
      transform 120ms var(--mp-ease);
  }
  .mp-top-btn:active { transform: scale(0.97); }
  .mp-top-btn-public {
    border: 1.5px solid rgba(15, 157, 88, 0.28);
    background: var(--mp-green-l);
    color: var(--mp-green-d);
  }
  .mp-top-btn-public:hover {
    background: #dcf0e4;
    border-color: rgba(15, 157, 88, 0.42);
    box-shadow: 0 2px 10px rgba(15, 157, 88, 0.12);
  }
  .mp-top-btn-out {
    border: 1.5px solid #eceff1;
    background: var(--mp-surface);
    color: var(--mp-muted);
  }
  .mp-top-btn-out:hover {
    background: #f8f9fa;
    border-color: #dadce0;
    color: #3c4043;
  }

  /* ── Surfaces ── */
  .mp-card {
    background: var(--mp-surface);
    margin: 12px var(--mp-pad-r) 12px var(--mp-pad-x);
    border-radius: var(--mp-r-xl);
    border: 1px solid rgba(15, 157, 88, 0.09);
    box-shadow: var(--mp-shadow-sm);
    padding: 16px;
  }

  /* ── Left nav ── */
  .mp-nav-card {
    margin: 12px var(--mp-pad-r) 10px var(--mp-pad-x);
    background:
      linear-gradient(165deg, rgba(232, 245, 238, 0.55) 0%, #fff 42%, #fff 100%);
    border: 1px solid rgba(15, 157, 88, 0.12);
    border-radius: var(--mp-r-lg);
    box-shadow: var(--mp-shadow-sm);
    padding: 14px;
    position: relative;
    overflow: hidden;
  }
  .mp-nav-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--mp-amber), var(--mp-green));
  }
  .mp-nav-card-badge {
    display: inline-flex;
    margin-bottom: 10px;
    padding: 3px 9px;
    border-radius: var(--mp-r-pill);
    background: rgba(15, 157, 88, 0.1);
    color: var(--mp-green-d);
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .mp-nav-strength {
    margin-top: 12px;
    padding-top: 12px;
    border-top: 1px solid var(--mp-line);
  }
  .mp-nav-strength-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-bottom: 6px;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--mp-subtle);
  }
  .mp-nav-strength-row strong {
    font-family: var(--mp-display);
    font-size: 0.85rem;
    font-weight: 800;
    color: var(--mp-green-d);
  }
  .mp-nav-strength-bar {
    height: 6px;
    border-radius: var(--mp-r-pill);
    background: #eef0f0;
    overflow: hidden;
  }
  .mp-nav-strength-fill {
    height: 100%;
    border-radius: var(--mp-r-pill);
    background: linear-gradient(90deg, var(--mp-amber), var(--mp-green) 60%, var(--mp-green-d));
    transition: width 0.4s var(--mp-ease);
  }
  .mp-nav-profile {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    border: none;
    background: none;
    padding: 4px;
    margin: -4px;
    border-radius: var(--mp-r-md);
    text-align: left;
    cursor: pointer;
    transition: background var(--mp-dur) var(--mp-ease);
  }
  .mp-nav-profile:hover { background: var(--mp-green-mist); }
  .mp-nav-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    flex-shrink: 0;
    overflow: hidden;
    background: linear-gradient(145deg, var(--mp-green), var(--mp-green-d));
    color: #fff;
    font-family: var(--mp-display);
    font-weight: 800;
    font-size: 1.05rem;
    display: grid;
    place-items: center;
    box-shadow:
      0 0 0 3px var(--mp-green-l),
      0 4px 12px rgba(15, 157, 88, 0.18);
  }
  .mp-nav-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .mp-nav-profile-text { min-width: 0; flex: 1; }
  .mp-nav-name {
    display: block;
    font-size: 0.9375rem;
    font-weight: 800;
    color: var(--mp-ink);
    letter-spacing: -0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mp-nav-meta {
    display: block;
    margin-top: 3px;
    font-size: 0.72rem;
    color: var(--mp-faint);
    font-weight: 500;
  }
  .mp-nav-stats {
    display: flex;
    margin-top: 14px;
    border: 1px solid var(--mp-line);
    border-radius: var(--mp-r-md);
    overflow: hidden;
    background: var(--mp-surface-2);
  }
  .mp-nav-stat {
    flex: 1;
    border: none;
    background: transparent;
    padding: 10px 4px;
    cursor: pointer;
    border-right: 1px solid var(--mp-line);
    transition: background var(--mp-dur) var(--mp-ease);
  }
  .mp-nav-stat:last-child { border-right: none; }
  .mp-nav-stat:hover { background: rgba(15, 157, 88, 0.06); }
  .mp-nav-stat strong {
    display: block;
    font-family: var(--mp-display);
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--mp-green-d);
    letter-spacing: -0.02em;
  }
  .mp-nav-stat span {
    font-size: 0.58rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--mp-faint);
  }

  /* Legacy group-nav selectors kept for any residual refs — phase 5 uses .mp-pnav-* */
  .mp-group-nav { display: none; }

  /* ── Right detail ── */
  .mp-detail-bar {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin: 12px var(--mp-pad-r) 0 var(--mp-pad-x);
    padding: 12px 14px;
    background: rgba(255, 255, 255, 0.92);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid rgba(15, 157, 88, 0.1);
    border-radius: 14px;
    box-shadow: var(--mp-shadow-sm);
  }
  .mp-detail-cta {
    align-self: stretch;
    text-align: center;
  }

  /* Selling Active / Sold subtabs */
  .mp-subtabs {
    display: flex;
    gap: 6px;
    margin: 0 max(12px, env(safe-area-inset-left, 0px)) 10px max(12px, env(safe-area-inset-right, 0px));
    padding: 4px;
    background: var(--mp-surface);
    border: 1px solid rgba(15, 157, 88, 0.1);
    border-radius: 14px;
    box-shadow: var(--mp-shadow-xs);
  }
  .mp-subtab {
    flex: 1;
    border: none;
    background: transparent;
    border-radius: 10px;
    padding: 9px 12px;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--mp-subtle);
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    transition: background var(--mp-dur) var(--mp-ease), color var(--mp-dur) var(--mp-ease);
  }
  .mp-subtab em {
    font-style: normal;
    font-size: 0.68rem;
    font-weight: 800;
    background: #f1f3f4;
    color: var(--mp-muted);
    border-radius: var(--mp-r-pill);
    padding: 1px 7px;
  }
  .mp-subtab.is-active {
    background: linear-gradient(135deg, var(--mp-green), var(--mp-green-d));
    color: #fff;
    box-shadow: var(--mp-shadow-green);
  }
  .mp-subtab.is-active em {
    background: rgba(255, 255, 255, 0.22);
    color: #fff;
  }
  .mp-detail-back {
    align-self: flex-start;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1.5px solid var(--mp-line-strong);
    border-radius: var(--mp-r-pill);
    background: var(--mp-green-mist);
    color: var(--mp-green-d);
    font-size: 0.75rem;
    font-weight: 700;
    padding: 7px 12px;
    cursor: pointer;
    transition:
      background var(--mp-dur) var(--mp-ease),
      border-color var(--mp-dur) var(--mp-ease),
      box-shadow var(--mp-dur) var(--mp-ease);
  }
  .mp-detail-back:hover {
    background: var(--mp-green-l);
    border-color: rgba(15, 157, 88, 0.3);
    box-shadow: var(--mp-shadow-xs);
  }
  .mp-detail-title-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 0;
  }
  .mp-detail-ic {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    font-size: 1.15rem;
    background: linear-gradient(145deg, var(--mp-green-l), #f0faf4);
    border: 1px solid rgba(15, 157, 88, 0.14);
    box-shadow: var(--mp-shadow-xs);
  }
  .mp-detail-title {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1.05rem;
    font-weight: 800;
    letter-spacing: -0.025em;
    color: var(--mp-ink);
    line-height: 1.2;
  }
  .mp-detail-sub {
    margin: 3px 0 0;
    font-size: 0.75rem;
    color: var(--mp-faint);
    font-weight: 500;
  }
  .mp-detail-body {
    min-width: 0;
    animation: mp-fade-in 220ms var(--mp-ease) both;
  }

  /* ── Hero ── */
  .mp-hero {
    padding: 0;
    overflow: hidden;
    border: 1px solid rgba(15, 157, 88, 0.12);
    box-shadow: var(--mp-shadow-md);
  }
  .mp-hero-banner {
    position: relative;
    width: 100%;
    aspect-ratio: 16 / 5;
    min-height: 132px;
    max-height: 200px;
    height: auto;
    background: linear-gradient(135deg, var(--mp-green-deep) 0%, var(--mp-green-d) 42%, var(--mp-green) 78%, #12b86a 100%);
    overflow: hidden;
    isolation: isolate;
  }
  .mp-hero-banner.has-cover {
    aspect-ratio: 2.7 / 1;
    min-height: 160px;
    max-height: 280px;
    background: #0b1f14;
  }
  .mp-hero-cover-img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center;
    display: block;
  }
  .mp-hero-cover-scrim {
    position: absolute;
    inset: 0;
    background: linear-gradient(180deg, rgba(6, 61, 35, 0.12) 0%, rgba(6, 61, 35, 0.5) 100%);
    pointer-events: none;
    z-index: 1;
  }
  .mp-hero-banner.has-cover .mp-hero-cover-scrim {
    background: linear-gradient(
      180deg,
      rgba(0, 0, 0, 0.24) 0%,
      rgba(0, 0, 0, 0.05) 35%,
      transparent 65%,
      rgba(0, 0, 0, 0.14) 100%
    );
  }
  .mp-cover-actions {
    position: absolute;
    right: 10px;
    top: 10px;
    z-index: 4;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
    justify-content: flex-end;
    max-width: calc(100% - 20px);
  }
  .mp-cover-btn {
    border: none;
    border-radius: var(--mp-r-pill);
    padding: 7px 12px;
    font-size: 0.7rem;
    font-weight: 700;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.94);
    color: var(--mp-green-d);
    box-shadow: 0 2px 12px rgba(0, 0, 0, 0.18);
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
    line-height: 1.15;
    transition:
      background var(--mp-dur) var(--mp-ease),
      transform var(--mp-dur) var(--mp-ease),
      box-shadow var(--mp-dur) var(--mp-ease);
  }
  .mp-cover-btn:hover {
    background: #fff;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.22);
  }
  .mp-cover-btn:active { transform: scale(0.97); }
  .mp-cover-btn:disabled { opacity: 0.7; cursor: wait; }
  .mp-cover-btn-ghost {
    background: rgba(15, 23, 42, 0.48);
    color: #fff;
  }
  .mp-cover-btn-ghost:hover { background: rgba(15, 23, 42, 0.62); }
  .mp-hero-arc {
    position: absolute;
    border-radius: 50%;
    border: 1.5px solid rgba(255, 255, 255, 0.12);
    pointer-events: none;
  }
  .mp-hero-arc-tl {
    width: 120px;
    height: 120px;
    top: -40px;
    left: -24px;
    background: radial-gradient(circle, rgba(249, 171, 0, 0.18), transparent 70%);
  }
  .mp-hero-arc-br {
    width: 140px;
    height: 140px;
    bottom: -60px;
    right: -16px;
    background: radial-gradient(circle, rgba(255, 255, 255, 0.1), transparent 65%);
  }
  .mp-hero-gold-bar {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--mp-amber), var(--mp-amber-soft) 40%, var(--mp-green) 100%);
    z-index: 3;
  }
  .mp-hero-banner-label {
    position: absolute;
    right: 14px;
    top: 50%;
    transform: translateY(-50%);
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 2px;
    z-index: 2;
    max-width: 55%;
    text-shadow: 0 1px 10px rgba(0, 0, 0, 0.35);
    pointer-events: none;
  }
  .mp-hero-banner-brand {
    font-family: var(--mp-display);
    font-size: 0.9rem;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.03em;
  }
  .mp-hero-banner-brand span { color: var(--mp-amber); }
  .mp-hero-banner-tag {
    font-size: 0.62rem;
    font-weight: 600;
    color: rgba(255, 255, 255, 0.78);
    letter-spacing: 0.05em;
    text-transform: uppercase;
  }
  .mp-hero-body { padding: 0 14px 16px; }

  /* ── Identity ── */
  .mp-id-row {
    display: flex;
    gap: 12px;
    align-items: flex-start;
    margin-top: -40px;
    position: relative;
    z-index: 5;
  }
  .mp-avatar-btn {
    position: relative;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    flex-shrink: 0;
    border-radius: 50%;
    transition: transform var(--mp-dur) var(--mp-ease);
  }
  .mp-avatar-btn:hover { transform: translateY(-1px); }
  .mp-avatar-btn:active { transform: scale(0.98); }
  .mp-avatar-ring {
    padding: 3px;
    border-radius: 50%;
    background: linear-gradient(145deg, var(--mp-amber) 0%, var(--mp-green) 55%, var(--mp-green-d) 100%);
    box-shadow:
      0 8px 20px rgba(15, 157, 88, 0.28),
      0 0 0 4px var(--mp-surface);
  }
  .mp-avatar {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--mp-green), var(--mp-green-d));
    display: grid;
    place-items: center;
    overflow: hidden;
    position: relative;
    color: #fff;
    font-family: var(--mp-display);
    font-size: 1.75rem;
    font-weight: 800;
    border: 3px solid #fff;
  }
  .mp-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .mp-avatar-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.42);
    display: grid;
    place-items: center;
  }
  .mp-avatar-cam {
    position: absolute;
    right: 0;
    bottom: 2px;
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--mp-green-d);
    color: #fff;
    font-size: 12px;
    display: grid;
    place-items: center;
    border: 2px solid #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.16);
  }
  .mp-id-main {
    flex: 1;
    min-width: 0;
    margin-top: 46px;
    padding: 0 2px 0 0;
  }
  .mp-id-head {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 10px;
  }
  .mp-id-text { min-width: 0; flex: 1; }
  .mp-name {
    margin: 0 0 6px;
    font-family: var(--mp-display);
    font-size: clamp(1.15rem, 3.5vw, 1.35rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    line-height: 1.25;
    color: var(--mp-ink-soft);
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
    max-width: 100%;
  }
  .mp-name-text {
    color: inherit;
    overflow-wrap: anywhere;
    word-break: break-word;
    min-width: 0;
  }
  .mp-name-seal {
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    line-height: 0;
  }
  .mp-id-badges {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
  }
  .mp-online {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.75rem;
    font-weight: 700;
    background: #f0f6f2;
    border-radius: var(--mp-r-pill);
    padding: 3px 9px;
  }
  .mp-online i {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    display: inline-block;
    box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.8);
  }
  .mp-id-actions {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex-shrink: 0;
  }
  .mp-btn-sm {
    padding: 7px 12px !important;
    font-size: 0.72rem !important;
    border-radius: var(--mp-r-pill) !important;
    white-space: nowrap;
  }

  .mp-trust-strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px 12px;
    margin-top: 10px;
  }
  .mp-trust-hint {
    font-size: 0.68rem;
    color: var(--mp-faint);
    font-weight: 500;
  }

  /* ── Info panel ── */
  .mp-info-panel {
    margin-top: 14px;
    border: 1px solid #e6eee9;
    border-radius: var(--mp-r-lg);
    background: var(--mp-surface-2);
    overflow: hidden;
  }
  .mp-info-section { padding: 12px 12px 4px; }
  .mp-info-section + .mp-info-section {
    border-top: 1px solid var(--mp-line-soft);
    padding-top: 12px;
  }
  .mp-info-heading {
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--mp-subtle);
    margin: 0 2px 8px;
  }
  .mp-info-list {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  .mp-info-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px;
    margin-bottom: 6px;
    background: var(--mp-surface);
    border: 1px solid var(--mp-line-soft);
    border-radius: var(--mp-r-md);
    min-width: 0;
    transition:
      border-color var(--mp-dur) var(--mp-ease),
      box-shadow var(--mp-dur) var(--mp-ease);
  }
  .mp-info-row-btn {
    width: 100%;
    text-align: left;
    cursor: pointer;
    margin-bottom: 10px;
  }
  .mp-info-row-btn:hover {
    border-color: rgba(15, 157, 88, 0.3);
    box-shadow: 0 3px 12px rgba(15, 157, 88, 0.08);
  }
  .mp-info-row-btn.is-empty {
    border-style: dashed;
    border-color: #c5d9cc;
  }
  .mp-info-ic {
    width: 36px;
    height: 36px;
    border-radius: var(--mp-r-sm);
    flex-shrink: 0;
    display: grid;
    place-items: center;
    background: var(--mp-green-l);
    color: var(--mp-green-d);
  }
  .mp-info-ic-shop {
    background: linear-gradient(135deg, var(--mp-green-l), #f0faf4);
    overflow: hidden;
  }
  .mp-info-ic-shop.has-logo {
    background: #fff;
    border: 1px solid var(--mp-line-strong);
    padding: 0;
    width: 40px;
    height: 40px;
    border-radius: 11px;
  }
  .mp-shop-logo {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .mp-info-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mp-info-k {
    font-size: 0.65rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--mp-faint);
  }
  .mp-info-v {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--mp-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mp-info-v.is-miss { color: var(--mp-red-d); font-weight: 650; }
  .mp-info-v-muted {
    font-weight: 600;
    color: var(--mp-muted);
    font-size: 0.8125rem;
  }
  .mp-info-action {
    flex-shrink: 0;
    border: none;
    background: var(--mp-blue-l);
    color: var(--mp-blue);
    font-size: 0.72rem;
    font-weight: 700;
    border-radius: var(--mp-r-pill);
    padding: 6px 12px;
    cursor: pointer;
    transition: background var(--mp-dur) var(--mp-ease);
  }
  .mp-info-action:hover { background: #d9e7fd; }
  .mp-info-chev {
    flex-shrink: 0;
    font-size: 0.75rem;
    font-weight: 700;
    color: var(--mp-green);
  }

  /* ── Completeness ── */
  .mp-complete {
    margin: 4px 12px 12px;
    padding: 12px;
    background: var(--mp-surface);
    border: 1px solid var(--mp-line-soft);
    border-radius: var(--mp-r-md);
  }
  .mp-complete-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 10px;
    margin-bottom: 8px;
  }
  .mp-complete-title {
    display: block;
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--mp-ink);
  }
  .mp-complete-sub {
    display: block;
    font-size: 0.68rem;
    color: var(--mp-faint);
    font-weight: 500;
    margin-top: 1px;
  }
  .mp-complete-pct {
    font-family: var(--mp-display);
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--mp-green);
    letter-spacing: -0.03em;
  }
  .mp-complete-bar {
    height: 8px;
    border-radius: var(--mp-r-pill);
    background: #eef0f0;
    overflow: hidden;
  }
  .mp-complete-fill {
    height: 100%;
    border-radius: var(--mp-r-pill);
    background: linear-gradient(90deg, var(--mp-amber), var(--mp-green) 55%, var(--mp-green-d));
    transition: width 0.4s var(--mp-ease);
  }
  .mp-missing { margin-top: 10px; }
  .mp-missing-label {
    display: block;
    font-size: 0.62rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--mp-faint);
    margin-bottom: 6px;
  }
  .mp-missing-list { display: flex; flex-wrap: wrap; gap: 6px; }
  .mp-missing-chip {
    border: 1px solid var(--mp-red-l);
    background: #fff8f7;
    color: var(--mp-red-d);
    border-radius: var(--mp-r-pill);
    padding: 5px 10px;
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
    transition: background var(--mp-dur) var(--mp-ease), border-color var(--mp-dur) var(--mp-ease);
  }
  .mp-missing-chip:hover {
    background: var(--mp-red-l);
    border-color: #f5c6c2;
  }
  .mp-complete-done {
    margin: 10px 0 0;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--mp-green-d);
  }
  .mp-next-tip {
    width: 100%;
    margin-top: 10px;
    border: 1.5px solid rgba(26, 115, 232, 0.2);
    background: linear-gradient(135deg, #f0f6ff, var(--mp-blue-l));
    border-radius: var(--mp-r-md);
    padding: 10px 12px;
    text-align: left;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    gap: 2px;
    transition: box-shadow var(--mp-dur) var(--mp-ease), border-color var(--mp-dur) var(--mp-ease);
  }
  .mp-next-tip:hover {
    border-color: rgba(26, 115, 232, 0.35);
    box-shadow: 0 4px 14px rgba(26, 115, 232, 0.1);
  }
  .mp-next-tip span {
    font-size: 0.625rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--mp-blue);
  }
  .mp-next-tip strong {
    font-size: 0.8125rem;
    font-weight: 700;
    color: #174ea6;
  }

  /* ── Forms ── */
  .mp-edit-panel { padding-top: 8px; }
  .mp-edit-head { margin-bottom: 4px; }
  .mp-edit-head h3 {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .mp-edit-head p {
    margin: 4px 0 0;
    font-size: 0.75rem;
    color: var(--mp-subtle);
  }
  .mp-edit-form { width: 100%; }
  .mp-label {
    display: block;
    margin: 12px 0 5px;
    font-size: 0.6875rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--mp-subtle);
  }
  .mp-input {
    width: 100%;
    border: 1.5px solid var(--mp-line-strong);
    border-radius: var(--mp-r-md);
    padding: 11px 13px;
    font-size: 0.9375rem;
    background: var(--mp-surface-2);
    color: var(--mp-ink);
    transition:
      border-color var(--mp-dur) var(--mp-ease),
      box-shadow var(--mp-dur) var(--mp-ease),
      background var(--mp-dur) var(--mp-ease);
  }
  .mp-input:hover { border-color: #c5d9cc; }
  .mp-input:focus {
    outline: none;
    border-color: var(--mp-green);
    background: #fff;
    box-shadow: 0 0 0 3px rgba(15, 157, 88, 0.14);
  }
  .mp-field-hint {
    margin: 6px 0 0;
    font-size: 0.72rem;
    color: var(--mp-faint);
    line-height: 1.4;
  }
  .mp-edit-btns {
    display: flex;
    gap: 10px;
    margin-top: 16px;
  }
  .mp-edit-btns .mp-btn-secondary,
  .mp-edit-btns .mp-btn-primary { flex: 1; }
  .mp-save-msg {
    margin: 8px 0 0;
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--mp-green);
  }

  /* ── Badges & buttons ── */
  .mp-badge-verified {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: var(--mp-green-l);
    color: var(--mp-green-d);
    border: 1px solid rgba(15, 157, 88, 0.2);
    border-radius: var(--mp-r-pill);
    padding: 4px 10px;
    font-size: 0.6875rem;
    font-weight: 700;
  }
  .mp-badge-unverified {
    display: inline-flex;
    background: #f1f3f4;
    color: var(--mp-subtle);
    border-radius: var(--mp-r-pill);
    padding: 4px 10px;
    font-size: 0.6875rem;
    font-weight: 600;
  }

  .mp-btn-primary {
    border: none;
    border-radius: var(--mp-r-md);
    background: linear-gradient(135deg, var(--mp-green), var(--mp-green-d));
    color: #fff;
    font-weight: 700;
    font-size: 0.8125rem;
    padding: 10px 16px;
    cursor: pointer;
    box-shadow: var(--mp-shadow-green);
    transition:
      transform var(--mp-dur) var(--mp-ease),
      box-shadow var(--mp-dur) var(--mp-ease),
      filter var(--mp-dur) var(--mp-ease);
  }
  .mp-btn-primary:hover {
    filter: brightness(1.04);
    box-shadow: 0 6px 18px rgba(15, 157, 88, 0.32);
  }
  .mp-btn-primary:active { transform: scale(0.98); }
  .mp-btn-primary:disabled {
    opacity: 0.65;
    cursor: wait;
    filter: none;
    box-shadow: none;
  }
  .mp-btn-secondary {
    border: 1.5px solid var(--mp-line-strong);
    border-radius: var(--mp-r-md);
    background: var(--mp-green-mist);
    color: var(--mp-green-d);
    font-weight: 700;
    font-size: 0.8125rem;
    padding: 9px 14px;
    cursor: pointer;
    transition:
      background var(--mp-dur) var(--mp-ease),
      border-color var(--mp-dur) var(--mp-ease),
      box-shadow var(--mp-dur) var(--mp-ease);
  }
  .mp-btn-secondary:hover {
    background: var(--mp-green-l);
    border-color: rgba(15, 157, 88, 0.28);
    box-shadow: var(--mp-shadow-xs);
  }
  .mp-btn-ghost {
    border: none;
    background: #f1f3f4;
    color: #3c4043;
    border-radius: var(--mp-r-pill);
    padding: 7px 12px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
  }
  .mp-btn-outline {
    border: 1.5px solid var(--mp-line-strong);
    background: #fff;
    color: var(--mp-muted);
    border-radius: var(--mp-r-pill);
    padding: 7px 12px;
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition:
      background var(--mp-dur) var(--mp-ease),
      border-color var(--mp-dur) var(--mp-ease),
      color var(--mp-dur) var(--mp-ease);
  }
  .mp-btn-outline:hover {
    background: #f8f9fa;
    border-color: #dadce0;
  }
  .mp-btn-outline.danger {
    color: var(--mp-red);
    border-color: var(--mp-red-l);
  }
  .mp-btn-outline.danger:hover {
    background: #fff5f4;
    border-color: #f5c6c2;
  }
  .mp-btn-verify {
    border: none;
    border-radius: var(--mp-r-pill);
    background: linear-gradient(135deg, var(--mp-blue), var(--mp-blue-d));
    color: #fff;
    font-weight: 700;
    font-size: 0.75rem;
    padding: 8px 14px;
    cursor: pointer;
    box-shadow: var(--mp-shadow-blue);
    transition: filter var(--mp-dur) var(--mp-ease), transform var(--mp-dur) var(--mp-ease);
  }
  .mp-btn-verify:hover { filter: brightness(1.05); }
  .mp-btn-verify:active { transform: scale(0.98); }
  .mp-btn-danger {
    border: none;
    border-radius: var(--mp-r-md);
    background: var(--mp-red);
    color: #fff;
    font-weight: 700;
    font-size: 0.875rem;
    padding: 11px;
    cursor: pointer;
    flex: 1;
  }
  .mp-link {
    border: none;
    background: none;
    color: var(--mp-green);
    font-weight: 700;
    font-size: 0.8125rem;
    cursor: pointer;
    padding: 0;
    transition: color var(--mp-dur) var(--mp-ease);
  }
  .mp-link:hover {
    color: var(--mp-green-d);
    text-decoration: underline;
    text-underline-offset: 2px;
  }

  /* ── Stats / KPI dashboard ── */
  .mp-stats {
    padding: 12px;
    background: linear-gradient(180deg, #fff 0%, var(--mp-surface-3) 100%);
  }
  .mp-stats-label,
  .mp-status-label {
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--mp-subtle);
    margin: 0 2px 10px;
  }
  .mp-stats-row {
    display: flex;
    overflow: hidden;
    border: 1px solid var(--mp-line);
    border-radius: var(--mp-r-md);
    background: #fff;
  }
  .mp-stat {
    flex: 1;
    border: none;
    background: transparent;
    padding: 12px 4px;
    cursor: pointer;
    border-right: 1px solid var(--mp-line);
    transition: background var(--mp-dur) var(--mp-ease);
    min-width: 0;
  }
  .mp-stat:hover { background: rgba(15, 157, 88, 0.05); }
  .mp-stat:last-child { border-right: none; }
  .mp-stat strong {
    display: block;
    font-family: var(--mp-display);
    font-size: 1.1rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--mp-green-d);
  }
  .mp-stat span {
    font-size: 0.6rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--mp-faint);
  }

  .mp-kpi-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    margin: 12px var(--mp-pad-r) 12px var(--mp-pad-x);
  }
  .mp-kpi {
    border: 1px solid rgba(15, 157, 88, 0.1);
    border-radius: var(--mp-r-lg);
    background:
      linear-gradient(165deg, #fff 0%, var(--mp-surface-2) 100%);
    box-shadow: var(--mp-shadow-sm);
    padding: 14px 14px 12px;
    text-align: left;
    cursor: pointer;
    min-width: 0;
    transition:
      transform var(--mp-dur) var(--mp-ease),
      box-shadow var(--mp-dur) var(--mp-ease),
      border-color var(--mp-dur) var(--mp-ease);
  }
  .mp-kpi:hover {
    transform: translateY(-2px);
    border-color: rgba(15, 157, 88, 0.28);
    box-shadow: var(--mp-shadow-md);
  }
  .mp-kpi:active { transform: translateY(0); }
  .mp-kpi-label {
    display: block;
    font-size: 0.65rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--mp-subtle);
    margin-bottom: 6px;
  }
  .mp-kpi-value {
    display: block;
    font-family: var(--mp-display);
    font-size: 1.55rem;
    font-weight: 800;
    letter-spacing: -0.04em;
    color: var(--mp-green-d);
    line-height: 1.1;
  }
  .mp-kpi-hint {
    display: block;
    margin-top: 4px;
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--mp-faint);
  }
  .mp-dash-panel { padding: 16px; }
  .mp-dash-panel-head { margin-bottom: 2px; }
  .mp-section-lead-tight { margin-bottom: 12px; }

  /* ── Network list (legacy kept) + Phase 10 premium dashboard ── */
  .mp-network-wrap {
    margin: 0 var(--mp-pad-r) 16px var(--mp-pad-x);
    min-width: 0;
  }
  .mp-nd {
    display: flex;
    flex-direction: column;
    gap: 14px;
    animation: mp-fade-in 280ms var(--mp-ease) both;
  }
  .mp-nd-stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .mp-nd-stat {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 14px;
    border-radius: 20px;
    background: var(--mp-surface);
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
    text-align: left;
    font: inherit;
    color: inherit;
    cursor: default;
    transition: transform 160ms var(--mp-ease), box-shadow 160ms var(--mp-ease), border-color 160ms var(--mp-ease);
  }
  button.mp-nd-stat { cursor: pointer; }
  button.mp-nd-stat:hover {
    transform: translateY(-2px);
    border-color: rgba(15, 157, 88, 0.2);
    box-shadow: 0 8px 20px rgba(15, 157, 88, 0.1);
  }
  .mp-nd-stat.is-active {
    border-color: rgba(15, 157, 88, 0.28);
    background: linear-gradient(155deg, rgba(232, 245, 238, 0.9), #fff 60%);
    box-shadow: 0 6px 18px rgba(15, 157, 88, 0.1);
  }
  .mp-nd-stat.is-soft { cursor: default; }
  .mp-nd-stat-ic { font-size: 1.1rem; line-height: 1; margin-bottom: 4px; }
  .mp-nd-stat-n {
    font-family: var(--mp-display);
    font-size: 1.45rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--mp-green-d);
    line-height: 1.05;
  }
  .mp-nd-stat-l {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--mp-muted);
  }

  .mp-nd-tabs {
    display: flex;
    gap: 6px;
    padding: 4px;
    border-radius: 14px;
    background: #eef1ef;
  }
  .mp-nd-tab {
    flex: 1;
    border: none;
    background: transparent;
    border-radius: 11px;
    padding: 10px 12px;
    font-size: 0.82rem;
    font-weight: 750;
    color: var(--mp-muted);
    cursor: pointer;
    transition: background 140ms var(--mp-ease), color 140ms var(--mp-ease), box-shadow 140ms var(--mp-ease);
  }
  .mp-nd-tab em {
    font-style: normal;
    font-size: 0.7rem;
    font-weight: 800;
    margin-left: 4px;
    opacity: 0.75;
  }
  .mp-nd-tab.is-active {
    background: #fff;
    color: var(--mp-green-d);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
  }
  .mp-nd-tab:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 1px;
  }

  .mp-nd-toolbar {
    position: sticky;
    top: calc(var(--mp-topbar-h) + 8px);
    z-index: 20;
    display: grid;
    grid-template-columns: 1fr;
    gap: 8px;
    padding: 12px;
    border-radius: 20px;
    background: rgba(255, 255, 255, 0.95);
    backdrop-filter: blur(14px);
    -webkit-backdrop-filter: blur(14px);
    border: 1px solid rgba(15, 23, 42, 0.07);
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.06);
  }
  .mp-nd-search {
    position: relative;
    display: flex;
    align-items: center;
  }
  .mp-nd-search-ic {
    position: absolute;
    left: 12px;
    color: var(--mp-subtle);
    display: grid;
    place-items: center;
    pointer-events: none;
  }
  .mp-nd-search-input {
    width: 100%;
    border: 1.5px solid rgba(15, 23, 42, 0.08);
    background: #f7f9f8;
    border-radius: 12px;
    padding: 10px 36px 10px 36px;
    font-size: 0.84rem;
    font-weight: 500;
    color: var(--mp-ink);
    outline: none;
  }
  .mp-nd-search-input:focus {
    border-color: rgba(15, 157, 88, 0.45);
    background: #fff;
    box-shadow: 0 0 0 3px rgba(15, 157, 88, 0.12);
  }
  .mp-nd-search-clear {
    position: absolute;
    right: 8px;
    width: 24px;
    height: 24px;
    border: none;
    border-radius: 50%;
    background: rgba(15, 23, 42, 0.06);
    color: var(--mp-muted);
    font-size: 0.65rem;
    cursor: pointer;
    display: grid;
    place-items: center;
  }
  .mp-nd-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }
  .mp-nd-field-label {
    font-size: 0.6rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mp-subtle);
    padding-left: 2px;
  }
  .mp-nd-select {
    width: 100%;
    border: 1.5px solid rgba(15, 23, 42, 0.08);
    background: #fff;
    border-radius: 10px;
    padding: 8px 10px;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--mp-ink);
    cursor: pointer;
    outline: none;
  }
  .mp-nd-select:focus {
    border-color: rgba(15, 157, 88, 0.4);
    box-shadow: 0 0 0 3px rgba(15, 157, 88, 0.1);
  }
  .mp-nd-meta { padding: 0 4px; }
  .mp-nd-count {
    margin: 0;
    font-size: 0.78rem;
    color: var(--mp-muted);
    font-weight: 500;
  }

  .mp-nd-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
  }
  .mp-nd-card {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-radius: 20px;
    background: var(--mp-surface);
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.03),
      0 8px 22px rgba(15, 23, 42, 0.05);
    transition: transform 160ms var(--mp-ease), box-shadow 160ms var(--mp-ease), border-color 160ms var(--mp-ease);
  }
  .mp-nd-card:hover {
    transform: translateY(-2px);
    border-color: rgba(15, 157, 88, 0.16);
    box-shadow: 0 12px 28px rgba(15, 157, 88, 0.1);
  }
  .mp-nd-card.is-mutual {
    border-color: rgba(15, 157, 88, 0.14);
  }
  .mp-nd-card-top {
    display: flex;
    align-items: flex-start;
    gap: 12px;
  }
  .mp-nd-avatar-btn {
    position: relative;
    border: none;
    background: none;
    padding: 0;
    cursor: pointer;
    flex-shrink: 0;
  }
  .mp-nd-avatar {
    width: 64px;
    height: 64px;
    border-radius: 50%;
    overflow: hidden;
    display: grid;
    place-items: center;
    font-size: 1.15rem;
    font-weight: 800;
    color: #fff;
    box-shadow:
      0 0 0 3px #fff,
      0 4px 14px rgba(15, 23, 42, 0.12);
  }
  .mp-nd-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .mp-nd-avatar--green {
    background: linear-gradient(145deg, var(--mp-green), var(--mp-green-d));
  }
  .mp-nd-avatar--amber {
    background: linear-gradient(145deg, #e65100, #f9a825);
  }
  .mp-nd-online-dot {
    position: absolute;
    right: 2px;
    bottom: 2px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: #9ca3af;
    border: 2px solid #fff;
  }
  .mp-nd-online-dot.is-live {
    background: #15803d;
    box-shadow: 0 0 0 3px rgba(21, 128, 61, 0.2);
  }
  .mp-nd-card-id { flex: 1; min-width: 0; }
  .mp-nd-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .mp-nd-name {
    border: none;
    background: none;
    padding: 0;
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--mp-ink);
    cursor: pointer;
    text-align: left;
    letter-spacing: -0.01em;
  }
  .mp-nd-name:hover { color: var(--mp-green-d); }
  .mp-nd-card-meta {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 2px;
    font-size: 0.72rem;
    color: var(--mp-muted);
    font-weight: 500;
  }
  .mp-nd-online-txt { font-weight: 700; }
  .mp-nd-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .mp-nd-pill {
    font-size: 0.62rem;
    font-weight: 800;
    border-radius: 999px;
    padding: 3px 8px;
    background: #f1f3f2;
    color: var(--mp-muted);
  }
  .mp-nd-pill.is-mutual,
  .mp-nd-pill.is-ok {
    background: rgba(15, 157, 88, 0.12);
    color: var(--mp-green-d);
  }
  .mp-nd-pill.is-soft {
    background: #f3f5f4;
    color: var(--mp-subtle);
  }
  .mp-nd-duration {
    margin: 8px 0 0;
    font-size: 0.72rem;
    color: var(--mp-faint);
    font-weight: 500;
  }

  .mp-nd-card-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    padding-top: 4px;
    border-top: 1px solid rgba(15, 23, 42, 0.05);
  }
  .mp-nd-icon-btn {
    min-height: 40px;
    min-width: 40px;
    padding: 0 10px;
    border-radius: 12px;
    border: 1.5px solid rgba(15, 23, 42, 0.08);
    background: #fff;
    color: var(--mp-muted);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    cursor: pointer;
    font-size: 0.72rem;
    font-weight: 700;
    transition: background 140ms var(--mp-ease), border-color 140ms var(--mp-ease), color 140ms var(--mp-ease), transform 100ms var(--mp-ease);
  }
  .mp-nd-icon-btn:hover:not(:disabled) {
    background: var(--mp-green-mist);
    border-color: rgba(15, 157, 88, 0.22);
    color: var(--mp-green-d);
  }
  .mp-nd-icon-btn:active:not(:disabled) { transform: scale(0.96); }
  .mp-nd-icon-btn:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 1px;
  }
  .mp-nd-icon-btn.is-primary {
    background: linear-gradient(135deg, var(--mp-green), var(--mp-green-d));
    border-color: transparent;
    color: #fff;
    box-shadow: 0 4px 12px rgba(15, 157, 88, 0.25);
  }
  .mp-nd-icon-btn.is-primary:hover:not(:disabled) {
    color: #fff;
    filter: brightness(1.04);
    background: linear-gradient(135deg, var(--mp-green), var(--mp-green-d));
  }
  .mp-nd-icon-btn.is-danger:hover:not(:disabled) {
    background: #fff5f4;
    border-color: #f5c6c2;
    color: var(--mp-red);
  }
  .mp-nd-icon-btn.is-future:disabled,
  .mp-nd-icon-btn:disabled {
    opacity: 0.42;
    cursor: not-allowed;
    background: #f5f6f6;
  }
  .mp-nd-icon-txt { display: none; }
  .mp-nd-action-divider {
    width: 1px;
    height: 22px;
    background: rgba(15, 23, 42, 0.08);
    margin: 0 2px;
  }
  .mp-nd-btn-spin {
    width: 14px;
    height: 14px;
    border: 2px solid rgba(15, 23, 42, 0.15);
    border-top-color: var(--mp-green);
    border-radius: 50%;
    animation: mp-spin 0.7s linear infinite;
  }

  .mp-nd-empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    padding: 40px 20px;
    border-radius: 20px;
    background: linear-gradient(165deg, rgba(232, 245, 238, 0.45), #fff 55%);
    border: 1px dashed rgba(15, 157, 88, 0.25);
    box-shadow: 0 4px 16px rgba(15, 157, 88, 0.05);
  }
  .mp-nd-empty-art {
    position: relative;
    width: 88px;
    height: 88px;
    display: grid;
    place-items: center;
  }
  .mp-nd-empty-blob {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle at 40% 40%, rgba(15, 157, 88, 0.18), transparent 68%);
  }
  .mp-nd-empty-emoji { position: relative; z-index: 1; font-size: 2.3rem; }
  .mp-nd-empty h3 {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1.15rem;
    font-weight: 800;
    color: var(--mp-ink);
  }
  .mp-nd-empty p {
    margin: 0;
    max-width: 360px;
    font-size: 0.85rem;
    color: var(--mp-muted);
    line-height: 1.45;
  }
  .mp-nd-empty-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 6px;
  }

  .mp-nd-suggest {
    margin-top: 4px;
    padding: 16px;
    border-radius: 20px;
    background: var(--mp-surface);
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
  }
  .mp-nd-suggest-title {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1rem;
    font-weight: 800;
    color: var(--mp-ink);
  }
  .mp-nd-suggest-sub {
    margin: 4px 0 0;
    font-size: 0.75rem;
    color: var(--mp-faint);
  }
  .mp-nd-suggest-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
    margin-top: 12px;
  }
  .mp-nd-suggest-card {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    padding: 16px 12px;
    border-radius: 16px;
    background: #f7f9f8;
    border: 1px dashed rgba(15, 23, 42, 0.1);
    text-align: center;
  }
  .mp-nd-suggest-card.is-placeholder { opacity: 0.85; }
  .mp-nd-suggest-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: #e8ece9;
    color: var(--mp-subtle);
    font-weight: 800;
  }
  .mp-nd-suggest-card strong {
    font-size: 0.82rem;
    color: var(--mp-ink);
  }
  .mp-nd-suggest-card span {
    font-size: 0.7rem;
    color: var(--mp-faint);
  }

  .mp-nd-toast {
    position: fixed;
    left: 50%;
    bottom: calc(var(--mp-pnav-mob-h, 56px) + var(--mp-app-nav-h, 62px) + 20px);
    transform: translateX(-50%);
    z-index: 60;
    background: rgba(15, 23, 42, 0.92);
    color: #fff;
    font-size: 0.8rem;
    font-weight: 700;
    padding: 10px 16px;
    border-radius: 999px;
    box-shadow: 0 8px 24px rgba(15, 23, 42, 0.25);
    animation: mp-fade-in 160ms var(--mp-ease) both;
  }

  .mp-nd-skel-card,
  .mp-nd-skel-toolbar {
    border-radius: 20px;
    background: linear-gradient(90deg, #eef1ef 0%, #f7f8f7 45%, #eef1ef 100%);
    background-size: 200% 100%;
    animation: mp-od-shimmer 1.2s ease-in-out infinite;
  }
  .mp-nd-skel-card { height: 88px; }
  .mp-nd-skel-person { height: 160px; }
  .mp-nd-skel-toolbar { height: 96px; }

  @media (min-width: 480px) {
    .mp-nd-toolbar {
      grid-template-columns: 1fr 1fr;
    }
    .mp-nd-search { grid-column: 1 / -1; }
    .mp-nd-grid { grid-template-columns: 1fr 1fr; }
    .mp-nd-icon-txt { display: inline; }
    .mp-nd-suggest-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  @media (min-width: 768px) {
    .mp-network-wrap { margin-left: 0; margin-right: 0; }
    .mp-nd-toolbar {
      top: calc(var(--mp-topbar-h) + 12px);
      grid-template-columns: minmax(0, 1.4fr) minmax(120px, 0.5fr) minmax(120px, 0.5fr);
      align-items: end;
    }
    .mp-nd-search { grid-column: auto; }
    .mp-nd-grid { grid-template-columns: 1fr 1fr; gap: 14px; }
  }
  @media (min-width: 1100px) {
    .mp-nd-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (min-width: 1280px) {
    .mp-nd-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PHASE 11 — Premium Buying & Discover dashboard
     ═══════════════════════════════════════════════════════════════════════ */
  .mp-buy {
    display: flex;
    flex-direction: column;
    gap: 16px;
    margin: 0 var(--mp-pad-r) 16px var(--mp-pad-x);
    animation: mp-fade-in 280ms var(--mp-ease) both;
  }
  .mp-buy-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .mp-buy-section-title {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1.05rem;
    font-weight: 800;
    letter-spacing: -0.02em;
    color: var(--mp-ink);
  }
  .mp-buy-section-sub {
    margin: 4px 0 0;
    font-size: 0.78rem;
    color: var(--mp-muted);
    font-weight: 500;
    line-height: 1.4;
  }

  .mp-buy-hero {
    display: flex;
    flex-direction: column;
    gap: 14px;
    padding: 20px;
    border-radius: 20px;
    background:
      linear-gradient(145deg, rgba(232, 245, 238, 0.92) 0%, #fff 48%, #fff 100%);
    border: 1px solid rgba(15, 157, 88, 0.12);
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.04),
      0 12px 32px rgba(15, 157, 88, 0.07);
  }
  .mp-buy-kicker {
    margin: 0 0 6px;
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--mp-green-d);
  }
  .mp-buy-hello {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1.3rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--mp-ink);
    line-height: 1.2;
  }
  .mp-buy-lead {
    margin: 8px 0 0;
    font-size: 0.82rem;
    color: var(--mp-muted);
    line-height: 1.45;
  }
  .mp-buy-hero-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .mp-buy-stats {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
  }
  .mp-buy-stat {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 14px;
    border-radius: 20px;
    background: var(--mp-surface);
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
    text-align: left;
    font: inherit;
    color: inherit;
    cursor: default;
    transition: transform 160ms var(--mp-ease), box-shadow 160ms var(--mp-ease), border-color 160ms var(--mp-ease);
  }
  button.mp-buy-stat { cursor: pointer; }
  button.mp-buy-stat:hover {
    transform: translateY(-2px);
    border-color: rgba(15, 157, 88, 0.2);
    box-shadow: 0 10px 24px rgba(15, 157, 88, 0.1);
  }
  button.mp-buy-stat:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
  }
  .mp-buy-stat.is-placeholder {
    background: linear-gradient(160deg, #f7f9f8, #fff);
  }
  .mp-buy-stat-ic { font-size: 1.1rem; line-height: 1; margin-bottom: 4px; }
  .mp-buy-stat-n {
    font-family: var(--mp-display);
    font-size: 1.4rem;
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--mp-green-d);
    line-height: 1.05;
  }
  .mp-buy-stat-l {
    font-size: 0.7rem;
    font-weight: 700;
    color: var(--mp-muted);
  }
  .mp-buy-stat-soon {
    position: absolute;
    top: 10px;
    right: 10px;
    font-style: normal;
    font-size: 0.58rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--mp-subtle);
    background: #eef0f0;
    border-radius: 999px;
    padding: 2px 7px;
  }

  .mp-buy-dest-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .mp-buy-dest {
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px 16px;
    border-radius: 20px;
    background: var(--mp-surface);
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
    text-align: left;
    font: inherit;
    color: inherit;
    cursor: pointer;
    transition:
      transform 160ms var(--mp-ease),
      box-shadow 160ms var(--mp-ease),
      border-color 160ms var(--mp-ease),
      background 160ms var(--mp-ease);
  }
  .mp-buy-dest:hover {
    transform: translateY(-2px);
    border-color: rgba(15, 157, 88, 0.2);
    box-shadow: 0 12px 28px rgba(15, 157, 88, 0.1);
    background: #fbfffc;
  }
  .mp-buy-dest:active { transform: scale(0.99); }
  .mp-buy-dest:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
  }
  .mp-buy-dest-ic {
    width: 48px;
    height: 48px;
    border-radius: 14px;
    flex-shrink: 0;
    display: grid;
    place-items: center;
    font-size: 1.35rem;
    background: var(--mp-green-l);
    border: 1px solid rgba(15, 157, 88, 0.1);
    transition: transform 160ms var(--mp-ease);
  }
  .mp-buy-dest:hover .mp-buy-dest-ic { transform: scale(1.06); }
  .mp-buy-dest--amber .mp-buy-dest-ic {
    background: rgba(249, 171, 0, 0.16);
    border-color: rgba(217, 119, 6, 0.12);
  }
  .mp-buy-dest--blue .mp-buy-dest-ic {
    background: rgba(26, 115, 232, 0.12);
    border-color: rgba(26, 115, 232, 0.12);
  }
  .mp-buy-dest--red .mp-buy-dest-ic {
    background: rgba(239, 68, 68, 0.1);
    border-color: rgba(239, 68, 68, 0.12);
  }
  .mp-buy-dest-copy {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mp-buy-dest-label {
    font-size: 0.92rem;
    font-weight: 800;
    color: var(--mp-ink);
    letter-spacing: -0.01em;
  }
  .mp-buy-dest-sub {
    font-size: 0.72rem;
    color: var(--mp-faint);
    font-weight: 500;
    line-height: 1.35;
  }
  .mp-buy-dest-badge {
    font-style: normal;
    font-size: 0.68rem;
    font-weight: 800;
    min-width: 22px;
    height: 22px;
    padding: 0 7px;
    border-radius: 999px;
    background: var(--mp-green);
    color: #fff;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  .mp-buy-dest-arrow {
    color: #c5cdd0;
    font-size: 1.05rem;
    font-weight: 600;
    transition: color 160ms var(--mp-ease), transform 160ms var(--mp-ease);
  }
  .mp-buy-dest:hover .mp-buy-dest-arrow {
    color: var(--mp-green);
    transform: translateX(3px);
  }

  .mp-buy-continue-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .mp-buy-continue {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 14px;
    border-radius: 20px;
    background: var(--mp-surface);
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
    text-align: left;
    font: inherit;
    color: inherit;
    cursor: pointer;
    transition: transform 160ms var(--mp-ease), box-shadow 160ms var(--mp-ease), border-color 160ms var(--mp-ease);
  }
  .mp-buy-continue:hover {
    transform: translateY(-2px);
    border-color: rgba(15, 157, 88, 0.18);
    box-shadow: 0 10px 24px rgba(15, 157, 88, 0.09);
  }
  .mp-buy-continue.is-hot {
    border-color: rgba(15, 157, 88, 0.28);
    background: linear-gradient(155deg, rgba(232, 245, 238, 0.65), #fff 70%);
  }
  .mp-buy-continue:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
  }
  .mp-buy-continue-ic {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: #f3f5f4;
    font-size: 1.15rem;
    flex-shrink: 0;
  }
  .mp-buy-continue-copy {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mp-buy-continue-copy strong {
    font-size: 0.86rem;
    font-weight: 750;
    color: var(--mp-ink);
  }
  .mp-buy-continue-copy span {
    font-size: 0.72rem;
    color: var(--mp-faint);
    font-weight: 500;
  }
  .mp-buy-continue-hot {
    font-style: normal;
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--mp-green-d);
    background: rgba(15, 157, 88, 0.12);
    border-radius: 999px;
    padding: 3px 8px;
    flex-shrink: 0;
  }

  .mp-buy-reco-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .mp-buy-reco {
    border-radius: 20px;
    background: var(--mp-surface);
    border: 1px solid rgba(15, 23, 42, 0.06);
    overflow: hidden;
    box-shadow: 0 2px 8px rgba(15, 23, 42, 0.03);
  }
  .mp-buy-reco.is-placeholder { opacity: 0.9; }
  .mp-buy-reco-media {
    aspect-ratio: 4 / 3;
    display: grid;
    place-items: center;
    background: linear-gradient(145deg, #eef2ef, #e4e9e6);
    font-size: 1.75rem;
  }
  .mp-buy-reco-body {
    padding: 10px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mp-buy-reco-body strong {
    font-size: 0.8rem;
    font-weight: 750;
    color: var(--mp-ink);
  }
  .mp-buy-reco-body span {
    font-size: 0.68rem;
    color: var(--mp-faint);
  }
  .mp-buy-reco-body em {
    font-style: normal;
    font-size: 0.78rem;
    font-weight: 800;
    color: var(--mp-green-d);
    margin-top: 4px;
  }

  .mp-buy-cats {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .mp-buy-cat {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1.5px solid rgba(15, 23, 42, 0.08);
    background: var(--mp-surface);
    border-radius: 999px;
    padding: 9px 14px;
    font-size: 0.78rem;
    font-weight: 700;
    color: var(--mp-ink);
    cursor: pointer;
    box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
    transition:
      background 140ms var(--mp-ease),
      border-color 140ms var(--mp-ease),
      transform 100ms var(--mp-ease),
      box-shadow 140ms var(--mp-ease);
  }
  .mp-buy-cat:hover {
    background: var(--mp-green-mist);
    border-color: rgba(15, 157, 88, 0.25);
    box-shadow: 0 4px 12px rgba(15, 157, 88, 0.1);
    transform: translateY(-1px);
  }
  .mp-buy-cat:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
  }

  .mp-buy-recent-empty,
  .mp-buy-kickstart-inner {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 10px;
    padding: 32px 20px;
    border-radius: 20px;
    background: linear-gradient(165deg, rgba(232, 245, 238, 0.4), #fff 55%);
    border: 1px dashed rgba(15, 157, 88, 0.24);
    box-shadow: 0 4px 16px rgba(15, 157, 88, 0.05);
  }
  .mp-buy-recent-empty h4,
  .mp-buy-kickstart-inner h3 {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1.1rem;
    font-weight: 800;
    color: var(--mp-ink);
  }
  .mp-buy-recent-empty p,
  .mp-buy-kickstart-inner p {
    margin: 0;
    max-width: 400px;
    font-size: 0.84rem;
    color: var(--mp-muted);
    line-height: 1.45;
  }
  .mp-buy-empty-art {
    position: relative;
    width: 80px;
    height: 80px;
    display: grid;
    place-items: center;
  }
  .mp-buy-empty-blob {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle at 40% 40%, rgba(15, 157, 88, 0.18), transparent 68%);
  }
  .mp-buy-empty-emoji { position: relative; z-index: 1; font-size: 2.1rem; }
  .mp-buy-empty-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    justify-content: center;
    margin-top: 4px;
  }

  .mp-buy-skel {
    border-radius: 20px;
    background: linear-gradient(90deg, #eef1ef 0%, #f7f8f7 45%, #eef1ef 100%);
    background-size: 200% 100%;
    animation: mp-od-shimmer 1.2s ease-in-out infinite;
  }
  .mp-buy-skel-stat { height: 88px; }

  @media (min-width: 480px) {
    .mp-buy-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); }
    .mp-buy-dest-grid { grid-template-columns: 1fr 1fr; }
    .mp-buy-continue-grid { grid-template-columns: 1fr 1fr; }
  }
  @media (min-width: 768px) {
    .mp-buy { margin-left: 0; margin-right: 0; gap: 18px; }
    .mp-buy-hero {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
      padding: 24px;
    }
    .mp-buy-hello { font-size: 1.45rem; }
    .mp-buy-stats { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 12px; }
    .mp-buy-dest-grid { grid-template-columns: 1fr 1fr; gap: 12px; }
    .mp-buy-continue-grid { grid-template-columns: 1fr 1fr; }
    .mp-buy-reco-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
  @media (min-width: 1100px) {
    .mp-buy-stats { grid-template-columns: repeat(6, minmax(0, 1fr)); }
    .mp-buy-dest-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .mp-buy-continue-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  @media (min-width: 1280px) {
    .mp-buy-dest-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); }
  }
  @media (max-width: 380px) {
    .mp-buy-reco-grid { grid-template-columns: 1fr; }
  }

  /* ═══════════════════════════════════════════════════════════════════════
     PHASE 12 — Account & Security Center (CSS polish pass)
     ═══════════════════════════════════════════════════════════════════════ */
  .mp-ac {
    --ac-pad: 16px;
    --ac-gap: 16px;
    --ac-radius: 20px;
    --ac-radius-sm: 14px;
    --ac-line: rgba(15, 23, 42, 0.055);
    --ac-shadow:
      0 1px 2px rgba(15, 23, 42, 0.035),
      0 10px 28px rgba(15, 23, 42, 0.045);
    --ac-shadow-hover:
      0 4px 12px rgba(15, 23, 42, 0.05),
      0 16px 36px rgba(15, 157, 88, 0.1);
    display: flex;
    flex-direction: column;
    gap: var(--ac-gap);
    margin: 0 var(--mp-pad-r) 16px var(--mp-pad-x);
    animation: mp-fade-in 280ms var(--mp-ease) both;
  }
  .mp-ac.is-nav-focus { outline: none; }

  .mp-ac-hero {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 16px;
    padding: 20px;
    border-radius: var(--ac-radius);
    overflow: hidden;
    isolation: isolate;
    background:
      radial-gradient(ellipse 70% 90% at 100% 0%, rgba(15, 157, 88, 0.1), transparent 55%),
      radial-gradient(ellipse 50% 60% at 0% 100%, rgba(249, 171, 0, 0.07), transparent 50%),
      linear-gradient(155deg, #f3fbf6 0%, #ffffff 42%, #ffffff 100%);
    border: 1px solid rgba(15, 157, 88, 0.14);
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.04),
      0 14px 36px rgba(15, 157, 88, 0.08);
  }
  .mp-ac-hero::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 3px;
    background: linear-gradient(90deg, var(--mp-amber), var(--mp-green) 45%, var(--mp-green-d));
    z-index: 1;
  }
  .mp-ac-hero-main { position: relative; z-index: 1; min-width: 0; }
  .mp-ac-kicker {
    margin: 0 0 8px;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 9px;
    border-radius: 999px;
    background: rgba(15, 157, 88, 0.1);
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.07em;
    text-transform: uppercase;
    color: var(--mp-green-d);
  }
  .mp-ac-title {
    margin: 0;
    font-family: var(--mp-display);
    font-size: clamp(1.2rem, 2.4vw, 1.45rem);
    font-weight: 800;
    letter-spacing: -0.03em;
    color: var(--mp-ink);
    line-height: 1.18;
  }
  .mp-ac-lead {
    margin: 8px 0 0;
    font-size: 0.84rem;
    color: var(--mp-muted);
    line-height: 1.5;
    max-width: 36rem;
    font-weight: 500;
  }
  .mp-ac-hero-pills {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 16px;
  }
  .mp-ac-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 12px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.94);
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 2px 8px rgba(15, 23, 42, 0.03);
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--mp-ink);
    backdrop-filter: blur(8px);
  }
  .mp-ac-pill .mp-icon { opacity: 0.9; }
  .mp-ac-pill.is-ok {
    background: rgba(15, 157, 88, 0.11);
    border-color: rgba(15, 157, 88, 0.22);
    color: var(--mp-green-d);
  }
  .mp-ac-pill.is-warn {
    background: rgba(249, 171, 0, 0.13);
    border-color: rgba(217, 119, 6, 0.2);
    color: #b45309;
  }
  .mp-ac-hero-side {
    position: relative;
    z-index: 1;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    padding: 14px;
    border-radius: var(--ac-radius-sm);
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(15, 23, 42, 0.05);
    box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
  }
  .mp-ac-hero-email {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border-radius: 12px;
    background: #f7faf8;
    border: 1px solid var(--ac-line);
    font-size: 0.8rem;
    font-weight: 600;
    color: var(--mp-muted);
    min-width: 0;
  }
  .mp-ac-hero-email .mp-icon { color: var(--mp-green-d); flex-shrink: 0; }
  .mp-ac-hero-email span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mp-ac-signout-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    width: 100%;
    border: 1.5px solid rgba(239, 68, 68, 0.26);
    background: linear-gradient(180deg, #fff 0%, #fffafa 100%);
    color: #b91c1c;
    border-radius: 12px;
    padding: 11px 14px;
    font-size: 0.82rem;
    font-weight: 750;
    cursor: pointer;
    transition:
      background 140ms var(--mp-ease),
      box-shadow 140ms var(--mp-ease),
      border-color 140ms var(--mp-ease),
      transform 100ms var(--mp-ease);
  }
  .mp-ac-signout-btn:hover {
    background: #fff5f4;
    border-color: rgba(239, 68, 68, 0.4);
    box-shadow: 0 4px 16px rgba(239, 68, 68, 0.12);
  }
  .mp-ac-signout-btn:focus-visible {
    outline: 2px solid #ef4444;
    outline-offset: 2px;
  }
  .mp-ac-signout-btn:active { transform: scale(0.985); }

  .mp-ac-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: 12px;
    align-items: start;
  }
  .mp-ac-card {
    position: relative;
    background: var(--mp-surface);
    border: 1px solid var(--ac-line);
    border-radius: var(--ac-radius);
    padding: var(--ac-pad);
    box-shadow: var(--ac-shadow);
    transition:
      box-shadow 180ms var(--mp-ease),
      border-color 180ms var(--mp-ease),
      transform 180ms var(--mp-ease);
    min-width: 0;
    overflow: hidden;
  }
  .mp-ac-card::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent, rgba(15, 157, 88, 0.35), transparent);
    opacity: 0;
    transition: opacity 180ms var(--mp-ease);
  }
  .mp-ac-card:hover {
    box-shadow: var(--ac-shadow-hover);
    border-color: rgba(15, 157, 88, 0.16);
    transform: translateY(-1px);
  }
  .mp-ac-card:hover::before { opacity: 1; }
  .mp-ac-card-trust {
    background:
      radial-gradient(ellipse 80% 50% at 100% 0%, rgba(15, 157, 88, 0.08), transparent 50%),
      linear-gradient(165deg, rgba(243, 251, 246, 0.95) 0%, #fff 48%);
    border-color: rgba(15, 157, 88, 0.12);
  }
  .mp-ac-card-danger {
    border-color: rgba(239, 68, 68, 0.14);
    background:
      radial-gradient(ellipse 70% 50% at 0% 0%, rgba(239, 68, 68, 0.05), transparent 50%),
      linear-gradient(165deg, #fff9f9 0%, #fff 50%);
  }
  .mp-ac-card-danger::before {
    background: linear-gradient(90deg, transparent, rgba(239, 68, 68, 0.35), transparent);
  }
  .mp-ac-card-danger:hover {
    border-color: rgba(239, 68, 68, 0.24);
    box-shadow:
      0 4px 12px rgba(15, 23, 42, 0.04),
      0 14px 32px rgba(239, 68, 68, 0.08);
  }
  .mp-ac-card-head {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    margin: -4px 0 14px;
    padding: 0 0 14px;
    border-bottom: 1px solid var(--ac-line);
  }
  .mp-ac-card-head-text { flex: 1; min-width: 0; }
  .mp-ac-card-ic {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    background: linear-gradient(160deg, #e8f6ee, #dcefe4);
    border: 1px solid rgba(15, 157, 88, 0.14);
    color: var(--mp-green-d);
    flex-shrink: 0;
    box-shadow: 0 2px 6px rgba(15, 157, 88, 0.08);
  }
  .mp-ac-card-ic.is-danger {
    background: linear-gradient(160deg, #fff1f0, #ffe8e6);
    border-color: rgba(239, 68, 68, 0.16);
    color: #b91c1c;
    box-shadow: 0 2px 6px rgba(239, 68, 68, 0.08);
  }
  .mp-ac-card-title {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 0.98rem;
    font-weight: 800;
    color: var(--mp-ink);
    letter-spacing: -0.015em;
    line-height: 1.25;
  }
  .mp-ac-card-sub {
    margin: 3px 0 0;
    font-size: 0.73rem;
    color: var(--mp-faint);
    font-weight: 500;
    line-height: 1.35;
  }
  .mp-ac-live-badge {
    font-size: 0.6rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    border-radius: 999px;
    padding: 5px 10px;
    background: #f0f2f1;
    color: var(--mp-subtle);
    flex-shrink: 0;
    border: 1px solid rgba(15, 23, 42, 0.05);
  }
  .mp-ac-live-badge.is-on {
    background: rgba(15, 157, 88, 0.12);
    color: var(--mp-green-d);
    border-color: rgba(15, 157, 88, 0.16);
  }

  .mp-ac-rows {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .mp-ac-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 10px;
    border-radius: 12px;
    border: 1px solid transparent;
    transition:
      background 140ms var(--mp-ease),
      border-color 140ms var(--mp-ease);
    min-width: 0;
  }
  .mp-ac-row:hover {
    background: rgba(15, 157, 88, 0.04);
    border-color: rgba(15, 157, 88, 0.06);
  }
  .mp-ac-row.is-placeholder {
    background: #fafbfa;
    border-color: rgba(15, 23, 42, 0.03);
  }
  .mp-ac-row.is-placeholder:hover {
    background: #f7f8f7;
  }
  .mp-ac-row-ic {
    width: 36px;
    height: 36px;
    border-radius: 11px;
    display: grid;
    place-items: center;
    background: #f4f6f5;
    color: var(--mp-green-d);
    flex-shrink: 0;
    border: 1px solid rgba(15, 23, 42, 0.04);
  }
  .mp-ac-row.is-placeholder .mp-ac-row-ic {
    color: var(--mp-subtle);
    background: #eef0ef;
  }
  .mp-ac-row-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .mp-ac-row-k {
    font-size: 0.6rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--mp-subtle);
  }
  .mp-ac-row-v {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--mp-ink);
    word-break: break-word;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 8px;
    line-height: 1.3;
  }
  .mp-ac-row-v.is-ok { color: var(--mp-green-d); }
  .mp-ac-row-v.is-warn { color: #d97706; }
  .mp-ac-status-dot {
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 3px 8px;
    border-radius: 999px;
    background: rgba(217, 119, 6, 0.12);
    color: #b45309;
  }
  .mp-ac-status-dot.is-ok {
    background: rgba(15, 157, 88, 0.12);
    color: var(--mp-green-d);
  }
  .mp-ac-mini-bar {
    display: block;
    width: 100%;
    max-width: 200px;
    height: 6px;
    border-radius: 999px;
    background: #eef0f0;
    overflow: hidden;
    margin-top: 6px;
    box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
  }
  .mp-ac-mini-bar i {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, var(--mp-amber), var(--mp-green) 55%, var(--mp-green-d));
    box-shadow: 0 0 8px rgba(15, 157, 88, 0.25);
  }
  .mp-ac-row-action {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    border: 1px solid transparent;
    background: rgba(15, 157, 88, 0.06);
    color: var(--mp-green-d);
    font-size: 0.74rem;
    font-weight: 750;
    cursor: pointer;
    padding: 6px 10px;
    border-radius: 999px;
    flex-shrink: 0;
    transition: background 140ms var(--mp-ease), border-color 140ms var(--mp-ease);
  }
  .mp-ac-row-action:hover {
    background: rgba(15, 157, 88, 0.12);
    border-color: rgba(15, 157, 88, 0.15);
  }
  .mp-ac-row-action:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
  }
  .mp-ac-copy {
    border: 1.5px solid rgba(15, 23, 42, 0.09);
    background: #fff;
    border-radius: 999px;
    padding: 6px 12px;
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--mp-muted);
    cursor: pointer;
    flex-shrink: 0;
    transition: all 140ms var(--mp-ease);
  }
  .mp-ac-copy:hover {
    border-color: rgba(15, 157, 88, 0.3);
    color: var(--mp-green-d);
    background: var(--mp-green-mist);
  }
  .mp-ac-copy:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
  }
  .mp-ac-soon {
    font-style: normal;
    font-size: 0.58rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--mp-subtle);
    background: #eef0f0;
    border: 1px solid rgba(15, 23, 42, 0.04);
    border-radius: 999px;
    padding: 3px 8px;
    flex-shrink: 0;
    white-space: nowrap;
  }
  .mp-ac-btn-disabled {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1.5px solid rgba(15, 23, 42, 0.07);
    background: #f4f5f5;
    color: #9aa3a0;
    border-radius: 999px;
    padding: 7px 12px;
    font-size: 0.7rem;
    font-weight: 700;
    cursor: not-allowed;
    opacity: 0.85;
    flex-shrink: 0;
  }
  .mp-ac-link-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 1.5px solid rgba(15, 157, 88, 0.22);
    background: #f4fbf6;
    color: var(--mp-green-d, #0a7a44);
    border-radius: 999px;
    padding: 7px 12px;
    font-size: 0.7rem;
    font-weight: 700;
    cursor: pointer;
    flex-shrink: 0;
  }
  .mp-ac-link-btn:hover {
    background: #e8f5ee;
    border-color: rgba(15, 157, 88, 0.4);
  }

  /* Connected devices list */
  .mp-ac-devices {
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--ac-line);
  }
  .mp-ac-devices-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    margin-bottom: 10px;
  }
  .mp-ac-devices-title {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 0.78rem;
    font-weight: 800;
    color: var(--mp-ink);
    letter-spacing: -0.01em;
  }
  .mp-ac-devices-count {
    font-size: 0.68rem;
    font-weight: 700;
    color: var(--mp-muted);
    background: var(--mp-surface, #f4f8f5);
    border: 1px solid var(--ac-line);
    border-radius: 999px;
    padding: 3px 9px;
  }
  .mp-ac-device-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mp-ac-device {
    display: flex;
    align-items: center;
    gap: 11px;
    padding: 10px 10px;
    border-radius: 12px;
    border: 1.5px solid rgba(15, 23, 42, 0.06);
    background: #fff;
    transition: border-color 0.15s, background 0.15s;
  }
  .mp-ac-device.is-current {
    border-color: rgba(15, 157, 88, 0.28);
    background: linear-gradient(165deg, #f3fbf6 0%, #fff 70%);
  }
  .mp-ac-device-ic {
    flex-shrink: 0;
    width: 40px;
    height: 40px;
    border-radius: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--mp-green-d, #0d4a2c);
    background: linear-gradient(145deg, #e6f7ee, #d4efe0);
    border: 1px solid rgba(15, 157, 88, 0.12);
  }
  .mp-ac-device.is-current .mp-ac-device-ic {
    color: #fff;
    background: linear-gradient(145deg, #22a05e, #0d4a2c);
    border-color: transparent;
  }
  .mp-ac-device-meta {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .mp-ac-device-name {
    font-size: 0.84rem;
    font-weight: 800;
    color: var(--mp-ink);
    letter-spacing: -0.01em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mp-ac-device-sub {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    font-size: 0.7rem;
    font-weight: 500;
    color: var(--mp-muted);
  }
  .mp-ac-device-pill {
    display: inline-flex;
    align-items: center;
    padding: 2px 7px;
    border-radius: 999px;
    font-size: 0.62rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    text-transform: uppercase;
  }
  .mp-ac-device-pill.is-now {
    color: #0d4a2c;
    background: rgba(15, 157, 88, 0.14);
    border: 1px solid rgba(15, 157, 88, 0.2);
  }
  .mp-ac-device-revoke {
    flex-shrink: 0;
    border: 1.5px solid rgba(15, 23, 42, 0.08);
    background: #fff;
    color: var(--mp-muted);
    border-radius: 999px;
    padding: 6px 11px;
    font-size: 0.68rem;
    font-weight: 700;
    cursor: pointer;
    transition: border-color 0.15s, color 0.15s, background 0.15s;
  }
  .mp-ac-device-revoke:hover:not(:disabled) {
    border-color: rgba(220, 38, 38, 0.35);
    color: #b91c1c;
    background: #fef2f2;
  }
  .mp-ac-device-revoke:disabled {
    opacity: 0.55;
    cursor: wait;
  }
  .mp-ac-device.is-current .mp-ac-device-revoke {
    border-color: rgba(15, 157, 88, 0.25);
    color: var(--mp-green-d);
  }
  .mp-ac-device.is-current .mp-ac-device-revoke:hover:not(:disabled) {
    border-color: rgba(15, 157, 88, 0.4);
    color: var(--mp-green-d);
    background: #eef8f2;
  }
  .mp-ac-devices-foot {
    margin: 10px 0 0;
    font-size: 0.68rem;
    color: var(--mp-faint);
    font-weight: 500;
    line-height: 1.35;
  }

  .mp-ac-shortcuts {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--ac-line);
  }
  .mp-ac-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1.5px solid rgba(15, 157, 88, 0.16);
    background: linear-gradient(180deg, #f4fbf6, #eaf6ef);
    color: var(--mp-green-d);
    border-radius: 999px;
    padding: 8px 12px;
    font-size: 0.72rem;
    font-weight: 700;
    cursor: pointer;
    transition:
      background 140ms var(--mp-ease),
      transform 100ms var(--mp-ease),
      box-shadow 140ms var(--mp-ease),
      border-color 140ms var(--mp-ease);
  }
  .mp-ac-chip:hover {
    background: linear-gradient(180deg, #e8f6ee, #dcf0e5);
    border-color: rgba(15, 157, 88, 0.28);
    box-shadow: 0 3px 10px rgba(15, 157, 88, 0.12);
  }
  .mp-ac-chip:focus-visible {
    outline: 2px solid var(--mp-green);
    outline-offset: 2px;
  }
  .mp-ac-chip:active { transform: scale(0.97); }
  .mp-ac-card-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid var(--ac-line);
  }
  .mp-ac-card-actions .mp-btn-verify,
  .mp-ac-card-actions .mp-btn-secondary {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .mp-ac-trust-summary {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    margin-bottom: 12px;
    border-radius: 16px;
    background:
      radial-gradient(ellipse 70% 80% at 0% 50%, rgba(15, 157, 88, 0.07), transparent 55%),
      linear-gradient(165deg, #ffffff 0%, #f7fbf8 100%);
    border: 1px solid rgba(15, 157, 88, 0.12);
    box-shadow:
      0 1px 2px rgba(15, 23, 42, 0.03),
      0 8px 22px rgba(15, 157, 88, 0.07);
    overflow: hidden;
  }
  .mp-ac-trust-score-wrap {
    display: flex;
    align-items: center;
    gap: 16px;
    min-width: 0;
  }
  .mp-ac-trust-ring {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    box-shadow:
      0 6px 18px rgba(15, 157, 88, 0.14),
      inset 0 0 0 1px rgba(255, 255, 255, 0.5);
  }
  .mp-ac-trust-ring-hole {
    width: 60px;
    height: 60px;
    border-radius: 50%;
    background: #fff;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1px;
    box-shadow: inset 0 1px 3px rgba(15, 23, 42, 0.04);
  }
  .mp-ac-trust-ring-hole strong {
    font-family: var(--mp-display);
    font-size: 1.4rem;
    font-weight: 800;
    color: var(--mp-green-d);
    line-height: 1;
    letter-spacing: -0.03em;
  }
  .mp-ac-trust-ring-hole span {
    font-size: 0.6rem;
    font-weight: 700;
    color: var(--mp-subtle);
    letter-spacing: 0.02em;
    line-height: 1;
  }
  .mp-ac-trust-score-skel {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background: linear-gradient(90deg, #eef1ef 0%, #f7f8f7 45%, #eef1ef 100%);
    background-size: 200% 100%;
    animation: mp-od-shimmer 1.2s ease-in-out infinite;
    flex-shrink: 0;
  }
  .mp-ac-trust-score-label {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 6px;
    min-width: 0;
    flex: 1;
  }
  .mp-ac-trust-score-k {
    display: block;
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--mp-subtle);
    line-height: 1.2;
  }
  .mp-ac-trust-score-msg {
    margin: 0;
    font-style: normal;
    font-size: 0.95rem;
    font-weight: 750;
    color: var(--mp-ink);
    letter-spacing: -0.015em;
    line-height: 1.35;
    max-width: 12rem;
  }
  .mp-ac-trust-panels {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    align-items: stretch;
  }
  .mp-ac-trust-panel {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
    padding: 14px 12px;
    border-radius: 14px;
    background: #fff;
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.03);
    min-width: 0;
    overflow: hidden;
  }
  .mp-ac-trust-panel-ic {
    width: 36px;
    height: 36px;
    border-radius: 11px;
    display: grid;
    place-items: center;
    background: rgba(15, 157, 88, 0.1);
    color: var(--mp-green-d);
    flex-shrink: 0;
  }
  .mp-ac-trust-panel-text {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    width: 100%;
  }
  .mp-ac-trust-panel-value {
    display: block;
    font-size: 1rem;
    font-weight: 800;
    color: var(--mp-ink);
    letter-spacing: -0.02em;
    line-height: 1.25;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    cursor: default;
  }
  .mp-ac-trust-panel-label {
    display: block;
    font-size: 0.72rem;
    font-weight: 600;
    color: var(--mp-faint);
    line-height: 1.3;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
    cursor: default;
  }
  .mp-ac-trust-level {
    background: linear-gradient(145deg, rgba(249, 171, 0, 0.1) 0%, #fff 60%);
    border-color: rgba(217, 119, 6, 0.16);
    cursor: help;
  }
  .mp-ac-trust-level:hover .mp-ac-trust-panel-value,
  .mp-ac-trust-level:hover .mp-ac-trust-panel-label {
    color: var(--mp-ink);
  }
  /* Native tooltip is fine; also show a styled tooltip on hover for seller level */
  .mp-ac-trust-level {
    position: relative;
  }
  .mp-ac-trust-level::after {
    content: attr(title);
    position: absolute;
    left: 50%;
    bottom: calc(100% + 8px);
    transform: translateX(-50%) translateY(4px);
    padding: 8px 12px;
    border-radius: 10px;
    background: rgba(15, 23, 42, 0.92);
    color: #fff;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: -0.01em;
    white-space: nowrap;
    line-height: 1.3;
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.2);
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    transition: opacity 140ms var(--mp-ease), transform 140ms var(--mp-ease), visibility 140ms;
    z-index: 20;
  }
  .mp-ac-trust-level::before {
    content: '';
    position: absolute;
    left: 50%;
    bottom: calc(100% + 2px);
    transform: translateX(-50%);
    border: 6px solid transparent;
    border-top-color: rgba(15, 23, 42, 0.92);
    opacity: 0;
    visibility: hidden;
    transition: opacity 140ms var(--mp-ease), visibility 140ms;
    z-index: 20;
  }
  .mp-ac-trust-level:hover::after,
  .mp-ac-trust-level:focus-within::after {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(0);
  }
  .mp-ac-trust-level:hover::before,
  .mp-ac-trust-level:focus-within::before {
    opacity: 1;
    visibility: visible;
  }
  .mp-ac-trust-level .mp-ac-trust-panel-ic {
    background: rgba(249, 171, 0, 0.18);
    color: #b45309;
  }
  .mp-ac-level-bar {
    width: 100%;
    height: 6px;
    border-radius: 999px;
    background: #f0f1f0;
    overflow: hidden;
    margin-top: auto;
  }
  .mp-ac-level-bar i {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, #f9ab00, #e69100 60%, #c47a00);
    transition: width 320ms var(--mp-ease);
  }
  .mp-level-badge--t1 .mp-ac-level-bar i {
    background: linear-gradient(90deg, #94a3b8, #64748b);
  }
  .mp-level-badge--t2 .mp-ac-level-bar i {
    background: linear-gradient(90deg, #38bdf8, #0284c7);
  }
  .mp-level-badge--t3 .mp-ac-level-bar i,
  .mp-ac-trust-level.mp-level-badge--t3 .mp-ac-level-bar i {
    background: linear-gradient(90deg, #f9ab00, #e69100);
  }
  .mp-level-badge--t4 .mp-ac-level-bar i {
    background: linear-gradient(90deg, var(--mp-green), var(--mp-green-d));
  }
  .mp-ac-trust-badge-row {
    display: flex;
    justify-content: flex-start;
    width: 100%;
    min-width: 0;
    padding-top: 2px;
  }
  .mp-ac-trust-badge-row > * {
    max-width: 100%;
    flex-shrink: 1;
  }

  .mp-ac-danger-grid {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .mp-ac-danger-item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 12px;
    padding: 14px 16px;
    border-radius: 14px;
    background: #fff;
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
    transition: border-color 140ms var(--mp-ease), box-shadow 140ms var(--mp-ease);
  }
  .mp-ac-danger-item.is-live {
    border-color: rgba(239, 68, 68, 0.2);
    background: linear-gradient(180deg, #fff 0%, #fff8f8 100%);
    box-shadow: 0 2px 10px rgba(239, 68, 68, 0.06);
  }
  .mp-ac-danger-item.is-soon {
    background: #fafbfb;
    border-style: dashed;
    border-color: rgba(15, 23, 42, 0.08);
  }
  .mp-ac-danger-copy {
    flex: 1 1 160px;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .mp-ac-danger-copy strong {
    font-size: 0.875rem;
    font-weight: 750;
    color: var(--mp-ink);
    letter-spacing: -0.01em;
  }
  .mp-ac-danger-copy span {
    font-size: 0.73rem;
    color: var(--mp-faint);
    font-weight: 500;
    line-height: 1.35;
  }
  .mp-ac-danger-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1.5px solid rgba(239, 68, 68, 0.28);
    background: linear-gradient(180deg, #fff 0%, #fffafa 100%);
    color: #b91c1c;
    border-radius: 999px;
    padding: 9px 16px;
    font-size: 0.76rem;
    font-weight: 750;
    cursor: pointer;
    flex-shrink: 0;
    transition:
      background 140ms var(--mp-ease),
      box-shadow 140ms var(--mp-ease),
      border-color 140ms var(--mp-ease),
      transform 100ms var(--mp-ease);
  }
  .mp-ac-danger-btn:hover {
    background: #fff5f4;
    border-color: rgba(239, 68, 68, 0.42);
    box-shadow: 0 4px 14px rgba(239, 68, 68, 0.14);
  }
  .mp-ac-danger-btn:focus-visible {
    outline: 2px solid #ef4444;
    outline-offset: 2px;
  }
  .mp-ac-danger-btn:active { transform: scale(0.98); }

  .mp-ac.is-nav-focus .mp-ac-hero,
  #mp-settings-account.is-nav-focus .mp-ac-hero {
    box-shadow:
      0 0 0 2px rgba(15, 157, 88, 0.18),
      0 14px 36px rgba(15, 157, 88, 0.08);
  }

  @media (min-width: 768px) {
    .mp-ac {
      --ac-pad: 18px;
      --ac-gap: 18px;
      margin-left: 0;
      margin-right: 0;
    }
    .mp-ac-hero {
      flex-direction: row;
      align-items: stretch;
      justify-content: space-between;
      gap: 24px;
      padding: 24px 26px;
    }
    .mp-ac-hero-side {
      width: min(272px, 36%);
      justify-content: center;
      padding: 16px;
    }
    .mp-ac-grid {
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .mp-ac-card-danger { grid-column: 1 / -1; }
    .mp-ac-danger-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
    }
    .mp-ac-danger-item.is-live { grid-column: 1 / -1; }
    .mp-ac-trust-summary { padding: 16px; }
  }
  @media (min-width: 1100px) {
    .mp-ac-hero { padding: 26px 28px; }
    .mp-ac-card { padding: 18px 18px 16px; }
    .mp-ac-trust-score-wrap { gap: 18px; }
    .mp-ac-trust-ring { width: 88px; height: 88px; }
    .mp-ac-trust-ring-hole { width: 66px; height: 66px; }
    .mp-ac-trust-ring-hole strong { font-size: 1.5rem; }
    .mp-ac-trust-score-msg { font-size: 1rem; max-width: none; }
  }
  @media (max-width: 480px) {
    .mp-ac-row { flex-wrap: wrap; }
    .mp-ac-row-action,
    .mp-ac-copy { margin-left: 48px; }
    .mp-ac-hero-side { width: 100%; }
    .mp-ac-danger-item { padding: 12px; }
    .mp-ac-trust-panels { grid-template-columns: 1fr 1fr; gap: 8px; }
    .mp-ac-trust-panel { padding: 12px 10px; }
    .mp-ac-trust-panel-value { font-size: 0.92rem; }
    .mp-ac-trust-score-msg { max-width: 10.5rem; font-size: 0.9rem; }
  }
  @media (max-width: 360px) {
    .mp-ac-trust-panels { grid-template-columns: 1fr; }
  }

  .mp-net { min-width: 0; }
  .mp-net-loading,
  .mp-net-empty {
    padding: 28px 16px;
    text-align: center;
    color: var(--mp-faint);
    font-size: 0.8125rem;
    line-height: 1.45;
  }
  .mp-net-empty-ic {
    font-size: 1.75rem;
    margin-bottom: 8px;
    line-height: 1;
  }
  .mp-net-section-head {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 14px 14px 10px;
    border-bottom: 1px solid var(--mp-line-soft);
    background: linear-gradient(180deg, var(--mp-surface-2), #fff);
  }
  .mp-net-section-ic { font-size: 1rem; line-height: 1; }
  .mp-net-section-label {
    font-size: 0.8125rem;
    font-weight: 800;
    color: var(--mp-ink);
  }
  .mp-net-section-count {
    font-size: 0.7rem;
    font-weight: 800;
    color: #fff;
    border-radius: var(--mp-r-pill);
    padding: 2px 8px;
    min-width: 22px;
    text-align: center;
  }
  .mp-net-section-count--green { background: var(--mp-green-d); }
  .mp-net-section-count--amber { background: #e69100; }
  .mp-net-section-hint {
    margin-left: auto;
    font-size: 0.7rem;
    color: var(--mp-faint);
    font-weight: 500;
  }
  .mp-net-row {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    border-bottom: 1px solid var(--mp-line-soft);
    transition: background var(--mp-dur) var(--mp-ease);
  }
  .mp-net-row:hover { background: var(--mp-green-mist); }
  .mp-net-avatar {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    flex-shrink: 0;
    overflow: hidden;
    display: grid;
    place-items: center;
    font-size: 0.9rem;
    font-weight: 700;
    color: #fff;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }
  .mp-net-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .mp-net-avatar--green {
    background: linear-gradient(135deg, #1a7a4a, #22a05e);
  }
  .mp-net-avatar--amber {
    background: linear-gradient(135deg, #e65100, #f9a825);
  }
  .mp-net-meta { flex: 1; min-width: 0; }
  .mp-net-name-row {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .mp-net-name {
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--mp-ink);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 100%;
  }
  .mp-net-mutual {
    font-size: 0.62rem;
    font-weight: 800;
    background: var(--mp-green-l);
    color: var(--mp-green-d);
    border-radius: var(--mp-r-pill);
    padding: 2px 7px;
  }
  .mp-net-sub {
    font-size: 0.7rem;
    color: var(--mp-faint);
    margin-top: 2px;
  }
  .mp-net-btn {
    padding: 6px 11px;
    font-size: 0.7rem;
    font-weight: 700;
    border-radius: var(--mp-r-pill);
    cursor: pointer;
    white-space: nowrap;
    transition: background var(--mp-dur) var(--mp-ease), opacity var(--mp-dur) var(--mp-ease);
  }
  .mp-net-btn:disabled {
    opacity: 0.5;
    cursor: default;
  }
  .mp-net-btn--view {
    border: 1.5px solid #d1fae5;
    background: #f0faf4;
    color: var(--mp-green-d);
  }
  .mp-net-btn--view:hover { background: var(--mp-green-l); }
  .mp-net-btn--danger {
    border: 1.5px solid #fecaca;
    background: #fff5f5;
    color: #ef4444;
  }
  .mp-net-btn--danger:hover:not(:disabled) { background: var(--mp-red-l); }
  .mp-net-divider {
    height: 10px;
    background: var(--mp-line-soft);
    border-top: 1px solid var(--mp-line);
    border-bottom: 1px solid var(--mp-line);
  }

  /* ── Sections & actions ── */
  .mp-section-title {
    margin: 0 0 4px;
    font-family: var(--mp-display);
    font-size: 0.95rem;
    font-weight: 700;
    letter-spacing: -0.02em;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--mp-ink);
  }
  .mp-section-title::before {
    content: '';
    width: 4px;
    height: 16px;
    border-radius: 4px;
    background: linear-gradient(180deg, var(--mp-amber), var(--mp-green));
    flex-shrink: 0;
  }
  .mp-section-lead {
    margin: 0 0 14px;
    font-size: 0.8125rem;
    color: var(--mp-muted);
    line-height: 1.5;
  }

  .mp-action-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 8px;
  }
  .mp-action {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 10px;
    text-align: left;
    border: 1px solid var(--mp-line);
    border-radius: var(--mp-r-md);
    background: #fff;
    padding: 11px 12px;
    cursor: pointer;
    min-width: 0;
    transition:
      border-color var(--mp-dur) var(--mp-ease),
      box-shadow var(--mp-dur) var(--mp-ease),
      background var(--mp-dur) var(--mp-ease),
      transform var(--mp-dur) var(--mp-ease);
  }
  .mp-action:hover {
    background: var(--mp-surface-2);
    border-color: rgba(15, 157, 88, 0.32);
    box-shadow: 0 6px 16px rgba(15, 157, 88, 0.08);
    transform: translateY(-1px);
  }
  .mp-action:active { transform: translateY(0); }
  .mp-action-ic {
    width: 36px;
    height: 36px;
    border-radius: var(--mp-r-sm);
    display: grid;
    place-items: center;
    font-size: 1rem;
    flex-shrink: 0;
    background: var(--mp-green-l);
    border: 1px solid rgba(15, 157, 88, 0.1);
  }
  .mp-action-copy {
    display: flex;
    flex-direction: column;
    gap: 1px;
    min-width: 0;
  }
  .mp-action-label {
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--mp-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mp-action-sub {
    font-size: 0.68rem;
    color: var(--mp-faint);
    font-weight: 500;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* ── Status ── */
  .mp-status-card {
    padding: 12px 14px;
    border-color: rgba(15, 157, 88, 0.12);
  }
  .mp-status-active {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 11px 12px;
    background: #f0faf4;
    border: 1px solid #d8ebe0;
    border-radius: var(--mp-r-md);
  }
  .mp-status-body { min-width: 0; flex: 1; }
  .mp-status-kicker {
    font-size: 0.625rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--mp-green-d);
    margin-bottom: 4px;
  }
  .mp-status-text {
    font-size: 0.8125rem;
    font-weight: 600;
    color: #1b5e20;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mp-status-cta {
    width: 100%;
    border: 1.5px dashed var(--mp-green);
    border-radius: var(--mp-r-md);
    background: var(--mp-green-mist);
    padding: 12px;
    cursor: pointer;
    color: var(--mp-green-d);
    display: flex;
    align-items: center;
    gap: 12px;
    text-align: left;
    transition:
      background var(--mp-dur) var(--mp-ease),
      border-color var(--mp-dur) var(--mp-ease),
      box-shadow var(--mp-dur) var(--mp-ease);
  }
  .mp-status-cta:hover {
    background: var(--mp-green-l);
    border-color: var(--mp-green-d);
    box-shadow: var(--mp-shadow-xs);
  }
  .mp-status-cta-ic {
    width: 36px;
    height: 36px;
    border-radius: var(--mp-r-sm);
    background: var(--mp-green-l);
    display: grid;
    place-items: center;
    font-size: 1rem;
    flex-shrink: 0;
  }
  .mp-status-cta-copy {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .mp-status-cta-copy strong {
    font-size: 0.8125rem;
    font-weight: 700;
    color: var(--mp-green-d);
  }
  .mp-status-cta-copy span {
    font-size: 0.72rem;
    font-weight: 500;
    color: #5f8a70;
  }

  /* ── Listings ── */
  .mp-listings {
    padding: 0 var(--mp-pad-r) 8px var(--mp-pad-x);
  }
  .mp-listing-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .mp-listing-card {
    display: flex;
    gap: 0;
    background: var(--mp-surface);
    border-radius: var(--mp-r-lg);
    overflow: hidden;
    border: 1px solid rgba(15, 23, 42, 0.06);
    box-shadow: var(--mp-shadow-xs);
    transition:
      box-shadow var(--mp-dur) var(--mp-ease),
      border-color var(--mp-dur) var(--mp-ease),
      transform var(--mp-dur) var(--mp-ease);
  }
  .mp-listing-card:hover {
    border-color: rgba(15, 157, 88, 0.18);
    box-shadow: var(--mp-shadow-md);
    transform: translateY(-1px);
  }
  .mp-listing-media {
    width: 96px;
    flex-shrink: 0;
    border: none;
    padding: 0;
    background: #f1f3f4;
    cursor: pointer;
    position: relative;
  }
  .mp-listing-media img {
    width: 96px;
    height: 100%;
    min-height: 96px;
    object-fit: cover;
    display: block;
  }
  .mp-listing-ph {
    width: 96px;
    min-height: 96px;
    display: grid;
    place-items: center;
    font-size: 1.5rem;
  }
  .mp-sold-badge {
    position: absolute;
    top: 6px;
    left: 6px;
    background: rgba(15, 23, 42, 0.78);
    color: #fff;
    font-size: 9px;
    font-weight: 800;
    border-radius: 5px;
    padding: 2px 5px;
    letter-spacing: 0.03em;
  }
  .mp-feat-badge {
    position: absolute;
    bottom: 6px;
    left: 6px;
    background: var(--mp-orange);
    color: #fff;
    font-size: 9px;
    font-weight: 800;
    border-radius: var(--mp-r-pill);
    padding: 2px 7px;
  }
  .mp-listing-body {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    padding: 10px 10px 10px 12px;
  }
  .mp-listing-info {
    border: none;
    background: none;
    text-align: left;
    padding: 0;
    cursor: pointer;
    width: 100%;
  }
  .mp-listing-info h4 {
    margin: 0 0 4px;
    font-size: 0.875rem;
    font-weight: 700;
    color: var(--mp-ink);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .mp-listing-price {
    font-family: var(--mp-display);
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--mp-green);
    letter-spacing: -0.02em;
    margin-bottom: 2px;
  }
  .mp-listing-place {
    font-size: 0.72rem;
    color: var(--mp-faint);
  }
  .mp-listing-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 8px;
  }
  .mp-chip {
    border: none;
    border-radius: var(--mp-r-pill);
    padding: 5px 10px;
    font-size: 0.6875rem;
    font-weight: 700;
    cursor: pointer;
    transition: filter var(--mp-dur) var(--mp-ease), transform 100ms var(--mp-ease);
  }
  .mp-chip:hover { filter: brightness(0.97); }
  .mp-chip:active { transform: scale(0.97); }
  .mp-chip.green { background: var(--mp-green-l); color: var(--mp-green-d); }
  .mp-chip.blue { background: var(--mp-blue-l); color: var(--mp-blue); }
  .mp-chip.ghost { background: #f1f3f4; color: var(--mp-muted); }
  .mp-chip.danger { background: var(--mp-red-l); color: var(--mp-red-d); }

  .mp-empty {
    text-align: center;
    padding: 44px 22px;
    background: var(--mp-surface);
    border-radius: var(--mp-r-lg);
    border: 1px dashed rgba(15, 157, 88, 0.18);
    box-shadow: var(--mp-shadow-xs);
  }
  .mp-empty-ic {
    font-size: 2.25rem;
    margin-bottom: 10px;
    line-height: 1;
  }
  .mp-empty h3 {
    margin: 0 0 6px;
    font-family: var(--mp-display);
    font-size: 1rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .mp-empty p {
    margin: 0 auto 16px;
    font-size: 0.8125rem;
    color: var(--mp-subtle);
    line-height: 1.5;
    max-width: 28ch;
  }

  /* ── Trust ── */
  .mp-trust-hero {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 12px;
    margin-bottom: 14px;
  }
  .mp-trust-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    margin-bottom: 16px;
  }
  .mp-trust-item {
    background: var(--mp-surface-2);
    border: 1px solid var(--mp-line-soft);
    border-radius: var(--mp-r-md);
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .mp-trust-label {
    font-size: 0.6875rem;
    font-weight: 650;
    color: var(--mp-subtle);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .mp-trust-item strong {
    font-size: 1.15rem;
    font-weight: 800;
    font-family: var(--mp-display);
    letter-spacing: -0.02em;
    color: var(--mp-ink);
  }
  .mp-trust-tips {
    background: var(--mp-surface-2);
    border: 1px solid var(--mp-line-soft);
    border-radius: 14px;
    padding: 14px;
    margin-bottom: 16px;
  }
  .mp-trust-tips-title {
    font-size: 0.8125rem;
    font-weight: 700;
    margin-bottom: 8px;
    color: var(--mp-ink);
  }
  .mp-trust-tips ul {
    margin: 0;
    padding-left: 18px;
    font-size: 0.78rem;
    color: var(--mp-muted);
    line-height: 1.6;
  }
  .mp-vouch-wrap { margin-top: 4px; }

  /* ── Network ── */
  .mp-network-wrap {
    padding: 0 var(--mp-pad-r) 8px var(--mp-pad-x);
  }
  .mp-network-card {
    margin: 0;
    padding: 0;
    overflow: hidden;
  }

  /* ── Settings ── */
  .mp-settings-group {
    margin-bottom: 14px;
    padding: 14px 12px 12px;
    border: 1px solid var(--mp-line);
    border-radius: 14px;
    background: var(--mp-surface-2);
  }
  .mp-settings-group-last { margin-bottom: 0; }
  .mp-settings-group-head {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 12px;
  }
  .mp-settings-group-ic {
    width: 36px;
    height: 36px;
    border-radius: var(--mp-r-sm);
    flex-shrink: 0;
    display: grid;
    place-items: center;
    font-size: 1rem;
    background: var(--mp-green-l);
    border: 1px solid rgba(15, 157, 88, 0.12);
  }
  .mp-settings-group-title {
    font-size: 0.875rem;
    font-weight: 800;
    color: var(--mp-ink);
    letter-spacing: -0.02em;
    line-height: 1.25;
  }
  .mp-settings-group-hint {
    font-size: 0.72rem;
    font-weight: 500;
    color: var(--mp-faint);
    margin-top: 2px;
  }
  .mp-settings-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-top: 10px;
  }
  .mp-settings-actions .mp-btn-secondary,
  .mp-settings-actions .mp-btn-verify,
  .mp-settings-actions .mp-btn-outline {
    flex: 1 1 auto;
    min-width: min(100%, 140px);
    text-align: center;
  }
  .mp-settings-group .mp-account-rows {
    margin-bottom: 0;
    background: #fff;
    border: 1px solid var(--mp-line-soft);
    border-radius: var(--mp-r-md);
    overflow: hidden;
  }
  .mp-settings-group .mp-account-row { padding: 12px; }
  .mp-settings-group .mp-account-row:last-child { border-bottom: none; }
  .mp-account-rows {
    display: flex;
    flex-direction: column;
    gap: 0;
    margin-bottom: 16px;
  }
  .mp-account-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 12px 0;
    border-bottom: 1px solid #f1f3f4;
    font-size: 0.8125rem;
  }
  .mp-account-row span {
    color: var(--mp-subtle);
    font-weight: 500;
    flex-shrink: 0;
  }
  .mp-account-row strong {
    font-weight: 650;
    color: var(--mp-ink);
    text-align: right;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .mp-mono {
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 0.75rem;
    color: var(--mp-muted);
  }
  .mp-account-links {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  /* ── Overlay / modal / sheet ── */
  .mp-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    background: rgba(15, 23, 42, 0.48);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
    animation: mp-fade-in 160ms var(--mp-ease) both;
  }
  .mp-overlay.bottom {
    align-items: flex-end;
    padding: 0;
  }
  .mp-modal {
    background: #fff;
    border-radius: 20px;
    padding: 22px;
    width: 100%;
    max-width: 320px;
    text-align: center;
    box-shadow: var(--mp-shadow-lg);
    border: 1px solid rgba(15, 23, 42, 0.06);
  }
  .mp-modal h3 {
    margin: 0 0 6px;
    font-family: var(--mp-display);
    font-size: 1.05rem;
    font-weight: 800;
    letter-spacing: -0.02em;
  }
  .mp-modal p {
    margin: 0 0 18px;
    font-size: 0.8125rem;
    color: var(--mp-subtle);
    line-height: 1.45;
  }
  .mp-modal-btns { display: flex; gap: 10px; }
  .mp-modal-btns .mp-btn-secondary { flex: 1; }
  .mp-sheet {
    background: #fff;
    width: 100%;
    max-width: 480px;
    border-radius: 24px 24px 0 0;
    padding: 20px 18px calc(28px + env(safe-area-inset-bottom, 0px));
    box-shadow: 0 -8px 32px rgba(6, 61, 35, 0.12);
  }
  .mp-sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 14px;
  }
  .mp-sheet-head h3 {
    margin: 0;
    font-family: var(--mp-display);
    font-size: 1rem;
    font-weight: 800;
  }
  .mp-sheet-close {
    width: 36px;
    height: 36px;
    border: none;
    background: #f1f3f4;
    border-radius: 50%;
    font-size: 1rem;
    color: var(--mp-faint);
    cursor: pointer;
    display: grid;
    place-items: center;
    line-height: 1;
    transition: background var(--mp-dur) var(--mp-ease), color var(--mp-dur) var(--mp-ease);
  }
  .mp-sheet-close:hover {
    background: #e8eaed;
    color: var(--mp-muted);
  }

  /* ── Responsive ── */
  /* ═══ Phone layout — modern stack, clear hierarchy, touch-first ═══ */
  @media (max-width: 767px) {
    .mp-page {
      --mp-pad-x: max(14px, env(safe-area-inset-left, 0px));
      --mp-pad-r: max(14px, env(safe-area-inset-right, 0px));
      /* Only app BottomNav — section chips stick under top bar */
      --mp-bottom-clear: calc(76px + env(safe-area-inset-bottom, 0px));
      padding-bottom: var(--mp-bottom-clear);
    }

    /* Top bar — clean mobile header (no wordmark) */
    .mp-topbar {
      background: #fff;
      overflow: visible;
    }
    .mp-brand-desk { display: none !important; }
    .mp-topbar-kicker,
    .mp-topbar-titles,
    .mp-topbar-divider,
    .mp-wordmark-btn,
    .mp-back-home { display: none !important; }

    .mp-mob-section-dd {
      display: block;
      flex: 1 1 auto;
      min-width: 0;
      max-width: calc(100% - 132px);
    }
    .mp-mob-section-btn {
      max-width: 100%;
    }

    .mp-top-btn-search {
      display: inline-flex !important;
      align-items: center;
      justify-content: center;
    }
    .mp-top-btn-search.is-active {
      color: var(--mp-green);
      background: #f3f4f6;
    }
    .mp-top-btn span { display: none; }
    .mp-top-btn {
      padding: 0;
      width: 40px;
      height: 40px;
      min-width: 40px;
      min-height: 40px;
      border-radius: 10px;
      border: none;
      background: transparent;
      color: #6b7280;
    }
    .mp-top-btn:hover { background: #f3f4f6; color: #111827; }
    .mp-top-btn-out {
      color: #6b7280;
      background: transparent;
    }
    .mp-top-btn-out:hover {
      color: #b91c1c;
      background: #fef2f2;
    }

    .mp-topbar-inner {
      gap: 8px;
      padding: 8px var(--mp-pad-r) 8px var(--mp-pad-x);
      min-height: 52px;
      align-items: center;
    }
    .mp-topbar-actions {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 2px;
    }

    /* Dropdown: full-width under header edge, not clipped */
    .mp-mob-section-menu {
      position: fixed;
      top: calc(var(--mp-topbar-h) + 4px);
      left: max(12px, env(safe-area-inset-left, 0px));
      right: auto;
      width: min(300px, calc(100vw - 24px));
      z-index: 80;
    }

    /* Search panel */
    .mp-mob-search-panel {
      display: flex;
      flex-direction: column;
      gap: 10px;
      padding: 10px var(--mp-pad-r) 12px var(--mp-pad-x);
      border-top: 1px solid rgba(15, 23, 42, 0.06);
      background: #fff;
    }
    .mp-mob-search-panel .mp-inv-search-input {
      min-height: 42px;
      border-radius: 10px;
      background: #f9fafb;
      border: 1px solid rgba(15, 23, 42, 0.08);
      font-size: 0.9rem;
    }
    .mp-mob-search-field { width: 100%; }
    .mp-mob-search-filters {
      display: flex;
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      gap: 8px;
      scrollbar-width: none;
      padding-bottom: 2px;
      align-items: flex-end;
    }
    .mp-mob-search-filters::-webkit-scrollbar { display: none; }
    .mp-mob-search-filters .mp-inv-field {
      flex: 0 0 auto;
      min-width: 120px;
    }
    .mp-mob-search-clear-all {
      align-self: flex-start;
      border: none;
      background: none;
      color: var(--mp-green-d);
      font-size: 0.75rem;
      font-weight: 700;
      padding: 4px 0;
      cursor: pointer;
    }

    /* Inline inventory toolbars stay desktop-only; mobile uses header search */
    .mp-inv-toolbar,
    .mp-inv-toolbar.mp-sold-toolbar {
      display: none !important;
    }

    /* Hero — centered identity card */
    .mp-hero-media {
      height: 112px;
      max-height: 112px;
    }
    .mp-hero-panel {
      margin-top: -8px;
      padding: 0 var(--mp-pad-x) 0;
    }
    .mp-hero-panel-inner {
      padding: 12px;
      border-radius: 18px;
      box-shadow:
        0 1px 2px rgba(15, 23, 42, 0.04),
        0 12px 28px rgba(15, 23, 42, 0.06);
    }
    .mp-hero-grid {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .mp-hero-col-id {
      margin-top: -48px;
      gap: 10px;
      align-items: center;
      height: auto;
    }
    .mp-hero-col-main,
    .mp-hero-col-side { height: auto; width: 100%; }
    .mp-hero-id-block {
      align-items: center;
      text-align: center;
      width: 100%;
    }
    .mp-hero-id { align-items: center; width: 100%; }
    .mp-hero-name-row,
    .mp-hero-meta-row { justify-content: center; }
    .mp-hero-avatar .mp-avatar {
      width: 92px;
      height: 92px;
      font-size: 1.85rem;
      border: 3px solid #fff;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.12);
    }
    .mp-hero-premium .mp-name {
      font-size: 1.2rem;
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mp-trust-card {
      width: 100%;
      max-width: 100%;
    }
    .mp-hero-stats {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .mp-hero-stat {
      align-items: center;
      text-align: center;
      padding: 12px 8px;
      min-height: 72px;
      border-radius: 14px;
    }
    .mp-hero-stat-ic,
    .mp-hero-stat-n,
    .mp-hero-stat-l { width: 100%; text-align: center; }
    .mp-hero-stat-n { font-size: 1.35rem; }
    .mp-hero-stat-l { font-size: 0.65rem; }

    /* Primary actions — scroll row with snap */
    .mp-hero-actions {
      display: flex;
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scroll-snap-type: x proximity;
      scrollbar-width: none;
      gap: 8px;
      margin-top: 0;
      padding-bottom: 2px;
    }
    .mp-hero-actions::-webkit-scrollbar { display: none; }
    .mp-hbtn {
      flex: 0 0 auto;
      scroll-snap-align: start;
      min-height: 40px;
      padding: 10px 14px;
      font-size: 0.78rem;
      border-radius: 999px;
    }
    .mp-hbtn-primary { padding-inline: 16px; }
    .mp-hero-chips {
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      scroll-snap-type: x proximity;
      scrollbar-width: none;
      margin-top: 0;
      gap: 8px;
      padding-bottom: 2px;
    }
    .mp-hero-chips::-webkit-scrollbar { display: none; }
    .mp-hchip {
      flex: 0 0 auto;
      scroll-snap-align: start;
      min-height: 36px;
      padding: 8px 12px;
      font-size: 0.72rem;
    }
    .mp-hero-more-menu { right: auto; left: 0; min-width: 180px; }
    .mp-hero-col-side {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .mp-hero-insight-card { width: 100%; }
    .mp-cover-actions {
      top: 8px;
      right: 8px;
    }
    .mp-cover-btn {
      padding: 7px 11px;
      font-size: 0.68rem;
      min-height: 32px;
    }

    .mp-mobile-sections {
      display: flex;
      position: sticky;
      top: var(--mp-topbar-h);
      z-index: 30;
      background: linear-gradient(180deg, var(--mp-bg) 70%, rgba(244, 247, 245, 0));
      padding-top: 2px;
      padding-bottom: 10px;
    }

    /* Shell: detail then insights (no left nav) */
    .mp-shell,
    .mp-shell.is-nav,
    .mp-shell.is-detail {
      display: flex !important;
      flex-direction: column;
      padding: 0 0 12px;
      gap: 12px;
      margin: 0;
    }
    .mp-col-nav { display: none !important; }
    .mp-col-detail {
      display: flex !important;
      flex-direction: column;
      width: 100%;
      order: 1;
      min-width: 0;
    }
    /* Insights under Overview only — keeps Selling/Network uncluttered */
    .mp-col-insights {
      display: none !important;
    }
    .mp-col-insights.is-overview {
      display: block !important;
      width: 100%;
      order: 2;
      min-width: 0;
      padding: 0 var(--mp-pad-x);
      box-sizing: border-box;
    }
    .mp-insights {
      gap: 10px;
      padding: 0 0 8px;
    }
    .mp-insights-head {
      margin-bottom: 2px;
      padding: 0 2px;
    }
    .mp-insights-title {
      font-size: 0.95rem;
    }
    .mp-insights-sub {
      font-size: 0.72rem;
    }
    .mp-insights-card {
      border-radius: 16px;
      padding: 14px;
    }

    .mp-detail-back { display: none !important; }
    .mp-detail-bar {
      margin: 0 var(--mp-pad-x) 8px;
      padding: 12px 14px;
      border-radius: 16px;
      align-items: center;
      gap: 10px;
    }
    .mp-detail-title { font-size: 1.05rem; }
    .mp-detail-sub {
      font-size: 0.72rem;
      line-height: 1.35;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .mp-detail-cta {
      display: none;
    }
    .mp-detail-body {
      min-width: 0;
    }

    /* Overview — clear vertical rhythm */
    .mp-odash {
      margin: 0 var(--mp-pad-x) 8px;
      gap: 14px;
      min-width: 0;
    }
    .mp-od-welcome {
      padding: 16px;
      border-radius: 18px;
      gap: 14px;
    }
    .mp-od-welcome-hello { font-size: 1.2rem; line-height: 1.2; }
    .mp-od-welcome-lead { font-size: 0.78rem; }
    .mp-od-welcome-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .mp-od-chip {
      flex: 1 1 calc(50% - 8px);
      min-width: 0;
    }
    .mp-od-welcome-cta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .mp-od-welcome-cta .mp-btn-primary,
    .mp-od-welcome-cta .mp-btn-secondary {
      width: 100%;
      min-height: 44px;
      justify-content: center;
    }
    .mp-od-contact {
      border-radius: 18px;
      padding: 14px;
    }
    .mp-od-contact-grid {
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .mp-od-stats-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .mp-od-stat {
      padding: 14px 12px;
      border-radius: 16px;
      min-height: 96px;
    }
    .mp-od-stat-value { font-size: 1.35rem; }
    .mp-od-actions-grid {
      grid-template-columns: 1fr;
      gap: 8px;
    }
    .mp-od-action {
      min-height: 56px;
      padding: 12px 14px;
      border-radius: 14px;
    }
    .mp-od-insights-grid {
      grid-template-columns: 1fr;
      gap: 10px;
    }
    .mp-od-section > .mp-ds-section-head,
    .mp-od-section .mp-section-head {
      margin-bottom: 10px;
    }
    .mp-od-activity-panel,
    .mp-od-panel {
      border-radius: 16px;
      overflow: hidden;
    }
    .mp-od-timeline { gap: 0; }
    .mp-od-tl-btn,
    .mp-od-tl-static {
      padding: 12px 4px;
      min-height: 48px;
      gap: 10px;
    }
    .mp-od-tl-text {
      font-size: 0.84rem;
      line-height: 1.35;
    }

    /* Inventory / selling */
    .mp-inv {
      margin: 0 var(--mp-pad-x) 12px;
      gap: 12px;
    }
    .mp-inv-hero {
      padding: 14px;
      border-radius: 16px;
    }
    .mp-inv-hero-title { font-size: 1.15rem; }
    .mp-inv-kpi-strip {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 8px;
    }
    .mp-inv-kpi {
      min-height: 56px;
      padding: 10px 12px;
    }
    .mp-inv-meta {
      margin-top: 4px;
      margin-bottom: 8px;
    }
    .mp-inv-filters {
      display: flex;
      flex-wrap: nowrap;
      overflow-x: auto;
      -webkit-overflow-scrolling: touch;
      gap: 8px;
      scrollbar-width: none;
      padding-bottom: 2px;
      align-items: flex-end;
    }
    .mp-inv-filters::-webkit-scrollbar { display: none; }
    .mp-inv-filters .mp-inv-field {
      flex: 0 0 auto;
      min-width: 118px;
    }
    .mp-inv-filters .mp-inv-select {
      min-height: 40px;
      font-size: 0.78rem;
    }
    .mp-inv-view-toggle {
      flex: 0 0 auto;
    }
    .mp-inv-view-txt {
      display: none;
    }
    .mp-inv-grid {
      position: relative;
      z-index: 0;
      gap: 10px;
      padding-top: 4px;
      scroll-margin-top: calc(var(--mp-topbar-h) + var(--mp-pnav-mob-h) + 12px);
    }
    .mp-inv-grid--grid {
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
    }
    .mp-inv-card {
      position: relative;
      z-index: 0;
      border-radius: 14px;
      min-width: 0;
    }
    /* Bulk bar above app BottomNav only */
    .mp-inv-bulk {
      position: sticky;
      bottom: calc(var(--mp-app-nav-h) + env(safe-area-inset-bottom, 0px) + 8px);
      z-index: 15;
    }
    .mp-inv-card-title {
      font-size: 0.8rem;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
      white-space: normal;
    }
    .mp-inv-card-actions {
      flex-wrap: wrap;
      gap: 6px;
    }
    .mp-inv-icon-btn {
      min-width: 40px;
      min-height: 40px;
    }

    /* Account / trust / buying / network */
    .mp-ac {
      margin: 0 var(--mp-pad-x) 12px;
      gap: 12px;
    }
    .mp-ac-hero {
      padding: 16px;
      border-radius: 16px;
    }
    .mp-ac-grid {
      grid-template-columns: 1fr !important;
      gap: 12px;
    }
    .mp-ac-card { border-radius: 16px; }
    .mp-ac-row {
      padding: 12px 4px;
      gap: 10px;
      min-height: 52px;
    }
    .mp-ac-devices { margin-top: 12px; }
    .mp-ac-device {
      padding: 10px;
      gap: 10px;
    }
    .mp-ac-device-revoke {
      min-height: 36px;
      padding: 8px 12px;
    }
    .mp-tc-metrics,
    .mp-buy-stats {
      grid-template-columns: 1fr 1fr !important;
      gap: 8px;
    }
    .mp-nd-stats {
      grid-template-columns: 1fr 1fr !important;
    }

    .mp-detail-body .mp-card,
    .mp-detail-body .mp-listings,
    .mp-detail-body .mp-network-wrap,
    .mp-detail-body .mp-kpi-grid {
      margin-left: var(--mp-pad-x);
      margin-right: var(--mp-pad-r);
    }
    .mp-kpi-grid {
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .mp-kpi-value { font-size: 1.25rem; }
    .mp-action-grid { grid-template-columns: 1fr 1fr; }
    .mp-wordmark-btn { font-size: 1.05rem; }

    /* Feature choice modal → bottom sheet on phone */
    .mp-overlay {
      align-items: flex-end !important;
      padding: 0 !important;
    }
    .mp-feature-choice-modal {
      width: 100% !important;
      max-width: 100% !important;
      border-radius: 20px 20px 0 0 !important;
      max-height: min(88dvh, 720px);
      overflow-y: auto;
      -webkit-overflow-scrolling: touch;
      margin: 0;
      padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px)) !important;
    }
    .mp-fc-product-list {
      max-height: min(36vh, 240px);
    }
    .mp-fc-product {
      min-height: 64px;
    }

    .mp-pnav-more-sheet {
      width: min(300px, calc(100vw - 20px));
      border-radius: 16px;
      max-height: min(60vh, 420px);
      overflow-y: auto;
      z-index: 50;
    }
    .mp-pnav-more-item {
      min-height: 48px;
      padding: 10px 12px;
    }

    /* Touch & text safety */
    .mp-page button,
    .mp-page a,
    .mp-page [role="button"] {
      -webkit-tap-highlight-color: transparent;
    }
    .mp-page img {
      max-width: 100%;
    }
    .mp-promo-item,
    .mp-fc-product {
      max-width: 100%;
    }
    .mp-promo-title,
    .mp-fc-product-title {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  @media (max-width: 380px) {
    .mp-stat strong { font-size: 0.95rem; }
    .mp-stat span { font-size: 0.55rem; }
    .mp-action-grid { grid-template-columns: 1fr; }
    .mp-kpi-grid { grid-template-columns: 1fr 1fr; }
    .mp-net-section-hint { display: none; }
    .mp-hero-media {
      height: 100px;
      max-height: 100px;
    }
    .mp-hero-avatar .mp-avatar { width: 84px; height: 84px; }
    .mp-hero-col-id { margin-top: -38px; }
    .mp-hero-col-side { display: flex; flex-direction: column; }
    .mp-od-welcome-cta { grid-template-columns: 1fr; }
    .mp-inv-kpi-strip { grid-template-columns: 1fr 1fr; }
    .mp-pnav-mob-label { font-size: 0.55rem; }
    .mp-detail-sub { display: none; }
    .mp-od-chip em { display: none; }
  }

  @media (min-width: 480px) {
    .mp-action-grid { grid-template-columns: 1fr 1fr 1fr; }
  }

  /* Tablet: 2-col (nav 280 + center); insights stacked under */
  @media (min-width: 768px) {
    .mp-page {
      --mp-pad-x: 0px;
      --mp-pad-r: 0px;
      --mp-bottom-clear: calc(88px + env(safe-area-inset-bottom, 0px));
    }
    .mp-title-phone { display: none; }
    .mp-title-desk { display: inline; }
    .mp-mobile-sections { display: none; }
    .mp-pnav-mob { display: none !important; }
    .mp-pnav-desk {
      display: flex;
      max-width: none;
      width: 100%;
      /* Explicit viewport cap so .mp-pnav-desk-body can scroll */
      max-height: calc(100dvh - var(--mp-topbar-h) - 28px);
      min-height: 0;
      height: auto;
      flex: 1 1 auto;
    }
    .mp-topbar-inner {
      padding-left: max(20px, env(safe-area-inset-left, 0px));
      padding-right: max(20px, env(safe-area-inset-right, 0px));
    }
    .mp-hero-media {
      height: 160px;
      max-height: 160px;
    }
    .mp-hero-panel {
      margin-top: -8px;
      padding-left: max(16px, env(safe-area-inset-left, 0px));
      padding-right: max(16px, env(safe-area-inset-right, 0px));
    }
    .mp-hero-panel-inner {
      padding: 8px;
      border-radius: 14px;
    }
    /* Tablet two-row: identity | main, then insights full width */
    .mp-hero-grid {
      display: grid;
      grid-template-columns: minmax(240px, 280px) minmax(0, 1fr);
      grid-template-rows: auto auto;
      grid-template-areas:
        "id main"
        "side side";
      gap: 8px 12px;
      align-items: stretch;
    }
    .mp-hero-col-id {
      grid-area: id;
      align-items: stretch;
      text-align: left;
      margin-top: -50px; /* ~45% of 112px avatar */
      gap: 8px;
      height: auto;
    }
    .mp-hero-col-main {
      grid-area: main;
      height: auto;
    }
    .mp-hero-col-side {
      grid-area: side;
      display: flex;
      flex-direction: column;
      gap: 8px;
      height: auto;
      align-self: start;
    }
    .mp-seller-insights-grid {
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      align-items: start;
    }
    .mp-si-activity {
      grid-column: 1 / -1;
    }
    .mp-hero-id-block {
      flex-direction: row;
      align-items: flex-end;
      text-align: left;
      gap: 12px;
    }
    .mp-hero-id { align-items: flex-start; }
    .mp-hero-name-row,
    .mp-hero-meta-row { justify-content: flex-start; }
    .mp-hero-avatar .mp-avatar {
      width: 112px;
      height: 112px;
      font-size: 2.2rem;
    }
    .mp-hero-stats {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
    }
    .mp-hero-stat-n { font-size: 1.55rem; }
    .mp-hero-actions { margin-top: 0; gap: 8px; }
    .mp-hero-chips { margin-top: 0; }
    .mp-hero-insight-activity { grid-column: auto; }

    .mp-shell,
    .mp-shell.is-nav,
    .mp-shell.is-detail {
      display: grid;
      grid-template-columns: 280px minmax(0, 1fr);
      gap: 16px 18px;
      align-items: start;
      width: 100%;
      margin: 0 auto;
      padding: 18px 20px 28px;
      max-width: 1440px;
    }
    .mp-shell.is-nav .mp-col-detail,
    .mp-shell.is-detail .mp-col-nav,
    .mp-shell.is-nav .mp-col-insights,
    .mp-shell.is-detail .mp-col-insights {
      display: flex;
    }
    .mp-col-nav,
    .mp-col-detail,
    .mp-col-insights {
      display: flex;
      flex-direction: column;
      min-width: 0;
    }
    .mp-col-nav {
      position: sticky;
      top: calc(var(--mp-topbar-h) + 12px);
      /* Fit viewport under topbar so the nav card can scroll internally */
      max-height: calc(100dvh - var(--mp-topbar-h) - 28px);
      height: fit-content;
      min-height: 0;
      overflow: visible; /* scroll happens inside .mp-pnav-desk-body */
      display: flex;
      flex-direction: column;
      align-self: start;
      padding-bottom: 0;
    }
    .mp-col-insights::-webkit-scrollbar { width: 6px; }
    .mp-col-insights::-webkit-scrollbar-thumb {
      background: rgba(15, 157, 88, 0.25);
      border-radius: var(--mp-r-pill);
    }
    .mp-col-insights {
      grid-column: 1 / -1;
      position: static;
      max-height: none;
    }
    .mp-insights {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 12px;
    }
    .mp-insights-head { grid-column: 1 / -1; }

    .mp-nav-card,
    .mp-pnav-desk,
    .mp-detail-bar {
      margin-left: 0;
      margin-right: 0;
    }
    .mp-detail-bar {
      flex-direction: row;
      align-items: center;
      gap: 14px;
      position: sticky;
      top: calc(var(--mp-topbar-h) + 12px);
      z-index: 5;
      margin-bottom: 4px;
    }
    .mp-detail-back { display: none; }
    .mp-detail-cta {
      align-self: center;
      margin-left: auto;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .mp-detail-body .mp-card,
    .mp-detail-body .mp-listings,
    .mp-detail-body .mp-network-wrap,
    .mp-detail-body .mp-kpi-grid,
    .mp-detail-body .mp-subtabs {
      margin-left: 0;
      margin-right: 0;
    }
    .mp-card { margin-bottom: 14px; width: 100%; }
    .mp-listings,
    .mp-network-wrap {
      margin: 0 0 14px;
      padding: 0;
      width: 100%;
    }
    .mp-subtabs { margin-bottom: 12px; }
    .mp-action-grid { grid-template-columns: 1fr 1fr; }
    .mp-trust-grid { grid-template-columns: 1fr 1fr 1fr; }
    .mp-kpi-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 12px;
      margin-left: 0;
      margin-right: 0;
    }
  }

  /* Desktop: 280 · flexible · 340 */
  @media (min-width: 1100px) {
    .mp-seller-insights-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .mp-si-activity {
      grid-column: auto;
    }
    .mp-page {
      --mp-bottom-clear: calc(96px + env(safe-area-inset-bottom, 0px));
    }
    .mp-topbar-inner { padding: 12px 28px; }
    .mp-hero-media {
      height: 180px;
      max-height: 200px;
    }
    .mp-hero-panel {
      padding-left: 16px;
      padding-right: 16px;
      margin-top: -8px;
    }
    .mp-hero-panel-inner {
      padding: 8px;
    }
    /*
      Desktop grid: [ profile 280 ] [ center 1fr ] [ insights 340 ]
      Compact cover — dashboard is the priority.
    */
    .mp-hero-grid {
      display: grid;
      grid-template-columns: 280px minmax(0, 1fr) 340px;
      grid-template-rows: auto;
      grid-template-areas: "id main side";
      gap: 8px 12px;
      align-items: stretch;
      width: 100%;
    }
    .mp-hero-col-id {
      grid-area: id;
      margin-top: -52px; /* ~45% of 116px avatar over banner */
      align-items: stretch;
      gap: 8px;
      height: auto;
      align-self: stretch;
    }
    .mp-hero-col-main {
      grid-area: main;
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
      height: auto;
      align-self: stretch;
      justify-content: flex-start;
      padding-top: 0;
    }
    .mp-hero-col-side {
      grid-area: side;
      grid-column: auto;
      display: flex;
      flex-direction: column;
      gap: 8px;
      height: auto;
      align-self: start; /* strength-only card — do not stretch empty space */
      position: static;
    }
    .mp-hero-id-block {
      flex-direction: column;
      align-items: flex-start;
      text-align: left;
      gap: 8px;
    }
    .mp-hero-avatar .mp-avatar {
      width: 116px;
      height: 116px;
      font-size: 2.2rem;
    }
    .mp-hero-stats {
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 8px;
      width: 100%;
    }
    .mp-hero-stat-n { font-size: 1.7rem; }
    .mp-hero-stat { padding: 10px 10px 8px; border-radius: 12px; }
    .mp-hero-actions { margin-top: 0; gap: 8px; width: 100%; }
    .mp-hero-chips { margin-top: 0; width: 100%; }
    /* Fill stretch space without looking like a blank void */
    .mp-hero-col-id,
    .mp-hero-col-main,
    .mp-hero-col-side {
      background: transparent;
    }
    .mp-hero-col-side .mp-hero-insight-activity {
      flex: 1 1 auto;
      min-height: 0;
    }

    .mp-shell,
    .mp-shell.is-nav,
    .mp-shell.is-detail {
      grid-template-columns: 280px minmax(0, 1fr) 340px;
      gap: 18px 20px;
      padding: 18px 28px 32px;
      max-width: none;
    }
    .mp-col-insights {
      grid-column: auto;
      position: sticky;
      top: calc(var(--mp-topbar-h) + 12px);
      max-height: calc(100dvh - var(--mp-topbar-h) - 24px);
      overflow-y: auto;
      display: flex;
    }
    .mp-insights {
      display: flex;
      flex-direction: column;
    }
    .mp-insights-head { grid-column: auto; }
  }

  @media (min-width: 1280px) {
    .mp-topbar-inner { padding: 12px 36px; }
    .mp-hero-media {
      height: 180px;
      max-height: 200px;
    }
    .mp-hero-panel { padding-left: 24px; padding-right: 24px; }
    .mp-hero-grid {
      grid-template-columns: 280px minmax(0, 1fr) 340px;
      gap: 8px 16px;
    }
    .mp-hero-stat-n { font-size: 1.8rem; }
    .mp-shell,
    .mp-shell.is-nav,
    .mp-shell.is-detail {
      padding: 20px 36px 36px;
      gap: 20px 24px;
    }
    .mp-kpi-grid { grid-template-columns: repeat(5, minmax(0, 1fr)); }
    .mp-listing-list {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .mp-listing-card { height: 100%; }
  }

  @media (min-width: 1440px) {
    .mp-topbar-inner { padding: 14px 48px; }
    .mp-hero-panel { padding-left: 32px; padding-right: 32px; }
    .mp-hero-grid {
      grid-template-columns: 280px minmax(0, 1fr) 340px;
    }
    .mp-shell,
    .mp-shell.is-nav,
    .mp-shell.is-detail {
      padding: 24px 48px 40px;
      gap: 22px 28px;
    }
    .mp-action-grid { grid-template-columns: 1fr 1fr 1fr; }
  }
`
