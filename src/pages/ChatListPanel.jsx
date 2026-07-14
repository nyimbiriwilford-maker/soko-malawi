import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

// Some reply-to-image sends appear to save the body as a bare message id
// with no `\x02[preview|||id]\x03body` wrapper at all — this matches that
// shape so the raw id doesn't leak into the UI. The real fix belongs in
// whatever composes the reply (likely Chat.jsx's image-reply handler); this
// is a display-time safety net.
const BARE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\]?$/i

function decodeReply(body) {
  if (!body) return { body, replyPreview: null, replyToId: null }
  const match = body.match(/^\x02\[(.+?)\|\|\|([^\]]+)\]\x03(.*)$/s)
  if (match) return { body: match[3], replyPreview: match[1], replyToId: match[2] }
  const fallback = body.match(/^(.+?)\|\|\|([a-f0-9-]{36})\](.*)$/s)
  if (fallback) return { body: fallback[3], replyPreview: fallback[1], replyToId: fallback[2] }
  if (BARE_UUID_RE.test(body.trim())) {
    return { body: '', replyPreview: null, replyToId: body.trim().replace(/\]$/, '') }
  }
  return { body, replyPreview: null, replyToId: null }
}

// Best-effort detection of an offer message so it can be highlighted.
// Adjust this pattern if your offer messages are formatted differently.
function parseOffer(body) {
  if (!body) return null
  const m = body.match(/offer[:\s]*mwk\s*([\d,]+)/i)
  return m ? `Offer: MWK ${m[1]}` : null
}

// Pulls a short title out of "...request for X" style intro messages,
// used as a fallback when there's no linked request record to read a title from.
function extractRequestTitle(body) {
  if (!body) return null
  const m = body.match(/request for ([^.!\n]+)/i)
  return m ? m[1].trim() : null
}

const REQUEST_TEXT_RE = /(?:i saw your|your) request for/i
const STARRED_KEY = 'soko_starred_chats'
const ARCHIVED_KEY = 'soko_archived_chats'

const CATEGORY_META = {
  marketplace: { label: 'Marketplace', bg: '#e6f7ee', color: '#1a7a4a' },
  services: { label: 'Services', bg: '#f3e8ff', color: '#7c3aed' },
  jobs: { label: 'Jobs', bg: '#eff6ff', color: '#2563eb' },
  requests: { label: 'People Looking For', bg: '#fef3e0', color: '#c9820a' },
  shops: { label: 'Shops', bg: '#e0f7fa', color: '#0891b2' },
}

const PILL_COLORS = {
  all: { bg: '#eef2ef', color: '#3a443d' },
  marketplace: { bg: '#e6f7ee', color: '#1a7a4a' },
  services: { bg: '#f3e8ff', color: '#7c3aed' },
  jobs: { bg: '#eff6ff', color: '#2563eb' },
  requests: { bg: '#fef3e0', color: '#c9820a' },
  shops: { bg: '#e0f7fa', color: '#0891b2' },
}

const CHIP_COLORS = {
  starred: { bg: '#fff8e6', color: '#c9820a' },
  unread: { bg: '#e6f7ee', color: '#1a7a4a' },
  offers: { bg: '#fff4e0', color: '#d97706' },
  archived: { bg: '#eef2f5', color: '#5c6b78' },
}

const PILLS = [
  { key: 'all', label: 'All' },
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'services', label: 'Services' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'requests', label: 'Requests' },
  { key: 'shops', label: 'Shops' },
]

const CHIPS = [
  { key: 'starred', label: 'Starred', Icon: StarFilledIcon },
  { key: 'unread', label: 'Unread', Icon: BellIcon },
  { key: 'offers', label: 'Offers', Icon: TagIcon },
  { key: 'archived', label: 'Archived', Icon: ArchiveBoxIcon },
]

function VerifiedBadge() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#2563eb" d="M12 2 14.5 4.5 18 4l.5 3.5L22 9l-1.5 3L22 15l-3.5 1.5L18 20l-3.5-.5L12 22l-2.5-2.5L6 20l-.5-3.5L2 15l1.5-3L2 9l3.5-1.5L6 4l3.5.5L12 2Z" />
      <path fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  )
}

