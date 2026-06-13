/**
 * SokoMalawi — LookingFor.jsx (Redesigned)
 * Design system: matches Home.jsx (Sora/Inter, T tokens, glass nav, card styles).
 * New feature: Wanted Alerts — sellers subscribe to categories and receive
 * in-app notifications when a matching buyer request is posted.
 *
 * Drop-in replacement. All Supabase wiring and existing logic preserved.
 * Added tables assumed: wanted_alerts (id, user_id, category, cities, min_budget,
 *   max_budget, notify_email, notify_push, created_at, active)
 */

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

/* ─────────────────────────────────────────────────────────────
   DESIGN TOKENS  (matches Home.jsx T object)
───────────────────────────────────────────────────────────── */
const T = {
  green:  '#0F9D58',
  greenD: '#0a7a44',
  greenL: '#e8f5ee',
  amber:  '#F9AB00',
  amberD: '#c88a00',
  blue:   '#1A73E8',
  blueL:  '#e8f0fe',
  red:    '#ea4335',
  gray50: '#f8f9fa',
  gray100:'#f1f3f4',
  gray200:'#e8eaed',
  gray400:'#bdc1c6',
  gray600:'#80868b',
  gray800:'#3c4043',
  gray900:'#202124',
  white:  '#ffffff',
  shadow: '0 1px 3px rgba(0,0,0,0.10), 0 2px 8px rgba(0,0,0,0.07)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.11), 0 8px 28px rgba(0,0,0,0.08)',
  shadowLg: '0 8px 24px rgba(0,0,0,0.13), 0 16px 48px rgba(0,0,0,0.09)',
  font: "'Inter', 'DM Sans', system-ui, sans-serif",
  fontDisplay: "'Sora', 'Inter', system-ui, sans-serif",
}

/* ─────────────────────────────────────────────────────────────
   GLOBAL STYLES
───────────────────────────────────────────────────────────── */
const GLOBAL_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  .lf-v2 { font-family: ${T.font}; background: ${T.gray50}; color: ${T.gray900}; }
  .lf-v2 button, .lf-v2 input, .lf-v2 select, .lf-v2 textarea { font-family: inherit; }
  .lf-scroll::-webkit-scrollbar { display: none; }
  .lf-scroll { -ms-overflow-style: none; scrollbar-width: none; }
  @keyframes fadeUp { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  @keyframes spin   { to { transform:rotate(360deg); } }
  @keyframes pulse  { 0%,100%{opacity:1;} 50%{opacity:0.45;} }
  @keyframes shimmer { 0%{background-position:-600px 0;} 100%{background-position:600px 0;} }
  @keyframes badgePop { 0%{transform:scale(0.7);opacity:0;} 70%{transform:scale(1.1);} 100%{transform:scale(1);opacity:1;} }
  @keyframes slideUp { from{transform:translateY(100%);} to{transform:translateY(0);} }
  .lf-nav-glass {
    position: sticky; top: 0; z-index: 200;
    backdrop-filter: blur(20px) saturate(1.8);
    -webkit-backdrop-filter: blur(20px) saturate(1.8);
    background: rgba(255,255,255,0.90);
    border-bottom: 1px solid rgba(0,0,0,0.07);
    box-shadow: 0 1px 0 rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.04);
  }
  .lf-card {
    background: ${T.white};
    border-radius: 20px;
    border: 1px solid ${T.gray100};
    box-shadow: ${T.shadow};
    transition: transform 0.22s cubic-bezier(0.34,1.2,0.64,1), box-shadow 0.22s ease;
  }
  .lf-card:hover {
    transform: translateY(-3px) scale(1.006);
    box-shadow: ${T.shadowMd};
  }
  .lf-btn-primary {
    background: ${T.green}; color: #fff; border: none;
    border-radius: 12px; padding: 11px 20px;
    font-size: 13.5px; font-weight: 700; cursor: pointer;
    display: inline-flex; align-items: center; gap: 6px;
    transition: background 0.15s, transform 0.1s, box-shadow 0.15s;
    white-space: nowrap;
  }
  .lf-btn-primary:hover { background: ${T.greenD}; box-shadow: 0 4px 16px rgba(15,157,88,0.3); transform: translateY(-1px); }
  .lf-btn-primary:active { transform: scale(0.98); }
  .lf-btn-secondary {
    background: ${T.white}; color: ${T.gray800};
    border: 1.5px solid ${T.gray200}; border-radius: 12px;
    padding: 10px 18px; font-size: 13px; font-weight: 600;
    cursor: pointer; display: inline-flex; align-items: center; gap: 6px;
    transition: all 0.15s; white-space: nowrap;
  }
  .lf-btn-secondary:hover { border-color: ${T.green}; color: ${T.green}; background: ${T.greenL}; }
  .lf-input {
    width: 100%; border: 1.5px solid ${T.gray200}; border-radius: 12px;
    padding: 11px 14px; font-size: 14px; background: ${T.white}; outline: none;
    transition: border-color 0.15s, box-shadow 0.15s; color: ${T.gray900};
  }
  .lf-input:focus { border-color: ${T.green}; box-shadow: 0 0 0 3px rgba(15,157,88,0.10); }
  .lf-select {
    width: 100%; border: 1.5px solid ${T.gray200}; border-radius: 12px;
    padding: 11px 14px; font-size: 14px; background: ${T.white}; outline: none;
    appearance: none; color: ${T.gray900}; cursor: pointer;
    transition: border-color 0.15s;
  }
  .lf-select:focus { border-color: ${T.green}; box-shadow: 0 0 0 3px rgba(15,157,88,0.10); }
  .lf-pill {
    border-radius: 50px; padding: 7px 15px; font-size: 12.5px; font-weight: 600;
    cursor: pointer; transition: all 0.15s; white-space: nowrap; border: none;
  }
  .lf-tab {
    padding: 8px 16px; border-radius: 50px; border: 1.5px solid ${T.gray200};
    background: ${T.white}; font-size: 13px; font-weight: 600; color: ${T.gray600};
    cursor: pointer; transition: all 0.15s; white-space: nowrap;
  }
  .lf-tab.active {
    background: ${T.green} !important; border-color: ${T.green} !important;
    color: #fff !important; box-shadow: 0 2px 10px rgba(15,157,88,0.28);
  }
  .lf-tab:hover:not(.active) { border-color: ${T.green}; color: ${T.green}; background: ${T.greenL}; }
  .skeleton {
    background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
    background-size: 600px 100%; animation: shimmer 1.4s infinite; border-radius: 10px;
  }
  @media (max-width: 768px) {
    .lf-grid-3 { grid-template-columns: 1fr !important; }
    .lf-featured-grid { grid-template-columns: 1fr !important; }
  }
`

/* ─────────────────────────────────────────────────────────────
   CONSTANTS
───────────────────────────────────────────────────────────── */
const CATEGORIES = ['All','Products','Electronics','Fashion','Vehicles','Property','Agriculture','Services','Jobs','Business Partners','Other']
const CAT_EMOJI  = { Electronics:'📱', Fashion:'👗', Vehicles:'🚗', Property:'🏠', Agriculture:'🌾', Services:'⚙️', Jobs:'💼', 'Business Partners':'🤝', Products:'📦', Other:'📋' }

const SORT_OPTIONS = [
  { k:'recent', l:'Newest' },
  { k:'budget', l:'Top Budget' },
  { k:'demand', l:'Most Offers' },
  { k:'urgent', l:'Urgent First' },
]
const URGENCY_OPTIONS = [
  { value:'urgent',    label:'Urgent',    color:T.red,   bg:'#fef2f2', border:'#fca5a5' },
  { value:'this_week', label:'This Week', color:T.amber, bg:'#fffbeb', border:'#fcd34d' },
  { value:'flexible',  label:'Flexible',  color:T.gray600, bg:T.gray50, border:T.gray200 },
]

/* ─────────────────────────────────────────────────────────────
   GEO HELPERS
───────────────────────────────────────────────────────────── */
async function getGPSCity() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`)
          const d = await res.json()
          resolve(d.city || d.locality || d.principalSubdivision || null)
        } catch { resolve(null) }
      }, () => resolve(null), { timeout: 10000 }
    )
  })
}

async function getDBCities(sb) {
  const { data } = await sb.from('listings').select('city').not('city','is',null).eq('status','active')
  return [...new Set((data||[]).map(r=>r.city?.trim()).filter(Boolean))].sort()
}

/* ─────────────────────────────────────────────────────────────
   SCORING
───────────────────────────────────────────────────────────── */
function getDemandLevel(req) {
  const s = (req.offer_count||0)*3 + (req.view_count||0)*0.1 + (req.urgency==='urgent'?10:0)
  if (s>=20||req.urgency==='urgent') return { label:'High Demand', color:T.red,   bg:'#fef2f2', dot:T.red }
  if (s>=8)                          return { label:'Active',      color:T.amber, bg:'#fffbeb', dot:T.amber }
  return                                    { label:'New',         color:T.green, bg:T.greenL,  dot:T.green }
}

