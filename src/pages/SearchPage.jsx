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
  bellOff:  (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.7 3A6 6 0 0 1 18 8c0 2.8.7 4.8 1.4 6.2M6.3 6.3C6.1 6.8 6 7.4 6 8c0 7-3 9-3 9h13.5"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><line x1="2" y1="2" x2="22" y2="22"/></svg>,
  mail:     (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>,
  pause:    (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>,
  play:     (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>,
  sliders:  (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>,
  tag:      (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24H4a1 1 0 0 0-1 1v5.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.83 0l5.59-5.59a2 2 0 0 0 0-2.83z"/><circle cx="7.5" cy="7.5" r="1.2" fill="currentColor" stroke="none"/></svg>,
  cash:     (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="6" width="20" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.5"/><line x1="6" y1="12" x2="6" y2="12.01"/><line x1="18" y1="12" x2="18" y2="12.01"/></svg>,
  award:    (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="6"/><path d="M8.21 13.89 7 23l5-3 5 3-1.21-9.12"/></svg>,
  shield:   (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>,
  map:      (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 6v15l7-3 8 3 7-3V3l-7 3-8-3-7 3z"/><line x1="8" y1="3" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="21"/></svg>,
  target:   (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1" fill="currentColor"/></svg>,
  crosshair:(s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><line x1="12" y1="1" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="1" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="23" y2="12"/></svg>,
  spinner:  (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation:'spin .8s linear infinite' }}><path d="M12 2a10 10 0 0 1 10 10"/></svg>,
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
}

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */
function formatPrice(n) {
  if (!n && n !== 0) return ''
  return `MK ${n.toLocaleString()}`
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat/2) ** 2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
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

const SUBCAT_PARENT = CATEGORY_TREE.reduce((map, node) => {
  (node.children || []).forEach(child => { map[child.key] = node.key })
  return map
}, {})

const CONDITIONS = [
  { key: 'new',        label: 'Brand New' },
  { key: 'like_new',   label: 'Like New' },
  { key: 'used_good',  label: 'Used - Good' },
  { key: 'used_fair',  label: 'Used - Fair' },
  { key: 'for_parts',  label: 'For Parts' },
]

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
  { key: 'Home', label: 'Home',         path: '/',            icon: (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10"/></svg> },
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
      .sp-root { font-family: ${T.font}; background: #f8f9fa; color: ${T.gray900}; min-height: 100vh; }
      .sp-root button { font-family: inherit; }
      .sp-root input  { font-family: inherit; }
      .sp-scroll::-webkit-scrollbar { display: none; }
      .sp-scroll { -ms-overflow-style: none; scrollbar-width: none; }

      /* Thin visible scrollbar for the sticky filter sidebar */
      .sp-sidebar-scroll {
        scrollbar-width: thin;
        scrollbar-color: ${T.gray300} transparent;
      }
      .sp-sidebar-scroll::-webkit-scrollbar { width: 6px; }
      .sp-sidebar-scroll::-webkit-scrollbar-track { background: transparent; }
      .sp-sidebar-scroll::-webkit-scrollbar-thumb {
        background: ${T.gray300}; border-radius: 10px;
      }
      .sp-sidebar-scroll::-webkit-scrollbar-thumb:hover { background: ${T.gray400}; }

      @keyframes fadeUp   { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
      @keyframes shimmer  { 0% { background-position:-600px 0; } 100% { background-position:600px 0; } }
      @keyframes badgePop { 0% { transform:scale(.7); opacity:0; } 70% { transform:scale(1.1); } 100% { transform:scale(1); opacity:1; } }
      @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }

      .sp-filter-section + .sp-filter-section { border-top: 1px solid #f1f3f4; margin-top: 18px; padding-top: 18px; }
      .sp-filter-head { display:flex; align-items:center; gap:9px; margin-bottom:12px; }
      .sp-filter-icon-badge { width:28px; height:28px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .sp-filter-title { font-size:13px; font-weight:700; color:#202124; }

      .sp-pill-toggle { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-radius:12px; background:#f8f9fa; border:1.5px solid transparent; transition:all .15s; cursor:pointer; }
      .sp-pill-toggle:hover { background:#f1f3f4; }
      .sp-pill-toggle.on { background:#e8f5ee; border-color:#bfe6cf; }
      .sp-pill-label { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:#3c4043; }

      .sp-chip { display:inline-flex; align-items:center; gap:5px; padding:7px 13px; border-radius:50px; font-size:12.5px; font-weight:600; border:1.5px solid #e8eaed; background:#fff; color:#5f6368; cursor:pointer; transition:all .15s; white-space:nowrap; }
      .sp-chip:hover { border-color:#0F9D58; color:#0F9D58; }
      .sp-chip.active { background:#0F9D58; border-color:#0F9D58; color:#fff; box-shadow:0 3px 10px rgba(15,157,88,.25); }

      .sp-range-input { width:100%; border:1.5px solid #e8eaed; border-radius:10px; padding:9px 11px 9px 28px; font-size:13px; color:#202124; outline:none; box-sizing:border-box; transition:border-color .15s; }
      .sp-range-input:focus { border-color:#0F9D58; }
      .sp-range-wrap { position:relative; flex:1; }
      .sp-range-prefix { position:absolute; left:11px; top:50%; transform:translateY(-50%); font-size:12.5px; color:#9aa0a6; font-weight:600; pointer-events:none; }
      @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }

      .sp-filter-section + .sp-filter-section { border-top: 1px solid #f1f3f4; margin-top: 18px; padding-top: 18px; }
      .sp-filter-head { display:flex; align-items:center; gap:9px; margin-bottom:12px; }
      .sp-filter-icon-badge { width:28px; height:28px; border-radius:9px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
      .sp-filter-title { font-size:13px; font-weight:700; color:#202124; }

      .sp-pill-toggle { display:flex; align-items:center; justify-content:space-between; padding:10px 12px; border-radius:12px; background:#f8f9fa; border:1.5px solid transparent; transition:all .15s; cursor:pointer; }
      .sp-pill-toggle:hover { background:#f1f3f4; }
      .sp-pill-toggle.on { background:#e8f5ee; border-color:#bfe6cf; }
      .sp-pill-label { display:flex; align-items:center; gap:8px; font-size:13px; font-weight:600; color:#3c4043; }

      .sp-chip { display:inline-flex; align-items:center; gap:5px; padding:7px 13px; border-radius:50px; font-size:12.5px; font-weight:600; border:1.5px solid #e8eaed; background:#fff; color:#5f6368; cursor:pointer; transition:all .15s; white-space:nowrap; }
      .sp-chip:hover { border-color:#0F9D58; color:#0F9D58; }
      .sp-chip.active { background:#0F9D58; border-color:#0F9D58; color:#fff; box-shadow:0 3px 10px rgba(15,157,88,.25); }

      .sp-range-input { width:100%; border:1.5px solid #e8eaed; border-radius:10px; padding:9px 11px 9px 28px; font-size:13px; color:#202124; outline:none; box-sizing:border-box; transition:border-color .15s; }
      .sp-range-input:focus { border-color:#0F9D58; }
      .sp-range-wrap { position:relative; flex:1; }
      .sp-range-prefix { position:absolute; left:11px; top:50%; transform:translateY(-50%); font-size:12.5px; color:#9aa0a6; font-weight:600; pointer-events:none; }

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

      /* filter sidebar */
      .sp-sidebar { width: 220px; flex-shrink: 0; }
      .sp-sidebar-panel { width: 100%; box-sizing: border-box; }

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
      .sp-sidebar-panel .sp-check-row:hover { transform: translateX(3px); }
      .sp-sidebar-panel .sp-check-box {
        transition: border-color .3s cubic-bezier(.16,1,.3,1), background .3s cubic-bezier(.16,1,.3,1), transform .3s cubic-bezier(.16,1,.3,1);
      }
      .sp-sidebar-panel .sp-check-row:active .sp-check-box { transform: scale(.82); }
      .sp-sidebar-panel .sp-check-box.checked { animation: sidebarCheckPop .4s cubic-bezier(.34,1.6,.64,1); }
      @keyframes sidebarCheckPop {
        0%   { transform:scale(.6) rotate(-8deg); }
        55%  { transform:scale(1.25) rotate(4deg); }
        100% { transform:scale(1) rotate(0); }
      }
      .sp-subcat-wrap {
        animation: sidebarSubReveal .45s cubic-bezier(.16,1,.3,1) both;
        overflow: hidden;
        transform-origin: top;
      }
      @keyframes sidebarSubReveal {
        0%   { opacity:0; transform:translateY(-10px) scaleY(.85); max-height:0; }
        100% { opacity:1; transform:translateY(0) scaleY(1); max-height:600px; }
      }
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

      /* pagination */
      .sp-page-btn {
        width:36px; height:36px; border-radius:8px; border:1.5px solid ${T.gray200};
        background:#fff; display:flex; align-items:center; justify-content:center;
        font-size:13.5px; font-weight:600; color:${T.gray700}; cursor:pointer;
        transition:all .15s;
      }
      .sp-page-btn:hover { border-color:${T.green}; color:${T.green}; background:${T.greenL}; }
      .sp-page-btn.active { background:${T.green}; border-color:${T.green}; color:#fff; }
      .sp-page-btn:disabled { opacity:.4; cursor:not-allowed; }

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

      @media(max-width:900px) {
        .sp-sidebar { display:none !important; }
        .sp-mobile-filter-btn { display:flex !important; }
        .sp-results-grid.grid-4 { grid-template-columns:repeat(2,1fr) !important; }
      }
      @media(max-width:540px) {
        .sp-results-grid.grid-4 { grid-template-columns:1fr !important; }
        .sp-results-grid.list-mode { grid-template-columns:1fr !important; }
        .sp-tabs-scroll { padding-right: 20px; }
      }
    `}</style>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   NAVBAR (same visual as Home.jsx SokoNav, self-contained here to avoid
   import coupling — feel free to swap to the shared component later)
───────────────────────────────────────────────────────────────────────────── */
function SearchNav({ user, notifCount, search, setSearch, navigate, onSearchBarClick, activeTab, isSearchPage = false }) {
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
            onChange={e => {
              const val = e.target.value
              setSearch(val)
              onSearchBarClick?.()        // opens the overlay
              // propagate the typed value up so liveQuery syncs immediately
              if (typeof window !== 'undefined') {
                window.__sokoSearchInput__ = val
              }
            }}
            onFocus={() => { setFocused(true); onSearchBarClick?.() }}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKey}
            placeholder="Search for anything..."
            style={{ flex:1, border:'none', background:'transparent', fontSize:13.5, color:T.gray900, outline:'none', minWidth:0, cursor:'text' }}
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
          {PILLARS.map(p => {
            // On search page, NO pillar gets the active underline — the search
            // tabs row below already shows which pillar/tab is active.
            const isActive = isSearchPage ? false : p.key === 'marketplace'
            return (
              <button key={p.key} onClick={() => navigate(p.path)}
                style={{ display:'flex', alignItems:'center', gap:6, padding:'10px 16px', background:'none', border:'none', borderBottom: isActive ? `2.5px solid ${T.green}` : '2.5px solid transparent', cursor:'pointer', fontSize:13.5, fontWeight: isActive ? 700 : 500, color: isActive ? T.green : T.gray700, whiteSpace:'nowrap', transition:'color .15s' }}
                onMouseEnter={e => { e.currentTarget.style.color = T.green }}
                onMouseLeave={e => { e.currentTarget.style.color = isActive ? T.green : T.gray700 }}
              >
                <span style={{ color: isActive ? T.green : T.gray500, display:'flex' }}>{p.icon(15)}</span>
                {p.label}
              </button>
            )
          })}
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
  delivery, onToggleDelivery,
  verifiedOnly, setVerifiedOnly,
  nearMe, setNearMe, locating,
}) {
  const [lastClicked, setLastClicked] = useState(null)

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

      {/* NEAR ME */}
      <div style={{ marginBottom:20 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.gray900, display:'flex', alignItems:'center', gap:6 }}>
            {locating ? Icon.spinner(14) : Icon.crosshair(14)}
            Near Me
          </div>
          <div className={`sp-toggle-track${nearMe ? ' on' : ''}`} onClick={() => !locating && setNearMe()}>
            <div className="sp-toggle-thumb" />
          </div>
        </div>
        {locating && <div style={{ fontSize:11.5, color:T.gray500, marginTop:6 }}>Locating…</div>}
      </div>

      <div style={{ height:1, background:T.gray100, marginBottom:18 }} />

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

      {/* CONDITION */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.gray900, marginBottom:10 }}>Condition</div>
        {CONDITIONS.map(c => (
          <Checkbox key={c.key} checked={conditions.has(c.key)} onChange={() => onToggleCondition(c.key)} label={c.label} />
        ))}
      </div>

      <div style={{ height:1, background:T.gray100, marginBottom:18 }} />

      {/* VERIFIED SELLERS */}
      <div style={{ marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ fontSize:13, fontWeight:700, color:T.gray900 }}>Verified Sellers</div>
          <div className={`sp-toggle-track${verifiedOnly ? ' on' : ''}`} onClick={() => setVerifiedOnly()}>
            <div className="sp-toggle-thumb" />
          </div>
        </div>
      </div>

      

      {/* DELIVERY */}
      <div className="sp-filter-section">
        <div className="sp-filter-head">
          <span className="sp-filter-icon-badge" style={{ background:T.gray100, color:T.gray700 }}>{Icon.briefcase(14)}</span>
          <span className="sp-filter-title">Delivery Option</span>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
          {['Delivery Available','Pickup Only'].map(d => (
            <button key={d} className={`sp-chip${delivery.has(d) ? ' active' : ''}`} onClick={() => onToggleDelivery(d)}>
              {delivery.has(d) && Icon.check(11)} {d}
            </button>
          ))}
        </div>
      </div>

      </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   RESULT CARD — GRID mode (Marketplace / listings tab)
───────────────────────────────────────────────────────────────────────────── */
function ResultCardGrid({ listing, delay, onClick }) {
  const [hov, setHov]     = useState(false)
  const [liked, setLiked] = useState(false)
  const [imgErr, setImgErr] = useState(false)
  const isVerif = listing.seller_verified || listing.shop_is_verified
  const isFeat  = isListingFeatured(listing)
  const isNew   = listing.created_at && (Date.now() - new Date(listing.created_at).getTime()) < 86400000

  return (
    <div className="sp-card" style={{ animationDelay:`${delay}s` }} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} onClick={onClick}>
      {/* Image */}
      <div style={{ position:'relative', width:'100%', height:185, overflow:'hidden', background:T.gray100, flexShrink:0, borderRadius:'12px 12px 0 0' }}>
        {listing.images?.[0] && !imgErr
          ? <img src={listing.images[0]} alt={listing.title} onError={() => setImgErr(true)} className="sp-card-img" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:42, color:T.gray400 }}>📦</div>
        }
        {isFeat && (
          <div style={{ position:'absolute', top:10, left:10, background:`linear-gradient(135deg,${T.amber},#e09800)`, color:'#1a0a00', borderRadius:50, padding:'3px 10px', fontSize:9.5, fontWeight:900, boxShadow:'0 2px 8px rgba(249,171,0,0.4)', display:'flex', alignItems:'center', gap:4 }}>⭐ FEATURED</div>
        )}
        {isNew && !isFeat && (
          <div style={{ position:'absolute', top:10, left:10, background:T.green, color:'#fff', borderRadius:50, padding:'3px 10px', fontSize:9.5, fontWeight:800 }}>NEW</div>
        )}
        {/* Wishlist */}
        <button onClick={e => { e.stopPropagation(); setLiked(l => !l) }} style={{ position:'absolute', top:9, right:9, width:30, height:30, borderRadius:'50%', border:'none', cursor:'pointer', background:'rgba(255,255,255,0.92)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', color:liked ? T.red : T.gray700, boxShadow:'0 2px 8px rgba(0,0,0,.12)', transition:'transform .2s' }}>
          {Icon.heart(14, liked ? 'currentColor' : 'none')}
        </button>
      </div>

      {/* Body */}
      <div style={{ padding:'10px 12px 12px', display:'flex', flexDirection:'column', gap:5, flex:1 }}>
        <div style={{ display:'flex', alignItems:'center', gap:4 }}>
          <span style={{ fontSize:13, fontWeight:700, color:T.gray900, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical', minWidth:0 }}>{listing.title}</span>
          {isVerif && <span style={{ flexShrink:0 }}>{Icon.verify(13)}</span>}
        </div>
        <div style={{ fontFamily:T.fontDisplay, fontSize:17, fontWeight:800, color:T.green, letterSpacing:'-0.3px' }}>{formatPrice(listing.price)}</div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', fontSize:11.5, color:T.gray600 }}>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}>
            <span style={{ color:T.green }}>{Icon.pin(11)}</span>{listing.city || 'Malawi'}
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:3 }}>
            {Icon.clock(11)} {timeAgo(listing.created_at)}
          </span>
        </div>
        {isVerif && (
          <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'#15803d', fontWeight:600 }}>
            {Icon.verify(11)} Verified
          </div>
        )}
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   RESULT CARD — LIST mode (Marketplace / listings tab)
───────────────────────────────────────────────────────────────────────────── */
function ResultCardList({ listing, delay, onClick }) {
  const [liked, setLiked] = useState(false)
  const [imgErr, setImgErr] = useState(false)
  const isVerif = listing.seller_verified || listing.shop_is_verified
  const isFeat  = isListingFeatured(listing)

  return (
    <div className="sp-card-list" style={{ animationDelay:`${delay}s` }} onClick={onClick}>
      <div style={{ position:'relative', width:140, height:110, flexShrink:0, overflow:'hidden', background:T.gray100 }}>
        {listing.images?.[0] && !imgErr
          ? <img src={listing.images[0]} alt={listing.title} onError={() => setImgErr(true)} className="sp-card-img" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:34, color:T.gray400 }}>📦</div>
        }
        {isFeat && <div style={{ position:'absolute', top:8, left:8, background:`linear-gradient(135deg,${T.amber},#e09800)`, color:'#1a0a00', borderRadius:50, padding:'2px 8px', fontSize:9, fontWeight:900 }}>⭐</div>}
      </div>
      <div style={{ flex:1, padding:'12px 14px', display:'flex', flexDirection:'column', justifyContent:'space-between', minWidth:0 }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
            <span style={{ fontSize:14, fontWeight:700, color:T.gray900 }}>{listing.title}</span>
            {isVerif && <span>{Icon.verify(13)}</span>}
          </div>
          {listing.description && (
            <div style={{ fontSize:12, color:T.gray600, lineHeight:1.4, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical' }}>{listing.description}</div>
          )}
        </div>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginTop:8 }}>
          <div style={{ fontFamily:T.fontDisplay, fontSize:17, fontWeight:800, color:T.green }}>{formatPrice(listing.price)}</div>
          <div style={{ display:'flex', alignItems:'center', gap:12, fontSize:11.5, color:T.gray600 }}>
            <span style={{ display:'flex', alignItems:'center', gap:3 }}>{Icon.pin(11)} {listing.city || 'Malawi'}</span>
            <span style={{ display:'flex', alignItems:'center', gap:3 }}>{Icon.clock(11)} {timeAgo(listing.created_at)}</span>
            {isVerif && <span style={{ display:'flex', alignItems:'center', gap:3, color:'#15803d', fontWeight:600 }}>{Icon.verify(11)} Verified</span>}
          </div>
        </div>
      </div>
      <button onClick={e => { e.stopPropagation(); setLiked(l => !l) }} style={{ alignSelf:'center', marginRight:14, width:34, height:34, borderRadius:'50%', border:`1.5px solid ${T.gray200}`, background:'#fff', display:'flex', alignItems:'center', justifyContent:'center', color:liked ? T.red : T.gray600, cursor:'pointer' }}>
        {Icon.heart(14, liked ? 'currentColor' : 'none')}
      </button>
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
   PAGINATION
───────────────────────────────────────────────────────────────────────────── */
function Pagination({ page, totalPages, onChange }) {
  function pages() {
    const arr = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) arr.push(i)
      return arr
    }
    arr.push(1)
    if (page > 3) arr.push('...')
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) arr.push(i)
    if (page < totalPages - 2) arr.push('...')
    arr.push(totalPages)
    return arr
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, justifyContent:'center', padding:'32px 0 8px' }}>
      <button className="sp-page-btn" disabled={page === 1} onClick={() => onChange(page - 1)}>
        {Icon.chevL(14)}
      </button>
      {pages().map((p, i) => (
        typeof p === 'number'
          ? <button key={i} className={`sp-page-btn${p === page ? ' active' : ''}`} onClick={() => onChange(p)}>{p}</button>
          : <span key={i} style={{ padding:'0 4px', color:T.gray500, fontSize:14 }}>…</span>
      ))}
      <button className="sp-page-btn" disabled={page === totalPages} onClick={() => onChange(page + 1)}>
        {Icon.chevR(14)}
      </button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN SEARCH PAGE COMPONENT
───────────────────────────────────────────────────────────────────────────── */
const PAGE_SIZE = 20

/* ─────────────────────────────────────────────────────────────────────────────
   LIVE SEARCH OVERLAY
───────────────────────────────────────────────────────────────────────────── */
function LiveSearchOverlay({ liveQuery, setLiveQuery, liveResults, liveLoading, onClose, onCommit, navigate }) {
  const inputRef = useRef(null)

  useEffect(() => {
    // Focus and place cursor at end so user can keep typing seamlessly
    const el = inputRef.current
    if (!el) return
    el.focus()
    const len = el.value.length
    el.setSelectionRange(len, len)
  }, [])

  // Sync any characters the user typed in the nav bar before overlay mounted
  useEffect(() => {
    if (window.__sokoSearchInput__ !== undefined && window.__sokoSearchInput__ !== liveQuery) {
      setLiveQuery(window.__sokoSearchInput__)
      window.__sokoSearchInput__ = undefined
    }
  }, [])

  const total = liveResults.listings.length + liveResults.shops.length + liveResults.jobs.length + liveResults.services.length + liveResults.requests.length

  function MoreHint({ shown, total, label, onClick }) {
    const extra = total - shown
    if (extra <= 0) return null
    return (
      <button onClick={onClick} style={{ display:'block', width:'100%', textAlign:'left', padding:'6px 18px 10px', fontSize:12, fontWeight:700, color:T.green, background:'none', border:'none', cursor:'pointer' }}>
        +{extra} more {label} →
      </button>
    )
  }

  function commit(q) {
    if (!q.trim()) return
    onCommit(q.trim())
    onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:400, display:'flex', flexDirection:'column' }}>
      {/* Backdrop */}
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.45)', backdropFilter:'blur(4px)' }} />

      {/* Panel */}
      <div style={{ position:'relative', zIndex:1, background:'#fff', width:'100%', maxWidth:680, margin:'0 auto', borderRadius:'0 0 24px 24px', boxShadow:'0 12px 48px rgba(0,0,0,.22)', display:'flex', flexDirection:'column', maxHeight:'90vh' }}>

        {/* Search input row */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'16px 18px', borderBottom:`1px solid ${T.gray100}` }}>
          <span style={{ color:T.green, display:'flex', flexShrink:0 }}>{Icon.search(20)}</span>
          <input
            ref={inputRef}
            value={liveQuery}
            onChange={e => setLiveQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(liveQuery); if (e.key === 'Escape') onClose() }}
            placeholder="Search listings, shops, jobs, services…"
            style={{ flex:1, border:'none', outline:'none', fontSize:16, fontWeight:500, color:T.gray900, background:'transparent' }}
          />
          {liveQuery && (
            <button onClick={() => setLiveQuery('')} style={{ background:T.gray200, border:'none', borderRadius:'50%', width:22, height:22, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:T.gray600, flexShrink:0 }}>{Icon.x(11)}</button>
          )}
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:T.gray500, fontSize:13.5, fontWeight:600, flexShrink:0, padding:'4px 8px' }}>Cancel</button>
        </div>

        {/* Results scroll area */}
        <div style={{ overflowY:'auto', flex:1 }}>
          {!liveQuery.trim() && (
            <div style={{ padding:'32px 20px', textAlign:'center', color:T.gray500, fontSize:14 }}>
              Start typing to search across all of SokoMW…
            </div>
          )}

          {liveQuery.trim() && liveLoading && (
            <div style={{ padding:'28px 20px', display:'flex', flexDirection:'column', gap:10 }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ display:'flex', alignItems:'center', gap:12 }}>
                  <div className="skeleton" style={{ width:44, height:44, borderRadius:10, flexShrink:0 }} />
                  <div style={{ flex:1, display:'flex', flexDirection:'column', gap:6 }}>
                    <div className="skeleton" style={{ height:13, width:'55%' }} />
                    <div className="skeleton" style={{ height:11, width:'35%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {liveQuery.trim() && !liveLoading && total === 0 && (
            <div style={{ padding:'40px 20px', textAlign:'center' }}>
              <div style={{ fontSize:32, marginBottom:10 }}>🔍</div>
              <div style={{ fontSize:15, fontWeight:700, color:T.gray800, marginBottom:6 }}>No results for "{liveQuery}"</div>
              <div style={{ fontSize:13, color:T.gray500 }}>Try different keywords or check the spelling</div>
            </div>
          )}

          {liveQuery.trim() && !liveLoading && total > 0 && (
            <div style={{ padding:'8px 0 16px' }}>

              {/* Listings */}
              {liveResults.listings.length > 0 && (
                <Section label="Marketplace" icon="🛒">
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, padding:'0 14px' }}>
                    {liveResults.listings.map(l => (
                      <div key={l.id} onClick={() => { navigate('/listing/'+l.id); onClose() }}
                        style={{ display:'flex', gap:10, alignItems:'center', cursor:'pointer', padding:'8px 10px', borderRadius:12, transition:'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = T.gray50}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ width:48, height:48, borderRadius:10, overflow:'hidden', background:T.gray100, flexShrink:0 }}>
                          {l.images?.[0]
                            ? <img src={l.images[0]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:22 }}>📦</div>
                          }
                        </div>
                        <div style={{ minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:600, color:T.gray900, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{l.title}</div>
                          <div style={{ fontSize:12, color:T.green, fontWeight:700 }}>{formatPrice(l.price)}</div>
                          <div style={{ fontSize:11, color:T.gray500 }}>{l.city || 'Malawi'}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                <MoreHint shown={liveResults.listings.length} total={liveResults.listingsTotal} label="listings" onClick={() => commit(liveQuery)} />
                </Section>
              )}

              {/* Shops */}
              {liveResults.shops.length > 0 && (
                <Section label="Shops" icon="🏪">
                  {liveResults.shops.map(s => (
                    <LiveRow key={s.id} onClick={() => { navigate('/shop/'+s.slug); onClose() }}
                      avatar={s.logo_url ? <img src={s.logo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} /> : <span style={{ fontSize:18 }}>🏪</span>}
                      title={s.name} sub={[s.category, s.city].filter(Boolean).join(' · ')}
                    />
                  ))}
                  <MoreHint shown={liveResults.shops.length} total={liveResults.shopsTotal} label="shops" onClick={() => { commit(liveQuery) }} />
                </Section>
              )}

              {/* Jobs */}
              {liveResults.jobs.length > 0 && (
                <Section label="Jobs" icon="💼">
                  {liveResults.jobs.map(j => (
                    <LiveRow key={j.id} onClick={() => { navigate('/jobs'); onClose() }}
                      avatar={<span style={{ fontSize:18 }}>💼</span>}
                      title={j.title} sub={[j.company, j.city].filter(Boolean).join(' · ')}
                    />
                  ))}
                  <MoreHint shown={liveResults.jobs.length} total={liveResults.jobsTotal} label="jobs" onClick={() => { navigate('/jobs'); onClose() }} />
                </Section>
              )}

              {/* Services */}
              {liveResults.services.length > 0 && (
                <Section label="Services" icon="🔧">
                  {liveResults.services.map(s => (
                    <LiveRow key={s.id} onClick={() => { navigate('/services'); onClose() }}
                      avatar={<span style={{ fontSize:18 }}>🔧</span>}
                      title={s.name} sub={[s.category, s.city].filter(Boolean).join(' · ')}
                    />
                  ))}
                  <MoreHint shown={liveResults.services.length} total={liveResults.servicesTotal} label="services" onClick={() => { navigate('/services'); onClose() }} />
                </Section>
              )}

              {/* Buyer requests */}
              {liveResults.requests.length > 0 && (
                <Section label="People Looking For" icon="🙋">
                  {liveResults.requests.map(r => (
                    <LiveRow key={r.id} onClick={() => { navigate('/looking-for'); onClose() }}
                      avatar={<span style={{ fontSize:18 }}>🙋</span>}
                      title={r.title} sub={r.budget ? `MK ${Number(r.budget).toLocaleString()}` : 'Negotiable'}
                    />
                  ))}
                  <MoreHint shown={liveResults.requests.length} total={liveResults.requestsTotal} label="requests" onClick={() => { navigate('/looking-for'); onClose() }} />
                </Section>
              )}

              {/* See all results */}
              <div style={{ padding:'12px 14px 4px' }}>
                <button onClick={() => commit(liveQuery)}
                  style={{ width:'100%', background:T.greenL, color:T.green, border:`1.5px solid ${T.green}`, borderRadius:12, padding:'12px 0', fontSize:14, fontWeight:700, cursor:'pointer' }}>
                  See all results for "{liveQuery}" →
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ label, icon, children }) {
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:6, padding:'8px 18px 4px', fontSize:11.5, fontWeight:800, color:T.gray500, textTransform:'uppercase', letterSpacing:'0.06em' }}>
        <span>{icon}</span>{label}
      </div>
      {children}
    </div>
  )
}

function LiveRow({ onClick, avatar, title, sub }) {
  return (
    <div onClick={onClick}
      style={{ display:'flex', alignItems:'center', gap:12, padding:'9px 18px', cursor:'pointer', transition:'background .15s' }}
      onMouseEnter={e => e.currentTarget.style.background = T.gray50}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <div style={{ width:40, height:40, borderRadius:10, background:T.gray100, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, overflow:'hidden' }}>{avatar}</div>
      <div style={{ minWidth:0 }}>
        <div style={{ fontSize:13.5, fontWeight:600, color:T.gray900, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{title}</div>
        {sub && <div style={{ fontSize:12, color:T.gray500, marginTop:1 }}>{sub}</div>}
      </div>
      <span style={{ marginLeft:'auto', color:T.gray400, flexShrink:0 }}>{Icon.chevR(14)}</span>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   NOTIFY ME MODAL — user subscribes to be alerted when matching items post
───────────────────────────────────────────────────────────────────────────── */
function NotifyMeModal({ query, onClose, user }) {
  const [tab, setTab]           = useState('create') // 'create' | 'manage'
  const [email, setEmail]       = useState(user?.email || '')
  const [keywords, setKeywords] = useState(query || '')
  const [maxPrice, setMaxPrice] = useState('')
  const [category, setCategory] = useState('')
  const [district, setDistrict] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [alerts, setAlerts]     = useState([])
  const [loadingAlerts, setLoadingAlerts] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [togglingId, setTogglingId] = useState(null)

  useEffect(() => {
    if (tab === 'manage') loadAlerts()
  }, [tab])

  async function loadAlerts() {
    setLoadingAlerts(true)
    try {
      let q = supabase.from('wanted_alerts').select('*').order('created_at', { ascending: false })
      if (user?.id) {
        q = q.eq('user_id', user.id)
      } else if (email.trim()) {
        q = q.eq('email', email.trim())
      } else {
        // No way to identify user — show empty
        setAlerts([])
        setLoadingAlerts(false)
        return
      }
      const { data, error } = await q
      if (error) console.error(error)
      setAlerts(data || [])
    } catch (e) { console.error(e) }
    setLoadingAlerts(false)
  }

 async function handleSave() {
    if (!keywords.trim()) return
    setSaving(true)
    try {
      const { error } = await supabase.from('wanted_alerts').insert({
        user_id:      user?.id || null,
        keywords:     keywords.trim().split(',').map(k => k.trim()).filter(Boolean),
        active:       true,
        notify_email: true,
        notify_push:  true,
        email:        email.trim() || null,
        category:     category || null,
        district:     district || null,
        budget_max:   maxPrice ? Number(maxPrice) : null,
      })
      if (error) { console.error(error); setSaving(false); return }
      setSubmitted(true)
    } catch (e) { console.error(e) }
    setSaving(false)
  }

  async function handleToggle(alert) {
    setTogglingId(alert.id)
    try {
      await supabase.from('wanted_alerts').update({ active: !alert.active }).eq('id', alert.id)
      setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, active: !a.active } : a))
    } catch (e) { console.error(e) }
    setTogglingId(null)
  }

  async function handleDelete(id) {
    setDeletingId(id)
    try {
      await supabase.from('wanted_alerts').delete().eq('id', id)
      setAlerts(prev => prev.filter(a => a.id !== id))
    } catch (e) { console.error(e) }
    setDeletingId(null)
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, display:'flex', alignItems:'center', justifyContent:'center', padding:20 }}>
      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(0,0,0,.5)', backdropFilter:'blur(3px)' }} />
      <div style={{ position:'relative', background:'#fff', borderRadius:20, padding:'24px 24px 28px', width:'100%', maxWidth:460, boxShadow:'0 16px 60px rgba(0,0,0,.22)', zIndex:1, maxHeight:'90vh', display:'flex', flexDirection:'column' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18 }}>
          <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:16, fontWeight:800, color:T.gray900 }}>
            <span style={{ display:'flex', alignItems:'center', justifyContent:'center', width:28, height:28, borderRadius:9, background:T.greenL, color:T.green, flexShrink:0 }}>{Icon.bell(15)}</span>
            Listing Alerts
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:T.gray500, display:'flex' }}>{Icon.x(18)}</button>
        </div>

        {/* Tabs */}
        {!submitted && (
          <div style={{ display:'flex', gap:8, marginBottom:20, background:T.gray100, borderRadius:12, padding:4 }}>
            {[
              { key:'create', label:'New Alert', icon: Icon.plus },
              { key:'manage', label:'My Alerts',  icon: Icon.list },
            ].map(t => (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:6, padding:'8px 0', borderRadius:9, border:'none', fontSize:13, fontWeight:700, cursor:'pointer', background: tab === t.key ? '#fff' : 'transparent', color: tab === t.key ? T.green : T.gray600, boxShadow: tab === t.key ? '0 1px 4px rgba(0,0,0,.1)' : 'none', transition:'all .15s' }}>
                {t.icon(13)}
                {t.label}
              </button>
            ))}
          </div>
        )}

       {/* CREATE tab */}
        {tab === 'create' && !submitted && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <p style={{ fontSize:12.5, color:T.gray600, marginTop:-8 }}>Get notified the moment a matching listing is posted.</p>
            <div>
              <label style={{ fontSize:12.5, fontWeight:700, color:T.gray700, display:'block', marginBottom:5 }}>Keywords</label>
              <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="e.g. iPhone 13, Toyota Corolla…" style={{ width:'100%', border:`1.5px solid ${T.gray200}`, borderRadius:10, padding:'10px 12px', fontSize:13.5, color:T.gray900, outline:'none', boxSizing:'border-box' }} />
              <div style={{ fontSize:11.5, color:T.gray500, marginTop:4 }}>Separate multiple keywords with commas</div>
            </div>

            <div style={{ display:'flex', gap:10 }}>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:12.5, fontWeight:700, color:T.gray700, display:'block', marginBottom:5 }}>Category</label>
                <div style={{ position:'relative' }}>
                  <select value={category} onChange={e => setCategory(e.target.value)} style={{ width:'100%', appearance:'none', border:`1.5px solid ${T.gray200}`, borderRadius:10, padding:'10px 30px 10px 12px', fontSize:13.5, color:T.gray900, background:'#fff', cursor:'pointer', outline:'none', boxSizing:'border-box' }}>
                    <option value="">Any category</option>
                    {CATEGORY_TREE.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                  </select>
                  <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:T.gray500, pointerEvents:'none' }}>{Icon.chevDown(12)}</span>
                </div>
              </div>
              <div style={{ flex:1 }}>
                <label style={{ fontSize:12.5, fontWeight:700, color:T.gray700, display:'block', marginBottom:5 }}>District</label>
                <div style={{ position:'relative' }}>
                  <select value={district} onChange={e => setDistrict(e.target.value)} style={{ width:'100%', appearance:'none', border:`1.5px solid ${T.gray200}`, borderRadius:10, padding:'10px 30px 10px 12px', fontSize:13.5, color:T.gray900, background:'#fff', cursor:'pointer', outline:'none', boxSizing:'border-box' }}>
                    {ALL_DISTRICTS.map(d => <option key={d} value={d === 'All Districts' ? '' : d}>{d}</option>)}
                  </select>
                  <span style={{ position:'absolute', right:10, top:'50%', transform:'translateY(-50%)', color:T.gray500, pointerEvents:'none' }}>{Icon.chevDown(12)}</span>
                </div>
              </div>
            </div>

            <div>
              <label style={{ fontSize:12.5, fontWeight:700, color:T.gray700, display:'block', marginBottom:5 }}>Max budget (optional)</label>
              <input type="number" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="e.g. 500000" style={{ width:'100%', border:`1.5px solid ${T.gray200}`, borderRadius:10, padding:'10px 12px', fontSize:13.5, color:T.gray900, outline:'none', boxSizing:'border-box' }} />
              <div style={{ fontSize:11.5, color:T.gray500, marginTop:4 }}>Only notify me if the price is at or below this (MK)</div>
            </div>

            <div>
              <label style={{ fontSize:12.5, fontWeight:700, color:T.gray700, display:'block', marginBottom:5 }}>Notification email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" style={{ width:'100%', border:`1.5px solid ${T.gray200}`, borderRadius:10, padding:'10px 12px', fontSize:13.5, color:T.gray900, outline:'none', boxSizing:'border-box' }} />
              <div style={{ fontSize:11.5, color:T.gray500, marginTop:4 }}>We'll send matching listings here</div>
            </div>
            <button onClick={handleSave} disabled={saving || !keywords.trim()}
              style={{ marginTop:4, width:'100%', background: saving || !keywords.trim() ? T.gray300 : T.green, color:'#fff', border:'none', borderRadius:12, padding:'13px 0', fontSize:14, fontWeight:700, cursor: saving ? 'not-allowed' : 'pointer', boxShadow:`0 4px 16px rgba(15,157,88,0.25)`, transition:'background .15s' }}>     {saving ? 'Saving…' : (
                <span style={{ display:'inline-flex', alignItems:'center', gap:7 }}>
                  {Icon.bell(14)} Activate Alert
                </span>
              )}
 
            </button>
          </div>
        )}

        {/* SUCCESS */}
        {submitted && (
          <div style={{ textAlign:'center', padding:'16px 0' }}>
            <div style={{ width:72, height:72, borderRadius:'50%', background:T.greenL, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', color:T.green }}>
              {Icon.bell(32)}
            </div>
            <div style={{ fontSize:18, fontWeight:800, color:T.gray900, marginBottom:8 }}>Alert activated!</div>
            <div style={{ fontSize:14, color:T.gray600, marginBottom:6, lineHeight:1.6 }}>
              You'll be notified the moment a listing matching <strong>"{keywords}"</strong> is posted.
            </div>
            <div style={{ fontSize:12.5, color:T.gray500, marginBottom:22 }}>You can deactivate or delete it anytime from "My Alerts".</div>
            <div style={{ display:'flex', gap:10, justifyContent:'center' }}>
              <button onClick={() => { setSubmitted(false); setTab('manage') }} style={{ background:T.greenL, color:T.green, border:`1.5px solid ${T.green}`, borderRadius:12, padding:'10px 20px', fontSize:13.5, fontWeight:700, cursor:'pointer' }}>View My Alerts</button>
              <button onClick={onClose} style={{ background:T.green, color:'#fff', border:'none', borderRadius:12, padding:'10px 24px', fontSize:13.5, fontWeight:700, cursor:'pointer' }}>Done</button>
            </div>
          </div>
        )}

        {/* MANAGE tab */}
        {tab === 'manage' && (
          <div style={{ overflowY:'auto', flex:1 }}>
            {loadingAlerts ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[1,2,3].map(i => <div key={i} className="skeleton" style={{ height:68, borderRadius:12 }} />)}
              </div>
            ) : alerts.length === 0 ? (
              <div style={{ textAlign:'center', padding:'32px 16px' }}>
                <div style={{ width:60, height:60, borderRadius:'50%', background:T.gray100, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', color:T.gray400 }}>
                  {Icon.bellOff(26)}
                </div>
                <div style={{ fontSize:14, fontWeight:700, color:T.gray800, marginBottom:6 }}>No alerts yet</div>
                <div style={{ fontSize:13, color:T.gray500, marginBottom:18 }}>Create an alert to get notified when matching listings appear.</div>
                <button onClick={() => setTab('create')} style={{ background:T.green, color:'#fff', border:'none', borderRadius:12, padding:'10px 24px', fontSize:13.5, fontWeight:700, cursor:'pointer' }}>Create Alert</button>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {alerts.map(a => (
                  <div key={a.id} style={{ background: a.active ? T.greenL : T.gray50, border:`1.5px solid ${a.active ? '#b7dfc9' : T.gray200}`, borderRadius:14, padding:'13px 14px', display:'flex', alignItems:'center', gap:12, transition:'all .2s' }}>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:7, marginBottom:3 }}>
                        <span style={{ fontSize:14, fontWeight:700, color:T.gray900, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
  {Array.isArray(a.keywords) ? a.keywords.join(', ') : (a.keywords || a.category || 'Alert')}
</span>
                        <span style={{ flexShrink:0, fontSize:10.5, fontWeight:800, borderRadius:50, padding:'2px 8px', background: a.active ? T.green : T.gray300, color: a.active ? '#fff' : T.gray600 }}>
                          {a.active ? 'ACTIVE' : 'PAUSED'}
                        </span>
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:10, fontSize:11.5, color:T.gray600, flexWrap:'wrap' }}>
                        <span>{a.category || 'Any category'}</span>
                        {a.district && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>{Icon.pin(11)} {a.district}</span>}
                        {a.budget_max && <span>≤ MK {Number(a.budget_max).toLocaleString()}</span>}
                        {a.notify_email && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>{Icon.mail(11)} Email</span>}
                        {a.notify_push && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>{Icon.bell(11)} Push</span>}
                      </div>
                    </div>

                    {/* Toggle active/pause */}
                    <button
                      onClick={() => handleToggle(a)}
                      disabled={togglingId === a.id}
                      title={a.active ? 'Pause alert' : 'Reactivate alert'}
                      style={{ width:36, height:36, borderRadius:10, border:`1.5px solid ${a.active ? T.green : T.gray300}`, background: a.active ? T.greenL : '#fff', color: a.active ? T.green : T.gray500, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, transition:'all .15s' }}>
                      {togglingId === a.id ? '…' : a.active ? Icon.pause(13) : Icon.play(13)}
                    </button>

                    {/* Delete */}
                    <button
                      onClick={() => handleDelete(a.id)}
                      disabled={deletingId === a.id}
                      title="Delete alert"
                      style={{ width:36, height:36, borderRadius:10, border:`1.5px solid ${T.gray200}`, background:'#fff', color: T.red, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0, transition:'all .15s' }}>
                      {deletingId === a.id ? '…' : Icon.x(13)}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   FACEBOOK-STYLE LISTING CARD
───────────────────────────────────────────────────────────────────────────── */
const CAT_STYLE = {
  Electronics:      { color:'#16a34a', bg:null },
  Furniture:        { color:'#be185d', bg:'#fce7f3' },
  Fashion:          { color:'#be185d', bg:'#fce7f3' },
  Clothing:         { color:'#be185d', bg:'#fce7f3' },
  Vehicles:         { color:'#1d4ed8', bg:'#dbeafe' },
  Property:         { color:'#1d4ed8', bg:'#dbeafe' },
  'Home Appliances':{ color:'#1d4ed8', bg:null },
  Agriculture:      { color:'#15803d', bg:null },
  Food:             { color:'#c2410c', bg:'#ffedd5' },
  Services:         { color:'#0a7a44', bg:null },
  Jobs:             { color:'#2563eb', bg:null },
}
function catStyle(cat) { return CAT_STYLE[cat] || { color:T.gray600, bg:null } }

function conditionLabel(listing) {
  const c = listing.condition
  if (!c) return null
  return c === 'new' ? 'Brand New' : (c === 'like_new' ? 'Like New' : 'Used')
}

function FBListingCard({ listing, onClick }) {
  const [liked, setLiked]   = useState(false)
  const [hov, setHov]       = useState(false)
  const [imgErr, setImgErr] = useState(false)
  const isVerif  = listing.seller_verified || listing.shop_is_verified
  const isFeat   = isListingFeatured(listing)
  const cond     = conditionLabel(listing)
  const catStyleObj = catStyle(listing.category)
  const sellerName = listing.shop_name || listing.seller_name || 'Seller'
  const rating   = listing.rating ?? listing.shop_rating
  const reviews  = listing.review_count ?? listing.shop_review_count
  const views    = listing.view_count
  const chats    = listing.inquiry_count ?? listing.chat_count

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background:'#fff', borderRadius:20, border:`1px solid ${T.gray100}`,
        boxShadow: hov ? '0 12px 30px rgba(0,0,0,.15)' : '0 2px 8px rgba(0,0,0,.06)',
        cursor:'pointer', overflow:'hidden',
        transform: hov ? 'translateY(-5px)' : 'translateY(0)',
        transition:'box-shadow .25s ease, transform .25s ease',
      }}
    >
      {/* Image — 4:3 ratio */}
      <div style={{ position:'relative', width:'100%', paddingBottom:'75%', background:T.gray100, overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0 }}>
          {listing.images?.[0] && !imgErr
            ? <img src={listing.images[0]} alt={listing.title} onError={() => setImgErr(true)}
                style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform .45s cubic-bezier(.22,1,.36,1)', transform: hov ? 'scale(1.05)' : 'scale(1)' }}
              />
            : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:48, color:T.gray300 }}>📦</div>
          }
        </div>

        {isFeat && (
          <div style={{ position:'absolute', top:10, left:10, display:'flex', alignItems:'center', gap:5, background:'#FF7A1A', color:'#fff', padding:'6px 14px', fontSize:11.5, fontWeight:800, borderRadius:50, boxShadow:'0 3px 10px rgba(255,122,26,0.4)', zIndex:2 }}>
            {Icon.star(12, '#fff')} Featured
          </div>
        )}

        <button onClick={e => { e.stopPropagation(); setLiked(l => !l) }}
          style={{ position:'absolute', top:9, right:9, width:28, height:28, borderRadius:'50%', border:'none', background:'rgba(255,255,255,.9)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color: liked ? T.red : T.gray600, boxShadow:'0 2px 6px rgba(0,0,0,.12)', zIndex:2 }}>
          {Icon.heart(13, liked ? 'currentColor' : 'none')}
        </button>

        {listing.category && (
          <div style={{ position:'absolute', bottom:9, left:9, background:'rgba(255,255,255,.95)', color:catStyleObj.color, borderRadius:50, padding:'3px 11px', fontSize:10.5, fontWeight:700, zIndex:2 }}>
            {listing.category}
          </div>
        )}
      </div>

      {/* Body */}
      <div style={{ padding:'12px 14px 13px' }}>
        <div style={{ fontFamily:T.fontDisplay, fontSize:20, fontWeight:900, color:T.green, letterSpacing:'-0.3px', marginBottom:3 }}>
          {formatPrice(listing.price)}
        </div>

        <div style={{ fontSize:13.5, fontWeight:600, color:T.gray900, marginBottom:9, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:1, WebkitBoxOrient:'vertical' }}>
          {listing.title}
        </div>

        {/* Seller row */}
        <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
          <div style={{ width:26, height:26, borderRadius:'50%', flexShrink:0, overflow:'hidden', background:`linear-gradient(135deg, ${T.green}, ${T.greenD})`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:11 }}>
            {listing.shop_logo_url || listing.seller_avatar_url
              ? <img src={listing.shop_logo_url || listing.seller_avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : sellerName[0]?.toUpperCase()}
          </div>
          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:700, color:T.gray800, overflow:'hidden', minWidth:0, flex:1 }}>
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sellerName}</span>
            {isVerif && <span style={{ flexShrink:0, display:'flex' }}>{Icon.verify(13)}</span>}
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:10.5, color:T.gray500, flexShrink:0, marginLeft:'auto' }}>
            {Icon.clock(10)} {timeAgo(listing.created_at)}
          </span>
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11.5, color:T.gray600, marginBottom:6, minHeight:15 }}>
          {rating != null
            ? <>{Icon.star(11)} <span style={{ fontWeight:700, color:T.gray800 }}>{Number(rating).toFixed(1)}</span> {reviews != null && `(${reviews})`}</>
            : <span style={{ color:T.gray400, fontStyle:'italic' }}>No ratings yet</span>}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11.5, color:T.gray500, marginBottom:5 }}>
          {Icon.pin(11)}
          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {[listing.district, listing.city].filter(Boolean).join(' • ') || 'Malawi'}
          </span>
        </div>

        {listing._distanceKm != null && (
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:T.gray500, marginBottom:8 }}>
            <span
              onClick={e => {
                if (!listing._isPrecise) return
                e.stopPropagation()
                const dst = `${listing.latitude},${listing.longitude}`
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${dst}&travelmode=driving`, '_blank')
              }}
              style={{ display:'flex', alignItems:'center', gap:3, color: listing._isPrecise ? T.blue : T.gray500, fontWeight:600, cursor: listing._isPrecise ? 'pointer' : 'default' }}
            >
              {Icon.crosshair(11)} {listing._distanceKm < 1 ? `${Math.round(listing._distanceKm * 1000)}m` : `${listing._distanceKm.toFixed(1)}km`} away
            </span>
          </div>
        )}

        {(views != null || chats != null) && (
          <div style={{ display:'flex', alignItems:'center', gap:14, fontSize:11, color:T.gray500, marginBottom:10 }}>
            {views != null && (
              <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                {views}
              </span>
            )}
            {chats != null && (
              <span style={{ display:'flex', alignItems:'center', gap:4 }}>
                {Icon.chat(13)} {chats}
              </span>
            )}
          </div>
        )}

        {/* Quick actions — In-app Chat is always required; WhatsApp/Call show
            only if the seller configured that contact method in PostListing */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', borderTop:`1px solid ${T.gray100}`, paddingTop:9, gap:6 }}>
          <button onClick={e => { e.stopPropagation(); onClick() }} style={{ display:'flex', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', color:T.amberD, fontSize:11, fontWeight:700, padding:0 }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
            Quick View
          </button>
          <button onClick={e => e.stopPropagation()} style={{ display:'flex', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', color:T.amberD, fontSize:11, fontWeight:700, padding:0 }}>
            {Icon.chat(13)} Chat
          </button>
          {listing.contact_methods?.includes('call') && listing.call_number && (
            <button
              onClick={e => {
                e.stopPropagation()
                window.open(`tel:${listing.call_number}`, '_self')
              }}
              style={{ display:'flex', alignItems:'center', gap:4, background:'none', border:'none', cursor:'pointer', color:T.amberD, fontSize:11, fontWeight:700, padding:0 }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
              Call
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
export default function SearchPage() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const queryParam = searchParams.get('q') || ''

  const [search, setSearch]       = useState(queryParam)
  const [user, setUser]           = useState(null)
  const [notifCount, setNotifCount] = useState(0)

  // ── Active tab ──
  const [activeTab, setActiveTab] = useState('listings')
  const [tabCounts, setTabCounts] = useState({ listings: null, shops: null, lookingfor: null, jobs: null, services: null })

  // ── Results state ──
  const [allResults, setAllResults] = useState([])
  const [loading, setLoading]       = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  const [page, setPage]             = useState(1)

  // ── Filter state (Marketplace tab only) ──
  const [checkedCats, setCheckedCats]   = useState(new Set())
  const [priceMin, setPriceMin]         = useState('')
  const [priceMax, setPriceMax]         = useState('')
  const [district, setDistrict]         = useState('All Districts')
  const [conditions, setConditions]     = useState(new Set())
  const [delivery, setDelivery]         = useState(new Set())
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [featuredOnly, setFeaturedOnly] = useState(false)
  const [nearMe, setNearMe]             = useState(false)
  const [locating, setLocating]         = useState(false)
  const [userCoords, setUserCoords]     = useState(null) // { lat, lng }
  const [sortBy, setSortBy]             = useState('relevance')
  const [viewMode, setViewMode]         = useState('grid') // 'grid' | 'list'
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
  
  const [notifyOpen, setNotifyOpen]             = useState(false)
  const [searchOpen, setSearchOpen]             = useState(!!searchParams.get('focus'))
  const [liveQuery, setLiveQuery]               = useState(searchParams.get('focus') ? (searchParams.get('q') || '') : '')
  const [liveResults, setLiveResults]           = useState({ listings:[], listingsTotal:0, shops:[], shopsTotal:0, jobs:[], jobsTotal:0, services:[], servicesTotal:0, requests:[], requestsTotal:0 })
  const [liveLoading, setLiveLoading]           = useState(false)
  const liveRef                                 = useRef(null)

  // ── Applied (committed) filters — only change on "Apply" ──
  const [applied, setApplied] = useState({
    cats: new Set(), priceMin:'', priceMax:'', district:'All Districts',
    conditions: new Set(), delivery: new Set(), verifiedOnly: false,
    featuredOnly: false, nearMe: false, userCoords: null,
  })
  // Incrementing this guarantees the search useEffect re-fires even when
  // applied looks structurally identical (e.g. clearing already-empty filters)
  const [searchTick, setSearchTick] = useState(0)

  /* Sync URL → search input */
  useEffect(() => { setSearch(queryParam) }, [queryParam])

  /* Auth */
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        setUser(user)
        supabase.from('notifications').select('*', { count:'exact', head:true }).eq('user_id', user.id).eq('read', false)
          .then(({ count }) => setNotifCount(count || 0))
      }
    })
  }, [])

  /* Near Me — request geolocation once when toggled on, then search
     immediately once coordinates resolve (no extra "Apply" click needed) */
  const geoAttempted = useRef(false)
  useEffect(() => {
    if (!nearMe) { geoAttempted.current = false; return }
    if (userCoords) return // already have it
    if (geoAttempted.current) return // already tried + failed this session, don't retry in a loop
    if (!navigator.geolocation) {
      console.error('Geolocation not supported')
      setNearMe(false)
      return
    }
    geoAttempted.current = true
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setUserCoords(coords)
        setLocating(false)
        // Search immediately now that we have real coordinates
        setPage(1)
        setApplied(prev => ({ ...prev, nearMe: true, userCoords: coords }))
        setSearchTick(t => t + 1)
        doSearch(activeTab, { cats: checkedCats, priceMin, priceMax, district, conditions, delivery, verifiedOnly, featuredOnly, nearMe: true, userCoords: coords }, sortBy, 1)
      },
      (err) => {
        console.error('Geolocation error:', err.message)
        setLocating(false)
        setNearMe(false)
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    )
  }, [nearMe, userCoords])

  /* Live search — fires 300 ms after the user stops typing */
  useEffect(() => {
    if (!liveQuery.trim()) {
      setLiveResults({ listings:[], shops:[], jobs:[], services:[], requests:[] })
      return
    }
    const timer = setTimeout(async () => {
      setLiveLoading(true)
      const q = liveQuery.trim()
      const safe = async (fn) => { try { return await fn() } catch { return [] } }
      const LIMITS = { listings: 4, shops: 3, jobs: 3, services: 3, requests: 3 }

      const [
        listingsRes, shopsRes, jobsRes, servicesRes, requestsRes,
      ] = await Promise.all([
        safe(async () => {
          const { data, count } = await supabase.from('listings')
            .select('id,title,price,images,city,created_at,featured,is_featured,featured_until', { count: 'exact' })
            .eq('status','published').ilike('title',`%${q}%`)
            .order('featured_until', { ascending: false, nullsFirst: false })
            .order('created_at',  { ascending: false })
            .limit(LIMITS.listings)
          return { data: data || [], count: count || 0 }
        }),
        safe(async () => {
          const { data, count } = await supabase.from('shops')
            .select('id,name,slug,logo_url,city,category', { count: 'exact' })
            .eq('is_active',true).ilike('name',`%${q}%`).limit(LIMITS.shops)
          return { data: data || [], count: count || 0 }
        }),
        safe(async () => {
          const { data, count } = await supabase.from('jobs')
            .select('id,title,company,city', { count: 'exact' })
            .eq('status','active').ilike('title',`%${q}%`).limit(LIMITS.jobs)
          return { data: data || [], count: count || 0 }
        }),
        safe(async () => {
          const { data, count } = await supabase.from('services')
            .select('id,name,category,city', { count: 'exact' })
            .eq('status','active').ilike('name',`%${q}%`).limit(LIMITS.services)
          return { data: data || [], count: count || 0 }
        }),
        safe(async () => {
          const { data, count } = await supabase.from('buyer_requests')
            .select('id,title,budget,city', { count: 'exact' })
            .not('status','eq','fulfilled').ilike('title',`%${q}%`).limit(LIMITS.requests)
          return { data: data || [], count: count || 0 }
        }),
      ])
      setLiveResults({
        listings:      listingsRes.data,  listingsTotal:  listingsRes.count,
        shops:         shopsRes.data,     shopsTotal:     shopsRes.count,
        jobs:          jobsRes.data,      jobsTotal:      jobsRes.count,
        services:      servicesRes.data,  servicesTotal:  servicesRes.count,
        requests:      requestsRes.data,  requestsTotal:  requestsRes.count,
      })
      setLiveLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [liveQuery])

  /* Reset to page 1 whenever the query or active tab changes */
  useEffect(() => { setPage(1) }, [queryParam, activeTab])

  /* Search whenever query, tab, filters, sort, or page change.
     Pass current values as args so doSearch never reads stale closure state.
     Runs even with an empty query so Marketplace can be browsed/filtered
     (e.g. Near Me) without requiring a typed search term. */
  useEffect(() => {
    doSearch(activeTab, applied, sortBy, page)
  }, [queryParam, activeTab, applied, sortBy, page, searchTick])

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
    setLoading(true)
    try {
      if (tab === 'listings')        await searchListings(filters, currentSort, currentPage)
      else if (tab === 'shops')      await searchShops(currentSort, currentPage)
      else if (tab === 'lookingfor') await searchLookingFor(currentSort, currentPage)
      else if (tab === 'jobs')       await searchJobs(currentSort, currentPage)
      else if (tab === 'services')   await searchServices(currentSort, currentPage)
    } catch (err) {
      console.error('Search error:', err)
      setAllResults([])
      setTotalCount(0)
    }
    setLoading(false)
  }

  /* ── Marketplace listings ── */
  async function searchListings(filters, currentSort, currentPage) {
    let query = supabase
      .from('listings')
      .select('id, title, price, images, city, district, category, condition, featured, is_featured, featured_until, created_at, seller_id, shop_id, description, latitude, longitude, precise_location, contact_methods, whatsapp_number, call_number', { count: 'exact' })
      .eq('status', 'published')

    // Only filter by title when there's an actual search term — an empty
    // query means "browse everything" (needed for Near Me / filter-only browsing)
    if (queryParam) query = query.ilike('title', `%${queryParam}%`)

    if (filters.cats.size > 0) query = query.in('category', [...filters.cats])
    if (filters.priceMin)      query = query.gte('price', Number(filters.priceMin))
    if (filters.priceMax)      query = query.lte('price', Number(filters.priceMax))
    if (filters.district && filters.district !== 'All Districts')
      query = query.ilike('city', `%${filters.district}%`)
    if (filters.conditions.size > 0) query = query.in('condition', [...filters.conditions])
    // Phase 2.2: featured_until > now() is the source of truth
    if (filters.featuredOnly)  query = query.gt('featured_until', new Date().toISOString())

    query = query.order('created_at', { ascending: false }).limit(200)

    const { data: allData, error } = await query
    if (error) throw error

    let rows = allData || []

    // Near Me — compute distance and sort by it, overriding other sort modes
    if (filters.nearMe && filters.userCoords) {
      rows = rows
        .map(l => ({
          ...l,
          _distanceKm: (l.latitude && l.longitude)
            ? distanceKm(filters.userCoords.lat, filters.userCoords.lng, l.latitude, l.longitude)
            : null,
          _isPrecise: !!l.precise_location,
        }))
        .sort((a, b) => {
          if (a._distanceKm == null) return 1
          if (b._distanceKm == null) return -1
          return a._distanceKm - b._distanceKm
        })
    }

    // Pin fair-rotated featured first (Phase 3.2); skip when Near Me (distance wins)
    const featured = filters.nearMe
      ? []
      : rotateFeaturedFairly(rows.filter(l => isListingFeatured(l)), {
          intervalMs: 30_000,
          maxPerSeller: 2,
        })
    const regular  = filters.nearMe ? rows : rows.filter(l => !isListingFeatured(l))

    let sortedRegular = [...regular]
    if (!filters.nearMe) {
      switch (currentSort) {
        case 'price_asc':  sortedRegular.sort((a, b) => (a.price || 0) - (b.price || 0)); break
        case 'price_desc': sortedRegular.sort((a, b) => (b.price || 0) - (a.price || 0)); break
        default:           sortedRegular.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      }
    }

    const merged = [...featured, ...sortedRegular]
    const from = (currentPage - 1) * PAGE_SIZE
    let results = merged.slice(from, from + PAGE_SIZE)

    const shopIds   = [...new Set(results.map(l => l.shop_id).filter(Boolean))]
    const sellerIds = [...new Set(results.map(l => l.seller_id).filter(Boolean))]

    const [shopsRes, profilesRes] = await Promise.all([
      shopIds.length > 0
        ? supabase.from('shops').select('id, name, logo_url, is_verified, rating, review_count').in('id', shopIds)
        : Promise.resolve({ data: [] }),
      sellerIds.length > 0
        ? supabase.from('profiles').select('id, full_name, avatar_url, is_verified').in('id', sellerIds)
        : Promise.resolve({ data: [] }),
    ])

    const shopMap    = Object.fromEntries((shopsRes.data || []).map(s => [s.id, s]))
    const profileMap = Object.fromEntries((profilesRes.data || []).map(p => [p.id, p]))

    results = results.map(l => {
      const shop    = l.shop_id   ? shopMap[l.shop_id]       : null
      const profile = l.seller_id ? profileMap[l.seller_id]  : null
      return {
        ...l,
        shop_is_verified:   shop?.is_verified ?? false,
        seller_verified:    profile?.is_verified ?? false,
        shop_name:          shop?.name || null,
        shop_logo_url:      shop?.logo_url || null,
        seller_name:        profile?.full_name || null,
        seller_avatar_url:  profile?.avatar_url || null,
        shop_rating:        shop?.rating ?? null,
        shop_review_count:  shop?.review_count ?? null,
        rating:             shop?.rating ?? null,
        review_count:       shop?.review_count ?? null,
      }
    })

    if (filters.verifiedOnly) {
      results = results.filter(l => l.seller_verified || l.shop_is_verified)
    }

    setAllResults(results)
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

    const from = (currentPage - 1) * PAGE_SIZE
    query = query.range(from, from + PAGE_SIZE - 1)

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

    const from = (currentPage - 1) * PAGE_SIZE
    query = query.range(from, from + PAGE_SIZE - 1)

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

    const from = (currentPage - 1) * PAGE_SIZE
    query = query.range(from, from + PAGE_SIZE - 1)

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

    const from = (currentPage - 1) * PAGE_SIZE
    query = query.range(from, from + PAGE_SIZE - 1)

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
      next.has(key) ? next.delete(key) : next.add(key)
      applyFiltersInstant({ cats: next })
      return next
    })
  }

  function toggleCondition(key) {
    setConditions(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      applyFiltersInstant({ conditions: next })
      return next
    })
  }

  function toggleDelivery(key) {
    setDelivery(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      applyFiltersInstant({ delivery: next })
      return next
    })
  }

  // Reset pending UI state AND commit empty filters so the search re-runs
  const EMPTY_FILTERS = {
    cats: new Set(), priceMin: '', priceMax: '', district: 'All Districts',
    conditions: new Set(), delivery: new Set(), verifiedOnly: false,
    featuredOnly: false, nearMe: false, userCoords: null,
  }

  function clearAll() {
    // Reset UI controls
    setCheckedCats(new Set())
    setPriceMin('')
    setPriceMax('')
    setDistrict('All Districts')
    setConditions(new Set())
    setDelivery(new Set())
    setVerifiedOnly(false)
    setFeaturedOnly(false)
    setNearMe(false)
    setPage(1)
    // Commit clean filters to state
    setApplied(EMPTY_FILTERS)
    // Bump tick so the useEffect always re-fires even if applied was already empty
    setSearchTick(t => t + 1)
    // Also call doSearch directly so results clear immediately without
    // waiting for the React state flush
    doSearch(activeTab, EMPTY_FILTERS, sortBy, 1)
  }

  

  // Instant-apply variant for simple toggle filters (Near Me, Featured,
  // Verified) — takes explicit overrides so it doesn't depend on React
  // state having flushed yet, and searches immediately without requiring
  // the person to also click "Apply Filters".
  function applyFiltersInstant(overrides) {
    const next = {
      cats: new Set(checkedCats),
      priceMin, priceMax, district,
      conditions: new Set(conditions),
      delivery: new Set(delivery),
      verifiedOnly, featuredOnly, nearMe, userCoords,
      ...overrides,
    }
    setPage(1)
    setApplied(next)
    setSearchTick(t => t + 1)
    setMobileFilterOpen(false)
    doSearch(activeTab, next, sortBy, 1)
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

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE))
  const showFilterSidebar = activeTab === 'listings'

  // Toggle handlers that update local state AND search immediately —
  // used for Near Me / Featured / Verified, which feel better as instant
  // switches rather than requiring a separate "Apply" tap.
  function toggleNearMeInstant() {
    const next = !nearMe
    setNearMe(next)
    // If turning on and we don't have coords yet, the geolocation effect
    // will fire and call applyFiltersInstant itself once coords resolve
    // (see Patch 3) — don't search yet with stale/no coords.
    if (!next || userCoords) {
      applyFiltersInstant({ nearMe: next, userCoords: next ? userCoords : null })
    }
  }
  function toggleFeaturedInstant() {
    const next = !featuredOnly
    setFeaturedOnly(next)
    applyFiltersInstant({ featuredOnly: next })
  }
  function toggleVerifiedInstant() {
    const next = !verifiedOnly
    setVerifiedOnly(next)
    applyFiltersInstant({ verifiedOnly: next })
  }

  function handlePriceMinChange(val) {
    setPriceMin(val)
    applyFiltersInstant({ priceMin: val })
  }
  function handlePriceMaxChange(val) {
    setPriceMax(val)
    applyFiltersInstant({ priceMax: val })
  }
  function handleDistrictChange(val) {
    setDistrict(val)
    applyFiltersInstant({ district: val })
  }

  const filterProps = {
    checkedCats, onToggleCat: toggleCat, onClearAll: clearAll,
    priceMin, setPriceMin: handlePriceMinChange, priceMax, setPriceMax: handlePriceMaxChange,
    district, setDistrict: handleDistrictChange,
    conditions, onToggleCondition: toggleCondition,
    delivery, onToggleDelivery: toggleDelivery,
    verifiedOnly, setVerifiedOnly: toggleVerifiedInstant,
    featuredOnly, setFeaturedOnly: toggleFeaturedInstant,
    nearMe, setNearMe: toggleNearMeInstant, locating,
  }

  const resultsLabel = {
    listings: 'listings', shops: 'shops', lookingfor: 'requests', jobs: 'jobs', services: 'services',
  }[activeTab]

  return (
    <div className="sp-root">
      <GlobalStyles />

      <SearchNav
        user={user} notifCount={notifCount} search={search} setSearch={setSearch} navigate={navigate}
        activeTab={activeTab}
        isSearchPage={true}
        onSearchBarClick={() => {
          setLiveQuery(window.__sokoSearchInput__ ?? search)
          setSearchOpen(true)
        }}
      />

      {searchOpen && (
        <LiveSearchOverlay
          liveQuery={liveQuery}
          setLiveQuery={setLiveQuery}
          liveResults={liveResults}
          liveLoading={liveLoading}
          onClose={() => {
            setSearchOpen(false)
            // If they typed something, commit it as the real search
            if (liveQuery.trim()) {
              setSearch(liveQuery.trim())
              setSearchParams({ q: liveQuery.trim() })
            }
          }}
          onCommit={q => {
            setSearch(q)
            setSearchParams({ q })
            setSearchOpen(false)
          }}
          navigate={navigate}
        />
      )}

      <div style={{ maxWidth:1400, margin:'0 auto', padding:'0 20px' }}>

        {/* ── Search summary bar ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 0 0', flexWrap:'wrap', gap:8 }}>
          <div style={{ fontSize:17, fontWeight:700, color:T.gray900 }}>
            Search results for <span style={{ color:T.green }}>"{queryParam}"</span>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            <div style={{ fontSize:14, color:T.gray600, fontWeight:500 }}>
              {loading ? 'Searching…' : `${totalCount.toLocaleString()} ${resultsLabel} found`}
            </div>
            <button
              onClick={() => setNotifyOpen(true)}
              style={{ display:'flex', alignItems:'center', gap:7, background:T.greenL, color:T.green, border:`1.5px solid ${T.green}`, borderRadius:50, padding:'8px 16px', fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap', transition:'background .15s' }}
              onMouseEnter={e => e.currentTarget.style.background = '#c6ead8'}
              onMouseLeave={e => e.currentTarget.style.background = T.greenL}
            >
              {Icon.bell(14)} Notify me when posted
            </button>
          </div>
        </div>

        {/* ── Search tabs — one per pillar ── */}
        <div className="sp-scroll sp-tabs-scroll" style={{ display:'flex', gap:4, overflowX:'auto', marginTop:16, borderBottom:`1px solid ${T.gray200}` }}>
          {SEARCH_TABS.map(t => {
            const count = tabCounts[t.key]
            return (
              <button
                key={t.key}
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

        <div style={{ display:'flex', gap:24, alignItems:'flex-start', paddingTop:18, paddingBottom:40 }}>

          {/* ── LEFT SIDEBAR — desktop only, Marketplace tab ── */}
          {showFilterSidebar && (
            <div className="sp-sidebar" style={{ alignSelf:'flex-start', position:'sticky', top:90 }}>
              <div
                className="sp-sidebar-panel sp-sidebar-scroll"
                style={{
                  background:'#fff', borderRadius:T.radiusSm, border:`1px solid ${T.gray100}`,
                  boxShadow:T.shadow, padding:'18px 16px',
                  maxHeight:'calc(100vh - 110px)', overflowY:'auto',
                }}
              >
                <FilterPanel {...filterProps} />
              </div>
            </div>
          )}

          {/* ── RIGHT COLUMN ── */}
          <div style={{ flex:1, minWidth:0 }}>

            {/* Sort + view bar */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:18, flexWrap:'wrap', gap:10 }}>
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                {/* Mobile filter button — Marketplace tab only */}
                {showFilterSidebar && (
                  <button
                    className="sp-mobile-filter-btn"
                    style={{ display:'none', alignItems:'center', gap:6, background:'#fff', border:`1.5px solid ${T.gray200}`, borderRadius:10, padding:'8px 14px', fontSize:13, fontWeight:600, color:T.gray800, cursor:'pointer' }}
                    onClick={() => setMobileFilterOpen(true)}
                  >
                    {Icon.filter(15)} Filters
                    {(applied.cats.size > 0 || applied.priceMin || applied.priceMax || applied.verifiedOnly || applied.conditions.size > 0) && (
                      <span style={{ background:T.green, color:'#fff', borderRadius:'50%', width:18, height:18, fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {applied.cats.size + (applied.verifiedOnly ? 1 : 0) + applied.conditions.size}
                      </span>
                    )}
                  </button>
                )}

                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontSize:13, color:T.gray600, whiteSpace:'nowrap' }}>Sort by:</span>
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

              {/* View toggle — Marketplace tab only (other tabs are row-list only) */}
              {activeTab === 'listings' && (
                <div style={{ display:'flex', gap:6 }}>
                  <button className={`sp-view-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')} title="Grid view">
                    {Icon.grid(15)}
                  </button>
                  <button className={`sp-view-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')} title="List view">
                    {Icon.list(15)}
                  </button>
                </div>
              )}
            </div>

            {/* ── Results ── */}
            {loading ? (
              activeTab === 'listings' ? (
                <div className="sp-results-grid grid-4" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
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
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px, 1fr))', gap:16 }}>
                {allResults.map((l, i) => (
                  <FBListingCard key={l.id} listing={l} onClick={() => navigate(resultHref('listings', l))} />
                ))}
              </div>
            ) : activeTab === 'shops' ? (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {allResults.map((s, i) => (
                  <ShopResultCard key={s.id} shop={s} delay={i * 0.04} onClick={() => navigate(resultHref('shops', s))} />
                ))}
              </div>
            ) : activeTab === 'lookingfor' ? (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {allResults.map((r, i) => (
                  <RequestResultCard key={r.id} request={r} delay={i * 0.04} onClick={() => navigate(resultHref('lookingfor', r))} />
                ))}
              </div>
            ) : activeTab === 'jobs' ? (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {allResults.map((j, i) => (
                  <JobResultCard key={j.id} job={j} delay={i * 0.04} onClick={() => navigate(resultHref('jobs', j))} />
                ))}
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                {allResults.map((s, i) => (
                  <ServiceResultCard key={s.id} service={s} delay={i * 0.04} onClick={() => navigate(resultHref('services', s))} />
                ))}
              </div>
            )}

            {/* ── Pagination ── */}
            {!loading && allResults.length > 0 && (
              <Pagination page={page} totalPages={totalPages} onChange={p => { setPage(p); window.scrollTo({ top:0, behavior:'smooth' }) }} />
            )}
          </div>
        </div>
      </div>

      {/* ── Notify Me modal ── */}
      {notifyOpen && (
        <NotifyMeModal query={queryParam} user={user} onClose={() => setNotifyOpen(false)} />
      )}

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
          </div>
        </div>
      )}
    </div>
  )
}