import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function GlobalCallListener() {
  const [incoming, setIncoming] = useState(null)
  const [callerName, setCallerName] = useState('')
  const channelRef = useRef(null)
  const ringCtxRef = useRef(null)
  const currentUserRef = useRef(null)

  useEffect(() => {
    setup()
    return () => {
      if (channelRef.current) supabase.removeChannel(channelRef.current)
      stopRing()
    }
  }, [])

  async function setup() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    currentUserRef.current = user

    const ch = supabase.channel(`call_broadcast_${user.id}`)
      .on('broadcast', { event: 'ring' }, async ({ payload }) => {
        console.log('📞 Incoming call received:', payload)
        const { data: caller } = await supabase
          .from('users').select('*').eq('id', payload.fromUser).single()
        setCallerName(caller?.name || caller?.email || 'Someone')
        setIncoming(payload)
        playRing()
      })
      .on('broadcast', { event: 'hangup' }, () => {
        stopRing()
        setIncoming(null)
      })
      .on('broadcast', { event: 'decline' }, () => {
        stopRing()
        setIncoming(null)
      })
      .subscribe((status) => {
        console.log('GlobalCallListener subscribed:', status)
      })
    channelRef.current = ch
  }

  function playRing() {
    stopRing()
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      let active = true
      ringCtxRef.current = { stop: () => { active = false; try { ctx.close() } catch (e) {} } }
      const ring = () => {
        if (!active) return
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.connect(gain); gain.connect(ctx.destination)
        osc.type = 'sine'
        osc.frequency.setValueAtTime(380, ctx.currentTime)
        osc.frequency.linearRampToValueAtTime(480, ctx.currentTime + 0.4)
        gain.gain.setValueAtTime(0, ctx.currentTime)
        gain.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.05)
        gain.gain.setValueAtTime(0.25, ctx.currentTime + 0.35)
        gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.45)
        osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5)
        if (active) setTimeout(ring, 1800)
      }
      ring()
    } catch (e) {}
  }

  function stopRing() {
    if (ringCtxRef.current) { ringCtxRef.current.stop(); ringCtxRef.current = null }
  }

  async function answer() {
    stopRing()
    sessionStorage.setItem('__pendingCall', JSON.stringify(incoming))
    setIncoming(null)
    window.location.href = `/chat/${incoming.fromUser}`
  }

  async function decline() {
    stopRing()
    const ch = supabase.channel(`call_broadcast_${incoming.fromUser}`)
    await ch.subscribe()
    await ch.send({ type: 'broadcast', event: 'decline', payload: { callId: incoming.callId } })
    supabase.removeChannel(ch)
    setIncoming(null)
  }

  if (!incoming) return null

  const isVideo = incoming.callType === 'video'

  return (
    <div style={S.overlay}>
      <style>{`
        @keyframes ringPulse{0%,100%{transform:scale(1);box-shadow:0 0 0 0 rgba(26,122,74,0.4)}50%{transform:scale(1.06);box-shadow:0 0 0 16px rgba(26,122,74,0)}}
        @keyframes ripple{0%{transform:scale(1);opacity:0.6}100%{transform:scale(2.2);opacity:0}}
        @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
      `}</style>
      <div style={S.card}>
        <div style={{ position: 'relative', width: 90, height: 90, margin: '0 auto 20px' }}>
          <div style={{ ...S.ripple, animationDelay: '0s' }} />
          <div style={{ ...S.ripple, animationDelay: '0.6s' }} />
          <div style={S.avatar}>{callerName[0]?.toUpperCase()}</div>
        </div>
        <div style={S.name}>{callerName}</div>
        <div style={S.status}>{isVideo ? '📹 Incoming video call' : '📞 Incoming voice call'}</div>
        <div style={S.btnRow}>
          <div style={{ textAlign: 'center' }}>
            <button style={S.declineBtn} onClick={decline}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M23.71 16.67C22.69 15.65 21.38 15.1 20 15.1s-2.69.55-3.71 1.57l-2.15 2.15c-3.63-1.97-6.99-5.33-8.96-8.96l2.15-2.15C8.45 6.69 9 5.38 9 4s-.55-2.69-1.57-3.71C6.41-.71 5.13-1.3 3.8-1.3c-1.33 0-2.63.57-3.5 1.57l-1.5 1.5C-3.2 4.27-1.66 10.17 3.3 15.12c4.96 4.97 10.86 6.51 13.35 4.5l1.5-1.5c.98-.87 1.55-2.13 1.55-3.45 0-1.33-.57-2.63-1.99-3.5z" /></svg>
            </button>
            <div style={S.btnLabel}>Decline</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <button style={S.answerBtn} onClick={answer}>
              <svg width="26" height="26" viewBox="0 0 24 24" fill="white"><path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1-9.4 0-17-7.6-17-17 0-.6.4-1 1-1h3.5c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.3 0 .7-.2 1L6.6 10.8z" /></svg>
            </button>
            <div style={S.btnLabel}>Answer</div>
          </div>
        </div>
      </div>
    </div>
  )
}

const S = {
  overlay: { position: 'fixed', inset: 0, background: 'linear-gradient(160deg,#0a1a10,#0f2d1a)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'slideUp 0.3s ease' },
  card: { textAlign: 'center', padding: '40px 24px' },
  avatar: { width: 90, height: 90, borderRadius: '50%', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff', fontSize: 36, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'absolute', inset: 0, animation: 'ringPulse 1.4s infinite' },
  ripple: { position: 'absolute', inset: -8, borderRadius: '50%', border: '2px solid rgba(26,122,74,0.5)', animation: 'ripple 2s ease-out infinite' },
  name: { fontSize: 26, fontWeight: 800, color: '#fff', marginBottom: 10 },
  status: { fontSize: 15, color: 'rgba(255,255,255,0.55)', marginBottom: 8 },
  btnRow: { display: 'flex', gap: 40, justifyContent: 'center', marginTop: 36 },
  declineBtn: { width: 64, height: 64, borderRadius: '50%', background: '#e74c3c', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(231,76,60,0.4)' },
  answerBtn: { width: 64, height: 64, borderRadius: '50%', background: '#1a7a4a', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(26,122,74,0.5)', animation: 'ringPulse 1.4s infinite' },
  btnLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 8 },
}