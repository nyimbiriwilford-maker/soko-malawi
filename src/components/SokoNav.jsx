/**
 * Shared top navigation (Home + Looking For + other marketplace pages).
 * Desktop + mobile layout. Only the primary CTA differs per page.
 */
import { useState, useRef, useEffect } from 'react'
import {
  Image as ImageIcon,
  Wrench,
  Search,
  ChevronRight,
  Clock,
  ShoppingBag,
  Store,
  UsersRound,
  BadgeCheck,
  ShieldCheck,
  MessageCircle,
  Bell,
  Plus,
  ChevronDown,
} from 'lucide-react'

import { T } from '../constants/tokens'
import { MALAWI_DISTRICTS } from '../constants/malawiDistricts'
import { supabase } from '../lib/supabase'
import SearchBox from './SearchBox'

const VerificationDesktopIcon = BadgeCheck || ShieldCheck

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
  sliders: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <line x1="21" y1="4" x2="14" y2="4" /><line x1="10" y1="4" x2="3" y2="4" />
      <line x1="21" y1="12" x2="12" y2="12" /><line x1="8" y1="12" x2="3" y2="12" />
      <line x1="21" y1="20" x2="16" y2="20" /><line x1="12" y1="20" x2="3" y2="20" />
      <line x1="14" y1="2" x2="14" y2="6" /><line x1="8" y1="10" x2="8" y2="14" /><line x1="16" y1="18" x2="16" y2="22" />
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
    desktopIcon: ShoppingBag,
  },
  { key: 'shops', label: 'Shops', path: '/shops', icon: Icon.shop, desktopIcon: Store },
  {
    key: 'lookingfor', label: 'People Looking For', path: '/looking-for',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="8" r="4" /><path d="M4 21v-1a8 8 0 0 1 16 0v1" />
      </svg>
    ),
    mobileIcon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
        <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.2" fill="currentColor" />
      </svg>
    ),
    desktopIcon: UsersRound,
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
    desktopIcon: Wrench,
  },
  {
    key: 'stories', label: 'Statuses', path: '/status',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
      </svg>
    ),
    desktopIcon: Clock,
  },
  {
    key: 'verify', label: 'Verification', path: '/profile',
    icon: (s) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /><polyline points="9 12 11 14 15 10" />
      </svg>
    ),
    desktopIcon: VerificationDesktopIcon,
  },
]

