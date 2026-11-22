import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import {
  resolveChatSource,
  messageContextFields,
  sourceMeta,
  sourceHref,
  conversationKey,
  markChatDeleted,
} from '../utils/chatSources'
import SafeAvatar from '../components/SafeAvatar'
import ChatPopupMenu from '../components/ChatPopupMenu'
import {
  Image as ImageIcon,
  Video,
  FileText,
  SmilePlus,
  Camera,
  Music,
  File as FileIcon2,
  CircleDollarSign,
  Keyboard,
  Download,
  Search,
  UserRound,
  Flag,
  Ban,
  Trash2,
  Timer,
  Target,
  Check,
  Copy,
  Forward,
  Maximize2,
  ChevronRight,
  Pencil,
  RotateCcw,
  CornerUpLeft,
  CirclePlus,
  HandCoins,
  Mic,
  SendHorizontal,
  PackageCheck,
  MessageCircleQuestion,
  ChevronDown,
  Reply,
  TimerReset,
  Eraser,
  X,
} from 'lucide-react'
import {
  buildOfferPayload,
  parseOfferMessage,
  formatOfferAmount,
  OFFER_STATUS,
  isOfferExpired,
  offerStatusLabel,
  offerStatusText,
  OFFER_EXPIRY_OPTIONS,
  OFFER_DEFAULT_EXPIRY_HOURS,
  offerExpiresAt,
} from '../utils/offerMessage'
import { supabase } from '../lib/supabase'
import ForwardSheet from '../components/ForwardSheet'
import {
  stripForwardMark,
  canForwardMessage,
} from '../utils/forwardMessage'
// ── Image grouping ──────────────────────────────────────────────────────────
// Messages are grouped by ImageGroupingService (src/lib/imageGroupingService.js).
// groupedMessages is the render source; messages is the raw DB-row source.
// INSERT  → appendMessage (O(1) incremental)
// UPDATE/DELETE/load → groupMessages (full rebuild, rare)
// Multi-image uploads → pending group shown immediately, rebuilt after all uploads settle
// ─────────────────────────────────────────────────────────────────────────────
import imageGroupingService from '../lib/imageGroupingService'
import { uploadToR2 } from '../lib/r2'
import { formatTime } from '../hooks/useWebRTC'
import {
  watchUserOnline,
  setTypingIndicator,
  setRecordingIndicator,
  formatLastSeen,
  activityTargetsChat,
} from '../hooks/usePresence'
import ChatCallHost, { HideDuringCall } from '../components/ChatCallHost'
import CallMessageBubble from '../components/CallMessageBubble'
import ChatImageBubble from '../components/ChatImageBubble'
import { ImageViewer } from './LookingFor/LookingFor'
import { maybePromptDealReady } from '../utils/dealNotificationFlow'
import { notifyMissedCall, notifyCallDeclined } from '../utils/callNotifications'
import {
  notifyOfferNew,
  notifyOfferCounter,
  notifyOfferAccepted,
  notifyOfferDeclined,
  notifyOfferWithdrawn,
  notifyOfferEdited,
  scanOfferNotifications,
} from '../utils/offerNotifications'
import {
  EMOJI_CATEGORIES,
  EMOJI_BY_ID,
  EMOJI_FREQUENT,
  DEFAULT_EMOJI_TAB,
  loadRecentEmojis,
  saveRecentEmojis,
  RECENT_EMOJI_LIMIT,
} from '../constants/emojiCatalog'
import '../styles/chat-thread.css'

const DISAPPEAR_OPTIONS = [
  { label: 'Off', ms: null },
  { label: '1h', ms: 3600000 },
  { label: '24h', ms: 86400000 },
  { label: '7d', ms: 604800000 },
]

function toTitleCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/(^|[\s'-])([a-z])/g, (_, sep, letter) => sep + letter.toUpperCase())
}

function formatBudgetMwk(value) {
  const raw = String(value ?? '').trim()
  if (!raw) return ''
  const compact = raw.match(/([0-9]+(?:\.[0-9]+)?)\s*([mk])\b/i)
  const amount = compact
    ? Number(compact[1]) * (compact[2].toLowerCase() === 'm' ? 1000000 : 1000)
    : Number(raw.replace(/[^\d.]/g, ''))
  if (!Number.isFinite(amount) || amount <= 0) return ''
  if (amount >= 1000000) {
    const millions = amount / 1000000
    const short = Number.isInteger(millions) ? String(millions) : millions.toFixed(1).replace(/\.0$/, '')
    return `MWK ${short}M`
  }
  return `MWK ${Math.round(amount).toLocaleString('en-US')}`
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, position: 'relative', overflow: 'hidden' },
  loadCenter: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 0 },
  spinner: { width: 28, height: 28, border: '3px solid #e0ebe3', borderTopColor: '#1a7a4a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  topbar: { display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexShrink: 0, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e8ede9', zIndex: 10 },
  topInfo: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', transition: 'background 0.3s' },
  topStatus: { fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center' },
  ctxTitle: { fontSize: 13, fontWeight: 650, color: '#0f1410', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  ctxSub: { fontSize: 11, color: '#1a7a4a', fontWeight: 650 },
  recordingBar: { display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  inputBar: { display: 'flex', alignItems: 'flex-end', gap: 8, flexShrink: 0, zIndex: 5, padding: '8px 12px calc(8px + env(safe-area-inset-bottom, 0px))', background: '#fff', borderTop: '1px solid #e8eaed' },
  topActions: { display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 },
}

// ── Reply storage: stored in message body as a prefix so no extra DB columns needed
// Format: "↩[reply_preview|||reply_to_id]actual_body"
// We encode/decode this client-side only.
function encodeReply(body, replyTo) {
  if (!replyTo) return body
  const rawBody = decodeReply(replyTo.body).body
  const preview = (rawBody || (replyTo.media_type === 'audio' ? '🎤 Voice note' : replyTo.media_type === 'image' ? '📷 Photo' : '📎 File')).slice(0, 80)
  return `\x02[${preview}|||${replyTo.id}]\x03${body}`
}

function decodeReply(body) {
  if (!body) return { body, replyPreview: null, replyToId: null, isForwarded: false }
  // Forwarded marker sits outermost — strip it, then decode whatever is inside
  const fwd = stripForwardMark(body)
  if (fwd.isForwarded) return { ...decodeReply(fwd.body), isForwarded: true }
  // New format: \x02[preview|||id]\x03body
  // eslint-disable-next-line no-control-regex
  const match = body.match(/^\x02\[(.+?)\|\|\|([^\]]+)\]\x03(.*)$/s)
  if (match) return { body: match[3], replyPreview: match[1], replyToId: match[2] }
  // Fallback for old corrupted messages: preview|||uuid]body
  const fallback = body.match(/^(.+?)\|\|\|([a-f0-9-]{36})\](.*)$/s)
  if (fallback) return { body: fallback[3], replyPreview: fallback[1], replyToId: fallback[2] }

  // Status-viewer replies: [[status_reply:uuid]]\nuser text\n\n— replied on your status...
  const statusMatch = String(body).match(/^\[\[status_reply:([a-f0-9-]+)\]\]\s*([\s\S]*)$/i)
  if (statusMatch) {
    const rest = statusMatch[2] || ''
    const parts = rest.split(/\n*— replied on your status\s*/i)
    const userText = (parts[0] || '').trim()
    const meta = (parts[1] || '').trim()
    const statusLine = meta.split('\n').find(l => /^Status:/i.test(l)) || 'your status'
    const preview = `Status reply · ${statusLine.replace(/^Status:\s*/i, '').replace(/[“”"]/g, '').slice(0, 48)}`
    return {
      body: userText || rest.trim(),
      replyPreview: preview,
      replyToId: statusMatch[1],
    }
  }

  return { body, replyPreview: null, replyToId: null }
}

function fileLabelFromUrl(url) {
  try {
    const name = decodeURIComponent(String(url).split('/').pop() || 'File')
    return name.length > 36 ? name.slice(0, 32) + '…' : name
  } catch {
    return 'File'
  }
}

function ChatAvatar({ url, initial, size = 28, isMine = false, spacer = false }) {
  if (spacer) {
    return (
      <div
        className={`msg-avatar ${isMine ? 'is-mine' : 'is-theirs'} is-spacer`}
        style={{ width: size, height: size, visibility: 'hidden' }}
      />
    )
  }
  return (
    <SafeAvatar
      url={url}
      name={initial}
      size={size}
      isMine={isMine}
      className={`msg-avatar ${isMine ? 'is-mine' : 'is-theirs'}`}
      style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.12)' }}
    />
  )
}

const QUICK_REACTIONS = ['❤️', '😂', '👍', '🔥', '😮', '🙏']

function haptic(ms = 12) {
  try { navigator.vibrate?.(ms) } catch { /* ignore */ }
}

function reactionStorageKey(myId, otherId, listingId) {
  const pair = [myId, otherId].filter(Boolean).sort().join('_')
  const ctx = listingId && listingId !== 'undefined' ? `_${listingId}` : ''
  return `soko_chat_rx_${pair}${ctx}`
}

