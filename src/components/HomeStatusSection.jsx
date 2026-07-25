import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import StoryViewer from './StoryViewer'
import StatusUploadModal from './StatusUploadModal'
import { supabase } from '../lib/supabase'

const T = {
  green:      '#0F9D58',
  greenLight: '#e8f5ee',
  greenMid:   '#0a7a44',
  greenGlow:  'rgba(15,157,88,0.12)',
  orange:     '#F9AB00',
  orangeDeep: '#e65100',
  orangeLight:'#fff8e1',
  surface:    '#ffffff',
  bg:         '#f8f9fa',
  border:     '#e8eaed',
  borderDark: '#dadce0',
  text:       '#202124',
  textSub:    '#5f6368',
  textMuted:  '#80868b',
  verified:   '#1A73E8',
  gray100:    '#f1f3f4',
  gray200:    '#e8eaed',
  gray400:    '#bdc1c6',
  gray500:    '#9aa0a6',
  gray600:    '#80868b',
  gray700:    '#5f6368',
  gray900:    '#202124',
  shadow:     '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)',
  shadowMd:   '0 4px 12px rgba(0,0,0,0.11), 0 8px 28px rgba(0,0,0,0.08)',
  font:       "'Inter', 'DM Sans', system-ui, sans-serif",
  fontDisplay:"'Sora', 'Inter', system-ui, sans-serif",
}

const CARD_GRADIENTS = [
  'linear-gradient(165deg,#052e1c 0%,#0F9D58 55%,#34c77a 100%)',
  'linear-gradient(165deg,#0c1929 0%,#1A73E8 55%,#60a5fa 100%)',
  'linear-gradient(165deg,#1a0a00 0%,#c88a00 50%,#F9AB00 100%)',
  'linear-gradient(165deg,#1a0530 0%,#7c3aed 55%,#a78bfa 100%)',
  'linear-gradient(165deg,#0a1628 0%,#0e7490 55%,#22d3ee 100%)',
  'linear-gradient(165deg,#1c0a12 0%,#be123c 55%,#fb7185 100%)',
]

const RING_ACTIVE = '#f9a825'
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

function Badge({ children, color = T.green, bg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: bg || T.greenLight,
      color, borderRadius: 999, padding: '3px 9px',
      fontSize: 10.5, fontWeight: 700, lineHeight: 1.3, letterSpacing: 0.2,
    }}>{children}</span>
  )
}

function VerifiedBadge() {
  return (
    <svg width="14" height="14" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }} aria-hidden>
      <circle cx="6.5" cy="6.5" r="6.5" fill={T.verified}/>
      <path d="M3.5 6.5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function SectionHeader({ title, count, right, kicker }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '0 0 14px',
    }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        {kicker && (
          <div style={{
            fontSize: 10.5, fontWeight: 800, letterSpacing: 0.7,
            textTransform: 'uppercase', color: T.green, marginBottom: 3,
          }}>{kicker}</div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h2 style={{
            margin: 0, fontFamily: T.fontDisplay, fontSize: 17, fontWeight: 800,
            color: T.text, letterSpacing: -0.35,
          }}>{title}</h2>
          {count != null && (
            <span style={{
              background: T.greenLight, color: T.green,
              fontSize: 11, fontWeight: 800, borderRadius: 999, padding: '2px 8px',
            }}>{count}</span>
          )}
        </div>
      </div>
      {right}
    </div>
  )
}

function StoryStatusRing({ items = [], size = 72, children }) {
  const list = items.length ? items.slice(0, 12) : [{ id: '_', viewed: false }]
  const n = list.length
  const stroke = size >= 68 ? 2.75 : 2.4
  const pad = 1
  const r = (size - stroke) / 2 - pad
  const c = 2 * Math.PI * r
  const gap = n <= 1 ? 0 : Math.max(4.5, c * 0.028)
  const seg = (c - gap * n) / n
  const cx = size / 2
  const cy = size / 2

  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg
        width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden
        style={{ position: 'absolute', inset: 0, transform: 'rotate(-90deg)', overflow: 'visible' }}
      >
        {n > 1 && (
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={T.border} strokeWidth={stroke} />
        )}
        {list.map((item, i) => (
          <circle
            key={item.id || i}
            cx={cx} cy={cy} r={r}
            fill="none"
            stroke={item.viewed ? RING_VIEWED : RING_ACTIVE}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={n <= 1 ? `${c} 0` : `${Math.max(0.5, seg)} ${Math.max(0, c - seg)}`}
            strokeDashoffset={n <= 1 ? 0 : -(i * (seg + gap))}
            style={{ transition: 'stroke 0.25s ease' }}
          />
        ))}
      </svg>
      <div style={{
        position: 'absolute',
        inset: stroke + 2,
        borderRadius: '50%',
        background: '#fff',
        padding: 2.5,
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  )
}

function ScrollRail({ children, step = 320, deps = [], className = '', style = {} }) {
  const scrollRef = useRef(null)
  const [canLeft, setCanLeft] = useState(false)
  const [canRight, setCanRight] = useState(false)

  const checkScroll = useCallback(() => {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 8)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkScroll, ...deps])

  function scrollBy(dir) {
    scrollRef.current?.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        className="hs-scroll-arrow"
        style={{ left: -6, opacity: canLeft ? 1 : 0, pointerEvents: canLeft ? 'all' : 'none' }}
        onClick={() => scrollBy(-1)}
        aria-label="Scroll left"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        type="button"
        className="hs-scroll-arrow"
        style={{ right: -6, opacity: canRight ? 1 : 0, pointerEvents: canRight ? 'all' : 'none' }}
        onClick={() => scrollBy(1)}
        aria-label="Scroll right"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      <div
        ref={scrollRef}
        className={`hs-rail ${className}`.trim()}
        style={{
          display: 'flex',
          gap: 10,
          overflowX: 'auto',
          paddingBottom: 4,
          scrollbarWidth: 'none',
          msOverflowStyle: 'none',
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x mandatory',
          ...style,
        }}
      >
        {children}
      </div>
    </div>
  )
}

