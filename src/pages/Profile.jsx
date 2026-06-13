import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'
import VouchSection from '../components/VouchSection'
import StatusPicker from '../components/StatusPicker'
import { useStatuses } from '../hooks/useStatuses'
import VerificationModal from '../components/VerificationModal'

// ─── NetworkTab ────────────────────────────────────────────────────────────────
function NetworkTab({ sellerId, userId }) {
  const [followers, setFollowers] = useState([])
  const [following, setFollowing] = useState([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!userId) return
    Promise.all([
      supabase.from('seller_follows')
        .select('id, follower_id, created_at, follower:profiles!seller_follows_follower_id_fkey(full_name, avatar_url)')
        .eq('seller_id', sellerId),
      supabase.from('seller_follows')
        .select('id, seller_id, created_at, seller:profiles!seller_follows_seller_id_fkey(full_name, avatar_url)')
        .eq('follower_id', userId)
    ]).then(([{ data: f }, { data: g }]) => {
      setFollowers(f || [])
      setFollowing(g || [])
      setLoading(false)
    })
  }, [userId, sellerId])

  const followerIds = new Set(followers.map(f => f.follower_id))
  const followingIds = new Set(following.map(f => f.seller_id))

  const removeFollower = async (id) => {
    setRemoving(id)
    await supabase.from('seller_follows').delete().eq('id', id)
    setFollowers(p => p.filter(f => f.id !== id))
    setRemoving(null)
  }
  const unfollow = async (id) => {
    setRemoving(id)
    await supabase.from('seller_follows').delete().eq('id', id)
    setFollowing(p => p.filter(f => f.id !== id))
    setRemoving(null)
  }

  const timeAgo = (ts) => {
    const diff = Date.now() - new Date(ts).getTime()
    const d = Math.floor(diff / 86400000), h = Math.floor(diff / 3600000), m = Math.floor(diff / 60000)
    return d > 0 ? `${d}d ago` : h > 0 ? `${h}h ago` : m > 0 ? `${m}m ago` : 'Just now'
  }

  const Avatar = ({ url, name, gradient }) => {
    const initials = (name || '?').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    return (
      <div style={{
        width: 44, height: 44, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
        background: url ? 'transparent' : gradient,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 15, fontWeight: 700, color: '#fff',
        boxShadow: '0 2px 6px rgba(0,0,0,0.10)',
      }}>
        {url ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials}
      </div>
    )
  }

  const Row = ({ id, name, avatar, gradient, sub, isMutual, profileId, onView, onAction, actionLabel }) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '11px 14px',
      borderBottom: '1px solid #f3f4f6',
    }}>
      <Avatar url={avatar} name={name} gradient={gradient} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#0f1410', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {name}
          </span>
          {isMutual && (
            <span style={{ fontSize: 10, fontWeight: 700, background: '#e8f5e9', color: '#1a7a4a', borderRadius: 20, padding: '2px 7px', whiteSpace: 'nowrap' }}>
              Mutual
            </span>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>🕐 {sub}</div>
      </div>
      <button
        onClick={onView}
        style={{ padding: '5px 11px', fontSize: 11, fontWeight: 600, borderRadius: 20, border: '1.5px solid #d1fae5', background: '#f0faf4', color: '#1a7a4a', cursor: 'pointer', whiteSpace: 'nowrap' }}
      >
        View
      </button>
      <button
        onClick={onAction}
        disabled={removing === id}
        style={{ padding: '5px 11px', fontSize: 11, fontWeight: 600, borderRadius: 20, border: '1.5px solid #fecaca', background: '#fff5f5', color: '#ef4444', cursor: removing === id ? 'default' : 'pointer', opacity: removing === id ? 0.5 : 1, whiteSpace: 'nowrap' }}
      >
        {removing === id ? '…' : actionLabel}
      </button>
    </div>
  )

  const SectionHeader = ({ icon, label, count, badgeColor, hint }) => (
    <div style={{ padding: '14px 14px 10px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid #f3f4f6', background: '#fafcfb' }}>
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 800, color: '#0f1410' }}>{label}</span>
      <span style={{ background: badgeColor, color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '1px 8px', minWidth: 20, textAlign: 'center' }}>
        {count}
      </span>
      <span style={{ marginLeft: 'auto', fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>{hint}</span>
    </div>
  )

  const Empty = ({ icon, text }) => (
    <div style={{ padding: '24px 14px', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
      <div style={{ fontSize: 28, marginBottom: 6 }}>{icon}</div>
      {text}
    </div>
  )

  if (loading) return (
    <div style={{ padding: 36, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
      Loading…
    </div>
  )

  return (
    <div>
      {/* ── Followers ── */}
      <SectionHeader icon="👥" label="Your Followers" count={followers.length} badgeColor="#1a7a4a" hint="People who follow your shop" />
      {followers.length === 0
        ? <Empty icon="🌱" text="No followers yet — post regularly to grow your audience" />
        : followers.map(f => (
          <Row key={f.id} id={f.id}
            name={f.follower?.full_name || 'Unknown'}
            avatar={f.follower?.avatar_url}
            gradient="linear-gradient(135deg,#1a7a4a,#22a05e)"
            sub={`Followed ${timeAgo(f.created_at)}`}
            isMutual={followingIds.has(f.follower_id)}
            profileId={f.follower_id}
            onView={() => navigate('/profile/' + f.follower_id)}
            onAction={() => removeFollower(f.id)}
            actionLabel="Remove"
          />
        ))
      }

      {/* ── Divider ── */}
      <div style={{ height: 10, background: '#f3f4f6', borderTop: '1px solid #e8f0eb', borderBottom: '1px solid #e8f0eb' }} />

      {/* ── Following ── */}
      <SectionHeader icon="🏪" label="Shops You Follow" count={following.length} badgeColor="#f9a825" hint="You get notified on new posts" />
      {following.length === 0
        ? <Empty icon="🔍" text="Not following anyone yet — follow sellers to get their updates" />
        : following.map(f => (
          <Row key={f.id} id={f.id}
            name={f.seller?.full_name || 'Unknown'}
            avatar={f.seller?.avatar_url}
            gradient="linear-gradient(135deg,#e65100,#f9a825)"
            sub={`Following since ${timeAgo(f.created_at)}`}
            isMutual={followerIds.has(f.seller_id)}
            profileId={f.seller_id}
            onView={() => navigate('/profile/' + f.seller_id)}
            onAction={() => unfollow(f.id)}
            actionLabel="Unfollow"
          />
        ))
      }
    </div>
  )
}

// ─── Profile ───────────────────────────────────────────────────────────────────
export default function Profile() {
  const navigate = useNavigate()
  const fileRef = useRef()

  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState({ full_name: '', city: '', avatar_url: '' })
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [editMode, setEditMode] = useState(false)
  const [form, setForm] = useState({ full_name: '', city: '' })
  const [tab, setTab] = useState('listings')
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [showStatusPicker, setShowStatusPicker] = useState(false)
  const [showVerify, setShowVerify] = useState(false)
  const { statuses: myStatuses } = useStatuses(user?.id)
  const activeStatus = myStatuses[0] || null

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { navigate('/login'); return }
    setUser(user)
    await Promise.all([loadProfile(user.id), loadListings(user.id)])
    setLoading(false)
  }

  async function loadProfile(uid) {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).single()
    if (data) {
      setProfile(data)
      setForm({ full_name: data.full_name || '', city: data.city || '' })
    }
  }

  async function loadListings(uid) {
    const { data } = await supabase
      .from('listings')
      .select('*')
      .eq('seller_id', uid)
      .order('created_at', { ascending: false })
    setListings(data || [])
  }

  async function saveProfile() {
    setSaving(true)
    setSaveMsg('')
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      full_name: form.full_name,
      city: form.city,
      updated_at: new Date().toISOString()
    })
    setSaving(false)
    if (error) { setSaveMsg('Error: ' + error.message); return }
    setProfile(p => ({ ...p, ...form }))
    setSaveMsg('Saved!')
    setEditMode(false)
    setTimeout(() => setSaveMsg(''), 2000)
  }

  async function uploadAvatar(e) {
    const file = e.target.files[0]
    if (!file) return
    setUploadingAvatar(true)
    const ext = file.name.split('.').pop()
    const path = user.id + '/avatar.' + ext
    const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (upErr) { setUploadingAvatar(false); alert('Upload failed: ' + upErr.message); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    await supabase.from('profiles').upsert({ id: user.id, avatar_url: publicUrl })
    setProfile(p => ({ ...p, avatar_url: publicUrl }))
    setUploadingAvatar(false)
  }

  async function toggleSold(listing) {
    const newStatus = listing.status === 'sold' ? 'active' : 'sold'
    await supabase.from('listings').update({ status: newStatus }).eq('id', listing.id)
    setListings(ls => ls.map(l => l.id === listing.id ? { ...l, status: newStatus } : l))
  }

  async function deleteListing(id) {
    await supabase.from('listings').delete().eq('id', id)
    setListings(ls => ls.filter(l => l.id !== id))
    setDeleteConfirm(null)
  }

  async function signOut() {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const activeListing = listings.filter(l => l.status !== 'sold')
  const soldListings = listings.filter(l => l.status === 'sold')

  if (loading) return (
    <div style={S.loadWrap}>
      <div style={S.spinner} />
    </div>
  )

  return (
    <div style={S.page}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes spin { to { transform: rotate(360deg) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        input:focus, select:focus { outline:none; border-color:#1a7a4a !important; box-shadow:0 0 0 3px rgba(26,122,74,0.08); }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerTitle}>My Profile</div>
        <button style={S.signOutBtn} onClick={signOut}>Sign out</button>
      </div>

      {/* Avatar + name */}
      <div style={S.heroCard}>
        <div style={S.avatarWrap}>
          <div style={S.avatar}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="avatar" style={S.avatarImg} />
              : <span style={S.avatarInitial}>{(profile.full_name || user.email || 'U')[0].toUpperCase()}</span>
            }
            {uploadingAvatar && <div style={S.avatarOverlay}><div style={S.spinner} /></div>}
          </div>
          <button style={S.changePhotoBtn} onClick={() => fileRef.current.click()}>
            📷 Change photo
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadAvatar} />
        </div>

        {!editMode ? (
          <div style={S.nameSection}>
            <div style={S.nameText}>{profile.full_name || 'No name set'}</div>
            <div style={S.emailText}>{user.email}</div>
            {profile.city && <div style={S.cityText}>📍 {profile.city}</div>}
            <button style={S.editBtn} onClick={() => setEditMode(true)}>✏️ Edit Profile</button>

            {/* Verification status */}
            <div style={{ marginTop: 10 }}>
              {profile.is_verified ? (
                <div style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: '#e8f0fe', borderRadius: 50, padding: '5px 14px',
                  fontSize: 12, fontWeight: 700, color: '#1A73E8',
                  border: '1px solid #c5d8fc',
                }}>
                  ✅ Verified Seller
                </div>
              ) : (
                <button
                  onClick={() => setShowVerify(true)}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    background: 'linear-gradient(135deg,#1A73E8,#1557b0)',
                    border: 'none', borderRadius: 50, padding: '7px 16px',
                    fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer',
                    boxShadow: '0 2px 10px rgba(26,115,232,0.3)',
                  }}
                >
                  ✅ Get Verified · MK 5,000
                </button>
              )}
            </div>
          </div>
        ) : (
          <div style={S.editForm}>
            <label style={S.label}>Full Name</label>
            <input
              style={S.input}
              placeholder="Your full name"
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
            />
            <label style={S.label}>City</label>
            <input
              style={S.input}
              placeholder="e.g. Lilongwe, Blantyre..."
              value={form.city}
              onChange={e => setForm(f => ({ ...f, city: e.target.value }))}
            />
            {saveMsg && <p style={S.saveMsg}>{saveMsg}</p>}
            <div style={S.editBtns}>
              <button style={S.cancelBtn} onClick={() => { setEditMode(false); setForm({ full_name: profile.full_name || '', city: profile.city || '' }) }}>
                Cancel
              </button>
              <button style={S.saveBtn} onClick={saveProfile} disabled={saving}>
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={S.statsRow}>
        <div style={S.statBox}>
          <div style={S.statNum}>{listings.length}</div>
          <div style={S.statLabel}>Total</div>
        </div>
        <div style={S.statDivider} />
        <div style={S.statBox}>
          <div style={S.statNum}>{activeListing.length}</div>
          <div style={S.statLabel}>Active</div>
        </div>
        <div style={S.statDivider} />
        <div style={S.statBox}>
          <div style={S.statNum}>{soldListings.length}</div>
          <div style={S.statLabel}>Sold</div>
        </div>
      </div>

      <VouchSection targetUserId={user?.id} viewerUserId={user?.id} />

      {/* Tabs */}
      <div style={S.tabs}>
        <button style={{ ...S.tab, ...(tab === 'listings' ? S.tabActive : {}) }} onClick={() => setTab('listings')}>
          Active ({activeListing.length})
        </button>
        <button style={{ ...S.tab, ...(tab === 'sold' ? S.tabActive : {}) }} onClick={() => setTab('sold')}>
          Sold ({soldListings.length})
        </button>
        <button style={{ ...S.tab, ...(tab === 'network' ? S.tabActive : {}) }} onClick={() => setTab('network')}>
          Network
        </button>
      </div>

      {/* Tab content */}
      {tab === 'network' ? (
        <div style={{ padding: '0 14px', paddingBottom: 80 }}>
          <div style={{ background: '#fff', borderRadius: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
            <NetworkTab sellerId={user?.id} userId={user?.id} />
          </div>
        </div>
      ) : (
        <div>
          <div style={S.grid}>
            {(tab === 'listings' ? activeListing : soldListings).length === 0 && (
              <div style={S.empty}>
                <div style={S.emptyIcon}>{tab === 'listings' ? '🛍️' : '✅'}</div>
                <p style={S.emptyTitle}>{tab === 'listings' ? 'No active listings' : 'No sold items yet'}</p>
                <p style={S.emptySub}>{tab === 'listings' ? 'Post something to get started!' : "Mark a listing as sold when it's been purchased."}</p>
                {tab === 'listings' && (
                  <button style={S.postBtn} onClick={() => navigate('/post')}>+ Post Listing</button>
                )}
              </div>
            )}
            {(tab === 'listings' ? activeListing : soldListings).map((listing, i) => (
              <div key={listing.id} style={{ ...S.card, animationDelay: i * 0.04 + 's' }}>
                <div style={S.thumb}>
                  {listing.images && listing.images[0]
                    ? <img src={listing.images[0]} alt={listing.title} style={S.thumbImg} />
                    : <div style={S.thumbPlaceholder}>🖼️</div>
                  }
                  {listing.status === 'sold' && <div style={S.soldBadge}>SOLD</div>}
                </div>
                <div style={S.cardBody}>
                  <div style={S.cardTitle}>{listing.title}</div>
                  <div style={S.cardPrice}>MWK {Number(listing.price || 0).toLocaleString()}</div>
                  <div style={S.cardCity}>📍 {listing.city || '—'}</div>
                </div>
                <div style={S.cardActions}>
                  <button
                    style={{ ...S.actionBtn, ...(listing.status === 'sold' ? S.actionBtnGhost : S.actionBtnGreen) }}
                    onClick={() => toggleSold(listing)}
                  >
                    {listing.status === 'sold' ? '↩ Relist' : '✓ Mark sold'}
                  </button>
                  <button style={S.editListingBtn} onClick={() => navigate('/post/edit/' + listing.id)}>✏️ Edit</button>
                  <button style={S.deleteBtn} onClick={() => setDeleteConfirm(listing.id)}>🗑</button>
                </div>
              </div>
            ))}
          </div>

          {/* Saved Statuses link */}
          <div
            onClick={() => navigate('/saved-statuses')}
            style={{ margin: '12px 14px 14px', background: '#fff', borderRadius: 14, border: '1.5px solid #e5e7eb', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🤍</span>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f1410' }}>Saved Statuses</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Statuses you saved from sellers</div>
              </div>
            </div>
            <span style={{ fontSize: 18, color: '#9ca3af' }}>›</span>
          </div>

          {/* Status section */}
          <div style={{ margin: '0 14px 14px' }}>
            {activeStatus ? (
              <div style={{ background: '#e8f5e9', border: '1.5px solid #a5d6a7', borderRadius: 14, padding: '12px 14px' }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: '#2e7d32', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 }}>
                  Your active status
                </div>
                <div style={{ fontSize: 13, color: '#1b5e20', fontWeight: 600, marginBottom: 8 }}>
                  {activeStatus.content}
                </div>
                <button
                  onClick={() => setShowStatusPicker(true)}
                  style={{ background: 'none', border: '1.5px solid #a5d6a7', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 700, color: '#2e7d32', cursor: 'pointer' }}
                >
                  Update
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowStatusPicker(true)}
                style={{ width: '100%', background: '#f0faf4', border: '1.5px dashed #a5d6a7', borderRadius: 14, padding: '12px 16px', fontSize: 13, fontWeight: 700, color: '#2e7d32', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
              >
                <span style={{ fontSize: 16 }}>📢</span>
                Let buyers know you're available today
              </button>
            )}
          </div>
        </div>
      )}

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div style={S.overlay} onClick={() => setDeleteConfirm(null)}>
          <div style={S.confirmCard} onClick={e => e.stopPropagation()}>
            <div style={S.confirmTitle}>Delete listing?</div>
            <p style={S.confirmSub}>This cannot be undone.</p>
            <div style={S.confirmBtns}>
              <button style={S.confirmCancel} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button style={S.confirmDelete} onClick={() => deleteListing(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Status Picker modal */}
      {showStatusPicker && (
        <div style={S.overlay} onClick={() => setShowStatusPicker(false)}>
          <div style={{ ...S.confirmCard, width: '100%', maxWidth: 480, borderRadius: '24px 24px 0 0', padding: '24px 20px 32px', textAlign: 'left' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#0f1410' }}>Post a Status</div>
              <button onClick={() => setShowStatusPicker(false)} style={{ background: 'none', border: 'none', fontSize: 20, color: '#9ca3af', cursor: 'pointer', lineHeight: 1 }}>✕</button>
            </div>
            <StatusPicker userId={user?.id} onDone={() => setShowStatusPicker(false)} />
          </div>
        </div>
      )}

      {/* Verification modal */}
      {showVerify && (
        <VerificationModal
          user={user}
          onClose={() => setShowVerify(false)}
          onSuccess={() => {
            setShowVerify(false)
            loadProfile(user.id)
          }}
        />
      )}

      <BottomNav />
    </div>
  )
}

const S = {
  page: { minHeight: '100vh', background: '#f0f4f1', paddingBottom: '90px', fontFamily: 'system-ui, sans-serif' },
  loadWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' },
  spinner: { width: '28px', height: '28px', border: '3px solid #e0ebe3', borderTopColor: '#1a7a4a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  header: { background: '#fff', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e8f0eb', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  headerTitle: { fontSize: '20px', fontWeight: '800', color: '#0f1410' },
  signOutBtn: { background: 'none', border: '1.5px solid #e0ebe3', borderRadius: '10px', padding: '6px 14px', fontSize: '13px', color: '#637068', cursor: 'pointer', fontWeight: '600' },
  heroCard: { background: '#fff', margin: '14px', borderRadius: '20px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', animation: 'fadeUp 0.3s ease both' },
  avatarWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: '16px' },
  avatar: { width: '88px', height: '88px', borderRadius: '50%', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', position: 'relative', boxShadow: '0 4px 14px rgba(26,122,74,0.25)' },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },
  avatarInitial: { fontSize: '36px', fontWeight: '800', color: '#fff' },
  avatarOverlay: { position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  changePhotoBtn: { marginTop: '10px', background: 'none', border: 'none', color: '#1a7a4a', fontSize: '13px', fontWeight: '700', cursor: 'pointer' },
  nameSection: { textAlign: 'center' },
  nameText: { fontSize: '20px', fontWeight: '800', color: '#0f1410', marginBottom: '4px' },
  emailText: { fontSize: '13px', color: '#888', marginBottom: '4px' },
  cityText: { fontSize: '13px', color: '#637068', marginBottom: '12px' },
  editBtn: { background: '#f0f4f1', border: 'none', borderRadius: '10px', padding: '8px 18px', fontSize: '13px', fontWeight: '700', color: '#1a7a4a', cursor: 'pointer' },
  editForm: { marginTop: '4px' },
  label: { fontSize: '11px', fontWeight: '700', color: '#637068', display: 'block', marginBottom: '4px', marginTop: '12px', textTransform: 'uppercase', letterSpacing: '0.4px' },
  input: { width: '100%', border: '1.5px solid #e0ebe3', borderRadius: '12px', padding: '10px 13px', fontSize: '15px', background: '#fafcfb', boxSizing: 'border-box', transition: 'border-color 0.2s' },
  saveMsg: { fontSize: '13px', color: '#1a7a4a', fontWeight: '700', marginTop: '8px' },
  editBtns: { display: 'flex', gap: '10px', marginTop: '14px' },
  cancelBtn: { flex: 1, background: '#f0f4f1', border: 'none', borderRadius: '12px', padding: '11px', fontSize: '14px', fontWeight: '600', color: '#637068', cursor: 'pointer' },
  saveBtn: { flex: 1, background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', border: 'none', borderRadius: '12px', padding: '11px', fontSize: '14px', fontWeight: '700', color: '#fff', cursor: 'pointer' },
  statsRow: { display: 'flex', background: '#fff', margin: '0 14px 14px', borderRadius: '16px', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', overflow: 'hidden' },
  statBox: { flex: 1, textAlign: 'center', padding: '14px 0' },
  statNum: { fontSize: '22px', fontWeight: '800', color: '#0f1410' },
  statLabel: { fontSize: '11px', color: '#888', marginTop: '2px', textTransform: 'uppercase', letterSpacing: '0.4px' },
  statDivider: { width: '1px', background: '#e8f0eb', margin: '10px 0' },
  tabs: { display: 'flex', margin: '0 14px 12px', background: '#fff', borderRadius: '14px', padding: '4px', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  tab: { flex: 1, background: 'none', border: 'none', borderRadius: '10px', padding: '9px 0', fontSize: '13px', fontWeight: '600', color: '#888', cursor: 'pointer', transition: 'all 0.2s' },
  tabActive: { background: '#1a7a4a', color: '#fff', boxShadow: '0 2px 8px rgba(26,122,74,0.3)' },
  grid: { padding: '0 14px', display: 'flex', flexDirection: 'column', gap: '12px' },
  empty: { textAlign: 'center', padding: '50px 24px' },
  emptyIcon: { fontSize: '48px', marginBottom: '10px' },
  emptyTitle: { fontSize: '17px', fontWeight: '700', color: '#0f1410', marginBottom: '6px' },
  emptySub: { fontSize: '13px', color: '#888', marginBottom: '18px' },
  postBtn: { background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  card: { background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 1px 5px rgba(0,0,0,0.07)', display: 'flex', animation: 'fadeUp 0.3s ease both', border: '1px solid #eef3ef' },
  thumb: { width: '90px', flexShrink: 0, position: 'relative', background: '#f0f4f1' },
  thumbImg: { width: '90px', height: '90px', objectFit: 'cover' },
  thumbPlaceholder: { width: '90px', height: '90px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px' },
  soldBadge: { position: 'absolute', top: '6px', left: '6px', background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: '9px', fontWeight: '800', borderRadius: '5px', padding: '2px 5px', letterSpacing: '0.5px' },
  cardBody: { flex: 1, padding: '12px', minWidth: 0 },
  cardTitle: { fontSize: '14px', fontWeight: '700', color: '#0f1410', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginBottom: '4px' },
  cardPrice: { fontSize: '15px', fontWeight: '800', color: '#1a7a4a', marginBottom: '4px' },
  cardCity: { fontSize: '12px', color: '#888' },
  cardActions: { display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '6px', padding: '10px 10px 10px 0' },
  actionBtn: { border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: '700', cursor: 'pointer', whiteSpace: 'nowrap' },
  actionBtnGreen: { background: '#e6f7ee', color: '#1a7a4a' },
  actionBtnGhost: { background: '#f0f4f1', color: '#637068' },
  deleteBtn: { background: '#fff0f0', border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '14px', cursor: 'pointer' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  confirmCard: { background: '#fff', borderRadius: '20px', padding: '24px', width: '280px', textAlign: 'center' },
  confirmTitle: { fontSize: '17px', fontWeight: '800', color: '#0f1410', marginBottom: '6px' },
  confirmSub: { fontSize: '13px', color: '#888', marginBottom: '20px' },
  confirmBtns: { display: 'flex', gap: '10px' },
  confirmCancel: { flex: 1, background: '#f0f4f1', border: 'none', borderRadius: '12px', padding: '11px', fontSize: '14px', fontWeight: '600', color: '#637068', cursor: 'pointer' },
  confirmDelete: { flex: 1, background: '#e74c3c', border: 'none', borderRadius: '12px', padding: '11px', fontSize: '14px', fontWeight: '700', color: '#fff', cursor: 'pointer' },
  editListingBtn: { background: '#e8f4ff', border: 'none', borderRadius: '8px', padding: '6px 10px', fontSize: '11px', fontWeight: '700', color: '#1d4ed8', cursor: 'pointer', whiteSpace: 'nowrap' },
}