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
}

/* ─────────────────────────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────────────────────────── */
function formatPrice(n) {
  if (!n && n !== 0) return ''
  if (n >= 1_000_000) return `MK ${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000)     return `MK ${(n / 1_000).toFixed(0)}K`
  return `MK ${n.toLocaleString()}`
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
  {
    key: 'Electronics',
    label: 'Electronics',
    children: [
      { key: 'Phones & Tablets', label: 'Phones & Tablets', children: [
        { key: 'Phones', label: 'Phones' },
        { key: 'Tablets', label: 'Tablets' },
      ]},
      { key: 'Accessories', label: 'Accessories' },
      { key: 'Laptops', label: 'Laptops' },
      { key: 'Other Electronics', label: 'Other' },
    ],
  },
  { key: 'Vehicles',    label: 'Vehicles' },
  { key: 'Property',    label: 'Property' },
  { key: 'Clothing',    label: 'Fashion' },
  { key: 'Agriculture', label: 'Agriculture' },
  { key: 'Furniture',   label: 'Furniture' },
  { key: 'Food',        label: 'Food' },
  { key: 'Services',    label: 'Services' },
  { key: 'Jobs',        label: 'Jobs' },
  { key: 'Other',       label: 'Other' },
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
      .sp-root { font-family: ${T.font}; background: #f8f9fa; color: ${T.gray900}; min-height: 100vh; }
      .sp-root button { font-family: inherit; }
      .sp-root input  { font-family: inherit; }
      .sp-scroll::-webkit-scrollbar { display: none; }
      .sp-scroll { -ms-overflow-style: none; scrollbar-width: none; }

      @keyframes fadeUp   { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
      @keyframes shimmer  { 0% { background-position:-600px 0; } 100% { background-position:600px 0; } }
      @keyframes badgePop { 0% { transform:scale(.7); opacity:0; } 70% { transform:scale(1.1); } 100% { transform:scale(1); opacity:1; } }

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
function CategoryTree({ node, checked, onToggle, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth === 0)
  const hasChildren = node.children?.length > 0

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
        <Checkbox checked={checked.has(node.key)} onChange={() => onToggle(node.key)} label={node.label} />
      </div>
      {hasChildren && expanded && (
        <div>
          {node.children.map(child => (
            <CategoryTree key={child.key} node={child} checked={checked} onToggle={onToggle} depth={depth + 1} />
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
  delivery, onToggleDelivery,
  verifiedOnly, setVerifiedOnly,
  onApply,
}) {
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
            <CategoryTree key={node.key} node={node} checked={checkedCats} onToggle={onToggleCat} depth={0} />
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
        {['New','Used','Refurbished'].map(c => (
          <Checkbox key={c} checked={conditions.has(c)} onChange={() => onToggleCondition(c)} label={c} />
        ))}
      </div>

      <div style={{ height:1, background:T.gray100, marginBottom:18 }} />

      {/* DELIVERY */}
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:T.gray900, marginBottom:10 }}>Delivery Option</div>
        {['Delivery Available','Pickup Only'].map(d => (
          <Checkbox key={d} checked={delivery.has(d)} onChange={() => onToggleDelivery(d)} label={d} />
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

      {/* APPLY */}
      <button onClick={onApply} style={{ width:'100%', background:T.green, color:'#fff', border:'none', borderRadius:12, padding:'13px 0', fontSize:14, fontWeight:700, cursor:'pointer', boxShadow:`0 4px 16px rgba(15,157,88,0.3)`, transition:'background .15s' }}
        onMouseEnter={e => e.currentTarget.style.background = T.greenD}
        onMouseLeave={e => e.currentTarget.style.background = T.green}
      >
        Apply Filters
      </button>
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
  const isFeat  = listing.featured || listing.is_featured
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
  const isFeat  = listing.featured || listing.is_featured

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
const PAGE_SIZE = 8

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
  const [sortBy, setSortBy]             = useState('relevance')
  const [viewMode, setViewMode]         = useState('grid') // 'grid' | 'list'
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)
const [featuredSeed, setFeaturedSeed] = useState(() => Math.floor(Date.now() / 30000))

  // ── Applied (committed) filters — only change on "Apply" ──
  const [applied, setApplied] = useState({
    cats: new Set(), priceMin:'', priceMax:'', district:'All Districts',
    conditions: new Set(), delivery: new Set(), verifiedOnly: false,
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

  /* Reset to page 1 whenever the query or active tab changes */
  useEffect(() => { setPage(1) }, [queryParam, activeTab])

  /* Search whenever query, tab, filters, sort, or page change.
     Pass current values as args so doSearch never reads stale closure state. */
  useEffect(() => {
    if (!queryParam) return
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
        const { count } = await supabase.from('listings').select('id', { count:'exact', head:true }).eq('status', 'active').ilike('title', `%${q}%`)
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

  /* ── Marketplace listings (original logic, unchanged) ── */
  async function searchListings(filters, currentSort, currentPage) {
    const baseSelect = 'id, title, price, images, city, category, condition, featured, is_featured, created_at, seller_id, shop_id, description'

    let query = supabase
      .from('listings')
      .select(baseSelect, { count: 'exact' })
      .eq('status', 'active')
      .ilike('title', `%${queryParam}%`)

    if (filters.cats.size > 0) query = query.in('category', [...filters.cats])
    if (filters.priceMin)      query = query.gte('price', Number(filters.priceMin))
    if (filters.priceMax)      query = query.lte('price', Number(filters.priceMax))
    if (filters.district && filters.district !== 'All Districts')
      query = query.ilike('city', `%${filters.district}%`)
    if (filters.conditions.size > 0) query = query.in('condition', [...filters.conditions])

    // Fetch ALL matching listings (no pagination yet) so we can pin featured first
    query = query.order('created_at', { ascending: false }).limit(200)

    const { data: allData, count, error } = await query
    if (error) throw error

    let rows = allData || []

    // Split into featured vs regular
    const featured = rows.filter(l => l.featured === true || l.is_featured === true)
    const regular  = rows.filter(l => l.featured !== true && l.is_featured !== true)

    // Rotate featured order every 30s
    const seed = Math.floor(Date.now() / 30000)
    const hashId = (id) => {
      let h = seed * 2654435761
      for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 2246822519)
      return h >>> 0
    }
    const sortedFeatured = [...featured].sort((a, b) => hashId(a.id) - hashId(b.id))

    // Sort regular by user's chosen sort
    let sortedRegular = [...regular]
    switch (currentSort) {
      case 'price_asc':  sortedRegular.sort((a, b) => (a.price || 0) - (b.price || 0)); break
      case 'price_desc': sortedRegular.sort((a, b) => (b.price || 0) - (a.price || 0)); break
      default:           sortedRegular.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    }

    // Merge: featured always first
    const merged = [...sortedFeatured, ...sortedRegular]

    // Paginate client-side
    const from = (currentPage - 1) * PAGE_SIZE
    let results = merged.slice(from, from + PAGE_SIZE)

    // Enrich with verified flags
    const shopIds   = [...new Set(results.map(l => l.shop_id).filter(Boolean))]
    const sellerIds = [...new Set(results.map(l => l.seller_id).filter(Boolean))]

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

    results = results.map(l => ({
      ...l,
      shop_is_verified: l.shop_id   ? (shopMap[l.shop_id]?.is_verified    ?? false) : false,
      seller_verified:  l.seller_id ? (profileMap[l.seller_id]?.is_verified ?? false) : false,
    }))

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

  function toggleDelivery(key) {
    setDelivery(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  // Reset pending UI state AND commit empty filters so the search re-runs
  const EMPTY_FILTERS = {
    cats: new Set(), priceMin: '', priceMax: '', district: 'All Districts',
    conditions: new Set(), delivery: new Set(), verifiedOnly: false,
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
    setPage(1)
    // Commit clean filters to state
    setApplied(EMPTY_FILTERS)
    // Bump tick so the useEffect always re-fires even if applied was already empty
    setSearchTick(t => t + 1)
    // Also call doSearch directly so results clear immediately without
    // waiting for the React state flush
    doSearch(activeTab, EMPTY_FILTERS, sortBy, 1)
  }

  function applyFilters() {
    const next = {
      cats: new Set(checkedCats),
      priceMin, priceMax, district,
      conditions: new Set(conditions),
      delivery: new Set(delivery),
      verifiedOnly,
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

  const filterProps = {
    checkedCats, onToggleCat: toggleCat, onClearAll: clearAll,
    priceMin, setPriceMin, priceMax, setPriceMax,
    district, setDistrict,
    conditions, onToggleCondition: toggleCondition,
    delivery, onToggleDelivery: toggleDelivery,
    verifiedOnly, setVerifiedOnly,
    onApply: applyFilters,
  }

  const resultsLabel = {
    listings: 'listings', shops: 'shops', lookingfor: 'requests', jobs: 'jobs', services: 'services',
  }[activeTab]

  return (
    <div className="sp-root">
      <GlobalStyles />

      <SearchNav user={user} notifCount={notifCount} search={search} setSearch={setSearch} navigate={navigate} />

      <div style={{ maxWidth:1400, margin:'0 auto', padding:'0 20px' }}>

        {/* ── Search summary bar ── */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 0 0', flexWrap:'wrap', gap:8 }}>
          <div style={{ fontSize:17, fontWeight:700, color:T.gray900 }}>
            Search results for <span style={{ color:T.green }}>"{queryParam}"</span>
          </div>
          <div style={{ fontSize:14, color:T.gray600, fontWeight:500 }}>
            {loading ? 'Searching…' : `${totalCount.toLocaleString()} ${resultsLabel} found`}
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

          {/* ── FILTER SIDEBAR (desktop) — Marketplace tab only ── */}
          {showFilterSidebar && (
            <div className="sp-sidebar" style={{ background:'#fff', borderRadius:16, border:`1px solid ${T.gray200}`, padding:'18px 16px', boxShadow:T.shadow, position:'sticky', top:140 }}>
              <FilterPanel {...filterProps} />
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
              viewMode === 'grid' ? (
                <div className="sp-results-grid grid-4" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
                  {allResults.map((l, i) => (
                    <ResultCardGrid key={l.id} listing={l} delay={i * 0.04} onClick={() => navigate(resultHref('listings', l))} />
                  ))}
                </div>
              ) : (
                <div className="sp-results-grid list-mode" style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {allResults.map((l, i) => (
                    <ResultCardList key={l.id} listing={l} delay={i * 0.04} onClick={() => navigate(resultHref('listings', l))} />
                  ))}
                </div>
              )
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