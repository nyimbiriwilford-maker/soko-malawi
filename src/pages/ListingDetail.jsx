import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Comments from '../components/Comments'

const CAT_META = {
  Electronics: { color: '#1a7a4a', bg: '#e6f4ec' },
  Furniture:   { color: '#b45309', bg: '#fef3c7' },
  Clothing:    { color: '#7c3aed', bg: '#ede9fe' },
  Vehicles:    { color: '#1d4ed8', bg: '#dbeafe' },
  Property:    { color: '#0f766e', bg: '#ccfbf1' },
  Agriculture: { color: '#15803d', bg: '#dcfce7' },
  Food:        { color: '#dc2626', bg: '#fee2e2' },
  Services:    { color: '#d97706', bg: '#fef3c7' },
  Other:       { color: '#6b7280', bg: '#f3f4f6' },
}

const BADGE_META = {
  hot:      { label: '🔥 Hot Deal',      bg: '#fef2f2', color: '#dc2626', border: '#fecaca' },
  sale:     { label: '💸 On Sale',       bg: '#fffbeb', color: '#d97706', border: '#fde68a' },
  new_in:   { label: '🆕 New In',        bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  limited:  { label: '⚡ Limited Stock', bg: '#faf5ff', color: '#7c3aed', border: '#ddd6fe' },
  featured: { label: '⭐ Featured',      bg: '#fffbeb', color: '#f59e0b', border: '#fde68a' },
}

const CONDITION_META = {
  new:       { label: 'Brand New',  icon: '✨', color: '#15803d', bg: '#dcfce7' },
  like_new:  { label: 'Like New',   icon: '💎', color: '#1a7a4a', bg: '#e6f4ec' },
  good:      { label: 'Good',       icon: '👍', color: '#0f766e', bg: '#ccfbf1' },
  fair:      { label: 'Fair',       icon: '🔄', color: '#b45309', bg: '#fef3c7' },
  for_parts: { label: 'For Parts',  icon: '🔩', color: '#6b7280', bg: '#f3f4f6' },
}

function isFlashActive(listing) {
  if (!listing?.flash_sale_price || !listing?.flash_sale_expires_at) return false
  return new Date(listing.flash_sale_expires_at) > new Date()
}

function flashTimeLeft(expiresAt) {
  const ms = new Date(expiresAt) - Date.now()
  if (ms <= 0) return null
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  if (h >= 24) return `${Math.floor(h / 24)}d ${h % 24}h ${m}m`
  if (h > 0) return `${h}h ${m}m`
  return `${m}m ${s}s`
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date)
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d ago`
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}
function getOnlineStatus(lastSeen) {
  const mins = Math.floor((Date.now() - new Date(lastSeen)) / 60000)
  if (mins < 5)  return { label: 'Online now',       color: '#15803d' }
  if (mins < 60) return { label: `Active ${mins}m ago`, color: '#d97706' }
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return { label: `Active ${hrs}h ago`,  color: '#9ca3af' }
  return { label: 'Offline', color: '#9ca3af' }
}

export default function ListingDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [listing, setListing] = useState(null)
  const [seller, setSeller] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [mediaIndex, setMediaIndex] = useState(0)
  const [loading, setLoading] = useState(true)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [flashTime, setFlashTime] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [showShareSheet, setShowShareSheet] = useState(false)
  const [copied, setCopied] = useState(false)
  const touchStartX = useRef(null)

  useEffect(() => { loadListing() }, [id])

  useEffect(() => {
    if (!listing || !isFlashActive(listing)) return
    setFlashTime(flashTimeLeft(listing.flash_sale_expires_at))
    const t = setInterval(() => {
      const left = flashTimeLeft(listing.flash_sale_expires_at)
      if (!left) { clearInterval(t); return }
      setFlashTime(left)
    }, 1000)
    return () => clearInterval(t)
  }, [listing])

  async function loadListing() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    const { data } = await supabase.from('listings').select('*').eq('id', id).single()
    setListing(data)
    if (data?.seller_id) {
      // Try profiles first, fall back to users
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.seller_id).single()
      if (profile) {
        setSeller({ ...profile, name: profile.full_name || profile.name })
      } else {
        const { data: usr } = await supabase.from('users').select('*').eq('id', data.seller_id).single()
        setSeller(usr)
      }
    }
    setLoading(false)
  }

  async function deleteListing() {
    setDeleting(true)
    await supabase.from('listings').delete().eq('id', id)
    navigate('/')
  }

 function handleShare() {
  if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
    navigator.share({ 
      title: listing.title, 
      text: `Check out this listing on SokoMW: ${listing.title}`, 
      url: window.location.href 
    }).catch(() => setShowShareSheet(true))
  } else {
    setShowShareSheet(true)
  }
}

 function copyLink() {
  const url = window.location.href
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {
      // Fallback for localhost
      const el = document.createElement('textarea')
      el.value = url
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  } else {
    const el = document.createElement('textarea')
    el.value = url
    document.body.appendChild(el)
    el.select()
    document.execCommand('copy')
    document.body.removeChild(el)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
}

  // Swipe gestures for media
  function onTouchStart(e) { touchStartX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchStartX.current === null) return
    const dx = e.changedTouches[0].clientX - touchStartX.current
    if (Math.abs(dx) > 40) {
      if (dx < 0) setMediaIndex(i => (i + 1) % allMedia.length)
      else setMediaIndex(i => (i - 1 + allMedia.length) % allMedia.length)
    }
    touchStartX.current = null
  }

  if (loading) return (
    <div style={S.loadWrap}>
      <div style={S.loadSpinner} />
    </div>
  )
  if (!listing) return (
    <div style={S.notFound}>
      <div style={{ fontSize: 48, marginBottom: 12 }}>🔍</div>
      <div style={{ fontSize: 18, fontWeight: 700 }}>Listing not found</div>
      <button style={S.notFoundBtn} onClick={() => navigate('/')}>Back to Home</button>
    </div>
  )

  const allMedia = [
    ...(listing.images || []).map(url => ({ url, type: 'image' })),
    ...(listing.videos || []).map(url => ({ url, type: 'video' })),
  ]

  const isOwner = currentUser?.id === listing.seller_id
  const flash = isFlashActive(listing)
  const flashDiscount = flash ? Math.round((1 - listing.flash_sale_price / listing.price) * 100) : 0
  const displayPrice = flash ? listing.flash_sale_price : listing.price
  const catMeta = CAT_META[listing.category] || { color: '#1a7a4a', bg: '#e6f4ec' }
  const badge = listing.promo_badge && BADGE_META[listing.promo_badge]
  const condition = listing.condition && CONDITION_META[listing.condition]
  const hasBulk = listing.bulk_pricing && listing.bulk_pricing.length > 0

  // Bulk tier for current quantity
  const activeTier = hasBulk
    ? [...listing.bulk_pricing]
        .filter(t => parseInt(t.minQty) <= quantity)
        .sort((a, b) => b.discountPercent - a.discountPercent)[0]
    : null
  const bulkPrice = activeTier
    ? Math.round(listing.price * (1 - activeTier.discountPercent / 100))
    : null
  const effectiveUnitPrice = bulkPrice || displayPrice
  const totalPrice = effectiveUnitPrice * quantity

  return (
    <div style={S.page}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@700;800&family=DM+Sans:wght@400;500;600;700&display=swap');
        * { box-sizing: border-box; }
        @keyframes flashPulse { 0%,100%{opacity:1} 50%{opacity:0.75} }
        @keyframes slideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:none} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
        @keyframes timerTick { 0%{transform:scale(1)} 50%{transform:scale(1.04)} 100%{transform:scale(1)} }
        @keyframes spin { to{transform:rotate(360deg)} }
        ::-webkit-scrollbar { display: none; }
      `}</style>

      {/* ── FLOATING HEADER ── */}
      <div style={S.header}>
        <button style={S.headerBtn} onClick={() => navigate(-1)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={S.headerTitle}>{listing.category}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={S.headerBtn} onClick={() => setShowShareSheet(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          </button>
          {isOwner && (
            <button style={{ ...S.headerBtn, color: '#dc2626' }} onClick={() => setShowDeleteConfirm(true)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
            </button>
          )}
        </div>
      </div>

      {/* ── MEDIA VIEWER ── */}
      <div style={S.mediaWrap} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        {allMedia.length > 0 ? (
          <>
            {allMedia[mediaIndex].type === 'image'
              ? <img src={allMedia[mediaIndex].url} alt={listing.title} style={S.mainMedia} />
              : <video src={allMedia[mediaIndex].url} controls style={S.mainMedia} playsInline />
            }
            {/* Gradient overlay */}
            <div style={S.mediaGradient} />

            {/* Arrow nav */}
            {allMedia.length > 1 && (
              <>
                <button style={{ ...S.arrow, left: 12 }} onClick={() => setMediaIndex(i => (i - 1 + allMedia.length) % allMedia.length)}>‹</button>
                <button style={{ ...S.arrow, right: 12 }} onClick={() => setMediaIndex(i => (i + 1) % allMedia.length)}>›</button>
              </>
            )}

            {/* Dot counter */}
            {allMedia.length > 1 && (
              <div style={S.mediaCounter}>{mediaIndex + 1} / {allMedia.length}</div>
            )}

            {/* Badge overlay on image */}
            {badge && (
              <div style={{ ...S.mediaBadge, background: badge.color }}>{badge.label}</div>
            )}

            {/* Flash overlay */}
            {flash && (
              <div style={S.flashOverlay}>
                <span style={S.flashOverlayDiscount}>-{flashDiscount}%</span>
                <span style={S.flashOverlayTimer}>⏱ {flashTime}</span>
              </div>
            )}
          </>
        ) : (
          <div style={S.noMedia}>
            <span style={{ fontSize: 56 }}>{listing.category === 'Vehicles' ? '🚗' : listing.category === 'Property' ? '🏠' : '📦'}</span>
            <span style={{ fontSize: 13, color: '#aaa', marginTop: 8 }}>No photos</span>
          </div>
        )}
      </div>

      {/* Thumbnail strip */}
      {allMedia.length > 1 && (
        <div style={S.thumbStrip}>
          {allMedia.map((m, i) => (
            <div key={i} style={{ ...S.thumb, ...(i === mediaIndex ? S.thumbActive : {}) }} onClick={() => setMediaIndex(i)}>
              {m.type === 'image'
                ? <img src={m.url} alt="" style={S.thumbInner} />
                : <div style={{ ...S.thumbInner, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>▶</div>
              }
            </div>
          ))}
        </div>
      )}

      {/* ── BODY ── */}
      <div style={S.body}>

        {/* ── PRICE BLOCK ── */}
        <div style={S.priceBlock}>
          {listing.price_type === 'free' ? (
            <div style={S.freePrice}>FREE 🎁</div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                {flash && <span style={S.flashLabelBig}>⚡ FLASH</span>}
                <div style={{ ...S.bigPrice, ...(flash ? { color: '#dc2626' } : {}) }}>
                  MWK {Number(effectiveUnitPrice).toLocaleString()}
                  <span style={S.perUnit}> / unit</span>
                </div>
                {flash && (
                  <div style={S.strikePrice}>MWK {Number(listing.price).toLocaleString()}</div>
                )}
                {activeTier && !flash && (
                  <div style={S.strikePrice}>MWK {Number(listing.price).toLocaleString()}</div>
                )}
              </div>
              {listing.price_type === 'negotiable' && !flash && (
                <div style={S.negotiableChip}>🤝 Price negotiable</div>
              )}
              {flash && flashTime && (
                <div style={S.flashTimer}>
                  <span style={{ animation: 'flashPulse 1s infinite' }}>🔥</span>
                  Flash sale ends in <strong style={{ animation: 'timerTick 1s infinite', display: 'inline-block' }}>{flashTime}</strong>
                </div>
              )}
              {activeTier && (
                <div style={S.bulkActiveChip}>
                  📦 {activeTier.discountPercent}% bulk discount applied (buy {activeTier.minQty}+)
                </div>
              )}
            </div>
          )}

          {/* Total for quantity > 1 */}
          {quantity > 1 && listing.price_type !== 'free' && (
            <div style={S.totalPrice}>
              Total: <strong>MWK {totalPrice.toLocaleString()}</strong> for {quantity} units
            </div>
          )}
        </div>

        {/* Title + meta */}
        <div style={S.titleRow}>
          <h1 style={S.title}>{listing.title}</h1>
        </div>

        {/* Chips row */}
        <div style={S.chipsRow}>
          {condition && (
            <span style={{ ...S.chip, background: condition.bg, color: condition.color }}>
              {condition.icon} {condition.label}
            </span>
          )}
          <span style={{ ...S.chip, background: catMeta.bg, color: catMeta.color }}>
            {listing.category}
          </span>
          {listing.stock_qty && (
            <span style={{ ...S.chip, background: listing.stock_qty <= 3 ? '#fef2f2' : '#f3f4f6', color: listing.stock_qty <= 3 ? '#dc2626' : '#6b7280' }}>
              {listing.stock_qty <= 3 ? `⚠️ ${listing.stock_qty} left` : `📦 ${listing.stock_qty} in stock`}
            </span>
          )}
        </div>

        {/* Meta row */}
        <div style={S.metaRow}>
          <span style={S.metaItem}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill={catMeta.color}><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
            {listing.city}
          </span>
          <span style={S.metaDot}>·</span>
          <span style={S.metaItem}>{timeAgo(listing.created_at)}</span>
          {listing.meetup_note && (
            <>
              <span style={S.metaDot}>·</span>
              <span style={{ ...S.metaItem, color: '#1a7a4a' }}>🚗 Delivery available</span>
            </>
          )}
        </div>

        {/* Tags */}
        {listing.tags && listing.tags.length > 0 && (
          <div style={S.tagsRow}>
            {listing.tags.map(tag => (
              <span key={tag} style={S.tagChip}>#{tag}</span>
            ))}
          </div>
        )}

        {/* ── FLASH SALE SECTION ── */}
        {flash && (
          <div style={S.flashSection}>
            <div style={S.flashSectionHeader}>
              <span>⚡ Flash Sale</span>
              <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 800 }}>{flashTime} remaining</span>
            </div>
            <div style={S.flashSectionBody}>
              <div style={S.flashStat}>
                <div style={S.flashStatVal}>{flashDiscount}%</div>
                <div style={S.flashStatLabel}>Discount</div>
              </div>
              <div style={S.flashStatDivider} />
              <div style={S.flashStat}>
                <div style={S.flashStatVal}>MWK {Number(listing.flash_sale_price).toLocaleString()}</div>
                <div style={S.flashStatLabel}>Flash price</div>
              </div>
              <div style={S.flashStatDivider} />
              <div style={S.flashStat}>
                <div style={{ ...S.flashStatVal, textDecoration: 'line-through', color: '#bbb' }}>MWK {Number(listing.price).toLocaleString()}</div>
                <div style={S.flashStatLabel}>Original</div>
              </div>
            </div>
          </div>
        )}

        {/* ── BULK PRICING SECTION ── */}
        {hasBulk && (
          <div style={S.bulkSection}>
            <div style={S.bulkHeader}>
              <span style={S.bulkHeaderIcon}>📦</span>
              <div>
                <div style={S.bulkHeaderTitle}>Bulk Pricing</div>
                <div style={S.bulkHeaderSub}>Order more, save more</div>
              </div>
            </div>
            <div style={S.bulkTable}>
              {/* Header */}
              <div style={{ ...S.bulkTableRow, background: '#f0faf4' }}>
                <span style={S.bulkTableHead}>Quantity</span>
                <span style={S.bulkTableHead}>Price/unit</span>
                <span style={S.bulkTableHead}>You save</span>
              </div>
              {/* 1 unit row */}
              <div style={{ ...S.bulkTableRow, ...(quantity === 1 && !activeTier ? S.bulkRowActive : {}) }}>
                <span style={S.bulkTableCell}>1 unit</span>
                <span style={{ ...S.bulkTableCell, fontWeight: 700 }}>MWK {Number(listing.price).toLocaleString()}</span>
                <span style={{ ...S.bulkTableCell, color: '#9ca3af' }}>—</span>
              </div>
              {/* Tier rows */}
              {[...listing.bulk_pricing]
                .sort((a, b) => a.minQty - b.minQty)
                .map((tier, i) => {
                  const tierPrice = Math.round(listing.price * (1 - tier.discountPercent / 100))
                  const saving = listing.price - tierPrice
                  const isActive = activeTier && parseInt(tier.minQty) === parseInt(activeTier.minQty)
                  return (
                    <div key={i} style={{ ...S.bulkTableRow, ...(isActive ? S.bulkRowActive : {}) }}>
                      <span style={S.bulkTableCell}>
                        {tier.minQty}+ units
                        {isActive && <span style={S.bulkActivePill}>✓ Active</span>}
                      </span>
                      <span style={{ ...S.bulkTableCell, fontWeight: 800, color: '#1a7a4a' }}>MWK {tierPrice.toLocaleString()}</span>
                      <span style={{ ...S.bulkTableCell, color: '#dc2626', fontWeight: 700 }}>
                        MWK {saving.toLocaleString()}/ea
                        <span style={{ ...S.discountPill, background: `hsl(${120 + i * 25},60%,92%)`, color: `hsl(${120 + i * 25},50%,28%)` }}>-{tier.discountPercent}%</span>
                      </span>
                    </div>
                  )
                })}
            </div>
            {/* Quantity picker */}
            {listing.price_type !== 'free' && (
              <div style={S.qtyPicker}>
                <span style={S.qtyLabel}>Quantity</span>
                <div style={S.qtyControls}>
                  <button style={S.qtyBtn} onClick={() => setQuantity(q => Math.max(1, q - 1))}>−</button>
                  <span style={S.qtyVal}>{quantity}</span>
                  <button style={S.qtyBtn} onClick={() => setQuantity(q => Math.min(listing.stock_qty || 999, q + 1))}>+</button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DESCRIPTION ── */}
        {listing.description && (
          <div style={S.section}>
            <div style={S.sectionTitle}>Description</div>
            <div style={S.description}>{listing.description}</div>
          </div>
        )}

        {/* ── MEETUP / DELIVERY ── */}
        {listing.meetup_note && (
          <div style={S.infoCard}>
            <div style={S.infoCardIcon}>🚗</div>
            <div>
              <div style={S.infoCardTitle}>Meetup & Delivery</div>
              <div style={S.infoCardText}>{listing.meetup_note}</div>
            </div>
          </div>
        )}

        {/* ── SELLER ── */}
        <div style={S.section}>
          <div style={S.sectionTitle}>Seller</div>
          <div style={S.sellerCard}>
            <div style={S.sellerAvatar}>
              {seller?.avatar_url
                ? <img src={seller.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                : <span style={{ fontSize: 20, fontWeight: 800 }}>{(seller?.name || seller?.full_name || 'U')[0].toUpperCase()}</span>
              }
            </div>
            <div style={{ flex: 1 }}>
              <div style={S.sellerName}>{seller?.name || seller?.full_name || 'Anonymous'}</div>
              <div style={S.sellerMeta}>
                {seller?.city && <span>📍 {seller.city}</span>}
                {!isOwner && seller?.last_seen && (
  <span style={{ marginLeft: 8, color: getOnlineStatus(seller.last_seen).color }}>
    ● {getOnlineStatus(seller.last_seen).label}
  </span>
)}
{isOwner && (
  <span style={{ marginLeft: 8, color: '#1a7a4a', fontWeight: 600 }}>Your listing</span>
)}
              </div>
            </div>
            {!isOwner && (
              <button style={S.viewProfileBtn} onClick={() => navigate('/profile/' + listing.seller_id)}>
                View
              </button>
            )}
          </div>
        </div>

        {/* ── COMMENTS ── */}
<div style={S.section}>
  <Comments listingId={listing.id} currentUser={currentUser} />
</div>

{/* Spacer for sticky footer */}
<div style={{ height: 24 }} />
      </div>

      {/* ── STICKY FOOTER ACTIONS ── */}
      {!isOwner && (
        <div style={S.stickyFooter}>
          {listing.phone && (
            <a href={`https://wa.me/265${listing.phone.replace(/^0/, '')}?text=Hi, I'm interested in your listing: ${listing.title}`}
              style={S.whatsappBtn} target="_blank" rel="noopener noreferrer">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </a>
          )}
          <button style={S.chatBtn} onClick={() => navigate(`/chat/${listing.seller_id}/${listing.id}`)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            Chat with Seller
          </button>
        </div>
      )}

      {isOwner && (
        <div style={S.stickyFooter}>
          <button style={S.editBtn} onClick={() => navigate('/post/edit/' + listing.id)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
            Edit Listing
          </button>
          <button style={S.deleteFooterBtn} onClick={() => setShowDeleteConfirm(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            Delete
          </button>
        </div>
      )}

      {/* ── DELETE CONFIRM MODAL ── */}
      {showDeleteConfirm && (
        <div style={S.overlay} onClick={() => setShowDeleteConfirm(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalIcon}>🗑️</div>
            <div style={S.modalTitle}>Delete this listing?</div>
            <div style={S.modalSub}>This can't be undone. All photos and details will be permanently removed.</div>
            <div style={S.modalBtns}>
              <button style={S.modalCancel} onClick={() => setShowDeleteConfirm(false)}>Cancel</button>
              <button style={S.modalDelete} onClick={deleteListing} disabled={deleting}>
                {deleting ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── SHARE SHEET ── */}
      {showShareSheet && (
        <div style={S.overlay} onClick={() => setShowShareSheet(false)}>
          <div style={{ ...S.modal, paddingBottom: 28 }} onClick={e => e.stopPropagation()}>
            <div style={S.modalTitle}>Share Listing</div>
            <div style={S.shareOptions}>
              <button style={S.shareOption} onClick={copyLink}>
                <div style={{ ...S.shareIcon, background: '#f3f4f6' }}>
                  {copied ? '✓' : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>}
                </div>
                <span>{copied ? 'Copied!' : 'Copy link'}</span>
              </button>
              <a style={S.shareOption} href={`https://wa.me/?text=${encodeURIComponent(listing.title + ' — ' + window.location.href)}`} target="_blank" rel="noopener noreferrer">
                <div style={{ ...S.shareIcon, background: '#dcfce7' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="#15803d"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </div>
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const S = {
  page: { minHeight: '100vh', background: '#f6f9f7', paddingBottom: 90, fontFamily: "'DM Sans', system-ui, sans-serif", maxWidth: 480, margin: '0 auto' },
  loadWrap: { display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' },
  loadSpinner: { width: 36, height: 36, border: '3px solid #e8f0ec', borderTop: '3px solid #1a7a4a', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  notFound: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 8, color: '#374151' },
  notFoundBtn: { marginTop: 16, background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: 12, padding: '10px 24px', fontSize: 14, fontWeight: 700, cursor: 'pointer' },

  header: { position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(12px)', borderBottom: '1px solid #e8ede9', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 14px' },
  headerBtn: { width: 36, height: 36, borderRadius: 10, background: '#f4f8f5', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#374151' },
  headerTitle: { fontSize: 14, fontWeight: 700, color: '#637068' },

  // Media
  mediaWrap: { position: 'relative', background: '#111', overflow: 'hidden' },
  mainMedia: { width: '100%', height: 320, objectFit: 'contain', display: 'block' },
  mediaGradient: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, background: 'linear-gradient(to top, rgba(0,0,0,0.5), transparent)', pointerEvents: 'none' },
  arrow: { position: 'absolute', top: '50%', transform: 'translateY(-50%)', background: 'rgba(255,255,255,0.2)', backdropFilter: 'blur(8px)', color: '#fff', border: 'none', borderRadius: '50%', width: 36, height: 36, fontSize: 22, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  mediaCounter: { position: 'absolute', bottom: 10, right: 12, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 8, padding: '3px 8px' },
  mediaBadge: { position: 'absolute', top: 12, left: 12, color: '#fff', fontSize: 11, fontWeight: 800, borderRadius: 8, padding: '4px 10px' },
  flashOverlay: { position: 'absolute', top: 12, right: 12, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
  flashOverlayDiscount: { background: '#dc2626', color: '#fff', fontSize: 14, fontWeight: 900, borderRadius: 8, padding: '4px 10px', animation: 'flashPulse 1s infinite' },
  flashOverlayTimer: { background: 'rgba(0,0,0,0.7)', color: '#ff6b6b', fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 8px' },
  noMedia: { height: 260, background: '#e8f0eb', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 },

  thumbStrip: { display: 'flex', gap: 6, padding: '8px 12px', background: '#0f0f0f', overflowX: 'auto' },
  thumb: { width: 54, height: 54, borderRadius: 8, overflow: 'hidden', flexShrink: 0, cursor: 'pointer', border: '2px solid transparent', opacity: 0.65, transition: 'all 0.15s' },
  thumbActive: { border: '2px solid #1a7a4a', opacity: 1 },
  thumbInner: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },

  // Body
  body: { padding: '18px 16px 0' },

  // Price block
  priceBlock: { background: '#fff', borderRadius: 18, padding: '16px 16px', marginBottom: 14, boxShadow: '0 2px 12px rgba(0,0,0,0.06)', border: '1px solid #edf2ee' },
  bigPrice: { fontFamily: "'Sora', system-ui, sans-serif", fontSize: 28, fontWeight: 800, color: '#1a7a4a', lineHeight: 1 },
  perUnit: { fontSize: 13, fontWeight: 400, color: '#9ca3af' },
  freePrice: { fontFamily: "'Sora', system-ui, sans-serif", fontSize: 28, fontWeight: 900, color: '#15803d' },
  strikePrice: { fontSize: 16, color: '#bbb', textDecoration: 'line-through', fontWeight: 500, alignSelf: 'flex-end' },
  flashLabelBig: { background: 'linear-gradient(90deg,#dc2626,#ef4444)', color: '#fff', fontSize: 11, fontWeight: 900, borderRadius: 6, padding: '3px 8px', letterSpacing: 0.5, animation: 'flashPulse 1s infinite' },
  negotiableChip: { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#fffbeb', color: '#d97706', fontSize: 12, fontWeight: 700, borderRadius: 8, padding: '4px 10px', marginTop: 8, border: '1px solid #fde68a' },
  flashTimer: { fontSize: 13, color: '#dc2626', fontWeight: 600, marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 },
  bulkActiveChip: { display: 'inline-flex', alignItems: 'center', gap: 4, background: '#e6f4ec', color: '#1a7a4a', fontSize: 12, fontWeight: 700, borderRadius: 8, padding: '4px 10px', marginTop: 8, border: '1px solid #b8d8c4' },
  totalPrice: { marginTop: 10, padding: '10px 12px', background: '#f0faf4', borderRadius: 10, fontSize: 14, color: '#374151', fontWeight: 500, border: '1px solid #d4ead9' },

  titleRow: { marginBottom: 10 },
  title: { fontSize: 22, fontWeight: 800, color: '#0f1410', margin: 0, lineHeight: 1.25, fontFamily: "'Sora', system-ui, sans-serif" },

  chipsRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { fontSize: 12, fontWeight: 700, borderRadius: 8, padding: '4px 10px', display: 'inline-block' },

  metaRow: { display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4, fontSize: 12, color: '#888', marginBottom: 12 },
  metaItem: { display: 'flex', alignItems: 'center', gap: 3 },
  metaDot: { color: '#ccc' },

  tagsRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  tagChip: { background: '#f0faf4', color: '#1a7a4a', fontSize: 11, fontWeight: 600, borderRadius: 20, padding: '3px 10px', border: '1px solid #d4ead9' },

  // Flash section
  flashSection: { background: 'linear-gradient(135deg, #fff5f5, #fff)', border: '1.5px solid #fecaca', borderRadius: 16, padding: '14px 16px', marginBottom: 14 },
  flashSectionHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 15, fontWeight: 800, color: '#dc2626', marginBottom: 12 },
  flashSectionBody: { display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
  flashStat: { flex: 1, textAlign: 'center' },
  flashStatVal: { fontSize: 15, fontWeight: 800, color: '#0f1410' },
  flashStatLabel: { fontSize: 11, color: '#9ca3af', marginTop: 3 },
  flashStatDivider: { width: 1, height: 36, background: '#fecaca' },

  // Bulk section
  bulkSection: { background: '#fff', border: '1.5px solid #d4ead9', borderRadius: 16, overflow: 'hidden', marginBottom: 14, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' },
  bulkHeader: { display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: '1px solid #f0f5f1' },
  bulkHeaderIcon: { fontSize: 22, flexShrink: 0 },
  bulkHeaderTitle: { fontSize: 14, fontWeight: 800, color: '#0f1410' },
  bulkHeaderSub: { fontSize: 11, color: '#637068', marginTop: 2 },
  bulkTable: { width: '100%' },
  bulkTableRow: { display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid #f3f4f6', transition: 'background 0.15s' },
  bulkRowActive: { background: '#f0faf4', borderLeft: '3px solid #1a7a4a' },
  bulkTableHead: { flex: 1, fontSize: 11, fontWeight: 700, color: '#637068', textTransform: 'uppercase', letterSpacing: 0.5 },
  bulkTableCell: { flex: 1, fontSize: 13, color: '#374151', display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' },
  bulkActivePill: { background: '#1a7a4a', color: '#fff', fontSize: 9, fontWeight: 800, borderRadius: 4, padding: '1px 5px' },
  discountPill: { borderRadius: 20, padding: '1px 6px', fontSize: 10, fontWeight: 800, marginLeft: 4 },
  qtyPicker: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid #f0f5f1' },
  qtyLabel: { fontSize: 14, fontWeight: 700, color: '#374151' },
  qtyControls: { display: 'flex', alignItems: 'center', gap: 14 },
  qtyBtn: { width: 34, height: 34, borderRadius: 10, background: '#f0faf4', border: '1.5px solid #d4ead9', color: '#1a7a4a', fontSize: 20, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  qtyVal: { fontSize: 18, fontWeight: 800, color: '#0f1410', minWidth: 28, textAlign: 'center' },

  // Section
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 12, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  description: { fontSize: 15, color: '#374151', lineHeight: 1.75, background: '#fff', borderRadius: 14, padding: '14px 14px', border: '1px solid #edf2ee' },

  // Info card
  infoCard: { display: 'flex', alignItems: 'flex-start', gap: 12, background: '#fff', borderRadius: 14, padding: '14px', border: '1px solid #edf2ee', marginBottom: 14 },
  infoCardIcon: { fontSize: 22, flexShrink: 0, marginTop: 1 },
  infoCardTitle: { fontSize: 13, fontWeight: 700, color: '#0f1410', marginBottom: 3 },
  infoCardText: { fontSize: 13, color: '#637068', lineHeight: 1.5 },

  // Seller
  sellerCard: { display: 'flex', alignItems: 'center', gap: 12, background: '#fff', borderRadius: 14, padding: '14px', border: '1px solid #edf2ee' },
  sellerAvatar: { width: 48, height: 48, borderRadius: '50%', background: '#1a7a4a', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, flexShrink: 0, overflow: 'hidden' },
  sellerName: { fontSize: 15, fontWeight: 700, color: '#0f1410' },
  sellerMeta: { fontSize: 12, color: '#888', marginTop: 3, display: 'flex', alignItems: 'center', gap: 4 },
  viewProfileBtn: { background: '#f4f8f5', border: '1.5px solid #d4ead9', borderRadius: 10, padding: '7px 14px', fontSize: 13, fontWeight: 700, color: '#1a7a4a', cursor: 'pointer' },

  // Sticky footer
  stickyFooter: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: 480, background: '#fff', borderTop: '1px solid #e8ede9', padding: '12px 16px', paddingBottom: 'calc(12px + env(safe-area-inset-bottom))', display: 'flex', gap: 10, zIndex: 100, boxShadow: '0 -4px 20px rgba(0,0,0,0.08)' },
  chatBtn: { flex: 1, background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 14px rgba(26,122,74,0.35)' },
  whatsappBtn: { background: '#25d366', color: '#fff', border: 'none', borderRadius: 14, padding: '14px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', flexShrink: 0 },
  editBtn: { flex: 1, background: '#f4f8f5', color: '#1a7a4a', border: '1.5px solid #d4ead9', borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },
  deleteFooterBtn: { background: '#fef2f2', color: '#dc2626', border: '1.5px solid #fecaca', borderRadius: 14, padding: '14px 16px', fontSize: 14, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 },

  // Modal
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' },
  modal: { background: '#fff', borderRadius: '24px 24px 0 0', padding: '28px 24px 16px', width: '100%', maxWidth: 480, animation: 'slideUp 0.3s ease' },
  modalIcon: { fontSize: 36, textAlign: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: 800, color: '#0f1410', textAlign: 'center', marginBottom: 6 },
  modalSub: { fontSize: 14, color: '#637068', textAlign: 'center', marginBottom: 20, lineHeight: 1.6 },
  modalBtns: { display: 'flex', gap: 10 },
  modalCancel: { flex: 1, background: '#f4f8f5', border: 'none', borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 700, color: '#374151', cursor: 'pointer' },
  modalDelete: { flex: 1, background: '#dc2626', border: 'none', borderRadius: 12, padding: '13px', fontSize: 15, fontWeight: 700, color: '#fff', cursor: 'pointer' },
  shareOptions: { display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16 },
  shareOption: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: '#374151', textDecoration: 'none' },
  shareIcon: { width: 52, height: 52, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 },
}