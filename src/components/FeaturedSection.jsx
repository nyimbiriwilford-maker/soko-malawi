import { useState } from 'react'
import { isFlashActive } from '../utils/homeUtils'
import { CAT_META, BADGE_META } from '../constants/homeConstants'
import { supabase } from '../lib/supabase'

// ── Category emoji map ────────────────────────────────────
const CAT_EMOJI = {
  Electronics: '📱', Vehicles: '🚗', Furniture: '🛋️',
  Clothing: '👗', Property: '🏠', Agriculture: '🌾',
  Food: '🍎', Services: '🔧', Other: '📦',
}

export default function FeaturedSection({ featured, navigate, user, allListings, onRefresh }) {
  const [showAll,   setShowAll]   = useState(false)
  const [adminMode, setAdminMode] = useState(false)
  const [toggling,  setToggling]  = useState(null) // id currently being toggled

 const isAdmin = false // managed via Admin panel now

  async function toggleFeatured(listing) {
    setToggling(listing.id)
    await supabase
      .from('listings')
      .update({ featured: !listing.featured })
      .eq('id', listing.id)
    await onRefresh?.()
    setToggling(null)
  }

  if (!featured.length && !isAdmin) return null

  // In admin mode show all listings so admin can feature/unfeature any
  const displayList = adminMode ? (allListings || featured) : featured

  return (
    <div style={S.section}>
      {!showAll ? (
        <>
          {/* ── Header ── */}
          <div style={S.header}>
            <div style={S.headerLeft}>
              <div style={S.iconWrap}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                  stroke="#3B6D11" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              </div>
              <span style={S.title}>Featured</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              {isAdmin && (
                <button
                  style={{ ...S.adminBtn, ...(adminMode ? S.adminBtnOn : {}) }}
                  onClick={() => { setAdminMode(a => !a); setShowAll(true) }}
                >
                  {adminMode ? '✓ Managing' : '⚙ Manage'}
                </button>
              )}
              {featured.length > 3 && (
  <button style={S.seeAllBtn} onClick={() => setShowAll(true)}>
    See all →
  </button>
)}
            </div>
          </div>

          {/* ── Horizontal scroll ── */}
          {featured.length > 0 ? (
            <div style={S.scroll}>
              {featured.map((item, i) => (
                <FeaturedCard
                  key={item.id} item={item} index={i}
                  navigate={navigate} size="large"
                  adminMode={false}
                />
              ))}
            </div>
          ) : (
            <div style={S.emptyHint}>
              No featured listings yet.{isAdmin && ' Use ⚙ Manage to feature products.'}
            </div>
          )}
        </>
      ) : (
        <>
          {/* ── See all / Admin header ── */}
          <div style={S.header}>
            <div style={S.headerLeft}>
              <button style={S.backBtn} onClick={() => { setShowAll(false); setAdminMode(false) }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="19" y1="12" x2="5" y2="12"/>
                  <polyline points="12 19 5 12 12 5"/>
                </svg>
              </button>
              <span style={S.title}>{adminMode ? 'Manage featured' : 'All featured'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {isAdmin && (
                <button
                  style={{ ...S.adminBtn, ...(adminMode ? S.adminBtnOn : {}) }}
                  onClick={() => setAdminMode(a => !a)}
                >
                  {adminMode ? '✓ Managing' : '⚙ Manage'}
                </button>
              )}
              <span style={S.countPill}>
                {adminMode ? (allListings?.length || 0) : featured.length} listings
              </span>
            </div>
          </div>

          {/* ── Admin hint banner ── */}
          {adminMode && (
            <div style={S.adminHint}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="#854F0B" strokeWidth="2.2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="12" y1="8" x2="12" y2="12"/>
                <line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              Tap the star on any listing to feature or unfeature it
            </div>
          )}

          {/* ── Grid ── */}
          <div style={S.grid}>
            {displayList.map((item, i) => (
              <FeaturedCard
                key={item.id} item={item} index={i}
                navigate={navigate} size="small"
                adminMode={adminMode}
                isFeatured={item.is_featured}
                toggling={toggling === item.id}
                onToggle={() => toggleFeatured(item)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────
// FeaturedCard
// ─────────────────────────────────────────────
function FeaturedCard({ item, index: i, navigate, size, adminMode, isFeatured, toggling, onToggle }) {
  const flash   = isFlashActive(item)
  const badge   = item.promo_badge && BADGE_META[item.promo_badge]
  const catMeta = CAT_META[item.category] || { color: '#1a7a4a' }
  const emoji   = CAT_EMOJI[item.category] || '📦'
  const imgH    = size === 'large' ? 200 : 130
  const cardW   = size === 'large' ? 175 : '100%'

  return (
    <div
      style={{
        ...S.card,
        width: cardW,
        flexShrink: size === 'large' ? 0 : undefined,
        animation: `featuredSlideIn 0.4s cubic-bezier(0.34,1.2,0.64,1) ${0.08 + i * 0.06}s both`,
        opacity: adminMode && !isFeatured ? 0.6 : 1,
      }}
      onClick={() => !adminMode && navigate('/listing/' + item.id)}
    >
      {/* Image block */}
      <div style={{ ...S.imgWrap, height: imgH, background: catMeta.color + 'cc' }}>
        {item.images?.[0] ? (
          <img src={item.images[0]} alt={item.title} style={S.img} loading="lazy" />
        ) : (
          <div style={S.emojiWrap}>
            <span style={{ fontSize: size === 'large' ? 52 : 38 }}>{emoji}</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div style={S.overlay} />

        {/* Promo badge — top left */}
        {badge && (
          <div style={{ ...S.promoBadge, background: badge.color }}>
            {badge.label}
          </div>
        )}

        {/* Category pill — top right (matches screenshot style) */}
        <div style={{ ...S.catPill, background: catMeta.color }}>
          {item.category}
        </div>

        {/* Admin toggle star — bottom right of image */}
        {adminMode && (
          <button
            style={{
              ...S.starBtn,
              background: isFeatured ? '#f59e0b' : 'rgba(0,0,0,0.45)',
              transform: toggling ? 'scale(0.85)' : 'scale(1)',
            }}
            onClick={e => { e.stopPropagation(); onToggle() }}
            disabled={toggling}
            aria-label={isFeatured ? 'Remove from featured' : 'Add to featured'}
          >
            {toggling ? (
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="#fff" strokeWidth="2.5" strokeLinecap="round"
                style={{ animation: 'spin 0.7s linear infinite' }}>
                <circle cx="12" cy="12" r="10" strokeDasharray="31" strokeDashoffset="10"/>
              </svg>
            ) : (
              <svg width="13" height="13" viewBox="0 0 24 24"
                fill={isFeatured ? '#fff' : 'none'}
                stroke="#fff" strokeWidth="2.2" strokeLinecap="round">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
            )}
          </button>
        )}

        {/* Price + title + city */}
        <div style={S.overlayContent}>
          {flash ? (
            <div style={S.flashPriceRow}>
              <span style={S.flashPrice}>
                ⚡ MWK {Number(item.flash_sale_price).toLocaleString()}
              </span>
              <span style={S.originalPrice}>
                {Number(item.price).toLocaleString()}
              </span>
            </div>
          ) : (
            <div style={S.price}>
              MWK {Number(item.price || 0).toLocaleString()}
            </div>
          )}
          <div style={{
            ...S.itemTitle,
            fontSize: size === 'large' ? 13 : 11,
            WebkitLineClamp: 2,
          }}>
            {item.title}
          </div>
          {item.city && (
            <div style={S.cityRow}>
              <svg width="9" height="9" viewBox="0 0 24 24" fill="rgba(255,255,255,0.7)">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              {item.city}
            </div>
          )}
        </div>
      </div>

      {/* Footer — grid view only */}
      {size === 'small' && (
        <div style={S.cardFooter}>
          <span style={S.footerCity}>
            <svg width="9" height="9" viewBox="0 0 24 24" fill={catMeta.color}>
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
            </svg>
            {item.city || '—'}
          </span>
          <span style={{
            ...S.footerCat,
            background: catMeta.color + '18',
            color: catMeta.color,
          }}>
            {item.category}
          </span>
        </div>
      )}
    </div>
  )
}

const S = {
  section: {
    padding: '14px 0 6px',
    animation: 'featuredHeaderIn 0.4s ease both',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '0 14px', marginBottom: 12,
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  iconWrap: {
    width: 28, height: 28, borderRadius: 8,
    background: '#EAF3DE',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0,
  },
  title:    { fontSize: 15, fontWeight: 700, color: '#111' },
  countPill: {
    background: '#EAF3DE', color: '#3B6D11',
    fontSize: 11, fontWeight: 700, padding: '2px 8px',
    borderRadius: 20, border: '0.5px solid #C0DD97',
  },
  seeAllBtn: {
    background: 'none', border: 'none', padding: 0,
    fontSize: 13, fontWeight: 700, color: '#1a7a4a', cursor: 'pointer',
  },
  backBtn: {
    width: 30, height: 30, borderRadius: '50%',
    border: '1px solid #e0e8e2', background: '#f6f9f7',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', color: '#555', flexShrink: 0,
  },
  adminBtn: {
    background: 'none', border: '1px solid #e0e8e2',
    borderRadius: 20, padding: '4px 10px',
    fontSize: 11, fontWeight: 700, color: '#888', cursor: 'pointer',
  },
  adminBtnOn: {
    background: '#1a7a4a', borderColor: '#1a7a4a', color: '#fff',
  },
  adminHint: {
    display: 'flex', alignItems: 'center', gap: 6,
    margin: '0 14px 10px',
    background: '#FAEEDA', border: '0.5px solid #FAC775',
    borderRadius: 10, padding: '8px 12px',
    fontSize: 12, fontWeight: 500, color: '#854F0B',
  },
  emptyHint: {
    padding: '20px 14px',
    fontSize: 13, color: '#aaa', textAlign: 'center',
  },
  scroll: {
    display: 'flex', gap: 10, overflowX: 'auto',
    padding: '0 14px 6px',
    scrollSnapType: 'x mandatory',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  grid: {
    display: 'grid', gridTemplateColumns: '1fr 1fr',
    gap: 10, padding: '0 14px 6px',
  },
  card: {
    borderRadius: 14, overflow: 'hidden',
    cursor: 'pointer', scrollSnapAlign: 'start',
    border: '0.5px solid #e8ede9',
    background: '#fff',
    boxShadow: '0 2px 10px rgba(0,0,0,0.07)',
    transition: 'transform 0.18s, box-shadow 0.18s, opacity 0.2s',
  },
  imgWrap:  { position: 'relative', overflow: 'hidden' },
  img:      { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  emojiWrap: {
    position: 'absolute', inset: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  overlay: {
    position: 'absolute', inset: 0,
    background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.08) 55%, transparent 100%)',
  },
  overlayContent: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    padding: '20px 10px 10px',
  },
  flashPriceRow:  { display: 'flex', alignItems: 'center', gap: 5, marginBottom: 2 },
  flashPrice:     { fontSize: 13, fontWeight: 800, color: '#ff6b6b' },
  originalPrice:  { fontSize: 10, color: 'rgba(255,255,255,0.45)', textDecoration: 'line-through' },
  price:          { fontSize: 13, fontWeight: 800, color: '#f59e0b', marginBottom: 2 },
  itemTitle: {
    fontWeight: 600, color: '#fff', lineHeight: 1.35,
    overflow: 'hidden', display: '-webkit-box',
    WebkitBoxOrient: 'vertical',
  },
  cityRow: {
    display: 'flex', alignItems: 'center', gap: 3,
    fontSize: 10, color: 'rgba(255,255,255,0.65)', marginTop: 3,
  },
  promoBadge: {
    position: 'absolute', top: 8, left: 8,
    color: '#fff', fontSize: 9, fontWeight: 800,
    borderRadius: 6, padding: '3px 7px',
  },
  catPill: {
    position: 'absolute', top: 8, right: 8,
    color: '#fff', fontSize: 10, fontWeight: 700,
    borderRadius: 20, padding: '4px 10px',
  },
  starBtn: {
    position: 'absolute', bottom: 8, right: 8,
    width: 28, height: 28, borderRadius: '50%',
    border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'transform 0.15s, background 0.2s',
    zIndex: 10,
  },
  cardFooter: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '7px 10px',
    borderTop: '0.5px solid #f0f0f0',
  },
  footerCity: {
    display: 'flex', alignItems: 'center', gap: 3,
    fontSize: 10, color: '#888',
  },
  footerCat: {
    fontSize: 9, fontWeight: 700, borderRadius: 4, padding: '2px 6px',
  },
}