import { useState, useMemo, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { ChevronRight, Plus, ChevronLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { formatPrice } from '../lib/format'
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
const RING_VIEWED = '#c4c7cc'

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso)
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d`
  if (h >= 1) return `${h}h`
  if (m < 1) return 'now'
  return `${m}m`
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

function StoryCard({ s, isOwn, viewedIds, onClick, windowWidth }) {
  const avatarSize = windowWidth >= 769 ? 32 : 30
  const statusFontSize = windowWidth >= 769 ? 14 : 13
  const name = s.profiles?.full_name || 'Seller'
  const avatar = s.profiles?.avatar_url
  const media = s.media_urls?.[0]
  const isVideo = media && isStatusVideoUrl(media)
  const boardColor = isStatusColorBoard(media) ? media : null
  const initial = name[0]?.toUpperCase() || 'S'
  const isVerified = s.profiles?.is_verified || s.profiles?.verified || false
  const group = s._ownGroup || [s]
  const ringItems = group.map(st => ({ id: st.id, viewed: viewedIds.has(st.id) }))
  const tagged = s.tagged || {}
  const title = tagged?.title || tagged?.name || null
  const statusText = (s.content || '').trim()

  const taggedKind = s.tagged_kind || (s.tagged_listing_id ? 'listing' : null)
  const priceValue = tagged?.price
  const priceNumber = Number(priceValue)
  const hasPriceValue = priceValue !== null && priceValue !== undefined && priceValue !== ''
    && (Number.isFinite(priceNumber) || typeof priceValue === 'string')
  let priceLine = null
  if ((taggedKind === 'listing' || taggedKind === 'product' || taggedKind === 'request' || taggedKind === 'service') && hasPriceValue) {
    if (Number.isFinite(priceNumber)) {
      if (taggedKind === 'request') priceLine = `Budget ${formatPrice(priceNumber)}`
      else if (taggedKind === 'service') priceLine = `From ${formatPrice(priceNumber)}`
      else priceLine = formatPrice(priceNumber)
    } else {
      priceLine = taggedKind === 'request' ? `Budget ${priceValue}` : priceValue
    }
  }

  const statusCount = group.length
  const unseenCount = isOwn ? 0 : group.filter(x => !viewedIds.has(x.id)).length
  const isViewedCard = !isOwn && unseenCount === 0

  return (
    <button type="button" className="hs-story-btn"
      onClick={onClick}
      aria-label={isOwn ? name + ', your story' : isViewedCard ? name + ', viewed' : name + ', ' + unseenCount + ' new statuses'}
      style={{
        flexShrink: 0,
        display: 'flex', flexDirection: 'column', padding: 10, boxSizing: 'border-box',
        overflow: 'hidden', position: 'relative', cursor: 'pointer', border: 'none', fontFamily: 'inherit',
        textAlign: 'left', background: '#111',
        scrollSnapAlign: 'start',
        boxShadow: isOwn
          ? '0 4px 15px rgba(0,0,0,0.08)'
          : isViewedCard
            ? '0 0 0 1px rgba(0,0,0,0.08)'
            : '0 0 0 2.5px #0F9D58, 0 0 0 4.5px #e8f5ee',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
      }}
    >
      {media ? (
        <div style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', filter: isViewedCard ? 'saturate(0.75)' : undefined }}>
          {isViewedCard && (
            <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,23,42,0.28)', zIndex: 0, pointerEvents: 'none' }} />
          )}
          {boardColor ? (
            <StatusTextBoard color={boardColor} text="" className="board"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          ) : (
            <LazyMedia src={media} isVideo={isVideo}
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
          )}
        </div>
      ) : null}

      <div className="hs-overlay" style={{
        position: 'absolute', inset: 0, zIndex: 0,
        background: 'linear-gradient(0deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.25) 40%, rgba(0,0,0,0.25) 65%, rgba(0,0,0,0.55) 100%)',
      }} />

      {isVideo && (
        <div style={{
          position: 'absolute', bottom: 8, right: 8, zIndex: 3,
          width: 22, height: 22, borderRadius: '50%',
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="#fff" aria-hidden><polygon points="8,5 19,12 8,19" /></svg>
        </div>
      )}

      <div style={{
        position: 'relative', zIndex: 2, flex: 'none',
        display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', minWidth: 0,
        }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <StoryStatusRing items={ringItems} size={avatarSize}>
              <div className="hs-avatar" style={{
                width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden',
                background: 'linear-gradient(135deg,#0F9D58,#22c55e)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 12, fontWeight: 800,
              }}>
                {avatar
                  ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : initial}
              </div>
            </StoryStatusRing>
            {isVerified && (
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 14, height: 14, borderRadius: '50%', background: '#fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
              }}>
                <VerifiedBadge size={10} />
              </div>
            )}
          </div>
          <div style={{
            flexShrink: 0,
            width: 20, height: 20, borderRadius: '50%',
            background: isOwn ? 'rgba(0,0,0,0.7)' : isViewedCard ? 'rgba(0,0,0,0.55)' : '#0F9D58',
            backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0,
            fontSize: 11, fontWeight: 700, color: '#fff',
          }}>
            {isOwn ? statusCount : isViewedCard ? statusCount : unseenCount}
          </div>
        </div>
        <div style={{ width: '100%', minWidth: 0 }}>
          <div style={{
            fontSize: 12, fontWeight: 700, color: '#fff', lineHeight: 1.25,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          }}>
            {isOwn ? 'Your story' : name.split(' ')[0]}
          </div>
          <div style={{
            fontSize: 11, fontWeight: 500, color: 'rgba(255,255,255,0.8)', lineHeight: 1.25,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            textShadow: '0 1px 4px rgba(0,0,0,0.5)',
          }}>
            {timeAgo(s.created_at)}
          </div>
        </div>
      </div>

      <div style={{
        position: 'relative', zIndex: 2, flex: 1, minHeight: 0, overflow: 'hidden',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '6px 0',
      }}>
        {statusText && (
          <div style={{
            margin: 0, maxWidth: '100%',
            fontSize: statusFontSize, fontWeight: 700, color: '#fff', lineHeight: 1.25,
            textAlign: 'center', textShadow: '0 1px 4px rgba(0,0,0,0.6)',
            wordBreak: 'break-word',
            display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden',
          }}>
            {statusText}
          </div>
        )}
      </div>

      <div style={{ position: 'relative', zIndex: 2, flex: 'none' }}>
        {title && (
          <div style={{
            display: 'inline-block', boxSizing: 'border-box', maxWidth: '100%', marginBottom: 4,
            fontSize: 11, fontWeight: 700, color: '#fff',
            borderRadius: 999, padding: '3px 9px',
            background: 'rgba(0,0,0,0.45)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            lineHeight: 1.4,
          }}>
            {title}
          </div>
        )}
        {priceLine && (
          <div className="hs-price-line" style={{
            width: '100%',
            fontFamily: "'Sora', 'Inter', system-ui, sans-serif", fontWeight: 700,
            color: '#ffffff', textShadow: '0 1px 3px rgba(0,0,0,0.45)',
            whiteSpace: 'nowrap', overflow: 'visible', maxWidth: 'none',
          }}>
            {priceLine}
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
  const scrollRef = useRef(null)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [canScrollLeft, setCanScrollLeft] = useState(false)

  useEffect(() => {
    const handler = () => {
      setWindowWidth(window.innerWidth)
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
    const cards = Array.from(map.entries()).map(([, group], idx) => ({
      ...group[0],
      _ownGroup: group,
      _isCurrentUser: group[0].user_id === currentUserId,
      _groupIndex: idx,
    }))
    return cards
  }, [stories, currentUserId])

  const rankedStories = useMemo(() => {
    const owned = storyGroups.filter(s => s.user_id === currentUserId)
    const others = storyGroups.filter(s => s.user_id !== currentUserId)
    const withMeta = others.map(c => {
      const unseenCount = (c._ownGroup || []).filter(x => !viewedIds.has(x.id)).length
      const isViewed = unseenCount === 0
      const newest = Math.max(0, ...((c._ownGroup || []).map(x => new Date(x.created_at).getTime())))
      return { c, unseenCount, isViewed, newest }
    })
    const unviewed = withMeta.filter(x => !x.isViewed)
    const viewed = withMeta.filter(x => x.isViewed)
    const sortFn = (a, b) => {
      if (b.newest !== a.newest) return b.newest - a.newest
      return (a.c._groupIndex || 0) - (b.c._groupIndex || 0)
    }
    unviewed.sort(sortFn)
    viewed.sort(sortFn)
    return [...owned, ...unviewed.map(x => x.c), ...viewed.map(x => x.c)].slice(0, 13)
  }, [storyGroups, viewedIds, currentUserId])

  const visibleStories = rankedStories.slice(0, 12)
  const hasMoreStories = rankedStories.length > 12

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
    const overflow = el.scrollWidth > el.clientWidth + 4
    setCanScrollRight(overflow && el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
    setCanScrollLeft(overflow && el.scrollLeft > 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    let raf = 0
    const onScroll = () => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = 0; checkScroll() })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    const ro = new ResizeObserver(() => checkScroll())
    ro.observe(el)
    const t = setTimeout(checkScroll, 80)
    return () => {
      clearTimeout(t)
      el.removeEventListener('scroll', onScroll)
      ro.disconnect()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [checkScroll, rankedStories.length])

  // Mouse wheel horizontal scrolling (hover devices only)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const hover = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (!hover) return
    const onWheel = (e) => {
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
      const atStart = el.scrollLeft <= 4
      const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 4
      if (e.deltaY > 0 && atEnd) return
      if (e.deltaY < 0 && atStart) return
      e.preventDefault()
      el.scrollLeft += e.deltaY
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Click-and-drag (mouse only)
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const hover = window.matchMedia('(hover: hover) and (pointer: fine)').matches
    if (!hover) return
    let startX = 0
    let startScroll = 0
    let moved = false
    let pointerId = null
    const onDown = (e) => {
      if (e.pointerType !== 'mouse') return
      moved = false
      startX = e.clientX
      startScroll = el.scrollLeft
      pointerId = e.pointerId
      try { el.setPointerCapture(e.pointerId) } catch { /* ignore */ }
    }
    const onMove = (e) => {
      if (pointerId === null || e.pointerId !== pointerId) return
      const dx = e.clientX - startX
      if (!moved && Math.abs(dx) > 6) {
        moved = true
        el.style.cursor = 'grabbing'
        el.style.userSelect = 'none'
        el.style.scrollSnapType = 'none'
        el.style.scrollBehavior = 'auto'
      }
      if (moved) {
        el.scrollLeft = startScroll - dx
      }
    }
    const onUp = () => {
      if (moved) {
        const suppress = (ev) => { ev.preventDefault(); ev.stopPropagation() }
        el.addEventListener('click', suppress, { capture: true, once: true })
      }
      moved = false
      pointerId = null
      el.style.cursor = el.scrollWidth > el.clientWidth + 4 ? 'grab' : ''
      el.style.userSelect = ''
      el.style.scrollSnapType = ''
      el.style.scrollBehavior = ''
    }
    el.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    el.addEventListener('pointerleave', onUp)
    const updateCursor = () => {
      if (!moved) el.style.cursor = el.scrollWidth > el.clientWidth + 4 ? 'grab' : ''
    }
    updateCursor()
    const ro = new ResizeObserver(updateCursor)
    ro.observe(el)
    return () => {
      el.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      el.removeEventListener('pointerleave', onUp)
      ro.disconnect()
    }
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const onKeyDown = (e) => {
      const cards = Array.from(el.querySelectorAll('button.hs-story-btn, button.hs-add-btn'))
      const idx = cards.indexOf(document.activeElement)
      if (idx === -1) return
      if (e.key === 'ArrowRight') {
        if (idx < cards.length - 1) {
          e.preventDefault()
          cards[idx + 1].focus()
          cards[idx + 1].scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
        }
      } else if (e.key === 'ArrowLeft') {
        if (idx > 0) {
          e.preventDefault()
          cards[idx - 1].focus()
          cards[idx - 1].scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
        }
      } else if (e.key === 'Home') {
        e.preventDefault()
        cards[0]?.focus()
        cards[0]?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
      } else if (e.key === 'End') {
        e.preventDefault()
        const last = cards[cards.length - 1]
        last?.focus()
        last?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
      }
    }
    el.addEventListener('keydown', onKeyDown)
    return () => el.removeEventListener('keydown', onKeyDown)
  }, [rankedStories.length])

  function scrollByCards(dir) {
    const el = scrollRef.current
    if (!el) return
    el.scrollBy({ left: dir * Math.round(el.clientWidth * 0.8), behavior: 'smooth' })
  }
  function scrollRight() { scrollByCards(1) }
  function scrollLeft() { scrollByCards(-1) }

  return (
    <>
      <style>{`
         .hs-rail::-webkit-scrollbar { display: none; }
         .hs-rail { -ms-overflow-style: none; scrollbar-width: none; display: flex; flex-wrap: nowrap; gap: 12px; padding: 0; margin: 0; scroll-padding-left: 0; overflow-x: auto; overflow-y: hidden; position: relative; z-index: 1; background: transparent; scroll-snap-type: x proximity; scroll-behavior: smooth; overscroll-behavior-x: contain; }
         .hs-fade { position: absolute; top: 0; bottom: 0; width: 32px; pointer-events: none; z-index: 2; transition: opacity 0.2s ease; }
         .hs-fade-left { left: 0; background: linear-gradient(to right, #f8f9fa, transparent); }
         .hs-fade-right { right: 0; background: linear-gradient(to left, #f8f9fa, transparent); }
        @media (hover: none), (pointer: coarse) { .hs-fade { display: none !important; } .hs-rail-arrow { display: none !important; } }
         .hs-rail-wrap { width: 100%; margin: 0; padding: 0; background: transparent; overflow: visible; position: relative; z-index: 1; }
         .hs-section { margin: 28px 0; padding: 0; background: transparent; }
         @media (min-width: 1100px) { .hs-section { margin: 36px 0; } }
        .hs-story-btn:active { transform: scale(0.97); transition: transform 0.12s ease; }
        .hs-rail-arrow { opacity: 0; transition: opacity 0.2s ease; pointer-events: none; }
        .hs-rail-wrap:hover .hs-rail-arrow { opacity: 1; pointer-events: auto; }
        .hs-rail-arrow:hover { background: #f4fbf7 !important; border-color: #0F9D58 !important; }
        .hs-rail-arrow:active { transform: translateY(-50%) scale(0.94); }
        .hs-rail-arrow:focus-visible { outline: 2px solid #0F9D58; outline-offset: 2px; }
        @media (prefers-reduced-motion: reduce) {
          .hs-story-btn, .hs-story-btn img, .hs-story-btn video { transition: none; }
          .hs-story-btn:hover { transform: none; }
          .hs-story-btn:hover img, .hs-story-btn:hover video { transform: none; }
        }
         .hs-story-btn, .hs-add-btn, .hs-error-card { flex: 0 0 130px; width: 130px; height: 190px; border-radius: 16px; box-sizing: border-box; overflow: hidden; position: relative; scroll-snap-align: start; background: #0f172a; box-shadow: 0 1px 3px rgba(0,0,0,0.10), 0 4px 14px rgba(0,0,0,0.08); cursor: pointer; transition: transform 0.28s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.28s cubic-bezier(0.22, 1, 0.36, 1); will-change: transform; }
         @media (min-width: 769px) { .hs-story-btn, .hs-add-btn, .hs-error-card { flex-basis: 150px; width: 150px; height: 220px; } }
         .hs-price-line { font-size: 14px; }
         @media (max-width: 768px) { .hs-price-line { font-size: 12px; } }
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
         @keyframes hsSkelShimmer {
           0% { background-position: 200% 0; }
           100% { background-position: -200% 0; }
         }
         @media (prefers-reduced-motion: reduce) {
           .hs-skel-shimmer { animation: none !important; }
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
           .hs-tablet-hide { display: none !important; }
         }
         .hs-add-btn:focus-visible { outline: 2px solid #0F9D58; outline-offset: 3px; }
      `}</style>

        <section className="hs-section" style={{ background: 'transparent' }}>
          <div style={{ padding: windowWidth >= 769 ? '0 24px' : '0 14px', boxSizing: 'border-box', width: '100%' }}>
            <div style={{ maxWidth: 1400, margin: '0 auto', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: "'Sora', 'Inter', system-ui, sans-serif", fontSize: 20, fontWeight: 800, color: '#202124', letterSpacing: -0.3, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Live statuses</div>
                  <div style={{ fontSize: 13, color: '#5f6368', fontWeight: 500, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>See what sellers are offering today</div>
                </div>
                <button type="button" onClick={() => navigate?.('/status')}
                  style={{ background: 'none', border: 'none', padding: 0, fontSize: 13, fontWeight: 700, color: '#0F9D58', cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}>
                  View all <span style={{ fontSize: 14, lineHeight: 1 }}>→</span>
                </button>
              </div>
           {loading ? (
             <div style={isMobile ? { padding: '0' } : { padding: '0' }}>
               <div style={{ display: 'flex', gap: 12, overflow: 'hidden' }}>
                 <button type="button" className="hs-add-btn"
                   onClick={() => { if (!currentUserId) { navigate?.('/login'); return }; onCreateStory?.() }}
                   style={{
                     flexShrink: 0,
                     cursor: 'pointer', padding: 8, fontFamily: 'inherit',
                     textAlign: 'center', background: '#e6f6ed',
                     scrollSnapAlign: 'start',
                     border: '2px dashed #0F9D58',
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
                     fontFamily: "'DM Sans', system-ui, sans-serif",
                     fontSize: 13,
                     fontWeight: 700,
                     color: '#202124',
                   }}>
                     Add status
                   </div>
                 </button>
                 {[1, 2, 3, 4].map((_, k) => (
                   <div key={k} className="hs-story-btn hs-skel-card"
                     style={{ background: '#f1f3f4', position: 'relative', overflow: 'hidden', boxShadow: 'none' }}>
                     <div className="hs-skel-shimmer" style={{
                       position: 'absolute', inset: 0,
                       background: 'linear-gradient(90deg, #f1f3f4, #e8eaed, #f1f3f4)',
                       backgroundSize: '200% 100%',
                       animation: 'hsSkelShimmer 1.4s infinite',
                     }} />
                   </div>
                 ))}
               </div>
             </div>
             ) : (
            <div style={isMobile ? {} : {}}>
            {rankedStories.length > 0 ? (
                <div className="hs-rail-wrap" style={{ position: 'relative', padding: 0 }}>
                    <div className="hs-fade hs-fade-left" style={{ opacity: canScrollLeft ? 1 : 0 }} aria-hidden="true" />
                    <div className="hs-fade hs-fade-right" style={{ opacity: canScrollRight ? 1 : 0 }} aria-hidden="true" />
                    {windowWidth >= 1100 && canScrollLeft && (
                      <button type="button"
                        onClick={scrollLeft}
                        aria-label="Scroll statuses left"
                        style={{
                          position: 'absolute', top: '50%', left: 12, zIndex: 3,
                          transform: 'translateY(-50%)',
                          width: 44, height: 44, padding: 0, border: 'none',
                          background: 'transparent', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <span className="hs-rail-arrow" style={{
                          width: 40, height: 40, borderRadius: '50%',
                          background: '#ffffff',
                          border: '1px solid #e8eaed',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 4px 14px rgba(16,24,40,0.16)',
                          transition: 'opacity 0.2s ease, background 0.2s ease, border-color 0.2s ease, transform 0.1s ease',
                        }}>
                          <ChevronLeft size={20} color="#0F9D58" />
                        </span>
                      </button>
                    )}
                   <div ref={scrollRef}
                    className="hs-rail"
                    style={{
                      display: 'flex', gap: 12, overflowX: 'auto', overflowY: 'hidden',
                      scrollSnapType: 'x proximity',
                      WebkitOverflowScrolling: 'touch',
                      overscrollBehaviorX: 'contain',
                      scrollPaddingLeft: 0,
                      paddingRight: windowWidth >= 769 ? 24 : 14,
                    }}
                  >
                    <button ref={createCardRef} type="button" className="hs-add-btn"
                      onClick={() => { if (!currentUserId) { navigate?.('/login'); return }; onCreateStory?.() }}
                      style={{
                        flexShrink: 0,
                        cursor: 'pointer', padding: 8, fontFamily: 'inherit',
                        textAlign: 'center', background: '#e6f6ed',
                        scrollSnapAlign: 'start',
                        border: '2px dashed #0F9D58',
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
                         fontFamily: "'DM Sans', system-ui, sans-serif",
                         fontSize: 13,
                         fontWeight: 700,
                         color: '#202124',
                       }}>
                         Add status
                       </div>
                     </button>
                      {visibleStories.map(s => (
                       <StoryCard
                         key={s.user_id}
                         s={s}
                         isOwn={s.user_id === currentUserId}
                         viewedIds={viewedIds}
                         onClick={() => openStoryGroup(s)}
                         windowWidth={windowWidth}
                       />
                     ))}
                     {hasMoreStories && (
                       <button type="button" className="hs-story-btn"
                         onClick={() => navigate?.('/status')}
                         style={{
                           flexShrink: 0,
                           background: '#ffffff',
                           border: '1px solid #e8eaed',
                           borderRadius: 16,
                           boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                           cursor: 'pointer',
                           padding: 10,
                           boxSizing: 'border-box',
                           scrollSnapAlign: 'start',
                           display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                           gap: 12,
                           fontFamily: 'inherit',
                         }}
                         aria-label="View all statuses"
                       >
                         <div style={{
                           width: 44, height: 44, borderRadius: '50%',
                           background: '#0F9D58',
                           display: 'flex', alignItems: 'center', justifyContent: 'center',
                         }}>
                           <ChevronRight size={20} color="#fff" />
                         </div>
                         <div style={{
                           fontFamily: "'DM Sans', system-ui, sans-serif",
                           fontSize: 13, fontWeight: 700, color: '#202124',
                           textAlign: 'center',
                         }}>
                           View all statuses
                         </div>
                       </button>
                     )}
                   </div>

                    {windowWidth >= 1100 && canScrollRight && (
                      <button type="button"
                        onClick={scrollRight}
                        aria-label="Scroll statuses right"
                        style={{
                          position: 'absolute', top: '50%', right: 12, zIndex: 3,
                          transform: 'translateY(-50%)',
                          width: 44, height: 44, padding: 0, border: 'none',
                          background: 'transparent', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <span className="hs-rail-arrow" style={{
                          width: 40, height: 40, borderRadius: '50%',
                          background: '#ffffff',
                          border: '1px solid #e8eaed',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          boxShadow: '0 4px 14px rgba(16,24,40,0.16)',
                          transition: 'opacity 0.2s ease, background 0.2s ease, border-color 0.2s ease, transform 0.1s ease',
                        }}>
                          <ChevronRight size={20} color="#0F9D58" />
                        </span>
                      </button>
                    )}
                </div>
               ) : (
                  <div style={{ display: 'flex', gap: 12, padding: 0, margin: 0 }}>
                      <button ref={createCardRef} type="button" className="hs-add-btn"
                       onClick={() => { if (!currentUserId) { navigate?.('/login'); return }; onCreateStory?.() }}
                       style={{
                         flexShrink: 0,
                         cursor: 'pointer', padding: 8, fontFamily: 'inherit',
                         textAlign: 'center', background: '#e6f6ed',
                         scrollSnapAlign: 'start',
                         border: '2px dashed #0F9D58',
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
                         fontFamily: "'DM Sans', system-ui, sans-serif",
                         fontSize: 13,
                         fontWeight: 700,
                         color: '#202124',
                       }}>
                         Add status
                       </div>
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
               )}
             </div>
           )}
           </div>
         </div>
       </section>
    </>
  )
}
