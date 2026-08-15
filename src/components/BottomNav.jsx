import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home,
  Compass,
  Plus,
  MessageCircle,
  UserRound,
  Image as ImageIcon,
  Wrench,
  Search,
  ChevronRight,
  GalleryHorizontalEnd,
} from 'lucide-react'

const ICON = { size: 22, strokeWidth: 1.75 }

/**
 * App-wide mobile bottom nav — professional glass bar + Lucide icons:
 * Home · Explore · Post · Chats · Profile
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
  const isExplore = path.startsWith('/explore')
  const isChats = path.startsWith('/chats') || path.startsWith('/chat')
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
                <ImageIcon size={20} strokeWidth={1.85} />
              </span>
              <span className="sbn-post-copy">
                <strong>Listing</strong>
                <span>Sell a product or item</span>
              </span>
              <ChevronRight size={16} strokeWidth={2.2} className="sbn-post-chev" aria-hidden />
            </button>

            <button
              type="button"
              role="menuitem"
              className="sbn-post-item"
              onClick={() => {
                setShowPostMenu(false)
                navigate('/looking-for', { state: { openComposer: true } })
              }}
            >
              <span className="sbn-post-ic sbn-post-ic-looking" aria-hidden="true">
                <Search size={20} strokeWidth={1.85} />
              </span>
              <span className="sbn-post-copy">
                <strong>Looking For</strong>
                <span>Post what you need · get offers</span>
              </span>
              <ChevronRight size={16} strokeWidth={2.2} className="sbn-post-chev" aria-hidden />
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
                <Wrench size={20} strokeWidth={1.85} />
              </span>
              <span className="sbn-post-copy">
                <strong>Service</strong>
                <span>Offer your skills</span>
              </span>
              <ChevronRight size={16} strokeWidth={2.2} className="sbn-post-chev" aria-hidden />
            </button>

            <button
              type="button"
              role="menuitem"
              className="sbn-post-item sbn-post-item-status"
              onClick={() => {
                setShowPostMenu(false)
                navigate('/status?compose=1')
              }}
            >
              <span className="sbn-status-ring" aria-hidden="true">
                <span className="sbn-post-ic sbn-post-ic-status">
                  <GalleryHorizontalEnd size={20} strokeWidth={1.75} />
                </span>
              </span>
              <span className="sbn-post-copy">
                <strong>Status</strong>
                <span>Share a quick update</span>
              </span>
              <ChevronRight size={16} strokeWidth={2.2} className="sbn-post-chev" aria-hidden />
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
            icon={<Home {...ICON} />}
          />
          <NavItem
            active={isExplore}
            label="Explore"
            onClick={() => {
              const isMobile = window.innerWidth < 769
              navigate(isMobile ? '/explore' : '/search')
            }}
            icon={<Compass {...ICON} />}
          />

          <div className="sbn-fab-wrap">
            <button
              type="button"
              className={`sbn-fab${showPostMenu ? ' is-open' : ''}`}
              onClick={() => setShowPostMenu((m) => !m)}
              aria-label="Post"
              aria-expanded={showPostMenu}
            >
              <span className="sbn-fab-ring" aria-hidden="true" />
              <span className="sbn-fab-core" aria-hidden="true">
                <Plus size={24} strokeWidth={2.4} className="sbn-fab-plus" color="#fff" />
              </span>
            </button>
            <span className="sbn-fab-label">Post</span>
          </div>

          <NavItem
            active={isChats}
            label="Chats"
            onClick={() => navigate('/chats')}
            icon={<MessageCircle {...ICON} />}
            badge={unreadCount}
          />
          <NavItem
            active={isProfileTab}
            label="Profile"
            onClick={() => navigate('/profile')}
            icon={<UserRound {...ICON} />}
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
      </span>
      <span className="sbn-item-label">{label}</span>
      {badge > 0 && (
        <span className="sbn-badge">{badge > 9 ? '9+' : badge}</span>
      )}
    </button>
  )
}

const premiumCss = `
  .soko-bottom-nav-mobile {
    --sbn-green: #1a7a4a;
    --sbn-muted: #9ca3af;
    --sbn-ink: #111827;
    --sbn-line: rgba(15, 23, 42, 0.08);
    font-family: Inter, system-ui, -apple-system, sans-serif;
    -webkit-tap-highlight-color: transparent;
  }

  .sbn-bar {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: 100;
    padding: 0 0 calc(env(safe-area-inset-bottom, 0px));
    pointer-events: none;
    transition: transform 0.25s ease, opacity 0.25s ease;
    will-change: transform;
  }

  .sbn-bar-inner {
    pointer-events: auto;
    max-width: 100%;
    margin: 0 auto;
    display: flex;
    align-items: flex-end;
    justify-content: space-around;
    gap: 0;
    padding: 8px 8px 10px;
    border-radius: 0;
    background: #ffffff;
    border: none;
    border-top: 1px solid var(--sbn-line);
    box-shadow: 0 -4px 20px rgba(15, 23, 42, 0.04);
    backdrop-filter: none;
    position: relative;
  }

  .sbn-bar-inner::before { display: none; }

  .sbn-item {
    flex: 1 1 0;
    min-width: 0;
    max-width: 80px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 3px;
    border: none;
    background: transparent;
    cursor: pointer;
    padding: 6px 4px;
    border-radius: 12px;
    color: var(--sbn-muted);
    position: relative;
    transition: color 0.15s ease, transform 0.1s ease;
  }

  .sbn-item:active { transform: scale(0.96); }

  .sbn-item.is-active {
    color: var(--sbn-green);
    background: transparent;
  }

  .sbn-item-ic {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
  }

  .sbn-item.is-active .sbn-item-ic {
    color: var(--sbn-green);
  }

  .sbn-item-ic svg { display: block; }

  .sbn-item-label {
    font-size: 10px;
    font-weight: 500;
    letter-spacing: 0.01em;
    line-height: 1.1;
    white-space: nowrap;
  }

  .sbn-item.is-active .sbn-item-label {
    font-weight: 700;
    color: var(--sbn-green);
  }

  .sbn-badge {
    position: absolute;
    top: 2px;
    right: calc(50% - 14px);
    min-width: 15px;
    height: 15px;
    padding: 0 4px;
    border-radius: 999px;
    background: #ef4444;
    color: #fff;
    font-size: 9px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 1.5px solid #fff;
  }

  .sbn-fab-wrap {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    margin: 0 2px;
    margin-top: -18px;
    z-index: 2;
  }

  .sbn-fab {
    position: relative;
    width: 52px;
    height: 52px;
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
    background: #fff;
    box-shadow: 0 2px 10px rgba(15, 23, 42, 0.1);
  }

  .sbn-fab-core {
    position: relative;
    width: 46px;
    height: 46px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--sbn-green);
    border: 3px solid #fff;
    box-shadow: 0 4px 14px rgba(26, 122, 74, 0.28);
    transition: transform 0.2s ease, background 0.15s ease;
  }

  .sbn-fab:active .sbn-fab-core { transform: scale(0.95); }

  .sbn-fab.is-open .sbn-fab-core {
    background: #145c38;
  }

  .sbn-fab.is-open .sbn-fab-plus {
    transform: rotate(45deg);
  }

  .sbn-fab-plus {
    transition: transform 0.2s ease;
    display: block;
  }

  .sbn-fab-label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: var(--sbn-muted);
    line-height: 1;
  }

  .sbn-fab.is-open + .sbn-fab-label,
  .sbn-fab-wrap:has(.sbn-fab.is-open) .sbn-fab-label {
    color: var(--sbn-green);
  }

  .sbn-overlay {
    position: fixed;
    inset: 0;
    z-index: 98;
    border: none;
    padding: 0;
    margin: 0;
    background: rgba(15, 23, 42, 0.28);
    backdrop-filter: blur(2px);
    -webkit-backdrop-filter: blur(2px);
    cursor: pointer;
    animation: sbnFade 0.15s ease both;
  }

  .sbn-post-menu {
    position: fixed;
    bottom: calc(84px + env(safe-area-inset-bottom, 0px));
    left: 50%;
    transform: translateX(-50%);
    width: min(340px, calc(100vw - 32px));
    z-index: 99;
    background: #fff;
    border-radius: 16px;
    padding: 6px 8px 10px;
    border: 1px solid var(--sbn-line);
    box-shadow: 0 12px 40px rgba(15, 23, 42, 0.12);
    animation: sbnSlide 0.2s ease both;
  }

  .sbn-post-menu-head {
    padding: 12px 12px 10px;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .sbn-post-menu-kicker {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 0.65rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--sbn-muted);
  }

  .sbn-post-menu-head strong {
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--sbn-ink);
    letter-spacing: -0.02em;
  }

  .sbn-post-item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 11px 12px;
    border: none;
    background: transparent;
    border-radius: 12px;
    cursor: pointer;
    text-align: left;
    font: inherit;
    margin-bottom: 2px;
    color: inherit;
    transition: background 0.12s ease;
  }

  .sbn-post-item:last-child { margin-bottom: 0; }
  .sbn-post-item:hover { background: #f4f5f4; }
  .sbn-post-item:active { background: #eef0ee; }

  .sbn-post-item.sbn-post-item-status {
    background: linear-gradient(120deg, rgba(15,157,88,0.045), rgba(249,171,0,0.03));
    border: 1px solid rgba(15,157,88,0.14);
    position: relative;
  }
  .sbn-post-item.sbn-post-item-status:hover,
  .sbn-post-item.sbn-post-item-status:active {
    background: linear-gradient(120deg, rgba(15,157,88,0.075), rgba(249,171,0,0.05));
  }
  .sbn-post-item.sbn-post-item-status .sbn-post-chev { color: #0F9D58; }

  .sbn-status-ring {
    position: relative;
    width: 42px;
    height: 42px;
    flex-shrink: 0;
    border-radius: 50%;
    padding: 2px;
    background: linear-gradient(135deg, #0F9D58 0%, #22a05e 55%, #0a7a44 100%);
    box-shadow: 0 2px 8px rgba(15,157,88,0.22);
    display: grid;
    place-items: center;
    transition: box-shadow 0.2s ease;
  }
  .sbn-post-item.sbn-post-item-status:hover .sbn-status-ring {
    box-shadow: 0 2px 12px rgba(15,157,88,0.35);
  }
  .sbn-status-ring .sbn-post-ic {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: #fff;
    color: #0F9D58;
  }
  .sbn-post-item.sbn-post-item-status .sbn-post-copy strong {
    color: #0a7a44;
  }

  .sbn-post-ic {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    background: #f3f4f6;
    color: #374151;
  }

  .sbn-post-ic-listing,
  .sbn-post-ic-looking,
  .sbn-post-ic-service,
  .sbn-post-ic-job,
  .sbn-post-ic-status {
    background: #f3f4f6;
    color: #374151;
  }

  .sbn-post-copy {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .sbn-post-copy strong {
    font-size: 0.9rem;
    font-weight: 700;
    color: var(--sbn-ink);
  }

  .sbn-post-copy span {
    font-size: 0.72rem;
    color: var(--sbn-muted);
    font-weight: 500;
  }

  .sbn-post-chev {
    color: #d1d5db;
    flex-shrink: 0;
  }

  @keyframes sbnFade {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes sbnSlide {
    from { opacity: 0; transform: translateX(-50%) translateY(10px); }
    to { opacity: 1; transform: translateX(-50%) translateY(0); }
  }

  body.keyboard-open .soko-bottom-nav-mobile .sbn-bar {
    transform: translateY(115%);
    opacity: 0;
  }

  body.keyboard-open .soko-bottom-nav-mobile .sbn-bar,
  body.keyboard-open .soko-bottom-nav-mobile .sbn-bar-inner {
    pointer-events: none;
  }

  @media (min-width: 769px) {
    .soko-bottom-nav-mobile,
    .soko-bottom-nav.soko-bottom-nav-mobile,
    #bottom-nav.soko-bottom-nav-mobile { display: none !important; }
  }

  @media (max-width: 360px) {
    .sbn-item-label { font-size: 9px; }
    .sbn-fab { width: 48px; height: 48px; }
    .sbn-fab-core { width: 42px; height: 42px; }
  }
`
