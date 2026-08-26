import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { fetchAllActiveStories } from '../hooks/useStatuses'
import StoryViewer from '../components/StoryViewer'
import StatusUploadModal from '../components/StatusUploadModal'
import { isStatusVideoUrl, isStatusColorBoard } from '../utils/statusVideo'
import StatusTextBoard from '../components/StatusTextBoard'
import StatusCommentsPanel from '../components/StatusComments'
import { useStatusComments } from '../hooks/useStatusComments'
import { formatPrice } from '../lib/format'
import SokoNav from '../components/SokoNav'
import { AnimatePresence, motion } from 'framer-motion'
import { Heart, MessageCircle, Share2, MapPin } from 'lucide-react'

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
  if (h < 1) return '<1h left'
  if (h < 24) return `${Math.ceil(h)}h left`
  return `${Math.ceil(h / 24)}d left`
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

    const [reactRes, replyRes, commentRes, viewRes] = await Promise.all([
      supabase.from('status_reactions').select('status_id, user_id, reaction').in('status_id', ids),
      Promise.all(ids.map(id => supabase.from('status_replies').select('id', { count: 'exact', head: true }).eq('status_id', id))),
      Promise.all(ids.map(id => supabase.from('status_comments').select('id', { count: 'exact', head: true }).eq('status_id', id))),
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
    replyRes.forEach((res, i) => { if (map[ids[i]] && res.count != null) map[ids[i]].replies += res.count })
    commentRes.forEach((res, i) => { if (map[ids[i]] && res.count != null) map[ids[i]].replies += res.count })
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
  const navigate = useNavigate()
  const name       = s.profiles?.full_name || 'Seller'
  const avatar     = s.profiles?.avatar_url
  const initial    = name[0]?.toUpperCase() || 'S'
  const isVerified = s.profiles?.is_verified || false
  const media      = s.media_urls?.[0]
  const isVideo    = media && isStatusVideoUrl(media)
  const boardColor = isStatusColorBoard(media) ? media : null
  const ago        = timeAgo(s.created_at)
  const expires    = expiresInLabel(s.expires_at)
  const rawContent = (s.content || '').trim()
  // Badge: only tagged statuses get one — labelled by the kind of tagged
  // entity: Product / Service / Job / Looking for / Shop.
  const badgeLabel = s.tagged || s.tagged_listing_id || s.tagged_ref_id
    ? ({
      listing: 'Product',
      service: 'Service',
      job: 'Job',
      request: 'Looking for',
      shop: 'Shop',
    })[s.tagged_kind] || 'Product'
    : null
  const m = metrics[s.id] || { views: 0, likes: 0, myLike: null, replies: 0 }

  const [copied, setCopied] = useState(false)
  const [commentFeedback, setCommentFeedback] = useState('')
  const feedbackRef = useRef()

  // Caption under the media — only real captions written for a photo/video
  // (never the auto "Photo/Video/Status update" placeholders or text boards).
  const captionText = rawContent
  const showCaption = !!media && !boardColor && !!captionText
    && !/^(photo|video|status) update$/i.test(captionText)
  const captionRef = useRef(null)
  const [captionClamped, setCaptionClamped] = useState(false)
  const [captionExpanded, setCaptionExpanded] = useState(false)
  useEffect(() => {
    const el = captionRef.current
    if (el) setCaptionClamped(el.scrollHeight > el.clientHeight + 2)
    else setCaptionClamped(false)
  }, [captionText, showCaption])

  const replies = useStatusComments({
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
                {badgeLabel && <span className="st-feed-kind">{badgeLabel}</span>}
              </div>
              <div className="st-feed-meta">
                <span className="st-feed-meta-item">{ago} ago</span>
                {s.location_hint && (
                  <span className="st-feed-meta-item">
                    <MapPin size={11} /> {s.location_hint}
                  </span>
                )}
                <span className="st-feed-meta-item">{fmtCount(m.views)} views</span>
                {expires && (
                  <span className={`st-feed-meta-item${expires === 'Expired' ? ' is-expired' : ' is-expire'}`}>
                    {expires}
                  </span>
                )}
              </div>
            </div>
          </button>
        </div>

        {media && (
          <button type="button" className="st-feed-media" onClick={onOpen} aria-label="Open status">
            {isVideo
              ? <video src={media} muted playsInline preload="metadata" />
              : boardColor
                ? <StatusTextBoard color={boardColor} text={s.content} sizeScale={1.5} />
                : <img src={media} alt="" loading="lazy" />
            }
            {isVideo && <span className="st-feed-play" aria-hidden>▶</span>}

            {s.tagged && (
              <span
                className="st-feed-media-tag"
                onClick={e => {
                  e.stopPropagation()
                  const id = s.tagged?.id || s.tagged_listing_id
                  if (id) navigate(`/listing/${id}`)
                }}
                role="link"
                aria-label={`View product: ${s.tagged.title}`}
              >
                {s.tagged.images?.[0]
                  ? <img src={s.tagged.images[0]} alt="" loading="lazy" />
                  : <span className="st-feed-media-tag-ph">📦</span>
                }
                <span className="st-feed-media-tag-copy">
                  <strong>{s.tagged.title}</strong>
                  {s.tagged.price != null && <em>{formatPrice(s.tagged.price)}</em>}
                </span>
                <span className="st-feed-media-tag-cta">View</span>
              </span>
            )}

            <div className="st-feed-media-fade" aria-hidden />
          </button>
        )}

        {showCaption && (
          <div className="st-feed-caption-wrap">
            <p
              ref={captionRef}
              className={`st-feed-caption${captionExpanded ? ' is-open' : ''}`}
            >
              {captionText}
            </p>
            {captionClamped && (
              <button
                type="button"
                className="st-feed-caption-toggle"
                onClick={() => setCaptionExpanded(v => !v)}
              >
                {captionExpanded ? 'Show less' : 'View all'}
              </button>
            )}
          </div>
        )}

        {!media && s.tagged && (
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

        <div className="st-feed-eng">
          <motion.button
            type="button"
            whileTap={{ scale: 1.28 }}
            className={`st-feed-eng-btn${m.myLike ? ' is-liked' : ''}`}
            onClick={() => onLike(s.id)}
            aria-pressed={!!m.myLike}
            aria-label={m.myLike ? 'Unlike' : 'Like'}
          >
            <Heart size={17} fill={m.myLike ? '#ea4335' : 'none'} strokeWidth={2.2} />
            <span>{m.likes > 0 ? fmtCount(m.likes) : (m.myLike ? 'Liked' : 'Like')}</span>
          </motion.button>

          <motion.button
            type="button"
            whileTap={{ scale: 1.28 }}
            className={`st-feed-eng-btn${replies.open ? ' is-active' : ''}`}
            onClick={() => replies.open ? replies.closeComments() : replies.openComments()}
            aria-expanded={replies.open}
            aria-label="Comments"
          >
            <MessageCircle size={17} />
            <span>{m.replies > 0 ? fmtCount(m.replies) : 'Comment'}</span>
          </motion.button>

          <motion.button type="button" whileTap={{ scale: 1.28 }} className="st-feed-eng-btn" onClick={handleShare} aria-label="Share">
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
                  <div className={`st-feed-comments-feedback${commentFeedback.startsWith('Could not') ? ' is-error' : ''}`}>
                    {commentFeedback}
                  </div>
                )}
                <StatusCommentsPanel
                  api={replies}
                  story={s}
                  currentUserId={currentUserId}
                />
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
  const openedStatusRef = useRef(null)
  const autoOpenedRef = useRef(false)

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
    return fetchAllActiveStories(user.id, 'All').then(async data => {
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

  // Notif badge
  useEffect(() => {
    supabase.from('notifications').select('*', { count: 'exact', head: true })
      .eq('user_id', user.id).eq('read', false)
      .then(({ count }) => setNotifCount(count || 0))
      .catch(() => {})
  }, [user])

  // Load stories
  useEffect(() => {
    reloadStories()
  }, [user.id])

  // Auto-open a specific status when navigated from a chat status reply or a
  // shared comment link. Supports /status/:statusId, /status?status=<id>,
  // and /status?comment=<commentId> (resolves the comment's parent status).
  useEffect(() => {
    const commentParam = searchParams.get('comment')
    const rawTarget = statusIdParam || searchParams.get('status')
    let targetId = rawTarget
    let cancelled = false

    function run() {
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

      const inFeed = stories.find(s => s.id === targetId)
      if (inFeed) {
        openStatus(inFeed, stories)
        return
      }

      if (!storiesLoaded) return

      ;(async () => {
        const { data: row } = await supabase
          .from('user_statuses')
          .select(STATUS_SELECT)
          .eq('id', targetId)
          .maybeSingle()

        if (cancelled || !row || openedStatusRef.current === targetId) return

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
        for (const s of group) {
          if (Array.isArray(s.profiles)) s.profiles = s.profiles[0] || null
        }
        const startIdx = Math.max(0, group.findIndex(x => x.id === targetId))
        setViewerStories(group)
        setViewing(startIdx)
        openedStatusRef.current = targetId
      })()
    }

    if (!rawTarget && commentParam) {
      supabase.from('status_comments').select('status_id').eq('id', commentParam).maybeSingle()
        .then(({ data }) => {
          if (cancelled) return
          targetId = data?.status_id || null
          run()
        })
    } else {
      run()
    }

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
  }, [user.id])

  // Recent statuses (list view, excluding own)
  const recentStatuses = stories
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

      <div className="st-main" style={{
        maxWidth: 1400, margin: '0 auto',
        padding: '18px 20px 28px',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>

        {/* ── Status feed ── */}
        {storiesError && stories.length === 0 ? (
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
        ) : stories.length === 0 ? (
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
        .st-feed-body {
          --st-pad: 14px;
          padding: var(--st-pad);
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
        .st-feed-name-row { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .st-feed-name {
          font-size: 13.5px; font-weight: 800; color: ${T.text};
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .st-feed-kind {
          flex-shrink: 0;
          font-size: 9px; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase;
          color: ${T.greenMid}; background: ${T.greenLight};
          border: 1px solid rgba(15,157,88,0.16);
          border-radius: 999px; padding: 3px 8px; line-height: 1; white-space: nowrap;
        }
        .st-feed-meta {
          display: flex; align-items: center; gap: 10px; flex-wrap: nowrap; overflow: hidden;
          margin-top: 4px; font-size: 11px; color: ${T.textMuted}; font-weight: 600;
        }
        .st-feed-meta-item {
          display: inline-flex; align-items: center; gap: 3.5px;
          white-space: nowrap; color: ${T.textMuted};
          max-width: 130px; overflow: hidden; text-overflow: ellipsis;
        }
        .st-feed-meta-item svg { flex-shrink: 0; opacity: 0.9; }
        .st-feed-meta-item.is-expire { color: #b45309; }
        .st-feed-meta-item.is-expired { color: #b91c1c; }
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
          width: calc(100% + 2 * var(--st-pad, 14px));
          margin: 0 calc(-1 * var(--st-pad, 14px));
          aspect-ratio: 4 / 5;
          border-radius: 0;
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
        /* Tagged product — transparent glass pill anchored on the media */
        .st-feed-media-tag {
          position: absolute; left: 10px; bottom: 10px; z-index: 3;
          display: inline-flex; align-items: center; gap: 8px;
          max-width: calc(100% - 20px);
          padding: 4px 11px 4px 4px;
          background: rgba(0,0,0,0.38);
          backdrop-filter: blur(10px); -webkit-backdrop-filter: blur(10px);
          border: 1px solid rgba(255,255,255,0.22);
          border-radius: 999px;
          box-shadow: 0 2px 12px rgba(0,0,0,0.28);
          cursor: pointer;
          transition: background 0.15s ease, transform 0.12s ease;
        }
        .st-feed-media-tag:hover { background: rgba(0,0,0,0.55); }
        .st-feed-media-tag:active { transform: scale(0.96); }
        .st-feed-media-tag > img,
        .st-feed-media-tag-ph {
          width: 30px; height: 30px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
          border: 1px solid rgba(255,255,255,0.35);
        }
        .st-feed-media-tag-ph {
          background: rgba(255,255,255,0.9); display: grid; place-items: center; font-size: 13px;
        }
        .st-feed-media-tag-copy { min-width: 0; display: flex; flex-direction: column; gap: 0; line-height: 1.25; }
        .st-feed-media-tag-copy strong {
          font-size: 12px; font-weight: 700; color: #fff;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 140px;
          text-shadow: 0 1px 3px rgba(0,0,0,0.5);
        }
        .st-feed-media-tag-copy em {
          font-style: normal; font-size: 11.5px; font-weight: 800; color: ${T.orange};
          text-shadow: 0 1px 3px rgba(0,0,0,0.5);
        }
        .st-feed-media-tag-cta {
          flex-shrink: 0;
          font-size: 10.5px; font-weight: 800; color: #fff;
          background: ${T.green}; border-radius: 999px; padding: 5px 10px;
        }
        .st-feed-caption-wrap { display: flex; flex-direction: column; gap: 3px; }
        .st-feed-caption {
          margin: 0;
          font-size: 13.5px; line-height: 1.45; color: ${T.text}; font-weight: 600;
          letter-spacing: -0.01em; word-break: break-word;
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .st-feed-caption.is-open { display: block; -webkit-line-clamp: unset; overflow: visible; }
        .st-feed-caption-toggle {
          align-self: flex-start;
          border: none; background: none; padding: 0;
          font-family: inherit; font-size: 12px; font-weight: 800;
          color: ${T.green}; cursor: pointer;
        }
        .st-feed-caption-toggle:hover { text-decoration: underline; }
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
        .st-feed-eng {
          display: flex; align-items: stretch;
          border-top: 1px solid ${T.border};
          margin-top: 2px;
        }
        .st-feed-eng-btn {
          flex: 1;
          display: flex; align-items: center; justify-content: center; gap: 7px;
          border: none; background: none; padding: 11px 6px;
          font-family: inherit; font-size: 12.5px; font-weight: 700; color: ${T.textSub};
          cursor: pointer; border-radius: 10px; min-height: 44px;
          transition: color 0.15s, background 0.15s;
        }
        .st-feed-eng-btn span { font-variant-numeric: tabular-nums; font-weight: 800; }
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
        .st-feed-skel-media { width: 100%; aspect-ratio: 4 / 5; border-radius: 0; flex-shrink: 0; }
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
          .st-main {
            padding: 12px 14px 24px !important;
            gap: 12px !important;
          }
          .st-feed-grid { gap: 10px; }
          .st-feed-meta { gap: 8px; }
          .st-feed-meta-item { max-width: 104px; }
        }
        @media (max-width: 420px) {
          .st-feed-body { --st-pad: 12px; gap: 9px; }
        }
      `}</style>
    </div>
  )
}