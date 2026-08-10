import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

const CallContext = createContext(null)

export function useCall() {
  return useContext(CallContext)
}

export function CallProvider({ children }) {
  const [incomingCall, setIncomingCall] = useState(null)

  // Persistent WebRTC state — survives Chat.jsx unmount
  const pcRef           = useRef(null)
  const localStreamRef  = useRef(null)
  const callIdRef       = useRef(null)
  const callerIdRef     = useRef(null)
  const callTimerRef    = useRef(null)
  /** Live remote MediaStream for mini/PiP (not React state — avoids re-renders) */
  const remoteMediaStreamRef = useRef(null)
  const localMediaStreamRef  = useRef(null)

  /**
   * Active call UI session (survives route changes).
   * { source, status, callType, peerId, peerName, peerAvatar, peerInitial,
   *   duration, isMuted, isCamOff, chatPath, listingId }
   */
  const [activeCall, setActiveCall] = useState(null)
  /** 'hidden' | 'full' | 'mini' — full = overlay, mini = floating bar */
  const [callUiMode, setCallUiMode] = useState('hidden')
  const [miniCallVisible, setMiniCallVisible] = useState(false)

  /**
   * Bound chat peer for PersistentCallShell (outgoing + chat-scoped WebRTC).
   * Kept while a call is active even after leaving the chat page.
   */
  const [boundChat, setBoundChat] = useState(null)
  const boundChatRef = useRef(null)
  boundChatRef.current = boundChat

  /** Controllers registered by the stack that owns media (chat or global) */
  const mediaControlsRef = useRef({
    hangUp: null,
    toggleMute: null,
    toggleCam: null,
    switchCamera: null,
  })

  /** Live actions from PersistentCallShell for chat header buttons */
  const chatCallActionsRef = useRef(null)
  const [chatCallActionsVersion, setChatCallActionsVersion] = useState(0)

  // Stable setter — only bump version when callState changes so consumers re-read.
  // Always incrementing caused "Maximum update depth exceeded" via PersistentCallShell.
  const setChatCallActions = useCallback((actions) => {
    const prev = chatCallActionsRef.current
    chatCallActionsRef.current = actions
    if (prev?.callState !== actions?.callState || !prev) {
      setChatCallActionsVersion((v) => v + 1)
    }
  }, [])

  const channelRef          = useRef(null)
  const listenersRef        = useRef([])
  const ringAudioRef        = useRef(null)
  const ringbackAudioRef    = useRef(null)
  const currentUserRef      = useRef(null)
 const reconnectTimerRef   = useRef(null)
  const reconnectAttemptsRef = useRef(0)
  const outboundChannelsRef = useRef({})
  const iceSub              = useRef(null)
  const iceOwnerRef         = useRef(null) // 'chat' | 'global' | null — single ICE owner
  const callStackOwnerRef   = useRef(null) // who owns the active media path
  const earlyIceRef         = useRef(new Map())
  const incomingActionsRef  = useRef({ answer: null, decline: null })
  /** callIds for which an 'answer' has already been broadcast — exactly-once delivery. */
  const answeredCallIdsRef  = useRef(new Set())

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
      for (const [, entry] of earlyIceRef.current) {
        try { supabase.removeChannel(entry.sub) } catch (e) {}
      }
      earlyIceRef.current.clear()
      iceOwnerRef.current = null
      callStackOwnerRef.current = null
    }
  }, [])

  /** Only one stack (chat useWebRTC vs GlobalCallListener) should own media/ICE. */
  function claimCallStack(owner) {
    if (!owner) return
    if (callStackOwnerRef.current && callStackOwnerRef.current !== owner) {
      console.warn(`[CallContext] claimCallStack ${owner} replaces ${callStackOwnerRef.current}`)
    }
    callStackOwnerRef.current = owner
  }

  function releaseCallStack(owner) {
    if (!owner || callStackOwnerRef.current === owner) {
      callStackOwnerRef.current = null
    }
  }

  function getCallStackOwner() {
    return callStackOwnerRef.current
  }

  function registerMediaControls(controls = {}) {
    mediaControlsRef.current = {
      ...mediaControlsRef.current,
      ...controls,
    }
  }

  function clearMediaControls() {
    mediaControlsRef.current = {
      hangUp: null,
      toggleMute: null,
      toggleCam: null,
      switchCamera: null,
    }
  }

  function publishActiveCall(partial) {
    setActiveCall((prev) => {
      const next = { ...(prev || {}), ...partial }
      // Skip no-op updates (e.g. same duration) to cut re-render thrash during calls
      if (
        prev &&
        prev.status === next.status &&
        prev.callType === next.callType &&
        prev.peerId === next.peerId &&
        prev.peerName === next.peerName &&
        prev.duration === next.duration &&
        prev.isMuted === next.isMuted &&
        prev.isCamOff === next.isCamOff &&
        prev.source === next.source &&
        prev.chatPath === next.chatPath
      ) {
        return prev
      }
      // Only bump updatedAt for non-timer field changes (media attach hooks key on this)
      const mediaRelevant =
        !prev ||
        prev.status !== next.status ||
        prev.callType !== next.callType ||
        prev.peerId !== next.peerId ||
        prev.isMuted !== next.isMuted ||
        prev.isCamOff !== next.isCamOff ||
        prev.source !== next.source
      next.updatedAt = mediaRelevant ? Date.now() : (prev.updatedAt || Date.now())
      return next
    })
  }

  function clearActiveCall() {
    setActiveCall(null)
    setCallUiMode('hidden')
    setMiniCallVisible(false)
    remoteMediaStreamRef.current = null
    localMediaStreamRef.current = null
    clearMediaControls()
  }

  function minimizeCall() {
    setCallUiMode('mini')
    setMiniCallVisible(true)
  }

  function expandCall() {
    setCallUiMode('full')
    setMiniCallVisible(false)
  }

  const bindChatCall = useCallback((payload) => {
    if (!payload?.userId) return
    boundChatRef.current = payload
    setBoundChat((prev) => {
      // Avoid re-render loops when parent re-binds with a new object of the same peer
      if (
        prev &&
        prev.userId === payload.userId &&
        prev.listingId === payload.listingId &&
        prev.otherName === payload.otherName &&
        prev.otherAvatar === payload.otherAvatar &&
        prev.otherInitial === payload.otherInitial &&
        prev.currentUser?.id === payload.currentUser?.id &&
        prev.onCallMessage === payload.onCallMessage &&
        prev.isServiceChatRef === payload.isServiceChatRef
      ) {
        // Keep latest refs even when identity is "same"
        prev.currentUser = payload.currentUser
        prev.onCallMessage = payload.onCallMessage
        prev.isServiceChatRef = payload.isServiceChatRef
        return prev
      }
      return payload
    })
  }, [])

  const unbindChatCall = useCallback(({ keepIfInCall = true } = {}) => {
    // Leaving the chat page mid-call — keep peer binding + show mini bar
    if (keepIfInCall && (callStackOwnerRef.current === 'chat' || callIdRef.current)) {
      setCallUiMode('mini')
      setMiniCallVisible(true)
      return
    }
    setBoundChat(null)
    boundChatRef.current = null
  }, [])

  function teardownChannel() {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }

  async function setupChannel() {
    if (channelRef.current) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    currentUserRef.current = user

    const channel = supabase
      .channel(`call_inbox_${user.id}`, { config: { broadcast: { self: false } } })
      .on('broadcast', { event: 'call_signal' }, ({ payload }) => {
        handleIncomingSignal(payload)
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          reconnectAttemptsRef.current = 0
          return
        }
        if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (reconnectAttemptsRef.current >= 5) return // stop after 5 attempts
          clearTimeout(reconnectTimerRef.current)
          channelRef.current = null
          const delay = Math.min(1000 * 2 ** reconnectAttemptsRef.current, 30000)
          reconnectAttemptsRef.current += 1
          reconnectTimerRef.current = setTimeout(() => setupChannel(), delay)
        }
      })

    channelRef.current = channel
  }

  function handleIncomingSignal(payload) {
    for (const listener of listenersRef.current) {
      const handled = listener(payload)
      if (handled) return
    }
    if (payload._event === 'ring') setIncomingCall(payload)
  }

  function registerCallListener(fn) {
    listenersRef.current.push(fn)
    return () => {
      listenersRef.current = listenersRef.current.filter(f => f !== fn)
    }
  }

  function dismissIncoming() { setIncomingCall(null) }

  async function sendSignal(targetUserId, event, payload = {}) {
    if (!targetUserId) { console.error('sendSignal: no targetUserId'); return }

    // Exactly-once answer: the global stack and the chat restore stack can race
    // to answer the same incoming call, each sending an 'answer'. Only the first
    // answer may leave this device so the caller never applies it twice.
    if (event === 'answer' && payload.callId) {
      const key = String(payload.callId)
      if (answeredCallIdsRef.current.has(key)) {
        console.warn('[CallContext] duplicate answer ignored for callId:', key)
        return
      }
      answeredCallIdsRef.current.add(key)
    }

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
      // The first answer never left this device — release the claim so the
      // retry safety net (re-send from the redundant delivery layer) can still
      // deliver the answer instead of failing the call outright.
      if (event === 'answer' && payload.callId) {
        answeredCallIdsRef.current.delete(String(payload.callId))
      }
      console.error('sendSignal error:', err)
    }
  }

  async function sendIceCandidate(callId, fromUserId, toUserId, candidate) {
    if (!candidate) return
    const { error } = await supabase
      .from('ice_candidates')
      .insert({ call_id: callId, from_user: fromUserId, to_user: toUserId, candidate })
    if (error) console.error('sendIceCandidate insert error:', error)
  }

  function subscribeToIceCandidates(callId, myUserId, onCandidate, owner = 'default') {
    // Do not steal ICE from another active stack mid-call
    if (iceOwnerRef.current && iceOwnerRef.current !== owner && callStackOwnerRef.current && callStackOwnerRef.current !== owner) {
      console.warn(`[ice-db] skip subscribe — owned by ${iceOwnerRef.current}, requester ${owner}`)
      return null
    }

    stopIceSubscription()
    iceOwnerRef.current = owner

    const sub = supabase
      .channel(`ice_${callId}_${myUserId}_${owner}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ice_candidates', filter: `call_id=eq.${callId}` },
        (payload) => {
          if (iceOwnerRef.current !== owner) return
          const row = payload.new
          if (row.to_user !== myUserId) return
          onCandidate(row.candidate)
        }
      )
      .subscribe(() => {})

    iceSub.current = sub
    return sub
  }

  function stopIceSubscription(owner) {
    // If owner specified, only stop when it matches
    if (owner && iceOwnerRef.current && iceOwnerRef.current !== owner) {
      return
    }
    if (iceSub.current) {
      try { supabase.removeChannel(iceSub.current) } catch (e) {}
      iceSub.current = null
    }
    if (!owner || iceOwnerRef.current === owner) {
      iceOwnerRef.current = null
    }
  }

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

  function subscribeToIceCandidatesEarly(callId, myUserId) {
    if (earlyIceRef.current.has(callId)) return

    const entry = { candidates: [], sub: null }
    earlyIceRef.current.set(callId, entry)

    const sub = supabase
      .channel(`ice_early_${callId}_${myUserId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'ice_candidates', filter: `call_id=eq.${callId}` },
        (payload) => {
          const row = payload.new
          if (row.to_user !== myUserId) return
          entry.candidates.push(row.candidate)
        }
      )
      .subscribe(() => {})

    entry.sub = sub
  }

  function drainEarlyCandidates(callId) {
    const entry = earlyIceRef.current.get(callId)
    if (!entry) return []
    const candidates = [...entry.candidates]
    try { supabase.removeChannel(entry.sub) } catch (e) {}
    earlyIceRef.current.delete(callId)
    return candidates
  }

 function playRing() {
    const prev = ringAudioRef.current
    ringAudioRef.current = null
    try {
      const audio = new Audio('/ringtone.mp3')
      audio.loop = true
      audio.volume = 1.0
      ringAudioRef.current = { stop: () => { audio.pause(); audio.currentTime = 0 } }
      const playPromise = audio.play()
      if (playPromise) {
        playPromise
          .then(() => { if (prev) prev.stop() })
          .catch(() => {
            if (prev) prev.stop()
            playRingSynth()
          })
      } else {
        if (prev) prev.stop()
      }
    } catch (e) {
      playRingSynth()
    }
  }

  function playRingSynth() {
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

  function playRingback() {
    stopRingback()
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      let playing = true
      ringbackAudioRef.current = { stop: () => { playing = false; try { ctx.close() } catch (e) {} } }
      function tone() {
        if (!playing) return
        [[440, 0], [440, 0.5]].forEach(([freq, delay]) => {
          const osc = ctx.createOscillator()
          const gain = ctx.createGain()
          osc.connect(gain); gain.connect(ctx.destination)
          osc.type = 'sine'; osc.frequency.value = freq
          const t = ctx.currentTime + delay
          gain.gain.setValueAtTime(0, t)
          gain.gain.linearRampToValueAtTime(0.15, t + 0.05)
          gain.gain.linearRampToValueAtTime(0, t + 0.45)
          osc.start(t); osc.stop(t + 0.5)
        })
        if (playing) setTimeout(tone, 4000)
      }
      tone()
    } catch (e) {}
  }

  function stopRingback() {
    if (ringbackAudioRef.current) {
      ringbackAudioRef.current.stop()
      ringbackAudioRef.current = null
    }
  }

  return (
    <CallContext.Provider value={{
      incomingCall,
      activeCall,
      setActiveCall,
      publishActiveCall,
      clearActiveCall,
      callUiMode,
      setCallUiMode,
      minimizeCall,
      expandCall,
      miniCallVisible,
      setMiniCallVisible,
      boundChat,
      bindChatCall,
      unbindChatCall,
      boundChatRef,
      mediaControlsRef,
      registerMediaControls,
      clearMediaControls,
      chatCallActionsRef,
      setChatCallActions,
      chatCallActionsVersion,
      remoteMediaStreamRef,
      localMediaStreamRef,
      pcRef,
      localStreamRef,
      callIdRef,
      callerIdRef,
      callTimerRef,
      sendSignal,
      sendIceCandidate,
      subscribeToIceCandidates,
      stopIceSubscription,
      cleanupIceCandidates,
      registerCallListener,
      setIncomingCall,
      dismissIncoming,
      playRing,
      stopRing,
      playRingback,
      stopRingback,
      closeOutboundChannel,
      subscribeToIceCandidatesEarly,
      drainEarlyCandidates,
      claimCallStack,
      releaseCallStack,
      getCallStackOwner,
      incomingActionsRef,
    }}>
      {children}
    </CallContext.Provider>
  )
}