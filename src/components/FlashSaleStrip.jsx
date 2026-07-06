import { useState, useEffect } from 'react'
import { isFlashActive, flashTimeLeft } from '../utils/homeUtils'

export default function FlashSaleStrip({ listings, navigate }) {
  const flashItems = listings.filter(l => isFlashActive(l)).slice(0, 6)
  const [collapsed, setCollapsed] = useState(true)

  if (!flashItems.length) return null

  return (
    <div style={S.strip}>
      {/* Header */}
      <div style={S.header} onClick={() => setCollapsed(c => !c)}>
        <div style={S.headerLeft}>
          <div style={S.dot} />
          <span style={S.title}>Flash sale</span>
          <span style={S.countBadge}>{flashItems.length} deals</span>
          <FlashTimer expiresAt={flashItems[0]?.flash_sale_expires_at} />
        </div>
        <div style={S.headerRight}>
          <span style={S.tapHint}>{collapsed ? 'Tap to view' : 'Hide'}</span>
          <svg
            width="14" height="14" viewBox="0 0 24 24"
            fill="none" stroke="#A32D2D" strokeWidth="2.5" strokeLinecap="round"
            style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)', transition: 'transform 0.25s ease' }}
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
        </div>
      </div>

      {/* Horizontal card row */}
      {!collapsed && (
        <div style={S.cardRow}>
          {flashItems.map(item => {
            const discount = Math.round((1 - item.flash_sale_price / item.price) * 100)
            return (
              <div key={item.id} style={S.card} onClick={() => navigate('/listing/' + item.id)}>
                <div style={S.imgWrap}>
                  {item.images?.[0]
                    ? <img src={item.images[0]} alt={item.title} style={S.img} width="110" height="72" loading="lazy" />
                    : <div style={S.imgFallback}>📦</div>
                  }
                  <div style={S.discountPill}>-{discount}%</div>
                </div>
                <div style={S.cardBody}>
                  <div style={S.itemTitle}>{item.title}</div>
                  <div style={S.priceRow}>
                    <span style={S.newPrice}>MWK {Number(item.flash_sale_price).toLocaleString()}</span>
                    <span style={S.oldPrice}>{Number(item.price).toLocaleString()}</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function FlashTimer({ expiresAt }) {
  const [left, setLeft] = useState(flashTimeLeft(expiresAt))
  useEffect(() => {
    const t = setInterval(() => setLeft(flashTimeLeft(expiresAt)), 30_000)
    return () => clearInterval(t)
  }, [expiresAt])
  if (!left) return null
  return (
    <span style={S.timer}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A32D2D" strokeWidth="2.4" strokeLinecap="round">
        <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
      </svg>
      {left} left
    </span>
  )
}

const S = {
  strip: {
    width: '100%',
    background: 'linear-gradient(90deg, #fff5f5 0%, #fff 60%)',
    borderTop: '1px solid #fecaca',
    borderBottom: '1px solid #fecaca',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '9px 16px',
    cursor: 'pointer',
    maxWidth: 1400,
    margin: '0 auto',
  },
  headerLeft: { display: 'flex', alignItems: 'center', gap: 8 },
  headerRight: { display: 'flex', alignItems: 'center', gap: 6 },
  dot: {
    width: 7, height: 7, borderRadius: '50%',
    background: '#E24B4A', flexShrink: 0,
    boxShadow: '0 0 0 3px rgba(226,75,74,0.2)',
    animation: 'flashDot 1.5s infinite',
  },
  title: {
    fontSize: 13, fontWeight: 700, color: '#b91c1c',
    letterSpacing: '-0.2px',
  },
  countBadge: {
    background: '#fecaca', color: '#991b1b',
    fontSize: 10.5, fontWeight: 700, borderRadius: 20,
    padding: '2px 8px', border: '1px solid #fca5a5',
  },
  timer: {
    fontSize: 11.5, fontWeight: 600, color: '#A32D2D',
    display: 'flex', alignItems: 'center', gap: 4,
  },
  tapHint: {
    fontSize: 11, color: '#f87171', fontWeight: 600,
  },
  cardRow: {
    display: 'flex',
    gap: 10,
    overflowX: 'auto',
    padding: '0 16px 12px',
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
    maxWidth: 1400,
    margin: '0 auto',
  },
  card: {
    flexShrink: 0,
    width: 'clamp(110px, 15vw, 160px)',
    borderRadius: 10,
    border: '1px solid #fecaca',
    background: '#fff',
    overflow: 'hidden',
    cursor: 'pointer',
    boxShadow: '0 1px 6px rgba(220,38,38,0.08)',
    transition: 'transform 0.15s',
  },
  imgWrap: { position: 'relative', height: 'clamp(72px, 10vw, 110px)', background: '#fff5f5' },
  img: { width: '100%', height: '100%', objectFit: 'cover' },
  imgFallback: {
    width: '100%', height: '100%',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 24, background: '#fff5f5',
  },
  discountPill: {
    position: 'absolute', top: 4, right: 4,
    background: '#dc2626', color: '#fff',
    fontSize: 9.5, fontWeight: 800, borderRadius: 5, padding: '2px 5px',
  },
  cardBody: { padding: '6px 8px 8px' },
  itemTitle: {
    fontSize: 10.5, fontWeight: 600, color: '#111', marginBottom: 3,
    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
  },
  priceRow: { display: 'flex', flexDirection: 'column', gap: 1 },
  newPrice: { fontSize: 12, fontWeight: 800, color: '#dc2626' },
  oldPrice: { fontSize: 10, color: '#ccc', textDecoration: 'line-through' },
}