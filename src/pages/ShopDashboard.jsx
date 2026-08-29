import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { uploadToR2 } from '../lib/r2'
import { fetchShopAnalytics } from '../lib/orders'

const T = {
  green: '#2e7d32',
  greenDark: '#1b5e20',
  greenLight: '#e8f5e9',
  gold: '#f9a825',
  goldDark: '#f57f17',
  white: '#ffffff',
  offwhite: '#f9fafb',
  text: '#0d1b0e',
  textMuted: '#4a5e4d',
  textLight: '#7a917c',
  border: '#d8e8da',
  danger: '#b91c1c',
  dangerBg: '#fef2f2',
  success: '#15803d',
  successBg: '#f0fdf4',
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

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; }

  @keyframes sd-fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
  @keyframes sd-spin { to { transform: rotate(360deg); } }

  .sd-root { font-family: 'Inter', system-ui, sans-serif; background: ${T.offwhite}; min-height: 100vh; }

  .sd-topbar {
    background: ${T.white}; border-bottom: 1px solid ${T.border};
    padding: 14px 24px; display: flex; align-items: center; gap: 16px;
  }
  .sd-brand { font-size: 19px; font-weight: 900; color: ${T.text}; letter-spacing: -0.4px; }
  .sd-brand span { color: ${T.green}; }
  .sd-topbar-right { margin-left: auto; display: flex; align-items: center; gap: 12px; }
  .sd-view-shop-link {
    font-size: 13px; font-weight: 700; color: ${T.green};
    display: flex; align-items: center; gap: 5px; text-decoration: none; cursor: pointer; background: none; border: none;
  }

  .sd-wrap { max-width: 1080px; margin: 0 auto; padding: 24px; }

  .sd-header-row {
    display: flex; align-items: center; gap: 14px; margin-bottom: 24px; flex-wrap: wrap;
  }
  .sd-shop-mini-logo {
    width: 52px; height: 52px; border-radius: 14px; object-fit: cover;
    background: ${T.greenLight}; display: flex; align-items: center; justify-content: center;
    font-size: 18px; font-weight: 800; color: ${T.green}; flex-shrink: 0;
  }
  .sd-header-text h1 { font-size: 21px; font-weight: 800; color: ${T.text}; letter-spacing: -0.4px; }
  .sd-header-text p { font-size: 13px; color: ${T.textMuted}; margin-top: 2px; }
  .sd-verified-chip {
    display: inline-flex; align-items: center; gap: 4px;
    background: ${T.greenLight}; color: ${T.green};
    font-size: 11px; font-weight: 700; padding: 3px 9px; border-radius: 20px; margin-left: 8px;
  }

  /* Tabs */
  .sd-tabs { display: flex; gap: 6px; margin-bottom: 24px; border-bottom: 1px solid ${T.border}; }
  .sd-tab {
    font-size: 13.5px; font-weight: 700; color: ${T.textMuted};
    padding: 10px 16px; cursor: pointer; background: none; border: none; font-family: inherit;
    position: relative; border-radius: 10px 10px 0 0;
  }
  .sd-tab.active { color: ${T.green}; }
  .sd-tab.active::after { content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 2px; background: ${T.green}; }
  .sd-order-badge {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 18px; height: 18px; border-radius: 10px; background: ${T.goldDark};
    color: #fff; font-size: 10.5px; font-weight: 800; padding: 0 5px; margin-left: 6px;
  }

  /* Stats grid */
  .sd-stats-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 28px;
  }
  @media (max-width: 760px) { .sd-stats-grid { grid-template-columns: repeat(2, 1fr); } }
  .sd-stat-card {
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 14px; padding: 18px;
    animation: sd-fadeUp 0.3s ease both;
  }
  .sd-stat-icon {
    width: 36px; height: 36px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center; margin-bottom: 10px;
  }
  .sd-stat-num { font-size: 22px; font-weight: 800; color: ${T.text}; line-height: 1.1; }
  .sd-stat-label { font-size: 12px; color: ${T.textMuted}; margin-top: 3px; }

  .sd-section-title { font-size: 15px; font-weight: 800; color: ${T.text}; margin-bottom: 14px; }

  .sd-add-product-btn {
    display: inline-flex; align-items: center; gap: 8px;
    background: ${T.green}; color: ${T.white}; border: none; border-radius: 12px;
    padding: 13px 22px; font-size: 14.5px; font-weight: 700; font-family: inherit;
    cursor: pointer; box-shadow: 0 4px 14px rgba(46,125,50,0.28); margin-bottom: 28px;
  }
  .sd-add-product-btn:hover { background: ${T.greenDark}; }

  /* Listings table-ish list */
  .sd-listing-row {
    display: flex; align-items: center; gap: 14px;
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 12px;
    padding: 12px 16px; margin-bottom: 10px;
  }
  .sd-listing-thumb { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; background: ${T.offwhite}; flex-shrink: 0; }
  .sd-listing-title { font-size: 13.5px; font-weight: 700; color: ${T.text}; }
  .sd-listing-price { font-size: 12.5px; color: ${T.green}; font-weight: 700; margin-top: 2px; }
  .sd-listing-status {
    margin-left: auto; font-size: 11px; font-weight: 700;
    padding: 3px 10px; border-radius: 20px; flex-shrink: 0;
  }
  .sd-listing-status.active { background: ${T.greenLight}; color: ${T.green}; }
  .sd-listing-status.inactive { background: #f1f3f1; color: ${T.textMuted}; }
  .sd-listing-status.lowstock { background: #fef3e2; color: ${T.goldDark}; }

  .sd-lowstock-tag {
    font-size: 10.5px; font-weight: 700; color: ${T.goldDark};
    background: #fef3e2; border-radius: 12px; padding: 2px 8px; margin-left: 6px;
  }
  .sd-lowstock-banner {
    background: #fef3e2; border: 1px solid #fde6b1; color: #92600a;
    border-radius: 12px; padding: 12px 16px; font-size: 13px; font-weight: 600;
    margin-bottom: 22px; line-height: 1.5;
  }
  .sd-stock-ctrl { display: flex; align-items: center; gap: 6px; margin-left: auto; }
  .sd-stock-btn {
    width: 26px; height: 26px; border-radius: 7px; border: 1.5px solid ${T.border};
    background: ${T.white}; color: ${T.green}; font-size: 15px; font-weight: 800;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
  }
  .sd-stock-btn:hover { border-color: ${T.green}; }
  .sd-stock-num { font-size: 12.5px; font-weight: 800; color: ${T.text}; min-width: 26px; text-align: center; }

  .sd-empty-state {
    background: ${T.white}; border: 1.5px dashed ${T.border}; border-radius: 14px;
    padding: 36px 20px; text-align: center; color: ${T.textMuted};
  }

  .sd-tips-list { list-style: none; margin-top: 8px; }
  .sd-tips-list li {
    font-size: 13px; color: ${T.textMuted}; padding: 6px 0;
    display: flex; align-items: center; gap: 8px;
  }

  /* Edit form */
  .sd-form-card {
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 16px; padding: 24px;
    max-width: 640px;
  }
  .sd-field { margin-bottom: 18px; }
  .sd-label { display: block; font-size: 13px; font-weight: 700; color: ${T.text}; margin-bottom: 6px; }
  .sd-input, .sd-select, .sd-textarea {
    width: 100%; border: 1.5px solid ${T.border}; border-radius: 10px; padding: 11px 13px;
    font-size: 14px; font-family: inherit; color: ${T.text}; background: ${T.white};
  }
  .sd-input:focus, .sd-select:focus, .sd-textarea:focus { outline: none; border-color: ${T.green}; box-shadow: 0 0 0 3px rgba(46,125,50,0.1); }
  .sd-textarea { resize: vertical; min-height: 70px; }

  .sd-logo-row { display: flex; align-items: center; gap: 16px; margin-bottom: 8px; }
  .sd-logo-preview {
    width: 64px; height: 64px; border-radius: 50%; background: ${T.greenLight};
    display: flex; align-items: center; justify-content: center; font-size: 22px; font-weight: 800; color: ${T.green};
    overflow: hidden; flex-shrink: 0; border: 2px solid ${T.border};
  }
  .sd-logo-preview img { width: 100%; height: 100%; object-fit: cover; }
  .sd-upload-btn {
    font-size: 12.5px; font-weight: 700; color: ${T.green}; background: ${T.greenLight};
    border: none; border-radius: 8px; padding: 7px 14px; cursor: pointer;
  }

  .sd-save-btn {
    background: ${T.green}; color: ${T.white}; border: none; border-radius: 11px;
    padding: 12px 24px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer;
    display: flex; align-items: center; gap: 8px;
  }
  .sd-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }

  .sd-msg { border-radius: 10px; padding: 10px 14px; font-size: 13px; font-weight: 500; margin-bottom: 16px; }
  .sd-msg-success { background: ${T.successBg}; color: ${T.success}; }
  .sd-msg-error { background: ${T.dangerBg}; color: ${T.danger}; }

  .sd-spinner {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2.2px solid rgba(255,255,255,0.3); border-top-color: #fff;
    animation: sd-spin 0.6s linear infinite;
  }

  .sd-loading, .sd-noshop {
    display: flex; align-items: center; justify-content: center; flex-direction: column; gap: 14px;
    height: 60vh; color: ${T.textMuted};
  }
`

function initials(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

export default function ShopDashboard() {
  const navigate = useNavigate()
  const logoInputRef = useRef(null)

  const [shop, setShop] = useState(null)
  const [listings, setListings] = useState([])
  const [followerCount, setFollowerCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('overview')

  // Edit form state
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
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)

  // Analytics state
  const [analytics, setAnalytics] = useState(null)
  const [chatCount, setChatCount] = useState(0)

  const refreshAnalytics = async (shop) => {
    const target = shop || null
    if (!target) return
    const stats = await fetchShopAnalytics(target.id)
    setAnalytics(stats)
  }

  useEffect(() => {
    let active = true
    async function init() {
      setLoading(true)
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }

      const { data: shopData } = await supabase
        .from('shops')
        .select('*')
        .eq('owner_id', user.id)
        .maybeSingle()

      if (!active) return

      if (!shopData) {
        setShop(null)
        setLoading(false)
        return
      }

      setShop(shopData)
      setFollowerCount(shopData.follower_count || 0)
      setName(shopData.name || '')
      setCategory(shopData.category || '')
      setDescription(shopData.description || '')
      setDistrict(shopData.district || '')
      setCity(shopData.city || '')
      setWhatsapp(shopData.whatsapp || '')
      setPhone(shopData.phone || '')
      setAddress(shopData.address || '')
      setLogoPreview(shopData.logo_url || null)

      const { data: listingData } = await supabase
        .from('listings')
        .select('id, title, price, images, status, created_at, stock_qty')
        .eq('shop_id', shopData.id)
        .order('created_at', { ascending: false })

      if (active) setListings(listingData || [])
      setLoading(false)

      // Analytics (best-effort; migration may not be applied yet)
      refreshAnalytics(shopData).catch(() => {})

      // Buyer chats — distinct people who messaged this seller (best-effort)
      try {
        const { data: chatRows } = await supabase
          .from('messages')
          .select('from_user, to_user')
          .or(`from_user.eq.${user.id},to_user.eq.${user.id}`)
          .limit(500)
        if (active && chatRows) {
          const people = new Set(
            chatRows.map(m => (m.from_user === user.id ? m.to_user : m.from_user))
          )
          setChatCount(people.size)
        }
      } catch { /* non-fatal */ }
    }
    init()
    return () => { active = false }
  }, [navigate])

  function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  async function uploadLogo(file) {
    const ext = file.name.split('.').pop()
    const path = `logos/${crypto.randomUUID()}.${ext}`
    const url = await uploadToR2(file, 'shop-images/' + path)
    if (!url) throw new Error('Upload failed')
    return url
  }

  // +/- 1 stock on a product; DB trigger auto-delists at 0 and restores on restock
  async function adjustStock(listing, delta) {
    if (!listing || !shop) return
    const next = Math.max(0, Number(listing.stock_qty || 0) + delta)
    const prev = listings
    setSaveMsg(null)
    try {
      setListings(ls => ls.map(l => l.id === listing.id ? { ...l, stock_qty: next } : l))
      const { error } = await supabase
        .from('listings')
        .update({ stock_qty: next })
        .eq('id', listing.id)
      if (error) throw error
      const { data: fresh } = await supabase
        .from('listings')
        .select('id, title, price, images, status, created_at, stock_qty')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
      if (fresh) setListings(fresh)
    } catch (e) {
      setSaveMsg({ type: 'error', text: e.message || 'Could not update stock.' })
      setListings(prev)
    }
  }

  async function handleSave() {
    if (!shop) return
    setSaving(true)
    setSaveMsg(null)
    try {
      let logo_url = shop.logo_url
      if (logoFile) logo_url = await uploadLogo(logoFile)

      const { error } = await supabase.from('shops').update({
        name: name.trim(),
        category,
        description: description.trim() || null,
        district,
        city: city.trim() || null,
        whatsapp: whatsapp.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        logo_url,
        updated_at: new Date().toISOString(),
      }).eq('id', shop.id)

      if (error) throw error

      setShop(s => ({ ...s, name, category, description, district, city, whatsapp, phone, address, logo_url }))
      setSaveMsg({ type: 'success', text: 'Shop updated successfully.' })
    } catch (err) {
      setSaveMsg({ type: 'error', text: err.message || 'Something went wrong.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="sd-root">
        <style>{css}</style>
        <div className="sd-loading">Loading your shop…</div>
      </div>
    )
  }

  if (!shop) {
    return (
      <div className="sd-root">
        <style>{css}</style>
        <div className="sd-noshop">
          <div style={{ fontSize: 16, fontWeight: 700, color: T.text }}>You don't have a shop yet</div>
          <button className="sd-add-product-btn" onClick={() => navigate('/shop-setup')}>Create My Shop</button>
        </div>
      </div>
    )
  }

  const activeListings = listings.filter(l => l.status === 'active')
  const lowStockListings = listings.filter(l => l.stock_qty != null && Number(l.stock_qty) <= 3)

  return (
    <div className="sd-root">
      <style>{css}</style>

      <div className="sd-topbar">
        <div className="sd-brand">Soko<span>MW</span></div>
        <div className="sd-topbar-right">
          <button className="sd-view-shop-link" onClick={() => navigate(`/shop/${shop.slug}`)}>
            View my public shop ↗
          </button>
        </div>
      </div>

      <div className="sd-wrap">

        <div className="sd-header-row">
          {shop.logo_url ? (
            <img className="sd-shop-mini-logo" src={shop.logo_url} alt={shop.name} />
          ) : (
            <div className="sd-shop-mini-logo">{initials(shop.name)}</div>
          )}
          <div className="sd-header-text">
            <h1>
              {shop.name}
              {shop.is_verified && <span className="sd-verified-chip">✓ Verified</span>}
            </h1>
            <p>Manage your shop, products, and information</p>
          </div>
        </div>

        <div className="sd-tabs">
          <button className={`sd-tab ${tab === 'overview' ? 'active' : ''}`} onClick={() => setTab('overview')}>Overview</button>
          <button className={`sd-tab ${tab === 'products' ? 'active' : ''}`} onClick={() => setTab('products')}>Products</button>
          <button className={`sd-tab ${tab === 'edit' ? 'active' : ''}`} onClick={() => setTab('edit')}>Edit Shop Info</button>
        </div>

        {tab === 'overview' && (
          <>
            <div className="sd-stats-grid">
              <div className="sd-stat-card">
                <div className="sd-stat-icon" style={{ background: '#f1edff' }}>📦</div>
                <div className="sd-stat-num">{listings.length}</div>
                <div className="sd-stat-label">Total products</div>
              </div>
              <div className="sd-stat-card">
                <div className="sd-stat-icon" style={{ background: T.greenLight }}>🛒</div>
                <div className="sd-stat-num">{chatCount}</div>
                <div className="sd-stat-label">Buyer chats</div>
              </div>
              <div className="sd-stat-card">
                <div className="sd-stat-icon" style={{ background: '#e3f2fd' }}>👀</div>
                <div className="sd-stat-num">{analytics?.views ?? '—'}</div>
                <div className="sd-stat-label">Product views</div>
              </div>
              <div className="sd-stat-card">
                <div className="sd-stat-icon" style={{ background: '#fee2e2' }}>🔖</div>
                <div className="sd-stat-num">{analytics?.saves ?? '—'}</div>
                <div className="sd-stat-label">Listing saves</div>
              </div>
            </div>

            <div className="sd-stats-grid" style={{ marginTop: -14 }}>
              <div className="sd-stat-card">
                <div className="sd-stat-icon" style={{ background: T.greenLight }}>👥</div>
                <div className="sd-stat-num">{followerCount}</div>
                <div className="sd-stat-label">Followers</div>
              </div>
              <div className="sd-stat-card">
                <div className="sd-stat-icon" style={{ background: '#fef3e2' }}>⭐</div>
                <div className="sd-stat-num">{shop.rating || '—'}</div>
                <div className="sd-stat-label">Shop rating</div>
              </div>
              <div className="sd-stat-card">
                <div className="sd-stat-icon" style={{ background: '#e3f2fd' }}>✓</div>
                <div className="sd-stat-num">{activeListings.length}</div>
                <div className="sd-stat-label">Active listings</div>
              </div>
              <div className="sd-stat-card">
                <div className="sd-stat-icon" style={{ background: '#f1edff' }}>💰</div>
                <div className="sd-stat-num">{shop.is_verified ? '✓' : '—'}</div>
                <div className="sd-stat-label">Verification</div>
              </div>
            </div>

            <button className="sd-add-product-btn" onClick={() => navigate('/post', { state: { shopId: shop.id } })}>
              + Add Product
            </button>

            {lowStockListings.length > 0 && (
              <div className="sd-lowstock-banner">
                ⚠️ {lowStockListings.length} product{lowStockListings.length === 1 ? '' : 's'} running low on stock — restock in the Products tab before you miss sales.
              </div>
            )}

            <div className="sd-section-title">Tips to grow your shop</div>
            <ul className="sd-tips-list">
              <li>✓ Add at least 5 products to look established</li>
              {!shop.logo_url && <li>○ Upload a logo so buyers recognize your shop</li>}
              {!shop.cover_url && <li>○ Add a cover photo to your shop page</li>}
              <li>✓ Share your shop link on WhatsApp groups</li>
            </ul>
          </>
        )}

        {tab === 'products' && (
          <>
            <button className="sd-add-product-btn" onClick={() => navigate('/post', { state: { shopId: shop.id } })}>
              + Add Product
            </button>
            {saveMsg && <div className={`sd-msg sd-msg-${saveMsg.type}`}>{saveMsg.text}</div>}
            {lowStockListings.length > 0 && (
              <div className="sd-lowstock-banner">
                ⚠️ Low stock: {lowStockListings.map(l => l.title).join(', ')}
              </div>
            )}
            {listings.length === 0 ? (
              <div className="sd-empty-state">No products yet. Add your first one to start selling.</div>
            ) : (
              listings.map(l => {
                const low = l.stock_qty != null && Number(l.stock_qty) <= 3
                return (
                  <div key={l.id} className="sd-listing-row">
                    <img className="sd-listing-thumb" src={l.images?.[0]} alt={l.title} onClick={() => navigate(`/post/edit/${l.id}`)} style={{ cursor: 'pointer' }} />
                    <div onClick={() => navigate(`/post/edit/${l.id}`)} style={{ cursor: 'pointer', flex: 1, minWidth: 0 }}>
                      <div className="sd-listing-title">
                        {l.title}
                        {low && <span className="sd-lowstock-tag">{Number(l.stock_qty) === 0 ? 'Out of stock' : `${l.stock_qty} left`}</span>}
                      </div>
                      <div className="sd-listing-price">MK {Number(l.price).toLocaleString()}</div>
                    </div>
                    {l.stock_qty != null && (
                      <div className="sd-stock-ctrl" title="Adjust stock">
                        <button className="sd-stock-btn" onClick={() => adjustStock(l, -1)} disabled={Number(l.stock_qty) <= 0}>−</button>
                        <span className="sd-stock-num">{l.stock_qty}</span>
                        <button className="sd-stock-btn" onClick={() => adjustStock(l, 1)}>+</button>
                      </div>
                    )}
                    <div className={`sd-listing-status ${l.status === 'active' ? 'active' : low ? 'lowstock' : 'inactive'}`}>
                      {l.status === 'active' ? (low ? 'Low stock' : 'Active') : 'Inactive'}
                    </div>
                  </div>
                )
              })
            )}
          </>
        )}

        {tab === 'edit' && (
          <div className="sd-form-card">
            {saveMsg && <div className={`sd-msg sd-msg-${saveMsg.type}`}>{saveMsg.text}</div>}

            <div className="sd-field">
              <label className="sd-label">Shop Logo</label>
              <div className="sd-logo-row">
                <div className="sd-logo-preview">
                  {logoPreview ? <img src={logoPreview} alt="Logo" /> : initials(name)}
                </div>
                <button className="sd-upload-btn" onClick={() => logoInputRef.current?.click()}>Change Logo</button>
                <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={handleLogoChange} />
              </div>
            </div>

            <div className="sd-field">
              <label className="sd-label">Shop Name</label>
              <input className="sd-input" value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div className="sd-field">
              <label className="sd-label">Category</label>
              <select className="sd-select" value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="sd-field">
              <label className="sd-label">Description</label>
              <textarea className="sd-textarea" value={description} onChange={e => setDescription(e.target.value)} />
            </div>

            <div className="sd-field">
              <label className="sd-label">District</label>
              <select className="sd-select" value={district} onChange={e => setDistrict(e.target.value)}>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="sd-field">
              <label className="sd-label">City / Trading Centre</label>
              <input className="sd-input" value={city} onChange={e => setCity(e.target.value)} />
            </div>

            <div className="sd-field">
              <label className="sd-label">WhatsApp Number</label>
              <input className="sd-input" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} />
            </div>

            <div className="sd-field">
              <label className="sd-label">Phone Number</label>
              <input className="sd-input" value={phone} onChange={e => setPhone(e.target.value)} />
            </div>

            <div className="sd-field">
              <label className="sd-label">Physical Address</label>
              <input className="sd-input" value={address} onChange={e => setAddress(e.target.value)} />
            </div>

            <button className="sd-save-btn" onClick={handleSave} disabled={saving}>
              {saving ? <div className="sd-spinner" /> : 'Save Changes'}
            </button>
          </div>
        )}

      </div>
    </div>
  )
}