import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import SokoNav from '../components/SokoNav'

/* Soko marketplace tokens — match Home / Search */
const T = {
  green: '#0F9D58',
  greenDark: '#0a7a44',
  greenLight: '#e8f5ee',
  gold: '#F9AB00',
  white: '#ffffff',
  offwhite: '#f8f9fa',
  text: '#202124',
  textMuted: '#5f6368',
  textLight: '#9aa0a6',
  border: '#e8eaed',
  gray100: '#f1f3f4',
  gray200: '#e8eaed',
  gray900: '#202124',
  shadow: '0 1px 3px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.04)',
}

const CAT_ICONS = {
  all: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  'Fashion & Clothing': <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.38 3.46 16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.57a1 1 0 0 0 .99.84H6v10c0 1.1.9 2 2 2h8a2 2 0 0 0 2-2V10h2.15a1 1 0 0 0 .99-.84l.58-3.57a2 2 0 0 0-1.34-2.23z"/></svg>,
  'Phones & Accessories': <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>,
  Vehicles: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/></svg>,
  'Home & Furniture': <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  Electronics: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  'Beauty & Cosmetics': <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  Agriculture: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22V12"/><path d="M5 3v4c0 2.8 2.2 5 5 5h4c2.8 0 5-2.2 5-5V3"/><path d="M3 3h18"/></svg>,
  Other: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
}

const CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'Fashion & Clothing', label: 'Fashion & Clothing' },
  { id: 'Phones & Accessories', label: 'Phones & Tablets' },
  { id: 'Vehicles', label: 'Vehicles' },
  { id: 'Home & Furniture', label: 'Home & Furniture' },
  { id: 'Electronics', label: 'Electronics' },
  { id: 'Beauty & Cosmetics', label: 'Beauty & Health' },
  { id: 'Agriculture', label: 'Agriculture' },
  { id: 'Other', label: 'Other' },
]

const DISTRICTS = [
  'All Districts', 'Blantyre', 'Lilongwe', 'Mzuzu', 'Zomba',
  'Mangochi', 'Kasungu', 'Ntcheu', 'Salima', 'Karonga',
]

const SORT_OPTIONS = [
  { id: 'followers', label: 'Most Followers' },
  { id: 'newest', label: 'Newest First' },
  { id: 'rating', label: 'Top Rated' },
  { id: 'listings', label: 'Most Listings' },
]

const SHOP_TYPES = [
  { id: 'all', label: 'All Shops' },
  { id: 'verified', label: 'Verified Shops' },
  { id: 'new', label: 'New Shops' },
]

