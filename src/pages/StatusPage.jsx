import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAllActiveStories } from '../hooks/useStatuses'
import StoryViewer from '../components/StoryViewer'
import StatusUploadModal from '../components/StatusUploadModal'
import { isStatusVideoUrl } from '../utils/statusVideo'
import { useStatusReplies } from '../components/StatusReplies'
import SokoNav from '../components/SokoNav'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, MessageCircle, Share2, Eye, Clock, Send } from 'lucide-react'

// ─────────────────────────────────────────────
// Design tokens — aligned with Home / Looking For / Shops
// ─────────────────────────────────────────────
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
  shadow:     '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)',
  shadowMd:   '0 4px 12px rgba(0,0,0,0.11), 0 8px 28px rgba(0,0,0,0.08)',
  font:       "'Inter', 'DM Sans', system-ui, sans-serif",
  fontDisplay:"'Sora', 'Inter', system-ui, sans-serif",
}

const CATEGORY_TABS = [
  { key: 'All',          label: 'All' },
  { key: 'Availability', label: 'Available' },
  { key: 'Work',         label: 'Work' },
  { key: '🔥 Urgent',    label: 'Urgent' },
  { key: 'Electronics',  label: 'Electronics' },
  { key: 'Vehicles',     label: 'Vehicles' },
  { key: 'Clothing',     label: 'Fashion' },
  { key: 'Furniture',    label: 'Furniture' },
  { key: 'Property',     label: 'Property' },
  { key: 'Agriculture',  label: 'Agri' },
  { key: 'Food',         label: 'Food' },
  { key: 'Services',     label: 'Services' },
  { key: 'Other',        label: 'Other' },
]

const SORT_OPTIONS = ['Latest', 'Trending', 'Most Viewed', 'Following']

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

function expiresInLabel(iso) {
  if (!iso) return null
  const ms = new Date(iso) - Date.now()
  if (ms <= 0) return 'Expired'
  const h = ms / 3600000
  if (h < 1) return 'Expires soon'
  if (h < 24) return `Expires in ${Math.ceil(h)}h`
  return `Expires in ${Math.ceil(h / 24)}d`
}

function fmtCount(n) {
  const v = n || 0
  if (v >= 1000000) return `${(v / 1000000).toFixed(1)}M`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return `${v}`
}

// ─────────────────────────────────────────────
// Modern presentation primitives
// ─────────────────────────────────────────────
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

/** Segmented story ring (Home / IG style) */
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
        inset: stroke + 1,
        borderRadius: '50%',
        overflow: 'hidden',
      }}>
        {children}
      </div>
    </div>
  )
}

/** Status hero photo — lively open market (sellers & buyers, “what’s live now”) */
const STATUS_HERO_IMG =
  'https://images.unsplash.com/photo-1488459716781-31db52582fe9?auto=format&fit=crop&w=2000&q=80'

/** Horizontal rail with left/right arrows — same pattern as Home Looking For / Shops */
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
    <div className="st-scroll-wrap" style={{ position: 'relative' }}>
      <button
        type="button"
        className={`st-scroll-arrow${canLeft ? '' : ' is-hidden'}`}
        style={{ left: -6 }}
        onClick={() => scrollBy(-1)}
        aria-label="Scroll left"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        type="button"
        className={`st-scroll-arrow${canRight ? '' : ' is-hidden'}`}
        style={{ right: -6 }}
        onClick={() => scrollBy(1)}
        aria-label="Scroll right"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
      <div
        ref={scrollRef}
        className={`st-rail ${className}`.trim()}
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

/** Compact ring + label (top stories strip) */
function StoryRingItem({ s, isOwn, viewedIds, onClick, label }) {
  const name = s.profiles?.full_name || 'Seller'
  const avatar = s.profiles?.avatar_url
  const media = s.media_urls?.[0]
  const group = s._ownGroup || [s]
  const ringItems = group.map(st => ({ id: st.id, viewed: viewedIds.has(st.id) }))
  const allViewed = ringItems.every(x => x.viewed)
  const display = label || (isOwn ? 'You' : name.split(' ')[0])
  const face = avatar || media
  const initial = (display || 'S')[0].toUpperCase()

  return (
    <button
      type="button"
      className="st-ring-item"
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
      </div>
      <span style={{
        fontSize: 11.5, fontWeight: 700, color: allViewed && !isOwn ? T.textMuted : T.text,
        maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        textAlign: 'center', lineHeight: 1.2,
      }}>{display}</span>
    </button>
  )
}

/** Tall cinematic status tile */
function StoryCard({ s, index, isOwn, viewedIds, onClick, nearBadge }) {
  const name   = s.profiles?.full_name || 'Seller'
  const avatar = s.profiles?.avatar_url
  const media  = s.media_urls?.[0]
  const isVideo = media && isStatusVideoUrl(media)
  const initial = name[0]?.toUpperCase() || 'S'
  const isUrgent = s.content?.toLowerCase().includes('price drop') ||
                   s.content?.toLowerCase().includes('first to confirm') ||
                   s.content?.toLowerCase().includes('urgent')
  const group = s._ownGroup || [s]
  const allViewed = group.every(x => viewedIds.has(x.id))
  const ringItems = group.map(st => ({ id: st.id, viewed: viewedIds.has(st.id) }))

  return (
    <button
      type="button"
      className="st-story-tile"
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
            ? <video src={media} muted playsInline preload="metadata" className="st-story-tile-media" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
            : <img src={media} alt="" className="st-story-tile-media" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
          )
        : avatar
          ? <img src={avatar} alt="" className="st-story-tile-media" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.88) saturate(1.1)', transform: 'scale(1.06)' }} />
          : null
      }
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(180deg, rgba(0,0,0,0.28) 0%, transparent 32%, rgba(0,0,0,0.15) 55%, rgba(0,0,0,0.78) 100%)',
      }} />

      {/* Top: mini ring avatar + chips */}
      <div style={{
        position: 'absolute', top: 10, left: 10, right: 10,
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6,
      }}>
        <StoryStatusRing items={ringItems} size={52}>
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
          {nearBadge && (
            <span className="st-glass-chip">📍 Near</span>
          )}
          {isUrgent && <span className="st-glass-chip st-glass-urgent">Hot</span>}
        </div>
      </div>

      {/* Bottom copy */}
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

