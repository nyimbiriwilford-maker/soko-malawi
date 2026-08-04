import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import VerificationModal from '../components/VerificationModal'
import SokoNav from '../components/SokoNav'
import { featureExistingListing } from '../lib/featureListing'
import { FEATURED_DURATION_DAYS, featuredPriceLabel } from '../constants/featuredPricing'
import { isListingFeatured } from '../utils/homeUtils'

const CATEGORIES = [
  'Fashion & Clothing', 'Electronics', 'Phones & Accessories', 'Vehicles',
  'Home & Furniture', 'Agriculture', 'Beauty & Cosmetics', 'Hardware',
  'Food & Groceries', 'Services', 'Other',
]

const DISTRICTS = [
  'Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Kasungu', 'Mangochi',
  'Salima', 'Karonga', 'Mchinji', 'Dedza', 'Ntcheu', 'Balaka',
  'Machinga', 'Nkhotakota', 'Rumphi', 'Other',
]

/* Soko marketplace tokens — match Home / Search / Shops */
const T = {
  green: '#0F9D58',
  greenDark: '#0a7a44',
  greenLight: '#e8f5ee',
  gold: '#F9AB00',
  goldDark: '#c88a00',
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

/** Shop owner theme presets (stored as shops.theme) */
const SHOP_THEMES = {
  green: {
    id: 'green',
    label: 'Green',
    color: '#0F9D58',
    dark: '#0a7a44',
    light: '#e8f5ee',
    onAccent: '#ffffff',
    cover: 'linear-gradient(135deg, #0F9D58 0%, #0a7a44 55%, #F9AB00 130%)',
    soft: 'rgba(15,157,88,.12)',
    ring: 'rgba(15,157,88,.18)',
  },
  gold: {
    id: 'gold',
    label: 'Gold',
    color: '#F9AB00',
    dark: '#c88a00',
    light: '#fff8e1',
    onAccent: '#202124',
    cover: 'linear-gradient(135deg, #F9AB00 0%, #c88a00 50%, #1e293b 120%)',
    soft: 'rgba(249,171,0,.16)',
    ring: 'rgba(249,171,0,.22)',
  },
  dark: {
    id: 'dark',
    label: 'Dark',
    color: '#1e293b',
    dark: '#0f172a',
    light: '#e2e8f0',
    onAccent: '#ffffff',
    cover: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)',
    soft: 'rgba(30,41,59,.14)',
    ring: 'rgba(30,41,59,.2)',
  },
}

function resolveShopTheme(themeKey) {
  return SHOP_THEMES[themeKey] || SHOP_THEMES.green
}

// ── Placeholder data — swap these for real Supabase queries once
// listings / reviews / shop_policies tables + relations are ready ──
const PLACEHOLDER_LISTINGS = [
  { id: 1, title: 'African Print Maxi Dress', price: 'MK25,000', img: 'https://images.pexels.com/photos/9594433/pexels-photo-9594433.jpeg?auto=compress&cs=tinysrgb&w=600', city: 'Blantyre', featured: true },
  { id: 2, title: 'Office Wear Dress', price: 'MK30,000', img: 'https://images.pexels.com/photos/9558626/pexels-photo-9558626.jpeg?auto=compress&cs=tinysrgb&w=600', city: 'Blantyre', featured: false },
  { id: 3, title: 'Leather Handbag', price: 'MK20,000', img: 'https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg?auto=compress&cs=tinysrgb&w=600', city: 'Blantyre', featured: false },
  { id: 4, title: 'African Print Two Piece', price: 'MK28,000', img: 'https://images.pexels.com/photos/9594427/pexels-photo-9594427.jpeg?auto=compress&cs=tinysrgb&w=600', city: 'Blantyre', featured: false },
  { id: 5, title: 'Summer Dress', price: 'MK22,000', img: 'https://images.pexels.com/photos/9558667/pexels-photo-9558667.jpeg?auto=compress&cs=tinysrgb&w=600', city: 'Blantyre', featured: false },
  { id: 6, title: 'Ankara Jumpsuit', price: 'MK26,000', img: 'https://images.pexels.com/photos/9594459/pexels-photo-9594459.jpeg?auto=compress&cs=tinysrgb&w=600', city: 'Blantyre', featured: false },
]

const PLACEHOLDER_SIMILAR_SHOPS = [
  { name: 'Zed Collections', category: "Men's Fashion", followers: '892', rating: '4.7', initials: 'ZC', color: T.text },
  { name: 'Tinas Bags', category: 'Bags & Luggage', followers: '645', rating: '4.6', img: 'https://images.pexels.com/photos/1152077/pexels-photo-1152077.jpeg?auto=compress&cs=tinysrgb&w=200' },
  { name: 'Elegant Steps', category: 'Shoes', followers: '1.1K', rating: '4.8', img: 'https://images.pexels.com/photos/336372/pexels-photo-336372.jpeg?auto=compress&cs=tinysrgb&w=200' },
  { name: 'Bella Boutique', category: "Women's Fashion", followers: '723', rating: '4.7', initials: 'BB', color: T.goldDark },
]

