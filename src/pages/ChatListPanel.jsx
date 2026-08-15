import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  sourceFromMessage,
  contextIdFromMessage,
  conversationKey,
  sourceMeta,
  buildChatPath,
  CHAT_SOURCES,
  loadDeletedChatKeys,
  markChatDeleted,
} from '../utils/chatSources'
import SafeAvatar from '../components/SafeAvatar'
import { watchUserOnline, activityTargetsChat } from '../hooks/usePresence'
import { parseOfferMessage, formatOfferAmount } from '../utils/offerMessage'

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
  // Status-viewer replies: show caption + user reply in chat list
  const statusMatch = String(body).match(/^\[\[status_reply:([a-f0-9-]+)\]\]\s*([\s\S]*)$/i)
  if (statusMatch) {
    const rest = statusMatch[2] || ''
    const parts = rest.split(/\n*— replied on your status\s*/i)
    const userText = (parts[0] || '').trim()
    const meta = (parts[1] || '').trim()
    const statusLine = meta.split('\n').find(l => /^Status:/i.test(l)) || ''
    const caption = statusLine.replace(/^Status:\s*/i, '').replace(/^[“"']|[”"']$/g, '').trim()
    const label = caption
      ? `Status: ${caption.slice(0, 40)}${caption.length > 40 ? '…' : ''}`
      : 'Status reply'
    return {
      body: userText ? `${label} · ${userText}` : label,
      replyPreview: label,
      replyToId: statusMatch[1],
    }
  }
  if (BARE_UUID_RE.test(body.trim())) {
    return { body: '', replyPreview: null, replyToId: body.trim().replace(/\]$/, '') }
  }
  return { body, replyPreview: null, replyToId: null }
}

// Best-effort detection of an offer message so it can be highlighted.
// Handles both legacy text offers ("Offer: MWK 12,000") and the structured
// JSON offer payload (media_type 'offer').
function parseOffer(body, mediaType) {
  if (!body) return null
  if (mediaType === 'offer') {
    const parsed = parseOfferMessage(body)
    return parsed.ok ? `Offer: ${formatOfferAmount(parsed.offer)}` : null
  }
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
  unread: { bg: '#e6f7ee', color: '#1a7a4a' },
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
  { key: 'unread', label: 'Unread' },
]

