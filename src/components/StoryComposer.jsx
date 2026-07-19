import { useRef, useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useStatuses } from '../hooks/useStatuses'
import ProductTagPicker, { loadOwnerTagItems } from './ProductTagPicker'
import StatusLocationField from './StatusLocationField'

const TEMPLATES = [
  { emoji: '✅', text: 'Available today — DM me' },
  { emoji: '🔥', text: 'Price dropped — grab it now' },
  { emoji: '📦', text: 'Just restocked, new items listed' },
  { emoji: '🤝', text: 'Negotiable today only' },
  { emoji: '⚡', text: 'First to confirm gets it' },
  { emoji: '🏷️', text: 'Still available, can meet in Blantyre' },
]

const G = '#1a7a4a'

function IconCamera({ size = 28, color = G }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  )
}
function IconImage({ size = 16, color = G }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  )
}
function IconVideo({ size = 16, color = '#7c3aed' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="2" y="5" width="14" height="14" rx="2" />
      <path d="M16 10l6-3v10l-6-3V10z" />
    </svg>
  )
}
function IconClose({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}
function IconClock({ size = 13, color = '#94a3b8' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  )
}
function IconSend({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  )
}

export default function StoryComposer({ userId, onDone, onClose }) {
  const { postStatus } = useStatuses(userId)
  const fileRef = useRef()
  const [text, setText] = useState('')
  const [mediaFile, setMediaFile] = useState(null)
  const [mediaPreview, setMediaPreview] = useState(null)
  const [isVideo, setIsVideo] = useState(false)
  const [tagItems, setTagItems] = useState([])
  const [taggedId, setTaggedId] = useState(null)
  const [taggedKind, setTaggedKind] = useState(null)
  const [location, setLocation] = useState('')
  const [posting, setPosting] = useState(false)

  useEffect(() => {
    if (!userId) return
    loadOwnerTagItems(supabase, userId).then(setTagItems)
    supabase.from('profiles').select('city, district').eq('id', userId).maybeSingle()
      .then(({ data }) => {
        if (data?.city || data?.district) setLocation(data.city || data.district || '')
      })
  }, [userId])

  useEffect(() => {
    return () => {
      if (mediaPreview?.startsWith?.('blob:')) URL.revokeObjectURL(mediaPreview)
    }
  }, [mediaPreview])

  function handleFile(e) {
    const f = e.target.files?.[0]
    if (!f) return
    setMediaFile(f)
    setIsVideo(f.type.startsWith('video/'))
    if (mediaPreview?.startsWith?.('blob:')) URL.revokeObjectURL(mediaPreview)
    setMediaPreview(URL.createObjectURL(f))
  }

  function clearMedia(e) {
    e?.stopPropagation?.()
    if (mediaPreview?.startsWith?.('blob:')) URL.revokeObjectURL(mediaPreview)
    setMediaFile(null)
    setMediaPreview(null)
    setIsVideo(false)
  }

  async function handlePost() {
    if (!text.trim() && !mediaFile) return
    setPosting(true)
    const kind = taggedKind || (taggedId ? 'listing' : null)
    const { error } = await postStatus({
      content: text.trim() || (mediaFile ? (isVideo ? 'Video update' : 'Photo update') : ''),
      status_type: kind === 'job' || kind === 'service' ? 'work_ping' : (kind ? 'listing_update' : 'availability'),
      mediaFiles: mediaFile ? [mediaFile] : [],
      tagged_listing_id: kind === 'listing' ? taggedId : null,
      listing_id: kind === 'listing' ? taggedId : null,
      tagged_kind: kind,
      tagged_ref_id: taggedId || null,
      location_hint: location.trim() || null,
      expiryKey: kind === 'job' || kind === 'service' ? 'work_ping' : 'availability',
    })
    setPosting(false)
    if (!error) onDone?.()
  }

  const canPost = !!(text.trim() || mediaFile)

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'flex-end',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxHeight: '92vh', overflowY: 'auto',
          background: '#fff', borderRadius: '22px 22px 0 0',
          padding: '0 0 28px',
          fontFamily: "'DM Sans', system-ui, sans-serif",
          boxShadow: '0 -12px 48px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
        </div>

        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 16px 14px',
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f1410' }}>Post a story</div>
            <div style={{ fontSize: 11, color: '#94a3b8', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4, marginTop: 2 }}>
              <IconClock /> Expires in 24 hours
            </div>
          </div>
          <button type="button" onClick={onClose} style={{
            background: '#f3f4f6', border: 'none', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer', color: '#64748b',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconClose />
          </button>
        </div>

        <div style={{ padding: '0 16px' }}>
          {/* Media zone */}
          <div
            onClick={() => !mediaPreview && fileRef.current?.click()}
            style={{
              width: '100%', height: 168, borderRadius: 16,
              border: mediaPreview ? 'none' : '2px dashed #bbf7d0',
              background: mediaPreview
                ? '#0f172a'
                : 'linear-gradient(160deg,#f0fdf4 0%,#ecfdf5 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: mediaPreview ? 'default' : 'pointer',
              marginBottom: 14, overflow: 'hidden', position: 'relative',
            }}
          >
            {mediaPreview ? (
              isVideo
                ? <video src={mediaPreview} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted controls />
                : <img src={mediaPreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ textAlign: 'center', padding: 12 }}>
                <div style={{
                  width: 52, height: 52, borderRadius: 16, margin: '0 auto 10px',
                  background: '#fff', boxShadow: '0 4px 14px rgba(26,122,74,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <IconCamera size={26} />
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: G }}>Add photo or video</div>
                <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3, fontWeight: 600 }}>Tap to upload · optional</div>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
                  <span style={chipStyle}><IconImage size={13} /> Photo</span>
                  <span style={chipStyle}><IconVideo size={13} /> Video</span>
                </div>
              </div>
            )}
            {mediaPreview && (
              <button
                type="button"
                onClick={clearMedia}
                style={{
                  position: 'absolute', top: 10, right: 10,
                  background: 'rgba(0,0,0,0.55)', border: 'none',
                  color: '#fff', width: 30, height: 30, borderRadius: '50%',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <IconClose size={13} />
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFile} />

          <textarea
            placeholder="What do you want buyers to know? (e.g. Available today, price dropped…)"
            value={text}
            onChange={e => setText(e.target.value)}
            maxLength={160}
            rows={3}
            style={{
              width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 14,
              padding: '12px 14px', fontSize: 13, color: '#111',
              background: '#fafafa', resize: 'none', boxSizing: 'border-box',
              outline: 'none', lineHeight: 1.5, marginBottom: 12,
              fontFamily: 'inherit',
            }}
          />

          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 }}>
              Quick templates
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              {TEMPLATES.map(t => {
                const full = `${t.emoji} ${t.text}`
                const active = text === full
                return (
                  <button
                    key={t.text}
                    type="button"
                    onClick={() => setText(full)}
                    style={{
                      background: active ? '#e8f5e9' : '#f9fafb',
                      border: `1.5px solid ${active ? '#a5d6a7' : '#e5e7eb'}`,
                      borderRadius: 20, padding: '7px 12px',
                      fontSize: 12, fontWeight: 600,
                      color: active ? '#2e7d32' : '#374151',
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >
                    {t.emoji} {t.text}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{
            marginBottom: 16, padding: 12, borderRadius: 16,
            background: '#fafbfc', border: '1px solid #eef2f7',
          }}>
            <ProductTagPicker
              items={tagItems}
              taggedId={taggedId}
              taggedKind={taggedKind}
              onChange={(sel) => {
                if (!sel) { setTaggedId(null); setTaggedKind(null); return }
                setTaggedId(sel.id)
                setTaggedKind(sel.kind)
              }}
              compact
            />
          </div>

          <div style={{ marginBottom: 16 }}>
            <StatusLocationField
              value={location}
              onChange={setLocation}
              compact
              placeholder="Search district or type your place…"
            />
          </div>

          <button
            type="button"
            onClick={handlePost}
            disabled={!canPost || posting}
            style={{
              width: '100%',
              background: canPost ? 'linear-gradient(135deg, #1a7a4a, #22a05e)' : '#e5e7eb',
              color: canPost ? '#fff' : '#9ca3af',
              border: 'none', borderRadius: 14, padding: '14px',
              fontSize: 14, fontWeight: 800,
              cursor: canPost && !posting ? 'pointer' : 'default',
              boxShadow: canPost ? '0 4px 20px rgba(26,122,74,0.3)' : 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: 'inherit',
            }}
          >
            {posting ? 'Posting…' : (
              <><IconSend /> Post story{taggedId ? ' · tagged' : ''}</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

const chipStyle = {
  display: 'inline-flex', alignItems: 'center', gap: 4,
  background: '#fff', border: '1px solid #e2e8f0',
  borderRadius: 20, padding: '4px 10px',
  fontSize: 11, fontWeight: 700, color: '#475569',
}
