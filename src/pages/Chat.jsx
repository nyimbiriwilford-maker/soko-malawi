import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams, useNavigate, useLocation, useSearchParams } from 'react-router-dom'
import {
  resolveChatSource,
  messageContextFields,
  sourceMeta,
  sourceHref,
  CHAT_SOURCES,
  conversationKey,
  markChatDeleted,
} from '../utils/chatSources'
import SafeAvatar from '../components/SafeAvatar'
import {
  Image as ImageIcon,
  Video,
  FileText,
  Paperclip,
  SmilePlus,
  Camera,
  Music,
  File as FileIcon2,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
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
import ChatCallHost, { CallHeaderButtons, HideDuringCall } from '../components/ChatCallHost'
import CallMessageBubble from '../components/CallMessageBubble'
import { maybePromptDealReady } from '../utils/dealNotificationFlow'
import { notifyMissedCall, notifyCallDeclined } from '../utils/callNotifications'
import {
  EMOJI_CATEGORIES,
  EMOJI_BY_ID,
  DEFAULT_EMOJI_TAB,
  EMOJI_FREQUENT,
} from '../constants/emojiCatalog'
import '../styles/chat-thread.css'

const ATTACH_OPTIONS = [
  { id: 'image', label: 'Photo', sub: 'JPG, PNG, WEBP', accept: 'image/*', type: 'image', Icon: ImageIcon, tone: 'photo' },
  { id: 'camera', label: 'Camera', sub: 'Take a picture', accept: 'image/*', type: 'image', Icon: Camera, tone: 'camera', capture: 'environment' },
  { id: 'video', label: 'Video', sub: 'MP4, MOV', accept: 'video/*', type: 'video', Icon: Video, tone: 'video' },
  { id: 'audio', label: 'Audio', sub: 'Music or voice file', accept: 'audio/*', type: 'audio', Icon: Music, tone: 'audio' },
  { id: 'file', label: 'Document', sub: 'PDF, DOC, ZIP…', accept: '*/*', type: 'file', Icon: FileText, tone: 'doc' },
]


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
  if (!body) return { body, replyPreview: null, replyToId: null }
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

  // ── State ────────────────────────────────────────────────────────────────
  const [messages, setMessages]           = useState([])
  const [groupedMessages, setGroupedMessages] = useState([])
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
  const [job, setJob]                     = useState(null)
  const [request, setRequest]             = useState(null)
  const [chatSource, setChatSource]       = useState(() =>
    resolveChatSource({ searchParams, locationState: location.state, contextId }) || 'direct'
  )
  const [booking, setBooking]             = useState(null)
  const [isServiceChat, setIsServiceChat] = useState(false)
  const chatSourceRef = useRef(chatSource)
  const [loading, setLoading]             = useState(true)
  const [uploading, setUploading]         = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const pendingGroupIdRef = useRef(null)
  const [recording, setRecording]         = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [waveHeights, setWaveHeights]     = useState(Array(40).fill(2))
  const [playingId, setPlayingId]         = useState(null)
  const [audioProgress, setAudioProgress] = useState({})
  const [audioDuration, setAudioDuration] = useState({})
  const [preview, setPreview]             = useState([])
  const [showEmoji, setShowEmoji]         = useState(false)
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
const [showAttach, setShowAttach]       = useState(false)
const [actionMsg, setActionMsg]         = useState(null) // message under action sheet
const [toast, setToast]                 = useState(null)
const [reactions, setReactions]         = useState({})
const [unreadBelow, setUnreadBelow]     = useState(0)
const [swipeHintId, setSwipeHintId]     = useState(null)
const [dmAccepted, setDmAccepted]       = useState(false)
const [dmBusy, setDmBusy]               = useState(false)
const [showReportSheet, setShowReportSheet] = useState(false)
const [reportReason, setReportReason]   = useState('spam')
const [reportDetails, setReportDetails] = useState('')
const [showChatMenu, setShowChatMenu]   = useState(false)
const [menuMode, setMenuMode]           = useState('main') // main | report | delete
const [actionMode, setActionMode]       = useState('main') // main | delete | timer | edit
const [editingMsg, setEditingMsg]       = useState(null)
const [editDraft, setEditDraft]         = useState('')
const [defaultDisappear, setDefaultDisappear] = useState(null) // ms offset or null

  const isServiceChatRef   = useRef(false)
  const chatContextRef     = useRef({ source: chatSource, contextId })
  const currentUserRef     = useRef(null)

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
  const nearBottomRef      = useRef(true)
  const mediaRecorderRef   = useRef(null)
  const chunksRef          = useRef([])
  const timerRef           = useRef(null)
  const analyserRef        = useRef(null)
  const animFrameRef       = useRef(null)
  const audioRefs          = useRef({})
  const inputRef           = useRef(null)
  const channelRef         = useRef(null)
  const presenceChannelRef = useRef(null)
  const typingTimeoutRef   = useRef(null)
  const otherTypingRef     = useRef(false)
  const otherRecordingRef  = useRef(false)
  const offlineApplyRef    = useRef(null)
  const emojiPickerRef     = useRef(null)
  const longPressRef       = useRef(null)
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
  }, [userId, contextId, searchParams.get('src')])

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
      if (lightbox) setLightbox(null)
      else if (actionMsg) setActionMsg(null)
      else if (showEmoji) setShowEmoji(false)
      else if (showAttach) setShowAttach(false)
      else if (chatSearch !== null) setChatSearch(null)
      else if (replyTo) setReplyTo(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, actionMsg, showEmoji, showAttach, chatSearch, replyTo])

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
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) setShowEmoji(false)
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

    // Ensure the other person has a `users` row when allowed (legacy FK support)
    try {
      await supabase.from('users').upsert(
        { id: userId, name: otherProf?.full_name || 'User' },
        { onConflict: 'id' }
      )
    } catch { /* ignore 403 */ }
    const { data: other } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
    setOtherUser(other || { id: userId, name: otherProf?.full_name || 'User' })

    // Load last_seen from profile on mount
    if (otherProf?.last_seen) setOtherLastSeen(new Date(otherProf.last_seen))

    // ── Resolve chat source (listing / service / job / shop / request / direct) ──
    let source = resolveChatSource({
      searchParams,
      locationState: location.state,
      contextId,
    })

    // Reset context entities
    setListing(null)
    setService(null)
    setShop(null)
    setJob(null)
    setRequest(null)
    setIsServiceChat(false)
    isServiceChatRef.current = false
    setBooking(null)

    if (contextId) {
      // Explicit source from URL/state first; otherwise detect by probing tables
      if (!source || source === 'direct') {
        source = await detectContextSource(contextId)
      }
      await loadContextEntity(source, contextId, user.id)
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
      ['job', () => supabase.from('jobs').select('id').eq('id', id).maybeSingle()],
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

  async function loadContextEntity(source, id, myId) {
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
          try {
            const foundBooking = await loadBooking(id, myId, userId)
            if (foundBooking) setBooking(foundBooking)
          } catch { /* ignore */ }
        }
      } else if (source === 'shop') {
        const { data } = await supabase.from('shops').select('*').eq('id', id).maybeSingle()
        if (data) setShop(data)
      } else if (source === 'job') {
        const { data } = await supabase.from('jobs').select('*').eq('id', id).maybeSingle()
        if (data) setJob(data)
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
      case 'job': return query.eq('job_id', ctxId)
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
      if (msg.listing_id || msg.service_id || msg.job_id || msg.shop_id || msg.request_id) return false
      return true
    }
    switch (source) {
      case 'service': return msg.service_id === ctxId
      case 'listing': return msg.listing_id === ctxId
      case 'job': return msg.job_id === ctxId || msg.chat_source === 'job'
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
        setMessages(prev => {
          const withoutTemp = prev.filter(m => {
            if (String(m.id).startsWith('temp_') && m.from_user === msg.from_user && m.media_type === msg.media_type) return false
            if (m.id === msg.id) return false
            return true
          })
          const next = [...withoutTemp, msg]

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
              return imageGroupingService.appendMessage(withoutOptimistic, { ...msg, _status: undefined })
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
          setGroupedMessages(imageGroupingService.groupMessages(next))
          return next
        })
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'messages' }, payload => {
        const old = payload.old
        if (!old?.id) return
        setMessages(prev => {
          const next = prev.filter(m => m.id !== old.id)
          setGroupedMessages(imageGroupingService.groupMessages(next))
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
    const text = decodeReply(msg.body || '').body
      || (msg.media_type === 'image' ? msg.media_url || 'Photo'
        : msg.media_type === 'video' ? msg.media_url || 'Video'
        : msg.media_type === 'audio' ? 'Voice note'
        : msg.media_url || '')
    try {
      await navigator.clipboard.writeText(text)
      showToast('Copied')
      haptic(8)
    } catch {
      showToast('Could not copy')
    }
    setActionMsg(null)
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

  function openActions(msg) {
    if (!msg || msg.media_type === 'deal_request') return
    if (isMsgDeletedEveryone(msg)) return
    haptic(14)
    setActionMsg(msg)
    setActionMode('main')
    setShowEmoji(false)
    setShowAttach(false)
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
    swipeRef.current = { id: msg.id, x: startX, dx: 0, active: true }
    longPressFiredRef.current = false
    clearTimeout(longPressRef.current)
    longPressRef.current = setTimeout(() => {
      if (!swipeRef.current.active) return
      if (Math.abs(swipeRef.current.dx) > 12) return
      longPressFiredRef.current = true
      openActions(msg)
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
  async function loadBooking(serviceId, myId, otherId) {
    if (!serviceId || serviceId === 'undefined' || !myId || !otherId) return null
    const { data: bk1 } = await supabase.from('bookings').select('*')
      .eq('service_id', serviceId).eq('customer_id', myId).eq('provider_id', otherId)
      .order('created_at', { ascending: false }).limit(1)
    if (bk1?.length) return bk1[0]
    const { data: bk2 } = await supabase.from('bookings').select('*')
      .eq('service_id', serviceId).eq('customer_id', otherId).eq('provider_id', myId)
      .order('created_at', { ascending: false }).limit(1)
    if (bk2?.length) return bk2[0]
    return null
  }

  async function loadMessages(myId, source, ctxId) {
    let query = supabase.from('messages').select('*')
      .or(`and(from_user.eq.${myId},to_user.eq.${userId}),and(from_user.eq.${userId},to_user.eq.${myId})`)
      .order('created_at', { ascending: true })

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
        .order('created_at', { ascending: true })
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
          if (source === 'job') return !m.job_id || m.job_id === ctxId || m.chat_source === 'job'
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
      setMessages(data)
      setGroupedMessages(imageGroupingService.groupMessages(data))
      // TODO Phase 7: rebuild groupedMessages when older messages are prepended
      // (no pagination yet — loadMessages replaces the whole array; if older messages
      // are later prepended, use: setGroupedMessages(imageGroupingService.groupMessages([...olderMessages, ...currentMessages])))
      if (!isFromRequest.current && data?.some(m =>
        m.chat_source === 'request' || m.body?.includes('I can help with your request') || m.body?.includes('I saw your request for')
      )) {
        setIsRequestChat(true)
      }
    }
  }

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
    if (error && /chat_source|job_id|shop_id|request_id|column/i.test(error.message || '')) {
      const legacy = { ...msgData }
      delete legacy.chat_source
      delete legacy.job_id
      delete legacy.shop_id
      delete legacy.request_id
      // Keep listing_id / service_id which already exist
      if (src === 'job' || src === 'shop' || src === 'request') {
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
    const contextTitle = listing?.title || service?.name || shop?.name || job?.title || request?.title || null
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
            chat_source: src,
            listing_title: contextTitle,
          },
          read: false,
        })
      } catch (notifErr) {
        console.warn('Message notification error:', notifErr)
      }
    }
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
      // Also update the pending group bubble's per-image progress
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

  function insertEmoji(emoji) {
    const pos = inputRef.current?.selectionStart ?? newMsg.length
    const next = newMsg.slice(0, pos) + emoji + newMsg.slice(pos)
    setNewMsg(next)
    handleTyping(next)
    setTimeout(() => {
      inputRef.current?.focus()
      inputRef.current?.setSelectionRange(pos + emoji.length, pos + emoji.length)
    }, 0)
  }

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
      drawWave(analyser)
    } catch (e) {
      setRecordingIndicator(false, target)
      alert('Microphone access denied')
    }
  }

  function drawWave(analyser) {
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    function frame() {
      analyser.getByteFrequencyData(dataArray)
      setWaveHeights(Array(40).fill(0).map((_, i) =>
        Math.max(2, (dataArray[Math.floor(i * dataArray.length / 40)] / 255) * 36)
      ))
      animFrameRef.current = requestAnimationFrame(frame)
    }
    frame()
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop(); setRecording(false)
    setRecordingIndicator(false, activityTarget())
    clearInterval(timerRef.current); cancelAnimationFrame(animFrameRef.current)
    setRecordingTime(0); setWaveHeights(Array(40).fill(2))
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
    setRecordingTime(0); setWaveHeights(Array(40).fill(2))
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

  // ── Avatar helpers ───────────────────────────────────────────────────────
  const otherName    = otherProfile?.full_name || otherUser?.name || otherUser?.email || 'User'
  const otherAvatar  = otherProfile?.avatar_url || null
  const otherInitial = otherName[0].toUpperCase()
  const myName       = myProfile?.full_name || currentUser?.email || 'Me'
  const myAvatar     = myProfile?.avatar_url || null
  const myInitial    = myName[0].toUpperCase()

  // ── Render helpers ───────────────────────────────────────────────────────
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
                  onClick={e => {
                    if (img._uploading) return
                    e.stopPropagation()
                    setLightbox({ url: img.media_url, type: 'image', caption: '' })
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
        <button
          type="button"
          className="media-image-wrap"
          onClick={e => {
            e.stopPropagation()
            setLightbox({ url, type: 'image', caption: caption || '' })
          }}
          onPointerDown={e => e.stopPropagation()}
          aria-label="Open image"
        >
          <img src={url} alt={caption || 'Shared image'} loading="lazy" />
        </button>
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
  }, [setLightbox, currentUser, renderVoiceNote])

  const callHostProps = {
    userId,
    currentUser,
    listingId: contextId,
    isServiceChatRef,
    otherName,
    otherAvatar,
    otherInitial,
    onCallMessage: (fields) => sendMessage('', 'text', null, fields),
  }

  // Unified source caption for the in-chat header strip
  const srcMeta = sourceMeta(chatSource)
  const contextCaption = (() => {
    if (chatSource === 'service' && service) {
      return {
        title: service.name,
        sub: [service.rate, service.city].filter(Boolean).join(' · '),
        img: service.media_urls?.[0] || null,
        href: sourceHref('service', service),
      }
    }
    if (chatSource === 'listing' && listing) {
      return {
        title: listing.title,
        sub: listing.price != null ? `MWK ${Number(listing.price).toLocaleString()}` : '',
        img: listing.images?.[0] || null,
        href: sourceHref('listing', listing),
      }
    }
    if (chatSource === 'shop' && shop) {
      return {
        title: shop.name,
        sub: [shop.category, shop.city || shop.district].filter(Boolean).join(' · '),
        img: shop.logo_url || null,
        href: sourceHref('shop', shop),
      }
    }
    if (chatSource === 'job' && job) {
      return {
        title: job.title,
        sub: [job.company, job.city, job.type].filter(Boolean).join(' · '),
        img: job.logo_url || job.cover_image_url || null,
        href: sourceHref('job', job),
      }
    }
    if (chatSource === 'request' && request) {
      return {
        title: request.title,
        sub: [request.budget ? `Budget: ${request.budget}` : null, request.city].filter(Boolean).join(' · '),
        img: null,
        href: sourceHref('request', request),
      }
    }
    // Direct messages: no in-chat caption strip
    return null
  })()

  // First-message safety gate for receivers of direct chats
  const dmAcceptKey = currentUser?.id && userId
    ? `soko_dm_accept_${currentUser.id}_${userId}`
    : null

  const showDmGate = chatSource === 'direct'
    && !!currentUser?.id
    && messages.length > 0
    && !dmAccepted
    && messages.some(m => m.from_user === userId)
    && !messages.some(m => m.from_user === currentUser.id && !String(m.id).startsWith('temp_'))

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
      else if (src === 'job' && contextId) del = del.eq('job_id', contextId)
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
        else if (src === 'job' && contextId) del2 = del2.eq('job_id', contextId)
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
        @keyframes onlinePulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)}50%{box-shadow:0 0 0 4px rgba(34,197,94,0)}}
        .emoji-btn:hover{transform:scale(1.25);transition:transform 0.1s}
        @media (min-width: 900px) { .chat-back-btn { display: none !important; } }
        @media (max-width: 899px) {
          .chat-page.chat-thread {
            height: var(--chat-vvh, 100%) !important;
            max-height: var(--chat-vvh, 100%) !important;
          }
          .chat-top-actions { gap: 3px !important; }
          .chat-top-actions .chat-icon-btn,
          .chat-top-actions button { width: 34px !important; height: 34px !important; }
          /* Free header space: search lives in ⋮ menu on phones */
          .chat-search-toggle { display: none !important; }
        }
        @media (min-width: 900px) {
          .chat-menu-search { display: none !important; }
        }
        @media (max-width: 360px) {
          .chat-top-actions .chat-icon-btn:not([aria-label="Chat options"]) { width: 32px !important; height: 32px !important; }
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
            <div style={{
              ...S.onlineDot,
              background: otherOnline ? '#22c55e' : '#9ca3af',
              boxShadow: '0 0 0 2px #fff',
              animation: otherOnline ? 'onlinePulse 2s infinite' : 'none',
            }} />
          </div>
          <button
            type="button"
            style={{ flex: 1, minWidth: 0, background: 'none', border: 'none', padding: 0, textAlign: 'left', cursor: 'pointer' }}
            onClick={() => navigate(`/profile/${userId}`)}
            title="View profile"
          >
            <div className="chat-top-name">{otherName}</div>
            <div style={S.topStatus}>
              {otherRecording ? (
                <span style={{ color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#ef4444', display: 'inline-block', animation: 'pulse 1s infinite' }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'min(160px, 38vw)' }}>
                    {otherName.split(' ')[0]} is recording audio…
                  </span>
                </span>
              ) : otherTyping ? (
                <span style={{ color: '#1a7a4a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 'min(140px, 34vw)' }}>
                    {otherName.split(' ')[0]} is typing
                  </span>
                  <span style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {[0, 0.2, 0.4].map((d, i) => (
                      <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#1a7a4a', display: 'inline-block', animation: `typingDot 1.2s ${d}s infinite` }} />
                    ))}
                  </span>
                </span>
              ) : otherOnline ? (
                <span style={{ color: '#16a34a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                  Online
                </span>
              ) : otherLastSeen ? (
                <span style={{ color: '#9ca3af' }}>{lastSeenLabel(otherLastSeen)}</span>
              ) : (
                <span style={{ color: '#9ca3af' }}>Offline</span>
              )}
            </div>
          </button>
        </div>

        <div className="chat-top-actions" style={S.topActions}>
          <button type="button" className="chat-icon-btn chat-search-toggle" onClick={() => setChatSearch(s => s === null ? '' : null)} title="Search" aria-label="Search messages">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </button>
          <CallHeaderButtons style={S.callBtn} />
          <button
            type="button"
            className="chat-icon-btn"
            title="More options"
            aria-label="Chat options"
            onClick={() => { setMenuMode('main'); setShowChatMenu(true) }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="5" r="1.6" />
              <circle cx="12" cy="12" r="1.6" />
              <circle cx="12" cy="19" r="1.6" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Chat options: block / report / delete ── */}
      {showChatMenu && (
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

            {menuMode === 'main' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f1410', marginBottom: 4, padding: '0 4px' }}>
                  Chat options
                </div>
                <p style={{ fontSize: 12.5, color: '#6b7a70', margin: '0 4px 12px' }}>
                  With <strong>{otherName}</strong>
                </p>
                <div className="chat-action-list">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChatMenu(false)
                      navigate(`/profile/${userId}`)
                    }}
                  >
                    <span className="chat-action-ico">👤</span> View profile
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuMode('report')
                      setReportReason('spam')
                      setReportDetails('')
                    }}
                  >
                    <span className="chat-action-ico">🚩</span> Report user
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => blockUserFromChat('Blocked from chat menu')}
                    disabled={dmBusy}
                  >
                    <span className="chat-action-ico">🚫</span> Block user
                  </button>
                  <button
                    type="button"
                    className="is-danger"
                    onClick={() => setMenuMode('delete')}
                  >
                    <span className="chat-action-ico">🗑</span> Delete chat
                  </button>
                </div>
                <button
                  type="button"
                  className="chat-action-cancel"
                  disabled={dmBusy}
                  onClick={() => { setShowChatMenu(false); setMenuMode('main') }}
                >
                  Cancel
                </button>
              </>
            )}

            {menuMode === 'report' && (
              <>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f1410', marginBottom: 6, padding: '0 4px' }}>
                  Report {otherName}
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

      {/* ── Source caption (listing / service / job / shop / request / direct) ── */}
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
              : <span style={{ fontSize: 18 }}>{srcMeta.emoji}</span>}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              className="chat-context-tag"
              style={{ color: srcMeta.color, background: srcMeta.bg }}
            >
              {srcMeta.label}
            </div>
            <div style={S.ctxTitle}>{contextCaption.title}</div>
            {contextCaption.sub
              ? <div style={S.ctxSub}>{contextCaption.sub}</div>
              : null}
          </div>
          {contextCaption.href && (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2.5" strokeLinecap="round">
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
              <strong>{otherName}</strong> sent you a direct message. You can continue the chat, block them, or report this person.
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
              Report {otherName}
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

      {/* ── Booking status ── */}
      {isServiceChat && booking && (() => {
        const cfg = {
          pending:   { bg: '#fff8e6', color: '#d4920a', icon: '⏳', text: 'Booking pending' },
          confirmed: { bg: '#e6f7ee', color: '#1a7a4a', icon: '✅', text: 'Booking confirmed' },
          completed: { bg: '#e8eaff', color: '#3b4dd4', icon: '🏁', text: 'Job completed' },
          cancelled: { bg: '#fef0f0', color: '#c0392b', icon: '❌', text: 'Cancelled' },
        }[booking.status] || {}
        return (
          <div style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.color}22`, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15 }}>{cfg.icon}</span>
            <span style={{ fontSize: 12, color: '#555', flex: 1 }}>{cfg.text}</span>
            {booking.date && <span style={{ fontSize: 11, color: cfg.color, fontWeight: '700' }}>📆 {booking.date}</span>}
          </div>
        )
      })()}

      {/* Call overlay is rendered by ChatCallHost (outside this page shell) */}

      {/* ── Messages ── */}
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
          setShowScrollBtn(distFromBottom > 120)
          if (near) setUnreadBelow(0)
        }}
      >
        {messages.length === 0 && !isServiceChat && (
          <div className="chat-empty">
            <div className="chat-empty-icon">👋</div>
            <p style={{ fontSize: 17, fontWeight: 800, color: '#0f1410', marginBottom: 6, letterSpacing: '-0.02em' }}>Say hello</p>
            <p style={{ fontSize: 13, color: '#7a8a80', lineHeight: 1.65, maxWidth: 240 }}>
              Ask about the item, negotiate price, or arrange a meetup
            </p>
            <div className="chat-quick-replies">
              {['Hi! Is this still available?', 'What is your best price?', 'Where can we meet?'].map(q => (
                <button
                  key={q}
                  type="button"
                  className="chat-quick-chip"
                  onClick={() => { setNewMsg(q); setTimeout(() => inputRef.current?.focus(), 30) }}
                >
                  {q}
                </button>
              ))}
            </div>
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

          let radiusClass = ''
          if (isMine) {
            if (!isLast) radiusClass += ' r-mine-tail'
            if (prevSame) radiusClass += ' r-mine-join'
          } else {
            if (!isLast) radiusClass += ' r-theirs-tail'
            if (prevSame) radiusClass += ' r-theirs-join'
          }

          return (
            <div key={msg.id} id={`msg-${msg.id}`} className={swipeHintId === msg.id ? 'is-swipe-ready' : ''}>
              {showDate && (
                <div className="chat-date-chip">
                  {new Date(msg.created_at).toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short' })}
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

                  {!isDeal && (
                    <div
                      id={`msg-bubble-${msg.id}`}
                      className={[
                        'msg-bubble',
                        isMine ? 'is-mine' : 'is-theirs',
                        hasMedia && !msg.call_type ? 'has-media' : '',
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
                      onContextMenu={e => { e.preventDefault(); if (!deletedEveryone) openActions(msg) }}
                      onClick={() => {
                        if (isFailed) retryMessage(msg)
                      }}
                      role="button"
                      tabIndex={0}
                      onKeyDown={e => {
                        if ((e.key === 'Enter' || e.key === ' ') && !deletedEveryone) {
                          e.preventDefault(); openActions(msg)
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

                {isMine && (
                  <ChatAvatar url={myAvatar} initial={myInitial} size={28} isMine spacer={!isLast} />
                )}
              </div>
            </div>
          )
        })}

        {(otherTyping || otherRecording) && (
          <div
            className={`msg-row is-theirs is-group-end typing-row${otherRecording ? ' is-recording' : ''}`}
            aria-live="polite"
            aria-label={otherRecording ? `${otherName} is recording audio` : `${otherName} is typing`}
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
                    <span className="typing-label">{otherName.split(' ')[0]} is typing</span>
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
            <ChatAvatar url={myAvatar} initial={myInitial} size={28} isMine />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Scroll / new messages ── */}
      {(showScrollBtn || unreadBelow > 0) && (
        <button
          type="button"
          className={`chat-scroll-fab${unreadBelow > 0 ? ' has-unread' : ''}`}
          style={{ bottom: recording ? 84 : (replyTo ? 136 : 84) }}
          onClick={() => scrollToBottom(true)}
          aria-label={unreadBelow > 0 ? `${unreadBelow} new messages` : 'Scroll to bottom'}
        >
          {unreadBelow > 0 ? (
            <span className="chat-scroll-unread">{unreadBelow > 99 ? '99+' : unreadBelow}</span>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M12 5v14M5 12l7 7 7-7" />
            </svg>
          )}
        </button>
      )}

      {/* ── Toast ── */}
      {toast && (
        <div className="chat-toast" role="status">{toast}</div>
      )}

      {/* ── Message action sheet ── */}
      {actionMsg && (
        <div className="chat-action-scrim" onClick={() => setActionMsg(null)} role="presentation">
          <div className="chat-action-sheet" onClick={e => e.stopPropagation()} role="dialog" aria-label="Message actions">
            <div className="chat-action-handle" />
            <div className="chat-rx-row">
              {QUICK_REACTIONS.map(emoji => {
                const active = (reactions[actionMsg.id]?.[emoji] || []).includes(currentUser?.id)
                return (
                  <button
                    key={emoji}
                    type="button"
                    className={`chat-rx-btn${active ? ' is-active' : ''}`}
                    onClick={() => toggleReaction(actionMsg, emoji)}
                  >
                    {emoji}
                  </button>
                )
              })}
            </div>
            {actionMode === 'main' && (
              <>
                <div className="chat-action-list">
                  <button type="button" onClick={() => { setReplyTo(actionMsg); setActionMsg(null); setTimeout(() => inputRef.current?.focus(), 40) }}>
                    <span className="chat-action-ico">↩</span> Reply
                  </button>
                  <button type="button" onClick={() => copyMessage(actionMsg)}>
                    <span className="chat-action-ico">📋</span> Copy
                  </button>
                  {actionMsg.media_url && (
                    <button type="button" onClick={() => { setLightbox({ url: actionMsg.media_url, type: actionMsg.media_type === 'video' ? 'video' : 'image', caption: decodeReply(actionMsg.body).body }); setActionMsg(null) }}>
                      <span className="chat-action-ico">🔍</span> Open media
                    </button>
                  )}
                  {actionMsg.from_user === currentUser?.id
                    && !actionMsg.call_type
                    && !(actionMsg.media_url && actionMsg.media_type && actionMsg.media_type !== 'text') && (
                    <button type="button" onClick={() => startEditMessage(actionMsg)}>
                      <span className="chat-action-ico">✏️</span> Edit message
                    </button>
                  )}
                  {actionMsg.from_user === currentUser?.id && (
                    <button type="button" onClick={() => setActionMode('timer')}>
                      <span className="chat-action-ico">⏱</span> Auto-delete timer
                    </button>
                  )}
                  <button type="button" className="is-danger" onClick={() => setActionMode('delete')}>
                    <span className="chat-action-ico">🗑</span> Delete…
                  </button>
                  {actionMsg._status === 'failed' && (
                    <button type="button" onClick={() => { retryMessage(actionMsg); setActionMsg(null) }}>
                      <span className="chat-action-ico">↺</span> Retry send
                    </button>
                  )}
                </div>
                <button type="button" className="chat-action-cancel" onClick={() => { setActionMsg(null); setActionMode('main') }}>Cancel</button>
              </>
            )}

            {actionMode === 'delete' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6, padding: '0 4px' }}>Delete message</div>
                <p style={{ fontSize: 13, color: '#6b7a70', margin: '0 4px 12px', lineHeight: 1.45 }}>
                  Choose who should no longer see this message.
                </p>
                <div className="chat-action-list">
                  <button type="button" onClick={() => deleteMessageForMe(actionMsg)}>
                    <span className="chat-action-ico">👁</span> Delete for me
                  </button>
                  {actionMsg.from_user === currentUser?.id && (
                    <button type="button" className="is-danger" onClick={() => deleteMessageForEveryone(actionMsg)}>
                      <span className="chat-action-ico">🗑</span> Delete for everyone
                    </button>
                  )}
                </div>
                <button type="button" className="chat-action-cancel" onClick={() => setActionMode('main')}>Back</button>
              </>
            )}

            {actionMode === 'timer' && (
              <>
                <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 6, padding: '0 4px' }}>Auto-delete</div>
                <p style={{ fontSize: 13, color: '#6b7a70', margin: '0 4px 12px', lineHeight: 1.45 }}>
                  This message will disappear for both of you after the time you pick.
                </p>
                <div className="chat-action-list">
                  {[
                    { label: '1 hour', ms: 3600000 },
                    { label: '24 hours', ms: 86400000 },
                    { label: '7 days', ms: 604800000 },
                    { label: 'Off', ms: null },
                  ].map(opt => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => setMessageDisappear(actionMsg, opt.ms)}
                    >
                      <span className="chat-action-ico">⏱</span> {opt.label}
                    </button>
                  ))}
                </div>
                <button type="button" className="chat-action-cancel" onClick={() => setActionMode('main')}>Back</button>
              </>
            )}
          </div>
        </div>
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

      {/* ── Preview modal ── */}
      {preview.length > 0 && (
        <div className="chat-preview-overlay" onClick={() => !uploading && setPreview([])}>
          <div className="chat-preview-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#0f1410', letterSpacing: '-0.02em' }}>
                {preview[0]?.type === 'image' ? 'Send photos' : preview[0]?.type === 'video' ? 'Send video' : preview[0]?.type === 'audio' ? 'Send audio' : 'Send files'}
              </span>
              <button
                type="button"
                className="chat-icon-btn"
                style={{ width: 34, height: 34 }}
                onClick={() => setPreview([])}
                aria-label="Cancel"
              >
                ✕
              </button>
            </div>
            <div className="chat-preview-media chat-preview-grid">
              {preview.map((p, i) => (
                <div key={i} className="chat-preview-item">
                  {p.type === 'image' && <img src={p.url} alt="" />}
                  {p.type === 'video' && <video src={p.url} controls />}
                  {p.type === 'audio' && <audio src={p.url} controls style={{ width: '100%' }} />}
                  {p.type === 'file' && <div style={{ padding: 12, textAlign: 'center' }}>📎 {p.file?.name || 'File'}</div>}
                  <button className="chat-preview-remove" onClick={() => setPreview(ps => ps.filter((_, j) => j !== i))} aria-label="Remove">✕</button>
                </div>
              ))}
            </div>
            <input
              placeholder="Add a caption (optional)…"
              value={preview[0]?.caption || ''}
              onChange={e => setPreview(ps => ps.map((p, i) => i === 0 ? { ...p, caption: e.target.value } : p))}
              onKeyDown={e => { if (e.key === 'Enter') uploadQueue(preview) }}
            />
            <button
              type="button"
              className="chat-preview-send"
              onClick={() => uploadQueue(preview)}
              disabled={uploading}
            >
              {uploading ? (
                <div style={{ width: 18, height: 18, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
              ) : (
                <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M2 21l21-9L2 3v7l15 2-15 2z"/></svg>
                  Send
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ── Emoji Picker ── */}
      {showEmoji && (
        <div ref={emojiPickerRef} className="emoji-picker-panel" onClick={e => e.stopPropagation()}>
          <div className="emoji-picker-head">
            <div className="emoji-picker-title">
              <SmilePlus size={15} strokeWidth={2.2} />
              <span>Emoji</span>
            </div>
            <span className="emoji-picker-cat-label">
              {EMOJI_BY_ID[emojiTab]?.label || 'Smileys'}
            </span>
          </div>

          <div className="emoji-frequent">
            {EMOJI_FREQUENT.map((emoji, i) => (
              <button
                key={`freq-${i}-${emoji}`}
                type="button"
                className="emoji-btn emoji-btn-freq"
                onClick={() => insertEmoji(emoji)}
                title="Quick insert"
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="emoji-grid">
            {(EMOJI_BY_ID[emojiTab]?.emojis || []).map((emoji, i) => (
              <button
                key={`${emojiTab}-${i}-${emoji}`}
                type="button"
                className="emoji-btn"
                onClick={() => insertEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>

          <div className="emoji-tabs">
            {EMOJI_CATEGORIES.map(cat => (
              <button
                key={cat.id}
                type="button"
                className={`emoji-tab${emojiTab === cat.id ? ' is-active' : ''}`}
                onClick={() => setEmojiTab(cat.id)}
                title={cat.label}
                aria-label={cat.label}
              >
                <span className="emoji-tab-icon">{cat.icon}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Reply banner ── */}
      {replyTo && (
        <div className="chat-reply-banner">
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#1a7a4a', marginBottom: 2 }}>
              Replying to {replyTo.from_user === currentUser?.id ? 'yourself' : otherName}
            </span>
            <span style={{ fontSize: 12, color: '#637068', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {decodeReply(replyTo.body).body
                || (replyTo.media_type === 'audio' ? '🎤 Voice note'
                  : replyTo.media_type === 'image' ? '📷 Photo'
                  : replyTo.media_type === 'video' ? '🎥 Video'
                  : '📎 File')}
            </span>
          </div>
          <button type="button" className="chat-icon-btn" style={{ width: 30, height: 30 }} onClick={() => setReplyTo(null)} aria-label="Cancel reply">✕</button>
        </div>
      )}

      {/* ── Recording bar ── */}
      {recording && (
        <div className="chat-recording-bar" style={S.recordingBar}>
          <button type="button" style={S.cancelRecBtn} onClick={cancelRecording} aria-label="Cancel recording">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 40, overflow: 'hidden' }}>
            {waveHeights.map((h, i) => (
              <div key={i} style={{ width: 3, height: `${h}px`, borderRadius: 2, background: `hsl(${140 + i * 2},60%,${40 + i % 4 * 5}%)`, transition: 'height 0.05s ease' }} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#e74c3c', animation: 'pulse 1s infinite' }} />
            <span style={{ fontSize: 14, fontWeight: 700, color: '#1a7a4a', minWidth: 38 }}>{formatTime(recordingTime)}</span>
          </div>
          <button
            type="button"
            className="chat-send-btn"
            style={{ width: 42, height: 42 }}
            onClick={stopRecording}
            aria-label="Send voice note"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
          </button>
        </div>
      )}

      {/* ── Input bar (locked until DM receiver continues) ── */}
      {!recording && showDmGate && (
        <div className="dm-input-locked">
          Choose Continue, Block, or Report above to respond
        </div>
      )}
      {!recording && !showDmGate && (
        <HideDuringCall>
        <>
        {/* Default disappearing timer for new messages */}
        <div className="chat-disappear-bar" style={{ flexShrink: 0, overflowX: 'auto', whiteSpace: 'nowrap' }}>
          <span className="chat-disappear-label">New msgs auto-delete:</span>
          {[
            { label: 'Off', ms: null },
            { label: '1h', ms: 3600000 },
            { label: '24h', ms: 86400000 },
            { label: '7d', ms: 604800000 },
          ].map(opt => (
            <button
              key={opt.label}
              type="button"
              className={`chat-disappear-chip${defaultDisappear === opt.ms ? ' is-on' : ''}`}
              onClick={() => setDefaultDisappear(opt.ms)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="chat-input-bar" style={{ ...S.inputBar, position: 'relative' }}>
          {showAttach && (
            <div className="attach-menu" onClick={e => e.stopPropagation()}>
              <div className="attach-menu-title">Share</div>
              {ATTACH_OPTIONS.map(opt => {
                const Icon = opt.Icon
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className="attach-option"
                    onClick={() => {
                      setShowAttach(false)
                      pickFile(opt.accept, opt.type, { capture: opt.capture })
                    }}
                  >
                    <span className={`am-icon tone-${opt.tone}`}>
                      <Icon size={18} strokeWidth={2.1} />
                    </span>
                    <span className="attach-option-text">
                      <span className="attach-option-label">{opt.label}</span>
                      <span className="attach-option-sub">{opt.sub}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          <button
            type="button"
            className={`chat-attach-btn${showAttach ? ' is-on' : ''}`}
            onClick={e => { e.stopPropagation(); setShowAttach(v => !v); setShowEmoji(false) }}
            title="Attach"
            aria-label="Attach file"
          >
            <Paperclip size={20} strokeWidth={2} />
          </button>

          <div className="chat-composer">
            <textarea
              ref={inputRef}
              placeholder={isServiceChat ? `Message about ${service?.name || 'service'}…` : 'Message…'}
              value={newMsg}
              onChange={e => {
                handleTyping(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyDown={handleKey}
              rows={1}
            />
            <button
              type="button"
              className={`chat-emoji-btn${showEmoji ? ' is-on' : ''}`}
              onClick={e => { e.stopPropagation(); setShowEmoji(v => !v); setShowAttach(false) }}
              title="Emoji"
              aria-label="Emoji"
            >
              <SmilePlus size={20} strokeWidth={2} />
            </button>
          </div>

          {newMsg.trim()
            ? (
              <button type="button" className="chat-send-btn" onClick={() => sendMessage(newMsg)} aria-label="Send">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
              </button>
            ) : (
              <button type="button" className="chat-mic-btn" onClick={startRecording} title="Voice note" aria-label="Record voice note">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0014 0" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="8" y1="22" x2="16" y2="22" />
                </svg>
              </button>
            )}
        </div>
        </>
        </HideDuringCall>
      )}
    </div>
    </ChatCallHost>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
  // height 100% fills the ChatsLayout thread column (which is already 100dvh).
  // Using 100vh here double-counted the viewport and overflowed on desktop split.
  page: { display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, position: 'relative', overflow: 'hidden' },
  loadCenter: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: 0 },
  spinner: { width: 28, height: 28, border: '3px solid #e0ebe3', borderTopColor: '#1a7a4a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  topbar: { display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', flexShrink: 0, padding: '10px 12px', background: '#fff', borderBottom: '1px solid #e8ede9', zIndex: 10 },
  topInfo: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 11, height: 11, borderRadius: '50%', transition: 'background 0.3s' },
  topStatus: { fontSize: 12, marginTop: 2, display: 'flex', alignItems: 'center' },
  callBtn: { background: '#f3f7f4', border: 'none', borderRadius: 12, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  ctxTitle: { fontSize: 13, fontWeight: 650, color: '#0f1410', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  ctxSub: { fontSize: 11, color: '#1a7a4a', fontWeight: 650 },
  recordingBar: { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  cancelRecBtn: { background: '#fef0f0', border: 'none', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  inputBar: { display: 'flex', alignItems: 'flex-end', gap: 6, flexShrink: 0, zIndex: 5, padding: '6px 10px 10px', background: '#fff', borderTop: '1px solid #e8ede9' },
  topActions: { display: 'flex', gap: 4, alignItems: 'center', flexShrink: 0 },
}
