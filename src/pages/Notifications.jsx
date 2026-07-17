import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { isListingFeatured } from '../utils/homeUtils'
import {
  ArrowLeftRight,
  Archive,
  Apple,
  Armchair,
  Bell,
  Briefcase,
  Calendar,
  Car,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Eye,
  Flag,
  Handshake,
  Heart,
  Home,
  MapPin,
  MessageCircle,
  MessageSquare,
  Package,
  PartyPopper,
  Phone,
  PhoneMissed,
  Search,
  Settings,
  Shirt,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Sprout,
  Star,
  Tag,
  Trash2,
  Truck,
  Users,
  VideoOff,
  AlertTriangle,
  Wrench,
  X,
  MailOpen,
  ChevronRight,
  Navigation,
  Store,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import { useUserLocation } from '../hooks/useUserLocation'
import '../styles/notifications.css'

const ICON_PROPS = { size: 18, strokeWidth: 1.75, 'aria-hidden': true }

/** Renders a Lucide icon component safely (modern stroke icons) */
function Ic({
  icon: Icon,
  size = 18,
  strokeWidth = 1.75,
  className = '',
  fill = 'none',
  absoluteStrokeWidth = false,
}) {
  if (!Icon) return null
  return (
    <Icon
      size={size}
      strokeWidth={strokeWidth}
      className={className}
      fill={fill}
      absoluteStrokeWidth={absoluteStrokeWidth}
      aria-hidden="true"
    />
  )
}

/**
 * Category → Lucide icon (aligned with homeConstants ALL_CATEGORIES).
 * Falls back to Tag for unknown / custom labels.
 */
const CATEGORY_ICONS = {
  electronics: Smartphone,
  phones: Smartphone,
  mobile: Smartphone,
  computers: Smartphone,
  furniture: Armchair,
  home: Armchair,
  clothing: Shirt,
  clothes: Shirt,
  fashion: Shirt,
  vehicles: Car,
  cars: Car,
  motor: Car,
  automotive: Car,
  property: Home,
  realestate: Home,
  housing: Home,
  land: Home,
  agriculture: Sprout,
  farming: Sprout,
  farm: Sprout,
  food: Apple,
  groceries: Apple,
  services: Wrench,
  service: Wrench,
  jobs: Briefcase,
  work: Briefcase,
  other: Package,
}

function getCategoryIcon(category) {
  if (!category) return Tag
  const key = String(category).toLowerCase().replace(/[^a-z0-9]+/g, '')
  if (CATEGORY_ICONS[key]) return CATEGORY_ICONS[key]
  // Partial match (e.g. "Electronics & Gadgets" → electronics)
  for (const [name, Icon] of Object.entries(CATEGORY_ICONS)) {
    if (key.includes(name) || name.includes(key)) return Icon
  }
  return Tag
}

/**
 * Home.jsx verified seal (Icon.verify) — green badge + white check.
 * Keep in sync with src/pages/Home.jsx `Icon.verify`.
 */
function VerifiedBadge({ size = 14, className = '' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
    >
      <path
        fill="#16a34a"
        d="M12 0a4 4 0 0 1 3.2 1.6 4 4 0 0 1 3.6 1 4 4 0 0 1 1 3.6A4 4 0 0 1 21.4 9.4a4 4 0 0 1 0 5.2A4 4 0 0 1 19.8 17.8a4 4 0 0 1-1 3.6 4 4 0 0 1-3.6 1A4 4 0 0 1 12 24a4 4 0 0 1-3.2-1.6 4 4 0 0 1-3.6-1 4 4 0 0 1-1-3.6A4 4 0 0 1 2.6 14.6a4 4 0 0 1 0-5.2A4 4 0 0 1 4.2 6.2a4 4 0 0 1 1-3.6 4 4 0 0 1 3.6-1A4 4 0 0 1 12 0Z"
      />
      <path
        d="m7.5 12.5 3 3 6-7"
        stroke="#fff"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Five modern star glyphs for Featured section heading */
function FeaturedStars({ size = 12 }) {
  return (
    <span className="ad-stars" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => (
        <Ic
          key={i}
          icon={Star}
          size={size}
          strokeWidth={0}
          fill="currentColor"
          className="ad-star-glyph"
        />
      ))}
    </span>
  )
}

/** Flow divider between rail sections */
function AdFlowDivider({ soft = false }) {
  return (
    <div className={`ad-flow-divider${soft ? ' ad-flow-divider--soft' : ''}`} aria-hidden="true">
      <span className="ad-flow-line" />
      <span className="ad-flow-arrow">
        <Ic icon={ChevronDown} size={16} strokeWidth={2.25} />
      </span>
      <span className="ad-flow-line" />
    </div>
  )
}

// ── Notification type config (premium Lucide icons) ───────────────────────
/* Colors aligned with Home brand tokens (green #0F9D58 + gold #F9AB00) */
const NOTIF_CONFIG = {
  new_message:      { Icon: MessageCircle,  color: '#1A73E8', bg: '#e8f0fe', label: 'Message',         category: 'messages' },
  missed_call:      { Icon: PhoneMissed,    color: '#ea4335', bg: '#fce8e6', label: 'Missed Call',     category: 'calls' },
  missed_video:     { Icon: VideoOff,       color: '#ea4335', bg: '#fce8e6', label: 'Missed Video',    category: 'calls' },
  listing_offer:    { Icon: CircleDollarSign, color: '#F9AB00', bg: '#fff8e1', label: 'Offer',         category: 'offers' },
  listing_view:     { Icon: Eye,            color: '#7c5cff', bg: '#efeaff', label: 'View',            category: 'listings' },
  listing_comment:  { Icon: MessageSquare,  color: '#1A73E8', bg: '#e8f0fe', label: 'Comment',         category: 'listings' },
  listing_sold:     { Icon: PartyPopper,    color: '#0F9D58', bg: '#e8f5ee', label: 'Sold',            category: 'listings' },
  listing_liked:    { Icon: Heart,          color: '#ea4335', bg: '#fce8e6', label: 'Liked',           category: 'listings' },
  booking_request:  { Icon: Calendar,       color: '#0F9D58', bg: '#e8f5ee', label: 'Booking',         category: 'bookings' },
  booking_confirmed:{ Icon: CheckCircle2,   color: '#1A73E8', bg: '#e8f0fe', label: 'Confirmed',       category: 'bookings' },
  booking_cancelled:{ Icon: X,              color: '#ea4335', bg: '#fce8e6', label: 'Cancelled',       category: 'bookings' },
  booking_completed:{ Icon: Flag,           color: '#0F9D58', bg: '#e8f5ee', label: 'Completed',       category: 'bookings' },
  deal_request:     { Icon: Handshake,      color: '#0F9D58', bg: '#e8f5ee', label: 'Deal Request',    category: 'deals' },
  deal_confirmed:   { Icon: PartyPopper,    color: '#0a7a44', bg: '#e8f5ee', label: 'Deal Confirmed',  category: 'deals' },
  deal_vouching:    { Icon: Sparkles,       color: '#c88a00', bg: '#fff8e1', label: 'Vouch Reminder',  category: 'deals' },
  new_vouch:        { Icon: Star,           color: '#F9AB00', bg: '#fff8e1', label: 'New Vouch',       category: 'deals' },
  order_placed:     { Icon: Package,        color: '#1A73E8', bg: '#e8f0fe', label: 'Order Placed',    category: 'orders' },
  order_shipped:    { Icon: Truck,          color: '#1A73E8', bg: '#e8f0fe', label: 'Shipped',         category: 'orders' },
  order_delivered:  { Icon: CheckCircle2,   color: '#0F9D58', bg: '#e8f5ee', label: 'Delivered',       category: 'orders' },
  order_cancelled:  { Icon: X,              color: '#ea4335', bg: '#fce8e6', label: 'Order Cancelled', category: 'orders' },
  system:           { Icon: Settings,       color: '#80868b', bg: '#f8f9fa', label: 'System',          category: 'system' },
  warning:          { Icon: AlertTriangle,  color: '#ea4335', bg: '#fce8e6', label: 'Warning',         category: 'system' },
  default:          { Icon: Bell,           color: '#0F9D58', bg: '#e8f5ee', label: 'Notification',    category: 'system' },
}

const TABS = [
  { id: 'all',      label: 'All',      Icon: Bell },
  { id: 'messages', label: 'Messages', Icon: MessageCircle },
  { id: 'listings', label: 'Listings', Icon: ShoppingBag },
  { id: 'offers',   label: 'Offers',   Icon: CircleDollarSign },
  { id: 'deals',    label: 'Deals',    Icon: Handshake },
  { id: 'orders',   label: 'Orders',   Icon: Package },
  { id: 'calls',    label: 'Calls',    Icon: Phone },
  { id: 'system',   label: 'System',   Icon: Settings },
]

const CATEGORIES = [
  { id: 'all',      label: 'All' },
  { id: 'messages', label: 'Messages' },
  { id: 'calls',    label: 'Calls' },
  { id: 'listings', label: 'Listings' },
  { id: 'offers',   label: 'Offers' },
  { id: 'deals',    label: 'Deals' },
  { id: 'orders',   label: 'Orders' },
  { id: 'bookings', label: 'Bookings' },
  { id: 'system',   label: 'System' },
]

const DEFAULT_FILTER = {
  search: '',
  readStatus: 'all',
  timeRange: 'all',
  category: 'all',
  sort: 'newest',
}

function getConfig(type) {
  return NOTIF_CONFIG[type] || NOTIF_CONFIG.default
}

function getActorId(notif) {
  const d = notif.data || {}
  return d.sender_id || d.caller_id || d.seller_id || d.buyer_id || d.user_id || null
}

function getActorName(notif, sender) {
  const d = notif.data || {}
  return sender?.full_name || d.sender_name || d.caller_name || d.buyer_name || d.seller_name || 'Someone'
}

/** Listing / service id attached to this notification (item under discussion). */
function getProductIds(notif) {
  const d = notif.data || {}
  return {
    listingId: d.listing_id || (d.context_type === 'listing' ? d.context_id : null) || null,
    serviceId: d.service_id || (d.context_type === 'service' ? d.context_id : null) || null,
    // Many message notifs only store context_id — try as listing, then service.
    contextId: d.context_id || null,
  }
}

function firstImage(images) {
  if (!images) return null
  if (Array.isArray(images)) return images[0] || null
  if (typeof images === 'string') {
    try {
      const parsed = JSON.parse(images)
      if (Array.isArray(parsed)) return parsed[0] || null
    } catch { /* plain url */ }
    return images
  }
  return null
}

function timeLabel(date) {
  const d = new Date(date)
  const now = new Date()
  const diff = now - d
  if (diff < 60000)    return 'just now'
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diff < 604800000) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
}

function isToday(date) {
  const d = new Date(date)
  const now = new Date()
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
}

function isThisWeek(date) {
  const now = new Date()
  const d = new Date(date)
  const diffDays = Math.floor((now - d) / 86400000)
  return diffDays <= 7
}

