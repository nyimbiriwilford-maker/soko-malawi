import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStatuses } from '../hooks/useStatuses'
import { fetchAllActiveStories } from '../hooks/useStatuses'
import StoryViewer from '../components/StoryViewer'
import FollowButton from '../components/FollowButton'

// ─────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────
const T = {
  green:      '#1a7a4a',
  greenLight: '#e8f5e9',
  greenMid:   '#2e7d32',
  greenGlow:  'rgba(26,122,74,0.12)',
  orange:     '#e65100',
  orangeLight:'#fff3e0',
  surface:    '#ffffff',
  bg:         '#f4f5f7',
  border:     '#e5e7eb',
  borderDark: '#d1d5db',
  text:       '#0f1410',
  textSub:    '#6b7280',
  textMuted:  '#9ca3af',
  verified:   '#1976d2',
}

// ─────────────────────────────────────────────
// Composer data
// ─────────────────────────────────────────────
const TEMPLATES = {
  availability: [
    { emoji: '✅', text: 'Available today — can meet in Blantyre CBD' },
    { emoji: '✅', text: 'Available today — can meet in Lilongwe City' },
    { emoji: '💬', text: 'Negotiable on prices today' },
    { emoji: '📦', text: 'Just restocked — new items listed' },
    { emoji: '🕐', text: 'Busy this week, responding slowly' },
    { emoji: '🚫', text: 'Away until Friday' },
  ],
  listing_update: [
    { emoji: '✅', text: 'Still available — can meet today' },
    { emoji: '🔥', text: 'Price dropped — see new price' },
    { emoji: '⚡', text: 'Two people interested — first to confirm gets it' },
    { emoji: '🔒', text: 'Reserved — deal not confirmed yet' },
    { emoji: '📍', text: 'Available for pickup now' },
  ],
  work_ping: [
    { emoji: '💼', text: 'Available for work this week' },
    { emoji: '📞', text: 'Available for jobs — contact me' },
    { emoji: '🚫', text: 'Fully booked until next week' },
  ],
}

const EXPIRY_LABELS = {
  availability:   '24 hours',
  listing_update: '24 hours',
  work_ping:      '48 hours',
}

const TAB_META = {
  availability:   { label: 'Availability', emoji: '🟢' },
  listing_update: { label: 'Listing',      emoji: '🏷️' },
  work_ping:      { label: 'Work',         emoji: '💼' },
}

const CATEGORY_TABS = [
  { key: 'All',          label: 'All',          emoji: '🌐' },
  { key: 'Availability', label: 'Availability',  emoji: '🟢' },
  { key: 'Work',         label: 'Work',          emoji: '💼' },
  { key: '🔥 Urgent',    label: 'Urgent',        emoji: '🔥' },
  { key: 'Electronics',  label: 'Electronics',   emoji: '📱' },
  { key: 'Vehicles',     label: 'Vehicles',      emoji: '🚗' },
  { key: 'Clothing',     label: 'Clothing',      emoji: '👗' },
  { key: 'Furniture',    label: 'Furniture',     emoji: '🛋️' },
  { key: 'Property',     label: 'Property',      emoji: '🏠' },
  { key: 'Agriculture',  label: 'Agriculture',   emoji: '🌾' },
  { key: 'Food',         label: 'Food',          emoji: '🍎' },
  { key: 'Services',     label: 'Services',      emoji: '🔧' },
  { key: 'Other',        label: 'Other',         emoji: '📦' },
]

const SORT_OPTIONS = ['Latest', 'Trending', 'Most Viewed', 'Following']

const CARD_GRADIENTS = [
  'linear-gradient(160deg,#0a2e1a,#1a7a4a)',
  'linear-gradient(160deg,#0d1b2a,#1a3a6c)',
  'linear-gradient(160deg,#2a0d0d,#7a2020)',
  'linear-gradient(160deg,#1a0a2e,#4a1a7a)',
  'linear-gradient(160deg,#0a1a2e,#1a5a6a)',
  'linear-gradient(160deg,#1c1a0a,#5a6a1a)',
]

// ─────────────────────────────────────────────
// Tiny reusable components
// ─────────────────────────────────────────────
function Badge({ children, color = T.green, bg }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      background: bg || `rgba(26,122,74,0.1)`,
      color, borderRadius: 20, padding: '2px 8px',
      fontSize: 11, fontWeight: 700, lineHeight: 1.4,
    }}>{children}</span>
  )
}

function VerifiedBadge() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ flexShrink: 0 }}>
      <circle cx="6.5" cy="6.5" r="6.5" fill={T.verified}/>
      <path d="M3.5 6.5l2 2 4-4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

