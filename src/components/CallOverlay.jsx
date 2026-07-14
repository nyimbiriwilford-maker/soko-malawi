// CallOverlay.jsx — all call UI (ringing, receiving, in-call fullscreen).
// Purely presentational: driven entirely by props from useWebRTC in Chat.jsx.
// Keeping this separate from Chat.jsx isolates call-UI re-renders from
// chat-message re-renders, and keeps ontrack/stream-related debugging
// scoped to one file instead of buried in chat logic.

function HangupIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <path d="M23.71 16.67C22.69 15.65 21.38 15.1 20 15.1s-2.69.55-3.71 1.57l-2.15 2.15c-3.63-1.97-6.99-5.33-8.96-8.96l2.15-2.15C8.45 6.69 9 5.38 9 4s-.55-2.69-1.57-3.71C6.41-.71 5.13-1.3 3.8-1.3c-1.33 0-2.63.57-3.5 1.57l-1.5 1.5C-3.2 4.27-1.66 10.17 3.3 15.12c4.96 4.97 10.86 6.51 13.35 4.5l1.5-1.5c.98-.87 1.55-2.13 1.55-3.45 0-1.33-.57-2.63-1.99-3.5z" />
    </svg>
  )
}

function AnswerIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" />
    </svg>
  )
}

function Avatar({ url, initial, size = 36, isMine = false }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
      background: isMine ? 'linear-gradient(135deg,#22a05e,#1a7a4a)' : 'linear-gradient(135deg,#3b82f6,#2563eb)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
    }}>
      {url
        ? <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: size * 0.4, fontWeight: '800', color: '#fff' }}>{initial}</span>
      }
    </div>
  )
}

