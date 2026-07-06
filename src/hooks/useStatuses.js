import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const EXPIRY_OPTIONS = {
  availability:    24 * 60 * 60 * 1000,
  listing_update:  24 * 60 * 60 * 1000,
  listing_urgency:  6 * 60 * 60 * 1000,
  work_ping:       48 * 60 * 60 * 1000,
}

export function useStatuses(userId) {
  const [statuses, setStatuses] = useState([])
  const [loading, setLoading]   = useState(false)

  const load = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    if (!userId) { setStatuses([]); setLoading(false); return }
    const { data } = await supabase
      .from('user_statuses')
      .select('*')
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
    setStatuses(data || [])
    setLoading(false)
  }, [userId])

  useEffect(() => { load() }, [load])

  async function uploadStoryMedia(userId, file) {
    const ext = file.name.split('.').pop()
    const path = `${userId}/${Date.now()}.${ext}`
    const { error } = await supabase.storage
      .from('story-media')
      .upload(path, file, { contentType: file.type, upsert: false })
    if (error) return null
    const { data } = supabase.storage.from('story-media').getPublicUrl(path)
    return data.publicUrl
  }

  async function postStatus({ content, status_type, listing_id = null, location_hint = null, expiryKey, mediaFiles = [], tagged_listing_id = null }) {
    const ms = EXPIRY_OPTIONS[expiryKey || status_type] || EXPIRY_OPTIONS.availability
    const expires_at = new Date(Date.now() + ms).toISOString()

    // Upload media files
    const media_urls = []
    for (const file of mediaFiles) {
      const url = await uploadStoryMedia(userId, file)
      if (url) media_urls.push(url)
    }

    const { data, error } = await supabase.from('user_statuses').insert({
      user_id: userId,
      content,
      status_type,
      listing_id,
      location_hint,
      expires_at,
      media_urls,
      tagged_listing_id,
    }).select().single()
    if (!error) setStatuses(prev => [data, ...prev])
    return { data, error }
  }

  async function deleteStatus(id) {
    await supabase.from('user_statuses').delete().eq('id', id)
    setStatuses(prev => prev.filter(s => s.id !== id))
  }

  return { statuses, setStatuses, loading, postStatus, deleteStatus, reload: load }
}

export async function fetchUserActiveStatus(userId) {
  const { data } = await supabase
    .from('user_statuses')
    .select('*')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function fetchListingStatus(listingId) {
  const { data } = await supabase
    .from('user_statuses')
    .select('*')
    .eq('listing_id', listingId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

export async function fetchAllActiveStories(currentUserId = null, category = null) {
  const isFiltered = category && category !== 'All'

  const { data } = await supabase
    .from('user_statuses')
    .select(`
      id, content, status_type, expires_at, created_at,
      media_urls, tagged_listing_id, user_id, location_hint,
      profiles:user_id ( id, full_name, avatar_url, city ),
      tagged:tagged_listing_id ( id, title, price, images, category, description )
    `)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(200)

  const countMap = {}
  for (const s of data || []) {
    countMap[s.user_id] = (countMap[s.user_id] || 0) + 1
  }

  const applyFilter = (s) => {
    if (!isFiltered) return true
    if (category === 'Availability') return s.status_type === 'availability' && !s.tagged_listing_id
    if (category === 'Work') return s.status_type === 'work_ping'
    if (category === '🔥 Urgent') {
      const c = s.content?.toLowerCase() || ''
      return c.includes('price drop') || c.includes('first to confirm')
    }
    return s.tagged?.category === category
  }

  const filtered = (data || []).filter(applyFilter)

  if (isFiltered) {
    // Show ALL matching statuses — no deduplication
    return filtered.map(s => ({ ...s, _statusCount: countMap[s.user_id] }))
  }

  // Return all statuses — grouping is handled in StatusPage
  return filtered.map(s => ({ ...s, _statusCount: countMap[s.user_id] }))
}

export async function countRecentAvailabilityStatuses() {
  const { count } = await supabase
    .from('user_statuses')
    .select('*', { count: 'exact', head: true })
    .gt('expires_at', new Date().toISOString())
  return count || 0
}