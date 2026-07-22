/**
 * SokoMW — ExplorePage.jsx
 * Mobile Explore tab: category grid + pillar sections
 * Matches the reference screenshot design exactly.
 */
import { useNavigate } from 'react-router-dom'

const GREEN  = '#1a7a4a'
const GRAY50 = '#f8f9fa'
const GRAY100 = '#f1f3f4'
const GRAY600 = '#6b7280'
const GRAY900 = '#111827'

const Icon = {
  search: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#aaa" strokeWidth="2.2" strokeLinecap="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  allCats: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  vehicles: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a1 1 0 0 1-1-1v-4l2-5h14l2 5v4a1 1 0 0 1-1 1h-2"/>
      <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="16.5" cy="17.5" r="2.5"/>
    </svg>
  ),
  electronics: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>
    </svg>
  ),
  fashion: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#be185d" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/>
    </svg>
  ),
  property: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3 11 9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10"/>
    </svg>
  ),
  agriculture: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10S2 17.52 2 12"/>
      <path d="M12 6v6l4 2"/>
    </svg>
  ),
  shops: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m2 7 4-4h12l4 4"/><path d="M3 7v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7"/><path d="M16 11a4 4 0 0 1-8 0"/>
    </svg>
  ),
  more: (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={GRAY600} strokeWidth="1.8" strokeLinecap="round">
      <circle cx="5" cy="12" r="1.5" fill={GRAY600}/><circle cx="12" cy="12" r="1.5" fill={GRAY600}/><circle cx="19" cy="12" r="1.5" fill={GRAY600}/>
    </svg>
  ),
  people: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a3.5 3.5 0 0 1 0 6.74"/>
    </svg>
  ),
  jobs: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>
  ),
  services: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.1-3.1a5.5 5.5 0 0 1-7.3 7.3l-6.1 6.1a2.1 2.1 0 0 1-3-3l6.1-6.1a5.5 5.5 0 0 1 7.3-7.3l-3.1 3.1z"/>
    </svg>
  ),
  stories: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  verify: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0891b2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/>
    </svg>
  ),
  chevR: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
}

const CATS = [
  { label: 'All Categories',  icon: Icon.allCats,     bg: '#e8f5ee', path: '/search' },
  { label: 'Vehicles',        icon: Icon.vehicles,    bg: '#dbeafe', path: '/search?cat=Vehicles' },
  { label: 'Electronics',     icon: Icon.electronics, bg: '#ede9fe', path: '/search?cat=Electronics' },
  { label: 'Fashion',         icon: Icon.fashion,     bg: '#fce7f3', path: '/search?cat=Clothing' },
  { label: 'Property',        icon: Icon.property,    bg: '#ffedd5', path: '/search?cat=Property' },
  { label: 'Agriculture',     icon: Icon.agriculture, bg: '#dcfce7', path: '/search?cat=Agriculture' },
  { label: 'Shops',           icon: Icon.shops,       bg: '#cffafe', path: '/shops' },
  { label: 'More Categories', icon: Icon.more,        bg: GRAY100,   path: '/search' },
]

const PILLARS = [
  { icon: Icon.people,   iconBg: '#e8f5ee', label: 'People Looking For',    sub: 'Find requests and offer help',       path: '/looking-for' },
  { icon: Icon.jobs,     iconBg: '#dbeafe', label: 'Jobs',                  sub: 'Find jobs near you',                 path: '/jobs' },
  { icon: Icon.services, iconBg: '#ede9fe', label: 'Services',              sub: 'Find and hire experts',              path: '/services' },
  { icon: Icon.stories,  iconBg: '#ffedd5', label: 'Statuses (Stories)',    sub: 'Watch and share stories',            path: '/status' },
  { icon: Icon.verify,   iconBg: '#cffafe', label: 'Verification',          sub: 'Verify your account or business',    path: '/profile' },
]

export default function ExplorePage() {
  const navigate = useNavigate()

  return (
    <div style={{
      background: '#fff',
      minHeight: '100dvh',
      fontFamily: "'Inter', 'DM Sans', system-ui, sans-serif",
      paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
    }}>

      {/* Header */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid #f0f5f1',
        position: 'sticky', top: 0, zIndex: 50,
        background: '#fff',
      }}>
        <h1 style={{
          fontSize: 22, fontWeight: 800, color: GRAY900,
          letterSpacing: '-0.4px', marginBottom: 12,
          fontFamily: "'Sora', system-ui, sans-serif",
        }}>
          Explore
        </h1>
        <div
          onClick={() => navigate('/search?focus=1')}
          style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: GRAY50, borderRadius: 12,
            padding: '11px 14px',
            border: '1.5px solid #e8ede9',
            cursor: 'pointer',
          }}
        >
          {Icon.search}
          <span style={{ fontSize: 14, color: '#aaa', flex: 1 }}>
            Search categories, items, services…
          </span>
        </div>
      </div>

      {/* Marketplace grid */}
      <div style={{ padding: '18px 16px 4px' }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: GRAY900, marginBottom: 14, letterSpacing: '-0.2px' }}>
          Marketplace
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {CATS.map(cat => (
            <button
              key={cat.label}
              onClick={() => navigate(cat.path)}
              style={{
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 8, padding: '14px 8px',
                background: '#fff', border: '1px solid #eef2ef',
                borderRadius: 14, cursor: 'pointer',
                fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
              }}
            >
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: cat.bg,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {cat.icon}
              </div>
              <span style={{ fontSize: 11.5, fontWeight: 600, color: GRAY900, textAlign: 'center', lineHeight: 1.2 }}>
                {cat.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      <div style={{ height: 1, background: '#f0f5f1', margin: '16px 0' }} />

      {/* Pillars */}
      <div style={{ padding: '0 16px' }}>
        {PILLARS.map((p, i) => (
          <button
            key={p.label}
            onClick={() => navigate(p.path)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14,
              width: '100%', padding: '14px 0',
              background: 'none', border: 'none',
              borderBottom: i < PILLARS.length - 1 ? '1px solid #f0f5f1' : 'none',
              cursor: 'pointer', textAlign: 'left',
              fontFamily: 'inherit', WebkitTapHighlightColor: 'transparent',
            }}
          >
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: p.iconBg, flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              {p.icon}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: GRAY900, marginBottom: 2 }}>{p.label}</div>
              <div style={{ fontSize: 12, color: GRAY600 }}>{p.sub}</div>
            </div>
            {Icon.chevR}
          </button>
        ))}
      </div>
    </div>
  )
}