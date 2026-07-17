import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { SERVICE_CATS, CITIES, SORT_OPTIONS, S, avatarColor, initials, renderStars, formatWhatsApp } from './serviceData'
import ServiceForm from './ServiceForm'
import ProviderModal from './ProviderModal'
import MyListings from './MyListings'

const TABS = [
  { id: 'browse', label: 'Browse',      icon: '🔍' },
  { id: 'post',   label: 'Offer',       icon: '🚀' },
  { id: 'mine',   label: 'My Listings', icon: '🔧' },
]

export default function Services() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'browse')
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [editingService, setEditingService] = useState(null)

  // Filters
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState('')
  const [activeCity, setActiveCity] = useState('All')
  const [sortBy, setSortBy] = useState('newest')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    await loadServices()
  }

  async function loadServices() {
    setLoading(true)
    const { data } = await supabase
      .from('services')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    setServices(data || [])
    setLoading(false)
  }

  // Filter + sort
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
  if (sortBy === 'rating')   filtered = [...filtered].sort((a, b) => (b.rating || 0) - (a.rating || 0))
  if (sortBy === 'views')    filtered = [...filtered].sort((a, b) => (b.views || 0) - (a.views || 0))
  if (sortBy === 'verified') filtered = [...filtered].sort((a, b) => (b.verified ? 1 : 0) - (a.verified ? 1 : 0))

  const catCounts = {}
  services.forEach(s => { catCounts[s.category] = (catCounts[s.category] || 0) + 1 })
  const myServices = services.filter(s => s.provider_id === currentUser?.id)

  return (
    <div style={S.page}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        input:focus, textarea:focus, select:focus { outline: none; }
        ::-webkit-scrollbar { display: none; }
        button { font-family: inherit; }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerTop}>
          <div>
            <div style={S.headerTitle}>🔧 Services</div>
            <div style={S.headerSub}>
              {loading ? 'Loading…' : `${services.length} provider${services.length !== 1 ? 's' : ''} across Malawi`}
            </div>
          </div>
          <button style={S.offerBtn} onClick={() => setTab(tab === 'post' ? 'browse' : 'post')}>
            {tab === 'post' ? '← Back' : '+ Offer a Service'}
          </button>
        </div>

        {/* Tabs */}
        <div style={S.tabs}>
          {TABS.map(t => (
            <button
              key={t.id}
              style={{ ...S.tab, ...(tab === t.id ? S.tabActive : {}) }}
              onClick={() => setTab(t.id)}
            >
              {t.icon} {t.label}
              {t.id === 'mine' && myServices.length > 0 && (
                <span style={{ ...S.tabBadge, background: '#637068' }}>{myServices.length}</span>
              )}
            </button>
          ))}
        </div>

        {/* Search bar — browse only */}
        {tab === 'browse' && (
          <div style={S.searchBox}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8fa99a" strokeWidth="2.5" strokeLinecap="round">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              style={S.searchInput}
              placeholder="Search by name, skill, category..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button style={S.clearBtn} onClick={() => setSearch('')}>✕</button>}
          </div>
        )}
      </div>

      {/* Browse tab */}
      {tab === 'browse' && (
        <div style={S.feed}>

          {/* Category chips */}
          <div style={S.catScrollRow}>
            <button
              style={{ ...S.catChip, ...(activeCat === '' ? S.catChipActive : {}) }}
              onClick={() => setActiveCat('')}
            >
              <span style={S.catChipIcon}>🌐</span>
              <span style={{ ...S.catChipName, ...(activeCat === '' ? S.catChipNameActive : {}) }}>All</span>
            </button>
            {SERVICE_CATS.filter(c => catCounts[c.name]).map(c => (
              <button
                key={c.name}
                style={{ ...S.catChip, ...(activeCat === c.name ? S.catChipActive : {}) }}
                onClick={() => setActiveCat(activeCat === c.name ? '' : c.name)}
              >
                <span style={S.catChipIcon}>{c.icon}</span>
                <span style={{ ...S.catChipName, ...(activeCat === c.name ? S.catChipNameActive : {}) }}>{c.name}</span>
                <span style={{ ...S.catChipCount, ...(activeCat === c.name ? S.catChipCountActive : {}) }}>{catCounts[c.name]}</span>
              </button>
            ))}
          </div>

          {/* Active category banner */}
          {activeCat && (
            <div style={S.catFilterBanner}>
              <span style={S.catFilterBannerText}>
                {SERVICE_CATS.find(c => c.name === activeCat)?.icon} {activeCat} · {filtered.length} provider{filtered.length !== 1 ? 's' : ''}
              </span>
              <button style={S.catFilterBannerClear} onClick={() => setActiveCat('')}>Clear ✕</button>
            </div>
          )}

          {/* City chips */}
          <div style={S.cityRow}>
            {CITIES.map(c => (
              <button
                key={c}
                style={{ ...S.cityChip, ...(activeCity === c ? S.cityChipActive : {}) }}
                onClick={() => setActiveCity(c)}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Sort chips */}
          <div style={S.sortRow}>
            {SORT_OPTIONS.map(o => (
              <button
                key={o.value}
                style={{ ...S.sortChip, ...(sortBy === o.value ? S.sortChipActive : {}) }}
                onClick={() => setSortBy(o.value)}
              >
                {o.label}
              </button>
            ))}
          </div>

          {/* Results */}
          {loading && [1, 2, 3].map(i => <div key={i} style={S.skeleton} />)}

          {!loading && filtered.length === 0 && (
            <div style={S.empty}>
              <div style={S.emptyIcon}>🔍</div>
              <p style={S.emptyTitle}>No providers found</p>
              <p style={S.emptySub}>
                {search || activeCat ? 'Try a different search or category' : 'Be the first to list your service!'}
              </p>
              <button style={S.postFirstBtn} onClick={() => setTab('post')}>+ List a Service</button>
            </div>
          )}

          {!loading && filtered.map((svc, i) => (
            <ProviderCard
              key={svc.id}
              svc={svc}
              delay={i * 0.04}
              currentUser={currentUser}
              onClick={() => setSelectedProvider(svc)}
              navigate={navigate}
            />
          ))}
        </div>
      )}

      {/* Offer / Edit tab */}
      {tab === 'post' && (
        <ServiceForm
          editingService={editingService}
          onSuccess={() => { loadServices(); setTab('mine'); setEditingService(null) }}
          onCancel={() => { setEditingService(null); setTab('mine') }}
        />
      )}

      {/* My listings tab */}
      {tab === 'mine' && (
        <MyListings
          myServices={myServices}
          onEdit={svc => { setEditingService(svc); setTab('post') }}
          onRefresh={loadServices}
          onPostNew={() => { setEditingService(null); setTab('post') }}
        />
      )}

      {/* Provider detail modal */}
      {selectedProvider && (
        <ProviderModal
          provider={selectedProvider}
          currentUser={currentUser}
          onClose={() => setSelectedProvider(null)}
        />
      )}
    </div>
  )
}

