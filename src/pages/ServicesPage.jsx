import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SERVICE_CATS, CITIES, SORT_OPTIONS, avatarColor, initials, renderStars, formatWhatsApp } from './serviceData'
import ServiceForm from './ServiceForm'
import ProviderModal from './ProviderModal'
import MyListings from './MyListings'

const G = {
  green:     '#1a7a4a',
  greenDark: '#155f39',
  greenLight:'#e8f5ee',
  greenMid:  '#c6e8d4',
  orange:    '#f5a623',
  bg:        '#f5f7f5',
  card:      '#ffffff',
  text:      '#1a2e22',
  textMid:   '#4a6555',
  textSoft:  '#8fa99a',
  border:    'rgba(26,122,74,0.10)',
  borderMid: 'rgba(26,122,74,0.20)',
  radius:    '14px',
  radiusSm:  '9px',
}

const CAT_PALETTES = {
  Plumbing:   { bg:'#e8f5ee', icon:'#1a7a4a' },
  Tutoring:   { bg:'#e8f0fb', icon:'#185fa5' },
  Design:     { bg:'#faeeda', icon:'#854f0b' },
  Catering:   { bg:'#fbeaf0', icon:'#993556' },
  Electrical: { bg:'#eaf3de', icon:'#3b6d11' },
  Transport:  { bg:'#f1eefd', icon:'#534ab7' },
  Cleaning:   { bg:'#e1f5ee', icon:'#0f6e56' },
  default:    { bg:'#f1efe8', icon:'#5f5e5a' },
}
function catPalette(cat) { return CAT_PALETTES[cat] || CAT_PALETTES.default }

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500;9..40,600&display=swap');
  * { box-sizing: border-box; margin:0; padding:0; }
  .soko-services { font-family: 'DM Sans', sans-serif; background: ${G.bg}; min-height: 100vh; }
  ::-webkit-scrollbar { display: none; }
  @keyframes fadeUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
  @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
  .svc-card { animation: fadeUp .3s ease both; }
  .card-inner { transition: transform .18s ease, border-color .18s ease; }
  .svc-card:active .card-inner { transform: scale(0.97); }
  .skeleton { background: linear-gradient(90deg,#eef2ef 25%,#e0ebe3 50%,#eef2ef 75%); background-size:400px 100%; animation: shimmer 1.4s infinite; border-radius:${G.radius}; }
  .filter-drawer { animation: slideDown .2s ease both; }
  button { font-family: 'DM Sans', sans-serif; cursor: pointer; }
  input { font-family: 'DM Sans', sans-serif; }
`

export default function Services() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'browse')
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
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

      {/* ── Sticky header ── */}
      <div style={{ background: G.card, borderBottom:`1px solid ${G.border}`, position:'sticky', top:0, zIndex:50 }}>

        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 16px 8px' }}>
          <div style={{ lineHeight:1 }}>
            <span style={{ fontSize:'22px', fontWeight:700, color:'#2e7d32', letterSpacing:'-0.5px' }}>Soko</span>
            <span style={{ fontSize:'22px', fontWeight:700, color:G.orange, letterSpacing:'-0.5px' }}>Mw</span>
          </div>
          <button
            onClick={() => setTab(tab==='post' ? 'browse' : 'post')}
            style={{ background:'none', border:'none', padding:'4px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}
          >
            {tab==='post'
              ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={G.green} strokeWidth="2.5" strokeLinecap="round"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              : <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke={G.green} strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            }
          </button>
        </div>

        {tab==='browse' && (
          <div style={{ padding:'0 16px 10px', display:'flex', gap:'8px', alignItems:'center' }}>
            <div style={{ flex:1, display:'flex', alignItems:'center', gap:'8px', background:G.bg, border:`1px solid ${G.borderMid}`, borderRadius:'12px', padding:'8px 11px' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={G.textSoft} strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                style={{ flex:1, border:'none', background:'transparent', fontSize:'13px', color:G.text }}
                placeholder="Search services…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
              {search && <button onClick={()=>setSearch('')} style={{ border:'none', background:'none', color:G.textSoft, fontSize:'13px', padding:0 }}>✕</button>}
            </div>
            <button
              onClick={() => setFilterOpen(o=>!o)}
              style={{ position:'relative', padding:'8px 12px', border:`1.5px solid ${filterOpen||activeFiltersCount>0 ? G.green : G.borderMid}`, borderRadius:'12px', background: filterOpen||activeFiltersCount>0 ? G.greenLight : G.card, color: filterOpen||activeFiltersCount>0 ? G.green : G.textMid, fontSize:'13px', fontWeight:500, display:'flex', alignItems:'center', gap:'5px', whiteSpace:'nowrap', flexShrink:0 }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                <line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/>
              </svg>
              Filter
              {activeFiltersCount>0 && (
                <span style={{ position:'absolute', top:'-6px', right:'-6px', width:'16px', height:'16px', background:G.green, color:'#fff', borderRadius:'50%', fontSize:'9px', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  {activeFiltersCount}
                </span>
              )}
            </button>
          </div>
        )}

        {tab==='browse' && filterOpen && (
          <div className="filter-drawer" style={{ borderTop:`1px solid ${G.border}`, background:G.card, padding:'12px 16px 14px' }}>
            <div style={{ marginBottom:'10px' }}>
              <div style={{ fontSize:'11px', color:G.textSoft, fontWeight:600, marginBottom:'7px', letterSpacing:'0.04em', textTransform:'uppercase' }}>Category</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                <button onClick={()=>setActiveCat('')}
                  style={{ padding:'5px 11px', borderRadius:'20px', border:`1px solid ${activeCat===''?G.green:G.border}`, background:activeCat===''?G.green:'transparent', color:activeCat===''?'#fff':G.textMid, fontSize:'12px', fontWeight:activeCat===''?600:400 }}
                >All</button>
                {SERVICE_CATS.filter(c=>catCounts[c.name]).map(c=>(
                  <button key={c.name} onClick={()=>setActiveCat(activeCat===c.name?'':c.name)}
                    style={{ padding:'5px 11px', borderRadius:'20px', border:`1px solid ${activeCat===c.name?G.green:G.border}`, background:activeCat===c.name?G.green:'transparent', color:activeCat===c.name?'#fff':G.textMid, fontSize:'12px', fontWeight:activeCat===c.name?600:400 }}
                  >{c.name} <span style={{ opacity:0.7 }}>({catCounts[c.name]})</span></button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:'10px' }}>
              <div style={{ fontSize:'11px', color:G.textSoft, fontWeight:600, marginBottom:'7px', letterSpacing:'0.04em', textTransform:'uppercase' }}>City</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                {CITIES.map(c=>(
                  <button key={c} onClick={()=>setActiveCity(c)}
                    style={{ padding:'5px 11px', borderRadius:'20px', border:`1px solid ${activeCity===c?G.green:G.border}`, background:activeCity===c?G.green:'transparent', color:activeCity===c?'#fff':G.textMid, fontSize:'12px', fontWeight:activeCity===c?600:400 }}
                  >{c}</button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:'12px' }}>
              <div style={{ fontSize:'11px', color:G.textSoft, fontWeight:600, marginBottom:'7px', letterSpacing:'0.04em', textTransform:'uppercase' }}>Sort by</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
                {SORT_OPTIONS.map(o=>(
                  <button key={o.value} onClick={()=>setSortBy(o.value)}
                    style={{ padding:'5px 11px', borderRadius:'20px', border:`1px solid ${sortBy===o.value?G.orange:G.border}`, background:sortBy===o.value?'#fff8ec':'transparent', color:sortBy===o.value?G.orange:G.textMid, fontSize:'12px', fontWeight:sortBy===o.value?600:400 }}
                  >{o.label}</button>
                ))}
              </div>
            </div>
            <div style={{ display:'flex', gap:'8px' }}>
              <button onClick={()=>{setActiveCat('');setActiveCity('All');setSortBy('newest')}}
                style={{ flex:1, padding:'9px', border:`1px solid ${G.borderMid}`, borderRadius:G.radiusSm, background:'transparent', color:G.textMid, fontSize:'13px', fontWeight:500 }}
              >Clear all</button>
              <button onClick={()=>setFilterOpen(false)}
                style={{ flex:2, padding:'9px', border:'none', borderRadius:G.radiusSm, background:G.green, color:'#fff', fontSize:'13px', fontWeight:600 }}
              >Show {filtered.length} result{filtered.length!==1?'s':''}</button>
            </div>
          </div>
        )}

        <div style={{ display:'flex', alignItems:'center', borderTop:`1px solid ${G.border}`, gap:'0' }}>
          <div style={{ display:'flex', gap:'6px', overflowX:'auto', flex:1, padding:'8px 0 8px 12px', scrollbarWidth:'none' }}>
            <button
              onClick={() => setActiveCat('')}
              style={{ padding:'5px 13px', borderRadius:'20px', border:`1.5px solid ${activeCat==='' ? G.green : G.border}`, background: activeCat==='' ? G.green : 'transparent', color: activeCat==='' ? '#fff' : G.textMid, fontSize:'12px', fontWeight: activeCat===''?600:400, whiteSpace:'nowrap', flexShrink:0 }}
            >
              All
            </button>
            {SERVICE_CATS.filter(c => catCounts[c.name]).map(c => (
              <button
                key={c.name}
                onClick={() => { setActiveCat(activeCat===c.name ? '' : c.name); setTab('browse') }}
                style={{ padding:'5px 13px', borderRadius:'20px', border:`1.5px solid ${activeCat===c.name ? G.green : G.border}`, background: activeCat===c.name ? G.green : 'transparent', color: activeCat===c.name ? '#fff' : G.textMid, fontSize:'12px', fontWeight: activeCat===c.name?600:400, whiteSpace:'nowrap', flexShrink:0 }}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div style={{ flexShrink:0, padding:'0 12px', borderLeft:`1px solid ${G.border}` }}>
            <button
              onClick={() => setTab('mine')}
              style={{ background: tab==='mine' ? G.green : G.greenLight, color: tab==='mine' ? '#fff' : G.green, border:`1.5px solid ${G.greenMid}`, borderRadius:'20px', padding:'6px 14px', fontSize:'12px', fontWeight:700, whiteSpace:'nowrap', cursor:'pointer' }}
            >
              My Services {myServices.length > 0 && `(${myServices.length})`}
            </button>
          </div>
        </div>

        {tab==='mine' && (
          <div style={{ display:'flex', borderTop:`1px solid ${G.border}` }}>
            <button onClick={()=>setTab('browse')}
              style={{ flex:1, padding:'8px', border:'none', background:'transparent', color:G.textSoft, fontSize:'12px' }}
            >← Back to browse</button>
            <span style={{ display:'flex', alignItems:'center', padding:'0 16px', fontSize:'12px', color:G.textMid, fontWeight:600 }}>
              My listings
              {myServices.length>0 && (
                <span style={{ marginLeft:'5px', background:G.green, color:'#fff', borderRadius:'10px', fontSize:'9px', padding:'1px 6px', fontWeight:700 }}>{myServices.length}</span>
              )}
            </span>
          </div>
        )}
      </div>

      {tab==='browse' && (
        <div style={{ padding:'10px 12px 88px' }}>
          {activeFiltersCount>0 && (
            <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'8px', flexWrap:'wrap' }}>
              {activeCat && (
                <span style={{ display:'flex', alignItems:'center', gap:'4px', padding:'4px 10px', background:G.greenLight, color:G.green, borderRadius:'20px', fontSize:'11px', fontWeight:600 }}>
                  {activeCat}
                  <button onClick={()=>setActiveCat('')} style={{ border:'none', background:'none', color:G.green, fontSize:'12px', padding:0, lineHeight:1 }}>✕</button>
                </span>
              )}
              {activeCity!=='All' && (
                <span style={{ display:'flex', alignItems:'center', gap:'4px', padding:'4px 10px', background:G.greenLight, color:G.green, borderRadius:'20px', fontSize:'11px', fontWeight:600 }}>
                  📍 {activeCity}
                  <button onClick={()=>setActiveCity('All')} style={{ border:'none', background:'none', color:G.green, fontSize:'12px', padding:0, lineHeight:1 }}>✕</button>
                </span>
              )}
              {sortBy!=='newest' && (
                <span style={{ display:'flex', alignItems:'center', gap:'4px', padding:'4px 10px', background:'#fff8ec', color:G.orange, borderRadius:'20px', fontSize:'11px', fontWeight:600 }}>
                  {SORT_OPTIONS.find(o=>o.value===sortBy)?.label}
                  <button onClick={()=>setSortBy('newest')} style={{ border:'none', background:'none', color:G.orange, fontSize:'12px', padding:0, lineHeight:1 }}>✕</button>
                </span>
              )}
              <span style={{ fontSize:'11px', color:G.textSoft, marginLeft:'auto' }}>{filtered.length} result{filtered.length!==1?'s':''}</span>
            </div>
          )}

          {loading && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'9px' }}>
              {[1,2,3,4,5,6].map(i=><div key={i} className="skeleton" style={{ height:'210px' }}/>)}
            </div>
          )}

          {!loading && filtered.length===0 && (
            <div style={{ textAlign:'center', padding:'52px 24px' }}>
              <div style={{ fontSize:'44px', marginBottom:'12px' }}>🔍</div>
              <p style={{ fontSize:'15px', fontWeight:500, color:G.text, marginBottom:'6px' }}>No providers found</p>
              <p style={{ fontSize:'13px', color:G.textSoft, marginBottom:'20px' }}>
                {search||activeCat ? 'Try adjusting your filters' : 'Be the first to list your service!'}
              </p>
              <button onClick={()=>setTab('post')}
                style={{ background:G.green, color:'#fff', border:'none', borderRadius:'20px', padding:'10px 24px', fontSize:'13px', fontWeight:600 }}
              >+ List a service</button>
            </div>
          )}

          {!loading && filtered.length>0 && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'9px' }}>
              {filtered.map((svc,i)=>(
                <ProviderCard key={svc.id} svc={svc} delay={i*0.035} currentUser={currentUser} onClick={()=>setSelectedProvider(svc)} navigate={navigate} />
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

  function goChat(e) { e.stopPropagation(); if(currentUser) navigate(`/chat/${svc.provider_id}/${svc.id}`) }
  function doCall(e) { e.stopPropagation(); if(svc.contact) window.location.href=`tel:${svc.contact}` }
  function doWhatsApp(e) { e.stopPropagation(); window.open(formatWhatsApp(svc.contact,svc.name,svc.category),'_blank') }

  return (
    <div className="svc-card" style={{ animationDelay:`${delay}s` }} onClick={onClick}>
      <div className="card-inner" style={{ background:G.card, border:`1px solid ${G.border}`, borderRadius:G.radius, overflow:'hidden' }}>
        <div style={{ position:'relative', height:'92px', background:pal.bg, display:'flex', alignItems:'center', justifyContent:'center' }}>
          {heroMedia ? (
            heroMedia.match(/\.(mp4|mov|webm)$/i)
              ? <video src={heroMedia} style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }} muted loop playsInline/>
              : <img src={heroMedia} alt={svc.name} style={{ width:'100%', height:'100%', objectFit:'cover', position:'absolute', inset:0 }}/>
          ) : (
            <span style={{ fontSize:'34px', lineHeight:1 }}>{catMeta?.icon||'🔧'}</span>
          )}
          <span style={{ position:'absolute', top:'6px', left:'6px', background:'rgba(255,255,255,0.9)', color:pal.icon, fontSize:'9px', fontWeight:700, padding:'2px 6px', borderRadius:'8px', letterSpacing:'0.02em' }}>
            {svc.category}
          </span>
          {svc.verified && (
            <span style={{ position:'absolute', top:'6px', right:'6px', width:'18px', height:'18px', background:G.green, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color:'#fff', fontWeight:700 }}>✓</span>
          )}
          {svc.rate && (
            <span style={{ position:'absolute', bottom:'6px', right:'6px', background:'rgba(26,46,34,0.82)', color:'#fff', fontSize:'9px', fontWeight:700, padding:'2px 6px', borderRadius:'7px' }}>
              {svc.rate}
            </span>
          )}
          {svc.available && (
            <span style={{ position:'absolute', bottom:'6px', left:'6px', background:'rgba(255,255,255,0.9)', color:G.green, fontSize:'9px', fontWeight:700, padding:'2px 6px', borderRadius:'7px', display:'flex', alignItems:'center', gap:'3px' }}>
              <span style={{ width:'5px', height:'5px', borderRadius:'50%', background:G.green, display:'inline-block' }}/>
              {svc.available}
            </span>
          )}
        </div>

        <div style={{ padding:'8px 8px 7px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'5px', marginBottom:'4px' }}>
            <div style={{ width:'22px', height:'22px', borderRadius:'50%', background:avatarColor(svc.name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', fontWeight:700, color:'#fff', flexShrink:0 }}>
              {initials(svc.name)}
            </div>
            <div style={{ minWidth:0, flex:1 }}>
              <div style={{ fontSize:'11px', fontWeight:600, color:G.text, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{svc.name}</div>
              {svc.city && <div style={{ fontSize:'9px', color:G.textSoft }}>📍 {svc.city}</div>}
            </div>
          </div>

          <div style={{ fontSize:'11px', color:G.textMid, lineHeight:'1.4', marginBottom:'5px', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden' }}>
            {svc.description?.slice(0,72)||svc.name}
          </div>

          {svc.rating>0 && (
            <div style={{ display:'flex', alignItems:'center', gap:'3px', marginBottom:'5px' }}>
              <span style={{ color:G.orange, fontSize:'10px' }}>{renderStars(svc.rating)}</span>
              <span style={{ fontSize:'9px', color:G.textSoft }}>{svc.rating} ({svc.jobs_done||0})</span>
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