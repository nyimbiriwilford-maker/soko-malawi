import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, useLocation } from 'react-router-dom'

/**
 * App-wide mobile bottom nav — premium glass bar:
 * Home · Explore · Sell · Chats · Profile
 * Hidden on desktop (min-width 769px).
 */
export default function BottomNav() {
  const navigate = useNavigate()
  const location = useLocation()
  const [showPostMenu, setShowPostMenu] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

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
        if (!cancelled) setUnreadCount(count || 0)
      }

      fetchUnread()

      channel = supabase
        .channel(`unread_badge_${user.id}`)
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

  const path = location.pathname

  const isHome = path === '/'
  const isExplore =
    path.startsWith('/search') ||
    path.startsWith('/listings') ||
    path.startsWith('/looking-for') ||
    path.startsWith('/shops') ||
    path.startsWith('/services') ||
    path.startsWith('/jobs')
  const isChats = path.startsWith('/chats') || path.startsWith('/chat')
  // Profile tab active only on seller dashboard, not public /profile/:id
  const isProfileTab = path === '/profile' || path === '/profile/'

  return (
    <div className={`soko-bottom-nav soko-bottom-nav-mobile${showPostMenu ? ' is-menu-open' : ''}`} id="bottom-nav">
      {showPostMenu && (
        <>
          <button
            type="button"
            className="sbn-overlay"
            onClick={() => setShowPostMenu(false)}
            aria-label="Close create menu"
          />
          <div className="sbn-post-menu" role="menu" aria-label="Create">
            <div className="sbn-post-menu-head">
              <span className="sbn-post-menu-kicker">Create</span>
              <strong>What do you want to post?</strong>
            </div>
            <button
              type="button"
              role="menuitem"
              className="sbn-post-item"
              onClick={() => {
                setShowPostMenu(false)
                navigate('/post')
              }}
            >
              <span className="sbn-post-ic sbn-post-ic-listing" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <polyline points="21 15 16 10 5 21" />
                </svg>
              </span>
              <span className="sbn-post-copy">
                <strong>Listing</strong>
                <span>Sell a product or item</span>
              </span>
              <span className="sbn-post-chev" aria-hidden="true">
                <Chevron />
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              className="sbn-post-item"
              onClick={() => {
                setShowPostMenu(false)
                navigate('/services?tab=post')
              }}
            >
              <span className="sbn-post-ic sbn-post-ic-service" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14" />
                </svg>
              </span>
              <span className="sbn-post-copy">
                <strong>Service</strong>
                <span>Offer your skills</span>
              </span>
              <span className="sbn-post-chev" aria-hidden="true">
                <Chevron />
              </span>
            </button>

            <button
              type="button"
              role="menuitem"
              className="sbn-post-item"
              onClick={() => {
                setShowPostMenu(false)
                navigate('/jobs?tab=post')
              }}
            >
              <span className="sbn-post-ic sbn-post-ic-job" aria-hidden="true">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round">
                  <rect x="2" y="7" width="20" height="14" rx="2" />
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                  <line x1="12" y1="12" x2="12" y2="16" />
                  <line x1="10" y1="14" x2="14" y2="14" />
                </svg>
              </span>
              <span className="sbn-post-copy">
                <strong>Job</strong>
                <span>Post a job opening</span>
              </span>
              <span className="sbn-post-chev" aria-hidden="true">
                <Chevron />
              </span>
            </button>
          </div>
        </>
      )}

      <nav className="sbn-bar" aria-label="Main navigation">
        <div className="sbn-bar-inner">
          <NavItem
            active={isHome}
            label="Home"
            onClick={() => navigate('/')}
            icon={<IconHome active={isHome} />}
          />
          <NavItem
            active={isExplore}
            label="Explore"
            onClick={() => navigate('/search')}
            icon={<IconExplore active={isExplore} />}
          />

          <div className="sbn-fab-wrap">
            <button
              type="button"
              className={`sbn-fab${showPostMenu ? ' is-open' : ''}`}
              onClick={() => setShowPostMenu((m) => !m)}
              aria-label="Sell or post"
              aria-expanded={showPostMenu}
            >
              <span className="sbn-fab-ring" aria-hidden="true" />
              <span className="sbn-fab-core" aria-hidden="true">
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                  className="sbn-fab-plus"
                >
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
              </span>
            </button>
            <span className="sbn-fab-label">Sell</span>
          </div>

          <NavItem
            active={isChats}
            label="Chats"
            onClick={() => navigate('/chats')}
            icon={<IconChat active={isChats} />}
            badge={unreadCount}
          />
          <NavItem
            active={isProfileTab}
            label="Profile"
            onClick={() => navigate('/profile')}
            icon={<IconProfile active={isProfileTab} />}
          />
        </div>
      </nav>

      <style>{premiumCss}</style>
    </div>
  )
}