const css = `
  *, *::before, *::after { box-sizing: border-box; }

  .sp-root {
    font-family: 'Inter', system-ui, sans-serif;
    background: ${T.offwhite};
    min-height: 100vh; min-height: 100dvh;
    color: ${T.text};
    /* Keep overflow visible so sticky sidebar works (clip breaks position:sticky) */
    overflow-x: visible;
    -webkit-tap-highlight-color: transparent;
    --theme: ${T.green};
    --theme-dark: ${T.greenDark};
    --theme-light: ${T.greenLight};
    --theme-on: #fff;
    --theme-soft: rgba(15,157,88,.12);
    --theme-ring: rgba(15,157,88,.18);
    --theme-cover: linear-gradient(135deg, #0F9D58 0%, #0a7a44 55%, #F9AB00 130%);
    /* Fallback until measured from real nav height */
    --sp-nav-offset: 120px;
  }
  @media (max-width: 900px) {
    .sp-root { padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px)); }
  }

  /* Dark shop theme: slightly cooler page backdrop */
  .sp-root.sp-theme-dark {
    background: #f1f3f5;
  }
  .sp-root.sp-theme-gold .sp-verified-pill {
    color: #202124;
  }

  /* ── BREADCRUMB ── */
  .sp-breadcrumb {
    max-width: 1180px; margin: 0 auto;
    padding: 14px 20px 0;
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
  }
  .sp-breadcrumb-trail {
    font-size: 13px; color: ${T.textMuted};
    display: flex; gap: 6px; align-items: center; min-width: 0; flex-wrap: wrap;
  }
  .sp-breadcrumb-trail a { color: ${T.textMuted}; text-decoration: none; }
  .sp-breadcrumb-trail a:hover { color: ${T.gray900}; }
  .sp-breadcrumb-trail .current {
    color: ${T.text}; font-weight: 700;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 180px;
  }
  .sp-breadcrumb-actions { display: flex; gap: 8px; align-items: center; flex-shrink: 0; }
  .sp-link-btn {
    display: flex; align-items: center; gap: 6px;
    font-size: 13px; font-weight: 600; color: ${T.textMuted};
    background: none; border: none; cursor: pointer; font-family: inherit;
    min-height: 36px; padding: 0 6px; border-radius: 8px;
  }
  .sp-link-btn:hover { color: ${T.gray900}; background: ${T.gray100}; }
  .sp-more-menu {
    position: absolute; top: calc(100% + 8px); right: 0;
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 12px;
    box-shadow: ${T.shadow}, 0 12px 32px rgba(0,0,0,.1); padding: 6px;
    min-width: 170px; z-index: 150;
  }
  .sp-more-menu-item {
    display: flex; align-items: center; gap: 8px; width: 100%;
    padding: 10px 12px; border-radius: 8px; border: none; background: none;
    font-size: 13px; font-weight: 600; color: ${T.text}; cursor: pointer;
    font-family: inherit; text-align: left; min-height: 42px;
  }
  .sp-more-menu-item svg { color: ${T.textMuted}; flex-shrink: 0; }
  .sp-more-menu-item:hover { background: ${T.gray100}; }
  .sp-more-menu-item.danger { color: #dc2626; }
  .sp-more-menu-item.danger svg { color: #dc2626; }
  .sp-more-menu-item.danger:hover { background: #fef2f2; }

  /* ── COVER ── */
  .sp-cover-wrap { max-width: 1180px; margin: 12px auto 0; padding: 0 20px; }
  /* Standard shop banner: ~3:1 marketplace cover (desktop ~320px) */
  .sp-cover {
    position: relative;
    width: 100%;
    height: clamp(200px, 26vw, 340px);
    min-height: 200px;
    max-height: 340px;
    border-radius: 22px;
    overflow: hidden;
    background: var(--theme-cover);
    box-shadow: ${T.shadow};
  }
  .sp-cover img {
    width: 100%; height: 100%; object-fit: cover; object-position: center;
    display: block;
  }
  /* Bottom-gradient scrim over the cover image — always visible so the
     banner reads as designed, subtle enough not to muddy the photo. */
  .sp-cover-theme-glow {
    position: absolute; inset: 0; pointer-events: none;
    background: linear-gradient(to top, rgba(0,0,0,.5) 0%, transparent 60%);
  }

  /* ── SHOP HEADER CARD ── */
  .sp-shophead {
    max-width: 1180px; margin: 0 auto; padding: 0 20px;
    position: relative;
  }
  .sp-shophead-inner {
    background: ${T.white};
    border: 1px solid ${T.border};
    border-top: 3px solid var(--theme);
    border-radius: 16px;
    padding: 20px 22px 20px 168px;
    margin-top: -56px;
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
    box-shadow: ${T.shadow};
  }
  .sp-logo-frame {
    position: absolute;
    left: 22px;
    top: -36px;
    width: 116px; height: 116px;
    border-radius: 16px;
    background: ${T.white};
    border: 1px solid ${T.border};
    padding: 6px;
    box-shadow: 0 6px 20px rgba(0,0,0,0.1);
  }
  .sp-verified-pill {
    position: absolute;
    top: -28px; left: 50%; transform: translateX(-50%);
    background: var(--theme);
    color: var(--theme-on);
    font-size: 10.5px; font-weight: 700;
    padding: 3px 10px; border-radius: 10px;
    white-space: nowrap;
  }
  .sp-logo-img { width: 100%; height: 100%; border-radius: 11px; object-fit: cover; }
  .sp-shop-info { flex: 1; min-width: 200px; }
  .sp-shop-name-row { display: flex; align-items: center; gap: 8px; }
  .sp-shop-name {
    font-family: 'Sora', Inter, sans-serif;
    font-size: clamp(18px, 3vw, 24px); font-weight: 800; color: ${T.text}; letter-spacing: -0.4px;
  }
  .sp-shop-tagline { font-size: 13.5px; color: ${T.textMuted}; margin-top: 4px; line-height: 1.45; }
  .sp-shop-tags { display: flex; gap: 8px; margin-top: 10px; flex-wrap: wrap; align-items: center; }
  .sp-tag-pill {
    background: ${T.gray100}; border: 1px solid ${T.border};
    font-size: 12px; font-weight: 600; color: ${T.textMuted};
    padding: 4px 10px; border-radius: 999px;
  }
  .sp-shop-loc { font-size: 12.5px; color: ${T.textMuted}; display: flex; align-items: center; gap: 4px; }
  .sp-shop-meta { font-size: 12.5px; color: ${T.textMuted}; margin-top: 8px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
  .sp-shop-meta .star { color: ${T.gold}; }

  .sp-shophead-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; flex-shrink: 0; }
  .sp-action-row { display: flex; gap: 8px; flex-wrap: wrap; }
  .sp-btn-msg, .sp-btn-follow {
    display: inline-flex; align-items: center; justify-content: center; gap: 7px;
    border-radius: 12px; padding: 10px 16px;
    font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer;
    transition: all 0.15s; min-height: 44px; touch-action: manipulation;
  }
  .sp-btn-msg { background: ${T.white}; border: 1.5px solid ${T.border}; color: ${T.text}; }
  .sp-btn-msg:hover { background: ${T.gray100}; border-color: var(--theme); color: var(--theme-dark); }
  .sp-btn-follow {
    background: var(--theme); border: none; color: var(--theme-on);
  }
  .sp-btn-follow:hover { filter: brightness(0.92); }
  .sp-btn-follow.following {
    background: var(--theme-light); color: var(--theme-dark);
    border: 1.5px solid var(--theme); filter: none;
  }
  .sp-btn-follow.following:hover { background: var(--theme-soft); }
  .sp-followers-count { font-size: 12.5px; color: ${T.textMuted}; display: flex; align-items: center; gap: 5px; }

  /* ── STATS BAR ── */
  .sp-stats {
    max-width: 1180px; margin: 14px auto 0; padding: 0 20px;
  }
  .sp-stats-inner {
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 14px;
    display: grid; grid-template-columns: repeat(4, 1fr);
    padding: 16px 0;
    box-shadow: ${T.shadow};
  }
  .sp-stat { display: flex; align-items: center; justify-content: center; gap: 12px; padding: 0 8px; }
  .sp-stat + .sp-stat { border-left: 1px solid ${T.border}; }
  .sp-stat-icon {
    width: 38px; height: 38px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .sp-stat-num { font-size: 17px; font-weight: 800; color: ${T.text}; line-height: 1.1; }
  .sp-stat-label { font-size: 11.5px; color: ${T.textMuted}; margin-top: 1px; }

  /* ── TABS ── */
  .sp-tabs {
    max-width: 1180px; margin: 16px auto 0; padding: 0 20px;
    display: flex; align-items: center; justify-content: space-between; gap: 12px;
    border-bottom: 1px solid ${T.border};
  }
  .sp-tabs-left {
    display: flex; gap: 4px; overflow-x: auto; scrollbar-width: none;
    -webkit-overflow-scrolling: touch; min-width: 0; flex: 1;
  }
  .sp-tabs-left::-webkit-scrollbar { display: none; }
  .sp-tab {
    font-size: 13.5px; font-weight: 600; color: ${T.textMuted};
    padding: 12px 12px; cursor: pointer; position: relative; background: none; border: none;
    font-family: inherit; white-space: nowrap; flex-shrink: 0; touch-action: manipulation;
  }
  .sp-tab.active { color: var(--theme-dark); font-weight: 800; }
  .sp-tab.active::after {
    content: ''; position: absolute; bottom: -1px; left: 8px; right: 8px; height: 2.5px;
    background: var(--theme); border-radius: 2px 2px 0 0;
  }
  .sp-tabs-right { display: flex; align-items: center; gap: 8px; padding-bottom: 8px; flex-shrink: 0; }
  .sp-shop-search {
    position: relative; display: none;
  }
  .sp-shop-search input {
    height: 36px; border-radius: 10px; border: 1.5px solid ${T.border};
    background: ${T.white}; padding: 0 34px 0 12px; font-size: 13px; font-family: inherit;
    outline: none; min-width: 160px; width: 180px;
  }
  .sp-shop-search input:focus { border-color: var(--theme); box-shadow: 0 0 0 3px var(--theme-ring); }
  .sp-shop-search-icon {
    position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
    color: ${T.textLight}; pointer-events: none;
  }
  .sp-sort-select {
    font-size: 12.5px; font-weight: 600; color: ${T.textMuted};
    border: 1px solid ${T.border}; border-radius: 10px; padding: 7px 10px;
    background: ${T.white}; font-family: inherit; cursor: pointer; min-height: 36px;
  }
  .sp-view-toggle { display: flex; gap: 4px; }
  .sp-view-btn {
    width: 36px; height: 36px; border-radius: 9px; border: 1px solid ${T.border};
    background: ${T.white}; display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: ${T.textMuted}; touch-action: manipulation;
  }
  .sp-view-btn.active {
    background: var(--theme); border-color: var(--theme); color: var(--theme-on);
  }

  /* ── MAIN LAYOUT ──
     Products | Sidebar share one row. Sidebar is sticky under the nav and
     scrolls internally so every card can be reached (never cut mid-panel). */
  .sp-main {
    max-width: 1180px;
    width: 100%;
    margin: 0 auto;
    padding: 16px 20px 64px;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(280px, 320px);
    column-gap: 24px;
    row-gap: 0;
    align-items: start;
    box-sizing: border-box;
  }
  .sp-main-col {
    min-width: 0;
    display: flex;
    flex-direction: column;
  }

  /* Grid cell for the right rail — full height of the products column */
  .sp-sidebar {
    min-width: 0;
    width: 100%;
    max-width: 320px;
    justify-self: stretch;
    align-self: start;
    position: relative;
  }

  /*
   * Sticky rail:
   * - sticks just below SokoNav
   * - height capped to remaining viewport so nothing is clipped off-screen
   * - overflow-y: auto so About / Policies / Owner are always reachable
   */
  .sp-sidebar-sticky {
    position: sticky;
    top: var(--sp-nav-offset);
    box-sizing: border-box;
    width: 100%;
    max-width: 100%;
    max-height: calc(100vh - var(--sp-nav-offset) - 16px);
    max-height: calc(100dvh - var(--sp-nav-offset) - 16px);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    -webkit-overflow-scrolling: touch;
    scrollbar-gutter: stable;
    scrollbar-width: thin;
    scrollbar-color: #9aa0a6 transparent;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 0 4px 12px 0;
    margin: 0;
  }
  .sp-sidebar-sticky::-webkit-scrollbar { width: 8px; }
  .sp-sidebar-sticky::-webkit-scrollbar-track {
    background: ${T.gray100};
    border-radius: 99px;
    margin: 6px 0;
  }
  .sp-sidebar-sticky::-webkit-scrollbar-thumb {
    background: #c4c7cc;
    border-radius: 99px;
    border: 2px solid ${T.gray100};
  }
  .sp-sidebar-sticky::-webkit-scrollbar-thumb:hover { background: #9aa0a6; }

  .sp-sidebar-sticky > * {
    flex: 0 0 auto;
    width: 100%;
    max-width: 100%;
    box-sizing: border-box;
  }
  .sp-sidebar-sticky .sp-side-card,
  .sp-sidebar-sticky .sp-feature-ad {
    margin: 0;
  }

  @media (max-width: 1100px) {
    .sp-main {
      grid-template-columns: minmax(0, 1fr) minmax(260px, 300px);
      column-gap: 18px;
      padding-left: 16px;
      padding-right: 16px;
    }
  }

  @media (max-width: 900px) {
    .sp-main {
      grid-template-columns: 1fr;
      padding: 12px 10px 28px;
      column-gap: 0;
      row-gap: 14px;
    }
    .sp-sidebar {
      order: 2;
      max-width: none;
      width: 100%;
      justify-self: stretch;
    }
    .sp-main-col { order: 1; }
    .sp-sidebar-sticky {
      position: static;
      top: auto;
      max-height: none;
      overflow: visible;
      scrollbar-gutter: auto;
      padding: 0;
      gap: 10px;
    }
  }

  .sp-grid {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px;
  }
  @media (max-width: 900px) {
    .sp-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  }
  .sp-listing-card {
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 14px; overflow: hidden;
    transition: transform 0.15s, box-shadow 0.15s; cursor: pointer;
    display: flex; flex-direction: column;
    box-shadow: ${T.shadow};
  }
  .sp-listing-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px rgba(0,0,0,0.1); }
  @media (hover: none) {
    .sp-listing-card:hover { transform: none; box-shadow: ${T.shadow}; }
  }
  .sp-listing-img-wrap {
    position: relative; aspect-ratio: 1; background: ${T.gray100};
    flex-shrink: 0; overflow: hidden;
  }
  .sp-listing-img-wrap img {
    width: 100%; height: 100%; object-fit: cover; display: block;
    transition: transform .35s ease;
  }
  .sp-listing-card:hover .sp-listing-img-wrap img { transform: scale(1.04); }
  @media (hover: none) {
    .sp-listing-card:hover .sp-listing-img-wrap img { transform: none; }
  }
  .sp-img-ph {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(145deg, #f1f3f4 0%, #e8eaed 100%);
    color: ${T.textLight}; font-size: 28px;
  }
  .sp-badge-stack {
    position: absolute; top: 8px; left: 8px;
    display: flex; flex-direction: column; gap: 5px; align-items: flex-start; z-index: 2;
  }
  .sp-featured-badge, .sp-cond-badge, .sp-sale-badge {
    font-size: 10px; font-weight: 800; padding: 3px 8px; border-radius: 6px;
    line-height: 1.2; letter-spacing: 0.01em;
  }
  .sp-featured-badge {
    background: var(--theme); color: var(--theme-on);
  }
  .sp-sale-badge { background: #ea4335; color: #fff; }
  .sp-cond-badge {
    background: rgba(255,255,255,.94); color: ${T.gray900};
    border: 1px solid rgba(0,0,0,.06); backdrop-filter: blur(6px);
  }
  .sp-fav-btn {
    position: absolute; top: 8px; right: 8px; z-index: 2;
    width: 34px; height: 34px; border-radius: 50%;
    background: rgba(255,255,255,0.95); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; color: ${T.textMuted};
    box-shadow: 0 2px 8px rgba(0,0,0,.08); touch-action: manipulation;
  }
  .sp-fav-btn:hover { color: #ea4335; }
  .sp-listing-body { padding: 10px 12px 12px; display: flex; flex-direction: column; gap: 4px; flex: 1; }
  .sp-listing-title {
    font-size: 13px; font-weight: 600; color: ${T.text}; line-height: 1.35;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    min-height: 2.6em;
  }
  .sp-listing-price {
    font-size: 14.5px; font-weight: 800; color: ${T.green}; margin-top: auto;
    display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;
  }
  .sp-listing-price .old {
    text-decoration: line-through; color: ${T.textLight}; font-size: 11.5px; font-weight: 500;
  }
  .sp-listing-price .sale { color: #ea4335; }
  .sp-listing-meta {
    font-size: 11.5px; color: ${T.textLight};
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
  }
  .sp-listing-meta .dot { width: 3px; height: 3px; border-radius: 50%; background: ${T.border}; }

  /* List view */
  .sp-list-view { display: flex; flex-direction: column; gap: 10px; }
  .sp-list-item {
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 14px;
    display: flex; gap: 14px; padding: 10px; cursor: pointer;
    box-shadow: ${T.shadow}; transition: box-shadow .15s; align-items: stretch;
  }
  .sp-list-item:hover { box-shadow: 0 8px 22px rgba(0,0,0,.08); }
  .sp-list-thumb {
    width: 108px; height: 108px; border-radius: 12px; overflow: hidden;
    background: ${T.gray100}; flex-shrink: 0; position: relative;
  }
  .sp-list-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .sp-list-body { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 4px; padding: 2px 4px 2px 0; }
  .sp-list-body .sp-listing-title { min-height: 0; -webkit-line-clamp: 2; }
  .sp-list-price-row { margin-top: auto; display: flex; align-items: center; justify-content: space-between; gap: 8px; }
  @media (max-width: 600px) {
    .sp-list-thumb { width: 88px; height: 88px; border-radius: 10px; }
    .sp-list-item { gap: 10px; padding: 8px; }
  }

  .sp-products-head {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    margin: 0 0 12px;
    min-height: 28px;
  }
  .sp-products-head h3 {
    font-family: 'Sora', Inter, sans-serif;
    font-size: 15px; font-weight: 800; color: ${T.text}; margin: 0;
    line-height: 1.2;
  }
  .sp-products-count { font-size: 12.5px; color: ${T.textMuted}; font-weight: 500; }

  .sp-empty-products {
    text-align: center; padding: 48px 20px;
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 16px;
    box-shadow: ${T.shadow};
  }
  .sp-empty-products .icon {
    width: 56px; height: 56px; border-radius: 16px; margin: 0 auto 14px;
    background: ${T.gray100}; display: flex; align-items: center; justify-content: center;
    color: ${T.textMuted};
  }
  .sp-empty-products h3 { font-size: 16px; font-weight: 800; color: ${T.text}; margin: 0 0 6px; }
  .sp-empty-products p { font-size: 13.5px; color: ${T.textMuted}; margin: 0 0 16px; line-height: 1.45; }
  .sp-empty-cta {
    display: inline-flex; align-items: center; gap: 7px;
    background: var(--theme); color: var(--theme-on); border: none; border-radius: 12px;
    padding: 12px 18px; font-size: 13.5px; font-weight: 800; font-family: inherit;
    cursor: pointer; min-height: 44px;
  }
  .sp-empty-cta:hover { filter: brightness(0.94); }
  .sp-theme-bar {
    height: 3px; width: 100%;
    background: var(--theme);
    opacity: .85;
  }

  .sp-skel-grid {
    display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 14px;
  }
  @media (max-width: 900px) {
    .sp-skel-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  }
  .sp-skel-card {
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 14px; overflow: hidden;
  }
  .sp-skel-img { aspect-ratio: 1; background: linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%); background-size: 800px 100%; animation: sp-shimmer 1.4s infinite; }
  .sp-skel-line { height: 12px; border-radius: 6px; margin: 10px 12px; background: linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%); background-size: 800px 100%; animation: sp-shimmer 1.4s infinite; }
  @keyframes sp-shimmer {
    0% { background-position: -800px 0; }
    100% { background-position: 800px 0; }
  }

  .sp-viewall {
    margin-top: 16px; width: 100%;
    background: ${T.white}; border: 1.5px solid ${T.border}; border-radius: 12px;
    padding: 13px; font-size: 13.5px; font-weight: 700; color: ${T.text};
    display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; font-family: inherit;
    min-height: 48px; touch-action: manipulation;
  }
  .sp-viewall:hover { background: ${T.gray100}; border-color: ${T.gray900}; }

  /* ── FEATURE PRODUCT AD ── */
  .sp-feature-ad {
    position: relative;
    border-radius: 16px;
    padding: 16px 14px 14px;
    margin: 0;
    overflow: hidden;
    background: linear-gradient(155deg, #0f172a 0%, #1e293b 48%, #3d2a08 100%);
    border: 1px solid rgba(249,171,0,.28);
    box-shadow: 0 8px 28px rgba(15,23,42,.22), 0 0 0 1px rgba(255,255,255,.04) inset;
    color: #fff;
    box-sizing: border-box;
  }
  .sp-feature-ad::before {
    content: '';
    position: absolute; top: -40px; right: -30px;
    width: 120px; height: 120px; border-radius: 50%;
    background: radial-gradient(circle, rgba(249,171,0,.35) 0%, transparent 70%);
    pointer-events: none;
  }
  .sp-feature-ad-badge {
    display: inline-flex; align-items: center; gap: 5px;
    background: linear-gradient(135deg, ${T.gold}, #e09800);
    color: #1a0a00;
    font-size: 10px; font-weight: 900; letter-spacing: 0.04em; text-transform: uppercase;
    padding: 4px 10px; border-radius: 999px; margin-bottom: 10px;
    box-shadow: 0 2px 10px rgba(249,171,0,.35);
  }
  .sp-feature-ad h4 {
    font-family: 'Sora', Inter, sans-serif;
    font-size: 15px; font-weight: 800; margin: 0 0 6px; letter-spacing: -0.02em;
    position: relative;
  }
  .sp-feature-ad p {
    font-size: 12.5px; line-height: 1.5; margin: 0 0 14px;
    color: rgba(255,255,255,.68); position: relative;
  }
  .sp-feature-ad-price {
    display: flex; align-items: baseline; gap: 6px; margin-bottom: 12px; position: relative;
  }
  .sp-feature-ad-price strong {
    font-size: 18px; font-weight: 900; color: ${T.gold}; letter-spacing: -0.03em;
  }
  .sp-feature-ad-price span { font-size: 11.5px; color: rgba(255,255,255,.55); font-weight: 600; }
  .sp-feature-ad-perks {
    list-style: none; margin: 0 0 14px; padding: 0; position: relative;
  }
  .sp-feature-ad-perks li {
    display: flex; align-items: center; gap: 8px;
    font-size: 12px; color: rgba(255,255,255,.78); font-weight: 500;
    margin-bottom: 6px;
  }
  .sp-feature-ad-perks li svg { flex-shrink: 0; color: ${T.gold}; }
  .sp-feature-ad-btn {
    width: 100%; min-height: 44px; border: none; border-radius: 12px;
    background: linear-gradient(135deg, ${T.gold}, #e09800);
    color: #1a0a00; font-size: 13.5px; font-weight: 800; font-family: inherit;
    cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 7px;
    box-shadow: 0 4px 14px rgba(249,171,0,.35); touch-action: manipulation;
    position: relative;
  }
  .sp-feature-ad-btn:hover { filter: brightness(1.05); }
  .sp-feature-ad-btn:disabled { opacity: .65; cursor: not-allowed; filter: none; }
  .sp-feature-ad-note {
    margin-top: 10px; font-size: 11px; color: rgba(255,255,255,.45);
    text-align: center; position: relative; line-height: 1.4;
    word-break: break-word;
  }
  .sp-feature-ad h4,
  .sp-feature-ad p {
    overflow-wrap: anywhere;
  }

  /* Feature product picker sheet */
  .sp-feature-sheet-overlay {
    position: fixed; inset: 0; z-index: 320;
    background: rgba(10,15,20,.5); backdrop-filter: blur(3px);
    display: flex; align-items: flex-end; justify-content: center;
    animation: sp-fadeIn .15s ease;
  }
  .sp-feature-sheet {
    width: 100%; max-width: 480px;
    max-height: min(78dvh, 640px);
    background: ${T.white}; border-radius: 20px 20px 0 0;
    box-shadow: 0 -8px 32px rgba(0,0,0,.18);
    display: flex; flex-direction: column;
    animation: spSheetUp .28s cubic-bezier(.22,1,.36,1);
    overflow: hidden;
  }
  @keyframes spSheetUp {
    from { transform: translateY(100%); opacity: .6; }
    to { transform: translateY(0); opacity: 1; }
  }
  @media (min-width: 640px) {
    .sp-feature-sheet-overlay { align-items: center; padding: 24px; }
    .sp-feature-sheet {
      border-radius: 18px; max-height: min(72vh, 560px);
      animation: sp-fadeIn .18s ease;
    }
  }
  .sp-feature-sheet-handle {
    width: 40px; height: 4px; border-radius: 99px; background: ${T.border};
    margin: 10px auto 0; flex-shrink: 0;
  }
  .sp-feature-sheet-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 14px 18px 10px; border-bottom: 1px solid ${T.border}; flex-shrink: 0;
  }
  .sp-feature-sheet-head h3 {
    font-family: 'Sora', Inter, sans-serif;
    font-size: 16px; font-weight: 800; margin: 0;
  }
  .sp-feature-sheet-close {
    width: 40px; height: 40px; border-radius: 12px; border: 1px solid ${T.border};
    background: ${T.gray100}; display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: ${T.text};
  }
  .sp-feature-sheet-sub {
    padding: 10px 18px 0; font-size: 12.5px; color: ${T.textMuted}; line-height: 1.4; flex-shrink: 0;
  }
  .sp-feature-sheet-list {
    overflow-y: auto; padding: 12px 14px 20px; flex: 1;
    -webkit-overflow-scrolling: touch;
  }
  .sp-feature-pick {
    display: flex; align-items: center; gap: 12px;
    padding: 10px; border-radius: 12px; border: 1.5px solid ${T.border};
    background: ${T.white}; margin-bottom: 8px; cursor: pointer; text-align: left;
    width: 100%; font-family: inherit; transition: border-color .12s, background .12s;
  }
  .sp-feature-pick:hover { border-color: ${T.gold}; background: #fffbeb; }
  .sp-feature-pick:disabled { opacity: .55; cursor: not-allowed; }
  .sp-feature-pick-thumb {
    width: 52px; height: 52px; border-radius: 10px; overflow: hidden;
    background: ${T.gray100}; flex-shrink: 0;
  }
  .sp-feature-pick-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .sp-feature-pick-info { flex: 1; min-width: 0; }
  .sp-feature-pick-title {
    font-size: 13.5px; font-weight: 700; color: ${T.text};
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .sp-feature-pick-meta { font-size: 12px; color: ${T.textMuted}; margin-top: 2px; }
  .sp-feature-pick-action {
    flex-shrink: 0; font-size: 12px; font-weight: 800; color: #1a0a00;
    background: linear-gradient(135deg, ${T.gold}, #e09800);
    padding: 8px 12px; border-radius: 9px; white-space: nowrap;
  }
  .sp-feature-pick.is-featured .sp-feature-pick-action {
    background: ${T.gray100}; color: ${T.textMuted};
  }
  /* ── SIDEBAR ── */
  .sp-side-card {
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 14px; padding: 18px;
    margin: 0; box-shadow: ${T.shadow};
  }
  .sp-side-title {
    font-family: 'Sora', Inter, sans-serif;
    font-size: 14px; font-weight: 800; color: ${T.text}; margin-bottom: 12px;
  }
  .sp-about-text { font-size: 12.5px; color: ${T.textMuted}; line-height: 1.6; margin-bottom: 14px; }
  .sp-about-row {
    display: flex; align-items: center; gap: 9px;
    font-size: 12.5px; color: ${T.textMuted}; margin-bottom: 9px;
  }
  .sp-about-row svg { flex-shrink: 0; color: ${T.textMuted}; }
  .sp-social-row { display: flex; gap: 10px; margin-top: 12px; flex-wrap: wrap; }
  .sp-social-icon {
    width: 36px; height: 36px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    text-decoration: none; transition: transform 0.15s, box-shadow 0.15s;
  }
  .sp-social-icon:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.15); }

  .sp-policy-row {
    display: flex; align-items: flex-start; gap: 9px;
    font-size: 12.5px; color: ${T.text}; margin-bottom: 11px; font-weight: 500; line-height: 1.4;
  }
  .sp-policy-row svg { color: ${T.textMuted}; flex-shrink: 0; margin-top: 2px; }
  .sp-policy-link {
    font-size: 12.5px; font-weight: 700; color: ${T.gray900};
    display: flex; align-items: center; gap: 4px; cursor: pointer; margin-top: 4px;
  }
  .sp-policy-edit-btn {
    font-size: 11.5px; font-weight: 700; color: var(--theme-dark);
    background: var(--theme-light); border: none; border-radius: 8px;
    padding: 5px 10px; cursor: pointer; font-family: inherit;
  }
  .sp-policy-edit-btn:hover { filter: brightness(0.96); }

  .sp-owner-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .sp-owner-avatar { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; background: ${T.gray100}; }
  .sp-owner-name-row { display: flex; align-items: center; gap: 6px; }
  .sp-owner-name { font-size: 13.5px; font-weight: 700; color: ${T.text}; }
  .sp-owner-tag { font-size: 10px; font-weight: 700; color: ${T.gray900}; background: ${T.gray100}; padding: 2px 7px; border-radius: 6px; }
  .sp-owner-sub { font-size: 11.5px; color: ${T.textMuted}; margin-top: 2px; line-height: 1.4; }
  .sp-msg-owner-btn {
    width: 100%; padding: 11px; border-radius: 12px; border: 1.5px solid ${T.border};
    background: ${T.white}; font-size: 13px; font-weight: 700; color: ${T.text};
    display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; font-family: inherit;
    min-height: 44px; touch-action: manipulation;
  }
  .sp-msg-owner-btn:hover { background: var(--theme-light); border-color: var(--theme); color: var(--theme-dark); }

  /* ── SIMILAR SHOPS (sticky under nav) ── */
  .sp-similar-wrap {
    position: sticky;
    top: var(--sp-nav-offset);
    z-index: 35;
    margin-top: 8px;
    background: rgba(248, 249, 250, 0.96);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-top: 1px solid ${T.border};
    border-bottom: 1px solid ${T.border};
    box-shadow: 0 8px 24px rgba(0,0,0,.06);
  }
  .sp-similar {
    max-width: 1180px;
    margin: 0 auto;
    padding: 14px 20px 16px;
  }
  .sp-similar-head {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    margin-bottom: 12px;
  }
  .sp-similar-head h3 {
    font-family: 'Sora', Inter, sans-serif;
    font-size: 15px; font-weight: 800; color: ${T.text}; margin: 0;
  }
  .sp-similar-head .sp-similar-all {
    font-size: 13px; font-weight: 700; color: var(--theme-dark, ${T.green});
    cursor: pointer; white-space: nowrap; background: none; border: none;
    font-family: inherit; padding: 0;
  }
  .sp-similar-head .sp-similar-all:hover { text-decoration: underline; }
  .sp-similar-grid {
    display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px;
  }
  @media (max-width: 900px) {
    .sp-similar-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  }
  .sp-similar-card {
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 14px;
    padding: 12px; display: flex; align-items: center; gap: 12px; cursor: pointer;
    transition: box-shadow 0.15s, transform 0.15s; box-shadow: ${T.shadow};
  }
  .sp-similar-card:hover { box-shadow: 0 8px 22px rgba(0,0,0,0.08); transform: translateY(-1px); }
  @media (hover: none) {
    .sp-similar-card:hover { transform: none; box-shadow: ${T.shadow}; }
  }
  .sp-similar-avatar {
    width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 800; color: ${T.white}; overflow: hidden;
    background: #111;
  }
  .sp-similar-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .sp-similar-info { flex: 1; min-width: 0; }
  .sp-similar-name {
    font-size: 13.5px; font-weight: 700; color: ${T.text};
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .sp-similar-cat { font-size: 11.5px; color: ${T.textMuted}; margin-top: 2px; }
  .sp-similar-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 5px; gap: 6px; }
  .sp-similar-followers { font-size: 11px; color: ${T.textLight}; }
  .sp-similar-rating { font-size: 11.5px; font-weight: 700; color: ${T.text}; display: flex; align-items: center; gap: 3px; }
  .sp-similar-rating .star { color: ${T.gold}; }

  /* Horizontal scroll on very small screens so cards stay full */
  @media (max-width: 600px) {
    .sp-similar-grid {
      display: flex;
      gap: 10px;
      overflow-x: auto;
      padding-bottom: 4px;
      scrollbar-width: none;
      -webkit-overflow-scrolling: touch;
    }
    .sp-similar-grid::-webkit-scrollbar { display: none; }
    .sp-similar-card {
      flex: 0 0 min(78vw, 280px);
      max-width: min(78vw, 280px);
    }
  }

  /* Sticky mobile CTA bar (visitors) */
  .sp-mobile-cta {
    display: none;
  }

  /* mobile shop layout */
  @media (max-width: 900px) {
    .sp-root {
      padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
    }
    .sp-root.has-sticky-cta {
      padding-bottom: calc(148px + env(safe-area-inset-bottom, 0px));
    }

    .sp-breadcrumb {
      padding: 8px 12px 0;
      gap: 6px;
    }
    .sp-breadcrumb-trail {
      font-size: 12px;
      gap: 4px;
    }
    .sp-breadcrumb-trail .hide-sm { display: none; }
    .sp-breadcrumb-trail .current { max-width: 42vw; font-size: 12.5px; }
    .sp-share-label { display: none; }
    .sp-link-btn {
      min-height: 40px; min-width: 40px;
      padding: 0 10px; font-size: 12.5px;
      background: ${T.white}; border: 1px solid ${T.border};
    }

    .sp-cover-wrap { padding: 0 10px; margin-top: 6px; }
    .sp-cover {
      height: clamp(160px, 42vw, 220px);
      min-height: 160px;
      max-height: 220px;
      border-radius: 16px;
    }
    /* Cover edit pill always visible on touch (no hover) */
    .sp-cover-overlay {
      opacity: 1 !important;
      bottom: 10px; right: 10px;
    }
    .sp-cover-overlay-btn {
      padding: 8px 14px; font-size: 12px; border-radius: 999px;
      min-height: 36px;
    }
    .sp-logo-overlay {
      opacity: 1 !important;
      background: rgba(0,0,0,.35) !important;
    }
    .sp-logo-overlay-btn { padding: 5px 8px; font-size: 10px; }

    .sp-shophead { padding: 0 10px; }
    .sp-shophead-inner {
      padding: 48px 12px 12px;
      margin-top: -36px;
      border-radius: 14px;
      flex-direction: column;
      align-items: stretch;
      gap: 12px;
    }
    .sp-logo-frame {
      left: 12px; top: -26px;
      width: 68px; height: 68px;
      border-radius: 14px; padding: 3px;
    }
    .sp-logo-img { border-radius: 11px; }
    .sp-verified-pill {
      top: -20px; font-size: 9px; padding: 2px 7px;
    }
    .sp-shop-info { min-width: 0; width: 100%; }
    .sp-shop-name { font-size: 17px; line-height: 1.25; }
    .sp-shop-tagline {
      font-size: 12.5px;
      display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;
    }
    .sp-shop-tags { margin-top: 8px; gap: 6px; }
    .sp-tag-pill { font-size: 11px; padding: 3px 9px; }
    .sp-shop-meta { font-size: 12px; margin-top: 6px; gap: 5px; }
    .sp-shop-meta .meta-joined { display: none; }
    .sp-shop-meta .meta-followers-inline { display: inline !important; }

    /* Desktop action row hidden; sticky bar used instead for visitors */
    .sp-shophead-right.visitor-actions { display: none; }
    .sp-shophead-right.owner-actions {
      width: 100%; align-items: stretch; display: flex;
    }
    .sp-owner-bar {
      width: 100%;
      display: grid;
      grid-template-columns: 1.2fr 1fr 1fr;
      gap: 6px;
    }
    .sp-owner-btn {
      flex: none; justify-content: center; min-height: 42px;
      padding: 8px 6px; font-size: 12px; border-radius: 11px;
    }
    .sp-owner-btn .owner-btn-label { display: none; }
    .sp-owner-btn.primary .owner-btn-label { display: inline; }
    .sp-owner-btn.primary { grid-column: span 1; }

    .sp-stats { padding: 0 10px; margin-top: 10px; }
    .sp-stats-inner {
      grid-template-columns: repeat(2, 1fr);
      padding: 0;
      border-radius: 12px;
    }
    .sp-stat {
      padding: 12px 10px;
      justify-content: flex-start;
      gap: 8px;
      min-width: 0;
    }
    .sp-stat-icon { width: 34px; height: 34px; border-radius: 9px; }
    .sp-stat:nth-child(odd) { border-right: 1px solid ${T.border}; }
    .sp-stat:nth-child(1), .sp-stat:nth-child(2) { border-bottom: 1px solid ${T.border}; }
    .sp-stat + .sp-stat { border-left: none; }
    .sp-stat:nth-child(even) { padding-left: 12px; }
    .sp-stat-num { font-size: 14.5px; }
    .sp-stat-label { font-size: 11px; }

    /* Sticky product tabs — sit below SokoNav (~100px mobile) */
    .sp-tabs {
      padding: 0;
      margin-top: 12px;
      flex-wrap: wrap;
      position: sticky;
      top: 100px;
      z-index: 40;
      background: rgba(248,249,250,.94);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid ${T.border};
      padding-top: 2px;
    }
    .sp-tabs-left {
      width: 100%;
      padding: 0 6px;
      gap: 0;
      border-bottom: 1px solid transparent;
    }
    .sp-tab {
      padding: 12px 12px;
      font-size: 13px;
      min-height: 44px;
    }
    .sp-tabs-right {
      width: 100%;
      padding: 8px 10px 10px;
      justify-content: flex-start;
      flex-wrap: wrap;
      gap: 8px;
      background: ${T.offwhite};
    }
    .sp-shop-search { display: block; flex: 1 1 100%; }
    .sp-shop-search input {
      width: 100%; min-width: 0; font-size: 16px; height: 42px;
      border-radius: 11px;
    }
    .sp-sort-select {
      flex: 1 1 auto; min-width: 0; max-width: none;
      height: 40px; font-size: 12px; padding: 0 8px;
    }
    .sp-view-toggle { margin-left: auto; }
    .sp-view-btn { width: 40px; height: 40px; }

    .sp-products-head { margin-bottom: 10px; }
    .sp-products-head h3 { font-size: 14px; }
    .sp-products-count { font-size: 11.5px; }

    .sp-grid { gap: 8px; }
    .sp-listing-card { border-radius: 12px; }
    .sp-listing-body { padding: 8px 8px 10px; gap: 3px; }
    .sp-listing-title {
      font-size: 12px; min-height: 2.5em; line-height: 1.3;
    }
    .sp-listing-price { font-size: 13px; }
    .sp-listing-meta { font-size: 10.5px; }
    .sp-fav-btn { width: 30px; height: 30px; top: 6px; right: 6px; }
    .sp-badge-stack { top: 6px; left: 6px; gap: 4px; }
    .sp-featured-badge, .sp-cond-badge, .sp-sale-badge {
      font-size: 9px; padding: 2px 6px;
    }
    .sp-cond-badge { display: none; }

    .sp-side-card { padding: 14px; border-radius: 12px; }
    .sp-desktop-sidebar-title { font-size: 13.5px; }

    .sp-similar-wrap {
      /* sit under sticky tabs (~100px) when both stick on mobile */
      top: calc(var(--sp-nav-offset) + 0px);
    }
    .sp-root.has-sticky-cta .sp-similar-wrap {
      /* keep above mobile Message/Follow + bottom nav */
      margin-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
    }
    .sp-similar { padding: 12px 12px 14px; }
    .sp-similar-head h3 { font-size: 14px; }
    .sp-similar-card { padding: 10px; border-radius: 12px; gap: 10px; }
    .sp-similar-avatar { width: 42px; height: 42px; border-radius: 10px; }
    .sp-similar-name { font-size: 12.5px; }
    .sp-similar-cat { font-size: 11px; }

    .sp-empty-products { padding: 36px 16px; border-radius: 14px; }
    .sp-viewall { min-height: 46px; font-size: 13px; border-radius: 11px; }

    /* Sticky bottom Message / Follow */
    .sp-mobile-cta {
      display: flex;
      position: fixed;
      left: 0; right: 0;
      bottom: calc(64px + env(safe-area-inset-bottom, 0px));
      z-index: 90;
      gap: 8px;
      padding: 10px 12px;
      background: rgba(255,255,255,.96);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-top: 1px solid ${T.border};
      box-shadow: 0 -4px 20px rgba(0,0,0,.06);
    }
    .sp-mobile-cta .sp-btn-msg,
    .sp-mobile-cta .sp-btn-follow {
      flex: 1;
      min-height: 46px;
      border-radius: 12px;
      font-size: 14px;
    }

    .sp-verify-banner-wrap { padding: 0 10px !important; margin-top: 10px !important; }
    .sp-verify-banner-inner {
      flex-direction: column !important;
      align-items: stretch !important;
      padding: 14px !important;
      gap: 12px !important;
    }
    .sp-verify-benefits { display: none !important; }
  }

  @media (min-width: 901px) {
    .sp-shop-search { display: block; }
    .sp-mobile-cta { display: none !important; }
  }

  @media (max-width: 600px) {
    .sp-owner-bar {
      grid-template-columns: 1fr 1fr;
    }
    .sp-owner-btn.primary { grid-column: 1 / -1; }
    .sp-owner-btn .owner-btn-label { display: inline; }
  }

  @media (max-width: 380px) {
    .sp-listing-meta { display: none; }
    .sp-shop-tagline { -webkit-line-clamp: 1; }
    .sp-stat-icon { display: none; }
  }

  /* rating tooltip */
  .sp-rating-tip {
    position: absolute;
    bottom: calc(100% + 12px);
    left: 50%;
    transform: translateX(-50%) translateY(6px);
    min-width: 210px;
    background: linear-gradient(160deg, #1b3a1f 0%, #0f2412 100%);
    color: #fff;
    padding: 14px 16px;
    border-radius: 14px;
    font-size: 12px;
    line-height: 1.55;
    white-space: normal;
    box-shadow: 0 12px 32px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.07);
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.18s ease, transform 0.18s ease;
    z-index: 50;
    pointer-events: none;
  }
  .sp-rating-tip::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 50%;
    transform: translateX(-50%);
    width: 0; height: 0;
    border-left: 7px solid transparent;
    border-right: 7px solid transparent;
    border-top: 7px solid #0f2412;
  }
  .sp-rating-tip-stars {
    display: flex; align-items: center; gap: 8px;
    margin-bottom: 8px; padding-bottom: 8px;
    border-bottom: 1px solid rgba(255,255,255,0.12);
  }
  .sp-rating-tip-score {
    font-size: 18px; font-weight: 800; color: ${T.gold};
    letter-spacing: -0.3px;
  }
  .sp-rating-tip-wrap:hover .sp-rating-tip,
  .sp-rating-tip-wrap:focus .sp-rating-tip {
    opacity: 1;
    visibility: visible;
    transform: translateX(-50%) translateY(0);
  }

  .sp-loading, .sp-notfound {
    display: flex; align-items: center; justify-content: center;
    height: 60vh; flex-direction: column; gap: 12px; color: ${T.textMuted};
  }

  .sp-cover-overlay {
    position: absolute; bottom: 14px; right: 14px;
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.2s; cursor: pointer; z-index: 2;
  }
  .sp-cover-wrap:hover .sp-cover-overlay { opacity: 1; }
  .sp-cover-overlay:focus-within { opacity: 1; }
  .sp-cover-overlay-btn {
    background: rgba(255,255,255,0.92); border: none; border-radius: 999px;
    padding: 9px 16px; font-size: 13px; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; gap: 7px; color: #0d1b0e;
    box-shadow: 0 2px 10px rgba(0,0,0,0.22);
    backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
  }
  .sp-logo-overlay {
    position: absolute; inset: 0; border-radius: 16px;
    background: rgba(0,0,0,0.45);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.2s; cursor: pointer;
  }
  .sp-logo-frame:hover .sp-logo-overlay { opacity: 1; }
  .sp-logo-overlay-btn {
    background: rgba(255,255,255,0.92); border: none; border-radius: 8px;
    padding: 6px 12px; font-size: 11px; font-weight: 700; cursor: pointer; color: #0d1b0e;
  }

  /* ── OWNER ACTION BAR (replaces Follow/Message when owner views own shop) ── */
  .sp-owner-bar { display: flex; gap: 8px; flex-wrap: wrap; }
  .sp-owner-btn {
    display: inline-flex; align-items: center; gap: 6px;
    border-radius: 12px; padding: 10px 14px;
    font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer;
    border: 1.5px solid ${T.border}; background: ${T.white}; color: ${T.text};
    transition: all 0.15s; min-height: 42px; touch-action: manipulation;
  }
  .sp-owner-btn:hover { background: ${T.gray100}; border-color: var(--theme); }
  .sp-owner-btn.primary {
    background: var(--theme); color: var(--theme-on); border-color: var(--theme);
  }
  .sp-owner-btn.primary:hover { filter: brightness(0.92); }
  .sp-owner-badge {
    display: inline-flex; align-items: center; gap: 5px;
    background: #fff8e1; color: ${T.goldDark};
    font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px;
    margin-bottom: 8px;
  }

  /* ── EDIT SHOP DRAWER ── */
  .sp-drawer-overlay {
    position: fixed; inset: 0; background: rgba(10,15,20,0.5);
    z-index: 300; display: flex; justify-content: flex-end;
    animation: sp-fadeIn 0.15s ease; backdrop-filter: blur(2px);
  }
  @keyframes sp-fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sp-slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
  .sp-drawer {
    width: 440px; max-width: 100vw; height: 100%;
    background: ${T.white}; overflow-y: auto;
    animation: sp-slideIn 0.25s cubic-bezier(0.16,1,0.3,1);
    padding: 0 0 calc(24px + env(safe-area-inset-bottom, 0px));
    -webkit-overflow-scrolling: touch;
  }
  @media (max-width: 480px) { .sp-drawer { width: 100vw; border-radius: 0; } }
  .sp-drawer-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 16px 18px; border-bottom: 1px solid ${T.border};
    position: sticky; top: 0; background: ${T.white}; z-index: 2;
  }
  .sp-drawer-head h2 {
    font-family: 'Sora', Inter, sans-serif;
    font-size: 17px; font-weight: 800; color: ${T.text}; margin: 0;
  }
  .sp-drawer-close {
    width: 40px; height: 40px; border-radius: 12px; border: 1px solid ${T.border}; background: ${T.gray100};
    display: flex; align-items: center; justify-content: center; cursor: pointer; color: ${T.text};
  }
  .sp-drawer-body { padding: 18px 18px; }
  .sp-d-field { margin-bottom: 18px; }
  .sp-d-label { display: block; font-size: 12.5px; font-weight: 700; color: ${T.text}; margin-bottom: 6px; }
  .sp-d-input, .sp-d-select, .sp-d-textarea {
    width: 100%; border: 1.5px solid ${T.border}; border-radius: 12px; padding: 11px 12px;
    font-size: 16px; font-family: inherit; color: ${T.text}; background: ${T.white};
  }
  .sp-d-input:focus, .sp-d-select:focus, .sp-d-textarea:focus {
    outline: none; border-color: var(--theme); box-shadow: 0 0 0 3px var(--theme-ring);
  }
  .sp-d-textarea { resize: vertical; min-height: 64px; font-size: 14px; }
  .sp-d-logo-row { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
  .sp-d-logo-preview {
    width: 56px; height: 56px; border-radius: 50%; background: ${T.gray100};
    display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; color: ${T.gray900};
    overflow: hidden; flex-shrink: 0; border: 2px solid ${T.border};
  }
  .sp-d-logo-preview img { width: 100%; height: 100%; object-fit: cover; }
  .sp-d-upload-btn {
    font-size: 12px; font-weight: 700; color: ${T.gray900}; background: ${T.gray100};
    border: none; border-radius: 8px; padding: 8px 13px; cursor: pointer; font-family: inherit;
  }
  .sp-d-save-btn {
    width: 100%; background: var(--theme); color: var(--theme-on); border: none; border-radius: 12px;
    padding: 13px; font-size: 14px; font-weight: 800; font-family: inherit; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px;
    min-height: 48px;
  }
  .sp-d-save-btn:hover { filter: brightness(0.94); }
  .sp-theme-swatch-row { display: flex; gap: 10px; }
  .sp-theme-swatch {
    width: 32px; height: 32px; border-radius: 50%; border: 2px solid #fff;
    cursor: pointer; padding: 0; display: flex; align-items: center; justify-content: center;
    box-shadow: 0 0 0 1px rgba(0,0,0,.08); transition: transform .12s, box-shadow .12s;
  }
  .sp-theme-swatch:hover { transform: scale(1.06); }
  .sp-theme-swatch.active { box-shadow: 0 0 0 2px var(--swatch, #0F9D58); }
  .sp-d-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .sp-d-msg { border-radius: 9px; padding: 9px 12px; font-size: 12.5px; font-weight: 500; margin-bottom: 14px; }
  .sp-d-msg-success { background: var(--theme-light); color: var(--theme-dark); }
  .sp-d-msg-error { background: #fef2f2; color: #b91c1c; }
  .sp-d-spinner {
    width: 15px; height: 15px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff;
    animation: ss-drawer-spin 0.6s linear infinite;
  }
  @keyframes ss-drawer-spin { to { transform: rotate(360deg); } }
`

