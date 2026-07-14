import { useState, useCallback, useRef, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Search, MessageCircle, Bell, Plus, UploadCloud, X, MapPin,
  RefreshCw, Rocket, Star, TrendingUp, Crown, CheckCircle2,
  ChevronLeft, ChevronRight, Eye, Send, Phone, Info, HelpCircle,
  Home, Store, Briefcase, Wrench, Clock, ShieldCheck, UserSearch,
  User, AlertCircle, Loader, Video, PlayCircle, Film,
} from 'lucide-react'
import { supabase } from '../lib/supabase'

/* ────────────────────────────────────────────────────────────
   Design tokens
   ──────────────────────────────────────────────────────────── */
const C = {
  green: '#1a7a4a', greenMid: '#22a05e', greenDeep: '#0d4a2c',
  greenLight: '#e6f7ee', greenTint: '#f0faf4',
  gold: '#d4920a', amber: '#f59e0b', amberDeep: '#b45309',
  amberBg: '#fffbeb', amberBorder: '#fde68a',
  dark: '#0f1410', muted: '#637068', faint: '#9aafa0',
  border: '#d8e5dc', line: '#e8ede9', cardLine: '#edf2ee',
  surface: '#f4f8f5', white: '#ffffff',
  blue: '#1d4ed8', blueBg: '#dbeafe', blueBorder: '#bfdbfe',
  red: '#dc2626', redBg: '#fef2f2', redBorder: '#fecaca',
  indigo: '#4f46e5', indigoBg: '#eef2ff', indigoBorder: '#e0e7ff',
}

const GRAD = {
  primaryBtn: `linear-gradient(135deg, ${C.greenMid}, ${C.greenDeep})`,
  gold: `linear-gradient(135deg, ${C.amber}, ${C.gold})`,
  premiumCard: 'linear-gradient(135deg, #fffdf7, #fff3d6)',
  premiumIcon: `linear-gradient(135deg, #fcd34d, ${C.amberDeep})`,
}

const SHADOW = {
  card: '0 1px 2px rgba(15,20,16,0.04), 0 10px 26px -18px rgba(15,20,16,0.18)',
  btnGreen: '0 6px 16px -4px rgba(26,122,74,0.38)',
  btnGreenHover: '0 10px 22px -6px rgba(26,122,74,0.46)',
  header: '0 1px 0 rgba(15,20,16,0.05), 0 14px 28px -22px rgba(15,20,16,0.25)',
  premiumGlow: '0 0 0 1px rgba(217,119,6,0.18), 0 10px 24px -10px rgba(217,119,6,0.4)',
  focusRing: '0 0 0 3px rgba(26,122,74,0.14)',
  pin: '0 3px 8px rgba(29,78,216,0.5)',
  stickyBar: '0 -4px 16px -8px rgba(15,20,16,0.12)',
}

const SORA = "'Sora', system-ui, sans-serif"
const DMSANS = "'DM Sans', system-ui, sans-serif"

const NAV_TABS = [
  { label: 'Marketplace', icon: Home, path: '/', active: true },
  { label: 'Shops', icon: Store, path: '/shops' },
  { label: 'People Looking For', icon: UserSearch, path: '/looking-for' },
  { label: 'Jobs', icon: Briefcase, path: '/jobs' },
  { label: 'Services', icon: Wrench, path: '/services' },
  { label: 'Statuses (Stories)', icon: Clock, path: '/status' },
  { label: 'Verification', icon: ShieldCheck, path: null },
]

const STEPS = [
  { id: 1, title: 'Listing Info', subtitle: 'Add basic details' },
  { id: 2, title: 'Location', subtitle: 'Confirm your location' },
  { id: 3, title: 'Pricing & Booking', subtitle: 'Set your prices' },
  { id: 4, title: 'Promotion', subtitle: 'Boost your listing' },
  { id: 5, title: 'Review', subtitle: 'Review & publish' },
]

const FEATURED_TIERS = [
  { days: 3,  price: 1500 },
  { days: 7,  price: 2500 },
  { days: 30, price: 8000 },
]

const PROMOTIONS = [
  { id: 'basic',      name: 'Basic Boost',       price: 1500, durationDays: 7,  icon: Rocket,
    desc: 'Increase visibility in category and search results.',
    iconBg: 'linear-gradient(135deg,#dbeafe,#eff6ff)', iconColor: C.blue },
  { id: 'featured',   name: 'Featured Listing',  price: 3000, durationDays: 14, icon: Star,
    desc: 'Your listing appears on the homepage.',
    iconBg: 'linear-gradient(135deg,#fef3c7,#fffbeb)', iconColor: C.amberDeep },
  { id: 'top_search', name: 'Top of Search',     price: 4500, durationDays: 14, icon: TrendingUp,
    desc: 'Show at the top of search results.',
    iconBg: 'linear-gradient(135deg,#fee2e2,#fef2f2)', iconColor: C.red },
  { id: 'premium',    name: 'Premium Promotion', price: 7000, durationDays: 30, icon: Crown,
    desc: 'All-in-one visibility boost across the platform.',
    iconBg: GRAD.premiumIcon, iconColor: '#78350f', badge: 'Best Value', premium: true },
]

const CONDITIONS = [
  { key: 'new',        label: 'Brand New' },
  { key: 'like_new',   label: 'Like New' },
  { key: 'used_good',  label: 'Used - Good' },
  { key: 'used_fair',  label: 'Used - Fair' },
  { key: 'for_parts',  label: 'For Parts' },
]

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const SUBCATEGORIES = {
  Electronics: ['Phones & Tablets','Laptops & Computers','TVs & Audio','Cameras','Accessories','Other Electronics'],
  Furniture:   ['Sofas & Chairs','Beds & Mattresses','Tables & Desks','Cabinets & Shelves','Office Furniture','Other Furniture'],
  Clothing:    ['Men\'s Wear','Women\'s Wear','Kids\' Wear','Shoes','Bags & Accessories','Traditional Wear'],
  Vehicles:    ['Cars','Motorcycles','Trucks & Vans','Auto Parts','Bicycles','Other Vehicles'],
  Property:    ['Houses for Sale','Houses for Rent','Land & Plots','Commercial Property','Apartments','Short Stays'],
  Agriculture: ['Livestock','Farm Equipment','Seeds & Fertilizer','Crops & Produce','Poultry','Other Agriculture'],
  Food:        ['Fresh Produce','Packaged Foods','Beverages','Baked Goods','Catering', 'Other Food'],
  Services:    ['Home Services','Beauty & Wellness','Repairs & Maintenance','Events & Rentals','Professional Services','Other Services'],
}

/* ────────────────────────────────────────────────────────────
   Validation
   ──────────────────────────────────────────────────────────── */
function validate(form, images) {
  const errs = []
  if (!form.title.trim())    errs.push('Listing title is required.')
  if (!form.category)        errs.push('Please select a category.')
  if (!form.price)           errs.push('Price is required.')
  if (isNaN(Number(form.price)) || Number(form.price) <= 0)
                             errs.push('Price must be a positive number.')
  if (!form.description.trim()) errs.push('Description is required.')
  if (!form.fullName.trim()) errs.push('Your full name is required.')
  if (form.contactMethods.length === 0) errs.push('Please select at least one contact method.')
  if (form.contactMethods.includes('call') && !form.callNumber.trim())
    errs.push('Please choose or enter a number for calls.')
  if (form.contactMethods.includes('whatsapp') && !form.whatsappNumber.trim())
    errs.push('Please choose or enter a number for WhatsApp.')
  if (form.contactMethods.includes('email') && !form.email.trim())
    errs.push('Please enter an email address for buyer contact.')
  if (images.length === 0)   errs.push('Please upload at least one image.')
  return errs
}

/* ────────────────────────────────────────────────────────────
   Reusable primitives
   ──────────────────────────────────────────────────────────── */
function Field({ label, required, children, style }) {
  return (
    <label style={{ display: 'block', ...style }}>
      <span style={S.fieldLabel}>{label}{required && <span style={{ color: C.red }}> *</span>}</span>
      {children}
    </label>
  )
}

function Card({ title, subtitle, icon: Icon, badge, children, style }) {
  return (
    <section style={{ ...S.card, ...style }}>
      {title && (
        <div style={S.cardHeadRow}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {Icon && <Icon size={17} color={C.green} />}
            <h2 style={S.cardTitle}>{title}</h2>
          </div>
          {badge}
        </div>
      )}
      {subtitle && <p style={S.cardSubtitle}>{subtitle}</p>}
      {children}
    </section>
  )
}

function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} aria-pressed={checked} style={S.toggleTrack(checked)}>
      <span style={S.toggleKnob(checked)} />
    </button>
  )
}

function TextInput({ style, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <input {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e => { setFocused(false); props.onBlur?.(e) }}
      style={{ ...S.input, ...(focused ? S.inputFocused : {}), ...style }}
    />
  )
}

function TextArea({ style, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <textarea {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e => { setFocused(false); props.onBlur?.(e) }}
      style={{ ...S.input, resize: 'vertical', fontFamily: DMSANS, ...(focused ? S.inputFocused : {}), ...style }}
    />
  )
}

function SelectInput({ style, children, ...props }) {
  const [focused, setFocused] = useState(false)
  return (
    <select {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e) }}
      onBlur={e => { setFocused(false); props.onBlur?.(e) }}
      style={{ ...S.input, ...(focused ? S.inputFocused : {}), ...style }}
    >{children}</select>
  )
}

function PrimaryButton({ children, style, loading, ...props }) {
  const [hover, setHover] = useState(false)
  return (
    <button {...props} disabled={loading || props.disabled}
      onMouseEnter={e => { setHover(true); props.onMouseEnter?.(e) }}
      onMouseLeave={e => { setHover(false); props.onMouseLeave?.(e) }}
      style={{
        ...S.primaryBtn,
        ...(hover && !loading ? S.primaryBtnHover : {}),
        ...(loading ? { opacity: 0.75, cursor: 'not-allowed' } : {}),
        ...style,
      }}>
      {loading ? <Loader size={15} style={{ animation: 'plSpin 0.8s linear infinite' }} /> : children}
    </button>
  )
}

function OutlineButton({ children, style, ...props }) {
  const [hover, setHover] = useState(false)
  return (
    <button {...props}
      onMouseEnter={e => { setHover(true); props.onMouseEnter?.(e) }}
      onMouseLeave={e => { setHover(false); props.onMouseLeave?.(e) }}
      style={{ ...S.outlineBtn, ...(hover ? S.outlineBtnHover : {}), ...style }}
    >{children}</button>
  )
}

function PillButton({ active, onClick, children, icon: Icon, style }) {
  const [hover, setHover] = useState(false)
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ ...(active ? S.pillActive : S.pill), ...(hover && !active ? S.pillHover : {}), ...style }}>
      {active && <CheckCircle2 size={13} />}
      {Icon && !active && <Icon size={13} />}
      {children}
    </button>
  )
}

