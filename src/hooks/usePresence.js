import { useEffect } from 'react'
import { supabase } from '../lib/supabase'

const GLOBAL_CHANNEL = 'app_presence_global'
const ONLINE_WINDOW_MS = 120_000
const HEARTBEAT_MS = 25_000
// Don't flip offline on a single leave/sync — re-track (typing) causes brief leave/join
const OFFLINE_GRACE_MS = 12_000
// After a typing/recording broadcast, keep them online at least this long
const ACTIVITY_STICKY_MS = 6_000

export let globalChannel = null
let refCount = 0
let myPresenceUserId = null

// otherUserId → Set of callback entries
const listeners = new Map()
// Grace timers for offline (avoid flicker when anyone re-tracks)
const offlineGraceTimers = new Map()
// userId → timestamp until which we refuse to mark them offline
const stickyOnlineUntil = new Map()

let iAmTyping = false
let iAmRecording = false
let activityTarget = { peerId: null, contextId: null, source: null }
// Last presence payload signature we tracked (skip redundant track() to avoid leave/join)
let lastTrackSig = ''

function presenceMeta(state, uid) {
  const list = state?.[uid]
  if (!list || !list.length) return null
  // Prefer the newest payload that is actively typing/recording
  const active = [...list].reverse().find(p => p?.typing === true || p?.recording === true)
  if (active) return active
  return list[list.length - 1] || list[0]
}

function activityMetaFromPresence(p) {
  if (!p) return null
  return {
    peerId: p.peer_id || null,
    contextId: p.context_id != null && p.context_id !== '' ? String(p.context_id) : null,
    source: p.source || null,
  }
}

function forEachListener(uid, fn) {
  const set = listeners.get(uid)
  if (!set) return
  set.forEach((cb) => {
    try { fn(cb) } catch { /* ignore */ }
  })
}

function clearOfflineGrace(uid) {
  const t = offlineGraceTimers.get(uid)
  if (t) {
    clearTimeout(t)
    offlineGraceTimers.delete(uid)
  }
}

function markStickyOnline(uid, ms = ACTIVITY_STICKY_MS) {
  if (!uid) return
  const until = Date.now() + ms
  const prev = stickyOnlineUntil.get(uid) || 0
  if (until > prev) stickyOnlineUntil.set(uid, until)
}

function isStickyOnline(uid) {
  const until = stickyOnlineUntil.get(uid)
  if (!until) return false
  if (Date.now() < until) return true
  stickyOnlineUntil.delete(uid)
  return false
}

function stillPresent(uid) {
  if (!globalChannel || !uid) return false
  try {
    const p = presenceMeta(globalChannel.presenceState() || {}, uid)
    return !!(p && !p.away)
  } catch {
    return false
  }
}

function scheduleOffline(uid, leftAt) {
  // Never schedule offline while sticky (recent typing/recording from them)
  if (isStickyOnline(uid)) return
  // If already back in presence, skip
  if (stillPresent(uid)) {
    clearOfflineGrace(uid)
    return
  }

  clearOfflineGrace(uid)
  const timer = setTimeout(() => {
    offlineGraceTimers.delete(uid)
    // Confirm still missing / away
    if (isStickyOnline(uid) || stillPresent(uid)) return
    forEachListener(uid, (cb) => {
      cb.onOnline?.(false, leftAt || new Date())
      cb.onTyping?.(false, null)
      cb.onRecording?.(false, null)
      if (leftAt) cb.onLastSeen?.(leftAt)
    })
  }, OFFLINE_GRACE_MS)
  offlineGraceTimers.set(uid, timer)
}

function notifyListeners(state) {
  listeners.forEach((set, uid) => {
    const p = presenceMeta(state, uid)
    if (p && !p.away) {
      const onlineAt = p.online_at ? new Date(p.online_at) : new Date()
      const meta = activityMetaFromPresence(p)
      clearOfflineGrace(uid)
      set.forEach((cb) => {
        try { cb.onOnline?.(true, onlineAt) } catch { /* ignore */ }
        // Presence typing is secondary to broadcast — only apply if present
        try { cb.onTyping?.(!!p.typing, meta) } catch { /* ignore */ }
        try { cb.onRecording?.(!!p.recording, meta) } catch { /* ignore */ }
        try { cb.onLastSeen?.(onlineAt) } catch { /* ignore */ }
      })
    } else if (p && p.away) {
      // Connected but tab hidden — not fully offline; clear typing only
      const onlineAt = p.online_at ? new Date(p.online_at) : new Date()
      if (isStickyOnline(uid)) {
        // Recent activity wins over away flag
        set.forEach((cb) => {
          try { cb.onOnline?.(true, onlineAt) } catch { /* ignore */ }
        })
        return
      }
      set.forEach((cb) => {
        try { cb.onOnline?.(false, onlineAt) } catch { /* ignore */ }
        try { cb.onTyping?.(false, null) } catch { /* ignore */ }
        try { cb.onRecording?.(!!p.recording, activityMetaFromPresence(p)) } catch { /* ignore */ }
        try { cb.onLastSeen?.(onlineAt) } catch { /* ignore */ }
      })
    } else {
      // Missing from snapshot — grace (re-track causes temporary gaps)
      scheduleOffline(uid, new Date())
    }
  })
}

