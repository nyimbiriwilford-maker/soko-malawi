/**
 * ChatCallHost — binds this chat peer into the app-level PersistentCallShell.
 * Does not own WebRTC (so calls survive leaving the chat page).
 */

import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Phone, Video, CheckCircle2, SlidersHorizontal } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useCall } from '../context/CallContext'
import { getCallBudgetPref, estimateDuration, shouldAutoLowData } from '../lib/callBudgetPrefs'

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

const DIALOG_PALETTE = {
  backdrop: 'rgba(9, 12, 10, 0.72)',
  surface: '#161b17',
  surfaceRaised: '#1e2520',
  border: '#2a342c',
  text: '#e8efe9',
  textDim: '#93a39a',
  green: '#0F9D58',
}

const DIALOG_KEYFRAMES = `
  @keyframes callStartFadeUp {
    from { opacity: 0; transform: translateY(12px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
`

const dialogCardBase = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  width: '100%',
  boxSizing: 'border-box',
  textAlign: 'left',
  background: DIALOG_PALETTE.surfaceRaised,
  border: `1px solid ${DIALOG_PALETTE.border}`,
  borderRadius: 14,
  padding: '14px 16px',
  cursor: 'pointer',
  color: DIALOG_PALETTE.text,
  fontFamily: 'inherit',
  transition: 'border-color 0.2s ease, background 0.2s ease, transform 0.15s ease, box-shadow 0.2s ease',
}

const dialogCardTop = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  gap: 10,
}

const dialogCardName = {
  fontSize: 15,
  fontWeight: 800,
}

const dialogCardSub = {
  fontSize: 12,
  color: DIALOG_PALETTE.textDim,
  lineHeight: 1.45,
}

const PRESET_NAMES = { low: 'Economy', medium: 'Balanced', high: 'Premium', custom: 'Custom' }

/** Friendly duration label for the saved-budget card, e.g. "~30 min". */
function formatEstimate(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  if (total < 60) return 'under 1 min'
  const mins = Math.round(total / 60)
  if (mins < 60) return `~${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `~${hrs} hr ${rem} min` : `~${hrs} hr`
}

function budgetKey(type) {
  return `soko_call_budget_${type}`
}

function budgetBackupKey(type) {
  return `soko_call_budget_backup_${type}`
}

/** Park the live budget pref (kept in a backup key) so a call runs unmetered. */
function stashBudgetForNoBudgetCall(type) {
  const live = localStorage.getItem(budgetKey(type))
  localStorage.setItem(budgetBackupKey(type), live === null ? 'null' : live)
  localStorage.removeItem(budgetKey(type))
}

/** Restore a parked budget pref. Returns true when a backup was present. */
function restoreStashedBudget(type) {
  const parked = localStorage.getItem(budgetBackupKey(type))
  if (parked === null) return false
  if (parked === 'null') localStorage.removeItem(budgetKey(type))
  else localStorage.setItem(budgetKey(type), parked)
  localStorage.removeItem(budgetBackupKey(type))
  return true
}

/** 3-choice confirmation dialog shown before starting a call. */
function CallStartDialog({ callType, onLastBudget, onStandard, onSetBudget, onClose }) {
  const saved = getCallBudgetPref(callType)
  const savedName = saved ? (PRESET_NAMES[saved.preset] || 'Budget') : null
  const savedDuration = saved
    ? formatEstimate(estimateDuration(callType, saved.mb, shouldAutoLowData(callType, saved.preset)))
    : null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9500,
        background: DIALOG_PALETTE.backdrop,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        fontFamily: "'Sora', 'Inter', system-ui, sans-serif",
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Start ${callType} call`}
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'min(360px, 100%)',
          background: DIALOG_PALETTE.surface,
          border: `1px solid ${DIALOG_PALETTE.border}`,
          borderRadius: 18,
          padding: 22,
          boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
          animation: 'callStartFadeUp 0.25s ease',
        }}
      >
        <div style={{ color: DIALOG_PALETTE.text, fontSize: 18, fontWeight: 800, marginBottom: 4 }}>
          Start {callType} call
        </div>
        <div style={{ color: DIALOG_PALETTE.textDim, fontSize: 13, marginBottom: 18 }}>
          Choose how to start this call.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {saved && (
            <button
              type="button"
              onClick={onLastBudget}
              aria-label="Continue with last budget"
              style={{
                ...dialogCardBase,
                borderColor: DIALOG_PALETTE.green,
                background: 'rgba(15, 157, 88, 0.10)',
              }}
            >
              <div style={dialogCardTop}>
                <span style={dialogCardName}>Continue with Last Budget</span>
                <CheckCircle2 size={20} color={DIALOG_PALETTE.green} aria-hidden />
              </div>
              <div style={dialogCardSub}>
                {savedName} · {savedDuration}
              </div>
            </button>
          )}
          <button type="button" onClick={onStandard} aria-label="Standard call with no data monitoring" style={dialogCardBase}>
            <div style={dialogCardTop}>
              <span style={dialogCardName}>Standard Call</span>
              <Phone size={18} color={DIALOG_PALETTE.green} aria-hidden />
            </div>
            <div style={dialogCardSub}>No data monitoring</div>
          </button>
          <button type="button" onClick={onSetBudget} aria-label="Set a call data budget" style={dialogCardBase}>
            <div style={dialogCardTop}>
              <span style={dialogCardName}>Set Call Budget</span>
              <SlidersHorizontal size={18} color={DIALOG_PALETTE.green} aria-hidden />
            </div>
            <div style={dialogCardSub}>Choose how much data to use</div>
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            marginTop: 16,
            width: '100%',
            background: 'transparent',
            color: DIALOG_PALETTE.textDim,
            border: `1px solid ${DIALOG_PALETTE.border}`,
            borderRadius: 12,
            padding: '12px 0',
            fontSize: 14,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Cancel
        </button>
      </div>
      <style>{DIALOG_KEYFRAMES}</style>
    </div>
  )
}

