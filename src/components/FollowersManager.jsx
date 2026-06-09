import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function FollowersManager({ sellerId }) {
  const [followers, setFollowers] = useState([])
  const [loading, setLoading] = useState(true)
  const [removing, setRemoving] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!sellerId) return
    supabase
      .from('seller_follows')
      .select('id, created_at, follower_id, follower:profiles!follower_id(full_name, avatar_url)')
      .eq('seller_id', sellerId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setFollowers(data || [])
        setLoading(false)
      })
  }, [sellerId])

  const remove = async (followId) => {
    setRemoving(followId)
    await supabase.from('seller_follows').delete().eq('id', followId)
    setFollowers(prev => prev.filter(f => f.id !== followId))
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
          <span style={{ fontSize: 16 }}>👥</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#0f1410' }}>
            Your Followers
          </span>
          <span style={{
            background: '#1a7a4a', color: '#fff',
            fontSize: 11, fontWeight: 700,
            borderRadius: 20, padding: '1px 8px',
            minWidth: 20, textAlign: 'center',
          }}>
            {loading ? '…' : followers.length}
          </span>
        </div>
        <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500 }}>
          People who follow your shop
        </span>
      </div>

      {/* Divider */}
      <div style={{ height: 1, background: '#e8f0eb', margin: '0 16px 10px' }} />

      {loading ? (
        <div style={{ padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
          Loading…
        </div>
      ) : followers.length === 0 ? (
        <div style={{ padding: '28px 16px', textAlign: 'center' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>🌱</div>
          <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 4 }}>
            No followers yet
          </div>
          <div style={{ fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
            Post statuses regularly to grow your audience.{'\n'}Followers get notified every time you post.
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 10px' }}>
          {followers.map(f => {
            const name = f.follower?.full_name || 'Unknown'
            const avatar = f.follower?.avatar_url
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
                  background: avatar ? 'transparent' : 'linear-gradient(135deg, #1a7a4a, #22a05e)',
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
                    🕐 Followed {timeAgo(f.created_at)}
                  </div>
                </div>

                {/* View profile */}
                <button
                  onClick={() => navigate('/profile/' + f.follower_id)}
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

                {/* Remove */}
                <button
                  onClick={() => remove(f.id)}
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
                  {removing === f.id ? '…' : 'Remove'}
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}