function NavItem({ active, label, onClick, icon, badge = 0 }) {
  return (
    <button
      type="button"
      className={`sbn-item${active ? ' is-active' : ''}`}
      onClick={onClick}
      aria-current={active ? 'page' : undefined}
    >
      <span className="sbn-item-ic" aria-hidden="true">
        {icon}
        {active && <span className="sbn-item-dot" />}
      </span>
      <span className="sbn-item-label">{label}</span>
      {badge > 0 && (
        <span className="sbn-badge">{badge > 9 ? '9+' : badge}</span>
      )}
    </button>
  )
}

function Chevron() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <polyline points="9 18 15 12 9 6" />
    </svg>
  )
}

function IconHome({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9.5z" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.15 : 0} />
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
    </svg>
  )
}

function IconExplore({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="7.5" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.12 : 0} />
      <circle cx="11" cy="11" r="7.5" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function IconChat({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" fillOpacity={active ? 0.14 : 0} />
    </svg>
  )
}

function IconProfile({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="8" r="3.5" fill={active ? 'currentColor' : 'none'} fillOpacity={active ? 0.14 : 0} />
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5.5 20a6.5 6.5 0 0 1 13 0" />
    </svg>
  )
}

const premiumCss = `
  .soko-bottom-nav-mobile {
    --sbn-green: #1a7a4a;
    --sbn-green-d: #0d4a2c;
    --sbn-green-m: #22a05e;
    --sbn-muted: #8a968e;
    --sbn-ink: #0f1410;
    font-family: Inter, "DM Sans", system-ui, -apple-system, sans-serif;
    -webkit-tap-highlight-color: transparent;
  }

  .sbn-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    padding: 0 10px calc(8px + env(safe-area-inset-bottom, 0px));
    pointer-events: none;
  }

  .sbn-bar-inner {
    pointer-events: auto;
    max-width: 440px;
    margin: 0 auto;
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 2px;
    padding: 8px 10px 10px;
    border-radius: 22px 22px 18px 18px;
    background:
      linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(250,252,251,0.96) 100%);
    border: 1px solid rgba(15, 23, 42, 0.07);
    box-shadow:
      0 -1px 0 rgba(255,255,255,0.9) inset,
      0 1px 2px rgba(15, 23, 42, 0.04),
      0 12px 40px -8px rgba(6, 61, 35, 0.18),
      0 4px 16px rgba(15, 23, 42, 0.08);
    backdrop-filter: blur(20px) saturate(1.35);
    -webkit-backdrop-filter: blur(20px) saturate(1.35);
    position: relative;
  }

  .sbn-bar-inner::before {
    content: '';
    position: absolute;
    left: 18%;
    right: 18%;
    top: 0;
    height: 2px;
    border-radius: 999px;
    background: linear-gradient(90deg, transparent, #f9ab00 20%, #22a05e 55%, #0d4a2c 80%, transparent);
    opacity: 0.85;
  }

  .sbn-item {
    flex: 1 1 0;
    min-width: 0;
    max-width: 76px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 6px 4px 4px;
    border-radius: 14px;
    color: var(--sbn-muted);
    position: relative;
    transition: color 0.18s ease, background 0.18s ease, transform 0.12s ease;
  }

  .sbn-item:active { transform: scale(0.94); }

  .sbn-item.is-active {
    color: var(--sbn-green);
    background: linear-gradient(180deg, rgba(15, 157, 88, 0.12), rgba(15, 157, 88, 0.04));
  }

  .sbn-item-ic {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
  }

  .sbn-item-dot {
    position: absolute;
    bottom: -2px;
    left: 50%;
    transform: translateX(-50%);
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: var(--sbn-green);
    box-shadow: 0 0 0 2px rgba(15, 157, 88, 0.2);
  }

  .sbn-item-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.01em;
    line-height: 1.1;
    white-space: nowrap;
  }

  .sbn-item.is-active .sbn-item-label {
    font-weight: 800;
    color: var(--sbn-green-d);
  }

  .sbn-badge {
    position: absolute;
    top: 2px;
    right: calc(50% - 18px);
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: 999px;
    background: linear-gradient(145deg, #ef4444, #dc2626);
    color: #fff;
    font-size: 9px;
    font-weight: 800;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(220, 38, 38, 0.4);
    border: 1.5px solid #fff;
  }

  /* Sell FAB */
  .sbn-fab-wrap {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    margin: 0 2px;
    margin-top: -22px;
    z-index: 2;
  }

  .sbn-fab {
    position: relative;
    width: 56px;
    height: 56px;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 0;
    display: grid;
    place-items: center;
  }

  .sbn-fab-ring {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: linear-gradient(145deg, #f9ab00, #22a05e 45%, #0d4a2c);
    box-shadow:
      0 6px 20px rgba(26, 122, 74, 0.45),
      0 2px 6px rgba(15, 23, 42, 0.12);
  }

  .sbn-fab-core {
    position: relative;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: linear-gradient(155deg, #22a05e 0%, #1a7a4a 48%, #0d4a2c 100%);
    border: 2px solid rgba(255, 255, 255, 0.25);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.25);
    transition: transform 0.22s cubic-bezier(0.34, 1.2, 0.64, 1);
  }

  .sbn-fab:active .sbn-fab-core { transform: scale(0.94); }
  .sbn-fab.is-open .sbn-fab-core {
    background: linear-gradient(155deg, #0d4a2c, #1a7a4a);
  }
  .sbn-fab.is-open .sbn-fab-plus {
    transform: rotate(45deg);
  }
  .sbn-fab-plus {
    transition: transform 0.25s cubic-bezier(0.34, 1.2, 0.64, 1);
  }

  .sbn-fab-label {
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.02em;
    color: var(--sbn-green-d);
    line-height: 1;
  }

  /* Create menu */
  .sbn-overlay {
    position: fixed;
    inset: 0;
    z-index: 98;
    border: none;
    padding: 0;
    margin: 0;
    background: rgba(8, 16, 12, 0.42);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    cursor: pointer;
    animation: sbnFade 0.18s ease both;
  }

  .sbn-post-menu {
    position: fixed;
    bottom: calc(88px + env(safe-area-inset-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    width: min(360px, calc(100vw - 28px));
    z-index: 99;
    background: #fff;
    border-radius: 22px;
    padding: 10px 10px 12px;
    border: 1px solid rgba(15, 23, 42, 0.07);
    box-shadow:
      0 20px 50px -12px rgba(6, 61, 35, 0.28),
      0 8px 24px rgba(15, 23, 42, 0.1);
    animation: sbnSlide 0.24s cubic-bezier(0.34, 1.15, 0.64, 1) both;
  }

  .sbn-post-menu-head {
    padding: 10px 12px 12px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sbn-post-menu-kicker {
    font-size: 0.65rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--sbn-green);
  }
  .sbn-post-menu-head strong {
    font-size: 1rem;
    font-weight: 800;
    color: var(--sbn-ink);
    letter-spacing: -0.02em;
  }

  .sbn-post-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: none;
    background: #f7faf8;
    border-radius: 16px;
    cursor: pointer;
    text-align: left;
    font: inherit;
    margin-bottom: 8px;
    transition: background 0.15s ease, transform 0.12s ease;
  }
  .sbn-post-item:last-child { margin-bottom: 0; }
  .sbn-post-item:hover { background: #eef6f1; }
  .sbn-post-item:active { transform: scale(0.985); }

  .sbn-post-ic {
    width: 46px;
    height: 46px;
    border-radius: 14px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  .sbn-post-ic-listing { background: linear-gradient(145deg, #e6f7ee, #c8ebd6); color: #0d4a2c; }
  .sbn-post-ic-service { background: linear-gradient(145deg, #fef3c7, #fde68a); color: #b45309; }
  .sbn-post-ic-job { background: linear-gradient(145deg, #dbeafe, #bfdbfe); color: #1d4ed8; }

  .sbn-post-copy {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .sbn-post-copy strong {
    font-size: 0.95rem;
    font-weight: 800;
    color: var(--sbn-ink);
    letter-spacing: -0.01em;
  }
  .sbn-post-copy span {
    font-size: 0.75rem;
    color: var(--sbn-muted);
    font-weight: 500;
  }
  .sbn-post-chev {
    color: #c0c8c2;
    display: flex;
  }

  @keyframes sbnFade {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes sbnSlide {
    from { opacity: 0; transform: translateX(-50%) translateY(12px) scale(0.97); }
    to { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
  }

  @media (min-width: 769px) {
    .soko-bottom-nav-mobile,
    .soko-bottom-nav.soko-bottom-nav-mobile,
    #bottom-nav.soko-bottom-nav-mobile { display: none !important; }
  }

  @media (max-width: 360px) {
    .sbn-item-label { font-size: 9px; }
    .sbn-fab-wrap { margin-top: -18px; }
    .sbn-fab { width: 52px; height: 52px; }
    .sbn-fab-core { width: 44px; height: 44px; }
    .sbn-bar-inner { padding: 6px 6px 8px; }
  }
`
