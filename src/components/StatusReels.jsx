import { useEffect, useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Heart, MessageCircle, Share2, Volume2, VolumeX, X, Play, Flame, Eye } from 'lucide-react'
import { mediaUrlBase, parseClipWindow } from '../utils/statusVideo'
import StatusCommentsPanel from './StatusComments'
import { useStatusComments } from '../hooks/useStatusComments'

// SokoMw theme tokens (match StatusPage / Home)
const T = {
  green:      '#0F9D58',
  greenLight: '#e8f5ee',
  greenMid:   '#0a7a44',
  orange:     '#F9AB00',
  surface:    '#ffffff',
  bg:         '#f8f9fa',
  border:     '#e8eaed',
  text:       '#202124',
  textSub:    '#5f6368',
  textMuted:  '#80868b',
  verified:   '#1A73E8',
  shadow:     '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)',
  shadowMd:   '0 4px 12px rgba(0,0,0,0.11), 0 8px 28px rgba(0,0,0,0.08)',
  font:       "'Inter', 'DM Sans', system-ui, sans-serif",
  fontDisplay:"'Sora', 'Inter', system-ui, sans-serif",
}

function fmtCount(n) {
  const v = n || 0
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return `${v}`
}

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso)
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d`
  if (h >= 1) return `${h}h`
  if (m < 1) return 'now'
  return `${m}m`
}

/** First frame preview URL — base URL forced to a 0.1s seek so a frame renders. */
function thumbUrl(url) {
  return `${mediaUrlBase(url)}#t=0.1`
}

function VerifiedBadge() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }} aria-hidden>
      <circle cx="6.5" cy="6.5" r="6.5" fill={T.verified}/>
      <path d="M3.5 6.5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

