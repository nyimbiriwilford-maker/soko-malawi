import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  MapPin, CheckCircle, Lock, AlertTriangle, ShieldCheck,
  MessageCircle, Phone, Mail, Heart, Star, Pencil, Trash2,
  ChevronRight, Home, Package, Monitor, Cpu, HardDrive,
  Palette, Smartphone, Wifi, BatteryCharging, Clock, Wrench, Calendar,
  Eye, Tag, FileText, BadgeCheck, Boxes, Zap, Copy, Check,
  Video, Facebook, Twitter, MoreHorizontal, SlidersHorizontal, Sparkles,
  TrendingUp, Bell, X, Play, Link2, ArrowUpRight, Gift, Ban,
  CircleAlert, EyeOff, Flame, Flag,
} from 'lucide-react'
import { formatPrice } from '../lib/format'
import SokoNav from '../components/SokoNav'
import Comments from '../components/Comments'
import VouchChainBanner from '../components/VouchChainBanner'
import TrustBadge from '../components/TrustBadge'
import { resolveVouchChain, getTrustScore, getConfirmedDealCount } from '../utils/vouchUtils'
import StatusBadge from '../components/StatusBadge'
import { fetchListingStatus, fetchUserActiveStatus } from '../hooks/useStatuses'
import { isListingFeatured } from '../utils/homeUtils'
import { featureExistingListing } from '../lib/featureListing'
import { featuredPriceLabel } from '../constants/featuredPricing'

const CAT_META = {
  Electronics: { color: '#1a7a4a', bg: '#e6f4ec' },
  Furniture:   { color: '#b45309', bg: '#fef3c7' },
  Clothing:    { color: '#7c3aed', bg: '#ede9fe' },
  Vehicles:    { color: '#1d4ed8', bg: '#dbeafe' },
  Property:    { color: '#0f766e', bg: '#ccfbf1' },
  Agriculture: { color: '#15803d', bg: '#dcfce7' },
  Food:        { color: '#dc2626', bg: '#fee2e2' },
  Services:    { color: '#d97706', bg: '#fef3c7' },
  Other:       { color: '#6b7280', bg: '#f3f4f6' },
}

const CONDITION_META = {
  new:       { label: 'Brand New',   color: '#15803d', bg: '#dcfce7' },
  like_new:  { label: 'Like New',    color: '#1a7a4a', bg: '#e6f4ec' },
  used_good: { label: 'Used - Good', color: '#0f766e', bg: '#ccfbf1' },
  used_fair: { label: 'Used - Fair', color: '#b45309', bg: '#fef3c7' },
  for_parts: { label: 'For Parts',   color: '#6b7280', bg: '#f3f4f6' },
}

const AVAILABILITY_META = {
  in_stock:      { label: 'In Stock',       color: '#15803d', bg: '#dcfce7', icon: 'check' },
  made_to_order: { label: 'Made to Order',  color: '#b45309', bg: '#fef3c7', icon: 'clock' },
  not_available: { label: 'Not Available',  color: '#dc2626', bg: '#fee2e2', icon: 'x' },
}

function isFlashActive(listing) {
  if (!listing?.flash_sale_price || !listing?.flash_sale_ends_at) return false
  return new Date(listing.flash_sale_ends_at) > new Date()
}

