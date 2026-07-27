/**
 * HomeStatusRow.jsx
 * Pixel-perfect clone of the AI Studio Soko Malawi status carousel.
 * Drop-in replacement — same file path, same prop: <HomeStatusRow user={user} />
 * Keeps your existing user_statuses Supabase table + fetchAllActiveStories hook.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAllActiveStories } from '../hooks/useStatuses'
import StatusUploadModal from './StatusUploadModal'

// ─── Category badge colours (matches screenshot exactly) ─────────────────────
function getCatStyle(category, statusType) {
  const c = (category || statusType || '').toLowerCase()
  if (c.includes('agri') || c.includes('food') || c.includes('crop'))
    return { bg: '#0d9488', text: '#fff', label: 'AGRICULTURE' }
  if (c.includes('electronic') || c.includes('phone') || c.includes('tech'))
    return { bg: '#f97316', text: '#fff', label: 'ELECTRONICS' }
  if (c.includes('job') || c.includes('service') || c.includes('work'))
    return { bg: '#22d3ee', text: '#0f172a', label: 'JOBS & SERVICES' }
  if (c.includes('fashion') || c.includes('cloth') || c.includes('wear'))
    return { bg: '#ec4899', text: '#fff', label: 'FASHION' }
  if (c.includes('property') || c.includes('home') || c.includes('house'))
    return { bg: '#6366f1', text: '#fff', label: 'PROPERTY' }
  if (c.includes('vehicle') || c.includes('car') || c.includes('transport'))
    return { bg: '#8b5cf6', text: '#fff', label: 'VEHICLES' }
  if (c.includes('furniture') || c.includes('garden'))
    return { bg: '#f59e0b', text: '#0f172a', label: 'HOME & GARDEN' }
  if (c.includes('listing_update') || c.includes('listing'))
    return { bg: '#f59e0b', text: '#0f172a', label: 'LISTING' }
  if (c.includes('availability'))
    return { bg: '#22c55e', text: '#fff', label: 'AVAILABLE' }
  return { bg: '#64748b', text: '#fff', label: (category || 'SOKO').toUpperCase() }
}

function timeAgo(ts) {
  const d = Date.now() - new Date(ts)
  const h = Math.floor(d / 3600000)
  const m = Math.floor(d / 60000)
  return h >= 1 ? `${h}h ago` : m < 1 ? 'just now' : `${m}m ago`
}

// ─── Create Story card (first card — blue gradient with + button) ─────────────
function CreateCard({ onPress, avatar }) {
  const [hov, setHov] = useState(false)
  return (
    <div
      onClick={onPress}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flexShrink: 0,
        width: 200,
        height: 340,
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        background: 'linear-gradient(160deg, #0369a1 0%, #0ea5e9 55%, #06b6d4 100%)',
        boxShadow: hov
          ? '0 8px 32px rgba(6,182,212,0.45)'
          : '0 3px 16px rgba(0,0,0,0.3)',
        transform: hov ? 'translateY(-6px) scale(1.02)' : 'none',
        transition: 'all 0.22s cubic-bezier(0.16,1,0.3,1)',
        border: '2px solid rgba(255,255,255,0.18)',
      }}
    >
      {/* Shimmer overlay */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 1,
        background: 'radial-gradient(ellipse at 70% 20%, rgba(255,255,255,0.18) 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* BROADCAST pill top-left */}
      <div style={{
        position: 'absolute', top: 12, left: 12, zIndex: 5,
        background: 'rgba(255,255,255,0.18)',
        backdropFilter: 'blur(8px)',
        borderRadius: 20, padding: '4px 10px',
        display: 'flex', alignItems: 'center', gap: 5,
        border: '1px solid rgba(255,255,255,0.25)',
      }}>
        <div style={{
          width: 7, height: 7, borderRadius: '50%',
          background: '#34d399',
          boxShadow: '0 0 0 2.5px rgba(52,211,153,0.3)',
          animation: 'hsrPulse 2s infinite',
        }} />
        <span style={{ fontSize: 9, fontWeight: 900, color: '#fff', letterSpacing: 1.2, textTransform: 'uppercase' }}>
          Broadcast
        </span>
      </div>

      {/* Centre + button */}
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -60%)',
        width: 52, height: 52, borderRadius: '50%',
        background: 'rgba(255,255,255,0.22)',
        backdropFilter: 'blur(10px)',
        border: '2.5px solid rgba(255,255,255,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
        zIndex: 5,
        transition: 'transform 0.2s',
      }}>
        {/* Ping animation ring */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          background: 'rgba(255,255,255,0.15)',
          animation: 'hsrPing 1.8s cubic-bezier(0,0,0.2,1) infinite',
        }} />
        <span style={{ fontSize: 26, color: '#fff', fontWeight: 900, lineHeight: 1 }}>+</span>
      </div>

      {/* Bottom label */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '0 14px 18px', textAlign: 'center', zIndex: 5,
      }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.3)', marginBottom: 4 }}>
          Create Story
        </div>
        <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.75)', fontWeight: 600 }}>
          Showcase your products
        </div>
      </div>
    </div>
  )
}

