/**
 * Shared top navigation (Home + Looking For + other marketplace pages).
 * Desktop + mobile layout match Home. Only the primary CTA differs per page.
 */
import { useState, useRef } from 'react'
import { T } from '../constants/tokens'

const Icon = {
  search: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  ),
  bell: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
  chat: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  plus: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  pin: (s = 13) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
    </svg>
  ),
  x: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  shop: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" /><line x1="3" y1="6" x2="21" y2="6" /><path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
}

export const SOKO_PILLARS = [
  {
    key: 'marketplace', label: 'Marketplace', path: '/',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M3 12l9-9 9 9" /><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10" />
      </svg>
    ),
  },
  { key: 'shops', label: 'Shops', path: '/shops', icon: Icon.shop },
  {
    key: 'lookingfor', label: 'People Looking For', path: '/looking-for',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="8" r="4" /><path d="M4 21v-1a8 8 0 0 1 16 0v1" />
      </svg>
    ),
  },
  {
    key: 'jobs', label: 'Jobs', path: '/jobs',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      </svg>
    ),
  },
  {
    key: 'services', label: 'Services', path: '/services',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <line x1="4" y1="21" x2="4" y2="14" /><line x1="4" y1="10" x2="4" y2="3" />
        <line x1="12" y1="21" x2="12" y2="12" /><line x1="12" y1="8" x2="12" y2="3" />
        <line x1="20" y1="21" x2="20" y2="16" /><line x1="20" y1="12" x2="20" y2="3" />
        <line x1="1" y1="14" x2="7" y2="14" /><line x1="9" y1="8" x2="15" y2="8" /><line x1="17" y1="16" x2="23" y2="16" />
      </svg>
    ),
  },
  {
    key: 'stories', label: 'Statuses (Stories)', path: '/status',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
  },
  {
    key: 'verify', label: 'Verification', path: '/profile',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
      </svg>
    ),
  },
]

function NavIconBtn({ icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px',
        borderRadius: 12, color: T.gray800, fontSize: 10, fontWeight: 600,
        transition: 'background 0.15s', fontFamily: 'inherit',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = T.gray100 }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
    >
      {icon}<span>{label}</span>
    </button>
  )
}

/**
 * @param {object} props
 * @param {'marketplace'|'lookingfor'|string} [props.activePillar]
 * @param {string} [props.ctaLabel]  Desktop CTA label (default Sell Now)
 * @param {() => void} [props.onCta]  Desktop CTA click (default → /post)
 * @param {boolean} [props.hideCta]  Hide primary CTA entirely
 */
