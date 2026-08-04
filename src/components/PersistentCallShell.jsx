/**
 * App-level WebRTC host for chat-originated calls.
 * Stays mounted while a call is active so media survives route changes.
 */

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useCall } from '../context/CallContext'
import { useWebRTC, formatTime } from '../hooks/useWebRTC'
import { useCallDataBudget } from '../hooks/useCallDataBudget'
import useCallBudgetManager from '../hooks/useCallBudgetManager'
import { getCallBudgetPref, saveCallUsageRecord } from '../lib/callBudgetPrefs'
import CallOverlay from './CallOverlay'

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
    mediaNotice,
    switching,
    startCall,
    answerCall,
    declineCall,
    hangUp,
    toggleMute,
    toggleCam,
    switchCamera,
    switchCallType,
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

  const prefBudgetMb = useMemo(
    () => getCallBudgetPref(callType)?.mb || 0,
    [callType]
  )

  const { budgetWarning, qualityToast, handleBudgetAction, liveBudgetMb, isBudgetExtended } = useCallBudgetManager({
    bytesUsed,
    budgetMb: prefBudgetMb,
    callType,
    callState,
    pcRef,
    hangUp,
    clearActiveCall,
    boundChat,
    stickyRef,
  })

  // Mutable budget — the manager can grow it mid-call via extend actions. Its
  // live value only seeds once a call session is in-call, so until then it is
  // still the app-mount default (0). Fall back to the saved pref so the meter
  // and summary always see the budget.
  const budgetMb = liveBudgetMb > 0 ? liveBudgetMb : prefBudgetMb

  const [callSummary, setCallSummary] = useState(null)
  const [prevCallState, setPrevCallState] = useState(callState)

  if (callState !== prevCallState) {
    setPrevCallState(callState)
    if (callState === 'idle') {
      // Summary only for budgeted calls — standard calls (budgetMb 0) get none
      setCallSummary(
        budgetMb > 0
          ? { duration: callDuration, bytesUsed, budgetMb, callType, wasExtended: isBudgetExtended() }
          : null
      )
    } else {
      setCallSummary(null)
    }
  }

  // Record data usage for future budget recommendations (effect, not render)
  useEffect(() => {
    if (callState === 'idle' && callSummary) {
      saveCallUsageRecord(callSummary.callType, callSummary.bytesUsed, callSummary.duration)
    }
  }, [callState, callSummary])

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
    if (callState === 'idle') return

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
  ])

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
  const showIdleContent = callSummary || callState !== 'idle'
  const allowOverlay = (callSummary || showFull) && owner !== 'global'

  if (!chat && !showIdleContent) return null

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
          switchCallType={switchCallType}
          switching={switching}
          formatTime={formatTime}
          bytesUsed={bytesUsed}
          budgetMb={budgetMb}
          budgetWarning={budgetWarning}
          onBudgetAction={handleBudgetAction}
          qualityToast={qualityToast}
          callSummary={callSummary}
          onDismissSummary={() => setCallSummary(null)}
        />
      )}
      {mediaNotice && (
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
            {mediaNotice}
          </div>
        </div>
      )}
    </>
  )
}


