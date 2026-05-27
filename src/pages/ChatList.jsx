import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ChatList() {
  const navigate = useNavigate()
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [activeTab, setActiveTab] = useState('all') // all | services | listings

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

    // ── Deduplication logic ──────────────────────────────────────────────────
    // The key must be stable regardless of whether a message has listing_id set.
    // Rule:
    //   • Service chats  → keyed by otherId + service_id  (service_id is always present)
    //   • Listing chats  → keyed by otherId + listing_id  (use the first non-null listing_id seen)
    //   • Direct chats   → keyed by otherId alone
    //
    // We also skip call-log messages (call_type set) when picking the representative
    // message for a conversation — they're noise. But they still count as part of
    // the conversation so they don't need to create a new entry.

    // First pass: collect the best (latest real) message and the context for each convo
    const convos = new Map() // key → { otherId, contextId, isService, lastMsg }

    for (const msg of messages) {
      const otherId = msg.from_user === user.id ? msg.to_user : msg.from_user
      const serviceId = msg.service_id || null
      const listingId = msg.listing_id || null

      // Determine the canonical key
      let key
      if (serviceId) {
        key = `svc:${otherId}:${serviceId}`
      } else if (listingId) {
        key = `lst:${otherId}:${listingId}`
      } else {
        // Direct chat or call log with no context — group under the person
        key = `dir:${otherId}`
      }

      if (!convos.has(key)) {
        convos.set(key, {
          otherId,
          contextId: serviceId || listingId || null,
          isService: !!serviceId,
          lastMsg: msg,  // messages are ordered desc so first seen = latest
        })
      } else {
        // Already have this convo. If the existing lastMsg is a call log and
        // this one is a real message, upgrade it so the preview looks better.
        const existing = convos.get(key)
        if (existing.lastMsg.call_type && !msg.call_type) {
          existing.lastMsg = msg
        }
        // Also fill in contextId if we now see one and didn't before
        if (!existing.contextId && (serviceId || listingId)) {
          existing.contextId = serviceId || listingId
          existing.isService = !!serviceId
        }
      }
    }

    const conversations = [...convos.values()]

    // ── Enrich with user / service / listing data ────────────────────────────
    const otherIds    = [...new Set(conversations.map(c => c.otherId))]
    const serviceIds  = conversations.filter(c => c.isService && c.contextId).map(c => c.contextId)
    const listingIds  = conversations.filter(c => !c.isService && c.contextId).map(c => c.contextId)

    const [{ data: users }, { data: services }, { data: listings }] = await Promise.all([
      supabase.from('users').select('*').in('id', otherIds),
      serviceIds.length > 0
        ? supabase.from('services').select('id,name,category,rate,city,media_urls').in('id', serviceIds)
        : { data: [] },
      listingIds.length > 0
        ? supabase.from('listings').select('id,title,images,price').in('id', listingIds)
        : { data: [] },
    ])

    const usersMap    = Object.fromEntries((users    || []).map(u => [u.id, u]))
    const servicesMap = Object.fromEntries((services || []).map(s => [s.id, s]))
    const listingsMap = Object.fromEntries((listings || []).map(l => [l.id, l]))

    const enriched = await Promise.all(conversations.map(async c => {
      let unreadQuery = supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('from_user', c.otherId)
        .eq('to_user', user.id)
        .eq('read', false)

      if (c.isService && c.contextId) {
        unreadQuery = unreadQuery.eq('service_id', c.contextId)
      } else if (c.contextId) {
        unreadQuery = unreadQuery.eq('listing_id', c.contextId)
      }

      const { count } = await unreadQuery

      return {
        ...c,
        otherUser: usersMap[c.otherId],
        service:   c.isService ? servicesMap[c.contextId] : null,
        listing:   !c.isService && c.contextId ? listingsMap[c.contextId] : null,
        unread:    count || 0,
      }
    }))

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
    if (activeTab === 'listings') return !c.isService && c.contextId  // exclude direct chats from listings tab
    return true
  })

  const totalUnread   = chats.reduce((sum, c) => sum + c.unread, 0)
  const serviceUnread = chats.filter(c => c.isService).reduce((sum, c) => sum + c.unread, 0)
  const listingUnread = chats.filter(c => !c.isService && c.contextId).reduce((sum, c) => sum + c.unread, 0)

  function renderLastMsg(chat) {
    const msg = chat.lastMsg
    const isMine = msg.from_user === currentUser?.id
    const prefix = isMine ? 'You: ' : ''
    if (msg.call_type) {
      const isVideo = msg.call_type === 'video'
      if (msg.call_status === 'missed') return prefix + (isVideo ? '📹 Missed video call' : '📞 Missed call')
      if (msg.call_status === 'ended') return prefix + (isVideo ? '📹 Video call' : '📞 Voice call')
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
            <div style={S.headerSub}>{chats.length} conversation{chats.length !== 1 ? 's' : ''}{totalUnread > 0 ? ` · ${totalUnread} unread` : ''}</div>
          </div>
          {totalUnread > 0 && <div style={S.totalBadge}>{totalUnread}</div>}
        </div>

        {/* Tabs */}
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
                <div style={{ ...S.skeletonLine, width: '60%', marginBottom: '8px' }} />
                <div style={{ ...S.skeletonLine, width: '85%' }} />
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
            {activeTab === 'services' ? 'No service chats yet' : activeTab === 'listings' ? 'No listing chats yet' : 'No messages yet'}
          </p>
          <p style={S.emptySub}>
            {activeTab === 'services' ? 'Book a service and chat with the provider' : 'Chat with sellers when browsing listings'}
          </p>
          <button style={S.browseBtn} onClick={() => navigate(activeTab === 'services' ? '/services' : '/')}>
            {activeTab === 'services' ? 'Browse Services' : 'Browse Listings'}
          </button>
        </div>
      )}

      {/* Chat list */}
      <div style={S.list}>
        {activeTab === 'all' && chats.some(c => c.isService) && chats.some(c => !c.isService) ? (
          <>
            {chats.filter(c => c.isService).length > 0 && (
              <>
                <div style={S.sectionHeader}>
                  <span style={S.sectionHeaderText}>🔧 Service Chats</span>
                  <span style={S.sectionCount}>{chats.filter(c => c.isService).length}</span>
                </div>
                {chats.filter(c => c.isService).map((chat, i) => renderChatRow(chat, i))}
                <div style={S.sectionDivider} />
                <div style={S.sectionHeader}>
                  <span style={S.sectionHeaderText}>🛍️ Listing Chats</span>
                  <span style={S.sectionCount}>{chats.filter(c => !c.isService).length}</span>
                </div>
                {chats.filter(c => !c.isService).map((chat, i) => renderChatRow(chat, i))}
              </>
            )}
          </>
        ) : (
          filtered.map((chat, i) => renderChatRow(chat, i))
        )}
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
        <button style={{ ...S.navItem, color: '#1a7a4a' }} onClick={() => navigate('/chats')}>
          <span style={S.navIcon}>💬</span>
          <span style={{ ...S.navLabel, color: '#1a7a4a', fontWeight: '700' }}>Chats</span>
        </button>
        <button style={S.navItem} onClick={() => navigate('/profile')}>
          <span style={S.navIcon}>👤</span><span style={S.navLabel}>Me</span>
        </button>
      </div>
    </div>
  )

  function renderChatRow(chat, i) {
    const isService = chat.isService
    const catIcon = isService ? (SERVICE_CAT_ICONS[chat.service?.category] || '🔧') : null
    const hasUnread = chat.unread > 0
    const contextLabel = isService
      ? (chat.service?.name || 'Service')
      : (chat.listing?.title || (chat.contextId ? 'Listing' : 'Direct message'))
    const contextSub = isService
      ? (chat.service?.rate ? chat.service.rate + ' · ' + (chat.service.city || '') : chat.service?.city || '')
      : (chat.listing?.price ? 'MWK ' + Number(chat.listing.price).toLocaleString() : '')

    const avatarImg = isService && chat.service?.media_urls?.[0]
    const listingImg = !isService && chat.listing?.images?.[0]

    // Navigate to chat — use contextId if present, else just the user
    const chatPath = chat.contextId
      ? `/chat/${chat.otherId}/${chat.contextId}`
      : `/chat/${chat.otherId}`

    return (
      <div
        key={`${chat.otherId}_${chat.contextId || 'direct'}`}
        style={{ ...S.chatRow, animationDelay: i * 0.04 + 's', background: hasUnread ? '#fafffd' : '#fff' }}
        onClick={() => navigate(chatPath)}
      >
        {/* Avatar */}
        <div style={S.avatarWrap}>
          <div style={{ ...S.avatar, background: isService ? '#0f1410' : 'linear-gradient(135deg,#1a7a4a,#22a05e)' }}>
            {avatarImg ? (
              <img src={avatarImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : listingImg ? (
              <img src={listingImg} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              <span style={{ fontSize: '18px', fontWeight: '800', color: '#fff' }}>
                {(chat.otherUser?.name || 'U')[0].toUpperCase()}
              </span>
            )}
          </div>
          <div style={{ ...S.typeDot, background: isService ? '#1a7a4a' : '#2980b9' }}>
            {isService ? catIcon : '🛍️'}
          </div>
        </div>

        <div style={S.chatInfo}>
          <div style={S.chatTop}>
            <div style={S.chatName}>{chat.otherUser?.name || 'User'}</div>
            <div style={{ ...S.chatTime, color: hasUnread ? '#1a7a4a' : '#bbb', fontWeight: hasUnread ? '700' : '400' }}>
              {timeLabel(chat.lastMsg.created_at)}
            </div>
          </div>

          {chat.contextId && (
            <div style={S.contextPill}>
              <span style={{ ...S.contextPillDot, background: isService ? '#1a7a4a' : '#2980b9' }} />
              <span style={S.contextPillText}>{contextLabel}</span>
              {contextSub ? <span style={S.contextPillSub}> · {contextSub}</span> : null}
            </div>
          )}

          <div style={S.chatBottom}>
            <span style={{ ...S.lastMsg, fontWeight: hasUnread ? '600' : '400', color: hasUnread ? '#0f1410' : '#888' }}>
              {renderLastMsg(chat)}
            </span>
            {hasUnread && (
              <span style={S.unreadBadge}>{chat.unread > 9 ? '9+' : chat.unread}</span>
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
  tabs: { display: 'flex', padding: '0 14px', gap: '4px', paddingBottom: '0', borderBottom: '1px solid #f0f0f0' },
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
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px 6px', background: '#f4f8f5' },
  sectionHeaderText: { fontSize: '12px', fontWeight: '800', color: '#637068', textTransform: 'uppercase', letterSpacing: '0.5px' },
  sectionCount: { background: '#e6f7ee', color: '#1a7a4a', borderRadius: '10px', padding: '2px 8px', fontSize: '11px', fontWeight: '700' },
  sectionDivider: { height: '8px', background: '#f4f8f5' },
  chatRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', borderBottom: '1px solid #f0f4f1', cursor: 'pointer', animation: 'fadeUp 0.3s ease both', transition: 'background 0.15s' },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: { width: '52px', height: '52px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' },
  typeDot: { position: 'absolute', bottom: '0px', right: '0px', width: '18px', height: '18px', borderRadius: '50%', border: '2px solid #fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px' },
  chatInfo: { flex: 1, minWidth: 0 },
  chatTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' },
  chatName: { fontSize: '15px', fontWeight: '700', color: '#0f1410' },
  chatTime: { fontSize: '11px', flexShrink: 0, marginLeft: '8px' },
  contextPill: { display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '4px' },
  contextPillDot: { width: '6px', height: '6px', borderRadius: '50%', flexShrink: 0 },
  contextPillText: { fontSize: '11px', fontWeight: '700', color: '#1a7a4a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '120px' },
  contextPillSub: { fontSize: '11px', color: '#888', whiteSpace: 'nowrap' },
  chatBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  lastMsg: { fontSize: '13px', color: '#888', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 },
  unreadBadge: { background: '#1a7a4a', color: '#fff', borderRadius: '10px', minWidth: '20px', height: '20px', fontSize: '10px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: '8px', padding: '0 5px' },
  nav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: '#fff', borderTop: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 0', zIndex: 100 },
  navItem: { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' },
  navIcon: { fontSize: '20px' },
  navLabel: { fontSize: '10px', color: '#888' },
  navPost: { width: '48px', height: '48px', background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '50%', fontSize: '24px', cursor: 'pointer', marginTop: '-16px', boxShadow: '0 3px 10px rgba(26,122,74,0.4)' },
}