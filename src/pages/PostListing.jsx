import { useState, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
async function compressImage(file) {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const MAX = 1200
      let { width, height } = img
      if (width > MAX || height > MAX) {
        if (width > height) { height = Math.round(height * MAX / width); width = MAX }
        else { width = Math.round(width * MAX / height); height = MAX }
      }
      const canvas = document.createElement('canvas')
      canvas.width = width; canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)
      canvas.toBlob(blob => resolve(new File([blob], file.name.replace(/\.[^.]+$/, '.webp'), { type: 'image/webp' })), 'image/webp', 0.82)
    }
    img.src = url
  })
}

const CATEGORIES = [
  { id: 'Electronics', icon: '📱', color: '#1a7a4a', bg: '#e6f4ec', desc: 'Phones, TVs, Laptops' },
  { id: 'Vehicles',    icon: '🚗', color: '#1d4ed8', bg: '#dbeafe', desc: 'Cars, Trucks, Bikes' },
  { id: 'Furniture',   icon: '🛋️', color: '#b45309', bg: '#fef3c7', desc: 'Sofas, Beds, Tables' },
  { id: 'Clothing',    icon: '👗', color: '#7c3aed', bg: '#ede9fe', desc: 'Clothes, Shoes, Bags' },
  { id: 'Property',    icon: '🏠', color: '#0f766e', bg: '#ccfbf1', desc: 'Houses, Plots, Rentals' },
  { id: 'Agriculture', icon: '🌾', color: '#15803d', bg: '#dcfce7', desc: 'Crops, Livestock, Tools' },
  { id: 'Food',        icon: '🍎', color: '#dc2626', bg: '#fee2e2', desc: 'Fresh produce, Packaged' },
  { id: 'Services',    icon: '🔧', color: '#d97706', bg: '#fef3c7', desc: 'Repairs, Installation' },
  { id: 'Other',       icon: '📦', color: '#6b7280', bg: '#f3f4f6', desc: 'Everything else' },
]

const CITIES = ['Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Kasungu', 'Mangochi', 'Karonga', 'Salima']

const CONDITION_OPTIONS = [
  { id: 'new',       label: 'Brand New',  icon: '', sub: 'Sealed or never used' },
  { id: 'like_new',  label: 'Like New',   icon: '', sub: 'Used once or twice' },
  { id: 'good',      label: 'Good',       icon: '', sub: 'Normal wear, works great' },
  { id: 'fair',      label: 'Fair',       icon: '', sub: 'Visible wear, fully functional' },
  { id: 'for_parts', label: 'For Parts',  icon: '', sub: 'Not fully working' },
]

const PRICE_TYPES = [
  { id: 'fixed',      label: 'Fixed Price',        icon: '🏷️' },
  { id: 'negotiable', label: 'Negotiable',          icon: '🤝' },
  { id: 'free',       label: 'Free / Giving Away',  icon: '🎁' },
]

const PROMO_BADGES = [
  { id: 'none',     label: 'No Badge',        icon: '○',  color: '#9ca3af', bg: '#f3f4f6',  desc: 'Standard listing' },
  { id: 'hot',      label: '🔥 Hot Deal',     icon: '🔥', color: '#dc2626', bg: '#fef2f2',  desc: 'High demand item' },
  { id: 'sale',     label: '💸 On Sale',      icon: '💸', color: '#d97706', bg: '#fffbeb',  desc: 'Price reduced' },
  { id: 'new_in',   label: '🆕 New In',       icon: '🆕', color: '#1d4ed8', bg: '#eff6ff',  desc: 'Just arrived' },
  { id: 'limited',  label: '⚡ Limited Stock', icon: '⚡', color: '#7c3aed', bg: '#faf5ff',  desc: 'Few units left' },
  { id: 'featured', label: '⭐ Featured',     icon: '⭐', color: '#f59e0b', bg: '#fffbeb',  desc: 'Top of search results' },
]

const STEPS = ['Category', 'Details', 'Media', 'Price & Location', 'Promotions']

// ── helpers ──
function fmtMWK(n) {
  const num = parseInt(n) || 0
  return 'MWK ' + num.toLocaleString()
}

