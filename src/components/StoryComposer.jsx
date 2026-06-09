import { useRef, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useStatuses } from '../hooks/useStatuses'

const TEMPLATES = [
  { emoji: '✅', text: 'Available today — DM me' },
  { emoji: '🔥', text: 'Price dropped — grab it now' },
  { emoji: '📦', text: 'Just restocked, new items listed' },
  { emoji: '🤝', text: 'Negotiable today only' },
  { emoji: '⚡', text: 'First to confirm gets it' },
  { emoji: '🏷️', text: 'Still available, can meet in Blantyre' },
]

export default function StoryComposer({ userId, onDone, onClose }) {
  const { postStatus } = useStatuses(userId)
  const fileRef        = useRef()
  const [text, setText]           = useState('')
  const [mediaFile, setMediaFile] = useState(null)
  const [mediaPreview, setMediaPreview] = useState(null)
  const [isVideo, setIsVideo]     = useState(false)
  const [listings, setListings]   = useState([])
  const [taggedId, setTaggedId]   = useState(null)
  const [posting, setPosting]     = useState(false)
  const [step, setStep]           = useState('compose') // compose | preview

  useEffect(() => {
    supabase.from('listings').select('id, title, price, images')
      .eq('seller_id', userId).eq('status', 'active').limit(20)
      .then(({ data }) => setListings(data || []))
  }, [userId])

  function handleFile(e) {
    const f = e.target.files[0]
    if (!f) return
    setMediaFile(f)
    setIsVideo(f.type.startsWith('video/'))
    setMediaPreview(URL.createObjectURL(f))
  }

  async function handlePost() {
    if (!text.trim() && !mediaFile) return
    setPosting(true)
    const { error } = await postStatus({
      content: text.trim() || (mediaFile ? '(media)' : ''),
      status_type: 'availability',
      mediaFiles: mediaFile ? [mediaFile] : [],
      tagged_listing_id: taggedId || null,
      expiryKey: 'availability',
    })
    setPosting(false)
    if (!error) onDone()
  }

  const tagged = listings.find(l => l.id === taggedId)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxHeight: '90vh', overflowY: 'auto',
          background: '#fff', borderRadius: '20px 20px 0 0',
          padding: '0 0 32px',
          fontFamily: "'DM Sans', system-ui, sans-serif",
        }}
      >
        {/* Handle bar */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
        </div>

        {/* Title row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px 14px',
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f1410' }}>
            📢 Post a Story
          </div>
          <button onClick={onClose} style={{
            background: '#f3f4f6', border: 'none', borderRadius: '50%',
            width: 30, height: 30, fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        <div style={{ padding: '0 16px' }}>

          {/* Media preview / upload zone */}
          <div
            onClick={() => fileRef.current?.click()}
            style={{
              width: '100%', height: 160, borderRadius: 16,
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
                <div style={{ fontSize: 28, marginBottom: 6 }}>📷</div>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#2e7d32' }}>Add photo or video</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>tap to upload</div>
              </div>
            )}
            {mediaPreview && (
              <button
                onClick={e => { e.stopPropagation(); setMediaFile(null); setMediaPreview(null) }}
                style={{
                  position: 'absolute', top: 8, right: 8,
                  background: 'rgba(0,0,0,0.5)', border: 'none',
                  color: '#fff', width: 26, height: 26, borderRadius: '50%',
                  fontSize: 13, cursor: 'pointer',
                }}
              >✕</button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFile} />

          {/* Text input */}
          <textarea
            placeholder="What do you want buyers to know? (e.g. Available today, price dropped…)"
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={160}
            rows={3}
            style={{
              width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 12,
              padding: '10px 12px', fontSize: 13, color: '#111',
              background: '#fafafa', resize: 'none', boxSizing: 'border-box',
              outline: 'none', lineHeight: 1.5, marginBottom: 14,
            }}
          />

          {/* Quick templates */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Quick templates
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {TEMPLATES.map(t => (
                <button
                  key={t.text}
                  onClick={() => setText(t.emoji + ' ' + t.text)}
                  style={{
                    background: text === t.emoji + ' ' + t.text ? '#e8f5e9' : '#f9fafb',
                    border: `1.5px solid ${text === t.emoji + ' ' + t.text ? '#a5d6a7' : '#e5e7eb'}`,
                    borderRadius: 20, padding: '6px 12px',
                    fontSize: 12, fontWeight: 600,
                    color: text === t.emoji + ' ' + t.text ? '#2e7d32' : '#374151',
                    cursor: 'pointer',
                  }}
                >
                  {t.emoji} {t.text}
                </button>
              ))}
            </div>
          </div>

          {/* Tag a listing */}
          {listings.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
                Tag a product (optional)
              </div>
              <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4, scrollbarWidth: 'none' }}>
                {listings.map(l => (
                  <div
                    key={l.id}
                    onClick={() => setTaggedId(taggedId === l.id ? null : l.id)}
                    style={{
                      flexShrink: 0, width: 80, cursor: 'pointer',
                      border: `2px solid ${taggedId === l.id ? '#2e7d32' : '#e5e7eb'}`,
                      borderRadius: 10, overflow: 'hidden',
                      background: taggedId === l.id ? '#e8f5e9' : '#fff',
                    }}
                  >
                    <div style={{ width: '100%', height: 60, background: '#f3f4f6', overflow: 'hidden' }}>
                      {l.images?.[0] && (
                        <img src={l.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      )}
                    </div>
                    <div style={{ padding: '4px 5px' }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: '#0f1410',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.title}
                      </div>
                      <div style={{ fontSize: 10, color: '#2e7d32', fontWeight: 800 }}>
                        MK {Number(l.price).toLocaleString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Expiry note */}
          <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 14 }}>
            ⏱ Story expires in 24 hours
          </div>

          {/* Post button */}
          <button
            onClick={handlePost}
            disabled={(!text.trim() && !mediaFile) || posting}
            style={{
              width: '100%',
              background: (text.trim() || mediaFile) ? 'linear-gradient(135deg, #1a7a4a, #22a05e)' : '#e5e7eb',
              color: (text.trim() || mediaFile) ? '#fff' : '#9ca3af',
              border: 'none', borderRadius: 14, padding: '13px',
              fontSize: 14, fontWeight: 800, cursor: (text.trim() || mediaFile) ? 'pointer' : 'default',
              boxShadow: (text.trim() || mediaFile) ? '0 4px 20px rgba(26,122,74,0.3)' : 'none',
            }}
          >
            {posting ? 'Posting…' : '📢 Post Story'}
          </button>
        </div>
      </div>
    </div>
  )
}