import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  sourceFromMessage,
  contextIdFromMessage,
  conversationKey,
  buildChatPath,
  loadDeletedChatKeys,
  markChatDeleted,
} from '../utils/chatSources'
import SafeAvatar from '../components/SafeAvatar'
import { watchUserOnline } from '../hooks/usePresence'
import { parseOfferMessage, formatOfferAmount } from '../utils/offerMessage'
import { stripForwardMark } from '../utils/forwardMessage'

// Some reply-to-image sends appear to save the body as a bare message id
// with no `\x02[preview|||id]\x03body` wrapper at all — this matches that
// shape so the raw id doesn't leak into the UI. The real fix belongs in
// whatever composes the reply (likely Chat.jsx's image-reply handler); this
// is a display-time safety net.
const BARE_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\]?$/i
const WRAPPED_REPLY_RE = new RegExp(`^${String.fromCharCode(2)}\\[(.+?)\\|\\|\\|([^\\]]+)\\]${String.fromCharCode(3)}(.*)$`, 's')
const CONTROL_CHARS_RE = new RegExp(
  `[${String.fromCharCode(0)}-${String.fromCharCode(8)}${String.fromCharCode(11)}-${String.fromCharCode(12)}${String.fromCharCode(14)}-${String.fromCharCode(31)}]`,
  'g',
)

let S

function decodeReply(body) {
  if (!body) return { body, replyPreview: null, replyToId: null, isForwarded: false }
  const fwd = stripForwardMark(body)
  if (fwd.isForwarded) return { ...decodeReply(fwd.body), isForwarded: true }
  const match = body.match(WRAPPED_REPLY_RE)
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

const TABS = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
  { key: 'marketplace', label: 'Marketplace' },
  { key: 'services', label: 'Services' },
  { key: 'requests', label: 'Requests' },
]


