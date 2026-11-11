import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { rankServices, isServiceVerified } from '../lib/serviceRanking'
import { SERVICE_CATS, CITIES } from './serviceData'
import ServiceForm from './ServiceForm'
import ProviderModal from './ProviderModal'
import SokoNav from '../components/SokoNav'
import { Search, X, MapPin, Wrench, BadgeCheck, ChevronDown, Filter, ArrowUpDown, LayoutGrid, MessageCircle, Eye, Check, Plus } from 'lucide-react'

const css = `
  * { box-sizing: border-box; margin: 0; padding: 0; }
  @keyframes svc-fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes svc-shimmer { 0%{background-position:-400px 0} 100%{background-position:400px 0} }
  @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }

  .soko-services {
    font-family: 'Plus Jakarta Sans', Inter, 'DM Sans', system-ui, sans-serif;
    background: #f4f6f5;
    min-height: 100vh; min-height: 100dvh;
    color: #202124;
    -webkit-tap-highlight-color: transparent;
    padding-bottom: calc(var(--bottom-nav-h, 60px) + env(safe-area-inset-bottom, 0px) + 24px);
  }

  .svc-page {
    max-width: 1280px;
    margin: 0 auto;
    padding: 16px 14px 0;
    display: flex;
    flex-direction: column;
  }
  @media (min-width: 768px) {
    .svc-page { padding-top: 20px; }
  }
  @media (min-width: 1100px) {
    .svc-page { padding: 24px 24px 0; }
  }

  /* Hero */
  .svc-hero {
    display: flex; flex-direction: column; gap: 12px;
    margin-bottom: 14px;
  }
  @media (min-width: 768px) { .svc-hero { margin-bottom: 16px; } }
  @media (min-width: 1100px) { .svc-hero { gap: 14px; margin-bottom: 18px; } }
  .svc-title { font-size: 20px; line-height: 22px; font-weight: 800; color: #202124; margin: 0; }
  @media (min-width: 1100px) { .svc-title { font-size: 22px; } }
  .svc-subtitle { font-size: 13px; color: #5f6368; margin: 0; }

  /* Segmented */
  .svc-segmented {
    display: flex; width: 100%; background: #f1f3f4; border-radius: 12px;
    padding: 4px; gap: 4px; margin-bottom: 12px; max-width: 360px;
  }
  @media (max-width: 767px) { .svc-segmented { max-width: none; } }
  @media (min-width: 768px) { .svc-segmented { margin-bottom: 14px; width: auto; } }
  @media (min-width: 1100px) { .svc-segmented { margin-bottom: 16px; } }
  .svc-seg {
    flex: 1; height: 36px; border: none; border-radius: 8px;
    background: transparent; color: #5f6368; font-size: 13px; font-weight: 600;
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    gap: 6px; font-family: inherit; transition: all .15s;
  }
  .svc-seg.active { background: #fff; color: #0F9D58; font-weight: 700; box-shadow: 0 1px 2px rgba(0,0,0,.06); }

  /* Search */
  .svc-search {
    display: flex; align-items: center; gap: 10px;
    height: 48px; padding: 0 12px; border-radius: 12px;
    background: #fff; border: 1px solid #e8eaed;
  }
  @media (min-width: 1100px) { .svc-search { height: 52px; } }
  .svc-search input { flex: 1; border: none; background: transparent; font-size: 14px; color: #202124; outline: none; height: 100%; font-family: inherit; }
  .svc-search input::placeholder { color: #9aa0a6; }
  .svc-search-clear {
    width: 44px; height: 44px; border: none; background: transparent; color: #9aa0a6;
    display: inline-flex; align-items: center; justify-content: center; cursor: pointer; flex-shrink: 0;
  }

  /* City pill */
  .svc-city-pill {
    margin-top: 12px; height: 44px; width: 100%;
    display: inline-flex; align-items: center; gap: 8px;
    padding: 0 14px; border-radius: 12px; border: 1px solid #e8eaed;
    background: #fff; color: #5f6368; font-size: 13px; font-weight: 600;
    cursor: pointer; font-family: inherit; justify-content: space-between;
  }
  .svc-city-pill:active { opacity: .85; transform: scale(.98); }

  /* City picker */
  .svc-city-wrap { position: relative; }
  .svc-city-backdrop { position: fixed; inset: 0; z-index: 250; background: rgba(0,0,0,.35); }
  @media (min-width: 1100px) { .svc-city-backdrop { background: transparent; } }
  .svc-city-panel {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 251;
    background: #fff; border-radius: 16px 16px 0 0; max-height: 70vh;
    display: flex; flex-direction: column; gap: 8px;
    padding: 12px 12px calc(12px + env(safe-area-inset-bottom, 0px));
    box-shadow: 0 -4px 24px rgba(0,0,0,.12);
  }
  @media (min-width: 1100px) {
    .svc-city-panel {
      position: absolute; top: calc(100% + 8px); left: 0; right: auto; bottom: auto;
      width: 280px; max-height: 320px; border-radius: 12px;
      box-shadow: 0 8px 24px rgba(0,0,0,.12); padding: 12px;
    }
  }
  .svc-city-search {
    height: 40px; padding: 0 12px; border-radius: 10px; border: 1px solid #e8eaed;
    background: #f8f9fa; font-size: 14px; color: #202124; outline: none; font-family: inherit;
    width: 100%;
  }
  .svc-city-list { overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 2px; }
  .svc-city-item {
    height: 44px; width: 100%; text-align: left; border: none; background: none;
    font-size: 14px; color: #202124; padding: 0 10px; border-radius: 8px; cursor: pointer;
    font-family: inherit;
  }
  .svc-city-item:active { opacity: .85; }
  .svc-city-item.active { color: #0F9D58; font-weight: 700; background: #e6f6ed; }

  /* Category tiles */
  .svc-tiles-wrap { position: relative; margin-top: 16px; margin-bottom: 16px; }
  @media (min-width: 768px) { .svc-tiles-wrap { margin-top: 18px; } }
  @media (min-width: 1100px) { .svc-tiles-wrap { margin-top: 20px; } }
  .svc-tiles { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; padding-bottom: 2px; }
  .svc-tiles::-webkit-scrollbar { display: none; }
  .svc-tile { flex: 0 0 auto; display: flex; flex-direction: column; align-items: center; gap: 6px; background: none; border: none; cursor: pointer; scroll-snap-align: start; padding: 0; font-family: inherit; }
  .svc-tile:active { opacity: .85; transform: scale(.98); }
  .svc-tile-square {
    width: 56px; height: 56px; border-radius: 16px; background: #e6f6ed;
    display: flex; align-items: center; justify-content: center; color: #0F9D58;
  }
  .svc-tile.active .svc-tile-square { background: #0F9D58; color: #fff; }
  .svc-tile-label { font-size: 12px; font-weight: 600; color: #202124; max-width: 72px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .svc-tile.active .svc-tile-label { color: #0F9D58; }
  .svc-tile-count { font-size: 11px; color: #80868b; }
  .svc-tiles-fade { position: absolute; top: 0; right: 0; bottom: 0; width: 40px; pointer-events: none; background: linear-gradient(to right, transparent, #f4f6f5); }

  /* Chips (filter sheet) */
  .svc-chip {
    height: 36px; padding: 0 14px; border-radius: 999px; border: 1px solid #e8eaed;
    background: #fff; color: #5f6368; font-size: 13px; font-weight: 600;
    display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
    flex-shrink: 0; cursor: pointer; font-family: inherit; transition: all .15s;
  }
  .svc-chip.active { background: #0F9D58; border-color: #0F9D58; color: #fff; }
  .svc-chip-count { font-size: 11px; font-weight: 700; opacity: .85; }
  .svc-chips { display: flex; gap: 8px; overflow-x: auto; scrollbar-width: none; padding-bottom: 2px; }
  .svc-chips::-webkit-scrollbar { display: none; }

  /* Toolbar (under tiles) */
  .svc-toolbar2 { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-top: 16px; margin-bottom: 12px; flex-wrap: wrap; }
  @media (min-width: 768px) { .svc-toolbar2 { margin-bottom: 16px; } }
  @media (min-width: 1100px) { .svc-toolbar2 { margin-bottom: 20px; } }
  .svc-result-text { font-size: 13px; font-weight: 600; color: #5f6368; }
  .svc-toolbar-left { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .svc-toolbar-right { display: flex; align-items: center; gap: 8px; }
  .svc-tool-btn {
    height: 40px; padding: 0 12px; border-radius: 12px; border: 1px solid #e8eaed;
    background: #fff; color: #5f6368; font-size: 13px; font-weight: 600;
    display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-family: inherit;
    position: relative;
  }
  .svc-tool-btn:active { opacity: .85; transform: scale(.98); }
  .svc-filter-dot { width: 6px; height: 6px; border-radius: 50%; background: #0F9D58; margin-left: 2px; }
  .svc-verified-chip {
    height: 40px; padding: 0 12px; border-radius: 999px; border: 1px solid #e8eaed;
    background: #fff; color: #5f6368; font-size: 13px; font-weight: 600;
    display: inline-flex; align-items: center; gap: 6px; cursor: pointer; font-family: inherit;
  }
  .svc-verified-chip.on { background: #e6f6ed; border-color: #0F9D58; color: #0F9D58; }
  .svc-verified-chip:active { opacity: .85; transform: scale(.98); }
  .svc-sort-inline {
    height: 40px; padding: 0 12px; border-radius: 12px; border: 1px solid #e8eaed;
    background: #fff; color: #5f6368; font-size: 13px; font-weight: 600;
    font-family: inherit; cursor: pointer; outline: none;
  }
  .svc-sheet-triggers { display: flex; gap: 8px; }
  .svc-desktop-controls { display: flex; gap: 8px; align-items: center; }
  @media (min-width: 1100px) {
    .svc-sheet-triggers { display: none; }
  }
  @media (max-width: 1099px) {
    .svc-desktop-controls { display: none; }
  }

  /* Grid */
  .svc-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 12px; align-items: stretch; }
  @media (min-width: 768px) { .svc-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; } }
  @media (min-width: 1100px) { .svc-grid { grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 20px; } }

  /* Card */
  .svc-card {
    background: #fff; border: 1px solid #e8eaed; border-radius: 16px;
    overflow: hidden; transition: transform .2s ease, box-shadow .2s ease;
    display: flex; flex-direction: column; text-align: left;
    font-family: inherit; cursor: pointer; animation: svc-fadeUp .4s ease both;
    padding: 0; height: 100%;
  }
  @media (max-width: 767px) {
    .svc-card:active { transform: scale(.98); }
  }
  @media (min-width: 1100px) {
    .svc-card:hover { transform: translateY(-2px); box-shadow: 0 4px 16px rgba(0,0,0,.08); }
  }
  .svc-card-img {
    position: relative; width: 100%; aspect-ratio: 4 / 3; overflow: hidden;
    background: linear-gradient(135deg, #e6f6ed, #f8f9fa);
    display: flex; align-items: center; justify-content: center;
    flex-shrink: 0;
  }
  @media (min-width: 1100px) {
    .svc-card-img { aspect-ratio: 16 / 10; }
  }
  .svc-card-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .svc-card-shimmer {
    position: absolute; inset: 0;
    background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
    background-size: 400px 100%; animation: svc-shimmer 1.4s infinite;
  }
  .svc-card-img.loaded .svc-card-shimmer { display: none; }
  .svc-card-icon { color: #0F9D58; }
  .svc-cat-pill {
    position: absolute; bottom: 8px; left: 8px; z-index: 2;
    background: rgba(255,255,255,.92); color: #0F9D58;
    font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 999px;
    max-width: calc(100% - 16px);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .svc-new-badge {
    position: absolute; top: 8px; left: 8px; z-index: 2;
    background: #F9AB00; color: #202124;
    font-size: 11px; font-weight: 800; padding: 4px 8px; border-radius: 999px;
  }
  .svc-card-body {
    padding: 10px; display: flex; flex-direction: column; gap: 6px;
    min-width: 0; flex: 1;
  }
  @media (min-width: 1100px) {
    .svc-card-body { padding: 12px; gap: 8px; }
  }
  .svc-card-title {
    font-size: 14px; font-weight: 700; color: #202124; line-height: 1.3; margin: 0;
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  @media (min-width: 1100px) {
    .svc-card-title { font-size: 15px; }
  }
  .svc-card-meta { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
  .svc-provider-name {
    font-size: 12px; color: #5f6368; display: inline-flex; align-items: center; gap: 4px;
    min-width: 0; max-width: 100%;
  }
  .svc-provider-name-text {
    flex: 0 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .svc-verified { color: #1A73E8; display: inline-flex; align-items: center; flex-shrink: 0; }
  .svc-location {
    font-size: 12px; color: #80868b; display: inline-flex; align-items: center; gap: 4px;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .svc-location svg { flex-shrink: 0; }
  .svc-card-price { margin-top: auto; }
  .svc-price { font-size: 15px; font-weight: 800; color: #202124; }
  .svc-price-unit { font-size: 12px; color: #80868b; margin-left: 2px; font-weight: 500; }
  .svc-price-contact { font-size: 13px; color: #5f6368; }
  .svc-card-actions { display: flex; gap: 8px; align-items: center; margin-top: auto; }
  .svc-card-book-wrap {
    flex: 1; min-height: 44px;
    display: flex; align-items: center; padding: 4px 0;
    background: transparent; border: none;
  }
  .svc-card-book {
    flex: 1; height: 38px; border: none; border-radius: 10px;
    background: #0F9D58; color: #fff; font-size: 13px; font-weight: 700;
    cursor: pointer; font-family: inherit;
    display: inline-flex; align-items: center; justify-content: center; gap: 4px;
  }
  @media (min-width: 1100px) {
    .svc-card-book { height: 40px; }
  }
  .svc-card-yours { font-size: 13px; color: #5f6368; padding: 4px 0; }
  .svc-card-desc { font-size: 13px; color: #5f6368; margin: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; display: none; }
  @media (min-width: 1100px) { .svc-card-desc { display: block; } }
  .svc-card-rating { font-size: 12px; color: #5f6368; display: none; align-items: center; gap: 4px; }
  @media (min-width: 1100px) { .svc-card-rating { display: inline-flex; } }
  @media (max-width: 767px) { .svc-provider-name { display: none; } }

  /* Skeleton cards */
  .svc-skeleton-card {
    background: #fff; border: 1px solid #e8eaed; border-radius: 16px; overflow: hidden;
    display: flex; flex-direction: column; height: 100%;
  }
  .svc-skeleton-img { width: 100%; aspect-ratio: 4 / 3; }
  @media (min-width: 1100px) { .svc-skeleton-img { aspect-ratio: 16 / 10; } }
  .svc-skeleton-body { padding: 10px; display: flex; flex-direction: column; gap: 4px; flex: 1; }
  @media (min-width: 1100px) { .svc-skeleton-body { padding: 12px; gap: 8px; } }
  .svc-skeleton-line { height: 14px; border-radius: 6px; width: 100%; }
  .svc-skeleton-line.short { width: 60%; }
  .svc-skeleton-line.price { width: 40%; height: 18px; }
  .svc-skeleton-shimmer {
    background: linear-gradient(90deg, #f3f4f6 25%, #e5e7eb 50%, #f3f4f6 75%);
    background-size: 400px 100%; animation: svc-shimmer 1.4s infinite;
  }

  /* Bottom sheets */
  .svc-sheet-backdrop { position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 300; }
  .svc-filter-sheet, .svc-sort-sheet {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 301;
    background: #fff; border-radius: 16px 16px 0 0;
    max-height: 85vh; display: flex; flex-direction: column;
    padding-bottom: calc(env(safe-area-inset-bottom, 0px));
    box-shadow: 0 -4px 24px rgba(0,0,0,.12);
  }
  .svc-sheet-handle { width: 40px; height: 4px; border-radius: 2px; background: #dadce0; margin: 8px auto 4px; flex-shrink: 0; }
  .svc-sheet-title { font-size: 18px; font-weight: 700; color: #202124; padding: 8px 16px; }
  .svc-sheet-body { overflow-y: auto; flex: 1; padding: 8px 16px; display: flex; flex-direction: column; gap: 16px; }
  .svc-sheet-section { display: flex; flex-direction: column; gap: 8px; }
  .svc-sheet-section-title { font-size: 13px; font-weight: 700; color: #5f6368; }
  .svc-toggle-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-height: 44px; }
  .svc-toggle-label { font-size: 14px; color: #202124; font-weight: 500; }
  .svc-toggle-track {
    width: 44px; height: 24px; border-radius: 999px; background: #e8eaed;
    position: relative; cursor: pointer; flex-shrink: 0; border: none;
  }
  .svc-toggle-track.on { background: #0F9D58; }
  .svc-toggle-thumb {
    position: absolute; top: 3px; left: 3px; width: 18px; height: 18px; border-radius: 50%;
    background: #fff; transition: left .2s; box-shadow: 0 1px 3px rgba(0,0,0,.2);
  }
  .svc-toggle-track.on .svc-toggle-thumb { left: 23px; }
  .svc-sheet-footer { display: flex; align-items: center; gap: 12px; padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid #e8eaed; }
  .svc-clear-text { background: none; border: none; color: #5f6368; font-size: 14px; font-weight: 600; cursor: pointer; font-family: inherit; }
  .svc-apply-btn { flex: 1; height: 48px; border: none; border-radius: 12px; background: #0F9D58; color: #fff; font-size: 15px; font-weight: 700; cursor: pointer; font-family: inherit; }
  .svc-apply-btn:active { opacity: .85; transform: scale(.98); }

  /* Sort sheet rows */
  .svc-sort-row {
    height: 52px; display: flex; align-items: center; gap: 12px; border: none; background: none;
    width: 100%; cursor: pointer; font-family: inherit; padding: 0 4px; text-align: left;
    border-bottom: 1px solid #f1f3f4;
  }
  .svc-sort-row:active { opacity: .85; }
  .svc-radio {
    width: 20px; height: 20px; border-radius: 50%; border: 2px solid #dadce0;
    display: inline-flex; align-items: center; justify-content: center; flex-shrink: 0;
  }
  .svc-sort-row.on .svc-radio { border-color: #0F9D58; }
  .svc-radio-dot { width: 10px; height: 10px; border-radius: 50%; background: #0F9D58; }
  .svc-sort-label { font-size: 14px; color: #202124; font-weight: 500; }
  .svc-sort-row.on .svc-sort-label { color: #0F9D58; font-weight: 600; }

  /* City list in filter */
  .svc-city-list-filter { display: flex; flex-direction: column; gap: 2px; max-height: 200px; overflow-y: auto; }

  /* Empty */
  .svc-empty { text-align: center; padding: 48px 24px; display: flex; flex-direction: column; align-items: center; gap: 8px; }
  .svc-empty-icon { color: #80868b; margin-bottom: 4px; }
  .svc-offline-banner { background: #fff8e6; color: #7a5a00; font-size: 13px; font-weight: 600; padding: 8px 12px; border-radius: 10px; margin-bottom: 12px; text-align: center; }

  .svc-retry-btn { height: 44px; padding: 0 20px; border: none; border-radius: 10px; background: #0F9D58; color: #fff; font-size: 14px; font-weight: 700; cursor: pointer; margin-top: 8px; font-family: inherit; }
  .svc-card-counters { font-size: 12px; color: #5f6368; display: flex; align-items: center; gap: 6px; margin-top: 2px; }
  .svc-card-counters svg { color: #5f6368; }
  .svc-empty-title { font-size: 16px; font-weight: 700; color: #202124; }
  .svc-empty-sub { font-size: 13px; color: #5f6368; }
  .svc-clear-btn {
    height: 44px; padding: 0 16px; border: 1.5px solid #0F9D58; background: transparent;
    color: #0F9D58; border-radius: 10px; font-size: 13px; font-weight: 700;
    cursor: pointer; margin-top: 8px; font-family: inherit;
  }
  .svc-load-more {
    height: 44px; padding: 0 20px; border: 1.5px solid #0F9D58; background: transparent;
    color: #0F9D58; border-radius: 12px; font-size: 14px; font-weight: 700;
    cursor: pointer; font-family: inherit;
  }

  /* Mine actions */
  .svc-card-actions { display: flex; gap: 8px; padding-top: 8px; border-top: 1px solid #e8eaed; margin-top: 4px; flex-wrap: wrap; }
  .svc-action {
    height: 32px; padding: 0 12px; border: none; border-radius: 8px;
    font-size: 12px; font-weight: 700; cursor: pointer;
    display: inline-flex; align-items: center; gap: 4px; font-family: inherit;
  }
  .svc-action:disabled { opacity: .6; cursor: not-allowed; }
  .svc-action-edit { background: #e6f6ed; color: #0F9D58; }
  .svc-action-pause { background: #fff8e6; color: #d4920a; }
  .svc-action-delete { background: #fef2f2; color: #dc2626; }

  /* Skeleton */
  .skeleton { background: linear-gradient(90deg,#f3f4f6 25%,#e5e7eb 50%,#f3f4f6 75%); background-size:400px 100%; animation: svc-shimmer 1.4s infinite; border-radius:16px; height: 260px; }

  .svc-form-wrap { max-width: 600px; margin: 20px auto; padding: 0 16px; }

  .svc-cta {
    position: relative; overflow: hidden; border-radius: 20px;
    background: linear-gradient(135deg, #0F9D58 0%, #0b7a44 100%);
    box-shadow: 0 8px 24px rgba(15,157,88,0.18);
    margin-top: 24px; padding: 20px;
    display: flex; flex-direction: column; gap: 14px;
  }
  @media (min-width: 768px) { .svc-cta { padding: 28px; gap: 16px; } }
  @media (min-width: 1100px) { .svc-cta { padding: 40px; gap: 18px; border-radius: 24px; } }
  .svc-cta-deco { position: absolute; border-radius: 50%; pointer-events: none; }
  .svc-cta-deco-tr { top: -40px; right: -40px; width: 160px; height: 160px; background: rgba(255,255,255,0.08); }
  .svc-cta-deco-bl { bottom: -60px; left: -60px; width: 200px; height: 200px; background: rgba(249,171,0,0.14); }
  .svc-cta-left { position: relative; z-index: 1; display: flex; flex-direction: column; gap: 14px; }
  @media (min-width: 768px) { .svc-cta-left { gap: 16px; } }
  @media (min-width: 1100px) { .svc-cta-left { gap: 18px; } }
  .svc-cta-pill {
    display: inline-flex; align-items: center; gap: 6px; width: fit-content;
    font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em;
    color: #fff; background: rgba(255,255,255,0.16); border-radius: 999px; padding: 6px 12px;
  }
  .svc-cta-headline {
    font-size: 20px; font-weight: 800; color: #fff; line-height: 1.2; margin: 0; max-width: 520px;
  }
  @media (min-width: 768px) { .svc-cta-headline { font-size: 24px; } }
  @media (min-width: 1100px) { .svc-cta-headline { font-size: 28px; } }
  .svc-cta-sub {
    font-size: 13px; color: rgba(255,255,255,0.85); margin: 0; max-width: 480px;
  }
  @media (min-width: 1100px) { .svc-cta-sub { font-size: 14px; } }
  .svc-cta-benefits {
    display: flex; flex-direction: column; gap: 8px;
  }
  @media (min-width: 768px) { .svc-cta-benefits { flex-direction: row; gap: 20px; flex-wrap: wrap; } }
  .svc-cta-benefit {
    display: inline-flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: #fff;
  }
  .svc-cta-btn {
    display: inline-flex; align-items: center; justify-content: center; gap: 8px;
    height: 48px; padding: 0 22px; border: none; border-radius: 12px;
    background: #fff; color: #0F9D58; font-size: 14px; font-weight: 800; cursor: pointer; font-family: inherit;
    width: 100%;
  }
  @media (min-width: 768px) { .svc-cta-btn { width: auto; } }
  .svc-cta-btn:active { transform: scale(0.98); }
  @media (min-width: 1100px) { .svc-cta-btn:hover { background: #f1f8f4; } }
  .svc-cta-btn:focus-visible { outline: 2px solid #F9AB00; outline-offset: 2px; }
  .svc-cta-stat {
    position: relative; z-index: 1; background: rgba(255,255,255,0.12);
    border: 1px solid rgba(255,255,255,0.2); border-radius: 16px; padding: 20px;
    width: 240px; display: flex; flex-direction: column; gap: 4px;
  }
  .svc-cta-stat-num { font-size: 32px; font-weight: 800; color: #fff; line-height: 1; }
  .svc-cta-stat-label { font-size: 12px; color: rgba(255,255,255,0.85); }
  @media (min-width: 1100px) {
    .svc-cta { flex-direction: row; align-items: center; justify-content: space-between; }
    .svc-cta-left { flex: 1; }
  }

  .svc-featured-wrap { position: relative; margin-bottom: 20px; }
  @media (min-width: 768px) { .svc-featured-wrap { margin-bottom: 24px; } }
  @media (min-width: 1100px) { .svc-featured-wrap { margin-bottom: 28px; } }
  .svc-featured-header { margin-bottom: 12px; }
  .svc-featured-title { font-size: 20px; font-weight: 800; color: #202124; margin: 0; }
  @media (min-width: 1100px) { .svc-featured-title { font-size: 22px; } }
  .svc-featured-sub { font-size: 13px; color: #5f6368; margin: 2px 0 0; }
  .svc-featured-rail { display: flex; gap: 12px; overflow-x: auto; scroll-snap-type: x mandatory; scrollbar-width: none; padding-bottom: 2px; }
  .svc-featured-rail::-webkit-scrollbar { display: none; }
  .svc-featured-card { flex: 0 0 240px; scroll-snap-align: start; }
  @media (min-width: 1100px) { .svc-featured-card { flex: 0 0 280px; } }
  .svc-rail-arrow { position: absolute; top: 50%; transform: translateY(-50%); width: 40px; height: 40px; border-radius: 50%; border: 1px solid #e8eaed; background: #fff; color: #5f6368; cursor: pointer; z-index: 3; display: none; align-items: center; justify-content: center; font-size: 18px; line-height: 1; }
  @media (min-width: 1100px) { .svc-rail-arrow { display: inline-flex; } }
  .svc-rail-arrow-left { left: 4px; }
  .svc-rail-arrow-right { right: 4px; }
  .svc-rail-fade { position: absolute; top: 0; bottom: 0; width: 48px; pointer-events: none; z-index: 2; display: none; }
  @media (min-width: 1100px) { .svc-rail-fade { display: block; } }
  .svc-rail-fade-left { left: 0; background: linear-gradient(to right, #f4f6f5, transparent); }
  .svc-rail-fade-right { right: 0; background: linear-gradient(to left, #f4f6f5, transparent); }

  .soko-services *:focus-visible { outline: 2px solid #0F9D58; outline-offset: 2px; }
  @media (prefers-reduced-motion: reduce) {
    .soko-services * { animation: none !important; transition: none !important; }
  }

  button { font-family: inherit; cursor: pointer; }
  input, select { font-family: inherit; }
`

