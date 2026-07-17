import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ChatSidebar from '../components/ChatSidebar'

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

const PILLS = [
  { key: 'all', label: 'All' },
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'services', label: 'Services' },
  { key: 'jobs', label: 'Jobs' },
  { key: 'requests', label: 'Requests' },
  { key: 'shops', label: 'Shops' },
]

function VerifiedBadge() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
      <path fill="#2563eb" d="M12 2 14.5 4.5 18 4l.5 3.5L22 9l-1.5 3L22 15l-3.5 1.5L18 20l-3.5-.5L12 22l-2.5-2.5L6 20l-.5-3.5L2 15l1.5-3L2 9l3.5-1.5L6 4l3.5.5L12 2Z" />
      <path fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4" />
    </svg>
  )
}

function StarIcon({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? '#f5a623' : 'none'} stroke={filled ? '#f5a623' : '#c7d0ca'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.1 8.6 22 9.3 17 14.1 18.2 21 12 17.6 5.8 21 7 14.1 2 9.3 8.9 8.6 12 2" />
    </svg>
  )
}

function ArchiveIcon({ active }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={active ? '#1a7a4a' : '#c7d0ca'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="5" rx="1" fill={active ? '#e6f7ee' : 'none'} />
      <path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" />
      <path d="M10 13h4" />
    </svg>
  )
}

