import { useEffect, useRef, useState, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useWebRTC, formatTime } from '../hooks/useWebRTC'
import { watchUserOnline, globalChannel } from '../hooks/usePresence'

// ── Emoji picker data ────────────────────────────────────────────────────────
const EMOJI_CATEGORIES = {
  '😀': ['😀','😂','🤣','😊','😍','🥰','😘','😎','🤔','😅','😭','😤','🥺','😱','🤩','😴','🤗','😏','🙄','😬','🥳','😇','🤭','😋','😜'],
  '👍': ['👍','👎','👏','🙌','🤝','👋','🤙','💪','🫶','❤️','🔥','✨','💯','🎉','🎊','🙏','💀','👀','💅','🫠','🤌','💫','⭐','🌟','💥'],
  '🐶': ['🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🦋','🌸','🌺','🌻','🍎','🍕','🍔','☕','🎵','🏆'],
}

// ── Reply storage: stored in message body as a prefix so no extra DB columns needed
// Format: "↩[reply_preview|||reply_to_id]actual_body"
// We encode/decode this client-side only.
function encodeReply(body, replyTo) {
  if (!replyTo) return body
  const preview = (replyTo.body || (replyTo.media_type === 'audio' ? '🎤 Voice note' : replyTo.media_type === 'image' ? '📷 Photo' : '📎 File')).slice(0, 80)
  return `↩[${preview}|||${replyTo.id}]${body}`
}

function decodeReply(body) {
  if (!body) return { body, replyPreview: null, replyToId: null }
  const match = body.match(/^↩\[(.+?)\|\|\|([^\]]+)\](.*)$/s)
  if (!match) return { body, replyPreview: null, replyToId: null }
  return { body: match[3], replyPreview: match[1], replyToId: match[2] }
}

