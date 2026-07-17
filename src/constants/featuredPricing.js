/**
 * Phase 4.1 — single Featured Listing product.
 * One price · one duration · one activation flow (free entitlement RPC or paid confirm).
 * Keep in sync with public._feature_price_mwk / request_feature_* RPCs.
 */
export const FEATURED_PRICE_MWK = 2500
export const FEATURED_DURATION_DAYS = 7

export const FEATURED_PRODUCT = {
  id: 'featured',
  name: 'Featured Listing',
  priceMwk: FEATURED_PRICE_MWK,
  durationDays: FEATURED_DURATION_DAYS,
  description: 'Homepage placement with a gold Featured badge.',
}

/** Display helpers */
export function formatFeaturedPrice(price = FEATURED_PRICE_MWK) {
  return `MWK ${Number(price).toLocaleString()}`
}

export function featuredPriceLabel() {
  return `${formatFeaturedPrice()} · ${FEATURED_DURATION_DAYS} days`
}
