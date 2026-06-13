import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import FollowButton from './FollowButton'

const REACTIONS = [
  { key: 'love',       emoji: '❤️', label: 'Love'      },
  { key: 'hot',        emoji: '🔥', label: 'Fire'      },
  { key: 'interested', emoji: '👍', label: 'Like'      },
]

const TYPE_META = {
  listing_update: { label: '📦 Update',    grad: 'linear-gradient(135deg,#3b82f6,#1d4ed8)' },
  price_drop:     { label: '💸 Price Drop',grad: 'linear-gradient(135deg,#10b981,#065f46)' },
  promotion:      { label: '🎯 Promo',     grad: 'linear-gradient(135deg,#f59e0b,#b45309)' },
  new_product:    { label: '✨ New',        grad: 'linear-gradient(135deg,#8b5cf6,#4c1d95)' },
  job_post:       { label: '💼 Job',        grad: 'linear-gradient(135deg,#06b6d4,#0e7490)' },
  service_update: { label: '⚡ Service',    grad: 'linear-gradient(135deg,#ec4899,#9d174d)' },
  event:          { label: '🎉 Event',      grad: 'linear-gradient(135deg,#f97316,#c2410c)' },
  availability:   { label: '🟢 Available',  grad: 'linear-gradient(135deg,#22c55e,#15803d)' },
}

function fmtK(n) { return n >= 1000 ? `${(n/1000).toFixed(1)}K` : String(n||0) }

function timeAgoFn(ts) {
  const diff = Date.now() - new Date(ts).getTime()
  const d=Math.floor(diff/86400000),h=Math.floor(diff/3600000),m=Math.floor(diff/60000)
  return d>0?`${d}d ago`:h>0?`${h}h ago`:m>0?`${m}m ago`:'Just now'
}

const GRADIENTS = [
  'linear-gradient(160deg,#0a2e1a 0%,#1a7a4a 100%)',
  'linear-gradient(160deg,#0d1b2a 0%,#1a3a6c 100%)',
  'linear-gradient(160deg,#1a0a2e 0%,#4a1a7a 100%)',
  'linear-gradient(160deg,#1a0a0a 0%,#7a2020 100%)',
  'linear-gradient(160deg,#0a1a2e 0%,#1a5a6a 100%)',
  'linear-gradient(160deg,#1a1a0a 0%,#5a6a1a 100%)',
]

