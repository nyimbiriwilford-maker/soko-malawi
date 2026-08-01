/**
 * App-level WebRTC host for chat-originated calls.
 * Stays mounted while a call is active so media survives route changes.
 */

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useCall } from '../context/CallContext'
import { useWebRTC, formatTime } from '../hooks/useWebRTC'
import { useCallDataBudget } from '../hooks/useCallDataBudget'
import { getCallBudgetPref } from '../lib/callBudgetPrefs'
import { startLowDataCap, stopLowDataCap, applyMaxBitrateToVideoSender } from '../lib/callBitrateCap'
import CallOverlay from './CallOverlay'

/** Adaptive video-quality steps: maxBitrate in bits/sec per step (0 = normal). */
const ADAPTIVE_CAPS = { 0: null, 1: 200000, 2: 80000, 3: 40000 }

export default function PersistentCallShell() {
  const location = useLocation()
  const {
    boundChat,
    boundChatRef,
    callUiMode,
    setCallUiMode,
    minimizeCall,
    expandCall,
    publishActiveCall,
    clearActiveCall,
    registerMediaControls,
    setChatCallActions,
    remoteMediaStreamRef,
    localMediaStreamRef,
    localStreamRef,
    getCallStackOwner,
    pcRef,
  } = useCall()

  // Keep last binding while mid-call after leaving chat
  const stickyRef = useRef(null)
  if (boundChat) stickyRef.current = boundChat
  const chat = boundChat || stickyRef.current

  const userId = chat?.userId || null
  const currentUser = chat?.currentUser || null
  const listingId = chat?.listingId
  const isServiceChatRef = chat?.isServiceChatRef || { current: false }
  const onCallMessage = chat?.onCallMessage

  const {
    callState,
    callType,
    callDuration,
    isMuted,
    isCamOff,
    remoteStream,
    localVideoRef,
    remoteVideoRef,
    startCall,
    answerCall,
    declineCall,
    hangUp,
    toggleMute,
    toggleCam,
    switchCamera,
    setupCallListener,
    assignRemoteStream,
    assignLocalStream,
    restorePendingCall,
  } = useWebRTC({
    userId,
    currentUser,
    listingId,
    isServiceChat: isServiceChatRef,
    onCallMessage,
  })

  // Live data-usage meter for the in-call overlay (chat stack)
  const { bytesUsed, sampleUsage } = useCallDataBudget(pcRef)
  const sampleUsageRef = useRef(sampleUsage)
  useEffect(() => {
    sampleUsageRef.current = sampleUsage
  }, [sampleUsage])

  useEffect(() => {
    if (callState !== 'in-call') return undefined
    const tick = () => { sampleUsageRef.current?.() }
    tick()
    const intervalId = setInterval(tick, 2000)
    return () => clearInterval(intervalId)
  }, [callState])

  const budgetMb = getCallBudgetPref(callType)?.mb || 0

  // Progressive budget warnings — each threshold fires exactly once per call
  const [budgetWarning, setBudgetWarning] = useState(null)
  const budgetWarningsFiredRef = useRef({ half: false, low: false, critical: false, exhausted: false })
  const budgetCapIntervalRef = useRef(null)
  const budgetSessionRef = useRef(null)

  // Adaptive video quality — steps down as the budget depletes (video calls only)
  const [qualityToast, setQualityToast] = useState(false)
  const qualityStepRef = useRef(0)
  const adaptiveStepsFiredRef = useRef({ medium: false, low: false, ultraLow: false })
  const adaptiveCapIntervalRef = useRef(null)
  const qualitySessionRef = useRef(null)
  const qualityLockedRef = useRef(false)

  const budgetBytes = budgetMb > 0 ? budgetMb * 1024 * 1024 : 0

  function adaptiveStepForRemaining(remaining) {
    if (remaining > 0.5) return 0
    if (remaining > 0.25) return 1
    if (remaining > 0.1) return 2
    return 3
  }

  function applyAdaptiveCap(step) {
    const pc = pcRef.current
    const bits = ADAPTIVE_CAPS[step]
    if (!pc || !bits) return
    applyMaxBitrateToVideoSender(pc, bits)
  }

  function ensureAdaptiveInterval() {
    if (adaptiveCapIntervalRef.current) return
    adaptiveCapIntervalRef.current = setInterval(() => {
      applyAdaptiveCap(qualityStepRef.current)
    }, 5000)
  }

  function restoreNormalQuality() {
    qualityStepRef.current = 0
    stopLowDataCap(adaptiveCapIntervalRef.current)
    adaptiveCapIntervalRef.current = null
  }

  // Clear any manual/adaptive cap interval once the call is over
  useEffect(() => {
    if (callState === 'in-call') return
    stopLowDataCap(budgetCapIntervalRef.current)
    budgetCapIntervalRef.current = null
    stopLowDataCap(adaptiveCapIntervalRef.current)
    adaptiveCapIntervalRef.current = null
  }, [callState])

  // Fire warnings as the budget ratio crosses 50 / 75 / 90 / 100%.
  // A new RTCPeerConnection means a new call, so reset the fired refs then.
  useEffect(() => {
    if (callState !== 'in-call' || budgetBytes <= 0) return
    if (budgetSessionRef.current !== pcRef.current) {
      budgetSessionRef.current = pcRef.current
      budgetWarningsFiredRef.current = { half: false, low: false, critical: false, exhausted: false }
      setBudgetWarning(null)
      return
    }
    const fired = budgetWarningsFiredRef.current
    const ratio = bytesUsed / budgetBytes
    if (ratio >= 0.5 && !fired.half) {
      fired.half = true
      setBudgetWarning({ level: 'half' })
    }
    if (ratio >= 0.75 && !fired.low) {
      fired.low = true
      setBudgetWarning({ level: 'low' })
    }
    if (ratio >= 0.9 && !fired.critical) {
      fired.critical = true
      setBudgetWarning({ level: 'critical' })
    }
    if (ratio >= 1 && !fired.exhausted) {
      fired.exhausted = true
      setBudgetWarning({ level: 'exhausted' })
    }
  }, [bytesUsed, callState, budgetBytes])

  // Adaptive video quality — video calls only; steps down as remaining budget
  // falls (normal > 200k > 80k > 40k). Never auto-restores up; a new
  // RTCPeerConnection means a new call, so reset the step tracking then.
  useEffect(() => {
    if (callState !== 'in-call' || budgetBytes <= 0 || callType !== 'video') return
    if (qualitySessionRef.current !== pcRef.current) {
      qualitySessionRef.current = pcRef.current
      qualityStepRef.current = 0
      adaptiveStepsFiredRef.current = { medium: false, low: false, ultraLow: false }
      qualityLockedRef.current = false
      restoreNormalQuality()
      setQualityToast(false)
      return
    }
    if (qualityLockedRef.current) return
    const remaining = 1 - bytesUsed / budgetBytes
    const target = adaptiveStepForRemaining(remaining)
    if (target > qualityStepRef.current) {
      qualityStepRef.current = target
      const fired = adaptiveStepsFiredRef.current
      if (target >= 1 && !fired.medium) fired.medium = true
      if (target >= 2 && !fired.low) fired.low = true
      if (target >= 3 && !fired.ultraLow) fired.ultraLow = true
      applyAdaptiveCap(target)
      ensureAdaptiveInterval()
      setQualityToast(true)
    }
  }, [bytesUsed, callState, budgetBytes, callType]) // eslint-disable-line react-hooks/exhaustive-deps

  // Quality-step toast auto-dismisses
  useEffect(() => {
    if (!qualityToast) return undefined
    const t = setTimeout(() => setQualityToast(false), 4000)
    return () => clearTimeout(t)
  }, [qualityToast])

  // Toast warnings auto-dismiss; the exhausted modal stays until an action
  useEffect(() => {
    if (!budgetWarning || budgetWarning.level === 'exhausted') return undefined
    const t = setTimeout(() => setBudgetWarning(null), 4000)
    return () => clearTimeout(t)
  }, [budgetWarning])

  function handleBudgetAction(action) {
    if (action === 'continue') {
      setBudgetWarning(null)
      // Manual restore: undo any adaptive cap and stop further auto step-downs
      restoreNormalQuality()
      qualityLockedRef.current = true
      return
    }
    if (action === 'reduceVideo') {
      if (pcRef.current) {
        const intervalId = startLowDataCap(pcRef.current, callType)
        if (intervalId) {
          stopLowDataCap(budgetCapIntervalRef.current)
          budgetCapIntervalRef.current = intervalId
        } else {
          applyMaxBitrateToVideoSender(pcRef.current)
        }
      }
      setBudgetWarning(null)
      return
    }
    if (action === 'audioOnly') {
      const stream = localStreamRef.current
      if (stream) {
        stream.getVideoTracks().forEach((t) => {
          t.stop()
          stream.removeTrack(t)
        })
      }
      if (!isCamOff) toggleCam?.()
      setBudgetWarning(null)
      return
    }
    if (action === 'endCall') {
      setBudgetWarning(null)
      ;(async () => {
        await hangUp()
        clearActiveCall?.()
        if (!boundChat) stickyRef.current = null
      })()
    }
  }

  // Expose startCall to chat header buttons (ref always fresh; version only on callState)
  const chatCallActionsRefLocal = useRef({ startCall, callState, hangUp, formatTime })
  chatCallActionsRefLocal.current = { startCall, callState, hangUp, formatTime }
  useEffect(() => {
    setChatCallActions?.(chatCallActionsRefLocal.current)
  }, [callState, setChatCallActions])

  useEffect(() => {
    if (chat) {
      stickyRef.current = chat
      if (boundChatRef) boundChatRef.current = chat
    }
  }, [chat, boundChatRef])

  // Media attach — only sets srcObject when the stream actually changes (no blink)
  useEffect(() => {
    assignRemoteStream()
    if (remoteStream) remoteMediaStreamRef.current = remoteStream
  }, [remoteStream]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (callState === 'in-call') {
      assignRemoteStream()
      assignLocalStream()
    }
  }, [callState]) // eslint-disable-line react-hooks/exhaustive-deps

  // After paint (when <video> mounts), re-bind only if missing — safe during duration ticks
  useLayoutEffect(() => {
    if (callState !== 'in-call') return
    assignRemoteStream()
    assignLocalStream()
  })

  useEffect(() => {
    if (!userId) return undefined
    return setupCallListener()
  }, [userId]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentUser?.id || !userId) return
    restorePendingCall(userId)
  }, [currentUser?.id, userId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Publish active call for MiniCallBar + register controls
  useEffect(() => {
    if (callState === 'idle') {
      if (getCallStackOwner?.() === 'chat' || !getCallStackOwner?.()) {
        // only clear if we were the chat stack
      }
      return
    }

    const chatPath = userId
      ? (listingId && listingId !== 'undefined'
          ? `/chat/${userId}/${listingId}`
          : `/chat/${userId}`)
      : location.pathname

    publishActiveCall({
      source: 'chat',
      status: callState,
      callType,
      peerId: userId,
      peerName: chat?.otherName || 'Contact',
      peerAvatar: chat?.otherAvatar || null,
      peerInitial: chat?.otherInitial || '?',
      duration: callDuration,
      isMuted,
      isCamOff,
      chatPath,
      listingId: listingId || null,
    })
  }, [
    callState, callType, callDuration, isMuted, isCamOff,
    userId, listingId, chat?.otherName, chat?.otherAvatar, chat?.otherInitial,
    location.pathname,
  ]) // eslint-disable-line react-hooks/exhaustive-deps

  // UI mode + media controls — do not re-register every duration second
  useEffect(() => {
    if (callState === 'idle') return
    if (callState === 'calling' || callState === 'ringing' || callState === 'in-call' || callState === 'receiving') {
      if (callUiMode === 'hidden') setCallUiMode('full')
    }
    registerMediaControls({
      hangUp,
      toggleMute,
      toggleCam,
      switchCamera,
      expand: expandCall,
      minimize: minimizeCall,
    })
  }, [callState, callType, isMuted, isCamOff]) // eslint-disable-line react-hooks/exhaustive-deps

  // Clear session when call ends
  useEffect(() => {
    if (callState !== 'idle') return
    if (getCallStackOwner?.() && getCallStackOwner() !== 'chat') return
    // Delay slightly so hangup can finish
    const t = setTimeout(() => {
      if (getCallStackOwner?.() === 'chat') return
      // Only clear if still idle and sticky was ours
      clearActiveCall?.()
      stickyRef.current = boundChatRef?.current || null
    }, 200)
    return () => clearTimeout(t)
  }, [callState]) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-minimize when leaving chat routes during an active call
  useEffect(() => {
    if (callState === 'idle') return
    const onChat = location.pathname.startsWith('/chat') || location.pathname.startsWith('/chats')
    if (!onChat && (callState === 'in-call' || callState === 'calling' || callState === 'ringing')) {
      minimizeCall?.()
    }
    if (onChat && callState === 'in-call' && callUiMode === 'mini') {
      // stay mini until user expands â€” do not force full
    }
  }, [location.pathname, callState]) // eslint-disable-line react-hooks/exhaustive-deps

  // Keep remote stream ref for audio sink
  useEffect(() => {
    remoteMediaStreamRef.current = remoteStream || null
  }, [remoteStream, remoteMediaStreamRef])

  // Browse button on full overlay
  useEffect(() => {
    const onMin = () => minimizeCall?.()
    window.addEventListener('sokomw-minimize-call', onMin)
    return () => window.removeEventListener('sokomw-minimize-call', onMin)
  }, [minimizeCall])

  // Background tab â†’ mini
  useEffect(() => {
    if (callState === 'idle') return undefined
    const onVis = () => {
      if (document.hidden) minimizeCall?.()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => document.removeEventListener('visibilitychange', onVis)
  }, [callState, minimizeCall])

  const showFull =
    callUiMode === 'full' &&
    callState !== 'idle' &&
    (getCallStackOwner?.() === 'chat' || callState !== 'idle')

  // Don't show chat overlay if global stack owns the call
  const owner = getCallStackOwner?.()
  const allowOverlay = showFull && owner !== 'global'

  if (!chat && callState === 'idle') return null

  return (
    <>
      {allowOverlay && (
        <CallOverlay
          callState={callState}
          callType={callType}
          callDuration={callDuration}
          otherName={chat?.otherName || 'Contact'}
          otherAvatar={chat?.otherAvatar}
          otherInitial={chat?.otherInitial || '?'}
          isMuted={isMuted}
          isCamOff={isCamOff}
          remoteVideoRef={remoteVideoRef}
          localVideoRef={localVideoRef}
          hangUp={async () => {
            await hangUp()
            clearActiveCall?.()
            if (!boundChat) stickyRef.current = null
          }}
          answerCall={answerCall}
          declineCall={declineCall}
          toggleMute={toggleMute}
          toggleCam={toggleCam}
          switchCamera={switchCamera}
          formatTime={formatTime}
          bytesUsed={bytesUsed}
          budgetMb={budgetMb}
          budgetWarning={budgetWarning}
          onBudgetAction={handleBudgetAction}
          qualityToast={qualityToast}
        />
      )}
    </>
  )
}


