import React, { useState, useMemo, useEffect, useRef } from 'react'
import { isListingFeatured } from '../utils/homeUtils'

const T = {
  green:  '#0F9D58',
  greenD: '#0a7a44',
  greenL: '#e8f5ee',
  amber:  '#F9AB00',
  blue:   '#1A73E8',
  red:    '#ea4335',
  fontDisplay: "'Sora', 'Inter', system-ui, sans-serif",
}

const CAT_EMOJI = {
  Electronics: '📱', Vehicles: '🚗', Property: '🏠', Fashion: '👗',
  Jobs: '💼', Services: '🛠️', Agriculture: '🌽', Furniture: '🪑',
}

const CAT_COLORS = {
  Electronics: { bg: '#f97316', text: '#fff', label: 'ELECTRONICS' },
  Vehicles:    { bg: '#8b5cf6', text: '#fff', label: 'VEHICLES' },
  Property:    { bg: '#6366f1', text: '#fff', label: 'PROPERTY' },
  Fashion:     { bg: '#ec4899', text: '#fff', label: 'FASHION' },
  Agriculture: { bg: '#0d9488', text: '#fff', label: 'AGRICULTURE' },
  Furniture:   { bg: '#f59e0b', text: '#1a0a00', label: 'HOME' },
  Jobs:        { bg: '#22d3ee', text: '#0f172a', label: 'JOBS' },
  Services:    { bg: '#10b981', text: '#fff', label: 'SERVICES' },
}

function getCatColor(cat) {
  return CAT_COLORS[cat] || { bg: '#64748b', text: '#fff', label: (cat || 'SOKO').toUpperCase() }
}

function timeAgo(ts) {
  if (!ts) return ''
  const d = Date.now() - new Date(ts)
  const h = Math.floor(d / 3600000)
  const m = Math.floor(d / 60000)
  if (h >= 24) return `${Math.floor(h/24)}d ago`
  if (h >= 1)  return `${h}h ago`
  if (m < 1)   return 'just now'
  return `${m}m ago`
}

function formatPrice(n) {
  if (n == null || n === '') return ''
  const num = Number(n)
  if (!Number.isFinite(num)) return ''
  // Full price always (mobile + desktop) — no K/M shorthand
  return `MK ${Math.round(num).toLocaleString('en-US')}`
}

function isFlashActive(l) {
  if (!l?.flash_sale_price || !l?.flash_sale_expires_at) return false
  return new Date(l.flash_sale_expires_at) > new Date()
}