// Provider card
function ProviderCard({ svc, delay, currentUser, onClick, navigate }) {
  const heroMedia = svc.media_urls?.[0]

  function goChat(e) {
    e.stopPropagation()
    if (!currentUser) return
    navigate(`/chat/${svc.provider_id}/${svc.id}`)
  }

  function doCall(e) {
    e.stopPropagation()
    if (svc.contact) window.location.href = `tel:${svc.contact}`
  }

  function doWhatsApp(e) {
    e.stopPropagation()
    window.open(formatWhatsApp(svc.contact, svc.name, svc.category), '_blank')
  }

  return (
    <div style={{ ...S.providerCard, animationDelay: delay + 's' }} onClick={onClick}>
      {heroMedia ? (
        heroMedia.match(/\.(mp4|mov|webm)$/i)
          ? <video src={heroMedia} style={S.providerCardMedia} muted loop playsInline />
          : <img src={heroMedia} alt={svc.name} style={S.providerCardMedia} />
      ) : (
        <div style={S.providerCardMediaPlaceholder}>
          {SERVICE_CATS.find(c => c.name === svc.category)?.icon || '🔧'}
        </div>
      )}

      <div style={S.providerCardBody}>
        <div style={S.providerTop}>
          <div style={{ ...S.avatar, background: avatarColor(svc.name) }}>{initials(svc.name)}</div>
          <div style={S.providerInfo}>
            <div style={S.providerName}>
              {svc.name}
              {svc.verified && <span style={{ color: '#1a7a4a', marginLeft: '4px', fontSize: '13px' }}>✓</span>}
            </div>
            <div style={S.providerMeta}>
              {SERVICE_CATS.find(c => c.name === svc.category)?.icon} {svc.category}
              {svc.city && ` · 📍 ${svc.city}`}
              {svc.experience && ` · ${svc.experience}`}
            </div>
            {svc.rating > 0 && (
              <div style={{ fontSize: '11px', color: '#d4920a', marginTop: '2px' }}>
                {renderStars(svc.rating)} {svc.rating} · {svc.jobs_done || 0} jobs
              </div>
            )}
          </div>
          <div style={S.rate}>{svc.rate}</div>
        </div>

        <div style={S.tagRow}>
          {svc.available && <span style={S.tagGreen}>{svc.available}</span>}
          {svc.verified && <span style={S.tagBlue}>✓ Verified</span>}
          {(svc.skills || []).slice(0, 3).map(sk => (
            <span key={sk} style={S.tag}>{sk}</span>
          ))}
        </div>

        {svc.description && (
          <p style={{ fontSize: '12px', color: '#637068', lineHeight: '1.5', marginBottom: '10px' }}>
            {svc.description.slice(0, 100)}{svc.description.length > 100 ? '…' : ''}
          </p>
        )}

        <div style={S.cardActions}>
          {currentUser && (
            <button style={S.cardChatBtn} onClick={goChat}>💬 Chat</button>
          )}
          {svc.contact && (
            <button style={S.cardCallBtn} onClick={doCall}>📞 Call</button>
          )}
          <button style={S.cardWhatsAppBtn} onClick={doWhatsApp}>WhatsApp</button>
        </div>
      </div>
    </div>
  )
}