import React, { useEffect, useState, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

import HomeStyles      from '../styles/HomeStyles'
import HomeHeader      from '../components/HomeHeader'
import FlashSaleStrip  from '../components/FlashSaleStrip'
import FeaturedSection from '../components/FeaturedSection'
import { ProductCard, SkeletonCard } from '../components/ProductCard'
import { CategoryMosaic, SpotlightSection, TrustBand } from '../components/HomeSections'
import BottomNav       from '../components/BottomNav'
import InstallPrompt       from '../components/InstallPrompt'
import '../styles/homeSections.css'


import useSearchAnimation  from '../hooks/useSearchAnimation'
import { useUserLocation } from '../hooks/useUserLocation'
import { ALL_CATEGORIES, PRICE_RANGES, CAT_META } from '../constants/homeConstants'
import { isFlashActive, sortProductsSmart, trackSearch } from '../utils/homeUtils'

function HeroBg({ images }) {
  const [stack, setStack] = useState([0, 1])
  const [phase, setPhase] = useState('idle') // idle | leaving | entering

  const imgs = images?.length >= 2 ? images : null
  const len = imgs?.length || 1

  useEffect(() => {
    if (!imgs) return
    const interval = setInterval(() => {
      // Phase 1: current starts sliding + fading out
      setPhase('leaving')
      setTimeout(() => {
        // Phase 2: advance index, new image slides in
        setStack(([, n]) => [n, (n + 1) % len])
        setPhase('entering')
        setTimeout(() => {
          setPhase('idle')
        }, 900)
      }, 800)
    }, 5500)
    return () => clearInterval(interval)
  }, [len])

  const baseStyle = {
    position: 'absolute', inset: 0, zIndex: 0,
    backgroundSize: 'cover',
    backgroundPosition: 'center center',
    backgroundRepeat: 'no-repeat',
    willChange: 'transform, opacity',
  }

  if (!imgs) return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 0,
      backgroundImage: 'linear-gradient(135deg, #0d4a2c 0%, #1a7a4a 60%, #22a05e 100%)',
      willChange: 'transform, opacity',
    }} />
  )

  const [cur, nxt] = stack

  // Current slide — slow zoom in idle, slides+fades out on leave
  const curStyle = {
    ...baseStyle,
    backgroundImage: `url('${imgs[cur]}')`,
    opacity: phase === 'leaving' ? 0 : 1,
    transform: phase === 'leaving'
      ? 'scale(1.08) translateX(-12px)'
      : 'scale(1.03) translateX(0)',
    transition: phase === 'leaving'
      ? 'opacity 0.8s cubic-bezier(0.4,0,1,1), transform 0.8s cubic-bezier(0.4,0,1,1)'
      : 'transform 8s linear',
  }

  // Next slide — starts slightly right + transparent, slides in from right
  const nxtStyle = {
    ...baseStyle,
    backgroundImage: `url('${imgs[nxt]}')`,
    opacity: phase === 'idle' ? 0 : phase === 'entering' ? 1 : 0.6,
    transform: phase === 'idle'
      ? 'scale(1.06) translateX(18px)'
      : phase === 'entering'
      ? 'scale(1.03) translateX(0)'
      : 'scale(1.05) translateX(8px)',
    transition: phase === 'entering'
      ? 'opacity 0.9s cubic-bezier(0,0,0.2,1), transform 0.9s cubic-bezier(0,0,0.2,1)'
      : phase === 'leaving'
      ? 'opacity 0.5s ease, transform 0.5s ease'
      : 'none',
    zIndex: phase !== 'idle' ? 1 : 0,
  }

  return (
    <>
      <div style={curStyle} />
      <div style={nxtStyle} />
    </>
  )
}

