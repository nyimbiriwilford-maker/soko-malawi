import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

const GLOBAL_CHANNEL = 'app_presence_global'

// ── Singleton — one channel object shared across the whole app ───────────────
// Exported so Chat.jsx can call .track() on it directly for typing.
export let globalChannel = null
let refCount = 0

// ── Listeners registry — Chat.jsx registers callbacks here ───────────────────
// Key: otherUserId, Value: { onOnline, onTyping }
const listeners = new Map()

function notifyListeners(state) {
  listeners.forEach(({ onOnline, onTyping }, uid) => {
    const presences = state[uid]
    const isOnline = !!(presences && presences.length > 0 && !presences[0].away)
    const isTyping = !!(presences && presences.length > 0 && presences[0].typing === true)
    onOnline(isOnline)
    if (onTyping) onTyping(isTyping)
  })
}

function buildChannel(userId) {
  const ch = supabase.channel(GLOBAL_CHANNEL, {
    config: { presence: { key: userId } },
  })

  ch.on('presence', { event: 'sync' }, () => {
    notifyListeners(ch.presenceState())
  })

  ch.on('presence', { event: 'join' }, ({ key, newPresences }) => {
    const cb = listeners.get(key)
    if (cb) {
      cb.onOnline(true)
      if (cb.onTyping) cb.onTyping(newPresences[0]?.typing === true)
    }
  })

  ch.on('presence', { event: 'leave' }, ({ key }) => {
    const cb = listeners.get(key)
    if (cb) {
      cb.onOnline(false)
      if (cb.onTyping) cb.onTyping(false)
    }
  })

  ch.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await ch.track({
        user_id: userId,
        typing: false,
        online_at: new Date().toISOString(),
      })
      await supabase
        .from('profiles')
        .upsert({ id: userId, last_seen: new Date().toISOString() }, { onConflict: 'id' })
      // Fire sync immediately so existing online users are detected
      notifyListeners(ch.presenceState())
    }
  })

  return ch
}

/**
 * useGlobalPresence — call once in App.jsx.
 * Creates/reuses the singleton presence channel and broadcasts this user as online.
 */
export function useGlobalPresence(userId) {
  useEffect(() => {
    if (!userId) return

    refCount++

    if (!globalChannel) {
      globalChannel = buildChannel(userId)
    } else {
      // Already subscribed — just re-track
      globalChannel.track({
        user_id: userId,
        typing: false,
        online_at: new Date().toISOString(),
      })
    }

    // Heartbeat: refresh last_seen + presence every 90s
    const heartbeat = setInterval(() => {
      globalChannel?.track({ user_id: userId, typing: false, online_at: new Date().toISOString() })
      supabase.from('profiles').upsert({ id: userId, last_seen: new Date().toISOString() }, { onConflict: 'id' })
    }, 90_000)

    // Tab visibility
    function onVisibility() {
      if (document.hidden) {
        globalChannel?.track({ user_id: userId, away: true, typing: false })
      } else {
        globalChannel?.track({ user_id: userId, away: false, typing: false, online_at: new Date().toISOString() })
        supabase.from('profiles').upsert({ id: userId, last_seen: new Date().toISOString() }, { onConflict: 'id' })
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onVisibility)
      supabase.from('profiles').upsert({ id: userId, last_seen: new Date().toISOString() }, { onConflict: 'id' })
      refCount--
      if (refCount <= 0) {
        supabase.removeChannel(globalChannel)
        globalChannel = null
        refCount = 0
      }
    }
  }, [userId])
}

/**
 * watchUserOnline — call in Chat.jsx to watch another user's online/typing state.
 * Registers callbacks on the SAME singleton channel — no new subscription needed.
 * Returns an unregister function.
 */
export function watchUserOnline(otherUserId, onOnline, onTyping) {
  if (!otherUserId) return () => {}

  listeners.set(otherUserId, { onOnline, onTyping })

  // If the channel is already subscribed, run a sync immediately
  // so we don't wait for the next presence event
  if (globalChannel) {
    const state = globalChannel.presenceState()
    const presences = state[otherUserId]
    const isOnline = !!(presences && presences.length > 0 && !presences[0].away)
    const isTyping = !!(presences && presences.length > 0 && presences[0].typing === true)
    onOnline(isOnline)
    if (onTyping) onTyping(isTyping)
  }

  return () => {
    listeners.delete(otherUserId)
  }
}