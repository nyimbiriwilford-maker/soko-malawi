import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  Search as SearchIconLucide,
  X as XIconLucide,
  Clock as ClockIconLucide,
  MapPin as MapPinIconLucide,
  ShoppingBag as ShoppingBagIconLucide,
  Store as StoreIconLucide,
  Wrench as WrenchIconLucide,
  Target as TargetIconLucide,
  ArrowUpRight as ArrowUpRightIconLucide,
  CornerDownLeft as CornerDownLeftIconLucide,
  ChevronDown as ChevronDownIconLucide,
  Check as CheckIconLucide,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import { isJobListing } from '../utils/homeUtils'
import { CATEGORIES } from '../config/categories'
import NotifyMeModal from './NotifyMeModal'

const css = `
  .hsb-root { position: relative; width: 100%; box-sizing: border-box; }
  .hsb-form { display: flex; align-items: center; width: 100%; box-sizing: border-box; }
  .hsb-input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; padding: 0; font-family: inherit; cursor: text; }
  .hsb-submit { flex: 0 0 auto; border: none; background: #0F9D58; color: #fff; font-weight: 700; cursor: pointer; font-family: inherit; }
  .hsb-header-form { padding: 4px 4px 4px 14px; border-radius: 999px; border: 1.5px solid transparent; background: #F1F3F4; transition: border-color .2s, background .2s, box-shadow .2s; }
  .hsb-header-form.is-focused { background: #fff; border-color: #0F9D58; box-shadow: 0 0 0 3px rgba(15,157,88,.10); }
  .hsb-header-icon { display: flex; align-items: center; flex: 0 0 auto; margin-right: 8px; color: #5F6368; }
  .hsb-header-input { font-size: 13.5px; color: #202124; }
  .hsb-clear { width: 44px; height: 44px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; border: none; background: transparent; cursor: pointer; border-radius: 50%; padding: 0; }
  .hsb-clear-dot { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #E8EAED; color: #5F6368; }
  .hsb-header-submit { height: 44px; padding: 0 20px; font-size: 13.5px; border-radius: 999px; }
  .hsb-hero-form { background: transparent; align-items: stretch; }
  .hsb-hero-input { background: #fff; border: 1px solid #E8EAED; border-right: none; border-radius: 14px 0 0 14px; padding: 0 14px; font-size: 14px; color: #111827; }
  .hsb-hero-submit { border-radius: 0 14px 14px 0; padding: 0 20px; font-size: 14px; }
  .hsb-dropdown { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 1300; background: #fff; border: 1px solid #E8EAED; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.12); padding: 8px 0; max-height: 400px; overflow-y: auto; box-sizing: border-box; }
  .hsb-label { padding: 0 16px 8px; font-size: 11px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: .5px; }
  .hsb-label-bordered { border-top: 1px solid #F3F4F6; padding-top: 8px; }
  .hsb-row { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 7px 16px; border: none; background: transparent; cursor: pointer; font-family: inherit; min-height: 44px; box-sizing: border-box; }
  .hsb-row:hover { background: #F3F4F6; }
  .hsb-thumb { width: 32px; height: 32px; border-radius: 8px; background: #F3F4F6; overflow: hidden; flex: 0 0 auto; }
  .hsb-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .hsb-row-body { flex: 1; min-width: 0; }
  .hsb-row-title { font-size: 13px; font-weight: 600; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hsb-row-meta { font-size: 11px; color: #6B7280; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hsb-skeleton-wrap { padding: 16px 16px 12px; }
  .hsb-skeleton-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; min-height: 44px; }
  .hsb-skeleton { background: #E5E7EB; border-radius: 8px; }
  .hsb-empty { padding: 20px 16px 16px; }
  .hsb-empty-title { font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 4px; }
  .hsb-empty-hint { font-size: 11px; font-weight: 600; color: #9CA3AF; margin-bottom: 12px; }
  .hsb-empty-list { margin: 0 0 14px; padding: 0 0 0 16px; font-size: 11px; color: #6B7280; line-height: 1.8; }
  .hsb-notify { width: 100%; border: none; background: #0F9D58; border-radius: 8px; padding: 9px 12px; font-size: 12px; font-weight: 800; color: #fff; cursor: pointer; font-family: inherit; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; }
  .hsb-empty-actions { display: flex; gap: 8px; }
  .hsb-secondary, .hsb-tertiary { flex: 1; border-radius: 8px; padding: 8px 12px; font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit; min-height: 44px; }
  .hsb-secondary { border: 1px solid #D1D5DB; background: #fff; color: #374151; }
  .hsb-tertiary { border: none; background: #374151; color: #fff; }
  .hsb-root.hsb-desktop .hsb-header-form { height: 44px; min-height: 44px !important; padding: 0 12px 0 14px; border: 2px solid transparent; background: #f1f3f4; }
  .hsb-root.hsb-desktop .hsb-header-form.is-focused { background: #fff; border-color: #0F9D58; box-shadow: 0 4px 16px rgba(15,157,88,.12); }
  .hsb-root.hsb-desktop .hsb-header-icon { display: none; }
  .hsb-root.hsb-desktop .hsb-desktop-search-icon { display: flex; align-items: center; flex: 0 0 auto; margin-right: 10px; color: #5f6368; }
  .hsb-root.hsb-desktop .hsb-header-input { font-family: 'DM Sans', 'Inter', system-ui, sans-serif; font-size: 15px; color: #202124; }
  .hsb-root.hsb-desktop .hsb-header-input::placeholder { color: #80868b; opacity: 1; }
  .hsb-root.hsb-desktop .hsb-submit { display: none !important; }
  .hsb-root.hsb-desktop .hsb-clear { width: 28px; height: 28px; margin-right: 6px; border-radius: 50%; }
  .hsb-root.hsb-desktop .hsb-clear-dot { display: none; }
  .hsb-root.hsb-desktop .hsb-desktop-clear-icon { display: flex; color: #5f6368; }
  .hsb-shortcut { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 auto; width: 20px; height: 20px; margin-left: 4px; border: 1px solid #dadce0; border-radius: 6px; color: #80868b; font-family: 'DM Sans', 'Inter', system-ui, sans-serif; font-size: 12px; line-height: 1; }
  .hsb-shortcut.is-hidden { display: none; }
  .hsb-root.hsb-desktop .hsb-dropdown { top: calc(100% + 8px); border: 1px solid #e8eaed; border-radius: 14px; box-shadow: 0 12px 32px rgba(32,33,36,.14); padding: 8px 0; }
  .hsb-root.hsb-desktop .hsb-row { min-height: 44px; padding: 0 16px; gap: 12px; }
  .hsb-root.hsb-desktop .hsb-row:hover { background: #f1f3f4; }
  .hsb-recent-icon { display: inline-flex; align-items: center; justify-content: center; width: 16px; height: 16px; flex: 0 0 auto; color: #80868b; }
  .hsb-root.hsb-desktop .hsb-recent-title { display: block; font-family: 'DM Sans', 'Inter', system-ui, sans-serif; font-size: 14px; font-weight: 500; color: #202124; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  @media (min-width: 1100px) {
    .hsb-root.hsb-desktop { width: 100%; max-width: 100%; }
    .hsb-root.hsb-desktop .hsb-desk-form { height: 56px; min-height: 56px !important; padding: 0 10px 0 8px; border-radius: 999px; border: 2px solid #e8eaed; background: #fff; box-shadow: 0 1px 2px rgba(32,33,36,.06); display: flex; align-items: center; gap: 8px; transition: border-color .18s, box-shadow .18s; box-sizing: border-box; }
    .hsb-root.hsb-desktop .hsb-desk-form.is-focused { border-color: #0F9D58; box-shadow: 0 0 0 3px rgba(15,157,88,.12); }
    .hsb-desk-scope-wrap { position: relative; flex: 0 0 auto; }
    .hsb-desk-scope { height: 36px; display: flex; align-items: center; gap: 6px; padding: 0 8px; border: 0; border-radius: 999px; background: #f1f3f4; color: #202124; font-family: 'DM Sans', 'Inter', system-ui, sans-serif; font-size: 13px; font-weight: 600; cursor: pointer; }
    .hsb-desk-scope:hover { background: #e6f6ed; }
    .hsb-desk-scope svg:last-child { color: #80868b; }
    .hsb-desk-scope-menu { position: absolute; top: calc(100% + 10px); left: 0; z-index: 1302; width: 190px; padding: 6px; border: 1px solid #e8eaed; border-radius: 12px; background: #fff; box-shadow: 0 10px 28px rgba(32,33,36,.14); box-sizing: border-box; }
    .hsb-desk-scope-option { width: 100%; height: 38px; display: flex; align-items: center; gap: 10px; padding: 0 10px; border: 0; border-radius: 8px; background: transparent; color: #202124; font-family: 'DM Sans', 'Inter', system-ui, sans-serif; font-size: 13px; font-weight: 500; cursor: pointer; text-align: left; }
    .hsb-desk-scope-option:hover { background: #f6fbf8; }
    .hsb-desk-scope-option.is-selected { background: #e6f6ed; color: #0F9D58; font-weight: 700; }
    .hsb-desk-scope-option > span { flex: 1; }
    .hsb-desk-divider { width: 1px; height: 24px; flex: 0 0 auto; background: #e8eaed; }
    .hsb-desk-search-icon { display: flex; align-items: center; flex: 0 0 auto; color: #80868b; }
    .hsb-root.hsb-desktop .hsb-desk-input { flex: 1; min-width: 0; height: 54px !important; font-family: 'DM Sans', 'Inter', system-ui, sans-serif; font-size: 14px; font-weight: 500; color: #202124; }
    .hsb-root.hsb-desktop .hsb-desk-input::placeholder { color: #80868b; opacity: 1; }
    .hsb-desk-clear { width: 28px; height: 28px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; border: 0; border-radius: 50%; background: #f1f3f4; color: #5f6368; cursor: pointer; }
    .hsb-desk-location { max-width: 132px; height: 32px; flex: 0 1 auto; min-width: 0; display: flex; align-items: center; gap: 4px; padding: 0 8px; border-radius: 999px; background: #f1f3f4; color: #5f6368; font-family: 'DM Sans', 'Inter', system-ui, sans-serif; font-size: 12px; font-weight: 600; box-sizing: border-box; }
    .hsb-desk-location.is-default { background: transparent; color: #80868b; }
    .hsb-desk-location-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hsb-desk-location button { width: 18px; height: 18px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; border: 0; border-radius: 50%; background: transparent; color: #80868b; cursor: pointer; padding: 0; }
    .hsb-root.hsb-desktop .hsb-desk-dropdown { top: calc(100% + 8px); left: 0; right: 0; max-height: 420px; overflow-y: auto; border: 1px solid #e8eaed; border-radius: 14px; box-shadow: 0 12px 32px rgba(32,33,36,.16); padding: 6px 0; background: #fff; }
    .hsb-desk-label { padding: 8px 14px 6px; font-family: 'DM Sans', 'Inter', system-ui, sans-serif; font-size: 11px; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #80868b; }
    .hsb-desk-label.hsb-label-bordered { border-top: 1px solid #f1f3f4; margin-top: 6px; padding-top: 10px; }
    .hsb-desk-chips { display: flex; flex-wrap: wrap; gap: 6px; padding: 4px 14px 12px; }
    .hsb-desk-chip { height: 30px; display: inline-flex; align-items: center; gap: 6px; padding: 0 10px; border: 1px solid #e8eaed; border-radius: 999px; background: #fff; color: #5f6368; font-family: 'DM Sans', 'Inter', system-ui, sans-serif; font-size: 12px; font-weight: 600; cursor: pointer; }
    .hsb-desk-chip:hover { background: #e6f6ed; border-color: #b7e1c7; color: #0F9D58; }
    .hsb-root.hsb-desktop .hsb-desk-row { min-height: 48px; padding: 6px 14px; gap: 10px; border-radius: 0; }
    .hsb-root.hsb-desktop .hsb-desk-row.is-active { background: #e6f6ed; }
    .hsb-desk-tile { width: 30px; height: 30px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; border-radius: 8px; background: #e6f6ed; color: #0F9D58; overflow: hidden; box-sizing: border-box; }
    .hsb-desk-tile img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .hsb-desk-title { display: block; font-family: 'DM Sans', 'Inter', system-ui, sans-serif; font-size: 13px; font-weight: 600; color: #202124; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hsb-desk-meta { display: block; margin-top: 2px; font-family: 'DM Sans', 'Inter', system-ui, sans-serif; font-size: 11px; color: #80868b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .hsb-desk-row-arrow { flex: 0 0 auto; color: #c4c7c5; }
    .hsb-desk-footer { width: 100%; border: 0; border-top: 1px solid #f1f3f4; background: #fff; color: #0F9D58; font-family: 'DM Sans', 'Inter', system-ui, sans-serif; font-size: 12px; font-weight: 700; cursor: pointer; display: flex; align-items: center; justify-content: space-between; }
    .hsb-desk-toast { margin: 6px 10px 10px; padding: 10px 12px; border-radius: 10px; background: #f6fbf8; border: 1px solid #d9eddf; color: #5f6368; font-family: 'DM Sans', 'Inter', system-ui, sans-serif; font-size: 12px; line-height: 1.4; }
  }
`

function SearchIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function CloseIcon({ size = 9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

const RECENT_KEY = 'soko_recent_searches'
const GPS_CACHE_KEY = 'lf_gps_cache'
const GPS_CACHE_TTL = 10 * 60 * 1000

const SCOPES = [
  { key: 'all', label: 'All', Icon: SearchIconLucide, type: 'all' },
  { key: 'products', label: 'Products', Icon: ShoppingBagIconLucide, type: 'listings' },
  { key: 'shops', label: 'Shops', Icon: StoreIconLucide, type: 'shops' },
  { key: 'services', label: 'Services', Icon: WrenchIconLucide, type: 'services' },
  { key: 'lookingfor', label: 'Looking for', Icon: TargetIconLucide, type: 'lookingfor' },
]

const SCOPE_BY_KEY = Object.fromEntries(SCOPES.map(scope => [scope.key, scope]))
const TYPE_LABELS = { listings: 'Product', shops: 'Shop', services: 'Service', lookingfor: 'Looking for' }
const EMPTY_DESKTOP_RESULTS = { listings: [], shops: [], services: [], requests: [] }

function readRecentSearches() {
  try {
    const parsed = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]')
    return Array.isArray(parsed) ? parsed.filter(item => typeof item === 'string').slice(0, 5) : []
  } catch {
    return []
  }
}

function readCachedLocation() {
  try {
    const raw = sessionStorage.getItem(GPS_CACHE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed?.at || Date.now() - parsed.at >= GPS_CACHE_TTL || !parsed.data?.label) return null
    return parsed.data
  } catch {
    return null
  }
}

function firstImage(images) {
  if (Array.isArray(images)) return images[0] || ''
  if (images && typeof images === 'object') return images.url || ''
  return typeof images === 'string' ? images : ''
}

function amountLabel(amount) {
  const value = Number(amount)
  return value ? `MWK ${value.toLocaleString()}` : ''
}

function searchUrl(term, type, category = '', location = 'All Malawi') {
  const params = new URLSearchParams()
  params.set('q', term || '')
  params.set('type', type || 'all')
  if (category) params.set('category', category)
  if (location && location !== 'All Malawi') params.set('location', location)
  return `/search?${params.toString()}`
}

function categoryInfo(category) {
  if (!category || category.key === 'all' || category.key === 'More') return { category: '', type: 'all' }
  if (category.key === 'Services') return { category: 'Services', type: 'services' }
  const params = new URLSearchParams(category.action.includes('?') ? category.action.split('?')[1] : '')
  return { category: params.get('cat') || category.key, type: 'listings' }
}

function buildDesktopRows(groups, scope) {
  const listings = (groups.listings || []).map(item => ({
    id: `listing-${item.id}`,
    term: item.title,
    title: item.title,
    meta: [amountLabel(item.price), item.city || item.district].filter(Boolean).join(' · ') || TYPE_LABELS.listings,
    type: 'listings',
    category: item.category || '',
    image: firstImage(item.images),
    Icon: ShoppingBagIconLucide,
  }))
  const shops = (groups.shops || []).map(item => ({
    id: `shop-${item.id}`,
    term: item.name,
    title: item.name,
    meta: [item.category, item.city].filter(Boolean).join(' · ') || TYPE_LABELS.shops,
    type: 'shops',
    category: item.category || '',
    image: firstImage(item.logo_url),
    Icon: StoreIconLucide,
  }))
  const services = (groups.services || []).map(item => ({
    id: `service-${item.id}`,
    term: item.name,
    title: item.name,
    meta: [item.category, item.city].filter(Boolean).join(' · ') || TYPE_LABELS.services,
    type: 'services',
    category: item.category || '',
    image: '',
    Icon: WrenchIconLucide,
  }))
  const requests = (groups.requests || []).map(item => ({
    id: `request-${item.id}`,
    term: item.title,
    title: item.title,
    meta: [amountLabel(item.budget), item.city].filter(Boolean).join(' · ') || TYPE_LABELS.lookingfor,
    type: 'lookingfor',
    category: item.category || '',
    image: '',
    Icon: TargetIconLucide,
  }))

  if (scope === 'all') {
    return [
      ...listings.slice(0, 2),
      ...shops.slice(0, 1),
      ...services.slice(0, 1),
      ...requests.slice(0, 1),
    ]
  }
  const byScope = { products: listings, shops, services, lookingfor: requests }
  return (byScope[scope] || []).slice(0, 5)
}

export default function SearchBox({
  value = '',
  onChange,
  onSubmit,
  onSelect,
  onNotify,
  onFocusChange,
  navigate,
  user,
  placeholder = 'Search for anything...',
  variant = 'header',
  height = 44,
  style,
  desktopSearch = false,
}) {
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const scopeRef = useRef(null)
  const [focused, setFocusedState] = useState(false)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [notifyQuery, setNotifyQuery] = useState('')
  const [recentSearches, setRecentSearches] = useState(() => readRecentSearches())
  const [scope, setScope] = useState('all')
  const [scopeOpen, setScopeOpen] = useState(false)
  const [locationLabel, setLocationLabel] = useState(() => readCachedLocation()?.label || 'All Malawi')
  const [desktopResults, setDesktopResults] = useState(null)
  const [activeIndex, setActiveIndex] = useState(-1)

  const trimmed = value.trim()
  const isHeader = variant === 'header'
  const showDesktopHome = desktopSearch && focused && trimmed.length < 2
  const showDropdown = focused && (trimmed.length >= 2 || showDesktopHome)
  const currentScope = SCOPE_BY_KEY[scope] || SCOPES[0]
  const desktopRows = desktopSearch ? buildDesktopRows(desktopResults || EMPTY_DESKTOP_RESULTS, scope) : []

  function setFocused(next) {
    setFocusedState(next)
    onFocusChange?.(next)
  }

  useEffect(() => {
    if (desktopSearch) return undefined
    const q = trimmed.toLowerCase()
    if (!focused || q.length < 2) return undefined
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const [listingsData, shopsData] = await Promise.all([
          supabase.from('listings')
            .select('id,title,price,images,city')
            .in('status', ['published', 'active'])
            .ilike('title', `%${q}%`)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase.from('shops')
            .select('id,name,slug,logo_url,city')
            .eq('is_active', true)
            .ilike('name', `%${q}%`)
            .limit(3),
        ])
        if (cancelled) return
        setResults({
          listings: (listingsData.data || []).filter(l => !isJobListing(l)),
          shops: shopsData.data || [],
        })
      } catch (error) {
        console.error('Live search error:', error)
        if (!cancelled) setResults({ listings: [], shops: [] })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed, focused, desktopSearch])

  useEffect(() => {
    if (!desktopSearch) return undefined
    const q = trimmed.trim()
    if (!focused || q.length < 2) return undefined
    let cancelled = false
    const timer = setTimeout(async () => {
      const now = new Date().toISOString()
      const safe = async fn => {
        try {
          return await fn()
        } catch {
          return { data: [] }
        }
      }
      const [listingsData, shopsData, servicesData, requestsData] = await Promise.all([
        safe(() => supabase.from('listings')
          .select('id,title,price,images,city,category')
          .eq('status', 'published')
          .ilike('title', `%${q}%`)
          .order('created_at', { ascending: false })
          .limit(5)),
        safe(() => supabase.from('shops')
          .select('id,name,slug,logo_url,city,category')
          .eq('is_active', true)
          .ilike('name', `%${q}%`)
          .limit(4)),
        safe(() => supabase.from('services')
          .select('id,name,category,city')
          .eq('status', 'active')
          .ilike('name', `%${q}%`)
          .limit(4)),
        safe(() => supabase.from('buyer_requests')
          .select('id,title,budget,city,category')
          .not('status', 'eq', 'fulfilled')
          .or(`expires_at.is.null,expires_at.gt.${now}`)
          .ilike('title', `%${q}%`)
          .limit(4)),
      ])
      if (cancelled) return
      setDesktopResults({
        listings: (listingsData.data || []).filter(l => !isJobListing(l)),
        shops: shopsData.data || [],
        services: servicesData.data || [],
        requests: requestsData.data || [],
      })
      setLoading(false)
      setActiveIndex(-1)
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed, focused, desktopSearch, scope])

  useEffect(() => {
    function onDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        setFocused(false)
        setScopeOpen(false)
      }
    }
    function onKey(e) {
      if (e.key === 'Escape') {
        setFocused(false)
        setScopeOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  })

  useEffect(() => {
    if (!desktopSearch) return undefined
    function onSlash(e) {
      if (e.key !== '/' || e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return
      const active = document.activeElement
      const typing = active && (['INPUT', 'TEXTAREA', 'SELECT'].includes(active.tagName) || active.isContentEditable)
      if (typing) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener('keydown', onSlash)
    return () => document.removeEventListener('keydown', onSlash)
  }, [desktopSearch])

  function rememberSearch(term) {
    const query = term.trim()
    if (!query) return
    setRecentSearches(prev => {
      const next = [query, ...prev.filter(item => item.toLowerCase() !== query.toLowerCase())].slice(0, 5)
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next))
      } catch {
        return next
      }
      return next
    })
  }

  function submit() {
    if (!trimmed) return
    rememberSearch(trimmed)
    onSubmit?.(trimmed)
    setFocused(false)
  }

  function submitDesktop() {
    if (!trimmed) return
    rememberSearch(trimmed)
    navigate?.(searchUrl(trimmed, currentScope.type, '', locationLabel))
    setFocused(false)
    setScopeOpen(false)
    setActiveIndex(-1)
  }

  function select(term) {
    rememberSearch(term)
    onChange?.(term)
    onSelect?.(term)
    setFocused(false)
  }

  function openRow(row) {
    if (!row) return
    rememberSearch(row.term)
    onChange?.(row.term)
    navigate?.(searchUrl(row.term, row.type, row.category, locationLabel))
    setFocused(false)
    setActiveIndex(-1)
  }

  function openRecent(term) {
    rememberSearch(term)
    onChange?.(term)
    navigate?.(searchUrl(term, currentScope.type, '', locationLabel))
    setFocused(false)
    setActiveIndex(-1)
  }

  function openCategory(category) {
    const info = categoryInfo(category)
    const term = trimmed || category.label
    rememberSearch(term)
    navigate?.(searchUrl(term, info.type, info.category, locationLabel))
    setFocused(false)
    setActiveIndex(-1)
  }

  function openNotify(query) {
    setFocused(false)
    onNotify?.(query)
    setNotifyQuery(query)
    setNotifyOpen(true)
  }

  function go(path) {
    setFocused(false)
    navigate?.(path)
  }

  function handleKeyDown(e) {
    if (e.nativeEvent?.isComposing) return
    if (e.key === 'Escape') {
      setFocused(false)
      setScopeOpen(false)
      return
    }
    if (!desktopSearch) {
      if (e.key === 'Enter') submit()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (desktopRows.length > 0) setActiveIndex(index => (index + 1) % desktopRows.length)
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (desktopRows.length > 0) setActiveIndex(index => (index <= 0 ? desktopRows.length - 1 : index - 1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIndex >= 0 && desktopRows[activeIndex]) openRow(desktopRows[activeIndex])
      else submitDesktop()
    }
  }

  function handleChange(e) {
    onChange?.(e.target.value)
    setLoading(true)
    setActiveIndex(-1)
  }

  function renderScopeMenu() {
    return (
      <div className="hsb-desk-scope-menu" role="listbox" aria-label="Search scope">
        {SCOPES.map(item => {
          const ItemIcon = item.Icon
          return (
            <button
              key={item.key}
              type="button"
              role="option"
              aria-selected={scope === item.key}
              className={`hsb-desk-scope-option${scope === item.key ? ' is-selected' : ''}`}
              onClick={() => {
                setScope(item.key)
                setScopeOpen(false)
                setActiveIndex(-1)
                if (value.trim().length >= 2) setLoading(true)
                inputRef.current?.focus()
              }}
            >
              <ItemIcon size={16} strokeWidth={1.75} aria-hidden="true" />
              <span>{item.label}</span>
              {scope === item.key && <CheckIconLucide size={14} strokeWidth={1.75} aria-hidden="true" />}
            </button>
          )
        })}
      </div>
    )
  }

  function renderDesktopHome() {
    return (
      <>
        {recentSearches.length > 0 && (
          <>
            <div className="hsb-desk-label">Recent</div>
            {recentSearches.map(term => (
              <button key={term} type="button" className="hsb-row hsb-desk-row" onClick={() => openRecent(term)}>
                <span className="hsb-desk-tile"><ClockIconLucide size={15} strokeWidth={1.75} aria-hidden="true" /></span>
                <span className="hsb-row-body"><span className="hsb-recent-title">{term}</span></span>
                <ArrowUpRightIconLucide className="hsb-desk-row-arrow" size={14} strokeWidth={1.75} aria-hidden="true" />
              </button>
            ))}
          </>
        )}
        <div className={`hsb-desk-label${recentSearches.length > 0 ? ' hsb-label-bordered' : ''}`}>Popular</div>
        <div className="hsb-desk-chips">
          {CATEGORIES.map(category => {
            const CategoryIcon = category.icon
            return (
              <button key={category.key} type="button" className="hsb-desk-chip" onClick={() => openCategory(category)}>
                <CategoryIcon size={14} strokeWidth={1.75} aria-hidden="true" />
                <span>{category.label}</span>
              </button>
            )
          })}
        </div>
      </>
    )
  }

  function renderDesktopSkeleton() {
    return (
      <div className="hsb-skeleton-wrap">
        <div className="hsb-desk-label">Searching</div>
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="hsb-skeleton-row">
            <div className="hsb-desk-tile"><div className="hsb-skeleton" style={{ width: 30, height: 30 }} /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="hsb-skeleton" style={{ width: `${50 + i * 8}%`, height: 11, marginBottom: 6 }} />
              <div className="hsb-skeleton" style={{ width: `${25 + i * 5}%`, height: 9 }} />
            </div>
          </div>
        ))}
      </div>
    )
  }

  function renderDesktopSuggestions() {
    if (!desktopResults || desktopRows.length === 0) {
      return (
        <div className="hsb-desk-toast" role="status">
          Nothing found for {trimmed}. Try another word or switch scope.
        </div>
      )
    }
    return (
      <>
        {desktopRows.map((row, index) => {
          const RowIcon = row.Icon || SearchIconLucide
          return (
            <button
              key={row.id}
              type="button"
              className={`hsb-row hsb-desk-row${activeIndex === index ? ' is-active' : ''}`}
              onMouseEnter={() => setActiveIndex(index)}
              onClick={() => openRow(row)}
            >
              <span className="hsb-desk-tile">
                {row.image ? <img src={row.image} alt="" /> : <RowIcon size={15} strokeWidth={1.75} aria-hidden="true" />}
              </span>
              <span className="hsb-row-body">
                <span className="hsb-desk-title">{row.title}</span>
                <span className="hsb-desk-meta">
                  {scope === 'all'
                    ? `${TYPE_LABELS[row.type]}${row.category ? ` · ${row.category}` : ''}`
                    : row.meta}
                </span>
              </span>
              {activeIndex === index
                ? <CornerDownLeftIconLucide size={14} strokeWidth={1.75} aria-hidden="true" />
                : <ArrowUpRightIconLucide className="hsb-desk-row-arrow" size={13} strokeWidth={1.75} aria-hidden="true" />}
            </button>
          )
        })}
        <button type="button" className="hsb-row hsb-desk-row hsb-desk-footer" onClick={submitDesktop}>
          <span>See all results for {trimmed}</span>
          <ArrowUpRightIconLucide size={14} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </>
    )
  }

  function renderDesktop() {
    const ScopeIcon = currentScope.Icon
    return (
      <>
        <div className={`hsb-form hsb-desk-form${focused ? ' is-focused' : ''}`}>
          <div className="hsb-desk-scope-wrap" ref={scopeRef}>
            <button
              type="button"
              className="hsb-desk-scope"
              aria-haspopup="listbox"
              aria-expanded={scopeOpen}
              onClick={() => setScopeOpen(open => !open)}
            >
              <ScopeIcon size={15} strokeWidth={1.75} aria-hidden="true" />
              <span>{currentScope.label}</span>
              <ChevronDownIconLucide size={13} strokeWidth={1.75} aria-hidden="true" />
            </button>
            {scopeOpen && renderScopeMenu()}
          </div>
          <span className="hsb-desk-divider" aria-hidden="true" />
          <span className="hsb-desk-search-icon" aria-hidden="true"><SearchIconLucide size={17} strokeWidth={1.75} /></span>
          <input
            ref={inputRef}
            className="hsb-input hsb-desk-input"
            type="text"
            value={value}
            onChange={handleChange}
            onFocus={() => { setFocused(true); if (value.trim().length >= 2) setLoading(true) }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label="Search marketplace"
            style={{ height: 56 }}
          />
          {!!value && (
            <button
              type="button"
              className="hsb-desk-clear"
              aria-label="Clear search"
              onClick={() => { onChange?.(''); inputRef.current?.focus() }}
            >
              <XIconLucide size={15} strokeWidth={1.75} aria-hidden="true" />
            </button>
          )}
          <span className={`hsb-desk-location${locationLabel === 'All Malawi' ? ' is-default' : ''}`}>
            <MapPinIconLucide size={14} strokeWidth={1.75} aria-hidden="true" />
            <span className="hsb-desk-location-label">{locationLabel}</span>
            {locationLabel !== 'All Malawi' && (
              <button
                type="button"
                aria-label="Clear location"
                onClick={() => setLocationLabel('All Malawi')}
              >
                <XIconLucide size={11} strokeWidth={2} aria-hidden="true" />
              </button>
            )}
          </span>
          <span className={`hsb-shortcut${focused ? ' is-hidden' : ''}`} aria-hidden="true">/</span>
        </div>
        {showDropdown && (
          <div className="hsb-dropdown hsb-desk-dropdown">
            {trimmed.length < 2
              ? renderDesktopHome()
              : loading
                ? renderDesktopSkeleton()
                : renderDesktopSuggestions()}
          </div>
        )}
      </>
    )
  }

  function renderLegacy() {
    return (
      <>
        <div className={`hsb-form ${isHeader ? 'hsb-header-form' : 'hsb-hero-form'}${focused && isHeader ? ' is-focused' : ''}`} style={{ minHeight: isHeader ? height + 8 : height }}>
          {isHeader && (
            <span className="hsb-header-icon"><SearchIcon /></span>
          )}
          <input
            ref={inputRef}
            className={`hsb-input ${isHeader ? 'hsb-header-input' : 'hsb-hero-input'}`}
            type="text"
            value={value}
            onChange={e => { onChange?.(e.target.value); setLoading(true) }}
            onFocus={() => { setFocused(true); if (value.trim().length >= 2) setLoading(true) }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-label="Search marketplace"
            style={{ height }}
          />
          {isHeader && !!value && (
            <button
              type="button"
              className="hsb-clear"
              aria-label="Clear search"
              onClick={() => { onChange?.(''); inputRef.current?.focus() }}
            >
              <span className="hsb-clear-dot"><CloseIcon /></span>
            </button>
          )}
          <button type="button" className={`hsb-submit ${isHeader ? 'hsb-header-submit' : 'hsb-hero-submit'}`} onClick={submit} style={{ height }}>Search</button>
        </div>

        {showDropdown && (
          <div className="hsb-dropdown">
            {(trimmed.length < 2 && recentSearches.length > 0) ? (
              <>
                <div className="hsb-label">Recent searches</div>
                {recentSearches.map(term => (
                  <button key={term} type="button" className="hsb-row" onClick={() => select(term)}>
                    <span className="hsb-recent-icon"><ClockIconLucide size={16} strokeWidth={1.75} aria-hidden="true" /></span>
                    <span className="hsb-row-body"><span className="hsb-recent-title">{term}</span></span>
                  </button>
                ))}
              </>
            ) : loading ? (
              <div className="hsb-skeleton-wrap">
                <div className="hsb-label">Searching products...</div>
                {[1, 2, 3].map(i => (
                  <div key={i} className="hsb-skeleton-row">
                    <div className="hsb-skeleton" style={{ width: 32, height: 32, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="hsb-skeleton" style={{ width: `${60 + i * 10}%`, height: 12, marginBottom: 6 }} />
                      <div className="hsb-skeleton" style={{ width: `${30 + i * 5}%`, height: 10 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : results ? (
              <>
                {results.listings.length > 0 && (
                  <>
                    <div className="hsb-label">Products</div>
                    {results.listings.map(item => (
                      <button key={item.id} type="button" className="hsb-row" onClick={() => select(item.title)}>
                        <div className="hsb-thumb">
                          {item.images?.[0] && <img src={item.images[0]} alt="" />}
                        </div>
                        <div className="hsb-row-body">
                          <div className="hsb-row-title">{item.title}</div>
                          <div className="hsb-row-meta">
                            {item.price ? `MK ${Number(item.price).toLocaleString()}` : ''}{item.city ? ` · ${item.city}` : ''}
                          </div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {results.shops.length > 0 && (
                  <>
                    <div className={`hsb-label${results.listings.length > 0 ? ' hsb-label-bordered' : ''}`}>Shops</div>
                    {results.shops.map(shop => (
                      <button key={shop.id} type="button" className="hsb-row" onClick={() => select(shop.name)}>
                        <div className="hsb-thumb">
                          {shop.logo_url && <img src={shop.logo_url} alt="" />}
                        </div>
                        <div className="hsb-row-body">
                          <div className="hsb-row-title">{shop.name}</div>
                          <div className="hsb-row-meta">{shop.city || 'Shop'}</div>
                        </div>
                      </button>
                    ))}
                  </>
                )}
                {results.listings.length === 0 && results.shops.length === 0 && (
                  <div className="hsb-empty">
                    <div className="hsb-empty-title">No products found for &ldquo;{trimmed}&rdquo;</div>
                    <div className="hsb-empty-hint">Try:</div>
                    <ul className="hsb-empty-list">
                      <li>Different spelling</li>
                      <li>Browse categories</li>
                      <li>View latest listings</li>
                    </ul>
                    <button type="button" className="hsb-notify" onClick={() => openNotify(trimmed)}>
                      Notify me when &ldquo;{trimmed}&rdquo; is available
                    </button>
                    <div className="hsb-empty-actions">
                      <button type="button" className="hsb-secondary" onClick={() => go('/search')}>Explore Categories</button>
                      <button type="button" className="hsb-tertiary" onClick={() => go('/search?sort=newest')}>View Latest Products</button>
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}
      </>
    )
  }

  return (
    <div className={`hsb-root${desktopSearch ? ' hsb-desktop' : ''}`} ref={rootRef} style={style}>
      <style>{css}</style>
      {desktopSearch ? renderDesktop() : renderLegacy()}
      {notifyOpen && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1400 }}>
          <NotifyMeModal query={notifyQuery} user={user} onClose={() => setNotifyOpen(false)} />
        </div>,
        document.body,
      )}
    </div>
  )
}
