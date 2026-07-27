/**
 * Tag picker for status posts — owner's listings, jobs, services, shops, looking-for.
 */
import { useMemo, useState } from 'react'
import { STATUS_COLORS } from '../constants/homeConstants'

const G = '#1a7a4a'

const KIND_META = {
  listing: { label: 'Products', short: 'Product', color: STATUS_COLORS.listing },
  job: { label: 'Jobs', short: 'Job', color: STATUS_COLORS.job },
  service: { label: 'Services', short: 'Service', color: STATUS_COLORS.service },
  shop: { label: 'Shops', short: 'Shop', color: STATUS_COLORS.shop },
  request: { label: 'Looking for', short: 'Request', color: '#c9820a' },
}

function IconSearch({ size = 16, color = '#94a3b8' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}
function IconTag({ size = 14, color = G }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill={color} stroke="none" />
    </svg>
  )
}
function IconCheck({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M5 12l5 5L20 7" />
    </svg>
  )
}
function IconPackage({ size = 28, color = '#cbd5e1' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
      <path d="M3.3 7.5L12 12l8.7-4.5" />
      <path d="M12 22V12" />
    </svg>
  )
}
function IconX({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

function formatPrice(price) {
  const n = Number(price)
  if (!Number.isFinite(n)) return price ? String(price) : ''
  return `MK ${n.toLocaleString()}`
}

/** Normalize legacy listings array into tag items */
export function listingsToTagItems(listings = []) {
  return listings.map(l => ({
    id: l.id,
    kind: 'listing',
    title: l.title || 'Listing',
    subtitle: formatPrice(l.price) || l.category || '',
    image: l.images?.[0] || null,
    meta: l,
  }))
}

/**
 * @param {object} props
 * @param {Array} [props.items] - unified items {id, kind, title, subtitle, image}
 * @param {Array} [props.listings] - legacy listings only
 * @param {string|null} props.taggedId
 * @param {string|null} [props.taggedKind]
 * @param {(sel: {id, kind}|null) => void} props.onChange
 * @param {boolean} [props.compact]
 */
export default function ProductTagPicker({
  items = null,
  listings = [],
  taggedId = null,
  taggedKind = null,
  onChange,
  compact = false,
}) {
  const [query, setQuery] = useState('')
  const [expanded, setExpanded] = useState(true)
  const [kindTab, setKindTab] = useState('all')

  const allItems = useMemo(() => {
    if (items && items.length) return items
    return listingsToTagItems(listings)
  }, [items, listings])

  const kindsPresent = useMemo(() => {
    const set = new Set(allItems.map(i => i.kind).filter(Boolean))
    return ['listing', 'job', 'service', 'shop', 'request'].filter(k => set.has(k))
  }, [allItems])

  const filtered = useMemo(() => {
    let rows = allItems
    if (kindTab !== 'all') rows = rows.filter(i => i.kind === kindTab)
    const q = query.trim().toLowerCase()
    if (!q) return rows
    return rows.filter(i =>
      (i.title || '').toLowerCase().includes(q)
      || (i.subtitle || '').toLowerCase().includes(q)
      || (i.kind || '').toLowerCase().includes(q)
      || (KIND_META[i.kind]?.label || '').toLowerCase().includes(q)
    )
  }, [allItems, kindTab, query])

  const tagged = allItems.find(i =>
    String(i.id) === String(taggedId)
    && (!taggedKind || i.kind === taggedKind)
  ) || allItems.find(i => String(i.id) === String(taggedId)) || null

  function selectItem(item) {
    if (!onChange) return
    if (tagged && String(tagged.id) === String(item.id) && tagged.kind === item.kind) {
      onChange(null)
    } else {
      onChange({ id: item.id, kind: item.kind })
    }
  }

  if (!allItems.length) {
    return (
      <div style={{
        border: '1.5px dashed #e2e8f0',
        borderRadius: 14,
        padding: compact ? '14px 12px' : '18px 14px',
        background: '#f8fafc',
        textAlign: 'center',
      }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}>
          <IconPackage size={compact ? 24 : 32} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#64748b' }}>Nothing to tag yet</div>
        <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 3 }}>
          Post a product, job, service, shop, or looking-for request first.
        </div>
      </div>
    )
  }

  return (
    <div>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
        gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div style={{
            width: 28, height: 28, borderRadius: 8,
            background: 'linear-gradient(135deg,#ecfdf5,#d1fae5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <IconTag size={14} />
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a' }}>Tag your post</div>
            <div style={{ fontSize: 10, color: '#94a3b8', fontWeight: 600 }}>
              Product · job · service · shop · looking for
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          style={{
            border: 'none', background: '#f1f5f9', borderRadius: 8,
            padding: '6px 10px', fontSize: 11, fontWeight: 700,
            color: '#64748b', cursor: 'pointer',
          }}
        >
          {expanded ? 'Hide' : 'Show'}
        </button>
      </div>

      {tagged && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '8px 10px',
          borderRadius: 12,
          background: 'linear-gradient(135deg,#f0fdf4,#ecfdf5)',
          border: `1.5px solid ${G}`,
          marginBottom: 10,
        }}>
          <div style={{
            width: 42, height: 42, borderRadius: 10, overflow: 'hidden',
            background: '#e2e8f0', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {tagged.image
              ? <img src={tagged.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <IconPackage size={20} color="#94a3b8" />
            }
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: KIND_META[tagged.kind]?.color || G, textTransform: 'uppercase', letterSpacing: 0.4 }}>
              {KIND_META[tagged.kind]?.short || tagged.kind}
            </div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#0f172a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {tagged.title}
            </div>
            {tagged.subtitle && (
              <div style={{ fontSize: 11, fontWeight: 700, color: G }}>{tagged.subtitle}</div>
            )}
          </div>
          <button
            type="button"
            onClick={() => onChange?.(null)}
            aria-label="Remove tag"
            style={{
              width: 28, height: 28, borderRadius: '50%', border: 'none',
              background: '#fff', color: '#64748b', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }}
          >
            <IconX />
          </button>
        </div>
      )}

      {expanded && (
        <>
          {kindsPresent.length > 1 && (
            <div style={{
              display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10,
              paddingBottom: 2, scrollbarWidth: 'none',
            }}>
              <KindChip active={kindTab === 'all'} onClick={() => setKindTab('all')} label="All" />
              {kindsPresent.map(k => (
                <KindChip
                  key={k}
                  active={kindTab === k}
                  onClick={() => setKindTab(k)}
                  label={KIND_META[k]?.label || k}
                  color={KIND_META[k]?.color}
                />
              ))}
            </div>
          )}

          {allItems.length > 4 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '9px 12px',
              borderRadius: 12,
              background: '#f8fafc',
              border: '1.5px solid #e2e8f0',
              marginBottom: 10,
            }}>
              <IconSearch />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search your posts…"
                style={{
                  flex: 1, border: 'none', outline: 'none', background: 'transparent',
                  fontSize: 13, color: '#0f172a', fontFamily: 'inherit',
                }}
              />
              {query ? (
                <button type="button" onClick={() => setQuery('')} style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  <IconX size={14} />
                </button>
              ) : null}
            </div>
          )}

          <div style={{
            display: 'flex', gap: 10, overflowX: 'auto',
            paddingBottom: 4, scrollbarWidth: 'thin',
            WebkitOverflowScrolling: 'touch',
          }}>
            {filtered.map(item => {
              const selected = tagged
                && String(tagged.id) === String(item.id)
                && tagged.kind === item.kind
              const kindColor = KIND_META[item.kind]?.color || G
              return (
                <button
                  key={`${item.kind}-${item.id}`}
                  type="button"
                  onClick={() => selectItem(item)}
                  style={{
                    flexShrink: 0,
                    width: compact ? 100 : 112,
                    border: `2px solid ${selected ? G : '#e2e8f0'}`,
                    borderRadius: 14,
                    overflow: 'hidden',
                    background: selected ? '#f0fdf4' : '#fff',
                    cursor: 'pointer',
                    padding: 0,
                    textAlign: 'left',
                    boxShadow: selected
                      ? '0 4px 14px rgba(26,122,74,0.18)'
                      : '0 1px 4px rgba(0,0,0,0.04)',
                    transition: 'border-color 0.15s, box-shadow 0.15s',
                    position: 'relative',
                    fontFamily: 'inherit',
                  }}
                >
                  <div style={{
                    width: '100%', height: compact ? 68 : 76,
                    background: 'linear-gradient(145deg,#f1f5f9,#e2e8f0)',
                    position: 'relative', overflow: 'hidden',
                  }}>
                    {item.image
                      ? <img src={item.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <IconPackage size={26} />
                        </div>
                      )
                    }
                    <span style={{
                      position: 'absolute', left: 6, bottom: 6,
                      background: 'rgba(15,23,42,0.72)', color: '#fff',
                      fontSize: 9, fontWeight: 800, letterSpacing: 0.3,
                      padding: '2px 6px', borderRadius: 6,
                      textTransform: 'uppercase',
                    }}>
                      {KIND_META[item.kind]?.short || item.kind}
                    </span>
                    {selected && (
                      <div style={{
                        position: 'absolute', top: 6, right: 6,
                        width: 22, height: 22, borderRadius: '50%',
                        background: G,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: '0 2px 6px rgba(26,122,74,0.4)',
                      }}>
                        <IconCheck />
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '7px 8px 8px' }}>
                    <div style={{
                      fontSize: 11, fontWeight: 700, color: '#0f172a',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      lineHeight: 1.25,
                    }}>
                      {item.title}
                    </div>
                    {item.subtitle && (
                      <div style={{ fontSize: 11, fontWeight: 800, color: kindColor, marginTop: 2 }}>
                        {item.subtitle}
                      </div>
                    )}
                  </div>
                </button>
              )
            })}
            {!filtered.length && (
              <div style={{ fontSize: 12, color: '#94a3b8', padding: '12px 4px', fontWeight: 600 }}>
                No matches
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function KindChip({ active, onClick, label, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        flexShrink: 0,
        border: `1.5px solid ${active ? (color || G) : '#e2e8f0'}`,
        background: active ? `${color || G}14` : '#fff',
        color: active ? (color || G) : '#64748b',
        borderRadius: 999,
        padding: '6px 12px',
        fontSize: 11,
        fontWeight: 800,
        cursor: 'pointer',
        fontFamily: 'inherit',
      }}
    >
      {label}
    </button>
  )
}

/**
 * Load taggable assets owned by the current user.
 * Listings are always preferred first so products show for tagging.
 */
export async function loadOwnerTagItems(supabase, userId) {
  if (!userId) return []

  // Listings: try seller_id then user_id (schemas differ across tables)
  async function loadListings() {
    const cols = 'id, title, price, images, category, city, status, seller_id, user_id'
    let rows = []

    const q1 = await supabase
      .from('listings')
      .select(cols)
      .eq('seller_id', userId)
      .order('created_at', { ascending: false })
      .limit(40)

    if (!q1.error && q1.data?.length) {
      rows = q1.data
    } else {
      // Fallback: user_id column
      const q2 = await supabase
        .from('listings')
        .select(cols)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(40)
      if (!q2.error && q2.data?.length) rows = q2.data
      else if (!q1.error && q1.data) rows = q1.data
    }

    // Last resort: minimal select if column list failed
    if (!rows.length) {
      const q3 = await supabase
        .from('listings')
        .select('id, title, price, images, category, city, status')
        .eq('seller_id', userId)
        .order('created_at', { ascending: false })
        .limit(40)
      if (!q3.error) rows = q3.data || []
    }

    return rows
  }

  const results = await Promise.allSettled([
    loadListings(),
    supabase.from('jobs')
      .select('id, title, company, city, salary, cover_image_url, logo_url, status')
      .eq('poster_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(r => r.data || []),
    supabase.from('services')
      .select('id, name, category, city, rate, media_urls, status')
      .eq('provider_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(r => r.data || []),
    supabase.from('shops')
      .select('id, name, city, logo_url, cover_url, is_active')
      .eq('owner_id', userId)
      .order('created_at', { ascending: false })
      .limit(10)
      .then(r => r.data || []),
    supabase.from('buyer_requests')
      .select('id, title, city, budget, category, status')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(r => r.data || []),
  ])

  const items = []
  const blockedListing = new Set(['sold', 'deleted', 'archived', 'removed', 'banned'])
  const blockedOther = new Set(['closed', 'deleted', 'archived', 'cancelled', 'canceled', 'fulfilled', 'expired'])

  const listings = results[0].status === 'fulfilled' ? (results[0].value || []) : []
  for (const l of listings) {
    const st = (l.status || '').toLowerCase()
    // Show almost all listings so tagging is useful — only skip clearly dead ones
    if (st && blockedListing.has(st)) continue
    const img = Array.isArray(l.images)
      ? l.images[0]
      : (typeof l.images === 'string' ? l.images : null)
    items.push({
      id: l.id,
      kind: 'listing',
      title: l.title || 'Product',
      subtitle: formatPrice(l.price) || l.category || l.city || 'Listing',
      image: img || null,
      meta: l,
    })
  }

  const jobs = results[1].status === 'fulfilled' ? (results[1].value || []) : []
  for (const j of jobs) {
    const st = (j.status || '').toLowerCase()
    if (st && blockedOther.has(st)) continue
    items.push({
      id: j.id,
      kind: 'job',
      title: j.title || 'Job',
      subtitle: j.salary || j.company || j.city || 'Job',
      image: j.logo_url || j.cover_image_url || null,
      meta: j,
    })
  }

  const services = results[2].status === 'fulfilled' ? (results[2].value || []) : []
  for (const s of services) {
    const st = (s.status || '').toLowerCase()
    if (st && blockedOther.has(st)) continue
    items.push({
      id: s.id,
      kind: 'service',
      title: s.name || 'Service',
      subtitle: s.rate || s.category || s.city || 'Service',
      image: s.media_urls?.[0] || null,
      meta: s,
    })
  }

  const shops = results[3].status === 'fulfilled' ? (results[3].value || []) : []
  for (const s of shops) {
    if (s.is_active === false) continue
    items.push({
      id: s.id,
      kind: 'shop',
      title: s.name || 'Shop',
      subtitle: s.city || 'Shop',
      image: s.logo_url || s.cover_url || null,
      meta: s,
    })
  }

  const requests = results[4].status === 'fulfilled' ? (results[4].value || []) : []
  for (const r of requests) {
    const st = (r.status || '').toLowerCase()
    if (st && blockedOther.has(st)) continue
    items.push({
      id: r.id,
      kind: 'request',
      title: r.title || 'Looking for…',
      subtitle: r.budget != null ? formatPrice(r.budget) : (r.category || r.city || 'Request'),
      image: null,
      meta: r,
    })
  }

  // Products first in the list for easy tagging
  items.sort((a, b) => {
    if (a.kind === 'listing' && b.kind !== 'listing') return -1
    if (b.kind === 'listing' && a.kind !== 'listing') return 1
    return 0
  })

  return items
}
