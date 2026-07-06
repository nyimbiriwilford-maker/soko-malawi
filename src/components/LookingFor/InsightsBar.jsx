import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { T } from '../../constants/tokens'
import { supabase } from '../../lib/supabase'

/* ── Particle mesh canvas ─────────────────────────────────── */
function ParticleMesh({ accent }) {
  const canvasRef = useRef(null)
  const animRef   = useRef(null)
  const particles = useRef([])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    function resize() {
      canvas.width  = canvas.offsetWidth
      canvas.height = canvas.offsetHeight
      particles.current = Array.from({ length: 22 }, () => ({
        x:  Math.random() * canvas.width,
        y:  Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        r:  Math.random() * 1.5 + 0.8,
      }))
    }

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      const pts = particles.current
      pts.forEach(p => {
        p.x += p.vx; p.y += p.vy
        if (p.x < 0 || p.x > canvas.width)  p.vx *= -1
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1
      })
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const dx = pts[i].x - pts[j].x, dy = pts[i].y - pts[j].y
          const dist = Math.sqrt(dx*dx + dy*dy)
          if (dist < 100) {
            ctx.beginPath()
            ctx.moveTo(pts[i].x, pts[i].y)
            ctx.lineTo(pts[j].x, pts[j].y)
            const alpha = Math.round((1 - dist/100) * 0.18 * 255).toString(16).padStart(2,'0')
            ctx.strokeStyle = `${accent}${alpha})`
            ctx.lineWidth = 0.7
            ctx.stroke()
          }
        }
      }
      pts.forEach(p => {
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2)
        ctx.fillStyle = `${accent}55)`
        ctx.fill()
      })
      animRef.current = requestAnimationFrame(draw)
    }

    resize()
    draw()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    return () => { cancelAnimationFrame(animRef.current); ro.disconnect() }
  }, [accent])

  return (
    <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 0 }} />
  )
}

/* ── Progress bar ─────────────────────────────────────────── */
function ProgressBar({ accent, duration, running, key: k }) {
  const [w, setW]    = useState(0)
  const startRef     = useRef(null)
  const animRef      = useRef(null)

  useEffect(() => {
    setW(0)
    cancelAnimationFrame(animRef.current)
    if (!running) return
    startRef.current = performance.now()
    const tick = now => {
      const pct = Math.min(((now - startRef.current) / duration) * 100, 100)
      setW(pct)
      if (pct < 100) animRef.current = requestAnimationFrame(tick)
    }
    animRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(animRef.current)
  }, [running, duration, k])

  return (
    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: 'rgba(255,255,255,0.06)', zIndex: 3 }}>
      <div style={{ height: '100%', width: `${w}%`, background: `${accent}bb)`, borderRadius: '0 1px 1px 0' }} />
    </div>
  )
}

