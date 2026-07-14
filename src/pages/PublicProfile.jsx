import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import VouchSection from '../components/VouchSection'
import TrustBadge from '../components/TrustBadge'
import FollowButton from '../components/FollowButton'
import FollowersManager from '../components/FollowersManager'
import { useVouchData } from '../hooks/useVouchData'

/* ═══════════════════════════════════════════════════════════════════════════
   Public seller profile — what buyers check before messaging:
   photo, real name, verified, city, join date, online status,
   trust tier + deals, followers, active inventory, vouches
   ═══════════════════════════════════════════════════════════════════════════ */

const VerifiedSeal = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#16a34a" d="M12 0a4 4 0 0 1 3.2 1.6 4 4 0 0 1 3.6 1 4 4 0 0 1 1 3.6A4 4 0 0 1 21.4 9.4a4 4 0 0 1 0 5.2A4 4 0 0 1 19.8 17.8a4 4 0 0 1-1 3.6 4 4 0 0 1-3.6 1A4 4 0 0 1 12 24a4 4 0 0 1-3.2-1.6 4 4 0 0 1-3.6-1 4 4 0 0 1-1-3.6A4 4 0 0 1 2.6 14.6a4 4 0 0 1 0-5.2A4 4 0 0 1 4.2 6.2a4 4 0 0 1 1-3.6 4 4 0 0 1 3.6-1A4 4 0 0 1 12 0Z" />
    <path d="m7.5 12.5 3 3 6-7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

function getOnlineStatus(lastSeen) {
  if (!lastSeen) return { label: 'Offline', color: '#9ca3af' }
  const mins = Math.floor((Date.now() - new Date(lastSeen)) / 60000)
  if (mins < 5) return { label: 'Online now', color: '#15803d' }
  if (mins < 60) return { label: `Active ${mins}m ago`, color: '#d97706' }
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return { label: `Active ${hrs}h ago`, color: '#9ca3af' }
  return { label: 'Offline', color: '#9ca3af' }
}