export default function ChatList() {
  const navigate = useNavigate()
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [myProfile, setMyProfile] = useState(null)
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

    // Own profile, for the sidebar footer.
    supabase.from('profiles').select('id,full_name,avatar_url').eq('id', user.id).single()
      .then(({ data }) => setMyProfile(data))

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
    // The same person asking about your listing AND booking your service = 2 rows
    // (genuinely different conversations).
    // Call-log messages with no context attach to the person's most-relevant
    // existing context, or create a direct row only if no other context exists.

    const convos = new Map() // key → convo object

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
      else key = `dir:${otherId}` // call logs / direct messages

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
        // Upgrade preview from call-log to real message
        if (!c.lastRealMsg && !isCallLog) {
          c.lastRealMsg = msg
          c.lastMsg = msg
        }
      }
    }

    // Merge orphan "dir:" rows into a real-context row if one exists for the same person
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
        convos.delete(k) // remove orphan direct row
      }
    }

    const conversations = [...convos.values()].map(c => ({
      ...c,
      lastMsg: c.lastRealMsg || c.lastMsg,
    }))

    // ── Enrich ───────────────────────────────────────────────────────────────
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
      // Not fetched above (column may not exist yet) — wire up once your
      // profiles table has a verified/is_verified flag.
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

  // ── Sidebar counts ─────────────────────────────────────────────────────────
  const counts = useMemo(() => {
    const visible = chats.filter(c => !c.isDirect && !archived.has(c.key))
    return {
      all: visible.length,
      marketplace: visible.filter(c => !c.isService && !c.isRequest && c.listing).length,
      services: visible.filter(c => c.isService).length,
      // No job_id column on `messages` yet — will start counting once one exists.
      jobs: 0,
      requests: visible.filter(c => c.isRequest).length,
      // No shop_id column on `messages` yet — will start counting once one exists.
      shops: 0,
      offers: visible.filter(c => c.hasOffer).length,
      archived: [...archived].filter(k => chats.some(c => c.key === k)).length,
      starred: [...starred].filter(k => chats.some(c => c.key === k) && !archived.has(k)).length,
      unread: visible.filter(c => c.unread > 0).length,
    }
  }, [chats, starred, archived])

  // ── Filtering + search ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    // Archived chats are hidden from every view except the Archived tab itself.
    const pool = activeFilter === 'archived'
      ? chats.filter(c => archived.has(c.key))
      : chats.filter(c => !archived.has(c.key) && !c.isDirect)

    let list = pool
    switch (activeFilter) {
      case 'marketplace': list = pool.filter(c => !c.isService && !c.isRequest && c.listing); break
      case 'services': list = pool.filter(c => c.isService); break
      case 'requests': list = pool.filter(c => c.isRequest); break
      case 'jobs': list = pool.filter(c => c.isJob); break // always empty until job context exists
      case 'shops': list = pool.filter(c => c.isShop); break // always empty until shop context exists
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

    // ── Call logs ──────────────────────────────────────────
    if (msg.call_type) {
      const isVideo = msg.call_type === 'video'
      const icon = isVideo ? '📹' : '📞'
      if (msg.call_status === 'missed') return 'Missed ' + icon + (isVideo ? ' Video call' : ' Voice call')
      if (msg.call_status === 'ended') {
        const dur = msg.call_duration
        const durStr = dur ? (dur >= 60 ? Math.floor(dur / 60) + 'm ' + (dur % 60) + 's' : dur + 's') : ''
        return icon + ' ' + (isVideo ? 'Video call' : 'Voice call') + (durStr ? ' · ' + durStr : '')
      }
      return icon + ' ' + (isVideo ? 'Video call' : 'Voice call')
    }

    // ── Media ──────────────────────────────────────────────
    if (msg.media_type === 'image') return prefix + '📷 Photo'
    if (msg.media_type === 'video') return prefix + '🎥 Video'
    if (msg.media_type === 'audio') return prefix + '🎤 Voice note'

    // ── Clean body text ────────────────────────────────────
    if (!msg.body) return prefix + '📎 Attachment'

    const decoded = decodeReply(msg.body)
    let body = (decoded.body || '').trim()
    // decodeReply strips a bare-id body to '' — that's the reply-to-image bug pattern.
    if (!body && decoded.replyToId) body = '📷 Photo'
    if (!body) body = 'Message'
    const text = body.length > 45 ? body.slice(0, 45) + '…' : body
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
      case 'services': return { icon: '🔧', title: 'No service chats yet', sub: 'Book a service and chat with the provider', cta: 'Browse Services', to: '/services' }
      case 'marketplace': return { icon: '🛍️', title: 'No marketplace chats yet', sub: 'Chat with sellers when browsing listings', cta: 'Browse Listings', to: '/' }
      case 'requests': return { icon: '🔎', title: 'No requests yet', sub: 'Conversations from buyer requests will show up here', cta: 'Browse Requests', to: '/looking-for' }
      case 'jobs': return { icon: '💼', title: 'No job chats yet', sub: 'Job messaging is on its way', cta: 'Browse Jobs', to: '/jobs' }
      case 'shops': return { icon: '🏬', title: 'No shop chats yet', sub: 'Shop messaging is on its way', cta: 'Browse Shops', to: '/shops' }
      case 'starred': return { icon: '⭐', title: 'No starred chats', sub: 'Tap the star on a conversation to pin it here', cta: null }
      case 'unread': return { icon: '💬', title: "You're all caught up", sub: 'No unread conversations right now', cta: null }
      case 'offers': return { icon: '💰', title: 'No offers yet', sub: 'Offers made in your chats will show up here', cta: null }
      case 'archived': return { icon: '🗄️', title: 'No archived chats', sub: 'Archive a conversation from the list to see it here', cta: null }
      default: return { icon: '💬', title: 'No messages yet', sub: 'Chat with sellers when browsing listings', cta: 'Browse Listings', to: '/' }
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

    // Avatar priority: item photo first (what you're chatting about),
    // falling back to the person's profile photo, then initials.
    const itemImg = chat.isService ? chat.service?.media_urls?.[0] : chat.listing?.images?.[0]
    const finalAvatar = itemImg || chat.avatarUrl
    const initial = (chat.displayName || 'U')[0].toUpperCase()
    const isStarred = starred.has(chat.key)
    const isArchived = archived.has(chat.key)
    const hasUnread = chat.unread > 0

    const chatPath = chat.contextId ? `/chat/${chat.otherId}/${chat.contextId}` : `/chat/${chat.otherId}`
    const chatState = chat._matchedMsgId ? { state: { scrollToMessageId: chat._matchedMsgId } } : {}

    return (
      <div
        key={chat.key}
        style={{ ...S.chatRow, animationDelay: i * 0.03 + 's', background: hasUnread ? '#fafffd' : '#fff' }}
        onClick={() => navigate(chatPath, chatState)}
      >
        <div style={S.avatarWrap}>
          <div style={{ ...S.avatar, background: finalAvatar ? '#eef2ef' : 'linear-gradient(135deg,#1a7a4a,#22a05e)' }}>
            {finalAvatar
              ? <img src={finalAvatar} alt="" style={S.avatarImg} />
              : <span style={S.avatarInitial}>{initial}</span>}
          </div>
          {/* Static online indicator — wire to Supabase Presence when available */}
          <span style={S.onlineDot} />
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
                <div style={S.offerLine}>💰 {chat.offerText}</div>
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
    <div style={S.appShell}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        .soko-desktop-sidebar { display: none; }
        .soko-mobile-bottomnav { display: block; }
        @media (min-width: 900px) {
          .soko-desktop-sidebar { display: flex !important; }
          .soko-mobile-bottomnav { display: none !important; }
          .soko-main-panel { padding-bottom: 0 !important; }
        }
      `}</style>

      <ChatSidebar
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
        counts={counts}
        profile={myProfile}
        onNewChat={() => navigate('/')}
      />

      <div style={S.page} className="soko-main-panel">
        {/* Header */}
        <div style={S.header}>
          <div style={S.headerTop}>
            <div style={S.headerTitle}>Chats</div>
            <div style={S.headerRight}>
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
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                )}
              </div>
              <button style={S.iconBtn} aria-label="Filter">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
                </svg>
              </button>
              <button style={S.iconBtn} aria-label="More options">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="5" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="12" cy="19" r="1.8" />
                </svg>
              </button>
            </div>
          </div>

          <div style={S.tabs}>
            {PILLS.map(p => (
              <button
                key={p.key}
                style={{ ...S.tab, ...(activeFilter === p.key ? S.tabActive : {}) }}
                onClick={() => setActiveFilter(p.key)}
              >
                {p.label}
              </button>
            ))}
          </div>
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

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div style={S.empty}>
            <div style={S.emptyIcon}>{empty.icon}</div>
            <p style={S.emptyTitle}>{empty.title}</p>
            <p style={S.emptySub}>{empty.sub}</p>
            {empty.cta && (
              <button style={S.browseBtn} onClick={() => navigate(empty.to)}>{empty.cta}</button>
            )}
          </div>
        )}

        {/* Chat list */}
        <div style={S.list}>
          {filtered.map((chat, i) => renderChatRow(chat, i))}
        </div>
      </div>
    </div>
  )
}

const S = {
  appShell: { display: 'flex', minHeight: '100vh', background: '#f4f8f5', fontFamily: 'system-ui, sans-serif' },
  page: { flex: 1, minWidth: 0, paddingBottom: '80px' },
  header: { background: '#fff', borderBottom: '1px solid #e8f0eb', position: 'sticky', top: 0, zIndex: 50 },
  headerTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', padding: '22px 24px 14px', flexWrap: 'wrap' },
  headerTitle: { fontSize: '26px', fontWeight: '800', color: '#0f1410' },
  headerRight: { display: 'flex', alignItems: 'center', gap: '10px' },
  searchWrap: { display: 'flex', alignItems: 'center', gap: 8, background: '#f4f8f5', borderRadius: 50, padding: '9px 16px', border: '1.5px solid #e0ebe3', width: '260px', maxWidth: '60vw' },
  searchInput: { flex: 1, border: 'none', background: 'transparent', fontSize: 14, color: '#111', outline: 'none', fontFamily: 'inherit', minWidth: 0 },
  iconBtn: { width: '38px', height: '38px', borderRadius: '50%', border: '1.5px solid #e5eae6', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#5c6b60', flexShrink: 0 },
  tabs: { display: 'flex', gap: '8px', padding: '0 24px 14px', flexWrap: 'wrap' },
  tab: { padding: '8px 16px', borderRadius: '999px', border: '1.5px solid #e5eae6', background: '#fff', color: '#333', fontSize: '13px', fontWeight: '600', cursor: 'pointer', fontFamily: 'inherit' },
  tabActive: { background: '#1a7a4a', borderColor: '#1a7a4a', color: '#fff' },
  skeletonRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 24px', background: '#fff', borderBottom: '1px solid #f4f8f5' },
  skeletonAvatar: { width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(90deg,#e8f0eb 25%,#f4f8f5 50%,#e8f0eb 75%)', flexShrink: 0, animation: 'pulse 1.5s infinite' },
  skeletonLine: { height: '12px', borderRadius: '6px', background: 'linear-gradient(90deg,#e8f0eb 25%,#f4f8f5 50%,#e8f0eb 75%)', animation: 'pulse 1.5s infinite' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 24px', textAlign: 'center' },
  emptyIcon: { fontSize: '56px', marginBottom: '16px' },
  emptyTitle: { fontSize: '18px', fontWeight: '700', color: '#0f1410', marginBottom: '8px' },
  emptySub: { fontSize: '14px', color: '#888', marginBottom: '24px', lineHeight: '1.6' },
  browseBtn: { background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 24px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' },
  list: { paddingBottom: '8px' },
  chatRow: { display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 24px', borderBottom: '1px solid #f0f4f1', cursor: 'pointer', animation: 'fadeUp 0.3s ease both', transition: 'background 0.15s' },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: { width: '56px', height: '56px', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitial: { fontSize: '20px', fontWeight: '800', color: '#fff' },
  onlineDot: { position: 'absolute', bottom: '-2px', left: '-2px', width: '14px', height: '14px', borderRadius: '50%', background: '#22c55e', border: '2px solid #fff' },
  chatInfo: { flex: 1, minWidth: 0 },
  chatTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px', gap: '8px' },
  nameRow: { display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0 },
  chatName: { fontSize: '15px', fontWeight: '700', color: '#0f1410', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  chatTime: { fontSize: '11px', flexShrink: 0 },
  contextPill: { display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', flexWrap: 'nowrap', overflow: 'hidden' },
  contextBadge: { fontSize: '10px', fontWeight: '700', borderRadius: '6px', padding: '2px 6px', flexShrink: 0, whiteSpace: 'nowrap' },
  contextName: { fontSize: '11px', fontWeight: '700', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '160px' },
  contextSub: { fontSize: '11px', color: '#888', whiteSpace: 'nowrap', flexShrink: 0 },
  chatBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' },
  lastMsg: { fontSize: '13px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  offerLine: { fontSize: '13px', fontWeight: '800', color: '#1a7a4a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  rowActions: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px', marginLeft: '10px', flexShrink: 0 },
  actionIcons: { display: 'flex', alignItems: 'center', gap: '8px' },
  unreadBadge: { background: '#1a7a4a', color: '#fff', borderRadius: '10px', minWidth: '20px', height: '20px', fontSize: '10px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px' },
  starBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex' },
}