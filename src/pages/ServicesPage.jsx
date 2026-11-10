import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SERVICE_CATS, CITIES, avatarColor, initials } from './serviceData'
import ServiceForm from './ServiceForm'
import ProviderModal from './ProviderModal'
import SokoNav from '../components/SokoNav'
import { Search, X, MapPin, Wrench, Pencil, Pause, Play, Trash2, Loader2, BadgeCheck } from 'lucide-react'

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes svc-fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes svc-shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

  .soko-services {
    font-family: 'Plus Jakarta Sans', Inter, 'DM Sans', system-ui, sans-serif;
    background: #f4f6f5;
    min-height: 100vh; min-height: 100dvh;
    color: #202124;
    -webkit-tap-highlight-color: transparent;
    padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
  }

  .svc-page {
    max-width: 1280px;
    margin: 0 auto;
    padding: 16px 14px 0;
    display: flex;
    flex-direction: column;
  }
  @media (min-width: 768px) {
    .svc-page { padding-top: 20px; }
  }
  @media (min-width: 1100px) {
    .svc-page { padding: 24px 24px 0; }
  }

  /* Hero */
  .svc-hero {
    display: flex; flex-direction: column; gap: 12px;
    margin-bottom: 14px;
  }
  @media (min-width: 768px) { .svc-hero { margin-bottom: 16px; } }
  @media (min-width: 1100px) { .svc-hero { gap: 14px; margin-bottom: 18px; } }
  .svc-title { font-size: 20px; line-height: 22px; font-weight: 800; color: #202124; margin: 0; }
  @media (min-width: 1100px) { .svc-title { font-size: 22px; } }
  .svc-subtitle { font-size: 13px; color: #5f6368; margin: 0; }

  /* Segmented */
  .svc-segmented {
    display: flex; width: 100%; background: #f1f3f4; border-radius: 12px;
    padding: 4px; gap: 4px; margin-bottom: 12px; max-width: 360px;
  }
  @media (max-width: 767px) { .svc-segmented { max-width: none; } }
  @media (min-width: 768px) { .svc-segmented { margin-bottom: 14px; width: auto; } }
  @media (min-width: 1100px) { .svc-segmented { margin-bottom: 16px; } }
  .svc-seg {
    flex: 1; height: 36px; border: none; border-radius: 8px;
    background: transparent; color: #5f6368; font-size: 13px; font-weight: 600;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    gap: 6px; font-family: inherit; transition: all .15s;
  }
  .svc-seg.active { background: #fff; color: #0F9D58; font-weight: 700; box-shadow: 0 1px 2px rgba(0,0,0,.06); }

  /* Toolbar */
  .svc-toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
  @media (min-width: 768px) { .svc-toolbar { margin-bottom: 14px; } }
  @media (min-width: 1100px) { .svc-toolbar { margin-bottom: 16px; } }
  @media (max-width: 767px) { .svc-toolbar { flex-direction: column; align-items: stretch; } }
  .svc-search {
    flex: 1; display: flex; align-items: center; gap: 10px;
    height: 48px; padding: 0 12px; border-radius: 12px;
    background: #fff; border: 1px solid #e8eaed;
  }
  @media (min-width: 1100px) { .svc-search { height: 52px; } }
  .svc-search input { flex: 1; border: none; background: transparent; font-size: 14px; color: #202124; outline: none; height: 100%; font-family: inherit; }
  .svc-search input::placeholder { color: #9aa0a6; }
  .svc-search-clear {
    width: 44px; height: 44px; border: none; background: transparent; color: #9aa0a6;
    display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
  }
  .svc-city {
    height: 44px; min-width: 160px; border-radius: 12px; border: 1px solid #e8eaed;
    background: #fff; padding: 0 12px; font-size: 13px; color: #5f6368; font-weight: 600;
    font-family: inherit; cursor: pointer;
  }
  @media (max-width: 767px) { .svc-city { width: 100%; min-width: 0; } }

  /* Chips */
  .svc-chips-wrap { position: relative; margin-bottom: 16px; }
  @media (min-width: 768px) { .svc-chips-wrap { margin-bottom: 20px; } }
  @media (min-width: 1100px) { .svc-chips-wrap { margin-bottom: 24px; } }
  .svc-chips { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
  .svc-chips::-webkit-scrollbar { display: none; }
  .svc-chip {
    height: 36px; padding: 0 14px; border-radius: 999px; border: 1px solid #e8eaed;
    background: #fff; color: #5f6368; font-size: 13px; font-weight: 600;
    display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
    flex-shrink: 0; cursor: pointer; font-family: inherit; transition: all .15s;
  }
  .svc-chip.active { background: #0F9D58; border-color: #0F9D58; color: #fff; }
  .svc-chip-count { font-size: 11px; font-weight: 700; opacity: .85; }
  .svc-chips-fade { position: absolute; top: 0; right: 0; bottom: 0; width: 40px; pointer-events: none; background: linear-gradient(to right, transparent, #f4f6f5); }

  /* Grid */
  .svc-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  @media (min-width: 768px) { .svc-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; } }
  @media (min-width: 1100px) { .svc-grid { grid-template-columns: repeat(4, 1fr); gap: 20px; } }

  /* Card */
  .svc-card {
    background: #fff; border: 1px solid #e8eaed; border-radius: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,.04); overflow: visible;
    transition: transform .2s ease, box-shadow .2s ease;
    display: flex; flex-direction: column; text-align: left;
    font-family: inherit; cursor: pointer; animation: svc-fadeUp .4s ease both;
    padding: 0;
  }
  .svc-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.08); }
  .svc-card:active { transform: translateY(0); }
  .svc-card-img {
    position: relative; width: 100%; aspect-ratio: 16 / 10; overflow: hidden;
    border-radius: 16px 16px 0 0; background: linear-gradient(135deg, #e6f6ed, #f8f9fa);
    display: flex; align-items: center; justify-content: center;
  }
  .svc-card-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .svc-card-icon { color: #0F9D58; opacity: .7; }
  .svc-cat-pill {
    position: absolute; bottom: 8px; left: 8px;
    background: rgba(255,255,255,.85); color: #0F9D58;
    font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 999px;
    backdrop-filter: blur(4px); max-width: calc(100% - 16px);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .svc-card-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .svc-card-title { font-size: 15px; font-weight: 700; color: #202124; line-height: 1.3; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .svc-provider { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .svc-avatar {
    width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 800; color: #fff; overflow: hidden;
    background: #0F9D58;
  }
  .svc-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .svc-provider-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .svc-provider-name { font-size: 12px; color: #5f6368; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .svc-verified { color: #1A73E8; display: inline-flex; align-items: center; }
  .svc-location { font-size: 12px; color: #80868b; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .svc-location svg { flex-shrink: 0; }
  .svc-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  @media (max-width: 767px) { .svc-card-footer { flex-direction: column; align-items: stretch; } }
  .svc-price { font-size: 15px; font-weight: 700; color: #202124; }
  .svc-price-unit { font-size: 12px; color: #80868b; margin-left: 2px; font-weight: 500; }
  .svc-book-btn {
    height: 34px; padding: 0 14px; border: none; border-radius: 10px;
    background: #0F9D58; color: #fff; font-size: 13px; font-weight: 700;
    cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
    gap: 4px; flex-shrink: 0; font-family: inherit;
  }
  @media (max-width: 767px) { .svc-book-btn { width: 100%; } }

  /* Empty */
  .svc-empty { text-align: center; padding: 48px 24px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .svc-empty-icon { color: #9aa0a6; margin-bottom: 4px; }
  .svc-empty-title { font-size: 16px; font-weight: 700; color: #202124; }
  .svc-empty-sub { font-size: 13px; color: #5f6368; }
  .svc-clear-btn {
    height: 40px; padding: 0 16px; border: 1.5px solid #0F9D58; background: transparent;
    color: #0F9D58; border-radius: 10px; font-size: 13px; font-weight: 700;
    cursor: pointer; margin-top: 8px; font-family: inherit;
  }

  /* Mine actions */
  .svc-card-actions { display: flex; gap: 8px; padding-top: 8px; border-top: 1px solid #e8eaed; margin-top: 4px; flex-wrap: wrap; }
  .svc-action {
    height: 32px; padding: 0 12px; border: none; border-radius: 8px;
    font-size: 12px; font-weight: 700; cursor: pointer;
    display: inline-flex; align-items: center; gap: 4px; font-family: inherit;
  }
  .svc-action:disabled { opacity: .6; cursor: not-allowed; }
  .svc-action-edit { background: #e6f6ed; color: #0F9D58; }
  .svc-action-pause { background: #fff8e6; color: #d4920a; }
  .svc-action-delete { background: #fef2f2; color: #dc2626; }

  /* Skeleton */
  .skeleton { background: linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%); background-size:400px 100%; animation: svc-shimmer 1.4s infinite; border-radius:16px; height: 260px; }

  .svc-form-wrap { max-width: 600px; margin: 20px auto; padding: 0 16px; }

  button { font-family: inherit; cursor: pointer; }
  input, select { font-family: inherit; }
`

function formatPrice(rate) {
  if (!rate) return { amount: '', unit: '' }
  const s = String(rate).trim()
  const slashIdx = s.indexOf('/')
  const amountPart = slashIdx >= 0 ? s.slice(0, slashIdx).trim() : s
  const unitPart = slashIdx >= 0 ? '/' + s.slice(slashIdx + 1).trim() : ''
  const formattedAmount = amountPart.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
  return { amount: formattedAmount, unit: unitPart }
}

function ServiceCard({ svc, delay, onClick, onBook, isMine, onEdit, onToggle, toggling, onDelete }) {
  const [imgErr, setImgErr] = useState(false)
  const profile = svc.profile
  const catUi = SERVICE_CATS.find(c => c.name === svc.category)
  const heroMedia = svc.media_urls?.[0]
  const rawTitle = svc.title || svc.name
  const providerName = profile?.shop_name || profile?.full_name
  const title = rawTitle || providerName || 'Service'
  const showProvider = !!rawTitle && !!providerName
  const avatarUrl = profile?.avatar_url
  const avatarName = providerName || title
  const avatarInitials = initials(avatarName)
  const avatarBg = avatarColor(avatarName)
  const verified = svc.verified || profile?.verified
  const districtLabel = profile?.district || svc.city || 'Malawi'
  const price = formatPrice(svc.rate)

  function handleBook(e) {
    e.stopPropagation()
    if (onBook) onBook(e)
  }

  return (
    <button type="button" className="svc-card" style={{ animationDelay: `${delay}s` }} onClick={onClick}>
      <div className="svc-card-img">
        {heroMedia && !imgErr ? (
          <img src={heroMedia} alt="" loading="lazy" onError={() => setImgErr(true)} />
        ) : (
          <div className="svc-card-icon">
            {catUi ? <catUi.icon size={32} strokeWidth={1.8} /> : <Wrench size={32} strokeWidth={2} />}
          </div>
        )}
        {svc.category && <span className="svc-cat-pill">{svc.category}</span>}
      </div>
      <div className="svc-card-body">
        <h3 className="svc-card-title">{title}</h3>
        {showProvider && (
          <div className="svc-provider">
            <div className="svc-avatar" style={{ background: avatarUrl ? 'transparent' : avatarBg }}>
              {avatarUrl ? <img src={avatarUrl} alt="" /> : avatarInitials}
            </div>
            <div className="svc-provider-info">
              <span className="svc-provider-name">
                {providerName}
                {verified && <span className="svc-verified"><BadgeCheck size={12} strokeWidth={2.5} /></span>}
              </span>
              <span className="svc-location"><MapPin size={12} strokeWidth={2.2} /> {districtLabel}</span>
            </div>
          </div>
        )}
        <div className="svc-card-footer">
          <div className="svc-price">
            {price.amount}
            {price.unit && <span className="svc-price-unit">{price.unit}</span>}
          </div>
          {!isMine && (
            <button type="button" className="svc-book-btn" onClick={handleBook}>Book now</button>
          )}
        </div>
        {isMine && (
          <div className="svc-card-actions">
            <button type="button" className="svc-action svc-action-edit" onClick={(e) => { e.stopPropagation(); onEdit?.() }}>
              <Pencil size={12} /> Edit
            </button>
            <button type="button" className="svc-action svc-action-pause" onClick={(e) => { e.stopPropagation(); onToggle?.() }} disabled={toggling}>
              {toggling ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : (svc.status === 'active' ? <Pause size={12} /> : <Play size={12} />)}
              {svc.status === 'active' ? 'Pause' : 'Activate'}
            </button>
            <button type="button" className="svc-action svc-action-delete" onClick={(e) => { e.stopPropagation(); onDelete?.() }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>
    </button>
  )
}

export default function Services() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'browse')
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [navUser, setNavUser] = useState(null)
  const [notifCount, setNotifCount] = useState(0)
  const [navSearch, setNavSearch] = useState('')
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [editingService, setEditingService] = useState(null)
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState('')
  const [activeCity, setActiveCity] = useState('All')
  const [togglingId, setTogglingId] = useState(null)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    if (user) {
      const [{ data: profile }, { data: shop }, { count }] = await Promise.all([
        supabase.from('profiles').select('full_name, avatar_url, account_type').eq('id', user.id).maybeSingle(),
        supabase.from('shops').select('slug').eq('owner_id', user.id).maybeSingle(),
        supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
      ])
      setNavUser({
        ...user,
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
        account_type: profile?.account_type,
        shop_slug: shop?.slug || null,
      })
      setNotifCount(count || 0)
    }
    await loadServices()
  }

  async function loadServices() {
    setLoading(true)
    const { data } = await supabase
      .from('services').select('*').eq('status', 'active').order('created_at', { ascending: false })
    const list = data || []

    const providerIds = [...new Set(list.map(s => s.provider_id).filter(Boolean))]
    const profileMap = {}
    if (providerIds.length) {
      const { data: profiles, error: profErr } = await supabase
        .from('profiles').select('id, full_name, avatar_url, account_type, district')
        .in('id', providerIds)
      let rows = profiles
      if (profErr && /district|column/i.test(profErr.message || '')) {
        const { data: fallback } = await supabase
          .from('profiles').select('id, full_name, avatar_url, account_type')
          .in('id', providerIds)
        rows = fallback
      }
      const shopAccountIds = (rows || [])
        .filter(p => p.account_type === 'shop')
        .map(p => p.id)
      const shopMap = {}
      if (shopAccountIds.length) {
        const { data: shops } = await supabase
          .from('shops')
          .select('owner_id, name')
          .in('owner_id', shopAccountIds)
        ;(shops || []).forEach(s => { shopMap[s.owner_id] = shopMap[s.owner_id] || s.name })
      }
      ;(rows || []).forEach(p => { profileMap[p.id] = { ...p, shop_name: shopMap[p.id] || null } })
    }

    setServices(list.map(s => ({
      ...s,
      profile: profileMap[s.provider_id] || null,
    })))
    setLoading(false)
  }

  let filtered = services.filter(s => {
    if (activeCat && s.category !== activeCat) return false
    if (activeCity !== 'All' && s.city !== activeCity) return false
    if (search) {
      const q = search.toLowerCase()
      const hit = (s.name || '').toLowerCase().includes(q)
        || (s.description || '').toLowerCase().includes(q)
        || (s.category || '').toLowerCase().includes(q)
        || (s.skills || []).some(sk => sk.toLowerCase().includes(q))
        || (s.tags || []).some(t => t.toLowerCase().includes(q))
      if (!hit) return false
    }
    return true
  })

  const catCounts = {}
  services.forEach(s => { catCounts[s.category] = (catCounts[s.category] || 0) + 1 })
  const cityCounts = {}
  services.forEach(s => { if (s.city) cityCounts[s.city] = (cityCounts[s.city] || 0) + 1 })
  const myServices = services.filter(s => s.provider_id === currentUser?.id)

  const n = filtered.length

  return (
    <div className="soko-services">
      <style>{css}</style>

      <SokoNav
        user={navUser}
        notifCount={notifCount}
        search={navSearch}
        setSearch={setNavSearch}
        navigate={navigate}
        activePillar="services"
        ctaLabel="List service"
        onCta={() => { setEditingService(null); setTab('post') }}
      />

      <div className="svc-page">
        <div className="svc-hero">
          <h1 className="svc-title">Find Trusted Services</h1>
          <p className="svc-subtitle">Book skilled providers across Malawi</p>
        </div>

        {tab === 'browse' && (
          <>
            <div className="svc-toolbar">
              <div className="svc-search">
                <Search size={16} strokeWidth={2.2} style={{ color: '#9aa0a6', flexShrink: 0 }} />
                <input
                  placeholder="What do you need? e.g. plumber, tutor, photographer"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoComplete="off"
                />
                {search && (
                  <button type="button" className="svc-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                    <X size={16} strokeWidth={2.5} />
                  </button>
                )}
              </div>
              <select className="svc-city" value={activeCity} onChange={e => setActiveCity(e.target.value)}>
                {CITIES.filter(c => c === 'All' || cityCounts[c] > 0 || c === activeCity).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {(tab === 'browse' || tab === 'mine') && (
              <div className="svc-segmented">
                <button type="button" className={`svc-seg${tab === 'browse' ? ' active' : ''}`} onClick={() => setTab('browse')}>
                  All Services
                </button>
                <button type="button" className={`svc-seg${tab === 'mine' ? ' active' : ''}`} onClick={() => setTab('mine')}>
                  My Services ({myServices.length})
                </button>
              </div>
            )}

              <div className="svc-chips-wrap">
              <div className="svc-chips">
                <button type="button" className={`svc-chip${activeCat === '' ? ' active' : ''}`} onClick={() => setActiveCat('')}>
                  All <span className="svc-chip-count">{services.length}</span>
                </button>
                {SERVICE_CATS.filter(c => catCounts[c.name]).map(c => {
                  const Icon = c.icon
                  return (
                    <button type="button" key={c.name} className={`svc-chip${activeCat === c.name ? ' active' : ''}`} onClick={() => setActiveCat(c.name)}>
                      <Icon size={14} strokeWidth={2.2} />
                      {c.name}
                      <span className="svc-chip-count">{catCounts[c.name]}</span>
                    </button>
                  )
                })}
              </div>
              <div className="svc-chips-fade" />
            </div>

            {loading && (
              <div className="svc-grid">
                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton" />)}
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="svc-empty">
                <div className="svc-empty-icon"><Search size={32} strokeWidth={1.5} /></div>
                <p className="svc-empty-title">No services found</p>
                <p className="svc-empty-sub">Try another category or city</p>
                <button type="button" className="svc-clear-btn" onClick={() => { setActiveCat(''); setActiveCity('All'); setSearch('') }}>
                  Clear filters
                </button>
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <div className="svc-grid">
                {filtered.map((svc, i) => (
                  <ServiceCard
                    key={svc.id}
                    svc={svc}
                    delay={i * 0.03}
                    onClick={() => setSelectedProvider(svc)}
                    onBook={() => {
                      if (currentUser) navigate(`/chat/${svc.provider_id}/${svc.id}?src=service`, { state: { source: 'service' } })
                    }}
                    isMine={false}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {tab === 'post' && (
          <div className="svc-form-wrap">
            <ServiceForm
              editingService={editingService}
              onSuccess={() => { loadServices(); setTab('mine'); setEditingService(null) }}
              onCancel={() => { setEditingService(null); setTab('mine') }}
            />
          </div>
        )}

        {tab === 'mine' && (
          <>
            <div className="svc-segmented">
              <button type="button" className={`svc-seg${tab === 'browse' ? ' active' : ''}`} onClick={() => setTab('browse')}>
                All Services
              </button>
              <button type="button" className={`svc-seg${tab === 'mine' ? ' active' : ''}`} onClick={() => setTab('mine')}>
                My Services ({myServices.length})
              </button>
            </div>
            {myServices.length === 0 ? (
              <div className="svc-empty">
                <div className="svc-empty-icon"><Wrench size={32} strokeWidth={1.5} /></div>
                <p className="svc-empty-title">No services found</p>
                <p className="svc-empty-sub">Try another category or city</p>
                <button type="button" className="svc-clear-btn" onClick={() => { setEditingService(null); setTab('post') }}>
                  List Service
                </button>
              </div>
            ) : (
              <div className="svc-grid">
                {myServices.map((svc, i) => (
                  <ServiceCard
                    key={svc.id}
                    svc={svc}
                    delay={i * 0.03}
                    onClick={() => setSelectedProvider(svc)}
                    isMine={true}
                    onEdit={() => { setEditingService(svc); setTab('post') }}
                    onToggle={async () => {
                      setTogglingId(svc.id)
                      const ns = svc.status === 'active' ? 'paused' : 'active'
                      await supabase.from('services').update({ status: ns }).eq('id', svc.id)
                      setTogglingId(null)
                      loadServices()
                    }}
                    toggling={togglingId === svc.id}
                    onDelete={async () => {
                      await supabase.from('services').delete().eq('id', svc.id)
                      loadServices()
                    }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {selectedProvider && (
        <ProviderModal provider={selectedProvider} currentUser={currentUser} onClose={() => setSelectedProvider(null)} />
      )}
    </div>
  )
}
