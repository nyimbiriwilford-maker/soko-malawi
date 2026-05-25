import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ListingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [listing, setListing] = useState(null)
  const [seller, setSeller] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [mediaIndex, setMediaIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadListing()
  }, [id])

  async function loadListing() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)

    const { data } = await supabase.from('listings').select('*').eq('id', id).single()
    setListing(data)

    if (data?.seller_id) {
      const { data: sellerData } = await supabase.from('users').select('*').eq('id', data.seller_id).single()
      setSeller(sellerData)
    }
    setLoading(false)
  }

  if (loading) return <div style={styles.center}>Loading...</div>
  if (!listing) return <div style={styles.center}>Listing not found</div>

  const allMedia = [
    ...(listing.images || []).map(url => ({ url, type: 'image' })),
    ...(listing.videos || []).map(url => ({ url, type: 'video' })),
  ]
  const isOwner = currentUser?.id === listing.seller_id

  return (
    <div style={styles.page}>
      {/* Top bar */}
      <div style={styles.topbar}>
        <button style={styles.back} onClick={() => navigate('/')}>← Back</button>
        <div style={styles.topTitle}>{listing.category}</div>
        {isOwner
          ? <button style={styles.deleteBtn} onClick={async () => {
              if (!window.confirm('Delete this listing?')) return
              await supabase.from('listings').delete().eq('id', id)
              navigate('/')
            }}>Delete</button>
          : <div style={{ width: 60 }} />
        }
      </div>

      {/* Media viewer */}
      {allMedia.length > 0 ? (
        <div style={styles.mediaWrap}>
          {allMedia[mediaIndex].type === 'image'
            ? <img src={allMedia[mediaIndex].url} alt="" style={styles.mainMedia} />
            : <video src={allMedia[mediaIndex].url} controls style={styles.mainMedia} />
          }
          {allMedia.length > 1 && (
            <>
              <button style={{ ...styles.arrow, left: 8 }} onClick={() => setMediaIndex(i => (i - 1 + allMedia.length) % allMedia.length)}>‹</button>
              <button style={{ ...styles.arrow, right: 8 }} onClick={() => setMediaIndex(i => (i + 1) % allMedia.length)}>›</button>
              <div style={styles.dots}>
                {allMedia.map((_, i) => (
                  <div key={i} style={{ ...styles.dot, background: i === mediaIndex ? '#1a7a4a' : '#ccc' }} onClick={() => setMediaIndex(i)} />
                ))}
              </div>
            </>
          )}
          {/* Thumbnails */}
          {allMedia.length > 1 && (
            <div style={styles.thumbRow}>
              {allMedia.map((m, i) => (
                <div key={i} style={{ ...styles.thumb, border: i === mediaIndex ? '2px solid #1a7a4a' : '2px solid transparent' }} onClick={() => setMediaIndex(i)}>
                  {m.type === 'image'
                    ? <img src={m.url} alt="" style={styles.thumbInner} />
                    : <video src={m.url} style={styles.thumbInner} muted />
                  }
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div style={styles.noMedia}>🛒</div>
      )}

      {/* Details */}
      <div style={styles.body}>
        <div style={styles.topRow}>
          <div style={styles.price}>MWK {listing.price?.toLocaleString()}</div>
          <span style={styles.catBadge}>{listing.category}</span>
        </div>
        <div style={styles.title}>{listing.title}</div>
        <div style={styles.meta}>📍 {listing.city} · {new Date(listing.created_at).toLocaleDateString()}</div>

        {listing.description && (
          <>
            <div style={styles.sectionTitle}>Description</div>
            <div style={styles.description}>{listing.description}</div>
          </>
        )}

        {/* Seller */}
        <div style={styles.sectionTitle}>Seller</div>
        <div style={styles.sellerCard}>
          <div style={styles.avatar}>{(seller?.name || 'U')[0].toUpperCase()}</div>
          <div>
            <div style={styles.sellerName}>{seller?.name || 'Anonymous'}</div>
            <div style={styles.sellerCity}>{seller?.city || listing.city}</div>
          </div>
        </div>

        {/* Action buttons */}
        {!isOwner && (
          <div style={styles.actions}>
            <button style={styles.chatBtn} onClick={() => navigate(`/chat/${listing.seller_id}/${listing.id}`)}>
              💬 Chat with Seller
            </button>
          </div>
        )}
        {isOwner && (
          <div style={styles.ownerNote}>This is your listing</div>
        )}
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#f4f8f5', paddingBottom: '40px' },
  center: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#888' },
  topbar: { background: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #d8e5dc' },
  back: { background: 'none', border: 'none', fontSize: '14px', color: '#1a7a4a', fontWeight: '600', cursor: 'pointer', width: 60 },
  topTitle: { fontSize: '15px', fontWeight: '600', color: '#637068' },
  deleteBtn: { background: 'none', border: 'none', fontSize: '13px', color: '#c0392b', fontWeight: '600', cursor: 'pointer', width: 60, textAlign: 'right' },
  mediaWrap: { background: '#000', position: 'relative' },
  mainMedia: { width: '100%', maxHeight: '320px', objectFit: 'contain', display: 'block' },
  arrow: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: 'rgba(0,0,0,0.5)', color: '#fff', border: 'none', borderRadius: '50%', width: '36px', height: '36px', fontSize: '22px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dots: { display: 'flex', justifyContent: 'center', gap: '6px', padding: '8px 0', background: '#000' },
  dot: { width: '7px', height: '7px', borderRadius: '50%', cursor: 'pointer' },
  thumbRow: { display: 'flex', gap: '6px', padding: '8px', background: '#111', overflowX: 'auto' },
  thumb: { width: '56px', height: '56px', borderRadius: '6px', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' },
  thumbInner: { width: '100%', height: '100%', objectFit: 'cover' },
  noMedia: { height: '200px', background: '#e8f4ee', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '60px' },
  body: { padding: '16px' },
  topRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' },
  price: { fontSize: '24px', fontWeight: '800', color: '#1a7a4a' },
  catBadge: { background: '#e6f7ee', color: '#1a7a4a', borderRadius: '6px', padding: '3px 10px', fontSize: '12px', fontWeight: '600' },
  title: { fontSize: '20px', fontWeight: '700', color: '#0f1410', marginBottom: '6px' },
  meta: { fontSize: '13px', color: '#888', marginBottom: '16px' },
  sectionTitle: { fontSize: '13px', fontWeight: '700', color: '#637068', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', marginTop: '16px' },
  description: { fontSize: '15px', color: '#333', lineHeight: '1.7', background: '#fff', borderRadius: '10px', padding: '12px' },
  sellerCard: { display: 'flex', alignItems: 'center', gap: '12px', background: '#fff', borderRadius: '10px', padding: '12px' },
  avatar: { width: '44px', height: '44px', borderRadius: '50%', background: '#1a7a4a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: '700', flexShrink: 0 },
  sellerName: { fontSize: '15px', fontWeight: '600', color: '#0f1410' },
  sellerCity: { fontSize: '12px', color: '#888', marginTop: '2px' },
  actions: { marginTop: '20px' },
  chatBtn: { width: '100%', background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '12px', padding: '15px', fontSize: '16px', fontWeight: '600', cursor: 'pointer' },
  ownerNote: { marginTop: '20px', textAlign: 'center', color: '#888', fontSize: '14px', background: '#fff', borderRadius: '10px', padding: '12px' },
}