import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { isStatusVideoUrl } from '../utils/statusVideo'

const MAX_REELS = 12

/**
 * Soko Reels — the most-viewed current status videos.
 *
 * Filters active statuses down to video posts, ranks them by status_views
 * (ties: newest first), and exposes engagement helpers shared by the
 * in-feed reel card and the full-screen reels viewer.
 */
export function useReels(stories, currentUserId) {
  const idKey = useMemo(
    () => (stories || [])
      .filter(s => isStatusVideoUrl(s.media_urls?.[0]))
      .map(s => s.id)
      .filter(Boolean)
      .join('|'),
    [stories],
  )
  const [reels, setReels] = useState([])
  const [metrics, setMetrics] = useState({})

  const refresh = useCallback(async () => {
    const ids = idKey ? idKey.split('|') : []
    if (!ids.length) { setReels([]); setMetrics({}); return }

    const byId = {}
    const pool = (stories || []).filter(s => ids.includes(s.id))
    for (const s of pool) byId[s.id] = { views: 0, likes: 0, myLike: null }

    const [reactRes, viewRes] = await Promise.all([
      supabase.from('status_reactions').select('status_id, user_id, reaction').in('status_id', ids),
      Promise.all(ids.map(id => supabase.from('status_views').select('id', { count: 'exact', head: true }).eq('status_id', id))),
    ])

    for (const r of reactRes.data || []) {
      if (byId[r.status_id] && r.reaction === 'love') {
        byId[r.status_id].likes += 1
        if (r.user_id === currentUserId) byId[r.status_id].myLike = 'love'
      }
    }
    viewRes.forEach((res, i) => { if (byId[ids[i]] && res.count != null) byId[ids[i]].views = res.count })

    const ranked = pool
      .map(s => ({ s, views: byId[s.id]?.views || 0 }))
      .sort((a, b) => b.views - a.views || new Date(b.s.created_at) - new Date(a.s.created_at))
      .slice(0, MAX_REELS)

    setMetrics(Object.fromEntries(ranked.map(r => [r.s.id, byId[r.s.id]])))
    setReels(ranked.map(r => r.s))
  }, [idKey, stories, currentUserId])

  // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch reel metrics when the video pool changes
  useEffect(() => { refresh() }, [refresh])

  useEffect(() => {
    const ch = supabase.channel('soko-reels-metrics')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'status_views' }, () => refresh())
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'status_reactions' }, () => refresh())
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'status_reactions' }, () => refresh())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [refresh])

  const toggleLike = useCallback(async (statusId) => {
    if (!currentUserId || !metrics[statusId]) return
    const cur = metrics[statusId]
    if (cur.myLike) {
      setMetrics(m => ({ ...m, [statusId]: { ...m[statusId], myLike: null, likes: Math.max(0, (m[statusId]?.likes || 0) - 1) } }))
      await supabase.from('status_reactions').delete().eq('status_id', statusId).eq('user_id', currentUserId)
    } else {
      setMetrics(m => ({ ...m, [statusId]: { ...m[statusId], myLike: 'love', likes: (m[statusId]?.likes || 0) + 1 } }))
      await supabase.from('status_reactions').insert({ status_id: statusId, user_id: currentUserId, reaction: 'love' })
    }
    refresh()
  }, [currentUserId, metrics, refresh])

  /** Record a view (once per session per reel) and bump the local count. */
  const registerView = useCallback(async (statusId) => {
    if (!currentUserId || !statusId) return
    const { data } = await supabase.from('status_views')
      .upsert(
        { status_id: statusId, viewer_id: currentUserId },
        { onConflict: 'status_id,viewer_id', ignoreDuplicates: true },
      )
      .select('status_id')
    if (data?.length) {
      setMetrics(m => (m[statusId] ? { ...m, [statusId]: { ...m[statusId], views: (m[statusId].views || 0) + 1 } } : m))
    }
  }, [currentUserId])

  return { reels, metrics, toggleLike, registerView }
}
