/**
 * SokoMW — SearchPage.jsx
 * Search results page with left filter sidebar + right results grid.
 * Design: matches the reference screenshot exactly.
 *
 * Props / routing: reads `?q=` from URL, wires to Supabase listings table.
 * Reuses the same SokoNav from Home.jsx (imported as a sibling component).
 * All design tokens mirror Home.jsx T object for visual consistency.
 *
 * v2 — multi-pillar search: tabs across Marketplace (listings), Shops,
 * People Looking For (buyer_requests), Jobs, and Services. Each tab queries
 * its own real Supabase table (matching the schemas used in Home.jsx's
 * loadAuxSections) instead of every search only hitting `listings`.
 */

import React, {
  useEffect, useState, useMemo, useCallback, useRef,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isListingFeatured, rotateFeaturedFairly } from '../utils/homeUtils'
import { buildChatPath } from '../utils/chatSources'
import SokoNav from '../components/SokoNav'

/* ─────────────────────────────────────────────────────────────────────────────
   DESIGN TOKENS — identical to Home.jsx T
───────────────────────────────────────────────────────────────────────────── */
const T = {
  green:   '#0F9D58',
  greenD:  '#0a7a44',
  greenDk: '#063d23',
  greenL:  '#e8f5ee',
  amber:   '#F9AB00',
  amberD:  '#c88a00',
  blue:    '#1A73E8',
  blueL:   '#e8f0fe',
  red:     '#ea4335',
  violet:  '#7c5cff',
  violetL: '#efeaff',
  gray50:  '#f8f9fa',
  gray100: '#f1f3f4',
  gray200: '#e8eaed',
  gray300: '#dadce0',
  gray400: '#bdc1c6',
  gray500: '#9aa0a6',
  gray600: '#80868b',
  gray700: '#5f6368',
  gray800: '#3c4043',
  gray900: '#202124',
  white:   '#ffffff',
  shadow:   '0 1px 3px rgba(0,0,0,0.12), 0 4px 16px rgba(0,0,0,0.08)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.12), 0 8px 32px rgba(0,0,0,0.08)',
  shadowLg: '0 8px 24px rgba(0,0,0,0.14), 0 16px 48px rgba(0,0,0,0.1)',
  radius:   '20px',
  radiusSm: '12px',
  font:        "'Inter', 'DM Sans', system-ui, sans-serif",
  fontDisplay: "'Sora', 'Inter', system-ui, sans-serif",
}