function matchCategory(notif, category) {
  if (category === 'all') return true
  if (category === 'messages') return notif.type === 'new_message'
  if (category === 'calls')    return ['missed_call', 'missed_video'].includes(notif.type)
  if (category === 'listings') return notif.type.startsWith('listing_')
  if (category === 'offers')   return notif.type === 'listing_offer'
  if (category === 'deals')    return notif.type.startsWith('deal_')
  if (category === 'orders')   return notif.type.startsWith('order_')
  if (category === 'bookings') return notif.type.startsWith('booking_')
  if (category === 'system') {
    return notif.type === 'system'
      || notif.type === 'warning'
      || String(notif.type || '').startsWith('verification_')
  }
  return true
}

function groupByDate(notifications) {
  const groups = {}
  for (const n of notifications) {
    const d = new Date(n.created_at)
    const now = new Date()
    const diffDays = Math.floor((now - d) / 86400000)
    let key
    if (diffDays === 0)      key = 'Today'
    else if (diffDays === 1) key = 'Yesterday'
    else if (diffDays < 7)   key = d.toLocaleDateString([], { weekday: 'long' })
    else                     key = d.toLocaleDateString([], { day: 'numeric', month: 'long' })
    if (!groups[key]) groups[key] = []
    groups[key].push(n)
  }
  return groups
}

function renderSmartBody(notif, sender) {
  const data = notif.data || {}
  const name = getActorName(notif, sender)

  switch (notif.type) {
    case 'new_message':
      return `${name} sent you a message${data.listing_title ? ` about "${data.listing_title}"` : ''}`
    case 'missed_call':
      return `You missed a voice call from ${name}`
    case 'missed_video':
      return `You missed a video call from ${name}`
    case 'listing_offer':
      return `${name} made an offer${data.listing_title ? ` on "${data.listing_title}"` : ''}`
    case 'listing_view': {
      const views = data.views
      const viewsText = typeof views === 'number' ? `${views} people` : (views || 'Someone')
      return `${viewsText} viewed your listing${data.listing_title ? ` "${data.listing_title}"` : ''}`
    }
    case 'listing_comment':
      return `${name} commented on "${data.listing_title || 'your listing'}"`
    case 'listing_liked':
      return `${name} liked "${data.listing_title || 'your listing'}"`
    case 'listing_sold':
      return `🎉 "${data.listing_title || 'Your listing'}" has been marked as sold!`
    case 'booking_request':
      return `${name} requested a booking for "${data.service_name || 'your service'}"`
    case 'booking_confirmed':
      return `Your booking for "${data.service_name || 'a service'}" has been confirmed`
    case 'booking_cancelled':
      return `Booking for "${data.service_name || 'a service'}" was cancelled`
    case 'booking_completed':
      return `Job completed: "${data.service_name || 'your service'}"`
    case 'deal_request':
      return `${data.seller_name || 'Seller'} wants to confirm the deal for "${data.listing_title || 'a listing'}"`
    case 'deal_confirmed':
      return `${data.buyer_name || 'Buyer'} confirmed the deal for "${data.listing_title || 'a listing'}"`
    case 'deal_vouching':
      return `Don't forget to vouch for ${data.seller_name || 'the seller'} — your vouch grows their reputation`
    case 'new_vouch':
      return `${name} vouched for you`
    default:
      return 'Tap to view details'
  }
}

// ── Hooks ──────────────────────────────────────────────────────────────────
function useSenderProfiles(notifications) {
  const [senders, setSenders] = useState({})
  const [loading, setLoading] = useState(false)

  const ids = useMemo(() => {
    const set = new Set()
    for (const n of notifications) {
      const id = getActorId(n)
      if (id) set.add(id)
    }
    return Array.from(set)
  }, [notifications])

  useEffect(() => {
    if (!ids.length) {
      setSenders({})
      setLoading(false)
      return
    }
    setLoading(true)
    let cancelled = false
    supabase
      .from('profiles')
      .select('id, full_name, avatar_url, is_verified')
      .in('id', ids)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setLoading(false)
          return
        }
        const map = {}
        if (data) data.forEach((p) => { map[p.id] = p })
        setSenders(map)
        setLoading(false)
      })
    return () => { cancelled = true }
  }, [ids])

  return { senders, loading }
}

/**
 * Resolve product (listing / service) images for notifications.
 * Payloads often include listing_title but omit the photo — we hydrate from DB.
 */
function useProductContext(notifications) {
  const [products, setProducts] = useState({}) // id → { kind, title, image, price }
  const [loading, setLoading] = useState(false)

  const keys = useMemo(() => {
    const listingIds = new Set()
    const serviceIds = new Set()
    const ambiguous = new Set()

    for (const n of notifications) {
      const d = n.data || {}
      const { listingId, serviceId, contextId } = getProductIds(n)
      if (listingId) listingIds.add(String(listingId))
      if (serviceId) serviceIds.add(String(serviceId))
      // Message/deal threads: context_id without type — resolve against both tables
      if (contextId && !listingId && !serviceId && !d.listing_title && !d.service_name) {
        ambiguous.add(String(contextId))
      } else if (contextId && !listingId && !serviceId) {
        // Prefer listing when we only have a title-ish message payload
        if (d.listing_title || n.type?.startsWith('listing_') || n.type?.startsWith('deal_') || n.type === 'new_message') {
          listingIds.add(String(contextId))
        } else if (n.type?.startsWith('booking_')) {
          serviceIds.add(String(contextId))
        } else {
          ambiguous.add(String(contextId))
        }
      }
    }
    return {
      listingIds: Array.from(listingIds),
      serviceIds: Array.from(serviceIds),
      ambiguous: Array.from(ambiguous),
    }
  }, [notifications])

  useEffect(() => {
    const { listingIds, serviceIds, ambiguous } = keys
    const allListing = [...new Set([...listingIds, ...ambiguous])]
    const allService = [...new Set([...serviceIds, ...ambiguous])]

    if (!allListing.length && !allService.length) {
      setProducts({})
      setLoading(false)
      return
    }

    setLoading(true)
    let cancelled = false

    async function load() {
      const map = {}
      const tasks = []

      if (allListing.length) {
        tasks.push(
          supabase
            .from('listings')
            .select('id, title, images, price, district, city')
            .in('id', allListing)
            .then(({ data }) => {
              for (const row of data || []) {
                map[row.id] = {
                  kind: 'listing',
                  title: row.title,
                  image: firstImage(row.images),
                  price: row.price,
                  district: row.district || null,
                  city: row.city || null,
                }
              }
            })
        )
      }

      if (allService.length) {
        tasks.push(
          supabase
            .from('services')
            .select('id, name, media_urls, rate, city, district')
            .in('id', allService)
            .then(({ data }) => {
              for (const row of data || []) {
                // Don't overwrite a listing match for ambiguous ids
                if (map[row.id]?.kind === 'listing') continue
                map[row.id] = {
                  kind: 'service',
                  title: row.name,
                  image: firstImage(row.media_urls),
                  price: row.rate,
                  district: row.district || null,
                  city: row.city || null,
                }
              }
            })
        )
      }

      await Promise.all(tasks)
      if (cancelled) return
      setProducts(map)
      setLoading(false)
    }

    load()
    return () => { cancelled = true }
  }, [keys])

  return { products, loading }
}

function resolveProduct(notif, products) {
  const d = notif.data || {}
  const { listingId, serviceId, contextId } = getProductIds(notif)

  // Explicit payload image wins
  const payloadImage =
    d.listing_image ||
    d.image ||
    firstImage(d.images) ||
    firstImage(d.media_urls) ||
    null

  const fromDb =
    (listingId && products[listingId]) ||
    (serviceId && products[serviceId]) ||
    (contextId && products[contextId]) ||
    null

  const title =
    fromDb?.title ||
    d.listing_title ||
    d.service_name ||
    d.title ||
    null

  const image = payloadImage || fromDb?.image || null
  const price = d.listing_price ?? d.price ?? fromDb?.price ?? null
  const district = fromDb?.district || d.district || d.listing_district || null
  const city = fromDb?.city || d.city || d.listing_city || null
  const id = listingId || serviceId || contextId || null
  const kind = fromDb?.kind || (d.service_id || d.service_name ? 'service' : 'listing')

  if (!title && !image && !id) return null
  return {
    id,
    kind,
    title: title || (kind === 'service' ? 'Service' : 'Listing'),
    image,
    price,
    district,
    city,
  }
}

// ── Reusable UI pieces ─────────────────────────────────────────────────────
function EmptyIllustration({ Icon, color, bg }) {
  return (
    <div
      className="empty-illustration"
      style={{
        width: 96,
        height: 96,
        borderRadius: 28,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 16px',
        background: `linear-gradient(145deg, ${bg} 0%, #ffffff 100%)`,
        border: `1px solid ${color}22`,
        boxShadow: `0 12px 32px -12px ${color}44`,
        color,
      }}
      aria-hidden="true"
    >
      <Ic icon={Icon} size={40} strokeWidth={1.5} />
    </div>
  )
}

function EmptyState({ category, search }) {
  const copy = search.trim()
    ? { title: 'No matches found', sub: 'Try a different search term or clear filters.', Icon: Search, color: '#80868b', bg: '#f8f9fa' }
    : EMPTY_COPY[category] || EMPTY_COPY.all

  return (
    <div className="empty-state" role="status" aria-live="polite">
      <EmptyIllustration Icon={copy.Icon} color={copy.color} bg={copy.bg} />
      <p className="empty-title">{copy.title}</p>
      <p className="empty-sub">{copy.sub}</p>
    </div>
  )
}

const EMPTY_COPY = {
  all:      { title: 'No notifications yet', sub: "You're all caught up! New activity will appear here.", Icon: Bell, color: '#0F9D58', bg: '#e8f5ee' },
  messages: { title: 'No messages yet', sub: 'When someone messages you, it will appear here.', Icon: MessageCircle, color: '#1A73E8', bg: '#e8f0fe' },
  calls:    { title: 'No missed calls', sub: 'Missed calls and video calls will appear here.', Icon: PhoneMissed, color: '#ea4335', bg: '#fce8e6' },
  listings: { title: 'No listing activity', sub: 'Views, comments, likes and sales on your listings will appear here.', Icon: ShoppingBag, color: '#0F9D58', bg: '#e8f5ee' },
  offers:   { title: 'No offers yet', sub: 'Offers from buyers will appear here.', Icon: CircleDollarSign, color: '#F9AB00', bg: '#fff8e1' },
  deals:    { title: 'No deal updates', sub: 'Deal requests and confirmations will appear here.', Icon: Handshake, color: '#0F9D58', bg: '#e8f5ee' },
  bookings: { title: 'No bookings yet', sub: 'Booking requests and updates will appear here.', Icon: Calendar, color: '#1A73E8', bg: '#e8f0fe' },
  orders:   { title: 'No orders yet', sub: 'Orders and shipping updates will appear here.', Icon: Package, color: '#1A73E8', bg: '#e8f0fe' },
  system:   { title: 'No system alerts', sub: 'System notifications and warnings will appear here.', Icon: Settings, color: '#80868b', bg: '#f8f9fa' },
}

function RippleButton({ className = '', variant = 'secondary', children, ...props }) {
  return (
    <button className={`btn btn-ripple ${variant} ${className}`} type="button" {...props}>
      {children}
    </button>
  )
}

