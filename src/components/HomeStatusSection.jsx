import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { ChevronRight, Plus } from 'lucide-react'
import { STATUS_META } from '../constants/homeConstants'
import { supabase } from '../lib/supabase'
import { isStatusVideoUrl, isStatusColorBoard } from '../utils/statusVideo'
import StatusTextBoard from './StatusTextBoard'

const G = {
  green: '#0F9D58', greenLight: '#e8f5ee', greenMid: '#0a7a44',
  surface: '#ffffff', bg: '#f8f9fa',
  border: '#e8eaed', borderDark: '#dadce0',
  text: '#202124', textSub: '#5f6368', textMuted: '#80868b',
  gray100: '#f1f3f4', gray200: '#e8eaed', gray700: '#5f6368',
  font: "'Inter', 'DM Sans', system-ui, sans-serif",
  fontDisplay: "'Sora', 'Inter', system-ui, sans-serif",
}

const RING_ACTIVE = '#0F9D58'
const RING_VIEWED = '#c4c7c5'

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso)
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d`
  if (h >= 1) return `${h}h`
  if (m < 1) return 'now'
  return `${m}m`
}

function getMarketplaceLabel(s) {
  const kind = s.tagged_kind
  const type = s.status_type || ''
  const fromKind = kind ? STATUS_META[kind] : null
  if (fromKind) return { text: fromKind.label, type: kind }
  if (type === 'promo' || type === 'promotion' || s.is_promoted) return { text: 'PROMOTION', type: 'promotion' }
  if (kind === 'event' || type === 'event') return { text: 'EVENT', type: 'event' }
  return null
}

function getLocationText(s) {
  return s.location_hint || s.profiles?.city || null
}

function scoreStory(s) {
  let score = 0
  const ageHours = (Date.now() - new Date(s.created_at).getTime()) / 3600000
  score += Math.max(0, 72 - ageHours)
  if (s.tagged_kind === 'shop') score += 80
  else if (s.tagged_kind) score += 50
  if (s._statusCount > 1) score += 20
  if (s.media_urls?.length > 0) score += 15
  if (s.location_hint) score += 30
  if (s.profiles?.city) score += 10
  return score
}

function VerifiedBadge({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{ flexShrink: 0 }} aria-hidden>
      <path fill="#16a34a" d="M12 0a4 4 0 0 1 3.2 1.6 4 4 0 0 1 3.6 1 4 4 0 0 1 1 3.6A4 4 0 0 1 21.4 9.4a4 4 0 0 1 0 5.2A4 4 0 0 1 19.8 17.8a4 4 0 0 1-1 3.6 4 4 0 0 1-3.6 1A4 4 0 0 1 12 24a4 4 0 0 1-3.2-1.6 4 4 0 0 1-3.6-1 4 4 0 0 1-1-3.6A4 4 0 0 1 2.6 14.6a4 4 0 0 1 0-5.2A4 4 0 0 1 4.2 6.2a4 4 0 0 1 1-3.6 4 4 0 0 1 3.6-1A4 4 0 0 1 12 0Z"/>
      <path d="m7.5 12.5 3 3 6-7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function StoryStatusRing({ items = [], size = 56, children }) {
  const n = items.length
  const stroke = 2.5
  const pad = 1
  const r = (size - stroke) / 2 - pad
  const c = 2 * Math.PI * r
  const gap = n <= 1 ? 0 : Math.max(3, c * 0.025)
  const seg = (c - gap * n) / n
  const cx = size / 2
  const cy = size / 2

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden
        style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)', overflow: 'visible' }}
      >
        {n > 1 && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={G.gray200} strokeWidth={stroke} />
        )}
        {n > 1 && items.map((item, i) => (
          <circle key={item.id || i} cx={cx} cy={cy} r={r} fill="none"
            stroke={item.viewed ? RING_VIEWED : RING_ACTIVE} strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${Math.max(0.5, seg)} ${Math.max(0, c - seg)}`}
            strokeDashoffset={-(i * (seg + gap))}
            style={{ transition: 'stroke 0.3s ease' }}
          />
        ))}
        {n <= 1 && (
          <circle cx={cx} cy={cy} r={r} fill="none"
            stroke={items[0]?.viewed ? RING_VIEWED : RING_ACTIVE} strokeWidth={stroke}
            strokeDasharray={`${c} 0`}
          />
        )}
      </svg>
      <div style={{
        position: 'absolute', inset: stroke + 1, borderRadius: '50%', overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  )
}

