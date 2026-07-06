import { T } from '../constants/tokens'

// ── Geo helpers ──────────────────────────────────────────────
export async function getGPSCity() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`
          )
          const d = await res.json()
          resolve(d.city || d.locality || d.principalSubdivision || null)
        } catch { resolve(null) }
      },
      () => resolve(null),
      { timeout: 10000 }
    )
  })
}

export async function getDBCities(sb) {
  const { data } = await sb
    .from('listings')
    .select('city')
    .not('city', 'is', null)
    .eq('status', 'active')
  return [...new Set((data || []).map(r => r.city?.trim()).filter(Boolean))].sort()
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