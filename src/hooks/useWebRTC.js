import { useRef, useState } from 'react'
import { useCall } from '../context/CallContext'
import { ICE_SERVERS } from '../lib/webrtc'

function generateCallId(uid1, uid2) {
  return [uid1, uid2].sort().join('-') + '-' + Date.now()
}

/**
 * useWebRTC — encapsulates all WebRTC peer connection logic for Chat.jsx
 *
 * @param {string}   userId        — the other user's ID (from URL params)
 * @param {object}   currentUser   — the authenticated user object
 * @param {function} onCallMessage — called when a call ends / is missed, so Chat can save a message
 */
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
  } = useCall()

  // ── State exposed to the UI ──────────────────────────────────────────
  const [callState, setCallState] = useState('idle') // idle|calling|ringing|receiving|in-call
  const [callType, setCallType] = useState(null)     // 'video'|'voice'
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted] = useState(false)
  const [isCamOff, setIsCamOff] = useState(false)
  const [remoteStream, setRemoteStream] = useState(null)

  // ── Refs (not exposed) ───────────────────────────────────────────────
  const pcRef              = useRef(null)
  const localStreamRef     = useRef(null)
  const remoteStreamRef    = useRef(null)
  const callIdRef          = useRef(null)
  const callTimerRef       = useRef(null)
  const pendingCandidates  = useRef([])
  const incomingOfferRef   = useRef(null)
  const callTypeRef        = useRef(null) // mirrors callType for use inside closures
  // Mirror currentUser as a ref so closures (call listeners) always have the latest value
  // even when currentUser prop is still null on first render
  const currentUserRef     = useRef(currentUser)

  // Video element refs — caller must pass these to <video> elements
  const localVideoRef  = useRef(null)
  const remoteVideoRef = useRef(null)

  // Keep ref in sync with prop on every render
  currentUserRef.current = currentUser

  // ── Helpers ──────────────────────────────────────────────────────────

  function updateCallType(type) {
    setCallType(type)
    callTypeRef.current = type
  }

  async function sendSignal(event, payload = {}) {
    if (!userId) { console.error('sendSignal: no targetUserId'); return }
    await ctxSendSignal(userId, event, { ...payload, callId: callIdRef.current })
  }

  function startCallTimer() {
    setCallDuration(0)
    callTimerRef.current = setInterval(() => setCallDuration(d => d + 1), 1000)
  }

  function playConnectedSound() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      ;[380, 480].forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
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
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sine'; osc.frequency.value = freq
        const t = ctx.currentTime + i * 0.15
        gain.gain.setValueAtTime(0.18, t)
        gain.gain.linearRampToValueAtTime(0, t + 0.12)
        osc.start(t); osc.stop(t + 0.15)
      })
    } catch (e) {}
  }

  // ── Assign stream to video element (called from Chat useEffect) ──────
  // Chat.jsx should do: useEffect(() => { assignRemoteStream() }, [remoteStream])
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

  // ── Build a peer connection with all handlers wired up ───────────────
  function buildPeerConnection(role) {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc

    pc.ontrack = e => {
      console.log(`🎥 [${role}] ontrack fired — streams: ${e.streams.length}, track: ${e.track.kind}`)
      const s = e.streams[0]
      remoteStreamRef.current = s
      setRemoteStream(s) // triggers useEffect in Chat → assigns srcObject after render
    }

    pc.onicecandidate = async e => {
      if (!e.candidate) return
      console.log(`🧊 [${role}] ICE candidate: ${e.candidate.type}`)
      const myId = currentUserRef.current?.id
      if (!callIdRef.current || !myId || !userId) return
      await sendIceCandidate(callIdRef.current, myId, userId, e.candidate.toJSON())
    }

    pc.oniceconnectionstatechange = () =>
      console.log(`❄️  [${role}] ICE state: ${pc.iceConnectionState}`)
    pc.onconnectionstatechange = () =>
      console.log(`🔗 [${role}] Connection state: ${pc.connectionState}`)

    return pc
  }

  // ── startCall ────────────────────────────────────────────────────────
  async function startCall(type) {
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

    const callId = generateCallId(currentUserRef.current.id, userId)
    callIdRef.current = callId

    const pc = buildPeerConnection('caller')

    stream.getTracks().forEach(t => pc.addTrack(t, stream))

    // Subscribe BEFORE createOffer so no callee candidates can arrive before we're listening
    subscribeToIceCandidates(callId, currentUser.id, async (candidate) => {
      try {
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } else {
          pendingCandidates.current.push(candidate)
        }
      } catch (err) {
        console.error('[caller] addIceCandidate error:', err)
      }
    })

    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)

    await ctxSendSignal(userId, 'ring', {
      offer: pc.localDescription.toJSON(),
      callType: type,
      fromUser: currentUserRef.current.id,
      callId,
    })
  }

  // ── answerCall ───────────────────────────────────────────────────────
  async function answerCall() {
    ctxStopRing()
    dismissIncoming()

    const type = callTypeRef.current || 'voice'
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

    const callId = callIdRef.current || generateCallId(userId, currentUserRef.current.id)
    callIdRef.current = callId

    const pc = buildPeerConnection('callee')

    // NOTE: ICE subscription was already set up at ring time (in setupCallListener)
    // so caller's candidates are already queued in pendingCandidates if they arrived early.

    // CORRECT ORDER: setRemoteDescription → addTrack → createAnswer
    await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current))

    stream.getTracks().forEach(t => {
      console.log(`➕ [callee] adding track: ${t.kind} (${t.readyState})`)
      pc.addTrack(t, stream)
    })

    // Flush any ICE candidates that arrived before answerCall ran
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

  // ── declineCall ──────────────────────────────────────────────────────
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

  // ── hangUp ───────────────────────────────────────────────────────────
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

  // ── endCallLocally ───────────────────────────────────────────────────
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
    closeOutboundChannel?.(userId)
    setCallState('idle')
    setCallDuration(0)
    setIsMuted(false)
    setIsCamOff(false)
  }

  // ── Call listener (register once on mount) ───────────────────────────
  function setupCallListener() {
    return registerCallListener((payload) => {
      const { _event } = payload

      if (_event === 'ring') {
        if (payload.fromUser !== userId) return false
        callIdRef.current = payload.callId
        incomingOfferRef.current = payload.offer
        updateCallType(payload.callType)
        setCallState('receiving')
        ctxPlayRing()

        // Subscribe to caller's ICE candidates NOW — before answerCall runs.
        // If we wait until answerCall, the caller's candidates arrive during the
        // delay between ring and answer, and the subscription misses them.
        const myId = currentUserRef.current?.id
        if (!myId) { console.error('[callee] currentUser not ready at ring time'); return true }
        subscribeToIceCandidates(payload.callId, myId, async (candidate) => {
          try {
            if (pcRef.current?.remoteDescription) {
              await pcRef.current.addIceCandidate(new RTCIceCandidate(candidate))
            } else {
              pendingCandidates.current.push(candidate)
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
            console.log(`🧊 [caller] flushing ${pendingCandidates.current.length} pending candidates after answer`)
            for (const c of pendingCandidates.current) {
              try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(c)) } catch (e) {}
            }
            pendingCandidates.current = []
            ctxStopRing()
            playConnectedSound()
            setCallState('in-call')
            startCallTimer()
          })
          .catch(err => console.error('setRemoteDescription (answer) error:', err))
        return true
      }

      // ICE via broadcast is no longer used — handled by DB subscription.
      // This branch kept as safety fallback in case old client sends via broadcast.
      if (_event === 'ice') {
        if (!pcRef.current) return true
        try {
          if (pcRef.current.remoteDescription) {
            pcRef.current.addIceCandidate(new RTCIceCandidate(payload.candidate))
          } else {
            pendingCandidates.current.push(payload.candidate)
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

  // ── Controls ─────────────────────────────────────────────────────────
  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(m => !m)
  }

  function toggleCam() {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setIsCamOff(c => !c)
  }

  // ── Pending call from sessionStorage (GlobalCallListener redirect) ───
  function restorePendingCall(fromUserId) {
    const raw = sessionStorage.getItem('__pendingCall')
    if (!raw) return
    try {
      const pending = JSON.parse(raw)
      sessionStorage.removeItem('__pendingCall')
      if (pending.fromUser === fromUserId) {
        incomingOfferRef.current = pending.offer
        callIdRef.current = pending.callId
        updateCallType(pending.callType)
        setCallState('receiving')
        ctxPlayRing()
      }
    } catch (e) {}
  }

  return {
    // State
    callState,
    callType,
    callDuration,
    isMuted,
    isCamOff,
    remoteStream,
    // Refs (attach to <video> elements)
    localVideoRef,
    remoteVideoRef,
    // Actions
    startCall,
    answerCall,
    declineCall,
    hangUp,
    endCallLocally,
    toggleMute,
    toggleCam,
    setupCallListener,
    assignRemoteStream,
    assignLocalStream,
    restorePendingCall,
  }
}

export function formatTime(s) {
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}