const PAGE_SIZE = 12

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }

  .sps-root {
    font-family: 'Inter', system-ui, sans-serif;
    background: ${T.offwhite};
    min-height: 100vh; min-height: 100dvh;
    color: ${T.text};
    overflow-x: clip;
    -webkit-tap-highlight-color: transparent;
  }
  @media (max-width: 900px) {
    .sps-root { padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px)); }
  }
  @media (hover: none) {
    .sps-shop-card:hover { transform: none; box-shadow: ${T.shadow}; }
    .sps-list-card:hover { box-shadow: ${T.shadow}; }
  }

  /* PAGE TITLE ROW */
  .sps-title-row {
    max-width: 1400px; margin: 0 auto; padding: 22px 20px 14px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
  }
  .sps-title-row h1 {
    font-family: 'Sora', Inter, sans-serif;
    font-size: clamp(20px, 3vw, 28px); font-weight: 800; color: ${T.text};
    margin: 0 0 4px; letter-spacing: -0.5px;
  }
  .sps-title-row p { font-size: 13.5px; color: ${T.textMuted}; margin: 0; }
  .sps-open-shop-btn {
    display: inline-flex; align-items: center; gap: 7px;
    background: ${T.gray900}; border: none; color: #fff;
    border-radius: 12px; padding: 11px 18px; font-size: 13.5px; font-weight: 700;
    font-family: inherit; cursor: pointer; white-space: nowrap; transition: all 0.15s;
    min-height: 44px; flex-shrink: 0;
  }
  .sps-open-shop-btn:hover { background: #000; }
  .sps-open-shop-label { display: inline; }

  /* FILTER BAR */
  .sps-filter-bar {
    max-width: 1400px; margin: 0 auto; padding: 0 20px 16px;
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
  }
  .sps-filter-search-wrap { flex: 1; min-width: 200px; max-width: 360px; position: relative; }
  .sps-filter-search-wrap input {
    width: 100%; height: 44px; border-radius: 12px;
    border: 1.5px solid ${T.border}; background: ${T.white};
    padding: 0 40px 0 14px; font-size: 16px; font-family: inherit; outline: none;
    box-shadow: 0 1px 2px rgba(0,0,0,.03);
  }
  .sps-filter-search-wrap input:focus { border-color: ${T.green}; box-shadow: 0 0 0 3px rgba(15,157,88,.1); }
  .sps-filter-search-icon { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: ${T.textLight}; pointer-events: none; }
  .sps-filter-select {
    height: 44px; border: 1.5px solid ${T.border}; border-radius: 12px;
    padding: 0 32px 0 12px; font-size: 13px; font-weight: 600; font-family: inherit;
    background: ${T.white}; color: ${T.text}; cursor: pointer; outline: none;
    appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%235f6368' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
    box-shadow: 0 1px 2px rgba(0,0,0,.03);
  }
  .sps-filter-select:focus { border-color: ${T.green}; }
  .sps-desktop-selects { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .sps-mobile-filter-btn {
    display: none; align-items: center; justify-content: center; gap: 6px;
    height: 44px; padding: 0 14px; border-radius: 12px;
    border: 1.5px solid ${T.border}; background: ${T.white};
    font-size: 13px; font-weight: 700; font-family: inherit; color: ${T.text};
    cursor: pointer; flex-shrink: 0; min-width: 44px;
    box-shadow: 0 1px 2px rgba(0,0,0,.03);
    touch-action: manipulation;
  }
  .sps-mobile-filter-btn .sps-filter-badge {
    background: ${T.gray900}; color: #fff; border-radius: 999px;
    font-size: 10px; font-weight: 800; min-width: 18px; height: 18px;
    display: inline-flex; align-items: center; justify-content: center; padding: 0 5px;
  }

  /* Mobile horizontal chips (categories) */
  .sps-chips {
    display: none;
    max-width: 1400px; margin: 0 auto;
    padding: 0 0 12px;
  }
  .sps-chips-scroll {
    display: flex; gap: 8px; overflow-x: auto;
    padding: 0 14px 2px;
    scrollbar-width: none; -ms-overflow-style: none;
    -webkit-overflow-scrolling: touch;
    overscroll-behavior-x: contain;
  }
  .sps-chips-scroll::-webkit-scrollbar { display: none; }
  .sps-chip {
    flex-shrink: 0; display: inline-flex; align-items: center; gap: 6px;
    height: 40px; padding: 0 14px; border-radius: 999px;
    border: 1.5px solid ${T.border}; background: ${T.white};
    font-size: 12.5px; font-weight: 700; font-family: inherit; color: ${T.textMuted};
    cursor: pointer; white-space: nowrap;
    touch-action: manipulation;
  }
  .sps-chip.active {
    background: ${T.gray900}; border-color: ${T.gray900}; color: #fff;
  }
  .sps-chip svg { width: 14px; height: 14px; flex-shrink: 0; }

  /* BODY LAYOUT */
  .sps-body {
    max-width: 1400px; margin: 0 auto; padding: 0 20px 48px;
    display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 24px;
    align-items: start;
  }

  /* Mobile filter drawer */
  .sps-drawer {
    display: none; position: fixed; inset: 0; z-index: 300;
  }
  .sps-drawer.open { display: flex; flex-direction: column; justify-content: flex-end; }
  .sps-drawer-overlay {
    position: absolute; inset: 0; background: rgba(10,15,20,.5); backdrop-filter: blur(3px);
  }
  .sps-drawer-panel {
    position: relative; z-index: 1;
    background: ${T.white};
    border-radius: 20px 20px 0 0;
    max-height: min(88dvh, 100%);
    overflow-y: auto;
    padding: 12px 16px calc(20px + env(safe-area-inset-bottom, 0px));
    box-shadow: 0 -8px 32px rgba(0,0,0,.18);
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
    animation: spsSlideUp .28s cubic-bezier(.22,1,.36,1);
  }
  @keyframes spsSlideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }
  .sps-drawer-handle {
    width: 40px; height: 4px; border-radius: 99px; background: ${T.border};
    margin: 4px auto 14px;
  }
  .sps-drawer-head {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 14px;
    position: sticky; top: 0; z-index: 2;
    background: ${T.white}; padding-bottom: 4px;
  }
  .sps-drawer-head h3 {
    font-family: 'Sora', Inter, sans-serif;
    font-size: 17px; font-weight: 800; margin: 0;
  }
  .sps-drawer-close {
    width: 44px; height: 44px; border-radius: 12px; border: 1px solid ${T.border};
    background: ${T.gray100}; display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: ${T.text}; touch-action: manipulation;
  }
  .sps-drawer .sps-filter-item {
    min-height: 44px; padding: 10px 12px; font-size: 14px;
    touch-action: manipulation;
  }
  .sps-drawer .sps-section-title {
    margin: 18px 0 8px; font-size: 12px; text-transform: uppercase;
    letter-spacing: 0.04em; color: ${T.textMuted};
  }
  .sps-drawer-actions {
    display: flex; gap: 10px; margin-top: 18px; position: sticky; bottom: 0;
    padding: 12px 0 4px; background: linear-gradient(to top, #fff 75%, rgba(255,255,255,0));
    z-index: 2;
  }
  .sps-drawer-actions button {
    flex: 1; min-height: 48px; border-radius: 12px; font-size: 14px; font-weight: 800;
    font-family: inherit; cursor: pointer; border: none; touch-action: manipulation;
  }
  .sps-drawer-clear {
    background: ${T.white}; border: 1.5px solid ${T.border} !important; color: ${T.text};
  }
  .sps-drawer-apply {
    background: ${T.gray900}; color: #fff;
  }

  @media (max-width: 900px) {
    .sps-body { grid-template-columns: 1fr; padding: 0 12px 40px; gap: 10px; }
    .sps-sidebar { display: none !important; }
    .sps-filter-bar {
      padding: 0 12px 10px;
      flex-wrap: nowrap;
      gap: 8px;
    }
    .sps-filter-search-wrap {
      flex: 1; min-width: 0; max-width: none;
    }
    .sps-filter-search-wrap input {
      font-size: 16px; /* prevents iOS zoom on focus */
    }
    .sps-desktop-selects { display: none !important; }
    .sps-mobile-filter-btn { display: inline-flex !important; }
    .sps-chips { display: block; }
    .sps-title-row {
      padding: 12px 12px 8px;
      align-items: center;
      gap: 10px;
    }
    .sps-title-row h1 { font-size: 20px; margin: 0; line-height: 1.2; }
    .sps-title-row p { display: none; }
    .sps-open-shop-btn {
      width: auto; padding: 0 14px; min-height: 40px; height: 40px;
      border-radius: 11px; font-size: 12.5px;
      touch-action: manipulation;
    }
    .sps-open-shop-label { display: none; }
    .sps-open-shop-short { display: inline !important; }
    .sps-view-btn {
      width: 40px; height: 40px; min-width: 40px; border-radius: 10px;
      touch-action: manipulation;
    }
    .sps-follow-btn { touch-action: manipulation; }
  }
  .sps-open-shop-short { display: none; }

  /* SIDEBAR */
  .sps-sidebar {
    flex-shrink: 0;
    position: sticky;
    top: 90px;
    max-height: calc(100vh - 110px);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: ${T.border} transparent;
    scroll-behavior: smooth;
    align-self: start;
  }
  .sps-sidebar::-webkit-scrollbar { width: 3px; }
  .sps-sidebar::-webkit-scrollbar-track { background: transparent; }
  .sps-sidebar::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 10px; }
  .sps-sidebar::-webkit-scrollbar-thumb:hover { background: ${T.textLight}; }
  .sps-sidebar-card {
    background: ${T.white}; border: 1px solid ${T.border};
    border-radius: 0 0 16px 16px;
    padding: 10px 14px 16px; margin-bottom: 14px;
    box-shadow: ${T.shadow};
  }
  .sps-sidebar-head {
    display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;
  }
  .sps-sidebar-head-sticky {
    position: sticky; top: 0; z-index: 5;
    background: ${T.white}; border: 1px solid ${T.border}; border-bottom: none;
    border-radius: 16px 16px 0 0;
    padding: 16px 14px 12px;
    margin-bottom: 0;
    box-shadow: ${T.shadow};
  }
  .sps-sidebar-head h3 {
    font-family: 'Sora', Inter, sans-serif;
    font-size: 14px; font-weight: 800; color: ${T.text}; margin: 0;
  }
  .sps-clear-btn { font-size: 12px; font-weight: 700; color: ${T.textMuted}; background: none; border: none; cursor: pointer; font-family: inherit; }
  .sps-clear-btn:hover { color: ${T.green}; }
  .sps-section-title {
    font-size: 12.5px; font-weight: 800; color: ${T.text}; margin: 16px 0 10px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .sps-section-title button { background: none; border: none; color: ${T.textMuted}; cursor: pointer; font-size: 11px; }
  .sps-filter-item {
    display: flex; align-items: center; gap: 9px;
    padding: 7px 10px; border-radius: 9px; cursor: pointer;
    font-size: 13px; color: ${T.textMuted}; font-weight: 500;
    transition: all 0.12s;
  }
  .sps-filter-item:hover { background: ${T.offwhite}; }
  .sps-filter-item.active { background: ${T.gray100}; color: ${T.gray900}; font-weight: 700; }
  .sps-filter-item .fi-icon { font-size: 15px; width: 20px; text-align: center; }
  .sps-filter-item .fi-dot { width: 8px; height: 8px; border-radius: 50%; background: ${T.green}; margin-left: auto; flex-shrink: 0; }
  .sps-show-more { font-size: 12px; font-weight: 700; color: ${T.green}; background: none; border: none; cursor: pointer; margin-top: 4px; display: flex; align-items: center; gap: 4px; }

  .sps-promo-card {
    background: linear-gradient(165deg, #0f172a 0%, #1e293b 100%);
    border: 1px solid rgba(255,255,255,.08); border-radius: 16px;
    padding: 20px 16px; text-align: center; margin-top: 12px;
    color: #fff;
  }
  .sps-promo-icon { margin-bottom: 10px; color: ${T.gold}; display: flex; justify-content: center; }
  .sps-promo-card h4 { font-size: 14px; font-weight: 800; color: #fff; margin: 0 0 6px; }
  .sps-promo-card p { font-size: 12px; color: rgba(255,255,255,.65); margin: 0 0 14px; line-height: 1.5; }
  .sps-promo-btn {
    width: 100%; background: ${T.gold}; color: ${T.gray900}; border: none; border-radius: 11px;
    padding: 11px; font-size: 13px; font-weight: 800; font-family: inherit; cursor: pointer;
  }
  .sps-promo-btn:hover { filter: brightness(1.05); }

  /* MAIN CONTENT */
  .sps-main { min-width: 0; }
  .sps-results-row {
    display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px;
    margin-top: 4px;
  }
  .sps-results-count { font-size: 13.5px; color: ${T.textMuted}; font-weight: 500; }
  .sps-results-count strong { color: ${T.text}; }
  .sps-view-toggle { display: flex; gap: 4px; }
  .sps-view-btn {
    width: 32px; height: 32px; border-radius: 8px; border: 1px solid ${T.border};
    background: ${T.white}; display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: ${T.textMuted};
  }
  .sps-view-btn.active { background: ${T.gray900}; border-color: ${T.gray900}; color: #fff; }

  /* SHOP GRID */
  .sps-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
  @media (max-width: 1100px) { .sps-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; } }
  @media (max-width: 900px) {
    .sps-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  }

  /* SHOP LIST VIEW */
  .sps-list { display: flex; flex-direction: column; gap: 12px; }
  .sps-list-card {
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 14px;
    overflow: visible; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
    display: flex; align-items: center; gap: 14px; padding: 12px 14px;
    box-shadow: ${T.shadow};
  }
  .sps-list-card:hover { box-shadow: 0 8px 24px rgba(0,0,0,0.08); }
  .sps-list-logo {
    width: 56px; height: 56px; border-radius: 50%; flex-shrink: 0;
    background: #111; display: flex; align-items: center; justify-content: center;
    overflow: hidden; color: ${T.white}; font-size: 15px; font-weight: 900;
  }
  .sps-list-logo img { width: 100%; height: 100%; object-fit: cover; }
  .sps-list-info { flex: 1; min-width: 0; }
  .sps-list-name-row { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
  .sps-list-name {
    font-size: 14.5px; font-weight: 800; color: ${T.text};
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .sps-list-meta {
    font-size: 12px; color: ${T.textMuted}; display: flex; align-items: center; gap: 5px; flex-wrap: wrap;
  }
  .sps-list-actions { flex-shrink: 0; }
  .sps-list-actions .sps-follow-btn { width: 120px; min-height: 40px; }
  @media (max-width: 600px) {
    .sps-list-card { gap: 10px; padding: 10px 12px; }
    .sps-list-logo { width: 48px; height: 48px; }
    .sps-list-actions { width: auto; }
    .sps-list-actions .sps-follow-btn {
      width: auto; min-width: 88px; padding: 8px 12px; font-size: 12px;
    }
    .sps-list-meta .sps-meta-extra { display: none; }
  }

  .sps-shop-card {
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 16px;
    overflow: visible; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s;
    box-shadow: ${T.shadow};
  }
  .sps-shop-card:hover { transform: translateY(-3px); box-shadow: 0 12px 28px rgba(0,0,0,0.1); }

  .sps-card-cover {
    position: relative; height: 140px; background: linear-gradient(135deg, #1e293b 0%, #334155 55%, ${T.gold}44 100%);
    overflow: visible; border-radius: 16px 16px 0 0;
  }
  .sps-card-cover img {
    width: 100%; height: 100%; object-fit: cover;
    border-radius: 0;
    display: block;
    overflow: hidden;
  }
  .sps-card-logo {
    position: absolute; bottom: -24px; left: 14px;
    width: 58px; height: 58px; border-radius: 50%;
    background: #111; border: 3px solid ${T.white};
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; font-weight: 900; color: ${T.white};
    overflow: hidden; flex-shrink: 0; letter-spacing: -0.5px;
    z-index: 2;
  }
  .sps-card-logo img { width: 100%; height: 100%; object-fit: cover; border-radius: 50%; }

  .sps-card-body { padding: 32px 14px 14px; }
  .sps-card-name-row { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; min-width: 0; }
  .sps-card-name {
    font-size: 14.5px; font-weight: 800; color: ${T.text};
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
  }
  .sps-card-category { font-size: 12px; color: ${T.textMuted}; font-weight: 500; margin-bottom: 6px; }
  .sps-card-location { font-size: 12px; color: ${T.textMuted}; display: flex; align-items: center; gap: 4px; margin-bottom: 8px; }
  .sps-card-stats { font-size: 12px; color: ${T.textMuted}; display: flex; align-items: center; gap: 6px; margin-bottom: 12px; flex-wrap: wrap; }
  .sps-card-stats .star { color: ${T.gold}; }
  .sps-card-stats .dot { color: ${T.border}; }
  @media (max-width: 600px) {
    .sps-grid { gap: 8px; }
    .sps-shop-card { border-radius: 14px; }
    .sps-card-cover { height: 92px; border-radius: 14px 14px 0 0; }
    .sps-card-logo { width: 42px; height: 42px; bottom: -16px; left: 10px; border-width: 2.5px; }
    .sps-card-body { padding: 22px 10px 10px; }
    .sps-card-name { font-size: 12.5px; }
    .sps-card-category { font-size: 11px; margin-bottom: 4px; }
    .sps-card-location { font-size: 11px; margin-bottom: 6px; }
    .sps-card-stats { font-size: 11px; margin-bottom: 8px; gap: 4px; }
    .sps-follow-btn { padding: 8px; font-size: 12px; min-height: 38px; border-radius: 10px; }
  }
  @media (max-width: 380px) {
    .sps-grid { grid-template-columns: 1fr 1fr; gap: 8px; }
    .sps-card-cover { height: 84px; }
    .sps-card-name { font-size: 12px; }
  }

  .sps-follow-btn {
    width: 100%; border: 1.5px solid ${T.border}; color: ${T.gray900};
    background: ${T.white}; border-radius: 12px; padding: 10px;
    font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer;
    transition: all 0.15s; min-height: 40px;
  }
  .sps-follow-btn:hover { border-color: ${T.gray900}; background: ${T.gray100}; }
  .sps-follow-btn.following { background: ${T.gray900}; color: ${T.white}; border-color: ${T.gray900}; }
  .sps-follow-btn.following:hover { background: #000; }

  /* PAGINATION */
  .sps-pagination {
    display: flex; align-items: center; justify-content: center;
    gap: 6px; margin-top: 36px;
  }
  .sps-page-btn {
    width: 36px; height: 36px; border-radius: 9px; border: 1px solid ${T.border};
    background: ${T.white}; font-size: 13px; font-weight: 600; color: ${T.textMuted};
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    font-family: inherit; transition: all 0.12s;
  }
  .sps-page-btn:hover { border-color: ${T.green}; color: ${T.green}; }
  .sps-page-btn.active { background: ${T.green}; color: ${T.white}; border-color: ${T.green}; }
  .sps-page-btn:disabled { opacity: 0.4; cursor: not-allowed; }
  .sps-page-ellipsis { font-size: 13px; color: ${T.textMuted}; padding: 0 4px; }

  .sps-loading { display: flex; align-items: center; justify-content: center; height: 40vh; color: ${T.textMuted}; }
  .sps-empty {
    text-align: center; padding: 48px 20px; color: ${T.textMuted};
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 16px;
  }
  .sps-empty h3 { font-size: 16px; font-weight: 700; color: ${T.text}; margin: 0 0 8px; }
  .sps-results-row {
    display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;
  }
  @media (max-width: 900px) {
    .sps-results-row { margin-bottom: 10px; }
    .sps-results-count { font-size: 12.5px !important; }
  }
`

const Icon = {
  Search: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Grid: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  List: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3" y2="6"/><line x1="3" y1="12" x2="3" y2="12"/><line x1="3" y1="18" x2="3" y2="18"/></svg>,
  Pin: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 6-9 13-9 13s-9-7-9-13a9 9 0 1 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>,
  Star: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>,
  Msg: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Bell: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  Categories: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  ShopsIcon: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9 12 3l9 6"/><path d="M4 9v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9"/><path d="M9 21V14h6v7"/></svg>,
  Plus: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  ChevronLeft: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>,
  ChevronRight: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  ChevronDown: () => <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>,
  Filter: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z"/></svg>,
  X: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  Check: () => <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#16a34a" d="M12 0a4 4 0 0 1 3.2 1.6 4 4 0 0 1 3.6 1 4 4 0 0 1 1 3.6A4 4 0 0 1 21.4 9.4a4 4 0 0 1 0 5.2A4 4 0 0 1 19.8 17.8a4 4 0 0 1-1 3.6 4 4 0 0 1-3.6 1A4 4 0 0 1 12 24a4 4 0 0 1-3.2-1.6 4 4 0 0 1-3.6-1 4 4 0 0 1-1-3.6A4 4 0 0 1 2.6 14.6a4 4 0 0 1 0-5.2A4 4 0 0 1 4.2 6.2a4 4 0 0 1 1-3.6 4 4 0 0 1 3.6-1A4 4 0 0 1 12 0Z"/><path d="m7.5 12.5 3 3 6-7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
}

function initials(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

export default function ShopsPage() {
  const navigate = useNavigate()
  const sidebarRef = useRef(null)
  const [sidebarAtBottom, setSidebarAtBottom] = useState(false)
  const [shops, setShops] = useState([])
  const [categoryCounts, setCategoryCounts] = useState({})
  const [showMoreCategories, setShowMoreCategories] = useState(false)
  const [districtCounts, setDistrictCounts] = useState({})
  const [totalCount, setTotalCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [user, setUser] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [followingMap, setFollowingMap] = useState({})
  const [notifCount, setNotifCount] = useState(0)
  const [viewMode, setViewMode] = useState('grid')
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const sentinelRef = useRef(null)
  const [showMoreDistricts, setShowMoreDistricts] = useState(false)
  const [blockedShops, setBlockedShops] = useState([])
  const [blockedShopDetails, setBlockedShopDetails] = useState([])
  const [showBlocked, setShowBlocked] = useState(false)
  const [navSearch, setNavSearch] = useState('')
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false)

  // Filters
  const [searchQ, setSearchQ] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [filterDistrict, setFilterDistrict] = useState('All Districts')
  const [sortBy, setSortBy] = useState('followers')
  const [shopType, setShopType] = useState('all')

  const activeFilterCount = [
    filterCat !== 'all',
    filterDistrict !== 'All Districts',
    shopType !== 'all',
    sortBy !== 'followers',
  ].filter(Boolean).length

  // Lock body scroll + Escape to close mobile filter drawer
  useEffect(() => {
    if (!mobileFilterOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') setMobileFilterOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [mobileFilterOpen])

  const categoriesWithShops = CATEGORIES.filter(
    c => c.id === 'all' || categoryCounts[c.id] > 0
  )
  const visibleCategories = showMoreCategories
    ? categoriesWithShops
    : categoriesWithShops.slice(0, 5)

  const districtsWithShops = DISTRICTS.filter(
    d => d === 'All Districts' || districtCounts[d] > 0
  )
  const visibleDistricts = showMoreDistricts
    ? districtsWithShops
    : districtsWithShops.slice(0, 5)

  useEffect(() => {
    async function loadBlockedShops() {
      const ids = JSON.parse(localStorage.getItem('soko_blocked_shops') || '[]')
      setBlockedShops(ids)
      if (ids.length === 0) return
      const { data } = await supabase
        .from('shops')
        .select('id, name, slug, logo_url, category')
        .in('id', ids)
      setBlockedShopDetails(data || [])
    }
    loadBlockedShops()
  }, [])

  useEffect(() => {
    async function fetchCategoryCounts() {
      const { data, error } = await supabase
        .from('shops')
        .select('category, district')
        .eq('is_active', true)
      if (error) { console.error('category counts error:', error); return }
      const catCounts = {}
      const distCounts = {}
      data?.forEach(row => {
        if (row.category) catCounts[row.category] = (catCounts[row.category] || 0) + 1
        if (row.district) distCounts[row.district] = (distCounts[row.district] || 0) + 1
      })
      setCategoryCounts(catCounts)
      setDistrictCounts(distCounts)
    }
    fetchCategoryCounts()
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (authUser) {
        setCurrentUserId(authUser.id)
        const [{ data: profile }, { data: shop }] = await Promise.all([
          supabase.from('profiles').select('full_name, avatar_url, account_type').eq('id', authUser.id).maybeSingle(),
          supabase.from('shops').select('slug').eq('owner_id', authUser.id).maybeSingle(),
        ])
        setUser({
          ...authUser,
          avatar_url: profile?.avatar_url || null,
          full_name: profile?.full_name || null,
          shop_slug: shop?.slug || null,
          account_type: profile?.account_type,
        })

        const { data: follows } = await supabase.from('shop_followers').select('shop_id').eq('user_id', authUser.id)
        const map = {}
        follows?.forEach(f => { map[f.shop_id] = true })
        setFollowingMap(map)

        loadNotifCount(authUser.id)
      }
    }
    init()
  }, [])

  async function loadNotifCount(uid) {
    const { count } = await supabase.from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', uid).eq('read', false)
    setNotifCount(count || 0)
  }

  useEffect(() => {
    setPage(1)
    setShops([])
    setHasMore(true)
    fetchShops(1, true)
  }, [searchQ, filterCat, filterDistrict, sortBy, shopType])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const observer = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loadingMore && !loading) {
        setPage(p => {
          const next = p + 1
          fetchShops(next, false)
          return next
        })
      }
    }, { rootMargin: '400px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, loading])

  useEffect(() => {
    const el = sidebarRef.current
    if (!el) return
    function checkBottom() {
      const isScrollable = el.scrollHeight > el.clientHeight + 8
      const atBottom = !isScrollable || (el.scrollTop + el.clientHeight >= el.scrollHeight - 8)
      setSidebarAtBottom(atBottom)
    }
    checkBottom()
    el.addEventListener('scroll', checkBottom)
    window.addEventListener('resize', checkBottom)
    return () => {
      el.removeEventListener('scroll', checkBottom)
      window.removeEventListener('resize', checkBottom)
    }
  }, [])

  async function fetchShops(pageToLoad, isFresh) {
    if (isFresh) setLoading(true)
    else setLoadingMore(true)
    try {
      let query = supabase.from('shops').select('*', { count: 'exact' }).eq('is_active', true)

      if (searchQ.trim()) {
        query = query.or(`name.ilike.%${searchQ}%,description.ilike.%${searchQ}%,category.ilike.%${searchQ}%`)
      }
      if (filterCat !== 'all') query = query.eq('category', filterCat)
      if (filterDistrict !== 'All Districts') query = query.eq('district', filterDistrict)
      if (shopType === 'verified') query = query.eq('is_verified', true)
      if (shopType === 'new') {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        query = query.gte('created_at', weekAgo)
      }

      if (sortBy === 'followers') query = query.order('follower_count', { ascending: false })
      else if (sortBy === 'newest') query = query.order('created_at', { ascending: false })
      else if (sortBy === 'rating') query = query.order('rating', { ascending: false })
      else if (sortBy === 'listings') query = query.order('listing_count', { ascending: false })

      query = query.range((pageToLoad - 1) * PAGE_SIZE, pageToLoad * PAGE_SIZE - 1)

      const { data, count, error } = await query
      if (error) throw error

      const blocked = new Set(
        JSON.parse(localStorage.getItem('soko_blocked_shops') || '[]').map(String)
      )
      const clean = (data || []).filter(s => !blocked.has(String(s.id)))
      setShops(prev => isFresh ? clean : [...prev, ...clean])
      setTotalCount(count || 0)
      setHasMore((data || []).length === PAGE_SIZE)
    } catch (err) {
      console.error('fetchShops error:', err)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  async function handleFollow(e, shop) {
    e.stopPropagation()
    if (!currentUserId) { navigate('/login'); return }
    const already = followingMap[shop.id]
    if (already) {
      await supabase.from('shop_followers').delete().eq('shop_id', shop.id).eq('user_id', currentUserId)
      setFollowingMap(m => { const n = { ...m }; delete n[shop.id]; return n })
    } else {
      await supabase.from('shop_followers').insert({ shop_id: shop.id, user_id: currentUserId })
      setFollowingMap(m => ({ ...m, [shop.id]: true }))
    }
  }

  function clearFilters() {
    setFilterCat('all')
    setFilterDistrict('All Districts')
    setShopType('all')
    setSearchQ('')
    setPage(1)
  }

  function handleSearch(q) {
    setSearchQ(q)
    setPage(1)
  }

  function handleFilterCat(cat) {
    setFilterCat(cat)
  }

  function handleFilterDistrict(d) {
    setFilterDistrict(d)
  }

  function handleShopType(t) {
    setShopType(t)
    setPage(1)
  }

  return (
    <div className="sps-root">
      <style>{css}</style>

      <SokoNav
        user={user}
        notifCount={notifCount}
        search={navSearch}
        setSearch={setNavSearch}
        navigate={navigate}
        activeDistrict={filterDistrict}
        onDistrictChange={(d) => {
          setFilterDistrict(d)
          setPage(1)
        }}
        activePillar="shops"
        ctaLabel="Open Shop"
        onCta={() => navigate('/shop-setup')}
      />

      {/* PAGE TITLE */}
      <div className="sps-title-row">
        <div style={{ minWidth: 0 }}>
          <h1>Shops</h1>
          <p>Discover trusted shops and verified businesses across Malawi.</p>
        </div>
        <button type="button" className="sps-open-shop-btn" onClick={() => navigate('/shop-setup')}>
          <Icon.Plus />
          <span className="sps-open-shop-label">Open Your Shop</span>
          <span className="sps-open-shop-short">Open</span>
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="sps-filter-bar">
        <div className="sps-filter-search-wrap">
          <input
            placeholder="Search shops…"
            value={searchQ}
            onChange={e => handleSearch(e.target.value)}
            enterKeyHint="search"
            autoComplete="off"
          />
          <span className="sps-filter-search-icon"><Icon.Search /></span>
        </div>
        <div className="sps-desktop-selects">
          <select className="sps-filter-select" value={filterCat} onChange={e => { setFilterCat(e.target.value); setPage(1) }}>
            {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.id === 'all' ? 'All Categories' : c.label}</option>)}
          </select>
          <select className="sps-filter-select" value={filterDistrict} onChange={e => { setFilterDistrict(e.target.value); setPage(1) }}>
            {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          <select className="sps-filter-select" value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1) }}>
            {SORT_OPTIONS.map(s => <option key={s.id} value={s.id}>Sort by: {s.label}</option>)}
          </select>
        </div>
        <button
          type="button"
          className="sps-mobile-filter-btn"
          onClick={() => setMobileFilterOpen(true)}
          aria-label="Open filters"
        >
          <Icon.Filter />
          Filters
          {activeFilterCount > 0 && (
            <span className="sps-filter-badge">{activeFilterCount}</span>
          )}
        </button>
      </div>

      {/* Mobile category chips */}
      <div className="sps-chips">
        <div className="sps-chips-scroll">
          {categoriesWithShops.slice(0, 10).map(cat => (
            <button
              key={cat.id}
              type="button"
              className={`sps-chip${filterCat === cat.id ? ' active' : ''}`}
              onClick={() => handleFilterCat(cat.id)}
            >
              <span style={{ display: 'flex' }}>{CAT_ICONS[cat.id]}</span>
              {cat.label}
            </button>
          ))}
        </div>
      </div>

      {/* BODY */}
      <div className="sps-body">

        {/* SIDEBAR */}
        <div className="sps-sidebar" ref={sidebarRef} style={{ position: 'relative' }}>
          <div className="sps-sidebar-head sps-sidebar-head-sticky">
            <h3>Filter Shops</h3>
            <button className="sps-clear-btn" onClick={clearFilters}>Clear all</button>
          </div>
          <div className="sps-sidebar-card" style={{ paddingTop: 4 }}>
            <div className="sps-section-title">
              <span>Categories</span>
              <button><Icon.ChevronDown /></button>
            </div>
            {visibleCategories.map(cat => (
              <div
                key={cat.id}
                className={`sps-filter-item ${filterCat === cat.id ? 'active' : ''}`}
                onClick={() => handleFilterCat(cat.id)}
              >
                <span className="fi-icon">{CAT_ICONS[cat.id]}</span>
                <span>{cat.label}</span>
                {filterCat === cat.id && <span className="fi-dot" />}
              </div>
            ))}
            {!showMoreCategories && categoriesWithShops.length > 5 && (
              <button className="sps-show-more" onClick={() => setShowMoreCategories(true)}>
                See more <Icon.ChevronDown />
              </button>
            )}
            {showMoreCategories && categoriesWithShops.length > 5 && (
              <button className="sps-show-more" onClick={() => setShowMoreCategories(false)}>
                Show less <Icon.ChevronDown />
              </button>
            )}

            <div className="sps-section-title" style={{ marginTop: 20 }}>
              <span>District</span>
              <button><Icon.ChevronDown /></button>
            </div>
            {visibleDistricts.map(d => (
              <div
                key={d}
                className={`sps-filter-item ${filterDistrict === d ? 'active' : ''}`}
                onClick={() => handleFilterDistrict(d)}
              >
                <span className="fi-icon"><Icon.Pin /></span>
                <span>{d}</span>
                {filterDistrict === d && <span className="fi-dot" />}
              </div>
            ))}
            {!showMoreDistricts && districtsWithShops.length > 5 && (
              <button className="sps-show-more" onClick={() => setShowMoreDistricts(true)}>
                See more <Icon.ChevronDown />
              </button>
            )}
            {showMoreDistricts && districtsWithShops.length > 5 && (
              <button className="sps-show-more" onClick={() => setShowMoreDistricts(false)}>
                Show less <Icon.ChevronDown />
              </button>
            )}

            <div className="sps-section-title" style={{ marginTop: 20 }}>
              <span>Shop Type</span>
              <button><Icon.ChevronDown /></button>
            </div>
            {SHOP_TYPES.map(t => (
              <div
                key={t.id}
                className={`sps-filter-item ${shopType === t.id ? 'active' : ''}`}
                onClick={() => handleShopType(t.id)}
              >
                <span className="fi-icon">
                  {t.id === 'all'
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
                    : t.id === 'verified'
                    ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg>
                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  }
                </span>
                <span>{t.label}</span>
                {shopType === t.id && <span className="fi-dot" />}
              </div>
            ))}
          </div>

          {/* BLOCKED SHOPS */}
          {blockedShops.length > 0 && (
            <div style={{
              background: T.white, border: `1px solid ${T.border}`,
              borderRadius: 14, padding: '14px 18px', marginBottom: 16,
            }}>
              <div
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', marginBottom: showBlocked ? 12 : 0,
                }}
                onClick={() => setShowBlocked(o => !o)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                  </svg>
                  <span style={{ fontSize: 12.5, fontWeight: 800, color: T.text }}>Blocked Shops</span>
                  <span style={{
                    background: '#fef2f2', color: '#dc2626',
                    fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 10,
                  }}>{blockedShops.length}</span>
                </div>
                <svg
                  width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke={T.textMuted} strokeWidth="2.5" strokeLinecap="round"
                  style={{ transition: 'transform 0.2s', transform: showBlocked ? 'rotate(180deg)' : 'rotate(0deg)' }}
                >
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </div>

              {showBlocked && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {blockedShopDetails.map(s => (
                    <div key={s.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', borderRadius: 10,
                      background: T.offwhite, border: `1px solid ${T.border}`,
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: 8, flexShrink: 0,
                        background: s.logo_url ? '#111' : 'linear-gradient(135deg,#1b5e20,#2e7d32)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        overflow: 'hidden', fontSize: 11, fontWeight: 800, color: '#fff',
                      }}>
                        {s.logo_url
                          ? <img src={s.logo_url} alt={s.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                          : initials(s.name)
                        }
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.name}</div>
                        <div style={{ fontSize: 11, color: T.textMuted }}>{s.category || 'Shop'}</div>
                      </div>
                      <button
                        onClick={() => {
                          const updated = blockedShops.filter(id => id !== s.id)
                          localStorage.setItem('soko_blocked_shops', JSON.stringify(updated))
                          setBlockedShops(updated)
                          setBlockedShopDetails(d => d.filter(x => x.id !== s.id))
                          setPage(1)
                          setShops([])
                          setHasMore(true)
                          fetchShops(1, true)
                        }}
                        style={{
                          flexShrink: 0, fontSize: 11, fontWeight: 700,
                          color: T.green, background: T.greenLight,
                          border: 'none', borderRadius: 7, padding: '4px 9px',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >Unblock</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* PROMO CARD */}
          <div className="sps-promo-card">
            <div className="sps-promo-icon">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
                <path d="m2 7 4-4h12l4 4"/><path d="M3 7v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7"/><path d="M16 11a4 4 0 0 1-8 0"/>
              </svg>
            </div>
            <h4>Open your own shop</h4>
            <p>Get a public shop page, reach more buyers, and grow on SokoMW.</p>
            <button type="button" className="sps-promo-btn" onClick={() => navigate('/shop-setup')}>Open shop now</button>
          </div>

          {/* Scroll hint at bottom */}
          <div style={{
            position: 'sticky',
            bottom: 0,
            height: 44,
            background: `linear-gradient(to top, ${T.offwhite} 40%, transparent)`,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            paddingBottom: 8,
            pointerEvents: 'none',
            zIndex: 10,
            marginTop: -44,
            opacity: sidebarAtBottom ? 0 : 1,
            transition: 'opacity 0.25s ease',
          }}>
            <div
              onClick={() => {
                const sidebar = document.querySelector('.sps-sidebar')
                if (sidebar) sidebar.scrollBy({ top: 200, behavior: 'smooth' })
              }}
              style={{
                width: 28, height: 28, borderRadius: '50%',
                background: T.white,
                border: `1.5px solid ${T.green}`,
                boxShadow: '0 2px 8px rgba(46,125,50,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: T.green, cursor: 'pointer',
                pointerEvents: 'all',
                transition: 'all 0.15s',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.background = T.greenLight
                e.currentTarget.style.transform = 'scale(1.1)'
              }}
              onMouseLeave={e => {
                e.currentTarget.style.background = T.white
                e.currentTarget.style.transform = 'scale(1)'
              }}
            >
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </div>
          </div>
        </div>

        {/* MAIN */}
        <div className="sps-main" style={{ paddingTop: 0 }}>
          <div className="sps-results-row" style={{ marginTop: 0 }}>
            <div className="sps-results-count">
              <strong>{totalCount.toLocaleString()} shops</strong> found
            </div>
            <div className="sps-view-toggle">
              <button className={`sps-view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}><Icon.Grid /></button>
              <button className={`sps-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><Icon.List /></button>
            </div>
          </div>

          {loading ? (
            <div className="sps-loading">Loading shops…</div>
          ) : shops.length === 0 ? (
            <div className="sps-empty">
              <div style={{ marginBottom: 12 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
              </div>
              <h3>No shops found</h3>
              <p>Try adjusting your filters or search terms.</p>
            </div>
          ) : viewMode === 'list' ? (
            <div className="sps-list">
              {shops.map(shop => (
                <div key={shop.id} className="sps-list-card" onClick={() => navigate(`/shop/${shop.slug}`)}>
                  <div className="sps-list-logo" style={{
                    background: shop.logo_url ? '#111' : `linear-gradient(135deg, #334155, #1e293b)`,
                  }}>
                    {shop.logo_url
                      ? <img src={shop.logo_url} alt={shop.name} />
                      : initials(shop.name)
                    }
                  </div>
                  <div className="sps-list-info">
                    <div className="sps-list-name-row">
                      <span className="sps-list-name">{shop.name}</span>
                      {shop.is_verified && <Icon.Check />}
                    </div>
                    <div className="sps-list-meta">
                      <span>{shop.category || 'General'}</span>
                      <span style={{ color: T.border }}>•</span>
                      <Icon.Pin />
                      <span>{shop.city ? `${shop.city}, ` : ''}{shop.district || 'Malawi'}</span>
                      <span style={{ color: T.border }}>•</span>
                      <span className="sps-meta-extra">{shop.follower_count >= 1000 ? `${(shop.follower_count / 1000).toFixed(1)}K` : shop.follower_count || 0} followers</span>
                      {shop.rating && (
                        <span className="sps-meta-extra" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <span style={{ color: T.border }}>•</span>
                          <span className="star" style={{ color: T.gold }}><Icon.Star /></span>
                          <span>{shop.rating} ({shop.review_count || 0})</span>
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="sps-list-actions">
                    {shop.owner_id === currentUserId ? (
                      <button
                        type="button"
                        className="sps-follow-btn"
                        onClick={e => { e.stopPropagation(); navigate(`/shop/${shop.slug}`) }}
                        style={{ background: T.gray100, color: T.gray900, border: `1.5px solid ${T.border}` }}
                      >
                        Manage
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`sps-follow-btn ${followingMap[shop.id] ? 'following' : ''}`}
                        onClick={e => handleFollow(e, shop)}
                      >
                        {followingMap[shop.id] ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="sps-grid">
              {shops.map(shop => (
                <div key={shop.id} className="sps-shop-card" onClick={() => navigate(`/shop/${shop.slug}`)}>
                  {/* Cover */}
                  <div className="sps-card-cover">
                    <div style={{
                      position: 'absolute', inset: 0, overflow: 'hidden', borderRadius: '16px 16px 0 0',
                      background: `linear-gradient(135deg, #1e293b 0%, #334155 55%, ${T.gold}44 100%)`,
                    }}>
                      {shop.cover_url && (
                        <img src={shop.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      )}
                    </div>
                    <div className="sps-card-logo" style={{
                      background: shop.logo_url ? '#111' : `linear-gradient(135deg, #334155, #1e293b)`,
                    }}>
                      {shop.logo_url
                        ? <img src={shop.logo_url} alt={shop.name} />
                        : <span style={{ fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{initials(shop.name)}</span>
                      }
                    </div>
                  </div>

                  {/* Body */}
                  <div className="sps-card-body">
                    <div className="sps-card-name-row">
                      <span className="sps-card-name">{shop.name}</span>
                      {shop.is_verified && <Icon.Check />}
                    </div>
                    <div className="sps-card-category">{shop.category || 'General'}</div>
                    <div className="sps-card-location">
                      <Icon.Pin />
                      {shop.city ? `${shop.city}, ` : ''}{shop.district || 'Malawi'}
                    </div>
                    <div className="sps-card-stats">
                      <span>{shop.follower_count >= 1000
                        ? `${(shop.follower_count / 1000).toFixed(1)}K`
                        : shop.follower_count || 0} followers</span>
                      {shop.rating && (
                        <>
                          <span className="dot">•</span>
                          <span className="star"><Icon.Star /></span>
                          <span>{shop.rating}</span>
                          <span style={{ color: T.textLight }}>({shop.review_count || 0})</span>
                        </>
                      )}
                    </div>
                    {shop.owner_id === currentUserId ? (
                      <button
                        type="button"
                        className="sps-follow-btn"
                        onClick={e => { e.stopPropagation(); navigate(`/shop/${shop.slug}`) }}
                        style={{ background: T.gray100, color: T.gray900, border: `1.5px solid ${T.border}` }}
                      >
                        Manage Shop
                      </button>
                    ) : (
                      <button
                        type="button"
                        className={`sps-follow-btn ${followingMap[shop.id] ? 'following' : ''}`}
                        onClick={e => handleFollow(e, shop)}
                      >
                        {followingMap[shop.id] ? 'Following' : 'Follow'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* INFINITE SCROLL SENTINEL */}
          {hasMore && shops.length > 0 && (
            <div ref={sentinelRef} style={{ height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 24 }}>
              {loadingMore && <span style={{ fontSize: 13, color: T.textMuted }}>Loading more shops…</span>}
            </div>
          )}
          {!hasMore && shops.length > 0 && (
            <div style={{ textAlign: 'center', marginTop: 28, fontSize: 12.5, color: T.textLight }}>
              You've reached the end — that's all {totalCount} shops.
            </div>
          )}
        </div>
      </div>

      {/* Mobile filter drawer */}
      <div className={`sps-drawer${mobileFilterOpen ? ' open' : ''}`} aria-hidden={!mobileFilterOpen}>
        <div className="sps-drawer-overlay" onClick={() => setMobileFilterOpen(false)} />
        <div className="sps-drawer-panel" role="dialog" aria-label="Filter shops">
          <div className="sps-drawer-handle" />
          <div className="sps-drawer-head">
            <h3>Filters</h3>
            <button type="button" className="sps-drawer-close" onClick={() => setMobileFilterOpen(false)} aria-label="Close">
              <Icon.X />
            </button>
          </div>

          <div className="sps-section-title" style={{ marginTop: 0 }}>
            <span>Category</span>
          </div>
          {categoriesWithShops.map(cat => (
            <div
              key={cat.id}
              className={`sps-filter-item ${filterCat === cat.id ? 'active' : ''}`}
              onClick={() => handleFilterCat(cat.id)}
            >
              <span className="fi-icon">{CAT_ICONS[cat.id]}</span>
              <span>{cat.label}</span>
              {filterCat === cat.id && <span className="fi-dot" />}
            </div>
          ))}

          <div className="sps-section-title">
            <span>District</span>
          </div>
          {districtsWithShops.map(d => (
            <div
              key={d}
              className={`sps-filter-item ${filterDistrict === d ? 'active' : ''}`}
              onClick={() => handleFilterDistrict(d)}
            >
              <span className="fi-icon"><Icon.Pin /></span>
              <span>{d}</span>
              {filterDistrict === d && <span className="fi-dot" />}
            </div>
          ))}

          <div className="sps-section-title">
            <span>Shop type</span>
          </div>
          {SHOP_TYPES.map(t => (
            <div
              key={t.id}
              className={`sps-filter-item ${shopType === t.id ? 'active' : ''}`}
              onClick={() => handleShopType(t.id)}
            >
              <span>{t.label}</span>
              {shopType === t.id && <span className="fi-dot" />}
            </div>
          ))}

          <div className="sps-section-title">
            <span>Sort by</span>
          </div>
          {SORT_OPTIONS.map(s => (
            <div
              key={s.id}
              className={`sps-filter-item ${sortBy === s.id ? 'active' : ''}`}
              onClick={() => { setSortBy(s.id); setPage(1) }}
            >
              <span>{s.label}</span>
              {sortBy === s.id && <span className="fi-dot" />}
            </div>
          ))}

          <div className="sps-drawer-actions">
            <button type="button" className="sps-drawer-clear" onClick={() => { clearFilters(); setMobileFilterOpen(false) }}>
              Clear all
            </button>
            <button type="button" className="sps-drawer-apply" onClick={() => setMobileFilterOpen(false)}>
              Show results
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}