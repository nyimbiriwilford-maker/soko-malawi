import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SERVICE_CATS, CITIES, SORT_OPTIONS } from './serviceData'
import ServiceForm from './ServiceForm'
import ProviderModal from './ProviderModal'
import MyListings from './MyListings'
import SokoNav from '../components/SokoNav'
import { AnimatePresence, motion } from 'framer-motion'
import { Search, SlidersHorizontal, X, ChevronDown, LayoutGrid, List, MapPin, ArrowUpDown, Filter, RotateCcw, Wrench, Zap } from 'lucide-react'

/* Soko marketplace tokens â€” match Home / Search / Shops */
const G = {
  green:     '#7c5cff',
  greenDark: '#5b3df5',
  greenLight:'#efeaff',
  greenMid:  '#ddd2ff',
  orange:    '#F9AB00',
  bg:        '#f8f9fa',
  card:      '#ffffff',
  text:      '#202124',
  textMid:   '#5f6368',
  textSoft:  '#9aa0a6',
  border:    '#e8eaed',
  borderMid: '#e8eaed',
  gray100:   '#f1f3f4',
  gray900:   '#202124',
  radius:    '14px',
  radiusSm:  '11px',
  shadow:    '0 1px 3px rgba(0,0,0,.08), 0 4px 16px rgba(0,0,0,.04)',
}

