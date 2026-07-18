/**
 * App-level WebRTC host for chat-originated calls.
 * Stays mounted while a call is active so media survives route changes.
 */

import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useCall } from '../context/CallContext'
import { useWebRTC, formatTime } from '../hooks/useWebRTC'
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
    localMediaStreamRef,
    getCallStackOwner,
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

  // Media + session publish
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
  }, [
    callState, callType, callDuration, isMuted, isCamOff,
    userId, listingId, chat?.otherName, chat?.otherAvatar, chat?.otherInitial,
    location.pathname,
  ]) // eslint-disable-line react-hooks/exhaustive-deps

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
          remoteVideoRef={(el) => {
            remoteVideoRef.current = el
            if (el) {
              el.classList.add('call-remote-pip-source')
              if (remoteStream) {
                el.srcObject = remoteStream
                el.play().catch(() => {})
              }
            }
          }}
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
        />
      )}
    </>
  )
}


