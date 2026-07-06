import { useState, useEffect, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const T = {
  green: '#2e7d32',
  greenDark: '#1b5e20',
  greenLight: '#e8f5e9',
  gold: '#f9a825',
  white: '#ffffff',
  offwhite: '#f9fafb',
  text: '#0d1b0e',
  textMuted: '#4a5e4d',
  textLight: '#7a917c',
  border: '#e3ece5',
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

const PAGE_SIZE = 9

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; }
  body { margin: 0; }

  .sps-root { font-family: 'Inter', system-ui, sans-serif; background: ${T.offwhite}; min-height: 100vh; }

  /* HEADER */
  .sps-header {
    background: ${T.white}; border-bottom: 1px solid ${T.border};
    padding: 14px 28px; display: flex; align-items: center; gap: 24px;
    position: sticky; top: 0; z-index: 100;
  }
  .sps-brand { font-size: 21px; font-weight: 900; color: ${T.text}; letter-spacing: -0.5px; cursor: pointer; flex-shrink: 0; }
  .sps-brand span { color: ${T.green}; }
  .sps-search-wrap { flex: 1; max-width: 420px; position: relative; }
  .sps-search-wrap input {
    width: 100%; height: 38px; border-radius: 19px;
    border: 1.5px solid ${T.border}; background: ${T.offwhite};
    padding: 0 40px 0 16px; font-size: 13.5px; font-family: inherit; outline: none;
  }
  .sps-search-wrap input:focus { border-color: ${T.green}; }
  .sps-search-icon { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: ${T.textLight}; pointer-events: none; }
  .sps-nav-actions { display: flex; align-items: center; gap: 22px; margin-left: auto; flex-shrink: 0; }
  .sps-nav-item {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    font-size: 11px; font-weight: 600; color: ${T.textMuted}; cursor: pointer; position: relative;
  }
  .sps-nav-item.active { color: ${T.green}; }
  .sps-nav-item.active::after { content: ''; position: absolute; bottom: -18px; left: 0; right: 0; height: 2px; background: ${T.green}; }
  .sps-nav-badge {
    position: absolute; top: -4px; right: -8px;
    background: #e53e3e; color: #fff; font-size: 9px; font-weight: 800;
    border-radius: 10px; padding: 1px 5px; min-width: 16px; text-align: center;
  }
  .sps-nav-user { display: flex; align-items: center; gap: 8px; cursor: pointer; }
  .sps-nav-avatar { width: 32px; height: 32px; border-radius: 50%; object-fit: cover; background: ${T.greenLight}; }
  .sps-nav-user span { font-size: 13px; font-weight: 600; color: ${T.text}; }
  .sps-nav-chevron { color: ${T.textMuted}; }

  /* PAGE TITLE ROW */
  .sps-title-row {
    max-width: 1280px; margin: 0 auto; padding: 28px 24px 16px;
    display: flex; align-items: flex-start; justify-content: space-between;
  }
  .sps-title-row h1 { font-size: 28px; font-weight: 800; color: ${T.text}; margin: 0 0 4px; }
  .sps-title-row p { font-size: 13.5px; color: ${T.textMuted}; margin: 0; }
  .sps-open-shop-btn {
    display: flex; align-items: center; gap: 7px;
    background: ${T.white}; border: 1.5px solid ${T.green}; color: ${T.green};
    border-radius: 10px; padding: 10px 18px; font-size: 13.5px; font-weight: 700;
    font-family: inherit; cursor: pointer; white-space: nowrap; transition: all 0.15s;
  }
  .sps-open-shop-btn:hover { background: ${T.greenLight}; }

  /* FILTER BAR */
  .sps-filter-bar {
    max-width: 1280px; margin: 0 auto; padding: 0 24px 20px;
    display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
  }
  .sps-filter-search-wrap { flex: 1; min-width: 220px; max-width: 340px; position: relative; }
  .sps-filter-search-wrap input {
    width: 100%; height: 40px; border-radius: 10px;
    border: 1.5px solid ${T.border}; background: ${T.white};
    padding: 0 40px 0 14px; font-size: 13px; font-family: inherit; outline: none;
  }
  .sps-filter-search-wrap input:focus { border-color: ${T.green}; }
  .sps-filter-search-icon { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); color: ${T.textLight}; pointer-events: none; }
  .sps-filter-select {
    height: 40px; border: 1.5px solid ${T.border}; border-radius: 10px;
    padding: 0 32px 0 12px; font-size: 13px; font-weight: 600; font-family: inherit;
    background: ${T.white}; color: ${T.text}; cursor: pointer; outline: none;
    appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%234a5e4d' stroke-width='2.5'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");
    background-repeat: no-repeat; background-position: right 10px center;
  }
  .sps-filter-select:focus { border-color: ${T.green}; }

  /* BODY LAYOUT */
  .sps-body {
    max-width: 1280px; margin: 0 auto; padding: 0 24px 60px;
    display: grid; grid-template-columns: 220px minmax(0, 1fr); gap: 28px;
    align-items: start;
  }
  @media (max-width: 900px) { .sps-body { grid-template-columns: 1fr; } }

  /* SIDEBAR */
  .sps-sidebar {
    flex-shrink: 0;
    position: sticky;
    top: 76px;
    max-height: calc(100vh - 92px);
    overflow-y: auto;
    scrollbar-width: thin;
    scrollbar-color: ${T.border} transparent;
    scroll-behavior: smooth;
    align-self: start;
    margin-top: -56px;
  }
  .sps-sidebar::-webkit-scrollbar { width: 3px; }
  .sps-sidebar::-webkit-scrollbar-track { background: transparent; }
  .sps-sidebar::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 10px; }
  .sps-sidebar::-webkit-scrollbar-thumb:hover { background: ${T.textLight}; }
  .sps-sidebar-card {
    background: ${T.white}; border: 1px solid ${T.border}; border-top: none;
    border-radius: 0 0 14px 14px;
    padding: 14px 18px 18px; margin-bottom: 16px;
  }
  .sps-sidebar-head {
    display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;
  }
  .sps-sidebar-head-sticky {
    position: sticky; top: 0; z-index: 5;
    background: ${T.white}; border: 1px solid ${T.border}; border-bottom: none;
    border-radius: 14px 14px 0 0;
    padding: 18px 18px 12px;
    margin-bottom: 0;
  }
  .sps-sidebar-head h3 { font-size: 13.5px; font-weight: 800; color: ${T.text}; margin: 0; }
  .sps-clear-btn { font-size: 12px; font-weight: 700; color: ${T.green}; background: none; border: none; cursor: pointer; }
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
  .sps-filter-item.active { background: ${T.greenLight}; color: ${T.green}; font-weight: 700; }
  .sps-filter-item .fi-icon { font-size: 15px; width: 20px; text-align: center; }
  .sps-filter-item .fi-dot { width: 8px; height: 8px; border-radius: 50%; background: ${T.green}; margin-left: auto; flex-shrink: 0; }
  .sps-show-more { font-size: 12px; font-weight: 700; color: ${T.green}; background: none; border: none; cursor: pointer; margin-top: 4px; display: flex; align-items: center; gap: 4px; }

  .sps-promo-card {
    background: ${T.greenLight}; border: 1px solid ${T.border}; border-radius: 14px;
    padding: 20px 16px; text-align: center; margin-top: 16px;
  }
  .sps-promo-icon { font-size: 36px; margin-bottom: 10px; }
  .sps-promo-card h4 { font-size: 14px; font-weight: 800; color: ${T.text}; margin: 0 0 6px; }
  .sps-promo-card p { font-size: 12px; color: ${T.textMuted}; margin: 0 0 14px; line-height: 1.5; }
  .sps-promo-btn {
    width: 100%; background: ${T.green}; color: ${T.white}; border: none; border-radius: 10px;
    padding: 11px; font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer;
  }
  .sps-promo-btn:hover { background: ${T.greenDark}; }

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
  .sps-view-btn.active { background: ${T.greenLight}; border-color: ${T.green}; color: ${T.green}; }

  /* SHOP GRID */
  .sps-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
  @media (max-width: 1100px) { .sps-grid { grid-template-columns: repeat(2, 1fr); } }
  @media (max-width: 600px) { .sps-grid { grid-template-columns: 1fr; } }

  /* SHOP LIST VIEW */
  .sps-list { display: flex; flex-direction: column; gap: 14px; }
  .sps-list-card {
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 14px;
    overflow: visible; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
    display: flex; align-items: center; gap: 18px; padding: 14px 18px;
  }
  .sps-list-card:hover { box-shadow: 0 8px 24px rgba(13,31,15,0.08); }
  .sps-list-logo {
    width: 64px; height: 64px; border-radius: 50%; flex-shrink: 0;
    background: #111; display: flex; align-items: center; justify-content: center;
    overflow: hidden; color: ${T.white}; font-size: 17px; font-weight: 900;
  }
  .sps-list-logo img { width: 100%; height: 100%; object-fit: cover; }
  .sps-list-info { flex: 1; min-width: 0; }
  .sps-list-name-row { display: flex; align-items: center; gap: 6px; margin-bottom: 2px; }
  .sps-list-name { font-size: 15px; font-weight: 800; color: ${T.text}; }
  .sps-list-meta { font-size: 12.5px; color: ${T.textMuted}; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .sps-list-actions { flex-shrink: 0; }
  .sps-list-actions .sps-follow-btn { width: 130px; }
  @media (max-width: 600px) {
    .sps-list-card { flex-wrap: wrap; }
    .sps-list-actions { width: 100%; }
    .sps-list-actions .sps-follow-btn { width: 100%; }
  }

  .sps-shop-card {
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 16px;
    overflow: visible; cursor: pointer; transition: transform 0.15s, box-shadow 0.15s;
  }
  .sps-shop-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(13,31,15,0.09); }

  .sps-card-cover {
    position: relative; height: 160px; background: linear-gradient(135deg, ${T.greenLight}, ${T.border});
    overflow: visible;
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

  .sps-card-body { padding: 32px 16px 16px; }
  .sps-card-name-row { display: flex; align-items: center; gap: 6px; margin-bottom: 3px; }
  .sps-card-name { font-size: 15px; font-weight: 800; color: ${T.text}; }
  .sps-card-category { font-size: 12px; color: ${T.textMuted}; font-weight: 500; margin-bottom: 6px; }
  .sps-card-location { font-size: 12px; color: ${T.textMuted}; display: flex; align-items: center; gap: 4px; margin-bottom: 8px; }
  .sps-card-stats { font-size: 12px; color: ${T.textMuted}; display: flex; align-items: center; gap: 6px; margin-bottom: 12px; }
  .sps-card-stats .star { color: ${T.gold}; }
  .sps-card-stats .dot { color: ${T.border}; }

  .sps-follow-btn {
    width: 100%; border: 1.5px solid ${T.green}; color: ${T.green};
    background: ${T.white}; border-radius: 50px; padding: 9px;
    font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer;
    transition: all 0.15s;
  }
  .sps-follow-btn:hover { background: ${T.greenLight}; }
  .sps-follow-btn.following { background: ${T.green}; color: ${T.white}; }
  .sps-follow-btn.following:hover { background: ${T.greenDark}; }

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
  .sps-empty { text-align: center; padding: 60px 20px; color: ${T.textMuted}; }
  .sps-empty h3 { font-size: 16px; font-weight: 700; color: ${T.text}; margin: 0 0 8px; }
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
  const [currentUser, setCurrentUser] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [followingMap, setFollowingMap] = useState({})
  const [notifCount, setNotifCount] = useState(0)
  const [chatCount, setChatCount] = useState(0)
  const [viewMode, setViewMode] = useState('grid')
  const [page, setPage] = useState(1)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const sentinelRef = useRef(null)
  const [showMoreDistricts, setShowMoreDistricts] = useState(false)
  const [blockedShops, setBlockedShops] = useState([])
  const [blockedShopDetails, setBlockedShopDetails] = useState([])
  const [showBlocked, setShowBlocked] = useState(false)

  // Filters
  const [searchQ, setSearchQ] = useState('')
  const [filterCat, setFilterCat] = useState('all')
  const [filterDistrict, setFilterDistrict] = useState('All Districts')
  const [sortBy, setSortBy] = useState('followers')
  const [shopType, setShopType] = useState('all')

  const totalPages = Math.ceil(totalCount / PAGE_SIZE)

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
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setCurrentUserId(user.id)
        const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).maybeSingle()
        setCurrentUser(profile)

        const { data: follows } = await supabase.from('shop_followers').select('shop_id').eq('user_id', user.id)
        const map = {}
        follows?.forEach(f => { map[f.shop_id] = true })
        setFollowingMap(map)

        loadNotifCount(user.id)
        loadChatCount(user.id)
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

  async function loadChatCount(uid) {
    const { count } = await supabase.from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('recipient_id', uid).eq('read', false)
    setChatCount(count || 0)
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

  // Pagination pages to show
  function getPaginationPages() {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    const pages = [1, 2]
    if (page > 4) pages.push('...')
    for (let i = Math.max(3, page - 1); i <= Math.min(totalPages - 2, page + 1); i++) pages.push(i)
    if (page < totalPages - 3) pages.push('...')
    pages.push(totalPages - 1, totalPages)
    return [...new Set(pages)]
  }

  return (
    <div className="sps-root">
      <style>{css}</style>

      {/* HEADER */}
      <div className="sps-header">
        <div className="sps-brand" onClick={() => navigate('/')}>Soko<span>MW</span></div>
        <div className="sps-search-wrap">
          <input
            placeholder="Search shops, categories or products..."
            value={searchQ}
            onChange={e => handleSearch(e.target.value)}
          />
          <span className="sps-search-icon"><Icon.Search /></span>
        </div>
        <div className="sps-nav-actions">
          <div className="sps-nav-item" onClick={() => navigate('/')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Home
          </div>
          <div className="sps-nav-item active">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            Shops
          </div>
          <div className="sps-nav-item" onClick={() => navigate('/chats')} style={{ position: 'relative' }}>
            <Icon.Msg />Messages
            {chatCount > 0 && <span className="sps-nav-badge">{chatCount > 9 ? '9+' : chatCount}</span>}
          </div>
          <div className="sps-nav-item" onClick={() => navigate('/notifications')} style={{ position: 'relative' }}>
            <Icon.Bell />Notifications
            {notifCount > 0 && <span className="sps-nav-badge">{notifCount > 9 ? '9+' : notifCount}</span>}
          </div>
          <div className="sps-nav-user" onClick={() => navigate(currentUserId ? '/profile' : '/login')}>
            {currentUser?.avatar_url ? (
              <img className="sps-nav-avatar" src={currentUser.avatar_url} alt="" />
            ) : (
              <div className="sps-nav-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: T.green }}>
                {currentUserId ? initials(currentUser?.full_name) : '?'}
              </div>
            )}
            <span>{currentUser?.full_name?.split(' ')[0] || 'Account'}</span>
            <span className="sps-nav-chevron"><Icon.ChevronDown /></span>
          </div>
        </div>
      </div>

      {/* PAGE TITLE */}
      <div className="sps-title-row">
        <div>
          <h1>Shops</h1>
          <p>Discover trusted shops and verified businesses near you.</p>
        </div>
        <button className="sps-open-shop-btn" onClick={() => navigate('/shop-setup')}>
          <Icon.Plus /> Open Your Shop
        </button>
      </div>

      {/* FILTER BAR */}
      <div className="sps-filter-bar">
        <div className="sps-filter-search-wrap">
          <input
            placeholder="Search shops by name, category or keyword..."
            value={searchQ}
            onChange={e => handleSearch(e.target.value)}
          />
          <span className="sps-filter-search-icon"><Icon.Search /></span>
        </div>
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
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                <line x1="3" y1="6" x2="21" y2="6"/>
                <path d="M16 10a4 4 0 0 1-8 0"/>
              </svg>
            </div>
            <h4>Open your own shop</h4>
            <p>Get your own shop page, connect with more buyers and grow your business.</p>
            <button className="sps-promo-btn" onClick={() => navigate('/shop-setup')}>Open Shop Now</button>
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
                    background: shop.logo_url ? '#111' : `linear-gradient(135deg, #1b5e20, #2e7d32)`,
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
                      <span>{shop.follower_count >= 1000 ? `${(shop.follower_count / 1000).toFixed(1)}K` : shop.follower_count || 0} followers</span>
                      {shop.rating && (
                        <>
                          <span style={{ color: T.border }}>•</span>
                          <span className="star" style={{ color: T.gold }}><Icon.Star /></span>
                          <span>{shop.rating} ({shop.review_count || 0})</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="sps-list-actions">
                    {shop.owner_id === currentUserId ? (
                      <button
                        className="sps-follow-btn"
                        onClick={e => { e.stopPropagation(); navigate(`/shop/${shop.slug}`) }}
                        style={{ background: T.greenLight, color: T.green, border: `1.5px solid ${T.green}` }}
                      >
                        Manage Shop
                      </button>
                    ) : (
                      <button
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
                    {/* Image clipped separately */}
                    <div style={{
                      position: 'absolute', inset: 0, overflow: 'hidden',
                      background: `linear-gradient(135deg, ${T.greenLight}, ${T.border})`,
                    }}>
                      {shop.cover_url && (
                        <img src={shop.cover_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      )}
                    </div>
                    {/* Logo overhangs below cover */}
                    <div className="sps-card-logo" style={{
                      background: shop.logo_url ? '#111' : `linear-gradient(135deg, #1b5e20, #2e7d32)`,
                    }}>
                      {shop.logo_url
                        ? <img src={shop.logo_url} alt={shop.name} />
                        : <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.5px' }}>{initials(shop.name)}</span>
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
                        className="sps-follow-btn"
                        onClick={e => { e.stopPropagation(); navigate(`/shop/${shop.slug}`) }}
                        style={{ background: T.greenLight, color: T.green, border: `1.5px solid ${T.green}` }}
                      >
                        Manage Shop
                      </button>
                    ) : (
                      <button
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
    </div>
  )
}