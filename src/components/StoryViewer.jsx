import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { X, MoreHorizontal, Heart, MessageCircle, Share2, MapPin, ChevronRight, VolumeX, Volume2, Eye, Send, Copy, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { STATUS_COLORS, STATUS_META } from '../constants/homeConstants'
import {
  parseClipWindow,
  mediaUrlBase,
  isStatusVideoUrl,
} from '../utils/statusVideo'

/**
 * Status / story viewer — product-first layout (reference design).
 * Progress bars · seller header · media · product card · engage · CTAs · reply
 */

const GREEN = '#1a7a4a'
const GREEN_MID = '#166534'
const GOLD = '#f5c518'
const GOLD_BTN = '#f0c000'

const GRADIENTS = [
  'linear-gradient(160deg,#0a2e1a 0%,#1a7a4a 100%)',
  'linear-gradient(160deg,#0d1b2a 0%,#1a3a6c 100%)',
  'linear-gradient(160deg,#1a0a2e 0%,#4a1a7a 100%)',
  'linear-gradient(160deg,#1a0a0a 0%,#7a2020 100%)',
  'linear-gradient(160deg,#0a1a2e 0%,#1a5a6a 100%)',
]

// ─── Icons ───────────────────────────────────────────────────────────────────
function IconClose({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}
function IconMore({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  )
}
function IconVerified({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="12" r="10" fill="#22c55e" />
      <path d="M8 12.2l2.4 2.4L16.2 9" fill="none" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
function IconStar({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.5L12 17.3 6.1 20.6l1.2-6.5L2.5 9.5l6.6-.9L12 2.5z" />
    </svg>
  )
}
function IconHeart({ size = 20, filled = false }) {
  return filled ? (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="#ef4444" aria-hidden>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  ) : (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  )
}
function IconComment({ size = 19, color = '#64748b' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
function IconShare({ size = 18, color = '#64748b' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
    </svg>
  )
}
function IconMessage({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}
function IconSend({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  )
}
function IconMapPin({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  )
}
function IconCheck({ size = 11 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}
function IconEye({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function IconSearch({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}
function IconCopy({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="9" y="9" width="13" height="13" rx="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  )
}
function IconReplyArrow({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 17H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h11" />
      <path d="M15 3l5 5-5 5" />
    </svg>
  )
}
function isMobileShareDevice() {
  return /Android|iPhone|iPad|iPod/i.test(typeof navigator !== 'undefined' ? navigator.userAgent : '')
}
function IconPackage({ size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      <path d="M3.3 7.5L12 12l8.7-4.5" />
      <path d="M12 22V12" />
    </svg>
  )
}
function IconChevronRight({ size = 14, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M9 18l6-6-6-6" />
    </svg>
  )
}
function IconMuted({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M23 9l-6 6" />
      <path d="M17 9l6 6" />
    </svg>
  )
}
function IconUnmuted({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M11 5 6 9H2v6h4l5 4V5z" />
      <path d="M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M18.5 6a9 9 0 0 1 0 12" />
    </svg>
  )
}

function fmtK(n) {
  const v = Number(n) || 0
  if (v >= 1000) return `${(v / 1000).toFixed(1)}K`
  return String(v)
}

function timeAgoFn(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const d = Math.floor(diff / 86400000)
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (d > 0) return `${d}d ago`
  if (h > 0) return `${h}h ago`
  if (m > 0) return `${m} min ago`
  return 'Just now'
}

function isColorUrl(url) {
  return typeof url === 'string' && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(url.trim())
}

function formatPrice(price) {
  const n = Number(price)
  if (!Number.isFinite(n)) return null
  return `MK${n.toLocaleString()}`
}

// ─── Media download cache (blob URLs) ─────────────────────────────────────────
// Only show media after a full download completes.
const mediaBlobCache = new Map() // remoteUrl -> { blobUrl, kind: 'image'|'video' }
const mediaInflight = new Map()  // remoteUrl -> Promise

function isRemoteMediaUrl(url) {
  if (!url || typeof url !== 'string') return false
  if (isColorUrl(url)) return false
  if (url.startsWith('blob:') || url.startsWith('data:')) return true
  // Allow status clip fragments: https://.../vid.webm#t=5,20
  const base = mediaUrlBase(url)
  return /^https?:\/\//i.test(base) || base.startsWith('/')
}

function isVideoUrl(url) {
  return isStatusVideoUrl(url)
}

/**
 * Fully download remote media. Reports progress 0–100.
 * Returns a blob: URL suitable for <img>/<video>.
 */
async function downloadMediaFully(url, onProgress) {
  if (!url) throw new Error('No media url')
  // Clip fragments (#t=) are playback hints only — fetch/cache the bare file URL
  const fetchUrl = mediaUrlBase(url) || url
  if (fetchUrl.startsWith('blob:') || fetchUrl.startsWith('data:')) {
    onProgress?.(100)
    return { blobUrl: fetchUrl, kind: isVideoUrl(url) ? 'video' : 'image' }
  }
  if (mediaBlobCache.has(fetchUrl)) {
    onProgress?.(100)
    return mediaBlobCache.get(fetchUrl)
  }
  if (mediaInflight.has(fetchUrl)) {
    const cached = await mediaInflight.get(fetchUrl)
    onProgress?.(100)
    return cached
  }

  const task = (async () => {
    onProgress?.(2)
    const kindGuess = isVideoUrl(url) ? 'video' : 'image'

    // Prefer full fetch with byte progress (CORS required)
    try {
      const res = await fetch(fetchUrl, { mode: 'cors', credentials: 'omit', cache: 'force-cache' })
      if (!res.ok) throw new Error(`Download failed (${res.status})`)

      const total = Number(res.headers.get('content-length')) || 0
      const reader = res.body?.getReader?.()
      let blob

      if (reader) {
        const chunks = []
        let received = 0
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          chunks.push(value)
          received += value.byteLength
          if (total > 0) {
            onProgress?.(Math.min(99, Math.round((received / total) * 100)))
          } else {
            onProgress?.(Math.min(90, 5 + Math.floor(received / (256 * 1024)) * 5))
          }
        }
        blob = new Blob(chunks, {
          type: res.headers.get('content-type') || (kindGuess === 'video' ? 'video/mp4' : 'image/jpeg'),
        })
      } else {
        blob = await res.blob()
      }

      if (!blob || blob.size === 0) throw new Error('Empty media file')

      const kind = (blob.type.startsWith('video/') || kindGuess === 'video') ? 'video' : 'image'
      const blobUrl = URL.createObjectURL(blob)

      if (kind === 'image') {
        await new Promise((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve()
          img.onerror = () => reject(new Error('Image decode failed'))
          img.src = blobUrl
        })
      } else {
        // Confirm video can open
        await new Promise((resolve, reject) => {
          const v = document.createElement('video')
          v.preload = 'auto'
          v.muted = true
          v.onloadeddata = () => resolve()
          v.onerror = () => reject(new Error('Video decode failed'))
          v.src = blobUrl
        })
      }

      onProgress?.(100)
      const entry = { blobUrl, kind, size: blob.size }
      mediaBlobCache.set(url, entry)
      return entry
    } catch {
      // CORS / network fallback: wait until element fully loads, no progressive paint
      onProgress?.(15)
      if (kindGuess === 'video') {
        await new Promise((resolve, reject) => {
          const v = document.createElement('video')
          v.preload = 'auto'
          v.muted = true
          v.crossOrigin = 'anonymous'
          let last = 15
          const tick = setInterval(() => {
            try {
              if (v.buffered?.length) {
                const end = v.buffered.end(v.buffered.length - 1)
                const dur = v.duration || 0
                if (dur > 0) {
                  last = Math.min(95, Math.round((end / dur) * 100))
                  onProgress?.(last)
                } else {
                  last = Math.min(90, last + 3)
                  onProgress?.(last)
                }
              } else {
                last = Math.min(90, last + 2)
                onProgress?.(last)
              }
            } catch { /* ignore */ }
          }, 200)
          v.oncanplaythrough = () => {
            clearInterval(tick)
            onProgress?.(100)
            resolve()
          }
          v.onerror = () => {
            clearInterval(tick)
            reject(new Error('Video download failed'))
          }
          // Some browsers fire loadeddata without canplaythrough
          v.onloadeddata = () => {
            setTimeout(() => {
              if (v.readyState >= 3) {
                clearInterval(tick)
                onProgress?.(100)
                resolve()
              }
            }, 400)
          }
          v.src = url
          v.load()
        })
        onProgress?.(100)
        const entry = { blobUrl: url, kind: 'video', size: 0 }
        mediaBlobCache.set(url, entry)
        return entry
      }

      await new Promise((resolve, reject) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        onProgress?.(40)
        img.onload = () => {
          onProgress?.(100)
          resolve()
        }
        img.onerror = () => reject(new Error('Image download failed'))
        img.src = url
      })
      const entry = { blobUrl: url, kind: 'image', size: 0 }
      mediaBlobCache.set(url, entry)
      return entry
    }
  })()

  mediaInflight.set(url, task)
  try {
    return await task
  } finally {
    mediaInflight.delete(url)
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────
export default function StoryViewer({ stories, startIndex = 0, currentUserId, onClose }) {
  const navigate = useNavigate()
  const [idx, setIdx] = useState(startIndex || 0)
  const [mediaIdx, setMediaIdx] = useState(0)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [closing, setClosing] = useState(false)
  const touchStartRef = useRef(null)
  const [showMarketplace, setShowMarketplace] = useState(true)
  const marketplaceTimerRef = useRef(null)
  const [localStories, setLocalStories] = useState(stories || [])
  const [replyText, setReplyText] = useState('')
  const [replySending, setReplySending] = useState(false)
  const [myReaction, setMyReaction] = useState(null)
  const [reactionCounts, setReactionCounts] = useState({})
  const [reacting, setReacting] = useState(false)
  const [viewCount, setViewCount] = useState(0)
  const [viewers, setViewers] = useState([])
  const [showViewers, setShowViewers] = useState(false)
  const [viewersLoading, setViewersLoading] = useState(false)
  const [viewerSearch, setViewerSearch] = useState('')
  const [shareUrl, setShareUrl] = useState(null)
  const [copyOk, setCopyOk] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [myAvatar, setMyAvatar] = useState(null)
  // Stream media immediately (no “downloading…” gate)
  const [mediaReady, setMediaReady] = useState(false)
  const [mediaSrc, setMediaSrc] = useState(null)
  const [mediaKind, setMediaKind] = useState('image')  // image | video | none | text
  const [mediaError, setMediaError] = useState(null)
  const [replies, setReplies] = useState([])
  const [replyCount, setReplyCount] = useState(0)
  const [showReplies, setShowReplies] = useState(false)
  const [repliesLoading, setRepliesLoading] = useState(false)
  const [comments, setComments] = useState([])
  const [commentCount, setCommentCount] = useState(0)
  const [showComments, setShowComments] = useState(false)
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [commentSending, setCommentSending] = useState(false)
  const [replyToComment, setReplyToComment] = useState(null) // { id, name, rootId }
  const [commentReactions, setCommentReactions] = useState({})
  const [commentMediaFile, setCommentMediaFile] = useState(null)
  const [commentMediaPreview, setCommentMediaPreview] = useState(null)
  const [highlightCommentId, setHighlightCommentId] = useState(null)
  const commentFileRef = useRef(null)
  const commentItemRefs = useRef({})
  const deepLinkHandledRef = useRef(false)
  const [toast, setToast] = useState('')
  const [muted, setMuted] = useState(false)

  const timerRef = useRef()
  const holdRef = useRef()
  const toastRef = useRef()
  const mediaGenRef = useRef(0)
  const videoRef = useRef(null)
  const activeBarRef = useRef(null)
  const rafRef = useRef(null)
  const loggedViewsRef = useRef(new Set())
  const mainRef = useRef(null)

  useEffect(() => { mainRef.current?.focus() }, [])
  /** Image / text status display time */
  const IMAGE_DURATION_MS = 7000
  /** Video: play full length (capped to status max — matches upload trim) */
  const VIDEO_MIN_MS = 8000
  const VIDEO_MAX_MS = 30_000
  const VIDEO_FALLBACK_MS = 30_000

  const story = localStories[idx]

  function showToast(msg) {
    setToast(msg)
    clearTimeout(toastRef.current)
    toastRef.current = setTimeout(() => setToast(''), 2200)
  }

  useEffect(() => {
    setLocalStories(stories || [])
    setIdx(startIndex || 0)
    setMediaIdx(0)
  }, [stories, startIndex])

  // Current user avatar for reply bar
  useEffect(() => {
    if (!currentUserId) return
    supabase.from('profiles').select('avatar_url').eq('id', currentUserId).maybeSingle()
      .then(({ data }) => setMyAvatar(data?.avatar_url || null))
  }, [currentUserId])

  // Reset UI when story changes
  useEffect(() => {
    setMediaIdx(0)
    setReplyText('')
    setShowMenu(false)
    setShowReplies(false)
    setReplies([])
    setReplyCount(0)
    setMuted(false)
    setShowMarketplace(true)
  }, [story?.id])

  // ── Auto-hide marketplace card after 4s ─────────────────────────────────────
  const hasTaggedEntity = story?.tagged || story?._taggedEntity
  useEffect(() => {
    if (!hasTaggedEntity || paused || showViewers || shareUrl || showMenu || showReplies) return
    clearTimeout(marketplaceTimerRef.current)
    setShowMarketplace(true)
    marketplaceTimerRef.current = setTimeout(() => setShowMarketplace(false), 4000)
    return () => clearTimeout(marketplaceTimerRef.current)
  }, [story?.id, mediaIdx, hasTaggedEntity, paused, showViewers, shareUrl, showMenu, showReplies])

  // ── Stream media right away (no download % UI) ─────────────────────────────
  useEffect(() => {
    if (!story) return undefined

    // Primary media only (skip annotation overlay: video + following image)
    let urls = (story.media_urls || []).filter(u => u && !isColorUrl(u) && isRemoteMediaUrl(u))
    if (urls.length >= 2 && isVideoUrl(urls[0]) && !isVideoUrl(urls[1])) {
      urls = [urls[0]]
    }
    const remote = urls[mediaIdx] || urls[0] || null
    const colorBg = (story.media_urls || []).find(isColorUrl) || null
    const gen = ++mediaGenRef.current

    // Text-only / gradient status — ready immediately
    if (!remote) {
      setMediaReady(true)
      setMediaSrc(null)
      setMediaKind(colorBg ? 'text' : 'none')
      setMediaError(null)
      setProgress(0)
      return undefined
    }

    const kind = isVideoUrl(remote) ? 'video' : 'image'
    setMediaKind(kind)
    setMediaError(null)
    setProgress(0)

    // Prefer cached blob if we already have it; otherwise stream remote URL.
    // Preserve #t=... clip window so the video "knows" it's trimmed.
    // Cache stores blob URLs without fragment; reattach it for playback.
    const clipFrag = remote.includes('#t=') ? remote.slice(remote.indexOf('#')) : ''
    const cached = mediaBlobCache.get(remote)
    let src = cached?.blobUrl || remote
    if (clipFrag && src.indexOf('#') === -1) src += clipFrag
    setMediaSrc(src)
    // Images can show as soon as src is set; videos wait for canplay (handled by element)
    if (kind === 'image') {
      setMediaReady(true)
    } else {
      setMediaReady(false)
    }

    // Soft prefetch next story media (silent, no UI)
    const nextRemote = urls[mediaIdx + 1]
      || (() => {
        const next = localStories[idx + 1]
        const list = (next?.media_urls || []).filter(u => u && !isColorUrl(u) && isRemoteMediaUrl(u))
        if (list.length >= 2 && isVideoUrl(list[0]) && !isVideoUrl(list[1])) return list[0]
        return list[0] || null
      })()
    if (nextRemote && nextRemote !== remote && !mediaBlobCache.has(nextRemote)) {
      downloadMediaFully(nextRemote, () => {}).catch(() => {})
    }

    return () => { mediaGenRef.current = gen }
  }, [story?.id, mediaIdx, idx, localStories])

  // View tracking
  useEffect(() => {
    if (!story?.id) return
    if (currentUserId && story.user_id !== currentUserId && !loggedViewsRef.current.has(story.id)) {
      loggedViewsRef.current.add(story.id)
      supabase.from('status_views').upsert(
        { status_id: story.id, viewer_id: currentUserId },
        { onConflict: 'status_id,viewer_id', ignoreDuplicates: true },
      )
    }
    if (story.user_id === currentUserId) {
      supabase.from('status_views')
        .select('id', { count: 'exact', head: true })
        .eq('status_id', story.id)
        .then(({ count }) => setViewCount(count || 0))
    } else {
      setViewCount(0)
    }
  }, [story?.id, currentUserId])

  // Reply & comment counts for this status
  useEffect(() => {
    if (!story?.id) return
    loadReplyCount(story.id)
    loadCommentCount(story.id)
  }, [story?.id])

  // Deep-link: /story/:id?comment=:commentId → open comments & highlight
  useEffect(() => {
    if (!story?.id || deepLinkHandledRef.current) return
    try {
      const params = new URLSearchParams(window.location.search)
      const commentId = params.get('comment')
      if (!commentId) return
      deepLinkHandledRef.current = true
      setHighlightCommentId(commentId)
      setPaused(true)
      setShowComments(true)
      loadComments()
    } catch { /* ignore */ }
  }, [story?.id])

  // Scroll highlighted comment into view once loaded
  useEffect(() => {
    if (!showComments || !highlightCommentId || commentsLoading) return
    const t = setTimeout(() => {
      const el = commentItemRefs.current[highlightCommentId]
      if (el?.scrollIntoView) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
    }, 120)
    return () => clearTimeout(t)
  }, [showComments, highlightCommentId, commentsLoading, comments])

  // Reactions
  useEffect(() => {
    if (!story?.id) return
    setMyReaction(null)
    setReactionCounts({})
    supabase.from('status_reactions').select('reaction, user_id').eq('status_id', story.id)
      .then(({ data }) => {
        if (!data) return
        const counts = { love: 0, hot: 0, interested: 0 }
        data.forEach(r => { if (counts[r.reaction] !== undefined) counts[r.reaction]++ })
        setReactionCounts(counts)
        if (currentUserId) {
          const mine = data.find(r => r.user_id === currentUserId)
          setMyReaction(mine?.reaction || null)
        }
      })
  }, [story?.id, currentUserId])

  // Auto-advance: images fixed duration; videos follow clip length (longer watch time)
  useEffect(() => {
    setProgress(0)
    if (!mediaReady || mediaError) return undefined
    if (paused || showViewers || shareUrl || showMenu || showReplies) return undefined

    // Video progress: update the bar directly via the DOM every frame (rAF),
    // instead of React state, so playback stays smooth (no re-render per frame).
    if (mediaKind === 'video' && videoRef.current) {
      const v = videoRef.current
      const start = Date.now()
      let done = false

      // Detect meta-trim clip window (#t=start,end) so progress uses clip range
      const clip = parseClipWindow(mediaSrc || v.currentSrc || '')
      const clipStart = clip?.start ?? 0
      const clipDur = clip?.duration ?? (Number.isFinite(v.duration) && v.duration > 0 ? v.duration : VIDEO_FALLBACK_MS / 1000)

      function tick() {
        if (done) return
        const elapsed = v.currentTime - clipStart
        const p = Math.min(100, (elapsed / clipDur) * 100)
        if (activeBarRef.current) activeBarRef.current.style.width = `${p}%`

        if (Date.now() - start >= VIDEO_MAX_MS) {
          done = true
          setProgress(100)
          advance()
          return
        }
        rafRef.current = requestAnimationFrame(tick)
      }

      function onEnded() {
        if (done) return
        done = true
        setProgress(100)
        advance()
      }

      rafRef.current = requestAnimationFrame(tick)
      v.addEventListener('ended', onEnded)
      return () => {
        done = true
        cancelAnimationFrame(rafRef.current)
        v.removeEventListener('ended', onEnded)
      }
    }

    // Image / text status
    const start = Date.now()
    timerRef.current = setInterval(() => {
      const p = Math.min(((Date.now() - start) / IMAGE_DURATION_MS) * 100, 100)
      setProgress(p)
      if (p >= 100) {
        clearInterval(timerRef.current)
        advance()
      }
    }, 40)
    return () => clearInterval(timerRef.current)
  }, [idx, mediaIdx, paused, showViewers, shareUrl, showMenu, showReplies, localStories, mediaReady, mediaError, mediaKind, mediaSrc])

  // Play video when ready; pause when UI overlays pause
  useEffect(() => {
    if (mediaKind !== 'video' || !videoRef.current || !mediaSrc) return
    const v = videoRef.current
    if (paused || showViewers || shareUrl || showMenu || showReplies) {
      v.pause()
      return
    }
    if (mediaReady) {
      const p = v.play()
      if (p?.catch) p.catch(() => {})
    }
  }, [mediaReady, mediaSrc, mediaKind, paused, showViewers, shareUrl, showMenu, showReplies])

  useEffect(() => {
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  function advance() {
    // Next media in same story first
    const media = getMediaList(localStories[idx])
    if (mediaIdx < media.length - 1) {
      setMediaIdx(m => m + 1)
      return
    }
    const nextIdx = idx + 1
    if (nextIdx < localStories.length) {
      goNextUserStories(nextIdx)
    } else {
      onClose?.()
    }
  }

  function goBack() {
    if (mediaIdx > 0) {
      setMediaIdx(m => m - 1)
      return
    }
    if (idx > 0) {
      setIdx(i => i - 1)
      setMediaIdx(0)
    } else {
      onClose?.()
    }
  }

  async function goNextUserStories(nextIdx) {
    const nextStory = localStories[nextIdx]
    const prevStory = localStories[idx]
    if (nextStory && prevStory && nextStory.user_id !== prevStory.user_id) {
      let { data } = await supabase
        .from('user_statuses')
        .select(`id, content, status_type, expires_at, created_at, media_urls, tagged_listing_id, tagged_kind, tagged_ref_id, user_id, location_hint,
          profiles:user_id ( id, full_name, avatar_url, city, is_verified ),
          tagged:tagged_listing_id ( id, title, price, images, category, description, city, district )`)
        .eq('user_id', nextStory.user_id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      if (data && data.length > 1) {
        try {
          const { hydrateStatusTags } = await import('../hooks/useStatuses')
          data = await hydrateStatusTags(data)
        } catch { /* ignore */ }
        // Normalize profiles join (Supabase may return array)
        for (const s of data) {
          if (Array.isArray(s.profiles)) s.profiles = s.profiles[0] || null
        }
        setLocalStories([...localStories.slice(0, nextIdx), ...data, ...localStories.slice(nextIdx + 1)])
      }
    }
    setIdx(nextIdx)
    setMediaIdx(0)
  }

  function getMediaList(s) {
    if (!s) return []
    const urls = (s.media_urls || []).filter(u => u && !isColorUrl(u))
    // Convention: [video, overlayPng] — second image is annotation overlay, not a separate slide
    if (urls.length >= 2 && isVideoUrl(urls[0]) && !isVideoUrl(urls[1])) {
      return [urls[0]]
    }
    return urls
  }

  function getAnnotationOverlay(s) {
    if (!s) return null
    const urls = (s.media_urls || []).filter(u => u && !isColorUrl(u))
    if (urls.length >= 2 && isVideoUrl(urls[0]) && !isVideoUrl(urls[1])) return urls[1]
    return null
  }

  async function handleLove() {
    if (reacting || !currentUserId || !story?.id) return
    setReacting(true)
    const key = 'love'
    if (myReaction === key) {
      await supabase.from('status_reactions').delete().eq('status_id', story.id).eq('user_id', currentUserId)
      setMyReaction(null)
      setReactionCounts(c => ({ ...c, love: Math.max(0, (c.love || 1) - 1) }))
    } else {
      if (myReaction) {
        await supabase.from('status_reactions').delete().eq('status_id', story.id).eq('user_id', currentUserId)
        setReactionCounts(c => ({ ...c, [myReaction]: Math.max(0, (c[myReaction] || 1) - 1) }))
      }
      const { error } = await supabase.from('status_reactions')
        .insert({ status_id: story.id, user_id: currentUserId, reaction: key })
      if (!error) {
        setMyReaction(key)
        setReactionCounts(c => ({ ...c, love: (c.love || 0) + 1 }))
      }
    }
    setReacting(false)
  }

  function openShare() {
    const url = story?.tagged_listing_id
      ? `${window.location.origin}/listing/${story.tagged_listing_id}`
      : `${window.location.origin}/profile/${story?.user_id}`
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && navigator.share) {
      navigator.share({
        title: `${name} on SokoMw`,
        text: story?.content || '',
        url,
      }).catch(() => {})
    } else {
      setPaused(true)
      setShareUrl(url)
    }
  }

  function copyShare() {
    if (!shareUrl) return
    const done = () => {
      setCopyOk(true)
      setTimeout(() => {
        setCopyOk(false)
        setShareUrl(null)
        setPaused(false)
      }, 900)
    }
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl).then(done).catch(() => {
        fallbackCopy(shareUrl, done)
      })
    } else {
      fallbackCopy(shareUrl, done)
    }
  }

  function fallbackCopy(text, cb) {
    const el = document.createElement('textarea')
    el.value = text
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    cb()
  }

  async function loadViewers() {
    if (!story?.id) return
    setViewersLoading(true)
    const { data } = await supabase
      .from('status_views')
      .select('viewed_at, viewer:profiles!viewer_id(id, full_name, avatar_url)')
      .eq('status_id', story.id)
      .order('viewed_at', { ascending: false })
    setViewers(data || [])
    setViewersLoading(false)
  }

  function openViewers() {
    setPaused(true)
    setShowViewers(true)
    loadViewers()
  }

  function closeViewers() {
    setShowViewers(false)
    setViewerSearch('')
    setPaused(false)
  }

  function goChat() {
    onClose?.()
    navigate('/chat/' + story.user_id)
  }

  function openTaggedEntity() {
    const kind = story?.tagged_kind
      || (story?.tagged_listing_id || story?.tagged ? 'listing' : null)
      || story?._taggedKind
    const id = story?.tagged_ref_id || story?.tagged_listing_id || story?.tagged?.id
    if (!kind || !id) return
    onClose?.()
    if (kind === 'listing') navigate('/listing/' + id)
    else if (kind === 'job') navigate('/jobs') // jobs use modal; list is fine fallback
    else if (kind === 'service') navigate('/services')
    else if (kind === 'shop') navigate('/shop/' + id)
    else if (kind === 'request') navigate('/looking-for')
  }

  async function loadReplyCount(statusId) {
    if (!statusId) return
    // Prefer status_replies table
    const { count, error } = await supabase
      .from('status_replies')
      .select('id', { count: 'exact', head: true })
      .eq('status_id', statusId)
    if (!error && count != null) {
      setReplyCount(count)
      return
    }
    // Fallback: messages tagged with status marker
    const { data } = await supabase
      .from('messages')
      .select('id')
      .ilike('body', `%[[status_reply:${statusId}]]%`)
      .limit(200)
    setReplyCount((data || []).length)
  }

  async function loadCommentCount(statusId) {
    if (!statusId) return
    const { count, error } = await supabase
      .from('status_comments')
      .select('id', { count: 'exact', head: true })
      .eq('status_id', statusId)
    if (!error && count != null) setCommentCount(count)
  }

  async function attachAuthors(rows) {
    const ids = [...new Set((rows || []).map(r => r.from_user).filter(Boolean))]
    if (!ids.length) return rows || []
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', ids)
    const map = {}
    for (const p of profiles || []) map[p.id] = p
    return (rows || []).map(r => ({
      ...r,
      author: r.author || map[r.from_user] || null,
    }))
  }

  async function loadReplies() {
    if (!story?.id) return
    setRepliesLoading(true)

    // Preferred: status_replies table
    const { data, error } = await supabase
      .from('status_replies')
      .select('id, body, created_at, from_user, listing_id')
      .eq('status_id', story.id)
      .order('created_at', { ascending: false })
      .limit(80)

    if (!error && data) {
      const withAuthors = await attachAuthors(data)
      setReplies(withAuthors)
      setReplyCount(data.length)
      setRepliesLoading(false)
      return
    }

    // Fallback: messages carrying status marker
    const marker = `[[status_reply:${story.id}]]`
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, body, created_at, from_user, listing_id')
      .ilike('body', `%${marker}%`)
      .order('created_at', { ascending: false })
      .limit(80)

    const parsed = (msgs || []).map(m => ({
      id: m.id,
      body: String(m.body || '')
        .replace(marker, '')
        .replace(/\n*— replied on your status[\s\S]*$/i, '')
        .replace(/^\n+/, '')
        .trim(),
      created_at: m.created_at,
      from_user: m.from_user,
      listing_id: m.listing_id,
    }))
    const withAuthors = await attachAuthors(parsed)
    setReplies(withAuthors)
    setReplyCount(parsed.length)
    setRepliesLoading(false)
  }

  function openReplies() {
    setPaused(true)
    setShowReplies(true)
    loadReplies()
  }

  function closeReplies() {
    setShowReplies(false)
    setPaused(false)
  }

  async function loadComments() {
    if (!story?.id) return
    setCommentsLoading(true)
    const { data, error } = await supabase
      .from('status_comments')
      .select('id, body, created_at, user_id, parent_id, media_urls')
      .eq('status_id', story.id)
      .order('created_at', { ascending: false })
      .limit(120)
    if (!error && data) {
      const withAuthors = await attachCommentAuthors(data)
      // Index by id for parent lookup + nested thread roots
      const byId = {}
      for (const c of withAuthors) byId[c.id] = c

      function authorLabel(c) {
        if (!c) return 'User'
        if (c.user_id === currentUserId) return 'You'
        return c.author?.full_name || 'User'
      }

      function findRootId(c) {
        let cur = c
        const seen = new Set()
        while (cur?.parent_id && byId[cur.parent_id] && !seen.has(cur.id)) {
          seen.add(cur.id)
          cur = byId[cur.parent_id]
        }
        return cur?.id
      }

      const topLevel = []
      const children = {} // rootId → flat reply list (any depth), oldest first
      for (const c of withAuthors) {
        // Top-level, or orphaned (parent missing) → show as root so nothing is lost
        if (!c.parent_id || !byId[c.parent_id]) {
          topLevel.push(c)
          continue
        }
        const rootId = findRootId(c)
        if (!rootId || rootId === c.id) continue
        const parent = byId[c.parent_id]
        const enriched = {
          ...c,
          replyToId: c.parent_id,
          replyToName: authorLabel(parent),
          rootId,
        }
        if (!children[rootId]) children[rootId] = []
        children[rootId].push(enriched)
      }
      for (const pid in children) {
        children[pid].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
      }
      const grouped = topLevel.map(c => ({ ...c, replies: children[c.id] || [] }))
      setComments(grouped)
      setCommentCount(data.length)
      // Load reactions for all visible comments
      const allIds = data.map(c => c.id)
      if (allIds.length) {
        supabase.from('status_comment_reactions')
          .select('comment_id, reaction, user_id')
          .in('comment_id', allIds)
          .then(({ data: reactions }) => {
            if (!reactions) return
            const map = {}
            for (const r of reactions) {
              if (!map[r.comment_id]) map[r.comment_id] = { love: 0, myReaction: null }
              map[r.comment_id].love++
              if (r.user_id === currentUserId) map[r.comment_id].myReaction = r.reaction
            }
            setCommentReactions(map)
          })
      }
    }
    setCommentsLoading(false)
  }

  function commentLink(commentId) {
    return `${window.location.origin}/story/${story.id}?comment=${commentId}`
  }

  async function shareOrCopyComment(commentId) {
    const url = commentLink(commentId)
    if (isMobileShareDevice() && typeof navigator.share === 'function') {
      try {
        await navigator.share({ url, title: 'Comment on Soko Malawi' })
      } catch { /* user cancelled */ }
      return
    }
    if (navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url)
        showToast('Link copied')
        return
      } catch { /* fall through to fallback */ }
    }
    fallbackCopy(url, () => showToast('Link copied'))
  }

  function startReplyTo(target, rootId) {
    const name = target.author?.full_name
      || (target.user_id === currentUserId ? 'You' : 'User')
    setReplyToComment(
      replyToComment?.id === target.id
        ? null
        : { id: target.id, name, rootId: rootId || target.id }
    )
    setCommentText('')
  }

  async function attachCommentAuthors(rows) {
    const ids = [...new Set((rows || []).map(r => r.user_id).filter(Boolean))]
    if (!ids.length) return rows || []
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', ids)
    const map = {}
    for (const p of profiles || []) map[p.id] = p
    return (rows || []).map(r => ({ ...r, author: map[r.user_id] || null }))
  }

  function openComments() {
    setPaused(true)
    setShowComments(true)
    loadComments()
  }

  function closeComments() {
    setShowComments(false)
    setPaused(false)
  }

  /**
   * Auto-send reply to seller with status identity.
   * Does NOT open chat — stays on the status viewer.
   */
  async function handleReply() {
    if (!replyText.trim() || replySending || !currentUserId || !story) return
    if (currentUserId === story.user_id) {
      showToast('You can’t reply to your own status')
      return
    }

    const text = replyText.trim()
    setReplySending(true)

    // Keep a clear status caption in the chat body so replies are easy to identify
    let statusSnippet = (story.content || '').replace(/\s+/g, ' ').trim().slice(0, 100)
    if (!statusSnippet) {
      const firstMedia = Array.isArray(story.media_urls) ? story.media_urls[0] : null
      const isVideo = firstMedia && /\.(mp4|webm|mov)(\?|$)/i.test(String(firstMedia))
      statusSnippet = isVideo ? 'Video status' : firstMedia ? 'Photo status' : 'Status update'
    }
    const productLine = story.tagged?.title
      ? `Product: ${story.tagged.title}`
      : null

    // Marker lets us find replies later; body is readable in chat for the seller
    const marker = `[[status_reply:${story.id}]]`
    const chatBody = [
      marker,
      text,
      '',
      '— replied on your status',
      `Status: “${statusSnippet}${statusSnippet.length >= 100 ? '…' : ''}”`,
      productLine || null,
    ].filter(Boolean).join('\n')

    let messageId = null
    let sendError = null

    // 1) Deliver into seller chat with listing/status identity
    const msgPayload = {
      from_user: currentUserId,
      to_user: story.user_id,
      body: chatBody,
      read: false,
      chat_source: story.tagged_listing_id ? 'listing' : 'direct',
    }
    if (story.tagged_listing_id) msgPayload.listing_id = story.tagged_listing_id

    {
      const res = await supabase.from('messages').insert(msgPayload).select('id').single()
      if (res.error && /chat_source|listing_id|column/i.test(res.error.message || '')) {
        // Retry minimal columns
        const legacy = {
          from_user: currentUserId,
          to_user: story.user_id,
          body: chatBody,
          read: false,
        }
        if (story.tagged_listing_id) legacy.listing_id = story.tagged_listing_id
        const res2 = await supabase.from('messages').insert(legacy).select('id').single()
        messageId = res2.data?.id || null
        sendError = res2.error
      } else {
        messageId = res.data?.id || null
        sendError = res.error
      }
    }

    // 2) Store structured reply for the replies sheet
    if (!sendError) {
      const replyRow = {
        status_id: story.id,
        from_user: currentUserId,
        to_user: story.user_id,
        body: text,
        listing_id: story.tagged_listing_id || null,
        message_id: messageId,
      }
      const { data: saved } = await supabase
        .from('status_replies')
        .insert(replyRow)
        .select(`
          id, body, created_at, from_user, listing_id,
          author:profiles!from_user ( id, full_name, avatar_url )
        `)
        .maybeSingle()

      // Optimistic local list update
      const optimistic = saved || {
        id: messageId || `local_${Date.now()}`,
        body: text,
        created_at: new Date().toISOString(),
        from_user: currentUserId,
        listing_id: story.tagged_listing_id || null,
        author: {
          id: currentUserId,
          full_name: 'You',
          avatar_url: myAvatar,
        },
      }
      setReplies(prev => [optimistic, ...prev])
      setReplyCount(c => c + 1)

      // Notify chats UI without leaving
      try { window.dispatchEvent(new Event('soko:messages-updated')) } catch { /* ignore */ }

      setReplyText('')
      showToast('Reply sent to seller')
    } else {
      console.error('Status reply failed:', sendError)
      showToast('Could not send reply — try again')
    }

    setReplySending(false)
  }

  async function uploadCommentMedia(file) {
    const ext = file.name.split('.').pop()
    const path = `${currentUserId}/comment_${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('story-media')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (error) return null
    const { data } = supabase.storage.from('story-media').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleCommentSubmit() {
    if ((!commentText.trim() && !commentMediaFile) || commentSending || !currentUserId || !story) return
    const text = commentText.trim()
    let mediaUrls = []
    setCommentSending(true)
    if (commentMediaFile) {
      const url = await uploadCommentMedia(commentMediaFile)
      if (url) mediaUrls = [url]
    }
    const payload = { status_id: story.id, user_id: currentUserId, body: text }
    if (replyToComment) payload.parent_id = replyToComment.id
    if (mediaUrls.length) payload.media_urls = mediaUrls
    const { data: saved } = await supabase
      .from('status_comments')
      .insert(payload)
      .select('id, body, created_at, user_id, parent_id, media_urls')
      .maybeSingle()
    if (saved) {
      const withAuthor = {
        ...saved,
        author: { id: currentUserId, full_name: 'You', avatar_url: myAvatar },
      }
      if (replyToComment) {
        const rootId = replyToComment.rootId || replyToComment.id
        const enriched = {
          ...withAuthor,
          replyToId: replyToComment.id,
          replyToName: replyToComment.name,
          rootId,
        }
        setComments(prev => prev.map(c => {
          if (c.id !== rootId) return c
          return { ...c, replies: [...(c.replies || []), enriched] }
        }))
      } else {
        setComments(prev => [{ ...withAuthor, replies: [] }, ...prev])
      }
      setCommentCount(c => c + 1)
      setCommentText('')
      setCommentMediaFile(null)
      setCommentMediaPreview(null)
      setReplyToComment(null)
    } else {
      showToast('Could not post comment')
    }
    setCommentSending(false)
  }

  async function handleCommentLove(commentId, currentlyLiked) {
    if (!currentUserId) return
    if (currentlyLiked) {
      await supabase.from('status_comment_reactions')
        .delete().eq('comment_id', commentId).eq('user_id', currentUserId)
      setCommentReactions(prev => {
        const cur = prev[commentId] || { love: 0, myReaction: null }
        return { ...prev, [commentId]: { love: Math.max(0, cur.love - 1), myReaction: null } }
      })
    } else {
      await supabase.from('status_comment_reactions')
        .insert({ comment_id: commentId, user_id: currentUserId, reaction: 'love' })
      setCommentReactions(prev => {
        const cur = prev[commentId] || { love: 0, myReaction: null }
        return { ...prev, [commentId]: { love: cur.love + 1, myReaction: 'love' } }
      })
    }
  }

  function onPointerDown() {
    clearTimeout(holdRef.current)
    holdRef.current = setTimeout(() => setPaused(true), 140)
  }
  function onPointerUp() {
    clearTimeout(holdRef.current)
    if (!showViewers && !shareUrl && !showMenu && !showReplies) {
      setPaused(false)
      setShowMarketplace(true)
      clearTimeout(marketplaceTimerRef.current)
      marketplaceTimerRef.current = setTimeout(() => setShowMarketplace(false), 4000)
    }
  }

  function handleClose() {
    setClosing(true)
    setTimeout(() => onClose?.(), 280)
  }

  if (!story) return null

  const name = story.profiles?.full_name || 'Seller'
  const avatar = story.profiles?.avatar_url
  const initial = (name[0] || 'S').toUpperCase()
  const isOwn = story.user_id === currentUserId
  const createdAgo = timeAgoFn(story.created_at)

  const mediaList = getMediaList(story)
  const media0 = mediaList[mediaIdx] || mediaList[0]
  const annotationOverlay = getAnnotationOverlay(story)
  const textBoard = (story.media_urls || []).find(isColorUrl)
  const mediaCount = Math.max(mediaList.length, 1)
  const mediaLabel = `${mediaIdx + 1} / ${mediaCount}`
  // Text-only statuses: content is the main stage
  const isTextOnlyStage = !media0 && !textBoard
  // Stream media immediately — no download progress UI
  // Videos: never show the error card — keep the <video> mounted so its
  // own first-frame/poster acts as the WhatsApp-style preview while it loads.
  const showMedia = mediaKind === 'video' ? !!mediaSrc : (!!mediaSrc && !mediaError)
  const showLoadError = !!mediaError && !!media0 && mediaKind !== 'video'

  const tagged = story.tagged || story._taggedEntity || null
  const taggedKind = story.tagged_kind
    || (story.tagged_listing_id || story.tagged ? 'listing' : null)
    || story._taggedKind
    || null
  const productTitle = tagged?.title || tagged?.name || null
  const productPrice = tagged?.price != null
    ? (typeof tagged.price === 'number' || /^\d/.test(String(tagged.price))
      ? formatPrice(tagged.price)
      : tagged.price)
    : (tagged?.rate || tagged?.salary || null)
  // Prefer logos for shops & jobs (company branding)
  const entityLogo = taggedKind === 'shop'
    ? (tagged?.logo_url || tagged?.images?.[0] || tagged?.cover_url || null)
    : taggedKind === 'job'
      ? (tagged?.logo_url || tagged?.images?.[0] || tagged?.cover_image_url || null)
      : null
  const productImage = entityLogo
    || tagged?.images?.[mediaIdx]
    || tagged?.images?.[0]
    || tagged?.media_urls?.[0]
    || tagged?.logo_url
    || tagged?.cover_image_url
    || tagged?.cover_url
    || null
  const productCity = tagged?.city || tagged?.district || story.location_hint || story.profiles?.city || null
  const productDesc = tagged?.description || tagged?.overview || null
  const shortDesc = productDesc
    ? String(productDesc).replace(/\s+/g, ' ').trim().slice(0, 90)
    : (!isTextOnlyStage && story.content
      ? String(story.content).replace(/\s+/g, ' ').trim().slice(0, 90)
      : null)
  const kindMeta = taggedKind ? STATUS_META[taggedKind] : null
  const kindLabel = kindMeta?.label
    || (story.status_type === 'promo' || story.status_type === 'promotion' ? STATUS_META.promotion.label : null)
    || null
  const kindColor = kindMeta?.color
    || (kindLabel ? STATUS_COLORS.promotion : null)
    || null

  // Progress bars: one per media item in this user's current story group,
  // or fall back to per-story-in-user-group
  const uid = story.user_id
  const userStories = localStories.filter(s => s.user_id === uid)
  const userStartIdx = localStories.findIndex(s => s.user_id === uid)
  const storyLocalIdx = idx - userStartIdx
  // Prefer media segments when multi-image on one status
  const useMediaBars = mediaList.length > 1
  const barCount = useMediaBars ? mediaList.length : Math.max(userStories.length, 1)
  const barActive = useMediaBars ? mediaIdx : storyLocalIdx

  const loveCount = reactionCounts.love || 0
  const isFeatured = String(story.status_type || '').toLowerCase().includes('promo')
    || String(story.content || '').toLowerCase().includes('featured')
    || !!tagged

  const filteredViewers = viewers.filter(v =>
    !viewerSearch || v.viewer?.full_name?.toLowerCase().includes(viewerSearch.toLowerCase()),
  )

  const myInitial = 'Y'

  return (
    <>
      <style>{`
        @keyframes svShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes svSheet {
          from { transform: translateY(18%); opacity: 0.6; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes svShimmer {
          0% { background-position: -200% 0; }
          100% { background-position: 200% 0; }
        }
        @keyframes svOpen {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes svClose {
          from { opacity: 1; transform: scale(1); }
          to { opacity: 0; transform: scale(0.92) translateY(40px); }
        }
        .sv-tap:active { opacity: 0.85; }
        .sv-hide-scroll::-webkit-scrollbar { display: none; }
        #sv-reply-input::placeholder { color: rgba(255,255,255,0.65); }
      `}</style>

      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 998,
          background: '#0d0d0d',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          userSelect: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          animation: closing ? 'svClose 0.28s ease forwards' : 'svOpen 0.25s ease',
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onTouchStart={e => { touchStartRef.current = { y: e.touches[0].clientY, x: e.touches[0].clientX } }}
        onTouchMove={e => {
          if (!touchStartRef.current) return
          const dy = e.touches[0].clientY - touchStartRef.current.y
          if (dy > 80) { touchStartRef.current = null; handleClose() }
        }}
        onTouchEnd={() => { touchStartRef.current = null }}
        onKeyDown={e => {
          if (e.key === 'Escape') handleClose()
          else if (e.key === 'ArrowLeft') { clearTimeout(holdRef.current); goBack() }
          else if (e.key === 'ArrowRight') { clearTimeout(holdRef.current); advance() }
        }}
        tabIndex={0}
        ref={mainRef}
      >
          <div style={{
            position: 'relative',
            width: '100%',
            maxWidth: 'min(520px, 100vw)',
            height: '100%',
            maxHeight: '100vh',
            background: '#0d0d0d',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            borderRadius: 0,
          }}>
            {/* ════════ MEDIA STAGE ════════ */}
            <div style={{ position: 'relative', flex: 1, minHeight: 0, background: '#0d0d0d' }}>
            {/* Skeleton shimmer while media is still buffering — avoids the blank/black gap */}
            {media0 && !mediaReady && !showLoadError && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 3,
                background: 'linear-gradient(100deg, #111827 30%, #1f2937 50%, #111827 70%)',
                backgroundSize: '200% 100%',
                animation: 'svShimmer 1.4s ease-in-out infinite',
              }} />
            )}

            {/* Only show error state (no downloading % UI) */}
            {showLoadError && (
              <div style={{
                position: 'absolute', inset: 0, zIndex: 4,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 12, padding: 24,
                background: 'linear-gradient(160deg,#0a0f12 0%,#111827 100%)',
              }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#f1f5f9' }}>Couldn’t load media</div>
                <button
                  type="button"
                  className="sv-tap"
                  onPointerDown={e => e.stopPropagation()}
                  onPointerUp={e => {
                    e.stopPropagation()
                    setMediaError(null)
                    setMediaReady(false)
                    if (media0) {
                      setMediaSrc(media0)
                      setMediaKind(isVideoUrl(media0) ? 'video' : 'image')
                    }
                    setMediaIdx(m => m)
                  }}
                  style={{
                    border: '1px solid rgba(255,255,255,0.15)',
                    background: 'rgba(255,255,255,0.08)', color: '#fff',
                    borderRadius: 999, padding: '10px 18px',
                    fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  Retry
                </button>
              </div>
            )}

            {/* Stream media immediately */}
            {showMedia && mediaKind === 'video' && (
              <video
                ref={videoRef}
                key={mediaSrc}
                src={mediaSrc}
                autoPlay
                muted={muted}
                playsInline
                preload="auto"
                onLoadedData={() => setMediaReady(true)}
                onCanPlay={() => setMediaReady(true)}
                onError={() => {
                  // Never surface an error card for video — just keep the element
                  // mounted (shows last good frame / poster) and let the retry below run.
                  setMediaReady(false)
                }}
                style={{
                  width: '100%', height: '100%', objectFit: 'contain', display: 'block',
                  background: '#0d0d0d',
                }}
              />
            )}
            {showMedia && mediaKind === 'image' && (
              <img
                key={mediaSrc}
                src={mediaSrc}
                alt=""
                draggable={false}
                onLoad={() => setMediaReady(true)}
                onError={() => {
                  setMediaError('Image failed to load')
                  setMediaReady(false)
                }}
                style={{
                  width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                  transform: paused ? 'scale(1.02)' : 'scale(1)',
                  transition: 'transform 0.5s ease',
                }}
              />
            )}

            {/* User annotations (blur / pens / arrows) — video overlay PNG */}
            {showMedia && annotationOverlay && (
              <img
                src={annotationOverlay}
                alt=""
                draggable={false}
                style={{
                  position: 'absolute', inset: 0, zIndex: 1,
                  width: '100%', height: '100%', objectFit: 'cover',
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Text board / gradient — only when no remote media needed */}
            {mediaReady && !media0 && textBoard && (
              <div style={{
                width: '100%', height: '100%', background: textBoard,
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28,
              }}>
                <p style={{
                  margin: 0, fontSize: 22, fontWeight: 800, color: '#fff',
                  textAlign: 'center', lineHeight: 1.4, textShadow: '0 2px 14px rgba(0,0,0,0.25)',
                }}>
                  {story.content}
                </p>
              </div>
            )}
            {mediaReady && !media0 && !textBoard && (
              <div style={{
                width: '100%', height: '100%',
                background: GRADIENTS[idx % GRADIENTS.length],
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', padding: 28, gap: 14,
              }}>
                {productImage && (
                  <img src={productImage} alt="" style={{
                    width: '72%', maxHeight: '48%', objectFit: 'contain',
                    borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.35)',
                  }} />
                )}
                <p style={{
                  margin: 0, fontSize: productImage ? 18 : 22, fontWeight: 800, color: '#fff',
                  textAlign: 'center', lineHeight: 1.4, textShadow: '0 2px 12px rgba(0,0,0,0.3)',
                  maxWidth: 320,
                }}>
                  {story.content || productTitle || 'Status update'}
                </p>
              </div>
            )}

            {/* Scrims — top for header, bottom so product card sits on the image clearly */}
            <div style={{
              position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
              background: tagged
                ? 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 18%, transparent 50%, rgba(0,0,0,0.55) 100%)'
                : 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 20%, transparent 55%, rgba(0,0,0,0.35) 78%, transparent 100%)',
            }} />

            {/* ── Progress bars ── */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
              display: 'flex', gap: 2,
              padding: '8px 10px 0',
              paddingTop: 'max(8px, env(safe-area-inset-top, 8px))',
            }}>
              {Array.from({ length: barCount }).map((_, i) => (
                <div key={i} style={{
                  flex: 1, height: 2, borderRadius: 99,
                  background: 'rgba(255,255,255,0.25)', overflow: 'hidden',
                }}>
                  <div
                    ref={i === barActive ? activeBarRef : null}
                    style={{
                      height: '100%', borderRadius: 99, background: '#fff',
                      width: i < barActive ? '100%' : i === barActive ? `${progress}%` : '0%',
                      transition: 'width 0.1s linear',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* ── Header ── */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '14px 12px 0',
              paddingTop: 'max(18px, calc(env(safe-area-inset-top, 8px) + 10px))',
            }}>
              <button
                type="button"
                className="sv-tap"
                onPointerDown={e => e.stopPropagation()}
                onPointerUp={e => {
                  e.stopPropagation()
                  onClose?.()
                  navigate(`/profile/${story.user_id}`)
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'none', border: 'none', padding: 0,
                  cursor: 'pointer', flex: 1, minWidth: 0, textAlign: 'left',
                }}
              >
                <div style={{
                  width: 42, height: 42, borderRadius: '50%', flexShrink: 0,
                  border: '2px solid rgba(255,255,255,0.9)',
                  overflow: 'hidden',
                  background: `linear-gradient(135deg,${GREEN},#22c55e)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15, fontWeight: 800, color: '#fff',
                  boxShadow: '0 2px 10px rgba(0,0,0,0.4)',
                }}>
                  {avatar
                    ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initial}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{
                      fontSize: 15, fontWeight: 800, color: '#fff',
                      textShadow: '0 1px 6px rgba(0,0,0,0.6)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: 160,
                    }}>
                      {isOwn ? 'Your status' : name}
                    </span>
                    <IconVerified size={14} />
                  </div>
                  <div style={{
                    fontSize: 11, color: 'rgba(255,255,255,0.65)', fontWeight: 500,
                    marginTop: 1, textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    <span>{createdAgo}</span>
                    {kindLabel && (
                      <span style={{
                        fontSize: 9, fontWeight: 800,
                        color: '#fff', borderRadius: 4,
                        padding: '1px 6px', lineHeight: 1.6,
                        background: kindColor || '#666',
                      }}>
                        {kindLabel}
                      </span>
                    )}
                  </div>
                </div>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                <button
                  type="button"
                  className="sv-tap"
                  onPointerDown={e => e.stopPropagation()}
                  onPointerUp={e => {
                    e.stopPropagation()
                    setShowMenu(v => !v)
                    setPaused(true)
                  }}
                  aria-label="More"
                  style={{
                    ...iconBtnStyle,
                    width: 40, height: 40,
                    background: 'rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(6px)',
                    borderRadius: '50%',
                  }}
                >
                  <MoreHorizontal size={18} />
                </button>
                <button
                  type="button"
                  className="sv-tap"
                  onPointerDown={e => e.stopPropagation()}
                  onPointerUp={e => { e.stopPropagation(); handleClose() }}
                  aria-label="Close"
                  style={{
                    ...iconBtnStyle,
                    width: 40, height: 40,
                    background: 'rgba(0,0,0,0.3)',
                    backdropFilter: 'blur(6px)',
                    borderRadius: '50%',
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* more menu */}
            {showMenu && (
              <div
                onPointerDown={e => e.stopPropagation()}
                onPointerUp={e => e.stopPropagation()}
                style={{
                  position: 'absolute', top: 62, right: 12, zIndex: 40,
                  background: 'rgba(17,24,39,0.96)', backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 14, overflow: 'hidden', minWidth: 160,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.45)',
                  animation: 'svSheet 0.18s ease',
                }}
              >
                {isOwn && (
                  <MenuItem label="View analytics" onClick={() => { setShowMenu(false); openViewers() }} />
                )}
                <MenuItem label="Share status" onClick={() => { setShowMenu(false); openShare() }} />
                <MenuItem label="View profile" onClick={() => { setShowMenu(false); onClose?.(); navigate(`/profile/${story.user_id}`) }} />
                <MenuItem label="Close" onClick={() => { setShowMenu(false); setPaused(false) }} />
              </div>
            )}

            {/* FEATURED badge */}
            {isFeatured && (
              <div style={{
                position: 'absolute', left: 14, top: 68, zIndex: 20,
                background: GOLD_BTN, color: '#1a1a1a',
                borderRadius: 999, padding: '6px 11px',
                fontSize: 10, fontWeight: 900, letterSpacing: 0.6,
                display: 'inline-flex', alignItems: 'center', gap: 5,
                boxShadow: '0 4px 14px rgba(240,192,0,0.4)',
              }}>
                <IconStar size={11} />
                FEATURED
              </div>
            )}

            {/* media counter */}
            {mediaCount > 1 && (
              <div style={{
                position: 'absolute', right: 14, top: 68, zIndex: 20,
                background: 'rgba(0,0,0,0.55)', color: '#fff',
                borderRadius: 999, padding: '5px 10px',
                fontSize: 11, fontWeight: 800,
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}>
                {mediaLabel}
              </div>
            )}

            {/* Mute / unmute toggle — only for video */}
            {mediaKind === 'video' && showMedia && (
                <button
                  type="button"
                  className="sv-tap"
                  onPointerDown={e => e.stopPropagation()}
                  onPointerUp={e => { e.stopPropagation(); setMuted(m => !m) }}
                  aria-label={muted ? 'Unmute video' : 'Mute video'}
                  style={{
                    position: 'absolute',
                    right: 14,
                    top: mediaCount > 1 ? 104 : 68,
                  zIndex: 20,
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.55)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.12)',
                  backdropFilter: 'blur(8px)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                {muted ? <IconMuted size={16} /> : <IconUnmuted size={16} />}
              </button>
            )}

            {/* Product / entity card now lives inside the floating bottom chrome — see below */}
            {false && tagged && mediaReady && !mediaError && (
              <div
                onPointerDown={e => e.stopPropagation()}
                onPointerUp={e => e.stopPropagation()}
                style={{
                  position: 'absolute', left: 12, right: 12, bottom: 12, zIndex: 22,
                }}
              >
                <button
                  type="button"
                  className="sv-tap"
                  onClick={openTaggedEntity}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.14)',
                    backdropFilter: 'blur(8px)',
                    border: '1.5px solid rgba(255,255,255,0.25)',
                    borderRadius: 14,
                    padding: '8px 10px',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                  }}
                >
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    overflow: 'hidden',
                    background: 'rgba(255,255,255,0.1)',
                    border: '1px solid rgba(255,255,255,0.14)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {entityLogo || productImage ? (
                      <img
                        src={entityLogo || productImage}
                        alt=""
                        style={{
                          width: '100%', height: '100%',
                          objectFit: (taggedKind === 'shop' || taggedKind === 'job') ? 'contain' : 'cover',
                          background: (taggedKind === 'shop' || taggedKind === 'job') ? '#fff' : 'transparent',
                          padding: (taggedKind === 'shop' || taggedKind === 'job') ? 3 : 0,
                          boxSizing: 'border-box',
                        }}
                      />
                    ) : (
                      <IconPackage size={18} />
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{
                        fontSize: 13.5, fontWeight: 800, color: '#fff',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                      }}>
                        {productTitle}
                      </span>
                      {productPrice && (
                        <span style={{
                          fontSize: 13, fontWeight: 900, color: GOLD,
                          textShadow: '0 1px 4px rgba(0,0,0,0.5)', flexShrink: 0,
                        }}>
                          {typeof productPrice === 'string' && !/^(MK|mk)/.test(productPrice) && Number.isFinite(Number(productPrice))
                            ? formatPrice(productPrice)
                            : productPrice}
                        </span>
                      )}
                    </div>
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap',
                      fontSize: 10.5, color: 'rgba(255,255,255,0.65)', fontWeight: 600, marginTop: 1,
                    }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: '#4ade80' }}>
                        <IconCheck size={9} />
                        Verified
                      </span>
                      {productCity && (
                        <>
                          <span style={{ opacity: 0.4 }}>·</span>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <IconMapPin size={9} />
                            {productCity}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <IconChevronRight size={16} color="rgba(255,255,255,0.6)" />
                </button>
              </div>
            )}

            {/* Caption on media only when no product card (avoid double text) */}
            {!tagged && mediaReady && story.content && media0 && !isTextOnlyStage && (
              <div style={{
                position: 'absolute', left: 14, right: 14, bottom: 12, zIndex: 20,
                background: 'rgba(10,20,14,0.82)',
                backdropFilter: 'blur(14px)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 16, padding: '12px 14px',
              }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#f1f5f9', lineHeight: 1.45 }}>
                  {story.content}
                </p>
              </div>
            )}

            {/* Tap zones — full height, chrome now floats over the media */}
            <div
              onPointerUp={e => {
                e.stopPropagation()
                clearTimeout(holdRef.current)
                setPaused(false)
                goBack()
              }}
              style={{ position: 'absolute', left: 0, top: 60, bottom: 0, width: '32%', zIndex: 12 }}
            />
            <div
              onPointerUp={e => {
                e.stopPropagation()
                clearTimeout(holdRef.current)
                setPaused(false)
                advance()
              }}
              style={{ position: 'absolute', right: 0, top: 60, bottom: 0, width: '32%', zIndex: 12 }}
            />

            {/* ════════ FLOATING BOTTOM CHROME — overlaid on media ════════ */}
            <div
              onPointerDown={e => e.stopPropagation()}
              onPointerUp={e => e.stopPropagation()}
              style={{
                position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 25,
                background: 'linear-gradient(to top, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.5) 35%, rgba(0,0,0,0.1) 75%, transparent 100%)',
                padding: '16px 12px calc(8px + env(safe-area-inset-bottom, 0px))',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {/* Tagged product / entity card — auto-hides after 4s */}
              {tagged && mediaReady && !mediaError && (
                <div style={{
                  opacity: showMarketplace ? 1 : 0,
                  transform: showMarketplace ? 'translateY(0)' : 'translateY(8px)',
                  transition: 'opacity 0.35s ease, transform 0.35s ease',
                  pointerEvents: showMarketplace ? 'auto' : 'none',
                }}>
                  <button
                    type="button"
                    className="sv-tap"
                    onClick={openTaggedEntity}
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.08)',
                      backdropFilter: 'blur(16px)',
                      WebkitBackdropFilter: 'blur(16px)',
                      border: '1px solid rgba(255,255,255,0.15)',
                      borderRadius: 12,
                      padding: '6px 8px',
                      textAlign: 'left',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <div style={{
                      width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                      overflow: 'hidden',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {entityLogo || productImage ? (
                        <img
                          src={entityLogo || productImage}
                          alt=""
                          style={{
                            width: '100%', height: '100%',
                            objectFit: (taggedKind === 'shop' || taggedKind === 'job') ? 'contain' : 'cover',
                            background: (taggedKind === 'shop' || taggedKind === 'job') ? '#fff' : 'transparent',
                            padding: (taggedKind === 'shop' || taggedKind === 'job') ? 3 : 0,
                            boxSizing: 'border-box',
                          }}
                        />
                      ) : (
                        <IconPackage size={16} />
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                        <span style={{
                          fontSize: 12.5, fontWeight: 800, color: '#fff',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                        }}>
                          {productTitle}
                        </span>
                        {productPrice && (
                          <span style={{
                            fontSize: 12, fontWeight: 900, color: GOLD,
                            textShadow: '0 1px 4px rgba(0,0,0,0.4)', flexShrink: 0,
                          }}>
                            {typeof productPrice === 'string' && !/^(MK|mk)/.test(productPrice) && Number.isFinite(Number(productPrice))
                              ? formatPrice(productPrice)
                              : productPrice}
                          </span>
                        )}
                      </div>
                      {productCity && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 3,
                          fontSize: 10, color: 'rgba(255,255,255,0.6)', fontWeight: 500, marginTop: 1,
                        }}>
                          <MapPin size={8} />
                          {productCity}
                        </div>
                      )}
                    </div>
                    <ChevronRight size={14} color="rgba(255,255,255,0.5)" />
                  </button>
                </div>
              )}

              {/* Action bar */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16, padding: '2px 0',
              }}>
                {!isOwn ? (
                  <button
                    type="button"
                    className="sv-tap"
                    onClick={handleLove}
                    disabled={reacting}
                    aria-label="Like"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'none', border: 'none', padding: 0,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <IconHeart size={19} filled={myReaction === 'love'} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                      {fmtK(loveCount)}
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="sv-tap"
                    onClick={openViewers}
                    aria-label="View analytics"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: 'none', border: 'none', padding: 0,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    <Eye size={19} />
                    <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                      {fmtK(viewCount)}
                    </span>
                  </button>
                )}

                <button
                  type="button"
                  className="sv-tap"
                  onClick={openComments}
                  aria-label="Comment"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'none', border: 'none', padding: 0,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <MessageCircle size={19} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                    {fmtK(commentCount)}
                  </span>
                </button>

                <button
                  type="button"
                  className="sv-tap"
                  onClick={openShare}
                  aria-label="Share"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 5,
                    background: 'none', border: 'none', padding: 0,
                    cursor: 'pointer', fontFamily: 'inherit',
                  }}
                >
                  <Share2 size={17} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.8)', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>Share</span>
                </button>

                {/* Spacer */}
                <div style={{ flex: 1 }} />

                {/* Message / View product CTA */}
                {!isOwn ? (
                  <button
                    type="button"
                    className="sv-tap"
                    onClick={goChat}
                    aria-label="Message seller"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: GREEN,
                      border: 'none',
                      borderRadius: 999,
                      padding: '7px 14px',
                      fontSize: 12.5, fontWeight: 800, color: '#fff',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      boxShadow: '0 2px 10px rgba(26,122,74,0.3)',
                    }}
                  >
                    <Send size={13} />
                    Message
                  </button>
                ) : null}
              </div>

              {/* Reply bar */}
              {!isOwn && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: 'rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(12px)',
                  WebkitBackdropFilter: 'blur(12px)',
                  borderRadius: 999,
                  padding: '4px 6px 4px 4px',
                  border: '1px solid rgba(255,255,255,0.1)',
                }}>
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    overflow: 'hidden',
                    background: `linear-gradient(135deg,${GREEN},#22c55e)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 10, fontWeight: 800, color: '#fff',
                  }}>
                    {myAvatar
                      ? <img src={myAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : myInitial}
                  </div>
                  <input
                    id="sv-reply-input"
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onFocus={() => setPaused(true)}
                    onBlur={() => { if (!shareUrl && !showViewers && !showMenu && !showReplies && !showComments) setPaused(false) }}
                    onKeyDown={e => e.key === 'Enter' && handleReply()}
                    placeholder="Reply to status…"
                    maxLength={400}
                    style={{
                      flex: 1, border: 'none', outline: 'none', background: 'transparent',
                      fontSize: 13, color: '#fff', fontFamily: 'inherit', minWidth: 0,
                    }}
                  />
                  <button
                    type="button"
                    className="sv-tap"
                    onClick={handleReply}
                    disabled={!replyText.trim() || replySending}
                    aria-label="Send reply"
                    style={{
                      width: 30, height: 30, borderRadius: '50%', border: 'none',
                      background: replyText.trim() ? GREEN : 'transparent',
                      color: replyText.trim() ? '#fff' : 'rgba(255,255,255,0.4)',
                      cursor: replyText.trim() && !replySending ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                      opacity: replySending ? 0.7 : 1,
                    }}
                  >
                    <Send size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Toast — reply sent confirmation */}
          {toast && (
            <div style={{
              position: 'absolute', left: '50%', bottom: 110, zIndex: 99999,
              transform: 'translateX(-50%)',
              background: '#0f172a', color: '#fff',
              borderRadius: 999, padding: '10px 18px',
              fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap',
              boxShadow: '0 8px 28px rgba(0,0,0,0.35)',
              pointerEvents: 'none',
            }}>
              {toast}
            </div>
          )}
        </div>

        {/* ── Replies sheet (message icon) ── */}
        {showReplies && (
          <Sheet onClose={closeReplies} maxHeight="78vh">
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconComment size={16} />
                  {replyCount} {replyCount === 1 ? 'reply' : 'replies'}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>
                  {isOwn ? 'People who replied to your status' : 'Replies on this status'}
                </div>
              </div>
              <button
                type="button"
                onClick={closeReplies}
                style={{
                  width: 34, height: 34, borderRadius: '50%', border: 'none',
                  background: '#f1f5f9', color: '#64748b', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={15} />
              </button>
            </div>

            <div className="sv-hide-scroll" style={{ overflowY: 'auto', maxHeight: '48vh', marginBottom: 10 }}>
              {repliesLoading ? (
                <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
                  Loading replies…
                </div>
              ) : replies.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 16, margin: '0 auto 12px',
                    background: '#f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <IconComment size={22} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#64748b' }}>No replies yet</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: 600 }}>
                    {isOwn ? 'When people reply, they’ll show up here' : 'Be the first to reply below'}
                  </div>
                </div>
              ) : replies.map(r => {
                const rname = r.author?.full_name || (r.from_user === currentUserId ? 'You' : 'User')
                const ravatar = r.author?.avatar_url
                const rinitial = (rname[0] || 'U').toUpperCase()
                return (
                  <div key={r.id} style={{
                    display: 'flex', gap: 10, padding: '10px 2px',
                    borderBottom: '1px solid #f1f5f9',
                  }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                      background: `linear-gradient(135deg,${GREEN},#22c55e)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: '#fff',
                    }}>
                      {ravatar
                        ? <img src={ravatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : rinitial}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3 }}>
                        <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{rname}</span>
                        <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                          {timeAgoFn(r.created_at)}
                        </span>
                      </div>
                      <div style={{
                        fontSize: 13, color: '#334155', lineHeight: 1.45, fontWeight: 500,
                        wordBreak: 'break-word',
                      }}>
                        {r.body}
                      </div>
                      {/* Seller can open chat with this person if they want */}
                      {isOwn && r.from_user && r.from_user !== currentUserId && (
                        <button
                          type="button"
                          onClick={() => {
                            closeReplies()
                            onClose?.()
                            navigate('/chat/' + r.from_user)
                          }}
                          style={{
                            marginTop: 6, background: 'none', border: 'none', padding: 0,
                            fontSize: 11, fontWeight: 800, color: GREEN, cursor: 'pointer',
                            fontFamily: 'inherit',
                          }}
                        >
                          Open chat →
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Reply from sheet (viewers) */}
            {!isOwn && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#f8fafc', border: '1.5px solid #e2e8f0',
                borderRadius: 999, padding: '6px 8px 6px 12px',
              }}>
                <input
                  value={replyText}
                  onChange={e => setReplyText(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleReply()}
                  placeholder="Write a reply…"
                  maxLength={400}
                  style={{
                    flex: 1, border: 'none', outline: 'none', background: 'transparent',
                    fontSize: 13, color: '#0f172a', fontFamily: 'inherit',
                  }}
                />
                <button
                  type="button"
                  onClick={handleReply}
                  disabled={!replyText.trim() || replySending}
                  style={{
                    width: 36, height: 36, borderRadius: '50%', border: 'none',
                    background: replyText.trim() ? GREEN : '#e2e8f0',
                    color: replyText.trim() ? '#fff' : '#94a3b8',
                    cursor: replyText.trim() ? 'pointer' : 'default',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}
                >
                  <IconSend size={15} />
                </button>
              </div>
            )}
          </Sheet>
        )}

        {/* ── Comments sheet ── */}
        {showComments && (
          <Sheet onClose={closeComments} maxHeight="78vh">
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconComment size={16} />
                  {commentCount} {commentCount === 1 ? 'comment' : 'comments'}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>
                  {isOwn ? 'Comments on your status' : 'Comments on this status'}
                </div>
              </div>
              <button
                type="button"
                onClick={closeComments}
                style={{
                  width: 34, height: 34, borderRadius: '50%', border: 'none',
                  background: '#f1f5f9', color: '#64748b', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={15} />
              </button>
            </div>

            <div className="sv-hide-scroll" style={{ overflowY: 'auto', maxHeight: '48vh', marginBottom: 10 }}>
              {commentsLoading ? (
                <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
                  Loading comments…
                </div>
              ) : comments.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 16, margin: '0 auto 12px',
                    background: '#f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <IconComment size={22} />
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#64748b' }}>No comments yet</div>
                  <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 4, fontWeight: 600 }}>
                    Be the first to comment
                  </div>
                </div>
              ) : comments.map(c => {
                const cname = c.author?.full_name || (c.user_id === currentUserId ? 'You' : 'User')
                const cavatar = c.author?.avatar_url
                const cinitial = (cname[0] || 'U').toUpperCase()
                const cr = commentReactions[c.id] || { love: 0, myReaction: null }
                const isHighlighted = highlightCommentId === c.id
                const isReplyingHere = replyToComment?.id === c.id
                const desktopCopy = !isMobileShareDevice()
                return (
                  <div key={c.id} style={{ marginBottom: 4 }}>
                    <div
                      ref={el => { if (el) commentItemRefs.current[c.id] = el }}
                      style={{
                        display: 'flex', gap: 10, padding: '10px 8px',
                        borderRadius: 12,
                        border: isHighlighted ? `1.5px solid ${GREEN}` : '1.5px solid transparent',
                        background: isHighlighted ? 'rgba(26,122,74,0.06)' : isReplyingHere ? 'rgba(26,122,74,0.04)' : 'transparent',
                        transition: 'background 0.2s, border 0.2s',
                      }}
                    >
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                        background: `linear-gradient(135deg,${GREEN},#22c55e)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 13, fontWeight: 700, color: '#fff',
                      }}>
                        {cavatar
                          ? <img src={cavatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : cinitial}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 3, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>{cname}</span>
                          <span style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600 }}>
                            {timeAgoFn(c.created_at)}
                          </span>
                        </div>
                        <div style={{
                          fontSize: 13, color: '#334155', lineHeight: 1.45, fontWeight: 500,
                          wordBreak: 'break-word',
                        }}>
                          {c.body}
                        </div>
                        {c.media_urls?.length > 0 && (
                          <div style={{ marginTop: 6, maxWidth: '100%', borderRadius: 8, overflow: 'hidden' }}>
                            {c.media_urls.map((url, i) => (
                              isVideoUrl(url) ? (
                                <video key={i} src={url} controls style={{ width: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'cover' }} />
                              ) : (
                                <img key={i} src={url} alt="" style={{ width: '100%', maxHeight: 200, borderRadius: 8, objectFit: 'cover' }} />
                              )
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            onClick={() => handleCommentLove(c.id, cr.myReaction === 'love')}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 3,
                              background: 'none', border: 'none', padding: 0,
                              cursor: 'pointer', fontFamily: 'inherit',
                            }}
                          >
                            <IconHeart size={13} filled={cr.myReaction === 'love'} />
                            {cr.love > 0 && (
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{cr.love}</span>
                            )}
                          </button>
                          {currentUserId && (
                            <button
                              type="button"
                              onClick={() => startReplyTo(c, c.id)}
                              style={{
                                background: 'none', border: 'none', padding: 0,
                                fontSize: 11, fontWeight: 800,
                                color: isReplyingHere ? GREEN : '#94a3b8',
                                cursor: 'pointer', fontFamily: 'inherit',
                                display: 'inline-flex', alignItems: 'center', gap: 4,
                              }}
                            >
                              <IconReplyArrow size={11} />
                              {isReplyingHere ? 'Cancel' : 'Reply'}
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => shareOrCopyComment(c.id)}
                            title={desktopCopy ? 'Copy link to this comment' : 'Share this comment'}
                            style={{
                              background: 'none', border: 'none', padding: 0,
                              fontSize: 11, fontWeight: 800, color: '#94a3b8', cursor: 'pointer',
                              fontFamily: 'inherit',
                              display: 'inline-flex', alignItems: 'center', gap: 4,
                            }}
                          >
                            {desktopCopy ? <IconCopy size={11} /> : <IconShare size={11} />}
                            {desktopCopy ? 'Copy link' : 'Share'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Threaded replies — arrow shows who each person replied to */}
                    {c.replies?.length > 0 && (
                      <div style={{
                        marginLeft: 22,
                        borderLeft: '2px solid #d1fae5',
                        paddingLeft: 0,
                      }}>
                        {c.replies.map((r, rIdx) => {
                          const rname = r.author?.full_name || (r.user_id === currentUserId ? 'You' : 'User')
                          const ravtar = r.author?.avatar_url
                          const rinit = (rname[0] || 'U').toUpperCase()
                          const rr = commentReactions[r.id] || { love: 0, myReaction: null }
                          const replyTo = r.replyToName || cname
                          const rHighlighted = highlightCommentId === r.id
                          const rReplying = replyToComment?.id === r.id
                          return (
                            <div
                              key={r.id}
                              ref={el => { if (el) commentItemRefs.current[r.id] = el }}
                              style={{
                                display: 'flex', gap: 8, padding: '8px 8px 8px 12px',
                                position: 'relative',
                                borderRadius: 10,
                                border: rHighlighted ? `1.5px solid ${GREEN}` : '1.5px solid transparent',
                                background: rHighlighted ? 'rgba(26,122,74,0.06)' : rReplying ? 'rgba(26,122,74,0.04)' : 'transparent',
                                transition: 'background 0.2s, border 0.2s',
                              }}
                            >
                              {/* L-shaped thread connector into avatar */}
                              <div
                                aria-hidden
                                style={{
                                  position: 'absolute',
                                  left: 0,
                                  top: 0,
                                  width: 12,
                                  height: 22,
                                  borderBottom: '2px solid #a7f3d0',
                                  borderLeft: rIdx === 0 ? 'none' : 'none',
                                  borderBottomLeftRadius: 0,
                                  marginLeft: -2,
                                }}
                              />
                              <div style={{
                                width: 30, height: 30, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                                background: '#e2e8f0',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 700, color: '#475569',
                              }}>
                                {ravtar
                                  ? <img src={ravtar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  : rinit}
                              </div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{
                                  display: 'flex', alignItems: 'center', gap: 5, marginBottom: 3, flexWrap: 'wrap',
                                }}>
                                  <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>{rname}</span>
                                  <span
                                    style={{
                                      display: 'inline-flex', alignItems: 'center', gap: 3,
                                      fontSize: 11, fontWeight: 700, color: GREEN,
                                      background: 'rgba(26,122,74,0.08)',
                                      borderRadius: 999, padding: '1px 8px 1px 6px',
                                    }}
                                    title={`Replied to ${replyTo}`}
                                  >
                                    <IconReplyArrow size={10} />
                                    {replyTo}
                                  </span>
                                  <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>
                                    {timeAgoFn(r.created_at)}
                                  </span>
                                </div>
                                <div style={{
                                  fontSize: 12, color: '#334155', lineHeight: 1.4, fontWeight: 500,
                                  wordBreak: 'break-word',
                                }}>
                                  {r.body}
                                </div>
                                {r.media_urls?.length > 0 && (
                                  <div style={{ marginTop: 4, maxWidth: '100%', borderRadius: 6, overflow: 'hidden' }}>
                                    {r.media_urls.map((url, i) => (
                                      isVideoUrl(url) ? (
                                        <video key={i} src={url} controls style={{ width: '100%', maxHeight: 160, borderRadius: 6, objectFit: 'cover' }} />
                                      ) : (
                                        <img key={i} src={url} alt="" style={{ width: '100%', maxHeight: 160, borderRadius: 6, objectFit: 'cover' }} />
                                      )
                                    ))}
                                  </div>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 4, flexWrap: 'wrap' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleCommentLove(r.id, rr.myReaction === 'love')}
                                    style={{
                                      display: 'flex', alignItems: 'center', gap: 3,
                                      background: 'none', border: 'none', padding: 0,
                                      cursor: 'pointer', fontFamily: 'inherit',
                                    }}
                                  >
                                    <IconHeart size={12} filled={rr.myReaction === 'love'} />
                                    {rr.love > 0 && (
                                      <span style={{ fontSize: 10, fontWeight: 700, color: '#94a3b8' }}>{rr.love}</span>
                                    )}
                                  </button>
                                  {currentUserId && (
                                    <button
                                      type="button"
                                      onClick={() => startReplyTo(r, c.id)}
                                      style={{
                                        background: 'none', border: 'none', padding: 0,
                                        fontSize: 10, fontWeight: 800,
                                        color: rReplying ? GREEN : '#94a3b8',
                                        cursor: 'pointer', fontFamily: 'inherit',
                                        display: 'inline-flex', alignItems: 'center', gap: 3,
                                      }}
                                    >
                                      <IconReplyArrow size={10} />
                                      {rReplying ? 'Cancel' : 'Reply'}
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => shareOrCopyComment(r.id)}
                                    title={desktopCopy ? 'Copy link to this comment' : 'Share this comment'}
                                    style={{
                                      background: 'none', border: 'none', padding: 0,
                                      fontSize: 10, fontWeight: 800, color: '#94a3b8', cursor: 'pointer',
                                      fontFamily: 'inherit',
                                      display: 'inline-flex', alignItems: 'center', gap: 3,
                                    }}
                                  >
                                    {desktopCopy ? <IconCopy size={10} /> : <IconShare size={10} />}
                                    {desktopCopy ? 'Copy link' : 'Share'}
                                  </button>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {currentUserId && (
              <div>
                {replyToComment && (
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '6px 12px', marginBottom: 4,
                    background: 'rgba(26,122,74,0.08)', borderRadius: 10,
                    fontSize: 12, color: GREEN, fontWeight: 800,
                  }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <IconReplyArrow size={12} />
                      Replying to {replyToComment.name}
                    </span>
                    <button
                      type="button"
                      onClick={() => { setReplyToComment(null); setCommentText('') }}
                      style={{ background: 'none', border: 'none', padding: 0, color: '#94a3b8', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}
                    >
                      Cancel
                    </button>
                  </div>
                )}
                {/* Media preview */}
                {commentMediaPreview && (
                  <div style={{
                    position: 'relative', marginBottom: 6,
                    borderRadius: 8, overflow: 'hidden', maxWidth: 120,
                  }}>
                    <img src={commentMediaPreview} alt="" style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8 }} />
                    <button
                      type="button"
                      onClick={() => { setCommentMediaFile(null); setCommentMediaPreview(null) }}
                      style={{
                        position: 'absolute', top: 2, right: 2, width: 22, height: 22, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: 12, lineHeight: 1,
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  background: '#f8fafc', border: '1.5px solid #e2e8f0',
                  borderRadius: 999, padding: '6px 8px 6px 12px',
                }}>
                  <input
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleCommentSubmit()}
                    placeholder={replyToComment ? `Reply to ${replyToComment.name}…` : 'Write a comment…'}
                    maxLength={400}
                    style={{
                      flex: 1, border: 'none', outline: 'none', background: 'transparent',
                      fontSize: 13, color: '#0f172a', fontFamily: 'inherit',
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => commentFileRef.current?.click()}
                    style={{
                      width: 30, height: 30, borderRadius: '50%', border: 'none',
                      background: 'transparent', color: '#94a3b8', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, lineHeight: 1, flexShrink: 0,
                    }}
                    aria-label="Attach image"
                  >
                    🖼
                  </button>
                  <button
                    type="button"
                    onClick={handleCommentSubmit}
                    disabled={(!commentText.trim() && !commentMediaFile) || commentSending}
                    style={{
                      width: 36, height: 36, borderRadius: '50%', border: 'none',
                      background: (commentText.trim() || commentMediaFile) ? GREEN : '#e2e8f0',
                      color: (commentText.trim() || commentMediaFile) ? '#fff' : '#94a3b8',
                      cursor: (commentText.trim() || commentMediaFile) ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <IconSend size={15} />
                  </button>
                </div>
                <input
                  ref={commentFileRef}
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    setCommentMediaFile(file)
                    setCommentMediaPreview(URL.createObjectURL(file))
                    e.target.value = ''
                  }}
                />
              </div>
            )}
          </Sheet>
        )}

        {/* ── Share sheet ── */}
        {shareUrl && (
          <Sheet onClose={() => { setShareUrl(null); setPaused(false) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(26,122,74,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Share2 size={16} />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Share status</div>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Copy link to send</div>
              </div>
            </div>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#f8fafc', border: '1.5px solid #e2e8f0',
              borderRadius: 14, padding: '10px 12px',
            }}>
              <div style={{
                flex: 1, fontSize: 12, color: '#475569',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {shareUrl}
              </div>
              <button
                type="button"
                onClick={copyShare}
                style={{
                  background: GREEN, border: 'none', borderRadius: 10,
                  padding: '8px 14px', fontSize: 12, fontWeight: 800, color: '#fff',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                  fontFamily: 'inherit', flexShrink: 0,
                }}
              >
                <IconCopy size={13} />
                {copyOk ? 'Copied' : 'Copy'}
              </button>
            </div>
          </Sheet>
        )}

        {/* ── Viewers sheet ── */}
        {showViewers && (
          <Sheet onClose={closeViewers} maxHeight="78vh">
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Eye size={16} />
              {viewCount} {viewCount === 1 ? 'view' : 'views'}
            </div>
            <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>
              People who viewed this status
                </div>
              </div>
              <button
                type="button"
                onClick={closeViewers}
                style={{
                  width: 34, height: 34, borderRadius: '50%', border: 'none',
                  background: '#f1f5f9', color: '#64748b', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#f8fafc', border: '1.5px solid #e2e8f0',
              borderRadius: 999, padding: '9px 14px', marginBottom: 10,
            }}>
              <span style={{ color: '#94a3b8', display: 'flex' }}><Search size={14} /></span>
              <input
                value={viewerSearch}
                onChange={e => setViewerSearch(e.target.value)}
                placeholder="Search viewers…"
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  fontSize: 13, color: '#0f172a', fontFamily: 'inherit',
                }}
              />
            </div>

            <div className="sv-hide-scroll" style={{ overflowY: 'auto', maxHeight: '52vh' }}>
              {viewersLoading ? (
                <div style={{ padding: 28, textAlign: 'center', color: '#94a3b8', fontSize: 13, fontWeight: 600 }}>
                  Loading…
                </div>
              ) : filteredViewers.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: '#64748b' }}>
                    {viewerSearch ? 'No match' : 'No views yet'}
                  </div>
                </div>
              ) : filteredViewers.map((v, i) => {
                const vname = v.viewer?.full_name || 'Unknown'
                const vavatar = v.viewer?.avatar_url
                const vinitials = vname.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <div key={v.viewer?.id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '10px 2px',
                    borderBottom: '1px solid #f1f5f9',
                  }}>
                    <div style={{
                      width: 42, height: 42, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                      background: `linear-gradient(135deg,${GREEN},#22c55e)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 13, fontWeight: 700, color: '#fff',
                    }}>
                      {vavatar
                        ? <img src={vavatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : vinitials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{vname}</div>
                      <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, marginTop: 1 }}>
                        {timeAgoFn(v.viewed_at)}
                      </div>
                    </div>
                    {v.viewer?.id && (
                      <button
                        type="button"
                        onClick={() => {
                          closeViewers()
                          onClose?.()
                          navigate('/chat/' + v.viewer.id)
                        }}
                        style={{
                          background: 'rgba(26,122,74,0.1)', border: '1px solid rgba(26,122,74,0.25)',
                          borderRadius: 999, padding: '6px 12px',
                          fontSize: 11, fontWeight: 800, color: GREEN, cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        Chat
                      </button>
                    )}
                  </div>
                )
              })}
            </div>
          </Sheet>
        )}
      </div>
    </>
  )
}

function MenuItem({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '12px 14px', fontSize: 13, fontWeight: 700, color: '#f1f5f9',
        cursor: 'pointer', fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}

function Sheet({ children, onClose, maxHeight = 'auto' }) {
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 430, maxHeight,
          background: '#fff',
          borderRadius: '22px 22px 0 0',
          padding: '14px 16px calc(22px + env(safe-area-inset-bottom, 0px))',
          boxShadow: '0 -12px 40px rgba(0,0,0,0.2)',
          animation: 'svSheet 0.28s cubic-bezier(0.32,0.72,0,1)',
        }}
      >
        <div style={{
          width: 36, height: 4, borderRadius: 2, background: '#e2e8f0',
          margin: '0 auto 14px',
        }} />
        {children}
      </div>
    </div>
  )
}

const iconBtnStyle = {
  width: 36, height: 36, borderRadius: '50%',
  background: 'transparent', border: 'none',
  color: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  textShadow: '0 1px 4px rgba(0,0,0,0.5)',
  filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.45))',
}
