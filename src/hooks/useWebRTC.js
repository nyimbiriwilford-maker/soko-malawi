import { useRef, useState } from 'react'
import { useCall } from '../context/CallContext'
import { ICE_SERVERS } from '../lib/webrtc'
import { supabase } from '../lib/supabase'

function generateCallId(uid1, uid2) {
  return [uid1, uid2].sort().join('-') + '-' + Date.now()
}

export function useWebRTC({ userId, currentUser, onCallMessage, listingId, isServiceChat }) {
  const {
    sendSignal: ctxSendSignal,
    setActiveCall,
    sendIceCandidate,
    subscribeToIceCandidates,
    stopIceSubscription,
    cleanupIceCandidates,
    registerCallListener,
    dismissIncoming,
    playRing: ctxPlayRing,
    stopRing: ctxStopRing,
    closeOutboundChannel,
    drainEarlyCandidates,
    playRingback,
    stopRingback,
  } = useCall()

  const [callState, setCallState]       = useState('idle')
  const [callType, setCallType]         = useState(null)
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted]           = useState(false)
  const [isCamOff, setIsCamOff]         = useState(false)
  const [facingMode, setFacingMode]     = useState('user')
  const [remoteStream, setRemoteStream] = useState(null)

  const { pcRef, localStreamRef, callIdRef, callerIdRef, callTimerRef } = useCall()
  const remoteStreamRef   = useRef(null)
  const autoHangupRef     = useRef(null)
  const pendingCandidates = useRef([])
  const incomingOfferRef  = useRef(null)
  const callTypeRef       = useRef(null)
  const localVideoRef     = useRef(null)
  const remoteVideoRef    = useRef(null)
  const callStateRef      = useRef('idle')

  // Always-current refs — never stale in closures
  const userIdRef      = useRef(userId)
  const currentUserRef = useRef(currentUser)
  userIdRef.current      = userId
  currentUserRef.current = currentUser

  function updateCallType(type) {
    setCallType(type)
    callTypeRef.current = type
  }

  function startCallTimer() {
    setCallDuration(0)
    callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)
  }

  function playConnectedSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      ;[380, 480].forEach((freq, i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sine'; osc.frequency.value = freq
        const t = ctx.currentTime + i * 0.12
        gain.gain.setValueAtTime(0.15, t)
        gain.gain.linearRampToValueAtTime(0, t + 0.1)
        osc.start(t); osc.stop(t + 0.12)
      })
    } catch (e) {}
  }

  function playCallEndSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      ;[480, 360, 300].forEach((freq, i) => {
        const osc = ctx.createOscillator(), gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sine'; osc.frequency.value = freq
        const t = ctx.currentTime + i * 0.15
        gain.gain.setValueAtTime(0.18, t)
        gain.gain.linearRampToValueAtTime(0, t + 0.12)
        osc.start(t); osc.stop(t + 0.15)
      })
    } catch (e) {}
  }

  function assignRemoteStream() {
    if (!remoteStream || !remoteVideoRef.current) return
    remoteVideoRef.current.srcObject = remoteStream
    remoteVideoRef.current.play().catch(() => {})
  }

  function assignLocalStream() {
    if (!localStreamRef.current || !localVideoRef.current) return
    localVideoRef.current.srcObject = localStreamRef.current
    localVideoRef.current.play().catch(() => {})
  }

  function buildPeerConnection(role) {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc

    pc.ontrack = e => {
      console.log(`🎥 [${role}] ontrack — track: ${e.track.kind}`)
      const s = e.streams[0]
      remoteStreamRef.current = s
      setRemoteStream(s)
    }

    pc.onicecandidate = async e => {
      if (!e.candidate) return
      const myId = currentUserRef.current?.id
      // ICE always goes to the OTHER person in the call
      // For caller: target is the callee (userIdRef)
      // For callee: target is the caller (callerIdRef, which was set at ring time)
      const target = callerIdRef.current || userIdRef.current
      if (!callIdRef.current || !myId || !target) return
      console.log(`[${role}] sending ICE candidate to ${target}`)
      await sendIceCandidate(callIdRef.current, myId, target, e.candidate.toJSON())
    }

    pc.oniceconnectionstatechange = () =>
      console.log(`❄️  [${role}] ICE: ${pc.iceConnectionState}`)
    pc.onconnectionstatechange = () =>
      console.log(`🔗 [${role}] Conn: ${pc.connectionState}`)

    return pc
  }

  async function startCall(type) {
    const target = userIdRef.current
    if (!target) { console.error('startCall: no userId'); return }

    updateCallType(type)
    callStateRef.current = 'calling'; setCallState('calling')

    const stream = await navigator.mediaDevices
      .getUserMedia({ audio: true, video: type === 'video' })
      .catch(() => null)

    if (!stream) {
      alert('Microphone/camera access denied')
      endCallLocally()
      return
    }

    localStreamRef.current = stream
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream
      localVideoRef.current.play().catch(() => {})
    }

    const cu     = currentUserRef.current
    const callId = generateCallId(cu.id, target)
    callIdRef.current = callId
    // Caller is calling target — callerIdRef stays null (we are the caller)
    callerIdRef.current = null

    const pc = buildPeerConnection('caller')
    stream.getTracks().forEach(t => pc.addTrack(t, stream))

    // Caller subscribes to ICE from callee (target sends to us = cu.id)
    subscribeToIceCandidates(callId, cu.id, async (candidate) => {
      try {
        const cand = typeof candidate === 'string' ? JSON.parse(candidate) : candidate
        if (pcRef.current?.remoteDescription) {
          await pcRef.current.addIceCandidate(new RTCIceCandidate(cand))
        } else {
          pendingCandidates.current.push(cand)
        }
      } catch (err) {
        console.error('[caller] addIceCandidate error:', err)
      }
    })

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    const { data: myProf } = await supabase
      .from('profiles').select('full_name').eq('id', cu.id).maybeSingle()
    const fromName =
      myProf?.full_name ||
      cu.user_metadata?.name ||
      cu.user_metadata?.full_name ||
      cu.email ||
      cu.id

    playRingback()

    // Auto-cancel after 30 seconds if no answer
    autoHangupRef.current = setTimeout(async () => {
      if (callStateRef.current !== 'in-call' && callStateRef.current !== 'idle') {
        stopRingback()
        // Send cancel to receiver so their ringing stops
        await ctxSendSignal(target, 'cancel', { callId: callIdRef.current })
        onCallMessage?.({
          call_type: type,
          call_status: 'missed',
          body: type === 'video' ? '📹 Missed video call' : '📞 Missed call',
          ...(isServiceChat?.current && listingId ? { service_id: listingId } : listingId ? { listing_id: listingId } : {}),
        })
        endCallLocally()
      }
    }, 30000)

    // Get chatId from current URL — format is /chat/{chatId}
    // CORRECT — gets everything after /chat/