/** Batched views / likes / replies for the vertical feed, with realtime refresh. */
function useStoryFeedMetrics(stories, currentUserId) {
  const idKey = useMemo(
    () => (stories || []).map(s => s.id).filter(Boolean).join('|'),
    [stories],
  )
  const [metrics, setMetrics] = useState({})

  const refresh = useCallback(async () => {
    const ids = idKey ? idKey.split('|') : []
    if (!ids.length) return

    const [reactRes, replyRes, viewRes] = await Promise.all([
      supabase.from('status_reactions').select('status_id, user_id, reaction').in('status_id', ids),
      Promise.all(ids.map(id => supabase.from('status_replies').select('id', { count: 'exact', head: true }).eq('status_id', id))),
      Promise.all(ids.map(id => supabase.from('status_views').select('id', { count: 'exact', head: true }).eq('status_id', id))),
    ])

    const map = {}
    for (const id of ids) map[id] = { views: 0, likes: 0, myLike: null, replies: 0 }
    for (const r of reactRes.data || []) {
      if (map[r.status_id] && r.reaction === 'love') {
        map[r.status_id].likes += 1
        if (r.user_id === currentUserId) map[r.status_id].myLike = 'love'
      }
    }
    replyRes.forEach((res, i) => { if (map[ids[i]] && res.count != null) map[ids[i]].replies = res.count })
    viewRes.forEach((res, i) => { if (map[ids[i]] && res.count != null) map[ids[i]].views = res.count })
    setMetrics(map)
  }, [idKey, currentUserId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch feed metrics on id/user change
  useEffect(() => { refresh() }, [refresh])

  // Realtime: keep counts fresh when replies/reactions change anywhere in the feed
  useEffect(() => {
    const ch = supabase.channel('st-feed-metrics')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'status_replies' }, () => refresh())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'status_replies' }, () => refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'status_reactions' }, () => refresh())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'status_reactions' }, () => refresh())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [refresh])

  async function likeStory(storyId) {
    if (!currentUserId || !metrics[storyId]) return
    const cur = metrics[storyId]
    if (cur.myLike) {
      setMetrics(m => ({ ...m, [storyId]: { ...m[storyId], myLike: null, likes: Math.max(0, (m[storyId]?.likes || 0) - 1) } }))
      await supabase.from('status_reactions').delete().eq('status_id', storyId).eq('user_id', currentUserId)
    } else {
      setMetrics(m => ({ ...m, [storyId]: { ...m[storyId], myLike: 'love', likes: (m[storyId]?.likes || 0) + 1 } }))
      await supabase.from('status_reactions').insert({ status_id: storyId, user_id: currentUserId, reaction: 'love' })
    }
    refresh()
  }

  return { metrics, likeStory }
}

/** Facebook-style feed card — header → media → caption → engagement row → shared comment drawer */
function StatusFeedCard({ s, onOpen, currentUserId, metrics, onLike }) {
  const name       = s.profiles?.full_name || 'Seller'
  const avatar     = s.profiles?.avatar_url
  const initial    = name[0]?.toUpperCase() || 'S'
  const isVerified = s.profiles?.is_verified || false
  const media      = s.media_urls?.[0]
  const isVideo    = media && (/\.(mp4|mov|webm)(\?|$)/i.test(media) || media.includes('video'))
  const ago        = timeAgo(s.created_at)
  const expires    = expiresInLabel(s.expires_at)
  const rawContent = (s.content || '').trim()
  const isGenericPhoto = /^photo update$/i.test(rawContent) || /^video update$/i.test(rawContent)
  const isUrgent = rawContent.toLowerCase().includes('price drop') ||
                   rawContent.toLowerCase().includes('urgent') ||
                   rawContent.toLowerCase().includes('first to confirm')
  const category = isUrgent ? 'Urgent'
    : s.status_type === 'availability' ? 'Available'
    : s.status_type === 'work_ping' ? 'Work'
    : media && isGenericPhoto ? (isVideo ? 'Video' : 'Photo')
    : s.tagged?.category || (media ? 'Photo' : 'Update')
  const displayText = isGenericPhoto
    ? (s.tagged?.title ? `Shared · ${s.tagged.title}` : (isVideo ? 'Shared a video update' : 'Shared a photo update'))
    : (rawContent || 'Tap to open status')
  const m = metrics[s.id] || { views: 0, likes: 0, myLike: null, replies: 0 }

  const [copied, setCopied] = useState(false)
  const [commentFeedback, setCommentFeedback] = useState('')
  const feedbackRef = useRef()

  const replies = useStatusReplies({
    story: s,
    currentUserId,
    notify: msg => {
      setCommentFeedback(msg)
      clearTimeout(feedbackRef.current)
      feedbackRef.current = setTimeout(() => setCommentFeedback(''), 2200)
    },
  })

  async function handleShare() {
    const url = s.tagged_listing_id
      ? `${window.location.origin}/listing/${s.tagged_listing_id}`
      : `${window.location.origin}/profile/${s.user_id}`
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && navigator.share) {
      navigator.share({ title: `${name} on SokoMw`, text: s.content || '', url }).catch(() => {})
      return
    }
    const done = () => { setCopied(true); setTimeout(() => setCopied(false), 1600) }
    navigator.clipboard?.writeText(url).then(done).catch(() => {
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      done()
    })
  }

  return (
    <article className={`st-feed-card${media ? ' has-media' : ''}`}>
      <div className="st-feed-body">
        <div className="st-feed-head">
          <button type="button" className="st-feed-headbtn" onClick={onOpen}>
            <div className="st-feed-avatar">
              {avatar ? <img src={avatar} alt="" /> : initial}
            </div>
            <div className="st-feed-who">
              <div className="st-feed-name-row">
                <span className="st-feed-name">{name}</span>
                {isVerified && <VerifiedBadge />}
              </div>
              <div className="st-feed-meta">
                <Badge color={isUrgent ? T.orangeDeep : T.green} bg={isUrgent ? T.orangeLight : T.greenLight}>
                  {category}
                </Badge>
                <span className="st-feed-time">{ago} ago</span>
                {s.location_hint && (
                  <span className="st-feed-loc">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
                    </svg>
                    {s.location_hint}
                  </span>
                )}
              </div>
            </div>
          </button>
          {expires && (
            <span className={`st-feed-expires${expires === 'Expired' ? ' is-expired' : ''}`}>
              <Clock size={11} /> {expires}
            </span>
          )}
        </div>

        {media && (
          <button type="button" className="st-feed-media" onClick={onOpen} aria-label="Open status">
            {isVideo
              ? <video src={media} muted playsInline preload="metadata" />
              : <img src={media} alt="" loading="lazy" />
            }
            {isVideo && <span className="st-feed-play" aria-hidden>▶</span>}
            <div className="st-feed-media-fade" aria-hidden />
          </button>
        )}

        <p className="st-feed-text">{displayText}</p>

        {s.tagged && (
          <div className="st-feed-tag">
            {s.tagged.images?.[0]
              ? <img src={s.tagged.images[0]} alt="" />
              : <div className="st-feed-tag-ph">📦</div>
            }
            <div className="st-feed-tag-copy">
              <strong>{s.tagged.title}</strong>
              {s.tagged.price != null && (
                <span>MK {Number(s.tagged.price).toLocaleString()}</span>
              )}
            </div>
            <span className="st-feed-tag-cta">View</span>
          </div>
        )}

        <div className="st-feed-stats">
          <span className="st-feed-views"><Eye size={12} /> {fmtCount(m.views)} views</span>
          <span className="st-feed-stat"><Heart size={12} /> {fmtCount(m.likes)}</span>
          <span className="st-feed-stat"><MessageCircle size={12} /> {fmtCount(m.replies)}</span>
        </div>

        <div className="st-feed-eng">
          <motion.button
            type="button"
            whileTap={{ scale: 1.28 }}
            className={`st-feed-eng-btn${m.myLike ? ' is-liked' : ''}`}
            onClick={() => onLike(s.id)}
            aria-pressed={!!m.myLike}
          >
            <Heart size={17} fill={m.myLike ? '#ea4335' : 'none'} strokeWidth={2.2} />
            <span>{m.myLike ? 'Liked' : 'Like'}</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 1.28 }}
            className={`st-feed-eng-btn${replies.open ? ' is-active' : ''}`}
            onClick={() => replies.open ? replies.closeReplies() : replies.openReplies()}
            aria-expanded={replies.open}
          >
            <MessageCircle size={17} />
            <span>Comment</span>
          </motion.button>

          <motion.button type="button" whileTap={{ scale: 1.28 }} className="st-feed-eng-btn" onClick={handleShare}>
            <Share2 size={17} />
            <span>{copied ? 'Copied' : 'Share'}</span>
          </motion.button>
        </div>

        <AnimatePresence initial={false}>
          {replies.open && (
            <motion.div
              className="st-feed-comments"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              <div className="st-feed-comments-in">
                {commentFeedback && (
                  <div className={`st-feed-comments-feedback${commentFeedback === 'Could not send reply — try again' ? ' is-error' : ''}`}>
                    {commentFeedback}
                  </div>
                )}
                {replies.loading ? (
                  <div className="st-feed-comments-state">Loading comments…</div>
                ) : replies.replies.length === 0 ? (
                  <div className="st-feed-comments-state">No comments yet — start the conversation.</div>
                ) : (
                  replies.replies.map(c => (
                    <div className="st-feed-comment" key={c.id}>
                      <div className="st-feed-comment-avatar">
                        {c.author?.avatar_url
                          ? <img src={c.author.avatar_url} alt="" />
                          : (c.author?.full_name || 'U')[0].toUpperCase()}
                      </div>
                      <div className="st-feed-comment-body">
                        <div className="st-feed-comment-head">
                          <strong>{c.author?.full_name || 'Someone'}</strong>
                          <span>{timeAgo(c.created_at)}</span>
                        </div>
                        <p>{c.body}</p>
                      </div>
                    </div>
                  ))
                )}
                <div className="st-feed-comment-box">
                  <input
                    type="text"
                    value={replies.text}
                    placeholder="Write a comment…"
                    disabled={replies.sending}
                    onChange={e => replies.setText(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') replies.submit() }}
                  />
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.85 }}
                    className="st-feed-comment-send"
                    onClick={replies.submit}
                    disabled={replies.sending || !replies.text.trim()}
                    aria-label="Send comment"
                  >
                    <Send size={15} />
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </article>
  )
}

