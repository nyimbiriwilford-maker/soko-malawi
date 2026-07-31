/**
 * ChatCallHost — binds this chat peer into the app-level PersistentCallShell.
 * Does not own WebRTC (so calls survive leaving the chat page).
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { Phone, Video } from 'lucide-react'
import { useCall } from '../context/CallContext'
import CallBudgetSelector from './CallBudgetSelector'

const ChatCallContext = createContext(null)

export function useChatCallApi() {
  return useContext(ChatCallContext)
}

function usePersistentCallActions() {
  const { chatCallActionsRef, chatCallActionsVersion } = useCall() || {}
  // version forces re-read when PersistentCallShell publishes new actions
  void chatCallActionsVersion
  return chatCallActionsRef?.current || null
}

const headerBtnStyle = {
  background: '#f0f4f1',
  border: 'none',
  borderRadius: '50%',
  width: 36,
  height: 36,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background 0.15s ease, transform 0.12s ease, opacity 0.15s ease',
}

/** Hide children while a call is ringing / active full-screen */
export function HideDuringCall({ children }) {
  const { activeCall, callUiMode } = useCall() || {}
  if (activeCall && callUiMode === 'full' && activeCall.status !== 'idle') return null
  return children
}

/** Voice + video call buttons for the chat top bar */
export function CallHeaderButtons({ style = headerBtnStyle }) {
  const actions = usePersistentCallActions()
  const { activeCall, callUiMode, expandCall } = useCall() || {}
  const startCall = actions?.startCall
  const callState = actions?.callState || activeCall?.status || 'idle'
  const busy = callState !== 'idle'
  const [pendingType, setPendingType] = useState(null)

  const base = {
    ...headerBtnStyle,
    ...style,
    opacity: busy && callState !== 'idle' ? 0.45 : 1,
    cursor: busy ? 'not-allowed' : 'pointer',
  }

  // If already on a mini call with this flow, allow expand instead of starting new
  if (busy && callUiMode === 'mini') {
    return (
      <button
        type="button"
        style={{ ...base, opacity: 1, cursor: 'pointer', width: 'auto', borderRadius: 20, padding: '0 12px', gap: 6 }}
        onClick={() => expandCall?.()}
        title="Return to call"
        aria-label="Return to active call"
      >
        <Phone size={16} strokeWidth={2.1} color="#0F9D58" aria-hidden />
        <span style={{ fontSize: 12, fontWeight: 700, color: '#0F9D58' }}>On call</span>
      </button>
    )
  }

  return (
    <>
      <button
        type="button"
        style={base}
        onClick={() => { if (startCall && !busy) setPendingType('voice') }}
        disabled={!startCall || busy}
        title="Voice call"
        aria-label="Start voice call"
      >
        <Phone size={17} strokeWidth={2.1} color="#0F9D58" aria-hidden />
      </button>
      <button
        type="button"
        style={base}
        onClick={() => { if (startCall && !busy) setPendingType('video') }}
        disabled={!startCall || busy}
        title="Video call"
        aria-label="Start video call"
      >
        <Video size={17} strokeWidth={2.1} color="#0F9D58" aria-hidden />
      </button>
      {pendingType && (
        <CallBudgetSelector
          callType={pendingType}
          onConfirm={() => {
            setPendingType(null)
            startCall?.(pendingType)
          }}
          onCancel={() => setPendingType(null)}
        />
      )}
    </>
  )
}

/**
 * Binds this chat to PersistentCallShell. Renders children only (no overlay).
 */
export default function ChatCallHost({
  userId,
  currentUser,
  listingId,
  isServiceChatRef,
  otherName,
  otherAvatar,
  otherInitial,
  onCallMessage,
  children,
}) {
  const { bindChatCall, unbindChatCall, expandCall, callUiMode, activeCall } = useCall() || {}
  const actions = usePersistentCallActions()

  useEffect(() => {
    if (!userId) return undefined
    bindChatCall?.({
      userId,
      currentUser,
      listingId,
      isServiceChatRef,
      otherName,
      otherAvatar,
      otherInitial,
      onCallMessage,
    })
    return () => {
      unbindChatCall?.({ keepIfInCall: true })
    }
  }, [
    userId,
    currentUser?.id,
    listingId,
    otherName,
    otherAvatar,
    otherInitial,
    // re-bind when message handler identity changes
  ]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-bind onCallMessage without tearing down
  useEffect(() => {
    if (!userId) return
    bindChatCall?.({
      userId,
      currentUser,
      listingId,
      isServiceChatRef,
      otherName,
      otherAvatar,
      otherInitial,
      onCallMessage,
    })
  }, [onCallMessage, currentUser, isServiceChatRef]) // eslint-disable-line react-hooks/exhaustive-deps

  // Returning to chat during mini call — optional soft expand prompt only via header
  useEffect(() => {
    if (callUiMode === 'mini' && activeCall?.status === 'in-call') {
      // keep mini until user taps; audio continues
    }
  }, [callUiMode, activeCall?.status])

  const value = {
    callState: actions?.callState || 'idle',
    startCall: actions?.startCall,
    hangUp: actions?.hangUp,
    formatTime: actions?.formatTime,
    expandCall,
  }

  return (
    <ChatCallContext.Provider value={value}>
      {children}
    </ChatCallContext.Provider>
  )
}