function ActionButton({ label, icon: Icon, variant = 'secondary', onClick, ariaLabel }) {
  return (
    <RippleButton
      className="btn-sm"
      variant={variant}
      onClick={onClick}
      aria-label={ariaLabel || label}
      title={ariaLabel || label}
    >
      <span className="btn-icon" aria-hidden="true">
        <Ic icon={Icon} size={12} strokeWidth={2} />
      </span>
      <span>{label}</span>
    </RippleButton>
  )
}

function AvatarIcon({ notif, cfg, sender, loading, showTypeBadge = true }) {
  const actorId = getActorId(notif)
  const TypeIcon = cfg.Icon || Bell
  const name = sender?.full_name || 'User'
  const initial = (name && name !== 'Someone' ? name : 'U')[0].toUpperCase()

  if (loading && actorId) {
    return <div className="avatar-skeleton" aria-hidden="true" />
  }

  if (sender?.avatar_url) {
    return (
      <div className="avatar-wrap" aria-hidden="true">
        <img className="avatar" src={sender.avatar_url} alt={name} loading="lazy" />
        {showTypeBadge && (
          <span className="icon-badge" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
            <Ic icon={TypeIcon} size={9} strokeWidth={2.25} />
          </span>
        )}
      </div>
    )
  }

  // Letter avatar when no photo — still shows a person, not only the type icon
  if (actorId || sender) {
    return (
      <div className="avatar-wrap" aria-hidden="true">
        <span
          className="avatar avatar-initial"
          style={{ backgroundColor: cfg.bg, color: cfg.color }}
        >
          {initial}
        </span>
        {showTypeBadge && (
          <span className="icon-badge" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
            <Ic icon={TypeIcon} size={9} strokeWidth={2.25} />
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="icon-fallback" style={{ backgroundColor: cfg.bg, color: cfg.color }} aria-hidden="true">
      <Ic icon={TypeIcon} size={17} strokeWidth={1.75} />
    </div>
  )
}

/** Product strip: price (lead) → title → district. Photo optional when rail shows it. */
function ProductContext({ product, loading, hideImage = false }) {
  if (!product && !loading) return null
  if (loading && !product) {
    return (
      <div className="product-context is-loading" aria-hidden="true">
        {!hideImage && <div className="product-context-img skeleton-shimmer" />}
        <div className="product-context-meta">
          <div className="skeleton-line" style={{ width: '40%', height: 12 }} />
          <div className="skeleton-line" style={{ width: '68%', height: 9, marginTop: 6 }} />
        </div>
      </div>
    )
  }
  if (!product) return null

  const { title, image, price, kind, district, city } = product
  const priceLabel = price != null && price !== ''
    ? (typeof price === 'number' || /^\d+(\.\d+)?$/.test(String(price))
        ? `MWK ${Number(price).toLocaleString()}`
        : String(price))
    : null
  const place = [district, city].filter(Boolean).join(', ') || null
  const showImg = !hideImage

  return (
    <div className={`product-context${showImg ? '' : ' product-context--text'}`} title={title}>
      {showImg && (
        image ? (
          <img className="product-context-img" src={image} alt={title || 'Product'} loading="lazy" />
        ) : (
          <span className="product-context-img product-context-fallback" aria-hidden="true">
            <Ic icon={kind === 'service' ? Settings : Package} size={16} strokeWidth={1.75} />
          </span>
        )
      )}
      <div className="product-context-meta">
        {priceLabel && <div className="product-context-price">{priceLabel}</div>}
        <div className="product-context-title">{title}</div>
        {place && (
          <div className="product-context-place">
            <Ic icon={MapPin} size={11} strokeWidth={2.25} />
            {place}
          </div>
        )}
      </div>
    </div>
  )
}

function OfferChip({ data, cfg }) {
  if (!data.offer_amount) return null
  return (
    <div className="offer-chip" style={{ color: cfg.color, borderColor: cfg.color, backgroundColor: cfg.bg }}>
      <Ic icon={CircleDollarSign} size={13} strokeWidth={2} />
      <span>MWK {Number(data.offer_amount).toLocaleString()}</span>
    </div>
  )
}

/**
 * Decision actions only. Open/view/profile are handled by tapping the row —
 * keeps the inbox scannable and action rows rare.
 */
function NotificationActions({ notif, onAction }) {
  const actions = useMemo(() => {
    const handler = (key) => (e) => { e.stopPropagation(); onAction(key, notif) }

    switch (notif.type) {
      case 'missed_call':
      case 'missed_video':
        return [
          { id: 'call', label: 'Call back', Icon: Phone, variant: 'primary', onClick: handler('call') },
        ]
      case 'listing_offer':
        return [
          { id: 'accept', label: 'Accept', Icon: Check, variant: 'primary', onClick: handler('accept') },
          { id: 'counter', label: 'Counter', Icon: ArrowLeftRight, variant: 'secondary', onClick: handler('counter') },
          { id: 'decline', label: 'Decline', Icon: X, variant: 'danger', onClick: handler('decline') },
        ]
      case 'booking_request':
        return [
          { id: 'confirm', label: 'Confirm', Icon: Check, variant: 'primary', onClick: handler('confirm') },
          { id: 'decline', label: 'Decline', Icon: X, variant: 'danger', onClick: handler('decline') },
        ]
      case 'deal_request':
        return [
          { id: 'confirm', label: 'Confirm deal', Icon: Check, variant: 'primary', onClick: handler('confirm') },
          { id: 'decline', label: 'Decline', Icon: X, variant: 'danger', onClick: handler('decline') },
        ]
      case 'deal_confirmed':
      case 'deal_vouching':
      case 'new_vouch':
        return [
          { id: 'vouch', label: 'Vouch', Icon: Star, variant: 'primary', onClick: handler('vouch') },
        ]
      default:
        return []
    }
  }, [notif, onAction])

  if (actions.length === 0) return null

  return (
    <div className="notif-actions" onClick={(e) => e.stopPropagation()} role="group" aria-label="Notification actions">
      {actions.map((a) => (
        <ActionButton key={a.id} label={a.label} icon={a.Icon} variant={a.variant} onClick={a.onClick} />
      ))}
    </div>
  )
}

function SwipeActions({ children, onClick, onDelete, onMarkRead, onArchive, ariaLabel, index }) {
  const [reveal, setReveal] = useState(null)
  const [translate, setTranslate] = useState(0)
  const start = useRef(null)
  const startY = useRef(null)
  const swiping = useRef(false)
  const blockClick = useRef(false)

  const close = useCallback(() => { setReveal(null); setTranslate(0) }, [])

  const onTouchStart = useCallback((e) => {
    if (e.touches.length !== 1) return
    start.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    swiping.current = false
  }, [])

  const onTouchMove = useCallback((e) => {
    if (start.current == null) return
    const x = e.touches[0].clientX
    const y = e.touches[0].clientY
    const dx = x - start.current
    const dy = y - startY.current

    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 12) {
      swiping.current = true
    }

    if (!swiping.current) return

    if (reveal === 'left') {
      setTranslate(Math.min(0, dx - 120))
    } else if (reveal === 'right') {
      setTranslate(Math.max(0, dx + 80))
    } else {
      setTranslate(dx)
    }
  }, [reveal])

  const onTouchEnd = useCallback((e) => {
    if (start.current == null) return
    const dx = e.changedTouches[0].clientX - start.current
    blockClick.current = swiping.current
    swiping.current = false
    start.current = null

    if (reveal === 'left') {
      if (dx > 60) close()
      else if (dx < -60) { onDelete(); close() }
      else setTranslate(-120)
    } else if (reveal === 'right') {
      if (dx < -60) close()
      else if (dx >= 60) { onMarkRead(); close() }
      else setTranslate(80)
    } else {
      if (dx > 80) { setReveal('right'); setTranslate(80) }
      else if (dx < -80) { setReveal('left'); setTranslate(-120) }
      else close()
    }
  }, [reveal, close, onDelete, onMarkRead])

  const onContentClick = useCallback((e) => {
    if (blockClick.current) {
      e.preventDefault()
      blockClick.current = false
      return
    }
    if (reveal) {
      e.stopPropagation()
      close()
      return
    }
    onClick(e)
  }, [reveal, close, onClick])

  const onKeyDown = useCallback((e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onContentClick(e)
    }
  }, [onContentClick])

  const onAction = (fn) => (e) => {
    e.stopPropagation()
    close()
    if (fn) fn()
  }

  return (
    <div className="swipe-actions" onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd}>
      <div className="swipe-bg" aria-hidden="true">
        <div className={`swipe-actions-left ${reveal === 'left' ? 'visible' : ''}`}>
          <button className="swipe-action archive" aria-label="Archive notification" onClick={onAction(onArchive)}>
            <Ic icon={Archive} size={18} strokeWidth={2} />
            <span>Archive</span>
          </button>
          <button className="swipe-action delete" aria-label="Delete notification" onClick={onAction(onDelete)}>
            <Ic icon={Trash2} size={18} strokeWidth={2} />
            <span>Delete</span>
          </button>
        </div>
        <div className={`swipe-actions-right ${reveal === 'right' ? 'visible' : ''}`}>
          <button className="swipe-action read" aria-label="Mark as read" onClick={onAction(onMarkRead)}>
            <Ic icon={MailOpen} size={18} strokeWidth={2} />
            <span>Read</span>
          </button>
        </div>
      </div>
      <div
        className="swipe-content"
        role="listitem"
        aria-label={ariaLabel}
        tabIndex={0}
        style={{ transform: `translateX(${translate}px)`, animationDelay: `${index * 0.03}s` }}
        onClick={onContentClick}
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  )
}

/**
 * Purpose line — what the user must notice first.
 * Messages: the message text dominates.
 * Others: clear action sentence (viewed, offer, deal, etc.).
 */
function getNotificationPurpose(notif, sender) {
  const data = notif.data || {}
  const type = notif.type

  if (type === 'new_message') {
    const msg =
      notif.body ||
      notif.message ||
      data.message ||
      data.preview ||
      data.text ||
      data.content ||
      data.last_message ||
      null
    if (msg && String(msg).trim()) return String(msg).trim()
    if (data.listing_title) return `About "${data.listing_title}"`
    return 'Sent you a message'
  }

  // Prefer human-readable body; fall back to smart copy
  const body = notif.body || notif.message
  if (body && String(body).trim() && body !== notif.title) {
    return String(body).trim()
  }
  return renderSmartBody(notif, sender)
}