let activePreviewVideo = null

function LazyMedia({ src, isVideo, style }) {
  const ref = useRef(null)
  const videoRef = useRef(null)
  const imgRef = useRef(null)
  const retriesRef = useRef(0)
  const timerRef = useRef(null)
  const [visible, setVisible] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [imgFailed, setImgFailed] = useState(false)
  const playedRef = useRef(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      setVisible(entry.isIntersecting)
    }, { rootMargin: '0px', threshold: 0.3 })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    const v = videoRef.current
    if (!v || !isVideo) return
    if (visible && !playedRef.current) {
      if (activePreviewVideo && activePreviewVideo !== v) {
        activePreviewVideo.pause()
        activePreviewVideo.currentTime = 0
      }
      activePreviewVideo = v
      v.currentTime = 0
      v.play().catch(() => {})
    } else if (!visible) {
      if (activePreviewVideo === v) {
        activePreviewVideo = null
      }
      v.pause()
      v.currentTime = 0
      playedRef.current = false
    }
    return () => {
      if (activePreviewVideo === v) activePreviewVideo = null
    }
  }, [visible, isVideo])

  function handleEnded() {
    playedRef.current = true
    if (activePreviewVideo === videoRef.current) {
      activePreviewVideo = null
    }
  }

  function handleImgError() {
    if (retriesRef.current < 2) {
      retriesRef.current++
      timerRef.current = setTimeout(() => {
        if (imgRef.current) {
          imgRef.current.src = ''
          imgRef.current.src = src
        }
      }, 1000 * retriesRef.current)
    } else {
      setImgFailed(true)
    }
  }

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  if (isVideo) {
    return (
      <div ref={ref} style={{ ...style, position: 'relative' }}>
        <video
          ref={videoRef}
          src={src}
          muted
          playsInline
          preload="auto"
          onEnded={handleEnded}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    )
  }

  if (!visible) return <div ref={ref} style={{ ...style, background: '#1a1a1a' }} />

  return (
    <div ref={ref} style={{ ...style, position: 'relative', overflow: 'hidden' }}>
      {!imgLoaded && !imgFailed && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(110deg, #1a1a1a 30%, #2a2a2a 50%, #1a1a1a 70%)',
          backgroundSize: '200% 100%',
          animation: 'shimmer 1.2s ease-in-out infinite',
        }} />
      )}
      {imgFailed ? (
        <div style={{
          position: 'absolute', inset: 0,
          background: '#1a1a1a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>
        </div>
      ) : (
         <img
           ref={imgRef}
           src={src}
           alt=""
           loading="lazy"
           decoding="async"
           onLoad={() => setImgLoaded(true)}
          onError={handleImgError}
          style={{
            width: '100%', height: '100%', objectFit: 'cover',
            display: 'block', opacity: imgLoaded ? 1 : 0,
            transition: 'opacity 0.2s ease',
          }}
        />
      )}
    </div>
  )
}

