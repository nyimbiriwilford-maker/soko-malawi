import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useStatuses } from '../hooks/useStatuses'
import BottomNav from '../components/BottomNav'
import { fetchAllActiveStories } from '../hooks/useStatuses'
import StoryViewer from '../components/StoryViewer'
import FollowButton from '../components/FollowButton'

const TEMPLATES = {
  availability: [
    { emoji: '✅', text: 'Available today — can meet in Blantyre CBD' },
    { emoji: '✅', text: 'Available today — can meet in Lilongwe City' },
    { emoji: '💬', text: 'Negotiable on prices today' },
    { emoji: '📦', text: 'Just restocked — new items listed' },
    { emoji: '🕐', text: 'Busy this week, responding slowly' },
    { emoji: '🚫', text: 'Away until Friday' },
  ],
  listing_update: [
    { emoji: '✅', text: 'Still available — can meet today' },
    { emoji: '🔥', text: 'Price dropped — see new price' },
    { emoji: '⚡', text: 'Two people interested — first to confirm gets it' },
    { emoji: '🔒', text: 'Reserved — deal not confirmed yet' },
    { emoji: '📍', text: 'Available for pickup now' },
  ],
  work_ping: [
    { emoji: '💼', text: 'Available for work this week' },
    { emoji: '📞', text: 'Available for jobs — contact me' },
    { emoji: '🚫', text: 'Fully booked until next week' },
  ],
}

const EXPIRY_LABELS = {
  availability:   '24 hours',
  listing_update: '24 hours',
  work_ping:      '48 hours',
}

const TAB_META = {
  availability:   { label: 'Availability', emoji: '🟢' },
  listing_update: { label: 'Listing',      emoji: '🏷️' },
  work_ping:      { label: 'Work',         emoji: '💼' },
}

export default function StatusPage() {
  const navigate  = useNavigate()
  const [user, setUser]   = useState(null)
  const fileRef           = useRef()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate('/login'); return }
      supabase.from('profiles').select('full_name, avatar_url, city')
        .eq('id', user.id).maybeSingle()
        .then(({ data }) => setUser({ ...user, ...data }))
    })
  }, [])

  if (!user) return null
  return <StatusPageInner user={user} navigate={navigate} fileRef={fileRef} />
}

