import { supabase } from '../lib/supabase'

export function randBetween(a, b) {
  return Math.floor(Math.random() * (b - a + 1)) + a
}

export function isFlashActive(listing) {
  if (!listing.flash_sale_price || !listing.flash_sale_expires_at) return false
  return new Date(listing.flash_sale_expires_at) > new Date()
}

export function flashTimeLeft(expiresAt) {
  const ms = new Date(expiresAt) - Date.now()
  if (ms <= 0) return null
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

export function timeAgo(date) {
  const diff = Date.now() - new Date(date)
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return mins + 'm'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + 'h'
  const days = Math.floor(hrs / 24)
  if (days < 7) return days + 'd'
  return new Date(date).toLocaleDateString()
}

// ── Haversine distance in km ───────────────────────────────
export function getDistanceKm(lat1, lng1, lat2, lng2) {
  if (lat1 == null || lat2 == null) return 9999
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─────────────────────────────────────────────────────────
// VIEW TRACKING
// Logged-in  → Supabase user_interactions table
// Guest      → sessionStorage fallback
// Reset only when ALL products viewed AND oldest > 24h
// ─────────────────────────────────────────────────────────
const VIEW_TTL_MS = 24 * 60 * 60 * 1000

// ── Batched write queue (avoids hammering on scroll) ──────
let _viewQueue = new Set()
let _flushTimer = null

export function markAsViewed(listingId, userId) {
  const key = String(listingId)
  _viewQueue.add(key)
  if (_flushTimer) return
  _flushTimer = setTimeout(async () => {
    const ids = [..._viewQueue]
    _viewQueue = new Set()
    _flushTimer = null
    try {
      if (userId) {
        // DB — upsert so no duplicates
        await supabase.from('user_interactions').upsert(
          ids.map(id => ({
            user_id:    userId,
            listing_id: id,
            viewed_at:  new Date().toISOString(),
          })),
          { onConflict: 'user_id,listing_id' }
        )
      } else {
        // Guest — sessionStorage
        const map = _getGuestViewedMap()
        const now = Date.now()
        ids.forEach(id => { map[id] = now })
        sessionStorage.setItem('viewedProducts', JSON.stringify(map))
      }
    } catch {}
  }, 1000)
}

export async function getViewedIds(userId, allProductIds = []) {
  try {
    if (userId) {
      const { data } = await supabase
        .from('user_interactions')
        .select('listing_id, viewed_at')
        .eq('user_id', userId)

      const rows = data || []
      const viewedIds = new Set(rows.map(r => String(r.listing_id)))

      // Check if ALL products have been viewed
      const allViewed = allProductIds.length > 0 &&
        allProductIds.every(id => viewedIds.has(String(id)))

      if (allViewed) {
        // Find oldest view timestamp
        const oldest = rows.reduce((min, r) =>
          new Date(r.viewed_at) < new Date(min) ? r.viewed_at : min,
          rows[0].viewed_at
        )
        if (Date.now() - new Date(oldest).getTime() > VIEW_TTL_MS) {
          // All seen + 24h passed → wipe and start fresh
          await supabase
            .from('user_interactions')
            .delete()
            .eq('user_id', userId)
          return new Set()
        }
      }
      return viewedIds

    } else {
      // Guest path
      const map = _getGuestViewedMap()
      const viewedIds = new Set(Object.keys(map))
      const allViewed = allProductIds.length > 0 &&
        allProductIds.every(id => viewedIds.has(String(id)))

      if (allViewed) {
        const oldest = Math.min(...Object.values(map))
        if (Date.now() - oldest > VIEW_TTL_MS) {
          sessionStorage.removeItem('viewedProducts')
          return new Set()
        }
      }
      return viewedIds
    }
  } catch {
    return new Set()
  }
}

function _getGuestViewedMap() {
  try {
    return JSON.parse(sessionStorage.getItem('viewedProducts') || '{}')
  } catch { return {} }
}

// ─────────────────────────────────────────────────────────
// SEARCH TRACKING
// Logged-in  → Supabase user_searches table
// Guest      → sessionStorage fallback
// ─────────────────────────────────────────────────────────
export async function trackSearch(term, userId) {
  if (!term || term.trim().length < 2) return
  const clean = term.trim().toLowerCase()
  try {
    if (userId) {
      await supabase.from('user_searches').insert({
        user_id:     userId,
        term:        clean,
        searched_at: new Date().toISOString(),
      })
    } else {
      const history = _getGuestSearchHistory()
      const updated = [clean, ...history.filter(t => t !== clean)].slice(0, 10)
      sessionStorage.setItem('searchHistory', JSON.stringify(updated))
    }
  } catch {}
}

export async function getSearchHistory(userId) {
  try {
    if (userId) {
      const { data } = await supabase
        .from('user_searches')
        .select('term')
        .eq('user_id', userId)
        .order('searched_at', { ascending: false })
        .limit(10)
      return (data || []).map(r => r.term)
    } else {
      return _getGuestSearchHistory()
    }
  } catch {
    return []
  }
}

function _getGuestSearchHistory() {
  try {
    return JSON.parse(sessionStorage.getItem('searchHistory') || '[]')
  } catch { return [] }
}

// ─────────────────────────────────────────────────────────
// SMART SORT
// Combines: search relevance (40%) + unseen (35%) + distance (25%)
// Now async because getViewedIds and getSearchHistory may hit DB
// ─────────────────────────────────────────────────────────
export async function sortProductsSmart(products, userLat, userLng, userId) {
  const allProductIds = products.map(p => String(p.id))

  const [viewedIds, searchHistory] = await Promise.all([
    getViewedIds(userId, allProductIds),
    getSearchHistory(userId),
  ])

  const MAX_DIST = 500

  return [...products].sort((a, b) => {
    const aViewed = viewedIds.has(String(a.id)) ? 1 : 0
    const bViewed = viewedIds.has(String(b.id)) ? 1 : 0

    const aSearchScore = _searchRelevance(a, searchHistory)
    const bSearchScore = _searchRelevance(b, searchHistory)

    const aDist      = getDistanceKm(userLat, userLng, a.latitude, a.longitude)
    const bDist      = getDistanceKm(userLat, userLng, b.latitude, b.longitude)
    const aDistScore = 1 - Math.min(aDist, MAX_DIST) / MAX_DIST
    const bDistScore = 1 - Math.min(bDist, MAX_DIST) / MAX_DIST

    const aFinal = (aSearchScore * 0.40) + ((1 - aViewed) * 0.35) + (aDistScore * 0.25)
    const bFinal = (bSearchScore * 0.40) + ((1 - bViewed) * 0.35) + (bDistScore * 0.25)

    return bFinal - aFinal
  })
}

function _searchRelevance(listing, searchHistory) {
  if (!searchHistory.length) return 0
  const text = [
    listing.title,
    listing.description,
    listing.category,
    ...(listing.tags || []),
  ].join(' ').toLowerCase()

  let score = 0
  searchHistory.forEach((term, idx) => {
    const weight = 1 / (idx + 1)
    const words  = term.split(' ').filter(w => w.length > 2)
    const hits   = words.filter(w => text.includes(w)).length
    score += (hits / Math.max(words.length, 1)) * weight
  })
  return Math.min(score, 1)
}