function StoryCard({ s, isOwn, viewedIds, onClick, marketplaceLabel, locationLabel, isMobile }) {
  const name = s.profiles?.full_name || 'Seller'
  const avatar = s.profiles?.avatar_url
  const media = s.media_urls?.[0]
  const isVideo = media && isStatusVideoUrl(media)
  const boardColor = isStatusColorBoard(media) ? media : null
  const initial = name[0]?.toUpperCase() || 'S'
  const isVerified = s.profiles?.is_verified || s.profiles?.verified || false
  const group = s._ownGroup || [s]
  const allViewed = group.every(x => viewedIds.has(x.id))
  const ringItems = group.map(st => ({ id: st.id, viewed: viewedIds.has(st.id) }))
  const unseen = !allViewed && !isOwn
  const tagged = s.tagged || {}
  // Text boards already show the words on the tile — don't repeat them in the label
  const title = tagged?.title || tagged?.name || null

  const statusCount = group.length

  if (isMobile) {
    return (
      <button type="button" className="hs-story-btn"
        onClick={onClick}
        style={{
flexShrink: 0,
position: 'relative', cursor: 'pointer', border: 'none', padding: 0, fontFamily: 'inherit',
textAlign: 'left', background: '#111',
          scrollSnapAlign: 'start',
          boxShadow: unseen
            ? '0 0 0 2px rgba(15,157,88,0.35), 0 4px 12px rgba(0,0,0,0.08)'
            : '0 4px 12px rgba(0,0,0,0.08)',
          transition: 'transform 0.25s ease, box-shadow 0.25s ease',
        }}
      >
        {media ? (
          <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            {boardColor ? (
               <StatusTextBoard color={boardColor} text={s.content} fontSize={14} maxLines={5} className="board"
                 style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
             ) : (
               <LazyMedia src={media} isVideo={isVideo}
                 style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
             )}
             {isVideo && (
               <div style={{ position: 'absolute', bottom: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
                 <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff" aria-hidden><polygon points="8,5 19,12 8,19" /></svg>
               </div>
             )}
           </div>
        ) : avatar ? (
          <img src={avatar} alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy" />
        ) : null}

        <div className="hs-overlay" style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(0deg, rgba(0,0,0,0.65) 0%, transparent 45%)',
        }} />

        <div style={{
          position: 'absolute', bottom: 8, right: 8, zIndex: 5,
          minWidth: 24, height: 20, borderRadius: 10,
          background: 'rgba(0,0,0,0.7)',
          backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '0 6px',
          fontSize: 11, fontWeight: 700, color: '#fff',
        }}>
          {statusCount}
        </div>

        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 3,
          display: 'flex', alignItems: 'center', gap: 8,
          maxWidth: 'calc(100% - 24px)',
        }}>
           <div style={{ position: 'relative', flexShrink: 0 }}>
             <div className="hs-avatar" style={{
               width: 32, height: 32, borderRadius: '50%', overflow: 'hidden',
               boxShadow: '0 0 0 2px #fff, 0 0 0 4px #0F9D58',
              background: 'linear-gradient(135deg,#0F9D58,#22c55e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
               color: '#fff', fontSize: 13, fontWeight: 800,
             }}>
              {avatar
                ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initial}
            </div>
            {isVerified && (
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }}>
                <VerifiedBadge size={12} />
              </div>
            )}
          </div>
          <span style={{
            fontSize: 9, fontWeight: 700, color: '#fff',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          }}>
            {isOwn ? 'Your story' : name.split(' ')[0]}
          </span>
        </div>

        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 2,
          padding: '24px 8px 7px',
          background: 'linear-gradient(0deg, rgba(0,0,0,0.65) 0%, transparent 100%)',
        }}>
          {marketplaceLabel && (
            <div style={{
              display: 'inline-block', marginBottom: 4,
              fontSize: 10, fontWeight: 600, letterSpacing: 0.2,
              color: '#fff', borderRadius: 999, padding: '3px 9px',
              background: 'rgba(0,0,0,0.45)',
              WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)',
              lineHeight: 1.4,
            }}>
              {marketplaceLabel.text}
            </div>
          )}
           {title && (
             <div style={{
               display: 'inline-block', marginBottom: 4,
               fontSize: 10.5, fontWeight: 700, color: '#fff',
               borderRadius: 999, padding: '3px 9px',
               background: 'rgba(0,0,0,0.45)',
               maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
               lineHeight: 1.4,
             }}>
               {title}
             </div>
           )}

          <div style={{
            fontSize: 10.5, fontWeight: 500, color: 'rgba(255,255,255,0.8)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {locationLabel && <span>{locationLabel} · </span>}
            {timeAgo(s.created_at)}
          </div>
        </div>
      </button>
    )
  }

  return (
    <button type="button" className="hs-story-btn"
      onClick={onClick}
      style={{
        flexShrink: 0,
        position: 'relative', cursor: 'pointer', border: 'none', padding: 0, fontFamily: 'inherit',
        textAlign: 'left', background: '#111',
        scrollSnapAlign: 'start',
        boxShadow: unseen
          ? '0 0 0 2px rgba(15,157,88,0.35), 0 4px 15px rgba(0,0,0,0.08)'
          : '0 4px 15px rgba(0,0,0,0.08)',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
      }}
    >
{media ? (
          <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
            {boardColor ? (
               <StatusTextBoard color={boardColor} text={s.content} fontSize={14} maxLines={5} className="board"
                 style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
             ) : (
               <LazyMedia src={media} isVideo={isVideo}
                 style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
             )}
             {isVideo && (
               <div style={{ position: 'absolute', bottom: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3 }}>
                 <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff" aria-hidden><polygon points="8,5 19,12 8,19" /></svg>
               </div>
             )}
           </div>
      ) : avatar ? (
        <img src={avatar} alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy" />
      ) : null}

      <div className="hs-overlay" style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.65) 0%, transparent 45%)',
      }} />

      <div style={{
        position: 'absolute', bottom: 8, right: 8, zIndex: 5,
        minWidth: 24, height: 20, borderRadius: 10,
        background: 'rgba(0,0,0,0.7)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 6px',
        fontSize: 11, fontWeight: 700, color: '#fff',
      }}>
        {statusCount}
      </div>

      {isVideo && (
        <div className="hs-tablet-hide" style={{
          position: 'absolute', top: '50%', left: '50%', zIndex: 2,
          width: 28, height: 28, borderRadius: '50%',
          marginTop: -14, marginLeft: -14,
          background: 'rgba(0,0,0,0.5)',
          border: '2px solid rgba(255,255,255,0.3)',
          backdropFilter: 'blur(4px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" aria-hidden>
            <polygon points="8,5 19,12 8,19" />
          </svg>
        </div>
      )}

      {marketplaceLabel && (
        <div className="hs-tablet-hide" style={{
          position: 'absolute', top: 10, left: 10, zIndex: 2,
          fontSize: 10, fontWeight: 700, letterSpacing: 0.2,
          color: '#fff', borderRadius: 20, padding: '3px 10px',
          background: 'rgba(0,0,0,0.45)',
          WebkitBackdropFilter: 'blur(8px)', backdropFilter: 'blur(8px)',
          lineHeight: 1.4,
        }}>
          {marketplaceLabel.text}
        </div>
      )}


      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '30px 12px 10px', zIndex: 2,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.7) 0%, transparent 100%)',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
        }}>
          <div style={{ position: 'relative' }}>
            <StoryStatusRing items={ringItems} size={40}>
               <div className="hs-avatar" style={{
                 width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden',
                 background: 'linear-gradient(135deg,#0F9D58,#22c55e)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 11, fontWeight: 800,
              }}>
                {avatar
                  ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initial}
              </div>
            </StoryStatusRing>
            {isVerified && (
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 16, height: 16, borderRadius: '50%', background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }}>
                <VerifiedBadge size={12} />
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="hs-name" style={{
              fontSize: 12, fontWeight: 700, color: '#fff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {isOwn ? 'Your story' : name.split(' ')[0]}
            </div>
            <div style={{
              fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.6)',
              display: 'flex', alignItems: 'center', gap: 4,
            }}>
              {locationLabel && <span>{locationLabel} · </span>}
              {timeAgo(s.created_at)}
            </div>
          </div>
        </div>
        {title && (
          <div style={{
            display: 'inline-block', marginBottom: 4,
            fontSize: 10.5, fontWeight: 700, color: '#fff',
            borderRadius: 999, padding: '3px 9px',
            background: 'rgba(0,0,0,0.45)',
            maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            lineHeight: 1.4,
          }}>
            {title}
          </div>
        )}
      </div>
    </button>
  )
}