const CHIPS = []

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
function KebabIcon({ size = 18, color = '#3a443d' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <circle cx="12" cy="5" r="2" /><circle cx="12" cy="12" r="2" /><circle cx="12" cy="19" r="2" />
    </svg>
  )
}
function NewChatIcon({ size = 15, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" /><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export default function ChatListPanel() {
  const navigate = useNavigate()
  // Params of the thread currently open in the right pane (if any) — used to
  // highlight the matching row on desktop's split view.
  const { userId: openUserId, listingId: openContextId } = useParams()
  const location = useLocation()

  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  // 'all' | 'marketplace' | 'services' | 'jobs' | 'requests' | 'shops' | 'starred' | 'unread' | 'offers' | 'archived'
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [newChatQuery, setNewChatQuery] = useState('')
  const [newChatResults, setNewChatResults] = useState([])
  const [newChatLoading, setNewChatLoading] = useState(false)
  const [starred, setStarred] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(STARRED_KEY) || '[]')) } catch { return new Set() }
  })
  const [archived, setArchived] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(ARCHIVED_KEY) || '[]')) } catch { return new Set() }
  })
  const [deletedKeys, setDeletedKeys] = useState(() => new Set())
  const [rowMenuChat, setRowMenuChat] = useState(null)
  const [rowBusy, setRowBusy] = useState(false)
  // Long-press enters multi-select mode — holds the keys of selected rows.
  const [selectedKeys, setSelectedKeys] = useState(() => new Set())
  const longPressRef = useRef(null)
  const suppressClickRef = useRef(null)
  // Live presence: otherUserId -> { online, typing, recording, activityMeta }
  // activityMeta scopes typing/recording to peer + context so only the right row lights up
  const [presenceMap, setPresenceMap] = useState({})

  useEffect(() => { loadChats() }, [])

  // Track online / typing / recording for every peer in the list
  useEffect(() => {
    const ids = [...new Set(chats.map(c => c.otherId).filter(Boolean))]
    if (!ids.length || !currentUser?.id) return undefined

    const unsubs = ids.map((uid) => {
      const patch = (partial) => {
        setPresenceMap(prev => {
          const cur = prev[uid] || {
            online: false,
            typing: false,
            recording: false,
            activityMeta: null,
          }
          const next = { ...cur, ...partial }
          if (
            next.online === cur.online
            && next.typing === cur.typing
            && next.recording === cur.recording
            && next.activityMeta === cur.activityMeta
          ) return prev
          return { ...prev, [uid]: next }
        })
      }

      return watchUserOnline(
        uid,
        (online) => {
          patch({
            online: !!online,
            ...(online ? {} : { typing: false, recording: false, activityMeta: null }),
          })
        },
        (typing, meta) => {
          // Must be addressed to me (peerId === my id)
          const forMe = !!typing && !!meta?.peerId && String(meta.peerId) === String(currentUser.id)
          if (typing && forMe) {
            patch({
              online: true, // never mark them offline when we receive typing
              typing: true,
              recording: false,
              activityMeta: meta,
            })
          } else if (!typing) {
            patch({ typing: false, activityMeta: null })
          }
          // typing for someone else → ignore (don't touch online)
        },
        (recording, meta) => {
          const forMe = !!recording && !!meta?.peerId && String(meta.peerId) === String(currentUser.id)
          if (recording && forMe) {
            patch({
              online: true,
              recording: true,
              typing: false,
              activityMeta: meta,
            })
          } else if (!recording) {
            patch({ recording: false, activityMeta: null })
          }
        },
      )
    })

    return () => { unsubs.forEach(u => { try { u() } catch { /* ignore */ } }) }
  }, [chats, currentUser?.id])

  // Refetch every time the route changes (e.g. navigating into/out of a chat).
  // This is layout-agnostic — works whether ChatListPanel stays mounted in a
  // split view or not, and doesn't depend on Realtime or window focus events.
  useEffect(() => { loadChats() }, [location.pathname])

  // Sync deleted chats + listen for deletes from the thread view
  useEffect(() => {
    if (!currentUser?.id) return
    setDeletedKeys(loadDeletedChatKeys(currentUser.id))
    function onDeleted() {
      setDeletedKeys(loadDeletedChatKeys(currentUser.id))
      loadChats()
    }
    window.addEventListener('soko:chats-deleted', onDeleted)
    window.addEventListener('soko:messages-updated', onDeleted)
    return () => {
      window.removeEventListener('soko:chats-deleted', onDeleted)
      window.removeEventListener('soko:messages-updated', onDeleted)
    }
  }, [currentUser?.id])

  // Keep the list in sync with brand-new conversations (e.g. started via
  // "New Message") and any other message activity — ChatListPanel usually
  // stays mounted in the split-view layout, so it won't otherwise notice
  // a chat that didn't exist yet when loadChats() first ran.
  useEffect(() => {
    if (!currentUser?.id) return
    const channel = supabase
      .channel(`chatlist_${currentUser.id}_${Date.now()}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new
        if (msg.from_user === currentUser.id || msg.to_user === currentUser.id) {
          loadChats()
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [currentUser?.id])

  useEffect(() => {
    if (!newChatOpen) return
    const q = newChatQuery.trim()
    let cancelled = false
    setNewChatLoading(true)
    const t = setTimeout(async () => {
      let query = supabase
        .from('profiles')
        .select('id,full_name,avatar_url,city')
        .neq('id', currentUser?.id || '')
        .limit(20)
      if (q) query = query.ilike('full_name', `%${q}%`)
      const { data } = await query
      if (!cancelled) {
        setNewChatResults(data || [])
        setNewChatLoading(false)
      }
    }, 300)
    return () => { cancelled = true; clearTimeout(t) }
  }, [newChatOpen, newChatQuery, currentUser])

  async function startNewChat(person) {
    setNewChatOpen(false)
    navigate(`/chat/${person.id}?src=direct`, {
      state: { source: 'direct' },
    })
  }

  // Long-press (touch or held mouse) selects the row and enters multi-select.
  // Fires after ~480ms of no movement; cancels on movement/cancel/release.
  function startLongPress(e, chat) {
    cancelLongPress()
    const point = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || e
    if (!point) return
    const lp = { key: chat.key, x: point.clientX, y: point.clientY }
    lp.timer = setTimeout(() => {
      longPressRef.current = null
      suppressClickRef.current = chat.key
      setSelectedKeys(prev => {
        const next = new Set(prev)
        next.add(chat.key)
        return next
      })
    }, 480)
    longPressRef.current = lp
  }

  function moveLongPress(e) {
    const lp = longPressRef.current
    if (!lp) return
    const point = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || e
    if (!point) return
    if (Math.abs(point.clientX - lp.x) > 10 || Math.abs(point.clientY - lp.y) > 10) cancelLongPress()
  }

  function cancelLongPress() {
    const lp = longPressRef.current
    if (!lp) return
    clearTimeout(lp.timer)
    longPressRef.current = null
  }

  function toggleSelect(key) {
    setSelectedKeys(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function clearSelection() {
    setSelectedKeys(new Set())
  }

  function bulkStar() {
    const keys = [...selectedKeys]
    if (!keys.length) return
    setStarred(prev => {
      const next = new Set(prev)
      const allStarred = keys.every(k => next.has(k))
      keys.forEach(k => allStarred ? next.delete(k) : next.add(k))
      localStorage.setItem(STARRED_KEY, JSON.stringify([...next]))
      return next
    })
  }

  function bulkArchive() {
    const keys = [...selectedKeys]
    if (!keys.length) return
    setArchived(prev => {
      const next = new Set(prev)
      const allArchived = keys.every(k => next.has(k))
      keys.forEach(k => allArchived ? next.delete(k) : next.add(k))
      localStorage.setItem(ARCHIVED_KEY, JSON.stringify([...next]))
      return next
    })
    clearSelection()
  }

  function bulkDelete() {
    const keys = [...selectedKeys]
    if (!currentUser?.id || !keys.length) return
    if (!window.confirm(`Delete ${keys.length} chat${keys.length > 1 ? 's' : ''}?`)) return
    keys.forEach(key => markChatDeleted(currentUser.id, key))
    setDeletedKeys(loadDeletedChatKeys(currentUser.id))
    clearSelection()
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
      const source = sourceFromMessage(msg)
      const contextId = contextIdFromMessage(msg)
      const isCallLog = !!msg.call_type
      const key = conversationKey(otherId, source, contextId)

      if (!convos.has(key)) {
        convos.set(key, {
          key,
          otherId,
          source,
          contextId,
          isService: source === 'service',
          isRequestCtx: source === 'request',
          isJob: source === 'job',
          isShop: source === 'shop',
          isDirect: source === 'direct',
          lastMsg: msg,
          lastPreviewMsg: isCallLog ? null : msg,
        })
      } else {
        const c = convos.get(key)
        if (!c.lastPreviewMsg && !isCallLog) c.lastPreviewMsg = msg
      }
    }

    const conversations = [...convos.values()].map(c => ({
      ...c,
      lastMsg: c.lastPreviewMsg || c.lastMsg,
      lastActivityAt: c.lastMsg?.created_at,
    }))

    const otherIds = [...new Set(conversations.map(c => c.otherId))]
    const serviceIds = conversations.filter(c => c.source === 'service' && c.contextId).map(c => c.contextId)
    const listingIds = conversations.filter(c => c.source === 'listing' && c.contextId).map(c => c.contextId)
    const shopIds = conversations.filter(c => c.source === 'shop' && c.contextId).map(c => c.contextId)
    const jobIds = conversations.filter(c => c.source === 'job' && c.contextId).map(c => c.contextId)
    const requestIds = conversations.filter(c => c.source === 'request' && c.contextId).map(c => c.contextId)

    const [
      { data: profiles },
      { data: services },
      { data: listings },
      shopsRes,
      jobsRes,
      requestsRes,
    ] = await Promise.all([
      supabase.from('profiles').select('id,full_name,avatar_url,city,is_verified').in('id', otherIds),
      serviceIds.length > 0
        ? supabase.from('services').select('id,name,category,rate,city,media_urls').in('id', serviceIds)
        : Promise.resolve({ data: [] }),
      listingIds.length > 0
        ? supabase.from('listings').select('id,title,images,price').in('id', listingIds)
        : Promise.resolve({ data: [] }),
      shopIds.length > 0
        ? supabase.from('shops').select('id,name,slug,logo_url,category,city,district').in('id', shopIds)
        : Promise.resolve({ data: [] }),
      jobIds.length > 0
        ? supabase.from('jobs').select('id,title,company,city,type,logo_url,cover_image_url,poster_id').in('id', jobIds)
        : Promise.resolve({ data: [] }),
      requestIds.length > 0
        ? supabase.from('buyer_requests').select('id,title,budget,city,status').in('id', requestIds)
        : Promise.resolve({ data: [] }),
    ])

    const profilesMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    const servicesMap = Object.fromEntries((services || []).map(s => [s.id, s]))
    const listingsMap = Object.fromEntries((listings || []).map(l => [l.id, l]))
    const shopsMap = Object.fromEntries((shopsRes?.data || []).map(s => [s.id, s]))
    const jobsMap = Object.fromEntries((jobsRes?.data || []).map(j => [j.id, j]))
    const requestsMap = Object.fromEntries((requestsRes?.data || []).map(r => [r.id, r]))

    const enriched = await Promise.all(conversations.map(async c => {
      let unreadQ = supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('from_user', c.otherId)
        .eq('to_user', user.id)
        .eq('read', false)
      if (c.source === 'service' && c.contextId) unreadQ = unreadQ.eq('service_id', c.contextId)
      else if (c.source === 'listing' && c.contextId) unreadQ = unreadQ.eq('listing_id', c.contextId)
      else if (c.source === 'request' && c.contextId) unreadQ = unreadQ.eq('request_id', c.contextId)
      else if (c.source === 'job' && c.contextId) unreadQ = unreadQ.eq('job_id', c.contextId)
      else if (c.source === 'shop' && c.contextId) unreadQ = unreadQ.eq('shop_id', c.contextId)
      const { count } = await unreadQ

      const profile = profilesMap[c.otherId] || {}
      const displayName = profile.full_name || 'User'
      const avatarUrl = profile.avatar_url || null
      const isVerified = !!profile.is_verified

      const decoded = decodeReply(c.lastMsg?.body || '')
      const isRequest = c.source === 'request'
        || (!c.isService && REQUEST_TEXT_RE.test(decoded.body || ''))
      const requestEntity = c.source === 'request' ? requestsMap[c.contextId] : null
      const requestTitle = requestEntity?.title
        || (isRequest ? extractRequestTitle(decoded.body) : null)
      const offerText = parseOffer(decoded.body, c.lastMsg?.media_type)
      const meta = sourceMeta(c.source)

      return {
        ...c,
        displayName,
        avatarUrl,
        isVerified,
        isRequest,
        requestTitle,
        hasOffer: !!offerText,
        offerText,
        sourceLabel: meta.label,
        sourceColor: meta.color,
        sourceBg: meta.bg,
        service: c.source === 'service' ? servicesMap[c.contextId] : null,
        listing: c.source === 'listing' ? listingsMap[c.contextId] : null,
        shop: c.source === 'shop' ? shopsMap[c.contextId] : null,
        job: c.source === 'job' ? jobsMap[c.contextId] : null,
        request: requestEntity,
        unread: count || 0,
      }
    }))

    enriched.sort((a, b) => {
      const ta = new Date(a.lastActivityAt || a.lastMsg?.created_at || 0)
      const tb = new Date(b.lastActivityAt || b.lastMsg?.created_at || 0)
      return tb - ta
    })
    setChats(enriched)
    setLoading(false)
  }

  // ── Counts for pills/chips ───────────────────────────────────────────────
  const counts = useMemo(() => {
    // Include direct person-to-person chats; exclude user-deleted chats
    const visible = chats.filter(c => !archived.has(c.key) && !deletedKeys.has(c.key))
    return {
      all: visible.length,
      marketplace: visible.filter(c => !c.isService && !c.isRequest && c.listing).length,
      services: visible.filter(c => c.isService).length,
      jobs: visible.filter(c => c.isJob || c.source === 'job').length,
      requests: visible.filter(c => c.isRequest || c.source === 'request').length,
      shops: visible.filter(c => c.isShop || c.source === 'shop').length,
      offers: visible.filter(c => c.hasOffer).length,
      archived: [...archived].filter(k => chats.some(c => c.key === k) && !deletedKeys.has(k)).length,
      starred: [...starred].filter(k => chats.some(c => c.key === k) && !archived.has(k) && !deletedKeys.has(k)).length,
      unread: visible.filter(c => c.unread > 0).length,
    }
  }, [chats, starred, archived, deletedKeys])

  // ── Unread MESSAGE counts per category — drives the badges on the pill row ──
  const unreadCounts = useMemo(() => {
    const visible = chats.filter(c => !archived.has(c.key) && !deletedKeys.has(c.key))
    const sum = list => list.reduce((n, c) => n + (c.unread || 0), 0)
    return {
      all: sum(visible),
      marketplace: sum(visible.filter(c => c.source === 'listing' || (!c.isService && !c.isRequest && c.listing))),
      services: sum(visible.filter(c => c.source === 'service' || c.isService)),
      jobs: sum(visible.filter(c => c.source === 'job' || c.isJob)),
      requests: sum(visible.filter(c => c.source === 'request' || c.isRequest)),
      shops: sum(visible.filter(c => c.source === 'shop' || c.isShop)),
      unread: sum(visible),
    }
  }, [chats, archived, deletedKeys])

  // ── Filtering + search ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const pool = activeFilter === 'archived'
      ? chats.filter(c => archived.has(c.key) && !deletedKeys.has(c.key))
      : chats.filter(c => !archived.has(c.key) && !deletedKeys.has(c.key))

    let list = pool
    switch (activeFilter) {
      case 'marketplace': list = pool.filter(c => c.source === 'listing' || (!!c.listing && c.source !== 'service')); break
      case 'services': list = pool.filter(c => c.source === 'service' || c.isService); break
      case 'requests': list = pool.filter(c => c.source === 'request' || c.isRequest); break
      case 'jobs': list = pool.filter(c => c.source === 'job' || c.isJob); break
      case 'shops': list = pool.filter(c => c.source === 'shop' || c.isShop); break
      case 'starred': list = pool.filter(c => starred.has(c.key)); break
      case 'unread': list = pool.filter(c => c.unread > 0); break
      case 'offers': list = pool.filter(c => c.hasOffer); break
      case 'archived': list = pool; break
      default: list = pool
    }

    // Always hide deleted chats
    list = list.filter(c => !deletedKeys.has(c.key))

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
  }, [chats, activeFilter, search, starred, archived, deletedKeys])

  function renderLastMsg(chat) {
    const msg = chat.lastMsg
    if (!msg) return <span style={{ color: '#aaa' }}>No messages yet</span>

    const isMine = msg.from_user === currentUser?.id
    const prefix = isMine ? 'You: ' : ''
    const decoded = decodeReply(msg.body || '')
    const caption = (decoded.body || '').trim()

    const iconRow = (Icon, label) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
        <Icon size={13} color="currentColor" style={{ flexShrink: 0 }} />
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {label}
        </span>
      </span>
    )

    if (msg.media_type === 'deal_request') {
      return iconRow(TagIcon, prefix + 'Deal request')
    }

    if (msg.media_type === 'offer') {
      const parsed = parseOfferMessage(msg.body)
      return iconRow(TagIcon, prefix + (parsed.ok ? `Price offer: ${formatOfferAmount(parsed.offer)}` : 'Price offer'))
    }

    if (msg.call_type) {
      const isVideo = msg.call_type === 'video'
      const CallIcon = isVideo ? VideoMiniIcon : PhoneIcon
      if (msg.call_status === 'missed') return iconRow(CallIcon, 'Missed ' + (isVideo ? 'video call' : 'voice call'))
      if (msg.call_status === 'declined') return iconRow(CallIcon, 'Declined ' + (isVideo ? 'video call' : 'voice call'))
      if (msg.call_status === 'ended' || msg.call_status === 'answered') {
        const dur = msg.call_duration
        const durStr = dur
          ? (dur >= 60 ? `${Math.floor(dur / 60)}m ${dur % 60}s` : `${dur}s`)
          : ''
        return iconRow(CallIcon, (isVideo ? 'Video call' : 'Voice call') + (durStr ? ` · ${durStr}` : ''))
      }
      return iconRow(CallIcon, isVideo ? 'Video call' : 'Voice call')
    }

    if (msg.media_type === 'image' || (msg.media_url && msg.media_type === 'image')) {
      return iconRow(CameraIcon, prefix + (caption || 'Photo'))
    }
    if (msg.media_type === 'video') {
      return iconRow(VideoMiniIcon, prefix + (caption || 'Video'))
    }
    if (msg.media_type === 'audio') {
      return iconRow(MicIcon, prefix + 'Voice note')
    }
    if (msg.media_url && msg.media_type && msg.media_type !== 'text') {
      return iconRow(PaperclipIcon, prefix + (caption || 'Attachment'))
    }

    let body = caption
    if (!body && decoded.replyToId) body = 'Photo'
    if (!body) body = 'Message'
    // Strip leftover control chars / reply artifacts
    body = body.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').trim() || 'Message'
    const text = body.length > 42 ? body.slice(0, 42) + '…' : body
    return (
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {prefix}{text}
      </span>
    )
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
    const src = chat.source || (chat.isService ? 'service' : chat.isRequest ? 'request' : chat.listing ? 'listing' : 'direct')
    const meta = sourceMeta(src)

    const contextLabel =
      src === 'service' ? (chat.service?.name || 'Service')
      : src === 'request' ? (chat.requestTitle ? `Looking for ${chat.requestTitle}` : 'Buyer Request')
      : src === 'listing' ? (chat.listing?.title || null)
      : src === 'shop' ? (chat.shop?.name || 'Shop')
      : src === 'job' ? (chat.job?.title || 'Job')
      : null

    const contextSub =
      src === 'service' ? [chat.service?.rate, chat.service?.city].filter(Boolean).join(' · ')
      : src === 'listing' && chat.listing?.price ? 'MWK ' + Number(chat.listing.price).toLocaleString()
      : src === 'shop' ? [chat.shop?.category, chat.shop?.city || chat.shop?.district].filter(Boolean).join(' · ')
      : src === 'job' ? [chat.job?.company, chat.job?.city].filter(Boolean).join(' · ')
      : src === 'request' && chat.request?.budget ? String(chat.request.budget)
      : ''

    // Context image (product / service / shop logo / job logo) — right thumb
    const productImg =
      src === 'service' ? chat.service?.media_urls?.[0]
      : src === 'listing' ? chat.listing?.images?.[0]
      : src === 'shop' ? chat.shop?.logo_url
      : src === 'job' ? (chat.job?.logo_url || chat.job?.cover_image_url)
      : null

    const profileAvatar = chat.avatarUrl || null
    const initial = (chat.displayName || 'U')[0].toUpperCase()
    const isSelected = selectedKeys.has(chat.key)
    const hasUnread = chat.unread > 0
    const isOpen = openUserId === chat.otherId && String(openContextId || '') === String(chat.contextId || '')
    const presence = presenceMap[chat.otherId] || {}
    const isOnline = !!presence.online
    // Typing/recording only on the row that matches who they're messaging + context
    const activityForThisRow = activityTargetsChat(presence.activityMeta, {
      myId: currentUser?.id,
      otherId: chat.otherId,
      contextId: chat.contextId,
      source: src,
    })
    // Require peer scoping: if no meta/peerId, do NOT show on list (avoids lighting every row)
    const isTyping = !!presence.typing && !!presence.activityMeta?.peerId && activityForThisRow
    const isRecording = !!presence.recording && !!presence.activityMeta?.peerId && activityForThisRow

    const chatPath = buildChatPath(chat.otherId, { source: src, contextId: chat.contextId })
    const chatState = {
      source: src,
      ...(chat._matchedMsgId ? { scrollToMessageId: chat._matchedMsgId } : {}),
    }

    const activityAt = chat.lastActivityAt || chat.lastMsg?.created_at
    const firstName = (chat.displayName || 'User').split(' ')[0]

    return (
      <div
        key={chat.key}
        className="chat-row"
        style={{
          ...S.chatRow,
          animationDelay: i * 0.03 + 's',
          background: isSelected ? '#e6f7ee' : isOpen ? '#e6f7ee' : hasUnread ? '#fafffd' : '#fff',
        }}
        onClick={() => {
          if (suppressClickRef.current === chat.key) {
            suppressClickRef.current = null
            return
          }
          if (selectedKeys.size > 0) {
            toggleSelect(chat.key)
            return
          }
          navigate(chatPath, { state: chatState })
        }}
        onContextMenu={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setSelectedKeys(prev => {
            const next = new Set(prev)
            next.add(chat.key)
            return next
          })
        }}
        onTouchStart={(e) => startLongPress(e, chat)}
        onTouchMove={moveLongPress}
        onTouchEnd={cancelLongPress}
        onTouchCancel={cancelLongPress}
        onMouseDown={(e) => startLongPress(e, chat)}
        onMouseMove={moveLongPress}
        onMouseUp={cancelLongPress}
        onMouseLeave={cancelLongPress}
      >
        <div style={S.avatarWrap}>
          <SafeAvatar
            url={profileAvatar}
            name={chat.displayName || initial}
            size={54}
            radius="50%"
            style={{ border: '2px solid #fff' }}
          />
          {isSelected && (
            <span style={S.selectCheck}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </span>
          )}
          <span
            style={{
              ...S.onlineDot,
              background: isOnline ? '#22c55e' : '#c5d0c8',
              boxShadow: isOnline
                ? '0 0 0 2px #fff, 0 0 0 4px rgba(34,197,94,0.25)'
                : '0 0 0 2px #fff',
            }}
            title={isOnline ? 'Online' : 'Offline'}
          />
        </div>

        <div style={S.chatInfo}>
          <div style={S.chatTop}>
            <div style={S.nameRow}>
              <span style={{
                ...S.chatName,
                fontWeight: hasUnread ? 800 : 700,
                color: isOnline ? '#0f1410' : undefined,
              }}>
                {chat.displayName}
              </span>
              {chat.isVerified && <VerifiedBadge />}
            </div>
            <span
              style={{
                ...S.chatTime,
                color: hasUnread || isTyping || isRecording ? '#1a7a4a' : '#a0ada6',
                fontWeight: hasUnread ? 700 : 500,
              }}
            >
              {isOnline && !isTyping && !isRecording ? 'Online' : timeLabel(activityAt)}
            </span>
          </div>

          {contextLabel && (
            <div style={S.contextPill}>
              <span style={{ ...S.contextBadge, background: meta.bg, color: meta.color }}>
                {meta.label}
              </span>
              <span style={S.contextName}>{contextLabel}</span>
              {contextSub ? <span style={S.contextSub}> · {contextSub}</span> : null}
            </div>
          )}

          <div style={S.chatBottom}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {isRecording ? (
                <div style={S.presenceLineRecording}>
                  <span style={S.recDot} />
                  {firstName} is recording audio…
                </div>
              ) : isTyping ? (
                <div style={S.presenceLineTyping}>
                  {firstName} is typing
                  <span style={S.typingDotsInline}>
                    <span style={{ ...S.typingDotSm, animationDelay: '0s' }} />
                    <span style={{ ...S.typingDotSm, animationDelay: '0.2s' }} />
                    <span style={{ ...S.typingDotSm, animationDelay: '0.4s' }} />
                  </span>
                </div>
              ) : chat.hasOffer ? (
                <div style={S.offerLine}>
                  <TagIcon size={13} color="#1a7a4a" /> {chat.offerText}
                </div>
              ) : (
                <div
                  style={{
                    ...S.lastMsg,
                    fontWeight: hasUnread || search ? 600 : 400,
                    color: hasUnread
                      ? '#0f1410'
                      : (search && chat._matchedMsgId ? '#1a7a4a' : '#6b7a70'),
                  }}
                >
                  {renderLastMsg(chat)}
                </div>
              )}
            </div>
            <div style={S.rowActions}>
              {hasUnread && (
                <span style={S.unreadBadge}>
                  {chat.unread > 9 ? '9+' : chat.unread}
                </span>
              )}
              <div style={S.actionIcons}>
                {selectedKeys.size === 0 && (
                  <button
                    style={S.starBtn}
                    onClick={(e) => { e.stopPropagation(); setRowMenuChat(chat) }}
                    aria-label="Chat options"
                    title="Options"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="#9ca3af">
                      <circle cx="12" cy="5" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="19" r="1.5" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {productImg && (
          <div style={S.productThumb} title={contextLabel || meta.label}>
            <img
              src={productImg}
              alt=""
              style={S.productThumbImg}
              onError={e => { e.currentTarget.style.display = 'none' }}
            />
          </div>
        )}
      </div>
    )
  }

  async function rowBlock(chat) {
    if (!chat?.otherId || rowBusy) return
    setRowBusy(true)
    try {
      const { error } = await supabase.rpc('block_user', {
        p_blocked_id: chat.otherId,
        p_reason: 'Blocked from chat list',
      })
      if (error) throw error
      if (currentUser?.id) {
        markChatDeleted(currentUser.id, chat.key)
        setDeletedKeys(loadDeletedChatKeys(currentUser.id))
      }
      setRowMenuChat(null)
    } catch (e) {
      alert(e?.message || 'Could not block user')
    } finally {
      setRowBusy(false)
    }
  }

  async function rowReport(chat) {
    if (!chat?.otherId || rowBusy) return
    const reason = window.prompt('Why are you reporting this user?', 'spam')
    if (!reason || reason.trim().length < 3) return
    setRowBusy(true)
    try {
      const { error } = await supabase.rpc('report_user', {
        p_reported_user_id: chat.otherId,
        p_reason: reason.trim(),
        p_details: 'Reported from chat list',
        p_listing_id: chat.source === 'listing' ? chat.contextId : null,
      })
      if (error) throw error
      alert('Report submitted. Thank you.')
      setRowMenuChat(null)
    } catch (e) {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        await supabase.from('user_reports').insert({
          reporter_id: user.id,
          reported_user_id: chat.otherId,
          reason: reason.trim(),
          details: 'Reported from chat list',
        })
        alert('Report submitted. Thank you.')
        setRowMenuChat(null)
      } catch (e2) {
        alert(e?.message || 'Could not submit report')
      }
    } finally {
      setRowBusy(false)
    }
  }

  function rowDelete(chat) {
    if (!chat?.key || !currentUser?.id) return
    if (!window.confirm(`Delete chat with ${chat.displayName}?`)) return
    markChatDeleted(currentUser.id, chat.key)
    setDeletedKeys(loadDeletedChatKeys(currentUser.id))
    setRowMenuChat(null)
  }

  const empty = emptyStateCopy()

  const inSelection = selectedKeys.size > 0
  const selectedArr = inSelection ? [...selectedKeys] : []
  const allStarred = selectedArr.length > 0 && selectedArr.every(k => starred.has(k))
  const allArchived = selectedArr.length > 0 && selectedArr.every(k => archived.has(k))

  return (
    <div className="chat-list-panel" style={S.panel}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes typingDot { 0%,80%,100%{transform:scale(0.6);opacity:0.4} 40%{transform:scale(1);opacity:1} }
        @keyframes searchDrop { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }

        .chat-row {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
          touch-action: pan-y;
        }
        .chat-row:hover {
          background: #f8fffa !important;
          transform: translateY(-1px);
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
        }

        .soko-pillrow::-webkit-scrollbar { display: none; }

        @media (min-width: 900px) {
          .soko-mobile-bottomnav { display: none !important; }
        }
      `}</style>

      {/* Selection bar — replaces the brand row while chats are selected */}
      {inSelection ? (
        <div className="chat-select-bar" style={S.selectBar}>
          <button
            type="button"
            style={S.selectClose}
            onClick={clearSelection}
            aria-label="Cancel selection"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <span style={S.selectCount}>{selectedKeys.size} selected</span>
          <div style={S.selectActions}>
            <button type="button" style={S.selectAction} onClick={bulkStar} aria-label="Star selected" title="Star">
              <StarIcon filled={allStarred} />
            </button>
            <button type="button" style={S.selectAction} onClick={bulkArchive} aria-label="Archive selected" title="Archive">
              <ArchiveIcon active={allArchived} />
            </button>
            <button type="button" style={S.selectAction} onClick={bulkDelete} aria-label="Delete selected" title="Delete">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3a443d" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" />
              </svg>
            </button>
          </div>
        </div>
      ) : (
      <>
      {/* Brand row */}
      <div className="chat-brand-row" style={S.brandRow}>
        <div>
          <div style={S.logo}>
            <span style={{ color: '#1a7a4a' }}>Soko</span><span style={{ color: '#f5a623' }}>Mw</span>
          </div>
          <div style={S.tagline}>Buy. Sell. Find. Anywhere in Malawi.</div>
        </div>

        <div style={S.brandActions}>
          <button
            type="button"
            style={{ ...S.menuBtn, ...(searchOpen ? S.menuBtnActive : {}) }}
            onClick={() => setSearchOpen(v => !v)}
            aria-label="Search chats"
            aria-expanded={searchOpen}
          >
            <SearchGlassIcon size={18} color={searchOpen ? '#1a7a4a' : '#3a443d'} />
          </button>
          <div style={S.menuWrap}>
          <button type="button" style={S.menuBtn} onClick={() => setMenuOpen(v => !v)} aria-label="More filters">
            <KebabIcon />
          </button>
          {menuOpen && (
            <>
              <div style={S.menuOverlay} onClick={() => setMenuOpen(false)} />
              <div style={S.menuDropdown}>
                <button
                  type="button"
                  style={S.menuItem}
                  onClick={() => { setMenuOpen(false); setNewChatQuery(''); setNewChatOpen(true) }}
                >
                  <NewChatIcon size={15} color="#3a443d" />
                  New Message
                </button>
                <div style={S.menuDivider} />
                <button
                  type="button"
                  style={{ ...S.menuItem, ...(activeFilter === 'starred' ? S.menuItemActive : {}) }}
                  onClick={() => { setActiveFilter('starred'); setMenuOpen(false) }}
                >
                  <StarFilledIcon size={15} color={activeFilter === 'starred' ? '#1a7a4a' : '#f5a623'} />
                  Starred
                  {counts.starred > 0 && <span style={S.menuCount}>{counts.starred}</span>}
                </button>
                <button
                  type="button"
                  style={{ ...S.menuItem, ...(activeFilter === 'archived' ? S.menuItemActive : {}) }}
                  onClick={() => { setActiveFilter('archived'); setMenuOpen(false) }}
                >
                  <ArchiveBoxIcon size={15} color={activeFilter === 'archived' ? '#1a7a4a' : '#5c6b78'} />
                  Archived
                  {counts.archived > 0 && <span style={S.menuCount}>{counts.archived}</span>}
                </button>
              </div>
            </>
          )}
        </div>
        </div>
      </div>
      </>
      )}

      {newChatOpen && (
        <div style={S.newChatOverlay} onClick={() => setNewChatOpen(false)}>
          <div style={S.newChatPanel} onClick={e => e.stopPropagation()}>
            <div style={S.newChatHeader}>
              <span style={S.newChatTitle}>New Message</span>
              <button type="button" style={S.newChatClose} onClick={() => setNewChatOpen(false)} aria-label="Close">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            <div style={S.newChatSearchWrap}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                autoFocus
                style={S.newChatInput}
                placeholder="Search people on SokoMw"
                value={newChatQuery}
                onChange={e => setNewChatQuery(e.target.value)}
              />
            </div>
            <div style={S.newChatList}>
              {newChatLoading && <div style={S.newChatEmpty}>Searching…</div>}
              {!newChatLoading && newChatResults.length === 0 && (
                <div style={S.newChatEmpty}>{newChatQuery.trim() ? 'No one found' : 'Start typing a name'}</div>
              )}
              {!newChatLoading && newChatResults.map(p => (
                <div
                  key={p.id}
                  style={S.newChatRow}
                  onClick={() => startNewChat(p)}
                >
                  <SafeAvatar
                    url={p.avatar_url}
                    name={p.full_name || 'U'}
                    size={42}
                    radius={12}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={S.newChatName}>{p.full_name || 'User'}</div>
                    {p.city && <div style={S.newChatCity}>{p.city}</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Search — appears only after tapping the search icon in the brand row */}
      {searchOpen && (
        <div style={{ ...S.searchWrap, animation: 'searchDrop 0.18s ease both' }}>
          <SearchGlassIcon size={15} color="#8aa093" />
          <input
            autoFocus
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
          <button
            type="button"
            style={S.searchCloseBtn}
            onClick={() => setSearchOpen(false)}
            aria-label="Close search"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )}

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
              {!search.trim() && unreadCounts[p.key] > 0 && (
                <span style={{ ...S.pillCount, ...(activeFilter === p.key ? S.pillCountActive : {}) }}>{unreadCounts[p.key]}</span>
              )}
            </button>
          ))}
        </div>
        <div style={S.rowFade} />
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

      {/* Per-row options: block / report / delete */}
      {rowMenuChat && (
        <div
          style={S.rowMenuOverlay}
          onClick={() => !rowBusy && setRowMenuChat(null)}
          role="presentation"
        >
          <div style={S.rowMenuSheet} onClick={e => e.stopPropagation()}>
            <div style={S.rowMenuHandle} />
            <div style={{ fontSize: 15, fontWeight: 800, color: '#0f1410', marginBottom: 4 }}>
              {rowMenuChat.displayName}
            </div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
              Chat options
            </div>
            <button
              type="button"
              style={S.rowMenuItem}
              disabled={rowBusy}
              onClick={() => {
                setRowMenuChat(null)
                navigate(buildChatPath(rowMenuChat.otherId, {
                  source: rowMenuChat.source || 'direct',
                  contextId: rowMenuChat.contextId,
                }), { state: { source: rowMenuChat.source || 'direct' } })
              }}
            >
              Open chat
            </button>
            <button
              type="button"
              style={S.rowMenuItem}
              disabled={rowBusy}
              onClick={() => rowReport(rowMenuChat)}
            >
              🚩 Report
            </button>
            <button
              type="button"
              style={{ ...S.rowMenuItem, color: '#b91c1c' }}
              disabled={rowBusy}
              onClick={() => rowBlock(rowMenuChat)}
            >
              🚫 Block
            </button>
            <button
              type="button"
              style={{ ...S.rowMenuItem, color: '#b91c1c' }}
              disabled={rowBusy}
              onClick={() => rowDelete(rowMenuChat)}
            >
              🗑 Delete chat
            </button>
            <button
              type="button"
              style={S.rowMenuCancel}
              disabled={rowBusy}
              onClick={() => setRowMenuChat(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    background: '#fff',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },

  brandRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', padding: '16px 20px 12px', flexShrink: 0 },
  logo: { fontSize: '22px', fontWeight: '900', letterSpacing: '-0.5px' },
  tagline: { fontSize: '11.5px', color: '#9aa39d', marginTop: '3px' },

  selectBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '14px 20px 12px',
    flexShrink: 0,
    animation: 'fadeUp 0.18s ease both',
  },
  selectClose: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#3a443d',
    padding: '4px',
    display: 'flex',
    flexShrink: 0,
  },
  selectCount: {
    fontSize: '16px',
    fontWeight: '800',
    color: '#0f1410',
    letterSpacing: '-0.01em',
  },
  selectActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  selectAction: {
    background: 'rgba(0,0,0,0.04)',
    border: 'none',
    borderRadius: '10px',
    width: '38px',
    height: '38px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  selectCheck: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: '#1a7a4a',
    border: '2px solid #fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },

  menuWrap: { position: 'relative' },
  brandActions: { display: 'flex', alignItems: 'center', gap: 8 },
  menuBtn: {
    background: 'rgba(0,0,0,0.04)',
    border: 'none',
    borderRadius: '10px',
    width: '34px',
    height: '34px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'background 0.2s ease',
  },
  menuBtnActive: { background: '#e6f7ee' },
  menuOverlay: { position: 'fixed', inset: 0, zIndex: 20 },
  menuDropdown: {
    position: 'absolute',
    top: '40px',
    right: 0,
    background: '#fff',
    borderRadius: '14px',
    boxShadow: '0 8px 24px rgba(0,0,0,0.14)',
    border: '1px solid #eef2ef',
    padding: '6px',
    minWidth: '160px',
    zIndex: 21,
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    width: '100%',
    padding: '10px 12px',
    borderRadius: '10px',
    border: 'none',
    background: 'none',
    fontSize: '13.5px',
    fontWeight: '600',
    color: '#3a443d',
    cursor: 'pointer',
    textAlign: 'left',
  },
  menuItemActive: { background: '#e6f7ee', color: '#1a7a4a' },
  menuCount: { marginLeft: 'auto', fontSize: '11px', fontWeight: '800', color: '#9aa39d' },
  menuDivider: { height: '1px', background: '#eef2ef', margin: '4px 6px' },

  newChatOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.35)',
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'center',
    zIndex: 50,
    padding: '10vh 16px 0',
  },
  newChatPanel: {
    background: '#fff',
    borderRadius: '18px',
    width: '100%',
    maxWidth: '380px',
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
  },
  newChatHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 10px' },
  newChatTitle: { fontSize: '15px', fontWeight: '800', color: '#0f1410' },
  newChatClose: { background: 'rgba(0,0,0,0.04)', border: 'none', borderRadius: '8px', width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  newChatSearchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#f4f8f5',
    borderRadius: 999,
    padding: '10px 16px',
    border: '1.5px solid #e0ebe3',
    margin: '0 16px 10px',
  },
  newChatInput: { flex: 1, border: 'none', background: 'transparent', fontSize: '14px', color: '#111', outline: 'none' },
  newChatList: { flex: 1, overflowY: 'auto', padding: '4px 8px 12px' },
  newChatEmpty: { padding: '24px 12px', textAlign: 'center', fontSize: '13px', color: '#9aa39d' },
  newChatRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 10px', borderRadius: '12px', cursor: 'pointer' },
  newChatName: { fontSize: '14px', fontWeight: '700', color: '#0f1410', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  newChatCity: { fontSize: '12px', color: '#888' },

  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    background: '#f4f8f5',
    borderRadius: 999,
    padding: '11px 18px',
    border: '1.5px solid #e0ebe3',
    margin: '0 16px 12px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: '15px',
    color: '#111',
    outline: 'none',
  },
  searchCloseBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9aa39d',
    padding: '2px',
    display: 'flex',
    flexShrink: 0,
  },

  pillRow: { display: 'flex', gap: '8px', padding: '0 16px 12px', overflowX: 'auto' },
  pill: {
    padding: '8px 16px',
    borderRadius: '999px',
    border: 'none',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
    background: 'rgba(0,0,0,0.04)',
    color: '#3a443d',
    boxShadow: 'none',
  },
  pillActive: {
    background: '#1a7a4a',
    color: '#fff',
    boxShadow: '0 4px 14px rgba(26,122,74,0.28)',
    transform: 'translateY(-1px)',
  },
  pillCount: { background: 'rgba(0,0,0,0.08)', color: 'inherit', borderRadius: '10px', padding: '0 6px', fontSize: '10px', fontWeight: '800' },
  pillCountActive: { background: 'rgba(255,255,255,0.28)', color: '#fff' },

  rowWrap: { position: 'relative', flexShrink: 0 },
  rowFade: { position: 'absolute', top: 0, bottom: '10px', right: 0, width: '36px', background: 'linear-gradient(to right, rgba(255,255,255,0), #fff 70%)', pointerEvents: 'none' },

  chipRow: { display: 'flex', gap: '8px', padding: '0 16px 14px', overflowX: 'auto', borderBottom: '1px solid #eef2ef' },
  chip: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '7px 14px',
    borderRadius: '999px',
    border: 'none',
    fontSize: '12.5px',
    fontWeight: '600',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.2s ease',
    background: 'rgba(0,0,0,0.04)',
    color: '#3a443d',
  },
  chipActive: {
    background: '#1a7a4a',
    color: '#fff',
    boxShadow: '0 4px 14px rgba(26,122,74,0.28)',
  },

  skeletonRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px', background: '#fff', borderBottom: '1px solid #f4f8f5' },
  skeletonAvatar: { width: '52px', height: '52px', borderRadius: '15px', background: 'linear-gradient(90deg,#e8f0eb 25%,#f4f8f5 50%,#e8f0eb 75%)', flexShrink: 0, animation: 'pulse 1.5s infinite' },
  skeletonLine: { height: '11px', borderRadius: '6px', background: 'linear-gradient(90deg,#e8f0eb 25%,#f4f8f5 50%,#e8f0eb 75%)', animation: 'pulse 1.5s infinite' },

  empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' },
  emptyIconCircle: { width: '82px', height: '82px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px' },
  emptyTitle: { fontSize: '16px', fontWeight: '800', color: '#0f1410', marginBottom: '8px' },
  emptySub: { fontSize: '13.5px', color: '#777', lineHeight: '1.6', maxWidth: '260px', margin: '0 auto' },
  browseBtn: {
    background: 'linear-gradient(135deg,#1a7a4a,#22a05e)',
    color: '#fff',
    border: 'none',
    borderRadius: '14px',
    padding: '12px 26px',
    fontSize: '14px',
    fontWeight: '700',
    cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(26,122,74,0.35)',
  },

  list: { flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', touchAction: 'pan-y' },

  // === MODERN CHAT ROW ===
  chatRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '14px 20px',
    borderBottom: '1px solid #f0f4f1',
    cursor: 'pointer',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    animation: 'fadeUp 0.3s ease both',
  },
  avatarWrap: { position: 'relative', flexShrink: 0, width: 54, height: 54 },
  onlineDot: {
    position: 'absolute',
    right: 1,
    bottom: 1,
    width: 12,
    height: 12,
    borderRadius: '50%',
    zIndex: 2,
    transition: 'background 0.2s',
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
    border: '2px solid #fff',
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitial: { fontSize: 20, fontWeight: 800, color: '#fff' },
  presenceLineTyping: {
    fontSize: 13.5,
    fontWeight: 700,
    color: '#1a7a4a',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  presenceLineRecording: {
    fontSize: 13.5,
    fontWeight: 700,
    color: '#dc2626',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  recDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#ef4444',
    flexShrink: 0,
    animation: 'pulse 1s infinite',
  },
  typingDotsInline: {
    display: 'inline-flex',
    gap: 3,
    alignItems: 'center',
  },
  typingDotSm: {
    width: 4,
    height: 4,
    borderRadius: '50%',
    background: '#1a7a4a',
    display: 'inline-block',
    animation: 'typingDot 1.2s infinite',
  },
  // Small product image badge on the profile avatar (bottom-right)
  productBadge: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 22,
    height: 22,
    borderRadius: 7,
    overflow: 'hidden',
    border: '2px solid #fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.18)',
    background: '#eef2ef',
    zIndex: 2,
  },
  productBadgeImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  // Larger product thumbnail on the right edge of the row
  productThumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    overflow: 'hidden',
    flexShrink: 0,
    background: '#eef2ef',
    border: '1px solid #e4ece6',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
  },
  productThumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },

  chatInfo: { flex: 1, minWidth: 0 },
  chatTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3, gap: 8 },
  nameRow: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
  chatName: { fontSize: 15, fontWeight: 700, color: '#0f1410', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  chatTime: { fontSize: 11, flexShrink: 0, fontWeight: 500 },

  contextPill: { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3, minWidth: 0 },
  contextBadge: { fontSize: 9.5, fontWeight: 700, borderRadius: 6, padding: '2px 7px', flexShrink: 0 },
  contextName: { fontSize: 12.5, fontWeight: 600, color: '#333', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  contextSub: { fontSize: 12, color: '#888', flexShrink: 0 },

  chatBottom: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 8 },
  lastMsg: {
    fontSize: 13.5,
    color: '#6b7a70',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'flex',
    alignItems: 'center',
    minWidth: 0,
  },
  offerLine: {
    fontSize: 13.5,
    fontWeight: 700,
    color: '#1a7a4a',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },

  rowActions: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', marginLeft: '10px' },
  actionIcons: { display: 'flex', alignItems: 'center', gap: '4px' },
  unreadBadge: {
    background: '#1a7a4a',
    color: '#fff',
    borderRadius: '999px',
    minWidth: '19px',
    height: '19px',
    fontSize: '10px',
    fontWeight: '800',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 6px',
  },
  starBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    borderRadius: '6px',
    transition: 'background 0.2s',
  },
  rowMenuOverlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(8,12,10,0.45)',
    zIndex: 80,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  rowMenuSheet: {
    width: '100%',
    maxWidth: 420,
    background: '#f7faf8',
    borderRadius: '20px 20px 0 0',
    padding: '12px 14px calc(16px + env(safe-area-inset-bottom, 0px))',
    boxShadow: '0 -8px 40px rgba(0,0,0,0.18)',
  },
  rowMenuHandle: {
    width: 36,
    height: 4,
    borderRadius: 4,
    background: '#cfd9d2',
    margin: '2px auto 14px',
  },
  rowMenuItem: {
    width: '100%',
    display: 'block',
    textAlign: 'left',
    border: 'none',
    background: '#fff',
    borderRadius: 12,
    padding: '14px 16px',
    fontSize: 14,
    fontWeight: 700,
    color: '#0f1410',
    cursor: 'pointer',
    marginBottom: 8,
    fontFamily: 'inherit',
  },
  rowMenuCancel: {
    width: '100%',
    border: '1px solid #e0ebe3',
    background: '#fff',
    borderRadius: 12,
    padding: '14px',
    fontSize: 14,
    fontWeight: 750,
    color: '#1a7a4a',
    cursor: 'pointer',
    fontFamily: 'inherit',
    marginTop: 4,
  },
}