function trackMe(extra = {}, { force = false } = {}) {
  const uid = myPresenceUserId
  if (!globalChannel || !uid) return
  const active = iAmTyping || iAmRecording
  const payload = {
    user_id: uid,
    typing: iAmTyping,
    recording: iAmRecording,
    peer_id: active ? activityTarget.peerId : null,
    context_id: active ? (activityTarget.contextId || null) : null,
    source: active ? (activityTarget.source || null) : null,
    // Never mark away while actively typing/recording
    away: active ? false : (!!document.hidden && !iAmRecording),
    online_at: new Date().toISOString(),
    ...extra,
  }
  // Skip identical presence tracks — each track() causes leave+join flicker on peers
  const sig = JSON.stringify({
    typing: payload.typing,
    recording: payload.recording,
    peer_id: payload.peer_id,
    context_id: payload.context_id,
    source: payload.source,
    away: payload.away,
  })
  if (!force && sig === lastTrackSig) return
  lastTrackSig = sig
  try {
    globalChannel.track(payload)
  } catch { /* ignore */ }
}

function broadcastActivity(event, active) {
  const uid = myPresenceUserId
  if (!globalChannel || !uid) return
  const flag = event === 'typing' ? 'typing' : 'recording'
  try {
    const _bcast = globalChannel.send({
      type: 'broadcast',
      event,
      payload: {
        user_id: uid,
        [flag]: !!active,
        peer_id: active ? activityTarget.peerId : null,
        context_id: active ? (activityTarget.contextId || null) : null,
        source: active ? (activityTarget.source || null) : null,
      },
    })
    if (_bcast && typeof _bcast.catch === 'function') _bcast.catch(() => {})
  } catch { /* ignore */ }
}

async function touchLastSeen(userId) {
  if (!userId) return
  try {
    await supabase
      .from('profiles')
      .upsert(
        { id: userId, last_seen: new Date().toISOString() },
        { onConflict: 'id' },
      )
  } catch { /* ignore */ }
}

function buildChannel(userId) {
  myPresenceUserId = userId
  lastTrackSig = ''
  const ch = supabase.channel(GLOBAL_CHANNEL, {
    config: {
      presence: { key: userId },
      broadcast: { self: false },
    },
  })

  ch.on('presence', { event: 'sync' }, () => {
    notifyListeners(ch.presenceState())
  })

  ch.on('presence', { event: 'join' }, ({ key }) => {
    // Someone (re)joined — cancel offline grace and refresh
    if (key) clearOfflineGrace(key)
    notifyListeners(ch.presenceState())
  })

  ch.on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
    const leftAt = leftPresences?.[0]?.online_at
      ? new Date(leftPresences[0].online_at)
      : new Date()
    // IMPORTANT: re-track (typing heartbeat) fires leave then join.
    // Never hard-offline here — grace + still-present check.
    // If they already re-joined, presenceState still has them.
    if (stillPresent(key) || isStickyOnline(key)) {
      clearOfflineGrace(key)
      return
    }
    scheduleOffline(key, leftAt)
  })

  ch.on('broadcast', { event: 'typing' }, ({ payload }) => {
    if (!payload?.user_id || payload.user_id === myPresenceUserId) return
    const meta = {
      peerId: payload.peer_id || null,
      contextId: payload.context_id != null && payload.context_id !== ''
        ? String(payload.context_id)
        : null,
      source: payload.source || null,
    }
    // Typing always implies the sender is online
    clearOfflineGrace(payload.user_id)
    if (payload.typing) markStickyOnline(payload.user_id)
    forEachListener(payload.user_id, (cb) => {
      cb.onOnline?.(true, new Date())
      cb.onTyping?.(!!payload.typing, meta)
      if (payload.typing) cb.onRecording?.(false, null)
    })
  })

  ch.on('broadcast', { event: 'recording' }, ({ payload }) => {
    if (!payload?.user_id || payload.user_id === myPresenceUserId) return
    const meta = {
      peerId: payload.peer_id || null,
      contextId: payload.context_id != null && payload.context_id !== ''
        ? String(payload.context_id)
        : null,
      source: payload.source || null,
    }
    clearOfflineGrace(payload.user_id)
    if (payload.recording) markStickyOnline(payload.user_id)
    forEachListener(payload.user_id, (cb) => {
      cb.onOnline?.(true, new Date())
      cb.onRecording?.(!!payload.recording, meta)
      if (payload.recording) cb.onTyping?.(false, null)
    })
  })

  ch.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      iAmTyping = false
      iAmRecording = false
      activityTarget = { peerId: null, contextId: null, source: null }
      lastTrackSig = ''
      trackMe({}, { force: true })
      await touchLastSeen(userId)
      notifyListeners(ch.presenceState())
    }
  })

  return ch
}