function flashTimeLeft(expiresAt) {
  const ms = new Date(expiresAt) - Date.now()
  if (ms <= 0) return null
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s}s`
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getOnlineStatus(lastSeen) {
  const mins = Math.floor((Date.now() - new Date(lastSeen)) / 60000)
  if (mins < 5)  return { label: 'Online now', color: '#15803d' }
  if (mins < 60) return { label: `Active ${mins}m ago`, color: '#d97706' }
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return { label: `Active ${hrs}h ago`, color: '#9ca3af' }
  return { label: 'Offline', color: '#9ca3af' }
}

// Builds a clean "Area, City, District" line, skipping any part that
// duplicates another (e.g. area === city) and normalising the "District" suffix.
function formatLocationLine(listing) {
  const clean = s => (s || '').trim()
  const norm  = s => clean(s).toLowerCase()

  const area = clean(listing.area)
  const city = clean(listing.city)
  let district = clean(listing.district).replace(/\s*district$/i, '')

  const parts = []
  if (area && norm(area) !== norm(city)) parts.push(area)
  if (city) parts.push(city)

  let line = parts.join(', ')
  if (district && norm(district) !== norm(city)) {
    line = line ? `${line}, ${district}` : district
  }
  return line
}

function StarRow({ rating = 0, count = 0 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {[1,2,3,4,5].map(i => (
        <Star key={i} size={13} color={i <= Math.round(rating) ? '#f59e0b' : '#d1d5db'} fill={i <= Math.round(rating) ? '#f59e0b' : '#d1d5db'} />
      ))}
      {count > 0 && <span style={{ fontSize: 12, color: '#374151', fontWeight: 600, marginLeft: 3 }}>{rating.toFixed(1)} ({count} reviews)</span>}
    </div>
  )
}

export default function ListingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [listing, setListing]       = useState(null)
  const [seller, setSeller]         = useState(null)
  const [ownerShop, setOwnerShop]   = useState(null) // shop for this product owner (if any)
  const [currentUser, setCurrentUser] = useState(null)
  const [mediaIndex, setMediaIndex] = useState(0)
  const [loading, setLoading]       = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting]     = useState(false)
  const [flashTime, setFlashTime]   = useState('')
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [copied, setCopied]         = useState(false)
  const [vouchChain, setVouchChain] = useState(null)
  const [sellerTrust, setSellerTrust] = useState(null)
  const [sellerDeals, setSellerDeals] = useState(0)
  const [listingStatus, setListingStatus] = useState(null)
  const [sellerStatus, setSellerStatus]   = useState(null)
  const [isFavorited, setIsFavorited]     = useState(false)
  const [featuring, setFeaturing]         = useState(false)
  const [featureError, setFeatureError]   = useState(null)
  const [showReportModal, setShowReportModal] = useState(false)
  const [reportReason, setReportReason]    = useState(null)
  const [reportDetails, setReportDetails] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportSent, setReportSent]       = useState(false)
  const [alreadyReported, setAlreadyReported] = useState(() => {
    try { return sessionStorage.getItem('soko_reported_' + window.location.pathname.split('/').pop()) === '1' } catch { return false }
  })
  const [ldSearch, setLdSearch] = useState('')
  const touchStartX = useRef(null)
  const viewNotifSent = useRef(false)

  useEffect(() => { loadListing() }, [id])

  useEffect(() => {
    if (!listing || !isFlashActive(listing)) return
    setFlashTime(flashTimeLeft(listing.flash_sale_ends_at))
    const t = setInterval(() => {
      const left = flashTimeLeft(listing.flash_sale_ends_at)
      if (!left) { clearInterval(t); return }
      setFlashTime(left)
    }, 1000)
    return () => clearInterval(t)
  }, [listing])

  async function recordView(listingId) {
    if (!listingId) return
    try {
      let sessionKey = null
      try {
        sessionKey = sessionStorage.getItem('soko_view_session')
        if (!sessionKey) {
          sessionKey = `s_${Math.random().toString(36).slice(2)}_${Date.now()}`
          sessionStorage.setItem('soko_view_session', sessionKey)
        }
      } catch { /* private mode */ }
      await supabase.rpc('record_listing_view', {
        p_listing_id: listingId,
        p_session_key: sessionKey,
      })
    } catch { /* migration optional */ }
  }

  async function submitReport() {
    if (!reportReason || reportSubmitting) return
    setReportSubmitting(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }
      const { error } = await supabase.from('user_reports').insert({
        reporter_id: user.id,
        reported_user_id: listing.seller_id || null,
        listing_id: listing.id,
        reason: reportReason,
        details: reportDetails.trim() || null,
      })
      if (error) throw error
      setReportSent(true)
      setAlreadyReported(true)
      try { sessionStorage.setItem('soko_reported_' + listing.id, '1') } catch { /* private mode */ }
    } catch (e) {
      alert(e?.message || 'Could not submit your report. Please try again.')
    } finally {
      setReportSubmitting(false)
    }
  }

  async function loadListing() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    const { data } = await supabase.from('listings').select('*').eq('id', id).single()
    setListing(data)
    setOwnerShop(null)
    if (data?.id) recordView(data.id)
    if (data?.seller_id) {
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.seller_id).single()
      if (profile) {
        setSeller({ ...profile, name: profile.full_name || profile.name })
      } else {
        const { data: usr } = await supabase.from('users').select('*').eq('id', data.seller_id).single()
        setSeller(usr)
      }
    }

    // Resolve shop as product owner when listing belongs to a shop
    // or when the seller owns an active shop
    try {
      let shop = null
      if (data?.shop_id) {
        const { data: byId } = await supabase
          .from('shops')
          .select('id, name, slug, logo_url, cover_url, city, is_verified, rating, review_count, listing_count, owner_id, is_active')
          .eq('id', data.shop_id)
          .maybeSingle()
        if (byId && byId.is_active !== false) shop = byId
      }
      if (!shop && data?.seller_id) {
        const { data: byOwner } = await supabase
          .from('shops')
          .select('id, name, slug, logo_url, cover_url, city, is_verified, rating, review_count, listing_count, owner_id, is_active')
          .eq('owner_id', data.seller_id)
          .eq('is_active', true)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (byOwner) shop = byOwner
        // Fallback if is_active filter fails or shops lack the column
        if (!shop) {
          const { data: anyShop } = await supabase
            .from('shops')
            .select('id, name, slug, logo_url, cover_url, city, is_verified, rating, review_count, listing_count, owner_id')
            .eq('owner_id', data.seller_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle()
          if (anyShop) shop = anyShop
        }
      }
      setOwnerShop(shop)
    } catch (e) {
      console.warn('Shop owner lookup failed:', e)
      setOwnerShop(null)
    }

    const [ls, ss] = await Promise.all([
      fetchListingStatus(data.id),
      fetchUserActiveStatus(data?.seller_id),
    ])
    setListingStatus(ls)
    setSellerStatus(ss)

    if (user && data?.seller_id && user.id !== data.seller_id) {
      const [chain, ts, dc] = await Promise.all([
        resolveVouchChain(user.id, data.seller_id),
        getTrustScore(data.seller_id),
        getConfirmedDealCount(data.seller_id),
      ])
      setVouchChain(chain)
      setSellerTrust(ts)
      setSellerDeals(dc)
    }
    setLoading(false)

    if (user && data && data.seller_id && user.id !== data.seller_id && !viewNotifSent.current) {
      viewNotifSent.current = true
      try {
        const { data: myProf } = await supabase
          .from('profiles').select('full_name').eq('id', user.id).single()
        const viewerName = myProf?.full_name || 'Someone'
        await supabase.from('notifications').insert({
          user_id: data.seller_id,
          type: 'listing_view',
          title: '👁️ Someone viewed your listing',
          body: `${viewerName} viewed "${data.title}"`,
          message: `${viewerName} viewed "${data.title}"`,
          data: {
            listing_id: data.id,
            listing_title: data.title,
            listing_image: (data.images || [])[0] || null,
            viewer_id: user.id,
            viewer_name: viewerName,
          },
          read: false,
        })
      } catch (e) { console.warn('View notification error:', e) }
    }
  }

  async function handleFeature() {
    if (!currentUser || featuring) return
    setFeaturing(true)
    try {
      const result = await featureExistingListing({
        listing,
        user: currentUser,
        profileName: seller?.full_name || seller?.name,
      })
      if (result?.free) await loadListing()
    } catch (e) {
      setFeatureError(e?.message || 'Could not feature listing')
      setTimeout(() => setFeatureError(null), 5000)
    } finally {
      setFeaturing(false)
    }
  }

  async function deleteListing() {
    setDeleting(true)
    await supabase.from('listings').delete().eq('id', id)
    navigate('/')
  }

  async function handleChatWithSeller() {
    // Offer notifications are now handled by the offer notification system
    // (offer_new / offer_counter / ...) in src/utils/offerNotifications.js.
    navigate(`/chat/${listing.seller_id}/${listing.id}?src=listing`, {
      state: { source: 'listing' },
    })
  }

  function handleShare() {
    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      navigator.share({ title: listing.title, text: `Check out this listing on SokoMW: ${listing.title}`, url: window.location.href })
        .catch(() => setShowShareSheet(true))
    } else {
      setShowShareSheet(true)
    }
  }

  function copyLink() {
    const url = window.location.href
    const doFallback = () => {
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true); setTimeout(() => setCopied(false), 2000)
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })
        .catch(doFallback)
    } else doFallback()
  }

  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) {
      if (dx < 0) setMediaIndex(i => (i + 1) % allMedia.length)
      else        setMediaIndex(i => (i - 1 + allMedia.length) % allMedia.length)
    }
    touchStartX.current = null
  }

  if (loading) return (
    <div style={S.loadWrap}><div style={S.loadSpinner}/></div>
  )
  if (!listing) return (
    <div style={S.notFound}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>Listing not found</div>
      <button style={S.notFoundBtn} onClick={() => navigate('/')}>Back to Home</button>
    </div>
  )

  const allMedia = [
    ...(listing.images || []).map(url => ({ url, type: 'image' })),
    ...(listing.videos || []).map(url => ({ url, type: 'video' })),
  ]

  const isOwner       = currentUser?.id === listing.seller_id
  const flash         = isFlashActive(listing)
  const flashDiscount = flash ? Math.round((1 - listing.flash_sale_price / listing.price) * 100) : 0
  const displayPrice  = flash ? listing.flash_sale_price : listing.price
  const catMeta       = CAT_META[listing.category] || { color: '#1a7a4a', bg: '#e6f4ec' }
  const condition     = listing.condition && CONDITION_META[listing.condition]
  const hasBulk       = listing.price_tiers && listing.price_tiers.length > 0

  const latNum = Number(listing.latitude)
  const lngNum = Number(listing.longitude)
  const hasValidCoords =
    listing.latitude != null && listing.longitude != null &&
    `${listing.latitude}`.trim() !== '' && `${listing.longitude}`.trim() !== '' &&
    Number.isFinite(latNum) && Number.isFinite(lngNum) && (latNum !== 0 || lngNum !== 0)
  const mapQueryText = ((listing.area ? listing.area + ', ' : '') + (listing.city || '') + ', Malawi')
  const mapSrc = hasValidCoords
    ? `https://www.google.com/maps?q=${latNum},${lngNum}&z=17&output=embed&hl=en`
    : `https://www.google.com/maps?q=${encodeURIComponent(mapQueryText)}&z=14&output=embed&hl=en`
  const mapLink = hasValidCoords
    ? `https://maps.google.com/?q=${latNum},${lngNum}`
    : `https://maps.google.com/?q=${encodeURIComponent(mapQueryText)}`

  const activeTier = hasBulk
    ? [...listing.price_tiers].filter(t => parseInt(t.min_qty) <= 1)
        .sort((a, b) => b.min_qty - a.min_qty)[0]
    : null
  const bulkPrice          = activeTier ? Number(activeTier.price) : null
  const effectiveUnitPrice = bulkPrice || displayPrice

  const specFields = [
    listing.brand          && { label: 'Brand',          icon: 'brand',   value: listing.brand },
    listing.model          && { label: 'Model',          icon: 'model',   value: listing.model },
    listing.storage        && { label: 'Storage',        icon: 'storage', value: listing.storage },
    listing.ram            && { label: 'RAM',            icon: 'ram',     value: listing.ram },
    listing.color          && { label: 'Color',          icon: 'color',   value: listing.color },
    listing.sim            && { label: 'SIM',            icon: 'sim',     value: listing.sim },
    listing.network        && { label: 'Network',        icon: 'network', value: listing.network },
    listing.battery_health && { label: 'Battery Health', icon: 'battery', value: listing.battery_health },
  ].filter(Boolean)

  const sellerRating      = ownerShop?.rating || seller?.rating || 0
  const sellerReviewCount = ownerShop?.review_count || seller?.review_count || 0
  const memberSince       = seller?.created_at
    ? new Date(seller.created_at).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })
    : null
  const ownerDisplayName  = ownerShop?.name
    || listing.seller_name
    || seller?.name
    || seller?.full_name
    || 'Anonymous'
  const ownerAvatarUrl    = ownerShop?.logo_url || seller?.avatar_url || null
  const ownerIsVerified   = !!(ownerShop?.is_verified || seller?.is_verified)
  const ownerIsShop       = !!ownerShop?.slug

  function openOwner() {
    if (ownerIsShop) {
      navigate('/shop/' + ownerShop.slug)
      return
    }
    if (listing?.seller_id) navigate('/profile/' + listing.seller_id)
  }

  // Icons for spec fields — modern lucide icons
  const SPEC_ICONS = {
    brand:   <Monitor size={16} strokeWidth={1.8} color="#6b7280" />,
    model:   <Star size={16} strokeWidth={1.8} color="#6b7280" />,
    storage: <HardDrive size={16} strokeWidth={1.8} color="#6b7280" />,
    ram:     <Cpu size={16} strokeWidth={1.8} color="#6b7280" />,
    color:   <Palette size={16} strokeWidth={1.8} color="#6b7280" />,
    sim:     <Smartphone size={16} strokeWidth={1.8} color="#6b7280" />,
    network: <Wifi size={16} strokeWidth={1.8} color="#6b7280" />,
    battery: <BatteryCharging size={16} strokeWidth={1.8} color="#6b7280" />,
  }

  // Thumbnail strip — show first 5, then +N
  const THUMB_SHOW = 5
  const extraCount = allMedia.length > THUMB_SHOW ? allMedia.length - THUMB_SHOW : 0
  const visibleThumbs = allMedia.slice(0, THUMB_SHOW)

  // Shared CTA stacks — rendered in the sidebar (desktop) and in the
  // in-flow mobile CTA card (mobile). No fixed/floating bar on mobile.
  const buyerCtas = (
    <>
      <button className="ld-btn-hover" style={S.chatBtn} onClick={handleChatWithSeller}>
        <MessageCircle size={17} strokeWidth={2.2} color="#fff" />
        Chat with Seller
      </button>

      {(listing.contact_methods || []).includes('call') && listing.call_number && (
        <button className="ld-btn-hover" style={S.callBtn} onClick={() => window.location.href = `tel:${listing.call_number}`}>
          <Phone size={17} strokeWidth={2.2} color="#374151" />
          Call Seller
        </button>
      )}

      {(listing.contact_methods || []).includes('whatsapp') && listing.whatsapp_number && (
        <a className="ld-btn-hover" style={{ ...S.callBtn, textDecoration: 'none', color: '#15803d', borderColor: '#bbf7d0' }}
          href={`https://wa.me/${listing.whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent('Hi, I saw your listing "' + listing.title + '" on SokoMW')}`}
          target="_blank" rel="noopener noreferrer">
          <MessageCircle size={17} strokeWidth={2.2} color="#15803d" />
          WhatsApp Seller
        </a>
      )}

      {(listing.contact_methods || []).includes('email') && listing.seller_email && (
        <a className="ld-btn-hover" style={{ ...S.callBtn, textDecoration: 'none' }}
          href={`mailto:${listing.seller_email}?subject=${encodeURIComponent('Re: ' + listing.title)}`}>
          <Mail size={17} strokeWidth={2.2} color="#374151" />
          Email Seller
        </a>
      )}

      <button className="ld-btn-hover" style={S.favBtn} onClick={() => setIsFavorited(f => !f)}>
        <Heart size={17} strokeWidth={2} color={isFavorited ? '#dc2626' : '#374151'} fill={isFavorited ? '#dc2626' : 'none'} />
        Add to Favorites
      </button>
    </>
  )

  const ownerCtas = (featureLabel) => (
    <>
      {featureError && <div style={S.featureErrorInline}>{featureError}</div>}
      {!isListingFeatured(listing) && (
        <button
          className="ld-btn-hover"
          style={{ ...S.callBtn, color: '#b45309', borderColor: '#fde68a', background: '#fffbeb' }}
          disabled={featuring}
          onClick={handleFeature}
        >
          {featuring ? '…' : featureLabel}
        </button>
      )}
      <button className="ld-btn-hover" style={S.chatBtn} onClick={() => navigate('/post/edit/' + listing.id)}>
        <Pencil size={16} strokeWidth={2.2} color="#fff" />
        Edit Listing
      </button>
      <button className="ld-btn-hover" style={{ ...S.callBtn, color: '#dc2626', borderColor: '#fecaca' }} onClick={() => setShowDeleteConfirm(true)}>
        <Trash2 size={16} strokeWidth={2.2} color="#dc2626" />
        Delete Listing
      </button>
    </>
  )

  return (
    <div style={S.page}>
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f3f4f6; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
        @keyframes flashPulse { 0%,100%{opacity:1} 50%{opacity:.7} }
        @keyframes timerTick { 0%{transform:scale(1)} 50%{transform:scale(1.04)} 100%{transform:scale(1)} }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: #f1f1f1; }
        ::-webkit-scrollbar-thumb { background: #d1d5db; border-radius: 3px; }

        /* nav tab active underline */
        .ld-tab-active { border-bottom: 2px solid #0F9D58 !important; color: #0F9D58 !important; font-weight: 600 !important; }
        .ld-tab { border-bottom: 2px solid transparent; color: #374151; font-size: 14px; font-weight: 500; padding: 12px 4px; cursor: pointer; display: flex; align-items: center; gap: 6px; white-space: nowrap; }
        .ld-tab:hover { color: #0F9D58; }
        .ld-btn-hover:hover { opacity: .88; transform: translateY(-1px); transition: all .15s; }
        .ld-thumb-item { border: 2px solid #e5e7eb; border-radius: 8px; overflow: hidden; cursor: pointer; flex-shrink: 0; transition: border-color .15s; }
        .ld-thumb-item:hover { border-color: #0F9D58; }
        .ld-share-opt:hover { background: #f9fafb !important; }

        /* Two column layout breakpoints */
        @media (max-width: 900px) {
          .ld-two-col { flex-direction: column !important; padding-bottom: 32px !important; }
          .ld-sidebar { width: 100% !important; position: static !important; max-height: none !important; overflow: visible !important; }
          .ld-main-col { width: 100% !important; }
          .ld-desktop-bar { display: none !important; }
          .ld-mobile-cta { display: block !important; }
          .ld-sidebar-cta { display: none !important; }
          .ld-mobile-dup { display: none !important; }
          .ld-topnav { display: none !important; }
          .ld-tabnav { display: none !important; }
          .ld-breadcrumb { display: none !important; }
          .ld-back { display: flex !important; }

          /* Tighter page padding on phones — more room for content */
          .ld-page-body { padding-left: 14px !important; padding-right: 14px !important; }

          /* Specs grid — 2 per row on phones (was 4, cramped) */
          .ld-specs-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 0 !important; }
          .ld-spec-item { padding: 10px 12px !important; border: none !important; background: #fff !important; }
          .ld-spec-item:nth-child(odd) { background: #fafafa !important; border-right: 1px solid #f3f4f6 !important; }
          .ld-spec-value { font-size: 12.5px !important; word-break: break-word; }

          /* Bulk pricing — 3 columns still fit on tablets/large phones */
          .ld-bulk-row { padding: 10px 12px !important; }
          .ld-bulk-cell { font-size: 12px !important; }
        }

        /* Small phones — bulk rows stack to compact 2-line key/value cells */
        @media (max-width: 480px) {
          .ld-spec-item { padding: 9px 10px !important; }

          .ld-bulk-headrow { display: none !important; }
          .ld-bulk-row {
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            align-items: center !important;
            gap: 4px 10px !important;
            padding: 10px 12px !important;
          }
          .ld-bulk-cell { font-size: 12.5px !important; }
          .ld-bulk-row .ld-bulk-cell:nth-child(1) { grid-column: 1 / -1; font-weight: 700; color: #111827 !important; }
          .ld-bulk-row .ld-bulk-cell:nth-child(2) { justify-self: start; }
          .ld-bulk-row .ld-bulk-cell:nth-child(3) { justify-self: end; text-align: right; }
          .ld-bulk-head { display: none !important; }
        }

        /* Very small phones — keep spec values readable, never clipped */
        @media (max-width: 360px) {
          .ld-spec-value { font-size: 12px !important; }
          .ld-bulk-cell { font-size: 11.5px !important; }
        }
        @media (min-width: 901px) {
          .ld-mobile-cta { display: none !important; }
          .ld-back { display: flex; }
        }
      `}</style>

      {/* ── SokoNav (desktop + mobile + pillars) ── */}
      <SokoNav navigate={navigate} user={currentUser} search={ldSearch} setSearch={setLdSearch} />

      {/* ── PAGE BODY ── */}
      <div className="ld-page-body" style={S.pageBody}>

        {/* Breadcrumb */}
        <div className="ld-breadcrumb" style={S.breadcrumb}>
          <span style={S.bcLink} onClick={() => navigate('/')}>
            <Home size={12} color="#6b7280" />
            Marketplace
          </span>
          <ChevronRight size={12} color="#9ca3af" />
          <span style={S.bcLink} onClick={() => navigate(`/?category=${listing.category}`)}>{listing.category}</span>
          {listing.subcategory && <>
            <ChevronRight size={12} color="#9ca3af" />
            <span style={S.bcLink}>{listing.subcategory}</span>
          </>}
          <ChevronRight size={12} color="#9ca3af" />
          <span style={S.bcCurrent}>{listing.title}</span>
        </div>

        {/* Back to results */}
        <button className="ld-back" style={S.backToResults} onClick={() => navigate(-1)}>
          <ChevronRight size={14} strokeWidth={2.5} color="currentColor" style={{ transform: 'rotate(180deg)' }} />
          Back to results
        </button>

        {/* ── TWO COLUMN ── */}
        <div className="ld-two-col" style={S.twoCol}>

          {/* ───── LEFT / MAIN ───── */}
          <div className="ld-main-col" style={S.mainCol}>

            {/* GALLERY CARD */}
            <div style={S.galleryCard}>
              {/* featured badge only */}
              {isListingFeatured(listing) && (
                <div style={{ ...S.galleryBadge, top: 12, background: '#0F9D58', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <Star size={11} fill="#fff" color="#fff" />
                  Featured
                </div>
              )}
              {!isOwner && (
                <button
                  style={{ ...S.favOverlay, background: isFavorited ? '#fee2e2' : 'white' }}
                  onClick={() => setIsFavorited(f => !f)}
                >
                  <Heart size={18} strokeWidth={2} color={isFavorited ? '#dc2626' : '#9ca3af'} fill={isFavorited ? '#dc2626' : 'none'} />
                </button>
              )}

              {/* Main image */}
              <div style={S.mainImgBox} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
                {allMedia.length > 0 ? (
                  <>
                    {allMedia[mediaIndex].type === 'image'
                      ? <img src={allMedia[mediaIndex].url} alt={listing.title} style={S.mainImg} fetchPriority="high" />
                      : <video src={allMedia[mediaIndex].url} controls style={S.mainImg} playsInline />
                    }
                    {allMedia.length > 1 && (
                      <>
                        <button style={{ ...S.arrowBtn, left: 10 }}
                          onClick={() => setMediaIndex(i => (i - 1 + allMedia.length) % allMedia.length)}>
                          <ChevronRight size={14} strokeWidth={2.5} color="#374151" style={{ transform: 'rotate(180deg)' }} />
                        </button>
                        <button style={{ ...S.arrowBtn, right: 10 }}
                          onClick={() => setMediaIndex(i => (i + 1) % allMedia.length)}>
                          <ChevronRight size={14} strokeWidth={2.5} color="#374151" />
                        </button>
                      </>
                    )}
                    {flash && (
                      <div style={S.flashBadge}>-{flashDiscount}%</div>
                    )}
                    {allMedia[mediaIndex].type === 'video' && (
                      <div style={S.videoTag}>
                        <Video size={12} color="#fff" fill="#fff" />
                        Video
                      </div>
                    )}
                  </>
                ) : (
                  <div style={S.noImg}>
                    <Package size={60} strokeWidth={1.2} color="#9ca3af" />
                    <span style={{ fontSize: 13, color: '#9ca3af', marginTop: 8 }}>No photos</span>
                  </div>
                )}
              </div>

              {/* Thumbnail strip */}
              {allMedia.length > 1 && (
                <div style={S.thumbStrip}>
                  {visibleThumbs.map((m, i) => (
                    <div
                      key={i}
                      className="ld-thumb-item"
                      style={{
                        width: 72, height: 72, position: 'relative',
                        borderColor: i === mediaIndex ? '#0F9D58' : '#e5e7eb',
                        opacity: i === mediaIndex ? 1 : 0.72,
                      }}
                      onClick={() => setMediaIndex(i)}
                    >
                      {m.type === 'image' ? (
                        <img src={m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} loading="lazy" />
                      ) : (
                        <>
                          <video src={m.url + '#t=0.1'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', background: '#111' }} muted preload="metadata" />
                          <div style={{
                            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                            background: 'rgba(0,0,0,0.25)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <Play size={22} color="#fff" fill="#fff" />
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                  {extraCount > 0 && (
                    <div style={S.thumbMore}>+{extraCount}</div>
                  )}
                </div>
              )}
            </div>

            {/* ── MOBILE CTA (in-flow, replaces the floating bar) ── */}
            <div className="ld-mobile-cta" style={{ ...S.card, display: 'none' }}>
              <h1 style={{ fontSize: 18, fontWeight: 800, color: '#111827', lineHeight: 1.35, marginBottom: 8 }}>{listing.title}</h1>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                {listing.price_type === 'free' ? (
                  <span style={{ ...S.freePrice, display: 'inline-flex', alignItems: 'center', gap: 6 }}>FREE <Gift size={18} strokeWidth={2.2} color="#0F9D58" /></span>
                ) : (
                  <>
                    <span style={{ ...S.bigPrice, fontSize: 24, ...(flash ? { color: '#dc2626' } : {}) }}>
                      {formatPrice(effectiveUnitPrice)}
                    </span>
                    {flash && <span style={S.strikePrice}>{formatPrice(listing.price)}</span>}
                    {listing.price_type === 'negotiable' && !flash && (
                      <span style={S.negTag}>Negotiable</span>
                    )}
                  </>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {!isOwner ? buyerCtas : ownerCtas('Feature this listing')}
              </div>
            </div>

            {/* ── OVERVIEW / SPECS ── */}
            <div style={S.card}>
              <div style={S.cardH2}>Overview</div>
              {listing.description && (
                <p style={S.overviewBlurb}>{listing.description.split('\n')[0]}</p>
              )}
              {specFields.length > 0 && (
                <div className="ld-specs-grid" style={S.specsGrid}>
                  {specFields.map(({ label, icon, value }) => (
                    <div key={label} className="ld-spec-item" style={S.specItem}>
                      <div style={S.specIcon}>{SPEC_ICONS[icon]}</div>
                      <div style={S.specLabel}>{label}</div>
                      <div className="ld-spec-value" style={S.specValue}>{value}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── DESCRIPTION ── */}
            {listing.description && (
              <div style={S.card}>
                <div style={S.cardH2}>Description</div>
                <div style={S.descBlock}>
                  {listing.description.split('\n').filter(Boolean).map((line, i) => (
                    <div key={i} style={S.descLine}>
                      {line.startsWith('-') || line.startsWith('•') ? (
                        <>
                          <span style={S.descCheck}>
                            <Check size={11} strokeWidth={3} color="#fff" />
                          </span>
                          <span>{line.replace(/^[-•]\s*/, '')}</span>
                        </>
                      ) : (
                        <span style={{ color: '#374151' }}>{line}</span>
                      )}
                    </div>
                  ))}
                </div>
                {listing.tags && listing.tags.length > 0 && (
                  <div style={S.tagsRow}>
                    {listing.tags.map(tag => (
                      <span key={tag} style={S.tagChip}>#{tag}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ── KEY FEATURES ── */}
            {listing.key_features && (
              <div style={S.card}>
                <div style={{ ...S.cardH2, display: 'flex', alignItems: 'center', gap: 7 }}><Sparkles size={16} strokeWidth={2.2} color="#f59e0b" /> Key Features</div>
                <div style={S.descBlock}>
                  {listing.key_features.split('\n').filter(Boolean).map((line, i) => (
                    <div key={i} style={S.descLine}>
                      <span style={{ ...S.descCheck, background: '#f59e0b' }}>
                        <Check size={10} strokeWidth={3} color="#fff" />
                      </span>
                      <span>{line.replace(/^[-•]\s*/, '')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── FLASH SALE ── */}
            {flash && (
              <div style={S.flashSection}>
                <div style={S.flashSectionHdr}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Zap size={15} strokeWidth={2.4} color="#dc2626" fill="#dc2626" /> Flash Sale</span>
                  <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 700 }}>{flashTime} remaining</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-around' }}>
                  {[
                    { val: `${flashDiscount}%`,                           lab: 'Discount' },
                    { val: formatPrice(listing.flash_sale_price), lab: 'Flash price' },
                    { val: formatPrice(listing.price), lab: 'Original', strike: true },
                  ].map(({ val, lab, strike }) => (
                    <div key={lab} style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 15, fontWeight: 800, color: strike ? '#bbb' : '#111827', textDecoration: strike ? 'line-through' : 'none' }}>{val}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 3 }}>{lab}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── BULK PRICING ── */}
            {hasBulk && (
              <div style={S.card}>
                <div style={{ ...S.cardH2, display: 'flex', alignItems: 'center', gap: 7 }}><Boxes size={16} strokeWidth={2.2} color="#0F9D58" /> Bulk Pricing · Order more, save more</div>
                <div className="ld-bulk-table" style={S.bulkTable}>
                  <div className="ld-bulk-row ld-bulk-headrow" style={{ ...S.bulkRow, background: '#f9fafb', borderBottom: '1px solid #e5e7eb' }}>
                    {['Quantity','Price/unit','You save'].map(h => <span key={h} className="ld-bulk-head" style={S.bulkHead}>{h}</span>)}
                  </div>
                  <div className="ld-bulk-row" style={{ ...S.bulkRow, ...(!activeTier ? S.bulkActiveRow : {}) }}>
                    <span className="ld-bulk-cell" style={S.bulkCell}>1 unit</span>
                    <span className="ld-bulk-cell" style={{ ...S.bulkCell, fontWeight: 700 }}>{formatPrice(listing.price)}</span>
                    <span className="ld-bulk-cell" style={{ ...S.bulkCell, color: '#9ca3af' }}>—</span>
                  </div>
                  {[...listing.price_tiers].sort((a, b) => a.min_qty - b.min_qty).map((tier, i) => {
                    const tp = Number(tier.price)
                    const sv = listing.price - tp
                    const pct = Math.round((1 - tp / listing.price) * 100)
                    const isAct = activeTier && parseInt(tier.min_qty) === parseInt(activeTier.min_qty)
                    return (
                      <div key={i} className="ld-bulk-row" style={{ ...S.bulkRow, ...(isAct ? S.bulkActiveRow : {}) }}>
                        <span className="ld-bulk-cell" style={S.bulkCell}>{tier.min_qty}+ units {isAct && <span style={S.bulkPill}>✓ Active</span>}</span>
                        <span className="ld-bulk-cell" style={{ ...S.bulkCell, fontWeight: 700, color: '#0F9D58' }}>{formatPrice(tp)}</span>
                        <span className="ld-bulk-cell" style={{ ...S.bulkCell, color: '#dc2626', fontWeight: 600 }}>
                          {formatPrice(sv)}/ea <span style={S.discPill}>-{pct}%</span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── BOOKING PRICING ── */}
            {(listing.booking_hourly || listing.booking_daily || listing.booking_weekly) && (
              <div style={S.card}>
                <div style={{ ...S.cardH2, display: 'flex', alignItems: 'center', gap: 7 }}><Wrench size={16} strokeWidth={2.2} color="#0F9D58" /> Booking Rates</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(120px,1fr))', gap: 10, marginBottom: listing.booking_deposit_required ? 12 : 0 }}>
                  {[
                    { label: 'Hourly', value: listing.booking_hourly, icon: <Clock size={16} strokeWidth={2} color="#0F9D58" /> },
                    { label: 'Daily',  value: listing.booking_daily,  icon: <Calendar size={16} strokeWidth={2} color="#0F9D58" /> },
                    { label: 'Weekly', value: listing.booking_weekly, icon: <TrendingUp size={16} strokeWidth={2} color="#0F9D58" /> },
                  ].filter(r => r.value).map(({ label, value, icon }) => (
                    <div key={label} style={{ border: '1px solid #f3f4f6', borderRadius: 10, padding: '12px 10px', textAlign: 'center', background: '#fafafa' }}>
                      <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}>{icon}</div>
                      <div style={{ fontSize: 15, fontWeight: 800, color: '#111827' }}>{formatPrice(value)}</div>
                      <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>
                {listing.booking_deposit_required && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#b45309', background: '#fef3c7', borderRadius: 8, padding: '8px 10px' }}>
                    <ShieldCheck size={14} strokeWidth={2} color="#b45309" />
                    A deposit is required to confirm this booking
                  </div>
                )}
              </div>
            )}

            {/* ── LOCATION ── */}
            {listing.city && (
              <div style={S.card}>
                <div style={S.cardH2}>Location</div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: listing.meetup_note ? 4 : 0 }}>
                      <MapPin size={16} strokeWidth={2.2} color="#0F9D58" style={{ flexShrink: 0 }} />
                      {formatLocationLine(listing)}
                    </div>
                    {listing.meetup_note && (
                      <div style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6 }}>
                        {listing.meetup_note}
                      </div>
                    )}
                  </div>
                  <button
                    style={{ ...S.viewMapLink, display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                    onClick={() => window.open(mapLink, '_blank')}>
                    Open in Google Maps
                    <ArrowUpRight size={13} strokeWidth={2.3} color="#0F9D58" />
                  </button>
                </div>

                {/* Map embed — full width, generous height */}
                <div style={S.mapBoxLarge}>
                  <iframe
                    title="Listing location map"
                    width="100%"
                    height="100%"
                    style={{ border: 0, display: 'block' }}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                    src={mapSrc}
                  />
                </div>
              </div>
            )}

            {/* ── LISTING DETAILS ── */}
            <div style={S.card}>
              <div style={S.cardH2}>Listing Details</div>
              <div style={S.detailsGrid}>
                {[
                  { icon: 'cat',  label: 'Category',    value: listing.category },
                  { icon: 'sub',  label: 'Subcategory', value: listing.subcategory },
                  { icon: 'cond', label: 'Condition',   value: condition?.label || listing.condition },
                  { icon: 'cal',  label: 'Posted',      value: listing.created_at ? new Date(listing.created_at).toLocaleString('en-GB', { day:'numeric', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' }) : null },
                  { icon: 'id',   label: 'Listing ID',  value: listing.listing_id || ('SMW-' + (listing.id || '').slice(0,7).toUpperCase()) },
                  { icon: 'eye',  label: 'Views',       value: listing.view_count ? `${listing.view_count} views` : null },
                  { icon: 'avail',label: 'Availability', value: AVAILABILITY_META[listing.availability_status]?.label },
                  { icon: 'stat', label: 'Status',       value: listing.status === 'draft' ? 'Draft (not public)' : null },
                ].filter(r => r.value).map(({ icon, label, value }) => (
                  <div key={label} style={S.detailRow}>
                    <div style={S.detailLeft}>
                      <span style={S.detailIcon}>
                        {icon === 'cat'  && <Tag size={13} strokeWidth={2} color="#9ca3af" />}
                        {icon === 'sub'  && <SlidersHorizontal size={13} strokeWidth={2} color="#9ca3af" />}
                        {icon === 'cond' && <ShieldCheck size={13} strokeWidth={2} color="#9ca3af" />}
                        {icon === 'cal'  && <Calendar size={13} strokeWidth={2} color="#9ca3af" />}
                        {icon === 'id'   && <FileText size={13} strokeWidth={2} color="#9ca3af" />}
                        {icon === 'eye'  && <Eye size={13} strokeWidth={2} color="#9ca3af" />}
                        {icon === 'avail'&& <Package size={13} strokeWidth={2} color="#9ca3af" />}
                        {icon === 'stat' && <BadgeCheck size={13} strokeWidth={2} color="#9ca3af" />}
                      </span>
                      <span style={S.detailLabel}>{label}</span>
                    </div>
                    <span style={S.detailValue}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Trust / Vouch (non-owner) */}
            {!isOwner && (vouchChain || sellerTrust) && (
              <div style={S.card}>
                <VouchChainBanner vouchChain={vouchChain} loading={false} />
                {sellerTrust && <div style={{ marginTop: 8 }}><TrustBadge trustScore={sellerTrust} dealCount={sellerDeals} size="sm" /></div>}
              </div>
            )}

            {/* Status badges */}
            {listingStatus && <div style={{ marginBottom: 16 }}><StatusBadge status={listingStatus} /></div>}

            {/* Comments */}
            <div style={S.card}>
              <Comments listingId={listing.id} currentUser={currentUser} />
            </div>
          </div>

          {/* ───── RIGHT SIDEBAR ───── */}
          <div className="ld-sidebar" style={S.sidebar}>

            {/* ── MAIN SIDEBAR CARD ── */}
            <div style={S.sideCard}>

              <div className="ld-mobile-dup">
              {/* Posted time */}
              <p style={S.postedTime}>Posted {timeAgo(listing.created_at)}</p>

              {/* Title */}
              <h1 style={S.sideTitle}>{listing.title}</h1>

              {/* Condition + Availability chips */}
              {(condition || listing.availability_status) && (
                <div style={{ marginBottom: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {condition && (
                    <span style={{ ...S.condChip, background: condition.bg, color: condition.color }}>
                      {condition.label}
                    </span>
                  )}
                  {listing.availability_status && AVAILABILITY_META[listing.availability_status] && (
                    <span style={{ ...S.condChip, display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: AVAILABILITY_META[listing.availability_status].bg,
                      color: AVAILABILITY_META[listing.availability_status].color }}>
                      {listing.availability_status === 'in_stock' && <Check size={11} strokeWidth={2.5} color="currentColor" />}
                      {listing.availability_status === 'made_to_order' && <Clock size={11} strokeWidth={2.5} color="currentColor" />}
                      {listing.availability_status === 'not_available' && <X size={11} strokeWidth={2.5} color="currentColor" />}
                      {AVAILABILITY_META[listing.availability_status].label}
                    </span>
                  )}
                </div>
              )}

              {/* Price */}
              <div style={S.priceRow}>
                {listing.price_type === 'free' ? (
                  <span style={{ ...S.freePrice, display: 'inline-flex', alignItems: 'center', gap: 6 }}>FREE <Gift size={20} strokeWidth={2.2} color="#0F9D58" /></span>
                ) : (
                  <>
                    <span style={{ ...S.bigPrice, ...(flash ? { color: '#dc2626' } : {}) }}>
                      {formatPrice(effectiveUnitPrice)}
                    </span>
                    {flash && <span style={S.strikePrice}>{formatPrice(listing.price)}</span>}
                    {listing.price_type === 'negotiable' && !flash && (
                      <span style={S.negTag}>Negotiable</span>
                    )}
                  </>
                )}
              </div>
              {flash && flashTime && (
                <div style={S.flashTimerLine}>
                  <span style={{ animation: 'flashPulse 1s infinite', display: 'inline-flex' }}><Flame size={13} strokeWidth={2.4} color="#dc2626" fill="#dc2626" /></span>
                  Flash sale ends in <strong style={{ animation: 'timerTick 1s infinite', display: 'inline-block' }}>{flashTime}</strong>
                </div>
              )}
              </div>

              <div style={S.divider} />

              {/* 3 quick-facts in a row */}
              <div style={S.factsRow}>
                {listing.city && (
                  <div style={S.factCol}>
                    <MapPin size={15} color="#9ca3af" />
                    <span style={S.factLabel}>Location</span>
                    <span style={S.factVal}>{listing.city}</span>
                  </div>
                )}
                {listing.condition && (
                  <>
                    <div style={S.factDivider} />
                    <div style={S.factCol}>
                      <ShieldCheck size={15} strokeWidth={2} color="#9ca3af" />
                      <span style={S.factLabel}>Condition</span>
                      <span style={S.factVal}>{condition?.label || listing.condition}</span>
                    </div>
                    {listing.availability_status && AVAILABILITY_META[listing.availability_status] && (
                      <>
                        <div style={S.factDivider} />
                        <div style={S.factCol}>
                          <Package size={15} strokeWidth={2} color="#9ca3af" />
                          <span style={S.factLabel}>Availability</span>
                          <span style={S.factVal}>{AVAILABILITY_META[listing.availability_status].label}</span>
                        </div>
                      </>
                    )}
                  </>
                )}
              </div>

              <div style={S.divider} />

              {/* CTA buttons — desktop only; mobile uses the in-flow CTA card */}
              {!isOwner ? (
                <div className="ld-sidebar-cta" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button className="ld-btn-hover" style={S.chatBtn} onClick={handleChatWithSeller}>
                    <MessageCircle size={17} strokeWidth={2.2} color="#fff" />
                    Chat with Seller
                  </button>

                  {(listing.contact_methods || []).includes('call') && listing.call_number && (
                    <button className="ld-btn-hover" style={S.callBtn} onClick={() => window.location.href = `tel:${listing.call_number}`}>
                      <Phone size={17} strokeWidth={2.2} color="#374151" />
                      Call Seller
                    </button>
                  )}

                  {(listing.contact_methods || []).includes('whatsapp') && listing.whatsapp_number && (
                    <a className="ld-btn-hover" style={{ ...S.callBtn, textDecoration: 'none', color: '#15803d', borderColor: '#bbf7d0' }}
                      href={`https://wa.me/${listing.whatsapp_number.replace(/\D/g, '')}?text=${encodeURIComponent('Hi, I saw your listing "' + listing.title + '" on SokoMW')}`}
                      target="_blank" rel="noopener noreferrer">
                      <MessageCircle size={17} strokeWidth={2.2} color="#15803d" />
                      WhatsApp Seller
                    </a>
                  )}

                  {(listing.contact_methods || []).includes('email') && listing.seller_email && (
                    <a className="ld-btn-hover" style={{ ...S.callBtn, textDecoration: 'none' }}
                      href={`mailto:${listing.seller_email}?subject=${encodeURIComponent('Re: ' + listing.title)}`}>
                      <Mail size={17} strokeWidth={2.2} color="#374151" />
                      Email Seller
                    </a>
                  )}

                  <button className="ld-btn-hover" style={S.favBtn} onClick={() => setIsFavorited(f => !f)}>
                    <Heart size={17} strokeWidth={2} color={isFavorited ? '#dc2626' : '#374151'} fill={isFavorited ? '#dc2626' : 'none'} />
                    Add to Favorites
                  </button>
                </div>
              ) : (
                <div className="ld-sidebar-cta" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <button className="ld-btn-hover" style={S.chatBtn} onClick={() => navigate('/post/edit/' + listing.id)}>
                    <Pencil size={16} strokeWidth={2.2} color="#fff" />
                    Edit Listing
                  </button>
                  <button className="ld-btn-hover" style={{ ...S.callBtn, color: '#dc2626', borderColor: '#fecaca' }} onClick={() => setShowDeleteConfirm(true)}>
                    <Trash2 size={16} strokeWidth={2.2} color="#dc2626" />
                    Delete Listing
                  </button>
                </div>
              )}

              <div style={S.divider} />

              {/* ── SELLER / SHOP OWNER ── */}
              <div
                role="button"
                tabIndex={0}
                onClick={openOwner}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && openOwner()}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14,
                  cursor: 'pointer', borderRadius: 12, padding: 4, marginLeft: -4, marginRight: -4,
                }}
                className="ld-owner-card"
              >
                <div style={S.sellerAvatar}>
                  {ownerAvatarUrl
                    ? <img src={ownerAvatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : <span style={{ fontSize: 18, fontWeight: 800 }}>{(ownerDisplayName || 'U')[0].toUpperCase()}</span>
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <span style={S.sellerName}>{ownerDisplayName}</span>
                    {ownerIsVerified && (
                      <BadgeCheck size={15} strokeWidth={2.2} color="#0F9D58" />
                    )}
                  </div>
                  {ownerIsShop ? (
                    <div style={{ ...S.verifiedText, color: '#0F9D58' }}>
                      Shop storefront · Tap to open
                    </div>
                  ) : ownerIsVerified ? (
                    <div style={S.verifiedText}>Verified Seller</div>
                  ) : null}
                  {sellerRating > 0 && (
                    <div style={{ marginTop: 3 }}>
                      <StarRow rating={sellerRating} count={sellerReviewCount} />
                    </div>
                  )}
                  {ownerIsShop && ownerShop.listing_count != null && (
                    <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4, fontWeight: 600 }}>
                      {ownerShop.listing_count} product{ownerShop.listing_count === 1 ? '' : 's'}
                    </div>
                  )}
                </div>
                <span style={{ color: '#9ca3af', lineHeight: 1, marginTop: 10 }} aria-hidden><ChevronRight size={18} strokeWidth={2.4} color="#9ca3af" /></span>
              </div>

              {/* Seller / shop meta rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
                {!isOwner && !ownerIsShop && seller?.last_seen && (
                  <div style={S.sellerMetaRow}>
                    <Zap size={14} strokeWidth={2} color="#9ca3af" />
                    <span style={{ color: getOnlineStatus(seller.last_seen).color, fontWeight: 500 }}>
                      {getOnlineStatus(seller.last_seen).label === 'Online now' ? 'Very responsive' : 'Responsive'}
                    </span>
                    <span style={{ color: '#9ca3af' }}>· Typically replies in minutes</span>
                  </div>
                )}
                {!ownerIsShop && memberSince && (
                  <div style={S.sellerMetaRow}>
                    <Clock size={14} strokeWidth={2} color="#9ca3af" />
                    <span>Member since {memberSince}</span>
                  </div>
                )}
                {(ownerShop?.city || seller?.city) && (
                  <div style={S.sellerMetaRow}>
                    <MapPin size={14} color="#9ca3af" />
                    <span>{ownerShop?.city || seller?.city}</span>
                  </div>
                )}
              </div>

              {sellerStatus && !ownerIsShop && <div style={{ marginBottom: 10 }}><StatusBadge status={sellerStatus} /></div>}

              {!isOwner && (
                <button
                  type="button"
                  className="ld-btn-hover"
                  style={S.viewProfileBtn}
                  onClick={openOwner}
                >
                  {ownerIsShop ? 'Visit Shop' : 'View Seller Profile'}
                </button>
              )}
              {isOwner && ownerIsShop && (
                <button
                  type="button"
                  className="ld-btn-hover"
                  style={S.viewProfileBtn}
                  onClick={() => navigate('/shop/' + ownerShop.slug)}
                >
                  Open My Shop
                </button>
              )}
            </div>

            {/* ── BUY WITH CONFIDENCE ── */}
            {!isOwner && (
              <div style={S.sideCard}>
                <div style={S.sideCardHdr}>
                  <ShieldCheck size={16} strokeWidth={2.2} color="#0F9D58" />
                  Buy with Confidence
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 12 }}>
                  {[
                    { icon: <MapPin size={16} strokeWidth={2.2} />,  color: '#dbeafe', stroke: '#1d4ed8', text: 'Meet in a public place' },
                    { icon: <CheckCircle size={16} strokeWidth={2.2} />, color: '#dcfce7', stroke: '#15803d', text: 'Check the item before you pay' },
                    { icon: <Lock size={16} strokeWidth={2.2} />, color: '#dcfce7', stroke: '#15803d', text: 'Use secure payment methods' },
                    { icon: <AlertTriangle size={16} strokeWidth={2.2} />, color: '#fee2e2', stroke: '#dc2626', text: 'Report suspicious activity' },
                  ].map(({ icon, color, stroke, text }) => (
                    <div key={text} style={{ ...S.trustRow, gap: 10 }}>
                      <span style={{ width: 28, height: 28, borderRadius: 8, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: stroke }}>{icon}</span>
                      <span style={{ fontSize: 13, color: '#374151' }}>{text}</span>
                    </div>
                  ))}
                </div>
                <button style={S.safetyLink} onClick={() => navigate('/safety')}>
                  Learn more about safe trading →
                </button>
              </div>
            )}

            {/* ── SHARE THIS LISTING ── */}
            <div style={S.sideCard}>
              <div style={S.sideCardHdr}>Share this listing</div>
              <div style={{ display: 'flex', gap: 0 }}>
                {/* Copy Link */}
                <button className="ld-share-opt" style={S.shareOpt} onClick={copyLink}>
                  <div style={{ ...S.shareOptIcon, background: copied ? '#dcfce7' : '#f3f4f6' }}>
                    {copied
                      ? <Check size={18} strokeWidth={2.5} color="#15803d" />
                      : <Copy size={18} strokeWidth={2} color="#374151" />
                    }
                  </div>
                  <span style={S.shareOptLabel}>{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
                {/* WhatsApp */}
                <a className="ld-share-opt" style={S.shareOpt}
                  href={`https://wa.me/?text=${encodeURIComponent(listing.title + ' — ' + window.location.href)}`}
                  target="_blank" rel="noopener noreferrer">
                  <div style={{ ...S.shareOptIcon, background: '#dcfce7' }}>
                    <MessageCircle size={18} strokeWidth={2} color="#15803d" />
                  </div>
                  <span style={S.shareOptLabel}>WhatsApp</span>
                </a>
                {/* Facebook */}
                <a className="ld-share-opt" style={S.shareOpt}
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                  target="_blank" rel="noopener noreferrer">
                  <div style={{ ...S.shareOptIcon, background: '#dbeafe' }}>
                    <Facebook size={18} color="#1d4ed8" />
                  </div>
                  <span style={S.shareOptLabel}>Facebook</span>
                </a>
                {/* More */}
                <button className="ld-share-opt" style={S.shareOpt} onClick={() => setShowShareSheet(true)}>
                  <div style={{ ...S.shareOptIcon, background: '#f3f4f6' }}>
                    <MoreHorizontal size={18} color="#374151" />
                  </div>
                  <span style={S.shareOptLabel}>More</span>
                </button>
              </div>
            </div>

            {/* ── BUYERS LOOKING FOR CROSS-LINK ── */}
            {listing.buyers_looking_for && (
              <div style={{ ...S.sideCard, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 700, color: '#0F9D58', marginBottom: 6 }}>
                  <Bell size={16} strokeWidth={2.2} color="#0F9D58" />
                  This item matches buyer alerts
                </div>
                <p style={{ fontSize: 12, color: '#374151', marginBottom: 10, lineHeight: 1.5 }}>
                  This listing will notify buyers who've saved a matching "People Looking For" request.
                </p>
                <button style={S.safetyLink} onClick={() => navigate('/looking-for')}>
                  See People Looking For →
                </button>
              </div>
            )}

            {/* ── REPORT LISTING ── */}
            {!isOwner && (
              <div style={S.sideCard}>
                <div style={S.reportHdr}>
                  <Flag size={14} strokeWidth={2.2} color="#f59e0b" />
                  Report this listing
                </div>
                <p style={S.reportSub}>Report if this listing is inappropriate or suspicious.</p>
                <button style={alreadyReported ? { ...S.reportBtn, opacity: .55, cursor: 'default' } : S.reportBtn} disabled={alreadyReported} onClick={() => { setShowReportModal(true); setReportSent(false) }}>
                  {alreadyReported ? '✓ Reported' : 'Report Listing'}
                </button>
              </div>
            )}

            {/* ── YOU MAY ALSO LIKE ── */}
            {!isOwner && (
              <div style={S.sideCard}>
                <div style={S.sideCardHdr}>You may also like</div>
                <YouMayAlsLike currentListingId={listing.id} category={listing.category} navigate={navigate} />
              </div>
            )}

          </div>
        </div>
      </div>

      {/* ── DESKTOP STICKY FOOTER ── */}
      {!isOwner && (
        <div className="ld-desktop-bar" style={S.desktopBar}>
          <div style={S.desktopBarInner}>
            <div>
              <div style={S.barPrice}>{formatPrice(effectiveUnitPrice)}</div>
              <div style={S.barTitle}>{listing.title}</div>
              {listing.price_type === 'negotiable' && <div style={S.barNeg}>Negotiable</div>}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button className="ld-btn-hover" style={S.barChatBtn} onClick={handleChatWithSeller}>
                <MessageCircle size={16} strokeWidth={2.2} color="currentColor" />
                Chat with Seller
              </button>
            </div>
          </div>
        </div>
      )}
      {isOwner && (
        <div className="ld-desktop-bar" style={S.desktopBar}>
          <div style={{ ...S.desktopBarInner, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
            {featureError && <div style={S.featureErrorInline}>{featureError}</div>}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={S.barPrice}>{formatPrice(effectiveUnitPrice)}</div>
                <div style={S.barTitle}>{listing.title}</div>
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                {!isListingFeatured(listing) && (
                  <button
                    className="ld-btn-hover"
                    style={{ ...S.barCallBtn, color: '#b45309', borderColor: '#fde68a', background: '#fffbeb' }}
                    disabled={featuring}
                    onClick={handleFeature}
                  >
                    {featuring ? '…' : `Feature (${featuredPriceLabel()})`}
                  </button>
                )}
                <button className="ld-btn-hover" style={S.barCallBtn} onClick={() => navigate('/post/edit/' + listing.id)}>Edit Listing</button>
                <button className="ld-btn-hover" style={{ ...S.barCallBtn, color: '#dc2626', borderColor: '#fecaca' }} onClick={() => setShowDeleteConfirm(true)}>Delete</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── REPORT LISTING MODAL ── */}
      {showReportModal && (
        <div style={S.overlay} onClick={() => setShowReportModal(false)}>
          <div style={{ ...S.modal, maxHeight: '86vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            {!reportSent ? (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Flag size={36} strokeWidth={2} color="#dc2626" /></div>
                <div style={S.modalTitle}>Report this listing</div>
                <div style={S.modalSub}>Our admins will review your report. Thanks for keeping SokoMW safe.</div>

                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '16px 0 8px' }}>Why are you reporting?</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[
                    { value: 'scam_or_fraud',  label: 'Scam or fraud',        icon: <AlertTriangle size={16} strokeWidth={2.2} color="#dc2626" /> },
                    { value: 'counterfeit',   label: 'Counterfeit or fake item', icon: <Package size={16} strokeWidth={2.2} color="#b45309" /> },
                    { value: 'prohibited',    label: 'Prohibited or illegal item', icon: <Ban size={16} strokeWidth={2.2} color="#dc2626" /> },
                    { value: 'misleading',    label: 'Misleading description or price', icon: <CircleAlert size={16} strokeWidth={2.2} color="#d97706" /> },
                    { value: 'inappropriate',  label: 'Inappropriate content', icon: <EyeOff size={16} strokeWidth={2.2} color="#7c3aed" /> },
                    { value: 'other',         label: 'Other',                  icon: <FileText size={16} strokeWidth={2.2} color="#6b7280" /> },
                  ].map(r => (
                    <button key={r.value} onClick={() => setReportReason(r.value)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                      padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
                      border: reportReason === r.value ? '2px solid #dc2626' : '1.5px solid #e5e7eb',
                      background: reportReason === r.value ? '#fef2f2' : '#fff',
                      fontSize: 13.5, fontWeight: 600, color: '#374151', textAlign: 'left', fontFamily: 'inherit',
                    }}>
                      <span style={{ display: 'inline-flex' }}>{r.icon}</span> {r.label}
                      {reportReason === r.value && <span style={{ marginLeft: 'auto', color: '#dc2626' }}>✓</span>}
                    </button>
                  ))}
                </div>

                <div style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '16px 0 8px' }}>Details <span style={{ fontWeight: 500, color: '#9ca3af' }}>(optional)</span></div>
                <textarea
                  value={reportDetails}
                  onChange={e => setReportDetails(e.target.value)}
                  placeholder="Tell us what happened…"
                  maxLength={500}
                  style={{
                    width: '100%', minHeight: 88, padding: '10px 12px', borderRadius: 10,
                    border: '1.5px solid #e5e7eb', fontSize: 13, fontFamily: 'inherit',
                    outline: 'none', resize: 'vertical', boxSizing: 'border-box',
                  }}
                />

                <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
                  <button style={S.modalCancel} onClick={() => setShowReportModal(false)}>Cancel</button>
                  <button
                    style={{ ...S.modalDelete, opacity: reportReason && !reportSubmitting ? 1 : .5, cursor: reportReason && !reportSubmitting ? 'pointer' : 'default' }}
                    disabled={!reportReason || reportSubmitting}
                    onClick={submitReport}
                  >
                    {reportSubmitting ? 'Sending…' : 'Submit Report'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><CheckCircle size={44} strokeWidth={2} color="#0F9D58" /></div>
                <div style={S.modalTitle}>Report submitted</div>
                <div style={S.modalSub}>
                  Thank you for helping keep SokoMW safe. Our admin team has been notified and will review this listing.
                </div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                  <button style={{ ...S.modalDelete, background: '#0F9D58', minWidth: 140 }} onClick={() => setShowReportModal(false)}>Done</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── DELETE MODAL ── */}
      {showDeleteConfirm && (
        <div style={S.overlay} onClick={() => setShowDeleteConfirm(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Trash2 size={36} strokeWidth={2} color="#dc2626" /></div>
            <div style={S.modalTitle}>Delete this listing?</div>
            <div style={S.modalSub}>This can't be undone. All photos and details will be permanently removed.</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button style={S.modalCancel} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button style={S.modalDelete} onClick={deleteListing} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SHARE SHEET ── */}
      {showShareSheet && (
        <div style={S.overlay} onClick={() => setShowShareSheet(false)}>
          <div style={{ ...S.modal, paddingBottom: 28 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Share Listing</div>
            <div style={{ padding: '8px 0' }}>
              {[
                { onClick: () => { copyLink(); setShowShareSheet(false) }, icon: copied ? <Check size={20} strokeWidth={2.5} color="#0F9D58" /> : <Link2 size={20} strokeWidth={2} color="#374151" />, bg: copied ? '#dcfce7' : '#f3f4f6', label: copied ? 'Copied!' : 'Copy link', href: null },
                { href: `https://wa.me/?text=${encodeURIComponent(listing.title + ' — ' + window.location.href)}`, icon: <MessageCircle size={20} strokeWidth={2} color="#15803d" />, bg: '#dcfce7', label: 'Share on WhatsApp' },
                { href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`, icon: <Facebook size={20} color="#1d4ed8" />, bg: '#dbeafe', label: 'Share on Facebook' },
                { href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(listing.title)}&url=${encodeURIComponent(window.location.href)}`, icon: <Twitter size={20} color="#0ea5e9" />, bg: '#f0f9ff', label: 'Post on X' },
              ].map(({ onClick, href, icon, bg, label }) => {
                const content = (
                  <>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
                    <span style={{ fontSize: 15, fontWeight: 600, color: '#111827' }}>{label}</span>
                  </>
                )
                return href ? (
                  <a key={label} href={href} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 4px', textDecoration: 'none' }}>
                    {content}
                  </a>
                ) : (
                  <button key={label} onClick={onClick}
                    style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 4px', background: 'none', border: 'none', cursor: 'pointer', width: '100%' }}>
                    {content}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── "You may also like" mini component ──
function YouMayAlsLike({ currentListingId, category, navigate }) {
  const [items, setItems] = useState([])
  useEffect(() => {
    supabase.from('listings')
      .select('id,title,price,city,district,area,images')
      .eq('category', category)
      .neq('id', currentListingId)
      .limit(4)
      .then(({ data }) => setItems(data || []))
  }, [currentListingId, category])

  if (!items.length) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {items.map(item => (
        <div key={item.id}
          style={{ display: 'flex', gap: 12, cursor: 'pointer', alignItems: 'center' }}
          onClick={() => navigate('/listing/' + item.id)}>
          <div style={{ width: 56, height: 56, borderRadius: 8, background: '#f3f4f6', overflow: 'hidden', flexShrink: 0, border: '1px solid #e5e7eb' }}>
            {item.images?.[0]
              ? <img src={item.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
              : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Package size={20} strokeWidth={1.6} color="#9ca3af" /></div>
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.title}</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0F9D58', marginTop: 2 }}>{formatPrice(item.price)}</div>
            {item.city && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <MapPin size={10} color="#9ca3af" style={{ flexShrink: 0 }} />
                <span style={{
                  fontSize: 10.5, color: '#6b7280', fontWeight: 500,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {formatLocationLine(item)}
                </span>
              </div>
            )}
          </div>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#d1d5db', padding: 4 }}>
            <Heart size={16} strokeWidth={2} color="currentColor" />
          </button>
        </div>
      ))}
    </div>
  )
}

const S = {
  page:       { minHeight: '100vh', background: '#f3f4f6', fontFamily: "'DM Sans', 'Sora', system-ui, sans-serif" },
  loadWrap:   { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' },
  loadSpinner:{ width: 36, height: 36, border: '3px solid #e5e7eb', borderTop: '3px solid #0F9D58', borderRadius: '50%', animation: 'spin .8s linear infinite' },
  notFound:   { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 8, color: '#374151' },
  notFoundBtn:{ marginTop: 16, background: '#0F9D58', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },

  // ── TOP NAV ──
  topnav:     { background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 60 },
  topnavInner:{ maxWidth: 1200, margin: '0 auto', padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 20 },
  logo:       { cursor: 'pointer', flexShrink: 0 },
  logoSoko:   { fontSize: 20, fontWeight: 800, color: '#0F9D58' },
  logoMw:     { fontSize: 20, fontWeight: 800, color: '#374151' },
  logoSub:    { fontSize: 10, color: '#9ca3af', lineHeight: 1, marginTop: 1 },
  searchWrap: { flex: 1, position: 'relative', display: 'flex', alignItems: 'center' },
  searchInput:{ width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '9px 12px 9px 36px', fontSize: 13, color: '#374151', outline: 'none', fontFamily: 'inherit', paddingRight: 90 },
  searchBtn:  { position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)', background: '#0F9D58', color: '#fff', border: 'none', borderRadius: 6, padding: '6px 16px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  navRight:   { display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 },
  navIconBtn: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', color: '#374151' },
  navIconLabel:{ fontSize: 11, color: '#374151', fontWeight: 500 },
  sellNowBtn: { display: 'flex', alignItems: 'center', gap: 5, background: '#0F9D58', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 14px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
  avatarCircle:{ width: 34, height: 34, borderRadius: '50%', background: '#e6f4ec', color: '#0F9D58', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 800, cursor: 'pointer', border: '2px solid #d1fae5' },

  // ── TAB NAV ──
  tabnav:     { background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 57, zIndex: 55 },
  tabnavInner:{ maxWidth: 1200, margin: '0 auto', padding: '0 24px', display: 'flex', gap: 28, overflowX: 'auto' },

  // ── MOBILE NAV ──
  mobilenav:     { background: '#fff', borderBottom: '1px solid #e5e7eb', position: 'sticky', top: 0, zIndex: 60, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '11px 14px' },
  mobileBackBtn: { width: 34, height: 34, borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' },
  mobilenavTitle:{ fontSize: 14, fontWeight: 700, color: '#374151' },
  mobileNavBtn:  { width: 34, height: 34, borderRadius: 8, background: '#f9fafb', border: '1px solid #e5e7eb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' },

  // ── PAGE BODY ──
  pageBody:   { maxWidth: 1200, margin: '0 auto', padding: '0 24px' },

  // Breadcrumb
  breadcrumb: { display: 'flex', alignItems: 'center', gap: 5, padding: '12px 0 4px', fontSize: 13, color: '#9ca3af', flexWrap: 'wrap' },
  bcLink:     { display: 'flex', alignItems: 'center', gap: 4, color: '#6b7280', cursor: 'pointer', fontWeight: 500 },
  bcCurrent:  { color: '#111827', fontWeight: 600, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },

  backToResults:{ display: 'flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, color: '#374151', fontWeight: 500, padding: '4px 0 12px' },

  // ── TWO COLUMN ──
  twoCol:     { display: 'flex', gap: 24, alignItems: 'flex-start', paddingBottom: 160 },
  mainCol:    { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 4 },
  sidebar:    { width: 360, flexShrink: 0, position: 'sticky', top: 118, maxHeight: 'calc(100vh - 140px)', overflowY: 'auto', paddingTop: 4, display: 'flex', flexDirection: 'column', gap: 14 },

  // ── GALLERY ──
  galleryCard:   { background: '#fff', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb', position: 'relative' },
  galleryBadge:  { position: 'absolute', top: 12, left: 12, zIndex: 10, color: '#fff', fontSize: 11, fontWeight: 800, borderRadius: 6, padding: '4px 10px' },
  favOverlay:    { position: 'absolute', top: 12, right: 12, zIndex: 10, width: 36, height: 36, borderRadius: '50%', border: '1px solid #e5e7eb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.10)' },
  mainImgBox:    { position: 'relative', background: '#fff', minHeight: 380 },
  mainImg:       { width: '100%', height: 440, objectFit: 'contain', display: 'block' },
  arrowBtn:      { position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,.92)', border: '1px solid #e5e7eb', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 6px rgba(0,0,0,.08)', zIndex: 5 },
  flashBadge:    { position: 'absolute', top: 12, right: 56, background: '#dc2626', color: '#fff', fontSize: 13, fontWeight: 900, borderRadius: 6, padding: '4px 9px', animation: 'flashPulse 1s infinite' },
  videoTag:      { position: 'absolute', bottom: 12, left: 12, display: 'flex', alignItems: 'center', gap: 5, background: 'rgba(0,0,0,0.65)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '4px 9px' },
  noImg:         { height: 300, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f9fafb' },
  thumbStrip:    { display: 'flex', gap: 8, padding: '10px 12px', background: '#fff', overflowX: 'auto', borderTop: '1px solid #f3f4f6' },
  thumbMore:     { width: 72, height: 72, borderRadius: 8, border: '2px solid #e5e7eb', background: '#f9fafb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 700, color: '#6b7280', flexShrink: 0, cursor: 'pointer' },

  // ── CARDS ──
  card:       { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '20px 20px 18px' },
  cardH2:     { fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 12 },

  // Overview
  overviewBlurb: { fontSize: 14, color: '#4b5563', lineHeight: 1.7, marginBottom: 14 },
  specsGrid:     { display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, border: '1px solid #f3f4f6', borderRadius: 8, overflow: 'hidden' },
  specItem:      { padding: '12px 10px', background: '#fafafa', borderRight: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6', display: 'flex', flexDirection: 'column', gap: 4 },
  specIcon:      { marginBottom: 2 },
  specLabel:     { fontSize: 11, color: '#9ca3af', fontWeight: 500 },
  specValue:     { fontSize: 13, color: '#111827', fontWeight: 700 },

  // Description
  descBlock:    { display: 'flex', flexDirection: 'column', gap: 6 },
  descLine:     { display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 14, color: '#374151', lineHeight: 1.6 },
  descCheck:    { width: 18, height: 18, borderRadius: '50%', background: '#0F9D58', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 },
  tagsRow:      { display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 },
  tagChip:      { background: '#f0fdf4', color: '#0F9D58', fontSize: 12, fontWeight: 600, borderRadius: 20, padding: '3px 10px', border: '1px solid #d1fae5' },

  // Flash section
  flashSection:   { background: 'linear-gradient(135deg,#fff5f5,#fff)', border: '1.5px solid #fecaca', borderRadius: 12, padding: '14px 16px' },
  flashSectionHdr:{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15, fontWeight: 800, color: '#dc2626', marginBottom: 12 },

  // Bulk
  bulkTable:    { border: '1px solid #e5e7eb', borderRadius: 8, overflow: 'hidden', marginBottom: 12 },
  bulkRow:      { display: 'flex', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #f3f4f6' },
  bulkActiveRow:{ background: '#f0fdf4', borderLeft: '3px solid #0F9D58' },
  bulkHead:     { flex: 1, fontSize: 11, fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: .4 },
  bulkCell:     { flex: 1, fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  bulkPill:     { background: '#0F9D58', color: '#fff', fontSize: 9, fontWeight: 800, borderRadius: 4, padding: '1px 5px', marginLeft: 4 },
  discPill:     { background: '#dcfce7', color: '#15803d', borderRadius: 20, padding: '1px 6px', fontSize: 10, fontWeight: 800, marginLeft: 3 },
  qtyRow:       { display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingTop: 12, borderTop: '1px solid #f3f4f6' },
  qtyBtn:       { width: 32, height: 32, borderRadius: 8, background: '#f0fdf4', border: '1.5px solid #d1fae5', color: '#0F9D58', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  // Location
  viewMapLink:  { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: '#0F9D58', fontWeight: 600, textDecoration: 'none' },
  mapBox:       { width: 180, height: 110, borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb', flexShrink: 0 },
  mapBoxLarge:  { width: '100%', height: 320, borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' },

  // Listing details
  detailsGrid:  { display: 'grid', gridTemplateColumns: '1fr 1fr', rowGap: 0, columnGap: 24 },
  detailRow:    { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #f3f4f6' },
  detailLeft:   { display: 'flex', alignItems: 'center', gap: 5 },
  detailIcon:   { flexShrink: 0, display: 'flex', alignItems: 'center' },
  detailLabel:  { fontSize: 13, color: '#9ca3af', fontWeight: 500 },
  detailValue:  { fontSize: 13, color: '#111827', fontWeight: 600 },

  // ── SIDEBAR CARD ──
  sideCard:      { background: '#fff', borderRadius: 12, border: '1px solid #e5e7eb', padding: '18px 18px 16px' },
  sideCardHdr:   { fontSize: 15, fontWeight: 700, color: '#111827', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 7 },
  postedTime:    { fontSize: 12, color: '#9ca3af', fontWeight: 400, marginBottom: 6 },
  sideTitle:     { fontSize: 20, fontWeight: 800, color: '#111827', lineHeight: 1.3, marginBottom: 8 },
  condChip:      { display: 'inline-block', fontSize: 12, fontWeight: 700, borderRadius: 6, padding: '3px 9px' },

  // Price
  priceRow:      { display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', marginBottom: 4 },
  bigPrice:      { fontSize: 26, fontWeight: 800, color: '#0F9D58', lineHeight: 1 },
  freePrice:     { fontSize: 24, fontWeight: 900, color: '#15803d' },
  strikePrice:   { fontSize: 14, color: '#bbb', textDecoration: 'line-through', fontWeight: 500 },
  negTag:        { fontSize: 13, color: '#6b7280', fontWeight: 500 },
  flashTimerLine:{ fontSize: 13, color: '#dc2626', fontWeight: 600, marginBottom: 6, display: 'flex', alignItems: 'center', gap: 5 },
  totalLine:     { fontSize: 13, color: '#374151', background: '#f0fdf4', borderRadius: 6, padding: '6px 10px', marginBottom: 6 },

  divider:       { height: 1, background: '#f3f4f6', margin: '14px 0' },

  // 3 quick facts
  factsRow:      { display: 'flex', alignItems: 'stretch' },
  factCol:       { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '4px 0' },
  factDivider:   { width: 1, background: '#f3f4f6', alignSelf: 'stretch' },
  factLabel:     { fontSize: 11, color: '#9ca3af', fontWeight: 400 },
  factVal:       { fontSize: 12, color: '#111827', fontWeight: 700, textAlign: 'center' },

  // CTA buttons
  orderBtn: { width: '100%', background: '#F9AB00', color: '#202124', border: 'none', borderRadius: 10, padding: '14px', fontSize: 14.5, fontWeight: 800, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 12px rgba(249,171,0,.32)' },
  chatBtn:  { width: '100%', background: '#0F9D58', color: '#fff', border: 'none', borderRadius: 10, padding: '13px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 12px rgba(15,157,88,.28)' },
  callBtn:  { width: '100%', background: '#fff', color: '#374151', border: '1.5px solid #d1d5db', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  favBtn:   { width: '100%', background: '#fff', color: '#374151', border: '1.5px solid #d1d5db', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },

  // Seller
  sellerAvatar:  { width: 46, height: 46, borderRadius: '50%', background: '#0F9D58', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 800, flexShrink: 0, overflow: 'hidden' },
  sellerName:    { fontSize: 15, fontWeight: 700, color: '#111827' },
  verifiedText:  { fontSize: 12, color: '#0F9D58', fontWeight: 600, marginTop: 1 },
  sellerMetaRow: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280' },
  viewProfileBtn:{ width: '100%', background: '#f9fafb', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '10px', fontSize: 13, fontWeight: 700, color: '#374151', cursor: 'pointer' },

  // Trust card
  trustRow:     { display: 'flex', alignItems: 'center', gap: 10 },
  safetyLink:   { background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 13, color: '#0F9D58', fontWeight: 600 },
  assureRow:    { display: 'flex', flexDirection: 'column', gap: 8, background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 10, padding: '10px 12px' },
  assureItem:   { display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: '#374151', fontWeight: 500 },
  assureIcon:   { width: 22, height: 22, borderRadius: 6, background: '#e8f5ee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: '#0F9D58' },
  featureErrorInline: { fontSize: 12, fontWeight: 600, color: '#dc2626', background: '#fee2e2', border: '1px solid #fecaca', borderRadius: 8, padding: '7px 10px' },

  // Share
  shareOpt:     { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'none', padding: '6px 4px', borderRadius: 8 },
  shareOptIcon: { width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  shareOptLabel:{ fontSize: 11, color: '#374151', fontWeight: 500 },

  // Report
  reportHdr:  { fontSize: 13, fontWeight: 700, color: '#374151', display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 },
  reportSub:  { fontSize: 12, color: '#9ca3af', marginBottom: 12 },
  reportBtn:  { width: '100%', background: 'none', border: '1.5px solid #dc2626', borderRadius: 8, padding: '9px', fontSize: 13, fontWeight: 700, color: '#dc2626', cursor: 'pointer' },

  // Desktop sticky footer bar
  desktopBar:      { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 100, background: '#fff', borderTop: '1px solid #e5e7eb', boxShadow: '0 -4px 20px rgba(0,0,0,.06)' },
  desktopBarInner: { maxWidth: 1200, margin: '0 auto', padding: '12px 24px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  barPrice:        { fontSize: 20, fontWeight: 800, color: '#0F9D58' },
  barTitle:        { fontSize: 13, color: '#6b7280', marginTop: 2, maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  barNeg:          { fontSize: 11, color: '#6b7280', marginTop: 1 },
  barCallBtn:      { display: 'flex', alignItems: 'center', gap: 7, background: '#fff', border: '1.5px solid #d1d5db', borderRadius: 10, padding: '11px 24px', fontSize: 14, fontWeight: 700, color: '#374151', cursor: 'pointer' },
  barChatBtn:      { display: 'flex', alignItems: 'center', gap: 7, background: '#0F9D58', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 26px', fontSize: 14, fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(15,157,88,.28)' },

  // Modals
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal:       { background: '#fff', borderRadius: '22px 22px 0 0', padding: '26px 22px 16px', width: '100%', maxWidth: 480, animation: 'slideUp .3s ease' },
  modalTitle:  { fontSize: 17, fontWeight: 800, color: '#111827', textAlign: 'center', marginBottom: 6 },
  modalSub:    { fontSize: 13, color: '#6b7280', textAlign: 'center', marginBottom: 18, lineHeight: 1.6 },
  modalCancel: { flex: 1, background: '#f9fafb', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, color: '#374151', cursor: 'pointer' },
  modalDelete: { flex: 1, background: '#dc2626', border: 'none', borderRadius: 10, padding: '12px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer' },
}