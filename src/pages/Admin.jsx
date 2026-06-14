import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const TABS = ['Dashboard', 'Featured', 'Listings', 'Users', 'Verifications', 'Broadcast']

export default function Admin() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('Dashboard')
  const [listings, setListings] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [toggling, setToggling] = useState(null)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [toast, setToast] = useState('')
  const [adminName, setAdminName] = useState('')
const [verifications, setVerifications] = useState([])
const [verifyLoading, setVerifyLoading] = useState(false)
const [broadcastSubject, setBroadcastSubject] = useState('')
const [broadcastMessage, setBroadcastMessage] = useState('')
const [broadcasting, setBroadcasting] = useState(false)
const [broadcastResult, setBroadcastResult] = useState(null)
const [broadcastFilter, setBroadcastFilter] = useState({ role: 'all', city: '' })
const [selectedUsers, setSelectedUsers] = useState([])

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'admin') { navigate('/'); return }

    setAdminName(profile?.full_name || user.email)
    await Promise.all([loadListings(), loadUsers(), loadVerifications()])
    setLoading(false)
  }

 async function loadListings() {
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, price, city, category, images, status, featured, seller_id, created_at')
    .order('created_at', { ascending: false })
  if (error) console.error('Listings error:', error)
  
  const list = (data || []).map(l => ({ ...l, is_featured: l.featured }))
  const sellerIds = [...new Set(list.map(l => l.seller_id).filter(Boolean))]
  if (sellerIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', sellerIds)
    const profileMap = Object.fromEntries((profiles || []).map(p => [p.id, p]))
    list.forEach(l => { l.profiles = profileMap[l.seller_id] || null })
  }
  setListings(list)
}

async function loadVerifications() {
  const { data } = await supabase
    .from('verification_requests')
    .select('*, profiles!seller_id(full_name, avatar_url, city)')
    .order('submitted_at', { ascending: false })
  setVerifications(data || [])
}

async function handleVerify(id, status, note = '') {
  setVerifyLoading(id)
  await supabase.from('verification_requests').update({
    status,
    admin_note: note || null,
    reviewed_at: new Date().toISOString(),
  }).eq('id', id)
  setVerifications(vs => vs.map(v => v.id === id ? { ...v, status, admin_note: note } : v))
  showToast(status === 'approved' ? '✅ Seller verified!' : '❌ Request rejected')
  setVerifyLoading(null)
}

function getBroadcastFiltered() {
  return users.filter(u => {
    const matchRole = broadcastFilter.role === 'all' || u.role === broadcastFilter.role
    const matchCity = !broadcastFilter.city || (u.city || '').toLowerCase().includes(broadcastFilter.city.toLowerCase())
    return matchRole && matchCity
  })
}

