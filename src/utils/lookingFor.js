import { T } from '../constants/tokens'
import { MALAWI_DISTRICTS } from '../constants/malawiDistricts'

// ── Geo helpers ──────────────────────────────────────────────

/** Match free-text from geocoder to a known Malawi district (case-insensitive). */
function matchMalawiDistrict(...candidates) {
  for (const raw of candidates) {
    if (!raw) continue
    const n = String(raw).trim().toLowerCase()
      .replace(/\s+district$/i, '')
      .replace(/\s+region$/i, '')
    const hit = MALAWI_DISTRICTS.find(d => d.toLowerCase() === n)
    if (hit) return hit
    // Partial: "Blantyre City" → Blantyre
    const partial = MALAWI_DISTRICTS.find(d =>
      n.includes(d.toLowerCase()) || d.toLowerCase().includes(n),
    )
    if (partial) return partial
  }
  return null
}

/**
 * GPS reverse-geocode for buyer stay location.
 * Returns area + district (Malawi-aware) and a display label.
 */
export async function getGPSLocation() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`,
          )
          const d = await res.json()
          const admin = d.localityInfo?.administrative || []
          const adminNames = admin.map(a => a?.name).filter(Boolean)

          const rawDistrict =
            d.principalSubdivision ||
            admin.find(a => /district|region/i.test(a?.description || a?.name || ''))?.name ||
            admin[1]?.name ||
            null
          const rawArea =
            d.locality ||
            d.city ||
            admin[2]?.name ||
            admin[0]?.name ||
            null

          const district =
            matchMalawiDistrict(rawDistrict, d.city, d.locality, ...adminNames) ||
            (rawDistrict ? String(rawDistrict).replace(/\s+District$/i, '').trim() : null)

          let area = rawArea ? String(rawArea).trim() : null
          if (area && district && area.toLowerCase() === district.toLowerCase()) {
            area = null
          }
          // Drop noisy country-level labels
          if (area && /malawi/i.test(area)) area = null

          // Prefer "Area, District" for stay label
          let label = null
          if (area && district) label = `${area}, ${district}`
          else if (district) label = district
          else if (area) label = area
          else label = d.city || d.locality || null

          resolve({
            label: label || null,
            area: area || null,
            district: district || null,
            city: d.city || area || district || null,
            country: d.countryName || null,
            lat: coords.latitude,
            lng: coords.longitude,
            raw: d,
          })
        } catch {
          resolve(null)
        }
      },
      () => resolve(null),
      { timeout: 12000, enableHighAccuracy: true, maximumAge: 60_000 },
    )
  })
}

/** @returns {Promise<string|null>} city / area label for simple callers */
export async function getGPSCity() {
  const loc = await getGPSLocation()
  return loc?.label || loc?.city || loc?.district || null
}

export async function getDBCities(sb) {
  const { data } = await sb
    .from('listings')
    .select('city')
    .not('city', 'is', null)
    .eq('status', 'active')
  return [...new Set((data || []).map(r => r.city?.trim()).filter(Boolean))].sort()
}

// ── Location relevance (Looking For feed) ─────────────────────

function normLoc(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+district$/i, '')
    .replace(/\s+region$/i, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Extract matchable place tokens from a GPS/profile location object or free string. */
export function viewerLocationTokens(viewerLoc) {
  if (!viewerLoc) return []
  if (typeof viewerLoc === 'string') {
    return viewerLoc.split(/[,/|]/).map(normLoc).filter(Boolean)
  }
  const parts = [
    viewerLoc.district,
    viewerLoc.area,
    viewerLoc.city,
    viewerLoc.label,
  ]
  const tokens = new Set()
  for (const p of parts) {
    if (!p) continue
    const n = normLoc(p)
    if (n) tokens.add(n)
    // also split "Area 25, Lilongwe" style
    String(p).split(/[,/|]/).forEach(bit => {
      const t = normLoc(bit)
      if (t) tokens.add(t)
    })
  }
  return [...tokens]
}

/**
 * How well a Looking For request matches where the *viewer* is.
 * Primary signal: buyer's "looking in" cities (where they want the product).
 * Secondary: buyer stay city (weaker).
 *
 * Example: request looking in [Lilongwe, Blantyre] → Blantyre viewer scores high.
 */
export function locationMatchScore(req, viewerLoc) {
  const tokens = viewerLocationTokens(viewerLoc)
  if (!tokens.length) return 0

  const looking = (req.cities?.length ? req.cities : []).filter(Boolean)
  const stay = req.city || req.detected_city || null

  let best = 0
  for (const place of looking) {
    const p = normLoc(place)
    if (!p) continue
    for (const t of tokens) {
      if (p === t) best = Math.max(best, 100)
      else if (p.includes(t) || t.includes(p)) best = Math.max(best, 85)
    }
  }

  if (stay) {
    const s = normLoc(stay)
    for (const t of tokens) {
      if (s === t) best = Math.max(best, 40)
      else if (s.includes(t) || t.includes(s)) best = Math.max(best, 30)
    }
  }

  return best
}

/**
 * Sort Looking For list: local matches first, then secondary sortBy.
 * Mutates a copy — does not mutate input.
 */
export function sortRequestsByViewerLocation(list, viewerLoc, sortBy = 'recent') {
  const scored = (list || []).map(r => ({
    r,
    loc: locationMatchScore(r, viewerLoc),
  }))

  const secondary = (a, b) => {
    if (sortBy === 'budget') return (b.budget || 0) - (a.budget || 0)
    if (sortBy === 'demand') return (b.offer_count || 0) - (a.offer_count || 0)
    if (sortBy === 'urgent') {
      const rank = { urgent: 0, this_week: 1, flexible: 2 }
      return (rank[a.urgency] ?? 3) - (rank[b.urgency] ?? 3)
    }
    // recent (default)
    return new Date(b.created_at || 0) - new Date(a.created_at || 0)
  }

  scored.sort((x, y) => {
    // Local looking-area matches always float to top
    if (y.loc !== x.loc) return y.loc - x.loc
    return secondary(x.r, y.r)
  })

  return scored.map(({ r, loc }) => ({ ...r, _locScore: loc }))
}

// ── Distance (seller → buyer) ─────────────────────────────────
/**
 * Approximate centre coordinates for Malawi districts & major towns.
 * Used for estimated distance when exact GPS was not saved on the request.
 */
export const MALAWI_PLACE_COORDS = {
  balaka: { lat: -14.9889, lng: 34.9556 },
  blantyre: { lat: -15.7861, lng: 35.0058 },
  chikwawa: { lat: -16.0333, lng: 34.8000 },
  chiradzulu: { lat: -15.7000, lng: 35.1833 },
  chitipa: { lat: -9.7019, lng: 33.2700 },
  dedza: { lat: -14.3779, lng: 34.3332 },
  dowa: { lat: -13.6531, lng: 33.9361 },
  karonga: { lat: -9.9333, lng: 33.9333 },
  kasungu: { lat: -13.0333, lng: 33.4833 },
  likoma: { lat: -12.0667, lng: 34.7333 },
  lilongwe: { lat: -13.9626, lng: 33.7741 },
  machinga: { lat: -15.1667, lng: 35.3000 },
  mangochi: { lat: -14.4781, lng: 35.2645 },
  mchinji: { lat: -13.7984, lng: 32.8802 },
  mulanje: { lat: -16.0316, lng: 35.5000 },
  mwanza: { lat: -15.6026, lng: 34.5241 },
  mzimba: { lat: -11.9000, lng: 33.6000 },
  mzuzu: { lat: -11.4587, lng: 34.0151 },
  neno: { lat: -15.4000, lng: 34.6500 },
  'nkhata bay': { lat: -11.6066, lng: 34.2907 },
  nkhotakota: { lat: -12.9274, lng: 34.2961 },
  nsanje: { lat: -16.9200, lng: 35.2600 },
  ntcheu: { lat: -14.8200, lng: 34.6400 },
  ntchisi: { lat: -13.3667, lng: 33.9167 },
  phalombe: { lat: -15.8000, lng: 35.6500 },
  rumphi: { lat: -11.0167, lng: 33.8667 },
  salima: { lat: -13.7804, lng: 34.4587 },
  thyolo: { lat: -16.0700, lng: 35.1400 },
  zomba: { lat: -15.3850, lng: 35.3188 },
  limbe: { lat: -15.8167, lng: 35.0500 },
  liwonde: { lat: -15.0667, lng: 35.2333 },
  nchalo: { lat: -16.2667, lng: 34.9167 },
  'monkey bay': { lat: -14.0833, lng: 34.9167 },
}

/** Haversine distance in km between two WGS84 points. */
export function haversineKm(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every(n => Number.isFinite(Number(n)))) return null
  const toRad = d => (Number(d) * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Resolve a free-text place to approximate coords (Malawi-aware). */
export function coordsForPlace(place) {
  if (!place) return null
  if (typeof place === 'object' && Number.isFinite(place.lat) && Number.isFinite(place.lng)) {
    return { lat: Number(place.lat), lng: Number(place.lng), approx: false }
  }
  const raw = String(place)
  // Try each comma-separated part ("Area 25, Lilongwe")
  const parts = raw.split(/[,/|]/).map(s => s.trim()).filter(Boolean)
  for (const part of [raw, ...parts]) {
    const n = normLoc(part)
    if (!n) continue
    if (MALAWI_PLACE_COORDS[n]) {
      return { ...MALAWI_PLACE_COORDS[n], approx: true, place: part }
    }
    const key = Object.keys(MALAWI_PLACE_COORDS).find(k => n.includes(k) || k.includes(n))
    if (key) return { ...MALAWI_PLACE_COORDS[key], approx: true, place: part }
  }
  return null
}

/**
 * Best estimate of buyer's physical location for distance:
 * 1) saved lat/lng on request
 * 2) stay city (where buyer stays)
 * 3) first looking-in city
 */
export function buyerCoords(req) {
  const lat = req?.lat != null ? Number(req.lat) : NaN
  const lng = req?.lng != null ? Number(req.lng) : NaN
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    return { lat, lng, approx: false, place: req.city || req.detected_city || 'Buyer' }
  }
  const stay = coordsForPlace(req?.city || req?.detected_city)
  if (stay) return stay
  const looking = (req?.cities || []).find(Boolean)
  return coordsForPlace(looking)
}

/**
 * Estimated distance from seller (viewer GPS) to buyer.
 * @returns {{ km: number, label: string, approx: boolean, place: string } | null}
 */
export function estimateDistanceToBuyer(req, sellerLoc) {
  if (!sellerLoc) return null
  const sLat = Number(sellerLoc.lat)
  const sLng = Number(sellerLoc.lng)
  let from = Number.isFinite(sLat) && Number.isFinite(sLng)
    ? { lat: sLat, lng: sLng }
    : coordsForPlace(sellerLoc.district || sellerLoc.city || sellerLoc.label || sellerLoc)
  if (!from) return null

  const to = buyerCoords(req)
  if (!to) return null

  const km = haversineKm(from.lat, from.lng, to.lat, to.lng)
  if (km == null) return null

  const approx = !!(to.approx || from.approx || sellerLoc.approx)
  let label
  if (km < 1) label = approx ? 'Est. under 1 km' : 'Under 1 km'
  else if (km < 10) label = `${approx ? '≈ ' : ''}${km.toFixed(1)} km`
  else label = `${approx ? '≈ ' : ''}${Math.round(km)} km`

  return {
    km,
    label,
    approx,
    place: to.place || req.city || 'buyer',
  }
}

/** Annotate requests with _distanceKm / _distanceLabel for UI. */
export function withDistanceToBuyer(list, sellerLoc) {
  return (list || []).map(r => {
    const d = estimateDistanceToBuyer(r, sellerLoc)
    return {
      ...r,
      _distanceKm: d?.km ?? null,
      _distanceLabel: d?.label ?? null,
      _distanceApprox: d?.approx ?? false,
      _distancePlace: d?.place ?? null,
    }
  })
}

// ── Scoring ──────────────────────────────────────────────────
export function getDemandLevel(req) {
  const s = (req.offer_count || 0) * 3 + (req.view_count || 0) * 0.1 + (req.urgency === 'urgent' ? 10 : 0)
  if (s >= 20 || req.urgency === 'urgent') return { label: 'High Demand', color: T.red,   bg: '#fef2f2', dot: T.red }
  if (s >= 8)                              return { label: 'Active',      color: T.amber, bg: '#fffbeb', dot: T.amber }
  return                                          { label: 'New',         color: T.green, bg: T.greenL,  dot: T.green }
}

export function getMatchScore(req, myListings) {
  if (!myListings?.length) return null
  let best = 0
  for (const l of myListings) {
    let s = 0
    if (l.category === req.category) s += 40
    const rc = (req.cities || [req.city]).filter(Boolean).map(c => c?.toLowerCase())
    if (l.city && rc.includes(l.city.toLowerCase())) s += 35
    if (req.budget && l.price && l.price <= req.budget) s += 25
    if (s > best) best = s
  }
  return best > 0 ? best : null
}

// ── Formatters ───────────────────────────────────────────────
export function timeAgo(ts) {
  if (!ts) return ''
  const d = Date.now() - new Date(ts), h = Math.floor(d / 3600000), m = Math.floor(d / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d ago`
  if (h >= 1)  return `${h}h ago`
  if (m < 1)   return 'just now'
  return `${m}m ago`
}

export function fmtMWK(n) {
  if (!n && n !== 0) return ''
  if (n >= 1_000_000) return `MK ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `MK ${(n / 1_000).toFixed(0)}K`
  return `MK ${n.toLocaleString()}`
}