function getMatchScore(req, myListings) {
  if (!myListings?.length) return null
  let best = 0
  for (const l of myListings) {
    let s = 0
    if (l.category === req.category) s += 40
    const rc = (req.cities||[req.city]).filter(Boolean).map(c=>c?.toLowerCase())
    if (l.city && rc.includes(l.city.toLowerCase())) s += 35
    if (req.budget && l.price && l.price <= req.budget) s += 25
    if (s > best) best = s
  }
  return best > 0 ? best : null
}

/* ─────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────── */
function timeAgo(ts) {
  if (!ts) return ''
  const d = Date.now()-new Date(ts), h=Math.floor(d/3600000), m=Math.floor(d/60000)
  if (h>=24) return `${Math.floor(h/24)}d ago`
  if (h>=1)  return `${h}h ago`
  if (m<1)   return 'just now'
  return `${m}m ago`
}

function fmtMWK(n) {
  if (!n && n!==0) return ''
  if (n>=1_000_000) return `MK ${(n/1_000_000).toFixed(1)}M`
  if (n>=1_000)     return `MK ${(n/1_000).toFixed(0)}K`
  return `MK ${n.toLocaleString()}`
}

/* ─────────────────────────────────────────────────────────────
   INLINE SVG ICONS
───────────────────────────────────────────────────────────── */
const Icon = {
  search: (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  bell:   (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  plus:   (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  back:   (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>,
  eye:    (s=13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  pin:    (s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>,
  check:  (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  trash:  (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>,
  edit:   (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  x:      (s=13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  heart:  (s=15,f='none') => <svg width={s} height={s} viewBox="0 0 24 24" fill={f} stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  alert:  (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  lightning: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>,
  chevD:  (s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>,
}

/* ═══════════════════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════════════════ */
export default function LookingFor() {
  const navigate = useNavigate()
  const location = useLocation()

  /* ── State ── */
  const [user,            setUser]            = useState(null)
  const [requests,        setRequests]        = useState([])
  const [fulfilledReqs,   setFulfilledReqs]   = useState([])
  const [loading,         setLoading]         = useState(true)
  const [category,        setCategory]        = useState('All')
  const [sortBy,          setSortBy]          = useState('recent')
  const [search,          setSearch]          = useState('')
  const [composerOpen,    setComposerOpen]    = useState(false)
  const [form,            setForm]            = useState({ title:'', category:'Electronics', budget:'', description:'', urgency:'flexible' })
  const [imageFile,       setImageFile]       = useState(null)
  const [imagePreview,    setImagePreview]    = useState(null)
  const [selectedCities,  setSelectedCities]  = useState([])
  const [dbCities,        setDbCities]        = useState([])
  const [citySearch,      setCitySearch]      = useState('')
  const [detectingCity,   setDetectingCity]   = useState(false)
  const [posting,         setPosting]         = useState(false)
  const [toast,           setToast]           = useState(null)
  const [viewerCity,      setViewerCity]      = useState(null)
  const [detectingViewer, setDetectingViewer] = useState(true)
  const [cityEditOpen,    setCityEditOpen]    = useState(false)
  const [cityEditInput,   setCityEditInput]   = useState('')
  const [cityEditSuggs,   setCityEditSuggs]   = useState([])
  const [myListings,      setMyListings]      = useState([])
  const [stats,           setStats]           = useState(null)
  const [sellerMatches,   setSellerMatches]   = useState(null)
  const [savedIds,        setSavedIds]        = useState(new Set())
  const [notifyIds,       setNotifyIds]       = useState(new Set())
  const [trendingDemand,  setTrendingDemand]  = useState([])
  /* Wanted Alerts */
  const [alertsOpen,      setAlertsOpen]      = useState(false)
  const [myAlerts,        setMyAlerts]        = useState([])
  const [alertForm,       setAlertForm]       = useState({ category:'Electronics', cities:[], minBudget:'', maxBudget:'', notifyEmail:false, notifyPush:true })
  const [alertCityInput,  setAlertCityInput]  = useState('')
  const [savingAlert,     setSavingAlert]     = useState(false)
  const [activeTab,       setActiveTab]       = useState('all') // 'all' | 'mine' | 'saved' | 'alerts'

  const fileRef = useRef()

  /* ── Bootstrap ── */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate('/login'); return }
      supabase.from('profiles').select('full_name,avatar_url,city').eq('id',user.id).maybeSingle()
        .then(async ({ data }) => {
          setUser({ ...user, ...(data||{}) })
          const gpsCity = await getGPSCity()
          setViewerCity(gpsCity)
          setDetectingViewer(false)
          const { data: listings } = await supabase.from('listings')
            .select('id,title,category,price,city').eq('seller_id',user.id).eq('status','active')
          setMyListings(listings||[])
          loadAlerts(user.id)
        })
    })
    if (location.state?.openComposer) openComposer()
  }, [])

  useEffect(() => {
    if (!detectingViewer) { loadRequests(); loadStats(); loadFulfilled() }
  }, [category, detectingViewer, viewerCity, sortBy, search])

  /* ── Loaders ── */
  async function loadStats() {
    const { data } = await supabase.from('buyer_requests').select('category,budget,offer_count,created_at')
    if (!data) return
    const today = new Date(); today.setHours(0,0,0,0)
    const totalBudget = data.reduce((s,r)=>s+(r.budget||0),0)
    const totalOffers = data.reduce((s,r)=>s+(r.offer_count||0),0)
    const newToday = data.filter(r=>new Date(r.created_at)>=today).length
    const byCat = {}
    data.forEach(r=>{ byCat[r.category]=(byCat[r.category]||0)+1 })
    setStats({ total:data.length, totalBudget, totalOffers, newToday, byCat })
    setTrendingDemand(Object.entries(byCat).sort((a,b)=>b[1]-a[1]).slice(0,5))
  }

  async function loadRequests() {
    setLoading(true)
    let q = supabase.from('buyer_requests')
      .select('*, profiles:user_id(full_name,avatar_url)')
      .neq('status','fulfilled').limit(80)
    if (category!=='All') q=q.eq('category',category)
    if (sortBy==='budget') q=q.order('budget',{ascending:false,nullsFirst:false})
    else if (sortBy==='demand') q=q.order('offer_count',{ascending:false})
    else if (sortBy==='urgent') q=q.order('urgency',{ascending:true})
    else q=q.order('created_at',{ascending:false})
    const { data, error } = await q
    if (!error) {
      let filtered = (data||[]).filter(r => {
        if (!r.cities||r.cities.length===0) return true
        if (!viewerCity) return true
        return r.cities.some(c=>c.toLowerCase()===viewerCity.toLowerCase())
      })
      if (search.trim()) {
        const q2=search.toLowerCase()
        filtered=filtered.filter(r=>r.title?.toLowerCase().includes(q2)||r.description?.toLowerCase().includes(q2))
      }
      setRequests(filtered)
      if (myListings.length>0) {
        const matches=filtered.filter(r=>getMatchScore(r,myListings)>=40)
        setSellerMatches({ count:matches.length, value:matches.reduce((s,r)=>s+(r.budget||0),0) })
      }
    }
    setLoading(false)
  }

  async function loadFulfilled() {
    const { data } = await supabase.from('buyer_requests')
      .select('id,title,category,created_at,profiles:user_id(full_name)')
      .eq('status','fulfilled').order('updated_at',{ascending:false}).limit(5)
    setFulfilledReqs(data||[])
  }

  async function loadAlerts(uid) {
    const { data } = await supabase.from('wanted_alerts').select('*').eq('user_id',uid).eq('active',true).order('created_at',{ascending:false})
    setMyAlerts(data||[])
  }

  /* ── Post request ── */
  async function handlePost() {
    if (!form.title.trim()) return
    setPosting(true)
    let image_url=null
    if (imageFile) {
      const ext=imageFile.name.split('.').pop()
      const path=`${user.id}/${Date.now()}.${ext}`
      const { error:upErr } = await supabase.storage.from('buyer-requests').upload(path,imageFile,{contentType:imageFile.type})
      if (!upErr) {
        const { data:urlData } = supabase.storage.from('buyer-requests').getPublicUrl(path)
        image_url=urlData.publicUrl
      }
    }
    const { error } = await supabase.from('buyer_requests').insert({
      user_id:user.id, title:form.title.trim(), category:form.category,
      budget:form.budget?Number(form.budget):null,
      city:selectedCities[0]||viewerCity||null,
      cities:selectedCities.length>0?selectedCities:(viewerCity?[viewerCity]:[]),
      detected_city:viewerCity||null,
      description:form.description.trim()||null,
      urgency:form.urgency, image_url, status:'open', offer_count:0, view_count:0,
    })
    setPosting(false)
    if (error) { showToast('Failed to post request','error'); return }
    /* Notify matching sellers who have Wanted Alerts */
    try {
      const { data:alerts } = await supabase.from('wanted_alerts')
        .select('user_id,cities,min_budget,max_budget')
        .eq('category',form.category).eq('active',true).neq('user_id',user.id)
      if (alerts?.length) {
        const filteredAlerts=alerts.filter(a=>{
          if (a.min_budget && form.budget && Number(form.budget)<a.min_budget) return false
          if (a.max_budget && form.budget && Number(form.budget)>a.max_budget) return false
          if (a.cities?.length>0 && selectedCities.length>0) {
            return a.cities.some(c=>selectedCities.map(s=>s.toLowerCase()).includes(c.toLowerCase()))
          }
          return true
        })
        if (filteredAlerts.length>0) {
          await supabase.from('notifications').insert(filteredAlerts.map(a=>({
            user_id:a.user_id,
            title:`🔔 Wanted Alert: ${form.category}`,
            message:`New request matching your alert: "${form.title}"${form.budget?` · Budget ${fmtMWK(Number(form.budget))}`:''}${selectedCities[0]?` · ${selectedCities[0]}`:''}`,
            type:'wanted_alert', read:false, link:'/looking-for',
            data:{ request_title:form.title, category:form.category, budget:form.budget||null, cities:selectedCities, buyer_id:user.id }
          })))
        }
      }
    } catch(e) { console.warn('Alert notify failed',e) }
    showToast('Request posted! Sellers notified.','success')
    setForm({ title:'', category:'Electronics', budget:'', description:'', urgency:'flexible' })
    setImageFile(null); setImagePreview(null); setSelectedCities([])
    setComposerOpen(false)
    loadRequests(); loadStats()
  }

  /* ── Wanted Alerts ── */
  async function saveAlert() {
    if (!user) return
    setSavingAlert(true)
    const { error } = await supabase.from('wanted_alerts').insert({
      user_id:user.id,
      category:alertForm.category,
      cities:alertForm.cities,
      min_budget:alertForm.minBudget?Number(alertForm.minBudget):null,
      max_budget:alertForm.maxBudget?Number(alertForm.maxBudget):null,
      notify_email:alertForm.notifyEmail,
      notify_push:alertForm.notifyPush,
      active:true,
    })
    setSavingAlert(false)
    if (error) { showToast('Failed to save alert','error'); return }
    showToast(`Alert created for ${alertForm.category}!`,'success')
    setAlertForm({ category:'Electronics', cities:[], minBudget:'', maxBudget:'', notifyEmail:false, notifyPush:true })
    setAlertCityInput('')
    loadAlerts(user.id)
  }

  async function deleteAlert(id) {
    await supabase.from('wanted_alerts').update({active:false}).eq('id',id)
    setMyAlerts(prev=>prev.filter(a=>a.id!==id))
    showToast('Alert removed','success')
  }

  /* ── Actions ── */
  async function sendOffer(req) {
    await supabase.from('buyer_requests').update({view_count:(req.view_count||0)+1}).eq('id',req.id)
    const { data:myL } = await supabase.from('listings').select('id').eq('seller_id',user.id).eq('status','active').limit(1)
    const urgLine=req.urgency==='urgent'?'\n⚠ URGENT':''
    const msg=`Hi, I can help with your request: "${req.title}"${req.budget?`\nBudget: ${fmtMWK(req.budget)}`:''}${req.city?`\nLocation: ${req.city}`:''}${urgLine}\n\nI have exactly what you need. Let's discuss!`
    if (myL?.length) {
      await supabase.from('buyer_requests').update({offer_count:(req.offer_count||0)+1}).eq('id',req.id)
      navigate(`/chat/${req.user_id}/${myL[0].id}`,{state:{prefillMessage:msg,isRequest:true}})
    } else showToast('Post a listing first to send an offer','warning')
  }

  async function markFulfilled(id) {
    await supabase.from('buyer_requests').update({status:'fulfilled'}).eq('id',id)
    setRequests(prev=>prev.filter(r=>r.id!==id))
    showToast('Marked as fulfilled','success'); loadFulfilled()
  }

  async function deleteRequest(id) {
    await supabase.from('buyer_requests').delete().eq('id',id)
    setRequests(prev=>prev.filter(r=>r.id!==id))
    showToast('Request deleted','success')
  }

  function toggleSave(id) {
    setSavedIds(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n })
    showToast(savedIds.has(id)?'Removed from saved':'Saved!','success')
  }

  function toggleNotify(id) {
    setNotifyIds(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n })
    showToast(notifyIds.has(id)?'Notifications off':'You\'ll be notified of similar requests','success')
  }

  async function openComposer() {
    setComposerOpen(true)
    const cities=await getDBCities(supabase); setDbCities(cities)
    if (selectedCities.length===0&&viewerCity) {
      setSelectedCities([viewerCity])
      if (!cities.includes(viewerCity)) setDbCities(prev=>[viewerCity,...prev])
    } else if (selectedCities.length===0) {
      setDetectingCity(true)
      const c=await getGPSCity(); setDetectingCity(false)
      if (c) { setSelectedCities([c]); if (!cities.includes(c)) setDbCities(prev=>[c,...prev]) }
    }
  }

  function showToast(msg, type='success') { setToast({msg,type}); setTimeout(()=>setToast(null),2800) }

  /* ── Derived ── */
  const allReqs       = search.trim() ? requests.filter(r=>r.title?.toLowerCase().includes(search.toLowerCase())||r.description?.toLowerCase().includes(search.toLowerCase())) : requests
  const myReqs        = allReqs.filter(r=>r.user_id===user?.id)
  const otherReqs     = allReqs.filter(r=>r.user_id!==user?.id)
  const featuredReqs  = otherReqs.filter(r=>(r.offer_count||0)>=2||r.urgency==='urgent').slice(0,8)
  const savedReqs     = allReqs.filter(r=>savedIds.has(r.id))
  const recommendedReqs = myListings.length>0
    ? otherReqs.filter(r=>getMatchScore(r,myListings)>=40).sort((a,b)=>(getMatchScore(b,myListings)||0)-(getMatchScore(a,myListings)||0)).slice(0,5)
    : []

  const tabCounts = { all:otherReqs.length, mine:myReqs.length, saved:savedReqs.length, alerts:myAlerts.length }

  /* ── Display reqs by active tab ── */
  const tabReqs = activeTab==='mine' ? myReqs : activeTab==='saved' ? savedReqs : otherReqs

  /* ═══ RENDER ═══════════════════════════════════════════ */
  return (
    <div className="lf-v2" style={{ minHeight:'100vh', paddingBottom:80 }}>
      <style>{GLOBAL_CSS}</style>

      {/* ── STICKY HEADER ── */}
      <div className="lf-nav-glass">
        <div style={{ maxWidth:900, margin:'0 auto', padding:'0 16px' }}>
          {/* Top bar */}
          <div style={{ display:'flex', alignItems:'center', gap:12, height:58 }}>
            <button onClick={()=>navigate(-1)} style={{ width:36,height:36,borderRadius:10,background:T.gray100,border:`1px solid ${T.gray200}`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:T.gray800,flexShrink:0 }}>
              {Icon.back(16)}
            </button>
            <div style={{ flex:1 }}>
              <div style={{ fontFamily:T.fontDisplay, fontSize:18, fontWeight:800, color:T.gray900, letterSpacing:'-0.4px', lineHeight:1.2 }}>Looking For</div>
              <div style={{ fontSize:11, color:T.gray600, marginTop:1 }}>Buyers searching for products, services & opportunities</div>
            </div>
            <button
              onClick={()=>{ setAlertsOpen(true); setActiveTab('alerts') }}
              style={{ display:'flex',alignItems:'center',gap:6,padding:'8px 14px',borderRadius:12,background:myAlerts.length>0?T.greenL:T.gray100,border:`1.5px solid ${myAlerts.length>0?T.green:T.gray200}`,fontSize:12.5,fontWeight:700,color:myAlerts.length>0?T.green:T.gray800,cursor:'pointer',flexShrink:0 }}>
              {Icon.bell(14)}
              <span className="soko-nav-desktop-only" style={{ display:'inline' }}>Alerts</span>
              {myAlerts.length>0 && <span style={{ background:T.green,color:'#fff',borderRadius:'50%',width:17,height:17,fontSize:9,fontWeight:800,display:'flex',alignItems:'center',justifyContent:'center' }}>{myAlerts.length}</span>}
            </button>
            <button className="lf-btn-primary" onClick={openComposer} style={{ fontSize:13, padding:'9px 16px' }}>
              {Icon.plus(14)} Post Request
            </button>
          </div>

          {/* Location row */}
          <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 0 10px', borderTop:`1px solid ${T.gray100}` }}>
            <span style={{ color:T.green, flexShrink:0 }}>{Icon.pin(12)}</span>
            <span style={{ fontSize:12, color:T.gray600 }}>Showing in</span>
            <span style={{ fontSize:12.5, fontWeight:700, color:T.gray900 }}>{detectingViewer?'Detecting…':(viewerCity||'All cities')}</span>
            {!cityEditOpen && (
              <button onClick={async()=>{ setCityEditInput(viewerCity||''); setCityEditOpen(true); const c=await getDBCities(supabase); setDbCities(c) }}
                style={{ background:'none',border:'none',fontSize:12,color:T.green,fontWeight:700,cursor:'pointer',padding:0,marginLeft:2 }}>
                Change
              </button>
            )}
            {cityEditOpen && (
              <div style={{ display:'flex',gap:6,flex:1,position:'relative' }}>
                <input className="lf-input" autoFocus value={cityEditInput} placeholder="Type city…"
                  style={{ fontSize:12,padding:'5px 10px',flex:1 }}
                  onChange={e=>{ const v=e.target.value; setCityEditInput(v); setCityEditSuggs(v.trim()?dbCities.filter(c=>c.toLowerCase().includes(v.toLowerCase())).slice(0,5):[]) }}
                  onKeyDown={e=>{ if(e.key==='Enter'&&cityEditInput.trim()){ setViewerCity(cityEditInput.trim()); setCityEditOpen(false) } if(e.key==='Escape') setCityEditOpen(false) }} />
                {cityEditSuggs.length>0 && (
                  <div style={{ position:'absolute',top:'100%',left:0,right:60,background:T.white,border:`1px solid ${T.gray200}`,borderRadius:12,zIndex:300,boxShadow:T.shadowLg,marginTop:2 }}>
                    {cityEditSuggs.map(c=>(
                      <div key={c} onClick={()=>{ setViewerCity(c); setCityEditOpen(false); setCityEditSuggs([]) }}
                        style={{ padding:'9px 14px',fontSize:13,cursor:'pointer',borderBottom:`1px solid ${T.gray100}`,color:T.gray900 }}>{c}</div>
                    ))}
                  </div>
                )}
                <button onClick={()=>{ if(cityEditInput.trim()) setViewerCity(cityEditInput.trim()); setCityEditOpen(false) }}
                  style={{ background:T.green,color:'#fff',border:'none',borderRadius:8,padding:'5px 10px',fontSize:11,fontWeight:700,cursor:'pointer' }}>{Icon.check(13)}</button>
                <button onClick={()=>setCityEditOpen(false)} style={{ background:'none',border:'none',color:T.gray400,cursor:'pointer',fontSize:14,display:'flex',alignItems:'center' }}>{Icon.x(13)}</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ maxWidth:900, margin:'0 auto', padding:'0 16px' }}>

        {/* ── INSIGHTS BAR ── */}
        {stats && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:10, margin:'16px 0' }}>
            {[
              { label:'Active Requests', value:stats.total.toLocaleString(), color:T.gray900, icon:'📋' },
              { label:'Buying Power',    value:fmtMWK(stats.totalBudget),    color:T.green,   icon:'💰' },
              { label:'Offers Sent',     value:stats.totalOffers.toLocaleString(), color:T.gray900, icon:'💬' },
              { label:'New Today',       value:stats.newToday.toLocaleString(),    color:T.amber,   icon:'🆕' },
            ].map(({ label, value, color, icon })=>(
              <div key={label} className="lf-card" style={{ padding:'12px 10px', textAlign:'center', animation:'fadeUp 0.35s ease both' }}>
                <div style={{ fontSize:16, marginBottom:3 }}>{icon}</div>
                <div style={{ fontFamily:T.fontDisplay, fontSize:17, fontWeight:800, color, letterSpacing:'-0.5px' }}>{value}</div>
                <div style={{ fontSize:10, color:T.gray600, marginTop:2, fontWeight:500 }}>{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── SELLER OPPORTUNITY BANNER ── */}
        {sellerMatches?.count>0 && (
          <div style={{
            borderRadius:20, padding:'20px 22px', marginBottom:16, position:'relative', overflow:'hidden',
            background:'linear-gradient(135deg, #0a1f12 0%, #0f2d1a 50%, #0a1a2e 100%)',
            border:'1px solid rgba(255,255,255,0.07)',
            boxShadow:T.shadowMd,
            animation:'fadeUp 0.4s ease both',
          }}>
            <div style={{ position:'absolute',top:-30,right:-30,width:120,height:120,borderRadius:'50%',background:'rgba(15,157,88,0.15)',pointerEvents:'none' }} />
            <div style={{ position:'absolute',bottom:-20,right:60,width:80,height:80,borderRadius:'50%',background:'rgba(15,157,88,0.08)',pointerEvents:'none' }} />
            <div style={{ fontSize:10,fontWeight:800,color:'#4ade80',textTransform:'uppercase',letterSpacing:1.2,marginBottom:5 }}>Seller Opportunity</div>
            <div style={{ fontFamily:T.fontDisplay, fontSize:20, fontWeight:800, color:'#fff', lineHeight:1.25, marginBottom:4 }}>
              {sellerMatches.count} buyers are looking for what you sell
            </div>
            {sellerMatches.value>0 && (
              <div style={{ fontSize:13,color:'rgba(255,255,255,0.55)',marginBottom:14 }}>
                Combined budget: <span style={{ color:'#4ade80',fontWeight:700 }}>{fmtMWK(sellerMatches.value)}</span>
              </div>
            )}
            <div style={{ display:'flex',gap:10,flexWrap:'wrap' }}>
              <button onClick={()=>setSortBy('demand')} className="lf-btn-primary" style={{ fontSize:12.5 }}>View Matching Buyers →</button>
              <button onClick={()=>{ setAlertsOpen(true); setActiveTab('alerts') }}
                style={{ background:'rgba(255,255,255,0.08)',border:'1px solid rgba(255,255,255,0.18)',borderRadius:12,padding:'10px 16px',fontSize:12.5,fontWeight:700,color:'rgba(255,255,255,0.8)',cursor:'pointer',display:'flex',alignItems:'center',gap:6 }}>
                {Icon.bell(13)} Set Up Alerts
              </button>
            </div>
          </div>
        )}

        {/* ── SEARCH + FILTERS ── */}
        <div style={{ marginBottom:16 }}>
          <div style={{ position:'relative', marginBottom:12 }}>
            <span style={{ position:'absolute',left:14,top:'50%',transform:'translateY(-50%)',color:T.gray400,pointerEvents:'none',display:'flex' }}>{Icon.search(16)}</span>
            <input className="lf-input" placeholder="Search requests, products, services…" value={search}
              onChange={e=>setSearch(e.target.value)}
              style={{ paddingLeft:42, boxShadow:T.shadow }} />
          </div>
          {/* Category tabs */}
          <div className="lf-scroll" style={{ display:'flex', gap:7, overflowX:'auto', marginBottom:10 }}>
            {CATEGORIES.map(c=>(
              <button key={c} className={`lf-tab${category===c?' active':''}`} onClick={()=>setCategory(c)}>
                {c!=='All'&&CAT_EMOJI[c]?`${CAT_EMOJI[c]} `:''}  {c}
              </button>
            ))}
          </div>
          {/* Sort pills */}
          <div style={{ display:'flex', gap:7, alignItems:'center' }}>
            <span style={{ fontSize:11,color:T.gray600,fontWeight:600,flexShrink:0 }}>Sort:</span>
            {SORT_OPTIONS.map(({k,l})=>(
              <button key={k}
                onClick={()=>setSortBy(k)}
                style={{ padding:'6px 13px',borderRadius:50,border:`1.5px solid ${sortBy===k?T.green:T.gray200}`,background:sortBy===k?T.green:T.white,color:sortBy===k?'#fff':T.gray800,fontSize:11.5,fontWeight:600,cursor:'pointer',transition:'all 0.15s',whiteSpace:'nowrap' }}>
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* ── TABS: All / Mine / Saved / Alerts ── */}
        <div style={{ display:'flex', gap:6, marginBottom:16, borderBottom:`1px solid ${T.gray200}`, paddingBottom:12 }}>
          {[
            { id:'all',    label:'All Requests' },
            { id:'mine',   label:'My Requests' },
            { id:'saved',  label:'Saved' },
            { id:'alerts', label:'Wanted Alerts' },
          ].map(t=>(
            <button key={t.id}
              onClick={()=>{ setActiveTab(t.id); if(t.id==='alerts') setAlertsOpen(true) }}
              style={{ display:'flex',alignItems:'center',gap:5,padding:'7px 14px',borderRadius:50,border:`1.5px solid ${activeTab===t.id?T.green:T.gray200}`,background:activeTab===t.id?T.green:T.white,color:activeTab===t.id?'#fff':T.gray800,fontSize:12.5,fontWeight:700,cursor:'pointer',transition:'all 0.15s',whiteSpace:'nowrap' }}>
              {t.label}
              {tabCounts[t.id]>0 && (
                <span style={{ background:activeTab===t.id?'rgba(255,255,255,0.3)':T.greenL,color:activeTab===t.id?'#fff':T.green,borderRadius:50,padding:'1px 7px',fontSize:10,fontWeight:800 }}>{tabCounts[t.id]}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── WANTED ALERTS PANEL ── */}
        {activeTab==='alerts' && (
          <div style={{ animation:'fadeUp 0.3s ease both' }}>
            {/* Hero banner for alerts */}
            <div style={{ borderRadius:20, padding:'24px', marginBottom:20, background:`linear-gradient(135deg, ${T.gray900} 0%, #1a2535 100%)`, border:'1px solid rgba(255,255,255,0.07)', position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute',top:0,right:0,bottom:0,left:'60%',background:`radial-gradient(ellipse at 80% 50%, rgba(15,157,88,0.18) 0%, transparent 70%)`,pointerEvents:'none' }} />
              <div style={{ position:'relative',zIndex:1 }}>
                <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:10 }}>
                  <div style={{ width:42,height:42,borderRadius:14,background:'rgba(249,171,0,0.15)',border:'1px solid rgba(249,171,0,0.3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:20 }}>🔔</div>
                  <div>
                    <div style={{ fontFamily:T.fontDisplay, fontSize:17, fontWeight:800, color:'#fff', letterSpacing:'-0.3px' }}>Wanted Alerts</div>
                    <div style={{ fontSize:12, color:'rgba(255,255,255,0.45)', marginTop:1 }}>Get notified the moment a matching buyer posts a request</div>
                  </div>
                </div>
                <div style={{ display:'flex',gap:16,flexWrap:'wrap' }}>
                  {[
                    { icon:'⚡', text:'Instant notifications' },
                    { icon:'🎯', text:'Category & budget filters' },
                    { icon:'📍', text:'City-specific alerts' },
                  ].map(({icon,text})=>(
                    <div key={text} style={{ display:'flex',alignItems:'center',gap:5,fontSize:12,color:'rgba(255,255,255,0.6)',fontWeight:500 }}>
                      <span>{icon}</span>{text}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Create new alert */}
            <div className="lf-card" style={{ padding:20, marginBottom:20 }}>
              <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:18 }}>
                <div style={{ width:6,height:6,borderRadius:'50%',background:T.green,animation:'pulse 2s infinite' }} />
                <span style={{ fontFamily:T.fontDisplay, fontSize:15, fontWeight:800, color:T.gray900 }}>Create New Alert</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
                {/* Category */}
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:T.gray600, textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:5 }}>Category *</label>
                  <div style={{ position:'relative' }}>
                    <select className="lf-select" value={alertForm.category} onChange={e=>setAlertForm(f=>({...f,category:e.target.value}))}>
                      {CATEGORIES.filter(c=>c!=='All').map(c=><option key={c}>{c}</option>)}
                    </select>
                    <span style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:T.gray400 }}>{Icon.chevD(12)}</span>
                  </div>
                </div>
                {/* Cities */}
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:T.gray600, textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:5 }}>Cities (optional)</label>
                  <input className="lf-input" placeholder="Add city, press Enter…" value={alertCityInput}
                    onChange={e=>setAlertCityInput(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter'&&alertCityInput.trim()){ setAlertForm(f=>({...f,cities:[...new Set([...f.cities,alertCityInput.trim()])]})); setAlertCityInput('') }}} />
                  {alertForm.cities.length>0 && (
                    <div style={{ display:'flex',flexWrap:'wrap',gap:5,marginTop:6 }}>
                      {alertForm.cities.map(c=>(
                        <div key={c} style={{ display:'flex',alignItems:'center',gap:4,background:T.gray900,color:'#fff',borderRadius:50,padding:'3px 10px',fontSize:12,fontWeight:600 }}>
                          {c}
                          <button onClick={()=>setAlertForm(f=>({...f,cities:f.cities.filter(x=>x!==c)}))} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.6)',cursor:'pointer',display:'flex',alignItems:'center',padding:0 }}>{Icon.x(11)}</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {/* Budget range */}
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:T.gray600, textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:5 }}>Min Budget (MK)</label>
                  <input className="lf-input" type="number" placeholder="e.g. 50,000" value={alertForm.minBudget} onChange={e=>setAlertForm(f=>({...f,minBudget:e.target.value}))} />
                </div>
                <div>
                  <label style={{ fontSize:11, fontWeight:700, color:T.gray600, textTransform:'uppercase', letterSpacing:0.5, display:'block', marginBottom:5 }}>Max Budget (MK)</label>
                  <input className="lf-input" type="number" placeholder="e.g. 500,000" value={alertForm.maxBudget} onChange={e=>setAlertForm(f=>({...f,maxBudget:e.target.value}))} />
                </div>
              </div>
              {/* Notification prefs */}
              <div style={{ display:'flex',gap:14,margin:'14px 0',flexWrap:'wrap' }}>
                {[
                  { key:'notifyPush',  label:'In-app notification', icon:'📱' },
                  { key:'notifyEmail', label:'Email notification',   icon:'📧' },
                ].map(({key,label,icon})=>(
                  <label key={key} style={{ display:'flex',alignItems:'center',gap:8,cursor:'pointer',fontSize:13,fontWeight:600,color:T.gray800 }}>
                    <div onClick={()=>setAlertForm(f=>({...f,[key]:!f[key]}))}
                      style={{ width:38,height:22,borderRadius:50,background:alertForm[key]?T.green:T.gray200,position:'relative',cursor:'pointer',transition:'background 0.2s',flexShrink:0 }}>
                      <div style={{ position:'absolute',top:3,left:alertForm[key]?18:3,width:16,height:16,borderRadius:'50%',background:'#fff',boxShadow:'0 1px 3px rgba(0,0,0,0.2)',transition:'left 0.2s' }} />
                    </div>
                    {icon} {label}
                  </label>
                ))}
              </div>
              <button onClick={saveAlert} disabled={savingAlert} className="lf-btn-primary" style={{ width:'100%',padding:'12px',fontSize:14,borderRadius:12 }}>
                {savingAlert ? 'Saving…' : `${Icon.bell(14)} Create Alert for ${alertForm.category}`}
              </button>
            </div>

            {/* My active alerts */}
            {myAlerts.length>0 && (
              <div>
                <div style={{ fontFamily:T.fontDisplay, fontSize:14, fontWeight:800, color:T.gray900, marginBottom:12 }}>Your Active Alerts ({myAlerts.length})</div>
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {myAlerts.map(alert=>(
                    <div key={alert.id} className="lf-card" style={{ padding:'14px 16px', display:'flex', alignItems:'center', gap:14 }}>
                      <div style={{ width:44,height:44,borderRadius:14,background:T.greenL,display:'flex',alignItems:'center',justifyContent:'center',fontSize:20,flexShrink:0 }}>
                        {CAT_EMOJI[alert.category]||'🔔'}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontSize:14,fontWeight:700,color:T.gray900,marginBottom:3 }}>{alert.category}</div>
                        <div style={{ display:'flex',gap:10,flexWrap:'wrap',fontSize:11.5,color:T.gray600 }}>
                          {alert.cities?.length>0 && <span>{Icon.pin(11)} {alert.cities.slice(0,2).join(', ')}{alert.cities.length>2?` +${alert.cities.length-2}`:''}</span>}
                          {alert.min_budget && <span>Min: {fmtMWK(alert.min_budget)}</span>}
                          {alert.max_budget && <span>Max: {fmtMWK(alert.max_budget)}</span>}
                          {!alert.min_budget&&!alert.max_budget&&!alert.cities?.length && <span>Any budget · Nationwide</span>}
                        </div>
                        <div style={{ display:'flex',gap:6,marginTop:6 }}>
                          {alert.notify_push  && <span style={{ fontSize:10,fontWeight:700,color:T.green,background:T.greenL,borderRadius:50,padding:'2px 8px' }}>📱 In-app</span>}
                          {alert.notify_email && <span style={{ fontSize:10,fontWeight:700,color:T.blue,background:T.blueL,borderRadius:50,padding:'2px 8px' }}>📧 Email</span>}
                        </div>
                      </div>
                      <div style={{ display:'flex',gap:8,flexShrink:0 }}>
                        <div style={{ width:8,height:8,borderRadius:'50%',background:T.green,animation:'pulse 2s infinite',marginTop:2,alignSelf:'flex-start' }} />
                        <button onClick={()=>deleteAlert(alert.id)}
                          style={{ width:34,height:34,borderRadius:10,background:'#fef2f2',border:`1px solid #fecaca`,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',color:T.red }}>
                          {Icon.trash(14)}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {myAlerts.length===0 && (
              <div style={{ textAlign:'center',padding:'36px 24px',background:T.white,borderRadius:20,border:`1px dashed ${T.gray200}` }}>
                <div style={{ fontSize:40,marginBottom:10 }}>🔔</div>
                <div style={{ fontSize:15,fontWeight:700,color:T.gray900,marginBottom:5 }}>No alerts yet</div>
                <div style={{ fontSize:13,color:T.gray600 }}>Create your first alert above and never miss a matching buyer.</div>
              </div>
            )}
          </div>
        )}

        {/* ── REQUESTS FEED (non-alerts tabs) ── */}
        {activeTab!=='alerts' && (
          <>
            {/* Featured horizontal scroll */}
            {!loading && featuredReqs.length>0 && activeTab==='all' && (
              <div style={{ marginBottom:24 }}>
                <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:12 }}>
                  <div style={{ fontFamily:T.fontDisplay, fontSize:14, fontWeight:800, color:T.gray900 }}>Featured Requests</div>
                  <div style={{ fontSize:11,color:T.gray600 }}>{featuredReqs.length} urgent or active</div>
                </div>
                <div className="lf-scroll" style={{ display:'flex',gap:12,overflowX:'auto',paddingBottom:4 }}>
                  {featuredReqs.map(req=>(
                    <FeaturedCard key={req.id} req={req} user={user} myListings={myListings} onOffer={sendOffer} />
                  ))}
                </div>
              </div>
            )}

            {/* Recommended */}
            {recommendedReqs.length>0 && activeTab==='all' && (
              <div style={{ marginBottom:24 }}>
                <SectionLabel label="Recommended For You" sub="Based on your listings" />
                <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                  {recommendedReqs.map((req,i)=>(
                    <RequestCard key={req.id+'r'} req={req} user={user} myListings={myListings}
                      onOffer={sendOffer} onSave={toggleSave} onNotify={toggleNotify}
                      onFulfill={markFulfilled} onDelete={deleteRequest}
                      saved={savedIds.has(req.id)} notify={notifyIds.has(req.id)}
                      highlight delay={i*0.05} />
                  ))}
                </div>
                <Divider />
              </div>
            )}

            {/* Loading */}
            {(detectingViewer||loading) && (
              <div style={{ textAlign:'center',padding:'48px 0' }}>
                <div style={{ display:'inline-block',width:26,height:26,border:`2.5px solid ${T.gray200}`,borderTopColor:T.green,borderRadius:'50%',animation:'spin 0.7s linear infinite' }} />
                <div style={{ fontSize:13,color:T.gray600,marginTop:10 }}>{detectingViewer?'Detecting your location…':'Loading requests…'}</div>
              </div>
            )}

            {/* Empty states */}
            {!loading && !detectingViewer && tabReqs.length===0 && (
              <div style={{ textAlign:'center',padding:'52px 24px',background:T.white,borderRadius:20,border:`1px solid ${T.gray100}` }}>
                <div style={{ fontSize:44,marginBottom:12 }}>{activeTab==='saved'?'🤍':activeTab==='mine'?'📝':'🔍'}</div>
                <div style={{ fontFamily:T.fontDisplay,fontSize:16,fontWeight:700,color:T.gray900,marginBottom:6 }}>
                  {activeTab==='saved'?'No saved requests'
                    :activeTab==='mine'?'No requests from you yet'
                    :'No matching requests found'}
                </div>
                <div style={{ fontSize:13,color:T.gray600,marginBottom:18 }}>
                  {activeTab==='saved'?'Tap 🤍 on a request to save it here.'
                    :activeTab==='mine'?'Post your first request and let sellers come to you.'
                    :'Try different filters or be the first to post.'}
                </div>
                <button className="lf-btn-primary" onClick={openComposer}>
                  {Icon.plus(14)} Post Request
                </button>
              </div>
            )}

            {/* Main list */}
            {!loading && !detectingViewer && tabReqs.length>0 && (
              <div>
                {activeTab==='all' && (myReqs.length>0||recommendedReqs.length>0) && (
                  <SectionLabel label="All Requests" sub={`${otherReqs.length} in ${viewerCity||'your area'}`} />
                )}
                {activeTab==='mine' && <SectionLabel label="Your Requests" sub={`${myReqs.length} posted`} />}
                {activeTab==='saved' && <SectionLabel label="Saved Requests" sub={`${savedReqs.length} saved`} />}
                <div style={{ display:'flex',flexDirection:'column',gap:12 }}>
                  {tabReqs.map((req,i)=>(
                    <RequestCard key={req.id} req={req} user={user} myListings={myListings}
                      onOffer={sendOffer} onSave={toggleSave} onNotify={toggleNotify}
                      onFulfill={markFulfilled} onDelete={deleteRequest}
                      saved={savedIds.has(req.id)} notify={notifyIds.has(req.id)}
                      isOwn={req.user_id===user?.id}
                      delay={i*0.03} />
                  ))}
                </div>
              </div>
            )}

            {/* Trending demand */}
            {trendingDemand.length>0 && !loading && activeTab==='all' && (
              <div className="lf-card" style={{ padding:20, marginTop:24 }}>
                <SectionLabel label="Trending Demand" sub="Most requested categories right now" />
                <div style={{ display:'flex',flexDirection:'column',gap:8,marginTop:12 }}>
                  {trendingDemand.map(([cat,count],i)=>(
                    <div key={cat} onClick={()=>setCategory(cat)}
                      style={{ display:'flex',alignItems:'center',gap:12,cursor:'pointer',padding:'8px 0',borderBottom:i<trendingDemand.length-1?`1px solid ${T.gray100}`:'none' }}>
                      <div style={{ width:32,height:32,borderRadius:10,background:T.gray100,display:'flex',alignItems:'center',justifyContent:'center',fontSize:15,flexShrink:0 }}>{CAT_EMOJI[cat]||'📦'}</div>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:13.5,fontWeight:700,color:T.gray900 }}>{cat}</div>
                        <div style={{ fontSize:11,color:T.gray600 }}>{count} active requests</div>
                      </div>
                      <div style={{ width:64,height:5,borderRadius:50,background:T.gray100,overflow:'hidden' }}>
                        <div style={{ height:'100%',width:`${Math.min(100,(count/(trendingDemand[0][1]||1))*100)}%`,background:`linear-gradient(90deg,${T.green},${T.greenD})`,borderRadius:50,transition:'width 0.8s ease' }} />
                      </div>
                      <div style={{ fontSize:11,fontWeight:700,color:T.green,minWidth:24,textAlign:'right' }}>{count}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recently fulfilled */}
            {fulfilledReqs.length>0 && activeTab==='all' && (
              <div className="lf-card" style={{ padding:20, marginTop:16, marginBottom:24 }}>
                <SectionLabel label="Recently Fulfilled" sub="Successful transactions on SokoMW" />
                <div style={{ display:'flex',flexDirection:'column',gap:8,marginTop:12 }}>
                  {fulfilledReqs.map(r=>(
                    <div key={r.id} style={{ display:'flex',alignItems:'center',gap:12,padding:'8px 12px',background:T.greenL,borderRadius:12,border:`1px solid #d1fae5` }}>
                      <div style={{ width:28,height:28,borderRadius:'50%',background:T.green,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,color:'#fff',flexShrink:0 }}>✓</div>
                      <div style={{ flex:1,minWidth:0 }}>
                        <div style={{ fontSize:13,fontWeight:600,color:T.gray900,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>{r.title}</div>
                        <div style={{ fontSize:11,color:T.gray600 }}>{r.profiles?.full_name||'Buyer'} · {r.category}</div>
                      </div>
                      <div style={{ fontSize:10,fontWeight:800,color:T.green,background:'#d1fae5',borderRadius:50,padding:'2px 9px',flexShrink:0 }}>FULFILLED</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── POST REQUEST COMPOSER (bottom sheet) ── */}
      {composerOpen && <div onClick={()=>setComposerOpen(false)} style={{ position:'fixed',inset:0,zIndex:400,background:'rgba(0,0,0,0.45)',backdropFilter:'blur(4px)' }} />}
      <div style={{ position:'fixed',left:0,right:0,bottom:0,zIndex:401,transform:composerOpen?'translateY(0)':'translateY(110%)',transition:'transform 0.38s cubic-bezier(0.32,0.72,0,1)',background:T.white,borderRadius:'24px 24px 0 0',boxShadow:'0 -6px 40px rgba(0,0,0,0.18)',maxHeight:'92vh',overflowY:'auto' }}>
        <div style={{ display:'flex',justifyContent:'center',padding:'10px 0 2px' }}>
          <div style={{ width:36,height:4,borderRadius:2,background:T.gray200 }} />
        </div>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',padding:'8px 20px 14px',borderBottom:`1px solid ${T.gray100}` }}>
          <div style={{ fontFamily:T.fontDisplay, fontSize:16, fontWeight:800, color:T.gray900 }}>Post a Request</div>
          <button onClick={()=>setComposerOpen(false)} style={{ background:T.gray100,border:'none',borderRadius:'50%',width:30,height:30,cursor:'pointer',fontSize:14,color:T.gray600,display:'flex',alignItems:'center',justifyContent:'center' }}>{Icon.x(13)}</button>
        </div>
        <div style={{ padding:'16px 20px 32px' }}>
          {/* Image upload */}
          <div onClick={()=>fileRef.current?.click()} style={{ width:'100%',height:100,borderRadius:14,border:`1.5px dashed ${T.gray200}`,background:imagePreview?'transparent':T.gray50,display:'flex',alignItems:'center',justifyContent:'center',cursor:'pointer',marginBottom:16,overflow:'hidden',position:'relative' }}>
            {imagePreview
              ? <img src={imagePreview} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} />
              : <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:22,marginBottom:4 }}>📎</div>
                  <div style={{ fontSize:12.5,fontWeight:600,color:T.gray600 }}>Add reference photo</div>
                  <div style={{ fontSize:10.5,color:T.gray400,marginTop:2 }}>optional · tap to upload</div>
                </div>
            }
            {imagePreview && <button onClick={e=>{e.stopPropagation();setImageFile(null);setImagePreview(null)}} style={{ position:'absolute',top:8,right:8,background:'rgba(0,0,0,0.55)',border:'none',color:'#fff',width:24,height:24,borderRadius:'50%',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center' }}>{Icon.x(11)}</button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display:'none' }} onChange={e=>{ const f=e.target.files[0]; if(!f) return; setImageFile(f); setImagePreview(URL.createObjectURL(f)) }} />

          <ComposerField label="What are you looking for?">
            <input className="lf-input" placeholder="e.g. Second-hand Samsung A15" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))} />
          </ComposerField>

          <div style={{ display:'grid',gridTemplateColumns:'1fr 1fr',gap:12 }}>
            <ComposerField label="Budget (MK)">
              <input className="lf-input" type="number" placeholder="e.g. 150,000" value={form.budget} onChange={e=>setForm(f=>({...f,budget:e.target.value}))} />
            </ComposerField>
            <ComposerField label="Category">
              <div style={{ position:'relative' }}>
                <select className="lf-select" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                  {CATEGORIES.filter(c=>c!=='All').map(c=><option key={c}>{c}</option>)}
                </select>
                <span style={{ position:'absolute',right:12,top:'50%',transform:'translateY(-50%)',pointerEvents:'none',color:T.gray400 }}>{Icon.chevD(12)}</span>
              </div>
            </ComposerField>
          </div>

          <ComposerField label="How soon?">
            <div style={{ display:'flex',gap:8 }}>
              {URGENCY_OPTIONS.map(({value,label,color,bg,border})=>(
                <button key={value} onClick={()=>setForm(f=>({...f,urgency:value}))}
                  style={{ flex:1,background:form.urgency===value?bg:T.gray50,border:`1.5px solid ${form.urgency===value?border:T.gray200}`,borderRadius:10,padding:'9px 4px',fontSize:12.5,fontWeight:700,cursor:'pointer',color:form.urgency===value?color:T.gray400,transition:'all 0.15s' }}>
                  {label}
                </button>
              ))}
            </div>
          </ComposerField>

          <ComposerField label="Cities">
            {detectingCity && <div style={{ fontSize:11,color:T.green,marginBottom:6,fontWeight:600 }}>Detecting location…</div>}
            {selectedCities.length>0 && (
              <div style={{ display:'flex',flexWrap:'wrap',gap:6,marginBottom:8 }}>
                {selectedCities.map(city=>(
                  <div key={city} style={{ background:T.gray900,color:'#fff',borderRadius:50,padding:'4px 11px',fontSize:12,fontWeight:700,display:'flex',alignItems:'center',gap:5 }}>
                    {city}
                    <button onClick={()=>setSelectedCities(p=>p.filter(c=>c!==city))} style={{ background:'none',border:'none',color:'rgba(255,255,255,0.6)',cursor:'pointer',fontSize:14,padding:0,display:'flex',alignItems:'center' }}>{Icon.x(11)}</button>
                  </div>
                ))}
              </div>
            )}
            <input className="lf-input" placeholder="Search or type city…" value={citySearch} onChange={e=>setCitySearch(e.target.value)} />
            {citySearch.trim() && (
              <div style={{ background:T.white,border:`1px solid ${T.gray200}`,borderRadius:12,maxHeight:140,overflowY:'auto',marginTop:4,boxShadow:T.shadowMd }}>
                {[...dbCities.filter(c=>c.toLowerCase().includes(citySearch.toLowerCase())&&!selectedCities.includes(c)),
                  ...(!dbCities.some(c=>c.toLowerCase()===citySearch.toLowerCase())&&citySearch.trim()?[citySearch.trim()]:[])
                ].slice(0,6).map(city=>(
                  <div key={city} onClick={()=>{ setSelectedCities(p=>p.includes(city)?p:[...p,city]); setCitySearch('') }}
                    style={{ padding:'10px 14px',fontSize:13,cursor:'pointer',borderBottom:`1px solid ${T.gray50}`,color:T.gray900,fontWeight:500 }}>
                    {Icon.pin(12)} {city}
                  </div>
                ))}
              </div>
            )}
          </ComposerField>

          <ComposerField label="Description">
            <textarea className="lf-input" placeholder="Describe exactly what you need — brand, condition, specs…"
              value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))}
              rows={3} maxLength={300} style={{ resize:'none',lineHeight:1.6 }} />
          </ComposerField>

          <button onClick={handlePost} disabled={!form.title.trim()||posting}
            className="lf-btn-primary" style={{ width:'100%',padding:'13px',fontSize:14.5,borderRadius:14,opacity:form.title.trim()?1:0.5,justifyContent:'center' }}>
            {posting?'Posting…':'Post Request'}
          </button>
        </div>
      </div>

      {/* ── TOAST ── */}
      {toast && (
        <div style={{ position:'fixed',bottom:88,left:'50%',transform:'translateX(-50%)',background:toast.type==='error'?T.red:toast.type==='warning'?T.amber:T.gray900,color:'#fff',borderRadius:12,padding:'11px 22px',fontSize:13,fontWeight:700,zIndex:9999,whiteSpace:'nowrap',boxShadow:T.shadowLg,animation:'badgePop 0.2s ease' }}>
          {toast.msg}
        </div>
      )}

      <BottomNav />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────
   SUB-COMPONENTS
───────────────────────────────────────────────────────────── */
function SectionLabel({ label, sub }) {
  return (
    <div style={{ marginBottom:12 }}>
      <div style={{ fontFamily:T.fontDisplay, fontSize:14, fontWeight:800, color:T.gray900, letterSpacing:'-0.2px' }}>{label}</div>
      {sub && <div style={{ fontSize:11.5,color:T.gray600,marginTop:2 }}>{sub}</div>}
    </div>
  )
}

function ComposerField({ label, children }) {
  return (
    <div style={{ marginBottom:15 }}>
      <label style={{ fontSize:10.5,fontWeight:700,color:T.gray600,display:'block',marginBottom:5,textTransform:'uppercase',letterSpacing:0.5 }}>{label}</label>
      {children}
    </div>
  )
}

function Divider() {
  return <div style={{ height:1, background:T.gray100, margin:'20px 0' }} />
}

/* ── Featured horizontal card ── */
function FeaturedCard({ req, user, myListings, onOffer }) {
  const isOwn   = req.user_id===user?.id
  const demand  = getDemandLevel(req)
  const match   = !isOwn ? getMatchScore(req,myListings) : null
  const urgOpt  = URGENCY_OPTIONS.find(u=>u.value===req.urgency)
  const [hov,setHov] = useState(false)

  return (
    <div onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
      style={{ flexShrink:0,width:220,background:T.white,borderRadius:18,border:`1px solid ${hov?T.gray200:T.gray100}`,overflow:'hidden',boxShadow:hov?T.shadowMd:T.shadow,transform:hov?'translateY(-4px) scale(1.01)':'none',transition:'all 0.22s cubic-bezier(0.34,1.2,0.64,1)' }}>
      {req.image_url && <img src={req.image_url} alt="" style={{ width:'100%',height:96,objectFit:'cover' }} />}
      <div style={{ padding:'12px' }}>
        <div style={{ display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:7 }}>
          <span style={{ fontSize:10,fontWeight:800,color:demand.color,background:demand.bg,borderRadius:50,padding:'2px 9px' }}>{demand.label}</span>
          {match && <span style={{ fontSize:10,fontWeight:800,color:T.green,background:T.greenL,borderRadius:50,padding:'2px 9px' }}>{match}% match</span>}
        </div>
        <div style={{ fontSize:13.5,fontWeight:700,color:T.gray900,marginBottom:5,display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical',overflow:'hidden',lineHeight:1.3 }}>{req.title}</div>
        {req.budget && <div style={{ fontSize:13,fontWeight:800,color:T.green,marginBottom:6 }}>{fmtMWK(req.budget)}</div>}
        <div style={{ display:'flex',alignItems:'center',gap:8,fontSize:11,color:T.gray600,marginBottom:9 }}>
          <span>💬 {req.offer_count||0}</span>
          <span>👁 {req.view_count||0}</span>
          {urgOpt&&req.urgency!=='flexible' && <span style={{ color:urgOpt.color,fontWeight:700 }}>{urgOpt.label}</span>}
        </div>
        {!isOwn && (
          <button onClick={()=>onOffer(req)} className="lf-btn-primary" style={{ width:'100%',padding:'8px',fontSize:12.5,borderRadius:9,justifyContent:'center' }}>
            Send Offer
          </button>
        )}
      </div>
    </div>
  )
}

/* ── Full request card ── */
function RequestCard({ req, user, myListings, onOffer, onSave, onNotify, onFulfill, onDelete, saved, notify, isOwn:forcedOwn, highlight, delay=0 }) {
  const isOwn   = forcedOwn||req.user_id===user?.id
  const name    = req.profiles?.full_name||'Buyer'
  const avatar  = req.profiles?.avatar_url
  const initial = name[0]?.toUpperCase()||'B'
  const demand  = getDemandLevel(req)
  const match   = !isOwn ? getMatchScore(req,myListings) : null
  const urgOpt  = URGENCY_OPTIONS.find(u=>u.value===req.urgency)
  const [expanded,setExpanded] = useState(false)

  return (
    <div className="lf-card" style={{ borderColor:highlight?'#d1fae5':'',animation:`fadeUp 0.35s ease ${delay}s both` }}>
      {req.image_url && <img src={req.image_url} alt="" style={{ width:'100%',height:160,objectFit:'cover',borderRadius:'20px 20px 0 0' }} />}
      <div style={{ padding:'16px' }}>
        {/* Row 1: avatar + name */}
        <div style={{ display:'flex',alignItems:'center',gap:10,marginBottom:12 }}>
          <div style={{ width:36,height:36,borderRadius:'50%',background:avatar?'transparent':T.gray900,overflow:'hidden',flexShrink:0,display:'flex',alignItems:'center',justifyContent:'center',fontSize:13,fontWeight:800,color:'#fff',border:`2px solid ${T.gray200}` }}>
            {avatar?<img src={avatar} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} />:initial}
          </div>
          <div style={{ flex:1,minWidth:0 }}>
            <div style={{ fontSize:13.5,fontWeight:700,color:T.gray900 }}>{isOwn?'You':name}</div>
            <div style={{ fontSize:11,color:T.gray600 }}>{timeAgo(req.created_at)} · <span style={{ background:T.gray100,borderRadius:50,padding:'1px 7px',fontWeight:600 }}>{req.category}</span></div>
          </div>
          {match!==null && (
            <div style={{ background:match>=80?T.greenL:'#fffbeb',border:`1px solid ${match>=80?'#a7f3d0':'#fde68a'}`,borderRadius:10,padding:'5px 11px',textAlign:'center',flexShrink:0 }}>
              <div style={{ fontFamily:T.fontDisplay, fontSize:15,fontWeight:800,color:match>=80?T.green:T.amber,lineHeight:1 }}>{match}%</div>
              <div style={{ fontSize:9,color:match>=80?T.green:T.amber,fontWeight:800,letterSpacing:0.5 }}>MATCH</div>
            </div>
          )}
        </div>

        {/* Title */}
        <div style={{ fontFamily:T.fontDisplay, fontSize:18,fontWeight:800,color:T.gray900,marginBottom:req.description?6:10,lineHeight:1.25,letterSpacing:'-0.4px' }}>
          {req.title}
        </div>

        {/* Description */}
        {req.description && (
          <div style={{ fontSize:13.5,color:'#475569',lineHeight:1.65,marginBottom:12 }}>
            {expanded||req.description.length<=100 ? req.description : req.description.slice(0,100)+'…'}
            {req.description.length>100 && <button onClick={()=>setExpanded(!expanded)} style={{ background:'none',border:'none',color:T.green,fontSize:12.5,fontWeight:700,cursor:'pointer',padding:'0 0 0 4px' }}>{expanded?'less':'more'}</button>}
          </div>
        )}

        {/* Info chips */}
        <div style={{ display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:8,marginBottom:12 }}>
          {req.budget && (
            <InfoChip label="Budget" color={T.amber} bg="#fffbeb">
              <span style={{ fontSize:14,fontWeight:800,color:T.gray900 }}>{fmtMWK(req.budget)}</span>
            </InfoChip>
          )}
          {(req.cities?.length>0||req.city) && (
            <InfoChip label="Location" color={T.blue} bg={T.blueL}>
              <span style={{ fontSize:12,fontWeight:700,color:T.gray900,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',display:'block' }}>{req.cities?.length>0?req.cities.join(', '):req.city}</span>
            </InfoChip>
          )}
          {urgOpt && (
            <InfoChip label="Need By" color={urgOpt.color} bg={urgOpt.bg} border={urgOpt.border}>
              <span style={{ fontSize:12,fontWeight:700,color:urgOpt.color }}>{urgOpt.label}</span>
            </InfoChip>
          )}
        </div>

        {/* Demand + stats */}
        <div style={{ display:'flex',alignItems:'center',gap:8,marginBottom:14,flexWrap:'wrap' }}>
          <div style={{ display:'flex',alignItems:'center',gap:5 }}>
            <div style={{ width:6,height:6,borderRadius:'50%',background:demand.dot,animation:'pulse 2s infinite' }} />
            <span style={{ fontSize:11.5,fontWeight:700,color:demand.color }}>{demand.label}</span>
          </div>
          <span style={{ color:T.gray200 }}>·</span>
          <span style={{ fontSize:11.5,color:T.gray600 }}>💬 {req.offer_count||0} {(req.offer_count||0)===1?'offer':'offers'}</span>
          <span style={{ color:T.gray200 }}>·</span>
          <span style={{ fontSize:11.5,color:T.gray600 }}>👁 {req.view_count||0}</span>
          {(req.offer_count||0)===0&&!isOwn && <span style={{ marginLeft:'auto',fontSize:11.5,color:T.green,fontWeight:700 }}>{Icon.lightning(12)} Be first to offer</span>}
        </div>

        {/* Actions */}
        {isOwn ? (
          <div style={{ display:'flex',gap:8 }}>
            <button onClick={()=>onFulfill(req.id)} className="lf-btn-secondary" style={{ flex:1,justifyContent:'center',fontSize:12.5 }}>
              {Icon.check(13)} Mark Fulfilled
            </button>
            <button onClick={()=>onDelete(req.id)} style={{ flex:1,background:'#fff',border:`1.5px solid #fecaca`,borderRadius:12,padding:'10px',fontSize:12.5,fontWeight:700,color:T.red,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',gap:5 }}>
              {Icon.trash(13)} Delete
            </button>
          </div>
        ) : (
          <div style={{ display:'flex',gap:8 }}>
            <button onClick={()=>onOffer(req)} className="lf-btn-primary" style={{ flex:1,justifyContent:'center',fontSize:13.5,padding:'11px' }}>
              Send Offer
            </button>
            <button onClick={()=>onSave(req.id)} style={{ width:40,height:40,background:saved?'#fef2f2':T.gray50,border:`1.5px solid ${saved?'#fecaca':T.gray200}`,borderRadius:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s',flexShrink:0 }}>
              {saved ? Icon.heart(15,T.red) : Icon.heart(15)}
            </button>
            <button onClick={()=>onNotify(req.id)} title={notify?'Turn off':'Notify me of similar'} style={{ width:40,height:40,background:notify?T.greenL:T.gray50,border:`1.5px solid ${notify?'#a7f3d0':T.gray200}`,borderRadius:10,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s',flexShrink:0 }}>
              <span style={{ fontSize:16 }}>{notify?'🔔':'🔕'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function InfoChip({ label, color, bg, border, children }) {
  return (
    <div style={{ background:bg, borderRadius:10, padding:'8px 10px', border:border?`1px solid ${border}`:'none' }}>
      <div style={{ fontSize:9,fontWeight:800,color,textTransform:'uppercase',letterSpacing:0.5,marginBottom:3 }}>{label}</div>
      {children}
    </div>
  )
}