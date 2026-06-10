import { useMemo, useRef } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { CAT_META } from '../constants/homeConstants'
import { isFlashActive } from '../utils/homeUtils'

// Representative emoji per category (decorative glyph fallback only)
const CAT_GLYPH = {
  Electronics: '📱', Vehicles: '🚗', Furniture: '🛋️',
  Clothing: '👗', Property: '🏠', Agriculture: '🌾',
  Food: '🍎', Services: '🔧', Other: '📦',
}

// Deliberate asymmetric tile sizing (Facebook-Marketplace-style mosaic)
const TILE_SPANS = [
  'cm-tile-xl',   // 0 — big hero tile (2x2)
  'cm-tile-wide', // 1 — wide (2x1)
  'cm-tile-sm',   // 2
  'cm-tile-sm',   // 3
  'cm-tile-wide', // 4 — wide (2x1)
  'cm-tile-sm',   // 5
  'cm-tile-sm',   // 6
]

// ───────────────────────────────────────────────
// Category Mosaic — asymmetric, photo-backed tiles
// ───────────────────────────────────────────────
export function CategoryMosaic({ listings, setCategory }) {
  const cats = useMemo(() => {
    const map = {}
    for (const l of listings) {
      if (!l.category) continue
      if (!map[l.category]) map[l.category] = { key: l.category, count: 0, img: null }
      map[l.category].count++
      if (!map[l.category].img && l.images?.[0]) map[l.category].img = l.images[0]
    }
    return Object.values(map).sort((a, b) => b.count - a.count).slice(0, 7)
  }, [listings])

  if (cats.length < 3) return null

  return (
    <section className="cm-section" aria-label="Browse by category">
      <div className="cm-head">
        <div>
          <span className="cm-eyebrow">Explore the market</span>
          <h2 className="cm-title">Browse by category</h2>
        </div>
        <span className="cm-head-meta">{listings.length}+ live listings</span>
      </div>

      <div className="cm-grid">
        {cats.map((c, i) => {
          const meta = CAT_META[c.key] || { color: '#1a7a4a' }
          return (
            <motion.button
              key={c.key}
              className={`cm-tile ${TILE_SPANS[i] || 'cm-tile-sm'}`}
              onClick={() => setCategory(c.key)}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ duration: 0.45, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              whileHover={{ y: -4 }}
              style={{ '--cm-color': meta.color }}
            >
              {c.img ? (
                <img src={c.img || "/placeholder.svg"} alt="" className="cm-tile-img" loading="lazy" />
              ) : (
                <div className="cm-tile-fallback" style={{ background: `linear-gradient(135deg, ${meta.color}, ${meta.color}cc)` }}>
                  <span>{CAT_GLYPH[c.key] || '📦'}</span>
                </div>
              )}
              <div className="cm-tile-veil" />
              <div className="cm-tile-body">
                <span className="cm-tile-name">{c.key}</span>
                <span className="cm-tile-count">{c.count} item{c.count !== 1 ? 's' : ''}</span>
              </div>
              <span className="cm-tile-arrow" aria-hidden="true">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
                </svg>
              </span>
            </motion.button>
          )
        })}
      </div>
    </section>
  )
}

// ───────────────────────────────────────────────
// Trust band — Stripe-style metric strip with floating accents
// ───────────────────────────────────────────────
export function TrustBand({ listings }) {
  const stats = useMemo(() => {
    const sellers = new Set(listings.map(l => l.seller_id).filter(Boolean)).size
    const cities = new Set(listings.map(l => l.city).filter(Boolean)).size
    const flash = listings.filter(l => isFlashActive(l)).length
    return [
      { num: `${listings.length || 0}+`, lbl: 'Live listings' },
      { num: `${sellers || 0}+`, lbl: 'Active sellers' },
      { num: `${cities || 0}`, lbl: 'Cities covered' },
      { num: flash > 0 ? `${flash}` : 'Daily', lbl: flash > 0 ? 'Flash deals live' : 'Fresh deals' },
    ]
  }, [listings])

  return (
    <section className="ts-band" aria-label="Marketplace at a glance">
      <span className="ts-float ts-float-1" />
      <span className="ts-float ts-float-2" />
      <div className="ts-grid">
        {stats.map((s, i) => (
          <motion.div
            key={s.lbl}
            className="ts-cell"
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-30px' }}
            transition={{ duration: 0.5, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="ts-num">{s.num}</div>
            <div className="ts-lbl">{s.lbl}</div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}

// ───────────────────────────────────────────────
// Spotlight — editorial asymmetric split
// (big feature on the left, ranked list on the right)
// ───────────────────────────────────────────────
export function SpotlightSection({ listings, navigate }) {
  const ref = useRef(null)
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],
  })
  const imgY = useTransform(scrollYProgress, [0, 1], ['-6%', '6%'])

  const picks = useMemo(() => {
    return [...listings]
      .filter(l => l.images?.[0])
      .sort((a, b) => {
        if (isFlashActive(b) !== isFlashActive(a)) return isFlashActive(b) ? 1 : -1
        return new Date(b.created_at) - new Date(a.created_at)
      })
      .slice(0, 4)
  }, [listings])

  if (picks.length < 4) return null

  const [hero, ...rows] = picks
  const heroPrice = isFlashActive(hero) ? hero.flash_sale_price : hero.price

  return (
    <section className="sp-section" ref={ref} aria-label="Trending now">
      <div className="sp-head">
        <div className="sp-head-line" />
        <span className="sp-eyebrow">Trending now</span>
        <h2 className="sp-title">Fresh picks moving fast</h2>
      </div>

      <div className="sp-layout">
        {/* Big editorial feature */}
        <motion.button
          className="sp-hero"
          onClick={() => navigate('/listing/' + hero.id)}
          initial={{ opacity: 0, scale: 0.97 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.img
            src={hero.images[0] || "/placeholder.svg"}
            alt={hero.title}
            className="sp-hero-img"
            style={{ y: imgY }}
            loading="lazy"
          />
          <div className="sp-hero-veil" />
          {isFlashActive(hero) && <span className="sp-flash">⚡ Flash sale</span>}
          <div className="sp-hero-body">
            <span className="sp-hero-cat">{hero.category}</span>
            <h3 className="sp-hero-title">{hero.title}</h3>
            <div className="sp-hero-foot">
              <span className="sp-hero-price">MWK {Number(heroPrice || 0).toLocaleString()}</span>
              {hero.city && <span className="sp-hero-city">{hero.city}</span>}
            </div>
          </div>
        </motion.button>

        {/* Ranked list rows (Jiji / Airbnb list style) */}
        <div className="sp-list">
          {rows.map((item, i) => {
            const price = isFlashActive(item) ? item.flash_sale_price : item.price
            return (
              <motion.button
                key={item.id}
                className="sp-row"
                onClick={() => navigate('/listing/' + item.id)}
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: '-40px' }}
                transition={{ duration: 0.45, delay: 0.1 + i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                whileHover={{ x: 4 }}
              >
                <span className="sp-row-rank">{i + 1}</span>
                <div className="sp-row-thumb">
                  <img src={item.images[0] || "/placeholder.svg"} alt={item.title} loading="lazy" />
                </div>
                <div className="sp-row-info">
                  <span className="sp-row-title">{item.title}</span>
                  <span className="sp-row-meta">{item.city || item.category}</span>
                </div>
                <span className="sp-row-price">MWK {Number(price || 0).toLocaleString()}</span>
              </motion.button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
