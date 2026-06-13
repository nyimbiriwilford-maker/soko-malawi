/**
 * StatusUploadModal.jsx
 * Drop-in upload modal for creating stories from the home page.
 * Works with your existing user_statuses Supabase table.
 */
import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const BG_COLORS = [
  '#1e3a8a', '#0f172a', '#0d9488', '#4338ca',
  '#b91c1c', '#6b21a8', '#059669', '#db2777',
]

const QUICK_EMOJIS = ['🐟', '🔥', '✨', '⚡', '📦', '🛒', '🌽', '🌞', '👕', '🇲🇼']

const MALAWI_LOCATIONS = [
  'Lilongwe','Blantyre','Mzuzu','Zomba','Karonga',
  'Mangochi','Kasungu','Salima','Nkhotakota','Dedza','Liwonde',
]

const CATEGORIES = [
  'All','Electronics','Vehicles','Property','Fashion',
  'Home & Garden','Jobs & Services','Agriculture','Others',
]

export default function StatusUploadModal({ user, onClose, onSuccess }) {
  const [tab,          setTab]          = useState('media') // 'media' | 'text'
  const [caption,      setCaption]      = useState('')
  const [location,     setLocation]     = useState(user?.city || 'Lilongwe')
  const [category,     setCategory]     = useState('All')
  const [bgColor,      setBgColor]      = useState(BG_COLORS[0])
  const [mediaFile,    setMediaFile]    = useState(null)
  const [mediaPreview, setMediaPreview] = useState('')
  const [mediaType,    setMediaType]    = useState('image')
  const [isDragging,   setIsDragging]   = useState(false)
  const [isUploading,  setIsUploading]  = useState(false)
  const [userListings, setUserListings] = useState([])
  const [linkedId,     setLinkedId]     = useState('')
  const fileInputRef = useRef(null)

  // Load seller's listings for linking
  useEffect(() => {
    if (!user?.id) return
    supabase.from('listings')
      .select('id, title, price, category, city')
      .eq('seller_id', user.id)
      .eq('status', 'active')
      .limit(20)
      .then(({ data }) => setUserListings(data || []))
  }, [user?.id])

  function handleFileChange(file) {
    if (!file) return
    if (file.size > 10 * 1024 * 1024) { alert('File must be under 10MB'); return }
    const type = file.type.startsWith('video/') ? 'video' : 'image'
    setMediaType(type)
    setMediaFile(file)
    setMediaPreview(URL.createObjectURL(file))
  }

  async function handlePublish() {
    if (tab === 'media' && !mediaFile) { alert('Please select a photo or video'); return }
    if (tab === 'text' && !caption.trim()) { alert('Please write your message'); return }

    setIsUploading(true)
    try {
      let mediaUrl = tab === 'text' ? bgColor : ''
      let statusType = tab === 'text' ? 'text' : mediaType

      // Upload media file to Supabase Storage
      if (tab === 'media' && mediaFile) {
        const ext  = mediaFile.name.split('.').pop()
        const path = `statuses/${user.id}/${Date.now()}.${ext}`
        const { error: upErr } = await supabase.storage
          .from('status-media')
          .upload(path, mediaFile, { upsert: true })
        if (upErr) throw upErr
        const { data: urlData } = supabase.storage.from('status-media').getPublicUrl(path)
        mediaUrl = urlData.publicUrl
      }

      const expiresAt = new Date(Date.now() + 24 * 3600 * 1000).toISOString()

      const payload = {
        user_id:           user.id,
        status_type:       'listing_update',   // maps to your existing CAT_COLORS
        content:           caption.trim() || null,
        media_urls:        mediaUrl ? [mediaUrl] : [],
        media_type:        statusType,
        location:          location !== 'All' ? location : null,
        category:          category !== 'All' ? category : null,
        linked_listing_id: linkedId || null,
        expires_at:        expiresAt,
        bg_color:          tab === 'text' ? bgColor : null,
      }

      const { error } = await supabase.from('user_statuses').insert(payload)
      if (error) throw error

      onSuccess?.()
    } catch (err) {
      console.error('Status upload error:', err)
      alert('Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
    }
  }

  // Overlay click handler
  function handleOverlayClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div
      onClick={handleOverlayClick}
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(0,0,0,0.82)', backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 16,
      }}
    >
      <div style={{
        background: '#fff', borderRadius: 20,
        width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        animation: 'modalIn 0.25s cubic-bezier(0.16,1,0.3,1)',
      }}>
        <style>{`
          @keyframes modalIn {
            from { opacity:0; transform:scale(0.95) translateY(12px); }
            to   { opacity:1; transform:none; }
          }
        `}</style>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px 12px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 8, fontSize: 18 }}>✨</div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800, color: '#0f172a' }}>Add Story Status</div>
              <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>Visible for 24 hours on the home feed</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 20, color: '#94a3b8', lineHeight: 1 }}>×</button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 8, padding: '10px 16px', background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
          {['media','text'].map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: 'none',
                fontSize: 12, fontWeight: 800, cursor: 'pointer',
                background: tab === t ? '#fff' : 'transparent',
                color: tab === t ? '#1a7a4a' : '#64748b',
                boxShadow: tab === t ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {t === 'media' ? '📷 Photo / Video' : '✍️ Text Only'}
            </button>
          ))}
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Media tab */}
          {tab === 'media' && (
            <div>
              <div style={label}>Attach Media File</div>
              {mediaPreview ? (
                <div style={{ position: 'relative', borderRadius: 14, overflow: 'hidden', background: '#0f172a', maxHeight: 220, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {mediaType === 'image'
                    ? <img src={mediaPreview} alt="" style={{ maxHeight: 220, width: '100%', objectFit: 'contain' }} />
                    : <video src={mediaPreview} controls style={{ maxHeight: 220, width: '100%' }} />
                  }
                  <button onClick={() => { setMediaPreview(''); setMediaFile(null) }}
                    style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.65)', border: 'none', borderRadius: '50%', width: 28, height: 28, color: '#fff', cursor: 'pointer', fontSize: 14 }}>×</button>
                </div>
              ) : (
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={e => { e.preventDefault(); setIsDragging(false); handleFileChange(e.dataTransfer.files[0]) }}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isDragging ? '#1a7a4a' : '#e2e8f0'}`,
                    borderRadius: 14, padding: '32px 20px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
                    cursor: 'pointer', background: isDragging ? '#f0fdf4' : '#f8fafc',
                    transition: 'all 0.15s',
                  }}
                >
                  <input ref={fileInputRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={e => handleFileChange(e.target.files[0])} />
                  <div style={{ fontSize: 32 }}>☁️</div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#334155' }}>Drag & drop or click to browse</div>
                    <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 3 }}>Images or short videos, max 10MB</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Text tab */}
          {tab === 'text' && (
            <div>
              <div style={label}>Style Board Background</div>
              {/* Preview */}
              <div style={{
                width: '100%', height: 100, borderRadius: 14,
                background: bgColor,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 16, marginBottom: 10,
              }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', textAlign: 'center', lineHeight: 1.5 }}>
                  {caption || 'Your message preview…'}
                </div>
              </div>
              {/* Color swatches */}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {BG_COLORS.map(c => (
                  <button key={c} onClick={() => setBgColor(c)} style={{
                    width: 32, height: 32, borderRadius: '50%', border: `2.5px solid ${bgColor === c ? '#1a7a4a' : 'transparent'}`,
                    background: c, cursor: 'pointer', transform: bgColor === c ? 'scale(1.15)' : 'none',
                    transition: 'transform 0.15s',
                  }} />
                ))}
              </div>
            </div>
          )}

          {/* Caption */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <div style={label}>{tab === 'media' ? 'Caption' : 'Message Text'}</div>
              <span style={{ fontSize: 10, color: '#94a3b8', fontWeight: 700 }}>{caption.length}/180</span>
            </div>
            <textarea
              value={caption}
              onChange={e => setCaption(e.target.value.slice(0, 180))}
              rows={3}
              placeholder={tab === 'media' ? 'Describe your product, promo codes, prices…' : 'Share a flash deal, availability, announcement…'}
              style={inputStyle}
            />
            {/* Quick emojis */}
            <div style={{ display: 'flex', gap: 4, marginTop: 6, overflowX: 'auto', padding: '4px 0' }}>
              {QUICK_EMOJIS.map(e => (
                <button key={e} onClick={() => setCaption(prev => prev + e)}
                  style={{ background: '#f1f5f9', border: 'none', borderRadius: 8, padding: '4px 6px', fontSize: 14, cursor: 'pointer' }}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* Link a listing */}
          <div>
            <div style={label}>🛍️ Link a Marketplace Product (optional)</div>
            <select value={linkedId} onChange={e => setLinkedId(e.target.value)} style={inputStyle}>
              <option value="">-- None --</option>
              {userListings.map(l => (
                <option key={l.id} value={l.id}>🏷️ {l.title} — MWK {l.price?.toLocaleString()}</option>
              ))}
            </select>
            <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 4, fontWeight: 500 }}>
              Embeds a product card inside your story so viewers can tap straight to purchase.
            </div>
          </div>

          {/* Location + Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <div style={label}>📍 Location</div>
              <select value={location} onChange={e => setLocation(e.target.value)} style={inputStyle}>
                {MALAWI_LOCATIONS.map(l => <option key={l}>{l}</option>)}
              </select>
            </div>
            <div>
              <div style={label}>🏷️ Category</div>
              <select value={category} onChange={e => setCategory(e.target.value)} style={inputStyle}>
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px 16px', borderTop: '1px solid #f1f5f9', background: '#f8fafc', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onClose} disabled={isUploading}
            style={{ padding: '10px 18px', borderRadius: 12, border: '1.5px solid #e2e8f0', background: '#fff', fontSize: 12, fontWeight: 700, color: '#475569', cursor: 'pointer' }}>
            Cancel
          </button>
          <button onClick={handlePublish} disabled={isUploading}
            style={{
              padding: '10px 22px', borderRadius: 12, border: 'none',
              background: isUploading ? '#94a3b8' : 'linear-gradient(135deg,#1a7a4a,#22a05e)',
              fontSize: 12, fontWeight: 800, color: '#fff', cursor: isUploading ? 'not-allowed' : 'pointer',
              display: 'flex', alignItems: 'center', gap: 6,
              boxShadow: '0 2px 10px rgba(26,122,74,0.35)',
            }}>
            {isUploading ? (
              <><span style={{ animation: 'spin 0.6s linear infinite', display: 'inline-block' }}>⏳</span> Publishing…</>
            ) : '🚀 Publish Story'}
          </button>
        </div>
      </div>
    </div>
  )
}

const label = { fontSize: 10, fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }

const inputStyle = {
  width: '100%', padding: '10px 14px', borderRadius: 12,
  border: '1.5px solid #e2e8f0', background: '#f8fafc',
  fontSize: 12, color: '#0f172a', outline: 'none',
  fontFamily: 'inherit', resize: 'none', boxSizing: 'border-box',
}