export default function PublicProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [listings, setListings] = useState([])
  const [soldCount, setSoldCount] = useState(0)
  const [followerCount, setFollowerCount] = useState(0)
  const [shop, setShop] = useState(null)
  const [loading, setLoading] = useState(true)
  const [currentUserId, setCurrentUserId] = useState(null)
  const { trustScore, dealCount, loading: trustLoading } = useVouchData(id, currentUserId)

  useEffect(() => { load() }, [id])

  async function load() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUserId(user?.id ?? null)

    const { data: p } = await supabase.from('profiles').select('*').eq('id', id).single()
    setProfile(p)

    const [activeRes, soldRes, folRes, shopRes] = await Promise.all([
      supabase.from('listings').select('*')
        .eq('seller_id', id).eq('status', 'active').order('created_at', { ascending: false }),
      supabase.from('listings').select('id', { count: 'exact', head: true })
        .eq('seller_id', id).eq('status', 'sold'),
      supabase.from('seller_follows').select('id', { count: 'exact', head: true })
        .eq('seller_id', id),
      supabase.from('shops').select('id, name, slug, is_verified, logo_url, city')
        .eq('owner_id', id).maybeSingle(),
    ])

    setListings(activeRes.data || [])
    setSoldCount(soldRes.count || 0)
    setFollowerCount(folRes.count || 0)
    setShop(shopRes.data || null)
    setLoading(false)

    // Record profile view (throttled server-side 30 min)
    if (id) {
      try {
        let sessionKey = null
        try {
          sessionKey = sessionStorage.getItem('soko_view_session')
          if (!sessionKey) {
            sessionKey = `s_${Math.random().toString(36).slice(2)}_${Date.now()}`
            sessionStorage.setItem('soko_view_session', sessionKey)
          }
        } catch { /* private mode */ }
        await supabase.rpc('record_profile_view', {
          p_profile_id: id,
          p_session_key: sessionKey,
          p_source: 'public_profile',
        })
      } catch { /* RPC may not be migrated yet */ }
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f4f6f5' }}>
        <div style={{ width: 30, height: 30, border: '3px solid #e0ebe3', borderTopColor: '#0F9D58', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    )
  }

  if (!profile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#f4f6f5', fontFamily: 'system-ui,sans-serif' }}>
        <div style={{ fontSize: 48, marginBottom: 12 }}>👤</div>
        <div style={{ fontSize: 18, fontWeight: 700 }}>User not found</div>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{ marginTop: 16, background: '#0F9D58', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
        >
          Go Back
        </button>
      </div>
    )
  }

  const status = getOnlineStatus(profile.last_seen)
  const isOwnProfile = currentUserId === profile?.id
  const memberSince = profile.created_at
    ? new Date(profile.created_at).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : null
  const shopPath = shop
    ? (shop.slug ? `/shop/${shop.slug}` : `/shop/${shop.id}`)
    : null

  return (
    <div style={{ minHeight: '100vh', background: '#f4f6f5', fontFamily: 'Inter, system-ui, sans-serif', maxWidth: 520, margin: '0 auto', paddingBottom: 40 }}>
      <style>{`
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* Header — SokoMw brand */}
      <div style={{
        background: 'linear-gradient(180deg, rgba(255,255,255,.98), rgba(255,255,255,.94))',
        backdropFilter: 'blur(12px)',
        padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
        borderBottom: '1px solid rgba(15,157,88,.12)',
        boxShadow: '0 1px 0 rgba(249,171,0,.12)',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          style={{ width: 36, height: 36, borderRadius: 10, background: '#e8f5ee', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0a7a44" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'Sora, system-ui, sans-serif', fontSize: 15, fontWeight: 800, letterSpacing: '-0.03em' }}>
            <span style={{ color: '#0F9D58' }}>Soko</span>
            <span style={{ color: '#F9AB00' }}>Mw</span>
            <span style={{ color: '#0f1410', marginLeft: 6, fontSize: 14 }}>Seller</span>
          </div>
          <div style={{ fontSize: 11, color: '#0a7a44', fontWeight: 600 }}>Check trust before you deal</div>
        </div>
        {isOwnProfile && (
          <button
            type="button"
            onClick={() => navigate('/profile')}
            style={{ border: 'none', background: 'linear-gradient(135deg,#0F9D58,#0a7a44)', color: '#fff', borderRadius: 999, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', boxShadow: '0 2px 8px rgba(15,157,88,.28)' }}
          >
            Edit hub
          </button>
        )}
      </div>

      {/* Identity card with brand banner / cover photo */}
      <div style={{
        background: '#fff', margin: 14, borderRadius: 20, overflow: 'hidden',
        boxShadow: '0 8px 28px rgba(6,61,35,.08)', border: '1px solid rgba(15,157,88,.12)',
        textAlign: 'center', animation: 'fadeUp 0.3s ease both',
      }}>
        <div style={{
          position: 'relative',
          width: '100%',
          aspectRatio: profile.cover_url ? '2.7 / 1' : '16 / 5',
          minHeight: profile.cover_url ? 160 : 72,
          maxHeight: profile.cover_url ? 280 : 120,
          background: 'linear-gradient(135deg, #063d23 0%, #0a7a44 45%, #0F9D58 100%)',
          overflow: 'hidden',
        }}>
          {profile.cover_url && (
            <img
              src={profile.cover_url}
              alt=""
              decoding="async"
              style={{
                position: 'absolute', inset: 0, width: '100%', height: '100%',
                objectFit: 'cover', objectPosition: 'center center', display: 'block',
              }}
            />
          )}
          <div style={{
            position: 'absolute', inset: 0,
            background: profile.cover_url
              ? 'linear-gradient(180deg, rgba(0,0,0,.22) 0%, rgba(0,0,0,.06) 45%, rgba(0,0,0,.35) 100%)'
              : 'transparent',
            pointerEvents: 'none',
          }} />
          {!profile.cover_url && (
            <div style={{
              position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', zIndex: 1,
              fontFamily: 'Sora, system-ui, sans-serif', fontSize: 13, fontWeight: 800,
              color: '#fff', textShadow: '0 1px 6px rgba(0,0,0,.35)',
            }}>
              Soko<span style={{ color: '#F9AB00' }}>Mw</span>
            </div>
          )}
          <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: 'linear-gradient(90deg, #F9AB00, #ffd666 40%, #0F9D58)', zIndex: 1 }} />
        </div>
        <div style={{ padding: '0 20px 20px' }}>
        <div style={{
          width: 88, height: 88, borderRadius: '50%',
          background: 'linear-gradient(145deg, #F9AB00, #0F9D58 55%, #0a7a44)',
          padding: 3, margin: '-40px auto 12px',
          boxShadow: '0 6px 20px rgba(15,157,88,.28), 0 0 0 3px #fff',
        }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden',
            background: 'linear-gradient(135deg,#0F9D58,#0a7a44)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '3px solid #fff', boxSizing: 'border-box',
          }}>
            {profile.avatar_url
              ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <span style={{ fontSize: 32, fontWeight: 800, color: '#fff' }}>{(profile.full_name || 'U')[0].toUpperCase()}</span>
            }
          </div>
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          marginBottom: 8, flexWrap: 'wrap', maxWidth: '100%',
        }}>
          <div style={{
            fontSize: 20, fontWeight: 800, color: '#0f1410', letterSpacing: '-0.02em',
            display: 'inline-flex', alignItems: 'center', gap: 6, lineHeight: 1.2,
          }}>
            {profile.full_name || 'Anonymous'}
            {profile.is_verified && (
              <span title="Verified" style={{ display: 'inline-flex', flexShrink: 0 }}>
                <VerifiedSeal size={18} />
              </span>
            )}
          </div>
        </div>

        {!trustLoading && (
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
            <TrustBadge trustScore={trustScore} dealCount={dealCount} />
          </div>
        )}

        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 14px', fontSize: 13, color: '#5f6368', marginBottom: 8 }}>
          {profile.city && <span>📍 {profile.city}</span>}
          {memberSince && <span>Joined {memberSince}</span>}
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 600, color: status.color, marginBottom: 4 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: status.color, display: 'inline-block' }} />
          {status.label}
        </div>

        {shop && shopPath && (
          <button
            type="button"
            onClick={() => navigate(shopPath)}
            style={{
              display: 'block', margin: '12px auto 0',
              border: '1.5px solid #e0ebe3', background: '#f6fbf8',
              color: '#0a7a44', borderRadius: 12, padding: '8px 14px',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >
            🏪 Visit shop · {shop.name}
          </button>
        )}

        {!isOwnProfile && (
          <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
            <FollowButton currentUserId={currentUserId} sellerId={profile?.id} size="lg" />
            <button
              type="button"
              onClick={() => navigate(`/chat/${profile.id}`)}
              style={{
                border: 'none', borderRadius: 12,
                background: 'linear-gradient(135deg,#0F9D58,#0a7a44)',
                color: '#fff', fontWeight: 700, fontSize: 13,
                padding: '10px 20px', cursor: 'pointer',
                boxShadow: '0 2px 10px rgba(15,157,88,.3)',
              }}
            >
              💬 Message seller
            </button>
          </div>
        )}
        </div>
      </div>

      {/* Followers manager — owner only */}
      {isOwnProfile && (
        <div style={{ background: '#fff', margin: '0 14px 14px', borderRadius: 16, boxShadow: '0 1px 6px rgba(0,0,0,0.05)', overflow: 'hidden', border: '1px solid rgba(15,23,42,.06)' }}>
          <FollowersManager sellerId={profile?.id} />
        </div>
      )}

      {/* Stats — trust-oriented */}
      <div style={{
        background: '#fff', margin: '0 14px 14px', borderRadius: 16,
        display: 'flex', overflow: 'hidden',
        boxShadow: '0 1px 6px rgba(0,0,0,0.05)', border: '1px solid rgba(15,23,42,.06)',
      }}>
        {[
          { n: listings.length, l: 'Active' },
          { n: soldCount, l: 'Sold' },
          { n: dealCount || 0, l: 'Deals' },
          { n: followerCount, l: 'Followers' },
        ].map((s, i) => (
          <div key={s.l} style={{ flex: 1, textAlign: 'center', padding: '14px 0', borderRight: i < 3 ? '1px solid #f0f2f1' : 'none' }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: '#0f1410', letterSpacing: '-0.03em' }}>{s.n}</div>
            <div style={{ fontSize: 10, color: '#9aa0a6', textTransform: 'uppercase', letterSpacing: '0.4px', fontWeight: 650 }}>{s.l}</div>
          </div>
        ))}
      </div>

      {/* Trust & vouches */}
      <div style={{ margin: '0 14px 14px' }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: '#637068',
          textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 8, paddingLeft: 2,
        }}>
          Trust & reputation
        </div>
        <div style={{ background: '#fff', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(15,23,42,.06)', boxShadow: '0 1px 6px rgba(0,0,0,0.05)' }}>
          <VouchSection targetUserId={id} viewerUserId={currentUserId} />
        </div>
      </div>

      {/* Active inventory */}
      <div style={{ padding: '0 14px' }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: '#637068',
          textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10,
        }}>
          For sale ({listings.length})
        </div>
        {listings.length === 0 && (
          <div style={{
            textAlign: 'center', padding: '36px 16px', color: '#9aa0a6', fontSize: 14,
            background: '#fff', borderRadius: 16, border: '1px solid rgba(15,23,42,.05)',
          }}>
            No active listings right now
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {listings.map((l, i) => (
            <button
              key={l.id}
              type="button"
              onClick={() => navigate('/listing/' + l.id)}
              style={{
                background: '#fff', borderRadius: 14, overflow: 'hidden', cursor: 'pointer',
                boxShadow: '0 1px 5px rgba(0,0,0,0.06)', border: '1px solid #eef3ef',
                animation: `fadeUp 0.3s ease ${i * 0.04}s both`,
                padding: 0, textAlign: 'left', fontFamily: 'inherit',
              }}
            >
              <div style={{ height: 110, background: '#f0f4f1', overflow: 'hidden', position: 'relative' }}>
                {l.images?.[0]
                  ? <img src={l.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 32 }}>📦</div>
                }
                {(l.featured || l.is_featured) && (
                  <span style={{
                    position: 'absolute', bottom: 6, left: 6,
                    background: '#FF7A1A', color: '#fff',
                    fontSize: 9, fontWeight: 800, borderRadius: 999, padding: '2px 7px',
                  }}>
                    Featured
                  </span>
                )}
              </div>
              <div style={{ padding: '8px 10px' }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#0f1410', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{l.title}</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#0F9D58', marginTop: 2 }}>MWK {Number(l.price || 0).toLocaleString()}</div>
                <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>📍 {l.district || l.city || 'Malawi'}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
