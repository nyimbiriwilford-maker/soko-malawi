import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isStatusVideoUrl, isStatusColorBoard } from '../utils/statusVideo'
import StoryViewer from '../components/StoryViewer'
import StatusTextBoard from '../components/StatusTextBoard'

export default function SavedStatusesPage() {
  const navigate = useNavigate()
  const [user, setUser]     = useState(null)
  const [saved, setSaved]   = useState([])
  const [loading, setLoading] = useState(true)
  const [viewing, setViewing] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate('/login'); return }
      setUser(user)
      loadSaved(user.id)
    })
  }, [])

  async function loadSaved(userId) {
    setLoading(true)
    const { data } = await supabase
      .from('saved_statuses')
      .select(`
        id, created_at,
        status:status_id (
          id, content, status_type, expires_at, created_at,
          media_urls, tagged_listing_id, user_id, location_hint,
          profiles:user_id ( id, full_name, avatar_url, is_verified ),
          tagged:tagged_listing_id ( id, title, price, images )
        )
      `)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })

    // Filter out expired or deleted statuses
    const valid = (data || [])
      .filter(s => s.status && new Date(s.status.expires_at) > new Date())
    setSaved(valid)
    setLoading(false)
  }

  async function unsave(savedId) {
    await supabase.from('saved_statuses').delete().eq('id', savedId)
    setSaved(prev => prev.filter(s => s.id !== savedId))
  }

  const stories = saved.map(s => s.status)

  function timeLeft(expires_at) {
    const ms = new Date(expires_at) - Date.now()
    const h  = Math.floor(ms / 3600000)
    const m  = Math.floor((ms % 3600000) / 60000)
    return h >= 1 ? `${h}h left` : `${m}m left`
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#f7f8f6',
      fontFamily: "'DM Sans', system-ui, sans-serif",
      paddingBottom: 100,
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 100,
        background: '#fff', borderBottom: '1px solid #e5e7eb',
        padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: '#f3f4f6', border: 'none', borderRadius: '50%',
          width: 36, height: 36, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: 'pointer', fontSize: 16,
        }}>←</button>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f1410' }}>Saved Statuses</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Statuses you saved from sellers</div>
        </div>
      </div>

      <div style={{ padding: 16 }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 40, color: '#9ca3af', fontSize: 14 }}>
            Loading...
          </div>
        ) : saved.length === 0 ? (
          <div style={{
            textAlign: 'center', padding: '60px 20px',
            color: '#9ca3af',
          }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🤍</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 6 }}>
              No saved statuses
            </div>
            <div style={{ fontSize: 13 }}>
              When viewing a seller's status, tap ❤️ Save to keep it here.
            </div>
            <button
              onClick={() => navigate('/status')}
              style={{
                marginTop: 20,
                background: 'linear-gradient(135deg,#1a7a4a,#22a05e)',
                color: '#fff', border: 'none', borderRadius: 50,
                padding: '12px 28px', fontSize: 14, fontWeight: 700,
                cursor: 'pointer',
              }}
            >Browse Statuses</button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {saved.map((item, i) => {
              const s = item.status
              const name   = s.profiles?.full_name || 'Seller'
              const avatar = s.profiles?.avatar_url
              const initial = name[0].toUpperCase()
              const media  = s.media_urls?.[0]

              return (
                <div
                  key={item.id}
                  style={{
                    background: '#fff', borderRadius: 16,
                    border: '1px solid #e5e7eb',
                    overflow: 'hidden', cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                  }}
                >
                  {/* Media banner */}
                  {media && (
                    <div
                      onClick={() => setViewing(i)}
                      style={{ width: '100%', height: 140, overflow: 'hidden', position: 'relative', background: '#000' }}
                    >
                      {isStatusVideoUrl(media) ? (
                        <video src={media} muted playsInline preload="metadata" style={{
                          width: '100%', height: '100%', objectFit: 'cover',
                        }} />
                      ) : isStatusColorBoard(media) ? (
                        <StatusTextBoard color={media} text={s.content} />
                      ) : (
                        <img src={media} alt="" style={{
                          width: '100%', height: '100%', objectFit: 'cover',
                        }} />
                      )}
                      <div style={{
                        position: 'absolute', inset: 0,
                        background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)',
                      }} />
                    </div>
                  )}

                  <div
                    onClick={() => setViewing(i)}
                    style={{ padding: '12px 14px', display: 'flex', gap: 12, alignItems: 'flex-start' }}
                  >
                    {/* Avatar */}
                    <div style={{
                      width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
                      background: 'linear-gradient(135deg,#1a7a4a,#22a05e)',
                      border: '2px solid #e8f5e9',
                      overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 15, fontWeight: 800, color: '#fff',
                    }}>
                      {avatar
                        ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : initial}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 700, color: '#0f1410', marginBottom: 2,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {name}
                      </div>
                      <div style={{
                        fontSize: 13, color: '#374151', lineHeight: 1.4, marginBottom: 6,
                      }}>
                        {s.content}
                      </div>
                      {s.tagged && (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          background: '#f0faf4', borderRadius: 8, padding: '4px 8px',
                          marginBottom: 6, width: 'fit-content',
                        }}>
                          {s.tagged.images?.[0] && (
                            <img src={s.tagged.images[0]} alt="" style={{
                              width: 20, height: 20, borderRadius: 4, objectFit: 'cover',
                            }} />
                          )}
                          <span style={{ fontSize: 11, fontWeight: 700, color: '#2e7d32' }}>
                            {s.tagged.title} · MK {Number(s.tagged.price).toLocaleString()}
                          </span>
                        </div>
                      )}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          fontSize: 10, fontWeight: 700, color: '#2e7d32',
                          background: '#e8f5e9', borderRadius: 20, padding: '2px 8px',
                        }}>
                          {s.status_type}
                        </span>
                        <span style={{ fontSize: 11, color: '#9ca3af' }}>
                          ⏱ {timeLeft(s.expires_at)}
                        </span>
                      </div>
                    </div>

                    {/* Unsave button */}
                    <button
                      onClick={e => { e.stopPropagation(); unsave(item.id) }}
                      style={{
                        background: '#fef2f2', border: '1px solid #fecaca',
                        borderRadius: 8, width: 30, height: 30, flexShrink: 0,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', fontSize: 14, color: '#ef4444',
                      }}
                    >✕</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Story viewer */}
      {viewing !== null && stories.length > 0 && (
        <StoryViewer
          stories={stories}
          startIndex={viewing}
          currentUserId={user?.id}
          onClose={() => setViewing(null)}
        />
      )}
    </div>
  )
}