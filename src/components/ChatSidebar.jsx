import { useNavigate } from 'react-router-dom'

// Small inline icon set — kept local so this file has zero new dependencies.
const ICONS = {
  chat: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z" />
    </svg>
  ),
  bag: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" /><path d="M3 6h18" /><path d="M16 10a4 4 0 0 1-8 0" />
    </svg>
  ),
  wrench: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4l-6 6a2.12 2.12 0 0 0 3 3l6-6a4 4 0 0 0 5.4-5.4l-2.1 2.1-2.6-2.6Z" />
    </svg>
  ),
  briefcase: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  store: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9 5 3h14l2 6" /><path d="M3 9v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" /><path d="M3 9h18" /><path d="M9 21v-6h6v6" />
    </svg>
  ),
  tag: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20.6 12.3 12.7 20a2 2 0 0 1-2.8 0l-8-8V3h9l9.7 9.7a2 2 0 0 1 0 2.8Z" /><circle cx="7.5" cy="7.5" r="1.5" />
    </svg>
  ),
  archive: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="20" height="5" rx="1" /><path d="M4 9v9a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9" /><path d="M10 13h4" />
    </svg>
  ),
  star: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.1 8.6 22 9.3 17 14.1 18.2 21 12 17.6 5.8 21 7 14.1 2 9.3 8.9 8.6 12 2" />
    </svg>
  ),
  plus: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  shield: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5l-8-3Z" /><path d="M9 12l2 2 4-4" />
    </svg>
  ),
  chevronDown: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  ),
}

/**
 * Desktop sidebar for the chat screen.
 *
 * `counts` fields `jobs` and `shops` will always read 0 today — the
 * `messages` table (as currently used by ChatList) has no job/shop context
 * column to group on, so there's nothing to count yet. The nav items are
 * built and wired so that as soon as those columns exist (or a request_id
 * for buyer requests, see ChatList.jsx), the counts and filtering start
 * working with no further changes here.
 */
export default function ChatSidebar({ activeFilter, onFilterChange, counts, profile, onNewChat }) {
  const navigate = useNavigate()
  const initial = (profile?.full_name || 'U')[0].toUpperCase()

  const mainItems = [
    { key: 'all', label: 'All Chats', icon: ICONS.chat, count: counts.all },
    { key: 'marketplace', label: 'Marketplace', icon: ICONS.bag, count: counts.marketplace },
    { key: 'services', label: 'Services', icon: ICONS.wrench, count: counts.services },
    { key: 'jobs', label: 'Jobs', icon: ICONS.briefcase, count: counts.jobs },
    { key: 'requests', label: 'People Looking For', icon: ICONS.users, count: counts.requests },
    { key: 'shops', label: 'Shops', icon: ICONS.store, count: counts.shops },
    { key: 'offers', label: 'Offers & Negotiations', icon: ICONS.tag, count: counts.offers },
    { key: 'archived', label: 'Archived', icon: ICONS.archive, count: counts.archived },
  ]

  return (
    <div style={S.sidebar} className="soko-desktop-sidebar">
      <div style={S.top}>
        <div style={S.logo}>
          <span style={{ color: '#1a7a4a' }}>Soko</span><span style={{ color: '#f5a623' }}>Mw</span>
        </div>
        <div style={S.tagline}>Buy. Sell. Find. Anywhere in Malawi.</div>
        <button style={S.newChatBtn} onClick={onNewChat}>
          {ICONS.plus} New Chat
        </button>
      </div>

      <div style={S.navScroll}>
        <div style={S.navList}>
          {mainItems.map(item => (
            <button
              key={item.key}
              style={{ ...S.navItem, ...(activeFilter === item.key ? S.navItemActive : {}) }}
              onClick={() => onFilterChange(item.key)}
            >
              <span style={S.navIcon}>{item.icon}</span>
              <span style={S.navLabel}>{item.label}</span>
              {item.count > 0 && (
                <span style={{ ...S.navCount, ...(activeFilter === item.key ? S.navCountActive : {}) }}>{item.count}</span>
              )}
            </button>
          ))}
        </div>

        <div style={S.divider} />

        <div style={S.navList}>
          <button
            style={{ ...S.navItem, ...(activeFilter === 'starred' ? S.navItemActive : {}) }}
            onClick={() => onFilterChange('starred')}
          >
            <span style={S.navIcon}>{ICONS.star}</span>
            <span style={S.navLabel}>Starred</span>
            {counts.starred > 0 && (
              <span style={{ ...S.navCount, ...(activeFilter === 'starred' ? S.navCountActive : {}) }}>{counts.starred}</span>
            )}
          </button>
          <button
            style={{ ...S.navItem, ...(activeFilter === 'unread' ? S.navItemActive : {}) }}
            onClick={() => onFilterChange('unread')}
          >
            <span style={S.navIcon}>{ICONS.chat}</span>
            <span style={S.navLabel}>Unread</span>
            {counts.unread > 0 && (
              <span style={{ ...S.navCount, ...(activeFilter === 'unread' ? S.navCountActive : {}) }}>{counts.unread}</span>
            )}
          </button>
        </div>

        <div style={S.safetyCard}>
          <div style={S.safetyIcon}>{ICONS.shield}</div>
          <div style={S.safetyTitle}>Buy and sell safely</div>
          <div style={S.safetyText}>Chat, meet and pay safely on SokoMw.</div>
          <a style={S.safetyLink} onClick={() => navigate('/safety')}>Learn more</a>
        </div>
      </div>

      <div style={S.profileRow} onClick={() => navigate('/profile')}>
        <div style={S.profileAvatar}>
          {profile?.avatar_url ? <img src={profile.avatar_url} alt="" style={S.profileAvatarImg} /> : initial}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.profileName}>{profile?.full_name || 'You'}</div>
          <div style={S.profileLink}>View profile</div>
        </div>
        <span style={{ color: '#aaa', flexShrink: 0 }}>{ICONS.chevronDown}</span>
      </div>
    </div>
  )
}

