/**
 * Shared top navigation (Home + Looking For + other marketplace pages).
 * Desktop + mobile layout. Only the primary CTA differs per page.
 */
import { useState, useRef, useEffect } from 'react'
import { Image as ImageIcon, Wrench, Search, ChevronRight } from 'lucide-react'
import { T } from '../constants/tokens'
import { MALAWI_DISTRICTS } from '../constants/malawiDistricts'
import { supabase } from '../lib/supabase'

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

const SOKO_PILLARS = [
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
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 12, color: T.gray800, fontSize: 10, fontWeight: 600, transition: 'background 0.15s', fontFamily: 'inherit' }}
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
  const [showPostMenu, setShowPostMenu] = useState(false)
  const [chatCount, setChatCount] = useState(0)
  const postRef = useRef(null)

  useEffect(() => {
    let channel
    let cancelled = false
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) return

      const fetchUnread = async () => {
        const { count } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .eq('to_user', user.id)
          .eq('read', false)
        if (!cancelled) setChatCount(count || 0)
      }

      fetchUnread()

      channel = supabase
        .channel(`nav_chat_count_${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'messages',
            filter: `to_user=eq.${user.id}`,
          },
          fetchUnread,
        )
        .subscribe()
    })

    return () => {
      cancelled = true
      if (channel) supabase.removeChannel(channel)
    }
  }, [])

  useEffect(() => {
    if (!showPostMenu) return
    function onDown(e) {
      if (postRef.current && !postRef.current.contains(e.target)) setShowPostMenu(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [showPostMenu])

  const district = activeDistrict || 'All Districts'
  const fileRef = useRef(null)
  const inputRef = useRef(null)

  const districts = ['All Districts', ...MALAWI_DISTRICTS]
  const kw = animKeywords?.length > 0
    ? animKeywords[animIdx % animKeywords.length]
    : 'Samsung Galaxy A57'

  function handleKey(e) {
    if (e.key === 'Enter' && search.trim()) {
      navigate(`/search?q=${encodeURIComponent(search.trim())}`)
    }
  }

  function handleCta() {
    setShowPostMenu(m => !m)
  }

  const POST_ITEMS = [
    { label: 'Listing', desc: 'Sell a product or item', path: '/post', icon: <ImageIcon size={20} strokeWidth={1.85} /> },
    { label: 'Looking For', desc: 'Post what you need · get offers', path: '/looking-for', state: { openComposer: true }, icon: <Search size={20} strokeWidth={1.85} /> },
    { label: 'Service', desc: 'Offer your skills', path: '/services?tab=post', icon: <Wrench size={20} strokeWidth={1.85} /> },
  ]

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
          .soko-nav-mobile {
            display: flex !important;
            flex-direction: column !important;
            padding: 10px max(14px, env(safe-area-inset-left)) 10px max(14px, env(safe-area-inset-right)) !important;
            width: 100% !important;
            gap: 10px !important;
            background: #fff !important;
            box-sizing: border-box !important;
            border-bottom: 1px solid #f0f0f0 !important;
          }
          .soko-nav-desktop { display: none !important; }
          .soko-pillar-row { display: none !important; }
        }
        @media (min-width: 769px) {
          .soko-nav-mobile { display: none !important; }
        }
      `}</style>

      {/* ════════════════════ DESKTOP LAYOUT ════════════════════ */}
      <div className="soko-nav-desktop" style={{
        maxWidth: 1400, margin: '0 auto', padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 14, minHeight: 70,
      }}>

        {/* Brand */}
        <div onClick={() => navigate('/')} style={{ cursor: 'pointer', flexShrink: 0, userSelect: 'none' }}>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 800, color: T.green, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            Soko<span style={{ color: T.amber }}>Mw</span>
          </div>
          <div style={{ fontSize: 10.5, color: T.gray600, fontWeight: 500, whiteSpace: 'nowrap' }}>
            Buy. Sell. Find. Anywhere in Malawi.
          </div>
        </div>

        {/* Desktop District Filter */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <button type="button" onClick={() => setDistOpen(d => !d)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 50, background: '#fff', border: `1.5px solid ${T.gray200}`, fontSize: 13, fontWeight: 600, color: T.gray800, cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
            {Icon.pin(13)}
            <span style={{ color: district !== 'All Districts' ? T.amber : T.gray900, fontWeight: district !== 'All Districts' ? 800 : 600 }}>{district}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <polyline points="6 9 12 15 18 9" />
            </svg>
            {district !== 'All Districts' && (
              <span role="button" tabIndex={0}
                onClick={e => { e.stopPropagation(); changeDistrict('All Districts') }}
                onKeyDown={e => e.key === 'Enter' && changeDistrict('All Districts')}
                style={{ marginLeft: 2, color: T.gray400, fontSize: 11, lineHeight: 1 }}>✕</span>
            )}
          </button>
          {distOpen && (
            <div style={{ position: 'absolute', top: 'calc(100% + 8px)', left: 0, background: T.white, borderRadius: 16, padding: '8px 0', boxShadow: T.shadowLg, minWidth: 200, border: `1px solid ${T.gray200}`, zIndex: 200 }}>
              {districts.map(d => (
                <button key={d} type="button" onClick={() => changeDistrict(d)}
                  style={{ display: 'block', width: '100%', padding: '9px 16px', textAlign: 'left', background: d === district ? T.greenL : 'transparent', border: 'none', fontSize: 13.5, fontWeight: d === district ? 700 : 500, color: d === district ? T.green : T.gray800, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {d}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Desktop Search */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: focused ? '#fff' : T.gray100, border: `1.5px solid ${focused ? T.green : 'transparent'}`, borderRadius: 50, padding: '4px 4px 4px 14px', transition: 'border-color 0.2s, background 0.2s', boxShadow: focused ? '0 0 0 3px rgba(15,157,88,0.10)' : 'none', minHeight: 42 }}>
          <span style={{ color: T.gray600, flexShrink: 0, display: 'flex', alignItems: 'center', marginRight: 8 }}>{Icon.search(15)}</span>
          <input ref={inputRef} value={search}
            onChange={e => { const val = e.target.value; setSearch?.(val); navigate(`/search?q=${encodeURIComponent(val)}&focus=1`) }}
            onFocus={() => { setFocused(true); navigate('/search?focus=1') }}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKey}
            placeholder="Search for anything (e.g. iPhone, Toyota, jobs, services...)"
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13.5, color: T.gray900, outline: 'none', padding: 0, minWidth: 0, cursor: 'text', fontFamily: 'inherit' }}
          />
          {search && (
            <button type="button" onClick={() => setSearch?.('')}
              style={{ background: T.gray200, border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.gray600, flexShrink: 0, marginRight: 6 }}>
              {Icon.x(9)}
            </button>
          )}
          <button type="button" onClick={() => { if (search.trim()) navigate(`/search?q=${encodeURIComponent(search.trim())}`) }}
            style={{ flexShrink: 0, background: T.green, color: '#fff', border: 'none', borderRadius: 50, height: 34, padding: '0 20px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            Search
          </button>
          
        </div>

        {/* Desktop Action Icons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <NavIconBtn icon={Icon.chat(18)} label="Chats" onClick={() => navigate('/chats')} />
            {chatCount > 0 && (
              <span style={{ position: 'absolute', top: 4, right: 6, background: T.red, color: '#fff', borderRadius: '50%', width: 17, height: 17, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                {chatCount > 9 ? '9+' : chatCount}
              </span>
            )}
          </div>
          <div style={{ position: 'relative' }}>
            <NavIconBtn icon={Icon.bell(18)} label="Alerts" onClick={() => navigate('/notifications')} />
            {notifCount > 0 && (
              <span style={{ position: 'absolute', top: 4, right: 6, background: T.red, color: '#fff', borderRadius: '50%', width: 17, height: 17, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </div>
          {!hideCta && (
            <div ref={postRef} style={{ position: 'relative' }}>
              <button type="button" onClick={handleCta}
                style={{ height: 38, padding: '0 18px', fontSize: 13.5, fontWeight: 700, background: T.green, color: '#fff', border: 'none', borderRadius: 50, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'opacity 0.15s', opacity: showPostMenu ? 0.85 : 1 }}>
                {Icon.plus(14)} Post Now
              </button>
              {showPostMenu && (
                <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: T.white, borderRadius: 16, padding: '6px 0', boxShadow: T.shadowLg, minWidth: 240, border: `1px solid ${T.gray200}`, zIndex: 300, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px 6px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Create</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.gray900, marginTop: 2 }}>What do you want to post?</div>
                  </div>
                  {POST_ITEMS.map((item, i) => (
                    <button key={i} type="button" role="menuitem" onClick={() => { setShowPostMenu(false); navigate(item.path, item.state ? { state: item.state } : undefined) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 16px', border: 'none', background: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = T.gray100}
                      onMouseLeave={e => e.currentTarget.style.background = 'none'}>
                      <span style={{ width: 36, height: 36, borderRadius: 10, background: T.gray100, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: T.green }}>
                        {item.icon}
                      </span>
                      <span style={{ flex: 1 }}>
                        <strong style={{ fontSize: 14, fontWeight: 600, color: T.gray900, display: 'block' }}>{item.label}</strong>
                        <span style={{ fontSize: 12, color: T.gray500, display: 'block', marginTop: 1 }}>{item.desc}</span>
                      </span>
                      <ChevronRight size={16} strokeWidth={2.2} style={{ color: T.gray400, flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div style={{ position: 'relative' }}>
            <button type="button" onClick={() => setAvatarOpen(o => !o)}
              style={{ width: 38, height: 38, borderRadius: '50%', background: user?.avatar_url ? 'transparent' : `linear-gradient(135deg, ${T.green}, ${T.greenD})`, border: `2px solid ${T.green}`, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0, padding: 0 }}>
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (user?.email?.[0] || user?.full_name?.[0] || 'S').toUpperCase()}
            </button>
            {avatarOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, background: T.white, borderRadius: 16, padding: '8px 0', boxShadow: T.shadowLg, minWidth: 190, border: `1px solid ${T.gray200}`, zIndex: 200 }}>
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
                    <button key={i} type="button" onClick={() => { navigate(item.path); setAvatarOpen(false) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 16px', textAlign: 'left', background: 'transparent', border: 'none', fontSize: 13.5, fontWeight: item.green ? 700 : 500, color: item.red ? T.red : item.green ? T.green : T.gray800, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {item.isShop && Icon.shop(13)}
                      {item.label}
                    </button>
                  )
                )}
              </div>
            )}
          </div>
        </div>

      </div>
      {/* ════════════════════ END DESKTOP LAYOUT ════════════════════ */}

      {/* ════════════════════ MOBILE HEADER ════════════════════ */}
      <div className="soko-nav-mobile">

        {/* Row 1: Logo + Notification Bell */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>

          {/* Logo */}
          <div onClick={() => navigate('/')} style={{ cursor: 'pointer', userSelect: 'none' }}>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 21, fontWeight: 900, color: T.green, letterSpacing: '-0.6px', lineHeight: 1 }}>
              Soko<span style={{ color: T.amber }}>Mw</span>
            </div>
            <div style={{ fontSize: 9, color: T.gray500, fontWeight: 500, letterSpacing: '0.1px', marginTop: 2, whiteSpace: 'nowrap' }}>
              Buy · Sell · Find · Anywhere in Malawi
            </div>
          </div>

          {/* Right side: Notification Bell */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              aria-label="Notifications"
              style={{
                width: 38, height: 38, borderRadius: '50%',
                background: '#f4f8f5',
                border: '1px solid #e2ebe4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#1a7a4a', flexShrink: 0,
                position: 'relative',
              }}>
              {Icon.bell(18)}
              {notifCount > 0 && (
                <span style={{
                  position: 'absolute', top: 1, right: 1,
                  background: T.red, color: '#fff',
                  borderRadius: '50%', minWidth: 17, height: 17,
                  fontSize: 9.5, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid #fff', padding: '0 3px',
                  lineHeight: 1,
                }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>

          </div>
        </div>

        {/* Row 2: Full-width Search Bar */}
        <div
          style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 10,
            background: focused ? '#fff' : '#f4f8f5',
            borderRadius: 50,
            padding: '0 15px',
            minHeight: 44,
            border: `1.5px solid ${focused ? '#1a7a4a' : '#e2ebe4'}`,
            boxShadow: focused ? `0 0 0 3px rgba(26,122,74,0.10)` : 'none',
            position: 'relative', cursor: 'pointer',
            boxSizing: 'border-box',
            transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
          }}
          onClick={() => navigate('/search?focus=1')}
        >
          <span style={{ color: focused ? '#1a7a4a' : T.gray400, flexShrink: 0, display: 'flex' }}>
            {Icon.search(17)}
          </span>
          <div style={{ flex: 1, position: 'relative', height: 24, minWidth: 0 }}>
            <input
              ref={inputRef}
              value={search}
              onChange={e => { e.stopPropagation(); const val = e.target.value; setSearch?.(val); navigate(`/search?q=${encodeURIComponent(val)}&focus=1`); }}
              onFocus={() => { setFocused(true); navigate('/search?focus=1'); }}
              onBlur={() => setFocused(false)}
              aria-label="Search marketplace"
              style={{
                position: 'absolute', inset: 0, width: '100%',
                border: 'none', background: 'transparent',
                fontSize: 14, color: T.gray900, outline: 'none',
                zIndex: search || focused ? 2 : 0, fontFamily: 'inherit',
              }}
            />
            {!search && !focused && (
              <div style={{
                position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                pointerEvents: 'none', fontSize: 13.5, color: T.gray400,
                overflow: 'hidden', whiteSpace: 'nowrap',
              }}>
                Search anything in Malawi...
              </div>
            )}
          </div>
          {search && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); setSearch?.(''); }}
              style={{
                background: T.gray200, border: 'none', borderRadius: '50%',
                width: 22, height: 22, display: 'flex', alignItems: 'center',
                justifyContent: 'center', cursor: 'pointer', color: T.gray600, flexShrink: 0,
              }}>
              {Icon.x(10)}
            </button>
          )}
        </div>

      </div>
      {/* ════════════════════ END MOBILE HEADER ════════════════════ */}

      {/* Desktop Pillar Navigation Row */}
      <div className="soko-pillar-row soko-nav-desktop" style={{ borderTop: `1px solid ${T.gray100}` }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 0 }}>
          {SOKO_PILLARS.map(p => {
            const isActive = p.key === activePillar
            return (
              <button key={p.key} type="button" onClick={() => navigate(p.path)}
                style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'none', border: 'none', borderBottom: isActive ? `2.5px solid ${T.green}` : '2.5px solid transparent', cursor: 'pointer', fontSize: 13.5, fontWeight: isActive ? 700 : 500, color: isActive ? T.green : T.gray800, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                <span style={{ color: isActive ? T.green : T.gray600, display: 'flex' }}>{p.icon(15)}</span>
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

    </nav>
  )
}