function setActivityTarget(target = {}) {
  const ctx = target.contextId
  activityTarget = {
    peerId: target.peerId || target.toUserId || null,
    contextId: ctx != null && ctx !== '' && ctx !== 'undefined' ? String(ctx) : null,
    source: target.source || null,
  }
}

/**
 * Typing is delivered primarily via broadcast (instant, no leave/join).
 * Presence track only updates when typing state flips on/off so peers
 * don't see the typer as offline on every keystroke.
 */
export function setTypingIndicator(isTyping, target) {
  const wasTyping = iAmTyping
  const prevTarget = { ...activityTarget }

  if (isTyping) {
    iAmRecording = false
    if (target) setActivityTarget(target)
  }
  iAmTyping = !!isTyping
  if (!isTyping && !iAmRecording) {
    activityTarget = { peerId: null, contextId: null, source: null }
  }

  // Always broadcast — peer uses this for the typing dots
  broadcastActivity('typing', iAmTyping)
  if (isTyping && iAmRecording === false && wasTyping === false) {
    broadcastActivity('recording', false)
  }

  const targetChanged = isTyping && (
    prevTarget.peerId !== activityTarget.peerId
    || prevTarget.contextId !== activityTarget.contextId
    || prevTarget.source !== activityTarget.source
  )
  // Re-track only on edge (start/stop) or peer scope change — avoids offline flicker
  if (wasTyping !== iAmTyping || targetChanged || !isTyping) {
    trackMe({ away: false })
  }
}

export function setRecordingIndicator(isRecording, target) {
  const wasRecording = iAmRecording
  const prevTarget = { ...activityTarget }

  if (isRecording) {
    iAmTyping = false
    if (target) setActivityTarget(target)
  }
  iAmRecording = !!isRecording
  if (!isRecording && !iAmTyping) {
    activityTarget = { peerId: null, contextId: null, source: null }
  }

  broadcastActivity('recording', iAmRecording)
  if (isRecording) broadcastActivity('typing', false)

  const targetChanged = isRecording && (
    prevTarget.peerId !== activityTarget.peerId
    || prevTarget.contextId !== activityTarget.contextId
    || prevTarget.source !== activityTarget.source
  )
  if (wasRecording !== iAmRecording || targetChanged || !isRecording) {
    trackMe({ away: false })
  }
}

/**
 * Match activity to a chat row / open thread.
 * Requires peerId === me when peerId is set.
 * Context must match when either side has a context id.
 */
export function activityTargetsChat(meta, { myId, otherId, contextId, source }) {
  if (!meta) return false

  // Addressed to me?
  if (meta.peerId) {
    if (!myId || String(meta.peerId) !== String(myId)) return false
  } else {
    // Unscoped activity — do not show on chat list rows
    return false
  }

  const metaCtx = meta.contextId != null && meta.contextId !== '' ? String(meta.contextId) : null
  const rowCtx = contextId != null && contextId !== '' && contextId !== 'undefined'
    ? String(contextId)
    : null

  // Both direct (no context) → match
  if (!metaCtx && !rowCtx) return true

  // One has context and the other doesn't → different chats
  if (!!metaCtx !== !!rowCtx) return false

  return metaCtx === rowCtx
}