function NavIconBtn({ icon, label, onClick, desktopIcon }) {
  return (
    <button
      type="button"
      className="soko-action-btn"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 12, color: T.gray800, fontSize: 10, fontWeight: 600, transition: 'background 0.15s', fontFamily: 'inherit' }}
      onMouseEnter={e => { e.currentTarget.style.background = T.gray100 }}
      onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
    >
      <span className="soko-legacy-nav-icon">{icon}</span>
      {desktopIcon && <span className="soko-desktop-nav-icon">{desktopIcon}</span>}
      <span className="soko-action-label">{label}</span>
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
  onLaptopSearch,
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
  const [isGuest, setIsGuest] = useState(false)
  const [chatCount, setChatCount] = useState(0)
  const [headerSearchOpen, setHeaderSearchOpen] = useState(false)
  const [laptopSearch, setLaptopSearch] = useState(search)
  const [wideDesktop, setWideDesktop] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1100px)').matches)
  const [scrolled, setScrolled] = useState(false)
  const postRef = useRef(null)

  useEffect(() => {
    const query = window.matchMedia('(min-width: 1100px)')
    const update = () => setWideDesktop(query.matches)
    update()
    if (query.addEventListener) query.addEventListener('change', update)
    else query.addListener(update)
    return () => {
      if (query.removeEventListener) query.removeEventListener('change', update)
      else query.removeListener(update)
    }
  }, [])

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [])

  useEffect(() => {
    let channel
    let cancelled = false
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { if (!cancelled) setIsGuest(true); return } if (cancelled) return

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

  function commitLaptopSearch(val) {
    setLaptopSearch(val)
    if (onLaptopSearch) onLaptopSearch(val)
    else navigate(`/search?q=${encodeURIComponent(val)}`)
  }

  function handleCta() {
    setShowPostMenu(m => !m)
  }

  const POST_ITEMS = [
    { label: 'Listing', desc: 'Sell a product or item', path: '/post', icon: <ImageIcon size={20} strokeWidth={1.85} /> },
    { label: 'Looking For', desc: 'Post what you need · get offers', path: '/looking-for', state: { openComposer: true }, icon: <Search size={20} strokeWidth={1.85} /> },
    { label: 'Service', desc: 'Offer your skills', path: '/services?tab=post', icon: <Wrench size={20} strokeWidth={1.85} /> },
    { label: 'Status', desc: 'Share a quick update', path: '/status?compose=1', status: true, icon: <Clock size={20} strokeWidth={1.75} /> },
  ]

 function changeDistrict(d) {
  onDistrictChange?.(d)
  setDistOpen(false)
}

  return (
    <nav className={`soko-nav-glass${scrolled ? ' is-scrolled' : ''}`} style={headerSearchOpen ? { zIndex: 1300 } : undefined}>
      <style>{`
        .soko-nav-glass {
          position: sticky; top: 0; z-index: 100;
          backdrop-filter: blur(20px) saturate(1.8);
          -webkit-backdrop-filter: blur(20px) saturate(1.8);
          background: rgba(255,255,255,.92);
           border-bottom: 1px solid #eef0f2;
           box-shadow: none;
        }
        .soko-nav-mobile { display: none; }
        .soko-scroll { scrollbar-width: none; }
        .soko-scroll::-webkit-scrollbar { display: none; }
        .soko-quick-scroll { scrollbar-width: none; }
        .soko-quick-scroll::-webkit-scrollbar { display: none; }
        @keyframes sokoBadgeIn {
          from { transform: scale(0.4); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        .soko-post-item { position: relative; }
        .soko-post-item.is-status { border: 1px solid rgba(15,157,88,0.14); border-radius: 10px; }
        .soko-desktop-nav-icon, .soko-avatar-caret, .soko-pillar-icon, .soko-desktop-plus, .soko-desktop-cta-label { display: none !important; }
        @media (max-width: 768px) {
          .soko-nav-mobile {
            display: flex !important;
            flex-direction: column !important;
            padding: 10px max(16px, env(safe-area-inset-left)) 10px max(16px, env(safe-area-inset-right)) !important;
            width: 100% !important;
            gap: 10px !important;
            box-sizing: border-box !important;
            position: relative !important;
            overflow: hidden !important;
            background:
              radial-gradient(120% 120% at 100% -20%, rgba(15,157,88,0.10) 0%, rgba(15,157,88,0) 42%),
              radial-gradient(90% 90% at -10% 120%, rgba(249,171,0,0.07) 0%, rgba(249,171,0,0) 46%),
              linear-gradient(180deg, #ffffff 0%, #fcfdfc 100%) !important;
             border-bottom: 1px solid #eef0f2 !important;
             box-shadow: none !important;
          }
          .soko-nav-mobile::before,
          .soko-nav-mobile::after {
            content: '';
            position: absolute;
            border-radius: 50%;
            pointer-events: none;
            z-index: 0;
          }
          .soko-nav-mobile::before {
            width: 130px;
            height: 130px;
            top: -70px;
            right: -45px;
            background: radial-gradient(circle, rgba(15,157,88,0.09) 0%, rgba(15,157,88,0) 70%);
          }
          .soko-nav-mobile::after {
            width: 90px;
            height: 90px;
            bottom: -55px;
            left: -35px;
            background: radial-gradient(circle, rgba(249,171,0,0.07) 0%, rgba(249,171,0,0) 70%);
          }
          .soko-nav-mobile > * { position: relative; z-index: 1; }
          .soko-nav-mobile button:active { transform: scale(0.94); }
          .soko-nav-desktop { display: none !important; }
          .soko-pillar-row { display: none !important; }
        }
        @media (max-width: 360px) {
          .soko-nav-mobile { padding-left: 12px !important; padding-right: 12px !important; gap: 9px !important; }
          .soko-nav-mobile button[aria-label="Search"],
          .soko-nav-mobile button[aria-label="Notifications"],
          .soko-nav-mobile button[aria-label="My Profile"] { width: 38px; height: 38px; }
        }
        @media (min-width: 769px) {
          .soko-nav-mobile { display: none !important; }
        }
        .hs-search-laptop { display: none !important; }
        @media (min-width: 769px) {
          .hs-search-tablet { display: none !important; }
          .hs-search-laptop { display: block !important; }
        }
        @media (min-width: 1100px) {
          .soko-nav-glass {
            position: sticky; top: 0; z-index: 1100;
            background: #ffffff !important;
            backdrop-filter: none;
            -webkit-backdrop-filter: none;
            border-bottom: 1px solid #e8eaed;
            box-shadow: none;
          }
          .soko-nav-glass.is-scrolled { box-shadow: 0 2px 12px rgba(32,33,36,0.10); }
          .soko-nav-main-row {
            display: grid !important;
            grid-template-columns: minmax(180px, 1fr) minmax(320px, 640px) minmax(220px, 1fr) !important;
            align-items: center !important;
            gap: 24px !important;
            height: 64px !important;
            min-height: 64px !important;
            max-width: 1400px !important;
            margin: 0 auto !important;
            padding: 0 24px !important;
            box-sizing: border-box !important;
          }
          .soko-nav-brand { justify-self: start !important; }
          .soko-nav-tagline { display: none !important; }
          .hs-search-laptop { display: block !important; flex: none !important; width: 100% !important; max-width: 640px !important; min-width: 0 !important; justify-self: center !important; }
          .soko-nav-actions { display: flex !important; align-items: center !important; justify-content: flex-end !important; gap: 12px !important; flex: none !important; justify-self: end !important; }
          .soko-nav-actions .soko-action-btn { width: 40px !important; height: 40px !important; padding: 0 !important; gap: 0 !important; border-radius: 10px !important; color: #5f6368 !important; background: transparent !important; }
          .soko-nav-actions .soko-action-btn:hover { background: #f1f3f4 !important; }
          .soko-nav-actions .soko-legacy-nav-icon, .soko-nav-actions .soko-action-label { display: none !important; }
          .soko-nav-actions .soko-desktop-nav-icon { display: flex !important; align-items: center !important; justify-content: center !important; color: inherit !important; }
          .soko-nav-actions .soko-desktop-nav-icon svg { width: 22px !important; height: 22px !important; stroke-width: 1.75 !important; }
          .soko-icon-wrap { position: relative !important; display: inline-flex !important; }
          .soko-icon-wrap .soko-nav-badge { top: 0 !important; right: 0 !important; min-width: 18px !important; width: auto !important; height: 18px !important; padding: 0 3px !important; font-size: 10px !important; }
          .soko-cta-btn { height: 40px !important; padding: 0 16px !important; gap: 8px !important; border-radius: 999px !important; font-size: 14px !important; font-weight: 700 !important; }
          .soko-cta-btn .soko-legacy-plus, .soko-cta-btn .soko-legacy-cta-label { display: none !important; }
          .soko-cta-btn .soko-desktop-plus { display: flex !important; align-items: center !important; justify-content: center !important; }
          .soko-cta-btn .soko-desktop-plus svg { width: 18px !important; height: 18px !important; stroke-width: 1.75 !important; }
          .soko-cta-btn .soko-desktop-cta-label { display: inline !important; font-size: 14px !important; }
          .soko-avatar-wrap { position: relative !important; display: inline-flex !important; align-items: center !important; }
          .soko-nav-actions .soko-avatar-btn { width: 36px !important; height: 36px !important; border: 1px solid #e8eaed !important; box-shadow: none !important; }
          .soko-avatar-caret { display: flex !important; position: absolute !important; right: -18px !important; top: 11px !important; width: 14px !important; height: 14px !important; align-items: center !important; justify-content: center !important; background: transparent !important; color: #5f6368 !important; border: none !important; border-radius: 0 !important; box-shadow: none !important; opacity: 0 !important; pointer-events: none !important; transition: opacity 0.15s ease !important; }
          .soko-avatar-wrap:hover .soko-avatar-caret, .soko-avatar-wrap:focus-within .soko-avatar-caret { opacity: 1 !important; }
          .soko-avatar-caret svg { width: 14px !important; height: 14px !important; stroke-width: 1.75 !important; }
          .soko-desktop-popover { border: 1px solid #e8eaed !important; border-radius: 14px !important; box-shadow: 0 12px 32px rgba(32,33,36,0.14) !important; background: #fff !important; }
          .soko-pillar-row.soko-nav-desktop { height: 44px !important; border-top: 1px solid #e8eaed !important; box-sizing: border-box !important; }
          .soko-pillar-row.soko-nav-desktop > div { height: 44px !important; max-width: 1400px !important; margin: 0 auto !important; padding: 0 24px !important; box-sizing: border-box !important; }
          .soko-pillar-btn { height: 44px !important; padding: 0 14px !important; gap: 8px !important; border-bottom: 2px solid transparent !important; font-family: 'DM Sans', 'Inter', system-ui, sans-serif !important; font-size: 14px !important; font-weight: 500 !important; color: #5f6368 !important; white-space: nowrap !important; }
          .soko-pillar-btn:hover { background: #f6fbf8 !important; }
          .soko-pillar-btn.is-active { color: #0F9D58 !important; border-bottom-color: #0F9D58 !important; font-weight: 700 !important; }
          .soko-pillar-btn .soko-pillar-legacy-icon { display: none !important; }
          .soko-pillar-btn .soko-pillar-icon { display: flex !important; align-items: center !important; justify-content: center !important; color: inherit !important; }
          .soko-pillar-btn .soko-pillar-icon svg { width: 18px !important; height: 18px !important; stroke-width: 1.75 !important; }
        }
      `}</style>

      {/* ════════════════════ DESKTOP LAYOUT ════════════════════ */}
      <div className="soko-nav-desktop soko-nav-main-row" style={{
        maxWidth: 1400, margin: '0 auto', padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 14, minHeight: 70,
      }}>

        {/* Brand */}
        <div className="soko-nav-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer', flexShrink: 0, userSelect: 'none' }}>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 800, color: T.green, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            Soko<span style={{ color: T.amber }}>Mw</span>
          </div>
          <div className="soko-nav-tagline" style={{ fontSize: 10.5, color: T.gray600, fontWeight: 500, whiteSpace: 'nowrap' }}>
            Buy. Sell. Find. Anywhere in Malawi.
          </div>
        </div>

        {/* Desktop Search */}
        <div className="hs-search-tablet" style={{ flex: 1, minWidth: 0, display: 'flex' }}>
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', background: focused ? '#fff' : T.gray100, border: `1.5px solid ${focused ? T.green : 'transparent'}`, borderRadius: 50, padding: '4px 4px 4px 14px', transition: 'border-color 0.2s, background 0.2s', boxShadow: focused ? '0 0 0 3px rgba(15,157,88,0.10)' : 'none', minHeight: 42 }}>
            <span style={{ color: T.gray600, flexShrink: 0, display: 'flex', alignItems: 'center', marginRight: 8 }}>{Icon.search(15)}</span>
            <input ref={inputRef} value={search}
              onChange={e => { const val = e.target.value; setSearch?.(val); navigate(`/search?q=${encodeURIComponent(val)}&focus=1`) }}
              onFocus={() => { setFocused(true); navigate('/search?focus=1') }}
              onBlur={() => setFocused(false)}
              onKeyDown={handleKey}
              placeholder="Search for anything (e.g. iPhone, Toyota, services...)"
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
        </div>
        <div className="hs-search-laptop" style={{ flex: 1, minWidth: 0 }}>
          <SearchBox
            value={laptopSearch}
            onChange={setLaptopSearch}
            onSubmit={commitLaptopSearch}
            onSelect={commitLaptopSearch}
            onFocusChange={setHeaderSearchOpen}
            navigate={navigate}
            user={user}
            desktopSearch={wideDesktop}
            placeholder={wideDesktop ? 'Search products, services, shops' : 'Search for anything (e.g. iPhone, Toyota, services...)'}
          />
        </div>

        {/* Desktop Action Icons */}
        <div className="soko-nav-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {isGuest ? (
            <>
              <button type="button" onClick={() => navigate('/login')}
                style={{ height: 38, padding: '0 18px', fontSize: 13.5, fontWeight: 700, background: '#fff', color: T.green, border: `1.5px solid ${T.green}`, borderRadius: 50, cursor: 'pointer', fontFamily: 'inherit' }}>
                Log in
              </button>
              <button type="button" onClick={() => navigate('/login')}
                style={{ height: 38, padding: '0 18px', fontSize: 13.5, fontWeight: 700, background: '#0F9D58', color: '#fff', border: 'none', borderRadius: 50, cursor: 'pointer', fontFamily: 'inherit' }}>
                Sign up
              </button>
            </>
          ) : (
            <>
          <div className="soko-icon-wrap" style={{ position: 'relative' }}>
            <NavIconBtn icon={Icon.chat(18)} label="Chats" onClick={() => navigate('/chats')} desktopIcon={<MessageCircle size={22} strokeWidth={1.75} />} />
            {chatCount > 0 && (
              <span className="soko-nav-badge" style={{ position: 'absolute', top: 4, right: 6, background: T.red, color: '#fff', borderRadius: '50%', width: 17, height: 17, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                {chatCount > 9 ? '9+' : chatCount}
              </span>
            )}
          </div>
          <div className="soko-icon-wrap" style={{ position: 'relative' }}>
            <NavIconBtn icon={Icon.bell(18)} label="Alerts" onClick={() => navigate('/notifications')} desktopIcon={<Bell size={22} strokeWidth={1.75} />} />
            {notifCount > 0 && (
              <span className="soko-nav-badge" style={{ position: 'absolute', top: 4, right: 6, background: T.red, color: '#fff', borderRadius: '50%', width: 17, height: 17, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff' }}>
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </div>
          {!hideCta && (
            <div ref={postRef} style={{ position: 'relative' }}>
              <button type="button" className="soko-cta-btn" onClick={handleCta}
                style={{ height: 38, padding: '0 18px', fontSize: 13.5, fontWeight: 700, background: T.green, color: '#fff', border: 'none', borderRadius: 50, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', fontFamily: 'inherit', transition: 'opacity 0.15s', opacity: showPostMenu ? 0.85 : 1 }}>
                <span className="soko-legacy-plus">{Icon.plus(14)}</span>
                <span className="soko-desktop-plus"><Plus size={18} strokeWidth={1.75} /></span>
                <span className="soko-legacy-cta-label">Post Now</span>
                <span className="soko-desktop-cta-label">Post</span>
              </button>
              {showPostMenu && (
                <div className="soko-desktop-popover" style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, background: T.white, borderRadius: 16, padding: '6px 0', boxShadow: T.shadowLg, minWidth: 240, border: `1px solid ${T.gray200}`, zIndex: 300, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px 6px' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: T.gray400, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Create</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: T.gray900, marginTop: 2 }}>What do you want to post?</div>
                  </div>
                  {POST_ITEMS.map((item, i) => (
                    <button key={i} type="button" role="menuitem"
                      className={`soko-post-item${item.status ? ' is-status' : ''}`}
                      onClick={() => { setShowPostMenu(false); navigate(item.path, item.state ? { state: item.state } : undefined) }}
                      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 16px', border: 'none', background: item.status ? 'linear-gradient(120deg, rgba(15,157,88,0.06), rgba(249,171,0,0.05))' : 'none', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.12s' }}
                      onMouseEnter={e => e.currentTarget.style.background = item.status ? 'linear-gradient(120deg, rgba(15,157,88,0.10), rgba(249,171,0,0.08))' : T.gray100}
                      onMouseLeave={e => e.currentTarget.style.background = item.status ? 'linear-gradient(120deg, rgba(15,157,88,0.06), rgba(249,171,0,0.05))' : 'none'}>
                      {item.status ? (
                        <span className="soko-status-ring" aria-hidden="true" style={{ width: 40, height: 40, borderRadius: '50%', padding: 2, background: 'linear-gradient(135deg, #0F9D58 0%, #22a05e 55%, #0a7a44 100%)', boxShadow: '0 2px 8px rgba(15,157,88,0.22)', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                          <span style={{ width: '100%', height: '100%', borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0F9D58' }}>
                            {item.icon}
                          </span>
                        </span>
                      ) : (
                        <span style={{ width: 36, height: 36, borderRadius: 10, background: T.gray100, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: T.green }}>
                          {item.icon}
                        </span>
                      )}
                      <span style={{ flex: 1 }}>
                        <strong style={{ fontSize: 14, fontWeight: 600, color: item.status ? '#0a7a44' : T.gray900, display: 'block' }}>
                          {item.label}
                        </strong>
                        <span style={{ fontSize: 12, color: T.gray500, display: 'block', marginTop: 1 }}>{item.desc}</span>
                      </span>
                      <ChevronRight size={16} strokeWidth={2.2} style={{ color: item.status ? T.green : T.gray400, flexShrink: 0 }} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          <div className="soko-avatar-wrap" style={{ position: 'relative' }}>
            <button type="button" className="soko-avatar-btn" aria-label="Account menu" onClick={() => setAvatarOpen(o => !o)}
              style={{ width: 38, height: 38, borderRadius: '50%', background: user?.avatar_url ? 'transparent' : `linear-gradient(135deg, ${T.green}, ${T.greenD})`, border: `2px solid ${T.green}`, cursor: 'pointer', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0, padding: 0 }}>
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (user?.email?.[0] || user?.full_name?.[0] || 'S').toUpperCase()}
            </button>
            <span className="soko-avatar-caret" aria-hidden="true"><ChevronDown size={14} strokeWidth={1.75} /></span>
            {avatarOpen && (
              <div className="soko-desktop-popover" style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, background: T.white, borderRadius: 16, padding: '8px 0', boxShadow: T.shadowLg, minWidth: 190, border: `1px solid ${T.gray200}`, zIndex: 200 }}>
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
            </>
          )}
        </div>

      </div>
      {/* ════════════════════ END DESKTOP LAYOUT ════════════════════ */}

      {/* ════════════════════ MOBILE HEADER ════════════════════ */}
      <div className="soko-nav-mobile">

        {/* Row 1: Logo + Search icon + Notification Bell + Profile */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>

          {/* Logo */}
          <div onClick={() => navigate('/')} style={{ cursor: 'pointer', userSelect: 'none', display: 'flex', alignItems: 'center', height: 40 }}>
            <span style={{ fontFamily: T.fontDisplay, fontSize: 23, fontWeight: 800, color: T.green, letterSpacing: '-0.55px', lineHeight: 1, whiteSpace: 'nowrap' }}>
              Soko<span style={{ color: T.amber }}>Mw</span>
            </span>
          </div>

          {/* Right side: Search + Notification Bell + Profile */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

            {/* Search icon button */}
            <button
              type="button"
              onClick={() => navigate('/search?focus=1')}
              aria-label="Search"
              style={{
                width: 40, height: 40, padding: 0,
                background: 'none', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#334155', flexShrink: 0,
                transition: 'transform 0.14s, color 0.14s',
                WebkitTapHighlightColor: 'transparent',
              }}>
              {Icon.search(20)}
            </button>

            {isGuest ? (
              <button type="button" onClick={() => navigate('/login')}
                style={{ height: 36, borderRadius: 50, padding: '0 14px', fontWeight: 700, fontSize: 13, background: '#0F9D58', color: '#fff', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
                Log in
              </button>
            ) : (
              <>
            {/* Notification Bell */}
            <button
              type="button"
              onClick={() => navigate('/notifications')}
              aria-label="Notifications"
              style={{
                width: 40, height: 40, padding: 0,
                background: 'none', border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: '#334155', flexShrink: 0,
                position: 'relative',
                transition: 'transform 0.14s, color 0.14s',
                WebkitTapHighlightColor: 'transparent',
              }}>
              {Icon.bell(20)}
              {notifCount > 0 && (
                <span style={{
                  position: 'absolute', top: 4, right: 4,
                  background: T.red, color: '#fff',
                  borderRadius: '50%', minWidth: 17, height: 17,
                  fontSize: 9.5, fontWeight: 800,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  border: '2px solid #fff', padding: '0 3px',
                  lineHeight: 1,
                  boxShadow: '0 1px 4px rgba(234,67,53,0.35)',
                  animation: 'sokoBadgeIn 0.22s cubic-bezier(0.34,1.4,0.64,1) both',
                }}>
                  {notifCount > 9 ? '9+' : notifCount}
                </span>
              )}
            </button>

            {/* Profile / Account */}
            <button
              type="button"
              onClick={() => navigate('/profile')}
              aria-label="My Profile"
              style={{
                width: 40, height: 40, borderRadius: 14, padding: 0,
                background: user?.avatar_url ? 'transparent' : 'linear-gradient(135deg, #0F9D58, #0a7a44)',
                border: '2px solid rgba(15,157,88,0.35)', overflow: 'hidden',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#fff', fontSize: 15, fontWeight: 800, flexShrink: 0,
                cursor: 'pointer',
                transition: 'transform 0.14s, box-shadow 0.14s',
                boxShadow: '0 2px 8px rgba(15,157,88,0.22)',
                WebkitTapHighlightColor: 'transparent',
              }}>
              {user?.avatar_url
                ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (user?.email?.[0] || user?.full_name?.[0] || 'S').toUpperCase()}
            </button>
              </>
            )}

          </div>
        </div>

        {/* Row 2: Smart quick actions (plain icons, mobile) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '2px 0' }}>
          {SOKO_PILLARS.filter(p => p.key !== 'verify').map(p => {
            const isActive = p.key === activePillar
            return (
              <button
                key={p.key}
                type="button"
                aria-label={p.label}
                onClick={() => navigate(p.path)}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 40, height: 40,
                  padding: 0,
                  background: 'none', border: 'none',
                  cursor: 'pointer',
                  color: isActive ? T.green : '#64748b',
                  fontFamily: 'inherit',
                  transition: 'transform 0.14s, color 0.14s',
                  WebkitTapHighlightColor: 'transparent',
                }}>
                {p.mobileIcon ? p.mobileIcon(isActive ? 21 : 19) : p.icon(isActive ? 20 : 19)}
              </button>
            )
          })}
        </div>

      </div>
      {/* ════════════════════ END MOBILE HEADER ════════════════════ */}

      {/* Desktop Pillar Navigation Row */}
      <div className="soko-pillar-row soko-nav-desktop" style={{ borderTop: `1px solid ${T.gray100}` }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 0 }}>
          {SOKO_PILLARS.map(p => {
            const isActive = p.key === activePillar
            return (
              <button key={p.key} type="button" className={`soko-pillar-btn${isActive ? ' is-active' : ''}`} onClick={() => navigate(p.path)}
                style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'none', border: 'none', borderBottom: isActive ? `2.5px solid ${T.green}` : '2.5px solid transparent', cursor: 'pointer', fontSize: 13.5, fontWeight: isActive ? 700 : 500, color: isActive ? T.green : T.gray800, whiteSpace: 'nowrap', fontFamily: 'inherit' }}>
                <span className="soko-pillar-legacy-icon" style={{ color: isActive ? T.green : T.gray600, display: 'flex' }}>{p.icon(15)}</span>
                {p.desktopIcon && <span className="soko-pillar-icon"><p.desktopIcon size={18} strokeWidth={1.75} /></span>}
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

    </nav>
  )
}
