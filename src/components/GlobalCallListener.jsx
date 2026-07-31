import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCall } from '../context/CallContext'
import { ICE_SERVERS } from '../lib/webrtc'
import { chatPathFromCallIds } from '../utils/callNotifications'
import { useCallDataBudget } from '../hooks/useCallDataBudget'
import { startLowDataCap, stopLowDataCap } from '../lib/callBitrateCap'
import {
  CallShell,
  CallAvatar,
  CallTitle,
  CallSubtitle,
  CallTypeBadge,
  CallControlBtn,
  CallIcon,
  InCallStage,
  InCallControls,
  CALL_KEYFRAMES,
} from './call/CallUI'

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
  const location = useLocation()
  const {
    registerCallListener,
    dismissIncoming,
    setActiveCall,
    publishActiveCall,
    clearActiveCall,
    callUiMode,
    setCallUiMode,
    minimizeCall,
    expandCall,
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
    claimCallStack,
    releaseCallStack,
    registerMediaControls,
    remoteMediaStreamRef,
    localMediaStreamRef,
    incomingActionsRef,
    setIncomingCall,
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
  const durationRef   = useRef(0)
  const localVideoRef = useRef(null)
  const remoteVideoRef    = useRef(null)
  const remoteStreamRef   = useRef(null)
  const incomingRef       = useRef(null)
  const callStateRef      = useRef('idle')
  /** User tapped Answer before the SDP offer arrived (push-only). */
  const answerWhenReadyRef = useRef(false)
  const lowDataIntervalRef = useRef(null)
  const { sampleUsage } = useCallDataBudget(pcRef)
  const [callState, setCallState] = useState('idle') // 'ringing' | 'in-call' | 'connecting'
  const [duration, setDuration]   = useState(0)
  const [isMuted, setIsMuted]     = useState(false)
  const [isVideo, setIsVideo]         = useState(false)
  const [isCamOff, setIsCamOff]       = useState(false)
  const [remoteStream, setRemoteStream] = useState(null)
  const [connecting, setConnecting] = useState(false)
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

        if (isRinging || isPending || answerWhenReadyRef.current) {
          stopRing()
          stopRingtone()
          dismissIncoming()
          swPendingRef.current = null
          answerWhenReadyRef.current = false
          setConnecting(false)
          incomingRef.current = null
          setIncoming(null)
          callIdRef.current = null
          callerIdRef.current = null
          callStateRef.current = 'idle'
          sessionStorage.removeItem('__globalCallActive')
          sessionStorage.removeItem('__pendingCall')
          sessionStorage.removeItem('__pendingCallId')
          releaseCallStack?.('global')
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
      // Prefer chatId from ring (caller builds correct callerId/listing path)
      const resolvedChatId = payload.chatId || swMeta?.chatId || null
      const nextIncoming = {
        fromUser: payload.fromUser,
        callType: payload.callType,
        offer: payload.offer,
        callId: payload.callId,
        callerName: resolvedName,
        chatId: resolvedChatId,
      }
      setIncoming(nextIncoming)
      incomingRef.current = nextIncoming
      setIncomingCall(payload)
      // Mark global stack busy so Chat does not also auto-answer from sessionStorage
      claimCallStack?.('global')

      // Persist offer so Chat restorePendingCall can succeed *after* user navigates
      // (cleared when answered in place or declined)
      if (payload.offer && payload.fromUser) {
        sessionStorage.setItem('__pendingCallId', payload.callId || '')
        sessionStorage.setItem('__pendingCall', JSON.stringify({
          fromUser: payload.fromUser,
          callType: payload.callType,
          offer: payload.offer,
          callId: payload.callId,
          callerName: resolvedName,
          chatId: resolvedChatId,
        }))
      }

      // Ring already playing from SW push — don't restart it
      if (!swMeta) playRing()

      // User already tapped Answer while waiting for SDP offer
      if (answerWhenReadyRef.current && payload.offer) {
        answerWhenReadyRef.current = false
        setConnecting(false)
        setTimeout(() => {
          answerWithOffer(nextIncoming).catch((e) => {
            console.error('[GlobalCallListener] delayed answer failed', e)
            cleanupCall()
            sessionStorage.setItem('__pendingCallId', nextIncoming.callId || '')
            sessionStorage.setItem('__pendingCall', JSON.stringify({
              fromUser: nextIncoming.fromUser,
              callType: nextIncoming.callType,
              offer: nextIncoming.offer,
              callId: nextIncoming.callId,
              callerName: nextIncoming.callerName,
              chatId: nextIncoming.chatId,
            }))
          })
        }, 0)
      }
      return true
    })

    return unregister
  }, [])

  // Mount-time restore: if we remount while a call ring is buffered (refresh /
  // crash / HMR), reclaim the global stack instead of leaving __globalCallActive
  // orphaned. If the flag is set but there is no pending offer, the call can't
  // be resurrected (WebRTC state is gone) — clear the orphaned flag so it never
  // blocks future SW navigation.
  useEffect(() => {
    const activeCallId = sessionStorage.getItem('__globalCallActive')
    if (!activeCallId) return
    const raw = sessionStorage.getItem('__pendingCall')
    if (!raw) {
      sessionStorage.removeItem('__globalCallActive')
      return
    }
    let restored = null
    try {
      const pending = JSON.parse(raw)
      const reclaimable = pending.offer && pending.fromUser &&
        String(pending.callId) === String(activeCallId)
      if (!reclaimable) {
        sessionStorage.removeItem('__globalCallActive')
        return
      }
      restored = {
        fromUser: pending.fromUser,
        callType: pending.callType,
        offer: pending.offer,
        callId: pending.callId,
        callerName: pending.callerName,
        chatId: pending.chatId,
      }
      callerNameRef.current = pending.callerName || pending.fromUser
      // Claim + consume the pending offer synchronously so the chat stack's
      // restorePendingCall (which only bails on getCallStackOwner() === 'global')
      // cannot also claim this call.
      claimCallStack?.('global')
      sessionStorage.removeItem('__pendingCall')
      sessionStorage.removeItem('__pendingCallId')
      if (myUserIdRef.current) {
        subscribeToIceCandidatesEarly(pending.callId, myUserIdRef.current)
      } else {
        supabase.auth.getUser().then(({ data: { user } }) => {
          if (user) {
            myUserIdRef.current = user.id
            subscribeToIceCandidatesEarly(pending.callId, user.id)
          }
        })
      }
    } catch {
      sessionStorage.removeItem('__globalCallActive')
      return
    }
    // Defer UI state so the sync claim above wins the race with the chat stack.
    setTimeout(() => {
      incomingRef.current = restored
      setIncoming(restored)
      setIncomingCall?.(restored)
    }, 0)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    incomingRef.current = incoming
  }, [incoming])

  useEffect(() => {
    if (!remoteStream) return
    const el = remoteVideoRef.current
    if (!el) return
    if (el.srcObject !== remoteStream) el.srcObject = remoteStream
    if (el.paused) el.play().catch(() => {})
  }, [remoteStream])

  useEffect(() => {
    if (callState !== 'in-call' || !isVideo) return
    requestAnimationFrame(() => {
      const el = localVideoRef.current
      const stream = localStreamRef.current
      if (!el || !stream) return
      if (el.srcObject !== stream) el.srcObject = stream
      if (el.paused) el.play().catch(() => {})
    })
  }, [callState, isVideo])

  function handleDismiss() {
    stopRing()
    stopRingtone()
    setIncoming(null)
    dismissIncoming()
  }

  async function handleAnswer() {
    if (!incoming && !incomingRef.current) return
    const src = incoming || incomingRef.current
    if (!src?.offer) {
      // Wait for realtime ring SDP — do not navigate with offer:null
      answerWhenReadyRef.current = true
      setConnecting(true)
      stopRingtone()
      // Keep ringing / UI until offer arrives
      return
    }
    try {
      await answerWithOffer(src)
    } catch (err) {
      // The in-app answer failed after claiming the stack — tear everything
      // down so __globalCallActive is cleared (unblocking SW navigation), then
      // re-queue the offer so the chat stack / a fresh notification tap can
      // still answer this call as a fallback.
      console.error('[GlobalCallListener] answer failed:', err)
      cleanupCall()
      sessionStorage.setItem('__pendingCallId', src.callId || '')
      sessionStorage.setItem('__pendingCall', JSON.stringify({
        fromUser: src.fromUser,
        callType: src.callType,
        offer: src.offer,
        callId: src.callId,
        callerName: src.callerName,
        chatId: src.chatId,
      }))
    }
  }

  async function answerWithOffer(src) {
    if (!src?.offer || !src.fromUser || !src.callId) {
      console.error('[GlobalCallListener] answerWithOffer missing offer/fromUser/callId')
      setConnecting(false)
      return
    }

    stopRing()
    stopRingtone()
    dismissIncoming()
    setConnecting(false)
    claimCallStack?.('global')

    const type     = src.callType || 'voice'
    const callId   = src.callId
    const callerId = src.fromUser
    const offer    = src.offer

    callIdRef.current   = callId
    callerIdRef.current = callerId
    offerRef.current = offer
    sessionStorage.setItem('__globalCallActive', callId)
    // Clear any stale pending without offer
    sessionStorage.removeItem('__pendingCall')
    sessionStorage.removeItem('__pendingCallId')

    const stream = await navigator.mediaDevices
      .getUserMedia({ audio: true, video: type === 'video' })
      .catch(() => null)

    if (!stream) {
      alert('Microphone/camera access denied')
      await handleDecline()
      return
    }

    localStreamRef.current = stream
    if (localMediaStreamRef) localMediaStreamRef.current = stream
    const myId = myUserIdRef.current

    setIncoming(null)
    incomingRef.current = null
    callStateRef.current = 'in-call'
    setCallState('in-call')
    setCallUiMode?.('full')

    const earlyBuffer = drainEarlyCandidates(callId) || []

    const pc = new RTCPeerConnection(ICE_SERVERS)
    pcRef.current = pc

    pc.ontrack = (e) => {
      remoteStreamRef.current = e.streams[0]
      if (remoteMediaStreamRef) remoteMediaStreamRef.current = e.streams[0]
      setRemoteStream(e.streams[0])
    }

    pc.onicecandidate = async (e) => {
      if (!e.candidate || !myId) return
      await sendIceCandidate(callId, myId, callerId, e.candidate.toJSON())
    }

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'failed') {
        console.warn('[GlobalCallListener] ICE failed')
        cleanupCall()
      }
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') cleanupCall()
    }

    if (myId) {
      subscribeToIceCandidates(callId, myId, async (candidate) => {
        try {
          const cand = typeof candidate === 'string' ? JSON.parse(candidate) : candidate
          if (pcRef.current?.remoteDescription) {
            await pcRef.current.addIceCandidate(new RTCIceCandidate(cand))
          } else {
            pendingICE.current.push(cand)
          }
        } catch (_) {}
      }, 'global')
    }

    await pc.setRemoteDescription(new RTCSessionDescription(offer))
    stream.getTracks().forEach((t) => pc.addTrack(t, stream))
    stopLowDataCap(lowDataIntervalRef.current)
    lowDataIntervalRef.current = startLowDataCap(pc, type)

    for (const c of [...earlyBuffer, ...pendingICE.current]) {
      try {
        const cand = typeof c === 'string' ? JSON.parse(c) : c
        await pc.addIceCandidate(new RTCIceCandidate(cand))
      } catch (_) {}
    }
    pendingICE.current = []

    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)

    await sendSignal(callerId, 'answer', {
      answer: pc.localDescription.toJSON(),
      callId,
    })

    if (type === 'video') setIsVideo(true)

    durationRef.current = 0
    setDuration(0)
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      durationRef.current += 1
      setDuration(durationRef.current)
      sampleUsage().then((bytesUsed) => {
        console.log('[CallDataBudget][global] bytesUsed:', bytesUsed)
      })
      publishActiveCall?.({
        source: 'global',
        status: 'in-call',
        callType: type,
        peerId: callerId,
        peerName: callerNameRef.current || 'Caller',
        duration: durationRef.current,
        isMuted: false,
        isCamOff: false,
        chatPath: chatPathFromCallIds(src.chatId, callerId),
      })
    }, 1000)
    setActiveCall?.({ callType: type, chatPath: 'global' })
    publishActiveCall?.({
      source: 'global',
      status: 'in-call',
      callType: type,
      peerId: callerId,
      peerName: callerNameRef.current || 'Caller',
      duration: 0,
      isMuted: false,
      isCamOff: false,
      chatPath: chatPathFromCallIds(src.chatId, callerId),
    })
    registerMediaControls?.({
      hangUp: handleHangUp,
      toggleMute: () => {
        localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled })
        setIsMuted((m) => {
          const next = !m
          publishActiveCall?.({ isMuted: next })
          return next
        })
      },
      toggleCam: () => {
        localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled })
        setIsCamOff((c) => {
          const next = !c
          publishActiveCall?.({ isCamOff: next })
          return next
        })
      },
      switchCamera: handleSwitchCamera,
      expand: expandCall,
      minimize: minimizeCall,
    })
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = remoteVideoRef.current
        const stream = remoteStreamRef.current
        if (!el || !stream) return
        el.classList?.add?.('call-remote-pip-source')
        if (el.srcObject !== stream) el.srcObject = stream
        if (el.paused) el.play().catch(() => {})
      })
    })
  }

  async function handleDecline() {
    stopRing()
    stopRingtone()
    answerWhenReadyRef.current = false
    setConnecting(false)
    const target = incomingRef.current?.fromUser || callerIdRef.current
    const callId = incomingRef.current?.callId || callIdRef.current
    dismissIncoming()
    console.log('[GlobalCallListener] decline sending to:', target, 'callId:', callId)
    if (target) {
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

  /** Open chat with caller using corrected chatId (callerId/listing). */
  function openCallerChat(src) {
    const path = chatPathFromCallIds(src?.chatId, src?.fromUser)
    navigate(path)
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
    stopLowDataCap(lowDataIntervalRef.current)
    lowDataIntervalRef.current = null
    stopIceSubscription('global')
    if (callIdRef.current) cleanupIceCandidates(callIdRef.current)
    try { pcRef.current?.close() } catch (_) {}
    pcRef.current = null
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    const callerToClose = callerIdRef.current
    closeOutboundChannel?.(callerToClose)
    sessionStorage.removeItem('__globalCallActive')
    sessionStorage.removeItem('__pendingCall')
    sessionStorage.removeItem('__pendingCallId')
    callIdRef.current = null
    callerIdRef.current = null
    offerRef.current = null
    pendingICE.current = []
    incomingRef.current = null
    answerWhenReadyRef.current = false
    setIncoming(null)
    callStateRef.current = 'idle'
    setCallState('idle')
    durationRef.current = 0
    setDuration(0)
    setIsMuted(false)
    setIsCamOff(false)
    setIsVideo(false)
    setRemoteStream(null)
    setConnecting(false)
    setActiveCall?.(null)
    clearActiveCall?.()
    releaseCallStack?.('global')
  }

  // Auto-minimize when navigating away during a global in-call session
  useEffect(() => {
    if (callState !== 'in-call') return
    // Keep full UI only when user expanded; minimize on route change after first paint
    const t = setTimeout(() => {
      // no-op: user can navigate freely; MiniCallBar shows when mode is mini
    }, 0)
    return () => clearTimeout(t)
  }, [location.pathname, callState])

  // When app route changes during in-call, switch to mini so browsing continues
  useEffect(() => {
    if (callState === 'in-call' && callUiMode === 'full') {
      // If user navigates while full screen open, still allow — they see overlay.
      // Mini is set when they explicitly leave or visibility hides.
    }
  }, [location.pathname, callState, callUiMode])

  useEffect(() => {
    if (callState !== 'in-call') return undefined
    const onVis = () => {
      if (document.hidden) minimizeCall?.()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [callState, minimizeCall])

  incomingActionsRef.current = { answer: handleAnswer, decline: handleDecline }
  function toggleMute() {
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = !t.enabled })
    setIsMuted(m => !m)
  }

  function fmt(s) {
    return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`
  }

  if (callState === 'in-call' && callUiMode !== 'mini') {
    const displayName = callerNameRef.current || 'Caller'
    const initial = String(displayName)[0]?.toUpperCase() || '?'
    return (
      <InCallStage
        zIndex={9000}
        isVideo={isVideo}
        name={displayName}
        avatarInitial={initial}
        durationLabel={fmt(duration)}
        remoteVideoRef={remoteVideoRef}
        localVideoRef={localVideoRef}
        warning="You can browse the app — tap the green bar to return"
        controls={(
          <InCallControls
            isVideo={isVideo}
            isMuted={isMuted}
            isCamOff={isCamOff}
            onMute={() => {
              localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = !t.enabled })
              setIsMuted((m) => {
                publishActiveCall?.({ isMuted: !m })
                return !m
              })
            }}
            onCam={() => {
              localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = !t.enabled })
              setIsCamOff((c) => {
                publishActiveCall?.({ isCamOff: !c })
                return !c
              })
            }}
            onHangUp={handleHangUp}
            onFlip={handleSwitchCamera}
            onMinimize={() => minimizeCall?.()}
          />
        )}
      />
    )
  }

  // In-call but mini — media continues; MiniCallBar handles controls
  if (callState === 'in-call' && callUiMode === 'mini') {
    return null
  }

  if (!incoming || callUiMode === 'hidden') return null

  const initial = (incoming.callerName || incoming.fromUser)?.[0]?.toUpperCase() || '?'
  const name = incoming.callerName || 'Incoming call'
  const video = incoming.callType === 'video'

  return (
    <CallShell zIndex={9000}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
        <CallTypeBadge isVideo={video} />
      </div>
      <CallAvatar initial={initial} size={108} pulse />
      <CallTitle>{name}</CallTitle>
      <CallSubtitle>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, justifyContent: 'center' }}>
          {connecting ? (
            <>
              <CallIcon name="loader" size={16} color="rgba(255,255,255,0.55)" />
              Connecting… waiting for call data
            </>
          ) : (
            <>
              <CallIcon name="phoneIncoming" size={16} color="rgba(255,255,255,0.55)" />
              {video ? 'Incoming video call' : 'Incoming voice call'}
            </>
          )}
        </span>
      </CallSubtitle>
      <div style={{
        marginTop: 44,
        display: 'flex',
        gap: 48,
        justifyContent: 'center',
        alignItems: 'flex-end',
      }}>
        <CallControlBtn label="Decline" variant="danger" size={64} onClick={handleDecline} ariaLabel="Decline call">
          <CallIcon name="phoneOff" size={24} color="#fff" />
        </CallControlBtn>
        <CallControlBtn
          label={connecting ? 'Wait…' : 'Answer'}
          variant="successPulse"
          size={72}
          onClick={handleAnswer}
          disabled={connecting}
          ariaLabel="Answer call"
        >
          <CallIcon name={video ? 'video' : 'phone'} size={28} color="#fff" />
        </CallControlBtn>
      </div>
      <style>{CALL_KEYFRAMES}</style>
    </CallShell>
  )
}