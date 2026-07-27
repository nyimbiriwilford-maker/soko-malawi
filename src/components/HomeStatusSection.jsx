import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { ChevronRight, Plus, MapPin, ShoppingBag, Store, Briefcase, Wrench } from 'lucide-react'
import { STATUS_META } from '../constants/homeConstants'
import StatusUploadModal from './StatusUploadModal'
import { supabase } from '../lib/supabase'
import { isStatusVideoUrl } from '../utils/statusVideo'

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

const CATEGORIES = [
  { key: 'All',       label: 'All',       icon: null },
  { key: 'Nearby',    label: 'Nearby',    icon: <MapPin size={13} /> },
  { key: 'Products',  label: 'Products',  icon: <ShoppingBag size={13} /> },
  { key: 'Shops',     label: 'Shops',     icon: <Store size={13} /> },
  { key: 'Jobs',      label: 'Jobs',      icon: <Briefcase size={13} /> },
  { key: 'Services',  label: 'Services',  icon: <Wrench size={13} /> },
]

function timeAgo(iso) {
  const diff = Date.now() - new Date(iso)
  const h = Math.floor(diff / 3600000)
  const m = Math.floor(diff / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d`
  if (h >= 1) return `${h}h`
  if (m < 1) return 'now'
  return `${m}m`
}

function matchesCategory(s, key) {
  if (key === 'All') return true
  const kind = s.tagged_kind
  if (key === 'Products') return kind === 'listing'
  if (key === 'Shops') return kind === 'shop'
  if (key === 'Jobs') return kind === 'job'
  if (key === 'Services') return kind === 'service'
  if (key === 'Nearby') return !!(s.location_hint || s.profiles?.city)
  return true
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

function StatusCategoryChips({ categories, active, onSelect }) {
  return (
    <div className="hs-chip-rail" style={{
      display: 'flex', gap: 8, overflowX: 'auto', overflowY: 'hidden',
      paddingBottom: 4, marginBottom: 0,
      scrollbarWidth: 'none', msOverflowStyle: 'none', WebkitOverflowScrolling: 'touch',
    }}>
      {categories.map(cat => {
        const isActive = cat.key === active
        return (
          <button key={cat.key} type="button" className="hs-chip"
            onClick={() => onSelect(cat.key)}
            aria-pressed={isActive}
            style={{
              flexShrink: 0, border: 'none', cursor: 'pointer', fontFamily: 'inherit',
              background: isActive ? G.green : '#fff', color: isActive ? '#fff' : G.gray700,
              borderRadius: 999, padding: '6px 14px', fontSize: 12, fontWeight: isActive ? 700 : 600,
              whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: isActive ? '0 2px 10px rgba(15,157,88,0.25)' : '0 1px 2px rgba(0,0,0,0.04)',
              outline: isActive ? 'none' : '1px solid ' + G.gray200,
              transition: 'all 0.25s ease',
            }}
          >
            {cat.icon && <span style={{ fontSize: 13, lineHeight: 1 }}>{cat.icon}</span>}
            {cat.label}
          </button>
        )
      })}
    </div>
  )
}

function LazyMedia({ src, isVideo, style }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setVisible(true)
        observer.disconnect()
      }
    }, { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  if (!visible) return <div ref={ref} style={{ ...style, background: '#1a1a1a' }} />

  if (isVideo) {
    return (
      <div ref={ref} style={style}>
        <video src={src} muted playsInline preload="metadata"
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }

  return (
    <div ref={ref} style={style}>
      <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
    </div>
  )
}

function AddStatusCard({ onClick, currentUserId, navigate, userProfile }) {
  return (
    <button type="button" className="hs-add-btn"
      onClick={() => { if (!currentUserId) { navigate?.('/login'); return }; onClick() }}
      style={{
        flexShrink: 0, overflow: 'hidden',
        position: 'relative', cursor: 'pointer', border: '1.5px solid #16A34A',
        padding: 0, fontFamily: 'inherit',
        textAlign: 'center',
        background: '#FFFFFF',
        boxShadow: '0 8px 25px rgba(0,0,0,0.06)',
        transition: 'transform 0.25s ease, box-shadow 0.25s ease',
        scrollSnapAlign: 'start',
      }}
    >
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100%', padding: '0 20px',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%',
          background: '#16A34A', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: 14,
          boxShadow: '0 6px 15px rgba(22,163,74,0.25)',
          transition: 'transform 0.25s ease',
        }}>
          <Plus size={26} strokeWidth={3} />
        </div>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#111827', lineHeight: 1.2, letterSpacing: '0.02em', marginBottom: 2 }}>
          Create
        </span>
        <span style={{ fontSize: 17, fontWeight: 700, color: '#111827', lineHeight: 1.2, letterSpacing: '0.02em', marginBottom: 14 }}>
          Status
        </span>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1,
        }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF', lineHeight: 1.5, letterSpacing: '0.01em' }}>
            Sell Products
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF', lineHeight: 1.5, letterSpacing: '0.01em' }}>
            Promote Business
          </span>
          <span style={{ fontSize: 11, fontWeight: 500, color: '#9CA3AF', lineHeight: 1.5, letterSpacing: '0.01em' }}>
            Share Updates
          </span>
        </div>
      </div>
    </button>
  )
}

function StoryCard({ s, isOwn, viewedIds, onClick, marketplaceLabel, locationLabel, isMobile }) {
  const name = s.profiles?.full_name || 'Seller'
  const avatar = s.profiles?.avatar_url
  const media = s.media_urls?.[0]
  const isVideo = media && isStatusVideoUrl(media)
  const initial = name[0]?.toUpperCase() || 'S'
  const isVerified = s.profiles?.is_verified || s.profiles?.verified || false
  const group = s._ownGroup || [s]
  const allViewed = group.every(x => viewedIds.has(x.id))
  const ringItems = group.map(st => ({ id: st.id, viewed: viewedIds.has(st.id) }))
  const unseen = !allViewed && !isOwn
  const tagged = s.tagged || {}
  const title = tagged?.title || tagged?.name || s.content || null
  const price = tagged?.price != null ? `MK${Number(tagged.price).toLocaleString()}` : tagged?.rate || tagged?.salary || null

  if (isMobile) {
    return (
      <button type="button" className="hs-story-btn"
        onClick={onClick}
        style={{
          flexShrink: 0, borderRadius: 18, overflow: 'hidden',
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
          <LazyMedia src={media} isVideo={isVideo}
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
        ) : avatar ? (
          <img src={avatar} alt=""
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
            loading="lazy" />
        ) : null}

        <div className="hs-overlay" style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.15) 0%, transparent 35%, rgba(0,0,0,0.05) 50%, rgba(0,0,0,0.55) 100%)',
        }} />

        <div style={{
          position: 'absolute', top: 12, left: 12, zIndex: 3,
          display: 'flex', alignItems: 'center', gap: 8,
          maxWidth: 'calc(100% - 24px)',
        }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
              border: '2px solid #fff',
              background: 'linear-gradient(135deg,#0F9D58,#22c55e)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 13, fontWeight: 800,
              boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
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
                <VerifiedBadge size={14} />
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
              fontSize: 9, fontWeight: 700, color: '#fff',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              marginBottom: 1,
              textShadow: '0 1px 4px rgba(0,0,0,0.4)',
            }}>
              {title}
            </div>
          )}
          {price && (
            <div style={{
              fontSize: 8.5, fontWeight: 800, color: '#fbbf24',
              textShadow: '0 1px 4px rgba(0,0,0,0.4)',
              marginBottom: 1,
            }}>
              {price}
            </div>
          )}
          <div style={{
            fontSize: 7.5, fontWeight: 500, color: 'rgba(255,255,255,0.5)',
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
        flexShrink: 0, borderRadius: 20, overflow: 'hidden',
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
        <LazyMedia src={media} isVideo={isVideo}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      ) : avatar ? (
        <img src={avatar} alt=""
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          loading="lazy" />
      ) : null}

      <div className="hs-overlay" style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.05) 0%, transparent 40%, rgba(0,0,0,0.55) 100%)',
      }} />

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
      {price && (
        <div className="hs-tablet-hide" style={{
          position: 'absolute', top: 10, right: 10, zIndex: 2,
          fontSize: 10, fontWeight: 800, color: '#fbbf24',
          textShadow: '0 1px 4px rgba(0,0,0,0.4)',
        }}>
          {price}
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
              <div style={{
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
                <VerifiedBadge size={14} />
              </div>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
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
            fontSize: 10.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            marginLeft: 48,
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

export default function HomeStatusSection({ navigate, stories, loading, onCreateStory, currentUserId, currentUserProfile }) {
  const [viewedIds, setViewedIds] = useState(loadViewedStoryIds)
  const [showUpload, setShowUpload] = useState(false)
  const [activeCategory, setActiveCategory] = useState('All')
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  const [loadCount, setLoadCount] = useState(() => getInitCount(window.innerWidth))
  const scrollRef = useRef(null)
  const loadCountRef = useRef(loadCount)
  const [canScrollRight, setCanScrollRight] = useState(false)

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
    let filtered = storyGroups
    if (activeCategory !== 'All') {
      filtered = storyGroups.filter(s => matchesCategory(s, activeCategory))
    }
    const owned = filtered.filter(s => s.user_id === currentUserId)
    const rest = filtered.filter(s => s.user_id !== currentUserId)
    const scored = rest.map(s => ({ s, score: scoreStory(s) }))
    scored.sort((a, b) => b.score - a.score)
    return [...owned, ...scored.map(x => x.s)]
  }, [storyGroups, activeCategory, currentUserId])

  const hasStories = storyGroups.length > 0
  const activeCount = rankedStories.length

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
    const step = window.innerWidth >= 1024 ? 236 : (isMobile ? 166 : 216)
    scrollRef.current?.scrollBy({ left: step, behavior: 'smooth' })
  }

  const displayLimit = loadCount

  return (
    <>
      <style>{`
        .hs-rail::-webkit-scrollbar { display: none; }
        .hs-rail { -ms-overflow-style: none; scrollbar-width: none; position: relative; }
        .hs-rail { flex-wrap: nowrap !important; }

        .hs-story-btn, .hs-add-btn { width: 220px; height: 300px; }
        .hs-add-btn { border-radius: 20px; }

        @keyframes hsPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.75); }
        }
        @media (hover: hover) {
          .hs-story-btn:hover { transform: translateY(-6px) scale(1.02); box-shadow: 0 12px 30px rgba(0,0,0,0.15) !important; z-index: 50 !important; }
          .hs-story-btn img, .hs-story-btn video { transition: transform .35s ease, filter .35s ease; }
          .hs-story-btn:hover img, .hs-story-btn:hover video { transform: scale(1.04); filter: brightness(1.08) contrast(1.05); }
          .hs-story-btn:hover .hs-overlay { background: linear-gradient(180deg, rgba(0,0,0,0.05) 0%, transparent 35%, rgba(0,0,0,0.02) 50%, rgba(0,0,0,0.25) 100%) !important; }
          .hs-add-btn:hover { transform: translateY(-3px); box-shadow: 0 12px 30px rgba(22,163,74,0.12) !important; }
        }
        @media (hover: none) {
          .hs-story-btn:hover, .hs-add-btn:hover { transform: none !important; box-shadow: none !important; }
        }

        @media (max-width: 1023px) and (min-width: 768px) {
          .hs-story-btn, .hs-add-btn { width: 190px; height: 270px; }
          .hs-tablet-hide { display: none !important; }
        }

        @media (max-width: 767px) {
          .hs-story-btn, .hs-add-btn { width: 150px; height: 230px; scroll-snap-align: start; }
          .hs-add-btn { border-radius: 18px; }
          .hs-tablet-hide { display: none !important; }
          .hs-rail { gap: 10px; }
          .hs-chip { height: 40px; }
          .hs-section { margin-bottom: 24px !important; }
        }
      `}</style>

      <section className="hs-section" style={{ padding: '20px 0', marginBottom: 48, background: '#FFFFFF' }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 20px' }}>
          {loading ? (
            <div style={{
              background: G.surface, border: '1px solid ' + G.gray200, borderRadius: 24,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)',
              padding: '20px 24px',
            }}>
              <div className="skeleton" style={{ width: 140, height: 16, borderRadius: 6, marginBottom: 12 }} />
              <div style={{ display: 'flex', gap: 12, overflow: 'hidden' }}>
                {[1, 2, 3, 4, 5].map((_, k) => (
                  <div key={k} className="skeleton hs-story-btn"
                    style={{ borderRadius: 20 }} />
                ))}
              </div>
            </div>
          ) : (
            <div style={{
              background: G.surface, border: '1px solid ' + G.gray200, borderRadius: 24,
              boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.04)',
              padding: '20px 24px',
            }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                  <h2 style={{
                    margin: 0, fontFamily: G.fontDisplay, fontSize: 16, fontWeight: 800,
                    color: G.text, letterSpacing: -0.3,
                  }}>
                    Status Updates
                  </h2>
                  {hasStories && (
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      fontSize: 10, fontWeight: 700, letterSpacing: 0.3,
                      color: '#fff', background: '#dc2626',
                      borderRadius: 999, padding: '2px 10px 2px 8px',
                      lineHeight: 1.5,
                    }}>
                      <span style={{
                        display: 'inline-block', width: 6, height: 6, borderRadius: '50%',
                        background: '#fff',
                        animation: 'hsPulse 1.6s ease-in-out infinite',
                      }} />
                      LIVE · {activeCategory !== 'All' ? activeCategory : activeCount}
                    </span>
                  )}
                </div>
                <button type="button"
                  onClick={() => { if (rankedStories.length) openStoryGroup(rankedStories[0]) }}
                  style={{
                    border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', gap: 2,
                    padding: '4px 8px', fontSize: 12, fontWeight: 700, color: G.green,
                    borderRadius: 999, transition: 'background 0.25s ease',
                    whiteSpace: 'nowrap',
                  }}
                >
                  View All
                  <ChevronRight size={13} />
                </button>
              </div>

              <StatusCategoryChips
                categories={CATEGORIES}
                active={activeCategory}
                onSelect={setActiveCategory}
              />

              {rankedStories.length > 0 ? (
                <div style={{ position: 'relative', paddingTop: 10, paddingBottom: 10, marginTop: 4 }}>
                  <div ref={scrollRef}
                    className="hs-rail"
                    style={{
                      display: 'flex', gap: 16, overflowX: 'auto', overflowY: 'visible',
                      scrollSnapType: 'x mandatory',
                      WebkitOverflowScrolling: 'touch',
                      paddingTop: 10, paddingBottom: 4,
                      marginTop: -10,
                    }}
                  >
                    <AddStatusCard
                      onClick={() => setShowUpload(true)}
                      currentUserId={currentUserId}
                      navigate={navigate}
                      userProfile={currentUserProfile}
                    />
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
                    <button type="button"
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
                <div style={{
                  textAlign: 'center', padding: '40px 16px', marginTop: 8,
                  border: '1.5px dashed ' + G.gray200, borderRadius: 16,
                  color: G.textMuted,
                }}>
                  <p style={{ margin: '0 0 12px', fontSize: 13, fontWeight: 600 }}>
                    {activeCategory !== 'All'
                      ? `No ${activeCategory.toLowerCase()} stories right now`
                      : 'No live stories yet — share the first update.'}
                  </p>
                  {!loading && (
                    <button type="button"
                      onClick={() => { if (!currentUserId) { navigate?.('/login'); return }; setShowUpload(true) }}
                      style={{
                        border: 'none', background: G.green, color: '#fff', borderRadius: 10,
                        padding: '9px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
                        fontFamily: 'inherit', boxShadow: '0 3px 12px rgba(15,157,88,0.25)',
                      }}
                    >
                      Post status
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {showUpload && (
        <StatusUploadModal
          user={{ id: currentUserId }}
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false)
            onCreateStory?.()
          }}
        />
      )}
    </>
  )
}
