import { useEffect, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

import HomeStyles      from '../styles/HomeStyles'
import HomeHeader      from '../components/HomeHeader'
import FlashSaleStrip  from '../components/FlashSaleStrip'
import FeaturedSection from '../components/FeaturedSection'
import { ProductCard, SkeletonCard } from '../components/ProductCard'
import BottomNav       from '../components/BottomNav'
import InstallPrompt   from '../components/InstallPrompt'

import useSearchAnimation  from '../hooks/useSearchAnimation'
import { useUserLocation } from '../hooks/useUserLocation'
import { ALL_CATEGORIES, PRICE_RANGES } from '../constants/homeConstants'
import { isFlashActive, sortProductsSmart, trackSearch } from '../utils/homeUtils'

export default function Home() {
  const navigate = useNavigate()

  // ── Data ──────────────────────────────────
  const [listings,    setListings]    = useState([])
  const [loading,     setLoading]     = useState(true)
  const [user,        setUser]        = useState(null)
  const [notifCount,  setNotifCount]  = useState(0)

  // ── Filter / sort state ───────────────────
  const [search,      setSearch]      = useState('')
  const [category,    setCategory]    = useState('All')
  const [city,        setCity]        = useState('All')
  const [priceIdx,    setPriceIdx]    = useState(0)
  const [sortIdx,     setSortIdx]     = useState(0)
  const [showFilters, setShowFilters] = useState(false)

  // ── Search bar UI ─────────────────────────
  const [isFocused,   setIsFocused]   = useState(false)

  // ── Image search ──────────────────────────
  const [imgSearchState, setImgSearchState] = useState('idle')
  const [imgPreview,     setImgPreview]     = useState(null)
  const [imgSearchTerm,  setImgSearchTerm]  = useState('')

  // ── Sorted products (async — replaces filtered useMemo) ──
  const [sorted, setSorted] = useState([])

  // ── User location ─────────────────────────
  const { lat: userLat, lng: userLng } = useUserLocation()

  // ── Typewriter animation hook ─────────────
  const { animKeywords, animIdx, animText, animPhase, currentKeyword } =
    useSearchAnimation({ listings, search, isFocused })

  // ── Init ──────────────────────────────────
  useEffect(() => { init() }, [])

 async function init() {
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url, full_name')
      .eq('id', user.id)
      .maybeSingle()
    setUser({ ...user, avatar_url: profile?.avatar_url || null })
    loadNotifs(user.id)
  }
  await loadListings()
}

 async function loadListings() {
  setLoading(true)
  const { data } = await supabase
  .from('listings')
  .select('id, title, price, price_type, images, city, category, condition, featured, is_featured, flash_sale_price, flash_sale_expires_at, promo_badge, bulk_pricing, stock_qty, created_at, seller_id, latitude, longitude, status, description, tags')
  .or('status.eq.active,featured.eq.true')
  .order('created_at', { ascending: false })
  .limit(40)
  setListings(data || [])
  setLoading(false)
}
  async function loadNotifs(uid) {
    const { count } = await supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid).eq('read', false)
    setNotifCount(count || 0)
  }

  // ── Derived values ────────────────────────
  const priceRange = PRICE_RANGES[priceIdx]

  const categoriesWithProducts = ALL_CATEGORIES.filter(
    cat => listings.some(l => l.category === cat)
  )

  // ── Smart filter + sort (async) ───────────
  useEffect(() => {
    if (!listings.length) return

    // Track search term for future relevance scoring
    if (search) trackSearch(search, user?.id)

    // Step 1: filter
    let items = listings.filter(l => {
      if (category !== 'All' && l.category !== category) return false
      if (city !== 'All' && l.city !== city) return false
      const effectivePrice = isFlashActive(l) ? l.flash_sale_price : l.price
      if (effectivePrice < priceRange.min || effectivePrice > priceRange.max) return false
      if (search &&
          !l.title?.toLowerCase().includes(search.toLowerCase()) &&
          !l.description?.toLowerCase().includes(search.toLowerCase())) return false
      return true
    })

    // Step 2: sort
    if (sortIdx === 1) {
      setSorted([...items].sort((a, b) =>
        (isFlashActive(a) ? a.flash_sale_price : a.price) -
        (isFlashActive(b) ? b.flash_sale_price : b.price)
      ))
    } else if (sortIdx === 2) {
      setSorted([...items].sort((a, b) =>
        (isFlashActive(b) ? b.flash_sale_price : b.price) -
        (isFlashActive(a) ? a.flash_sale_price : a.price)
      ))
    } else {
      // Smart sort — async (hits DB for logged-in users)
      sortProductsSmart(items, userLat, userLng, user?.id).then(setSorted)
    }
  }, [listings, category, city, priceRange, search, sortIdx, userLat, userLng, user?.id])

  const featured = useMemo(() =>
  [...listings]
    .filter(l => l.images?.[0] && (l.featured || l.is_featured))
    .sort((a, b) => {
      if (isFlashActive(b) !== isFlashActive(a)) return isFlashActive(b) ? 1 : -1
      if ((b.promo_badge ? 1 : 0) !== (a.promo_badge ? 1 : 0)) return (b.promo_badge ? 1 : 0) - (a.promo_badge ? 1 : 0)
      return new Date(b.created_at) - new Date(a.created_at)
    })
    .slice(0, 10),
  [listings]
)

  const activeFilters =
    (category !== 'All' ? 1 : 0) +
    (city     !== 'All' ? 1 : 0) +
    (priceIdx !== 0     ? 1 : 0)

  const flashCount = listings.filter(l => isFlashActive(l)).length

  // ── Helpers ───────────────────────────────
  function clearFilters() { setCategory('All'); setCity('All'); setPriceIdx(0); setSearch('') }

  function clearImageSearch() {
    setImgPreview(null); setImgSearchTerm(''); setImgSearchState('idle'); setSearch('')
  }

  async function handleImageFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const reader = new FileReader()
    reader.onload = async (ev) => {
      const dataUrl = ev.target.result
      setImgPreview(dataUrl)
      setImgSearchState('analyzing')
      setSearch('')
      try {
        const { pipeline } = await import('@huggingface/transformers')
        const captioner = await pipeline('image-classification', 'Xenova/resnet-50')
        const result = await captioner(dataUrl)
        const rawLabel = (result?.[0]?.label || '').replace(/_/g, ' ').split(',')[0].trim().toLowerCase()
        const CATEGORY_KEYWORDS = {
          Electronics: ['phone','laptop','computer','tv','television','camera','tablet','monitor','keyboard','mouse','speaker','headphone','radio','printer','iphone','samsung','electronic'],
          Vehicles:    ['car','truck','bus','motorcycle','vehicle','van','suv','pickup','lorry','bicycle','bike','toyota','mazda','honda','sports car','minibus','racer','race','convertible','sedan','coupe','hatchback','wagon','jeep','auto'],
          Furniture:   ['chair','table','sofa','couch','bed','desk','shelf','cabinet','wardrobe','drawer','furniture','stool','bench'],
          Clothing:    ['shirt','dress','shoe','trouser','jacket','coat','hat','bag','cloth','wear','suit','skirt','sandal','sneaker'],
          Food:        ['food','fruit','vegetable','maize','rice','banana','tomato','mango','chicken','meat','fish','bread','grain'],
          Agriculture: ['farm','crop','seed','fertilizer','tractor','harvest','cattle','goat','cow','pig','poultry'],
          Property:    ['house','building','land','plot','apartment','room','property','home','estate'],
        }
        let matchedCategory = null
        for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
          if (keywords.some(k => rawLabel.includes(k))) { matchedCategory = cat; break }
        }
        const matchingListings = listings.filter(l => {
          const title = (l.title || '').toLowerCase()
          const desc  = (l.description || '').toLowerCase()
          return rawLabel.split(' ').some(word => word.length > 3 && (title.includes(word) || desc.includes(word)))
        })
        let term = rawLabel
        if (matchingListings.length > 0) {
          const titleWords = matchingListings.flatMap(l => l.title.toLowerCase().split(' '))
          const wordFreq   = titleWords.reduce((acc, w) => { acc[w] = (acc[w] || 0) + 1; return acc }, {})
          const bestWord   = Object.entries(wordFreq).sort((a, b) => b[1] - a[1]).find(([w]) => w.length > 3)?.[0]
          if (bestWord) term = bestWord
        }
        if (matchedCategory) {
          setCategory(matchedCategory)
          if (listings.filter(l => l.category === matchedCategory).length > 0) term = ''
        }
        if (term || matchedCategory) {
          const finalTerm = matchedCategory ? '' : term
          if (finalTerm) trackSearch(finalTerm, user?.id)
          setImgSearchTerm(matchedCategory ? `${matchedCategory} — showing all listings` : term)
          setSearch(finalTerm)
          setImgSearchState('done')
        } else {
          setImgSearchState('error')
        }
      } catch (err) {
        console.error('Image search error:', err)
        setImgSearchState('error')
      }
    }
    reader.readAsDataURL(file)
  }

  // ── Render ────────────────────────────────
  return (
    <div style={page}>
      <HomeStyles />

      {/* Test banner */}
      <div style={testBanner}>
        <span style={{ fontSize: 15, flexShrink: 0 }}>🧪</span>
        <span style={testBannerText}>Early access — you're testing Soko Malawi. Official launch date will be announced soon.</span>
      </div>

      <HomeHeader
        user={user}
        notifCount={notifCount}
        search={search}            setSearch={setSearch}
        isFocused={isFocused}      setIsFocused={setIsFocused}
        animText={animText}        animPhase={animPhase}
        animKeywords={animKeywords} animIdx={animIdx}
        currentKeyword={currentKeyword}
        imgSearchState={imgSearchState}
        imgPreview={imgPreview}
        imgSearchTerm={imgSearchTerm}
        category={category}        setCategory={setCategory}
        city={city}                setCity={setCity}
        priceIdx={priceIdx}        setPriceIdx={setPriceIdx}
        sortIdx={sortIdx}          setSortIdx={setSortIdx}
        showFilters={showFilters}  setShowFilters={setShowFilters}
        activeFilters={activeFilters}
        categoriesWithProducts={categoriesWithProducts}
        onClearFilters={clearFilters}
        onImageFile={handleImageFile}
        onClearImageSearch={clearImageSearch}
      />

      {flashCount > 0 && !search && category === 'All' && (
        <FlashSaleStrip listings={listings} navigate={navigate} />
      )}

      {!search && category === 'All' && activeFilters === 0 && (
  <FeaturedSection
    featured={featured}
    navigate={navigate}
    user={user}
    allListings={listings}
    onRefresh={loadListings}
  />
)}

      {(activeFilters > 0 || sortIdx !== 0 || search) ? (
        <div style={resultsBanner}>
          <div style={resultsBannerLeft}>
            <div style={resultsBannerCount}>
              {loading ? '…' : sorted.length}
            </div>
            <div>
              <div style={resultsBannerLabel}>
                {loading ? 'Loading…' : `result${sorted.length !== 1 ? 's' : ''} found`}
              </div>
              <div style={resultsBannerSub}>
                {search && `"${search}"`}
                {search && (activeFilters > 0 || sortIdx !== 0) && ' · '}
                {activeFilters > 0 && `${activeFilters} filter${activeFilters > 1 ? 's' : ''}`}
                {sortIdx !== 0 && (activeFilters > 0 ? ' · ' : '') + ['', '↑ Price', '↓ Price'][sortIdx]}
              </div>
            </div>
          </div>
          <button style={resultsClearBtn} onClick={() => { clearFilters(); setSortIdx(0) }}>
            Clear all ✕
          </button>
        </div>
      ) : (
        <div style={resultsBar}>
          <span style={resultsCount}>
            {loading ? 'Loading…' : `${sorted.length} listing${sorted.length !== 1 ? 's' : ''}`}
          </span>
          {userLat && (
            <span style={locationPill}>
              <svg width="10" height="10" viewBox="0 0 24 24" fill="#1a7a4a">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              Sorted by distance
            </span>
          )}
        </div>
      )}

      <div style={grid}>
        {loading && [1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
        {!loading && sorted.length === 0 && (
          <div style={empty}>
            <div style={{ fontSize: 44, marginBottom: 10 }}>🔍</div>
            <p style={{ fontSize: 17, fontWeight: 700, color: '#111', marginBottom: 6 }}>Nothing found</p>
            <p style={{ fontSize: 13, color: '#999', marginBottom: 18 }}>
              {search ? `No listings matching "${search}"` : 'Try adjusting your filters'}
            </p>
            <button style={emptyBtn} onClick={() => { clearFilters(); setSortIdx(0) }}>Clear filters</button>
          </div>
        )}
        {!loading && sorted.map((listing, i) => (
          <ProductCard
            key={listing.id}
            listing={listing}
            delay={i * 0.04}
            userId={user?.id}
            onClick={() => navigate('/listing/' + listing.id)}
          />
        ))}
      </div>

      <BottomNav />
      <InstallPrompt />
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────
const page = { minHeight: '100vh', background: '#f7f8f6', paddingBottom: 90, fontFamily: "'DM Sans', system-ui, sans-serif", maxWidth: 480, margin: '0 auto' }

const resultsBar   = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px 6px' }
const resultsCount = { fontSize: 12, fontWeight: 600, color: '#aaa' }
const locationPill = {
  display: 'flex', alignItems: 'center', gap: 4,
  fontSize: 11, fontWeight: 600, color: '#1a7a4a',
  background: '#e6f4ec', borderRadius: 20, padding: '3px 9px',
}
const resultsBanner      = { margin: '10px 14px 2px', background: 'linear-gradient(135deg,#e6f4ec,#f0f9f4)', border: '1.5px solid #a3d4b5', borderRadius: 14, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeUp 0.25s ease both' }
const resultsBannerLeft  = { display: 'flex', alignItems: 'center', gap: 12 }
const resultsBannerCount = { fontSize: 28, fontWeight: 900, color: '#1a7a4a', fontFamily: "'Sora', system-ui, sans-serif", lineHeight: 1, letterSpacing: '-1px' }
const resultsBannerLabel = { fontSize: 13, fontWeight: 700, color: '#1a7a4a', lineHeight: 1.2 }
const resultsBannerSub   = { fontSize: 11, color: '#5a8a6f', marginTop: 2, fontWeight: 500 }
const resultsClearBtn    = { background: 'none', border: '1.5px solid #a3d4b5', borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 700, color: '#1a7a4a', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }

const grid     = { padding: '8px 10px 6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }
const empty    = { gridColumn: '1/-1', textAlign: 'center', padding: '60px 24px' }
const emptyBtn = { background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }

const testBanner     = { background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 8 }
const testBannerText = { fontSize: 12, color: '#92400e', fontWeight: 600, lineHeight: 1.5 }