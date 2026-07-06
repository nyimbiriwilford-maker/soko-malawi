import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const T = {
  green: '#2e7d32',
  greenDark: '#1b5e20',
  greenLight: '#e8f5e9',
  gold: '#f9a825',
  goldDark: '#f57f17',
  dark: '#0d1f0f',
  white: '#ffffff',
  offwhite: '#f9fafb',
  text: '#0d1b0e',
  textMuted: '#4a5e4d',
  textLight: '#7a917c',
  border: '#d8e8da',
  danger: '#b91c1c',
  dangerBg: '#fef2f2',
}

const CATEGORIES = [
  'Fashion & Clothing', 'Electronics', 'Phones & Accessories', 'Vehicles',
  'Home & Furniture', 'Agriculture', 'Beauty & Cosmetics', 'Hardware',
  'Food & Groceries', 'Services', 'Other',
]

const DISTRICTS = [
  'Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Kasungu', 'Mangochi',
  'Salima', 'Karonga', 'Mchinji', 'Dedza', 'Ntcheu', 'Balaka',
  'Machinga', 'Nkhotakota', 'Rumphi', 'Other',
]

const THEMES = [
  { id: 'green', label: 'Green', color: T.green },
  { id: 'gold', label: 'Gold', color: T.gold },
  { id: 'dark', label: 'Dark', color: T.dark },
]

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');

  *, *::before, *::after { box-sizing: border-box; }

  @keyframes ss-fadeUp {
    from { opacity: 0; transform: translateY(14px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ss-spin { to { transform: rotate(360deg); } }
  @keyframes ss-pop {
    0%   { transform: scale(0.9); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }

  .ss-root {
    font-family: 'Inter', system-ui, sans-serif;
    min-height: 100vh;
    background: ${T.offwhite};
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 28px 16px 60px;
  }

  /* Top bar */
  .ss-topbar {
    width: 100%;
    max-width: 560px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 22px;
  }
  .ss-brand {
    font-size: 19px;
    font-weight: 900;
    letter-spacing: -0.6px;
    color: ${T.dark};
  }
  .ss-brand span { color: ${T.gold}; }
  .ss-step-label {
    font-size: 12.5px;
    font-weight: 700;
    color: ${T.textMuted};
  }

  /* Progress bar */
  .ss-progress {
    width: 100%;
    max-width: 560px;
    display: flex;
    gap: 6px;
    margin-bottom: 28px;
  }
  .ss-progress-seg {
    height: 5px;
    flex: 1;
    border-radius: 3px;
    background: ${T.border};
    transition: background 0.3s;
  }
  .ss-progress-seg.done { background: ${T.green}; }

  .ss-card {
    width: 100%;
    max-width: 560px;
    background: ${T.white};
    border: 1.5px solid ${T.border};
    border-radius: 20px;
    padding: 30px 28px;
    animation: ss-fadeUp 0.35s cubic-bezier(0.16,1,0.3,1) both;
  }

  .ss-head { margin-bottom: 24px; }
  .ss-head h1 {
    font-size: 22px;
    font-weight: 800;
    color: ${T.text};
    letter-spacing: -0.4px;
  }
  .ss-head p {
    font-size: 13.5px;
    color: ${T.textMuted};
    margin-top: 5px;
    line-height: 1.5;
  }

  .ss-field { margin-bottom: 20px; }
  .ss-label {
    display: block;
    font-size: 13px;
    font-weight: 700;
    color: ${T.text};
    margin-bottom: 6px;
  }
  .ss-label .req { color: ${T.danger}; margin-left: 2px; }
  .ss-hint {
    font-size: 12px;
    color: ${T.textLight};
    margin-top: 5px;
    line-height: 1.5;
  }

  .ss-input, .ss-select, .ss-textarea {
    width: 100%;
    border: 1.5px solid ${T.border};
    border-radius: 11px;
    padding: 12px 14px;
    font-size: 14.5px;
    font-weight: 500;
    font-family: inherit;
    color: ${T.text};
    background: ${T.white};
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .ss-input::placeholder, .ss-textarea::placeholder { color: #b0c4b3; }
  .ss-input:focus, .ss-select:focus, .ss-textarea:focus {
    outline: none;
    border-color: ${T.green};
    box-shadow: 0 0 0 3.5px rgba(46,125,50,0.1);
  }
  .ss-textarea { resize: vertical; min-height: 72px; line-height: 1.5; }
  .ss-select { cursor: pointer; }

  .ss-input-error { border-color: ${T.danger} !important; }

  .ss-whatsapp-wrap { display: flex; gap: 8px; }
  .ss-whatsapp-prefix {
    display: flex; align-items: center;
    padding: 0 12px;
    border: 1.5px solid ${T.border};
    border-radius: 11px;
    font-size: 14.5px;
    font-weight: 600;
    color: ${T.textMuted};
    background: ${T.offwhite};
  }

  /* Seller type cards */
  .ss-type-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 20px;
  }
  @media (max-width: 480px) {
    .ss-type-grid { grid-template-columns: 1fr; }
  }
  .ss-type-card {
    border: 1.5px solid ${T.border};
    border-radius: 14px;
    padding: 16px 14px;
    cursor: pointer;
    transition: all 0.15s;
    text-align: left;
  }
  .ss-type-card:hover { border-color: #b9d6bd; }
  .ss-type-card.active {
    border-color: ${T.green};
    background: ${T.greenLight};
    box-shadow: 0 0 0 3px rgba(46,125,50,0.08);
  }
  .ss-type-card h4 {
    font-size: 14px;
    font-weight: 800;
    color: ${T.text};
    margin-bottom: 4px;
  }
  .ss-type-card p {
    font-size: 11.5px;
    color: ${T.textMuted};
    line-height: 1.5;
  }

  /* Logo upload */
  .ss-logo-row { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
  .ss-logo-preview {
    width: 72px; height: 72px;
    border-radius: 50%;
    background: ${T.greenLight};
    display: flex; align-items: center; justify-content: center;
    font-size: 24px;
    font-weight: 800;
    color: ${T.green};
    overflow: hidden;
    flex-shrink: 0;
    border: 2px solid ${T.border};
  }
  .ss-logo-preview img { width: 100%; height: 100%; object-fit: cover; }
  .ss-logo-actions { display: flex; flex-direction: column; gap: 8px; }
  .ss-upload-btn {
    font-size: 12.5px;
    font-weight: 700;
    color: ${T.green};
    background: ${T.greenLight};
    border: none;
    border-radius: 8px;
    padding: 7px 14px;
    cursor: pointer;
    width: fit-content;
  }
  .ss-upload-btn:hover { background: #d0ead2; }
  .ss-remove-btn {
    font-size: 12px;
    font-weight: 600;
    color: ${T.textLight};
    background: none;
    border: none;
    cursor: pointer;
    width: fit-content;
    text-decoration: underline;
  }

  /* Cover upload */
  .ss-cover-drop {
    border: 1.5px dashed ${T.border};
    border-radius: 14px;
    height: 110px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: border-color 0.2s, background 0.2s;
    background: ${T.offwhite};
    overflow: hidden;
    position: relative;
  }
  .ss-cover-drop:hover { border-color: ${T.green}; background: ${T.greenLight}; }
  .ss-cover-drop img { width: 100%; height: 100%; object-fit: cover; }
  .ss-cover-drop .ss-cover-placeholder {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    color: ${T.textLight}; font-size: 12.5px; font-weight: 600;
  }

  /* Theme picker */
  .ss-theme-grid { display: flex; gap: 12px; }
  .ss-theme-swatch {
    flex: 1;
    border: 1.5px solid ${T.border};
    border-radius: 14px;
    padding: 14px 10px;
    text-align: center;
    cursor: pointer;
    transition: all 0.15s;
  }
  .ss-theme-swatch.active { border-color: ${T.green}; box-shadow: 0 0 0 3px rgba(46,125,50,0.08); }
  .ss-theme-dot {
    width: 28px; height: 28px;
    border-radius: 50%;
    margin: 0 auto 8px;
  }
  .ss-theme-swatch span {
    font-size: 12.5px;
    font-weight: 700;
    color: ${T.text};
  }

  /* Preview card (step 4) */
  .ss-preview-shop {
    border-radius: 16px;
    overflow: hidden;
    border: 1.5px solid ${T.border};
    margin-bottom: 20px;
  }
  .ss-preview-cover {
    height: 90px;
    background: linear-gradient(135deg, ${T.green}, ${T.greenDark});
    position: relative;
  }
  .ss-preview-cover img { width: 100%; height: 100%; object-fit: cover; }
  .ss-preview-body { padding: 16px; position: relative; }
  .ss-preview-logo {
    width: 56px; height: 56px;
    border-radius: 50%;
    border: 3px solid ${T.white};
    background: ${T.greenLight};
    display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 800; color: ${T.green};
    margin-top: -40px;
    margin-bottom: 10px;
    overflow: hidden;
  }
  .ss-preview-logo img { width: 100%; height: 100%; object-fit: cover; }
  .ss-preview-name { font-size: 17px; font-weight: 800; color: ${T.text}; }
  .ss-preview-meta {
    display: flex; flex-wrap: wrap; gap: 10px;
    margin-top: 6px;
    font-size: 12.5px;
    color: ${T.textMuted};
  }
  .ss-preview-meta span { display: flex; align-items: center; gap: 4px; }
  .ss-preview-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: ${T.greenLight};
    color: ${T.green};
    font-size: 11px;
    font-weight: 700;
    padding: 3px 9px;
    border-radius: 12px;
    margin-top: 10px;
  }

  .ss-nav {
    display: flex;
    gap: 10px;
    margin-top: 26px;
  }
  .ss-btn {
    border: none;
    border-radius: 12px;
    padding: 13px 20px;
    font-size: 14.5px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: all 0.2s;
  }
  .ss-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .ss-btn-primary {
    flex: 1;
    background: ${T.green};
    color: ${T.white};
    box-shadow: 0 4px 14px rgba(46,125,50,0.28);
  }
  .ss-btn-primary:hover:not(:disabled) { background: ${T.greenDark}; }
  .ss-btn-launch {
    flex: 1;
    background: linear-gradient(135deg, ${T.gold} 0%, ${T.goldDark} 100%);
    color: ${T.text};
    box-shadow: 0 4px 14px rgba(249,168,37,0.35);
  }
  .ss-btn-launch:hover:not(:disabled) { box-shadow: 0 6px 20px rgba(249,168,37,0.45); }
  .ss-btn-back {
    background: ${T.white};
    color: ${T.text};
    border: 1.5px solid ${T.border};
    padding: 13px 18px;
  }
  .ss-btn-back:hover { background: ${T.offwhite}; }

  .ss-spinner {
    width: 16px; height: 16px;
    border-radius: 50%;
    border: 2.2px solid rgba(255,255,255,0.3);
    border-top-color: #fff;
    animation: ss-spin 0.6s linear infinite;
  }
  .ss-spinner-dark {
    border-color: rgba(13,27,14,0.2);
    border-top-color: ${T.text};
  }

  .ss-error-msg {
    background: ${T.dangerBg};
    border: 1px solid #fecaca;
    color: ${T.danger};
    border-radius: 10px;
    padding: 10px 14px;
    font-size: 13px;
    font-weight: 500;
    margin-bottom: 18px;
  }

  /* Success screen */
  .ss-success {
    text-align: center;
    padding: 40px 20px;
    animation: ss-pop 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
  }
  .ss-success-emoji { font-size: 52px; margin-bottom: 14px; }
  .ss-success h2 { font-size: 22px; font-weight: 800; color: ${T.text}; }
  .ss-success p { font-size: 14px; color: ${T.textMuted}; margin-top: 8px; }
`

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export default function ShopSetup() {
  const navigate = useNavigate()
  const logoInputRef = useRef(null)
  const coverInputRef = useRef(null)

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [sellerType, setSellerType] = useState('individual') // 'individual' | 'business'
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')

  const [district, setDistrict] = useState('')
  const [city, setCity] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [theme, setTheme] = useState('green')

  function validateStep1() {
    if (!name.trim()) return 'Shop name is required'
    if (!category) return 'Please choose a category'
    return ''
  }
  function validateStep2() {
    if (!district) return 'Please choose a district'
    if (!whatsapp.trim()) return 'WhatsApp number is required'
    if (!/^[0-9+\s-]{7,15}$/.test(whatsapp.trim())) return 'Enter a valid WhatsApp number'
    return ''
  }

  function goNext() {
    let err = ''
    if (step === 1) err = validateStep1()
    if (step === 2) err = validateStep2()
    if (err) { setError(err); return }
    setError('')
    setStep(s => Math.min(s + 1, 4))
  }
  function goBack() {
    setError('')
    setStep(s => Math.max(s - 1, 1))
  }

  function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }
  function handleCoverChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  async function uploadImage(file, prefix) {
    const ext = file.name.split('.').pop()
    const path = `${prefix}/${crypto.randomUUID()}.${ext}`
    const { error: upErr } = await supabase.storage.from('shop-images').upload(path, file)
    if (upErr) throw upErr
    const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
    return data.publicUrl
  }

  async function handleLaunch() {
    setLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }

      let logo_url = null
      let cover_url = null
      if (logoFile) logo_url = await uploadImage(logoFile, 'logos')
      if (coverFile) cover_url = await uploadImage(coverFile, 'covers')

      const baseSlug = slugify(name) || 'shop'
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`

      const { error: insertErr } = await supabase.from('shops').insert({
        owner_id: user.id,
        name: name.trim(),
        slug,
        category,
        description: description.trim() || null,
        seller_type: sellerType,
        district,
        city: city.trim() || null,
        whatsapp: whatsapp.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        logo_url,
        cover_url,
        theme,
      })
      if (insertErr) throw insertErr

      await supabase.from('profiles').update({
        onboarded: true,
        account_type: 'shop',
      }).eq('id', user.id)

      setStep(5) // success screen
      setTimeout(() => navigate(`/shop/${slug}`), 1800)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const stepLabels = { 1: 'Basic Info', 2: 'Location & Contact', 3: 'Branding', 4: 'Review & Launch' }

  return (
    <div className="ss-root">
      <style>{css}</style>

      {step <= 4 && (
        <>
          <div className="ss-topbar">
            <div className="ss-brand">Soko<span>MW</span></div>
            <div className="ss-step-label">Step {step} of 4 — {stepLabels[step]}</div>
          </div>
          <div className="ss-progress">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`ss-progress-seg ${i <= step ? 'done' : ''}`} />
            ))}
          </div>
        </>
      )}

      {/* ── STEP 1: Basic Info ── */}
      {step === 1 && (
        <div className="ss-card">
          <div className="ss-head">
            <h1>Create Your Shop</h1>
            <p>Let's start with the basics. This takes less than a minute.</p>
          </div>

          {error && <div className="ss-error-msg">{error}</div>}

          <div className="ss-field">
            <label className="ss-label">What type of shop is this?</label>
            <div className="ss-type-grid">
              <div
                className={`ss-type-card ${sellerType === 'individual' ? 'active' : ''}`}
                onClick={() => setSellerType('individual')}
              >
                <h4>Individual Seller</h4>
                <p>Student selling shoes, casual trader, someone selling phones</p>
              </div>
              <div
                className={`ss-type-card ${sellerType === 'business' ? 'active' : ''}`}
                onClick={() => setSellerType('business')}
              >
                <h4>Registered Business</h4>
                <p>Boutique, hardware shop, pharmacy, electronics store</p>
              </div>
            </div>
          </div>

          <div className="ss-field">
            <label className="ss-label">Shop Name<span className="req">*</span></label>
            <input
              className="ss-input"
              type="text"
              placeholder="e.g. Grace Fashion Boutique"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <div className="ss-hint">Examples: Grace Fashion Boutique · Chinsapo Hardware · Mzuzu Electronics</div>
          </div>

          <div className="ss-field">
            <label className="ss-label">Business Category<span className="req">*</span></label>
            <select className="ss-select" value={category} onChange={e => setCategory(e.target.value)}>
              <option value="">Select a category</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className="ss-field">
            <label className="ss-label">Short Description</label>
            <textarea
              className="ss-textarea"
              placeholder="We sell quality ladies fashion at affordable prices."
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
          </div>

          <div className="ss-nav">
            <button className="ss-btn ss-btn-primary" onClick={goNext}>Continue →</button>
          </div>
        </div>
      )}

      {/* ── STEP 2: Location & Contact ── */}
      {step === 2 && (
        <div className="ss-card">
          <div className="ss-head">
            <h1>Location & Contact</h1>
            <p>Help customers find and reach you.</p>
          </div>

          {error && <div className="ss-error-msg">{error}</div>}

          <div className="ss-field">
            <label className="ss-label">District<span className="req">*</span></label>
            <select className="ss-select" value={district} onChange={e => setDistrict(e.target.value)}>
              <option value="">Select your district</option>
              {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>

          <div className="ss-field">
            <label className="ss-label">City / Trading Centre</label>
            <input
              className="ss-input"
              type="text"
              placeholder="e.g. Area 25, Chinsapo, Mzuzu"
              value={city}
              onChange={e => setCity(e.target.value)}
            />
          </div>

          <div className="ss-field">
            <label className="ss-label">WhatsApp Number<span className="req">*</span></label>
            <div className="ss-whatsapp-wrap">
              <div className="ss-whatsapp-prefix">🇲🇼 +265</div>
              <input
                className="ss-input"
                type="tel"
                placeholder="999 XXX XXX"
                value={whatsapp}
                onChange={e => setWhatsapp(e.target.value)}
              />
            </div>
            <div className="ss-hint">Most buyers will message you here — keep it active.</div>
          </div>

          <div className="ss-field">
            <label className="ss-label">Phone Number</label>
            <input
              className="ss-input"
              type="tel"
              placeholder="Optional — if different from WhatsApp"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />
          </div>

          <div className="ss-field">
            <label className="ss-label">Physical Address</label>
            <input
              className="ss-input"
              type="text"
              placeholder="e.g. Opposite Chichiri Shopping Mall"
              value={address}
              onChange={e => setAddress(e.target.value)}
            />
          </div>

          <div className="ss-nav">
            <button className="ss-btn ss-btn-back" onClick={goBack}>← Back</button>
            <button className="ss-btn ss-btn-primary" onClick={goNext}>Continue →</button>
          </div>
        </div>
      )}

      {/* ── STEP 3: Branding ── */}
      {step === 3 && (
        <div className="ss-card">
          <div className="ss-head">
            <h1>Branding</h1>
            <p>Make your shop look professional. All optional — you can add these later.</p>
          </div>

          <div className="ss-field">
            <label className="ss-label">Shop Logo</label>
            <div className="ss-logo-row">
              <div className="ss-logo-preview">
                {logoPreview ? <img src={logoPreview} alt="Logo" /> : initials(name)}
              </div>
              <div className="ss-logo-actions">
                <button className="ss-upload-btn" onClick={() => logoInputRef.current?.click()}>
                  Upload Logo
                </button>
                {logoPreview && (
                  <button className="ss-remove-btn" onClick={() => { setLogoFile(null); setLogoPreview(null) }}>
                    Remove — use initials
                  </button>
                )}
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={handleLogoChange} />
            </div>
            <div className="ss-hint">No logo? No problem — we'll use your shop initials ({initials(name)}).</div>
          </div>

          <div className="ss-field">
            <label className="ss-label">Cover Photo</label>
            <div className="ss-cover-drop" onClick={() => coverInputRef.current?.click()}>
              {coverPreview ? (
                <img src={coverPreview} alt="Cover" />
              ) : (
                <div className="ss-cover-placeholder">
                  <span>📷 Tap to upload a cover photo</span>
                  <span style={{ fontWeight: 500, opacity: 0.8 }}>Storefront, products, or a business banner</span>
                </div>
              )}
            </div>
            <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={handleCoverChange} />
          </div>

          <div className="ss-field">
            <label className="ss-label">Shop Theme</label>
            <div className="ss-theme-grid">
              {THEMES.map(t => (
                <div
                  key={t.id}
                  className={`ss-theme-swatch ${theme === t.id ? 'active' : ''}`}
                  onClick={() => setTheme(t.id)}
                >
                  <div className="ss-theme-dot" style={{ background: t.color }} />
                  <span>{t.label}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="ss-nav">
            <button className="ss-btn ss-btn-back" onClick={goBack}>← Back</button>
            <button className="ss-btn ss-btn-primary" onClick={goNext}>Continue →</button>
          </div>
        </div>
      )}

      {/* ── STEP 4: Review & Launch ── */}
      {step === 4 && (
        <div className="ss-card">
          <div className="ss-head">
            <h1>Review &amp; Launch</h1>
            <p>Here's how your shop will look. You can edit anything later.</p>
          </div>

          {error && <div className="ss-error-msg">{error}</div>}

          <div className="ss-preview-shop">
            <div className="ss-preview-cover">
              {coverPreview && <img src={coverPreview} alt="Cover" />}
            </div>
            <div className="ss-preview-body">
              <div className="ss-preview-logo">
                {logoPreview ? <img src={logoPreview} alt="Logo" /> : initials(name)}
              </div>
              <div className="ss-preview-name">{name || 'Your Shop Name'}</div>
              <div className="ss-preview-meta">
                <span>🏷️ {category || 'Category'}</span>
                <span>📍 {city ? `${city}, ${district}` : district || 'District'}</span>
                {whatsapp && <span>📱 +265 {whatsapp}</span>}
              </div>
              <div className="ss-preview-badge">★★★★★ New Shop</div>
            </div>
          </div>

          <div className="ss-nav">
            <button className="ss-btn ss-btn-back" onClick={goBack} disabled={loading}>← Edit</button>
            <button className="ss-btn ss-btn-launch" onClick={handleLaunch} disabled={loading}>
              {loading ? <div className="ss-spinner ss-spinner-dark" /> : '🚀 Launch Shop'}
            </button>
          </div>
        </div>
      )}

      {/* ── SUCCESS ── */}
      {step === 5 && (
        <div className="ss-card">
          <div className="ss-success">
            <div className="ss-success-emoji">🎉</div>
            <h2>Shop Created Successfully!</h2>
            <p>Taking you to your shop dashboard…</p>
          </div>
        </div>
      )}
    </div>
  )
}