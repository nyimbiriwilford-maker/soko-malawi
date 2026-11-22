/**
 * SokoMW — ExplorePage.jsx
 * Redesigned to match the Home page.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { CATEGORIES } from '../config/categories'

const GREEN = '#0F9D58'
const GRAY50 = '#f8f9fa'
const GRAY100 = '#f1f3f4'
const TEXT = '#202124'
const SUB = '#5f6368'
const BORDER = '#e8eaed'

const Icon = {
  search: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="1.75" strokeLinecap="round">
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  shops: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 7 4-4h12l4 4" /><path d="M3 7v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7" /><path d="M16 11a4 4 0 0 1-8 0" />
    </svg>
  ),
  people: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a3.5 3.5 0 0 1 0 6.74" />
    </svg>
  ),
  services: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.1-3.1a5.5 5.5 0 0 1-7.3 7.3l-6.1 6.1a2.1 2.1 0 0 1-3-3l6.1-6.1a5.5 5.5 0 0 1 7.3-7.3l-3.1 3.1z" />
    </svg>
  ),
  stories: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  verify: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
    </svg>
  ),
  chevR: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#c4c7cc" strokeWidth="2" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  ),
}

const EXPLORE_ROWS = [
  { title: 'Shops', icon: Icon.shops, iconBg: '#e6f6ed', iconColor: GREEN, sub: 'Browse verified shops', path: '/shops' },
  { title: 'People Looking For', icon: Icon.people, iconBg: '#e8f0fe', iconColor: '#1A73E8', sub: 'Requests and offers', path: '/looking-for' },
  { title: 'Services', icon: Icon.services, iconBg: '#f1ecff', iconColor: '#7c4dff', sub: 'Find and hire experts', path: '/services' },
  { title: 'Statuses (Stories)', icon: Icon.stories, iconBg: '#e6f6ed', iconColor: GREEN, sub: 'Watch and share', path: '/status' },
  { title: 'Verification', icon: Icon.verify, iconBg: '#e8f0fe', iconColor: '#1A73E8', sub: 'Verify your account', path: '/profile' },
]

export default function ExplorePage() {
  const navigate = useNavigate()
  const [windowWidth, setWindowWidth] = useState(typeof window !== 'undefined' ? window.innerWidth : 1024)

  useEffect(() => {
    const handler = () => setWindowWidth(window.innerWidth)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  const isWide = windowWidth >= 1100
  const sidePadding = windowWidth >= 769 ? 24 : 14
  const sectionGap = isWide ? 36 : 28

  return (
    <div style={{
      background: GRAY50,
      minHeight: '100dvh',
      fontFamily: "'DM Sans', 'Inter', system-ui, sans-serif",
      paddingBottom: 'calc(var(--bottom-nav-h, 60px) + env(safe-area-inset-bottom, 0px) + 16px)',
    }}>
      <style>{`
        .explore-cat {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 8px;
          cursor: pointer;
          font-family: inherit;
          border: none;
          background: transparent;
          padding: 8px 4px;
          min-height: 44px;
          min-width: 0;
          -webkit-tap-highlight-color: transparent;
          transition: transform 0.12s ease;
        }
        .explore-cat:active { transform: scale(0.96); }
        .explore-cat-label {
          font-family: 'DM Sans', system-ui, sans-serif;
          font-size: 11.5px;
          font-weight: 600;
          color: ${TEXT};
          text-align: center;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          overflow-wrap: normal;
          word-break: normal;
          hyphens: none;
          padding: 0;
          min-height: 1.25em;
        }
        @media (max-width: 339px) {
          .explore-cat-label { font-size: 11px; }
        }
        @media (min-width: 1100px) {
          .explore-cat-label { font-size: 12px; }
        }
        @media (min-width: 1100px) {
          .explore-cat {
            background: #ffffff;
            border: 1px solid ${BORDER};
            border-radius: 14px;
            padding: 14px 8px;
            gap: 10px;
          }
        }
      `}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto', padding: `0 ${sidePadding}px`, boxSizing: 'border-box' }}>
        {/* Header */}
        <div style={{ paddingTop: 16, paddingBottom: 0 }}>
          <h1 style={{
            fontFamily: "'Sora', 'Inter', system-ui, sans-serif",
            fontSize: 20, fontWeight: 800, color: TEXT,
            letterSpacing: -0.3, lineHeight: 1.2, margin: 0,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            Explore
          </h1>
          <div style={{ fontSize: 13, color: SUB, fontWeight: 500, marginTop: 4, fontFamily: "'DM Sans', system-ui, sans-serif" }}>
            Find categories, shops and sellers
          </div>
          <div
            onClick={() => navigate('/search?focus=1')}
            style={{
              marginTop: 12,
              height: 48,
              borderRadius: 999,
              background: GRAY100,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '0 16px',
              cursor: 'pointer',
              boxSizing: 'border-box',
            }}
          >
            {Icon.search}
            <span style={{
              flex: 1,
              fontSize: 14,
              color: '#9aa0a6',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: "'DM Sans', system-ui, sans-serif",
            }}>
              Search items, services…
            </span>
          </div>
        </div>

        {/* Browse categories */}
        <section style={{ marginTop: sectionGap }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{
              fontFamily: "'Sora', 'Inter', system-ui, sans-serif",
              fontSize: 20, fontWeight: 800, color: TEXT,
              letterSpacing: -0.3, lineHeight: 1.2,
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>
              Browse categories
            </div>
            <div style={{ fontSize: 13, color: SUB, fontWeight: 500, marginTop: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              Find what you need in Malawi
            </div>
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: isWide ? 'repeat(8, minmax(0, 1fr))' : 'repeat(4, minmax(0, 1fr))',
            gap: isWide ? 16 : '12px 8px',
            alignItems: 'start',
            justifyItems: 'center',
          }}>
            {CATEGORIES.map(cat => {
              const IconComp = cat.icon
              return (
                <button
                  key={cat.key}
                  type="button"
                  className="explore-cat"
                  onClick={() => {
                    if (cat.key === 'Services') navigate('/services')
                    else if (cat.key === 'all') navigate('/listings')
                    else if (cat.key === 'More') navigate('/categories')
                    else navigate(`/listings?cat=${encodeURIComponent(cat.key)}`)
                  }}
                >
                  <div style={{
                    width: isWide ? 48 : 52,
                    height: isWide ? 48 : 52,
                    borderRadius: isWide ? 12 : 16,
                    background: cat.tint,
                    color: cat.accent,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    <IconComp size={isWide ? 24 : 26} strokeWidth={1.75} />
                  </div>
                  <span className="explore-cat-label">{cat.label}</span>
                </button>
              )
            })}
          </div>
        </section>

        {/* Explore SokoMw */}
        <section style={{ marginTop: sectionGap }}>
          <div style={{
            fontFamily: "'Sora', 'Inter', system-ui, sans-serif",
            fontSize: 20, fontWeight: 800, color: TEXT,
            letterSpacing: -0.3, lineHeight: 1.2,
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            marginBottom: 14,
          }}>
            Explore SokoMw
          </div>
          <div style={{
            background: '#ffffff',
            border: `1px solid ${BORDER}`,
            borderRadius: 14,
            overflow: 'hidden',
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: isWide ? '1fr 1fr' : '1fr',
            }}>
              {EXPLORE_ROWS.map((row, i) => (
                <button
                  key={row.title}
                  type="button"
                  onClick={() => navigate(row.path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    minHeight: 64,
                    padding: '10px 14px',
                    background: 'none',
                    border: 'none',
                    borderBottom: i < EXPLORE_ROWS.length - 1 ? `1px solid ${BORDER}` : 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    width: '100%',
                  }}
                >
                  <div style={{
                    flex: 'none',
                    width: 48, height: 48, borderRadius: 14,
                    background: row.iconBg,
                    color: row.iconColor,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {row.icon}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                      fontSize: 16, fontWeight: 700, color: TEXT,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {row.title}
                    </div>
                    <div style={{
                      fontFamily: "'DM Sans', system-ui, sans-serif",
                      fontSize: 13, color: SUB,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {row.sub}
                    </div>
                  </div>
                  <div style={{ flex: 'none', marginLeft: 8, display: 'flex', alignItems: 'center' }}>
                    <ChevronRight size={20} strokeWidth={1.75} color="#80868b" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}



