import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import StatusCommentsPanel from './StatusComments'
import { useStatusComments } from '../hooks/useStatusComments'
import { isStatusVideoUrl, parseClipWindow } from '../utils/statusVideo'

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
function IconTrash({ size = 16, color = '#fff' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    </svg>
  )
}
function IconVideoBadge({ label }) {
  return (
    <span style={{
      background: '#e8f5e9', color: '#166534',
      fontSize: 10, fontWeight: 800, letterSpacing: 0.4,
      padding: '3px 7px', borderRadius: 8, flexShrink: 0, textTransform: 'uppercase',
    }}>
      {label}
    </span>
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
  return /^https?:\/\//i.test(url) || url.startsWith('/')
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
  if (url.startsWith('blob:') || url.startsWith('data:')) {
    onProgress?.(100)
    return { blobUrl: url, kind: isVideoUrl(url) ? 'video' : 'image' }
  }
  if (mediaBlobCache.has(url)) {
    onProgress?.(100)
    return mediaBlobCache.get(url)
  }
  if (mediaInflight.has(url)) {
    const cached = await mediaInflight.get(url)
    onProgress?.(100)
    return cached
  }

  const task = (async () => {
    onProgress?.(2)
    const kindGuess = isVideoUrl(url) ? 'video' : 'image'

    // Prefer full fetch with byte progress (CORS required)
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache' })
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
  const [localStories, setLocalStories] = useState(stories || [])
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
  // Owner actions: edit caption / delete status
  const [showEditCaption, setShowEditCaption] = useState(false)
  const [editCaption, setEditCaption] = useState('')
  const [savingCaption, setSavingCaption] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  // Stream media immediately (no “downloading…” gate)
  const [mediaReady, setMediaReady] = useState(false)
  const [mediaSrc, setMediaSrc] = useState(null)
  const [mediaKind, setMediaKind] = useState('image')  // image | video | none | text
  const [mediaError, setMediaError] = useState(null)
  const [toast, setToast] = useState('')
  const [muted, setMuted] = useState(false)
  const [captionExpanded, setCaptionExpanded] = useState(false)

  const timerRef = useRef()
  const holdRef = useRef()
  const toastRef = useRef()
  const mediaGenRef = useRef(0)
  const videoRef = useRef(null)
  const clipRef = useRef(null) // #t=start,end window of the current video (meta trims)
  const activeBarRef = useRef(null)
  const rafRef = useRef(null)
  const loggedViewsRef = useRef(new Set())
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

  const commentsApi = useStatusComments({ story, currentUserId, notify: showToast, preload: true })
  const {
    commentCount: replyCount,
    open: showReplies,
    myAvatar,
  } = commentsApi

  const [replyText, setReplyText] = useState('')
  // eslint-disable-next-line react-hooks/set-state-in-effect -- reset quick-reply text on status change
  useEffect(() => { setReplyText('') }, [story?.id])

  async function handleReply() {
    const ok = await commentsApi.postComment({ body: replyText })
    if (ok) setReplyText('')
  }

  const QUICK_EMOJIS = ['👍', '🔥', '😍', '💰', '🙏', '🎉']

  async function sendQuickEmoji(emoji) {
    if (commentsApi.posting) return
    await commentsApi.postComment({ body: emoji })
  }

  function openReplies() {
    setPaused(true)
    commentsApi.openComments()
  }
  function closeReplies() {
    setPaused(false)
    commentsApi.closeComments()
  }

  // ── Owner actions: edit caption / delete status ────────────────────────────
  function openEditCaption() {
    setShowMenu(false)
    setEditCaption(story?.content || '')
    setShowEditCaption(true)
    setPaused(true)
  }

  async function saveCaption() {
    if (!story?.id || savingCaption) return
    setSavingCaption(true)
    const next = editCaption.trim().slice(0, 180)
    const { error } = await supabase
      .from('user_statuses')
      .update({ content: next })
      .eq('id', story.id)
    setSavingCaption(false)
    if (error) {
      showToast('Could not save caption — try again')
      return
    }
    setLocalStories(prev => prev.map(s => (s.id === story.id ? { ...s, content: next } : s)))
    setShowEditCaption(false)
    setPaused(false)
    showToast('Caption updated')
  }

  function openDeleteConfirm() {
    setShowMenu(false)
    setShowDeleteConfirm(true)
    setPaused(true)
  }

  /** Best-effort cleanup of uploaded media files after a status is deleted. */
  function cleanupStatusMedia(s) {
    try {
      const urls = (s?.media_urls || []).filter(u => u && /^https?:\/\//i.test(u))
      const byBucket = new Map()
      for (const url of urls) {
        const m = String(url).match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+?)(?:[?#].*)?$/)
        if (!m) continue
        if (!byBucket.has(m[1])) byBucket.set(m[1], [])
        byBucket.get(m[1]).push(m[2])
      }
      for (const [bucket, paths] of byBucket) {
        supabase.storage.from(bucket).remove(paths).then(() => {}).catch(() => {})
      }
    } catch { /* ignore */ }
  }

  async function confirmDelete() {
    if (!story?.id || deleting) return
    setDeleting(true)
    const id = story.id
    const target = story
    const { error } = await supabase
      .from('user_statuses')
      .delete()
      .eq('id', id)
    setDeleting(false)
    if (error) {
      showToast('Delete failed — try again')
      return
    }
    cleanupStatusMedia(target)
    const remaining = localStories.filter(s => s.id !== id)
    setShowDeleteConfirm(false)
    setPaused(false)
    if (!remaining.length) {
      onClose?.()
      return
    }
    setLocalStories(remaining)
    setMediaIdx(0)
    setIdx(i => Math.min(i, remaining.length - 1))
    showToast('Status deleted')
  }

  useEffect(() => {
    setLocalStories(stories || [])
    setIdx(startIndex || 0)
    setMediaIdx(0)
  }, [stories, startIndex])

  // Reset UI when story changes
  useEffect(() => {
    setMediaIdx(0)
    setShowMenu(false)
    setMuted(false)
    setShowEditCaption(false)
    setShowDeleteConfirm(false)
    setCaptionExpanded(false)
  }, [story?.id])

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

    // Meta-trimmed videos carry a #t=start,end window. Keep it: cached blob
    // URLs lose the fragment, so re-attach it and also enforce it via JS below.
    const clip = kind === 'video' ? parseClipWindow(remote) : null
    clipRef.current = clip

    // Prefer cached blob if we already have it; otherwise stream remote URL
    const cached = mediaBlobCache.get(remote)
    let src = cached?.blobUrl || remote
    if (src && clip?.end != null && !String(src).includes('#t=')) {
      src = `${String(src).split('#')[0]}#t=${clip.start.toFixed(3)},${clip.end.toFixed(3)}`
    }
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
      // Meta-trimmed clips play only [clipStart, clipEnd] of the file
      const clip = clipRef.current
      const clipStart = clip ? clip.start : 0
      const clipEnd = clip?.end != null ? clip.end : null

      function finish() {
        if (done) return
        done = true
        setProgress(100)
        advance()
      }

      function tick() {
        if (done) return
        const fullDur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : VIDEO_FALLBACK_MS / 1000
        const end = clipEnd != null ? Math.min(clipEnd, Number.isFinite(v.duration) && v.duration > 0 ? v.duration : clipEnd) : fullDur
        const windowLen = Math.max(0.001, end - clipStart)
        const p = Math.min(100, Math.max(0, ((v.currentTime - clipStart) / windowLen) * 100))
        if (activeBarRef.current) activeBarRef.current.style.width = `${p}%`

        // Advance when the clip window ends — covers browsers that pause
        // without firing 'ended', and browsers that ignore the fragment end.
        if (clipEnd != null && v.currentTime >= end - 0.02) {
          finish()
          return
        }

        if (Date.now() - start >= VIDEO_MAX_MS) {
          finish()
          return
        }
        rafRef.current = requestAnimationFrame(tick)
      }

      function onEnded() {
        finish()
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
          profiles:user_id ( id, full_name, avatar_url, city ),
          tagged:tagged_listing_id ( id, title, price, images, category, description, city, district, is_featured, promoted_until )`)
        .eq('user_id', nextStory.user_id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      if (data && data.length > 1) {
        try {
          const { hydrateStatusTags } = await import('../hooks/useStatuses')
          data = await hydrateStatusTags(data)
        } catch { /* ignore */ }
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
    navigator.clipboard?.writeText(shareUrl).then(done).catch(() => {
      const el = document.createElement('textarea')
      el.value = shareUrl
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      done()
    })
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

  function onPointerDown() {
    clearTimeout(holdRef.current)
    holdRef.current = setTimeout(() => setPaused(true), 140)
  }
  function onPointerUp() {
    clearTimeout(holdRef.current)
    if (!showViewers && !shareUrl && !showMenu && !showReplies) setPaused(false)
  }

  if (!story) return null

  const name = story.profiles?.full_name || 'Seller'
  const avatar = story.profiles?.avatar_url
  const initial = (name[0] || 'S').toUpperCase()
  const isOwn = !!currentUserId && !!story?.user_id && String(story.user_id) === String(currentUserId)
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
  const kindLabel = ({
    listing: 'Product',
    job: 'Job',
    service: 'Service',
    shop: 'Shop',
    request: 'Looking for',
  })[taggedKind] || 'Tagged'

  // Caption shown on the media — skip auto-generated placeholders ("Photo update")
  const statusCaption = (() => {
    const raw = String(story.content || '').replace(/\s+/g, ' ').trim()
    if (!raw || /^(photo|video|status) update$/i.test(raw)) return null
    return raw
  })()
  const captionIsLong = !!statusCaption && statusCaption.length > 80

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

  // Check if product is actually featured and not expired
  const isFeatured = tagged && tagged.is_featured && (
    !tagged.promoted_until || new Date(tagged.promoted_until) > new Date()
  )

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
        .sv-tap:active { opacity: 0.85; }
        .sv-hide-scroll::-webkit-scrollbar { display: none; }
        #sv-reply-input::placeholder { color: rgba(255,255,255,0.65); }
      `}</style>

      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 998,
          background: '#000',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          userSelect: 'none',
          display: 'flex',
          justifyContent: 'center',
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <div style={{
          position: 'relative',
          width: '100%',
          maxWidth: 430,
          height: '100%',
          background: '#000',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* ════════ MEDIA STAGE ════════ */}
          <div style={{ position: 'relative', flex: 1, minHeight: 0, background: '#0a0a0a' }}>
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
                onLoadedMetadata={() => {
                  // Enforce the clip window start even when the src lost its
                  // #t= fragment (e.g. playing from a cached blob URL).
                  const clip = clipRef.current
                  const el = videoRef.current
                  if (clip && el && Math.abs((el.currentTime || 0) - clip.start) > 0.35) {
                    try { el.currentTime = clip.start } catch { /* ignore */ }
                  }
                }}
                onLoadedData={() => setMediaReady(true)}
                onCanPlay={() => setMediaReady(true)}
                onError={() => {
                  // Never surface an error card for video — just keep the element
                  // mounted (shows last good frame / poster) and let the retry below run.
                  setMediaReady(false)
                }}
                style={{
                  width: '100%', height: '100%', objectFit: 'contain', display: 'block',
                  background: '#000',
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
              display: 'flex', gap: 3,
              padding: '10px 12px 0',
              paddingTop: 'max(10px, env(safe-area-inset-top, 10px))',
            }}>
              {Array.from({ length: barCount }).map((_, i) => (
                <div key={i} style={{
                  flex: 1, height: 2.5, borderRadius: 99,
                  background: 'rgba(255,255,255,0.28)', overflow: 'hidden',
                }}>
                  <div
                    ref={i === barActive ? activeBarRef : null}
                    style={{
                      height: '100%', borderRadius: 99, background: '#fff',
                      width: i < barActive ? '100%' : i === barActive ? `${progress}%` : '0%',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* ── Header ── */}
            <div style={{
              position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '18px 12px 0',
              paddingTop: 'max(22px, calc(env(safe-area-inset-top, 8px) + 14px))',
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
                  display: 'flex', alignItems: 'center', gap: 9,
                  background: 'none', border: 'none', padding: 0,
                  cursor: 'pointer', flex: 1, minWidth: 0, textAlign: 'left',
                }}
              >
                <div style={{
                  width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                  border: '2px solid rgba(255,255,255,0.95)',
                  overflow: 'hidden',
                  background: `linear-gradient(135deg,${GREEN},#22c55e)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 800, color: '#fff',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.35)',
                }}>
                  {avatar
                    ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initial}
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{
                      fontSize: 14, fontWeight: 800, color: '#fff',
                      textShadow: '0 1px 4px rgba(0,0,0,0.5)',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      maxWidth: 160,
                    }}>
                      {isOwn ? 'Your status' : name}
                    </span>
                    <IconVerified size={14} />
                  </div>
                  <div style={{
                    fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600,
                    marginTop: 1, textShadow: '0 1px 3px rgba(0,0,0,0.45)',
                  }}>
                    {createdAgo}
                  </div>
                </div>
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
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
                  style={iconBtnStyle}
                >
                  <IconMore />
                </button>
                <button
                  type="button"
                  className="sv-tap"
                  onPointerDown={e => e.stopPropagation()}
                  onPointerUp={e => { e.stopPropagation(); onClose?.() }}
                  aria-label="Close"
                  style={iconBtnStyle}
                >
                  <IconClose />
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
                {isOwn && story && (
                  <MenuItem label="Edit caption" onClick={openEditCaption} />
                )}
                {isOwn && story && (
                  <MenuItem label="Delete status" danger onClick={() => openDeleteConfirm()} />
                )}
                <MenuItem label="Share status" onClick={() => { setShowMenu(false); openShare() }} />
                <MenuItem label="View profile" onClick={() => { setShowMenu(false); onClose?.(); navigate(`/profile/${story.user_id}`) }} />
                <MenuItem label="Close" onClick={() => { setShowMenu(false); setPaused(false) }} />
              </div>
            )}

            {/* FEATURED badge */}
            {isFeatured && (
              <div style={{
                position: 'absolute', left: 14, top: 78, zIndex: 20,
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
                position: 'absolute', right: 14, top: 78, zIndex: 20,
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
                  top: mediaCount > 1 ? 116 : 78,
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

            {/* Caption now lives inside the bottom chrome (stacked above the
                engagement row) so it never collides with the action bar */}

            {/* Tap zones — full height, chrome now floats over the media */}
            <div
              onPointerUp={e => {
                e.stopPropagation()
                clearTimeout(holdRef.current)
                setPaused(false)
                goBack()
              }}
              style={{ position: 'absolute', left: 0, top: 70, bottom: 0, width: '32%', zIndex: 12 }}
            />
            <div
              onPointerUp={e => {
                e.stopPropagation()
                clearTimeout(holdRef.current)
                setPaused(false)
                advance()
              }}
              style={{ position: 'absolute', right: 0, top: 70, bottom: 0, width: '32%', zIndex: 12 }}
            />

            {/* ════════ FLOATING BOTTOM CHROME — overlaid on media, WhatsApp/IG style ════════ */}
            <div
              onPointerDown={e => e.stopPropagation()}
              onPointerUp={e => e.stopPropagation()}
              style={{
                position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 25,
                background: 'linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.6) 40%, rgba(0,0,0,0.15) 80%, transparent 100%)',
                padding: '30px 14px calc(12px + env(safe-area-inset-bottom, 0px))',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {/* Tagged product / entity card — now stacks naturally above the actions below */}
              {tagged && mediaReady && !mediaError && (
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
              )}

              {/* Caption — IG-style chip stacked above the engagement row */}
              {mediaReady && statusCaption && media0 && !isTextOnlyStage && (
                <div
                  role={captionIsLong ? 'button' : undefined}
                  onClick={captionIsLong ? () => setCaptionExpanded(v => !v) : undefined}
                  style={{
                    background: 'rgba(0,0,0,0.38)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.09)',
                    borderRadius: 13,
                    padding: '9px 12px',
                    cursor: captionIsLong ? 'pointer' : 'default',
                    maxWidth: '100%',
                    transition: 'background 0.2s ease',
                  }}
                >
                  <p style={{
                    margin: 0,
                    fontSize: 13.5, fontWeight: 600, lineHeight: 1.45,
                    color: 'rgba(255,255,255,0.97)',
                    textShadow: '0 1px 3px rgba(0,0,0,0.65)',
                    wordBreak: 'break-word',
                    display: '-webkit-box',
                    WebkitLineClamp: captionExpanded ? 12 : 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}>
                    {statusCaption}
                  </p>
                  {captionIsLong && (
                    <span style={{
                      display: 'inline-block', marginTop: 2,
                      fontSize: 11.5, fontWeight: 800, letterSpacing: 0.3,
                      color: 'rgba(255,255,255,0.55)',
                    }}>
                      {captionExpanded ? 'less' : 'more'}
                    </span>
                  )}
                </div>
              )}

              {/* Action row — TikTok style: emoji + reply on the left, vertical like/comment/share rail on the right */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>

              {/* CTA — owner only; buyers reply via the reply bar below */}
              {isOwn && (
                <button
                  type="button"
                  className="sv-tap"
                  onClick={openViewers}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.14)',
                    border: '1.5px solid rgba(255,255,255,0.3)',
                    backdropFilter: 'blur(8px)',
                    borderRadius: 999,
                    padding: '11px',
                    fontSize: 13, fontWeight: 800, color: '#fff',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    fontFamily: 'inherit',
                  }}
                >
                  <IconEye size={15} />
                  {fmtK(viewCount)} {viewCount === 1 ? 'view' : 'views'} · See who viewed
                </button>
              )}

              {/* Quick emoji reactions — compact row fitted beside the action rail */}
              {!isOwn && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'nowrap', overflow: 'hidden' }}>
                  {QUICK_EMOJIS.map(e => (
                    <button
                      key={e}
                      type="button"
                      className="sv-tap"
                      onClick={() => sendQuickEmoji(e)}
                      disabled={commentsApi.posting}
                      aria-label={`React ${e}`}
                      style={{
                        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                        border: '1.5px solid rgba(255,255,255,0.22)',
                        background: 'rgba(255,255,255,0.12)',
                        backdropFilter: 'blur(8px)',
                        fontSize: 16, lineHeight: 1,
                        cursor: commentsApi.posting ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        padding: 0, fontFamily: 'inherit',
                        opacity: commentsApi.posting ? 0.55 : 1,
                        transition: 'transform 0.12s, background 0.15s',
                      }}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              )}

              {/* Reply bar */}
              {!isOwn && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(255,255,255,0.14)',
                  backdropFilter: 'blur(8px)',
                  borderRadius: 999,
                  padding: '6px 8px 6px 6px',
                  border: '1.5px solid rgba(255,255,255,0.25)',
                }}>
                  <div style={{
                    width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
                    overflow: 'hidden',
                    background: `linear-gradient(135deg,${GREEN},#22c55e)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, color: '#fff',
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
                    onBlur={() => { if (!shareUrl && !showViewers && !showMenu && !showReplies) setPaused(false) }}
                    onKeyDown={e => e.key === 'Enter' && handleReply()}
                    placeholder="Reply to status…"
                    maxLength={400}
                    style={{
                      flex: 1, border: 'none', outline: 'none', background: 'transparent',
                      fontSize: 14, color: '#fff', fontFamily: 'inherit', minWidth: 0,
                    }}
                  />
                  <button
                    type="button"
                    className="sv-tap"
                    onClick={handleReply}
                    disabled={!replyText.trim() || commentsApi.posting}
                    aria-label="Send reply"
                    style={{
                      width: 34, height: 34, borderRadius: '50%', border: 'none',
                      background: replyText.trim() ? GREEN : 'transparent',
                      color: replyText.trim() ? '#fff' : 'rgba(255,255,255,0.5)',
                      cursor: replyText.trim() && !commentsApi.posting ? 'pointer' : 'default',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                      opacity: commentsApi.posting ? 0.7 : 1,
                    }}
                  >
                    <IconSend size={17} />
                  </button>
                </div>
              )}
                </div>

                {/* Vertical action rail — TikTok-style like / comment / share */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <button
                      type="button"
                      className="sv-tap"
                      onClick={handleLove}
                      disabled={reacting || isOwn}
                      aria-label="Like status"
                      style={{
                        width: 44, height: 44, borderRadius: '50%', padding: 0,
                        border: '1.5px solid rgba(255,255,255,0.28)',
                        background: myReaction === 'love' ? 'rgba(234,67,53,0.28)' : 'rgba(255,255,255,0.14)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: isOwn ? 'default' : 'pointer',
                      }}
                    >
                      <IconHeart size={22} filled={myReaction === 'love'} />
                    </button>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                      {fmtK(loveCount)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <button
                      type="button"
                      className="sv-tap"
                      onClick={openReplies}
                      aria-label="View comments"
                      style={{
                        width: 44, height: 44, borderRadius: '50%', padding: 0,
                        border: '1.5px solid rgba(255,255,255,0.28)',
                        background: 'rgba(255,255,255,0.14)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <IconComment size={21} color="#fff" />
                    </button>
                    <span style={{ fontSize: 11.5, fontWeight: 800, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                      {fmtK(replyCount)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <button
                      type="button"
                      className="sv-tap"
                      onClick={openShare}
                      aria-label="Share status"
                      style={{
                        width: 44, height: 44, borderRadius: '50%', padding: 0,
                        border: '1.5px solid rgba(255,255,255,0.28)',
                        background: 'rgba(255,255,255,0.14)',
                        backdropFilter: 'blur(8px)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                      }}
                    >
                      <IconShare size={20} color="#fff" />
                    </button>
                    <span style={{ fontSize: 10.5, fontWeight: 800, color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 4px rgba(0,0,0,0.5)' }}>
                      Share
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Toast — reply sent confirmation */}
          {toast && (
            <div style={{
              position: 'absolute', left: '50%', bottom: 110, zIndex: 50,
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

        {/* ── Comments sheet (message icon) ── */}
        {showReplies && (
          <Sheet onClose={closeReplies} maxHeight="78vh">
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              marginBottom: 12,
            }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <IconComment size={16} />
                  {replyCount} {replyCount === 1 ? 'comment' : 'comments'}
                </div>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600, marginTop: 2 }}>
                  {isOwn ? 'Comments on your status' : 'Comments on this status'}
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
                <IconClose size={15} />
              </button>
            </div>

            <div className="sv-hide-scroll" style={{ overflowY: 'auto', maxHeight: '56vh', marginBottom: 10, background: '#f8fafc', borderRadius: 12, padding: '10px 8px' }}>
              <StatusCommentsPanel
                api={commentsApi}
                story={story}
                currentUserId={currentUserId}
                onOpenChat={uid => {
                  closeReplies()
                  onClose?.()
                  navigate('/chat/' + uid)
                }}
              />
            </div>
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
                <IconShare size={16} />
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

        {/* ── Edit caption sheet (owner) ── */}
        {showEditCaption && story && (
          <Sheet onClose={() => { setShowEditCaption(false); setPaused(false) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(26,122,74,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Edit caption</div>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>Changes show instantly on your status</div>
              </div>
            </div>
            <div style={{ position: 'relative', marginBottom: 8 }}>
              <textarea
                value={editCaption}
                onChange={e => setEditCaption(e.target.value.slice(0, 180))}
                placeholder="Price drop, still available, meet today…"
                rows={4}
                autoFocus
                style={{
                  width: '100%', resize: 'none',
                  border: '1.5px solid #e2e8f0', borderRadius: 12,
                  padding: '10px 12px', fontSize: 14, color: '#0f172a',
                  fontFamily: 'inherit', outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
              <span style={{
                position: 'absolute', right: 10, bottom: 8,
                fontSize: 10, fontWeight: 700, color: '#94a3b8',
                background: 'rgba(255,255,255,0.9)', padding: '1px 5px', borderRadius: 6,
              }}>
                {editCaption.length}/180
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                onClick={() => { setShowEditCaption(false); setPaused(false) }}
                style={{
                  flex: 1, padding: '11px 12px', borderRadius: 12,
                  border: '1.5px solid #e2e8f0', background: '#fff',
                  fontSize: 13, fontWeight: 700, color: '#475569',
                  cursor: 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={saveCaption}
                disabled={savingCaption}
                style={{
                  flex: 1, padding: '11px 12px', borderRadius: 12, border: 'none',
                  background: savingCaption ? '#cbd5e1' : GREEN,
                  fontSize: 13, fontWeight: 800, color: '#fff',
                  cursor: savingCaption ? 'default' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {savingCaption ? 'Saving…' : 'Save caption'}
              </button>
            </div>
          </Sheet>
        )}

        {/* ── Delete confirm sheet (owner) ── */}
        {showDeleteConfirm && story && (
          <Sheet onClose={() => { if (!deleting) { setShowDeleteConfirm(false); setPaused(false) } }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: 'rgba(239,68,68,0.12)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <IconTrash size={16} color="#ef4444" />
              </div>
              <div>
                <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Delete this status?</div>
                <div style={{ fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>It disappears for everyone, immediately</div>
              </div>
            </div>
            <div style={{
              background: '#f8fafc', border: '1px solid #eef2f7', borderRadius: 12,
              padding: '10px 12px', fontSize: 13, color: '#334155', fontWeight: 600,
              marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8,
            }}>
              {(story.media_urls || []).some(m => m && isVideoUrl(m))
                ? <IconVideoBadge label="Video status" />
                : (story.media_urls || []).some(m => m && isRemoteMediaUrl(m) && !isColorUrl(m))
                  ? <IconVideoBadge label="Photo status" />
                  : <IconVideoBadge label="Text status" />}
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {story.content || 'No caption'}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                disabled={deleting}
                onClick={() => { setShowDeleteConfirm(false); setPaused(false) }}
                style={{
                  flex: 1, padding: '11px 12px', borderRadius: 12,
                  border: '1.5px solid #e2e8f0', background: '#fff',
                  fontSize: 13, fontWeight: 700, color: deleting ? '#94a3b8' : '#475569',
                  cursor: deleting ? 'default' : 'pointer', fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={deleting}
                style={{
                  flex: 1, padding: '11px 12px', borderRadius: 12, border: 'none',
                  background: deleting ? '#fca5a5' : '#ef4444',
                  fontSize: 13, fontWeight: 800, color: '#fff',
                  cursor: deleting ? 'default' : 'pointer', fontFamily: 'inherit',
                }}
              >
                {deleting ? 'Deleting…' : 'Delete status'}
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
                  <IconEye size={16} />
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
                <IconClose size={15} />
              </button>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: '#f8fafc', border: '1.5px solid #e2e8f0',
              borderRadius: 999, padding: '9px 14px', marginBottom: 10,
            }}>
              <span style={{ color: '#94a3b8', display: 'flex' }}><IconSearch size={14} /></span>
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

function MenuItem({ label, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        background: 'none', border: 'none', borderBottom: '1px solid rgba(255,255,255,0.06)',
        padding: '12px 14px', fontSize: 13, fontWeight: 700,
        color: danger ? '#f87171' : '#f1f5f9',
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