function loadReactions(key) {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function saveReactions(key, map) {
  try { localStorage.setItem(key, JSON.stringify(map)) } catch { /* ignore */ }
}

function MsgMeta({ msg, isMine }) {
  const status = msg._status
  return (
    <div className="msg-meta">
      {status === 'sending' && <span className="msg-status-label">Sending…</span>}
      {status === 'failed' && <span className="msg-status-label is-failed">Failed · tap to retry</span>}
      {status !== 'sending' && status !== 'failed' && (
        <span>
          {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      )}
      {isMine && status !== 'sending' && status !== 'failed' && (
        <span className={`msg-ticks ${msg.read ? 'read' : 'sent'}`} title={msg.read ? 'Read' : 'Sent'}>
          {msg.read ? '✓✓' : '✓'}
        </span>
      )}
      {isMine && status === 'sending' && <span className="msg-ticks sent">◌</span>}
      {isMine && status === 'failed' && <span className="msg-ticks is-failed">!</span>}
    </div>
  )
}

export default function Chat() {
  const { userId, listingId: contextIdParam } = useParams()
  const contextId = contextIdParam && contextIdParam !== 'undefined' ? contextIdParam : null
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  // Extract search param to stable value to prevent effect re-runs
  const searchParamSrc = searchParams.get('src')

  // ── State ────────────────────────────────────────────────────────────────
  const [messages, setMessages]           = useState([])
  const [groupedMessages, setGroupedMessages] = useState([])
  const chatImages = useMemo(() => {
    const urls = []
    const addUrl = url => {
      if (url && !urls.includes(url)) urls.push(url)
    }
    groupedMessages.forEach(msg => {
      if (msg.call_type || isMsgDeletedEveryone(msg)) return
      if (msg._isGroup && Array.isArray(msg._imageGroup)) {
        msg._imageGroup.forEach(img => {
          if (!img._uploading) addUrl(img.media_url)
        })
      } else if (msg.media_type === 'image' && !msg._pendingLoad) {
        addUrl(msg.media_url)
      }
    })
    return urls
  }, [groupedMessages])
  const prefillMessage = useRef(location.state?.prefillMessage || '')
  const isFromRequest = useRef(!!(location.state?.prefillMessage || location.state?.isRequest || location.state?.source === 'request'))
  const [isRequestChat, setIsRequestChat] = useState(isFromRequest.current)
  const [newMsg, setNewMsg]               = useState(location.state?.prefillMessage || '')
  const [currentUser, setCurrentUser]     = useState(null)
  const [otherUser, setOtherUser]         = useState(null)
  const [otherProfile, setOtherProfile]   = useState(null)
  const [listing, setListing]             = useState(null)
  const [service, setService]             = useState(null)
  const [shop, setShop]                   = useState(null)
  const [request, setRequest]             = useState(null)
  const [chatSource, setChatSource]       = useState(() =>
    resolveChatSource({ searchParams, locationState: location.state, contextId }) || 'direct'
  )
  const [isServiceChat, setIsServiceChat] = useState(false)
  const chatSourceRef = useRef(chatSource)
  const [loading, setLoading]             = useState(true)
  const [uploading, setUploading]         = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const pendingGroupIdRef = useRef(null)

  // ── Pagination (infinite scroll upward) ──────────────────────────────────
  const PAGE_SIZE = 20 // messages per page — constant
  const [hasMore, setHasMore] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const oldestLoadedIdRef = useRef(null) // oldest message id loaded so far
  const [recording, setRecording]         = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [playingId, setPlayingId]         = useState(null)
  const [audioProgress, setAudioProgress] = useState({})
  const [audioDuration, setAudioDuration] = useState({})
  const [preview, setPreview]             = useState([])
  const [showEmoji, setShowEmoji]         = useState(false)
  const [lockedKbHeight, setLockedKbHeight] = useState(340) // fallback px if keyboard wasn't open yet
  const [isMobile, setIsMobile]           = useState(() =>
    typeof window !== 'undefined' && window.matchMedia('(max-width: 899px)').matches
  )
  const [isTouchDevice, setIsTouchDevice] = useState(() =>
    typeof window !== 'undefined'
      && (window.matchMedia('(hover: none)').matches || navigator.maxTouchPoints > 0)
  )
  const [showOffer, setShowOffer]         = useState(false)
  const [offerAmount, setOfferAmount]     = useState('')
  const [offerNote, setOfferNote]         = useState('')
  const [counterParent, setCounterParent] = useState(null)
  const [editOfferMsg, setEditOfferMsg]   = useState(null)
  const [offerExpiryHours, setOfferExpiryHours] = useState(OFFER_DEFAULT_EXPIRY_HOURS)
  const [offerCustomExpiry, setOfferCustomExpiry] = useState('')
  const [withdrawConfirmId, setWithdrawConfirmId] = useState(null)
  const [declineConfirmId, setDeclineConfirmId] = useState(null)
  // Phase 7 — product context. Offer listing_id → { status:'ok', listing } | { status:'unavailable' }
  const [offerListings, setOfferListings] = useState({})
  const offerListingsFetchedRef = useRef({})
  const [recentEmojis, setRecentEmojis]   = useState(loadRecentEmojis)
  const [emojiTab, setEmojiTab]           = useState(DEFAULT_EMOJI_TAB)
  const [otherOnline, setOtherOnline]     = useState(false)
  const [otherLastSeen, setOtherLastSeen] = useState(null)
  const [otherTyping, setOtherTyping]     = useState(false)
  const [otherRecording, setOtherRecording] = useState(false)
  const [myProfile, setMyProfile]         = useState(null)
  const [replyTo, setReplyTo]             = useState(null)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
const [chatSearch, setChatSearch]       = useState(null)
const [searchMatches, setSearchMatches] = useState([])
const [searchIdx, setSearchIdx]         = useState(0)
const [lightbox, setLightbox]           = useState(null) // { url, type, caption }
const [imageViewer, setImageViewer]     = useState(null) // { photos, index }
const [showAttach, setShowAttach]       = useState(false)
const [actionMsg, setActionMsg]         = useState(null) // message under action sheet
const [actionAnchorPoint, setActionAnchorPoint] = useState(null)
const [imageActionMsg, setImageActionMsg] = useState(null) // individual image under action sheet
const [imageActionPoint, setImageActionPoint] = useState(null)
const [forwardMsgs, setForwardMsgs]     = useState(null) // messages queued for forwarding
const [toast, setToast]                 = useState(null)
const [reactions, setReactions]         = useState({})
const [unreadBelow, setUnreadBelow]     = useState(0)
const [swipeHintId, setSwipeHintId]     = useState(null)
const [chatStatus, setChatStatus]       = useState({ closed: false, blockedByMe: false, blockedMe: false })
const [dmAccepted, setDmAccepted]       = useState(false)
const [dmBusy, setDmBusy]               = useState(false)
const [showReportSheet, setShowReportSheet] = useState(false)
const [reportReason, setReportReason]   = useState('spam')
const [reportDetails, setReportDetails] = useState('')
const [showChatMenu, setShowChatMenu]   = useState(false)
const [menuMode, setMenuMode]           = useState('main') // main | report | delete
const [showDisappearMenu, setShowDisappearMenu] = useState(false)
const chatMenuAnchorRef                 = useRef(null)
const [actionMode, setActionMode]       = useState('main') // main | delete | timer | edit
const [editingMsg, setEditingMsg]       = useState(null)
const [editDraft, setEditDraft]         = useState('')
const [defaultDisappear, setDefaultDisappear] = useState(null) // ms offset or null

  const isServiceChatRef   = useRef(false)
  const chatContextRef     = useRef({ source: chatSource, contextId })
  const currentUserRef     = useRef(null)

  // Phase 3 — Negotiation chains. Builds a per-thread index of offers keyed by
  // offer_id (falling back to message id for legacy payloads), wires parent→child
  // links, and annotates each offer with its position in the root→active chain so
  // cards can render a flow stepper and "only one active offer" semantics.
  const offerFlowMap = useMemo(() => {
    const byId = new Map()
    ;(Array.isArray(messages) ? messages : []).forEach(m => {
      if (m.media_type !== 'offer') return
      const p = parseOfferMessage(m.body)
      if (!p.ok) return
      const oid = p.offer.offer_id || String(m.id)
      if (!byId.has(oid)) byId.set(oid, { msg: m, offer: p.offer, oid, children: [] })
    })
    byId.forEach(node => {
      const pid = node.offer.parent_offer_id
      const parent = pid && byId.get(pid)
      if (parent) parent.children.push(node.oid)
    })
    byId.forEach(node => {
      node.children.sort((a, b) => {
        const ma = byId.get(a)?.msg?.created_at || ''
        const mb = byId.get(b)?.msg?.created_at || ''
        return ma.localeCompare(mb) || String(a).localeCompare(String(b))
      })
    })
    const flowMap = new Map()
    const seen = new Set()
    byId.forEach(start => {
      if (seen.has(start.oid)) return
      let root = start
      while (root.offer.parent_offer_id && byId.get(root.offer.parent_offer_id)) {
        root = byId.get(root.offer.parent_offer_id)
      }
      const chain = []
      let cur = root
      while (cur) {
        chain.push(cur.oid)
        cur = cur.children.length ? byId.get(cur.children[0]) : null
      }
      const total = chain.length
      chain.forEach((oid, i) => {
        seen.add(oid)
        const n = byId.get(oid)
        flowMap.set(oid, {
          index: i + 1,
          total,
          parentIndex: i > 0 ? i : 0,
          hasChild: i < total - 1,
          chain,
          active: i === total - 1 && n.offer.status === OFFER_STATUS.pending,
          ended: i === total - 1
            && (n.offer.status === OFFER_STATUS.accepted || n.offer.status === OFFER_STATUS.declined),
        })
      })
    })
    return flowMap
  }, [messages])

  // Phase 7 — fetch the listing behind every offer so the card can show the product
  // being negotiated. A listing that no longer exists (or can't be read) renders as
  // "Listing unavailable" instead of breaking the card.
  useEffect(() => {
    const ids = new Set()
    ;(Array.isArray(messages) ? messages : []).forEach(m => {
      if (m.media_type !== 'offer') return
      const p = parseOfferMessage(m.body)
      if (p.ok && p.offer.listing_id) ids.add(p.offer.listing_id)
    })
    const toFetch = [...ids].filter(id => !offerListingsFetchedRef.current[id])
    if (!toFetch.length) return
    toFetch.forEach(id => { offerListingsFetchedRef.current[id] = true })
    let cancelled = false
    ;(async () => {
      const { data, error } = await supabase
        .from('listings')
        .select('id, title, images, price, status')
        .in('id', toFetch)
      if (cancelled) return
      setOfferListings(prev => {
        const next = { ...prev }
        if (!error && Array.isArray(data) && data.length) {
          data.forEach(l => { next[l.id] = { status: 'ok', listing: l } })
        }
        toFetch.forEach(id => {
          if (!next[id]) next[id] = { status: 'unavailable' }
        })
        return next
      })
    })()
    return () => { cancelled = true }
  }, [messages])

  useEffect(() => {
    chatSourceRef.current = chatSource
    chatContextRef.current = { source: chatSource, contextId }
  }, [chatSource, contextId])

  // Restore DM accept state when switching people
  useEffect(() => {
    if (!currentUser?.id || !userId) {
      setDmAccepted(false)
      return
    }
    const key = `soko_dm_accept_${currentUser.id}_${userId}`
    try {
      setDmAccepted(localStorage.getItem(key) === '1')
    } catch {
      setDmAccepted(false)
    }
  }, [currentUser?.id, userId])

  // Auto-accept DM if the current user has already replied
  useEffect(() => {
    if (chatSource !== 'direct' || !currentUser?.id || dmAccepted) return
    if (messages.some(m => m.from_user === currentUser.id && !String(m.id).startsWith('temp_'))) {
      setDmAccepted(true)
      try {
        localStorage.setItem(`soko_dm_accept_${currentUser.id}_${userId}`, '1')
      } catch { /* ignore */ }
    }
  }, [messages, chatSource, currentUser?.id, userId, dmAccepted])
  const bottomRef          = useRef(null)
  const messagesListRef    = useRef(null)
  const chatScrollTopRef   = useRef(0)
  const scrollContainerRef = messagesListRef
  const nearBottomRef      = useRef(true)
  const mediaRecorderRef   = useRef(null)
  const chunksRef          = useRef([])
  const timerRef           = useRef(null)
  const analyserRef        = useRef(null)
  const animFrameRef       = useRef(null)
  const audioRefs          = useRef({})
  const inputRef           = useRef(null)
  const attachBtnRef       = useRef(null)
  const recSlideStartRef   = useRef(null)
  /** Cursor position to restore after a programmatic emoji insert (commit-time). */
  const pendingEmojiCursorRef = useRef(null)
  /** Last known cursor position in the textarea — survives blur/unfocus (emoji inserts). */
  const cursorPosRef = useRef(null)
  const channelRef         = useRef(null)
  const presenceChannelRef = useRef(null)
  const typingTimeoutRef   = useRef(null)
  const otherTypingRef     = useRef(false)
  const otherRecordingRef  = useRef(false)
  const offlineApplyRef    = useRef(null)
  const emojiPickerRef     = useRef(null)
  const longPressRef       = useRef(null)
  const thumbPressTimer    = useRef(null)
  const longPressFiredRef  = useRef(false)
  const swipeRef           = useRef({ id: null, x: 0, dx: 0, active: false })
  const lastTapRef         = useRef({ id: null, t: 0 })
  const toastTimerRef      = useRef(null)
  const reactionsKeyRef    = useRef('')

  function showToast(text) {
    setToast(text)
    clearTimeout(toastTimerRef.current)
    toastTimerRef.current = setTimeout(() => setToast(null), 1800)
  }

  function scrollToBottom(smooth = true) {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' })
    nearBottomRef.current = true
    setUnreadBelow(0)
    setShowScrollBtn(false)
  }

  const openImageViewer = useCallback(url => {
    const index = chatImages.indexOf(url)
    chatScrollTopRef.current = messagesListRef.current?.scrollTop || 0
    setImageViewer({ photos: chatImages, index: index >= 0 ? index : 0 })
  }, [chatImages])

  const closeImageViewer = useCallback(() => {
    setImageViewer(null)
    requestAnimationFrame(() => {
      if (messagesListRef.current) messagesListRef.current.scrollTop = chatScrollTopRef.current
    })
  }, [])

  // ── Effects ──────────────────────────────────────────────────────────────

  // Keep the thread fitted to the *visible* viewport on mobile when the
  // soft keyboard / browser chrome resizes the visual viewport.
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const root = document.documentElement
    const apply = () => {
      const vv = window.visualViewport
      const h = vv ? Math.round(vv.height) : window.innerHeight
      root.style.setProperty('--chat-vvh', `${h}px`)
      // Offset for visualViewport.offsetTop when the page is scrolled under the keyboard
      root.style.setProperty('--chat-vv-top', `${vv ? Math.round(vv.offsetTop) : 0}px`)
      // Keyboard height = how much the visual viewport shrank from the window height.
      // Lets bottom-anchored fixed layers (emoji picker) ride above the keyboard.
      root.style.setProperty('--chat-kb-offset', `${window.innerHeight - (vv ? vv.height : window.innerHeight)}px`)
    }
    apply()
    const vv = window.visualViewport
    vv?.addEventListener('resize', apply)
    vv?.addEventListener('scroll', apply)
    window.addEventListener('resize', apply)
    return () => {
      vv?.removeEventListener('resize', apply)
      vv?.removeEventListener('scroll', apply)
      window.removeEventListener('resize', apply)
      root.style.removeProperty('--chat-vvh')
      root.style.removeProperty('--chat-vv-top')
      root.style.removeProperty('--chat-kb-offset')
    }
  }, [])

  // Reuse the CSS mobile breakpoint (max-width:899px) to gate mobile-only
  // behaviours (emoji picker keyboard-replacement inline style).
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 899px)')
    const onChange = e => setIsMobile(e.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(hover: none)')
    const onChange = e => setIsTouchDevice(e.matches || navigator.maxTouchPoints > 0)
    mq.addEventListener('change', onChange)
    window.addEventListener('resize', onChange)
    return () => {
      mq.removeEventListener('change', onChange)
      window.removeEventListener('resize', onChange)
    }
  }, [])

  useEffect(() => {
    init()
    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
      if (presenceChannelRef.current) { presenceChannelRef.current(); presenceChannelRef.current = null }
      clearTimeout(longPressRef.current)
      clearTimeout(toastTimerRef.current)
      clearTimeout(typingTimeoutRef.current)
      clearTimeout(offlineApplyRef.current)
      otherTypingRef.current = false
      otherRecordingRef.current = false
    }
  }, [userId, contextId, searchParamSrc])

  // Smart auto-scroll: only pin to bottom when user is already near it
  useEffect(() => {
    if (!messages.length) return
    const last = messages[messages.length - 1]
    const mine = last?.from_user === currentUserRef.current?.id || String(last?.id || '').startsWith('temp_')
    if (nearBottomRef.current || mine) {
      requestAnimationFrame(() => scrollToBottom(true))
    } else if (last && last.from_user !== currentUserRef.current?.id && !String(last.id).startsWith('temp_')) {
      setUnreadBelow(n => n + 1)
    }
  }, [messages.length])

  // Always land on the last message when the chat finishes loading
  useEffect(() => {
    if (loading) return
    requestAnimationFrame(() => scrollToBottom(false))
  }, [loading])

  // Load / sync reactions for this chat pair
  useEffect(() => {
    if (!currentUser?.id || !userId) return
    const key = reactionStorageKey(currentUser.id, userId, contextId)
    reactionsKeyRef.current = key
    setReactions(loadReactions(key))
  }, [currentUser?.id, userId, contextId])

  // Escape closes overlays
  useEffect(() => {
    function onKey(e) {
      if (e.key !== 'Escape') return
      if (imageViewer) { closeImageViewer(); return }
      if (showEmoji) { setShowEmoji(false); return }
      if (lightbox) setLightbox(null)
      else if (forwardMsgs) setForwardMsgs(null)
      else if (actionMsg) setActionMsg(null)
      else if (imageActionMsg) { setImageActionMsg(null); setImageActionPoint(null) }
      else if (showEmoji) setShowEmoji(false)
      else if (showAttach) setShowAttach(false)
      else if (chatSearch !== null) setChatSearch(null)
      else if (replyTo) setReplyTo(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, imageViewer, closeImageViewer, actionMsg, imageActionMsg, showEmoji, showAttach, chatSearch, replyTo, forwardMsgs])

  // Scroll to specific message if navigated from notification
  useEffect(() => {
    const state = window.history.state?.usr
    const msgId = state?.scrollToMessageId
    if (!msgId || messages.length === 0) return
    const el = document.getElementById(`msg-${msgId}`)
    if (el) {
      setTimeout(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el.style.transition = 'background 0.3s'
        el.style.background = '#d4ead9'
        setTimeout(() => { el.style.background = '' }, 1500)
      }, 400)
    }
  }, [messages])

  // Chat search
  useEffect(() => {
    if (!chatSearch || !chatSearch.trim()) { setSearchMatches([]); return }
    const q = chatSearch.toLowerCase()
    const ids = messages
      .filter(m => decodeReply(m.body || '').body?.toLowerCase().includes(q))
      .map(m => m.id)
    setSearchMatches(ids)
    setSearchIdx(0)
    if (ids.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`msg-${ids[0]}`)
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        el && highlightMsg(el)
      }, 50)
    }
  }, [chatSearch, messages])

  function highlightMsg(el) {
    el.style.transition = 'background 0.3s'
    el.style.background = '#d4ead9'
    setTimeout(() => { el.style.background = '' }, 1400)
  }

  function jumpToMatch(dir) {
    if (!searchMatches.length) return
    const next = (searchIdx + dir + searchMatches.length) % searchMatches.length
    setSearchIdx(next)
    const el = document.getElementById(`msg-${searchMatches[next]}`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el && highlightMsg(el)
  }

  // Close emoji picker on outside click
  useEffect(() => {
    function handler(e) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) {
        // Tapping the textarea/composer to move the cursor must NOT dismiss the
        // picker (Bug 1) — only dismiss on a true outside area.
        if (e.target?.closest && e.target.closest('.chat-composer')) return
        setShowEmoji(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Deal confirmation runs only in Notifications. After enough listing messages,
  // silently create a deal_ready notification for the seller.
  useEffect(() => {
    if (!listing?.id || !currentUser?.id || !userId) return
    if (listing.seller_id !== currentUser.id) return
    const realCount = messages.filter(m => m.media_type !== 'deal_request' && !m.call_type).length
    if (realCount < 4) return
    maybePromptDealReady({
      listing,
      currentUserId: currentUser.id,
      otherUserId: userId,
      messageCount: realCount,
      otherName: otherProfile?.full_name,
    }).catch(() => {})
  }, [listing?.id, listing?.seller_id, currentUser?.id, userId, messages.length, otherProfile?.full_name])

  // ── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      const { data: rd, error: re } = await supabase.auth.refreshSession()
      if (re || !rd.session) { navigate('/login'); return }
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }

    setCurrentUser(user)
    currentUserRef.current = user
    // Best-effort users row (RLS may block — never throw / spam 403s)
    try {
      await supabase.from('users').upsert({ id: user.id, name: user.email }, { onConflict: 'id' })
    } catch { /* ignore */ }

    const { data: myProf } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    setMyProfile(myProf)

    if (!userId) return
    const { data: otherProf } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setOtherProfile(otherProf)

    const { data: other } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
    setOtherUser(other || { id: userId, name: otherProf?.full_name || 'User' })

    let blockedByMe = false
    let blockedMe = false
    try {
      const { data: blocks } = await supabase
        .from('user_blocks')
        .select('blocker_id,blocked_id')
        .or(`and(blocker_id.eq.${user.id},blocked_id.eq.${userId}),and(blocker_id.eq.${userId},blocked_id.eq.${user.id})`)
      ;(blocks || []).forEach(block => {
        if (block.blocker_id === user.id) blockedByMe = true
        if (block.blocked_id === user.id) blockedMe = true
      })
    } catch { /* ignore */ }
    setChatStatus({
      closed: !!(other?.chat_closed || other?.is_closed || otherProf?.chat_closed || otherProf?.is_closed),
      blockedByMe,
      blockedMe,
    })

    // Load last_seen from profile on mount
    if (otherProf?.last_seen) setOtherLastSeen(new Date(otherProf.last_seen))

    // ── Resolve chat source (listing / service / shop / request / direct) ──
    let source = resolveChatSource({
      searchParams,
      locationState: location.state,
      contextId,
    })

    // Reset context entities
    setListing(null)
    setService(null)
    setShop(null)
    setRequest(null)
    setIsServiceChat(false)
    isServiceChatRef.current = false

    if (contextId) {
      // Explicit source from URL/state first; otherwise detect by probing tables
      if (!source || source === 'direct') {
        source = await detectContextSource(contextId)
      }
      await loadContextEntity(source, contextId)
    } else {
      source = 'direct'
    }

    setChatSource(source)
    chatSourceRef.current = source
    chatContextRef.current = { source, contextId }
    if (source === 'request' || location.state?.isRequest) setIsRequestChat(true)

    await loadMessages(user.id, source, contextId)

    let readQuery = supabase.from('messages').update({ read: true })
      .eq('to_user', user.id)
      .eq('from_user', userId)
      .eq('read', false)
    readQuery = applyContextFilter(readQuery, source, contextId)
    await readQuery

    setLoading(false)
    setupRealtimeChannel(user.id, source, contextId)
    setupPresenceChannel(user.id)
  }

  async function detectContextSource(id) {
    // Probe in a stable order; return first hit
    const checks = [
      ['listing', () => supabase.from('listings').select('id').eq('id', id).maybeSingle()],
      ['service', () => supabase.from('services').select('id').eq('id', id).maybeSingle()],
      ['shop', () => supabase.from('shops').select('id').eq('id', id).maybeSingle()],
      ['request', () => supabase.from('buyer_requests').select('id').eq('id', id).maybeSingle()],
    ]
    for (const [src, run] of checks) {
      try {
        const { data } = await run()
        if (data?.id) return src
      } catch { /* table may not exist */ }
    }
    return 'direct'
  }

  async function loadContextEntity(source, id) {
    if (!id || source === 'direct') return
    try {
      if (source === 'listing') {
        const { data } = await supabase.from('listings').select('*').eq('id', id).maybeSingle()
        if (data) setListing(data)
      } else if (source === 'service') {
        const { data } = await supabase.from('services').select('*').eq('id', id).maybeSingle()
        if (data) {
          setService(data)
          setIsServiceChat(true)
          isServiceChatRef.current = true
        }
      } else if (source === 'shop') {
        const { data } = await supabase.from('shops').select('*').eq('id', id).maybeSingle()
        if (data) setShop(data)
      } else if (source === 'request') {
        const { data } = await supabase.from('buyer_requests').select('*').eq('id', id).maybeSingle()
        if (data) {
          setRequest(data)
          setIsRequestChat(true)
        }
      }
    } catch (e) {
      console.warn('[Chat] loadContextEntity', source, e)
    }
  }

  function applyContextFilter(query, source, ctxId) {
    if (!ctxId || source === 'direct') return query
    switch (source) {
      case 'service': return query.eq('service_id', ctxId)
      case 'listing': return query.eq('listing_id', ctxId)
      case 'shop': return query.eq('shop_id', ctxId)
      case 'request': return query.eq('request_id', ctxId)
      default: return query
    }
  }

  function isRelevantMessage(msg, myId, source, ctxId) {
    const relevant = (msg.from_user === myId && msg.to_user === userId)
      || (msg.from_user === userId && msg.to_user === myId)
    if (!relevant) return false
    if (!ctxId || source === 'direct') {
      // Direct thread: only messages without any context FK
      // (or explicitly chat_source=direct). Keep loose match for legacy rows.
      if (msg.chat_source && msg.chat_source !== 'direct') return false
      if (msg.listing_id || msg.service_id || msg.shop_id || msg.request_id) return false
      return true
    }
    switch (source) {
      case 'service': return msg.service_id === ctxId
      case 'listing': return msg.listing_id === ctxId
      case 'shop': return msg.shop_id === ctxId || msg.chat_source === 'shop'
      case 'request': return msg.request_id === ctxId || msg.chat_source === 'request'
      default: return true
    }
  }

  function setupRealtimeChannel(myId, source, ctxId) {
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    const channelName = `chat_${[myId, userId].sort().join('_')}_${source || 'direct'}_${ctxId || 'none'}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new
        if (!isRelevantMessage(msg, myId, source, ctxId)) return
        const isIncoming = msg.from_user !== myId
        const hasMedia   = !!msg.media_url && (msg.media_type === 'image' || msg.media_type === 'video')
        const pendingMsg = isIncoming && hasMedia ? { ...msg, _pendingLoad: true } : msg
        setMessages(prev => {
          const withoutTemp = prev.filter(m => {
            if (String(m.id).startsWith('temp_') && m.from_user === msg.from_user && m.media_type === msg.media_type) return false
            if (m.id === msg.id) return false
            return true
          })
          const next = [...withoutTemp, pendingMsg]

          if (!pendingGroupIdRef.current) {
            // Incremental append — fast path for the common case
            // appendMessage handles grouping rules (same sender, within 60s, image type)
            setGroupedMessages(prev => {
              // Deduplicate: if this message id already exists in grouped, skip
              const alreadyExists = prev.some(m => {
                if (m._isGroup) return m._imageGroup?.some(img => img.id === msg.id)
                return m.id === msg.id
              })
              if (alreadyExists) return prev

              const withoutOptimistic = prev.filter(m =>
                !(String(m.id).startsWith('temp_') &&
                  m.from_user === msg.from_user &&
                  m.media_type === msg.media_type)
              )
              return imageGroupingService.appendMessage(withoutOptimistic, { ...pendingMsg, _status: undefined })
            })
          }

          return next
        })
        if (msg.from_user === userId) {
          supabase.from('messages').update({ read: true }).eq('id', msg.id).then(() => {})
        }
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new
        if (!isRelevantMessage(msg, myId, source, ctxId)) return
        setMessages(prev => {
          const next = prev.map(m => (m.id === msg.id ? { ...m, ...msg, _status: undefined } : m))
          const forGrouping = next.filter(m => !(m.deleted_at && m.media_type === 'image' && !m.media_url))
          setGroupedMessages(imageGroupingService.groupMessages(forGrouping))
          return next
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
        const old = payload.old
        if (!old?.id) return
        setMessages(prev => {
          const next = prev.filter(m => m.id !== old.id)
          const forGrouping = next.filter(m => !(m.deleted_at && m.media_type === 'image' && !m.media_url))
          setGroupedMessages(imageGroupingService.groupMessages(forGrouping))
          return next
        })
      })
      .on('broadcast', { event: 'reaction' }, ({ payload }) => {
        if (!payload?.messageId || !payload?.emoji || !payload?.userId) return
        applyReactionLocal(payload.messageId, payload.emoji, payload.userId, false)
      })
      .subscribe()
    channelRef.current = channel
  }

  function applyReactionLocal(messageId, emoji, reactorId, broadcast = true) {
    setReactions(prev => {
      const next = { ...prev }
      const current = { ...(next[messageId] || {}) }
      // Toggle: one emoji per user on a message
      for (const key of Object.keys(current)) {
        current[key] = (current[key] || []).filter(uid => uid !== reactorId)
        if (!current[key].length) delete current[key]
      }
      const list = current[emoji] || []
      // If same emoji was already set, remove it (toggle off); else set it
      const hadSame = (prev[messageId]?.[emoji] || []).includes(reactorId)
      if (!hadSame) current[emoji] = [...list, reactorId]
      next[messageId] = current
      if (reactionsKeyRef.current) saveReactions(reactionsKeyRef.current, next)
      return next
    })
    if (broadcast && channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'reaction',
        payload: { messageId, emoji, userId: reactorId },
      })
    }
  }

  function toggleReaction(msg, emoji) {
    const uid = currentUserRef.current?.id
    if (!uid || !msg?.id || String(msg.id).startsWith('temp_')) return
    haptic(10)
    applyReactionLocal(msg.id, emoji, uid, true)
    setActionMsg(null)
  }

  async function copyMessage(msg) {
    let text = decodeReply(msg.body || '').body
      || (msg.media_type === 'image' ? msg.media_url || 'Photo'
        : msg.media_type === 'video' ? msg.media_url || 'Video'
        : msg.media_type === 'audio' ? 'Voice note'
        : msg.media_url || '')
    if (msg.media_type === 'offer') {
      const parsed = parseOfferMessage(msg.body)
      text = parsed.ok
        ? `Price offer: ${formatOfferAmount(parsed.offer)}${parsed.offer.note ? ` — ${parsed.offer.note}` : ''}`
        : 'Price offer'
    }
    try {
      await navigator.clipboard.writeText(text)
      showToast('Copied')
      haptic(8)
    } catch {
      showToast('Could not copy')
    }
    setActionMsg(null)
  }

  // ── Forwarding ───────────────────────────────────────────────────────────
  // Strip reply + forwarded markers so the copy lands in the new chat as plain
  // content (a reply quote would point at a message the recipient can't see).
  function plainBodyForForward(msg) {
    if (!msg) return ''
    return decodeReply(msg.body || '').body || ''
  }

  function openForward(msg) {
    if (!canForwardMessage(msg)) {
      showToast('This message can’t be forwarded')
      return
    }
    // Image groups forward as the individual images they hold
    const items = msg._isGroup && Array.isArray(msg._imageGroup) ? msg._imageGroup : [msg]
    const forwardable = items.filter(canForwardMessage)
    if (!forwardable.length) {
      showToast('This message can’t be forwarded')
      return
    }
    setActionMsg(null)
    setImageActionMsg(null)
    setImageActionPoint(null)
    setActionMode('main')
    setForwardMsgs(forwardable)
  }

  function onForwarded({ failed, rowsByTarget, targets }) {
    setForwardMsgs(null)

    // If one of the targets is this very conversation, show the copies now
    const myKey = currentChatKey()
    const here = (targets || []).find(t => t.key === myKey)
    if (here && rowsByTarget?.[here.key]?.length) {
      const rows = rowsByTarget[here.key]
      setMessages(prev => {
        const seen = new Set(prev.map(m => m.id))
        return [...prev, ...rows.filter(r => !seen.has(r.id))]
      })
      setGroupedMessages(prev => rows.reduce((acc, row) => {
        // Realtime may have delivered the same row already
        const exists = acc.some(m => (m._isGroup
          ? m._imageGroup?.some(img => img.id === row.id)
          : m.id === row.id))
        return exists ? acc : imageGroupingService.appendMessage(acc, row)
      }, prev))
      nearBottomRef.current = true
      setTimeout(() => scrollToBottom(true), 40)
    }

    haptic(10)
    const chats = targets?.length || 0
    showToast(failed
      ? `Forwarded to ${chats} chat${chats > 1 ? 's' : ''} · ${failed} failed`
      : `Forwarded to ${chats} chat${chats > 1 ? 's' : ''}`)
  }

  function isMsgHiddenForMe(msg, myId) {
    if (!msg || !myId) return false
    const hidden = msg.hidden_for
    if (Array.isArray(hidden) && hidden.includes(myId)) return true
    if (msg.expires_at && new Date(msg.expires_at).getTime() <= Date.now()) return true
    return false
  }

  function isMsgDeletedEveryone(msg) {
    return !!(msg?.deleted_at)
  }

  async function deleteMessageForMe(msg) {
    if (!msg?.id || !currentUserRef.current?.id) return
    const myId = currentUserRef.current.id
    const id = msg.id
    setMessages(prev => prev.filter(m => m.id !== id))
    setGroupedMessages(prev => {
      const next = prev
        .map(m => {
          if (!m._isGroup) return m.id === id ? null : m
          const newGroup = m._imageGroup.filter(img => img.id !== id)
          if (!newGroup.length) return null
          if (newGroup.length === 1) return { ...newGroup[0], _isGroup: false, _imageGroup: undefined }
          return { ...m, _imageGroup: newGroup, id: newGroup[0].id }
        })
        .filter(Boolean)
      return next
    })
    setActionMsg(null)
    setActionMode('main')
    if (String(id).startsWith('temp_')) return

    // Prefer RPC; fall back to local hide via update / localStorage
    const { error } = await supabase.rpc('hide_message_for_me', { p_message_id: id })
    if (error) {
      try {
        const prev = Array.isArray(msg.hidden_for) ? msg.hidden_for : []
        await supabase.from('messages').update({
          hidden_for: [...new Set([...prev, myId])],
        }).eq('id', id)
      } catch {
        // Last resort: client-only hide key
        try {
          const k = `soko_msg_hidden_${myId}`
          const arr = JSON.parse(localStorage.getItem(k) || '[]')
          arr.push(id)
          localStorage.setItem(k, JSON.stringify([...new Set(arr)]))
        } catch { /* ignore */ }
      }
    }
    showToast('Deleted for you')
    window.dispatchEvent(new Event('soko:messages-updated'))
  }

  async function deleteMessageForEveryone(msg) {
    if (!msg?.id || !currentUserRef.current?.id) return
    if (msg.from_user !== currentUserRef.current.id) {
      showToast('You can only unsend your own messages')
      return
    }
    const id = msg.id
    setMessages(prev => prev.map(m => m.id === id
      ? { ...m, deleted_at: new Date().toISOString(), deleted_by: currentUserRef.current.id, body: '', media_url: null }
      : m))
    setGroupedMessages(prev => {
      const next = prev
        .map(m => {
          if (!m._isGroup) return m
          const newGroup = m._imageGroup.filter(img => img.id !== id)
          if (!newGroup.length) return null
          if (newGroup.length === 1) return { ...newGroup[0], _isGroup: false, _imageGroup: undefined }
          return { ...m, _imageGroup: newGroup, id: newGroup[0].id }
        })
        .filter(Boolean)
      return next
    })
    setActionMsg(null)
    setActionMode('main')
    if (String(id).startsWith('temp_')) return

    let error = (await supabase.rpc('soft_delete_message', { p_message_id: id })).error
    if (error) {
      // Fallback: hard delete own row
      ;({ error } = await supabase
        .from('messages')
        .delete()
        .eq('id', id)
        .eq('from_user', currentUserRef.current.id))
      if (!error) {
        setMessages(prev => prev.filter(m => m.id !== id))
      }
    }
    if (error) {
      showToast('Delete failed')
      loadMessages(currentUserRef.current.id, chatSourceRef.current, contextId)
    } else {
      showToast('Deleted for everyone')
      window.dispatchEvent(new Event('soko:messages-updated'))
    }
  }

  async function saveEditedMessage() {
    if (!editingMsg?.id || !currentUserRef.current?.id) return
    const next = editDraft.trim()
    if (!next) { showToast('Message cannot be empty'); return }
    const id = editingMsg.id
    const orig = decodeReply(editingMsg.body || '')
    const bodyToSave = orig.replyToId
      ? `\x02[${String(orig.replyPreview || '').slice(0, 80)}|||${orig.replyToId}]\x03${next}`
      : next

    setMessages(prev => prev.map(m => m.id === id
      ? { ...m, body: bodyToSave, edited_at: new Date().toISOString() }
      : m))
    setEditingMsg(null)
    setEditDraft('')
    setActionMsg(null)
    setActionMode('main')

    if (String(id).startsWith('temp_')) return

    let { error } = await supabase.rpc('edit_message', { p_message_id: id, p_body: bodyToSave })
    if (error) {
      ;({ error } = await supabase
        .from('messages')
        .update({ body: bodyToSave, edited_at: new Date().toISOString() })
        .eq('id', id)
        .eq('from_user', currentUserRef.current.id))
    }
    if (error) {
      showToast('Edit failed')
      loadMessages(currentUserRef.current.id, chatSourceRef.current, contextId)
    } else {
      showToast('Message edited')
      window.dispatchEvent(new Event('soko:messages-updated'))
    }
  }

  async function setMessageDisappear(msg, durationMs) {
    if (!msg?.id || msg.from_user !== currentUserRef.current?.id) return
    const expiresAt = durationMs
      ? new Date(Date.now() + durationMs).toISOString()
      : null
    setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, expires_at: expiresAt } : m))
    setActionMsg(null)
    setActionMode('main')
    if (String(msg.id).startsWith('temp_')) return

    let { error } = await supabase.rpc('set_message_expiry', {
      p_message_id: msg.id,
      p_expires_at: expiresAt,
    })
    if (error) {
      ;({ error } = await supabase
        .from('messages')
        .update({ expires_at: expiresAt })
        .eq('id', msg.id)
        .eq('from_user', currentUserRef.current.id))
    }
    if (error) showToast('Could not set timer')
    else showToast(durationMs ? 'Auto-delete scheduled' : 'Timer cleared')
  }

  function closeMessageMenu() {
    setActionMsg(null)
    setActionMode('main')
    setActionAnchorPoint(null)
  }

  function bubbleActionPoint(event) {
    if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY) && (event.clientX || event.clientY)) {
      return { x: event.clientX, y: event.clientY }
    }
    const rect = event.currentTarget?.getBoundingClientRect?.()
    if (rect) return { x: rect.right - 12, y: rect.top + 12 }
    return null
  }

  function openActions(msg, point) {
    if (!msg || msg.media_type === 'deal_request') return
    if (isMsgDeletedEveryone(msg)) return
    haptic(14)
    setImageActionMsg(null)
    setImageActionPoint(null)
    setActionMsg(msg)
    setActionMode('main')
    setActionAnchorPoint(point || null)
    setShowEmoji(false)
    setShowAttach(false)
  }

  const openImageActions = useCallback((img, point) => {
    if (!img || img._uploading) return
    haptic(14)
    setActionMsg(null)
    setActionAnchorPoint(null)
    setActionMode('main')
    setImageActionMsg(img)
    setImageActionPoint(point || null)
    setShowEmoji(false)
    setShowAttach(false)
  }, [])

  function closeImageMenu() {
    setImageActionMsg(null)
    setImageActionPoint(null)
  }

  function startEditMessage(msg) {
    if (!msg || msg.from_user !== currentUser?.id) return
    if (msg.call_type || (msg.media_url && msg.media_type && msg.media_type !== 'text')) {
      showToast('Only text messages can be edited')
      return
    }
    const decoded = decodeReply(msg.body || '')
    setEditingMsg(msg)
    setEditDraft(decoded.body || '')
    setActionMsg(null)
    setActionMode('main')
  }

  // Purge expired messages from local view periodically
  useEffect(() => {
    const tick = () => {
      const now = Date.now()
      setMessages(prev => {
        const next = prev.filter(m => {
          if (m.expires_at && new Date(m.expires_at).getTime() <= now) return false
          return true
        })
        return next.length === prev.length ? prev : next
      })
    }
    const t = setInterval(tick, 15000)
    return () => clearInterval(t)
  }, [])

  function handleBubbleDoubleTap(msg) {
    const now = Date.now()
    const last = lastTapRef.current
    if (last.id === msg.id && now - last.t < 280) {
      toggleReaction(msg, '❤️')
      lastTapRef.current = { id: null, t: 0 }
      return true
    }
    lastTapRef.current = { id: msg.id, t: now }
    return false
  }

  function onBubblePointerDown(e, msg) {
    if (e.button != null && e.button !== 0) return
    // Don't hijack interactive media controls
    if (e.target?.closest?.('a, video, audio, .media-image-wrap, .voice-play, .media-file, .msg-rx-chip')) return
    const startX = e.clientX ?? e.touches?.[0]?.clientX ?? 0
    const startY = e.clientY ?? e.touches?.[0]?.clientY ?? 0
    swipeRef.current = { id: msg.id, x: startX, y: startY, dx: 0, active: true }
    longPressFiredRef.current = false
    clearTimeout(longPressRef.current)
    longPressRef.current = setTimeout(() => {
      if (!swipeRef.current.active) return
      if (Math.abs(swipeRef.current.dx) > 12) return
      longPressFiredRef.current = true
      openActions(msg, { x: swipeRef.current.x, y: swipeRef.current.y })
      swipeRef.current.active = false
    }, 420)
  }

  function onBubblePointerMove(e, msg) {
    if (!swipeRef.current.active || swipeRef.current.id !== msg.id) return
    const x = e.clientX ?? e.touches?.[0]?.clientX ?? swipeRef.current.x
    const dx = x - swipeRef.current.x
    swipeRef.current.dx = dx
    // Cancel long-press once user is clearly swiping
    if (Math.abs(dx) > 12) clearTimeout(longPressRef.current)
    const el = document.getElementById(`msg-bubble-${msg.id}`)
    if (el) {
      // Swipe toward center of screen to reply
      const isMine = msg.from_user === currentUserRef.current?.id
      const clamped = Math.max(-72, Math.min(72, dx))
      // Mine: swipe left; theirs: swipe right
      const useful = isMine ? Math.min(0, clamped) : Math.max(0, clamped)
      el.style.transform = `translateX(${useful}px)`
      el.style.transition = 'none'
      setSwipeHintId(Math.abs(useful) > 36 ? msg.id : null)
    }
  }

  function onBubblePointerUp(e, msg) {
    clearTimeout(longPressRef.current)
    const { dx, active } = swipeRef.current
    swipeRef.current.active = false
    const el = document.getElementById(`msg-bubble-${msg.id}`)
    if (el) {
      el.style.transition = 'transform 0.18s ease'
      el.style.transform = 'translateX(0)'
    }
    const isMine = msg.from_user === currentUserRef.current?.id
    const threshold = 48
    const swipedReply = isMine ? dx < -threshold : dx > threshold
    if (active && swipedReply) {
      haptic(10)
      setReplyTo(msg)
      setTimeout(() => inputRef.current?.focus(), 50)
      setSwipeHintId(null)
      return
    }
    setSwipeHintId(null)
    // Double-tap reaction if not a swipe / long-press
    if (active && !longPressFiredRef.current && Math.abs(dx) < 10) {
      handleBubbleDoubleTap(msg)
    }
    longPressFiredRef.current = false
  }

  function onBubblePointerCancel(msg) {
    clearTimeout(longPressRef.current)
    swipeRef.current.active = false
    const el = document.getElementById(`msg-bubble-${msg.id}`)
    if (el) {
      el.style.transition = 'transform 0.18s ease'
      el.style.transform = 'translateX(0)'
    }
    setSwipeHintId(null)
  }

  // ── Presence: watch other user (online / typing / recording / last seen) ─
  function setupPresenceChannel(myId) {
    if (presenceChannelRef.current) {
      presenceChannelRef.current()
      presenceChannelRef.current = null
    }

    clearTimeout(offlineApplyRef.current)

    const unsub = watchUserOnline(
      userId,
      (isOnline, onlineAt) => {
        if (isOnline) {
          clearTimeout(offlineApplyRef.current)
          setOtherOnline(true)
          if (onlineAt) setOtherLastSeen(onlineAt)
          return
        }
        // Soft offline: re-track leave/join must not mark them offline while typing.
        // usePresence already uses grace; double-guard here with live activity refs.
        clearTimeout(offlineApplyRef.current)
        offlineApplyRef.current = setTimeout(() => {
          if (otherTypingRef.current || otherRecordingRef.current) return
          setOtherOnline(false)
          if (onlineAt) setOtherLastSeen(onlineAt)
          supabase.from('profiles').select('last_seen').eq('id', userId).maybeSingle().then(({ data }) => {
            if (data?.last_seen) {
              const d = new Date(data.last_seen)
              setOtherLastSeen(prev => (!prev || d > prev ? d : prev))
            } else if (!onlineAt) {
              setOtherLastSeen(prev => prev || new Date())
            }
          })
        }, 600)
      },
      (isTyping, meta) => {
        const myIdNow = currentUserRef.current?.id || myId
        // Show typing if addressed to me in this thread (context-matched)
        const ok = !isTyping || activityTargetsChat(meta, {
          myId: myIdNow,
          otherId: userId,
          contextId,
          source: chatSourceRef.current,
        })
        if (isTyping && ok) {
          clearTimeout(offlineApplyRef.current)
          setOtherOnline(true) // typing always means they're online
          otherTypingRef.current = true
          otherRecordingRef.current = false
          setOtherTyping(true)
          setOtherRecording(false)
          clearTimeout(typingTimeoutRef.current)
          typingTimeoutRef.current = setTimeout(() => {
            otherTypingRef.current = false
            setOtherTyping(false)
          }, 4500)
        } else if (!isTyping) {
          otherTypingRef.current = false
          setOtherTyping(false)
        }
        // If typing but for a different chat, ignore (don't flip offline)
      },
      (isRecording, meta) => {
        const myIdNow = currentUserRef.current?.id || myId
        const ok = !isRecording || activityTargetsChat(meta, {
          myId: myIdNow,
          otherId: userId,
          contextId,
          source: chatSourceRef.current,
        })
        if (isRecording && ok) {
          clearTimeout(offlineApplyRef.current)
          setOtherOnline(true)
          otherRecordingRef.current = true
          otherTypingRef.current = false
          setOtherRecording(true)
          setOtherTyping(false)
        } else if (!isRecording) {
          otherRecordingRef.current = false
          setOtherRecording(false)
        }
      },
      (lastSeenDate) => {
        if (lastSeenDate) {
          setOtherLastSeen(prev => {
            if (!prev) return lastSeenDate
            return lastSeenDate > prev ? lastSeenDate : prev
          })
        }
      },
    )

    presenceChannelRef.current = unsub
  }

  function activityTarget() {
    return {
      peerId: userId,
      contextId: contextId || null,
      source: chatSourceRef.current || chatSource || 'direct',
    }
  }

  // ── Typing indicator — scoped to this chat peer + context ─
  function handleTyping(val) {
    setNewMsg(val)
    const hasText = !!(val && String(val).trim())
    const target = activityTarget()
    if (!userId) return
    if (hasText) {
      // Keep self online + emit typing to this peer only
      setTypingIndicator(true, target)
      clearTimeout(typingTimeoutRef.current)
      typingTimeoutRef.current = setTimeout(() => {
        setTypingIndicator(false, target)
      }, 2000)
    } else {
      clearTimeout(typingTimeoutRef.current)
      setTypingIndicator(false, target)
    }
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  async function loadMessages(myId, source, ctxId) {
    let query = supabase.from('messages').select('*')
      .or(`and(from_user.eq.${myId},to_user.eq.${userId}),and(from_user.eq.${userId},to_user.eq.${myId})`)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)

    query = applyContextFilter(query, source, ctxId)

    // Direct chats: prefer rows without context FKs. If chat_source exists, also accept direct.
    // Fallback: if filtered result is empty for direct, show person-level history without context filter
    // (legacy threads). For contextual sources we keep the filter strict.
    let { data, error } = await query
    if (!error && source === 'direct' && (!data || data.length === 0) && !ctxId) {
      // Legacy: some older messages may not have null FKs cleanly; leave empty rather than mixing sources
      data = data || []
    }

    if (error) {
      // Columns may not exist yet — fall back without the new FKs
      console.warn('[Chat] loadMessages filter error, retrying loosely:', error.message)
      let fallback = supabase.from('messages').select('*')
        .or(`and(from_user.eq.${myId},to_user.eq.${userId}),and(from_user.eq.${userId},to_user.eq.${myId})`)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)
      if (source === 'service' && ctxId) fallback = fallback.eq('service_id', ctxId)
      else if (source === 'listing' && ctxId) fallback = fallback.eq('listing_id', ctxId)
      const res = await fallback
      data = res.data || []
      error = res.error
    }

    if (!error) {
      // Client-side source filter for mixed legacy threads
      if (ctxId && source && source !== 'direct') {
        data = (data || []).filter(m => {
          if (source === 'service') return m.service_id === ctxId
          if (source === 'listing') return m.listing_id === ctxId
          if (source === 'shop') return !m.shop_id || m.shop_id === ctxId || m.chat_source === 'shop'
          if (source === 'request') return !m.request_id || m.request_id === ctxId || m.chat_source === 'request'
          return true
        })
      }
      // Apply hide-for-me + expiry; keep soft-deleted for everyone as placeholders
      let localHidden = []
      try {
        localHidden = JSON.parse(localStorage.getItem(`soko_msg_hidden_${myId}`) || '[]')
      } catch { localHidden = [] }
      const now = Date.now()
      data = (data || []).filter(m => {
        if (localHidden.includes(m.id)) return false
        if (Array.isArray(m.hidden_for) && m.hidden_for.includes(myId)) return false
        if (m.expires_at && new Date(m.expires_at).getTime() <= now) return false
        return true
      })
      const messagesForDisplay = (data || []).reverse() // newest→oldest ⇒ oldest→newest
      setMessages(messagesForDisplay)
      const forGrouping = messagesForDisplay.filter(m => !(m.deleted_at && m.media_type === 'image' && !m.media_url))
      setGroupedMessages(imageGroupingService.groupMessages(forGrouping))
      if (!isFromRequest.current && messagesForDisplay?.some(m =>
        m.chat_source === 'request' || m.body?.includes('I can help with your request') || m.body?.includes('I saw your request for')
      )) {
        setIsRequestChat(true)
      }
      if (messagesForDisplay.length < PAGE_SIZE) setHasMore(false)
      if (messagesForDisplay.length > 0) oldestLoadedIdRef.current = messagesForDisplay[0].id
    }
  }

  // ── Pagination: load one older page (infinite scroll upward) ────────────
  const loadMoreMessages = useCallback(async () => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)

    const myUserId = currentUserRef.current?.id

    // Get created_at of the oldest message currently loaded
    const oldest = messages.find(m => m.id === oldestLoadedIdRef.current)
    if (!oldest) { setLoadingMore(false); return }

    let query = supabase.from('messages').select('*')
      .or(`and(from_user.eq.${myUserId},to_user.eq.${userId}),and(from_user.eq.${userId},to_user.eq.${myUserId})`)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE)
    query = applyContextFilter(query, chatSourceRef.current, contextId)

    const { data, error } = await query
    if (error) {
      console.warn('[Chat] loadMoreMessages error:', error.message)
      setLoadingMore(false)
      return
    }

    // Same client-side filtering as loadMessages
    let older = data || []
    let localHidden = []
    try {
      localHidden = JSON.parse(localStorage.getItem(`soko_msg_hidden_${currentUserRef.current?.id}`) || '[]')
    } catch { localHidden = [] }
    const now = Date.now()
    older = older.filter(m => {
      if (localHidden.includes(m.id)) return false
      if (Array.isArray(m.hidden_for) && m.hidden_for.includes(currentUserRef.current?.id)) return false
      if (m.expires_at && new Date(m.expires_at).getTime() <= now) return false
      return true
    })
    older = older.reverse() // oldest→newest for prepending

    if (older.length < PAGE_SIZE) setHasMore(false)
    const el = scrollContainerRef.current
    const prevScrollHeight = el ? el.scrollHeight : 0

    if (older.length > 0) oldestLoadedIdRef.current = older[0].id
    const nextRaw = [...older, ...messages]
    setMessages(nextRaw)
    setGroupedMessages(imageGroupingService.groupMessages(nextRaw))

    // Preserve scroll position after prepending older messages
    requestAnimationFrame(() => {
      if (el) el.scrollTop = el.scrollHeight - prevScrollHeight
    })

    setLoadingMore(false)
  }, [loadingMore, hasMore, messages, userId, contextId, chatSourceRef, currentUserRef])

  const handleScroll = useCallback(() => {
    const el = scrollContainerRef.current
    if (!el) return
    if (el.scrollTop <= 80 && hasMore && !loadingMore) {
      loadMoreMessages()
    }
  }, [hasMore, loadingMore, loadMoreMessages])

  // ── sendMessage — optimistic UI + reply encoded in body ─────────────────
  async function sendMessage(body, type = 'text', mediaUrl = null, extraFields = {}, opts = {}) {
    console.log('SM_ENTRY', { body, type, mediaUrl, trimmed: body.trim() })
    const trimmed = body.trim()
    if (!trimmed && !mediaUrl && !extraFields.call_status) return

    // Receiver must accept first DM before sending replies
    const gateActive = chatSourceRef.current === 'direct'
      && !dmAccepted
      && messages.some(m => m.from_user === userId)
      && !messages.some(m => m.from_user === currentUserRef.current?.id && !String(m.id).startsWith('temp_'))
    if (gateActive && !extraFields.call_status) {
      showToast('Continue the chat first')
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }

    const replySnapshot = opts.replyTo !== undefined ? opts.replyTo : replyTo
    const encodedBody = encodeReply(trimmed, replySnapshot)
    const { call_notify: callNotify, ...persistFields } = extraFields

    const src = chatSourceRef.current || chatContextRef.current?.source || 'direct'
    const ctx = chatContextRef.current?.contextId || contextId || null
    const contextFields = messageContextFields(src, ctx)

    const msgData = {
      from_user: user.id,
      to_user: userId,
      body: encodedBody || persistFields.body || '',
      media_url: mediaUrl,
      media_type: type,
      read: false,
      ...contextFields,
      ...persistFields,
    }
    // Default disappearing timer for new sends (optional)
    if (defaultDisappear && !extraFields.call_status && !msgData.expires_at) {
      msgData.expires_at = new Date(Date.now() + defaultDisappear).toISOString()
    }

    // Optimistic bubble (skip for call status events)
    const tempId = opts.tempId || `temp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
    const isCallEvent = !!extraFields.call_status
    if (!isCallEvent) {
      const optimistic = {
        ...msgData,
        id: tempId,
        created_at: new Date().toISOString(),
        _status: 'sending',
        _retry: { body: trimmed, type, mediaUrl, extraFields, replyTo: replySnapshot },
      }
      setMessages(prev => {
        const without = opts.replaceTempId ? prev.filter(m => m.id !== opts.replaceTempId) : prev
        return [...without, optimistic]
      })
      setGroupedMessages(prev => imageGroupingService.appendMessage(prev, optimistic))
      nearBottomRef.current = true
      setNewMsg('')
      setReplyTo(null)
      if (inputRef.current) inputRef.current.style.height = 'auto'
      setTypingIndicator(false, activityTarget())
      clearTimeout(typingTimeoutRef.current)
      haptic(6)
    }

    // Insert; if new source columns aren't migrated yet, retry without them
    let inserted = null
    let error = null
    {
      const res = await supabase.from('messages').insert(msgData).select('*').single()
      inserted = res.data
      error = res.error
    }
    if (error && /chat_source|shop_id|request_id|column/i.test(error.message || '')) {
      const legacy = { ...msgData }
      delete legacy.chat_source
      delete legacy.shop_id
      delete legacy.request_id
      // Keep listing_id / service_id which already exist
      if (src === 'shop' || src === 'request') {
        // No FK available — still deliver as person-level message with body
      }
      const res2 = await supabase.from('messages').insert(legacy).select('*').single()
      inserted = res2.data
      error = res2.error
    }

    if (error) {
      if (!isCallEvent) {
        setMessages(prev => prev.map(m => (
          m.id === tempId ? { ...m, _status: 'failed' } : m
        )))
        showToast('Failed to send')
      } else {
        alert('Failed to send: ' + error.message)
      }
      return
    }

    if (!isCallEvent) {
      setMessages(prev => {
        const withoutTemp = prev.filter(m => m.id !== tempId && m.id !== inserted.id)
        return [...withoutTemp, { ...inserted, _status: undefined }]
      })
    }

    window.dispatchEvent(new Event('soko:messages-updated'))

    if (isCallEvent) {
      // call path previously cleared nothing special
    }

    const notifContextId = contextId || null
    const callType = extraFields.call_type === 'video' ? 'video' : 'voice'
    const contextTitle = listing?.title || service?.name || shop?.name || request?.title || null
    if (callNotify === 'missed_to_peer') {
      await notifyMissedCall({
        toUserId: userId,
        callerId: user.id,
        callType,
        contextId: notifContextId,
        messageId: inserted?.id || null,
        listingTitle: contextTitle,
      })
    } else if (callNotify === 'declined_to_peer') {
      await notifyCallDeclined({
        toUserId: userId,
        declinerId: user.id,
        callType,
        contextId: notifContextId,
        messageId: inserted?.id || null,
        listingTitle: contextTitle,
      })
    }

    if (!extraFields.call_status) {
      try {
        const { data: myProf } = await supabase
          .from('profiles').select('full_name').eq('id', user.id).single()
        const senderName = myProf?.full_name || 'Someone'

        // Offers use their own notification system (offerNotifications.js) instead
        // of the generic new_message row — deep-links straight into the chat and
        // differentiates new vs counter offers.
        if (type === 'offer') {
          const parsedOffer = parseOfferMessage(trimmed)
          if (parsedOffer?.ok && parsedOffer.offer) {
            const offer = parsedOffer.offer
            const notifCtx = contextId || notifContextId || null
            const params = {
              toUserId: userId,
              actorId: user.id,
              actorName: senderName,
              offer,
              listingTitle: contextTitle,
              listingId: notifContextId || null,
              contextId: notifCtx,
              messageId: inserted?.id || null,
            }
            if (offer.parent_offer_id) await notifyOfferCounter(params)
            else await notifyOfferNew(params)
          }
        } else {
          let preview = trimmed
          if (preview.includes('|||')) {
            // eslint-disable-next-line no-control-regex
            preview = preview.replace(/^\x02?\[/, '').split('|||')[0].trim()
          }
          if (!preview) {
            preview = mediaUrl
              ? (type === 'image' ? '📷 Photo'
               : type === 'video' ? '🎥 Video'
               : type === 'audio' ? '🎤 Voice note'
               : '📎 File')
              : 'Sent a message'
          }
          await supabase.from('notifications').insert({
            user_id: userId,
            type: 'new_message',
            title: senderName,
            body: preview.slice(0, 80),
            message: preview.slice(0, 80),
            data: {
              sender_id: user.id,
              sender_name: senderName,
              context_id: notifContextId,
              message_id: inserted?.id || null,
              ...messageContextFields(src, notifContextId),
              chat_source: src,
              listing_title: contextTitle,
            },
            read: false,
          })
        }
} catch (notifErr) {
          console.warn('Message notification error:', notifErr)
        }
      }
    return inserted ?? null
  }

  function retryMessage(msg) {
    if (!msg?._retry) return
    const { body, type, mediaUrl, extraFields, replyTo: r } = msg._retry
    sendMessage(body || '', type || 'text', mediaUrl || null, extraFields || {}, {
      replaceTempId: msg.id,
      replyTo: r || null,
    })
  }

  async function uploadSingleImage(item, index, pendingId) {
    const file = item.file
    const ext = file.name?.split('.').pop() || 'bin'
    const rawName = (file.name || 'image').replace(/\.[^/.]+$/, '')
    const safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
    const path = `chat/${currentUser.id}/${safeName}_${Date.now()}_${index}.${ext}`

    const url = await uploadToR2(file, path, pct => {
      setPreview(items => items.map((item, i) => i === index ? { ...item, _uploadProgress: pct } : item))
      setGroupedMessages(prev => prev.map(m => {
        if (m.id !== pendingId) return m
        const newGroup = m._imageGroup.map((img, i) =>
          i === index ? { ...img, _uploadProgress: pct } : img
        )
        return { ...m, _imageGroup: newGroup }
      }))
    })

    await sendMessage(item.caption || '', 'image', url)
    // Mark this image as done in the pending group
    setGroupedMessages(prev => prev.map(m => {
      if (m.id !== pendingId) return m
      const newGroup = m._imageGroup.map((img, i) =>
        i === index ? { ...img, _uploading: false, _uploadProgress: 100 } : img
      )
      return { ...m, _imageGroup: newGroup }
    }))
  }

  async function uploadQueue(items) {
    if (!items.length) return

    const isMultiImage = items.length > 1 && items.every(it => it.type === 'image')

    if (isMultiImage) {
      // Build an optimistic pending group with all images at their final positions
      const pendingId = `pending_group_${Date.now()}`
      pendingGroupIdRef.current = pendingId
      const pendingImgs = items.map((it, i) => ({
        id: `${pendingId}_${i}`,
        from_user: currentUser?.id,
        created_at: new Date().toISOString(),
        media_type: 'image',
        media_url: it.url,           // object URL for immediate preview
        _uploading: true,
        _uploadProgress: 0,
        _localIndex: i,
      }))
      const pendingGroup = {
        ...pendingImgs[0],
        id: pendingId,
        _isGroup: true,
        _isPending: true,
        _imageGroup: pendingImgs,
      }
      setGroupedMessages(prev => [...prev, pendingGroup])
      setUploading(true)

      // Upload all in parallel
      const results = await Promise.allSettled(
        items.map((item, i) => uploadSingleImage(item, i, pendingId))
      )

      // Remove pending group regardless of outcome — realtime echoes will fill in successful ones
      setGroupedMessages(prev => prev.filter(m => m.id !== pendingId))
      pendingGroupIdRef.current = null
      setGroupedMessages(imageGroupingService.groupMessages(messages))
      setUploading(false)
      setPreview([])
      setUploadProgress(0)

      // For failed ones, show an alert
      const failed = results.filter(r => r.status === 'rejected').length
      if (failed > 0) alert(`${failed} image${failed > 1 ? 's' : ''} failed to upload. Others were sent.`)

    } else {
      // Single file or non-image — use existing sequential path
      for (const item of items) {
        await uploadAndSend(item.file, item.type, item.caption)
      }
      setPreview([])
      setUploadProgress(0)
    }
  }

async function uploadAndSend(file, type, caption = '') {
  console.log('UAS_START', { type, fileType: file?.type, fileSize: file?.size })
  setUploading(true)
  setUploadProgress(0)
  try {
    const ext = file.name?.split('.').pop() || 'bin'
    const rawName = (file.name || type).replace(/\.[^/.]+$/, '')
    const safeName = rawName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40)
    const path = `chat/${currentUser.id}/${safeName}_${Date.now()}.${ext}`
    const url = await uploadToR2(file, path, pct => setUploadProgress(pct))
    console.log('UAS_R2_URL', url, typeof url)
    console.log('UAS_CALLING_SEND', { caption, type, url })
    await sendMessage(caption, type, url)
  } catch (e) {
    console.log('CHAT_UPLOAD_FULL_ERROR', e)
    alert('Upload failed: ' + e.message)
  }
  setUploading(false)
}

  function pickFile(accept, type, opts = {}) {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    if (opts.capture) input.setAttribute('capture', opts.capture)
    // Allow multiple only for image and generic file types
    if (type === 'image' || type === 'file') input.multiple = true
    input.onchange = e => {
      const files = Array.from(e.target.files)
      if (!files.length) return
      const items = files.map(file => {
        let resolved = type
        if (type === 'file' && file.type) {
          if (file.type.startsWith('image/')) resolved = 'image'
          else if (file.type.startsWith('video/')) resolved = 'video'
          else if (file.type.startsWith('audio/')) resolved = 'audio'
        }
        return { file, url: URL.createObjectURL(file), type: resolved, caption: '' }
      })
      setPreview(items)
    }
    input.click()
  }

  function sendOffer() {
    const amount = Number(String(offerAmount || '').replace(/[^\d.]/g, ''))
    if (!Number.isFinite(amount) || amount <= 0) {
      showToast('Enter a valid amount')
      return
    }
    const note = offerNote.trim()
    const prevParsed = counterParent ? parseOfferMessage(counterParent.body) : null

    // ── Mode 1: EDIT — update the same message, status stays pending ──
    if (editOfferMsg) {
      const parsed = parseOfferMessage(editOfferMsg.body)
      if (!parsed || !parsed.ok) {
        showToast('Could not read this offer')
        return
      }
      if (parsed.offer.status !== OFFER_STATUS.pending || isOfferExpired(parsed.offer)) {
        showToast('This offer can no longer be edited')
        return
      }
      const updated = {
        ...parsed.offer,
        amount,
        note,
        // Phase 9 — sender may change the expiry window while editing
        expires_in_hours: offerExpiryHours,
        // preserve offer_id / parent_offer_id / created_at (chain + expiry history)
      }
      applyOfferUpdate(editOfferMsg.id, JSON.stringify(updated))
      supabase
        .from('messages')
        .update({ body: JSON.stringify(updated), edited_at: new Date().toISOString() })
        .eq('id', editOfferMsg.id)
        .then(res => { if (res.error) console.warn('Offer edit failed:', res.error.message) })
      closeOfferSheet()

      // Phase 5 — let the other party know the offer changed (amount / note / time)
      const notifTitle = (() => {
        const entry = offerListings[parsed.offer.listing_id]
        if (entry?.status === 'ok' && entry.listing) return entry.listing.title
        if (parsed.offer.listing_id === listing?.id && listing) return listing.title
        return null
      })()
      notifyOfferEdited({
        toUserId: editOfferMsg.to_user || userId,
        actorId: currentUser?.id,
        actorName: myProfile?.full_name || null,
        offer: updated,
        listingTitle: notifTitle,
        listingId: parsed.offer.listing_id || null,
        contextId: parsed.offer.listing_id || contextId || null,
        messageId: editOfferMsg.id,
      }).catch(() => {})
      return
    }

    // ── Mode 2: COUNTER — new offer linked to the active offer ──
    if (counterParent) {
      if (!prevParsed || !prevParsed.ok) {
        showToast('Could not read the previous offer')
        return
      }
      // Only the single active (pending) offer may be countered — superseded /
      // responded offers are locked. Guards against double-sends / stale state.
      if (prevParsed.offer.status !== OFFER_STATUS.pending || isOfferExpired(prevParsed.offer)) {
        showToast('This offer is no longer active')
        return
      }
      // Counter offer: a NEW offer with its own offer_id, linked to the previous
      // offer's offer_id via parent_offer_id (Phase 3 negotiation chain). Old
      // payloads lacking offer_id fall back to the parent message id.
      const parentOid = prevParsed.offer.offer_id || String(counterParent.id)
      const payload = buildOfferPayload({
        amount,
        note,
        listingId: prevParsed.offer.listing_id || listing?.id,
        parentOfferId: parentOid,
        expiresInHours: offerExpiryHours,
      })
      sendOfferMessage(payload)
      // Phase 3 — supersede the parent immediately (only one active offer). The
      // child offer_id is known client-side, so the backlink is written
      // synchronously; the realtime UPDATE echoes it to both sides.
      const updated = {
        ...prevParsed.offer,
        status: OFFER_STATUS.superseded,
        responded_by: currentUser?.id || null,
        responded_at: new Date().toISOString(),
        counter_offer_id: payload.offer_id,
      }
      applyOfferUpdate(counterParent.id, JSON.stringify(updated))
      supabase
        .from('messages')
        .update({ body: JSON.stringify(updated) })
        .eq('id', counterParent.id)
        .then(res => { if (res.error) console.warn('Offer supersede update failed:', res.error.message) })
      closeOfferSheet()
      return
    }

    // ── Mode 3: NEW OFFER (including Duplicate) ──
    const payload = buildOfferPayload({ amount, note, listingId: listing?.id, expiresInHours: offerExpiryHours })
    sendOfferMessage(payload)
    closeOfferSheet()
  }

  /** Send the offer through the standard message pipeline (optimistic bubble etc.). */
  function sendOfferMessage(payload) {
    sendMessage(
      JSON.stringify(payload),
      'offer',
      null,
      { listing_id: payload.listing_id || listing?.id || null },
      { replyTo: null }
    )
  }

  function closeOfferSheet() {
    setShowOffer(false)
    setOfferAmount('')
    setOfferNote('')
    setCounterParent(null)
    setEditOfferMsg(null)
    setOfferExpiryHours(OFFER_DEFAULT_EXPIRY_HOURS)
    setOfferCustomExpiry('')
    setWithdrawConfirmId(null)
  }

  /** Phase 4 — prefill the sheet to EDIT an existing pending offer (no new message). */
  function openEditOffer(msg) {
    const parsed = parseOfferMessage(msg.body)
    if (!parsed || !parsed.ok) return
    if (parsed.offer.status !== OFFER_STATUS.pending || isOfferExpired(parsed.offer)) return
    setEditOfferMsg(msg)
    setCounterParent(null)
    setOfferAmount(String(parsed.offer.amount))
    setOfferNote(parsed.offer.note || '')
    setOfferExpiryHours(Number.isFinite(parsed.offer.expires_in_hours)
      ? parsed.offer.expires_in_hours
      : OFFER_DEFAULT_EXPIRY_HOURS)
    setShowOffer(true)
  }

  /** Phase 4 — two-step Withdraw: first tap arms, second tap persists. */
  function onWithdrawClick(msg) {
    if (withdrawConfirmId === msg.id) {
      withdrawOffer(msg)
    } else {
      setWithdrawConfirmId(msg.id)
    }
  }

  /** Phase 4 — withdraw the buyer's own pending offer (terminal, read-only). */
  async function withdrawOffer(msg) {
    if (!currentUser?.id) return
    if (msg.from_user !== currentUser.id) {
      showToast('Only the sender can withdraw this offer')
      return
    }
    const parsed = parseOfferMessage(msg.body)
    if (!parsed.ok) {
      showToast('Could not read this offer')
      return
    }
    if (parsed.offer.status !== OFFER_STATUS.pending || isOfferExpired(parsed.offer)) {
      showToast('This offer can no longer be withdrawn')
      return
    }
    const updated = {
      ...parsed.offer,
      status: OFFER_STATUS.withdrawn,
      responded_by: currentUser.id,
      responded_at: new Date().toISOString(),
    }
    applyOfferUpdate(msg.id, JSON.stringify(updated))
    const { error } = await supabase
      .from('messages')
      .update({ body: JSON.stringify(updated) })
      .eq('id', msg.id)
    if (error) {
      console.warn('Offer withdraw failed:', error.message)
      showToast('Could not withdraw offer — try again')
      loadMessages(currentUser.id, chatSourceRef.current, contextId)
      return
    }
    setWithdrawConfirmId(null)
    showToast('Offer withdrawn')

    // Phase 5 — in-app notification for the recipient (offer withdrawn)
    const notifTitle = (() => {
      const entry = offerListings[parsed.offer.listing_id]
      if (entry?.status === 'ok' && entry.listing) return entry.listing.title
      if (parsed.offer.listing_id === listing?.id && listing) return listing.title
      return null
    })()
    notifyOfferWithdrawn({
      toUserId: msg.to_user || userId,
      actorId: currentUser.id,
      actorName: myProfile?.full_name || null,
      offer: parsed.offer,
      listingTitle: notifTitle,
      listingId: parsed.offer.listing_id || null,
      contextId: parsed.offer.listing_id || contextId || null,
      messageId: msg.id,
    }).catch(() => {})
  }


  /**
   * Optimistically apply an offer body update to both the raw list and the render
   * grouping, mirroring the realtime UPDATE handler so the card refreshes
   * immediately and converges once the DB update is echoed back.
   */
  function applyOfferUpdate(msgId, bodyJson) {
    setMessages(prev => {
      const next = prev.map(m => (m.id === msgId ? { ...m, body: bodyJson } : m))
      const forGrouping = next.filter(m => !(m.deleted_at && m.media_type === 'image' && !m.media_url))
      setGroupedMessages(imageGroupingService.groupMessages(forGrouping))
      return next
    })
  }

  /**
   * Phase 2 — Accept / Decline. Only the offer's recipient can respond, and only
   * while the offer is pending (prevents multiple responses). Decline requires an
   * explicit confirm step handled by the UI (declineConfirmId).
   */
  async function respondToOffer(msg, action) {
    if (!currentUser?.id) return
    if (msg.from_user === currentUser.id) {
      showToast('Only the offered party can respond')
      return
    }
    const parsed = parseOfferMessage(msg.body)
    if (!parsed.ok) {
      showToast('Could not read this offer')
      return
    }
    if (parsed.offer.status !== OFFER_STATUS.pending) {
      showToast('This offer has already been responded to')
      return
    }
    const updated = {
      ...parsed.offer,
      status: action,
      responded_by: currentUser.id,
      responded_at: new Date().toISOString(),
    }
    applyOfferUpdate(msg.id, JSON.stringify(updated))
    const { error } = await supabase
      .from('messages')
      .update({ body: JSON.stringify(updated) })
      .eq('id', msg.id)
    if (error) {
      console.warn('Offer response failed:', error.message)
      showToast('Could not update offer — try again')
      loadMessages(currentUser.id, chatSourceRef.current, contextId)
      return
    }
    setDeclineConfirmId(null)
    showToast(action === OFFER_STATUS.accepted ? 'Offer accepted' : 'Offer declined')

    // Phase 5 — in-app notifications for the offerer (accepted / declined)
    const notifTitle = (() => {
      const entry = offerListings[parsed.offer.listing_id]
      if (entry?.status === 'ok' && entry.listing) return entry.listing.title
      if (parsed.offer.listing_id === listing?.id && listing) return listing.title
      return null
    })()
    const notifFn = action === OFFER_STATUS.accepted ? notifyOfferAccepted : notifyOfferDeclined
    notifFn({
      toUserId: msg.from_user,
      actorId: currentUser.id,
      actorName: myProfile?.full_name || null,
      offer: parsed.offer,
      listingTitle: notifTitle,
      listingId: parsed.offer.listing_id || null,
      contextId: parsed.offer.listing_id || contextId || null,
      messageId: msg.id,
    }).catch(() => {})
  }

  /** Prefill the existing offer sheet with the previous offer for a counter offer. */
  function openCounterOffer(msg) {
    const parsed = parseOfferMessage(msg.body)
    if (!parsed || !parsed.ok) return
    setEditOfferMsg(null)
    setCounterParent(msg)
    setOfferAmount(String(parsed.offer.amount))
    setOfferNote(parsed.offer.note || '')
    const hrs = Number.isFinite(parsed.offer.expires_in_hours)
      ? parsed.offer.expires_in_hours
      : OFFER_DEFAULT_EXPIRY_HOURS
    setOfferExpiryHours(hrs)
    const isPreset = OFFER_EXPIRY_OPTIONS.some(o => o.hours === hrs)
    setOfferCustomExpiry(isPreset ? '' : String(hrs > 0 ? hrs : 24))
    setShowOffer(true)
  }

  function insertEmoji(emoji) {
    // Use the tracked cursor (survives blur when the picker steals focus) instead
    // of reading selectionStart off a possibly-unfocused textarea (returns 0).
    const pos = cursorPosRef.current ?? newMsg.length
    const next = newMsg.slice(0, pos) + emoji + newMsg.slice(pos)
    // Restore the caret right after the inserted emoji, once the new value is committed.
    pendingEmojiCursorRef.current = pos + emoji.length
    cursorPosRef.current = pos + emoji.length
    // Single state path — handleTyping owns setNewMsg (and typing indicator).
    handleTyping(next)
    // Record emoji as recently used: move to front, drop duplicates, cap the list.
    setRecentEmojis(prev => {
      const updated = [emoji, ...prev.filter(e => e !== emoji)].slice(0, RECENT_EMOJI_LIMIT)
      saveRecentEmojis(updated)
      return updated
    })
  }

  // After a programmatic emoji insert, React has committed the new value. Re-focus
  // the textarea and place the caret directly after the emoji so the user can keep
  // typing immediately (and insert more emojis consecutively).
  useEffect(() => {
    const at = pendingEmojiCursorRef.current
    if (at == null) return
    pendingEmojiCursorRef.current = null
    const el = inputRef.current
    if (!el) return
    // Only refocus when the picker is closed. While the picker is open, refocusing
    // would pop the keyboard back up on every emoji tap — focus/keyboard reopen
    // happens exclusively via the keyboard-swap button instead.
    if (!showEmoji) el.focus()
    // setSelectionRange is fine on an unfocused element — records the caret so it's
    // correct when the picker closes and the user returns to typing.
    el.setSelectionRange(at, at)
    // Keep autosize in sync for programmatic inserts (onChange only handles typing);
    // must run regardless of focus since content changed and needs to resize visually.
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 105) + 'px'
  }, [newMsg, showEmoji])

  // ── Voice recording ──────────────────────────────────────────────────────
  async function startRecording() {
    const target = activityTarget()
    try {
      setTypingIndicator(false, target)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioCtx = new AudioContext()
      const analyser = audioCtx.createAnalyser()
      audioCtx.createMediaStreamSource(stream).connect(analyser)
      analyser.fftSize = 128; analyserRef.current = analyser
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        try {
          stream.getTracks().forEach(t => t.stop()); audioCtx.close()
          cancelAnimationFrame(animFrameRef.current)
          setRecordingIndicator(false, target)
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          const voiceFile = new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' })
          console.log('CHAT_VOICE_FILE', { type: voiceFile.type, size: voiceFile.size, name: voiceFile.name })
          await uploadAndSend(voiceFile, 'audio', '')
        } catch (e) {
          console.log('VOICE_RECORD_ERROR', e)
          alert('Voice note failed: ' + e.message)
        }
      }
      mr.start(); mediaRecorderRef.current = mr
      setRecording(true); setRecordingTime(0)
      setRecordingIndicator(true, target)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch (e) {
      setRecordingIndicator(false, target)
      alert('Microphone access denied')
    }
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop(); setRecording(false)
    setRecordingIndicator(false, activityTarget())
    clearInterval(timerRef.current); cancelAnimationFrame(animFrameRef.current)
    setRecordingTime(0)
  }

  function cancelRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
    }
    setRecording(false)
    setRecordingIndicator(false, activityTarget())
    clearInterval(timerRef.current)
    cancelAnimationFrame(animFrameRef.current)
    setRecordingTime(0)
  }

  // ── Audio playback ───────────────────────────────────────────────────────
  const toggleAudio = useCallback(function toggleAudio(id) {
    const audio = audioRefs.current[id]; if (!audio) return
    if (playingId === id) { audio.pause(); setPlayingId(null) }
    else {
      if (playingId && audioRefs.current[playingId]) audioRefs.current[playingId].pause()
      audio.play(); setPlayingId(id)
      audio.onended = () => setPlayingId(null)
      audio.ontimeupdate = () =>
        setAudioProgress(p => ({ ...p, [id]: audio.duration ? audio.currentTime / audio.duration : 0 }))
      audio.onloadedmetadata = () =>
        setAudioDuration(d => ({ ...d, [id]: audio.duration }))
    }
  }, [playingId])

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(newMsg) }
  }

  // ── Presence helpers ─────────────────────────────────────────────────────
  function lastSeenLabel(date) {
    return formatLastSeen(date)
  }

  // Re-render last-seen text every 30s so "minutes ago" stays accurate
  const [, setLastSeenTick] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setLastSeenTick(n => n + 1), 30_000)
    return () => clearInterval(t)
  }, [])

  // Live offer expiry: flip pending offers to "expired" exactly when time is due.
  // Re-triggers a render right at the nearest pending offer's deadline, then again
  // after it passes so the card re-renders as expired. Also re-ticks each minute so
  // any due-soon countdowns stay fresh even if scheduling drifts.
  const [, setOfferExpiryTick] = useState(0)
  useEffect(() => {
    let timer
    let interval
    const refresh = () => {
      const due = Date.now() + 1200
      let nearest = null
      for (const m of messages) {
        if (m.media_type !== 'offer') continue
        const parsed = parseOfferMessage(m.body)
        if (!parsed?.ok) continue
        const o = parsed.offer
        if (o.status !== OFFER_STATUS.pending) continue
        const at = offerExpiresAt(o)
        if (!at) continue
        const t = new Date(at).getTime()
        if (t <= due) { if (t > Date.now()) nearest = Math.min(nearest ?? t, t) }
        else nearest = nearest == null ? t : Math.min(nearest, t)
      }
      clearTimeout(timer)
      clearInterval(interval)
      if (nearest != null) {
        const wait = Math.max(0, nearest - Date.now()) + 150
        timer = setTimeout(() => { setOfferExpiryTick(n => n + 1); refresh() }, wait)
        // Countdowns show whole minutes, so one tick per minute is enough.
        interval = setInterval(() => setOfferExpiryTick(n => n + 1), 60_000)
      } else {
        // No active deadline — poll loosely so newly created offers get scheduled
        interval = setInterval(() => setOfferExpiryTick(n => n + 1), 60_000)
      }
    }
    refresh()
    // Phase 5 — drive the offer notification system (approaching deadline +
    // expired) off the same ticker; it re-checks every tick on `messages`.
    if (currentUser?.id && messages.some(m => m.media_type === 'offer')) {
      scanOfferNotifications({ messages, currentUserId: currentUser.id, contextId })
        .catch(() => {})
    }
    return () => { clearTimeout(timer); clearInterval(interval) }
  }, [messages])

  // ── Avatar helpers ───────────────────────────────────────────────────────
  const otherName    = otherProfile?.full_name || otherUser?.name || otherUser?.email || 'User'
  const displayName  = toTitleCase(otherName)
  const otherAvatar  = otherProfile?.avatar_url || null
  const otherInitial = displayName[0].toUpperCase()
  const disappearLabel = DISAPPEAR_OPTIONS.find(opt => opt.ms === defaultDisappear)?.label || 'Off'
  const chatDisabledReason = chatStatus.closed
    ? 'This chat is closed.'
    : chatStatus.blockedMe
      ? 'You cannot reply because this user blocked you.'
      : chatStatus.blockedByMe
        ? 'You cannot reply because you blocked this user.'
        : null
  const dmAcceptKey = currentUser?.id && userId
    ? `soko_dm_accept_${currentUser.id}_${userId}`
    : null
  const showDmGate = chatSource === 'direct'
    && !!currentUser?.id
    && messages.length > 0
    && !dmAccepted
    && messages.some(m => m.from_user === userId)
    && !messages.some(m => m.from_user === currentUser.id && !String(m.id).startsWith('temp_'))
  const offersAllowedToday = (chatSource === 'listing' || chatSource === 'request')
    && !chatDisabledReason
  const linkedContextChat = (!!contextId && ['listing', 'request', 'service'].includes(chatSource)) || isRequestChat
  const showQuickReplies = linkedContextChat
    && messages.length < 3
    && !newMsg.trim()
    && preview.length === 0
    && !replyTo
    && !chatDisabledReason
    && !showDmGate
  const composerHasContent = !!newMsg.trim() || preview.length > 0

  function openComposerOffer() {
    setShowAttach(false)
    setCounterParent(null)
    setEditOfferMsg(null)
    setShowOffer(true)
    setShowEmoji(false)
  }

  // ── Render helpers ───────────────────────────────────────────────────────
  function dateChipLabel(iso) {
    const d = new Date(iso)
    const now = new Date()
    const startOfDay = t => new Date(t.getFullYear(), t.getMonth(), t.getDate())
    const today = startOfDay(now).getTime()
    const diffDays = Math.round((today - startOfDay(d).getTime()) / 864e5)
    const monthDay = d.toLocaleDateString([], { month: 'short', day: 'numeric' })
    if (diffDays === 0) return 'Today'
    if (diffDays === 1) return 'Yesterday'
    if (diffDays < 7) return d.toLocaleDateString([], { weekday: 'long' })
    const sameYear = d.getFullYear() === now.getFullYear()
    return sameYear
      ? monthDay
      : `${monthDay}, ${d.getFullYear()}`
  }

  function audioLabelFromUrl(url) {
    const base = (url || '').split('/').pop() || ''
    const clean = base.split('?')[0]
    if (/^voice_/i.test(clean)) return 'Voice note'
    const ext = clean.split('.').pop()
    return ext ? ext.toUpperCase() : 'Audio'
  }

  const renderVoiceNote = useCallback(function renderVoiceNote(msg) {
    const { id, media_url: url } = msg
    const isVoiceNote = /^voice_/i.test((url || '').split('/').pop().split('?')[0])
    const isMine    = msg.from_user === currentUser?.id
    const progress  = audioProgress[id] || 0
    const duration  = audioDuration[id] || 0
    const isPlaying = playingId === id
    const bars = 28
    return (
      <div className={`voice-note ${isVoiceNote ? 'is-voice' : 'is-file-audio'}`}>
        <audio
          ref={el => {
            if (el) {
              audioRefs.current[id] = el
              el.onloadedmetadata = () => setAudioDuration(d => ({ ...d, [id]: el.duration }))
            }
          }}
          src={url}
          preload="metadata"
        />
        <button
          type="button"
          className="voice-play"
          onClick={() => toggleAudio(id)}
          aria-label={isPlaying ? 'Pause voice note' : 'Play voice note'}
        >
          {isPlaying ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          )}
        </button>
        <div className="voice-body">
          <div className="voice-wave">
            {Array(bars).fill(0).map((_, i) => {
              const h = 5 + Math.sin(i * 0.75) * 6 + Math.cos(i * 0.35) * 4
              const filled = progress * bars > i
              return (
                <div
                  key={i}
                  className="voice-bar"
                  style={{
                    height: `${h}px`,
                    background: filled
                      ? (isMine ? (isVoiceNote ? '#7ef0b0' : '#ffd27e') : (isVoiceNote ? '#1a7a4a' : '#c9820a'))
                      : (isMine ? 'rgba(255,255,255,0.28)' : (isVoiceNote ? '#c5d9cc' : '#e8d2a8')),
                  }}
                  onClick={() => {
                    const a = audioRefs.current[id]
                    if (a?.duration) a.currentTime = (i / bars) * a.duration
                  }}
                />
              )
            })}
          </div>
          <div className="voice-times">
            <span>
              {isPlaying
                ? formatTime(Math.floor(duration * progress))
                : duration
                  ? formatTime(Math.floor(duration))
                  : '0:00'}
            </span>
            <span className="voice-type-label">
              {isVoiceNote ? (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 3, verticalAlign: -1 }}><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11h-2z"/></svg>
              ) : (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: 3, verticalAlign: -1 }}><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
              )}
              {audioLabelFromUrl(url)}
            </span>
            {!isVoiceNote && (
            <a
              href={url}
              download
              target="_blank"
              rel="noreferrer"
              className="voice-download"
              onClick={e => e.stopPropagation()}
              aria-label="Download"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            </a>
            )}
          </div>
        </div>
      </div>
    )
  }, [playingId, audioProgress, audioDuration, audioRefs, currentUser, toggleAudio])

  const renderMedia = useCallback(function renderMedia(msg, caption) {
    if (msg.call_type) {
      return (
        <CallMessageBubble
          msg={msg}
          isMine={msg.from_user === currentUser?.id}
        />
      )
    }
    if (msg._pendingLoad) {
      const isVideo = msg.media_type === 'video'
      return (
        <div
          className="chat-media-placeholder"
          onClick={e => {
            e.stopPropagation()
            const idsToClear = msg._isGroup
              ? new Set((msg._imageGroup || []).map(m => m.id))
              : new Set([msg.id])
            setMessages(prev =>
              prev.map(m => (idsToClear.has(m.id) ? { ...m, _pendingLoad: false } : m))
            )
            setGroupedMessages(prev =>
              prev.map(m => {
                if (idsToClear.has(m.id)) return { ...m, _pendingLoad: false }
                if (m._isGroup && m._imageGroup?.some(g => idsToClear.has(g.id))) {
                  return {
                    ...m,
                    _pendingLoad: false,
                    _imageGroup: m._imageGroup.map(g =>
                      idsToClear.has(g.id) ? { ...g, _pendingLoad: false } : g
                    ),
                  }
                }
                return m
              })
            )
          }}
        >
          <img
            src={msg.media_url}
            className="chat-media-placeholder-blur"
            draggable={false}
            alt=""
          />
          <div className="chat-media-placeholder-inner">
            <div className="chat-media-placeholder-btn">
              <Download size={26} strokeWidth={2} />
            </div>
            <span className="chat-media-placeholder-label">
              Tap to load {isVideo ? 'video' : 'photo'}
            </span>
          </div>
        </div>
      )
    }
    const { media_type: type, media_url: url } = msg
    if (!url) return null
    if (type === 'image') {
      if (msg._isGroup) {
        const imgs = msg._imageGroup
        const total = imgs.length
        const visible = imgs.slice(0, 9)
        const overflow = total - 9

        const getLayout = (n) => {
          if (n === 1) return 'layout-1'
          if (n === 2) return 'layout-2'
          if (n === 3) return 'layout-3'
          if (n === 4) return 'layout-4'
          return 'layout-grid'
        }

        return (
          <div className={`chat-img-group ${getLayout(visible.length)}`}>
            {visible.map((img, idx) => {
              const isLast = idx === visible.length - 1
              const showOverflow = isLast && overflow > 0
              return (
                <div
                  key={img.id}
                  className={`chat-img-thumb${img._uploading ? ' is-uploading' : ''}`}
                  role="button"
                  aria-label="View image"
                  onClick={e => {
                    if (img._uploading) return
                    e.stopPropagation()
                    openImageViewer(img.media_url)
                  }}
                  onPointerDown={e => {
                    if (img._uploading) return
                    e.stopPropagation()
                    thumbPressTimer.current = setTimeout(() => {
                      openImageActions(img, null)
                    }, 420)
                  }}
                  onPointerUp={() => { clearTimeout(thumbPressTimer.current) }}
                  onPointerCancel={() => { clearTimeout(thumbPressTimer.current) }}
                  onPointerMove={() => { clearTimeout(thumbPressTimer.current) }}
                  onContextMenu={e => {
                    if (img._uploading) return
                    e.preventDefault()
                    e.stopPropagation()
                    openImageActions(img, bubbleActionPoint(e))
                  }}
                >
                  <img src={img.media_url} alt="" loading="lazy" draggable={false} />
                  {img._uploading && (
                    <div className="chat-img-upload-progress">
                      <div
                        className="chat-img-upload-bar"
                        style={{ width: `${img._uploadProgress || 0}%` }}
                      />
                      <span className="chat-img-upload-pct">
                        {img._uploadProgress > 0 ? `${img._uploadProgress}%` : ''}
                      </span>
                    </div>
                  )}
                  {showOverflow && !img._uploading && (
                    <div className="chat-img-overflow">+{overflow}</div>
                  )}
                </div>
              )
            })}
          </div>
        )
      }
      return (
        <ChatImageBubble
          key={url}
          url={url}
          caption={caption}
          isMine={msg.from_user === currentUser?.id}
          onOpen={() => openImageViewer(url)}
          width={msg.media_width || msg.width}
          height={msg.media_height || msg.height}
        />
      )
    }
    if (type === 'video') {
      return (
        <div
          className="media-video-wrap"
          onClick={e => { e.stopPropagation(); setLightbox({ url, type: 'video', caption: caption || '' }) }}
        >
          <video
            src={url}
            playsInline
            preload="metadata"
            muted
          />
          <div className="media-video-play-hint" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          </div>
        </div>
      )
    }
    if (type === 'audio') return renderVoiceNote(msg)
    const name = fileLabelFromUrl(url)
    const lower = name.toLowerCase()
    const FileIcon = lower.match(/\.(pdf)$/) ? FileText
      : lower.match(/\.(mp3|wav|m4a|ogg|webm)$/) ? Music
      : lower.match(/\.(png|jpe?g|gif|webp|heic)$/) ? ImageIcon
      : lower.match(/\.(mp4|mov|avi|mkv)$/) ? Video
      : FileIcon2
    return (
      <a href={url} target="_blank" rel="noreferrer" className="media-file" download>
        <div className="media-file-icon">
          <FileIcon size={18} strokeWidth={2} />
        </div>
        <div className="media-file-meta">
          <div className="media-file-name">{name}</div>
          <div className="media-file-sub">Tap to open</div>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.55">
          <path d="M7 17L17 7M7 7h10v10" />
        </svg>
      </a>
    )
  }, [setLightbox, openImageViewer, openImageActions, currentUser, renderVoiceNote, setMessages])

  const callHostProps = {
    userId,
    currentUser,
    listingId: contextId,
    isServiceChatRef,
    otherName: displayName,
    otherAvatar,
    otherInitial,
    onCallMessage: (fields) => sendMessage('', 'text', null, fields),
  }

  // Unified source caption for the in-chat header strip
  const srcMeta = sourceMeta(chatSource)
  const contextTypeLabel = srcMeta.label === 'Looking For' ? 'Request' : srcMeta.label
  const contextCaption = (() => {
    if (chatSource === 'service' && service) {
      return {
        type: contextTypeLabel,
        title: service.name,
        sub: [service.rate, service.city].filter(Boolean).join(' · '),
        img: service.media_urls?.[0] || null,
        href: sourceHref('service', service),
      }
    }
    if (chatSource === 'listing') {
      if (!listing) {
        return { type: 'Listing', title: 'Listing unavailable', sub: '', img: null, href: null }
      }
      return {
        type: contextTypeLabel,
        title: listing.title,
        sub: formatBudgetMwk(listing.price),
        img: listing.images?.[0] || null,
        href: sourceHref('listing', listing),
      }
    }
    if (chatSource === 'shop' && shop) {
      return {
        type: contextTypeLabel,
        title: shop.name,
        sub: [shop.category, shop.city || shop.district].filter(Boolean).join(' · '),
        img: shop.logo_url || null,
        href: sourceHref('shop', shop),
      }
    }
    if (chatSource === 'request' && request) {
      const budget = formatBudgetMwk(request.budget)
      return {
        type: contextTypeLabel,
        title: request.title,
        sub: [budget ? `Budget: ${budget}` : null, request.city].filter(Boolean).join(' · '),
        img: null,
        href: sourceHref('request', request),
      }
    }
    // Direct messages: no in-chat caption strip
    return null
  })()

  // First-message safety gate for receivers of direct chats
  function acceptDirectChat() {
    setDmAccepted(true)
    try { if (dmAcceptKey) localStorage.setItem(dmAcceptKey, '1') } catch { /* ignore */ }
    showToast('Chat continued')
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  function currentChatKey() {
    return conversationKey(
      userId,
      chatSourceRef.current || chatSource || 'direct',
      contextId,
    )
  }

  async function blockUserFromChat(reason = 'Blocked from chat') {
    if (!userId || dmBusy) return
    setDmBusy(true)
    try {
      const { error } = await supabase.rpc('block_user', {
        p_blocked_id: userId,
        p_reason: reason,
      })
      if (error) throw error
      try { if (dmAcceptKey) localStorage.setItem(dmAcceptKey, '1') } catch { /* ignore */ }
      // Also hide this conversation for the blocker
      if (currentUser?.id) markChatDeleted(currentUser.id, currentChatKey())
      showToast('User blocked')
      setShowChatMenu(false)
      setShowReportSheet(false)
      navigate('/chats')
      window.dispatchEvent(new Event('soko:messages-updated'))
    } catch (e) {
      console.warn('[Chat] block failed', e)
      showToast(e?.message || 'Could not block user')
    } finally {
      setDmBusy(false)
    }
  }

  async function blockDirectChat() {
    await blockUserFromChat('Blocked from direct message')
  }

  async function submitUserReport(fromMenu = false) {
    if (!userId || dmBusy) return
    setDmBusy(true)
    const details = reportDetails?.trim()
      || (fromMenu ? 'Reported from chat menu' : 'Reported from first direct message')
    try {
      const { error } = await supabase.rpc('report_user', {
        p_reported_user_id: userId,
        p_reason: reportReason || 'other',
        p_details: details,
        p_listing_id: chatSource === 'listing' ? contextId : null,
      })
      if (error) throw error
      showToast('Report submitted')
      setShowReportSheet(false)
      setShowChatMenu(false)
      setMenuMode('main')
      setReportDetails('')
    } catch (e) {
      console.warn('[Chat] report failed', e)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        const { error: insErr } = await supabase.from('user_reports').insert({
          reporter_id: user.id,
          reported_user_id: userId,
          reason: reportReason || 'other',
          details,
          listing_id: chatSource === 'listing' ? contextId : null,
        })
        if (insErr) throw insErr
        showToast('Report submitted')
        setShowReportSheet(false)
        setShowChatMenu(false)
        setMenuMode('main')
        setReportDetails('')
      } catch (e2) {
        showToast(e?.message || e2?.message || 'Could not submit report')
      }
    } finally {
      setDmBusy(false)
    }
  }

  async function submitDirectReport() {
    await submitUserReport(false)
  }

  async function deleteConversation() {
    if (!userId || !currentUser?.id || dmBusy) return
    setDmBusy(true)
    try {
      const key = currentChatKey()
      const src = chatSourceRef.current || chatSource || 'direct'
      const myId = currentUser.id

      // Delete messages I can control (own messages). Context-scoped when possible.
      let del = supabase
        .from('messages')
        .delete()
        .eq('from_user', myId)
        .eq('to_user', userId)

      if (src === 'listing' && contextId) del = del.eq('listing_id', contextId)
      else if (src === 'service' && contextId) del = del.eq('service_id', contextId)
      else if (src === 'shop' && contextId) del = del.eq('shop_id', contextId)
      else if (src === 'request' && contextId) del = del.eq('request_id', contextId)

      const { error } = await del
      // Non-fatal if delete partially fails (RLS / missing columns)
      if (error) console.warn('[Chat] delete messages:', error.message)

      // Also try deleting messages they sent to me in this context (if policy allows)
      try {
        let del2 = supabase
          .from('messages')
          .delete()
          .eq('from_user', userId)
          .eq('to_user', myId)
        if (src === 'listing' && contextId) del2 = del2.eq('listing_id', contextId)
        else if (src === 'service' && contextId) del2 = del2.eq('service_id', contextId)
        else if (src === 'shop' && contextId) del2 = del2.eq('shop_id', contextId)
        else if (src === 'request' && contextId) del2 = del2.eq('request_id', contextId)
        await del2
      } catch { /* ignore */ }

      markChatDeleted(myId, key)
      showToast('Chat deleted')
      setShowChatMenu(false)
      setMenuMode('main')
      window.dispatchEvent(new Event('soko:messages-updated'))
      navigate('/chats')
    } catch (e) {
      showToast(e?.message || 'Could not delete chat')
    } finally {
      setDmBusy(false)
    }
  }

  if (loading) {
    return (
      <ChatCallHost {...callHostProps}>
        <div className="chat-page chat-thread" style={S.loadCenter}>
          <div style={S.spinner} />
        </div>
      </ChatCallHost>
    )
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <ChatCallHost {...callHostProps}>
    <div className="chat-page chat-thread" style={S.page}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes onlinePulse{0%,100%{box-shadow:0 0 0 0 rgba(15,157,88,0.45)}50%{box-shadow:0 0 0 4px rgba(15,157,88,0)}}
        .chat-page.chat-thread {
          --chat-line: #e8eaed;
          --chat-green: #0F9D58;
          --chat-mine: #0F9D58;
          --chat-other: #ffffff;
          --chat-ink: #202124;
          --chat-muted: #5f6368;
          --chat-radius: 16px;
          font-family: 'DM Sans', system-ui, -apple-system, 'Segoe UI', sans-serif !important;
        }
        .chat-page.chat-thread .chat-topbar {
          position: sticky;
          top: 0;
          z-index: 30;
          height: 64px;
          min-height: 64px;
          box-sizing: border-box;
          padding: 0 12px !important;
          gap: 10px;
          background: #fff !important;
          border-bottom: 1px solid #e8eaed !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        .chat-page.chat-thread .chat-topbar .chat-icon-btn {
          width: 44px !important;
          height: 44px !important;
          border-radius: 12px;
          background: transparent;
          color: #5f6368;
        }
        .chat-page.chat-thread .chat-topbar .chat-icon-btn:hover { background: #e6f6ed; color: #0F9D58; }
        .chat-page.chat-thread .chat-top-name {
          font-family: 'Sora', 'DM Sans', sans-serif !important;
          font-size: 16px !important;
          font-weight: 600 !important;
          letter-spacing: 0 !important;
          color: #202124 !important;
        }
        .chat-page.chat-thread .chat-online-dot {
          width: 10px;
          height: 10px;
          background: #0F9D58;
          box-shadow: 0 0 0 2px #fff;
        }
        .chat-page.chat-thread .chat-context-bar {
          height: 56px;
          box-sizing: border-box;
          padding: 0 12px !important;
          gap: 10px;
          background: #fff !important;
          border-bottom: 1px solid #e8eaed !important;
        }
        .chat-page.chat-thread .chat-context-thumb {
          width: 44px;
          height: 44px;
          border-radius: 10px;
          background: #e6f6ed;
          box-shadow: none;
        }
        .chat-page.chat-thread .chat-context-type {
          font-size: 11px;
          font-weight: 500;
          line-height: 1.2;
          color: #80868b;
        }
        .chat-page.chat-thread .chat-context-title {
          font-family: 'Sora', 'DM Sans', sans-serif;
          font-size: 14px;
          font-weight: 600;
          line-height: 1.25;
          color: #202124;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .chat-page.chat-thread .chat-context-price {
          font-size: 13px;
          font-weight: 700;
          line-height: 1.2;
          color: #0F9D58;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .chat-page.chat-thread .chat-disappear-banner {
          flex-shrink: 0;
          padding: 4px 12px;
          background: #fff;
          border-bottom: 1px solid #e8eaed;
          font-size: 11px;
          line-height: 1.3;
          color: #80868b;
          text-align: center;
        }
        .chat-page.chat-thread .chat-messages-wrap {
          position: relative;
          display: flex;
          flex: 1;
          flex-direction: column;
          min-height: 0;
        }
        .chat-page.chat-thread .chat-date-chip,
        .chat-page.chat-thread .chat-sticky-date span {
          display: block !important;
          width: fit-content !important;
          max-width: calc(100% - 24px) !important;
          margin: 12px auto !important;
          background: #fff !important;
          color: #5f6368 !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          line-height: 1.4 !important;
          letter-spacing: 0 !important;
          text-align: center !important;
          white-space: nowrap !important;
          text-transform: none !important;
          border: 1px solid #e8eaed !important;
          border-radius: 999px !important;
          padding: 6px 12px !important;
          box-shadow: none !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        .chat-page.chat-thread .chat-sticky-date { top: 4px; }
        .chat-page.chat-thread .chat-load-more-end {
          padding: 8px 12px 0 !important;
          margin: 0 !important;
          font-size: 11px !important;
          line-height: 1.4 !important;
          color: #80868b !important;
        }
        .chat-page.chat-thread .msg-stack { max-width: 75% !important; }
        .chat-page.chat-thread .msg-bubble {
          padding: 8px 12px !important;
          border-radius: 16px !important;
          box-shadow: none !important;
        }
        .chat-page.chat-thread .msg-bubble.r-mine-tail { border-bottom-right-radius: 4px !important; }
        .chat-page.chat-thread .msg-bubble.r-mine-join { border-top-right-radius: 4px !important; }
        .chat-page.chat-thread .msg-bubble.r-theirs-tail { border-bottom-left-radius: 4px !important; }
        .chat-page.chat-thread .msg-bubble.r-theirs-join { border-top-left-radius: 4px !important; }
        .chat-page.chat-thread .msg-bubble.is-mine {
          background: #0F9D58 !important;
          color: #fff !important;
          border: 1px solid #0F9D58 !important;
        }
        .chat-page.chat-thread .msg-bubble.is-theirs {
          background: #fff !important;
          color: #202124 !important;
          border: 1px solid #e8eaed !important;
        }
        .chat-page.chat-thread .msg-text,
        .chat-page.chat-thread .msg-caption {
          font-size: 15px !important;
          line-height: 1.4 !important;
          letter-spacing: 0 !important;
        }
        .chat-page.chat-thread .msg-meta {
          margin-top: 4px !important;
          font-size: 11px !important;
        }
        .chat-page.chat-thread .msg-bubble.is-mine .msg-meta { color: rgba(255,255,255,0.7) !important; }
        .chat-page.chat-thread .msg-bubble.is-theirs .msg-meta { color: #80868b !important; }
        .chat-page.chat-thread .msg-ticks.read { color: rgba(255,255,255,0.95) !important; }
        .chat-page.chat-thread .msg-bubble.has-image {
          padding: 3px !important;
          border-radius: 14px !important;
          width: fit-content !important;
          min-width: 0 !important;
          overflow: hidden !important;
          background-clip: padding-box !important;
        }
        .chat-page.chat-thread .msg-bubble.has-image.r-mine-tail,
        .chat-page.chat-thread .msg-bubble.has-image.r-mine-join,
        .chat-page.chat-thread .msg-bubble.has-image.r-theirs-tail,
        .chat-page.chat-thread .msg-bubble.has-image.r-theirs-join {
          border-radius: 14px !important;
        }
        .chat-page.chat-thread .msg-bubble.has-image.is-mine {
          background: #0F9D58 !important;
          border: 1px solid #0F9D58 !important;
        }
        .chat-page.chat-thread .msg-bubble.has-image.is-theirs {
          background: #fff !important;
          border: 1px solid #e8eaed !important;
        }
        .chat-page.chat-thread .msg-bubble.has-image .msg-caption {
          padding: 6px 8px 4px !important;
        }
        .chat-page.chat-thread .msg-bubble.has-image:not(.media-only) .msg-meta {
          margin-top: 0 !important;
          padding: 0 8px 4px !important;
        }
        .chat-page.chat-thread .msg-bubble.has-image.media-only .msg-meta-row {
          position: absolute !important;
          right: 6px !important;
          bottom: 6px !important;
          z-index: 2 !important;
          margin: 0 !important;
          padding: 0 !important;
        }
        .chat-page.chat-thread .msg-bubble.has-image.media-only .msg-meta {
          margin: 0 !important;
          padding: 4px 8px !important;
          border-radius: 999px !important;
          background: rgba(0,0,0,0.45) !important;
          color: #fff !important;
          font-size: 11px !important;
        }
        .chat-page.chat-thread .msg-bubble.has-image.media-only .msg-ticks { color: #fff !important; }
        .chat-page.chat-thread .chat-input-bar {
          background: #fff !important;
          border-top: 1px solid #e8eaed !important;
          padding: 8px 12px calc(8px + env(safe-area-inset-bottom, 0px)) !important;
          gap: 8px !important;
          backdrop-filter: none !important;
          -webkit-backdrop-filter: none !important;
        }
        .chat-page.chat-thread .chat-attach-btn,
        .chat-page.chat-thread .chat-mic-btn,
        .chat-page.chat-thread .chat-send-btn {
          width: 44px !important;
          height: 44px !important;
        }
        .chat-page.chat-thread .chat-emoji-btn {
          width: 32px !important;
          height: 32px !important;
        }
        .chat-page.chat-thread .chat-attach-btn {
          background: transparent !important;
          color: #5f6368 !important;
          border: none !important;
          border-radius: 50% !important;
        }
        .chat-page.chat-thread .chat-mic-btn {
          background: transparent !important;
          border: none !important;
          color: #5f6368 !important;
        }
        .chat-page.chat-thread .chat-send-btn {
          background: #0F9D58 !important;
          color: #fff !important;
          box-shadow: 0 2px 8px rgba(15,157,88,0.25) !important;
        }
        .chat-page.chat-thread .chat-composer {
          background: #f1f3f4 !important;
          border: none !important;
          border-radius: 22px !important;
          padding: 10px 14px !important;
          min-height: 44px !important;
          box-shadow: none !important;
        }
        .chat-page.chat-thread .chat-composer:focus-within {
          background: #fff !important;
          box-shadow: 0 0 0 2px #0F9D58 !important;
        }
        .chat-page.chat-thread .chat-composer textarea {
          font-size: 15px !important;
          line-height: 1.4 !important;
          padding: 0 !important;
          max-height: 105px !important;
        }
        @media (hover: none) {
          .chat-page.chat-thread .chat-emoji-btn,
          .chat-page.chat-thread .chat-attachment-remove,
          .chat-page.chat-thread .chat-reply-close {
            width: 44px !important;
            height: 44px !important;
          }
        }
        .chat-page.chat-thread .chat-scroll-fab {
          right: 16px !important;
          bottom: 12px !important;
          width: 40px !important;
          height: 40px !important;
          background: #fff !important;
          color: #0F9D58 !important;
          border: 1px solid #e8eaed !important;
          box-shadow: 0 4px 16px rgba(16,24,40,0.12) !important;
        }
        .chat-page.chat-thread .chat-scroll-fab.has-unread {
          width: 40px !important;
          min-width: 40px !important;
          padding: 0 !important;
          border-radius: 50% !important;
          background: #fff !important;
          color: #0F9D58 !important;
        }
        .chat-page.chat-thread .chat-scroll-unread {
          position: absolute;
          top: -6px;
          right: -6px;
          min-width: 18px;
          height: 18px;
          padding: 0 4px;
          box-sizing: border-box;
          border-radius: 999px;
          background: #0F9D58;
          color: #fff;
          font-size: 10px;
          line-height: 18px;
          text-align: center;
          box-shadow: 0 0 0 2px #fff;
        }
        @media (max-width: 899px) {
          .chat-page.chat-thread {
            height: var(--chat-vvh, 100%) !important;
            max-height: var(--chat-vvh, 100%) !important;
          }
        }
        @media (min-width: 769px) {
          .chat-back-btn { display: none !important; }
          .chat-page.chat-thread > .chat-topbar,
          .chat-page.chat-thread > .chat-disappear-banner,
          .chat-page.chat-thread > .chat-context-bar,
          .chat-page.chat-thread > .chat-messages-wrap,
          .chat-page.chat-thread > .chat-composer-shell {
            width: 100%;
            max-width: 900px;
            margin-left: auto;
            margin-right: auto;
          }
          .chat-page.chat-thread .msg-stack { max-width: 65% !important; }
        }
        .chat-page.chat-thread .msg-bubble.offer-bubble {
          width: fit-content !important;
          min-width: 0 !important;
          max-width: 320px !important;
          padding: 8px 12px !important;
          border-radius: 16px !important;
          box-shadow: none !important;
          overflow: visible !important;
        }
        .chat-page.chat-thread .msg-bubble.offer-bubble.is-mine {
          background: #0F9D58 !important;
          color: #fff !important;
          border: 1px solid #0F9D58 !important;
        }
        .chat-page.chat-thread .msg-bubble.offer-bubble.is-theirs {
          background: #fff !important;
          color: #202124 !important;
          border: 1px solid #e8eaed !important;
        }
        .chat-page.chat-thread .msg-bubble.offer-bubble.r-mine-tail { border-bottom-right-radius: 4px !important; }
        .chat-page.chat-thread .msg-bubble.offer-bubble.r-mine-join { border-top-right-radius: 4px !important; }
        .chat-page.chat-thread .msg-bubble.offer-bubble.r-theirs-tail { border-bottom-left-radius: 4px !important; }
        .chat-page.chat-thread .msg-bubble.offer-bubble.r-theirs-join { border-top-left-radius: 4px !important; }
        .chat-page.chat-thread .msg-bubble.offer-bubble .offer-card {
          box-sizing: border-box;
          --offer-status-bg: #fff7e6;
          --offer-status-fg: #a16207;
          --offer-status-border: #fde68a;
          width: 100% !important;
          max-width: none !important;
          max-height: none !important;
          padding: 0 !important;
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          overflow: visible !important;
          opacity: 1 !important;
          filter: none !important;
          color: inherit !important;
        }
        .chat-page.chat-thread .msg-bubble.offer-bubble .offer-card::before { display: none !important; }
        .chat-page.chat-thread .offer-card-product {
          width: 100% !important;
          display: flex !important;
          align-items: center !important;
          margin: 0 0 8px !important;
          padding: 0 !important;
          gap: 8px !important;
          background: transparent !important;
          border: 0 !important;
          border-radius: 0 !important;
          box-shadow: none !important;
          color: inherit !important;
        }
        .chat-page.chat-thread .offer-card-product-thumb {
          width: 32px !important;
          height: 32px !important;
          border-radius: 8px !important;
          border: 0 !important;
          box-shadow: none !important;
          flex: 0 0 32px !important;
          object-fit: cover !important;
        }
        .chat-page.chat-thread .offer-card-product-title {
          flex: 1 1 auto !important;
          min-width: 0 !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          white-space: nowrap !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          line-height: 1.3 !important;
          color: inherit !important;
        }
        .chat-page.chat-thread .offer-card-product-arrow {
          flex: 0 0 auto !important;
          display: inline-flex !important;
          align-items: center !important;
          color: inherit !important;
          opacity: 0.75 !important;
        }
        .chat-page.chat-thread .offer-card-product.is-unavailable {
          justify-content: flex-start !important;
          font-size: 12px !important;
          color: inherit !important;
          opacity: 0.8 !important;
        }
        .chat-page.chat-thread .offer-card-head {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          margin: 0 0 4px !important;
          gap: 8px !important;
        }
        .chat-page.chat-thread .offer-card-tag {
          font-size: 12px !important;
          font-weight: 500 !important;
          line-height: 1.3 !important;
          color: inherit !important;
          opacity: 0.8 !important;
        }
        .chat-page.chat-thread .offer-card-tag::before { display: none !important; }
        .chat-page.chat-thread .msg-bubble.offer-bubble .offer-card.is-pending {
          --offer-status-bg: #fff7e6 !important;
          --offer-status-fg: #a16207 !important;
          --offer-status-border: #fde68a !important;
        }
        .chat-page.chat-thread .msg-bubble.offer-bubble .offer-card.is-accepted {
          --offer-status-bg: #e8f5ee !important;
          --offer-status-fg: #0f9d58 !important;
          --offer-status-border: #a7dfc0 !important;
        }
        .chat-page.chat-thread .msg-bubble.offer-bubble .offer-card.is-declined {
          --offer-status-bg: #fdecea !important;
          --offer-status-fg: #d93025 !important;
          --offer-status-border: #f5b7b1 !important;
        }
        .chat-page.chat-thread .msg-bubble.offer-bubble .offer-card.is-countered,
        .chat-page.chat-thread .msg-bubble.offer-bubble .offer-card.is-superseded {
          --offer-status-bg: #e8f0fe !important;
          --offer-status-fg: #1d4ed8 !important;
          --offer-status-border: #bfdbfe !important;
        }
        .chat-page.chat-thread .msg-bubble.offer-bubble .offer-card.is-withdrawn {
          --offer-status-bg: #f3e8fd !important;
          --offer-status-fg: #7b1fa2 !important;
          --offer-status-border: #d7b3ed !important;
        }
        .chat-page.chat-thread .msg-bubble.offer-bubble .offer-card.is-expired {
          --offer-status-bg: #f1f3f4 !important;
          --offer-status-fg: #5f6368 !important;
          --offer-status-border: #dadce0 !important;
        }
        .chat-page.chat-thread .offer-card-status {
          display: inline-flex !important;
          align-items: center !important;
          gap: 5px !important;
          flex: 0 0 auto !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          text-transform: uppercase !important;
          letter-spacing: 0.04em !important;
          line-height: 1.4 !important;
          padding: 2px 8px !important;
          border: 1px solid var(--offer-status-border) !important;
          border-radius: 999px !important;
          background: var(--offer-status-bg) !important;
          color: var(--offer-status-fg) !important;
        }
        .chat-page.chat-thread .offer-card-status::before {
          content: '' !important;
          width: 6px !important;
          height: 6px !important;
          flex: 0 0 6px !important;
          border-radius: 50% !important;
          background: currentColor !important;
        }
        .chat-page.chat-thread .offer-card-amount {
          display: block !important;
          margin: 0 !important;
          font-family: 'Sora', 'DM Sans', sans-serif !important;
          font-size: 20px !important;
          font-weight: 800 !important;
          line-height: 1.2 !important;
          letter-spacing: -0.01em !important;
          color: inherit !important;
        }
        .chat-page.chat-thread .offer-card-amount-currency {
          display: inline !important;
          margin: 0 !important;
          padding: 0 !important;
          background: transparent !important;
          border: 0 !important;
          font-size: 20px !important;
          font-weight: 800 !important;
          letter-spacing: 0 !important;
          color: inherit !important;
        }
        .chat-page.chat-thread .offer-card-original-price {
          margin-top: 2px !important;
          font-size: 12px !important;
          font-weight: 500 !important;
          line-height: 1.3 !important;
          color: inherit !important;
          opacity: 0.8 !important;
        }
        .chat-page.chat-thread .msg-bubble.offer-bubble .msg-meta-row {
          margin-top: 6px !important;
          padding: 0 !important;
          justify-content: flex-end !important;
        }
        .chat-page.chat-thread .msg-bubble.offer-bubble .msg-meta {
          margin-top: 0 !important;
          font-size: 11px !important;
          line-height: 1.4 !important;
          color: inherit !important;
          opacity: 0.8 !important;
        }
        .chat-page.chat-thread .msg-bubble.offer-bubble .msg-ticks.read,
        .chat-page.chat-thread .msg-bubble.offer-bubble .msg-ticks.sent,
        .chat-page.chat-thread .msg-bubble.offer-bubble .msg-ticks.is-failed { color: inherit !important; }
        .chat-page.chat-thread .offer-card-note,
        .chat-page.chat-thread .offer-stepper,
        .chat-page.chat-thread .offer-card-parent { display: none !important; }
        .chat-page.chat-thread .offer-card-footer {
          display: flex !important;
          align-items: center !important;
          justify-content: space-between !important;
          flex-wrap: nowrap !important;
          gap: 6px !important;
          margin: 6px 0 0 !important;
          padding: 0 !important;
          border: 0 !important;
        }
        .chat-page.chat-thread .offer-card-statusline {
          display: inline-flex !important;
          align-items: flex-start !important;
          gap: 6px !important;
          flex: 1 1 auto !important;
          min-width: 0 !important;
          font-size: 11px !important;
          font-weight: 600 !important;
          line-height: 1.35 !important;
          opacity: 1 !important;
        }
        .chat-page.chat-thread .offer-card-statusline::before {
          content: '' !important;
          width: 6px !important;
          height: 6px !important;
          margin-top: 4px !important;
          flex: 0 0 6px !important;
          border-radius: 50% !important;
          background: var(--offer-status-fg) !important;
        }
        .chat-page.chat-thread .offer-card-statusline-text {
          display: block !important;
          min-width: 0 !important;
          overflow: visible !important;
          text-overflow: clip !important;
          white-space: normal !important;
        }
        .chat-page.chat-thread .msg-bubble.offer-bubble.is-mine .offer-card-statusline {
          color: rgba(255,255,255,0.92) !important;
        }
        .chat-page.chat-thread .msg-bubble.offer-bubble.is-theirs .offer-card-statusline {
          color: var(--offer-status-fg) !important;
        }
        .chat-page.chat-thread .offer-card-countdown {
          padding: 2px 7px !important;
          font-size: 10px !important;
          line-height: 1.4 !important;
        }
        .chat-page.chat-thread .offer-card-countdown-label {
          display: inline !important;
          font-size: 10px !important;
          font-weight: 600 !important;
          letter-spacing: 0 !important;
          text-transform: none !important;
          opacity: 0.85 !important;
        }
        .chat-page.chat-thread .offer-card-countdown.is-expired { display: none !important; }
        .chat-page.chat-thread .offer-card-actions,
        .chat-page.chat-thread .offer-card-actions.is-manage {
          display: flex !important;
          flex-wrap: nowrap !important;
          gap: 6px !important;
          margin: 8px 0 0 !important;
          padding: 0 !important;
          border: 0 !important;
        }
        .chat-page.chat-thread .offer-card-actions button {
          flex: 1 1 0 !important;
          min-width: 0 !important;
          height: 36px !important;
          min-height: 36px !important;
          padding: 0 6px !important;
          border-radius: 8px !important;
          font-size: 12px !important;
          font-weight: 600 !important;
          line-height: 1.15 !important;
        }
        .chat-page.chat-thread .msg-bubble.offer-bubble.is-mine .offer-card-actions button {
          background: rgba(255,255,255,0.16) !important;
          color: #fff !important;
          border: 1px solid rgba(255,255,255,0.35) !important;
        }
        .chat-page.chat-thread .msg-bubble.offer-bubble.is-theirs .offer-card-actions button {
          background: #f1f8f4 !important;
          color: #0F9D58 !important;
          border: 1px solid #e8eaed !important;
        }
        @media (max-width: 399px) {
          .chat-page.chat-thread .msg-bubble.offer-bubble {
            max-width: 260px !important;
          }
        }
      `}</style>

      {/* ── Top bar ── */}
      <div className="chat-topbar" style={S.topbar}>
        <button className="chat-back-btn chat-icon-btn" type="button" onClick={() => navigate(isServiceChat ? '/services' : '/chats')} aria-label="Back">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>

        <div style={S.topInfo}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <ChatAvatar url={otherAvatar} initial={otherInitial} size={40} />
            {otherOnline && (
              <div
                className="chat-online-dot"
                style={{
                  ...S.onlineDot,
                  position: 'absolute',
                  bottom: 1,
                  right: 1,
                  background: '#0F9D58',
                  boxShadow: '0 0 0 2px #fff',
                  animation: 'onlinePulse 2s infinite',
                }}
              />
            )}
          </div>
          <button
            type="button"
            style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
            onClick={() => navigate(`/profile/${userId}`)}
            title="View profile"
          >
            <div className="chat-top-name">{displayName}</div>
            <div style={S.topStatus}>
              {otherRecording ? (
                <span style={{ color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'min(160px, 38vw)' }}>
                    {displayName.split(' ')[0]} is recording audio…
                  </span>
                </span>
              ) : otherTyping ? (
                <span style={{ color: '#0F9D58', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'min(140px, 34vw)' }}>
                    {displayName.split(' ')[0]} is typing
                  </span>
                  <span style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {[0, 0.2, 0.4].map((d, i) => (
                      <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#0F9D58', display: 'inline-block', animation: `typingDot 1.2s ${d}s infinite` }} />
                    ))}
                  </span>
                </span>
              ) : otherOnline ? (
                <span style={{ color: '#0F9D58', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  Online
                </span>
              ) : (
                <span style={{ color: '#80868b' }}>{lastSeenLabel(otherLastSeen)}</span>
              )}
            </div>
          </button>
        </div>

        <div className="chat-top-actions" style={S.topActions}>
          <button type="button" className="chat-icon-btn chat-search-toggle" onClick={() => setChatSearch(s => s === null ? '' : null)} title="Search" aria-label="Search messages">
            <Search size={20} color="#5f6368" strokeWidth={1.75} aria-hidden="true" />
          </button>
          <button
            ref={chatMenuAnchorRef}
            type="button"
            className="chat-icon-btn"
            title="More options"
            aria-label="Chat options"
            aria-haspopup="menu"
            aria-expanded={showChatMenu && menuMode === 'main'}
            onClick={() => { setMenuMode('main'); setShowChatMenu(true) }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="19" r="1.6" />
            </svg>
          </button>
        </div>
      </div>

      {defaultDisappear != null && (
        <div className="chat-disappear-banner">
          Disappearing messages: {disappearLabel}
        </div>
      )}

      <ChatPopupMenu
        open={showChatMenu && menuMode === 'main'}
        anchorEl={chatMenuAnchorRef.current}
        label="Chat options"
        title="Chat options"
        subtitle={`With ${displayName}`}
        onClose={() => { setShowChatMenu(false); setMenuMode('main') }}
        groups={[
          [
            {
              id: 'profile',
              label: 'View profile',
              icon: UserRound,
              onSelect: () => navigate(`/profile/${userId}`),
            },
            {
              id: 'disappearing',
              label: 'Disappearing messages',
              icon: Timer,
              value: disappearLabel,
              onSelect: () => setShowDisappearMenu(true),
            },
            {
              id: 'search',
              label: 'Search in chat',
              icon: Search,
              onSelect: () => setChatSearch(''),
            },
          ],
          [
            {
              id: 'report',
              label: 'Report user',
              icon: Flag,
              onSelect: () => {
                setMenuMode('report')
                setReportReason('spam')
                setReportDetails('')
                setShowChatMenu(true)
              },
            },
            {
              id: 'block',
              label: 'Block user',
              icon: Ban,
              disabled: dmBusy,
              onSelect: () => blockUserFromChat('Blocked from chat menu'),
            },
          ],
          [
            {
              id: 'delete',
              label: 'Delete chat',
              icon: Trash2,
              onSelect: () => {
                setMenuMode('delete')
                setShowChatMenu(true)
              },
            },
          ],
        ]}
      />

      <ChatPopupMenu
        open={showDisappearMenu}
        anchorEl={chatMenuAnchorRef.current}
        label="Disappearing messages"
        title="Disappearing messages"
        subtitle={`New messages in this chat: ${disappearLabel}`}
        onClose={() => setShowDisappearMenu(false)}
        groups={[
          DISAPPEAR_OPTIONS.map(opt => ({
            id: opt.label,
            label: opt.label,
            icon: defaultDisappear === opt.ms ? Check : null,
            onSelect: () => setDefaultDisappear(opt.ms),
          })),
        ]}
      />

      {/* ── Chat options: report / delete ── */}
      {showChatMenu && menuMode !== 'main' && (
        <div
          className="chat-action-scrim"
          onClick={() => { if (!dmBusy) { setShowChatMenu(false); setMenuMode('main') } }}
          role="presentation"
        >
          <div
            className="chat-action-sheet"
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="Chat options"
          >
            <div className="chat-action-handle" />

            {menuMode === 'report' && (
              <>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f1410', marginBottom: 6, padding: '0 4px' }}>
                  Report {displayName}
                </div>
                <p style={{ fontSize: 13, color: '#6b7a70', margin: '0 4px 12px', lineHeight: 1.45 }}>
                  Tell us why you’re reporting this person. Our team will review it.
                </p>
                <div className="dm-report-reasons">
                  {[
                    { id: 'spam', label: 'Spam or scam' },
                    { id: 'harassment', label: 'Harassment' },
                    { id: 'inappropriate', label: 'Inappropriate content' },
                    { id: 'impersonation', label: 'Fake profile' },
                    { id: 'other', label: 'Other' },
                  ].map(r => (
                    <button
                      key={r.id}
                      type="button"
                      className={`dm-reason-chip${reportReason === r.id ? ' is-on' : ''}`}
                      onClick={() => setReportReason(r.id)}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
                <textarea
                  className="dm-report-details"
                  placeholder="Optional details…"
                  value={reportDetails}
                  onChange={e => setReportDetails(e.target.value)}
                  rows={3}
                />
                <button
                  type="button"
                  className="dm-btn dm-btn-report-submit"
                  disabled={dmBusy || !reportReason}
                  onClick={() => submitUserReport(true)}
                >
                  {dmBusy ? 'Submitting…' : 'Submit report'}
                </button>
                <button
                  type="button"
                  className="chat-action-cancel"
                  disabled={dmBusy}
                  onClick={() => setMenuMode('main')}
                >
                  Back
                </button>
              </>
            )}

            {menuMode === 'delete' && (
              <>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f1410', marginBottom: 6, padding: '0 4px' }}>
                  Delete this chat?
                </div>
                <p style={{ fontSize: 13, color: '#6b7a70', margin: '0 4px 16px', lineHeight: 1.5 }}>
                  This removes the conversation from your chat list. You can still get new messages from this person later.
                </p>
                <button
                  type="button"
                  className="dm-btn dm-btn-block"
                  style={{ width: '100%', marginBottom: 8 }}
                  disabled={dmBusy}
                  onClick={deleteConversation}
                >
                  {dmBusy ? 'Deleting…' : 'Yes, delete chat'}
                </button>
                <button
                  type="button"
                  className="chat-action-cancel"
                  disabled={dmBusy}
                  onClick={() => setMenuMode('main')}
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── In-chat search bar ── */}
      {chatSearch !== null && (
        <div className="chat-search-bar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.5" strokeLinecap="round" style={{ flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            placeholder="Search messages…"
            value={chatSearch}
            onChange={e => setChatSearch(e.target.value)}
            autoFocus
          />
          {searchMatches.length > 0 && (
            <>
              <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>{searchIdx + 1}/{searchMatches.length}</span>
              <button type="button" className="chat-icon-btn" style={{ width: 30, height: 30 }} onClick={() => jumpToMatch(-1)}>↑</button>
              <button type="button" className="chat-icon-btn" style={{ width: 30, height: 30 }} onClick={() => jumpToMatch(1)}>↓</button>
            </>
          )}
          <button type="button" className="chat-icon-btn" style={{ width: 30, height: 30 }} onClick={() => setChatSearch(null)} aria-label="Close search">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      )}

      {/* ── Source caption (listing / service / shop / request / direct) ── */}
      {contextCaption && (
        <div
          className="chat-context-bar"
          style={{ cursor: contextCaption.href ? 'pointer' : 'default' }}
          onClick={() => { if (contextCaption.href) navigate(contextCaption.href) }}
          role={contextCaption.href ? 'link' : undefined}
        >
          <div className="chat-context-thumb">
            {contextCaption.img
              ? <img src={contextCaption.img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : chatSource === 'request'
                ? <Target size={22} strokeWidth={1.75} color="#0F9D58" aria-hidden="true" />
                : <span style={{ fontSize: 18 }}>{srcMeta.emoji}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="chat-context-type">{contextCaption.type}</div>
            <div className="chat-context-title">{contextCaption.title}</div>
            {contextCaption.sub
              ? <div className="chat-context-price">{contextCaption.sub}</div>
              : null}
          </div>
          {contextCaption.href && (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0F9D58" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 18l6-6-6-6" />
            </svg>
          )}
        </div>
      )}

      {isRequestChat && chatSource === 'request' && !request && (
        <div style={{ background: '#fef9f0', borderBottom: '1px solid #fde8c8', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 16 }}>🔎</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#c9820a' }}>Looking For request</div>
            <div style={{ fontSize: 11, color: '#637068' }}>Offer is pre-filled below — edit and send</div>
          </div>
        </div>
      )}

      {/* ── Direct DM first-message gate (receiver only) ── */}
      {showDmGate && (
        <div className="dm-safety-gate" role="region" aria-label="Message request options">
          <div className="dm-safety-card">
            <div className="dm-safety-icon">💬</div>
            <div className="dm-safety-title">Message request</div>
            <p className="dm-safety-text">
              <strong>{displayName}</strong> sent you a direct message. You can continue the chat, block them, or report this person.
            </p>
            <div className="dm-safety-actions">
              <button
                type="button"
                className="dm-btn dm-btn-continue"
                disabled={dmBusy}
                onClick={acceptDirectChat}
              >
                Continue chat
              </button>
              <button
                type="button"
                className="dm-btn dm-btn-block"
                disabled={dmBusy}
                onClick={blockDirectChat}
              >
                Block
              </button>
              <button
                type="button"
                className="dm-btn dm-btn-report"
                disabled={dmBusy}
                onClick={() => setShowReportSheet(true)}
              >
                Report
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportSheet && (
        <div className="chat-action-scrim" onClick={() => !dmBusy && setShowReportSheet(false)} role="presentation">
          <div className="chat-action-sheet dm-report-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Report user">
            <div className="chat-action-handle" />
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f1410', marginBottom: 6, padding: '0 4px' }}>
              Report {displayName}
            </div>
            <p style={{ fontSize: 13, color: '#6b7a70', margin: '0 4px 12px', lineHeight: 1.45 }}>
              Tell us why you’re reporting this person. Our team will review it.
            </p>
            <div className="dm-report-reasons">
              {[
                { id: 'spam', label: 'Spam or scam' },
                { id: 'harassment', label: 'Harassment' },
                { id: 'inappropriate', label: 'Inappropriate content' },
                { id: 'impersonation', label: 'Fake profile' },
                { id: 'other', label: 'Other' },
              ].map(r => (
                <button
                  key={r.id}
                  type="button"
                  className={`dm-reason-chip${reportReason === r.id ? ' is-on' : ''}`}
                  onClick={() => setReportReason(r.id)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <textarea
              className="dm-report-details"
              placeholder="Optional details…"
              value={reportDetails}
              onChange={e => setReportDetails(e.target.value)}
              rows={3}
            />
            <button
              type="button"
              className="dm-btn dm-btn-report-submit"
              disabled={dmBusy || !reportReason}
              onClick={submitDirectReport}
            >
              {dmBusy ? 'Submitting…' : 'Submit report'}
            </button>
            <button
              type="button"
              className="chat-action-cancel"
              disabled={dmBusy}
              onClick={() => setShowReportSheet(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Call overlay is rendered by ChatCallHost (outside this page shell) */}

      {/* ── Messages ── */}
      <div className="chat-messages-wrap" style={{ flex: 1, minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
      <div
        ref={messagesListRef}
        className="chat-messages"
        style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}
        onClick={() => { setShowEmoji(false); setShowAttach(false) }}
        onScroll={e => {
          const el = e.currentTarget
          const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
          const near = distFromBottom < 100
          nearBottomRef.current = near
          setShowScrollBtn(distFromBottom > 200)
          if (near) setUnreadBelow(0)
          handleScroll()
        }}
      >
        {!hasMore && messages.length > 0 && (
          <div className="chat-load-more-end">
            <span>No more messages</span>
          </div>
        )}
        {loadingMore && (
          <div className="chat-load-more-spinner">
            <span>Loading...</span>
          </div>
        )}

        {messages.length === 0 && !isServiceChat && (
          <div className="chat-empty">
            <div className="chat-empty-icon">👋</div>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#0f1410', marginBottom: 6, letterSpacing: '-0.02em' }}>Say hello</p>
            <p style={{ fontSize: 13, color: '#7a8a80', lineHeight: 1.65, maxWidth: 240 }}>
              Ask about the item, negotiate price, or arrange a meetup
            </p>
          </div>
        )}

        {groupedMessages.map((msg, i) => {
          const isMine   = msg.from_user === currentUser?.id
          const showDate = i === 0 || new Date(msg.created_at).toDateString() !== new Date(groupedMessages[i - 1].created_at).toDateString()
          const nextSame = i < groupedMessages.length - 1 && groupedMessages[i + 1].from_user === msg.from_user
          const prevSame = i > 0 && groupedMessages[i - 1].from_user === msg.from_user && !showDate
          const isLast   = !nextSame
          const deletedEveryone = isMsgDeletedEveryone(msg)
          const decoded  = decodeReply(msg.body)
          const hasMedia = !deletedEveryone && !!(msg.media_url || msg.call_type)
          const hasText  = !deletedEveryone && !!(decoded.body && !msg.call_type)
          const mediaOnly = hasMedia && !hasText && msg.media_type === 'image' && !msg.call_type
          const isDeal   = !deletedEveryone && msg.media_type === 'deal_request'
          const parsedOffer = msg.media_type === 'offer' && !deletedEveryone ? parseOfferMessage(msg.body) : null
          const isOffer  = !!(parsedOffer && parsedOffer.ok)
          const offer    = parsedOffer?.ok ? parsedOffer.offer : null
          // Phase 4 — expired pending offers are read-only (display status only)
          const offerExpired = isOfferExpired(offer)
          const effStatus = offerExpired ? OFFER_STATUS.expired : (offer && offer.status) || OFFER_STATUS.pending
          // Phase 2 — only the recipient can respond, and only while still pending
          // (expired offers are locked → read-only)
          const canRespond = !!(isOffer && offer && !offerExpired && effStatus === OFFER_STATUS.pending
            && msg.from_user !== currentUser?.id)
          // Phase 3 — position within the negotiation chain (root → active offer)
          const flow = isOffer && offer
            ? offerFlowMap.get(offer.offer_id || String(msg.id)) || null
            : null
          // Phase 7 — product context. The listing behind the offer (if loaded/available)
          const offerProduct = (() => {
            if (!isOffer || !offer || !offer.listing_id) return null
            const entry = offerListings[offer.listing_id]
            if (entry?.status === 'ok' && entry.listing) return entry.listing
            if (offer.listing_id === listing?.id && listing) return listing
            if (entry?.status === 'unavailable') return { unavailable: true }
            return null
          })()
          const msgRx    = reactions[msg.id] || {}
          const rxEntries = Object.entries(msgRx).filter(([, users]) => users?.length)
          const isFailed = msg._status === 'failed'
          const isSending = msg._status === 'sending'
          const isEdited = !!msg.edited_at
          // Countdown only for the sender — receivers should not see time remaining
          const expireLabel = isMine && msg.expires_at && !deletedEveryone
            ? (() => {
                const ms = new Date(msg.expires_at).getTime() - Date.now()
                if (ms <= 0) return null
                if (ms < 3600000) return `⏱ ${Math.ceil(ms / 60000)}m`
                if (ms < 86400000) return `⏱ ${Math.ceil(ms / 3600000)}h`
                return `⏱ ${Math.ceil(ms / 86400000)}d`
              })()
            : null
          // Offer accept-window countdown — shown only while an offer is actionable.
          // Whole days/hours, minute precision below one hour, driven by the minute ticker.
          const offerExpiryAt = isOffer && offer && offerExpiresAt(offer)
          const offerCountdownActive = !offerExpired && effStatus === OFFER_STATUS.pending && offerExpiryAt
          const offerTimeLeft = offerCountdownActive
            ? (() => {
                const ms = new Date(offerExpiryAt).getTime() - Date.now()
                if (ms <= 0) return null
                const totalMin = Math.max(1, Math.ceil(ms / 60000))
                if (totalMin < 60) return `${totalMin}m`
                const d = Math.floor(totalMin / 1440)
                const h = Math.floor((totalMin % 1440) / 60)
                return [d ? `${d}d` : '', h ? `${h}h` : ''].filter(Boolean).join(' ')
              })()
            : null
          const offerCountdownUrgency = offerCountdownActive
            ? (() => {
                const ms = new Date(offerExpiryAt).getTime() - Date.now()
                if (ms <= 0) return null
                if (ms < 3600000) return 'urgent'
                if (ms < 86400000) return 'warning'
                return null
              })()
            : null
          const offerStatusFooterText = isOffer && offer
            ? (() => {
                const text = offerStatusText({ ...offer, status: effStatus }, currentUser?.id, isMine)
                if (!text || effStatus === OFFER_STATUS.pending) return text
                return text.toLowerCase().includes(offerStatusLabel(effStatus).toLowerCase()) ? '' : text
              })()
            : ''

          let radiusClass = ''
          if (isMine) {
            if (!isLast) radiusClass += ' r-mine-tail'
            if (prevSame) radiusClass += ' r-mine-join'
          } else {
            if (!isLast) radiusClass += ' r-theirs-tail'
            if (prevSame) radiusClass += ' r-theirs-join'
          }

          return (
            <div key={msg.id} id={`msg-${msg.id}`} data-date={dateChipLabel(msg.created_at)} className={swipeHintId === msg.id ? 'is-swipe-ready' : ''}>
              {showDate && (
                <div className="chat-date-chip">
                  {dateChipLabel(msg.created_at)}
                </div>
              )}

              <div className={`msg-row ${isMine ? 'is-mine' : 'is-theirs'}${isLast ? ' is-group-end' : ''}${isFailed ? ' is-failed' : ''}`}>
                {!isMine && (
                  <button
                    type="button"
                    className="msg-avatar-btn"
                    onClick={() => navigate(`/profile/${userId}`)}
                    title="View profile"
                    style={{ border: 'none', background: 'none', padding: 0, cursor: 'pointer', opacity: isLast ? 1 : 0, pointerEvents: isLast ? 'auto' : 'none' }}
                  >
                    <ChatAvatar url={otherAvatar} initial={otherInitial} size={28} spacer={!isLast} />
                  </button>
                )}

                {isMine && (
                  <button
                    type="button"
                    className="msg-reply-btn"
                    onClick={() => { setReplyTo(msg); setTimeout(() => inputRef.current?.focus(), 30) }}
                    title="Reply"
                    aria-label="Reply"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                    </svg>
                  </button>
                )}

                <div className="msg-stack">
                  {decoded.replyPreview && (
                    <div
                      className="msg-reply-quote"
                      style={{ cursor: 'pointer' }}
                      onClick={() => {
                        if (decoded.replyPreview?.startsWith('Status reply')) {
                          navigate(`/status?status=${decoded.replyToId}`)
                          return
                        }
                        const el = document.getElementById(`msg-${decoded.replyToId}`)
                        if (el) {
                          el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                          highlightMsg(el)
                        }
                      }}
                    >
                      ↩ {decoded.replyPreview}
                    </div>
                  )}

                  {isDeal && (
                    <div className="deal-card">
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#15803d', marginBottom: 2 }}>🤝 Deal confirmation</div>
                      <div style={{ fontSize: 12, color: '#3d6b4f', lineHeight: 1.4 }}>
                        Confirm deals from Notifications for a cleaner chat.
                      </div>
                      <button type="button" onClick={() => navigate('/notifications')}>
                        Open Notifications
                      </button>
                    </div>
                  )}

                  {isOffer && (
                    <div
                      id={`msg-bubble-${msg.id}`}
                      className={[
                        'msg-bubble',
                        'offer-bubble',
                        isMine ? 'is-mine' : 'is-theirs',
                        isSending ? 'is-sending' : '',
                        isFailed ? 'is-failed-bubble' : '',
                        actionMsg?.id === msg.id ? 'is-selected' : '',
                        radiusClass,
                      ].filter(Boolean).join(' ')}
                      onPointerDown={e => !deletedEveryone && onBubblePointerDown(e, msg)}
                      onPointerMove={e => !deletedEveryone && onBubblePointerMove(e, msg)}
                      onPointerUp={e => !deletedEveryone && onBubblePointerUp(e, msg)}
                      onPointerCancel={() => onBubblePointerCancel(msg)}
                      onContextMenu={e => { e.preventDefault(); if (!deletedEveryone) openActions(msg, bubbleActionPoint(e)) }}
                      onClick={() => {
                        if (isFailed) retryMessage(msg)
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => {
                        if ((e.key === 'Enter' || e.key === ' ') && !deletedEveryone) {
                          e.preventDefault(); openActions(msg, bubbleActionPoint(e))
                        }
                      }}
                    >
                      {swipeHintId === msg.id && !deletedEveryone && (
                        <span className={`swipe-reply-hint ${isMine ? 'is-mine' : ''}`} aria-hidden>
                          ↩
                        </span>
                      )}
                      <div className={`offer-card is-${effStatus}`}>
                        {offerProduct && (offerProduct.unavailable
                          ? (
                            <div className="offer-card-product is-unavailable">
                              Listing unavailable
                            </div>
                          )
                          : (
                            <button
                              type="button"
                              className="offer-card-product"
                              onClick={e => { e.stopPropagation(); navigate(`/listing/${offer.listing_id}`) }}
                            >
                              {offerProduct.images?.[0] && (
                                <img className="offer-card-product-thumb" src={offerProduct.images[0]} alt="" loading="lazy" />
                              )}
                              <span className="offer-card-product-title">
                                {offerProduct.title || 'Product'}
                              </span>
                              <ChevronRight className="offer-card-product-arrow" size={14} strokeWidth={2} aria-hidden="true" />
                            </button>
                          )
                        )}
                        <div className="offer-card-head">
                          <span className="offer-card-tag">Price offer</span>
                          <span className={`offer-card-status is-${effStatus}`}>
                            {offerStatusLabel(effStatus)}
                          </span>
                        </div>
                        <div className="offer-card-amount">
                          <span className="offer-card-amount-currency">{offer?.currency || 'MWK'}{' '}</span>
                          {Number(offer && offer.amount || 0).toLocaleString()}
                        </div>
                        {offerProduct?.price != null && Number(offerProduct.price) > 0 && (
                          <div className="offer-card-original-price">Asking {offer?.currency || 'MWK'} {Number(offerProduct.price).toLocaleString()}</div>
                        )}
                        {offer.note && <div className="offer-card-note">{offer.note}</div>}
                        {flow && flow.total > 1 && (
                          <div className="offer-stepper" aria-label={`Negotiation offer ${flow.index} of ${flow.total}`}>
                            {flow.chain.map((oid, i) => (
                              <span
                                key={oid}
                                className={[
                                  'offer-step',
                                  i > 0 ? 'has-connector' : '',
                                  i + 1 < flow.index ? 'is-past' : '',
                                  i + 1 === flow.index ? 'is-current' : '',
                                  i + 1 > flow.index ? 'is-future' : '',
                                ].filter(Boolean).join(' ')}
                              >
                                {i + 1}
                              </span>
                            ))}
                          </div>
                        )}
                        {flow && flow.parentIndex > 0 && (
                          <div className="offer-card-parent">↩ counter to offer {flow.parentIndex}</div>
                        )}
                        {flow && flow.hasChild && (
                          <div className="offer-card-parent is-down">↓ continued by offer {flow.index + 1}</div>
                        )}
                        {(offerStatusFooterText || offerTimeLeft) && (
                          <div className="offer-card-footer">
                            {offerStatusFooterText && (
                              <span className={`offer-card-statusline is-${effStatus}`}>
                                <span className="offer-card-statusline-text">
                                  {offerStatusFooterText}
                                </span>
                              </span>
                            )}
                            {offerTimeLeft && (
                              <span className={`offer-card-countdown${offerCountdownUrgency ? ` is-${offerCountdownUrgency}` : ''}`}>
                                <span className="offer-card-countdown-ico" aria-hidden>⏱</span>
                                <span className="offer-card-countdown-label">{isMine ? 'Complete within' : 'Expires in'}</span>
                                <span className="offer-card-countdown-time">{offerTimeLeft}</span>
                              </span>
                            )}
                          </div>
                        )}
                        {isMine && !deletedEveryone && (
                          <div className="offer-card-actions is-manage">
                            {!offerExpired && offer.status === OFFER_STATUS.pending && (
                              <>
                                <button
                                  type="button"
                                  className="offer-btn-edit"
                                  onClick={() => openEditOffer(msg)}
                                >
                                  Edit
                                </button>
                                {withdrawConfirmId === msg.id ? (
                                  <>
                                    <button
                                      type="button"
                                      className="offer-btn-withdraw is-confirming"
                                      onClick={() => withdrawOffer(msg)}
                                    >
                                      Confirm withdraw
                                    </button>
                                    <button
                                      type="button"
                                      className="offer-btn-cancel"
                                      onClick={() => setWithdrawConfirmId(null)}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <button
                                    type="button"
                                    className="offer-btn-withdraw"
                                    onClick={() => onWithdrawClick(msg)}
                                  >
                                    Withdraw
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                        {canRespond && (
                          <div className="offer-card-actions">
                            <button
                              type="button"
                              className="offer-btn-accept"
                              onClick={() => respondToOffer(msg, OFFER_STATUS.accepted)}
                            >
                              Accept
                            </button>
                            {declineConfirmId === msg.id ? (
                              <>
                                <button
                                  type="button"
                                  className="offer-btn-decline is-confirming"
                                  onClick={() => respondToOffer(msg, OFFER_STATUS.declined)}
                                >
                                  Confirm decline
                                </button>
                                <button
                                  type="button"
                                  className="offer-btn-cancel"
                                  onClick={() => setDeclineConfirmId(null)}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="offer-btn-decline"
                                onClick={() => setDeclineConfirmId(msg.id)}
                              >
                                Decline
                              </button>
                            )}
                            <button
                              type="button"
                              className="offer-btn-counter"
                              onClick={() => openCounterOffer(msg)}
                            >
                              Counter offer
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="msg-meta-row">
                        {isEdited && <span className="msg-edited">edited</span>}
                        {expireLabel && <span className="msg-expire">{expireLabel}</span>}
                        <MsgMeta msg={msg} isMine={isMine} />
                      </div>
                    </div>
                  )}

                  {!isDeal && !isOffer && (
                    <div
                      id={`msg-bubble-${msg.id}`}
                      className={[
                        'msg-bubble',
                        isMine ? 'is-mine' : 'is-theirs',
                        hasMedia && !msg.call_type ? 'has-media' : '',
                        hasMedia && msg.media_type === 'image' && !msg.call_type ? 'has-image' : '',
                        mediaOnly ? 'media-only' : '',
                        isSending ? 'is-sending' : '',

                        isFailed ? 'is-failed-bubble' : '',
                        deletedEveryone ? 'is-deleted' : '',
                        actionMsg?.id === msg.id ? 'is-selected' : '',
                        radiusClass,
                      ].filter(Boolean).join(' ')}
                      onPointerDown={e => !deletedEveryone && onBubblePointerDown(e, msg)}
                      onPointerMove={e => !deletedEveryone && onBubblePointerMove(e, msg)}
                      onPointerUp={e => !deletedEveryone && onBubblePointerUp(e, msg)}
                      onPointerCancel={() => onBubblePointerCancel(msg)}
                      onContextMenu={e => { e.preventDefault(); if (!deletedEveryone) openActions(msg, bubbleActionPoint(e)) }}
                      onClick={() => {
                        if (isFailed) retryMessage(msg)
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => {
                        if ((e.key === 'Enter' || e.key === ' ') && !deletedEveryone) {
                          e.preventDefault(); openActions(msg, bubbleActionPoint(e))
                        }
                      }}
                    >
                      {swipeHintId === msg.id && !deletedEveryone && (
                        <span className={`swipe-reply-hint ${isMine ? 'is-mine' : ''}`} aria-hidden>
                          ↩
                        </span>
                      )}
                      {deletedEveryone ? (
                        <div className="msg-deleted-label">🚫 This message was deleted</div>
                      ) : (
                        <>
                          {decoded.isForwarded && (
                            <div className="msg-forwarded-label">
                              <span aria-hidden>↪</span> Forwarded
                            </div>
                          )}
                          {renderMedia(msg, decoded.body)}
                          {hasText && (
                            <div className={hasMedia && !msg.call_type ? 'msg-caption' : 'msg-text'}>
                              {decoded.body}
                            </div>
                          )}
                        </>
                      )}
                      <div className="msg-meta-row">
                        {isEdited && !deletedEveryone && <span className="msg-edited">edited</span>}
                        {expireLabel && <span className="msg-expire">{expireLabel}</span>}
                        <MsgMeta msg={msg} isMine={isMine} />
                      </div>
                    </div>
                  )}

                  {rxEntries.length > 0 && (
                    <div className={`msg-reactions ${isMine ? 'is-mine' : ''}`}>
                      {rxEntries.map(([emoji, users]) => {
                        const mine = users.includes(currentUser?.id)
                        return (
                          <button
                            key={emoji}
                            type="button"
                            className={`msg-rx-chip${mine ? ' is-mine-rx' : ''}`}
                            onClick={() => toggleReaction(msg, emoji)}
                            title={mine ? 'Remove reaction' : 'Add reaction'}
                          >
                            <span>{emoji}</span>
                            {users.length > 1 && <span className="msg-rx-count">{users.length}</span>}
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>

                {!isMine && (
                  <button
                    type="button"
                    className="msg-reply-btn"
                    onClick={() => { setReplyTo(msg); setTimeout(() => inputRef.current?.focus(), 30) }}
                    title="Reply"
                    aria-label="Reply"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                      <polyline points="9 17 4 12 9 7"/><path d="M20 18v-2a4 4 0 0 0-4-4H4"/>
                    </svg>
                  </button>
                )}

              </div>
            </div>
          )
        })}

        {(otherTyping || otherRecording) && (
          <div
            className={`msg-row is-theirs is-group-end typing-row${otherRecording ? ' is-recording' : ''}`}
            aria-live="polite"
            aria-label={otherRecording ? `${displayName} is recording audio` : `${displayName} is typing`}
          >
            <ChatAvatar url={otherAvatar} initial={otherInitial} size={28} />
            <div className="msg-stack">
              <div className={`msg-bubble is-theirs typing-bubble${otherRecording ? ' recording-bubble' : ''}`}>
                {otherRecording ? (
                  <>
                    <span className="recording-pulse" aria-hidden />
                    <span className="typing-label is-recording">Recording audio…</span>
                  </>
                ) : (
                  <>
                    <span className="typing-label">{displayName.split(' ')[0]} is typing</span>
                    <span className="typing-dots" aria-hidden>
                      {[0, 0.2, 0.4].map((d, i) => (
                        <span key={i} className="typing-dot" style={{ animationDelay: `${d}s` }} />
                      ))}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {uploading && (
          <div className="msg-row is-mine is-group-end">
            <div className="msg-stack">
              <div className="msg-bubble is-mine" style={{ padding: '10px 14px', minWidth: 160 }}>
                <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 6 }}>
                  Uploading… {uploadProgress > 0 ? `${uploadProgress}%` : ''}
                </div>
                <div style={{ height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    borderRadius: 2,
                    background: '#fff',
                    width: `${uploadProgress || 0}%`,
                    transition: 'width 0.2s ease',
                    minWidth: uploadProgress > 0 ? 0 : '100%',
                    animation: uploadProgress === 0 ? 'pulse 1s infinite' : 'none'
                  }} />
                </div>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Scroll / new messages ── */}
      {showScrollBtn && (
        <button
          type="button"
          className={`chat-scroll-fab${unreadBelow > 0 ? ' has-unread' : ''}`}
          onClick={() => scrollToBottom(true)}
          aria-label="Scroll to latest"
        >
          <ChevronDown size={20} strokeWidth={1.75} aria-hidden="true" />
          {unreadBelow > 0 && (
            <span className="chat-scroll-unread">{unreadBelow > 99 ? '99+' : unreadBelow}</span>
          )}
        </button>
      )}
      </div>

      {/* ── Toast ── */}
      {toast && (
        <div className="chat-toast" role="status">{toast}</div>
      )}

      <ChatPopupMenu
        open={!!actionMsg && actionMode === 'main'}
        anchorEl={null}
        anchorPoint={actionAnchorPoint}
        label="Message actions"
        headerLabel="Message"
        reactionRow={QUICK_REACTIONS}
        activeReactions={Object.fromEntries(QUICK_REACTIONS.map(emoji => [
          emoji,
          (reactions[actionMsg?.id]?.[emoji] || []).includes(currentUser?.id),
        ]))}
        onReaction={emoji => toggleReaction(actionMsg, emoji)}
        onClose={closeMessageMenu}
        groups={[
          [
            {
              id: 'reply',
              label: 'Reply',
              icon: Reply,
              onSelect: () => {
                setReplyTo(actionMsg)
                closeMessageMenu()
                setTimeout(() => inputRef.current?.focus(), 40)
              },
            },
            {
              id: 'copy',
              label: 'Copy',
              icon: Copy,
              onSelect: () => { copyMessage(actionMsg); closeMessageMenu() },
            },
            canForwardMessage(actionMsg) ? {
              id: 'forward',
              label: 'Forward',
              icon: Forward,
              onSelect: () => { openForward(actionMsg); closeMessageMenu() },
            } : null,
            actionMsg?.media_url ? {
              id: 'view',
              label: 'View',
              icon: Maximize2,
              onSelect: () => {
                if (actionMsg.media_type === 'image') openImageViewer(actionMsg.media_url)
                else setLightbox({ url: actionMsg.media_url, type: 'video', caption: decodeReply(actionMsg.body).body })
                closeMessageMenu()
              },
            } : null,
            actionMsg?.media_url ? {
              id: 'download',
              label: 'Download',
              icon: Download,
              onSelect: () => {
                const link = document.createElement('a')
                link.href = actionMsg.media_url
                link.download = ''
                document.body.appendChild(link)
                link.click()
                link.remove()
                closeMessageMenu()
              },
            } : null,
            actionMsg?.from_user === currentUser?.id
              && !actionMsg.call_type
              && actionMsg.media_type !== 'offer'
              && !(actionMsg.media_url && actionMsg.media_type && actionMsg.media_type !== 'text') ? {
              id: 'edit',
              label: 'Edit message',
              icon: Pencil,
              onSelect: () => startEditMessage(actionMsg),
            } : null,
            actionMsg?.from_user === currentUser?.id ? {
              id: 'timer',
              label: 'Auto-delete timer',
              icon: TimerReset,
              keepOpen: true,
              onSelect: () => setActionMode('timer'),
            } : null,
            actionMsg?._status === 'failed' ? {
              id: 'retry',
              label: 'Retry send',
              icon: RotateCcw,
              onSelect: () => { retryMessage(actionMsg); closeMessageMenu() },
            } : null,
          ].filter(Boolean),
          [
            {
              id: 'delete',
              label: 'Delete…',
              icon: Trash2,
              danger: true,
              keepOpen: true,
              onSelect: () => setActionMode('delete'),
            },
          ],
        ]}
      />

      <ChatPopupMenu
        open={!!actionMsg && actionMode === 'delete'}
        anchorEl={null}
        anchorPoint={actionAnchorPoint}
        label="Delete message"
        headerLabel="Message"
        title="Delete message"
        onClose={closeMessageMenu}
        groups={[
          [
            {
              id: 'back',
              label: 'Back',
              icon: CornerUpLeft,
              keepOpen: true,
              onSelect: () => setActionMode('main'),
            },
            {
              id: 'delete-for-me',
              label: 'Delete for me',
              icon: Trash2,
              danger: true,
              onSelect: () => { deleteMessageForMe(actionMsg); closeMessageMenu() },
            },
          ],
          ...(actionMsg?.from_user === currentUser?.id ? [[
            {
              id: 'delete-for-everyone',
              label: 'Delete for everyone',
              icon: Eraser,
              danger: true,
              badge: 'x',
              onSelect: () => { deleteMessageForEveryone(actionMsg); closeMessageMenu() },
            },
          ]] : []),
        ]}
      />

      <ChatPopupMenu
        open={!!actionMsg && actionMode === 'timer'}
        anchorEl={null}
        anchorPoint={actionAnchorPoint}
        label="Auto-delete"
        headerLabel="Message"
        title="Auto-delete timer"
        onClose={closeMessageMenu}
        groups={[
          [
            {
              id: 'back',
              label: 'Back',
              icon: CornerUpLeft,
              keepOpen: true,
              onSelect: () => setActionMode('main'),
            },
            { label: '1 hour', icon: TimerReset, onSelect: () => { setMessageDisappear(actionMsg, 3600000); closeMessageMenu() } },
            { label: '24 hours', icon: TimerReset, onSelect: () => { setMessageDisappear(actionMsg, 86400000); closeMessageMenu() } },
            { label: '7 days', icon: TimerReset, onSelect: () => { setMessageDisappear(actionMsg, 604800000); closeMessageMenu() } },
            { label: 'Off', icon: TimerReset, onSelect: () => { setMessageDisappear(actionMsg, null); closeMessageMenu() } },
          ],
        ]}
      />

      <ChatPopupMenu
        open={!!imageActionMsg}
        anchorEl={null}
        anchorPoint={imageActionPoint}
        label="Image actions"
        headerLabel="Image"
        headerImage={imageActionMsg?.media_url}
        onClose={closeImageMenu}
        groups={[
          [
            {
              id: 'view',
              label: 'View',
              icon: Maximize2,
              onSelect: () => {
                const img = imageActionMsg
                closeImageMenu()
                if (img?.media_url) openImageViewer(img.media_url)
              },
            },
            imageActionMsg && canForwardMessage(imageActionMsg) ? {
              id: 'forward',
              label: 'Forward',
              icon: Forward,
              onSelect: () => openForward(imageActionMsg),
            } : null,
            imageActionMsg?.media_url ? {
              id: 'download',
              label: 'Download',
              icon: Download,
              onSelect: () => {
                const link = document.createElement('a')
                link.href = imageActionMsg.media_url
                link.download = ''
                document.body.appendChild(link)
                link.click()
                link.remove()
              },
            } : null,
          ].filter(Boolean),
          [
            {
              id: 'delete-for-me',
              label: 'Delete for me',
              icon: Trash2,
              danger: true,
              onSelect: () => {
                const img = imageActionMsg
                closeImageMenu()
                deleteMessageForMe(img)
              },
            },
            ...(imageActionMsg?.from_user === currentUser?.id ? [{
              id: 'delete-for-everyone',
              label: 'Delete for everyone',
              icon: Eraser,
              danger: true,
              badge: 'x',
              onSelect: () => {
                const img = imageActionMsg
                closeImageMenu()
                deleteMessageForEveryone(img)
              },
            }] : []),
          ],
        ]}
      />

      {/* ── Forward picker sheet ── */}
      {forwardMsgs?.length > 0 && currentUser?.id && (
        <ForwardSheet
          currentUserId={currentUser.id}
          messages={forwardMsgs}
          plainBody={plainBodyForForward}
          currentKey={currentChatKey()}
          senderName={myProfile?.full_name || 'Someone'}
          onClose={() => setForwardMsgs(null)}
          onSent={onForwarded}
        />
      )}

      {/* ── Edit message sheet ── */}
      {editingMsg && (
        <div className="chat-action-scrim" onClick={() => setEditingMsg(null)} role="presentation">
          <div className="chat-action-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Edit message">
            <div className="chat-action-handle" />
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 10, padding: '0 4px' }}>Edit message</div>
            <textarea
              className="dm-report-details"
              value={editDraft}
              onChange={e => setEditDraft(e.target.value)}
              rows={4}
              autoFocus
              style={{ marginBottom: 12 }}
            />
            <button
              type="button"
              className="dm-btn dm-btn-continue"
              style={{ width: '100%', marginBottom: 8 }}
              onClick={saveEditedMessage}
            >
              Save
            </button>
            <button type="button" className="chat-action-cancel" onClick={() => { setEditingMsg(null); setEditDraft('') }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* ── Price offer bottom sheet ── */}
      {showOffer && (
        <div className="chat-action-scrim" onClick={closeOfferSheet} role="presentation">
          <div className="chat-action-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label={editOfferMsg ? 'Edit offer' : counterParent ? 'Counter offer' : 'Make an offer'}>
            <div className="chat-action-handle" />
            <div className="offer-sheet-head">
              <span className="offer-sheet-icon"><CircleDollarSign size={18} strokeWidth={2} /></span>
              <div>
                <div className="offer-sheet-title">{editOfferMsg ? 'Edit offer' : counterParent ? 'Counter offer' : 'Make an offer'}</div>
                <div className="offer-sheet-sub">
                  {editOfferMsg ? "Update your offer" : counterParent ? "Send your counter offer to the other party" : "Send the price you're willing to pay"}
                </div>
              </div>
            </div>

            {listing && (
              <div className="offer-sheet-listing">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="offer-sheet-listing-title">{listing.title}</div>
                  <div className="offer-sheet-listing-price">
                    Listed at MWK {Number(listing.price || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            )}

            <div className="offer-sheet-field">
              <label className="offer-sheet-label">Your offer</label>
              <div className="offer-sheet-amount-wrap">
                <span className="offer-sheet-currency">MWK</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="offer-sheet-amount"
                  placeholder="0"
                  value={offerAmount}
                  onChange={e => setOfferAmount(e.target.value.replace(/[^\d.,]/g, ''))}
                  autoFocus
                />
              </div>
            </div>

            <div className="offer-sheet-field">
              <label className="offer-sheet-label">Note (optional)</label>
              <textarea
                className="offer-sheet-note"
                rows={2}
                placeholder="e.g. Ready to buy today — can pick up this weekend."
                value={offerNote}
                onChange={e => setOfferNote(e.target.value)}
              />
            </div>

            <div className="offer-sheet-field">
              <label className="offer-sheet-label">Accept before (optional)</label>
              <div className="offer-sheet-expiry">
                {OFFER_EXPIRY_OPTIONS.map(opt => (
                  <button
                    key={opt.key}
                    type="button"
                    className={`offer-sheet-expiry-chip${offerCustomExpiry === '' && offerExpiryHours === opt.hours ? ' is-on' : ''}`}
                    onClick={() => { setOfferCustomExpiry(''); setOfferExpiryHours(opt.hours) }}
                  >
                    {opt.label}
                  </button>
                ))}
                <button
                  type="button"
                  className={`offer-sheet-expiry-chip${offerCustomExpiry !== '' ? ' is-on' : ''}`}
                  onClick={() => { setOfferCustomExpiry(String(offerExpiryHours > 0 ? offerExpiryHours : 24)) }}
                >
                  Custom
                </button>
              </div>
              {offerCustomExpiry !== '' ? (
                <div className="offer-sheet-custom-expiry">
                  <input
                    type="number"
                    min="1"
                    max="8760"
                    className="offer-sheet-custom-input"
                    value={offerCustomExpiry}
                    onChange={e => setOfferCustomExpiry(e.target.value)}
                    onBlur={() => {
                      const h = Math.round(Number(offerCustomExpiry))
                      if (Number.isFinite(h) && h > 0) {
                        setOfferExpiryHours(h)
                        setOfferCustomExpiry(String(h))
                      } else {
                        setOfferCustomExpiry('')
                      }
                    }}
                    placeholder="Hours"
                  />
                  <span className="offer-sheet-custom-unit">hour(s)</span>
                </div>
              ) : (
                <div className="offer-sheet-hint">
                  {offerExpiryHours === 0
                    ? 'This offer will not expire'
                    : `The other party must respond within ${offerExpiryHours} hour${offerExpiryHours === 1 ? '' : 's'}`}
                </div>
              )}
            </div>

            <div className="offer-sheet-actions">
              <button type="button" className="offer-sheet-cancel" onClick={closeOfferSheet}>
                Cancel
              </button>
              <button
                type="button"
                className="offer-sheet-send"
                disabled={!Number(String(offerAmount).replace(/[^\d.]/g, ''))}
                onClick={sendOffer}
              >
                <CircleDollarSign size={16} strokeWidth={2} />
                {editOfferMsg ? 'Save changes' : counterParent ? 'Send counter offer' : 'Send offer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {imageViewer && (
        <ImageViewer
          key={`${imageViewer.index}-${imageViewer.photos.length}`}
          photos={imageViewer.photos}
          index={imageViewer.index}
          onChange={index => setImageViewer(prev => ({ ...prev, index }))}
          onClose={closeImageViewer}
        />
      )}

      {/* ── Image / video lightbox ── */}
      {lightbox && (
        <div className="chat-lightbox" onClick={() => setLightbox(null)} role="dialog" aria-modal="true">
          <div className="chat-lightbox-toolbar" onClick={e => e.stopPropagation()}>
            <button type="button" onClick={() => setLightbox(null)} aria-label="Close">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
            <div className="chat-lightbox-actions" style={{ display: 'flex', gap: 8 }}>
              <a href={lightbox.url} target="_blank" rel="noreferrer" download={(lightbox.url || '').split('/').pop().split('?')[0] || 'media'} title="Download">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M12 5v10M8 11l4 4 4-4"/><path d="M5 19h14"/>
                </svg>
              </a>
            </div>
          </div>
          {lightbox.type === 'video' ? (
            <video src={lightbox.url} controls autoPlay onClick={e => e.stopPropagation()} />
          ) : (
            <img src={lightbox.url} alt={lightbox.caption || 'Media'} onClick={e => e.stopPropagation()} />
          )}
          {lightbox.caption ? <div className="chat-lightbox-caption">{lightbox.caption}</div> : null}
        </div>
      )}

      {/* ── Emoji Picker ── */}
      {showEmoji && (
        <>
          <div className="ep-backdrop" onClick={() => setShowEmoji(false)} />
          <div
            ref={emojiPickerRef}
            className="ep-wrap"
            onClick={e => e.stopPropagation()}
            style={isMobile ? { '--ep-locked-height': `${lockedKbHeight}px` } : undefined}
          >
          {/* Header */}
          <div className="ep-header">
            <span className="ep-header-label">
              {EMOJI_BY_ID[emojiTab]?.label || 'Emoji'}
            </span>
            <button
              type="button"
              className="ep-close"
              onClick={() => { setShowEmoji(false); inputRef.current?.focus() }}
              aria-label="Switch to keyboard"
              title="Keyboard"
            >
              <Keyboard size={18} strokeWidth={2} />
            </button>
            <button
              type="button"
              className="ep-close"
              onClick={() => setShowEmoji(false)}
              aria-label="Close emoji picker"
            >
              ✕
            </button>
          </div>

          {/* Emoji grid */}
          <div className="ep-grid">
            {(emojiTab === 'recent'
              ? (recentEmojis.length > 0 ? recentEmojis : EMOJI_FREQUENT)
              : (EMOJI_BY_ID[emojiTab]?.emojis || [])
            ).map((em, i) => (
              <button key={i} type="button" className="ep-btn" onClick={() => insertEmoji(em)}>{em}</button>
            ))}
          </div>

          {/* Category tabs */}
          <div className="ep-tabs">
            {EMOJI_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                className={`ep-tab${emojiTab === cat.id ? ' ep-tab--active' : ''}`}
                onClick={() => setEmojiTab(cat.id)}
                aria-label={cat.label}
                title={cat.label}
              >
                {cat.icon}
              </button>
            ))}
          </div>
        </div>
        </>
      )}

      {!recording && chatDisabledReason && (
        <div className="chat-disabled-bar">{chatDisabledReason}</div>
      )}

      {recording && !chatDisabledReason && (
        <div
          className="chat-recording-bar"
          style={{ ...S.recordingBar, position: 'relative', bottom: isMobile && showEmoji && lockedKbHeight > 0 ? lockedKbHeight : 0 }}
          onTouchStart={e => { recSlideStartRef.current = e.touches[0]?.clientX ?? null }}
          onTouchMove={e => {
            const startX = recSlideStartRef.current
            if (startX != null && (e.touches[0]?.clientX ?? startX) - startX < -80) cancelRecording()
          }}
          onTouchEnd={() => { recSlideStartRef.current = null }}
        >
          <span className="chat-recording-dot" aria-hidden="true" />
          <span className="chat-recording-time">{formatTime(recordingTime)}</span>
          {isTouchDevice ? (
            <span className="chat-recording-slide">Slide to cancel</span>
          ) : (
            <button type="button" className="chat-recording-cancel" onClick={cancelRecording}>Cancel</button>
          )}
          <button
            type="button"
            className="chat-send-btn"
            onClick={stopRecording}
            aria-label="Send voice note"
          >
            <SendHorizontal size={22} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </div>
      )}

      {!recording && !chatDisabledReason && showDmGate && (
        <div className="dm-input-locked">
          Choose Continue, Block, or Report above to respond
        </div>
      )}

      {!recording && !chatDisabledReason && !showDmGate && (
        <HideDuringCall>
          <>
            <div
              className="chat-composer-shell"
              style={{ position: 'relative', bottom: isMobile && showEmoji && lockedKbHeight > 0 ? lockedKbHeight : 0, willChange: isMobile && showEmoji ? 'transform' : 'auto' }}
            >
              {replyTo && (
                <div className="chat-reply-banner">
                  <CornerUpLeft size={16} strokeWidth={1.75} aria-hidden="true" />
                  <div className="chat-reply-copy">
                    <span className="chat-reply-name">{replyTo.from_user === currentUser?.id ? 'You' : displayName}</span>
                    <span className="chat-reply-text">
                      {decodeReply(replyTo.body).body
                        || (replyTo.media_type === 'audio' ? 'Voice note'
                          : replyTo.media_type === 'image' ? 'Photo'
                          : replyTo.media_type === 'video' ? 'Video'
                          : 'File')}
                    </span>
                  </div>
                  <button type="button" className="chat-reply-close" onClick={() => setReplyTo(null)} aria-label="Cancel reply">
                    <X size={20} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>
              )}

              {preview.length > 0 && (
                <div className="chat-attachment-strip">
                  {preview.map((item, index) => (
                    <div
                      key={index}
                      className={item.type === 'image' || item.type === 'video' ? 'chat-attachment-thumb' : 'chat-attachment-file'}
                      style={{ '--chat-progress': `${item._uploadProgress || 0}%` }}
                    >
                      {item.type === 'image' && <img src={item.url} alt="Attachment preview" />}
                      {item.type === 'video' && <video src={item.url} muted />}
                      {item.type !== 'image' && item.type !== 'video' && (
                        <>
                          <FileText size={20} strokeWidth={1.75} aria-hidden="true" />
                          <span className="chat-attachment-name">{item.file?.name || (item.type === 'audio' ? 'Audio' : 'File')}</span>
                        </>
                      )}
                      <button
                        type="button"
                        className="chat-attachment-remove"
                        disabled={uploading}
                        onClick={() => setPreview(items => items.filter((_, i) => i !== index))}
                        aria-label="Remove attachment"
                      >
                        <X size={14} strokeWidth={2} aria-hidden="true" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {showQuickReplies && (
                <div className="chat-quick-replies-bar">
                  <button
                    type="button"
                    className="chat-quick-reply"
                    onClick={() => { setShowAttach(false); sendMessage('Is this still available?') }}
                  >
                    <PackageCheck size={16} strokeWidth={1.75} aria-hidden="true" />
                    <span>Is this still available?</span>
                  </button>
                  {offersAllowedToday && (
                    <button type="button" className="chat-quick-reply" onClick={openComposerOffer}>
                      <HandCoins size={16} strokeWidth={1.75} aria-hidden="true" />
                      <span>Make an offer</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="chat-quick-reply"
                    onClick={() => { setShowAttach(false); sendMessage("What's your last price?") }}
                  >
                    <MessageCircleQuestion size={16} strokeWidth={1.75} aria-hidden="true" />
                    <span>What's your last price?</span>
                  </button>
                </div>
              )}

              <div className="chat-input-bar" style={S.inputBar}>
                <button
                  ref={attachBtnRef}
                  type="button"
                  className={`chat-attach-btn${showAttach ? ' is-on' : ''}`}
                  onClick={e => { e.stopPropagation(); setShowAttach(value => !value); setShowEmoji(false) }}
                  title="Attach"
                  aria-label="Attach"
                >
                  <CirclePlus size={22} strokeWidth={1.75} aria-hidden="true" />
                </button>

                <div className="chat-composer">
                  <textarea
                    ref={inputRef}
                    readOnly={showEmoji}
                    placeholder="Message"
                    value={newMsg}
                    onFocus={e => {
                      if (showEmoji) {
                        e.target.blur()
                        return
                      }
                    }}
                    onSelect={() => { cursorPosRef.current = inputRef.current?.selectionStart ?? null }}
                    onKeyUp={() => { cursorPosRef.current = inputRef.current?.selectionStart ?? null }}
                    onClick={() => { cursorPosRef.current = inputRef.current?.selectionStart ?? null }}
                    onTouchEnd={() => { cursorPosRef.current = inputRef.current?.selectionStart ?? null }}
                    onChange={e => {
                      handleTyping(e.target.value)
                      e.target.style.height = 'auto'
                      e.target.style.height = Math.min(e.target.scrollHeight, 105) + 'px'
                    }}
                    onKeyDown={handleKey}
                    rows={1}
                  />
                  <button
                    type="button"
                    className={`chat-emoji-btn${showEmoji ? ' is-on' : ''}`}
                    onClick={e => {
                      e.stopPropagation(); setShowAttach(false)
                      if (!showEmoji) {
                        const cs = getComputedStyle(document.documentElement)
                        const kb = parseFloat(cs.getPropertyValue('--chat-kb-offset')) || 0
                        if (kb > 0) setLockedKbHeight(kb)
                        inputRef.current?.blur()
                        setShowEmoji(true)
                      } else {
                        setShowEmoji(false)
                      }
                    }}
                    onMouseDown={e => e.preventDefault()}
                    title="Emoji"
                    aria-label="Emoji"
                  >
                    <SmilePlus size={20} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                </div>

                {composerHasContent ? (
                  <button
                    type="button"
                    className="chat-send-btn"
                    onClick={() => {
                      if (newMsg.trim()) sendMessage(newMsg)
                      else if (preview.length) uploadQueue(preview)
                    }}
                    aria-label="Send message"
                  >
                    <SendHorizontal size={22} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                ) : (
                  <button
                    type="button"
                    className="chat-mic-btn"
                    onClick={startRecording}
                    title="Voice note"
                    aria-label="Record voice message"
                  >
                    <Mic size={22} strokeWidth={1.75} aria-hidden="true" />
                  </button>
                )}
              </div>
            </div>

            <ChatPopupMenu
              open={showAttach}
              anchorEl={attachBtnRef.current}
              groups={[[
                {
                  id: 'photo',
                  label: 'Photo',
                  icon: ImageIcon,
                  onSelect: () => pickFile('image/*', 'image'),
                },
                ...(isTouchDevice ? [{
                  id: 'camera',
                  label: 'Camera',
                  icon: Camera,
                  onSelect: () => pickFile('image/*', 'image', { capture: 'environment' }),
                }] : []),
                {
                  id: 'file',
                  label: 'File',
                  icon: FileText,
                  onSelect: () => pickFile('*/*', 'file'),
                },
                ...(offersAllowedToday ? [{
                  id: 'offer',
                  label: 'Make an offer',
                  icon: HandCoins,
                  onSelect: openComposerOffer,
                }] : []),
              ]]}
              onClose={() => setShowAttach(false)}
              label="Attach"
              title="Share"
              iconSide="left"
            />
          </>
        </HideDuringCall>
      )}
    </div>
    </ChatCallHost>
  )
}
