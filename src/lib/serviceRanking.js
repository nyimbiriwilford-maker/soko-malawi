const HIDDEN_STATUSES = new Set(['paused', 'archived', 'banned', 'inactive'])

function mulberry32(seed) {
  let t = seed >>> 0
  return function () {
    t += 0x6D2B79F5
    let r = Math.imul(t ^ (t >>> 15), t | 1)
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function shuffle(arr, seed) {
  const out = [...arr]
  const rand = mulberry32(seed)
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    const tmp = out[i]
    out[i] = out[j]
    out[j] = tmp
  }
  return out
}

export function rankServices(services, ctx) {
  const { userCity, userId, seed, now } = ctx || {}
  const nowMs = now ? new Date(now).getTime() : Date.now()
  const cityNorm = (userCity || '').trim().toLowerCase()

  const filtered = (services || []).filter((s) => {
    const status = String(s.status || '').toLowerCase()
    if (HIDDEN_STATUSES.has(status)) return false
    if (s.type === 'job' || s.is_job || s.job === true) return false
    const title = String(s.title || s.name || '').trim()
    if (!title) return false
    const hasPrice = !!(s.rate || s.price)
    const desc = String(s.description || '').trim()
    if (!hasPrice && desc.length === 0) return false
    return true
  })

  const scored = filtered.map((s) => {
    const title = String(s.title || s.name || '').trim()
    const desc = String(s.description || '').trim()
    const city = String(s.city || '').trim().toLowerCase()

    let location
    if (!cityNorm) {
      location = 0.5
    } else if (city === cityNorm) {
      location = 1.0
    } else {
      location = 0.2
    }

    const rating = Number(s.rating)
    const count = Number(s.jobs_done != null ? s.jobs_done : (s.review_count != null ? s.review_count : 0))
    let quality
    if (Number.isFinite(rating) && rating > 0 && count > 0) {
      const smoothed = (rating * count + 4.0 * 5) / (count + 5)
      quality = smoothed / 5
    } else {
      quality = 0.5
    }

    const verified = (s.verified || s.profile?.verified) ? 1 : 0

    let engagement
    if (s.views != null && s.chats != null) {
      const views = Number(s.views)
      const chats = Number(s.chats)
      engagement = Math.min(1, (chats / Math.max(views, 10)) * 5)
    } else {
      engagement = 0.5
    }

    const ageDays = (nowMs - new Date(s.created_at).getTime()) / (1000 * 60 * 60 * 24)
    const freshness = Math.max(0, 1 - ageDays / 30)

    const hasImage = !!(Array.isArray(s.media_urls) && s.media_urls.length) || !!s.image || !!s.img
    const hasDesc = desc.length >= 20
    const hasPrice = !!(s.rate || s.price)
    const hasTitle = title.length >= 8
    const completeness = 0.25 * (hasImage + hasDesc + hasPrice + hasTitle)

    let score = 0.30 * location + 0.20 * quality + 0.15 * verified + 0.15 * engagement + 0.10 * freshness + 0.10 * completeness

    const isOwn = userId != null && s.provider_id === userId
    if (!isOwn) {
      const newProvider = ageDays < 7 || (s.views != null && Number(s.views) < 20)
      if (newProvider) score += 0.10
    }

    return { item: s, score }
  })

  // group into 0.05 buckets
  const buckets = {}
  scored.forEach((e) => {
    const key = Math.floor(e.score / 0.05)
    if (!buckets[key]) buckets[key] = []
    buckets[key].push(e)
  })
  const keys = Object.keys(buckets).map(Number).sort((a, b) => b - a)
  let ordered = []
  keys.forEach((k, idx) => {
    const bucketSeed = (seed || 1) + k * 997 + idx * 31
    const shuffled = shuffle(buckets[k].map((e) => e.item), bucketSeed)
    ordered = ordered.concat(shuffled)
  })

  // diversity pass
  const result = []
  const remaining = [...ordered]
  while (remaining.length) {
    let placed = false
    for (let i = 0; i < remaining.length; i++) {
      const cand = remaining[i]
      const last1 = result[result.length - 1]
      const last2 = result[result.length - 2]
      const sameProvider = !!(last1 && last2 && last1.provider_id === cand.provider_id && last2.provider_id === cand.provider_id)
      const sameCategory = !!(last1 && last2 && last1.category === cand.category && last2.category === cand.category)
      if (result.length < 2 || !(sameProvider || sameCategory)) {
        result.push(cand)
        remaining.splice(i, 1)
        placed = true
        break
      }
    }
    if (!placed) {
      result.push(remaining.shift())
    }
  }

  return result
}