export default function Chat() {
  const { userId, listingId } = useParams()
  const navigate = useNavigate()

  // ── State ────────────────────────────────────────────────────────────────
  const [messages, setMessages]           = useState([])
  const [newMsg, setNewMsg]               = useState('')
  const [currentUser, setCurrentUser]     = useState(null)
  const [otherUser, setOtherUser]         = useState(null)
  const [otherProfile, setOtherProfile]   = useState(null)
  const [listing, setListing]             = useState(null)
  const [service, setService]             = useState(null)
  const [booking, setBooking]             = useState(null)
  const [isServiceChat, setIsServiceChat] = useState(false)
  const [loading, setLoading]             = useState(true)
  const [uploading, setUploading]         = useState(false)
  const [recording, setRecording]         = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [waveHeights, setWaveHeights]     = useState(Array(40).fill(2))
  const [playingId, setPlayingId]         = useState(null)
  const [audioProgress, setAudioProgress] = useState({})
  const [audioDuration, setAudioDuration] = useState({})
  const [preview, setPreview]             = useState(null)
  const [showEmoji, setShowEmoji]         = useState(false)
  const [emojiTab, setEmojiTab]           = useState('😀')
  const [otherOnline, setOtherOnline]     = useState(false)
  const [otherLastSeen, setOtherLastSeen] = useState(null)
  const [otherTyping, setOtherTyping]     = useState(false)
  const [myProfile, setMyProfile]         = useState(null)
  const [replyTo, setReplyTo]             = useState(null)

  const isServiceChatRef   = useRef(false)
  const currentUserRef     = useRef(null)
  const bottomRef          = useRef(null)
  const mediaRecorderRef   = useRef(null)
  const chunksRef          = useRef([])
  const timerRef           = useRef(null)
  const analyserRef        = useRef(null)
  const animFrameRef       = useRef(null)
  const audioRefs          = useRef({})
  const inputRef           = useRef(null)
  const channelRef         = useRef(null)
  const presenceChannelRef = useRef(null)
  const typingTimeoutRef   = useRef(null)
  const emojiPickerRef     = useRef(null)

  // ── WebRTC ───────────────────────────────────────────────────────────────
  const {
    callState, callType, callDuration, isMuted, isCamOff,
    remoteStream, localVideoRef, remoteVideoRef,
    startCall, answerCall, declineCall, hangUp, endCallLocally,
    toggleMute, toggleCam, switchCamera, setupCallListener, assignRemoteStream,
    assignLocalStream, restorePendingCall,
  } = useWebRTC({
    userId,
    currentUser,
    onCallMessage: (fields) => sendMessage('', 'text', null, fields),
  })

  // ── Effects ──────────────────────────────────────────────────────────────
  useEffect(() => {
    init()
    return () => {
      if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
      if (presenceChannelRef.current) { presenceChannelRef.current(); presenceChannelRef.current = null }
      endCallLocally()
    }
  }, [userId, listingId])

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])
  useEffect(() => { assignRemoteStream() }, [remoteStream])
  useEffect(() => { if (callState === 'in-call') { assignRemoteStream(); assignLocalStream() } }, [callState])
  useEffect(() => { if (!userId) return; return setupCallListener() }, [userId])

  // Close emoji picker on outside click
  useEffect(() => {
    function handler(e) {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target)) setShowEmoji(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Init ─────────────────────────────────────────────────────────────────
  async function init() {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession()
    if (sessionError || !session) {
      const { data: rd, error: re } = await supabase.auth.refreshSession()
      if (re || !rd.session) { navigate('/login'); return }
    }
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }

    setCurrentUser(user)
    currentUserRef.current = user
    await supabase.from('users').upsert({ id: user.id, name: user.email }, { onConflict: 'id' })

    const { data: myProf } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle()
    setMyProfile(myProf)

    if (!userId) return
    const { data: other } = await supabase.from('users').select('*').eq('id', userId).maybeSingle()
    setOtherUser(other)

    const { data: otherProf } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle()
    setOtherProfile(otherProf)

    // Load last_seen from profile on mount
    if (otherProf?.last_seen) setOtherLastSeen(new Date(otherProf.last_seen))

    restorePendingCall(userId)

    let isService = false
    if (listingId && listingId !== 'undefined') {
      const { data: svc } = await supabase.from('services').select('*').eq('id', listingId).maybeSingle()
      if (svc) {
        setService(svc); setIsServiceChat(true); isServiceChatRef.current = true; isService = true
        try {
          const foundBooking = await loadBooking(listingId, user.id, userId)
          if (foundBooking) setBooking(foundBooking)
        } catch (e) {}
      } else {
        const { data: lst } = await supabase.from('listings').select('*').eq('id', listingId).maybeSingle()
        if (lst) setListing(lst)
      }
    }

    await loadMessages(user.id, isService)

    let readQuery = supabase.from('messages').update({ read: true }).eq('to_user', user.id).eq('from_user', userId)
    if (isService) readQuery = readQuery.eq('service_id', listingId)
    else if (listingId && listingId !== 'undefined') readQuery = readQuery.eq('listing_id', listingId)
    await readQuery

    setLoading(false)
    setupRealtimeChannel(user.id, isService)
    setupPresenceChannel(user.id)
  }

  function setupRealtimeChannel(myId, isService) {
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null }
    const hasListing = listingId && listingId !== 'undefined'
    const channelName = `chat_${[myId, userId].sort().join('_')}${hasListing ? '_' + listingId : ''}`
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new
        const relevant = (msg.from_user === myId && msg.to_user === userId) || (msg.from_user === userId && msg.to_user === myId)
        const sameContext = !hasListing
          ? (!msg.service_id && !msg.listing_id)
          : isService ? msg.service_id === listingId : msg.listing_id === listingId
        if (relevant && sameContext) {
          setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
          if (msg.from_user === userId) {
            supabase.from('messages').update({ read: true }).eq('id', msg.id).then(() => {})
          }
        }
      })
      .subscribe()
    channelRef.current = channel
  }

  // ── Presence: watch other user via global channel ────────────────────────
  // useGlobalPresence (called in App.jsx) broadcasts MY presence app-wide.
  // Here we only WATCH the other user using the global channel.
  function setupPresenceChannel(myId) {
    if (presenceChannelRef.current) {
      presenceChannelRef.current()
      presenceChannelRef.current = null
    }

    const unsub = watchUserOnline(
      userId,
      (isOnline) => {
        setOtherOnline(isOnline)
        if (!isOnline) {
          supabase.from('profiles').select('last_seen').eq('id', userId).maybeSingle().then(({ data }) => {
            if (data?.last_seen) setOtherLastSeen(new Date(data.last_seen))
            else setOtherLastSeen(new Date())
          })
        }
      },
      (isTyping) => setOtherTyping(isTyping),
    )

    presenceChannelRef.current = unsub
  }

  // ── Typing indicator — broadcast via the singleton global presence channel ─
  function handleTyping(val) {
    setNewMsg(val)
    if (!globalChannel) return
    globalChannel.track({ user_id: currentUserRef.current?.id, typing: true })
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => {
      globalChannel?.track({ user_id: currentUserRef.current?.id, typing: false })
    }, 1500)
  }

  // ── Helpers ──────────────────────────────────────────────────────────────
  async function loadBooking(serviceId, myId, otherId) {
    if (!serviceId || serviceId === 'undefined' || !myId || !otherId) return null
    const { data: bk1 } = await supabase.from('bookings').select('*')
      .eq('service_id', serviceId).eq('customer_id', myId).eq('provider_id', otherId)
      .order('created_at', { ascending: false }).limit(1)
    if (bk1?.length) return bk1[0]
    const { data: bk2 } = await supabase.from('bookings').select('*')
      .eq('service_id', serviceId).eq('customer_id', otherId).eq('provider_id', myId)
      .order('created_at', { ascending: false }).limit(1)
    if (bk2?.length) return bk2[0]
    return null
  }

  async function loadMessages(myId, isService) {
    let query = supabase.from('messages').select('*')
      .or(`and(from_user.eq.${myId},to_user.eq.${userId}),and(from_user.eq.${userId},to_user.eq.${myId})`)
      .order('created_at', { ascending: true })
    if (isService) query = query.eq('service_id', listingId)
    else if (listingId && listingId !== 'undefined') query = query.eq('listing_id', listingId)
    const { data, error } = await query
    if (!error) setMessages(data || [])
  }

  // ── FIXED: sendMessage — no reply_preview / reply_to_id columns needed ──
  // Reply context is encoded inside the message body itself.
  async function sendMessage(body, type = 'text', mediaUrl = null, extraFields = {}) {
    const trimmed = body.trim()
    if (!trimmed && !mediaUrl && !extraFields.call_status) return
    const { data: { user } } = await supabase.auth.getUser()

    // Encode reply into the body string — no extra DB columns required
    const encodedBody = encodeReply(trimmed, replyTo)

    const msgData = {
      from_user: user.id,
      to_user: userId,
      body: encodedBody,
      media_url: mediaUrl,
      media_type: type,
      read: false,
      ...extraFields,
    }
    if (isServiceChatRef.current && listingId !== 'undefined') msgData.service_id = listingId
    else if (!isServiceChatRef.current && listingId !== 'undefined') msgData.listing_id = listingId

    const { error } = await supabase.from('messages').insert(msgData)
    if (error) { alert('Failed to send: ' + error.message); return }

    setNewMsg('')
    setReplyTo(null)
    if (inputRef.current) inputRef.current.style.height = 'auto'
    globalChannel?.track({ user_id: currentUserRef.current?.id, typing: false })
    clearTimeout(typingTimeoutRef.current)
  }

  async function uploadAndSend(file, type, caption = '') {
    setUploading(true)
    try {
      const ext = file.name?.split('.').pop() || 'bin'
      const path = `chat/${currentUser.id}/${type}_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('listings').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('listings').getPublicUrl(path)
      await sendMessage(caption, type, data.publicUrl)
    } catch (e) { alert('Upload failed: ' + e.message) }
    setUploading(false)
    setPreview(null)
  }

  function pickFile(accept, type) {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = accept
    input.onchange = e => {
      const file = e.target.files[0]; if (!file) return
      setPreview({ file, url: URL.createObjectURL(file), type, caption: '' })
    }
    input.click()
  }

  // ── Voice recording ──────────────────────────────────────────────────────
  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const audioCtx = new AudioContext()
      const analyser = audioCtx.createAnalyser()
      audioCtx.createMediaStreamSource(stream).connect(analyser)
      analyser.fftSize = 128; analyserRef.current = analyser
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop()); audioCtx.close()
        cancelAnimationFrame(animFrameRef.current)
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        await uploadAndSend(new File([blob], `voice_${Date.now()}.webm`, { type: 'audio/webm' }), 'audio', '')
      }
      mr.start(); mediaRecorderRef.current = mr
      setRecording(true); setRecordingTime(0)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
      drawWave(analyser)
    } catch (e) { alert('Microphone access denied') }
  }

  function drawWave(analyser) {
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    function frame() {
      analyser.getByteFrequencyData(dataArray)
      setWaveHeights(Array(40).fill(0).map((_, i) =>
        Math.max(2, (dataArray[Math.floor(i * dataArray.length / 40)] / 255) * 36)
      ))
      animFrameRef.current = requestAnimationFrame(frame)
    }
    frame()
  }

  function stopRecording() {
    mediaRecorderRef.current?.stop(); setRecording(false)
    clearInterval(timerRef.current); cancelAnimationFrame(animFrameRef.current)
    setRecordingTime(0); setWaveHeights(Array(40).fill(2))
  }

  function cancelRecording() {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null
      mediaRecorderRef.current.onstop = null
      mediaRecorderRef.current.stop()
    }
    setRecording(false); clearInterval(timerRef.current)
    cancelAnimationFrame(animFrameRef.current)
    setRecordingTime(0); setWaveHeights(Array(40).fill(2))
  }

  // ── Audio playback ───────────────────────────────────────────────────────
  function toggleAudio(id) {
    const audio = audioRefs.current[id]; if (!audio) return
    if (playingId === id) { audio.pause(); setPlayingId(null) }
    else {
      if (playingId && audioRefs.current[playingId]) audioRefs.current[playingId].pause()
      audio.play(); setPlayingId(id)
      audio.onended = () => setPlayingId(null)
      audio.ontimeupdate = () =>
        setAudioProgress(p => ({ ...p, [id]: audio.duration ? audio.currentTime / audio.duration : 0 }))
      audio.onloadedmetadata = () =>
        setAudioDuration(d => ({ ...d, [id]: audio.duration }))
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(newMsg) }
  }

  // ── Presence helpers ─────────────────────────────────────────────────────
  function lastSeenLabel(date) {
    if (!date) return ''
    const diff = Date.now() - new Date(date)
    if (diff < 60000) return 'just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return `${Math.floor(diff / 86400000)}d ago`
  }

  // ── Avatar helpers ───────────────────────────────────────────────────────
  const otherName    = otherProfile?.full_name || otherUser?.name || otherUser?.email || 'User'
  const otherAvatar  = otherProfile?.avatar_url || null
  const otherInitial = otherName[0].toUpperCase()
  const myName       = myProfile?.full_name || currentUser?.email || 'Me'
  const myAvatar     = myProfile?.avatar_url || null
  const myInitial    = myName[0].toUpperCase()

  function Avatar({ url, initial, size = 36, isMine = false }) {
    return (
      <div style={{
        width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
        background: isMine ? 'linear-gradient(135deg,#22a05e,#1a7a4a)' : 'linear-gradient(135deg,#3b82f6,#2563eb)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
      }}>
        {url
          ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : <span style={{ fontSize: size * 0.4, fontWeight: '800', color: '#fff' }}>{initial}</span>
        }
      </div>
    )
  }

  // ── Render helpers ───────────────────────────────────────────────────────
  function renderCallMessage(msg) {
    const isMine = msg.from_user === currentUser?.id
    const isVideo = msg.call_type === 'video'
    const missed = msg.call_status === 'missed'
    const ended  = msg.call_status === 'ended'
    if (!missed && !ended) return null
    return (
      <div style={{ ...S.callMsgBubble, background: isMine ? 'rgba(255,255,255,0.12)' : '#f0f4f1' }}>
        <span style={{ fontSize: 18 }}>{isVideo ? '📹' : '📞'}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: '600', color: isMine ? '#fff' : '#0f1410' }}>
            {isVideo ? 'Video call' : 'Voice call'}
          </div>
          <div style={{ fontSize: 11, color: missed ? '#ef4444' : (isMine ? 'rgba(255,255,255,0.55)' : '#888') }}>
            {missed ? '📵 Missed' : (msg.call_duration ? formatTime(msg.call_duration) : 'Ended')}
          </div>
        </div>
      </div>
    )
  }

  function renderVoiceNote(msg) {
    const { id, media_url: url } = msg
    const isMine    = msg.from_user === currentUser?.id
    const progress  = audioProgress[id] || 0
    const duration  = audioDuration[id] || 0
    const isPlaying = playingId === id
    return (
      <div style={{ ...S.voiceNote, background: isMine ? 'rgba(255,255,255,0.15)' : '#edf7f1' }}>
        <audio
          ref={el => {
            if (el) {
              audioRefs.current[id] = el
              el.onloadedmetadata = () => setAudioDuration(d => ({ ...d, [id]: el.duration }))
            }
          }}
          src={url}
        />
        <button
          style={{ ...S.playBtn, background: isMine ? 'rgba(255,255,255,0.22)' : '#1a7a4a' }}
          onClick={() => toggleAudio(id)}
        >
          <span style={{ fontSize: 13, color: '#fff' }}>{isPlaying ? '⏸' : '▶'}</span>
        </button>
        <div style={S.voiceBody}>
          <div style={S.waveTrack}>
            {Array(28).fill(0).map((_, i) => (
              <div key={i} style={{
                width: '3px', borderRadius: '2px',
                height: `${6 + Math.sin(i * 0.8) * 5 + Math.cos(i * 0.4) * 4}px`,
                background: progress * 28 > i
                  ? (isMine ? '#5de89e' : '#1a7a4a')
                  : (isMine ? 'rgba(255,255,255,0.3)' : '#c0d8c8'),
                transition: 'background 0.1s', cursor: 'pointer',
              }} onClick={() => { const a = audioRefs.current[id]; if (a?.duration) a.currentTime = (i / 28) * a.duration }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.55)' : '#888' }}>
              {isPlaying ? formatTime(Math.floor(duration * progress)) : duration ? formatTime(Math.floor(duration)) : '0:00'}
            </span>
            <span style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.4)' : '#aaa' }}>🎤</span>
          </div>
        </div>
      </div>
    )
  }

  function renderMedia(msg) {
    if (msg.call_type) return renderCallMessage(msg)
    const { media_type: type, media_url: url } = msg
    if (!url) return null
    if (type === 'image') return <img src={url} alt="" style={S.mediaImg} onClick={() => window.open(url)} />
    if (type === 'video') return <video src={url} controls style={S.mediaVideo} />
    if (type === 'audio') return renderVoiceNote(msg)
    return <a href={url} target="_blank" rel="noreferrer" style={{ color: '#5de89e', fontSize: 13 }}>📎 File</a>
  }

  if (loading) return (
    <div style={S.loadCenter}>
      <div style={S.spinner} />
    </div>
  )

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div style={S.page}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes ringPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(26,122,74,0.4)}50%{transform:scale(1.06);box-shadow:0 0 0 16px rgba(26,122,74,0)}}
        @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes ripple{0%{transform:scale(1);opacity:0.6}100%{transform:scale(2.2);opacity:0}}
        @keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes typingDot{0%,80%,100%{transform:scale(0.6);opacity:0.4}40%{transform:scale(1);opacity:1}}
        @keyframes onlinePulse{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,0.5)}50%{box-shadow:0 0 0 4px rgba(34,197,94,0)}}
        textarea:focus{outline:none;border-color:#1a7a4a !important;}
        .msg-row:hover .reply-btn{opacity:1!important}
        .emoji-btn:hover{transform:scale(1.25);transition:transform 0.1s}
      `}</style>

      {/* ── Top bar ── */}
      <div style={S.topbar}>
        <button style={S.back} onClick={() => navigate(isServiceChat ? '/services' : '/chats')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2.5" strokeLinecap="round">
            <path d="M19 12H5M12 5l-7 7 7 7" />
          </svg>
        </button>

        <div style={S.topInfo}>
          {/* Avatar with online dot */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar url={otherAvatar} initial={otherInitial} size={42} />
            <div style={{
              ...S.onlineDot,
              background: otherOnline ? '#22c55e' : '#9ca3af',
              boxShadow: otherOnline ? '0 0 0 2px #fff' : '0 0 0 2px #fff',
              animation: otherOnline ? 'onlinePulse 2s infinite' : 'none',
            }} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.topName}>{otherName}</div>
            <div style={S.topStatus}>
              {otherTyping ? (
                <span style={{ color: '#1a7a4a', fontWeight: '600', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span>typing</span>
                  <span style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                    {[0, 0.2, 0.4].map((d, i) => (
                      <span key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#1a7a4a', display: 'inline-block', animation: `typingDot 1.2s ${d}s infinite` }} />
                    ))}
                  </span>
                </span>
              ) : otherOnline ? (
                <span style={{ color: '#22c55e', display: 'flex', alignItems: 'center', gap: 4 }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                  Online
                </span>
              ) : otherLastSeen ? (
                <span style={{ color: '#9ca3af' }}>last seen {lastSeenLabel(otherLastSeen)}</span>
              ) : (
                <span style={{ color: '#9ca3af' }}>Offline</span>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button style={S.callBtn} onClick={() => startCall('voice')} disabled={callState !== 'idle'}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2" strokeLinecap="round">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.03 1.19 2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92v2z" />
            </svg>
          </button>
          <button style={S.callBtn} onClick={() => startCall('video')} disabled={callState !== 'idle'}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2" strokeLinecap="round">
              <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Context bars ── */}
      {isServiceChat && service ? (
        <div style={S.serviceBar}>
          <div style={S.serviceBarIcon}>
            {service.media_urls?.[0]
              ? <img src={service.media_urls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} />
              : <span style={{ fontSize: 20 }}>🔧</span>}
          </div>
          <div style={S.ctxInfo}>
            <div style={{ ...S.ctxTag, color: '#1a7a4a', background: '#e6f7ee' }}>🔧 SERVICE</div>
            <div style={S.ctxTitle}>{service.name}</div>
            <div style={S.ctxSub}>{service.rate} · {service.city}</div>
          </div>
        </div>
      ) : listing ? (
        <div style={S.serviceBar} onClick={() => navigate(`/listing/${listing.id}`)}>
          {listing.images?.[0]
            ? <img src={listing.images[0]} alt="" style={{ ...S.serviceBarIcon, objectFit: 'cover' }} />
            : <div style={S.serviceBarIcon}><span style={{ fontSize: 20 }}>🛒</span></div>}
          <div style={S.ctxInfo}>
            <div style={{ ...S.ctxTag, color: '#2563eb', background: '#eff6ff' }}>🛍️ LISTING</div>
            <div style={S.ctxTitle}>{listing.title}</div>
            <div style={S.ctxSub}>MWK {listing.price?.toLocaleString()}</div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2.5" strokeLinecap="round">
            <path d="M9 18l6-6-6-6" />
          </svg>
        </div>
      ) : null}

      {/* ── Booking status ── */}
      {isServiceChat && booking && (() => {
        const cfg = {
          pending:   { bg: '#fff8e6', color: '#d4920a', icon: '⏳', text: 'Booking pending' },
          confirmed: { bg: '#e6f7ee', color: '#1a7a4a', icon: '✅', text: 'Booking confirmed' },
          completed: { bg: '#e8eaff', color: '#3b4dd4', icon: '🏁', text: 'Job completed' },
          cancelled: { bg: '#fef0f0', color: '#c0392b', icon: '❌', text: 'Cancelled' },
        }[booking.status] || {}
        return (
          <div style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.color}22`, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 15 }}>{cfg.icon}</span>
            <span style={{ fontSize: 12, color: '#555', flex: 1 }}>{cfg.text}</span>
            {booking.date && <span style={{ fontSize: 11, color: cfg.color, fontWeight: '700' }}>📆 {booking.date}</span>}
          </div>
        )
      })()}

      {/* ── Call overlays ── */}
      {(callState === 'calling' || callState === 'ringing') && (
        <div style={S.callOverlay}>
          <div style={S.callCard}>
            <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 20px' }}>
              {callState === 'ringing' && <><div style={{ ...S.ripple, animationDelay: '0s' }} /><div style={{ ...S.ripple, animationDelay: '0.5s' }} /></>}
              <div style={S.callAvatarWrap}><Avatar url={otherAvatar} initial={otherInitial} size={90} /></div>
            </div>
            <div style={S.callName}>{otherName}</div>
            <div style={S.callStatus}>{callState === 'calling' ? (callType === 'video' ? '📹 Starting video call…' : '📞 Calling…') : <span style={{ animation: 'blink 1.2s infinite' }}>🔔 Ringing…</span>}</div>
            <div style={{ marginTop: 36 }}>
              <button style={S.hangUpBtn} onClick={hangUp}><HangupIcon /></button>
            </div>
          </div>
        </div>
      )}

      {callState === 'receiving' && (
        <div style={{ ...S.callOverlay, animation: 'slideUp 0.3s ease' }}>
          <div style={S.callCard}>
            <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 20px' }}>
              <div style={{ ...S.ripple, animationDelay: '0s' }} /><div style={{ ...S.ripple, animationDelay: '0.6s' }} />
              <div style={{ ...S.callAvatarWrap, animation: 'ringPulse 1.4s infinite' }}><Avatar url={otherAvatar} initial={otherInitial} size={90} /></div>
            </div>
            <div style={S.callName}>{otherName}</div>
            <div style={S.callStatus}>{callType === 'video' ? '📹 Incoming video call' : '📞 Incoming voice call'}</div>
            <div style={{ display: 'flex', gap: 40, marginTop: 36, justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <button style={S.declineBtn} onClick={declineCall}><HangupIcon /></button>
                <div style={S.callBtnLabel}>Decline</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <button style={S.answerBtn} onClick={answerCall}><AnswerIcon /></button>
                <div style={S.callBtnLabel}>Answer</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {callState === 'in-call' && (
        <div style={S.callOverlay}>
          {callType === 'video' && (
            <div style={{ position: 'absolute', inset: 0 }}>
              <video ref={remoteVideoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <video ref={localVideoRef} autoPlay playsInline muted style={{ position: 'absolute', bottom: 100, right: 16, width: 110, height: 150, objectFit: 'cover', borderRadius: 12, border: '2px solid rgba(255,255,255,0.3)', background: '#000' }} />
            </div>
          )}
          {callType === 'voice' && (
            <div style={S.callCard}>
              <Avatar url={otherAvatar} initial={otherInitial} size={90} />
              <div style={S.callName}>{otherName}</div>
              <div style={{ fontSize: 22, color: '#5de89e', fontWeight: '700', marginTop: 12, fontVariantNumeric: 'tabular-nums' }}>{formatTime(callDuration)}</div>
              <video ref={remoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />
              <video ref={localVideoRef} autoPlay playsInline muted style={{ display: 'none' }} />
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 40, display: 'flex', gap: 16, alignItems: 'center', zIndex: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <button style={{ ...S.ctrlBtn, background: isMuted ? '#ef4444' : 'rgba(255,255,255,0.2)' }} onClick={toggleMute}>
                <span style={{ fontSize: 22 }}>{isMuted ? '🔇' : '🎤'}</span>
              </button>
              <div style={S.callBtnLabel}>{isMuted ? 'Unmute' : 'Mute'}</div>
            </div>
            {callType === 'video' && (
              <div style={{ textAlign: 'center' }}>
                <button style={{ ...S.ctrlBtn, background: isCamOff ? '#ef4444' : 'rgba(255,255,255,0.2)' }} onClick={toggleCam}>
                  <span style={{ fontSize: 22 }}>{isCamOff ? '📷' : '📹'}</span>
                </button>
                <div style={S.callBtnLabel}>Camera</div>
              </div>
            )}
            {callType === 'video' && (
              <div style={{ textAlign: 'center' }}>
                <button style={{ ...S.ctrlBtn, background: 'rgba(255,255,255,0.2)' }} onClick={switchCamera}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                    <path d="M20 7l-1.5-2h-5L12 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" stroke="white" strokeWidth="0" fill="none"/>
                    <path d="M20 7l-1.5-2h-5L12 7H4a2 2 0 00-2 2v10a2 2 0 002 2h16a2 2 0 002-2V9a2 2 0 00-2-2z" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.5"/>
                    <path d="M12 10.5a3.5 3.5 0 100 7 3.5 3.5 0 000-7z" fill="white"/>
                    <path d="M18 8.5l1.5 1.5-1.5 1.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                    <path d="M6 8.5L4.5 10 6 11.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                  </svg>
                </button>
                <div style={S.callBtnLabel}>Flip</div>
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <button style={{ ...S.ctrlBtn, background: '#ef4444' }} onClick={hangUp}><HangupIcon /></button>
              <div style={S.callBtnLabel}>End</div>
            </div>
            {callType === 'video' && <div style={{ color: '#fff', fontSize: 13, fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>{formatTime(callDuration)}</div>}
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div style={S.messages} onClick={() => setShowEmoji(false)}>
        {messages.length === 0 && !isServiceChat && (
          <div style={S.emptyWrap}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>👋</div>
            <p style={{ fontSize: 17, fontWeight: '800', color: '#0f1410', marginBottom: 6 }}>Say hello!</p>
            <p style={{ fontSize: 13, color: '#888', lineHeight: '1.7', maxWidth: 240, textAlign: 'center' }}>Ask about the item, negotiate price, or arrange a meetup</p>
          </div>
        )}

        {messages.map((msg, i) => {
          const isMine   = msg.from_user === currentUser?.id
          const showDate = i === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString()
          const nextSame = i < messages.length - 1 && messages[i + 1].from_user === msg.from_user
          const prevSame = i > 0 && messages[i - 1].from_user === msg.from_user && !showDate
          const isLast   = !nextSame

          // Decode reply prefix from body
          const decoded = decodeReply(msg.body)

          return (
            <div key={msg.id}>
              {showDate && (
                <div style={S.dateDivider}>
                  <span style={S.dateLabel}>
                    {new Date(msg.created_at).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}
                  </span>
                </div>
              )}

              <div
                className="msg-row"
                style={{ display: 'flex', justifyContent: isMine ? 'flex-end' : 'flex-start', alignItems: 'flex-end', gap: 8, marginBottom: nextSame ? '2px' : '8px', paddingLeft: isMine ? 48 : 0, paddingRight: isMine ? 0 : 48, position: 'relative' }}
              >
                {!isMine && (
                  <div style={{ opacity: isLast ? 1 : 0, flexShrink: 0 }}>
                    <Avatar url={otherAvatar} initial={otherInitial} size={30} />
                  </div>
                )}

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: isMine ? 'flex-end' : 'flex-start', maxWidth: '74%' }}>
                  {/* Reply preview — decoded from body */}
                  {decoded.replyPreview && (
                    <div style={{
                      ...S.replyPreview,
                      background: isMine ? 'rgba(255,255,255,0.12)' : '#e8f0eb',
                      color: isMine ? 'rgba(255,255,255,0.7)' : '#637068',
                      alignSelf: isMine ? 'flex-end' : 'flex-start',
                    }}>
                      ↩ {decoded.replyPreview}
                    </div>
                  )}

                  <div style={{
                    ...S.bubble,
                    ...(isMine ? S.bubbleMine : S.bubbleOther),
                    borderBottomRightRadius: isMine ? (prevSame ? '18px' : '4px') : '18px',
                    borderBottomLeftRadius: !isMine ? (prevSame ? '18px' : '4px') : '18px',
                    borderTopRightRadius: isMine ? (nextSame ? '4px' : '18px') : '18px',
                    borderTopLeftRadius: !isMine ? (nextSame ? '4px' : '18px') : '18px',
                  }}>
                    {renderMedia(msg)}
                    {/* Show decoded body (without reply prefix) */}
                    {decoded.body && !msg.call_type && <div style={S.bubbleText}>{decoded.body}</div>}
                    <div style={{ ...S.bubbleTime, color: isMine ? 'rgba(255,255,255,0.5)' : '#bbb' }}>
                      {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      {isMine && (
                        <span style={{ marginLeft: 3, color: msg.read ? '#5de89e' : 'rgba(255,255,255,0.45)' }}>
                          {msg.read ? '✓✓' : '✓'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <button
                  className="reply-btn"
                  style={{ ...S.replyBtn, opacity: 0, order: isMine ? -1 : 1 }}
                  onClick={() => { setReplyTo(msg); inputRef.current?.focus() }}
                  title="Reply"
                >
                  ↩
                </button>

                {isMine && (
                  <div style={{ opacity: isLast ? 1 : 0, flexShrink: 0 }}>
                    <Avatar url={myAvatar} initial={myInitial} size={30} isMine />
                  </div>
                )}
              </div>
            </div>
          )
        })}

        {/* Typing indicator bubble */}
        {otherTyping && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 8 }}>
            <Avatar url={otherAvatar} initial={otherInitial} size={30} />
            <div style={{ ...S.bubble, ...S.bubbleOther, padding: '10px 14px', animation: 'fadeIn 0.2s ease' }}>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center', height: 16 }}>
                {[0, 0.2, 0.4].map((d, i) => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: '#94a3b8', animation: `typingDot 1.2s ${d}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {uploading && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'flex-end', gap: 8, marginBottom: 8 }}>
            <div style={{ ...S.bubble, ...S.bubbleMine }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[0, 0.2, 0.4].map((d, i) => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.8)', animation: `pulse 1s ${d}s infinite` }} />)}
              </div>
            </div>
            <Avatar url={myAvatar} initial={myInitial} size={30} isMine />
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Preview modal ── */}
      {preview && (
        <div style={S.previewOverlay}>
          <div style={S.previewCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 17, fontWeight: '700', color: '#0f1410' }}>Preview</span>
              <button style={{ background: '#f4f8f5', border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 16 }} onClick={() => setPreview(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', background: '#f4f8f5', borderRadius: 16, padding: 12, marginBottom: 16, minHeight: 80 }}>
              {preview.type === 'image' && <img src={preview.url} alt="" style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: 12, objectFit: 'contain' }} />}
              {preview.type === 'video' && <video src={preview.url} controls style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: 12 }} />}
              {preview.type === 'audio' && <div style={{ textAlign: 'center', padding: 20 }}><div style={{ fontSize: 48, marginBottom: 12 }}>🎵</div><audio src={preview.url} controls style={{ marginTop: 12, width: '100%' }} /></div>}
            </div>
            <input
              style={{ width: '100%', border: '1.5px solid #d8e5dc', borderRadius: 12, padding: '10px 14px', fontSize: 15, outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', marginBottom: 12 }}
              placeholder="Add a caption..." value={preview.caption}
              onChange={e => setPreview(p => ({ ...p, caption: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') uploadAndSend(preview.file, preview.type, preview.caption) }}
            />
            <button
              style={{ width: '100%', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff', border: 'none', borderRadius: 14, padding: 14, fontSize: 16, fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              onClick={() => uploadAndSend(preview.file, preview.type, preview.caption)}
            >
              {uploading ? <div style={{ width: 18, height: 18, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : '➤ Send'}
            </button>
          </div>
        </div>
      )}

      {/* ── Emoji Picker ── */}
      {showEmoji && (
        <div ref={emojiPickerRef} style={S.emojiPicker}>
          <div style={{ display: 'flex', gap: 4, padding: '8px 8px 0', borderBottom: '1px solid #f0f0f0', marginBottom: 6 }}>
            {Object.keys(EMOJI_CATEGORIES).map(cat => (
              <button key={cat} onClick={() => setEmojiTab(cat)} style={{
                background: emojiTab === cat ? '#e6f7ee' : 'none', border: 'none', borderRadius: 8,
                padding: '4px 8px', fontSize: 18, cursor: 'pointer',
                borderBottom: emojiTab === cat ? '2px solid #1a7a4a' : '2px solid transparent',
              }}>{cat}</button>
            ))}
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2, padding: '6px 8px 8px', maxHeight: 180, overflowY: 'auto' }}>
            {EMOJI_CATEGORIES[emojiTab].map(emoji => (
              <button
                key={emoji}
                className="emoji-btn"
                style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: '3px 4px', borderRadius: 6, lineHeight: 1 }}
                onClick={() => {
                  const pos = inputRef.current?.selectionStart ?? newMsg.length
                  const next = newMsg.slice(0, pos) + emoji + newMsg.slice(pos)
                  setNewMsg(next)
                  handleTyping(next)
                  setTimeout(() => {
                    inputRef.current?.focus()
                    inputRef.current?.setSelectionRange(pos + emoji.length, pos + emoji.length)
                  }, 0)
                }}
              >{emoji}</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Reply banner ── */}
      {replyTo && (
        <div style={S.replyBanner}>
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
            <span style={{ fontSize: 11, fontWeight: '700', color: '#1a7a4a', marginBottom: 2 }}>
              Replying to {replyTo.from_user === currentUser?.id ? 'yourself' : otherName}
            </span>
            <span style={{ fontSize: 12, color: '#637068', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {decodeReply(replyTo.body).body || (replyTo.media_type === 'audio' ? '🎤 Voice note' : replyTo.media_type === 'image' ? '📷 Photo' : '📎 File')}
            </span>
          </div>
          <button style={{ background: 'none', border: 'none', fontSize: 18, color: '#888', cursor: 'pointer', padding: '0 4px' }} onClick={() => setReplyTo(null)}>✕</button>
        </div>
      )}

      {/* ── Recording bar ── */}
      {recording && (
        <div style={S.recordingBar}>
          <button style={S.cancelRecBtn} onClick={cancelRecording}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 2, height: 40, overflow: 'hidden' }}>
            {waveHeights.map((h, i) => (
              <div key={i} style={{ width: '3px', height: `${h}px`, borderRadius: '2px', background: `hsl(${140 + i * 2},60%,${40 + i % 4 * 5}%)`, transition: 'height 0.05s ease' }} />
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#e74c3c', animation: 'pulse 1s infinite' }} />
            <span style={{ fontSize: 14, fontWeight: '700', color: '#1a7a4a', minWidth: 38 }}>{formatTime(recordingTime)}</span>
          </div>
          <button style={{ background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', border: 'none', borderRadius: '50%', width: 42, height: 42, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} onClick={stopRecording}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
          </button>
        </div>
      )}

      {/* ── Input bar ── */}
      {!recording && callState === 'idle' && (
        <div style={S.inputBar}>
          <div style={{ display: 'flex', gap: '1px', alignItems: 'flex-end', paddingBottom: '2px' }}>
            <button style={S.attachBtn} onClick={() => pickFile('image/*', 'image')} title="Image">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#637068" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" />
              </svg>
            </button>
            <button style={S.attachBtn} onClick={() => pickFile('video/*', 'video')} title="Video">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#637068" strokeWidth="2" strokeLinecap="round">
                <polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" />
              </svg>
            </button>
          </div>

          <div style={{ flex: 1, position: 'relative' }}>
            <textarea
              ref={inputRef}
              style={S.input}
              placeholder={isServiceChat ? `Message about ${service?.name || 'service'}…` : 'Message…'}
              value={newMsg}
              onChange={e => {
                handleTyping(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyDown={handleKey}
              rows={1}
            />
          </div>

          <button style={{ ...S.attachBtn, color: showEmoji ? '#1a7a4a' : '#637068' }} onClick={e => { e.stopPropagation(); setShowEmoji(v => !v) }} title="Emoji">
            <span style={{ fontSize: 20 }}>😊</span>
          </button>

          {newMsg.trim()
            ? <button style={S.sendBtn} onClick={() => sendMessage(newMsg)}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
              </button>
            : <button style={S.micBtn} onClick={startRecording} title="Voice note">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#637068" strokeWidth="2" strokeLinecap="round">
                  <rect x="9" y="2" width="6" height="12" rx="3" />
                  <path d="M5 10a7 7 0 0014 0" />
                  <line x1="12" y1="19" x2="12" y2="22" />
                  <line x1="8" y1="22" x2="16" y2="22" />
                </svg>
              </button>
          }
        </div>
      )}
    </div>
  )
}

// ── Icon components ──────────────────────────────────────────────────────────
function HangupIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <path d="M23.71 16.67C22.69 15.65 21.38 15.1 20 15.1s-2.69.55-3.71 1.57l-2.15 2.15c-3.63-1.97-6.99-5.33-8.96-8.96l2.15-2.15C8.45 6.69 9 5.38 9 4s-.55-2.69-1.57-3.71C6.41-.71 5.13-1.3 3.8-1.3c-1.33 0-2.63.57-3.5 1.57l-1.5 1.5C-3.2 4.27-1.66 10.17 3.3 15.12c4.96 4.97 10.86 6.51 13.35 4.5l1.5-1.5c.98-.87 1.55-2.13 1.55-3.45 0-1.33-.57-2.63-1.99-3.5z" />
    </svg>
  )
}
function AnswerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
    </svg>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────
const S = {
  page: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#f0f4f1', fontFamily: 'system-ui, sans-serif', position: 'relative' },
  loadCenter: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' },
  spinner: { width: '28px', height: '28px', border: '3px solid #e0ebe3', borderTopColor: '#1a7a4a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  topbar: { background: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'space-between', borderBottom: '1px solid #e8f0eb', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  back: { background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: 8, flexShrink: 0 },
  topInfo: { display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  onlineDot: { position: 'absolute', bottom: 1, right: 1, width: 12, height: 12, borderRadius: '50%', transition: 'background 0.3s' },
  topName: { fontSize: '15px', fontWeight: '700', color: '#0f1410', lineHeight: 1.2 },
  topStatus: { fontSize: '12px', marginTop: 2, display: 'flex', alignItems: 'center' },
  callBtn: { background: '#f0f4f1', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 },
  serviceBar: { background: '#fff', borderBottom: '1px solid #e8f0eb', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, cursor: 'pointer' },
  serviceBarIcon: { width: 44, height: 44, borderRadius: 10, background: '#e6f7ee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  ctxInfo: { flex: 1, minWidth: 0 },
  ctxTag: { fontSize: '9px', fontWeight: '800', letterSpacing: '0.8px', marginBottom: 1, display: 'inline-block', padding: '1px 5px', borderRadius: 4 },
  ctxTitle: { fontSize: '13px', fontWeight: '600', color: '#0f1410', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  ctxSub: { fontSize: '11px', color: '#1a7a4a', fontWeight: '600' },
  messages: { flex: 1, overflowY: 'auto', padding: '14px 12px 8px', display: 'flex', flexDirection: 'column' },
  emptyWrap: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px' },
  dateDivider: { display: 'flex', justifyContent: 'center', margin: '14px 0 10px' },
  dateLabel: { background: '#dde8e0', color: '#637068', fontSize: '11px', fontWeight: '600', borderRadius: 10, padding: '4px 12px' },
  bubble: { maxWidth: '100%', borderRadius: '18px', padding: '9px 13px', wordBreak: 'break-word', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' },
  bubbleMine: { background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff' },
  bubbleOther: { background: '#fff', color: '#0f1410' },
  bubbleText: { fontSize: '15px', lineHeight: '1.5' },
  bubbleTime: { fontSize: '10px', marginTop: '4px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 },
  replyPreview: { fontSize: 11, borderRadius: '8px 8px 0 0', padding: '4px 10px', marginBottom: -4, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', borderLeft: '3px solid #1a7a4a' },
  replyBtn: { background: '#f0f4f1', border: 'none', borderRadius: '50%', width: 28, height: 28, cursor: 'pointer', fontSize: 13, color: '#637068', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'opacity 0.15s' },
  callMsgBubble: { display: 'flex', alignItems: 'center', gap: 10, borderRadius: 12, padding: '10px 12px', marginBottom: 4 },
  mediaImg: { width: '100%', maxWidth: '240px', borderRadius: 12, cursor: 'pointer', display: 'block', marginBottom: 5 },
  mediaVideo: { width: '100%', maxWidth: '240px', borderRadius: 12, display: 'block', marginBottom: 5 },
  voiceNote: { display: 'flex', alignItems: 'center', gap: 10, borderRadius: 14, padding: '10px 12px', minWidth: '200px', marginBottom: 4 },
  playBtn: { width: 36, height: 36, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  voiceBody: { flex: 1 },
  waveTrack: { display: 'flex', alignItems: 'center', gap: '2px', height: 28, marginBottom: 4 },
  emojiPicker: { position: 'absolute', bottom: '70px', left: '8px', right: '8px', background: '#fff', borderRadius: 16, boxShadow: '0 -4px 24px rgba(0,0,0,0.12)', zIndex: 200, maxWidth: '480px', overflow: 'hidden', animation: 'slideUp 0.2s ease' },
  replyBanner: { background: '#f0f7f3', borderTop: '1px solid #d4ead9', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 },
  recordingBar: { background: '#fff', borderTop: '2px solid #e8f0eb', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 },
  cancelRecBtn: { background: '#fef0f0', border: 'none', borderRadius: '50%', width: 38, height: 38, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  inputBar: { background: '#fff', borderTop: '1px solid #eef3ef', padding: '8px 10px', display: 'flex', alignItems: 'flex-end', gap: '4px', flexShrink: 0, position: 'relative' },
  attachBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  input: { width: '100%', border: '1.5px solid #e0ebe3', borderRadius: 22, padding: '10px 14px', fontSize: 15, resize: 'none', fontFamily: 'inherit', maxHeight: '120px', background: '#f8fbf9', lineHeight: '1.45', display: 'block', boxSizing: 'border-box', transition: 'border-color 0.2s' },
  sendBtn: { width: 44, height: 44, background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 3px 10px rgba(26,122,74,0.4)' },
  micBtn: { width: 44, height: 44, background: '#f4f8f5', border: '1.5px solid #e0ebe3', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  previewOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 },
  previewCard: { background: '#fff', borderRadius: '24px 24px 0 0', padding: 20, width: '100%', maxWidth: '480px' },
  callOverlay: { position: 'fixed', inset: 0, background: 'linear-gradient(160deg,#0a1a10,#0f2d1a)', zIndex: 3000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  callCard: { textAlign: 'center', padding: '40px 24px', zIndex: 1 },
  callAvatarWrap: { position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden' },
  ripple: { position: 'absolute', inset: -8, borderRadius: '50%', border: '2px solid rgba(26,122,74,0.5)', animation: 'ripple 2s ease-out infinite' },
  callName: { fontSize: '26px', fontWeight: '800', color: '#fff', marginBottom: 10 },
  callStatus: { fontSize: '15px', color: 'rgba(255,255,255,0.55)' },
  callBtnLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 8 },
  hangUpBtn: { width: 64, height: 64, borderRadius: '50%', background: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', boxShadow: '0 4px 20px rgba(239,68,68,0.5)' },
  declineBtn: { width: 64, height: 64, borderRadius: '50%', background: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(239,68,68,0.4)' },
  answerBtn: { width: 64, height: 64, borderRadius: '50%', background: '#1a7a4a', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(26,122,74,0.5)', animation: 'ringPulse 1.4s infinite' },
  ctrlBtn: { width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
}