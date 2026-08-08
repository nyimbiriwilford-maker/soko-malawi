// CallOverlay.jsx — modern call UI (ringing, receiving, in-call).
// Presentational; driven by ChatCallHost / useWebRTC.

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
  BudgetToast,
  BudgetExtendPanel,
  BudgetCountdownToast,
  CallSummaryScreen,
  CALL_KEYFRAMES,
} from './call/CallUI'

export default function CallOverlay({
  callState,
  callType,
  callDuration,
  otherName,
  otherAvatar,
  otherInitial,
  isMuted,
  isCamOff,
  remoteVideoRef,
  localVideoRef,
  hangUp,
  answerCall,
  declineCall,
  toggleMute,
  toggleCam,
  switchCamera,
  switchCallType,
  switching,
  formatTime,
  bytesUsed,
  budgetMb,
  budgetWarning,
  onBudgetAction,
  qualityToast,
  callSummary,
  onDismissSummary,
  measuredRate,
}) {
  if (callSummary) {
    return <CallSummaryScreen summary={callSummary} onDone={onDismissSummary} />
  }

  if (callState === 'idle') return null

  const isVideo = callType === 'video'
  const name = otherName || 'Contact'

  if (callState === 'calling' || callState === 'ringing') {
    const status =
      callState === 'calling'
        ? (isVideo ? 'Starting video call…' : 'Calling…')
        : 'Ringing…'

    return (
      <CallShell zIndex={3000}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <CallTypeBadge isVideo={isVideo} />
        </div>
        <CallAvatar
          url={otherAvatar}
          initial={otherInitial}
          size={108}
          pulse={callState === 'ringing'}
        />
        <CallTitle>{name}</CallTitle>
        <CallSubtitle>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <CallIcon
              name={isVideo ? 'video' : 'phoneCall'}
              size={16}
              color="rgba(255,255,255,0.55)"
            />
            {status}
          </span>
        </CallSubtitle>
        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center' }}>
          <CallControlBtn label="Cancel" variant="danger" size={68} onClick={hangUp} ariaLabel="Cancel call">
            <CallIcon name="phoneOff" size={26} color="#fff" />
          </CallControlBtn>
        </div>
        <style>{CALL_KEYFRAMES}</style>
      </CallShell>
    )
  }

  if (callState === 'receiving') {
    return (
      <CallShell zIndex={3000}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <CallTypeBadge isVideo={isVideo} />
        </div>
        <CallAvatar url={otherAvatar} initial={otherInitial} size={108} pulse />
        <CallTitle>{name}</CallTitle>
        <CallSubtitle>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <CallIcon name="phoneIncoming" size={16} color="rgba(255,255,255,0.55)" />
            {isVideo ? 'Incoming video call' : 'Incoming voice call'}
          </span>
        </CallSubtitle>
        <div style={{
          marginTop: 44,
          display: 'flex',
          gap: 48,
          justifyContent: 'center',
          alignItems: 'flex-end',
        }}>
          <CallControlBtn label="Decline" variant="danger" size={64} onClick={declineCall} ariaLabel="Decline call">
            <CallIcon name="phoneOff" size={24} color="#fff" />
          </CallControlBtn>
          <CallControlBtn label="Answer" variant="successPulse" size={72} onClick={answerCall} ariaLabel="Answer call">
            <CallIcon name={isVideo ? 'video' : 'phone'} size={28} color="#fff" />
          </CallControlBtn>
        </div>
        <style>{CALL_KEYFRAMES}</style>
      </CallShell>
    )
  }

  if (callState === 'in-call') {
    return (
      <>
        <InCallStage
          zIndex={3000}
          isVideo={isVideo}
          name={name}
          avatarUrl={otherAvatar}
          avatarInitial={otherInitial}
          durationLabel={formatTime(callDuration)}
          remoteVideoRef={remoteVideoRef}
          localVideoRef={localVideoRef}
          bytesUsed={bytesUsed}
          budgetMb={budgetMb}
          measuredRate={measuredRate}
          warning="Tap Browse to use the app while staying on the call"
          controls={(
            <InCallControls
              isVideo={isVideo}
              isMuted={isMuted}
              isCamOff={isCamOff}
              onMute={toggleMute}
              onCam={toggleCam}
              onHangUp={hangUp}
              onFlip={switchCamera}
              onSwitchType={switchCallType}
              switching={switching}
              onMinimize={typeof window !== 'undefined' ? () => {
                // Prefer context minimize when available via custom event
                window.dispatchEvent(new CustomEvent('sokomw-minimize-call'))
              } : undefined}
            />
          )}
        />
        {budgetWarning && budgetWarning.level === 'low' && (
          <BudgetToast level="low" />
        )}
        {budgetWarning && budgetWarning.level === 'panel' && (
          <BudgetExtendPanel onExtend={(mb) => onBudgetAction('extend', mb)} />
        )}
        {budgetWarning && budgetWarning.level === 'countdown' && (
          <BudgetCountdownToast
            seconds={budgetWarning.seconds}
            onExtend={() => onBudgetAction('extend', 10)}
          />
        )}
        {qualityToast && (
          <BudgetToast level="quality" />
        )}
      </>
    )
  }

  return null
}