// ─────────────────────────────────────────────
// In-feed reel card — found while scrolling the status feed
// ─────────────────────────────────────────────
export function ReelFeedCard({ reels, metrics, onOpen }) {
  if (!reels?.length) return null
  const preview = reels.slice(0, 3)
  const totalViews = reels.reduce((acc, r) => acc + (metrics[r.id]?.views || 0), 0)

  return (
    <article className="reel-card">
      <div className="reel-card-head">
        <div className="reel-card-ico" aria-hidden>
          <Play size={18} fill="#fff" stroke="none" />
        </div>
        <div className="reel-card-headcopy">
          <div className="reel-card-name-row">
            <span className="reel-card-name">Soko Reels</span>
            <span className="reel-card-trend"><Flame size={10} strokeWidth={2.6} /> Trending</span>
          </div>
          <span className="reel-card-sub">Most watched status videos right now</span>
        </div>
        <span className="reel-card-viewpill">
          <Eye size={11} /> {fmtCount(totalViews)}
        </span>
      </div>

      <div className="reel-card-strip">
        {preview.map((r, i) => (
          <button key={r.id} type="button" className="reel-thumb" onClick={onOpen}
            aria-label={`Watch reel ${i + 1} by ${r.profiles?.full_name || 'seller'}`}
          >
            <video src={thumbUrl(r.media_urls?.[0])} muted playsInline preload="metadata" tabIndex={-1} />
            <span className="reel-thumb-shade" aria-hidden />
            <span className="reel-thumb-rank">#{i + 1}</span>
            {i === 0 && <span className="reel-thumb-play" aria-hidden><Play size={13} fill="#fff" stroke="none" /></span>}
            <span className="reel-thumb-meta">
              <strong>{(r.profiles?.full_name || 'Seller').split(' ')[0]}</strong>
              <em><Play size={7.5} fill="currentColor" stroke="none" /> {fmtCount(metrics[r.id]?.views || 0)}</em>
            </span>
          </button>
        ))}
      </div>

      <button type="button" className="reel-card-cta" onClick={onOpen}>
        <Play size={14} fill="#fff" stroke="none" />
        Watch reels · {reels.length} video{reels.length > 1 ? 's' : ''}
      </button>

      <style>{`
        .reel-card {
          display: flex; flex-direction: column; gap: 12px;
          background: ${T.surface};
          border: 1px solid rgba(15,157,88,0.24);
          border-radius: 18px; overflow: hidden;
          box-shadow: 0 6px 22px rgba(15,157,88,0.10), ${T.shadow};
          padding: 14px;
          font-family: ${T.font};
          transition: transform 0.18s ease, box-shadow 0.18s ease;
        }
        .reel-card:hover { transform: translateY(-3px); box-shadow: 0 10px 30px rgba(15,157,88,0.16), ${T.shadowMd}; }
        .reel-card-head { display: flex; align-items: center; gap: 10px; min-width: 0; }
        .reel-card-ico {
          width: 42px; height: 42px; border-radius: 14px; flex-shrink: 0;
          background: linear-gradient(135deg, ${T.green} 0%, #34c77a 60%, ${T.orange} 135%);
          display: grid; place-items: center;
          box-shadow: 0 4px 12px rgba(15,157,88,0.35);
        }
        .reel-card-headcopy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .reel-card-name-row { display: flex; align-items: center; gap: 7px; min-width: 0; }
        .reel-card-name {
          font-family: ${T.fontDisplay}; font-size: 14.5px; font-weight: 800; color: ${T.text};
          letter-spacing: -0.3px; white-space: nowrap;
        }
        .reel-card-trend {
          display: inline-flex; align-items: center; gap: 3px;
          font-size: 9px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;
          color: #fff; background: linear-gradient(135deg, ${T.orange}, #f57c00);
          border-radius: 999px; padding: 3px 8px; line-height: 1; white-space: nowrap;
          box-shadow: 0 2px 8px rgba(249,171,0,0.35);
        }
        .reel-card-sub {
          font-size: 11px; font-weight: 600; color: ${T.textMuted};
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .reel-card-viewpill {
          display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0;
          font-size: 11px; font-weight: 800; color: ${T.greenMid};
          background: ${T.greenLight}; border: 1px solid rgba(15,157,88,0.16);
          border-radius: 999px; padding: 5px 9px;
        }
        .reel-card-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
        .reel-thumb {
          position: relative; aspect-ratio: 9 / 13; border-radius: 12px; overflow: hidden;
          border: none; padding: 0; cursor: pointer; background: linear-gradient(160deg, #0f172a, #1e293b);
          transition: transform 0.15s ease;
        }
        .reel-thumb:hover { transform: scale(1.025); }
        .reel-thumb video { width: 100%; height: 100%; object-fit: cover; display: block; pointer-events: none; }
        .reel-thumb-shade {
          position: absolute; inset: 0; pointer-events: none;
          background: linear-gradient(180deg, rgba(0,0,0,0.22) 0%, transparent 32%, transparent 55%, rgba(0,0,0,0.62) 100%);
        }
        .reel-thumb-rank {
          position: absolute; top: 6px; left: 6px;
          font-size: 9px; font-weight: 800; color: #fff; letter-spacing: 0.3px;
          background: rgba(0,0,0,0.55); backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
          border: 1px solid rgba(255,255,255,0.18);
          border-radius: 999px; padding: 2.5px 7px;
        }
        .reel-thumb-play {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%);
          width: 32px; height: 32px; border-radius: 50%;
          background: rgba(0,0,0,0.5); border: 1.5px solid rgba(255,255,255,0.4);
          display: grid; place-items: center;
          backdrop-filter: blur(6px); -webkit-backdrop-filter: blur(6px);
        }
        .reel-thumb-meta {
          position: absolute; left: 7px; right: 7px; bottom: 6px;
          display: flex; flex-direction: column; align-items: flex-start; gap: 1px; text-align: left;
        }
        .reel-thumb-meta strong {
          font-size: 10px; font-weight: 800; color: #fff; max-width: 100%;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          text-shadow: 0 1px 3px rgba(0,0,0,0.55);
        }
        .reel-thumb-meta em {
          display: inline-flex; align-items: center; gap: 3px;
          font-style: normal; font-size: 9px; font-weight: 700; color: rgba(255,255,255,0.85);
        }
        .reel-card-cta {
          display: flex; align-items: center; justify-content: center; gap: 8px;
          width: 100%; border: none; cursor: pointer; font-family: inherit;
          background: linear-gradient(135deg, ${T.green} 0%, ${T.greenMid} 100%);
          color: #fff; font-size: 13px; font-weight: 800; letter-spacing: 0.1px;
          border-radius: 12px; padding: 11px 14px;
          box-shadow: 0 4px 14px rgba(15,157,88,0.30);
          transition: filter 0.15s ease, transform 0.12s ease;
        }
        .reel-card-cta:hover { filter: brightness(1.06); }
        .reel-card-cta:active { transform: scale(0.98); }
      `}</style>
    </article>
  )
}

