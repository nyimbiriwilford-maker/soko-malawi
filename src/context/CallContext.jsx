import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const CallContext = createContext(null)

export function useCall() {
  return useContext(CallContext)
}

export function CallProvider({ children }) {
  const [incomingCall, setIncomingCall] = useState(null)
  const channelRef = useRef(null)
  const listenersRef = useRef([])
  const ringAudioRef = useRef(null)
  const currentUserRef = useRef(null)
  const reconnectTimerRef = useRef(null)

  // NEW: persistent outbound channels keyed by targetUserId
  // Reusing a subscribed channel avoids the subscribe-latency drop on rapid ICE sends
  const outboundChannelsRef = useRef({})

  useEffect(() => {
    setupChannel()
    return () => {
      teardownChannel()
      clearTimeout(reconnectTimerRef.current)
      // Clean up all persistent outbound channels
      Object.values(outboundChannelsRef.current).forEach(ch => {
        try { supabase.removeChannel(ch) } catch(e) {}
      })
      outboundChannelsRef.current = {}
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

    const channel = supabase.channel(`call_inbox_${user.id}`, {
      config: { broadcast: { self: false } }
    })

    channel
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
    const { _event } = payload
    for (const listener of listenersRef.current) {
      const handled = listener(payload)
      if (handled) return
    }
    if (_event === 'ring') {
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

  // FIX: Use a persistent channel per targetUserId so ICE candidates aren't dropped
  // while waiting for subscribe(). The channel is created once and reused.
  async function sendSignal(targetUserId, event, payload = {}) {
    if (!targetUserId) { console.error('sendSignal: no targetUserId'); return }

    const channelName = `call_inbox_${targetUserId}`

    // Reuse existing subscribed channel if available
    let ch = outboundChannelsRef.current[targetUserId]

    if (!ch) {
      // Create and wait for subscription
      ch = supabase.channel(channelName, {
        config: { broadcast: { self: false } }
      })
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

    // Channel is now subscribed — send immediately
    try {
      await ch.send({
        type: 'broadcast',
        event: 'call_signal',
        payload: { _event: event, ...payload }
      })
    } catch(err) {
      console.error('sendSignal send error:', err)
    }
  }

  // Call this when a call ends to clean up the outbound channel for that peer
  function closeOutboundChannel(targetUserId) {
    const ch = outboundChannelsRef.current[targetUserId]
    if (ch) {
      try { supabase.removeChannel(ch) } catch(e) {}
      delete outboundChannelsRef.current[targetUserId]
    }
  }

  function playRing() {
    stopRing()
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      let playing = true
      ringAudioRef.current = { stop: () => { playing = false; try { ctx.close() } catch(e){} } }
      function ring() {
        if (!playing) return
        const notes = [520, 520]
        notes.forEach((freq, i) => {
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
    } catch(e) {}
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