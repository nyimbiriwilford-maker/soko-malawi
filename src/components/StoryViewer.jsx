import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function StoryViewer({ stories, startIndex, currentUserId, onClose }) {
  const [idx, setIdx]           = useState(startIndex)
  const [progress, setProgress] = useState(0)
  const [paused, setPaused]     = useState(false)
  const [saved, setSaved]           = useState(false)
  const [saveLoading, setSaveLoading] = useState(false)
  const [sharing, setSharing]       = useState(false)
  const timerRef                = useRef()
  const holdRef                 = useRef()
  const navigate                = useNavigate()
  const DURATION                = 6000

  const [localStories, setLocalStories] = useState(stories)
  const story = localStories[idx]

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
          // If advancing to a new user, fetch all their statuses
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
              const after = localStories.slice(nextIdx + 1)
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

  function goChat() {
    onClose()
    navigate('/chat/' + story.user_id)
  }

  async function handleSave() {
    if (saveLoading) return
    setSaveLoading(true)
    if (saved) {
      await supabase.from('saved_statuses')
        .delete()
        .eq('user_id', currentUserId)
        .eq('status_id', story.id)
      setSaved(false)
    } else {
      await supabase.from('saved_statuses')
        .insert({ user_id: currentUserId, status_id: story.id })
      setSaved(true)
    }
    setSaveLoading(false)
  }

  const shareRef = useRef(null)
  const storyRef = useRef(story)
  const nameRef  = useRef(name)
  storyRef.current = story
  nameRef.current  = name

  useEffect(() => {
    const btn = shareRef.current
    if (!btn) return
    async function nativeShare() {
      setSharing(true)
      await new Promise(r => setTimeout(r, 100))
      const s   = storyRef.current
      const n   = nameRef.current
      const url = s?.tagged_listing_id
        ? `${window.location.origin}/listing/${s.tagged_listing_id}`
        : window.location.origin
      if (navigator.share) {
        try { await navigator.share({ title: `${n} on SokoMw`, text: s?.content || '', url }) } catch(e) {}
        setSharing(false)
      } else {
        // Fallback: copy to clipboard or show the link
        const fallback = () => {
          const el = document.createElement('textarea')
          el.value = url
          document.body.appendChild(el)
          el.select()
          document.execCommand('copy')
          document.body.removeChild(el)
          alert('✅ Link copied!')
        }
        if (navigator.clipboard) {
          navigator.clipboard.writeText(url)
            .then(() => alert('✅ Link copied!'))
            .catch(fallback)
        } else {
          fallback()
        }
        setSharing(false)
      }
    }
    btn.addEventListener('click', nativeShare)
    return () => btn.removeEventListener('click', nativeShare)
  }, [])

  function handleCall() {
    onClose()
    navigate(`/chat/${story.user_id}`, { state: { autoCall: 'voice' } })
  }

  function onPointerDown(e) {
    holdRef.current = setTimeout(() => setPaused(true), 120)
  }

  function onPointerUp(e) {
    clearTimeout(holdRef.current)
    setPaused(false)
  }

  function stopAndRun(fn) {
    clearTimeout(holdRef.current)
    return fn()
  }

  function tapLeft(e) {
    e.stopPropagation()
    if (idx > 0) setIdx(i => i - 1)
    else onClose()
  }

  function tapRight(e) {
    e.stopPropagation()
    if (idx < localStories.length - 1) setIdx(i => i + 1)
    else onClose()
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 998,
      visibility: sharing ? 'hidden' : 'visible',
        background: '#000',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        userSelect: 'none',
      }}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
    >

      {/* ── Background ── */}
      <div style={{ position: 'absolute', inset: 0 }}>
        {media.length > 0
          ? isVideo
            ? <video src={media[0]} autoPlay muted playsInline loop
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : <img src={media[0]} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <div style={{ width: '100%', height: '100%', background: fallbackBg }} />
        }
        {/* Top fade for header legibility */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, transparent 25%, transparent 55%, rgba(0,0,0,0.72) 100%)',
        }} />
      </div>

      {/* ── Progress bars ── */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0,
        display: 'flex', gap: 2, padding: '10px 10px 0',
        zIndex: 10,
      }}>
        {(() => {
          const currentUserId = story.user_id
          const userStories = localStories.filter(s => s.user_id === currentUserId)
          const userStartIdx = localStories.findIndex(s => s.user_id === currentUserId)
          const localIdx = idx - userStartIdx
          return userStories.map((_, i) => (
            <div key={i} style={{
              flex: 1, height: 2, borderRadius: 2,
              background: 'rgba(255,255,255,0.35)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                background: '#fff',
                width: i < localIdx ? '100%' : i === localIdx ? `${progress}%` : '0%',
                borderRadius: 2,
                transition: i === localIdx ? 'none' : undefined,
              }} />
            </div>
          ))
        })()}
      </div>

      {/* ── Header ── */}
      <div style={{
        position: 'absolute', top: 18, left: 0, right: 0,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '0 12px', zIndex: 10,
      }}>
        {/* Avatar */}
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          border: '2px solid rgba(255,255,255,0.85)',
          overflow: 'hidden', flexShrink: 0,
          background: 'linear-gradient(135deg,#1a7a4a,#22a05e)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 15, fontWeight: 800, color: '#fff',
        }}>
          {avatar
            ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initial}
        </div>

        {/* Name + time */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 14, fontWeight: 700, color: '#fff',
            textShadow: '0 1px 3px rgba(0,0,0,0.4)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{name}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>
            {timeLeft}
          </div>
        </div>

        {/* Close */}
        <button
          onPointerDown={e => e.stopPropagation()}
          onPointerUp={e => { e.stopPropagation(); onClose() }}
          style={{
            background: 'rgba(0,0,0,0.3)', border: 'none',
            color: '#fff', width: 34, height: 34, borderRadius: '50%',
            fontSize: 18, cursor: 'pointer', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
        >✕</button>
      </div>

      {/* ── Tap zones ── */}
      <div onPointerUp={tapLeft}
        style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '35%', zIndex: 5 }} />
      <div onPointerUp={tapRight}
        style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '35%', zIndex: 5 }} />

      {/* ── Bottom content ── */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        padding: '0 14px 36px', zIndex: 6,
      }}>

        {/* Tagged product */}
        {story.tagged && (
          <div style={{
            background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 14, padding: '10px 12px', marginBottom: 12,
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {story.tagged.images?.[0] && (
              <img src={story.tagged.images[0]} alt=""
                style={{ width: 46, height: 46, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.85)',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                {story.tagged.title}
              </div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#4caf50' }}>
                MK {Number(story.tagged.price).toLocaleString()}
              </div>
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', flexShrink: 0 }}>
              View ↗
            </div>
          </div>
        )}

        {/* Status text */}
        <div style={{
          fontSize: 17, fontWeight: 600, color: '#fff',
          lineHeight: 1.45, marginBottom: 16,
          textShadow: '0 1px 8px rgba(0,0,0,0.6)',
        }}>
          {story.content}
        </div>

        {/* Quick Actions */}
        {!isOwn && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

            {/* Product action row — only if tagged */}
            {story.tagged && (
              <button
                onPointerDown={e => e.stopPropagation()}
                onPointerUp={e => { e.stopPropagation(); e.preventDefault() }}
                onClick={e => { e.stopPropagation(); onClose(); navigate('/listing/' + story.tagged_listing_id) }}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg,#1a7a4a,#22a05e)',
                  border: 'none', borderRadius: 50, padding: '13px 20px',
                  fontSize: 14, fontWeight: 800, color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: '0 4px 20px rgba(26,122,74,0.4)',
                }}
              >
                🛒 View Product
              </button>
            )}

            {/* Action pills row */}
            <div style={{ display: 'flex', gap: 8 }}>

              {/* Chat */}
              <button
                onPointerDown={e => e.stopPropagation()}
                onPointerUp={e => { e.stopPropagation(); e.preventDefault() }}
                onClick={e => { e.stopPropagation(); goChat() }}
                style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(20px)',
                  border: '1.5px solid rgba(255,255,255,0.25)',
                  borderRadius: 50, padding: '11px 8px',
                  fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                </svg>
                Chat
              </button>

              {/* Call */}
              <button
                onPointerDown={e => e.stopPropagation()}
                onPointerUp={e => { e.stopPropagation(); e.preventDefault() }}
                onClick={e => { e.stopPropagation(); handleCall() }}
                style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(20px)',
                  border: '1.5px solid rgba(255,255,255,0.25)',
                  borderRadius: 50, padding: '11px 8px',
                  fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                Call
              </button>

              {/* Save */}
              <button
                onPointerDown={e => e.stopPropagation()}
                onPointerUp={e => { e.stopPropagation(); e.preventDefault() }}
                onClick={e => { e.stopPropagation(); handleSave() }}
                style={{
                  flex: 1,
                  background: saved ? 'rgba(239,68,68,0.3)' : 'rgba(0,0,0,0.35)',
                  backdropFilter: 'blur(20px)',
                  border: `1.5px solid ${saved ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.25)'}`,
                  borderRadius: 50, padding: '11px 8px',
                  fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                  transition: 'all 0.2s',
                }}
              >
                {saved ? '❤️' : '🤍'} {saveLoading ? '...' : 'Save'}
              </button>

              {/* Share */}
              <button
                ref={shareRef}
                onPointerDown={e => e.stopPropagation()}
                onPointerUp={e => e.stopPropagation()}
                style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(20px)',
                  border: '1.5px solid rgba(255,255,255,0.25)',
                  borderRadius: 50, padding: '11px 8px',
                  fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}
              >
                🔗 Share
              </button>

            </div>
          </div>
        )}

        {/* Own story label */}
        {isOwn && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            color: 'rgba(255,255,255,0.55)', fontSize: 12, fontWeight: 600,
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
            Your status · {timeLeft}
          </div>
        )}
      </div>
    </div>
  )
}