import { useEffect, useState, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isListingFeatured } from '../utils/homeUtils'
import VouchSection from '../components/VouchSection'
import FollowButton from '../components/FollowButton'
import FollowersManager from '../components/FollowersManager'
import { useVouchData } from '../hooks/useVouchData'
import { useStatuses } from '../hooks/useStatuses'
import StoryViewer from '../components/StoryViewer'

/* ═══════════════════════════════════════════════════════════════════════════
   Public seller profile — premium white, mobile-first layout
   Cover · Identity · Actions · Trust · Achievements · Reviews · Status ·
   Stats · Shop · Listings · Sold
   ═══════════════════════════════════════════════════════════════════════════ */

const VerifiedSeal = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#16a34a" d="M12 0a4 4 0 0 1 3.2 1.6 4 4 0 0 1 3.6 1 4 4 0 0 1 1 3.6A4 4 0 0 1 21.4 9.4a4 4 0 0 1 0 5.2A4 4 0 0 1 19.8 17.8a4 4 0 0 1-1 3.6 4 4 0 0 1-3.6 1A4 4 0 0 1 12 24a4 4 0 0 1-3.2-1.6 4 4 0 0 1-3.6-1 4 4 0 0 1-1-3.6A4 4 0 0 1 2.6 14.6a4 4 0 0 1 0-5.2A4 4 0 0 1 4.2 6.2a4 4 0 0 1 1-3.6 4 4 0 0 1 3.6-1A4 4 0 0 1 12 0Z" />
    <path d="m7.5 12.5 3 3 6-7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function getOnlineStatus(lastSeen) {
  if (!lastSeen) return { label: 'Offline', color: '#9ca3af' }
  const mins = Math.floor((Date.now() - new Date(lastSeen)) / 60000)
  if (mins < 5) return { label: 'Online now', color: '#15803d' }
  if (mins < 60) return { label: `Active ${mins}m ago`, color: '#d97706' }
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return { label: `Active ${hrs}h ago`, color: '#9ca3af' }
  return { label: 'Offline', color: '#9ca3af' }
}

function isVideoUrl(url, mediaType) {
  const u = String(url || '')
  if (/\.(mp4|mov|webm)(\?|$)/i.test(u)) return true
  if (/\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(u)) return false
  return mediaType === 'video'
}

const ACHIEVEMENT_ICONS = {
  verified: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><path d="m9 12 2 2 4-4" />
    </svg>
  ),
  trusted: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  ),
  active: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    </svg>
  ),
  fast: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" />
    </svg>
  ),
  community: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  top: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 4 3 12h14l3-12-6 7-4-7-4 7-6-7z" /><path d="M12 22v-6" />
    </svg>
  ),
  early: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3v3" /><path d="m6.3 7.7 2.1 2.1" /><path d="M3 14h3" /><path d="m17.7 7.7-2.1 2.1" /><path d="M21 14h-3" /><path d="M8 21h8" /><path d="M12 17a5 5 0 0 0 0-10" />
    </svg>
  ),
}

const LEVEL_STYLES = {
  'Elite Seller': { bg: '#fefce8', color: '#854d0e', border: '#fde047' },
  'Pro Seller': { bg: '#eff6ff', color: '#1e40af', border: '#bfdbfe' },
  'Rising Seller': { bg: '#fef3c7', color: '#92400e', border: '#fcd34d' },
  'New Seller': { bg: '#f3f4f6', color: '#374151', border: '#e5e7eb' },
}

