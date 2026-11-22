import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftRight,
  Archive,
  Bell,
  Check,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Eye,
  Handshake,
  Heart,
  MessageCircle,
  MessageSquare,
  Package,
  PartyPopper,
  Phone,
  PhoneMissed,
  Search,
  Settings,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  Truck,
  VideoOff,
  AlertTriangle,
  X,
  MailOpen,
  Undo2,
  Clock,
  Timer,
  PenLine,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import DealEducationModal from '../components/DealEducationModal'
import {
  MIN_DEAL_MESSAGES,
  sendDealFromNotification,
  confirmDealFromNotification,
  declineDealFromNotification,
  markNotificationHandled,
} from '../utils/dealNotificationFlow'
import '../styles/notifications.css'

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

const EMOJI_RE = /(?:\p{Extended_Pictographic}|\p{Regional_Indicator}|\p{Emoji_Modifier}|\uFE0F|\u200D|\u20E3|[#*]\uFE0F?\u20E3)+[\t ]*/gu

function stripEmojis(value) {
  if (value == null) return ''
  return String(value).replace(EMOJI_RE, '').trim()
}

function toTitleCaseName(value) {
  const text = stripEmojis(value)
  if (!text) return ''
  return text.replace(/\p{L}[\p{L}'’-]*/gu, (word) => {
    const rest = word.slice(1)
    return word.charAt(0).toUpperCase() + (rest === rest.toUpperCase() ? rest.toLowerCase() : rest)
  })
}

function resolveViewName(notif, sender) {
  const d = notif.data || {}
  const candidates = [
    d.viewer_name,
    d.viewer_full_name,
    d.actor_name,
    d.sender_name,
    d.viewer?.full_name,
    d.viewer?.name,
  ]

  const viewerId = d.viewer_id || d.actor_id || d.sender_id
  if (viewerId && getActorId(notif) === viewerId) {
    candidates.push(sender?.full_name, sender?.name)
  }

  const sourceText = stripEmojis(notif.body || notif.message || d.message || d.preview || notif.title || '')
  const match = sourceText.match(/^(.+?)\s+viewed(?:\s|$)/i)
  if (match) candidates.push(match[1].replace(/^["'“”]+|["'“”]+$/g, ''))

  return candidates
    .map(toTitleCaseName)
    .find((name) => name && name !== 'Someone') || 'Someone'
}

function formatMwkPrice(value) {
  if (value == null || value === '') return ''
  const digits = String(value).replace(/[^\d.-]/g, '')
  const amount = Number(digits)
  if (!Number.isFinite(amount) || amount <= 0) return ''
  return `MWK ${Math.round(amount).toLocaleString('en-US')}`
}

function formatDealAmount(data) {
  const amount = Number(data?.amount || 0)
  if (!Number.isFinite(amount) || amount <= 0) return ''
  return `${data.currency || 'MWK'} ${amount.toLocaleString('en-US')}`
}

function dedupeBody(title, body, name, listingTitle) {
  let text = stripEmojis(body)
  const cleanTitle = stripEmojis(title)
  const cleanName = stripEmojis(name)
  const cleanListing = stripEmojis(listingTitle)

  if (!text) return ''

  if (cleanTitle && text.toLowerCase().startsWith(cleanTitle.toLowerCase())) {
    const rest = text.slice(cleanTitle.length).replace(/^[\s,:;.\-–—]+/, '')
    if (rest) text = rest
  }

  if (cleanName && text.toLowerCase().startsWith(cleanName.toLowerCase())) {
    const rest = text.slice(cleanName.length).replace(/^[\s,:;.\-–—]+/, '')
    if (rest) text = rest
  }

  if (cleanListing && text.toLowerCase().startsWith(cleanListing.toLowerCase())) {
    const rest = text.slice(cleanListing.length).replace(/^\s*(?:for|on|about)?\s*[,\s\-–—:.]*/, '')
    if (rest) text = rest
  }

  return text
}

const DEAL_NOTIF_TYPES = new Set([
  'deal_ready',
  'deal_request',
  'deal_confirmed',
  'deal_declined',
  'deal_vouching',
  'new_vouch',
  'offer_accepted',
])

function isDealNotification(notif) {
  return !!notif && DEAL_NOTIF_TYPES.has(notif.type)
}

function getDealPresentation(notif, sender, product) {
  const data = notif.data || {}
  const listingTitle = product?.title || data.listing_title || 'your listing'
  const actorName = toTitleCaseName(getActorName(notif, sender))
  const buyerName = toTitleCaseName(data.buyer_name) || actorName || 'the buyer'
  const sellerName = toTitleCaseName(data.seller_name) || actorName || 'the seller'
  const voucherName = toTitleCaseName(data.voucher_name) || actorName || 'someone'
  const status = String(data.status || '').toLowerCase()

  switch (notif.type) {
    case 'deal_ready':
      return {
        title: 'Ready to confirm this deal',
        body: `You and ${buyerName} talked it through. Confirm to make it final.`,
        detail: `Deal confirmation is only for sales that really happened. You send the request, then ${buyerName} confirms it.`,
        requiresAction: true,
        steps: ['Agree the sale is complete', 'Send the confirmation request', `${buyerName} confirms`],
        activeStep: 2,
        tone: 'action',
      }
    case 'deal_request':
      return {
        title: 'Confirm this deal',
        body: `${sellerName} sent you a deal request. Tap to see how it works.`,
        detail: `Only confirm if you received the item as agreed. Your confirmation helps ${sellerName} build trust.`,
        requiresAction: status !== 'declined' && status !== 'expired' && status !== 'disputed',
        steps: ['Seller sent a request', 'You confirm the sale', 'You can both vouch'],
        activeStep: status ? 3 : 2,
        tone: status === 'declined' || status === 'expired' || status === 'disputed' ? 'danger' : 'action',
      }
    case 'deal_confirmed':
      return {
        title: 'Deal confirmed',
        body: `You and ${buyerName} confirmed the sale. Thanks for trading safely.`,
        detail: 'The deal is complete. You can vouch for each other on profile pages.',
        requiresAction: false,
        steps: ['Request sent', 'Both parties confirmed', 'Vouch for each other'],
        activeStep: 3,
        tone: 'done',
      }
    case 'deal_declined':
      return {
        title: 'Deal not confirmed',
        body: 'The deal confirmation was declined. No action is needed.',
        detail: 'No action is needed. The seller can start a new request if needed.',
        requiresAction: false,
        steps: ['Request sent', 'Confirmation declined', 'No action needed'],
        activeStep: 2,
        tone: 'danger',
      }
    case 'offer_accepted': {
      const amountText = formatDealAmount(data)
      return {
        title: 'Offer accepted',
        body: `${actorName} accepted your offer${amountText ? ` of ${amountText}` : ''} for ${listingTitle}. Confirm to start the deal.`,
        detail: `Once you confirm, you and ${actorName} can vouch for each other.`,
        requiresAction: true,
        steps: ['Offer accepted', 'Confirm the sale', 'Vouch for each other'],
        activeStep: 2,
        tone: 'action',
      }
    }
    case 'deal_vouching':
      return {
        title: 'Vouch for the seller',
        body: `Your deal with ${sellerName} is confirmed. Leave a vouch when you're ready.`,
        detail: `If ${sellerName} delivered as agreed, leave an honest vouch on their profile.`,
        requiresAction: false,
        steps: ['Deal confirmed', 'Open the seller profile', 'Leave an honest vouch'],
        activeStep: 2,
        tone: 'amber',
      }
    case 'new_vouch':
      return {
        title: 'You received a vouch',
        body: `${voucherName} vouched for you. Your reputation just grew.`,
        detail: 'A vouch helps people trust your shop. Keep trading well to grow your reputation.',
        requiresAction: false,
        steps: ['Someone bought from you', 'They left a vouch', 'Your reputation grows'],
        activeStep: 3,
        tone: 'done',
      }
    default:
      return null
  }
}

// ── Notification type config (premium Lucide icons) ───────────────────────
/* Colors aligned with Home brand tokens (green #0F9D58 + gold #F9AB00) */
const NOTIF_CONFIG = {
  new_message:      { Icon: MessageCircle,  color: '#1A73E8', bg: '#e8f0fe', label: 'Message',         category: 'messages' },
  missed_call:      { Icon: PhoneMissed,    color: '#ea4335', bg: '#fce8e6', label: 'Missed Call',     category: 'calls' },
  missed_video:     { Icon: VideoOff,       color: '#ea4335', bg: '#fce8e6', label: 'Missed Video',    category: 'calls' },
  listing_offer:    { Icon: CircleDollarSign, color: '#F9AB00', bg: '#fff8e1', label: 'Offer',         category: 'offers' },
  offer_new:        { Icon: CircleDollarSign, color: '#0F9D58', bg: '#e8f5ee', label: 'New Offer',     category: 'offers' },
  offer_counter:    { Icon: ArrowLeftRight,   color: '#1A73E8', bg: '#e8f0fe', label: 'Counter Offer', category: 'offers' },
  offer_accepted:   { Icon: CheckCircle2,     color: '#0F9D58', bg: '#e8f5ee', label: 'Offer Accepted', category: 'offers' },
offer_declined:   { Icon: X,                color: '#ea4335', bg: '#fce8e6', label: 'Offer Declined', category: 'offers' },
  offer_withdrawn:  { Icon: Undo2,            color: '#80868b', bg: '#f8f9fa', label: 'Offer Withdrawn', category: 'offers' },
  offer_edited:     { Icon: PenLine,          color: '#1A73E8', bg: '#e8f0fe', label: 'Offer Updated',   category: 'offers' },
  offer_expired:    { Icon: Timer,            color: '#ea4335', bg: '#fce8e6', label: 'Offer Expired', category: 'offers' },
  offer_expiring:   { Icon: Clock,            color: '#F9AB00', bg: '#fff8e1', label: 'Offer Expiring', category: 'offers' },
  listing_view:     { Icon: Eye,            color: '#7c5cff', bg: '#efeaff', label: 'View',            category: 'listings' },
  listing_comment:  { Icon: MessageSquare,  color: '#1A73E8', bg: '#e8f0fe', label: 'Comment',         category: 'listings' },
  listing_sold:     { Icon: PartyPopper,    color: '#0F9D58', bg: '#e8f5ee', label: 'Sold',            category: 'listings' },
  listing_liked:    { Icon: Heart,          color: '#ea4335', bg: '#fce8e6', label: 'Liked',           category: 'listings' },
  deal_ready:       { Icon: Handshake,      color: '#0F9D58', bg: '#e8f5ee', label: 'Confirm Deal',    category: 'deals' },
  deal_request:     { Icon: Handshake,      color: '#0F9D58', bg: '#e8f5ee', label: 'Deal Request',    category: 'deals' },
  deal_confirmed:   { Icon: PartyPopper,    color: '#0a7a44', bg: '#e8f5ee', label: 'Deal Confirmed',  category: 'deals' },
  deal_declined:    { Icon: X,              color: '#ea4335', bg: '#fce8e6', label: 'Deal Declined',   category: 'deals' },
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

const NO_SENDER_AVATAR_COLORS = {
  listings: { color: '#7c4dff', bg: '#f1ecff' },
  offers: { color: '#F9AB00', bg: '#fff7e0' },
  deals: { color: '#1A73E8', bg: '#e8f0fe' },
  orders: { color: '#0F9D58', bg: '#e6f6ed' },
  system: { color: '#80868b', bg: '#f1f3f4' },
}

const OFFER_NOTIF_TYPES = new Set([
  'offer_new',
  'offer_counter',
  'offer_accepted',
  'offer_declined',
  'offer_withdrawn',
  'offer_edited',
  'offer_expired',
  'offer_expiring',
])

const TABS = [
  { id: 'all',      label: 'All',      Icon: Bell },
  { id: 'messages', label: 'Messages', Icon: MessageCircle },
  { id: 'listings', label: 'Listings', Icon: ShoppingBag },
  { id: 'offers',   label: 'Offers',   Icon: CircleDollarSign },
  { id: 'deals',    label: 'Deals',    Icon: Handshake },
]

const CATEGORIES = [
  { id: 'all',      label: 'All' },
  { id: 'messages', label: 'Messages' },
  { id: 'listings', label: 'Listings' },
  { id: 'offers',   label: 'Offers' },
  { id: 'deals',    label: 'Deals' },
]

const VALID_CATEGORY_IDS = new Set(TABS.map((tab) => tab.id))

function normalizeCategory(category) {
  const id = typeof category === 'string' ? category.toLowerCase() : ''
  return VALID_CATEGORY_IDS.has(id) ? id : 'all'
}

function getInitialCategory() {
  if (typeof window === 'undefined') return 'all'
  try {
    const params = new URLSearchParams(window.location.search)
    const routeState = window.history.state?.usr || {}
    const saved = params.get('tab')
      || params.get('category')
      || routeState.tab
      || routeState.category
      || localStorage.getItem('soko_notifications_tab')
      || localStorage.getItem('soko_notifications_category')
      || sessionStorage.getItem('soko_notifications_tab')
      || sessionStorage.getItem('soko_notifications_category')
    return normalizeCategory(saved)
  } catch {
    return 'all'
  }
}

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
  // Prefer the *other* party for deal notifications (avatar / name)
  if (notif.type === 'deal_ready') return d.buyer_id || d.other_user_id || null
  if (notif.type === 'deal_request') return d.seller_id || null
  if (notif.type === 'deal_confirmed' || notif.type === 'deal_declined') return d.buyer_id || null
  if (notif.type === 'deal_vouching') return d.seller_id || null
  // Offer notifications come from offerNotifications.js — the deep-link target
  if (OFFER_NOTIF_TYPES.has(notif.type)) return d.actor_id || d.other_user_id || d.sender_id || null
  return d.sender_id || d.caller_id || d.seller_id || d.buyer_id || d.user_id || null
}

function getActorName(notif, sender) {
  const d = notif.data || {}
  if (OFFER_NOTIF_TYPES.has(notif.type)) {
    return sender?.full_name || d.actor_name || d.other_user_name || d.sender_name || 'Someone'
  }
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

function firstViewImage(value) {
  if (!value) return null
  if (Array.isArray(value)) {
    for (const item of value) {
      const image = firstViewImage(item)
      if (image) return image
    }
    return null
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
      try { return firstViewImage(JSON.parse(trimmed)) } catch { return trimmed }
    }
    return trimmed
  }
  if (typeof value === 'object') {
    return firstViewImage(value[0] || value.url || value.src || value.image || value.path)
  }
  return null
}

function getViewListingId(notif) {
  const d = notif.data || {}
  return d.listing_id || (d.context_type === 'listing' ? d.context_id : null)
}

function resolveViewImage(notif, viewImages) {
  const d = notif.data || {}
  const payloadImage = firstViewImage(d.listing_image || d.image)
  if (payloadImage) return payloadImage
  const id = getViewListingId(notif)
  return id ? viewImages[String(id)] || null : null
}

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function calendarDayAge(date) {
  const d = new Date(date)
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const item = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  return Math.round((today - item) / 86400000)
}

function timeLabel(date) {
  const d = new Date(date)
  const age = calendarDayAge(date)
  if (age <= 0) {
    const hours = String(d.getHours()).padStart(2, '0')
    const minutes = String(d.getMinutes()).padStart(2, '0')
    return `${hours}:${minutes}`
  }
  if (age === 1) return 'Yesterday'
  if (age < 7) return d.toLocaleDateString([], { weekday: 'long' })
  return `${d.getDate()} ${SHORT_MONTHS[d.getMonth()]}`
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
  if (category === 'offers')   return notif.type === 'listing_offer' || OFFER_NOTIF_TYPES.has(notif.type)
  if (category === 'deals')    return notif.type.startsWith('deal_') || notif.type === 'new_vouch'
  if (category === 'orders')   return notif.type.startsWith('order_')
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

function mergeMessageNotifications(notifs, senders) {
  const merged = []

  for (const notif of notifs) {
    if (notif.type !== 'new_message') {
      merged.push(notif)
      continue
    }

    const actorId = getActorId(notif)
    const senderKey = String(actorId || getActorName(notif, senders[actorId]) || 'unknown')
    const previous = merged[merged.length - 1]

    if (!previous || previous.type !== 'new_message' || previous.__senderKey !== senderKey) {
      merged.push({ ...notif, __senderKey: senderKey, __members: [notif] })
      continue
    }

    const members = [...previous.__members, notif]
    const previousTime = new Date(previous.created_at).getTime()
    const currentTime = new Date(notif.created_at).getTime()
    const latest = currentTime >= previousTime ? notif : previous

    merged[merged.length - 1] = {
      ...latest,
      __senderKey: senderKey,
      __members: members,
      read: members.every((member) => member.read),
    }
  }

  return merged.map((entry) => {
    const members = entry.__members
    const notif = { ...entry }
    delete notif.__senderKey
    delete notif.__members
    if (!members || members.length === 1) return notif
    return {
      ...notif,
      mergedIds: members.map((member) => member.id),
      mergedCount: members.length,
      mergedUnreadCount: members.filter((member) => !member.read).length,
    }
  })
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
      return `"${data.listing_title || 'Your listing'}" has been marked as sold!`
    case 'deal_ready':
      return `You've chatted with ${data.buyer_name || 'a buyer'} about "${data.listing_title || 'a listing'}". Confirm the deal here if the sale happened.`
    case 'deal_request':
      return `${data.seller_name || 'Seller'} wants to confirm the deal for "${data.listing_title || 'a listing'}"`
    case 'deal_confirmed':
      return `${data.buyer_name || 'Buyer'} confirmed the deal for "${data.listing_title || 'a listing'}"`
    case 'deal_declined':
      return `${data.buyer_name || 'Buyer'} declined the deal confirmation for "${data.listing_title || 'a listing'}"`
    case 'deal_vouching':
      return `Don't forget to vouch for ${data.seller_name || 'the seller'} — your vouch grows their reputation`
    case 'new_vouch':
      return `${name} vouched for you`
    case 'offer_new':
      return `${name} offered ${data.amount ? formatDealAmount(data) : ''}${data.listing_title ? ` for "${data.listing_title}"` : ''}`
    case 'offer_counter':
      return `${name} sent a counter offer of ${data.amount ? formatDealAmount(data) : ''}${data.listing_title ? ` for "${data.listing_title}"` : ''}`
    case 'offer_accepted':
      return `${name} accepted your offer of ${data.amount ? formatDealAmount(data) : ''}${data.listing_title ? ` for "${data.listing_title}"` : ''}`
    case 'offer_declined':
      return `${name} declined your offer of ${data.amount ? formatDealAmount(data) : ''}${data.listing_title ? ` for "${data.listing_title}"` : ''}`
      case 'offer_withdrawn':
        return `${name} withdrew their offer of ${data.amount ? formatDealAmount(data) : ''}${data.listing_title ? ` for "${data.listing_title}"` : ''}`
    case 'offer_edited':
      return `${name} updated their offer to ${data.amount ? formatDealAmount(data) : ''}${data.listing_title ? ` for "${data.listing_title}"` : ''}`
    case 'offer_expired':
      return data.is_offerer
        ? `Your offer of ${data.amount ? formatDealAmount(data) : ''}${data.listing_title ? ` for "${data.listing_title}"` : ''} has expired`
        : `The offer of ${data.amount ? formatDealAmount(data) : ''}${data.listing_title ? ` for "${data.listing_title}"` : ''} has expired`
    case 'offer_expiring': {
      const horizon = (data.reminder_window_hours || 0) > 24 ? '1 day' : '1 hour'
      return data.is_offerer
        ? `Your offer of ${data.amount ? formatDealAmount(data) : ''} expires in ${horizon}`
        : `The offer of ${data.amount ? formatDealAmount(data) : ''} expires in ${horizon}`
    }
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
            .select('id, name, media_urls, rate, city')
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

const VIEW_LISTING_IMAGE_CACHE = new Map()

function loadViewListingImages(ids) {
  const unique = [...new Set(ids.map(String))]
  const missing = unique.filter((id) => !VIEW_LISTING_IMAGE_CACHE.has(id))

  if (missing.length) {
    const request = supabase
      .from('listings')
      .select('id, images')
      .in('id', missing)
      .then(({ data }) => {
        const byId = {}
        for (const row of data || []) byId[String(row.id)] = firstViewImage(row.images)
        return byId
      })
      .catch(() => ({}))

    for (const id of missing) {
      VIEW_LISTING_IMAGE_CACHE.set(id, request.then((byId) => byId[id] || null))
    }
  }

  return Promise.all(unique.map((id) => VIEW_LISTING_IMAGE_CACHE.get(id) || Promise.resolve(null)))
}

function useViewListingImages(notifications) {
  const [images, setImages] = useState({})

  const viewIds = useMemo(() => {
    const ids = new Set()
    for (const notif of notifications) {
      if (notif.type !== 'listing_view') continue
      const d = notif.data || {}
      if (firstViewImage(d.listing_image || d.image)) continue
      const id = getViewListingId(notif)
      if (id) ids.add(String(id))
    }
    return Array.from(ids)
  }, [notifications])

  useEffect(() => {
    let cancelled = false
    if (!viewIds.length) return
    loadViewListingImages(viewIds).then((values) => {
      if (cancelled) return
      const map = {}
      viewIds.forEach((id, index) => { if (values[index]) map[id] = values[index] })
      setImages(map)
    })
    return () => { cancelled = true }
  }, [viewIds])

  return viewIds.length ? images : {}
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

const EMPTY_COPY = {
  all:      { title: 'No notifications yet', sub: "You're all caught up! New activity will appear here.", Icon: Bell, color: '#0F9D58', bg: '#e8f5ee' },
  messages: { title: 'No messages yet', sub: 'When someone messages you, it will appear here.', Icon: MessageCircle, color: '#1A73E8', bg: '#e8f0fe' },
  calls:    { title: 'No missed calls', sub: 'Missed calls and video calls will appear here.', Icon: PhoneMissed, color: '#ea4335', bg: '#fce8e6' },
  listings: { title: 'No listing activity', sub: 'Views, comments, likes and sales on your listings will appear here.', Icon: ShoppingBag, color: '#0F9D58', bg: '#e8f5ee' },
  offers:   { title: 'No offers yet', sub: 'Offers from buyers will appear here.', Icon: CircleDollarSign, color: '#F9AB00', bg: '#fff8e1' },
  deals:    { title: 'No deal updates', sub: 'Deal requests and confirmations will appear here.', Icon: Handshake, color: '#0F9D58', bg: '#e8f5ee' },
  orders:   { title: 'No orders yet', sub: 'Orders and shipping updates will appear here.', Icon: Package, color: '#1A73E8', bg: '#e8f0fe' },
  system:   { title: 'No system alerts', sub: 'System notifications and warnings will appear here.', Icon: Settings, color: '#80868b', bg: '#f8f9fa' },
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

function AvatarIcon({ notif, name: displayName, hasActor, cfg, sender, loading, viewImage, showTypeBadge = true }) {
  const [failedAvatar, setFailedAvatar] = useState(null)
  const [failedViewImage, setFailedViewImage] = useState(null)
  const actorId = getActorId(notif)
  const TypeIcon = cfg.Icon || Bell
  const name = stripEmojis(displayName || sender?.full_name || getActorName(notif, sender) || 'User') || 'User'
  const initial = name.trim()[0]?.toUpperCase() || 'U'
  const avatarUrl = sender?.avatar_url
  const showImage = !!hasActor && !!avatarUrl && failedAvatar !== avatarUrl
  const showViewImage = notif.type === 'listing_view' && !!viewImage && failedViewImage !== viewImage
  const typeColor = NO_SENDER_AVATAR_COLORS[cfg.category] || { color: cfg.color, bg: cfg.bg }

  if (loading && actorId) {
    return <div className="avatar-skeleton" aria-hidden="true" />
  }

  if (showViewImage) {
    return (
      <div className="avatar-wrap view-photo-wrap" aria-hidden="true">
        <img className="avatar view-photo" src={viewImage} alt="" loading="lazy" onError={() => setFailedViewImage(viewImage)} />
        {showTypeBadge && (
          <span className="icon-badge" style={{ backgroundColor: '#f1ecff', color: '#7c4dff' }}>
            <Ic icon={TypeIcon} size={14} strokeWidth={2.25} />
          </span>
        )}
      </div>
    )
  }

  if (showImage) {
    return (
      <div className="avatar-wrap" aria-hidden="true">
        <img className="avatar" src={avatarUrl} alt="" loading="lazy" onError={() => setFailedAvatar(avatarUrl)} />
        {showTypeBadge && (
          <span className="icon-badge" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
            <Ic icon={TypeIcon} size={14} strokeWidth={2.25} />
          </span>
        )}
      </div>
    )
  }

  if (!showImage && hasActor) {
    return (
      <div className="avatar-wrap" aria-hidden="true">
        <span
          className="avatar avatar-initial"
          style={{ backgroundColor: '#e6f6ed', color: '#0F9D58' }}
        >
          {initial}
        </span>
        {showTypeBadge && (
          <span className="icon-badge" style={{ backgroundColor: cfg.bg, color: cfg.color }}>
            <Ic icon={TypeIcon} size={14} strokeWidth={2.25} />
          </span>
        )}
      </div>
    )
  }

  return (
    <div className="icon-fallback" style={{ backgroundColor: typeColor.bg, color: typeColor.color }} aria-hidden="true">
      <Ic icon={TypeIcon} size={18} strokeWidth={1.75} />
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
      case 'deal_ready': {
        // Seller: start deal confirmation from Notifications
        if (notif.data?.handled) return []
        return [
          { id: 'send_deal', label: 'Confirm deal', Icon: Handshake, variant: 'primary', onClick: handler('send_deal') },
          { id: 'dismiss', label: 'Later', Icon: X, variant: 'secondary', onClick: handler('dismiss') },
        ]
      }
      case 'deal_request': {
        if (notif.data?.handled) return []
        return [
          { id: 'confirm', label: 'Confirm deal', Icon: Check, variant: 'primary', onClick: handler('confirm') },
          { id: 'decline', label: 'Decline', Icon: X, variant: 'danger', onClick: handler('decline') },
        ]
      }
      case 'deal_confirmed':
      case 'deal_vouching':
        return [
          { id: 'vouch', label: 'Vouch', Icon: Star, variant: 'primary', onClick: handler('vouch') },
        ]
      case 'new_vouch':
        return [
          { id: 'thank', label: 'View profile', Icon: Star, variant: 'primary', onClick: handler('thank') },
        ]
      case 'deal_declined':
        return []
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
  viewImage,
  index,
  onCardClick,
  onDelete,
  onMarkRead,
  onArchive,
  onAction,
  isExpanded,
  onToggleExpand,
}) {
  const expanded = isExpanded
  const onClickCard = useCallback(() => onCardClick(notif), [onCardClick, notif])
  const readIds = useMemo(
    () => (notif.mergedIds?.length ? notif.mergedIds : [notif.id]),
    [notif.id, notif.mergedIds],
  )
  const handleMarkRead = useCallback(() => {
    readIds.forEach((id) => onMarkRead(id))
  }, [onMarkRead, readIds])

  const actorName = getActorName(notif, sender)
  const hasActor = !!(actorName && actorName !== 'Someone')
  const displayName = toTitleCaseName(hasActor ? actorName : (notif.title || cfg.label || 'Someone')) || 'Someone'
  const dealPresentation = isDealNotification(notif) ? getDealPresentation(notif, sender, product) : null
  const displayTitle = dealPresentation?.title || (notif.type === 'listing_view'
    ? `${resolveViewName(notif, sender)} viewed your listing`
    : displayName)
  const isVerified = !!(sender?.is_verified)
  const listingTitle = product?.title || notif.data?.listing_title || notif.data?.service_name || ''
  const priceText = formatMwkPrice(product?.price ?? notif.data?.listing_price ?? notif.data?.price)

  let purposeText = dealPresentation?.body || dedupeBody(notif.title, getNotificationPurpose(notif, sender), displayName, listingTitle)
  if (notif.type === 'listing_view') {
    purposeText = [listingTitle, priceText].filter(Boolean).join(' · ')
  }
  const earlierCount = notif.mergedCount > 1 ? notif.mergedCount - 1 : 0
  const mergedUnreadCount = notif.mergedUnreadCount ?? (notif.read ? 0 : 1)
  const purpose = earlierCount > 0 ? `${purposeText} · +${earlierCount} earlier` : purposeText
  const badgeText = dealPresentation?.requiresAction ? 'Action needed' : null

  const ariaLabel = [
    displayTitle,
    purpose,
    badgeText,
    isVerified ? 'verified' : null,
    notif.read ? 'read' : 'unread',
  ].filter(Boolean).join(', ')

  return (
    <SwipeActions
      onClick={onClickCard}
      onDelete={() => onDelete(notif.id)}
      onMarkRead={handleMarkRead}
      onArchive={() => onArchive(notif.id)}
      ariaLabel={ariaLabel}
      index={index}
    >
      <div className="notif-card-animator">
        <article
          className={[
            'notif-card',
            notif.read ? 'is-read' : 'is-unread',
            dealPresentation ? `is-deal tone-${dealPresentation.tone}` : '',
            expanded ? 'is-expanded' : '',
          ].filter(Boolean).join(' ')}
          style={{ '--notif-accent': cfg.color }}
        >
          <div className="notif-layout">
            <div className="notif-avatar">
              <AvatarIcon
                notif={notif}
                name={displayName}
                hasActor={hasActor}
                cfg={cfg}
                sender={sender}
                loading={sendersLoading}
                viewImage={viewImage}
              />
            </div>

            <div className="notif-text">
              <span className={`notif-title${notif.read ? '' : ' is-unread-title'}`}>
                {displayTitle}
              </span>
              <p className={`notif-body${notif.read ? '' : ' is-unread-body'}`}>
                {purposeText}
                {earlierCount > 0 && <span className="notif-purpose-older"> · +{earlierCount} earlier</span>}
              </p>

              {badgeText && (
                <span className="notif-deal-badge tone-action">
                  {badgeText}
                </span>
              )}

              {dealPresentation && expanded && (
                <div className="notif-deal-details" onClick={(e) => e.stopPropagation()}>
                  <div className="notif-deal-detail-head">
                    <span className="notif-deal-detail-label">How this works</span>
                  </div>
                  <p className="notif-deal-detail-copy">{dealPresentation.detail}</p>
                  <ol className="notif-deal-steps">
                    {dealPresentation.steps.map((step, stepIndex) => {
                      const stepNumber = stepIndex + 1
                      return (
                        <li
                          key={step}
                          className={[
                            'notif-deal-step',
                            stepNumber === dealPresentation.activeStep ? 'is-active' : '',
                            stepNumber < dealPresentation.activeStep ? 'is-done' : '',
                          ].filter(Boolean).join(' ')}
                        >
                          <span className="notif-deal-step-num">{stepNumber}</span>
                          <span>{step}</span>
                        </li>
                      )
                    })}
                  </ol>
                </div>
              )}
            </div>

            <div className="notif-row-end">
              <div className="notif-time-row">
                <time className="notif-time" dateTime={notif.created_at}>
                  {timeLabel(notif.created_at)}
                </time>
                {!notif.read && (
                  <span className="unread-dot" style={{ backgroundColor: cfg.color }} aria-hidden="true" />
                )}
              </div>
              {notif.mergedCount > 1 && mergedUnreadCount > 0 && (
                <span className="message-count-pill" aria-label={`${mergedUnreadCount} unread`}>
                  {mergedUnreadCount}
                </span>
              )}
              {dealPresentation && (
                <button
                  type="button"
                  className="notif-deal-toggle"
                  aria-expanded={expanded}
                  aria-label={expanded ? 'Hide deal steps' : 'Show deal steps'}
                  onClick={(e) => { e.stopPropagation(); onToggleExpand(notif.id) }}
                >
                  <Ic icon={ChevronDown} size={16} strokeWidth={2} />
                </button>
              )}
            </div>

            <div className="notif-side" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
                className="notif-dismiss"
                aria-label="Dismiss notification"
                onClick={() => onDelete(notif.id)}
              >
                <Ic icon={X} size={14} strokeWidth={2.25} />
              </button>
            </div>
          </div>

          <NotificationActions notif={notif} onAction={onAction} />
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
            <p className="header-sub">{unreadCount} unread</p>
          </div>
        </div>
        <div className="header-actions">
          <button
            className="mark-all-btn"
            onClick={onMarkAllRead}
            disabled={unreadCount === 0}
            aria-label="Mark all notifications as read"
          >
            <Ic icon={Check} size={13} strokeWidth={2.25} />
            <span>Mark all read</span>
          </button>
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

// ── Main component ─────────────────────────────────────────────────────────
export default function Notifications() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState(() => ({ ...DEFAULT_FILTER, category: getInitialCategory() }))
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [expandedNotificationId, setExpandedNotificationId] = useState(null)
  const [toast, setToast] = useState(null)
  const [user, setUser] = useState(null)
  const [pushBannerVisible, setPushBannerVisible] = useState(() => typeof Notification !== 'undefined' ? Notification.permission === 'default' : true)
  /** Seller deal education modal (opened from deal_ready action) */
  const [dealModal, setDealModal] = useState(null) // { notif, listing, buyerProfile, sending, error }
  const [actionBusy, setActionBusy] = useState(null) // `${notifId}:${action}`
  const { senders, loading: sendersLoading } = useSenderProfiles(notifications)
  const { products } = useProductContext(notifications)
  const viewImages = useViewListingImages(notifications)

  // ── Toast ────────────────────────────────────────────────────────────────
  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type, id: Date.now() })
  }, [])

  const toggleExpanded = useCallback((id) => {
    setExpandedNotificationId((current) => (current === id ? null : id))
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
    void id
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
      case 'offer_new':
      case 'offer_counter':
      case 'offer_accepted':
      case 'offer_declined':
      case 'offer_withdrawn':
      case 'offer_edited':
      case 'offer_expired':
      case 'offer_expiring':
        // Deep-link into the negotiation chat, scroll to the offer message
        if (data.actor_id && data.context_id) {
          navigate(`/chat/${data.actor_id}/${data.context_id}`, {
            state: { source: 'listing', scrollToMessageId: data.message_id },
          })
        } else if (data.actor_id) {
          navigate(`/chat/${data.actor_id}`, {
            state: { source: 'listing', scrollToMessageId: data.message_id },
          })
        } else if (data.listing_id) {
          navigate(`/listing/${data.listing_id}`)
        }
        break
      // Deal flow stays in Notifications — do not open chat for deal actions
      case 'deal_ready':
      case 'deal_request':
      case 'deal_confirmed':
      case 'deal_declined':
        if (data.listing_id) navigate(`/listing/${data.listing_id}`)
        break
      case 'deal_vouching':
        if (data.seller_id) navigate(`/profile/${data.seller_id}?vouch=1`)
        break
      case 'order_placed':
      case 'order_shipped':
      case 'order_delivered':
      case 'order_cancelled':
        if (data.listing_id) navigate(`/listing/${data.listing_id}`)
        else if (data.seller_id) navigate(`/profile/${data.seller_id}`)
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
        } else if (data.service_id) {
          navigate(`/services/${data.service_id}`)
        } else if (notif.link) {
          navigate(notif.link)
        }
        break
    }
  }, [navigate])

  const handleCardClick = useCallback((notif) => {
    if (!notif.read) {
      const ids = notif.mergedIds?.length ? notif.mergedIds : [notif.id]
      ids.forEach((id) => markOneRead(id))
    }
    navigateByType(notif)
  }, [markOneRead, navigateByType])

  const patchNotifData = useCallback((id, dataPatch) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, read: true, data: { ...(n.data || {}), ...dataPatch } }
          : n
      )
    )
  }, [])

  const handleAction = useCallback(async (action, notif) => {
    const data = notif.data || {}
    const busyKey = `${notif.id}:${action}`
    if (actionBusy === busyKey) return

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

      // ── Deal flow (100% in Notifications) ──────────────────────────────
      case 'send_deal': {
        // Seller opens education modal then sends deal_request to buyer
        if (!user?.id || !data.listing_id || !data.buyer_id) {
          showToast('Missing deal details', 'error')
          break
        }
        setActionBusy(busyKey)
        try {
          let listing = products[data.listing_id]
            ? {
                id: data.listing_id,
                title: products[data.listing_id].title || data.listing_title,
                price: products[data.listing_id].price ?? data.listing_price,
                images: products[data.listing_id].image
                  ? [products[data.listing_id].image]
                  : [],
                seller_id: user.id,
              }
            : null
          if (!listing) {
            const { data: row } = await supabase
              .from('listings')
              .select('id, title, price, images, seller_id')
              .eq('id', data.listing_id)
              .maybeSingle()
            listing = row || {
              id: data.listing_id,
              title: data.listing_title,
              price: data.listing_price,
              images: [],
              seller_id: user.id,
            }
          }
          const buyerProfile = senders[data.buyer_id] || {
            id: data.buyer_id,
            full_name: data.buyer_name || 'Buyer',
          }
          setDealModal({
            notif,
            listing,
            buyerProfile: { id: data.buyer_id, ...buyerProfile },
            sending: false,
            error: '',
          })
        } finally {
          setActionBusy(null)
        }
        break
      }

      case 'confirm': {
        // Buyer confirms deal_request
        if (notif.type === 'deal_request') {
          if (!user?.id || !data.deal_id) {
            showToast('Missing deal details', 'error')
            break
          }
          setActionBusy(busyKey)
          try {
            const { data: myProf } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', user.id)
              .maybeSingle()
            const { deal, error } = await confirmDealFromNotification({
              dealId: data.deal_id,
              buyerId: user.id,
              buyerName: myProf?.full_name,
              listingTitle: data.listing_title,
              sellerId: data.seller_id,
              listingId: data.listing_id,
            })
            if (error) {
              showToast(error.message || 'Could not confirm deal', 'error')
            } else {
              await markNotificationHandled(notif.id, { handled: true, status: deal?.status })
              patchNotifData(notif.id, { handled: true, status: deal?.status })
              showToast(
                deal?.status === 'confirmed'
                  ? 'Deal confirmed! You can vouch for the seller.'
                  : 'Confirmation recorded',
                'success'
              )
            }
          } finally {
            setActionBusy(null)
          }
          break
        }
        break
      }

      case 'decline': {
        if (notif.type === 'deal_request') {
          if (!user?.id || !data.deal_id) {
            showToast('Missing deal details', 'error')
            break
          }
          if (!window.confirm('Decline this deal confirmation?')) break
          setActionBusy(busyKey)
          try {
            const { data: myProf } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', user.id)
              .maybeSingle()
            const { error } = await declineDealFromNotification({
              dealId: data.deal_id,
              buyerId: user.id,
              buyerName: myProf?.full_name,
              listingTitle: data.listing_title,
              sellerId: data.seller_id,
            })
            if (error) {
              showToast(error.message || 'Could not decline deal', 'error')
            } else {
              await markNotificationHandled(notif.id, { handled: true, status: 'declined' })
              patchNotifData(notif.id, { handled: true, status: 'declined' })
              showToast('Deal declined', 'info')
            }
          } finally {
            setActionBusy(null)
          }
          break
        }
        showToast('Offer declined', 'info')
        break
      }

      case 'dismiss': {
        // Keep actions available — seller can confirm later from Deals tab
        if (!notif.read) markOneRead(notif.id)
        showToast('You can confirm the deal later from the Deals tab', 'info')
        break
      }

      case 'vouch': {
        const sellerId = data.seller_id || data.vouchee_id
        if (sellerId) {
          if (!notif.read) markOneRead(notif.id)
          navigate(`/profile/${sellerId}?vouch=1`)
        } else {
          showToast('Seller profile not found', 'error')
        }
        break
      }

      case 'thank': {
        const actorId = data.sender_id || data.voucher_id || data.buyer_id || getActorId(notif)
        if (actorId) navigate(`/profile/${actorId}`)
        else showToast('Profile not found', 'info')
        break
      }
      case 'archive':
        showToast('Archived', 'info')
        break
      default:
        showToast('Action coming soon', 'info')
    }
  }, [
    actionBusy,
    markOneRead,
    navigateByType,
    navigate,
    showToast,
    user,
    products,
    senders,
    patchNotifData,
  ])

  const handleDealModalSend = useCallback(async () => {
    if (!dealModal || !user?.id) return
    const { notif, listing, buyerProfile } = dealModal
    const data = notif.data || {}
    setDealModal((m) => (m ? { ...m, sending: true, error: '' } : m))
    try {
      const { data: myProf } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()

      const { deal, error } = await sendDealFromNotification({
        sellerId: user.id,
        buyerId: data.buyer_id || buyerProfile?.id,
        listingId: listing?.id || data.listing_id,
        listingTitle: listing?.title || data.listing_title,
        listingPrice: listing?.price ?? data.listing_price,
        messageCount: data.message_count || MIN_DEAL_MESSAGES,
        sellerName: myProf?.full_name,
      })

      if (error) {
        setDealModal((m) => (m ? { ...m, sending: false, error: error.message || 'Failed to send' } : m))
        return
      }

      await markNotificationHandled(notif.id, {
        handled: true,
        deal_id: deal?.id,
        status: 'pending',
      })
      patchNotifData(notif.id, { handled: true, deal_id: deal?.id, status: 'pending' })
      setDealModal(null)
      showToast('Deal request sent to buyer', 'success')
    } catch (e) {
      setDealModal((m) => (m ? { ...m, sending: false, error: e.message || 'Failed to send' } : m))
    }
  }, [dealModal, user, patchNotifData, showToast])

  // ── Filtering / sorting ──────────────────────────────────────────────────
  const updateFilter = useCallback((updates) => setFilter((prev) => ({
    ...prev,
    ...updates,
    category: updates.category === undefined ? prev.category : normalizeCategory(updates.category),
  })), [])
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

  const grouped = useMemo(() => {
    const byDate = groupByDate(filteredNotifications)
    return Object.fromEntries(
      Object.entries(byDate).map(([dateLabel, notifs]) => [
        dateLabel,
        mergeMessageNotifications(notifs, senders),
      ]),
    )
  }, [filteredNotifications, senders])

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
        {loading ? (
          <main className="container" aria-busy="true">
            <div className="notifications-list">
              {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonCard key={i} />)}
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
                      const viewImage = notif.type === 'listing_view' ? resolveViewImage(notif, viewImages) : null
                      return (
                        <NotificationCard
                          key={notif.id}
                          notif={notif}
                          cfg={cfg}
                          sender={sender}
                          sendersLoading={sendersLoading}
                          product={product}
                          viewImage={viewImage}
                          index={i}
                          onCardClick={handleCardClick}
                          onDelete={deleteNotification}
                          onMarkRead={markOneRead}
                          onArchive={archiveNotification}
                          onAction={handleAction}
                          isExpanded={expandedNotificationId === notif.id}
                          onToggleExpand={toggleExpanded}
                        />
                      )
                    })}
                  </section>
                ))}
              </div>
            )}
          </main>
        )}
      </div>

      {pushBannerVisible && (
        <PushNotificationsBanner onEnable={handlePushEnable} onDismiss={handlePushDismiss} />
      )}

      {dealModal && user && (
        <DealEducationModal
          currentUser={user}
          otherProfile={dealModal.buyerProfile}
          listing={dealModal.listing}
          sending={dealModal.sending}
          error={dealModal.error}
          onSend={handleDealModalSend}
          onClose={() => setDealModal(null)}
        />
      )}

      <div className={`toast ${toast ? `toast-${toast.type} toast-visible` : ''}`} role="status" aria-live="polite" aria-atomic="true">
        {toast && (
          <>
            <span className="toast-icon" aria-hidden="true">
              <Ic
                icon={toast.type === 'new' ? Bell : toast.type === 'success' ? Check : toast.type === 'error' ? AlertTriangle : Settings}
                size={15}
                strokeWidth={2.25}
              />
            </span>
            <span>{toast.message}</span>
          </>
        )}
      </div>
    </div>
  )
}
