import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useCall } from '../context/CallContext'
import { T } from '../constants/tokens'
import { Phone, PhoneOff, Video } from 'lucide-react'

const S = {
  overlay: {
    position: 'fixed',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9999,
    animation: 'floatFadeIn 0.25s ease-out',
    fontFamily: T.font,
  },
  card: {
    width: 'min(320px, calc(100vw - 32px))',
    background: T.white,
    borderRadius: 16,
    border: `1px solid ${T.gray200}`,
    boxShadow: T.shadowMd,
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  row: { display: 'flex', alignItems: 'center', gap: 14 },
  avatar: { width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 },
  avatarPlaceholder: {
    width: 48, height: 48, borderRadius: '50%',
    background: `linear-gradient(135deg, ${T.green}, ${T.greenD})`,
    color: '#fff',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 20, fontWeight: 700, flexShrink: 0,
  },
  info: { display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 },
  name: { fontSize: 15, fontWeight: 700, color: T.gray900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
  type: { fontSize: 13, color: T.gray600, display: 'flex', alignItems: 'center', gap: 6 },
  actions: { display: 'flex', gap: 32, justifyContent: 'center' },
  btnBase: {
    width: 52, height: 52, borderRadius: '50%', border: 'none',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', flexShrink: 0,
  },
}

export default function FloatingIncomingCall() {
  const { incomingCall, callUiMode, incomingActionsRef } = useCall()
  const [remoteAvatar, setRemoteAvatar] = useState(null)
  const [connecting, setConnecting] = useState(false)

  const fromUser = incomingCall?.fromUser

  useEffect(() => {
    if (!fromUser) { setRemoteAvatar(null); return }
    let cancelled = false
    supabase.from('profiles').select('avatar_url').eq('id', fromUser).maybeSingle()
      .then(({ data }) => { if (!cancelled) setRemoteAvatar(data?.avatar_url || null) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [fromUser])

  if (!incomingCall || callUiMode !== 'hidden') return null

  const callerName = incomingCall.fromName || incomingCall.callerName || 'Unknown'
  const callType = incomingCall.callType || 'voice'
  const isVideo = callType === 'video'
  const avatarSrc = remoteAvatar

  function handleAnswer() { setConnecting(true); incomingActionsRef.current?.answer?.() }
  function handleDecline() { incomingActionsRef.current?.decline?.() }

  return (
    <div style={S.overlay} role="alert" aria-live="assertive">
      <div style={S.card}>
        <div style={S.row}>
          {avatarSrc ? (
            <img src={avatarSrc} alt="" style={S.avatar} />
          ) : (
            <div style={S.avatarPlaceholder}>
              {(callerName || '?')[0].toUpperCase()}
            </div>
          )}
          <div style={S.info}>
            <div style={S.name}>{callerName}</div>
            <div style={S.type}>
              {isVideo ? <Video size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} /> : <Phone size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />}
              {isVideo ? 'Incoming video call' : 'Incoming voice call'}
            </div>
          </div>
        </div>
        <div style={S.actions}>
          <button
            onClick={handleDecline}
            aria-label="Decline call"
            style={{ ...S.btnBase, background: T.red, boxShadow: '0 4px 12px rgba(234,67,53,0.4)' }}
          >
            <PhoneOff size={20} strokeWidth={2.5} color="#fff" />
          </button>
          <button
onClick={handleAnswer}
        disabled={connecting}
        aria-label={isVideo ? 'Answer video call' : 'Answer call'}
            style={{ ...S.btnBase, background: T.green, boxShadow: '0 4px 16px rgba(15,157,88,0.4)', animation: 'callPulse 2s ease-in-out infinite' }}
          >
            {isVideo ? <Video size={22} strokeWidth={2.5} color="#fff" /> : <Phone size={22} strokeWidth={2.5} color="#fff" />}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes floatFadeIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes callPulse {
          0%, 100% { transform: scale(1); box-shadow: 0 4px 16px rgba(15,157,88,0.35); }
          50% { transform: scale(1.04); box-shadow: 0 4px 24px rgba(15,157,88,0.55); }
        }
      `}</style>
    </div>
  )
}