const css = `
  * { box-sizing: border-box; margin:0; padding:0; }
  @keyframes svc-fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes svc-shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
  @keyframes svc-slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
  @keyframes svc-sheetUp { from{transform:translateY(70%);opacity:.5} to{transform:translateY(0);opacity:1} }
  @keyframes svc-fadeIn { from{opacity:0} to{opacity:1} }

  .soko-services {
    font-family: 'Plus Jakarta Sans', Inter, 'DM Sans', system-ui, sans-serif;
    background: #f4f6f5;
    min-height: 100vh; min-height: 100dvh;
    color: #111827;
    -webkit-tap-highlight-color: transparent;
    padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
  }

  /* â”€â”€ Sub-header â”€â”€ */
  .svc-subhead {
    background: #fff;
    border-bottom: 1px solid #e5e7eb;
    position: sticky; top: 0; z-index: 40;
    backdrop-filter: blur(12px);
    background: rgba(255,255,255,0.92);
  }
  .svc-subhead-inner { max-width: 1180px; margin: 0 auto; }

  .svc-title-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 20px 12px; gap: 12px;
  }
  .svc-title {
    font-family: 'Sora', 'Plus Jakarta Sans', system-ui, sans-serif;
    font-size: clamp(22px, 3.5vw, 28px); font-weight: 800;
    letter-spacing: -0.8px; color: #0f1410; margin: 0;
  }
  .svc-sub {
    font-size: 13px; color: #6b7280; margin-top: 2px; font-weight: 500;
  }
  .svc-cta {
    display: inline-flex; align-items: center; gap: 6px;
    background: #0f1410; color: #fff; border: none; border-radius: 12px;
    padding: 11px 18px; font-size: 13.5px; font-weight: 700; font-family: inherit;
    min-height: 44px; cursor: pointer; flex-shrink: 0; touch-action: manipulation;
    transition: all .2s ease;
  }
  .svc-cta:hover { background: #1a1f1b; transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,.15); }
  .svc-cta:active { transform: translateY(0); }

  /* â”€â”€ Search â”€â”€ */
  .svc-search-row {
    display: flex; gap: 8px; align-items: center; padding: 0 20px 14px;
  }
  .svc-search-box {
    flex: 1; display: flex; align-items: center; gap: 10px;
    background: #f4f6f5; border: 1.5px solid #e5e7eb; border-radius: 14px;
    padding: 0 14px; min-height: 46px;
    transition: all .2s ease;
  }
  .svc-search-box:focus-within {
    border-color: #7c5cff; box-shadow: 0 0 0 3px rgba(124,92,255,.1); background: #fff;
  }
  .svc-search-box input {
    flex: 1; border: none; background: transparent; font-size: 14px;
    color: #111827; font-family: inherit; outline: none; min-height: 44px;
  }
  .svc-search-box input::placeholder { color: #9ca3af; }
  .svc-filter-btn {
    position: relative; padding: 0 16px; min-height: 46px;
    border: 1.5px solid #e5e7eb; border-radius: 14px;
    background: #fff; color: #4b5563; font-size: 13px; font-weight: 700;
    display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
    flex-shrink: 0; font-family: inherit; cursor: pointer;
    transition: all .2s ease;
  }
  .svc-filter-btn:hover { border-color: #d1d5db; background: #f9fafb; }
  .svc-filter-btn.active {
    border-color: #0f1410; background: #f3f4f6; color: #0f1410;
  }
  .svc-filter-btn--mobile { display: none; }
  .svc-filter-backdrop { display: none; }
  .svc-filter-head { display: none; }
  .svc-filter-apply-row { display: none; }
  .svc-filter-count {
    display: inline-flex; align-items: center; justify-content: center;
    min-width: 18px; height: 18px; padding: 0 5px;
    background: #7c5cff; color: #fff; border-radius: 999px;
    font-size: 10.5px; font-weight: 800;
  }
  .svc-header-actions { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

  /* â”€â”€ Tabs â”€â”€ */
  .svc-tabs {
    display: flex; gap: 3px; background: #f3f4f6; border-radius: 14px;
    padding: 4px; margin: 14px auto 0; max-width: 1160px; position: relative;
  }
  @media (max-width: 900px) {
    .svc-tabs { margin: 12px 14px 0; max-width: none; }
  }
  .svc-tab {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
    background: none; border: none; border-radius: calc(14px - 4px);
    padding: 10px 14px; font-size: 13px; font-weight: 600;
    color: #9ca3af; cursor: pointer; font-family: inherit; transition: all .2s;
  }
  .svc-tab:hover { color: #6b7280; }
  .svc-tab.active { background: transparent; color: #111827; font-weight: 700; }
  .svc-tab.active .svc-tab-inner { color: #111827; }
  .svc-tab .svc-tab-badge { position: relative; z-index: 1; }
  .svc-tab-badge {
    background: #0f1410; color: #fff; font-size: 10px; font-weight: 800;
    padding: 1px 7px; border-radius: 999px; line-height: 1.4;
  }
  .svc-tab-pill {
    position: absolute; inset: 2px; border-radius: calc(14px - 6px);
    background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.08);
  }
  .svc-tab { position: relative; }
  .svc-tab .svc-tab-inner {
    position: relative; z-index: 1; display: inline-flex; align-items: center;
    justify-content: center; gap: 6px;
  }

  /* â”€â”€ View transitions â”€â”€ */
  .svc-view { width: 100%; }

  /* â”€â”€ Chips â”€â”€ */
  .svc-chip-row {
    display: flex; gap: 6px; overflow-x: auto; flex: 1;
    padding: 0 20px 14px; scrollbar-width: none;
  }
  .svc-chip-row::-webkit-scrollbar { display: none; }
  .svc-chip {
    padding: 8px 14px; border-radius: 999px; border: 1.5px solid #e5e7eb;
    background: #fff; color: #6b7280; font-size: 12.5px; font-weight: 600;
    white-space: nowrap; flex-shrink: 0; font-family: inherit; cursor: pointer;
    transition: all .15s ease;
  }
  .svc-chip:hover { border-color: #d1d5db; background: #f9fafb; }
  .svc-chip.active {
    background: #0f1410; border-color: #0f1410; color: #fff;
  }

  /* â”€â”€ Filter Drawer â”€â”€ */
  .filter-drawer { animation: svc-slideDown .2s ease both; }

  /* â”€â”€ Layout â”€â”€ */
  .svc-layout {
    max-width: 1200px; margin: 0 auto;
    display: grid; grid-template-columns: 260px 1fr; gap: 24px;
    padding: 20px 20px 32px;
    align-items: start;
  }
  @media (max-width: 900px) {
    .svc-layout { grid-template-columns: 1fr; padding: 12px 14px 32px; }
    .svc-sidebar { display: none; }
    .svc-sidebar.open {
      display: flex; flex-direction: column;
      position: fixed; left: 10px; right: 10px; bottom: 0; top: auto;
      max-height: 82vh; overflow: hidden;
      z-index: 70; border-radius: 18px 18px 0 0; margin: 0;
      border: none; border-top: 1px solid #e5e7eb;
      box-shadow: 0 -8px 24px rgba(0,0,0,0.14);
      animation: svc-sheetUp .32s cubic-bezier(.22,1,.36,1) both;
      overscroll-behavior: contain;
    }
    .svc-sidebar.open .svc-sidebar-inner { flex: 1 1 auto; overflow-y: auto; min-height: 0; padding-bottom: 8px; }
    .svc-filter-backdrop {
      display: block; position: fixed; inset: 0; z-index: 60;
      background: rgba(15,20,16,0.42);
      animation: svc-fadeIn .25s ease both;
    }
    .svc-filter-head { display: flex; }
    .svc-filter-btn--mobile { display: inline-flex; }
    .svc-filter-apply-row {
      display: block; flex-shrink: 0;
      padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
      background: #fff; border-top: 1px solid #f3f4f6;
    }
  }

  /* â”€â”€ Sidebar â”€â”€ */
  .svc-sidebar {
    position: sticky; top: 80px;
    background: #fff; border: 1px solid #e5e7eb; border-radius: 16px;
    overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,.04);
  }
  .svc-sidebar-inner { padding: 16px; }

  .svc-filter-backdrop { z-index: 60; }
  .svc-filter-head {
    position: relative;
    align-items: center; justify-content: space-between;
    padding: 22px 16px 10px;
    border-bottom: 1px solid #f3f4f6;
  }
  .svc-sheet-handle {
    position: absolute; top: 8px; left: 50%; transform: translateX(-50%);
    width: 40px; height: 4px; border-radius: 999px;
    background: #d1d5db; flex-shrink: 0;
  }
  .svc-sheet-handle:active { background: #9ca3af; }
  .svc-filter-head-title {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 14px; font-weight: 800; color: #0f1410;
  }
  .svc-filter-head-close {
    display: flex; align-items: center; justify-content: center;
    width: 32px; height: 32px; border-radius: 50%;
    background: #f3f4f6; border: none; color: #374151; cursor: pointer;
    transition: all .15s;
  }
  .svc-filter-head-close:hover { background: #e5e7eb; }
  .svc-filter-head-close:active { transform: scale(0.92); }

  .svc-side-section { margin-bottom: 18px; }
  .svc-side-section:last-child { margin-bottom: 0; }

  .svc-side-label {
    display: flex; align-items: center; gap: 6px;
    font-size: 11px; font-weight: 700; color: #9ca3af;
    text-transform: uppercase; letter-spacing: 0.06em;
    margin-bottom: 8px;
  }

  .svc-side-search {
    display: flex; align-items: center; gap: 8px;
    background: #f4f6f5; border: 1.5px solid #e5e7eb; border-radius: 10px;
    padding: 0 10px; min-height: 38px;
    transition: all .2s;
  }
  .svc-side-search:focus-within { border-color: #7c5cff; background: #fff; }
  .svc-side-search input {
    flex: 1; border: none; background: transparent; font-size: 13px;
    color: #111827; font-family: inherit; outline: none; min-height: 36px;
  }
  .svc-side-search input::placeholder { color: #9ca3af; }
  .svc-side-search--mini { min-height: 34px; padding: 0 8px; margin-bottom: 6px; }
  .svc-side-clear {
    display: flex; align-items: center; justify-content: center;
    background: none; border: none; color: #9ca3af; padding: 2px;
    cursor: pointer; border-radius: 4px;
  }
  .svc-side-clear:hover { color: #6b7280; background: #f3f4f6; }

  .svc-side-tabs {
    display: flex; gap: 3px; background: #f3f4f6; border-radius: 10px; padding: 3px;
  }
  .svc-side-tab {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 5px;
    background: none; border: none; border-radius: 8px;
    padding: 8px 10px; font-size: 12px; font-weight: 600;
    color: #9ca3af; cursor: pointer; font-family: inherit; transition: all .2s;
  }
  .svc-side-tab.active { background: #fff; color: #111827; font-weight: 700; box-shadow: 0 1px 2px rgba(0,0,0,.05); }
  .svc-side-badge {
    background: #0f1410; color: #fff; font-size: 9px; font-weight: 800;
    padding: 1px 6px; border-radius: 999px; line-height: 1.4;
  }

  .svc-side-options { display: flex; flex-direction: column; gap: 2px; }
  .svc-side-opt {
    display: flex; align-items: center; justify-content: space-between;
    width: 100%; padding: 8px 10px; border: none; border-radius: 8px;
    background: none; font-size: 12.5px; font-weight: 500; color: #4b5563;
    cursor: pointer; font-family: inherit; transition: all .15s; text-align: left;
  }
  .svc-side-opt:hover { background: #f4f6f5; color: #111827; }
  .svc-side-opt.active { background: #efeaff; color: #5b3df5; font-weight: 700; }
  .svc-side-opt-count {
    font-size: 11px; font-weight: 600; color: #9ca3af;
    background: #f3f4f6; padding: 1px 7px; border-radius: 999px;
  }
  .svc-side-cat, .svc-side-sort {
    display: inline-flex; align-items: center; gap: 7px;
  }
  .svc-side-cat svg, .svc-side-sort svg { color: inherit; }
  .svc-side-opt.active .svc-side-opt-count { background: #ddd2ff; color: #5b3df5; }

  .svc-side-clear-btn {
    display: flex; align-items: center; justify-content: center; gap: 6px;
    width: 100%; padding: 9px; border: 1.5px solid #fecaca; border-radius: 10px;
    background: #fef2f2; color: #dc2626; font-size: 12px; font-weight: 700;
    cursor: pointer; font-family: inherit; transition: all .15s; margin-top: 4px;
  }
  .svc-side-clear-btn:hover { background: #fee2e2; border-color: #f87171; }

  .svc-filter-apply {
    display: flex; align-items: center; justify-content: center; gap: 8px;
    width: 100%; padding: 13px 0; border: none; border-radius: 12px;
    background: #7c5cff; color: #fff;
    font-size: 13.5px; font-weight: 800; font-family: inherit; cursor: pointer;
    transition: all .15s;
  }
  .svc-filter-apply:hover { background: #5b3df5; }
  .svc-filter-apply:active { transform: scale(0.98); }

  /* â”€â”€ Main â”€â”€ */
  .svc-main { min-width: 0; }
  .svc-main-header {
    display: flex; align-items: flex-start; justify-content: space-between;
    margin-bottom: 16px; gap: 12px 16px; flex-wrap: wrap;
  }
  .svc-main-heading { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .svc-main-overline {
    display: inline-flex; align-items: center; gap: 7px;
    font-size: 10px; font-weight: 800; letter-spacing: 0.14em;
    text-transform: uppercase; color: #7c5cff;
  }
  .svc-main-overline-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: #7c5cff; box-shadow: 0 0 0 3px rgba(124,92,255,0.15);
  }
  .svc-main-title {
    font-family: 'Sora', 'Plus Jakarta Sans', system-ui, sans-serif;
    font-size: clamp(22px, 3.4vw, 30px); font-weight: 800;
    letter-spacing: -0.8px; color: #0f1410; margin: 0; line-height: 1.1;
  }
  .svc-main-sub {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 13px; color: #6b7280; margin-top: 4px; font-weight: 500;
  }
  .svc-main-sub-dot {
    width: 5px; height: 5px; border-radius: 50%; background: #5de89e; flex-shrink: 0;
  }

  .svc-active-tags {
    display: flex; gap: 6px; flex-wrap: wrap; margin-bottom: 14px;
  }
  .svc-clear-all-tag {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 10px; background: #fff; color: #7c5cff;
    border: 1.5px solid #ddd2ff; border-radius: 999px;
    font-size: 11px; font-weight: 800; cursor: pointer; font-family: inherit;
    transition: all .15s ease;
  }
  .svc-clear-all-tag:hover { background: #efeaff; border-color: #7c5cff; }
  .svc-clear-all-tag:active { transform: scale(0.96); }
  .svc-tag {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 4px 10px; background: #f3f4f6; color: #374151;
    border-radius: 999px; font-size: 11px; font-weight: 600;
  }
  .svc-tag button {
    display: flex; align-items: center; background: none; border: none;
    color: #9ca3af; padding: 0; cursor: pointer; border-radius: 50%;
  }
  .svc-tag button:hover { color: #dc2626; }
  .svc-tag--sort { background: #fffbeb; color: #92400e; }
  .svc-tag--sort button { color: #d97706; }

  .svc-empty {
    text-align: center; padding: 64px 24px;
    background: #fff; border: 1px solid #e5e7eb; border-radius: 16px;
  }
  .svc-empty-icon {
    width: 72px; height: 72px; border-radius: 50%; background: #f3f4f6;
    display: flex; align-items: center; justify-content: center;
    margin: 0 auto 16px; color: #9ca3af;
  }
  .svc-empty-title { font-size: 17px; font-weight: 800; color: #111827; margin-bottom: 4px; }
  .svc-empty-sub { font-size: 13px; color: #9ca3af; margin-bottom: 20px; }
  .svc-empty-btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: #0f1410; color: #fff; border: none; border-radius: 10px;
    padding: 11px 20px; font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer;
  }
  .svc-empty-btn:hover { background: #1a1f1b; }

  .svc-form-wrap { max-width: 600px; margin: 20px auto; padding: 0 16px; }

  /* â”€â”€ My Listings â”€â”€ */
  .ml-wrap { max-width: 800px; margin: 20px auto; padding: 0 16px 32px; }
  .ml-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; gap: 12px; }
  .ml-title { font-family: 'Sora', system-ui, sans-serif; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; color: #0f1410; margin: 0; }
  .ml-sub { font-size: 13px; color: #6b7280; margin-top: 2px; }
  .ml-add-btn {
    display: inline-flex; align-items: center; gap: 6px;
    background: #7c5cff; color: #fff; border: none; border-radius: 10px;
    padding: 10px 16px; font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer;
    transition: all .2s;
  }
  .ml-add-btn:hover { background: #5b3df5; transform: translateY(-1px); }

  .ml-stats {
    display: flex; align-items: center; gap: 0;
    background: #fff; border: 1px solid #e5e7eb; border-radius: 14px;
    padding: 16px 20px; margin-bottom: 16px;
  }
  .ml-stat { flex: 1; text-align: center; }
  .ml-stat-num { font-size: 22px; font-weight: 800; color: #111827; }
  .ml-stat-label { font-size: 11px; color: #9ca3af; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; margin-top: 2px; }
  .ml-stat-divider { width: 1px; height: 32px; background: #e5e7eb; }

  .ml-list { display: flex; flex-direction: column; gap: 10px; }

  .ml-card {
    background: #fff; border: 1px solid #e5e7eb; border-radius: 14px;
    padding: 14px 16px; transition: all .2s ease;
  }
  .ml-card:hover { border-color: #c0d8c9; box-shadow: 0 2px 8px rgba(0,0,0,.04); }
  .ml-card--paused { opacity: 0.7; }

  .ml-card-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .ml-card-avatar {
    width: 36px; height: 36px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 800; color: #fff; flex-shrink: 0;
  }
  .ml-card-info { flex: 1; min-width: 0; }
  .ml-card-name { font-size: 14px; font-weight: 700; color: #111827; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .ml-card-meta { font-size: 11.5px; color: #9ca3af; display: flex; align-items: center; gap: 4px; margin-top: 2px; }
  .ml-card-dot { width: 3px; height: 3px; border-radius: 50%; background: #d1d5db; }

  .ml-card-right { text-align: right; flex-shrink: 0; }
  .ml-card-rate { font-size: 12px; font-weight: 800; color: #7c5cff; }
  .ml-card-status { font-size: 11px; font-weight: 600; color: #9ca3af; display: flex; align-items: center; gap: 4px; justify-content: flex-end; margin-top: 3px; }
  .ml-card-status--active { color: #7c5cff; }
  .ml-card-status-dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
  .ml-card--paused .ml-card-status-dot { background: #f59e0b; }

  .ml-card-stats { display: flex; gap: 14px; margin-bottom: 8px; }
  .ml-card-stat { display: flex; align-items: center; gap: 4px; font-size: 11px; color: #9ca3af; font-weight: 500; }

  .ml-card-warning {
    display: flex; align-items: center; gap: 6px;
    background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px;
    padding: 8px 12px; font-size: 11.5px; color: #92400e; font-weight: 600;
    margin-bottom: 8px;
  }

  .ml-card-actions { display: flex; gap: 6px; border-top: 1px solid #f3f4f6; padding-top: 10px; }
  .ml-action {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 7px 12px; border: none; border-radius: 8px;
    font-size: 12px; font-weight: 700; font-family: inherit; cursor: pointer;
    transition: all .15s;
  }
  .ml-action--edit { background: #f3f4f6; color: #374151; }
  .ml-action--edit:hover { background: #e5e7eb; }
  .ml-action--toggle { background: #efeaff; color: #5b3df5; }
  .ml-action--toggle:hover { background: #ddd2ff; }
  .ml-action--delete { background: #fef2f2; color: #dc2626; padding: 7px 10px; }
  .ml-action--delete:hover { background: #fee2e2; }
  .ml-action--loading { opacity: 0.5; cursor: not-allowed; }

  .ml-empty { text-align: center; padding: 64px 24px; background: #fff; border: 1px solid #e5e7eb; border-radius: 16px; }
  .ml-empty-icon { width: 72px; height: 72px; border-radius: 50%; background: #f3f4f6; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; color: #9ca3af; }
  .ml-empty-title { font-size: 17px; font-weight: 800; color: #111827; margin-bottom: 4px; }
  .ml-empty-sub { font-size: 13px; color: #9ca3af; margin-bottom: 20px; }
  .ml-empty-btn { display: inline-flex; align-items: center; gap: 6px; background: #0f1410; color: #fff; border: none; border-radius: 10px; padding: 11px 20px; font-size: 13px; font-weight: 700; font-family: inherit; cursor: pointer; }
  .ml-empty-btn:hover { background: #1a1f1b; }

  .ml-modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 2000; backdrop-filter: blur(4px); }
  .ml-modal { background: #fff; border-radius: 20px; padding: 28px; width: 300px; text-align: center; position: relative; box-shadow: 0 20px 60px rgba(0,0,0,0.15); }
  .ml-modal-close { position: absolute; top: 12px; right: 12px; background: #f3f4f6; border: none; border-radius: 50%; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: #6b7280; }
  .ml-modal-icon { width: 56px; height: 56px; border-radius: 50%; background: #fef2f2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 14px; }
  .ml-modal-title { font-size: 17px; font-weight: 800; color: #111827; margin-bottom: 4px; }
  .ml-modal-desc { font-size: 13px; color: #9ca3af; margin-bottom: 20px; line-height: 1.5; }
  .ml-modal-actions { display: flex; gap: 8px; }
  .ml-modal-cancel { flex: 1; background: #f3f4f6; border: none; border-radius: 10px; padding: 11px; font-size: 13px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .ml-modal-cancel:hover { background: #e5e7eb; }
  .ml-modal-delete { flex: 1; background: #dc2626; color: #fff; border: none; border-radius: 10px; padding: 11px; font-size: 13px; font-weight: 700; cursor: pointer; font-family: inherit; }
  .ml-modal-delete:hover { background: #b91c1c; }

  .svc-body {
    max-width: 1180px; margin: 0 auto; padding: 8px 16px 32px;
  }
  .svc-grid {
    display: grid; gap: 16px;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 250px), 1fr));
  }

  /* â”€â”€ Cards â”€â”€ */
  /* â”€â”€ Cards (matches Home service cards) â”€â”€ */
  .svc-card {
    flex-shrink: 0;
    width: 100%;
    border: 1px solid #e5e7eb;
    border-radius: 16px;
    overflow: hidden;
    background: #fff;
    cursor: pointer;
    padding: 0;
    text-align: left;
    font-family: inherit;
    box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    transition: transform 0.25s ease, box-shadow 0.25s ease, border-color 0.25s ease;
    display: flex;
    flex-direction: column;
    animation: svc-fadeUp .4s ease both;
  }
  .svc-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 10px 28px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.03);
    border-color: #7c5cff;
  }
  .svc-card:active { transform: scale(0.97); }
  @media (hover: none) {
    .svc-card:hover { transform: none; box-shadow: 0 1px 3px rgba(0,0,0,0.04); border-color: #e5e7eb; }
  }

  .sc-top {
    position: relative; width: 100%; height: 100px; flex-shrink: 0;
    overflow: hidden; background: #efeaff;
  }
  .sc-img {
    width: 100%; height: 100%;
    object-fit: cover; display: block;
    transition: transform 0.35s ease;
  }
  .svc-card:hover .sc-img { transform: scale(1.08); }
  .sc-fallback {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    color: #7c5cff; opacity: 0.6;
  }
  .sc-overlay {
    position: absolute; inset: 0;
    background: linear-gradient(180deg, transparent 55%, rgba(0,0,0,0.35) 100%);
    pointer-events: none;
  }
  .sc-cat {
    position: absolute; bottom: 8px; left: 8px;
    font-size: 9.5px; font-weight: 800;
    padding: 3px 9px; border-radius: 999px;
    background: rgba(255,255,255,0.92);
    color: #7c5cff;
    backdrop-filter: blur(4px);
    box-shadow: 0 1px 3px rgba(0,0,0,0.06);
    max-width: calc(100% - 16px);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .sc-body {
    padding: 10px 12px 12px;
    display: flex; flex-direction: column; gap: 4px;
    min-width: 0; flex: 1;
  }
  .sc-name {
    font-size: 13.5px; font-weight: 800; color: #202124; line-height: 1.25;
    overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  }
  .sc-meta-row {
    display: flex; align-items: center; justify-content: space-between;
    gap: 6px; margin-top: auto;
  }
  .sc-loc {
    display: inline-flex; align-items: center; gap: 3px;
    font-size: 10.5px; font-weight: 600; color: #9aa0a6;
    min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .sc-rate {
    font-size: 10.5px; font-weight: 800;
    padding: 2px 8px; border-radius: 999px;
    background: #efeaff; color: #7c5cff;
    white-space: nowrap; flex-shrink: 0;
  }
  .sc-cta-row {
    margin-top: 2px;
  }
  .sc-cta-btn {
    display: flex; align-items: center; justify-content: center; gap: 4px;
    width: 100%; padding: 7px 0;
    font-size: 11.5px; font-weight: 800;
    border-radius: 999px;
    background: #7c5cff;
    color: #fff;
    transition: opacity 0.2s;
    letter-spacing: 0.1px;
  }
  .sc-cta-btn:hover { opacity: 0.9; }

  .skeleton {
    background: linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%);
    background-size:400px 100%; animation: svc-shimmer 1.4s infinite; border-radius:16px;
  }
  button { font-family: inherit; cursor: pointer; }
  input { font-family: inherit; }
`