function StoryRingItem({ s, isOwn, viewedIds, onClick }) {
  const name = s.profiles?.full_name || 'Seller'
  const avatar = s.profiles?.avatar_url
  const media = s.media_urls?.[0]
  const group = s._ownGroup || [s]
  const ringItems = group.map(st => ({ id: st.id, viewed: viewedIds.has(st.id) }))
  const allViewed = ringItems.every(x => x.viewed)
  const count = group.length
  const display = isOwn ? 'You' : name.split(' ')[0]
  const face = avatar || media
  const initial = (display || 'S')[0].toUpperCase()

  return (
    <button
      type="button"
      className="hs-ring-item"
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 84,
        border: 'none',
        background: 'transparent',
        padding: 0,
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
        fontFamily: 'inherit',
        scrollSnapAlign: 'start',
      }}
    >
      <div style={{ position: 'relative' }}>
        <StoryStatusRing items={ringItems} size={74}>
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            overflow: 'hidden',
            background: 'linear-gradient(135deg,#0F9D58,#34c77a)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 800, fontSize: 22,
          }}>
            {face
              ? <img src={face} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : initial}
          </div>
        </StoryStatusRing>
        {count > 1 && (
          <span style={{
            position: 'absolute', right: 0, bottom: 2,
            minWidth: 20, height: 20, padding: '0 5px',
            borderRadius: 999, background: allViewed ? '#6b7280' : T.green,
            color: '#fff', fontSize: 10, fontWeight: 800,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #fff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          }}>{count > 9 ? '9+' : count}</span>
        )}
      </div>
      <span style={{
        fontSize: 11.5, fontWeight: 700, color: allViewed && !isOwn ? T.textMuted : T.text,
        maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textAlign: 'center', lineHeight: 1.2,
      }}>{display}</span>
    </button>
  )
}

