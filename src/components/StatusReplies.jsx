import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

// Module-level cache so N feed cards mounting the hook share one profile fetch.
const avatarCache = new Map()
let avatarInflight = null
let avatarInflightUser = null
export function fetchCurrentUserAvatar(currentUserId) {
  if (avatarCache.has(currentUserId)) return Promise.resolve(avatarCache.get(currentUserId))
  if (avatarInflightUser === currentUserId && avatarInflight) return avatarInflight
  avatarInflightUser = currentUserId
  avatarInflight = supabase.from('profiles').select('avatar_url').eq('id', currentUserId).maybeSingle()
    .then(({ data }) => {
      const v = data?.avatar_url || null
      avatarCache.set(currentUserId, v)
      return v
    })
    .finally(() => { avatarInflight = null })
  return avatarInflight
}

/**
 * Shared status-reply logic used by BOTH the full-screen story viewer
 * (StoryViewer.jsx) and the vertical feed comment drawer (StatusPage.jsx)
 * so posting, loading and realtime sync behave identically everywhere.
 *
 * Canonical write path: a single `status_replies` row — the public comment
 * shown in the reply thread. Commenting does NOT create a `messages`/chat row;
 * chat is a separate, deliberate action elsewhere. (The messages-marker load
 * fallback below exists only for OLD replies dual-written before this change.)
 *
 * `story` needs: id, user_id, content, tagged_listing_id, tagged?.title.
 *
 * `preload` (default false): when true, replies are fetched eagerly on status
 * change (used by the full-screen viewer so the reply-count badge stays fresh);
 * the feed drawer passes false and only loads when the drawer is opened.
 */
export function useStatusReplies({ story, currentUserId, notify, preload = false }) {
  const statusId = story?.id

  const [replies, setReplies] = useState([])
  const [replyCount, setReplyCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [open, setOpen] = useState(false)
  const [myAvatar, setMyAvatar] = useState(null)

  // Current user avatar for optimistic reply rows (cached — many feed cards share it)
  useEffect(() => {
    if (!currentUserId) return
    let cancelled = false
    fetchCurrentUserAvatar(currentUserId).then(avatar => { if (!cancelled) setMyAvatar(avatar) })
    return () => { cancelled = true }
  }, [currentUserId])

  const attachAuthors = useCallback(async rows => {
    const ids = [...new Set((rows || []).map(r => r.from_user).filter(Boolean))]
    if (!ids.length) return rows || []
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', ids)
    const map = {}
    for (const p of profiles || []) map[p.id] = p
    return (rows || []).map(r => ({
      ...r,
      author: r.author || map[r.from_user] || null,
    }))
  }, [])

  const load = useCallback(async () => {
    if (!statusId) return
    setLoading(true)

    // Preferred: status_replies table (public comment thread).
    const { data, error } = await supabase
      .from('status_replies')
      .select('id, body, created_at, from_user, listing_id')
      .eq('status_id', statusId)
      .order('created_at', { ascending: false })
      .limit(80)

    if (!error && data) {
      setReplies(await attachAuthors(data))
      setReplyCount(data.length)
      setLoading(false)
      return
    }
    if (error) console.error('[StatusReplies] status_replies load failed, using messages fallback:', error)

    // Fallback (legacy): messages carrying the status marker. Only relevant for
    // OLD replies dual-written before comments became public-only; new comments
    // never write a chat message, so this path is historical-only.
    const marker = `[[status_reply:${statusId}]]`
    const { data: msgs } = await supabase
      .from('messages')
      .select('id, body, created_at, from_user, listing_id')
      .ilike('body', `%${marker}%`)
      .order('created_at', { ascending: false })
      .limit(80)

    const parsed = (msgs || []).map(m => ({
      id: m.id,
      body: String(m.body || '')
        .replace(marker, '')
        .replace(/\n*— replied on your status[\s\S]*$/i, '')
        .replace(/^\n+/, '')
        .trim(),
      created_at: m.created_at,
      from_user: m.from_user,
      listing_id: m.listing_id,
    }))
    setReplies(await attachAuthors(parsed))
    setReplyCount(parsed.length)
    setLoading(false)
  }, [statusId, attachAuthors])

  // Reset + (re)load when the status changes so the count stays fresh
  useEffect(() => {
    if (!statusId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on status change
    setText('')
    setOpen(false)
    if (preload) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusId])

  // Realtime sync while the sheet/drawer is open
  useEffect(() => {
    if (!open || !statusId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load when opened
    load()
    const ch = supabase.channel(`st-replies-${statusId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'status_replies', filter: `status_id=eq.${statusId}` }, () => load())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'status_replies', filter: `status_id=eq.${statusId}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [open, statusId, load])

  function openReplies() {
    setLoading(true)
    setOpen(true)
  }

  function closeReplies() {
    setOpen(false)
  }

  const submit = useCallback(async () => {
    const body = text.trim()
    if (!body || sending || !currentUserId || !story?.id) return
    if (currentUserId === story.user_id) {
      notify?.('You can’t reply to your own status')
      return
    }

    setSending(true)

    // Public comment only: write the structured reply to status_replies.
    // No `messages`/chat row is created — chat is a separate, deliberate action.
    const replyRow = {
      status_id: story.id,
      from_user: currentUserId,
      to_user: story.user_id,
      body,
      listing_id: story.tagged_listing_id || null,
      message_id: null,
    }
    const { data: saved, error: replyError } = await supabase
      .from('status_replies')
      .insert(replyRow)
      .select(`
        id, body, created_at, from_user, listing_id,
        author:profiles!from_user ( id, full_name, avatar_url )
      `)
      .maybeSingle()

    // Never let a write failure be silent: log loudly and surface to the user.
    if (replyError) {
      console.error('[StatusReplies] status_replies insert FAILED:', replyError)
      notify?.('Could not post reply — try again')
      setSending(false)
      return
    }

    // Optimistic local list update
    const optimistic = saved || {
      id: `local_${Date.now()}`,
      body,
      created_at: new Date().toISOString(),
      from_user: currentUserId,
      listing_id: story.tagged_listing_id || null,
      author: { id: currentUserId, full_name: 'You', avatar_url: myAvatar },
    }
    setReplies(prev => [optimistic, ...prev])
    setReplyCount(c => c + 1)

    setText('')
    notify?.('Reply posted')

    setSending(false)
  }, [text, sending, currentUserId, story, myAvatar, notify])

  return {
    replies, replyCount, loading, text, setText, sending, open, myAvatar,
    openReplies, closeReplies, submit,
  }
}
