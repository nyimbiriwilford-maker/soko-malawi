import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ── Global channel name — same for every user on every page ──────────────────
const GLOBAL_CHANNEL = 'app_presence_global'

let globalChannel = null
let globalChannelUsers = 0 // reference count so we only create one channel

/**
 * useGlobalPresence
 * Call this ONCE at the app root (e.g. App.jsx or a layout wrapper).
 * It broadcasts the current user's presence on a single shared channel
 * so they appear online to everyone else regardless of which page they're on.
 */
export function useGlobalPresence(userId) {
  const channelRef = useRef(null)

  useEffect(() => {
    if (!userId) return

    // Reuse the singleton channel if already open
    if (!globalChannel) {
      globalChannel = supabase.channel(GLOBAL_CHANNEL, {
        config: { presence: { key: userId } },
      })
      globalChannel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await globalChannel.track({
            user_id: userId,
            typing: false,
            online_at: new Date().toISOString(),
          })
          // Persist last_seen so Chat.jsx can read it on load
          await supabase
            .from('profiles')
            .upsert({ id: userId, last_seen: new Date().toISOString() }, { onConflict: 'id' })
        }
      })
    } else {
      // Channel already exists — re-track with this user id
      globalChannel.track({
        user_id: userId,
        typing: false,
        online_at: new Date().toISOString(),
      })
    }

    globalChannelUsers++
    channelRef.current = globalChannel

    // Update last_seen every 2 minutes while alive
    const heartbeat = setInterval(async () => {
      await supabase
        .from('profiles')
        .upsert({ id: userId, last_seen: new Date().toISOString() }, { onConflict: 'id' })
      globalChannel?.track({ user_id: userId, typing: false, online_at: new Date().toISOString() })
    }, 120_000)

    // On tab hide/show — update presence state
    function handleVisibility() {
      if (document.hidden) {
        globalChannel?.track({ user_id: userId, typing: false, away: true })
      } else {
        globalChannel?.track({ user_id: userId, typing: false, away: false, online_at: new Date().toISOString() })
        supabase.from('profiles').upsert({ id: userId, last_seen: new Date().toISOString() }, { onConflict: 'id' })
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', handleVisibility)
      globalChannelUsers--
      // Persist last_seen on unmount (tab close / logout)
      supabase.from('profiles').upsert({ id: userId, last_seen: new Date().toISOString() }, { onConflict: 'id' })
      if (globalChannelUsers <= 0) {
        supabase.removeChannel(globalChannel)
        globalChannel = null
        globalChannelUsers = 0
      }
    }
  }, [userId])
}

/**
 * watchUserOnline
 * Call inside Chat.jsx (or anywhere) to watch whether a specific OTHER user is online.
 * Returns an unsubscribe function.
 *
 * @param {string} otherUserId  — the user to watch
 * @param {function} onOnline   — called with true/false
 * @param {function} onTyping   — called with true/false (optional)
 */
export function watchUserOnline(otherUserId, onOnline, onTyping) {
  // Listen on the same global channel
  const ch = supabase.channel(GLOBAL_CHANNEL + '_watch_' + otherUserId)

  ch.on('presence', { event: 'sync' }, () => {
    // We can't read globalChannel.presenceState() from a different channel object,
    // so we use a separate join/leave listener instead (see below).
  })

  // The reliable way: subscribe to the SAME global channel and check presenceState
  const watchCh = supabase.channel(GLOBAL_CHANNEL, {
    config: { presence: { key: otherUserId + '_watcher' } },
  })

  watchCh.on('presence', { event: 'sync' }, () => {
    const state = watchCh.presenceState()
    const present = state[otherUserId]
    const isOnline = !!(present && present.length > 0 && !present[0].away)
    onOnline(isOnline)
    if (onTyping) onTyping(present?.[0]?.typing === true)
  })

  watchCh.on('presence', { event: 'join' }, ({ key }) => {
    if (key === otherUserId) onOnline(true)
  })

  watchCh.on('presence', { event: 'leave' }, ({ key }) => {
    if (key === otherUserId) { onOnline(false); if (onTyping) onTyping(false) }
  })

  watchCh.subscribe()

  return () => supabase.removeChannel(watchCh)
}