// ─────────────────────────────────────────────
// Root export — auth gate
// ─────────────────────────────────────────────
export default function StatusPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate('/login'); return }
      supabase.from('profiles').select('full_name, avatar_url, city')
        .eq('id', user.id).maybeSingle()
        .then(({ data }) => setUser({ ...user, ...data }))
    })
  }, [])

  if (!user) return null
  return <StatusPageInner user={user} navigate={navigate} />
}

// ─────────────────────────────────────────────
// Main page component
// ─────────────────────────────────────────────
function StatusPageInner({ user, navigate }) {
  const { statusId: statusIdParam } = useParams()
  const [searchParams, setSearchParams] = useSearchParams()
  // Same upload modal as Home (StatusUploadModal)
  const [showUpload, setShowUpload] = useState(false)
  const [headerSearch, setHeaderSearch] = useState('')
  const [district, setDistrict]     = useState('All Districts')
  const [notifCount, setNotifCount] = useState(0)

  const [stories, setStories]               = useState([])
  const [storiesLoaded, setStoriesLoaded]   = useState(false)
  const [storiesError, setStoriesError]     = useState(null)
  const [viewerStories, setViewerStories]   = useState([])
  const [viewing, setViewing]               = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [sortOption, setSortOption]         = useState('Latest')
  const [searchQuery, setSearchQuery]       = useState('')
  const [followedIds, setFollowedIds]       = useState(new Set())
  const openedStatusRef = useRef(null)
  const autoOpenedRef = useRef(false)
  const [viewedIds, setViewedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('viewedStories') || '[]')) }
    catch { return new Set() }
  })
  const [windowWidth, setWindowWidth] = useState(window.innerWidth)
  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])
  const isMobile = windowWidth < 768

  // Auto-open the status composer when arriving via /status?compose=1
  useEffect(() => {
    if (searchParams.get('compose') === '1') {
      setShowUpload(true)
      const next = new URLSearchParams(searchParams)
      next.delete('compose')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  function reloadStories() {
    setStoriesError(null)
    setStoriesLoaded(false)
    return fetchAllActiveStories(user.id, categoryFilter).then(async data => {
      const listingIds = [...new Set(data.filter(s => s.tagged_listing_id).map(s => s.tagged_listing_id))]
      if (listingIds.length > 0) {
        const { data: ls } = await supabase.from('listings').select('id, description').in('id', listingIds)
        const descMap = {}
        for (const l of (ls || [])) descMap[l.id] = l.description
        setStories(data.map(s => ({ ...s, _taggedDescription: s.tagged_listing_id ? descMap[s.tagged_listing_id] : null })))
      } else {
        setStories(data)
      }
      setStoriesLoaded(true)
    }).catch(err => {
      console.error('Failed to load stories', err)
      setStoriesError(err)
      setStoriesLoaded(true)
    })
  }

  // Follow IDs + notif badge
  useEffect(() => {
    supabase.from('seller_follows').select('seller_id').eq('follower_id', user.id)
      .then(({ data }) => setFollowedIds(new Set((data || []).map(f => f.seller_id))))
    supabase.from('notifications').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('read', false)
      .then(({ count }) => setNotifCount(count || 0))
      .catch(() => {})
  }, [user])

  // Load stories
  useEffect(() => {
    reloadStories()
  }, [categoryFilter, user.id])

  // Auto-open a specific status when navigated from a chat status reply
  // Supports /status/:statusId and /status?status=<id>
  useEffect(() => {
    const targetId = statusIdParam || searchParams.get('status')
    if (!targetId) {
      openedStatusRef.current = null
      return
    }
    if (openedStatusRef.current === targetId) return

    const STATUS_SELECT = `id, content, status_type, expires_at, created_at, media_urls, tagged_listing_id, tagged_kind, tagged_ref_id, user_id, location_hint,
      profiles:user_id ( id, full_name, avatar_url, city, is_verified ),
      tagged:tagged_listing_id ( id, title, price, images, category, description, city, district )`

    function openStatus(match, pool) {
      const list = pool || stories
      const group = list.filter(s => s.user_id === match.user_id)
      const orderedGroup = group.length > 0 ? group : [match]
      const startIdx = Math.max(0, orderedGroup.findIndex(x => x.id === targetId))
      setViewerStories([
        ...orderedGroup,
        ...list.filter(x => x.user_id !== match.user_id),
      ])
      setViewing(startIdx)
      openedStatusRef.current = targetId
    }

    autoOpenedRef.current = true

    // Prefer opening from the loaded feed so the viewer can swipe that user's other statuses
    const inFeed = stories.find(s => s.id === targetId)
    if (inFeed) {
      openStatus(inFeed, stories)
      return
    }

    // Wait until the feed has finished loading before falling back to a direct fetch
    if (!storiesLoaded) return

    let cancelled = false
    ;(async () => {
      // Fetch the exact status (even if expired — user came from a chat reply to it)
      const { data: row } = await supabase
        .from('user_statuses')
        .select(STATUS_SELECT)
        .eq('id', targetId)
        .maybeSingle()

      if (cancelled || !row || openedStatusRef.current === targetId) return

      // Load that author's other active statuses so the viewer still feels natural
      const { data: siblings } = await supabase
        .from('user_statuses')
        .select(STATUS_SELECT)
        .eq('user_id', row.user_id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })

      if (cancelled || openedStatusRef.current === targetId) return

      const group = siblings?.length
        ? (siblings.some(s => s.id === row.id) ? siblings : [row, ...siblings])
        : [row]
      // Normalize profiles join (Supabase may return array)
      for (const s of group) {
        if (Array.isArray(s.profiles)) s.profiles = s.profiles[0] || null
      }
      const startIdx = Math.max(0, group.findIndex(x => x.id === targetId))
      setViewerStories(group)
      setViewing(startIdx)
      openedStatusRef.current = targetId
    })()

    return () => { cancelled = true }
  }, [statusIdParam, searchParams, stories, storiesLoaded])

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('status-page-stories')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_statuses' }, () => {
        reloadStories()
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [categoryFilter, user.id])

  // Search filter
  const searchedStories = searchQuery.trim()
    ? stories.filter(s => {
        const q = searchQuery.toLowerCase()
        return (
          s.content?.toLowerCase().includes(q) ||
          s.profiles?.full_name?.toLowerCase().includes(q) ||
          s.tagged?.title?.toLowerCase().includes(q) ||
          s.tagged?.category?.toLowerCase().includes(q) ||
          s._taggedDescription?.toLowerCase().includes(q)
        )
      })
    : stories

  // Build story groups (by user)
  const storyGroups = (() => {
    const userMap = new Map()
    for (const s of searchedStories) {
      if (!userMap.has(s.user_id)) userMap.set(s.user_id, [])
      userMap.get(s.user_id).push(s)
    }
    const cards = Array.from(userMap.values()).map(group => ({
      ...group[0],
      _ownGroup: group,
      _isCurrentUser: group[0].user_id === user.id,
    }))
    const own = cards.filter(c => c.user_id === user.id)
    const others = cards.filter(c => c.user_id !== user.id)
    return [...own, ...others]
  })()

  const nearbyGroups = (() => {
    if (!user?.city) return []
    const nearby = stories.filter(s =>
      s.user_id !== user.id &&
      s.profiles?.city?.toLowerCase().trim() === user.city.toLowerCase().trim()
    )
    const userMap = new Map()
    for (const s of nearby) {
      if (!userMap.has(s.user_id)) userMap.set(s.user_id, [])
      userMap.get(s.user_id).push(s)
    }
    return Array.from(userMap.values())
  })()

  const followedGroups = (() => {
    if (followedIds.size === 0) return []
    const followed = stories.filter(s => followedIds.has(s.user_id) && s.user_id !== user.id)
    const userMap = new Map()
    for (const s of followed) {
      if (!userMap.has(s.user_id)) userMap.set(s.user_id, [])
      userMap.get(s.user_id).push(s)
    }
    return Array.from(userMap.values())
  })()

  async function openStoryGroup(groupLeader) {
    const s = groupLeader
    const ids = s._ownGroup ? s._ownGroup.map(x => x.id) : [s.id]
    setViewedIds(prev => {
      const next = new Set([...prev, ...ids])
      localStorage.setItem('viewedStories', JSON.stringify([...next]))
      return next
    })
    if (s._ownGroup && s._ownGroup.length > 0) {
      setViewerStories([...s._ownGroup, ...stories.filter(x => x.user_id !== s.user_id)])
      setViewing(0)
    } else {
      const { data } = await supabase.from('user_statuses')
        .select(`id, content, status_type, expires_at, created_at, media_urls, tagged_listing_id, user_id, location_hint,
          profiles:user_id ( id, full_name, avatar_url, is_verified ),
          tagged:tagged_listing_id ( id, title, price, images, category, description )`)
        .eq('user_id', s.user_id).gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      const norm = (data || []).map(x => {
        if (Array.isArray(x.profiles)) x.profiles = x.profiles[0] || null
        return x
      })
      setViewerStories(norm.length ? norm : [s])
      setViewing(0)
    }
  }

  // Recent statuses (list view, excluding own)
  const recentStatuses = searchedStories
    .filter(s => s.user_id !== user.id)
    .slice(0, 12)

  const { metrics: feedMetrics, likeStory } = useStoryFeedMetrics(recentStatuses, user.id)

  async function openFeedStory(s) {
    const { data } = await supabase.from('user_statuses')
      .select(`id, content, status_type, expires_at, created_at, media_urls, tagged_listing_id, user_id, location_hint,
        profiles:user_id ( id, full_name, avatar_url, is_verified ),
        tagged:tagged_listing_id ( id, title, price, images, category, description )`)
      .eq('user_id', s.user_id).gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    const norm = (data || []).map(x => {
      if (Array.isArray(x.profiles)) x.profiles = x.profiles[0] || null
      return x
    })
    setViewerStories(norm.length ? norm : [s])
    setViewing(0)
  }

  return (
    <div className="st-page" style={{ minHeight: '100vh', background: T.bg, fontFamily: T.font, color: T.text, paddingBottom: 88 }}>

      {/* Shared marketplace header (same as Home / Looking For) */}
      <SokoNav
        user={user}
        notifCount={notifCount}
        search={headerSearch}
        setSearch={setHeaderSearch}
        navigate={navigate}
        activeDistrict={district}
        onDistrictChange={setDistrict}
        activePillar="stories"
        ctaLabel="Post status"
        onCta={() => setShowUpload(true)}
      />

      {!isMobile && (
        <section className="st-hero" style={{
          position: 'relative',
          overflow: 'hidden',
          borderBottom: `1px solid ${T.border}`,
        }}>
          <div
            aria-hidden
            className="st-hero-bg"
            style={{
              position: 'absolute', inset: 0,
              backgroundImage: `url(${STATUS_HERO_IMG})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center 40%',
              transform: 'scale(1.02)',
            }}
          />
          <div aria-hidden style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: `
              linear-gradient(105deg,
                rgba(6, 40, 22, 0.92) 0%,
                rgba(10, 80, 45, 0.82) 42%,
                rgba(15, 157, 88, 0.55) 72%,
                rgba(15, 157, 88, 0.35) 100%
              ),
              linear-gradient(180deg,
                rgba(0,0,0,0.15) 0%,
                transparent 45%,
                rgba(0,0,0,0.25) 100%
              )
            `,
          }} />
          <div className="st-hero-inner" style={{
            position: 'relative', zIndex: 1,
            maxWidth: 1400, margin: '0 auto',
            padding: '32px 24px 28px',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 20,
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(255,255,255,0.14)',
                border: '1px solid rgba(255,255,255,0.22)',
                backdropFilter: 'blur(8px)',
                borderRadius: 999, padding: '5px 11px', marginBottom: 10,
                fontSize: 11, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.95)',
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%', background: '#4ade80',
                  boxShadow: '0 0 0 3px rgba(74,222,128,0.3)',
                }} />
                Live on SokoMw
              </div>
              <h1 className="st-hero-title" style={{
                fontFamily: T.fontDisplay,
                fontSize: 'clamp(22px, 3.5vw, 32px)',
                fontWeight: 800, color: '#fff', margin: '0 0 8px',
                letterSpacing: -0.5, lineHeight: 1.15,
                textShadow: '0 2px 18px rgba(0,0,0,0.35)',
              }}>
                Status updates
              </h1>
              <p className="st-hero-sub" style={{
                margin: 0, fontSize: 14.5, fontWeight: 500,
                color: 'rgba(255,255,255,0.9)', maxWidth: 480, lineHeight: 1.5,
                textShadow: '0 1px 10px rgba(0,0,0,0.3)',
              }}>
                See what sellers are posting right now — availability, deals, and work across Malawi.
              </p>
            </div>
            <button
              type="button"
              className="st-hero-cta"
              onClick={() => setShowUpload(true)}
              style={{
                flexShrink: 0,
                background: T.orange,
                color: '#1a1a1a',
                border: 'none',
                borderRadius: 12,
                padding: '12px 18px',
                fontSize: 14, fontWeight: 800,
                cursor: 'pointer',
                fontFamily: 'inherit',
                boxShadow: '0 4px 18px rgba(249,171,0,0.4)',
                whiteSpace: 'nowrap',
              }}
            >
              + Post status
            </button>
          </div>
        </section>
      )}

      <div className="st-main" style={{
        maxWidth: 1400, margin: '0 auto',
        padding: '18px 20px 28px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>

        {/* ── Filters (compact modern bar) ── */}
        <div className="st-filter-shell">
          <div className="st-search">
            <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden>
              <circle cx="6" cy="6" r="4.5" stroke={T.textMuted} strokeWidth="1.4"/>
              <path d="M10 10l2.5 2.5" stroke={T.textMuted} strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search sellers, products, services…"
            />
            {searchQuery && (
              <button type="button" className="st-search-clear" onClick={() => setSearchQuery('')}>✕</button>
            )}
          </div>
          <div className="st-cat-rail">
            {CATEGORY_TABS.map(cat => (
              <button
                key={cat.key}
                type="button"
                className={`st-chip${categoryFilter === cat.key ? ' is-on' : ''}`}
                onClick={() => setCategoryFilter(cat.key)}
              >
                {cat.label}
              </button>
            ))}
          </div>
          <div className="st-sort-row">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt}
                type="button"
                className={`st-sort${sortOption === opt ? ' is-on' : ''}`}
                onClick={() => setSortOption(opt)}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* ── Ring strip (IG-style) ── */}
        <section className="st-panel st-panel-rings">
          <SectionHeader
            kicker="Now live"
            title="Stories"
            count={storyGroups.length}
            right={
              <button type="button" className="st-text-btn" onClick={() => setShowUpload(true)}>
                + Add yours
              </button>
            }
          />
          <ScrollRail step={240} deps={[storyGroups.length]} style={{ gap: 14, padding: '2px 4px 6px' }}>
            <button
              type="button"
              className="st-ring-item st-ring-create"
              onClick={() => setShowUpload(true)}
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
                {user.avatar_url
                  ? <img src={user.avatar_url} alt="" style={{ position: 'absolute', inset: 3, width: 'calc(100% - 6px)', height: 'calc(100% - 6px)', borderRadius: '50%', objectFit: 'cover', opacity: 0.45 }} />
                  : null}
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

            {storyGroups.map(s => (
              <StoryRingItem
                key={s.user_id}
                s={s}
                isOwn={s.user_id === user.id}
                viewedIds={viewedIds}
                onClick={() => openStoryGroup(s)}
              />
            ))}
          </ScrollRail>
        </section>

        {/* ── Cinematic tiles ── */}
        <section className="st-panel">
          <SectionHeader
            kicker="Discover"
            title="Featured moments"
            count={storyGroups.length || undefined}
          />
          {storyGroups.length > 0 ? (
            <ScrollRail step={340} deps={[storyGroups.length]} style={{ gap: 12, padding: '2px 2px 8px' }}>
              {storyGroups.map((s, i) => (
                <StoryCard
                  key={s.user_id}
                  s={s}
                  index={i}
                  isOwn={s.user_id === user.id}
                  viewedIds={viewedIds}
                  onClick={() => openStoryGroup(s)}
                />
              ))}
            </ScrollRail>
          ) : (
            <div className="st-empty-inline">
              <p>No live stories yet — share the first update.</p>
              <button type="button" className="st-primary-btn" onClick={() => setShowUpload(true)}>Post status</button>
            </div>
          )}
        </section>

        {/* ── Following ── */}
        {followedGroups.length > 0 && (
          <section className="st-panel">
            <SectionHeader kicker="Network" title="Following" count={followedGroups.length} />
            <ScrollRail step={340} deps={[followedGroups.length]} style={{ gap: 12, padding: '2px 2px 8px' }}>
              {followedGroups.map((group, i) => {
                const s = group[0]
                return (
                  <StoryCard
                    key={s.user_id}
                    s={{ ...s, _ownGroup: group }}
                    index={i}
                    isOwn={false}
                    viewedIds={viewedIds}
                    onClick={() => openStoryGroup({ ...s, _ownGroup: group })}
                  />
                )
              })}
            </ScrollRail>
          </section>
        )}

        {/* ── Near you ── */}
        {nearbyGroups.length > 0 && (
          <section className="st-panel">
            <SectionHeader
              kicker="Local"
              title="Near you"
              count={nearbyGroups.length}
              right={<span className="st-loc-pill">📍 {user.city}</span>}
            />
            <ScrollRail step={340} deps={[nearbyGroups.length]} style={{ gap: 12, padding: '2px 2px 8px' }}>
              {nearbyGroups.map((group, i) => {
                const s = group[0]
                return (
                  <StoryCard
                    key={s.user_id}
                    s={{ ...s, _ownGroup: group }}
                    index={i}
                    isOwn={false}
                    viewedIds={viewedIds}
                    nearBadge
                    onClick={() => {
                      setViewerStories([...group, ...stories.filter(x => x.user_id !== s.user_id)])
                      setViewing(0)
                    }}
                  />
                )
              })}
            </ScrollRail>
          </section>
        )}

        {/* ── Feed ── */}
        {storiesError && storyGroups.length === 0 ? (
          <section className="st-feed-section">
            <SectionHeader kicker="Timeline" title="Latest updates" />
            <div className="st-empty st-empty-error">
              <div className="st-empty-ico">⚠️</div>
              <h3>Couldn't load stories</h3>
              <p>Something went wrong while loading status updates. Check your connection and try again.</p>
              <div className="st-empty-actions">
                <button type="button" className="st-primary-btn" onClick={() => reloadStories()}>Retry</button>
              </div>
            </div>
          </section>
        ) : recentStatuses.length > 0 ? (
          <section className="st-feed-section">
            <SectionHeader kicker="Timeline" title="Latest updates" count={recentStatuses.length} />
            <div className="st-feed-grid">
              {recentStatuses.map(s => (
                <StatusFeedCard
                  key={s.id}
                  s={s}
                  currentUserId={user.id}
                  metrics={feedMetrics}
                  onLike={likeStory}
                  onOpen={() => openFeedStory(s)}
                />
              ))}
            </div>
          </section>
        ) : !storiesLoaded ? (
          <section className="st-feed-section" aria-hidden>
            <SectionHeader kicker="Timeline" title="Latest updates" />
            <div className="st-feed-grid">
              {Array.from({ length: 4 }).map((_, i) => (
                <div className="st-feed-card st-feed-skeleton" key={i}>
                  <div className="st-feed-skel-media" />
                  <div className="st-feed-body">
                    <div className="st-skel-row st-skel-w30" />
                    <div className="st-skel-row st-skel-w80" />
                    <div className="st-skel-row st-skel-w55" />
                    <div className="st-skel-row st-skel-w70" />
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : storyGroups.length === 0 ? (
          <div className="st-empty">
            <div className="st-empty-ico">✦</div>
            <h3>No status updates yet</h3>
            <p>Follow sellers or post a status so buyers can see what’s available right now.</p>
            <div className="st-empty-actions">
              <button type="button" className="st-secondary-btn" onClick={() => navigate('/shops')}>Browse shops</button>
              <button type="button" className="st-primary-btn" onClick={() => setShowUpload(true)}>Post status</button>
            </div>
          </div>
        ) : null}
      </div>

      {/* Story viewer + upload — same components as Home */}
      {viewing !== null && (
        <StoryViewer stories={viewerStories} startIndex={viewing} currentUserId={user.id} onClose={() => {
          setViewing(null)
          if (autoOpenedRef.current) {
            autoOpenedRef.current = false
            navigate('/', { replace: true })
          }
        }} />
      )}
      {showUpload && (
        <StatusUploadModal
          user={user}
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false)
            reloadStories()
          }}
        />
      )}
      <style>{`
        .st-page { -webkit-tap-highlight-color: transparent; }
        .st-cat-rail::-webkit-scrollbar,
        .st-rail::-webkit-scrollbar { display: none; }
        .st-rail { -ms-overflow-style: none; scrollbar-width: none; }

        .st-scroll-arrow {
          position: absolute; top: 50%; transform: translateY(-50%); z-index: 10;
          width: 38px; height: 38px; border-radius: 50%;
          background: rgba(255,255,255,0.96); border: 1px solid ${T.border};
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; box-shadow: 0 4px 16px rgba(0,0,0,0.1);
          color: #374151; transition: all 0.15s; padding: 0; font-family: inherit;
        }
        .st-scroll-arrow:hover {
          background: ${T.green}; border-color: ${T.green}; color: #fff;
          box-shadow: 0 6px 18px rgba(15,157,88,0.32);
        }
        .st-scroll-arrow.is-hidden { opacity: 0; pointer-events: none; }

        .st-filter-shell {
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 18px;
          padding: 12px 12px 10px;
          box-shadow: ${T.shadow};
        }
        .st-search {
          display: flex; align-items: center; gap: 10px;
          background: ${T.bg}; border: 1.5px solid ${T.border};
          border-radius: 14px; padding: 11px 14px;
        }
        .st-search input {
          flex: 1; border: none; outline: none; background: transparent;
          font-size: 13.5px; font-weight: 500; color: ${T.text}; font-family: inherit;
        }
        .st-search-clear {
          width: 22px; height: 22px; border-radius: 50%; border: none;
          background: ${T.border}; color: ${T.textSub}; cursor: pointer;
          font-size: 11px; display: grid; place-items: center;
        }
        .st-cat-rail {
          display: flex; gap: 8px; overflow-x: auto;
          padding: 12px 2px 8px; scrollbar-width: none;
        }
        .st-chip {
          flex-shrink: 0; border-radius: 999px; padding: 7px 14px;
          border: 1px solid ${T.border}; background: #fff;
          font-size: 12.5px; font-weight: 700; color: ${T.textSub};
          cursor: pointer; font-family: inherit; transition: all 0.15s;
        }
        .st-chip.is-on {
          background: ${T.green}; border-color: ${T.green}; color: #fff;
          box-shadow: 0 4px 12px rgba(15,157,88,0.25);
        }
        .st-sort-row {
          display: flex; gap: 6px; flex-wrap: wrap;
          padding-top: 4px; border-top: 1px solid ${T.border};
        }
        .st-sort {
          border: none; background: transparent; border-radius: 999px;
          padding: 6px 11px; font-size: 11.5px; font-weight: 700;
          color: ${T.textMuted}; cursor: pointer; font-family: inherit;
        }
        .st-sort.is-on { background: ${T.greenLight}; color: ${T.green}; }

        .st-panel {
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 20px;
          padding: 16px 16px 14px;
          box-shadow: ${T.shadow};
        }
        .st-panel-rings { padding-bottom: 12px; }

        .st-text-btn {
          border: none; background: ${T.greenLight}; color: ${T.green};
          border-radius: 999px; padding: 8px 12px; font-size: 12px; font-weight: 800;
          cursor: pointer; font-family: inherit; white-space: nowrap;
        }
        .st-loc-pill {
          font-size: 11.5px; font-weight: 700; color: ${T.textSub};
          background: ${T.bg}; border: 1px solid ${T.border};
          border-radius: 999px; padding: 6px 10px;
        }

        .st-glass-chip {
          display: inline-flex; align-items: center;
          font-size: 9.5px; font-weight: 800; letter-spacing: 0.2px;
          color: #fff; background: rgba(0,0,0,0.38);
          border: 1px solid rgba(255,255,255,0.18);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          border-radius: 999px; padding: 3px 8px;
        }
        .st-glass-urgent {
          background: rgba(230,81,0,0.85); border-color: rgba(255,255,255,0.2);
        }

        .st-story-tile:hover { transform: translateY(-4px) scale(1.01); }
        .st-story-tile:active { transform: scale(0.98); }
        .st-story-tile:hover .st-story-tile-media { transform: scale(1.05); }
        .st-story-tile-media { transition: transform 0.45s ease; }

        .st-feed-section { min-width: 0; }
        .st-feed-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 14px;
          align-items: stretch;
          max-width: 640px;
          margin: 0 auto;
        }
        .st-feed-card {
          display: flex; flex-direction: column;
          background: ${T.surface};
          border: 1px solid ${T.border};
          border-radius: 18px;
          overflow: hidden;
          box-shadow: ${T.shadow};
          transition: transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease;
          font-family: inherit;
          height: 100%;
          min-height: 0;
        }
        .st-feed-card:hover {
          transform: translateY(-3px);
          box-shadow: ${T.shadowMd};
          border-color: rgba(15,157,88,0.22);
        }
        .st-feed-card:focus-visible {
          outline: 2px solid ${T.green};
          outline-offset: 2px;
        }
        .st-feed-card.is-urgent {
          border-color: rgba(230,81,0,0.3);
          box-shadow: 0 4px 18px rgba(230,81,0,0.08);
        }
        .st-feed-body {
          padding: 14px;
          display: flex;
          flex-direction: column;
          gap: 11px;
          min-width: 0;
          flex: 1;
        }
        .st-feed-head {
          display: flex;
          align-items: center;
          gap: 10px;
          min-width: 0;
        }
        .st-feed-headbtn {
          display: flex; align-items: center; gap: 10px;
          min-width: 0; flex: 1; cursor: pointer;
          border: none; background: none; padding: 0; font-family: inherit; text-align: left;
        }
        .st-feed-avatar {
          width: 42px; height: 42px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
          background: linear-gradient(135deg, ${T.green}, #34c77a);
          color: #fff; font-weight: 800; font-size: 15px;
          display: flex; align-items: center; justify-content: center;
          box-shadow: 0 0 0 2.5px #fff, 0 0 0 4px ${T.greenLight};
        }
        .st-feed-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .st-feed-who { min-width: 0; flex: 1; }
        .st-feed-name-row { display: flex; align-items: center; gap: 5px; min-width: 0; }
        .st-feed-name {
          font-size: 13.5px; font-weight: 800; color: ${T.text};
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .st-feed-meta {
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
          margin-top: 4px; font-size: 11px; color: ${T.textMuted}; font-weight: 600;
        }
        .st-feed-time { white-space: nowrap; }
        .st-feed-loc {
          display: inline-flex; align-items: center; gap: 3px;
          max-width: 110px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
          color: ${T.textMuted};
        }
        .st-feed-expires {
          display: inline-flex; align-items: center; gap: 4px;
          flex-shrink: 0;
          font-size: 10.5px; font-weight: 800; color: #b45309;
          background: #fef3c7; border: 1px solid rgba(245,158,11,0.28);
          border-radius: 999px; padding: 5px 9px; line-height: 1; white-space: nowrap;
        }
        .st-feed-expires.is-expired { color: #b91c1c; background: #fee2e2; border-color: rgba(220,38,38,0.28); }
        .st-feed-open {
          flex-shrink: 0;
          width: 28px; height: 28px; border-radius: 50%;
          background: ${T.bg}; color: ${T.textMuted};
          display: grid; place-items: center;
          font-size: 18px; font-weight: 600; line-height: 1;
          transition: background 0.15s, color 0.15s;
        }
        .st-feed-card:hover .st-feed-open {
          background: ${T.greenLight}; color: ${T.green};
        }
        .st-feed-media {
          position: relative;
          width: 100%;
          aspect-ratio: 16 / 10;
          border-radius: 14px;
          overflow: hidden;
          background: linear-gradient(145deg, #0f172a, #1e293b);
          flex-shrink: 0;
          border: none; padding: 0; cursor: pointer; display: block;
        }
        .st-feed-media img,
        .st-feed-media video {
          width: 100%; height: 100%; object-fit: cover; display: block;
        }
        .st-feed-media-fade {
          position: absolute; left: 0; right: 0; bottom: 0; height: 28%;
          background: linear-gradient(to top, rgba(0,0,0,0.18), transparent);
          pointer-events: none;
        }
        .st-feed-play {
          position: absolute; left: 50%; top: 50%;
          transform: translate(-50%,-50%);
          width: 44px; height: 44px; border-radius: 50%;
          background: rgba(0,0,0,0.5); color: #fff;
          display: grid; place-items: center;
          font-size: 13px; border: 1.5px solid rgba(255,255,255,0.4);
          backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
          box-shadow: 0 4px 16px rgba(0,0,0,0.25);
        }
        .st-feed-text {
          margin: 0;
          font-size: 14px;
          line-height: 1.45;
          color: ${T.text};
          font-weight: 600;
          letter-spacing: -0.01em;
          display: -webkit-box;
          -webkit-line-clamp: 3;
          -webkit-box-orient: vertical;
          overflow: hidden;
          min-height: 1.35em;
          flex: 1;
        }
        .st-feed-tag {
          display: flex; align-items: center; gap: 10px;
          background: linear-gradient(135deg, ${T.greenLight} 0%, #f0fdf4 100%);
          border: 1px solid rgba(15,157,88,0.14);
          border-radius: 12px; padding: 8px 10px;
          margin-top: auto;
        }
        .st-feed-tag img,
        .st-feed-tag-ph {
          width: 40px; height: 40px; border-radius: 10px; object-fit: cover; flex-shrink: 0;
        }
        .st-feed-tag-ph {
          background: #fff; display: grid; place-items: center; font-size: 16px;
          border: 1px solid rgba(15,157,88,0.1);
        }
        .st-feed-tag-copy { min-width: 0; flex: 1; display: flex; flex-direction: column; gap: 2px; }
        .st-feed-tag-copy strong {
          font-size: 12.5px; color: ${T.text}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .st-feed-tag-copy span { font-size: 12.5px; font-weight: 800; color: ${T.green}; }
        .st-feed-tag-cta {
          font-size: 11px; font-weight: 800; color: ${T.green};
          background: #fff; border: 1px solid rgba(15,157,88,0.18);
          border-radius: 999px; padding: 6px 11px; flex-shrink: 0;
        }
        .st-feed-stats {
          display: flex; align-items: center; gap: 16px;
          padding: 9px 0 2px;
        }
        .st-feed-views {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11.5px; font-weight: 700; color: ${T.textMuted};
        }
        .st-feed-stat {
          display: inline-flex; align-items: center; gap: 5px;
          font-size: 11.5px; font-weight: 700; color: ${T.textMuted};
        }
        .st-feed-eng {
          display: flex; align-items: stretch;
          border-top: 1px solid ${T.border};
          margin-top: 6px;
        }
        .st-feed-eng-btn {
          flex: 1;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          border: none; background: none; padding: 11px 6px;
          font-family: inherit; font-size: 12.5px; font-weight: 700; color: ${T.textSub};
          cursor: pointer; border-radius: 10px; min-height: 44px;
          transition: color 0.15s, background 0.15s;
        }
        .st-feed-eng-btn:hover { background: ${T.bg}; color: ${T.text}; }
        .st-feed-eng-btn.is-active { color: ${T.green}; background: ${T.greenLight}; }
        .st-feed-eng-btn.is-liked { color: #ea4335; }
        @keyframes stHeartPop {
          0% { transform: scale(1); }
          35% { transform: scale(1.45); }
          100% { transform: scale(1); }
        }
        .st-feed-eng-btn.is-liked svg { animation: stHeartPop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1); }

        .st-feed-comments { overflow: hidden; }
        .st-feed-comments-in {
          display: flex; flex-direction: column; gap: 12px;
          background: ${T.bg}; border: 1px solid ${T.border};
          border-radius: 14px; padding: 12px;
          max-height: 320px; overflow-y: auto;
        }
        .st-feed-comments-state { font-size: 12.5px; color: ${T.textMuted}; font-weight: 600; text-align: center; padding: 8px 0; }
        .st-feed-comments-feedback {
          font-size: 12px; font-weight: 700; text-align: center; padding: 6px 10px;
          color: ${T.green}; background: ${T.greenLight}; border-radius: 999px;
        }
        .st-feed-comments-feedback.is-error { color: #b91c1c; background: #fee2e2; }
        .st-feed-comment { display: flex; gap: 9px; }
        .st-feed-comment-avatar {
          width: 30px; height: 30px; border-radius: 50%; overflow: hidden; flex-shrink: 0;
          background: linear-gradient(135deg, ${T.green}, #34c77a);
          color: #fff; font-weight: 800; font-size: 12px;
          display: flex; align-items: center; justify-content: center;
        }
        .st-feed-comment-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .st-feed-comment-body { min-width: 0; flex: 1; }
        .st-feed-comment-head { display: flex; align-items: baseline; gap: 8px; }
        .st-feed-comment-head strong { font-size: 12.5px; color: ${T.text}; }
        .st-feed-comment-head span { font-size: 10.5px; color: ${T.textMuted}; font-weight: 600; }
        .st-feed-comment-body p {
          margin: 3px 0 0; font-size: 13px; line-height: 1.45; color: ${T.text};
          background: #fff; border: 1px solid ${T.border}; border-radius: 12px;
          padding: 8px 11px;
        }
        .st-feed-comment-box { display: flex; gap: 8px; align-items: center; }
        .st-feed-comment-box input {
          flex: 1; min-width: 0;
          border: 1px solid ${T.borderDark}; border-radius: 999px;
          padding: 10px 14px; font-size: 13px; font-family: inherit;
          color: ${T.text}; background: #fff; outline: none;
          transition: border-color 0.15s;
        }
        .st-feed-comment-box input:focus { border-color: ${T.green}; }
        .st-feed-comment-send {
          width: 38px; height: 38px; border-radius: 50%; border: none; flex-shrink: 0;
          background: ${T.green}; color: #fff; cursor: pointer;
          display: grid; place-items: center;
          transition: opacity 0.15s;
        }
        .st-feed-comment-send:disabled { opacity: 0.45; cursor: default; }

        .st-feed-card.st-feed-skeleton { cursor: default; pointer-events: none; }
        .st-feed-skel-media,
        .st-skel-row {
          background: linear-gradient(90deg, ${T.border} 25%, #f4f6f7 45%, ${T.border} 65%);
          background-size: 300% 100%;
          animation: stShimmer 1.3s ease-in-out infinite;
        }
        .st-feed-skel-media { width: 100%; aspect-ratio: 16 / 10; border-radius: 14px; flex-shrink: 0; }
        .st-skel-row { height: 13px; border-radius: 7px; }
        .st-skel-w30 { width: 30%; }
        .st-skel-w55 { width: 55%; }
        .st-skel-w70 { width: 70%; }
        .st-skel-w80 { width: 80%; }
        @keyframes stShimmer {
          0% { background-position: 100% 0; }
          100% { background-position: 0 0; }
        }

        .st-empty-inline {
          text-align: center; padding: 28px 16px;
          border: 1.5px dashed ${T.border}; border-radius: 16px; color: ${T.textMuted};
        }
        .st-empty-inline p { margin: 0 0 12px; font-size: 13.5px; font-weight: 600; }
        .st-empty {
          background: ${T.surface}; border: 1px solid ${T.border}; border-radius: 20px;
          padding: 44px 24px; text-align: center; box-shadow: ${T.shadow};
        }
        .st-empty-ico {
          width: 56px; height: 56px; border-radius: 18px; margin: 0 auto 14px;
          background: linear-gradient(135deg, ${T.greenLight}, #ecfdf5);
          color: ${T.green}; display: grid; place-items: center; font-size: 22px; font-weight: 800;
        }
        .st-empty h3 {
          margin: 0 0 8px; font-family: ${T.fontDisplay}; font-size: 18px; font-weight: 800; color: ${T.text};
        }
        .st-empty p {
          margin: 0 auto 18px; max-width: 340px; font-size: 13.5px; color: ${T.textMuted}; line-height: 1.5;
        }
        .st-empty-actions { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; }
        .st-empty-error .st-empty-ico {
          background: linear-gradient(135deg, #fef3c7, #fffbeb);
          color: #b45309;
        }
        .st-empty-error h3 { color: #92400e; }
        .st-empty-error p { max-width: 380px; }
        .st-primary-btn {
          border: none; background: ${T.green}; color: #fff; border-radius: 12px;
          padding: 11px 16px; font-size: 13px; font-weight: 800; cursor: pointer; font-family: inherit;
          box-shadow: 0 4px 14px rgba(15,157,88,0.28);
        }
        .st-secondary-btn {
          border: 1.5px solid ${T.green}; background: ${T.greenLight}; color: ${T.green};
          border-radius: 12px; padding: 11px 16px; font-size: 13px; font-weight: 800;
          cursor: pointer; font-family: inherit;
        }

        @media (max-width: 768px) {
          .st-hero-inner {
            padding: 18px 14px 16px !important;
            flex-direction: column !important;
            align-items: stretch !important;
            gap: 12px !important;
          }
          .st-hero-title { font-size: 22px !important; }
          .st-hero-sub { font-size: 13px !important; }
          .st-hero-cta {
            width: 100% !important;
            justify-content: center !important;
            min-height: 42px;
          }
          .st-main {
            padding: 12px 14px 24px !important;
            gap: 12px !important;
          }
          .st-scroll-arrow { display: none !important; }
          .st-hero-bg { background-position: center 35% !important; }
          .st-panel { border-radius: 16px; padding: 14px 12px 12px; }
          .st-story-tile { width: 136px !important; height: 210px !important; }
          .st-feed-grid { gap: 10px; }
          .st-feed-media { aspect-ratio: 16 / 9; }
        }
        @media (max-width: 420px) {
          .st-feed-body { padding: 12px; gap: 9px; }
          .st-feed-text { font-size: 13.5px; }
        }
      `}</style>
    </div>
  )
}