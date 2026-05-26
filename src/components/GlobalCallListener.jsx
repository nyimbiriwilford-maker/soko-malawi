import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useCall } from '../context/CallContext'

export default function GlobalCallListener() {
  const [incoming, setIncoming] = useState(null) // { fromUser, callType, offer, callId, callerName }
  const navigate = useNavigate()
  const { registerCallListener, dismissIncoming, stopRing, playRing } = useCall()

  useEffect(() => {
    const unregister = registerCallListener((payload) => {
      const { _event } = payload

      if (_event !== 'ring') return false // only handle ring events

      // If already in the chat with this caller, let Chat.jsx handle it
      const callerPath = `/chat/${payload.fromUser}`
      if (window.location.pathname.startsWith(callerPath)) return false

      // Show global incoming overlay
      setIncoming({
        fromUser: payload.fromUser,
        callType: payload.callType,
        offer: payload.offer,
        callId: payload.callId,
      })
      playRing()
      return true // handled here — suppress nothing else since Chat isn't open
    })

    return unregister
  }, [])

  // Also dismiss if user navigates into the relevant chat
  useEffect(() => {
    if (!incoming) return
    const callerPath = `/chat/${incoming.fromUser}`
    if (window.location.pathname.startsWith(callerPath)) {
      handleDismiss()
    }
  }, [incoming])

  function handleDismiss() {
    stopRing()
    setIncoming(null)
    dismissIncoming()
  }

  async function handleAnswer() {
    if (!incoming) return
    stopRing()

    // Get other user's name for display
    const { data: caller } = await supabase
      .from('users').select('name, email').eq('id', incoming.fromUser).single()
    const callerName = caller?.name || caller?.email || 'Unknown'

    // Store call data for Chat.jsx to pick up
    sessionStorage.setItem('__pendingCall', JSON.stringify({
      fromUser: incoming.fromUser,
      callType: incoming.callType,
      offer: incoming.offer,
      callId: incoming.callId,
      callerName,
    }))

    setIncoming(null)
    dismissIncoming()
    navigate(`/chat/${incoming.fromUser}`)
  }

  async function handleDecline() {
    if (!incoming) return
    stopRing()

    // Notify caller
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const targetChannel = supabase.channel(`call_signal_${incoming.fromUser}_${Date.now()}`)
      targetChannel.subscribe(status => {
        if (status === 'SUBSCRIBED') {
          targetChannel.send({
            type: 'broadcast',
            event: 'call_signal',
            payload: { _event: 'decline', callId: incoming.callId, fromUser: user.id }
          }).then(() => supabase.removeChannel(targetChannel))
        }
      })
    }

    setIncoming(null)
    dismissIncoming()
  }

  if (!incoming) return null

  const initial = (incoming.callerName || incoming.fromUser)?.[0]?.toUpperCase() || '?'

  return (
    <div style={S.overlay}>
      <div style={S.card}>
        <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto 16px' }}>
          <div style={{ ...S.ripple, animationDelay: '0s' }} />
          <div style={{ ...S.ripple, animationDelay: '0.6s' }} />
          <div style={S.avatar}>{initial}</div>
        </div>
        <div style={S.name}>{incoming.callerName || incoming.fromUser}</div>
        <div style={S.type}>
          {incoming.callType === 'video' ? '📹 Incoming video call' : '📞 Incoming voice call'}
        </div>
        <div style={S.actions}>
          <div style={{ textAlign: 'center' }}>
            <button style={S.decline} onClick={handleDecline}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M23.71 16.67C22.69 15.65 21.38 15.1 20 15.1s-2.69.55-3.71 1.57l-2.15 2.15c-3.63-1.97-6.99-5.33-8.96-8.96l2.15-2.15C8.45 6.69 9 5.38 9 4s-.55-2.69-1.57-3.71C6.41-.71 5.13-1.3 3.8-1.3c-1.33 0-2.63.57-3.5 1.57l-1.5 1.5C-3.2 4.27-1.66 10.17 3.3 15.12c4.96 4.97 10.86 6.51 13.35 4.5l1.5-1.5c.98-.87 1.55-2.13 1.55-3.45 0-1.33-.57-2.63-1.99-3.5z"/>
              </svg>
            </button>
            <div style={S.label}>Decline</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <button style={S.answer} onClick={handleAnswer}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
                <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z"/>
              </svg>
            </button>
            <div style={S.label}>Answer</div>
          </div>
        </div>
      </div>
      <style>{`
        @keyframes ripple{0%{transform:scale(1);opacity:0.6}100%{transform:scale(2.2);opacity:0}}
        @keyframes ringPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(26,122,74,0.4)}50%{transform:scale(1.06);box-shadow:0 0 0 16px rgba(26,122,74,0)}}
      `}</style>
    </div>
  )
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'linear-gradient(160deg,#0a1a10,#0f2d1a)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  card: { textAlign: 'center', padding: '40px 32px' },
  avatar: { position: 'absolute', inset: 0, width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff', fontSize: '30px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'ringPulse 1.4s infinite' },
  ripple: { position: 'absolute', inset: -8, borderRadius: '50%', border: '2px solid rgba(26,122,74,0.5)', animation: 'ripple 2s ease-out infinite' },
  name: { fontSize: '24px', fontWeight: '800', color: '#fff', marginBottom: 8 },
  type: { fontSize: '15px', color: 'rgba(255,255,255,0.55)', marginBottom: 36 },
  actions: { display: 'flex', gap: 48, justifyContent: 'center' },
  decline: { width: 64, height: 64, borderRadius: '50%', background: '#e74c3c', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(231,76,60,0.4)' },
  answer: { width: 64, height: 64, borderRadius: '50%', background: '#1a7a4a', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(26,122,74,0.5)', animation: 'ringPulse 1.4s infinite' },
  label: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8 },
}