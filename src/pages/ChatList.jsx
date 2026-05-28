import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ChatList() {
  const navigate = useNavigate()
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [activeTab, setActiveTab] = useState('all')

  useEffect(() => { loadChats() }, [])

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
    // One row per (person × context). Context = service_id OR listing_id.
    // The same person asking about your listing AND booking your service = 2 rows
    // (genuinely different conversations).
    // Call-log messages with no context attach to the person's most-relevant
    // existing context, or create a direct row only if no other context exists.

    const convos = new Map() // key → convo object

    for (const msg of messages) {
      const otherId   = msg.from_user === user.id ? msg.to_user : msg.from_user
      const serviceId = msg.service_id || null
      const listingId = msg.listing_id || null
      const isCallLog = !!msg.call_type

      let key
      if (serviceId)      key = `svc:${otherId}:${serviceId}`
      else if (listingId) key = `lst:${otherId}:${listingId}`
      else                key = `dir:${otherId}`  // call logs / direct messages

      if (!convos.has(key)) {
        convos.set(key, {
          key,
          otherId,
          contextId:  serviceId || listingId || null,
          isService:  !!serviceId,
          isDirect:   !serviceId && !listingId,
          lastMsg:    msg,
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
      // Find any context row for the same person
      const contextKey = allKeys.find(
        ok => !ok.startsWith('dir:') && ok.includes(`:${c.otherId}:`)
      )
      if (contextKey) {
        // Merge: upgrade lastMsg on the context row if this call-log is newer
        const ctx = convos.get(contextKey)
        const dirTime = new Date(c.lastMsg.created_at)
        const ctxTime = new Date(ctx.lastMsg.created_at)
        if (dirTime > ctxTime && !c.lastMsg.call_type) {
          ctx.lastMsg = c.lastMsg
        }
        convos.delete(k)  // remove orphan direct row
      }
    }

    const conversations = [...convos.values()].map(c => ({
      ...c,
      lastMsg: c.lastRealMsg || c.lastMsg,
    }))

    // ── Enrich ───────────────────────────────────────────────────────────────
    const otherIds   = [...new Set(conversations.map(c => c.otherId))]
    const serviceIds = conversations.filter(c => c.isService && c.contextId).map(c => c.contextId)
    const listingIds = conversations.filter(c => !c.isService && c.contextId).map(c => c.contextId)

    const [{ data: profiles }, { data: services }, { data: listings }] = await Promise.all([
      // Use profiles table for real avatar + name (same as Profile.jsx)
      supabase.from('profiles').select('id,full_name,avatar_url,city').in('id', otherIds),
      serviceIds.length > 0
        ? supabase.from('services').select('id,name,category,rate,city,media_urls').in('id', serviceIds)
        : { data: [] },
      listingIds.length > 0
        ? supabase.from('listings').select('id,title,images,price').in('id', listingIds)
        : { data: [] },
    ])

    // Fallback: also load users table for name/email if profile has no full_name
    const { data: users } = await supabase.from('users').select('id,name,email').in('id', otherIds)

    const profilesMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    const usersMap    = Object.fromEntries((users    || []).map(u => [u.id, u]))
    const servicesMap = Object.fromEntries((services || []).map(s => [s.id, s]))
    const listingsMap = Object.fromEntries((listings || []).map(l => [l.id, l]))

    const enriched = await Promise.all(conversations.map(async c => {
      // Unread: count all unread from this person for this specific context
      let unreadQ = supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('from_user', c.otherId)
        .eq('to_user', user.id)
        .eq('read', false)
      if (c.isService && c.contextId)        unreadQ = unreadQ.eq('service_id', c.contextId)
      else if (!c.isService && c.contextId)  unreadQ = unreadQ.eq('listing_id', c.contextId)
      const { count } = await unreadQ

      const profile = profilesMap[c.otherId] || {}
      const userRow = usersMap[c.otherId] || {}
      // Best display name: profile.full_name > users.name > users.email > fallback
      const displayName = profile.full_name || userRow.name || userRow.email || 'User'
      const avatarUrl   = profile.avatar_url || null

      return {
        ...c,
        displayName,
        avatarUrl,
        service:  c.isService ? servicesMap[c.contextId] : null,
        listing:  !c.isService && c.contextId ? listingsMap[c.contextId] : null,
        unread:   count || 0,
      }
    }))

    enriched.sort((a, b) => new Date(b.lastMsg.created_at) - new Date(a.lastMsg.created_at))
    setChats(enriched)
    setLoading(false)
  }

  const SERVICE_CAT_ICONS = {
    'Plumbing': '🔧', 'Electrical': '⚡', 'Tutoring': '📚', 'Tailoring': '✂️',
    'Cleaning': '🧹', 'Photography': '📸', 'Hair & Beauty': '💇', 'Carpentry': '🪚',
    'Transport': '🚗', 'Tech & IT': '💻', 'Design': '🎨', 'Catering': '🍳',
  }

  const filtered = chats.filter(c => {
    if (activeTab === 'services') return c.isService
    if (activeTab === 'listings') return !c.isService && !c.isDirect
    return true
  })

  const totalUnread   = chats.reduce((sum, c) => sum + c.unread, 0)
  const serviceUnread = chats.filter(c => c.isService).reduce((sum, c) => sum + c.unread, 0)
  const listingUnread = chats.filter(c => !c.isService && !c.isDirect).reduce((sum, c) => sum + c.unread, 0)

  function renderLastMsg(chat) {
    const msg = chat.lastMsg
    const isMine = msg.from_user === currentUser?.id
    const prefix = isMine ? 'You: ' : ''
    if (msg.call_type) {
      const isVideo = msg.call_type === 'video'
      if (msg.call_status === 'missed') return prefix + (isVideo ? '📹 Missed video call' : '📞 Missed call')
      if (msg.call_status === 'ended')  return prefix + (isVideo ? '📹 Video call' : '📞 Voice call')
    }
    if (msg.media_type === 'image') return prefix + '📷 Photo'
    if (msg.media_type === 'video') return prefix + '🎥 Video'
    if (msg.media_type === 'audio') return prefix + '🎤 Voice note'
    if (!msg.body) return prefix + '📎 File'
    const text = msg.body.length > 45 ? msg.body.slice(0, 45) + '…' : msg.body
    return prefix + text
  }

  function timeLabel(date) {
    const d = new Date(date)
    const now = new Date()
    const diff = now - d
    if (diff < 60000) return 'now'
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm'
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    if (diff < 604800000) return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]
    return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
  }

  return (
    <div style={S.page}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerTop}>
          <div>
            <div style={S.headerTitle}>Messages</div>
            <div style={S.headerSub}>
              {chats.length} conversation{chats.length !== 1 ? 's' : ''}
              {totalUnread > 0 ? ` · ${totalUnread} unread` : ''}
            </div>
          </div>
          {totalUnread > 0 && <div style={S.totalBadge}>{totalUnread}</div>}
        </div>

        <div style={S.tabs}>
          <button style={{ ...S.tab, ...(activeTab === 'all'      ? S.tabActive : {}) }} onClick={() => setActiveTab('all')}>
            All {totalUnread > 0 && <span style={S.tabBadge}>{totalUnread}</span>}
          </button>
          <button style={{ ...S.tab, ...(activeTab === 'services' ? S.tabActive : {}) }} onClick={() => setActiveTab('services')}>
            🔧 Services {serviceUnread > 0 && <span style={S.tabBadge}>{serviceUnread}</span>}
          </button>
          <button style={{ ...S.tab, ...(activeTab === 'listings' ? S.tabActive : {}) }} onClick={() => setActiveTab('listings')}>
            🛍️ Listings {listingUnread > 0 && <span style={S.tabBadge}>{listingUnread}</span>}
          </button>
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
          <div style={S.emptyIcon}>{activeTab === 'services' ? '🔧' : activeTab === 'listings' ? '🛍️' : '💬'}</div>
          <p style={S.emptyTitle}>
            {activeTab === 'services' ? 'No service chats yet'
              : activeTab === 'listings' ? 'No listing chats yet'
              : 'No messages yet'}
          </p>
          <p style={S.emptySub}>
            {activeTab === 'services'
              ? 'Book a service and chat with the provider'
              : 'Chat with sellers when browsing listings'}
          </p>
          <button style={S.browseBtn} onClick={() => navigate(activeTab === 'services' ? '/services' : '/')}>
            {activeTab === 'services' ? 'Browse Services' : 'Browse Listings'}
          </button>
        </div>
      )}

      {/* Chat list */}
      <div style={S.list}>
        {filtered.map((chat, i) => renderChatRow(chat, i))}
      </div>

      {/* Bottom Nav */}
      <div style={S.nav}>
        <button style={S.navItem} onClick={() => navigate('/')}>
          <span style={S.navIcon}>🏠</span><span style={S.navLabel}>Home</span>
        </button>
        <button style={S.navItem} onClick={() => navigate('/jobs')}>
          <span style={S.navIcon}>💼</span><span style={S.navLabel}>Jobs</span>
        </button>
        <button style={S.navPost} onClick={() => navigate('/post')}>+</button>
        <button style={{ ...S.navItem }} onClick={() => navigate('/chats')}>
          <span style={S.navIcon}>💬</span><span style={S.navLabel}>Chats</span>
        </button>
        <button style={{ ...S.navItem, color: '#1a7a4a' }} onClick={() => navigate('/profile')}>
          <span style={S.navIcon}>👤</span>
          <span style={{ ...S.navLabel, color: '#1a7a4a', fontWeight: '700' }}>Me</span>
        </button>
      </div>
    </div>
  )

  function renderChatRow(chat, i) {
    const { isService, isDirect, service, listing, displayName, avatarUrl, unread: hasUnreadCount } = chat
    const hasUnread = hasUnreadCount > 0
    const catIcon   = isService ? (SERVICE_CAT_ICONS[service?.category] || '🔧') : null

    // Context label shown as subtitle pill
    const contextLabel = isService
      ? (service?.name || 'Service')
      : listing?.title || null
    const contextSub = isService
      ? [service?.rate, service?.city].filter(Boolean).join(' · ')
      : listing?.price ? 'MWK ' + Number(listing.price).toLocaleString() : ''

    // Context type badge color
    const ctxColor = isService ? '#1a7a4a' : '#2563eb'

    const chatPath = chat.contextId
      ? `/chat/${chat.otherId}/${chat.contextId}`
      : `/chat/${chat.otherId}`

    // Avatar: real profile photo > initials
    const initial = (displayName || 'U')[0].toUpperCase()

    return (
      <div
        key={chat.key}
        style={{ ...S.chatRow, animationDelay: i * 0.04 + 's', background: hasUnread ? '#fafffd' : '#fff' }}
        onClick={() => navigate(chatPath)}
      >
        {/* Avatar — real profile picture */}
        <div style={S.avatarWrap}>
          <div style={S.avatar}>
            {avatarUrl
              ? <img src={avatarUrl} alt="" style={S.avatarImg} />
              : (
                <span style={S.avatarInitial}>{initial}</span>
              )
            }
          </div>
          {/* Context type dot — only if not a bare direct chat */}
          {!isDirect && (
            <div style={{ ...S.typeDot, background: ctxColor }}>
              <span style={{ fontSize: '8px', lineHeight: 1 }}>{isService ? catIcon : '🛍️'}</span>
            </div>
          )}
        </div>

        <div style={S.chatInfo}>
          <div style={S.chatTop}>
            <div style={S.chatName}>{displayName}</div>
            <div style={{ ...S.chatTime, color: hasUnread ? '#1a7a4a' : '#bbb', fontWeight: hasUnread ? '700' : '400' }}>
              {timeLabel(chat.lastMsg.created_at)}
            </div>
          </div>

          {/* Service name or listing title — clearly labelled */}
          {contextLabel && (
            <div style={S.contextPill}>
              <div style={{ ...S.contextBadge, background: isService ? '#e6f7ee' : '#eff6ff', color: ctxColor }}>
                {isService ? '🔧' : '🛍️'} {isService ? 'Service' : 'Listing'}
              </div>
              <span style={S.contextName}>{contextLabel}</span>
              {contextSub ? <span style={S.contextSub}> · {contextSub}</span> : null}
            </div>
          )}

          <div style={S.chatBottom}>
            <span style={{ ...S.lastMsg, fontWeight: hasUnread ? '600' : '400', color: hasUnread ? '#0f1410' : '#888' }}>
              {renderLastMsg(chat)}
            </span>
            {hasUnread && (
              <span style={S.unreadBadge}>{hasUnreadCount > 9 ? '9+' : hasUnreadCount}</span>
            )}
          </div>
        </div>
      </div>
    )
  }
}

