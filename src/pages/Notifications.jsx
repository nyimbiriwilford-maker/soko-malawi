import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

// ── Notification type config ─────────────────────────────────────────────────
const NOTIF_CONFIG = {
  // Messages
  new_message:     { icon: '💬', color: '#2563eb', bg: '#eff6ff', label: 'Message' },
  // Calls
  missed_call:     { icon: '📞', color: '#ef4444', bg: '#fef2f2', label: 'Missed Call' },
  missed_video:    { icon: '📹', color: '#ef4444', bg: '#fef2f2', label: 'Missed Video' },
  // Listings
  listing_offer:   { icon: '💰', color: '#d97706', bg: '#fffbeb', label: 'Offer' },
  listing_view:    { icon: '👁️',  color: '#7c3aed', bg: '#f5f3ff', label: 'View' },
  listing_comment: { icon: '💬', color: '#0891b2', bg: '#ecfeff', label: 'Comment' },
  listing_sold:    { icon: '🎉', color: '#1a7a4a', bg: '#f0fdf4', label: 'Sold' },
  listing_liked:   { icon: '❤️', color: '#db2777', bg: '#fdf2f8', label: 'Liked' },
  // Bookings / services
  booking_request: { icon: '📅', color: '#1a7a4a', bg: '#f0fdf4', label: 'Booking' },
  booking_confirmed:{ icon: '✅', color: '#1a7a4a', bg: '#f0fdf4', label: 'Confirmed' },
  booking_cancelled:{ icon: '❌', color: '#dc2626', bg: '#fef2f2', label: 'Cancelled' },
  booking_completed:{ icon: '🏁', color: '#6366f1', bg: '#eef2ff', label: 'Completed' },
  // Fallback
  default:         { icon: '🔔', color: '#1a7a4a', bg: '#f0fdf4', label: 'Notification' },
}

function getConfig(type) {
  return NOTIF_CONFIG[type] || NOTIF_CONFIG.default
}

function timeLabel(date) {
  const d = new Date(date)
  const now = new Date()
  const diff = now - d
  if (diff < 60000)    return 'just now'
  if (diff < 3600000)  return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (diff < 604800000)return ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][d.getDay()]
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' })
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

// ── Tab config ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'all',      label: 'All',      icon: '🔔' },
  { id: 'messages', label: 'Messages', icon: '💬' },
  { id: 'calls',    label: 'Calls',    icon: '📞' },
  { id: 'listings', label: 'Listings', icon: '🛍️' },
]

