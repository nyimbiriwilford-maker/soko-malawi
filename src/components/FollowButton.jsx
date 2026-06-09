import { useFollow } from '../hooks/useFollow'

export default function FollowButton({ currentUserId, sellerId, size = 'sm' }) {
  const { following, toggle, loading } = useFollow(currentUserId, sellerId)
  if (!currentUserId || !sellerId || currentUserId === sellerId) return null

  const isSmall = size === 'sm'
  return (
    <button
      onClick={e => { e.stopPropagation(); toggle() }}
      disabled={loading}
      style={{
        padding: isSmall ? '4px 10px' : '7px 18px',
        fontSize: isSmall ? 11 : 13,
        fontWeight: 600,
        borderRadius: 20,
        border: following ? '1.5px solid rgba(255,255,255,0.4)' : 'none',
        background: following
          ? 'rgba(255,255,255,0.12)'
          : 'linear-gradient(135deg, #f9a825, #e65100)',
        color: '#fff',
        cursor: loading ? 'default' : 'pointer',
        opacity: loading ? 0.7 : 1,
        whiteSpace: 'nowrap',
        transition: 'all 0.2s',
      }}
    >
      {following ? '✓ Following' : '+ Follow'}
    </button>
  )
}