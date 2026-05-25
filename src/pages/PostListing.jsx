import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CATEGORIES = ['Electronics', 'Clothing', 'Food', 'Furniture', 'Vehicles', 'Services', 'Other']
const CITIES = ['Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Kasungu', 'Mangochi', 'Karonga', 'Salima']

export default function PostListing() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ title: '', description: '', price: '', category: '', city: '' })
  const [images, setImages] = useState([])   // { file, preview }
  const [videos, setVideos] = useState([])   // { file, preview }
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState('')

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  function pickImages(e) {
    const files = Array.from(e.target.files)
    const valid = files.filter(f => f.type.startsWith('image/') && f.size < 10 * 1024 * 1024)
    if (valid.length !== files.length) setError('Some files skipped — images only, max 10MB each')
    const newImgs = valid.map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setImages(prev => [...prev, ...newImgs].slice(0, 6))
  }

  function pickVideos(e) {
    const files = Array.from(e.target.files)
    const valid = files.filter(f => f.type.startsWith('video/') && f.size < 50 * 1024 * 1024)
    if (valid.length !== files.length) setError('Some files skipped — videos only, max 50MB each')
    const newVids = valid.map(f => ({ file: f, preview: URL.createObjectURL(f) }))
    setVideos(prev => [...prev, ...newVids].slice(0, 2))
  }

  function removeImage(i) {
    setImages(prev => prev.filter((_, idx) => idx !== i))
  }

  function removeVideo(i) {
    setVideos(prev => prev.filter((_, idx) => idx !== i))
  }

  async function uploadFile(file, userId, type) {
    const ext = file.name.split('.').pop()
    const path = `${userId}/${type}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('listings').upload(path, file)
    if (error) throw error
    const { data } = supabase.storage.from('listings').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleSubmit() {
    setError('')
    if (!form.title || !form.price || !form.category || !form.city) {
      setError('Please fill in title, price, category, and city')
      return
    }
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      await supabase.from('users').upsert({ id: user.id, name: user.email }, { onConflict: 'id' })

      // Upload images
      const imageUrls = []
      for (let i = 0; i < images.length; i++) {
        setUploadProgress(`Uploading image ${i + 1} of ${images.length}...`)
        const url = await uploadFile(images[i].file, user.id, 'img')
        imageUrls.push(url)
      }

      // Upload videos
      const videoUrls = []
      for (let i = 0; i < videos.length; i++) {
        setUploadProgress(`Uploading video ${i + 1} of ${videos.length}...`)
        const url = await uploadFile(videos[i].file, user.id, 'vid')
        videoUrls.push(url)
      }

      setUploadProgress('Saving listing...')
      const { error } = await supabase.from('listings').insert({
        seller_id: user.id,
        title: form.title,
        description: form.description,
        price: parseInt(form.price),
        category: form.category,
        city: form.city,
        images: imageUrls,
        videos: videoUrls,
        status: 'active'
      })
      if (error) throw error
      navigate('/')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setUploadProgress('')
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.topbar}>
        <button style={styles.back} onClick={() => navigate('/')}>← Back</button>
        <div style={styles.topTitle}>Post a Listing</div>
        <div style={{ width: 60 }} />
      </div>

      <div style={styles.form}>
        <label style={styles.label}>Title *</label>
        <input style={styles.input} placeholder="e.g. Samsung TV 43 inch" value={form.title} onChange={e => set('title', e.target.value)} />

        <label style={styles.label}>Description</label>
        <textarea style={styles.textarea} placeholder="Describe your item — condition, features, reason for selling..." value={form.description} onChange={e => set('description', e.target.value)} rows={4} />

        <label style={styles.label}>Price (MWK) *</label>
        <input style={styles.input} type="number" placeholder="e.g. 150000" value={form.price} onChange={e => set('price', e.target.value)} />

        <label style={styles.label}>Category *</label>
        <select style={styles.input} value={form.category} onChange={e => set('category', e.target.value)}>
          <option value="">Select category...</option>
          {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <label style={styles.label}>City *</label>
        <select style={styles.input} value={form.city} onChange={e => set('city', e.target.value)}>
          <option value="">Select city...</option>
          {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        {/* Images */}
        <label style={styles.label}>Photos (up to 6)</label>
        <div style={styles.mediaGrid}>
          {images.map((img, i) => (
            <div key={i} style={styles.mediaThumb}>
              <img src={img.preview} alt="" style={styles.thumbImg} />
              <button style={styles.removeBtn} onClick={() => removeImage(i)}>✕</button>
            </div>
          ))}
          {images.length < 6 && (
            <label style={styles.addMedia}>
              <span style={styles.addIcon}>📷</span>
              <span style={styles.addText}>Add Photo</span>
              <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={pickImages} />
            </label>
          )}
        </div>

        {/* Videos */}
        <label style={styles.label}>Videos (up to 2, max 50MB each)</label>
        <div style={styles.mediaGrid}>
          {videos.map((vid, i) => (
            <div key={i} style={styles.mediaThumb}>
              <video src={vid.preview} style={styles.thumbImg} muted />
              <button style={styles.removeBtn} onClick={() => removeVideo(i)}>✕</button>
              <div style={styles.vidBadge}>▶</div>
            </div>
          ))}
          {videos.length < 2 && (
            <label style={styles.addMedia}>
              <span style={styles.addIcon}>🎥</span>
              <span style={styles.addText}>Add Video</span>
              <input type="file" accept="video/*" multiple style={{ display: 'none' }} onChange={pickVideos} />
            </label>
          )}
        </div>

        {error && <p style={styles.error}>{error}</p>}
        {uploadProgress && <p style={styles.progress}>{uploadProgress}</p>}

        <button style={styles.btn} onClick={handleSubmit} disabled={loading}>
          {loading ? uploadProgress || 'Posting...' : 'Post Listing'}
        </button>
      </div>
    </div>
  )
}

const styles = {
  page: { minHeight: '100vh', background: '#f4f8f5', paddingBottom: '40px' },
  topbar: { background: '#fff', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #d8e5dc' },
  back: { background: 'none', border: 'none', fontSize: '14px', color: '#1a7a4a', fontWeight: '600', cursor: 'pointer', width: 60 },
  topTitle: { fontSize: '16px', fontWeight: '700', color: '#0f1410' },
  form: { padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: '4px' },
  label: { fontSize: '13px', fontWeight: '600', color: '#637068', marginBottom: '4px', marginTop: '10px' },
  input: { width: '100%', border: '1.5px solid #d8e5dc', borderRadius: '10px', padding: '12px 14px', fontSize: '15px', outline: 'none', background: '#fff' },
  textarea: { width: '100%', border: '1.5px solid #d8e5dc', borderRadius: '10px', padding: '12px 14px', fontSize: '15px', outline: 'none', background: '#fff', resize: 'vertical' },
  mediaGrid: { display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' },
  mediaThumb: { width: '90px', height: '90px', borderRadius: '10px', overflow: 'hidden', position: 'relative', background: '#e8f4ee' },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  removeBtn: { position: 'absolute', top: '4px', right: '4px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '22px', height: '22px', fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  vidBadge: { position: 'absolute', bottom: '4px', left: '4px', background: 'rgba(0,0,0,0.5)', color: '#fff', borderRadius: '4px', padding: '1px 5px', fontSize: '11px' },
  addMedia: { width: '90px', height: '90px', borderRadius: '10px', border: '2px dashed #b8d8c4', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', background: '#f4f8f5' },
  addIcon: { fontSize: '24px' },
  addText: { fontSize: '11px', color: '#637068', marginTop: '4px' },
  btn: { background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '10px', padding: '14px', fontSize: '15px', fontWeight: '600', cursor: 'pointer', marginTop: '20px' },
  error: { color: '#c0392b', fontSize: '13px', marginTop: '8px' },
  progress: { color: '#1a7a4a', fontSize: '13px', marginTop: '8px', fontWeight: '500' },
}