function SectionHeader({ icon, title, count, right }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '0 0 12px',
    }}>
      {icon && <span style={{ fontSize: 16 }}>{icon}</span>}
      <span style={{ fontSize: 14, fontWeight: 800, color: T.text }}>{title}</span>
      {count != null && (
        <span style={{
          background: T.greenLight, color: T.green,
          fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '1px 7px',
        }}>{count}</span>
      )}
      {right && <span style={{ marginLeft: 'auto' }}>{right}</span>}
    </div>
  )
}

function MetricCard({ value, label, icon, accent }) {
  return (
    <div style={{
      flex: '1 1 0', minWidth: 0,
      background: T.surface,
      border: `1px solid ${T.border}`,
      borderRadius: 12,
      padding: '12px 14px',
      display: 'flex', flexDirection: 'column', gap: 2,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
        <span style={{ fontSize: 16 }}>{icon}</span>
      </div>
      <div style={{ fontSize: 20, fontWeight: 900, color: accent || T.text, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 10, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
    </div>
  )
}

function StoryCard({ s, index, isOwn, viewedIds, user, onClick }) {
  const name   = s.profiles?.full_name || 'Seller'
  const avatar = s.profiles?.avatar_url
  const media  = s.media_urls?.[0]
  const initial = name[0]?.toUpperCase() || 'S'
  const isUrgent = s.content?.toLowerCase().includes('price drop') ||
                   s.content?.toLowerCase().includes('first to confirm')
  const allViewed = s._ownGroup?.every(x => viewedIds.has(x.id))
  const count = s._ownGroup?.length || s._statusCount || 1

  return (
    <div
      onClick={onClick}
      style={{
        flexShrink: 0, width: 106, height: 160,
        borderRadius: 12, overflow: 'hidden',
        position: 'relative', cursor: 'pointer',
        background: CARD_GRADIENTS[index % CARD_GRADIENTS.length],
        border: `2px solid ${
          isOwn ? T.green
          : !allViewed ? '#f9a825'
          : isUrgent ? 'rgba(230,81,0,0.5)'
          : T.border
        }`,
        boxShadow: !allViewed && !isOwn
          ? `0 0 0 2px rgba(249,168,37,0.25), 0 2px 10px rgba(0,0,0,0.1)`
          : '0 1px 6px rgba(0,0,0,0.08)',
      }}
    >
      {media
        ? <img src={media} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        : avatar
          ? <img src={avatar} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.85)', transform: 'scale(1.05)' }} />
          : null
      }
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 35%, rgba(0,0,0,0.72) 100%)' }} />

      {/* Avatar */}
      <div style={{
        position: 'absolute', top: 7, left: 7,
        width: 28, height: 28, borderRadius: '50%',
        border: `2px solid ${!allViewed && !isOwn ? '#f9a825' : '#fff'}`,
        overflow: 'hidden',
        background: 'linear-gradient(135deg,#1a7a4a,#22a05e)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 11, fontWeight: 800, color: '#fff',
        boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
      }}>
        {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
      </div>

      {/* Status count badge */}
      {count > 1 && (
        <div style={{
          position: 'absolute', top: 5, right: 6,
          background: 'rgba(0,0,0,0.55)', borderRadius: 10,
          padding: '2px 5px', fontSize: 9, fontWeight: 800, color: '#fff',
        }}>{count}</div>
      )}

      {isUrgent && (
        <div style={{ position: 'absolute', top: 7, right: 7, fontSize: 12, filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}>🔥</div>
      )}

      {/* Bottom */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '5px 6px 7px' }}>
        <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.7)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2 }}>
          {isOwn ? `You (${count})` : `${name.split(' ')[0]}`}
        </div>
        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.82)', fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
          {s.content}
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// Status list card (full-width)
// ─────────────────────────────────────────────
function StatusListCard({ s, onOpen, currentUserId }) {
  const name    = s.profiles?.full_name || 'Seller'
  const avatar  = s.profiles?.avatar_url
  const initial = name[0]?.toUpperCase() || 'S'
  const media   = s.media_urls?.[0]
  const isVideo = media && (media.endsWith('.mp4') || media.endsWith('.mov') || media.endsWith('.webm'))
  const isUrgent = s.content?.toLowerCase().includes('price drop') ||
                   s.content?.toLowerCase().includes('urgent') ||
                   s.content?.toLowerCase().includes('first to confirm')
  const timeAgo = (() => {
    const diff = Date.now() - new Date(s.created_at)
    const h = Math.floor(diff / 3600000)
    const m = Math.floor(diff / 60000)
    return h >= 1 ? `${h}h ago` : m < 1 ? 'Just now' : `${m}m ago`
  })()
  const category = s.status_type === 'availability' ? 'Availability'
    : s.status_type === 'work_ping' ? 'Work / Services'
    : s.tagged?.category || 'Listing Update'

  return (
    <div
      onClick={onOpen}
      style={{
        background: T.surface,
        border: `1px solid ${isUrgent ? 'rgba(230,81,0,0.25)' : T.border}`,
        borderRadius: 14,
        overflow: 'hidden',
        cursor: 'pointer',
        boxShadow: isUrgent
          ? '0 2px 12px rgba(230,81,0,0.08)'
          : '0 1px 4px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.15s, transform 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.1)'
        e.currentTarget.style.transform = 'translateY(-1px)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.boxShadow = isUrgent ? '0 2px 12px rgba(230,81,0,0.08)' : '0 1px 4px rgba(0,0,0,0.04)'
        e.currentTarget.style.transform = 'none'
      }}
    >
      {/* Urgent banner */}
      {isUrgent && (
        <div style={{ background: T.orange, padding: '4px 14px', fontSize: 10, fontWeight: 800, color: '#fff', letterSpacing: 0.5, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: 4 }}>
          🔥 Urgent Update
        </div>
      )}

      <div style={{ padding: '12px 14px' }}>
        {/* Seller row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 40, height: 40, borderRadius: '50%',
            border: `2px solid ${T.greenLight}`,
            overflow: 'hidden', flexShrink: 0,
            background: 'linear-gradient(135deg,#1a7a4a,#22a05e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 15, fontWeight: 800, color: '#fff',
          }}>
            {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
              <VerifiedBadge />
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 2 }}>
              <Badge color={T.green} bg={T.greenLight}>{category}</Badge>
              <span style={{ fontSize: 11, color: T.textMuted, alignSelf: 'center' }}>{timeAgo}</span>
            </div>
          </div>
        </div>

        {/* Media */}
        {media && (
          <div style={{ borderRadius: 10, overflow: 'hidden', marginBottom: 10, background: '#f3f4f6', maxHeight: 200, position: 'relative' }}>
            {isVideo
              ? <video src={media} style={{ width: '100%', height: 180, objectFit: 'cover' }} muted />
              : <img src={media} alt="" style={{ width: '100%', height: 180, objectFit: 'cover' }} />
            }
          </div>
        )}

        {/* Content */}
        <p style={{ margin: '0 0 10px', fontSize: 13, color: T.text, lineHeight: 1.55, fontWeight: 500 }}>
          {s.content}
        </p>

        {/* Tagged listing */}
        {s.tagged && (
          <div style={{
            display: 'flex', gap: 10, alignItems: 'center',
            background: T.greenLight, borderRadius: 10, padding: '8px 10px',
            marginBottom: 10,
          }}>
            {s.tagged.images?.[0] && (
              <img src={s.tagged.images[0]} alt="" style={{ width: 40, height: 40, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.tagged.title}</div>
              <div style={{ fontSize: 12, color: T.green, fontWeight: 800 }}>MK {Number(s.tagged.price).toLocaleString()}</div>
            </div>
            <div style={{ marginLeft: 'auto', flexShrink: 0 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: T.green, background: 'rgba(26,122,74,0.15)', padding: '2px 8px', borderRadius: 20 }}>View</span>
            </div>
          </div>
        )}

        {/* Footer stats + actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', gap: 12, flex: 1 }}>
            <span style={{ fontSize: 11, color: T.textMuted, display: 'flex', alignItems: 'center', gap: 3 }}>
              <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M6 2.5C3.5 2.5 1.5 5 1.5 6s2 3.5 4.5 3.5S10.5 7 10.5 6 8.5 2.5 6 2.5z" stroke={T.textMuted} strokeWidth="1.2"/><circle cx="6" cy="6" r="1.5" fill={T.textMuted}/></svg>
              {(s.view_count || 0).toLocaleString()}
            </span>
            {s.location_hint && (
              <span style={{ fontSize: 11, color: T.textMuted }}>📍 {s.location_hint}</span>
            )}
          </div>
          {s.user_id !== currentUserId && (
            <div onClick={e => e.stopPropagation()} style={{ flexShrink: 0 }}>
              <FollowButton currentUserId={currentUserId} sellerId={s.user_id} size="sm" />
            </div>
          )}
        </div>
      </div>
    </div>
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
  const { statuses, setStatuses, postStatus, deleteStatus } = useStatuses(user.id)
  const [tab, setTab]               = useState('availability')
  const [custom, setCustom]         = useState('')
  const [selected, setSelected]     = useState('')
  const [mediaFile, setMediaFile]   = useState(null)
  const [mediaPreview, setMediaPreview] = useState(null)
  const [isVideo, setIsVideo]       = useState(false)
  const [listings, setListings]     = useState([])
  const [taggedId, setTaggedId]     = useState(null)
  const [posting, setPosting]       = useState(false)
  const [toast, setToast]           = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const fileRef = useRef()

  const content = custom.trim() || selected

  const [stories, setStories]               = useState([])
  const [viewerStories, setViewerStories]   = useState([])
  const [viewing, setViewing]               = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [sortOption, setSortOption]         = useState('Latest')
  const [searchQuery, setSearchQuery]       = useState('')
  const [followedIds, setFollowedIds]       = useState(new Set())
  const [viewedIds, setViewedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('viewedStories') || '[]')) }
    catch { return new Set() }
  })

  // Follow IDs
  useEffect(() => {
    supabase.from('seller_follows').select('seller_id').eq('follower_id', user.id)
      .then(({ data }) => setFollowedIds(new Set((data || []).map(f => f.seller_id))))
  }, [user])

  // Load stories
  useEffect(() => {
    fetchAllActiveStories(user.id, categoryFilter).then(async data => {
      const listingIds = [...new Set(data.filter(s => s.tagged_listing_id).map(s => s.tagged_listing_id))]
      if (listingIds.length > 0) {
        const { data: ls } = await supabase.from('listings').select('id, description').in('id', listingIds)
        const descMap = {}
        for (const l of (ls || [])) descMap[l.id] = l.description
        setStories(data.map(s => ({ ...s, _taggedDescription: s.tagged_listing_id ? descMap[s.tagged_listing_id] : null })))
      } else {
        setStories(data)
      }
    })
  }, [categoryFilter])

  // Realtime
  useEffect(() => {
    const ch = supabase.channel('status-page-stories')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_statuses' }, () => {
        fetchAllActiveStories(user.id, categoryFilter).then(setStories)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  // Seller listings
  useEffect(() => {
    supabase.from('listings').select('id, title, price, images')
      .eq('seller_id', user.id).eq('status', 'active').limit(20)
      .then(({ data }) => setListings(data || []))
  }, [user.id])

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

  // File handler
  function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setMediaFile(f)
    setIsVideo(f.type.startsWith('video/'))
    setMediaPreview(URL.createObjectURL(f))
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

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
          profiles:user_id ( id, full_name, avatar_url ),
          tagged:tagged_listing_id ( id, title, price, images, category, description )`)
        .eq('user_id', s.user_id).gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
      setViewerStories(data || [s])
      setViewing(0)
    }
  }

  async function handlePost() {
    if (!content && !mediaFile) return
    setPosting(true)
    let media_urls = []
    if (mediaFile) {
      const ext  = mediaFile.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('story-media').upload(path, mediaFile, { contentType: mediaFile.type })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('story-media').getPublicUrl(path)
        media_urls = [urlData.publicUrl]
      }
    }
    const expiryKey = tab === 'listing_update' &&
      (content.includes('Two people') || content.includes('first to confirm') || content.includes('Price drop'))
        ? 'listing_urgency' : tab
    const { data, error } = await postStatus({
      content: content || '(media)', status_type: tab,
      listing_id: taggedId || null, tagged_listing_id: taggedId || null, expiryKey, mediaFiles: [],
    })
    if (!error && media_urls.length && data?.id) {
      const { data: patched } = await supabase.from('user_statuses')
        .update({ media_urls }).eq('id', data.id).select().single()
      if (patched) setStatuses(prev => prev.map(s => s.id === patched.id ? patched : s))
    }
    setPosting(false)
    if (error) { showToast('❌ Failed to post'); return }
    showToast('✅ Status posted!')
    setSelected(''); setCustom(''); setMediaFile(null); setMediaPreview(null); setTaggedId(null)
    setComposerOpen(false)
  }

  // Compute metrics
  const activeCount     = stories.length
  const activeSellers   = new Set(stories.map(s => s.user_id)).size
  const productsToday   = stories.filter(s => s.status_type === 'listing_update' && new Date(s.created_at) > new Date(Date.now() - 86400000)).length
  const workToday       = stories.filter(s => s.status_type === 'work_ping' && new Date(s.created_at) > new Date(Date.now() - 86400000)).length

  // Recent statuses (list view, excluding own)
  const recentStatuses = searchedStories
    .filter(s => s.user_id !== user.id)
    .slice(0, 12)

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: "'DM Sans', system-ui, sans-serif", paddingBottom: 90 }}>

      {/* ── Sticky Header ── */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: T.surface, borderBottom: `1px solid ${T.border}`,
        padding: '0 16px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0' }}>
          <button
            onClick={() => navigate(-1)}
            style={{
              background: T.bg, border: 'none', borderRadius: '50%',
              width: 34, height: 34, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', fontSize: 15, flexShrink: 0,
              color: T.text,
            }}
          >←</button>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 17, fontWeight: 900, color: T.text, lineHeight: 1.2 }}>Status Updates</div>
            <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>Discover products, services &amp; sellers in real time</div>
          </div>
          <button
            onClick={() => setComposerOpen(true)}
            style={{
              background: `linear-gradient(135deg, ${T.green}, #22a05e)`,
              color: '#fff', border: 'none', borderRadius: 22,
              padding: '8px 14px', fontSize: 12, fontWeight: 800,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: '0 2px 12px rgba(26,122,74,0.3)', flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 14 }}>+</span> Create
          </button>
        </div>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* ── Insights Bar ── */}
        <div style={{ display: 'flex', gap: 8 }}>
          <MetricCard icon="📢" value={activeCount.toLocaleString()} label="Active Statuses" accent={T.green} />
          <MetricCard icon="🏪" value={activeSellers.toLocaleString()} label="Active Sellers" accent={T.text} />
          <MetricCard icon="🛒" value={productsToday} label="Products Today" accent={T.text} />
          <MetricCard icon="💼" value={workToday} label="Work Today" accent={T.orange} />
        </div>

        {/* ── Search + Filters ── */}
        <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`, overflow: 'hidden' }}>
          <div style={{ padding: '10px 12px 0' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: T.bg, borderRadius: 24, padding: '9px 14px',
              border: `1px solid ${T.border}`,
            }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><circle cx="6" cy="6" r="4.5" stroke={T.textMuted} strokeWidth="1.4"/><path d="M10 10l2.5 2.5" stroke={T.textMuted} strokeWidth="1.4" strokeLinecap="round"/></svg>
              <input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search statuses, sellers, products or services…"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 13, fontWeight: 500, color: T.text }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} style={{ background: T.border, border: 'none', borderRadius: '50%', width: 18, height: 18, fontSize: 10, color: T.textSub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
              )}
            </div>
          </div>

          {/* Category pills */}
          <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 12px 4px', scrollbarWidth: 'none' }}>
            {CATEGORY_TABS.map(cat => (
              <button
                key={cat.key}
                onClick={() => setCategoryFilter(cat.key)}
                style={{
                  flexShrink: 0, background: categoryFilter === cat.key ? T.green : T.bg,
                  border: `1px solid ${categoryFilter === cat.key ? T.green : T.border}`,
                  borderRadius: 20, padding: '5px 11px',
                  fontSize: 11, fontWeight: 700,
                  color: categoryFilter === cat.key ? '#fff' : T.textSub,
                  cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap',
                }}
              >
                {cat.emoji} {cat.label}
              </button>
            ))}
          </div>

          {/* Sort */}
          <div style={{ display: 'flex', gap: 6, padding: '6px 12px 10px', borderTop: `1px solid ${T.border}`, marginTop: 4 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: T.textMuted, alignSelf: 'center', flexShrink: 0 }}>Sort:</span>
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt}
                onClick={() => setSortOption(opt)}
                style={{
                  background: sortOption === opt ? T.greenLight : 'transparent',
                  border: `1px solid ${sortOption === opt ? T.green : T.border}`,
                  borderRadius: 20, padding: '4px 10px',
                  fontSize: 11, fontWeight: 700,
                  color: sortOption === opt ? T.green : T.textSub,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>

        {/* ── Stories Row ── */}
        <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`, padding: '14px 0 14px' }}>
          <div style={{ padding: '0 14px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 800, color: T.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 }}>Live Updates</span>
            <span style={{ background: T.orange, color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 20, padding: '1px 7px' }}>
              {storyGroups.length}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 9, overflowX: 'auto', padding: '0 14px 2px', scrollbarWidth: 'none' }}>
            {/* Create card */}
            <div
              onClick={() => setComposerOpen(true)}
              className="add-status-card"
              style={{ cursor: 'pointer' }}
            >
              {user.avatar_url && (
                <img src={user.avatar_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.45, borderRadius: 10 }} />
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 40%, transparent)', borderRadius: 10 }} />
              <div style={{
                position: 'absolute', top: '38%', left: '50%',
                transform: 'translate(-50%,-50%)',
                width: 34, height: 34, borderRadius: '50%',
                background: T.green, border: '2.5px solid #fff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, color: '#fff', fontWeight: 900, lineHeight: 1,
                boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              }}>+</div>
              <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 5px 8px', textAlign: 'center' }}>
                <div style={{ fontSize: 10, fontWeight: 800, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.6)' }}>Post Status</div>
              </div>
            </div>

            {storyGroups.map((s, i) => (
              <StoryCard
                key={s.user_id}
                s={s}
                index={i}
                isOwn={s.user_id === user.id}
                viewedIds={viewedIds}
                user={user}
                onClick={() => openStoryGroup(s)}
              />
            ))}

            {storyGroups.length === 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '20px 40px', color: T.textMuted, gap: 6 }}>
                <span style={{ fontSize: 24 }}>📭</span>
                <span style={{ fontSize: 12, fontWeight: 600 }}>No updates yet</span>
                <button onClick={() => setComposerOpen(true)} style={{ background: T.green, color: '#fff', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 11, fontWeight: 700, cursor: 'pointer', marginTop: 2 }}>Be the first</button>
              </div>
            )}
          </div>
        </div>

        {/* ── Sellers You Follow ── */}
        {followedGroups.length > 0 && (
          <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`, padding: '14px 14px' }}>
            <SectionHeader icon="👥" title="Sellers You Follow" count={followedGroups.length} />
            <div style={{ display: 'flex', gap: 9, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
              {followedGroups.map((group, i) => {
                const s = group[0]
                return (
                  <StoryCard
                    key={s.user_id}
                    s={{ ...s, _ownGroup: group }}
                    index={i}
                    isOwn={false}
                    viewedIds={viewedIds}
                    user={user}
                    onClick={() => openStoryGroup({ ...s, _ownGroup: group })}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* ── Near You ── */}
        {nearbyGroups.length > 0 && (
          <div style={{ background: T.surface, borderRadius: 14, border: `1px solid ${T.border}`, padding: '14px 14px' }}>
            <SectionHeader
              icon="📍"
              title="Near You"
              count={nearbyGroups.length}
              right={<span style={{ fontSize: 11, color: T.textMuted, display: 'flex', alignItems: 'center', gap: 3 }}>📍 {user.city}</span>}
            />
            <div style={{ display: 'flex', gap: 9, overflowX: 'auto', paddingBottom: 2, scrollbarWidth: 'none' }}>
              {nearbyGroups.map((group, i) => {
                const s = group[0]
                return (
                  <div
                    key={s.user_id}
                    style={{ flexShrink: 0, width: 106, height: 160, borderRadius: 12, overflow: 'hidden', position: 'relative', cursor: 'pointer',
                      background: ['linear-gradient(160deg,#1a0a00,#e65100)', 'linear-gradient(160deg,#0a1a00,#2e7d32)', 'linear-gradient(160deg,#0a0a1a,#1a3a6c)'][i % 3],
                      border: `2px solid ${T.orange}`,
                      boxShadow: '0 0 0 2px rgba(230,81,0,0.2)',
                    }}
                    onClick={() => { setViewerStories([...group, ...stories.filter(x => x.user_id !== s.user_id)]); setViewing(0) }}
                  >
                    {s.media_urls?.[0]
                      ? <img src={s.media_urls[0]} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      : s.profiles?.avatar_url
                        ? <img src={s.profiles.avatar_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.82)', transform: 'scale(1.05)' }} />
                        : null
                    }
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 35%, rgba(0,0,0,0.72) 100%)' }} />
                    <div style={{ position: 'absolute', top: 6, left: 6, width: 26, height: 26, borderRadius: '50%', border: `2px solid ${T.orange}`, overflow: 'hidden', background: `linear-gradient(135deg,${T.orange},#f9a825)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,0.4)' }}>
                      {s.profiles?.avatar_url ? <img src={s.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (s.profiles?.full_name?.[0] || 'S')}
                    </div>
                    <div style={{ position: 'absolute', top: 6, right: 6, background: 'rgba(230,81,0,0.85)', borderRadius: 10, padding: '2px 5px', fontSize: 8, fontWeight: 800, color: '#fff' }}>📍 {user.city}</div>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '5px 6px 7px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#fff', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 2, textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>{s.profiles?.full_name?.split(' ')[0]} ({group.length})</div>
                      <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.82)', fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>{s.content}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Recent Statuses (list view) ── */}
        {recentStatuses.length > 0 ? (
          <div>
            <SectionHeader icon="🕐" title="Recent Statuses" count={recentStatuses.length} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {recentStatuses.map(s => (
                <StatusListCard
                  key={s.id}
                  s={s}
                  currentUserId={user.id}
                  onOpen={async () => {
                    const { data } = await supabase.from('user_statuses')
                      .select(`id, content, status_type, expires_at, created_at, media_urls, tagged_listing_id, user_id, location_hint,
                        profiles:user_id ( id, full_name, avatar_url ),
                        tagged:tagged_listing_id ( id, title, price, images, category, description )`)
                      .eq('user_id', s.user_id).gt('expires_at', new Date().toISOString())
                      .order('created_at', { ascending: false })
                    setViewerStories(data || [s])
                    setViewing(0)
                  }}
                />
              ))}
            </div>
          </div>
        ) : (
          /* ── Empty state ── */
          <div style={{
            background: T.surface, borderRadius: 16, border: `1px solid ${T.border}`,
            padding: '40px 24px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>📭</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 6 }}>No status updates available</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 20, lineHeight: 1.5 }}>Follow sellers or create a status update to see activity here.</div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={() => navigate('/sellers')}
                style={{ background: T.greenLight, color: T.green, border: `1px solid ${T.green}`, borderRadius: 22, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}
              >Follow Sellers</button>
              <button
                onClick={() => setComposerOpen(true)}
                style={{ background: T.green, color: '#fff', border: 'none', borderRadius: 22, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 12px rgba(26,122,74,0.28)' }}
              >Create Status</button>
            </div>
          </div>
        )}
      </div>

      {/* ── Composer bottom sheet ── */}
      {composerOpen && (
        <div
          onClick={() => setComposerOpen(false)}
          style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
        />
      )}
      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1001,
        transform: composerOpen ? 'translateY(0)' : 'translateY(110%)',
        transition: 'transform 0.38s cubic-bezier(0.32, 0.72, 0, 1)',
        background: T.surface, borderRadius: '20px 20px 0 0',
        boxShadow: '0 -6px 40px rgba(0,0,0,0.18)', maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.border }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 12px', borderBottom: `1px solid ${T.bg}` }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>Post a Status</div>
          <button onClick={() => setComposerOpen(false)} style={{ background: T.bg, border: 'none', borderRadius: '50%', width: 30, height: 30, fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.textSub }}>✕</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${T.bg}` }}>
          {Object.entries(TAB_META).map(([key, meta]) => (
            <button key={key} onClick={() => { setTab(key); setSelected(''); setCustom('') }} style={{ flex: 1, padding: '12px 4px', background: tab === key ? T.surface : '#fafafa', border: 'none', borderBottom: `2.5px solid ${tab === key ? T.greenMid : 'transparent'}`, fontSize: 12, fontWeight: 700, color: tab === key ? T.greenMid : T.textMuted, cursor: 'pointer', transition: 'all 0.15s' }}>
              {meta.emoji} {meta.label}
            </button>
          ))}
        </div>

        <div style={{ padding: '16px' }}>
          {/* Media upload */}
          <div onClick={() => fileRef.current?.click()} style={{ width: '100%', height: 130, borderRadius: 12, border: `2px dashed #a5d6a7`, background: mediaPreview ? 'transparent' : T.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 12, overflow: 'hidden', position: 'relative' }}>
            {mediaPreview ? (
              isVideo ? <video src={mediaPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted /> : <img src={mediaPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 22, marginBottom: 4 }}>📷</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: T.green }}>Add photo or video</div>
                <div style={{ fontSize: 11, color: T.textMuted, marginTop: 1 }}>optional</div>
              </div>
            )}
            {mediaPreview && (
              <button onClick={e => { e.stopPropagation(); setMediaFile(null); setMediaPreview(null) }} style={{ position: 'absolute', top: 7, right: 7, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', width: 24, height: 24, borderRadius: '50%', fontSize: 12, cursor: 'pointer' }}>✕</button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFile} />

          {/* Text input */}
          <textarea
            placeholder="What do you want buyers to know?"
            value={custom}
            onChange={e => { setCustom(e.target.value); setSelected('') }}
            maxLength={160} rows={3}
            style={{ width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 13, color: T.text, background: T.bg, resize: 'none', boxSizing: 'border-box', outline: 'none', lineHeight: 1.5, marginBottom: custom ? 2 : 10 }}
          />
          {custom && <div style={{ textAlign: 'right', fontSize: 11, color: T.textMuted, marginBottom: 8 }}>{custom.length}/160</div>}

          {/* Templates */}
          <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, color: T.textMuted, textTransform: 'uppercase', marginBottom: 7 }}>Quick Templates</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
            {TEMPLATES[tab].map(t => {
              const full = `${t.emoji} ${t.text}`
              const isSel = selected === full || custom === full
              return (
                <button key={t.text} onClick={() => { setSelected(full); setCustom('') }} style={{ background: isSel ? T.greenLight : T.bg, border: `1.5px solid ${isSel ? '#a5d6a7' : T.border}`, borderRadius: 9, padding: '8px 11px', fontSize: 12, fontWeight: isSel ? 700 : 500, color: isSel ? T.greenMid : '#374151', cursor: 'pointer', textAlign: 'left', lineHeight: 1.4, transition: 'all 0.15s', display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isSel && <span style={{ color: T.green }}>✓</span>}
                  <span style={{ fontSize: 14 }}>{t.emoji}</span>
                  {t.text}
                </button>
              )
            })}
          </div>

          {/* Tag a listing */}
          {listings.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 0.8, color: T.textMuted, textTransform: 'uppercase', marginBottom: 7 }}>Tag a Product (optional)</div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none', marginBottom: 12 }}>
                {listings.map(l => (
                  <div key={l.id} onClick={() => setTaggedId(taggedId === l.id ? null : l.id)} style={{ flexShrink: 0, width: 76, cursor: 'pointer', border: `2px solid ${taggedId === l.id ? T.green : T.border}`, borderRadius: 9, overflow: 'hidden', background: taggedId === l.id ? T.greenLight : T.surface, transition: 'all 0.15s' }}>
                    <div style={{ width: '100%', height: 54, background: T.bg, overflow: 'hidden' }}>
                      {l.images?.[0] && <img src={l.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>
                    <div style={{ padding: '3px 5px' }}>
                      <div style={{ fontSize: 9, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.title}</div>
                      <div style={{ fontSize: 9, color: T.green, fontWeight: 800 }}>MK {Number(l.price).toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          <div style={{ fontSize: 11, color: T.textMuted, marginBottom: 12 }}>⏱ Expires in {EXPIRY_LABELS[tab]}</div>

          <button
            onClick={handlePost}
            disabled={(!content && !mediaFile) || posting}
            style={{
              width: '100%',
              background: (content || mediaFile) ? `linear-gradient(135deg, ${T.green}, #22a05e)` : T.border,
              color: (content || mediaFile) ? '#fff' : T.textMuted,
              border: 'none', borderRadius: 12, padding: '13px',
              fontSize: 14, fontWeight: 800,
              cursor: (content || mediaFile) ? 'pointer' : 'default',
              boxShadow: (content || mediaFile) ? '0 4px 18px rgba(26,122,74,0.28)' : 'none',
              transition: 'all 0.15s',
            }}
          >
            {posting ? 'Posting…' : '📢 Post Status'}
          </button>
        </div>
      </div>

      {/* Story viewer */}
      {viewing !== null && (
        <StoryViewer stories={viewerStories} startIndex={viewing} currentUserId={user.id} onClose={() => setViewing(null)} />
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: T.text, color: '#fff', borderRadius: 20, padding: '10px 20px', fontSize: 13, fontWeight: 700, zIndex: 9999, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}
      <style>{`
        @property --streak-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }
        @keyframes streakTravel {
          0%   { --streak-angle: 0deg; }
          100% { --streak-angle: 360deg; }
        }
        .add-status-card {
          position: relative !important;
          border-radius: 12px !important;
          padding: 2px !important;
          box-sizing: border-box !important;
          width: 106px !important;
          height: 160px !important;
          flex-shrink: 0 !important;
          overflow: hidden !important;
          background: conic-gradient(
            from var(--streak-angle),
            transparent 0deg, transparent 200deg,
            rgba(249,168,37,0.15) 220deg, rgba(249,168,37,0.4) 235deg,
            rgba(255,236,100,0.9) 248deg, #fff8e1 252deg,
            rgba(255,236,100,0.9) 256deg, rgba(249,168,37,0.4) 269deg,
            rgba(249,168,37,0.15) 284deg, transparent 300deg, transparent 360deg
          ) !important;
          animation: streakTravel 3s cubic-bezier(0.4, 0, 0.2, 1) infinite !important;
          box-shadow: 0 2px 16px rgba(0,0,0,0.3) !important;
        }
        .add-status-card::before {
          content: '';
          position: absolute;
          inset: 2px;
          border-radius: 10px;
          background: linear-gradient(160deg,#0a2e1a,#0d3b22);
          z-index: 0;
        }
        .add-status-card > *:not(img) { position: relative; z-index: 1; }
        .add-status-card img { border-radius: 10px; position: relative; z-index: 0; }
        * { -webkit-tap-highlight-color: transparent; }
        ::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  )
}