function SidebarDesktop({ category, setCategory, categoriesWithProducts, navigate, sidebarExpanded, setSidebarExpanded }) {
  return (
    <aside className="soko-sidebar">
      <div className="soko-sidebar-section">Browse</div>
      {categoriesWithProducts.map((key) => (
        <button key={key} className={`soko-sidebar-cat ${category === key ? 'active' : ''}`}
          onClick={() => setCategory(key)}
          style={{ width: '100%', textAlign: 'left', background: category === key ? '#e6f4ec' : 'transparent', borderWidth: 0, color: category === key ? '#1a7a4a' : '#3d5244', fontWeight: category === key ? 700 : 500 }}>
          <span style={{ fontSize: 18 }}>{CAT_META[key]?.emoji}</span>
          <span>{key}</span>
        </button>
      ))}
      {categoriesWithProducts.length > 6 && (
        <button onClick={() => setSidebarExpanded(e => !e)}
          style={{ width: '100%', textAlign: 'left', background: 'transparent', borderWidth: 0, display: 'flex', alignItems: 'center', gap: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, color: '#1a7a4a', cursor: 'pointer' }}>
          <span style={{ fontSize: 16 }}>{sidebarExpanded ? '▲' : '▼'}</span>
          <span>{sidebarExpanded ? 'Show less' : `${categoriesWithProducts.length - 6} more…`}</span>
        </button>
      )}
      <div className="soko-sidebar-section" style={{ marginTop: 12 }}>Quick links</div>
      <button className="soko-sidebar-cat" onClick={() => navigate('/post')} style={{ width: '100%', textAlign: 'left', background: 'transparent', borderWidth: 0 }}>
        <span style={{ fontSize: 18 }}>➕</span><span>Post a listing</span>
      </button>
      <button className="soko-sidebar-cat" onClick={() => navigate('/status')} style={{ width: '100%', textAlign: 'left', background: 'transparent', borderWidth: 0 }}>
        <span style={{ fontSize: 18 }}>📢</span><span>My Status</span>
      </button>
      <button className="soko-sidebar-cat" onClick={() => navigate('/services')} style={{ width: '100%', textAlign: 'left', background: 'transparent', borderWidth: 0 }}>
        <span style={{ fontSize: 18 }}>🛠️</span><span>Services</span>
      </button>
      <button className="soko-sidebar-cat" onClick={() => navigate('/jobs')} style={{ width: '100%', textAlign: 'left', background: 'transparent', borderWidth: 0 }}>
        <span style={{ fontSize: 18 }}>💼</span><span>Jobs</span>
      </button>
    </aside>
  )
}