function formatPrice(rate) {
  if (!rate && rate !== 0) return null
  const s = String(rate).trim()
  if (!s) return null
  const slashIdx = s.indexOf('/')
  const amountPart = slashIdx >= 0 ? s.slice(0, slashIdx).trim() : s
  const unitPart = slashIdx >= 0 ? '/' + s.slice(slashIdx + 1).trim() : ''
  const cleaned = amountPart.replace(/mwk|mk/gi, '').trim()
  const numMatch = cleaned.match(/[\\d,]+/)
  let formattedAmount
  if (numMatch) {
    const digits = numMatch[0].replace(/,/g, '')
    if (/^\d+$/.test(digits)) {
      formattedAmount = 'MK ' + Number(digits).toLocaleString()
    } else {
      formattedAmount = 'MK ' + cleaned
    }
  } else if (cleaned) {
    formattedAmount = 'MK ' + cleaned
  } else {
    return null
  }
  return { amount: formattedAmount, unit: unitPart }
}

function ServiceCard({ svc, delay, onClick, onBook, onChat, isMine, onEdit, showCounters, featuredBadge, priority }) {
  const [imgErr, setImgErr] = useState(false)
  const [imgLoaded, setImgLoaded] = useState(false)
  const [now] = useState(() => Date.now())
  const profile = svc.profile
  const catUi = SERVICE_CATS.find(c => c.name === svc.category)
  const heroMedia = svc.media_urls?.[0]
  const rawTitle = svc.title || svc.name
  const providerName = profile?.shop_name || profile?.full_name
  const title = rawTitle || providerName || 'Service'
  const showProvider = !!rawTitle && !!providerName
  const verified = (svc._verified != null) ? !!svc._verified : isServiceVerified(svc, profile)
  const districtLabel = profile?.district || svc.city || 'Malawi'
  const price = formatPrice(svc.rate)

  const isNew = !!svc.created_at && (now - new Date(svc.created_at).getTime()) <= 7 * 24 * 60 * 60 * 1000

  function handleBook(e) { e.stopPropagation(); if (onBook) onBook(e) }
  function handleChat(e) { e.stopPropagation(); if (onChat) onChat(e) }
  function handleManage(e) { e.stopPropagation(); if (onEdit) onEdit() }

  return (
    <button type="button" className="svc-card" style={{ animationDelay: `${delay}s` }} onClick={onClick}>
      <div className={`svc-card-img${imgLoaded ? ' loaded' : ''}`}>
        {heroMedia && !imgErr ? (
          <>
            {!imgLoaded && <div className="svc-card-shimmer" />}
            <img src={heroMedia} alt="" width="400" height="300" loading={priority ? 'eager' : 'lazy'} decoding="async" fetchPriority={priority ? 'high' : 'auto'} onLoad={() => setImgLoaded(true)} onError={() => setImgErr(true)} />
          </>
        ) : (
          <div className="svc-card-icon">
            {catUi ? <catUi.icon size={32} strokeWidth={1.8} color="#0F9D58" /> : <Wrench size={32} strokeWidth={2} color="#0F9D58" />}
          </div>
        )}
        {svc.category && <span className="svc-cat-pill">{svc.category}</span>}
        {featuredBadge ? <span className="svc-new-badge">Featured</span> : (isNew && <span className="svc-new-badge">New</span>)}
      </div>
      <div className="svc-card-body">
        <h3 className="svc-card-title">{title}</h3>
        {showProvider && (
          <div className="svc-card-meta">
            <span className="svc-provider-name">
              <span className="svc-provider-name-text">{providerName}</span>
              {verified && <span className="svc-verified" aria-label="Verified provider"><BadgeCheck size={14} strokeWidth={2.5} color="#1A73E8" /></span>}
            </span>
            <span className="svc-location">
              <MapPin size={12} strokeWidth={2.2} color="#80868b" /> {districtLabel}
            </span>
          </div>
        )}
        {svc.description && <p className="svc-card-desc">{svc.description}</p>}
        {showCounters && isMine && (svc.views != null || svc.chats_count != null || svc.chats != null) && (
          <div className="svc-card-counters">
            {svc.views != null && <span><Eye size={12} strokeWidth={2.2} /> {svc.views} views</span>}
            {svc.views != null && (svc.chats_count != null || svc.chats != null) && <span>�</span>}
            {(svc.chats_count != null || svc.chats != null) && <span><MessageCircle size={12} strokeWidth={2.2} /> {svc.chats_count != null ? svc.chats_count : svc.chats} chats</span>}
          </div>
        )}
        <div className="svc-card-price">
          {price ? (
            <>
              <span className="svc-price">{price.amount}</span>
              {price.unit && <span className="svc-price-unit">{price.unit}</span>}
            </>
          ) : (
            <span className="svc-price-contact">Contact for price</span>
          )}
        </div>
        <div className="svc-card-actions">
          {isMine ? (
            onEdit ? (
              <button type="button" className="svc-card-book-wrap" onClick={handleManage} aria-label="Manage">
                <span className="svc-card-book">Manage</span>
              </button>
            ) : (
              <span className="svc-card-yours">Your service</span>
            )
           ) : (
            <button type="button" className="svc-card-book-wrap" onClick={handleBook} aria-label="Book now">
              <span className="svc-card-book">Book now</span>
            </button>
          )}
        </div>
      </div>
    </button>
  )
}

