export const SIMILAR_SHOP_RULES = {
  limit: 4,
  poolSize: 40,
  weights: {
    sameCategory: 40,
    sameCity: 30,
    sameDistrict: 20, // only when the city does not match
    verified: 25,
    topRated: 15,     // rating >= minRating with >= minReviews reviews
    hasLogo: 5,
    followersMax: 15, // log-scaled, capped
  },
  minRating: 4,
  minReviews: 3,
}

const norm = v => (v || '').toString().trim().toLowerCase()

export function isEligibleShop(s, currentId) {
  return !!s && s.id !== currentId && s.is_active !== false && !!s.slug && !!norm(s.name)
}

export function scoreSimilarShop(s, current, rules = SIMILAR_SHOP_RULES) {
  const w = rules.weights
  let score = 0
  if (norm(s.category) && norm(s.category) === norm(current.category)) score += w.sameCategory
  if (norm(s.city) && norm(s.city) === norm(current.city)) score += w.sameCity
  else if (norm(s.district) && norm(s.district) === norm(current.district)) score += w.sameDistrict
  if (s.is_verified) score += w.verified
  if ((s.rating || 0) >= rules.minRating && (s.review_count || 0) >= rules.minReviews) score += w.topRated
  if (s.logo_url) score += w.hasLogo
  score += Math.min(w.followersMax, Math.log2((s.follower_count || 0) + 1) * 3)
  return score
}

export function pickSimilarShops(candidates, current, rules = SIMILAR_SHOP_RULES) {
  return (candidates || [])
    .filter(s => isEligibleShop(s, current.id))
    .map(s => ({ s, score: scoreSimilarShop(s, current, rules) }))
    .sort((a, b) => b.score - a.score || (b.s.follower_count || 0) - (a.s.follower_count || 0))
    .slice(0, rules.limit)
    .map(x => x.s)
}
