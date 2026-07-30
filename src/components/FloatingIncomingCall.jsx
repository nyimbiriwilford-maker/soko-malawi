import { useCall } from '../context/CallContext'

const S = {
  overlay: {
    position: 'fixed',
    top: 16,
    right: 16,
    zIndex: 9999,
    animation: 'slideInFloating 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  card: {
    width: 320,
    background: '#ffffff',
    borderRadius: 16,
    border: '1px solid #d8e5dc',
    boxShadow: '0 12px 40px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  row: { display: 'flex', alignItems: 'center', gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  avatarPlaceholder: {
    width: 48, height: 48, borderRadius: '50%',
    background: '#1a7a4a', color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 700, flexShrink: 0,
  },
  info: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  name: { fontSize: 15, fontWeight: 700, color: '#0f1410', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  type: { fontSize: 13, color: '#4a5e4d', display: 'flex', alignItems: 'center', gap: 6 },
  actions: { display: 'flex', gap: 12 },
  answerBtn: {
    flex: 1, padding: '10px 0', background: '#1a7a4a', color: '#fff',
    border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
    cursor: 'pointer', fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  declineBtn: {
    flex: 1, padding: '10px 0', background: '#dc2626', color: '#fff',
    border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700,
    cursor: 'pointer', fontFamily: "'DM Sans', system-ui, sans-serif",
  },
}

export default function FloatingIncomingCall() {
  const { incomingCall, answerCall, declineCall, callUiMode } = useCall()

  if (!incomingCall || callUiMode !== 'hidden') return null

  const { callerName, callerAvatar, isVideo } = incomingCall

  return (
    <div style={S.overlay} role="alert" aria-live="assertive">
      <div style={S.card}>
        <div style={S.row}>
          {callerAvatar ? (
            <img src={callerAvatar} alt="" style={S.avatar} />
          ) : (
            <div style={S.avatarPlaceholder}>
              {(callerName || '?')[0].toUpperCase()}
            </div>
          )}
          <div style={S.info}>
            <div style={S.name}>{callerName || 'Unknown'}</div>
            <div style={S.type}>{isVideo ? '📹 Video Call' : '📞 Voice Call'}</div>
          </div>
        </div>
        <div style={S.actions}>
          <button style={S.declineBtn} onClick={declineCall} aria-label="Decline call">Decline</button>
          <button style={S.answerBtn} onClick={answerCall} aria-label="Answer call">Answer</button>
        </div>
      </div>
      <style>{`
        @keyframes slideInFloating {
          from { transform: translateY(-120%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}