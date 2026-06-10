import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function FollowingManager({ userId }) {
  const [following, setFollowing] = useState([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!userId) return
    supabase
      .from('seller_follows')
      .select('id, created_at, seller_id, seller:profiles!seller_follows_seller_id_fkey(full_name, avatar_url)')
      .eq('follower_id', userId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setFollowing(data || [])
        setLoading(false)
      })
  }, [userId])

  const unfollow = async (followId) => {
    setRemoving(followId)
    await supabase.from('seller_follows').delete().eq('id', followId)
    setFollowing(prev => prev.filter(f => f.id !== followId))
    setRemoving(null)
  }

  const timeAgo = (ts) => {
    const diff = Date.now() - new Date(ts).getTime()
    const d = Math.floor(diff / 86400000)
    const h = Math.floor(diff / 3600000)
    const m = Math.floor(diff / 60000)
    if (d > 0) return `${d}d ago`
    if (h > 0) return `${h}h ago`
    if (m > 0) return `${m}m ago`
    return 'Just now'
  }

  return (
    <div style={{ padding: '0 0 8px' }}>

      {/* Section header */}
      <div style={{
        padding: '14px 16px 10px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 16 }}>🏪</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#0f1410' }}>
            Shops You Follow
          </span>
          <span style={{
            background: '#f9a825', color: '#fff',
            fontSize: 11, fontWeight: 700,
            borderRadius: 20, padding: '1px 8px',
            minWidth: 20, textAlign: 'center',
          }}>
            {loading ? '…' : following.length}
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
          You get notified on new posts
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#e8f0eb', margin: '0 16px 10px' }} />

      {loading ? (
        <div style={{ padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
          Loading…
        </div>
      ) : following.length === 0 ? (
        <div style={{ padding: '28px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
            Not following anyone yet
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
            Follow sellers to get notified when they post new statuses.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 10px' }}>
          {following.map(f => {
            const name = f.seller?.full_name || 'Unknown'
            const avatar = f.seller?.avatar_url
            const initials = name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

            return (
              <div key={f.id} style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                padding: '10px 12px',
                background: '#f9fafb',
                borderRadius: 14,
                border: '1px solid #e8f0eb',
              }}>
                {/* Avatar */}
                <div style={{
                  width: 44, height: 44, borderRadius: '50%',
                  background: avatar ? 'transparent' : 'linear-gradient(135deg, #e65100, #f9a825)',
                  overflow: 'hidden', flexShrink: 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, fontWeight: 700, color: '#fff',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.08)',
                }}>
                  {avatar
                    ? <img src={avatar} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initials}
                </div>

                {/* Name + time */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 14, fontWeight: 700, color: '#0f1410',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{name}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>
                    🕐 Following since {timeAgo(f.created_at)}
                  </div>
                </div>

                {/* View profile */}
                <button
                  onClick={() => navigate('/profile/' + f.seller_id)}
                  style={{
                    padding: '5px 11px',
                    fontSize: 11, fontWeight: 600,
                    borderRadius: 20,
                    border: '1.5px solid #d1fae5',
                    background: '#f0faf4',
                    color: '#1a7a4a',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  View
                </button>

                {/* Unfollow */}
                <button
                  onClick={() => unfollow(f.id)}
                  disabled={removing === f.id}
                  style={{
                    padding: '5px 11px',
                    fontSize: 11, fontWeight: 600,
                    borderRadius: 20,
                    border: '1.5px solid #fecaca',
                    background: '#fff5f5',
                    color: '#ef4444',
                    cursor: removing === f.id ? 'default' : 'pointer',
                    opacity: removing === f.id ? 0.5 : 1,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {removing === f.id ? '…' : 'Unfollow'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}