export default function CallOverlay({
  callState, callType, callDuration,
  otherName, otherAvatar, otherInitial,
  isMuted, isCamOff,
  remoteVideoRef, localVideoRef,
  hangUp, answerCall, declineCall,
  toggleMute, toggleCam, switchCamera,
  formatTime,
}) {
  if (callState === 'idle') return null

  if (callState === 'calling' || callState === 'ringing') {
    return (
      <div style={S.callOverlay}>
        <div style={S.callCard}>
          <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 20px' }}>
            {callState === 'ringing' && <><div style={{ ...S.ripple, animationDelay: '0s' }} /><div style={{ ...S.ripple, animationDelay: '0.5s' }} /></>}
            <div style={S.callAvatarWrap}><Avatar url={otherAvatar} initial={otherInitial} size={90} /></div>
          </div>
          <div style={S.callName}>{otherName}</div>
          <div style={S.callStatus}>
            {callState === 'calling'
              ? (callType === 'video' ? '📹 Starting video call…' : '📞 Calling…')
              : <span style={{ animation: 'blink 1.2s infinite' }}>🔔 Ringing…</span>}
          </div>
          <div style={{ marginTop: 36 }}>
            <button style={S.hangUpBtn} onClick={hangUp}><HangupIcon /></button>
          </div>
        </div>
      </div>
    )
  }

  if (callState === 'receiving') {
    return (
      <div style={{ ...S.callOverlay, animation: 'slideUp 0.3s ease' }}>
        <div style={S.callCard}>
          <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 20px' }}>
            <div style={{ ...S.ripple, animationDelay: '0s' }} /><div style={{ ...S.ripple, animationDelay: '0.6s' }} />
            <div style={{ ...S.callAvatarWrap, animation: 'ringPulse 1.4s infinite' }}><Avatar url={otherAvatar} initial={otherInitial} size={90} /></div>
          </div>
          <div style={S.callName}>{otherName}</div>
          <div style={S.callStatus}>{callType === 'video' ? '📹 Incoming video call' : '📞 Incoming voice call'}</div>
          <div style={{ display: 'flex', gap: 40, marginTop: 36, justifyContent: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <button style={S.declineBtn} onClick={declineCall}><HangupIcon /></button>
              <div style={S.callBtnLabel}>Decline</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <button style={S.answerBtn} onClick={answerCall}><AnswerIcon /></button>
              <div style={S.callBtnLabel}>Answer</div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (callState === 'in-call') {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 3000, fontFamily: 'system-ui,sans-serif', background: '#000', overflow: 'hidden' }}>
        <video ref={remoteVideoRef} autoPlay playsInline style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 220, background: 'linear-gradient(to top,rgba(0,0,0,0.88) 0%,transparent 100%)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 110, background: 'linear-gradient(to bottom,rgba(0,0,0,0.6) 0%,transparent 100%)', pointerEvents: 'none' }} />
        {callType === 'video' ? (
          <div style={{ position: 'absolute', top: 20, right: 16, width: 88, height: 124, borderRadius: 14, overflow: 'hidden', border: '2px solid rgba(255,255,255,0.25)', background: '#111', boxShadow: '0 4px 20px rgba(0,0,0,0.6)', zIndex: 2 }}>
            <video ref={localVideoRef} autoPlay playsInline muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
        ) : (
          <video ref={localVideoRef} autoPlay playsInline muted style={{ display: 'none' }} />
        )}

        <div style={{ position: 'absolute', top: 28, left: 0, right: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, zIndex: 2 }}>
          {callType === 'voice' && (
            <>
              <div style={{ width: 80, height: 80, borderRadius: '50%', overflow: 'hidden', marginBottom: 6, boxShadow: '0 4px 20px rgba(0,0,0,0.5)' }}>
                <Avatar url={otherAvatar} initial={otherInitial} size={80} />
              </div>
              <div style={{ fontSize: 20, fontWeight: '700', color: '#fff', textShadow: '0 2px 8px rgba(0,0,0,0.7)' }}>{otherName}</div>
            </>
          )}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(8px)', borderRadius: 20, padding: '4px 16px' }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
            <span style={{ fontSize: 14, color: 'rgba(255,255,255,0.92)', fontWeight: '600', fontVariantNumeric: 'tabular-nums' }}>{formatTime(callDuration)}</span>
          </div>
        </div>
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10, paddingBottom: 40, paddingTop: 16, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 20, width: '100%', maxWidth: 360, paddingLeft: 16, paddingRight: 16, boxSizing: 'border-box' }}>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <button onClick={toggleMute} style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isMuted ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', boxShadow: '0 2px 12px rgba(0,0,0,0.4)', transition: 'background 0.2s' }}>
                <span style={{ fontSize: 22 }}>{isMuted ? '🔇' : '🎙️'}</span>
              </button>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500' }}>{isMuted ? 'Unmute' : 'Mute'}</span>
            </div>
            {callType === 'video' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <button onClick={toggleCam} style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: isCamOff ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', boxShadow: '0 2px 12px rgba(0,0,0,0.4)', transition: 'background 0.2s' }}>
                  <span style={{ fontSize: 22 }}>{isCamOff ? '📷' : '📹'}</span>
                </button>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500' }}>Camera</span>
              </div>
            )}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <button onClick={hangUp} style={{ width: 64, height: 64, borderRadius: '50%', background: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 24px rgba(239,68,68,0.65)', transform: 'scale(1.08)' }}>
                <HangupIcon />
              </button>
              <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500' }}>End</span>
            </div>
            {callType === 'video' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                <button onClick={switchCamera} style={{ width: 56, height: 56, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.18)', backdropFilter: 'blur(10px)', boxShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
                  <span style={{ fontSize: 22 }}>🔄</span>
                </button>
                <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '500' }}>Flip</span>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  return null
}

const S = {
  callOverlay: { position: 'fixed', inset: 0, background: 'linear-gradient(160deg,#0a1a10,#0f2d1a)', zIndex: 3000, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' },
  callCard: { textAlign: 'center', padding: '40px 24px', zIndex: 1 },
  callAvatarWrap: { position: 'absolute', inset: 0, borderRadius: '50%', overflow: 'hidden' },
  ripple: { position: 'absolute', inset: -8, borderRadius: '50%', border: '2px solid rgba(26,122,74,0.5)', animation: 'ripple 2s ease-out infinite' },
  callName: { fontSize: '26px', fontWeight: '800', color: '#fff', marginBottom: 10 },
  callStatus: { fontSize: '15px', color: 'rgba(255,255,255,0.55)' },
  callBtnLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 12, marginTop: 8 },
  hangUpBtn: { width: 64, height: 64, borderRadius: '50%', background: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', boxShadow: '0 4px 20px rgba(239,68,68,0.5)' },
  declineBtn: { width: 64, height: 64, borderRadius: '50%', background: '#ef4444', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(239,68,68,0.4)' },
  answerBtn: { width: 64, height: 64, borderRadius: '50%', background: '#1a7a4a', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(26,122,74,0.5)', animation: 'ringPulse 1.4s infinite' },
}