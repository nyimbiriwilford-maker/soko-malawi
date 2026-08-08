/**
 * ChatCallHost — binds this chat peer into the app-level PersistentCallShell.
 * Does not own WebRTC (so calls survive leaving the chat page).
 */

import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Phone, Video, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
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

const DIALOG_STYLES = `
  @keyframes callSheetUp {
    from { transform: translateY(100%); opacity: 0; }
    to   { transform: translateY(0);    opacity: 1; }
  }
  @keyframes callSheetPop {
    from { opacity: 0; transform: translateY(18px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0)    scale(1);    }
  }
  .call-sheet-overlay {
    position: fixed;
    inset: 0;
    z-index: 9500;
    background: rgba(10, 20, 14, 0.45);
    display: flex;
    align-items: flex-end;
    justify-content: center;
    font-family: 'Sora', 'DM Sans', system-ui, sans-serif;
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
  }
  .call-sheet {
    width: 100%;
    max-width: 560px;
    max-height: min(88vh, 88dvh);
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
    box-sizing: border-box;
    background: #ffffff;
    border: 1px solid #d8e5dc;
    border-bottom: none;
    border-radius: 24px 24px 0 0;
    padding: 14px 20px calc(22px + env(safe-area-inset-bottom, 0px));
    box-shadow: 0 -8px 40px rgba(15, 50, 30, 0.12);
    animation: callSheetUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .call-sheet-handle {
    display: block;
    width: 36px;
    height: 4px;
    border-radius: 2px;
    background: #d8e5dc;
    margin: 0 auto 16px;
  }
  .call-sheet-title {
    color: #0f1410;
    font-size: 20px;
    font-weight: 800;
    margin-bottom: 4px;
    text-transform: capitalize;
  }
  .call-sheet-subtitle {
    color: #637068;
    font-size: 13px;
    line-height: 1.45;
    margin-bottom: 18px;
  }
  .call-sheet-options {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .call-sheet-option {
    display: flex;
    align-items: center;
    gap: 14px;
    width: 100%;
    box-sizing: border-box;
    text-align: left;
    background: #f4f8f5;
    border: 1.5px solid #d8e5dc;
    border-radius: 16px;
    padding: 14px 16px;
    cursor: pointer;
    color: #0f1410;
    font-family: inherit;
    transition: border-color 0.2s, background 0.2s, transform 0.15s, box-shadow 0.2s;
  }
  .call-sheet-option:hover  { border-color: #b0ccba; background: #edf5f0; }
  .call-sheet-option:active { transform: scale(0.983); }
  .call-sheet-option-last {
    border-color: rgba(15, 157, 88, 0.45);
    background: rgba(15, 157, 88, 0.07);
    box-shadow: 0 0 0 1px rgba(15, 157, 88, 0.15);
  }
  .call-sheet-option-last:hover { border-color: rgba(15, 157, 88, 0.7); background: rgba(15, 157, 88, 0.11); }
  .call-sheet-option-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 14px;
    background: #e6f0ea;
    box-shadow: 0 0 0 1px #d8e5dc;
    color: #637068;
    flex-shrink: 0;
  }
  .call-sheet-icon-green {
    background: rgba(15, 157, 88, 0.1);
    box-shadow: 0 0 0 1px rgba(15, 157, 88, 0.25);
    color: #0F9D58;
  }
  .call-sheet-icon-blue {
    background: rgba(59, 130, 246, 0.09);
    box-shadow: 0 0 0 1px rgba(59, 130, 246, 0.22);
    color: #3b82f6;
  }
  .call-sheet-icon-amber {
    background: rgba(212, 146, 10, 0.09);
    box-shadow: 0 0 0 1px rgba(212, 146, 10, 0.22);
    color: #d4920a;
  }
  .call-sheet-option-body {
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .call-sheet-option-title {
    font-size: 15px;
    font-weight: 800;
    color: #0f1410;
    line-height: 1.3;
  }
  .call-sheet-option-sub {
    font-size: 12px;
    color: #637068;
    line-height: 1.4;
  }
  .call-sheet-chip {
    flex-shrink: 0;
    display: inline-flex;
    align-items: center;
    background: #e6f7ee;
    border: 1px solid rgba(15, 157, 88, 0.3);
    border-radius: 999px;
    padding: 5px 11px;
    color: #0F9D58;
    font-size: 11px;
    font-weight: 700;
    white-space: nowrap;
    letter-spacing: 0.01em;
  }
  .call-sheet-cancel {
    width: 100%;
    height: 48px;
    margin-top: 14px;
    background: transparent;
    color: #637068;
    border: 1.5px solid #d8e5dc;
    border-radius: 13px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    font-family: inherit;
    transition: color 0.2s, border-color 0.2s, background 0.2s;
  }
  .call-sheet-cancel:hover  { color: #0f1410; border-color: #b0ccba; background: #f4f8f5; }
  .call-sheet-cancel:active { transform: scale(0.98); }
  @media (min-width: 640px) {
    .call-sheet-overlay {
      align-items: flex-start;
      justify-content: center;
      padding: 5vh 20px 20px;
      overflow-y: auto;
      backdrop-filter: blur(5px);
      -webkit-backdrop-filter: blur(5px);
    }
    .call-sheet {
      width: 100%;
      max-width: 400px;
      max-height: none;
      overflow-y: visible;
      border-radius: 22px;
      border: 1.5px solid #24302a;
      border-bottom: 1.5px solid #24302a;
      padding: 14px 22px 22px;
      box-shadow: 0 24px 60px rgba(0, 0, 0, 0.6);
      animation: callSheetPop 0.24s ease;
    }
  }
`

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
    <div className="call-sheet-overlay" role="presentation" onClick={onClose}>
      <div
        className="call-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={`Start ${callType} call`}
        onClick={(e) => e.stopPropagation()}
      >
        <span className="call-sheet-handle" aria-hidden />
        <div className="call-sheet-title">Start {callType} call</div>
        <div className="call-sheet-subtitle">Choose how to start this call.</div>

        <div className="call-sheet-options">
          {saved && (
            <button
              type="button"
              className="call-sheet-option call-sheet-option-last"
              onClick={onLastBudget}
              aria-label="Continue with last budget"
            >
              <span className="call-sheet-option-icon call-sheet-icon-green">
                <ShieldCheck size={20} strokeWidth={2.2} aria-hidden />
              </span>
              <span className="call-sheet-option-body">
                <span className="call-sheet-option-title">Continue with Last Budget</span>
                <span className="call-sheet-option-sub">Resume with your saved data plan</span>
              </span>
              <span className="call-sheet-chip">{savedName} · {savedDuration}</span>
            </button>
          )}
          <button
            type="button"
            className="call-sheet-option"
            onClick={onStandard}
            aria-label="Standard call with no data monitoring"
          >
            <span className="call-sheet-option-icon call-sheet-icon-blue">
              <Phone size={20} strokeWidth={2.2} aria-hidden />
            </span>
            <span className="call-sheet-option-body">
              <span className="call-sheet-option-title">Standard Call</span>
              <span className="call-sheet-option-sub">No data monitoring</span>
            </span>
          </button>
          <button
            type="button"
            className="call-sheet-option"
            onClick={onSetBudget}
            aria-label="Set a call data budget"
          >
            <span className="call-sheet-option-icon call-sheet-icon-amber">
              <SlidersHorizontal size={20} strokeWidth={2.2} aria-hidden />
            </span>
            <span className="call-sheet-option-body">
              <span className="call-sheet-option-title">Set Call Budget</span>
              <span className="call-sheet-option-sub">Choose how much data to use</span>
            </span>
          </button>
        </div>

        <button type="button" className="call-sheet-cancel" onClick={onClose}>
          Cancel
        </button>
      </div>
      <style>{DIALOG_STYLES}</style>
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
  const location = useLocation()
  const params = useParams() || {}
  const actions = usePersistentCallActions()
  const { activeCall, callUiMode, expandCall } = useCall() || {}
  const startCall = actions?.startCall
  const callState = actions?.callState || activeCall?.status || 'idle'
  const busy = callState !== 'idle'
  const [pendingType, setPendingType] = useState(null)
  const noBudgetTypeRef = useRef(null)

  // The current chat id, e.g. "user123" or "user123/listing5".
  const chatId = params.listingId && params.listingId !== 'undefined'
    ? `${params.userId}/${params.listingId}`
    : (params.userId || '')

  // After returning from /call-budget with START CALL tapped, start the call
  // immediately. sessionStorage is the bridge (navigate state must stay
  // serializable — no functions). useLayoutEffect fires before the first
  // paint, so the chat UI never visibly flashes. The dialog was already
  // dismissed in onSetBudget, so nothing to close here.
  useLayoutEffect(() => {
    const type = sessionStorage.getItem('soko_start_call_on_return')
    if (!type) return
    const start = actions?.startCall
    if (!start) return // actions not published yet — retry when they arrive
    sessionStorage.removeItem('soko_start_call_on_return')
    start(type)
  }, [location.pathname, actions])

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
      {pendingType && createPortal(
        <CallStartDialog
          callType={pendingType}
          onLastBudget={() => {
            setPendingType(null)
            startCall?.(pendingType)
          }}
          onStandard={() => startNoBudgetCall(pendingType)}
          onSetBudget={() => {
            sessionStorage.setItem(
              'soko_pending_call',
              JSON.stringify({ callType: pendingType, chatId })
            )
            setPendingType(null)
            navigate('/call-budget', {
              state: { callType: pendingType },
            })
          }}
          onClose={() => {
            setPendingType(null)
          }}
        />,
        document.body
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
