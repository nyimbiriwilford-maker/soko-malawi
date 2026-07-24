/**
 * StatusUploadModal — modern story status uploader
 * Photo/video or text board + tag your marketplace products.
 */
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import ProductTagPicker, { loadOwnerTagItems } from './ProductTagPicker'
import StatusLocationField from './StatusLocationField'
import StatusMediaAnnotator from './StatusMediaAnnotator'
import {
  STATUS_VIDEO_MAX_SECONDS,
  STATUS_VIDEO_LENGTH_PRESETS,
  trimStatusVideo,
  formatDurationLabel,
  getVideoDuration,
  getPreferredClipSeconds,
  setPreferredClipSeconds,
  getClipLengthOptions,
} from '../utils/statusVideo'

const BG_COLORS = [
  '#0f766e', '#1e3a8a', '#0f172a', '#7c3aed',
  '#b91c1c', '#c2410c', '#059669', '#db2777',
]

const QUICK_EMOJIS = ['🔥', '✨', '⚡', '📦', '🛒', '🌽', '✅', '💬', '📍', '🇲🇼']

const G = '#1a7a4a'

// ─── Icons ───────────────────────────────────────────────────────────────────
function IconClose({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}
function IconCamera({ size = 22, color = G }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}
function IconImage({ size = 22, color = G }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  )
}
function IconVideo({ size = 22, color = G }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="5" width="14" height="14" rx="2" />
      <path d="M16 10l6-3v10l-6-3V10z" />
    </svg>
  )
}
function IconText({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 7V5h16v2" />
      <path d="M12 5v14" />
      <path d="M8 19h8" />
    </svg>
  )
}
function IconMedia({ size = 18, color = 'currentColor' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  )
}
function IconClock({ size = 14, color = '#94a3b8' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
function IconSend({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  )
}
function IconSpark({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
    </svg>
  )
}
function IconSpinner({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'suSpin 0.7s linear infinite' }} aria-hidden>
      <path d="M12 3a9 9 0 1 1-6.36 2.64" />
    </svg>
  )
}
function IconTrash({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" />
      <path d="M8 6V4h8v2" />
      <path d="M19 6l-1 14H6L5 6" />
    </svg>
  )
}