// Shared line-icon set — replaces emoji glyphs everywhere in this panel
// (chips, empty states, media/call previews) so the icon language matches
// the rest of the app (NavRail, category badges) instead of mixing in emoji.
function WrenchIcon({ size = 16, color = 'currentColor', strokeWidth = 1.75 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6a2.12 2.12 0 0 0 3 3l6-6a4 4 0 0 0 5.4-5.4l-2.1 2.1-2.6-2.6Z" />
    </svg>
  )
}
function BagIcon({ size = 16, color = 'currentColor', strokeWidth = 1.75 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  )
}
function TargetIcon({ size = 16, color = 'currentColor', strokeWidth = 1.75 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" fill={color} stroke="none" />
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
function StoreIcon({ size = 16, color = 'currentColor', strokeWidth = 1.75 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9 5 3h14l2 6" /><path d="M3 9v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" /><path d="M3 9h18" /><path d="M9 21v-6h6v6" />
    </svg>
  )
}
function FileIcon({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" /><path d="M14 2v6h6" />
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

function titleCaseName(value) {
  const name = String(value || 'User').trim().toLowerCase()
  if (!name) return 'User'
  return name.replace(/(^|[\s'-])([a-z])/g, (_, sep, ch) => sep + ch.toUpperCase())
}

function formatChatPrice(value) {
  if (value === null || value === undefined || value === '') return ''
  const match = String(value).trim().replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*([mk])?/i)
  if (!match) return ''
  const suffix = (match[2] || '').toLowerCase()
  const amount = Number(match[1]) * (suffix === 'm' ? 1000000 : suffix === 'k' ? 1000 : 1)
  if (!Number.isFinite(amount) || amount <= 0) return ''
  if (amount >= 1000000) {
    const millions = amount / 1000000
    return `MWK ${Number.isInteger(millions) ? millions : millions.toFixed(1).replace(/\.0$/, '')}M`
  }
  return `MWK ${Math.round(amount).toLocaleString('en-US')}`
}

function getSourceType(chat) {
  return chat?.source || (chat?.isService ? 'service' : chat?.isRequest ? 'request' : chat?.listing ? 'listing' : 'direct')
}

function getContextTitle(chat, src) {
  if (src === 'service') return chat.service?.name || 'Service chat'
  if (src === 'request') return chat.requestTitle || chat.request?.title || 'Request chat'
  if (src === 'listing') return chat.listing?.title || 'Listing chat'
  if (src === 'shop') return chat.shop?.name || 'Shop chat'
  return 'New chat'
}

function getContextImage(chat, src) {
  if (src === 'service') return chat.service?.media_urls?.[0] || null
  if (src === 'listing') return chat.listing?.images?.[0] || null
  if (src === 'shop') return chat.shop?.logo_url || null
  return null
}

function getContextPrice(chat, src) {
  if (src === 'service') return formatChatPrice(chat.service?.rate)
  if (src === 'listing') return formatChatPrice(chat.listing?.price)
  if (src === 'request') return formatChatPrice(chat.request?.budget)
  return ''
}

function formatChatTime(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  const now = new Date()
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const days = Math.round((today - day) / 86400000)
  if (days <= 0) return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  if (days === 1) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString('en-US', { weekday: 'short' })
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function PeerAvatar({ url, name, online }) {
  const [failed, setFailed] = useState(false)
  const cleanUrl = typeof url === 'string' && url.trim() && url !== 'null' && url !== 'undefined' ? url.trim() : null
  const initial = (String(name || 'U').trim()[0] || 'U').toUpperCase()

  return (
    <span className="chat-peer-avatar">
      {cleanUrl && !failed ? (
        <img src={cleanUrl} alt="" onError={() => setFailed(true)} />
      ) : (
        <span className="chat-peer-initial">{initial}</span>
      )}
      {online ? <span className="chat-online-dot" /> : null}
    </span>
  )
}

function ContextThumb({ image, type, title, peerUrl, peerName, online }) {
  const [failed, setFailed] = useState(false)
  const Icon = type === 'request' ? TargetIcon : type === 'service' ? WrenchIcon : type === 'shop' ? StoreIcon : BagIcon

  return (
    <span className="chat-context-thumb" title={title}>
      {image && !failed ? (
        <img src={image} alt="" onError={() => setFailed(true)} />
      ) : (
        <span className="chat-context-fallback">
          <Icon size={24} color="#0F9D58" />
        </span>
      )}
      <PeerAvatar url={peerUrl} name={peerName} online={online} />
    </span>
  )
}

function renderChatPreview(msg, currentUserId) {
  if (!msg) return <span className="chat-preview-empty">No messages yet</span>

  const isMine = msg.from_user === currentUserId
  const decoded = decodeReply(msg.body || '')
  const prefix = (isMine ? 'You: ' : '') + (decoded.isForwarded ? '↪ ' : '')
  const caption = (decoded.body || '').trim()

  const iconRow = (Icon, label) => (
    <span className="chat-preview-row">
      <span className="chat-preview-icon"><Icon size={14} color="currentColor" /></span>
      <span className="chat-preview-text">{label}</span>
    </span>
  )

  if (msg.media_type === 'deal_request') return iconRow(TagIcon, prefix + 'Deal request')

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
      const durStr = dur ? (dur >= 60 ? `${Math.floor(dur / 60)}m ${dur % 60}s` : `${dur}s`) : ''
      return iconRow(CallIcon, (isVideo ? 'Video call' : 'Voice call') + (durStr ? ` · ${durStr}` : ''))
    }
    return iconRow(CallIcon, isVideo ? 'Video call' : 'Voice call')
  }

  if (msg.media_type === 'image' || (msg.media_url && msg.media_type === 'image')) {
    return iconRow(CameraIcon, prefix + 'Photo' + (caption ? `: ${caption}` : ''))
  }
  if (msg.media_type === 'video') return iconRow(VideoMiniIcon, prefix + 'Video' + (caption ? `: ${caption}` : ''))
  if (msg.media_type === 'audio') return iconRow(MicIcon, prefix + 'Voice note')
  if (msg.media_url && msg.media_type && msg.media_type !== 'text') {
    return iconRow(FileIcon, prefix + 'File' + (caption ? `: ${caption}` : ''))
  }

  let body = caption
  if (!body && decoded.replyToId) body = 'Photo'
  if (!body) body = 'Message'
  body = body.replace(CONTROL_CHARS_RE, '').trim() || 'Message'
  return <span className="chat-preview-text">{prefix}{body}</span>
}

function ChatListRow({ chat, index, isOpen, online, currentUserId, onOpen, onMenu, onLongPressStart, onLongPressMove, onLongPressEnd }) {
  const src = getSourceType(chat)
  const contextTitle = getContextTitle(chat, src)
  const price = getContextPrice(chat, src)
  const peerName = titleCaseName(chat.displayName)
  const hasUnread = (chat.unread || 0) > 0
  const time = formatChatTime(chat.lastActivityAt || chat.lastMsg?.created_at)

  return (
    <div
      className={`chat-row${isOpen ? ' is-selected' : ''}${hasUnread ? ' is-unread' : ''}`}
      style={{ animationDelay: `${index * 0.03}s` }}
      onClick={onOpen}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onMenu(chat) }}
      onTouchStart={(e) => onLongPressStart(e, chat)}
      onTouchMove={onLongPressMove}
      onTouchEnd={onLongPressEnd}
      onTouchCancel={onLongPressEnd}
    >
      <ContextThumb
        image={getContextImage(chat, src)}
        type={src}
        title={contextTitle}
        peerUrl={chat.avatarUrl}
        peerName={peerName}
        online={online}
      />
      <div className="chat-row-body">
        <div className="chat-row-top">
          <span className="chat-row-title" title={contextTitle}>{contextTitle}</span>
          <div className="chat-row-meta">
            <span className="chat-row-time">{time}</span>
            {hasUnread ? <span className="chat-row-unread">{chat.unread > 99 ? '99+' : chat.unread}</span> : null}
          </div>
        </div>
        <div className="chat-row-person">
          <span>{peerName}</span>
          {price ? <span className="chat-list-price"> · {price}</span> : null}
        </div>
        <div className="chat-row-preview">{renderChatPreview(chat.lastMsg, currentUserId)}</div>
        <button
          type="button"
          className="chat-row-menu-btn"
          onClick={(e) => { e.stopPropagation(); onMenu(chat) }}
          aria-label="Chat options"
        >
          <KebabIcon size={16} color="#5f6368" />
        </button>
      </div>
    </div>
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
  // 'all' | 'marketplace' | 'services' | 'requests' | 'shops' | 'starred' | 'unread' | 'offers' | 'archived'
  const [activeFilter, setActiveFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [newChatOpen, setNewChatOpen] = useState(false)
  const [newChatQuery, setNewChatQuery] = useState('')
  const [newChatResults, setNewChatResults] = useState([])
  const [newChatLoading, setNewChatLoading] = useState(false)
  const [starred] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(STARRED_KEY) || '[]')) } catch { return new Set() }
  })
  const [archived] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem(ARCHIVED_KEY) || '[]')) } catch { return new Set() }
  })
  const [deletedKeys, setDeletedKeys] = useState(() => new Set())
  const [rowMenuChat, setRowMenuChat] = useState(null)
  const [rowBusy, setRowBusy] = useState(false)
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
    queueMicrotask(() => setDeletedKeys(loadDeletedChatKeys(currentUser.id)))
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
    const t = setTimeout(async () => {
      if (cancelled) return
      setNewChatLoading(true)
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

  function startLongPress(e, chat) {
    cancelLongPress()
    const point = (e.changedTouches && e.changedTouches[0]) || (e.touches && e.touches[0]) || e
    if (!point) return
    const lp = { key: chat.key, chat, x: point.clientX, y: point.clientY }
    lp.timer = setTimeout(() => {
      longPressRef.current = null
      suppressClickRef.current = chat.key
      setRowMenuChat(chat)
    }, 500)
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
    const requestIds = conversations.filter(c => c.source === 'request' && c.contextId).map(c => c.contextId)

    const [
      { data: profiles },
      { data: services },
      { data: listings },
      shopsRes,
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
      requestIds.length > 0
        ? supabase.from('buyer_requests').select('id,title,budget,city,status').in('id', requestIds)
        : Promise.resolve({ data: [] }),
    ])

    const profilesMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    const servicesMap = Object.fromEntries((services || []).map(s => [s.id, s]))
    const listingsMap = Object.fromEntries((listings || []).map(l => [l.id, l]))
    const shopsMap = Object.fromEntries((shopsRes?.data || []).map(s => [s.id, s]))
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

      return {
        ...c,
        displayName,
        avatarUrl,
        isVerified,
        isRequest,
        requestTitle,
        hasOffer: !!offerText,
        offerText,
        service: c.source === 'service' ? servicesMap[c.contextId] : null,
        listing: c.source === 'listing' ? listingsMap[c.contextId] : null,
        shop: c.source === 'shop' ? shopsMap[c.contextId] : null,
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
      marketplace: visible.filter(c => c.source === 'listing' || c.source === 'shop' || (!!c.listing && !c.isService)).length,
      services: visible.filter(c => c.isService).length,
      requests: visible.filter(c => c.isRequest || c.source === 'request').length,
      shops: visible.filter(c => c.isShop || c.source === 'shop').length,
      offers: visible.filter(c => c.hasOffer).length,
      archived: [...archived].filter(k => chats.some(c => c.key === k) && !deletedKeys.has(k)).length,
      starred: [...starred].filter(k => chats.some(c => c.key === k) && !archived.has(k) && !deletedKeys.has(k)).length,
      unread: visible.filter(c => c.unread > 0).length,
    }
  }, [chats, starred, archived, deletedKeys])

  // ── Filtering + search ──────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    const pool = activeFilter === 'archived'
      ? chats.filter(c => archived.has(c.key) && !deletedKeys.has(c.key))
      : chats.filter(c => !archived.has(c.key) && !deletedKeys.has(c.key))

    let list
    switch (activeFilter) {
      case 'marketplace': list = pool.filter(c => c.source === 'listing' || c.source === 'shop' || (!!c.listing && c.source !== 'service')); break
      case 'services': list = pool.filter(c => c.source === 'service' || c.isService); break
      case 'requests': list = pool.filter(c => c.source === 'request' || c.isRequest); break
      case 'shops': list = pool.filter(c => c.source === 'shop' || c.isShop); break
      case 'starred': list = pool.filter(c => starred.has(c.key)); break
      case 'unread': list = pool.filter(c => c.unread > 0); break
      case 'offers': list = pool.filter(c => c.hasOffer); break
      default: list = pool
    }

    // Always hide deleted chats
    list = list.filter(c => !deletedKeys.has(c.key))

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(c => {
        const nameMatch = c.displayName?.toLowerCase().includes(q)
        const titleMatch = getContextTitle(c, getSourceType(c)).toLowerCase().includes(q)
        return nameMatch || titleMatch
      })
    }
    return list
  }, [chats, activeFilter, search, starred, archived, deletedKeys])

  function emptyStateCopy() {
    switch (activeFilter) {
      case 'services': return { Icon: WrenchIcon, sub: 'Service conversations will appear here.' }
      case 'marketplace': return { Icon: BagIcon, sub: 'Marketplace conversations will appear here.' }
      case 'requests': return { Icon: TargetIcon, sub: 'Request conversations will appear here.' }
      case 'unread': return { Icon: ChatBubbleIcon, sub: 'Unread conversations will appear here.' }
      case 'starred': return { Icon: StarFilledIcon, sub: 'Starred conversations will appear here.' }
      case 'offers': return { Icon: TagIcon, sub: 'Offer conversations will appear here.' }
      case 'archived': return { Icon: ArchiveBoxIcon, sub: 'Archived conversations will appear here.' }
      default: return { Icon: ChatBubbleIcon, sub: 'Your conversations will appear here.' }
    }
  }

  function openChat(chat) {
    if (suppressClickRef.current === chat.key) {
      suppressClickRef.current = null
      return
    }
    const src = getSourceType(chat)
    navigate(buildChatPath(chat.otherId, { source: src, contextId: chat.contextId }), {
      state: { source: src },
    })
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
      } catch {
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

  return (
    <div className="chat-list-panel" style={S.panel}>
      <style>{`
        @keyframes chatFadeUp { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes chatShimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes searchDrop { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }

        .chat-list-panel {
          background: #fff;
          font-family: 'DM Sans', system-ui, -apple-system, sans-serif;
        }
        .chat-header-row {
          height: 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 0 16px;
          flex-shrink: 0;
        }
        .chat-header-title {
          font-family: 'Sora', 'DM Sans', sans-serif;
          font-size: 20px;
          font-weight: 800;
          color: #202124;
        }
        .chat-header-actions { display: flex; align-items: center; gap: 4px; }
        .chat-header-btn {
          width: 44px;
          height: 44px;
          border: none;
          border-radius: 12px;
          background: transparent;
          color: #5f6368;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }
        .chat-header-btn.is-active { background: #e6f6ed; color: #0F9D58; }

        .chat-tab-row {
          display: flex;
          gap: 8px;
          padding: 0 14px 12px;
          overflow-x: auto;
          overflow-y: hidden;
          scrollbar-width: none;
          -ms-overflow-style: none;
          flex-shrink: 0;
        }
        .chat-tab-row::-webkit-scrollbar { display: none; }
        .chat-tab {
          position: relative;
          height: 40px;
          flex: 0 0 auto;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 0 15px;
          border: 1px solid #e8eaed;
          border-radius: 999px;
          background: #fff;
          color: #5f6368;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          white-space: nowrap;
        }
        .chat-tab.is-active { background: #0F9D58; border-color: #0F9D58; color: #fff; }
        .chat-tab-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 18px;
          height: 18px;
          padding: 0 5px;
          border-radius: 999px;
          background: #e6f6ed;
          color: #0F9D58;
          font-size: 10px;
          font-weight: 800;
        }
        .chat-tab.is-active .chat-tab-count { background: rgba(255,255,255,0.24); color: #fff; }
        @media (hover: none) { .chat-tab::after { content: ''; position: absolute; inset: -2px 0; } }

        .chat-list-scroll {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          touch-action: pan-y;
          background: #f8f9fa;
          padding: 0 14px calc(var(--bottom-nav-h, 60px) + env(safe-area-inset-bottom, 0px) + 16px);
        }
        body.install-bar-visible .chats-shell .chat-list-panel .chat-list-scroll {
          padding-bottom: calc(var(--bottom-nav-h, 60px) + 56px + env(safe-area-inset-bottom, 0px) + 16px);
        }
        .chat-list-card {
          background: #fff;
          border: 1px solid #e8eaed;
          border-radius: 16px;
          overflow: hidden;
        }

        .chat-row {
          position: relative;
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 80px;
          padding: 12px 16px;
          background: #fff;
          cursor: pointer;
          animation: chatFadeUp 0.24s ease both;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          user-select: none;
          touch-action: pan-y;
        }
        .chat-row::after {
          content: '';
          position: absolute;
          left: 88px;
          right: 0;
          bottom: 0;
          height: 1px;
          background: #e8eaed;
          pointer-events: none;
        }
        .chat-row:last-child::after { display: none; }
        .chat-row.is-unread { background: #f6fbf8; }
        .chat-row-body { flex: 1; min-width: 0; padding-right: 40px; }
        .chat-row-top { display: flex; align-items: flex-start; gap: 12px; }
        .chat-row-title {
          flex: 1;
          min-width: 0;
          font-size: 15px;
          font-weight: 600;
          color: #202124;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          line-height: 1.3;
        }
        .chat-row.is-unread .chat-row-title { font-weight: 700; }
        .chat-row-meta { flex-shrink: 0; display: flex; flex-direction: column; align-items: flex-end; gap: 4px; }
        .chat-row-time { font-size: 12px; color: #80868b; white-space: nowrap; line-height: 1.3; }
        .chat-row-unread {
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          border-radius: 999px;
          background: #0F9D58;
          color: #fff;
          font-size: 11px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .chat-row-person,
        .chat-row-preview {
          font-size: 13px;
          color: #5f6368;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .chat-row-person { margin-top: 3px; }
        .chat-row-preview { margin-top: 4px; font-size: 14px; }
        .chat-row.is-unread .chat-row-preview,
        .chat-row.is-unread .chat-preview-text { color: #202124; }
        .chat-preview-row { display: inline-flex; align-items: center; gap: 5px; max-width: 100%; min-width: 0; }
        .chat-preview-icon { display: inline-flex; flex: 0 0 auto; }
        .chat-preview-text { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .chat-preview-empty { color: #80868b; }

        .chat-context-thumb {
          position: relative;
          width: 56px;
          height: 56px;
          flex-shrink: 0;
          border: 1px solid #e8eaed;
          border-radius: 12px;
          background: #e6f6ed;
        }
        .chat-context-thumb > img {
          display: block;
          width: 100%;
          height: 100%;
          border-radius: 11px;
          object-fit: cover;
        }
        .chat-context-fallback {
          position: absolute;
          inset: 0;
          border-radius: 11px;
          background: #e6f6ed;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .chat-peer-avatar {
          position: absolute;
          right: -6px;
          bottom: -6px;
          width: 24px;
          height: 24px;
          border: 2px solid #fff;
          border-radius: 50%;
          background: #e6f6ed;
          color: #0F9D58;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: visible;
          box-sizing: border-box;
        }
        .chat-peer-avatar > img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; display: block; }
        .chat-peer-initial { font-size: 11px; font-weight: 800; line-height: 1; }
        .chat-online-dot {
          position: absolute;
          right: -3px;
          bottom: -3px;
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #0F9D58;
          box-shadow: 0 0 0 2px #fff;
        }

        .chat-row-menu-btn {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 8px;
          background: transparent;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.15s ease;
        }
        @media (hover: hover) {
          .chat-row:hover { background: #f8faf9; }
          .chat-row.is-unread:hover { background: #eef8f2; }
          .chat-row:hover .chat-row-menu-btn,
          .chat-row-menu-btn:focus-visible { opacity: 1; pointer-events: auto; }
        }
        @media (hover: none) {
          .chat-row-menu-btn { display: none !important; }
          .chat-row-body { padding-right: 0; }
        }
        @media (min-width: 769px) {
          .chat-list-card { border: 0; border-radius: 0; }
          .chat-list-scroll { padding: 0 !important; background: #fff; }
          .chat-row.is-selected { background: #e6f6ed !important; }
          .chat-row.is-selected::before { content: ''; position: absolute; left: 0; top: 0; bottom: 0; width: 3px; background: #0F9D58; }
        }
        @media (max-width: 768px) {
          .chat-header-row { padding: 0 14px; }
          .chat-row { padding: 12px 14px; }
        }
        @media (max-width: 359px) {
          .chat-list-price { display: none; }
          .chat-peer-avatar { width: 20px; height: 20px; }
          .chat-row::after { left: 82px; }
        }
        @media (max-width: 768px) and (max-height: 500px) {
          .chat-header-row { height: 52px; }
          .chat-tab { height: 36px; }
        }

        .chat-skeleton-row {
          display: flex;
          align-items: center;
          gap: 12px;
          min-height: 80px;
          padding: 12px 16px;
          border-bottom: 1px solid #e8eaed;
        }
        .chat-skeleton-square { width: 56px; height: 56px; border-radius: 12px; flex-shrink: 0; }
        .chat-skeleton-lines { flex: 1; }
        .chat-skeleton-line { height: 10px; border-radius: 6px; margin-bottom: 9px; }
        .chat-skeleton { background: #f1f3f4; background-image: linear-gradient(90deg,#f1f3f4 25%,#e8eaed 50%,#f1f3f4 75%); background-size: 200% 100%; animation: chatShimmer 1.4s linear infinite; }
        .chat-empty {
          min-height: 280px;
          padding: 48px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
        }
        .chat-empty-icon {
          width: 72px;
          height: 72px;
          border-radius: 50%;
          background: #e6f6ed;
          color: #0F9D58;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 16px;
        }
        .chat-empty-title {
          font-family: 'Sora', 'DM Sans', sans-serif;
          font-size: 16px;
          font-weight: 700;
          color: #202124;
          margin-bottom: 6px;
        }
        .chat-empty-sub { font-size: 13px; color: #5f6368; line-height: 1.5; }
        @media (prefers-reduced-motion: reduce) {
          .chat-row { animation: none; }
          .chat-skeleton { animation: none; background-image: none; }
        }
      `}</style>

      <div className="chat-header-row" style={S.headerRow}>
        <span className="chat-header-title">Chats</span>
        <div className="chat-header-actions">
          <button
            type="button"
            className={`chat-header-btn${searchOpen ? ' is-active' : ''}`}
            onClick={() => setSearchOpen(v => !v)}
            aria-label="Search chats"
            aria-expanded={searchOpen}
          >
            <SearchGlassIcon size={20} color={searchOpen ? '#0F9D58' : '#5f6368'} />
          </button>
          <div style={S.menuWrap}>
            <button type="button" className="chat-header-btn" onClick={() => setMenuOpen(v => !v)} aria-label="More options">
              <KebabIcon size={20} color="#5f6368" />
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
                    <NewChatIcon size={15} color="#5f6368" />
                    New Message
                  </button>
                  <div style={S.menuDivider} />
                  <button
                    type="button"
                    style={{ ...S.menuItem, ...(activeFilter === 'starred' ? S.menuItemActive : {}) }}
                    onClick={() => { setActiveFilter('starred'); setMenuOpen(false) }}
                  >
                    <StarFilledIcon size={15} color={activeFilter === 'starred' ? '#0F9D58' : '#f5a623'} />
                    Starred
                    {counts.starred > 0 && <span style={S.menuCount}>{counts.starred}</span>}
                  </button>
                  <button
                    type="button"
                    style={{ ...S.menuItem, ...(activeFilter === 'archived' ? S.menuItemActive : {}) }}
                    onClick={() => { setActiveFilter('archived'); setMenuOpen(false) }}
                  >
                    <ArchiveBoxIcon size={15} color={activeFilter === 'archived' ? '#0F9D58' : '#80868b'} />
                    Archived
                    {counts.archived > 0 && <span style={S.menuCount}>{counts.archived}</span>}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

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
          <SearchGlassIcon size={15} color="#80868b" />
          <input
            autoFocus
            style={S.searchInput}
            placeholder="Search chats"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#80868b', padding: 0 }} onClick={() => setSearch('')}>
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

      <div className="chat-tab-row" role="tablist" aria-label="Chat filters">
        {TABS.map(tab => (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={activeFilter === tab.key}
            className={`chat-tab${activeFilter === tab.key ? ' is-active' : ''}`}
            onClick={() => setActiveFilter(tab.key)}
          >
            {tab.label}
            {tab.key === 'unread' && counts.unread > 0 ? (
              <span className="chat-tab-count">{counts.unread}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="chat-list-scroll" style={S.list}>
        <div className="chat-list-card">
          {loading ? (
            [1, 2, 3, 4, 5, 6].map(i => (
              <div className="chat-skeleton-row" key={i}>
                <div className="chat-skeleton-square chat-skeleton" />
                <div className="chat-skeleton-lines">
                  <div className="chat-skeleton-line chat-skeleton" style={{ width: '48%' }} />
                  <div className="chat-skeleton-line chat-skeleton" style={{ width: '72%' }} />
                  <div className="chat-skeleton-line chat-skeleton" style={{ width: '88%', marginBottom: 0 }} />
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty-icon"><empty.Icon size={30} color="#0F9D58" /></div>
              <div className="chat-empty-title">No chats here</div>
              <div className="chat-empty-sub">{empty.sub}</div>
            </div>
          ) : (
            filtered.map((chat, i) => {
              const isOpen = openUserId === chat.otherId && String(openContextId || '') === String(chat.contextId || '')
              return (
                <ChatListRow
                  key={chat.key}
                  chat={chat}
                  index={i}
                  isOpen={isOpen}
                  online={!!presenceMap[chat.otherId]?.online}
                  currentUserId={currentUser?.id}
                  onOpen={() => openChat(chat)}
                  onMenu={setRowMenuChat}
                  onLongPressStart={startLongPress}
                  onLongPressMove={moveLongPress}
                  onLongPressEnd={cancelLongPress}
                />
              )
            })
          )}
        </div>
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
            <div style={{ fontSize: 15, fontWeight: 800, color: '#202124', marginBottom: 4 }}>
              {titleCaseName(rowMenuChat.displayName)}
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
              Report
            </button>
            <button
              type="button"
              style={{ ...S.rowMenuItem, color: '#b91c1c' }}
              disabled={rowBusy}
              onClick={() => rowBlock(rowMenuChat)}
            >
              Block
            </button>
            <button
              type="button"
              style={{ ...S.rowMenuItem, color: '#b91c1c' }}
              disabled={rowBusy}
              onClick={() => rowDelete(rowMenuChat)}
            >
              Delete chat
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

S = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    background: '#fff',
    fontFamily: "'DM Sans', system-ui, -apple-system, sans-serif",
  },

  headerRow: { flexShrink: 0 },
  menuWrap: { position: 'relative' },
  menuOverlay: { position: 'fixed', inset: 0, zIndex: 20 },
  menuDropdown: {
    position: 'absolute',
    top: '48px',
    right: 0,
    background: '#fff',
    borderRadius: '14px',
    boxShadow: '0 8px 24px rgba(32,33,36,0.12)',
    border: '1px solid #e8eaed',
    padding: '6px',
    minWidth: '170px',
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
    fontSize: '13px',
    fontWeight: '600',
    color: '#5f6368',
    cursor: 'pointer',
    textAlign: 'left',
  },
  menuItemActive: { background: '#e6f6ed', color: '#0F9D58' },
  menuCount: { marginLeft: 'auto', fontSize: '11px', fontWeight: '800', color: '#80868b' },
  menuDivider: { height: '1px', background: '#e8eaed', margin: '4px 6px' },

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
    background: '#f8f9fa',
    borderRadius: 999,
    padding: '11px 18px',
    border: '1px solid #e8eaed',
    margin: '0 16px 12px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: '15px',
    color: '#202124',
    outline: 'none',
  },
  searchCloseBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#80868b',
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
    color: '#202124',
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