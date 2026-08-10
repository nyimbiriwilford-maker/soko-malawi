import { useState, useMemo } from 'react'
import { isListingFeatured, imageUrlLoaded, markImageUrlLoaded } from '../utils/homeUtils'

export const FEATURED_POOL_SIZE = 40

const CAT_ICON = {
  Electronics: { emoji: '📱', bg: '#f0f4ff', fg: '#4f46e5' },
  Vehicles:    { emoji: '🚘', bg: '#f0f9ff', fg: '#0284c7' },
  Property:    { emoji: '🏡', bg: '#fff7ed', fg: '#c2410c' },
  Clothing:    { emoji: '👔', bg: '#fdf4ff', fg: '#9333ea' },
  Agriculture: { emoji: '🌿', bg: '#ecfdf5', fg: '#0f766e' },
  Furniture:   { emoji: '🛋️', bg: '#fffbeb', fg: '#d97706' },
  Food:        { emoji: '🍜', bg: '#fff1f2', fg: '#e11d48' },
  Services:    { emoji: '⚡', bg: '#f8fafc', fg: '#475569' },
  Other:       { emoji: '📦', bg: '#f8fafc', fg: '#64748b' },
  Jobs:        { emoji: '💼', bg: '#eff6ff', fg: '#2563eb' },
}
function catIcon(cat) { return CAT_ICON[cat] || CAT_ICON.Other }

function formatPrice(n) {
  if (n == null || n === '') return ''
  const num = Number(n)
  if (!Number.isFinite(num)) return ''
  return `MK ${Math.round(num).toLocaleString('en-US')}`
}