export default function SokoNav({
  user,
  notifCount = 0,
  search = '',
  setSearch,
  navigate,
  onImageFile,
  animKeywords = [],
  animIdx = 0,
  activeDistrict,
  onDistrictChange,
  onFocusChange,
  activePillar = 'marketplace',
  ctaLabel = 'Sell Now',
  onCta,
  hideCta = false,
}) {
  const [focused, setFocusedRaw] = useState(false)
  function setFocused(v) { setFocusedRaw(v); onFocusChange?.(v) }
  const [distOpen, setDistOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const district = activeDistrict || 'All Districts'
  const fileRef = useRef(null)
  const inputRef = useRef(null)

  const districts = [
    'All Districts', 'Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba',
    'Kasungu', 'Mangochi', 'Salima', 'Dedza', 'Ntchisi', 'Dowa',
  ]
  const kw = animKeywords?.length > 0
    ? animKeywords[animIdx % animKeywords.length]
    : 'Samsung Galaxy A57'

  function handleKey(e) {
    if (e.key === 'Enter' && search.trim()) {
      navigate(`/search?q=${encodeURIComponent(search.trim())}`)
    }
  }

  function handleCta() {
    if (onCta) onCta()
    else navigate('/post')
  }

  function changeDistrict(d) {
    onDistrictChange?.(d)
    setDistOpen(false)
  }

  return (
    <nav className="soko-nav-glass">
      <style>{`
        .soko-nav-glass {
          position: sticky; top: 0; z-index: 100;
          backdrop-filter: blur(20px) saturate(1.8);
          -webkit-backdrop-filter: blur(20px) saturate(1.8);
          background: rgba(255,255,255,.92);
          border-bottom: 1px solid rgba(0,0,0,.07);
          box-shadow: 0 1px 0 rgba(0,0,0,.04), 0 4px 20px rgba(0,0,0,.04);
        }
        .soko-nav-mobile { display: none; }
        .soko-scroll { scrollbar-width: none; }
        .soko-scroll::-webkit-scrollbar { display: none; }
        @media (max-width: 768px) {
          .soko-nav-desktop { display: none !important; }
          .soko-nav-mobile { display: flex !important; }
          .soko-pillar-row { display: none !important; }
          .soko-nav-row1 {
            padding: 8px 14px !important;
            min-height: 52px !important;
            gap: 10px !important;
          }
          .soko-nav-brand-mark { font-size: 18px !important; }
          .soko-nav-mobile-search {
            min-height: 40px !important;
            padding: 0 12px !important;
            border-radius: 12px !important;
            background: #f3f4f6 !important;
            border-color: #e5e7eb !important;
          }
          .soko-nav-mobile-pillars { padding: 6px 12px 10px !important; }
          .soko-nav-mobile-pillars button {
            padding: 7px 12px !important;
            font-size: 12px !important;
            border-radius: 999px !important;
          }
        }
        @media (min-width: 769px) {
          .soko-nav-mobile { display: none !important; }
        }
      `}</style>

      {/* Row 1 */}
      <div className="soko-nav-row1" style={{
        maxWidth: 1400, margin: '0 auto', padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 14, minHeight: 70,
      }}>
        <div onClick={() => navigate('/')} className="soko-nav-brand" style={{ cursor: 'pointer', flexShrink: 0, userSelect: 'none' }}>
          <div className="soko-nav-brand-mark" style={{
            fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 800,
            color: T.green, letterSpacing: '-0.5px', lineHeight: 1.1,
          }}>
            Soko<span style={{ color: T.amber }}>Mw</span>
          </div>
          <div className="soko-nav-desktop" style={{ fontSize: 10.5, color: T.gray600, fontWeight: 500, whiteSpace: 'nowrap' }}>
            Buy. Sell. Find. Anywhere in Malawi.
          </div>
        </div>

        {/* Desktop district */}
        <div className="soko-nav-desktop" style={{ position: 'relative', flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => setDistOpen(d => !d)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '7px 12px', borderRadius: 50,
              background: '#fff', border: `1.5px solid ${T.gray200}`,
              fontSize: 13, fontWeight: 600, color: T.gray800,
              cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit',
            }}
          >
            {Icon.pin(13)}
            <span style={{
              color: district !== 'All Districts' ? T.amber : T.green,
              fontWeight: district !== 'All Districts' ? 800 : 600,
            }}>{district}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {district !== 'All Districts' && (
              <span
                role="button"
                tabIndex={0}
                onClick={e => { e.stopPropagation(); changeDistrict('All Districts') }}
                onKeyDown={e => e.key === 'Enter' && changeDistrict('All Districts')}
                style={{ marginLeft: 2, color: T.gray400, fontSize: 11, lineHeight: 1 }}
              >✕</span>
            )}
          </button>
          {distOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0,
              background: T.white, borderRadius: 16, padding: '8px 0',
              boxShadow: T.shadowLg, minWidth: 200,
              border: `1px solid ${T.gray200}`, zIndex: 200,
            }}>
              {districts.map(d => (
                <button
                  key={d}
                  type="button"
                  onClick={() => changeDistrict(d)}
                  style={{
                    display: 'block', width: '100%', padding: '9px 16px', textAlign: 'left',
                    background: d === district ? T.greenL : 'transparent', border: 'none',
                    fontSize: 13.5, fontWeight: d === district ? 700 : 500,
                    color: d === district ? T.green : T.gray800, cursor: 'pointer',
                    fontFamily: 'inherit',
                  }}
                >{d}</button>
              ))}
            </div>
          )}
        </div>

        {/* Desktop search */}
        <div className="soko-nav-desktop" style={{
          flex: 1, display: 'flex', alignItems: 'center',
          background: focused ? '#fff' : T.gray100,
          border: `1.5px solid ${focused ? T.green : 'transparent'}`,
          borderRadius: 50, padding: '4px 4px 4px 14px', gap: 0,
          transition: 'border-color 0.2s, background 0.2s',
          boxShadow: focused ? '0 0 0 3px rgba(15,157,88,0.10)' : 'none',
          minHeight: 42,
        }}>
          <span style={{ color: T.gray600, flexShrink: 0, display: 'flex', alignItems: 'center', marginRight: 8 }}>
            {Icon.search(15)}
          </span>
          <input
            ref={inputRef}
            value={search}
            onChange={e => {
              const val = e.target.value
              setSearch?.(val)
              navigate(`/search?q=${encodeURIComponent(val)}&focus=1`)
            }}
            onFocus={() => { setFocused(true); navigate('/search?focus=1') }}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKey}
            placeholder="Search for anything (e.g. iPhone, Toyota, jobs, services...)"
            style={{
              flex: 1, border: 'none', background: 'transparent', fontSize: 13.5,
              color: T.gray900, outline: 'none', padding: 0, minWidth: 0, cursor: 'text',
              fontFamily: 'inherit',
            }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch?.('')}
              style={{
                background: T.gray200, border: 'none', borderRadius: '50%',
                width: 18, height: 18, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: T.gray600,
                flexShrink: 0, marginRight: 6,
              }}
            >{Icon.x(9)}</button>
          )}
          <button
            type="button"
            onClick={() => { if (search.trim()) navigate(`/search?q=${encodeURIComponent(search.trim())}`) }}
            style={{
              flexShrink: 0, background: T.green, color: '#fff', border: 'none',
              borderRadius: 50, height: 34, padding: '0 20px',
              fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            Search
          </button>
          {onImageFile && (
            <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onImageFile} />
          )}
        </div>

        {/* Desktop actions */}
        <div className="soko-nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <NavIconBtn icon={Icon.chat(18)} label="Chats" onClick={() => navigate('/chats')} />
          <div style={{ position: 'relative' }}>
            <NavIconBtn icon={Icon.bell(18)} label="Alerts" onClick={() => navigate('/notifications')} />
            {notifCount > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 6, background: T.red, color: '#fff',
                borderRadius: '50%', width: 17, height: 17, fontSize: 9, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid #fff',
              }}>{notifCount > 9 ? '9+' : notifCount}</span>
            )}
          </div>
          {!hideCta && (
            <button
              type="button"
              onClick={handleCta}
              style={{
                height: 38, padding: '0 18px', fontSize: 13.5, fontWeight: 700,
                background: T.green, color: '#fff', border: 'none', borderRadius: 50,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
                whiteSpace: 'nowrap', fontFamily: 'inherit',
              }}
            >
              {Icon.plus(14)} {ctaLabel}
            </button>
          )}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setAvatarOpen(o => !o)}
              style={{
                width: 38, height: 38, borderRadius: '50%',
                background: user?.avatar_url ? 'transparent' : `linear-gradient(135deg, ${T.green}, ${T.greenD})`,
                border: `2px solid ${T.green}`, cursor: 'pointer', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0, padding: 0,
              }}
            >
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (user?.email?.[0] || user?.full_name?.[0] || 'S').toUpperCase()}
            </button>
            {avatarOpen && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 10px)', right: 0,
                background: T.white, borderRadius: 16, padding: '8px 0',
                boxShadow: T.shadowLg, minWidth: 190, border: `1px solid ${T.gray200}`, zIndex: 200,
              }}>
                {[
                  { label: 'My Profile', path: '/profile' },
                  ...(user?.shop_slug
                    ? [{ label: 'My Shop', path: `/shop/${user.shop_slug}`, green: true, isShop: true }]
                    : [{ label: 'Create My Shop', path: '/shop-setup', green: true, isShop: true }]),
                  { label: 'My Listings', path: '/my-listings' },
                  { label: 'My Chats', path: '/chats' },
                  { label: 'Settings', path: '/settings' },
                  { divider: true },
                  { label: 'Sign Out', path: '/logout', red: true },
                ].map((item, i) => item.divider
                  ? <div key={i} style={{ height: 1, background: T.gray200, margin: '4px 0' }} />
                  : (
                    <button
                      key={i}
                      type="button"
                      onClick={() => { navigate(item.path); setAvatarOpen(false) }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                        padding: '9px 16px', textAlign: 'left', background: 'transparent',
                        border: 'none', fontSize: 13.5,
                        fontWeight: item.green ? 700 : 500,
                        color: item.red ? T.red : item.green ? T.green : T.gray800,
                        cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      {item.isShop && Icon.shop(13)}
                      {item.label}
                    </button>
                  ))}
              </div>
            )}
          </div>
        </div>

        {/* Mobile: search + alerts */}
        <div className="soko-nav-mobile" style={{ display: 'none', flex: 1, alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div
            className="soko-nav-mobile-search"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
              background: T.gray100, borderRadius: 12, padding: '0 12px', minHeight: 40,
              border: `1px solid ${focused ? T.green : T.gray200}`, position: 'relative', cursor: 'pointer',
            }}
            onClick={() => navigate('/search?focus=1')}
          >
            <span style={{ color: focused ? T.green : T.gray400, flexShrink: 0, display: 'flex' }}>{Icon.search(16)}</span>
            <div style={{ flex: 1, position: 'relative', height: 22, minWidth: 0 }}>
              <input
                value={search}
                onChange={e => {
                  e.stopPropagation()
                  const val = e.target.value
                  setSearch?.(val)
                  navigate(`/search?q=${encodeURIComponent(val)}&focus=1`)
                }}
                onFocus={() => { setFocused(true); navigate('/search?focus=1') }}
                onBlur={() => setFocused(false)}
                aria-label="Search marketplace"
                style={{
                  position: 'absolute', inset: 0, width: '100%', border: 'none',
                  background: 'transparent', fontSize: 14, color: T.gray900, outline: 'none',
                  zIndex: search || focused ? 2 : 0, fontFamily: 'inherit',
                }}
              />
              {!search && !focused && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                  pointerEvents: 'none', fontSize: 13.5, color: T.gray400, overflow: 'hidden',
                }}>
                  Search&nbsp;
                  <span style={{ color: T.green, fontWeight: 600 }}>{kw}</span>
                </div>
              )}
            </div>
            {search && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setSearch?.('') }}
                style={{
                  background: T.gray200, border: 'none', borderRadius: '50%',
                  width: 22, height: 22, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', color: T.gray600, flexShrink: 0,
                }}
              >{Icon.x(10)}</button>
            )}
          </div>
          {!hideCta && (
            <button
              type="button"
              onClick={handleCta}
              aria-label={ctaLabel}
              style={{
                height: 40, padding: '0 12px', borderRadius: 12, border: 'none',
                background: T.green, color: '#fff', fontWeight: 800, fontSize: 12,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
                flexShrink: 0, fontFamily: 'inherit', whiteSpace: 'nowrap',
              }}
            >
              {Icon.plus(14)} Post
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            aria-label="Notifications"
            style={{
              width: 40, height: 40, borderRadius: 12, background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              color: T.gray800, flexShrink: 0, position: 'relative',
            }}
          >
            {Icon.bell(20)}
            {notifCount > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4, background: T.red, color: '#fff',
                borderRadius: '50%', minWidth: 16, height: 16, fontSize: 9, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid #fff', padding: '0 3px',
              }}>{notifCount > 9 ? '9+' : notifCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* Desktop pillars */}
      <div className="soko-pillar-row soko-nav-desktop" style={{ borderTop: `1px solid ${T.gray100}` }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 0 }}>
          {SOKO_PILLARS.map(p => {
            const isActive = p.key === activePillar
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => navigate(p.path)}
                style={{
                  position: 'relative', display: 'flex', alignItems: 'center', gap: 6,
                  padding: '10px 16px',
                  background: 'none', border: 'none',
                  borderBottom: isActive ? `2.5px solid ${T.green}` : '2.5px solid transparent',
                  cursor: 'pointer', fontSize: 13.5, fontWeight: isActive ? 700 : 500,
                  color: isActive ? T.green : T.gray800,
                  whiteSpace: 'nowrap', fontFamily: 'inherit',
                }}
              >
                <span style={{ color: isActive ? T.green : T.gray600, display: 'flex' }}>{p.icon(15)}</span>
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Mobile pillar chips */}
      <div className="soko-nav-mobile soko-nav-mobile-pillars" style={{ display: 'none', borderTop: `1px solid ${T.gray100}` }}>
        <div className="soko-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 12px' }}>
          {SOKO_PILLARS.map(p => {
            const isActive = p.key === activePillar
            return (
              <button
                key={p.key}
                type="button"
                onClick={() => navigate(p.path)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                  background: isActive ? T.greenL : T.gray100,
                  border: isActive ? `1.5px solid ${T.green}` : 'none',
                  borderRadius: 999, padding: '7px 12px', fontSize: 12,
                  fontWeight: isActive ? 700 : 600,
                  color: isActive ? T.green : T.gray800, cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                <span style={{ display: 'flex', color: isActive ? T.green : T.gray600 }}>{p.icon(13)}</span>
                {p.label}
              </button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