function loadViewedStoryIds() {
  try {
    const raw = JSON.parse(localStorage.getItem('viewedStories') || '[]')
    return new Set(Array.isArray(raw) ? raw : [])
  } catch { return new Set() }
}

function persistViewedStoryIds(set) {
  try {
    localStorage.setItem('viewedStories', JSON.stringify([...set]))
  } catch { /* ignore */ }
}

function getInitCount(w) { return w >= 1024 ? 5 : 4 }

export default function HomeStatusSection({ navigate, stories, loading, error, onRetry, onCreateStory, currentUserId }) {
  const [viewedIds, setViewedIds] = useState(loadViewedStoryIds)
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const [loadCount, setLoadCount] = useState(() => getInitCount(window.innerWidth))
  const scrollRef = useRef(null)
  const loadCountRef = useRef(loadCount)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)

  useEffect(() => { loadCountRef.current = loadCount }, [loadCount])

  useEffect(() => {
    const handler = () => {
      setWindowWidth(window.innerWidth)
      setLoadCount(getInitCount(window.innerWidth))
    }
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const isMobile = windowWidth < 768

  useEffect(() => {
    let cancelled = false
    const ids = (stories || []).map(s => s.id).filter(Boolean)
    if (!currentUserId || ids.length === 0) return undefined
    ;(async () => {
      try {
        const { data } = await supabase
          .from('status_views')
          .select('status_id')
          .eq('viewer_id', currentUserId)
          .in('status_id', ids)
        if (cancelled || !data) return
        setViewedIds(prev => {
          const next = new Set(prev)
          data.forEach(r => { if (r.status_id) next.add(r.status_id) })
          persistViewedStoryIds(next)
          return next
        })
      } catch { /* ignore */ }
    })()
    return () => { cancelled = true }
  }, [currentUserId, stories])

  const storyGroups = useMemo(() => {
    const map = new Map()
    for (const s of stories || []) {
      if (!map.has(s.user_id)) map.set(s.user_id, [])
      map.get(s.user_id).push(s)
    }
    const cards = Array.from(map.values()).map(group => ({
      ...group[0],
      _ownGroup: group,
      _isCurrentUser: group[0].user_id === currentUserId,
    }))
    const own = cards.filter(c => c.user_id === currentUserId)
    const others = cards.filter(c => c.user_id !== currentUserId)
    return [...own, ...others]
  }, [stories, currentUserId])

  const rankedStories = useMemo(() => {
    const owned = storyGroups.filter(s => s.user_id === currentUserId)
    const rest = storyGroups.filter(s => s.user_id !== currentUserId)
    const scored = rest.map(s => ({ s, score: scoreStory(s) }))
    scored.sort((a, b) => b.score - a.score)
    return [...owned, ...scored.map(x => x.s)].slice(0, 20)
  }, [storyGroups, currentUserId])


  // Create Status card is the first rail item. With 2+ posted statuses it is
  // scrolled off-screen before first paint so landing/refresh shows only
  // posted status cards; scrolling back left reveals the create card.
  // With 0–1 posters it stays visible at the start of the rail so mobile
  // fills its two visible slots (create + the single posted status).
  const createCardRef = useRef(null)
  const hideCreateCard = rankedStories.length > 1
  const layoutKey = isMobile ? 'm' : windowWidth < 1024 ? 't' : 'd'

  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    if (!hideCreateCard) {
      el.scrollLeft = 0
      return
    }
    const btn = createCardRef.current
    if (!btn || !btn.offsetWidth) return
    const cs = window.getComputedStyle(el)
    const gap = parseFloat(cs.columnGap || cs.gap) || (isMobile ? 10 : 16)
    el.scrollLeft = btn.offsetWidth + gap
  }, [hideCreateCard, layoutKey, loading, isMobile])

  function openStoryGroup(s) {
    const ids = s._ownGroup ? s._ownGroup.map(x => x.id) : [s.id]
    setViewedIds(prev => {
      const next = new Set([...prev, ...ids])
      persistViewedStoryIds(next)
      return next
    })
    if (currentUserId) {
      ids.forEach(id => {
        supabase.from('status_views')
          .upsert({ status_id: id, viewer_id: currentUserId }, { onConflict: 'status_id,viewer_id' })
          .then(() => {}, () => {})
      })
    }
    navigate(`/story/${s.id}`)
  }

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8)
    setCanScrollLeft(el.scrollLeft > 8)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const t = setTimeout(checkScroll, 80)
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => {
      clearTimeout(t)
      el.removeEventListener('scroll', checkScroll)
      window.removeEventListener('resize', checkScroll)
    }
  }, [checkScroll, rankedStories.length])

  const handleRailScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    const nearEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 160
    if (nearEnd) {
      const current = loadCountRef.current
      if (current >= rankedStories.length) return
      const w = window.innerWidth
      const inc = w >= 1024 ? 3 : (w < 768 ? 3 : 2)
      setLoadCount(Math.min(current + inc, rankedStories.length))
    }
  }, [rankedStories.length])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.addEventListener('scroll', handleRailScroll, { passive: true })
    return () => el.removeEventListener('scroll', handleRailScroll)
  }, [handleRailScroll])

  function scrollRight() {
    const step = (window.innerWidth >= 1100 ? 196 : 148) * 3 + 14
    scrollRef.current?.scrollBy({ left: step, behavior: 'smooth' })
  }
  function scrollLeft() {
    const step = (window.innerWidth >= 1100 ? 196 : 148) * 3 + 14
    scrollRef.current?.scrollBy({ left: -step, behavior: 'smooth' })
  }

  const displayLimit = loadCount

  return (
    <>
      <style>{`
        .hs-rail::-webkit-scrollbar { display: none; }
        .hs-rail { padding: 24px 14px 12px; margin: 0; scroll-padding-left: 14px; overflow-x: auto; overflow-y: hidden; position: relative; z-index: 1; background: transparent; height: auto; max-height: none; }
        .hs-rail-wrap { width: 100vw; margin-left: calc(50% - 50vw); margin-top: 0; padding-top: 0; background: transparent; overflow: visible; position: relative; z-index: 2; }
        .hs-story-btn:active { transform: scale(0.97); transition: transform 0.12s ease; }
        .hs-rail-arrow { opacity: 0; transition: opacity 0.2s ease; pointer-events: none; }
        .hs-rail-wrap:hover .hs-rail-arrow { opacity: 1; pointer-events: auto; }
        @media (prefers-reduced-motion: reduce) {
          .hs-story-btn, .hs-story-btn img, .hs-story-btn video { transition: none; }
          .hs-story-btn:hover { transform: none; }
          .hs-story-btn:hover img, .hs-story-btn:hover video { transform: none; }
        }
        .hs-rail { -ms-overflow-style: none; scrollbar-width: none; position: relative; }
        .hs-rail { flex-wrap: nowrap !important; }
        .hs-chip-rail::-webkit-scrollbar { display: none; }

        .hs-story-btn, .hs-add-btn { flex: 0 0 148px; width: 148px; aspect-ratio: 9 / 14; border-radius: 16px; overflow: hidden; position: relative; scroll-snap-align: start; background: #0f172a; box-shadow: 0 1px 3px rgba(0,0,0,0.10), 0 4px 14px rgba(0,0,0,0.08); cursor: pointer; transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.28s cubic-bezier(0.22, 1, 0.36, 1); will-change: transform; }
        .hs-story-btn img, .hs-story-btn video, .hs-story-btn .board { transition: transform 0.6s cubic-bezier(0.22, 1, 0.36, 1); }
        .hs-story-btn::after { content: ''; position: absolute; inset: 0; border-radius: inherit; box-shadow: inset 0 0 0 1.5px rgba(15,157,88,0); transition: box-shadow 0.28s ease; pointer-events: none; }
        @media (hover: hover) and (pointer: fine) {
          .hs-story-btn:hover { transform: translateY(-2px); box-shadow: 0 2px 4px rgba(0,0,0,0.08), 0 14px 32px rgba(0,0,0,0.18); }
          .hs-story-btn:hover img, .hs-story-btn:hover video { transform: scale(1.06); }
          .hs-story-btn:hover::after { box-shadow: inset 0 0 0 1.5px rgba(15,157,88,0.55); }
        }
        .hs-story-btn:active { transform: scale(0.97); transition-duration: 0.12s; }
        .hs-story-btn:focus-visible { outline: 2px solid #0F9D58; outline-offset: 3px; }

        @keyframes hsPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.75); }
        }
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @media (hover: hover) {
           .hs-story-btn:hover img,
           .hs-story-btn:hover video { transform: scale(1.06); }
          .hs-story-btn img, .hs-story-btn video { transition: transform .35s ease, filter .35s ease; }
          .hs-story-btn:hover img, .hs-story-btn:hover video { transform: scale(1.04); filter: brightness(1.08) contrast(1.05); }
          .hs-story-btn:hover .hs-overlay { background: linear-gradient(180deg, rgba(0,0,0,0.05) 0%, transparent 35%, rgba(0,0,0,0.02) 50%, rgba(0,0,0,0.25) 100%) !important; }
          .hs-add-btn:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(22,163,74,0.12) !important; }
        }
        @media (hover: none) {
          .hs-story-btn:hover, .hs-add-btn:hover { transform: none !important; box-shadow: none !important; }
        }

        @media (max-width: 1023px) and (min-width: 768px) {
          .hs-tablet-hide { display: none !important; }
        }

        @media (max-width: 767px) {
          .hs-add-btn { border-radius: 18px; }
          .hs-tablet-hide { display: none !important; }
          .hs-rail { gap: 10px; }
          .hs-chip { height: 40px; }
          .hs-section { margin-bottom: 0 !important; overflow: visible; }
        }
        @media (min-width: 768px) {
          .hs-rail { gap: 12px; padding: 24px 20px 12px; scroll-padding-left: 20px; }
          .hs-story-btn, .hs-add-btn { flex-basis: 170px; width: 170px; }
        }
        @media (min-width: 1100px) {
          .hs-rail { gap: 14px; padding: 24px 24px 12px; scroll-padding-left: 24px; }
          .hs-story-btn, .hs-add-btn { flex-basis: 196px; width: 196px; border-radius: 18px; }
          .hs-story-btn .hs-avatar, .hs-add-btn .hs-avatar { width: 36px; height: 36px; }
          .hs-story-btn .hs-name { font-size: 13px; }
        }
        @media (min-width: 1600px) {
          .hs-story-btn, .hs-add-btn { flex-basis: 210px; width: 210px; }
          .hs-error-card { flex-basis: 210px; width: 210px; }
        }
        .hs-error-card { flex: 0 0 148px; width: 148px; aspect-ratio: 9 / 14; border-radius: 16px; box-sizing: border-box; scroll-snap-align: start; }
        @media (min-width: 768px) { .hs-error-card { flex-basis: 170px; width: 170px; } }
        @media (min-width: 1100px) { .hs-error-card { flex-basis: 196px; width: 196px; border-radius: 18px; } }
        .hs-add-btn:focus-visible { outline: 2px solid #0F9D58; outline-offset: 3px; }
        @media (hover: hover) and (pointer: fine) {
          .hs-add-btn:hover { border-color: #0F9D58 !important; background: #f4fbf7 !important; }
        }
        @media (min-width: 1100px) {
          .hs-add-btn .hs-create-plus { width: 48px !important; height: 48px !important; }
        }
      `}</style>

      <section className="hs-section" style={{
        padding: '12px 0 0',
        marginBottom: 0,
        background: 'transparent',
      }}>
        <div style={isMobile ? { padding: '0 20px' } : { maxWidth: 1400, margin: '0 auto', padding: '0 20px' }}>
          {loading ? (
            <div style={isMobile ? { padding: '0' } : { padding: '0' }}>
              <div className="skeleton" style={{ width: 140, height: 16, borderRadius: 6, marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 12, overflow: 'hidden' }}>
                {[1, 2, 3, 4, 5, 6].map((_, k) => (
                  <div key={k} className="skeleton hs-story-btn"
                    style={{ borderRadius: 16 }} />
                ))}
              </div>
            </div>
            ) : (
            <div style={isMobile ? {} : {}}>
            {rankedStories.length > 0 ? (
                <div className="hs-rail-wrap" style={{ position: 'relative', padding: 0, margin: 0 }}>
                  {canScrollLeft && !isMobile && (
                    <button type="button" className="hs-rail-arrow"
                      onClick={scrollLeft}
                      style={{
                        position: 'absolute', top: '50%', left: -4, zIndex: 10,
                        transform: 'translateY(-50%)',
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.96)',
                        border: '1px solid ' + G.gray200,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        color: '#374151', padding: 0, fontFamily: 'inherit',
                        transition: 'all 0.2s ease',
                      }}
                      aria-label="Scroll left"
                    >
                      <ChevronRight size={16} style={{ transform: 'rotate(180deg)' }} />
                    </button>
                  )}
                  <div ref={scrollRef}
                    className="hs-rail"
                    style={{
                      display: 'flex', gap: 10, overflowX: 'auto', overflowY: 'hidden',
                      scrollSnapType: 'x proximity',
                      WebkitOverflowScrolling: 'touch',
                      overscrollBehaviorX: 'contain',
                      scrollPaddingLeft: '14px',
                    }}
                  >
                    <button ref={createCardRef} type="button" className="hs-add-btn"
                      onClick={() => { if (!currentUserId) { navigate?.('/login'); return }; onCreateStory?.() }}
                      style={{
                        flexShrink: 0,
                        cursor: 'pointer', padding: 14, fontFamily: 'inherit',
                        textAlign: 'center', background: '#ffffff',
                        scrollSnapAlign: 'start',
                        border: '1.5px dashed rgba(15,157,88,0.45)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        transition: 'all 0.25s ease',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 10,
                        boxSizing: 'border-box',
                      }}
                    >
                      <div className="hs-create-plus" style={{
                        width: 44, height: 44,
                        borderRadius: '50%',
                        background: '#0F9D58',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 6px 16px rgba(15,157,88,0.28)',
                      }}>
                        <Plus size={22} color="#fff" strokeWidth={2.5} />
                      </div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#202124',
                        letterSpacing: -0.2,
                      }}>
                        Create Status
                      </div>
                      {rankedStories.length === 0 && (
                        <div style={{
                          fontSize: 11.5,
                          fontWeight: 500,
                          color: '#5f6368',
                          lineHeight: 1.45,
                          maxWidth: 140,
                          textAlign: 'center',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          Share what you're selling today.
                        </div>
                      )}
                    </button>
                    {rankedStories.slice(0, displayLimit).map(s => (
                      <StoryCard
                        key={s.user_id}
                        s={s}
                        isOwn={s.user_id === currentUserId}
                        viewedIds={viewedIds}
                        onClick={() => openStoryGroup(s)}
                        marketplaceLabel={getMarketplaceLabel(s)}
                        locationLabel={getLocationText(s)}
                        isMobile={isMobile}
                      />
                    ))}
                  </div>

                  {canScrollRight && !isMobile && (
                    <button type="button" className="hs-rail-arrow"
                      onClick={scrollRight}
                      style={{
                        position: 'absolute', top: '50%', right: -4, zIndex: 10,
                        transform: 'translateY(-50%)',
                        width: 36, height: 36, borderRadius: '50%',
                        background: 'rgba(255,255,255,0.96)',
                        border: '1px solid ' + G.gray200,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                        color: '#374151', padding: 0, fontFamily: 'inherit',
                        transition: 'all 0.2s ease',
                      }}
                      aria-label="Scroll right"
                    >
                      <ChevronRight size={16} />
                    </button>
                  )}
                </div>
              ) : (
                <div className="hs-rail-wrap" style={{ position: 'relative', padding: 0, margin: 0 }}>
                  <div ref={scrollRef}
                    className="hs-rail"
                    style={{
                      display: 'flex', gap: 10, overflowX: 'auto', overflowY: 'hidden',
                      scrollSnapType: 'x proximity',
                      WebkitOverflowScrolling: 'touch',
                      overscrollBehaviorX: 'contain',
                      scrollPaddingLeft: '14px',
                    }}
                  >
                    <button ref={createCardRef} type="button" className="hs-add-btn"
                      onClick={() => { if (!currentUserId) { navigate?.('/login'); return }; onCreateStory?.() }}
                      style={{
                        flexShrink: 0,
                        cursor: 'pointer', padding: 14, fontFamily: 'inherit',
                        textAlign: 'center', background: '#ffffff',
                        scrollSnapAlign: 'start',
                        border: '1.5px dashed rgba(15,157,88,0.45)',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
                        transition: 'all 0.25s ease',
                        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                        gap: 10,
                        boxSizing: 'border-box',
                      }}
                    >
                      <div className="hs-create-plus" style={{
                        width: 44, height: 44,
                        borderRadius: '50%',
                        background: '#0F9D58',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 6px 16px rgba(15,157,88,0.28)',
                      }}>
                        <Plus size={22} color="#fff" strokeWidth={2.5} />
                      </div>
                      <div style={{
                        fontSize: 13,
                        fontWeight: 700,
                        color: '#202124',
                        letterSpacing: -0.2,
                      }}>
                        Create Status
                      </div>
                      {rankedStories.length === 0 && (
                        <div style={{
                          fontSize: 11.5,
                          fontWeight: 500,
                          color: '#5f6368',
                          lineHeight: 1.45,
                          maxWidth: 140,
                          textAlign: 'center',
                          display: '-webkit-box',
                          WebkitLineClamp: 3,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}>
                          Share what you're selling today.
                        </div>
                      )}
                    </button>

                    {error ? (
                      <section className="hs-error-card" aria-label="Couldn't load statuses"
                        style={{
                          background: 'linear-gradient(160deg, #e8f5ee 0%, #f0fdf4 55%, #fff8e1 100%)',
                          border: '1px solid rgba(15,157,88,0.14)',
                          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                          gap: 10, padding: 16, boxSizing: 'border-box', textAlign: 'center',
                        }}
                      >
                        <div style={{
                          width: 44, height: 44, borderRadius: '50%', background: '#ffffff',
                          boxShadow: '0 4px 14px rgba(15,157,88,0.18)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0F9D58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                          </svg>
                        </div>
                        <div style={{ fontSize: 14, fontWeight: 800, color: '#202124', fontFamily: G.fontDisplay }}>Couldn't load statuses</div>
                        <div style={{ fontSize: 12, fontWeight: 600, color: '#5f6368', lineHeight: 1.45, maxWidth: '100%' }}>Check your connection and try again.</div>
                        <button type="button"
                          onClick={() => { if (typeof onRetry === 'function') onRetry() }}
                          style={{
                            border: 'none', background: '#0F9D58', color: '#fff', borderRadius: 999,
                            padding: '8px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                            fontFamily: 'inherit', boxShadow: '0 4px 12px rgba(15,157,88,0.28)',
                          }}
                        >
                          Retry
                        </button>
                      </section>
                    ) : null}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
    </>
  )
}