const S = {
  page: { minHeight: '100vh', background: '#f4f8f5', paddingBottom: '80px', fontFamily: 'system-ui, sans-serif' },
  header: { background: '#fff', borderBottom: '1px solid #e8f0eb', boxShadow: '0 2px 8px rgba(0,0,0,0.04)', position: 'sticky', top: 0, zIndex: 50 },
  headerTop: { padding: '16px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  headerTitle: { fontSize: '22px', fontWeight: '800', color: '#0f1410' },
  headerSub: { fontSize: '12px', color: '#888', marginTop: '2px' },
  totalBadge: { background: '#e74c3c', color: '#fff', borderRadius: '50%', width: '26px', height: '26px', fontSize: '12px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  tabs: { display: 'flex', padding: '0 14px', gap: '4px', borderBottom: '1px solid #f0f0f0' },
  tab: { flex: 1, background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '10px 4px', fontSize: '13px', fontWeight: '600', color: '#888', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontFamily: 'inherit' },
  tabActive: { color: '#1a7a4a', borderBottomColor: '#1a7a4a' },
  tabBadge: { background: '#e74c3c', color: '#fff', borderRadius: '10px', padding: '1px 6px', fontSize: '10px', fontWeight: '800' },
  skeletonRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px', background: '#fff', borderBottom: '1px solid #f4f8f5' },
  skeletonAvatar: { width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(90deg,#e8f0eb 25%,#f4f8f5 50%,#e8f0eb 75%)', flexShrink: 0, animation: 'pulse 1.5s infinite' },
  skeletonLine: { height: '12px', borderRadius: '6px', background: 'linear-gradient(90deg,#e8f0eb 25%,#f4f8f5 50%,#e8f0eb 75%)', animation: 'pulse 1.5s infinite' },
  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 24px', textAlign: 'center' },
  emptyIcon: { fontSize: '56px', marginBottom: '16px' },
  emptyTitle: { fontSize: '18px', fontWeight: '700', color: '#0f1410', marginBottom: '8px' },
  emptySub: { fontSize: '14px', color: '#888', marginBottom: '24px', lineHeight: '1.6' },
  browseBtn: { background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '10px', padding: '12px 24px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' },
  list: { paddingBottom: '8px' },
  chatRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #f0f4f1', cursor: 'pointer', animation: 'fadeUp 0.3s ease both', transition: 'background 0.15s' },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: { width: '52px', height: '52px', borderRadius: '50%', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitial: { fontSize: '20px', fontWeight: '800', color: '#fff' },
  typeDot: { position: 'absolute', bottom: 0, right: 0, width: '20px', height: '20px', borderRadius: '50%', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  chatInfo: { flex: 1, minWidth: 0 },
  chatTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' },
  chatName: { fontSize: '15px', fontWeight: '700', color: '#0f1410' },
  chatTime: { fontSize: '11px', flexShrink: 0, marginLeft: '8px' },
  contextPill: { display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '4px', flexWrap: 'nowrap', overflow: 'hidden' },
  contextBadge: { fontSize: '10px', fontWeight: '700', borderRadius: '6px', padding: '2px 6px', flexShrink: 0, whiteSpace: 'nowrap' },
  contextName: { fontSize: '11px', fontWeight: '700', color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '130px' },
  contextSub: { fontSize: '11px', color: '#888', whiteSpace: 'nowrap', flexShrink: 0 },
  chatBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  lastMsg: { fontSize: '13px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 },
  unreadBadge: { background: '#1a7a4a', color: '#fff', borderRadius: '10px', minWidth: '20px', height: '20px', fontSize: '10px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '8px', padding: '0 5px' },
  nav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: '#fff', borderTop: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 0', zIndex: 100 },
  navItem: { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' },
  navIcon: { fontSize: '20px' },
  navLabel: { fontSize: '10px', color: '#888' },
  navPost: { width: '48px', height: '48px', background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '50%', fontSize: '24px', cursor: 'pointer', marginTop: '-16px', boxShadow: '0 3px 10px rgba(26,122,74,0.4)' },
}