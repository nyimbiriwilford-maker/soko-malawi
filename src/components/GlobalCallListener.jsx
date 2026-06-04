import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCall } from '../context/CallContext'
import { ICE_SERVERS } from '../lib/webrtc'

function stopRingtone() {
  if (window._ringtoneAudio) {
    window._ringtoneAudio.pause()
    window._ringtoneAudio.currentTime = 0
    window._ringtoneAudio = null
  }
}

export default function GlobalCallListener() {
  const [incoming, setIncoming] = useState(null)
  const navigate = useNavigate()
  const {
    registerCallListener,
    dismissIncoming,
    activeCall,
    setActiveCall,
    stopRing,
    playRing,
    subscribeToIceCandidatesEarly,
    sendSignal,
    sendIceCandidate,
    subscribeToIceCandidates,
    stopIceSubscription,
    cleanupIceCandidates,
    closeOutboundChannel,
    drainEarlyCandidates,
  } = useCall()

  const myUserIdRef   = useRef(null)
  const swPendingRef    = useRef(null)
  const callerNameRef   = useRef('')
  const pcRef         = useRef(null)
  const localStreamRef= useRef(null)
  const callIdRef     = useRef(null)
  const callerIdRef   = useRef(null)
  const offerRef      = useRef(null)
  const pendingICE    = useRef([])
  const timerRef      = useRef(null)
  const localVideoRef = useRef(null)
  const remoteVideoRef    = useRef(null)
  const remoteStreamRef   = useRef(null)
  const incomingRef       = useRef(null)
  const callStateRef      = useRef('idle')
  const [callState, setCallState] = useState('idle') // 'ringing' | 'in-call'
  const [duration, setDuration]   = useState(0)
  const [isMuted, setIsMuted]     = useState(false)
  const [isVideo, setIsVideo]         = useState(false)
  const [isCamOff, setIsCamOff]       = useState(false)
  const [remoteStream, setRemoteStream] = useState(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) myUserIdRef.current = user.id
    })
  }, [])

  // Listen for push notification incoming call (when app is open)
  useEffect(() => {
    function handleSwIncoming(e) {
      const { callId, fromUser, chatId, callType, callerName } = e.detail

      // Start buffering ICE early
      if (myUserIdRef.current) {
        subscribeToIceCandidatesEarly(callId, myUserIdRef.current)
      }

      // Don't show UI yet — store SW metadata and wait for the
      // realtime 'ring' signal which carries the actual offer.
      // The ring handler will merge chatId from here if needed.
      swPendingRef.current = { callId, fromUser, chatId, callType, callerName }
      // Stop the window._ringtoneAudio played by App.jsx SW handler — we'll use CallContext ring
      stopRingtone()
      playRing()
    }

    window.addEventListener('sw-incoming-call', handleSwIncoming)
    return () => window.removeEventListener('sw-incoming-call', handleSwIncoming)
  }, [])


  // Listen for realtime ring signal
  useEffect(() => {
    const unregister = registerCallListener((payload) => {
      // Caller cancelled before receiver answered
      if (payload._event === 'cancel' || payload._event === 'hangup' || payload._event === 'decline') {
        const isRinging   = callStateRef.current === 'idle' && incomingRef.current
        const isInCall    = callStateRef.current === 'in-call'
        // Not our call — let useWebRTC handle it
        if (!isRinging && !isInCall && !swPendingRef.current) return false
        const isPending   = swPendingRef.current?.callId === payload.callId
        const callIdMatch = !payload.callId ||
          payload.callId === callIdRef.current ||
          payload.callId === incomingRef.current?.callId ||
          isPending

        if (!callIdMatch) return false

        if (isRinging || isPending) {
          stopRing()
          stopRingtone()
          dismissIncoming()
          swPendingRef.current = null
          incomingRef.current = null
          setIncoming(null)
          callIdRef.current = null
          callerIdRef.current = null
          callStateRef.current = 'idle'
          sessionStorage.removeItem('__globalCallActive')
        }
        if (isInCall) {
          cleanupCall()
        }
        return true
      }

      if (payload._event !== 'ring') return false

      if (myUserIdRef.current) {
        subscribeToIceCandidatesEarly(payload.callId, myUserIdRef.current)
      } else {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            myUserIdRef.current = user.id
            subscribeToIceCandidatesEarly(payload.callId, user.id)
          }
        })
      }

      const swMeta = swPendingRef.current?.callId === payload.callId
        ? swPendingRef.current : null
      swPendingRef.current = null

      sessionStorage.setItem('__globalCallActive', payload.callId)
      const resolvedName = payload.fromName || swMeta?.callerName || payload.fromUser
      callerNameRef.current = resolvedName
      setIncoming({
        fromUser: payload.fromUser,
        callType: payload.callType,
        offer: payload.offer,
        callId: payload.callId,
        callerName: resolvedName,
        chatId: swMeta?.chatId || null,
      })
      // Ring already playing from SW push — don't restart it
      if (!swMeta) playRing()
      return true
    })

    return unregister
  }, [])

  useEffect(() => {
    incomingRef.current = incoming
  }, [incoming])

  useEffect(() => {
    if (!remoteStream) return
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream
      remoteVideoRef.current.play().catch(() => {})
    }
  }, [remoteStream])

  useEffect(() => {
    if (callState !== 'in-call' || !isVideo) return
    requestAnimationFrame(() => {
      if (localVideoRef.current && localStreamRef.current) {
        localVideoRef.current.srcObject = localStreamRef.current
        localVideoRef.current.play().catch(() => {})
      }
    })
  }, [callState, isVideo])

  function handleDismiss() {
    stopRing()
    stopRingtone()
    setIncoming(null)
    dismissIncoming()
  }

  async function handleAnswer() {
    if (!incoming) return
    stopRing()
    stopRingtone()
    dismissIncoming()

    const type     = incoming.callType || 'voice'
    const callId   = incoming.callId
    const callerId = incoming.fromUser
    const offer    = incoming.offer

    callIdRef.current   = callId
    callerIdRef.current = callerId

    // If offer is missing (SW push launched), we can't answer WebRTC here
    // Fall back to navigation so restorePendingCall can handle it
    if (!offer) {
      sessionStorage.setItem('__pendingCallId', callId)
      sessionStorage.setItem('__pendingCall', JSON.stringify({
        fromUser: callerId,
        callType: type,
        offer: null,
        callId,
        callerName: incoming.callerName || callerId,
        chatId: incoming.chatId || null,
      }))
      setIncoming(null)
      const parts = (incoming.chatId || '').split('/')
      const dest = parts.length >= 2
        ? `/chat/${parts[0]}/${parts[1]}`
        : `/chat/${callerId}`
      navigate(dest)
      return
    }

    // We have the offer — answer in place, no navigation needed
    offerRef.current = offer
    sessionStorage.setItem('__globalCallActive', callId)

    const stream = await navigator.mediaDevices
      .getUserMedia({ audio: true, video: type === 'video' })
      .catch(() => null)

    if (!stream) {
      alert('Microphone/camera access denied')
      await handleDecline()
      return
    }

    localStreamRef.current = stream
    const myId = myUserIdRef.current

    // Drain any early-buffered ICE candidates
    const earlyBuffer = drainEarlyCandidates(callId)

    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc

    pc.ontrack = e => {
      remoteStreamRef.current = e.streams[0]
      setRemoteStream(e.streams[0])
    }

    pc.onicecandidate = async e => {
      if (!e.candidate || !myId) return
      await sendIceCandidate(callId, myId, callerId, e.candidate.toJSON())
    }

    // Subscribe to live ICE from caller
    subscribeToIceCandidates(callId, myId, async (candidate) => {
      try {
        const cand = typeof candidate === 'string' ? JSON.parse(candidate) : candidate
        if (pcRef.current?.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(cand))
        } else {
          pendingICE.current.push(cand)
        }
      } catch (e) {}
    })

    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    stream.getTracks().forEach(t => pc.addTrack(t, stream))

    // Flush all pending ICE (early buffer + any that arrived before remoteDescription)
    for (const c of [...earlyBuffer, ...pendingICE.current]) {
      try {
        const cand = typeof c === 'string' ? JSON.parse(c) : c
        await pc.addIceCandidate(new RTCIceCandidate(cand))
      } catch (e) {}
    }
    pendingICE.current = []

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    await sendSignal(callerId, 'answer', {
      answer: pc.localDescription.toJSON(),
      callId,
    })

    if (type === 'video') {
      setIsVideo(true)
    }

    setIncoming(null)
    callStateRef.current = 'in-call'; setCallState('in-call')
    setDuration(0)
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000)
    setActiveCall?.({ callType: type, chatPath: 'global' })
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (remoteVideoRef.current && remoteStreamRef.current) {
          remoteVideoRef.current.srcObject = remoteStreamRef.current
          remoteVideoRef.current.play().catch(() => {})
        }
      })
    })
  }

  async function handleDecline() {
    stopRing()
    stopRingtone()
    const target = incomingRef.current?.fromUser || callerIdRef.current
    const callId = incomingRef.current?.callId || callIdRef.current
    dismissIncoming()
    console.log('[GlobalCallListener] decline sending to:', target, 'callId:', callId)
    if (target && callId) {
      await sendSignal(target, 'decline', { callId })
    }
    cleanupCall()
  }

  async function handleHangUp() {
    const target = callerIdRef.current
    const callId = callIdRef.current
    console.log('[GlobalCallListener] hangup sending to:', target, 'callId:', callId)
    if (!target || !callId) {
      console.error('[GlobalCallListener] handleHangUp: missing target or callId — cannot send hangup')
      cleanupCall()
      return
    }
    await sendSignal(target, 'hangup', { callId })
    cleanupCall()
  }