const S = {
  sidebar: {
    width: '290px', flexShrink: 0, background: '#fff', borderRight: '1px solid #eef2ef',
    height: '100vh', position: 'sticky', top: 0, display: 'flex', flexDirection: 'column',
    fontFamily: 'system-ui, sans-serif',
  },
  top: { padding: '22px 20px 14px' },
  logo: { fontSize: '24px', fontWeight: '900', letterSpacing: '-0.5px' },
  tagline: { fontSize: '12px', color: '#9aa39d', marginTop: '2px', marginBottom: '18px' },
  newChatBtn: {
    width: '100%', background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '10px',
    padding: '11px', fontSize: '14px', fontWeight: '700', cursor: 'pointer', display: 'flex',
    alignItems: 'center', justifyContent: 'center', gap: '8px', fontFamily: 'inherit',
  },
  navScroll: { flex: 1, overflowY: 'auto', padding: '10px 12px' },
  navList: { display: 'flex', flexDirection: 'column', gap: '2px' },
  navItem: {
    display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '10px',
    border: 'none', background: 'transparent', color: '#5c6b60', fontSize: '14px', fontWeight: '600',
    cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', width: '100%',
  },
  navItemActive: { background: '#e6f7ee', color: '#0f1410' },
  navIcon: { display: 'flex', color: 'inherit', flexShrink: 0 },
  navLabel: { flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  navCount: { background: '#eef2ef', color: '#8a938c', borderRadius: '10px', padding: '1px 8px', fontSize: '11px', fontWeight: '700' },
  navCountActive: { background: '#1a7a4a', color: '#fff' },
  divider: { height: '1px', background: '#eef2ef', margin: '10px 4px' },
  safetyCard: { margin: '18px 4px 6px', background: '#eefaf2', borderRadius: '14px', padding: '16px' },
  safetyIcon: { color: '#1a7a4a', marginBottom: '8px' },
  safetyTitle: { fontSize: '14px', fontWeight: '800', color: '#0f1410', marginBottom: '4px' },
  safetyText: { fontSize: '12px', color: '#5c6b60', lineHeight: '1.5', marginBottom: '8px' },
  safetyLink: { fontSize: '12.5px', fontWeight: '700', color: '#1a7a4a', cursor: 'pointer' },
  profileRow: { display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 20px', borderTop: '1px solid #eef2ef', cursor: 'pointer' },
  profileAvatar: {
    width: '38px', height: '38px', borderRadius: '50%', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)',
    color: '#fff', fontSize: '15px', fontWeight: '800', display: 'flex', alignItems: 'center',
    justifyContent: 'center', overflow: 'hidden', flexShrink: 0,
  },
  profileAvatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  profileName: { fontSize: '13.5px', fontWeight: '700', color: '#0f1410', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  profileLink: { fontSize: '12px', color: '#1a7a4a', fontWeight: '600' },
}