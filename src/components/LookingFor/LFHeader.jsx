import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { T } from '../../constants/tokens'
import { Icon } from './Icons'

/**
 * LFHeader — matches the SokoMW Home nav exactly:
 *   Logo | District pill | Search bar | Chats | Alerts | Post Request | Avatar
 * Plus a slim "Looking For" page context row below.
 *
 * Props:
 *   user            object | null
 *   notifCount      number
 *   alertCount      number
 *   onAlertsClick   () => void
 *   onPost          () => void
 *   viewerCity      string | null
 *   detectingViewer bool
 *   dbCities        string[]
 *   onCityChange    (city: string) => void
 *   search          string
 *   onSearch        (val: string) => void
 */
export default function LFHeader({
  user,
  onTab,
  notifCount = 0,
  alertCount = 0,
  onAlertsClick,
  onPost,
  viewerCity,
  detectingViewer,
  dbCities = [],
  onCityChange,
  search = '',
  onSearch,
}) {
  const navigate = useNavigate()

  // District dropdown
  const [distOpen,      setDistOpen]      = useState(false)
  const [distInput,     setDistInput]     = useState('')
  // City edit (location row)
  const [cityEditOpen,  setCityEditOpen]  = useState(false)
  const [cityEditInput, setCityEditInput] = useState('')
  const [cityEditSuggs, setCityEditSuggs] = useState([])
  // Search
  const [focused, setFocused] = useState(false)
  const inputRef = useRef(null)
  // Avatar menu
  const [avatarOpen, setAvatarOpen] = useState(false)

  const districts = ['All Districts','Lilongwe','Blantyre','Mzuzu','Zomba','Kasungu','Mangochi','Salima','Dedza','Ntchisi','Dowa']
  const district  = viewerCity || 'All Districts'

  function commitCity(val) {
    const trimmed = (val || cityEditInput).trim()
    if (trimmed) onCityChange(trimmed)
    setCityEditOpen(false)
    setCityEditSuggs([])
  }

  return (
    <nav className="lf-nav-glass" style={{ position: 'sticky', top: 0, zIndex: 200 }}>

      {/* ══════════ TOP BAR (identical to Home SokoNav) ══════════ */}
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 14, height: 64 }}>

        {/* Logo */}
        <div
          onClick={() => navigate('/')}
          style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 800, color: T.green, letterSpacing: '-0.5px', cursor: 'pointer', flexShrink: 0, userSelect: 'none' }}
        >
          Soko<span style={{ color: T.amber }}>MW</span>
        </div>

        {/* District pill */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setDistOpen(d => !d)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 12, background: T.gray100, border: `1.5px solid ${T.gray200}`, fontSize: 13, fontWeight: 600, color: T.gray800, cursor: 'pointer', whiteSpace: 'nowrap' }}
          >
            {Icon.pin(13)}
            <span style={{ color: viewerCity ? T.amber : T.green, fontWeight: viewerCity ? 800 : 600 }}>
              {detectingViewer ? 'Detecting…' : district}
            </span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
            {viewerCity && (
              <span onClick={e => { e.stopPropagation(); onCityChange('') }} style={{ marginLeft: 2, color: T.gray400, fontSize: 11 }}>✕</span>
            )}
          </button>
          {distOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, background: T.white, borderRadius: 16, padding: '8px 0', boxShadow: T.shadowLg, minWidth: 200, border: `1px solid ${T.gray200}`, zIndex: 300, animation: 'fadeUp 0.18s ease' }}>
              {districts.map(d => (
                <button key={d} onClick={() => { onCityChange(d === 'All Districts' ? '' : d); setDistOpen(false) }} style={{ display: 'block', width: '100%', padding: '9px 16px', textAlign: 'left', background: d === district ? T.greenL : 'transparent', border: 'none', fontSize: 13.5, fontWeight: d === district ? 700 : 500, color: d === district ? T.green : T.gray800, cursor: 'pointer' }}>
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Search bar */}
        <div
          style={{ flex: 1, display: 'flex', alignItems: 'center', background: focused ? '#fff' : T.gray100, border: `1.5px solid ${focused ? T.green : T.gray200}`, borderRadius: 50, padding: '9px 14px', gap: 10, transition: 'all 0.2s', boxShadow: focused ? '0 0 0 3px rgba(15,157,88,0.12)' : 'none', cursor: 'text' }}
          onClick={() => inputRef.current?.focus()}
        >
          <span style={{ color: focused ? T.green : T.gray400, display: 'flex', flexShrink: 0 }}>{Icon.search(16)}</span>
          <input
            ref={inputRef}
            value={search}
            onChange={e => onSearch?.(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Search requests, products, services…"
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 14, color: T.gray900, outline: 'none' }}
          />
          {search && (
            <button onClick={() => onSearch?.('')} style={{ background: T.gray200, border: 'none', borderRadius: '50%', width: 20, height: 20, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.gray600, flexShrink: 0 }}>
              {Icon.x(10)}
            </button>
          )}
        </div>

        {/* Chats */}
        <NavIconBtn icon={Icon.chat(18)} label="Chats" onClick={() => navigate('/chats')} />

        {/* Notifications bell */}
        <div style={{ position: 'relative' }}>
          <NavIconBtn icon={Icon.bell(18)} label="Alerts" onClick={onAlertsClick} />
          {(notifCount > 0 || alertCount > 0) && (
            <span style={{ position: 'absolute', top: 4, right: 6, background: T.red, color: '#fff', borderRadius: '50%', width: 17, height: 17, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
              {notifCount + alertCount > 9 ? '9+' : notifCount + alertCount}
            </span>
          )}
        </div>

        {/* Post Request (primary CTA — matches "Sell Now") */}
        <button
          onClick={onPost}
          style={{ background: T.green, color: '#fff', border: 'none', borderRadius: 14, height: 38, padding: '0 16px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', transition: 'background 0.15s, transform 0.1s', flexShrink: 0 }}
          onMouseEnter={e => e.currentTarget.style.background = T.greenD}
          onMouseLeave={e => e.currentTarget.style.background = T.green}
        >
          {Icon.plus(14)} Post Request
        </button>

        {/* Avatar */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button
            onClick={() => setAvatarOpen(o => !o)}
            style={{ width: 38, height: 38, borderRadius: '50%', background: user?.avatar_url ? 'transparent' : `linear-gradient(135deg, ${T.green}, ${T.greenD})`, border: `2px solid ${T.green}`, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700 }}
          >
            {user?.avatar_url
              ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (user?.email?.[0] || 'S').toUpperCase()
            }
          </button>
          {avatarOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, background: T.white, borderRadius: 16, padding: '8px 0', boxShadow: T.shadowLg, minWidth: 190, border: `1px solid ${T.gray200}`, zIndex: 300, animation: 'fadeUp 0.18s ease' }}>
              {[
               { label: 'My Profile',    path: '/profile' },
{ label: 'My Chats',      path: '/chats' },
{ label: 'My Requests',   path: null, action: () => { onTab?.('mine'); setAvatarOpen(false) } },
{ label: 'Home',          path: '/' },
{ divider: true },
{ label: 'Sign Out',      path: '/logout', red: true },
              ].map((item, i) => item.divider
                ? <div key={i} style={{ height: 1, background: T.gray200, margin: '4px 0' }} />
                : <button key={i} onClick={() => { if (item.action) { item.action() } else { navigate(item.path); setAvatarOpen(false) } }} style={{ display: 'block', width: '100%', padding: '9px 16px', textAlign: 'left', background: 'transparent', border: 'none', fontSize: 13.5, fontWeight: 500, color: item.red ? T.red : T.gray800, cursor: 'pointer' }}>
                    {item.label}
                  </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ══════════ PAGE CONTEXT ROW ══════════ */}
      <div style={{ borderTop: `1px solid ${T.gray100}`, maxWidth: 1400, margin: '0 auto', padding: '0 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, height: 42 }}>

          {/* Page title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: T.gray900, fontFamily: T.fontDisplay }}>Looking For</span>
            <span style={{ fontSize: 11, color: T.gray400 }}>·</span>
            <span style={{ fontSize: 12, color: T.gray600 }}>Buyers searching for products, services &amp; opportunities</span>
          </div>

          <div style={{ flex: 1 }} />

          {/* Location chip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: T.green, display: 'flex' }}>{Icon.pin(12)}</span>
            <span style={{ fontSize: 12, color: T.gray600 }}>Showing in</span>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.gray900 }}>
              {detectingViewer ? 'Detecting…' : (viewerCity || 'All cities')}
            </span>

            {!cityEditOpen && (
              <button onClick={() => { setCityEditInput(viewerCity || ''); setCityEditOpen(true) }} style={{ background: 'none', border: 'none', fontSize: 12, color: T.green, fontWeight: 700, cursor: 'pointer', padding: 0 }}>
                Change
              </button>
            )}

            {cityEditOpen && (
              <div style={{ display: 'flex', gap: 6, position: 'relative' }}>
                <input
                  autoFocus
                  value={cityEditInput}
                  placeholder="Type city…"
                  style={{ fontSize: 12, padding: '4px 10px', border: `1.5px solid ${T.green}`, borderRadius: 8, outline: 'none', width: 130 }}
                  onChange={e => {
                    const v = e.target.value
                    setCityEditInput(v)
                    setCityEditSuggs(v.trim() ? dbCities.filter(c => c.toLowerCase().includes(v.toLowerCase())).slice(0, 5) : [])
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && cityEditInput.trim()) commitCity()
                    if (e.key === 'Escape') setCityEditOpen(false)
                  }}
                />
                {cityEditSuggs.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, background: T.white, border: `1px solid ${T.gray200}`, borderRadius: 12, zIndex: 300, boxShadow: T.shadowLg, marginTop: 2, minWidth: 160 }}>
                    {cityEditSuggs.map(c => (
                      <div key={c} onClick={() => commitCity(c)} style={{ padding: '8px 14px', fontSize: 13, cursor: 'pointer', borderBottom: `1px solid ${T.gray100}`, color: T.gray900 }}>
                        {c}
                      </div>
                    ))}
                  </div>
                )}
                <button onClick={() => commitCity()} style={{ background: T.green, color: '#fff', border: 'none', borderRadius: 8, padding: '4px 10px', fontSize: 11, fontWeight: 700, cursor: 'pointer' }}>
                  {Icon.check(13)}
                </button>
                <button onClick={() => setCityEditOpen(false)} style={{ background: 'none', border: 'none', color: T.gray400, cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                  {Icon.x(13)}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}

function NavIconBtn({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 12, color: T.gray800, fontSize: 10, fontWeight: 600, transition: 'background 0.15s', flexShrink: 0 }}
      onMouseEnter={e => e.currentTarget.style.background = T.gray100}
      onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >
      {icon}
      <span>{label}</span>
    </button>
  )
}

// ── Extra icons needed beyond Icons.jsx ──
Icon.search = (s = 16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
Icon.chat   = (s = 18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>