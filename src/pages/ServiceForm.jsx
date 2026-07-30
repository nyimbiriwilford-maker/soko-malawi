import { useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { uploadToR2, getR2Url, deleteFromR2 } from '../lib/r2'
import { SERVICE_CATS, CITIES, AVAILABILITY_OPTIONS, S } from './serviceData'

export default function ServiceForm({ editingService, onSuccess, onCancel }) {
  const mediaInputRef = useRef(null)
  const MAX_CHARS = 500
  const MAX_MEDIA = 8

  const blank = {
    name: '', category: '', description: '', rate: '',
    experience: '', skills: '', coverage: '', city: '',
    contact: '', available: 'Available today', tags: '',
  }

  const [form, setForm] = useState(() => editingService ? {
    name: editingService.name || '',
    category: editingService.category || '',
    description: editingService.description || '',
    rate: editingService.rate || '',
    experience: editingService.experience || '',
    skills: (editingService.skills || []).join(', '),
    coverage: editingService.coverage || '',
    city: editingService.city || '',
    contact: editingService.contact || '',
    available: editingService.available || 'Available today',
    tags: (editingService.tags || []).join(', '),
  } : blank)

  const [mediaFiles, setMediaFiles] = useState([])
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState(editingService?.media_urls || [])
  const [removedUrls, setRemovedUrls] = useState([])
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const [postSuccess, setPostSuccess] = useState(false)

  const setF = (field, value) => setForm(f => ({ ...f, [field]: value }))
  const charCount = form.description.length

  function handleMediaSelect(e) {
    const files = Array.from(e.target.files)
    if (mediaPreviewUrls.length + files.length > MAX_MEDIA) {
      setPostError(`Maximum ${MAX_MEDIA} media files allowed`)
      return
    }
    setPostError('')
    setMediaFiles(prev => [...prev, ...files])
    setMediaPreviewUrls(prev => [...prev, ...files.map(f => URL.createObjectURL(f))])
    e.target.value = ''
  }

  function removeMedia(idx) {
    const url = mediaPreviewUrls[idx]
    if (!url.startsWith('blob:')) setRemovedUrls(prev => [...prev, url])
    const existingKeptCount = (editingService?.media_urls || []).filter(u => !removedUrls.includes(u)).length
    const fileIdx = idx - existingKeptCount
    if (fileIdx >= 0) setMediaFiles(prev => prev.filter((_, i) => i !== fileIdx))
    setMediaPreviewUrls(prev => prev.filter((_, i) => i !== idx))
  }

  async function uploadMediaFiles(userId) {
    if (!mediaFiles.length) return []
    setUploadingMedia(true)
    const urls = []
    for (const file of mediaFiles) {
      const ext = file.name.split('.').pop()
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const url = await uploadToR2(file, 'service-media/' + path)
      if (url) {
        urls.push(url)
      }
    }
    setUploadingMedia(false)
    return urls
  }

  async function handlePost() {
    setPostError('')
    if (!form.name.trim()) { setPostError('Please enter your name'); return }
    if (!form.category) { setPostError('Please select a category'); return }
    if (!form.city) { setPostError('Please select your city'); return }
    if (!form.rate.trim()) { setPostError('Please enter your rate'); return }
    if (!form.contact.trim()) { setPostError('Please enter a contact number'); return }
    if (charCount > MAX_CHARS) { setPostError(`Description too long (max ${MAX_CHARS} chars)`); return }

    setPosting(true)
    const { data: { user } } = await supabase.auth.getUser()
    const newMediaUrls = await uploadMediaFiles(user.id)
    const existingKept = (editingService?.media_urls || []).filter(u => !removedUrls.includes(u))

    const payload = {
      provider_id: user.id,
      name: form.name.trim(),
      category: form.category,
      description: form.description.trim(),
      rate: form.rate.trim(),
      experience: form.experience.trim(),
      skills: form.skills ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : [],
      tags: form.tags ? form.tags.split(',').map(s => s.trim().toLowerCase()).filter(Boolean) : [],
      coverage: form.coverage.trim(),
      city: form.city,
      contact: form.contact.trim(),
      available: form.available,
      status: 'active',
      media_urls: [...existingKept, ...newMediaUrls],
    }

    let error
    if (editingService) {
      ;({ error } = await supabase.from('services').update(payload).eq('id', editingService.id))
    } else {
      ;({ error } = await supabase.from('services').insert(payload))
    }

    setPosting(false)
    if (error) { setPostError(error.message); return }
    setPostSuccess(true)
    setTimeout(() => { setPostSuccess(false); onSuccess() }, 1200)
  }

  const progress = [form.name, form.category, form.city && form.rate, form.contact].filter(Boolean).length

  return (
    <div style={S.form}>
      <div style={S.formCard}>
        <div style={S.formTitle}>{editingService ? '✏️ Edit Listing' : '🚀 Offer a Service'}</div>
        <div style={S.formSub}>
          {editingService
            ? 'Update your service listing to attract more customers.'
            : 'List your service and let customers across Malawi find and contact you directly.'}
        </div>

        {/* Progress bar */}
        {!editingService && (
          <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{ flex: 1, height: '4px', borderRadius: '2px', background: i < progress ? '#1a7a4a' : '#e8f0eb', transition: 'background 0.3s' }} />
            ))}
          </div>
        )}

        {/* Tips banner */}
        {!editingService && (
          <div style={{ background: '#e6f7ee', borderRadius: '12px', padding: '12px 14px', marginBottom: '20px', fontSize: '12px', color: '#1a7a4a', lineHeight: '1.7' }}>
            💡 <strong>Tips for more customers:</strong> Add a clear photo, describe your work in detail, and include your WhatsApp number so customers can reach you instantly.
          </div>
        )}

        <label style={S.label}>Your Full Name *</label>
        <input style={S.input} placeholder="e.g. James Mkandawire" value={form.name} onChange={e => setF('name', e.target.value)} />

        <label style={S.label}>Service Category *</label>
        <select style={S.input} value={form.category} onChange={e => setF('category', e.target.value)}>
          <option value="">Select category...</option>
          {SERVICE_CATS.map(c => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
        </select>

        <div style={S.row}>
          <div style={S.half}>
            <label style={S.label}>City *</label>
            <select style={S.input} value={form.city} onChange={e => setF('city', e.target.value)}>
              <option value="">Select...</option>
              {CITIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={S.half}>
            <label style={S.label}>Rate *</label>
            <input style={S.input} placeholder="e.g. MWK 18k/day" value={form.rate} onChange={e => setF('rate', e.target.value)} />
          </div>
        </div>

        <label style={S.label}>
          About Your Service
          <span style={{ fontWeight: '400', textTransform: 'none', color: charCount > MAX_CHARS ? '#c0392b' : '#bbb', marginLeft: '6px' }}>
            {charCount}/{MAX_CHARS}
          </span>
        </label>
        <textarea
          style={{ ...S.textarea, borderColor: charCount > MAX_CHARS ? '#c0392b' : '#e0ebe3' }}
          rows={4}
          placeholder="Describe your service, experience, and why customers should choose you..."
          value={form.description}
          onChange={e => setF('description', e.target.value)}
        />

        <label style={S.label}>Skills (comma separated)</label>
        <input style={S.input} placeholder="e.g. Pipe fitting, Leak detection, Water heater" value={form.skills} onChange={e => setF('skills', e.target.value)} />

        <label style={S.label}>
          Search Tags
          <span style={{ fontWeight: '400', textTransform: 'none', color: '#bbb', marginLeft: '4px' }}>— helps customers find you</span>
        </label>
        <input style={S.input} placeholder="e.g. cheap, urgent, 24hr, licensed, mobile" value={form.tags} onChange={e => setF('tags', e.target.value)} />

        <div style={S.row}>
          <div style={S.half}>
            <label style={S.label}>Experience</label>
            <input style={S.input} placeholder="e.g. 10 years" value={form.experience} onChange={e => setF('experience', e.target.value)} />
          </div>
          <div style={S.half}>
            <label style={S.label}>Availability</label>
            <select style={S.input} value={form.available} onChange={e => setF('available', e.target.value)}>
              {AVAILABILITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
          </div>
        </div>

        <label style={S.label}>Coverage Area</label>
        <input style={S.input} placeholder="e.g. Limbe, Chichiri, Blantyre town" value={form.coverage} onChange={e => setF('coverage', e.target.value)} />

        <label style={S.label}>WhatsApp / Phone *</label>
        <input
          style={S.input}
          placeholder="e.g. +265 999 000 000"
          value={form.contact}
          onChange={e => setF('contact', e.target.value)}
          type="tel"
        />
        <p style={{ fontSize: '11px', color: '#888', marginTop: '4px', marginLeft: '2px' }}>
          Customers will use this to call or WhatsApp you directly.
        </p>

        {/* Media upload */}
        <label style={S.label}>
          Photos & Videos
          <span style={{ fontWeight: '400', textTransform: 'none', color: '#bbb', marginLeft: '4px' }}>
            {mediaPreviewUrls.length}/{MAX_MEDIA} — first photo is your cover
          </span>
        </label>
        <div
          style={{ ...S.mediaUploadBox, opacity: mediaPreviewUrls.length >= MAX_MEDIA ? 0.5 : 1 }}
          onClick={() => mediaPreviewUrls.length < MAX_MEDIA && mediaInputRef.current.click()}
        >
          <div style={{ fontSize: '30px' }}>📸</div>
          <div style={S.mediaUploadText}>Tap to add photos or videos of your work</div>
          <div style={{ fontSize: '11px', color: '#bbb', marginTop: '4px' }}>JPG, PNG, MP4 · max {MAX_MEDIA} files · 10MB each</div>
        </div>
        <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={handleMediaSelect} />

        {mediaPreviewUrls.length > 0 && (
          <div style={S.mediaPreviewRow}>
            {mediaPreviewUrls.map((url, i) => (
              <div key={i} style={S.mediaPreviewItem}>
                {url.match(/\.(mp4|mov)$/i) || mediaFiles[i - ((editingService?.media_urls || []).length - removedUrls.length)]?.type?.startsWith('video') ? (
                  <video src={url} style={S.mediaPreviewImg} muted />
                ) : (
                  <img src={url} alt="" style={S.mediaPreviewImg} />
                )}
                <button style={S.mediaPreviewRemove} onClick={() => removeMedia(i)}>✕</button>
                {i === 0 && (
                  <div style={{ position: 'absolute', bottom: '3px', left: '3px', background: '#1a7a4a', color: '#fff', fontSize: '8px', fontWeight: '700', borderRadius: '4px', padding: '1px 5px' }}>
                    COVER
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {postError && <p style={S.error}>{postError}</p>}
        {postSuccess && (
          <div style={S.successBanner}>
            ✅ {editingService ? 'Listing updated!' : 'You\'re now live!'} Redirecting…
          </div>
        )}

        <button
          style={{ ...S.submitBtn, opacity: posting || uploadingMedia || charCount > MAX_CHARS ? 0.65 : 1 }}
          onClick={handlePost}
          disabled={posting || uploadingMedia || charCount > MAX_CHARS}
        >
          {uploadingMedia ? '📤 Uploading…' : posting ? '⏳ Saving…' : editingService ? '💾 Save Changes' : '🚀 List My Service'}
        </button>

        {editingService && (
          <button
            style={{ ...S.submitBtn, background: '#f0f4f1', color: '#637068', boxShadow: 'none', marginTop: '8px' }}
            onClick={onCancel}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
