import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import BottomNav from '../components/BottomNav'

async function getGPSCity() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) { resolve(null); return }
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${coords.latitude}&longitude=${coords.longitude}&localityLanguage=en`
          )
          const data = await res.json()
          console.log('[GPS] BigDataCloud:', JSON.stringify(data))
          const city = data.city || data.locality || data.principalSubdivision || null
          resolve(city)
        } catch {
          // Fallback to Nominatim
          try {
            const res2 = await fetch(
              `https://nominatim.openstreetmap.org/reverse?lat=${coords.latitude}&lon=${coords.longitude}&format=json&zoom=12&accept-language=en`
            )
            const data2 = await res2.json()
            const addr = data2.address || {}
            const city = addr.town || addr.city_district || addr.suburb || addr.city || addr.village || null
            resolve(city)
          } catch { resolve(null) }
        }
      },
      () => resolve(null),
      { timeout: 10000 }
    )
  })
}

async function getDBCities(supabaseClient) {
  const { data } = await supabaseClient
    .from('listings')
    .select('city')
    .not('city', 'is', null)
    .eq('status', 'active')
  const cities = [...new Set((data || []).map(r => r.city?.trim()).filter(Boolean))].sort()
  return cities
}

const CATEGORIES = ['All','Electronics','Fashion','Vehicles','Property','Furniture','Agriculture','Food','Services','Jobs','Other']

