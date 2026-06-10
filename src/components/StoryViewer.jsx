import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import FollowButton from './FollowButton'

const REACTIONS = [
  { key: 'interested', emoji: '👍', label: 'Interested' },
  { key: 'love',       emoji: '❤️', label: 'Love it'    },
  { key: 'hot',        emoji: '🔥', label: 'Hot Deal'   },
]

export default function StoryViewer({ stories, startIndex, currentUserId, onClose }) {
  const [idx, setIdx]               = useState(startIndex)
  const [progress, setProgress]     = useState(0)
  const [paused, setPaused]         = useState(false)
  const [saved, setSaved]           = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [shareUrl, setShareUrl]     = useState(null)

  // Reactions
  const [myReaction, setMyReaction]         = useState(null)
  const [reactionCounts, setReactionCounts] = useState({})
  const [reacting, setReacting]             = useState(false)

  // Views
  const [viewCount, setViewCount]   = useState(0)
  const [viewers, setViewers]       = useState([])
  const [showViewers, setShowViewers] = useState(false)
  const [viewersLoading, setViewersLoading] = useState(false)
  const loggedViewsRef = useRef(new Set()) // track which status IDs we've already logged

  const timerRef  = useRef()
  const holdRef   = useRef()
  const navigate  = useNavigate()
  const DURATION  = 6000

  const [localStories, setLocalStories] = useState(stories)
  const story = localStories[idx]

  // ── Log view + load view count ─────────────────────────────────────────────
  useEffect(() => {
    if (!story?.id) return

    // Log view (once per status per session, skip own)
    if (currentUserId && story.user_id !== currentUserId && !loggedViewsRef.current.has(story.id)) {
      loggedViewsRef.current.add(story.id)
      supabase.from('status_views')
        .upsert({ status_id: story.id, viewer_id: currentUserId }, { onConflict: 'status_id,viewer_id', ignoreDuplicates: true })
    }

    // Load view count for own stories
    if (story.user_id === currentUserId) {
      supabase.from('status_views')
        .select('id', { count: 'exact', head: true })
        .eq('status_id', story.id)
        .then(({ count }) => setViewCount(count || 0))
    }
  }, [story?.id])

  // ── Load viewers list ──────────────────────────────────────────────────────
  async function loadViewers() {
    if (!story?.id) return
    setViewersLoading(true)
    const { data } = await supabase
      .from('status_views')
      .select('viewed_at, viewer:profiles!viewer_id(id, full_name, avatar_url)')
      .eq('status_id', story.id)
      .order('viewed_at', { ascending: false })
    setViewers(data || [])
    setViewersLoading(false)
  }

  function openViewers() {
    setPaused(true)
    setShowViewers(true)
    loadViewers()
  }

  function closeViewers() {
    setShowViewers(false)
    setPaused(false)
  }

  // ── Load saved status ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!story?.id || !currentUserId) return
    supabase.from('saved_statuses')
      .select('id')
      .eq('user_id', currentUserId)
      .eq('status_id', story.id)
      .maybeSingle()
      .then(({ data }) => setSaved(!!data))
  }, [story?.id])

  // ── Load reactions ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!story?.id) return
    setMyReaction(null)
    setReactionCounts({})
    supabase.from('status_reactions')
      .select('reaction, user_id')
      .eq('status_id', story.id)
      .then(({ data }) => {
        if (!data) return
        const counts = { interested: 0, love: 0, hot: 0 }
        data.forEach(r => { if (counts[r.reaction] !== undefined) counts[r.reaction]++ })
        setReactionCounts(counts)
        if (currentUserId) {
          const mine = data.find(r => r.user_id === currentUserId)
          setMyReaction(mine?.reaction || null)
        }
      })
  }, [story?.id])

  // ── React handler ──────────────────────────────────────────────────────────
  async function handleReact(key) {
    if (reacting || !currentUserId) return
    setReacting(true)
    if (myReaction === key) {
      await supabase.from('status_reactions').delete()
        .eq('status_id', story.id).eq('user_id', currentUserId)
      setMyReaction(null)
      setReactionCounts(c => ({ ...c, [key]: Math.max(0, (c[key] || 1) - 1) }))
    } else {
      if (myReaction) {
        await supabase.from('status_reactions').delete()
          .eq('status_id', story.id).eq('user_id', currentUserId)
        setReactionCounts(c => ({ ...c, [myReaction]: Math.max(0, (c[myReaction] || 1) - 1) }))
      }
      const { error } = await supabase.from('status_reactions')
        .insert({ status_id: story.id, user_id: currentUserId, reaction: key })
      if (!error) {
        setMyReaction(key)
        setReactionCounts(c => ({ ...c, [key]: (c[key] || 0) + 1 }))
      }
    }
    setReacting(false)
  }

  // ── Progress timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    setProgress(0)
    if (paused) return
    const start = Date.now()
    timerRef.current = setInterval(async () => {
      const p = Math.min(((Date.now() - start) / DURATION) * 100, 100)
      setProgress(p)
      if (p >= 100) {
        clearInterval(timerRef.current)
        const nextIdx = idx + 1
        if (nextIdx < localStories.length) {
          const nextStory = localStories[nextIdx]
          const prevStory = localStories[idx]
          if (nextStory.user_id !== prevStory.user_id) {
            const { data } = await supabase
              .from('user_statuses')
              .select(`
                id, content, status_type, expires_at, created_at,
                media_urls, tagged_listing_id, user_id, location_hint,
                profiles:user_id ( id, full_name, avatar_url ),
                tagged:tagged_listing_id ( id, title, price, images )
              `)
              .eq('user_id', nextStory.user_id)
              .gt('expires_at', new Date().toISOString())
              .order('created_at', { ascending: false })
            if (data && data.length > 1) {
              const before = localStories.slice(0, nextIdx)
              const after  = localStories.slice(nextIdx + 1)
              setLocalStories([...before, ...data, ...after])
            }
          }
          setIdx(nextIdx)
        } else onClose()
      }
    }, 50)
    return () => clearInterval(timerRef.current)
  }, [idx, paused, localStories])

  if (!story) return null

  const name    = story.profiles?.full_name || 'Seller'
  const avatar  = story.profiles?.avatar_url
  const initial = name[0].toUpperCase()
  const media   = story.media_urls || []
  const isVideo = media[0]?.match(/\.(mp4|mov|webm)$/i)
  const isOwn   = story.user_id === currentUserId

  const msLeft   = new Date(story.expires_at) - Date.now()
  const h        = Math.floor(msLeft / 3600000)
  const m        = Math.floor((msLeft % 3600000) / 60000)
  const timeLeft = h >= 1 ? `${h}h left` : `${m}m left`

  const GRADIENTS = [
    'linear-gradient(160deg,#0a2e1a,#1a7a4a)',
    'linear-gradient(160deg,#0d1b2a,#1a3a6c)',
    'linear-gradient(160deg,#1a0a0a,#7a2020)',
    'linear-gradient(160deg,#1a0a2e,#4a1a7a)',
    'linear-gradient(160deg,#0a1a2e,#1a5a6a)',
    'linear-gradient(160deg,#1a1a0a,#5a6a1a)',
  ]
  const fallbackBg = GRADIENTS[idx % GRADIENTS.length]

  function goChat()    { onClose(); navigate('/chat/' + story.user_id) }
  function handleCall(){ onClose(); navigate(`/chat/${story.user_id}`, { state: { autoCall: 'voice' } }) }

  async function handleSave() {
    if (saveLoading) return
    setSaveLoading(true)
    if (saved) {
      await supabase.from('saved_statuses').delete()
        .eq('user_id', currentUserId).eq('status_id', story.id)
      setSaved(false)
    } else {
      const { error } = await supabase.from('saved_statuses')
        .upsert({ user_id: currentUserId, status_id: story.id }, { onConflict: 'user_id,status_id', ignoreDuplicates: true })
      if (!error) setSaved(true)
    }
    setSaveLoading(false)
  }

  const shareRef   = useRef(null)
  const storyRef   = useRef(story)
  const nameRef    = useRef(name)
  storyRef.current = story
  nameRef.current  = name

  useEffect(() => {
    const btn = shareRef.current
    if (!btn) return
    async function nativeShare() {
      await new Promise(r => setTimeout(r, 100))
      const s   = storyRef.current
      const n   = nameRef.current
      const url = s?.tagged_listing_id
        ? `${window.location.origin}/listing/${s.tagged_listing_id}`
        : `${window.location.origin}/profile/${s?.user_id}`
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
      if (isMobile && navigator.share) {
        try { await navigator.share({ title: `${n} on SokoMw`, text: s?.content || '', url }) } catch(e) {}
      } else {
        setShareUrl(url)
      }
    }
    btn.addEventListener('click', nativeShare)
    return () => btn.removeEventListener('click', nativeShare)
  }, [])

  function onPointerDown() { holdRef.current = setTimeout(() => setPaused(true), 120) }
  function onPointerUp()   { clearTimeout(holdRef.current); if (!showViewers) setPaused(false) }
  function tapLeft(e)  { e.stopPropagation(); if (idx > 0) setIdx(i => i - 1); else onClose() }
  function tapRight(e) { e.stopPropagation(); if (idx < localStories.length - 1) setIdx(i => i + 1); else onClose() }

  const timeAgo = (ts) => {
    const diff = Date.now() - new Date(ts).getTime()
    const d = Math.floor(diff / 86400000), hh = Math.floor(diff / 3600000), mm = Math.floor(diff / 60000)
    return d > 0 ? `${d}d ago` : hh > 0 ? `${hh}h ago` : mm > 0 ? `${mm}m ago` : 'Just now'
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 998, background: '#000', fontFamily: "'DM Sans', system-ui, sans-serif", userSelect: 'none' }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >
      {/* Background */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {media.length > 0
          ? isVideo
            ? <video src={media[0]} autoPlay muted playsInline loop style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <img src={media[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: fallbackBg }} />
        }
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.72) 100%)' }} />
      </div>

      {/* Progress bars */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, display: 'flex', gap: 2, padding: '10px 10px 0', zIndex: 10 }}>
        {(() => {
          const uid = story.user_id
          const userStories  = localStories.filter(s => s.user_id === uid)
          const userStartIdx = localStories.findIndex(s => s.user_id === uid)
          const localIdx     = idx - userStartIdx
          return userStories.map((_, i) => (
            <div key={i} style={{ flex: 1, height: 2, borderRadius: 2, background: 'rgba(255,255,255,0.35)', overflow: 'hidden' }}>
              <div style={{ height: '100%', background: '#fff', width: i < localIdx ? '100%' : i === localIdx ? `${progress}%` : '0%', borderRadius: 2 }} />
            </div>
          ))
        })()}
      </div>

      {/* Header */}
      <div style={{ position: 'absolute', top: 18, left: 0, right: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '0 12px', zIndex: 10 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.85)', overflow: 'hidden', flexShrink: 0, background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 800, color: '#fff' }}>
          {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#fff', textShadow: '0 1px 3px rgba(0,0,0,0.4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
            {!isOwn && (
              <div onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}>
                <FollowButton currentUserId={currentUserId} sellerId={story.user_id} size="sm" />
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>{timeLeft}</div>
        </div>
        <button
          onPointerDown={e => e.stopPropagation()}
          onPointerUp={e => { e.stopPropagation(); onClose() }}
          style={{ background: 'rgba(0,0,0,0.3)', border: 'none', color: '#fff', width: 34, height: 34, borderRadius: '50%', fontSize: 18, cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >✕</button>
      </div>

      {/* Tap zones */}
      <div onPointerUp={tapLeft}  style={{ position: 'absolute', left: 0,  top: 0, bottom: 0, width: '35%', zIndex: 5 }} />
      <div onPointerUp={tapRight} style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '35%', zIndex: 5 }} />

      {/* Bottom content */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 14px 36px', zIndex: 6 }}>

        {/* Tagged product */}
        {story.tagged && (
          <div style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 14, padding: '10px 12px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            {story.tagged.images?.[0] && (
              <img src={story.tagged.images[0]} alt="" style={{ width: 46, height: 46, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>{story.tagged.title}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#4caf50' }}>MK {Number(story.tagged.price).toLocaleString()}</div>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>View ↗</div>
          </div>
        )}

        {/* Status text */}
        <div style={{ fontSize: 17, fontWeight: 600, color: '#fff', lineHeight: 1.45, marginBottom: 14, textShadow: '0 1px 8px rgba(0,0,0,0.6)' }}>
          {story.content}
        </div>

        {/* ── Reactions (viewers only) ── */}
        {!isOwn && (
          <div
            onPointerDown={e => e.stopPropagation()}
            onPointerUp={e => e.stopPropagation()}
            style={{ display: 'flex', gap: 8, marginBottom: 12 }}
          >
            {REACTIONS.map(({ key, emoji, label }) => {
              const active = myReaction === key
              const count  = reactionCounts[key] || 0
              return (
                <button key={key}
                  onClick={e => { e.stopPropagation(); handleReact(key) }}
                  disabled={reacting}
                  style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '8px 4px', background: active ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.30)', backdropFilter: 'blur(16px)', border: active ? '1.5px solid rgba(255,255,255,0.55)' : '1.5px solid rgba(255,255,255,0.15)', borderRadius: 14, cursor: reacting ? 'default' : 'pointer', transition: 'all 0.18s', transform: active ? 'scale(1.06)' : 'scale(1)' }}
                >
                  <span style={{ fontSize: 20, lineHeight: 1, filter: active ? 'drop-shadow(0 0 6px rgba(255,255,255,0.6))' : 'none' }}>{emoji}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: active ? '#fff' : 'rgba(255,255,255,0.65)', lineHeight: 1 }}>{label}</span>
                  {count > 0 && <span style={{ fontSize: 10, fontWeight: 800, color: active ? '#fff' : 'rgba(255,255,255,0.5)', lineHeight: 1 }}>{count}</span>}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Own story stats bar ── */}
        {isOwn && (
          <div
            onPointerDown={e => e.stopPropagation()}
            onPointerUp={e => e.stopPropagation()}
            style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}
          >
            {/* Views button */}
            <button
              onClick={e => { e.stopPropagation(); openViewers() }}
              style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(16px)', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 20, padding: '7px 14px', cursor: 'pointer', color: '#fff' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{viewCount} {viewCount === 1 ? 'view' : 'views'}</span>
            </button>

            {/* Reaction counts */}
            <div style={{ display: 'flex', gap: 6 }}>
              {REACTIONS.filter(r => (reactionCounts[r.key] || 0) > 0).map(({ key, emoji }) => (
                <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: '5px 10px' }}>
                  <span style={{ fontSize: 14 }}>{emoji}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{reactionCounts[key]}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick actions (viewers only) */}
        {!isOwn && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {story.tagged && (
              <button
                onPointerDown={e => e.stopPropagation()} onPointerUp={e => { e.stopPropagation(); e.preventDefault() }}
                onClick={e => { e.stopPropagation(); onClose(); navigate('/listing/' + story.tagged_listing_id) }}
                style={{ width: '100%', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', border: 'none', borderRadius: 50, padding: '13px 20px', fontSize: 14, fontWeight: 800, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 20px rgba(26,122,74,0.4)' }}
              >🛒 View Product</button>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button onPointerDown={e => e.stopPropagation()} onPointerUp={e => { e.stopPropagation(); e.preventDefault() }} onClick={e => { e.stopPropagation(); goChat() }} style={{ flex: 1, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(20px)', border: '1.5px solid rgba(255,255,255,0.25)', borderRadius: 50, padding: '11px 8px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                Chat
              </button>
              <button onPointerDown={e => e.stopPropagation()} onPointerUp={e => { e.stopPropagation(); e.preventDefault() }} onClick={e => { e.stopPropagation(); handleCall() }} style={{ flex: 1, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(20px)', border: '1.5px solid rgba(255,255,255,0.25)', borderRadius: 50, padding: '11px 8px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                Call
              </button>
              <button onPointerDown={e => e.stopPropagation()} onPointerUp={e => { e.stopPropagation(); e.preventDefault() }} onClick={e => { e.stopPropagation(); handleSave() }} style={{ flex: 1, background: saved ? 'rgba(239,68,68,0.3)' : 'rgba(0,0,0,0.35)', backdropFilter: 'blur(20px)', border: `1.5px solid ${saved ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.25)'}`, borderRadius: 50, padding: '11px 8px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, transition: 'all 0.2s' }}>
                {saved ? '❤️' : '🤍'} {saveLoading ? '...' : 'Save'}
              </button>
              <button ref={shareRef} onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()} style={{ flex: 1, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(20px)', border: '1.5px solid rgba(255,255,255,0.25)', borderRadius: 50, padding: '11px 8px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                🔗 Share
              </button>
            </div>
          </div>
        )}

        {/* Own story label */}
        {isOwn && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Your status · {timeLeft}
          </div>
        )}
      </div>

      {/* Share link popup */}
      {shareUrl && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} onClick={() => setShareUrl(null)}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 480, background: '#1a1a2e', borderRadius: '20px 20px 0 0', padding: '20px 16px 36px' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.5)', marginBottom: 10 }}>🔗 Share this status</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: '10px 14px', border: '1px solid rgba(255,255,255,0.15)' }}>
              <div style={{ flex: 1, fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shareUrl}</div>
              <button
                onClick={() => {
                  navigator.clipboard?.writeText(shareUrl)
                    .then(() => { setShareUrl(null); alert('✅ Link copied!') })
                    .catch(() => {
                      const el = document.createElement('textarea')
                      el.value = shareUrl; document.body.appendChild(el); el.select()
                      document.execCommand('copy'); document.body.removeChild(el)
                      setShareUrl(null); alert('✅ Link copied!')
                    })
                }}
                style={{ background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer', flexShrink: 0 }}
              >Copy</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Viewers Sheet ── */}
      {showViewers && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
          onClick={closeViewers}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{ width: '100%', maxWidth: 480, background: '#111', borderRadius: '24px 24px 0 0', padding: '0 0 36px', maxHeight: '70vh', display: 'flex', flexDirection: 'column' }}
          >
            {/* Sheet header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 16px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                <span style={{ fontSize: 15, fontWeight: 800, color: '#fff' }}>
                  {viewCount} {viewCount === 1 ? 'View' : 'Views'}
                </span>
              </div>
              <button onClick={closeViewers} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 30, height: 30, borderRadius: '50%', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>

            {/* Viewers list */}
            <div style={{ overflowY: 'auto', flex: 1 }}>
              {viewersLoading ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Loading…</div>
              ) : viewers.length === 0 ? (
                <div style={{ padding: 40, textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>👁</div>
                  <div style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,0.6)' }}>No views yet</div>
                  <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4 }}>Share your status to get more reach</div>
                </div>
              ) : viewers.map((v, i) => {
                const vname    = v.viewer?.full_name || 'Unknown'
                const vavatar  = v.viewer?.avatar_url
                const vinitials = vname.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
                return (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ width: 40, height: 40, borderRadius: '50%', flexShrink: 0, overflow: 'hidden', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                      {vavatar ? <img src={vavatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : vinitials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vname}</div>
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>👁 {timeAgo(v.viewed_at)}</div>
                    </div>
                    <button
                      onClick={() => { closeViewers(); onClose(); navigate('/chat/' + v.viewer?.id) }}
                      style={{ background: 'rgba(26,122,74,0.3)', border: '1px solid rgba(26,122,74,0.5)', borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 700, color: '#4caf50', cursor: 'pointer', whiteSpace: 'nowrap' }}
                    >
                      Chat
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}