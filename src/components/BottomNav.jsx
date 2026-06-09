import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useNavigate, useLocation } from 'react-router-dom'

function NavBtn({ icon, label, active, badge, onClick }) {
  return (
    <button style={{ ...S.navItem, ...(active ? S.navItemActive : {}) }} onClick={onClick}>
      <span style={S.navIcon}>{icon}</span>
      <span style={{ ...S.navLabel, ...(active ? { color: '#1a7a4a', fontWeight: '700' } : {}) }}>{label}</span>
      {badge > 0 && <span style={S.navBadge}>{badge > 9 ? '9+' : badge}</span>}
    </button>
  )
}

// SVG icon components
function IconHome({ active }) {
  const c = active ? '#1a7a4a' : '#999'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#e6f4ec' : 'none'} stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/>
      <path d="M9 21V12h6v9" fill={active ? '#1a7a4a' : 'none'} stroke={c}/>
    </svg>
  )
}

function IconServices({ active }) {
  const c = active ? '#1a7a4a' : '#999'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07M8.46 8.46a5 5 0 0 0 0 7.07"/>
    </svg>
  )
}

function IconChat({ active }) {
  const c = active ? '#1a7a4a' : '#999'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#e6f4ec' : 'none'} stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
    </svg>
  )
}

function IconJobs({ active }) {
  const c = active ? '#1a7a4a' : '#999'
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? '#e6f4ec' : 'none'} stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/>
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
      <line x1="12" y1="12" x2="12" y2="16" stroke={c}/>
      <line x1="10" y1="14" x2="14" y2="14" stroke={c}/>
    </svg>
  )
}

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
        setUnreadCount(count || 0)
      }

      fetchUnread()

     await supabase.removeAllChannels()
