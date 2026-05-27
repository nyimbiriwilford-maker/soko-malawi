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
 * @param {function} onCallMessage — called when a call ends / is missed
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
    drainEarlyCandidates, // ← drains early buffer from GlobalCallListener
  } = useCall()

  // ── State exposed to the UI ────────────────────────────────────────────────
  const [callState, setCallState] = useState('idle') // idle|calling|ringing|receiving|in-call
  const [callType, setCallType]   = useState(null)   // 'video'|'voice'
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted]     = useState(false)
  const [isCamOff, setIsCamOff]   = useState(false)
  const [remoteStream, setRemoteStream] = useState(null)

  // ── Refs ───────────────────────────────────────────────────────────────────
  const pcRef             = useRef(null)
  const localStreamRef    = useRef(null)
  const remoteStreamRef   = useRef(null)
  const callIdRef         = useRef(null)
  const callTimerRef      = useRef(null)
  const pendingCandidates = useRef([])
  const incomingOfferRef  = useRef(null)
  const callTypeRef       = useRef(null)
  const currentUserRef    = useRef(currentUser)
  const localVideoRef     = useRef(null)
  const remoteVideoRef    = useRef(null)

  // Keep ref in sync with prop on every render
  currentUserRef.current = currentUser

  // ── Helpers ────────────────────────────────────────────────────────────────

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

  // ── Build peer connection ──────────────────────────────────────────────────
  function buildPeerConnection(role) {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc

    pc.ontrack = e => {
      console.log(`🎥 [${role}] ontrack fired — track: ${e.track.kind}`)
      const s = e.streams[0]
      remoteStreamRef.current = s
      setRemoteStream(s)
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

  // ── startCall ──────────────────────────────────────────────────────────────
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

    // Subscribe before createOffer — so no callee candidates are missed
    subscribeToIceCandidates(callId, currentUserRef.current.id, async (candidate) => {
      try {
        const cand = typeof candidate === 'string' ? JSON.parse(candidate) : candidate
        if (pc.remoteDescription) {
          await pc.addIceCandidate(new RTCIceCandidate(cand))
        } else {
          pendingCandidates.current.push(cand)
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

  // ── answerCall ─────────────────────────────────────────────────────────────
  // Called when the user taps Answer while already on the chat page.
  // For the GlobalCallListener → navigate path, use restorePendingCall() instead.
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

    // ICE subscription + pendingCandidates were set up before this call:
    // • Direct answer (in-chat): setupCallListener did it at ring time
    // • Navigate path: restorePendingCall() did it before calling answerCall()

    // CORRECT ORDER: setRemoteDescription → addTrack → createAnswer
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

  // ── declineCall ────────────────────────────────────────────────────────────
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

  // ── hangUp ─────────────────────────────────────────────────────────────────
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

  // ── endCallLocally ─────────────────────────────────────────────────────────
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

  // ── setupCallListener ──────────────────────────────────────────────────────
  function setupCallListener() {
    return registerCallListener((payload) => {
      const { _event } = payload

      if (_event === 'ring') {
        if (payload.fromUser !== userId) return false

        // If GlobalCallListener already handled this ring (user was outside chat,
        // tapped Answer, and navigated here), restorePendingCall() will handle
        // everything. Suppress the duplicate ring to prevent a second peer connection.
        const handledId = sessionStorage.getItem('__pendingCallId')
        if (handledId === payload.callId) {
          console.log('[setupCallListener] ring suppressed — already handled by GlobalCallListener')
          return true // claim it so no other listener fires, but do nothing else
        }

        callIdRef.current = payload.callId
        incomingOfferRef.current = payload.offer
        updateCallType(payload.callType)
        setCallState('receiving')
        ctxPlayRing()

        // Subscribe to ICE candidates immediately — before the user taps Answer.
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

      // Broadcast ICE fallback (old clients)
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

  // ── Controls ───────────────────────────────────────────────────────────────
  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(m => !m)
  }

  function toggleCam() {
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = !t.enabled })
    setIsCamOff(c => !c)
  }

  // ── restorePendingCall ─────────────────────────────────────────────────────
  // Called by Chat.jsx on mount when navigated from GlobalCallListener.
  // The user ALREADY tapped Answer in GlobalCallListener — so we go straight to
  // answerCall(), no ring UI, no duplicate listener firing.
  async function restorePendingCall(fromUserId) {
    const raw = sessionStorage.getItem('__pendingCall')
    if (!raw) return
    try {
      const pending = JSON.parse(raw)
      sessionStorage.removeItem('__pendingCall')
      sessionStorage.removeItem('__pendingCallId') // clean up the suppression flag too
      if (pending.fromUser !== fromUserId) return

      const myId = currentUserRef.current?.id
      if (!myId) {
        console.error('[restorePendingCall] currentUser not ready')
        return
      }

      console.log('[restorePendingCall] restoring call, draining early ICE buffer...')

      // Drain candidates buffered by GlobalCallListener's early subscription
      const earlyBuffer = drainEarlyCandidates(pending.callId)
      console.log(`[restorePendingCall] drained ${earlyBuffer.length} early ICE candidates`)

      // Set up the real ICE subscription for any candidates still in flight
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

      // Seed the pending queue with early buffered candidates.
      // answerCall() will flush these after setRemoteDescription.
      for (const c of earlyBuffer) {
        try {
          pendingCandidates.current.push(typeof c === 'string' ? JSON.parse(c) : c)
        } catch (e) {}
      }

      // Load call metadata into refs so answerCall() can read them
      incomingOfferRef.current = pending.offer
      callIdRef.current = pending.callId
      updateCallType(pending.callType)

      // DO NOT call ctxPlayRing() or setCallState('receiving') here —
      // the user already tapped Answer. Go straight to answering.
      // The ring UI from GlobalCallListener is already gone.
      console.log('[restorePendingCall] auto-answering...')
      await answerCall()

    } catch (e) {
      console.error('[restorePendingCall] error:', e)
    }
  }

  return {
    // State
    callState,
    callType,
    callDuration,
    isMuted,
    isCamOff,
    remoteStream,
    // Refs
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