export default function LookingFor() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)
  const [requests, setRequests] = useState([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('All')
  const [composerOpen, setComposerOpen] = useState(false)
  const [form, setForm] = useState({ title: '', category: 'Electronics', budget: '', city: '', description: '' })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [selectedCities, setSelectedCities] = useState([])
  const [dbCities, setDbCities] = useState([])
  const [citySearch, setCitySearch] = useState('')
  const [detectingCity, setDetectingCity] = useState(false)
  const [posting, setPosting] = useState(false)
  const [toast, setToast] = useState('')
  const [viewerCity, setViewerCity] = useState(null)
  const [detectingViewer, setDetectingViewer] = useState(true)
  const [manualCityEdit, setManualCityEdit] = useState(false)
  const [manualCityInput, setManualCityInput] = useState('')
  const [cityInputSuggestions, setCityInputSuggestions] = useState([])
  const fileRef = useRef()

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { navigate('/login'); return }
      supabase.from('profiles').select('full_name, avatar_url, city')
        .eq('id', user.id).maybeSingle()
        .then(async ({ data }) => {
          const profile = data || {}
          setUser({ ...user, ...profile })
          // Always use GPS for viewer city — never use saved profile city
          setDetectingViewer(true)
          const gpsCity = await getGPSCity()
          setViewerCity(gpsCity)
          setDetectingViewer(false)
        })
    })
  }, [])

  useEffect(() => {
    if (!detectingViewer) loadRequests(viewerCity)
  }, [category, detectingViewer, viewerCity])

  async function loadRequests(resolvedCity) {
    setLoading(true)

    let query = supabase
      .from('buyer_requests')
      .select(`*, profiles:user_id(full_name, avatar_url)`)
      .order('created_at', { ascending: false })
      .limit(50)

    if (category !== 'All') query = query.eq('category', category)

    const { data, error } = await query
    if (!error) {
      const filtered = (data || []).filter(r => {
        if (!r.cities || r.cities.length === 0) return true // legacy posts
        if (!resolvedCity) return false // no location — show nothing
        return r.cities.some(c => c.toLowerCase() === resolvedCity.toLowerCase())
      })
      setRequests(filtered)
    }
    setLoading(false)
  }
  function timeAgo(ts) {
    const diff = Date.now() - new Date(ts).getTime()
    const h = Math.floor(diff / 3600000)
    const m = Math.floor(diff / 60000)
    if (h >= 24) return `${Math.floor(h/24)}d ago`
    if (h >= 1) return `${h}h ago`
    return `${m}m ago`
  }

  function showToast(msg) { setToast(msg); setTimeout(() => setToast(''), 2500) }

  async function openComposer() {
    setComposerOpen(true)
    // Load DB cities
    const cities = await getDBCities(supabase)
    setDbCities(cities)
    // GPS detect
    if (selectedCities.length === 0) {
      setDetectingCity(true)
      const gpsCity = await getGPSCity()
      setDetectingCity(false)
      if (gpsCity) {
        setSelectedCities([gpsCity])
        if (!cities.includes(gpsCity)) setDbCities(prev => [gpsCity, ...prev])
      }
    }
  }

  async function handlePost() {
    if (!form.title.trim()) return
    setPosting(true)
    let image_url = null
    if (imageFile) {
      const ext = imageFile.name.split('.').pop()
      const path = `${user.id}/${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('buyer-requests').upload(path, imageFile, { contentType: imageFile.type })
      if (!upErr) {
        const { data: urlData } = supabase.storage.from('buyer-requests').getPublicUrl(path)
        image_url = urlData.publicUrl
      }
    }
    const { error } = await supabase.from('buyer_requests').insert({
      user_id: user.id,
      title: form.title.trim(),
      category: form.category,
      budget: form.budget ? Number(form.budget) : null,
      city: selectedCities[0] || null,
      cities: selectedCities.length > 0 ? selectedCities : [],
      detected_city: viewerCity || null,
      description: form.description.trim() || null,
      image_url,
    })
    setPosting(false)
    if (error) { showToast('❌ Failed to post'); return }

    // ── Auto-match: notify sellers with matching listings ──
    if (!error) {
      try {
        let matchQuery = supabase
          .from('listings')
          .select('seller_id, title, price, city, category')
          .eq('status', 'active')
          .eq('category', form.category)
          .neq('seller_id', user.id)

        if (form.budget) matchQuery = matchQuery.lte('price', Number(form.budget))
        if (selectedCities.length > 0) matchQuery = matchQuery.in('city', selectedCities)

        const { data: matches } = await matchQuery.limit(50)

        if (matches?.length) {
          // Deduplicate by seller_id
          const seen = new Set()
          const unique = matches.filter(m => {
            if (seen.has(m.seller_id)) return false
            seen.add(m.seller_id)
            return true
          })

          const notifications = unique.map(m => ({
            user_id: m.seller_id,
            title: '🔎 New Buyer Request',
            message: `Someone is looking for ${form.title}${form.budget ? ` with a budget of MWK ${Number(form.budget).toLocaleString()}` : ''}${selectedCities.length > 0 ? ` in ${selectedCities.join(', ')}` : ''}.`,
            type: 'buyer_request',
            read: false,
            link: '/looking-for',
            data: {
              request_title: form.title,
              category: form.category,
              budget: form.budget || null,
              cities: selectedCities,
              buyer_id: user.id,
            }
          }))

          await supabase.from('notifications').insert(notifications)
        }
      } catch (e) {
        console.warn('Matching notification failed:', e)
      }
    }

    showToast('✅ Request posted!')
    setForm({ title: '', category: 'Electronics', budget: '', city: '', description: '' })
    setImageFile(null); setImagePreview(null)
    setSelectedCities([])
    setComposerOpen(false)
    loadRequests()
  }

  async function sendOffer(req) {
    // Find a listing the current user owns to open chat context
    const { data: myListings } = await supabase
      .from('listings')
      .select('id')
      .eq('seller_id', user.id)
      .eq('status', 'active')
      .limit(1)

    const msg = `🔎 Responding to your request: "${req.title}"${req.budget ? `\n💰 Your budget: MWK ${Number(req.budget).toLocaleString()}` : ''}${req.city ? `\n📍 Location: ${req.city}` : ''}\n\nHi! I have what you're looking for. Let's talk!`

    if (myListings?.length) {
      navigate(`/chat/${req.user_id}/${myListings[0].id}`, { state: { prefillMessage: msg, isRequest: true } })
    } else {
      // Seller has no listings — show toast
      showToast('⚠️ Post a listing first to send an offer')
    }
  }

  const myRequests = requests.filter(r => r.user_id === user?.id)
  const otherRequests = requests.filter(r => r.user_id !== user?.id)

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8f6', fontFamily: "'DM Sans', system-ui, sans-serif", paddingBottom: 100 }}>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => navigate(-1)} style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 16 }}>←</button>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#0f1410' }}>🔎 Looking For</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>Buyers searching for products & services</div>
          </div>
        </div>
        <button
          onClick={openComposer}
          style={{ background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', border: 'none', borderRadius: 20, padding: '8px 16px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
        >+ Post Request</button>
      </div>

      {/* Current location bar */}
      {(viewerCity || !detectingViewer) && (
        <div style={{ background: '#f0faf4', borderBottom: '1px solid #d1fae5', padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
          {manualCityEdit ? (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', flex: 1 }}>
              <div style={{ flex: 1, position: 'relative' }}>
                <input
                  autoFocus
                  value={manualCityInput}
                  onChange={e => {
                    const val = e.target.value
                    setManualCityInput(val)
                    // Filter suggestions
                    if (val.trim()) {
                      const matches = dbCities.filter(c =>
                        c.toLowerCase().includes(val.toLowerCase())
                      ).slice(0, 6)
                      setCityInputSuggestions(matches)
                    } else {
                      setCityInputSuggestions([])
                    }
                  }}
                  placeholder="Type your city…"
                  style={{ border: '1.5px solid #1a7a4a', borderRadius: 8, padding: '6px 10px', fontSize: 13, outline: 'none', width: '100%', boxSizing: 'border-box' }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && manualCityInput.trim()) {
                      setViewerCity(manualCityInput.trim())
                      setManualCityEdit(false)
                      setCityInputSuggestions([])
                      loadRequests(manualCityInput.trim())
                    }
                    if (e.key === 'Escape') { setManualCityEdit(false); setCityInputSuggestions([]) }
                  }}
                />
                {cityInputSuggestions.length > 0 && (
                  <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#fff', border: '1.5px solid #e0ebe3', borderRadius: 10, boxShadow: '0 4px 16px rgba(0,0,0,0.1)', zIndex: 200, marginTop: 2 }}>
                    {cityInputSuggestions.map(city => (
                      <div
                        key={city}
                        onClick={() => {
                          setViewerCity(city)
                          setManualCityInput(city)
                          setManualCityEdit(false)
                          setCityInputSuggestions([])
                          loadRequests(city)
                        }}
                        style={{ padding: '9px 12px', fontSize: 13, cursor: 'pointer', borderBottom: '1px solid #f3f4f6', color: '#0f1410', display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <span>📍</span> {city}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <button
                onClick={() => {
                  if (manualCityInput.trim()) {
                    setViewerCity(manualCityInput.trim())
                    loadRequests(manualCityInput.trim())
                  }
                  setManualCityEdit(false)
                  setCityInputSuggestions([])
                }}
                style={{ background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}
              >✓</button>
              <button onClick={() => { setManualCityEdit(false); setCityInputSuggestions([]) }}
                style={{ background: 'none', border: 'none', color: '#9ca3af', fontSize: 16, cursor: 'pointer', padding: 0, flexShrink: 0 }}>✕</button>
            </div>
          ) : (
            <>
              <span style={{ fontSize: 12, color: '#637068' }}>Showing results in</span>
              <span style={{ fontSize: 13 }}>📍</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: '#1a7a4a' }}>{viewerCity || '?'}</span>
              <button
                onClick={async () => {
                  setManualCityInput(viewerCity || '')
                  setManualCityEdit(true)
                  const cities = await getDBCities(supabase)
                  setDbCities(cities)
                }}
                style={{ background: '#d1fae5', border: 'none', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#1a7a4a', cursor: 'pointer' }}
              >Change</button>
              <button
                onClick={async () => {
                  setDetectingViewer(true)
                  setViewerCity(null)
                  const gpsCity = await getGPSCity()
                  setViewerCity(gpsCity)
                  setDetectingViewer(false)
                }}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 11, color: '#9ca3af', cursor: 'pointer', padding: 0 }}
              >🔄</button>
            </>
          )}
        </div>
      )}

      {/* Category tabs */}
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '12px 16px', scrollbarWidth: 'none', background: '#fff', borderBottom: '1px solid #f3f4f6' }}>
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setCategory(c)} style={{ flexShrink: 0, background: category === c ? '#1a7a4a' : '#f3f4f6', border: 'none', borderRadius: 20, padding: '6px 14px', fontSize: 12, fontWeight: 700, color: category === c ? '#fff' : '#374151', cursor: 'pointer', transition: 'all 0.15s' }}>
            {c}
          </button>
        ))}
      </div>

      <div style={{ padding: '16px 14px', display: 'flex', flexDirection: 'column', gap: 12 }}>

        {detectingViewer ? (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>📍</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Detecting your location…</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>We use your location to show nearby requests</div>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 28, height: 28, border: '3px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            </div>
          </div>
        ) : !viewerCity ? (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🗺️</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: '#374151', marginBottom: 6 }}>Location needed</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20, lineHeight: 1.6 }}>
              Enable location access so we can show requests near you, or add your city in your profile.
            </div>
            <button
              onClick={async () => {
                setDetectingViewer(true)
                const gpsCity = await getGPSCity()
                setViewerCity(gpsCity)
                setDetectingViewer(false)
              }}
              style={{ background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
            >📍 Try Again</button>
          </div>
        ) : loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af', fontSize: 13 }}>Loading…</div>
        ) : requests.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🔎</div>
            <div style={{ fontSize: 16, fontWeight: 700, color: '#374151', marginBottom: 6 }}>No requests in {viewerCity}</div>
            <div style={{ fontSize: 13, color: '#9ca3af', marginBottom: 20 }}>Be the first to post what you're looking for</div>
            <button onClick={openComposer} style={{ background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>+ Post Request</button>
          </div>
        ) : (
          <>
            {myRequests.length > 0 && (
              <div style={{ fontSize: 11, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: -4 }}>Your Requests</div>
            )}
            {[...myRequests, ...otherRequests].map(req => (
              <RequestCard key={req.id} req={req} user={user} timeAgo={timeAgo} onOffer={sendOffer} onDelete={async (id) => {
                await supabase.from('buyer_requests').delete().eq('id', id)
                setRequests(prev => prev.filter(r => r.id !== id))
              }} />
            ))}
          </>
        )}
      </div>

      {/* Composer overlay */}
      {composerOpen && (
        <div onClick={() => setComposerOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }} />
      )}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 1001, transform: composerOpen ? 'translateY(0)' : 'translateY(110%)', transition: 'transform 0.4s cubic-bezier(0.32,0.72,0,1)', background: '#fff', borderRadius: '24px 24px 0 0', boxShadow: '0 -8px 40px rgba(0,0,0,0.2)', maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: '#e5e7eb' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px 12px', borderBottom: '1px solid #f3f4f6' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: '#0f1410' }}>🔎 Post a Request</div>
          <button onClick={() => setComposerOpen(false)} style={{ background: '#f3f4f6', border: 'none', borderRadius: '50%', width: 32, height: 32, fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>✕</button>
        </div>

        <div style={{ padding: '16px' }}>
          {/* Image upload */}
          <div onClick={() => fileRef.current?.click()} style={{ width: '100%', height: 120, borderRadius: 14, border: '2px dashed #a5d6a7', background: imagePreview ? 'transparent' : '#f0faf4', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: 14, overflow: 'hidden', position: 'relative' }}>
            {imagePreview
              ? <img src={imagePreview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <div style={{ textAlign: 'center' }}><div style={{ fontSize: 24, marginBottom: 4 }}>📷</div><div style={{ fontSize: 12, fontWeight: 700, color: '#2e7d32' }}>Add reference image</div><div style={{ fontSize: 11, color: '#9ca3af' }}>optional</div></div>
            }
            {imagePreview && <button onClick={e => { e.stopPropagation(); setImageFile(null); setImagePreview(null) }} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(0,0,0,0.5)', border: 'none', color: '#fff', width: 26, height: 26, borderRadius: '50%', fontSize: 13, cursor: 'pointer' }}>✕</button>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => { const f = e.target.files[0]; if (!f) return; setImageFile(f); setImagePreview(URL.createObjectURL(f)) }} />

         {[
            { label: "What are you looking for?", key: 'title', placeholder: 'e.g. Second-hand HP Laptop', type: 'text' },
            { label: 'Budget (MWK)', key: 'budget', placeholder: 'e.g. 150000', type: 'number' },
          ].map(({ label, key, placeholder, type }) => (
            <div key={key} style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#637068', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>{label}</label>
              <input type={type} placeholder={placeholder} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                style={{ width: '100%', border: '1.5px solid #e0ebe3', borderRadius: 12, padding: '10px 13px', fontSize: 15, background: '#fafcfb', boxSizing: 'border-box', outline: 'none' }} />
            </div>
          ))}

          {/* City picker */}
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#637068', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              📍 Cities to search
            </label>
            {detectingCity && (
              <div style={{ fontSize: 12, color: '#1a7a4a', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, border: '2px solid #1a7a4a', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                Detecting your location…
              </div>
            )}
            {/* Selected cities chips */}
            {selectedCities.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {selectedCities.map(city => (
                  <div key={city} style={{ background: '#1a7a4a', color: '#fff', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                    📍 {city}
                    <button onClick={() => setSelectedCities(prev => prev.filter(c => c !== city))}
                      style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, padding: 0, lineHeight: 1 }}>×</button>
                  </div>
                ))}
              </div>
            )}
            {/* City search input */}
            <input
              placeholder="Search or add a city…"
              value={citySearch}
              onChange={e => setCitySearch(e.target.value)}
              style={{ width: '100%', border: '1.5px solid #e0ebe3', borderRadius: 12, padding: '10px 13px', fontSize: 15, background: '#fafcfb', boxSizing: 'border-box', outline: 'none', marginBottom: 4 }}
            />
            {/* City dropdown */}
            {citySearch.trim() && (
              <div style={{ background: '#fff', border: '1.5px solid #e0ebe3', borderRadius: 12, maxHeight: 160, overflowY: 'auto' }}>
                {[
                  ...dbCities.filter(c => c.toLowerCase().includes(citySearch.toLowerCase()) && !selectedCities.includes(c)),
                  // Allow adding custom city if not in list
                  ...(!dbCities.some(c => c.toLowerCase() === citySearch.toLowerCase()) && citySearch.trim() ? [citySearch.trim()] : [])
                ].slice(0, 8).map(city => (
                  <div key={city} onClick={() => { setSelectedCities(prev => prev.includes(city) ? prev : [...prev, city]); setCitySearch('') }}
                    style={{ padding: '10px 14px', fontSize: 14, cursor: 'pointer', borderBottom: '1px solid #f3f4f6', color: '#0f1410' }}>
                    📍 {city}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#637068', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>Category</label>
            <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              style={{ width: '100%', border: '1.5px solid #e0ebe3', borderRadius: 12, padding: '10px 13px', fontSize: 15, background: '#fafcfb', boxSizing: 'border-box', outline: 'none' }}>
              {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, fontWeight: 700, color: '#637068', display: 'block', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.4 }}>Description</label>
            <textarea placeholder="Describe exactly what you need..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={3} maxLength={300}
              style={{ width: '100%', border: '1.5px solid #e0ebe3', borderRadius: 12, padding: '10px 13px', fontSize: 14, background: '#fafcfb', boxSizing: 'border-box', outline: 'none', resize: 'none', lineHeight: 1.5 }} />
          </div>

          <button onClick={handlePost} disabled={!form.title.trim() || posting}
            style={{ width: '100%', background: form.title.trim() ? 'linear-gradient(135deg,#1a7a4a,#22a05e)' : '#e5e7eb', color: form.title.trim() ? '#fff' : '#9ca3af', border: 'none', borderRadius: 14, padding: '13px', fontSize: 14, fontWeight: 800, cursor: form.title.trim() ? 'pointer' : 'default', boxShadow: form.title.trim() ? '0 4px 20px rgba(26,122,74,0.3)' : 'none' }}>
            {posting ? 'Posting…' : '🔎 Post Request'}
          </button>
        </div>
      </div>

      {toast && (
        <div style={{ position: 'fixed', bottom: 90, left: '50%', transform: 'translateX(-50%)', background: '#0f1410', color: '#fff', borderRadius: 20, padding: '10px 20px', fontSize: 13, fontWeight: 700, zIndex: 9999, whiteSpace: 'nowrap' }}>
          {toast}
        </div>
      )}

      <BottomNav />
    </div>
  )
}

function RequestCard({ req, user, timeAgo, onOffer, onDelete }) {
  const isOwn = req.user_id === user?.id
  const name = req.profiles?.full_name || 'Buyer'
  const avatar = req.profiles?.avatar_url
  const initial = name[0].toUpperCase()

  return (
    <div style={{ background: '#fff', borderRadius: 16, border: '1px solid #e8f0eb', boxShadow: '0 1px 6px rgba(0,0,0,0.05)', overflow: 'hidden' }}>
      {req.image_url && (
        <img src={req.image_url} alt="" style={{ width: '100%', height: 160, objectFit: 'cover' }} />
      )}
      <div style={{ padding: '14px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: avatar ? 'transparent' : 'linear-gradient(135deg,#1a7a4a,#22a05e)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
            {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#0f1410' }}>{isOwn ? 'You' : name}</div>
            <div style={{ fontSize: 11, color: '#9ca3af' }}>{timeAgo(req.created_at)}</div>
          </div>
          <div style={{ background: '#f0faf4', border: '1px solid #d1fae5', borderRadius: 20, padding: '3px 10px', fontSize: 11, fontWeight: 700, color: '#1a7a4a' }}>
            🔎 Looking For
          </div>
        </div>

        {/* Title */}
        <div style={{ fontSize: 16, fontWeight: 800, color: '#0f1410', marginBottom: 6 }}>{req.title}</div>

        {/* Description */}
        {req.description && (
          <div style={{ fontSize: 13, color: '#637068', lineHeight: 1.5, marginBottom: 10 }}>{req.description}</div>
        )}

        {/* Meta */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
          {req.budget && (
            <div style={{ background: '#fef3c7', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 700, color: '#92400e' }}>
              💰 MWK {Number(req.budget).toLocaleString()}
            </div>
          )}
          {req.cities?.length > 0 ? (
            req.cities.map(c => (
              <div key={c} style={{ background: '#f0f9ff', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 700, color: '#0369a1' }}>
                📍 {c}
              </div>
            ))
          ) : req.city ? (
            <div style={{ background: '#f0f9ff', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 700, color: '#0369a1' }}>
              📍 {req.city}
            </div>
          ) : null}
          <div style={{ background: '#f3f4f6', borderRadius: 20, padding: '4px 10px', fontSize: 12, fontWeight: 600, color: '#374151' }}>
            {req.category}
          </div>
        </div>

        {/* Actions */}
        {isOwn ? (
          <button onClick={() => onDelete(req.id)} style={{ width: '100%', background: '#fff5f5', border: '1.5px solid #fecaca', borderRadius: 12, padding: '10px', fontSize: 13, fontWeight: 700, color: '#ef4444', cursor: 'pointer' }}>
            🗑 Delete Request
          </button>
        ) : (
          <button onClick={() => onOffer(req)} style={{ width: '100%', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', border: 'none', borderRadius: 12, padding: '11px', fontSize: 14, fontWeight: 800, color: '#fff', cursor: 'pointer', boxShadow: '0 4px 16px rgba(26,122,74,0.25)' }}>
            💬 Send Offer
          </button>
        )}
      </div>
    </div>
  )
}