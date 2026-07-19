import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SERVICE_CATS, CITIES, SORT_OPTIONS, avatarColor, initials, renderStars, formatWhatsApp } from './serviceData'
import ServiceForm from './ServiceForm'
import ProviderModal from './ProviderModal'
import MyListings from './MyListings'
import SokoNav from '../components/SokoNav'

/* Soko marketplace tokens — match Home / Search / Shops */
const G = {
  green:     '#0F9D58',
  greenDark: '#0a7a44',
  greenLight:'#e8f5ee',
  greenMid:  '#c6e8d4',
  orange:    '#F9AB00',
  bg:        '#f8f9fa',
  card:      '#ffffff',
  text:      '#202124',
  textMid:   '#5f6368',
  textSoft:  '#9aa0a6',
  border:    '#e8eaed',
  borderMid: '#e8eaed',
  gray100:   '#f1f3f4',
  gray900:   '#202124',
  radius:    '14px',
  radiusSm:  '11px',
  shadow:    '0 1px 3px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.04)',
}

const CAT_PALETTES = {
  Plumbing:   { bg:'#e8f5ee', icon:'#0F9D58' },
  Tutoring:   { bg:'#e8f0fb', icon:'#185fa5' },
  Design:     { bg:'#faeeda', icon:'#854f0b' },
  Catering:   { bg:'#fbeaf0', icon:'#993556' },
  Electrical: { bg:'#eaf3de', icon:'#3b6d11' },
  Transport:  { bg:'#f1eefd', icon:'#534ab7' },
  Cleaning:   { bg:'#e1f5ee', icon:'#0f6e56' },
  default:    { bg:'#f1f3f4', icon:'#5f6368' },
}
function catPalette(cat) { return CAT_PALETTES[cat] || CAT_PALETTES.default }