export default function Services() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'browse')
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [navUser, setNavUser] = useState(null)
  const [notifCount, setNotifCount] = useState(0)
  const [navSearch, setNavSearch] = useState('')
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [editingService, setEditingService] = useState(null)
  const [search, setSearch] = useState('')
  const [activeCat, setActiveCat] = useState('')
  const [activeCity, setActiveCity] = useState('All')
const [sortBy, setSortBy] = useState('newest')                                                          
  const [filterOpen, setFilterOpen] = useState(false)                                                  
  const [catSearch, setCatSearch] = useState('')                                                        
  const [citySearch, setCitySearch] = useState('')                                                        
  const [sheetDrag, setSheetDrag] = useState(0)                                                            
  const asideRef = useRef(null)                                                                            
  const startYRef = useRef(null)                                                                           

  useEffect(() => { if (!filterOpen) setSheetDrag(0) }, [filterOpen])

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    if (user) {
      const [{ data: profile }, { data: shop }, { count }] = await Promise.all([
        supabase.from('profiles').select('full_name, avatar_url, account_type').eq('id', user.id).maybeSingle(),
        supabase.from('shops').select('slug').eq('owner_id', user.id).maybeSingle(),
        supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
      ])
      setNavUser({
        ...user,
        full_name: profile?.full_name || null,
        avatar_url: profile?.avatar_url || null,
        account_type: profile?.account_type,
        shop_slug: shop?.slug || null,
      })
      setNotifCount(count || 0)
    }
    await loadServices()
  }

  async function loadServices() {
    setLoading(true)
    const { data } = await supabase
      .from('services').select('*').eq('status', 'active').order('created_at', { ascending: false })
    const list = data || []

    const providerIds = [...new Set(list.map(s => s.provider_id).filter(Boolean))]
    const profileMap = {}
    if (providerIds.length) {
      const { data: profiles } = await supabase
        .from('profiles').select('id, full_name, avatar_url, account_type, district')
        .in('id', providerIds)
      const shopAccountIds = (profiles || [])
        .filter(p => p.account_type === 'shop')
        .map(p => p.id)
      const shopMap = {}
      if (shopAccountIds.length) {
        const { data: shops } = await supabase
          .from('shops')
          .select('owner_id, name')
          .in('owner_id', shopAccountIds)
        ;(shops || []).forEach(s => { shopMap[s.owner_id] = shopMap[s.owner_id] || s.name })
      }
      ;(profiles || []).forEach(p => { profileMap[p.id] = { ...p, shop_name: shopMap[p.id] || null } })
    }

    setServices(list.map(s => ({
      ...s,
      profile: profileMap[s.provider_id] || null,
    })))
    setLoading(false)
  }

  let filtered = services.filter(s => {
    if (activeCat && s.category !== activeCat) return false
    if (activeCity !== 'All' && s.city !== activeCity) return false
    if (search) {
      const q = search.toLowerCase()
      const hit = (s.name||'').toLowerCase().includes(q)
        || (s.description||'').toLowerCase().includes(q)
        || (s.category||'').toLowerCase().includes(q)
        || (s.skills||[]).some(sk => sk.toLowerCase().includes(q))
        || (s.tags||[]).some(t => t.toLowerCase().includes(q))
      if (!hit) return false
    }
    return true
  })
  if (sortBy==='rating')   filtered = [...filtered].sort((a,b) => (b.rating||0)-(a.rating||0))
  if (sortBy==='views')    filtered = [...filtered].sort((a,b) => (b.views||0)-(a.views||0))
  if (sortBy==='verified') filtered = [...filtered].sort((a,b) => (b.verified?1:0)-(a.verified?1:0))

  const catCounts = {}
  services.forEach(s => { catCounts[s.category] = (catCounts[s.category]||0)+1 })
  const cityCounts = {}
  services.forEach(s => { if (s.city) cityCounts[s.city] = (cityCounts[s.city]||0)+1 })
  const myServices = services.filter(s => s.provider_id === currentUser?.id)

  const activeFiltersCount = [activeCat?1:0, activeCity!=='All'?1:0, sortBy!=='newest'?1:0].reduce((a,b)=>a+b,0)

  return (
    <div className="soko-services">
      <style>{css}</style>

      <SokoNav
        user={navUser}
        notifCount={notifCount}
        search={navSearch}
        setSearch={setNavSearch}
        navigate={navigate}
        activePillar="services"
        ctaLabel="List service"
        onCta={() => { setEditingService(null); setTab('post') }}
      />

      {(tab === 'browse' || tab === 'mine') && (
        <nav className="svc-tabs">
          <button type="button" className={`svc-tab${tab === 'browse' ? ' active' : ''}`} onClick={() => setTab('browse')}>
            {tab === 'browse' && <motion.span layoutId="svc-tab-pill" className="svc-tab-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="svc-tab-inner"><LayoutGrid size={15} strokeWidth={2.2} /> All Services</span>
          </button>
          <button type="button" className={`svc-tab${tab === 'mine' ? ' active' : ''}`} onClick={() => setTab('mine')}>
            {tab === 'mine' && <motion.span layoutId="svc-tab-pill" className="svc-tab-pill" transition={{ type: 'spring', stiffness: 500, damping: 38 }} />}
            <span className="svc-tab-inner"><List size={15} strokeWidth={2.2} /> My Services</span>
            {myServices.length > 0 && <span className="svc-tab-badge">{myServices.length}</span>}
          </button>
        </nav>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          className="svc-view"
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
      {tab === 'browse' ? (
        <div className="svc-layout">
          {filterOpen && <div className="svc-filter-backdrop" onClick={() => setFilterOpen(false)} />}
          {/* â”€â”€ Left Sidebar â”€â”€ */}
          <aside
            ref={asideRef}
            className={`svc-sidebar${filterOpen ? ' open' : ''}`}
            style={{ translate: sheetDrag > 0 ? `0 ${sheetDrag}px` : undefined }}
            onTouchStart={e => { startYRef.current = e.touches[0].clientY }}
            onTouchMove={e => {
              const sy = startYRef.current
              if (sy == null) return
              const dy = e.touches[0].clientY - sy
              const inner = asideRef.current && asideRef.current.querySelector('.svc-sidebar-inner')
              if (dy > 0 && inner && inner.scrollTop <= 0) setSheetDrag(Math.min(dy, 220))
            }}
            onTouchEnd={() => {
              startYRef.current = null
              if (sheetDrag > 80) { setFilterOpen(false) }
              setSheetDrag(0)
            }}
          >
            <div className="svc-filter-head">
              <span className="svc-sheet-handle" aria-hidden="true" />
              <span className="svc-filter-head-title"><SlidersHorizontal size={14} strokeWidth={2.2} /> Filters</span>
              <button type="button" className="svc-filter-head-close" onClick={() => setFilterOpen(false)} aria-label="Close filters">
                <X size={17} strokeWidth={2.4} />
              </button>
            </div>
            <div className="svc-sidebar-inner">
              {/* Search */}
              <div className="svc-side-section">
                <div className="svc-side-label"><Search size={13} strokeWidth={2.2} /> Search</div>
                <div className="svc-side-search">
                  <input
                    placeholder="Search servicesâ€¦"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    autoComplete="off"
                  />
                  {search && (
                    <button type="button" onClick={() => setSearch('')} className="svc-side-clear">
                      <X size={13} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="svc-side-section">
                <div className="svc-side-tabs">
                  <button type="button" className={`svc-side-tab${tab === 'browse' ? ' active' : ''}`} onClick={() => setTab('browse')}>
                    <LayoutGrid size={13} strokeWidth={2.2} /> All Services
                  </button>
                  <button type="button" className={`svc-side-tab${tab === 'mine' ? ' active' : ''}`} onClick={() => setTab('mine')}>
                    <List size={13} strokeWidth={2.2} /> My Services
                    {myServices.length > 0 && <span className="svc-side-badge">{myServices.length}</span>}
                  </button>
                </div>
              </div>

              {/* Category */}
              <div className="svc-side-section">
                <div className="svc-side-label"><Filter size={13} strokeWidth={2.2} /> Category</div>
                <div className="svc-side-search svc-side-search--mini">
                  <Search size={12} strokeWidth={2.2} />
                  <input
                    placeholder="Search category..."
                    value={catSearch}
                    onChange={e => setCatSearch(e.target.value)}
                    autoComplete="off"
                  />
                  {catSearch && (
                    <button type="button" onClick={() => setCatSearch('')} className="svc-side-clear">
                      <X size={11} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
                <div className="svc-side-options">
                  <button type="button" className={`svc-side-opt${activeCat === '' ? ' active' : ''}`} onClick={() => setActiveCat('')}>
                    <span>All</span>
                    <span className="svc-side-opt-count">{services.length}</span>
                  </button>
                  {SERVICE_CATS.filter(c => catCounts[c.name])
                    .filter(c => !catSearch || c.name.toLowerCase().includes(catSearch.toLowerCase()))
                    .map(c => (
                    <button type="button" key={c.name} className={`svc-side-opt${activeCat === c.name ? ' active' : ''}`} onClick={() => setActiveCat(activeCat === c.name ? '' : c.name)}>
                      <span className="svc-side-cat"><c.icon size={14} strokeWidth={2.2} /> {c.name}</span>
                      <span className="svc-side-opt-count">{catCounts[c.name]}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* City */}
              <div className="svc-side-section">
                <div className="svc-side-label"><MapPin size={13} strokeWidth={2.2} /> City</div>
                <div className="svc-side-search svc-side-search--mini">
                  <Search size={12} strokeWidth={2.2} />
                  <input
                    placeholder="Search city..."
                    value={citySearch}
                    onChange={e => setCitySearch(e.target.value)}
                    autoComplete="off"
                  />
                  {citySearch && (
                    <button type="button" onClick={() => setCitySearch('')} className="svc-side-clear">
                      <X size={11} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
                <div className="svc-side-options">
                  {CITIES.filter(c => c === 'All' || cityCounts[c] > 0 || c === activeCity)
                    .filter(c => !citySearch || c.toLowerCase().includes(citySearch.toLowerCase()))
                    .map(c => (
                    <button type="button" key={c} className={`svc-side-opt${activeCity === c ? ' active' : ''}`} onClick={() => setActiveCity(c)}>
                      <span>{c}</span>
                      {c !== 'All' && <span className="svc-side-opt-count">{cityCounts[c]}</span>}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div className="svc-side-section">
                <div className="svc-side-label"><ArrowUpDown size={13} strokeWidth={2.2} /> Sort by</div>
                <div className="svc-side-options">
                  {SORT_OPTIONS.map(o => (
                    <button type="button" key={o.value} className={`svc-side-opt${sortBy === o.value ? ' active' : ''}`} onClick={() => setSortBy(o.value)}>
                      <span className="svc-side-sort"><o.icon size={13} strokeWidth={2.2} /> {o.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Clear */}
              {activeFiltersCount > 0 && (
                <button type="button" className="svc-side-clear-btn" onClick={() => { setActiveCat(''); setActiveCity('All'); setSortBy('newest'); setCatSearch(''); setCitySearch('') }}>
                  <RotateCcw size={13} strokeWidth={2.2} />
                  Clear all filters
                </button>
              )}
            </div>

            {/* Apply (mobile sheet) */}
            <div className="svc-filter-apply-row">
              <button type="button" className="svc-filter-apply" onClick={() => setFilterOpen(false)}>
                Apply Filters
              </button>
            </div>
          </aside>

          {/* â”€â”€ Main Content â”€â”€ */}
          <main className="svc-main">
            <div className="svc-main-header">
              <div className="svc-main-heading">
                <span className="svc-main-overline"><span className="svc-main-overline-dot" /> Soko Marketplace</span>
                <h1 className="svc-main-title">Services</h1>
                <p className="svc-main-sub">
                  <span className="svc-main-sub-dot" />
                  {loading ? 'Loading providers…' : `${filtered.length} provider${filtered.length !== 1 ? 's' : ''} available in Malawi`}
                </p>
              </div>
              <div className="svc-header-actions">
                <button type="button" className={`svc-filter-btn svc-filter-btn--mobile${activeFiltersCount > 0 ? ' active' : ''}`} onClick={() => setFilterOpen(v => !v)} aria-expanded={filterOpen}>
                  <SlidersHorizontal size={14} strokeWidth={2.2} />
                  <span>Filters</span>
                  {activeFiltersCount > 0 && <span className="svc-filter-count">{activeFiltersCount}</span>}
                </button>
                <button type="button" className="svc-cta" onClick={() => { setEditingService(null); setTab('post') }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                List Service
              </button>
              </div>
            </div>

            {/* Active filter tags */}
            {activeFiltersCount > 0 && (
              <div className="svc-active-tags">
                {activeCat && (
                  <span className="svc-tag">
                    {(() => { const cat = SERVICE_CATS.find(c => c.name === activeCat); return cat ? <cat.icon size={11} strokeWidth={2.2} /> : <Filter size={11} strokeWidth={2.2} /> })()}
                    {activeCat}
                    <button type="button" onClick={() => setActiveCat('')}><X size={11} strokeWidth={2.5} /></button>
                  </span>
                )}
                {activeCity !== 'All' && (
                  <span className="svc-tag">
                    <MapPin size={11} strokeWidth={2.5} /> {activeCity}
                    <button type="button" onClick={() => setActiveCity('All')}><X size={11} strokeWidth={2.5} /></button>
                  </span>
                )}
                {sortBy !== 'newest' && (
                  <span className="svc-tag svc-tag--sort">
                    {(() => { const so = SORT_OPTIONS.find(o => o.value === sortBy); return so ? <so.icon size={11} strokeWidth={2.2} /> : <ArrowUpDown size={11} strokeWidth={2.2} /> })()}
                    {SORT_OPTIONS.find(o => o.value === sortBy)?.label}
                    <button type="button" onClick={() => setSortBy('newest')}><X size={11} strokeWidth={2.5} /></button>
                  </span>
                )}
                <button type="button" className="svc-clear-all-tag" onClick={() => { setActiveCat(''); setActiveCity('All'); setSortBy('newest'); setFilterOpen(false) }}>
                  <RotateCcw size={12} strokeWidth={2.4} /> Clear all
                </button>
              </div>
            )}

            {loading && (
              <div className="svc-grid">
                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton" style={{ height: 260 }} />)}
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="svc-empty">
                <div className="svc-empty-icon"><Search size={36} strokeWidth={1.5} /></div>
                <p className="svc-empty-title">No providers found</p>
                <p className="svc-empty-sub">
                  {search || activeCat ? 'Try adjusting your filters' : 'Be the first to list your service!'}
                </p>
                <button type="button" className="svc-empty-btn" onClick={() => { setEditingService(null); setTab('post') }}>
                  + List a service
                </button>
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <div className="svc-grid">
                {filtered.map((svc, i) => (
                  <ProviderCard key={svc.id} svc={svc} delay={i * 0.03} currentUser={currentUser} onClick={() => setSelectedProvider(svc)} navigate={navigate} />
                ))}
              </div>
            )}
          </main>
        </div>
      ) : tab === 'post' ? (
        <div className="svc-form-wrap">
          <ServiceForm editingService={editingService}
            onSuccess={() => { loadServices(); setTab('mine'); setEditingService(null) }}
            onCancel={() => { setEditingService(null); setTab('mine') }}
          />
        </div>
      ) : (
        <div className="svc-body">
          <MyListings myServices={myServices}
            onEdit={svc => { setEditingService(svc); setTab('post') }}
            onRefresh={loadServices}
            onPostNew={() => { setEditingService(null); setTab('post') }}
          />
        </div>
      )}
        </motion.div>
      </AnimatePresence>

      {selectedProvider && (
        <ProviderModal provider={selectedProvider} currentUser={currentUser} onClose={()=>setSelectedProvider(null)} />
      )}
    </div>
  )
}

function ProviderCard({ svc, delay, currentUser, onClick, navigate }) {
  const [imgErr, setImgErr] = useState(false)
  const heroMedia = svc.media_urls?.[0]
  const profile = svc.profile
  const catUi = SERVICE_CATS.find(c => c.name === svc.category)

  function goChat(e) {
    e.stopPropagation()
    if (currentUser) {
      navigate(`/chat/${svc.provider_id}/${svc.id}?src=service`, {
        state: { source: 'service' },
      })
    }
  }

  const districtLabel = profile?.district || svc.city || null

  return (
    <button
      type="button"
      className="svc-card"
      style={{ animationDelay: `${delay}s` }}
      onClick={onClick}
    >
      <div className="sc-top">
        {heroMedia && !imgErr ? (
          <img src={heroMedia} alt="" loading="lazy" className="sc-img" onError={() => setImgErr(true)} />
        ) : (
          <div className="sc-fallback">
            {catUi ? <catUi.icon size={26} strokeWidth={1.8} /> : <Wrench size={26} strokeWidth={2} />}
          </div>
        )}
        <div className="sc-overlay" />
        {svc.category && <span className="sc-cat">{svc.category}</span>}
      </div>
      <div className="sc-body">
        <div className="sc-name">{svc.name}</div>
        <div className="sc-meta-row">
          <span className="sc-loc"><MapPin size={9} strokeWidth={2.6} /> {districtLabel || 'Malawi'}</span>
          {svc.rate && <span className="sc-rate">{svc.rate}</span>}
        </div>
        <div className="sc-cta-row">
          <span className="sc-cta-btn" onClick={goChat}>
            <Zap size={11} strokeWidth={2.4} /> Book Now
          </span>
        </div>
      </div>
    </button>
  )
}