/* ── Stat chip ────────────────────────────────────────────── */
function Chip({ label, accent }) {
  return (
    <span style={{ fontSize: 11, fontWeight: 600, color: `${accent}dd)`, background: `${accent}14)`, border: `1px solid ${accent}22)`, borderRadius: 20, padding: '3px 10px', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  )
}

/* ── Ads ──────────────────────────────────────────────────── */
function buildAds(stats) {
  const buyers   = stats?.activeBuyers ?? '…'
  const budget   = stats?.totalBudget  ?? '…'
  const newToday = stats?.newToday     ?? '…'

  return [
    {
      tip:      '💡 SokoMw tip',
      tipColor: '#fb923c',
      headline: `${buyers} buyers searching right now`,
      sub:      `${budget} in combined budget waiting for sellers like you. Post a listing in 60 seconds.`,
      chips:    [`${buyers} active`, `${budget} budget`, `${newToday} new today`],
      cta:      'Post a Listing',
      route:    '/post-listing',
      gradient: 'linear-gradient(120deg, #071a0e 0%, #0d2718 55%, #081520 100%)',
      accent:   'rgba(74,222,128,',
      btnColor: '#4ade80',
    },
    {
      tip:      '⚡ Grow faster',
      tipColor: '#facc15',
      headline: 'Featured listings get 10× more views',
      sub:      'Boost your listing to the top of search results and the homepage for just MK 500.',
      chips:    ['Top placement', 'Homepage banner', 'MK 500 only'],
      cta:      'Boost My Listing',
      route:    '/post-listing',
      gradient: 'linear-gradient(120deg, #110d00 0%, #211700 55%, #0d0900 100%)',
      accent:   'rgba(250,204,21,',
      btnColor: '#facc15',
    },
    {
      tip:      '🔔 Stay ahead',
      tipColor: '#60a5fa',
      headline: `${newToday} new requests posted today`,
      sub:      'Set up Wanted Alerts and be the first seller to respond when buyers post in your category.',
      chips:    [`${newToday} today`, 'Instant notify', 'Free forever'],
      cta:      'Set Up Alerts',
      route:    '/looking-for',
      gradient: 'linear-gradient(120deg, #04061a 0%, #0a1038 55%, #040818 100%)',
      accent:   'rgba(96,165,250,',
      btnColor: '#60a5fa',
    },
  ]
}

/* ── Banner ───────────────────────────────────────────────── */
export function InsightsBar() { return null }

export function SellerOpportunityBanner({ onPost }) {
  const navigate              = useNavigate()
  const [stats,   setStats]   = useState(null)
  const [idx,     setIdx]     = useState(0)
  const [visible, setVis]     = useState(true)
  const [paused,  setPause]   = useState(false)
  const [gone,    setGone]    = useState(false)
  const touchX                = useRef(null)
  const DURATION              = 7000

  useEffect(() => {
    supabase.from('buyer_requests').select('budget,created_at').neq('status','fulfilled').then(({ data }) => {
      if (!data) return
      const today = new Date(); today.setHours(0,0,0,0)
      const total = data.reduce((s,r) => s+(r.budget||0), 0)
      const fmt   = n => n >= 1_000_000 ? `MK ${(n/1_000_000).toFixed(1)}M` : n >= 1_000 ? `MK ${(n/1_000).toFixed(0)}K` : `MK ${n}`
      setStats({ activeBuyers: data.length, totalBudget: fmt(total), newToday: data.filter(r => new Date(r.created_at) >= today).length })
    })
  }, [])

  const ADS = buildAds(stats)
  const ad  = ADS[idx]

  function go(next) {
    setVis(false)
    setTimeout(() => { setIdx(next); setVis(true) }, 280)
  }

  useEffect(() => {
    if (paused || gone) return
    const t = setTimeout(() => go((idx+1) % ADS.length), DURATION)
    return () => clearTimeout(t)
  }, [idx, paused, gone])

  function handleCTA(e) {
    e.stopPropagation()
    if (ad.route === '/post-listing' && onPost) onPost()
    else navigate(ad.route)
  }

  if (gone) return null

  return (
    <div
      onMouseEnter={() => setPause(true)}
      onMouseLeave={() => setPause(false)}
      onTouchStart={e => { touchX.current = e.touches[0].clientX }}
      onTouchEnd={e => {
        const dx = e.changedTouches[0].clientX - touchX.current
        if (Math.abs(dx) > 40) go(dx < 0 ? (idx+1)%ADS.length : (idx-1+ADS.length)%ADS.length)
        touchX.current = null
      }}
      style={{
        borderRadius: 16,
        marginBottom: 16,
        marginTop: 10,
        position: 'relative',
        overflow: 'hidden',
        background: ad.gradient,
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow: `0 4px 24px ${ad.accent}1a), 0 1px 4px rgba(0,0,0,0.4)`,
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(5px)',
        transition: 'opacity 0.28s ease, transform 0.28s ease',
        userSelect: 'none',
      }}
    >
      <ParticleMesh accent={ad.accent} />

      {/* Dismiss — subtle ghost */}
      <button
        onClick={e => { e.stopPropagation(); setGone(true) }}
        title="Dismiss"
        style={{ position: 'absolute', top: 10, right: 10, zIndex: 4, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '50%', width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'rgba(255,255,255,0.3)', fontSize: 11, lineHeight: 1, transition: 'all 0.15s' }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.7)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'rgba(255,255,255,0.3)' }}
      >
        ✕
      </button>

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 2, padding: '18px 20px 16px' }}>

        {/* Tip pill */}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 20, padding: '3px 10px', marginBottom: 8 }}>
          <span style={{ fontSize: 10.5, fontWeight: 700, color: ad.tipColor, letterSpacing: 0.3 }}>{ad.tip}</span>
        </div>

        {/* Headline */}
        <div style={{ fontFamily: T.fontDisplay, fontSize: 17, fontWeight: 800, color: '#fff', lineHeight: 1.3, marginBottom: 5, maxWidth: 460 }}>
          {ad.headline}
        </div>

        {/* Sub */}
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.42)', marginBottom: 12, maxWidth: 400, lineHeight: 1.5 }}>
          {ad.sub}
        </div>

        {/* Stat chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
          {ad.chips.map(c => <Chip key={c} label={c} accent={ad.accent} />)}
        </div>

        {/* CTA row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={handleCTA}
            style={{ background: ad.btnColor, color: '#000', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', transition: 'opacity 0.15s, transform 0.12s', whiteSpace: 'nowrap' }}
            onMouseEnter={e => { e.currentTarget.style.opacity='0.87'; e.currentTarget.style.transform='scale(1.03)' }}
            onMouseLeave={e => { e.currentTarget.style.opacity='1';    e.currentTarget.style.transform='scale(1)' }}
          >
            {ad.cta} →
          </button>

          {/* Dots + counter */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
              {ADS.map((_, i) => (
                <div
                  key={i}
                  onClick={e => { e.stopPropagation(); go(i) }}
                  style={{ width: i===idx ? 18 : 5, height: 5, borderRadius: 3, background: i===idx ? ad.btnColor : 'rgba(255,255,255,0.15)', transition: 'all 0.32s cubic-bezier(0.34,1.2,0.64,1)', cursor: 'pointer' }}
                />
              ))}
            </div>
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', fontWeight: 600 }}>{idx+1}/{ADS.length}</span>
          </div>
        </div>
      </div>

      <ProgressBar accent={ad.accent} duration={DURATION} running={!paused && visible} key={idx} />
    </div>
  )
}