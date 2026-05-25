import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SERVICE_CATS, CITIES, S, avatarColor, initials, playBookingSound } from './services/serviceData'
import ProviderModal from './services/ProviderModal'
import BookingsTabs from './services/BookingsTabs'

export default function Services() {
  const navigate = useNavigate()
  const providersRef = useRef(null)
  const mediaInputRef = useRef(null)

  const [tab, setTab] = useState('browse')
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [filterCat, setFilterCat] = useState('All')
  const [filterCity, setFilterCity] = useState('All')
  const [search, setSearch] = useState('')
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [myBookings, setMyBookings] = useState([])
  const [bookingsLoading, setBookingsLoading] = useState(false)
  const [incomingBookings, setIncomingBookings] = useState([])
  const [newBookingNotif, setNewBookingNotif] = useState(false)
  const [myServices, setMyServices] = useState([])
  const [editingService, setEditingService] = useState(null)
  const [mediaFiles, setMediaFiles] = useState([])
  const [mediaPreviewUrls, setMediaPreviewUrls] = useState([])
  const [uploadingMedia, setUploadingMedia] = useState(false)
  const [form, setForm] = useState({ name: '', category: '', description: '', rate: '', experience: '', skills: '', coverage: '', city: '', contact: '', available: 'Available today' })
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const [postSuccess, setPostSuccess] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(null)

  useEffect(() => {
    init()
    return () => { supabase.removeAllChannels() }
  }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    await loadServices()
    if (user) {
      await loadMyBookings(user.id)
      await loadIncomingBookings(user.id)
      await loadMyServices(user.id)
      subscribeToBookings(user.id)
    }
  }

  function subscribeToBookings(uid) {
    supabase.channel('bookings-rt')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'bookings', filter: `provider_id=eq.${uid}` }, () => {
        playBookingSound()
        setNewBookingNotif(true)
        loadIncomingBookings(uid)
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'bookings', filter: `customer_id=eq.${uid}` }, () => {
        loadMyBookings(uid)
      })
      .subscribe()
  }

  async function loadServices() {
    setLoading(true)
    const { data } = await supabase.from('services').select('*').eq('status', 'active').order('created_at', { ascending: false })
    setServices(data || [])
    setLoading(false)
  }

  async function loadMyServices(uid) {
    const { data } = await supabase.from('services').select('*').eq('provider_id', uid).order('created_at', { ascending: false })
    setMyServices(data || [])
  }

  async function loadMyBookings(uid) {
    setBookingsLoading(true)
    const { data } = await supabase.from('bookings').select('*, services(name, category, rate, city)').eq('customer_id', uid).order('created_at', { ascending: false })
    setMyBookings(data || [])
    setBookingsLoading(false)
  }

  async function loadIncomingBookings(uid) {
    const { data } = await supabase.from('bookings').select('*').eq('provider_id', uid).order('created_at', { ascending: false })
    setIncomingBookings(data || [])
  }

  async function updateBookingStatus(bookingId, status) {
    await supabase.from('bookings').update({ status }).eq('id', bookingId)
    if (currentUser) {
      await loadMyBookings(currentUser.id)
      await loadIncomingBookings(currentUser.id)
    }
  }

  function setF(field, value) { setForm(f => ({ ...f, [field]: value })) }

  function handleMediaSelect(e) {
    const files = Array.from(e.target.files)
    setMediaFiles(prev => [...prev, ...files])
    const previews = files.map(f => URL.createObjectURL(f))
    setMediaPreviewUrls(prev => [...prev, ...previews])
  }

  function removeMedia(idx) {
    setMediaFiles(prev => prev.filter((_, i) => i !== idx))
    setMediaPreviewUrls(prev => prev.filter((_, i) => i !== idx))
  }

  async function uploadMediaFiles(userId) {
    if (mediaFiles.length === 0) return []
    setUploadingMedia(true)
    const urls = []
    for (const file of mediaFiles) {
      const ext = file.name.split('.').pop()
      const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error } = await supabase.storage.from('service-media').upload(path, file)
      if (!error) {
        const { data: { publicUrl } } = supabase.storage.from('service-media').getPublicUrl(path)
        urls.push(publicUrl)
      }
    }
    setUploadingMedia(false)
    return urls
  }

  async function handlePost() {
    setPostError('')
    if (!form.name || !form.category || !form.city || !form.rate) {
      setPostError('Please fill in name, category, city and rate')
      return
    }
    setPosting(true)
    const { data: { user } } = await supabase.auth.getUser()
    const mediaUrls = await uploadMediaFiles(user.id)

    const payload = {
      provider_id: user.id,
      name: form.name, category: form.category, description: form.description,
      rate: form.rate, experience: form.experience,
      skills: form.skills ? form.skills.split(',').map(s => s.trim()) : [],
      coverage: form.coverage, city: form.city, contact: form.contact,
      available: form.available, status: 'active',
      media_urls: mediaUrls,
    }

    let error
    if (editingService) {
      ;({ error } = await supabase.from('services').update(payload).eq('id', editingService.id))
    } else {
      ;({ error } = await supabase.from('services').insert(payload))
    }

    setPosting(false)
    if (error) { setPostError(error.message); return }
    setPostSuccess(true)
    setForm({ name: '', category: '', description: '', rate: '', experience: '', skills: '', coverage: '', city: '', contact: '', available: 'Available today' })
    setMediaFiles([]); setMediaPreviewUrls([]); setEditingService(null)
    await loadServices()
    await loadMyServices(user.id)
    setTimeout(() => { setPostSuccess(false); setTab('myservices') }, 1500)
  }

  function startEdit(svc) {
    setEditingService(svc)
    setForm({
      name: svc.name || '', category: svc.category || '', description: svc.description || '',
      rate: svc.rate || '', experience: svc.experience || '',
      skills: (svc.skills || []).join(', '), coverage: svc.coverage || '',
      city: svc.city || '', contact: svc.contact || '', available: svc.available || 'Available today',
    })
    setMediaPreviewUrls(svc.media_urls || [])
    setMediaFiles([])
    setTab('post')
  }

  async function toggleServiceStatus(svc) {
    const newStatus = svc.status === 'active' ? 'paused' : 'active'
    await supabase.from('services').update({ status: newStatus }).eq('id', svc.id)
    if (currentUser) await loadMyServices(currentUser.id)
    await loadServices()
  }

  async function deleteService(id) {
    await supabase.from('services').delete().eq('id', id)
    setDeleteConfirm(null)
    if (currentUser) await loadMyServices(currentUser.id)
    await loadServices()
  }

  function handleCatClick(catName) {
    setFilterCat(prev => prev === catName ? 'All' : catName)
    setTimeout(() => providersRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
  }

  // Only show categories that have at least one active service
  const activeCats = SERVICE_CATS.filter(cat => services.some(s => s.category === cat.name))
  const catCounts = {}
  services.forEach(s => { catCounts[s.category] = (catCounts[s.category] || 0) + 1 })

  const filtered = services.filter(s => {
    if (filterCat !== 'All' && s.category !== filterCat) return false
    if (filterCity !== 'All' && s.city !== filterCity) return false
    if (search && !s.name?.toLowerCase().includes(search.toLowerCase()) &&
        !s.category?.toLowerCase().includes(search.toLowerCase()) &&
        !s.description?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const pendingIncoming = incomingBookings.filter(b => b.status === 'pending')

  return (
    <div style={S.page}>
      <style>{`
        @keyframes fadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        input:focus,textarea:focus,select:focus { outline:none; border-color:#1a7a4a !important; }
        ::-webkit-scrollbar { display:none; }
      `}</style>

      <div style={S.header}>
        <div style={S.headerTop}>
          <div>
            <div style={S.headerTitle}>Services</div>
            <div style={S.headerSub}>Find trusted local providers</div>
          </div>
          <button style={S.joinBtn} onClick={() => { setEditingService(null); setForm({ name: '', category: '', description: '', rate: '', experience: '', skills: '', coverage: '', city: '', contact: '', available: 'Available today' }); setMediaFiles([]); setMediaPreviewUrls([]); setTab('post') }}>
            + Offer Service
          </button>
        </div>

        <div style={S.searchBox}>
          <span style={{ fontSize: 15 }}>🔍</span>
          <input style={S.searchInput} placeholder="Search plumber, tutor, electrician..." value={search} onChange={e => { setSearch(e.target.value); setFilterCat('All') }} />
          {search && <button style={S.clearBtn2} onClick={() => setSearch('')}>✕</button>}
        </div>

        <div style={S.tabs}>
          <button style={{ ...S.tab, ...(tab === 'browse' ? S.tabActive : {}) }} onClick={() => setTab('browse')}>Browse</button>
          <button style={{ ...S.tab, ...(tab === 'bookings' ? S.tabActive : {}) }} onClick={() => setTab('bookings')}>
            Bookings
            {myBookings.filter(b => b.status === 'pending').length > 0 && <span style={S.tabBadge}>{myBookings.filter(b => b.status === 'pending').length}</span>}
          </button>
          <button style={{ ...S.tab, ...(tab === 'incoming' ? S.tabActive : {}), ...(pendingIncoming.length > 0 ? { color: '#1a7a4a' } : {}) }} onClick={() => { setTab('incoming'); setNewBookingNotif(false) }}>
            Requests
            {pendingIncoming.length > 0 && <span style={{ ...S.tabBadge, background: newBookingNotif ? '#e74c3c' : '#1a7a4a' }}>{pendingIncoming.length}</span>}
          </button>
          {myServices.length > 0 && (
            <button style={{ ...S.tab, ...(tab === 'myservices' ? S.tabActive : {}) }} onClick={() => setTab('myservices')}>
              My Listings
              <span style={{ ...S.tabBadge, background: '#1a7a4a' }}>{myServices.length}</span>
            </button>
          )}
          <button style={{ ...S.tab, ...(tab === 'post' ? S.tabActive : {}) }} onClick={() => { setEditingService(null); setTab('post') }}>+ Offer</button>
        </div>
      </div>

      {/* BROWSE */}
      {tab === 'browse' && (
        <div style={S.feed}>
          {/* Compact horizontal category chips — only active categories */}
          {activeCats.length > 0 && (
            <div>
              <div style={S.sectionLabel}>Categories</div>
              <div style={S.catScrollRow}>
                {activeCats.map(cat => (
                  <button
                    key={cat.name}
                    style={{ ...S.catChip, ...(filterCat === cat.name ? S.catChipActive : {}) }}
                    onClick={() => handleCatClick(cat.name)}
                  >
                    <span style={S.catChipIcon}>{cat.icon}</span>
                    <span style={{ ...S.catChipName, ...(filterCat === cat.name ? S.catChipNameActive : {}) }}>{cat.name}</span>
                    <span style={{ ...S.catChipCount, ...(filterCat === cat.name ? S.catChipCountActive : {}) }}>{catCounts[cat.name]}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {filterCat !== 'All' && (
            <div style={S.catFilterBanner}>
              <span style={S.catFilterBannerText}>
                {SERVICE_CATS.find(c => c.name === filterCat)?.icon} {filterCat} · {filtered.length} provider{filtered.length !== 1 ? 's' : ''}
              </span>
              <button style={S.catFilterBannerClear} onClick={() => setFilterCat('All')}>Show all ✕</button>
            </div>
          )}

          <div style={S.cityRow}>
            {CITIES.map(c => (
              <button key={c} style={{ ...S.cityChip, ...(filterCity === c ? S.cityChipActive : {}) }} onClick={() => setFilterCity(c)}>{c}</button>
            ))}
          </div>

          <div ref={providersRef}>
            <div style={S.sectionLabel}>
              {filterCat !== 'All' ? filterCat + ' providers' : search ? 'Search results' : 'All providers'}
              {filtered.length > 0 && <span style={S.countBadge}>{filtered.length}</span>}
            </div>

            {loading && [1, 2, 3].map(i => <div key={i} style={S.skeleton} />)}

            {!loading && filtered.length === 0 && (
              <div style={S.empty}>
                <div style={S.emptyIcon}>{filterCat !== 'All' ? SERVICE_CATS.find(c => c.name === filterCat)?.icon : '🔧'}</div>
                <p style={S.emptyTitle}>No {filterCat !== 'All' ? filterCat : ''} providers yet</p>
                <p style={S.emptySub}>Be the first to offer this service!</p>
                <button style={S.postFirstBtn} onClick={() => setTab('post')}>Offer a Service</button>
              </div>
            )}

            {!loading && filtered.map((svc, i) => {
              const media = svc.media_urls || []
              const heroImg = media.find(u => !u.includes('.mp4') && !u.includes('.mov') && !u.includes('.webm'))
              return (
                <div key={svc.id} style={{ ...S.providerCard, animationDelay: i * 0.04 + 's' }} onClick={() => setSelectedProvider(svc)}>
                  {heroImg && <img src={heroImg} alt={svc.name} style={S.providerCardMedia} />}
                  {!heroImg && media.length > 0 && (
                    <video src={media[0]} style={{ ...S.providerCardMedia, background: '#000' }} muted />
                  )}
                  {media.length === 0 && (
                    <div style={S.providerCardMediaPlaceholder}>
                      {SERVICE_CATS.find(c => c.name === svc.category)?.icon || '🔧'}
                    </div>
                  )}
                  <div style={S.providerCardBody}>
                    <div style={S.providerTop}>
                      <div style={{ ...S.avatar, background: avatarColor(svc.name) }}>{initials(svc.name)}</div>
                      <div style={S.providerInfo}>
                        <div style={S.providerName}>{svc.name}{svc.verified && <span style={{ color: '#1a7a4a' }}> ✓</span>}</div>
                        <div style={S.providerMeta}>
                          {svc.rating > 0 && <span>⭐ {svc.rating}</span>}
                          {svc.jobs_done > 0 && <span> · {svc.jobs_done} jobs</span>}
                          {svc.city && <span> · 📍 {svc.city}</span>}
                        </div>
                      </div>
                      <div style={S.rate}>{svc.rate}</div>
                    </div>
                    <div style={S.tagRow}>
                      <span style={S.tag}>{SERVICE_CATS.find(c => c.name === svc.category)?.icon || '🔧'} {svc.category}</span>
                      {svc.verified && <span style={S.tagGreen}>✓ Verified</span>}
                      {svc.available && <span style={S.tagGrey}>{svc.available}</span>}
                      {media.length > 0 && <span style={S.tagGreen}>📸 {media.length} photo{media.length > 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* BOOKINGS & REQUESTS */}
      {(tab === 'bookings' || tab === 'incoming') && (
        <BookingsTabs tab={tab} myBookings={myBookings} incomingBookings={incomingBookings} bookingsLoading={bookingsLoading} onUpdateStatus={updateBookingStatus} onTabChange={setTab} newBookingNotif={newBookingNotif} onDismissNotif={() => setNewBookingNotif(false)} />
      )}

      {/* MY LISTINGS */}
      {tab === 'myservices' && (
        <div style={S.feed}>
          <div style={S.sectionLabel}>My Service Listings</div>
          {myServices.length === 0 && (
            <div style={S.empty}>
              <div style={S.emptyIcon}>🔧</div>
              <p style={S.emptyTitle}>No listings yet</p>
              <button style={S.postFirstBtn} onClick={() => setTab('post')}>Offer a Service</button>
            </div>
          )}
          {myServices.map(svc => {
            const myIncoming = incomingBookings.filter(b => b.service_id === svc.id)
            const pendingCount = myIncoming.filter(b => b.status === 'pending').length
            const confirmedCount = myIncoming.filter(b => b.status === 'confirmed').length
            return (
              <div key={svc.id} style={S.myServiceCard}>
                <div style={S.myServiceHeader}>
                  <div style={{ ...S.myServiceAvatar, background: avatarColor(svc.name) }}>{initials(svc.name)}</div>
                  <div style={{ flex: 1 }}>
                    <div style={S.myServiceName}>{svc.name}</div>
                    <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                      {SERVICE_CATS.find(c => c.name === svc.category)?.icon} {svc.category} · {svc.city}
                    </div>
                  </div>
                  <div>
                    <div style={S.myServiceRate}>{svc.rate}</div>
                    <div style={{ fontSize: '10px', color: svc.status === 'active' ? '#5de89e' : '#f0a500', textAlign: 'right', marginTop: '3px' }}>
                      {svc.status === 'active' ? '● Active' : '⏸ Paused'}
                    </div>
                  </div>
                </div>
                <div style={S.myServiceBody}>
                  <div style={S.myServiceStats}>
                    <div style={S.myServiceStat}>
                      <div style={S.myServiceStatVal}>{myIncoming.length}</div>
                      <div style={S.myServiceStatLabel}>Total requests</div>
                    </div>
                    <div style={S.myServiceStat}>
                      <div style={{ ...S.myServiceStatVal, color: pendingCount > 0 ? '#d4920a' : '#1a7a4a' }}>{pendingCount}</div>
                      <div style={S.myServiceStatLabel}>Pending</div>
                    </div>
                    <div style={S.myServiceStat}>
                      <div style={S.myServiceStatVal}>{confirmedCount}</div>
                      <div style={S.myServiceStatLabel}>Confirmed</div>
                    </div>
                  </div>
                  {svc.description && <p style={{ fontSize: '12px', color: '#637068', lineHeight: '1.5', marginBottom: '12px' }}>{svc.description.slice(0, 100)}{svc.description.length > 100 ? '…' : ''}</p>}
                  {(svc.media_urls || []).length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto' }}>
                      {(svc.media_urls || []).slice(0, 4).map((url, i) => (
                        url.includes('.mp4') || url.includes('.mov') ? (
                          <video key={i} src={url} style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} muted />
                        ) : (
                          <img key={i} src={url} alt="" style={{ width: '56px', height: '56px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                        )
                      ))}
                    </div>
                  )}
                  <div style={S.myServiceActions}>
                    <button style={S.myServiceEditBtn} onClick={() => startEdit(svc)}>✏️ Edit</button>
                    <button style={S.myServicePauseBtn} onClick={() => toggleServiceStatus(svc)}>
                      {svc.status === 'active' ? '⏸ Pause' : '▶ Activate'}
                    </button>
                    <button style={S.myServiceDeleteBtn} onClick={() => setDeleteConfirm(svc.id)}>🗑</button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* POST / EDIT */}
      {tab === 'post' && (
        <div style={S.form}>
          <div style={S.formCard}>
            <div style={S.formTitle}>{editingService ? '✏️ Edit Service' : 'Offer a Service'}</div>
            <div style={S.formSub}>{editingService ? 'Update your service listing' : 'Connect with thousands of customers across Malawi'}</div>

            <label style={S.label}>Your Full Name *</label>
            <input style={S.input} placeholder="e.g. James Mkandawire" value={form.name} onChange={e => setF('name', e.target.value)} />

            <label style={S.label}>Service Category *</label>
            <select style={S.input} value={form.category} onChange={e => setF('category', e.target.value)}>
              <option value="">Select category...</option>
              {SERVICE_CATS.map(c => <option key={c.name} value={c.name}>{c.icon} {c.name}</option>)}
            </select>

            <div style={S.row}>
              <div style={S.half}>
                <label style={S.label}>City *</label>
                <select style={S.input} value={form.city} onChange={e => setF('city', e.target.value)}>
                  <option value="">Select...</option>
                  {CITIES.filter(c => c !== 'All').map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={S.half}>
                <label style={S.label}>Rate *</label>
                <input style={S.input} placeholder="e.g. MWK 18k/day" value={form.rate} onChange={e => setF('rate', e.target.value)} />
              </div>
            </div>

            <label style={S.label}>Description</label>
            <textarea style={S.textarea} rows={3} placeholder="Describe your service and experience..." value={form.description} onChange={e => setF('description', e.target.value)} />

            <label style={S.label}>Skills (comma separated)</label>
            <input style={S.input} placeholder="e.g. Pipe fitting, Leak detection" value={form.skills} onChange={e => setF('skills', e.target.value)} />

            <div style={S.row}>
              <div style={S.half}>
                <label style={S.label}>Experience</label>
                <input style={S.input} placeholder="e.g. 10 years" value={form.experience} onChange={e => setF('experience', e.target.value)} />
              </div>
              <div style={S.half}>
                <label style={S.label}>Availability</label>
                <select style={S.input} value={form.available} onChange={e => setF('available', e.target.value)}>
                  <option>Available today</option>
                  <option>Weekdays only</option>
                  <option>Weekends only</option>
                  <option>By appointment</option>
                </select>
              </div>
            </div>

            <label style={S.label}>Coverage Area</label>
            <input style={S.input} placeholder="e.g. Limbe, Chichiri, Blantyre town" value={form.coverage} onChange={e => setF('coverage', e.target.value)} />

            <label style={S.label}>Contact</label>
            <input style={S.input} placeholder="e.g. +265 999 000 000" value={form.contact} onChange={e => setF('contact', e.target.value)} />

            {/* Media upload */}
            <label style={S.label}>Photos & Videos (testimonials)</label>
            <div style={S.mediaUploadBox} onClick={() => mediaInputRef.current.click()}>
              <div style={{ fontSize: '28px' }}>📸</div>
              <div style={S.mediaUploadText}>Tap to add photos or videos of your work</div>
              <div style={{ fontSize: '11px', color: '#bbb', marginTop: '4px' }}>JPG, PNG, MP4 — up to 6 files</div>
            </div>
            <input ref={mediaInputRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={handleMediaSelect} />

            {mediaPreviewUrls.length > 0 && (
              <div style={S.mediaPreviewRow}>
                {mediaPreviewUrls.map((url, i) => (
                  <div key={i} style={S.mediaPreviewItem}>
                    {mediaFiles[i]?.type?.startsWith('video') || url.includes('.mp4') || url.includes('.mov') ? (
                      <video src={url} style={S.mediaPreviewImg} muted />
                    ) : (
                      <img src={url} alt="" style={S.mediaPreviewImg} />
                    )}
                    <button style={S.mediaPreviewRemove} onClick={() => removeMedia(i)}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {postError && <p style={S.error}>{postError}</p>}
            {postSuccess && <div style={S.successBanner}>✅ {editingService ? 'Updated!' : 'Service listed!'} Redirecting…</div>}

            <button style={{ ...S.submitBtn, opacity: posting || uploadingMedia ? 0.7 : 1 }} onClick={handlePost} disabled={posting || uploadingMedia}>
              {uploadingMedia ? 'Uploading media…' : posting ? 'Saving…' : editingService ? '💾 Save Changes' : '🚀 List My Service'}
            </button>

            {editingService && (
              <button style={{ ...S.submitBtn, background: '#f0f4f1', color: '#637068', boxShadow: 'none', marginTop: '8px' }} onClick={() => { setEditingService(null); setTab('myservices') }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {/* Provider modal */}
      {selectedProvider && (
        <ProviderModal provider={selectedProvider} currentUser={currentUser} onClose={() => setSelectedProvider(null)}
          onBookingDone={(action) => {
            if (currentUser) { loadMyBookings(currentUser.id); loadIncomingBookings(currentUser.id) }
            if (action === 'view') { setSelectedProvider(null); setTab('bookings') }
          }}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px', width: '280px', textAlign: 'center' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>🗑️</div>
            <div style={{ fontSize: '16px', fontWeight: '800', marginBottom: '6px' }}>Delete listing?</div>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={{ flex: 1, background: '#f0f4f1', border: 'none', borderRadius: '12px', padding: '11px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button style={{ flex: 1, background: '#e74c3c', border: 'none', borderRadius: '12px', padding: '11px', fontSize: '14px', fontWeight: '700', color: '#fff', cursor: 'pointer' }} onClick={() => deleteService(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      <div style={S.nav}>
        <button style={S.navItem} onClick={() => navigate('/')}>
          <span style={S.navIcon}>🏠</span><span style={S.navLabel}>Home</span>
        </button>
        <button style={{ ...S.navItem, color: '#1a7a4a' }}>
          <span style={S.navIcon}>🔧</span><span style={{ ...S.navLabel, color: '#1a7a4a', fontWeight: '700' }}>Services</span>
        </button>
        <button style={S.navPost} onClick={() => navigate('/post')}>+</button>
        <button style={S.navItem} onClick={() => navigate('/chats')}>
          <span style={S.navIcon}>💬</span><span style={S.navLabel}>Chats</span>
        </button>
        <button style={S.navItem} onClick={() => navigate('/profile')}>
          <span style={S.navIcon}>👤</span><span style={S.navLabel}>Me</span>
        </button>
      </div>
    </div>
  )
}