const Icon = {
  Search: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>,
  Grid: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  List: () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3" y2="6"/><line x1="3" y1="12" x2="3" y2="12"/><line x1="3" y1="18" x2="3" y2="18"/></svg>,
  Heart: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>,
  Pin: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 6-9 13-9 13s-9-7-9-13a9 9 0 1 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>,
  Star: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>,
  Users: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  Msg: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  Plus: () => <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
Check: () => <svg width="20" height="20" viewBox="0 0 24 24"><path fill="#16a34a" d="M12 0a4 4 0 0 1 3.2 1.6 4 4 0 0 1 3.6 1 4 4 0 0 1 1 3.6A4 4 0 0 1 21.4 9.4a4 4 0 0 1 0 5.2A4 4 0 0 1 19.8 17.8a4 4 0 0 1-1 3.6 4 4 0 0 1-3.6 1A4 4 0 0 1 12 24a4 4 0 0 1-3.2-1.6 4 4 0 0 1-3.6-1 4 4 0 0 1-1-3.6A4 4 0 0 1 2.6 14.6a4 4 0 0 1 0-5.2A4 4 0 0 1 4.2 6.2a4 4 0 0 1 1-3.6 4 4 0 0 1 3.6-1A4 4 0 0 1 12 0Z"/><path d="m7.5 12.5 3 3 6-7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  Check2: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,
  X: () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>,
  ListingsIcon: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#7c4dff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>,
  FollowersIcon: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#22a05e" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/></svg>,
  RatingIcon: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="#f9a825"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>,
  ResponseIcon: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#2196f3" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>,
  Truck: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"/><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>,
  Refresh: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/><path d="M3 21v-5h5"/></svg>,
  Lock: () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>,
  ChevronRight: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>,
  Phone: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  Mail: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>,
  Clock: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>,
}