function FeaturedCard({ listing, onClick }) {
  const [hov, setHov] = useState(false)
  const [imgErr, setImgErr] = useState(false)
  const [imgReady, setImgReady] = useState(() => imageUrlLoaded(listing.images?.[0]))
  const price = listing.price

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: 12,
        overflow: 'hidden',
        background: '#fff',
        cursor: 'pointer',
        border: '1px solid #f0f0f0',
        boxShadow: hov
          ? '0 12px 32px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.04)'
          : '0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
        transform: hov ? 'translateY(-3px)' : 'none',
        transition: 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1), box-shadow 0.35s ease',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      <div style={{
        position: 'relative',
        width: '100%',
        aspectRatio: '3/2',
        background: '#f8f9fa',
        overflow: 'hidden',
        flexShrink: 0,
      }}>
        {listing.images?.[0] && !imgErr
          ? <img
              src={listing.images[0]}
              alt={listing.title}
              loading="lazy"
              decoding="async"
              onLoad={() => { setImgReady(true); markImageUrlLoaded(listing.images?.[0]) }}
              onError={() => setImgErr(true)}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                opacity: imgReady ? 1 : 0,
                transform: hov ? 'scale(1.05)' : 'scale(1)',
                transition: 'opacity 0.4s ease, transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)',
              }}
            />
          : <div style={{
              width: '100%', height: '100%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 32, color: '#dadce0',
            }}>
              {catIcon(listing.category).emoji}
            </div>
        }
        {listing._isPaidPromo && (
          <div style={{
            position: 'absolute', top: 10, left: 10,
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
            borderRadius: 6, padding: '3px 7px',
            display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontWeight: 700, color: '#fff',
            letterSpacing: '0.03em', textTransform: 'uppercase',
            lineHeight: 1,
          }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            Promoted
          </div>
        )}
      </div>

      <div style={{
        padding: '16px 16px 18px',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
      }}>
        <div className="soko-featured-card-title" style={{
          fontSize: 14,
          fontWeight: 600,
          color: '#202124',
          lineHeight: 1.35,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          marginBottom: 8,
        }}>
          {listing.title}
        </div>

        <div className="soko-featured-card-price" style={{
          fontSize: 17,
          fontWeight: 800,
          color: '#0a7a44',
          lineHeight: 1.3,
          marginBottom: 6,
        }}>
          {formatPrice(price)}
        </div>

        <div style={{
          fontSize: 11,
          fontWeight: 400,
          color: '#9aa0a6',
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          marginTop: 'auto',
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="#9aa0a6" aria-hidden>
            <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
          </svg>
          {listing.city || 'Malawi'}
        </div>
      </div>
    </div>
  )
}

function FeaturedListingsRow({ listings, navigate, loading }) {
  const w = typeof window !== 'undefined' ? window.innerWidth : 9999
  const isMobile = w < 768
  const isDesktop = w >= 1024
  const initCount = isDesktop ? 8 : 4
  const loadInc = isDesktop ? 8 : 6
  const headingSize = isMobile ? 16 : 18

  const allFeatured = useMemo(
    () => (listings || []).filter(l => isListingFeatured(l)),
    [listings],
  )
  const [visibleCount, setVisibleCount] = useState(initCount)

  if (!loading && allFeatured.length === 0) return null

  const total = allFeatured.length
  const showMore = !isMobile && visibleCount < total
  const visible = allFeatured.slice(0, visibleCount)

  function handleLoadMore() {
    setVisibleCount(prev => Math.min(prev + loadInc, total))
  }

  return (
    <section className="soko-featured-section" style={{ padding: '28px 20px 24px', background: '#fff', boxShadow: '0 1px 0 rgba(0,0,0,0.04), inset 0 1px 0 rgba(0,0,0,0.02)' }}>
      <style>{`
        .soko-featured-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
        }
        .soko-featured-scroll {
          display: none;
          gap: 14px;
          overflow-x: auto;
          overflow-y: hidden;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          overscroll-behavior-x: contain;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding: 8px 20px;
          scroll-padding-left: 20px;
        }
        .soko-featured-scroll::-webkit-scrollbar { display: none; }
        .soko-featured-scroll-card {
          flex: 0 0 240px;
          scroll-snap-align: start;
          min-width: 0;
        }
        @media (max-width: 1279px) {
          .soko-featured-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; }
        }
        @media (max-width: 767px) {
          .soko-featured-grid { display: none; }
          .soko-featured-scroll { display: flex; }
          .soko-featured-scroll-card { flex: 0 0 min(280px, 68vw); }
          .soko-featured-section { padding: 24px 0 20px !important; }
        }
        @media (max-width: 400px) {
          .soko-featured-scroll-card { flex: 0 0 min(220px, 72vw); }
          .soko-featured-card-title { font-size: 13px !important; }
          .soko-featured-card-price { font-size: 15px !important; }
        }
        .view-more-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 11px 32px;
          border: 1.5px solid #dadce0;
          border-radius: 999px;
          background: #fff;
          font-family: inherit;
          font-size: 13px;
          font-weight: 700;
          color: #202124;
          cursor: pointer;
          transition: border-color 0.25s ease, box-shadow 0.25s ease;
          white-space: nowrap;
        }
        .view-more-btn:hover {
          border-color: #0F9D58;
          box-shadow: 0 2px 8px rgba(15,157,88,0.12);
        }
        @keyframes featuredFadeSlide {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .featured-animate-in {
          animation: featuredFadeSlide 0.5s ease forwards;
        }
      `}</style>
      <div className="featured-animate-in" style={{
        maxWidth: 1400, margin: '0 auto', minWidth: 0,
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 16, gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
            <div style={{
              width: 4, height: 18,
              borderRadius: 2,
              background: '#0a7a44',
              flexShrink: 0,
            }} />
            <div style={{ minWidth: 0 }}>
              <h2 style={{
                margin: 0,
                fontFamily: "'Sora', 'Inter', system-ui, sans-serif",
                fontSize: headingSize,
                fontWeight: 800,
                color: '#111827',
                letterSpacing: -0.3,
              }}>
                Featured Listings
              </h2>
              <p style={{
                margin: '2px 0 0', fontSize: 13, fontWeight: 500,
                color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}>
                Curated picks from trusted sellers across Malawi
              </p>
            </div>
          </div>
          {!isMobile && total > 0 && (
            <button
              type="button"
              onClick={() => navigate('/listings')}
              style={{
                border: 'none', background: 'transparent', cursor: 'pointer',
                fontFamily: 'inherit', padding: '4px 8px',
                fontSize: 13, fontWeight: 700, color: '#0F9D58',
                borderRadius: 999,
                transition: 'background 0.25s ease',
              }}
            >
              View all
            </button>
          )}
        </div>

        {loading ? (
          <>
            <div className="soko-featured-grid">
              {Array.from({ length: initCount }).map((_, i) => (
                <div key={i} style={{
                  borderRadius: 12, overflow: 'hidden', background: '#fff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
                }}>
                  <div className="skeleton-soft" style={{ width: '100%', aspectRatio: '3/2' }} />
                  <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div className="skeleton" style={{ height: 14, width: '85%', borderRadius: 6 }} />
                    <div className="skeleton" style={{ height: 17, width: '50%', borderRadius: 6 }} />
                    <div className="skeleton" style={{ height: 10, width: '35%', borderRadius: 6 }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="soko-featured-scroll">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="soko-featured-scroll-card">
                  <div style={{
                    borderRadius: 12, overflow: 'hidden', background: '#fff',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
                    height: '100%', display: 'flex', flexDirection: 'column',
                  }}>
                    <div className="skeleton-soft" style={{ width: '100%', aspectRatio: '3/2' }} />
                    <div style={{ padding: '16px 16px 18px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div className="skeleton" style={{ height: 14, width: '85%', borderRadius: 6 }} />
                      <div className="skeleton" style={{ height: 17, width: '50%', borderRadius: 6 }} />
                      <div className="skeleton" style={{ height: 10, width: '35%', borderRadius: 6 }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <div className="soko-featured-grid">
              {visible.map((l) => (
                <FeaturedCard
                  key={l.id}
                  listing={l}
                  onClick={() => navigate('/listing/' + l.id)}
                />
              ))}
            </div>
            <div className="soko-featured-scroll">
              {visible.map((l) => (
                <div key={l.id} className="soko-featured-scroll-card">
                  <FeaturedCard
                    listing={l}
                    onClick={() => navigate('/listing/' + l.id)}
                  />
                </div>
              ))}
            </div>
            {isMobile && total > initCount && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                <button type="button" className="view-more-btn" onClick={() => navigate('/listings')}>
                  View All Featured Listings
                </button>
              </div>
            )}
            {!isMobile && showMore && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
                <button type="button" className="view-more-btn" onClick={handleLoadMore}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                  View More Featured Listings
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </section>
  )
}

export default FeaturedListingsRow
