import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const CallContext = createContext(null)

export function useCall() {
  return useContext(CallContext)
}

export function CallProvider({ children }) {
  const [incomingCall, setIncomingCall] = useState(null)

  // Inbound broadcast channel (ring / answer / decline / hangup)
  const channelRef = useRef(null)
  const listenersRef = useRef([])
  const ringAudioRef = useRef(null)
  const currentUserRef = useRef(null)
  const reconnectTimerRef = useRef(null)

  // Outbound broadcast channel — one persistent channel per target user
  // Used ONLY for ring / answer / decline / hangup (not ICE)
  const outboundChannelsRef = useRef({})

  // ICE candidate DB subscription — one subscription per active call
  const iceSub = useRef(null)

  useEffect(() => {
    setupChannel()
    return () => {
      teardownChannel()
      clearTimeout(reconnectTimerRef.current)
      Object.values(outboundChannelsRef.current).forEach(ch => {
        try { supabase.removeChannel(ch) } catch (e) {}
      })
      outboundChannelsRef.current = {}
      stopIceSubscription()
    }
  }, [])

  function teardownChannel() {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }

  async function setupChannel() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    currentUserRef.current = user
    if (channelRef.current) return

    const channel = supabase
      .channel(`call_inbox_${user.id}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'call_signal' }, ({ payload }) => {
        handleIncomingSignal(payload)
      })
      .subscribe((status) => {
        console.log('CallProvider channel status:', status)
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(reconnectTimerRef.current)
          channelRef.current = null
          reconnectTimerRef.current = setTimeout(() => setupChannel(), 3000)
        }
      })

    channelRef.current = channel
  }

  function handleIncomingSignal(payload) {
    for (const listener of listenersRef.current) {
      const handled = listener(payload)
      if (handled) return
    }
    if (payload._event === 'ring') {
      setIncomingCall(payload)
    }
  }

  function registerCallListener(fn) {
    listenersRef.current.push(fn)
    return () => {
      listenersRef.current = listenersRef.current.filter(f => f !== fn)
    }
  }

  function dismissIncoming() {
    setIncomingCall(null)
  }

  // ─── Broadcast signal (ring / answer / decline / hangup) ─────────────────
  // ICE candidates do NOT go through here — they use sendIceCandidate() below.
  async function sendSignal(targetUserId, event, payload = {}) {
    if (!targetUserId) { console.error('sendSignal: no targetUserId'); return }

    const channelName = `call_inbox_${targetUserId}`
    let ch = outboundChannelsRef.current[targetUserId]

    if (!ch) {
      ch = supabase.channel(channelName, { config: { broadcast: { self: false } } })
      outboundChannelsRef.current[targetUserId] = ch
      await new Promise((resolve) => {
        ch.subscribe((status) => {
          if (status === 'SUBSCRIBED') resolve()
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.error('sendSignal subscribe error:', status)
            delete outboundChannelsRef.current[targetUserId]
            resolve()
          }
        })
      })
    }

    try {
      await ch.send({
        type: 'broadcast',
        event: 'call_signal',
        payload: { _event: event, ...payload },
      })
    } catch (err) {
      console.error('sendSignal error:', err)
    }
  }

  // ─── ICE candidates via DB (bypasses Realtime WebSocket fallback) ─────────

  // Write one ICE candidate to the DB.
  // callId: shared string (e.g. generated from both user IDs)
  // fromUserId / toUserId: UUID strings
  async function sendIceCandidate(callId, fromUserId, toUserId, candidate) {
    if (!candidate) return
    const { error } = await supabase
      .from('ice_candidates')
      .insert({ call_id: callId, from_user: fromUserId, to_user: toUserId, candidate })
    if (error) console.error('sendIceCandidate insert error:', error)
  }

  // Subscribe to incoming ICE candidates for this call.
  // onCandidate(candidate) is called for each new row.
  function subscribeToIceCandidates(callId, myUserId, onCandidate) {
    stopIceSubscription() // clear any previous sub

    const sub = supabase
      .channel(`ice_${callId}_${myUserId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'ice_candidates',
          filter: `call_id=eq.${callId}`,
        },
        (payload) => {
          const row = payload.new
          // Only process candidates addressed to me
          if (row.to_user !== myUserId) return
          console.log(`[ice-db] received candidate for ${myUserId}`)
          onCandidate(row.candidate)
        }
      )
      .subscribe((status) => {
        console.log(`[ice-db] subscription status: ${status}`)
      })

    iceSub.current = sub
    return sub
  }

  function stopIceSubscription() {
    if (iceSub.current) {
      try { supabase.removeChannel(iceSub.current) } catch (e) {}
      iceSub.current = null
    }
  }

  // Clean up ICE rows after call ends (optional but keeps DB tidy)
  async function cleanupIceCandidates(callId) {
    await supabase.from('ice_candidates').delete().eq('call_id', callId)
  }

  function closeOutboundChannel(targetUserId) {
    const ch = outboundChannelsRef.current[targetUserId]
    if (ch) {
      try { supabase.removeChannel(ch) } catch (e) {}
      delete outboundChannelsRef.current[targetUserId]
    }
  }

  // ─── Ringtone ─────────────────────────────────────────────────────────────
  function playRing() {
    stopRing()
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      let playing = true
      ringAudioRef.current = { stop: () => { playing = false; try { ctx.close() } catch (e) {} } }
      function ring() {
        if (!playing) return
        ;[520, 520].forEach((freq, i) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.type = 'sine'; osc.frequency.value = freq
          const t = ctx.currentTime + i * 0.18
          gain.gain.setValueAtTime(0, t)
          gain.gain.linearRampToValueAtTime(0.22, t + 0.02)
          gain.gain.linearRampToValueAtTime(0, t + 0.16)
          osc.start(t); osc.stop(t + 0.18)
        })
        if (playing) setTimeout(ring, 2000)
      }
      ring()
    } catch (e) {}
  }

  function stopRing() {
    if (ringAudioRef.current) {
      ringAudioRef.current.stop()
      ringAudioRef.current = null
    }
  }

  return (
    <CallContext.Provider value={{
      incomingCall,
      sendSignal,
      sendIceCandidate,
      subscribeToIceCandidates,
      stopIceSubscription,
      cleanupIceCandidates,
      registerCallListener,
      dismissIncoming,
      playRing,
      stopRing,
      closeOutboundChannel,
    }}>
      {children}
    </CallContext.Provider>
  )
}