function PromoOption({ promo, selected, onClick }) {
  const [hover, setHover] = useState(false)
  const PromoIcon = promo.icon
  let rowStyle = { ...S.promoRow, ...(promo.premium ? S.promoRowPremium : {}) }
  if (selected)   rowStyle = { ...rowStyle, ...(promo.premium ? S.promoRowPremiumActive : S.promoRowActive) }
  else if (hover) rowStyle = { ...rowStyle, ...S.promoRowHover }
  return (
    <button type="button" onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={rowStyle}>
      <span style={{ ...S.promoIconWrap, background: promo.iconBg }}>
        <PromoIcon size={15} color={promo.iconColor} />
      </span>
      <span style={{ flex: 1 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={S.promoName}>{promo.name}</span>
          {promo.badge && <span style={S.bestValuePill}>{promo.badge}</span>}
        </span>
        <span style={S.promoDesc}>{promo.desc}</span>
        <span style={S.promoPrice}>MWK {promo.price.toLocaleString()}</span>
      </span>
      <span style={S.promoRadio(selected)} />
    </button>
  )
}

/* ── Toast notification ── */
function Toast({ message, type }) {
  if (!message) return null
  const isError = type === 'error'
  return (
    <div style={{
      position: 'fixed', top: 80, right: 24, zIndex: 9999,
      background: isError ? C.redBg : C.greenLight,
      border: `1.5px solid ${isError ? C.redBorder : '#a3d5b5'}`,
      borderLeft: `4px solid ${isError ? C.red : C.green}`,
      borderRadius: 14, padding: '14px 18px', maxWidth: 380,
      display: 'flex', alignItems: 'flex-start', gap: 10,
      boxShadow: '0 8px 24px -8px rgba(15,20,16,0.18)',
      animation: 'plSlideIn 0.25s ease',
    }}>
      <AlertCircle size={18} color={isError ? C.red : C.green} style={{ flexShrink: 0, marginTop: 1 }} />
      <p style={{ fontSize: 13.5, color: isError ? '#7f1d1d' : C.greenDeep, lineHeight: 1.5, fontWeight: 600 }}>
        {message}
      </p>
    </div>
  )
}

/* ── Upload progress bar ── */
function UploadProgress({ current, total }) {
  if (!total) return null
  const pct = Math.round((current / total) * 100)
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: C.muted, marginBottom: 4 }}>
        <span>Uploading images…</span><span>{pct}%</span>
      </div>
      <div style={{ height: 4, background: C.border, borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: GRAD.primaryBtn, transition: 'width 0.3s ease', borderRadius: 99 }} />
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Listing Guide Modal — tips for writing a successful listing
   ──────────────────────────────────────────────────────────── */
const GUIDE_TIPS = [
  {
    emoji: '📸',
    title: 'Use clear, well-lit photos',
    body: 'Upload at least 3 photos from different angles. Natural light works best. Avoid blurry or dark images — buyers skip listings without good photos.',
  },
  {
    emoji: '✏️',
    title: 'Write a descriptive title',
    body: 'Include the brand, model, and condition. e.g. "Samsung Galaxy A57 5G — 128GB, Excellent Condition" performs much better than just "Phone for sale".',
  },
  {
    emoji: '💰',
    title: 'Price it right',
    body: 'Research similar listings on SokoMW before setting your price. Competitive pricing gets 3× more views. You can always negotiate — set a fair starting price.',
  },
  {
    emoji: '📍',
    title: 'Set an accurate location',
    body: 'Buyers filter by district and city. An accurate location means your listing appears in local searches. Use "Detect Location" or pick your district manually.',
  },
  {
    emoji: '📝',
    title: 'Write a detailed description',
    body: 'Include age, usage, any defects, reason for selling, and what is included in the price. The more detail, the fewer back-and-forth questions from buyers.',
  },
  {
    emoji: '⚡',
    title: 'Respond quickly',
    body: 'Listings with fast response rates sell faster. Set your preferred contact method and check it regularly. Buyers move on quickly if they get no reply.',
  },
  {
    emoji: '🚀',
    title: 'Boost with a promotion',
    body: 'Featured listings get up to 10× more views. If you need to sell fast or reach more buyers, consider a Basic Boost or Featured Listing from the Promote section.',
  },
  {
    emoji: '🔄',
    title: 'Renew your listing',
    body: 'Listings drop in visibility after a few days. Re-edit and save your listing to push it back to the top, or use a promotion to stay visible longer.',
  },
]

function ListingGuideModal({ onClose }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9100,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, animation: 'plSlideIn 0.2s ease',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.white, borderRadius: 22, width: '100%', maxWidth: 520,
        maxHeight: '88vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 64px rgba(0,0,0,0.28)',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 22px 16px', borderBottom: `1px solid ${C.cardLine}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 style={{ fontFamily: SORA, fontSize: 18, fontWeight: 800, color: C.dark, marginBottom: 3 }}>
              How to write a great listing
            </h3>
            <p style={{ fontSize: 12.5, color: C.muted }}>Follow these tips to sell faster on Soko Malawi.</p>
          </div>
          <button onClick={onClose} style={{ background: C.surface, border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.muted, flexShrink: 0 }}>
            <X size={16} />
          </button>
        </div>

        {/* Tips list */}
        <div style={{ overflowY: 'auto', padding: '18px 22px 22px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {GUIDE_TIPS.map((tip, i) => (
            <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: C.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>
                {tip.emoji}
              </div>
              <div>
                <p style={{ fontSize: 14, fontWeight: 700, color: C.dark, marginBottom: 4 }}>{tip.title}</p>
                <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{tip.body}</p>
              </div>
            </div>
          ))}

          {/* Bottom CTA */}
          <div style={{ background: C.greenTint, border: `1px solid #c9e8d6`, borderRadius: 14, padding: '14px 16px', marginTop: 4, textAlign: 'center' }}>
            <p style={{ fontSize: 13.5, fontWeight: 700, color: C.greenDeep, marginBottom: 8 }}>
              Ready to list your item?
            </p>
            <PrimaryButton onClick={onClose} style={{ width: '100%', justifyContent: 'center' }}>
              Start My Listing
            </PrimaryButton>
          </div>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Listing Preview Modal
   Shows exactly what buyers will see before publishing
   ──────────────────────────────────────────────────────────── */
function ListingPreviewModal({ form, images, videos = [], coverIndex, location, selectedPromotion, booking, onClose, onPublish, submitting }) {
  const cover = images[coverIndex]?.url ?? images[0]?.url
  const isFeatured = selectedPromotion === 'featured' || selectedPromotion === 'premium'
  const hasBooking = booking.hourly || booking.daily || booking.weekly

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9000,
      background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '20px', animation: 'plSlideIn 0.2s ease',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: C.white, borderRadius: 22, width: '100%', maxWidth: 480,
        maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.3)',
        display: 'flex', flexDirection: 'column',
      }}>

        {/* Modal header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 14px', borderBottom: `1px solid ${C.cardLine}` }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: C.green, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 2 }}>
              👁 Live Preview
            </p>
            <h3 style={{ fontFamily: SORA, fontSize: 16, fontWeight: 700, color: C.dark }}>
              This is what buyers will see
            </h3>
          </div>
          <button onClick={onClose} style={{ background: C.surface, border: 'none', borderRadius: '50%', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: C.muted }}>
            <X size={16} />
          </button>
        </div>

        {/* Listing card preview */}
        <div style={{ padding: '20px 20px 0' }}>

          {/* Cover image */}
          <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', borderRadius: 16, overflow: 'hidden', background: C.surface, marginBottom: 16 }}>
            {cover
              ? <img src={cover} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              : (
                <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, color: C.faint }}>
                  <UploadCloud size={32} color={C.border} />
                  <span style={{ fontSize: 13, color: C.faint }}>No image uploaded</span>
                </div>
              )
            }
            {/* Condition badge */}
            <span style={{ position: 'absolute', top: 10, left: 10, background: form.condition === 'new' ? C.green : C.muted, color: C.white, fontSize: 10, fontWeight: 700, borderRadius: 6, padding: '3px 9px' }}>
              {CONDITIONS.find(c => c.key === form.condition)?.label || 'Used'}
            </span>
            {/* Featured ribbon */}
            {isFeatured && (
              <span style={{ position: 'absolute', top: 10, right: 10, display: 'flex', alignItems: 'center', gap: 4, background: `linear-gradient(135deg,${C.amber},${C.gold})`, color: C.white, fontSize: 9.5, fontWeight: 800, borderRadius: 6, padding: '3px 8px' }}>
                <Star size={9} fill="#fff" /> Featured
              </span>
            )}
            {/* Image count */}
            {images.length > 1 && (
              <span style={{ position: 'absolute', bottom: 10, right: 10, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 8px' }}>
                1 / {images.length}
              </span>
            )}
            {/* Video count */}
            {videos.length > 0 && (
              <span style={{ position: 'absolute', bottom: 10, left: 10, display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.55)', color: '#fff', fontSize: 11, fontWeight: 700, borderRadius: 6, padding: '3px 8px' }}>
                <Film size={11} /> {videos.length} video{videos.length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          {/* Image strip */}
          {images.length > 1 && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
              {images.map((img, i) => (
                <div key={i} style={{ flexShrink: 0, width: 60, height: 60, borderRadius: 10, overflow: 'hidden', border: i === 0 ? `2px solid ${C.green}` : `1px solid ${C.border}` }}>
                  <img src={img.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                </div>
              ))}
            </div>
          )}

          {/* Title & price */}
          <h2 style={{ fontFamily: SORA, fontSize: 20, fontWeight: 800, color: form.title ? C.dark : C.faint, marginBottom: 6, fontStyle: form.title ? 'normal' : 'italic' }}>
            {form.title || 'Your listing title…'}
          </h2>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
            {form.price ? (
              form.flashSaleEnabled && form.flashSalePrice ? (
                <>
                  <span style={{ fontSize: 14, fontWeight: 600, color: C.faint, textDecoration: 'line-through' }}>
                    MWK {Number(form.price).toLocaleString()}
                  </span>
                  <span style={{ fontFamily: SORA, fontSize: 26, fontWeight: 800, color: C.red, letterSpacing: '-0.02em' }}>
                    MWK {Number(form.flashSalePrice).toLocaleString()}
                  </span>
                  <span style={{ background: C.red, color: '#fff', fontSize: 10, fontWeight: 800, borderRadius: 6, padding: '3px 8px' }}>
                    🔥 Hot Deal
                  </span>
                </>
              ) : (
                <>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.faint }}>MWK</span>
                  <span style={{ fontFamily: SORA, fontSize: 26, fontWeight: 800, color: C.green, letterSpacing: '-0.02em' }}>
                    {Number(form.price).toLocaleString()}
                  </span>
                </>
              )
            ) : (
              <span style={{ fontFamily: SORA, fontSize: 20, fontWeight: 700, color: C.faint, fontStyle: 'italic' }}>Price not set</span>
            )}
          </div>

          {form.priceTiers.filter(t => t.minQty && t.price).length > 0 && (
            <div style={{ marginBottom: 14, background: C.surface, borderRadius: 12, padding: '12px 14px' }}>
              <p style={{ fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 8 }}>Bulk Pricing</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {form.priceTiers.filter(t => t.minQty && t.price).map((t, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, color: C.muted }}>
                    <span>{t.minQty}+ units</span>
                    <span style={{ fontWeight: 700, color: C.dark }}>MWK {Number(t.price).toLocaleString()} each</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {form.flashSaleEnabled && form.flashSalePrice && (
            <p style={{ fontSize: 11.5, color: C.red, fontWeight: 700, marginBottom: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
              ⏰ Deal ends {new Date(Date.now() + form.flashSaleDurationHours * 3600 * 1000).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
            </p>
          )}

          {/* Meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
            {form.category && (
              <span style={{ background: C.greenLight, color: C.green, fontSize: 12, fontWeight: 700, borderRadius: 20, padding: '4px 12px' }}>
                {form.category}{form.subcategory ? ` › ${form.subcategory}` : ''}
              </span>
            )}
            {(location.city || location.district) && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12.5, color: C.muted }}>
                <MapPin size={12} color={C.green} />
                {location.city}{location.district ? `, ${location.district}` : ''}
                {location.area ? ` — ${location.area}` : ''}
              </span>
            )}
          </div>

          {/* Description */}
          {form.description && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Description</p>
              <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {form.description}
              </p>
            </div>
          )}

          {/* Key features */}
          {form.keyFeatures && (
            <div style={{ marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Key Features</p>
              <p style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {form.keyFeatures}
              </p>
            </div>
          )}

          {/* Booking pricing */}
          {hasBooking && (
            <div style={{ background: C.surface, borderRadius: 12, padding: '14px 16px', marginBottom: 14 }}>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 10 }}>Service Pricing</p>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {booking.hourly && <div><p style={{ fontSize: 11, color: C.muted }}>Hourly</p><p style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>MWK {Number(booking.hourly).toLocaleString()}</p></div>}
                {booking.daily  && <div><p style={{ fontSize: 11, color: C.muted }}>Daily</p><p style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>MWK {Number(booking.daily).toLocaleString()}</p></div>}
                {booking.weekly && <div><p style={{ fontSize: 11, color: C.muted }}>Weekly</p><p style={{ fontSize: 14, fontWeight: 800, color: C.dark }}>MWK {Number(booking.weekly).toLocaleString()}</p></div>}
              </div>
              {booking.depositRequired && (
                <p style={{ fontSize: 11.5, color: C.amberDeep, fontWeight: 600, marginTop: 8 }}>⚠ Deposit required on booking</p>
              )}
            </div>
          )}

          {/* Seller contact */}
          <div style={{ background: C.surface, borderRadius: 12, padding: '14px 16px', marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: C.dark, marginBottom: 10 }}>Seller Contact</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {form.fullName && <p style={{ fontSize: 13.5, color: C.dark, fontWeight: 600 }}>{form.fullName}</p>}
              {form.phone    && <p style={{ fontSize: 13, color: C.muted }}>{form.phone}</p>}
              {form.whatsapp && <p style={{ fontSize: 13, color: C.muted }}>WhatsApp: {form.whatsapp}</p>}
              {form.email    && <p style={{ fontSize: 13, color: C.muted }}>{form.email}</p>}
              {!form.fullName && !form.phone && (
                <p style={{ fontSize: 13, color: C.faint, fontStyle: 'italic' }}>No contact details added yet</p>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{ padding: '14px 20px 20px', borderTop: `1px solid ${C.cardLine}`, display: 'flex', gap: 10 }}>
          <OutlineButton onClick={onClose} style={{ flex: 1, justifyContent: 'center', display: 'flex' }}>
            Edit Listing
          </OutlineButton>
          <PrimaryButton loading={submitting} onClick={onPublish} style={{ flex: 1, justifyContent: 'center', display: 'flex', gap: 6 }}>
            Publish Now <Send size={14} />
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Resume Draft Modal — asks whether to continue an unfinished listing
   ──────────────────────────────────────────────────────────── */
function ResumeDraftModal({ draft, onResume, onDiscard }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9200,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, animation: 'plSlideIn 0.2s ease',
    }}>
      <div style={{
        background: C.white, borderRadius: 20, width: '100%', maxWidth: 400,
        padding: '24px 24px 20px', boxShadow: '0 24px 64px rgba(0,0,0,0.28)', textAlign: 'center',
      }}>
        <div style={{ width: 48, height: 48, borderRadius: 14, background: C.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
          <RefreshCw size={22} color={C.green} />
        </div>
        <h3 style={{ fontFamily: SORA, fontSize: 17, fontWeight: 800, color: C.dark, marginBottom: 6 }}>
          Continue your draft?
        </h3>
        <p style={{ fontSize: 13, color: C.muted, lineHeight: 1.5, marginBottom: 20 }}>
          You have an unfinished listing{draft?.title ? ` — "${draft.title}"` : ''}. Pick up where you left off, or start a new one.
        </p>
        <div style={{ display: 'flex', gap: 10 }}>
          <OutlineButton onClick={onDiscard} style={{ flex: 1, justifyContent: 'center', display: 'flex' }}>
            Start New
          </OutlineButton>
          <PrimaryButton onClick={onResume} style={{ flex: 1, justifyContent: 'center', display: 'flex' }}>
            Continue Draft
          </PrimaryButton>
        </div>
      </div>
    </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Main component
   ──────────────────────────────────────────────────────────── */export default function PostListing() {
  const navigate = useNavigate()
  const { id: editId } = useParams()
  const isEditMode = !!editId
  const [loadingExisting, setLoadingExisting] = useState(isEditMode)
  const fileInputRef = useRef(null)
  const mapContainerRef = useRef(null)
  const mapInstanceRef  = useRef(null)
  const mapMarkerRef    = useRef(null)
  const imagesRef      = useRef(null)  
  const basicInfoRef   = useRef(null)
  const contactRef     = useRef(null)
  
  const locationRef    = useRef(null)
  const promotionRef   = useRef(null)

  const scrollToRef = (ref) => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  /* Auth */
  const [user, setUser] = useState(null)
  const [profileName, setProfileName] = useState('')
  const [myShops, setMyShops] = useState([])          // all shops owned by this user
  const [selectedShopId, setSelectedShopId] = useState(null) // shop.id | 'personal' | null

  /* Images & Videos */
  const [images, setImages]         = useState([])   // { file, url }[]
  const [videos, setVideos]         = useState([])   // { file, url }[]
  const [coverIndex, setCoverIndex] = useState(0)
  const [dragActive, setDragActive] = useState(false)
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 })
  const MAX_IMAGES = 10
  const MAX_VIDEOS = 2
  const MAX_VIDEO_MB = 60

  /* Form */
  const [form, setForm] = useState({
    title: '', category: '', subcategory: '', condition: 'new',
    description: '', keyFeatures: '', price: '',
    fullName: '', phone: '', whatsapp: '', email: '',
    availability: 'in_stock', contactMethods: ['chat'],
    callNumber: '', whatsappNumber: '',
    flashSaleEnabled: false, flashSalePrice: '', flashSaleDurationHours: 24,
    priceTiers: [], // [{ minQty: '', price: '' }]
  })

  /* Location */
  const [location, setLocation] = useState({
    city: '', district: '', area: '', lat: null, lng: null,
    detected: false, detecting: false,
  })
  const [locationConfirmed, setLocationConfirmed] = useState(false)
  const [customSubcategory, setCustomSubcategory] = useState('')

  /* Promotion / booking / misc */
  const [selectedPromotion, setSelectedPromotion] = useState('none')
  const [featuredDuration, setFeaturedDuration] = useState(7) // 3 | 7 | 30
  const [freeFeatureCount, setFreeFeatureCount] = useState(5) // assume no free slots left until checked
  const [freeFeaturedEnabled, setFreeFeaturedEnabled] = useState(true)
  const FREE_FEATURE_LIMIT = 5
  const hasFreeFeatureLeft = freeFeaturedEnabled && freeFeatureCount < FREE_FEATURE_LIMIT
  const [booking, setBooking]         = useState({ hourly: '', daily: '', weekly: '', depositRequired: false })
  const [buyersLookingFor, setBuyersLookingFor] = useState(true)
  const [calendarMonth, setCalendarMonth] = useState(new Date().getMonth())
  const [calendarYear,  setCalendarYear]  = useState(new Date().getFullYear())
  const [selectedDates, setSelectedDates] = useState([])

  /* UI state */
   const [submitting, setSubmitting] = useState(false)
  const [savingDraft, setSavingDraft] = useState(false)
  const draftIdRef = useRef(isEditMode ? editId : null)
  const [toast, setToast]           = useState({ message: '', type: 'error' })
  const [showGuide, setShowGuide] = useState(false)
  const [pendingDraft, setPendingDraft] = useState(null) // draft row found on mount, awaiting user's choice
  const [checkingDraft, setCheckingDraft] = useState(false)
  const showToast = (message, type = 'error', duration = 4500) => {
    setToast({ message, type })
    setTimeout(() => setToast({ message: '', type: 'error' }), duration)
  }

  /* ── Fetch current user on mount ── */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  /* ── Fetch seller's profile name + all owned shops once user is known ── */
  useEffect(() => {
    if (!user) return
    let cancelled = false

    supabase.from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data?.full_name) setProfileName(data.full_name)
      })

    supabase.from('shops')
      .select('id, name, phone, whatsapp, logo_url, is_verified')
      .eq('owner_id', user.id)
      .then(({ data }) => {
        if (cancelled) return
        const shops = data || []
        setMyShops(shops)
        // Default: first shop if any exist, otherwise personal info
        setSelectedShopId(shops.length > 0 ? shops[0].id : 'personal')
      })

    return () => { cancelled = true }
  }, [user])

  /* ── Auto-fill contact fields whenever the selected shop/personal option changes ── */
  useEffect(() => {
    if (selectedShopId === null) return
    if (selectedShopId === 'personal') {
      setForm(f => ({ ...f, fullName: profileName || f.fullName, phone: '', whatsapp: '' }))
      return
    }
    const shop = myShops.find(s => s.id === selectedShopId)
    if (shop) {
      setForm(f => ({
        ...f,
        fullName: shop.name || f.fullName,
        phone: shop.phone || '',
        whatsapp: shop.whatsapp || '',
      }))
    }
  }, [selectedShopId, myShops, profileName])

  /* ── Load Leaflet (CDN) once ── */
  useEffect(() => {
    if (window.L) return
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.async = true
    document.body.appendChild(script)
  }, [])

  /* ── Init / update Leaflet map whenever coordinates change ── */
  useEffect(() => {
    if (!location.lat || !location.lng) return

    const initOrUpdate = () => {
      const L = window.L
      if (!L || !mapContainerRef.current) return

      if (!mapInstanceRef.current) {
        mapInstanceRef.current = L.map(mapContainerRef.current, {
          zoomControl: false,
          attributionControl: true,
        }).setView([location.lat, location.lng], 15)

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap',
          maxZoom: 19,
        }).addTo(mapInstanceRef.current)

        mapInstanceRef.current.attributionControl.setPrefix(false)

        const pinIcon = L.divIcon({
          className: '',
          html: `<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;background:${C.green};transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 3px 8px rgba(15,20,16,0.35)"></div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 26],
        })
        mapMarkerRef.current = L.marker([location.lat, location.lng], { icon: pinIcon }).addTo(mapInstanceRef.current)
      } else {
        mapInstanceRef.current.setView([location.lat, location.lng], 15)
        mapMarkerRef.current.setLatLng([location.lat, location.lng])
      }
    }

    if (window.L) {
      initOrUpdate()
    } else {
      const interval = setInterval(() => {
        if (window.L) { clearInterval(interval); initOrUpdate() }
      }, 150)
      return () => clearInterval(interval)
    }
  }, [location.lat, location.lng])

  /* ── Auto-detect location on mount ── */
  const detectLocation = () => {    setLocation(l => ({ ...l, detecting: true }))
    setLocationConfirmed(false)
    if (!navigator.geolocation) {
      setLocation({ city: 'Lilongwe', district: 'Lilongwe District', area: '', lat: -13.9626, lng: 33.7741, detected: true, detecting: false })
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords
        fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&zoom=14&accept-language=en`,
          { headers: { 'Accept-Language': 'en' } }
        )
          .then(r => r.json())
          .then(data => {
            const addr = data.address || {}

            // City — administrative names only, never amenity/POI
            const city =
              addr.city ||
              addr.town ||
              addr.city_district ||
              addr.municipality ||
              addr.village ||
              addr.hamlet || ''

            // District — prefer county/state_district for Malawi divisions
            const district =
              addr.county ||
              addr.state_district ||
              (addr.state && addr.state !== 'Malawi' ? addr.state : '') || ''

            // Area — neighbourhood/suburb (e.g. "Area 25"), not building/amenity
            const area =
              addr.suburb ||
              addr.neighbourhood ||
              addr.quarter ||
              addr.residential ||
              addr.borough ||
              addr.village || ''

            setLocation({ city, district, area, lat, lng, detected: true, detecting: false })
          })
          .catch(() => {
            // Nominatim failed — keep coordinates, let user fill names manually
            setLocation({ city: '', district: '', area: '', lat, lng, detected: false, detecting: false })
          })
      },
      () => {
        // GPS denied — default to Lilongwe centre
        setLocation({ city: 'Lilongwe', district: 'Lilongwe District', area: '', lat: -13.9626, lng: 33.7741, detected: true, detecting: false })
      },
      { timeout: 10000, enableHighAccuracy: true }
    )
  }

  useEffect(() => { if (!isEditMode) detectLocation() }, [])

  /* ── Edit mode: load the existing listing and prefill everything ── */
  useEffect(() => {
    if (!isEditMode || !user) return
    let cancelled = false
    supabase.from('listings').select('*').eq('id', editId).single().then(({ data, error }) => {
      if (cancelled || error || !data) { if (!cancelled) setLoadingExisting(false); return }
      if (data.seller_id !== user.id) {
        showToast('You can only edit your own listings.')
        navigate('/listings/' + editId)
        return
      }

      setForm(f => ({
        ...f,
        title: data.title || '',
        category: data.category || '',
        subcategory: data.subcategory || '',
        condition: data.condition || 'new',
        description: data.description || '',
        keyFeatures: data.key_features || '',
        price: data.price != null ? String(data.price) : '',
        fullName: data.seller_name || f.fullName,
        phone: data.phone || '',
        whatsapp: data.seller_whatsapp || '',
        email: data.seller_email || '',
        availability: data.availability_status || 'in_stock',
        contactMethods: data.contact_methods?.length ? data.contact_methods : f.contactMethods,
        callNumber: data.call_number || '',
        whatsappNumber: data.whatsapp_number || '',
        flashSaleEnabled: !!data.flash_sale_price,
        flashSalePrice: data.flash_sale_price != null ? String(data.flash_sale_price) : '',
        flashSaleDurationHours: 24,
        priceTiers: (data.price_tiers || []).map(t => ({ minQty: String(t.min_qty), price: String(t.price) })),
      }))

      setImages((data.images || []).map(url => ({ file: null, url })))
      setVideos((data.videos || []).map(url => ({ file: null, url })))

      setLocation({
        city: data.city || '', district: data.district || '', area: data.area || '',
        lat: data.latitude || null, lng: data.longitude || null,
        detected: true, detecting: false,
      })
      setLocationConfirmed(true)

      setSelectedPromotion(data.promotion_type || 'none')
      setBooking({
        hourly: data.booking_hourly != null ? String(data.booking_hourly) : '',
        daily:  data.booking_daily  != null ? String(data.booking_daily)  : '',
        weekly: data.booking_weekly != null ? String(data.booking_weekly) : '',
        depositRequired: !!data.booking_deposit_required,
      })
      setBuyersLookingFor(data.buyers_looking_for ?? true)
      setSelectedDates(data.availability_dates || [])

      setLoadingExisting(false)
    })
    return () => { cancelled = true }
  }, [isEditMode, editId, user])

  /* ── On a fresh Post Listing visit, check if the user has an unfinished draft ── */
  useEffect(() => {
    if (isEditMode || !user) return
    let cancelled = false
    setCheckingDraft(true)
    supabase.from('listings')
      .select('*')
      .eq('seller_id', user.id)
      .eq('status', 'draft')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return
        setCheckingDraft(false)
        if (data) setPendingDraft(data)
      })
    return () => { cancelled = true }
  }, [isEditMode, user])

  /* ── Fill the form from a draft row (used by the resume prompt) ── */
  const loadDraftIntoForm = (data) => {
    draftIdRef.current = data.id
    setForm(f => ({
      ...f,
      title: data.title || '',
      category: data.category || '',
      subcategory: data.subcategory || '',
      condition: data.condition || 'new',
      description: data.description || '',
      keyFeatures: data.key_features || '',
      price: data.price != null ? String(data.price) : '',
      fullName: data.seller_name || f.fullName,
      phone: data.phone || '',
      whatsapp: data.seller_whatsapp || '',
      email: data.seller_email || '',
      availability: data.availability_status || 'in_stock',
      contactMethods: data.contact_methods?.length ? data.contact_methods : f.contactMethods,
      callNumber: data.call_number || '',
      whatsappNumber: data.whatsapp_number || '',
      flashSaleEnabled: !!data.flash_sale_price,
      flashSalePrice: data.flash_sale_price != null ? String(data.flash_sale_price) : '',
      flashSaleDurationHours: 24,
      priceTiers: (data.price_tiers || []).map(t => ({ minQty: String(t.min_qty), price: String(t.price) })),
    }))
    setImages((data.images || []).map(url => ({ file: null, url })))
    setVideos((data.videos || []).map(url => ({ file: null, url })))
    if (data.city || data.district) {
      setLocation({
        city: data.city || '', district: data.district || '', area: data.area || '',
        lat: data.latitude || null, lng: data.longitude || null,
        detected: true, detecting: false,
      })
      setLocationConfirmed(true)
    }
    setSelectedPromotion(data.promotion_type || 'none')
    setBooking({
      hourly: data.booking_hourly != null ? String(data.booking_hourly) : '',
      daily:  data.booking_daily  != null ? String(data.booking_daily)  : '',
      weekly: data.booking_weekly != null ? String(data.booking_weekly) : '',
      depositRequired: !!data.booking_deposit_required,
    })
    setBuyersLookingFor(data.buyers_looking_for ?? true)
    setSelectedDates(data.availability_dates || [])
  }

  const handleResumeDraft = () => {
    if (pendingDraft) loadDraftIntoForm(pendingDraft)
    setPendingDraft(null)
    navigate(`/post/edit/${pendingDraft.id}`, { replace: true })
  }

  const handleDiscardDraftPrompt = async () => {
    if (pendingDraft) {
      await supabase.from('listings').delete().eq('id', pendingDraft.id)
    }
    setPendingDraft(null)
  }

  /* ── Check global free-feature toggle + seller's own eligibility ── */  useEffect(() => {
    supabase.from('app_settings').select('value').eq('key', 'free_featured_enabled').maybeSingle()
      .then(({ data }) => setFreeFeaturedEnabled(data ? data.value === true : true))
  }, [])

  useEffect(() => {
    if (!user) return
    supabase.from('listing_promotions')
      .select('id', { count: 'exact', head: true })
      .eq('seller_id', user.id)
      .eq('promotion_type', 'featured')
      .eq('price_mwk', 0)
      .then(({ count }) => setFreeFeatureCount(count || 0))
  }, [user])

  /* ── Image & video helpers ── */
  const addFiles = useCallback((fileList) => {
    const files = Array.from(fileList)
    const newImages = []
    const newVideos = []
    let rejectedSize = false

    files.forEach(file => {
      if (file.type.startsWith('video/')) {
        if (file.size > MAX_VIDEO_MB * 1024 * 1024) { rejectedSize = true; return }
        newVideos.push({ file, url: URL.createObjectURL(file) })
      } else if (file.type.startsWith('image/')) {
        newImages.push({ file, url: URL.createObjectURL(file) })
      }
    })

    if (newImages.length) setImages(prev => [...prev, ...newImages].slice(0, MAX_IMAGES))
    if (newVideos.length) setVideos(prev => [...prev, ...newVideos].slice(0, MAX_VIDEOS))
    if (rejectedSize) showToast(`Some videos were skipped — max size is ${MAX_VIDEO_MB}MB each.`)
  }, [images.length, videos.length])

  const handleDrop = (e) => {
    e.preventDefault(); setDragActive(false)
    if (e.dataTransfer.files?.length) addFiles(e.dataTransfer.files)
  }
  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx))
    setCoverIndex(prev => {
      if (idx === prev) return 0
      if (idx < prev) return prev - 1
      return prev
    })
  }
  const removeVideo = (idx) => {
    setVideos(prev => prev.filter((_, i) => i !== idx))
  }

  /* ── Upload all images to Supabase Storage ── */
  const uploadImages = async (listingId) => {
    const ordered = coverIndex > 0
      ? [images[coverIndex], ...images.filter((_, i) => i !== coverIndex)]
      : images
    const urls = []
    setUploadProgress({ current: 0, total: ordered.length })
    for (let i = 0; i < ordered.length; i++) {
      const { file, url: existingUrl } = ordered[i]
      if (!file) { urls.push(existingUrl); setUploadProgress({ current: i + 1, total: ordered.length }); continue }
      const ext  = file.name.split('.').pop().toLowerCase()
      const path = `${user.id}/${listingId}/${Date.now()}-${i}.${ext}`
      const { error } = await supabase.storage
        .from('listing-images')
        .upload(path, file, { cacheControl: '3600', upsert: false })
      if (!error) {
        const { data: { publicUrl } } = supabase.storage
          .from('listing-images')
          .getPublicUrl(path)
        urls.push(publicUrl)
      }
      setUploadProgress({ current: i + 1, total: ordered.length })
    }
    setUploadProgress({ current: 0, total: 0 })
    return urls
  }

  /* ── Upload all videos to Supabase Storage ── */
  const uploadVideos = async (listingId) => {
    if (videos.length === 0) return []
    const urls = []
    let failCount = 0
    setUploadProgress({ current: 0, total: videos.length })
    for (let i = 0; i < videos.length; i++) {
      const { file, url: existingUrl } = videos[i]
      if (!file) { urls.push(existingUrl); setUploadProgress({ current: i + 1, total: videos.length }); continue }
      const ext  = file.name.split('.').pop().toLowerCase()
      const path = `${user.id}/${listingId}/${Date.now()}-vid-${i}.${ext}`
      const { error } = await supabase.storage
        .from('listing-videos')
        .upload(path, file, { cacheControl: '3600', upsert: false })
      if (!error) {
        const { data: { publicUrl } } = supabase.storage
          .from('listing-videos')
          .getPublicUrl(path)
        urls.push(publicUrl)
      } else {
        failCount++
        console.error('Video upload failed:', error.message, error)
      }
      setUploadProgress({ current: i + 1, total: videos.length })
    }
    setUploadProgress({ current: 0, total: 0 })
    if (failCount > 0) {
      showToast(`${failCount} video${failCount > 1 ? 's' : ''} failed to upload — check Storage bucket permissions.`)
    }
    return urls
  }

  /* ── Build the DB row ── */
  const buildRow = (imageUrls, videoUrls, status) => ({
    seller_id:                user.id,
    title:                    form.title.trim(),
    category:                 form.category,
    subcategory:              form.subcategory || null,
    condition:                form.condition,
    description:              form.description.trim(),
    key_features:             form.keyFeatures.trim() || null,
    price:                    parseFloat(form.price),
    flash_sale_price:         form.flashSaleEnabled && form.flashSalePrice ? parseFloat(form.flashSalePrice) : null,
    flash_sale_expires_at:    form.flashSaleEnabled && form.flashSalePrice
                                ? new Date(Date.now() + form.flashSaleDurationHours * 3600 * 1000).toISOString()
                                : null,
    price_tiers:              form.priceTiers.filter(t => t.minQty && t.price).map(t => ({ min_qty: Number(t.minQty), price: Number(t.price) })),
    promo_badge:              form.flashSaleEnabled && form.flashSalePrice ? 'sale' : null,
    seller_name:              form.fullName.trim() || null,
    phone:                    form.phone.trim() || null,
    seller_whatsapp:          form.whatsapp.trim() || null,
    seller_email:             form.email.trim() || null,
    availability_status:      form.availability,
    contact_methods:          form.contactMethods,
    call_number:              form.callNumber.trim() || null,
    whatsapp_number:          form.whatsappNumber.trim() || null,
    city:                     location.city || null,
    district:                 location.district || null,
    area:                     location.area || null,
    latitude:                 location.lat || null,
    longitude:                location.lng || null,
    images:                   imageUrls,
    videos:                   videoUrls,
    promotion_type:           selectedPromotion,
    is_featured:              selectedPromotion === 'featured' || selectedPromotion === 'premium',
    booking_hourly:           booking.hourly  ? parseFloat(booking.hourly)  : null,
    booking_daily:            booking.daily   ? parseFloat(booking.daily)   : null,
    booking_weekly:           booking.weekly  ? parseFloat(booking.weekly)  : null,
    booking_deposit_required: booking.depositRequired,
    availability_dates:       selectedDates,
    buyers_looking_for:       buyersLookingFor,
    status,
  })

  /* ── Record promotion — free tier activates instantly, paid tiers go through PayChangu ── */
  const recordPromotion = async (listingId, promotionId) => {
    if (promotionId !== 'featured') return

    console.log('[recordPromotion] hasFreeFeatureLeft:', hasFreeFeatureLeft, 'featuredDuration:', featuredDuration)
    if (hasFreeFeatureLeft) {
      const { data, error } = await supabase.rpc('request_feature_listing', {
        p_listing_id: listingId,
        p_duration_days: featuredDuration,
      })
      if (error) { showToast(`Featuring failed: ${error.message}`); throw error }
      return data
    }

    // Paid tier — create pending row, then redirect to PayChangu
    console.log('[recordPromotion] calling request_feature_listing_payment for listing', listingId)
    const { data: reqData, error: reqErr } = await supabase.rpc('request_feature_listing_payment', {
      p_listing_id: listingId,
      p_duration_days: featuredDuration,
    })
    if (reqErr) { showToast(`Could not start payment: ${reqErr.message}`); throw reqErr }
    console.log('[recordPromotion] reqData:', reqData)

    const baseUrl = window.location.origin
    const { data: fnData, error: fnErr } = await supabase.functions.invoke('initiate-payment', {
      body: {
        seller_id: user.id,
        email: user.email || '',
        first_name: profileName?.split(' ')[0] || 'Seller',
        last_name: profileName?.split(' ')[1] || '',
        tx_ref: reqData.tx_ref,
        callback_url: `${baseUrl}/verify-payment`,
        return_url: `${baseUrl}/verify-payment`,
        amount: reqData.price,
        purpose: 'featured_listing',
        title: 'SokoMW Featured Listing',
        description: `Feature listing for ${featuredDuration} days`,
        listing_id: listingId,
      },
    })
    if (fnErr || !fnData?.data?.checkout_url) { showToast('Payment redirect failed.'); throw new Error('no checkout url') }

    window.location.href = fnData.data.checkout_url
    return { redirecting: true }
  }

   /* ── Save as draft (creates once, then updates the same row on every subsequent save) ── */
  const handleSaveDraft = async () => {
    if (!user) { showToast('Sign in to save a draft.'); return }
    setSavingDraft(true)
    try {
      let draftId = draftIdRef.current

      if (!draftId) {
        // First save — create the draft row
        const { data: draft, error } = await supabase
          .from('listings')
          .insert([buildRow([], [], 'draft')])
          .select('id')
          .single()
        if (error) throw error
        draftId = draft.id
        draftIdRef.current = draftId
        // Move the URL to the edit route for this draft so it's retrievable later
        navigate(`/post/edit/${draftId}`, { replace: true })
      } else {
        // Already have a draft — update it in place instead of creating a duplicate
        const { error } = await supabase
          .from('listings')
          .update(buildRow([], [], 'draft'))
          .eq('id', draftId)
        if (error) throw error
      }

      // Upload any new images/videos so the draft reflects the latest media
      if (images.some(i => i.file) || videos.some(v => v.file)) {
        const [imgUrls, vidUrls] = await Promise.all([uploadImages(draftId), uploadVideos(draftId)])
        const patch = {}
        if (imgUrls.length) patch.images = imgUrls
        if (vidUrls.length) patch.videos = vidUrls
        if (Object.keys(patch).length) await supabase.from('listings').update(patch).eq('id', draftId)
      }
      showToast('Draft saved successfully.', 'success')
    } catch (err) {
      showToast(err.message || 'Failed to save draft.')
    } finally {
      setSavingDraft(false)
    }
  }
  /* ── Publish ── */
  const handlePublish = async () => {
    if (!user) { showToast('Please sign in to post a listing.'); return }
    const errs = validate(form, images)
    if (errs.length) { showToast(errs[0]); return }

    setSubmitting(true)
    try {
      // 1. Insert (new) or update (edit mode) — images/videos patched after upload
      let listing
      if (isEditMode) {
        const { data, error: updateErr } = await supabase
          .from('listings')
          .update(buildRow([], [], 'published'))
          .eq('id', editId)
          .select('id')
          .single()
        if (updateErr) throw updateErr
        listing = data
      } else {
        const { data, error: insertErr } = await supabase
          .from('listings')
          .insert([buildRow([], [], 'published')])
          .select('id')
          .single()
        if (insertErr) throw insertErr
        listing = data
      }

      // 2. Upload images & videos → patch listing
      const [imageUrls, videoUrls] = await Promise.all([uploadImages(listing.id), uploadVideos(listing.id)])
      const mediaPatch = {}
      if (imageUrls.length) mediaPatch.images = imageUrls
      if (videoUrls.length) mediaPatch.videos = videoUrls
      if (Object.keys(mediaPatch).length) {
        const { error: updateErr } = await supabase
          .from('listings')
          .update(mediaPatch)
          .eq('id', listing.id)
        if (updateErr) throw updateErr
      }

      // 3. Record promotion if any (only for new listings — edits don't re-trigger charges)
      let redirectingToPayment = false
      if (!isEditMode && selectedPromotion !== 'none') {
        try {
          const result = await recordPromotion(listing.id, selectedPromotion)
          if (result?.redirecting) redirectingToPayment = true
        } catch {
          // Listing is still published — just not featured. User already saw the toast.
        }
      }

      if (redirectingToPayment) return // window.location.href is taking over — don't touch the DOM further

      showToast(isEditMode ? 'Listing updated successfully!' : 'Listing published successfully!', 'success', 2000)
      setTimeout(() => navigate(`/listings/${listing.id}`), 2000)
    } catch (err) {
      showToast(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Calendar helpers ── */
  const daysInMonth  = new Date(calendarYear, calendarMonth + 1, 0).getDate()
  const firstWeekday = new Date(calendarYear, calendarMonth, 1).getDay()
  const calendarCells = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const toggleDate = (day) => {
    if (!day) return
    const key = `${calendarYear}-${calendarMonth}-${day}`
    setSelectedDates(prev => prev.includes(key) ? prev.filter(d => d !== key) : [...prev, key])
  }
  const changeMonth = (delta) => {
    let m = calendarMonth + delta, y = calendarYear
    if (m < 0)  { m = 11; y -= 1 }
    if (m > 11) { m = 0;  y += 1 }
    setCalendarMonth(m); setCalendarYear(y)
  }

  const updateForm = (key, value) => setForm(f => ({ ...f, [key]: value }))

  const addPriceTier = () => {
    setForm(f => ({ ...f, priceTiers: [...f.priceTiers, { minQty: '', price: '' }] }))
  }
  const updatePriceTier = (idx, key, value) => {
    setForm(f => ({
      ...f,
      priceTiers: f.priceTiers.map((t, i) => i === idx ? { ...t, [key]: value } : t),
    }))
  }
  const removePriceTier = (idx) => {
    setForm(f => ({ ...f, priceTiers: f.priceTiers.filter((_, i) => i !== idx) }))
  }

  /* ── Guarantee Chat is always included as a contact method ── */
  useEffect(() => {
    setForm(f => f.contactMethods.includes('chat') ? f : { ...f, contactMethods: ['chat', ...f.contactMethods] })
  }, [])

  /* ── Live section completion tracking for the progress bar ── */
  const sectionsComplete = {
    images:   images.length > 0,
    basic:    !!(form.title.trim() && form.category && form.price && form.description.trim()),
    contact:  !!(form.fullName.trim() && (form.contactMethods.includes('call') ? form.callNumber.trim() : true)
                 && (form.contactMethods.includes('whatsapp') ? form.whatsappNumber.trim() : true)
                 && (form.contactMethods.includes('email') ? form.email.trim() : true)),
    location: !!(location.city && locationConfirmed),
    promotion: true, // always "complete" since it's optional
  }
  const completedCount = Object.values(sectionsComplete).filter(Boolean).length
  const totalSections = Object.keys(sectionsComplete).length
  const progressPct = Math.round((completedCount / totalSections) * 100)

  /* ── Collect all known numbers (personal + every owned shop) for the picker ── */
  const availableNumbers = (() => {
    const list = []
    if (form.phone)    list.push({ label: `${form.phone} (My Phone)`, value: form.phone })
    if (form.whatsapp) list.push({ label: `${form.whatsapp} (My WhatsApp)`, value: form.whatsapp })
    myShops.forEach(s => {
      if (s.phone)    list.push({ label: `${s.phone} (${s.name})`, value: s.phone })
      if (s.whatsapp) list.push({ label: `${s.whatsapp} (${s.name})`, value: s.whatsapp })
    })
    // De-duplicate by value
    return list.filter((item, i) => list.findIndex(x => x.value === item.value) === i)
  })()

  const toggleContactMethod = (key) => {
    if (key === 'chat') return // Chat is always on — promote in-app messaging
    setForm(f => {
      const has = f.contactMethods.includes(key)
      const next = has ? f.contactMethods.filter(m => m !== key) : [...f.contactMethods, key]
      const patch = { contactMethods: next }
      // Auto-select a sensible default number/email when a method is newly enabled
      if (!has && key === 'call' && !f.callNumber) patch.callNumber = f.phone || f.whatsapp || ''
      if (!has && key === 'whatsapp' && !f.whatsappNumber) patch.whatsappNumber = f.whatsapp || f.phone || ''
      if (!has && key === 'email' && !f.email) patch.email = profileName ? '' : f.email
      return { ...f, ...patch }
    })
  }

  /* ────────────────────────────────────────────────────────
     Render
     ──────────────────────────────────────────────────────── */
  if (loadingExisting) {
    return (
      <div style={{ ...S.page, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader size={28} color={C.green} style={{ animation: 'plSpin 0.8s linear infinite' }} />
      </div>
    )
  }

  return (
    <div style={S.page} className="pl-page">
      <style>{`
        @keyframes plSpin    { to { transform: rotate(360deg) } }
        @keyframes plPop     { 0% { transform: scale(0); opacity: 0 } 60% { transform: scale(1.2) } 100% { transform: scale(1); opacity: 1 } }
        @keyframes plPulse   { 0%,100% { box-shadow: 0 0 0 0 rgba(29,78,216,0.28) } 50% { box-shadow: 0 0 0 9px rgba(29,78,216,0) } }
        @keyframes plSlideIn { from { opacity: 0; transform: translateX(16px) } to { opacity: 1; transform: none } }
        .pl-grid { display: grid; grid-template-columns: 224px 1fr 344px; gap: 24px; align-items: start; }
        .pl-sidebar {
          position: sticky;
          top: 84px;
          max-height: calc(100vh - 104px - 76px);
          overflow-y: auto;
          overflow-x: hidden;
          padding-right: 4px;
          scrollbar-width: thin;
          scrollbar-color: ${C.border} transparent;
        }
        .pl-sidebar::-webkit-scrollbar { width: 6px; }
        .pl-sidebar::-webkit-scrollbar-track { background: transparent; }
        .pl-sidebar::-webkit-scrollbar-thumb { background: ${C.border}; border-radius: 10px; }
        .pl-sidebar::-webkit-scrollbar-thumb:hover { background: #b8c9bd; }
        @media (max-width: 1100px) {
          .pl-sidebar { position: static; max-height: none; overflow: visible; padding-right: 0; }
        }
        .pl-pulse-ring { animation: plPulse 2.2s ease-in-out infinite; }
        .pl-search-wrap { transition: border-color .15s ease, background .15s ease, box-shadow .15s ease; }
        .pl-search-wrap:focus-within { border-color: ${C.green} !important; background: #fff !important; box-shadow: ${SHADOW.focusRing}; }
        .pl-page button, .pl-page input, .pl-page textarea, .pl-page select { font-family: ${DMSANS}; }
        .pl-page button:focus-visible, .pl-page input:focus-visible,
        .pl-page textarea:focus-visible, .pl-page select:focus-visible {
          outline: 2px solid ${C.green}; outline-offset: 2px;
        }
        @media (max-width: 1100px) { .pl-grid { grid-template-columns: 1fr; } }
        @media (max-width: 720px)  {
          .pl-row1 { flex-wrap: wrap; }
          .pl-search-wrap { order: 3; max-width: 100% !important; flex-basis: 100%; }
        }
        @media (prefers-reduced-motion: reduce) {
          .pl-page *, .pl-page *::before, .pl-page *::after {
            animation-duration: .001ms !important; transition-duration: .001ms !important;
          }
        }
        html { scroll-behavior: smooth; }
        .leaflet-control-attribution { font-size: 9px !important; background: rgba(255,255,255,0.75) !important; padding: 1px 4px !important; }
        .leaflet-control-zoom { display: none !important; }
      `}</style>

      <Toast message={toast.message} type={toast.type} />

      {/* ── Live progress bar ── */}
      <div style={S.progressBarOuter}>
        <div style={{ ...S.progressBarFill, width: `${progressPct}%` }} />
      </div>

      {/* ── Header ── */}
      <header style={S.headerOuter}>
        <div style={S.headerRow1} className="pl-row1">
          <div style={{ cursor: 'pointer', flexShrink: 0 }} onClick={() => navigate('/')}>
            <div style={S.brand}><span style={{ color: C.green }}>Soko</span><span style={{ color: C.gold }}>Mw</span></div>
            <div style={S.tagline}>Buy, Sell, Find. Anywhere in Malawi.</div>
          </div>

          <div style={S.searchWrap} className="pl-search-wrap">
            <Search size={16} color={C.muted} style={{ flexShrink: 0 }} />
            <input style={S.searchInput} placeholder="Search for anything (e.g. iPhone, Toyota, jobs, services...)" />
            <PrimaryButton style={{ padding: '9px 20px', borderRadius: 18, boxShadow: 'none' }}>Search</PrimaryButton>
          </div>

          <div style={S.navActions}>
            <button style={S.navBtn}><MessageCircle size={19} /><span style={S.navBtnLabel}>Chats</span></button>
            <button style={S.navBtn}><Bell size={19} /><span style={S.navBtnLabel}>Alerts</span></button>
            <PrimaryButton style={{ borderRadius: 20, padding: '10px 18px' }}><Plus size={15} /> Sell Now</PrimaryButton>
            <div style={S.avatar}><User size={17} color="#8a9e8f" /></div>
          </div>
        </div>

        <nav style={S.tabsRow}>
          {NAV_TABS.map(tab => {
            const TabIcon = tab.icon
            return (
              <button key={tab.label} onClick={() => tab.path && navigate(tab.path)} style={tab.active ? S.tabActive : S.tab}>
                <TabIcon size={15} /> {tab.label}
              </button>
            )
          })}
        </nav>
      </header>

      {/* ── Page container ── */}
      <div style={S.container}>
        <div style={S.breadcrumb}>
          <Home size={12} /> <span>Marketplace</span> <ChevronRight size={12} />
          <span style={{ color: C.dark, fontWeight: 600 }}>Post a Listing</span>
        </div>

     <div style={S.pageHeadRow}>
          <h1 style={S.h1}>{isEditMode ? 'Edit Listing' : 'Post a New Listing'}</h1>
          <OutlineButton onClick={handleSaveDraft} disabled={savingDraft}>
            {savingDraft ? 'Saving…' : 'Save as Draft'}
          </OutlineButton>
        </div>
        <p style={S.subtitle}>
          {isEditMode ? 'Update the details below and republish your listing.' : 'Fill in the details below to list your item or service on Soko Malawi.'}
        </p>

        {/* Warn if not signed in */}
        {!user && (
          <div style={S.authWarning}>
            <AlertCircle size={16} color={C.amberDeep} />
            <span>You need to <strong>sign in</strong> before you can publish or save a listing.</span>
          </div>
        )}

        <div className="pl-grid">
          {/* ══ LEFT ══ */}
          <aside className="pl-sidebar">
            {/* Hot Deal flash sale — advanced */}
            <Card style={{ marginBottom: 16, background: C.redBg, border: `1.5px solid ${C.redBorder}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg,#fecaca,#fee2e2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <TrendingUp size={17} color={C.red} />
                  </span>
                  <h2 style={{ ...S.cardTitle, fontSize: 15.5 }}>Hot Deal</h2>
                </div>
                <Toggle checked={form.flashSaleEnabled} onChange={v => updateForm('flashSaleEnabled', v)} />
              </div>

              {!form.flashSaleEnabled ? (
                <p style={{ fontSize: 12, color: C.muted }}>Turn on to run a time-limited discount with a "🔥 Hot Deal" badge.</p>
              ) : (
                <>
                  {/* Original price reference */}
                  <div style={{ marginBottom: 12, background: 'rgba(255,255,255,0.6)', borderRadius: 10, padding: '10px 12px' }}>
                    <p style={{ fontSize: 11, color: C.muted, marginBottom: 2 }}>Original Price</p>
                    <p style={{ fontSize: 15, fontWeight: 700, color: C.dark }}>
                      {form.price ? `MWK ${Number(form.price).toLocaleString()}` : 'Set your price above first'}
                    </p>
                  </div>

                  <Field label="Flash Sale Price (MWK)">
                    <TextInput type="number" min="0" placeholder="e.g. 120000"
                      value={form.flashSalePrice}
                      onChange={e => updateForm('flashSalePrice', e.target.value)} />
                  </Field>

                  {/* Live discount summary */}
                  {form.price && form.flashSalePrice && Number(form.flashSalePrice) < Number(form.price) && (
                    <div style={{
                      marginTop: 10, display: 'flex', alignItems: 'center', gap: 10,
                      background: 'linear-gradient(135deg,#fee2e2,#fecaca)', borderRadius: 12, padding: '10px 14px',
                    }}>
                      <span style={{
                        fontFamily: SORA, fontSize: 20, fontWeight: 800, color: C.red,
                      }}>
                        -{Math.round((1 - Number(form.flashSalePrice) / Number(form.price)) * 100)}%
                      </span>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 700, color: '#7f1d1d' }}>
                          Save MWK {(Number(form.price) - Number(form.flashSalePrice)).toLocaleString()}
                        </p>
                        <p style={{ fontSize: 11, color: '#991b1b' }}>
                          MWK {Number(form.price).toLocaleString()} → MWK {Number(form.flashSalePrice).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  )}
                  {form.price && form.flashSalePrice && Number(form.flashSalePrice) >= Number(form.price) && (
                    <p style={{ fontSize: 11.5, color: C.red, marginTop: 8, fontWeight: 600 }}>
                      Flash sale price should be lower than the original price.
                    </p>
                  )}

                  {/* Deal duration */}
                  <Field label="Deal Duration" style={{ marginTop: 14 }}>
                    <SelectInput
                      value={form.flashSaleDurationHours}
                      onChange={e => updateForm('flashSaleDurationHours', Number(e.target.value))}
                    >
                      <option value={6}>6 hours</option>
                      <option value={12}>12 hours</option>
                      <option value={24}>24 hours</option>
                      <option value={48}>2 days</option>
                      <option value={72}>3 days</option>
                      <option value={168}>7 days</option>
                    </SelectInput>
                    <p style={{ fontSize: 11, color: C.muted, marginTop: 6 }}>
                      Deal ends {new Date(Date.now() + form.flashSaleDurationHours * 3600 * 1000).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </p>
                  </Field>
                </>
              )}
            </Card>

            <Card style={{ background: C.greenTint, border: '1px solid #c9e8d6' }}>
              <div style={{ display: 'flex', gap: 8 }}>
                <HelpCircle size={17} color={C.green} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>Need Help?</p>
                  <p style={{ fontSize: 12, color: C.muted, marginTop: 4, lineHeight: 1.5 }}>Check our guide on how to write a successful listing.</p>
                  <OutlineButton onClick={() => setShowGuide(true)} style={{ width: '100%', marginTop: 10, fontSize: 12, justifyContent: 'center', display: 'flex' }}>View Guide</OutlineButton>
                </div>
              </div>
            </Card>
          </aside>

          {/* ══ MAIN ══ */}
          <main>
            {/* Images & Videos */}
            <div ref={imagesRef}>
            <Card title="Photos & Videos" subtitle={`Upload up to ${MAX_IMAGES} photos and ${MAX_VIDEOS} videos`}
              badge={sectionsComplete.images && <CheckCircle2 size={18} color={C.green} style={{ animation: 'plPop 0.3s ease' }} />}
              style={{ marginBottom: 16, transition: 'box-shadow 0.3s ease', ...(sectionsComplete.images ? { boxShadow: `0 0 0 2px ${C.greenLight}, ${SHADOW.card}` } : {}) }}>
              <div
                onDragOver={e => { e.preventDefault(); setDragActive(true) }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={dragActive ? S.dropzoneActive : S.dropzone}
              >
                <div style={{ display: 'flex', gap: 8 }}>
                  <UploadCloud size={28} color={C.muted} />
                  <Video size={28} color={C.muted} />
                </div>
                <p style={{ fontSize: 14, color: C.muted, marginTop: 8 }}>Drag &amp; drop photos or videos here</p>
                <p style={{ fontSize: 12, color: '#9aafa0', margin: '6px 0' }}>or</p>
                <span style={S.chooseFilesBtn}>Choose Files</span>
                <p style={{ fontSize: 11, color: '#aab8ae', marginTop: 8 }}>
                  Videos up to {MAX_VIDEO_MB}MB each · MP4 or MOV recommended
                </p>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple hidden
                  onChange={e => e.target.files && addFiles(e.target.files)} />
              </div>

              <UploadProgress current={uploadProgress.current} total={uploadProgress.total} />

              <div style={S.imageGrid}>
                {images.map((img, idx) => (
                  <div key={`img-${idx}`} style={{ ...S.imageThumb, ...(idx === coverIndex ? { boxShadow: `0 0 0 2px ${C.green}` } : {}) }}>
                    <img src={img.url} alt="" style={S.imageThumbImg} />
                    <button style={S.removeBtn} onClick={() => removeImage(idx)}><X size={11} /></button>
                    {idx === coverIndex ? (
                      <span style={{
                        position: 'absolute', bottom: 4, left: 4, right: 4,
                        background: C.green, color: C.white, fontSize: 9.5, fontWeight: 700,
                        borderRadius: 6, padding: '2px 0', textAlign: 'center',
                      }}>
                        Cover
                      </span>
                    ) : (
                      <button
                        onClick={() => setCoverIndex(idx)}
                        style={{
                          position: 'absolute', bottom: 4, left: 4, right: 4,
                          background: 'rgba(0,0,0,0.55)', color: C.white, fontSize: 9.5, fontWeight: 700,
                          border: 'none', borderRadius: 6, padding: '2px 0', cursor: 'pointer',
                        }}>
                        Set as Cover
                      </button>
                    )}
                  </div>
                ))}
                {videos.map((vid, idx) => (
                  <div key={`vid-${idx}`} style={{ ...S.imageThumb, background: '#0f1410' }}>
                    <video src={vid.url} style={S.imageThumbImg} muted />
                    <div style={{
                      position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
                      width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,0,0,0.5)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
                    }}>
                      <PlayCircle size={20} color="#fff" />
                    </div>
                    <button style={S.removeBtn} onClick={() => removeVideo(idx)}><X size={11} /></button>
                    <span style={{
                      position: 'absolute', bottom: 4, left: 4, right: 4,
                      background: 'rgba(0,0,0,0.6)', color: C.white, fontSize: 9.5, fontWeight: 700,
                      borderRadius: 6, padding: '2px 0', textAlign: 'center', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', gap: 3,
                    }}>
                      <Film size={10} /> Video
                    </span>
                  </div>
                ))}
                {(images.length < MAX_IMAGES || videos.length < MAX_VIDEOS) && (
                  <button style={S.addMoreTile} onClick={() => fileInputRef.current?.click()}>
                    <Plus size={18} color="#c3d3c8" />
                  </button>
                )}
              </div>
              {sectionsComplete.images && (
                <OutlineButton onClick={() => scrollToRef(basicInfoRef)} style={{ width: '100%', marginTop: 14, display: 'flex', justifyContent: 'center', gap: 6 }}>
                  Continue to Basic Information <ChevronRight size={14} />
                </OutlineButton>
              )}
            </Card>
            </div>

            {/* Basic info */}
            <div ref={basicInfoRef}>
            <Card title="Basic Information"
              badge={sectionsComplete.basic && <CheckCircle2 size={18} color={C.green} style={{ animation: 'plPop 0.3s ease' }} />}
              style={{ marginBottom: 16, transition: 'box-shadow 0.3s ease', ...(sectionsComplete.basic ? { boxShadow: `0 0 0 2px ${C.greenLight}, ${SHADOW.card}` } : {}) }}>
              <div style={S.grid2}>
                <Field label="Title" required>
                  <TextInput placeholder="e.g. Samsung Galaxy A57 5G" value={form.title}
                    onChange={e => updateForm('title', e.target.value)} />
                </Field>
                <Field label="Category" required>
                  <SelectInput
                    value={form.category}
                    onChange={e => { setForm(f => ({ ...f, category: e.target.value, subcategory: '' })); setCustomSubcategory('') }}
                  >
                    <option value="">Select category</option>
                    <option>Electronics</option><option>Furniture</option><option>Clothing</option>
                    <option>Vehicles</option><option>Property</option><option>Agriculture</option>
                    <option>Food</option><option>Services</option>
                  </SelectInput>
                </Field>
                <Field label="Subcategory">
                  <SelectInput
                    value={form.subcategory}
                    onChange={e => {
                      updateForm('subcategory', e.target.value)
                      if (!e.target.value.startsWith('Other')) setCustomSubcategory('')
                    }}
                    disabled={!form.category}
                  >
                    <option value="">{form.category ? 'Select subcategory' : 'Select category first'}</option>
                    {(SUBCATEGORIES[form.category] || []).map(sub => (
                      <option key={sub} value={sub}>{sub}</option>
                    ))}
                  </SelectInput>
                  {form.subcategory.startsWith('Other') && (
                    <TextInput
                      placeholder="Please specify subcategory"
                      value={customSubcategory}
                      onChange={e => {
                        setCustomSubcategory(e.target.value)
                        updateForm('subcategory', e.target.value ? `Other: ${e.target.value}` : form.category ? 'Other' : '')
                      }}
                      style={{ marginTop: 8 }}
                    />
                  )}
                </Field>
                <Field label="Condition" required style={{ gridColumn: '1 / -1' }}>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {CONDITIONS.map(c => (
                      <PillButton key={c.key} active={form.condition === c.key}
                        onClick={() => updateForm('condition', c.key)}
                        style={{ flex: '1 1 auto', minWidth: 120, justifyContent: 'center' }}>{c.label}</PillButton>
                    ))}
                  </div>
                </Field>
              </div>

              <Field label="Description" required style={{ marginTop: 16 }}>
                <TextArea rows={4} maxLength={1000} placeholder="Describe your item or service in detail..."
                  value={form.description} onChange={e => updateForm('description', e.target.value)} />
                <p style={S.charCount}>{form.description.length}/1000</p>
              </Field>

              <Field label="Key Features (optional)" style={{ marginTop: 6 }}>
                <TextArea rows={3} placeholder="Add key features, specs, or highlights..."
                  value={form.keyFeatures} onChange={e => updateForm('keyFeatures', e.target.value)} />
              </Field>

              <Field label="Price (MWK)" required style={{ marginTop: 16 }}>
                <TextInput type="number" min="0" placeholder="e.g. 150000"
                  value={form.price} onChange={e => updateForm('price', e.target.value)} />
              </Field>

              <div style={{ marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <p style={S.fieldLabel}>Bulk / Quantity Pricing (optional)</p>
                  <button type="button" onClick={addPriceTier} style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'none', border: 'none', color: C.green, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>
                    <Plus size={13} /> Add Tier
                  </button>
                </div>
                {form.priceTiers.length === 0 ? (
                  <p style={{ fontSize: 12, color: C.faint }}>Offer a lower price when buyers order in larger quantities.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {form.priceTiers.map((tier, idx) => (
                      <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <TextInput type="number" min="1" placeholder="Min qty (e.g. 5)"
                          value={tier.minQty}
                          onChange={e => updatePriceTier(idx, 'minQty', e.target.value)}
                          style={{ flex: 1 }} />
                        <TextInput type="number" min="0" placeholder="Price per unit (MWK)"
                          value={tier.price}
                          onChange={e => updatePriceTier(idx, 'price', e.target.value)}
                          style={{ flex: 1 }} />
                        <button type="button" onClick={() => removePriceTier(idx)}
                          style={{ background: C.redBg, border: 'none', borderRadius: 8, width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                          <X size={14} color={C.red} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {sectionsComplete.basic && (
                <OutlineButton onClick={() => scrollToRef(contactRef)} style={{ width: '100%', marginTop: 16, display: 'flex', justifyContent: 'center', gap: 6 }}>
                  Continue to Seller Contact <ChevronRight size={14} />
                </OutlineButton>
              )}
            </Card>
            </div>

            {/* Seller contact */}
            <div ref={contactRef}>
            <Card title="Seller Contact"
              badge={sectionsComplete.contact && <CheckCircle2 size={18} color={C.green} style={{ animation: 'plPop 0.3s ease' }} />}
              style={{ marginBottom: 16, transition: 'box-shadow 0.3s ease', ...(sectionsComplete.contact ? { boxShadow: `0 0 0 2px ${C.greenLight}, ${SHADOW.card}` } : {}) }}>
              {myShops.length > 0 && (
                <div style={{ marginBottom: 18 }}>
                  <p style={S.fieldLabel}>Contact As</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {myShops.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedShopId(s.id)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 10,
                          border: `1.5px solid ${selectedShopId === s.id ? C.green : C.border}`,
                          background: selectedShopId === s.id ? C.greenLight : C.white,
                          borderRadius: 12, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', width: '100%',
                        }}
                      >
                        {s.logo_url ? (
                          <img src={s.logo_url} alt="" style={{ width: 34, height: 34, borderRadius: 9, objectFit: 'cover', flexShrink: 0 }} />
                        ) : (
                          <div style={{ width: 34, height: 34, borderRadius: 9, background: C.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color: C.green, flexShrink: 0 }}>
                            {s.name?.[0]?.toUpperCase() || 'S'}
                          </div>
                        )}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13.5, fontWeight: 700, color: C.dark, display: 'flex', alignItems: 'center', gap: 5 }}>
                            {s.name}
                            {s.is_verified && <CheckCircle2 size={13} color={C.green} />}
                          </p>
                          <p style={{ fontSize: 11.5, color: C.muted }}>{s.phone || s.whatsapp || 'No contact number set'}</p>
                        </div>
                        {selectedShopId === s.id && <CheckCircle2 size={17} color={C.green} style={{ flexShrink: 0 }} />}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setSelectedShopId('personal')}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        border: `1.5px solid ${selectedShopId === 'personal' ? C.green : C.border}`,
                        background: selectedShopId === 'personal' ? C.greenLight : C.white,
                        borderRadius: 12, padding: '10px 12px', cursor: 'pointer', textAlign: 'left', width: '100%',
                      }}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: '50%', background: '#eef2ef', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <User size={16} color="#9aafa0" />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13.5, fontWeight: 700, color: C.dark }}>Use My Personal Info</p>
                        <p style={{ fontSize: 11.5, color: C.muted }}>{profileName || 'Your profile name'}</p>
                      </div>
                      {selectedShopId === 'personal' && <CheckCircle2 size={17} color={C.green} style={{ flexShrink: 0 }} />}
                    </button>
                  </div>
                  <p style={{ fontSize: 11.5, color: C.faint, marginTop: 8 }}>
                    Name and contact details below are pre-filled from your selection — confirm or edit them as needed.
                  </p>
                </div>
              )}
              <div style={S.grid2}>
                <Field label="Full Name" required>
                  <TextInput placeholder="Your full name" value={form.fullName} readOnly
                    style={{ background: C.surface, color: C.muted, cursor: 'not-allowed' }} />
                </Field>
                <Field label="Phone Number">
                  <TextInput placeholder="+265 88 123 4567 (optional)" value={form.phone}
                    onChange={e => updateForm('phone', e.target.value)} />
                </Field>
                <Field label="WhatsApp">
                  <TextInput placeholder="+265 88 123 4567 (optional)" value={form.whatsapp}
                    onChange={e => updateForm('whatsapp', e.target.value)} />
                </Field>
                <Field label="Email (optional)">
                  <TextInput type="email" placeholder="you@example.com" value={form.email}
                    onChange={e => updateForm('email', e.target.value)} />
                </Field>
              </div>
            </Card>
            </div>

            {/* Availability */}
            <Card title="Availability" style={{ marginBottom: 16 }}>
              <p style={S.fieldLabel}>Availability Status</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {[
                  { key: 'in_stock',      label: 'In Stock' },
                  { key: 'made_to_order', label: 'Made to Order' },
                  { key: 'not_available', label: 'Not Available' },
                ].map(opt => (
                  <PillButton key={opt.key} active={form.availability === opt.key}
                    onClick={() => updateForm('availability', opt.key)}>{opt.label}</PillButton>
                ))}
              </div>
              <p style={S.fieldLabel}>Preferred Contact Methods (select all that apply)</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                {[
                  { key: 'call',     label: 'Call',      icon: Phone },
                  { key: 'whatsapp', label: 'WhatsApp',  icon: MessageCircle },
                  { key: 'chat',     label: 'Chat (Always On)', icon: MessageCircle },
                  { key: 'email',    label: 'Email',     icon: Send },
                ].map(opt => (
                  <PillButton key={opt.key} active={form.contactMethods.includes(opt.key)}
                    icon={opt.icon}
                    onClick={() => toggleContactMethod(opt.key)}
                    style={opt.key === 'chat' ? { cursor: 'default', opacity: 0.9 } : undefined}
                  >{opt.label}</PillButton>
                ))}
              </div>

              {/* Number picker — shown only when Call is selected */}
              {form.contactMethods.includes('call') && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: C.dark, marginBottom: 6 }}>
                    Number to use for Calls
                  </p>
                  {availableNumbers.length > 0 && (
                    <SelectInput
                      value={availableNumbers.some(n => n.value === form.callNumber) ? form.callNumber : ''}
                      onChange={e => updateForm('callNumber', e.target.value)}
                      style={{ marginBottom: 8 }}
                    >
                      <option value="">Choose a saved number…</option>
                      {availableNumbers.map(n => (
                        <option key={n.value} value={n.value}>{n.label}</option>
                      ))}
                    </SelectInput>
                  )}
                  <TextInput
                    placeholder="Or enter/edit a number"
                    value={form.callNumber}
                    onChange={e => updateForm('callNumber', e.target.value)}
                  />
                </div>
              )}

              {/* Number picker — shown only when WhatsApp is selected */}
              {form.contactMethods.includes('whatsapp') && (
                <div style={{ marginBottom: 14 }}>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: C.dark, marginBottom: 6 }}>
                    Number to use for WhatsApp
                  </p>
                  {availableNumbers.length > 0 && (
                    <SelectInput
                      value={availableNumbers.some(n => n.value === form.whatsappNumber) ? form.whatsappNumber : ''}
                      onChange={e => updateForm('whatsappNumber', e.target.value)}
                      style={{ marginBottom: 8 }}
                    >
                      <option value="">Choose a saved number…</option>
                      {availableNumbers.map(n => (
                        <option key={n.value} value={n.value}>{n.label}</option>
                      ))}
                    </SelectInput>
                  )}
                  <TextInput
                    placeholder="Or enter/edit a number"
                    value={form.whatsappNumber}
                    onChange={e => updateForm('whatsappNumber', e.target.value)}
                  />
                </div>
              )}

              {/* Email picker — shown only when Email is selected */}
              {form.contactMethods.includes('email') && (
                <div>
                  <p style={{ fontSize: 12.5, fontWeight: 600, color: C.dark, marginBottom: 6 }}>
                    Email to use for buyer contact
                  </p>
                  <TextInput
                    type="email"
                    placeholder="you@example.com"
                    value={form.email}
                    onChange={e => updateForm('email', e.target.value)}
                  />
                </div>
              )}
              <OutlineButton onClick={() => scrollToRef(locationRef)} style={{ width: '100%', marginTop: 16, display: 'flex', justifyContent: 'center', gap: 6 }}>
                Continue to Location <ChevronRight size={14} />
              </OutlineButton>
            </Card>

            <div style={S.buyersBanner}>
              <div style={{ display: 'flex', gap: 10 }}>
                <Info size={17} color={C.indigo} style={{ flexShrink: 0, marginTop: 1 }} />
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.dark }}>Buyers Looking For This?</p>
                  <p style={{ fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.5 }}>
                    Allow buyers who are looking for this product/service to find and contact you.
                  </p>
                </div>
              </div>
              <Toggle checked={buyersLookingFor} onChange={setBuyersLookingFor} />
            </div>
          </main>

          {/* ══ RIGHT ══ */}
          <aside className="pl-sidebar">
            {/* Location */}
            <div ref={locationRef}>
            <Card title="Your Location" icon={MapPin}
              subtitle="We detect your location automatically"
              badge={
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {location.detected && <span style={S.autoDetectedPill}>Auto-detected</span>}
                  {sectionsComplete.location && <CheckCircle2 size={18} color={C.green} style={{ animation: 'plPop 0.3s ease' }} />}
                </div>
              }
              style={{ marginBottom: 16, transition: 'box-shadow 0.3s ease', ...(sectionsComplete.location ? { boxShadow: `0 0 0 2px ${C.greenLight}, ${SHADOW.card}` } : {}) }}>
              {location.detected ? (
                <div style={S.locRow}>
                  <div style={{ display: 'flex', gap: 8, flex: 1, minWidth: 0 }}>
                    <MapPin size={15} color={C.green} style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Editable city inline */}
                      <input
                        value={location.city}
                        onChange={e => { setLocation(l => ({ ...l, city: e.target.value })); setLocationConfirmed(false) }}
                        placeholder="City / Town"
                        style={{ fontSize: 14, fontWeight: 700, color: C.dark, border: 'none', outline: 'none', background: 'transparent', width: '100%', fontFamily: DMSANS }}
                      />
                      {/* Editable area inline */}
                      <input
                        value={location.area}
                        onChange={e => { setLocation(l => ({ ...l, area: e.target.value })); setLocationConfirmed(false) }}
                        placeholder="Area / Neighbourhood (e.g. Area 25)"
                        style={{ fontSize: 12, color: C.muted, border: 'none', outline: 'none', background: 'transparent', width: '100%', fontFamily: DMSANS }}
                      />
                      <p style={{ fontSize: 11, color: C.faint, marginTop: 2 }}>{location.district}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setLocation(l => ({ ...l, detected: false })); setLocationConfirmed(false) }}
                    style={{ background: 'none', border: 'none', color: C.green, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                    Change
                  </button>
                </div>
              ) : (
                <div style={{ ...S.locRow, justifyContent: 'center', color: C.muted, fontSize: 12, border: `1.5px dashed ${C.border}` }}>
                  Location not detected yet
                </div>
              )}

              {/* Manual override — shown when "Change" is clicked or GPS name lookup fails */}
              {!location.detected && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  <TextInput
                    placeholder="City / Town (e.g. Lilongwe)"
                    value={location.city}
                    onChange={e => setLocation(l => ({ ...l, city: e.target.value }))}
                  />
                  <SelectInput
                    value={location.district}
                    onChange={e => setLocation(l => ({ ...l, district: e.target.value }))}
                  >
                    <option value="">Select District</option>
                    {[
                      'Balaka','Blantyre','Chikwawa','Chiradzulu','Chitipa',
                      'Dedza','Dowa','Karonga','Kasungu','Likoma','Lilongwe',
                      'Machinga','Mangochi','Mchinji','Mulanje','Mwanza',
                      'Mzimba','Neno','Nkhata Bay','Nkhotakota','Nsanje',
                      'Ntcheu','Ntchisi','Phalombe','Rumphi','Salima',
                      'Thyolo','Zomba',
                    ].map(d => (
                      <option key={d} value={`${d} District`}>{d} District</option>
                    ))}
                  </SelectInput>
                  <TextInput
                    placeholder="Area / Neighbourhood (e.g. Area 25)"
                    value={location.area}
                    onChange={e => setLocation(l => ({ ...l, area: e.target.value }))}
                  />
                  <OutlineButton
                    onClick={() => {
                      if (location.city && location.district) {
                        setLocation(l => ({ ...l, detected: true }))
                        setLocationConfirmed(true)
                      }
                    }}
                    style={{ width: '100%', display: 'flex', justifyContent: 'center', marginTop: 4 }}
                  >
                    Confirm This Location
                  </OutlineButton>
                </div>
              )}

              {/* Live map — OpenStreetMap iframe, no API key needed */}
            <div style={{ position: 'relative', height: 136, borderRadius: 14, marginBottom: 12, overflow: 'hidden', border: `1px solid ${C.cardLine}` }}>
                {location.lat && location.lng ? (
                  <>
                    <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
                    {locationConfirmed && (                      <div style={{
                        position: 'absolute', top: 8, left: 8,
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'rgba(26,122,74,0.95)', color: C.white,
                        fontSize: 10.5, fontWeight: 700, borderRadius: 20,
                        padding: '4px 10px', boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                        pointerEvents: 'none',
                      }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80', display: 'inline-block' }} />
                        You're here
                      </div>
                    )}
                  </>
                ) : (
                  /* Fallback grid while no coordinates yet */
                  <div style={{
                    width: '100%', height: '100%',
                    background: `linear-gradient(0deg,transparent 24%,rgba(26,122,74,0.07) 25%,rgba(26,122,74,0.07) 26%,transparent 27%,transparent 74%,rgba(26,122,74,0.07) 75%,rgba(26,122,74,0.07) 76%,transparent 77%),linear-gradient(90deg,transparent 24%,rgba(26,122,74,0.07) 25%,rgba(26,122,74,0.07) 26%,transparent 27%,transparent 74%,rgba(26,122,74,0.07) 75%,rgba(26,122,74,0.07) 76%,transparent 77%),linear-gradient(135deg,${C.greenLight},#eef5f0 60%,#e4eee7)`,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                    <span style={S.mapDotRing} className="pl-pulse-ring"><span style={S.mapDot} /></span>
                    {location.detecting && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: C.green }}>Locating you…</span>
                    )}
                  </div>
                )}
              </div>

              {location.detected && (
                locationConfirmed ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: C.greenLight, border: `1px solid #a3d5b5`, borderRadius: 10, padding: '10px 14px', marginBottom: 8, fontSize: 13, fontWeight: 700, color: C.green }}>
                    <CheckCircle2 size={15} /> Location confirmed
                  </div>
                ) : (
                  <OutlineButton
                    style={{ width: '100%', marginBottom: 8, display: 'flex', justifyContent: 'center', gap: 6 }}
                    onClick={() => {
                      setLocationConfirmed(true)
                      showToast('Location pinned on the map below.', 'success', 2500)
                    }}
                  >
                    <MapPin size={14} /> Use This Location
                  </OutlineButton>
                )
              )}
              <button onClick={() => { setLocationConfirmed(false); detectLocation() }} disabled={location.detecting}
                style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 auto', background: 'none', border: 'none', color: C.green, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                <RefreshCw size={13} style={location.detecting ? { animation: 'plSpin 0.8s linear infinite' } : {}} />
                {location.detecting ? 'Detecting…' : 'Detect again'}
              </button>
              <div style={S.tipBannerGreen}>Accurate location helps buyers near you find your listing easily.</div>
              {sectionsComplete.location && (
                <OutlineButton onClick={() => scrollToRef(promotionRef)} style={{ width: '100%', marginTop: 10, display: 'flex', justifyContent: 'center', gap: 6 }}>
                  Continue to Promotion <ChevronRight size={14} />
                </OutlineButton>
              )}
            </Card>
            </div>

            <div ref={promotionRef}>
            <Card title="Promotion" icon={Crown} subtitle="Boost your listing's visibility (optional)"
              style={{
                marginBottom: 16,
                background: GRAD.premiumCard,
                border: '1.5px solid #f0d28a',
                boxShadow: selectedPromotion === 'featured'
                  ? `0 0 0 3px rgba(217,119,6,0.15), ${SHADOW.premiumGlow}`
                  : SHADOW.premiumGlow,
              }}
              badge={<span style={S.bestValuePill}>{hasFreeFeatureLeft ? `${FREE_FEATURE_LIMIT - freeFeatureCount} Free Left` : 'Popular'}</span>}
            >
              <button
                type="button"
                onClick={() => setSelectedPromotion(selectedPromotion === 'featured' ? 'none' : 'featured')}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', textAlign: 'left', cursor: 'pointer',
                  border: selectedPromotion === 'featured' ? '1.5px solid #d97706' : '1.5px solid #f0d28a',
                  background: selectedPromotion === 'featured'
                    ? 'linear-gradient(135deg,#fff8e6,#fde9b0)'
                    : 'rgba(255,255,255,0.6)',
                  borderRadius: 13, padding: '14px 16px',
                  transition: 'all 0.15s ease',
                }}
              >
                <div>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: C.dark, marginBottom: 6 }}>Feature this listing</p>
                  {hasFreeFeatureLeft ? (
                    <p style={{ fontFamily: SORA, fontSize: 22, fontWeight: 800, color: C.green, letterSpacing: '-0.02em' }}>
                      FREE
                    </p>
                  ) : selectedPromotion === 'featured' ? (
                    <p style={{ fontFamily: SORA, fontSize: 22, fontWeight: 800, color: C.amberDeep, letterSpacing: '-0.02em' }}>
                      MWK {FEATURED_TIERS.find(t => t.days === featuredDuration).price.toLocaleString()}
                    </p>
                  ) : (
                    <p style={{ fontFamily: SORA, fontSize: 20, fontWeight: 800, color: C.amberDeep, letterSpacing: '-0.02em' }}>
                      MWK {FEATURED_TIERS[0].price.toLocaleString()}–{FEATURED_TIERS[FEATURED_TIERS.length - 1].price.toLocaleString()}
                    </p>
                  )}
                  <p style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>
                    {hasFreeFeatureLeft
                      ? `Homepage placement · 7 days · ${FREE_FEATURE_LIMIT - freeFeatureCount} of ${FREE_FEATURE_LIMIT} free features left`
                      : selectedPromotion === 'featured'
                        ? `Homepage placement · ${featuredDuration} days`
                        : 'Homepage placement · choose 3, 7 or 30 days'}
                  </p>
                </div>
                <span style={{
                  width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                  border: selectedPromotion === 'featured' ? 'none' : '2px solid #e0c374',
                  background: selectedPromotion === 'featured' ? 'linear-gradient(135deg,#f59e0b,#d4920a)' : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {selectedPromotion === 'featured' && <CheckCircle2 size={15} color="#fff" />}
                </span>
              </button>

              {selectedPromotion === 'featured' && !hasFreeFeatureLeft && (
                <div style={{ marginTop: 14 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: C.dark, marginBottom: 8 }}>Choose a duration</p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {FEATURED_TIERS.map(t => {
                      const active = featuredDuration === t.days
                      return (
                        <button
                          key={t.days}
                          type="button"
                          onClick={() => setFeaturedDuration(t.days)}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            width: '100%', textAlign: 'left', cursor: 'pointer',
                            border: active ? '1.5px solid #d97706' : '1.5px solid #f0d28a',
                            background: active ? 'linear-gradient(135deg,#fff8e6,#fde9b0)' : 'rgba(255,255,255,0.6)',
                            borderRadius: 11, padding: '11px 14px',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{
                              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                              border: active ? 'none' : '2px solid #e0c374',
                              background: active ? 'linear-gradient(135deg,#f59e0b,#d4920a)' : 'transparent',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                              {active && <CheckCircle2 size={12} color="#fff" />}
                            </span>
                            <span style={{ fontSize: 13.5, fontWeight: 700, color: C.dark }}>{t.days} days</span>
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 800, color: C.amberDeep }}>
                            MWK {t.price.toLocaleString()}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: 9, marginTop: 16 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#78350f' }}>
                  <Home size={14} color="#78350f" /> Homepage placement
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#78350f' }}>
                  <TrendingUp size={14} color="#78350f" /> Up to 10x more views
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, fontWeight: 600, color: '#78350f' }}>
                  <Crown size={14} color="#78350f" /> Gold "Featured" badge
                </span>
              </div>
            </Card>
            </div>

            </aside>
        </div>
      </div>

      {/* ── Sticky bottom action bar ── */}
      <div style={S.stickyBar}>
        <OutlineButton onClick={handleSaveDraft} disabled={savingDraft || submitting}>
          {savingDraft ? 'Saving…' : 'Save as Draft'}
        </OutlineButton>
       <PrimaryButton loading={submitting} onClick={handlePublish}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {isEditMode ? 'Save Changes' : 'Publish Listing'} <Send size={14} />
        </PrimaryButton>
      </div>

       {/* ── Resume Draft Modal ── */}
      {pendingDraft && (
        <ResumeDraftModal
          draft={pendingDraft}
          onResume={handleResumeDraft}
          onDiscard={handleDiscardDraftPrompt}
        />
      )}

      {/* ── Listing Guide Modal ── */}
      {showGuide && <ListingGuideModal onClose={() => setShowGuide(false)} />}

     </div>
  )
}

/* ────────────────────────────────────────────────────────────
   Stylesheet
   ──────────────────────────────────────────────────────────── */
const S = {
  page: { minHeight: '100vh', background: C.surface, fontFamily: DMSANS, color: C.dark, fontSize: 15, paddingBottom: 96 },

  progressBarOuter: { position: 'sticky', top: 0, zIndex: 60, height: 3, background: C.line, overflow: 'hidden' },
  progressBarFill:  { height: '100%', background: GRAD.primaryBtn, transition: 'width 0.4s cubic-bezier(0.4,0,0.2,1)' },

  headerOuter: { position: 'sticky', top: 0, zIndex: 40, background: C.white, boxShadow: SHADOW.header },
  headerRow1:  { display: 'flex', alignItems: 'center', gap: 24, padding: '14px 24px', borderBottom: `1px solid ${C.line}` },
  brand:       { fontFamily: SORA, fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1 },
  tagline:     { fontSize: 11, color: C.muted, marginTop: 2, whiteSpace: 'nowrap' },
  searchWrap:  { flex: 1, maxWidth: 600, display: 'flex', alignItems: 'center', gap: 8, background: '#f4f9f6', border: '1.5px solid #d0e8d8', borderRadius: 22, padding: '0 6px 0 16px', height: 42 },
  searchInput: { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontSize: 14, color: C.dark },
  navActions:  { display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto', flexShrink: 0 },
  navBtn:      { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, background: 'none', border: 'none', cursor: 'pointer', color: C.muted, padding: '4px 10px' },
  navBtnLabel: { fontSize: 11, fontWeight: 600 },
  avatar:      { width: 38, height: 38, borderRadius: '50%', background: 'linear-gradient(135deg,#2b3630,#0f1410)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: 'inset 0 0 0 2px rgba(255,255,255,0.08)' },

  tabsRow:  { display: 'flex', alignItems: 'center', gap: 28, padding: '0 24px', borderBottom: `1px solid ${C.line}`, overflowX: 'auto' },
  tab:      { display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', borderBottom: '2px solid transparent', color: C.muted, fontSize: 13.5, fontWeight: 500, padding: '12px 2px', cursor: 'pointer', whiteSpace: 'nowrap' },
  tabActive:{ display: 'flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', borderBottom: `2px solid ${C.green}`, color: C.green, fontSize: 13.5, fontWeight: 700, padding: '12px 2px', cursor: 'pointer', whiteSpace: 'nowrap' },

  container:   { maxWidth: 1400, margin: '0 auto', padding: '20px 24px 40px' },
  breadcrumb:  { display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: C.muted, marginBottom: 10 },
  pageHeadRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  h1:          { fontFamily: SORA, fontSize: 30, fontWeight: 800, color: C.dark, letterSpacing: '-0.02em', lineHeight: 1.1 },
  subtitle:    { fontSize: 13.5, color: C.muted, marginBottom: 22 },

  authWarning: { display: 'flex', alignItems: 'center', gap: 10, background: C.amberBg, border: `1px solid ${C.amberBorder}`, borderLeft: `3px solid ${C.amber}`, borderRadius: 12, padding: '12px 16px', marginBottom: 20, fontSize: 13.5, color: C.amberDeep },

  card:        { background: C.white, border: `1px solid ${C.cardLine}`, borderRadius: 18, padding: 20, boxShadow: SHADOW.card },
  cardHeadRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  cardTitle:   { fontFamily: SORA, fontSize: 16, fontWeight: 700, color: C.dark, letterSpacing: '-0.01em' },
  cardSubtitle:{ fontSize: 12, color: C.muted, marginBottom: 14, marginTop: 2 },

  stepCircle:      { width: 26, height: 26, borderRadius: '50%', background: '#eef2ef', color: '#9aafa0', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0 },
  stepCircleActive:{ width: 26, height: 26, borderRadius: '50%', background: GRAD.primaryBtn, color: C.white, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, flexShrink: 0, boxShadow: '0 0 0 4px rgba(26,122,74,0.14),0 4px 10px -2px rgba(26,122,74,0.4)' },
  stepLine:        { width: 2, flex: 1, minHeight: 24, marginTop: 3, background: C.line },
  stepLineActive:  { width: 2, flex: 1, minHeight: 24, marginTop: 3, background: `linear-gradient(to bottom,${C.green},${C.line})` },
  stepTitle:       { fontSize: 13.5, fontWeight: 600, color: '#9aafa0' },
  stepTitleActive: { fontSize: 13.5, fontWeight: 700, color: C.dark },
  stepSubtitle:    { fontSize: 11.5, color: '#aab8ae', marginTop: 1 },

  dropzone:      { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '38px 20px', borderRadius: 14, border: `2px dashed ${C.border}`, background: '#fafcfa', cursor: 'pointer', transition: 'border-color .15s ease,background .15s ease' },
  dropzoneActive:{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '38px 20px', borderRadius: 14, border: `2px dashed ${C.green}`, background: C.greenTint, cursor: 'pointer' },
  chooseFilesBtn:{ background: GRAD.primaryBtn, color: C.white, borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, boxShadow: SHADOW.btnGreen },
  imageGrid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(84px,1fr))', gap: 10, marginTop: 14 },
  imageThumb:    { position: 'relative', aspectRatio: '1/1', borderRadius: 12, overflow: 'hidden', border: `1px solid ${C.cardLine}`, boxShadow: '0 2px 6px rgba(15,20,16,0.08)' },
  imageThumbImg: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  removeBtn:     { position: 'absolute', top: 4, right: 4, width: 18, height: 18, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', color: C.white, border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  addMoreTile:   { aspectRatio: '1/1', borderRadius: 12, border: `2px dashed ${C.border}`, background: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },

  grid2:       { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 },
  fieldLabel:  { display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input:       { width: '100%', border: `1px solid ${C.border}`, borderRadius: 10, padding: '10px 13px', fontSize: 14, color: C.dark, background: C.white, transition: 'border-color .15s ease,box-shadow .15s ease', boxSizing: 'border-box' },
  inputFocused:{ border: `1px solid ${C.green}`, boxShadow: SHADOW.focusRing, outline: 'none' },
  charCount:   { textAlign: 'right', fontSize: 11, color: '#aab8ae', marginTop: 4 },

  pill:      { display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${C.border}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 600, color: '#6b7a70', background: C.white, cursor: 'pointer', transition: 'border-color .15s ease,background .15s ease' },
  pillActive:{ display: 'flex', alignItems: 'center', gap: 6, border: `1.5px solid ${C.green}`, borderRadius: 10, padding: '9px 14px', fontSize: 13, fontWeight: 700, color: C.green, background: C.greenLight, cursor: 'pointer' },
  pillHover: { border: '1px solid #a9c9b6', background: '#fafcfa' },

  primaryBtn:     { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, background: GRAD.primaryBtn, border: 'none', borderRadius: 11, padding: '12px 22px', fontSize: 13.5, fontWeight: 700, color: C.white, cursor: 'pointer', boxShadow: SHADOW.btnGreen, transition: 'transform .15s ease,box-shadow .15s ease' },
  primaryBtnHover:{ transform: 'translateY(-1px)', boxShadow: SHADOW.btnGreenHover },
  outlineBtn:     { background: C.white, border: `1px solid ${C.border}`, borderRadius: 10, padding: '11px 18px', fontSize: 13.5, fontWeight: 600, color: '#374151', cursor: 'pointer', transition: 'background .15s ease,border-color .15s ease' },
  outlineBtnHover:{ background: C.greenTint, border: '1px solid #bcdcc8' },

  buyersBanner: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, background: C.indigoBg, border: `1px solid ${C.indigoBorder}`, borderLeft: `3px solid ${C.indigo}`, borderRadius: 14, padding: '16px 18px' },

  stickyBar: { position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 45, background: C.white, borderTop: `1px solid ${C.line}`, padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: 10, boxShadow: SHADOW.stickyBar },

  autoDetectedPill: { background: C.greenLight, color: C.green, fontSize: 11, fontWeight: 700, borderRadius: 20, padding: '4px 10px' },
  locRow: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', border: `1px solid ${C.cardLine}`, borderRadius: 12, padding: 12, marginBottom: 12 },
  mapPreview: {
    position: 'relative', height: 136, borderRadius: 14, marginBottom: 12, overflow: 'hidden',
    background: `linear-gradient(0deg,transparent 24%,rgba(26,122,74,0.07) 25%,rgba(26,122,74,0.07) 26%,transparent 27%,transparent 74%,rgba(26,122,74,0.07) 75%,rgba(26,122,74,0.07) 76%,transparent 77%),
                 linear-gradient(90deg,transparent 24%,rgba(26,122,74,0.07) 25%,rgba(26,122,74,0.07) 26%,transparent 27%,transparent 74%,rgba(26,122,74,0.07) 75%,rgba(26,122,74,0.07) 76%,transparent 77%),
                 linear-gradient(135deg,${C.greenLight},#eef5f0 60%,#e4eee7)`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  mapDotRing: { width: 30, height: 30, borderRadius: '50%', background: 'rgba(29,78,216,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  mapDot:     { width: 13, height: 13, borderRadius: '50%', background: C.blue, border: `2.5px solid ${C.white}`, boxShadow: SHADOW.pin },
  tipBannerGreen: { marginTop: 12, background: C.greenTint, color: C.green, fontSize: 11.5, borderRadius: 10, borderLeft: `3px solid ${C.green}`, padding: '9px 12px', lineHeight: 1.5 },

  promoRow:             { display: 'flex', alignItems: 'flex-start', gap: 10, border: `1px solid ${C.cardLine}`, borderRadius: 13, padding: 12, background: C.white, cursor: 'pointer', textAlign: 'left', width: '100%', transition: 'border-color .15s ease,box-shadow .15s ease,background .15s ease' },
  promoRowHover:        { border: '1px solid #d3ddd6', boxShadow: '0 4px 12px -6px rgba(15,20,16,0.12)' },
  promoRowActive:       { border: `1.5px solid ${C.amber}`, background: C.amberBg },
  promoRowPremium:      { background: GRAD.premiumCard, border: '1.5px solid #f0d28a', boxShadow: SHADOW.premiumGlow },
  promoRowPremiumActive:{ border: '1.5px solid #d97706', background: 'linear-gradient(135deg,#fff8e6,#fde9b0)', boxShadow: `0 0 0 3px rgba(217,119,6,0.15),${SHADOW.premiumGlow}` },
  promoIconWrap:  { width: 32, height: 32, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  promoName:      { fontSize: 14, fontWeight: 700, color: C.dark },
  promoDesc:      { display: 'block', fontSize: 12, color: C.muted, marginTop: 2, lineHeight: 1.4 },
  promoPrice:     { display: 'block', fontFamily: SORA, fontSize: 14.5, fontWeight: 800, color: C.blue, marginTop: 5, letterSpacing: '-0.01em' },
  bestValuePill:  { background: GRAD.gold, color: C.white, fontSize: 9.5, fontWeight: 800, borderRadius: 20, padding: '2px 9px', boxShadow: '0 2px 6px -1px rgba(217,119,6,0.5)' },
  promoRadio: (sel) => ({ marginTop: 2, width: 17, height: 17, borderRadius: '50%', flexShrink: 0, border: `2px solid ${sel ? C.amber : '#ccd6cf'}`, background: sel ? C.amber : 'transparent', boxShadow: sel ? '0 0 0 3px rgba(245,158,11,0.15)' : 'none' }),
  noPromo:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1px solid ${C.cardLine}`, borderRadius: 13, padding: 12, background: C.white, cursor: 'pointer', width: '100%', textAlign: 'left' },
  noPromoActive:{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', border: `1.5px solid ${C.green}`, borderRadius: 13, padding: 12, background: C.greenLight, cursor: 'pointer', width: '100%', textAlign: 'left' },
  noPromoCheck: (c) => ({ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: c ? C.green : 'transparent', border: c ? 'none' : '2px solid #ccd6cf' }),
  tipBannerAmber: { marginTop: 12, background: C.amberBg, color: C.amberDeep, fontSize: 11.5, fontWeight: 600, borderRadius: 10, borderLeft: `3px solid ${C.amber}`, padding: '9px 12px' },

  calendarBox:          { border: `1px solid ${C.cardLine}`, borderRadius: 13, padding: 12 },
  calendarHeadRow:      { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  calendarNavBtn:       { background: 'none', border: 'none', color: C.muted, cursor: 'pointer', display: 'flex' },
  calendarWeekRow:      { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, fontSize: 10.5, color: '#aab8ae', textAlign: 'center', marginBottom: 4 },
  calendarDaysGrid:     { display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 },
  calendarDayEmpty:     { aspectRatio: '1/1', background: 'none', border: 'none' },
  calendarDayAvailable: { aspectRatio: '1/1', borderRadius: 7, border: 'none', background: C.greenLight, color: '#3d5244', fontSize: 11, cursor: 'pointer' },
  calendarDaySelected:  { aspectRatio: '1/1', borderRadius: 7, border: 'none', background: GRAD.primaryBtn, color: C.white, fontSize: 11, fontWeight: 700, cursor: 'pointer' },
  legendRow:  { display: 'flex', alignItems: 'center', gap: 14, marginTop: 10, fontSize: 10.5, color: C.muted },
  legendItem: { display: 'flex', alignItems: 'center', gap: 5 },
  legendDot:  { width: 9, height: 9, borderRadius: '50%', display: 'inline-block' },
  depositRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 18 },

  toggleTrack: (c) => ({ position: 'relative', width: 44, height: 24, borderRadius: 999, border: 'none', cursor: 'pointer', flexShrink: 0, background: c ? C.green : '#ccd6cf', transition: 'background .15s' }),
  toggleKnob:  (c) => ({ position: 'absolute', top: 2, left: c ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: C.white, boxShadow: '0 1px 3px rgba(0,0,0,0.25)', transition: 'left .15s' }),
}