function StoryCard({ s, index, isOwn, viewedIds, onClick }) {
  const name   = s.profiles?.full_name || 'Seller'
  const avatar = s.profiles?.avatar_url
  const media  = s.media_urls?.[0]
  const isVideo = media && (/\.(mp4|mov|webm)(\?|$)/i.test(media) || media.includes('video'))
  const initial = name[0]?.toUpperCase() || 'S'
  const isUrgent = s.content?.toLowerCase().includes('price drop') ||
                   s.content?.toLowerCase().includes('first to confirm') ||
                   s.content?.toLowerCase().includes('urgent')
  const group = s._ownGroup || [s]
  const allViewed = group.every(x => viewedIds.has(x.id))
  const count = group.length
  const ringItems = group.map(st => ({ id: st.id, viewed: viewedIds.has(st.id) }))

  return (
    <button
      type="button"
      className="hs-story-tile"
      onClick={onClick}
      style={{
        flexShrink: 0,
        width: 148,
        height: 230,
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        border: 'none',
        padding: 0,
        fontFamily: 'inherit',
        textAlign: 'left',
        background: CARD_GRADIENTS[index % CARD_GRADIENTS.length],
        boxShadow: !allViewed && !isOwn
          ? '0 0 0 2px rgba(249,168,37,0.55), 0 12px 28px rgba(0,0,0,0.14)'
          : '0 8px 24px rgba(0,0,0,0.1)',
        scrollSnapAlign: 'start',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      }}
    >
      {media
        ? (isVideo
            ? <video src={media} muted playsInline preload="metadata" className="hs-story-tile-media" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            : <img src={media} alt="" className="hs-story-tile-media" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          )
        : avatar
          ? <img src={avatar} alt="" className="hs-story-tile-media" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.88) saturate(1.1)', transform: 'scale(1.06)' }} />
          : null
      }
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.28) 0%, transparent 32%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.78) 100%)',
      }} />

      <div style={{
        position: 'absolute', top: 10, left: 10, right: 10,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6,
      }}>
        <StoryStatusRing items={ringItems} size={40}>
          <div style={{
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          {isUrgent && <span className="hs-glass-chip hs-glass-urgent">Hot</span>}
          {count > 1 && <span className="hs-glass-chip">{count} posts</span>}
        </div>
      </div>

      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '14px 12px 12px',
      }}>
        <div style={{
          fontSize: 13, fontWeight: 800, color: '#fff',
          textShadow: '0 1px 8px rgba(0,0,0,0.45)',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          marginBottom: 4,
        }}>
          {isOwn ? 'Your story' : name.split(' ')[0]}
        </div>
        <div style={{
          fontSize: 11.5, color: 'rgba(255,255,255,0.9)', fontWeight: 500,
          lineHeight: 1.35,
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          textShadow: '0 1px 6px rgba(0,0,0,0.4)',
          minHeight: 30,
        }}>
          {s.content || 'Tap to view status'}
        </div>
        <div style={{
          marginTop: 8, fontSize: 10.5, fontWeight: 700,
          color: 'rgba(255,255,255,0.65)', letterSpacing: 0.2,
        }}>
          {timeAgo(s.created_at)} · {allViewed && !isOwn ? 'Seen' : 'New'}
        </div>
      </div>
    </button>
  )
}

function loadViewedStoryIds() {
  try {
    const raw = JSON.parse(localStorage.getItem('viewedStories') || '[]')
    return new Set(Array.isArray(raw) ? raw : [])
  } catch {
    return new Set()
  }
}

function persistViewedStoryIds(set) {
  try {
    localStorage.setItem('viewedStories', JSON.stringify([...set]))
  } catch { /* ignore */ }
}

