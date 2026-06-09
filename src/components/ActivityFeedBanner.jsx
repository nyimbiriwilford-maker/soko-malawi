import { useEffect, useState, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { fetchAllActiveStories } from '../hooks/useStatuses'
import StoryViewer from './StoryViewer'
import StoryComposer from './StoryComposer'

export default function SellerStories({ currentUser }) {
  const [stories, setStories]     = useState([])
  const [loaded, setLoaded]       = useState(false)
  const [viewing, setViewing]     = useState(null)
  const [composing, setComposing] = useState(false)

  async function load() {
    const data = await fetchAllActiveStories()
    setStories(data)
    setLoaded(true)
  }

  useEffect(() => {
    load()
    const ch = supabase.channel('stories-feed')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_statuses' }, () => load())
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const myStory = stories.find(s => s.user_id === currentUser?.id)
  const others  = stories.filter(s => s.user_id !== currentUser?.id)

  if (!loaded) return null

  return (
    <>
      <div style={{ margin: '12px 0 0' }}>
        <div style={{
          fontSize: 11, fontWeight: 800, letterSpacing: 1.2,
          color: '#9ca3af', textTransform: 'uppercase',
          padding: '0 16px', marginBottom: 10,
        }}>
          Live from sellers
        </div>

        <div style={{
          display: 'flex', gap: 12,
          overflowX: 'auto', padding: '2px 16px 10px',
          scrollbarWidth: 'none',
        }}>
          {/* Add / Update bubble */}
          {currentUser && (
            <StoryBubble
              label={myStory ? 'Update' : 'Add'}
              avatar={currentUser.avatar_url}
              name="You"
              isOwn
              hasStory={!!myStory}
              onClick={() => setComposing(true)}
            />
          )}

          {/* My own story — viewable */}
          {myStory && (
            <StoryBubble
              label="Your story"
              avatar={currentUser?.avatar_url}
              name="You"
              hasStory
              isOwn
              mediaUrl={myStory.media_urls?.[0]}
              onClick={() => setViewing(stories.findIndex(x => x.id === myStory.id))}
            />
          )}

          {/* Other sellers */}
          {others.map((s) => (
            <StoryBubble
              key={s.id}
              label={s.profiles?.full_name?.split(' ')[0] || 'Seller'}
              avatar={s.profiles?.avatar_url}
              name={s.profiles?.full_name}
              hasStory
              isUrgent={
                s.content?.toLowerCase().includes('price drop') ||
                s.content?.toLowerCase().includes('first to confirm')
              }
              mediaUrl={s.media_urls?.[0]}
              onClick={() => setViewing(stories.findIndex(x => x.id === s.id))}
            />
          ))}
        </div>
      </div>

      {viewing !== null && (
        <StoryViewer
          stories={stories}
          startIndex={viewing}
          currentUserId={currentUser?.id}
          onClose={() => setViewing(null)}
        />
      )}

      {composing && (
        <StoryComposer
          userId={currentUser?.id}
          onDone={() => { setComposing(false); load() }}
          onClose={() => setComposing(false)}
        />
      )}
    </>
  )
}

function StoryBubble({ label, avatar, name, isOwn, hasStory, isUrgent, mediaUrl, onClick }) {
  const initial = (name || 'S')[0].toUpperCase()
  const ringColor = isUrgent
    ? 'conic-gradient(#ff6f00, #ffa000, #ff6f00)'
    : hasStory
      ? 'conic-gradient(#1a7a4a, #22a05e, #4caf50, #1a7a4a)'
      : '#e5e7eb'

  return (
    <div onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      gap: 5, cursor: 'pointer', flexShrink: 0, width: 64,
    }}>
      <div style={{
        width: 60, height: 60, borderRadius: '50%',
        background: hasStory ? ringColor : '#e5e7eb',
        padding: 2.5, boxSizing: 'border-box', position: 'relative',
      }}>
        <div style={{
          width: '100%', height: '100%', borderRadius: '50%',
          background: '#fff', padding: 2, boxSizing: 'border-box',
        }}>
          <div style={{
            width: '100%', height: '100%', borderRadius: '50%',
            overflow: 'hidden',
            background: 'linear-gradient(135deg, #1a7a4a, #22a05e)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 18, fontWeight: 800, color: '#fff',
          }}>
            {mediaUrl
              ? <img src={mediaUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : avatar
                ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={e => { e.target.style.display = 'none' }} />
                : initial
            }
          </div>
        </div>

        {isOwn && !hasStory && (
          <div style={{
            position: 'absolute', bottom: 0, right: 0,
            width: 18, height: 18, borderRadius: '50%',
            background: '#2e7d32', border: '2px solid #fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, color: '#fff', fontWeight: 900, lineHeight: 1,
          }}>+</div>
        )}
        {isUrgent && (
          <div style={{ position: 'absolute', top: 0, right: 0, fontSize: 11 }}>🔥</div>
        )}
      </div>

      <div style={{
        fontSize: 10, fontWeight: 600, color: '#374151',
        textAlign: 'center', width: '100%',
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {label}
      </div>
    </div>
  )
}