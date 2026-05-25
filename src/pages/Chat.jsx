import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
  ]
}

function generateCallId(uid1, uid2) {
  return [uid1, uid2].sort().join('-') + '-' + Date.now()
}

export default function Chat() {
  const { userId, listingId } = useParams()
  const navigate = useNavigate()

  const [messages, setMessages] = useState([])
  const [newMsg, setNewMsg] = useState('')
  const [currentUser, setCurrentUser] = useState(null)
  const [otherUser, setOtherUser] = useState(null)
  const [listing, setListing] = useState(null)
  const [service, setService] = useState(null)
  const [booking, setBooking] = useState(null)
  const [isServiceChat, setIsServiceChat] = useState(false)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [waveHeights, setWaveHeights] = useState(Array(40).fill(2))
  const [playingId, setPlayingId] = useState(null)
  const [audioProgress, setAudioProgress] = useState({})
  const [audioDuration, setAudioDuration] = useState({})
  const [preview, setPreview] = useState(null)

  // WebRTC call state
  const [callState, setCallState] = useState('idle') // idle|calling|ringing|receiving|in-call
  const [callType, setCallType] = useState(null)
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isCamOff, setIsCamOff] = useState(false)

  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef = useRef(null)
  const callIdRef = useRef(null)
  const callChannelRef = useRef(null)  // broadcast channel for signaling
  const callTimerRef = useRef(null)
  const pendingCandidates = useRef([])
  const incomingOfferRef = useRef(null)
  const ringCtxRef = useRef(null)
  const currentUserRef = useRef(null)

  const bottomRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const analyserRef = useRef(null)
  const animFrameRef = useRef(null)
  const audioRefs = useRef({})
  const inputRef = useRef(null)
  const channelRef = useRef(null)

  useEffect(() => {
    init()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      if (callChannelRef.current) supabase.removeChannel(callChannelRef.current)
      clearInterval(callTimerRef.current)
    }
  }, [userId, listingId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── RING SOUNDS ────────────────────────────────────────────────────────────

  function playRingtone(type = 'outgoing') {
    stopRingSound()
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      let active = true
      ringCtxRef.current = { stop: () => { active = false; try { ctx.close() } catch(e){} } }

      if (type === 'outgoing') {
        const ring = () => {
          if (!active) return
          const beep = (freq, start, dur) => {
            const osc = ctx.createOscillator()
            const gain = ctx.createGain()
            osc.connect(gain); gain.connect(ctx.destination)
            osc.type = 'sine'; osc.frequency.value = freq
            gain.gain.setValueAtTime(0, ctx.currentTime + start)
            gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + start + 0.02)
            gain.gain.setValueAtTime(0.18, ctx.currentTime + start + dur - 0.02)
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + start + dur)
            osc.start(ctx.currentTime + start)
            osc.stop(ctx.currentTime + start + dur)
          }
          beep(480, 0, 0.18)
          beep(480, 0.22, 0.18)
          if (active) setTimeout(ring, 2200)
        }
        ring()
      } else {
        const ring = () => {
          if (!active) return
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.type = 'sine'
          osc.frequency.setValueAtTime(380, ctx.currentTime)
          osc.frequency.linearRampToValueAtTime(480, ctx.currentTime + 0.4)
          gain.gain.setValueAtTime(0, ctx.currentTime)
          gain.gain.linearRampToValueAtTime(0.22, ctx.currentTime + 0.05)
          gain.gain.setValueAtTime(0.22, ctx.currentTime + 0.35)
          gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.45)
          osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.45)
          if (active) setTimeout(ring, 1800)
        }
        ring()
      }
    } catch(e) {}
  }

  function playCallEndSound() {
    stopRingSound()
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const notes = [480, 360, 300]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sine'; osc.frequency.value = freq
        const t = ctx.currentTime + i * 0.15
        gain.gain.setValueAtTime(0.18, t)
        gain.gain.linearRampToValueAtTime(0, t + 0.12)
        osc.start(t); osc.stop(t + 0.15)
      })
    } catch(e) {}
  }

  function playConnectedSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      const notes = [380, 480]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sine'; osc.frequency.value = freq
        const t = ctx.currentTime + i * 0.12
        gain.gain.setValueAtTime(0.15, t)
        gain.gain.linearRampToValueAtTime(0, t + 0.1)
        osc.start(t); osc.stop(t + 0.12)
      })
    } catch(e) {}
  }

  function stopRingSound() {
    if (ringCtxRef.current) { ringCtxRef.current.stop(); ringCtxRef.current = null }
  }

  // ── BROADCAST SIGNALING (replaces postgres_changes for calls) ─────────────

  async function setupCallChannel(myId) {
    // Each user listens on their own broadcast channel
    const ch = supabase.channel(`call_broadcast_${myId}`)
      .on('broadcast', { event: 'ring' }, ({ payload }) => {
        console.log('📞 ring received in Chat:', payload)
        callIdRef.current = payload.callId
        incomingOfferRef.current = payload.offer
        setCallType(payload.callType)
        setCallState('receiving')
        playRingtone('incoming')
      })
      .on('broadcast', { event: 'ringing' }, () => {
        setCallState('ringing')
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (!pcRef.current) return
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(payload.answer))
        for (const c of pendingCandidates.current) {
          try { await pcRef.current.addIceCandidate(new RTCIceCandidate(c)) } catch(e){}
        }
        pendingCandidates.current = []
        stopRingSound()
        playConnectedSound()
        setCallState('in-call')
        startCallTimer()
      })
      .on('broadcast', { event: 'ice' }, async ({ payload }) => {
        if (!pcRef.current) return
        try {
          if (pcRef.current.remoteDescription) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate))
          } else {
            pendingCandidates.current.push(payload.candidate)
          }
        } catch(e) {}
      })
      .on('broadcast', { event: 'hangup' }, () => {
        playCallEndSound()
        endCallLocally()
      })
      .on('broadcast', { event: 'decline' }, () => {
        playCallEndSound()
        endCallLocally()
      })
      .subscribe((status) => {
        console.log('Call channel status:', status)
      })
    callChannelRef.current = ch
  }

  // Send a signal to the OTHER user's broadcast channel
  async function sendSignal(event, payload = {}) {
    const ch = supabase.channel(`call_broadcast_${userId}`)
    await ch.subscribe()
    await ch.send({ type: 'broadcast', event, payload: { ...payload, callId: callIdRef.current } })
    // Don't remove — reuse if possible, but for simplicity we remove after send
    setTimeout(() => supabase.removeChannel(ch), 2000)
  }

  // ── CALL ACTIONS ──────────────────────────────────────────────────────────

  async function startCall(type) {
    setCallType(type)
    setCallState('calling')
    playRingtone('outgoing')

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true, video: type === 'video'
    }).catch(() => null)
    if (!stream) { alert('Microphone/camera access denied'); endCallLocally(); return }

    localStreamRef.current = stream
    if (localVideoRef.current) localVideoRef.current.srcObject = stream

    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc
    stream.getTracks().forEach(t => pc.addTrack(t, stream))

    pc.ontrack = e => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]
    }
    pc.onicecandidate = async e => {
      if (e.candidate) await sendSignal('ice', { candidate: e.candidate })
    }

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    const callId = generateCallId(currentUserRef.current.id, userId)
    callIdRef.current = callId

    // Send ring via broadcast to the other user
    await sendSignal('ring', { offer, callType: type, fromUser: currentUserRef.current.id, callId })
  }

  async function answerCall() {
    stopRingSound()

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true, video: callType === 'video'
    }).catch(() => null)
    if (!stream) { alert('Microphone/camera access denied'); await declineCall(); return }

    localStreamRef.current = stream
    if (localVideoRef.current) localVideoRef.current.srcObject = stream

    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc
    stream.getTracks().forEach(t => pc.addTrack(t, stream))

    pc.ontrack = e => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]
    }
    pc.onicecandidate = async e => {
      if (e.candidate) await sendSignal('ice', { candidate: e.candidate })
    }

    await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current))
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    await sendSignal('answer', { answer })

    playConnectedSound()
    setCallState('in-call')
    startCallTimer()

    await sendMessage('', 'text', null, {
      call_type: callType, call_status: 'answered',
      body: callType === 'video' ? '📹 Video call' : '📞 Voice call'
    })
  }

  async function declineCall() {
    stopRingSound()
    await sendSignal('decline')
    await sendMessage('', 'text', null, {
      call_type: callType, call_status: 'missed',
      body: callType === 'video' ? '📹 Missed video call' : '📞 Missed call'
    })
    endCallLocally()
  }

  async function hangUp() {
    playCallEndSound()
    const dur = callDuration
    await sendSignal('hangup')
    await sendMessage('', 'text', null, {
      call_type: callType, call_status: 'ended', call_duration: dur,
      body: (callType === 'video' ? '📹 Video call' : '📞 Voice call') + ' · ' + formatTime(dur)
    })
    endCallLocally()
  }

  function endCallLocally() {
    stopRingSound()
    clearInterval(callTimerRef.current)
    pcRef.current?.close(); pcRef.current = null
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null
    pendingCandidates.current = []
    incomingOfferRef.current = null
    setCallState('idle')
    setCallDuration(0)
    setIsMuted(false); setIsCamOff(false)
  }

  function startCallTimer() {
    setCallDuration(0)
    callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)
  }

  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(m => !m)
  }

  function toggleCam() {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setIsCamOff(c => !c)
  }

  // ── INIT ──────────────────────────────────────────────────────────────────

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    currentUserRef.current = user
    await supabase.from('users').upsert({ id: user.id, name: user.email }, { onConflict: 'id' })
    const { data: other } = await supabase.from('users').select('*').eq('id', userId).single()
    setOtherUser(other)

    // Set up broadcast call channel
    await setupCallChannel(user.id)

    // Pick up pending call if answered from GlobalCallListener
    const pendingRaw = sessionStorage.getItem('__pendingCall')
    if (pendingRaw) {
      try {
        const pending = JSON.parse(pendingRaw)
        sessionStorage.removeItem('__pendingCall')
        if (pending.fromUser === userId) {
          incomingOfferRef.current = pending.offer
          callIdRef.current = pending.callId
          setCallType(pending.callType)
          setCallState('receiving')
          playRingtone('incoming')
        }
      } catch(e) {}
    }

    let isService = false
    if (listingId && listingId !== 'undefined') {
      const { data: svc } = await supabase.from('services').select('*').eq('id', listingId).single()
      if (svc) {
        setService(svc); setIsServiceChat(true); isService = true
        const { data: bk } = await supabase.from('bookings').select('*')
          .eq('service_id', listingId)
          .or(`and(customer_id.eq.${user.id},provider_id.eq.${userId}),and(customer_id.eq.${userId},provider_id.eq.${user.id})`)
          .in('status', ['pending', 'confirmed'])
          .order('created_at', { ascending: false }).limit(1).single()
        if (bk) setBooking(bk)
      } else {
        const { data: lst } = await supabase.from('listings').select('*').eq('id', listingId).single()
        if (lst) setListing(lst)
      }
    }

    await loadMessages(user.id, isService)

    const readQuery = supabase.from('messages').update({ read: true }).eq('to_user', user.id).eq('from_user', userId)
    if (isService) readQuery.eq('service_id', listingId)
    else readQuery.eq('listing_id', listingId)
    await readQuery

    setLoading(false)

    const channelName = `chat_${[user.id, userId].sort().join('_')}_${listingId}`
    const channel = supabase.channel(channelName)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
        const msg = payload.new
        const relevant = (msg.from_user === user.id && msg.to_user === userId) ||
                         (msg.from_user === userId && msg.to_user === user.id)
        const sameContext = isService ? msg.service_id === listingId : msg.listing_id === listingId
        if (relevant && sameContext) {
          setMessages(prev => prev.find(m => m.id === msg.id) ? prev : [...prev, msg])
        }
      })
      .subscribe()
    channelRef.current = channel
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

  async function sendMessage(body, type = 'text', mediaUrl = null, extraFields = {}) {
    if (!body.trim() && !mediaUrl && !extraFields.call_status) return
    const { data: { user } } = await supabase.auth.getUser()
    const msgData = {
      from_user: user.id, to_user: userId,
      body: body.trim(), media_url: mediaUrl, media_type: type, read: false,
      ...extraFields
    }
    if (isServiceChat && listingId !== 'undefined') msgData.service_id = listingId
    else if (!isServiceChat && listingId !== 'undefined') msgData.listing_id = listingId
    const { error } = await supabase.from('messages').insert(msgData)
    if (error) { console.error(error); alert('Failed to send: ' + error.message); return }
    setNewMsg('')
    if (inputRef.current) inputRef.current.style.height = 'auto'
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
    setUploading(false); setPreview(null)
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
      setWaveHeights(Array(40).fill(0).map((_, i) => Math.max(2, (dataArray[Math.floor(i * dataArray.length / 40)] / 255) * 36)))
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

  function formatTime(s) {
    return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
  }

  function toggleAudio(id) {
    const audio = audioRefs.current[id]; if (!audio) return
    if (playingId === id) { audio.pause(); setPlayingId(null) }
    else {
      if (playingId && audioRefs.current[playingId]) audioRefs.current[playingId].pause()
      audio.play(); setPlayingId(id)
      audio.onended = () => setPlayingId(null)
      audio.ontimeupdate = () => setAudioProgress(p => ({ ...p, [id]: audio.duration ? audio.currentTime / audio.duration : 0 }))
      audio.onloadedmetadata = () => setAudioDuration(d => ({ ...d, [id]: audio.duration }))
    }
  }

  function handleKey(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(newMsg) }
  }

  function renderCallMessage(msg) {
    const isMine = msg.from_user === currentUser?.id
    const isVideo = msg.call_type === 'video'
    const icon = isVideo ? '📹' : '📞'
    const missed = msg.call_status === 'missed'
    const ended = msg.call_status === 'ended'
    const dur = msg.call_duration
    if (!missed && !ended) return null
    return (
      <div style={{ ...S.callMsgBubble, background: isMine ? 'rgba(255,255,255,0.15)' : '#f0f4f1' }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 13, fontWeight: '600', color: isMine ? '#fff' : '#0f1410' }}>
            {isVideo ? 'Video call' : 'Voice call'}
          </div>
          <div style={{ fontSize: 11, color: missed ? '#e74c3c' : (isMine ? 'rgba(255,255,255,0.6)' : '#888') }}>
            {missed ? '📵 Missed' : (dur ? formatTime(dur) : 'Ended')}
          </div>
        </div>
      </div>
    )
  }

  function renderVoiceNote(msg) {
    const { id, media_url: url } = msg
    const isMine = msg.from_user === currentUser?.id
    const progress = audioProgress[id] || 0
    const duration = audioDuration[id] || 0
    const isPlaying = playingId === id
    return (
      <div style={{ ...S.voiceNote, background: isMine ? 'rgba(255,255,255,0.18)' : '#edf7f1' }}>
        <audio ref={el => { if (el) { audioRefs.current[id] = el; el.onloadedmetadata = () => setAudioDuration(d => ({ ...d, [id]: el.duration })) } }} src={url} />
        <button style={{ ...S.playBtn, background: isMine ? 'rgba(255,255,255,0.25)' : '#1a7a4a' }} onClick={() => toggleAudio(id)}>
          <span style={{ fontSize: 14, color: '#fff' }}>{isPlaying ? '⏸' : '▶'}</span>
        </button>
        <div style={S.voiceBody}>
          <div style={S.waveTrack}>
            {Array(28).fill(0).map((_, i) => (
              <div key={i} style={{ width: '3px', borderRadius: '2px', height: `${6 + Math.sin(i * 0.8) * 5 + Math.cos(i * 0.4) * 4}px`, background: progress * 28 > i ? (isMine ? '#5de89e' : '#1a7a4a') : (isMine ? 'rgba(255,255,255,0.35)' : '#c0d8c8'), transition: 'background 0.1s', cursor: 'pointer' }}
                onClick={() => { const a = audioRefs.current[id]; if (a?.duration) a.currentTime = (i / 28) * a.duration }} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.6)' : '#888' }}>
              {isPlaying ? formatTime(Math.floor(duration * progress)) : duration ? formatTime(Math.floor(duration)) : '0:00'}
            </span>
            <span style={{ fontSize: 10, color: isMine ? 'rgba(255,255,255,0.5)' : '#aaa' }}>🎤</span>
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

  if (loading) return <div style={S.center}>Loading…</div>

  const callerName = otherUser?.name || otherUser?.email || 'User'
  const callerInitial = callerName[0].toUpperCase()

  return (
    <div style={S.page}>
      <style>{`
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.3}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes ringPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(26,122,74,0.4)}50%{transform:scale(1.06);box-shadow:0 0 0 16px rgba(26,122,74,0)}}
        @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.4}}
        @keyframes ripple{0%{transform:scale(1);opacity:0.6}100%{transform:scale(2.2);opacity:0}}
        textarea:focus{outline:none;border-color:#1a7a4a !important;}
      `}</style>

      {/* ── Top bar ── */}
      <div style={S.topbar}>
        <button style={S.back} onClick={() => navigate(isServiceChat ? '/services' : '/chats')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
        </button>
        <div style={S.topInfo}>
          <div style={S.avatar}>{callerInitial}</div>
          <div>
            <div style={S.name}>{callerName}</div>
            <div style={S.online}><span style={S.onlineDot} />Active now</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button style={S.callBtn} onClick={() => startCall('voice')} title="Voice call" disabled={callState !== 'idle'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2" strokeLinecap="round"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 9.81 19.79 19.79 0 01.03 1.19 2 2 0 012 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 14.92v2z" /></svg>
          </button>
          <button style={S.callBtn} onClick={() => startCall('video')} title="Video call" disabled={callState !== 'idle'}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg>
          </button>
        </div>
      </div>

      {/* ── Context bars ── */}
      {isServiceChat && service ? (
        <div style={S.serviceBar}>
          <div style={S.serviceBarIcon}>
            {service.media_urls?.[0] ? <img src={service.media_urls[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '10px' }} /> : <span style={{ fontSize: 20 }}>🔧</span>}
          </div>
          <div style={S.listingInfo}>
            <div style={{ ...S.listingTag, color: '#1a7a4a' }}>SERVICE</div>
            <div style={S.listingTitle}>{service.name}</div>
            <div style={S.listingPrice}>{service.rate} · {service.city}</div>
          </div>
        </div>
      ) : listing ? (
        <div style={S.listingBar} onClick={() => navigate(`/listing/${listing.id}`)}>
          {listing.images?.[0] ? <img src={listing.images[0]} alt="" style={S.listingThumb} /> : <div style={S.listingThumbPh}>🛒</div>}
          <div style={S.listingInfo}>
            <div style={S.listingTag}>LISTING</div>
            <div style={S.listingTitle}>{listing.title}</div>
            <div style={S.listingPrice}>MWK {listing.price?.toLocaleString()}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2.5" strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
        </div>
      ) : null}

      {/* ── Booking status ── */}
      {isServiceChat && booking && (() => {
        const cfg = { pending: { bg: '#fff8e6', color: '#d4920a', icon: '⏳', text: 'Booking pending' }, confirmed: { bg: '#e6f7ee', color: '#1a7a4a', icon: '✅', text: 'Booking confirmed' }, completed: { bg: '#e8eaff', color: '#3b4dd4', icon: '🏁', text: 'Job completed' }, cancelled: { bg: '#fef0f0', color: '#c0392b', icon: '❌', text: 'Cancelled' } }[booking.status] || {}
        return (
          <div style={{ background: cfg.bg, borderBottom: `1px solid ${cfg.color}22`, padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            <span style={{ fontSize: 16 }}>{cfg.icon}</span>
            <span style={{ fontSize: 12, color: '#555', flex: 1 }}>{cfg.text}</span>
            {booking.date && <span style={{ fontSize: 11, color: cfg.color, fontWeight: '700' }}>📆 {booking.date}</span>}
          </div>
        )
      })()}

      {/* ── OUTGOING / RINGING CALL OVERLAY ── */}
      {(callState === 'calling' || callState === 'ringing') && (
        <div style={S.callOverlay}>
          <div style={S.callCard}>
            <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 20px' }}>
              {callState === 'ringing' && <>
                <div style={{ ...S.ripple, animationDelay: '0s' }} />
                <div style={{ ...S.ripple, animationDelay: '0.5s' }} />
              </>}
              <div style={S.callAvatar}>{callerInitial}</div>
            </div>
            <div style={S.callName}>{callerName}</div>
            <div style={S.callStatus}>
              {callState === 'calling'
                ? (callType === 'video' ? '📹 Starting video call…' : '📞 Calling…')
                : <span style={{ animation: 'blink 1.2s infinite' }}>🔔 Ringing…</span>
              }
            </div>
            <div style={{ marginTop: 36 }}>
              <button style={S.hangUpBtn} onClick={hangUp}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M23.71 16.67C22.69 15.65 21.38 15.1 20 15.1s-2.69.55-3.71 1.57l-2.15 2.15c-3.63-1.97-6.99-5.33-8.96-8.96l2.15-2.15C8.45 6.69 9 5.38 9 4s-.55-2.69-1.57-3.71C6.41-.71 5.13-1.3 3.8-1.3c-1.33 0-2.63.57-3.5 1.57l-1.5 1.5C-3.2 4.27-1.66 10.17 3.3 15.12c4.96 4.97 10.86 6.51 13.35 4.5l1.5-1.5c.98-.87 1.55-2.13 1.55-3.45 0-1.33-.57-2.63-1.99-3.5z" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── INCOMING CALL OVERLAY ── */}
      {callState === 'receiving' && (
        <div style={{ ...S.callOverlay, animation: 'slideUp 0.3s ease' }}>
          <div style={S.callCard}>
            <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 20px' }}>
              <div style={{ ...S.ripple, animationDelay: '0s' }} />
              <div style={{ ...S.ripple, animationDelay: '0.6s' }} />
              <div style={{ ...S.callAvatar, animation: 'ringPulse 1.4s infinite' }}>{callerInitial}</div>
            </div>
            <div style={S.callName}>{callerName}</div>
            <div style={S.callStatus}>
              {callType === 'video' ? '📹 Incoming video call' : '📞 Incoming voice call'}
            </div>
            <div style={{ display: 'flex', gap: '40px', marginTop: 36, justifyContent: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <button style={S.declineBtn} onClick={declineCall}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M23.71 16.67C22.69 15.65 21.38 15.1 20 15.1s-2.69.55-3.71 1.57l-2.15 2.15c-3.63-1.97-6.99-5.33-8.96-8.96l2.15-2.15C8.45 6.69 9 5.38 9 4s-.55-2.69-1.57-3.71C6.41-.71 5.13-1.3 3.8-1.3c-1.33 0-2.63.57-3.5 1.57l-1.5 1.5C-3.2 4.27-1.66 10.17 3.3 15.12c4.96 4.97 10.86 6.51 13.35 4.5l1.5-1.5c.98-.87 1.55-2.13 1.55-3.45 0-1.33-.57-2.63-1.99-3.5z" /></svg>
                </button>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8 }}>Decline</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <button style={S.answerBtn} onClick={answerCall}>
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" /></svg>
                </button>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8 }}>Answer</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── IN-CALL OVERLAY ── */}
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
              <div style={S.callAvatar}>{callerInitial}</div>
              <div style={S.callName}>{callerName}</div>
              <div style={{ fontSize: 22, color: '#5de89e', fontWeight: '700', marginTop: 12, fontVariantNumeric: 'tabular-nums' }}>
                {formatTime(callDuration)}
              </div>
              <video ref={remoteVideoRef} autoPlay playsInline style={{ display: 'none' }} />
              <video ref={localVideoRef} autoPlay playsInline muted style={{ display: 'none' }} />
            </div>
          )}
          <div style={{ position: 'absolute', bottom: 40, display: 'flex', gap: 16, alignItems: 'center', zIndex: 10 }}>
            <div style={{ textAlign: 'center' }}>
              <button style={{ ...S.ctrlBtn, background: isMuted ? '#e74c3c' : 'rgba(255,255,255,0.2)' }} onClick={toggleMute}>
                <span style={{ fontSize: 22 }}>{isMuted ? '🔇' : '🎤'}</span>
              </button>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 6 }}>{isMuted ? 'Unmute' : 'Mute'}</div>
            </div>
            {callType === 'video' && (
              <div style={{ textAlign: 'center' }}>
                <button style={{ ...S.ctrlBtn, background: isCamOff ? '#e74c3c' : 'rgba(255,255,255,0.2)' }} onClick={toggleCam}>
                  <span style={{ fontSize: 22 }}>{isCamOff ? '📷' : '📹'}</span>
                </button>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 6 }}>Camera</div>
              </div>
            )}
            <div style={{ textAlign: 'center' }}>
              <button style={{ ...S.ctrlBtn, background: '#e74c3c' }} onClick={hangUp}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><path d="M23.71 16.67C22.69 15.65 21.38 15.1 20 15.1s-2.69.55-3.71 1.57l-2.15 2.15c-3.63-1.97-6.99-5.33-8.96-8.96l2.15-2.15C8.45 6.69 9 5.38 9 4s-.55-2.69-1.57-3.71C6.41-.71 5.13-1.3 3.8-1.3c-1.33 0-2.63.57-3.5 1.57l-1.5 1.5C-3.2 4.27-1.66 10.17 3.3 15.12c4.96 4.97 10.86 6.51 13.35 4.5l1.5-1.5c.98-.87 1.55-2.13 1.55-3.45 0-1.33-.57-2.63-1.99-3.5z" /></svg>
              </button>
              <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11, marginTop: 6 }}>End</div>
            </div>
            {callType === 'video' && (
              <div style={{ color: '#fff', fontSize: 13, fontWeight: '700', fontVariantNumeric: 'tabular-nums' }}>{formatTime(callDuration)}</div>
            )}
          </div>
        </div>
      )}

      {/* ── Messages ── */}
      <div style={S.messages}>
        {messages.length === 0 && !isServiceChat && (
          <div style={S.emptyWrap}>
            <div style={S.emptyIcon}>👋</div>
            <p style={S.emptyTitle}>Say hello!</p>
            <p style={S.emptySub}>Ask about the item, negotiate price, or arrange a meetup</p>
          </div>
        )}
        {messages.map((msg, i) => {
          const isMine = msg.from_user === currentUser?.id
          const showDate = i === 0 || new Date(msg.created_at).toDateString() !== new Date(messages[i - 1].created_at).toDateString()
          const grouped = i > 0 && (messages[i - 1].from_user === currentUser?.id) === isMine && !showDate
          return (
            <div key={msg.id}>
              {showDate && <div style={S.dateDivider}><span style={S.dateLabel}>{new Date(msg.created_at).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}</span></div>}
              <div style={{ ...S.msgRow, justifyContent: isMine ? 'flex-end' : 'flex-start', marginBottom: grouped ? '2px' : '6px' }}>
                {!isMine && <div style={{ ...S.msgAvatar, opacity: grouped ? 0 : 1 }}>{callerInitial}</div>}
                <div style={{ ...S.bubble, ...(isMine ? S.bubbleMine : S.bubbleOther), borderBottomRightRadius: isMine ? (grouped ? '18px' : '4px') : '18px', borderBottomLeftRadius: !isMine ? (grouped ? '18px' : '4px') : '18px' }}>
                  {renderMedia(msg)}
                  {msg.body && !msg.call_type && <div style={S.bubbleText}>{msg.body}</div>}
                  <div style={{ ...S.bubbleTime, color: isMine ? 'rgba(255,255,255,0.55)' : '#bbb' }}>
                    {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    {isMine && <span style={{ marginLeft: 3, color: msg.read ? '#5de89e' : 'rgba(255,255,255,0.5)' }}>{msg.read ? '✓✓' : '✓'}</span>}
                  </div>
                </div>
              </div>
            </div>
          )
        })}
        {uploading && (
          <div style={{ ...S.msgRow, justifyContent: 'flex-end' }}>
            <div style={{ ...S.bubble, ...S.bubbleMine }}>
              <div style={{ display: 'flex', gap: 4, padding: '2px 4px' }}>
                {[0, 0.2, 0.4].map((d, i) => <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'rgba(255,255,255,0.8)', animation: `pulse 1s ${d}s infinite` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── Preview modal ── */}
      {preview && (
        <div style={S.previewOverlay}>
          <div style={S.previewCard}>
            <div style={S.previewHeader}>
              <span style={S.previewTitle}>Preview</span>
              <button style={S.previewClose} onClick={() => setPreview(null)}>✕</button>
            </div>
            <div style={S.previewMedia}>
              {preview.type === 'image' && <img src={preview.url} alt="" style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: 12, objectFit: 'contain' }} />}
              {preview.type === 'video' && <video src={preview.url} controls style={{ maxWidth: '100%', maxHeight: '280px', borderRadius: 12 }} />}
              {preview.type === 'audio' && <div style={{ textAlign: 'center', padding: '20px' }}><div style={{ fontSize: 48, marginBottom: 12 }}>🎵</div><audio src={preview.url} controls style={{ marginTop: 12, width: '100%' }} /></div>}
            </div>
            <div style={S.previewCaptionWrap}>
              <input style={S.previewCaption} placeholder="Add a caption..." value={preview.caption}
                onChange={e => setPreview(p => ({ ...p, caption: e.target.value }))}
                onKeyDown={e => { if (e.key === 'Enter') uploadAndSend(preview.file, preview.type, preview.caption) }} />
            </div>
            <button style={S.previewSendBtn} onClick={() => uploadAndSend(preview.file, preview.type, preview.caption)}>
              {uploading ? <div style={{ width: 18, height: 18, border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} /> : '➤ Send'}
            </button>
          </div>
        </div>
      )}

      {/* ── Recording bar ── */}
      {recording && (
        <div style={S.recordingBar}>
          <button style={S.cancelRecBtn} onClick={cancelRecording}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#c0392b" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
          </button>
          <div style={S.waveContainer}>
            {waveHeights.map((h, i) => <div key={i} style={{ width: '3px', height: `${h}px`, borderRadius: '2px', background: `hsl(${140 + i * 2}, 60%, ${40 + i % 4 * 5}%)`, transition: 'height 0.05s ease' }} />)}
          </div>
          <div style={S.recInfo}><div style={S.recDot} /><span style={S.recTime}>{formatTime(recordingTime)}</span></div>
          <button style={S.sendRecBtn} onClick={stopRecording}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg>
          </button>
        </div>
      )}

      {/* ── Input bar ── */}
      {!recording && callState === 'idle' && (
        <div style={S.inputBar}>
          <div style={S.attachMenu}>
            <button style={S.attachBtn} onClick={() => pickFile('image/*', 'image')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#637068" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="M21 15l-5-5L5 21" /></svg></button>
            <button style={S.attachBtn} onClick={() => pickFile('video/*', 'video')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#637068" strokeWidth="2" strokeLinecap="round"><polygon points="23 7 16 12 23 17 23 7" /><rect x="1" y="5" width="15" height="14" rx="2" /></svg></button>
            <button style={S.attachBtn} onClick={() => pickFile('audio/*', 'audio')}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#637068" strokeWidth="2" strokeLinecap="round"><path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" /></svg></button>
          </div>
          <div style={S.inputWrap}>
            <textarea ref={inputRef} style={S.input}
              placeholder={isServiceChat ? `Message about ${service?.name || 'service'}…` : 'Message…'}
              value={newMsg}
              onChange={e => { setNewMsg(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px' }}
              onKeyDown={handleKey} rows={1} />
          </div>
          {newMsg.trim()
            ? <button style={S.sendBtn} onClick={() => sendMessage(newMsg)}><svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M2 21l21-9L2 3v7l15 2-15 2z" /></svg></button>
            : <button style={S.micBtn} onClick={startRecording}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#637068" strokeWidth="2" strokeLinecap="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0014 0" /><line x1="12" y1="19" x2="12" y2="22" /><line x1="8" y1="22" x2="16" y2="22" /></svg></button>
          }
        </div>
      )}
    </div>
  )
}

const S = {
  page: { display: 'flex', flexDirection: 'column', height: '100vh', background: '#f0f4f1', fontFamily: 'system-ui, sans-serif' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888' },
  topbar: { background: '#fff', padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #e8f0eb', flexShrink: 0, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  back: { background: 'none', border: 'none', cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center', borderRadius: 8, width: 36, height: 36 },
  topInfo: { display: 'flex', alignItems: 'center', gap: '10px', flex: 1 },
  avatar: { width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '17px', fontWeight: '800', flexShrink: 0 },
  name: { fontSize: '15px', fontWeight: '700', color: '#0f1410' },
  online: { fontSize: '11px', color: '#22a05e', fontWeight: '500', display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 },
  onlineDot: { width: 7, height: 7, borderRadius: '50%', background: '#22a05e' },
  callBtn: { background: '#f0f4f1', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  serviceBar: { background: '#fff', borderBottom: '1px solid #e8f0eb', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 },
  serviceBarIcon: { width: '44px', height: '44px', borderRadius: '10px', background: '#e6f7ee', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, overflow: 'hidden' },
  listingBar: { background: '#fff', borderBottom: '1px solid #eef3ef', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', flexShrink: 0 },
  listingThumb: { width: '44px', height: '44px', borderRadius: '10px', objectFit: 'cover', flexShrink: 0 },
  listingThumbPh: { width: '44px', height: '44px', borderRadius: '10px', background: '#e8f4ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', flexShrink: 0 },
  listingInfo: { flex: 1, minWidth: 0 },
  listingTag: { fontSize: '9px', fontWeight: '800', letterSpacing: '0.8px', marginBottom: 1 },
  listingTitle: { fontSize: '13px', fontWeight: '600', color: '#0f1410', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  listingPrice: { fontSize: '12px', color: '#1a7a4a', fontWeight: '700' },
  callOverlay: { position: 'fixed', inset: 0, background: 'linear-gradient(160deg,#0a1a10,#0f2d1a)', zIndex: 3000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  callCard: { textAlign: 'center', padding: '40px 24px', zIndex: 1 },
  callAvatar: { width: '90px', height: '90px', borderRadius: '50%', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff', fontSize: '36px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', inset: 0 },
  ripple: { position: 'absolute', inset: -8, borderRadius: '50%', border: '2px solid rgba(26,122,74,0.5)', animation: 'ripple 2s ease-out infinite' },
  callName: { fontSize: '26px', fontWeight: '800', color: '#fff', marginBottom: '10px' },
  callStatus: { fontSize: '15px', color: 'rgba(255,255,255,0.55)' },
  hangUpBtn: { width: '64px', height: '64px', borderRadius: '50%', background: '#e74c3c', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', boxShadow: '0 4px 20px rgba(231,76,60,0.5)' },
  declineBtn: { width: '64px', height: '64px', borderRadius: '50%', background: '#e74c3c', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(231,76,60,0.4)' },
  answerBtn: { width: '64px', height: '64px', borderRadius: '50%', background: '#1a7a4a', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(26,122,74,0.5)', animation: 'ringPulse 1.4s infinite' },
  ctrlBtn: { width: '56px', height: '56px', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  callMsgBubble: { display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '12px', padding: '10px 12px', marginBottom: '4px' },
  messages: { flex: 1, overflowY: 'auto', padding: '14px 12px', display: 'flex', flexDirection: 'column' },
  emptyWrap: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '60px 24px', textAlign: 'center' },
  emptyIcon: { fontSize: '56px', marginBottom: '14px' },
  emptyTitle: { fontSize: '18px', fontWeight: '800', color: '#0f1410', marginBottom: '8px' },
  emptySub: { fontSize: '13px', color: '#888', lineHeight: '1.7', maxWidth: 260 },
  dateDivider: { display: 'flex', justifyContent: 'center', margin: '14px 0 10px' },
  dateLabel: { background: '#dde8e0', color: '#637068', fontSize: '11px', fontWeight: '600', borderRadius: '10px', padding: '4px 12px' },
  msgRow: { display: 'flex', alignItems: 'flex-end', gap: '8px' },
  msgAvatar: { width: '28px', height: '28px', borderRadius: '50%', background: '#b8d8c4', color: '#1a7a4a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', flexShrink: 0 },
  bubble: { maxWidth: '76%', borderRadius: '18px', padding: '9px 13px', wordBreak: 'break-word', boxShadow: '0 1px 3px rgba(0,0,0,0.07)' },
  bubbleMine: { background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff' },
  bubbleOther: { background: '#fff', color: '#0f1410' },
  bubbleText: { fontSize: '15px', lineHeight: '1.5' },
  bubbleTime: { fontSize: '10px', marginTop: '4px', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2 },
  mediaImg: { width: '100%', maxWidth: '240px', borderRadius: '12px', cursor: 'pointer', display: 'block', marginBottom: '5px' },
  mediaVideo: { width: '100%', maxWidth: '240px', borderRadius: '12px', display: 'block', marginBottom: '5px' },
  voiceNote: { display: 'flex', alignItems: 'center', gap: '10px', borderRadius: '14px', padding: '10px 12px', minWidth: '210px', marginBottom: '4px' },
  playBtn: { width: '38px', height: '38px', borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  voiceBody: { flex: 1 },
  waveTrack: { display: 'flex', alignItems: 'center', gap: '2px', height: '28px', marginBottom: '4px' },
  previewOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 },
  previewCard: { background: '#fff', borderRadius: '24px 24px 0 0', padding: '20px', width: '100%', maxWidth: '480px' },
  previewHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  previewTitle: { fontSize: '17px', fontWeight: '700', color: '#0f1410' },
  previewClose: { background: '#f4f8f5', border: 'none', borderRadius: '50%', width: '32px', height: '32px', cursor: 'pointer', fontSize: '16px', color: '#637068' },
  previewMedia: { display: 'flex', justifyContent: 'center', marginBottom: 16, background: '#f4f8f5', borderRadius: 16, padding: 12, minHeight: 80 },
  previewCaptionWrap: { marginBottom: 12 },
  previewCaption: { width: '100%', border: '1.5px solid #d8e5dc', borderRadius: '12px', padding: '10px 14px', fontSize: '15px', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' },
  previewSendBtn: { width: '100%', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  recordingBar: { background: '#fff', borderTop: '2px solid #e8f0eb', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 },
  cancelRecBtn: { background: '#fef0f0', border: 'none', borderRadius: '50%', width: '38px', height: '38px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  waveContainer: { flex: 1, display: 'flex', alignItems: 'center', gap: '2px', height: '40px', overflow: 'hidden' },
  recInfo: { display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 },
  recDot: { width: '9px', height: '9px', borderRadius: '50%', background: '#e74c3c', animation: 'pulse 1s infinite' },
  recTime: { fontSize: '14px', fontWeight: '700', color: '#1a7a4a', minWidth: '38px' },
  sendRecBtn: { background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', border: 'none', borderRadius: '50%', width: '42px', height: '42px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  inputBar: { background: '#fff', borderTop: '1px solid #eef3ef', padding: '8px 10px', display: 'flex', alignItems: 'flex-end', gap: '6px', flexShrink: 0 },
  attachMenu: { display: 'flex', gap: '2px', alignItems: 'flex-end', paddingBottom: '2px' },
  attachBtn: { background: 'none', border: 'none', cursor: 'pointer', padding: '6px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  inputWrap: { flex: 1 },
  input: { width: '100%', border: '1.5px solid #e0ebe3', borderRadius: '22px', padding: '10px 16px', fontSize: '15px', resize: 'none', fontFamily: 'inherit', maxHeight: '120px', background: '#f8fbf9', lineHeight: '1.45', display: 'block', boxSizing: 'border-box', transition: 'border-color 0.2s' },
  sendBtn: { width: '44px', height: '44px', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', border: 'none', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 3px 10px rgba(26,122,74,0.4)' },
  micBtn: { width: '44px', height: '44px', background: '#f4f8f5', border: '1.5px solid #e0ebe3', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
}