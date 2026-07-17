import { useEffect, useRef } from 'react'
import { CAT_META, BADGE_META, CONDITION_SHORT } from '../constants/homeConstants'
import { isFlashActive, isListingFeatured, timeAgo, markAsViewed } from '../utils/homeUtils'

// ── Viewport tracking hook (inline — no extra file needed) ──
function useViewportTracking(id, threshold = 1500) {
  const ref = useRef(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !id) return
    let timer = null
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          timer = setTimeout(() => markAsViewed(id), threshold)
        } else {
          clearTimeout(timer)
          timer = null
        }
      },
      { threshold: 0.6 }
    )
    observer.observe(el)
    return () => { observer.disconnect(); clearTimeout(timer) }
  }, [id, threshold])
  return ref
}

// ─────────────────────────────────────────────
// ProductCard
// ─────────────────────────────────────────────
export function ProductCard({ listing, delay, onClick }) {
  const cardRef = useViewportTracking(listing.id)   // ← attach tracker

  const meta = CAT_META[listing.category] || { color: '#6b7280', bg: '#f3f4f6' }
  const flash = isFlashActive(listing)
  // Phase 2.4: featured badge uses featured_until via isListingFeatured (existing badge styles)
  const badge = (listing.promo_badge && BADGE_META[listing.promo_badge])
    || (isListingFeatured(listing) ? BADGE_META.featured : null)
  const condition = listing.condition && CONDITION_SHORT[listing.condition]
  const hasBulk = listing.bulk_pricing && listing.bulk_pricing.length > 0
  const displayPrice = flash ? listing.flash_sale_price : listing.price
  const originalPrice = flash ? listing.price : null
  const discount = flash ? Math.round((1 - listing.flash_sale_price / listing.price) * 100) : null

  return (
    <div
      ref={cardRef}                                  // ← attach ref
      className="listing-card"
      style={{ ...S.card, animationDelay: delay + 's', ...(flash ? S.cardFlash : {}) }}
      onClick={onClick}
    >
      {/* Thumbnail */}
      <div style={S.cardThumb}>
        {listing.images?.[0]
          ? <img src={listing.images[0]} alt={listing.title} style={S.cardImg} loading="lazy" />
          : <div style={{ ...S.cardImgFallback, background: meta.color + '14' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={meta.color + '80'} strokeWidth="1.5">
                <rect x="3" y="3" width="18" height="18" rx="3"/>
                <circle cx="8.5" cy="8.5" r="1.5"/>
                <polyline points="21 15 16 10 5 21"/>
              </svg>
            </div>
        }

        {/* Top-left: promo badge OR condition */}
        <div style={S.cardTopLeft}>
          {badge ? (
            <span style={{ ...S.cardBadge, background: badge.color, color: '#fff' }}>{badge.label}</span>
          ) : condition ? (
            <span style={{ ...S.cardBadge, background: condition.color + '22', color: condition.color, border: `1px solid ${condition.color}44` }}>{condition.label}</span>
          ) : null}
        </div>

        {/* Top-right: flash discount pill */}
        {flash && <div style={S.cardFlashPill}>-{discount}%</div>}

        {/* Bulk badge */}
        {hasBulk && !flash && <div style={S.cardBulkBadge}>📦 Bulk deals</div>}

        {/* Time tag */}
        <div style={S.cardTimeTag}>{timeAgo(listing.created_at)}</div>

        {/* Category dot */}
        <div style={{ ...S.cardCatDot, background: meta.color }} />
      </div>

      {/* Body */}
      <div style={S.cardBody}>
        <div style={S.cardTitle}>{listing.title}</div>

        {/* Price block */}
        <div style={S.cardPriceBlock}>
          {listing.price_type === 'free' ? (
            <span style={S.cardFreePrice}>FREE</span>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                {flash && <span style={S.flashLightning}>⚡</span>}
                <span style={{ ...S.cardPrice, ...(flash ? S.cardPriceFlash : {}) }}>
                  <span style={S.priceLabel}>MWK</span> {Number(displayPrice || 0).toLocaleString()}
                </span>
              </div>
              {flash && originalPrice && (
                <span style={S.cardOrigPrice}>MWK {Number(originalPrice).toLocaleString()}</span>
              )}
              {!flash && listing.price_type === 'negotiable' && (
                <span style={S.negotiableTag}>Negotiable</span>
              )}
            </>
          )}
        </div>

        {/* Bulk pricing teaser */}
        {hasBulk && (
          <div style={S.cardBulkTeaser}>
            {(() => {
              const best = listing.bulk_pricing.sort((a, b) => b.discountPercent - a.discountPercent)[0]
              return `Buy ${best.minQty}+ → ${best.discountPercent}% off`
            })()}
          </div>
        )}

        {/* City + low stock */}
        <div style={{ fontSize: 11, color: '#f59e0b', marginBottom: 4 }}>★★★★★ 4.8</div>
{listing.city && (
          <div style={S.cardCity}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill={meta.color} style={{ marginRight: 3, flexShrink: 0 }}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            {listing.city}
            {listing.stock_qty && listing.stock_qty <= 3 && (
              <span style={S.lowStockTag}>· {listing.stock_qty} left</span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// SkeletonCard  (loading placeholder)
// ─────────────────────────────────────────────
export function SkeletonCard() {
  return (
    <div style={S.skeleton}>
      <div style={S.skeletonThumb} />
      <div style={S.skeletonBody}>
        <div style={{ ...S.skeletonLine, width: '80%' }} />
        <div style={{ ...S.skeletonLine, width: '55%', height: 14 }} />
        <div style={{ ...S.skeletonLine, width: '40%', height: 10 }} />
      </div>
    </div>
  )
}

const S = {
  card: { background: '#fff', borderRadius: 12, overflow: 'hidden', boxShadow: '0 6px 18px rgba(0,0,0,0.08)', border: '1px solid #e5e7eb', minWidth: 0, transition: 'all .25s ease', cursor: 'pointer' },
  cardFlash: { border: '1.5px solid #fecaca', boxShadow: '0 2px 12px rgba(220,38,38,0.12)' },
  cardThumb: { position: 'relative', paddingTop: '70%', background: '#f8fafc', overflow: 'hidden' },
  cardImg: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  cardImgFallback: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  cardTopLeft: { position: 'absolute', top: 7, left: 7 },
  cardBadge: { fontSize: 9, fontWeight: 800, borderRadius: 6, padding: '2px 6px', display: 'inline-block', backdropFilter: 'blur(4px)' },
  cardFlashPill: { position: 'absolute', top: 7, right: 7, background: '#dc2626', color: '#fff', fontSize: 9, fontWeight: 800, borderRadius: 6, padding: '2px 6px' },
  cardBulkBadge: { position: 'absolute', bottom: 26, right: 6, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 8, fontWeight: 700, borderRadius: 5, padding: '2px 5px' },
  cardCatDot: { position: 'absolute', bottom: 8, left: 8, width: 10, height: 10, borderRadius: '50%', boxShadow: '0 0 0 3px rgba(255,255,255,1)' },
  cardTimeTag: { position: 'absolute', bottom: 7, right: 7, background: 'rgba(17,24,39,0.75)', color: '#fff', fontSize: 10, fontWeight: 600, borderRadius: 6, padding: '3px 7px' },
  cardBody: { padding: '12px' },
  cardTitle: { fontSize: '15px', fontWeight: 700, color: '#111827', marginBottom: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.4' },
  cardPriceBlock: { marginBottom: 4 },
  cardPrice: { fontSize: '18px', fontWeight: 800, color: '#0f7a43', fontFamily: "'Inter', sans-serif" },
  cardPriceFlash: { color: '#dc2626' },
  cardFreePrice: { fontSize: 14, fontWeight: 900, color: '#15803d', background: '#dcfce7', borderRadius: 6, padding: '1px 8px', display: 'inline-block' },
  cardOrigPrice: { fontSize: 10, color: '#bbb', textDecoration: 'line-through', marginLeft: 2 },
  flashLightning: { fontSize: 11 },
  negotiableTag: { fontSize: 10, color: '#d97706', fontWeight: 700, background: '#fef9c3', borderRadius: 4, padding: '1px 5px', display: 'inline-block', marginLeft: 3 },
  cardBulkTeaser: { fontSize: 10, color: '#1a7a4a', fontWeight: 700, background: '#e6f4ec', borderRadius: 5, padding: '2px 6px', marginBottom: 4, display: 'inline-block' },
  priceLabel: { fontSize: 11, fontWeight: 600, color: '#6b7280' },
  cardCity: { display: 'flex', alignItems: 'center', fontSize: 12, color: '#6b7280', gap: 3 },
  lowStockTag: { color: '#dc2626', fontWeight: 700, fontSize: 10 },
  skeleton: { background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid #edf2ee' },
  skeletonThumb: { paddingTop: '78%', background: 'linear-gradient(90deg,#eef2ee 25%,#f6f9f6 50%,#eef2ee 75%)', backgroundSize: '400px 100%', animation: 'shimmer 1.4s infinite linear' },
  skeletonBody: { padding: '10px' },
  skeletonLine: { height: 12, background: '#eef2ee', borderRadius: 6, marginBottom: 8, animation: 'pulse 1.5s infinite' },
}