export default function StoryViewer({ stories, startIndex, currentUserId, onClose }) {
  const [idx, setIdx]                   = useState(startIndex)
  const [progress, setProgress]         = useState(0)
  const [paused, setPaused]             = useState(false)
  const [saved, setSaved]               = useState(false)
  const [saveLoading, setSaveLoading]   = useState(false)
  const [shareUrl, setShareUrl]         = useState(null)
  const [replyText, setReplyText]       = useState('')
  const [replySending, setReplySending] = useState(false)
  const [imgLoaded, setImgLoaded]       = useState(false)
  const [reactionBurst, setReactionBurst] = useState(null)

  const [myReaction, setMyReaction]         = useState(null)
  const [reactionCounts, setReactionCounts] = useState({})
  const [reacting, setReacting]             = useState(false)

  const [viewCount, setViewCount]         = useState(0)
  const [viewers, setViewers]             = useState([])
  const [showViewers, setShowViewers]     = useState(false)
  const [viewersLoading, setViewersLoading] = useState(false)
  const [viewerSearch, setViewerSearch]   = useState('')
  const loggedViewsRef = useRef(new Set())

  const timerRef   = useRef()
  const holdRef    = useRef()
  const navigate   = useNavigate()
  const DURATION   = 6000

  const [localStories, setLocalStories] = useState(stories)
  const story = localStories[idx]

  // ── view tracking ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!story?.id) return
    setImgLoaded(false)
    if (currentUserId && story.user_id !== currentUserId && !loggedViewsRef.current.has(story.id)) {
      loggedViewsRef.current.add(story.id)
      supabase.from('status_views')
        .upsert({ status_id: story.id, viewer_id: currentUserId }, { onConflict: 'status_id,viewer_id', ignoreDuplicates: true })
    }
    if (story.user_id === currentUserId) {
      supabase.from('status_views')
        .select('id', { count: 'exact', head: true })
        .eq('status_id', story.id)
        .then(({ count }) => setViewCount(count || 0))
    }
  }, [story?.id])

  // ── viewers list ───────────────────────────────────────────────────────────
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
  function openViewers()  { setPaused(true); setShowViewers(true); loadViewers() }
  function closeViewers() { setShowViewers(false); setPaused(false) }

  // ── saved ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!story?.id || !currentUserId) return
    supabase.from('saved_statuses')
      .select('id').eq('user_id', currentUserId).eq('status_id', story.id).maybeSingle()
      .then(({ data }) => setSaved(!!data))
  }, [story?.id])

  // ── reactions ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!story?.id) return
    setMyReaction(null); setReactionCounts({})
    supabase.from('status_reactions').select('reaction, user_id').eq('status_id', story.id)
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

  async function handleReact(key) {
    if (reacting || !currentUserId) return
    setReacting(true)
    // burst animation
    setReactionBurst(key)
    setTimeout(() => setReactionBurst(null), 700)

    if (myReaction === key) {
      await supabase.from('status_reactions').delete().eq('status_id', story.id).eq('user_id', currentUserId)
      setMyReaction(null)
      setReactionCounts(c => ({ ...c, [key]: Math.max(0,(c[key]||1)-1) }))
    } else {
      if (myReaction) {
        await supabase.from('status_reactions').delete().eq('status_id', story.id).eq('user_id', currentUserId)
        setReactionCounts(c => ({ ...c, [myReaction]: Math.max(0,(c[myReaction]||1)-1) }))
      }
      const { error } = await supabase.from('status_reactions')
        .insert({ status_id: story.id, user_id: currentUserId, reaction: key })
      if (!error) {
        setMyReaction(key)
        setReactionCounts(c => ({ ...c, [key]: (c[key]||0)+1 }))
      }
    }
    setReacting(false)
  }

  // ── progress timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    setProgress(0)
    if (paused) return
    const start = Date.now()
    timerRef.current = setInterval(async () => {
      const p = Math.min(((Date.now()-start)/DURATION)*100, 100)
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
              .select(`id, content, status_type, expires_at, created_at, media_urls, tagged_listing_id, user_id, location_hint,
                profiles:user_id ( id, full_name, avatar_url ),
                tagged:tagged_listing_id ( id, title, price, images )`)
              .eq('user_id', nextStory.user_id)
              .gt('expires_at', new Date().toISOString())
              .order('created_at', { ascending: false })
            if (data && data.length > 1) {
              setLocalStories([...localStories.slice(0,nextIdx), ...data, ...localStories.slice(nextIdx+1)])
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
  const h        = Math.floor(msLeft/3600000)
  const m        = Math.floor((msLeft%3600000)/60000)
  const timeLeft = h >= 1 ? `${h}h left` : `${m}m left`
  const createdAgo = timeAgoFn(story.created_at)

  const typeMeta = TYPE_META[story.status_type?.toLowerCase()] || null
  const isRecent = Date.now() - new Date(story.created_at).getTime() < 1800000

  // per-user progress bars
  const uid          = story.user_id
  const userStories  = localStories.filter(s => s.user_id === uid)
  const userStartIdx = localStories.findIndex(s => s.user_id === uid)
  const localIdx     = idx - userStartIdx
  const fallbackBg   = GRADIENTS[idx % GRADIENTS.length]

  function goChat()     { onClose(); navigate('/chat/' + story.user_id) }
  function handleCall() { onClose(); navigate(`/chat/${story.user_id}`, { state: { autoCall: 'voice' } }) }

  async function handleSave() {
    if (saveLoading) return
    setSaveLoading(true)
    if (saved) {
      await supabase.from('saved_statuses').delete().eq('user_id', currentUserId).eq('status_id', story.id)
      setSaved(false)
    } else {
      const { error } = await supabase.from('saved_statuses')
        .upsert({ user_id: currentUserId, status_id: story.id }, { onConflict: 'user_id,status_id', ignoreDuplicates: true })
      if (!error) setSaved(true)
    }
    setSaveLoading(false)
  }

  async function handleReply() {
    if (!replyText.trim() || replySending || !currentUserId) return
    setReplySending(true)
    const { data: existing } = await supabase.from('chats')
      .select('id').or(`and(buyer_id.eq.${currentUserId},seller_id.eq.${story.user_id}),and(buyer_id.eq.${story.user_id},seller_id.eq.${currentUserId})`).maybeSingle()
    let chatId = existing?.id
    if (!chatId) {
      const { data: newChat } = await supabase.from('chats')
        .insert({ buyer_id: currentUserId, seller_id: story.user_id }).select('id').single()
      chatId = newChat?.id
    }
    if (chatId) {
      await supabase.from('messages').insert({ chat_id: chatId, sender_id: currentUserId, content: `💬 Re: your status — "${replyText.trim()}"` })
    }
    setReplyText(''); setReplySending(false)
    onClose(); navigate('/chat/' + story.user_id)
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
      if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent) && navigator.share) {
        try { await navigator.share({ title: `${n} on SokoMw`, text: s?.content||'', url }) } catch(e) {}
      } else { setShareUrl(url) }
    }
    btn.addEventListener('click', nativeShare)
    return () => btn.removeEventListener('click', nativeShare)
  }, [])

  function onPointerDown() { holdRef.current = setTimeout(() => setPaused(true), 120) }
  function onPointerUp()   { clearTimeout(holdRef.current); if (!showViewers) setPaused(false) }
  function tapLeft(e)  { e.stopPropagation(); if (idx > 0) setIdx(i => i-1); else onClose() }
  function tapRight(e) { e.stopPropagation(); if (idx < localStories.length-1) setIdx(i => i+1); else onClose() }

  const filteredViewers = viewers.filter(v =>
    !viewerSearch || v.viewer?.full_name?.toLowerCase().includes(viewerSearch.toLowerCase())
  )

  return (
    <>
      <style>{`
        @keyframes burstPop {
          0%   { transform: scale(1) }
          30%  { transform: scale(1.7) }
          60%  { transform: scale(0.9) }
          100% { transform: scale(1) }
        }
        @keyframes floatIn {
          from { opacity:0; transform: translateY(12px) }
          to   { opacity:1; transform: translateY(0) }
        }
        @keyframes shimmer {
          0%   { background-position: -200% 0 }
          100% { background-position:  200% 0 }
        }
        @keyframes liveDot {
          0%,100% { opacity:1; transform:scale(1) }
          50%     { opacity:.4; transform:scale(.6) }
        }
        .sv-action-btn:active { transform: scale(0.94) !important; }
        .sv-react-btn:active  { transform: scale(1.25) !important; }
      `}</style>

      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 998,
          background: '#0B0F14',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          userSelect: 'none',
          display: 'flex', alignItems: 'stretch', justifyContent: 'center',
        }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        {/* ambient glows */}
        <div style={{ position:'absolute', inset:0, pointerEvents:'none', overflow:'hidden' }}>
          <div style={{ position:'absolute', top:-120, left:'20%', width:400, height:400, borderRadius:'50%', background:'radial-gradient(circle,rgba(34,160,94,0.09) 0%,transparent 70%)' }} />
          <div style={{ position:'absolute', bottom:-80, right:'15%', width:320, height:320, borderRadius:'50%', background:'radial-gradient(circle,rgba(139,92,246,0.07) 0%,transparent 70%)' }} />
        </div>

        {/* ── card ── */}
        <div style={{
          position:'relative', width:'100%', maxWidth:480,
          display:'flex', flexDirection:'column',
          background:'#111827', overflow:'hidden',
        }}>

          {/* ══ MEDIA (fills 72vh) ══ */}
          <div style={{ position:'relative', height:'72vh', flexShrink:0, background:'#000', overflow:'hidden' }}>

            {/* skeleton */}
            {!imgLoaded && media[0] && (
              <div style={{
                position:'absolute', inset:0, zIndex:2,
                background:'linear-gradient(90deg,#1a1f2e 25%,#242938 50%,#1a1f2e 75%)',
                backgroundSize:'200% 100%',
                animation:'shimmer 1.4s infinite',
              }} />
            )}

            {/* media */}
            {media.length > 0
              ? isVideo
                ? <video src={media[0]} autoPlay muted playsInline loop
                    style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }} />
                : <img src={media[0]} alt="" loading="lazy"
                    onLoad={() => setImgLoaded(true)}
                    style={{ width:'100%', height:'100%', objectFit:'cover', display:'block',
                      transform: paused ? 'scale(1.04)' : 'scale(1)',
                      transition: 'transform 0.6s ease',
                    }} />
              : <div style={{ width:'100%', height:'100%', background: fallbackBg }} />
            }

            {/* top scrim */}
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 28%, transparent 55%, rgba(0,0,0,0.82) 100%)', zIndex:3 }} />

            {/* ── progress bars ── */}
            <div style={{ position:'absolute', top:0, left:0, right:0, display:'flex', gap:3, padding:'10px 12px 0', zIndex:10 }}>
              {userStories.map((_,i) => (
                <div key={i} style={{ flex:1, height:2.5, borderRadius:2, background:'rgba(255,255,255,0.22)', overflow:'hidden' }}>
                  <div style={{ height:'100%', background:'#fff', borderRadius:2,
                    width: i<localIdx?'100%': i===localIdx?`${progress}%`:'0%',
                    transition:'none',
                  }} />
                </div>
              ))}
            </div>

            {/* ── seller header (glass) ── */}
            <div style={{
              position:'absolute', top:20, left:0, right:0,
              display:'flex', alignItems:'center', gap:10,
              padding:'10px 12px', zIndex:10,
            }}>
              {/* avatar */}
              <div style={{ position:'relative', flexShrink:0 }}>
                <div style={{
                  width:44, height:44, borderRadius:'50%',
                  border:'2px solid rgba(255,255,255,0.9)',
                  overflow:'hidden',
                  background:'linear-gradient(135deg,#1a7a4a,#22a05e)',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  fontSize:16, fontWeight:800, color:'#fff',
                }}>
                  {avatar ? <img src={avatar} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : initial}
                </div>
                {/* online dot */}
                <div style={{ position:'absolute', bottom:1, right:1, width:10, height:10, borderRadius:'50%', background:'#22c55e', border:'2px solid #111827' }} />
              </div>

              {/* name + meta */}
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                  <span style={{ fontSize:14, fontWeight:800, color:'#fff', textShadow:'0 1px 6px rgba(0,0,0,0.6)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {name}
                  </span>
                  {/* verified */}
                  <span style={{ fontSize:10, fontWeight:700, color:'#60a5fa', background:'rgba(96,165,250,0.15)', border:'1px solid rgba(96,165,250,0.3)', borderRadius:6, padding:'1px 6px', flexShrink:0 }}>
                    ✓ Verified
                  </span>
                  {!isOwn && (
                    <div onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}>
                      <FollowButton currentUserId={currentUserId} sellerId={story.user_id} size="sm" />
                    </div>
                  )}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:2, flexWrap:'wrap' }}>
                  <span style={{ fontSize:11, color:'rgba(255,255,255,0.55)' }}>{createdAgo}</span>
                  {story.location_hint && (
                    <span style={{ fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.7)', background:'rgba(255,255,255,0.12)', backdropFilter:'blur(8px)', border:'1px solid rgba(255,255,255,0.18)', borderRadius:20, padding:'1px 7px', display:'inline-flex', alignItems:'center', gap:3 }}>
                      📍 {story.location_hint.toUpperCase()}
                    </span>
                  )}
                </div>
              </div>

              {/* close */}
              <button
                onPointerDown={e => e.stopPropagation()}
                onPointerUp={e => { e.stopPropagation(); onClose() }}
                style={{ background:'rgba(0,0,0,0.4)', backdropFilter:'blur(12px)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', width:34, height:34, borderRadius:'50%', fontSize:15, cursor:'pointer', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.18s' }}
              >✕</button>
            </div>

            {/* ── top-left type badge ── */}
            {typeMeta && (
              <div style={{ position:'absolute', bottom:80, left:12, zIndex:8 }}>
                <span style={{ fontSize:10, fontWeight:800, letterSpacing:0.4, color:'#fff', background:typeMeta.grad, borderRadius:8, padding:'4px 10px', display:'inline-flex', alignItems:'center', gap:4, boxShadow:'0 2px 12px rgba(0,0,0,0.4)' }}>
                  {typeMeta.label}
                </span>
              </div>
            )}
            {isRecent && (
              <div style={{ position:'absolute', bottom: typeMeta ? 110 : 80, left:12, zIndex:8 }}>
                <span style={{ fontSize:10, fontWeight:800, color:'#fff', background:'linear-gradient(135deg,#3b82f6,#1d4ed8)', borderRadius:8, padding:'4px 10px', display:'inline-flex', alignItems:'center', gap:4 }}>
                  <span style={{ width:5, height:5, borderRadius:'50%', background:'#fff', animation:'liveDot 1.2s infinite', display:'inline-block' }} />
                  NEW
                </span>
              </div>
            )}

            {/* ── floating product card ── */}
            {story.tagged && (
              <div
                onPointerDown={e => e.stopPropagation()}
                onPointerUp={e => { e.stopPropagation(); onClose(); navigate('/listing/'+story.tagged_listing_id) }}
                style={{
                  position:'absolute', bottom:16, left:12, right:60, zIndex:8,
                  background:'rgba(17,24,39,0.82)', backdropFilter:'blur(20px)',
                  border:'1px solid rgba(255,255,255,0.14)',
                  borderRadius:16, padding:'10px 12px',
                  display:'flex', alignItems:'center', gap:10,
                  cursor:'pointer', animation:'floatIn 0.35s ease',
                  boxShadow:'0 8px 32px rgba(0,0,0,0.5)',
                }}
              >
                {story.tagged.images?.[0] && (
                  <img src={story.tagged.images[0]} alt="" style={{ width:46, height:46, borderRadius:10, objectFit:'cover', flexShrink:0 }} />
                )}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:600, color:'rgba(255,255,255,0.75)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{story.tagged.title}</div>
                  <div style={{ fontSize:15, fontWeight:800, color:'#4ade80', marginTop:2 }}>MK {Number(story.tagged.price).toLocaleString()}</div>
                </div>
                <div style={{ fontSize:10, fontWeight:700, color:'#4ade80', background:'rgba(74,222,128,0.12)', border:'1px solid rgba(74,222,128,0.25)', borderRadius:8, padding:'4px 8px', flexShrink:0 }}>View ↗</div>
              </div>
            )}

            {/* ── right-side reaction stack (viewers only) ── */}
            {!isOwn && (
              <div
                onPointerDown={e => e.stopPropagation()}
                onPointerUp={e => e.stopPropagation()}
                style={{ position:'absolute', right:12, bottom: story.tagged ? 90 : 16, zIndex:8, display:'flex', flexDirection:'column', gap:6, alignItems:'center' }}
              >
                {REACTIONS.map(({ key, emoji, label }) => {
                  const active = myReaction === key
                  const count  = reactionCounts[key] || 0
                  const burst  = reactionBurst === key
                  return (
                    <div key={key} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                      <button
                        className="sv-react-btn"
                        onClick={e => { e.stopPropagation(); handleReact(key) }}
                        disabled={reacting}
                        style={{
                          width:44, height:44, borderRadius:'50%',
                          background: active ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.45)',
                          backdropFilter:'blur(16px)',
                          border: active ? '1.5px solid rgba(255,255,255,0.5)' : '1px solid rgba(255,255,255,0.15)',
                          cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:20, lineHeight:1,
                          transform: burst ? 'scale(1.5)' : active ? 'scale(1.08)' : 'scale(1)',
                          transition:'transform 0.18s cubic-bezier(.34,1.56,.64,1), background 0.18s, border 0.18s',
                          animation: burst ? 'burstPop 0.5s ease' : 'none',
                        }}
                      >{emoji}</button>
                      {count > 0 && (
                        <span style={{ fontSize:10, fontWeight:800, color:'#fff', textShadow:'0 1px 4px rgba(0,0,0,0.8)' }}>{fmtK(count)}</span>
                      )}
                    </div>
                  )
                })}
                {/* save on right stack too */}
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, marginTop:2 }}>
                  <button
                    className="sv-react-btn"
                    onClick={e => { e.stopPropagation(); handleSave() }}
                    style={{ width:44, height:44, borderRadius:'50%', background: saved ? 'rgba(239,68,68,0.3)' : 'rgba(0,0,0,0.45)', backdropFilter:'blur(16px)', border: saved ? '1.5px solid rgba(239,68,68,0.5)' : '1px solid rgba(255,255,255,0.15)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, transition:'all 0.18s' }}
                  >{saved ? '🔖' : '🔖'}</button>
                </div>
                <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2 }}>
                  <button
                    ref={shareRef}
                    className="sv-react-btn"
                    onPointerDown={e => e.stopPropagation()}
                    onPointerUp={e => e.stopPropagation()}
                    style={{ width:44, height:44, borderRadius:'50%', background:'rgba(0,0,0,0.45)', backdropFilter:'blur(16px)', border:'1px solid rgba(255,255,255,0.15)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, transition:'all 0.18s' }}
                  >↗</button>
                </div>
              </div>
            )}

            {/* tap zones */}
            <div onPointerUp={tapLeft}  style={{ position:'absolute', left:0,  top:80, bottom:0, width:'33%', zIndex:5 }} />
            <div onPointerUp={tapRight} style={{ position:'absolute', right:60, top:80, bottom:0, width:'33%', zIndex:5 }} />
          </div>

          {/* ══ BOTTOM PANEL ══ */}
          <div style={{ flex:1, background:'#111827', display:'flex', flexDirection:'column', overflowY:'auto', minHeight:0 }}>

            {/* ── story content card ── */}
            <div style={{ margin:'12px 12px 0', background:'rgba(255,255,255,0.04)', border:'1px solid rgba(255,255,255,0.07)', borderRadius:16, padding:'12px 14px' }}>
              <p style={{ margin:'0 0 6px', fontSize:14, fontWeight:500, color:'#e2e8f0', lineHeight:1.55 }}>
                {story.content}
              </p>
              <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap' }}>
                <span style={{ fontSize:11, color:'rgba(255,255,255,0.35)', display:'flex', alignItems:'center', gap:4 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l2 2"/></svg>
                  {timeLeft}
                </span>
                {story.location_hint && (
                  <span style={{ fontSize:11, color:'rgba(255,255,255,0.3)' }}>📍 {story.location_hint}</span>
                )}
              </div>
            </div>

            {/* ── own story analytics ── */}
            {isOwn && (
              <div onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}
                style={{ margin:'10px 12px 0' }}>
                {/* stat cards row */}
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:6, marginBottom:10 }}>
                  {[
                    { icon:'👁', val: fmtK(viewCount), label:'Views', onClick: openViewers },
                    { icon:'🔥', val: fmtK(reactionCounts.hot||0), label:'Fire', onClick: null },
                    { icon:'❤️', val: fmtK(reactionCounts.love||0), label:'Love', onClick: null },
                    { icon:'👍', val: fmtK(reactionCounts.interested||0), label:'Like', onClick: null },
                  ].map(({ icon, val, label, onClick }) => (
                    <button key={label}
                      onClick={e => { e.stopPropagation(); onClick?.() }}
                      style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.08)', borderRadius:12, padding:'10px 4px', display:'flex', flexDirection:'column', alignItems:'center', gap:3, cursor: onClick ? 'pointer' : 'default' }}>
                      <span style={{ fontSize:16 }}>{icon}</span>
                      <span style={{ fontSize:13, fontWeight:800, color:'#f1f5f9' }}>{val}</span>
                      <span style={{ fontSize:9, color:'rgba(255,255,255,0.35)', fontWeight:600 }}>{label}</span>
                    </button>
                  ))}
                </div>
                <div style={{ textAlign:'center', color:'rgba(255,255,255,0.25)', fontSize:11, paddingBottom:16 }}>
                  Your status · {timeLeft}
                </div>
              </div>
            )}

            {/* ── viewer bottom actions ── */}
            {!isOwn && (
              <div onPointerDown={e => e.stopPropagation()} onPointerUp={e => e.stopPropagation()}
                style={{ padding:'10px 12px 20px', display:'flex', flexDirection:'column', gap:8 }}>

                {/* reply input */}
                <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:50, padding:'9px 14px' }}>
                  <input
                    value={replyText}
                    onChange={e => setReplyText(e.target.value)}
                    onFocus={() => setPaused(true)}
                    onBlur={() => setPaused(false)}
                    onKeyDown={e => e.key === 'Enter' && handleReply()}
                    placeholder={`Reply to ${name.split(' ')[0]}…`}
                    style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:13, color:'#fff' }}
                  />
                  <button
                    onClick={e => { e.stopPropagation(); handleReply() }}
                    disabled={!replyText.trim() || replySending}
                    style={{ background:'none', border:'none', cursor: replyText.trim() ? 'pointer' : 'default', padding:0, display:'flex', opacity: replyText.trim() ? 1 : 0.3, transition:'opacity 0.18s' }}
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22a05e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                    </svg>
                  </button>
                </div>

                {/* primary CTA */}
                <button
                  className="sv-action-btn"
                  onClick={e => { e.stopPropagation(); goChat() }}
                  style={{ width:'100%', background:'linear-gradient(135deg,#1a7a4a,#22a05e)', border:'none', borderRadius:50, padding:'13px 20px', fontSize:14, fontWeight:800, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, boxShadow:'0 4px 20px rgba(26,122,74,0.35)', transition:'transform 0.18s, box-shadow 0.18s' }}
                >
                  💬 Message Seller
                </button>

                {/* secondary row */}
                <div style={{ display:'flex', gap:8 }}>
                  <button
                    className="sv-action-btn"
                    onClick={e => { e.stopPropagation(); handleCall() }}
                    style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:50, padding:'11px 8px', fontSize:12, fontWeight:700, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, transition:'all 0.18s' }}
                  >📞 Call</button>
                  {story.tagged && (
                    <button
                      className="sv-action-btn"
                      onClick={e => { e.stopPropagation(); onClose(); navigate('/listing/'+story.tagged_listing_id) }}
                      style={{ flex:1, background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)', borderRadius:50, padding:'11px 8px', fontSize:12, fontWeight:700, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, transition:'all 0.18s' }}
                    >🛒 Listing</button>
                  )}
                  <button
                    className="sv-action-btn"
                    onClick={e => { e.stopPropagation(); handleSave() }}
                    style={{ flex:1, background: saved ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.06)', border:`1px solid ${saved ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.12)'}`, borderRadius:50, padding:'11px 8px', fontSize:12, fontWeight:700, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:5, transition:'all 0.2s' }}
                  >{saved?'❤️':'🤍'} {saveLoading?'…':'Save'}</button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── share popup ── */}
        {shareUrl && (
          <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center', background:'rgba(0,0,0,0.55)', backdropFilter:'blur(6px)' }} onClick={() => setShareUrl(null)}>
            <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:480, background:'#1a1f2e', borderRadius:'24px 24px 0 0', padding:'20px 16px 40px', border:'1px solid rgba(255,255,255,0.08)', borderBottom:'none' }}>
              <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.15)', margin:'0 auto 18px' }} />
              <div style={{ fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.5)', marginBottom:10 }}>🔗 Share this status</div>
              <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.06)', borderRadius:12, padding:'10px 14px', border:'1px solid rgba(255,255,255,0.1)' }}>
                <div style={{ flex:1, fontSize:12, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{shareUrl}</div>
                <button onClick={() => {
                  navigator.clipboard?.writeText(shareUrl)
                    .then(() => { setShareUrl(null); alert('✅ Link copied!') })
                    .catch(() => {
                      const el=document.createElement('textarea'); el.value=shareUrl
                      document.body.appendChild(el); el.select(); document.execCommand('copy')
                      document.body.removeChild(el); setShareUrl(null); alert('✅ Link copied!')
                    })
                }} style={{ background:'linear-gradient(135deg,#1a7a4a,#22a05e)', border:'none', borderRadius:8, padding:'6px 16px', fontSize:12, fontWeight:700, color:'#fff', cursor:'pointer', flexShrink:0 }}>Copy</button>
              </div>
            </div>
          </div>
        )}

        {/* ── viewers sheet ── */}
        {showViewers && (
          <div style={{ position:'fixed', inset:0, zIndex:9999, display:'flex', alignItems:'flex-end', justifyContent:'center', background:'rgba(0,0,0,0.65)', backdropFilter:'blur(6px)' }} onClick={closeViewers}>
            <div onClick={e => e.stopPropagation()} style={{ width:'100%', maxWidth:480, background:'#111827', borderRadius:'24px 24px 0 0', padding:'0 0 40px', maxHeight:'75vh', display:'flex', flexDirection:'column', border:'1px solid rgba(255,255,255,0.08)', borderBottom:'none' }}>
              {/* drag handle */}
              <div style={{ width:36, height:4, borderRadius:2, background:'rgba(255,255,255,0.15)', margin:'12px auto 0' }} />

              {/* header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'14px 16px 10px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:800, color:'#fff', display:'flex', alignItems:'center', gap:8 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#22a05e" strokeWidth="2.2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    {viewCount} {viewCount===1?'View':'Views'}
                  </div>
                  <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:2 }}>People who viewed this status</div>
                </div>
                <button onClick={closeViewers} style={{ background:'rgba(255,255,255,0.08)', border:'none', color:'#fff', width:32, height:32, borderRadius:'50%', fontSize:15, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
              </div>

              {/* search */}
              <div style={{ padding:'10px 16px 0' }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:50, padding:'8px 14px' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
                  <input
                    value={viewerSearch}
                    onChange={e => setViewerSearch(e.target.value)}
                    placeholder="Search viewers…"
                    style={{ flex:1, background:'none', border:'none', outline:'none', fontSize:13, color:'#fff' }}
                  />
                </div>
              </div>

              {/* list */}
              <div style={{ overflowY:'auto', flex:1, marginTop:8 }}>
                {viewersLoading ? (
                  <div style={{ padding:32, textAlign:'center', color:'rgba(255,255,255,0.4)', fontSize:13 }}>Loading…</div>
                ) : filteredViewers.length === 0 ? (
                  <div style={{ padding:40, textAlign:'center' }}>
                    <div style={{ fontSize:32, marginBottom:8 }}>👁</div>
                    <div style={{ fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.5)' }}>{viewerSearch ? 'No match' : 'No views yet'}</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.25)', marginTop:4 }}>Share your status to get more reach</div>
                  </div>
                ) : filteredViewers.map((v,i) => {
                  const vname    = v.viewer?.full_name || 'Unknown'
                  const vavatar  = v.viewer?.avatar_url
                  const vinitials= vname.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()
                  return (
                    <div key={i} style={{ display:'flex', alignItems:'center', gap:12, padding:'11px 16px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
                      <div style={{ width:42, height:42, borderRadius:'50%', flexShrink:0, overflow:'hidden', background:'linear-gradient(135deg,#1a7a4a,#22a05e)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:700, color:'#fff' }}>
                        {vavatar ? <img src={vavatar} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : vinitials}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14, fontWeight:700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{vname}</div>
                        <div style={{ fontSize:11, color:'rgba(255,255,255,0.35)', marginTop:1 }}>👁 {timeAgoFn(v.viewed_at)}</div>
                      </div>
                      <button
                        onClick={() => { closeViewers(); onClose(); navigate('/chat/'+v.viewer?.id) }}
                        style={{ background:'rgba(34,160,94,0.12)', border:'1px solid rgba(34,160,94,0.3)', borderRadius:20, padding:'5px 14px', fontSize:11, fontWeight:700, color:'#22a05e', cursor:'pointer', whiteSpace:'nowrap', flexShrink:0 }}
                      >Chat</button>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  )
}