function initials(name) {
  if (!name) return '?'
  return name.trim().split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

export default function ShopPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [shop, setShop] = useState(null)
  const [owner, setOwner] = useState(null)
  const [currentUserId, setCurrentUserId] = useState(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [avatarError, setAvatarError] = useState(false)
  const [isFollowing, setIsFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('listings')
  const [viewMode, setViewMode] = useState('grid')
  const [listings, setListings] = useState([])
  const [allListings, setAllListings] = useState([])
  const [listingsLoading, setListingsLoading] = useState(false)
  const [sortBy, setSortBy] = useState('latest')
  const [filterCategory, setFilterCategory] = useState('all')
  const [navSearch, setNavSearch] = useState('')
  const [notifCount, setNotifCount] = useState(0)
  const [shopLocalSearch, setShopLocalSearch] = useState('')
  const [productsVisible, setProductsVisible] = useState(12)
  const PRODUCTS_PAGE = 12

  const [reviews, setReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [myReview, setMyReview] = useState(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewHoverRating, setReviewHoverRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewMsg, setReviewMsg] = useState(null)

  const [featureSheetOpen, setFeatureSheetOpen] = useState(false)
  const [featuringId, setFeaturingId] = useState(null)
  const [featureToast, setFeatureToast] = useState(null)
  const rootRef = useRef(null)

  // Keep sidebar sticky offset = real SokoNav height so nothing sits under the nav
  useEffect(() => {
    function measureNav() {
      const nav = document.querySelector('.soko-nav-glass')
      if (!nav || !rootRef.current) return
      const h = Math.ceil(nav.getBoundingClientRect().height)
      // Small gap under nav so the rail isn’t flush against the header
      rootRef.current.style.setProperty('--sp-nav-offset', `${Math.max(h + 8, 72)}px`)
    }
    measureNav()
    window.addEventListener('resize', measureNav)
    const nav = document.querySelector('.soko-nav-glass')
    let ro
    if (nav && typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(measureNav)
      ro.observe(nav)
    }
    return () => {
      window.removeEventListener('resize', measureNav)
      ro?.disconnect()
    }
  }, [loading, shop?.id])

  useEffect(() => {
    let active = true
    async function fetchShop() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (active) setCurrentUserId(user?.id ?? null)

        if (user?.id) {
          const [{ data: meData }, { data: myShop }, { count }] = await Promise.all([
            supabase.from('profiles').select('full_name, avatar_url, email, account_type').eq('id', user.id).maybeSingle(),
            supabase.from('shops').select('slug').eq('owner_id', user.id).maybeSingle(),
            supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
          ])
          if (active) {
            setCurrentUser({
              ...user,
              full_name: meData?.full_name || null,
              avatar_url: meData?.avatar_url || null,
              email: meData?.email || user.email,
              account_type: meData?.account_type,
              shop_slug: myShop?.slug || null,
            })
            setNotifCount(count || 0)
          }
        }

        // Prefer slug; fall back to id so /shop/:id still works from public profiles
        let shopData = null
        let shopErr = null
        {
          const bySlug = await supabase
            .from('shops')
            .select('*')
            .eq('slug', slug)
            .maybeSingle()
          shopData = bySlug.data
          shopErr = bySlug.error
          if (!shopData && !shopErr) {
            const byId = await supabase
              .from('shops')
              .select('*')
              .eq('id', slug)
              .maybeSingle()
            shopData = byId.data
            shopErr = byId.error
          }
        }

        if (shopErr) console.error('[ShopPage] shop fetch error:', shopErr)
        if (!active) return
        setShop(shopData)

        if (shopData?.owner_id) {
          const { data: ownerData, error: ownerErr } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('id', shopData.owner_id)
            .maybeSingle()
          if (ownerErr) console.error('[ShopPage] owner fetch error:', ownerErr)
          if (active) setOwner(ownerData)
        }

        if (shopData?.id && user?.id) {
          const { data: followRow, error: followErr } = await supabase
            .from('shop_followers')
            .select('id')
            .eq('shop_id', shopData.id)
            .eq('user_id', user.id)
            .maybeSingle()
          if (followErr) console.error('[ShopPage] follow check error:', followErr)
          if (active) setIsFollowing(!!followRow)
        }
      if (shopData?.id) {
          setListingsLoading(true)
          // Live listings may be `published` or `active` (same as Home).
          // Also include seller's products without shop_id so shops always show inventory.
          const LIVE = ['published', 'active']
          const LISTING_SELECT =
            'id, title, price, price_type, images, city, district, promo_badge, flash_sale_price, flash_sale_expires_at, category, condition, featured, is_featured, featured_until, created_at, seller_id, shop_id, description, availability_status'
          let listingData = []
          let listErr = null
          if (shopData.owner_id) {
            const res = await supabase
              .from('listings')
              .select(LISTING_SELECT)
              .or(`shop_id.eq.${shopData.id},seller_id.eq.${shopData.owner_id}`)
              .in('status', LIVE)
              .order('created_at', { ascending: false })
              .limit(120)
            listingData = res.data || []
            listErr = res.error
          } else {
            const res = await supabase
              .from('listings')
              .select(LISTING_SELECT)
              .eq('shop_id', shopData.id)
              .in('status', LIVE)
              .order('created_at', { ascending: false })
              .limit(120)
            listingData = res.data || []
            listErr = res.error
          }
          if (listErr) console.error('[ShopPage] listings fetch error:', listErr)
          // Dedupe by id (or() can theoretically overlap)
          const seen = new Set()
          const unique = []
          for (const row of listingData) {
            if (seen.has(row.id)) continue
            seen.add(row.id)
            unique.push(row)
          }
          if (active) {
            setListings(unique)
            setAllListings(unique)
            setListingsLoading(false)
            // Keep shop listing_count in sync for the stats bar when DB column is stale
            if (unique.length > 0) {
              setShop(s => s ? { ...s, listing_count: Math.max(s.listing_count || 0, unique.length) } : s)
            }
          }
        }
      } catch (err) {
        console.error('[ShopPage] fetchShop failed:', err)
      } finally {
        if (active) setLoading(false)
      }
    }
    fetchShop()
    return () => { active = false }
  }, [slug])

  // Reset progressive product window when filters / shop change
  useEffect(() => {
    setProductsVisible(PRODUCTS_PAGE)
  }, [shopLocalSearch, filterCategory, sortBy, shop?.id])

  // Lock body scroll while feature picker is open
  useEffect(() => {
    if (!featureSheetOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e) => { if (e.key === 'Escape') setFeatureSheetOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [featureSheetOpen])

  async function handleFeatureListing(listing) {
    if (!listing?.id || featuringId) return
    if (!currentUserId) {
      navigate('/login')
      return
    }
    if (isListingFeatured(listing)) {
      setFeatureToast('This product is already featured')
      setTimeout(() => setFeatureToast(null), 3000)
      return
    }
    setFeaturingId(listing.id)
    try {
      const result = await featureExistingListing({
        listing: {
          ...listing,
          seller_id: listing.seller_id || currentUserId,
          status: listing.status || 'published',
        },
        user: currentUser || { id: currentUserId },
        profileName: currentUser?.full_name || shop?.name,
      })
      if (result?.redirecting) return
      if (result?.free) {
        const until = new Date()
        until.setDate(until.getDate() + FEATURED_DURATION_DAYS)
        setAllListings(prev => prev.map(l =>
          l.id === listing.id
            ? { ...l, is_featured: true, featured: true, featured_until: until.toISOString() }
            : l
        ))
        setListings(prev => prev.map(l =>
          l.id === listing.id
            ? { ...l, is_featured: true, featured: true, featured_until: until.toISOString() }
            : l
        ))
        setFeatureToast('Product featured on the homepage!')
        setTimeout(() => setFeatureToast(null), 3500)
        setFeatureSheetOpen(false)
      }
    } catch (e) {
      const msg = e?.message || 'Could not feature product'
      console.error('[ShopPage] feature failed', e)
      setFeatureToast(msg)
      setTimeout(() => setFeatureToast(null), 5000)
      window.alert(msg)
    } finally {
      setFeaturingId(null)
    }
  }

  async function handleFollowToggle() {
    if (!currentUserId) { navigate('/login'); return }
    if (!shop?.id || followLoading) return
    setFollowLoading(true)

    if (isFollowing) {
      await supabase.from('shop_followers').delete().eq('shop_id', shop.id).eq('user_id', currentUserId)
      setIsFollowing(false)
      setShop(s => ({ ...s, follower_count: Math.max((s.follower_count || 1) - 1, 0) }))
    } else {
      await supabase.from('shop_followers').insert({ shop_id: shop.id, user_id: currentUserId })
      setIsFollowing(true)
      setShop(s => ({ ...s, follower_count: (s.follower_count || 0) + 1 }))
    }
    setFollowLoading(false)
  }

  async function fetchReviews() {
    if (!shop?.id) return
    setReviewsLoading(true)
    try {
      const { data, error } = await supabase
        .from('shop_reviews')
        .select('id, rating, comment, created_at, user_id')
        .eq('shop_id', shop.id)
        .order('created_at', { ascending: false })
      if (error) throw error

      let withProfiles = data || []
      const userIds = [...new Set(withProfiles.map(r => r.user_id))]
      if (userIds.length > 0) {
        const { data: profilesData } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url')
          .in('id', userIds)
        const profileMap = {}
        profilesData?.forEach(p => { profileMap[p.id] = p })
        withProfiles = withProfiles.map(r => ({ ...r, profiles: profileMap[r.user_id] || null }))
      }

      setReviews(withProfiles)
      if (currentUserId) {
        const mine = withProfiles.find(r => r.user_id === currentUserId)
        if (mine) {
          setMyReview(mine)
          setReviewRating(mine.rating)
          setReviewComment(mine.comment || '')
        }
      }
    } catch (err) {
      console.error('fetchReviews error:', err)
    } finally {
      setReviewsLoading(false)
    }
  }

  async function handleSubmitReview() {
    if (!currentUserId) { navigate('/login'); return }
    if (reviewRating < 1) { setReviewMsg({ type: 'error', text: 'Please select a star rating.' }); return }
    setReviewSubmitting(true)
    setReviewMsg(null)
    try {
      const { error } = await supabase.from('shop_reviews').upsert({
        shop_id: shop.id,
        user_id: currentUserId,
        rating: reviewRating,
        comment: reviewComment.trim() || null,
      }, { onConflict: 'shop_id,user_id' })
      if (error) throw error
      setReviewMsg({ type: 'success', text: myReview ? 'Review updated!' : 'Thanks for your review!' })
      await fetchReviews()
      // Refresh shop rating/review_count locally since the trigger updates the DB
      const { data: freshShop } = await supabase.from('shops').select('rating, review_count').eq('id', shop.id).maybeSingle()
      if (freshShop) setShop(s => ({ ...s, rating: freshShop.rating, review_count: freshShop.review_count }))
    } catch (err) {
      setReviewMsg({ type: 'error', text: err.message || 'Could not submit review.' })
    } finally {
      setReviewSubmitting(false)
    }
  }

  function handleMessageOwner() {
    if (!currentUserId) { navigate('/login'); return }
    if (!shop?.owner_id) return
    navigate(`/chat/${shop.owner_id}/${shop.id}?src=shop`, {
      state: {
        source: 'shop',
        prefillMessage: `Hi! I'm interested in your shop "${shop.name}".`,
      },
    })
  }

  const isOwner = !!currentUserId && !!shop?.owner_id && currentUserId === shop.owner_id
  const [similarShops, setSimilarShops] = useState([])

  useEffect(() => {
    if (!shop?.id) return
    async function fetchSimilarShops() {
      const { data } = await supabase
        .from('shops')
        .select('id, name, slug, logo_url, category, district, city, follower_count, rating, review_count, is_verified')
        .eq('is_active', true)
        .neq('id', shop.id)
        .eq('category', shop.category || '')
        .limit(4)
      if (data && data.length > 0) {
        setSimilarShops(data)
      } else {
        const { data: fallback } = await supabase
          .from('shops')
          .select('id, name, slug, logo_url, category, district, city, follower_count, rating, review_count, is_verified')
          .eq('is_active', true)
          .neq('id', shop.id)
          .order('follower_count', { ascending: false })
          .limit(4)
        setSimilarShops(fallback || [])
      }
    }
    fetchSimilarShops()
  }, [shop?.id])

  useEffect(() => {
    if (tab === 'reviews' && shop?.id) fetchReviews()
  }, [tab, shop?.id])

  // ── Edit Shop drawer ──
  const logoInputRef = useRef(null)
  const coverInputRef = useRef(null)
  const listingsRef = useRef(null)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editCategory, setEditCategory] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editDistrict, setEditDistrict] = useState('')
  const [editCity, setEditCity] = useState('')
  const [editWhatsapp, setEditWhatsapp] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editAddress, setEditAddress] = useState('')
  const [editFacebook, setEditFacebook] = useState('')
  const [editInstagram, setEditInstagram] = useState('')
  const [editTiktok, setEditTiktok] = useState('')
  const [editX, setEditX] = useState('')
  const [editWebsite, setEditWebsite] = useState('')
  const [editLogoFile, setEditLogoFile] = useState(null)
  const [editLogoPreview, setEditLogoPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState(null)
  const [shareToast, setShareToast] = useState(null)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const [blockToast, setBlockToast] = useState(false)
  const [verifyModalOpen, setVerifyModalOpen] = useState(false)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportDetails, setReportDetails] = useState('')
  const [reportSubmitting, setReportSubmitting] = useState(false)
  const [reportMsg, setReportMsg] = useState(null)

  // ── Policy editor ──
  const [policyDrawerOpen, setPolicyDrawerOpen] = useState(false)
  const [editPolicyDelivery, setEditPolicyDelivery] = useState('')
  const [editPolicyReturns, setEditPolicyReturns] = useState('')
  const [editPolicyPayment, setEditPolicyPayment] = useState('')
  const [policySaving, setPolicySaving] = useState(false)
  const [policySaveMsg, setPolicySaveMsg] = useState(null)
  const [editPolicyCustom, setEditPolicyCustom] = useState([])
  const [newCustomPolicy, setNewCustomPolicy] = useState('')

  function openPolicyEditor() {
    setEditPolicyDelivery(shop.policy_delivery || '')
    setEditPolicyReturns(shop.policy_returns || '')
    setEditPolicyPayment(shop.policy_payment || '')
    setEditPolicyCustom(Array.isArray(shop.policy_custom) ? shop.policy_custom : [])
    setNewCustomPolicy('')
    setPolicySaveMsg(null)
    setPolicyDrawerOpen(true)
  }

  function addCustomPolicy() {
    const text = newCustomPolicy.trim()
    if (!text) return
    setEditPolicyCustom(list => [...list, { label: text }])
    setNewCustomPolicy('')
  }

  function removeCustomPolicy(index) {
    setEditPolicyCustom(list => list.filter((_, i) => i !== index))
  }

  async function handleSavePolicies() {
    if (!shop) return
    setPolicySaving(true)
    setPolicySaveMsg(null)
    try {
      const { error } = await supabase.from('shops').update({
        policy_delivery: editPolicyDelivery.trim() || null,
        policy_returns: editPolicyReturns.trim() || null,
        policy_payment: editPolicyPayment.trim() || null,
        policy_custom: editPolicyCustom,
        updated_at: new Date().toISOString(),
      }).eq('id', shop.id)
      if (error) throw error
      setShop(s => ({
        ...s,
        policy_delivery: editPolicyDelivery.trim() || null,
        policy_returns: editPolicyReturns.trim() || null,
        policy_payment: editPolicyPayment.trim() || null,
        policy_custom: editPolicyCustom,
      }))
      setPolicySaveMsg({ type: 'success', text: 'Policies updated.' })
    } catch (err) {
      setPolicySaveMsg({ type: 'error', text: err.message || 'Something went wrong.' })
    } finally {
      setPolicySaving(false)
    }
  }

  function openEditDrawer() {
    setEditName(shop.name || '')
    setEditCategory(shop.category || '')
    setEditDescription(shop.description || '')
    setEditDistrict(shop.district || '')
    setEditCity(shop.city || '')
    setEditWhatsapp(shop.whatsapp || '')
    setEditPhone(shop.phone || '')
    setEditAddress(shop.address || '')
    setEditFacebook(shop.social_facebook || '')
    setEditInstagram(shop.social_instagram || '')
    setEditTiktok(shop.social_tiktok || '')
    setEditX(shop.social_x || '')
    setEditWebsite(shop.social_website || '')
    setEditLogoFile(null)
    setEditLogoPreview(shop.logo_url || null)
    setSaveMsg(null)
    setDrawerOpen(true)
  }

  function handleEditLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setEditLogoFile(file)
    setEditLogoPreview(URL.createObjectURL(file))
  }

  async function handleCoverChange(e) {
    const file = e.target.files?.[0]
    if (!file || !currentUserId) return
    try {
      const ext = file.name.split('.').pop()
      // shop-images RLS write policy requires the first path segment to equal
      // auth.uid() (see 20260713_008_storage.sql) — store under <uid>/covers/…
      const path = `${currentUserId}/covers/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('shop-images').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
      const { error } = await supabase.from('shops').update({ cover_url: data.publicUrl }).eq('id', shop.id)
      if (error) throw error
      setShop(s => ({ ...s, cover_url: data.publicUrl }))
    } catch (err) {
      console.error('Cover upload failed:', err)
    }
  }

  async function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file || !currentUserId) return
    try {
      const ext = file.name.split('.').pop()
      // Same <uid>/ prefix as covers — matches the shop-images RLS write policy.
      const path = `${currentUserId}/logos/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('shop-images').upload(path, file)
      if (upErr) throw upErr
      const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
      const { error } = await supabase.from('shops').update({ logo_url: data.publicUrl }).eq('id', shop.id)
      if (error) throw error
      setShop(s => ({ ...s, logo_url: data.publicUrl }))
      setEditLogoPreview(data.publicUrl)
    } catch (err) {
      console.error('Logo upload failed:', err)
    }
  }

  function handleCopyLink() {
    const url = `${window.location.origin}/shop/${shop.slug}`
    navigator.clipboard.writeText(url)
      .then(() => setShareToast('Link copied to clipboard!'))
      .catch(() => setShareToast('Could not copy \u2014 copy from your address bar.'))
    setTimeout(() => setShareToast(null), 2500)
    setMoreMenuOpen(false)
  }

  function openReportModal() {
    setReportReason('')
    setReportDetails('')
    setReportMsg(null)
    setReportModalOpen(true)
    setMoreMenuOpen(false)
  }

  async function handleSubmitReport() {
    if (!currentUserId) { navigate('/login'); return }
    if (!reportReason) { setReportMsg({ type: 'error', text: 'Please select a reason.' }); return }
    setReportSubmitting(true)
    setReportMsg(null)
    try {
      const { error } = await supabase.from('shop_reports').insert({
        shop_id: shop.id,
        reporter_id: currentUserId,
        reason: reportReason,
        details: reportDetails.trim() || null,
      })
      if (error) throw error
      setReportMsg({ type: 'success', text: 'Report submitted. Our team will review it shortly.' })
      setTimeout(() => setReportModalOpen(false), 1800)
    } catch (err) {
      setReportMsg({ type: 'error', text: err.message || 'Could not submit report.' })
    } finally {
      setReportSubmitting(false)
    }
  }

  function handleBlockShop() {
    setMoreMenuOpen(false)
    const blocked = JSON.parse(localStorage.getItem('soko_blocked_shops') || '[]')
    if (!blocked.includes(shop.id)) {
      localStorage.setItem('soko_blocked_shops', JSON.stringify([...blocked, shop.id]))
    }
    setBlockToast(true)
    setTimeout(() => {
      setBlockToast(false)
      navigate('/shops')
    }, 2000)
  }

  async function handleDeleteShop() {
    if (!window.confirm(`Delete "${shop.name}" permanently? This cannot be undone.`)) return
    setMoreMenuOpen(false)
    try {
      const { error } = await supabase.from('shops').delete().eq('id', shop.id)
      if (error) throw error
      navigate('/shops')
    } catch (err) {
      setShareToast(err.message || 'Could not delete shop.')
      setTimeout(() => setShareToast(null), 3000)
    }
  }

  async function handleShareShop() {
    const url = `${window.location.origin}/shop/${shop.slug}`
    try {
      await navigator.clipboard.writeText(url)
      setShareToast('Shop link copied to clipboard!')
    } catch {
      setShareToast('Could not copy automatically \u2014 copy from your address bar.')
    }
    setTimeout(() => setShareToast(null), 2500)
  }

  async function handleSaveShop() {
    if (!shop) return
    setSaving(true)
    setSaveMsg(null)
    try {
      let logo_url = shop.logo_url
      if (editLogoFile) {
        const ext = editLogoFile.name.split('.').pop()
        // Same <uid>/ prefix as the main logo/cover handlers (shop-images RLS).
        const path = `${currentUserId}/logos/${crypto.randomUUID()}.${ext}`
        const { error: upErr } = await supabase.storage.from('shop-images').upload(path, editLogoFile)
        if (upErr) throw upErr
        const { data } = supabase.storage.from('shop-images').getPublicUrl(path)
        logo_url = data.publicUrl
      }

      const { error } = await supabase.from('shops').update({
        name: editName.trim(),
        category: editCategory,
        description: editDescription.trim() || null,
        district: editDistrict,
        city: editCity.trim() || null,
        whatsapp: editWhatsapp.trim(),
        phone: editPhone.trim() || null,
        address: editAddress.trim() || null,
        social_facebook: editFacebook.trim() || null,
        social_instagram: editInstagram.trim() || null,
        social_tiktok: editTiktok.trim() || null,
        social_x: editX.trim() || null,
        social_website: editWebsite.trim() || null,
        logo_url,
        updated_at: new Date().toISOString(),
      }).eq('id', shop.id)

      if (error) throw error

      setShop(s => ({
        ...s, name: editName, category: editCategory, description: editDescription,
        district: editDistrict, city: editCity, whatsapp: editWhatsapp,
        phone: editPhone, address: editAddress,
        social_facebook: editFacebook.trim() || null,
        social_instagram: editInstagram.trim() || null,
        social_tiktok: editTiktok.trim() || null,
        social_x: editX.trim() || null,
        social_website: editWebsite.trim() || null,
        logo_url,
      }))
      setSaveMsg({ type: 'success', text: 'Shop updated successfully.' })
    } catch (err) {
      setSaveMsg({ type: 'error', text: err.message || 'Something went wrong.' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="sp-root">
        <style>{css}</style>
        <style>{`
          @keyframes sp-shimmer {
            0%   { background-position: -800px 0; }
            100% { background-position: 800px 0; }
          }
          .sp-sk {
            background: linear-gradient(90deg, #f0f0f0 25%, #e8e8e8 50%, #f0f0f0 75%);
            background-size: 800px 100%;
            animation: sp-shimmer 1.4s infinite;
            border-radius: 10px;
          }
        `}</style>

        <SokoNav
          user={currentUser}
          notifCount={notifCount}
          search={navSearch}
          setSearch={setNavSearch}
          navigate={navigate}
          activePillar="shops"
          ctaLabel="Sell Now"
          onCta={() => navigate('/post')}
        />

        {/* Skeleton breadcrumb */}
        <div style={{ maxWidth: 1180, margin: '14px auto 0', padding: '0 20px', display: 'flex', gap: 8, alignItems: 'center' }}>
          {[60, 50, 100].map((w, i) => (
            <div key={i} className="sp-sk" style={{ width: w, height: 14 }} />
          ))}
        </div>

        {/* Skeleton cover */}
        <div style={{ maxWidth: 1180, margin: '12px auto 0', padding: '0 20px' }}>
          <div className="sp-sk" style={{ height: 'clamp(200px, 26vw, 340px)', minHeight: 200, borderRadius: 16 }} />
        </div>

        {/* Skeleton shop header card */}
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 20px' }}>
          <div style={{
            background: T.white, border: `1px solid ${T.border}`,
            borderRadius: 16, padding: '20px 22px 20px 168px',
            marginTop: -56, position: 'relative', display: 'flex',
            alignItems: 'flex-start', justifyContent: 'space-between', gap: 20,
            boxShadow: T.shadow,
          }}>
            {/* Logo skeleton */}
            <div className="sp-sk" style={{
              position: 'absolute', left: 22, top: -36,
              width: 116, height: 116, borderRadius: 16,
            }} />
            {/* Info skeleton */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div className="sp-sk" style={{ width: 200, height: 28 }} />
              <div className="sp-sk" style={{ width: 300, height: 14 }} />
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <div className="sp-sk" style={{ width: 90, height: 26, borderRadius: 8 }} />
                <div className="sp-sk" style={{ width: 120, height: 26, borderRadius: 8 }} />
              </div>
              <div className="sp-sk" style={{ width: 180, height: 13 }} />
            </div>
            {/* Buttons skeleton */}
            <div style={{ display: 'flex', gap: 10, flexShrink: 0 }}>
              <div className="sp-sk" style={{ width: 100, height: 40, borderRadius: 10 }} />
              <div className="sp-sk" style={{ width: 100, height: 40, borderRadius: 10 }} />
            </div>
          </div>
        </div>

        {/* Skeleton stats bar */}
        <div style={{ maxWidth: 1180, margin: '16px auto 0', padding: '0 24px' }}>
          <div style={{
            background: T.white, border: `1px solid ${T.border}`,
            borderRadius: 14, display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)', padding: '18px 0',
          }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                <div className="sp-sk" style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0 }} />
                <div>
                  <div className="sp-sk" style={{ width: 48, height: 18, marginBottom: 6 }} />
                  <div className="sp-sk" style={{ width: 60, height: 12 }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Skeleton tabs */}
        <div style={{ maxWidth: 1180, margin: '18px auto 0', padding: '0 24px', borderBottom: `1px solid ${T.border}`, display: 'flex', gap: 28, paddingBottom: 0 }}>
          {[80, 60, 100, 110].map((w, i) => (
            <div key={i} className="sp-sk" style={{ width: w, height: 14, marginBottom: 14 }} />
          ))}
        </div>

        {/* Skeleton product grid + sidebar */}
        <div style={{ maxWidth: 1180, margin: '20px auto 0', padding: '0 24px 60px', display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24 }}>
          {/* Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {[0,1,2,3,4,5].map(i => (
              <div key={i} style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
                <div className="sp-sk" style={{ width: '100%', aspectRatio: '1', borderRadius: 0 }} />
                <div style={{ padding: '10px 12px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="sp-sk" style={{ width: '85%', height: 13 }} />
                  <div className="sp-sk" style={{ width: '50%', height: 16 }} />
                  <div className="sp-sk" style={{ width: '60%', height: 11 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Sidebar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[140, 120, 130].map((h, i) => (
              <div key={i} style={{ background: T.white, border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
                <div className="sp-sk" style={{ width: '60%', height: 16, marginBottom: 14 }} />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div className="sp-sk" style={{ width: '100%', height: 13 }} />
                  <div className="sp-sk" style={{ width: '80%', height: 13 }} />
                  <div className="sp-sk" style={{ width: '70%', height: 13 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }
if (!shop) {
    return (
      <div className="sp-root">
        <style>{css}</style>
        <SokoNav
          user={currentUser}
          notifCount={notifCount}
          search={navSearch}
          setSearch={setNavSearch}
          navigate={navigate}
          activePillar="shops"
          ctaLabel="Sell Now"
          onCta={() => navigate('/post')}
        />
        <div className="sp-notfound">
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>Shop not found</div>
          <p style={{ fontSize: 13.5, color: T.textMuted, margin: '4px 0 12px' }}>This shop may have been removed or the link is wrong.</p>
          <button className="sp-link-btn" onClick={() => navigate('/shops')}>← Back to Shops</button>
        </div>
      </div>
    )
  }

  function getSortedFiltered() {
    let result = [...allListings]
    const q = shopLocalSearch.trim().toLowerCase()
    if (q) {
      result = result.filter(l =>
        l.title?.toLowerCase().includes(q) ||
        l.city?.toLowerCase().includes(q) ||
        l.category?.toLowerCase().includes(q)
      )
    }
    if (filterCategory !== 'all') {
      result = result.filter(l => l.category === filterCategory)
    }
    if (sortBy === 'price-low') result.sort((a, b) => (a.price || 0) - (b.price || 0))
    else if (sortBy === 'price-high') result.sort((a, b) => (b.price || 0) - (a.price || 0))
    else if (sortBy === 'latest') result.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    return result
  }
  const filteredListings = getSortedFiltered()
  const displayListings = filteredListings.slice(0, productsVisible)
  const hasMoreProducts = filteredListings.length > productsVisible
  const featureableListings = allListings.filter(l => !isListingFeatured(l))

  function formatPrice(item) {
    if (item.price_type === 'free' || item.price === 0) return { main: 'FREE', sale: null, old: null }
    const hasFlash = item.flash_sale_price != null && Number(item.flash_sale_price) > 0 &&
      (!item.flash_sale_expires_at || new Date(item.flash_sale_expires_at) > new Date())
    if (hasFlash) {
      return {
        main: `MK ${Number(item.flash_sale_price).toLocaleString()}`,
        sale: true,
        old: item.price != null ? `MK ${Number(item.price).toLocaleString()}` : null,
      }
    }
    return {
      main: item.price != null ? `MK ${Number(item.price).toLocaleString()}` : 'Price on request',
      sale: false,
      old: null,
    }
  }

  function promoLabel(item) {
    const now = new Date()
    const isFeatured = item.is_featured || item.featured ||
      (item.featured_until && new Date(item.featured_until) > now)
    if (isFeatured) return '⭐ Featured'
    const b = item.promo_badge
    if (!b || b === 'none') return null
    if (b === 'hot') return '🔥 Hot'
    if (b === 'sale') return 'Sale'
    if (b === 'new_in') return '🆕 New'
    if (b === 'limited') return 'Limited'
    if (b === 'featured') return '⭐ Featured'
    return null
  }

  function conditionLabel(c) {
    if (!c) return null
    const map = { new: 'New', like_new: 'Like new', used: 'Used', refurbished: 'Refurbished' }
    return map[c] || (c.charAt(0).toUpperCase() + c.slice(1).replace(/_/g, ' '))
  }

  const shopInitials = initials(shop.name)
  const listingCount = allListings.length || shop.listing_count || 0
  const followerCount = shop.follower_count ?? 0
  const activeTheme = resolveShopTheme(shop.theme)

  const showVisitorSticky = !isOwner && currentUserId !== shop?.owner_id

  async function applyShopTheme(nextTheme) {
    if (!shop?.id || !SHOP_THEMES[nextTheme]) return
    const prev = shop.theme
    setShop(s => ({ ...s, theme: nextTheme }))
    const { error } = await supabase.from('shops').update({ theme: nextTheme }).eq('id', shop.id)
    if (error) {
      console.error('Theme update failed:', error)
      setShop(s => ({ ...s, theme: prev }))
      alert(error.message || 'Could not update theme')
      return
    }
    setMoreMenuOpen(false)
  }

  return (
    <div
      ref={rootRef}
      className={`sp-root sp-theme-${activeTheme.id}${showVisitorSticky ? ' has-sticky-cta' : ''}`}
      style={{
        '--theme': activeTheme.color,
        '--theme-dark': activeTheme.dark,
        '--theme-light': activeTheme.light,
        '--theme-on': activeTheme.onAccent,
        '--theme-soft': activeTheme.soft,
        '--theme-ring': activeTheme.ring,
        '--theme-cover': activeTheme.cover,
      }}
    >
      <style>{css}</style>
      {blockToast && (
        <div style={{
          position: 'fixed', bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)',
          background: '#fff', color: T.text,
          padding: '12px 20px 12px 14px',
          borderRadius: 16, fontSize: 13.5, fontWeight: 600,
          boxShadow: '0 12px 40px rgba(13,31,15,0.18), 0 0 0 1px rgba(13,31,15,0.06)',
          zIndex: 999, display: 'flex', alignItems: 'center', gap: 10,
          animation: 'sp-fadeIn 0.18s ease', whiteSpace: 'nowrap',
          maxWidth: 'calc(100vw - 24px)',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, background: '#fef2f2',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>Shop blocked</div>
            <div style={{ fontSize: 11.5, fontWeight: 500, color: T.textMuted, marginTop: 1 }}>You won't see it in your feed</div>
          </div>
        </div>
      )}

      {featureToast && (
        <div style={{
          position: 'fixed', bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)',
          background: '#fff', color: T.text,
          padding: '12px 18px',
          borderRadius: 16, fontSize: 13.5, fontWeight: 600,
          boxShadow: '0 12px 40px rgba(0,0,0,0.14), 0 0 0 1px rgba(0,0,0,0.06)',
          zIndex: 999, display: 'flex', alignItems: 'center', gap: 10,
          animation: 'sp-fadeIn 0.18s ease',
          maxWidth: 'calc(100vw - 24px)',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, background: '#fff8e1',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: T.gold,
          }}>
            ⭐
          </div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, lineHeight: 1.3 }}>{featureToast}</div>
        </div>
      )}

      {shareToast && (
        <div style={{
          position: 'fixed', bottom: 'calc(96px + env(safe-area-inset-bottom, 0px))', left: '50%', transform: 'translateX(-50%)',
          background: '#fff', color: T.text,
          padding: '12px 20px 12px 14px',
          borderRadius: 16, fontSize: 13.5, fontWeight: 600,
          boxShadow: '0 12px 40px rgba(13,31,15,0.18), 0 0 0 1px rgba(13,31,15,0.06)',
          zIndex: 999, display: 'flex', alignItems: 'center', gap: 10,
          animation: 'sp-fadeIn 0.18s ease',
          whiteSpace: 'nowrap',
          maxWidth: 'calc(100vw - 24px)',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, background: T.greenLight,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
              <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>Link copied!</div>
            <div style={{ fontSize: 11.5, fontWeight: 500, color: T.textMuted, marginTop: 1 }}>Share it anywhere</div>
          </div>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.textLight} strokeWidth="2.5" strokeLinecap="round" style={{ marginLeft: 6, flexShrink: 0 }}>
            <polyline points="20 6 9 17 4 12"/>
          </svg>
        </div>
      )}

      <SokoNav
        user={currentUser}
        notifCount={notifCount}
        search={navSearch}
        setSearch={setNavSearch}
        navigate={navigate}
        activePillar="shops"
        ctaLabel={shop.owner_id === currentUserId ? 'Add Listing' : 'Sell Now'}
        onCta={() => navigate(shop.owner_id === currentUserId ? '/post' : '/post', { state: shop.owner_id === currentUserId ? { shopId: shop.id } : undefined })}
      />

      {/* ── BREADCRUMB ── */}
      <div className="sp-breadcrumb" style={{ position: 'relative', zIndex: 50 }}>
        <div className="sp-breadcrumb-trail">
          <Link to="/" className="hide-sm">Home</Link>
          <span className="hide-sm"><Icon.ChevronRight /></span>
          <Link to="/shops">Shops</Link>
          <Icon.ChevronRight />
          <span className="current">{shop.name}</span>
        </div>
        <div className="sp-breadcrumb-actions" style={{ position: 'relative' }}>
          <button type="button" className="sp-link-btn" onClick={handleShareShop} aria-label="Share shop">
            ↗ <span className="sp-share-label">Share</span>
          </button>
          <button type="button" className="sp-link-btn" onClick={() => setMoreMenuOpen(o => !o)} aria-label="More options">⋯</button>
          {moreMenuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 149 }} onClick={() => setMoreMenuOpen(false)} />
             <div className="sp-more-menu" style={{ minWidth: 200, padding: 6 }}>
                <button className="sp-more-menu-item" onClick={handleCopyLink} style={{ borderRadius: 8 }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                  Copy Link
                </button>
                {isOwner && (
                  <>
                    <div style={{ height: 1, background: T.border, margin: '4px 6px' }} />
                    <div style={{ padding: '8px 10px 10px' }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, color: T.textLight, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 }}>Shop Theme</div>
                      <div className="sp-theme-swatch-row">
                        {Object.values(SHOP_THEMES).map(opt => {
                          const active = activeTheme.id === opt.id
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              title={opt.label}
                              aria-label={`Theme ${opt.label}`}
                              aria-pressed={active}
                              className={`sp-theme-swatch${active ? ' active' : ''}`}
                              onClick={() => applyShopTheme(opt.id)}
                              style={{
                                background: opt.color,
                                '--swatch': opt.color,
                                color: opt.onAccent,
                              }}
                            >
                              {active && <Icon.Check2 />}
                            </button>
                          )
                        })}
                      </div>
                      <div style={{ fontSize: 11, color: T.textMuted, marginTop: 8 }}>
                        Active: <strong style={{ color: activeTheme.dark }}>{activeTheme.label}</strong>
                      </div>
                    </div>
                    <div style={{ height: 1, background: T.border, margin: '4px 6px' }} />
                  </>
                )}
                {!isOwner && (
                  <>
                    <button className="sp-more-menu-item" onClick={openReportModal}>
                      <Icon.ChevronRight /> Report Shop
                    </button>
                    <button className="sp-more-menu-item danger" onClick={handleBlockShop}>
                      <Icon.ChevronRight /> Block Shop
                    </button>
                  </>
                )}
                {isOwner && (
                  <button className="sp-more-menu-item danger" onClick={handleDeleteShop}>
                    <Icon.ChevronRight /> Delete Shop
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── COVER ── */}
      <div className="sp-cover-wrap">
        <div className="sp-cover">
          {shop.cover_url ? (
            <>
              <img src={shop.cover_url} alt="" />
              <div className="sp-cover-theme-glow" />
            </>
          ) : null}
          {isOwner && (
            <div className="sp-cover-overlay" onClick={() => coverInputRef.current?.click()}>
              <button type="button" className="sp-cover-overlay-btn">
                📷 {shop.cover_url ? 'Change Cover' : 'Add Cover'}
              </button>
              <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={handleCoverChange} />
            </div>
          )}
        </div>
      </div>

      {/* ── SHOP HEADER CARD ── */}
      <div className="sp-shophead">
        <div className="sp-shophead-inner">
          <div className="sp-logo-frame">
            {shop.is_verified && <div className="sp-verified-pill">Verified Shop</div>}
            {shop.logo_url ? (
              <img className="sp-logo-img" src={shop.logo_url} alt={shop.name} />
            ) : (
              <div className="sp-logo-img" style={{ background: activeTheme.light, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: activeTheme.dark }}>
                {shopInitials}
              </div>
            )}
            {isOwner && (
              <div className="sp-logo-overlay" onClick={() => logoInputRef.current?.click()}>
                <button className="sp-logo-overlay-btn">📷 Change</button>
                <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={handleLogoChange} />
              </div>
            )}
          </div>

          <div className="sp-shop-info">
            <div className="sp-shop-name-row">
              <div className="sp-shop-name">{shop.name}</div>
              {shop.is_verified && <Icon.Check />}
            </div>
            {shop.description && <div className="sp-shop-tagline">{shop.description}</div>}
            <div className="sp-shop-tags">
              {shop.category && <span className="sp-tag-pill">{shop.category}</span>}
              {(shop.city || shop.district) && (
                <span className="sp-shop-loc"><Icon.Pin /> {shop.city ? `${shop.city}, ` : ''}{shop.district || 'Malawi'}</span>
              )}
            </div>
            <div className="sp-shop-meta">
              {shop.rating ? (
                <>
                  <span className="star"><Icon.Star /></span>
                  <span>{shop.rating} ({shop.review_count || 0})</span>
                  <span>·</span>
                </>
              ) : (
                <span>No reviews yet</span>
              )}
              <span className="meta-joined">Joined {shop.created_at ? new Date(shop.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'recently'}</span>
              <span className="meta-followers-inline" style={{ display: 'none' }}>
                {followerCount >= 1000 ? `${(followerCount / 1000).toFixed(1)}K` : followerCount} followers
              </span>
            </div>
          </div>

          <div className={`sp-shophead-right ${isOwner ? 'owner-actions' : 'visitor-actions'}`}>
            {isOwner ? (
              <div className="sp-owner-bar">
                <button type="button" className="sp-owner-btn primary" onClick={() => navigate('/post', { state: { shopId: shop.id } })}>
                  <Icon.Plus /> <span className="owner-btn-label">Add Product</span>
                </button>
                <button type="button" className="sp-owner-btn" onClick={openEditDrawer}>
                  Edit<span className="owner-btn-label"> Shop</span>
                </button>
                <button type="button" className="sp-owner-btn" onClick={handleShareShop}>
                  Share<span className="owner-btn-label"> Shop</span>
                </button>
              </div>
            ) : (
              <>
                <div className="sp-action-row">
                  <button type="button" className="sp-btn-msg" onClick={handleMessageOwner}><Icon.Msg /> Message</button>
                  {currentUserId !== shop?.owner_id && (
                    <button
                      type="button"
                      className={`sp-btn-follow${isFollowing ? ' following' : ''}`}
                      onClick={handleFollowToggle}
                      disabled={followLoading}
                    >
                      {isFollowing ? 'Following' : 'Follow'}
                    </button>
                  )}
                </div>
                <div className="sp-followers-count"><Icon.Users /> {followerCount >= 1000 ? `${(followerCount/1000).toFixed(1)}K` : followerCount} followers</div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ── VERIFICATION BANNER (owner only, unverified) ── */}
      {isOwner && !shop.is_verified && (
        <div className="sp-verify-banner-wrap" style={{
          maxWidth: 1180, margin: '12px auto 0', padding: '0 24px',
        }}>
          <div className="sp-verify-banner-inner" style={{
            background: 'linear-gradient(135deg, #0f2412 0%, #1a3a20 50%, #0d1f2d 100%)',
            borderRadius: 14, padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 16,
            border: '1px solid rgba(255,255,255,0.08)',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            flexWrap: 'wrap',
          }}>
            {/* Icon */}
            <div style={{
              width: 42, height: 42, borderRadius: 12, flexShrink: 0,
              background: 'rgba(249,168,37,0.15)',
              border: '1px solid rgba(249,168,37,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f9a825" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                <polyline points="9 12 11 14 15 10"/>
              </svg>
            </div>

            {/* Text */}
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontSize: 13.5, fontWeight: 800, color: '#fff' }}>Get Soko Verified</span>
                <span style={{
                  background: 'rgba(249,168,37,0.2)', color: '#f9a825',
                  fontSize: 9.5, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
                  letterSpacing: 0.5, textTransform: 'uppercase',
                }}>Recommended</span>
              </div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5 }}>
                Verified shops get a badge, rank higher in search, and earn more buyer trust.
              </div>
            </div>

            {/* Benefits */}
            <div className="sp-verify-benefits" style={{
              display: 'flex', gap: 10, flexShrink: 0, flexWrap: 'wrap',
            }}>
              {[
                { icon: '✅', label: 'Verified badge' },
                { icon: '📈', label: 'Higher ranking' },
                { icon: '🔒', label: 'Buyer trust' },
              ].map(b => (
                <div key={b.label} style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 20, padding: '4px 10px',
                  fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 500,
                  whiteSpace: 'nowrap',
                }}>
                  <span style={{ fontSize: 10 }}>{b.icon}</span>{b.label}
                </div>
              ))}
            </div>

            {/* CTA */}
            <button
              onClick={() => setVerifyModalOpen(true)}
              style={{
                flexShrink: 0,
                background: 'linear-gradient(135deg, #f9a825, #e09800)',
                border: 'none', borderRadius: 10, padding: '10px 18px',
                fontSize: 13, fontWeight: 800, color: '#1a0a00',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
                boxShadow: '0 3px 12px rgba(249,168,37,0.35)',
                transition: 'all 0.15s', whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 5px 18px rgba(249,168,37,0.5)' }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = '0 3px 12px rgba(249,168,37,0.35)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              Apply for Verification
            </button>

            {/* Dismiss */}
            <button
              onClick={e => e.currentTarget.closest('div[style]').parentElement.style.display = 'none'}
              style={{
                flexShrink: 0, background: 'none', border: 'none',
                color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 4,
                fontSize: 18, lineHeight: 1,
              }}
              title="Dismiss"
            >×</button>
          </div>
        </div>
      )}

      {/* ── STATS BAR ── */}
      <div className="sp-stats">
        <div className="sp-stats-inner">
          <div className="sp-stat">
            <div className="sp-stat-icon" style={{ background: '#f1edff' }}><Icon.ListingsIcon /></div>
            <div>
              <div className="sp-stat-num">{listingCount}</div>
              <div className="sp-stat-label">Listings</div>
            </div>
          </div>
          <div className="sp-stat">
            <div className="sp-stat-icon" style={{ background: activeTheme.light }}><Icon.FollowersIcon /></div>
            <div>
              <div className="sp-stat-num">{followerCount >= 1000 ? `${(followerCount/1000).toFixed(1)}K` : followerCount}</div>
              <div className="sp-stat-label">Followers</div>
            </div>
          </div>
          <div className="sp-stat" style={{ cursor: shop.rating ? 'pointer' : 'default' }} onClick={() => shop.rating && setTab('reviews')}>
            <div className="sp-stat-icon" style={{ background: '#fef3e2' }}><Icon.RatingIcon /></div>
            <div>
              <div className="sp-stat-num">
                {shop.rating || '—'}
                {shop.rating > 0 && (
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: T.textMuted, marginLeft: 4 }}>
                    ({shop.review_count || 0})
                  </span>
                )}
              </div>
              <div className="sp-stat-label">Shop Rating</div>
            </div>
          </div>
          <div className="sp-stat">
            <div className="sp-stat-icon" style={{ background: shop.is_verified ? '#e3f2fd' : '#fff8e1' }}>
              {shop.is_verified
                ? <Icon.ResponseIcon />
                : <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#f9a825" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              }
            </div>
            <div>
              <div className="sp-stat-num" style={{ color: shop.is_verified ? T.text : '#f9a825', fontSize: 14 }}>
                {shop.is_verified ? 'Verified' : 'Unverified'}
              </div>
              <div className="sp-stat-label">Shop Status</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── TABS ── */}
      <div className="sp-tabs">
        <div className="sp-tabs-left">
          {['listings', 'about', 'reviews', 'policies'].map(t => (
            <button key={t} className={`sp-tab ${tab === t ? 'active' : ''}`} onClick={() => setTab(t)}>
              {t === 'listings' && 'Listings'}
              {t === 'about' && 'About'}
              {t === 'reviews' && `Reviews (${shop.review_count || 0})`}
              {t === 'policies' && 'Shop Policies'}
            </button>
          ))}
        </div>
        {tab === 'listings' && (
          <div className="sp-tabs-right">
            <div className="sp-shop-search">
              <input
                type="search"
                placeholder="Search this shop…"
                value={shopLocalSearch}
                onChange={e => {
                  setShopLocalSearch(e.target.value)
                  setTab('listings')
                }}
                enterKeyHint="search"
                autoComplete="off"
              />
              <span className="sp-shop-search-icon"><Icon.Search /></span>
            </div>
            <select
              className="sp-sort-select"
              value={filterCategory}
              onChange={e => setFilterCategory(e.target.value)}
            >
              <option value="all">All Categories</option>
              {[...new Set(allListings.map(l => l.category).filter(Boolean))].map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select
              className="sp-sort-select"
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
            >
              <option value="latest">Latest</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
            </select>
            <div className="sp-view-toggle">
              <button type="button" className={`sp-view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')} aria-label="Grid view"><Icon.Grid /></button>
              <button type="button" className={`sp-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')} aria-label="List view"><Icon.List /></button>
            </div>
          </div>
        )}
      </div>

      {/* ── MAIN ── */}
      <div className="sp-main">
        <div className="sp-main-col" ref={listingsRef}>
          {tab === 'listings' && (
            <>
              {listingsLoading ? (
                <div className="sp-skel-grid" aria-busy="true" aria-label="Loading products">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="sp-skel-card">
                      <div className="sp-skel-img" />
                      <div className="sp-skel-line" style={{ width: '80%' }} />
                      <div className="sp-skel-line" style={{ width: '45%', marginBottom: 14 }} />
                    </div>
                  ))}
                </div>
              ) : filteredListings.length === 0 ? (
                <div className="sp-empty-products">
                  <div className="icon">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
                    </svg>
                  </div>
                  <h3>
                    {shopLocalSearch || filterCategory !== 'all'
                      ? 'No matching products'
                      : isOwner ? 'No products yet' : 'No products listed yet'}
                  </h3>
                  <p>
                    {shopLocalSearch || filterCategory !== 'all'
                      ? 'Try a different search or clear filters.'
                      : isOwner
                        ? 'Add your first product so buyers can shop from this page.'
                        : 'Check back soon — this shop is still stocking up.'}
                  </p>
                  {isOwner && !shopLocalSearch && filterCategory === 'all' && (
                    <button
                      type="button"
                      className="sp-empty-cta"
                      onClick={() => navigate('/post', { state: { shopId: shop.id } })}
                    >
                      <Icon.Plus /> Add Product
                    </button>
                  )}
                  {(shopLocalSearch || filterCategory !== 'all') && (
                    <button
                      type="button"
                      className="sp-empty-cta"
                      style={{ background: T.white, color: T.gray900, border: `1.5px solid ${T.border}` }}
                      onClick={() => { setShopLocalSearch(''); setFilterCategory('all') }}
                    >
                      Clear filters
                    </button>
                  )}
                </div>
              ) : (
                <>
                  <div className="sp-products-head">
                    <h3>Products</h3>
                    <span className="sp-products-count">
                      Showing {displayListings.length} of {filteredListings.length}
                    </span>
                  </div>

                  {viewMode === 'list' ? (
                    <div className="sp-list-view">
                      {displayListings.map(item => {
                        const price = formatPrice(item)
                        const promo = promoLabel(item)
                        const cond = conditionLabel(item.condition)
                        const cover = Array.isArray(item.images) ? item.images[0] : null
                        return (
                          <div
                            key={item.id}
                            className="sp-list-item"
                            onClick={() => navigate(`/listing/${item.id}`)}
                            role="link"
                            tabIndex={0}
                            onKeyDown={e => { if (e.key === 'Enter') navigate(`/listing/${item.id}`) }}
                          >
                            <div className="sp-list-thumb">
                              {cover ? (
                                <img src={cover} alt="" loading="lazy" />
                              ) : (
                                <div className="sp-img-ph">📦</div>
                              )}
                              {promo && (
                                <div className="sp-badge-stack">
                                  <span className={promo.includes('Sale') || promo === 'Sale' ? 'sp-sale-badge' : 'sp-featured-badge'}>{promo}</span>
                                </div>
                              )}
                            </div>
                            <div className="sp-list-body">
                              <div className="sp-listing-title">{item.title}</div>
                              <div className="sp-listing-meta">
                                {item.city && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Icon.Pin /> {item.city}</span>}
                                {item.city && cond && <span className="dot" />}
                                {cond && <span>{cond}</span>}
                                {item.category && (
                                  <>
                                    {(item.city || cond) && <span className="dot" />}
                                    <span>{item.category}</span>
                                  </>
                                )}
                              </div>
                              <div className="sp-list-price-row">
                                <div className="sp-listing-price">
                                  {price.old && <span className="old">{price.old}</span>}
                                  <span className={price.sale ? 'sale' : ''}>{price.main}</span>
                                </div>
                                {shop.rating > 0 && (
                                  <span style={{ fontSize: 12, color: T.textMuted, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <span style={{ color: T.gold }}><Icon.Star /></span>
                                    <strong style={{ color: T.text }}>{shop.rating}</strong>
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="sp-grid">
                      {displayListings.map(item => {
                        const price = formatPrice(item)
                        const promo = promoLabel(item)
                        const cond = conditionLabel(item.condition)
                        const cover = Array.isArray(item.images) ? item.images[0] : (typeof item.images === 'string' ? item.images : null)
                        return (
                          <div
                            key={item.id}
                            className="sp-listing-card"
                            onClick={() => navigate(`/listing/${item.id}`)}
                            role="link"
                            tabIndex={0}
                            onKeyDown={e => { if (e.key === 'Enter') navigate(`/listing/${item.id}`) }}
                          >
                            <div className="sp-listing-img-wrap">
                              {cover ? (
                                <img src={cover} alt={item.title} loading="lazy" />
                              ) : (
                                <div className="sp-img-ph">📦</div>
                              )}
                              <div className="sp-badge-stack">
                                {promo && (
                                  <span className={promo === 'Sale' || promo.includes('Sale') ? 'sp-sale-badge' : 'sp-featured-badge'}>
                                    {promo}
                                  </span>
                                )}
                                {cond && <span className="sp-cond-badge">{cond}</span>}
                              </div>
                              <button
                                type="button"
                                className="sp-fav-btn"
                                aria-label="Save"
                                onClick={e => e.stopPropagation()}
                              >
                                <Icon.Heart />
                              </button>
                            </div>
                            <div className="sp-listing-body">
                              <div className="sp-listing-title">{item.title}</div>
                              <div className="sp-listing-price">
                                {price.old && <span className="old">{price.old}</span>}
                                <span className={price.sale ? 'sale' : ''}>{price.main}</span>
                              </div>
                              <div className="sp-listing-meta">
                                {(item.city || item.district) && (
                                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                    <Icon.Pin /> {item.city || item.district}
                                  </span>
                                )}
                                {shop.rating > 0 && (
                                  <>
                                    <span className="dot" />
                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                                      <span style={{ color: T.gold }}><Icon.Star /></span>
                                      {shop.rating}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {hasMoreProducts && (
                    <button
                      type="button"
                      className="sp-viewall"
                      onClick={() => setProductsVisible(v => v + PRODUCTS_PAGE)}
                    >
                      See more products
                      <span style={{ fontWeight: 500, color: T.textMuted }}>
                        ({filteredListings.length - productsVisible} left)
                      </span>
                    </button>
                  )}
                  {!hasMoreProducts && filteredListings.length > PRODUCTS_PAGE && (
                    <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12.5, color: T.textLight }}>
                      All {filteredListings.length} products shown
                    </div>
                  )}
                </>
              )}
            </>
          )}

          {tab === 'about' && (
            <div className="sp-side-card" style={{ marginBottom: 0 }}>
              <div className="sp-side-title">About {shop.name}</div>
              <div className="sp-about-text">{shop.description || 'This shop hasn\u2019t added a description yet.'}</div>
              <div className="sp-about-row"><Icon.Pin /> {shop.city ? `${shop.city}, ` : ''}{shop.district || 'Malawi'}</div>
              {shop.whatsapp && <div className="sp-about-row"><Icon.Phone /> WhatsApp: {shop.whatsapp}</div>}
              {shop.phone && <div className="sp-about-row"><Icon.Phone /> {shop.phone}</div>}
              {shop.address && <div className="sp-about-row"><Icon.Pin /> {shop.address}</div>}
            </div>
          )}

          {tab === 'reviews' && (
            <div className="sp-side-card" style={{ marginBottom: 0 }}>
              <div className="sp-side-title">
                {shop.rating ? `${shop.rating} · ${shop.review_count || reviews.length} review${(shop.review_count || reviews.length) === 1 ? '' : 's'}` : 'No reviews yet'}
              </div>

              {!isOwner && (
                <div style={{
                  background: T.offwhite, border: `1px solid ${T.border}`, borderRadius: 12,
                  padding: 16, marginBottom: 20,
                }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 10 }}>
                    {myReview ? 'Update your rating' : 'Rate this shop'}
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
                    {[1, 2, 3, 4, 5].map(n => (
                      <svg
                        key={n}
                        width="26" height="26" viewBox="0 0 24 24"
                        fill={(reviewHoverRating || reviewRating) >= n ? T.gold : '#e3ece5'}
                        style={{ cursor: 'pointer', transition: 'fill 0.1s' }}
                        onMouseEnter={() => setReviewHoverRating(n)}
                        onMouseLeave={() => setReviewHoverRating(0)}
                        onClick={() => setReviewRating(n)}
                      >
                        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                      </svg>
                    ))}
                  </div>
                  <textarea
                    className="sp-d-textarea"
                    placeholder="Share your experience with this shop (optional)"
                    value={reviewComment}
                    onChange={e => setReviewComment(e.target.value)}
                    style={{ width: '100%', marginBottom: 12 }}
                  />
                  {reviewMsg && (
                    <div className={`sp-d-msg sp-d-msg-${reviewMsg.type}`}>{reviewMsg.text}</div>
                  )}
                  <button
                    className="sp-d-save-btn"
                    style={{ width: 'auto', padding: '10px 20px' }}
                    onClick={handleSubmitReview}
                    disabled={reviewSubmitting}
                  >
                    {reviewSubmitting ? <div className="sp-d-spinner sp-spinner-dark" /> : (myReview ? 'Update Review' : 'Submit Review')}
                  </button>
                </div>
              )}

              {reviewsLoading ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>Loading reviews…</div>
              ) : reviews.length === 0 ? (
                <div style={{ padding: '20px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
                  No reviews yet — be the first to rate this shop.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {reviews.map(r => (
                    <div key={r.id} style={{ borderTop: `1px solid ${T.border}`, paddingTop: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                        {r.profiles?.avatar_url ? (
                          <img src={r.profiles.avatar_url} alt="" style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover' }} />
                        ) : (
                          <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: T.green }}>
                            {initials(r.profiles?.full_name)}
                          </div>
                        )}
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{r.profiles?.full_name || 'Buyer'}</div>
                          <div style={{ display: 'flex', gap: 2 }}>
                            {[1,2,3,4,5].map(n => (
                              <svg key={n} width="11" height="11" viewBox="0 0 24 24" fill={r.rating >= n ? T.gold : '#e3ece5'}>
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
                              </svg>
                            ))}
                          </div>
                        </div>
                        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: T.textLight }}>
                          {new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </div>
                      {r.comment && <div style={{ fontSize: 13, color: T.textMuted, lineHeight: 1.6 }}>{r.comment}</div>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'policies' && (
            <div className="sp-side-card" style={{ marginBottom: 0 }}>
              <div className="sp-side-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                Shop Policies
                {isOwner && (
                  <button className="sp-policy-edit-btn" onClick={openPolicyEditor}>Edit Policies</button>
                )}
              </div>
              {shop.policy_delivery && <div className="sp-policy-row"><Icon.Truck /> {shop.policy_delivery}</div>}
              {shop.policy_returns && <div className="sp-policy-row"><Icon.Refresh /> {shop.policy_returns}</div>}
              {shop.policy_payment && <div className="sp-policy-row"><Icon.Lock /> {shop.policy_payment}</div>}
              {Array.isArray(shop.policy_custom) && shop.policy_custom.map((p, i) => (
                <div key={i} className="sp-policy-row"><Icon.ChevronRight /> {p.label}</div>
              ))}
              {!shop.policy_delivery && !shop.policy_returns && !shop.policy_payment && (!shop.policy_custom || shop.policy_custom.length === 0) && (
                <div style={{ fontSize: 13, color: T.textMuted }}>
                  {isOwner ? 'You haven\u2019t added any policies yet — click Edit Policies to add some.' : 'This shop hasn\u2019t added any policies yet.'}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── SIDEBAR (sticky under nav; scrolls fully inside its rail) ── */}
        <aside className="sp-sidebar" aria-label="Shop details">
          <div className="sp-sidebar-sticky" tabIndex={0}>
          {/* Product featuring advert */}
          <div className="sp-feature-ad">
            <div className="sp-feature-ad-badge">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26" />
              </svg>
              Featured
            </div>
            <h4>{isOwner ? 'Boost a product' : 'Sell faster on Soko'}</h4>
            <p>
              {isOwner
                ? 'Feature a listing on the homepage with a gold badge — more views, more chats, more sales.'
                : 'Shop owners feature top products on the Soko homepage. Reach buyers across Malawi.'}
            </p>
            <div className="sp-feature-ad-price">
              <strong>{featuredPriceLabel().split('·')[0].trim()}</strong>
              <span>· {FEATURED_DURATION_DAYS} days on homepage</span>
            </div>
            <ul className="sp-feature-ad-perks">
              <li>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Gold Featured badge
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Homepage placement
              </li>
              <li>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>
                Priority visibility in feed
              </li>
            </ul>
            {isOwner ? (
              <>
                <button
                  type="button"
                  className="sp-feature-ad-btn"
                  onClick={() => {
                    if (allListings.length === 0) {
                      navigate('/post', { state: { shopId: shop.id } })
                      return
                    }
                    setFeatureSheetOpen(true)
                  }}
                  disabled={!!featuringId}
                >
                  {allListings.length === 0
                    ? 'Add a product first'
                    : featureableListings.length === 0
                      ? 'All products featured'
                      : 'Feature a product'}
                </button>
                <div className="sp-feature-ad-note">
                  Free entitlement may apply · otherwise {featuredPriceLabel()}
                </div>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="sp-feature-ad-btn"
                  onClick={() => navigate(currentUserId ? '/post' : '/login')}
                >
                  {currentUserId ? 'Sell & feature products' : 'Sign in to sell'}
                </button>
                <div className="sp-feature-ad-note">
                  Promote your listings to the homepage
                </div>
              </>
            )}
          </div>

          <div className="sp-side-card">
            <div className="sp-side-title">About this shop</div>
            <div className="sp-about-text">{shop.description || 'This shop hasn\u2019t added a description yet.'}</div>
            <div className="sp-about-row"><Icon.Pin /> {shop.city ? `${shop.city}, ` : ''}{shop.district || 'Malawi'}</div>
            <div className="sp-about-row"><Icon.Clock /> Open now · 08:00 AM – 06:00 PM</div>
            {shop.phone && <div className="sp-about-row"><Icon.Phone /> {shop.phone}</div>}
            {shop.whatsapp && <div className="sp-about-row"><Icon.Phone /> WhatsApp</div>}
            {(shop.social_facebook || shop.whatsapp || shop.social_instagram || shop.social_tiktok || shop.social_x || shop.social_website) && (
              <div className="sp-social-row">
                {shop.social_facebook && (
                  <a className="sp-social-icon" style={{ background: '#1877f2' }} href={shop.social_facebook} target="_blank" rel="noopener noreferrer" title="Facebook">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5 3.66 9.16 8.44 9.94v-7.03H7.9v-2.91h2.54V9.84c0-2.5 1.49-3.89 3.78-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56v1.89h2.78l-.44 2.91h-2.34V22c4.78-.78 8.44-4.94 8.44-9.94Z"/></svg>
                  </a>
                )}
                {shop.whatsapp && (
                  <a className="sp-social-icon" style={{ background: '#25d366' }} href={`https://wa.me/${shop.whatsapp.replace(/[^0-9]/g, '')}`} target="_blank" rel="noopener noreferrer" title="WhatsApp">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.94.56 3.76 1.53 5.3L2 22l4.94-1.61a9.84 9.84 0 0 0 5.1 1.4h.01c5.46 0 9.91-4.45 9.91-9.91C21.96 6.45 17.51 2 12.04 2Zm5.78 14.04c-.24.69-1.42 1.32-1.95 1.4-.5.08-1.13.11-1.82-.11-.42-.13-.96-.31-1.65-.6-2.9-1.25-4.79-4.16-4.93-4.36-.14-.2-1.18-1.57-1.18-3 0-1.42.74-2.12 1-2.41.26-.29.57-.36.76-.36.19 0 .38 0 .55.01.18.01.41-.07.64.49.24.58.81 2.01.88 2.16.07.15.12.32.02.5-.1.18-.15.3-.3.46-.15.16-.31.36-.44.48-.15.14-.3.29-.13.57.17.28.76 1.25 1.63 2.02 1.12.99 2.07 1.3 2.37 1.45.3.15.47.13.65-.06.18-.2.76-.88.96-1.19.2-.3.4-.25.67-.15.27.1 1.71.81 2 .96.29.15.49.22.56.34.07.13.07.71-.17 1.4Z"/></svg>
                  </a>
                )}
                {shop.social_instagram && (
                  <a className="sp-social-icon" style={{ background: 'linear-gradient(45deg,#f09433,#e6683c,#dc2743,#cc2366,#bc1888)' }} href={shop.social_instagram} target="_blank" rel="noopener noreferrer" title="Instagram">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="#fff" stroke="none"/></svg>
                  </a>
                )}
                {shop.social_tiktok && (
                  <a className="sp-social-icon" style={{ background: '#000' }} href={shop.social_tiktok} target="_blank" rel="noopener noreferrer" title="TikTok">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#fff"><path d="M16.6 5.82c-.83-.7-1.36-1.7-1.42-2.82h-3.05v13.13c0 1.6-1.3 2.9-2.9 2.9a2.9 2.9 0 0 1 0-5.8c.27 0 .54.04.79.11V10.3a6 6 0 0 0-.79-.05A5.95 5.95 0 0 0 3.3 16.2a5.95 5.95 0 0 0 5.95 5.95 5.95 5.95 0 0 0 5.95-5.95V9.27a8.16 8.16 0 0 0 4.76 1.52V7.74c-1.13 0-2.18-.36-3.36-1.92Z"/></svg>
                  </a>
                )}
                {shop.social_x && (
                  <a className="sp-social-icon" style={{ background: '#000' }} href={shop.social_x} target="_blank" rel="noopener noreferrer" title="X">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff"><path d="M18.9 2H22l-7.6 8.7L22.6 22H16l-5.2-6.8L4.9 22H1.8l8.1-9.3L1.4 2h6.7l4.7 6.2L18.9 2Zm-2.2 18h1.7L7.4 4H5.6l11.1 16Z"/></svg>
                  </a>
                )}
                {shop.social_website && (
                  <a className="sp-social-icon" style={{ background: T.green }} href={shop.social_website} target="_blank" rel="noopener noreferrer" title="Website">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="sp-side-card">
            <div className="sp-side-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Shop Policies
              {isOwner && (
                <button className="sp-policy-edit-btn" onClick={openPolicyEditor}>Edit</button>
              )}
            </div>
            {shop.policy_delivery && <div className="sp-policy-row"><Icon.Truck /> {shop.policy_delivery}</div>}
            {shop.policy_returns && <div className="sp-policy-row"><Icon.Refresh /> {shop.policy_returns}</div>}
            {shop.policy_payment && <div className="sp-policy-row"><Icon.Lock /> {shop.policy_payment}</div>}
            {Array.isArray(shop.policy_custom) && shop.policy_custom.slice(0, 2).map((p, i) => (
              <div key={i} className="sp-policy-row"><Icon.ChevronRight /> {p.label}</div>
            ))}
            {!shop.policy_delivery && !shop.policy_returns && !shop.policy_payment && (!shop.policy_custom || shop.policy_custom.length === 0) && (
              <div style={{ fontSize: 12.5, color: T.textLight }}>No policies added yet.</div>
            )}
            <div className="sp-policy-link" onClick={() => setTab('policies')}>View all policies <Icon.ChevronRight /></div>
          </div>

          <div className="sp-side-card">
            <div className="sp-side-title">Shop Owner</div>
            <div className="sp-owner-row">
              {owner?.avatar_url ? (
                <img className="sp-owner-avatar" src={owner.avatar_url} alt={owner.full_name || 'Owner'} />
              ) : (
                <div className="sp-owner-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 700, color: T.green }}>
                  {initials(owner?.full_name || shop.name)}
                </div>
              )}
              <div>
                <div className="sp-owner-name-row">
                  <span className="sp-owner-name">{owner?.full_name || 'Shop Owner'}</span>
                  {shop.is_verified && (
                    <svg width="14" height="14" viewBox="0 0 24 24"><path fill="#16a34a" d="M12 0a4 4 0 0 1 3.2 1.6 4 4 0 0 1 3.6 1 4 4 0 0 1 1 3.6A4 4 0 0 1 21.4 9.4a4 4 0 0 1 0 5.2A4 4 0 0 1 19.8 17.8a4 4 0 0 1-1 3.6 4 4 0 0 1-3.6 1A4 4 0 0 1 12 24a4 4 0 0 1-3.2-1.6 4 4 0 0 1-3.6-1 4 4 0 0 1-1-3.6A4 4 0 0 1 2.6 14.6a4 4 0 0 1 0-5.2A4 4 0 0 1 4.2 6.2a4 4 0 0 1 1-3.6 4 4 0 0 1 3.6-1A4 4 0 0 1 12 0Z"/><path d="m7.5 12.5 3 3 6-7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                  <span className="sp-owner-tag">Owner</span>
                </div>
                <div className="sp-owner-sub">
                  Joined {shop.created_at ? new Date(shop.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'recently'}
                </div>
              </div>
            </div>
            <button className="sp-msg-owner-btn" onClick={handleMessageOwner}><Icon.Msg /> Message Owner</button>
          </div>
          </div>
        </aside>
      </div>

      {/* ── SIMILAR SHOPS (sticky) ── */}
      <div className="sp-similar-wrap">
        <div className="sp-similar">
          <div className="sp-similar-head">
            <h3>More shops you might like</h3>
            <button type="button" className="sp-similar-all" onClick={() => navigate('/shops')}>
              View all shops
            </button>
          </div>
          <div className="sp-similar-grid">
            {similarShops.length === 0 ? (
              <div style={{ gridColumn: '1/-1', textAlign: 'center', color: T.textMuted, fontSize: 13, padding: '16px 0' }}>
                No similar shops found.
              </div>
            ) : similarShops.map(s => (
              <div
                key={s.id}
                className="sp-similar-card"
                onClick={() => navigate(`/shop/${s.slug}`)}
                role="link"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') navigate(`/shop/${s.slug}`) }}
              >
                <div className="sp-similar-avatar" style={{
                  background: s.logo_url ? '#111' : 'linear-gradient(135deg,#1e293b,#334155)',
                }}>
                  {s.logo_url
                    ? <img src={s.logo_url} alt={s.name} loading="lazy" />
                    : initials(s.name)
                  }
                </div>
                <div className="sp-similar-info">
                  <div className="sp-similar-name" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {s.name}
                    {s.is_verified && (
                      <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden><path fill="#16a34a" d="M12 0a4 4 0 0 1 3.2 1.6 4 4 0 0 1 3.6 1 4 4 0 0 1 1 3.6A4 4 0 0 1 21.4 9.4a4 4 0 0 1 0 5.2A4 4 0 0 1 19.8 17.8a4 4 0 0 1-1 3.6 4 4 0 0 1-3.6 1A4 4 0 0 1 12 24a4 4 0 0 1-3.2-1.6 4 4 0 0 1-3.6-1 4 4 0 0 1-1-3.6A4 4 0 0 1 2.6 14.6a4 4 0 0 1 0-5.2A4 4 0 0 1 4.2 6.2a4 4 0 0 1 1-3.6 4 4 0 0 1 3.6-1A4 4 0 0 1 12 0Z"/><path d="m7.5 12.5 3 3 6-7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    )}
                  </div>
                  <div className="sp-similar-cat">{s.category || 'General'}</div>
                  <div className="sp-similar-bottom">
                    <span className="sp-similar-followers">
                      {s.follower_count >= 1000 ? `${(s.follower_count / 1000).toFixed(1)}K` : s.follower_count || 0} followers
                    </span>
                    {s.rating ? (
                      <span className="sp-similar-rating">
                        <span className="star"><Icon.Star /></span>
                        {s.rating}
                        <span style={{ fontSize: 10, fontWeight: 500, color: T.textLight }}>({s.review_count || 0})</span>
                      </span>
                    ) : (
                      <span style={{ fontSize: 10.5, fontWeight: 500, color: T.textLight, fontStyle: 'italic' }}>No reviews yet</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Spacer so page end isn’t flush under sticky similar block */}
      <div style={{ height: 48 }} aria-hidden />

      {/* ── FEATURE PRODUCT PICKER ── */}
      {featureSheetOpen && isOwner && (
        <div
          className="sp-feature-sheet-overlay"
          onClick={() => !featuringId && setFeatureSheetOpen(false)}
          role="presentation"
        >
          <div
            className="sp-feature-sheet"
            role="dialog"
            aria-label="Feature a product"
            onClick={e => e.stopPropagation()}
          >
            <div className="sp-feature-sheet-handle" />
            <div className="sp-feature-sheet-head">
              <h3>Feature a product</h3>
              <button
                type="button"
                className="sp-feature-sheet-close"
                aria-label="Close"
                onClick={() => !featuringId && setFeatureSheetOpen(false)}
              >
                <Icon.X />
              </button>
            </div>
            <div className="sp-feature-sheet-sub">
              Choose a product to feature on the homepage for {FEATURED_DURATION_DAYS} days ({featuredPriceLabel()}
              {featureableListings.length > 0 ? ` · ${featureableListings.length} available` : ''}).
            </div>
            <div className="sp-feature-sheet-list">
              {allListings.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '28px 12px', color: T.textMuted }}>
                  <p style={{ margin: '0 0 14px', fontSize: 13.5 }}>No products in this shop yet.</p>
                  <button
                    type="button"
                    className="sp-feature-ad-btn"
                    style={{ maxWidth: 240, margin: '0 auto' }}
                    onClick={() => navigate('/post', { state: { shopId: shop.id } })}
                  >
                    Add product
                  </button>
                </div>
              ) : (
                allListings.map(item => {
                  const featured = isListingFeatured(item)
                  const cover = Array.isArray(item.images) ? item.images[0] : null
                  const busy = featuringId === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      className={`sp-feature-pick${featured ? ' is-featured' : ''}`}
                      disabled={featured || !!featuringId}
                      onClick={() => handleFeatureListing(item)}
                    >
                      <div className="sp-feature-pick-thumb">
                        {cover ? (
                          <img src={cover} alt="" loading="lazy" />
                        ) : (
                          <div className="sp-img-ph" style={{ fontSize: 18 }}>📦</div>
                        )}
                      </div>
                      <div className="sp-feature-pick-info">
                        <div className="sp-feature-pick-title">{item.title}</div>
                        <div className="sp-feature-pick-meta">
                          {item.price != null
                            ? `MK ${Number(item.price).toLocaleString()}`
                            : 'Price on request'}
                          {item.city ? ` · ${item.city}` : ''}
                        </div>
                      </div>
                      <span className="sp-feature-pick-action">
                        {busy ? '…' : featured ? 'Featured' : 'Feature'}
                      </span>
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── MOBILE STICKY CTA (visitors) ── */}
      {showVisitorSticky && (
        <div className="sp-mobile-cta" role="region" aria-label="Shop actions">
          <button type="button" className="sp-btn-msg" onClick={handleMessageOwner}>
            <Icon.Msg /> Message
          </button>
          <button
            type="button"
            className={`sp-btn-follow${isFollowing ? ' following' : ''}`}
            onClick={handleFollowToggle}
            disabled={followLoading}
          >
            {isFollowing ? 'Following' : 'Follow'}
          </button>
        </div>
      )}

      {/* ── EDIT SHOP DRAWER (owner only) ── */}
      {drawerOpen && (
        <div className="sp-drawer-overlay" onClick={() => setDrawerOpen(false)}>
          <div className="sp-drawer" onClick={e => e.stopPropagation()}>
            <div className="sp-drawer-head">
              <h2>Edit Shop</h2>
              <button className="sp-drawer-close" onClick={() => setDrawerOpen(false)}><Icon.ChevronRight /></button>
            </div>
            <div className="sp-drawer-body">
              {saveMsg && <div className={`sp-d-msg sp-d-msg-${saveMsg.type}`}>{saveMsg.text}</div>}

              <div className="sp-d-field">
                <label className="sp-d-label">Shop Logo</label>
                <div className="sp-d-logo-row">
                  <div className="sp-d-logo-preview">
                    {editLogoPreview ? <img src={editLogoPreview} alt="Logo" /> : initials(editName)}
                  </div>
                  <button className="sp-d-upload-btn" onClick={() => logoInputRef.current?.click()}>Change Logo</button>
                  <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={handleEditLogoChange} />
                </div>
              </div>

              <div className="sp-d-field">
                <label className="sp-d-label">Shop Name</label>
                <input className="sp-d-input" value={editName} onChange={e => setEditName(e.target.value)} />
              </div>

              <div className="sp-d-field">
                <label className="sp-d-label">Category</label>
                <select className="sp-d-select" value={editCategory} onChange={e => setEditCategory(e.target.value)}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>

              <div className="sp-d-field">
                <label className="sp-d-label">Shop Theme</label>
                <div className="sp-theme-swatch-row" style={{ marginTop: 4 }}>
                  {Object.values(SHOP_THEMES).map(opt => {
                    const active = activeTheme.id === opt.id
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        title={opt.label}
                        aria-label={`Theme ${opt.label}`}
                        aria-pressed={active}
                        className={`sp-theme-swatch${active ? ' active' : ''}`}
                        onClick={() => applyShopTheme(opt.id)}
                        style={{
                          background: opt.color,
                          '--swatch': opt.color,
                          color: opt.onAccent,
                          width: 40,
                          height: 40,
                        }}
                      >
                        {active && <Icon.Check2 />}
                      </button>
                    )
                  })}
                </div>
                <div style={{ fontSize: 12, color: T.textMuted, marginTop: 8 }}>
                  Colors your cover, buttons, and accents. Active: <strong style={{ color: activeTheme.dark }}>{activeTheme.label}</strong>
                </div>
              </div>

              <div className="sp-d-field">
                <label className="sp-d-label">Description</label>
                <textarea className="sp-d-textarea" value={editDescription} onChange={e => setEditDescription(e.target.value)} />
              </div>

              <div className="sp-d-field">
                <label className="sp-d-label">District</label>
                <select className="sp-d-select" value={editDistrict} onChange={e => setEditDistrict(e.target.value)}>
                  {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>

              <div className="sp-d-field">
                <label className="sp-d-label">City / Trading Centre</label>
                <input className="sp-d-input" value={editCity} onChange={e => setEditCity(e.target.value)} />
              </div>

              <div className="sp-d-field">
                <label className="sp-d-label">WhatsApp Number</label>
                <input className="sp-d-input" value={editWhatsapp} onChange={e => setEditWhatsapp(e.target.value)} />
              </div>

              <div className="sp-d-field">
                <label className="sp-d-label">Phone Number</label>
                <input className="sp-d-input" value={editPhone} onChange={e => setEditPhone(e.target.value)} />
              </div>

              <div className="sp-d-field">
                <label className="sp-d-label">Physical Address</label>
                <input className="sp-d-input" value={editAddress} onChange={e => setEditAddress(e.target.value)} />
              </div>

              <div className="sp-d-field">
                <label className="sp-d-label">Facebook Page (link)</label>
                <input className="sp-d-input" placeholder="https://facebook.com/yourshop" value={editFacebook} onChange={e => setEditFacebook(e.target.value)} />
              </div>

              <div className="sp-d-field">
                <label className="sp-d-label">Instagram (link)</label>
                <input className="sp-d-input" placeholder="https://instagram.com/yourshop" value={editInstagram} onChange={e => setEditInstagram(e.target.value)} />
              </div>

              <div className="sp-d-field">
                <label className="sp-d-label">TikTok (link)</label>
                <input className="sp-d-input" placeholder="https://tiktok.com/@yourshop" value={editTiktok} onChange={e => setEditTiktok(e.target.value)} />
              </div>

              <div className="sp-d-field">
                <label className="sp-d-label">X / Twitter (link)</label>
                <input className="sp-d-input" placeholder="https://x.com/yourshop" value={editX} onChange={e => setEditX(e.target.value)} />
              </div>

              <div className="sp-d-field">
                <label className="sp-d-label">Website / Other Link</label>
                <input className="sp-d-input" placeholder="https://yourshop.com" value={editWebsite} onChange={e => setEditWebsite(e.target.value)} />
              </div>

              <button className="sp-d-save-btn" onClick={handleSaveShop} disabled={saving}>
                {saving ? <div className="sp-d-spinner" /> : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── EDIT POLICIES DRAWER (owner only) ── */}
      {policyDrawerOpen && (
        <div className="sp-drawer-overlay" onClick={() => setPolicyDrawerOpen(false)}>
          <div className="sp-drawer" onClick={e => e.stopPropagation()}>
            <div className="sp-drawer-head">
              <h2>Edit Shop Policies</h2>
              <button className="sp-drawer-close" onClick={() => setPolicyDrawerOpen(false)}><Icon.ChevronRight /></button>
            </div>
            <div className="sp-drawer-body">
              {policySaveMsg && <div className={`sp-d-msg sp-d-msg-${policySaveMsg.type}`}>{policySaveMsg.text}</div>}

              <div className="sp-d-field">
                <label className="sp-d-label">Delivery Policy</label>
                <input
                  className="sp-d-input"
                  placeholder="e.g. Delivery available within Lilongwe"
                  value={editPolicyDelivery}
                  onChange={e => setEditPolicyDelivery(e.target.value)}
                />
                <div style={{ fontSize: 11.5, color: T.textLight, marginTop: 5 }}>Leave blank to hide this row.</div>
              </div>

              <div className="sp-d-field">
                <label className="sp-d-label">Returns Policy</label>
                <input
                  className="sp-d-input"
                  placeholder="e.g. Returns accepted within 7 days"
                  value={editPolicyReturns}
                  onChange={e => setEditPolicyReturns(e.target.value)}
                />
                <div style={{ fontSize: 11.5, color: T.textLight, marginTop: 5 }}>Leave blank to hide this row.</div>
              </div>

              <div className="sp-d-field">
                <label className="sp-d-label">Payment Policy</label>
                <input
                  className="sp-d-input"
                  placeholder="e.g. Cash, Airtel Money & TNM Mpamba accepted"
                  value={editPolicyPayment}
                  onChange={e => setEditPolicyPayment(e.target.value)}
                />
                <div style={{ fontSize: 11.5, color: T.textLight, marginTop: 5 }}>Leave blank to hide this row.</div>
              </div>

              <div className="sp-d-field">
                <label className="sp-d-label">Additional Policies</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                  {editPolicyCustom.map((p, i) => (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'center', gap: 8,
                      background: T.offwhite, border: `1px solid ${T.border}`,
                      borderRadius: 8, padding: '7px 10px',
                    }}>
                      <span style={{ flex: 1, fontSize: 13, color: T.text }}>{p.label}</span>
                      <button
                        onClick={() => removeCustomPolicy(i)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.textLight, fontSize: 16, lineHeight: 1, padding: '0 2px' }}
                        aria-label="Remove policy"
                      >×</button>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="sp-d-input"
                    placeholder="e.g. No refunds on electronics"
                    value={newCustomPolicy}
                    onChange={e => setNewCustomPolicy(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomPolicy() } }}
                  />
                  <button
                    onClick={addCustomPolicy}
                    style={{
                      flexShrink: 0, background: T.green, color: T.white, border: 'none',
                      borderRadius: 10, padding: '0 16px', fontSize: 13, fontWeight: 700,
                      cursor: 'pointer', fontFamily: 'inherit',
                    }}
                  >Add</button>
                </div>
                <div style={{ fontSize: 11.5, color: T.textLight, marginTop: 5 }}>Add as many custom policies as you like.</div>
              </div>

              <button className="sp-d-save-btn" onClick={handleSavePolicies} disabled={policySaving}>
                {policySaving ? <div className="sp-d-spinner" /> : 'Save Policies'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── REPORT SHOP MODAL ── */}
      {reportModalOpen && (
        <div className="sp-drawer-overlay" onClick={() => setReportModalOpen(false)} style={{ alignItems: 'center', justifyContent: 'center' }}>
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: T.white, borderRadius: 16, width: 420, maxWidth: '92vw',
              padding: 22, animation: 'sp-fadeIn 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: T.text }}>Report this shop</h2>
              <button className="sp-drawer-close" onClick={() => setReportModalOpen(false)}><Icon.ChevronRight /></button>
            </div>

            {reportMsg && <div className={`sp-d-msg sp-d-msg-${reportMsg.type}`}>{reportMsg.text}</div>}

            <div className="sp-d-field">
              <label className="sp-d-label">Reason</label>
              <select className="sp-d-select" value={reportReason} onChange={e => setReportReason(e.target.value)}>
                <option value="">Select a reason\u2026</option>
                <option value="scam_fraud">Scam or fraud</option>
                <option value="fake_listings">Fake or misleading listings</option>
                <option value="inappropriate_content">Inappropriate content</option>
                <option value="counterfeit_goods">Counterfeit goods</option>
                <option value="harassment">Harassment or abuse</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="sp-d-field">
              <label className="sp-d-label">Additional details (optional)</label>
              <textarea
                className="sp-d-textarea"
                placeholder="Tell us more about the issue\u2026"
                value={reportDetails}
                onChange={e => setReportDetails(e.target.value)}
              />
            </div>

            <button className="sp-d-save-btn" onClick={handleSubmitReport} disabled={reportSubmitting} style={{ background: '#dc2626' }}>
              {reportSubmitting ? <div className="sp-d-spinner" /> : 'Submit Report'}
            </button>
          </div>
        </div>
      )}
    {verifyModalOpen && (
        <VerificationModal
          user={currentUserId ? { id: currentUserId, email: currentUser?.email, user_metadata: { full_name: currentUser?.full_name } } : null}
          onClose={() => setVerifyModalOpen(false)}
          onSuccess={() => {
            setVerifyModalOpen(false)
            // Payment / submit does not instantly verify — wait for admin approval
          }}
        />
      )}
    </div>
  )
}