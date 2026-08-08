import { useEffect, useRef, useState } from 'react'
import { useCall } from '../context/CallContext'
import { ICE_SERVERS } from '../lib/webrtc'
import { supabase } from '../lib/supabase'
import { buildReceiverChatId } from '../utils/callNotifications'
import { useCallDataBudget } from './useCallDataBudget'
import { setCallBudgetPref, getCallBudgetPref } from '../lib/callBudgetPrefs'
import { stopLowDataCap } from '../lib/callBitrateCap'

// TEMP - dev-only test hook, remove when budget UI ships
if (import.meta.env.DEV) {
  window.setCallBudgetPref = setCallBudgetPref
}

// TEMP - [CallDebug] diagnostic logging (Task 12). Remove after NotReadableError is root-caused.
function callDebugGetUserMedia(streamRef, constraints, label) {
  const stream = streamRef?.current
  const tracks = stream ? stream.getTracks() : []
  const stack = new Error().stack
  console.log('[CallDebug] getUserMedia', {
    call: label,
    constraints,
    callerStack: stack ? stack.split('\n').slice(1, 4).map((l) => l.trim()) : null,
    priorStreamHeld: tracks.some((t) => t.readyState === 'live'),
    priorTracks: tracks.map((t) => ({ kind: t.kind, state: t.readyState })),
  })
}

function generateCallId(uid1, uid2) {
  return [uid1, uid2].sort().join('-') + '-' + Date.now()
}

/**
 * Acquire call media with a 1s NotReadableError retry (mirrors GlobalCallListener)
 * and an audio-only fallback when the camera is unavailable on video calls.
 * @returns {Promise<{ stream: MediaStream|null, audioOnly: boolean, lastError: Error|null }>}
 */
async function acquireCallMedia(type) {
  const video = type === 'video'
  let lastError = null
  let stream = await navigator.mediaDevices
    .getUserMedia({ audio: true, video })
    .catch((err) => {
      lastError = err
      console.error('[getUserMedia]', err?.name, err?.message)
      return null
    })

  if (!stream && lastError?.name === 'NotReadableError') {
    await new Promise((r) => setTimeout(r, 1000))
    stream = await navigator.mediaDevices
      .getUserMedia({ audio: true, video })
      .catch((err) => {
        lastError = err
        console.error('[getUserMedia retry]', err?.name, err?.message)
        return null
      })
  }

  if (!stream && video) {
    const audioOnly = await navigator.mediaDevices
      .getUserMedia({ audio: true, video: false })
      .catch((err) => {
        lastError = err
        console.error('[getUserMedia audio-only fallback]', err?.name, err?.message)
        return null
      })
    if (audioOnly) return { stream: audioOnly, audioOnly: true, lastError }
  }

  return { stream, audioOnly: false, lastError }
}

/** Best-effort camera track for the receiving side of a video switch. */
async function acquireSwitchVideoTrack() {
  try {
    const vid = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
    const track = vid.getVideoTracks()[0]
    if (!track) return null
    track.enabled = true
    return track
  } catch (err) {
    console.error('[switchToVideo] peer-requested camera error:', err?.name, err?.message)
    return null
  }
}

