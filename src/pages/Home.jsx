import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const CATEGORIES = ['All', 'Electronics', 'Furniture', 'Clothing', 'Vehicles', 'Property', 'Agriculture', 'Food', 'Services', 'Other']
const CITIES = ['All', 'Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Kasungu', 'Mangochi', 'Karonga', 'Salima']
const PRICE_RANGES = [
  { label: 'Any price', min: 0, max: Infinity },
  { label: 'Under 5K', min: 0, max: 5000 },
  { label: '5K – 20K', min: 5000, max: 20000 },
  { label: '20K – 100K', min: 20000, max: 100000 },
  { label: '100K+', min: 100000, max: Infinity },
]

export default function Home() {
  const navigate = useNavigate()
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('All')
  const [city, setCity] = useState('All')
  const [priceIdx, setPriceIdx] = useState(0)
  const [showFilters, setShowFilters] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [user, setUser] = useState(null)
  const [activeTab, setActiveTab] = useState('shop')

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    setUser(user)
    await loadListings()
    if (user) loadUnread(user.id)
  }

  async function loadListings() {
    setLoading(true)
    const { data } = await supabase
      .from('listings')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
    setListings(data || [])
    setLoading(false)
  }

  async function loadUnread(uid) {
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('to_user', uid)
      .eq('read', false)
    setUnreadCount(count || 0)
  }

  const priceRange = PRICE_RANGES[priceIdx]

  const filtered = listings.filter(l => {
    if (category !== 'All' && l.category !== category) return false
    if (city !== 'All' && l.city !== city) return false
    if (l.price < priceRange.min || l.price > priceRange.max) return false
    if (search && !l.title?.toLowerCase().includes(search.toLowerCase()) &&
        !l.description?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const activeFilters = (category !== 'All' ? 1 : 0) + (city !== 'All' ? 1 : 0) + (priceIdx !== 0 ? 1 : 0)

  function clearFilters() {
    setCategory('All')
    setCity('All')
    setPriceIdx(0)
    setSearch('')
  }

  return (
    <div style={S.page}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(14px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }
        @keyframes slideDown { from { opacity:0; transform:translateY(-8px) } to { opacity:1; transform:translateY(0) } }
        input:focus { outline:none; }
        ::-webkit-scrollbar { display:none; }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        {/* Top row: brand + notification bell */}
        <div style={S.headerTop}>
          <div>
            <div style={S.brand}>Soko Malawi</div>
            <div style={S.location}>📍 {city !== 'All' ? city : 'Malawi'}</div>
          </div>
          <button style={S.bellBtn} onClick={() => navigate('/chats')}>
            <span style={S.bellIcon}>🔔</span>
            {unreadCount > 0 && (
              <span style={S.bellBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
            )}
          </button>
        </div>

        {/* Search bar */}
        <div style={S.searchBox}>
          <span style={{ fontSize: 15 }}>🔍</span>
          <input
            style={S.searchInput}
            placeholder="Search listings near you..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button style={S.clearSearch} onClick={() => setSearch('')}>✕</button>
          )}
        </div>

        {/* Shop / Services / Jobs tabs */}
        <div style={S.tabs}>
          <button
            style={{ ...S.tab, ...(activeTab === 'shop' ? S.tabActive : {}) }}
            onClick={() => setActiveTab('shop')}
          >Shop</button>
          <button
            style={{ ...S.tab, ...(activeTab === 'services' ? S.tabActive : {}) }}
onClick={() => navigate('/services')}          >Services</button>
          <button
            style={{ ...S.tab, ...(activeTab === 'jobs' ? S.tabActive : {}) }}
            onClick={() => navigate('/jobs')}
          >Jobs</button>
        </div>
      </div>

      {/* Category chips + filter toggle */}
      <div style={S.catBar}>
        <div style={S.chipRow}>
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              style={{ ...S.chip, ...(category === cat ? S.chipActive : {}) }}
              onClick={() => setCategory(cat)}
            >
              {catEmoji(cat)} {cat}
            </button>
          ))}
        </div>
        <button style={S.filterToggle} onClick={() => setShowFilters(f => !f)}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>
          {activeFilters > 0 && <span style={S.filterBadge}>{activeFilters}</span>}
        </button>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div style={S.filterPanel}>
          <div style={S.filterGroup}>
            <div style={S.filterLabel}>City</div>
            <div style={S.filterChips}>
              {CITIES.map(c => (
                <button key={c} style={{ ...S.fChip, ...(city === c ? S.fChipActive : {}) }} onClick={() => setCity(c)}>{c}</button>
              ))}
            </div>
          </div>
          <div style={S.filterGroup}>
            <div style={S.filterLabel}>Price Range</div>
            <div style={S.filterChips}>
              {PRICE_RANGES.map((r, i) => (
                <button key={r.label} style={{ ...S.fChip, ...(priceIdx === i ? S.fChipActive : {}) }} onClick={() => setPriceIdx(i)}>{r.label}</button>
              ))}
            </div>
          </div>
          {activeFilters > 0 && (
            <button style={S.clearBtn} onClick={clearFilters}>✕ Clear all filters</button>
          )}
        </div>
      )}

      {/* Results count */}
      <div style={S.resultsBar}>
        <span style={S.resultsText}>
          {loading ? 'Loading…' : `${filtered.length} listing${filtered.length !== 1 ? 's' : ''}${activeFilters > 0 || search ? ' found' : ''}`}
        </span>
        {(activeFilters > 0 || search) && (
          <button style={S.clearAllBtn} onClick={clearFilters}>Clear</button>
        )}
      </div>

      {/* Listing grid */}
      <div style={S.grid}>
        {loading && [1,2,3,4,5,6].map(i => <div key={i} style={S.skeleton} />)}

        {!loading && filtered.length === 0 && (
          <div style={S.empty}>
            <div style={S.emptyIcon}>🔍</div>
            <p style={S.emptyTitle}>No listings found</p>
            <p style={S.emptySub}>Try different filters or search terms</p>
            <button style={S.clearFiltersBtn} onClick={clearFilters}>Clear filters</button>
          </div>
        )}

        {!loading && filtered.map((listing, i) => (
          <div
            key={listing.id}
            style={{ ...S.card, animationDelay: i * 0.03 + 's' }}
            onClick={() => navigate('/listing/' + listing.id)}
          >
            <div style={S.cardThumb}>
              {listing.images && listing.images[0]
                ? <img src={listing.images[0]} alt={listing.title} style={S.cardImg} />
                : <div style={S.cardImgPlaceholder}>{catEmoji(listing.category)}</div>
              }
              {listing.category && (
                <div style={S.cardCatBadge}>{listing.category}</div>
              )}
            </div>
            <div style={S.cardBody}>
              <div style={S.cardTitle}>{listing.title}</div>
              <div style={S.cardPrice}>MWK {Number(listing.price || 0).toLocaleString()}</div>
              <div style={S.cardMeta}>
                {listing.city && <span style={S.cardCity}>📍 {listing.city}</span>}
                <span style={S.cardTime}>{timeAgo(listing.created_at)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom Nav */}
      <div style={S.nav}>
        <button style={{ ...S.navItem, color: '#1a7a4a' }} onClick={() => navigate('/')}>
          <span style={S.navIcon}>🏠</span>
          <span style={{ ...S.navLabel, color: '#1a7a4a', fontWeight: '700' }}>Home</span>
        </button>
        <button style={S.navItem} onClick={() => navigate('/jobs')}>
          <span style={S.navIcon}>💼</span>
          <span style={S.navLabel}>Jobs</span>
        </button>
        <button style={S.navPost} onClick={() => navigate('/post')}>+</button>
        <button style={{ ...S.navItem, position: 'relative' }} onClick={() => navigate('/chats')}>
          <span style={S.navIcon}>💬</span>
          <span style={S.navLabel}>Chats</span>
          {unreadCount > 0 && (
            <span style={S.unreadBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>
        <button style={S.navItem} onClick={() => navigate('/profile')}>
          <span style={S.navIcon}>👤</span>
          <span style={S.navLabel}>Me</span>
        </button>
      </div>
    </div>
  )
}

function catEmoji(cat) {
  const map = {
    Electronics: '📱', Furniture: '🛋️', Clothing: '👗', Vehicles: '🚗',
    Property: '🏠', Agriculture: '🌾', Food: '🍎', Services: '🔧', Other: '📦', All: '🛍️'
  }
  return map[cat] || '📦'
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date)
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return mins + 'm ago'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + 'h ago'
  const days = Math.floor(hrs / 24)
  if (days < 7) return days + 'd ago'
  return new Date(date).toLocaleDateString()
}

const S = {
  page: { minHeight: '100vh', background: '#f4f8f5', paddingBottom: '80px', fontFamily: 'system-ui, sans-serif' },

  // Header
  header: { background: '#fff', borderBottom: '1px solid #e8f0eb', boxShadow: '0 2px 8px rgba(0,0,0,0.05)', position: 'sticky', top: 0, zIndex: 50 },
  headerTop: { padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  brand: { fontFamily: 'system-ui, sans-serif', fontSize: '22px', fontWeight: '800', color: '#1a7a4a', letterSpacing: '-0.5px' },
  location: { fontSize: '11px', color: '#888', marginTop: '2px' },
  bellBtn: { background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: '4px' },
  bellIcon: { fontSize: '24px' },
  bellBadge: { position: 'absolute', top: '0px', right: '0px', background: '#1a7a4a', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '9px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  // Search
  searchBox: { display: 'flex', alignItems: 'center', gap: '8px', background: '#f4f8f5', borderRadius: '12px', padding: '10px 14px', margin: '0 14px 10px', border: '1px solid #e8f0eb' },
  searchInput: { flex: 1, border: 'none', background: 'transparent', fontSize: '14px', color: '#0f1410', fontFamily: 'inherit' },
  clearSearch: { background: 'none', border: 'none', color: '#888', fontSize: '14px', cursor: 'pointer' },

  // Shop/Services/Jobs tabs
  tabs: { display: 'flex', borderBottom: '1px solid #f0f0f0' },
  tab: { flex: 1, background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '10px 8px', fontSize: '14px', fontWeight: '600', color: '#888', cursor: 'pointer', transition: 'all 0.2s', fontFamily: 'inherit' },
  tabActive: { color: '#1a7a4a', borderBottomColor: '#1a7a4a' },

  // Category chips bar
  catBar: { display: 'flex', alignItems: 'center', background: '#fff', borderBottom: '1px solid #e8f0eb', paddingRight: '10px' },
  chipRow: { display: 'flex', gap: '7px', padding: '10px 12px', overflowX: 'auto', flex: 1 },
  chip: { flexShrink: 0, background: 'none', border: '1.5px solid #e0ebe3', borderRadius: '20px', padding: '5px 12px', fontSize: '12px', fontWeight: '600', color: '#637068', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' },
  chipActive: { background: '#1a7a4a', borderColor: '#1a7a4a', color: '#fff' },
  filterToggle: { background: '#f4f8f5', border: 'none', borderRadius: '10px', padding: '7px 10px', cursor: 'pointer', color: '#1a7a4a', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, position: 'relative' },
  filterBadge: { background: '#1a7a4a', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' },

  // Filter panel
  filterPanel: { background: '#fff', borderBottom: '1px solid #e8f0eb', padding: '14px 14px 10px', animation: 'slideDown 0.2s ease' },
  filterGroup: { marginBottom: '12px' },
  filterLabel: { fontSize: '11px', fontWeight: '800', color: '#637068', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' },
  filterChips: { display: 'flex', gap: '6px', flexWrap: 'wrap' },
  fChip: { background: '#f4f8f5', border: '1.5px solid transparent', borderRadius: '8px', padding: '5px 11px', fontSize: '12px', fontWeight: '600', color: '#637068', cursor: 'pointer', fontFamily: 'inherit' },
  fChipActive: { background: '#e6f7ee', borderColor: '#1a7a4a', color: '#1a7a4a' },
  clearBtn: { width: '100%', background: 'none', border: '1.5px solid #e0ebe3', borderRadius: '10px', padding: '9px', fontSize: '13px', fontWeight: '700', color: '#888', cursor: 'pointer', fontFamily: 'inherit' },

  // Results bar
  resultsBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px 4px' },
  resultsText: { fontSize: '12px', color: '#888', fontWeight: '600' },
  clearAllBtn: { fontSize: '12px', color: '#1a7a4a', fontWeight: '700', background: 'none', border: 'none', cursor: 'pointer' },

  // Grid
  grid: { padding: '8px 12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' },
  skeleton: { height: '200px', background: 'linear-gradient(90deg,#e8f0eb 25%,#f4f8f5 50%,#e8f0eb 75%)', borderRadius: '14px', animation: 'pulse 1.5s infinite' },
  empty: { gridColumn: '1 / -1', textAlign: 'center', padding: '60px 24px' },
  emptyIcon: { fontSize: '48px', marginBottom: '10px' },
  emptyTitle: { fontSize: '17px', fontWeight: '700', color: '#0f1410', marginBottom: '6px' },
  emptySub: { fontSize: '13px', color: '#888', marginBottom: '18px' },
  clearFiltersBtn: { background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },

  // Cards
  card: { background: '#fff', borderRadius: '14px', overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.07)', cursor: 'pointer', animation: 'fadeUp 0.3s ease both', border: '1px solid #eef3ef' },
  cardThumb: { position: 'relative', paddingTop: '75%', background: '#f0f4f1', overflow: 'hidden' },
  cardImg: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },
  cardImgPlaceholder: { position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' },
  cardCatBadge: { position: 'absolute', top: '7px', left: '7px', background: '#1a7a4a', color: '#fff', fontSize: '9px', fontWeight: '700', borderRadius: '5px', padding: '2px 7px' },
  cardBody: { padding: '10px' },
  cardTitle: { fontSize: '13px', fontWeight: '700', color: '#0f1410', marginBottom: '4px', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' },
  cardPrice: { fontSize: '14px', fontWeight: '800', color: '#1a7a4a', marginBottom: '4px' },
  cardMeta: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardCity: { fontSize: '11px', color: '#888' },
  cardTime: { fontSize: '10px', color: '#bbb' },

  // Bottom nav
  unreadBadge: { position: 'absolute', top: '-2px', right: '-2px', background: '#e74c3c', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '9px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  nav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: '#fff', borderTop: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 0', zIndex: 100 },
  navItem: { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer', position: 'relative' },
  navIcon: { fontSize: '20px' },
  navLabel: { fontSize: '10px', color: '#888' },
  navPost: { width: '48px', height: '48px', background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '50%', fontSize: '24px', cursor: 'pointer', marginTop: '-16px', boxShadow: '0 3px 10px rgba(26,122,74,0.4)' },
}