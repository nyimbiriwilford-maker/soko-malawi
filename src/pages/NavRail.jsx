import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ICONS = {
  home: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1V9.5Z" />
    </svg>
  ),
  chat: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  plus: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  bell: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  ),
}

/**
 * Desktop-only vertical icon rail — the same five destinations as the
 * mobile BottomNav (Home / Chats / Post / Alerts / Profile), so landing on
 * /chats at a desktop width never strands the person with no way out.
 * Hidden below 900px via the .soko-navrail media query — BottomNav covers
 * mobile already.
 */
export default function NavRail() {
  const navigate = useNavigate()
  const location = useLocation()
  const [profile, setProfile] = useState(null)
  const isChats = location.pathname.startsWith('/chats') || location.pathname.startsWith('/chat/')
  const initial = (profile?.full_name || 'U')[0]?.toUpperCase() || 'U'

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('full_name,avatar_url').eq('id', user.id).single()
        .then(({ data }) => setProfile(data))
    })
  }, [])

  return (
    <div className="soko-navrail" style={S.rail}>
      <button
        style={{ ...S.iconBtn, ...(location.pathname === '/' ? S.iconBtnHome : {}) }}
        onClick={() => navigate('/')}
        title="Home"
      >
        {ICONS.home}
      </button>

      <button
        style={{ ...S.iconBtn, ...(isChats ? S.iconBtnChat : {}) }}
        onClick={() => navigate('/chats')}
        title="Chats"
      >
        {ICONS.chat}
      </button>

      <button style={S.postBtn} onClick={() => navigate('/post')} title="Post a listing">
        {ICONS.plus}
      </button>

      <button
        style={{ ...S.iconBtn, ...(location.pathname === '/notifications' ? S.iconBtnAlert : {}) }}
        onClick={() => navigate('/notifications')}
        title="Notifications"
      >
        {ICONS.bell}
      </button>

      <div style={{ flex: 1 }} />

      <button style={S.profileBtn} onClick={() => navigate('/profile')} title="Profile">
        {profile?.avatar_url
          ? <img src={profile.avatar_url} alt="" style={S.profileImg} />
          : <span style={S.profileInitial}>{initial}</span>}
      </button>
    </div>
  )
}

const S = {
  rail: {
    width: '64px', flexShrink: 0, height: '100vh', background: '#fff', borderRight: '1px solid #e8f0eb',
    display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0', gap: '12px',
    fontFamily: 'system-ui, sans-serif',
  },
  iconBtn: {
    width: '42px', height: '42px', borderRadius: '13px', border: 'none', background: 'transparent',
    color: '#9aa39d', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
  },
  // Each destination gets its own accent, echoing the homepage's varied
  // pastel category-icon treatment rather than one flat green everywhere.
  iconBtnHome: { background: '#eff6ff', color: '#2563eb' },
  iconBtnChat: { background: '#e6f7ee', color: '#1a7a4a' },
  iconBtnAlert: { background: '#fef3e0', color: '#c9820a' },
  postBtn: {
    width: '44px', height: '44px', borderRadius: '50%', border: 'none',
    background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(26,122,74,0.45)',
    margin: '6px 0',
  },
  profileBtn: {
    width: '38px', height: '38px', borderRadius: '50%', border: 'none', cursor: 'pointer', overflow: 'hidden',
    background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
  },
  profileImg: { width: '100%', height: '100%', objectFit: 'cover' },
  profileInitial: { color: '#fff', fontSize: '14px', fontWeight: '800' },
}