channel = supabase
  .channel(`unread_badge_${user.id}`)
  .on('postgres_changes', {
    event: '*',
    schema: 'public',
    table: 'messages',
    filter: `to_user=eq.${user.id}`,
  }, fetchUnread)
  .subscribe()
    })

    return () => {
  cancelled = true
  if (channel) supabase.removeChannel(channel)
}
  }, [])

  const path = location.pathname

  return (
    <div className="soko-bottom-nav">
      {showPostMenu && (
        <>
          <div style={S.postOverlay} onClick={() => setShowPostMenu(false)} />
          <div style={S.postMenu}>
            <button style={{ ...S.postMenuItem, animationDelay: '0.05s' }}
              onClick={() => { setShowPostMenu(false); navigate('/post') }}>
              <div style={{ ...S.postMenuIcon, background: '#e6f4ec' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2.2" strokeLinecap="round">
                  <rect x="3" y="3" width="18" height="18" rx="3"/>
                  <circle cx="8.5" cy="8.5" r="1.5"/>
                  <polyline points="21 15 16 10 5 21"/>
                </svg>
              </div>
              <div style={S.postMenuText}>
                <div style={S.postMenuLabel}>Listing</div>
                <div style={S.postMenuSub}>Sell a product or item</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <button style={{ ...S.postMenuItem, animationDelay: '0.1s' }}
              onClick={() => { setShowPostMenu(false); navigate('/services?tab=post') }}>
              <div style={{ ...S.postMenuIcon, background: '#fef3c7' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2.2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                </svg>
              </div>
              <div style={S.postMenuText}>
                <div style={S.postMenuLabel}>Service</div>
                <div style={S.postMenuSub}>Offer your skills or services</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <button style={{ ...S.postMenuItem, animationDelay: '0.15s' }}
              onClick={() => { setShowPostMenu(false); navigate('/jobs?tab=post') }}>
              <div style={{ ...S.postMenuIcon, background: '#dbeafe' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1d4ed8" strokeWidth="2.2" strokeLinecap="round">
                  <rect x="2" y="7" width="20" height="14" rx="2"/>
                  <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
                  <line x1="12" y1="12" x2="12" y2="16"/>
                  <line x1="10" y1="14" x2="14" y2="14"/>
                </svg>
              </div>
              <div style={S.postMenuText}>
                <div style={S.postMenuLabel}>Job</div>
                <div style={S.postMenuSub}>Post a job opening</div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </>
      )}

      <div style={S.nav} className="soko-bottom-nav" id="bottom-nav">
        {/* Home */}
        <button style={{ ...S.navItem, ...(path === '/' ? S.navItemActive : {}) }} onClick={() => navigate('/')}>
          <IconHome active={path === '/'} />
          <span style={{ ...S.navLabel, ...(path === '/' ? { color: '#1a7a4a', fontWeight: '700' } : {}) }}>Home</span>
        </button>

        {/* Services — swapped to second position */}
        <button style={{ ...S.navItem, ...(path.startsWith('/services') ? S.navItemActive : {}) }} onClick={() => navigate('/services')}>
          <IconServices active={path.startsWith('/services')} />
          <span style={{ ...S.navLabel, ...(path.startsWith('/services') ? { color: '#1a7a4a', fontWeight: '700' } : {}) }}>Services</span>
        </button>

        {/* Post FAB */}
        <button style={S.navPost} onClick={() => setShowPostMenu(m => !m)}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.8" strokeLinecap="round"
            style={{ transform: showPostMenu ? 'rotate(45deg)' : 'rotate(0deg)', transition: 'transform 0.25s' }}>
            <line x1="12" y1="5" x2="12" y2="19"/>
            <line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
        </button>

        {/* Chats */}
       <button style={{ ...S.navItem, ...(path.startsWith('/chats') ? S.navItemActive : {}) }} onClick={() => navigate('/chats')}>
  <IconChat active={path.startsWith('/chats')} />
  <span style={{ ...S.navLabel, ...(path.startsWith('/chats') ? { color: '#1a7a4a', fontWeight: '700' } : {}) }}>Chats</span>
{unreadCount > 0 && <span style={S.navBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>}
</button>

        {/* Jobs — swapped to last position */}
        <button style={{ ...S.navItem, ...(path.startsWith('/jobs') ? S.navItemActive : {}) }} onClick={() => navigate('/jobs')}>
          <IconJobs active={path.startsWith('/jobs')} />
          <span style={{ ...S.navLabel, ...(path.startsWith('/jobs') ? { color: '#1a7a4a', fontWeight: '700' } : {}) }}>Jobs</span>
        </button>
      </div>

      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes slideDown { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
      `}</style>
    </div>
  )
}

const S = {
  nav: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    width: '100%',
    background: '#fff',
    borderTop: '1px solid #e8ede9',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
    padding: '6px 0 10px',
    zIndex: 100,
    boxShadow: '0 -4px 16px rgba(0,0,0,0.06)',
  },
  navItem: {
    background: 'none',
    border: 'none',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    cursor: 'pointer',
    position: 'relative',
    padding: '4px 24px',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  navItemActive: {},
  navIcon: { fontSize: 21 },
  navLabel: { fontSize: 10.5, color: '#999', fontWeight: 500 },
  navPost: {
    width: 52,
    height: 52,
    background: 'linear-gradient(135deg, #1a7a4a, #22a05e)',
    color: '#fff',
    border: 'none',
    borderRadius: '50%',
    cursor: 'pointer',
    marginTop: -18,
    boxShadow: '0 4px 16px rgba(26,122,74,0.45)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBadge: {
    position: 'absolute',
    top: 2,
    right: 4,
    background: '#ef4444',
    color: '#fff',
    borderRadius: '50%',
    width: 15,
    height: 15,
    fontSize: 9,
    fontWeight: 800,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postOverlay: {
    position: 'fixed',
    inset: 0,
    zIndex: 98,
    background: 'rgba(0,0,0,0.35)',
    backdropFilter: 'blur(2px)',
  },
  postMenu: {
    position: 'fixed',
    bottom: 90,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 'clamp(300px, 90vw, 452px)',
    maxWidth: 452,
    background: '#fff',
    borderRadius: 20,
    padding: '8px 0',
    zIndex: 99,
    boxShadow: '0 -4px 32px rgba(0,0,0,0.18)',
    animation: 'slideDown 0.22s ease',
  },
  postMenuItem: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: '13px 18px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    animation: 'fadeUp 0.25s ease both',
    transition: 'background 0.12s',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  postMenuIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  postMenuText: { flex: 1, textAlign: 'left' },
  postMenuLabel: { fontSize: 15, fontWeight: 700, color: '#111', marginBottom: 2 },
  postMenuSub: { fontSize: 12, color: '#888' },
}