export default function HomeStatusSection({ navigate, stories, loading, onOpenStory, onCreateStory, currentUserId }) {
  const [viewedIds, setViewedIds] = useState(loadViewedStoryIds)
  const [showUpload, setShowUpload] = useState(false)
  const [viewing, setViewing] = useState(null)
  const [viewerStories, setViewerStories] = useState([])

  // Merge server status_views + localStorage
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
    if (s._ownGroup && s._ownGroup.length > 0) {
      setViewerStories([...s._ownGroup, ...stories.filter(x => x.user_id !== s.user_id)])
      setViewing(0)
    } else {
      setViewerStories(s._ownGroup || [s])
      setViewing(0)
    }
    onOpenStory?.(s, { items: s._ownGroup || [s] })
  }

  const hasStories = storyGroups.length > 0

  return (
    <>
      <style>{`
        .hs-rail::-webkit-scrollbar { display: none; }
        .hs-rail { -ms-overflow-style: none; scrollbar-width: none; }

        .hs-scroll-arrow {
          position: absolute; top: 50%; transform: translateY(-50%); z-index: 10;
          width: 38px; height: 38px; border-radius: 50%;
          background: rgba(255,255,255,0.96); border: 1px solid ${T.border};
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          color: #374151; transition: all 0.15s; padding: 0; font-family: inherit;
        }
        .hs-scroll-arrow:hover {
          background: ${T.green}; border-color: ${T.green}; color: #fff;
          box-shadow: 0 6px 18px rgba(15,157,88,0.32);
        }

        .hs-glass-chip {
          display: inline-flex; align-items: center;
          font-size: 9.5px; font-weight: 800; letter-spacing: 0.2px;
          color: #fff; background: rgba(0,0,0,0.38);
          border: 1px solid rgba(255,255,255,0.18);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          border-radius: 999px; padding: 3px 8px;
        }
        .hs-glass-urgent {
          background: rgba(230,81,0,0.85); border-color: rgba(255,255,255,0.2);
        }

        .hs-story-tile:hover { transform: translateY(-4px) scale(1.01); }
        .hs-story-tile:active { transform: scale(0.98); }
        .hs-story-tile:hover .hs-story-tile-media { transform: scale(1.05); }
        .hs-story-tile-media { transition: transform 0.45s ease; }

        .hs-ring-item:active { opacity: 0.85; }

        @media (max-width: 768px) {
          .hs-scroll-arrow { display: none !important; }
        }
      `}</style>

      <section style={{
        padding: '18px 20px 12px',
        background: '#fff',
        borderTop: `1px solid ${T.gray100}`,
      }}>
        <div style={{ maxWidth: 1400, margin: '0 auto' }}>
          {/* ── Ring strip panel ── */}
          <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 20,
            padding: '16px 16px 12px',
            boxShadow: T.shadow,
            marginBottom: 14,
          }}>
            <SectionHeader
              kicker="Now live"
              title="Stories"
              count={storyGroups.length}
              right={
                <button
                  type="button"
                  onClick={() => { if (!currentUserId) { navigate?.('/login'); return }; setShowUpload(true) }}
                  style={{
                    border: 'none', background: T.greenLight, color: T.green,
                    borderRadius: 999, padding: '8px 12px', fontSize: 12, fontWeight: 800,
                    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
                  }}
                >
                  + Add yours
                </button>
              }
            />
            <ScrollRail step={240} deps={[storyGroups.length]} style={{ gap: 14, padding: '2px 4px 6px' }}>
              <button
                type="button"
                onClick={() => { if (!currentUserId) { navigate?.('/login'); return }; setShowUpload(true) }}
                style={{
                  flexShrink: 0, width: 84, border: 'none', background: 'transparent',
                  padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', gap: 8, fontFamily: 'inherit', scrollSnapAlign: 'start',
                }}
              >
                <div style={{
                  width: 74, height: 74, borderRadius: '50%',
                  border: `2px dashed ${T.green}`,
                  background: T.greenLight,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  position: 'relative',
                }}>
                  {currentUserId && (stories.find(s => s.user_id === currentUserId)?.profiles?.avatar_url) && (
                    <img
                      src={stories.find(s => s.user_id === currentUserId)?.profiles?.avatar_url}
                      alt=""
                      style={{
                        position: 'absolute', inset: 3,
                        width: 'calc(100% - 6px)', height: 'calc(100% - 6px)',
                        borderRadius: '50%', objectFit: 'cover', opacity: 0.45,
                      }}
                    />
                  )}
                  <span style={{
                    position: 'relative', zIndex: 1,
                    width: 28, height: 28, borderRadius: '50%',
                    background: T.green, color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 20, fontWeight: 700, lineHeight: 1,
                    boxShadow: '0 4px 12px rgba(15,157,88,0.35)',
                  }}>+</span>
                </div>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: T.green }}>Your status</span>
              </button>

              {loading
                ? [1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} style={{
                      flexShrink: 0, width: 84,
                      display: 'flex', flexDirection: 'column',
                      alignItems: 'center', gap: 8, scrollSnapAlign: 'start',
                    }}>
                      <div className="skeleton" style={{ width: 64, height: 64, borderRadius: '50%' }} />
                      <div className="skeleton" style={{ width: 48, height: 10, borderRadius: 4 }} />
                    </div>
                  ))
                : storyGroups.map(s => (
                    <StoryRingItem
                      key={s.user_id}
                      s={s}
                      isOwn={s.user_id === currentUserId}
                      viewedIds={viewedIds}
                      onClick={() => openStoryGroup(s)}
                    />
                  ))
              }
            </ScrollRail>
          </div>

          {/* ── Cinematic tiles ── */}
          <div style={{
            background: T.surface,
            border: `1px solid ${T.border}`,
            borderRadius: 20,
            padding: '16px 16px 14px',
            boxShadow: T.shadow,
          }}>
            <SectionHeader
              kicker="Discover"
              title="Featured moments"
              count={hasStories ? storyGroups.length : undefined}
            />
            {hasStories ? (
              <ScrollRail step={340} deps={[storyGroups.length]} style={{ gap: 12, padding: '2px 2px 8px' }}>
                {storyGroups.map((s, i) => (
                  <StoryCard
                    key={s.user_id}
                    s={s}
                    index={i}
                    isOwn={s.user_id === currentUserId}
                    viewedIds={viewedIds}
                    onClick={() => openStoryGroup(s)}
                  />
                ))}
              </ScrollRail>
            ) : (
              <div style={{
                textAlign: 'center', padding: '28px 16px',
                border: '1.5px dashed ' + T.border, borderRadius: 16, color: T.textMuted,
              }}>
                <p style={{ margin: '0 0 12px', fontSize: 13.5, fontWeight: 600 }}>
                  {loading ? 'Loading stories…' : 'No live stories yet — share the first update.'}
                </p>
                {!loading && (
                  <button
                    type="button"
                    onClick={() => { if (!currentUserId) { navigate?.('/login'); return }; setShowUpload(true) }}
                    style={{
                      border: 'none', background: T.green, color: '#fff', borderRadius: 12,
                      padding: '11px 16px', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
                      boxShadow: '0 4px 14px rgba(15,157,88,0.28)',
                    }}
                  >
                    Post status
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </section>

      {viewing !== null && (
        <StoryViewer stories={viewerStories} startIndex={viewing} currentUserId={currentUserId} onClose={() => setViewing(null)} />
      )}
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