const Icon = {
  eye:    (s=13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  pin:    (s=13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>,
  clock:  (s=13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  chevR:  (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
  heart:  (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  verify: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24"><circle cx="12" cy="12" r="12" fill={T.blue} opacity="0.15"/><path d="M9 12l2 2 4-4" stroke={T.blue} strokeWidth="2" fill="none" strokeLinecap="round"/></svg>,
}

function HeroBtn({ label, icon, bg, color, border, shadow, onClick }) {
  const [hov, setHov] = useState(false)
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: bg, color, border: border || 'none',
        borderRadius: 14, padding: '12px 24px',
        fontSize: 14, fontWeight: 800, cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', gap: 7,
        whiteSpace: 'nowrap',
        boxShadow: shadow && hov ? `0 6px 22px ${shadow}` : shadow ? `0 3px 14px ${shadow}` : 'none',
        transform: hov ? 'translateY(-2px)' : 'none',
        transition: 'all 0.18s cubic-bezier(0.34,1.2,0.64,1)',
        backdropFilter: !shadow ? 'blur(8px)' : 'none',
      }}
    >
      {icon}{label}
    </button>
  )
}

export default function HeroSection({ listings, navigate, user }) {

  // ── Animated counters ──────────────────────────────────
  const [count, setCount] = useState({ listings: 0, sellers: 0, districts: 0, response: 0 })
  const stats = useMemo(() => ({
    listings:  listings.length || 1240,
    sellers:   Math.max(Math.floor(listings.length * 0.65), 820),
    districts: 28,
    response:  2,
  }), [listings.length])

  useEffect(() => {
    let step = 0
    const steps = 55
    const timer = setInterval(() => {
      step++
      const ease = 1 - Math.pow(1 - Math.min(step / steps, 1), 3)
      setCount({
        listings:  Math.round(stats.listings * ease),
        sellers:   Math.round(stats.sellers * ease),
        districts: Math.round(stats.districts * ease),
        response:  Math.round(stats.response * ease),
      })
      if (step >= steps) clearInterval(timer)
    }, 1800 / steps)
    return () => clearInterval(timer)
  }, [stats.listings, stats.sellers])

  // ── Featured listings for carousel ─────────────────────
  const featured = useMemo(() =>
    listings.filter(l => isListingFeatured(l) && l.images?.[0]).slice(0, 8),
  [listings])

  // ── Carousel state ─────────────────────────────────────
  const [slide,  setSlide]  = useState(0)
  const [paused, setPaused] = useState(false)
  const timerRef = useRef(null)
  const total = featured.length

  function goTo(idx) { setSlide(((idx % total) + total) % total) }
  function next() { setSlide(s => (s + 1) % total) }
  function prev() { setSlide(s => ((s - 1) + total) % total) }

  useEffect(() => {
    if (paused || total < 2) return
    timerRef.current = setInterval(() => {
      setSlide(s => (s + 1) % total)
    }, 4000)
    return () => clearInterval(timerRef.current)
  }, [paused, total])

  // ── Activity ticker ────────────────────────────────────
  const tickerItems = useMemo(() => {
    const real = listings.filter(l => l.images?.[0]).slice(0, 6).map(l => ({
      text: `${l.title} listed in ${l.city || 'Malawi'}`,
      price: formatPrice(isFlashActive(l) ? l.flash_sale_price : l.price),
      emoji: CAT_EMOJI[l.category] || '🛍️',
    }))
    if (real.length >= 4) return real
    return [
      { emoji: '🔥', text: 'Toyota Hilux sold in Lilongwe',        price: 'MK 12M'    },
      { emoji: '📱', text: 'Samsung A55 listed in Blantyre',        price: 'MK 320K'   },
      { emoji: '🏠', text: 'Apartment posted in Area 43, Lilongwe', price: 'MK 85K/mo' },
      { emoji: '🚗', text: 'Toyota Vitz posted in Mzuzu',           price: 'MK 4.8M'   },
      { emoji: '💼', text: 'Finance Manager role posted',           price: ''          },
      { emoji: '🌽', text: 'Maize harvest listed in Kasungu',       price: 'MK 45K/bag'},
    ]
  }, [listings])

  const [tickerPos, setTickerPos] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setTickerPos(p => p + 1), 3200)
    return () => clearInterval(t)
  }, [])
  const tickerIdx = tickerPos % tickerItems.length
  const currentListing = featured[slide]

  return (
    <section style={{
      background: `
        radial-gradient(ellipse at 0% 100%, rgba(249,171,0,0.1) 0%, transparent 50%),
        radial-gradient(ellipse at 100% 0%, rgba(15,157,88,0.18) 0%, transparent 55%),
        radial-gradient(ellipse at 50% 50%, rgba(26,115,232,0.06) 0%, transparent 70%),
        linear-gradient(145deg, #071a0e 0%, #0b2415 35%, #071520 65%, #050e07 100%)
      `,
      position: 'relative', overflow: 'hidden',
      padding: 'clamp(16px, 2vw, 28px) 24px clamp(12px, 1.5vw, 20px)',
    }}>

      {/* Dot grid texture */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
        backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)',
        backgroundSize: '32px 32px',
        maskImage: 'linear-gradient(135deg, transparent 0%, black 30%, black 70%, transparent 100%)',
        WebkitMaskImage: 'linear-gradient(135deg, transparent 0%, black 30%, black 70%, transparent 100%)',
      }} />

      {/* Top glow line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1, zIndex: 0,
        background: `linear-gradient(90deg, transparent, ${T.green}66, ${T.blue}44, transparent)`,
      }} />

      <div style={{
        maxWidth: 1400, margin: '0 auto',
        display: 'grid', gridTemplateColumns: '2fr 3fr',
        gap: 'clamp(16px, 2.5vw, 36px)', alignItems: 'center',
        position: 'relative', zIndex: 1,
      }} className="soko-hero-grid">

        {/* ── LEFT: Brand copy ── */}
        <div style={{ animation: 'fadeUp 0.55s ease 0.05s both' }}>

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'rgba(249,171,0,0.15)', border: '1px solid rgba(249,171,0,0.3)',
            borderRadius: 50, padding: '5px 14px', marginBottom: 18,
          }}>
            <span style={{ fontSize: 13 }}>🇲🇼</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: T.amber, letterSpacing: 0.8, textTransform: 'uppercase' }}>
              Malawi's #1 Marketplace
            </span>
          </div>

          <h1 className="soko-hero-headline" style={{
            fontFamily: T.fontDisplay, fontSize: 'clamp(22px, 2.8vw, 36px)',
            fontWeight: 800, color: '#fff', lineHeight: 1.13,
            letterSpacing: '-1px', marginBottom: 10,
          }}>
            Buy, Sell &amp;<br />
            <span style={{
              background: `linear-gradient(90deg, ${T.amber}, #ffce45)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>Discover</span>{' '}Across Malawi
          </h1>

          <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.6, marginBottom: 18, maxWidth: 380 }}>
            Connect with trusted buyers and sellers across all districts.
            Vehicles, property, electronics, jobs, services and more.
          </p>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20 }}>
            <HeroBtn
              label="Start Selling"
              icon={<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>}
              bg={`linear-gradient(135deg, ${T.amber}, #e09800)`}
              color="#1a0a00" shadow="rgba(249,171,0,0.45)"
              onClick={() => navigate('/post')}
            />
            <HeroBtn
              label="Browse Listings"
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>}
              bg="rgba(255,255,255,0.09)" color="#fff"
              border="1.5px solid rgba(255,255,255,0.22)" shadow={null}
              onClick={() => document.getElementById('listings-section')?.scrollIntoView({ behavior: 'smooth' })}
            />
          </div>

          {/* Stat cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 16 }}>
            {[
              { num: count.listings.toLocaleString() + '+', label: 'Active Listings',   color: T.green,   icon: '🛍️' },
              { num: count.sellers.toLocaleString() + '+',  label: 'Verified Sellers',  color: T.blue,    icon: '✅' },
              { num: count.districts,                       label: 'Districts Covered', color: T.amber,   icon: '📍' },
              { num: `<${count.response + 2}min`,           label: 'Avg. Response',     color: '#a78bfa', icon: '⚡' },
            ].map(({ num, label, color, icon }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 12, padding: '8px 12px', backdropFilter: 'blur(8px)',
              }}>
                <div style={{ fontSize: 12, marginBottom: 4 }}>{icon}</div>
                <div style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 800, color, letterSpacing: '-0.5px', lineHeight: 1 }}>{num}</div>
                <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', marginTop: 3, fontWeight: 500 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Trust badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {[
              { label: '✓ Verified Sellers',    color: T.green },
              { label: '🔒 Secure Messaging',   color: T.blue  },
              { label: '⚡ Fast Communication', color: T.amber },
              { label: '📍 Nationwide Reach',   color: '#a78bfa' },
            ].map(({ label, color }) => (
              <div key={label} style={{
                background: 'rgba(255,255,255,0.07)', border: `1px solid ${color}33`,
                borderRadius: 50, padding: '4px 12px',
                fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.75)',
              }}>{label}</div>
            ))}
          </div>
        </div>

        {/* ── RIGHT: Featured carousel ── */}
        <div className="soko-hero-right" style={{ animation: 'fadeUp 0.55s ease 0.18s both' }}>
          {total === 0 ? (
            <div style={{
              background: 'rgba(255,255,255,0.06)', border: '2px dashed rgba(255,255,255,0.15)',
              borderRadius: 24, padding: '48px 32px', textAlign: 'center', backdropFilter: 'blur(12px)',
            }}>
              <div style={{ fontSize: 48, marginBottom: 16 }}>⭐</div>
              <h3 style={{ fontFamily: T.fontDisplay, fontSize: 20, fontWeight: 800, color: '#fff', marginBottom: 10 }}>
                Become a Featured Seller
              </h3>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 1.65, marginBottom: 24, maxWidth: 280, margin: '0 auto 24px' }}>
                Get your products seen by thousands of buyers across Malawi.
              </p>
              <button onClick={() => navigate('/post')} style={{
                background: `linear-gradient(135deg, ${T.amber}, #e09800)`,
                border: 'none', borderRadius: 14, padding: '12px 28px',
                fontSize: 14, fontWeight: 800, color: '#1a0a00', cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(249,171,0,0.35)',
              }}>Feature My Listing</button>
            </div>
          ) : (
            <div onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} style={{ position: 'relative' }}>

              {/* Main card */}
              <div style={{
                borderRadius: 24, overflow: 'hidden',
                background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.14)',
                boxShadow: '0 20px 60px rgba(0,0,0,0.5)', backdropFilter: 'blur(16px)',
                position: 'relative',
              }}>
                {/* Featured badge */}
                <div style={{
                  position: 'absolute', top: 14, left: 14, zIndex: 10,
                  background: `linear-gradient(135deg, ${T.amber}, #e09800)`,
                  borderRadius: 50, padding: '5px 13px',
                  display: 'flex', alignItems: 'center', gap: 5,
                  boxShadow: '0 3px 12px rgba(249,171,0,0.4)',
                }}>
                  <span style={{ fontSize: 11 }}>⭐</span>
                  <span style={{ fontSize: 10.5, fontWeight: 900, color: '#1a0a00', letterSpacing: 0.5 }}>FEATURED</span>
                </div>

                {/* Nav arrows */}
                {total > 1 && <>
                  <button onClick={prev} style={{
                    position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                    zIndex: 10, width: 36, height: 36, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#fff', fontSize: 16,
                  }}>‹</button>
                  <button onClick={next} style={{
                    position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                    zIndex: 10, width: 36, height: 36, borderRadius: '50%',
                    background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)',
                    border: '1px solid rgba(255,255,255,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', color: '#fff', fontSize: 16,
                  }}>›</button>
                </>}

                {/* Product image */}
                <div style={{ width: '100%', aspectRatio: '16/7', position: 'relative', overflow: 'hidden', background: '#0d1a10' }}>
                  {currentListing?.images?.[0] && (
                    <img key={slide} src={currentListing.images[0]} alt={currentListing.title}
                      style={{ width: '100%', height: '100%', objectFit: 'cover', animation: 'fadeIn 0.45s ease both' }} />
                  )}
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.75) 100%)' }} />
                  {currentListing?.category && (
                    <div style={{
                      position: 'absolute', bottom: 12, left: 14,
                      background: getCatColor(currentListing.category).bg,
                      color: getCatColor(currentListing.category).text,
                      borderRadius: 50, padding: '3px 10px',
                      fontSize: 10, fontWeight: 900, letterSpacing: 0.5, textTransform: 'uppercase',
                    }}>{getCatColor(currentListing.category).label}</div>
                  )}
                  {currentListing?.view_count > 0 && (
                    <div style={{
                      position: 'absolute', bottom: 12, right: 14,
                      display: 'flex', alignItems: 'center', gap: 4,
                      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)',
                      borderRadius: 50, padding: '3px 10px',
                      fontSize: 11, fontWeight: 700, color: '#fff',
                    }}>{Icon.eye(11)} {currentListing.view_count.toLocaleString()}</div>
                  )}
                </div>

                {/* Listing info */}
                <div style={{ padding: '12px 16px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 900, color: T.amber, letterSpacing: '-0.8px', lineHeight: 1, marginBottom: 4 }}>
                        {formatPrice(isFlashActive(currentListing) ? currentListing?.flash_sale_price : currentListing?.price)}
                        {currentListing?.price_type === 'negotiable' && (
                          <span style={{ fontSize: 10, fontWeight: 700, color: T.green, background: T.greenL, borderRadius: 50, padding: '2px 8px', marginLeft: 8, verticalAlign: 'middle' }}>Nego</span>
                        )}
                      </div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {currentListing?.title}
                      </div>
                    </div>
                    <div style={{
                      width: 36, height: 36, borderRadius: '50%',
                      background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0, cursor: 'pointer',
                    }}>{Icon.heart(15)}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12, color: 'rgba(255,255,255,0.55)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ color: T.green }}>{Icon.pin(11)}</span>
                      <span style={{ fontWeight: 500 }}>{currentListing?.city || 'Malawi'}</span>
                      <span style={{ margin: '0 4px', opacity: 0.4 }}>·</span>
                      {Icon.clock(11)}
                      <span>{timeAgo(currentListing?.created_at)}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: T.blue, fontWeight: 700, fontSize: 11 }}>
                      {Icon.verify(12)} Verified Seller
                    </div>
                  </div>

                  <button onClick={() => navigate('/listing/' + currentListing?.id)} style={{
                    width: '100%', marginTop: 14,
                    background: `linear-gradient(135deg, ${T.green}, #0a7a44)`,
                    border: 'none', borderRadius: 10, padding: '9px 0',
                    fontSize: 13, fontWeight: 800, color: '#fff', cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(15,157,88,0.4)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                  }}>
                    View Listing {Icon.chevR(14)}
                  </button>
                </div>

                {/* Progress dots */}
                {total > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '0 18px 16px' }}>
                    {featured.map((_, i) => (
                      <button key={i} onClick={() => goTo(i)} style={{
                        width: i === slide ? 22 : 7, height: 7, borderRadius: 50,
                        background: i === slide ? T.amber : 'rgba(255,255,255,0.25)',
                        border: 'none', cursor: 'pointer', padding: 0,
                        transition: 'all 0.3s cubic-bezier(0.34,1.2,0.64,1)',
                      }} />
                    ))}
                  </div>
                )}
              </div>

              {/* Live activity ticker */}
              <div style={{
                marginTop: 12, background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderRadius: 12, padding: '10px 16px',
                display: 'flex', alignItems: 'center', gap: 10,
                backdropFilter: 'blur(8px)',
              }}>
                <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, fontWeight: 800, color: T.red, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.red, animation: 'pulse 1.5s infinite' }} />
                  Live
                </div>
                <div style={{ flex: 1, overflow: 'hidden', fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,0.7)' }}>
                  <span key={tickerIdx} style={{ animation: 'fadeUp 0.4s ease both' }}>
                    {tickerItems[tickerIdx].emoji}&nbsp;{tickerItems[tickerIdx].text}
                    {tickerItems[tickerIdx].price && (
                      <span style={{ color: T.amber, fontWeight: 700 }}>&nbsp;— {tickerItems[tickerIdx].price}</span>
                    )}
                  </span>
                </div>
              </div>

              {/* Thumbnail strip */}
              {total > 1 && (
                <div className="soko-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 10, padding: '2px 0' }}>
                  {featured.map((item, i) => (
                    <div key={item.id} onClick={() => goTo(i)} style={{
                      flexShrink: 0, width: 64, height: 48, borderRadius: 10,
                      overflow: 'hidden', cursor: 'pointer',
                      border: i === slide ? `2px solid ${T.amber}` : '2px solid rgba(255,255,255,0.12)',
                      opacity: i === slide ? 1 : 0.55, transition: 'all 0.2s',
                    }}>
                      <img src={item.images[0]} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </section>
  )
}