/* ─────────────────────────────────────────────────────────────────────────────
   INLINE SVG ICONS
───────────────────────────────────────────────────────────────────────────── */
const Icon = {
  search:   (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  bell:     (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  chat:     (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  user:     (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  plus:     (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  heart:    (s=16, fill='none') => <svg width={s} height={s} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  verify:   (s=14) => <svg width={s} height={s} viewBox="0 0 24 24"><path fill="#16a34a" d="M12 0a4 4 0 0 1 3.2 1.6 4 4 0 0 1 3.6 1 4 4 0 0 1 1 3.6A4 4 0 0 1 21.4 9.4a4 4 0 0 1 0 5.2A4 4 0 0 1 19.8 17.8a4 4 0 0 1-1 3.6 4 4 0 0 1-3.6 1A4 4 0 0 1 12 24a4 4 0 0 1-3.2-1.6 4 4 0 0 1-3.6-1 4 4 0 0 1-1-3.6A4 4 0 0 1 2.6 14.6a4 4 0 0 1 0-5.2A4 4 0 0 1 4.2 6.2a4 4 0 0 1 1-3.6 4 4 0 0 1 3.6-1A4 4 0 0 1 12 0Z"/><path d="m7.5 12.5 3 3 6-7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  clock:    (s=13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  pin:      (s=13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>,
  chevR:    (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
  chevL:    (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>,
  x:        (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  check:    (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  grid:     (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  list:     (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  shop:     (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  chevDown: (s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>,
  fire:     (s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill={T.red}><path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z"/></svg>,
  filter:   (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>,
  briefcase:(s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
  wrench:   (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  handshake:(s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 17l-4-4 5-5 4 4z"/><path d="M2 13l4 4 1-1"/><path d="M21 13l-4 4-1-1"/></svg>,
  star:     (s=13,fill='#F9AB00') => <svg width={s} height={s} viewBox="0 0 24 24" fill={fill}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  phoneCall:(s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
}

function listingAllowsCall(listing) {
  if (!listing?.call_number) return false
  const methods = listing.contact_methods
  if (Array.isArray(methods)) {
    if (methods.length === 0) return false
    return methods.map(String).map(m => m.toLowerCase()).includes('call')
  }
  if (typeof methods === 'string') return methods.toLowerCase().includes('call')
  return true
}

/** Chat + Call row on product cards (same pattern as Home) */
function ListingCardActions({ listing, user, navigate }) {
  const canCall = listingAllowsCall(listing)
  const isOwner = !!(user?.id && listing?.seller_id && user.id === listing.seller_id)

  function goLogin() {
    try {
      sessionStorage.setItem('soko_post_login', JSON.stringify({
        type: 'chat',
        sellerId: listing.seller_id,
        listingId: listing.id,
      }))
    } catch { /* ignore */ }
    navigate('/login')
  }

  function handleChat(e) {
    e.stopPropagation()
    if (!listing?.seller_id) {
      navigate('/listing/' + listing.id)
      return
    }
    if (isOwner) {
      navigate('/listing/' + listing.id)
      return
    }
    if (!user?.id) {
      goLogin()
      return
    }
    navigate(buildChatPath(listing.seller_id, { source: 'listing', contextId: listing.id }), {
      state: { source: 'listing' },
    })
  }

  function handleCall(e) {
    e.stopPropagation()
    if (!canCall) return
    const num = String(listing.call_number).replace(/\s+/g, '')
    window.open(`tel:${num}`, '_self')
  }

  return (
    <div className="sp-card-actions" onClick={e => e.stopPropagation()}>
      <button type="button" className="sp-qa-chat" onClick={handleChat}>
        {Icon.chat(13)}
        <span>{isOwner ? 'View' : 'Chat'}</span>
      </button>
      {canCall && !isOwner && (
        <button type="button" className="sp-qa-call" onClick={handleCall} aria-label="Call seller">
          {Icon.phoneCall(14)}
        </button>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */
function dedupeLocation(city, area) {
  const c = (city || '').trim()
  const a = (area || '').trim()
  if (!c && !a) return ''
  if (!a) return c
  if (!c) return a
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const nc = norm(c), na = norm(a)
  // Drop area if it's the same as city or fully contained in it (or vice versa)
  if (nc === na || nc.includes(na) || na.includes(nc)) return c
  return `${c}, ${a}`
}

function formatPrice(n) {
  if (!n && n !== 0) return ''
  if (n >= 1_000_000) return `MK ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `MK ${(n / 1_000).toFixed(0)}K`
  return `MK ${n.toLocaleString()}`
}

function isFlashSaleActive(listing) {
  return listing.flash_sale_price && listing.flash_sale_ends_at &&
    new Date(listing.flash_sale_ends_at).getTime() > Date.now()
}

function timeAgo(ts) {
  if (!ts) return ''
  const d = Date.now() - new Date(ts)
  const h = Math.floor(d / 3600000)
  const m = Math.floor(d / 60000)
  if (h >= 24) return `${Math.floor(h / 24)}d ago`
  if (h >= 1)  return `${h}h ago`
  if (m < 1)   return 'just now'
  return `${m}m ago`
}

/* ─────────────────────────────────────────────────────────────────────────────
   SEARCH TABS — one per SokoMW pillar. Each tab queries its own table;
   counts are fetched in parallel up front so badges populate without
   forcing a tab switch.
───────────────────────────────────────────────────────────────────────────── */
const SEARCH_TABS = [
  { key: 'listings', label: 'Marketplace',        icon: (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10"/></svg> },
  { key: 'shops',    label: 'Shops',               icon: (s) => Icon.shop(s) },
  { key: 'lookingfor', label: 'People Looking For', icon: (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg> },
  { key: 'jobs',     label: 'Jobs',                icon: (s) => Icon.briefcase(s) },
  { key: 'services', label: 'Services',            icon: (s) => Icon.wrench(s) },
]

/* ─────────────────────────────────────────────────────────────────────────────
   CATEGORIES (nested for sidebar checkbox tree)
───────────────────────────────────────────────────────────────────────────── */
/* Mirrors PostListing.jsx's SUBCATEGORIES map exactly, so a listing's
   category/subcategory always resolves to a real node in this tree. */
const CATEGORY_TREE = [
  { key: 'Electronics', label: 'Electronics', children: [
    { key: 'Phones & Tablets',    label: 'Phones & Tablets' },
    { key: 'Laptops & Computers', label: 'Laptops & Computers' },
    { key: 'TVs & Audio',         label: 'TVs & Audio' },
    { key: 'Cameras',             label: 'Cameras' },
    { key: 'Accessories',         label: 'Accessories' },
    { key: 'Other Electronics',   label: 'Other' },
  ]},
  { key: 'Furniture', label: 'Furniture', children: [
    { key: 'Sofas & Chairs',      label: 'Sofas & Chairs' },
    { key: 'Beds & Mattresses',   label: 'Beds & Mattresses' },
    { key: 'Tables & Desks',      label: 'Tables & Desks' },
    { key: 'Cabinets & Shelves',  label: 'Cabinets & Shelves' },
    { key: 'Office Furniture',    label: 'Office Furniture' },
    { key: 'Other Furniture',     label: 'Other' },
  ]},
  { key: 'Clothing', label: 'Fashion', children: [
    { key: "Men's Wear",          label: "Men's Wear" },
    { key: "Women's Wear",        label: "Women's Wear" },
    { key: "Kids' Wear",          label: "Kids' Wear" },
    { key: 'Shoes',                label: 'Shoes' },
    { key: 'Bags & Accessories',  label: 'Bags & Accessories' },
    { key: 'Traditional Wear',    label: 'Traditional Wear' },
  ]},
  { key: 'Vehicles', label: 'Vehicles', children: [
    { key: 'Cars',        label: 'Cars' },
    { key: 'Motorcycles', label: 'Motorcycles' },
    { key: 'Trucks & Vans', label: 'Trucks & Vans' },
    { key: 'Auto Parts',  label: 'Auto Parts' },
    { key: 'Bicycles',    label: 'Bicycles' },
    { key: 'Other Vehicles', label: 'Other' },
  ]},
  { key: 'Property', label: 'Property', children: [
    { key: 'Houses for Sale', label: 'Houses for Sale' },
    { key: 'Houses for Rent', label: 'Houses for Rent' },
    { key: 'Land & Plots',    label: 'Land & Plots' },
    { key: 'Commercial Property', label: 'Commercial Property' },
    { key: 'Apartments',      label: 'Apartments' },
    { key: 'Short Stays',     label: 'Short Stays' },
  ]},
  { key: 'Agriculture', label: 'Agriculture', children: [
    { key: 'Livestock',        label: 'Livestock' },
    { key: 'Farm Equipment',   label: 'Farm Equipment' },
    { key: 'Seeds & Fertilizer', label: 'Seeds & Fertilizer' },
    { key: 'Crops & Produce',  label: 'Crops & Produce' },
    { key: 'Poultry',          label: 'Poultry' },
    { key: 'Other Agriculture', label: 'Other' },
  ]},
  { key: 'Food', label: 'Food', children: [
    { key: 'Fresh Produce',   label: 'Fresh Produce' },
    { key: 'Packaged Foods',  label: 'Packaged Foods' },
    { key: 'Beverages',       label: 'Beverages' },
    { key: 'Baked Goods',     label: 'Baked Goods' },
    { key: 'Catering',        label: 'Catering' },
    { key: 'Other Food',      label: 'Other' },
  ]},
  { key: 'Services', label: 'Services', children: [
    { key: 'Home Services',           label: 'Home Services' },
    { key: 'Beauty & Wellness',       label: 'Beauty & Wellness' },
    { key: 'Repairs & Maintenance',   label: 'Repairs & Maintenance' },
    { key: 'Events & Rentals',        label: 'Events & Rentals' },
    { key: 'Professional Services',   label: 'Professional Services' },
    { key: 'Other Services',          label: 'Other' },
  ]},
  { key: 'Jobs',  label: 'Jobs' },
  { key: 'Other', label: 'Other' },
]

/* Flat lookup: subcategory key -> parent category key, used to keep the
   tree's checkbox states in sync in both directions. */
const SUBCAT_PARENT = CATEGORY_TREE.reduce((map, node) => {
  (node.children || []).forEach(child => { map[child.key] = node.key })
  return map
}, {})

/* Mirrors PostListing.jsx's CONDITIONS exactly, so filter values line up
   with what's actually stored in listings.condition. */
const CONDITIONS = [
  { key: 'new',        label: 'Brand New' },
  { key: 'like_new',   label: 'Like New' },
  { key: 'used_good',  label: 'Used - Good' },
  { key: 'used_fair',  label: 'Used - Fair' },
  { key: 'for_parts',  label: 'For Parts' },
]

/* Mirrors PostListing.jsx's availability_status field. */
const AVAILABILITY_OPTIONS = [
  { key: 'in_stock',      label: 'In Stock' },
  { key: 'made_to_order', label: 'Made to Order' },
  { key: 'not_available', label: 'Not Available' },
]

const ALL_DISTRICTS = [
  'All Districts','Lilongwe','Blantyre','Mzuzu','Zomba','Kasungu',
  'Mangochi','Salima','Dedza','Ntchisi','Dowa','Karonga',
  'Nkhata Bay','Rumphi','Mzimba','Nkhotakota','Ntcheu',
  'Balaka','Machinga','Chiradzulu','Thyolo','Mulanje','Phalombe',
  'Chikwawa','Nsanje','Mwanza','Neno','Likoma',
]

const PILLARS = [
  { key: 'marketplace', label: 'Marketplace',         path: '/',            icon: (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10"/></svg> },
  { key: 'shops',       label: 'Shops',               path: '/shops',       icon: (s) => Icon.shop(s) },
  { key: 'lookingfor',  label: 'People Looking For',  path: '/looking-for', icon: (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg> },
  { key: 'jobs',        label: 'Jobs',                path: '/jobs',        icon: (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg> },
  { key: 'services',    label: 'Services',            path: '/services',    icon: (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg> },
  { key: 'stories',     label: 'Statuses (Stories)', path: '/status',       icon: (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { key: 'verify',      label: 'Verification',        path: '/profile',     icon: (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg> },
]

/* ─────────────────────────────────────────────────────────────────────────────
   GLOBAL STYLES
───────────────────────────────────────────────────────────────────────────── */
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #f8f9fa; }
      .sp-root {
        font-family: ${T.font}; background: #f8f9fa; color: ${T.gray900};
        min-height: 100vh; padding-bottom: 24px;
      }
      .sp-root button { font-family: inherit; }
      .sp-root input  { font-family: inherit; }
      .sp-scroll::-webkit-scrollbar { display: none; }
      .sp-scroll { -ms-overflow-style: none; scrollbar-width: none; }
      .sp-page { max-width: 1400px; margin: 0 auto; padding: 0 20px; }
      .sp-summary {
        display: flex; align-items: flex-start; justify-content: space-between;
        padding: 18px 0 0; flex-wrap: wrap; gap: 8px;
      }
      .sp-summary-title { font-size: 17px; font-weight: 700; color: ${T.gray900}; line-height: 1.3; }
      .sp-summary-count { font-size: 14px; color: ${T.gray600}; font-weight: 500; }
      .sp-body {
        display: flex; gap: 24px; align-items: flex-start;
        padding-top: 18px; padding-bottom: 40px;
      }
      .sp-main { flex: 1; min-width: 0; }
      .sp-toolbar {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 16px; flex-wrap: wrap; gap: 10px;
        position: sticky; top: 108px; z-index: 40;
        background: rgba(248,249,250,0.92); backdrop-filter: blur(10px);
        -webkit-backdrop-filter: blur(10px);
        padding: 8px 0; margin-left: -2px; margin-right: -2px;
      }
      .sp-results-grid.grid-4 {
        display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px;
      }
      .sp-results-grid.list-mode {
        display: flex; flex-direction: column; gap: 12px;
      }

      @keyframes fadeUp   { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
      @keyframes shimmer  { 0% { background-position:-600px 0; } 100% { background-position:600px 0; } }
      @keyframes badgePop { 0% { transform:scale(.7); opacity:0; } 70% { transform:scale(1.1); } 100% { transform:scale(1); opacity:1; } }
      @keyframes hotDealPulse {
        0%, 100% { box-shadow: 0 2px 8px rgba(234,67,53,0.4), 0 0 0 0 rgba(234,67,53,0.5); }
        50%      { box-shadow: 0 2px 8px rgba(234,67,53,0.4), 0 0 0 6px rgba(234,67,53,0); }
      }
      .sp-hotdeal-badge { animation: hotDealPulse 1.8s ease-in-out infinite; }

      .skeleton {
        background: linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);
        background-size: 600px 100%; animation: shimmer 1.4s infinite; border-radius:10px;
      }

      /* nav */
      .sp-nav-glass {
        position: sticky; top:0; z-index:100;
        backdrop-filter: blur(20px) saturate(1.8); -webkit-backdrop-filter: blur(20px) saturate(1.8);
        background: rgba(255,255,255,.92); border-bottom:1px solid rgba(0,0,0,.07);
        box-shadow: 0 1px 0 rgba(0,0,0,.04), 0 4px 20px rgba(0,0,0,.04);
      }

      /* search tabs */
      .sp-search-tab {
        display:flex; align-items:center; gap:7px; padding:10px 16px;
        background:none; border:none; cursor:pointer;
        font-size:13.5px; font-weight:600; color:${T.gray600};
        border-bottom:2.5px solid transparent; white-space:nowrap; flex-shrink:0;
        transition: color .15s, border-color .15s;
      }
      .sp-search-tab.active { color:${T.green}; border-bottom-color:${T.green}; font-weight:700; }
      .sp-search-tab:hover:not(.active) { color:${T.green}; }
      .sp-tab-count {
        background:${T.gray100}; color:${T.gray700}; border-radius:50px;
        padding:1px 7px; font-size:11px; font-weight:700;
      }
      .sp-search-tab.active .sp-tab-count { background:${T.greenL}; color:${T.green}; }

      /* filter sidebar — outer element handles sticky positioning only;
         inner .sp-sidebar-panel handles all animation/transform so the
         transform never fights with position:sticky's layout math. */
      .sp-sidebar { width: 220px; flex-shrink: 0; }
      .sp-sidebar-panel { width: 100%; box-sizing: border-box; }
      .sp-check-row { display:flex; align-items:center; gap:8px; cursor:pointer; padding:4px 0; }
      .sp-check-row:hover .sp-check-box { border-color: ${T.green}; }
      .sp-check-box {
        width:16px; height:16px; border-radius:4px; border:1.5px solid ${T.gray300};
        display:flex; align-items:center; justify-content:center;
        background:#fff; flex-shrink:0; transition: border-color .15s, background .15s;
      }
      .sp-check-box.checked { background:${T.green}; border-color:${T.green}; }
      .sp-toggle-track {
        width:42px; height:24px; border-radius:50px; background:${T.gray200};
        position:relative; cursor:pointer; transition:background .2s; flex-shrink:0;
      }
      .sp-toggle-track.on { background:${T.green}; }
      .sp-toggle-thumb {
        position:absolute; top:3px; left:3px; width:18px; height:18px;
        border-radius:50%; background:#fff; box-shadow:0 1px 4px rgba(0,0,0,.2);
        transition:left .2s cubic-bezier(.34,1.2,.64,1);
      }
      .sp-toggle-track.on .sp-toggle-thumb { left:21px; }

      /* result cards */
      .sp-card {
        background:#fff; border-radius:${T.radiusSm}; overflow:hidden;
        border:1px solid ${T.gray100};
        box-shadow:${T.shadow};
        cursor:pointer; display:flex; flex-direction:column;
        transition: transform .22s cubic-bezier(.34,1.2,.64,1), box-shadow .22s ease, border-color .22s ease;
        animation: fadeUp .4s ease both;
      }
      .sp-card:hover {
        transform:translateY(-5px);
        box-shadow:${T.shadowMd};
        border-color:${T.gray200};
      }
      .sp-card:hover .sp-card-img { transform:scale(1.06); }
      .sp-card-img { transition:transform .5s cubic-bezier(.22,1,.36,1); }

      /* Quick actions — Chat + Call (Home product cards) */
      .sp-card-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
        min-height: 38px;
        padding: 0 10px 10px;
        margin-top: auto;
        box-sizing: border-box;
      }
      .sp-qa-chat {
        flex: 1 1 auto;
        min-width: 0;
        height: 32px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        border: none;
        border-radius: 10px;
        background: ${T.greenL};
        color: ${T.greenD};
        font-size: 12px;
        font-weight: 700;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.15s, transform 0.1s;
        -webkit-tap-highlight-color: transparent;
      }
      .sp-qa-chat:hover { background: #d4eddf; }
      .sp-qa-chat:active { transform: scale(0.98); }
      .sp-qa-call {
        flex: 0 0 32px;
        width: 32px;
        height: 32px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        border: 1px solid ${T.gray200};
        border-radius: 10px;
        background: #fff;
        color: ${T.gray800};
        cursor: pointer;
        transition: border-color 0.15s, background 0.15s, transform 0.1s;
        -webkit-tap-highlight-color: transparent;
      }
      .sp-qa-call:hover { border-color: ${T.green}; color: ${T.greenD}; background: ${T.greenL}; }
      .sp-qa-call:active { transform: scale(0.96); }
      .sp-card-list-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
        padding: 0 12px 0 0;
        align-self: center;
      }
      @media (max-width: 540px) {
        .sp-card-list-actions {
          width: 100%;
          padding: 0 12px 12px;
          align-self: stretch;
        }
        .sp-card-list-actions .sp-qa-chat { flex: 1; }
      }

      /* list-mode card */
      .sp-card-list {
        background:#fff; border-radius:14px; overflow:hidden;
        border:1px solid ${T.gray100}; box-shadow:${T.shadow};
        cursor:pointer; display:flex; flex-direction:row; align-items:stretch;
        transition: transform .22s, box-shadow .22s, border-color .22s;
        animation: fadeUp .4s ease both;
      }
      .sp-card-list:hover { transform:translateY(-3px); box-shadow:${T.shadowMd}; border-color:${T.gray200}; }
      .sp-card-list:hover .sp-card-img { transform:scale(1.05); }

      /* generic row card (jobs / services / shops / requests) */
      .sp-row-card {
        background:#fff; border-radius:14px; border:1px solid ${T.gray100};
        box-shadow:${T.shadow}; padding:14px 16px; display:flex; align-items:center; gap:14px;
        cursor:pointer; transition: transform .2s, box-shadow .2s, border-color .2s;
        animation: fadeUp .4s ease both;
      }
      .sp-row-card:hover { transform:translateY(-3px); box-shadow:${T.shadowMd}; border-color:${T.gray200}; }

      .sp-see-more:hover:not(:disabled) {
        background: ${T.greenL} !important;
        transform: translateY(-1px);
      }
      .sp-see-more:active:not(:disabled) { transform: scale(0.98); }

      /* sort/view bar */
      .sp-sort-select {
        appearance:none; border:1.5px solid ${T.gray200}; border-radius:10px;
        padding:8px 32px 8px 12px; font-size:13px; font-weight:600;
        color:${T.gray800}; background:#fff; cursor:pointer;
        background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235f6368' stroke-width='2.5' stroke-linecap='round'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
        background-repeat: no-repeat; background-position: right 10px center;
        outline:none; transition:border-color .15s;
      }
      .sp-sort-select:hover { border-color:${T.green}; }

      .sp-view-btn {
        width:36px; height:36px; border-radius:8px; border:1.5px solid ${T.gray200};
        background:#fff; display:flex; align-items:center; justify-content:center;
        color:${T.gray600}; cursor:pointer; transition:all .15s;
      }
      .sp-view-btn.active { background:${T.green}; border-color:${T.green}; color:#fff; }
      .sp-view-btn:hover:not(.active) { border-color:${T.green}; color:${T.green}; }

      /* mobile filter drawer */
      .sp-filter-drawer {
        position:fixed; inset:0; z-index:200; display:flex;
      }
      .sp-filter-drawer-overlay {
        position:absolute; inset:0; background:rgba(0,0,0,.45); backdrop-filter:blur(2px);
      }
      .sp-filter-drawer-panel {
        position:relative; z-index:1; width:290px; height:100%;
        background:#fff; overflow-y:auto; padding:20px 18px 80px;
        box-shadow:4px 0 32px rgba(0,0,0,.18);
        animation: slideInLeft .25s cubic-bezier(.22,1,.36,1);
      }
      @keyframes slideInLeft { from { transform:translateX(-100%); } to { transform:translateX(0); } }

      /* Sidebar — deliberately slower, weightier, more "premium" motion than
         the card grid's snappy bouncy fadeUp/hover language. This is meant
         to be clearly visible: a big slide+scale entrance, a real elevation
         lift on scroll, and a continuous soft ambient glow — nothing subtle. */
      @keyframes sidebarSettle {
        0%   { opacity:0; transform:translateX(-48px) scale(.94); }
        60%  { opacity:1; transform:translateX(6px) scale(1.01); }
        100% { opacity:1; transform:translateX(0) scale(1); }
      }
      @keyframes sidebarGlow {
        0%, 100% { box-shadow: 0 8px 28px rgba(15,157,88,0.08), ${T.shadow}; }
        50%      { box-shadow: 0 14px 40px rgba(15,157,88,0.16), ${T.shadow}; }
      }
      .sp-sidebar-panel {
        animation:
          sidebarSettle .7s cubic-bezier(.16,1,.3,1) both,
          sidebarGlow 5s ease-in-out 1.2s infinite;
        transition: box-shadow .5s cubic-bezier(.16,1,.3,1), transform .5s cubic-bezier(.16,1,.3,1), border-color .5s ease;
      }
      .sp-sidebar-panel.stuck {
        box-shadow: ${T.shadowLg}, 0 0 0 1px rgba(15,157,88,0.12);
        transform: translateY(6px) scale(1.015);
        border-color: ${T.greenL} !important;
      }
      .sp-sidebar-panel .sp-check-row,
      .sp-sidebar-panel .sp-toggle-track,
      .sp-sidebar-panel select,
      .sp-sidebar-panel input {
        transition: all .3s cubic-bezier(.16,1,.3,1);
      }
      .sp-sidebar-panel .sp-check-row:hover {
        transform: translateX(3px);
      }
      .sp-sidebar-panel .sp-check-box {
        transition: border-color .3s cubic-bezier(.16,1,.3,1), background .3s cubic-bezier(.16,1,.3,1), transform .3s cubic-bezier(.16,1,.3,1);
      }
      .sp-sidebar-panel .sp-check-row:active .sp-check-box {
        transform: scale(.82);
      }
      .sp-sidebar-panel .sp-check-box.checked {
        animation: sidebarCheckPop .4s cubic-bezier(.34,1.6,.64,1);
      }
      @keyframes sidebarCheckPop {
        0%   { transform:scale(.6) rotate(-8deg); }
        55%  { transform:scale(1.25) rotate(4deg); }
        100% { transform:scale(1) rotate(0); }
      }
      /* Subcategory reveal — a deliberate slide-and-grow unfold, distinct
         from the checkbox pop and clearly different from card hover motion */
      .sp-subcat-wrap {
        animation: sidebarSubReveal .45s cubic-bezier(.16,1,.3,1) both;
        overflow: hidden;
        transform-origin: top;
      }
      @keyframes sidebarSubReveal {
        0%   { opacity:0; transform:translateY(-10px) scaleY(.85); max-height:0; }
        100% { opacity:1; transform:translateY(0) scaleY(1); max-height:600px; }
      }

      @media (max-width: 1100px) {
        .sp-results-grid.grid-4 { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 12px !important; }
      }
      @media (max-width: 900px) {
        .sp-root { padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px)); }
        .sp-page { padding: 0 14px !important; }
        .sp-sidebar { display: none !important; }
        .sp-mobile-filter-btn { display: inline-flex !important; }
        .sp-body { gap: 0 !important; padding-top: 12px !important; padding-bottom: 24px !important; }
        .sp-summary { padding-top: 12px !important; gap: 4px !important; }
        .sp-summary-title { font-size: 15.5px !important; }
        .sp-summary-count { font-size: 12.5px !important; width: 100%; }
        .sp-toolbar {
          top: 96px !important;
          gap: 8px !important;
          margin-bottom: 12px !important;
          padding: 6px 0 !important;
        }
        .sp-search-tab {
          padding: 9px 12px !important;
          font-size: 12.5px !important;
        }
        .sp-results-grid.grid-4 {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 10px !important;
        }
        .sp-card {
          border-radius: 14px !important;
        }
        .sp-card:hover { transform: none !important; }
        .sp-card-list {
          border-radius: 14px !important;
        }
        .sp-card-list:hover { transform: none !important; }
        .sp-row-card {
          padding: 12px !important;
          gap: 12px !important;
          border-radius: 14px !important;
        }
        .sp-row-card:hover { transform: none !important; }
        .sp-sort-select {
          font-size: 12.5px !important;
          padding: 8px 28px 8px 10px !important;
          min-height: 40px;
        }
        .sp-view-btn { width: 40px !important; height: 40px !important; }
        .sp-see-more { width: 100%; max-width: 280px; }
        .sp-filter-drawer-panel {
          width: min(320px, 88vw) !important;
          padding: 16px 14px calc(24px + env(safe-area-inset-bottom)) !important;
        }
        .sp-tabs-scroll {
          margin-left: -14px;
          margin-right: -14px;
          padding-left: 14px !important;
          padding-right: 14px !important;
          scroll-padding-inline: 14px;
        }
      }
      @media (max-width: 540px) {
        /* Keep 2-col marketplace density on phones */
        .sp-results-grid.grid-4 {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 8px !important;
        }
        .sp-card .sp-card-body-pad {
          padding: 8px 9px 10px !important;
          min-height: 0 !important;
        }
        .sp-card-list {
          flex-direction: column !important;
        }
        .sp-card-list .sp-list-thumb {
          width: 100% !important;
          height: 160px !important;
        }
        .sp-card-list .sp-list-heart {
          position: absolute !important;
          top: 10px !important;
          right: 10px !important;
          margin: 0 !important;
          align-self: auto !important;
        }
        .sp-summary-title { font-size: 14.5px !important; }
      }
      @media (max-width: 380px) {
        .sp-results-grid.grid-4 { gap: 7px !important; }
      }
    `}</style>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   NAVBAR (same visual as Home.jsx SokoNav, self-contained here to avoid
   import coupling — feel free to swap to the shared component later)
───────────────────────────────────────────────────────────────────────────── */
function SearchNav({ user, notifCount, search, setSearch, navigate }) {
  const [focused, setFocused] = useState(false)
  const [distOpen, setDistOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const districts = ['All Districts','Lilongwe','Blantyre','Mzuzu','Zomba','Kasungu','Mangochi','Salima']

  function handleKey(e) {
    if (e.key === 'Enter' && search.trim())
      navigate(`/search?q=${encodeURIComponent(search.trim())}`)
  }

  return (
    <nav className="sp-nav-glass">
      <div style={{ maxWidth:1400, margin:'0 auto', padding:'10px 20px', display:'flex', alignItems:'center', gap:14, minHeight:70 }}>
        {/* Logo */}
        <div onClick={() => navigate('/')} style={{ cursor:'pointer', flexShrink:0 }}>
          <div style={{ fontFamily:T.fontDisplay, fontSize:22, fontWeight:800, color:T.green, letterSpacing:'-0.5px' }}>
            Soko<span style={{ color:T.amber }}>Mw</span>
          </div>
          <div style={{ fontSize:10.5, color:T.gray600, fontWeight:500, whiteSpace:'nowrap' }}>
            Buy. Sell. Find. Anywhere in Malawi.
          </div>
        </div>

        {/* District pill */}
        <div style={{ position:'relative', flexShrink:0 }}>
          <button onClick={() => setDistOpen(d => !d)} style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:50, background:'#fff', border:`1.5px solid ${T.gray200}`, fontSize:13, fontWeight:600, color:T.gray800, cursor:'pointer', whiteSpace:'nowrap' }}>
            <span style={{ color:T.green, display:'flex' }}>{Icon.pin(13)}</span>
            <span style={{ color:T.green, fontWeight:700 }}>All Districts</span>
            {Icon.chevDown(12)}
          </button>
          {distOpen && (
            <div style={{ position:'absolute', top:'calc(100% + 8px)', left:0, background:T.white, borderRadius:16, padding:'8px 0', boxShadow:T.shadowLg, minWidth:200, border:`1px solid ${T.gray200}`, zIndex:200 }}>
              {districts.map(d => (
                <button key={d} onClick={() => setDistOpen(false)} style={{ display:'block', width:'100%', padding:'9px 16px', textAlign:'left', background:'transparent', border:'none', fontSize:13.5, fontWeight:500, color:T.gray800, cursor:'pointer' }}>{d}</button>
              ))}
            </div>
          )}
        </div>

        {/* Search bar */}
        <div style={{ flex:1, display:'flex', alignItems:'center', background:focused ? '#fff' : T.gray100, border:`1.5px solid ${focused ? T.green : 'transparent'}`, borderRadius:50, padding:'4px 4px 4px 14px', gap:0, transition:'border-color .2s, background .2s', boxShadow:focused ? `0 0 0 3px rgba(15,157,88,0.10)` : 'none', minHeight:42 }}>
          <span style={{ color:T.gray500, flexShrink:0, display:'flex', alignItems:'center', marginRight:8 }}>{Icon.search(15)}</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKey}
            placeholder="Search for anything..."
            style={{ flex:1, border:'none', background:'transparent', fontSize:13.5, color:T.gray900, outline:'none', minWidth:0 }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background:T.gray300, border:'none', borderRadius:'50%', width:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:T.gray600, flexShrink:0, marginRight:6 }}>{Icon.x(9)}</button>
          )}
          <button
            onClick={() => { if (search.trim()) navigate(`/search?q=${encodeURIComponent(search.trim())}`) }}
            style={{ flexShrink:0, background:T.green, color:'#fff', border:'none', borderRadius:50, height:34, padding:'0 20px', fontSize:13.5, fontWeight:700, cursor:'pointer' }}
          >Search</button>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
          <button onClick={() => navigate('/chats')} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'none', border:'none', cursor:'pointer', padding:'6px 10px', borderRadius:12, color:T.gray800, fontSize:10, fontWeight:600 }}>
            {Icon.chat(18)}<span>Chats</span>
          </button>
          <div style={{ position:'relative' }}>
            <button onClick={() => navigate('/notifications')} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, background:'none', border:'none', cursor:'pointer', padding:'6px 10px', borderRadius:12, color:T.gray800, fontSize:10, fontWeight:600 }}>
              {Icon.bell(18)}<span>Alerts</span>
            </button>
            {notifCount > 0 && (
              <span style={{ position:'absolute', top:4, right:6, background:T.red, color:'#fff', borderRadius:'50%', width:17, height:17, fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', animation:'badgePop .3s ease', border:'2px solid #fff' }}>{notifCount > 9 ? '9+' : notifCount}</span>
            )}
          </div>
          <button onClick={() => navigate('/post')} style={{ height:38, padding:'0 18px', fontSize:13.5, fontWeight:700, background:T.green, color:'#fff', border:'none', borderRadius:50, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6, whiteSpace:'nowrap' }}>
            {Icon.plus(14)} Sell Now
          </button>
          <button onClick={() => setAvatarOpen(o => !o)} style={{ width:38, height:38, borderRadius:'50%', background:`linear-gradient(135deg, ${T.green}, ${T.greenD})`, border:`2px solid ${T.green}`, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontSize:14, fontWeight:700, flexShrink:0 }}>
            {user?.avatar_url ? <img src={user.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} /> : (user?.email?.[0] || 'W').toUpperCase()}
          </button>
        </div>
      </div>

      {/* Pillar nav */}
      <div style={{ borderTop:`1px solid ${T.gray100}` }}>
        <div style={{ maxWidth:1400, margin:'0 auto', padding:'0 20px', display:'flex', alignItems:'center', gap:0 }}>
          {PILLARS.map(p => (
            <button key={p.key} onClick={() => navigate(p.path)} style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 16px', background:'none', border:'none', borderBottom:p.key === 'marketplace' ? `2.5px solid ${T.green}` : '2.5px solid transparent', cursor:'pointer', fontSize:13.5, fontWeight:p.key === 'marketplace' ? 700 : 500, color:p.key === 'marketplace' ? T.green : T.gray700, whiteSpace:'nowrap', transition:'color .15s' }}
              onMouseEnter={e => { if (p.key !== 'marketplace') e.currentTarget.style.color = T.green }}
              onMouseLeave={e => { if (p.key !== 'marketplace') e.currentTarget.style.color = T.gray700 }}
            >
              <span style={{ color:p.key === 'marketplace' ? T.green : T.gray500, display:'flex' }}>{p.icon(15)}</span>
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   CHECKBOX — reusable
───────────────────────────────────────────────────────────────────────────── */
function Checkbox({ checked, onChange, label, indent = 0 }) {
  return (
    <label className="sp-check-row" style={{ paddingLeft: indent * 16 }} onClick={onChange}>
      <div className={`sp-check-box${checked ? ' checked' : ''}`}>
        {checked && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>}
      </div>
      <span style={{ fontSize:13, color:T.gray800, fontWeight:checked ? 600 : 400, userSelect:'none' }}>{label}</span>
    </label>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   CATEGORY CHECKBOX TREE — recursive
───────────────────────────────────────────────────────────────────────────── */
function CategoryTree({ node, checked, onToggle, depth = 0, forceOpen, defaultOpenKey }) {
  const [expanded, setExpanded] = useState(node.key === defaultOpenKey)
  const hasChildren = node.children?.length > 0

  // Auto-expand whenever this node is the one that was just clicked.
  // forceOpen.n changes on every click (even repeat clicks on the same
  // category), so this effect reliably re-fires and re-opens the node
  // even if it was manually collapsed via the chevron in between clicks.
  useEffect(() => {
    if (forceOpen && forceOpen.key === node.key && hasChildren) setExpanded(true)
  }, [forceOpen])

  function handleLabelClick() {
    onToggle(node.key)
    if (hasChildren) setExpanded(true)
  }

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:0, paddingLeft: depth * 14 }}>
        {hasChildren && (
          <button onClick={() => setExpanded(e => !e)} style={{ background:'none', border:'none', cursor:'pointer', padding:'2px 4px 2px 0', color:T.gray500, display:'flex', flexShrink:0 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              {expanded ? <polyline points="6 9 12 15 18 9"/> : <polyline points="9 18 15 12 9 6"/>}
            </svg>
          </button>
        )}
        {!hasChildren && <span style={{ width:15, flexShrink:0 }} />}
        <Checkbox checked={checked.has(node.key)} onChange={handleLabelClick} label={node.label} />
      </div>
      {hasChildren && expanded && (
        <div className="sp-subcat-wrap">
          {node.children.map(child => (
            <CategoryTree key={child.key} node={child} checked={checked} onToggle={onToggle} depth={depth + 1} forceOpen={forceOpen} defaultOpenKey={defaultOpenKey} />
          ))}
        </div>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   FILTER SIDEBAR CONTENT
───────────────────────────────────────────────────────────────────────────── */
function FilterPanel({
  checkedCats, onToggleCat, onClearAll,
  priceMin, setPriceMin, priceMax, setPriceMax,
  district, setDistrict,
  conditions, onToggleCondition,
  availability, onToggleAvailability,
  verifiedOnly, setVerifiedOnly,
}) {
  const [lastClicked, setLastClicked] = useState(null) // { key, n } — n always changes so repeat clicks on the same category still force-expand it

  // On first render, only the category that arrived pre-checked (e.g. from
  // ?cat=Clothing on the URL) should start expanded — everything else stays
  // collapsed until the user clicks it.
  const [initialOpenKey] = useState(() => {
    for (const node of CATEGORY_TREE) {
      if (checkedCats.has(node.key)) return node.key
    }
    return null
  })

  return (
    <div>
      {/* Clear All */}
      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:14 }}>
        <button onClick={onClearAll} style={{ background:'none', border:'none', color:T.red, fontSize:13, fontWeight:700, cursor:'pointer' }}>Clear All</button>
      </div>

      {/* CATEGORIES */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.gray900, marginBottom:10 }}>Categories</div>
        <Checkbox checked={checkedCats.size === 0} onChange={onClearAll} label="All Categories" />
        <div style={{ marginTop:6, display:'flex', flexDirection:'column', gap:2 }}>
          {CATEGORY_TREE.map(node => (
            <CategoryTree
              key={node.key} node={node} checked={checkedCats}
              onToggle={(key) => { setLastClicked(prev => ({ key, n: (prev?.n || 0) + 1 })); onToggleCat(key) }}
              depth={0} forceOpen={lastClicked}
              defaultOpenKey={initialOpenKey}
            />
          ))}
        </div>
      </div>

      <div style={{ height:1, background:T.gray100, marginBottom:18 }} />

      {/* PRICE RANGE */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.gray900, marginBottom:10 }}>Price Range</div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <input
            type="number" placeholder="Min" value={priceMin}
            onChange={e => setPriceMin(e.target.value)}
            style={{ flex:1, border:`1.5px solid ${T.gray200}`, borderRadius:8, padding:'8px 10px', fontSize:13, color:T.gray900, outline:'none', minWidth:0 }}
          />
          <span style={{ color:T.gray500, fontSize:12 }}>to</span>
          <input
            type="number" placeholder="Max" value={priceMax}
            onChange={e => setPriceMax(e.target.value)}
            style={{ flex:1, border:`1.5px solid ${T.gray200}`, borderRadius:8, padding:'8px 10px', fontSize:13, color:T.gray900, outline:'none', minWidth:0 }}
          />
        </div>
      </div>

      <div style={{ height:1, background:T.gray100, marginBottom:18 }} />

      {/* LOCATION */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.gray900, marginBottom:10 }}>Location</div>
        <div style={{ position:'relative' }}>
          <select value={district} onChange={e => setDistrict(e.target.value)} style={{ width:'100%', appearance:'none', border:`1.5px solid ${T.gray200}`, borderRadius:10, padding:'9px 32px 9px 12px', fontSize:13, color:T.gray800, background:'#fff', cursor:'pointer', outline:'none' }}>
            {ALL_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:T.gray500, pointerEvents:'none' }}>{Icon.chevDown(12)}</span>
        </div>
      </div>

      <div style={{ height:1, background:T.gray100, marginBottom:18 }} />

      {/* CONDITION — keys match PostListing.jsx's CONDITIONS exactly */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.gray900, marginBottom:10 }}>Condition</div>
        {CONDITIONS.map(c => (
          <Checkbox key={c.key} checked={conditions.has(c.key)} onChange={() => onToggleCondition(c.key)} label={c.label} />
        ))}
      </div>

      <div style={{ height:1, background:T.gray100, marginBottom:18 }} />

      {/* AVAILABILITY — matches PostListing.jsx's availability_status field */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.gray900, marginBottom:10 }}>Availability</div>
        {AVAILABILITY_OPTIONS.map(a => (
          <Checkbox key={a.key} checked={availability.has(a.key)} onChange={() => onToggleAvailability(a.key)} label={a.label} />
        ))}
      </div>

      <div style={{ height:1, background:T.gray100, marginBottom:18 }} />

      {/* VERIFIED SELLERS */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.gray900 }}>Verified Sellers</div>
          <div className={`sp-toggle-track${verifiedOnly ? ' on' : ''}`} onClick={() => setVerifiedOnly(v => !v)}>
            <div className="sp-toggle-thumb" />
          </div>
        </div>
      </div>

      </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   RESULT CARD — GRID mode (Marketplace / listings tab)
───────────────────────────────────────────────────────────────────────────── */
function ResultCardGrid({ listing, delay, onClick, user, navigate, saved, onToggleSave }) {
  const [hov, setHov]     = useState(false)
  const [imgErr, setImgErr] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const isVerif = listing.seller_verified || listing.shop_is_verified
  const isFeat  = isListingFeatured(listing)
  const isNew   = listing.created_at && (Date.now() - new Date(listing.created_at).getTime()) < 86400000
  const onSale  = isFlashSaleActive(listing)
  const hasVideo = listing.videos && listing.videos.length > 0
  const hasBulk  = listing.price_tiers && listing.price_tiers.length > 0

  async function handleSave(e) {
    e.stopPropagation()
    if (saveBusy) return
    setSaveBusy(true)
    try { await onToggleSave?.(listing.id) } finally { setSaveBusy(false) }
  }

  return (
    <div className="sp-card" style={{ animationDelay:`${delay}s`, ...(onSale ? { border:`1.5px solid ${T.red}`, boxShadow:`0 0 0 1px rgba(234,67,53,0.15), ${T.shadow}` } : {}) }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onClick}>
      {/* Image */}
      <div style={{ position:'relative', width:'100%', height:185, overflow:'hidden', background:T.gray100, flexShrink:0, borderRadius:'12px 12px 0 0' }}>
        {listing.images?.[0] && !imgErr
          ? <img src={listing.images[0]} alt={listing.title} onError={() => setImgErr(true)} className="sp-card-img" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, color:T.gray400 }}>📦</div>
        }
        {onSale && (
          <div className="sp-hotdeal-badge" style={{ position:'absolute', top:10, left:10, background:`linear-gradient(135deg,${T.red},#c62828)`, color:'#fff', borderRadius:50, padding:'4px 11px', fontSize:10, fontWeight:900, letterSpacing:'0.3px', display:'flex', alignItems:'center', gap:3, zIndex:2 }}>🔥 HOT DEAL</div>
        )}
        {!onSale && isFeat && (
          <div style={{ position:'absolute', top:10, left:10, background:`linear-gradient(135deg,${T.amber},#e09800)`, color:'#1a0a00', borderRadius:50, padding:'3px 10px', fontSize:9.5, fontWeight:900, boxShadow:'0 2px 8px rgba(249,171,0,0.4)', display:'flex', alignItems:'center', gap:4 }}>⭐ FEATURED</div>
        )}
        {!onSale && !isFeat && isNew && (
          <div style={{ position:'absolute', top:10, left:10, background:T.green, color:'#fff', borderRadius:50, padding:'3px 10px', fontSize:9.5, fontWeight:800 }}>NEW</div>
        )}
        {hasVideo && (
          <div style={{ position:'absolute', bottom:9, left:9, background:'rgba(0,0,0,0.6)', color:'#fff', borderRadius:50, padding:'3px 8px', fontSize:10, fontWeight:700, display:'flex', alignItems:'center', gap:4 }}>
            🎬 {listing.videos.length}
          </div>
        )}
        {/* Save */}
        <button
          type="button"
          onClick={handleSave}
          disabled={saveBusy}
          aria-label={saved ? 'Remove from saved' : 'Save listing'}
          aria-pressed={!!saved}
          style={{ position:'absolute', top:9, right:9, width:30, height:30, borderRadius:'50%', border:'none', cursor: saveBusy ? 'default' : 'pointer', background:'rgba(255,255,255,0.92)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', color:saved ? T.red : T.gray700, boxShadow:'0 2px 8px rgba(0,0,0,.12)', transition:'transform .2s', zIndex:3 }}
        >
          {Icon.heart(14, saved ? 'currentColor' : 'none')}
        </button>
      </div>

      {/* Body */}
      <div className="sp-card-body-pad" style={{ padding:'10px 12px 8px', display:'flex', flexDirection:'column', gap:5, flex:1, minHeight:0, justifyContent:'flex-start' }}>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ fontSize:13, fontWeight:700, color:T.gray900, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', minWidth:0, lineHeight:1.25 }}>{listing.title}</span>
          {isVerif && <span style={{ flexShrink:0 }}>{Icon.verify(13)}</span>}
        </div>
        {onSale ? (
          <div style={{ display:'flex', alignItems:'baseline', gap:6, flexWrap:'wrap' }}>
            <span style={{ fontSize:12, color:T.gray500, textDecoration:'line-through' }}>{formatPrice(listing.price)}</span>
            <span style={{ fontFamily:T.fontDisplay, fontSize:17, fontWeight:800, color:T.red, letterSpacing:'-0.3px' }}>{formatPrice(listing.flash_sale_price)}</span>
          </div>
        ) : (
          <div style={{ fontFamily:T.fontDisplay, fontSize:17, fontWeight:800, color:T.green, letterSpacing:'-0.3px' }}>{formatPrice(listing.price)}</div>
        )}
        {hasBulk && (
          <div style={{ fontSize:10.5, color:T.blue, fontWeight:700, background:T.blueL, borderRadius:6, padding:'2px 6px', display:'inline-block', width:'fit-content' }}>
            Bulk pricing available
          </div>
        )}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:11.5, color:T.gray600, gap:6 }}>
          <span style={{ display:'flex', alignItems:'center', gap:5, minWidth:0, overflow:'hidden' }}>
            <span style={{ color:T.green, flexShrink:0 }}>{Icon.pin(11)}</span>
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {dedupeLocation(listing.city, listing.area) || 'Malawi'}
            </span>
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:3, flexShrink:0 }}>
            {Icon.clock(11)} {timeAgo(listing.created_at)}
          </span>
        </div>
      </div>

      {/* Quick actions */}
      <ListingCardActions listing={listing} user={user} navigate={navigate} />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   RESULT CARD — LIST mode (Marketplace / listings tab)
───────────────────────────────────────────────────────────────────────────── */
function ResultCardList({ listing, delay, onClick, user, navigate, saved, onToggleSave }) {
  const [imgErr, setImgErr] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)
  const isVerif = listing.seller_verified || listing.shop_is_verified
  const isFeat  = isListingFeatured(listing)
  const onSale  = isFlashSaleActive(listing)
  const hasVideo = listing.videos && listing.videos.length > 0

  async function handleSave(e) {
    e.stopPropagation()
    if (saveBusy) return
    setSaveBusy(true)
    try { await onToggleSave?.(listing.id) } finally { setSaveBusy(false) }
  }

  return (
    <div className="sp-card-list" style={{ animationDelay:`${delay}s`, position:'relative' }} onClick={onClick}>
      <div className="sp-list-thumb" style={{ position:'relative', width:140, height:110, flexShrink:0, overflow:'hidden', background:T.gray100 }}>
        {listing.images?.[0] && !imgErr
          ? <img src={listing.images[0]} alt={listing.title} onError={() => setImgErr(true)} className="sp-card-img" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, color:T.gray400 }}>📦</div>
        }
        {onSale && <div style={{ position:'absolute', top:8, left:8, background:T.red, color:'#fff', borderRadius:50, padding:'2px 8px', fontSize:9, fontWeight:900 }}>🔥</div>}
        {!onSale && isFeat && <div style={{ position:'absolute', top:8, left:8, background:`linear-gradient(135deg,${T.amber},#e09800)`, color:'#1a0a00', borderRadius:50, padding:'2px 8px', fontSize:9, fontWeight:900 }}>⭐</div>}
        {hasVideo && (
          <div style={{ position:'absolute', bottom:6, left:6, background:'rgba(0,0,0,0.6)', color:'#fff', borderRadius:50, padding:'2px 6px', fontSize:9, fontWeight:700 }}>🎬 {listing.videos.length}</div>
        )}
        <button
          type="button"
          className="sp-list-heart"
          onClick={handleSave}
          disabled={saveBusy}
          aria-label={saved ? 'Remove from saved' : 'Save listing'}
          style={{ position:'absolute', top:8, right:8, width:30, height:30, borderRadius:'50%', border:'none', background:'rgba(255,255,255,0.92)', display:'flex', alignItems:'center', justifyContent:'center', color:saved ? T.red : T.gray600, cursor: saveBusy ? 'default' : 'pointer', boxShadow:'0 2px 8px rgba(0,0,0,.1)', zIndex:2 }}
        >
          {Icon.heart(14, saved ? 'currentColor' : 'none')}
        </button>
      </div>
      <div style={{ flex:1, padding:'12px 14px', display:'flex', flexDirection:'column', justifyContent:'space-between', minWidth:0 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4, minWidth:0 }}>
            <span style={{ fontSize:14, fontWeight:700, color:T.gray900, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', lineHeight:1.25 }}>{listing.title}</span>
            {isVerif && <span style={{ flexShrink:0 }}>{Icon.verify(13)}</span>}
          </div>
          {listing.description && (
            <div style={{ fontSize:12, color:T.gray600, lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{listing.description}</div>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8, gap:8, flexWrap:'wrap' }}>
          {onSale ? (
            <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
              <span style={{ fontSize:12, color:T.gray500, textDecoration:'line-through' }}>{formatPrice(listing.price)}</span>
              <span style={{ fontFamily:T.fontDisplay, fontSize:17, fontWeight:800, color:T.red }}>{formatPrice(listing.flash_sale_price)}</span>
            </div>
          ) : (
            <div style={{ fontFamily:T.fontDisplay, fontSize:17, fontWeight:800, color:T.green }}>{formatPrice(listing.price)}</div>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:11.5, color:T.gray600, flexWrap:'wrap' }}>
            <span style={{ display:'flex', alignItems:'center', gap:3, minWidth:0 }}>
              {Icon.pin(11)} <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:140 }}>{dedupeLocation(listing.city, listing.area) || 'Malawi'}</span>
            </span>
            <span style={{ display:'flex', alignItems:'center', gap:3, flexShrink:0 }}>{Icon.clock(11)} {timeAgo(listing.created_at)}</span>
          </div>
        </div>
      </div>
      <div className="sp-card-list-actions">
        <ListingCardActions listing={listing} user={user} navigate={navigate} />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   SHOP RESULT CARD — Shops tab
───────────────────────────────────────────────────────────────────────────── */
function ShopResultCard({ shop, delay, onClick }) {
  return (
    <div className="sp-row-card" style={{ animationDelay:`${delay}s` }} onClick={onClick}>
      <div style={{ width:52, height:52, borderRadius:'50%', flexShrink:0, overflow:'hidden', background:`linear-gradient(135deg, ${T.green}, ${T.greenD})`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:19 }}>
        {shop.logo_url ? <img src={shop.logo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : (shop.name?.[0] || 'S').toUpperCase()}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ fontSize:14, fontWeight:700, color:T.gray900 }}>{shop.name}</span>
          {shop.is_verified && Icon.verify(13)}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:11.5, color:T.gray600, marginTop:2 }}>
          <span>{shop.category || 'Shop'}</span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}>{Icon.pin(11)} {shop.city || 'Malawi'}</span>
          {shop.rating > 0 && <span style={{ display:'flex', alignItems:'center', gap:3 }}>{Icon.star(11)} {shop.rating}</span>}
        </div>
      </div>
      {Icon.chevR(16)}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   JOB RESULT CARD — Jobs tab
───────────────────────────────────────────────────────────────────────────── */
function JobResultCard({ job, delay, onClick }) {
  return (
    <div className="sp-row-card" style={{ animationDelay:`${delay}s` }} onClick={onClick}>
      <div style={{ width:42, height:42, borderRadius:10, background:T.blueL, color:T.blue, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{Icon.briefcase(18)}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:700, color:T.gray900 }}>{job.title}</div>
        <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:11.5, color:T.gray600, marginTop:2, flexWrap:'wrap' }}>
          {job.company && <span>{job.company}</span>}
          <span style={{ display:'flex', alignItems:'center', gap:3 }}>{Icon.pin(11)} {job.city || 'Malawi'}</span>
          <span>{job.type || 'Full-time'}</span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}>{Icon.clock(11)} {timeAgo(job.created_at)}</span>
        </div>
      </div>
      {Icon.chevR(16)}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   SERVICE RESULT CARD — Services tab
───────────────────────────────────────────────────────────────────────────── */
function ServiceResultCard({ service, delay, onClick }) {
  return (
    <div className="sp-row-card" style={{ animationDelay:`${delay}s` }} onClick={onClick}>
      <div style={{ width:42, height:42, borderRadius:10, background:T.greenL, color:T.green, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{Icon.wrench(18)}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:14, fontWeight:700, color:T.gray900 }}>{service.name}</div>
        <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:11.5, color:T.gray600, marginTop:2, flexWrap:'wrap' }}>
          {service.category && <span>{service.category}</span>}
          <span style={{ display:'flex', alignItems:'center', gap:3 }}>{Icon.pin(11)} {service.city || 'Malawi'}</span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}>{Icon.clock(11)} {timeAgo(service.created_at)}</span>
        </div>
      </div>
      {Icon.chevR(16)}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   REQUEST RESULT CARD — People Looking For tab
───────────────────────────────────────────────────────────────────────────── */
function RequestResultCard({ request, delay, onClick }) {
  return (
    <div className="sp-row-card" style={{ animationDelay:`${delay}s` }} onClick={onClick}>
      <div style={{ width:42, height:42, borderRadius:10, background:T.violetL, color:T.violet, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{Icon.handshake(18)}</div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:'flex', alignItems:'center', gap:5 }}>
          <span style={{ fontSize:14, fontWeight:700, color:T.gray900, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical' }}>{request.title}</span>
          {request.urgency === 'urgent' && (
            <span style={{ background:T.red, color:'#fff', borderRadius:50, padding:'2px 7px', fontSize:9.5, fontWeight:800, flexShrink:0 }}>URGENT</span>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:11.5, color:T.gray600, marginTop:2, flexWrap:'wrap' }}>
          <span style={{ color:T.green, fontWeight:700 }}>{request.budget ? `MK ${Number(request.budget).toLocaleString()}` : 'Negotiable'}</span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}>{Icon.pin(11)} {(request.cities?.[0] || request.city) || 'Malawi'}</span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}>{Icon.clock(11)} {timeAgo(request.created_at)}</span>
        </div>
      </div>
      {Icon.chevR(16)}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   SKELETON CARDS
───────────────────────────────────────────────────────────────────────────── */
function SkeletonCard() {
  return (
    <div style={{ background:'#fff', borderRadius:12, overflow:'hidden', border:`1px solid ${T.gray100}` }}>
      <div className="skeleton" style={{ width:'100%', height:185 }} />
      <div style={{ padding:'10px 12px 12px', display:'flex', flexDirection:'column', gap:7 }}>
        <div className="skeleton" style={{ height:13, width:'80%' }} />
        <div className="skeleton" style={{ height:17, width:'45%' }} />
        <div className="skeleton" style={{ height:11, width:'60%' }} />
      </div>
    </div>
  )
}

function SkeletonRowCard() {
  return (
    <div style={{ background:'#fff', borderRadius:14, border:`1px solid ${T.gray100}`, padding:'14px 16px', display:'flex', alignItems:'center', gap:14 }}>
      <div className="skeleton" style={{ width:48, height:48, borderRadius:10, flexShrink:0 }} />
      <div style={{ flex:1, display:'flex', flexDirection:'column', gap:7 }}>
        <div className="skeleton" style={{ height:14, width:'40%' }} />
        <div className="skeleton" style={{ height:11, width:'65%' }} />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   EMPTY STATE
───────────────────────────────────────────────────────────────────────────── */
function EmptyState({ query, onClearFilters, label = 'results' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'64px 24px', textAlign:'center' }}>
      <div style={{ width:72, height:72, borderRadius:'50%', background:T.gray100, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:20, color:T.gray400 }}>
        {Icon.search(34)}
      </div>
      <div style={{ fontSize:18, fontWeight:700, color:T.gray900, marginBottom:8 }}>No {label} found for "{query}"</div>
      <div style={{ fontSize:14, color:T.gray600, marginBottom:24 }}>Try different keywords, a different tab, or adjust your filters</div>
      <button onClick={onClearFilters} style={{ background:T.green, color:'#fff', border:'none', borderRadius:12, padding:'11px 28px', fontSize:14, fontWeight:700, cursor:'pointer' }}>Clear Filters</button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   SEE MORE — load next batch (no numbered pages)
───────────────────────────────────────────────────────────────────────────── */
function SeeMoreButton({ visible, loading, remaining, onClick }) {
  if (!visible) return null
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 0 12px' }}>
      <button
        type="button"
        className="sp-see-more"
        disabled={loading}
        onClick={onClick}
        style={{
          minWidth: 200,
          minHeight: 46,
          padding: '12px 28px',
          borderRadius: 14,
          border: `1.5px solid ${T.green}`,
          background: loading ? T.greenL : '#fff',
          color: T.green,
          fontSize: 14,
          fontWeight: 800,
          cursor: loading ? 'default' : 'pointer',
          fontFamily: 'inherit',
          boxShadow: T.shadow,
          transition: 'background .15s, transform .15s',
        }}
      >
        {loading ? 'Loading…' : 'See more'}
      </button>
      {remaining > 0 && !loading && (
        <span style={{ fontSize: 12.5, color: T.gray600, fontWeight: 600 }}>
          {remaining.toLocaleString()} more
        </span>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN SEARCH PAGE COMPONENT
───────────────────────────────────────────────────────────────────────────── */
const PAGE_SIZE = 20

export default function SearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryParam = searchParams.get('q') || ''
  const catParam    = searchParams.get('cat') || ''

  const [search, setSearch]       = useState(queryParam)
  const [user, setUser]           = useState(null)
  const [notifCount, setNotifCount] = useState(0)

  // ── Active tab ──
  const [activeTab, setActiveTab] = useState('listings')
  const [tabCounts, setTabCounts] = useState({ listings: null, shops: null, lookingfor: null, jobs: null, services: null })

  // ── Results state ──
  const [allResults, setAllResults] = useState([])
  const [loading, setLoading]       = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage]             = useState(1)

  // ── Filter state (Marketplace tab only) ──
  const [checkedCats, setCheckedCats]   = useState(new Set())
  const [priceMin, setPriceMin]         = useState('')
  const [priceMax, setPriceMax]         = useState('')
  const [district, setDistrict]         = useState('All Districts')
  const [conditions, setConditions]     = useState(new Set())
  const [availability, setAvailability] = useState(new Set())
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [sortBy, setSortBy]             = useState('relevance')
  const [viewMode, setViewMode]         = useState('grid') // 'grid' | 'list'
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  const [featuredSeed, setFeaturedSeed] = useState(() => Math.floor(Date.now() / 30000))
  const [sidebarStuck, setSidebarStuck] = useState(false)
  const [savedIds, setSavedIds] = useState(() => new Set())

  // Sidebar gets a subtle elevation lift once the page has scrolled past
  // its sticky offset — a quiet cue that it's now "floating" over content,
  // distinct from the cards' hover-driven lift.
  useEffect(() => {
    function onScroll() { setSidebarStuck(window.scrollY > 40) }
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Live filters — every change here re-triggers search automatically,
  // no "Apply" step needed.
  const liveFilters = useMemo(() => ({
    cats: checkedCats, priceMin, priceMax, district,
    conditions, availability, verifiedOnly,
  }), [checkedCats, priceMin, priceMax, district, conditions, availability, verifiedOnly])

  /* Sync URL → search input */
  useEffect(() => { setSearch(queryParam) }, [queryParam])

  /* Sync URL → category filter (e.g. /listings?cat=Agriculture from Home page category tiles) */
  useEffect(() => {
    if (catParam) setCheckedCats(new Set([catParam]))
  }, [catParam])

  /* Auth + saved listings */
  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user || cancelled) return
      setUser(user)
      supabase.from('notifications').select('*', { count:'exact', head:true }).eq('user_id', user.id).eq('read', false)
        .then(({ count }) => { if (!cancelled) setNotifCount(count || 0) })
      try {
        const { data, error } = await supabase
          .from('listing_saves')
          .select('listing_id')
          .eq('user_id', user.id)
        if (!cancelled && !error) {
          setSavedIds(new Set((data || []).map(r => r.listing_id).filter(Boolean)))
        }
      } catch { /* table may be missing */ }
    })
    return () => { cancelled = true }
  }, [])

  async function toggleListingSave(listingId) {
    if (!listingId) return
    if (!user?.id) {
      try {
        sessionStorage.setItem('soko_post_login', JSON.stringify({ type: 'save', listingId }))
      } catch { /* ignore */ }
      navigate('/login')
      return
    }
    const wasSaved = savedIds.has(listingId)
    setSavedIds(prev => {
      const next = new Set(prev)
      if (wasSaved) next.delete(listingId)
      else next.add(listingId)
      return next
    })
    try {
      const { data, error } = await supabase.rpc('toggle_listing_save', { p_listing_id: listingId })
      if (error) throw error
      setSavedIds(prev => {
        const next = new Set(prev)
        if (data === true) next.add(listingId)
        else if (data === false) next.delete(listingId)
        return next
      })
    } catch {
      setSavedIds(prev => {
        const next = new Set(prev)
        if (wasSaved) next.add(listingId)
        else next.delete(listingId)
        return next
      })
    }
  }

  /* Reset to page 1 whenever the query, tab, or any filter changes */
  useEffect(() => { setPage(1) }, [queryParam, activeTab, liveFilters])

  /* Search whenever query, tab, filters, sort, or page change.
     No early return here — landing on /listings with no q/cat (e.g. from
     "All Categories") should browse everything, not show a blank page.
     Pass current values as args so doSearch never reads stale closure state. */
  useEffect(() => {
    doSearch(activeTab, liveFilters, sortBy, page)
  }, [queryParam, catParam, activeTab, liveFilters, sortBy, page])

  /* Fetch lightweight counts for every tab whenever the query changes, so
     tab badges are populated without forcing the user to click each tab. */
  useEffect(() => {
    if (!queryParam) {
      setTabCounts({ listings: null, shops: null, lookingfor: null, jobs: null, services: null })
      return
    }
    fetchAllTabCounts(queryParam)
  }, [queryParam])

  async function fetchAllTabCounts(q) {
    const safe = async (fn) => { try { return await fn() } catch { return 0 } }

    const [listingsC, shopsC, lookingforC, jobsC, servicesC] = await Promise.all([
      safe(async () => {
        const { count } = await supabase.from('listings').select('id', { count:'exact', head:true }).eq('status', 'published').ilike('title', `%${q}%`)
        return count || 0
      }),
      safe(async () => {
        const { count } = await supabase.from('shops').select('id', { count:'exact', head:true }).eq('is_active', true).ilike('name', `%${q}%`)
        return count || 0
      }),
      safe(async () => {
        const { count } = await supabase.from('buyer_requests').select('id', { count:'exact', head:true }).not('status', 'eq', 'fulfilled').ilike('title', `%${q}%`)
        return count || 0
      }),
      safe(async () => {
        const { count } = await supabase.from('jobs').select('id', { count:'exact', head:true }).eq('status', 'active').ilike('title', `%${q}%`)
        return count || 0
      }),
      safe(async () => {
        const { count } = await supabase.from('services').select('id', { count:'exact', head:true }).eq('status', 'active').ilike('name', `%${q}%`)
        return count || 0
      }),
    ])

    setTabCounts({ listings: listingsC, shops: shopsC, lookingfor: lookingforC, jobs: jobsC, services: servicesC })
  }

  /* ── doSearch: dispatches to the right table for the active tab ── */
  async function doSearch(tab, filters, currentSort, currentPage) {
    if (currentPage === 1) setLoading(true)
    else setLoadingMore(true)
    try {
      if (tab === 'listings')        await searchListings(filters, currentSort, currentPage)
      else if (tab === 'shops')      await searchShops(currentSort, currentPage)
      else if (tab === 'lookingfor') await searchLookingFor(currentSort, currentPage)
      else if (tab === 'jobs')       await searchJobs(currentSort, currentPage)
      else if (tab === 'services')   await searchServices(currentSort, currentPage)
    } catch (err) {
      console.error('Search error:', err)
      if (currentPage === 1) {
        setAllResults([])
        setTotalCount(0)
      }
    }
    setLoading(false)
    setLoadingMore(false)
  }

  /* ── Marketplace listings (original logic, unchanged) ── */
  async function searchListings(filters, currentSort, currentPage) {
    const baseSelect = 'id, title, price, images, videos, city, district, area, category, condition, availability_status, featured, is_featured, featured_until, created_at, seller_id, shop_id, description, flash_sale_price, flash_sale_ends_at, price_tiers, contact_methods, call_number'

    let query = supabase
      .from('listings')
      .select(baseSelect, { count: 'exact' })
      .eq('status', 'published')

    if (queryParam) query = query.ilike('title', `%${queryParam}%`)

    if (filters.cats.size > 0) {
      // Split checked keys into top-level categories vs subcategories, and
      // match a listing if either its category OR its subcategory is checked
      // — this keeps behavior correct whether the user checked a parent,
      // a leaf, or a mix of both.
      const topLevelKeys = new Set(CATEGORY_TREE.map(n => n.key))
      const checkedTop  = [...filters.cats].filter(k => topLevelKeys.has(k))
      const checkedSub  = [...filters.cats].filter(k => !topLevelKeys.has(k))

      const orParts = []
      if (checkedTop.length > 0) orParts.push(`category.in.(${checkedTop.join(',')})`)
      if (checkedSub.length > 0) orParts.push(`subcategory.in.(${checkedSub.join(',')})`)
      if (orParts.length > 0) query = query.or(orParts.join(','))
    }
    if (filters.priceMin)      query = query.gte('price', Number(filters.priceMin))
    if (filters.priceMax)      query = query.lte('price', Number(filters.priceMax))
    if (filters.district && filters.district !== 'All Districts')
      query = query.or(`district.ilike.%${filters.district}%,city.ilike.%${filters.district}%`)
    if (filters.conditions.size > 0) query = query.in('condition', [...filters.conditions])
    if (filters.availability.size > 0) query = query.in('availability_status', [...filters.availability])

    // Fetch ALL matching listings (no pagination yet) so we can pin featured first
    query = query.order('created_at', { ascending: false }).limit(200)

    const { data: allData, count, error } = await query
    if (error) throw error

    let rows = allData || []

    // Split into featured vs regular; fair multi-seller rotation (Phase 3.2)
    const featured = rows.filter(l => isListingFeatured(l))
    const regular  = rows.filter(l => !isListingFeatured(l))
    const sortedFeatured = rotateFeaturedFairly(featured, { intervalMs: 30_000, maxPerSeller: 2 })

    // Sort regular by user's chosen sort
    let sortedRegular = [...regular]
    switch (currentSort) {
      case 'price_asc':  sortedRegular.sort((a, b) => (a.price || 0) - (b.price || 0)); break
      case 'price_desc': sortedRegular.sort((a, b) => (b.price || 0) - (a.price || 0)); break
      default:           sortedRegular.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }

    // Merge: fair-rotated featured first, then regular
    let merged = [...sortedFeatured, ...sortedRegular]

    // Enrich with verified flags (all candidates so filters + totals stay correct)
    const shopIds   = [...new Set(merged.map(l => l.shop_id).filter(Boolean))]
    const sellerIds = [...new Set(merged.map(l => l.seller_id).filter(Boolean))]

    const [shopsRes, profilesRes] = await Promise.all([
      shopIds.length > 0
        ? supabase.from('shops').select('id, is_verified').in('id', shopIds)
        : Promise.resolve({ data: [] }),
      sellerIds.length > 0
        ? supabase.from('profiles').select('id, is_verified').in('id', sellerIds)
        : Promise.resolve({ data: [] }),
    ])

    const shopMap    = Object.fromEntries((shopsRes.data || []).map(s => [s.id, s]))
    const profileMap = Object.fromEntries((profilesRes.data || []).map(p => [p.id, p]))

    merged = merged.map(l => ({
      ...l,
      shop_is_verified: l.shop_id   ? (shopMap[l.shop_id]?.is_verified    ?? false) : false,
      seller_verified:  l.seller_id ? (profileMap[l.seller_id]?.is_verified ?? false) : false,
    }))

    if (filters.verifiedOnly) {
      merged = merged.filter(l => l.seller_verified || l.shop_is_verified)
    }

    // Show first page * PAGE_SIZE (See more loads more by raising page)
    const visible = merged.slice(0, currentPage * PAGE_SIZE)
    setAllResults(visible)
    setTotalCount(merged.length)
  }

     

  /* ── Shops tab — searches shops.name, scoped to active shops ── */
  async function searchShops(currentSort, currentPage) {
    let query = supabase
      .from('shops')
      .select('id, name, slug, category, logo_url, cover_url, city, rating, review_count, listing_count, is_verified, follower_count', { count: 'exact' })
      .eq('is_active', true)
      .ilike('name', `%${queryParam}%`)

    switch (currentSort) {
      case 'newest': query = query.order('id', { ascending: false }); break
      default:       query = query.order('follower_count', { ascending: false, nullsFirst: false })
    }

    // Cumulative fetch: first page*PAGE_SIZE rows (See more raises page)
    query = query.range(0, currentPage * PAGE_SIZE - 1)

    const { data, count, error } = await query
    if (error) throw error

    setAllResults(data || [])
    setTotalCount(count || 0)
  }

  /* ── People Looking For tab — searches buyer_requests.title ── */
  async function searchLookingFor(currentSort, currentPage) {
    let query = supabase
      .from('buyer_requests')
      .select('id, title, description, category, city, cities, created_at, budget, offer_count, urgency, image_url', { count: 'exact' })
      .not('status', 'eq', 'fulfilled')
      .ilike('title', `%${queryParam}%`)

    switch (currentSort) {
      case 'price_asc':  query = query.order('budget', { ascending: true });  break
      case 'price_desc': query = query.order('budget', { ascending: false }); break
      default:            query = query.order('created_at', { ascending: false })
    }

    query = query.range(0, currentPage * PAGE_SIZE - 1)

    const { data, count, error } = await query
    if (error) throw error

    setAllResults(data || [])
    setTotalCount(count || 0)
  }

  /* ── Jobs tab — searches jobs.title, scoped to active + non-expired ── */
  async function searchJobs(currentSort, currentPage) {
    const today = new Date().toISOString().split('T')[0]
    let query = supabase
      .from('jobs')
      .select('id, title, company, city, type, created_at, deadline', { count: 'exact' })
      .eq('status', 'active')
      .or(`deadline.is.null,deadline.gte.${today}`)
      .ilike('title', `%${queryParam}%`)
      .order('created_at', { ascending: false })

    query = query.range(0, currentPage * PAGE_SIZE - 1)

    const { data, count, error } = await query
    if (error) throw error

    setAllResults(data || [])
    setTotalCount(count || 0)
  }

  /* ── Services tab — searches services.name, scoped to active ── */
  async function searchServices(currentSort, currentPage) {
    let query = supabase
      .from('services')
      .select('id, name, category, city, created_at', { count: 'exact' })
      .eq('status', 'active')
      .ilike('name', `%${queryParam}%`)
      .order('created_at', { ascending: false })

    query = query.range(0, currentPage * PAGE_SIZE - 1)

    const { data, count, error } = await query
    if (error) throw error

    setAllResults(data || [])
    setTotalCount(count || 0)
  }

  function handleSearchSubmit() {
    if (!search.trim()) return
    setPage(1)
    setSearchParams({ q: search.trim() })
  }

  function handleKey(e) { if (e.key === 'Enter') handleSearchSubmit() }

  function toggleCat(key) {
    setCheckedCats(prev => {
      const next = new Set(prev)
      const node = CATEGORY_TREE.find(n => n.key === key)
      const isParent = node?.children?.length > 0
      const willCheck = !next.has(key)

      if (isParent) {
        // Checking/unchecking a parent cascades to all its children
        if (willCheck) {
          next.add(key)
          node.children.forEach(c => next.add(c.key))
        } else {
          next.delete(key)
          node.children.forEach(c => next.delete(c.key))
        }
      } else {
        // Toggling a subcategory
        willCheck ? next.add(key) : next.delete(key)

        const parentKey = SUBCAT_PARENT[key]
        if (parentKey) {
          const parentNode = CATEGORY_TREE.find(n => n.key === parentKey)
          const allChildrenChecked = parentNode.children.every(c => next.has(c.key))
          if (allChildrenChecked) next.add(parentKey)
          else next.delete(parentKey)
        }
      }
      return next
    })
  }

  function toggleCondition(key) {
    setConditions(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  function toggleAvailability(key) {
    setAvailability(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  

  function clearAll() {
    setCheckedCats(new Set())
    setPriceMin('')
    setPriceMax('')
    setDistrict('All Districts')
    setConditions(new Set())
    setAvailability(new Set())
    setVerifiedOnly(false)
    setPage(1)
  }

  function clearFiltersAndSearch() {
    clearAll()
  }

  function handleTabChange(tabKey) {
    if (tabKey === activeTab) return
    setActiveTab(tabKey)
    setAllResults([])
    setTotalCount(0)
    setPage(1)
  }

  function resultHref(tab, item) {
    switch (tab) {
      case 'listings':   return '/listing/' + item.id
      case 'shops':      return '/shop/' + item.slug
      case 'lookingfor': return '/looking-for'
      case 'jobs':       return '/jobs'
      case 'services':   return '/services'
      default:           return '/'
    }
  }

  const hasMore = allResults.length < totalCount
  const remaining = Math.max(0, totalCount - allResults.length)
  const showFilterSidebar = activeTab === 'listings'

  const filterProps = {
    checkedCats, onToggleCat: toggleCat, onClearAll: clearAll,
    priceMin, setPriceMin, priceMax, setPriceMax,
    district, setDistrict,
    conditions, onToggleCondition: toggleCondition,
    availability, onToggleAvailability: toggleAvailability,
    verifiedOnly, setVerifiedOnly,
  }

  const resultsLabel = {
    listings: 'listings', shops: 'shops', lookingfor: 'requests', jobs: 'jobs', services: 'services',
  }[activeTab]

  return (
    <div className="sp-root">
      <GlobalStyles />

      <SokoNav
        user={user}
        notifCount={notifCount}
        search={search}
        setSearch={setSearch}
        navigate={navigate}
        activeDistrict={district}
        onDistrictChange={(d) => { setDistrict(d); setPage(1) }}
        activePillar="marketplace"
        ctaLabel="Sell Now"
        onCta={() => navigate('/post')}
      />

      <div className="sp-page">

        {/* ── Search summary bar ── */}
        <div className="sp-summary">
          <div className="sp-summary-title">
            {queryParam
              ? <>Results for <span style={{ color:T.green }}>&ldquo;{queryParam}&rdquo;</span></>
              : catParam
                ? <>Browsing <span style={{ color:T.green }}>{catParam}</span></>
                : 'Browse listings'}
          </div>
          <div className="sp-summary-count">
            {loading ? 'Searching…' : `${totalCount.toLocaleString()} ${resultsLabel} found`}
          </div>
        </div>

        {/* ── Search tabs — one per pillar ── */}
        <div className="sp-scroll sp-tabs-scroll" style={{ display:'flex', gap:4, overflowX:'auto', marginTop:12, borderBottom:`1px solid ${T.gray200}` }}>
          {SEARCH_TABS.map(t => {
            const count = tabCounts[t.key]
            return (
              <button
                key={t.key}
                type="button"
                className={`sp-search-tab${activeTab === t.key ? ' active' : ''}`}
                onClick={() => handleTabChange(t.key)}
              >
                <span style={{ display:'flex', alignItems:'center' }}>{t.icon(15)}</span>
                {t.label}
                {count != null && <span className="sp-tab-count">{count}</span>}
              </button>
            )
          })}
        </div>

        <div className="sp-body">

          {/* ── FILTER SIDEBAR (desktop) — Marketplace tab only ── */}
          {showFilterSidebar && (
            <div className="sp-sidebar" style={{ position:'sticky', top:140, maxHeight:'calc(100vh - 160px)', overflowY:'auto' }}>
              <div
                className={`sp-sidebar-panel${sidebarStuck ? ' stuck' : ''}`}
                style={{ background:'#fff', borderRadius:16, border:`1px solid ${T.gray200}`, padding:'18px 16px', boxShadow:T.shadow }}
              >
                <FilterPanel {...filterProps} />
              </div>
            </div>
          )}

          {/* ── RIGHT COLUMN ── */}
          <div className="sp-main">

            {/* Sort + view bar */}
            <div className="sp-toolbar">
              <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', minWidth:0, flex:1 }}>
                {showFilterSidebar && (
                  <button
                    type="button"
                    className="sp-mobile-filter-btn"
                    style={{ display:'none', alignItems:'center', gap:6, background:'#fff', border:`1.5px solid ${T.gray200}`, borderRadius:12, padding:'9px 12px', fontSize:13, fontWeight:700, color:T.gray800, cursor:'pointer', minHeight:40 }}
                    onClick={() => setMobileFilterOpen(true)}
                  >
                    {Icon.filter(15)} Filters
                    {(checkedCats.size > 0 || priceMin || priceMax || verifiedOnly || conditions.size > 0) && (
                      <span style={{ background:T.green, color:'#fff', borderRadius:'50%', width:18, height:18, fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {checkedCats.size + (verifiedOnly ? 1 : 0) + conditions.size}
                      </span>
                    )}
                  </button>
                )}

                <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                  <span style={{ fontSize:12.5, color:T.gray600, whiteSpace:'nowrap' }}>Sort</span>
                  <select className="sp-sort-select" value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1) }}>
                    <option value="relevance">Relevance</option>
                    <option value="newest">Newest first</option>
                    {activeTab === 'listings' && <option value="price_asc">Price: Low to High</option>}
                    {activeTab === 'listings' && <option value="price_desc">Price: High to Low</option>}
                    {activeTab === 'lookingfor' && <option value="price_asc">Budget: Low to High</option>}
                    {activeTab === 'lookingfor' && <option value="price_desc">Budget: High to Low</option>}
                  </select>
                </div>
              </div>

              {activeTab === 'listings' && (
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button type="button" className={`sp-view-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')} title="Grid view" aria-label="Grid view">
                    {Icon.grid(15)}
                  </button>
                  <button type="button" className={`sp-view-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')} title="List view" aria-label="List view">
                    {Icon.list(15)}
                  </button>
                </div>
              )}
            </div>

            {/* ── Results ── */}
            {loading ? (
              activeTab === 'listings' ? (
                <div className="sp-results-grid grid-4">
                  {Array.from({ length: PAGE_SIZE }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {Array.from({ length: 5 }).map((_, i) => <SkeletonRowCard key={i} />)}
                </div>
              )
            ) : allResults.length === 0 ? (
              <EmptyState query={queryParam} onClearFilters={clearFiltersAndSearch} label={resultsLabel} />
            ) : activeTab === 'listings' ? (
              viewMode === 'grid' ? (
                <div className="sp-results-grid grid-4">
                  {allResults.map((l, i) => (
                    <ResultCardGrid
                      key={l.id}
                      listing={l}
                      delay={Math.min(i, 12) * 0.03}
                      onClick={() => navigate(resultHref('listings', l))}
                      user={user}
                      navigate={navigate}
                      saved={savedIds.has(l.id)}
                      onToggleSave={toggleListingSave}
                    />
                  ))}
                </div>
              ) : (
                <div className="sp-results-grid list-mode">
                  {allResults.map((l, i) => (
                    <ResultCardList
                      key={l.id}
                      listing={l}
                      delay={Math.min(i, 12) * 0.03}
                      onClick={() => navigate(resultHref('listings', l))}
                      user={user}
                      navigate={navigate}
                      saved={savedIds.has(l.id)}
                      onToggleSave={toggleListingSave}
                    />
                  ))}
                </div>
              )
            ) : activeTab === 'shops' ? (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {allResults.map((s, i) => (
                  <ShopResultCard key={s.id} shop={s} delay={Math.min(i, 12) * 0.03} onClick={() => navigate(resultHref('shops', s))} />
                ))}
              </div>
            ) : activeTab === 'lookingfor' ? (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {allResults.map((r, i) => (
                  <RequestResultCard key={r.id} request={r} delay={Math.min(i, 12) * 0.03} onClick={() => navigate(resultHref('lookingfor', r))} />
                ))}
              </div>
            ) : activeTab === 'jobs' ? (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {allResults.map((j, i) => (
                  <JobResultCard key={j.id} job={j} delay={Math.min(i, 12) * 0.03} onClick={() => navigate(resultHref('jobs', j))} />
                ))}
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {allResults.map((s, i) => (
                  <ServiceResultCard key={s.id} service={s} delay={Math.min(i, 12) * 0.03} onClick={() => navigate(resultHref('services', s))} />
                ))}
              </div>
            )}

            {/* ── See more (20 at a time) ── */}
            {!loading && allResults.length > 0 && (
              <SeeMoreButton
                visible={hasMore}
                loading={loadingMore}
                remaining={remaining}
                onClick={() => setPage(p => p + 1)}
              />
            )}
          </div>
        </div>
      </div>

      {/* ── Mobile filter drawer — Marketplace tab only ── */}
      {mobileFilterOpen && showFilterSidebar && (
        <div className="sp-filter-drawer">
          <div className="sp-filter-drawer-overlay" onClick={() => setMobileFilterOpen(false)} />
          <div className="sp-filter-drawer-panel">
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
              <div style={{ fontSize:16, fontWeight:800, color:T.gray900 }}>Filters</div>
              <button onClick={() => setMobileFilterOpen(false)} style={{ background:'none', border:'none', cursor:'pointer', color:T.gray700, display:'flex' }}>{Icon.x(20)}</button>
            </div>
            <FilterPanel {...filterProps} />
            <button onClick={() => setMobileFilterOpen(false)} style={{ width:'100%', marginTop:16, background:T.green, color:'#fff', border:'none', borderRadius:12, padding:'13px 0', fontSize:14, fontWeight:700, cursor:'pointer' }}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}