function toggleSelectUser(id) {
  setSelectedUsers(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
}

function toggleSelectAll() {
  const filtered = getBroadcastFiltered()
  const allSelected = filtered.every(u => selectedUsers.includes(u.id))
  if (allSelected) setSelectedUsers([])
  else setSelectedUsers(filtered.map(u => u.id))
}

async function handleBroadcast() {
  if (!broadcastSubject.trim() || !broadcastMessage.trim()) {
    showToast('Please fill in subject and message')
    return
  }
  if (selectedUsers.length === 0) {
    showToast('Select at least one user')
    return
  }
  if (!window.confirm(`Send this email to ${selectedUsers.length} selected user(s)?`)) return

  setBroadcasting(true)
  setBroadcastResult(null)

  try {
    const { data, error } = await supabase.functions.invoke('broadcast-email', {
      body: { subject: broadcastSubject.trim(), message: broadcastMessage.trim(), userIds: selectedUsers }
    })
    if (error) throw error
    setBroadcastResult({ success: true, sent: data?.sent || selectedUsers.length })
showToast(`✅ Email sent to ${data?.sent || selectedUsers.length} users`)
    setSelectedUsers([])
  } catch (err) {
    setBroadcastResult({ success: false, error: err.message })
    showToast('❌ Failed to send emails')
  } finally {
    setBroadcasting(false)
  }
}

async function loadUsers() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
  if (error) console.error('Users error:', error)
  setUsers(data || [])
}
  async function handleLogout() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function toggleFeatured(listing) {
    setToggling(listing.id)
    await supabase.from('listings').update({ featured: !listing.is_featured }).eq('id', listing.id)
    setListings(ls => ls.map(l => l.id === listing.id ? { ...l, is_featured: !l.is_featured } : l))
    showToast(listing.is_featured ? 'Removed from featured' : 'Added to featured ⭐')
    setToggling(null)
  }

  async function toggleStatus(listing) {
    const next = listing.status === 'active' ? 'inactive' : 'active'
    await supabase.from('listings').update({ status: next }).eq('id', listing.id)
    setListings(ls => ls.map(l => l.id === listing.id ? { ...l, status: next } : l))
    showToast(`Listing ${next === 'active' ? 'activated ✓' : 'deactivated'}`)
  }

  async function deleteListing(id) {
    if (!window.confirm('Delete this listing permanently?')) return
    await supabase.from('listings').delete().eq('id', id)
    setListings(ls => ls.filter(l => l.id !== id))
    showToast('Listing deleted')
  }

  async function toggleRole(u) {
    const next = u.role === 'admin' ? 'user' : 'admin'
    await supabase.from('profiles').update({ role: next }).eq('id', u.id)
    setUsers(us => us.map(x => x.id === u.id ? { ...x, role: next } : x))
    showToast(`${u.full_name || 'User'} is now ${next}`)
  }

  const stats = {
    total: listings.length,
    active: listings.filter(l => l.status === 'active').length,
    featured: listings.filter(l => l.is_featured).length,
    inactive: listings.filter(l => l.status === 'inactive').length,
    users: users.length,
    admins: users.filter(u => u.role === 'admin').length,
  }

  const featuredListings = listings.filter(l => l.is_featured)
  const unfeaturedListings = listings.filter(l => !l.is_featured && l.status === 'active')

  const filteredListings = listings.filter(l => {
    const matchSearch = !search ||
      l.title?.toLowerCase().includes(search.toLowerCase()) ||
      l.city?.toLowerCase().includes(search.toLowerCase()) ||
      l.profiles?.full_name?.toLowerCase().includes(search.toLowerCase())
    const matchStatus = statusFilter === 'all' || l.status === statusFilter
    return matchSearch && matchStatus
  })

  if (loading) return (
    <div style={S.loadWrap}>
      <div style={S.spinner} />
      <p style={{ color: '#888', marginTop: 12, fontSize: 13 }}>Loading admin panel…</p>
    </div>
  )

  const TAB_ICONS = { Dashboard: '📊', Featured: '⭐', Listings: '📦', Users: '👥', Verifications: '✅', Broadcast: '📣' }

  return (
    <div style={S.shell}>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:none } }
        * { box-sizing: border-box; }
        body { margin: 0; }
        .row-hover:hover { background: #f8faf9 !important; }
        .tab-btn:hover { background: #f0f5f2 !important; }
        .act-btn:hover { opacity: 0.75; }
        .nav-item:hover { background: rgba(255,255,255,0.08) !important; }
        .feat-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
        input:focus { border-color: #1a7a4a !important; outline: none; }
        select:focus { outline: none; }
        ::-webkit-scrollbar { width: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #d0dbd4; border-radius: 10px; }
      `}</style>

      {/* ── Toast ── */}
      {toast && <div style={S.toast}>{toast}</div>}

      {/* ── Sidebar ── */}
      <aside style={S.sidebar}>
        <div style={S.sidebarTop}>
          <div style={S.brand}>
            <div style={S.brandIcon}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                <polyline points="9 22 9 12 15 12 15 22" fill="none" stroke="#fff" strokeWidth="1.5"/>
              </svg>
            </div>
            <div>
              <div style={S.brandName}>SokoMW</div>
              <div style={S.brandBadge}>ADMIN PANEL</div>
            </div>
          </div>

          <nav style={{ marginTop: 32 }}>
            <div style={S.navLabel}>MAIN MENU</div>
            {TABS.map(t => (
              <button
                key={t}
                className="nav-item"
                onClick={() => setTab(t)}
                style={{
                  ...S.navItem,
                  ...(tab === t ? S.navItemActive : {}),
                }}
              >
                <span style={{ fontSize: 16 }}>{TAB_ICONS[t]}</span>
                {t}
                {t === 'Featured' && (
                  <span style={S.navPill}>{stats.featured}</span>
                )}
               {t === 'Users' && (
  <span style={S.navPill}>{stats.users}</span>
)}
{t === 'Verifications' && verifications.filter(v => v.status === 'pending').length > 0 && (
  <span style={{ ...S.navPill, background: '#dc2626' }}>
    {verifications.filter(v => v.status === 'pending').length}
  </span>
)}
              </button>
            ))}
          </nav>
        </div>

        <div style={S.sidebarBottom}>
          <div style={S.adminCard}>
            <div style={S.adminAvatar}>
              {(adminName[0] || 'A').toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={S.adminName}>{adminName}</div>
              <div style={S.adminRole}>Super Admin</div>
            </div>
          </div>
          <button style={S.logoutBtn} onClick={handleLogout}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main ── */}
      <div style={S.main}>

        {/* Topbar */}
        <div style={S.topbar}>
          <div>
            <div style={S.topbarTitle}>{tab}</div>
            <div style={S.topbarSub}>
              {tab === 'Dashboard' && 'Platform overview'}
              {tab === 'Featured' && 'Control homepage spotlight'}
              {tab === 'Listings' && `${filteredListings.length} listings`}
              {tab === 'Users' && `${stats.users} accounts`}
            </div>
          </div>
          {(tab === 'Listings') && (
            <div style={S.searchBar}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="#aaa" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                style={S.searchInput}
                placeholder="Search listings…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              <select
                style={S.filterSelect}
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
              >
                <option value="all">All</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="sold">Sold</option>
              </select>
            </div>
          )}
        </div>

        {/* ══ TAB: DASHBOARD ══ */}
        {tab === 'Dashboard' && (
          <div style={S.content}>
            <div style={S.statsGrid}>
              {[
                { label: 'Total Listings', value: stats.total, color: '#1a7a4a', bg: '#e6f4ec', icon: '📦' },
                { label: 'Active Listings', value: stats.active, color: '#1d4ed8', bg: '#dbeafe', icon: '✅' },
                { label: 'Featured', value: stats.featured, color: '#b45309', bg: '#fef3c7', icon: '⭐' },
                { label: 'Total Users', value: stats.users, color: '#7c3aed', bg: '#ede9fe', icon: '👥' },
                { label: 'Inactive', value: stats.inactive, color: '#dc2626', bg: '#fee2e2', icon: '⛔' },
                { label: 'Admins', value: stats.admins, color: '#0f766e', bg: '#ccfbf1', icon: '🛡️' },
              ].map(s => (
                <div key={s.label} style={{ ...S.statCard, background: s.bg }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>{s.icon}</div>
                  <div style={{ ...S.statVal, color: s.color }}>{s.value}</div>
                  <div style={{ ...S.statLabel, color: s.color + 'aa' }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Recent listings */}
            <div style={S.tableCard}>
              <div style={S.tableHeader}>
                <div style={S.tableTitle}>Recent Listings</div>
                <button style={S.viewAllBtn} onClick={() => setTab('Listings')}>View all →</button>
              </div>
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    <th style={S.th}>Listing</th>
                    <th style={S.th}>Price</th>
                    <th style={S.th}>City</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Featured</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.slice(0, 8).map(l => (
                    <tr key={l.id} className="row-hover" style={S.tr}>
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={S.thumbBox}>
                            {l.images?.[0]
                              ? <img src={l.images[0]} alt="" style={S.thumbImg} />
                              : <span style={{ fontSize: 16 }}>📦</span>}
                          </div>
                          <div>
                            <div style={S.listingTitle}>{l.title}</div>
                            <div style={S.listingMeta}>{l.category}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...S.td, fontWeight: 700, color: '#1a7a4a', fontSize: 13 }}>
                        MWK {Number(l.price || 0).toLocaleString()}
                      </td>
                      <td style={S.td}><span style={S.cityBadge}>{l.city}</span></td>
                      <td style={S.td}><StatusBadge status={l.status} /></td>
                      <td style={S.td}>
                        {l.is_featured
                          ? <span style={{ ...S.badge, background: '#fef3c7', color: '#b45309' }}>⭐ Yes</span>
                          : <span style={{ color: '#ccc', fontSize: 13 }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ TAB: FEATURED ══ */}
        {tab === 'Featured' && (
          <div style={S.content}>
            <SectionLabel icon="⭐" text={`Currently Featured (${featuredListings.length})`} />
            {featuredListings.length === 0
              ? <EmptyBox text="No featured listings yet." />
              : <div style={S.featGrid}>
                  {featuredListings.map(l => (
                    <FeatCard key={l.id} listing={l} featured toggling={toggling === l.id}
                      onToggle={() => toggleFeatured(l)} onView={() => navigate('/listing/' + l.id)} />
                  ))}
                </div>
            }

            <div style={{ marginTop: 28 }} />
            <SectionLabel icon="➕" text={`Available to Feature (${unfeaturedListings.length})`} />
            {unfeaturedListings.length === 0
              ? <EmptyBox text="All active listings are already featured." />
              : <div style={S.featGrid}>
                  {unfeaturedListings.map(l => (
                    <FeatCard key={l.id} listing={l} featured={false} toggling={toggling === l.id}
                      onToggle={() => toggleFeatured(l)} onView={() => navigate('/listing/' + l.id)} />
                  ))}
                </div>
            }
          </div>
        )}

        {/* ══ TAB: LISTINGS ══ */}
        {tab === 'Listings' && (
          <div style={S.content}>
            <div style={S.tableCard}>
              <table style={S.table}>
                <thead>
                  <tr style={S.thead}>
                    <th style={S.th}>Listing</th>
                    <th style={S.th}>Seller</th>
                    <th style={S.th}>Price</th>
                    <th style={S.th}>City</th>
                    <th style={S.th}>Status</th>
                    <th style={S.th}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredListings.map(l => (
                    <tr key={l.id} className="row-hover" style={S.tr}>
                      <td style={S.td}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={S.thumbBox}>
                            {l.images?.[0]
                              ? <img src={l.images[0]} alt="" style={S.thumbImg} />
                              : <span style={{ fontSize: 16 }}>📦</span>}
                          </div>
                          <div>
                            <div style={S.listingTitle}>{l.title}</div>
                            <div style={S.listingMeta}>{l.category}</div>
                          </div>
                        </div>
                      </td>
                      <td style={{ ...S.td, fontSize: 13, color: '#555' }}>
                        {l.profiles?.full_name || '—'}
                      </td>
                      <td style={{ ...S.td, fontWeight: 700, color: '#1a7a4a', fontSize: 13 }}>
                        MWK {Number(l.price || 0).toLocaleString()}
                      </td>
                      <td style={S.td}><span style={S.cityBadge}>{l.city}</span></td>
                      <td style={S.td}><StatusBadge status={l.status} /></td>
                      <td style={S.td}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <ActionBtn
                            title={l.is_featured ? 'Unfeature' : 'Feature'}
                            bg={l.is_featured ? '#fef3c7' : '#f3f4f6'}
                            color={l.is_featured ? '#b45309' : '#aaa'}
                            disabled={toggling === l.id}
                            onClick={() => toggleFeatured(l)}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24"
                              fill={l.is_featured ? '#b45309' : 'none'}
                              stroke="currentColor" strokeWidth="2.2">
                              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                            </svg>
                          </ActionBtn>
                          <ActionBtn
                            title={l.status === 'active' ? 'Deactivate' : 'Activate'}
                            bg={l.status === 'active' ? '#e6f4ec' : '#fee2e2'}
                            color={l.status === 'active' ? '#1a7a4a' : '#dc2626'}
                            onClick={() => toggleStatus(l)}
                          >
                            {l.status === 'active'
                              ? <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                              : <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            }
                          </ActionBtn>
                          <ActionBtn
                            title="Delete"
                            bg="#fee2e2" color="#dc2626"
                            onClick={() => deleteListing(l.id)}
                          >
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                              <polyline points="3 6 5 6 21 6"/>
                              <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                            </svg>
                          </ActionBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredListings.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 13 }}>
                      No listings match your search.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ══ TAB: USERS ══ */}
        {tab === 'Verifications' && (
  <div style={S.content}>
    <div style={S.tableCard}>
      <div style={S.tableHeader}>
        <div style={S.tableTitle}>Verification Requests</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {['all','pending','approved','rejected'].map(f => (
            <button key={f} onClick={() => setStatusFilter(f)} style={{
              padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 700,
              background: statusFilter === f ? '#1a7a4a' : '#f0f5f2',
              color: statusFilter === f ? '#fff' : '#555',
            }}>{f}</button>
          ))}
        </div>
      </div>
      {verifications
        .filter(v => statusFilter === 'all' || v.status === statusFilter)
        .map(v => (
        <div key={v.id} style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 20px', borderBottom: '1px solid #f0f5f2',
        }}>
          {/* Avatar */}
          <div style={{ ...S.userAvatar, flexShrink: 0 }}>
            {v.profiles?.avatar_url
              ? <img src={v.profiles.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
              : (v.profiles?.full_name || '?')[0].toUpperCase()
            }
          </div>
          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111' }}>
              {v.profiles?.full_name || 'Unknown'}
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
              📍 {v.profiles?.city || '—'} · 💸 Pachangu · Ref: <strong>{v.payment_ref}</strong>
            </div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>
              Submitted: {new Date(v.submitted_at).toLocaleString()}
            </div>
            {v.admin_note && (
              <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>Note: {v.admin_note}</div>
            )}
          </div>
          {/* Amount */}
          <div style={{ fontSize: 13, fontWeight: 800, color: '#1a7a4a', flexShrink: 0 }}>
            MK {Number(v.amount_paid || 5000).toLocaleString()}
          </div>
          {/* Status + actions */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
            <StatusBadge status={v.status} />
            {v.status === 'pending' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  disabled={verifyLoading === v.id}
                  onClick={() => handleVerify(v.id, 'approved')}
                  style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: '#e6f4ec', color: '#1a7a4a' }}
                >
                  {verifyLoading === v.id ? '…' : '✓ Approve'}
                </button>
                <button
                  disabled={verifyLoading === v.id}
                  onClick={() => {
                    const note = window.prompt('Rejection reason (optional):') || ''
                    handleVerify(v.id, 'rejected', note)
                  }}
                  style={{ padding: '5px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 12, fontWeight: 700, background: '#fee2e2', color: '#dc2626' }}
                >
                  ✕ Reject
                </button>
              </div>
            )}
          </div>
        </div>
      ))}
      {verifications.filter(v => statusFilter === 'all' || v.status === statusFilter).length === 0 && (
        <div style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 13 }}>No verification requests.</div>
      )}
    </div>
  </div>
)}

{tab === 'Broadcast' && (() => {
  const filtered = getBroadcastFiltered()
  const allSelected = filtered.length > 0 && filtered.every(u => selectedUsers.includes(u.id))
  const cities = [...new Set(users.map(u => u.city).filter(Boolean))].sort()

  return (
    <div style={S.content}>
      <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* ── Left: Compose ── */}
        <div style={{ ...S.tableCard, padding: 24, flex: '1 1 340px' }}>
          <div style={S.tableTitle}>📣 Compose Message</div>
          <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 4, marginBottom: 20 }}>
            {selectedUsers.length === 0
              ? 'No users selected yet'
              : <span style={{ color: '#1a7a4a', fontWeight: 700 }}>{selectedUsers.length} user(s) selected</span>}
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>Subject</label>
            <input
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e8e2', fontSize: 13, fontFamily: "'DM Sans', system-ui, sans-serif", outline: 'none', boxSizing: 'border-box', display: 'block' }}
              placeholder="e.g. Important update about SokoMW"
              value={broadcastSubject}
              onChange={e => setBroadcastSubject(e.target.value)}
            />
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, fontWeight: 700, color: '#555', display: 'block', marginBottom: 6 }}>Message</label>
            <textarea
              rows={8}
              style={{ width: '100%', padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e0e8e2', fontSize: 13, fontFamily: "'DM Sans', system-ui, sans-serif", outline: 'none', resize: 'vertical', boxSizing: 'border-box', lineHeight: 1.6, display: 'block' }}
              placeholder="Write your message here…"
              value={broadcastMessage}
              onChange={e => setBroadcastMessage(e.target.value)}
            />
          </div>

          {broadcastResult && (
            <div style={{
              padding: '10px 14px', borderRadius: 10, marginBottom: 14, fontSize: 13, fontWeight: 600,
              background: broadcastResult.success ? '#e6f4ec' : '#fee2e2',
              color: broadcastResult.success ? '#1a7a4a' : '#dc2626',
            }}>
              {broadcastResult.success ? `✅ Sent to ${broadcastResult.sent} users` : `❌ ${broadcastResult.error}`}
            </div>
          )}

          <button
            disabled={broadcasting || selectedUsers.length === 0}
            onClick={handleBroadcast}
            style={{
              background: broadcasting || selectedUsers.length === 0 ? '#9ca3af' : '#1a7a4a',
              color: '#fff', border: 'none', borderRadius: 10,
              padding: '12px 24px', fontSize: 14, fontWeight: 700,
              cursor: broadcasting || selectedUsers.length === 0 ? 'not-allowed' : 'pointer',
              fontFamily: "'DM Sans', system-ui, sans-serif",
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', justifyContent: 'center',
            }}
          >
            {broadcasting ? <><div style={S.miniSpinner} /> Sending…</> : `📣 Send to ${selectedUsers.length || 0} User(s)`}
          </button>
        </div>

        {/* ── Right: User selector ── */}
        <div style={{ ...S.tableCard, flex: '1 1 340px', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #e8f0ec', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <select
              style={{ background: '#f4f7f5', border: '1px solid #e0e8e2', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontFamily: "'DM Sans', system-ui, sans-serif", cursor: 'pointer' }}
              value={broadcastFilter.role}
              onChange={e => { setBroadcastFilter(f => ({ ...f, role: e.target.value })); setSelectedUsers([]) }}
            >
              <option value="all">All roles</option>
              <option value="user">Users only</option>
              <option value="admin">Admins only</option>
            </select>

            <select
              style={{ background: '#f4f7f5', border: '1px solid #e0e8e2', borderRadius: 8, padding: '7px 10px', fontSize: 12, fontFamily: "'DM Sans', system-ui, sans-serif", cursor: 'pointer' }}
              value={broadcastFilter.city}
              onChange={e => { setBroadcastFilter(f => ({ ...f, city: e.target.value })); setSelectedUsers([]) }}
            >
              <option value="">All cities</option>
              {cities.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 'auto' }}>{filtered.length} user(s) found</span>
          </div>

          <div style={{ padding: '10px 20px', borderBottom: '1px solid #f0f5f2', display: 'flex', alignItems: 'center', gap: 10, background: '#f9fbfa' }}>
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              style={{ width: 16, height: 16, cursor: 'pointer', accentColor: '#1a7a4a' }}
            />
            <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>
              {allSelected ? 'Deselect all' : `Select all ${filtered.length}`}
            </span>
          </div>

          <div style={{ maxHeight: 420, overflowY: 'auto' }}>
            {filtered.length === 0 && (
              <div style={{ padding: 32, textAlign: 'center', color: '#aaa', fontSize: 13 }}>No users match filter.</div>
            )}
            {filtered.map(u => (
              <div
                key={u.id}
                onClick={() => toggleSelectUser(u.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '11px 20px', borderBottom: '1px solid #f0f5f2',
                  cursor: 'pointer',
                  background: selectedUsers.includes(u.id) ? '#f0faf4' : 'transparent',
                  transition: 'background 0.1s',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedUsers.includes(u.id)}
                  onChange={() => toggleSelectUser(u.id)}
                  onClick={e => e.stopPropagation()}
                  style={{ width: 15, height: 15, cursor: 'pointer', accentColor: '#1a7a4a', flexShrink: 0 }}
                />
                <div style={S.userAvatar}>
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    : (u.full_name || 'U')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#111', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
                    {u.full_name || 'No name'}
                  </div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 1 }}>
                    {u.city || 'No city'} · {u.role || 'user'}
                  </div>
                </div>
                {selectedUsers.includes(u.id) && <span style={{ fontSize: 11, fontWeight: 700, color: '#1a7a4a' }}>✓</span>}
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
})()}

{tab === 'Users' && (
          <div style={S.content}>
            <div style={S.tableCard}>
              <div style={S.tableHeader}>
                <div style={S.tableTitle}>All Users</div>
                <div style={{ ...S.badge, background: '#ede9fe', color: '#7c3aed' }}>
                  {stats.admins} admin{stats.admins !== 1 ? 's' : ''}
                </div>
              </div>
              {users.map(u => (
                <div key={u.id} className="row-hover" style={S.userRow}>
                  <div style={S.userAvatar}>
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                      : (u.full_name || u.id || 'U')[0].toUpperCase()
                    }
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.userName}>{u.full_name || 'No name'}</div>
                    <div style={S.userMeta}>{u.city || 'No city'}</div>
                  </div>
                  <span style={{
                    ...S.badge,
                    background: u.role === 'admin' ? '#fef3c7' : '#f3f4f6',
                    color: u.role === 'admin' ? '#b45309' : '#888',
                  }}>
                    {u.role === 'admin' ? '⭐ Admin' : 'User'}
                  </span>
                  <button
                    style={{
                      ...S.roleBtn,
                      background: u.role === 'admin' ? '#fee2e2' : '#e6f4ec',
                      color: u.role === 'admin' ? '#dc2626' : '#1a7a4a',
                    }}
                    onClick={() => toggleRole(u)}
                  >
                    {u.role === 'admin' ? 'Remove admin' : 'Make admin'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Sub-components ───────────────────────────────────────

function StatusBadge({ status }) {
  const map = {
    active: { bg: '#e6f4ec', color: '#1a7a4a' },
    inactive: { bg: '#fee2e2', color: '#dc2626' },
    sold: { bg: '#ede9fe', color: '#7c3aed' },
  }
  const s = map[status] || { bg: '#f3f4f6', color: '#888' }
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, background: s.bg, color: s.color }}>{status}</span>
}

function SectionLabel({ icon, text }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 14, textTransform: 'uppercase', letterSpacing: 0.6 }}>
      {icon} {text}
    </div>
  )
}

function EmptyBox({ text }) {
  return (
    <div style={{ background: '#fff', border: '1.5px dashed #dde8e2', borderRadius: 14, padding: 24, textAlign: 'center', fontSize: 13, color: '#aaa' }}>
      {text}
    </div>
  )
}

function FeatCard({ listing, featured, toggling, onToggle, onView }) {
  return (
    <div className="feat-card" style={S.featCard}>
      <div style={{ position: 'relative', height: 120, background: '#f0f5f1', cursor: 'pointer' }} onClick={onView}>
        {listing.images?.[0]
          ? <img src={listing.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>📦</div>
        }
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.55), transparent)' }} />
        <div style={{ position: 'absolute', bottom: 8, left: 10, fontSize: 12, fontWeight: 800, color: '#f59e0b' }}>
          MWK {Number(listing.price || 0).toLocaleString()}
        </div>
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#111', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{listing.title}</div>
        <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{listing.city} · {listing.category}</div>
      </div>
      <div style={{ padding: '0 12px 12px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          style={{ ...S.starBtn, background: featured ? '#f59e0b' : '#e8e8e8' }}
          onClick={onToggle}
          disabled={toggling}
          title={featured ? 'Remove from featured' : 'Add to featured'}
        >
          {toggling
            ? <div style={S.miniSpinner} />
            : <svg width="14" height="14" viewBox="0 0 24 24"
                fill={featured ? '#fff' : 'none'}
                stroke={featured ? '#fff' : '#999'} strokeWidth="2.2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
              </svg>
          }
        </button>
      </div>
    </div>
  )
}

function ActionBtn({ children, bg, color, onClick, disabled, title }) {
  return (
    <button
      className="act-btn"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{ width: 30, height: 30, borderRadius: 8, border: 'none', cursor: 'pointer', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'opacity 0.15s' }}
    >
      {children}
    </button>
  )
}

// ── Styles ───────────────────────────────────────────────
const S = {
  shell:       { display: 'flex', minHeight: '100vh', background: '#f4f7f5', fontFamily: "'DM Sans', system-ui, sans-serif" },
  loadWrap:    { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f4f7f5' },
  spinner:     { width: 30, height: 30, border: '3px solid #e0ebe3', borderTopColor: '#1a7a4a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  miniSpinner: { width: 13, height: 13, border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.7s linear infinite' },

  // Sidebar
  sidebar:       { width: 240, background: '#0f1f16', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', minHeight: '100vh', flexShrink: 0, position: 'sticky', top: 0 },
  sidebarTop:    { padding: '24px 16px 16px' },
  sidebarBottom: { padding: '16px' },
  brand:         { display: 'flex', alignItems: 'center', gap: 12 },
  brandIcon:     { width: 38, height: 38, background: '#1a7a4a', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  brandName:     { fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' },
  brandBadge:    { fontSize: 9, fontWeight: 700, color: '#5de89e', letterSpacing: 1, marginTop: 1 },
  navLabel:      { fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.25)', letterSpacing: 1.2, marginBottom: 6, paddingLeft: 12 },
  navItem:       { display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', background: 'none', color: 'rgba(255,255,255,0.55)', fontSize: 14, fontWeight: 500, cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', fontFamily: "'DM Sans', system-ui, sans-serif", marginBottom: 2 },
  navItemActive: { background: 'rgba(255,255,255,0.1)', color: '#fff', fontWeight: 700 },
  navPill:       { marginLeft: 'auto', background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 },
  adminCard:     { display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '10px 12px', marginBottom: 10 },
  adminAvatar:   { width: 34, height: 34, borderRadius: '50%', background: '#1a7a4a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 700, flexShrink: 0 },
  adminName:     { fontSize: 12, fontWeight: 700, color: '#fff', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' },
  adminRole:     { fontSize: 10, color: 'rgba(255,255,255,0.35)', marginTop: 1 },
  logoutBtn:     { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 10, padding: '9px', color: '#f87171', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', system-ui, sans-serif", transition: 'background 0.15s' },

  // Main
  main:     { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' },
  topbar:   { background: '#fff', borderBottom: '1px solid #e8f0ec', padding: '16px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 50 },
  topbarTitle: { fontSize: 18, fontWeight: 800, color: '#0f1410' },
  topbarSub:   { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  searchBar:   { display: 'flex', alignItems: 'center', gap: 8, background: '#f4f7f5', border: '1px solid #e0e8e2', borderRadius: 10, padding: '8px 12px' },
  searchInput: { border: 'none', background: 'none', outline: 'none', fontSize: 13, color: '#111', width: 180, fontFamily: "'DM Sans', system-ui, sans-serif" },
  filterSelect: { border: 'none', background: 'none', fontSize: 12, color: '#555', cursor: 'pointer', fontFamily: "'DM Sans', system-ui, sans-serif" },
  content:  { padding: 24, animation: 'fadeUp 0.25s ease', overflowY: 'auto' },

  // Stats
  statsGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 },
  statCard:  { borderRadius: 14, padding: '20px', animation: 'fadeUp 0.3s ease both' },
  statVal:   { fontSize: 32, fontWeight: 900, lineHeight: 1 },
  statLabel: { fontSize: 12, fontWeight: 600, marginTop: 4, textTransform: 'uppercase', letterSpacing: 0.5 },

  // Table
  tableCard:   { background: '#fff', borderRadius: 16, border: '1px solid #e8f0ec', overflow: 'hidden' },
  tableHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #e8f0ec' },
  tableTitle:  { fontSize: 14, fontWeight: 800, color: '#111' },
  viewAllBtn:  { background: '#e6f4ec', color: '#1a7a4a', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: "'DM Sans', system-ui, sans-serif" },
  table:       { width: '100%', borderCollapse: 'collapse' },
  thead:       { background: '#f9fbfa' },
  th:          { padding: '10px 16px', fontSize: 11, fontWeight: 700, color: '#9ca3af', textAlign: 'left', textTransform: 'uppercase', letterSpacing: 0.6, borderBottom: '1px solid #e8f0ec' },
  tr:          { transition: 'background 0.1s' },
  td:          { padding: '12px 16px', fontSize: 13, color: '#111', borderBottom: '1px solid #f0f5f2', verticalAlign: 'middle' },
  thumbBox:    { width: 38, height: 38, borderRadius: 8, background: '#f0f5f1', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  thumbImg:    { width: '100%', height: '100%', objectFit: 'cover' },
  listingTitle: { fontSize: 13, fontWeight: 700, color: '#111' },
  listingMeta:  { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  cityBadge:   { background: '#f3f4f6', color: '#555', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20 },
  badge:       { display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20 },

  // Users
  userRow:    { display: 'flex', alignItems: 'center', gap: 14, padding: '13px 20px', borderBottom: '1px solid #f0f5f2', transition: 'background 0.1s' },
  userAvatar: { width: 40, height: 40, borderRadius: '50%', background: '#e6f4ec', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#1a7a4a', fontSize: 15, fontWeight: 800, flexShrink: 0, overflow: 'hidden' },
  userName:   { fontSize: 13, fontWeight: 700, color: '#111' },
  userMeta:   { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  roleBtn:    { fontSize: 12, fontWeight: 700, padding: '6px 12px', borderRadius: 9, border: 'none', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: "'DM Sans', system-ui, sans-serif" },

  // Featured
  featGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14 },
  featCard: { background: '#fff', borderRadius: 14, overflow: 'hidden', border: '1px solid #e8f0ec', transition: 'transform 0.18s, box-shadow 0.18s' },
  starBtn:  { width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' },

  // Toast
  toast: { position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)', background: '#0f1f16', color: '#5de89e', fontSize: 13, fontWeight: 700, padding: '11px 22px', borderRadius: 30, zIndex: 9999, boxShadow: '0 4px 20px rgba(0,0,0,0.25)', animation: 'fadeUp 0.25s ease', whiteSpace: 'nowrap', pointerEvents: 'none' },
}