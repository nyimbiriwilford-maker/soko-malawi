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
  /** User committed to answer — from tap until the call is in-call or fully torn down. */
  const answerCommittedRef = useRef(false)
  const lowDataIntervalRef = useRef(null)
  const offerRecoveryTimerRef = useRef(null)
  const offerGiveUpTimerRef = useRef(null)
  const callErrorTimerRef = useRef(null)
  const switchingRef = useRef(false)
  const switchTimeoutRef = useRef(null)
  const isVideoRef = useRef(false)
  const { sampleUsage } = useCallDataBudget(pcRef)
  const [callState, setCallState] = useState('idle') // 'ringing' | 'in-call' | 'connecting'
  const [duration, setDuration]   = useState(0)
  const [isMuted, setIsMuted]     = useState(false)
  const [isVideo, setIsVideo]         = useState(false)
  const [isCamOff, setIsCamOff]       = useState(false)
  const [remoteStream, setRemoteStream] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [callError, setCallError] = useState(null)
  const [switching, setSwitching] = useState(false)
  const [notice, setNotice] = useState(null)
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) myUserIdRef.current = user.id
    })
  }, [])

  // Listen for push notification incoming call (when app is open)
  useEffect(() => {
    function handleSwIncoming(e) {
      const { callId, fromUser, chatId, callType, callerName } = e.detail

      // Already connected, or the user has committed to answering this call —
      // never re-ring or re-surface the incoming UI for a duplicate SW event.
      if (callStateRef.current === 'in-call') return
      if (answerCommittedRef.current) return
      // First success wins: a duplicate push for a callId that is already being
      // readied (buffered) or already surfaced must not arm a second recovery /
      // play a second ringtone.
      const swKey = String(callId)
      if (String(swPendingRef.current?.callId) === swKey) return
      if (String(incomingRef.current?.callId) === swKey) return

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
      // If the realtime ring (with the SDP offer) never arrives, recover the
      // offer from call_offers after a short delay, else give up after 30s.
      armOfferRecovery({ callId, fromUser, callType, chatId, callerName })
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
          answerCommittedRef.current = false
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

      if (payload._event === 'renegotiate') {
        if (callStateRef.current !== 'in-call' || !pcRef.current) return false
        if (String(payload.callId) !== String(callIdRef.current)) return false
        handleIncomingRenegotiate(payload.offer, payload.callId)
        return true
      }

      if (payload._event === 'renegotiate_answer') {
        if (callStateRef.current !== 'in-call' || !pcRef.current) return false
        if (String(payload.callId) !== String(callIdRef.current)) return false
        handleIncomingRenegotiateAnswer(payload.answer, payload.callId)
        return true
      }

      if (payload._event !== 'ring') return false

      // ── Answered/active call is the single source of truth ──
      // Once the user has committed to answer (or the call is connected), a ring
      // must NEVER re-surface the incoming popup. If this ring happens to carry
      // the SDP offer the committed answer was waiting for, complete the answer
      // directly instead of ringing again.
      if (callStateRef.current === 'in-call') {
        swPendingRef.current = null
        return true
      }
      if (answerCommittedRef.current) {
        const swMetaForCommit = swPendingRef.current?.callId === payload.callId
          ? swPendingRef.current : null
        if (answerWhenReadyRef.current && payload.offer) {
          swPendingRef.current = null
          answerWhenReadyRef.current = false
          setConnecting(false)
          const commitIncoming = {
            fromUser: payload.fromUser,
            callType: payload.callType,
            offer: payload.offer,
            callId: payload.callId,
            callerName: payload.fromName || swMetaForCommit?.callerName || payload.fromUser,
            chatId: payload.chatId || swMetaForCommit?.chatId || null,
          }
          setTimeout(() => {
            answerWithOffer(commitIncoming).catch((e) => {
              console.error('[GlobalCallListener] delayed answer failed', e)
              cleanupCall()
              sessionStorage.setItem('__pendingCallId', commitIncoming.callId || '')
              sessionStorage.setItem('__pendingCall', JSON.stringify({
                fromUser: commitIncoming.fromUser,
                callType: commitIncoming.callType,
                offer: commitIncoming.offer,
                callId: commitIncoming.callId,
                callerName: commitIncoming.callerName,
                chatId: commitIncoming.chatId,
              }))
            })
          }, 0)
        } else {
          swPendingRef.current = null
        }
        return true
      }

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

      // ── Exactly-once offer surfacing (first success wins) ──
      // The same ring can be delivered multiple times (SW push redundancy, relay
      // replay, double-fired startCall). The first ring that surfaced this
      // callId wins — later copies never re-surface the incoming UI or restart
      // the ringtone for a call that is already on screen.
      if (incomingRef.current && String(incomingRef.current.callId) === String(payload.callId)) {
        return true
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
    if (el.paused) el.play().catch((err) => { if (err.name !== 'AbortError') console.warn('[play]', err.name, err.message) })
  }, [remoteStream])

  useEffect(() => {
    if (callState !== 'in-call' || !isVideo) return
    requestAnimationFrame(() => {
      const el = localVideoRef.current
      const stream = localStreamRef.current
      if (!el || !stream) return
      if (el.srcObject !== stream) el.srcObject = stream
      if (el.paused) el.play().catch((err) => { if (err.name !== 'AbortError') console.warn('[play]', err.name, err.message) })
    })
  }, [callState, isVideo])

  useEffect(() => {
    isVideoRef.current = isVideo
  }, [isVideo])

  // Non-blocking camera-unavailable notice, auto-dismisses
  useEffect(() => {
    if (!notice) return undefined
    const t = setTimeout(() => setNotice(null), 4000)
    return () => clearTimeout(t)
  }, [notice])

  function handleDismiss() {
    stopRing()
    stopRingtone()
    setIncoming(null)
    dismissIncoming()
  }

  async function handleAnswer() {
    if (!incoming && !incomingRef.current) {
      console.error('[handleAnswer] ❌ No incoming call data')
      return
    }

    const src = incoming || incomingRef.current

    answerCommittedRef.current = true

    if (!src?.offer) {
      // Wait for realtime ring SDP — do not navigate with offer:null
      answerWhenReadyRef.current = true
      setConnecting(true)
      stopRingtone()
      dismissIncoming()
      // Keep ringing / UI until offer arrives
      armOfferRecovery(src)
      return
    }

    try {
      await answerWithOffer(src)
    } catch (err) {
      // The in-app answer failed after claiming the stack — tear everything
      // down so __globalCallActive is cleared (unblocking SW navigation), then
      // re-queue the offer so the chat stack / a fresh notification tap can
      // still answer this call as a fallback.
      console.error('[handleAnswer] ❌ answerWithOffer failed:', err)
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
      console.error('[answerWithOffer] ❌ Missing required data:', {
        hasOffer: !!src?.offer,
        hasFromUser: !!src?.fromUser,
        hasCallId: !!src?.callId,
      })
      setConnecting(false)
      answerCommittedRef.current = false
      dismissIncoming()
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

    const constraints = { audio: true, video: type === 'video' }
    let gUMError = null
    let stream = await navigator.mediaDevices
      .getUserMedia(constraints)
      .catch((err) => {
        gUMError = err
        console.error('[answerWithOffer] ❌ getUserMedia failed:', err?.name, err?.message)
        return null
      })

    if (!stream && gUMError?.name === 'NotReadableError') {
      await new Promise((r) => setTimeout(r, 1000))
      stream = await navigator.mediaDevices
        .getUserMedia(constraints)
        .catch((err) => {
          gUMError = err
          console.error('[answerWithOffer] ❌ getUserMedia retry failed:', err?.name, err?.message)
          return null
        })
    }

    if (!stream) {
      console.error('[answerWithOffer] ❌ No media stream — declining call')
      alert(gUMError?.name ? `Camera/microphone error: ${gUMError.name}` : 'Microphone/camera access denied')
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
        console.warn('[answerWithOffer] ❌ ICE failed')
        cleanupCall()
      }
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') {
        console.warn('[answerWithOffer] ❌ Connection failed')
        cleanupCall()
      }
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
      sampleUsage()
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
        if (el.paused) el.play().catch((err) => { if (err.name !== 'AbortError') console.warn('[play]', err.name, err.message) })
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
    if (target) {
      await sendSignal(target, 'decline', { callId })
    }
    cleanupCall()
  }

  async function handleHangUp() {
    const target = callerIdRef.current
    const callId = callIdRef.current
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
    } catch (e) {
      console.error('switchCamera error:', e?.name, e?.message)
      alert('Camera switch failed: ' + (e?.name ? `${e.name}: ` : '') + e?.message)
    }
  }

  function cleanupCall() {
    clearTimeout(offerRecoveryTimerRef.current)
    clearTimeout(offerGiveUpTimerRef.current)
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
    answerCommittedRef.current = false
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

  /** Switch the live call between audio and video without dropping it. */
  async function handleSwitchCallType() {
    if (callStateRef.current !== 'in-call') return
    if (switchingRef.current) return
    const pc = pcRef.current
    const callId = callIdRef.current
    const target = callerIdRef.current
    if (!pc || !callId || !target) return

    const goingVideo = !isVideoRef.current
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
          setNotice('Camera unavailable — staying on audio')
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
        setIsVideo(true)
        isVideoRef.current = true
        stopLowDataCap(lowDataIntervalRef.current)
        lowDataIntervalRef.current = startLowDataCap(pc, 'video')
        publishActiveCall?.({ callType: 'video', isCamOff: false })
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
        setIsVideo(false)
        isVideoRef.current = false
        stopLowDataCap(lowDataIntervalRef.current)
        lowDataIntervalRef.current = startLowDataCap(pc, 'voice')
        publishActiveCall?.({ callType: 'voice' })
      }

      const offer = await pc.createOffer()
      await pc.setLocalDescription(offer)
      await sendSignal(target, 'renegotiate', {
        offer: pc.localDescription.toJSON(),
        callId,
      })

      clearTimeout(switchTimeoutRef.current)
      switchTimeoutRef.current = setTimeout(() => {
        switchingRef.current = false
        setSwitching(false)
      }, 6000)
    } catch (err) {
      console.error('[GlobalCallListener] switch call type error:', err)
      switchingRef.current = false
      setSwitching(false)
    }
  }

  /** Peer switched type — apply offer, mirror media locally, answer. */
  async function handleIncomingRenegotiate(offer, callId) {
    const pc = pcRef.current
    if (!pc) return
    try {
      const hasVideo = /m=video/.test(offer?.sdp || '')
      await pc.setRemoteDescription(new RTCSessionDescription(offer))
      if (hasVideo) {
        // Peer wants video — best-effort enable our own camera too
        let track = null
        try {
          const vid = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
          track = vid.getVideoTracks()[0]
        } catch (err) {
          console.error('[switchToVideo] peer-requested camera error:', err?.name, err?.message)
        }
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (track && sender) {
          await sender.replaceTrack(track)
        } else if (track) {
          pc.addTrack(track, localStreamRef.current)
        }
        if (track) {
          localStreamRef.current?.addTrack(track)
          track.enabled = true
          setIsCamOff(false)
        }
        setIsVideo(true)
        isVideoRef.current = true
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
        setIsVideo(false)
        isVideoRef.current = false
      }
      stopLowDataCap(lowDataIntervalRef.current)
      lowDataIntervalRef.current = startLowDataCap(pc, hasVideo ? 'video' : 'voice')
      publishActiveCall?.({ callType: hasVideo ? 'video' : 'voice' })

      if (callerIdRef.current) {
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        await sendSignal(callerIdRef.current, 'renegotiate_answer', {
          answer: pc.localDescription.toJSON(),
          callId,
        })
      }
    } catch (err) {
      console.error('[GlobalCallListener] renegotiate error:', err)
    }
  }

  /** Answer to our own renegotiation — finalize the type switch. */
  async function handleIncomingRenegotiateAnswer(answer) {
    const pc = pcRef.current
    if (!pc || pc.signalingState !== 'have-local-offer') return
    try {
      await pc.setRemoteDescription(new RTCSessionDescription(answer))
    } catch (err) {
      console.error('[GlobalCallListener] renegotiate_answer error:', err)
    } finally {
      switchingRef.current = false
      setSwitching(false)
      clearTimeout(switchTimeoutRef.current)
    }
  }

  /** Fetch a persisted offer for a callId from the call_offers table. */
  async function fetchCallOffer(callId) {
    try {
      const { data, error } = await supabase
        .from('call_offers')
        .select('offer_json')
        .eq('call_id', callId)
        .maybeSingle()
      if (error) {
        console.error('[call_offers] fetch error:', error)
        return null
      }
      if (!data?.offer_json) return null
      try {
        return typeof data.offer_json === 'string' ? JSON.parse(data.offer_json) : data.offer_json
      } catch {
        return null
      }
    } catch (e) {
      console.error('[call_offers] fetch error:', e)
      return null
    }
  }

  function showCallError(message) {
    setCallError(message)
    clearTimeout(callErrorTimerRef.current)
    callErrorTimerRef.current = setTimeout(() => setCallError(null), 5000)
  }

  /**
   * Recover a call whose offer never arrived:
   * - 4s in: if still waiting, fetch the offer from call_offers; if found, show
   *   the incoming UI (and auto-answer if the user already tapped Answer).
   * - 30s in: if still no offer, decline the call and show "Call could not connect".
   */
  function armOfferRecovery(callInfo) {
    if (!callInfo?.callId) return
    const callId = callInfo.callId
    clearTimeout(offerRecoveryTimerRef.current)
    clearTimeout(offerGiveUpTimerRef.current)

    offerRecoveryTimerRef.current = setTimeout(async () => {
      const stillWaiting =
        swPendingRef.current?.callId === callId ||
        (answerWhenReadyRef.current && incomingRef.current?.callId === callId)
      if (!stillWaiting) return
      const offer = await fetchCallOffer(callId)
      if (!offer) return // give-up timer handles expiry

      const src = {
        fromUser: swPendingRef.current?.fromUser || incomingRef.current?.fromUser || callInfo.fromUser,
        callType: swPendingRef.current?.callType || incomingRef.current?.callType || callInfo.callType,
        chatId: swPendingRef.current?.chatId || incomingRef.current?.chatId || callInfo.chatId,
        callerName: swPendingRef.current?.callerName || incomingRef.current?.callerName || callInfo.callerName,
        callId,
        offer,
      }
      const autoAnswer = answerWhenReadyRef.current
      swPendingRef.current = null
      answerWhenReadyRef.current = false
      setConnecting(false)
      incomingRef.current = src
      setIncoming(src)
      clearTimeout(offerGiveUpTimerRef.current)
      if (autoAnswer) {
        // User already tapped Answer — complete the call without re-showing the popup.
        answerWithOffer(src).catch((err) => {
          console.error('[GlobalCallListener] recovered-offer answer failed:', err)
          cleanupCall()
        })
      } else {
        setIncomingCall?.(src)
      }
    }, 4000)

    offerGiveUpTimerRef.current = setTimeout(() => {
      const stillWaiting =
        swPendingRef.current?.callId === callId ||
        (answerWhenReadyRef.current && incomingRef.current?.callId === callId)
      if (!stillWaiting) return
      console.warn('[GlobalCallListener] no offer after 30s — cannot connect', callId)
      // Ensure the decline can reach the caller even in the push-only case
      incomingRef.current = {
        ...(incomingRef.current || {}),
        fromUser: incomingRef.current?.fromUser || swPendingRef.current?.fromUser || callInfo.fromUser,
        callId: incomingRef.current?.callId || callId,
      }
      swPendingRef.current = null
      answerWhenReadyRef.current = false
      setConnecting(false)
      handleDecline()
      showCallError('Call could not connect')
    }, 30000)
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

  const callErrorToast = callError ? (
    <div style={{
      position: 'fixed',
      left: 0,
      right: 0,
      bottom: 140,
      zIndex: 9200,
      display: 'flex',
      justifyContent: 'center',
      padding: '0 20px',
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'rgba(239,68,68,0.16)',
        border: '1px solid rgba(239,68,68,0.5)',
        color: '#fecaca',
        borderRadius: 999,
        padding: '10px 18px',
        fontSize: 13,
        fontWeight: 650,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
        textAlign: 'center',
        maxWidth: '100%',
      }}>
        {callError}
      </div>
    </div>
  ) : null

  if (callState === 'in-call' && callUiMode !== 'mini') {
    const displayName = callerNameRef.current || 'Caller'
    const initial = String(displayName)[0]?.toUpperCase() || '?'
    return (
      <>
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
              onSwitchType={handleSwitchCallType}
              switching={switching}
              onMinimize={() => minimizeCall?.()}
            />
          )}
        />
        {callErrorToast}
        {notice && (
          <div style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 150,
            zIndex: 9500,
            display: 'flex',
            justifyContent: 'center',
            padding: '0 20px',
            pointerEvents: 'none',
          }}>
            <div style={{
              background: 'rgba(249, 171, 0, 0.16)',
              border: '1px solid rgba(249, 171, 0, 0.5)',
              color: '#ffe08a',
              borderRadius: 999,
              padding: '10px 18px',
              fontSize: 13,
              fontWeight: 650,
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
              textAlign: 'center',
              maxWidth: '100%',
            }}>
              {notice}
            </div>
          </div>
        )}
      </>
    )
  }

  // In-call but mini — media continues; MiniCallBar handles controls
  if (callState === 'in-call' && callUiMode === 'mini') {
    return callErrorToast
  }

  if (!incoming || callUiMode === 'hidden') return callErrorToast

  const initial = (incoming.callerName || incoming.fromUser)?.[0]?.toUpperCase() || '?'
  const name = incoming.callerName || 'Incoming call'
  const video = incoming.callType === 'video'

  return (
    <>
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
      {callErrorToast}
    </>
  )
}

