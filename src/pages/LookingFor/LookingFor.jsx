import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import BottomNav from '../../components/BottomNav'
import RequestComposer from '../../components/LookingFor/RequestComposer'
import { Toast, Spinner } from '../../components/LookingFor/Primitives'
import { getGPSCity, getDBCities, getMatchScore, fmtMWK } from '../../utils/lookingFor'
import { CATEGORIES, URGENCY_OPTIONS } from '../../constants/lookingFor'
import { getDemandLevel, timeAgo } from '../../utils/lookingFor'

/* ── colour tokens (dark theme) ── */
const C = {
  bg:       '#0f0f1a',
  surface:  '#1a1a2e',
  border:   '#2a2a3e',
  green:    '#22c55e',
  greenDk:  '#16a34a',
  red:      '#e53e3e',
  amber:    '#d97706',
  white:    '#ffffff',
  gray1:    '#aaaaaa',
  gray2:    '#888888',
  gray3:    '#666666',
  text:     '#ffffff',
  textSub:  '#dddddd',
}

const CAT_ICONS = {
  All:'📋', Electronics:'📱', Services:'🔧', Jobs:'💼',
  Vehicles:'🚗', Fashion:'👗', Food:'🍱', Property:'🏠', Agriculture:'🌱',
}

const MALAWI_DISTRICTS = ['Blantyre','Lilongwe','Mzuzu','Zomba','Dedza','Kasungu','Mangochi','Salima','Karonga','Nkhata Bay']

