import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { uploadToR2 } from '../lib/r2'

const avatarCache = new Map()
let avatarInflight = null
let avatarInflightUser = null
function fetchCurrentUserAvatar(currentUserId) {
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
 * Threaded status comments on the `status_comments` table (parent_id + media_urls +
 * reactions), with legacy `status_replies` merged in as read-only top-level rows so
 * existing comment history keeps showing. Used by BOTH the full-screen StoryViewer
 * and the StatusPage feed drawer so commenting behaves identically everywhere.
 *
 * `story` needs: id, user_id.
 */
export function useStatusComments({ story, currentUserId, notify, preload = false }) {
  const statusId = story?.id

  const [comments, setComments] = useState([])
  const [commentCount, setCommentCount] = useState(0)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [posting, setPosting] = useState(false)
  const [myAvatar, setMyAvatar] = useState(null)

  useEffect(() => {
    if (!currentUserId) return
    let cancelled = false
    fetchCurrentUserAvatar(currentUserId)
      .then(a => { if (!cancelled) setMyAvatar(a) })
      .catch(() => { if (!cancelled) setMyAvatar(null) })
    return () => { cancelled = true }
  }, [currentUserId])

  const load = useCallback(async () => {
    if (!statusId) return
    setLoading(true)

    const [{ data: rows }, { data: legacy }] = await Promise.all([
      supabase
        .from('status_comments')
        .select('id, status_id, user_id, body, parent_id, media_urls, created_at')
        .eq('status_id', statusId)
        .order('created_at', { ascending: true })
        .limit(200),
      supabase
        .from('status_replies')
        .select('id, body, created_at, from_user')
        .eq('status_id', statusId)
        .order('created_at', { ascending: true })
        .limit(200),
    ])

    const fresh = (rows || []).map(r => ({ ...r, _legacy: false }))
    const old = (legacy || []).map(r => ({
      id: `legacy_${r.id}`,
      status_id: statusId,
      user_id: r.from_user,
      body: r.body,
      parent_id: null,
      media_urls: [],
      created_at: r.created_at,
      _legacy: true,
    }))
    let list = [...old, ...fresh]

    const userIds = [...new Set(list.map(c => c.user_id).filter(Boolean))]
    if (userIds.length) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name, avatar_url').in('id', userIds)
      const map = Object.fromEntries((profiles || []).map(p => [p.id, p]))
      list = list.map(c => ({ ...c, author: map[c.user_id] || null }))
    }

    const commentIds = fresh.map(c => c.id)
    if (commentIds.length) {
      const { data: reactions } = await supabase
        .from('status_comment_reactions')
        .select('comment_id, user_id, reaction')
        .in('comment_id', commentIds)
      const byId = {}
      for (const r of reactions || []) {
        if (!byId[r.comment_id]) byId[r.comment_id] = { count: 0, mine: false }
        byId[r.comment_id].count += 1
        if (r.user_id === currentUserId) byId[r.comment_id].mine = true
      }
      list = list.map(c => ({
        ...c,
        likeCount: byId[c.id]?.count || 0,
        myLike: !!byId[c.id]?.mine,
      }))
    } else {
      list = list.map(c => ({ ...c, likeCount: 0, myLike: false }))
    }

    list.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    setComments(list)
    setCommentCount(list.length)
    setLoading(false)
  }, [statusId, currentUserId])

  // Reset + (re)load when the status changes so the count stays fresh
  useEffect(() => {
    if (!statusId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset on status change
    setOpen(false)
    setComments([])
    setCommentCount(0)
    if (preload) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusId])

  // Realtime sync while the sheet/drawer is open
  useEffect(() => {
    if (!open || !statusId) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load when opened
    load()
    const opts = { schema: 'public', table: 'status_comments' }
    const ch = supabase.channel(`st-comments-${statusId}`)
      .on('postgres_changes', { ...opts, event: 'INSERT', filter: `status_id=eq.${statusId}` }, () => load())
      .on('postgres_changes', { ...opts, event: 'DELETE', filter: `status_id=eq.${statusId}` }, () => load())
      .on('postgres_changes', { schema: 'public', table: 'status_comment_reactions', event: 'INSERT' }, () => load())
      .on('postgres_changes', { schema: 'public', table: 'status_comment_reactions', event: 'DELETE' }, () => load())
      .on('postgres_changes', { schema: 'public', table: 'status_replies', event: 'INSERT', filter: `status_id=eq.${statusId}` }, () => load())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [open, statusId, load])

  const openComments = useCallback(() => { setLoading(true); setOpen(true) }, [])
  const closeComments = useCallback(() => setOpen(false), [])

  const notifyRecipients = useCallback(async (text, parentId) => {
    try {
      const { data: profile } = await supabase
        .from('profiles').select('full_name').eq('id', currentUserId).maybeSingle()
      const name = profile?.full_name || 'Someone'
      const preview = text
        ? `"${text.slice(0, 60)}${text.length > 60 ? '…' : ''}"`
        : '📷 Sent media'

      if (parentId && !String(parentId).startsWith('legacy_')) {
        const { data: parent } = await supabase
          .from('status_comments').select('user_id').eq('id', parentId).maybeSingle()
        if (parent?.user_id && parent.user_id !== currentUserId) {
          await supabase.from('notifications').insert({
            user_id: parent.user_id, type: 'status_comment_reply',
            title: `${name} replied to your comment`, body: preview,
            data: { status_id: statusId, comment_id: parentId, sender_name: name },
            read: false,
          })
        }
      }

      if (story?.user_id && story.user_id !== currentUserId) {
        await supabase.from('notifications').insert({
          user_id: story.user_id, type: parentId ? 'status_comment_reply' : 'status_comment',
          title: `${name} commented on your status`, body: preview,
          data: { status_id: statusId, sender_name: name },
          read: false,
        })
      }
    } catch (e) {
      console.warn('[StatusComments] notification error:', e)
    }
  }, [currentUserId, statusId, story])

  const uploadCommentMedia = useCallback(async (file, kind) => {
    const rawExt = (file.name || 'media').split('.').pop() || ''
    const ext = (rawExt.replace(/[^\w]/g, '').slice(0, 8) || (kind === 'video' ? 'mp4' : 'jpg')).toLowerCase()
    const path = `status-comments/${currentUserId}/${kind}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    // Story-media (app standard — same pipeline as status uploads) with a
    // status-media fallback. Supabase storage yields a guaranteed-absolute
    // public URL that doesn't depend on client env vars.
    const errors = []
    for (const bucket of ['story-media', 'status-media']) {
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, file, { contentType: file.type, upsert: false })
      if (!error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path)
        if (data?.publicUrl && /^https?:\/\//i.test(data.publicUrl)) return data.publicUrl
      }
      errors.push(`${bucket}: ${error?.message || 'bad public url'}`)
    }
    // Last resort: R2 — only accept a real absolute URL (a missing
    // VITE_R2_PUBLIC_URL would otherwise store an unresolvable "undefined/..." path).
    try {
      const r2Url = await uploadToR2(file, path)
      if (r2Url && /^https?:\/\//i.test(r2Url)) return r2Url
    } catch { /* fall through */ }
    console.warn('[StatusComments] media upload failed:', errors.join(' | '))
    return null
  }, [currentUserId])

  const postComment = useCallback(async ({ body = '', parentId = null, files = [] }) => {
    const text = String(body || '').trim()
    if ((!text && files.length === 0) || posting || !currentUserId || !statusId) return false
    setPosting(true)
    try {
      const media = []
      for (const f of files) {
        const kind = f.type.startsWith('video/') ? 'video' : 'image'
        const url = await uploadCommentMedia(f, kind)
        if (url) media.push({ url, kind })
      }
      const { data, error } = await supabase
        .from('status_comments')
        .insert({
          status_id: statusId,
          user_id: currentUserId,
          body: text,
          parent_id: parentId || null,
          media_urls: media,
        })
        .select('id, status_id, user_id, body, parent_id, media_urls, created_at')
        .single()
      if (error) throw error

      setComments(prev => [...prev, {
        ...data,
        author: { id: currentUserId, full_name: 'You', avatar_url: myAvatar },
        likeCount: 0, myLike: false, _legacy: false,
      }])
      setCommentCount(c => c + 1)

      notifyRecipients(text, parentId)
      notify?.('Comment posted')
      return true
    } catch (e) {
      console.error('[StatusComments] post failed:', e)
      notify?.('Could not post comment — try again')
      return false
    } finally {
      setPosting(false)
    }
  }, [posting, currentUserId, statusId, myAvatar, notify, notifyRecipients, uploadCommentMedia])

  const toggleLike = useCallback(async (comment) => {
    if (comment._legacy || !currentUserId) return
    const id = comment.id
    if (comment.myLike) {
      setComments(prev => prev.map(c => c.id === id ? { ...c, myLike: false, likeCount: Math.max(0, c.likeCount - 1) } : c))
      await supabase.from('status_comment_reactions').delete().eq('comment_id', id).eq('user_id', currentUserId)
    } else {
      setComments(prev => prev.map(c => c.id === id ? { ...c, myLike: true, likeCount: c.likeCount + 1 } : c))
      const { error } = await supabase.from('status_comment_reactions')
        .insert({ comment_id: id, user_id: currentUserId, reaction: 'love' })
      if (error) console.warn('[StatusComments] like failed:', error)
    }
  }, [currentUserId])

  const deleteComment = useCallback(async (comment) => {
    if (!comment || comment._legacy || comment.user_id !== currentUserId) return
    await supabase.from('status_comments').delete().eq('id', comment.id)
    setComments(prev => prev.filter(c => c.id !== comment.id && c.parent_id !== comment.id))
    setCommentCount(c => Math.max(0, c - 1))
    notify?.('Comment deleted')
  }, [currentUserId, notify])

  return {
    comments, commentCount, loading, open, posting, myAvatar,
    openComments, closeComments, load, postComment, toggleLike, deleteComment,
  }
}

/** Build the reply tree from the flat comment list. */
export function buildCommentTree(comments) {
  const topLevel = comments.filter(c => !c.parent_id)
  const childrenOf = parentId => comments.filter(c => c.parent_id === parentId)
  const nameById = Object.fromEntries(comments.map(c => [c.id, c.author?.full_name || 'Anonymous']))
  return { topLevel, childrenOf, nameById }
}