function filterByTab(notifs, tab) {
  if (tab === 'all') return notifs
  if (tab === 'messages') return notifs.filter(n => n.type === 'new_message')
  if (tab === 'calls')    return notifs.filter(n => ['missed_call','missed_video'].includes(n.type))
  if (tab === 'listings') return notifs.filter(n =>
    ['listing_offer','listing_view','listing_comment','listing_sold','listing_liked'].includes(n.type)
  )
  return notifs
}
function NotifIcon({ notif, cfg }) {
  const [avatar, setAvatar] = useState(null)
  const senderId = notif.data?.sender_id || notif.data?.caller_id

  useEffect(() => {
    if (!senderId) return
    supabase.from('profiles').select('avatar_url, full_name')
      .eq('id', senderId).maybeSingle()
      .then(({ data }) => { if (data?.avatar_url) setAvatar(data) })
  }, [senderId])

  if (avatar?.avatar_url) {
    return (
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <img
          src={avatar.avatar_url}
          alt={avatar.full_name}
          style={{ width: 46, height: 46, borderRadius: 14, objectFit: 'cover' }}
        />
        <div style={{
          position: 'absolute', bottom: -3, right: -3,
          background: cfg.bg, borderRadius: '50%',
          width: 20, height: 20,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          border: '2px solid #fff', fontSize: 11,
        }}>
          {cfg.icon}
        </div>
      </div>
    )
  }

  return (
    <div style={{ ...S.iconWrap, background: cfg.bg }}>
      <span style={{ fontSize: 20, lineHeight: 1 }}>{cfg.icon}</span>
    </div>
  )
}
export default function Notifications() {
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading]             = useState(true)
  const [activeTab, setActiveTab]         = useState('all')
  const [user, setUser]                   = useState(null)

  useEffect(() => { loadNotifications() }, [])

  async function loadNotifications() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }
    setUser(user)

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    if (!error) setNotifications(data || [])
    setLoading(false)

    // Mark all as read
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false)
  }

  async function markAllRead() {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user?.id)
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
  }

  async function deleteNotification(id) {
    await supabase.from('notifications').delete().eq('id', id)
    setNotifications(prev => prev.filter(n => n.id !== id))
  }

  function handleNotifClick(notif) {
    // Mark as read
    if (!notif.read) {
      supabase.from('notifications').update({ read: true }).eq('id', notif.id)
      setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, read: true } : n))
    }

    // Navigate based on type + data
    const data = notif.data || {}
    switch (notif.type) {
      case 'new_message':
        if (data.sender_id && data.context_id) {
          navigate(`/chat/${data.sender_id}/${data.context_id}`, {
            state: { scrollToMessageId: data.message_id }
          })
        } else if (data.sender_id) {
          navigate(`/chat/${data.sender_id}`, {
            state: { scrollToMessageId: data.message_id }
          })
        } else navigate('/chats')
        break
      case 'missed_call':
      case 'missed_video':
        if (data.caller_id && data.context_id) {
          navigate(`/chat/${data.caller_id}/${data.context_id}`, {
            state: { scrollToMessageId: data.message_id }
          })
        } else if (data.caller_id) {
          navigate(`/chat/${data.caller_id}`, {
            state: { scrollToMessageId: data.message_id }
          })
        } else navigate('/chats')
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
      default:
        break
    }
  }

  const filtered  = filterByTab(notifications, activeTab)
  const grouped   = groupByDate(filtered)
  const unreadCount = notifications.filter(n => !n.read).length

  return (
    <div style={S.page}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse  { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes shimmer{ 0%{background-position:-400px 0} 100%{background-position:400px 0} }
        .notif-row { transition: background 0.15s; }
        .notif-row:active { background: #f0f4f1 !important; }
        .delete-btn { opacity: 0; transition: opacity 0.15s; }
        .notif-row:hover .delete-btn { opacity: 1; }
      `}</style>

      {/* ── Header ── */}
      <div style={S.header}>
        <div style={S.headerTop}>
          <button style={S.backBtn} onClick={() => navigate(-1)}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2.5" strokeLinecap="round">
              <path d="M19 12H5M12 5l-7 7 7 7"/>
            </svg>
          </button>
          <div>
            <div style={S.headerTitle}>Notifications</div>
            {unreadCount > 0 && (
              <div style={S.headerSub}>{unreadCount} unread</div>
            )}
          </div>
          {unreadCount > 0 && (
            <button style={S.markAllBtn} onClick={markAllRead}>
              Mark all read
            </button>
          )}
        </div>

        {/* Tabs */}
        <div style={S.tabs}>
          {TABS.map(tab => {
            const count = tab.id === 'all'
              ? notifications.filter(n => !n.read).length
              : filterByTab(notifications, tab.id).filter(n => !n.read).length
            return (
              <button
                key={tab.id}
                style={{ ...S.tab, ...(activeTab === tab.id ? S.tabActive : {}) }}
                onClick={() => setActiveTab(tab.id)}
              >
                <span>{tab.icon}</span>
                <span>{tab.label}</span>
                {count > 0 && <span style={S.tabBadge}>{count}</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Loading ── */}
      {loading && (
        <div style={{ padding: '8px 0' }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={S.skeletonRow}>
              <div style={S.skeletonIcon} />
              <div style={{ flex: 1 }}>
                <div style={{ ...S.skeletonLine, width: '60%', marginBottom: 8 }} />
                <div style={{ ...S.skeletonLine, width: '85%' }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Empty ── */}
      {!loading && filtered.length === 0 && (
        <div style={S.empty}>
          <div style={S.emptyIcon}>
            {activeTab === 'calls' ? '📞' : activeTab === 'messages' ? '💬' : activeTab === 'listings' ? '🛍️' : '🔔'}
          </div>
          <p style={S.emptyTitle}>No notifications yet</p>
          <p style={S.emptySub}>
            {activeTab === 'calls'    ? 'Missed calls will appear here'
           : activeTab === 'messages' ? 'New messages will appear here'
           : activeTab === 'listings' ? 'Listing activity will appear here'
           : "You're all caught up!"}
          </p>
        </div>
      )}

      {/* ── Notification groups ── */}
      {!loading && Object.entries(grouped).map(([dateLabel, notifs]) => (
        <div key={dateLabel}>
          <div style={S.dateHeader}>{dateLabel}</div>
          {notifs.map((notif, i) => {
            const cfg = getConfig(notif.type)
            const data = notif.data || {}
            return (
              <div
                key={notif.id}
                className="notif-row"
                style={{
                  ...S.notifRow,
                  background: notif.read ? '#fff' : '#f0fdf7',
                  animationDelay: `${i * 0.03}s`,
                }}
                onClick={() => handleNotifClick(notif)}
              >
                {/* Unread dot */}
                {!notif.read && <div style={S.unreadDot} />}

               {/* Icon */}
<NotifIcon notif={notif} cfg={cfg} />

                {/* Content */}
                <div style={S.notifContent}>
                  <div style={S.notifTop}>
                    <span style={{ ...S.typeBadge, color: cfg.color, background: cfg.bg }}>
                      {cfg.label}
                    </span>
                    <span style={S.notifTime}>{timeLabel(notif.created_at)}</span>
                  </div>

                  {/* Title */}
                  {notif.title && (
                    <div style={{ ...S.notifTitle, fontWeight: notif.read ? '600' : '800' }}>
                      {notif.title}
                    </div>
                  )}

                  {/* Body / smart preview */}
                  <div style={{ ...S.notifBody, color: notif.read ? '#888' : '#444' }}>
                    {notif.body || notif.message || renderSmartBody(notif)}
                  </div>

                  {/* Context thumbnail if listing */}
                  {data.listing_image && (
                    <div style={S.listingThumbRow}>
                      <img src={data.listing_image} alt="" style={S.listingThumb} />
                      {data.listing_title && (
                        <span style={S.listingThumbTitle}>{data.listing_title}</span>
                      )}
                    </div>
                  )}

                  {/* Offer amount if present */}
                  {data.offer_amount && (
                    <div style={S.offerChip}>
                      💰 MWK {Number(data.offer_amount).toLocaleString()}
                    </div>
                  )}
                </div>

                {/* Delete button */}
                <button
                  className="delete-btn"
                  style={S.deleteBtn}
                  onClick={e => { e.stopPropagation(); deleteNotification(notif.id) }}
                  title="Dismiss"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            )
          })}
        </div>
      ))}

      <div style={{ height: 90 }} />
      <BottomNav />
    </div>
  )
}

// ── Smart body fallback ───────────────────────────────────────────────────────
function renderSmartBody(notif) {
  const data = notif.data || {}
  const name = data.sender_name || data.caller_name || data.buyer_name || 'Someone'

  switch (notif.type) {
    case 'new_message':
      return `${name} sent you a message${data.listing_title ? ` about "${data.listing_title}"` : ''}`
    case 'missed_call':
      return `You missed a voice call from ${name}`
    case 'missed_video':
      return `You missed a video call from ${name}`
    case 'listing_offer':
      return `${name} made an offer${data.listing_title ? ` on "${data.listing_title}"` : ''}`
    case 'listing_view':
      return `${data.views || 'Someone'} viewed your listing${data.listing_title ? ` "${data.listing_title}"` : ''}`
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
    default:
      return 'Tap to view details'
  }
}

// ── Styles ────────────────────────────────────────────────────────────────────
const S = {
  page: {
    minHeight: '100vh',
    background: '#f4f8f5',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    paddingBottom: 90,
  },
  header: {
    background: '#fff',
    borderBottom: '1px solid #e8f0eb',
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
    position: 'sticky',
    top: 0,
    zIndex: 50,
  },
  headerTop: {
    padding: '12px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  backBtn: {
    background: '#f0f4f1',
    border: 'none',
    borderRadius: '50%',
    width: 36, height: 36,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 800,
    color: '#0f1410',
    lineHeight: 1.2,
  },
  headerSub: {
    fontSize: 12,
    color: '#1a7a4a',
    fontWeight: 600,
    marginTop: 1,
  },
  markAllBtn: {
    marginLeft: 'auto',
    background: 'none',
    border: '1.5px solid #1a7a4a',
    borderRadius: 20,
    padding: '5px 12px',
    fontSize: 12,
    fontWeight: 700,
    color: '#1a7a4a',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    flexShrink: 0,
  },
  tabs: {
    display: 'flex',
    padding: '0 12px',
    gap: 2,
    borderTop: '1px solid #f0f5f1',
    overflowX: 'auto',
    scrollbarWidth: 'none',
  },
  tab: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    background: 'none',
    border: 'none',
    borderBottom: '2px solid transparent',
    padding: '10px 10px',
    fontSize: 12.5,
    fontWeight: 600,
    color: '#888',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    flexShrink: 0,
  },
  tabActive: {
    color: '#1a7a4a',
    borderBottomColor: '#1a7a4a',
  },
  tabBadge: {
    background: '#ef4444',
    color: '#fff',
    borderRadius: 10,
    padding: '1px 6px',
    fontSize: 10,
    fontWeight: 800,
  },

  // ── Skeleton ──
  skeletonRow: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '14px 16px', background: '#fff',
    borderBottom: '1px solid #f4f8f5',
  },
  skeletonIcon: {
    width: 46, height: 46, borderRadius: 14,
    background: 'linear-gradient(90deg,#e8f0eb 25%,#f4f8f5 50%,#e8f0eb 75%)',
    backgroundSize: '400px 100%',
    animation: 'shimmer 1.4s infinite, pulse 1.5s infinite',
    flexShrink: 0,
  },
  skeletonLine: {
    height: 12, borderRadius: 6,
    background: 'linear-gradient(90deg,#e8f0eb 25%,#f4f8f5 50%,#e8f0eb 75%)',
    animation: 'pulse 1.5s infinite',
  },

  // ── Empty ──
  empty: {
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', padding: '80px 24px',
    textAlign: 'center',
  },
  emptyIcon: { fontSize: 56, marginBottom: 16 },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: '#0f1410', marginBottom: 8 },
  emptySub: { fontSize: 14, color: '#888', lineHeight: 1.6 },

  // ── Date header ──
  dateHeader: {
    fontSize: 11,
    fontWeight: 800,
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: '0.8px',
    padding: '14px 16px 6px',
  },

  // ── Notification row ──
  notifRow: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '13px 16px',
    borderBottom: '1px solid #f0f4f1',
    cursor: 'pointer',
    position: 'relative',
    animation: 'fadeUp 0.3s ease both',
  },
  unreadDot: {
    position: 'absolute',
    left: 6, top: '50%',
    transform: 'translateY(-50%)',
    width: 6, height: 6,
    borderRadius: '50%',
    background: '#1a7a4a',
    flexShrink: 0,
  },
  iconWrap: {
    width: 46, height: 46,
    borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  notifContent: {
    flex: 1, minWidth: 0,
  },
  notifTop: {
    display: 'flex', alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  typeBadge: {
    fontSize: 10,
    fontWeight: 800,
    borderRadius: 6,
    padding: '2px 7px',
    letterSpacing: '0.3px',
  },
  notifTime: {
    fontSize: 11,
    color: '#bbb',
    fontWeight: 500,
    flexShrink: 0,
    marginLeft: 8,
  },
  notifTitle: {
    fontSize: 14,
    color: '#0f1410',
    lineHeight: 1.3,
    marginBottom: 2,
  },
  notifBody: {
    fontSize: 13,
    lineHeight: 1.5,
    color: '#888',
  },
  listingThumbRow: {
    display: 'flex', alignItems: 'center', gap: 8,
    marginTop: 8,
    background: '#f8fbf9',
    borderRadius: 10,
    padding: '6px 8px',
  },
  listingThumb: {
    width: 36, height: 36,
    borderRadius: 8,
    objectFit: 'cover',
    flexShrink: 0,
    border: '1px solid #e0ebe3',
  },
  listingThumbTitle: {
    fontSize: 12, fontWeight: 600, color: '#333',
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
    maxWidth: 160,
  },
  offerChip: {
    display: 'inline-flex',
    alignItems: 'center',
    marginTop: 6,
    background: '#fffbeb',
    border: '1px solid #fcd34d',
    borderRadius: 8,
    padding: '3px 10px',
    fontSize: 12,
    fontWeight: 700,
    color: '#d97706',
  },
  deleteBtn: {
    background: '#f4f8f5',
    border: 'none',
    borderRadius: '50%',
    width: 28, height: 28,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer',
    color: '#aaa',
    flexShrink: 0,
    alignSelf: 'center',
  },
}