const NotificationCard = memo(function NotificationCard({
  notif,
  cfg,
  sender,
  sendersLoading,
  product,
  productsLoading,
  index,
  onCardClick,
  onDelete,
  onMarkRead,
  onArchive,
  onAction,
}) {
  const data = notif.data || {}
  const onClickCard = useCallback(() => onCardClick(notif), [onCardClick, notif])
  const actorName = getActorName(notif, sender)
  const hasActor = !!(actorName && actorName !== 'Someone')
  const displayName = hasActor ? actorName : (notif.title || cfg.label || 'Someone')
  const isVerified = !!(sender?.is_verified)
  const purpose = getNotificationPurpose(notif, sender)
  const TypeIcon = cfg.Icon || Bell
  const isMessage = notif.type === 'new_message'
  const showProduct = !!(product?.image || product?.title || productsLoading)

  // Context under purpose (listing title etc.) — name is shown on the person row
  const contextBits = []
  if (product?.title) contextBits.push(product.title)
  else if (data.listing_title) contextBits.push(data.listing_title)
  else if (data.service_name) contextBits.push(data.service_name)
  const contextLine = contextBits.join(' · ')

  const ariaLabel = [
    cfg.label,
    displayName,
    isVerified ? 'verified' : null,
    purpose,
    notif.read ? 'read' : 'unread',
  ].filter(Boolean).join(', ')

  return (
    <SwipeActions
      onClick={onClickCard}
      onDelete={() => onDelete(notif.id)}
      onMarkRead={() => onMarkRead(notif.id)}
      onArchive={() => onArchive(notif.id)}
      ariaLabel={ariaLabel}
      index={index}
    >
      <div className="notif-card-animator">
        <article
          className={[
            'notif-card',
            notif.read ? 'is-read' : 'is-unread',
            product?.image ? 'has-product' : '',
            isMessage ? 'is-message' : '',
          ].filter(Boolean).join(' ')}
          style={{ '--notif-accent': cfg.color }}
        >
          <div className="notif-card-inner">
            <div className="notif-card-main">
              {/* Avatar → full name → verified at end */}
              <div className="notif-person">
                <AvatarIcon
                  notif={notif}
                  cfg={cfg}
                  sender={sender}
                  loading={sendersLoading}
                />
                <div className="notif-person-text">
                  <div className="notif-person-row">
                    <span className={`notif-person-name${notif.read ? '' : ' is-unread-name'}`}>
                      {displayName}
                    </span>
                    {isVerified ? (
                      <span className="notif-person-verified" title="Verified user">
                        <VerifiedBadge size={14} />
                        <span className="notif-person-verified-label">Verified</span>
                      </span>
                    ) : (
                      hasActor && (
                        <span className="notif-person-unverified" title="Not verified">
                          Unverified
                        </span>
                      )
                    )}
                    <div className="notif-person-end">
                      <span
                        className="notif-type notif-type--inline"
                        style={{
                          color: cfg.color,
                          backgroundColor: cfg.bg,
                          borderColor: `${cfg.color}22`,
                        }}
                      >
                        <Ic icon={TypeIcon} size={10} strokeWidth={2.2} />
                        {cfg.label}
                      </span>
                      <time className="notif-time" dateTime={notif.created_at}>
                        {timeLabel(notif.created_at)}
                      </time>
                      {!notif.read && (
                        <span className="unread-dot" style={{ backgroundColor: cfg.color }} aria-hidden="true" />
                      )}
                    </div>
                  </div>
                </div>
              </div>

              <div className="notif-card-body">
                <p className={`notif-purpose${notif.read ? '' : ' is-unread-purpose'}`}>
                  {purpose}
                </p>

                {contextLine && (
                  <p className="notif-meta">{contextLine}</p>
                )}

                <OfferChip data={data} cfg={cfg} />

                {showProduct && (
                  <ProductContext
                    product={product}
                    loading={productsLoading && !product?.image}
                    hideImage={!!product?.image}
                  />
                )}

                <NotificationActions notif={notif} onAction={onAction} />
              </div>
            </div>

            {(product?.image || product?.title) && (
              <div className={`notif-product-rail${product?.image ? '' : ' notif-product-rail--empty'}`} aria-hidden="true">
                {product.image
                  ? <img src={product.image} alt="" loading="lazy" className="notif-product-rail-img" />
                  : <Ic icon={product.kind === 'service' ? Settings : Package} size={16} strokeWidth={1.75} />}
              </div>
            )}

            <div className="notif-side" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="notif-dismiss"
                aria-label="Dismiss notification"
                onClick={() => onDelete(notif.id)}
              >
                <Ic icon={X} size={12} strokeWidth={2.25} />
              </button>
            </div>
          </div>
        </article>
      </div>
    </SwipeActions>
  )
})

// ── Composite sections ─────────────────────────────────────────────────────
function Header({
  filter,
  unreadCount,
  notifications,
  filtersOpen,
  onSearch,
  onToggleFilters,
  onTab,
  onMarkAllRead,
  onBack,
}) {
  return (
    <header className="notifications-header">
      <div className="header-top">
        <div className="header-title-block">
          <button className="back-btn" aria-label="Go back" onClick={onBack}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 5l-7 7 7 7" />
            </svg>
          </button>
          <div className="header-text">
            <h1 className="header-title">Notifications</h1>
            {unreadCount > 0
              ? <p className="header-sub">{unreadCount} unread</p>
              : <p className="header-sub" style={{ color: '#9aa0a6' }}>You&apos;re all caught up</p>
            }
          </div>
        </div>
        <div className="header-actions">
          {unreadCount > 0 && (
            <button className="mark-all-btn" onClick={onMarkAllRead} aria-label="Mark all notifications as read">
              Mark all read
            </button>
          )}
          <button
            className={`filters-btn ${filtersOpen ? 'active' : ''}`}
            aria-label="Toggle filters"
            aria-expanded={filtersOpen}
            onClick={onToggleFilters}
          >
            Filters
          </button>
        </div>
      </div>

      <div className="header-search-row">
        <div className="search-bar">
          <span className="search-icon" aria-hidden="true">
            <Ic icon={Search} size={14} strokeWidth={2.1} />
          </span>
          <input
            className="search-input"
            type="search"
            placeholder="Search notifications"
            aria-label="Search notifications"
            value={filter.search}
            onChange={(e) => onSearch(e.target.value)}
          />
          {filter.search && (
            <button className="clear-search" aria-label="Clear search" onClick={() => onSearch('')}>
              <Ic icon={X} size={12} strokeWidth={2.5} />
            </button>
          )}
        </div>
      </div>

      <div className="tabs" role="tablist" aria-label="Notification categories">
        {TABS.map((tab) => {
          const active = filter.category === tab.id
          const count = tab.id === 'all'
            ? unreadCount
            : notifications.filter((n) => matchCategory(n, tab.id) && !n.read).length
          return (
            <button
              key={tab.id}
              className={`tab ${active ? 'active' : ''}`}
              role="tab"
              aria-selected={active}
              onClick={() => onTab(tab.id)}
            >
              <span aria-hidden="true" className="tab-icon">
                <Ic icon={tab.Icon} size={13} strokeWidth={2.1} />
              </span>
              <span>{tab.label}</span>
              {count > 0 && <span className="tab-badge" aria-label={`${count} unread`}>{count}</span>}
            </button>
          )
        })}
      </div>
    </header>
  )
}

function FilterChip({ label, active, onClick, ariaLabel }) {
  return (
    <button
      className={`filter-chip ${active ? 'filter-chip-active' : ''}`}
      aria-pressed={active}
      aria-label={ariaLabel}
      onClick={onClick}
    >
      {label}
    </button>
  )
}

function FilterSection({ title, options, activeId, onSelect, sectionKey }) {
  return (
    <div className="filter-section">
      <h3 className="filter-section-title">{title}</h3>
      <div className="filter-group" role="group" aria-label={title}>
        {options.map((opt) => (
          <FilterChip
            key={opt.id}
            label={opt.label}
            active={activeId === opt.id}
            ariaLabel={`${title}: ${opt.label}`}
            onClick={() => onSelect({ [sectionKey]: opt.id })}
          />
        ))}
      </div>
    </div>
  )
}

function FilterPanel({ filter, onChange, onClear, onClose }) {
  const READS = [
    { id: 'all', label: 'All' },
    { id: 'unread', label: 'Unread' },
    { id: 'read', label: 'Read' },
  ]
  const TIMES = [
    { id: 'all', label: 'All Time' },
    { id: 'today', label: 'Today' },
    { id: 'thisWeek', label: 'This Week' },
  ]
  const SORTS = [
    { id: 'newest', label: 'Newest' },
    { id: 'oldest', label: 'Oldest' },
  ]

  return (
    <div className="filter-panel" role="region" aria-label="Advanced filters">
      <div className="filter-panel-header">
        <h2 className="filter-panel-title">Filters</h2>
        <button className="filter-close" aria-label="Close filters" onClick={onClose}>
          <Ic icon={X} size={14} strokeWidth={2.5} />
        </button>
      </div>
      <FilterSection title="Status" options={READS} activeId={filter.readStatus} onSelect={onChange} sectionKey="readStatus" />
      <FilterSection title="Time" options={TIMES} activeId={filter.timeRange} onSelect={onChange} sectionKey="timeRange" />
      <FilterSection title="Category" options={CATEGORIES} activeId={filter.category} onSelect={onChange} sectionKey="category" />
      <FilterSection title="Sort" options={SORTS} activeId={filter.sort} onSelect={onChange} sectionKey="sort" />
      <button className="filter-clear" onClick={onClear} aria-label="Clear all filters">
        Clear all filters
      </button>
    </div>
  )
}

function SkeletonCard() {
  return (
    <div className="skeleton-card" aria-hidden="true">
      <div className="skeleton-card-inner">
        <div className="skeleton-avatar" />
        <div className="skeleton-lines">
          <div className="skeleton-line" style={{ width: '40%' }} />
          <div className="skeleton-line" style={{ width: '80%' }} />
          <div className="skeleton-line" style={{ width: '60%' }} />
        </div>
      </div>
      <div className="skeleton-actions">
        <div className="skeleton-pill" />
        <div className="skeleton-pill" />
      </div>
    </div>
  )
}

/**
 * Haversine distance in km — identical to SearchPage.jsx `distanceKm`.
 * Only call when both user + listing lat/lng are real numbers. Never invents.
 */
function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/**
 * Real distance label from calculated km only.
 * Examples: "0.8 km away", "2.4 km away", "5 km away", "8 km away"
 * Never estimates — returns null if km is missing/invalid.
 */
function formatDistanceLabel(km) {
  if (km == null || !Number.isFinite(km) || km < 0) return null
  if (km < 10) {
    // One decimal; Number() drops trailing .0 → "5 km away"
    return `${Number(km.toFixed(1))} km away`
  }
  return `${Math.round(km)} km away`
}