/** Hide children while a call is ringing / active full-screen */
export function HideDuringCall({ children }) {
  const { activeCall, callUiMode } = useCall() || {}
  if (activeCall && callUiMode === 'full' && activeCall.status !== 'idle') return null
  return children
}

/** Voice + video call buttons for the chat top bar */
export function CallHeaderButtons({ style = headerBtnStyle }) {
  const navigate = useNavigate()
  const actions = usePersistentCallActions()
  const { activeCall, callUiMode, expandCall } = useCall() || {}
  const startCall = actions?.startCall
  const callState = actions?.callState || activeCall?.status || 'idle'
  const busy = callState !== 'idle'
  const [pendingType, setPendingType] = useState(null)
  const noBudgetTypeRef = useRef(null)

  // A "Standard Call" temporarily parks the saved budget. Restore it as soon
  // as the call ends, and heal any stale parked budget from an interrupted
  // session (reload / leaving the chat mid-call) once no call is active.
  useEffect(() => {
    if (actions?.callState === 'idle') {
      if (noBudgetTypeRef.current) {
        restoreStashedBudget(noBudgetTypeRef.current)
        noBudgetTypeRef.current = null
      }
      for (const t of ['voice', 'video']) {
        if (localStorage.getItem(budgetBackupKey(t)) !== null) restoreStashedBudget(t)
      }
    }
  }, [actions?.callState, actions])

  function startNoBudgetCall(type) {
    stashBudgetForNoBudgetCall(type)
    noBudgetTypeRef.current = type
    setPendingType(null)
    startCall?.(type)
  }

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
        <CallStartDialog
          callType={pendingType}
          onLastBudget={() => {
            setPendingType(null)
            startCall?.(pendingType)
          }}
          onStandard={() => startNoBudgetCall(pendingType)}
          onSetBudget={() => {
            setPendingType(null)
            navigate('/call-budget', {
              state: {
                callType: pendingType,
                onStart: () => startCall?.(pendingType),
              },
            })
          }}
          onClose={() => setPendingType(null)}
        />
      )}
    </>
  )
}

/**
 * Binds this chat to PersistentCallShell. Renders children; the full-screen
 * call UI (with the live data meter) is rendered by PersistentCallShell.
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
