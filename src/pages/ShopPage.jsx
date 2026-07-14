import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import VerificationModal from '../components/VerificationModal'

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

const T = {
  green: '#2e7d32',
  greenDark: '#1b5e20',
  greenLight: '#e8f5e9',
  gold: '#f9a825',
  goldDark: '#f57f17',
  white: '#ffffff',
  offwhite: '#f9fafb',
  text: '#0d1b0e',
  textMuted: '#4a5e4d',
  textLight: '#7a917c',
  border: '#e3ece5',
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
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
  *, *::before, *::after { box-sizing: border-box; }

  .sp-root { font-family: 'Inter', system-ui, sans-serif; background: ${T.offwhite}; min-height: 100vh; }

  /* ── HEADER ── */
  .sp-header {
    background: ${T.white};
    border-bottom: 1px solid ${T.border};
    padding: 14px 28px;
    display: flex;
    align-items: center;
    gap: 24px;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .sp-logo-brand { font-size: 21px; font-weight: 900; color: ${T.text}; letter-spacing: -0.5px; flex-shrink: 0; }
  .sp-logo-brand span { color: ${T.green}; }
  .sp-search { flex: 1; max-width: 460px; position: relative; }
  .sp-search input {
    width: 100%; height: 38px; border-radius: 19px;
    border: 1.5px solid ${T.border}; background: ${T.offwhite};
    padding: 0 16px 0 16px; font-size: 13.5px; font-family: inherit;
  }
  .sp-search input::placeholder { color: #9caea0; }
  .sp-search-icon { position: absolute; right: 14px; top: 50%; transform: translateY(-50%); color: ${T.textLight}; }
  .sp-nav-actions { display: flex; align-items: center; gap: 22px; margin-left: auto; flex-shrink: 0; }
  .sp-nav-item {
    display: flex; flex-direction: column; align-items: center; gap: 2px;
    font-size: 11px; font-weight: 600; color: ${T.textMuted}; cursor: pointer;
  }
  .sp-nav-user { display: flex; align-items: center; gap: 8px; cursor: pointer; }
  .sp-nav-avatar { width: 30px; height: 30px; border-radius: 50%; object-fit: cover; background: ${T.greenLight}; }
  .sp-nav-user span { font-size: 13px; font-weight: 600; color: ${T.text}; }

  /* ── BREADCRUMB ── */
  .sp-breadcrumb {
    max-width: 1180px; margin: 0 auto;
    padding: 14px 24px 0;
    display: flex; align-items: center; justify-content: space-between;
  }
  .sp-breadcrumb-trail { font-size: 13px; color: ${T.textMuted}; display: flex; gap: 6px; align-items: center; }
  .sp-breadcrumb-trail a { color: ${T.textMuted}; text-decoration: none; }
  .sp-breadcrumb-trail a:hover { color: ${T.green}; }
  .sp-breadcrumb-trail .current { color: ${T.text}; font-weight: 600; }
  .sp-breadcrumb-actions { display: flex; gap: 14px; align-items: center; }
  .sp-link-btn {
    display: flex; align-items: center; gap: 6px;
    font-size: 13px; font-weight: 600; color: ${T.textMuted};
    background: none; border: none; cursor: pointer;
  }
  .sp-link-btn:hover { color: ${T.green}; }
  .sp-more-menu {
    position: absolute; top: calc(100% + 8px); right: 0;
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 12px;
    box-shadow: 0 8px 24px rgba(13,31,15,0.12); padding: 6px;
    min-width: 170px; z-index: 150;
  }
  .sp-more-menu-item {
    display: flex; align-items: center; gap: 8px; width: 100%;
    padding: 9px 10px; border-radius: 8px; border: none; background: none;
    font-size: 13px; font-weight: 600; color: ${T.text}; cursor: pointer;
    font-family: inherit; text-align: left;
  }
  .sp-more-menu-item svg { color: ${T.textMuted}; flex-shrink: 0; }
  .sp-more-menu-item:hover { background: ${T.offwhite}; }
  .sp-more-menu-item.danger { color: #dc2626; }
  .sp-more-menu-item.danger svg { color: #dc2626; }
  .sp-more-menu-item.danger:hover { background: #fef2f2; }

  /* ── COVER ── */
  .sp-cover-wrap { max-width: 1180px; margin: 14px auto 0; padding: 0 24px; }
  .sp-cover {
    position: relative; height: 230px; border-radius: 16px; overflow: hidden;
    background: linear-gradient(135deg, ${T.greenLight}, ${T.border});
  }
  .sp-cover img { width: 100%; height: 100%; object-fit: cover; }

  /* ── SHOP HEADER CARD ── */
  .sp-shophead {
    max-width: 1180px; margin: 0 auto; padding: 0 24px;
    position: relative;
  }
  .sp-shophead-inner {
    background: ${T.white};
    border: 1px solid ${T.border};
    border-radius: 16px;
    padding: 20px 24px 20px 168px;
    margin-top: -64px;
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 20px;
    flex-wrap: wrap;
  }
  .sp-logo-frame {
    position: absolute;
    left: 24px;
    top: -36px;
    width: 116px; height: 116px;
    border-radius: 16px;
    background: ${T.white};
    border: 1px solid ${T.border};
    padding: 6px;
    box-shadow: 0 6px 20px rgba(13,31,15,0.08);
  }
  .sp-verified-pill {
    position: absolute;
    top: -28px; left: 50%; transform: translateX(-50%);
    background: ${T.greenLight};
    color: ${T.green};
    font-size: 10.5px; font-weight: 700;
    padding: 3px 10px; border-radius: 10px;
    white-space: nowrap;
  }
  .sp-logo-img { width: 100%; height: 100%; border-radius: 11px; object-fit: cover; }
  .sp-shop-info { flex: 1; min-width: 220px; }
  .sp-shop-name-row { display: flex; align-items: center; gap: 8px; }
  .sp-shop-name { font-size: 24px; font-weight: 800; color: ${T.text}; letter-spacing: -0.4px; }
  .sp-shop-tagline { font-size: 13.5px; color: ${T.textMuted}; margin-top: 4px; }
  .sp-shop-tags { display: flex; gap: 10px; margin-top: 10px; flex-wrap: wrap; align-items: center; }
  .sp-tag-pill {
    background: ${T.offwhite}; border: 1px solid ${T.border};
    font-size: 12px; font-weight: 600; color: ${T.textMuted};
    padding: 4px 10px; border-radius: 8px;
  }
  .sp-shop-loc { font-size: 12.5px; color: ${T.textMuted}; display: flex; align-items: center; gap: 4px; }
  .sp-shop-meta { font-size: 12.5px; color: ${T.textMuted}; margin-top: 8px; display: flex; align-items: center; gap: 6px; }
  .sp-shop-meta .star { color: ${T.gold}; }

  .sp-shophead-right { display: flex; flex-direction: column; align-items: flex-end; gap: 10px; flex-shrink: 0; }
  .sp-action-row { display: flex; gap: 10px; }
  .sp-btn-msg, .sp-btn-follow {
    display: flex; align-items: center; gap: 7px;
    border-radius: 10px; padding: 9px 16px;
    font-size: 13.5px; font-weight: 700; font-family: inherit; cursor: pointer;
    transition: all 0.15s;
  }
  .sp-btn-msg { background: ${T.white}; border: 1.5px solid ${T.border}; color: ${T.text}; }
  .sp-btn-msg:hover { background: ${T.offwhite}; }
  .sp-btn-follow { background: var(--theme); border: none; color: ${T.white}; }
  .sp-btn-follow:hover { filter: brightness(0.88); }
  .sp-followers-count { font-size: 12.5px; color: ${T.textMuted}; display: flex; align-items: center; gap: 5px; }

  /* ── STATS BAR ── */
  .sp-stats {
    max-width: 1180px; margin: 16px auto 0; padding: 0 24px;
  }
  .sp-stats-inner {
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 14px;
    display: grid; grid-template-columns: repeat(4, 1fr);
    padding: 18px 0;
  }
  .sp-stat { display: flex; align-items: center; justify-content: center; gap: 12px; }
  .sp-stat-icon {
    width: 38px; height: 38px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .sp-stat-num { font-size: 17px; font-weight: 800; color: ${T.text}; line-height: 1.1; }
  .sp-stat-label { font-size: 11.5px; color: ${T.textMuted}; margin-top: 1px; }

  /* ── TABS ── */
  .sp-tabs {
    max-width: 1180px; margin: 18px auto 0; padding: 0 24px;
    display: flex; align-items: center; justify-content: space-between;
    border-bottom: 1px solid ${T.border};
  }
  .sp-tabs-left { display: flex; gap: 28px; }
  .sp-tab {
    font-size: 14px; font-weight: 600; color: ${T.textMuted};
    padding: 12px 0; cursor: pointer; position: relative; background: none; border: none; font-family: inherit;
  }
  .sp-tab.active { color: var(--theme); font-weight: 700; }
  .sp-tab.active::after {
    content: ''; position: absolute; bottom: -1px; left: 0; right: 0; height: 2px; background: var(--theme);
  }
  .sp-tabs-right { display: flex; align-items: center; gap: 10px; padding-bottom: 8px; }
  .sp-sort-select {
    font-size: 12.5px; font-weight: 600; color: ${T.textMuted};
    border: 1px solid ${T.border}; border-radius: 8px; padding: 6px 10px;
    background: ${T.white}; font-family: inherit; cursor: pointer;
  }
  .sp-view-toggle { display: flex; gap: 4px; }
  .sp-view-btn {
    width: 30px; height: 30px; border-radius: 7px; border: 1px solid ${T.border};
    background: ${T.white}; display: flex; align-items: center; justify-content: center; cursor: pointer; color: ${T.textMuted};
  }
  .sp-view-btn.active { background: ${T.greenLight}; border-color: ${T.green}; color: ${T.green}; }

  /* ── MAIN LAYOUT ── */
  .sp-main {
    max-width: 1180px; margin: 0 auto; padding: 20px 24px 0;
    display: grid; grid-template-columns: 1fr 320px; gap: 24px;
  }
  @media (max-width: 900px) {
    .sp-main { grid-template-columns: 1fr; }
  }

  .sp-grid {
    display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px;
  }
  @media (max-width: 700px) {
    .sp-grid { grid-template-columns: repeat(2, 1fr); }
  }
 .sp-listing-card {
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 14px; overflow: visible;
    transition: transform 0.15s, box-shadow 0.15s; cursor: pointer;
    display: flex; flex-direction: column; height: 300px;
  }
  .sp-listing-card:hover { transform: translateY(-3px); box-shadow: 0 10px 28px rgba(13,31,15,0.08); }
.sp-listing-img-wrap { position: relative; height: 60%; background: ${T.offwhite}; flex-shrink: 0; overflow: hidden; border-radius: 14px 14px 0 0; }  .sp-listing-img-wrap img { width: 100%; height: 100%; object-fit: cover; }
  .sp-featured-badge {
    position: absolute; top: 8px; left: 8px;
    background: ${T.green}; color: ${T.white};
    font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 6px;
  }
  .sp-fav-btn {
    position: absolute; top: 8px; right: 8px;
    width: 30px; height: 30px; border-radius: 50%;
    background: rgba(255,255,255,0.92); border: none;
    display: flex; align-items: center; justify-content: center; cursor: pointer; color: ${T.textMuted};
  }
.sp-listing-body { padding: 10px 12px 12px; height: 40%; overflow: visible; display: flex; flex-direction: column; justify-content: space-between; border-radius: 0 0 14px 14px; }  .sp-listing-title { font-size: 13px; font-weight: 600; color: ${T.text}; line-height: 1.35; }
  .sp-listing-price { font-size: 14px; font-weight: 800; color: ${T.green}; margin-top: 4px; }
  .sp-listing-city { font-size: 11.5px; color: ${T.textLight}; margin-top: 3px; display: flex; align-items: center; gap: 3px; }

  .sp-viewall {
    margin-top: 18px; width: 100%;
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 12px;
    padding: 13px; font-size: 13.5px; font-weight: 700; color: ${T.text};
    display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; font-family: inherit;
  }
  .sp-viewall:hover { background: ${T.offwhite}; }

  /* ── SIDEBAR ── */
  .sp-side-card {
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 14px; padding: 18px;
    margin-bottom: 16px;
  }
  .sp-side-title { font-size: 14.5px; font-weight: 800; color: ${T.text}; margin-bottom: 12px; }
  .sp-about-text { font-size: 12.5px; color: ${T.textMuted}; line-height: 1.6; margin-bottom: 14px; }
  .sp-about-row {
    display: flex; align-items: center; gap: 9px;
    font-size: 12.5px; color: ${T.textMuted}; margin-bottom: 9px;
  }
  .sp-about-row svg { flex-shrink: 0; color: ${T.green}; }
  .sp-social-row { display: flex; gap: 10px; margin-top: 12px; }
  .sp-social-icon {
    width: 32px; height: 32px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center; cursor: pointer;
    text-decoration: none; transition: transform 0.15s, box-shadow 0.15s;
  }
  .sp-social-icon:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(13,31,15,0.18); }

  .sp-policy-row {
    display: flex; align-items: center; gap: 9px;
    font-size: 12.5px; color: ${T.text}; margin-bottom: 11px; font-weight: 500;
  }
  .sp-policy-row svg { color: ${T.green}; flex-shrink: 0; }
  .sp-policy-link {
    font-size: 12.5px; font-weight: 700; color: ${T.green};
    display: flex; align-items: center; gap: 4px; cursor: pointer; margin-top: 4px;
  }
  .sp-policy-edit-btn {
    font-size: 11.5px; font-weight: 700; color: ${T.green};
    background: ${T.greenLight}; border: none; border-radius: 7px;
    padding: 4px 10px; cursor: pointer; font-family: inherit;
  }
  .sp-policy-edit-btn:hover { background: #d4ecd6; }

  .sp-owner-row { display: flex; align-items: center; gap: 10px; margin-bottom: 12px; }
  .sp-owner-avatar { width: 42px; height: 42px; border-radius: 50%; object-fit: cover; background: ${T.greenLight}; }
  .sp-owner-name-row { display: flex; align-items: center; gap: 6px; }
  .sp-owner-name { font-size: 13.5px; font-weight: 700; color: ${T.text}; }
  .sp-owner-tag { font-size: 10px; font-weight: 700; color: ${T.green}; background: ${T.greenLight}; padding: 2px 7px; border-radius: 6px; }
  .sp-owner-sub { font-size: 11.5px; color: ${T.textMuted}; margin-top: 2px; line-height: 1.4; }
  .sp-msg-owner-btn {
    width: 100%; padding: 10px; border-radius: 10px; border: 1.5px solid ${T.border};
    background: ${T.white}; font-size: 13px; font-weight: 700; color: ${T.text};
    display: flex; align-items: center; justify-content: center; gap: 6px; cursor: pointer; font-family: inherit;
  }
  .sp-msg-owner-btn:hover { background: ${T.offwhite}; }

  /* ── SIMILAR SHOPS ── */
  .sp-similar {
    max-width: 1180px; margin: 28px auto 50px; padding: 0 24px;
  }
  .sp-similar-head {
    display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px;
  }
  .sp-similar-head h3 { font-size: 16px; font-weight: 800; color: ${T.text}; }
  .sp-similar-head a { font-size: 13px; font-weight: 700; color: ${T.green}; text-decoration: none; }
  .sp-similar-grid {
    display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
  }
  @media (max-width: 700px) {
    .sp-similar-grid { grid-template-columns: repeat(2, 1fr); }
  }
  .sp-similar-card {
    background: ${T.white}; border: 1px solid ${T.border}; border-radius: 14px;
    padding: 14px; display: flex; align-items: center; gap: 12px; cursor: pointer; transition: box-shadow 0.15s;
  }
  .sp-similar-card:hover { box-shadow: 0 8px 22px rgba(13,31,15,0.07); }
  .sp-similar-avatar {
    width: 48px; height: 48px; border-radius: 12px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 14px; font-weight: 800; color: ${T.white}; overflow: hidden;
  }
  .sp-similar-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .sp-similar-info { flex: 1; min-width: 0; }
  .sp-similar-name { font-size: 13.5px; font-weight: 700; color: ${T.text}; }
  .sp-similar-cat { font-size: 11.5px; color: ${T.textMuted}; margin-top: 2px; }
  .sp-similar-bottom { display: flex; align-items: center; justify-content: space-between; margin-top: 5px; }
  .sp-similar-followers { font-size: 11px; color: ${T.textLight}; }
  .sp-similar-rating { font-size: 11.5px; font-weight: 700; color: ${T.text}; display: flex; align-items: center; gap: 3px; }
  .sp-similar-rating .star { color: ${T.gold}; }

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
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.45);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.2s; cursor: pointer; border-radius: 16px;
  }
  .sp-cover-wrap:hover .sp-cover-overlay { opacity: 1; }
  .sp-cover-overlay-btn {
    background: rgba(255,255,255,0.92); border: none; border-radius: 10px;
    padding: 9px 18px; font-size: 13px; font-weight: 700; cursor: pointer;
    display: flex; align-items: center; gap: 7px; color: #0d1b0e;
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
    display: flex; align-items: center; gap: 6px;
    border-radius: 10px; padding: 9px 14px;
    font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer;
    border: 1.5px solid ${T.border}; background: ${T.white}; color: ${T.text};
    transition: all 0.15s;
  }
  .sp-owner-btn:hover { background: ${T.offwhite}; }
  .sp-owner-btn.primary { background: var(--theme); color: ${T.white}; border-color: var(--theme); }
  .sp-owner-btn.primary:hover { filter: brightness(0.88); }
  .sp-owner-badge {
    display: inline-flex; align-items: center; gap: 5px;
    background: #fff8e1; color: ${T.goldDark};
    font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px;
    margin-bottom: 8px;
  }

  /* ── EDIT SHOP DRAWER ── */
  .sp-drawer-overlay {
    position: fixed; inset: 0; background: rgba(13,31,15,0.45);
    z-index: 200; display: flex; justify-content: flex-end;
    animation: sp-fadeIn 0.15s ease;
  }
  @keyframes sp-fadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes sp-slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
  .sp-drawer {
    width: 440px; max-width: 92vw; height: 100%;
    background: ${T.white}; overflow-y: auto;
    animation: sp-slideIn 0.25s cubic-bezier(0.16,1,0.3,1);
    padding: 0 0 40px;
  }
  @media (max-width: 480px) { .sp-drawer { width: 100vw; } }
  .sp-drawer-head {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 22px; border-bottom: 1px solid ${T.border};
    position: sticky; top: 0; background: ${T.white}; z-index: 2;
  }
  .sp-drawer-head h2 { font-size: 17px; font-weight: 800; color: ${T.text}; }
  .sp-drawer-close {
    width: 32px; height: 32px; border-radius: 50%; border: none; background: ${T.offwhite};
    display: flex; align-items: center; justify-content: center; cursor: pointer; color: ${T.textMuted};
  }
  .sp-drawer-body { padding: 20px 22px; }
  .sp-d-field { margin-bottom: 18px; }
  .sp-d-label { display: block; font-size: 12.5px; font-weight: 700; color: ${T.text}; margin-bottom: 6px; }
  .sp-d-input, .sp-d-select, .sp-d-textarea {
    width: 100%; border: 1.5px solid ${T.border}; border-radius: 10px; padding: 10px 12px;
    font-size: 13.5px; font-family: inherit; color: ${T.text}; background: ${T.white};
  }
  .sp-d-input:focus, .sp-d-select:focus, .sp-d-textarea:focus { outline: none; border-color: ${T.green}; box-shadow: 0 0 0 3px rgba(46,125,50,0.1); }
  .sp-d-textarea { resize: vertical; min-height: 64px; }
  .sp-d-logo-row { display: flex; align-items: center; gap: 14px; margin-bottom: 8px; }
  .sp-d-logo-preview {
    width: 56px; height: 56px; border-radius: 50%; background: ${T.greenLight};
    display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; color: ${T.green};
    overflow: hidden; flex-shrink: 0; border: 2px solid ${T.border};
  }
  .sp-d-logo-preview img { width: 100%; height: 100%; object-fit: cover; }
  .sp-d-upload-btn {
    font-size: 12px; font-weight: 700; color: ${T.green}; background: ${T.greenLight};
    border: none; border-radius: 8px; padding: 7px 13px; cursor: pointer;
  }
  .sp-d-save-btn {
    width: 100%; background: ${T.green}; color: ${T.white}; border: none; border-radius: 11px;
    padding: 12px; font-size: 14px; font-weight: 700; font-family: inherit; cursor: pointer;
    display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px;
  }
  .sp-d-save-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .sp-d-msg { border-radius: 9px; padding: 9px 12px; font-size: 12.5px; font-weight: 500; margin-bottom: 14px; }
  .sp-d-msg-success { background: ${T.greenLight}; color: ${T.green}; }
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
  Check2: () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>,  ListingsIcon: () => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#7c4dff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>,
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

  const [reviews, setReviews] = useState([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [myReview, setMyReview] = useState(null)
  const [reviewRating, setReviewRating] = useState(0)
  const [reviewHoverRating, setReviewHoverRating] = useState(0)
  const [reviewComment, setReviewComment] = useState('')
  const [reviewSubmitting, setReviewSubmitting] = useState(false)
  const [reviewMsg, setReviewMsg] = useState(null)

  useEffect(() => {
    let active = true
    async function fetchShop() {
      setLoading(true)
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (active) setCurrentUserId(user?.id ?? null)

        if (user?.id) {
          const { data: meData } = await supabase
            .from('profiles')
            .select('full_name, avatar_url, email')
            .eq('id', user.id)
            .maybeSingle()
          if (active) setCurrentUser(meData)
        }

        const { data: shopData, error: shopErr } = await supabase
          .from('shops')
          .select('*')
          .eq('slug', slug)
          .maybeSingle()

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
          const { data: listingData } = await supabase
            .from('listings')
            .select('id, title, price, price_type, images, city, promo_badge, flash_sale_price, category')
            .eq('shop_id', shopData.id)
            .eq('status', 'active')
            .order('created_at', { ascending: false })
          if (active) {
            setListings(listingData || [])
            setAllListings(listingData || [])
            setListingsLoading(false)
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
    navigate(`/chat/${shop.owner_id}`)
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
    if (!file) return
    try {
      const ext = file.name.split('.').pop()
      const path = `covers/${crypto.randomUUID()}.${ext}`
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
    if (!file) return
    try {
      const ext = file.name.split('.').pop()
      const path = `logos/${crypto.randomUUID()}.${ext}`
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
        const path = `logos/${crypto.randomUUID()}.${ext}`
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

        {/* Skeleton header */}
        <div className="sp-header">
          <div className="sp-logo-brand">Soko<span>MW</span></div>
          <div style={{ flex: 1, maxWidth: 460, height: 38, borderRadius: 19 }} className="sp-sk" />
          <div style={{ display: 'flex', gap: 16, marginLeft: 'auto' }}>
            {[80, 72, 90].map((w, i) => (
              <div key={i} className="sp-sk" style={{ width: w, height: 32, borderRadius: 8 }} />
            ))}
            <div className="sp-sk" style={{ width: 32, height: 32, borderRadius: '50%' }} />
          </div>
        </div>

        {/* Skeleton breadcrumb */}
        <div style={{ maxWidth: 1180, margin: '14px auto 0', padding: '0 24px', display: 'flex', gap: 8, alignItems: 'center' }}>
          {[60, 50, 100].map((w, i) => (
            <div key={i} className="sp-sk" style={{ width: w, height: 14 }} />
          ))}
        </div>

        {/* Skeleton cover */}
        <div style={{ maxWidth: 1180, margin: '14px auto 0', padding: '0 24px' }}>
          <div className="sp-sk" style={{ height: 230, borderRadius: 16 }} />
        </div>

        {/* Skeleton shop header card */}
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '0 24px' }}>
          <div style={{
            background: T.white, border: `1px solid ${T.border}`,
            borderRadius: 16, padding: '20px 24px 20px 168px',
            marginTop: -64, position: 'relative', display: 'flex',
            alignItems: 'flex-start', justifyContent: 'space-between', gap: 20,
          }}>
            {/* Logo skeleton */}
            <div className="sp-sk" style={{
              position: 'absolute', left: 24, top: -36,
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
        <div className="sp-notfound">
          <div style={{ fontSize: 15, fontWeight: 700 }}>Shop not found</div>
          <button className="sp-link-btn" onClick={() => navigate('/')}>← Back to SokoMW</button>
        </div>
      </div>
    )
  }

  function getSortedFiltered() {
    let result = [...listings]
    if (filterCategory !== 'all') {
      result = result.filter(l => l.category === filterCategory)
    }
    if (sortBy === 'price-low') result.sort((a, b) => (a.price || 0) - (b.price || 0))
    else if (sortBy === 'price-high') result.sort((a, b) => (b.price || 0) - (a.price || 0))
    return result
  }
  const displayListings = getSortedFiltered()

  const shopInitials = initials(shop.name)
  const listingCount = listings.length || shop.listing_count || 0
  const followerCount = shop.follower_count ?? 0
  const themeColor = shop.theme === 'gold' ? T.gold : shop.theme === 'dark' ? '#0d1f0f' : T.green
  const themeDark = shop.theme === 'gold' ? T.goldDark : shop.theme === 'dark' ? '#000' : T.greenDark
  const themeLight = shop.theme === 'gold' ? '#fff8e1' : shop.theme === 'dark' ? '#1c1c1c' : T.greenLight

  return (
    <div className="sp-root" style={{ '--theme': themeColor, '--theme-dark': themeDark, '--theme-light': themeLight }}>
      <style>{css}</style>
      {blockToast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: '#fff', color: T.text,
          padding: '12px 20px 12px 14px',
          borderRadius: 16, fontSize: 13.5, fontWeight: 600,
          boxShadow: '0 12px 40px rgba(13,31,15,0.18), 0 0 0 1px rgba(13,31,15,0.06)',
          zIndex: 999, display: 'flex', alignItems: 'center', gap: 10,
          animation: 'sp-fadeIn 0.18s ease', whiteSpace: 'nowrap',
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

      {shareToast && (
        <div style={{
          position: 'fixed', bottom: 32, left: '50%', transform: 'translateX(-50%)',
          background: '#fff', color: T.text,
          padding: '12px 20px 12px 14px',
          borderRadius: 16, fontSize: 13.5, fontWeight: 600,
          boxShadow: '0 12px 40px rgba(13,31,15,0.18), 0 0 0 1px rgba(13,31,15,0.06)',
          zIndex: 999, display: 'flex', alignItems: 'center', gap: 10,
          animation: 'sp-fadeIn 0.18s ease',
          whiteSpace: 'nowrap',
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

      {/* ── HEADER ── */}
      <div className="sp-header">
        <div className="sp-logo-brand" onClick={() => navigate('/')} style={{ cursor: 'pointer' }}>Soko<span>MW</span></div>
        <form
          className="sp-search"
          onSubmit={e => {
            e.preventDefault()
            const q = e.target.elements.shopHeaderSearch.value.trim()
            if (q) navigate(`/?search=${encodeURIComponent(q)}`)
          }}
        >
          <input
            name="shopHeaderSearch"
            placeholder="Search products, shops or categories…"
            onChange={e => {
              const q = e.target.value.toLowerCase().trim()
              if (!q) {
                setListings(allListings)
                return
              }
              const filtered = allListings.filter(l =>
                l.title?.toLowerCase().includes(q) ||
                l.city?.toLowerCase().includes(q)
              )
              setListings(filtered)
              setTab('listings')
              setTimeout(() => {
                listingsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
              }, 50)
            }}
          />
          <button type="submit" className="sp-search-icon" style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Icon.Search /></button>
        </form>
        <div className="sp-nav-actions">
          <div className="sp-nav-item" onClick={() => navigate('/')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
            Home
          </div>
          <div className="sp-nav-item" onClick={() => navigate('/shops')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>
            Shops
          </div>
          <div className="sp-nav-item" onClick={() => navigate('/chats')}><Icon.Msg />Messages</div>
          <div className="sp-nav-item" onClick={() => navigate('/notifications')}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
            Notifications
          </div>
          <div className="sp-nav-user" onClick={() => navigate(currentUserId ? '/profile' : '/login')}>
            {currentUser?.avatar_url && !avatarError ? (
              <img className="sp-nav-avatar" src={currentUser.avatar_url} alt="" onError={() => setAvatarError(true)} />
            ) : (
              <div className="sp-nav-avatar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: T.green }}>
                {currentUserId ? initials(currentUser?.full_name) : '?'}
              </div>
            )}
            <span>{currentUserId ? 'Account' : 'Sign in'}</span>
          </div>
        </div>
      </div>

      {/* ── BREADCRUMB ── */}
      <div className="sp-breadcrumb" style={{ position: 'relative', zIndex: 110 }}>
        <div className="sp-breadcrumb-trail">
          <Link to="/">Home</Link>
          <Icon.ChevronRight />
          <Link to="/shops">Shops</Link>
          <Icon.ChevronRight />
          <span className="current">{shop.name}</span>
        </div>
        <div className="sp-breadcrumb-actions" style={{ position: 'relative' }}>
          <button className="sp-link-btn" onClick={handleShareShop}>↗ Share shop</button>
          <button className="sp-link-btn" onClick={() => setMoreMenuOpen(o => !o)}>⋯</button>
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
                      <div style={{ display: 'flex', gap: 10 }}>
                        {[
                          { value: 'green', color: '#2e7d32', label: 'Green' },
                          { value: 'gold',  color: '#f9a825', label: 'Gold'  },
                          { value: 'dark',  color: '#0d1f0f', label: 'Dark'  },
                        ].map(opt => {
                          const active = shop.theme === opt.value || (!shop.theme && opt.value === 'green')
                          return (
                            <button
                              key={opt.value}
                              title={opt.label}
                              onClick={async () => {
                                const { error } = await supabase.from('shops').update({ theme: opt.value }).eq('id', shop.id)
                                if (error) { console.error('Theme update failed:', error); alert(error.message); return }
                                setShop(s => ({ ...s, theme: opt.value }))
                                setMoreMenuOpen(false)
                              }}
                              style={{
                                width: 28, height: 28, borderRadius: '50%',
                                border: '2px solid #fff',
                                boxShadow: active ? `0 0 0 2px ${opt.color}` : '0 0 0 1px rgba(0,0,0,0.08)',
                                background: opt.color, cursor: 'pointer', flexShrink: 0, padding: 0,
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              {active && <Icon.Check2 />}
                            </button>
                          )
                        })}
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
        <div className="sp-cover" style={!shop?.cover_url ? { background: `linear-gradient(135deg, ${themeColor}, ${themeDark})` } : undefined}>
          {shop.cover_url && <img src={shop.cover_url} alt="" />}
          {isOwner && (
            <div className="sp-cover-overlay" onClick={() => coverInputRef.current?.click()}>
              <button className="sp-cover-overlay-btn">
                📷 {shop.cover_url ? 'Change Cover Photo' : 'Add Cover Photo'}
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
              <div className="sp-logo-img" style={{ background: T.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 30, fontWeight: 800, color: T.green }}>
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
                  <span>{shop.rating} ({shop.review_count || 0} review{shop.review_count === 1 ? '' : 's'})</span>
                  <span>·</span>
                </>
              ) : (
                <span>No reviews yet</span>
              )}
              <span>Joined {shop.created_at ? new Date(shop.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : 'recently'}</span>
            </div>
          </div>

          <div className="sp-shophead-right">
            {isOwner ? (
              <div className="sp-owner-bar">
                <button className="sp-owner-btn primary" onClick={() => navigate('/post', { state: { shopId: shop.id } })}>
                  <Icon.Plus /> Add Product
                </button>
                <button className="sp-owner-btn" onClick={openEditDrawer}>Edit Shop</button>
                <button className="sp-owner-btn" onClick={handleShareShop}>Share Shop</button>
              </div>
            ) : (
              <>
                <div className="sp-action-row">
                  <button className="sp-btn-msg" onClick={handleMessageOwner}><Icon.Msg /> Message</button>
                  {currentUserId !== shop?.owner_id && (
                    <button
                      className="sp-btn-follow"
                      onClick={handleFollowToggle}
                      disabled={followLoading}
                      style={isFollowing ? { background: T.white, color: T.green, border: `1.5px solid ${T.green}` } : undefined}
                    >
                      {isFollowing ? <Icon.Check /> : <Icon.Plus />} {isFollowing ? 'Following' : 'Follow'}
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
        <div style={{
          maxWidth: 1180, margin: '12px auto 0', padding: '0 24px',
        }}>
          <div style={{
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
            <div style={{
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
            <div className="sp-stat-icon" style={{ background: T.greenLight }}><Icon.FollowersIcon /></div>
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
              <button className={`sp-view-btn ${viewMode === 'grid' ? 'active' : ''}`} onClick={() => setViewMode('grid')}><Icon.Grid /></button>
              <button className={`sp-view-btn ${viewMode === 'list' ? 'active' : ''}`} onClick={() => setViewMode('list')}><Icon.List /></button>
            </div>
          </div>
        )}
      </div>

      {/* ── MAIN ── */}
      <div className="sp-main">
        <div ref={listingsRef}>
          {tab === 'listings' && (
            <>
              {listingsLoading ? (
                <div style={{ padding: '32px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>Loading listings…</div>
              ) : displayListings.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: T.textMuted, fontSize: 13 }}>
                  {isOwner ? 'No products yet — click + Add Product to get started.' : 'No products listed yet.'}
                </div>
              ) : (
                <>
                  <div className="sp-grid">
                    {displayListings.map(item => (
                      <div key={item.id} className="sp-listing-card" onClick={() => navigate(`/listing/${item.id}`)}>
                        <div className="sp-listing-img-wrap">
                          {item.images?.[0] ? (
                            <img src={item.images[0]} alt={item.title} />
                          ) : (
                            <div style={{ width: '100%', height: '100%', background: T.greenLight, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 28 }}>📦</div>
                          )}
                          {item.promo_badge && item.promo_badge !== 'none' && (
                            <div className="sp-featured-badge">{
                              item.promo_badge === 'hot' ? '🔥 Hot' :
                              item.promo_badge === 'sale' ? '💸 Sale' :
                              item.promo_badge === 'new_in' ? '🆕 New' :
                              item.promo_badge === 'limited' ? '⚡ Limited' :
                              item.promo_badge === 'featured' ? '⭐ Featured' : null
                            }</div>
                          )}
                          <button className="sp-fav-btn"><Icon.Heart /></button>
                        </div>
                        <div className="sp-listing-body">
                          <div className="sp-listing-title" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 4 }}>
                            <span>{item.title}</span>
                            {shop.is_verified && (
                              <svg width="13" height="13" viewBox="0 0 24 24" style={{ flexShrink: 0, marginTop: 1 }}><path fill="#16a34a" d="M12 0a4 4 0 0 1 3.2 1.6 4 4 0 0 1 3.6 1 4 4 0 0 1 1 3.6A4 4 0 0 1 21.4 9.4a4 4 0 0 1 0 5.2A4 4 0 0 1 19.8 17.8a4 4 0 0 1-1 3.6 4 4 0 0 1-3.6 1A4 4 0 0 1 12 24a4 4 0 0 1-3.2-1.6 4 4 0 0 1-3.6-1 4 4 0 0 1-1-3.6A4 4 0 0 1 2.6 14.6a4 4 0 0 1 0-5.2A4 4 0 0 1 4.2 6.2a4 4 0 0 1 1-3.6 4 4 0 0 1 3.6-1A4 4 0 0 1 12 0Z"/><path d="m7.5 12.5 3 3 6-7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            )}
                          </div>
                          <div className="sp-listing-price">
                            {item.price_type === 'free' ? 'FREE' : item.flash_sale_price ? (
                              <>
                                <span style={{ textDecoration: 'line-through', color: T.textLight, fontSize: 11, fontWeight: 500 }}>MK {Number(item.price).toLocaleString()}</span>
                                {' '}<span style={{ color: '#dc2626' }}>MK {Number(item.flash_sale_price).toLocaleString()}</span>
                              </>
                            ) : `MK ${Number(item.price).toLocaleString()}`}
                          </div>
                          <div className="sp-listing-city"><Icon.Pin /> {item.city}</div>
                          {shop.rating > 0 && (
                            <div
                              className="sp-rating-tip-wrap"
                              style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 4, fontSize: 11.5, color: T.textMuted, position: 'relative', cursor: 'help' }}
                            >
                              <span style={{ color: T.gold, display: 'flex' }}><Icon.Star /></span>
                              <span style={{ fontWeight: 700, color: T.text }}>{shop.rating}</span>
                              <span>({shop.review_count || 0})</span>

                              <div className="sp-rating-tip">
                                <div className="sp-rating-tip-stars">
                                  <span className="sp-rating-tip-score">{shop.rating}</span>
                                  <div style={{ display: 'flex', gap: 2 }}>
                                    {[1, 2, 3, 4, 5].map(n => {
                                      const filled = shop.rating >= n
                                      const half = !filled && shop.rating >= n - 0.5
                                      return (
                                        <span key={n} style={{ position: 'relative', display: 'flex', width: 13, height: 13 }}>
                                          <svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,255,255,0.15)"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>
                                          {(filled || half) && (
                                            <span style={{ position: 'absolute', inset: 0, overflow: 'hidden', width: half ? '50%' : '100%' }}>
                                              <svg width="13" height="13" viewBox="0 0 24 24" fill={T.gold}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26"/></svg>
                                            </span>
                                          )}
                                        </span>
                                      )
                                    })}
                                  </div>
                                </div>
                                <div style={{ color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
                                  Based on <strong style={{ color: '#fff' }}>{shop.review_count || 0}</strong> buyer review{shop.review_count === 1 ? '' : 's'}
                                  {shop.review_count > 0 && shop.review_count <= 2 && (
                                    <span style={{ color: T.gold }}> · new seller</span>
                                  )}
                                </div>
                                <div style={{
                                  marginTop: 9, paddingTop: 9, borderTop: '1px solid rgba(255,255,255,0.12)',
                                  color: '#fff', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5,
                                }}>
                                  See Reviews tab above
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  {displayListings.length >= 6 && (
                    <button className="sp-viewall">View all {shop.listing_count || listings.length} listings <Icon.ChevronRight /></button>
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

        {/* ── SIDEBAR ── */}
        <div>
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
      </div>

      {/* ── SIMILAR SHOPS ── */}
      <div className="sp-similar">
        <div className="sp-similar-head">
          <h3>More shops you might like</h3>
          <span onClick={() => navigate('/shops')} style={{ fontSize: 13, fontWeight: 700, color: T.green, cursor: 'pointer' }}>View all shops</span>
        </div>
        <div className="sp-similar-grid">
          {similarShops.length === 0 ? (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', color: T.textMuted, fontSize: 13, padding: '20px 0' }}>
              No similar shops found.
            </div>
          ) : similarShops.map(s => (
            <div key={s.id} className="sp-similar-card" onClick={() => navigate(`/shop/${s.slug}`)}>
              <div className="sp-similar-avatar" style={{
                background: s.logo_url ? '#111' : 'linear-gradient(135deg,#1b5e20,#2e7d32)',
              }}>
                {s.logo_url
                  ? <img src={s.logo_url} alt={s.name} />
                  : initials(s.name)
                }
              </div>
              <div className="sp-similar-info">
                <div className="sp-similar-name" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {s.name}
                  {s.is_verified && (
                    <svg width="13" height="13" viewBox="0 0 24 24"><path fill="#16a34a" d="M12 0a4 4 0 0 1 3.2 1.6 4 4 0 0 1 3.6 1 4 4 0 0 1 1 3.6A4 4 0 0 1 21.4 9.4a4 4 0 0 1 0 5.2A4 4 0 0 1 19.8 17.8a4 4 0 0 1-1 3.6 4 4 0 0 1-3.6 1A4 4 0 0 1 12 24a4 4 0 0 1-3.2-1.6 4 4 0 0 1-3.6-1 4 4 0 0 1-1-3.6A4 4 0 0 1 2.6 14.6a4 4 0 0 1 0-5.2A4 4 0 0 1 4.2 6.2a4 4 0 0 1 1-3.6 4 4 0 0 1 3.6-1A4 4 0 0 1 12 0Z"/><path d="m7.5 12.5 3 3 6-7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  )}
                </div>
                <div className="sp-similar-cat">{s.category || 'General'}</div>
                <div className="sp-similar-bottom">
                  <span className="sp-similar-followers">
                    {s.follower_count >= 1000 ? `${(s.follower_count/1000).toFixed(1)}K` : s.follower_count || 0} followers
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