async function handleSwitchCamera() {
    if (!localStreamRef.current || !pcRef.current) return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(d => d.kind === 'videoinput')
      if (videoDevices.length < 2) { alert('No second camera found.'); return }
      const currentTrack = localStreamRef.current.getVideoTracks()[0]
      const currentDeviceId = currentTrack?.getSettings()?.deviceId
      const currentIndex = videoDevices.findIndex(d => d.deviceId === currentDeviceId)
      const nextDevice = videoDevices[(currentIndex + 1) % videoDevices.length]
      currentTrack?.stop()
      localStreamRef.current.removeTrack(currentTrack)
      await new Promise(r => setTimeout(r, 200))
      const newStream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { deviceId: { exact: nextDevice.deviceId } } })
      const newTrack = newStream.getVideoTracks()[0]
      if (!newTrack) return
      const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video')
      if (sender) await sender.replaceTrack(newTrack)
      localStreamRef.current.addTrack(newTrack)
      if (localVideoRef.current) { localVideoRef.current.srcObject = null; localVideoRef.current.srcObject = localStreamRef.current }
    } catch (e) { alert('Camera switch failed: ' + e.message) }
  }

  function cleanupCall() {
    stopRing()
    clearInterval(timerRef.current)
    stopIceSubscription()
    if (callIdRef.current) cleanupIceCandidates(callIdRef.current)
    pcRef.current?.close(); pcRef.current = null
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null
    const callerToClose = callerIdRef.current
    closeOutboundChannel?.(callerToClose)
    sessionStorage.removeItem('__globalCallActive')
    callIdRef.current = null
    callerIdRef.current = null
    offerRef.current = null
    pendingICE.current = []
    incomingRef.current = null
    setIncoming(null)
    callStateRef.current = 'idle'; setCallState('idle')
    setDuration(0)
    setIsMuted(false)
    setIsCamOff(false)
    setIsVideo(false)
    setRemoteStream(null)
    setActiveCall?.(null)
  }
  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(m => !m)
  }

  function fmt(s) {
    return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`
  }

  if (callState === 'in-call') {
    return (
      <div style={{ position:'fixed',inset:0,zIndex:9000,fontFamily:'system-ui,sans-serif',background:'#000',overflow:'hidden' }}>
        <video ref={remoteVideoRef} autoPlay playsInline style={{ position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'cover' }} />
        <div style={{ position:'absolute',bottom:0,left:0,right:0,height:220,background:'linear-gradient(to top,rgba(0,0,0,0.88) 0%,transparent 100%)',pointerEvents:'none' }} />
        <div style={{ position:'absolute',top:0,left:0,right:0,height:110,background:'linear-gradient(to bottom,rgba(0,0,0,0.6) 0%,transparent 100%)',pointerEvents:'none' }} />
        {isVideo ? (
          <div style={{ position:'absolute',top:20,right:16,width:88,height:124,borderRadius:14,overflow:'hidden',border:'2px solid rgba(255,255,255,0.25)',background:'#111',boxShadow:'0 4px 20px rgba(0,0,0,0.6)',zIndex:2 }}>
            <video ref={localVideoRef} autoPlay playsInline muted style={{ width:'100%',height:'100%',objectFit:'cover' }} />
          </div>
        ) : (
          <video ref={localVideoRef} autoPlay playsInline muted style={{ display:'none' }} />
        )}
        <div style={{ position:'absolute',top:16,left:0,right:0,display:'flex',justifyContent:'center',zIndex:3 }}>
          <div style={{ background:'rgba(255,180,0,0.18)',backdropFilter:'blur(8px)',border:'1px solid rgba(255,180,0,0.4)',borderRadius:12,padding:'6px 14px',color:'#ffe066',fontSize:12,fontWeight:'600',display:'flex',alignItems:'center',gap:6 }}>
            <span>⚠️</span> Do not leave this page during the call
          </div>
        </div>
        <div style={{ position:'absolute',top:28,left:0,right:0,display:'flex',flexDirection:'column',alignItems:'center',gap:6,zIndex:2 }}>
          {!isVideo && (
            <div style={{ fontSize:20,fontWeight:'700',color:'#fff',textShadow:'0 2px 8px rgba(0,0,0,0.7)' }}>
              {callerNameRef.current || callerIdRef.current}
            </div>
          )}
          <div style={{ display:'inline-flex',alignItems:'center',gap:6,background:'rgba(0,0,0,0.35)',backdropFilter:'blur(8px)',borderRadius:20,padding:'4px 16px' }}>
            <span style={{ width:7,height:7,borderRadius:'50%',background:'#4ade80',display:'inline-block' }} />
            <span style={{ fontSize:14,color:'rgba(255,255,255,0.92)',fontWeight:'600',fontVariantNumeric:'tabular-nums' }}>{fmt(duration)}</span>
          </div>
        </div>
        <div style={{ position:'absolute',bottom:0,left:0,right:0,zIndex:10,paddingBottom:40,paddingTop:16,display:'flex',flexDirection:'column',alignItems:'center',gap:10 }}>
          <div style={{ display:'flex',alignItems:'flex-end',justifyContent:'center',gap:20,width:'100%',maxWidth:360,paddingLeft:16,paddingRight:16,boxSizing:'border-box' }}>
            <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6 }}>
              <button onClick={() => { localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled }); setIsMuted(m => !m) }}
                style={{ width:56,height:56,borderRadius:'50%',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',background:isMuted?'rgba(239,68,68,0.9)':'rgba(255,255,255,0.18)',backdropFilter:'blur(10px)',boxShadow:'0 2px 12px rgba(0,0,0,0.4)',transition:'background 0.2s' }}>
                <span style={{ fontSize:22 }}>{isMuted ? '🔇' : '🎙️'}</span>
              </button>
              <span style={{ color:'rgba(255,255,255,0.7)',fontSize:11,fontWeight:'500' }}>{isMuted?'Unmute':'Mute'}</span>
            </div>
            {isVideo && (
              <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6 }}>
                <button onClick={() => { localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled }); setIsCamOff(c => !c) }}
                  style={{ width:56,height:56,borderRadius:'50%',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',background:isCamOff?'rgba(239,68,68,0.9)':'rgba(255,255,255,0.18)',backdropFilter:'blur(10px)',boxShadow:'0 2px 12px rgba(0,0,0,0.4)',transition:'background 0.2s' }}>
                  <span style={{ fontSize:22 }}>{isCamOff ? '📷' : '📹'}</span>
                </button>
                <span style={{ color:'rgba(255,255,255,0.7)',fontSize:11,fontWeight:'500' }}>Camera</span>
              </div>
            )}
            <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6 }}>
              <button onClick={handleHangUp}
                style={{ width:64,height:64,borderRadius:'50%',background:'#ef4444',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 24px rgba(239,68,68,0.65)',transform:'scale(1.08)' }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M23.71 16.67C22.69 15.65 21.38 15.1 20 15.1s-2.69.55-3.71 1.57l-2.15 2.15c-3.63-1.97-6.99-5.33-8.96-8.96l2.15-2.15C8.45 6.69 9 5.38 9 4s-.55-2.69-1.57-3.71C6.41-.71 5.13-1.3 3.8-1.3c-1.33 0-2.63.57-3.5 1.57l-1.5 1.5C-3.2 4.27-1.66 10.17 3.3 15.12c4.96 4.97 10.86 6.51 13.35 4.5l1.5-1.5c.98-.87 1.55-2.13 1.55-3.45 0-1.33-.57-2.63-1.99-3.5z"/></svg>
              </button>
              <span style={{ color:'rgba(255,255,255,0.7)',fontSize:11,fontWeight:'500' }}>End</span>
            </div>
            {isVideo && (
              <div style={{ flex:1,display:'flex',flexDirection:'column',alignItems:'center',gap:6 }}>
                <button onClick={handleSwitchCamera}
                  style={{ width:56,height:56,borderRadius:'50%',border:'none',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',background:'rgba(255,255,255,0.18)',backdropFilter:'blur(10px)',boxShadow:'0 2px 12px rgba(0,0,0,0.4)' }}>
                  <span style={{ fontSize:22 }}>🔄</span>
                </button>
                <span style={{ color:'rgba(255,255,255,0.7)',fontSize:11,fontWeight:'500' }}>Flip</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  if (!incoming) return null

  const initial = (incoming.callerName || incoming.fromUser)?.[0]?.toUpperCase() || '?'

  return (
    <div style={S.overlay}>
      <div style={S.card}>
        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 16px' }}>
          <div style={{ ...S.ripple, animationDelay: '0s' }} />
          <div style={{ ...S.ripple, animationDelay: '0.6s' }} />
          <div style={S.avatar}>{initial}</div>
        </div>
        <div style={S.name}>{incoming.callerName || incoming.fromUser}</div>
        <div style={S.type}>
          {incoming.callType === 'video' ? '📹 Incoming video call' : '📞 Incoming voice call'}
        </div>
        <div style={S.actions}>
          <div style={{ textAlign: 'center' }}>
            <button style={S.decline} onClick={handleDecline}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M23.71 16.67C22.69 15.65 21.38 15.1 20 15.1s-2.69.55-3.71 1.57l-2.15 2.15c-3.63-1.97-6.99-5.33-8.96-8.96l2.15-2.15C8.45 6.69 9 5.38 9 4s-.55-2.69-1.57-3.71C6.41-.71 5.13-1.3 3.8-1.3c-1.33 0-2.63.57-3.5 1.57l-1.5 1.5C-3.2 4.27-1.66 10.17 3.3 15.12c4.96 4.97 10.86 6.51 13.35 4.5l1.5-1.5c.98-.87 1.55-2.13 1.55-3.45 0-1.33-.57-2.63-1.99-3.5z"/>
              </svg>
            </button>
            <div style={S.label}>Decline</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <button style={S.answer} onClick={handleAnswer}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </button>
            <div style={S.label}>Answer</div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes ripple{0%{transform:scale(1);opacity:0.6}100%{transform:scale(2.2);opacity:0}}
        @keyframes ringPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(26,122,74,0.4)}50%{transform:scale(1.06);box-shadow:0 0 0 16px rgba(26,122,74,0)}}
      `}</style>
    </div>
  )
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'linear-gradient(160deg,#0a1a10,#0f2d1a)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { textAlign: 'center', padding: '40px 32px' },
  avatar: { position: 'absolute', inset: 0, width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff', fontSize: '30px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'ringPulse 1.4s infinite' },
  ripple: { position: 'absolute', inset: -8, borderRadius: '50%', border: '2px solid rgba(26,122,74,0.5)', animation: 'ripple 2s ease-out infinite' },
  name: { fontSize: '24px', fontWeight: '800', color: '#fff', marginBottom: 8 },
  type: { fontSize: '15px', color: 'rgba(255,255,255,0.55)', marginBottom: 36 },
  actions: { display: 'flex', gap: 48, justifyContent: 'center' },
  decline: { width: 64, height: 64, borderRadius: '50%', background: '#e74c3c', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(231,76,60,0.4)' },
  answer: { width: 64, height: 64, borderRadius: '50%', background: '#1a7a4a', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(26,122,74,0.5)', animation: 'ringPulse 1.4s infinite' },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8 },
}