function sameCallId(a, b) {
  if (!a || !b) return true // tolerate missing ids from older clients
  return String(a) === String(b)
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
    claimCallStack,
    releaseCallStack,
    getCallStackOwner,
    clearActiveCall,
    publishActiveCall,
    setCallUiMode,
    remoteMediaStreamRef,
    localMediaStreamRef,
  } = useCall()

  const [callState, setCallState]       = useState('idle')
  const [callType, setCallType]         = useState(null)
  const [callDuration, setCallDuration] = useState(0)
  const [isMuted, setIsMuted]           = useState(false)
  const [isCamOff, setIsCamOff]         = useState(false)
  const [facingMode, setFacingMode]     = useState('user')
  const [remoteStream, setRemoteStream] = useState(null)
  const [mediaNotice, setMediaNotice]   = useState(null)
  const [switching, setSwitching]       = useState(false)

  const { pcRef, localStreamRef, callIdRef, callerIdRef, callTimerRef } = useCall()
  const { sampleUsage } = useCallDataBudget(pcRef)
  const remoteStreamRef   = useRef(null)
  const autoHangupRef     = useRef(null)
  const pendingCandidates = useRef([])
  const incomingOfferRef  = useRef(null)
  const callTypeRef       = useRef(null)
  const localVideoRef     = useRef(null)
  const remoteVideoRef    = useRef(null)
  const callStateRef      = useRef('idle')
  const callDurationRef   = useRef(0)
  const lowDataIntervalRef = useRef(null)
  const switchingRef      = useRef(false)
  const switchPendingRef  = useRef(null)
  const switchTimeoutRef  = useRef(null)

  const userIdRef      = useRef(userId)
  const currentUserRef = useRef(currentUser)
  userIdRef.current      = userId
  currentUserRef.current = currentUser

  // Non-blocking camera-unavailable notice, auto-dismisses
  useEffect(() => {
    if (!mediaNotice) return undefined
    const t = setTimeout(() => setMediaNotice(null), 4000)
    return () => clearTimeout(t)
  }, [mediaNotice])

  function updateCallType(type) {
    setCallType(type)
    callTypeRef.current = type
  }

  function contextListingFields() {
    if (!listingId || listingId === 'undefined') return {}
    if (isServiceChat?.current) return { service_id: listingId }
    return { listing_id: listingId }
  }

  function startCallTimer() {
    clearInterval(callTimerRef.current)
    callDurationRef.current = 0
    setCallDuration(0)
    callTimerRef.current = setInterval(() => {
      callDurationRef.current += 1
      setCallDuration(callDurationRef.current)
      sampleUsage().then((bytesUsed) => {
        console.log('[CallDataBudget] bytesUsed:', bytesUsed)
      })
    }, 1000)
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
    } catch (_) {}
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
    } catch (_) {}
  }

  function assignRemoteStream() {
    const el = remoteVideoRef.current
    if (!remoteStream || !el) return
    // Re-assigning srcObject every render flashes the video black — only attach when needed
    if (el.srcObject !== remoteStream) {
      el.srcObject = remoteStream
    }
    if (el.paused) {
      el.play().catch((err) => {
        if (err.name !== 'AbortError') console.warn('[play]', err.name, err.message)
      })
    }
  }

  function assignLocalStream() {
    const el = localVideoRef.current
    const stream = localStreamRef.current
    if (!stream || !el) return
    if (el.srcObject !== stream) {
      el.srcObject = stream
    }
    if (el.paused) {
      el.play().catch((err) => {
        if (err.name !== 'AbortError') console.warn('[play]', err.name, err.message)
      })
    }
  }

  function buildPeerConnection(role) {
    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc

    pc.ontrack = (e) => {
      console.log(`[${role}] ontrack — ${e.track.kind}`)
      const s = e.streams[0]
      remoteStreamRef.current = s
      if (remoteMediaStreamRef) remoteMediaStreamRef.current = s
      setRemoteStream(s)
    }

    pc.onicecandidate = async (e) => {
      if (!e.candidate) return
      const myId = currentUserRef.current?.id
      const target = callerIdRef.current || userIdRef.current
      if (!callIdRef.current || !myId || !target) return
      await sendIceCandidate(callIdRef.current, myId, target, e.candidate.toJSON())
    }

    pc.oniceconnectionstatechange = () => {
      const st = pc.iceConnectionState
      console.log(`[${role}] ICE: ${st}`)
      if (st === 'failed') {
        console.warn(`[${role}] ICE failed — ending call`)
        playCallEndSound()
        endCallLocally()
      }
    }

    pc.onconnectionstatechange = () => {
      const st = pc.connectionState
      console.log(`[${role}] Conn: ${st}`)
      if (st === 'failed') {
        playCallEndSound()
        endCallLocally()
      }
    }

    return pc
  }

  async function startCall(type) {
    const target = userIdRef.current
    const cu = currentUserRef.current
    if (!target) {
      console.error('startCall: no userId')
      return
    }
    if (!cu?.id) {
      console.error('startCall: currentUser not ready')
      alert('Please wait — still signing in.')
      return
    }
    if (callStateRef.current !== 'idle') {
      console.warn('startCall: already in a call')
      return
    }

    claimCallStack?.('chat')
    updateCallType(type)
    callStateRef.current = 'calling'
    setCallState('calling')

    callDebugGetUserMedia(localStreamRef, { audio: true, video: type === 'video' }, 'startCall')
    const { stream, audioOnly, lastError } = await acquireCallMedia(type)

    if (!stream) {
      alert(lastError?.name ? `Camera/microphone error: ${lastError.name}` : 'Microphone/camera access denied')
      endCallLocally()
      return
    }
    if (audioOnly) setMediaNotice('Camera unavailable — continuing with audio only')

    localStreamRef.current = stream
    if (localMediaStreamRef) localMediaStreamRef.current = stream
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream
      localVideoRef.current.play().catch((err) => {
        if (err.name !== 'AbortError') console.warn('[play]', err.name, err.message)
      })
    }

    const callId = generateCallId(cu.id, target)
    callIdRef.current = callId
    callerIdRef.current = null
    setCallUiMode?.('full')

    const pc = buildPeerConnection('caller')
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))
    applyLowDataIfConfigured(pc, type)

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
    }, 'chat')

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

    // Auto-cancel after 30s if unanswered
    clearTimeout(autoHangupRef.current)
    autoHangupRef.current = setTimeout(async () => {
      if (callStateRef.current !== 'in-call' && callStateRef.current !== 'idle') {
        stopRingback()
        await ctxSendSignal(target, 'cancel', { callId: callIdRef.current })
        onCallMessage?.({
          call_type: type,
          call_status: 'missed',
          call_notify: 'missed_to_peer',
          body: type === 'video' ? '📹 Missed video call' : '📞 Missed call',
          ...contextListingFields(),
        })
        endCallLocally()
      }
    }, 30000)

    // Receiver must open chat with *caller* (us), not with themselves
    const listingPart =
      listingId && listingId !== 'undefined' ? listingId : null
    const chatId = buildReceiverChatId(cu.id, listingPart)

    supabase.functions.invoke('send-call-push', {
      body: {
        targetUserId: target,
        callerName: fromName,
        callerAvatar: cu.user_metadata?.avatar_url || null,
        callType: type,
        callId,
        fromUser: cu.id,
        chatId,
      },
    }).catch((e) => console.log('[push] invoke error:', e))

    // Ack that remote is ringing (caller UI can show "Ringing…")
    callStateRef.current = 'ringing'
    setCallState('ringing')

    // Persist the offer so a missed ring broadcast can be recovered
    supabase.from('call_offers').insert({
      call_id: callId,
      caller_id: cu.id,
      callee_id: target,
      offer_json: JSON.stringify(pc.localDescription.toJSON()),
    }).then(({ error }) => {
      if (error) console.error('[call_offers] insert error:', error)
    })

    await ctxSendSignal(target, 'ring', {
      offer: pc.localDescription.toJSON(),
      callType: type,
      fromUser: cu.id,
      fromName,
      callId,
      chatId,
    })
  }

  async function answerCall() {
    ctxStopRing()
    dismissIncoming()
    window._ringtoneAudio?.pause()
    window._ringtoneAudio = null

    const type = callTypeRef.current || 'voice'
    const callerId = callerIdRef.current
    if (!callerId) {
      console.error('[answerCall] callerIdRef is null — cannot answer')
      return
    }
    if (!incomingOfferRef.current) {
      console.error('[answerCall] no offer — cannot setRemoteDescription')
      alert('Call data incomplete. Wait for the call to connect, then try again.')
      return
    }

    claimCallStack?.('chat')

    callDebugGetUserMedia(localStreamRef, { audio: true, video: type === 'video' }, 'answerCall')
    const { stream, audioOnly, lastError } = await acquireCallMedia(type)

    if (!stream) {
      alert(lastError?.name ? `Camera/microphone error: ${lastError.name}` : 'Microphone/camera access denied')
      await declineCall()
      return
    }
    if (audioOnly) setMediaNotice('Camera unavailable — continuing with audio only')

    localStreamRef.current = stream
    if (localMediaStreamRef) localMediaStreamRef.current = stream
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream
      localVideoRef.current.play().catch((err) => {
        if (err.name !== 'AbortError') console.warn('[play]', err.name, err.message)
      })
    }

    const callId = callIdRef.current
    if (!callId) {
      console.error('[answerCall] no callId')
      return
    }

    setCallUiMode?.('full')
    const myId = currentUserRef.current?.id
    const pc = buildPeerConnection('callee')

    await pc.setRemoteDescription(new RTCSessionDescription(incomingOfferRef.current))

    stream.getTracks().forEach((t) => pc.addTrack(t, stream))
    applyLowDataIfConfigured(pc, type)

    for (const c of pendingCandidates.current) {
      try { await pc.addIceCandidate(new RTCIceCandidate(c)) } catch (_) {}
    }
    pendingCandidates.current = []

    if (myId) {
      subscribeToIceCandidates(callId, myId, async (candidate) => {
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
      }, 'chat')
    }

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    await ctxSendSignal(callerId, 'answer', {
      answer: pc.localDescription.toJSON(),
      callId,
    })

    playConnectedSound()
    callStateRef.current = 'in-call'
    setCallState('in-call')
    startCallTimer()
    setActiveCall?.({ callType: type, chatPath: window.location.pathname })

    // No chat row on answer — hangUp writes the final duration when the call ends
  }

  async function declineCall() {
    ctxStopRing()
    dismissIncoming()
    const target = callerIdRef.current || userIdRef.current
    const callId = callIdRef.current
    if (target) {
      await ctxSendSignal(target, 'decline', { callId })
    }
    // Callee declined → notify caller (not "missed from callee")
    onCallMessage?.({
      call_type: callTypeRef.current,
      call_status: 'declined',
      call_notify: 'declined_to_peer',
      body: callTypeRef.current === 'video' ? '📹 Call declined' : '📞 Call declined',
      ...contextListingFields(),
    })
    endCallLocally()
  }

  async function hangUp() {
    playCallEndSound()
    const dur = callDurationRef.current
    const target = callerIdRef.current || userIdRef.current
    const state = callStateRef.current
    const event = (state === 'calling' || state === 'ringing') ? 'cancel' : 'hangup'
    if (target) {
      await ctxSendSignal(target, event, { callId: callIdRef.current })
    }

    if (event === 'cancel') {
      // Caller hung up before answer → peer missed the call
      onCallMessage?.({
        call_type: callTypeRef.current,
        call_status: 'missed',
        call_notify: 'missed_to_peer',
        body: callTypeRef.current === 'video' ? '📹 Missed video call' : '📞 Missed call',
        ...contextListingFields(),
      })
    } else {
      onCallMessage?.({
        call_type: callTypeRef.current,
        call_status: 'ended',
        call_duration: dur,
        body:
          (callTypeRef.current === 'video' ? '📹 Video call' : '📞 Voice call') +
          ' · ' + formatTime(dur),
        ...contextListingFields(),
      })
    }
    endCallLocally()
  }

  // The caller owns the call_offers row — delete it when the call ends.
  // The callee (callerIdRef set) is blocked by RLS and skips this entirely.
  function deleteCallOfferIfCaller() {
    const callId = callIdRef.current
    if (!callId || callerIdRef.current) return
    supabase.from('call_offers').delete().eq('call_id', callId)
      .then(({ error }) => {
        if (error) console.error('[call_offers] delete error:', error)
      })
  }

  function endCallLocally() {
    ctxStopRing()
    stopRingback()
    window._ringtoneAudio?.pause()
    window._ringtoneAudio = null
    clearInterval(callTimerRef.current)
    clearTimeout(autoHangupRef.current)
    autoHangupRef.current = null
    stopLowDataCap(lowDataIntervalRef.current)
    lowDataIntervalRef.current = null
    stopIceSubscription('chat')
    if (callIdRef.current) cleanupIceCandidates(callIdRef.current)
    deleteCallOfferIfCaller()
    try { pcRef.current?.close() } catch (_) {}
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    remoteStreamRef.current = null
    setRemoteStream(null)
    pendingCandidates.current = []
    incomingOfferRef.current = null
    const targetToClose = callerIdRef.current || userIdRef.current
    callIdRef.current = null
    callerIdRef.current = null
    callDurationRef.current = 0
    callStateRef.current = 'idle'
    setCallState('idle')
    setCallDuration(0)
    setIsMuted(false)
    setIsCamOff(false)
    setRemoteStream(null)
    if (remoteMediaStreamRef) remoteMediaStreamRef.current = null
    if (localMediaStreamRef) localMediaStreamRef.current = null
    setActiveCall?.(null)
    clearActiveCall?.()
    releaseCallStack?.('chat')
    setTimeout(() => {
      closeOutboundChannel?.(targetToClose)
    }, 1500)
  }

  function setupCallListener() {
    const unregister = registerCallListener((payload) => {
      const { _event } = payload
      const myCallId = callIdRef.current

      // Incoming ring while this chat is open — only if from current peer
      if (_event === 'ring') {
        const from = payload.fromUser
        if (from && userIdRef.current && from !== userIdRef.current) {
          // Different peer — let GlobalCallListener handle
          return false
        }
        // Prefer GlobalCallListener for UI; do not swallow ring
        return false
      }

      if (_event === 'answer') {
        if (!pcRef.current) return false
        if (!sameCallId(payload.callId, myCallId)) return false
        if (pcRef.current.signalingState !== 'have-local-offer') return true

        pcRef.current
          .setRemoteDescription(new RTCSessionDescription(payload.answer))
          .then(async () => {
            for (const c of pendingCandidates.current) {
              try { await pcRef.current?.addIceCandidate(new RTCIceCandidate(c)) } catch (_) {}
            }
            pendingCandidates.current = []
            deleteCallOfferIfCaller()
            ctxStopRing()
            stopRingback()
            clearTimeout(autoHangupRef.current)
            playConnectedSound()
            callStateRef.current = 'in-call'
            setCallState('in-call')
            startCallTimer()
            setActiveCall?.({ callType: callTypeRef.current, chatPath: window.location.pathname })
          })
          .catch((err) => console.error('[answer] setRemoteDescription error:', err))
        return true
      }

      if (_event === 'hangup' || _event === 'decline' || _event === 'cancel') {
        if (callStateRef.current === 'idle') return false
        if (!sameCallId(payload.callId, myCallId)) return false
        console.log('[useWebRTC] received:', _event)
        stopRingback()
        ctxStopRing()
        playCallEndSound()
        endCallLocally()
        return true
      }

      // Peer switched call type mid-call — apply the new offer, answer, and
      // mirror the media change locally so both ends end up on the same type.
      if (_event === 'renegotiate') {
        if (!pcRef.current) return false
        if (!sameCallId(payload.callId, myCallId)) return false
        const pc = pcRef.current
        const hasVideo = /m=video/.test(payload.offer?.sdp || '')
        pc.setRemoteDescription(new RTCSessionDescription(payload.offer))
          .then(async () => {
            if (hasVideo) {
              // Peer wants video — best-effort enable our own camera too
              const track = await acquireSwitchVideoTrack()
              const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
              if (track && sender) {
                await sender.replaceTrack(track)
              } else if (track) {
                pc.addTrack(track, localStreamRef.current)
              }
              if (track) {
                localStreamRef.current?.addTrack(track)
                setIsCamOff(false)
              }
            } else {
              // Peer went audio-only — drop our local video as well
              const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
              if (sender) {
                try { pc.removeTrack(sender) } catch { /* removeTrack may throw when the PC is closing */ }
                sender.track?.stop()
              }
              const ls = localStreamRef.current
              if (ls) {
                ls.getVideoTracks().forEach((t) => {
                  try { ls.removeTrack(t) } catch { /* track may already be gone */ }
                  t.stop()
                })
              }
            }
            updateCallType(hasVideo ? 'video' : 'voice')
            const replyTarget = callerIdRef.current || userIdRef.current
            if (replyTarget) {
              const answer = await pc.createAnswer()
              await pc.setLocalDescription(answer)
              await ctxSendSignal(replyTarget, 'renegotiate_answer', {
                answer: pc.localDescription.toJSON(),
                callId: payload.callId,
              })
            }
          })
          .catch((err) => console.error('[renegotiate] setRemoteDescription error:', err))
        return true
      }

      // Answer to our own renegotiation — finalize the type switch.
      if (_event === 'renegotiate_answer') {
        if (!pcRef.current) return false
        if (!sameCallId(payload.callId, myCallId)) return false
        const pc = pcRef.current
        if (pc.signalingState !== 'have-local-offer') return false
        pc.setRemoteDescription(new RTCSessionDescription(payload.answer))
          .then(() => {
            const pending = switchPendingRef.current
            if (pending?.target) {
              updateCallType(pending.target)
              if (pending.target === 'video') setIsCamOff(false)
            }
            switchPendingRef.current = null
            clearTimeout(switchTimeoutRef.current)
            switchingRef.current = false
            setSwitching(false)
          })
          .catch((err) => {
            console.error('[renegotiate_answer] setRemoteDescription error:', err)
            switchPendingRef.current = null
            switchingRef.current = false
            setSwitching(false)
          })
        return true
      }

      return false
    })

    return () => {
      unregister()
    }
  }

  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled })
    setIsMuted((m) => !m)
  }

  function toggleCam() {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled })
    setIsCamOff((c) => !c)
  }

  async function switchCamera() {
    if (!localStreamRef.current || !pcRef.current) return
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      const videoDevices = devices.filter((d) => d.kind === 'videoinput')
      if (videoDevices.length < 2) {
        alert('No second camera found on this device.')
        return
      }

      const currentTrack = localStreamRef.current.getVideoTracks()[0]
      const currentDeviceId = currentTrack?.getSettings()?.deviceId
      const currentIndex = videoDevices.findIndex((d) => d.deviceId === currentDeviceId)
      const nextDevice = videoDevices[(currentIndex + 1) % videoDevices.length]

      currentTrack?.stop()
      localStreamRef.current.removeTrack(currentTrack)
      await new Promise((r) => setTimeout(r, 200))

      callDebugGetUserMedia(localStreamRef, { audio: false, video: { deviceId: { exact: nextDevice.deviceId } } }, 'switchCamera')
      const newStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { deviceId: { exact: nextDevice.deviceId } },
      })
      const newTrack = newStream.getVideoTracks()[0]
      if (!newTrack) return

      const sender = pcRef.current.getSenders().find((s) => s.track?.kind === 'video')
      if (sender) await sender.replaceTrack(newTrack)
      localStreamRef.current.addTrack(newTrack)

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = null
        localVideoRef.current.srcObject = localStreamRef.current
      }
      setFacingMode((f) => (f === 'user' ? 'environment' : 'user'))
    } catch (e) {
      console.error('switchCamera error:', e?.name, e?.message)
      alert('Camera switch failed: ' + (e?.name ? `${e.name}: ` : '') + e?.message)
    }
  }

  /**
   * Apply user-selected quality cap at call start (Data Saver / Balanced / High).
   * This sets the initial maxBitrate ceiling before adaptive budget caps engage.
   * The adaptive system in PersistentCallShell.jsx can still step quality lower
   * as the budget depletes, but will never exceed the user's chosen ceiling.
   */
  function applyLowDataIfConfigured(pc, callType) {
    console.log('[applyLowDataIfConfigured] CALLED', { callType })
    stopLowDataCap(lowDataIntervalRef.current)
    lowDataIntervalRef.current = null

    if (callType !== 'video') {
      console.log('[applyLowDataIfConfigured] SKIP: not video call')
      return
    }

    const pref = getCallBudgetPref(callType)
    const quality = pref?.quality || 'balanced'
    console.log('[applyLowDataIfConfigured] User pref:', { pref, quality })

    // Map quality to initial bitrate cap (bits per second)
    let maxBitrate
    if (quality === 'saver') {
      maxBitrate = 40000 // 40 kbit/s
    } else if (quality === 'balanced') {
      maxBitrate = 200000 // 200 kbit/s
    } else {
      // 'high' — no user-imposed ceiling, adaptive system still applies as budget depletes
      console.log('[applyLowDataIfConfigured] Quality is HIGH, no cap applied')
      return
    }
    console.log('[applyLowDataIfConfigured] Target maxBitrate:', maxBitrate, 'bps')

    // Apply the cap to all video senders
    const senders = pc.getSenders()
    console.log('[applyLowDataIfConfigured] Total senders:', senders.length)

    for (const sender of senders) {
      const track = sender.track
      console.log('[applyLowDataIfConfigured] Checking sender:', {
        hasTrack: !!track,
        trackKind: track?.kind,
        trackId: track?.id,
        trackState: track?.readyState,
      })

      if (sender.track?.kind === 'video') {
        console.log('[applyLowDataIfConfigured] Found VIDEO sender, applying cap')

        const paramsBefore = sender.getParameters()
        console.log('[applyLowDataIfConfigured] BEFORE setParameters:', {
          hasEncodings: !!paramsBefore.encodings,
          encodingsLength: paramsBefore.encodings?.length,
          currentMaxBitrate: paramsBefore.encodings?.[0]?.maxBitrate,
          transactionId: paramsBefore.transactionId,
        })

        if (!paramsBefore.encodings || paramsBefore.encodings.length === 0) {
          paramsBefore.encodings = [{}]
        }
        paramsBefore.encodings[0].maxBitrate = maxBitrate

        console.log('[applyLowDataIfConfigured] Calling setParameters with maxBitrate:', maxBitrate)

        sender.setParameters(paramsBefore).then(() => {
          const paramsAfter = sender.getParameters()
          console.log('[applyLowDataIfConfigured] ✅ setParameters SUCCESS:', {
            appliedMaxBitrate: paramsAfter.encodings?.[0]?.maxBitrate,
            fullEncodings: paramsAfter.encodings?.[0],
          })
        }).catch(err => {
          console.error('[applyLowDataIfConfigured] ❌ setParameters FAILED:', err)
        })
      }
    }
  }

  /**
   * Switch the live call between audio and video without dropping it.
   * - To audio: stop + remove the local video track, renegotiate audio-only.
   * - To video: acquire the camera, replace/add the video track, renegotiate
   *   video+audio. Camera failure shows a toast and stays on audio.
   * The peer answers via 'renegotiate' -> 'renegotiate_answer'; the switching
   * state clears when the answer arrives (or after a 6s safety timeout).
   */
  async function switchCallType() {
    if (callStateRef.current !== 'in-call') return
    if (switchingRef.current) return
    const pc = pcRef.current
    const callId = callIdRef.current
    const target = callerIdRef.current || userIdRef.current
    if (!pc || !callId || !target) return

    const goingVideo = callTypeRef.current !== 'video'
    switchingRef.current = true
    setSwitching(true)

    try {
      if (goingVideo) {
        let videoTrack = null
        try {
          const vid = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          videoTrack = vid.getVideoTracks()[0]
        } catch (err) {
          console.error('[switchToVideo] camera error:', err?.name, err?.message)
          setMediaNotice('Camera unavailable — staying on audio')
          return
        }
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender) {
          await sender.replaceTrack(videoTrack)
        } else {
          pc.addTrack(videoTrack, localStreamRef.current)
        }
        localStreamRef.current?.addTrack(videoTrack)
        videoTrack.enabled = true
        setIsCamOff(false)
        updateCallType('video')
        if (localVideoRef.current && localStreamRef.current) {
          localVideoRef.current.srcObject = localStreamRef.current
        }
      } else {
        // Switch to audio — stop + remove the local video track
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender) {
          try { pc.removeTrack(sender) } catch { /* removeTrack may throw when the PC is closing */ }
          sender.track?.stop()
        }
        const ls = localStreamRef.current
        if (ls) {
          ls.getVideoTracks().forEach((t) => {
            try { ls.removeTrack(t) } catch { /* track may already be gone */ }
            t.stop()
          })
        }
        updateCallType('voice')
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await ctxSendSignal(target, 'renegotiate', {
        offer: pc.localDescription.toJSON(),
        callId,
      })

      switchPendingRef.current = { target: callTypeRef.current, callId }
      clearTimeout(switchTimeoutRef.current)
      switchTimeoutRef.current = setTimeout(() => {
        switchingRef.current = false
        setSwitching(false)
        switchPendingRef.current = null
      }, 6000)
    } catch (err) {
      console.error('[switchCallType] error:', err)
      switchingRef.current = false
      setSwitching(false)
      switchPendingRef.current = null
    }
  }

  async function restorePendingCall(fromUserId) {
    // GlobalCallListener owns the active/incoming media path
    if (getCallStackOwner?.() === 'global') return

    const raw = sessionStorage.getItem('__pendingCall')
    if (!raw) return
    try {
      const pending = JSON.parse(raw)

      // Must have a real SDP offer — never answer with null
      if (!pending.fromUser || !pending.offer) {
        console.warn('[restorePendingCall] missing offer or fromUser — waiting for ring')
        // Keep pending so a later ring / ChatCallHost can retry once offer is stored
        if (!pending.offer) return
        sessionStorage.removeItem('__pendingCall')
        sessionStorage.removeItem('__pendingCallId')
        return
      }

      // Only restore when this chat is with the caller
      if (fromUserId && pending.fromUser !== fromUserId) {
        return
      }

      sessionStorage.removeItem('__pendingCall')
      sessionStorage.removeItem('__pendingCallId')

      const myId = currentUserRef.current?.id
      if (!myId) {
        console.error('[restorePendingCall] currentUser not ready')
        // Re-queue for next mount
        sessionStorage.setItem('__pendingCall', raw)
        return
      }

      callerIdRef.current = pending.fromUser
      incomingOfferRef.current = pending.offer
      callIdRef.current = pending.callId
      updateCallType(pending.callType)

      claimCallStack?.('chat')
      const earlyBuffer = drainEarlyCandidates(pending.callId) || []

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
      }, 'chat')

      for (const c of earlyBuffer) {
        try {
          pendingCandidates.current.push(typeof c === 'string' ? JSON.parse(c) : c)
        } catch (_) {}
      }

      await answerCall()
    } catch (e) {
      console.error('[restorePendingCall] error:', e)
    }
  }

  return {
    callState, callType, callDuration, isMuted, isCamOff, remoteStream,
    localVideoRef, remoteVideoRef, facingMode, mediaNotice, switching,
    startCall, answerCall, declineCall, hangUp, endCallLocally,
    toggleMute, toggleCam, switchCamera, switchCallType, setupCallListener,
    assignRemoteStream, assignLocalStream, restorePendingCall,
  }
}

export function formatTime(s) {
  const n = Math.max(0, Math.floor(Number(s) || 0))
  return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`
}