// Build chatId as "userId/listingId" so receiver can navigate to the right chat
    const pathParts = window.location.pathname.replace('/chat/', '').split('/')
    const chatId = pathParts.length >= 2
      ? `${userIdRef.current}/${pathParts[1]}`
      : userIdRef.current || null

    // Send push notification to wake up receiver's device
    supabase.functions.invoke('send-call-push', {
      body: {
        targetUserId: target,
        callerName: fromName,
        callerAvatar: cu.user_metadata?.avatar_url || null,
        callType: type,
        callId,
        fromUser: cu.id,
        chatId,
      }
    }).catch(e => console.log('[push] invoke error:', e))
    await ctxSendSignal(target, 'ring', {
      offer: pc.localDescription.toJSON(),
      callType: type,
      fromUser: cu.id,
      fromName,
      callId,
    })
  }

  async function answerCall() {
    ctxStopRing()
    dismissIncoming()
    // ADD THESE TWO LINES:
    window._ringtoneAudio?.pause()
    window._ringtoneAudio = null
    dismissIncoming()

    const type = callTypeRef.current || 'voice'
    // The person we are answering IS the caller — use callerIdRef
    // callerIdRef was set in setupCallListener's ring handler or restorePendingCall
    const callerId = callerIdRef.current
    if (!callerId) {
      console.error('[answerCall] callerIdRef is null — cannot answer')
      return
    }

    const stream = await navigator.mediaDevices
      .getUserMedia({ audio: true, video: type === 'video' })
      .catch(() => null)

    if (!stream) {
      alert('Microphone/camera access denied')
      await declineCall()
      return
    }

    localStreamRef.current = stream
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream
      localVideoRef.current.play().catch(() => {})
    }

    const callId = callIdRef.current
    if (!callId) { console.error('[answerCall] no callId'); return }

    const pc = buildPeerConnection('callee')

    await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current))

    stream.getTracks().forEach(t => {
      console.log(`➕ [callee] adding track: ${t.kind}`)
      pc.addTrack(t, stream)
    })

    console.log(`🧊 [callee] flushing ${pendingCandidates.current.length} pending candidates`)
    for (const c of pendingCandidates.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch (e) {}
    }
    pendingCandidates.current = []

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    // Send answer back to the CALLER specifically
    console.log(`[callee] sending answer to caller: ${callerId}`)
    await ctxSendSignal(callerId, 'answer', {
      answer: pc.localDescription.toJSON(),
      callId,
    })

    playConnectedSound()
    callStateRef.current = 'in-call'; setCallState('in-call')
    startCallTimer()
    setActiveCall?.({ callType: type, chatPath: window.location.pathname })

    onCallMessage?.({
      call_type: type,
      call_status: 'answered',
      body: type === 'video' ? '📹 Video call' : '📞 Voice call',
      ...(isServiceChat?.current && listingId ? { service_id: listingId } : listingId ? { listing_id: listingId } : {}),
    })
  }

  async function declineCall() {
    ctxStopRing()
    dismissIncoming()
    const target = callerIdRef.current || userIdRef.current
    console.log(`[decline] sending to: ${target}`)
    await ctxSendSignal(target, 'decline', { callId: callIdRef.current })
    onCallMessage?.({
      call_type: callTypeRef.current,
      call_status: 'missed',
      body: callTypeRef.current === 'video' ? '📹 Missed video call' : '📞 Missed call',
      ...(isServiceChat?.current && listingId ? { service_id: listingId } : listingId ? { listing_id: listingId } : {}),
    })
    endCallLocally()
  }

 async function hangUp() {
    playCallEndSound()
    const dur = callDuration
    const target = callerIdRef.current || userIdRef.current
    console.log(`[hangup] sending to: ${target}`)
    const event = (callStateRef.current === 'calling' || callStateRef.current === 'ringing')
      ? 'cancel' : 'hangup'
    await ctxSendSignal(target, event, { callId: callIdRef.current })
    onCallMessage?.({
      call_type: callTypeRef.current,
      call_status: 'ended',
      call_duration: dur,
      body: (callTypeRef.current === 'video' ? '📹 Video call' : '📞 Voice call') +
            ' · ' + formatTime(dur),
      ...(isServiceChat?.current && listingId ? { service_id: listingId } : listingId ? { listing_id: listingId } : {}),
    })
    endCallLocally()
  }

  function endCallLocally() {
    ctxStopRing()
    stopRingback()
    // ADD THESE TWO LINES:
    window._ringtoneAudio?.pause()
    window._ringtoneAudio = null
    clearInterval(callTimerRef.current)
    clearTimeout(autoHangupRef.current)
    autoHangupRef.current = null
    stopIceSubscription()
    if (callIdRef.current) cleanupIceCandidates(callIdRef.current)
    pcRef.current?.close()
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach(t => t.stop())
    localStreamRef.current = null
    remoteStreamRef.current = null
    setRemoteStream(null)
    pendingCandidates.current = []
    incomingOfferRef.current = null
    const targetToClose = callerIdRef.current || userIdRef.current
    callIdRef.current = null
    callerIdRef.current = null
    callStateRef.current = 'idle'; setCallState('idle')
    setCallDuration(0)
    setIsMuted(false)
    setIsCamOff(false)
    setActiveCall?.(null)
    // Delay channel close so hangup signal has time to deliver
    setTimeout(() => {
      closeOutboundChannel?.(targetToClose)
    }, 1500)
  }

  function setupCallListener() {
    function onCallEnded() {}
    window.addEventListener('call-ended', onCallEnded)

    const unregister = registerCallListener((payload) => {
      const { _event } = payload

      if (_event === 'ringing') {
        callStateRef.current = 'ringing'; setCallState('ringing')
        return true
      }

      if (_event === 'answer') {
        if (!pcRef.current) return true
        if (pcRef.current.signalingState !== 'have-local-offer') return true
        pcRef.current
          .setRemoteDescription(new RTCSessionDescription(payload.answer))
          .then(async () => {
            for (const c of pendingCandidates.current) {
              try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(c)) } catch (e) {}
            }
            pendingCandidates.current = []
            ctxStopRing()
            stopRingback()
            playConnectedSound()
            callStateRef.current = 'in-call'; setCallState('in-call')
            startCallTimer()
            setActiveCall?.({ callType: callTypeRef.current, chatPath: window.location.pathname })
          })
          .catch(err => console.error('[answer] setRemoteDescription error:', err))
        return true
      }

      if (_event === 'hangup' || _event === 'decline' || _event === 'cancel') {
        console.log('[useWebRTC] received:', _event, 'payload callId:', payload.callId, 'local callId:', callIdRef.current)
        stopRingback()
        ctxStopRing()
        playCallEndSound()
        endCallLocally()
        return true
      }

      return false
    })

    return () => {
      window.removeEventListener('call-ended', onCallEnded)
      unregister()
    }
  }

  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(m => !m)
  }

  function toggleCam() {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setIsCamOff(c => !c)
  }

 async function switchCamera() {
    if (!localStreamRef.current || !pcRef.current) return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter(d => d.kind === 'videoinput')

      if (videoDevices.length < 2) {
        alert('No second camera found on this device.')
        return
      }

      const currentTrack = localStreamRef.current.getVideoTracks()[0]
      const currentDeviceId = currentTrack?.getSettings()?.deviceId
      const currentIndex = videoDevices.findIndex(d => d.deviceId === currentDeviceId)
      const nextDevice = videoDevices[(currentIndex + 1) % videoDevices.length]

      console.log('[switchCamera] switching to:', nextDevice.label)

      // CRITICAL: stop old track FIRST to release hardware before acquiring new one
      currentTrack?.stop()
      localStreamRef.current.removeTrack(currentTrack)

      // Small delay to let the hardware fully release
      await new Promise(r => setTimeout(r, 200))

      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { exact: nextDevice.deviceId } }
      })

      const newTrack = newStream.getVideoTracks()[0]
      if (!newTrack) return

      // Replace in peer connection
      const sender = pcRef.current.getSenders().find(s => s.track?.kind === 'video')
      if (sender) await sender.replaceTrack(newTrack)

      // Add new track to stream
      localStreamRef.current.addTrack(newTrack)

      // Update local preview
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null
        localVideoRef.current.srcObject = localStreamRef.current
      }

      setFacingMode(f => f === 'user' ? 'environment' : 'user')
      console.log('[switchCamera] success')
    } catch (e) {
      console.error('switchCamera error:', e)
      alert('Camera switch failed: ' + e.message)
    }
  }
  async function restorePendingCall(fromUserId) {
    const raw = sessionStorage.getItem('__pendingCall')
    if (!raw) return
    try {
      const pending = JSON.parse(raw)
      sessionStorage.removeItem('__pendingCall')
      sessionStorage.removeItem('__pendingCallId')
      // Accept call from anyone — not just current chat partner
      if (!pending.fromUser) return

      const myId = currentUserRef.current?.id
      if (!myId) { console.error('[restorePendingCall] currentUser not ready'); return }

      // CRITICAL: set callerIdRef BEFORE calling answerCall
      callerIdRef.current      = pending.fromUser
      incomingOfferRef.current = pending.offer
      callIdRef.current        = pending.callId
      updateCallType(pending.callType)

      const earlyBuffer = drainEarlyCandidates(pending.callId)

      // Subscribe to ICE sent to us from the caller
      subscribeToIceCandidates(pending.callId, myId, async (candidate) => {
        try {
          const cand = typeof candidate === 'string' ? JSON.parse(candidate) : candidate
          if (pcRef.current?.remoteDescription) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(cand))
          } else {
            pendingCandidates.current.push(cand)
          }
        } catch (err) {
          console.error('[restore] addIceCandidate error:', err)
        }
      })

      // Pre-load buffered early candidates
      for (const c of earlyBuffer) {
        try { pendingCandidates.current.push(typeof c === 'string' ? JSON.parse(c) : c) } catch (e) {}
      }

      await answerCall()
    } catch (e) {
      console.error('[restorePendingCall] error:', e)
    }
  }

  return {
    callState, callType, callDuration, isMuted, isCamOff, remoteStream,
    localVideoRef, remoteVideoRef, facingMode,
    startCall, answerCall, declineCall, hangUp, endCallLocally,
    toggleMute, toggleCam, switchCamera, setupCallListener,
    assignRemoteStream, assignLocalStream, restorePendingCall,
  }
}

export function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}