export default function PostListing() {
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const isEdit = !!editId
  const [step, setStep] = useState(0)
  const [editLoading, setEditLoading] = useState(isEdit)
  const [form, setForm] = useState({
    title: '', description: '', price: '',
    category: '', city: '', condition: '', priceType: 'fixed',
    tags: [], phone: '', meetupNote: '',
    // Promotions
    badge: 'none',
    flashSaleEnabled: false,
    flashSaleHours: 24,
    flashSalePercent: 10,
    // Bulk pricing tiers
    bulkEnabled: false,
    bulkTiers: [
      { minQty: 2, discountPercent: 5 },
      { minQty: 5, discountPercent: 10 },
      { minQty: 10, discountPercent: 15 },
    ],
    stockQty: '',
  })
  const [images, setImages] = useState([])
  const [videos, setVideos] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [uploadProgress, setUploadProgress] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [coords, setCoords] = useState({ lat: null, lng: null })
  const fileInputRef = useRef()
  const videoInputRef = useRef()

  useEffect(() => {
  if (!editId) return
  async function loadEdit() {
    const { data } = await supabase.from('listings').select('*').eq('id', editId).single()
    if (!data) return
    setForm({
      title: data.title || '',
      description: data.description || '',
      price: data.price || '',
      category: data.category || '',
      city: data.city || '',
      condition: data.condition || '',
      priceType: data.price_type || 'fixed',
      tags: data.tags || [],
      phone: data.phone || '',
      meetupNote: data.meetup_note || '',
      badge: data.promo_badge || 'none',
      flashSaleEnabled: !!data.flash_sale_price,
      flashSaleHours: 24,
      flashSalePercent: data.flash_sale_price
        ? Math.round((1 - data.flash_sale_price / data.price) * 100)
        : 10,
      bulkEnabled: !!(data.bulk_pricing?.length),
      bulkTiers: data.bulk_pricing?.length
        ? data.bulk_pricing
        : [{ minQty: 2, discountPercent: 5 }, { minQty: 5, discountPercent: 10 }, { minQty: 10, discountPercent: 15 }],
      stockQty: data.stock_qty || '',
    })
    setEditLoading(false)
  }
  loadEdit()
}, [editId])
  // ── ADD THIS BLOCK ──
useEffect(() => {
  try {
    const cached = sessionStorage.getItem('userCoords')
    if (cached) {
      const { lat, lng } = JSON.parse(cached)
      setCoords({ lat, lng })
      return
    }
  } catch {}
  navigator.geolocation?.getCurrentPosition(
    pos => {
      const lat = pos.coords.latitude
      const lng  = pos.coords.longitude
      try { sessionStorage.setItem('userCoords', JSON.stringify({ lat, lng })) } catch {}
      setCoords({ lat, lng })
    },
    () => {},
    { timeout: 5000, maximumAge: 300_000 }
  )
}, [])
// ── END ADD ──

  function set(field, value) { setForm(f => ({ ...f, [field]: value })) }
  function setTier(i, field, value) {
    setForm(f => {
      const tiers = [...f.bulkTiers]
      tiers[i] = { ...tiers[i], [field]: value }
      return { ...f, bulkTiers: tiers }
    })
  }
  function addTier() {
    setForm(f => ({
      ...f,
      bulkTiers: [...f.bulkTiers, { minQty: '', discountPercent: '' }]
    }))
  }
  function removeTier(i) {
    setForm(f => ({ ...f, bulkTiers: f.bulkTiers.filter((_, idx) => idx !== i) }))
  }

  // ── MEDIA ──
  function addImages(files) {
    const valid = files.filter(f => f.type.startsWith('image/') && f.size < 10 * 1024 * 1024)
    if (valid.length !== files.length) setError('Some files skipped — images only, max 10MB each')
    setImages(prev => [...prev, ...valid.map(f => ({ file: f, preview: URL.createObjectURL(f) }))].slice(0, 8))
  }
  function pickImages(e) { addImages(Array.from(e.target.files || [])) }
  function pickVideos(e) {
    const valid = Array.from(e.target.files || []).filter(f => f.type.startsWith('video/') && f.size < 100 * 1024 * 1024)
    setVideos(prev => [...prev, ...valid.map(f => ({ file: f, preview: URL.createObjectURL(f) }))].slice(0, 3))
  }
  function removeImage(i) { setImages(prev => prev.filter((_, idx) => idx !== i)) }
  function removeVideo(i) { setVideos(prev => prev.filter((_, idx) => idx !== i)) }
  function moveImage(from, to) {
    setImages(prev => { const a = [...prev]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a })
  }

  // ── TAGS ──
  function addTag(e) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault()
      const tag = tagInput.trim().replace(/,/g, '').toLowerCase()
      if (tag && !form.tags.includes(tag) && form.tags.length < 8) set('tags', [...form.tags, tag])
      setTagInput('')
    }
    if (e.key === 'Backspace' && !tagInput && form.tags.length) set('tags', form.tags.slice(0, -1))
  }

  // ── VALIDATION ──
  function canProceed() {
    if (step === 0) return !!form.category
    if (step === 1) return form.title.length >= 3 && !!form.condition
    if (step === 2) return true
    if (step === 3) return (form.priceType === 'free' || !!form.price) && !!form.city
    return true
  }

  // ── computed promo price ──
  const basePrice = parseInt(form.price) || 0
  const flashPrice = form.flashSaleEnabled
    ? Math.round(basePrice * (1 - form.flashSalePercent / 100))
    : basePrice

  // ── UPLOAD & SUBMIT ──
 async function uploadFile(file, userId, type) {
  const isImage = file.type.startsWith('image/')
  const processed = isImage ? await compressImage(file) : file
  const ext = isImage ? 'webp' : file.name.split('.').pop()
  const path = `${userId}/${type}_${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const { error } = await supabase.storage.from('listings').upload(path, processed)
  if (error) throw error
  return supabase.storage.from('listings').getPublicUrl(path).data.publicUrl
}
  async function handleSubmit() {
    setError('')
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setError('Please sign in first'); setLoading(false); return }
      if (!isEdit) await supabase.from('users').upsert({ id: user.id, name: user.email }, { onConflict: 'id' })
      const imageUrls = []
      for (let i = 0; i < images.length; i++) {
        setUploadProgress(`Uploading photo ${i + 1}/${images.length}…`)
        imageUrls.push(await uploadFile(images[i].file, user.id, 'img'))
      }
      const videoUrls = []
      for (let i = 0; i < videos.length; i++) {
        setUploadProgress(`Uploading video ${i + 1}/${videos.length}…`)
        videoUrls.push(await uploadFile(videos[i].file, user.id, 'vid'))
      }
      setUploadProgress('Publishing…')

      const flashExpiry = form.flashSaleEnabled
        ? new Date(Date.now() + form.flashSaleHours * 3600 * 1000).toISOString()
        : null

      const payload = {
        title: form.title.trim(),
        description: form.description.trim(),
        price: form.priceType === 'free' ? 0 : basePrice,
        category: form.category,
        city: form.city,
        status: 'active',
        condition: form.condition || null,
        price_type: form.priceType,
        tags: form.tags,
        phone: form.phone || null,
        meetup_note: form.meetupNote || null,
        promo_badge: form.badge !== 'none' ? form.badge : null,
        flash_sale_price: form.flashSaleEnabled ? flashPrice : null,
        flash_sale_expires_at: flashExpiry,
        bulk_pricing: form.bulkEnabled ? form.bulkTiers.filter(t => t.minQty && t.discountPercent) : null,
        stock_qty: form.stockQty ? parseInt(form.stockQty) : null,
        latitude: coords.lat,
        longitude: coords.lng,
      }

      // Remove undefined keys for edit
      Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])

      let insErr
      if (isEdit) {
        // Upload new images/videos if any were added
        if (images.some(i => i.file)) {
          const newUrls = []
          for (let i = 0; i < images.length; i++) {
            if (images[i].file) {
              setUploadProgress(`Uploading photo ${i + 1}/${images.length}…`)
              newUrls.push(await uploadFile(images[i].file, user.id, 'img'))
            } else {
              newUrls.push(images[i].url || images[i].preview)
            }
          }
          payload.images = newUrls
        }
        const { error } = await supabase.from('listings').update(payload).eq('id', editId)
        insErr = error
      } else {
        payload.seller_id = user.id
        payload.images = imageUrls
        payload.videos = videoUrls
        const { error } = await supabase.from('listings').insert(payload)
        insErr = error
      }
        if (insErr) throw insErr
      navigate(isEdit ? '/listing/' + editId : '/?posted=1')
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
      setUploadProgress('')
    }
  }

  const catMeta = CATEGORIES.find(c => c.id === form.category)
  const badgeMeta = PROMO_BADGES.find(b => b.id === form.badge)

  // ── RENDER STEPS ──
  const renderStep = () => {
    switch (step) {

      // ── STEP 0: CATEGORY ──
      case 0: return (
        <div style={S.stepBody}>
          <h2 style={S.stepTitle}>What are you selling?</h2>
          <p style={S.stepSub}>Pick the best category for your item</p>
          <div style={S.catGrid}>
            {CATEGORIES.map(cat => (
              <button key={cat.id}
                style={{ ...S.catCard, ...(form.category === cat.id ? { ...S.catCardActive, borderColor: cat.color, background: cat.bg } : {}) }}
                onClick={() => set('category', cat.id)}>
                <span style={S.catIcon}>{cat.icon}</span>
                <span style={S.catName}>{cat.id}</span>
                <span style={S.catDesc}>{cat.desc}</span>
                {form.category === cat.id && <span style={{ ...S.catCheck, background: cat.color }}>✓</span>}
              </button>
            ))}
          </div>
        </div>
      )

      // ── STEP 1: DETAILS ──
      case 1: return (
        <div style={S.stepBody}>
          <div style={S.catBadge}>
            <span>{catMeta?.icon}</span>
            <span style={{ color: catMeta?.color, fontWeight: 700 }}>{form.category}</span>
          </div>
          <h2 style={S.stepTitle}>Describe your item</h2>
          <label style={S.label}>Title <span style={S.req}>*</span></label>
          <input style={S.input} placeholder={`e.g. ${form.category === 'Vehicles' ? 'Toyota Hilux 2019 Manual' : 'Item name + key detail'}`}
            value={form.title} onChange={e => set('title', e.target.value)} maxLength={80} />
          <div style={S.charCount}>{form.title.length}/80</div>
          <label style={S.label}>Description</label>
          <textarea style={S.textarea}
            placeholder={`Tell buyers what makes your ${form.category?.toLowerCase() || 'item'} worth buying — condition, features, why you're selling…`}
            value={form.description} onChange={e => set('description', e.target.value)} rows={5} />
          <label style={S.label}>Condition <span style={S.req}>*</span></label>
          <div style={S.conditionGrid}>
            {CONDITION_OPTIONS.map(opt => (
              <button key={opt.id} style={{ ...S.conditionBtn, ...(form.condition === opt.id ? S.conditionBtnActive : {}) }}
                onClick={() => set('condition', opt.id)}>
                <span style={S.conditionIcon}>{opt.icon}</span>
                <div>
                  <div style={S.conditionLabel}>{opt.label}</div>
                  <div style={S.conditionSub}>{opt.sub}</div>
                </div>
              </button>
            ))}
          </div>
          <label style={S.label}>Tags <span style={S.labelNote}>(press Enter to add)</span></label>
          <div style={S.tagBox}>
            {form.tags.map(tag => (
              <span key={tag} style={S.tag}>#{tag}
                <button style={S.tagX} onClick={() => set('tags', form.tags.filter(t => t !== tag))}>×</button>
              </span>
            ))}
            <input style={S.tagInput} placeholder={form.tags.length ? '' : 'e.g. toyota, malawi, negotiable'}
              value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={addTag} maxLength={30} />
          </div>
        </div>
      )

      // ── STEP 2: MEDIA ──
      case 2: return (
        <div style={S.stepBody}>
          <h2 style={S.stepTitle}>Add photos & videos</h2>
          <p style={S.stepSub}>Listings with great photos sell <strong>3× faster</strong>. Up to 8 photos, 3 videos.</p>
          <div style={{ ...S.dropZone, ...(dragOver ? S.dropZoneActive : {}) }}
            onDragOver={e => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); addImages(Array.from(e.dataTransfer.files)) }}
            onClick={() => fileInputRef.current?.click()}>
            <span style={S.dropIcon}>📸</span>
            <div style={S.dropText}>Tap to add photos or drag & drop</div>
            <div style={S.dropSub}>JPG, PNG, HEIC — max 10MB each</div>
            <input ref={fileInputRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={pickImages} />
          </div>
          {images.length > 0 && (
            <div style={S.imgGrid}>
              {images.map((img, i) => (
                <div key={i} style={{ ...S.imgThumb, ...(i === 0 ? S.imgThumbCover : {}) }}>
                  <img src={img.preview} alt="" style={S.thumbImg} />
                  {i === 0 && <div style={S.coverBadge}>Cover</div>}
                  <div style={S.imgActions}>
                    {i > 0 && <button style={S.imgActionBtn} onClick={() => moveImage(i, i - 1)}>←</button>}
                    <button style={{ ...S.imgActionBtn, background: '#e53e3e' }} onClick={() => removeImage(i)}>✕</button>
                  </div>
                </div>
              ))}
              {images.length < 8 && (
                <label style={S.addMoreImg}>
                  <span>+</span>
                  <input type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={pickImages} />
                </label>
              )}
            </div>
          )}
          <div style={S.videoSection}>
            <div style={S.videoHeader}>
              <span>🎥</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14 }}>Add a video demo</div>
                <div style={{ fontSize: 12, color: '#637068' }}>Up to 3 videos, max 100MB each</div>
              </div>
              <button style={S.addVideoBtn} onClick={() => videoInputRef.current?.click()}>+ Add</button>
              <input ref={videoInputRef} type="file" accept="video/*" multiple style={{ display: 'none' }} onChange={pickVideos} />
            </div>
            {videos.length > 0 && (
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                {videos.map((vid, i) => (
                  <div key={i} style={S.vidThumb}>
                    <video src={vid.preview} style={S.thumbImg} muted />
                    <button style={S.vidRemove} onClick={() => removeVideo(i)}>✕</button>
                    <div style={S.vidBadge}>▶ Video {i + 1}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )

      // ── STEP 3: PRICE & LOCATION ──
      case 3: return (
        <div style={S.stepBody}>
          <h2 style={S.stepTitle}>Price & Location</h2>
          <label style={S.label}>Pricing type</label>
          <div style={S.priceTypeRow}>
            {PRICE_TYPES.map(pt => (
              <button key={pt.id} style={{ ...S.priceTypeBtn, ...(form.priceType === pt.id ? S.priceTypeBtnActive : {}) }}
                onClick={() => set('priceType', pt.id)}>
                <span>{pt.icon}</span>
                <span style={{ fontSize: 11, fontWeight: 600 }}>{pt.label}</span>
              </button>
            ))}
          </div>
          {form.priceType !== 'free' && (
            <>
              <label style={S.label}>Price (MWK) <span style={S.req}>*</span></label>
              <div style={S.priceWrap}>
                <span style={S.pricePre}>MWK</span>
                <input style={S.priceInput} type="number" placeholder="0"
                  value={form.price} onChange={e => set('price', e.target.value)} min="0" />
              </div>
              {form.price && (
                <div style={S.priceFormatted}>
                  ≈ MWK {parseInt(form.price).toLocaleString()}
                  {form.priceType === 'negotiable' && <span style={{ color: '#1a7a4a', marginLeft: 6 }}>· Open to offers</span>}
                </div>
              )}
            </>
          )}
          <label style={S.label}>Stock / Quantity available <span style={S.labelNote}>(optional)</span></label>
          <input style={S.input} type="number" placeholder="e.g. 10 units in stock" min="1"
            value={form.stockQty} onChange={e => set('stockQty', e.target.value)} />
          <label style={S.label}>City / District <span style={S.req}>*</span></label>
          <div style={S.cityGrid}>
            {CITIES.map(city => (
              <button key={city} style={{ ...S.cityBtn, ...(form.city === city ? S.cityBtnActive : {}) }}
                onClick={() => set('city', city)}>{city}</button>
            ))}
          </div>
          <label style={S.label}>Meetup / Delivery note <span style={S.labelNote}>(optional)</span></label>
          <input style={S.input} placeholder="e.g. Can deliver within Lilongwe, meetup at Area 3"
            value={form.meetupNote} onChange={e => set('meetupNote', e.target.value)} />
          <label style={S.label}>WhatsApp / Phone <span style={S.labelNote}>(optional)</span></label>
          <div style={S.phoneWrap}>
            <span style={S.phonePre}>+265</span>
            <input style={S.phoneInput} type="tel" placeholder="999 123 456"
              value={form.phone} onChange={e => set('phone', e.target.value)} />
          </div>
          {/* Preview */}
          {form.title && (
            <div style={S.previewCard}>
              <div style={S.previewLabel}>📋 Live Preview</div>
              {images[0] && <img src={images[0].preview} alt="" style={S.previewImg} />}
              <div style={S.previewTitle}>{form.title}</div>
              <div style={S.previewMeta}>
                <span style={{ ...S.previewBadge, background: catMeta?.bg, color: catMeta?.color }}>{catMeta?.icon} {form.category}</span>
                {form.priceType === 'free'
                  ? <span style={{ ...S.previewBadge, background: '#dcfce7', color: '#15803d', fontWeight: 800 }}>FREE</span>
                  : <span style={{ fontWeight: 800, color: '#1a7a4a', fontSize: 16 }}>MWK {parseInt(form.price || 0).toLocaleString()}</span>}
              </div>
              {form.city && <div style={S.previewCity}>📍 {form.city}</div>}
            </div>
          )}
        </div>
      )

      // ── STEP 4: PROMOTIONS ──
      case 4: return (
        <div style={S.stepBody}>
          <h2 style={S.stepTitle}>Boost your listing</h2>
          <p style={S.stepSub}>Optional tools to attract more buyers and sell faster</p>

          {/* ── PROMO BADGE ── */}
          <div style={S.promoSection}>
            <div style={S.promoSectionHeader}>
              <span style={S.promoSectionIcon}>🏅</span>
              <div>
                <div style={S.promoSectionTitle}>Promotion Badge</div>
                <div style={S.promoSectionSub}>A badge shown on your listing card in search results</div>
              </div>
            </div>
            <div style={S.badgeGrid}>
              {PROMO_BADGES.map(b => (
                <button key={b.id}
                  style={{ ...S.badgeBtn, ...(form.badge === b.id ? { ...S.badgeBtnActive, borderColor: b.color, background: b.bg } : {}) }}
                  onClick={() => set('badge', b.id)}>
                  <span style={S.badgeBtnIcon}>{b.icon}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: form.badge === b.id ? b.color : '#374151' }}>{b.label}</span>
                  {form.badge === b.id && <span style={{ ...S.badgeCheck, background: b.color }}>✓</span>}
                </button>
              ))}
            </div>
          </div>

          {/* ── FLASH SALE ── */}
          <div style={S.promoSection}>
            <div style={S.promoSectionHeader}>
              <span style={S.promoSectionIcon}>⚡</span>
              <div style={{ flex: 1 }}>
                <div style={S.promoSectionTitle}>Flash Sale</div>
                <div style={S.promoSectionSub}>Temporary discount with a countdown timer visible to buyers</div>
              </div>
              <button style={{ ...S.toggle, ...(form.flashSaleEnabled ? S.toggleOn : {}) }}
                onClick={() => set('flashSaleEnabled', !form.flashSaleEnabled)}>
                <div style={{ ...S.toggleThumb, ...(form.flashSaleEnabled ? S.toggleThumbOn : {}) }} />
              </button>
            </div>

            {form.flashSaleEnabled && (
              <div style={S.promoBody}>
                <div style={S.flashRow}>
                  <div style={S.flashField}>
                    <label style={S.flashLabel}>Discount</label>
                    <div style={S.flashInputWrap}>
                      <input style={S.flashInput} type="number" min="1" max="90"
                        value={form.flashSalePercent}
                        onChange={e => set('flashSalePercent', Math.min(90, Math.max(1, parseInt(e.target.value) || 0)))} />
                      <span style={S.flashUnit}>%</span>
                    </div>
                  </div>
                  <div style={S.flashField}>
                    <label style={S.flashLabel}>Duration</label>
                    <div style={S.flashInputWrap}>
                      <input style={S.flashInput} type="number" min="1" max="168"
                        value={form.flashSaleHours}
                        onChange={e => set('flashSaleHours', Math.min(168, Math.max(1, parseInt(e.target.value) || 0)))} />
                      <span style={S.flashUnit}>hrs</span>
                    </div>
                  </div>
                </div>

                {basePrice > 0 && (
                  <div style={S.flashPreviewBox}>
                    <div style={S.flashPreviewLeft}>
                      <div style={S.flashPreviewOrig}>{fmtMWK(basePrice)}</div>
                      <div style={S.flashPreviewSlash} />
                    </div>
                    <div style={S.flashPreviewArrow}>→</div>
                    <div style={S.flashPreviewNew}>{fmtMWK(flashPrice)}</div>
                    <div style={S.flashPreviewSave}>Save {form.flashSalePercent}%</div>
                    <div style={S.flashCountdown}>
                      🔥 Ends in {form.flashSaleHours >= 24
                        ? `${Math.floor(form.flashSaleHours / 24)}d ${form.flashSaleHours % 24}h`
                        : `${form.flashSaleHours}h`}
                    </div>
                  </div>
                )}

                {/* Duration presets */}
                <div style={S.durationPresets}>
                  {[{ h: 6, label: '6h' }, { h: 12, label: '12h' }, { h: 24, label: '1 day' }, { h: 48, label: '2 days' }, { h: 72, label: '3 days' }].map(p => (
                    <button key={p.h}
                      style={{ ...S.durationBtn, ...(form.flashSaleHours === p.h ? S.durationBtnActive : {}) }}
                      onClick={() => set('flashSaleHours', p.h)}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── BULK PRICING ── */}
          <div style={S.promoSection}>
            <div style={S.promoSectionHeader}>
              <span style={S.promoSectionIcon}>📦</span>
              <div style={{ flex: 1 }}>
                <div style={S.promoSectionTitle}>Bulk / Volume Pricing</div>
                <div style={S.promoSectionSub}>Automatic discounts when buyers order more — great for Agriculture, Food, Clothing</div>
              </div>
              <button style={{ ...S.toggle, ...(form.bulkEnabled ? S.toggleOn : {}) }}
                onClick={() => set('bulkEnabled', !form.bulkEnabled)}>
                <div style={{ ...S.toggleThumb, ...(form.bulkEnabled ? S.toggleThumbOn : {}) }} />
              </button>
            </div>

            {form.bulkEnabled && (
              <div style={S.promoBody}>
                <div style={S.bulkTableHead}>
                  <span style={{ flex: 1 }}>Min. Quantity</span>
                  <span style={{ flex: 1 }}>Discount</span>
                  <span style={{ width: 32 }}></span>
                </div>

                {form.bulkTiers.map((tier, i) => (
                  <div key={i} style={S.bulkRow}>
                    <div style={S.bulkTierNum}>{i + 1}</div>
                    <div style={S.bulkInputGroup}>
                      <input style={S.bulkInput} type="number" min="1" placeholder="Qty"
                        value={tier.minQty}
                        onChange={e => setTier(i, 'minQty', e.target.value)} />
                      <span style={S.bulkSep}>units →</span>
                      <input style={S.bulkInput} type="number" min="1" max="90" placeholder="%"
                        value={tier.discountPercent}
                        onChange={e => setTier(i, 'discountPercent', e.target.value)} />
                      <span style={S.bulkOffLabel}>% off</span>
                    </div>
                    {basePrice > 0 && tier.minQty && tier.discountPercent && (
                      <div style={S.bulkSavedNote}>
                        = {fmtMWK(Math.round(basePrice * (1 - tier.discountPercent / 100)))} each
                      </div>
                    )}
                    {form.bulkTiers.length > 1 && (
                      <button style={S.bulkRemoveBtn} onClick={() => removeTier(i)}>✕</button>
                    )}
                  </div>
                ))}

                {form.bulkTiers.length < 5 && (
                  <button style={S.addTierBtn} onClick={addTier}>+ Add another tier</button>
                )}

                {/* Bulk preview table */}
                {basePrice > 0 && form.bulkTiers.some(t => t.minQty && t.discountPercent) && (
                  <div style={S.bulkPreview}>
                    <div style={S.bulkPreviewTitle}>How buyers will see this:</div>
                    <div style={S.bulkPreviewRow}>
                      <span style={{ color: '#637068' }}>1 unit</span>
                      <span style={{ fontWeight: 700 }}>{fmtMWK(basePrice)}</span>
                    </div>
                    {form.bulkTiers
                      .filter(t => t.minQty && t.discountPercent)
                      .sort((a, b) => a.minQty - b.minQty)
                      .map((tier, i) => {
                        const discPrice = Math.round(basePrice * (1 - tier.discountPercent / 100))
                        const totalSaving = (basePrice - discPrice) * tier.minQty
                        return (
                          <div key={i} style={{ ...S.bulkPreviewRow, background: i % 2 === 0 ? '#f0faf4' : 'transparent' }}>
                            <span style={{ color: '#0f1410', fontWeight: 600 }}>{tier.minQty}+ units</span>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 800, color: '#1a7a4a', fontSize: 14 }}>{fmtMWK(discPrice)} each</div>
                              <div style={{ fontSize: 10, color: '#dc2626' }}>Save MWK {totalSaving.toLocaleString()} total</div>
                            </div>
                            <span style={{ ...S.discountPill, background: `hsl(${120 + i * 20}, 60%, 92%)`, color: `hsl(${120 + i * 20}, 60%, 30%)` }}>
                              -{tier.discountPercent}%
                            </span>
                          </div>
                        )
                      })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── FINAL SUMMARY ── */}
          <div style={S.summaryCard}>
            <div style={S.summaryTitle}>📊 Listing Summary</div>
            <div style={S.summaryRow}><span>Category</span><strong>{form.category}</strong></div>
            <div style={S.summaryRow}><span>Condition</span><strong>{CONDITION_OPTIONS.find(c => c.id === form.condition)?.label || '—'}</strong></div>
            <div style={S.summaryRow}><span>Price</span>
              <strong style={{ color: '#1a7a4a' }}>
                {form.priceType === 'free' ? 'FREE' : fmtMWK(basePrice)}
                {form.priceType === 'negotiable' && <span style={{ fontSize: 11, fontWeight: 400, marginLeft: 4 }}>(negotiable)</span>}
              </strong>
            </div>
            {form.flashSaleEnabled && <div style={S.summaryRow}><span>Flash Price</span><strong style={{ color: '#dc2626' }}>{fmtMWK(flashPrice)} for {form.flashSaleHours}h</strong></div>}
            {form.bulkEnabled && <div style={S.summaryRow}><span>Bulk tiers</span><strong>{form.bulkTiers.filter(t => t.minQty && t.discountPercent).length} tiers</strong></div>}
            {form.badge !== 'none' && <div style={S.summaryRow}><span>Badge</span><strong>{badgeMeta?.label}</strong></div>}
            <div style={S.summaryRow}><span>Photos</span><strong>{images.length} photo{images.length !== 1 ? 's' : ''}</strong></div>
            <div style={S.summaryRow}><span>City</span><strong>{form.city || '—'}</strong></div>
          </div>
        </div>
      )

      default: return null
    }
  }

  return (
    <div style={S.page}>
      {/* HEADER */}
      <div style={S.header}>
        <button style={S.backBtn} onClick={() => step > 0 ? setStep(s => s - 1) : navigate('/')}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div style={S.headerCenter}>
          <div style={S.headerTitle}>{isEdit ? 'Edit Listing' : 'Post a Listing'}</div>
          <div style={S.stepIndicator}>{STEPS[step]}</div>
        </div>
        <button style={S.skipBtn} onClick={() => navigate('/')}>✕</button>
      </div>

      {/* PROGRESS */}
      <div style={S.progressTrack}>
        <div style={{ ...S.progressFill, width: `${((step + 1) / STEPS.length) * 100}%` }} />
      </div>

      {/* STEP DOTS */}
      <div style={S.stepDots}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: 'flex', alignItems: 'center' }}>
            <div style={{ ...S.stepDot, ...(i <= step ? S.stepDotActive : {}), ...(i === step ? S.stepDotCurrent : {}) }}>
              {i < step ? '✓' : i + 1}
            </div>
            {i < STEPS.length - 1 && <div style={{ ...S.stepLine, background: i < step ? '#1a7a4a' : '#e5e7eb' }} />}
          </div>
        ))}
      </div>

      {/* BODY */}
      <div style={S.body}>
        {renderStep()}

        {error && (
          <div style={S.errorBox}>
            ⚠️ {error}
            <button style={S.errorClose} onClick={() => setError('')}>×</button>
          </div>
        )}

        {uploadProgress && (
          <div style={S.progressBox}>
            <div style={S.progressSpinner} />
            {uploadProgress}
          </div>
        )}

        {/* FOOTER */}
        <div style={S.footer}>
          {step < STEPS.length - 1 ? (
            <button
              style={{ ...S.nextBtn, ...(canProceed() ? {} : S.nextBtnDisabled) }}
              onClick={() => canProceed() && setStep(s => s + 1)}
              disabled={!canProceed()}>
              Continue
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            </button>
          ) : (
            <button
              style={{ ...S.submitBtn, ...(loading ? S.submitBtnDisabled : {}) }}
              onClick={handleSubmit}
              disabled={loading || !canProceed()}>
              {loading ? (uploadProgress || 'Publishing…') : '🚀 Publish Listing'}
            </button>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
      `}</style>
    </div>
  )
}
// ── STYLES ──
const S = {
  page: { minHeight: '100vh', background: '#f6f9f7', display: 'flex', flexDirection: 'column', fontFamily: "'Segoe UI', system-ui, sans-serif" },
  header: { background: '#fff', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: '1px solid #e8f0ec', position: 'sticky', top: 0, zIndex: 10 },
  backBtn: { background: '#f4f8f5', border: 'none', borderRadius: 10, width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#1a7a4a', flexShrink: 0 },
  headerCenter: { flex: 1, textAlign: 'center' },
  headerTitle: { fontSize: 15, fontWeight: 700, color: '#0f1410' },
  stepIndicator: { fontSize: 11, color: '#637068', marginTop: 1 },
  skipBtn: { background: 'none', border: 'none', fontSize: 18, color: '#aaa', cursor: 'pointer', width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  progressTrack: { height: 3, background: '#e8f0ec', position: 'sticky', top: 66, zIndex: 9 },
  progressFill: { height: '100%', background: 'linear-gradient(90deg, #1a7a4a, #27ae72)', transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)' },
  stepDots: { display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 20px 8px', gap: 0 },
  stepDot: { width: 28, height: 28, borderRadius: '50%', background: '#e8f0ec', color: '#aaa', fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.25s', flexShrink: 0 },
  stepDotActive: { background: '#1a7a4a', color: '#fff' },
  stepDotCurrent: { background: '#1a7a4a', color: '#fff', boxShadow: '0 0 0 4px rgba(26,122,74,0.2)' },
  stepLine: { width: 32, height: 2, transition: 'background 0.25s', flexShrink: 0 },
  body: { flex: 1, overflowY: 'auto', paddingBottom: 110 },
  stepBody: { padding: '20px 16px 0', animation: 'fadeIn 0.2s ease' },
  stepTitle: { fontSize: 22, fontWeight: 800, color: '#0f1410', margin: '0 0 4px', lineHeight: 1.2 },
  stepSub: { fontSize: 13, color: '#637068', margin: '0 0 20px' },
  // Category
  catGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 8 },
  catCard: { background: '#fff', border: '2px solid #e8f0ec', borderRadius: 14, padding: '14px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', transition: 'all 0.18s', position: 'relative' },
  catCardActive: { border: '2px solid', boxShadow: '0 4px 16px rgba(26,122,74,0.15)', transform: 'translateY(-2px)' },
  catIcon: { fontSize: 26, lineHeight: 1 },
  catName: { fontSize: 12, fontWeight: 700, color: '#0f1410' },
  catDesc: { fontSize: 10, color: '#888', textAlign: 'center', lineHeight: 1.3 },
  catCheck: { position: 'absolute', top: 6, right: 6, width: 18, height: 18, borderRadius: '50%', color: '#fff', fontSize: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 },
  catBadge: { display: 'inline-flex', alignItems: 'center', gap: 6, background: '#e6f4ec', borderRadius: 20, padding: '4px 12px', fontSize: 13, marginBottom: 12 },
  label: { display: 'block', fontSize: 13, fontWeight: 700, color: '#374151', marginBottom: 6, marginTop: 16 },
  labelNote: { fontWeight: 400, color: '#9ca3af', marginLeft: 4 },
  req: { color: '#ef4444' },
  input: { width: '100%', border: '1.5px solid #d1d5db', borderRadius: 12, padding: '13px 14px', fontSize: 15, outline: 'none', background: '#fff', boxSizing: 'border-box', fontFamily: 'inherit' },
  charCount: { textAlign: 'right', fontSize: 11, color: '#9ca3af', marginTop: 4 },
  textarea: { width: '100%', border: '1.5px solid #d1d5db', borderRadius: 12, padding: '13px 14px', fontSize: 15, outline: 'none', background: '#fff', resize: 'vertical', boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.6 },
  conditionGrid: { display: 'flex', flexDirection: 'column', gap: 8 },
  conditionBtn: { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '12px 14px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s' },
  conditionBtnActive: { border: '2px solid #1a7a4a', background: '#f0faf4', boxShadow: '0 2px 8px rgba(26,122,74,0.12)' },
  conditionIcon: { fontSize: 20, flexShrink: 0 },
  conditionLabel: { fontSize: 13, fontWeight: 700, color: '#111' },
  conditionSub: { fontSize: 11, color: '#888', marginTop: 1 },
  tagBox: { display: 'flex', flexWrap: 'wrap', gap: 6, border: '1.5px solid #d1d5db', borderRadius: 12, padding: '10px 12px', background: '#fff', minHeight: 46, alignItems: 'center' },
  tag: { background: '#e6f4ec', color: '#1a7a4a', borderRadius: 20, padding: '3px 10px', fontSize: 12, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 },
  tagX: { background: 'none', border: 'none', color: '#1a7a4a', cursor: 'pointer', fontSize: 15, lineHeight: 1, padding: 0 },
  tagInput: { border: 'none', outline: 'none', fontSize: 13, flex: 1, minWidth: 120, fontFamily: 'inherit', background: 'transparent' },
  // Media
  dropZone: { border: '2px dashed #b8d8c4', borderRadius: 16, padding: '32px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, background: '#fff', cursor: 'pointer', transition: 'all 0.2s', marginBottom: 16 },
  dropZoneActive: { border: '2px solid #1a7a4a', background: '#f0faf4', transform: 'scale(1.01)' },
  dropIcon: { fontSize: 36, marginBottom: 4 },
  dropText: { fontSize: 15, fontWeight: 700, color: '#0f1410' },
  dropSub: { fontSize: 12, color: '#888' },
  imgGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 },
  imgThumb: { borderRadius: 12, overflow: 'hidden', position: 'relative', aspectRatio: '1', background: '#e8f4ee' },
  imgThumbCover: { gridColumn: 'span 2', gridRow: 'span 2', borderRadius: 14, border: '2px solid #1a7a4a' },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  coverBadge: { position: 'absolute', top: 8, left: 8, background: '#1a7a4a', color: '#fff', fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '2px 8px' },
  imgActions: { position: 'absolute', bottom: 6, right: 6, display: 'flex', gap: 4 },
  imgActionBtn: { background: 'rgba(0,0,0,0.65)', color: '#fff', border: 'none', borderRadius: 6, width: 26, height: 26, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  addMoreImg: { border: '2px dashed #cde8d8', borderRadius: 12, aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28, color: '#1a7a4a', cursor: 'pointer', background: '#f6faf7' },
  videoSection: { background: '#fff', borderRadius: 14, padding: 14, border: '1.5px solid #e5e7eb', marginBottom: 16 },
  videoHeader: { display: 'flex', alignItems: 'center', gap: 10 },
  addVideoBtn: { marginLeft: 'auto', background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontSize: 13, fontWeight: 600, cursor: 'pointer' },
  vidThumb: { width: 90, height: 90, borderRadius: 10, overflow: 'hidden', position: 'relative', background: '#111' },
  vidRemove: { position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.7)', color: '#fff', border: 'none', borderRadius: '50%', width: 22, height: 22, fontSize: 11, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  vidBadge: { position: 'absolute', bottom: 4, left: 4, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 9, borderRadius: 4, padding: '2px 5px' },
  // Price
  priceTypeRow: { display: 'flex', gap: 8, marginBottom: 4 },
  priceTypeBtn: { flex: 1, background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, cursor: 'pointer', transition: 'all 0.15s', fontSize: 18 },
  priceTypeBtnActive: { border: '2px solid #1a7a4a', background: '#f0faf4', boxShadow: '0 2px 8px rgba(26,122,74,0.12)' },
  priceWrap: { display: 'flex', alignItems: 'center', border: '1.5px solid #d1d5db', borderRadius: 12, overflow: 'hidden', background: '#fff' },
  pricePre: { padding: '0 12px', color: '#637068', fontWeight: 700, fontSize: 13, borderRight: '1px solid #e5e7eb', flexShrink: 0 },
  priceInput: { flex: 1, border: 'none', outline: 'none', padding: '13px 14px', fontSize: 18, fontWeight: 700, color: '#0f1410', fontFamily: 'inherit', background: 'transparent' },
  priceFormatted: { fontSize: 13, color: '#637068', marginTop: 6, fontWeight: 500 },
  cityGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 4 },
  cityBtn: { background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center' },
  cityBtnActive: { background: '#1a7a4a', color: '#fff', border: '2px solid #1a7a4a', boxShadow: '0 2px 8px rgba(26,122,74,0.25)' },
  phoneWrap: { display: 'flex', alignItems: 'center', border: '1.5px solid #d1d5db', borderRadius: 12, overflow: 'hidden', background: '#fff' },
  phonePre: { padding: '0 12px', color: '#637068', fontWeight: 700, fontSize: 13, borderRight: '1px solid #e5e7eb', flexShrink: 0 },
  phoneInput: { flex: 1, border: 'none', outline: 'none', padding: '13px 14px', fontSize: 15, fontFamily: 'inherit', background: 'transparent' },
  previewCard: { marginTop: 24, background: '#fff', borderRadius: 16, border: '1.5px solid #e8f0ec', overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.06)', marginBottom: 8 },
  previewLabel: { fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: 1, padding: '10px 14px 4px', textTransform: 'uppercase' },
  previewImg: { width: '100%', height: 160, objectFit: 'cover', display: 'block' },
  previewTitle: { padding: '10px 14px 4px', fontSize: 16, fontWeight: 800, color: '#0f1410', lineHeight: 1.3 },
  previewMeta: { padding: '0 14px 4px', display: 'flex', alignItems: 'center', gap: 8 },
  previewBadge: { borderRadius: 8, padding: '3px 10px', fontSize: 12, fontWeight: 700 },
  previewCity: { padding: '0 14px 12px', fontSize: 12, color: '#637068' },
  // ── PROMO STEP ──
  promoSection: { background: '#fff', borderRadius: 16, border: '1.5px solid #e8f0ec', marginBottom: 14, overflow: 'hidden' },
  promoSectionHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '16px 16px' },
  promoSectionIcon: { fontSize: 22, flexShrink: 0 },
  promoSectionTitle: { fontSize: 14, fontWeight: 800, color: '#0f1410' },
  promoSectionSub: { fontSize: 11, color: '#637068', marginTop: 2, lineHeight: 1.4 },
  promoBody: { borderTop: '1px solid #f0f0f0', padding: '14px 16px' },
  // Toggle
  toggle: { width: 44, height: 24, borderRadius: 12, background: '#d1d5db', border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, transition: 'background 0.2s' },
  toggleOn: { background: '#1a7a4a' },
  toggleThumb: { position: 'absolute', top: 2, left: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' },
  toggleThumbOn: { left: 22 },
  // Badge picker
  badgeGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 },
  badgeBtn: { background: '#f8f9fa', border: '1.5px solid #e5e7eb', borderRadius: 12, padding: '10px 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, cursor: 'pointer', position: 'relative', transition: 'all 0.15s' },
  badgeBtnActive: { border: '2px solid', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', transform: 'translateY(-1px)' },
  badgeBtnIcon: { fontSize: 20 },
  badgeCheck: { position: 'absolute', top: 4, right: 4, width: 16, height: 16, borderRadius: '50%', color: '#fff', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800 },
  // Flash sale
  flashRow: { display: 'flex', gap: 12, marginBottom: 14 },
  flashField: { flex: 1 },
  flashLabel: { fontSize: 11, fontWeight: 700, color: '#637068', marginBottom: 6, display: 'block', textTransform: 'uppercase', letterSpacing: 0.5 },
  flashInputWrap: { display: 'flex', alignItems: 'center', border: '1.5px solid #d1d5db', borderRadius: 10, overflow: 'hidden', background: '#fff' },
  flashInput: { flex: 1, border: 'none', outline: 'none', padding: '10px 10px', fontSize: 20, fontWeight: 800, color: '#dc2626', fontFamily: 'inherit', background: 'transparent', width: '100%', textAlign: 'center' },
  flashUnit: { padding: '0 10px', color: '#9ca3af', fontWeight: 700, fontSize: 13, flexShrink: 0 },
  flashPreviewBox: { background: 'linear-gradient(135deg, #fff5f5, #fff)', border: '1.5px solid #fecaca', borderRadius: 14, padding: '14px 16px', display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  flashPreviewLeft: { position: 'relative', display: 'inline-flex' },
  flashPreviewOrig: { fontSize: 14, color: '#9ca3af', fontWeight: 600 },
  flashPreviewSlash: { position: 'absolute', top: '50%', left: -2, right: -2, height: 1.5, background: '#e53e3e', transform: 'rotate(-8deg)' },
  flashPreviewArrow: { fontSize: 16, color: '#e53e3e', fontWeight: 800 },
  flashPreviewNew: { fontSize: 22, fontWeight: 900, color: '#dc2626' },
  flashPreviewSave: { background: '#dc2626', color: '#fff', borderRadius: 6, padding: '2px 8px', fontSize: 11, fontWeight: 800 },
  flashCountdown: { width: '100%', fontSize: 12, color: '#dc2626', fontWeight: 700, marginTop: 4 },
  durationPresets: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  durationBtn: { background: '#f3f4f6', border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '5px 12px', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer', transition: 'all 0.12s' },
  durationBtnActive: { background: '#1a7a4a', color: '#fff', border: '1.5px solid #1a7a4a' },
  // Bulk
  bulkTableHead: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, fontWeight: 700, color: '#637068', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  bulkRow: { marginBottom: 10 },
  bulkTierNum: { width: 22, height: 22, borderRadius: '50%', background: '#e6f4ec', color: '#1a7a4a', fontSize: 11, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  bulkInputGroup: { display: 'flex', alignItems: 'center', gap: 6, background: '#f8f9fa', borderRadius: 10, padding: '8px 10px', border: '1.5px solid #e5e7eb' },
  bulkInput: { width: 56, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, fontWeight: 700, color: '#1a7a4a', fontFamily: 'inherit', textAlign: 'center' },
  bulkSep: { fontSize: 11, color: '#9ca3af', whiteSpace: 'nowrap', flexShrink: 0 },
  bulkOffLabel: { fontSize: 11, color: '#637068', flexShrink: 0 },
  bulkSavedNote: { fontSize: 11, color: '#1a7a4a', fontWeight: 700, marginTop: 4, marginLeft: 28 },
  bulkRemoveBtn: { marginLeft: 'auto', background: 'none', border: 'none', color: '#e53e3e', cursor: 'pointer', fontSize: 16, padding: '0 4px' },
  addTierBtn: { width: '100%', background: '#f0faf4', border: '1.5px dashed #b8d8c4', borderRadius: 10, padding: '10px', fontSize: 13, fontWeight: 700, color: '#1a7a4a', cursor: 'pointer', marginTop: 4 },
  bulkPreview: { marginTop: 16, background: '#f8f9fa', borderRadius: 12, overflow: 'hidden', border: '1px solid #e5e7eb' },
  bulkPreviewTitle: { fontSize: 11, fontWeight: 800, color: '#637068', textTransform: 'uppercase', letterSpacing: 0.5, padding: '8px 12px', background: '#f0faf4', borderBottom: '1px solid #e5e7eb' },
  bulkPreviewRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', gap: 8, borderBottom: '1px solid #f0f0f0', fontSize: 13 },
  discountPill: { borderRadius: 20, padding: '2px 8px', fontSize: 11, fontWeight: 800, flexShrink: 0 },
  // Summary
  summaryCard: { background: 'linear-gradient(135deg, #f0faf4, #fff)', border: '1.5px solid #b8d8c4', borderRadius: 16, padding: 16, marginTop: 20, marginBottom: 8 },
  summaryTitle: { fontSize: 13, fontWeight: 800, color: '#1a7a4a', marginBottom: 12 },
  summaryRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #e8f0ec', fontSize: 13, color: '#637068' },
  // Error / Progress
  errorBox: { margin: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: '#dc2626', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  errorClose: { background: 'none', border: 'none', color: '#dc2626', fontSize: 18, cursor: 'pointer', padding: 0 },
  progressBox: { margin: '12px 16px', background: '#f0faf4', border: '1px solid #b8d8c4', borderRadius: 12, padding: '12px 14px', fontSize: 13, color: '#1a7a4a', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 10 },
  progressSpinner: { width: 16, height: 16, border: '2px solid #b8d8c4', borderTop: '2px solid #1a7a4a', borderRadius: '50%', animation: 'spin 0.8s linear infinite', flexShrink: 0 },
  // Footer
  footer: { position: 'fixed', bottom: 0, left: 0, right: 0, background: '#fff', borderTop: '1px solid #e8f0ec', padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))' },
  nextBtn: { width: '100%', background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: 14, padding: '15px', fontSize: 16, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 16px rgba(26,122,74,0.3)' },
  nextBtnDisabled: { background: '#d1d5db', boxShadow: 'none', cursor: 'not-allowed' },
  submitBtn: { width: '100%', background: 'linear-gradient(135deg, #1a7a4a 0%, #15a058 100%)', color: '#fff', border: 'none', borderRadius: 14, padding: '15px', fontSize: 16, fontWeight: 800, cursor: 'pointer', boxShadow: '0 4px 20px rgba(26,122,74,0.4)', letterSpacing: 0.3 },
  submitBtnDisabled: { background: '#d1d5db', boxShadow: 'none', cursor: 'not-allowed' },
}