// ─────────────────────────────────────────────
// Full-screen reels viewer
// ─────────────────────────────────────────────
export function ReelsViewer({ reels, metrics, startIndex = 0, currentUserId, onClose, onToggleLike, registerView }) {
  const scrollRef = useRef(null)
  const [active, setActive] = useState(startIndex)
  const [muted, setMuted] = useState(true)
  const [commentsReel, setCommentsReel] = useState(null)
  const pendingCommentsRef = useRef(false)
  const [copied, setCopied] = useState(false)
  const viewedRef = useRef(new Set())

  const commentApi = useStatusComments({
    story: commentsReel,
    currentUserId,
    notify: () => {},
  })

  // Open the sheet only AFTER useStatusComments has processed the new
  // statusId (it resets open=false on status change) — declaration order
  // guarantees this effect runs after the hook's own effects.
  useEffect(() => {
    if (!commentsReel || !pendingCommentsRef.current) return
    pendingCommentsRef.current = false
    commentApi.openComments()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [commentsReel])

  // Lock page scroll behind the overlay
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Start at the requested reel
  useEffect(() => {
    const el = scrollRef.current
    if (!el || !startIndex) return
    el.scrollTop = startIndex * el.clientHeight
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Track which slide fills the viewport
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const slides = Array.from(el.querySelectorAll('[data-reel-idx]'))
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          const idx = Number(e.target.getAttribute('data-reel-idx'))
          setActive(idx)
          const reel = reels[idx]
          if (reel && !viewedRef.current.has(reel.id)) {
            viewedRef.current.add(reel.id)
            registerView?.(reel.id)
          }
        }
      }
    }, { root: el, threshold: 0.6 })
    slides.forEach(s => io.observe(s))
    return () => io.disconnect()
  }, [reels, registerView])

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function scrollToIndex(i) {
    const el = scrollRef.current
    if (!el) return
    el.scrollTo({ top: i * el.clientHeight, behavior: 'smooth' })
  }

  async function handleShare(reel) {
    const url = `${window.location.origin}/status/${reel.id}`
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && navigator.share) {
      navigator.share({ title: `${reel.profiles?.full_name || 'Seller'} on SokoMw`, text: reel.content || '', url }).catch(() => {})
      return
    }
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1600) }
    navigator.clipboard?.writeText(url).then(done).catch(done)
  }

  return (
    <div className="rz-root">
      <div ref={scrollRef} className="rz-scroll">
        {reels.map((reel, i) => (
          <ReelSlide
            key={reel.id}
            reel={reel}
            index={i}
            active={i === active}
            muted={muted}
            metric={metrics[reel.id] || { views: 0, likes: 0, myLike: null }}
            onToggleLike={() => onToggleLike(reel.id)}
            onComments={() => { pendingCommentsRef.current = true; setCommentsReel(reel) }}
            onShare={() => handleShare(reel)}
            onEnded={() => { if (i < reels.length - 1) scrollToIndex(i + 1) }}
            isLast={i === reels.length - 1}
            copied={copied && i === active}
          />
        ))}
      </div>

      {/* Top bar */}
      <div className="rz-top">
        <button type="button" className="rz-top-close" onClick={onClose} aria-label="Close reels">
          <X size={19} strokeWidth={2.5} />
        </button>
        <div className="rz-top-title">
          <Play size={12} fill="#fff" stroke="none" />
          Soko Reels
        </div>
        <span className="rz-top-count">{active + 1}/{reels.length}</span>
      </div>

      {/* Mute control */}
      <button type="button" className="rz-mute" onClick={() => setMuted(m => !m)} aria-label={muted ? 'Unmute' : 'Mute'}>
        {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>

      {/* Comments bottom sheet */}
      <AnimatePresence>
        {commentApi.open && commentsReel && (
          <motion.div
            className="rz-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'tween', duration: 0.24, ease: 'easeOut' }}
          >
            <div className="rz-sheet-bar" aria-hidden />
            <div className="rz-sheet-head">
              <h3>Comments</h3>
              <button type="button" onClick={commentApi.closeComments} aria-label="Close comments">
                <X size={17} />
              </button>
            </div>
            <div className="rz-sheet-body">
              <StatusCommentsPanel api={commentApi} story={commentsReel} currentUserId={currentUserId} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <style>{`
        .rz-root {
          position: fixed; inset: 0; z-index: 5000;
          background: #000; font-family: ${T.font};
          display: flex; flex-direction: column;
        }
        .rz-scroll {
          position: absolute; inset: 0;
          overflow-y: auto; scroll-snap-type: y mandatory;
          scrollbar-width: none; -ms-overflow-style: none;
          overscroll-behavior: contain;
        }
        .rz-scroll::-webkit-scrollbar { display: none; }
        .rz-slide {
          position: relative;
          height: 100%; scroll-snap-align: start; scroll-snap-stop: always;
          display: flex; align-items: center; justify-content: center;
          background: #000; overflow: hidden;
        }
        .rz-video { width: 100%; height: 100%; object-fit: contain; background: #000; }
        .rz-tap { position: absolute; inset: 0; z-index: 2; cursor: pointer; }

        .rz-progress { position: absolute; top: 0; left: 0; right: 0; height: 2.5px; z-index: 6; background: rgba(255,255,255,0.16); }
        .rz-progress i { display: block; height: 100%; background: ${T.green}; border-radius: 0 2px 2px 0; transition: width 0.15s linear; }

        .rz-paused {
          position: absolute; top: 50%; left: 50%; transform: translate(-50%,-50%); z-index: 3;
          width: 64px; height: 64px; border-radius: 50%; pointer-events: none;
          background: rgba(0,0,0,0.45); border: 1.5px solid rgba(255,255,255,0.35);
          display: grid; place-items: center;
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
        }

        .rz-top {
          position: absolute; top: 0; left: 0; right: 0; z-index: 20;
          display: flex; align-items: center; gap: 10px;
          padding: 14px 14px 22px;
          background: linear-gradient(180deg, rgba(0,0,0,0.65) 0%, transparent 100%);
          pointer-events: none;
        }
        .rz-top > * { pointer-events: auto; }
        .rz-top-close {
          width: 36px; height: 36px; border-radius: 50%; border: none; cursor: pointer;
          background: rgba(0,0,0,0.4); color: #fff;
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          display: grid; place-items: center;
          transition: background 0.15s;
        }
        .rz-top-close:hover { background: rgba(0,0,0,0.6); }
        .rz-top-title {
          display: inline-flex; align-items: center; gap: 6px; flex: 1;
          font-family: ${T.fontDisplay}; font-size: 14px; font-weight: 800; color: #fff; letter-spacing: 0.2px;
          text-shadow: 0 1px 4px rgba(0,0,0,0.5);
        }
        .rz-top-count { font-size: 11px; font-weight: 700; color: rgba(255,255,255,0.75); font-variant-numeric: tabular-nums; }

        .rz-mute {
          position: absolute; top: 62px; right: 14px; z-index: 21;
          width: 36px; height: 36px; border-radius: 50%; border: none; cursor: pointer;
          background: rgba(0,0,0,0.4); color: #fff;
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          display: grid; place-items: center;
          transition: background 0.15s;
        }
        .rz-mute:hover { background: rgba(0,0,0,0.6); }

        .rz-rail {
          position: absolute; right: 10px; bottom: 96px; z-index: 8;
          display: flex; flex-direction: column; align-items: center; gap: 16px;
        }
        .rz-rail-btn {
          display: flex; flex-direction: column; align-items: center; gap: 3px;
          border: none; background: none; cursor: pointer; padding: 0; font-family: inherit;
          color: #fff;
        }
        .rz-rail-ico {
          width: 42px; height: 42px; border-radius: 50%;
          background: rgba(0,0,0,0.35); border: 1px solid rgba(255,255,255,0.14);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          display: grid; place-items: center;
          transition: transform 0.12s ease, background 0.15s;
        }
        .rz-rail-btn:active .rz-rail-ico { transform: scale(1.15); }
        .rz-rail-btn.is-liked { color: #ff4d6a; }
        .rz-rail-btn.is-liked .rz-rail-ico { background: rgba(255,77,106,0.16); border-color: rgba(255,77,106,0.4); }
        .rz-rail-btn span { font-size: 10.5px; font-weight: 800; text-shadow: 0 1px 3px rgba(0,0,0,0.6); font-variant-numeric: tabular-nums; }

        .rz-info {
          position: absolute; left: 14px; right: 74px; bottom: 18px; z-index: 8;
          display: flex; flex-direction: column; gap: 6px;
          background: linear-gradient(180deg, transparent, rgba(0,0,0,0.55) 40%);
          padding: 26px 0 0;
          pointer-events: none;
        }
        .rz-info > * { pointer-events: auto; }
        .rz-who { display: flex; align-items: center; gap: 9px; }
        .rz-avatar {
          width: 36px; height: 36px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
          background: linear-gradient(135deg, ${T.green}, #34c77a);
          color: #fff; font-weight: 800; font-size: 13px;
          display: flex; align-items: center; justify-content: center;
          border: 2px solid rgba(255,255,255,0.9);
        }
        .rz-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .rz-name-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .rz-name {
          font-size: 13.5px; font-weight: 800; color: #fff;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          text-shadow: 0 1px 4px rgba(0,0,0,0.5);
        }
        .rz-submeta { font-size: 10.5px; font-weight: 600; color: rgba(255,255,255,0.72); text-shadow: 0 1px 3px rgba(0,0,0,0.5); }
        .rz-badge {
          font-size: 8.5px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;
          color: #fff; background: ${T.green};
          border-radius: 999px; padding: 3px 7px; line-height: 1; white-space: nowrap;
          box-shadow: 0 2px 8px rgba(15,157,88,0.4);
        }
        .rz-caption {
          margin: 0; font-size: 12.5px; line-height: 1.4; color: rgba(255,255,255,0.92); font-weight: 600;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
          text-shadow: 0 1px 3px rgba(0,0,0,0.5);
        }

        .rz-sheet {
          position: absolute; left: 0; right: 0; bottom: 0; z-index: 40;
          background: ${T.surface};
          border-radius: 20px 20px 0 0;
          max-height: 62%;
          display: flex; flex-direction: column;
          box-shadow: 0 -8px 30px rgba(0,0,0,0.35);
        }
        .rz-sheet-bar { width: 40px; height: 4px; border-radius: 999px; background: ${T.border}; margin: 8px auto 0; flex-shrink: 0; }
        .rz-sheet-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 16px 8px; flex-shrink: 0;
        }
        .rz-sheet-head h3 { margin: 0; font-family: ${T.fontDisplay}; font-size: 14px; font-weight: 800; color: ${T.text}; }
        .rz-sheet-head button {
          border: none; background: ${T.bg}; color: ${T.textSub}; width: 30px; height: 30px;
          border-radius: 50%; cursor: pointer; display: grid; place-items: center;
        }
        .rz-sheet-body { overflow-y: auto; padding: 0 14px 14px; min-height: 120px; }
      `}</style>
    </div>
  )
}

function ReelSlide({ reel, index, active, muted, metric, isLast, onToggleLike, onComments, onShare, onEnded, copied }) {
  const videoRef = useRef(null)
  const [paused, setPaused] = useState(false)
  const [progress, setProgress] = useState(0)

  const url = reel.media_urls?.[0]
  const clip = useMemo(() => parseClipWindow(url), [url])
  const clipStart = clip?.start || 0
  const clipDur = clip?.duration || null
  const name = reel.profiles?.full_name || 'Seller'
  const avatar = reel.profiles?.avatar_url
  const initial = name[0]?.toUpperCase() || 'S'
  const isVerified = reel.profiles?.is_verified || false
  const caption = (reel.content || '').trim()
  const showCaption = caption && !/^(photo|video|status) update$/i.test(caption)

  useEffect(() => {
    const v = videoRef.current
    if (!v) return
    try { v.currentTime = clipStart } catch { /* ignore */ }
    /* eslint-disable react-hooks/set-state-in-effect -- sync play/pause UI with the active slide */
    setProgress(0)
    if (active) {
      setPaused(false)
      v.play().catch(() => setPaused(true))
    } else {
      v.pause()
    }
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [active, clipStart])

  function togglePlay() {
    const v = videoRef.current
    if (!v) return
    if (v.paused) { v.play().catch(() => {}); setPaused(false) }
    else { v.pause(); setPaused(true) }
  }

  return (
    <div className="rz-slide" data-reel-idx={index}>
      <div className="rz-progress" aria-hidden><i style={{ width: `${progress}%` }} /></div>

      <video
        ref={videoRef}
        className="rz-video"
        src={url}
        muted={muted}
        playsInline
        preload="metadata"
        loop={isLast}
        onTimeUpdate={e => {
          const d = e.currentTarget.duration
          const total = clipDur || (Number.isFinite(d) && d > clipStart ? d - clipStart : 0)
          if (total > 0) {
            const cur = e.currentTarget.currentTime - clipStart
            setProgress(Math.min(100, Math.max(0, (cur / total) * 100)))
          }
        }}
        onEnded={isLast ? undefined : onEnded}
        onError={() => setPaused(true)}
      />

      <div className="rz-tap" onClick={togglePlay} role="button" aria-label={paused ? 'Play' : 'Pause'} />

      {paused && (
        <div className="rz-paused" aria-hidden>
          <Play size={26} fill="#fff" stroke="none" />
        </div>
      )}

      {/* Action rail */}
      <div className="rz-rail">
        <motion.button
          type="button"
          whileTap={{ scale: 1.25 }}
          className={`rz-rail-btn${metric.myLike ? ' is-liked' : ''}`}
          onClick={onToggleLike}
          aria-pressed={!!metric.myLike}
          aria-label={metric.myLike ? 'Unlike' : 'Like'}
        >
          <span className="rz-rail-ico">
            <Heart size={19} fill={metric.myLike ? '#ff4d6a' : 'none'} strokeWidth={2.1} />
          </span>
          <span>{fmtCount(metric.likes)}</span>
        </motion.button>

        <button type="button" className="rz-rail-btn" onClick={onComments} aria-label="Comments">
          <span className="rz-rail-ico"><MessageCircle size={18} /></span>
          <span>Comments</span>
        </button>

        <button type="button" className="rz-rail-btn" onClick={onShare} aria-label="Share">
          <span className="rz-rail-ico"><Share2 size={18} /></span>
          <span>{copied ? 'Copied' : 'Share'}</span>
        </button>
      </div>

      {/* Author info */}
      <div className="rz-info">
        <div className="rz-who">
          <div className="rz-avatar">{avatar ? <img src={avatar} alt="" /> : initial}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="rz-name-row">
              <span className="rz-name">{name}</span>
              {isVerified && <VerifiedBadge />}
              <span className="rz-badge">Reel</span>
            </div>
            <div className="rz-submeta">
              {timeAgo(reel.created_at)} · {fmtCount(metric.views)} views
              {reel.location_hint ? ` · ${reel.location_hint}` : ''}
            </div>
          </div>
        </div>
        {showCaption && <p className="rz-caption">{caption}</p>}
      </div>
    </div>
  )
}