export default function StatusUploadModal({ user, onClose, onSuccess }) {
  const [tab, setTab] = useState('media') // media | text
  const [caption, setCaption] = useState('')
  const [location, setLocation] = useState(user?.city || user?.district || '')
  const [bgColor, setBgColor] = useState(BG_COLORS[0])
  const [mediaFile, setMediaFile] = useState(null)       // ready-to-upload (trimmed or short)
  const [sourceFile, setSourceFile] = useState(null)     // original video for re-trim
  const [mediaPreview, setMediaPreview] = useState('')
  const [mediaType, setMediaType] = useState('image')
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [isTrimming, setIsTrimming] = useState(false)
  const [trimPct, setTrimPct] = useState(0)
  const [trimNote, setTrimNote] = useState('')
  const [sourceDuration, setSourceDuration] = useState(null) // original video length
  // User trim preferences
  const [clipSeconds, setClipSeconds] = useState(() => getPreferredClipSeconds())
  const [clipStart, setClipStart] = useState(0)
  const [trimDirty, setTrimDirty] = useState(false) // prefs changed since last apply
  const [tagItems, setTagItems] = useState([])
  const [taggedId, setTaggedId] = useState(null)
  const [taggedKind, setTaggedKind] = useState(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [showAnnotator, setShowAnnotator] = useState(false)
  const [overlayFile, setOverlayFile] = useState(null) // PNG marks for video
  const [annotateNote, setAnnotateNote] = useState('')
  const fileInputRef = useRef(null)
  const cameraInputRef = useRef(null)
  const trimGenRef = useRef(0)
  const videoPreviewRef = useRef(null)

  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    loadOwnerTagItems(supabase, user.id).then((items) => {
      if (!cancelled) setTagItems(items)
    })
    return () => { cancelled = true }
  }, [user?.id])

  // Revoke object URL on change/unmount
  useEffect(() => {
    return () => {
      if (mediaPreview?.startsWith?.('blob:')) URL.revokeObjectURL(mediaPreview)
    }
  }, [mediaPreview])

  const lengthOptions = sourceDuration != null
    ? getClipLengthOptions(sourceDuration)
    : STATUS_VIDEO_LENGTH_PRESETS.filter(s => s <= STATUS_VIDEO_MAX_SECONDS)

  const maxStart = sourceDuration != null
    ? Math.max(0, Math.floor((sourceDuration - clipSeconds) * 10) / 10)
    : 0

  async function handleFileChange(file) {
    if (!file) return
    setErrorMsg('')
    setTrimNote('')
    setSourceDuration(null)
    setClipStart(0)
    setTrimDirty(false)
    setSourceFile(null)
    setOverlayFile(null)
    setAnnotateNote('')
    setShowAnnotator(false)

    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      setErrorMsg('Please choose a photo or video')
      return
    }

    if (file.type.startsWith('image/') && file.size > 15 * 1024 * 1024) {
      setErrorMsg('Photo must be under 15MB')
      return
    }

    if (file.type.startsWith('video/') && file.size > 80 * 1024 * 1024) {
      setErrorMsg('Video is too large (max 80MB). Choose a shorter clip.')
      return
    }

    const type = file.type.startsWith('video/') ? 'video' : 'image'
    setMediaType(type)

    if (type === 'image') {
      setMediaFile(file)
      if (mediaPreview?.startsWith?.('blob:')) URL.revokeObjectURL(mediaPreview)
      setMediaPreview(URL.createObjectURL(file))
      return
    }

    // ── Video: load source, let user pick clip length & start ──
    trimGenRef.current += 1
    setIsTrimming(false)
    setTrimPct(0)
    if (mediaPreview?.startsWith?.('blob:')) URL.revokeObjectURL(mediaPreview)
    setMediaPreview(URL.createObjectURL(file))
    setSourceFile(file)
    setMediaFile(file) // publishable until they change prefs / apply

    try {
      const duration = await getVideoDuration(file)
      setSourceDuration(duration)
      const pref = getPreferredClipSeconds(duration)
      const opts = getClipLengthOptions(duration)
      const chosen = opts.includes(pref) ? pref : opts[opts.length - 1]
      setClipSeconds(chosen)
      setClipStart(0)

      // Must trim if over hard max; otherwise wait for user preference
      if (duration > STATUS_VIDEO_MAX_SECONDS + 0.35) {
        setTrimDirty(true)
        setTrimNote(
          `Video is ${formatDurationLabel(duration)}. Max is ${STATUS_VIDEO_MAX_SECONDS}s — pick your length & start, then Apply trim.`,
        )
        await applyUserTrim(file, chosen, 0)
      } else if (duration > chosen + 0.35) {
        setTrimDirty(true)
        setTrimNote(
          `Video is ${formatDurationLabel(duration)}. Your preferred length is ${chosen}s — adjust and Apply trim, or Publish to apply automatically.`,
        )
      } else {
        setTrimDirty(false)
        setTrimNote(`Ready · ${formatDurationLabel(duration)} (within your ${chosen}s preference).`)
      }
    } catch {
      setTrimNote('Could not read video length. You can still try publishing.')
    }
  }

  async function applyUserTrim(src = sourceFile, length = clipSeconds, start = clipStart) {
    if (!src || mediaType !== 'video') return
    const gen = ++trimGenRef.current
    setIsTrimming(true)
    setTrimPct(2)
    setErrorMsg('')

    try {
      const result = await trimStatusVideo(src, {
        startSeconds: start,
        durationSeconds: length,
        onProgress: (pct) => {
          if (trimGenRef.current === gen) setTrimPct(pct)
        },
      })

      if (trimGenRef.current !== gen) return

      if (result.file.size > 25 * 1024 * 1024) {
        setErrorMsg('Video is still too large after trim. Pick a shorter length.')
        return
      }

      setMediaFile(result.file)
      if (mediaPreview?.startsWith?.('blob:')) URL.revokeObjectURL(mediaPreview)
      setMediaPreview(URL.createObjectURL(result.file))
      setTrimDirty(false)
      setPreferredClipSeconds(length)

      if (result.trimmed) {
        setTrimNote(
          `Your clip: ${formatDurationLabel(result.durationSeconds)} starting at ${formatDurationLabel(result.startSeconds)} (source ${formatDurationLabel(result.originalDuration)})`,
        )
      } else if (result.note === 'trim-unsupported' || result.note === 'trim-failed') {
        setTrimNote(
          `Trim not available on this device. Viewers may only see up to ${STATUS_VIDEO_MAX_SECONDS}s.`,
        )
      } else {
        setTrimNote(`Using full clip (${formatDurationLabel(result.originalDuration || length)}).`)
      }
    } catch (err) {
      if (trimGenRef.current !== gen) return
      console.error(err)
      setErrorMsg(err?.message || 'Could not trim video')
    } finally {
      if (trimGenRef.current === gen) {
        setIsTrimming(false)
        setTrimPct(0)
      }
    }
  }

  function onClipSecondsChange(sec) {
    setClipSeconds(sec)
    setPreferredClipSeconds(sec)
    setTrimDirty(true)
    if (sourceDuration != null) {
      const maxS = Math.max(0, sourceDuration - sec)
      if (clipStart > maxS) setClipStart(maxS)
    }
  }

  function onClipStartChange(start) {
    setClipStart(Number(start))
    setTrimDirty(true)
  }

  // Keep the live <video> preview looping within the currently selected trim window
  useEffect(() => {
    const el = videoPreviewRef.current
    if (!el || mediaType !== 'video') return
    function onTimeUpdate() {
      if (el.currentTime < clipStart || el.currentTime >= clipStart + clipSeconds) {
        el.currentTime = clipStart
      }
    }
    el.addEventListener('timeupdate', onTimeUpdate)
    if (el.currentTime < clipStart || el.currentTime > clipStart + clipSeconds) {
      el.currentTime = clipStart
    }
    return () => el.removeEventListener('timeupdate', onTimeUpdate)
  }, [clipStart, clipSeconds, mediaType])

  function clearMedia() {
    trimGenRef.current += 1
    if (mediaPreview?.startsWith?.('blob:')) URL.revokeObjectURL(mediaPreview)
    setMediaFile(null)
    setSourceFile(null)
    setMediaPreview('')
    setMediaType('image')
    setTrimNote('')
    setSourceDuration(null)
    setIsTrimming(false)
    setTrimPct(0)
    setClipStart(0)
    setTrimDirty(false)
    setOverlayFile(null)
    setAnnotateNote('')
    setShowAnnotator(false)
  }

  function handleAnnotateApply(result) {
    setShowAnnotator(false)
    if (!result || result.empty) {
      setOverlayFile(null)
      setAnnotateNote('')
      return
    }
    if (result.mode === 'baked' && result.file) {
      setMediaFile(result.file)
      setSourceFile(null) // image is final
      if (mediaPreview?.startsWith?.('blob:')) URL.revokeObjectURL(mediaPreview)
      setMediaPreview(result.previewUrl || URL.createObjectURL(result.file))
      setMediaType('image')
      setOverlayFile(null)
      setAnnotateNote('Edits saved on photo (blur, marks, arrows).')
      return
    }
    if (result.mode === 'overlay' && result.file) {
      setOverlayFile(result.file)
      setAnnotateNote('Overlay saved — blur & marks will appear on your video.')
    }
  }

  async function uploadToStorage(file) {
    const ext = (file.name?.split('.').pop()
      || (file.type.startsWith('video/') ? 'mp4'
        : file.type === 'image/png' ? 'png'
        : file.type.startsWith('image/') ? 'jpg'
        : 'bin')).toLowerCase()
    const path = `${user.id}/${Date.now()}.${ext}`
    // Prefer story-media (app standard); fall back to status-media
    const errors = []
    for (const bucket of ['story-media', 'status-media']) {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type, upsert: false })
      if (!error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path)
        return data.publicUrl
      }
      errors.push(`${bucket}: ${error.message}`)
    }
    throw new Error(`Media upload failed — ${errors.join(' | ')}`)
  }

  async function handlePublish() {
    if (tab === 'media' && isTrimming) {
      setErrorMsg('Please wait — video is still being trimmed')
      return
    }
    if (tab === 'media' && !mediaFile && !sourceFile) {
      setErrorMsg('Add a photo or video, or switch to Text')
      return
    }
    if (tab === 'text' && !caption.trim()) {
      setErrorMsg('Write a short message for your status')
      return
    }

    setIsUploading(true)
    setErrorMsg('')
    try {
      let mediaUrls = []
      if (tab === 'media') {
        let fileToUpload = mediaFile
        // Apply user trim prefs on publish if still dirty (or over hard max)
        if (mediaType === 'video' && sourceFile && (trimDirty || (sourceDuration != null && sourceDuration > STATUS_VIDEO_MAX_SECONDS))) {
          setIsTrimming(true)
          try {
            const result = await trimStatusVideo(sourceFile, {
              startSeconds: clipStart,
              durationSeconds: clipSeconds,
              onProgress: (pct) => setTrimPct(pct),
            })
            fileToUpload = result.file
            setPreferredClipSeconds(clipSeconds)
            setTrimDirty(false)
            if (result.file.size > 25 * 1024 * 1024) {
              throw new Error('Video is too large after trim. Choose a shorter length.')
            }
          } finally {
            setIsTrimming(false)
            setTrimPct(0)
          }
        }
        if (!fileToUpload) throw new Error('Add a photo or video first')
        const url = await uploadToStorage(fileToUpload)
        mediaUrls = [url]
        // Video annotation overlay (transparent PNG) as second media entry
        if (mediaType === 'video' && overlayFile) {
          try {
            const overlayUrl = await uploadToStorage(overlayFile)
            mediaUrls.push(overlayUrl)
          } catch (e) {
            console.error('Overlay upload failed', e)
            throw new Error(`Edits failed to save (${e?.message || 'upload error'}) — try again or remove the marks.`)
          }
        }
      } else if (tab === 'text') {
        // Store solid colour as first "media" so viewers can render text boards
        mediaUrls = [bgColor]
      }

      const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString()
      const defaultCaption = mediaType === 'video' ? '' : 'Photo update'

      const kind = taggedKind || (taggedId ? 'listing' : null)
      const statusType = kind === 'job' || kind === 'service'
        ? 'work_ping'
        : kind
          ? 'listing_update'
          : (tab === 'text' ? 'availability' : 'listing_update')

      const payload = {
        user_id: user.id,
        status_type: statusType,
        content: caption.trim() || defaultCaption,
        media_urls: mediaUrls,
        tagged_listing_id: kind === 'listing' ? taggedId : null,
        listing_id: kind === 'listing' ? taggedId : null,
        tagged_kind: kind,
        tagged_ref_id: taggedId || null,
        location_hint: location || null,
        expires_at: expiresAt,
      }

      let { error } = await supabase.from('user_statuses').insert(payload)
      if (error && /tagged_kind|tagged_ref_id|column/i.test(error.message || '')) {
        const legacy = { ...payload }
        delete legacy.tagged_kind
        delete legacy.tagged_ref_id
        ;({ error } = await supabase.from('user_statuses').insert(legacy))
      }
      if (error) throw error

      onSuccess?.()
      onClose?.()
    } catch (err) {
      console.error('Status upload error:', err)
      setErrorMsg(err?.message || 'Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  function handleOverlayClick(e) {
    if (e.target === e.currentTarget && !isUploading) onClose()
  }

  const canPublish = tab === 'media'
    ? ((!!mediaFile || !!sourceFile) && !isTrimming)
    : !!caption.trim()

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(15,23,42,0.72)', backdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 12,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 22,
        width: '100%', maxWidth: 440,
        maxHeight: '92vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 28px 90px rgba(0,0,0,0.45)',
        animation: 'suModalIn 0.28s cubic-bezier(0.16,1,0.3,1)',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        <style>{`
          @keyframes suModalIn {
            from { opacity:0; transform:scale(0.96) translateY(14px); }
            to   { opacity:1; transform:none; }
          }
          @keyframes suSpin { to { transform: rotate(360deg); } }
        `}</style>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 16px 12px',
          borderBottom: '1px solid #f1f5f9',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: 'linear-gradient(135deg,#1a7a4a,#22c55e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(26,122,74,0.35)',
            }}>
              <IconSpark />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a', letterSpacing: -0.2 }}>New status</div>
              <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
                <IconClock size={12} /> Visible for 24 hours
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            aria-label="Close"
            style={{
              width: 34, height: 34, borderRadius: '50%', border: 'none',
              background: '#f1f5f9', color: '#64748b', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <IconClose size={16} />
          </button>
        </div>

        {/* Tabs */}
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6,
          padding: 10, background: '#f8fafc', borderBottom: '1px solid #f1f5f9',
        }}>
          {[
            { key: 'media', label: 'Photo / Video', Icon: IconMedia },
            { key: 'text', label: 'Text board', Icon: IconText },
          ].map(({ key, label, Icon }) => {
            const active = tab === key
            return (
              <button
                key={key}
                type="button"
                onClick={() => { setTab(key); setErrorMsg('') }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  padding: '11px 8px', borderRadius: 12, border: 'none',
                  fontSize: 12, fontWeight: 800, cursor: 'pointer',
                  background: active ? '#fff' : 'transparent',
                  color: active ? G : '#64748b',
                  boxShadow: active ? '0 1px 6px rgba(0,0,0,0.08)' : 'none',
                  transition: 'all 0.15s',
                }}
              >
                <Icon size={16} color={active ? G : '#94a3b8'} />
                {label}
              </button>
            )
          })}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 8px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Media tab */}
          {tab === 'media' && (
            <div>
              {mediaPreview ? (
                <div style={{
                  position: 'relative', borderRadius: 16, overflow: 'hidden',
                  background: '#0f172a', maxHeight: 240,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {mediaType === 'image'
                    ? <img src={mediaPreview} alt="" style={{ maxHeight: 240, width: '100%', objectFit: 'contain' }} />
                    : <video ref={videoPreviewRef} src={mediaPreview} controls style={{ maxHeight: 240, width: '100%', objectFit: 'contain', background: '#000' }} />
                  }
                  <div style={{
                    position: 'absolute', top: 10, left: 10,
                    background: 'rgba(0,0,0,0.55)', color: '#fff',
                    fontSize: 10, fontWeight: 800, letterSpacing: 0.4,
                    padding: '4px 8px', borderRadius: 20,
                    display: 'flex', alignItems: 'center', gap: 5, textTransform: 'uppercase',
                  }}>
                    {mediaType === 'video' ? <IconVideo size={12} color="#fff" /> : <IconImage size={12} color="#fff" />}
                    {mediaType}
                    {mediaType === 'video' && sourceDuration != null && (
                      <span style={{ opacity: 0.9, fontWeight: 700 }}>
                        · {formatDurationLabel(sourceDuration)}
                      </span>
                    )}
                  </div>
                  <div style={{
                    position: 'absolute', top: 10, right: 10,
                    display: 'flex', gap: 6, zIndex: 2,
                  }}>
                    <button
                      type="button"
                      onClick={() => setShowAnnotator(true)}
                      disabled={isTrimming || !mediaPreview}
                      style={{
                        background: 'rgba(15,157,88,0.92)', border: 'none',
                        borderRadius: 10, height: 34, padding: '0 10px',
                        color: '#fff', cursor: isTrimming ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800, fontFamily: 'inherit',
                        opacity: isTrimming ? 0.5 : 1,
                        gap: 4,
                      }}
                    >
                      ✏ Edit
                    </button>
                    <button
                      type="button"
                      onClick={clearMedia}
                      disabled={isTrimming}
                      style={{
                        background: 'rgba(0,0,0,0.6)', border: 'none',
                        borderRadius: 10, width: 34, height: 34,
                        color: '#fff', cursor: isTrimming ? 'default' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: isTrimming ? 0.5 : 1,
                      }}
                      aria-label="Remove media"
                    >
                      <IconTrash />
                    </button>
                  </div>
                  {overlayFile && mediaType === 'video' && (
                    <div style={{
                      position: 'absolute', bottom: 10, left: 10, right: 10,
                      background: 'rgba(15,157,88,0.9)', color: '#fff',
                      fontSize: 11, fontWeight: 700, borderRadius: 10,
                      padding: '6px 10px', textAlign: 'center',
                    }}>
                      Marks overlay ready · Edit again to change
                    </div>
                  )}

                  {/* Trim progress overlay */}
                  {isTrimming && (
                    <div style={{
                      position: 'absolute', inset: 0, zIndex: 3,
                      background: 'rgba(15,23,42,0.72)',
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center',
                      gap: 10, padding: 16,
                    }}>
                      <IconSpinner size={22} />
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', textAlign: 'center' }}>
                        Trimming your clip ({formatDurationLabel(clipSeconds)})…
                      </div>
                      <div style={{
                        width: '72%', maxWidth: 200, height: 6, borderRadius: 99,
                        background: 'rgba(255,255,255,0.15)', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 99,
                          width: `${Math.max(4, trimPct)}%`,
                          background: 'linear-gradient(90deg,#1a7a4a,#22c55e)',
                          transition: 'width 0.15s linear',
                        }} />
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.65)' }}>
                        {Math.round(trimPct)}%
                      </div>
                    </div>
                  )}
                </div>
              ) : null}

              {mediaType === 'video' && mediaPreview && sourceDuration != null && (
                <div style={{ marginTop: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#64748b', letterSpacing: 0.3 }}>
                      DRAG TO TRIM
                    </span>
                    <span style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>
                      {formatDurationLabel(clipStart)}
                      <span style={{ color: '#94a3b8', fontWeight: 600 }}> → </span>
                      {formatDurationLabel(clipStart + clipSeconds)}
                    </span>
                  </div>
                  <TrimBar
                    duration={sourceDuration}
                    start={clipStart}
                    length={clipSeconds}
                    maxLength={Math.min(STATUS_VIDEO_MAX_SECONDS, sourceDuration)}
                    minLength={Math.min(1, sourceDuration)}
                    disabled={isTrimming || isUploading}
                    onChange={(newStart, newLength) => {
                      setClipStart(newStart)
                      setClipSeconds(newLength)
                      setPreferredClipSeconds(newLength)
                      setTrimDirty(true)
                      if (videoPreviewRef.current) videoPreviewRef.current.currentTime = newStart
                    }}
                  />
                </div>
              )}

              {!mediaPreview && (
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={e => {
                    e.preventDefault()
                    setIsDragging(false)
                    handleFileChange(e.dataTransfer.files?.[0])
                  }}
                  style={{
                    border: `2px dashed ${isDragging ? G : '#e2e8f0'}`,
                    borderRadius: 18,
                    padding: '22px 16px 16px',
                    background: isDragging
                      ? 'linear-gradient(180deg,#f0fdf4,#ecfdf5)'
                      : 'linear-gradient(180deg,#f8fafc,#f1f5f9)',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <div style={{
                      width: 56, height: 56, borderRadius: 18, margin: '0 auto 10px',
                      background: '#fff',
                      boxShadow: '0 4px 16px rgba(26,122,74,0.12)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <IconCamera size={26} />
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#0f172a' }}>
                      Add photo or video
                    </div>
                    <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontWeight: 600 }}>
                      Photos max 15MB · videos up to {STATUS_VIDEO_MAX_SECONDS}s (you choose) · 24h
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    <UploadAction
                      icon={<IconImage size={20} color={G} />}
                      label="Gallery"
                      onClick={() => fileInputRef.current?.click()}
                    />
                    <UploadAction
                      icon={<IconCamera size={20} color={G} />}
                      label="Camera"
                      onClick={() => cameraInputRef.current?.click()}
                    />
                    <UploadAction
                      icon={<IconVideo size={20} color="#7c3aed" />}
                      label="Video"
                      onClick={() => fileInputRef.current?.click()}
                    />
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    style={{ display: 'none' }}
                    onChange={e => handleFileChange(e.target.files?.[0])}
                  />
                  <input
                    ref={cameraInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    style={{ display: 'none' }}
                    onChange={e => handleFileChange(e.target.files?.[0])}
                  />
                </div>
              )}
            </div>
          )}

          {/* Text tab */}
          {tab === 'text' && (
            <div>
              <div style={{
                width: '100%', minHeight: 120, borderRadius: 16,
                background: bgColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 18, marginBottom: 12,
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.08)',
              }}>
                <div style={{
                  fontSize: 15, fontWeight: 800, color: '#fff',
                  textAlign: 'center', lineHeight: 1.45,
                  textShadow: '0 1px 8px rgba(0,0,0,0.25)',
                  wordBreak: 'break-word',
                }}>
                  {caption || 'Your status preview…'}
                </div>
              </div>
              <div style={{ fontSize: 10, fontWeight: 800, color: '#94a3b8', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 8 }}>
                Background
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {BG_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setBgColor(c)}
                    aria-label={`Background ${c}`}
                    style={{
                      width: 34, height: 34, borderRadius: '50%',
                      border: bgColor === c ? `3px solid ${G}` : '3px solid transparent',
                      background: c, cursor: 'pointer',
                      boxShadow: bgColor === c ? `0 0 0 2px #fff, 0 0 0 4px ${G}` : '0 1px 3px rgba(0,0,0,0.15)',
                      transform: bgColor === c ? 'scale(1.08)' : 'none',
                      transition: 'transform 0.15s',
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Caption */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
              <div style={labelStyle}>{tab === 'media' ? 'Caption' : 'Message'}</div>
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>{caption.length}/180</span>
            </div>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value.slice(0, 180))}
              rows={3}
              placeholder={tab === 'media'
                ? 'Price drop, still available, meet today…'
                : 'Share availability, a flash deal, or announcement…'}
              style={inputStyle}
            />
            <div style={{ display: 'flex', gap: 5, marginTop: 8, overflowX: 'auto', paddingBottom: 2 }}>
              {QUICK_EMOJIS.map(e => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setCaption(prev => (prev + e).slice(0, 180))}
                  style={{
                    background: '#f1f5f9', border: 'none', borderRadius: 10,
                    width: 34, height: 34, fontSize: 15, cursor: 'pointer', flexShrink: 0,
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Product tag */}
          <div style={{
            padding: 12,
            borderRadius: 16,
            background: '#fafbfc',
            border: '1px solid #eef2f7',
          }}>
            <ProductTagPicker
              items={tagItems}
              taggedId={taggedId}
              taggedKind={taggedKind}
              onChange={(sel) => {
                if (!sel) { setTaggedId(null); setTaggedKind(null); return }
                setTaggedId(sel.id)
                setTaggedKind(sel.kind)
              }}
            />
          </div>

          {/* Location — all districts + free type */}
          <StatusLocationField
            value={location}
            onChange={setLocation}
            placeholder="Search district or type your place…"
          />

          {/* User trim preferences — only for video */}
          {tab === 'media' && mediaType === 'video' && sourceFile && sourceDuration != null && (
            <div style={{
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: '12px 12px 10px',
              background: '#f8fafc',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>Your clip settings</div>
                  <div style={{ fontSize: 11, color: '#64748b', fontWeight: 600, marginTop: 2 }}>
                    Source {formatDurationLabel(sourceDuration)} · max {STATUS_VIDEO_MAX_SECONDS}s
                  </div>
                </div>
                <IconClock size={16} color="#64748b" />
              </div>

              

              <button
                type="button"
                disabled={isTrimming || isUploading || !trimDirty}
                onClick={() => applyUserTrim(sourceFile, clipSeconds, clipStart)}
                style={{
                  border: 'none',
                  borderRadius: 12,
                  padding: '10px 14px',
                  fontSize: 12.5,
                  fontWeight: 800,
                  fontFamily: 'inherit',
                  cursor: isTrimming || !trimDirty ? 'default' : 'pointer',
                  background: trimDirty && !isTrimming ? G : '#cbd5e1',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                }}
              >
                {isTrimming ? (
                  <><IconSpinner size={14} /> Applying…</>
                ) : trimDirty ? (
                  `Apply trim · ${formatDurationLabel(clipSeconds)} clip`
                ) : (
                  'Trim applied ✓'
                )}
              </button>
            </div>
          )}

          {trimNote && !errorMsg && (
            <div style={{
              background: '#ecfdf5', border: '1px solid #bbf7d0', color: '#166534',
              borderRadius: 12, padding: '10px 12px', fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span style={{ flexShrink: 0 }} aria-hidden>✂</span>
              <span>{trimNote}</span>
            </div>
          )}

          {annotateNote && !errorMsg && (
            <div style={{
              background: '#eff6ff', border: '1px solid #bfdbfe', color: '#1d4ed8',
              borderRadius: 12, padding: '10px 12px', fontSize: 12, fontWeight: 700,
              display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
              <span style={{ flexShrink: 0 }} aria-hidden>✏</span>
              <span>{annotateNote}</span>
            </div>
          )}

          {errorMsg && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
              borderRadius: 12, padding: '10px 12px', fontSize: 12, fontWeight: 700,
            }}>
              {errorMsg}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px 16px',
          borderTop: '1px solid #f1f5f9',
          background: 'linear-gradient(180deg,#fafbfc,#f8fafc)',
          display: 'flex', gap: 10,
        }}>
          <button
            type="button"
            onClick={onClose}
            disabled={isUploading}
            style={{
              flex: '0 0 auto', padding: '12px 16px', borderRadius: 14,
              border: '1.5px solid #e2e8f0', background: '#fff',
              fontSize: 13, fontWeight: 700, color: '#475569', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isUploading || !canPublish}
            style={{
              flex: 1, padding: '12px 18px', borderRadius: 14, border: 'none',
              background: isUploading || !canPublish
                ? '#cbd5e1'
                : 'linear-gradient(135deg,#1a7a4a,#16a34a)',
              fontSize: 13, fontWeight: 800, color: '#fff',
              cursor: isUploading || !canPublish ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: canPublish && !isUploading ? '0 4px 16px rgba(26,122,74,0.35)' : 'none',
            }}
          >
            {isTrimming ? (
              <><IconSpinner /> Trimming…</>
            ) : isUploading ? (
              <><IconSpinner /> Publishing…</>
            ) : (
              <><IconSend /> Publish{taggedId ? ' · tagged' : ' status'}</>
            )}
          </button>
        </div>
      </div>

      {showAnnotator && mediaPreview && (
        <StatusMediaAnnotator
          src={mediaPreview}
          mediaType={mediaType}
          onClose={() => setShowAnnotator(false)}
          onApply={handleAnnotateApply}
        />
      )}
    </div>
  )
}

function TrimBar({ duration, start, length, maxLength, minLength = 1, disabled, onChange }) {
  const trackRef = useRef(null)
  const dragRef = useRef(null) // 'start' | 'end' | 'move'

  const startPct = (start / duration) * 100
  const endPct = ((start + length) / duration) * 100

  function timeFromEvent(e) {
    const rect = trackRef.current.getBoundingClientRect()
    const clientX = e.touches ? e.touches[0].clientX : e.clientX
    let pct = (clientX - rect.left) / rect.width
    pct = Math.max(0, Math.min(1, pct))
    return pct * duration
  }

  function handleDrag(e) {
    if (e.cancelable) e.preventDefault()
    const time = timeFromEvent(e)
    if (dragRef.current === 'start') {
      let newStart = Math.max(0, Math.min(time, start + length - minLength))
      let newLength = Math.min(start + length - newStart, maxLength)
      onChange(newStart, newLength)
    } else if (dragRef.current === 'end') {
      let newEnd = Math.max(time, start + minLength)
      let newLength = Math.min(newEnd - start, maxLength, duration - start)
      onChange(start, newLength)
    } else if (dragRef.current === 'move') {
      let newStart = Math.max(0, Math.min(duration - length, time - length / 2))
      onChange(newStart, length)
    }
  }

  function onPointerDown(handle) {
    return (e) => {
      if (disabled) return
      e.preventDefault()
      dragRef.current = handle
      const move = (ev) => handleDrag(ev)
      const up = () => {
        dragRef.current = null
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
        window.removeEventListener('touchmove', move)
        window.removeEventListener('touchend', up)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
      window.addEventListener('touchmove', move, { passive: false })
      window.addEventListener('touchend', up)
    }
  }

  return (
    <div ref={trackRef} style={{ position: 'relative', height: 44, borderRadius: 10, background: '#e2e8f0', touchAction: 'none', userSelect: 'none' }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: `${startPct}%`, background: 'rgba(15,23,42,0.35)', borderRadius: '10px 0 0 10px' }} />
      <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: `${100 - endPct}%`, background: 'rgba(15,23,42,0.35)', borderRadius: '0 10px 10px 0' }} />
      <div
        onMouseDown={onPointerDown('move')}
        onTouchStart={onPointerDown('move')}
        style={{
          position: 'absolute', top: 0, bottom: 0,
          left: `${startPct}%`, width: `${endPct - startPct}%`,
          border: `2px solid ${G}`, boxSizing: 'border-box',
          cursor: disabled ? 'default' : 'grab',
          background: 'rgba(26,122,74,0.12)',
        }}
      />
      <div
        onMouseDown={onPointerDown('start')}
        onTouchStart={onPointerDown('start')}
        style={{
          position: 'absolute', top: 0, bottom: 0, left: `calc(${startPct}% - 8px)`,
          width: 16, borderRadius: 6, background: G,
          cursor: disabled ? 'default' : 'ew-resize',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
        }}
      >
        <div style={{ width: 3, height: 16, borderRadius: 2, background: '#fff' }} />
      </div>
      <div
        onMouseDown={onPointerDown('end')}
        onTouchStart={onPointerDown('end')}
        style={{
          position: 'absolute', top: 0, bottom: 0, left: `calc(${endPct}% - 8px)`,
          width: 16, borderRadius: 6, background: G,
          cursor: disabled ? 'default' : 'ew-resize',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2,
        }}
      >
        <div style={{ width: 3, height: 16, borderRadius: 2, background: '#fff' }} />
      </div>
    </div>
  )
}

function UploadAction({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        padding: '12px 8px', borderRadius: 14,
        border: '1.5px solid #e2e8f0', background: '#fff',
        cursor: 'pointer', fontFamily: 'inherit',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        transition: 'border-color 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#86efac'; e.currentTarget.style.transform = 'translateY(-1px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.transform = 'none' }}
    >
      {icon}
      <span style={{ fontSize: 11, fontWeight: 800, color: '#334155' }}>{label}</span>
    </button>
  )
}

const labelStyle = {
  fontSize: 10, fontWeight: 800, color: '#64748b',
  textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
}

const inputStyle = {
  width: '100%', padding: '11px 13px', borderRadius: 12,
  border: '1.5px solid #e2e8f0', background: '#f8fafc',
  fontSize: 13, color: '#0f172a', outline: 'none',
  fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box',
}
