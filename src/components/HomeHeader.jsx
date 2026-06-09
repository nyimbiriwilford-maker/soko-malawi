import { useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { CAT_META, CITIES, PRICE_RANGES, SORT_OPTIONS } from '../constants/homeConstants'

export default function HomeHeader({
  user,
  notifCount,
  search, setSearch,
  isFocused, setIsFocused,
  animText, animPhase,
  animKeywords, animIdx,
  currentKeyword,
  imgSearchState, imgPreview, imgSearchTerm,
  category, setCategory,
  city, setCity,
  priceIdx, setPriceIdx,
  sortIdx, setSortIdx,
  showFilters, setShowFilters,
  activeFilters,
  categoriesWithProducts,
  onClearFilters,
  onImageFile,
  onClearImageSearch,
}) {
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const fileInputRef = useRef(null)

  function handleSearchBarClick() {
    if (search || isFocused) return
    const kw = currentKeyword || animKeywords[animIdx % animKeywords.length] || ''
    if (kw) setSearch(kw)
    inputRef.current?.focus()
  }

  function handleSearchSubmit() {
    if (!search) {
      const kw = currentKeyword || animText || animKeywords[animIdx % animKeywords.length] || ''
      if (kw) setSearch(kw)
    }
    inputRef.current?.focus()
  }

  const totalActive = activeFilters + (sortIdx !== 0 ? 1 : 0)

  return (
    <div style={S.header} className="soko-top-nav-mobile">
      <div style={S.headerInner}>

        {/* ══ SINGLE TOP ROW: logo · search · actions ══ */}
        <div style={S.topRow}>

          {/* Logo */}
   <div style={S.logoWrap}>
  <div style={S.brand}>
    <span style={{ animation: 'brandReveal 0.4s ease 0.15s both' }}>
      Soko<span style={{ color: '#f59e0b' }}>Mw</span>
    </span>
  </div>
</div>
          {/* Search bar — grows to fill all available space */}
          <div style={{
            ...S.searchBox,
            borderColor: isFocused ? '#1a7a4a' : '#e8ede9',
            boxShadow: isFocused ? '0 0 0 3px rgba(26,122,74,0.10)' : 'none',
          }}>
            <button style={S.searchIconBtn} onClick={handleSearchSubmit} tabIndex={-1}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={isFocused ? '#1a7a4a' : '#aaa'} strokeWidth="2.6" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </button>

            <div style={S.searchInputWrap}>
              <input
                ref={inputRef}
                style={S.searchInput}
                value={search}
                onChange={e => setSearch(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={e => e.key === 'Enter' && handleSearchSubmit()}
              />
             {!search && !isFocused && (
  <div style={S.animPlaceholder} onClick={handleSearchBarClick}>
    <span style={S.animPrefix}>Search </span>
    <div style={S.animSlotOuter}>
      <span
        key={animIdx}
        style={S.animSlotWord}
      >
        {animKeywords[animIdx % animKeywords.length]}
      </span>
    </div>
  </div>
)}
            </div>

            {search ? (
              <button style={S.clearBtn} onClick={() => setSearch('')}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            ) : <div style={S.searchDivider} />}

            {!search && (
              <button
                style={{ ...S.camInsideBtn, opacity: imgSearchState === 'analyzing' ? 0.5 : 1 }}
                title="Search by photo"
                onClick={() => fileInputRef.current?.click()}
                disabled={imgSearchState === 'analyzing'}
              >
                {imgSearchState === 'analyzing'
                  ? <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2.2" strokeLinecap="round">
                      <circle cx="12" cy="12" r="10" strokeDasharray="31.4" strokeDashoffset="10"
                        style={{ animation: 'spin 0.8s linear infinite', transformOrigin: 'center' }} />
                    </svg>
                  : <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                      <circle cx="12" cy="13" r="4"/>
                    </svg>
                }
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div style={S.actions}>
            {/* Notifications */}
            <button
              style={{ ...S.iconBtn, position: 'relative' }}
              onClick={() => navigate('/notifications')}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
              </svg>
              {notifCount > 0 && <span style={S.bellBadge}>{notifCount > 9 ? '9+' : notifCount}</span>}
            </button>

            {/* Profile */}
            <button
              style={S.profileBtn}
              onClick={() => navigate('/profile')}
            >
              {user?.user_metadata?.avatar_url
                ? <img src={user.user_metadata.avatar_url} alt="avatar" style={S.avatarImg} />
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                    <circle cx="12" cy="7" r="4"/>
                  </svg>
              }
            </button>
          </div>
        </div>

        <input ref={fileInputRef} type="file" accept="image/*" capture="environment"
          style={{ display: 'none' }} onChange={onImageFile} />

        {/* ── Image search banner ── */}
        {imgPreview && (
          <div style={S.imgBanner}>
            <div style={S.imgBannerLeft}>
              <img src={imgPreview} alt="search" style={S.imgThumb} />
              <div style={S.imgBannerText}>
                {imgSearchState === 'analyzing' && <><div style={S.imgBannerTitle}>Identifying item…</div><div style={S.imgBannerSub}>Analysing your photo</div></>}
                {imgSearchState === 'done'      && <><div style={S.imgBannerTitle}>Found: <strong>"{imgSearchTerm}"</strong></div><div style={S.imgBannerSub}>Showing matching listings</div></>}
                {imgSearchState === 'error'     && <><div style={{ ...S.imgBannerTitle, color: '#dc2626' }}>Couldn't identify</div><div style={S.imgBannerSub}>Try a clearer photo</div></>}
              </div>
            </div>
            <button style={S.imgBannerClose} onClick={onClearImageSearch}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════
          CATEGORY PILLS + FILTER BUTTON  (one row)
          ══════════════════════════════════════════ */}
      <div style={S.catRow}>

        {/* Scrollable pills — text only, no icons */}
        <div style={S.catScroll}>
          <button
            className="catpill"
            style={{ ...S.pill, ...(category === 'All' ? S.pillActive : {}) }}
            onClick={() => setCategory('All')}
          >
            All
          </button>

          {categoriesWithProducts.map((cat, idx) => (
            <button
              key={cat}
              className="catpill"
              style={{
                ...S.pill,
                ...(category === cat ? S.pillActive : {}),
                animation: `pillBounceIn 0.35s cubic-bezier(0.34,1.56,0.64,1) ${0.45 + idx * 0.04}s both`,
              }}
              onClick={() => setCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Subtle vertical divider */}
        <div style={S.catDivider} />

        {/* Filter icon — right side of the same row */}
        <button
          style={{
            ...S.filterBtn,
            ...(showFilters || totalActive > 0 ? S.filterBtnActive : {}),
          }}
          onClick={() => setShowFilters(f => !f)}
          aria-label="Sort & Filter"
        >
          {totalActive > 0 ? (
            <span style={S.filterBadgeNum}>{totalActive}</span>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
              stroke={showFilters ? '#fff' : '#444'} strokeWidth="2.4"
              strokeLinecap="round" strokeLinejoin="round">
              <line x1="4"  y1="6"  x2="20" y2="6"/>
              <line x1="8"  y1="12" x2="16" y2="12"/>
              <line x1="11" y1="18" x2="13" y2="18"/>
            </svg>
          )}
        </button>
      </div>

      {/* ══════════════════════════════════════════
          FILTER + SORT DRAWER
          ══════════════════════════════════════════ */}
      {showFilters && (
        <div style={S.drawer}>
          {/* drag handle */}
          <div style={S.drawerHandle} />

          {/* header */}
          <div style={S.drawerHeader}>
            <span style={S.drawerTitle}>Sort & Filter</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {totalActive > 0 && (
                <button style={S.resetBtn} onClick={() => { onClearFilters(); setSortIdx(0) }}>
                  Reset all
                </button>
              )}
              <button style={S.drawerClose} onClick={() => setShowFilters(false)}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.6" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          </div>

          {/* Sort */}
          <div style={S.drawerSection}>
            <div style={S.drawerLabel}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2.3" strokeLinecap="round" style={{ marginRight: 5 }}>
                <line x1="4" y1="6" x2="20" y2="6"/>
                <line x1="4" y1="12" x2="14" y2="12"/>
                <line x1="4" y1="18" x2="8"  y2="18"/>
              </svg>
              Sort by
            </div>
            <div style={S.chipRow}>
              {SORT_OPTIONS.map((opt, i) => (
                <button key={opt}
                  style={{ ...S.chip, ...(sortIdx === i ? S.chipOn : {}) }}
                  onClick={() => setSortIdx(i)}
                >
                  {SORT_ICON[i]}{opt}
                </button>
              ))}
            </div>
          </div>

          {/* City */}
          <div style={S.drawerSection}>
            <div style={S.drawerLabel}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="#1a7a4a" style={{ marginRight: 5 }}>
                <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
              </svg>
              City
            </div>
            <div style={S.chipRow}>
              {CITIES.map(c => (
                <button key={c} style={{ ...S.chip, ...(city === c ? S.chipOn : {}) }} onClick={() => setCity(c)}>{c}</button>
              ))}
            </div>
          </div>

          {/* Price */}
          <div style={S.drawerSection}>
            <div style={S.drawerLabel}>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#1a7a4a" strokeWidth="2.2" strokeLinecap="round" style={{ marginRight: 5 }}>
                <line x1="12" y1="1" x2="12" y2="23"/>
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
              </svg>
              Price range
            </div>
            <div style={S.chipRow}>
              {PRICE_RANGES.map((r, i) => (
                <button key={r.label} style={{ ...S.chip, ...(priceIdx === i ? S.chipOn : {}) }} onClick={() => setPriceIdx(i)}>{r.label}</button>
              ))}
            </div>
          </div>

          {/* Apply */}
          <button style={S.applyBtn} onClick={() => setShowFilters(false)}>
            Show results
            {totalActive > 0 && (
              <span style={S.applyBadge}>{totalActive} active</span>
            )}
          </button>
        </div>
      )}
    </div>
  )
}

// ── Sort icons ────────────────────────────────────────────
const SORT_ICON = [
  <svg key="r" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ marginRight: 5, flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  <svg key="u" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ marginRight: 5, flexShrink: 0 }}><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>,
  <svg key="d" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" style={{ marginRight: 5, flexShrink: 0 }}><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>,
]

const S = {
  // ── header shell ─────────────────────────────────────────
  header:      { background: '#fff', borderBottom: '1px solid #e8ede9', position: 'sticky', top: 0, zIndex: 50, boxShadow: '0 2px 10px rgba(0,0,0,0.05)' },
  headerInner: { padding: '0 12px', maxWidth: 1400, margin: '0 auto' },

  // ── single top row: logo · search · actions ───────────────
  topRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 0',
  },
  logoWrap: {
    flexShrink: 0,
  },
  brand: {
    fontFamily: "'Sora',system-ui,sans-serif",
    fontSize: 'clamp(18px, 2.5vw, 24px)',
    fontWeight: 800,
    color: '#1a7a4a',
    letterSpacing: '-0.5px',
    lineHeight: 1,
    whiteSpace: 'nowrap',
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  iconBtn: {
    width: 34, height: 34, borderRadius: '50%',
    background: '#f4f8f5', border: 'none', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#1a7a4a',
  },
  bellBadge: {
    position: 'absolute', top: 1, right: 1,
    background: '#ef4444', color: '#fff', borderRadius: '50%',
    width: 15, height: 15, fontSize: 8, fontWeight: 800,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  profileBtn: {
    width: 34, height: 34, borderRadius: '50%',
    background: '#1a7a4a', border: '2px solid #1a7a4a',
    cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: '#fff', overflow: 'hidden', padding: 0,
  },
  avatarImg: { width: '100%', height: '100%', objectFit: 'cover' },

  // ── search bar (inline in top row) ──────────────────────
  searchBox: {
    flex: 1,
    display: 'flex', alignItems: 'center', gap: 5,
    background: '#f4f8f5', borderRadius: 50,
    padding: '8px 10px 8px 11px',
    border: '1.5px solid #e2ebe4',
    transition: 'border-color 0.2s,box-shadow 0.2s',
    minWidth: 0,
  },
  searchIconBtn:   { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0, flexShrink: 0 },
  searchInputWrap: { flex: 1, position: 'relative', height: 20 },
  searchInput:     { position: 'absolute', inset: 0, width: '100%', border: 'none', background: 'transparent', fontSize: 13.5, color: '#111', fontFamily: "'DM Sans',system-ui,sans-serif", zIndex: 1 },
 animPlaceholder: {
  position: 'absolute', inset: 0,
  display: 'flex', alignItems: 'center',
  fontSize: 13.5, pointerEvents: 'auto',
  cursor: 'text', whiteSpace: 'nowrap', overflow: 'hidden',
},
animPrefix: { color: '#bbb', fontWeight: 400, flexShrink: 0 },
animSlotOuter: {
  overflow: 'hidden',
  height: 20,
  display: 'flex',
  alignItems: 'center',
  marginLeft: 3,
  position: 'relative',
},
animSlotWord: {
  display: 'inline-block',
  color: '#333',
  fontWeight: 600,
  letterSpacing: '-0.1px',
animation: 'wordSlideUp 3.5s cubic-bezier(0.16,1,0.3,1) forwards',},
// keep these so nothing else breaks
animKeyword: { color: '#333', fontWeight: 600, letterSpacing: '-0.1px' },
animCursor:  { display: 'none' },clearBtn:        { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', color: '#999', padding: '2px 4px', flexShrink: 0 },
  searchDivider:   { width: 1, height: 16, background: '#d4dfd6', flexShrink: 0, margin: '0 2px' },
  camInsideBtn:    { background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '2px 4px', flexShrink: 0 },

  // ── image search banner ──────────────────────────────────
  imgBanner:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: '#f0f8f4', borderTop: '1px solid #d4ead9', padding: '8px 14px', animation: 'imgBannerIn 0.22s ease' },
  imgBannerLeft:  { display: 'flex', alignItems: 'center', gap: 10 },
  imgThumb:       { width: 40, height: 40, borderRadius: 8, objectFit: 'cover', border: '2px solid #c5e0ce' },
  imgBannerText:  { display: 'flex', flexDirection: 'column', gap: 2 },
  imgBannerTitle: { fontSize: 13, fontWeight: 600, color: '#1a3d2b' },
  imgBannerSub:   { fontSize: 11, color: '#5a8a6f' },
  imgBannerClose: { background: 'none', border: 'none', cursor: 'pointer', color: '#888', padding: 4, display: 'flex', alignItems: 'center' },

  // ══ CATEGORY ROW ════════════════════════════════════════
  catRow: {
    display: 'flex',
    alignItems: 'center',
    borderTop: '1px solid #f0f5f1',
    padding: '9px 0',
    background: '#fff',
  },
  catScroll: {
    flex: 1,
    display: 'flex',
    gap: 7,
    overflowX: 'auto',
    padding: '0 8px 0 14px',
    scrollSnapType: 'x mandatory',
    msOverflowStyle: 'none',
    scrollbarWidth: 'none',
  },
  // plain text pill — matches the screenshot exactly
  pill: {
    flexShrink: 0,
    padding: '6px 14px',
    borderRadius: 50,
    border: '1.5px solid #e0e8e2',
    background: '#fff',
    fontSize: 12.5,
    fontWeight: 600,
    color: '#555',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    scrollSnapAlign: 'start',
    lineHeight: 1,
    transition: 'all 0.14s',
    fontFamily: "'DM Sans',system-ui,sans-serif",
  },
  pillActive: {
    background: '#1a7a4a',
    borderColor: '#1a7a4a',
    color: '#fff',
    fontWeight: 700,
  },
  // thin vertical separator between pills and filter icon
  catDivider: {
    width: 1,
    height: 20,
    background: '#e0e8e2',
    flexShrink: 0,
    margin: '0 4px',
  },
  // filter icon button — right of the row
  filterBtn: {
    flexShrink: 0,
    width: 34,
    height: 34,
    borderRadius: '50%',
    border: '1.5px solid #e0e8e2',
    background: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    marginRight: 14,
    transition: 'all 0.15s',
  },
  filterBtnActive: {
    background: '#1a7a4a',
    borderColor: '#1a7a4a',
    boxShadow: '0 2px 8px rgba(26,122,74,0.3)',
  },
  filterBadgeNum: {
    fontSize: 12,
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1,
  },

  // ══ FILTER DRAWER ═══════════════════════════════════════
  drawer: {
    background: '#fff',
    borderTop: '2px solid #f0f5f1',
    padding: '6px 14px 18px',
    animation: 'slideDown 0.2s cubic-bezier(0.34,1.1,0.64,1)',
    boxShadow: '0 6px 20px rgba(0,0,0,0.07)',
  },
  drawerHandle: {
    width: 36, height: 4, borderRadius: 4,
    background: '#e0e8e2',
    margin: '4px auto 14px',
  },
  drawerHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 16,
  },
  drawerTitle:  { fontSize: 15, fontWeight: 800, color: '#111', letterSpacing: '-0.3px' },
  resetBtn: {
    background: 'none', border: '1.5px solid #fca5a5',
    borderRadius: 20, padding: '4px 12px',
    fontSize: 11.5, fontWeight: 700, color: '#dc2626', cursor: 'pointer',
  },
  drawerClose: {
    width: 30, height: 30, borderRadius: '50%',
    border: '1.5px solid #e4ece6', background: '#f6f9f7',
    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
  },
  drawerSection: { marginBottom: 16 },
  drawerLabel: {
    display: 'flex', alignItems: 'center',
    fontSize: 10.5, fontWeight: 800, color: '#aaa',
    textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: 9,
  },
  chipRow: { display: 'flex', gap: 7, flexWrap: 'wrap' },
  chip: {
    display: 'inline-flex', alignItems: 'center',
    padding: '7px 14px', borderRadius: 10,
    border: '1.5px solid #e8ede9', background: '#f6f9f7',
    fontSize: 12, fontWeight: 600, color: '#555',
    cursor: 'pointer', transition: 'all 0.13s', lineHeight: 1, whiteSpace: 'nowrap',
  },
  chipOn: {
    background: '#e6f4ec', borderColor: '#1a7a4a', color: '#1a7a4a',
    fontWeight: 700, boxShadow: '0 2px 8px rgba(26,122,74,0.14)',
  },
  applyBtn: {
    width: '100%',
    background: 'linear-gradient(135deg,#1a7a4a,#25a066)',
    border: 'none', borderRadius: 14,
    padding: '13px 0', fontSize: 14, fontWeight: 800, color: '#fff',
    cursor: 'pointer', marginTop: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    boxShadow: '0 4px 14px rgba(26,122,74,0.28)', letterSpacing: '-0.2px',
  },
  applyBadge: {
    background: 'rgba(255,255,255,0.25)', borderRadius: 20,
    padding: '2px 9px', fontSize: 11, fontWeight: 700,
  },
  
}