export function useGlobalPresence(userId) {
  useEffect(() => {
    if (!userId) return

    refCount++
    myPresenceUserId = userId

    if (!globalChannel) {
      globalChannel = buildChannel(userId)
    } else {
      trackMe({ away: false }, { force: true })
      touchLastSeen(userId)
    }

    const heartbeat = setInterval(() => {
      // Heartbeat must force track so online_at stays fresh for peers
      lastTrackSig = ''
      trackMe({}, { force: true })
      touchLastSeen(userId)
    }, HEARTBEAT_MS)

    function onVisibility() {
      if (document.hidden) {
        if (!iAmRecording) {
          iAmTyping = false
          broadcastActivity('typing', false)
          if (!iAmRecording) {
            activityTarget = { peerId: null, contextId: null, source: null }
          }
        }
        lastTrackSig = ''
        trackMe({ away: !iAmRecording }, { force: true })
        touchLastSeen(userId)
      } else {
        lastTrackSig = ''
        trackMe({ away: false }, { force: true })
        touchLastSeen(userId)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    function onUnload() {
      try {
        iAmTyping = false
        iAmRecording = false
        const body = JSON.stringify({
          id: userId,
          last_seen: new Date().toISOString(),
        })
        navigator.sendBeacon?.(
          `${import.meta.env.VITE_SUPABASE_URL}/rest/v1/profiles?id=eq.${userId}`,
          new Blob([body], { type: 'application/json' }),
        )
      } catch { /* ignore */ }
    }
    window.addEventListener('pagehide', onUnload)

    return () => {
      clearInterval(heartbeat)
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onUnload)
      touchLastSeen(userId)
      refCount--
      if (refCount <= 0) {
        try {
          broadcastActivity('typing', false)
          broadcastActivity('recording', false)
        } catch { /* ignore */ }
        offlineGraceTimers.forEach(t => clearTimeout(t))
        offlineGraceTimers.clear()
        stickyOnlineUntil.clear()
        if (globalChannel) supabase.removeChannel(globalChannel)
        globalChannel = null
        myPresenceUserId = null
        iAmTyping = false
        iAmRecording = false
        activityTarget = { peerId: null, contextId: null, source: null }
        lastTrackSig = ''
        refCount = 0
      }
    }
  }, [userId])
}

export function watchUserOnline(otherUserId, onOnline, onTyping, onRecording, onLastSeen) {
  if (!otherUserId) return () => {}

  const entry = { onOnline, onTyping, onRecording, onLastSeen }
  let set = listeners.get(otherUserId)
  if (!set) {
    set = new Set()
    listeners.set(otherUserId, set)
  }
  set.add(entry)

  if (globalChannel) {
    const state = globalChannel.presenceState()
    const p = presenceMeta(state, otherUserId)
    const onlineAt = p?.online_at ? new Date(p.online_at) : null
    const meta = activityMetaFromPresence(p)
    try { onOnline?.(!!(p && !p.away), onlineAt) } catch { /* ignore */ }
    try { onTyping?.(!!(p && p.typing === true), meta) } catch { /* ignore */ }
    try { onRecording?.(!!(p && p.recording === true), meta) } catch { /* ignore */ }
    if (onlineAt) {
      try { onLastSeen?.(onlineAt) } catch { /* ignore */ }
    }
  }

  supabase
    .from('profiles')
    .select('last_seen')
    .eq('id', otherUserId)
    .maybeSingle()
    .then(({ data }) => {
      if (data?.last_seen) {
        try { onLastSeen?.(new Date(data.last_seen)) } catch { /* ignore */ }
        const age = Date.now() - new Date(data.last_seen).getTime()
        if (age >= 0 && age < ONLINE_WINDOW_MS) {
          const state = globalChannel?.presenceState?.()
          const p = presenceMeta(state, otherUserId)
          if (!p) {
            try { onOnline?.(true, new Date(data.last_seen)) } catch { /* ignore */ }
          }
        }
      }
    })

  return () => {
    const s = listeners.get(otherUserId)
    if (!s) return
    s.delete(entry)
    if (s.size === 0) {
      listeners.delete(otherUserId)
      clearOfflineGrace(otherUserId)
      stickyOnlineUntil.delete(otherUserId)
    }
  }
}

export function formatLastSeen(date) {
  if (!date) return 'last seen recently'
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return 'last seen recently'
  const diff = Date.now() - d.getTime()
  if (diff < 0) return 'last seen just now'
  if (diff < 20_000) return 'last seen just now'
  if (diff < 60_000) return 'last seen a few seconds ago'
  if (diff < 3600_000) {
    const m = Math.floor(diff / 60_000)
    return m === 1 ? 'last seen 1 minute ago' : `last seen ${m} minutes ago`
  }
  if (diff < 86400_000) {
    const h = Math.floor(diff / 3600_000)
    return h === 1 ? 'last seen 1 hour ago' : `last seen ${h} hours ago`
  }
  const yesterday = new Date()
  yesterday.setDate(yesterday.getDate() - 1)
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (sameDay(d, yesterday)) return `last seen yesterday at ${time}`
  if (diff < 7 * 86400_000) {
    const day = d.toLocaleDateString([], { weekday: 'long' })
    return `last seen ${day} at ${time}`
  }
  const dateStr = d.toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: diff > 365 * 86400_000 ? 'numeric' : undefined,
  })
  return `last seen ${dateStr} at ${time}`
}
