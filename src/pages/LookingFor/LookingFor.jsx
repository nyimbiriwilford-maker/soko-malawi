import { useEffect, useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import RequestComposer from '../../components/LookingFor/RequestComposer'
import { Toast, Spinner } from '../../components/LookingFor/Primitives'
import { Icon, CatIcon } from '../../components/LookingFor/Icons'
import {
  getGPSLocation,
  getDBCities,
  getMatchScore,
  fmtMWK,
  sortRequestsByViewerLocation,
  withDistanceToBuyer,
} from '../../utils/lookingFor'
import { CATEGORIES, URGENCY_OPTIONS, expiresAtFromDays } from '../../constants/lookingFor'
import { getDemandLevel, timeAgo } from '../../utils/lookingFor'
import { MALAWI_DISTRICTS } from '../../constants/malawiDistricts'
import lookingForHero from '../../assets/looking-for-hero.jpg'
import SokoNav from '../../components/SokoNav'
import LookingForRequestCard, { LOOKING_FOR_CARD_CSS } from '../../components/LookingFor/LookingForRequestCard'

/* ── colour tokens (aligned with Home / Shops / Listings) ── */
const C = {
  bg:       '#f8f9fa',
  surface:  '#ffffff',
  border:   '#e8eaed',
  green:    '#0F9D58',
  greenDk:  '#0a7a44',
  greenL:   '#e8f5ee',
  red:      '#ea4335',
  amber:    '#F9AB00',
  white:    '#ffffff',
  gray1:    '#5f6368',
  gray2:    '#80868b',
  gray3:    '#9aa0a6',
  text:     '#202124',
  textSub:  '#5f6368',
  shadow:   '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.06)',
}

/** @deprecated emoji map — use <CatIcon /> */
const CAT_ICONS = {
  All: '📋', Electronics: '📱', Services: '🔧', Jobs: '💼',
  Vehicles: '🚗', Fashion: '👗', Food: '🍱', Property: '🏠', Agriculture: '🌱',
}

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
  const [allCategories, setAllCategories] = useState(new Set())
  const [loading,       setLoading]       = useState(true)
  const viewedIdsRef = useRef(new Set()) // session: count each request once

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
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  /* ── location (GPS) — used to prioritise local Looking For posts ── */
  const [viewerCity,      setViewerCity]      = useState(null)
  const [viewerLocation,  setViewerLocation]  = useState(null) // { label, area, district, city }
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
  const [form,          setForm]          = useState({
    title: '', category: 'Electronics', budget: '', description: '',
    urgency: 'flexible', durationDays: 7, customDays: '',
  })
  const [images,        setImages]        = useState([])   // [{ file, preview }]
  const [coverIndex,    setCoverIndex]    = useState(0)
  const [selectedCities,setSelectedCities]= useState([])
  const [citySearch,    setCitySearch]    = useState('')
  const [homeLocation,  setHomeLocation]  = useState('')
  const [homeSearch,    setHomeSearch]    = useState('')
  const [gpsDetected,   setGpsDetected]   = useState(null) // { label, area, district }
  const [detectingCity, setDetectingCity] = useState(false)
  const [posting,       setPosting]       = useState(false)

  /* ── boot ── */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate('/login'); return }
      // Keep select minimal — missing columns (e.g. district) cause 400 and hide profile data
      supabase.from('profiles').select('full_name,avatar_url,city').eq('id', user.id).maybeSingle()
        .then(async ({ data }) => {
          setUser({ ...user, ...(data || {}) })
          // GPS first so feed prioritises requests looking in this city/district
          const gps = await getGPSLocation()
          if (gps?.label || gps?.district || gps?.city) {
            setViewerLocation(gps)
            setViewerCity(gps.district || gps.city || gps.label)
          } else if (data?.city) {
            const fallback = {
              label: data.city,
              area: data.city,
              district: data.city,
              city: data.city,
            }
            setViewerLocation(fallback)
            setViewerCity(fallback.city)
          }
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
    if (!detectingViewer && user) loadRequests()
  }, [category, detectingViewer, viewerCity, viewerLocation, sortBy, budgetMin, budgetMax, locationFilter, district, search, headerSearch, user])

  /* ── data loaders ── */
  async function loadRequests() {
    setLoading(true)
    const nowIso = new Date().toISOString()
    const selectWithExpiry = 'id,title,category,budget,description,urgency,status,cities,city,detected_city,lat,lng,image_url,image_urls,offer_count,view_count,created_at,expires_at,duration_days,user_id,profiles:user_id(full_name,avatar_url,is_verified)'
    const selectLegacy = 'id,title,category,budget,description,urgency,status,cities,city,detected_city,image_url,image_urls,offer_count,view_count,created_at,user_id,profiles:user_id(full_name,avatar_url,is_verified)'

    const placeTokens = [
      viewerLocation?.district,
      viewerLocation?.city,
      viewerLocation?.area,
      viewerCity,
      user?.district,
      user?.city,
    ].filter(Boolean).map(s => String(s).trim()).filter(Boolean)

    function buildQuery(selectCols, withExpiryFilter, { preferLocal = false } = {}) {
      let q = supabase.from('buyer_requests')
        .select(selectCols)
        .neq('status', 'fulfilled')
        .limit(preferLocal ? 60 : 120)
      if (withExpiryFilter) q = q.or(`expires_at.is.null,expires_at.gt.${nowIso}`)
      if (category !== 'All') q = q.eq('category', category)
      // Pull extra rows that list viewer's city in "looking for" areas
      if (preferLocal && placeTokens.length) {
        const district = placeTokens[0]
        // cities array contains district OR city text match
        q = q.or(`cities.cs.{"${district.replace(/"/g, '')}"},city.ilike.%${district.replace(/[%_,]/g, '')}%`)
      }
      if (sortBy === 'budget') q = q.order('budget', { ascending: false, nullsFirst: false })
      else if (sortBy === 'demand') q = q.order('offer_count', { ascending: false })
      else if (sortBy === 'urgent') q = q.order('urgency', { ascending: true })
      else q = q.order('created_at', { ascending: false })
      return q
    }

    let { data, error } = await buildQuery(selectWithExpiry, true)
    if (error && /expires_at|duration_days|lat|lng|column/i.test(error.message || '')) {
      // Retry without lat/lng / duration if columns missing
      const selectNoCoords = selectWithExpiry.replace(',lat,lng', '')
      ;({ data, error } = await buildQuery(selectNoCoords, true))
      if (error && /expires_at|duration_days|column/i.test(error.message || '')) {
        ;({ data, error } = await buildQuery(selectLegacy, false))
      }
    }

    // Merge a local-looking query so older local posts aren't buried under recent remote ones
    if (!error && placeTokens.length) {
      let localRes = await buildQuery(selectWithExpiry, true, { preferLocal: true })
      if (localRes.error && /expires_at|duration_days|column/i.test(localRes.error.message || '')) {
        localRes = await buildQuery(selectLegacy, false, { preferLocal: true })
      }
      if (!localRes.error && localRes.data?.length) {
        const byId = new Map((data || []).map(r => [r.id, r]))
        for (const r of localRes.data) byId.set(r.id, r)
        data = [...byId.values()]
      }
    }

    if (!error) {
      let filtered = data || []
      // Client-side expiry guard (covers legacy rows + failed server filter)
      filtered = filtered.filter(r => !r.expires_at || new Date(r.expires_at) > new Date())
      const combinedSearch = (search || headerSearch).trim().toLowerCase()
      if (combinedSearch) filtered = filtered.filter(r =>
        r.title?.toLowerCase().includes(combinedSearch) || r.description?.toLowerCase().includes(combinedSearch))
      if (budgetMin) filtered = filtered.filter(r => (r.budget || 0) >= Number(budgetMin))
      if (budgetMax) filtered = filtered.filter(r => (r.budget || 0) <= Number(budgetMax))
      if (locationFilter !== 'All Locations') filtered = filtered.filter(r => {
        const cities = r.cities?.length > 0 ? r.cities : (r.city ? [r.city] : [])
        return cities.some(c => c.toLowerCase() === locationFilter.toLowerCase())
      })
      if (district !== 'All Districts') filtered = filtered.filter(r => {
        const cities = r.cities?.length > 0 ? r.cities : (r.city ? [r.city] : [])
        return cities.some(c => c.toLowerCase() === district.toLowerCase())
      })
      const { data: myOffers } = await supabase.from('buyer_request_offers')
        .select('request_id').eq('seller_id', user?.id ?? '')
      const offeredIds = new Set((myOffers || []).map(o => o.request_id))
      const mapped = filtered.map(r => {
        // profiles FK can be object or array depending on join; only true is verified
        let profiles = r.profiles
        if (Array.isArray(profiles)) profiles = profiles[0] || null
        if (profiles) {
          profiles = {
            ...profiles,
            is_verified: profiles.is_verified === true,
          }
        }
        return { ...r, profiles, user_has_offered: offeredIds.has(r.id) }
      })
      // Prioritise posts looking for product in viewer's GPS city/district
      // and attach estimated distance (seller GPS → buyer stay)
      const loc = viewerLocation || viewerCity || user?.city || user?.district || null
      const ranked = sortRequestsByViewerLocation(mapped, loc, sortBy)
      setRequests(withDistanceToBuyer(ranked, loc))
      // Category pills from loaded data (no separate stats bar)
      const cats = new Set((mapped || []).map(r => r.category).filter(Boolean))
      setAllCategories(cats)
    }
    setLoading(false)
  }

  /**
   * Track a Looking For request view — one person (user id) = one view.
   * Server enforces uniqueness via buyer_request_views (request_id, viewer_id).
   * localStorage + session cache prevent repeat UI bumps.
   */
  async function trackRequestView(req) {
    if (!req?.id || !user?.id) return
    if (req.user_id === user.id) return
    if (viewedIdsRef.current.has(req.id)) return

    const storageKey = `lf_viewed_${user.id}`
    let seen = []
    try { seen = JSON.parse(localStorage.getItem(storageKey) || '[]') } catch { seen = [] }
    if (seen.includes(req.id)) {
      viewedIdsRef.current.add(req.id)
      return
    }

    // Server: insert unique viewer row; only increments when NEW
    const { data, error } = await supabase.rpc('increment_buyer_request_view', {
      request_id: req.id,
    })

    // Remember attempt so we don't spam the API this session
    viewedIdsRef.current.add(req.id)
    try {
      const nextSeen = [...seen, req.id].slice(-500)
      localStorage.setItem(storageKey, JSON.stringify(nextSeen))
    } catch { /* ignore */ }

    // data === true → new unique view recorded
    // data === false → already viewed / own post
    // error → RPC missing; do not blindly increment (avoids multi-count)
    if (error) {
      console.warn('View track RPC:', error.message)
      return
    }
    if (data !== true) return

    setRequests(prev => prev.map(r =>
      r.id === req.id ? { ...r, view_count: (r.view_count || 0) + 1 } : r,
    ))
    setDetailReq(prev => (
      prev?.id === req.id
        ? { ...prev, view_count: (prev.view_count || 0) + 1 }
        : prev
    ))
  }

  function openRequestDetails(req) {
    setDetailReq(req)
    trackRequestView(req)
  }

  async function redetectViewerGps() {
    setDetectingViewer(true)
    const gps = await getGPSLocation()
    setDetectingViewer(false)
    if (!gps?.label && !gps?.district) {
      showToast('Could not detect GPS. Local sorting uses your profile city if set.', 'warning')
      return
    }
    setViewerLocation(gps)
    setViewerCity(gps.district || gps.city || gps.label)
    showToast(`Showing local first · ${gps.district || gps.label}`, 'success')
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
          const loc = viewerLocation || viewerCity || user?.city || user?.district || null
          setRequests(prev => withDistanceToBuyer(
            sortRequestsByViewerLocation(
              [{ ...req, user_has_offered: false }, ...prev.filter(r => r.id !== req.id)],
              loc,
              sortBy,
            ),
            loc,
          ))
        }
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [user, viewerLocation, viewerCity, sortBy])

  /* ── composer open ── */
  async function handleOpenComposer() {
    setComposerOpen(true)
    setDetectingCity(true)
    setGpsDetected(null)
    const cities = await getDBCities(supabase)
    setDbCities(cities)

    // GPS first for district + area where buyer stays
    const gps = await getGPSLocation()
    if (gps?.label) {
      setGpsDetected(gps)
      setViewerCity(gps.label)
      setHomeLocation(gps.label)
      if (selectedCities.length === 0) {
        // Default looking area to detected district/city (user can change)
        const seed = gps.district || gps.city || gps.label
        setSelectedCities([seed])
      }
      if (gps.district && !cities.includes(gps.district)) {
        setDbCities(prev => [gps.district, ...prev])
      }
      if (gps.area && !cities.includes(gps.area) && gps.area !== gps.district) {
        setDbCities(prev => [gps.area, ...prev.filter(c => c !== gps.area)])
      }
    } else {
      // Fallback: profile / previous viewerCity
      const home = user?.city || user?.district || viewerCity || ''
      if (home) setHomeLocation(home)
      if (selectedCities.length === 0 && home) setSelectedCities([home])
    }
    setDetectingCity(false)
  }

  async function redetectHomeGps() {
    setDetectingCity(true)
    const gps = await getGPSLocation()
    setDetectingCity(false)
    if (!gps?.label) {
      showToast('Could not detect GPS location. Type your area instead.', 'warning')
      return
    }
    setGpsDetected(gps)
    setViewerCity(gps.label)
    setHomeLocation(gps.label)
    setHomeSearch('')
    showToast(`Detected: ${gps.label}`, 'success')
  }

  /* ── post request ── */
  async function handlePost() {
    if (!form.title.trim()) return
    if (!(homeLocation || '').trim()) {
      showToast('Please set where you stay', 'error')
      return
    }
    if (!selectedCities.length) {
      showToast('Add at least one area where you are looking', 'error')
      return
    }
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
    // Duration: number days | custom (uses form.customDays) | null = no expiry
    let durationDays = form.durationDays
    if (durationDays === 'custom') {
      durationDays = Number(form.customDays)
      if (!Number.isFinite(durationDays) || durationDays < 1) {
        showToast('Enter a custom duration of at least 1 day', 'error')
        setPosting(false)
        return
      }
      durationDays = Math.min(365, Math.floor(durationDays))
    } else if (durationDays == null || durationDays === 'none') {
      durationDays = null
    } else {
      durationDays = Number(durationDays)
      if (!Number.isFinite(durationDays) || durationDays <= 0) durationDays = 7
    }
    const expires_at = expiresAtFromDays(durationDays)

    // city = where buyer stays; cities = areas they are looking for the product
    const stay = homeLocation.trim()
    const lookingAreas = selectedCities.filter(Boolean)

    // Prefer GPS coords from stay detection when label still matches
    const stayGps =
      gpsDetected &&
      Number.isFinite(gpsDetected.lat) &&
      Number.isFinite(gpsDetected.lng) &&
      (!homeLocation || !gpsDetected.label || homeLocation === gpsDetected.label ||
        homeLocation.toLowerCase().includes(String(gpsDetected.district || '').toLowerCase()))
        ? gpsDetected
        : null

    const payload = {
      user_id: user.id,
      title: form.title.trim(),
      category: form.category,
      budget: form.budget ? Number(form.budget) : null,
      city: stay,
      cities: lookingAreas,
      detected_city: gpsDetected?.label || viewerCity || null,
      lat: stayGps?.lat ?? null,
      lng: stayGps?.lng ?? null,
      description: form.description.trim() || null,
      urgency: form.urgency,
      image_url,
      image_urls,
      status: 'open',
      offer_count: 0,
      view_count: 0,
      duration_days: durationDays,
      expires_at,
    }

    let { error } = await supabase.from('buyer_requests').insert(payload)
    // Older DBs without duration / lat-lng columns
    if (error && /expires_at|duration_days|lat|lng|column/i.test(error.message || '')) {
      const legacy = { ...payload }
      delete legacy.expires_at
      delete legacy.duration_days
      delete legacy.lat
      delete legacy.lng
      ;({ error } = await supabase.from('buyer_requests').insert(legacy))
      if (error && /expires_at|duration_days|column/i.test(error.message || '')) {
        const older = { ...legacy }
        delete older.expires_at
        delete older.duration_days
        ;({ error } = await supabase.from('buyer_requests').insert(older))
      }
    }
    setPosting(false)
    if (error) { showToast(`Failed: ${error.message}`, 'error'); console.error('Post error:', error); return }
    showToast(
      durationDays == null
        ? 'Request posted · prefer not to say (no auto-expiry)'
        : `Request posted · visible ${durationDays} day${durationDays === 1 ? '' : 's'}`,
      'success',
    )
    setForm({
      title: '', category: 'Electronics', budget: '', description: '',
      urgency: 'flexible', durationDays: 7, customDays: '',
    })
    setImages([]); setCoverIndex(0); setSelectedCities([])
    setHomeLocation(gpsDetected?.label || user?.city || user?.district || viewerCity || '')
    setHomeSearch(''); setCitySearch('')
    setComposerOpen(false)
    loadRequests()
  }

  /* ── send offer ── */
  async function sendOffer(req) {
    // Count a view when seller engages if they haven't already
    await trackRequestView(req)
    const looking = (req.cities?.length ? req.cities.join(', ') : '') || req.city || ''
    const msg = `Hi, I can help with your request: "${req.title}"${req.budget ? `\nBudget: ${fmtMWK(req.budget)}` : ''}${req.city ? `\nBuyer stays: ${req.city}` : ''}${looking ? `\nLooking in: ${looking}` : ''}\n\nI have exactly what you need. Let's discuss!`
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
    // Always attach request context so the thread is identified as Looking For
    navigate(`/chat/${req.user_id}/${req.id}?src=request`, {
      state: {
        source: 'request',
        isRequest: true,
        prefillMessage: msg,
        requestTitle: req.title,
      },
    })
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
  const localNearCount = tabReqs.filter(r => (r._locScore || 0) >= 85).length
  const viewerPlaceLabel =
    viewerLocation?.district ||
    viewerLocation?.city ||
    viewerLocation?.label ||
    viewerCity ||
    null

  const visibleCats    = ['All', ...CATEGORIES.filter(c => c !== 'All' && allCategories.has(c))]
  const malawCities    = [...new Set(requests.flatMap(r => r.cities?.length > 0 ? r.cities : (r.city ? [r.city] : [])))]

  /* ══════ RENDER ══════ */
  return (
    <div className="lf-page" style={{ minHeight:'100vh', background: C.bg, color: C.text, fontFamily:"'Inter',sans-serif", paddingBottom: 88 }}>

      {/* Shared marketplace header (same as Home) — only CTA differs */}
      <SokoNav
        user={user}
        notifCount={newNotifCount}
        search={headerSearch}
        setSearch={setHeaderSearch}
        navigate={navigate}
        activeDistrict={district}
        onDistrictChange={setDistrict}
        activePillar="lookingfor"
        ctaLabel="Post request"
        onCta={handleOpenComposer}
      />

      {/* ── HERO BANNER ── */}
      <div className="lf-hero" style={{
        position: 'relative',
        overflow: 'hidden',
        borderBottom: `1px solid ${C.border}`,
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${lookingForHero})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 40%',
          transform: 'scale(1.02)',
        }} />
        <div style={{
          position: 'absolute', inset: 0,
          background: `
            linear-gradient(105deg,
              rgba(6, 40, 22, 0.9) 0%,
              rgba(10, 80, 45, 0.78) 42%,
              rgba(15, 157, 88, 0.45) 72%,
              rgba(15, 157, 88, 0.28) 100%
            )
          `,
        }} />

        <div className="lf-hero-inner" style={{
          position: 'relative', zIndex: 1,
          padding: '36px 32px 28px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 28,
          maxWidth: 1200,
          margin: '0 auto',
        }}>
          <div style={{ maxWidth: 560, flex: 1, minWidth: 0 }}>
            <div className="lf-hero-badge" style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'rgba(255,255,255,0.14)',
              border: '1px solid rgba(255,255,255,0.22)',
              backdropFilter: 'blur(8px)',
              color: '#bbf7d0',
              fontSize: 11, fontWeight: 800, letterSpacing: 1.1,
              borderRadius: 999, padding: '6px 12px', marginBottom: 12,
              textTransform: 'uppercase',
            }}>
              <span style={{
                width: 7, height: 7, borderRadius: '50%', background: '#4ade80',
                boxShadow: '0 0 0 3px rgba(74,222,128,0.25)',
              }} />
              People are looking for
            </div>
            <h1 className="lf-hero-title" style={{
              fontSize: 34, fontWeight: 900, margin: '0 0 10px', lineHeight: 1.18,
              color: '#fff',
              textShadow: '0 2px 18px rgba(0,0,0,0.25)',
              letterSpacing: -0.5,
            }}>
              Find requests from buyers, employers &amp; customers
            </h1>
            <p className="lf-hero-sub" style={{
              color: 'rgba(255,255,255,0.85)', fontSize: 15, margin: 0, lineHeight: 1.55,
              maxWidth: 440, fontWeight: 500,
            }}>
              Buyers post what they need — respond and win the deal across Malawi.
            </p>

            <div className="lf-hero-actions" style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={handleOpenComposer}
                style={{
                  background: C.amber,
                  color: '#1a1a1a',
                  border: 'none',
                  borderRadius: 12,
                  padding: '12px 18px',
                  fontWeight: 800,
                  fontSize: 14,
                  cursor: 'pointer',
                  boxShadow: '0 4px 18px rgba(249,171,0,0.4)',
                  fontFamily: 'inherit',
                  flex: '1 1 auto',
                  minWidth: 140,
                }}
              >
                + Post a request
              </button>
              <button
                type="button"
                onClick={() => {
                  document.getElementById('lf-requests-grid')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                style={{
                  background: 'rgba(255,255,255,0.12)',
                  color: '#fff',
                  border: '1.5px solid rgba(255,255,255,0.35)',
                  borderRadius: 12,
                  padding: '12px 18px',
                  fontWeight: 700,
                  fontSize: 14,
                  cursor: 'pointer',
                  backdropFilter: 'blur(8px)',
                  fontFamily: 'inherit',
                  flex: '1 1 auto',
                  minWidth: 140,
                }}
              >
                Browse requests
              </button>
            </div>
          </div>

          <div className="lf-hero-side-card" style={{
            display: 'none',
            width: 260,
            flexShrink: 0,
            background: 'rgba(255,255,255,0.14)',
            border: '1px solid rgba(255,255,255,0.28)',
            backdropFilter: 'blur(16px)',
            borderRadius: 20,
            padding: 16,
            boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 800, color: '#bbf7d0', letterSpacing: 0.6, marginBottom: 10 }}>
              LIVE ON SOKO
            </div>
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', lineHeight: 1.35, marginBottom: 8 }}>
              Buyers post what they need — sellers respond first.
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
              Electronics · Jobs · Services · Fashion · Food & more
            </div>
          </div>
        </div>
      </div>

      {/* ── SEARCH + FILTER BAR ── */}
      <div className="lf-filter-section" style={{ padding:'16px 32px', background: C.bg, borderBottom:`1px solid ${C.border}` }}>
        <div className="lf-filter-bar" style={{ display:'flex', gap:10, alignItems:'center', background: C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:'4px 8px', flexWrap:'wrap' }}>
          <div className="lf-filter-search" style={{ flex:'1 1 160px', display:'flex', alignItems:'center', gap:8, padding:'6px 8px', minWidth:0 }}>
            <span style={{ display:'flex', color: C.gray2 }}>{Icon.search(15, C.gray2)}</span>
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search requests..."
              style={{ flex:1, background:'transparent', border:'none', outline:'none', color:C.text, fontSize:14, minWidth:0 }} />
            {search && (
              <button type="button" onClick={() => setSearch('')} style={{ background:'none', border:'none', cursor:'pointer', display:'flex', color:C.gray2, padding:0 }}>
                {Icon.x(14, C.gray2)}
              </button>
            )}
          </div>
          <div className="lf-filter-div" style={{ width:1, height:32, background: C.border, flexShrink:0 }} />
          <select className="lf-filter-select" value={category} onChange={e => { setCategory(e.target.value); setActiveTab('all') }}
            style={{ background:'transparent', border:'none', color:C.textSub, fontSize:13, padding:'8px 10px', cursor:'pointer', outline:'none', flex:'1 1 120px', minWidth:0 }}>
            {visibleCats.map(c => <option key={c} value={c} style={{ background:'#fff', color:'#202124' }}>{c === 'All' ? 'All Categories' : c}</option>)}
          </select>
          <div className="lf-filter-div" style={{ width:1, height:32, background: C.border, flexShrink:0 }} />
          <select className="lf-filter-select" value={locationFilter} onChange={e => setLocationFilter(e.target.value)}
            style={{ background:'transparent', border:'none', color:C.textSub, fontSize:13, padding:'8px 10px', cursor:'pointer', outline:'none', flex:'1 1 120px', minWidth:0 }}>
            <option value="All Locations" style={{ background:'#fff', color:'#202124' }}>All Locations</option>
            {malawCities.map(c => <option key={c} value={c} style={{ background:'#fff', color:'#202124' }}>{c}</option>)}
          </select>
          <div className="lf-filter-div lf-filter-div-budget" style={{ width:1, height:32, background: C.border, flexShrink:0 }} />
          <div className="lf-filter-budget" style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 8px' }}>
            <input value={budgetMin} onChange={e => setBudgetMin(e.target.value)} placeholder="Min"
              style={{ width:56, background:'transparent', border:'none', color:C.textSub, fontSize:13, outline:'none' }} />
            <span style={{ color: C.gray2, fontSize:13 }}>–</span>
            <input value={budgetMax} onChange={e => setBudgetMax(e.target.value)} placeholder="Max"
              style={{ width:56, background:'transparent', border:'none', color:C.textSub, fontSize:13, outline:'none' }} />
          </div>
          <button
            type="button"
            className="lf-mobile-filters-btn"
            onClick={() => setMobileFiltersOpen(true)}
            style={{
              display: 'none',
              alignItems: 'center', gap: 6,
              padding: '8px 12px', borderRadius: 8,
              border: `1px solid ${C.border}`, background: C.surface,
              color: C.textSub, fontSize: 13, fontWeight: 700,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {Icon.sliders(14, C.textSub)} Filters
          </button>
          <button
            type="button"
            className="lf-filter-more"
            onClick={() => setMoreFiltersOpen(p => !p)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'6px 12px', cursor:'pointer', color: moreFiltersOpen ? C.green : C.textSub, fontSize:13, whiteSpace:'nowrap', background:'none', border:'none', fontFamily:'inherit' }}
          >
            {Icon.sliders(14, moreFiltersOpen ? C.green : C.textSub)} More {moreFiltersOpen ? Icon.chevU(12) : Icon.chevD(12)}
          </button>
        </div>

        {/* More Filters panel */}
        {moreFiltersOpen && (
          <div style={{ marginTop:10, background: C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:'16px 20px', display:'flex', gap:24, flexWrap:'wrap', alignItems:'flex-end' }}>
            <div>
              <div style={{ fontSize:11, color: C.gray2, marginBottom:6, fontWeight:700 }}>URGENCY</div>
              <div style={{ display:'flex', gap:8 }}>
                {(URGENCY_OPTIONS || [{ value:'urgent', label:'Urgent' },{ value:'soon', label:'Soon' },{ value:'flexible', label:'Flexible' }]).map(u => (
                  <button key={u.value} style={{ padding:'6px 14px', borderRadius:20, border:`1px solid ${C.border}`, background: search === u.value ? C.greenDk : 'transparent', color: search === u.value ? '#fff' : C.textSub, fontSize:12, cursor:'pointer' }}
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
      <div className="lf-tabs-row" style={{ padding:'12px 32px', display:'flex', alignItems:'center', gap:0, borderBottom:`1px solid ${C.border}`, overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
        {[
          { id:'all',   label:'All', count: allReqs.length, ico: (s, c) => Icon.list(s, c) },
          { id:'mine',  label:'Mine',  count: myReqs.length, ico: (s, c) => Icon.user(s, c) },
          { id:'saved', label:'Saved', count: savedReqs.length, ico: (s, c) => Icon.bookmark(s, activeTab === 'saved', c) },
        ].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', border:'none', borderRight:`1px solid ${C.border}`, background: activeTab === t.id ? C.greenL : 'transparent', color: activeTab === t.id ? C.green : C.gray2, cursor:'pointer', fontSize:13, fontWeight: activeTab === t.id ? 700 : 500, whiteSpace:'nowrap', flexShrink:0 }}>
            <span style={{ display: 'flex' }}>{t.ico(13, activeTab === t.id ? C.green : C.gray3)}</span>
            <span>{t.label}</span>
            <span style={{ fontSize:12, color: activeTab === t.id ? C.green : C.gray3 }}>{t.count}</span>
          </button>
        ))}

        {visibleCats.filter(c => c !== 'All').map(c => (
          <button key={c} onClick={() => { setCategory(c); setActiveTab('all') }}
            style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 14px', border:'none', borderRight:`1px solid ${C.border}`, background: category === c && activeTab === 'all' ? C.greenL : 'transparent', color: category === c && activeTab === 'all' ? C.green : C.gray2, cursor:'pointer', fontSize:13, fontWeight: category === c && activeTab === 'all' ? 700 : 500, whiteSpace:'nowrap', flexShrink:0 }}>
            <CatIcon category={c} size={13} color={category === c && activeTab === 'all' ? C.green : C.gray3} />
            {c}
            {allReqs.filter(r => r.category === c).length > 0 && (
              <span style={{ fontSize:12, color: category === c && activeTab === 'all' ? C.green : C.gray3 }}>
                {allReqs.filter(r => r.category === c).length}
              </span>
            )}
          </button>
        ))}

        <div className="lf-sort-wrap" style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:8, flexShrink:0, paddingLeft:12 }}>
          <span className="lf-sort-label" style={{ fontSize:13, color:C.gray2 }}>Sort</span>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}
            style={{ background: C.surface, border:`1px solid ${C.border}`, color:C.textSub, borderRadius:6, padding:'5px 10px', fontSize:13, cursor:'pointer', outline:'none' }}>
            <option value="recent">Newest</option>
            <option value="budget">Budget</option>
            <option value="demand">Offers</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div id="lf-requests-grid" className="lf-main" style={{ display:'flex', padding:'20px 32px', gap:20, alignItems:'flex-start', minWidth:0, position:'relative' }}>

        {/* Mobile filter drawer backdrop */}
        {mobileFiltersOpen && (
          <div
            className="lf-drawer-backdrop"
            onClick={() => setMobileFiltersOpen(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 350,
              background: 'rgba(15,23,42,0.45)',
            }}
          />
        )}

        {/* ── LEFT SIDEBAR ── */}
        <div className={`lf-sidebar${mobileFiltersOpen ? ' is-open' : ''}`} style={{ width:240, flexShrink:0, background: C.surface, border:`1px solid ${C.border}`, borderRadius:10, padding:'18px 16px', position:'sticky', top:70, maxHeight:'calc(100vh - 80px)', overflowY:'auto' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <span style={{ fontWeight:700, fontSize:14, color:C.text }}>Refine Results</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button type="button" onClick={clearFilters} style={{ background:'none', border:'none', fontSize:13, color: C.green, fontWeight:700, cursor:'pointer' }}>Clear all</button>
              <button
                type="button"
                className="lf-drawer-close"
                onClick={() => setMobileFiltersOpen(false)}
                style={{ display: 'none', background: C.bg, border: 'none', borderRadius: '50%', width: 32, height: 32, cursor: 'pointer', fontSize: 18, color: C.gray2 }}
              >
                ×
              </button>
            </div>
          </div>

          {/* Categories */}
          <div style={{ fontSize:11, color:C.gray2, marginBottom:10, fontWeight:600 }}>CATEGORIES</div>
          {visibleCats.map(c => (
            <label key={c} onClick={() => { setCategory(c); setActiveTab('all') }}
              style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', marginBottom:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <div style={{ width:15, height:15, borderRadius:4, border:`2px solid ${category === c ? C.green : C.border}`, background: category === c ? C.green : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  {category === c && <span style={{ color:'#fff', fontSize:9, fontWeight:900 }}>✓</span>}
                </div>
                <span style={{ fontSize:13, color: category === c ? C.text : C.textSub, fontWeight: category === c ? 700 : 400 }}>{c === 'All' ? 'All Categories' : c}</span>
              </div>
              <span style={{ fontSize:12, color:C.gray3 }}>{c === 'All' ? allReqs.length : allReqs.filter(r => r.category === c).length || ''}</span>
            </label>
          ))}

          <div style={{ height:1, background: C.border, margin:'14px 0' }} />

          {/* Budget Range */}
          <div style={{ fontSize:11, color:C.gray2, marginBottom:10, fontWeight:600 }}>BUDGET RANGE (MWK)</div>
          
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
              <span style={{ fontSize:10, color:C.gray3, flexShrink:0 }}>MK 0</span>
              <span style={{ fontSize:10, color: C.green, fontWeight:700, textAlign:'center', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'50%' }}>
                {budgetMax ? `MK ${Number(budgetMax).toLocaleString()}` : 'Any'}
              </span>
              <span style={{ fontSize:10, color:C.gray3, flexShrink:0 }}>MK 2M</span>
            </div>
          </div>

          {/* Manual inputs */}
          <div style={{ display:'flex', gap:6, marginBottom:12, width:'100%', boxSizing:'border-box' }}>
            <input
              placeholder="Min"
              value={budgetMin}
              onChange={e => setBudgetMin(e.target.value)}
              type="number"
              style={{ width:0, flex:1, minWidth:0, background:C.bg, border:`1px solid ${C.border}`, borderRadius:6, padding:'6px 8px', color:C.textSub, fontSize:12, outline:'none', boxSizing:'border-box' }}
            />
            <span style={{ color:C.gray2, alignSelf:'center', fontSize:12, flexShrink:0 }}>–</span>
            <input
              placeholder="Max"
              value={budgetMax}
              onChange={e => setBudgetMax(e.target.value)}
              type="number"
              style={{ width:0, flex:1, minWidth:0, background:C.bg, border:`1px solid ${C.border}`, borderRadius:6, padding:'6px 8px', color:C.textSub, fontSize:12, outline:'none', boxSizing:'border-box' }}
            />
          </div>

          {/* Active filter indicator */}
          {(budgetMin || budgetMax) && (
            <div style={{ fontSize:11, color: C.green, marginBottom:8, fontWeight:600 }}>
              Filter: {budgetMin ? `MK ${Number(budgetMin).toLocaleString()}` : 'MK 0'} → {budgetMax ? `MK ${Number(budgetMax).toLocaleString()}` : 'Any'}
            </div>
          )}

          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => { loadRequests(); setMobileFiltersOpen(false) }}
              style={{ flex:1, background: C.greenDk, color:'#fff', border:'none', borderRadius:6, padding:'9px 0', fontWeight:700, fontSize:13, cursor:'pointer' }}>
              Apply
            </button>
            {(budgetMin || budgetMax) && (
              <button onClick={() => { setBudgetMin(''); setBudgetMax(''); setRangeValue(50); setTimeout(loadRequests, 0) }}
                style={{ padding:'9px 12px', background:'transparent', border:`1px solid ${C.border}`, borderRadius:6, color:C.gray2, fontSize:12, cursor:'pointer' }}>
                ✕
              </button>
            )}
          </div>

          <div style={{ height:1, background: C.border, margin:'14px 0' }} />

          {/* Location */}
          <div style={{ fontSize:11, color:C.gray2, marginBottom:10, fontWeight:600 }}>LOCATION</div>
          {['All Locations', ...malawCities.slice(0, 8)].map(loc => (
            <label key={loc} onClick={() => { setLocationFilter(loc) }}
              style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer', marginBottom:10 }}>
              <div style={{ width:15, height:15, borderRadius:4, border:`2px solid ${locationFilter === loc ? C.green : C.border}`, background: locationFilter === loc ? C.green : 'transparent', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                {locationFilter === loc && <span style={{ color:C.text, fontSize:9, fontWeight:900 }}>✓</span>}
              </div>
              <span style={{ fontSize:13, color: locationFilter === loc ? C.text : C.textSub, fontWeight: locationFilter === loc ? 700 : 400 }}>{loc}</span>
            </label>
          ))}
        </div>

        {/* ── CARDS GRID ── */}
        <div className="lf-cards-col" style={{ flex:1, minWidth:0, width: '100%' }}>
          {/* Local-first GPS banner */}
          <div className="lf-gps-banner" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            flexWrap: 'wrap',
            marginBottom: 14, padding: '12px 14px',
            background: C.greenL, border: `1px solid ${C.green}`,
            borderRadius: 12,
          }}>
            <div style={{ minWidth: 0, flex: 1, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{
                width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: '#fff', border: `1px solid ${C.green}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.green,
              }}>
                {Icon.nav(15, C.green)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 800, color: C.green }}>
                  {detectingViewer
                    ? 'Detecting your location…'
                    : viewerPlaceLabel
                      ? `Near you · ${viewerPlaceLabel}`
                      : 'Location not detected'}
                </div>
                <div style={{ fontSize: 11, color: C.textSub, fontWeight: 600, marginTop: 3, lineHeight: 1.4 }}>
                  {viewerPlaceLabel
                    ? localNearCount > 0
                      ? `${localNearCount} request${localNearCount === 1 ? '' : 's'} looking in your area shown first`
                      : 'No local matches yet · other requests below'
                    : 'Allow GPS so requests looking in your city appear first'}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={redetectViewerGps}
              disabled={detectingViewer}
              style={{
                flexShrink: 0, border: `1.5px solid ${C.green}`, background: '#fff',
                color: C.green, borderRadius: 10, padding: '8px 12px',
                fontSize: 12, fontWeight: 800, cursor: detectingViewer ? 'default' : 'pointer',
                fontFamily: 'inherit', opacity: detectingViewer ? 0.6 : 1,
                display: 'flex', alignItems: 'center', gap: 5,
              }}
            >
              {Icon.nav(13, C.green)}
              {detectingViewer ? '…' : 'Update GPS'}
            </button>
          </div>

          {loading && (
            <div style={{ textAlign:'center', padding:'48px 0' }}>
              <div style={{ color: C.green, fontSize:14 }}>Loading requests…</div>
            </div>
          )}
          {!loading && tabReqs.length === 0 && (
            <div style={{ textAlign:'center', padding:'48px 20px', background: C.surface, borderRadius:18, border:`1px solid ${C.border}` }}>
              <div style={{
                width:56, height:56, borderRadius:16, margin:'0 auto 14px',
                background: C.greenL, color: C.green,
                display:'flex', alignItems:'center', justifyContent:'center',
              }}>
                {Icon.search(24, C.green)}
              </div>
              <div style={{ fontSize:17, fontWeight:700, marginBottom:8 }}>No requests found</div>
              <div style={{ fontSize:13, color:C.gray2, marginBottom:20 }}>Try different filters or be the first to post a request.</div>
              <button onClick={handleOpenComposer}
                style={{ background: C.greenDk, color:'#fff', border:'none', borderRadius:10, padding:'12px 20px', fontWeight:700, fontSize:14, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6 }}>
                {Icon.plus(14, '#fff')} Post request
              </button>
            </div>
          )}
          {!loading && tabReqs.length > 0 && (
            <div className="lf-cards-grid">
              {tabReqs.map(req => (
                <LookingForRequestCard
                  key={req.id}
                  req={req}
                  user={user}
                  saved={savedIds.has(req.id)}
                  isNearYou={(req._locScore || 0) >= 85}
                  onOffer={sendOffer}
                  onSave={toggleSave}
                  onFulfill={markFulfilled}
                  onDelete={deleteRequest}
                  onViewDetails={openRequestDetails}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Responsive CSS */}
      <style>{`
        .lf-page { overflow-x: hidden; max-width: 100vw; box-sizing: border-box; }
        .lf-page *, .lf-page *::before, .lf-page *::after { box-sizing: border-box; }
        .lf-drawer-close { display: none !important; }
        .lf-mobile-filters-btn { display: none !important; }
        .lf-nav-post-short { display: none !important; }

        .lf-nav-icon-btn {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 6px;
          border-radius: 10px;
          color: ${C.textSub};
          font-family: inherit;
          position: relative;
        }
        .lf-nav-icon-btn:hover { background: ${C.greenL}; color: ${C.green}; }
        .lf-nav-action-label {
          font-size: 10px;
          color: ${C.gray1};
          font-weight: 600;
        }
        .lf-nav-badge {
          position: absolute;
          top: 0;
          right: 0;
          min-width: 16px;
          height: 16px;
          padding: 0 4px;
          border-radius: 999px;
          background: ${C.red};
          color: #fff;
          font-size: 9px;
          font-weight: 800;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* ── Request cards grid ── */
        .lf-cards-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
          align-items: stretch;
        }
        ${LOOKING_FOR_CARD_CSS}
        @media (min-width: 900px) {
          .lf-hero-side-card { display: block !important; }
          .lf-card-media { height: 168px !important; min-height: 168px !important; max-height: 168px !important; }
        }
        @media (max-width: 1024px) and (min-width: 641px) {
          .lf-cards-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 12px !important; }
        }
        @media (max-width: 640px) {
          .lf-cards-grid { grid-template-columns: 1fr !important; gap: 10px !important; }
        }

        @media (max-width: 900px) {
          .lf-nav { padding: 0 12px !important; gap: 8px !important; height: 56px !important; }
          .lf-nav-logo { font-size: 18px !important; margin-right: 0 !important; }
          .lf-nav-district { display: none !important; }
          .lf-nav-search { height: 36px !important; padding: 0 10px !important; }
          .lf-nav-action-label { display: none !important; }
          .lf-nav-actions { gap: 8px !important; }
          .lf-nav-chat { display: none !important; }
          .lf-nav-post { padding: 8px 12px !important; font-size: 13px !important; }
          .lf-nav-post-full { display: none !important; }
          .lf-nav-post-short { display: inline !important; }
          .lf-nav-avatar { width: 34px !important; height: 34px !important; }

          .lf-hero-inner { padding: 22px 16px 20px !important; flex-direction: column !important; align-items: stretch !important; gap: 0 !important; }
          .lf-hero-title { font-size: 22px !important; letter-spacing: -0.3px !important; }
          .lf-hero-sub { font-size: 13px !important; }
          .lf-hero-badge { font-size: 10px !important; margin-bottom: 10px !important; }
          .lf-hero-actions { margin-top: 14px !important; }
          .lf-hero-actions button { min-width: 0 !important; padding: 11px 14px !important; font-size: 13px !important; }

          .lf-filter-section { padding: 12px 12px !important; }
          .lf-filter-bar { padding: 8px !important; gap: 8px !important; }
          .lf-filter-div { display: none !important; }
          .lf-filter-budget { display: none !important; }
          .lf-filter-more { display: none !important; }
          .lf-mobile-filters-btn { display: inline-flex !important; flex: 0 0 auto !important; }
          .lf-filter-search { flex: 1 1 100% !important; background: ${C.bg}; border-radius: 8px; }
          .lf-filter-select { flex: 1 1 45% !important; background: ${C.bg} !important; border-radius: 8px !important; border: 1px solid ${C.border} !important; }

          .lf-tabs-row { padding: 8px 12px !important; gap: 0 !important; scrollbar-width: none; }
          .lf-tabs-row::-webkit-scrollbar { display: none; }
          .lf-sort-wrap { margin-left: 8px !important; padding-left: 8px !important; }
          .lf-sort-label { display: none !important; }

          .lf-main { flex-direction: column !important; padding: 12px 12px 24px !important; gap: 12px !important; }
          .lf-sidebar {
            display: none !important;
            position: fixed !important;
            left: 0 !important; right: 0 !important; bottom: 0 !important;
            top: auto !important;
            width: 100% !important;
            max-height: min(78vh, 640px) !important;
            border-radius: 18px 18px 0 0 !important;
            z-index: 360 !important;
            box-shadow: 0 -12px 40px rgba(0,0,0,0.2) !important;
            padding-bottom: calc(18px + env(safe-area-inset-bottom, 0px)) !important;
          }
          .lf-sidebar.is-open { display: block !important; }
          .lf-drawer-close { display: flex !important; align-items: center; justify-content: center; }

          .lf-gps-banner { padding: 10px 12px !important; }
        }

        @media (max-width: 380px) {
          .lf-hero-title { font-size: 20px !important; }
        }

        @media (max-width: 900px) {
          .lf-alerts-panel {
            position: fixed !important;
            top: 56px !important;
            left: 12px !important;
            right: 12px !important;
            width: auto !important;
            max-width: none !important;
          }
          .lf-detail-thumbs { gap: 6px !important; padding: 0 0 2px !important; }
          .lf-detail-thumb-btn { width: 52px !important; height: 52px !important; border-radius: 8px !important; }
          .lf-detail-thumb-btn.is-active { border-width: 2.5px !important; }
          .lf-detail-thumb-btn:hover { transform: scale(1.04); }
          .lf-detail-main-photo { height: 180px !important; }
        }
        @media (max-width: 640px) {
          .lf-detail-main-photo { height: clamp(160px, 35vw, 220px) !important; border-radius: 12px !important; }
          .lf-detail-thumbs { gap: 6px !important; margin-top: 8px !important; }
          .lf-detail-thumb-btn { width: 56px !important; height: 56px !important; border-radius: 10px !important; }
        }
      `}</style>

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
        homeLocation={homeLocation}
        onHomeLocationChange={setHomeLocation}
        homeSearch={homeSearch}
        onHomeSearch={setHomeSearch}
        gpsDetected={gpsDetected}
        onRedetectGps={redetectHomeGps}
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
        <div style={{ position:'fixed', bottom:90, left:'50%', transform:'translateX(-50%)', background: toast.type==='error' ? C.red : toast.type==='warning' ? '#d97706' : C.greenDk, color:C.text, borderRadius:10, padding:'12px 24px', fontWeight:700, fontSize:14, zIndex:9999, boxShadow:'0 4px 20px rgba(0,0,0,0.4)' }}>
          {toast.msg}
        </div>
      )}
    </div>
  )
}

/* ══════════════════════════════════════════════════════
   VIEW DETAILS MODAL — modern icons + share
══════════════════════════════════════════════════════ */
function DetailModal({ req, user, myListings, saved, onClose, onOffer, onSave, onFulfill, onDelete, userHasOffered }) {
  const [mainIdx, setMainIdx] = useState(0)
  const [shareNote, setShareNote] = useState(null)
  const isOwn  = req.user_id === user?.id
  const name   = req.profiles?.full_name || 'Buyer'
  const avatar = req.profiles?.avatar_url
  const initial = name[0]?.toUpperCase() || 'B'
  const budget = req.budget ? fmtMWK(req.budget) : 'Negotiable'
  const stayHere = req.city || null
  const lookingAreas = (req.cities?.length ? req.cities : []).filter(Boolean)
  const urgOpt = (URGENCY_OPTIONS || []).find(u => u.value === req.urgency)
  const match  = !isOwn ? getMatchScore(req, myListings) : null
  const photos = req.image_urls?.length > 0
    ? req.image_urls
    : (req.image_url ? [req.image_url] : [])
  const mainPhoto = photos[mainIdx] || photos[0] || null

  let expiresLabel = null
  if (req.expires_at) {
    const ms = new Date(req.expires_at) - Date.now()
    if (ms > 0) {
      const days = Math.ceil(ms / 86400000)
      expiresLabel = days === 1 ? '1 day left' : `${days} days left`
    } else {
      expiresLabel = 'Expired'
    }
  } else if (req.duration_days) {
    expiresLabel = `${req.duration_days} day post`
  }

  const shareUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/looking-for?request=${req.id}`
    : ''
  const shareText = `Looking for on SokoMw: ${req.title || 'Request'}${budget ? ` · ${budget}` : ''}`

  async function handleShare() {
    // Desktop: always copy link only. Mobile: native share sheet when available.
    const isMobile = typeof navigator !== 'undefined'
      && /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
    try {
      if (isMobile && navigator.share) {
        await navigator.share({
          title: req.title || 'Looking For — SokoMw',
          text: shareText,
          url: shareUrl,
        })
        setShareNote('Shared')
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl)
        setShareNote('Link copied')
      } else {
        window.prompt('Copy this link', shareUrl)
        setShareNote('Copy the link')
      }
    } catch (e) {
      if (e?.name === 'AbortError') return
      try {
        await navigator.clipboard?.writeText(shareUrl)
        setShareNote('Link copied')
      } catch {
        setShareNote('Could not copy link')
      }
    }
    setTimeout(() => setShareNote(null), 2200)
  }

  const infoCards = [
    { label: 'Budget', value: budget, accent: C.green, ico: Icon.wallet },
    { label: 'Category', value: req.category || '—', accent: C.text, ico: (s, c) => <CatIcon category={req.category} size={s} color={c} /> },
    { label: 'Posted', value: timeAgo(req.created_at), accent: C.textSub, ico: Icon.clock },
    { label: 'Duration', value: expiresLabel || 'Open', accent: C.green, ico: Icon.clock },
    ...(req._distanceLabel
      ? [{
          label: 'To buyer',
          value: req._distanceLabel,
          accent: C.green,
          ico: Icon.nav,
          hint: req._distanceApprox
            ? `Estimated${req._distancePlace ? ` · ${req._distancePlace}` : ''}`
            : `GPS${req._distancePlace ? ` · ${req._distancePlace}` : ''}`,
        }]
      : []),
  ]

  const iconBtn = {
    width: 36, height: 36, borderRadius: '50%', border: `1.5px solid ${C.border}`,
    background: C.bg, cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: C.gray1, padding: 0, flexShrink: 0,
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(15,23,42,0.55)', backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{
        background: C.surface,
        borderRadius: '22px 22px 0 0',
        width: '100%', maxWidth: 520,
        maxHeight: '92vh', overflowY: 'auto',
        boxShadow: '0 -12px 48px rgba(0,0,0,0.2)',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.border }} />
        </div>

        {/* Top bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 18px 14px', borderBottom: `1px solid ${C.border}`, gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, flex: 1 }}>
            <div style={{
              width: 44, height: 44, borderRadius: '50%', overflow: 'hidden',
              background: `linear-gradient(135deg,${C.green},${C.greenDk})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0,
            }}>
              {avatar
                ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : initial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14, color: C.text, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
                {req.profiles?.is_verified === true && Icon.verified(15)}
              </div>
              <div style={{ fontSize: 11, color: C.gray2, fontWeight: 600, marginTop: 2, display: 'flex', alignItems: 'center', gap: 5 }}>
                {Icon.spark(11, C.green)} Looking For · SokoMw
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button type="button" onClick={handleShare} style={iconBtn} title="Share" aria-label="Share">
              {Icon.share(16, C.gray1)}
            </button>
            <button type="button" onClick={onClose} style={iconBtn} title="Close" aria-label="Close">
              {Icon.x(16, C.gray1)}
            </button>
          </div>
        </div>

        {shareNote && (
          <div style={{
            margin: '10px 18px 0', padding: '8px 12px', borderRadius: 10,
            background: C.greenL, color: C.green, fontSize: 12, fontWeight: 700,
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            {Icon.check(14, C.green)} {shareNote}
          </div>
        )}

        <div style={{ padding: '16px 18px 28px' }}>
          {/* Photos */}
          {mainPhoto ? (
            <div style={{ marginBottom: 16 }}>
              <div className="lf-detail-main-photo" style={{
                width: '100%', height: 'clamp(180px, 30vw, 280px)', borderRadius: 16, overflow: 'hidden',
                background: C.bg, position: 'relative',
              }}>
                <img
                  src={mainPhoto}
                  alt={req.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
                {photos.length > 1 && (
                  <div style={{
                    position: 'absolute', bottom: 10, right: 10,
                    background: 'rgba(0,0,0,0.55)', color: '#fff',
                    borderRadius: 999, padding: '4px 10px',
                    fontSize: 11, fontWeight: 800,
                  }}>
                    {mainIdx + 1} / {photos.length}
                  </div>
                )}
              </div>
              {photos.length > 1 && (
                <ul className="lf-detail-thumbs" style={{
                  display: 'flex', gap: 8, marginTop: 10, overflowX: 'auto',
                  listStyle: 'none', padding: 0, margin: '10px 0 0', scrollSnapType: 'x mandatory',
                  WebkitOverflowScrolling: 'touch',
                }}>
                  {photos.map((url, i) => (
                    <li key={url + i} style={{ flexShrink: 0, scrollSnapAlign: 'start' }}>
                      <button
                        type="button"
                        onClick={() => setMainIdx(i)}
                        className={`lf-detail-thumb-btn${i === mainIdx ? ' is-active' : ''}`}
                        style={{
                          width: 64, height: 64, borderRadius: 10, overflow: 'hidden',
                          border: i === mainIdx ? `2.5px solid ${C.green}` : `1.5px solid ${C.border}`,
                          padding: 0, cursor: 'pointer', display: 'block', background: C.bg,
                          transition: 'border-color 0.15s, transform 0.15s',
                        }}
                      >
                        <img src={url} alt="" loading="lazy"
                          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div style={{
              height: 120, borderRadius: 16, marginBottom: 16,
              background: `linear-gradient(135deg,${C.greenL},#f0fdf4)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: C.green,
            }}>
              <CatIcon category={req.category} size={40} color={C.green} />
            </div>
          )}

          {/* Badges */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            <span style={{
              fontSize: 11, fontWeight: 800, color: C.green, background: C.greenL,
              borderRadius: 999, padding: '5px 10px',
              display: 'inline-flex', alignItems: 'center', gap: 5,
            }}>
              <CatIcon category={req.category} size={12} color={C.green} />
              {req.category}
            </span>
            {urgOpt && (
              <span style={{
                fontSize: 11, fontWeight: 800,
                color: urgOpt.color || C.red,
                background: urgOpt.bg || '#fff0f0',
                borderRadius: 999, padding: '5px 10px',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                {Icon.lightning(11, urgOpt.color || C.red)} {urgOpt.label}
              </span>
            )}
            {match != null && match >= 40 && (
              <span style={{
                fontSize: 11, fontWeight: 800, color: C.green,
                background: 'rgba(15,157,88,0.12)', borderRadius: 999, padding: '5px 10px',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                {Icon.spark(11, C.green)} {match}% match
              </span>
            )}
            {expiresLabel && (
              <span style={{
                fontSize: 11, fontWeight: 800, color: '#b45309',
                background: '#fffbeb', borderRadius: 999, padding: '5px 10px',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}>
                {Icon.clock(11, '#b45309')} {expiresLabel}
              </span>
            )}
          </div>

          <h2 style={{
            fontSize: 22, fontWeight: 900, color: C.text, margin: '0 0 10px',
            lineHeight: 1.25, letterSpacing: -0.3,
          }}>
            {req.title}
          </h2>

          {req.description ? (
            <p style={{ fontSize: 14, color: C.gray1, lineHeight: 1.65, margin: '0 0 18px' }}>
              {req.description}
            </p>
          ) : (
            <p style={{ fontSize: 13, color: C.gray3, fontStyle: 'italic', margin: '0 0 18px' }}>
              No extra description provided.
            </p>
          )}

          {/* Info grid */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16,
          }}>
            {infoCards.map(card => (
              <div
                key={card.label}
                style={{
                  background: card.label === 'To buyer' ? C.greenL : C.bg,
                  borderRadius: 14, padding: '12px 14px',
                  border: `1px solid ${card.label === 'To buyer' ? C.green : C.border}`,
                }}
              >
                <div style={{
                  fontSize: 10, fontWeight: 800, color: C.gray2,
                  textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <span style={{ display: 'flex', color: card.accent }}>
                    {typeof card.ico === 'function' ? card.ico(12, card.accent) : null}
                  </span>
                  {card.label}
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: card.accent, lineHeight: 1.3 }}>
                  {card.value}
                </div>
                {card.hint && (
                  <div style={{ fontSize: 10, color: C.gray2, fontWeight: 600, marginTop: 4 }}>
                    {card.hint}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Locations */}
          <div style={{
            background: 'linear-gradient(145deg,#f0fdf4,#ffffff)',
            border: `1.5px solid ${C.green}33`,
            borderRadius: 16, padding: 14, marginBottom: 16,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 800, color: C.green,
              textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              {Icon.pin(13, C.green)} Locations
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: C.gray2, marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  {Icon.home(12, C.gray2)} Where they stay
                </div>
                {stayHere ? (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    background: C.surface, border: `1px solid ${C.border}`,
                    borderRadius: 999, padding: '6px 12px',
                    fontSize: 13, fontWeight: 700, color: C.text,
                  }}>
                    {Icon.pin(12, C.green)} {stayHere}
                  </span>
                ) : (
                  <span style={{ fontSize: 13, color: C.gray3, fontWeight: 600 }}>Not specified</span>
                )}
                {req._distanceLabel && !isOwn && (
                  <div style={{
                    marginTop: 8, fontSize: 12, fontWeight: 700, color: C.green,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {Icon.nav(13, C.green)}
                    {req._distanceApprox ? 'Est. ' : ''}{req._distanceLabel} from you to buyer
                  </div>
                )}
              </div>
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 700, color: C.gray2, marginBottom: 6,
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  {Icon.search(12, C.gray2)} Looking for product in
                </div>
                {lookingAreas.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {lookingAreas.map(c => (
                      <span
                        key={c}
                        style={{
                          background: `linear-gradient(135deg,${C.green},${C.greenDk})`,
                          color: '#fff', borderRadius: 999, padding: '6px 12px',
                          fontSize: 12, fontWeight: 700,
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                        }}
                      >
                        {Icon.pin(11, '#fff')} {c}
                      </span>
                    ))}
                  </div>
                ) : (
                  <span style={{ fontSize: 13, color: C.gray3, fontWeight: 600 }}>
                    {stayHere || 'Anywhere'}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Engagement */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            marginBottom: 18, padding: '12px 0',
            borderTop: `1px solid ${C.border}`, borderBottom: `1px solid ${C.border}`,
          }}>
            <span style={{ fontSize: 13, color: C.gray1, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {Icon.users(15, C.gray1)} {req.offer_count || 0} {(req.offer_count || 0) === 1 ? 'offer' : 'offers'}
            </span>
            <span style={{ fontSize: 13, color: C.gray1, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {Icon.eye(15, C.gray1)} {req.view_count || 0} views
            </span>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={handleShare}
              style={{
                padding: '12px 14px', border: `1.5px solid ${C.border}`,
                borderRadius: 12, background: C.surface,
                color: C.text, fontWeight: 700, fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {Icon.share(15, C.text)} Share
            </button>
            <button
              type="button"
              onClick={() => onSave(req.id)}
              style={{
                padding: '12px 14px', border: `1.5px solid ${C.border}`,
                borderRadius: 12, background: C.surface,
                color: saved ? C.red : C.text, fontWeight: 700, fontSize: 13,
                cursor: 'pointer', fontFamily: 'inherit',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}
            >
              {Icon.bookmark(15, saved, saved ? C.red : C.text)}
              {saved ? 'Saved' : 'Save'}
            </button>
            {isOwn ? (
              <>
                <button
                  type="button"
                  onClick={() => { onFulfill(req.id); onClose() }}
                  style={{
                    flex: 1, minWidth: 100, padding: '12px 0', border: 'none', borderRadius: 12,
                    background: C.green, color: '#fff', fontWeight: 800, fontSize: 13,
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {Icon.check(15, '#fff')} Fulfilled
                </button>
                <button
                  type="button"
                  onClick={() => { onDelete(req.id); onClose() }}
                  style={{
                    flex: 1, minWidth: 90, padding: '12px 0', border: `1.5px solid ${C.red}`,
                    borderRadius: 12, background: 'transparent', color: C.red,
                    fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  }}
                >
                  {Icon.trash(15, C.red)} Delete
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => { onOffer(req); onClose() }}
                style={{
                  flex: 1, minWidth: 120, padding: '13px 0', border: 'none', borderRadius: 12,
                  background: userHasOffered ? C.border : `linear-gradient(135deg,${C.green},${C.greenDk})`,
                  color: userHasOffered ? C.gray2 : '#fff',
                  fontWeight: 800, fontSize: 14, cursor: 'pointer',
                  boxShadow: userHasOffered ? 'none' : '0 4px 16px rgba(15,157,88,0.35)',
                  fontFamily: 'inherit',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}
              >
                {userHasOffered
                  ? <><span style={{ display: 'inline-flex' }}>{Icon.check(15, C.gray2)}</span> Offer sent</>
                  : <><span style={{ display: 'inline-flex' }}>{Icon.send(15, '#fff')}</span> {req.category === 'Jobs' ? 'Apply now' : 'Submit offer'}</>}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}