export default function PublicProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [listings, setListings] = useState([])
  const [soldListings, setSoldListings] = useState([])
  const [soldCount, setSoldCount] = useState(0)
  const [followerCount, setFollowerCount] = useState(0)
  const [shop, setShop] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [shareToast, setShareToast] = useState('')
  const [showAllSold, setShowAllSold] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [viewerStories, setViewerStories] = useState([])
  const { statuses: sellerStatuses } = useStatuses(id)
  const sellerStatus = sellerStatuses[0] || null
  const { trustScore, dealCount, loading: trustLoading } = useVouchData(id, currentUserId)

  useEffect(() => { load() }, [id])

  const openSellerStatusGroup = useCallback((startIndex = 0) => {
    if (!sellerStatuses.length) return
    const group = sellerStatuses.map((s) => ({
      ...s,
      profiles: {
        id: profile?.id || s.user_id,
        full_name: profile?.full_name,
        avatar_url: profile?.avatar_url,
        city: profile?.city,
      },
    }))
    if (currentUserId) {
      group.forEach((s) => {
        if (!s?.id) return
        supabase.from('status_views')
          .upsert(
            { status_id: s.id, viewer_id: currentUserId },
            { onConflict: 'status_id,viewer_id' },
          )
          .then(() => {}, () => {})
      })
    }
    setViewerStories(group)
    setViewing(startIndex)
  }, [sellerStatuses, profile, currentUserId])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)

    const { data: p } = await supabase.from('profiles').select('*').eq('id', id).single()
    setProfile(p)

    // Marketplace: published/active. Sold: private Profile loads ALL then filters;
    // public viewers need sold RLS or get_public_seller_sold_listings RPC.
    const isSelf = !!user?.id && user.id === id

    const [listingsRes, soldListRes, soldRpcRes, statsRes, folRes, allOwnRes] = await Promise.all([
      supabase.from('listings').select('*')
        .eq('seller_id', id)
        .in('status', ['active', 'published'])
        .order('created_at', { ascending: false }),
      supabase.from('listings').select('*')
        .eq('seller_id', id).eq('status', 'sold')
        .order('updated_at', { ascending: false }).limit(24),
      supabase.rpc('get_public_seller_sold_listings', { p_seller_id: id, p_limit: 24 }),
      supabase.rpc('get_seller_dashboard_stats', { p_user_id: id }),
      supabase.from('seller_follows').select('id', { count: 'exact', head: true })
        .eq('seller_id', id),
      // Same approach as private Profile.jsx loadListings (owner can always read own sold)
      isSelf
        ? supabase.from('listings').select('*')
            .eq('seller_id', id)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: null, error: null }),
    ])

    // Shop fetch — same owner_id as ShopDashboard / ShopSetup.
    // Prefer array + [0] over maybeSingle() (maybeSingle errors if 2+ shops exist).
    let shopData = null
    {
      const primary = await supabase
        .from('shops')
        .select('id, name, slug, is_verified, logo_url, city, district, category, is_active, owner_id')
        .eq('owner_id', id)
        .limit(1)

      if (primary.error) {
        const fallback = await supabase
          .from('shops')
          .select('id, name, slug, logo_url, city, owner_id')
          .eq('owner_id', id)
          .limit(1)
        if (fallback.error) {
          console.error('[PublicProfile] shop fetch failed:', fallback.error)
        } else {
          shopData = fallback.data?.[0] || null
        }
      } else {
        shopData = primary.data?.[0] || null
      }
    }

    let activeListings = listingsRes.data || []
    let soldFromQuery = Array.isArray(soldListRes.data) ? soldListRes.data : []
    const soldFromRpc = (!soldRpcRes?.error && Array.isArray(soldRpcRes?.data))
      ? soldRpcRes.data
      : []

    // Owner viewing their public profile: mirror private Profile filtering
    if (isSelf && Array.isArray(allOwnRes?.data) && allOwnRes.data.length) {
      const all = allOwnRes.data
      activeListings = all.filter(
        (l) => l.status !== 'sold' && l.status !== 'deleted' && l.status !== 'draft',
      )
      soldFromQuery = all.filter((l) => l.status === 'sold')
    }

    const soldListingsData = soldFromQuery.length > 0 ? soldFromQuery : soldFromRpc
    const stats = (statsRes?.data && typeof statsRes.data === 'object' && !statsRes.error)
      ? statsRes.data
      : null

    setListings(activeListings)
    setSoldListings(soldListingsData)
    setSoldCount(
      typeof stats?.sold_listings === 'number'
        ? Math.max(stats.sold_listings, soldListingsData.length)
        : soldListingsData.length
    )
    setFollowerCount(
      typeof stats?.followers === 'number'
        ? stats.followers
        : (folRes.count || 0)
    )
    setShop(shopData)
    setLoading(false)

    if (id) {
      try {
        let sessionKey = null
        try {
          sessionKey = sessionStorage.getItem('soko_view_session')
          if (!sessionKey) {
            sessionKey = `s_${Math.random().toString(36).slice(2)}_${Date.now()}`
            sessionStorage.setItem('soko_view_session', sessionKey)
          }
        } catch { /* private mode */ }
        await supabase.rpc('record_profile_view', {
          p_profile_id: id,
          p_session_key: sessionKey,
          p_source: 'public_profile',
        })
      } catch { /* RPC may not be migrated yet */ }
    }
  }

  async function shareProfile() {
    const url = `${window.location.origin}/profile/${id}`
    const title = profile?.full_name ? `${profile.full_name} on SokoMw` : 'SokoMw seller profile'
    try {
      if (navigator.share) {
        await navigator.share({ title, text: `Check out ${title}`, url })
        return
      }
      await navigator.clipboard.writeText(url)
      setShareToast('Link copied')
      setTimeout(() => setShareToast(''), 2000)
    } catch { /* user cancelled share */ }
  }

  function callSeller() {
    if (profile?.phone) window.location.href = `tel:${profile.phone}`
  }

  const displaySold = showAllSold ? soldListings : soldListings.slice(0, 4)

  const derived = useMemo(() => {
    if (!profile) return null
    const status = getOnlineStatus(profile.last_seen)
    const isOwnProfile = currentUserId === profile?.id
    const memberSince = profile.created_at
      ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
      : null
    const shopPath = shop?.slug
      ? `/shop/${shop.slug}`
      : (shop?.id ? `/shop/${shop.id}` : null)
    const isFastResponder = !!profile.fast_responder ||
      (profile.response_sample_count >= 5 && (profile.avg_response_seconds || 9999) <= 1800)

    const sellerLevel = (dealCount || 0) >= 50 ? 'Elite Seller'
      : (dealCount || 0) >= 20 ? 'Pro Seller'
      : (dealCount || 0) >= 5 ? 'Rising Seller'
      : 'New Seller'

    const trustHighlights = [
      { key: 'verified', done: !!profile.is_verified, label: 'Verified Identity' },
      { key: 'deals', done: (dealCount || 0) > 0, label: `${dealCount || 0} Successful Deal${dealCount === 1 ? '' : 's'}` },
      { key: 'fast', done: isFastResponder, label: 'Fast Responder' },
      { key: 'community', done: (trustScore || 0) >= 60, label: 'Trusted by Community' },
    ].filter(h => h.done)

    const isEarlyAdopter = !!profile.created_at
      && new Date(profile.created_at).getTime() < new Date('2026-06-01T00:00:00Z').getTime()
    const isTopSeller = (dealCount || 0) >= 20
    const isActiveSeller = listings.length >= 1
    const isTrustedSeller = (trustScore || 0) >= 30 || (dealCount || 0) >= 5
    const isCommunityMember = (followerCount || 0) >= 1

    const unlockedAchievements = [
      { id: 'verified', label: 'Verified Seller', hint: 'Identity confirmed', unlocked: !!profile.is_verified },
      { id: 'trusted', label: 'Trusted Seller', hint: 'Strong buyer trust', unlocked: isTrustedSeller },
      { id: 'active', label: 'Active Seller', hint: 'Live inventory', unlocked: isActiveSeller },
      { id: 'fast', label: 'Fast Responder', hint: 'Quick replies', unlocked: isFastResponder },
      { id: 'community', label: 'Community Member', hint: 'Local network', unlocked: isCommunityMember },
      { id: 'top', label: 'Top Seller', hint: 'Elite reputation', unlocked: isTopSeller },
      { id: 'early', label: 'Early Adopter', hint: 'Joined early', unlocked: isEarlyAdopter },
    ].filter((a) => a.unlocked)

    const statusFeed = sellerStatuses.length > 0
      ? sellerStatuses
      : (sellerStatus ? [sellerStatus] : [])

    return {
      status,
      isOwnProfile,
      memberSince,
      shopPath,
      isFastResponder,
      sellerLevel,
      trustHighlights,
      unlockedAchievements,
      statusFeed,
    }
  }, [
    profile, currentUserId, shop, dealCount, trustScore,
    listings.length, followerCount, sellerStatuses, sellerStatus,
  ])

  if (loading) {
    return (
      <div className="pp-loading">
        <div className="pp-spinner" />
        <style>{PP_CSS}</style>
      </div>
    )
  }

  if (!profile || !derived) {
    return (
      <div className="pp-notfound">
        <div className="pp-notfound-title">User not found</div>
        <button type="button" onClick={() => navigate(-1)} className="pp-btn-primary">Go Back</button>
        <style>{PP_CSS}</style>
      </div>
    )
  }

  const {
    status,
    isOwnProfile,
    memberSince,
    shopPath,
    sellerLevel,
    trustHighlights,
    unlockedAchievements,
    statusFeed,
  } = derived
  const levelStyle = LEVEL_STYLES[sellerLevel] || LEVEL_STYLES['New Seller']
  const sellerName = profile.full_name || 'Seller'
  const firstName = sellerName.split(' ')[0] || sellerName
  const sellerInitial = (sellerName[0] || 'S').toUpperCase()

  return (
    <div className="pp-page">
      <style>{PP_CSS}</style>

      {shareToast && <div className="pp-toast">{shareToast}</div>}

      {/* Sticky header */}
      <header className="pp-header">
        <button type="button" onClick={() => navigate(-1)} className="pp-back" aria-label="Back">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div className="pp-header-title">{profile.full_name || 'Seller Profile'}</div>
        {isOwnProfile
          ? <button type="button" onClick={() => navigate('/profile')} className="pp-edit-hub">Edit</button>
          : (
            <button type="button" onClick={shareProfile} className="pp-back" aria-label="Share">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#111" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            </button>
          )}
      </header>

      {/* 1. Cover + Identity */}
      <div className="pp-card">
        <div className={`pp-cover${!profile.cover_url ? ' pp-cover--empty' : ''}`}>
          {profile.cover_url ? <img src={profile.cover_url} alt="" /> : null}
        </div>
        <div className="pp-hero">
          <div className="pp-avatar-wrap">
            <div className="pp-avatar">
              {profile.avatar_url
                ? <img src={profile.avatar_url} alt="" />
                : <span>{sellerInitial}</span>}
            </div>
          </div>
          <div className="pp-name">
            {sellerName === 'Seller' ? 'Anonymous' : sellerName}
            {profile.is_verified && (
              <span title="Verified" style={{ display: 'inline-flex', flexShrink: 0 }}>
                <VerifiedSeal size={18} />
              </span>
            )}
          </div>
          <div
            className="pp-level-badge"
            style={{ background: levelStyle.bg, color: levelStyle.color, border: `1px solid ${levelStyle.border}` }}
          >
            {sellerLevel}
          </div>
          <div className="pp-meta-col">
            {(profile.city || profile.country) && (
              <span>{[profile.city, profile.country || 'Malawi'].filter(Boolean).join(', ')}</span>
            )}
            {memberSince && <span>Member since {memberSince}</span>}
            <span className="pp-online-line" style={{ color: status.color }}>
              <span className="pp-status-dot" style={{ background: status.color }} />
              {status.label}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Actions */}
      <div className="pp-section">
        <div className="pp-actions-card">
          {!isOwnProfile ? (
            <>
              <button
                type="button"
                onClick={() => {
                  if (!profile?.id) return
                  if (currentUserId && profile.id === currentUserId) {
                    navigate('/chats')
                    return
                  }
                  navigate(`/chat/${profile.id}?src=direct`, {
                    state: { source: 'direct' },
                  })
                }}
                className="pp-btn-message"
              >
                Message Seller
              </button>
              <div className="pp-actions-row">
                {profile.phone && (
                  <button type="button" onClick={callSeller} className="pp-btn-call">Call Seller</button>
                )}
                <div className="pp-btn-follow-wrap">
                  <FollowButton currentUserId={currentUserId} sellerId={profile?.id} size="lg" />
                </div>
                <button type="button" onClick={shareProfile} className="pp-btn-share">Share</button>
              </div>
            </>
          ) : (
            <button type="button" onClick={shareProfile} className="pp-btn-share">Share Profile</button>
          )}
        </div>
      </div>

      {/* 3. Trust & Vouches — unified premium panel */}
      <div className="pp-section">
        <div className="pp-trust-panel">
          <div className="pp-trust-panel-head">
            <div>
              <p className="pp-trust-panel-title">Trust &amp; Vouches</p>
              <p className="pp-trust-panel-sub">Reputation signals buyers check first</p>
            </div>
            {!trustLoading && trustScore != null && (
              <div className="pp-trust-score-pill">
                <span className="pp-trust-score-n">{Math.round(trustScore)}</span>
                <span className="pp-trust-score-l">Score</span>
              </div>
            )}
          </div>

          {/* Highlights as premium chips */}
          <div className="pp-trust-panel-block">
            <p className="pp-trust-panel-label">Highlights</p>
            {!trustLoading && trustHighlights.length > 0 ? (
              <div className="pp-trust-chips">
                {trustHighlights.map((h) => (
                  <span key={h.key} className="pp-trust-chip">
                    <span className="pp-trust-chip-check" aria-hidden="true">✓</span>
                    {h.label}
                  </span>
                ))}
              </div>
            ) : (
              <p className="pp-trust-empty">
                {trustLoading ? 'Loading trust signals…' : 'New seller building trust on SokoMw.'}
              </p>
            )}
          </div>

          <div className="pp-trust-panel-divider" />

          {/* Vouches — social proof designed to raise buyer confidence */}
          <div className="pp-trust-panel-block">
            <p className="pp-trust-panel-label">Who stands behind this seller</p>
            <div className="pp-vouch-embed">
              <VouchSection
                targetUserId={id}
                viewerUserId={currentUserId}
                embedded
              />
            </div>
          </div>
        </div>
      </div>

      {/* Achievements */}
      {unlockedAchievements.length > 0 && (
        <div className="pp-section">
          <p className="pp-ach-head">Achievements</p>
          <div className="pp-ach-grid">
            {unlockedAchievements.map((a) => (
              <div key={a.id} className="pp-ach-card">
                <div className="pp-ach-badge" aria-hidden="true">
                  {ACHIEVEMENT_ICONS[a.id]}
                </div>
                <p className="pp-ach-label">{a.label}</p>
                <p className="pp-ach-hint">{a.hint}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seller Status (stories strip) */}
      <div className="pp-section">
        <div className="pp-ss-section-head">
          <p className="pp-ss-section-title">Seller Status</p>
          {statusFeed.length > 0 && (
            <span className="pp-seller-status-live">
              <span className="pp-seller-status-live-dot" aria-hidden="true" />
              Live Now
            </span>
          )}
        </div>

        {statusFeed.length === 0 && !isOwnProfile ? (
          <p className="pp-seller-status-empty">This seller hasn&apos;t shared a status yet.</p>
        ) : (
          <div className="pp-ss-strip-wrap">
            <div className="pp-ss-strip">
              {isOwnProfile && (
                <button type="button" className="pp-ss-story-create" onClick={() => navigate('/status')}>
                  <div className="pp-ss-story-create-top">
                    {profile.avatar_url ? <img src={profile.avatar_url} alt="" /> : null}
                  </div>
                  <span className="pp-ss-story-create-plus" aria-hidden="true">+</span>
                  <p className="pp-ss-story-create-label">Create story</p>
                </button>
              )}

              {statusFeed.map((post, postIndex) => {
                const mediaList = Array.isArray(post?.media_urls) ? post.media_urls.filter(Boolean) : []
                const media = mediaList[0] || null
                const video = media && isVideoUrl(media, post?.media_type)
                const isText = post?.media_type === 'text' || (!media && post?.bg_color)
                const caption = (post?.content || '').trim()
                const label = statusFeed.length > 1
                  ? (caption && caption.length <= 18 ? caption : firstName)
                  : firstName

                return (
                  <button
                    type="button"
                    key={post.id || postIndex}
                    className="pp-ss-story"
                    onClick={() => openSellerStatusGroup(postIndex)}
                  >
                    {media ? (
                      video
                        ? <video className="pp-ss-story-bg" src={media} muted playsInline preload="metadata" />
                        : <img className="pp-ss-story-bg" src={media} alt="" />
                    ) : (
                      <div
                        className="pp-ss-story-bg pp-ss-story-bg--text"
                        style={{ background: post?.bg_color || '#1e3a8a' }}
                      >
                        <span>{caption || 'Update'}</span>
                      </div>
                    )}
                    <div className="pp-ss-story-shade" />
                    <div className="pp-ss-story-ring">
                      <div className="pp-ss-story-ring-inner">
                        {profile.avatar_url
                          ? <img src={profile.avatar_url} alt="" />
                          : sellerInitial}
                      </div>
                    </div>
                    <p className="pp-ss-story-name">
                      {isText && !media ? (caption || label) : label}
                    </p>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {statusFeed.length === 0 && isOwnProfile && (
          <p className="pp-seller-status-empty" style={{ marginTop: 8 }}>
            Share a status so buyers can see you&apos;re active.
          </p>
        )}
      </div>

      {/* 5. Statistics */}
      <div className="pp-section">
        <div className="pp-stats-wrap">
          <p className="pp-stats-title">Statistics</p>
          <div className="pp-stats pp-stats--4">
            <div className="pp-stat">
              <div className="pp-stat-n">{listings.length}</div>
              <div className="pp-stat-l">Listings</div>
            </div>
            <div className="pp-stat">
              <div className="pp-stat-n">{soldCount}</div>
              <div className="pp-stat-l">Sold</div>
            </div>
            <div className="pp-stat">
              <div className="pp-stat-n">{followerCount}</div>
              <div className="pp-stat-l">Followers</div>
            </div>
            <div className="pp-stat">
              <div className="pp-stat-n">
                {trustScore != null && !trustLoading ? Math.round(trustScore) : '—'}
              </div>
              <div className="pp-stat-l">Trust Score</div>
            </div>
          </div>
        </div>
      </div>

      {/* Owner-only followers manager */}
      {isOwnProfile && (
        <div className="pp-section">
          <div className="pp-section-box">
            <FollowersManager sellerId={profile?.id} />
          </div>
        </div>
      )}

      {/* 6. Seller Shop */}
      {shop && (
        <div className="pp-section">
          <div className="pp-shop">
            <p className="pp-shop-title">Seller Shop</p>
            <div className="pp-shop-row">
              <div className="pp-shop-logo">
                {shop.logo_url
                  ? <img src={shop.logo_url} alt="" />
                  : <span>{(shop.name || 'S')[0].toUpperCase()}</span>}
              </div>
              <div className="pp-shop-info">
                <p className="pp-shop-name">
                  <span className="pp-shop-name-text">{shop.name || 'Shop'}</span>
                  {shop.is_verified && (
                    <span title="Verified shop" style={{ display: 'inline-flex', flexShrink: 0 }}>
                      <VerifiedSeal size={15} />
                    </span>
                  )}
                </p>
                {(shop.city || shop.district) && (
                  <p className="pp-shop-city">{shop.city || shop.district}</p>
                )}
              </div>
            </div>
            {shopPath && (
              <button type="button" className="pp-shop-visit" onClick={() => navigate(shopPath)}>
                Visit Shop
              </button>
            )}
          </div>
        </div>
      )}

      {/* 7. Active Listings */}
      <div className="pp-section">
        <p className="pp-active-head">Active Listings ({listings.length})</p>
        {listings.length === 0 ? (
          <div className="pp-empty">No active listings right now</div>
        ) : (
          <div className="pp-active-grid">
            {listings.map((l) => {
              const thumb = l.images?.[0] || null
              const isFeatured = isListingFeatured(l)
              const loc = l.district || l.city || l.area || null
              const views = l.view_count ?? l.views ?? null
              const posted = l.created_at
                ? new Date(l.created_at).toLocaleDateString(undefined, {
                    month: 'short', day: 'numeric', year: 'numeric',
                  })
                : null

              return (
                <article key={l.id} className="pp-alc">
                  <div className="pp-alc-media">
                    {thumb ? <img src={thumb} alt="" loading="lazy" /> : <div className="pp-alc-ph">—</div>}
                    {isFeatured && <span className="pp-alc-featured">Featured</span>}
                  </div>
                  <div className="pp-alc-body">
                    <h3 className="pp-alc-title">{l.title || 'Listing'}</h3>
                    <p className="pp-alc-price">MWK {Number(l.price || 0).toLocaleString()}</p>
                    <div className="pp-alc-meta">
                      {l.category && <span>{l.category}</span>}
                      {loc && <span>{loc}</span>}
                    </div>
                    <div className="pp-alc-foot">
                      <span>{views != null ? `${Number(views).toLocaleString()} views` : '— views'}</span>
                      <span>{posted || '—'}</span>
                    </div>
                    <button type="button" className="pp-alc-btn" onClick={() => navigate('/listing/' + l.id)}>
                      View Listing
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </div>

      {/* 8. Sold Listings */}
      {soldListings.length > 0 && (
        <div className="pp-section">
          <p className="pp-sold-head">Sold Listings ({soldCount || soldListings.length})</p>
          <div className="pp-sold-grid">
            {displaySold.map((l) => (
              <button
                key={l.id}
                type="button"
                className="pp-slc"
                onClick={() => navigate('/listing/' + l.id)}
              >
                <div className="pp-slc-media">
                  {l.images?.[0]
                    ? <img src={l.images[0]} alt="" loading="lazy" />
                    : <div className="pp-slc-ph">—</div>}
                  <span className="pp-slc-badge">Sold</span>
                </div>
                <div className="pp-slc-body">
                  <p className="pp-slc-title">{l.title || 'Listing'}</p>
                  <p className="pp-slc-price">MWK {Number(l.price || 0).toLocaleString()}</p>
                </div>
              </button>
            ))}
          </div>
          {soldListings.length > 4 && (
            <button type="button" className="pp-sold-more" onClick={() => setShowAllSold(v => !v)}>
              {showAllSold ? 'Show less' : `See all ${soldListings.length} sold items`}
            </button>
          )}
        </div>
      )}

      {viewing !== null && viewerStories.length > 0 && (
        <StoryViewer
          stories={viewerStories}
          startIndex={viewing}
          currentUserId={currentUserId}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}

/* ── Styles (single block, premium white, mobile-first) ── */
const PP_CSS = `
@keyframes fadeUp{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes spin{to{transform:rotate(360deg)}}

.pp-page{min-height:100vh;background:#f7f8fa;font-family:Inter,system-ui,sans-serif;max-width:480px;margin:0 auto;padding-bottom:60px}
@media (min-width:640px){.pp-page{max-width:720px}}
@media (min-width:1024px){.pp-page{max-width:1100px}}
.pp-loading,.pp-notfound{display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#fff;font-family:system-ui,sans-serif}
.pp-spinner{width:28px;height:28px;border:2.5px solid #e5e7eb;border-top-color:#0F9D58;border-radius:50%;animation:spin .8s linear infinite}
.pp-notfound-title{font-size:17px;font-weight:700;color:#111}
.pp-btn-primary{margin-top:16px;background:#0F9D58;color:#fff;border:none;border-radius:10px;padding:10px 24px;font-size:14px;font-weight:600;cursor:pointer}

.pp-header{background:rgba(255,255,255,.96);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);padding:10px 16px;display:flex;align-items:center;gap:10px;border-bottom:1px solid #f0f0f0;position:sticky;top:0;z-index:50}
.pp-back{width:34px;height:34px;border-radius:50%;background:#f3f4f6;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pp-header-title{flex:1;font-size:15px;font-weight:700;color:#111;letter-spacing:-.02em}
.pp-edit-hub{border:none;background:#0F9D58;color:#fff;border-radius:8px;padding:7px 14px;font-size:12px;font-weight:700;cursor:pointer}

.pp-card{background:#fff;margin:12px 14px;border-radius:18px;overflow:hidden;border:1px solid #E5E7EB;animation:fadeUp .28s ease both;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.pp-cover{height:120px;background:#E8F5E9;overflow:hidden}
.pp-cover img{width:100%;height:100%;object-fit:cover;display:block}
.pp-cover--empty{background:linear-gradient(135deg,#E8F5E9 0%,#D1FAE5 50%,#ECFDF5 100%)}
.pp-hero{padding:0 20px 18px;display:flex;flex-direction:column;align-items:center;text-align:center}
.pp-avatar-wrap{position:relative;margin-top:-40px;margin-bottom:12px}
.pp-avatar{width:80px;height:80px;border-radius:50%;overflow:hidden;background:linear-gradient(135deg,#0F9D58,#0a7a44);display:flex;align-items:center;justify-content:center;border:3px solid #fff;box-shadow:0 0 0 1px #e5e7eb,0 4px 14px rgba(0,0,0,.1);color:#fff;font-size:28px;font-weight:700}
.pp-avatar img{width:100%;height:100%;object-fit:cover}
@media (min-width:480px){.pp-cover{height:140px}.pp-avatar{width:92px;height:92px}.pp-avatar-wrap{margin-top:-46px}}
.pp-online-line{display:inline-flex;align-items:center;gap:5px;font-size:12px;font-weight:500}
.pp-status-dot{width:6px;height:6px;border-radius:50%;flex-shrink:0}
.pp-name{font-size:20px;font-weight:700;color:#111827;letter-spacing:-.03em;display:inline-flex;align-items:center;justify-content:center;flex-wrap:wrap;gap:6px;line-height:1.25;margin:0 0 6px}
.pp-level-badge{display:inline-flex;align-items:center;justify-content:center;padding:4px 12px;border-radius:999px;font-size:11px;font-weight:700;letter-spacing:.2px;white-space:nowrap;margin-bottom:8px}
.pp-meta-col{display:flex;flex-direction:column;align-items:center;gap:3px;font-size:12.5px;color:#6B7280;font-weight:500}
.pp-meta-col span{line-height:1.35}

.pp-section{margin:0 14px 12px}
.pp-section-label{font-size:11px;font-weight:700;color:#9ca3af;text-transform:uppercase;letter-spacing:.6px;margin-bottom:8px;padding-left:2px}
.pp-section-box{background:#fff;border-radius:16px;overflow:hidden;border:1px solid #ebebeb}

.pp-actions-card{background:#fff;border:1px solid #E5E7EB;border-radius:16px;padding:14px;box-shadow:0 1px 2px rgba(0,0,0,.04);display:flex;flex-direction:column;gap:8px}
.pp-actions-row{display:flex;gap:8px}
.pp-btn-message{flex:1;border:none;border-radius:12px;background:#0F9D58;color:#fff;font-weight:700;font-size:14px;padding:12px 14px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.pp-btn-call,.pp-btn-share{flex:1;border:1px solid #E5E7EB;border-radius:12px;background:#fff;color:#111827;font-weight:600;font-size:13.5px;padding:12px;cursor:pointer;display:flex;align-items:center;justify-content:center}
.pp-btn-follow-wrap{flex:1;display:flex;min-width:0}
.pp-btn-follow-wrap>*{flex:1;width:100%}

/* Unified Trust & Vouches panel */
.pp-trust-panel{background:#fff;border:1px solid #E5E7EB;border-radius:20px;padding:18px 16px 14px;box-shadow:0 1px 3px rgba(0,0,0,.04),0 8px 24px rgba(15,157,88,.04);overflow:hidden}
.pp-trust-panel-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;margin-bottom:16px}
.pp-trust-panel-title{font-size:16px;font-weight:700;color:#111827;margin:0;letter-spacing:-.02em}
.pp-trust-panel-sub{font-size:12px;font-weight:400;color:#6B7280;margin:4px 0 0;line-height:1.35}
.pp-trust-score-pill{flex-shrink:0;min-width:56px;padding:8px 10px;border-radius:14px;background:linear-gradient(145deg,#ECFDF5,#D1FAE5);border:1px solid #A7F3D0;text-align:center}
.pp-trust-score-n{display:block;font-size:18px;font-weight:800;color:#065F46;letter-spacing:-.03em;line-height:1.1}
.pp-trust-score-l{display:block;font-size:10px;font-weight:600;color:#059669;text-transform:uppercase;letter-spacing:.04em;margin-top:2px}
.pp-trust-panel-block{min-width:0}
.pp-trust-panel-label{font-size:11px;font-weight:700;color:#9CA3AF;text-transform:uppercase;letter-spacing:.55px;margin:0 0 10px}
.pp-trust-chips{display:flex;flex-wrap:wrap;gap:8px}
.pp-trust-chip{display:inline-flex;align-items:center;gap:6px;padding:7px 12px;border-radius:999px;background:#FAFAFA;border:1px solid #E5E7EB;font-size:12.5px;font-weight:600;color:#111827;line-height:1.2;box-shadow:0 1px 2px rgba(0,0,0,.02)}
.pp-trust-chip-check{width:16px;height:16px;border-radius:50%;background:#0F9D58;color:#fff;display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0}
.pp-trust-panel-divider{height:1px;background:linear-gradient(90deg,transparent,#E5E7EB 12%,#E5E7EB 88%,transparent);margin:16px 0 14px}
.pp-trust-empty{font-size:12.5px;color:#9ca3af;font-weight:500;margin:0}
.pp-vouch-embed{min-width:0}
.pp-vouch-embed>div{margin:0!important;width:100%}
.pp-vouch-embed>div>div{max-width:100%}

.pp-ss-section-head{display:flex;align-items:center;gap:8px 10px;flex-wrap:wrap;padding:0 2px 8px}
.pp-ss-section-title{font-size:15px;font-weight:600;color:#111827;margin:0}
.pp-seller-status-live{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:500;color:#15803d;background:#ECFDF5;border-radius:999px;padding:3px 9px}
.pp-seller-status-live-dot{width:7px;height:7px;border-radius:50%;background:#16A34A}
.pp-ss-strip-wrap{margin:0 -14px;padding:0 14px}
.pp-ss-strip{display:flex;gap:10px;overflow-x:auto;padding:2px 2px 8px;scroll-snap-type:x mandatory;-webkit-overflow-scrolling:touch;scrollbar-width:none}
.pp-ss-strip::-webkit-scrollbar{display:none}
.pp-ss-story{flex:0 0 112px;width:112px;height:200px;border-radius:14px;overflow:hidden;position:relative;cursor:pointer;scroll-snap-align:start;background:#1c1e21;border:none;padding:0;font-family:inherit;text-align:left}
.pp-ss-story-bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;background:#2d3436}
.pp-ss-story-bg--text{display:flex;align-items:center;justify-content:center;padding:36px 10px 40px;text-align:center}
.pp-ss-story-bg--text span{color:#fff;font-size:12px;font-weight:700;line-height:1.35;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;overflow:hidden}
.pp-ss-story-shade{position:absolute;inset:0;background:linear-gradient(180deg,rgba(0,0,0,.08) 0%,transparent 32%,rgba(0,0,0,.15) 55%,rgba(0,0,0,.72) 100%);pointer-events:none}
.pp-ss-story-ring{position:absolute;top:10px;left:10px;width:40px;height:40px;border-radius:50%;padding:2.5px;background:conic-gradient(#0866ff 0deg 320deg,#45bd62 320deg 360deg);box-sizing:border-box;z-index:2}
.pp-ss-story-ring-inner{width:100%;height:100%;border-radius:50%;overflow:hidden;background:#0F9D58;border:2.5px solid #1c1e21;display:flex;align-items:center;justify-content:center;color:#fff;font-size:13px;font-weight:700}
.pp-ss-story-ring-inner img{width:100%;height:100%;object-fit:cover}
.pp-ss-story-name{position:absolute;left:8px;right:8px;bottom:10px;z-index:2;margin:0;color:#fff;font-size:12px;font-weight:700;line-height:1.25;text-shadow:0 1px 3px rgba(0,0,0,.65);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.pp-ss-story-create{flex:0 0 112px;width:112px;height:200px;border-radius:14px;overflow:hidden;position:relative;cursor:pointer;scroll-snap-align:start;background:#fff;border:1px solid #E4E6EB;padding:0;font-family:inherit}
.pp-ss-story-create-top{height:62%;background:#E4E6EB;overflow:hidden}
.pp-ss-story-create-top img{width:100%;height:100%;object-fit:cover}
.pp-ss-story-create-plus{position:absolute;left:50%;bottom:0;transform:translate(-50%,50%);width:36px;height:36px;border-radius:50%;background:#0866ff;border:3px solid #fff;color:#fff;font-size:22px;font-weight:500;display:flex;align-items:center;justify-content:center;z-index:2}
.pp-ss-story-create-label{position:absolute;left:0;right:0;bottom:14px;text-align:center;font-size:12px;font-weight:600;color:#050505;margin:0}
.pp-seller-status-empty{font-size:13.5px;font-weight:500;color:#6B7280;margin:0;padding:16px 14px;background:#fff;border:1px solid #E5E7EB;border-radius:16px}

.pp-stats-wrap{background:#fff;border:1px solid #E5E7EB;border-radius:16px;padding:14px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.pp-stats-title{font-size:13px;font-weight:600;color:#111827;margin:0 0 12px}
.pp-stats{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}
@media (min-width:400px){.pp-stats--4{grid-template-columns:repeat(4,1fr)}}
.pp-stat{background:#FAFAFA;border:1px solid #E5E7EB;border-radius:12px;padding:12px 8px;text-align:center;min-width:0}
.pp-stat-n{font-size:18px;font-weight:700;color:#111827;letter-spacing:-.03em;line-height:1.15}
.pp-stat-l{font-size:11px;color:#6B7280;font-weight:500;margin-top:4px}

.pp-shop{background:#fff;border:1px solid #E5E7EB;border-radius:16px;padding:16px;box-shadow:0 1px 2px rgba(0,0,0,.04)}
.pp-shop-title{font-size:13px;font-weight:600;color:#111827;margin:0 0 14px}
.pp-shop-row{display:flex;align-items:center;gap:14px}
.pp-shop-logo{width:56px;height:56px;border-radius:14px;overflow:hidden;background:#F3F4F6;border:1px solid #E5E7EB;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;color:#0F9D58}
.pp-shop-logo img{width:100%;height:100%;object-fit:cover;display:block}
.pp-shop-info{flex:1;min-width:0}
.pp-shop-name{font-size:15px;font-weight:600;color:#111827;margin:0;display:flex;align-items:center;gap:6px}
.pp-shop-name-text{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pp-shop-city{font-size:13px;color:#6B7280;margin:4px 0 0}
.pp-shop-visit{margin-top:14px;width:100%;border:none;border-radius:12px;background:#0F9D58;color:#fff;font-weight:600;font-size:14px;padding:12px 16px;cursor:pointer;font-family:inherit}

.pp-active-head,.pp-sold-head,.pp-ach-head{font-size:13px;font-weight:600;color:#111827;margin:0 0 12px}
.pp-active-grid{display:grid;grid-template-columns:1fr;gap:12px}
@media (min-width:640px){.pp-active-grid{grid-template-columns:1fr 1fr}}
@media (min-width:1024px){.pp-active-grid{grid-template-columns:repeat(4,1fr)}}
.pp-alc{background:#fff;border:1px solid #E5E7EB;border-radius:16px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 1px 2px rgba(0,0,0,.04);min-width:0}
.pp-alc-media{position:relative;width:100%;aspect-ratio:4/3;background:#F3F4F6;overflow:hidden}
.pp-alc-media img{width:100%;height:100%;object-fit:cover;display:block}
.pp-alc-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:28px;color:#9CA3AF}
.pp-alc-featured{position:absolute;top:10px;left:10px;background:#FF7A1A;color:#fff;font-size:10px;font-weight:700;border-radius:999px;padding:4px 9px;z-index:1}
.pp-alc-body{padding:12px 12px 14px;display:flex;flex-direction:column;flex:1;min-width:0}
.pp-alc-title{font-size:14px;font-weight:600;color:#111827;margin:0;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.pp-alc-price{font-size:15px;font-weight:700;color:#0F9D58;margin:8px 0 0}
.pp-alc-meta{display:flex;flex-wrap:wrap;gap:4px 10px;margin-top:8px;font-size:12px;color:#6B7280}
.pp-alc-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;font-size:11.5px;color:#9CA3AF;font-weight:500}
.pp-alc-btn{margin-top:12px;width:100%;border:1px solid #E5E7EB;border-radius:10px;background:#FAFAFA;color:#111827;font-weight:600;font-size:13px;padding:10px 12px;cursor:pointer;font-family:inherit}

.pp-sold-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media (min-width:640px){.pp-sold-grid{grid-template-columns:repeat(3,1fr)}}
@media (min-width:1024px){.pp-sold-grid{grid-template-columns:repeat(4,1fr)}}
.pp-slc{background:#fff;border:1px solid #E5E7EB;border-radius:14px;overflow:hidden;padding:0;text-align:left;font-family:inherit;display:block;width:100%;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,.03)}
.pp-slc-media{position:relative;width:100%;aspect-ratio:1;background:#F3F4F6;overflow:hidden}
.pp-slc-media img{width:100%;height:100%;object-fit:cover;display:block;filter:grayscale(.25);opacity:.9}
.pp-slc-ph{width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:22px;color:#9CA3AF}
.pp-slc-badge{position:absolute;top:8px;right:8px;background:#111827;color:#fff;font-size:10px;font-weight:700;border-radius:999px;padding:3px 8px}
.pp-slc-body{padding:10px 10px 12px}
.pp-slc-title{font-size:13px;font-weight:600;color:#374151;margin:0;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.pp-slc-price{font-size:13px;font-weight:600;color:#9CA3AF;margin:5px 0 0}
.pp-sold-more{width:100%;margin-top:10px;text-align:center;padding:10px;border:1px solid #E5E7EB;border-radius:12px;background:#fff;color:#0F9D58;font-weight:600;font-size:13px;cursor:pointer;font-family:inherit}

.pp-ach-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px}
@media (min-width:640px){.pp-ach-grid{grid-template-columns:repeat(3,1fr)}}
@media (min-width:1024px){.pp-ach-grid{grid-template-columns:repeat(4,1fr)}}
.pp-ach-card{display:flex;flex-direction:column;align-items:center;text-align:center;gap:8px;padding:16px 12px 14px;border-radius:16px;background:#fff;border:1px solid #E5E7EB;box-shadow:0 1px 2px rgba(0,0,0,.04);min-width:0}
.pp-ach-badge{width:44px;height:44px;border-radius:14px;background:#ECFDF5;color:#0F9D58;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.pp-ach-label{font-size:12.5px;font-weight:600;color:#111827;line-height:1.3;margin:0}
.pp-ach-hint{font-size:11px;color:#6B7280;margin:0}

.pp-empty{text-align:center;padding:32px 16px;color:#9ca3af;font-size:13.5px;background:#fff;border-radius:14px;border:1px solid #ebebeb}
.pp-toast{position:fixed;bottom:24px;left:50%;transform:translateX(-50%);background:#111;color:#fff;padding:10px 20px;border-radius:999px;font-size:13px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,.18);z-index:100}
`