// ─── Individual story card ────────────────────────────────────────────────────
function StoryCard({ s, index, isOwn, viewedIds, onClick, onReact }) {
  const [hov, setHov] = useState(false)

  const name      = s.profiles?.full_name || 'Seller'
  const avatar    = s.profiles?.avatar_url
  const media     = s.media_urls?.[0]
  const allViewed = s._ownGroup?.every(x => viewedIds.has(x.id))
  const ringColor = isOwn ? '#1a7a4a' : (!allViewed ? '#f9a825' : '#475569')
  const cat       = getCatStyle(s.category, s.status_type)
  const isText    = s.media_type === 'text' || (!media && s.bg_color)
  const bgColor   = s.bg_color || '#1e3a8a'
  const viewCount = s.view_count || 0
  const handle    = isOwn ? '@me' : `@${s.profiles?.username || 'seller'}`

  // Fallback gradient if no media
  const GRADIENTS = [
    'linear-gradient(160deg,#0a2e1a,#1a7a4a)',
    'linear-gradient(160deg,#0d1b2a,#1a3a6c)',
    'linear-gradient(160deg,#1a0a00,#6a2800)',
    'linear-gradient(160deg,#1a0a2e,#4a1a7a)',
    'linear-gradient(160deg,#0a1a2e,#1a5a6a)',
    'linear-gradient(160deg,#1c1a0a,#4a5a1a)',
  ]

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        flexShrink: 0,
        width: 200,
        height: 340,
        borderRadius: 20,
        overflow: 'hidden',
        position: 'relative',
        cursor: 'pointer',
        background: isText ? bgColor : GRADIENTS[index % GRADIENTS.length],
        border: `2.5px solid ${ringColor}`,
        boxShadow: !allViewed && !isOwn
          ? `0 0 0 2px rgba(249,168,37,0.2), 0 4px 20px rgba(0,0,0,0.25)`
          : '0 3px 14px rgba(0,0,0,0.22)',
        transform: hov ? 'translateY(-6px) scale(1.02)' : 'none',
        transition: 'all 0.22s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {/* Background media */}
      {!isText && media && (
        <img
          src={media}
          alt=""
          style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%', objectFit: 'cover',
            transform: hov ? 'scale(1.08)' : 'scale(1.02)',
            transition: 'transform 0.55s cubic-bezier(0.16,1,0.3,1)',
          }}
        />
      )}

      {/* Text-type story — caption in centre */}
      {isText && s.content && (
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '20px 16px',
        }}>
          <p style={{
            fontSize: 14, fontWeight: 900, color: '#fff', textAlign: 'center',
            lineHeight: 1.55, textShadow: '0 2px 8px rgba(0,0,0,0.5)',
            display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {s.content}
          </p>
        </div>
      )}

      {/* Top gradient vignette */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 3,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 35%, rgba(0,0,0,0.1) 55%, rgba(0,0,0,0.85) 100%)',
        pointerEvents: 'none',
      }} />

      {/* ── TOP BAR: avatar + handle + time ── */}
      <div style={{
        position: 'absolute', top: 10, left: 10, right: 10,
        zIndex: 10, display: 'flex', alignItems: 'center', gap: 7,
      }}>
        {/* Avatar with ring */}
        <div style={{
          width: 30, height: 30, borderRadius: '50%',
          border: `2px solid ${ringColor}`,
          overflow: 'hidden', flexShrink: 0,
          background: 'linear-gradient(135deg,#1a7a4a,#22a05e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 11, fontWeight: 800, color: '#fff',
          boxShadow: '0 1px 6px rgba(0,0,0,0.5)',
        }}>
          {avatar
            ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : (name[0] || 'S').toUpperCase()
          }
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{
            fontSize: 10.5, fontWeight: 800, color: '#fff',
            textShadow: '0 1px 4px rgba(0,0,0,0.7)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{handle}</div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
            {timeAgo(s.created_at)}
          </div>
        </div>
      </div>

      {/* ── BOTTOM BAR: caption + category + views ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        zIndex: 10, padding: '0 10px 12px',
      }}>
        {/* Caption (non-text stories) */}
        {!isText && s.content && (
          <p style={{
            fontSize: 11, fontWeight: 700, color: '#fff',
            lineHeight: 1.45, marginBottom: 8,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            textShadow: '0 1px 4px rgba(0,0,0,0.7)',
          }}>{s.content}</p>
        )}

        {/* Category pill + view count — row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{
            background: cat.bg, color: cat.text,
            borderRadius: 20, padding: '3px 9px',
            fontSize: 8.5, fontWeight: 900,
            letterSpacing: 0.5, textTransform: 'uppercase',
            boxShadow: '0 1px 4px rgba(0,0,0,0.3)',
          }}>
            {cat.label}
          </div>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 3,
            fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.85)',
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            {viewCount}
          </div>
        </div>
      </div>

      {/* ── HOVER OVERLAY: quick actions ── */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 20,
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(3px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 12,
        opacity: hov ? 1 : 0,
        transition: 'opacity 0.2s',
        pointerEvents: hov ? 'all' : 'none',
      }}>
        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 10 }}>
          {[
            { icon: '❤️', title: 'Like' },
            { icon: '🔖', title: 'Save' },
            { icon: '↗', title: 'Share' },
          ].map(({ icon, title }) => (
            <button
              key={title}
              onClick={e => { e.stopPropagation(); if (title === 'Like') onReact?.(s.id, 'fire') }}
              title={title}
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'rgba(255,255,255,0.12)',
                backdropFilter: 'blur(8px)',
                border: '1.5px solid rgba(255,255,255,0.25)',
                fontSize: 15, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', transition: 'background 0.15s',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.25)'}
              onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.12)'}
            >{icon}</button>
          ))}
        </div>
        {/* Play button */}
        <div style={{
          width: 46, height: 46, borderRadius: '50%',
          background: '#1a7a4a',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 16px rgba(0,0,0,0.5)',
          fontSize: 18,
        }}>▶</div>
        <span style={{ fontSize: 9.5, fontWeight: 900, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 1.2 }}>
          Open Story
        </span>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function HomeStatusRow({ user }) {
  const navigate = useNavigate()
  const [stories,        setStories]       = useState([])
  const [showUpload,     setShowUpload]    = useState(false)
  const [viewedIds,      setViewedIds]     = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('viewedStories') || '[]')) }
    catch { return new Set() }
  })

  useEffect(() => {
    if (!user?.id) return
    fetchAllActiveStories(user.id, 'All').then(setStories)

    const ch = supabase.channel('home-status-row-v3')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_statuses' }, () => {
        fetchAllActiveStories(user.id, 'All').then(setStories)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [user?.id])

  // Group stories by user — own stories first
  const storyGroups = (() => {
    const map = new Map()
    for (const s of stories) {
      if (!map.has(s.user_id)) map.set(s.user_id, [])
      map.get(s.user_id).push(s)
    }
    const cards  = Array.from(map.values()).map(g => ({ ...g[0], _ownGroup: g }))
    const own    = cards.filter(c => c.user_id === user?.id)
    const others = cards.filter(c => c.user_id !== user?.id)
    return [...own, ...others]
  })()

  async function openGroup(groupLeader) {
    const ids = groupLeader._ownGroup?.map(x => x.id) || [groupLeader.id]
    setViewedIds(prev => {
      const next = new Set([...prev, ...ids])
      localStorage.setItem('viewedStories', JSON.stringify([...next]))
      return next
    })
    if (user?.id) {
      ids.forEach(id => {
        supabase.from('status_views')
          .upsert({ status_id: id, viewer_id: user.id }, { onConflict: 'status_id,viewer_id' })
          .then(() => {}, () => {})
      })
    }
    navigate(`/story/${groupLeader.id}`)
  }

  async function handleReact(statusId, type) {
    if (!user?.id) return
    await supabase.from('status_reactions')
      .upsert({ status_id: statusId, user_id: user.id, reaction_type: type }, { onConflict: 'status_id,user_id' })
    // Toast
    const el = document.createElement('div')
    el.style.cssText = 'position:fixed;top:80px;left:50%;transform:translateX(-50%);background:#111;color:#fff;font-size:13px;font-weight:800;padding:8px 20px;border-radius:30px;z-index:99999;box-shadow:0 4px 20px rgba(0,0,0,0.5)'
    el.innerText = '🔥 Liked!'
    document.body.appendChild(el)
    setTimeout(() => el.remove(), 1800)
  }

  if (!user) return null

  return (
    <>
      <style>{`
        @property --hsr-angle { syntax:'<angle>'; initial-value:0deg; inherits:false; }
        @keyframes hsr-streak { to { --hsr-angle: 360deg; } }
        @keyframes hsrPulse {
          0%,100% { box-shadow: 0 0 0 3px rgba(52,211,153,0.25); }
          50%      { box-shadow: 0 0 0 7px rgba(52,211,153,0.08); }
        }
        @keyframes hsrPing {
          75%,100% { transform: scale(2); opacity: 0; }
        }
        .hsr-scroll::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── Outer wrapper — dark bar matching screenshot ── */}
      <div style={{
        background: '#0d1410',
        borderBottom: '1px solid #1a2a1d',
        paddingBottom: 4,
      }}>

        {/* Header row */}
        <div style={{
          display: 'flex', alignItems: 'center',
          padding: '14px 20px 6px',
          gap: 10,
        }}>
          {/* Live pulse dot */}
          <div style={{
            width: 9, height: 9, borderRadius: '50%',
            background: '#ef4444',
            boxShadow: '0 0 0 3px rgba(239,68,68,0.25)',
            animation: 'hsrPulse 2s ease-in-out infinite',
            flexShrink: 0,
          }} />

          {/* Title */}
          <span style={{ fontSize: 14, fontWeight: 900, color: '#fff', letterSpacing: 0.3 }}>
            Soko Live Stories
          </span>

          {/* Live Deals badge */}
          <div style={{
            background: 'rgba(239,68,68,0.15)',
            border: '1px solid rgba(239,68,68,0.3)',
            borderRadius: 20, padding: '2px 10px',
            fontSize: 10, fontWeight: 900, color: '#f87171',
            letterSpacing: 0.3,
          }}>• Live Deals</div>

          <div style={{ flex: 1 }} />

          {/* Add Promotion button */}
          <button
            onClick={() => setShowUpload(true)}
            style={{
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 20, padding: '6px 14px',
              fontSize: 11.5, fontWeight: 800, color: 'rgba(255,255,255,0.85)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 5,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.13)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
          >
            <span style={{ fontSize: 14, lineHeight: 1 }}>+</span>
            Add Promotion
          </button>
        </div>

        {/* Subtitle */}
        <div style={{ padding: '0 20px 12px' }}>
          <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.38)', fontWeight: 500 }}>
            Daily video, photo &amp; text promos from trusted Malawian sellers. Tranzakshoni zanyazi!
          </span>
        </div>

        {/* ── Story cards scroll ── */}
        <div
          className="hsr-scroll"
          style={{
            display: 'flex', gap: 12,
            overflowX: 'auto', padding: '4px 20px 18px',
            scrollbarWidth: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {/* Create story card */}
          <CreateCard onPress={() => setShowUpload(true)} avatar={user?.avatar_url} />

          {/* Story cards */}
          {storyGroups.map((s, i) => (
            <StoryCard
              key={s.user_id}
              s={s}
              index={i}
              isOwn={s.user_id === user?.id}
              viewedIds={viewedIds}
              onClick={() => openGroup(s)}
              onReact={handleReact}
            />
          ))}

          {/* Empty placeholder */}
          {storyGroups.length === 0 && (
            <div
              onClick={() => setShowUpload(true)}
              style={{
                flexShrink: 0, width: 200, height: 340,
                borderRadius: 20, overflow: 'hidden',
                background: 'linear-gradient(160deg,#003973,#1a5acd)',
                position: 'relative', cursor: 'pointer',
                border: '2px solid rgba(255,255,255,0.15)',
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 10,
              }}
            >
              <div style={{ fontSize: 36 }}>📡</div>
              <div style={{ fontSize: 10, fontWeight: 900, color: '#7dd3fc', textTransform: 'uppercase', letterSpacing: 1.2 }}>BROADCAST</div>
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 600, textAlign: 'center', maxWidth: 120, lineHeight: 1.5 }}>
                Be the first seller to showcase here today
              </div>
            </div>
          )}
        </div>
      </div>

      {showUpload && (
        <StatusUploadModal
          user={user}
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false)
            if (user?.id) fetchAllActiveStories(user.id, 'All').then(setStories)
          }}
        />
      )}
    </>
  )
}