const css = `
  * { box-sizing: border-box; margin:0; padding:0; }
  .soko-services {
    font-family: Inter, 'DM Sans', system-ui, sans-serif;
    background: ${G.bg};
    min-height: 100vh; min-height: 100dvh;
    color: ${G.text};
    -webkit-tap-highlight-color: transparent;
    padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
  }
  @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
  @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
  .svc-card { animation: fadeUp .3s ease both; cursor: pointer; }
  .card-inner {
    transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
    box-shadow: ${G.shadow};
  }
  .svc-card:hover .card-inner { box-shadow: 0 8px 24px rgba(0,0,0,.1); transform: translateY(-2px); }
  @media (hover: none) {
    .svc-card:hover .card-inner { transform: none; box-shadow: ${G.shadow}; }
  }
  .svc-card:active .card-inner { transform: scale(0.98); }
  .skeleton {
    background: linear-gradient(90deg,#f1f3f4 25%,#e8eaed 50%,#f1f3f4 75%);
    background-size:400px 100%; animation: shimmer 1.4s infinite; border-radius:${G.radius};
  }
  .filter-drawer { animation: slideDown .2s ease both; }
  .svc-subhead {
    background: ${G.card};
    border-bottom: 1px solid ${G.border};
    position: sticky; top: 0; z-index: 40;
    box-shadow: 0 1px 0 rgba(0,0,0,.04);
  }
  .svc-subhead-inner { max-width: 1180px; margin: 0 auto; }
  .svc-title-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 20px 10px; gap: 12px;
  }
  .svc-title {
    font-family: Sora, Inter, sans-serif;
    font-size: clamp(20px, 3vw, 26px); font-weight: 800;
    letter-spacing: -0.5px; color: ${G.text}; margin: 0;
  }
  .svc-sub { font-size: 13px; color: ${G.textMid}; margin-top: 3px; font-weight: 500; }
  .svc-cta {
    background: ${G.gray900}; color: #fff; border: none; border-radius: 12px;
    padding: 11px 16px; font-size: 13.5px; font-weight: 700; font-family: inherit;
    min-height: 44px; cursor: pointer; flex-shrink: 0; touch-action: manipulation;
  }
  .svc-cta:hover { background: #000; }
  .svc-search-row {
    display: flex; gap: 8px; align-items: center; padding: 0 20px 12px;
  }
  .svc-search-box {
    flex: 1; display: flex; align-items: center; gap: 8px;
    background: ${G.bg}; border: 1.5px solid ${G.border}; border-radius: 12px;
    padding: 0 12px; min-height: 44px; box-shadow: ${G.shadow};
  }
  .svc-search-box:focus-within {
    border-color: ${G.green}; box-shadow: 0 0 0 3px rgba(15,157,88,.12);
  }
  .svc-search-box input {
    flex: 1; border: none; background: transparent; font-size: 16px;
    color: ${G.text}; font-family: inherit; outline: none; min-height: 42px;
  }
  .svc-filter-btn {
    position: relative; padding: 0 14px; min-height: 44px;
    border: 1.5px solid ${G.border}; border-radius: 12px;
    background: ${G.card}; color: ${G.textMid}; font-size: 13px; font-weight: 700;
    display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
    flex-shrink: 0; font-family: inherit; cursor: pointer; box-shadow: ${G.shadow};
  }
  .svc-filter-btn.active {
    border-color: ${G.gray900}; background: ${G.gray100}; color: ${G.gray900};
  }
  .svc-chip-row {
    display: flex; gap: 6px; overflow-x: auto; flex: 1;
    padding: 8px 0 10px 12px; scrollbar-width: none;
  }
  .svc-chip-row::-webkit-scrollbar { display: none; }
  .svc-chip {
    padding: 7px 13px; border-radius: 999px; border: 1.5px solid ${G.border};
    background: #fff; color: ${G.textMid}; font-size: 12.5px; font-weight: 600;
    white-space: nowrap; flex-shrink: 0; font-family: inherit; cursor: pointer;
  }
  .svc-chip.active {
    background: ${G.gray900}; border-color: ${G.gray900}; color: #fff;
  }
  .svc-body {
    max-width: 1180px; margin: 0 auto; padding: 12px 16px 24px;
  }
  .svc-grid {
    display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px;
  }
  @media (min-width: 900px) {
    .svc-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px; }
  }
  @media (min-width: 1100px) {
    .svc-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
  }
  button { font-family: inherit; cursor: pointer; }
  input { font-family: inherit; }
`

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
  const [sortBy, setSortBy] = useState('newest')
  const [filterOpen, setFilterOpen] = useState(false)

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
    setServices(data || [])
    setLoading(false)
  }

  let filtered = services.filter(s => {
    if (activeCat && s.category !== activeCat) return false
    if (activeCity !== 'All' && s.city !== activeCity) return false
    if (search) {
      const q = search.toLowerCase()
      const hit = (s.name||'').toLowerCase().includes(q)
        || (s.description||'').toLowerCase().includes(q)
        || (s.category||'').toLowerCase().includes(q)
        || (s.skills||[]).some(sk => sk.toLowerCase().includes(q))
        || (s.tags||[]).some(t => t.toLowerCase().includes(q))
      if (!hit) return false
    }
    return true
  })
  if (sortBy==='rating')   filtered = [...filtered].sort((a,b) => (b.rating||0)-(a.rating||0))
  if (sortBy==='views')    filtered = [...filtered].sort((a,b) => (b.views||0)-(a.views||0))
  if (sortBy==='verified') filtered = [...filtered].sort((a,b) => (b.verified?1:0)-(a.verified?1:0))

  const catCounts = {}
  services.forEach(s => { catCounts[s.category] = (catCounts[s.category]||0)+1 })
  const myServices = services.filter(s => s.provider_id === currentUser?.id)

  const activeFiltersCount = [activeCat?1:0, activeCity!=='All'?1:0, sortBy!=='newest'?1:0].reduce((a,b)=>a+b,0)

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

      {/* ── Sub-header ── */}
      <div className="svc-subhead">
        <div className="svc-subhead-inner">
          <div className="svc-title-row">
            <div style={{ minWidth: 0 }}>
              <h1 className="svc-title">Services</h1>
              <p className="svc-sub">
                {loading ? 'Loading…' : `${services.length} provider${services.length !== 1 ? 's' : ''} across Malawi`}
              </p>
            </div>
            <button
              type="button"
              className="svc-cta"
              onClick={() => setTab(tab === 'post' ? 'browse' : 'post')}
            >
              {tab === 'post' ? '← Back' : '+ List service'}
            </button>
          </div>

          {tab === 'browse' && (
            <div className="svc-search-row">
              <div className="svc-search-box">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={G.textSoft} strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  placeholder="Search services…"
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  enterKeyHint="search"
                  autoComplete="off"
                />
                {search && (
                  <button type="button" onClick={() => setSearch('')} style={{ border: 'none', background: 'none', color: G.textSoft, fontSize: 13, padding: 0 }} aria-label="Clear">✕</button>
                )}
              </div>
              <button
                type="button"
                className={`svc-filter-btn${filterOpen || activeFiltersCount > 0 ? ' active' : ''}`}
                onClick={() => setFilterOpen(o => !o)}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
                </svg>
                Filter
                {activeFiltersCount > 0 && (
                  <span style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, background: G.gray900, color: '#fff', borderRadius: '50%', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {activeFiltersCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {tab === 'browse' && filterOpen && (
            <div className="filter-drawer" style={{ borderTop: `1px solid ${G.border}`, background: G.card, padding: '12px 20px 14px' }}>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: G.textSoft, fontWeight: 700, marginBottom: 7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Category</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <button type="button" className={`svc-chip${activeCat === '' ? ' active' : ''}`} onClick={() => setActiveCat('')}>All</button>
                  {SERVICE_CATS.filter(c => catCounts[c.name]).map(c => (
                    <button type="button" key={c.name} className={`svc-chip${activeCat === c.name ? ' active' : ''}`} onClick={() => setActiveCat(activeCat === c.name ? '' : c.name)}>
                      {c.name} <span style={{ opacity: 0.7 }}>({catCounts[c.name]})</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 10 }}>
                <div style={{ fontSize: 11, color: G.textSoft, fontWeight: 700, marginBottom: 7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>City</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {CITIES.map(c => (
                    <button type="button" key={c} className={`svc-chip${activeCity === c ? ' active' : ''}`} onClick={() => setActiveCity(c)}>{c}</button>
                  ))}
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: G.textSoft, fontWeight: 700, marginBottom: 7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Sort by</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {SORT_OPTIONS.map(o => (
                    <button type="button" key={o.value} className={`svc-chip${sortBy === o.value ? ' active' : ''}`} onClick={() => setSortBy(o.value)}
                      style={sortBy === o.value ? { background: '#fff8e1', borderColor: G.orange, color: '#c88a00' } : undefined}
                    >{o.label}</button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" onClick={() => { setActiveCat(''); setActiveCity('All'); setSortBy('newest') }}
                  style={{ flex: 1, padding: 11, border: `1.5px solid ${G.border}`, borderRadius: G.radiusSm, background: '#fff', color: G.textMid, fontSize: 13, fontWeight: 600, minHeight: 44 }}
                >Clear all</button>
                <button type="button" onClick={() => setFilterOpen(false)}
                  style={{ flex: 2, padding: 11, border: 'none', borderRadius: G.radiusSm, background: G.gray900, color: '#fff', fontSize: 13, fontWeight: 700, minHeight: 44 }}
                >Show {filtered.length} result{filtered.length !== 1 ? 's' : ''}</button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', alignItems: 'center', borderTop: `1px solid ${G.border}`, gap: 0 }}>
            <div className="svc-chip-row">
              <button type="button" className={`svc-chip${activeCat === '' && tab === 'browse' ? ' active' : ''}`} onClick={() => { setActiveCat(''); setTab('browse') }}>All</button>
              {SERVICE_CATS.filter(c => catCounts[c.name]).map(c => (
                <button type="button" key={c.name} className={`svc-chip${activeCat === c.name ? ' active' : ''}`}
                  onClick={() => { setActiveCat(activeCat === c.name ? '' : c.name); setTab('browse') }}
                >{c.name}</button>
              ))}
            </div>
            <div style={{ flexShrink: 0, padding: '0 12px', borderLeft: `1px solid ${G.border}` }}>
              <button type="button" onClick={() => setTab('mine')}
                style={{ background: tab === 'mine' ? G.gray900 : G.gray100, color: tab === 'mine' ? '#fff' : G.gray900, border: `1.5px solid ${G.border}`, borderRadius: 999, padding: '7px 14px', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap', cursor: 'pointer', fontFamily: 'inherit' }}
              >
                My Services {myServices.length > 0 && `(${myServices.length})`}
              </button>
            </div>
          </div>

          {tab === 'mine' && (
            <div style={{ display: 'flex', borderTop: `1px solid ${G.border}` }}>
              <button type="button" onClick={() => setTab('browse')}
                style={{ flex: 1, padding: 10, border: 'none', background: 'transparent', color: G.textSoft, fontSize: 13, fontWeight: 600 }}
              >← Back to browse</button>
              <span style={{ display: 'flex', alignItems: 'center', padding: '0 16px', fontSize: 12, color: G.textMid, fontWeight: 600 }}>
                My listings
                {myServices.length > 0 && (
                  <span style={{ marginLeft: 5, background: G.gray900, color: '#fff', borderRadius: 10, fontSize: 9, padding: '1px 6px', fontWeight: 700 }}>{myServices.length}</span>
                )}
              </span>
            </div>
          )}
        </div>
      </div>

      {tab === 'browse' && (
        <div className="svc-body">
          {activeFiltersCount > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, flexWrap: 'wrap' }}>
              {activeCat && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: G.gray100, color: G.gray900, borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                  {activeCat}
                  <button type="button" onClick={() => setActiveCat('')} style={{ border: 'none', background: 'none', color: G.gray900, fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              )}
              {activeCity !== 'All' && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: G.gray100, color: G.gray900, borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                  📍 {activeCity}
                  <button type="button" onClick={() => setActiveCity('All')} style={{ border: 'none', background: 'none', color: G.gray900, fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              )}
              {sortBy !== 'newest' && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px 10px', background: '#fff8e1', color: '#c88a00', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>
                  {SORT_OPTIONS.find(o => o.value === sortBy)?.label}
                  <button type="button" onClick={() => setSortBy('newest')} style={{ border: 'none', background: 'none', color: '#c88a00', fontSize: 12, padding: 0, lineHeight: 1 }}>✕</button>
                </span>
              )}
              <span style={{ fontSize: 11, color: G.textSoft, marginLeft: 'auto' }}>{filtered.length} result{filtered.length !== 1 ? 's' : ''}</span>
            </div>
          )}

          {loading && (
            <div className="svc-grid">
              {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton" style={{ height: 210 }} />)}
            </div>
          )}

          {!loading && filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '52px 24px', background: G.card, border: `1px solid ${G.border}`, borderRadius: 16, boxShadow: G.shadow }}>
              <div style={{ fontSize: 44, marginBottom: 12 }}>🔍</div>
              <p style={{ fontSize: 16, fontWeight: 800, color: G.text, marginBottom: 6 }}>No providers found</p>
              <p style={{ fontSize: 13.5, color: G.textSoft, marginBottom: 20 }}>
                {search || activeCat ? 'Try adjusting your filters' : 'Be the first to list your service!'}
              </p>
              <button type="button" onClick={() => setTab('post')}
                style={{ background: G.gray900, color: '#fff', border: 'none', borderRadius: 12, padding: '12px 22px', fontSize: 13.5, fontWeight: 700, minHeight: 44 }}
              >+ List a service</button>
            </div>
          )}

          {!loading && filtered.length > 0 && (
            <div className="svc-grid">
              {filtered.map((svc, i) => (
                <ProviderCard key={svc.id} svc={svc} delay={i * 0.03} currentUser={currentUser} onClick={() => setSelectedProvider(svc)} navigate={navigate} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab==='post' && (
        <ServiceForm editingService={editingService}
          onSuccess={()=>{loadServices();setTab('mine');setEditingService(null)}}
          onCancel={()=>{setEditingService(null);setTab('mine')}}
        />
      )}

      {tab==='mine' && (
        <MyListings myServices={myServices}
          onEdit={svc=>{setEditingService(svc);setTab('post')}}
          onRefresh={loadServices}
          onPostNew={()=>{setEditingService(null);setTab('post')}}
        />
      )}

      {selectedProvider && (
        <ProviderModal provider={selectedProvider} currentUser={currentUser} onClose={()=>setSelectedProvider(null)} />
      )}
    </div>
  )
}

function ProviderCard({ svc, delay, currentUser, onClick, navigate }) {
  const heroMedia = svc.media_urls?.[0]
  const pal = catPalette(svc.category)
  const catMeta = SERVICE_CATS.find(c=>c.name===svc.category)

  function goChat(e) {
    e.stopPropagation()
    if (currentUser) {
      navigate(`/chat/${svc.provider_id}/${svc.id}?src=service`, {
        state: { source: 'service' },
      })
    }
  }
  function doCall(e) { e.stopPropagation(); if(svc.contact) window.location.href=`tel:${svc.contact}` }
  function doWhatsApp(e) { e.stopPropagation(); window.open(formatWhatsApp(svc.contact,svc.name,svc.category),'_blank') }

  return (
    <div className="svc-card" style={{ animationDelay: `${delay}s` }} onClick={onClick}>
      <div className="card-inner" style={{ background: G.card, border: `1px solid ${G.border}`, borderRadius: G.radius, overflow: 'hidden' }}>
        <div style={{ position: 'relative', height: 100, background: pal.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {heroMedia ? (
            heroMedia.match(/\.(mp4|mov|webm)$/i)
              ? <video src={heroMedia} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} muted loop playsInline />
              : <img src={heroMedia} alt={svc.name} style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0 }} loading="lazy" />
          ) : (
            <span style={{ fontSize: 34, lineHeight: 1 }}>{catMeta?.icon || '🔧'}</span>
          )}
          <span style={{ position: 'absolute', top: 6, left: 6, background: 'rgba(255,255,255,0.95)', color: pal.icon, fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 8 }}>
            {svc.category}
          </span>
          {svc.verified && (
            <span style={{ position: 'absolute', top: 6, right: 6, width: 18, height: 18, background: G.gray900, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, color: '#fff', fontWeight: 700 }}>✓</span>
          )}
          {svc.rate && (
            <span style={{ position: 'absolute', bottom: 6, right: 6, background: G.green, color: '#fff', fontSize: 10, fontWeight: 800, padding: '3px 7px', borderRadius: 8 }}>
              {svc.rate}
            </span>
          )}
          {svc.available && (
            <span style={{ position: 'absolute', bottom: 6, left: 6, background: 'rgba(255,255,255,0.95)', color: G.green, fontSize: 9, fontWeight: 700, padding: '3px 7px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: G.green, display: 'inline-block' }} />
              {svc.available}
            </span>
          )}
        </div>

        <div style={{ padding: '10px 10px 9px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
            <div style={{ width: 24, height: 24, borderRadius: '50%', background: avatarColor(svc.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
              {initials(svc.name)}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: G.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{svc.name}</div>
              {svc.city && <div style={{ fontSize: 10, color: G.textSoft }}>📍 {svc.city}</div>}
            </div>
          </div>

          <div style={{ fontSize: 11.5, color: G.textMid, lineHeight: 1.4, marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {svc.description?.slice(0, 72) || svc.name}
          </div>

          {svc.rating > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginBottom: 5 }}>
              <span style={{ color: G.orange, fontSize: 10 }}>{renderStars(svc.rating)}</span>
              <span style={{ fontSize: 9, color: G.textSoft }}>{svc.rating} ({svc.jobs_done || 0})</span>
            </div>
          )}

          {(svc.skills||[]).length>0 && (
            <div style={{ display:'flex', gap:'3px', marginBottom:'6px', flexWrap:'wrap' }}>
              {(svc.skills||[]).slice(0,2).map(sk=>(
                <span key={sk} style={{ fontSize:'9px', background:G.bg, color:G.textMid, padding:'2px 5px', borderRadius:'5px', border:`1px solid ${G.border}` }}>{sk}</span>
              ))}
            </div>
          )}

          <div style={{ display:'flex', gap:'4px' }}>
            <button onClick={doCall}
              style={{ flex:1, padding:'6px 0', background:G.green, color:'#fff', border:'none', borderRadius:G.radiusSm, fontSize:'11px', fontWeight:600 }}
            >📞 Call</button>
            {currentUser && (
              <button onClick={goChat}
                style={{ width:'28px', border:`1px solid ${G.border}`, borderRadius:G.radiusSm, background:G.card, color:G.textMid, fontSize:'13px', display:'flex', alignItems:'center', justifyContent:'center' }}
              >💬</button>
            )}
            <button onClick={doWhatsApp}
              style={{ width:'28px', border:`1px solid #25d36622`, borderRadius:G.radiusSm, background:'#f0fdf4', color:'#25d366', fontSize:'12px', display:'flex', alignItems:'center', justifyContent:'center' }}
            >
              <svg viewBox="0 0 24 24" width="13" height="13" fill="#25d366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.126 1.532 5.86L.057 23.776a.5.5 0 0 0 .624.603l6.044-1.58A11.945 11.945 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.806 9.806 0 0 1-5.122-1.442l-.368-.217-3.813.998 1.016-3.706-.24-.38A9.786 9.786 0 0 1 2.182 12c0-5.421 4.397-9.818 9.818-9.818S21.818 6.579 21.818 12 17.421 21.818 12 21.818z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}