/* ══════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════ */
export default function LookingFor() {
  const navigate  = useNavigate()
  const location  = useLocation()

  /* ── auth / user ── */
  const [user,          setUser]          = useState(null)
  const [myListings,    setMyListings]    = useState([])

  /* ── data ── */
  const [requests,      setRequests]      = useState([])
  const [stats,         setStats]         = useState(null)
  const [allCategories, setAllCategories] = useState(new Set())
  const [loading,       setLoading]       = useState(true)

  /* ── filters ── */
  const [search,          setSearch]          = useState('')
  const [headerSearch,    setHeaderSearch]     = useState('')
  const [category,        setCategory]        = useState('All')
  const [sortBy,          setSortBy]          = useState('recent')
  const [locationFilter,  setLocationFilter]  = useState('All Locations')
  const [district,        setDistrict]        = useState('All Districts')
  const [budgetMin,       setBudgetMin]       = useState('')
  const [budgetMax,       setBudgetMax]       = useState('')
  const [rangeValue,      setRangeValue]      = useState(50)
  const [moreFiltersOpen, setMoreFiltersOpen] = useState(false)

  /* ── location ── */
  const [viewerCity,      setViewerCity]      = useState(null)
  const [detectingViewer, setDetectingViewer] = useState(true)
  const [dbCities,        setDbCities]        = useState([])

  /* ── UI state ── */
  const [activeTab,     setActiveTab]     = useState('all')
  const [savedIds, setSavedIds] = useState(() => {
    try {
      const stored = localStorage.getItem('soko_saved_requests')
      return stored ? new Set(JSON.parse(stored)) : new Set()
    } catch { return new Set() }
  })
  const [toast,         setToast]         = useState(null)
  const [detailReq,     setDetailReq]     = useState(null)  // View Details modal
  const [myAlerts,      setMyAlerts]      = useState([])
const [alertsOpen,    setAlertsOpen]    = useState(false)
const [alertTab,      setAlertTab]      = useState(0)
const [newNotifCount, setNewNotifCount] = useState(0)
const [notifications, setNotifications] = useState([])
const myAlertsRef = useRef([])

  /* ── composer ── */
  const [composerOpen,  setComposerOpen]  = useState(false)
  const [form,          setForm]          = useState({ title:'', category:'Electronics', budget:'', description:'', urgency:'flexible' })
  const [images,        setImages]        = useState([])   // [{ file, preview }]
  const [coverIndex,    setCoverIndex]    = useState(0)
  const [selectedCities,setSelectedCities]= useState([])
  const [citySearch,    setCitySearch]    = useState('')
  const [detectingCity, setDetectingCity] = useState(false)
  const [posting,       setPosting]       = useState(false)

  /* ── boot ── */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate('/login'); return }
      supabase.from('profiles').select('full_name,avatar_url,city').eq('id', user.id).maybeSingle()
        .then(async ({ data }) => {
          setUser({ ...user, ...(data || {}) })
          const gpsCity = await getGPSCity()
          setViewerCity(gpsCity)
          setDetectingViewer(false)
          const { data: listings } = await supabase.from('listings')
            .select('id,title,category,price,city').eq('seller_id', user.id).eq('status','active')
          setMyListings(listings || [])
          loadAlerts(user.id)
        })
    })
    if (location.state?.openComposer) handleOpenComposer()
  }, [])

  useEffect(() => {
    if (!detectingViewer && user) { loadRequests(); loadStats() }
  }, [category, detectingViewer, viewerCity, sortBy, budgetMin, budgetMax, locationFilter, district, search, headerSearch, user])

  /* ── data loaders ── */
  async function loadStats() {
    const { data } = await supabase.from('buyer_requests')
      .select('category,budget,offer_count,created_at').neq('status','fulfilled')
    if (!data) return
    const today = new Date(); today.setHours(0,0,0,0)
    const byCat = {}
    data.forEach(r => { byCat[r.category] = (byCat[r.category]||0)+1 })
    setAllCategories(new Set(Object.keys(byCat)))
    setStats({
      total: data.length,
      totalBudget: data.reduce((s,r) => s+(r.budget||0), 0),
      newToday: data.filter(r => new Date(r.created_at) >= today).length,
      byCat,
    })
  }

  async function loadRequests() {
    setLoading(true)
    let q = supabase.from('buyer_requests')
      .select('id,title,category,budget,description,urgency,status,cities,city,detected_city,image_url,image_urls,offer_count,view_count,created_at,user_id,profiles:user_id(full_name,avatar_url)')
      .neq('status','fulfilled').limit(80)
    if (category !== 'All') q = q.eq('category', category)
    if (sortBy === 'budget')  q = q.order('budget',      { ascending: false, nullsFirst: false })
    else if (sortBy === 'demand') q = q.order('offer_count', { ascending: false })
    else if (sortBy === 'urgent') q = q.order('urgency',     { ascending: true })
    else q = q.order('created_at', { ascending: false })
    const { data, error } = await q
    if (!error) {
      let filtered = data || []
      const combinedSearch = (search || headerSearch).trim().toLowerCase()
      if (combinedSearch) filtered = filtered.filter(r =>
        r.title?.toLowerCase().includes(combinedSearch) || r.description?.toLowerCase().includes(combinedSearch))
      if (budgetMin) filtered = filtered.filter(r => (r.budget||0) >= Number(budgetMin))
      if (budgetMax) filtered = filtered.filter(r => (r.budget||0) <= Number(budgetMax))
      if (locationFilter !== 'All Locations') filtered = filtered.filter(r => {
        const cities = r.cities?.length > 0 ? r.cities : (r.city ? [r.city] : [])
        return cities.some(c => c.toLowerCase() === locationFilter.toLowerCase())
      })
      if (district !== 'All Districts') filtered = filtered.filter(r => {
        const cities = r.cities?.length > 0 ? r.cities : (r.city ? [r.city] : [])
        return cities.some(c => c.toLowerCase() === district.toLowerCase())
      })
      console.log('viewerCity:', viewerCity, '| raw data:', data?.length, '| after filter:', filtered.length)
      // Mark which requests this user already offered on
      const { data: myOffers } = await supabase.from('buyer_request_offers')
        .select('request_id').eq('seller_id', user?.id ?? '')
      const offeredIds = new Set((myOffers || []).map(o => o.request_id))
      setRequests(filtered.map(r => ({ ...r, user_has_offered: offeredIds.has(r.id) })))
    }
    setLoading(false)
  }

  async function loadAlerts(uid) {
    const { data } = await supabase.from('wanted_alerts').select('*').eq('user_id', uid).eq('active', true)
    setMyAlerts(data || [])
    myAlertsRef.current = data || []
  }

  async function subscribeToCategory(cat, opts = {}) {
    const exists = myAlerts.find(a => a.category === cat)
    if (exists) {
      await supabase.from('wanted_alerts').delete().eq('id', exists.id)
      setMyAlerts(prev => prev.filter(a => a.id !== exists.id))
      showToast(`Alert removed for ${cat}`, 'success')
      return
    }
    const { data, error } = await supabase.from('wanted_alerts').insert({
      user_id: user.id,
      category: cat,
      active: true,
      keywords: opts.keywords || [],
      budget_min: opts.budgetMin || null,
      budget_max: opts.budgetMax || null,
      district: opts.district || null,
    }).select().single()
    if (!error && data) {
      setMyAlerts(prev => [...prev, data])
      showToast(`🔔 You'll be notified for new "${cat}" requests!`, 'success')
    }
  }

  useEffect(() => {
    if (!user) return
    const channel = supabase
      .channel('new-buyer-requests')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'buyer_requests',
      }, payload => {
        const req = payload.new
        if (req.user_id === user.id) return
        const alerts = myAlertsRef.current
        const match = alerts.find(a =>
          a.active && (a.category === 'All' || a.category === req.category)
        )
        if (match) {
          const notif = {
            id: req.id,
            title: req.title,
            category: req.category,
            budget: req.budget,
            city: req.city,
            created_at: req.created_at,
            read: false,
          }
          setNewNotifCount(n => n + 1)
          setNotifications(prev => [notif, ...prev])
          setToast({ msg: `🔔 New "${req.category}" request: ${req.title}`, type: 'success' })
          setTimeout(() => setToast(null), 5000)
          setRequests(prev => [{ ...req, user_has_offered: false }, ...prev])
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user])

  /* ── composer open ── */
  async function handleOpenComposer() {
    setComposerOpen(true)
    const cities = await getDBCities(supabase); setDbCities(cities)
    if (selectedCities.length === 0 && viewerCity) {
      setSelectedCities([viewerCity])
      if (!cities.includes(viewerCity)) setDbCities(prev => [viewerCity, ...prev])
    }
  }

  /* ── post request ── */
  async function handlePost() {
    if (!form.title.trim()) return
    setPosting(true)
    let image_url = null
    let image_urls = []
    if (images.length > 0) {
      for (const img of images) {
        try {
          const ext = img.file.name.split('.').pop().toLowerCase()
          const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
          console.log('Uploading:', path, img.file.type, img.file.size)
          const { data: upData, error: upErr } = await supabase.storage
            .from('buyer-requests')
            .upload(path, img.file, { contentType: img.file.type, upsert: false })
          if (upErr) {
            console.error('Upload error:', upErr.message, upErr)
            showToast(`Image upload failed: ${upErr.message}`, 'error')
            setPosting(false)
            return
          }
          const { data: urlData } = supabase.storage.from('buyer-requests').getPublicUrl(path)
          console.log('Uploaded URL:', urlData.publicUrl)
          image_urls.push(urlData.publicUrl)
        } catch (e) {
          console.error('Upload exception:', e)
          showToast('Image upload error', 'error')
          setPosting(false)
          return
        }
      }
      image_url = image_urls[coverIndex] ?? image_urls[0] ?? null
    }
    const { error } = await supabase.from('buyer_requests').insert({
      user_id: user.id, title: form.title.trim(), category: form.category,
      budget: form.budget ? Number(form.budget) : null,
      city: selectedCities[0] || viewerCity || null,
      cities: selectedCities.length > 0 ? selectedCities : (viewerCity ? [viewerCity] : []),
      detected_city: viewerCity || null,
      description: form.description.trim() || null,
      urgency: form.urgency, image_url, image_urls, status: 'open', offer_count: 0, view_count: 0,
    })
    setPosting(false)
    if (error) { showToast(`Failed: ${error.message}`, 'error'); console.error('Post error:', error); return }
    showToast('Request posted!', 'success')
    setForm({ title:'', category:'Electronics', budget:'', description:'', urgency:'flexible' })
    setImages([]); setCoverIndex(0); setSelectedCities([])
    setComposerOpen(false)
    loadRequests(); loadStats()
  }

  /* ── send offer ── */
  async function sendOffer(req) {
    await supabase.rpc('increment_view_count', { request_id: req.id })
    const { data: myL } = await supabase.from('listings').select('id').eq('seller_id', user.id).eq('status','active').limit(1)
    const msg = `Hi, I can help with your request: "${req.title}"${req.budget ? `\nBudget: ${fmtMWK(req.budget)}` : ''}${req.city ? `\nLocation: ${req.city}` : ''}\n\nI have exactly what you need. Let's discuss!`
    // Track offer — ON CONFLICT DO NOTHING prevents duplicate counting
    const { error: offerErr } = await supabase.from('buyer_request_offers')
      .insert({ request_id: req.id, seller_id: user.id })
    
    console.log('Offer insert result:', offerErr?.message || 'success')
    
    if (!offerErr) {
      // New unique offer — increment count via RLS-bypassing function
      const { error: updateErr } = await supabase.rpc('increment_offer_count', { request_id: req.id })
      console.log('Count update:', updateErr?.message || 'success')
      setRequests(prev => prev.map(r =>
        r.id === req.id
          ? { ...r, offer_count: (r.offer_count || 0) + 1, user_has_offered: true }
          : r
      ))
    } else if (offerErr.code === '23505') {
      // Duplicate — already offered, just mark UI
      setRequests(prev => prev.map(r =>
        r.id === req.id ? { ...r, user_has_offered: true } : r
      ))
    } else {
      console.error('Offer error:', offerErr.message)
    }
    // Navigate to chat — use listing if available, else use request id as context
    const chatPath = myL?.length
      ? `/chat/${req.user_id}/${myL[0].id}`
      : `/chat/${req.user_id}/${req.id}`
    navigate(chatPath, { state: { prefillMessage: msg, isRequest: true } })
  }

  /* ── mark fulfilled ── */
  async function markFulfilled(id) {
    await supabase.from('buyer_requests').update({ status:'fulfilled' }).eq('id', id)
    setRequests(prev => prev.filter(r => r.id !== id))
    showToast('Marked as fulfilled', 'success')
  }

  /* ── delete ── */
  async function deleteRequest(id) {
    await supabase.from('buyer_requests').delete().eq('id', id)
    setRequests(prev => prev.filter(r => r.id !== id))
    showToast('Request deleted', 'success')
  }

  /* ── bookmark (local) ── */
  function toggleSave(id) {
    const wasSaved = savedIds.has(id)
    setSavedIds(prev => {
      const n = new Set(prev)
      wasSaved ? n.delete(id) : n.add(id)
      try { localStorage.setItem('soko_saved_requests', JSON.stringify([...n])) } catch {}
      return n
    })
    showToast(wasSaved ? 'Removed from saved' : 'Saved!', 'success')
  }

  /* ── clear all filters ── */
  function clearFilters() {
    setCategory('All'); setBudgetMin(''); setBudgetMax('')
    setLocationFilter('All Locations'); setDistrict('All Districts')
    setSearch(''); setHeaderSearch('')
    setTimeout(loadRequests, 0)
  }

  function showToast(msg, type='success') { setToast({ msg, type }); setTimeout(() => setToast(null), 2800) }

  /* ── derived lists ── */
  const allReqs   = requests
  const myReqs    = allReqs.filter(r => r.user_id === user?.id)
  const otherReqs = allReqs.filter(r => r.user_id !== user?.id)
  const savedReqs = allReqs.filter(r => savedIds.has(r.id))
  const tabReqs   = activeTab === 'mine' ? myReqs : activeTab === 'saved' ? savedReqs : otherReqs

  const visibleCats    = ['All', ...CATEGORIES.filter(c => c !== 'All' && allCategories.has(c))]
  const malawCities    = [...new Set(requests.flatMap(r => r.cities?.length > 0 ? r.cities : (r.city ? [r.city] : [])))]

  /* ══════ RENDER ══════ */
  return (
    <div style={{ minHeight:'100vh', background: C.bg, color: C.text, fontFamily:"'Inter',sans-serif", paddingBottom: 80 }}>

      {/* ── TOP NAVBAR ── */}
      <nav style={{ background: C.bg, borderBottom:`1px solid ${C.border}`, padding:'0 24px', height:60, display:'flex', alignItems:'center', gap:16, position:'sticky', top:0, zIndex:100 }}>
        {/* Logo */}
        <div style={{ fontWeight:800, fontSize:22, letterSpacing:-0.5, marginRight:8, cursor:'pointer' }} onClick={() => navigate('/')}>
          <span style={{ color:'#22c55e' }}>Soko</span>
          <span style={{ color:'#f59e0b' }}>Mw</span>
        </div>

        {/* District Dropdown */}
        <div style={{ display:'flex', alignItems:'center', gap:6, background: C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:'6px 12px', fontSize:13, color:'#ddd' }}>
          <span>📍</span>
          <select value={district} onChange={e => setDistrict(e.target.value)}
            style={{ background:'transparent', border:'none', color:'#ddd', fontSize:13, cursor:'pointer', outline:'none' }}>
            <option>All Districts</option>
            {MALAWI_DISTRICTS.map(d => <option key={d}>{d}</option>)}
          </select>
          <span style={{ color: C.gray2 }}>▾</span>
        </div>

        {/* Header Search */}
        <div style={{ flex:1, display:'flex', alignItems:'center', background: C.surface, border:`1px solid ${C.border}`, borderRadius:8, padding:'0 14px', height:40, gap:8 }}>
          <span style={{ color: C.gray2 }}>🔍</span>
          <input value={headerSearch} onChange={e => setHeaderSearch(e.target.value)}
            placeholder="Search for requests..."
            style={{ flex:1, background:'transparent', border:'none', outline:'none', color: C.white, fontSize:14 }} />
          {headerSearch && (
            <span style={{ color: C.gray2, cursor:'pointer', fontSize:16 }} onClick={() => setHeaderSearch('')}>×</span>
          )}
        </div>

        {/* Right icons */}
        <div style={{ display:'flex', alignItems:'center', gap:20, marginLeft:8, position:'relative' }}>
          <div style={{ textAlign:'center', cursor:'pointer' }} onClick={() => navigate('/chat')}>
            <div style={{ fontSize:20 }}>💬</div>
            <div style={{ fontSize:10, color: C.gray1 }}>Chats</div>
          </div>
          <div style={{ textAlign:'center', cursor:'pointer', position:'relative' }} onClick={() => setAlertsOpen(p => !p)}>
            <div style={{ fontSize:20 }}>🔔</div>
            {newNotifCount > 0 && (
              <span style={{ position:'absolute', top:-4, right:-6, background: C.red, color:'#fff', borderRadius:'50%', width:18, height:18, fontSize:10, display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700 }}>
                {newNotifCount}
              </span>
            )}
            <div style={{ fontSize:10, color: C.gray1, marginTop:2 }}>Alerts</div>
          </div>
          {alertsOpen && (
            <div style={{ position:'absolute', top:64, right:0, background:'#1a1a2e', border:`1px solid ${C.border}`, borderRadius:14, width:340, zIndex:200, boxShadow:'0 8px 32px rgba(0,0,0,0.5)', overflow:'hidden' }}>

              {/* Tabs */}
              <div style={{ display:'flex', borderBottom:`1px solid ${C.border}` }}>
                {['Notifications','Subscriptions'].map((tab, i) => (
                  <button key={tab} onClick={() => setAlertTab(i)}
                    style={{ flex:1, padding:'14px 0', background: alertTab===i ? '#1a2a1a' : 'transparent', border:'none', borderBottom: alertTab===i ? `2px solid ${C.green}` : '2px solid transparent', color: alertTab===i ? C.green : '#888', fontWeight: alertTab===i ? 700 : 500, fontSize:13, cursor:'pointer' }}>
                    {tab}
                    {i===0 && newNotifCount > 0 && (
                      <span style={{ marginLeft:6, background:C.red, color:'#fff', borderRadius:50, padding:'1px 6px', fontSize:10, fontWeight:800 }}>{newNotifCount}</span>
                    )}
                  </button>
                ))}
                <button onClick={() => setAlertsOpen(false)} style={{ background:'none', border:'none', color:'#888', fontSize:18, cursor:'pointer', padding:'0 14px' }}>×</button>
              </div>

              {/* Notifications tab */}
              {alertTab === 0 && (
                <div style={{ maxHeight:400, overflowY:'auto' }}>
                  {notifications.length === 0 ? (
                    <div style={{ padding:'32px 20px', textAlign:'center' }}>
                      <div style={{ fontSize:32, marginBottom:8 }}>🔔</div>
                      <div style={{ fontSize:13, color:'#888' }}>No notifications yet.</div>
                      <div style={{ fontSize:12, color:'#555', marginTop:4 }}>Subscribe to categories to get alerts.</div>
                    </div>
                  ) : (
                    <>
                      {notifications.map((n, i) => (
                        <div key={n.id + i}
                          onClick={() => {
                            setNotifications(prev => prev.map((x, xi) => xi===i ? {...x, read:true} : x))
                            setNewNotifCount(c => Math.max(0, c - 1))
                            setAlertsOpen(false)
                            const full = requests.find(r => r.id === n.id)
                            setDetailReq(full || { ...n, profiles: null })
                          }}
                          style={{ display:'flex', gap:12, padding:'14px 16px', borderBottom:`1px solid ${C.border}`, cursor:'pointer', background: n.read ? 'transparent' : 'rgba(34,197,94,0.05)' }}
                          onMouseEnter={e => e.currentTarget.style.background='rgba(255,255,255,0.04)'}
                          onMouseLeave={e => e.currentTarget.style.background= n.read ? 'transparent' : 'rgba(34,197,94,0.05)'}>
                          <div style={{ width:38, height:38, borderRadius:10, background:'#0f0f1a', border:`1px solid ${C.border}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>
                            {CAT_ICONS[n.category] || '📋'}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight: n.read ? 500 : 700, color:'#fff', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                              {n.title}
                            </div>
                            <div style={{ fontSize:11, color:'#888', marginTop:2 }}>
                              {n.category} · {n.city || 'Malawi'}{n.budget ? ` · MK ${Number(n.budget).toLocaleString()}` : ''}
                            </div>
                            <div style={{ fontSize:10, color:'#555', marginTop:2 }}>{timeAgo(n.created_at)}</div>
                          </div>
                          {!n.read && <div style={{ width:8, height:8, borderRadius:'50%', background:C.green, flexShrink:0, marginTop:6 }} />}
                        </div>
                      ))}
                      <button onClick={() => { setNotifications([]); setNewNotifCount(0) }}
                        style={{ width:'100%', padding:'10px 0', background:'transparent', border:'none', borderTop:`1px solid ${C.border}`, color:'#555', fontSize:12, cursor:'pointer' }}>
                        Clear all notifications
                      </button>
                    </>
                  )}
                </div>
              )}

              {/* Subscriptions tab */}
              {alertTab === 1 && (
                <div style={{ padding:16, maxHeight:400, overflowY:'auto' }}>
                  <div style={{ fontSize:12, color:'#888', marginBottom:12 }}>Get notified when new requests are posted in these categories.</div>
                  {['All', ...CATEGORIES.filter(c => c !== 'All')].map(cat => {
                    const active = myAlerts.some(a => a.category === cat)
                    return (
                      <div key={cat} onClick={() => subscribeToCategory(cat)}
                        style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'9px 12px', borderRadius:8, marginBottom:6, background: active ? '#1a2a1a' : '#0f0f1a', border:`1px solid ${active ? C.green : C.border}`, cursor:'pointer' }}>
                        <span style={{ fontSize:13, color: active ? '#fff' : '#aaa', fontWeight: active ? 700 : 400 }}>
                          {CAT_ICONS[cat] || '📋'} {cat === 'All' ? 'All Categories' : cat}
                        </span>
                        <span style={{ fontSize:11, fontWeight:800, color: active ? C.green : '#555' }}>
                          {active ? '✓ ON' : '+ Subscribe'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          <button onClick={handleOpenComposer}
            style={{ background: C.greenDk, color:'#fff', border:'none', borderRadius:8, padding:'8px 18px', fontWeight:700, fontSize:14, cursor:'pointer', display:'flex', alignItems:'center', gap:6 }}>
            + Post Request
          </button>
          <div style={{ width:38, height:38, borderRadius:'50%', background:'#2a2a3e', border:`2px solid ${C.green}`, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}
            onClick={() => navigate('/profile')}>
            {user?.avatar_url
              ? <img src={user.avatar_url} style={{ width:34, height:34, borderRadius:'50%', objectFit:'cover' }} />
              : '👤'}
          </div>
        </div>
      </nav>

      {/* ── HERO BANNER ── */}
      <div style={{ background:'linear-gradient(135deg,#0f0f1a 60%,#1a2a1a 100%)', padding:'20px 32px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:`1px solid ${C.border}`, minHeight:120 }}>
        <div style={{ maxWidth:460 }}>
          <div style={{ color: C.green, fontSize:12, fontWeight:700, letterSpacing:1, marginBottom:10 }}>PEOPLE ARE LOOKING FOR</div>
          <h1 style={{ fontSize:32, fontWeight:800, margin:'0 0 12px', lineHeight:1.2, color:'#fff' }}>
            Find Requests From Buyers,<br />Employers &amp; Customers
          </h1>
          <p style={{ color:'#aaa', fontSize:14, margin:0, lineHeight:1.6 }}>
            These people are actively looking for what you offer.<br />Respond now and win the deal.
          </p>
         {allReqs.length > 0 && (
  <div style={{ display:'flex', gap:20, marginTop:20 }}>
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:22, fontWeight:800, color: C.green }}>{allReqs.length}</div>
      <div style={{ fontSize:11, color:'#888' }}>Active Requests</div>
    </div>
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:22, fontWeight:800, color: C.green }}>
        {allReqs.filter(r => new Date(r.created_at) >= (() => { const d = new Date(); d.setHours(0,0,0,0); return d })()).length}
      </div>
      <div style={{ fontSize:11, color:'#888' }}>Posted Today</div>
    </div>
    <div style={{ textAlign:'center' }}>
      <div style={{ fontSize:22, fontWeight:800, color: C.green }}>{fmtMWK(allReqs.reduce((s,r) => s+(r.budget||0), 0))}</div>
      <div style={{ fontSize:11, color:'#888' }}>Total Budget</div>
    </div>
  </div>
)}
        </div>

        {/* Hero illustration */}
        <div style={{ position:'relative', width:240, height:180, flexShrink:0 }}>
          <div style={{ position:'absolute', right:0, top:0, width:130, height:160, background: C.surface, borderRadius:12, border:`1px solid ${C.border}`, display:'flex', flexDirection:'column', padding:12, gap:8 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:28, height:28, borderRadius:'50%', background: C.green, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>👤</div>
              <div>
                <div style={{ width:50, height:6, background:'#2a2a3e', borderRadius:3 }} />
                <div style={{ width:35, height:5, background:'#1e3a1e', borderRadius:3, marginTop:3 }} />
              </div>
            </div>
            {[0,1,2].map(i => (
              <div key={i} style={{ height:7, background:'#2a2a3e', borderRadius:3, width:['100%','80%','60%'][i] }} />
            ))}
            <div style={{ width:60, height:7, background: C.green, borderRadius:3, marginTop:4 }} />
          </div>
          <div style={{ position:'absolute', right:-10, top:20, fontSize:60, opacity:0.7, transform:'rotate(-20deg)' }}>🔍</div>
          {[{ top:20,left:40,color:'#f59e0b',emoji:'👩' },{ top:0,left:110,color: C.green,emoji:'👨' },{ top:110,left:60,color:'#3b82f6',emoji:'🧑' }].map((a,i) => (
            <div key={i} style={{ position:'absolute', top:a.top, left:a.left, width:46, height:46, borderRadius:'50%', background:a.color, border:'3px solid #0f0f1a', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22, zIndex:2 }}>{a.emoji}</div>
          ))}
        </div>
      </div>

      {/* ── SEARCH + FILTER BAR ── */}
      <div style={{ padding:'16px 32px', background: C.bg, borderBottom:`1px solid ${C.border}` }}>
        <div style={{ display:'flex', gap:10, alignItems:'center', background: C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:'4px 8px' }}>
          <div style={{ flex:1, display:'flex', alignItems:'center', gap:8, padding:'6px 8px' }}>
            <span style={{ color: C.gray2 }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search requests, keywords or categories..."
              style={{ flex:1, background:'transparent', border:'none', outline:'none', color:'#fff', fontSize:14 }} />
            {search && <span style={{ color: C.gray2, cursor:'pointer', fontSize:16 }} onClick={() => setSearch('')}>×</span>}
          </div>
          <div style={{ width:1, height:32, background: C.border }} />
          <select value={category} onChange={e => { setCategory(e.target.value); setActiveTab('all') }}
            style={{ background:'transparent', border:'none', color:'#ddd', fontSize:13, padding:'6px 12px', cursor:'pointer', outline:'none' }}>
            {visibleCats.map(c => <option key={c} value={c} style={{ background:'#1a1a1a' }}>{c === 'All' ? 'All Categories' : c}</option>)}
          </select>
          <div style={{ width:1, height:32, background: C.border }} />
          <select value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
            style={{ background:'transparent', border:'none', color:'#ddd', fontSize:13, padding:'6px 12px', cursor:'pointer', outline:'none' }}>
            <option value="All Locations" style={{ background:'#1a1a1a' }}>All Locations</option>
            {malawCities.map(c => <option key={c} value={c} style={{ background:'#1a1a1a' }}>{c}</option>)}
          </select>
          <div style={{ width:1, height:32, background: C.border }} />
          <div style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px' }}>
            <input value={budgetMin} onChange={e => setBudgetMin(e.target.value)} placeholder="Min"
              style={{ width:56, background:'transparent', border:'none', color:'#ddd', fontSize:13, outline:'none' }} />
            <span style={{ color: C.gray2, fontSize:13 }}>–</span>
            <input value={budgetMax} onChange={e => setBudgetMax(e.target.value)} placeholder="Max"
              style={{ width:56, background:'transparent', border:'none', color:'#ddd', fontSize:13, outline:'none' }} />
          </div>
          <div style={{ width:1, height:32, background: C.border }} />
          <div onClick={() => setMoreFiltersOpen(p => !p)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', cursor:'pointer', color: moreFiltersOpen ? C.green : '#ddd', fontSize:13 }}>
            <span>⚙</span> More Filters <span>{moreFiltersOpen ? '▴' : '▾'}</span>
          </div>
        </div>

        {/* More Filters panel */}
        {moreFiltersOpen && (
          <div style={{ marginTop:10, background: C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:'16px 20px', display:'flex', gap:24, flexWrap:'wrap', alignItems:'flex-end' }}>
            <div>
              <div style={{ fontSize:11, color: C.gray2, marginBottom:6, fontWeight:700 }}>URGENCY</div>
              <div style={{ display:'flex', gap:8 }}>
                {(URGENCY_OPTIONS || [{ value:'urgent', label:'Urgent' },{ value:'soon', label:'Soon' },{ value:'flexible', label:'Flexible' }]).map(u => (
                  <button key={u.value} style={{ padding:'6px 14px', borderRadius:20, border:`1px solid ${C.border}`, background: search === u.value ? C.greenDk : 'transparent', color: search === u.value ? '#fff' : '#ddd', fontSize:12, cursor:'pointer' }}
                    onClick={() => { setSearch(search === u.value ? '' : u.value); setMoreFiltersOpen(false) }}>
                    {u.label}
                  </button>
                ))}
              </div>
            </div>
            <button onClick={() => { clearFilters(); setMoreFiltersOpen(false) }}
              style={{ padding:'8px 16px', borderRadius:8, border:`1px solid ${C.red}`, background:'transparent', color: C.red, fontSize:13, fontWeight:700, cursor:'pointer' }}>
              Clear All Filters
            </button>
          </div>
        )}
      </div>

      {/* ── CATEGORY PILLS ── */}
      <div style={{ padding:'12px 32px', display:'flex', alignItems:'center', gap:0, borderBottom:`1px solid ${C.border}`, overflowX:'auto' }}>
        {[
          { id:'all',   label:'All Requests', count: allReqs.length },
          { id:'mine',  label:'My Requests',  count: myReqs.length },
          { id:'saved', label:'Saved',         count: savedReqs.length },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 20px', border:'none', borderRight:`1px solid ${C.border}`, background: activeTab === t.id ? '#1a2a1a' : 'transparent', color: activeTab === t.id ? C.green : '#aaa', cursor:'pointer', fontSize:13, fontWeight: activeTab === t.id ? 700 : 500, whiteSpace:'nowrap' }}>
            <span>{t.label}</span>
            {t.count > 0 && <span style={{ fontSize:12, color: activeTab === t.id ? C.green : '#666' }}>{t.count}</span>}
          </button>
        ))}

        {visibleCats.filter(c => c !== 'All').map(c => (
  <button key={c} onClick={() => { setCategory(c); setActiveTab('all') }}
    style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 20px', border:'none', borderRight:`1px solid ${C.border}`, background: category === c && activeTab === 'all' ? '#1a2a1a' : 'transparent', color: category === c && activeTab === 'all' ? C.green : '#aaa', cursor:'pointer', fontSize:13, fontWeight: category === c && activeTab === 'all' ? 700 : 500, whiteSpace:'nowrap' }}>
    {CAT_ICONS[c]} {c}
    {allReqs.filter(r => r.category === c).length > 0 && (
      <span style={{ fontSize:12, color: category === c && activeTab === 'all' ? C.green : '#666' }}>
        {allReqs.filter(r => r.category === c).length}
      </span>
    )}
  </button>
))}

        <div style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8 }}>
          <span style={{ fontSize:13, color:'#888' }}>Sort by:</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ background: C.surface, border:`1px solid ${C.border}`, color:'#ddd', borderRadius:6, padding:'5px 10px', fontSize:13, cursor:'pointer', outline:'none' }}>
            <option value="recent">Newest First</option>
            <option value="budget">Top Budget</option>
            <option value="demand">Most Offers</option>
            <option value="urgent">Urgent First</option>
          </select>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
     <div style={{ display:'flex', padding:'20px 32px', gap:20, alignItems:'flex-start', minWidth:0, position:'relative' }}>

        {/* ── LEFT SIDEBAR ── */}
        <div style={{ width:240, flexShrink:0, background: C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:'18px 16px', position:'sticky', top:70, maxHeight:'calc(100vh - 80px)', overflowY:'auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <span style={{ fontWeight:700, fontSize:14, color:'#fff' }}>Refine Results</span>
            <button onClick={clearFilters} style={{ background:'none', border:'none', fontSize:13, color: C.green, fontWeight:700, cursor:'pointer' }}>Clear all</button>
          </div>

          {/* Categories */}
          <div style={{ fontSize:11, color:'#888', marginBottom:10, fontWeight:600 }}>CATEGORIES</div>
          {visibleCats.map(c => (
            <label key={c} onClick={() => { setCategory(c); setActiveTab('all') }}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:15, height:15, borderRadius:4, border:`2px solid ${category === c ? C.green : '#444'}`, background: category === c ? C.green : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {category === c && <span style={{ color:'#fff', fontSize:9, fontWeight:900 }}>✓</span>}
                </div>
                <span style={{ fontSize:13, color: category === c ? '#fff' : '#ddd', fontWeight: category === c ? 700 : 400 }}>{c === 'All' ? 'All Categories' : c}</span>
              </div>
              <span style={{ fontSize:12, color:'#666' }}>{c === 'All' ? allReqs.length : allReqs.filter(r => r.category === c).length || ''}</span>
            </label>
          ))}

          <div style={{ height:1, background: C.border, margin:'14px 0' }} />

          {/* Budget Range */}
          <div style={{ fontSize:11, color:'#888', marginBottom:10, fontWeight:600 }}>BUDGET RANGE (MWK)</div>
          
          {/* Slider */}
          <div style={{ position:'relative', marginBottom:8 }}>
            <input type="range" min={0} max={2000000} step={10000} value={budgetMax || 2000000}
              onChange={e => {
                const val = Number(e.target.value)
                setBudgetMax(val >= 2000000 ? '' : String(val))
              }}
              onMouseUp={e => loadRequests()}
              onTouchEnd={e => loadRequests()}
              style={{ width:'100%', accentColor: C.green }} />
            <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, overflow:'hidden' }}>
              <span style={{ fontSize:10, color:'#666', flexShrink:0 }}>MK 0</span>
              <span style={{ fontSize:10, color: C.green, fontWeight:700, textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'50%' }}>
                {budgetMax ? `MK ${Number(budgetMax).toLocaleString()}` : 'Any'}
              </span>
              <span style={{ fontSize:10, color:'#666', flexShrink:0 }}>MK 2M</span>
            </div>
          </div>

          {/* Manual inputs */}
          <div style={{ display:'flex', gap:6, marginBottom:12, width:'100%', boxSizing:'border-box' }}>
            <input
              placeholder="Min"
              value={budgetMin}
              onChange={e => setBudgetMin(e.target.value)}
              type="number"
              style={{ width:0, flex:1, minWidth:0, background:'#0f0f1a', border:`1px solid ${C.border}`, borderRadius:6, padding:'6px 8px', color:'#ddd', fontSize:12, outline:'none', boxSizing:'border-box' }}
            />
            <span style={{ color:'#888', alignSelf:'center', fontSize:12, flexShrink:0 }}>–</span>
            <input
              placeholder="Max"
              value={budgetMax}
              onChange={e => setBudgetMax(e.target.value)}
              type="number"
              style={{ width:0, flex:1, minWidth:0, background:'#0f0f1a', border:`1px solid ${C.border}`, borderRadius:6, padding:'6px 8px', color:'#ddd', fontSize:12, outline:'none', boxSizing:'border-box' }}
            />
          </div>

          {/* Active filter indicator */}
          {(budgetMin || budgetMax) && (
            <div style={{ fontSize:11, color: C.green, marginBottom:8, fontWeight:600 }}>
              Filter: {budgetMin ? `MK ${Number(budgetMin).toLocaleString()}` : 'MK 0'} → {budgetMax ? `MK ${Number(budgetMax).toLocaleString()}` : 'Any'}
            </div>
          )}

          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => { loadRequests() }}
              style={{ flex:1, background: C.greenDk, color:'#fff', border:'none', borderRadius:6, padding:'9px 0', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              Apply
            </button>
            {(budgetMin || budgetMax) && (
              <button onClick={() => { setBudgetMin(''); setBudgetMax(''); setRangeValue(50); setTimeout(loadRequests, 0) }}
                style={{ padding:'9px 12px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:6, color:'#888', fontSize:12, cursor:'pointer' }}>
                ✕
              </button>
            )}
          </div>

          <div style={{ height:1, background: C.border, margin:'14px 0' }} />

          {/* Location */}
          <div style={{ fontSize:11, color:'#888', marginBottom:10, fontWeight:600 }}>LOCATION</div>
          {['All Locations', ...malawCities.slice(0, 8)].map(loc => (
            <label key={loc} onClick={() => { setLocationFilter(loc) }}
              style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginBottom:10 }}>
              <div style={{ width:15, height:15, borderRadius:4, border:`2px solid ${locationFilter === loc ? C.green : '#444'}`, background: locationFilter === loc ? C.green : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {locationFilter === loc && <span style={{ color:'#fff', fontSize:9, fontWeight:900 }}>✓</span>}
              </div>
              <span style={{ fontSize:13, color: locationFilter === loc ? '#fff' : '#ddd', fontWeight: locationFilter === loc ? 700 : 400 }}>{loc}</span>
            </label>
          ))}
        </div>

        {/* ── CARDS GRID ── */}
        <div style={{ flex:1, minWidth:0 }}>
          {loading && (
            <div style={{ textAlign:'center', padding:'60px 0' }}>
              <div style={{ color: C.green, fontSize:14 }}>Loading requests…</div>
            </div>
          )}
          {!loading && tabReqs.length === 0 && (
            <div style={{ textAlign:'center', padding:'60px 24px', background: C.surface, borderRadius:18, border:`1px solid ${C.border}` }}>
              <div style={{ fontSize:48, marginBottom:12 }}>🔍</div>
              <div style={{ fontSize:17, fontWeight:700, marginBottom:8 }}>No requests found</div>
              <div style={{ fontSize:13, color:'#aaa', marginBottom:20 }}>Try different filters or be the first to post a request.</div>
              <button onClick={handleOpenComposer}
                style={{ background: C.greenDk, color:'#fff', border:'none', borderRadius:10, padding:'12px 24px', fontWeight:700, fontSize:14, cursor:'pointer' }}>
                + Post Request
              </button>
            </div>
          )}
          {!loading && tabReqs.length > 0 && (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,minmax(0,1fr))', gap:16, alignItems:'stretch' }}>
              {tabReqs.map(req => (
                <RequestCard
                  key={req.id}
                  req={req}
                  user={user}
                  myListings={myListings}
                  saved={savedIds.has(req.id)}
                  onOffer={sendOffer}
                  onSave={toggleSave}
                  onFulfill={markFulfilled}
                  onDelete={deleteRequest}
                  onViewDetails={setDetailReq}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── VIEW DETAILS MODAL ── */}
      {detailReq && (
        <DetailModal
          req={detailReq}
          user={user}
          myListings={myListings}
          saved={savedIds.has(detailReq.id)}
          userHasOffered={requests.find(r => r.id === detailReq.id)?.user_has_offered ?? detailReq.user_has_offered}
          onClose={() => setDetailReq(null)}
          onOffer={r => { sendOffer(r); setDetailReq(null) }}
          onSave={toggleSave}
          onFulfill={markFulfilled}
          onDelete={deleteRequest}
        />
      )}

      {/* ── COMPOSER ── */}
      <RequestComposer
        open={composerOpen}
        onClose={() => setComposerOpen(false)}
        form={form}
        onFormChange={patch => setForm(f => ({ ...f, ...patch }))}
        images={images}
        coverIndex={coverIndex}
        onImageChange={files => {
          const newImgs = files.slice(0, 5 - images.length).map(f => ({ file: f, preview: URL.createObjectURL(f) }))
          setImages(prev => [...prev, ...newImgs].slice(0, 5))
        }}
        onImageRemove={i => {
          setImages(prev => prev.filter((_, idx) => idx !== i))
          setCoverIndex(prev => prev >= i && prev > 0 ? prev - 1 : prev)
        }}
        onSetCover={setCoverIndex}
        selectedCities={selectedCities}
        onAddCity={city => setSelectedCities(p => p.includes(city) ? p : [...p, city])}
        onRemoveCity={city => setSelectedCities(p => p.filter(c => c !== city))}
        dbCities={dbCities}
        citySearch={citySearch}
        onCitySearch={setCitySearch}
        detectingCity={detectingCity}
        posting={posting}
        onPost={handlePost}
      />

      {/* ── TOAST ── */}
      {toast && (
        <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', background: toast.type==='error' ? C.red : toast.type==='warning' ? '#d97706' : C.greenDk, color:'#fff', borderRadius:10, padding:'12px 24px', fontWeight:700, fontSize:14, zIndex:9999, boxShadow:'0 4px 20px rgba(0,0,0,0.4)' }}>
          {toast.msg}
        </div>
      )}

      <BottomNav />
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   REQUEST CARD
══════════════════════════════════════════════════════ */
function RequestCard({ req, user, myListings, saved, onOffer, onSave, onFulfill, onDelete, onViewDetails }) {
  const isOwn  = req.user_id === user?.id
  const demand = getDemandLevel(req)
  const match  = !isOwn ? getMatchScore(req, myListings) : null
  const urgOpt = (URGENCY_OPTIONS || []).find(u => u.value === req.urgency)
  const budget = req.budget ? fmtMWK(req.budget) : 'Negotiable'
  const loc    = req.cities?.length > 0 ? req.cities[0] : (req.city || 'Remote')

  return (
    <div style={{ background:'#1a1a2e', border:'1px solid #2a2a3e', borderRadius:10, padding:16, display:'flex', flexDirection:'column', gap:0, transition:'all 0.2s', cursor:'pointer', height:'100%', boxSizing:'border-box' }}
      onClick={() => onViewDetails(req)}
      onMouseEnter={e => { e.currentTarget.style.borderColor='#22c55e'; e.currentTarget.style.transform='translateY(-2px)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor='#2a2a3e'; e.currentTarget.style.transform='translateY(0)' }}>

      {/* Top row */}
      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:10 }}>
        <div style={{ display:'flex', alignItems:'center', gap:6, flex:1, minWidth:0 }}>
          {req.profiles?.avatar_url
            ? <img src={req.profiles.avatar_url} style={{ width:24, height:24, borderRadius:'50%', objectFit:'cover', flexShrink:0 }} />
            : <div style={{ width:24, height:24, borderRadius:'50%', background:'#22c55e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:800, color:'#fff', flexShrink:0 }}>
                {(req.profiles?.full_name || 'U')[0].toUpperCase()}
              </div>
          }
          <span style={{ fontSize:12, fontWeight:700, color:'#ddd', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {req.profiles?.full_name || 'User'}
          </span>
          {req.profiles && (
            <svg title="Verified" width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0 }}>
              <circle cx="12" cy="12" r="12" fill="#22c55e" />
              <path d="M6.5 12.5l3.5 3.5 7-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        {urgOpt && req.urgency !== 'flexible' && (
          <span style={{ fontSize:10, fontWeight:800, color: urgOpt.color || '#e53e3e', background: urgOpt.bg || '#fff0f0', borderRadius:50, padding:'2px 8px' }}>
            {urgOpt.label?.toUpperCase()}
          </span>
        )}
        {null}
        {null}
        <button
          onClick={e => { e.stopPropagation(); e.preventDefault(); onSave(req.id) }}
          onMouseDown={e => e.stopPropagation()}
          style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', fontSize:16, padding:2, color: saved ? '#e53e3e' : '#888', zIndex:10, position:'relative' }}>
          {saved ? '❤️' : '🔖'}
        </button>
      </div>

      {/* Cover image — always same height */}
      <div style={{ margin:'0 -16px 12px', height:140, overflow:'hidden', background:'#0f0f1a', flexShrink:0, position:'relative' }}>
        {req.image_url
          ? <img src={req.image_url} alt={req.title} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', flexDirection:'column', gap:6, background:'linear-gradient(135deg,#0f0f1a,#1a1a2e)' }}>
              <span style={{ fontSize:36, opacity:0.15 }}>{CAT_ICONS[req.category] || '📋'}</span>
            </div>
        }
        {/* Category pill — FB style overlay */}
        <div style={{ position:'absolute', bottom:8, left:12, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(6px)', borderRadius:20, padding:'3px 10px', fontSize:11, fontWeight:700, color:'#fff', letterSpacing:0.5 }}>
          {CAT_ICONS[req.category]} {req.category}
        </div>
      </div>

      {/* Title */}
      <div style={{ fontWeight:700, fontSize:15, color:'#fff', marginBottom:6, lineHeight:1.3 }}>
        {req.title}
      </div>

      {/* Description */}
      <div style={{ fontSize:13, color: req.description ? '#aaa' : '#555', marginBottom:14, lineHeight:1.6, display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', overflow:'hidden', fontStyle: req.description ? 'normal' : 'italic', minHeight:'2.6em' }}>
        {req.description || 'No description provided.'}
      </div>

      {/* Stats grid */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:4, marginBottom:12 }}>
        <div>
          <div style={{ fontSize:11, color:'#888', marginBottom:2 }}>Budget</div>
          <div style={{ fontSize:13, fontWeight:700, color:'#22c55e' }}>{budget}</div>
        </div>
        <div>
          <div style={{ fontSize:11, color:'#888', marginBottom:2 }}>Location</div>
          <div style={{ fontSize:13, fontWeight:600, color:'#ddd' }}>{loc}</div>
        </div>
        <div>
          <div style={{ fontSize:11, color:'#888', marginBottom:2 }}>Posted</div>
          <div style={{ fontSize:13, fontWeight:600, color:'#ddd' }}>{timeAgo(req.created_at)}</div>
        </div>
      </div>

      {/* Offer count + views */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <span style={{ fontSize:12, color:'#aaa' }}>👥 {req.offer_count || 0} {(req.offer_count||0)===1?'Offer':'Offers'}</span>
        <span style={{ fontSize:12, color:'#888' }}>👁 {req.view_count || 0} Views</span>
      </div>

      {/* Buttons */}
      <div style={{ display:'flex', gap:8, marginTop:'auto' }}>
        {isOwn ? (
          <>
            <button onClick={e => { e.stopPropagation(); onFulfill(req.id) }}
              style={{ flex:1, padding:'9px 0', border:'1px solid #444', borderRadius:6, background:'transparent', color:'#fff', fontWeight:600, fontSize:12, cursor:'pointer' }}>
              ✓ Fulfilled
            </button>
            <button onClick={e => { e.stopPropagation(); onDelete(req.id) }}
              style={{ flex:1, padding:'9px 0', border:'1px solid #e53e3e', borderRadius:6, background:'transparent', color:'#e53e3e', fontWeight:700, fontSize:12, cursor:'pointer' }}>
              Delete
            </button>
          </>
        ) : (
          <>
            <button onClick={e => { e.stopPropagation(); onViewDetails(req) }}
              style={{ flex:1, padding:'9px 0', border:'1px solid #444', borderRadius:6, background:'transparent', color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer' }}>
              View Details
            </button>
            <button onClick={e => { e.stopPropagation(); onOffer(req) }}
              style={{ flex:1, padding:'9px 0', border:'none', borderRadius:6, background: req.user_has_offered ? '#2a2a3e' : '#16a34a', color:'#fff', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              {req.user_has_offered ? '✓ Offered' : req.category === 'Jobs' ? 'Apply Now' : 'Submit Offer'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   VIEW DETAILS MODAL
══════════════════════════════════════════════════════ */
function DetailModal({ req, user, myListings, saved, onClose, onOffer, onSave, onFulfill, onDelete, userHasOffered }) {
  const isOwn  = req.user_id === user?.id
  const name   = req.profiles?.full_name || 'Buyer'
  const avatar = req.profiles?.avatar_url
  const budget = req.budget ? fmtMWK(req.budget) : 'Negotiable'
  const loc    = req.cities?.length > 0 ? req.cities.join(', ') : (req.city || 'Remote')
  const urgOpt = (URGENCY_OPTIONS || []).find(u => u.value === req.urgency)
  const match  = !isOwn ? getMatchScore(req, myListings) : null

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'#1a1a2e', border:'1px solid #2a2a3e', borderRadius:16, width:'100%', maxWidth:600, maxHeight:'90vh', overflowY:'auto', padding:28 }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:20 }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ width:46, height:46, borderRadius:'50%', background:'#22c55e', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, overflow:'hidden', flexShrink:0 }}>
              {avatar ? <img src={avatar} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : name[0]?.toUpperCase()}
            </div>
            <div>
              <div style={{ fontWeight:700, fontSize:14, color:'#fff' }}>{name}</div>
              <div style={{ fontSize:12, color:'#22c55e', fontWeight:700 }}>★ VERIFIED USER</div>
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#888', fontSize:22, cursor:'pointer', lineHeight:1 }}>×</button>
        </div>

        {/* Badges */}
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:16 }}>
          {urgOpt && req.urgency !== 'flexible' && (
            <span style={{ fontSize:11, fontWeight:800, color: urgOpt.color || '#e53e3e', background: urgOpt.bg || '#fff0f0', borderRadius:50, padding:'3px 10px' }}>
              {urgOpt.label?.toUpperCase()}
            </span>
          )}
          {match !== null && match >= 50 && (
            <span style={{ fontSize:11, fontWeight:800, color:'#22c55e', background:'rgba(34,197,94,0.15)', borderRadius:50, padding:'3px 10px' }}>{match}% MATCH</span>
          )}
          <span style={{ fontSize:11, fontWeight:700, color:'#aaa', background:'#2a2a3e', borderRadius:50, padding:'3px 10px' }}>{req.category}</span>
        </div>

        {/* Title */}
        <div style={{ fontSize:20, fontWeight:800, color:'#fff', marginBottom:12, lineHeight:1.3 }}>{req.title}</div>

        {/* Images */}
        {(req.image_urls?.length > 0 ? req.image_urls : req.image_url ? [req.image_url] : []).length > 0 && (
          <div style={{ marginBottom:16 }}>
            {/* Main cover */}
            <img
              src={req.image_urls?.length > 0 ? req.image_urls[0] : req.image_url}
              alt={req.title}
              style={{ width:'100%', borderRadius:10, marginBottom:8, maxHeight:240, objectFit:'cover' }}
            />
            {/* Extra thumbnails */}
            {req.image_urls?.length > 1 && (
              <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                {req.image_urls.slice(1).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt={`photo ${i+2}`}
                    style={{ width:80, height:80, borderRadius:8, objectFit:'cover', border:'2px solid #2a2a3e', cursor:'pointer' }}
                    onClick={e => {
                      // Swap clicked thumbnail with main image
                      const main = e.currentTarget.parentElement.previousElementSibling
                      const prev = main.src
                      main.src = url
                      e.currentTarget.src = prev
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* Description */}
        {req.description && (
          <div style={{ fontSize:14, color:'#aaa', lineHeight:1.7, marginBottom:20 }}>{req.description}</div>
        )}

        {/* Stats */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12, marginBottom:20 }}>
          {[
            { label:'Budget',   value: budget,              color:'#22c55e' },
            { label:'Location', value: loc,                 color:'#ddd' },
            { label:'Posted',   value: timeAgo(req.created_at), color:'#ddd' },
          ].map(s => (
            <div key={s.label} style={{ background:'#0f0f1a', borderRadius:10, padding:'12px 14px', border:'1px solid #2a2a3e' }}>
              <div style={{ fontSize:11, color:'#888', marginBottom:4, fontWeight:600 }}>{s.label}</div>
              <div style={{ fontSize:14, fontWeight:700, color: s.color }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Cities */}
        {req.cities?.length > 1 && (
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:12, color:'#888', marginBottom:8, fontWeight:600 }}>AVAILABLE IN</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {req.cities.map(c => (
                <span key={c} style={{ background:'#2a2a3e', color:'#ddd', borderRadius:50, padding:'4px 12px', fontSize:12, fontWeight:600 }}>{c}</span>
              ))}
            </div>
          </div>
        )}

        {/* Offer count */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, padding:'12px 0', borderTop:'1px solid #2a2a3e', borderBottom:'1px solid #2a2a3e' }}>
          <span style={{ fontSize:13, color:'#aaa' }}>👥 {req.offer_count || 0} {(req.offer_count||0)===1?'Offer':'Offers'} Received</span>
          <span style={{ fontSize:13, color:'#aaa' }}>👁 {req.view_count || 0} Views</span>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => onSave(req.id)}
            style={{ padding:'11px 18px', border:'1px solid #444', borderRadius:8, background:'transparent', color: saved?'#e53e3e':'#fff', fontWeight:600, fontSize:13, cursor:'pointer' }}>
            {saved ? '❤️ Saved' : '🔖 Save'}
          </button>
          {isOwn ? (
            <>
              <button onClick={() => { onFulfill(req.id); onClose() }}
                style={{ flex:1, padding:'11px 0', border:'1px solid #444', borderRadius:8, background:'transparent', color:'#fff', fontWeight:600, fontSize:13, cursor:'pointer' }}>
                ✓ Mark Fulfilled
              </button>
              <button onClick={() => { onDelete(req.id); onClose() }}
                style={{ flex:1, padding:'11px 0', border:'1px solid #e53e3e', borderRadius:8, background:'transparent', color:'#e53e3e', fontWeight:700, fontSize:13, cursor:'pointer' }}>
                Delete
              </button>
            </>
          ) : (
            <button onClick={() => { onOffer(req); onClose() }}
              style={{ flex:1, padding:'11px 0', border:'none', borderRadius:8, background: userHasOffered ? '#2a2a3e' : '#16a34a', color:'#fff', fontWeight:700, fontSize:14, cursor:'pointer' }}>
              {userHasOffered ? '✓ Offered' : req.category === 'Jobs' ? '📄 Apply Now' : '📤 Submit Offer'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}