function parseCoord(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Resolve listing lat/lng from columns or precise_location payload. */
function getListingCoords(item) {
  let lat = parseCoord(item?.latitude)
  let lng = parseCoord(item?.longitude)
  if (lat != null && lng != null) return { lat, lng }

  const p = item?.precise_location
  if (!p) return null

  let obj = p
  if (typeof p === 'string') {
    try { obj = JSON.parse(p) } catch { return null }
  }
  if (!obj || typeof obj !== 'object') return null

  lat = parseCoord(obj.lat ?? obj.latitude ?? obj.y)
  lng = parseCoord(obj.lng ?? obj.longitude ?? obj.x)
  if (lat != null && lng != null) return { lat, lng }

  // GeoJSON Point: [lng, lat]
  if (Array.isArray(obj.coordinates) && obj.coordinates.length >= 2) {
    lng = parseCoord(obj.coordinates[0])
    lat = parseCoord(obj.coordinates[1])
    if (lat != null && lng != null) return { lat, lng }
  }
  return null
}

function formatPrice(price) {
  if (price == null || price === '') return null
  const n = Number(price)
  if (Number.isFinite(n)) return `MWK ${n.toLocaleString()}`
  return String(price)
}

// ── Ad image cache + lazy load (browser decode cache + in-memory set) ─────
const AD_IMAGE_CACHE = new Map() // url → 'loading' | 'ready' | 'error'
const AD_ANIMATED_ONCE = new Set() // listing ids that already played enter anim
const FEATURED_LAST_KEY = 'soko_featured_last_viewed_id'
const FEATURED_ROTATE_MS = 8000
/** Nearby list: initial batch + each scroll load-more page size */
const NEARBY_PAGE_SIZE = 4

function preloadAdImage(url) {
  if (!url || typeof url !== 'string') return
  const status = AD_IMAGE_CACHE.get(url)
  if (status === 'ready' || status === 'loading') return
  AD_IMAGE_CACHE.set(url, 'loading')
  const img = new Image()
  img.decoding = 'async'
  img.loading = 'eager'
  img.onload = () => { AD_IMAGE_CACHE.set(url, 'ready') }
  img.onerror = () => { AD_IMAGE_CACHE.set(url, 'error') }
  img.src = url
}

function isAdImageCached(url) {
  return url && AD_IMAGE_CACHE.get(url) === 'ready'
}

/**
 * Lazy product image with in-memory cache + browser cache.
 * Skips IntersectionObserver delay when already cached.
 */
function AdProductImage({ src, className = '', alt = '' }) {
  const ref = useRef(null)
  const cached = isAdImageCached(src)
  const [inView, setInView] = useState(cached)
  const [loaded, setLoaded] = useState(cached)

  useEffect(() => {
    if (!src || cached || inView) return
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true)
          io.disconnect()
        }
      },
      { rootMargin: '180px 0px', threshold: 0.01 }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [src, cached, inView])

  useEffect(() => {
    if (inView && src) preloadAdImage(src)
  }, [inView, src])

  if (!src) {
    return (
      <span className={`${className} ad-listing-img--empty`} aria-hidden="true">
        <Ic icon={Package} size={36} strokeWidth={1.25} />
      </span>
    )
  }

  return (
    <span ref={ref} className="ad-listing-img-wrap">
      {inView && (
        <img
          className={`${className}${loaded ? ' is-loaded' : ''}`}
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          // Hint browser to keep decoded image for reuse
          fetchPriority={cached ? 'high' : 'low'}
          onLoad={() => {
            AD_IMAGE_CACHE.set(src, 'ready')
            setLoaded(true)
          }}
          onError={() => {
            AD_IMAGE_CACHE.set(src, 'error')
            setLoaded(true)
          }}
        />
      )}
    </span>
  )
}

/**
 * Premium advertisement listing card — image-first.
 * Badges on photo: Featured · Distance · Verified
 * Compact body: price · title · district · Save · Message
 */
function AdListingCard({
  item,
  saved,
  onOpen,
  onSave,
  onMessage,
  featured = false,
  requireDistance = false,
  compact = false,
  animateEnter = true,
}) {
  const dist = formatDistanceLabel(item._distanceKm)
  const price = formatPrice(item.price)
  const district = item.district || item.city || null
  const category = (item.category && String(item.category).trim()) || null
  const verified = !!(item._sellerVerified || item._shopVerified)
  const showFeatured = featured || item._isFeat
  const hideForDistance = requireDistance && !dist
  const canMessage = !!item.seller_id && typeof onMessage === 'function'

  // Capture enter-anim decision once per mount so re-renders don't cancel it
  const [playEnter] = useState(() => {
    if (!animateEnter || item?.id == null) return false
    const key = String(item.id)
    if (AD_ANIMATED_ONCE.has(key)) return false
    AD_ANIMATED_ONCE.add(key)
    return true
  })

  // Nearby: never show without real calculated distance
  if (hideForDistance) return null

  const aria = [
    item.title || 'Listing',
    price,
    category,
    district,
    dist,
    verified ? 'Verified Seller' : null,
    showFeatured ? 'Featured' : null,
  ].filter(Boolean).join(', ')

  return (
    <article
      className={[
        'ad-listing-card',
        showFeatured ? 'is-featured' : '',
        compact ? 'is-compact' : 'is-hero',
        playEnter ? 'ad-enter-once' : '',
      ].filter(Boolean).join(' ')}
    >
      <div className="ad-listing-media">
        <button
          type="button"
          className="ad-listing-media-hit"
          onClick={() => onOpen(item.id)}
          aria-label={aria}
        >
          <AdProductImage
            src={item.image}
            className="ad-listing-img"
            alt={item.title || ''}
          />
          <span className="ad-listing-glass" aria-hidden="true" />
          <span className="ad-listing-media-shade" aria-hidden="true" />
        </button>

        {/* Top-left: Featured — same orange pill as Search FBListingCard */}
        {showFeatured && (
          <div className="ad-featured-pill" aria-label="Featured listing">
            <svg
              className="ad-featured-pill-star"
              width="11"
              height="11"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                fill="#fff"
                d="M12 2l2.9 6.9L22 10l-5 4.5L18.2 22 12 18.2 5.8 22 7 14.5 2 10l7.1-1.1L12 2z"
              />
            </svg>
            <span className="ad-featured-pill-label">Featured</span>
          </div>
        )}

        {/* Top-right: Category (icon matches category type) */}
        {category && (
          <div className="ad-listing-badges ad-listing-badges--top-right" aria-hidden="true">
            <span className="ad-img-badge ad-img-badge--category" title={category}>
              <Ic icon={getCategoryIcon(category)} size={11} strokeWidth={2.4} />
              {category}
            </span>
          </div>
        )}

        {/* Bottom of image, above price: Distance */}
        {dist && (
          <div className="ad-listing-badges ad-listing-badges--bottom" aria-hidden="true">
            <span className="ad-img-badge ad-img-badge--dist">
              <Ic icon={MapPin} size={11} strokeWidth={2.4} />
              {dist}
            </span>
          </div>
        )}
      </div>

      <div className="ad-listing-body">
        <button
          type="button"
          className="ad-listing-main"
          onClick={() => onOpen(item.id)}
        >
          {price && <div className="ad-listing-price">{price}</div>}
          <h4 className="ad-listing-title">{item.title}</h4>
          {(district || verified) && (
            <div className="ad-listing-meta-row">
              {district ? (
                <p className="ad-listing-place">
                  <Ic icon={MapPin} size={11} strokeWidth={2.2} />
                  <span>{district}</span>
                </p>
              ) : (
                <span className="ad-listing-place-spacer" />
              )}
              {verified && (
                <span className="ad-listing-verified-text" title="Verified Seller">
                  <VerifiedBadge size={13} />
                  <span>Verified Seller</span>
                </span>
              )}
            </div>
          )}
        </button>

        <div className="ad-listing-actions" role="group" aria-label="Listing actions">
          <button
            type="button"
            className={`ad-listing-action ad-listing-action--save${saved ? ' is-saved' : ''}`}
            aria-pressed={saved}
            onClick={() => onSave(item.id)}
          >
            <Ic
              icon={Heart}
              size={14}
              strokeWidth={2.1}
              fill={saved ? 'currentColor' : 'none'}
              className="ad-listing-action-ic"
            />
            {saved ? 'Saved' : 'Save'}
          </button>
          <button
            type="button"
            className="ad-listing-action ad-listing-action--message"
            disabled={!canMessage}
            onClick={() => canMessage && onMessage(item)}
            aria-label={canMessage ? `Message seller about ${item.title || 'listing'}` : 'Messaging unavailable'}
          >
            <Ic icon={MessageCircle} size={14} strokeWidth={2.1} className="ad-listing-action-ic" />
            Message
          </button>
        </div>
      </div>
    </article>
  )
}

/**
 * Featured Products rotator:
 * - Advances every 8s
 * - Pauses while hovered (or tab hidden)
 * - Restores last viewed listing id from sessionStorage
 * - Preloads next image into AD_IMAGE_CACHE
 * - Enter anim only once per listing
 */
function FeaturedRotator({ products, savedIds, onOpen, onSave, onMessage }) {
  const [index, setIndex] = useState(0)
  const [hovering, setHovering] = useState(false)
  const [docHidden, setDocHidden] = useState(
    () => typeof document !== 'undefined' && document.hidden
  )
  const indexRef = useRef(0)
  const productsRef = useRef(products)

  productsRef.current = products
  indexRef.current = index

  // Restore last viewed card when product list arrives
  useEffect(() => {
    if (!products.length) return
    let lastId = null
    try { lastId = sessionStorage.getItem(FEATURED_LAST_KEY) } catch { /* ignore */ }
    if (lastId) {
      const found = products.findIndex((p) => String(p.id) === String(lastId))
      if (found >= 0) {
        setIndex(found)
        indexRef.current = found
        return
      }
    }
    setIndex(0)
    indexRef.current = 0
  }, [products])

  // Persist last viewed
  useEffect(() => {
    const item = products[index]
    if (!item?.id) return
    try { sessionStorage.setItem(FEATURED_LAST_KEY, String(item.id)) } catch { /* ignore */ }
  }, [index, products])

  // Preload current + next (+ next-next) for smooth rotation
  useEffect(() => {
    if (!products.length) return
    const n = products.length
    ;[0, 1, 2].forEach((offset) => {
      const p = products[(index + offset) % n]
      if (p?.image) preloadAdImage(p.image)
    })
  }, [index, products])

  // Pause when tab hidden
  useEffect(() => {
    const onVis = () => setDocHidden(document.hidden)
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [])

  // 8s rotation — paused while hovering or tab hidden
  useEffect(() => {
    if (products.length <= 1) return
    if (hovering || docHidden) return

    const id = window.setInterval(() => {
      setIndex((prev) => {
        const list = productsRef.current
        if (!list.length) return prev
        return (prev + 1) % list.length
      })
    }, FEATURED_ROTATE_MS)

    return () => window.clearInterval(id)
  }, [products.length, hovering, docHidden])

  if (!products.length) {
    return <p className="ad-section-empty">No featured products right now.</p>
  }

  const item = products[index] || products[0]
  const paused = hovering || docHidden

  return (
    <div
      className={`featured-rotator${paused ? ' is-paused' : ''}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
      onFocusCapture={() => setHovering(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setHovering(false)
      }}
    >
      <div className="featured-rotator-stage" key={item.id}>
        <AdListingCard
          item={item}
          featured
          saved={savedIds.has(item.id)}
          onOpen={onOpen}
          onSave={onSave}
          onMessage={onMessage}
          animateEnter
        />
      </div>

      {products.length > 1 && (
        <div className="featured-rotator-meta" aria-label="Featured rotation">
          <div className="featured-rotator-dots" role="tablist" aria-label="Featured listings">
            {products.map((p, i) => (
              <button
                key={p.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Show featured ${i + 1} of ${products.length}`}
                className={`featured-rotator-dot${i === index ? ' is-active' : ''}`}
                onClick={() => {
                  setIndex(i)
                  try { sessionStorage.setItem(FEATURED_LAST_KEY, String(p.id)) } catch { /* ignore */ }
                }}
              />
            ))}
          </div>
          <div
            className="featured-rotator-progress"
            aria-hidden="true"
          >
            <span
              key={`${item.id}-${paused ? 'p' : 'r'}`}
              className={`featured-rotator-progress-bar${paused ? ' is-paused' : ''}`}
            />
          </div>
        </div>
      )}
    </div>
  )
}