function StatusPageInner({ user, navigate }) {
  const { statuses, setStatuses, postStatus, deleteStatus } = useStatuses(user.id)
  const [tab, setTab]             = useState('availability')
  const [custom, setCustom]       = useState('')
  const [selected, setSelected]   = useState('')
  const [mediaFile, setMediaFile] = useState(null)
  const [mediaPreview, setMediaPreview] = useState(null)
  const [isVideo, setIsVideo]     = useState(false)
  const [listings, setListings]   = useState([])
  const [taggedId, setTaggedId]   = useState(null)
  const [posting, setPosting]     = useState(false)
  const [toast, setToast]         = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const fileRef                   = useRef()

  const activeStatuses = statuses.slice(0, 5)
  const content = custom.trim() || selected
  const [stories, setStories]             = useState([])
  const [viewerStories, setViewerStories] = useState([])
  const [viewing, setViewing]             = useState(null)
  const [categoryFilter, setCategoryFilter] = useState('All')
  const [searchQuery, setSearchQuery] = useState('')
  const [viewedIds, setViewedIds] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('viewedStories') || '[]')) }
    catch { return new Set() }
  })
  const [followedIds, setFollowedIds] = useState(new Set())

  useEffect(() => {
    if (!user) return
    supabase
      .from('seller_follows')
      .select('seller_id')
      .eq('follower_id', user.id)
      .then(({ data }) => setFollowedIds(new Set((data || []).map(f => f.seller_id))))
  }, [user])

  const searchedStories = searchQuery.trim()
    ? stories.filter(s => {
        const q = searchQuery.toLowerCase()
        return (
          s.content?.toLowerCase().includes(q) ||
          s.profiles?.full_name?.toLowerCase().includes(q) ||
          s.tagged?.title?.toLowerCase().includes(q) ||
          s.tagged?.category?.toLowerCase().includes(q) ||
          s.tagged?.description?.toLowerCase().includes(q) ||
          s._taggedDescription?.toLowerCase().includes(q)
        )
      })
    : stories

  const CATEGORY_TABS = [
    { key: 'All',          emoji: '🌐' },
    { key: 'Availability', emoji: '🟢' },
    { key: 'Work',         emoji: '💼' },
    { key: '🔥 Urgent',    emoji: '🔥' },
    { key: 'Electronics',  emoji: '📱' },
    { key: 'Vehicles',     emoji: '🚗' },
    { key: 'Clothing',     emoji: '👗' },
    { key: 'Furniture',    emoji: '🛋️' },
    { key: 'Property',     emoji: '🏠' },
    { key: 'Agriculture',  emoji: '🌾' },
    { key: 'Food',         emoji: '🍎' },
    { key: 'Services',     emoji: '🔧' },
    { key: 'Other',        emoji: '📦' },
  ]


  useEffect(() => {
    fetchAllActiveStories(user.id, categoryFilter).then(async data => {
      // Fetch descriptions for tagged listings separately
      const listingIds = [...new Set(data.filter(s => s.tagged_listing_id).map(s => s.tagged_listing_id))]
      if (listingIds.length > 0) {
        const { data: listings } = await supabase
          .from('listings')
          .select('id, description')
          .in('id', listingIds)
        const descMap = {}
        for (const l of listings || []) descMap[l.id] = l.description
        setStories(data.map(s => ({
          ...s,
          _taggedDescription: s.tagged_listing_id ? descMap[s.tagged_listing_id] : null
        })))
      } else {
        setStories(data)
      }
    })
  }, [categoryFilter])

  useEffect(() => {
    const ch = supabase.channel('status-page-stories')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_statuses' }, () => {
        fetchAllActiveStories(user.id, categoryFilter).then(setStories)
      })
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  useEffect(() => {
    supabase.from('listings')
      .select('id, title, price, images')
      .eq('seller_id', user.id)
      .eq('status', 'active')
      .limit(20)
      .then(({ data }) => setListings(data || []))
  }, [user.id])

  function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setMediaFile(f)
    setIsVideo(f.type.startsWith('video/'))
    setMediaPreview(URL.createObjectURL(f))
  }

  function showToast(msg) {
    setToast(msg)
    setTimeout(() => setToast(''), 2500)
  }

  async function handlePost() {
    if (!content && !mediaFile) return
    setPosting(true)

    // Upload media if present
    let media_urls = []
    if (mediaFile) {
      const ext  = mediaFile.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage
        .from('story-media')
        .upload(path, mediaFile, { contentType: mediaFile.type })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('story-media').getPublicUrl(path)
        media_urls = [urlData.publicUrl]
      }
    }

    const expiryKey =
      tab === 'listing_update' &&
      (content.includes('Two people') || content.includes('first to confirm') || content.includes('Price drop'))
        ? 'listing_urgency'
        : tab

    const { data, error } = await postStatus({
      content: content || '(media)',
      status_type: tab,
      listing_id: taggedId || null,
      tagged_listing_id: taggedId || null,
      expiryKey,
      mediaFiles: [],      // already uploaded above
    })

    // Patch media_urls on the exact new row
    if (!error && media_urls.length && data?.id) {
      const { data: patched } = await supabase.from('user_statuses')
        .update({ media_urls })
        .eq('id', data.id)
        .select()
        .single()
      if (patched) {
        setStatuses(prev => prev.map(s => s.id === patched.id ? patched : s))
      }
    }

    setPosting(false)
    if (error) { showToast('❌ Failed to post'); return }
    showToast('✅ Status posted!')
    setSelected(''); setCustom(''); setMediaFile(null); setMediaPreview(null); setTaggedId(null)
    setComposerOpen(false)
  }

  const tagged = listings.find(l => l.id === taggedId)

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
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f1410' }}>My Status</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>Let buyers know you're available</div>
        </div>
      </div>

     {/* ── Live Stories Row ── */}
      <div style={{
        background: '#fff',
        borderBottom: '1px solid #e5e7eb',
        padding: '14px 0 16px',
      }}>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: 1.2,
          color: '#9ca3af', textTransform: 'uppercase',
          padding: '0 16px', marginBottom: 10,
        }}>
          Recent Statuses
        </div>

        {/* Search bar */}
        <div style={{ padding: '0 16px', marginBottom: 10 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: '#f3f4f6',
            borderRadius: 24, padding: '8px 14px',
            border: '1px solid #e5e7eb',
          }}>
            <span style={{ fontSize: 14, opacity: 0.7 }}>🔍</span>
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search statuses or sellers..."
              style={{
                flex: 1, background: 'transparent', border: 'none',
                outline: 'none', fontSize: 13, fontWeight: 500,
                color: '#0f1410',
              }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                style={{
                  background: '#e5e7eb', border: 'none',
                  borderRadius: '50%', width: 20, height: 20,
                  fontSize: 11, color: '#6b7280', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >✕</button>
            )}
          </div>
        </div>

        {/* Category filter tabs */}
        <div style={{
          display: 'flex', gap: 6, overflowX: 'auto',
          padding: '0 16px', marginBottom: 12,
          scrollbarWidth: 'none',
        }}>
          {CATEGORY_TABS.map(cat => (
            <button
              key={cat.key}
              onClick={() => setCategoryFilter(cat.key)}
              style={{
                flexShrink: 0,
                background: categoryFilter === cat.key
                  ? 'rgba(255,255,255,0.95)'
                  : 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: 20,
                padding: '5px 12px',
                fontSize: 12, fontWeight: 700,
                color: categoryFilter === cat.key ? '#1b5e20' : '#6b7280',
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap',
              }}
            >
              {cat.emoji} {cat.key}
            </button>
          ))}
        </div>

        <div style={{
          display: 'flex', gap: 10,
          overflowX: 'auto', padding: '0 16px',
          scrollbarWidth: 'none',
        }}>

          {/* Create / Your story card — always first */}
          <div
            onClick={() => setComposerOpen(true)}
            className="add-status-card"
            style={{
              cursor: 'pointer',
            }}
          >
            {/* My avatar as bg if exists */}
            {user.avatar_url && (
              <img src={user.avatar_url} alt="" style={{
                position: 'absolute', inset: 0,
                width: '100%', height: '100%', objectFit: 'cover',
                opacity: 0.5,
              }} />
            )}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.6) 40%, transparent 100%)',
            }} />
            {/* + button */}
            <div style={{
              position: 'absolute', top: '38%', left: '50%',
              transform: 'translate(-50%,-50%)',
              width: 36, height: 36, borderRadius: '50%',
              background: '#1a7a4a', border: '3px solid #fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 22, color: '#fff', fontWeight: 900, lineHeight: 1,
              boxShadow: '0 2px 10px rgba(0,0,0,0.3)',
            }}>+</div>
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0,
              padding: '8px 6px',
            }}>
              <div style={{
                fontSize: 11, fontWeight: 700, color: '#fff',
                textAlign: 'center', textShadow: '0 1px 4px rgba(0,0,0,0.6)',
              }}>
                Add status
              </div>
            </div>
          </div>

          {/* Other story cards */}
          {(() => {
            const userMap = new Map()
            for (const s of searchedStories) {
              if (!userMap.has(s.user_id)) userMap.set(s.user_id, [])
              userMap.get(s.user_id).push(s)
            }
            const cards = Array.from(userMap.values()).map(group => ({
              ...group[0],
              _ownGroup: group,
              _isCurrentUser: group[0].user_id === user.id,
            }))
            // Own card always first
            const own = cards.filter(c => c.user_id === user.id)
            const others = cards.filter(c => c.user_id !== user.id)
            return [...own, ...others]
          })().map((s, i) => {
            const name    = s.profiles?.full_name || 'Seller'
            const avatar  = s.profiles?.avatar_url
            const media   = s.media_urls?.[0]
            const initial = name[0].toUpperCase()
            const isOwn   = s.user_id === user.id
            const isUrgent = s.content?.toLowerCase().includes('price drop') ||
                             s.content?.toLowerCase().includes('first to confirm')

            const CARD_GRADIENTS = [
              'linear-gradient(160deg,#0a2e1a,#1a7a4a)',
              'linear-gradient(160deg,#0d1b2a,#1a3a6c)',
              'linear-gradient(160deg,#2a0d0d,#7a2020)',
              'linear-gradient(160deg,#1a0a2e,#4a1a7a)',
              'linear-gradient(160deg,#0a1a2e,#1a5a6a)',
              'linear-gradient(160deg,#1c1a0a,#5a6a1a)',
            ]

            return (
              <div
                key={s.id}
                onClick={async () => {
                  // Mark all statuses for this user as viewed
                  const ids = s._ownGroup ? s._ownGroup.map(x => x.id) : [s.id]
                  setViewedIds(prev => {
                    const next = new Set([...prev, ...ids])
                    localStorage.setItem('viewedStories', JSON.stringify([...next]))
                    return next
                  })
                  if (s._ownGroup && s._ownGroup.length > 0) {
                    const thisUserStories = s._ownGroup
                    const otherStories = stories.filter(x => x.user_id !== s.user_id)
                    setViewerStories([...thisUserStories, ...otherStories])
                    setViewing(0)
                  } else {
                    const { data } = await supabase
                      .from('user_statuses')
                      .select(`
                        id, content, status_type, expires_at, created_at,
                        media_urls, tagged_listing_id, user_id, location_hint,
                        profiles:user_id ( id, full_name, avatar_url ),
                        tagged:tagged_listing_id ( id, title, price, images, category, description )
                      `)
                      .eq('user_id', s.user_id)
                      .gt('expires_at', new Date().toISOString())
                      .order('created_at', { ascending: false })
                    setViewerStories(data || [s])
                    setViewing(0)
                  }
                }}
                style={{
                  flexShrink: 0, width: 110, height: 170,
                  borderRadius: 14, overflow: 'hidden',
                  position: 'relative', cursor: 'pointer',
                  background: CARD_GRADIENTS[i % CARD_GRADIENTS.length],
                  border: `2.5px solid ${
                    isOwn ? '#1a7a4a'
                    : (!s._ownGroup?.every(x => viewedIds.has(x.id))) ? '#f9a825'
                    : isUrgent ? 'rgba(255,111,0,0.4)'
                    : 'rgba(255,255,255,0.2)'
                  }`,
                  boxShadow: (!isOwn && !s._ownGroup?.every(x => viewedIds.has(x.id)))
                    ? '0 0 0 2px rgba(249,168,37,0.4), 0 2px 12px rgba(0,0,0,0.12)'
                    : '0 2px 12px rgba(0,0,0,0.12)',
                  boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
                }}
              >
                {/* Background media */}
                {media ? (
                  <img src={media} alt="" style={{
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%', objectFit: 'cover',
                  }} />
                ) : avatar ? (
                  <img src={avatar} alt="" style={{
                    position: 'absolute', inset: 0,
                    width: '100%', height: '100%', objectFit: 'cover',
                    filter: 'brightness(0.9)',
                    transform: 'scale(1.05)',
                  }} />
                ) : null}

                {/* Gradient overlay */}
                <div style={{
                  position: 'absolute', inset: 0,
                  background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 35%, rgba(0,0,0,0.7) 100%)',
                }} />

                {/* Avatar top-left */}
                <div style={{
                  position: 'absolute', top: 8, left: 8,
                  width: 32, height: 32, borderRadius: '50%',
                  border: `2.5px solid ${
                    isOwn ? '#fff'
                    : (!s._ownGroup?.every(x => viewedIds.has(x.id))) ? '#f9a825'
                    : '#fff'
                  }`,
                  overflow: 'hidden',
                  background: 'linear-gradient(135deg,#1a7a4a,#22a05e)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, color: '#fff',
                  flexShrink: 0,
                  boxShadow: '0 1px 6px rgba(0,0,0,0.4)',
                }}>
                  {avatar
                    ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : initial
                  }
                </div>

               
                {/* Urgent badge */}
                {isUrgent && (
                  <div style={{
                    position: 'absolute', top: 8, right: 8,
                    fontSize: 14, lineHeight: 1,
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))',
                  }}>🔥</div>
                )}

                {/* Bottom name + text */}
                <div style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  padding: '6px 7px 8px',
                }}>
                  <div style={{
                    fontSize: 11, fontWeight: 700, color: '#fff',
                    textShadow: '0 1px 4px rgba(0,0,0,0.8)',
                    marginBottom: 3,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.7)', textAlign: 'center', maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {isOwn ? `You (${s._ownGroup?.length || 1})` : `${name.split(' ')[0]} (${s._ownGroup?.length || s._statusCount || 1})`}
                      </span>
                      {!isOwn && (
                        <FollowButton currentUserId={user.id} sellerId={s.user_id} size="sm" />
                      )}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 10, color: 'rgba(255,255,255,0.8)',
                    fontWeight: 500, lineHeight: 1.3,
                    overflow: 'hidden',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    textShadow: '0 1px 3px rgba(0,0,0,0.7)',
                  }}>
                    {s.content}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

        {/* ── Composer bottom sheet ── */}
        {composerOpen && (
          <div
            onClick={() => setComposerOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.5)',
              backdropFilter: 'blur(4px)',
            }}
          />
        )}
        <div style={{
          position: 'fixed', left: 0, right: 0, bottom: 0,
          zIndex: 1001,
          transform: composerOpen ? 'translateY(0)' : 'translateY(110%)',
          transition: 'transform 0.4s cubic-bezier(0.32, 0.72, 0, 1)',
          background: '#fff',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -8px 40px rgba(0,0,0,0.2)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}>
          {/* Handle bar */}
          <div style={{
            display: 'flex', justifyContent: 'center',
            padding: '12px 0 4px',
          }}>
            <div style={{
              width: 40, height: 4, borderRadius: 2,
              background: '#e5e7eb',
            }} />
          </div>
          {/* Sheet header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 16px 12px',
            borderBottom: '1px solid #f3f4f6',
          }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f1410' }}>Post a Status</div>
            <button
              onClick={() => setComposerOpen(false)}
              style={{
                background: '#f3f4f6', border: 'none', borderRadius: '50%',
                width: 32, height: 32, fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#6b7280',
              }}
            >✕</button>
          </div>
        <div id="composer-section" style={{ background: '#fff', overflow: 'hidden' }}>

          {/* Tabs */}
          <div style={{
            display: 'flex', borderBottom: '1px solid #f3f4f6',
          }}>
            {Object.entries(TAB_META).map(([key, meta]) => (
              <button
                key={key}
                onClick={() => { setTab(key); setSelected(''); setCustom('') }}
                style={{
                  flex: 1, padding: '13px 4px',
                  background: tab === key ? '#fff' : '#fafafa',
                  border: 'none',
                  borderBottom: tab === key ? '2.5px solid #2e7d32' : '2.5px solid transparent',
                  fontSize: 12, fontWeight: 700,
                  color: tab === key ? '#2e7d32' : '#9ca3af',
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {meta.emoji} {meta.label}
              </button>
            ))}
          </div>

          <div style={{ padding: '16px' }}>

            {/* Media upload zone */}
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                width: '100%', height: 140, borderRadius: 14,
                border: '2px dashed #a5d6a7',
                background: mediaPreview ? 'transparent' : '#f0faf4',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', marginBottom: 14, overflow: 'hidden',
                position: 'relative',
              }}
            >
              {mediaPreview ? (
                isVideo
                  ? <video src={mediaPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                  : <img src={mediaPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 26, marginBottom: 4 }}>📷</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#2e7d32' }}>Add photo or video</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>optional</div>
                </div>
              )}
              {mediaPreview && (
                <button
                  onClick={e => { e.stopPropagation(); setMediaFile(null); setMediaPreview(null) }}
                  style={{
                    position: 'absolute', top: 8, right: 8,
                    background: 'rgba(0,0,0,0.5)', border: 'none',
                    color: '#fff', width: 26, height: 26,
                    borderRadius: '50%', fontSize: 13, cursor: 'pointer',
                  }}
                >✕</button>
              )}
            </div>
            <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFile} />

            {/* Text input */}
            <textarea
              placeholder="What do you want buyers to know?"
              value={custom}
              onChange={e => { setCustom(e.target.value); setSelected('') }}
              maxLength={160}
              rows={3}
              style={{
                width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 12,
                padding: '10px 12px', fontSize: 13, color: '#111',
                background: '#fafafa', resize: 'none',
                boxSizing: 'border-box', outline: 'none', lineHeight: 1.5,
                marginBottom: 4,
              }}
            />
            {custom && (
              <div style={{ textAlign: 'right', fontSize: 11, color: '#9ca3af', marginBottom: 10 }}>
                {custom.length}/160
              </div>
            )}

            {/* Templates */}
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: 1,
              color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8,
            }}>
              Quick templates
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
              {TEMPLATES[tab].map(t => {
                const full = `${t.emoji} ${t.text}`
                const isSelected = selected === full || custom === full
                return (
                  <button
                    key={t.text}
                    onClick={() => { setSelected(full); setCustom('') }}
                    style={{
                      background: isSelected ? '#e8f5e9' : '#f9fafb',
                      border: `1.5px solid ${isSelected ? '#a5d6a7' : '#e5e7eb'}`,
                      borderRadius: 10, padding: '9px 12px',
                      fontSize: 13, fontWeight: isSelected ? 700 : 500,
                      color: isSelected ? '#2e7d32' : '#374151',
                      cursor: 'pointer', textAlign: 'left', lineHeight: 1.4,
                      transition: 'all 0.15s',
                      display: 'flex', alignItems: 'center', gap: 6,
                    }}
                  >
                    {isSelected && <span style={{ color: '#2e7d32' }}>✓</span>}
                    <span style={{ fontSize: 15 }}>{t.emoji}</span>
                    {t.text}
                  </button>
                )
              })}
            </div>

            {/* Tag a listing */}
            {listings.length > 0 && (
              <>
                <div style={{
                  fontSize: 11, fontWeight: 800, letterSpacing: 1,
                  color: '#9ca3af', textTransform: 'uppercase', marginBottom: 8,
                }}>
                  Tag a product (optional)
                </div>
                <div style={{
                  display: 'flex', gap: 8, overflowX: 'auto',
                  paddingBottom: 4, scrollbarWidth: 'none', marginBottom: 14,
                }}>
                  {listings.map(l => (
                    <div
                      key={l.id}
                      onClick={() => setTaggedId(taggedId === l.id ? null : l.id)}
                      style={{
                        flexShrink: 0, width: 80, cursor: 'pointer',
                        border: `2px solid ${taggedId === l.id ? '#2e7d32' : '#e5e7eb'}`,
                        borderRadius: 10, overflow: 'hidden',
                        background: taggedId === l.id ? '#e8f5e9' : '#fff',
                        transition: 'all 0.15s',
                      }}
                    >
                      <div style={{ width: '100%', height: 60, background: '#f3f4f6', overflow: 'hidden' }}>
                        {l.images?.[0] && (
                          <img src={l.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </div>
                      <div style={{ padding: '4px 6px' }}>
                        <div style={{
                          fontSize: 10, fontWeight: 700, color: '#0f1410',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>{l.title}</div>
                        <div style={{ fontSize: 10, color: '#2e7d32', fontWeight: 800 }}>
                          MK {Number(l.price).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}

            {/* Expiry hint */}
            <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 14 }}>
              ⏱ Expires in {EXPIRY_LABELS[tab]}
            </div>

            {/* Post button */}
            <button
              onClick={handlePost}
              disabled={(!content && !mediaFile) || posting}
              style={{
                width: '100%',
                background: (content || mediaFile) ? 'linear-gradient(135deg, #1a7a4a, #22a05e)' : '#e5e7eb',
                color: (content || mediaFile) ? '#fff' : '#9ca3af',
                border: 'none', borderRadius: 14, padding: '13px',
                fontSize: 14, fontWeight: 800,
                cursor: (content || mediaFile) ? 'pointer' : 'default',
                boxShadow: (content || mediaFile) ? '0 4px 20px rgba(26,122,74,0.3)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {posting ? 'Posting…' : '📢 Post Status'}
            </button>
          </div>
        </div>
      </div>

      {/* ── Near You ── */}
      {console.log('near you debug:', { userCity: user?.city, storyCities: stories.map(s => ({ uid: s.user_id, city: s.profiles?.city })) })}
      {user?.city && (() => {
        const nearbyStories = stories.filter(s =>
          s.user_id !== user.id &&
          s.profiles?.city &&
          s.profiles.city.toLowerCase().trim() === user.city.toLowerCase().trim()
        )
        if (nearbyStories.length === 0) return null
        const userMap = new Map()
        for (const s of nearbyStories) {
          if (!userMap.has(s.user_id)) userMap.set(s.user_id, [])
          userMap.get(s.user_id).push(s)
        }
        const cards = Array.from(userMap.values())
        return (
          <div style={{ margin: '16px 0 0' }}>
            <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15 }}>📍</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0f1410' }}>Near You</span>
              <span style={{ background: '#e65100', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '1px 8px' }}>
                {cards.length}
              </span>
              <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 'auto' }}>
                📍 {user.city}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
              {cards.map((group, i) => {
                const s = group[0]
                const name = s.profiles?.full_name || 'Seller'
                const avatar = s.profiles?.avatar_url
                const media = s.media_urls?.[0]
                const initial = name[0].toUpperCase()
                const GRADS = [
                  'linear-gradient(160deg,#1a0a00,#e65100)',
                  'linear-gradient(160deg,#0a1a00,#2e7d32)',
                  'linear-gradient(160deg,#0a0a1a,#1a3a6c)',
                  'linear-gradient(160deg,#1a1a00,#5a6a1a)',
                ]
                return (
                  <div
                    key={s.user_id}
                    onClick={() => {
                      setViewerStories([...group, ...stories.filter(x => x.user_id !== s.user_id)])
                      setViewing(0)
                    }}
                    style={{
                      flexShrink: 0, width: 110, height: 170,
                      borderRadius: 14, overflow: 'hidden',
                      position: 'relative', cursor: 'pointer',
                      background: GRADS[i % GRADS.length],
                      border: '2.5px solid #e65100',
                      boxShadow: '0 0 0 2px rgba(230,81,0,0.25), 0 2px 12px rgba(0,0,0,0.12)',
                    }}
                  >
                    {media
                      ? <img src={media} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      : avatar
                        ? <img src={avatar} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.85)', transform: 'scale(1.05)' }} />
                        : null
                    }
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 35%, rgba(0,0,0,0.7) 100%)' }} />
                    <div style={{ position: 'absolute', top: 8, left: 8, width: 32, height: 32, borderRadius: '50%', border: '2.5px solid #e65100', overflow: 'hidden', background: 'linear-gradient(135deg,#e65100,#f9a825)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,0.4)' }}>
                      {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
                    </div>
                    <div style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(230,81,0,0.85)', borderRadius: 20, padding: '2px 7px', fontSize: 9, fontWeight: 800, color: '#fff' }}>
                      📍 {user.city}
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 7px 8px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                        {name.split(' ')[0]} ({group.length})
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
                        {s.content}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* ── Sellers You Follow ── */}
      {followedIds.size > 0 && (() => {
        const followedStories = stories.filter(s => followedIds.has(s.user_id) && s.user_id !== user.id)
        if (followedStories.length === 0) return null
        const userMap = new Map()
        for (const s of followedStories) {
          if (!userMap.has(s.user_id)) userMap.set(s.user_id, [])
          userMap.get(s.user_id).push(s)
        }
        const cards = Array.from(userMap.values())
        return (
          <div style={{ margin: '16px 0 0' }}>
            <div style={{ padding: '0 16px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 15 }}>👥</span>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#0f1410' }}>Sellers You Follow</span>
              <span style={{ background: '#1a7a4a', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '1px 8px' }}>
                {cards.length}
              </span>
            </div>
            <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
              {cards.map((group, i) => {
                const s = group[0]
                const name = s.profiles?.full_name || 'Seller'
                const avatar = s.profiles?.avatar_url
                const media = s.media_urls?.[0]
                const initial = name[0].toUpperCase()
                const GRADS = [
                  'linear-gradient(160deg,#0a2e1a,#1a7a4a)',
                  'linear-gradient(160deg,#0d1b2a,#1a3a6c)',
                  'linear-gradient(160deg,#2a0d0d,#7a2020)',
                  'linear-gradient(160deg,#1a0a2e,#4a1a7a)',
                ]
                return (
                  <div
                    key={s.user_id}
                    onClick={() => {
                      setViewerStories([...group, ...stories.filter(x => x.user_id !== s.user_id)])
                      setViewing(0)
                    }}
                    style={{
                      flexShrink: 0, width: 110, height: 170,
                      borderRadius: 14, overflow: 'hidden',
                      position: 'relative', cursor: 'pointer',
                      background: GRADS[i % GRADS.length],
                      border: '2.5px solid #1a7a4a',
                      boxShadow: '0 0 0 2px rgba(26,122,74,0.3), 0 2px 12px rgba(0,0,0,0.12)',
                    }}
                  >
                    {media
                      ? <img src={media} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                      : avatar
                        ? <img src={avatar} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(0.85)', transform: 'scale(1.05)' }} />
                        : null
                    }
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,0.1) 0%, transparent 35%, rgba(0,0,0,0.7) 100%)' }} />
                    <div style={{ position: 'absolute', top: 8, left: 8, width: 32, height: 32, borderRadius: '50%', border: '2.5px solid #1a7a4a', overflow: 'hidden', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: '#fff', boxShadow: '0 1px 6px rgba(0,0,0,0.4)' }}>
                      {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
                    </div>
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '6px 7px 8px' }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.8)', textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: 3 }}>
                        {name.split(' ')[0]} ({group.length})
                      </div>
                      <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', textShadow: '0 1px 3px rgba(0,0,0,0.7)' }}>
                        {s.content}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })()}

      {/* Story viewer */}
      {viewing !== null && (
        <StoryViewer
          stories={viewerStories}
          startIndex={viewing}
          currentUserId={user.id}
          onClose={() => setViewing(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)',
          background: '#0f1410', color: '#fff', borderRadius: 20,
          padding: '10px 20px', fontSize: 13, fontWeight: 700,
          zIndex: 9999, whiteSpace: 'nowrap',
          animation: 'fadeUp 0.2s ease both',
        }}>
          {toast}
        </div>
      )}

      <BottomNav />
      <style>{`
        @property --streak-angle {
          syntax: '<angle>';
          initial-value: 0deg;
          inherits: false;
        }

        @keyframes streakTravel {
          0%   { --streak-angle: 0deg;   }
          100% { --streak-angle: 360deg; }
        }

        .add-status-card {
          position: relative !important;
          border-radius: 16px !important;
          padding: 2px !important;
          box-sizing: border-box !important;
          width: 110px !important;
          height: 170px !important;
          flex-shrink: 0 !important;
          overflow: hidden !important;
          background: conic-gradient(
            from var(--streak-angle),
            transparent 0deg,
            transparent 200deg,
            rgba(249,168,37,0.15) 220deg,
            rgba(249,168,37,0.4)  235deg,
            rgba(255,236,100,0.9) 248deg,
            #fff8e1               252deg,
            rgba(255,236,100,0.9) 256deg,
            rgba(249,168,37,0.4)  269deg,
            rgba(249,168,37,0.15) 284deg,
            transparent 300deg,
            transparent 360deg
          ) !important;
          animation: streakTravel 3s cubic-bezier(0.4, 0, 0.2, 1) infinite !important;
          box-shadow:
            0 0 0px 0px rgba(249,168,37,0),
            0 4px 24px rgba(0,0,0,0.4) !important;
        }

        .add-status-card::before {
          content: '';
          position: absolute;
          inset: 2px;
          border-radius: 14px;
          background: linear-gradient(160deg,#0a2e1a,#0d3b22);
          z-index: 0;
        }

        .add-status-card > *:not(img) {
          position: relative;
          z-index: 1;
        }

        .add-status-card img {
          border-radius: 14px;
          position: relative;
          z-index: 0;
        }

        @keyframes streakGlow {
          0%, 100% { opacity: 0.7; }
          50%       { opacity: 1;   }
        }
      `}</style>
    </div>
  )
}