function StarIcon({ filled }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill={filled ? '#f5a623' : 'none'} stroke={filled ? '#f5a623' : '#c7d0ca'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.1 8.6 22 9.3 17 14.1 18.2 21 12 17.6 5.8 21 7 14.1 2 9.3 8.9 8.6 12 2" />
    </svg>
  )
}

function ArchiveIcon({ active }) {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={active ? '#1a7a4a' : '#c7d0ca'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="5" rx="1" fill={active ? '#e6f7ee' : 'none'} />
      <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
      <path d="M10 13h4" />
    </svg>
  )
}

// Shared line-icon set — replaces emoji glyphs everywhere in this panel
// (chips, empty states, media/call previews) so the icon language matches
// the rest of the app (NavRail, category badges) instead of mixing in emoji.
function WrenchIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6a2.12 2.12 0 0 0 3 3l6-6a4 4 0 0 0 5.4-5.4l-2.1 2.1-2.6-2.6Z" />
    </svg>
  )
}
function BagIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}
function SearchGlassIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}
function BriefcaseIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  )
}
function StoreIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9 5 3h14l2 6" /><path d="M3 9v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" /><path d="M3 9h18" /><path d="M9 21v-6h6v6" />
    </svg>
  )
}
function BellIcon({ size = 15, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}
function TagIcon({ size = 15, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.6 12.3 12.7 20a2 2 0 0 1-2.8 0l-8-8V3h9l9.7 9.7a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  )
}
function ArchiveBoxIcon({ size = 15, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="5" rx="1" /><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" /><path d="M10 13h4" />
    </svg>
  )
}
function StarFilledIcon({ size = 16, color = '#f5a623' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.1 8.6 22 9.3 17 14.1 18.2 21 12 17.6 5.8 21 7 14.1 2 9.3 8.9 8.6 12 2" />
    </svg>
  )
}
function ChatBubbleIcon({ size = 16, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  )
}
function CameraIcon({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
    </svg>
  )
}
function VideoMiniIcon({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
    </svg>
  )
}
function MicIcon({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0" /><line x1="12" y1="19" x2="12" y2="22" />
    </svg>
  )
}
function PaperclipIcon({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.44 11.05 12.25 20.24a5 5 0 0 1-7.07-7.07l9.19-9.19a3.5 3.5 0 0 1 4.95 4.95L10.13 17.12a2 2 0 0 1-2.83-2.83l8.49-8.49" />
    </svg>
  )
}
function PhoneIcon({ size = 13, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.03 1.19 2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92v2z" />
    </svg>
  )
}

export default function ChatListPanel() {
  const navigate = useNavigate()
  // Params of the thread currently open in the right pane (if any) — used to
  // highlight the matching row on desktop's split view.
  const { userId: openUserId, listingId: openContextId } = useParams()

  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  // 'all' | 'marketplace' | 'services' | 'jobs' | 'requests' | 'shops' | 'starred' | 'unread' | 'offers' | 'archived'
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [starred, setStarred] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(STARRED_KEY) || '[]')) } catch { return new Set() }
  })
  const [archived, setArchived] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(ARCHIVED_KEY) || '[]')) } catch { return new Set() }
  })

  useEffect(() => { loadChats() }, [])

  function toggleStar(key, e) {
    e.stopPropagation()
    setStarred(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      localStorage.setItem(STARRED_KEY, JSON.stringify([...next]))
      return next
    })
  }

  function toggleArchive(key, e) {
    e.stopPropagation()
    setArchived(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      localStorage.setItem(ARCHIVED_KEY, JSON.stringify([...next]))
      return next
    })
  }

  async function loadChats() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)

    const { data: messages } = await supabase
      .from('messages')
      .select('*')
      .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
      .order('created_at', { ascending: false })

    if (!messages || messages.length === 0) { setLoading(false); return }

    // ── Grouping strategy ────────────────────────────────────────────────────
    // One row per (person × context). Context = service_id OR listing_id OR
    // request_id (only used if your `messages` rows carry a request_id for
    // buyer-request threads — harmless no-op otherwise, since it'll just be
    // undefined and this whole branch is skipped).
    const convos = new Map()

    for (const msg of messages) {
      const otherId = msg.from_user === user.id ? msg.to_user : msg.from_user
      const serviceId = msg.service_id || null
      const listingId = msg.listing_id || null
      const requestId = msg.request_id || null
      const isCallLog = !!msg.call_type

      let key
      if (serviceId) key = `svc:${otherId}:${serviceId}`
      else if (listingId) key = `lst:${otherId}:${listingId}`
      else if (requestId) key = `req:${otherId}:${requestId}`
      else key = `dir:${otherId}`

      if (!convos.has(key)) {
        convos.set(key, {
          key,
          otherId,
          contextId: serviceId || listingId || requestId || null,
          isService: !!serviceId,
          isRequestCtx: !!requestId,
          isDirect: !serviceId && !listingId && !requestId,
          lastMsg: msg,
          lastRealMsg: isCallLog ? null : msg,
        })
      } else {
        const c = convos.get(key)
        if (!c.lastRealMsg && !isCallLog) {
          c.lastRealMsg = msg
          c.lastMsg = msg
        }
      }
    }

    const allKeys = [...convos.keys()]
    for (const k of allKeys) {
      if (!k.startsWith('dir:')) continue
      const c = convos.get(k)
      const contextKey = allKeys.find(
        ok => !ok.startsWith('dir:') && ok.includes(`:${c.otherId}:`)
      )
      if (contextKey) {
        const ctx = convos.get(contextKey)
        const dirTime = new Date(c.lastMsg.created_at)
        const ctxTime = new Date(ctx.lastMsg.created_at)
        if (dirTime > ctxTime && !c.lastMsg.call_type) {
          ctx.lastMsg = c.lastMsg
        }
        convos.delete(k)
      }
    }

    const conversations = [...convos.values()].map(c => ({
      ...c,
      lastMsg: c.lastRealMsg || c.lastMsg,
    }))

    const otherIds = [...new Set(conversations.map(c => c.otherId))]
    const serviceIds = conversations.filter(c => c.isService && c.contextId).map(c => c.contextId)
    const listingIds = conversations.filter(c => !c.isService && !c.isRequestCtx && c.contextId).map(c => c.contextId)

    const [{ data: profiles }, { data: services }, { data: listings }] = await Promise.all([
      supabase.from('profiles').select('id,full_name,avatar_url,city').in('id', otherIds),
      serviceIds.length > 0
        ? supabase.from('services').select('id,name,category,rate,city,media_urls').in('id', serviceIds)
        : { data: [] },
      listingIds.length > 0
        ? supabase.from('listings').select('id,title,images,price').in('id', listingIds)
        : { data: [] },
    ])

    const profilesMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    const servicesMap = Object.fromEntries((services || []).map(s => [s.id, s]))
    const listingsMap = Object.fromEntries((listings || []).map(l => [l.id, l]))

    const enriched = await Promise.all(conversations.map(async c => {
      let unreadQ = supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('from_user', c.otherId)
        .eq('to_user', user.id)
        .eq('read', false)
      if (c.isService && c.contextId) unreadQ = unreadQ.eq('service_id', c.contextId)
      else if (c.isRequestCtx && c.contextId) unreadQ = unreadQ.eq('request_id', c.contextId)
      else if (!c.isService && !c.isRequestCtx && c.contextId) unreadQ = unreadQ.eq('listing_id', c.contextId)
      const { count } = await unreadQ

      const profile = profilesMap[c.otherId] || {}
      const displayName = profile.full_name || 'User'
      const avatarUrl = profile.avatar_url || null
      const isVerified = profile.is_verified ?? profile.verified ?? false

      const decoded = decodeReply(c.lastMsg.body || '')
      const isRequest = c.isRequestCtx || (!c.isService && REQUEST_TEXT_RE.test(decoded.body || ''))
      const requestTitle = isRequest ? extractRequestTitle(decoded.body) : null
      const offerText = parseOffer(decoded.body)

      return {
        ...c,
        displayName,
        avatarUrl,
        isVerified,
        isRequest,
        requestTitle,
        hasOffer: !!offerText,
        offerText,
        service: c.isService ? servicesMap[c.contextId] : null,
        listing: !c.isService && !c.isRequestCtx && c.contextId ? listingsMap[c.contextId] : null,
        unread: count || 0,
      }
    }))

    enriched.sort((a, b) => new Date(b.lastMsg.created_at) - new Date(a.lastMsg.created_at))
    setChats(enriched)
    setLoading(false)
  }

  // ── Counts for pills/chips ───────────────────────────────────────────────
  const counts = useMemo(() => {
    const visible = chats.filter(c => !c.isDirect && !archived.has(c.key))
    return {
      all: visible.length,
      marketplace: visible.filter(c => !c.isService && !c.isRequest && c.listing).length,
      services: visible.filter(c => c.isService).length,
      jobs: 0, // No job_id column on `messages` yet.
      requests: visible.filter(c => c.isRequest).length,
      shops: 0, // No shop_id column on `messages` yet.
      offers: visible.filter(c => c.hasOffer).length,
      archived: [...archived].filter(k => chats.some(c => c.key === k)).length,
      starred: [...starred].filter(k => chats.some(c => c.key === k) && !archived.has(k)).length,
      unread: visible.filter(c => c.unread > 0).length,
    }
  }, [chats, starred, archived])

  // ── Filtering + search ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const pool = activeFilter === 'archived'
      ? chats.filter(c => archived.has(c.key))
      : chats.filter(c => !archived.has(c.key) && !c.isDirect)

    let list = pool
    switch (activeFilter) {
      case 'marketplace': list = pool.filter(c => !c.isService && !c.isRequest && c.listing); break
      case 'services': list = pool.filter(c => c.isService); break
      case 'requests': list = pool.filter(c => c.isRequest); break
      case 'jobs': list = pool.filter(c => c.isJob); break
      case 'shops': list = pool.filter(c => c.isShop); break
      case 'starred': list = pool.filter(c => starred.has(c.key)); break
      case 'unread': list = pool.filter(c => c.unread > 0); break
      case 'offers': list = pool.filter(c => c.hasOffer); break
      case 'archived': list = pool; break
      default: list = pool
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c => {
        const nameMatch = c.displayName?.toLowerCase().includes(q)
        const contextMatch = (c.service?.name || c.listing?.title || c.requestTitle || '').toLowerCase().includes(q)
        const msgBody = decodeReply(c.lastMsg?.body || '').body?.toLowerCase()
        const msgMatch = msgBody?.includes(q)
        if (nameMatch || contextMatch || msgMatch) {
          c._matchedMsgId = msgMatch ? c.lastMsg?.id : null
          return true
        }
        return false
      })
    }
    return list
  }, [chats, activeFilter, search, starred, archived])

  function renderLastMsg(chat) {
    const msg = chat.lastMsg
    const isMine = msg.from_user === currentUser?.id
    const prefix = isMine ? 'You: ' : ''

    const iconRow = (Icon, label) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', verticalAlign: 'middle' }}>
        <Icon size={12} color="currentColor" /> {label}
      </span>
    )

    if (msg.call_type) {
      const isVideo = msg.call_type === 'video'
      const CallIcon = isVideo ? VideoMiniIcon : PhoneIcon
      if (msg.call_status === 'missed') return iconRow(CallIcon, 'Missed ' + (isVideo ? 'Video call' : 'Voice call'))
      if (msg.call_status === 'ended') {
        const dur = msg.call_duration
        const durStr = dur ? (dur >= 60 ? Math.floor(dur / 60) + 'm ' + (dur % 60) + 's' : dur + 's') : ''
        return iconRow(CallIcon, (isVideo ? 'Video call' : 'Voice call') + (durStr ? ' · ' + durStr : ''))
      }
      return iconRow(CallIcon, isVideo ? 'Video call' : 'Voice call')
    }

    if (msg.media_type === 'image') return iconRow(CameraIcon, prefix + 'Photo')
    if (msg.media_type === 'video') return iconRow(VideoMiniIcon, prefix + 'Video')
    if (msg.media_type === 'audio') return iconRow(MicIcon, prefix + 'Voice note')
    if (!msg.body) return iconRow(PaperclipIcon, prefix + 'Attachment')

    const decoded = decodeReply(msg.body)
    let body = (decoded.body || '').trim()
    if (!body && decoded.replyToId) body = '📷 Photo'
    if (!body) body = 'Message'
    const text = body.length > 38 ? body.slice(0, 38) + '…' : body
    return prefix + text
  }

  function timeLabel(date) {
    const d = new Date(date)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return 'now'
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm'
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (diff < 604800000) return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
  }

  function emptyStateCopy() {
    switch (activeFilter) {
      case 'services': return { Icon: WrenchIcon, title: 'No service chats yet', sub: 'Book a service and chat with the provider', cta: 'Browse Services', to: '/services', ...PILL_COLORS.services }
      case 'marketplace': return { Icon: BagIcon, title: 'No marketplace chats yet', sub: 'Chat with sellers when browsing listings', cta: 'Browse Listings', to: '/', ...PILL_COLORS.marketplace }
      case 'requests': return { Icon: SearchGlassIcon, title: 'No requests yet', sub: 'Conversations from buyer requests will show up here', cta: 'Browse Requests', to: '/looking-for', ...PILL_COLORS.requests }
      case 'jobs': return { Icon: BriefcaseIcon, title: 'No job chats yet', sub: 'Job messaging is on its way', cta: 'Browse Jobs', to: '/jobs', ...PILL_COLORS.jobs }
      case 'shops': return { Icon: StoreIcon, title: 'No shop chats yet', sub: 'Shop messaging is on its way', cta: 'Browse Shops', to: '/shops', ...PILL_COLORS.shops }
      case 'starred': return { Icon: StarFilledIcon, title: 'No starred chats', sub: 'Tap the star on a conversation to pin it here', cta: null, ...CHIP_COLORS.starred }
      case 'unread': return { Icon: ChatBubbleIcon, title: "You're all caught up", sub: 'No unread conversations right now', cta: null, ...CHIP_COLORS.unread }
      case 'offers': return { Icon: TagIcon, title: 'No offers yet', sub: 'Offers made in your chats will show up here', cta: null, ...CHIP_COLORS.offers }
      case 'archived': return { Icon: ArchiveBoxIcon, title: 'No archived chats', sub: 'Archive a conversation from the list to see it here', cta: null, ...CHIP_COLORS.archived }
      default: return { Icon: ChatBubbleIcon, title: 'No messages yet', sub: 'Chat with sellers when browsing listings', cta: 'Browse Listings', to: '/', ...PILL_COLORS.marketplace }
    }
  }

  function renderChatRow(chat, i) {
    const category = chat.isService ? 'services' : chat.isRequest ? 'requests' : chat.listing ? 'marketplace' : null
    const catMeta = category ? CATEGORY_META[category] : null

    const contextLabel = category === 'services' ? (chat.service?.name || 'Service')
      : category === 'requests' ? (chat.requestTitle ? `Looking for ${chat.requestTitle}` : 'Buyer Request')
      : category === 'marketplace' ? (chat.listing?.title || null)
      : null
    const contextSub = category === 'services' ? [chat.service?.rate, chat.service?.city].filter(Boolean).join(' · ')
      : category === 'marketplace' && chat.listing?.price ? 'MWK ' + Number(chat.listing.price).toLocaleString()
      : ''

    const itemImg = chat.isService ? chat.service?.media_urls?.[0] : chat.listing?.images?.[0]
    const finalAvatar = itemImg || chat.avatarUrl
    const initial = (chat.displayName || 'U')[0].toUpperCase()
    const isStarred = starred.has(chat.key)
    const isArchived = archived.has(chat.key)
    const hasUnread = chat.unread > 0
    const isOpen = openUserId === chat.otherId && String(openContextId || '') === String(chat.contextId || '')

    const chatPath = chat.contextId ? `/chat/${chat.otherId}/${chat.contextId}` : `/chat/${chat.otherId}`
    const chatState = chat._matchedMsgId ? { state: { scrollToMessageId: chat._matchedMsgId } } : {}

    return (
      <div
        key={chat.key}
        style={{
          ...S.chatRow,
          animationDelay: i * 0.03 + 's',
          background: isOpen ? '#e6f7ee' : hasUnread ? '#fafffd' : '#fff',
        }}
        onClick={() => navigate(chatPath, chatState)}
      >
        <div style={S.avatarWrap}>
          <div style={{ ...S.avatar, background: finalAvatar ? '#eef2ef' : 'linear-gradient(135deg,#1a7a4a,#22a05e)' }}>
            {finalAvatar
              ? <img src={finalAvatar} alt="" style={S.avatarImg} />
              : <span style={S.avatarInitial}>{initial}</span>}
          </div>
          {/* Online dot removed — there's no real presence data behind it yet.
              Re-add here once online status is wired to Supabase Presence. */}
        </div>

        <div style={S.chatInfo}>
          <div style={S.chatTop}>
            <div style={S.nameRow}>
              <span style={S.chatName}>{chat.displayName}</span>
              {chat.isVerified && <VerifiedBadge />}
            </div>
            <span style={{ ...S.chatTime, color: hasUnread ? '#1a7a4a' : '#bbb', fontWeight: hasUnread ? '700' : '400' }}>
              {timeLabel(chat.lastMsg.created_at)}
            </span>
          </div>

          {contextLabel && (
            <div style={S.contextPill}>
              <span style={{ ...S.contextBadge, background: catMeta.bg, color: catMeta.color }}>{catMeta.label}</span>
              <span style={S.contextName}>{contextLabel}</span>
              {contextSub ? <span style={S.contextSub}> · {contextSub}</span> : null}
            </div>
          )}

          <div style={S.chatBottom}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {chat.hasOffer ? (
                <div style={S.offerLine}><TagIcon size={13} color="#1a7a4a" /> {chat.offerText}</div>
              ) : (
                <div style={{
                  ...S.lastMsg,
                  fontWeight: hasUnread || search ? '600' : '400',
                  color: hasUnread ? '#0f1410' : (search && chat._matchedMsgId ? '#1a7a4a' : '#888'),
                }}>
                  {renderLastMsg(chat)}
                </div>
              )}
            </div>
            <div style={S.rowActions}>
              {hasUnread && <span style={S.unreadBadge}>{chat.unread > 9 ? '9+' : chat.unread}</span>}
              <div style={S.actionIcons}>
                <button style={S.starBtn} onClick={(e) => toggleStar(chat.key, e)} aria-label="Star conversation" title={isStarred ? 'Unstar' : 'Star'}>
                  <StarIcon filled={isStarred} />
                </button>
                <button style={S.starBtn} onClick={(e) => toggleArchive(chat.key, e)} aria-label="Archive conversation" title={isArchived ? 'Unarchive' : 'Archive'}>
                  <ArchiveIcon active={isArchived} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const empty = emptyStateCopy()

  return (
    <div className="chat-list-panel" style={S.panel}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .soko-pillrow::-webkit-scrollbar { display: none; }
        /* Desktop: NavRail handles nav — hide bottom bar so list uses full height */
        @media (min-width: 900px) {
          .soko-mobile-bottomnav { display: none !important; }
        }
      `}</style>

      {/* Brand row */}
      <div className="chat-brand-row" style={S.brandRow}>
        <div>
          <div style={S.logo}>
            <span style={{ color: '#1a7a4a' }}>Soko</span><span style={{ color: '#f5a623' }}>Mw</span>
          </div>
          <div style={S.tagline}>Buy. Sell. Find. Anywhere in Malawi.</div>
        </div>
      </div>

      {/* Search */}
      <div style={S.searchWrap}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          style={S.searchInput}
          placeholder="Search chats"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', padding: 0 }} onClick={() => setSearch('')}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Category pills — horizontal, was the vertical sidebar */}
      <div style={S.rowWrap}>
        <div className="soko-pillrow" style={S.pillRow}>
          {PILLS.map(p => (
            <button
              key={p.key}
              style={{
                ...S.pill,
                background: PILL_COLORS[p.key].bg,
                color: PILL_COLORS[p.key].color,
                ...(activeFilter === p.key ? S.pillActive : {}),
              }}
              onClick={() => setActiveFilter(p.key)}
            >
              {p.label}
              {/* Counts reflect totals, not the active search — hide them while
                  searching so they don't look like they contradict the visible list. */}
              {!search.trim() && counts[p.key] > 0 && (
                <span style={{ ...S.pillCount, ...(activeFilter === p.key ? S.pillCountActive : {}) }}>{counts[p.key]}</span>
              )}
            </button>
          ))}
        </div>
        <div style={S.rowFade} />
      </div>

      {/* Secondary chips — Starred / Unread / Offers / Archived */}
      <div style={S.rowWrap}>
        <div className="soko-pillrow" style={S.chipRow}>
          {CHIPS.map(c => (
            <button
              key={c.key}
              style={{
                ...S.chip,
                background: CHIP_COLORS[c.key].bg,
                color: CHIP_COLORS[c.key].color,
                ...(activeFilter === c.key ? S.chipActive : {}),
              }}
              onClick={() => setActiveFilter(c.key)}
            >
              <c.Icon size={13} color={activeFilter === c.key ? '#fff' : CHIP_COLORS[c.key].color} /> {c.label}
              {!search.trim() && counts[c.key] > 0 && (
                <span style={{ ...S.pillCount, ...(activeFilter === c.key ? S.pillCountActive : {}) }}>{counts[c.key]}</span>
              )}
            </button>
          ))}
        </div>
        <div style={{ ...S.rowFade, bottom: '12px' }} />
      </div>

      {/* Loading skeletons */}
      {loading && (
        <div style={{ padding: '8px 0' }}>
          {[1, 2, 3, 4].map(i => (
            <div key={i} style={S.skeletonRow}>
              <div style={S.skeletonAvatar} />
              <div style={{ flex: 1 }}>
                <div style={{ ...S.skeletonLine, width: '55%', marginBottom: '8px' }} />
                <div style={{ ...S.skeletonLine, width: '80%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Scroll body — empty + rows share one scroller so BottomNav padding applies to both */}
      <div className="chat-list-scroll" style={S.list}>
        {!loading && filtered.length === 0 && (
          <div style={S.empty}>
            <div style={{ ...S.emptyIconCircle, background: empty.bg }}>
              <empty.Icon size={30} color={empty.color} />
            </div>
            <p style={S.emptyTitle}>{empty.title}</p>
            <p style={S.emptySub}>{empty.sub}</p>
            {empty.cta && (
              <button type="button" style={S.browseBtn} onClick={() => navigate(empty.to)}>{empty.cta}</button>
            )}
          </div>
        )}
        {filtered.map((chat, i) => renderChatRow(chat, i))}
      </div>

      <div className="soko-mobile-bottomnav">
        <BottomNav />
      </div>
    </div>
  )
}

const S = {
  panel: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, background: '#fff', fontFamily: 'system-ui, sans-serif', overflow: 'hidden', position: 'relative' },
  brandRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px 10px', flexShrink: 0 },
  logo: { fontSize: '20px', fontWeight: '900', letterSpacing: '-0.4px' },
  tagline: { fontSize: '11px', color: '#9aa39d', marginTop: '2px' },
  newChatBtn: { width: '34px', height: '34px', borderRadius: '50%', border: 'none', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, boxShadow: '0 3px 8px rgba(26,122,74,0.35)' },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, background: '#f4f8f5', borderRadius: 50, padding: '10px 16px', border: '1.5px solid #e0ebe3', margin: '0 16px 10px', flexShrink: 0 },
  searchInput: { flex: 1, border: 'none', background: 'transparent', fontSize: 14, color: '#111', outline: 'none', fontFamily: 'inherit', minWidth: 0 },
  pillRow: { display: 'flex', gap: '7px', padding: '0 16px 10px 16px', overflowX: 'auto', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' },
  pill: { display: 'flex', alignItems: 'center', gap: '5px', padding: '7px 13px', borderRadius: '999px', border: 'none', fontSize: '12.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
  pillActive: { background: '#1a7a4a', color: '#fff', boxShadow: '0 3px 10px rgba(26,122,74,0.35)' },
  pillCount: { background: 'rgba(0,0,0,0.08)', color: 'inherit', borderRadius: '10px', padding: '0px 6px', fontSize: '10px', fontWeight: '800' },
  pillCountActive: { background: 'rgba(255,255,255,0.28)', color: '#fff' },
  rowWrap: { position: 'relative', flexShrink: 0 },
  rowFade: { position: 'absolute', top: 0, bottom: '10px', right: 0, width: '36px', background: 'linear-gradient(to right, rgba(255,255,255,0), #fff 70%)', pointerEvents: 'none' },
  chipRow: { display: 'flex', gap: '7px', padding: '0 16px 12px 16px', overflowX: 'auto', scrollbarWidth: 'none', borderBottom: '1px solid #eef2ef', WebkitOverflowScrolling: 'touch' },
  chip: { display: 'flex', alignItems: 'center', gap: '4px', padding: '6px 11px', borderRadius: '999px', border: 'none', fontSize: '11.5px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0, boxShadow: '0 1px 2px rgba(0,0,0,0.04)' },
  chipActive: { background: '#1a7a4a', color: '#fff', boxShadow: '0 3px 10px rgba(26,122,74,0.3)' },
  skeletonRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px', background: '#fff', borderBottom: '1px solid #f4f8f5' },
  skeletonAvatar: { width: '52px', height: '52px', borderRadius: '15px', background: 'linear-gradient(90deg,#e8f0eb 25%,#f4f8f5 50%,#e8f0eb 75%)', flexShrink: 0, animation: 'pulse 1.5s infinite' },
  skeletonLine: { height: '11px', borderRadius: '6px', background: 'linear-gradient(90deg,#e8f0eb 25%,#f4f8f5 50%,#e8f0eb 75%)', animation: 'pulse 1.5s infinite' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px 20px', textAlign: 'center', minHeight: '100%' },
  emptyIconCircle: { width: '76px', height: '76px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' },
  emptyTitle: { fontSize: '15.5px', fontWeight: '800', color: '#0f1410', marginBottom: '6px' },
  emptySub: { fontSize: '12.5px', color: '#888', marginBottom: '20px', lineHeight: '1.6' },
  browseBtn: { background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff', border: 'none', borderRadius: '12px', padding: '11px 22px', fontSize: '13.5px', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 12px rgba(26,122,74,0.35)' },
  list: { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch' },
  chatRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px', borderBottom: '1px solid #f0f4f1', cursor: 'pointer', animation: 'fadeUp 0.3s ease both', transition: 'background 0.15s' },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: { width: '52px', height: '52px', borderRadius: '15px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitial: { fontSize: '18px', fontWeight: '800', color: '#fff' },
  chatInfo: { flex: 1, minWidth: 0 },
  chatTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px', gap: '6px' },
  nameRow: { display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 },
  chatName: { fontSize: '14px', fontWeight: '700', color: '#0f1410', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  chatTime: { fontSize: '10.5px', flexShrink: 0 },
  contextPill: { display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px', flexWrap: 'nowrap', overflow: 'hidden' },
  contextBadge: { fontSize: '9px', fontWeight: '700', borderRadius: '6px', padding: '1px 5px', flexShrink: 0, whiteSpace: 'nowrap' },
  contextName: { fontSize: '10.5px', fontWeight: '700', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' },
  contextSub: { fontSize: '10.5px', color: '#888', whiteSpace: 'nowrap', flexShrink: 0 },
  chatBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
  lastMsg: { fontSize: '12.5px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  offerLine: { fontSize: '12.5px', fontWeight: '800', color: '#1a7a4a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  rowActions: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '5px', marginLeft: '8px', flexShrink: 0 },
  actionIcons: { display: 'flex', alignItems: 'center', gap: '6px' },
  unreadBadge: { background: '#1a7a4a', color: '#fff', borderRadius: '10px', minWidth: '18px', height: '18px', fontSize: '9.5px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' },
  starBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' },
}