function AdProductSkeleton({ featured = false }) {
  return (
    <div
      className={`ad-listing-card is-skeleton${featured ? ' is-featured' : ''}`}
      aria-hidden="true"
    >
      <div className="ad-listing-media skeleton-shimmer" />
      <div className="ad-listing-body ad-listing-body--skel">
        <div className="skeleton-line" style={{ width: '48%', height: 14 }} />
        <div className="skeleton-line" style={{ width: '86%', height: 11, marginTop: 12 }} />
        <div className="skeleton-line" style={{ width: '42%', height: 10, marginTop: 12 }} />
      </div>
    </div>
  )
}

/**
 * Desktop-only left advertisement rail.
 * Hierarchy: Featured Products → Near You (real distance) → Sponsored Shops (later).
 * Distance uses haversine from browser GPS + listing coords — never invented.
 */
function NearbyFeaturedRail() {
  const navigate = useNavigate()
  const { lat, lng, loading: locLoading, error: locError } = useUserLocation()
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [locRetrying, setLocRetrying] = useState(false)
  const [overrideCoords, setOverrideCoords] = useState(null)
  const [savedIds, setSavedIds] = useState(() => new Set())
  /** How many nearby cards are currently shown (grows as user scrolls) */
  const [nearbyVisible, setNearbyVisible] = useState(NEARBY_PAGE_SIZE)
  const nearbyScrollRef = useRef(null)
  const nearbySentinelRef = useRef(null)

  const userLat = parseCoord(overrideCoords?.lat ?? lat)
  const userLng = parseCoord(overrideCoords?.lng ?? lng)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const cols = 'id, title, price, images, city, district, category, latitude, longitude, precise_location, featured, is_featured, featured_until, created_at, status, seller_id, shop_id'
      const nowIso = new Date().toISOString()
      let rows = []

      // 1) Active featured (featured_until > now) with coordinates first
      const { data: featuredGeo } = await supabase
        .from('listings')
        .select(cols)
        .gt('featured_until', nowIso)
        .not('latitude', 'is', null)
        .not('longitude', 'is', null)
        .order('featured_until', { ascending: false })
        .limit(16)

      if (featuredGeo?.length) rows = featuredGeo

      // 2) Any active featured
      if (rows.length < 8) {
        const { data: featured } = await supabase
          .from('listings')
          .select(cols)
          .gt('featured_until', nowIso)
          .order('featured_until', { ascending: false })
          .limit(20)
        const seen = new Set(rows.map((r) => r.id))
        for (const r of featured || []) {
          if (!seen.has(r.id)) {
            rows.push(r)
            seen.add(r.id)
          }
        }
      }

      // 3) Nearby pool: as many geo listings as practical (distance sort client-side)
      {
        const { data: recentGeo } = await supabase
          .from('listings')
          .select(cols)
          .not('latitude', 'is', null)
          .not('longitude', 'is', null)
          .order('created_at', { ascending: false })
          .limit(100)
        const seen = new Set(rows.map((r) => r.id))
        for (const r of recentGeo || []) {
          if (!seen.has(r.id)) {
            rows.push(r)
            seen.add(r.id)
          }
        }
      }

      // 4) Last resort: any recent (featured fallback only; Near You still needs coords)
      if (!rows.length) {
        const { data: recent } = await supabase
          .from('listings')
          .select(cols)
          .order('created_at', { ascending: false })
          .limit(12)
        rows = recent || []
      }

      // Seller / shop verification for featured-style badges
      const sellerIds = [...new Set(rows.map((r) => r.seller_id).filter(Boolean))]
      const shopIds = [...new Set(rows.map((r) => r.shop_id).filter(Boolean))]
      const profileMap = {}
      const shopMap = {}

      await Promise.all([
        sellerIds.length
          ? supabase
            .from('profiles')
            .select('id, is_verified, full_name')
            .in('id', sellerIds)
            .then(({ data }) => {
              for (const p of data || []) profileMap[p.id] = p
            })
          : Promise.resolve(),
        shopIds.length
          ? supabase
            .from('shops')
            .select('id, is_verified')
            .in('id', shopIds)
            .then(({ data }) => {
              for (const s of data || []) shopMap[s.id] = s
            })
          : Promise.resolve(),
      ])

      rows = rows.map((r) => ({
        ...r,
        _sellerVerified: r.seller_id ? !!(profileMap[r.seller_id]?.is_verified) : false,
        _shopVerified: r.shop_id ? !!(shopMap[r.shop_id]?.is_verified) : false,
        _sellerName: r.seller_id ? (profileMap[r.seller_id]?.full_name || null) : null,
      }))

      if (cancelled) return
      setItems(rows)
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) return
    setLocRetrying(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        try { sessionStorage.setItem('userCoords', JSON.stringify(next)) } catch { /* ignore */ }
        setOverrideCoords(next)
        setLocRetrying(false)
      },
      () => setLocRetrying(false),
      // Match SearchPage / useUserLocation near-me options
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  }, [])

  const enriched = useMemo(() => {
    const hasUser = userLat != null && userLng != null
    return items.map((item) => {
      const img = firstImage(item.images)
      const coords = getListingCoords(item)
      // Same as SearchPage near-me: only set distance when both sides have real coords
      let _distanceKm = null
      if (hasUser && coords) {
        _distanceKm = distanceKm(userLat, userLng, coords.lat, coords.lng)
      }
      const isFeat = isListingFeatured(item)
      return {
        ...item,
        image: img,
        _distanceKm,
        _hasCoords: !!coords,
        _isPrecise: !!item.precise_location,
        _isFeat: isFeat,
      }
    })
  }, [items, userLat, userLng])

  /**
   * 1. Featured Products — rotation pool (up to 8).
   * One hero card is shown at a time; FeaturedRotator advances every 8s.
   */
  const featuredProducts = useMemo(() => {
    const featured = enriched
      .filter((i) => i._isFeat)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    if (featured.length >= 2) return featured.slice(0, 8)

    if (featured.length === 1) {
      const fillers = enriched
        .filter((i) => i.id !== featured[0].id)
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 7)
      return [...featured, ...fillers].slice(0, 8)
    }

    return enriched
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, 8)
  }, [enriched])

  /**
   * 2. Nearby Products — prioritize REAL distance only (SearchPage haversine).
   *    - Includes every listing with lat/lng + user GPS (featured or not)
   *    - Sorted nearest → farthest (never by featured flag)
   *    - Never invents distance
   */
  const nearYouAll = useMemo(() => {
    if (userLat == null || userLng == null) return []
    return enriched
      .filter((i) => i._distanceKm != null && Number.isFinite(i._distanceKm))
      .sort((a, b) => {
        // Nearest first; stable tie-break by newer listing
        if (a._distanceKm !== b._distanceKm) return a._distanceKm - b._distanceKm
        return new Date(b.created_at) - new Date(a.created_at)
      })
  }, [enriched, userLat, userLng])

  // Reset visible window when the nearby set / location changes
  useEffect(() => {
    setNearbyVisible(NEARBY_PAGE_SIZE)
  }, [userLat, userLng, nearYouAll.length])

  const nearYou = useMemo(
    () => nearYouAll.slice(0, nearbyVisible),
    [nearYouAll, nearbyVisible]
  )
  const hasMoreNearby = nearbyVisible < nearYouAll.length

  const loadMoreNearby = useCallback(() => {
    setNearbyVisible((n) => {
      if (n >= nearYouAll.length) return n
      return Math.min(n + NEARBY_PAGE_SIZE, nearYouAll.length)
    })
  }, [nearYouAll.length])

  // Infinite scroll: when sentinel enters the nearby list viewport, load more
  useEffect(() => {
    const root = nearbyScrollRef.current
    const sentinel = nearbySentinelRef.current
    if (!root || !sentinel || !hasMoreNearby) return

    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMoreNearby()
      },
      { root, rootMargin: '120px 0px', threshold: 0 }
    )
    io.observe(sentinel)
    return () => io.disconnect()
  }, [hasMoreNearby, loadMoreNearby, nearYou.length])

  const openListing = useCallback((id) => navigate(`/listing/${id}`), [navigate])

  const toggleSave = useCallback((id) => {
    setSavedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const messageSeller = useCallback((item) => {
    if (!item?.seller_id) return
    navigate(`/chat/${item.seller_id}/${item.id}`)
  }, [navigate])

  const hasLocation = userLat != null && userLng != null

  return (
    <aside className="nearby-rail" aria-label="Marketplace: Featured, then nearby, then more">
      <div className="nearby-rail-inner">
        {/*
          Attention hierarchy (always top → bottom):
          ★★★★★ Featured Products  ~60%
          ↓
          Nearby Products          ~30%
          ↓
          Everything else          ~10%
        */}
        <div className="nearby-rail-scroll nearby-rail-scroll--hierarchy">
          {loading ? (
            <>
              <section className="ad-section ad-section--featured ad-attention-60" aria-busy="true">
                <div className="ad-section-head ad-section-head--featured">
                  <h2 className="ad-section-title ad-section-title--featured">
                    <FeaturedStars />
                    Featured Products
                  </h2>
                </div>
                <div className="ad-section-list ad-section-list--featured">
                  {[1, 2].map((i) => <AdProductSkeleton key={i} featured />)}
                </div>
              </section>
              <AdFlowDivider />
              <section className="ad-section ad-section--near-you ad-attention-30" aria-busy="true">
                <div className="ad-section-head">
                  <h2 className="ad-section-title ad-section-title--near">
                    <span className="ad-section-title-ic" aria-hidden="true">
                      <Ic icon={MapPin} size={16} strokeWidth={2.1} />
                    </span>
                    Nearby Products
                  </h2>
                </div>
                <div className="near-you-scroll">
                  {[1, 2].map((i) => <AdProductSkeleton key={i} />)}
                </div>
              </section>
            </>
          ) : (
            <>
              {/* ═══ 60% attention — Featured Products ═══ */}
              <section
                className="ad-section ad-section--featured ad-attention-60"
                aria-labelledby="ad-featured-heading"
              >
                <div className="ad-section-head ad-section-head--featured">
                  <h2 id="ad-featured-heading" className="ad-section-title ad-section-title--featured">
                    <FeaturedStars />
                    Featured Products
                  </h2>
                  <p className="ad-section-sub ad-section-sub--featured">
                    Handpicked for you
                  </p>
                </div>

                {featuredProducts.length > 0 ? (
                  <FeaturedRotator
                    products={featuredProducts}
                    savedIds={savedIds}
                    onOpen={openListing}
                    onSave={toggleSave}
                    onMessage={messageSeller}
                  />
                ) : (
                  <p className="ad-section-empty">No featured products right now.</p>
                )}
              </section>

              <AdFlowDivider />

              {/* ═══ 30% attention — Nearby Products ═══ */}
              <section
                className="ad-section ad-section--near-you ad-attention-30"
                aria-labelledby="ad-near-heading"
              >
                <div className="ad-section-head">
                  <h2 id="ad-near-heading" className="ad-section-title ad-section-title--near">
                    <span className="ad-section-title-ic" aria-hidden="true">
                      <Ic icon={MapPin} size={16} strokeWidth={2.1} />
                    </span>
                    Nearby Products
                  </h2>
                  <p className="ad-section-sub">
                    {hasLocation && nearYouAll.length > 0
                      ? `Nearest first · ${nearYouAll.length} with real distance`
                      : 'Sorted by your real location'}
                  </p>
                </div>

                {(locLoading || locRetrying) && (
                  <p className="ad-section-empty">Finding your location…</p>
                )}

                {!hasLocation && !locLoading && !locRetrying && (
                  <>
                    <p className="ad-section-empty">
                      Enable location for real distance.
                    </p>
                    <button
                      type="button"
                      className="nearby-rail-loc-btn"
                      onClick={requestLocation}
                      disabled={locRetrying}
                    >
                      <Ic icon={Navigation} size={14} strokeWidth={2.25} />
                      {locError ? 'Enable location' : 'Use my location'}
                    </button>
                  </>
                )}

                {hasLocation && nearYou.length > 0 && (
                  <div
                    ref={nearbyScrollRef}
                    className="near-you-scroll"
                    role="list"
                    aria-label="Nearby products, nearest first. Scroll for more."
                  >
                    {nearYou.map((item) => (
                      <AdListingCard
                        key={item.id}
                        item={item}
                        compact
                        requireDistance
                        saved={savedIds.has(item.id)}
                        onOpen={openListing}
                        onSave={toggleSave}
                        onMessage={messageSeller}
                      />
                    ))}
                    {/* Invisible sentinel — auto-loads next batch as user scrolls down */}
                    {hasMoreNearby && (
                      <div
                        ref={nearbySentinelRef}
                        className="near-you-sentinel"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                )}

                {hasLocation && !locLoading && nearYouAll.length === 0 && (
                  <p className="ad-section-empty">
                    No GPS-located listings nearby yet.
                  </p>
                )}
              </section>

              <AdFlowDivider soft />

              {/* ═══ 10% attention — Everything else ═══ */}
              <footer className="ad-section ad-section--else ad-attention-10" aria-label="Everything else">
                <div className="ad-else-actions">
                  <button
                    type="button"
                    className="nearby-rail-cta nearby-rail-cta--else"
                    onClick={() => navigate('/')}
                  >
                    <Ic icon={ShoppingBag} size={15} strokeWidth={2.1} />
                    Explore marketplace
                    <Ic icon={ChevronRight} size={15} strokeWidth={2.1} />
                  </button>
                </div>
              </footer>
            </>
          )}
        </div>
      </div>
    </aside>
  )
}

function PushNotificationsBanner({ onEnable, onDismiss }) {
  return (
    <div className="push-banner" role="banner" aria-label="Push notifications prompt">
      <span className="push-banner-icon" aria-hidden="true" style={{ color: '#0F9D58' }}>
        <Ic icon={Bell} size={22} strokeWidth={1.75} />
      </span>
      <div className="push-banner-text">
        <div className="push-banner-title">Enable push notifications</div>
        <div className="push-banner-sub">Stay updated on new messages, offers, and deals.</div>
      </div>
      <div className="push-banner-actions">
        <button className="btn btn-sm btn-primary" onClick={onEnable} aria-label="Enable push notifications">
          Enable
        </button>
        <button className="btn btn-sm btn-ghost" onClick={onDismiss} aria-label="Dismiss push notification prompt">
          Not now
        </button>
      </div>
      <button className="push-banner-close" aria-label="Close" onClick={onDismiss}>
        <Ic icon={X} size={14} strokeWidth={2.5} />
      </button>
    </div>
  )
}

/**
 * Desktop right rail — Shops + Looking For advertisements.
 */
function RightPromoRail() {
  const navigate = useNavigate()
  const [shops, setShops] = useState([])
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [shopsRes, reqRes] = await Promise.all([
        supabase
          .from('shops')
          .select('id, name, slug, category, logo_url, city, district, rating, is_verified, follower_count')
          .eq('is_active', true)
          .order('follower_count', { ascending: false, nullsFirst: false })
          .limit(5),
        supabase
          .from('buyer_requests')
          .select('id, title, category, city, budget, created_at, image_url, urgency')
          .not('status', 'eq', 'fulfilled')
          .order('created_at', { ascending: false })
          .limit(5),
      ])
      if (cancelled) return
      setShops(shopsRes.data || [])
      setRequests(reqRes.data || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [])

  return (
    <aside className="right-promo-rail" aria-label="Shops and Looking For">
      <div className="right-promo-rail-inner">
        {/* ── Shops ── */}
        <section className="promo-block promo-block--shops" aria-labelledby="promo-shops-heading">
          <header className="promo-block-head">
            <h2 id="promo-shops-heading" className="promo-block-title">
              <span className="promo-block-title-ic" aria-hidden="true">
                <Ic icon={Store} size={15} strokeWidth={2.1} />
              </span>
              Shops
            </h2>
            <button
              type="button"
              className="promo-block-link"
              onClick={() => navigate('/shops')}
            >
              See all
              <Ic icon={ChevronRight} size={14} strokeWidth={2.2} />
            </button>
          </header>
          <p className="promo-block-sub">Trusted businesses near you</p>

          {loading ? (
            <div className="promo-list" aria-busy="true">
              {[1, 2, 3].map((i) => (
                <div key={i} className="promo-card is-skeleton" aria-hidden="true">
                  <div className="promo-card-avatar skeleton-shimmer" />
                  <div className="promo-card-body">
                    <div className="skeleton-line" style={{ width: '70%', height: 11 }} />
                    <div className="skeleton-line" style={{ width: '45%', height: 9, marginTop: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : shops.length === 0 ? (
            <p className="promo-empty">No shops to show right now.</p>
          ) : (
            <div className="promo-list">
              {shops.map((shop) => {
                const place = shop.city || shop.district || null
                const href = shop.slug ? `/shop/${shop.slug}` : `/shop/${shop.id}`
                return (
                  <button
                    key={shop.id}
                    type="button"
                    className="promo-card promo-card--shop"
                    onClick={() => navigate(href)}
                  >
                    <span className="promo-card-avatar">
                      {shop.logo_url ? (
                        <img src={shop.logo_url} alt="" loading="lazy" />
                      ) : (
                        <span className="promo-card-avatar-fallback" aria-hidden="true">
                          {(shop.name || 'S')[0].toUpperCase()}
                        </span>
                      )}
                    </span>
                    <span className="promo-card-body">
                      <span className="promo-card-title-row">
                        <span className="promo-card-title">{shop.name}</span>
                        {shop.is_verified && (
                          <VerifiedBadge size={13} />
                        )}
                      </span>
                      <span className="promo-card-meta">
                        {shop.category && <span>{shop.category}</span>}
                        {place && <span>{place}</span>}
                      </span>
                    </span>
                    <Ic icon={ChevronRight} size={14} strokeWidth={2} className="promo-card-chevron" />
                  </button>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Looking For ── */}
        <section className="promo-block promo-block--looking" aria-labelledby="promo-looking-heading">
          <header className="promo-block-head">
            <h2 id="promo-looking-heading" className="promo-block-title">
              <span className="promo-block-title-ic promo-block-title-ic--looking" aria-hidden="true">
                <Ic icon={Users} size={15} strokeWidth={2.1} />
              </span>
              Looking For
            </h2>
            <button
              type="button"
              className="promo-block-link"
              onClick={() => navigate('/looking-for')}
            >
              See all
              <Ic icon={ChevronRight} size={14} strokeWidth={2.2} />
            </button>
          </header>
          <p className="promo-block-sub">People searching for products</p>

          {loading ? (
            <div className="promo-list" aria-busy="true">
              {[1, 2, 3].map((i) => (
                <div key={i} className="promo-card is-skeleton" aria-hidden="true">
                  <div className="promo-card-thumb skeleton-shimmer" />
                  <div className="promo-card-body">
                    <div className="skeleton-line" style={{ width: '80%', height: 11 }} />
                    <div className="skeleton-line" style={{ width: '40%', height: 9, marginTop: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : requests.length === 0 ? (
            <p className="promo-empty">No open requests right now.</p>
          ) : (
            <div className="promo-list">
              {requests.map((req) => {
                const budget =
                  req.budget != null && req.budget !== ''
                    ? (Number.isFinite(Number(req.budget))
                        ? `MWK ${Number(req.budget).toLocaleString()}`
                        : String(req.budget))
                    : null
                return (
                  <button
                    key={req.id}
                    type="button"
                    className="promo-card promo-card--looking"
                    onClick={() => navigate('/looking-for')}
                  >
                    <span className="promo-card-thumb">
                      {req.image_url ? (
                        <img src={req.image_url} alt="" loading="lazy" />
                      ) : (
                        <span className="promo-card-thumb-fallback" aria-hidden="true">
                          <Ic icon={Search} size={16} strokeWidth={1.75} />
                        </span>
                      )}
                    </span>
                    <span className="promo-card-body">
                      <span className="promo-card-title">{req.title}</span>
                      <span className="promo-card-meta">
                        {budget && <span className="promo-card-budget">{budget}</span>}
                        {req.city && <span>{req.city}</span>}
                        {req.category && <span>{req.category}</span>}
                      </span>
                    </span>
                    <Ic icon={ChevronRight} size={14} strokeWidth={2} className="promo-card-chevron" />
                  </button>
                )
              })}
            </div>
          )}
        </section>
      </div>
    </aside>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function Notifications() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(DEFAULT_FILTER)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [toast, setToast] = useState(null)
  const [user, setUser] = useState(null)
  const [pushBannerVisible, setPushBannerVisible] = useState(() => typeof Notification !== 'undefined' ? Notification.permission === 'default' : true)
  const { senders, loading: sendersLoading } = useSenderProfiles(notifications)
  const { products, loading: productsLoading } = useProductContext(notifications)

  // ── Toast ────────────────────────────────────────────────────────────────
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, id: Date.now() })
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission !== 'default') {
      setPushBannerVisible(false)
    }
  }, [])

  // ── Load notifications ───────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!mounted) return
      if (!user) { navigate('/login'); return }
      setUser(user)

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100)

      if (!mounted) return
      if (!error) setNotifications(data || [])
      setLoading(false)

      await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user.id)
        .eq('read', false)
    }
    load()
    return () => { mounted = false }
  }, [navigate])

  // ── Real-time updates ────────────────────────────────────────────────────
  useEffect(() => {
    if (!user) return

    const handleChange = (payload) => {
      const event = payload.eventType
      if (event === 'INSERT') {
        const notif = payload.new
        if (notif.user_id !== user.id) return
        setNotifications((prev) => [notif, ...prev])
        showToast('New notification', 'new')
      } else if (event === 'UPDATE') {
        const notif = payload.new
        setNotifications((prev) => prev.map((n) => (n.id === notif.id ? notif : n)))
      } else if (event === 'DELETE') {
        const id = payload.old?.id
        if (id) setNotifications((prev) => prev.filter((n) => n.id !== id))
      }
    }

    let channel = null
    if (supabase.channel) {
      channel = supabase
        .channel('notifications')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` }, handleChange)
        .subscribe()
    } else if (supabase.from('notifications')?.on) {
      channel = supabase.from('notifications').on('*', handleChange).subscribe()
    }

    return () => {
      if (channel) {
        if (supabase.removeChannel) supabase.removeChannel(channel)
        else if (channel.unsubscribe) channel.unsubscribe()
      }
    }
  }, [user, showToast])

  // ── Actions ──────────────────────────────────────────────────────────────
  const markAllRead = useCallback(async () => {
    if (!user) return
    await supabase.from('notifications').update({ read: true }).eq('user_id', user.id)
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
  }, [user])

  const markOneRead = useCallback(async (id) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)))
    await supabase.from('notifications').update({ read: true }).eq('id', id)
  }, [])

  const deleteNotification = useCallback(async (id) => {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications((prev) => prev.filter((n) => n.id !== id))
    showToast('Notification removed', 'success')
  }, [showToast])

  const archiveNotification = useCallback((id) => {
    showToast('Archive feature coming soon', 'info')
  }, [showToast])

  const navigateByType = useCallback((notif) => {
    const data = notif.data || {}
    switch (notif.type) {
      case 'new_message':
        if (data.sender_id && data.context_id) navigate(`/chat/${data.sender_id}/${data.context_id}`, { state: { scrollToMessageId: data.message_id } })
        else if (data.sender_id) navigate(`/chat/${data.sender_id}`, { state: { scrollToMessageId: data.message_id } })
        else navigate('/chats')
        break
      case 'missed_call':
      case 'missed_video':
        if (data.caller_id && data.context_id) navigate(`/chat/${data.caller_id}/${data.context_id}`, { state: { scrollToMessageId: data.message_id } })
        else if (data.caller_id) navigate(`/chat/${data.caller_id}`, { state: { scrollToMessageId: data.message_id } })
        else navigate('/chats')
        break
      case 'listing_offer':
      case 'listing_view':
      case 'listing_comment':
      case 'listing_liked':
      case 'listing_sold':
        if (data.listing_id) navigate(`/listing/${data.listing_id}`)
        break
      case 'booking_request':
      case 'booking_confirmed':
      case 'booking_cancelled':
      case 'booking_completed':
        if (data.booking_id) navigate(`/bookings/${data.booking_id}`)
        else navigate('/services')
        break
      case 'deal_request':
      case 'deal_confirmed':
        if (data.seller_id && data.context_id) navigate(`/chat/${data.seller_id}/${data.context_id}`)
        else if (data.seller_id) navigate(`/chat/${data.seller_id}`)
        break
      case 'deal_vouching':
        if (data.seller_id) navigate(`/profile/${data.seller_id}`)
        break
      case 'order_placed':
      case 'order_shipped':
      case 'order_delivered':
      case 'order_cancelled':
        if (data.order_id) navigate(`/orders/${data.order_id}`)
        else navigate('/orders')
        break
      case 'verification_submitted':
      case 'verification_payment_confirmed':
      case 'verification_payment_rejected':
      case 'verification_under_review':
      case 'verification_additional_info':
      case 'verification_documents_rejected':
      case 'verification_approved':
      case 'verification_rejected':
      case 'verification_removed':
      case 'verification_expired':
      case 'verification_resubmitted':
      case 'verification':
        navigate('/profile?verify=1', {
          state: { openVerify: true, requestId: data.request_id || null },
        })
        break
      default:
        if (String(notif.type || '').startsWith('verification')) {
          navigate('/profile?verify=1', { state: { openVerify: true } })
        } else if (notif.link) {
          navigate(notif.link)
        }
        break
    }
  }, [navigate])

  const handleCardClick = useCallback((notif) => {
    if (!notif.read) markOneRead(notif.id)
    navigateByType(notif)
  }, [markOneRead, navigateByType])

  const handleAction = useCallback((action, notif) => {
    const data = notif.data || {}
    switch (action) {
      case 'reply':
        if (!notif.read) markOneRead(notif.id)
        navigateByType(notif)
        break
      case 'call': {
        const phone = data.caller_phone || data.phone
        if (phone) window.location.href = `tel:${phone}`
        else showToast('Call back feature coming soon', 'info')
        break
      }
      case 'share': {
        const url = `${window.location.origin}/listing/${data.listing_id || ''}`
        if (navigator.share) {
          navigator.share({ title: data.listing_title || notif.title, url }).catch(() => {})
        } else {
          navigator.clipboard.writeText(url)
            .then(() => showToast('Link copied to clipboard', 'success'))
            .catch(() => showToast('Unable to share', 'error'))
        }
        break
      }
      case 'edit':
        if (data.listing_id) navigate(`/edit-listing/${data.listing_id}`)
        else showToast('Edit feature coming soon', 'info')
        break
      case 'promote':
        showToast('Promote listing feature coming soon', 'info')
        break
      case 'accept':
        showToast('Offer accepted', 'success')
        break
      case 'counter':
        showToast('Counter offer feature coming soon', 'info')
        break
      case 'decline':
        showToast('Offer declined', 'info')
        break
      case 'confirm':
        showToast('Confirmed', 'success')
        break
      case 'vouch':
        showToast('Vouch sent', 'success')
        break
      case 'thank':
        showToast('Thank you sent', 'success')
        break
      case 'archive':
        showToast('Archived', 'info')
        break
      default:
        showToast('Action coming soon', 'info')
    }
  }, [markOneRead, navigateByType, navigate, showToast])

  // ── Filtering / sorting ──────────────────────────────────────────────────
  const updateFilter = useCallback((updates) => setFilter((prev) => ({ ...prev, ...updates })), [])
  const clearFilters = useCallback(() => setFilter(DEFAULT_FILTER), [])
  const toggleFilters = useCallback(() => setFiltersOpen((p) => !p), [])
  const closeFilters = useCallback(() => setFiltersOpen(false), [])

  const handlePushEnable = useCallback(async () => {
    if (typeof Notification !== 'undefined' && Notification.requestPermission) {
      const permission = await Notification.requestPermission()
      if (permission === 'granted') showToast('Push notifications enabled', 'success')
      else showToast('Push notifications not enabled', 'info')
    } else {
      showToast('Push notifications not supported', 'info')
    }
    setPushBannerVisible(false)
  }, [showToast])

  const handlePushDismiss = useCallback(() => setPushBannerVisible(false), [])

  const unreadCount = useMemo(() => notifications.filter((n) => !n.read).length, [notifications])

  const filteredNotifications = useMemo(() => {
    let list = [...notifications]

    if (filter.category !== 'all') {
      list = list.filter((n) => matchCategory(n, filter.category))
    }
    if (filter.readStatus !== 'all') {
      list = list.filter((n) => filter.readStatus === 'unread' ? !n.read : n.read)
    }
    if (filter.timeRange !== 'all') {
      list = list.filter((n) => filter.timeRange === 'today' ? isToday(n.created_at) : isThisWeek(n.created_at))
    }
    if (filter.search.trim()) {
      const q = filter.search.toLowerCase()
      list = list.filter((n) => {
        const d = n.data || {}
        const sender = senders[getActorId(n)]
        return (
          (n.title && n.title.toLowerCase().includes(q)) ||
          (n.body && n.body.toLowerCase().includes(q)) ||
          (n.message && n.message.toLowerCase().includes(q)) ||
          (d.listing_title && d.listing_title.toLowerCase().includes(q)) ||
          (d.sender_name && d.sender_name.toLowerCase().includes(q)) ||
          (d.caller_name && d.caller_name.toLowerCase().includes(q)) ||
          (d.buyer_name && d.buyer_name.toLowerCase().includes(q)) ||
          (d.seller_name && d.seller_name.toLowerCase().includes(q)) ||
          (sender?.full_name && sender.full_name.toLowerCase().includes(q))
        )
      })
    }

    list.sort((a, b) => {
      const ta = new Date(a.created_at).getTime()
      const tb = new Date(b.created_at).getTime()
      return filter.sort === 'newest' ? tb - ta : ta - tb
    })

    return list
  }, [notifications, filter, senders])

  const grouped = useMemo(() => groupByDate(filteredNotifications), [filteredNotifications])

  return (
    <div className="notifications-page">
      

      <Header
        filter={filter}
        unreadCount={unreadCount}
        notifications={notifications}
        filtersOpen={filtersOpen}
        onSearch={(value) => updateFilter({ search: value })}
        onToggleFilters={toggleFilters}
        onTab={(id) => updateFilter({ category: id })}
        onMarkAllRead={markAllRead}
        onBack={() => navigate(-1)}
      />

      <div className="notif-body-shell">
        <NearbyFeaturedRail />

        {loading ? (
          <main className="container" aria-busy="true">
            <div className="notifications-list">
              {[1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} />)}
            </div>
          </main>
        ) : (
          <main className="container">
            {filtersOpen && (
              <FilterPanel
                filter={filter}
                onChange={updateFilter}
                onClear={clearFilters}
                onClose={closeFilters}
              />
            )}
            {filteredNotifications.length === 0 ? (
              <EmptyState category={filter.category} search={filter.search} />
            ) : (
              <div className="notifications-list" role="list" aria-label="Notifications">
                {Object.entries(grouped).map(([dateLabel, notifs]) => (
                  <section key={dateLabel} className="date-group" aria-label={dateLabel}>
                    <h2 className="date-header">{dateLabel}</h2>
                    {notifs.map((notif, i) => {
                      const cfg = getConfig(notif.type)
                      const sender = senders[getActorId(notif)]
                      const product = resolveProduct(notif, products)
                      return (
                        <NotificationCard
                          key={notif.id}
                          notif={notif}
                          cfg={cfg}
                          sender={sender}
                          sendersLoading={sendersLoading}
                          product={product}
                          productsLoading={productsLoading}
                          index={i}
                          onCardClick={handleCardClick}
                          onDelete={deleteNotification}
                          onMarkRead={markOneRead}
                          onArchive={archiveNotification}
                          onAction={handleAction}
                        />
                      )
                    })}
                  </section>
                ))}
              </div>
            )}
          </main>
        )}

        <RightPromoRail />
      </div>

      {pushBannerVisible && (
        <PushNotificationsBanner onEnable={handlePushEnable} onDismiss={handlePushDismiss} />
      )}

      <BottomNav />
      <div className={`toast ${toast ? `toast-${toast.type} toast-visible` : ''}`} role="status" aria-live="polite" aria-atomic="true">
        {toast && (
          <>
            <span className="toast-icon" aria-hidden="true">
              {toast.type === 'new' ? '🔔' : toast.type === 'success' ? '✓' : toast.type === 'error' ? '⚠' : 'ℹ'}
            </span>
            <span>{toast.message}</span>
          </>
        )}
      </div>
    </div>
  )
}