function DesktopNav({ search, setSearch, navigate, onImageFile, imgSearchState, animKeywords, animIdx }) {
  const fileInputRef = useRef(null)
  const inputRef = useRef(null)
  const keyword = animKeywords?.length > 0 ? animKeywords[animIdx % animKeywords.length] : 'Samsung Galaxy A57'

  function handleSearch() {
    if (!search && keyword) setSearch(keyword)
    inputRef.current?.blur()
  }
  return (
    <nav className="soko-desktop-nav soko-top-nav-desktop">
      <span className="brand">Soko<span style={{ color: '#f59e0b' }}>Mw</span></span>
      <div style={{
        flex: 1, maxWidth: 600,
        display: 'flex', alignItems: 'center', gap: 5,
        background: '#f4f8f5', borderRadius: 50,
        padding: '8px 10px 8px 11px',
        border: '1.5px solid #e2ebe4',
        minWidth: 0,
        position: 'relative',
      }}>
        {/* Search icon — clicking it triggers search */}
        <button onClick={handleSearch} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, flexShrink: 0 }} tabIndex={-1}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2.6" strokeLinecap="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
        {/* Input */}
        <input
          ref={inputRef}
          id="desktop-search-input"
          type="text"
          placeholder=""
          value={search}
          onChange={e => setSearch(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSearch()}
          style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13.5, color: '#111', outline: 'none', fontFamily: "'DM Sans',system-ui,sans-serif" }}
        />
        {/* Animated placeholder */}
        {!search && (
          <div style={{ position: 'absolute', left: 36, top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <span style={{ color: '#bbb', fontSize: 13.5 }}>Search </span>
            <span key={animIdx} style={{ color: '#1a7a4a', fontWeight: 700, fontSize: 13.5, marginLeft: 3, animation: 'wordSlideUp 3.5s cubic-bezier(0.16,1,0.3,1) forwards' }}>
              {keyword}
            </span>
          </div>
        )}
        {/* Clear or divider */}
        {search
          ? <button style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#999', padding: '2px 4px', flexShrink: 0 }} onClick={() => setSearch('')}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          : <div style={{ width: 1, height: 16, background: '#d4dfd6', flexShrink: 0, margin: '0 2px' }} />
        }
        {/* Camera button */}
        {!search && (
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px 4px', flexShrink: 0, opacity: imgSearchState === 'analyzing' ? 0.5 : 1 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={imgSearchState === 'analyzing'}
            title="Search by photo"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
              <circle cx="12" cy="13" r="4"/>
            </svg>
          </button>
        )}
        <input ref={fileInputRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={onImageFile} />
      </div>
      <div className="nav-actions">
        <button className="nav-btn" onClick={() => navigate('/chats')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          Chats
        </button>
        <button className="nav-btn" onClick={() => navigate('/notifications')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
          Alerts
        </button>
        <button className="nav-btn" onClick={() => navigate('/profile')}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          Profile
        </button>
        <button className="nav-btn primary" onClick={() => navigate('/post')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Post Listing
        </button>
      </div>
    </nav>
  )
}

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
  const [userCity,    setUserCity]    = useState('')
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
      .select('avatar_url, full_name, city')
      .eq('id', user.id)
      .maybeSingle()
    setUser({ ...user, avatar_url: profile?.avatar_url || null })
    if (profile?.city) setUserCity(profile.city)
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

  const heroImages = useMemo(() =>
    listings
      .filter(l => l.images?.[0])
      .map(l => l.images[0])
      .slice(0, 10),
  [listings])

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
  const [sidebarExpanded, setSidebarExpanded] = useState(false)
  const visibleCats = sidebarExpanded ? categoriesWithProducts : categoriesWithProducts.slice(0, 6)

  return (
    <div className="soko-page-shell" style={page}>
      <HomeStyles />
      <DesktopNav search={search} setSearch={setSearch} navigate={navigate} onImageFile={handleImageFile} imgSearchState={imgSearchState} animKeywords={animKeywords} animIdx={animIdx} />
      <SidebarDesktop category={category} setCategory={setCategory} categoriesWithProducts={visibleCats} navigate={navigate} sidebarExpanded={sidebarExpanded} setSidebarExpanded={setSidebarExpanded} />
      <div className="soko-main-content">
      {/* Hero — desktop only */}
      <div className="soko-hero">
        <HeroBg images={heroImages} />
        <div className="soko-hero-overlay" />
        <div className="soko-hero-text">
          <div className="soko-hero-eyebrow">🇲🇼 Malawi's Marketplace</div>
          <h1>Buy &amp; Sell <em>Anything</em><br />in Malawi</h1>
          <p>Thousands of listings from sellers across every district — electronics, clothing, vehicles and more.</p>
          <div className="soko-hero-cta">
            <button className="soko-hero-btn white" onClick={() => navigate('/post')}>＋ Post a Listing</button>
            <button className="soko-hero-btn outline" onClick={() => setCategory('All')}>Browse All</button>
          </div>
        </div>
        <div className="soko-hero-stats">
          <div className="soko-hero-stat">
            <div className="soko-hero-stat-icon">🛍️</div>
            <div><span className="num">1.2K+</span><span className="lbl">Active listings</span></div>
          </div>
          <div className="soko-hero-stat">
            <div className="soko-hero-stat-icon">🤝</div>
            <div><span className="num">800+</span><span className="lbl">Verified sellers</span></div>
          </div>
          <div className="soko-hero-stat">
            <div className="soko-hero-stat-icon">📍</div>
            <div><span className="num">24</span><span className="lbl">Districts covered</span></div>
          </div>
        </div>
      </div>

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

      {!search && category === 'All' && activeFilters === 0 && !loading && (
        <SpotlightSection listings={listings} navigate={navigate} />
      )}

      {!search && category === 'All' && activeFilters === 0 && !loading && (
        <CategoryMosaic listings={listings} setCategory={setCategory} />
      )}

      {!search && category === 'All' && activeFilters === 0 && (
        <div
          onClick={() => navigate('/looking-for')}
          style={{
            margin: '0 16px 14px',
            background: 'linear-gradient(135deg, #0f2a1a 0%, #1a7a4a 100%)',
            borderRadius: 18,
            padding: '18px 20px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 4px 20px rgba(26,122,74,0.25)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontSize: 22 }}>🔎</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>Looking For</span>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, maxWidth: 220 }}>
              Post what you need — let sellers come to you
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
            <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
              Browse Requests →
            </div>
            <div style={{ background: '#f9a825', borderRadius: 20, padding: '5px 14px', fontSize: 12, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>
              + Post Request
            </div>
          </div>
        </div>
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
        <>
          {!loading && <TrustBand listings={listings} />}
          <div className="grid-lead">
            <h2>Fresh on the market</h2>
            <span>{loading ? 'Loading…' : `${sorted.length} listing${sorted.length !== 1 ? 's' : ''}`}</span>
            {userLat && (
              <span style={locationPill}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="#1a7a4a">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                </svg>
                Sorted by distance
              </span>
            )}
          </div>
        </>
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
    </div>{/* end soko-main-content */}
    </div>
  )
}

// ── Styles ─────────────────────────────────────────────────
const page = { minHeight: '100vh', background: '#f7f8f6', paddingBottom: 90, fontFamily: "'DM Sans', system-ui, sans-serif", isolation: 'isolate' }

const locationPill = {
  display: 'flex', alignItems: 'center', gap: 4,
  fontSize: 11, fontWeight: 600, color: '#1a7a4a',
  background: '#e6f4ec', borderRadius: 20, padding: '3px 9px',
}
const resultsBanner      = { margin: '10px auto 2px', maxWidth: 1400, padding: '10px 16px', background: 'linear-gradient(135deg,#e6f4ec,#f0f9f4)', border: '1.5px solid #a3d4b5', borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between', animation: 'fadeUp 0.25s ease both' }
const resultsBannerLeft  = { display: 'flex', alignItems: 'center', gap: 12 }
const resultsBannerCount = { fontSize: 28, fontWeight: 900, color: '#1a7a4a', fontFamily: "'Sora', system-ui, sans-serif", lineHeight: 1, letterSpacing: '-1px' }
const resultsBannerLabel = { fontSize: 13, fontWeight: 700, color: '#1a7a4a', lineHeight: 1.2 }
const resultsBannerSub   = { fontSize: 11, color: '#5a8a6f', marginTop: 2, fontWeight: 500 }
const resultsClearBtn    = { background: 'none', border: '1.5px solid #a3d4b5', borderRadius: 20, padding: '5px 12px', fontSize: 11, fontWeight: 700, color: '#1a7a4a', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }

const grid     = { padding: '8px 16px 80px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14, maxWidth: 1400, margin: '0 auto' }
const empty    = { gridColumn: '1/-1', textAlign: 'center', padding: '60px 24px' }
const emptyBtn = { background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: 12, padding: '11px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }

const testBanner     = { background: '#fffbeb', borderBottom: '1px solid #fde68a', padding: '9px 16px', display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center' }
const testBannerText = { fontSize: 12, color: '#92400e', fontWeight: 600, lineHeight: 1.5 }
