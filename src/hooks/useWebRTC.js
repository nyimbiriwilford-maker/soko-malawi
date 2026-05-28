import { useRef, useState } from 'react'
import { useCall } from '../context/CallContext'
import { ICE_SERVERS } from '../lib/webrtc'

function generateCallId(uid1, uid2) {
  return [uid1, uid2].sort().join('-') + '-' + Date.now()
}

export function useWebRTC({ userId, currentUser, onCallMessage }) {
  const {
    sendSignal: ctxSendSignal,
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
  } = useCall()

  const [callState, setCallState]       = useState('idle')
  const [callType, setCallType]         = useState(null)
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted]           = useState(false)
  const [isCamOff, setIsCamOff]         = useState(false)
  const [remoteStream, setRemoteStream] = useState(null)

  const pcRef             = useRef(null)
  const localStreamRef    = useRef(null)
  const remoteStreamRef   = useRef(null)
  const callIdRef         = useRef(null)
  const callTimerRef      = useRef(null)
  const pendingCandidates = useRef([])
  const incomingOfferRef  = useRef(null)
  const callTypeRef       = useRef(null)
  const localVideoRef     = useRef(null)
  const remoteVideoRef    = useRef(null)

  // KEY FIX: always-current refs for userId and currentUser
  const userIdRef      = useRef(userId)
  const currentUserRef = useRef(currentUser)
  userIdRef.current      = userId
  currentUserRef.current = currentUser

  function updateCallType(type) {
    setCallType(type)
    callTypeRef.current = type
  }

  async function sendSignal(event, payload = {}) {
    const target = userIdRef.current
    if (!target) { console.error('sendSignal: no targetUserId'); return }
    await ctxSendSignal(target, event, { ...payload, callId: callIdRef.current })
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
      const myId   = currentUserRef.current?.id
      const target = userIdRef.current
      if (!callIdRef.current || !myId || !target) return
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
    setCallState('calling')

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

    const pc = buildPeerConnection('caller')
    stream.getTracks().forEach(t => pc.addTrack(t, stream))

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

    const fromName =
      cu.user_metadata?.name ||
      cu.user_metadata?.full_name ||
      cu.email ||
      cu.id

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

    const type   = callTypeRef.current || 'voice'
    const target = userIdRef.current

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

    const callId = callIdRef.current || generateCallId(target, currentUserRef.current.id)
    callIdRef.current = callId

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

    await sendSignal('answer', { answer: pc.localDescription.toJSON() })

    playConnectedSound()
    setCallState('in-call')
    startCallTimer()

    onCallMessage?.({
      call_type: type,
      call_status: 'answered',
      body: type === 'video' ? '📹 Video call' : '📞 Voice call',
    })
  }

  async function declineCall() {
    ctxStopRing()
    dismissIncoming()
    await sendSignal('decline')
    onCallMessage?.({
      call_type: callTypeRef.current,
      call_status: 'missed',
      body: callTypeRef.current === 'video' ? '📹 Missed video call' : '📞 Missed call',
    })
    endCallLocally()
  }

  async function hangUp() {
    playCallEndSound()
    const dur = callDuration
    await sendSignal('hangup')
    onCallMessage?.({
      call_type: callTypeRef.current,
      call_status: 'ended',
      call_duration: dur,
      body: (callTypeRef.current === 'video' ? '📹 Video call' : '📞 Voice call') +
            ' · ' + formatTime(dur),
    })
    endCallLocally()
  }

  function endCallLocally() {
    ctxStopRing()
    clearInterval(callTimerRef.current)
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
    callIdRef.current = null
    closeOutboundChannel?.(userIdRef.current)
    setCallState('idle')
    setCallDuration(0)
    setIsMuted(false)
    setIsCamOff(false)
  }

  function setupCallListener() {
    return registerCallListener((payload) => {
      const { _event } = payload

      if (_event === 'ring') {
        // KEY FIX: read from ref — never stale regardless of chat type
        const expectedFrom = userIdRef.current
        if (payload.fromUser !== expectedFrom) return false

        const handledId = sessionStorage.getItem('__pendingCallId')
        if (handledId === payload.callId) {
          console.log('[setupCallListener] suppressed — handled by GlobalCallListener')
          return true
        }

        callIdRef.current      = payload.callId
        incomingOfferRef.current = payload.offer
        updateCallType(payload.callType)
        setCallState('receiving')
        ctxPlayRing()

        const myId = currentUserRef.current?.id
        if (!myId) { console.error('[callee] currentUser not ready at ring time'); return true }

        subscribeToIceCandidates(payload.callId, myId, async (candidate) => {
          try {
            const cand = typeof candidate === 'string' ? JSON.parse(candidate) : candidate
            if (pcRef.current?.remoteDescription) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(cand))
            } else {
              pendingCandidates.current.push(cand)
            }
          } catch (err) {
            console.error('[callee] addIceCandidate error:', err)
          }
        })

        return true
      }

      if (_event === 'ringing') {
        setCallState('ringing')
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
            playConnectedSound()
            setCallState('in-call')
            startCallTimer()
          })
          .catch(err => console.error('setRemoteDescription error:', err))
        return true
      }

      if (_event === 'ice') {
        if (!pcRef.current) return true
        try {
          const cand = typeof payload.candidate === 'string'
            ? JSON.parse(payload.candidate) : payload.candidate
          if (pcRef.current.remoteDescription) {
            pcRef.current.addIceCandidate(new RTCIceCandidate(cand))
          } else {
            pendingCandidates.current.push(cand)
          }
        } catch (e) {}
        return true
      }

      if (_event === 'hangup' || _event === 'decline') {
        playCallEndSound()
        endCallLocally()
        return true
      }

      return false
    })
  }

  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(m => !m)
  }

  function toggleCam() {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setIsCamOff(c => !c)
  }

  async function restorePendingCall(fromUserId) {
    const raw = sessionStorage.getItem('__pendingCall')
    if (!raw) return
    try {
      const pending = JSON.parse(raw)
      sessionStorage.removeItem('__pendingCall')
      sessionStorage.removeItem('__pendingCallId')
      if (pending.fromUser !== fromUserId) return

      const myId = currentUserRef.current?.id
      if (!myId) { console.error('[restorePendingCall] currentUser not ready'); return }

      const earlyBuffer = drainEarlyCandidates(pending.callId)

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

      for (const c of earlyBuffer) {
        try { pendingCandidates.current.push(typeof c === 'string' ? JSON.parse(c) : c) } catch (e) {}
      }

      incomingOfferRef.current = pending.offer
      callIdRef.current        = pending.callId
      updateCallType(pending.callType)

      await answerCall()
    } catch (e) {
      console.error('[restorePendingCall] error:', e)
    }
  }

  return {
    callState, callType, callDuration, isMuted, isCamOff, remoteStream,
    localVideoRef, remoteVideoRef,
    startCall, answerCall, declineCall, hangUp, endCallLocally,
    toggleMute, toggleCam, setupCallListener,
    assignRemoteStream, assignLocalStream, restorePendingCall,
  }
}

export function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}