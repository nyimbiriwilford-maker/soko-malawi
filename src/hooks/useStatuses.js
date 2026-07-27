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

  async function postStatus({
    content,
    status_type,
    listing_id = null,
    location_hint = null,
    expiryKey,
    mediaFiles = [],
    tagged_listing_id = null,
    tagged_kind = null,
    tagged_ref_id = null,
  }) {
    const ms = EXPIRY_OPTIONS[expiryKey || status_type] || EXPIRY_OPTIONS.availability
    const expires_at = new Date(Date.now() + ms).toISOString()

    // Upload media files
    const media_urls = []
    for (const file of mediaFiles) {
      const url = await uploadStoryMedia(userId, file)
      if (url) media_urls.push(url)
    }

    const kind = tagged_kind
      || (tagged_listing_id || listing_id ? 'listing' : null)
    const refId = tagged_ref_id || tagged_listing_id || listing_id || null

    const payload = {
      user_id: userId,
      content,
      status_type,
      listing_id: kind === 'listing' ? refId : listing_id,
      location_hint,
      expires_at,
      media_urls,
      tagged_listing_id: kind === 'listing' ? refId : null,
      tagged_kind: kind,
      tagged_ref_id: refId,
    }

    let { data, error } = await supabase.from('user_statuses').insert(payload).select().single()
    // Older DBs without tagged_kind / tagged_ref_id
    if (error && /tagged_kind|tagged_ref_id|column/i.test(error.message || '')) {
      const legacy = { ...payload }
      delete legacy.tagged_kind
      delete legacy.tagged_ref_id
      ;({ data, error } = await supabase.from('user_statuses').insert(legacy).select().single())
    }
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

export async function hydrateStatusTags(rows) {
  return hydrateTaggedEntities(rows)
}

async function hydrateTaggedEntities(rows) {
  if (!rows?.length) return rows || []

  const byKind = { listing: new Set(), job: new Set(), service: new Set(), shop: new Set(), request: new Set() }
  for (const s of rows) {
    const kind = s.tagged_kind || (s.tagged_listing_id ? 'listing' : null)
    const id = s.tagged_ref_id || s.tagged_listing_id || s.tagged?.id
    if (kind && id && byKind[kind]) byKind[kind].add(id)
  }

  const maps = { listing: {}, job: {}, service: {}, shop: {}, request: {} }

  await Promise.all([
    byKind.listing.size
      ? supabase.from('listings').select('id, title, price, images, category, description, city, district')
        .in('id', [...byKind.listing])
        .then(({ data }) => { for (const r of data || []) maps.listing[r.id] = r })
      : null,
    byKind.job.size
      ? supabase.from('jobs').select('id, title, company, salary, city, cover_image_url, logo_url, description, overview')
        .in('id', [...byKind.job])
        .then(({ data }) => {
          for (const r of data || []) {
            // Prefer company logo first for branding on status cards
            const imgs = []
            if (r.logo_url) imgs.push(r.logo_url)
            if (r.cover_image_url && r.cover_image_url !== r.logo_url) imgs.push(r.cover_image_url)
            maps.job[r.id] = {
              ...r,
              name: r.title,
              logo_url: r.logo_url || null,
              images: imgs,
            }
          }
        })
      : null,
    byKind.service.size
      ? supabase.from('services').select('id, name, rate, category, city, media_urls, description')
        .in('id', [...byKind.service])
        .then(({ data }) => {
          for (const r of data || []) {
            maps.service[r.id] = {
              ...r,
              title: r.name,
              price: r.rate,
              images: r.media_urls || [],
            }
          }
        })
      : null,
    byKind.shop.size
      ? supabase.from('shops').select('id, name, city, logo_url, cover_url, description')
        .in('id', [...byKind.shop])
        .then(({ data }) => {
          for (const r of data || []) {
            const imgs = []
            if (r.logo_url) imgs.push(r.logo_url)
            if (r.cover_url && r.cover_url !== r.logo_url) imgs.push(r.cover_url)
            maps.shop[r.id] = {
              ...r,
              title: r.name,
              logo_url: r.logo_url || null,
              images: imgs,
            }
          }
        })
      : null,
    byKind.request.size
      ? supabase.from('buyer_requests').select('id, title, city, budget, category, description')
        .in('id', [...byKind.request])
        .then(({ data }) => {
          for (const r of data || []) {
            maps.request[r.id] = {
              ...r,
              price: r.budget,
              images: [],
            }
          }
        })
      : null,
  ])

  return rows.map(s => {
    const kind = s.tagged_kind || (s.tagged_listing_id ? 'listing' : null)
    const id = s.tagged_ref_id || s.tagged_listing_id || s.tagged?.id
    const entity = (kind && id && maps[kind]?.[id]) || s.tagged || null
    return {
      ...s,
      tagged_kind: kind,
      tagged_ref_id: id || null,
      tagged: entity,
      _taggedKind: kind,
      _taggedEntity: entity,
      _statusCount: s._statusCount,
    }
  })
}

export async function fetchAllActiveStories(currentUserId = null, category = null) {
  const isFiltered = category && category !== 'All'

  let { data, error } = await supabase
    .from('user_statuses')
    .select(`
      id, content, status_type, expires_at, created_at,
      media_urls, tagged_listing_id, tagged_kind, tagged_ref_id, user_id, location_hint,
      profiles:user_id ( id, full_name, avatar_url, city, is_verified ),
      tagged:tagged_listing_id ( id, title, price, images, category, description, city, district )
    `)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(200)

  // Older schema without tagged_kind / tagged_ref_id
  if (error && /tagged_kind|tagged_ref_id|column/i.test(error.message || '')) {
    ;({ data, error } = await supabase
      .from('user_statuses')
      .select(`
        id, content, status_type, expires_at, created_at,
        media_urls, tagged_listing_id, user_id, location_hint,
        profiles:user_id ( id, full_name, avatar_url, city, is_verified ),
        tagged:tagged_listing_id ( id, title, price, images, category, description, city, district )
      `)
      .gt('expires_at', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(200))
  }

  const countMap = {}
  for (const s of data || []) {
    countMap[s.user_id] = (countMap[s.user_id] || 0) + 1
  }

  const withCounts = (data || []).map(s => ({ ...s, _statusCount: countMap[s.user_id] }))
  const hydrated = await hydrateTaggedEntities(withCounts)

  // Normalize profiles — Supabase foreign key joins can return an array
  for (const s of hydrated) {
    if (Array.isArray(s.profiles)) s.profiles = s.profiles[0] || null
    if (s.profiles) {
      s.profiles.is_verified = s.profiles.is_verified === true
    }
  }

  const applyFilter = (s) => {
    if (!isFiltered) return true
    if (category === 'Availability') return s.status_type === 'availability' && !s.tagged_listing_id && !s.tagged_ref_id
    if (category === 'Work') return s.status_type === 'work_ping' || s.tagged_kind === 'job' || s.tagged_kind === 'service'
    if (category === '🔥 Urgent') {
      const c = s.content?.toLowerCase() || ''
      return c.includes('price drop') || c.includes('first to confirm')
    }
    return s.tagged?.category === category
  }

  return hydrated.filter(applyFilter)
}

export async function countRecentAvailabilityStatuses() {
  const { count } = await supabase
    .from('user_statuses')
    .select('*', { count: 'exact', head: true })
    .gt('expires_at', new Date().toISOString())
  return count || 0
}