export default function Services() {
  const navigate = useNavigate()
  const _initParams = new URLSearchParams(window.location.search)
  const [tab, setTab] = useState(() => _initParams.get('tab') || 'browse')
  const [services, setServices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [isOffline, setIsOffline] = useState(() => (typeof navigator !== 'undefined' ? !navigator.onLine : false))
  const [currentUser, setCurrentUser] = useState(null)
  const [profileCity, setProfileCity] = useState('')
  const [navUser, setNavUser] = useState(null)
  const [notifCount, setNotifCount] = useState(0)
  const [navSearch, setNavSearch] = useState('')
  const [selectedProvider, setSelectedProvider] = useState(null)
  const [editingService, setEditingService] = useState(null)
  const [searchInput, setSearchInput] = useState(() => _initParams.get('q') || '')
  const [search, setSearch] = useState(() => _initParams.get('q') || '')
  const [activeCat, setActiveCat] = useState(() => _initParams.get('cat') || '')
  const [activeCity, setActiveCity] = useState(() => _initParams.get('city') || 'All')
  const [verifiedOnly, setVerifiedOnly] = useState(() => _initParams.get('verified') === '1')
  const [sortBy, setSortBy] = useState(() => _initParams.get('sort') || 'recommended')
  const [cityOpen, setCityOpen] = useState(false)
  const [cityQuery, setCityQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [draftVerified, setDraftVerified] = useState(false)
  const [draftCat, setDraftCat] = useState('')
  const [draftCity, setDraftCity] = useState('All')
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 1100 : true))
  const [isPhone, setIsPhone] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 768 : true))
  const [pageSize, setPageSize] = useState(() => (typeof window !== 'undefined' ? (window.innerWidth >= 1100 ? 16 : window.innerWidth >= 768 ? 12 : 10) : 10))
  const [displayCount, setDisplayCount] = useState(() => (typeof window !== 'undefined' ? (window.innerWidth >= 1100 ? 16 : window.innerWidth >= 768 ? 12 : 10) : 10))
  const pageSizeRef = useRef(pageSize)

  const touchStartY = useRef(0)
  const railRef = useRef(null)
  const sentinelRef = useRef(null)
  const seed = useMemo(() => {
    try {
      let s = sessionStorage.getItem('soko_svc_seed')
      if (!s) {
        s = String(Math.floor(Math.random() * 2 ** 32))
        sessionStorage.setItem('soko_svc_seed', s)
      }
      return parseInt(s, 10) || 1
    } catch {
      return 1
    }
  }, [])
  function scrollRail(dir) {
    const el = railRef.current
    if (!el) return
    const amount = (isMobile ? 240 : 280) + 12
    el.scrollBy({ left: dir * amount, behavior: 'smooth' })
  }

  useEffect(() => { init() }, [])

  useEffect(() => {
    const onResize = () => {
      setIsMobile(window.innerWidth < 1100)
      setIsPhone(window.innerWidth < 768)
      const nextPageSize = window.innerWidth >= 1100 ? 16 : window.innerWidth >= 768 ? 12 : 10
      setPageSize(nextPageSize)
      pageSizeRef.current = nextPageSize
      setDisplayCount(c => {
        const pages = Math.ceil(c / nextPageSize)
        return Math.min(pages * nextPageSize, filtered.length)
      })
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => { pageSizeRef.current = pageSize }, [pageSize])

  useEffect(() => { setDisplayCount(pageSizeRef.current) }, [search, activeCat, activeCity, verifiedOnly, sortBy])


  useEffect(() => {
    const t = setTimeout(() => setSearch(searchInput), 250)
    return () => clearTimeout(t)
  }, [searchInput])

  useEffect(() => {
    const params = new URLSearchParams()
    if (tab && tab !== 'browse') params.set('tab', tab)
    if (search) params.set('q', search)
    if (activeCat) params.set('cat', activeCat)
    if (activeCity && activeCity !== 'All') params.set('city', activeCity)
    if (sortBy && sortBy !== 'newest') params.set('sort', sortBy)
    if (verifiedOnly) params.set('verified', '1')
    const qs = params.toString()
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    window.history.replaceState(null, '', url)
  }, [tab, search, activeCat, activeCity, sortBy, verifiedOnly])

  useEffect(() => {
    const on = () => setIsOffline(false)
    const off = () => setIsOffline(true)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  useEffect(() => {
    document.title = 'Services in Malawi | SokoMw'
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', 'Find and book trusted service providers across Malawi on SokoMw.')
  }, [])

  useEffect(() => {
    if (!selectedProvider) return
    if (selectedProvider.provider_id === currentUser?.id) return
    const key = `svc_viewed_${selectedProvider.id}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch { return }
    supabase.rpc('increment_service_stat', { p_service_id: selectedProvider.id, p_stat: 'views' }).then(() => {}).catch(() => {})
  }, [selectedProvider, currentUser])

  useEffect(() => {
    if (!filterOpen && !sortOpen && !cityOpen) return
    const sheet = document.querySelector('.svc-filter-sheet, .svc-sort-sheet, .svc-city-panel')
    if (!sheet) return
    const getFocusables = () => Array.from(sheet.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')).filter(el => !el.disabled)
    const f = getFocusables()
    if (f.length) f[0].focus()
    function trap(e) {
      if (e.key === 'Escape') { setFilterOpen(false); setSortOpen(false); setCityOpen(false); return }
      if (e.key !== 'Tab') return
      const list = getFocusables()
      if (!list.length) return
      const first = list[0], last = list[list.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }
    function esc(e) { if (e.key === 'Escape') { setFilterOpen(false); setSortOpen(false); setCityOpen(false) } }
    sheet.addEventListener('keydown', trap)
    window.addEventListener('keydown', esc)
    return () => { sheet.removeEventListener('keydown', trap); window.removeEventListener('keydown', esc) }
  }, [filterOpen, sortOpen, cityOpen])

  useEffect(() => {
    if (isMobile && (filterOpen || sortOpen || cityOpen)) {
      const prev = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = prev }
    }
  }, [isMobile, filterOpen, sortOpen, cityOpen])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    if (user) {
      const [{ data: profile }, { data: shop }, { count }] = await Promise.all([
        supabase.from('profiles').select('full_name, avatar_url, account_type, city').eq('id', user.id).maybeSingle(),
        supabase.from('shops').select('slug').eq('owner_id', user.id).maybeSingle(),
        supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
      ])
      setProfileCity(profile?.city || '')
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
    setError(false)
    try {
      const { data, error: svcErr } = await supabase
        .from('services').select('*').eq('status', 'active').order('created_at', { ascending: false })
      if (svcErr) throw svcErr
      const list = data || []

      const providerIds = [...new Set(list.map(s => s.provider_id).filter(Boolean))]
      const profileMap = {}
      if (providerIds.length) {
        const { data: profiles, error: profErr } = await supabase
          .from('profiles').select('id, full_name, avatar_url, account_type, district')
          .in('id', providerIds)
        let rows = profiles
        if (profErr && /district|column/i.test(profErr.message || '')) {
          const { data: fallback } = await supabase
            .from('profiles').select('id, full_name, avatar_url, account_type')
            .in('id', providerIds)
          rows = fallback
        }
        const shopAccountIds = (rows || [])
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
        ;(rows || []).forEach(p => { profileMap[p.id] = { ...p, shop_name: shopMap[p.id] || null } })
      }

    let verifiedMap = {}
    if (providerIds.length) {
      try {
        const { data: vRows } = await supabase
          .from('profiles').select('id, is_verified').in('id', providerIds)
        ;(vRows || []).forEach(p => { verifiedMap[p.id] = !!p.is_verified })
      } catch {
        verifiedMap = {}
      }
    }
    setServices(list.map(s => {
      const profile = profileMap[s.provider_id] || null
      return {
        ...s,
        profile,
        _verified: isServiceVerified(s, profile ? { ...profile, is_verified: verifiedMap[s.provider_id] } : { is_verified: verifiedMap[s.provider_id] }),
      }
    }))
    } catch {
      setServices(prev => {
        if (prev.length === 0) setError(true)
        return prev
      })
    } finally {
      setLoading(false)
    }
  }

  const userCity = activeCity !== 'All'
    ? activeCity
    : (currentUser ? profileCity : (typeof localStorage !== 'undefined' ? (localStorage.getItem('soko_city') || '') : ''))

  let filtered = services.filter(s => {
    if (activeCat && s.category !== activeCat) return false
    if (activeCity !== 'All' && s.city !== activeCity) return false
    if (verifiedOnly && !(s._verified ?? isServiceVerified(s, s.profile))) return false
    if (search) {
      const q = search.toLowerCase()
      const hit = (s.name || '').toLowerCase().includes(q)
        || (s.description || '').toLowerCase().includes(q)
        || (s.category || '').toLowerCase().includes(q)
        || (s.skills || []).some(sk => sk.toLowerCase().includes(q))
        || (s.tags || []).some(t => t.toLowerCase().includes(q))
      if (!hit) return false
    }
    return true
  })
  if (sortBy === 'recommended') {
    const ctx = { userCity, userId: currentUser?.id, seed, now: Date.now() }
    if (search) {
      const q = search.toLowerCase()
      const titleMatches = filtered.filter(s => String(s.title || s.name || '').toLowerCase().includes(q))
      const descMatches = filtered.filter(s => !String(s.title || s.name || '').toLowerCase().includes(q))
      filtered = [...rankServices(titleMatches, ctx), ...rankServices(descMatches, ctx)]
    } else {
      filtered = rankServices(filtered, ctx)
    }
  } else if (sortBy === 'verified') {
    filtered = [...filtered].sort((a, b) => {
      const av = (a._verified ?? isServiceVerified(a, a.profile)) ? 1 : 0
      const bv = (b._verified ?? isServiceVerified(b, b.profile)) ? 1 : 0
      if (bv !== av) return bv - av
      return new Date(b.created_at) - new Date(a.created_at)
    })
  } else {
    filtered = [...filtered].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }




  useEffect(() => {
    if (!isPhone) return
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) {
        setDisplayCount(c => (c < filtered.length ? Math.min(c + pageSize, filtered.length) : c))
      }
    }, { rootMargin: '400px' })
    obs.observe(el)
    return () => obs.disconnect()
  }, [isPhone, displayCount, filtered.length, pageSize])

  function renderCta() {
    const headline = myServices.length > 0 ? 'Grow your reach.' : 'Offer your skills. Get found across Malawi.'
    const buttonLabel = myServices.length > 0 ? 'Post another service' : 'Post a Service'
    const showStat = !isMobile && services.length >= 5
    return (
      <div className="svc-cta">
        <div className="svc-cta-deco svc-cta-deco-tr" aria-hidden="true" />
        <div className="svc-cta-deco svc-cta-deco-bl" aria-hidden="true" />
        <div className="svc-cta-left">
          <span className="svc-cta-pill"><BadgeCheck size={14} strokeWidth={2.5} color="#F9AB00" /> For service providers</span>
          <h2 className="svc-cta-headline">{headline}</h2>
          <p className="svc-cta-sub">List your service in minutes and reach customers in your city.</p>
          <div className="svc-cta-benefits">
            <span className="svc-cta-benefit"><Check size={16} strokeWidth={2.5} color="#fff" /> Free to list</span>
            <span className="svc-cta-benefit"><Check size={16} strokeWidth={2.5} color="#fff" /> Chat directly with customers</span>
            <span className="svc-cta-benefit"><Check size={16} strokeWidth={2.5} color="#fff" /> Get a verified badge</span>
          </div>
          <button
            type="button"
            className="svc-cta-btn"
            onClick={() => { setEditingService(null); setTab('post') }}
            aria-label="Post a service"
          >
            <Plus size={16} strokeWidth={2.5} /> {buttonLabel}
          </button>
        </div>
        {showStat && (
          <div className="svc-cta-stat">
            <div className="svc-cta-stat-num">{services.length}</div>
            <div className="svc-cta-stat-label">services listed on SokoMw</div>
          </div>
        )}
      </div>
    )
  }

  const catCounts = {}
  services.forEach(s => { catCounts[s.category] = (catCounts[s.category] || 0) + 1 })
  const cityCounts = {}
  services.forEach(s => { if (s.city) cityCounts[s.city] = (cityCounts[s.city] || 0) + 1 })
  const myServices = services.filter(s => s.provider_id === currentUser?.id)

  function trackServiceChat(svc) {
    if (!svc || svc.provider_id === currentUser?.id) return
    const key = `svc_chatted_${svc.id}`
    try {
      if (sessionStorage.getItem(key)) return
      sessionStorage.setItem(key, '1')
    } catch { return }
    supabase.rpc('increment_service_stat', { p_service_id: svc.id, p_stat: 'chats_count' }).then(() => {}).catch(() => {})
  }

  useEffect(() => {
    if (activeCity && activeCity !== 'All') {
      try { localStorage.setItem('soko_city', activeCity) } catch (e) { void e }
    }
  }, [activeCity])

  const n = filtered.length
  const resultText = `${n} service${n !== 1 ? 's' : ''}${activeCity !== 'All' ? ` in ${activeCity}` : ''}`
  const filterActive = verifiedOnly || activeCat !== '' || activeCity !== 'All'
  const noFiltersActive = !search && !activeCat && activeCity === 'All' && !verifiedOnly && sortBy === 'newest'
  const hasFeaturedCol = services.length > 0 && services.some(s => Object.prototype.hasOwnProperty.call(s, 'is_featured'))
  const railCandidates = hasFeaturedCol
    ? services.filter(s => (s.is_featured || (s._verified ?? isServiceVerified(s, s.profile))))
    : []
  const featuredRail = [...railCandidates].sort((a, b) => {
    const af = a.is_featured ? 1 : 0
    const bf = b.is_featured ? 1 : 0
    if (bf !== af) return bf - af
    const av = (a._verified ?? isServiceVerified(a, a.profile)) ? 1 : 0
    const bv = (b._verified ?? isServiceVerified(b, b.profile)) ? 1 : 0
    if (bv !== av) return bv - av
    return new Date(b.created_at) - new Date(a.created_at)
  }).slice(0, 8)
  const showRail = hasFeaturedCol && featuredRail.length >= 2 && noFiltersActive

  function openFilter() {
    setDraftVerified(verifiedOnly)
    setDraftCat(activeCat)
    setDraftCity(activeCity)
    setFilterOpen(true)
  }
  function applyFilter() {
    setVerifiedOnly(draftVerified)
    setActiveCat(draftCat)
    setActiveCity(draftCity)
    setFilterOpen(false)
  }
  function clearFilterDraft() {
    setDraftVerified(false)
    setDraftCat('')
    setDraftCity('All')
  }

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

      <div className="svc-page">
        <div className="svc-hero">
          <h1 className="svc-title">Find Trusted Services</h1>
          <p className="svc-subtitle">Book skilled providers across Malawi</p>
        </div>

        {tab === 'browse' && (
          <>
            {isOffline && services.length > 0 && (
              <div className="svc-offline-banner">You're offline. Showing saved results.</div>
            )}
            <div className="svc-search">
              <Search size={16} strokeWidth={2.2} style={{ color: '#9aa0a6', flexShrink: 0 }} />
              <input
                placeholder="What do you need? e.g. plumber, tutor, photographer"
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                autoComplete="off"
                aria-label="Search services"
              />
              {searchInput && (
                <button type="button" className="svc-search-clear" onClick={() => { setSearchInput(''); setSearch('') }} aria-label="Clear search">
                  <X size={16} strokeWidth={2.5} />
                </button>
              )}
            </div>

            <div className="svc-city-wrap">
              <button type="button" className="svc-city-pill" onClick={() => setCityOpen(v => !v)} aria-label="Select city">
                <MapPin size={16} strokeWidth={2.2} />
                <span>{activeCity === 'All' ? 'All cities' : activeCity}</span>
                <ChevronDown size={16} strokeWidth={2.2} />
              </button>
              {cityOpen && (
                <>
                  <div className="svc-city-backdrop" onClick={() => setCityOpen(false)} />
                  <div
                    className="svc-city-panel"
                    onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
                    onTouchEnd={e => { if (e.changedTouches[0].clientY - touchStartY.current > 60) setCityOpen(false) }}
                  >
                    <input
                      className="svc-city-search"
                      placeholder="Search cities..."
                      value={cityQuery}
                      onChange={e => setCityQuery(e.target.value)}
                      autoFocus
                    />
                    <div className="svc-city-list">
                      <button
                        type="button"
                        className={`svc-city-item${activeCity === 'All' ? ' active' : ''}`}
                        onClick={() => { setActiveCity('All'); setCityOpen(false); setCityQuery('') }}
                      >
                        All cities
                      </button>
                      {CITIES.filter(c => c !== 'All' && c.toLowerCase().includes(cityQuery.toLowerCase())).map(c => (
                        <button
                          type="button"
                          key={c}
                          className={`svc-city-item${activeCity === c ? ' active' : ''}`}
                          onClick={() => { setActiveCity(c); setCityOpen(false); setCityQuery('') }}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>

            {(tab === 'browse' || tab === 'mine') && (
              <div className="svc-segmented">
                <button type="button" className={`svc-seg${tab === 'browse' ? ' active' : ''}`} onClick={() => setTab('browse')} aria-label="All Services">
                  All Services
                </button>
                <button type="button" className={`svc-seg${tab === 'mine' ? ' active' : ''}`} onClick={() => setTab('mine')} aria-label="My Services">
                  My Services ({myServices.length})
                </button>
              </div>
            )}

            <div className="svc-tiles-wrap">
              <div className="svc-tiles">
                <button
                  type="button"
                  className={`svc-tile${activeCat === '' ? ' active' : ''}`}
                  onClick={() => setActiveCat('')}
                >
                  <span className="svc-tile-square"><LayoutGrid size={24} strokeWidth={2} /></span>
                  <span className="svc-tile-label">All</span>
                  <span className="svc-tile-count">{services.length}</span>
                </button>
                {SERVICE_CATS.filter(c => catCounts[c.name]).map(c => {
                  const Icon = c.icon
                  return (
                    <button
                      type="button"
                      key={c.name}
                      className={`svc-tile${activeCat === c.name ? ' active' : ''}`}
                      onClick={() => setActiveCat(c.name)}
                    >
                      <span className="svc-tile-square"><Icon size={24} strokeWidth={2} /></span>
                      <span className="svc-tile-label">{c.name}</span>
                      <span className="svc-tile-count">{catCounts[c.name]}</span>
                    </button>
                  )
                })}
              </div>
              <div className="svc-tiles-fade" />
            </div>

            {showRail && (
              <div className="svc-featured-wrap">
                <div className="svc-featured-header">
                  <h2 className="svc-featured-title">Featured Providers</h2>
                  <p className="svc-featured-sub">Verified providers near you</p>
                </div>
                <div className="svc-featured-rail" ref={railRef}>
                  {featuredRail.map((svc) => (
                    <div className="svc-featured-card" key={svc.id}>
                      <ServiceCard
                        svc={svc}
                        delay={0}
                        onClick={() => setSelectedProvider(svc)}
                        onBook={() => {
                          if (currentUser) navigate(`/chat/${svc.provider_id}/${svc.id}?src=service`, { state: { source: 'service' } })
                        }}
                    onChat={() => {
                      if (currentUser) { trackServiceChat(svc); navigate(`/chat/${svc.provider_id}/${svc.id}?src=service`, { state: { source: 'service' } }) }
                    }}
                        isMine={svc.provider_id === currentUser?.id}
                        onEdit={() => { setEditingService(svc); setTab('post') }}
                        featuredBadge={!!svc.is_featured}
                      />
                    </div>
                  ))}
                </div>
                {!isMobile && (
                  <>
                    <button type="button" className="svc-rail-arrow svc-rail-arrow-left" onClick={() => scrollRail(-1)} aria-label="Previous featured">‹</button>
                    <button type="button" className="svc-rail-arrow svc-rail-arrow-right" onClick={() => scrollRail(1)} aria-label="Next featured">›</button>
                    <div className="svc-rail-fade svc-rail-fade-left" />
                    <div className="svc-rail-fade svc-rail-fade-right" />
                  </>
                )}
              </div>
            )}

            <div className="svc-toolbar2">
              <div className="svc-toolbar-left">
                <span className="svc-result-text">{resultText}</span>
                {!isMobile && (
                  <button
                    type="button"
                    className={`svc-verified-chip${verifiedOnly ? ' on' : ''}`}
                    onClick={() => setVerifiedOnly(v => !v)}
                  >
                    Verified only
                  </button>
                )}
              </div>
              <div className="svc-toolbar-right">
                {isMobile ? (
                  <div className="svc-sheet-triggers">
                    <button type="button" className="svc-tool-btn" onClick={openFilter}>
                      <Filter size={16} strokeWidth={2.2} /> Filter
                      {filterActive && <span className="svc-filter-dot" />}
                    </button>
                    <button type="button" className="svc-tool-btn" onClick={() => setSortOpen(true)}>
                      <ArrowUpDown size={16} strokeWidth={2.2} /> Sort
                    </button>
                  </div>
                ) : (
                  <div className="svc-desktop-controls">
                    <select
                      className="svc-sort-inline"
                      value={sortBy}
                      onChange={e => setSortBy(e.target.value)}
                    >
                      <option value="recommended">Recommended</option>
                      <option value="newest">Newest</option>
                      <option value="verified">Verified first</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {loading && (
              <div className="svc-grid">
                {[1, 2, 3, 4, 5, 6].map(i => (
                  <div key={i} className="svc-skeleton-card">
                    <div className="svc-skeleton-shimmer svc-skeleton-img" />
                    <div className="svc-skeleton-body">
                      <div className="svc-skeleton-shimmer svc-skeleton-line" />
                      <div className="svc-skeleton-shimmer svc-skeleton-line short" />
                      <div className="svc-skeleton-shimmer svc-skeleton-line price" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!loading && error && (
              <div className="svc-empty">
                <p className="svc-empty-title">Couldn't load services</p>
                <button type="button" className="svc-retry-btn" onClick={loadServices}>Try again</button>
              </div>
            )}

            {!loading && !error && filtered.length === 0 && (
              <>
                <div className="svc-empty">
                  <div className="svc-empty-icon"><Search size={40} strokeWidth={1.5} color="#80868b" /></div>
                  <p className="svc-empty-title">No services found</p>
                  <p className="svc-empty-sub">Try another category or city</p>
                  <button type="button" className="svc-clear-btn" onClick={() => { setSearchInput(''); setSearch(''); setActiveCat(''); setActiveCity('All'); setVerifiedOnly(false); setSortBy('newest') }}>
                    Clear filters
                  </button>
                </div>
                {renderCta()}
              </>
            )}

            {!loading && filtered.length > 0 && (
              <>
                <div className="svc-grid">
                  {filtered.slice(0, displayCount).map((svc, i) => (
                    <ServiceCard
                      key={svc.id}
                      svc={svc}
                      delay={i * 0.03}
                      priority={i < 4}
                      onClick={() => setSelectedProvider(svc)}
                      onBook={() => {
                        if (currentUser) navigate(`/chat/${svc.provider_id}/${svc.id}?src=service`, { state: { source: 'service' } })
                      }}
                      onChat={() => {
                        if (currentUser) { trackServiceChat(svc); navigate(`/chat/${svc.provider_id}/${svc.id}?src=service`, { state: { source: 'service' } }) }
                      }}
                      isMine={svc.provider_id === currentUser?.id}
                      onEdit={() => { setEditingService(svc); setTab('post') }}
                    />
                  ))}
                </div>
                {isPhone && displayCount < filtered.length && (
                  <div ref={sentinelRef} style={{ height: 1 }} />
                )}
                {!isPhone && displayCount < filtered.length && (
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: 16 }}>
                    <button type="button" className="svc-load-more" onClick={() => setDisplayCount(c => Math.min(c + pageSize, filtered.length))}>
                      Load more services
                    </button>
                  </div>
                )}
              {!(loading || error) && renderCta()}
              </>
            )}


          </>
        )}

        {tab === 'post' && (
          <div className="svc-form-wrap">
            <ServiceForm
              editingService={editingService}
              onSuccess={() => { loadServices(); setTab('mine'); setEditingService(null) }}
              onCancel={() => { setEditingService(null); setTab('mine') }}
            />
          </div>
        )}

        {tab === 'mine' && (
          <>
            <div className="svc-segmented">
              <button type="button" className={`svc-seg${tab === 'browse' ? ' active' : ''}`} onClick={() => setTab('browse')} aria-label="All Services">
                All Services
              </button>
              <button type="button" className={`svc-seg${tab === 'mine' ? ' active' : ''}`} onClick={() => setTab('mine')} aria-label="My Services">
                My Services ({myServices.length})
              </button>
            </div>
            {myServices.length === 0 ? (
              <div className="svc-empty">
                <div className="svc-empty-icon"><Wrench size={40} strokeWidth={1.5} color="#80868b" /></div>
                <p className="svc-empty-title">You haven't listed a service yet</p>
                <p className="svc-empty-sub">Tap Post Now to list one.</p>
              </div>
            ) : (
              <div className="svc-grid">
                {myServices.map((svc, i) => (
                  <ServiceCard
                    key={svc.id}
                    svc={svc}
                    delay={i * 0.03}
                    onClick={() => setSelectedProvider(svc)}
                    isMine={true}
                    showCounters={true}
                    onEdit={() => { setEditingService(svc); setTab('post') }}
                  />
                ))}
              </div>
            )}
            {renderCta()}
          </>
        )}
      </div>

      {filterOpen && isMobile && (
        <>
          <div className="svc-sheet-backdrop" onClick={() => setFilterOpen(false)} />
          <div
            className="svc-filter-sheet"
            onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
            onTouchEnd={e => { if (e.changedTouches[0].clientY - touchStartY.current > 60) setFilterOpen(false) }}
          >
            <div className="svc-sheet-handle" />
            <div className="svc-sheet-title">Filters</div>
            <div className="svc-sheet-body">
              <div className="svc-sheet-section">
                <div className="svc-toggle-row">
                  <span className="svc-toggle-label">Verified providers only</span>
                  <button
                    type="button"
                    className={`svc-toggle-track${draftVerified ? ' on' : ''}`}
                    onClick={() => setDraftVerified(v => !v)}
                    role="switch"
                    aria-checked={draftVerified}
                  >
                    <span className="svc-toggle-thumb" />
                  </button>
                </div>
              </div>

              <div className="svc-sheet-section">
                <span className="svc-sheet-section-title">Category</span>
                <div className="svc-chips">
                  <button
                    type="button"
                    className={`svc-chip${draftCat === '' ? ' active' : ''}`}
                    onClick={() => setDraftCat('')}
                  >
                    All
                  </button>
                  {SERVICE_CATS.filter(c => catCounts[c.name]).map(c => {
                    const Icon = c.icon
                    return (
                      <button
                        type="button"
                        key={c.name}
                        className={`svc-chip${draftCat === c.name ? ' active' : ''}`}
                        onClick={() => setDraftCat(c.name)}
                      >
                        <Icon size={14} strokeWidth={2.2} />
                        {c.name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="svc-sheet-section">
                <span className="svc-sheet-section-title">City</span>
                <div className="svc-city-list-filter">
                  <button
                    type="button"
                    className={`svc-city-item${draftCity === 'All' ? ' active' : ''}`}
                    onClick={() => setDraftCity('All')}
                  >
                    All cities
                  </button>
                  {CITIES.filter(c => c !== 'All').map(c => (
                    <button
                      type="button"
                      key={c}
                      className={`svc-city-item${draftCity === c ? ' active' : ''}`}
                      onClick={() => setDraftCity(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="svc-sheet-footer">
              <button type="button" className="svc-clear-text" onClick={clearFilterDraft}>Clear</button>
              <button type="button" className="svc-apply-btn" onClick={applyFilter}>Apply</button>
            </div>
          </div>
        </>
      )}

      {sortOpen && isMobile && (
        <>
          <div className="svc-sheet-backdrop" onClick={() => setSortOpen(false)} />
          <div
            className="svc-sort-sheet"
            onTouchStart={e => { touchStartY.current = e.touches[0].clientY }}
            onTouchEnd={e => { if (e.changedTouches[0].clientY - touchStartY.current > 60) setSortOpen(false) }}
          >
            <div className="svc-sheet-handle" />
            <button
              type="button"
              className={`svc-sort-row${sortBy === 'recommended' ? ' on' : ''}`}
              onClick={() => { setSortBy('recommended'); setSortOpen(false) }}
            >
              <span className="svc-radio">{sortBy === 'recommended' && <span className="svc-radio-dot" />}</span>
              <span className="svc-sort-label">Recommended</span>
            </button>
            <button
              type="button"
              className={`svc-sort-row${sortBy === 'newest' ? ' on' : ''}`}
              onClick={() => { setSortBy('newest'); setSortOpen(false) }}
            >
              <span className="svc-radio">{sortBy === 'newest' && <span className="svc-radio-dot" />}</span>
              <span className="svc-sort-label">Newest</span>
            </button>
            <button
              type="button"
              className={`svc-sort-row${sortBy === 'verified' ? ' on' : ''}`}
              onClick={() => { setSortBy('verified'); setSortOpen(false) }}
            >
              <span className="svc-radio">{sortBy === 'verified' && <span className="svc-radio-dot" />}</span>
              <span className="svc-sort-label">Verified first</span>
            </button>
          </div>
        </>
      )}

      {selectedProvider && (
        <ProviderModal provider={selectedProvider} currentUser={currentUser} onClose={() => setSelectedProvider(null)} />
      )}
    </div>
  )
}
