/**
 * SokoMW — Homepage (v3)
 * Full information-architecture rebuild: marketplace discovery hub
 * spanning Listings, Shops, Looking For, Jobs, Services, Stories,
 * and Verification — with monetization (Featured Listing/Shop/Request,
 * Story Promotion, Verification) surfaced as a first-class, non-spammy
 * revenue section rather than scattered upsells.
 *
 * SokoMW does not process payments. It connects buyers and sellers;
 * users transact and communicate directly. Nothing here implies
 * in-app checkout.
 *
 * Preserves all existing wiring: supabase queries, navigate(), hooks
 * (useUserLocation, useSearchAnimation), constants (ALL_CATEGORIES),
 * utils (isFlashActive, sortProductsSmart, trackSearch). Stories use the
 * same fetchAllActiveStories/StoryViewer/StatusUploadModal building blocks
 * as HomeStatusRow, but rendered as a compact LiveStoriesCard next to
 * Featured Listings (matching the reference layout) rather than
 * HomeStatusRow's full-width dark bar, which doesn't fit that slot.
 * Status section uses HomeStatusSection component (StatusPage-style).
 */

import React, {
  useEffect, useState, useMemo, useRef,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase }              from '../lib/supabase'
import useSearchAnimation        from '../hooks/useSearchAnimation'
import { useUserLocation }       from '../hooks/useUserLocation'
import { fetchAllActiveStories } from '../hooks/useStatuses'
import VerificationAttentionBanner from '../components/VerificationAttentionBanner'
import SokoNav from '../components/SokoNav'
import LookingForRequestCard, { LOOKING_FOR_CARD_CSS } from '../components/LookingFor/LookingForRequestCard'
import {
  getGPSLocation,
  sortRequestsByViewerLocation,
  withDistanceToBuyer,
} from '../utils/lookingFor'
import {
  ALL_CATEGORIES,
} from '../constants/homeConstants'
import {
  isFlashActive, isListingFeatured, rotateFeaturedFairly, sortProductsSmart, trackSearch,
} from '../utils/homeUtils'
import { buildChatPath } from '../utils/chatSources'
import {
  FEATURED_DURATION_DAYS,
  FEATURED_PRICE_MWK,
} from '../constants/featuredPricing'
import lookingForHeroImg from '../assets/looking-for-hero.jpg'
import HomeStatusSection from '../components/HomeStatusSection'

/* ─────────────────────────────────────────────────────────────────────────────
   DESIGN TOKENS
   Brand green is reserved for true brand moments (logo, primary sell CTA,
   verification). Marketplace UI leans neutral + amber/blue accents so Home
   doesn't read as a wall of green.
───────────────────────────────────────────────────────────────────────────── */
const T = {
  green:   '#0F9D58',
  greenD:  '#0a7a44',
  greenDk: '#063d23',   // deep green for hero/dark surfaces
  greenL:  '#e8f5ee',
  amber:   '#F9AB00',
  amberD:  '#c88a00',
  amberL:  '#fff8e6',
  blue:    '#1A73E8',
  blueD:   '#1557b0',
  blueL:   '#e8f0fe',
  red:     '#ea4335',
  violet:  '#7c5cff',
  violetL: '#efeaff',
  ink:     '#1a1d21',    // primary price / emphasis (not green)
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
  radiusXl: '28px',
  font:        "'Inter', 'DM Sans', system-ui, sans-serif",
  fontDisplay: "'Sora', 'Inter', system-ui, sans-serif",
}

/* Category → emoji + accent, used by the quick-access grid and pills.
   CAT_META in homeConstants has no emoji key, so it's extended locally
   rather than mutating the shared constant. */
const CAT_ICON = {
  Electronics: { emoji: '📱', bg: '#f0f4ff', fg: '#4f46e5' },
  Vehicles:    { emoji: '🚘', bg: '#f0f9ff', fg: '#0284c7' },
  Property:    { emoji: '🏡', bg: '#fff7ed', fg: '#c2410c' },
  Clothing:    { emoji: '👔', bg: '#fdf4ff', fg: '#9333ea' },
  Agriculture: { emoji: '🌿', bg: '#ecfdf5', fg: '#0f766e' },
  Furniture:   { emoji: '🛋️', bg: '#fffbeb', fg: '#d97706' },
  Food:        { emoji: '🍜', bg: '#fff1f2', fg: '#e11d48' },
  Services:    { emoji: '⚡', bg: '#f8fafc', fg: '#475569' },
  Other:       { emoji: '📦', bg: '#f8fafc', fg: '#64748b' },
  Jobs:        { emoji: '💼', bg: '#eff6ff', fg: '#2563eb' },
}
function catIcon(cat) { return CAT_ICON[cat] || CAT_ICON.Other }

/* ─────────────────────────────────────────────────────────────────────────────
   GLOBAL STYLES
───────────────────────────────────────────────────────────────────────────── */
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

      .soko-v3 {
        font-family: ${T.font};
        background: #f8f9fa;
        color: ${T.gray900};
        min-width: 0;
        overflow-x: clip;
        min-height: 100vh;
        min-height: 100dvh;
      }
      .soko-v3 button { font-family: inherit; }
      .soko-v3 input  { font-family: inherit; }
      .soko-v3 a { text-decoration: none; color: inherit; }
      .soko-v3 img { max-width: 100%; }

      .soko-scroll::-webkit-scrollbar { display: none; }
      .soko-scroll { -ms-overflow-style: none; scrollbar-width: none; }

      @keyframes fadeUp   { from { opacity:0; transform:translateY(18px);} to { opacity:1; transform:translateY(0);} }
      @keyframes fadeIn   { from { opacity:0; } to { opacity:1; } }
      @keyframes pulse    { 0%,100% { opacity:1; } 50% { opacity:.5; } }
      @keyframes shimmer  { 0% { background-position:-600px 0; } 100% { background-position:600px 0; } }
      /* Professional progressive home load */
      @keyframes premiumShimmer {
        0% { background-position: 100% 0; }
        100% { background-position: -100% 0; }
      }
      @keyframes sokoSettle {
        from { opacity: 0; transform: translateY(8px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes sokoProgressGlow {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.75; }
      }
      /* Slim top progress — YouTube/Linear style */
      .soko-loadbar {
        position: fixed; top: 0; left: 0; right: 0; z-index: 10000;
        height: 2.5px; pointer-events: none;
        background: transparent;
        opacity: 1;
        transition: opacity 0.35s ease 0.1s;
      }
      .soko-loadbar.is-done {
        opacity: 0;
      }
      .soko-loadbar-track {
        height: 100%;
        width: 100%;
        background: rgba(0,0,0,0.05);
      }
      .soko-loadbar-fill {
        height: 100%;
        border-radius: 0 2px 2px 0;
        background: linear-gradient(90deg, ${T.gray800} 0%, ${T.amber} 100%);
        box-shadow: 0 0 6px rgba(0,0,0,0.12);
        transform-origin: left center;
        transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
        animation: sokoProgressGlow 1.4s ease-in-out infinite;
      }
      .soko-loadbar.is-done .soko-loadbar-fill {
        animation: none;
      }
      /* Soft progressive section appearance — no blocking splash */
      .soko-settle {
        animation: sokoSettle 0.42s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      .soko-settle-d1 { animation-delay: 0.02s; }
      .soko-settle-d2 { animation-delay: 0.05s; }
      .soko-settle-d3 { animation-delay: 0.08s; }
      .soko-settle-d4 { animation-delay: 0.11s; }
      .soko-settle-d5 { animation-delay: 0.14s; }
      .soko-settle-d6 { animation-delay: 0.17s; }
      .soko-settle-d7 { animation-delay: 0.2s; }
      .soko-settle-d8 { animation-delay: 0.23s; }
      /* Content swap: skeleton → real data */
      .soko-swap-in {
        animation: sokoSettle 0.38s cubic-bezier(0.22, 1, 0.36, 1) both;
      }
      @media (prefers-reduced-motion: reduce) {
        .soko-settle, .soko-swap-in, .soko-loadbar-fill {
          animation: none !important;
          transition: none !important;
        }
        .soko-settle, .soko-swap-in { opacity: 1; transform: none; }
        .soko-loadbar { transition: opacity 0.15s ease; }
      }
      @keyframes liveRing { 0%,100% { box-shadow:0 0 0 3px rgba(234,67,53,.25);} 50% { box-shadow:0 0 0 7px rgba(234,67,53,.06);} }
      @keyframes badgePop { 0% { transform:scale(.7); opacity:0;} 70% { transform:scale(1.1);} 100% { transform:scale(1); opacity:1;} }
      @keyframes hotDealGlow {
        0%, 100% { box-shadow: 0 2px 8px rgba(234,67,53,0.45), 0 0 0 0 rgba(234,67,53,0.5); }
        50%      { box-shadow: 0 2px 8px rgba(234,67,53,0.45), 0 0 0 5px rgba(234,67,53,0); }
      }
      .soko-hotdeal-pulse { animation: hotDealGlow 1.8s ease-in-out infinite; }
      .soko-dual-badge-card { position: relative; }
      .soko-dual-badge-card::after {
        content: ''; position: absolute; inset: 0; border-radius: inherit;
        background: linear-gradient(120deg, rgba(249,171,0,0.06), rgba(234,67,53,0.06));
        pointer-events: none;
      }
      @keyframes wordSlide{ 0% { opacity:0; transform:translateY(6px);} 15% { opacity:1; transform:translateY(0);} 85% { opacity:1; transform:translateY(0);} 100% { opacity:0; transform:translateY(-6px);} }
      @keyframes floatY   { 0%,100% { transform:translateY(0);} 50% { transform:translateY(-6px);} }

      .soko-card-bg { background:#fff !important; color:#202124 !important; }

      .soko-card-hover { transition: transform .22s cubic-bezier(.34,1.2,.64,1), box-shadow .22s ease; cursor:pointer; }
      .soko-card-hover:hover { transform: translateY(-4px) scale(1.01); box-shadow:${T.shadowLg} !important; }

      /* ── Product cards — uniform size system (marketplace best practice) ──
         Square media, reserved body height, 2-line title clamp so every card
         in a row/rail matches regardless of title length, price digits, or badges. */
      .soko-product-card {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-width: 0;
        background: #fff;
        border-radius: 14px;
        overflow: hidden;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }
      .soko-product-card-media {
        position: relative;
        width: 100%;
        aspect-ratio: 1 / 1;
        flex-shrink: 0;
        overflow: hidden;
        background: ${T.gray100};
      }
      .soko-product-card-media img {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }
      .soko-product-card-body {
        display: flex;
        flex-direction: column;
        gap: 5px;
        padding: 10px 12px 8px;
        flex: 1 1 auto;
        min-height: 78px;
        box-sizing: border-box;
      }
      /* Fixed-height quick actions — same on every card (Chat always, Call optional) */
      .soko-product-card-actions {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
        min-height: 40px;
        height: 40px;
        padding: 0 10px 10px;
        box-sizing: content-box;
      }
      .soko-pca-chat {
        flex: 1 1 auto;
        min-width: 0;
        height: 32px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        border: none;
        border-radius: 10px;
        background: ${T.gray100};
        color: ${T.gray800};
        font-size: 12px;
        font-weight: 700;
        font-family: inherit;
        cursor: pointer;
        transition: background 0.15s, transform 0.1s, color 0.15s;
        -webkit-tap-highlight-color: transparent;
      }
      .soko-pca-chat:hover { background: ${T.blueL}; color: ${T.blueD}; }
      .soko-pca-chat:active { transform: scale(0.98); }
      .soko-pca-call {
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
        transition: border-color 0.15s, background 0.15s, transform 0.1s, color 0.15s;
        -webkit-tap-highlight-color: transparent;
      }
      .soko-pca-call:hover { border-color: ${T.gray400}; color: ${T.gray900}; background: ${T.gray50}; }
      .soko-pca-call:active { transform: scale(0.96); }
      .soko-product-card-save {
        position: absolute;
        top: 8px;
        right: 8px;
        z-index: 4;
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: none;
        cursor: pointer;
        background: rgba(255,255,255,0.94);
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
        display: flex;
        align-items: center;
        justify-content: center;
        color: ${T.gray700};
        box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        transition: transform 0.15s, color 0.15s, background 0.15s;
        -webkit-tap-highlight-color: transparent;
      }
      .soko-product-card-save.is-saved { color: ${T.red}; }
      .soko-product-card-save:active { transform: scale(0.92); }
      .soko-product-card-title {
        font-size: 13px;
        font-weight: 700;
        color: ${T.gray900};
        line-height: 1.3;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        min-height: calc(1.3em * 2);
        word-break: break-word;
      }
      .soko-product-card-price {
        font-family: ${T.fontDisplay};
        font-size: 15px;
        font-weight: 800;
        color: ${T.greenD};
        letter-spacing: -0.3px;
        line-height: 1.25;
        min-height: 1.25em;
        max-height: 2.5em;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        word-break: break-word;
      }
      .soko-product-card-meta {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 6px;
        font-size: 11px;
        color: ${T.gray600};
        min-height: 16px;
        margin-top: auto;
      }
      .soko-product-card-meta > span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        min-width: 0;
      }
      /* Featured rail: fixed card width, never wrap into vertical stack */
      .soko-featured-rail {
        display: flex !important;
        flex-wrap: nowrap !important;
        overflow-x: auto !important;
        overflow-y: hidden !important;
        -webkit-overflow-scrolling: touch;
        scroll-snap-type: x mandatory;
        width: 100%;
        max-width: 100%;
        min-width: 0;
      }
      .soko-featured-card-wrap {
        flex: 0 0 168px;
        flex-shrink: 0;
        width: 168px;
        max-width: 168px;
        scroll-snap-align: start;
        min-width: 0;
      }
      .soko-featured-card-wrap .soko-product-card {
        height: auto;
        width: 100%;
        max-width: 100%;
      }
      /* Latest grid — fixed columns so cards never stack single-file */
      .soko-latest-grid {
        display: grid !important;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap: 16px;
        align-items: stretch;
        width: 100%;
        min-width: 0;
      }
      .soko-latest-card-wrap {
        min-width: 0;
        width: 100%;
        max-width: 100%;
        height: 100%;
        display: flex;
      }
      .soko-latest-card-wrap > .soko-product-card {
        width: 100%;
        max-width: 100%;
        flex: 1;
        min-width: 0;
      }
      @media (max-width: 1100px) {
        .soko-latest-grid { grid-template-columns: repeat(3, minmax(0, 1fr)) !important; gap: 14px; }
      }
      @media (max-width: 768px) {
        .soko-latest-grid { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; gap: 10px; }
        .soko-featured-card-wrap {
          flex: 0 0 150px !important;
          width: 150px !important;
          max-width: 150px !important;
        }
      }

      .soko-btn-primary {
        background:${T.green}; color:#fff; border:none; border-radius:14px;
        padding:12px 24px; font-size:14px; font-weight:700; cursor:pointer;
        transition: background .15s, transform .1s, box-shadow .15s;
        display:inline-flex; align-items:center; gap:7px; white-space:nowrap;
      }
      .soko-btn-primary:hover { background:${T.greenD}; box-shadow:0 4px 16px rgba(15,157,88,.35); transform:translateY(-1px); }
      .soko-btn-primary:active { transform: scale(.98); }

      .soko-btn-outline {
        background:rgba(255,255,255,.1); color:#fff; border:1.5px solid rgba(255,255,255,.32);
        border-radius:14px; padding:12px 24px; font-size:14px; font-weight:600; cursor:pointer;
        transition: background .15s, transform .1s; display:inline-flex; align-items:center; gap:7px;
        white-space:nowrap; backdrop-filter: blur(8px);
      }
      .soko-btn-outline:hover { background:rgba(255,255,255,.2); transform:translateY(-1px); }

      .skeleton {
        background: linear-gradient(110deg, #e8ecf0 8%, #f6f7f9 18%, #e8ecf0 33%);
        background-size: 200% 100%;
        animation: premiumShimmer 1.55s ease-in-out infinite;
        border-radius: 12px;
      }
      .skeleton-soft {
        background: linear-gradient(110deg, #eef2f0 8%, #f8faf9 18%, #eef2f0 33%);
        background-size: 200% 100%;
        animation: premiumShimmer 1.7s ease-in-out infinite;
        border-radius: 14px;
      }

      .soko-tab {
        padding:8px 16px; border-radius:50px; border:1.5px solid ${T.gray200};
        background:#fff; font-size:13px; font-weight:600; color:${T.gray600};
        cursor:pointer; transition: all .15s; white-space:nowrap;
      }
      .soko-tab.active { background:${T.gray900} !important; border-color:${T.gray900} !important; color:#fff !important; box-shadow:0 2px 10px rgba(0,0,0,.12); }
      .soko-tab:hover { border-color:${T.gray400}; color:${T.gray900}; background:${T.gray50}; }

      .soko-nav-glass {
        position: sticky; top:0; z-index:100;
        backdrop-filter: blur(20px) saturate(1.8); -webkit-backdrop-filter: blur(20px) saturate(1.8);
        background: rgba(255,255,255,.92); border-bottom:1px solid rgba(0,0,0,.07);
        box-shadow: 0 1px 0 rgba(0,0,0,.04), 0 4px 20px rgba(0,0,0,.04);
      }

      .soko-pillar-link { transition: background .15s, color .15s, transform .15s; }
      .soko-pillar-link:hover { background:${T.gray100}; transform: translateY(-1px); }
      /* Quiet text links — green only on hover */
      .soko-link-quiet {
        background: none; border: none; font-size: 13px; font-weight: 600;
        color: ${T.gray700}; cursor: pointer; font-family: inherit;
        transition: color 0.15s;
      }
      .soko-link-quiet:hover { color: ${T.greenD}; }
      .soko-btn-dark {
        background: ${T.gray900}; color: #fff; border: none; border-radius: 14px;
        padding: 12px 24px; font-size: 14px; font-weight: 700; cursor: pointer;
        transition: background .15s, transform .1s, box-shadow .15s;
        display: inline-flex; align-items: center; gap: 7px; white-space: nowrap;
        font-family: inherit;
      }
      .soko-btn-dark:hover { background: #000; box-shadow: 0 4px 16px rgba(0,0,0,.18); transform: translateY(-1px); }
      .soko-btn-dark:active { transform: scale(.98); }

      .soko-cat-tile:hover { border-color:${T.gray200} !important; box-shadow:${T.shadow}; transform: translateY(-3px); }
      .soko-cat-tile:active { transform: translateY(-1px); }

      @media (max-width: 980px) {
        .soko-trust-grid { grid-template-columns: repeat(2,1fr) !important; }
        .soko-jobs-services { grid-template-columns: 1fr 1fr !important; }
        .soko-footer-grid { grid-template-columns: 1fr 1fr !important; }
        .soko-featured-stories-grid { grid-template-columns: 1fr !important; }
      }
      /* Categories: always one horizontal line on phone/tablet (scroll, never wrap) */
      @media (max-width: 980px) {
        .soko-cat-section {
          padding: 12px 0 6px !important;
        }
        .soko-cat-section > div {
          max-width: none !important;
          width: 100% !important;
        }
        .soko-cat-grid {
          display: flex !important;
          flex-direction: row !important;
          flex-wrap: nowrap !important;
          align-items: stretch !important;
          grid-template-columns: none !important;
          grid-auto-flow: column !important;
          gap: 8px !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
          -webkit-overflow-scrolling: touch;
          scroll-snap-type: x mandatory;
          scrollbar-width: none;
          -ms-overflow-style: none;
          padding: 0 14px 4px !important;
          margin: 0 !important;
          width: 100% !important;
          max-width: 100% !important;
        }
        .soko-cat-grid::-webkit-scrollbar { display: none !important; }
        .soko-cat-grid .soko-cat-tile {
          flex: 0 0 auto !important;
          flex-shrink: 0 !important;
          width: 72px !important;
          min-width: 72px !important;
          max-width: 72px !important;
          scroll-snap-align: start;
          padding: 10px 6px 8px !important;
          border-radius: 14px !important;
          gap: 6px !important;
        }
        .soko-cat-grid .soko-cat-tile > div:first-child {
          width: 36px !important;
          height: 36px !important;
        }
        .soko-cat-grid .soko-cat-tile .soko-cat-sub { display: none !important; }
        .soko-cat-grid .soko-cat-tile .soko-cat-label {
          font-size: 10.5px !important;
          line-height: 1.15 !important;
          white-space: nowrap !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
          max-width: 68px !important;
        }
      }
      @media (max-width: 768px) {
        /* ── App shell (not a website) ── */
        .soko-v3 {
          /* Bottom clearance comes from body (bottom nav) — keep shell light */
          padding-bottom: 8px;
          min-height: 100dvh;
          overscroll-behavior-y: contain;
          -webkit-tap-highlight-color: transparent;
          background: #f3f4f6;
          -webkit-overflow-scrolling: touch;
        }

        /* Hide website bottom banners/footer on mobile — app shell only */
        .soko-footer,
        .soko-early-access,
        .soko-trust-section,
        .soko-sell-cta {
          display: none !important;
        }

        /* Marketing subcopy — desktop-only copy (section CSS handles LF) */
        .soko-web-only {
          display: none !important;
        }

        .soko-jobs-services { grid-template-columns: 1fr !important; gap: 12px !important; }
        .soko-listings-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 10px !important;
        }
        .soko-nav-desktop { display: none !important; }
        .soko-nav-mobile  { display: flex !important; }
        .soko-pillar-row  { display: none !important; }
        .soko-shops-grid { grid-template-columns: 1fr !important; }
        .soko-footer-grid { grid-template-columns: 1fr 1fr !important; gap: 16px !important; }
        .soko-trust-grid { grid-template-columns: 1fr 1fr !important; gap: 10px !important; }

        /* Compact sticky header */
        .soko-nav-glass {
          box-shadow: 0 1px 0 rgba(0,0,0,.06);
        }
        .soko-nav-row1 {
          padding: 8px 14px !important;
          min-height: 52px !important;
          gap: 10px !important;
        }
        .soko-nav-brand-mark { font-size: 18px !important; }
        .soko-nav-mobile-search {
          min-height: 40px !important;
          padding: 0 12px !important;
          border-radius: 12px !important;
          background: #f3f4f6 !important;
          border-color: #e5e7eb !important;
        }
        .soko-nav-mobile-pillars {
          padding: 6px 12px 10px !important;
        }
        .soko-nav-mobile-pillars button {
          padding: 7px 12px !important;
          font-size: 12px !important;
          border-radius: 999px !important;
        }

        /* Ad banner — compact full-width promo strip */
        .soko-hero-section.soko-ad-banner {
          min-height: 0 !important;
        }
        /* Product cards — mobile denser but still equal-sized */
        .soko-product-card-body {
          min-height: 72px;
          padding: 8px 10px 6px;
          gap: 4px;
        }
        .soko-product-card-title {
          font-size: 12.5px;
        }
        .soko-product-card-price {
          font-size: 14px;
        }
        .soko-product-card-meta {
          font-size: 10.5px;
        }
        .soko-product-card-actions {
          min-height: 38px;
          height: 38px;
          padding: 0 8px 8px;
          gap: 5px;
        }
        .soko-pca-chat {
          height: 30px;
          font-size: 11.5px;
          border-radius: 9px;
        }
        .soko-pca-call {
          width: 30px;
          height: 30px;
          flex-basis: 30px;
          border-radius: 9px;
        }
        .soko-featured-card-wrap {
          width: 150px !important;
        }

        /* Horizontal rails — edge padding only on full-bleed rails */
        .soko-scroll {
          padding-left: 14px !important;
          padding-right: 14px !important;
          scroll-padding-inline: 14px;
          gap: 10px !important;
        }
        .soko-section-pad {
          padding-left: 14px !important;
          padding-right: 14px !important;
        }
        .soko-section-title {
          font-size: 17px !important;
          letter-spacing: -0.02em !important;
        }

        /* Featured / banners */
        .soko-featured-banner {
          margin: 0 !important;
          border-radius: 14px !important;
          padding: 12px !important;
          gap: 10px !important;
          flex-direction: column !important;
          align-items: stretch !important;
        }
        .soko-featured-banner .soko-feat-banner-title {
          flex: 1 1 auto !important;
        }
        .soko-featured-banner .soko-feat-banner-pricing {
          display: flex !important;
          width: 100% !important;
          flex-wrap: wrap !important;
          gap: 8px !important;
        }
        .soko-featured-banner .soko-feat-price-chip {
          flex: 1 1 auto !important;
          min-width: 0 !important;
          width: 100% !important;
          justify-content: flex-start !important;
          padding: 10px 12px !important;
          min-height: 48px;
        }
        .soko-featured-banner .soko-feat-price-chip .soko-feat-price-amount {
          font-size: 13px !important;
          font-weight: 800 !important;
        }
        .soko-featured-banner .soko-feat-banner-cta {
          width: 100% !important;
          margin-left: 0 !important;
          justify-content: center !important;
          min-height: 44px;
          padding: 12px 16px !important;
        }
        section[aria-label="Get featured pricing"] {
          padding: 12px 14px 0 !important;
        }

        /* Featured rail: no double padding inside section-pad */
        .soko-featured-section {
          padding-top: 16px !important;
          padding-bottom: 8px !important;
        }
        .soko-featured-section .soko-featured-rail {
          padding-left: 0 !important;
          padding-right: 0 !important;
          padding-top: 4px !important;
          scroll-padding-inline: 0;
          gap: 10px !important;
          -webkit-overflow-scrolling: touch;
        }

        /* Stories strip between featured + latest */
        .soko-stories-strip {
          padding-left: 14px !important;
          padding-right: 14px !important;
        }

        /* Latest listings 2-col marketplace grid */
        .soko-latest-section {
          padding-left: 14px !important;
          padding-right: 14px !important;
          padding-bottom: 24px !important;
        }
        .soko-product-card .soko-latest-badge-stack,
        .soko-product-card-media .soko-latest-badge-stack {
          top: 8px !important;
          left: 8px !important;
          gap: 4px !important;
        }
        .soko-product-card .soko-latest-wish {
          top: 7px !important;
          right: 7px !important;
          width: 28px !important;
          height: 28px !important;
        }

        /* Looking For section mobile handled in component styles */

        /* Content sections — denser app spacing */
        .soko-shops-jobs-section {
          padding: 16px 14px 8px !important;
        }
        .soko-shops-jobs-section .soko-section-title,
        .soko-shops-jobs-section h3 {
          font-size: 16px !important;
        }
        .soko-section-pad {
          padding-top: 16px !important;
          padding-bottom: 8px !important;
        }
        .soko-latest-section {
          padding-bottom: 16px !important;
        }

        /* Featured revenue banner — compact app strip */
        section[aria-label="Get featured pricing"] {
          padding: 8px 14px 0 !important;
        }
        .soko-featured-banner {
          border-radius: 12px !important;
          padding: 10px 12px !important;
        }

        /* App-like cards: consistent radius + touch feedback */
        .soko-product-card,
        .soko-latest-card,
        .soko-card-bg {
          border-radius: 14px !important;
        }
        .soko-product-card:active,
        .soko-card-hover:active {
          transform: scale(0.98);
          opacity: 0.96;
        }

        /* Sticky nav feels native */
        .soko-nav-glass {
          position: sticky;
          top: 0;
          z-index: 100;
          padding-top: env(safe-area-inset-top, 0px);
        }

        /* Section headers — app density */
        .soko-section-header {
          margin-bottom: 12px !important;
          align-items: center !important;
        }
        .soko-section-action {
          padding: 6px 12px !important;
          font-size: 12px !important;
          min-height: 36px;
        }

        /* Ad banner edge-to-edge on mobile app shell */
        .soko-hero-section.soko-ad-banner {
          border-radius: 0 !important;
          margin: 0 !important;
        }
      }
      @media (max-width: 380px) {
        .soko-listings-grid {
          gap: 8px !important;
        }
        .soko-featured-card-wrap {
          width: 140px !important;
        }
        .soko-product-card-body {
          min-height: 80px;
          padding: 7px 8px 9px;
        }
        .soko-product-card-title { font-size: 12px; }
        .soko-product-card-price { font-size: 13px; }
      }
      @media (hover: none) {
        .soko-card-hover:hover { transform: none; box-shadow: inherit !important; }
      }
      @media (min-width: 769px) {
        .soko-nav-mobile { display:none !important; }
        .soko-bottom-nav-mobile { display:none !important; }
      }
    `}</style>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   ICONS (inline SVG, no external dep)
───────────────────────────────────────────────────────────────────────────── */
const Icon = {
  search: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  bell:   (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  chat:   (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  user:   (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  plus:   (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  heart:  (s=16,fill='none') => <svg width={s} height={s} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>,
  verify: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24"><path fill="#16a34a" d="M12 0a4 4 0 0 1 3.2 1.6 4 4 0 0 1 3.6 1 4 4 0 0 1 1 3.6A4 4 0 0 1 21.4 9.4a4 4 0 0 1 0 5.2A4 4 0 0 1 19.8 17.8a4 4 0 0 1-1 3.6 4 4 0 0 1-3.6 1A4 4 0 0 1 12 24a4 4 0 0 1-3.2-1.6 4 4 0 0 1-3.6-1 4 4 0 0 1-1-3.6A4 4 0 0 1 2.6 14.6a4 4 0 0 1 0-5.2A4 4 0 0 1 4.2 6.2a4 4 0 0 1 1-3.6 4 4 0 0 1 3.6-1A4 4 0 0 1 12 0Z"/><path d="m7.5 12.5 3 3 6-7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  eye:    (s=13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>,
  pin:    (s=13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>,
  clock:  (s=13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  chevR:  (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>,
  fire:   (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill={T.red}><path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z"/></svg>,
  shield: (s=20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  shieldCheck: (s=20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="M9 12l2 2 4-4"/></svg>,
  statusClock: (s=20) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="13" r="8"/><polyline points="12 9 12 13 15 14.5"/><path d="M9 2h6"/></svg>,
  star:   (s=13,fill='#F9AB00') => <svg width={s} height={s} viewBox="0 0 24 24" fill={fill}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  cam:    (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>,
  x:      (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  check:  (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12"/></svg>,
  shop:   (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>,
  briefcase: (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>,
  wrench: (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>,
  layers: (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>,
  megaphone: (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l18-5v12L3 13v-2z"/><path d="M11.6 16.8a3 3 0 0 1-5.8-1.6"/></svg>,
  handshake: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 17l-4-4 5-5 4 4z"/><path d="M2 13l4 4 1-1"/><path d="M21 13l-4 4-1-1"/></svg>,
  lightning: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  phoneCall: (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>,
  grid:   (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  car:    (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M5 17h14l1.5-5.5a2 2 0 0 0-1-2.3L17 8H7l-2.5 1.2a2 2 0 0 0-1 2.3z"/><path d="M5 17v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2"/><path d="M16 17v2a1 1 0 0 0 1 1h1a1 1 0 0 0 1-1v-2"/><circle cx="7.5" cy="14.5" r="0.5"/><circle cx="16.5" cy="14.5" r="0.5"/></svg>,
  phone:  (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><rect x="7" y="2" width="10" height="20" rx="2.2"/><line x1="11" y1="18" x2="13" y2="18"/></svg>,
  shirt:  (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3 4 6l1.5 3L8 7.5V21h8V7.5L18.5 9 20 6l-4-3-2 2h-4z"/></svg>,
  houseFilled: (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.5 2 11h3v9h6v-6h2v6h6v-9h3z"/></svg>,
  leaf:   (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M5 21c0-9 5-15 14-16-1 9-7 14-16 16z"/><path d="M5 21c2-4 5-7 9-9"/></svg>,
  tools:  (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l1.9-1.9a4.5 4.5 0 0 1-5.6 5.6L7 21H4v-3l8-8a4.5 4.5 0 0 1 5.6-5.6z"/></svg>,
}

/* ─────────────────────────────────────────────────────────────────────────────
   FORMAT HELPERS
───────────────────────────────────────────────────────────────────────────── */
function timeAgo(ts) {
  if (!ts) return ''
  const d = Date.now() - new Date(ts)
  const h = Math.floor(d / 3600000)
  const m = Math.floor(d / 60000)
  if (h >= 24) return `${Math.floor(h/24)}d ago`
  if (h >= 1)  return `${h}h ago`
  if (m < 1)   return 'just now'
  return `${m}m ago`
}
function formatPrice(n) {
  if (n == null || n === '') return ''
  const num = Number(n)
  if (!Number.isFinite(num)) return ''
  // Always show the full amount (e.g. MK 1,500,000) — never K/M shorthand
  return `MK ${Math.round(num).toLocaleString('en-US')}`
}

/* ─────────────────────────────────────────────────────────────────────────────
   PRIMARY PILLARS — the 7 things Soko offers. Always visible (desktop: row
   under the header; mobile: horizontal scroll chips). This is the IA fix:
   Shops / Looking For / Jobs / Services / Stories / Verification are first-
   class destinations, not buried in a hamburger menu.
───────────────────────────────────────────────────────────────────────────── */
/* SokoNav is shared — see src/components/SokoNav.jsx */

/* ─────────────────────────────────────────────────────────────────────────────
   HOME AD BANNER
   Full-bleed photo ads (image + left scrim for copy). Not product listings.
   HOME_ADS catalog is local for now — swap for CMS/ads table later.
───────────────────────────────────────────────────────────────────────────── */
const HOME_ADS = [
  {
    id: 'ad-shop',
    label: 'Sponsored',
    eyebrow: 'Advertise on SokoMW',
    title: 'Put your brand in front of buyers nationwide',
    sub: 'Promote shops, launches, and campaigns across Malawi.',
    cta: 'Advertise with us',
    path: '/shop-setup',
    accent: T.amber,
    glow: 'rgba(249,171,0,0.35)',
    image: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1800&q=80',
    imagePos: 'center 40%',
    points: ['Nationwide reach', 'Shop storefronts', 'Campaign ready'],
  },
  {
    id: 'ad-verify',
    label: 'Ad',
    eyebrow: 'Trusted sellers',
    title: 'Get Verified — sell with more confidence',
    sub: 'Buyers prefer verified sellers. Build trust and close deals faster.',
    cta: 'Get Verified',
    path: '/profile',
    accent: T.green,
    glow: 'rgba(15,157,88,0.4)',
    image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=1800&q=80',
    imagePos: 'center 35%',
    points: ['Trust badge', 'More inquiries', 'Safer deals'],
  },
  {
    id: 'ad-post',
    label: 'Sponsored',
    eyebrow: 'Sell faster',
    title: 'List free. Reach buyers across every district',
    sub: 'Post in minutes. Chat in-app. No commission on SokoMW.',
    cta: 'Sell Now',
    path: '/post',
    accent: '#5b8def',
    glow: 'rgba(26,115,232,0.35)',
    image: 'https://images.unsplash.com/photo-1556742111-a301076d9d18?auto=format&fit=crop&w=1800&q=80',
    imagePos: 'center 45%',
    points: ['Free to list', 'In-app chat', '0% commission'],
  },
  {
    id: 'ad-looking',
    label: 'Ad',
    eyebrow: 'Buyer demand',
    title: 'Respond to Looking For requests near you',
    sub: 'Real buyers with budgets. Be the first seller to reply.',
    cta: 'Browse requests',
    path: '/looking-for',
    accent: '#c9820a',
    glow: 'rgba(201,130,10,0.35)',
    image: lookingForHeroImg,
    imagePos: 'center 50%',
    points: ['Live demand', 'Nearby buyers', 'Fast replies'],
  },
]

function AdHeroBanner({ navigate }) {
  const ads = HOME_ADS
  const n = ads.length
  const [idx, setIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [imgReady, setImgReady] = useState(false)
  const [progressKey, setProgressKey] = useState(0)
  const touchStartX = useRef(null)
  const ROTATE_MS = 6000

  // Auto-rotate; restarts on slide change so swipe + progress stay in sync
  useEffect(() => {
    if (paused || n < 2) return undefined
    const t = setInterval(() => setIdx(i => (i + 1) % n), ROTATE_MS)
    return () => clearInterval(t)
  }, [paused, n, idx])

  // Preload next slide image + restart story progress bar
  useEffect(() => {
    setImgReady(false)
    setProgressKey(k => k + 1)
    const nextAd = ads[(idx + 1) % n]
    if (nextAd?.image) {
      const img = new Image()
      img.src = nextAd.image
    }
  }, [idx, n, ads])

  const ad = ads[idx] || ads[0]

  function goTo(i) {
    setIdx(((i % n) + n) % n)
  }
  function next() { setIdx(i => (i + 1) % n) }
  function prev() { setIdx(i => ((i - 1) + n) % n) }

  function onTouchStart(e) {
    touchStartX.current = e.touches?.[0]?.clientX ?? null
    setPaused(true)
  }
  function onTouchEnd(e) {
    const start = touchStartX.current
    touchStartX.current = null
    const end = e.changedTouches?.[0]?.clientX
    if (start != null && end != null && Math.abs(end - start) > 40) {
      if (end < start) next()
      else prev()
    }
    setTimeout(() => setPaused(false), 3200)
  }

  if (!ad) return null

  const ctaDark = ad.accent === T.amber || ad.accent === '#c9820a'

  return (
    <section
      className="soko-hero-section soko-ad-banner"
      aria-label="Advertisements"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{ position: 'relative', overflow: 'hidden' }}
    >
      <style>{`
        @keyframes adFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes adKenBurns {
          from { transform: scale(1.04); }
          to   { transform: scale(1.1); }
        }
        @keyframes adProgress {
          from { transform: scaleX(0); }
          to   { transform: scaleX(1); }
        }
        .soko-ad-banner {
          margin: 0;
          min-height: clamp(220px, 28vw, 320px);
        }
        .soko-ad-bg-img {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center center;
          display: block;
          z-index: 0;
          animation: adKenBurns ${ROTATE_MS + 1500}ms ease-out both;
          will-change: transform;
        }
        .soko-ad-scrim {
          position: absolute;
          inset: 0;
          z-index: 1;
          pointer-events: none;
        }
        .soko-ad-progress {
          display: none;
        }
        .soko-ad-inner {
          position: relative;
          z-index: 2;
          max-width: 1400px;
          margin: 0 auto;
          padding: clamp(28px, 4vw, 48px) 24px;
          min-height: clamp(220px, 28vw, 320px);
          display: grid;
          grid-template-columns: minmax(0, 1.15fr) minmax(0, 0.85fr);
          align-items: center;
          gap: clamp(20px, 4vw, 48px);
          box-sizing: border-box;
        }
        .soko-ad-copy {
          animation: adFadeIn 0.4s ease both;
          max-width: 560px;
        }
        .soko-ad-visual {
          animation: adFadeIn 0.45s ease 0.06s both;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-width: 0;
        }
        .soko-ad-panel {
          background: rgba(8, 16, 12, 0.52);
          border: 1px solid rgba(255,255,255,0.14);
          border-radius: 18px;
          padding: 18px 18px 16px;
          backdrop-filter: blur(14px) saturate(1.2);
          -webkit-backdrop-filter: blur(14px) saturate(1.2);
          box-shadow: 0 16px 40px rgba(0,0,0,0.28);
        }
        .soko-ad-points {
          display: grid;
          grid-template-columns: 1fr;
          gap: 10px;
        }
        .soko-ad-point {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13.5px;
          font-weight: 600;
          color: rgba(255,255,255,0.92);
        }
        .soko-ad-point-dot {
          width: 28px;
          height: 28px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
          background: rgba(255,255,255,0.12);
          border: 1px solid rgba(255,255,255,0.14);
        }
        .soko-ad-mobile-chips {
          display: none;
        }
        .soko-ad-cta {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          border: none;
          border-radius: 12px;
          padding: 12px 20px;
          font-size: 14px;
          font-weight: 800;
          cursor: pointer;
          font-family: inherit;
          min-height: 44px;
          transition: transform 0.15s, box-shadow 0.15s;
        }
        .soko-ad-cta:hover { transform: translateY(-1px); }
        .soko-ad-cta:active { transform: scale(0.98); }
        .soko-ad-nav {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          z-index: 5;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.22);
          background: rgba(0,0,0,0.4);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          font-size: 20px;
          line-height: 1;
        }
        .soko-ad-nav:hover { background: rgba(15,157,88,0.75); border-color: rgba(255,255,255,0.35); }
        .soko-ad-nav.prev { left: 14px; }
        .soko-ad-nav.next { right: 14px; }
        .soko-ad-dots {
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .soko-ad-meta-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        /* ── Mobile / tablet: compact cinematic ad card ── */
        @media (max-width: 900px) {
          .soko-ad-banner {
            min-height: 0 !important;
            /* Fit phone: fixed app-ad height (not a tall website hero) */
            height: clamp(168px, 46vw, 210px) !important;
            max-height: 210px;
            border-radius: 0;
          }
          .soko-ad-progress {
            display: flex !important;
            position: absolute;
            top: 10px;
            left: 12px;
            right: 12px;
            z-index: 6;
            gap: 4px;
            pointer-events: none;
          }
          .soko-ad-progress-seg {
            flex: 1;
            height: 3px;
            border-radius: 99px;
            background: rgba(255,255,255,0.28);
            overflow: hidden;
          }
          .soko-ad-progress-fill {
            display: block;
            height: 100%;
            width: 100%;
            border-radius: inherit;
            transform-origin: left center;
            transform: scaleX(0);
            background: #fff;
            box-shadow: 0 0 8px rgba(255,255,255,0.45);
          }
          .soko-ad-progress-fill.is-done {
            transform: scaleX(1);
            animation: none;
          }
          .soko-ad-progress-fill.is-active {
            animation: adProgress ${ROTATE_MS}ms linear forwards;
          }
          .soko-ad-progress-fill.is-paused {
            animation-play-state: paused;
          }
          .soko-ad-scrim {
            background:
              linear-gradient(180deg,
                rgba(0,0,0,0.45) 0%,
                rgba(0,0,0,0.08) 32%,
                rgba(0,0,0,0.15) 48%,
                rgba(3,10,7,0.72) 78%,
                rgba(3,10,7,0.92) 100%
              ) !important;
          }
          .soko-ad-inner {
            display: flex !important;
            flex-direction: column !important;
            justify-content: flex-end !important;
            align-items: stretch !important;
            grid-template-columns: 1fr !important;
            height: 100% !important;
            min-height: 0 !important;
            padding: 36px 14px 12px !important;
            gap: 0 !important;
            box-sizing: border-box;
          }
          .soko-ad-visual { display: none !important; }
          .soko-ad-copy {
            max-width: 100% !important;
            animation: adFadeIn 0.32s ease both;
          }
          .soko-ad-meta-row {
            margin-bottom: 6px !important;
            gap: 6px !important;
          }
          .soko-ad-badge {
            font-size: 9px !important;
            padding: 3px 8px !important;
            letter-spacing: 0.6px !important;
          }
          .soko-ad-eyebrow {
            font-size: 10px !important;
            letter-spacing: 0.4px !important;
          }
          .soko-ad-title {
            font-size: clamp(15px, 4.2vw, 18px) !important;
            line-height: 1.2 !important;
            letter-spacing: -0.3px !important;
            margin: 0 0 4px !important;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
          }
          .soko-ad-sub {
            display: none !important;
          }
          .soko-ad-mobile-chips {
            display: flex !important;
            flex-wrap: nowrap;
            gap: 6px;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            scrollbar-width: none;
            margin: 0 0 10px;
            padding-bottom: 1px;
          }
          .soko-ad-mobile-chips::-webkit-scrollbar { display: none; }
          .soko-ad-chip {
            flex: 0 0 auto;
            display: inline-flex;
            align-items: center;
            gap: 4px;
            font-size: 10.5px;
            font-weight: 700;
            color: rgba(255,255,255,0.95);
            background: rgba(255,255,255,0.12);
            border: 1px solid rgba(255,255,255,0.16);
            backdrop-filter: blur(10px);
            -webkit-backdrop-filter: blur(10px);
            border-radius: 999px;
            padding: 4px 9px 4px 6px;
            white-space: nowrap;
          }
          .soko-ad-chip-dot {
            width: 16px;
            height: 16px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(255,255,255,0.14);
            flex-shrink: 0;
          }
          .soko-ad-footer-row {
            display: flex !important;
            flex-direction: row !important;
            align-items: center !important;
            justify-content: space-between !important;
            gap: 10px !important;
            flex-wrap: nowrap !important;
          }
          .soko-ad-cta {
            width: auto !important;
            flex: 1 1 auto;
            max-width: 220px;
            justify-content: center;
            min-height: 36px !important;
            height: 36px;
            padding: 0 14px !important;
            font-size: 12.5px !important;
            border-radius: 10px !important;
            box-shadow: 0 6px 18px rgba(0,0,0,0.28) !important;
          }
          .soko-ad-dots {
            display: none !important;
          }
          .soko-ad-slide-count {
            display: inline-flex !important;
            align-items: center;
            justify-content: center;
            min-width: 42px;
            height: 28px;
            padding: 0 10px;
            border-radius: 999px;
            font-size: 11px;
            font-weight: 800;
            color: #fff;
            background: rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.18);
            backdrop-filter: blur(8px);
            -webkit-backdrop-filter: blur(8px);
            letter-spacing: 0.2px;
            flex-shrink: 0;
          }
          .soko-ad-nav { display: none !important; }
          .soko-ad-bg-img {
            animation: adKenBurns ${ROTATE_MS + 800}ms ease-out both;
          }
        }
        @media (max-width: 380px) {
          .soko-ad-banner {
            height: 158px !important;
            max-height: 158px;
          }
          .soko-ad-inner {
            padding: 30px 12px 10px !important;
          }
          .soko-ad-title {
            font-size: 14.5px !important;
          }
          .soko-ad-mobile-chips { display: none !important; }
          .soko-ad-cta {
            min-height: 34px !important;
            height: 34px;
            font-size: 12px !important;
          }
        }
      `}</style>

      {/* Fallback tint under photo */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, zIndex: 0,
          background: 'linear-gradient(135deg, #061510 0%, #0a2a1c 50%, #0c1a12 100%)',
        }}
      />
      {/* Full-bleed photo — fills entire banner */}
      <img
        key={ad.id + '-img'}
        className="soko-ad-bg-img"
        src={ad.image}
        alt=""
        aria-hidden="true"
        loading={idx === 0 ? 'eager' : 'lazy'}
        decoding="async"
        onLoad={() => setImgReady(true)}
        style={{
          zIndex: 0,
          objectPosition: ad.imagePos || 'center center',
          opacity: imgReady || idx > 0 ? 1 : 0.9,
        }}
      />
      {/* Scrim: desktop left-readability; mobile uses bottom gradient via CSS */}
      <div
        className="soko-ad-scrim"
        aria-hidden="true"
        style={{
          background: `
            linear-gradient(100deg,
              rgba(3,10,7,0.90) 0%,
              rgba(3,10,7,0.78) 32%,
              rgba(3,10,7,0.38) 58%,
              rgba(3,10,7,0.12) 82%,
              rgba(3,10,7,0.22) 100%
            ),
            linear-gradient(180deg,
              rgba(0,0,0,0.12) 0%,
              transparent 40%,
              rgba(0,0,0,0.32) 100%
            ),
            radial-gradient(ellipse 48% 65% at 88% 42%, ${ad.glow} 0%, transparent 62%)
          `,
        }}
      />

      {/* Story-style progress segments (mobile) */}
      {n > 1 && (
        <div className="soko-ad-progress" aria-hidden="true">
          {ads.map((a, i) => (
            <div key={a.id} className="soko-ad-progress-seg">
              <span
                key={i === idx ? `fill-${idx}-${progressKey}` : `fill-${i}`}
                className={
                  'soko-ad-progress-fill'
                  + (i < idx ? ' is-done' : '')
                  + (i === idx ? ' is-active' : '')
                  + (i === idx && paused ? ' is-paused' : '')
                }
                style={{ background: i <= idx ? (i === idx ? '#fff' : ad.accent) : undefined }}
              />
            </div>
          ))}
        </div>
      )}

      {n > 1 && (
        <>
          <button type="button" className="soko-ad-nav prev soko-nav-desktop" onClick={prev} aria-label="Previous ad">‹</button>
          <button type="button" className="soko-ad-nav next soko-nav-desktop" onClick={next} aria-label="Next ad">›</button>
        </>
      )}

      <div className="soko-ad-inner">
        {/* Left: ad copy */}
        <div key={ad.id + '-copy'} className="soko-ad-copy">
          <div className="soko-ad-meta-row">
            <span
              className="soko-ad-badge"
              style={{
                fontSize: 10, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.7)',
                background: 'rgba(0,0,0,0.35)',
                border: '1px solid rgba(255,255,255,0.16)',
                borderRadius: 999, padding: '4px 10px',
                backdropFilter: 'blur(6px)',
              }}
            >
              {ad.label}
            </span>
            <span
              className="soko-ad-eyebrow"
              style={{
                fontSize: 11.5, fontWeight: 800, color: ad.accent,
                letterSpacing: 0.5, textTransform: 'uppercase',
                textShadow: '0 1px 8px rgba(0,0,0,0.45)',
              }}
            >
              {ad.eyebrow}
            </span>
          </div>

          <h1
            className="soko-ad-title"
            style={{
              fontFamily: T.fontDisplay,
              fontSize: 'clamp(24px, 3.2vw, 38px)',
              fontWeight: 800,
              color: '#fff',
              lineHeight: 1.15,
              letterSpacing: '-0.7px',
              margin: '0 0 10px',
              textShadow: '0 2px 18px rgba(0,0,0,0.45)',
            }}
          >
            {ad.title}
          </h1>

          <p
            className="soko-ad-sub"
            style={{
              fontSize: 15,
              color: 'rgba(255,255,255,0.78)',
              lineHeight: 1.5,
              margin: '0 0 18px',
              maxWidth: 480,
              fontWeight: 500,
              textShadow: '0 1px 10px rgba(0,0,0,0.4)',
            }}
          >
            {ad.sub}
          </p>

          {/* Mobile: compact benefit chips */}
          {(ad.points || []).length > 0 && (
            <div className="soko-ad-mobile-chips" aria-hidden="true">
              {(ad.points || []).slice(0, 3).map((p, i) => (
                <span key={p} className="soko-ad-chip">
                  <span className="soko-ad-chip-dot" style={{ color: ad.accent }}>
                    {i === 0 ? Icon.check(10) : i === 1 ? Icon.star(9, ad.accent) : Icon.lightning(10)}
                  </span>
                  {p}
                </span>
              ))}
            </div>
          )}

          <div className="soko-ad-footer-row" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="soko-ad-cta"
              onClick={() => navigate(ad.path)}
              style={{
                background: ad.accent,
                color: ctaDark ? '#1a0a00' : '#fff',
                boxShadow: `0 8px 28px ${ad.glow}`,
              }}
            >
              {ad.cta} {Icon.chevR(15)}
            </button>

            {n > 1 && (
              <div
                className="soko-ad-dots"
                role="tablist"
                aria-label="Advertisement slides"
              >
                {ads.map((a, i) => (
                  <button
                    key={a.id}
                    type="button"
                    role="tab"
                    aria-selected={i === idx}
                    aria-label={`Ad ${i + 1} of ${n}`}
                    onClick={() => { goTo(i); setPaused(true); setTimeout(() => setPaused(false), 3200) }}
                    style={{
                      width: i === idx ? 20 : 7,
                      height: 7,
                      borderRadius: 50,
                      border: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      background: i === idx ? ad.accent : 'rgba(255,255,255,0.4)',
                      boxShadow: i === idx ? `0 0 0 3px ${ad.glow}` : 'none',
                      transition: 'all 0.25s ease',
                    }}
                  />
                ))}
              </div>
            )}

            {n > 1 && (
              <span className="soko-ad-slide-count" style={{ display: 'none' }}>
                {idx + 1}/{n}
              </span>
            )}
          </div>
        </div>

        {/* Right: glass panel — desktop only */}
        <div key={ad.id + '-vis'} className="soko-ad-visual soko-nav-desktop">
          <div className="soko-ad-panel">
            <div style={{
              fontSize: 11, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase',
              color: 'rgba(255,255,255,0.55)', marginBottom: 12,
            }}>
              Why this matters
            </div>
            <div className="soko-ad-points">
              {(ad.points || []).map((p, i) => (
                <div key={p} className="soko-ad-point">
                  <span className="soko-ad-point-dot" style={{ color: ad.accent }}>
                    {i === 0 ? Icon.check(13) : i === 1 ? Icon.star(12, ad.accent) : Icon.lightning(13)}
                  </span>
                  {p}
                </div>
              ))}
            </div>
            <div style={{
              marginTop: 14, paddingTop: 12,
              borderTop: '1px solid rgba(255,255,255,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
            }}>
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: 500 }}>
                SokoMW marketplace
              </span>
              <span style={{
                fontSize: 11, fontWeight: 800, color: ad.accent,
                background: 'rgba(255,255,255,0.08)',
                borderRadius: 999, padding: '4px 10px',
              }}>
                {idx + 1} / {n}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   CATEGORY QUICK ACCESS — one-click entry to every category. Matches the
   reference's fixed 8-tile layout (All Categories, Vehicles, Electronics,
   Fashion, Property, Agriculture, Jobs, Services) plus a 9th "More" tile
   that opens the full category list — rather than dumping every category
   from ALL_CATEGORIES into the grid (which duplicated "Services" and had
   no overflow tile).
───────────────────────────────────────────────────────────────────────────── */
const QUICK_CATEGORIES = [
  { key: 'all',         label: 'All Categories', sub: 'Browse all',        icon: Icon.grid,        fg: '#3c4043', bg: '#f1f3f4', isAll: true },
  { key: 'Vehicles',    label: 'Vehicles',       sub: 'Cars, bikes, more', icon: Icon.car,         fg: '#0284c7', bg: '#e0f2fe' },
  { key: 'Electronics', label: 'Electronics',    sub: 'Phones, laptops',   icon: Icon.phone,       fg: '#7c3aed', bg: '#f1ebfd' },
  { key: 'Clothing',    label: 'Fashion',        sub: 'Clothing, shoes',   icon: Icon.shirt,       fg: '#e0245e', bg: '#fdeaf0' },
  { key: 'Property',    label: 'Property',       sub: 'Houses, land',      icon: Icon.houseFilled, fg: '#ea580c', bg: '#fef0e6' },
  { key: 'Agriculture', label: 'Agriculture',    sub: 'Machinery, crops',  icon: Icon.leaf,        fg: '#0f766e', bg: '#ecfdf5' },
  { key: 'Jobs',        label: 'Jobs',           sub: 'Find a job',        icon: Icon.briefcase,   fg: '#2563eb', bg: '#e9f1fd', isJobs: true },
  { key: 'Services',    label: 'Services',       sub: 'Hire experts',      icon: Icon.tools,       fg: '#5f6368', bg: '#eef0f1', isServices: true },
]

function CategoryGrid({ navigate, onCategoryChange }) {
  function handleClick(item) {
    if (item.isJobs)      return navigate('/jobs')
    if (item.isServices)  return navigate('/services')
    if (item.isAll) return navigate('/listings')
    navigate(`/listings?cat=${encodeURIComponent(item.key)}`)
  }

  return (
    <section className="soko-cat-section" style={{ padding: '28px 20px 8px', background: '#fff' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        {/* Desktop: 9-col grid. Mobile/tablet (≤980): forced single-line horizontal scroll via CSS. */}
        <div
          className="soko-cat-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(9, 1fr)',
            gap: 12,
          }}
        >
          {QUICK_CATEGORIES.map(item => (
            <button key={item.key} onClick={() => handleClick(item)} className="soko-cat-tile" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              background: '#fff', border: `1px solid ${T.gray100}`, cursor: 'pointer', padding: '18px 8px 16px',
              borderRadius: 16, transition: 'border-color .15s, box-shadow .15s, transform .15s',
              boxSizing: 'border-box',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: item.bg, color: item.fg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                {item.icon(19)}
              </div>
              <div style={{ textAlign: 'center', minWidth: 0, width: '100%' }}>
                <div className="soko-cat-label" style={{ fontSize: 13, fontWeight: 700, color: T.gray900 }}>{item.label}</div>
                <div className="soko-cat-sub" style={{ fontSize: 10.5, color: T.gray600, marginTop: 1 }}>{item.sub}</div>
              </div>
            </button>
          ))}
          <button onClick={() => navigate('/categories')} className="soko-cat-tile" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            background: '#fdf6e8', border: `1.5px dashed ${T.amber}66`, cursor: 'pointer', padding: '18px 8px 16px',
            borderRadius: 16, transition: 'border-color .15s, box-shadow .15s, transform .15s',
            boxSizing: 'border-box',
          }}>
            <div className="soko-cat-label" style={{ fontSize: 13.5, fontWeight: 700, color: T.amberD }}>More</div>
            <div className="soko-cat-sub" style={{ fontSize: 10.5, color: T.gray600 }}>View all</div>
          </button>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   FEATURED REVENUE BANNER — short cream strip (compact marketing bar)
   Listings only live; shops / requests / stories = soon; free slots if any.
   No active listings → prompt to post & get featured.
───────────────────────────────────────────────────────────────────────────── */
function FeaturedRevenueBanner({ navigate, user }) {
  const [freeInfo, setFreeInfo] = useState({ loading: !!user?.id, hasFree: false, remaining: 0 })
  const [activeCount, setActiveCount] = useState(null) // null = loading / guest

  useEffect(() => {
    let cancelled = false
    if (!user?.id) {
      setFreeInfo({ loading: false, hasFree: false, remaining: 0 })
      setActiveCount(null)
      return undefined
    }
    setFreeInfo(f => ({ ...f, loading: true }))
    setActiveCount(null)
    ;(async () => {
      try {
        // Active listings count (published or active)
        const { count: liveCount } = await supabase
          .from('listings')
          .select('id', { count: 'exact', head: true })
          .eq('seller_id', user.id)
          .in('status', ['published', 'active'])
        if (!cancelled) setActiveCount(liveCount ?? 0)

        const { data: elig } = await supabase.rpc('get_feature_eligibility', {})
        if (cancelled) return
        if (elig && typeof elig === 'object') {
          setFreeInfo({
            loading: false,
            hasFree: elig.has_free_left === true,
            remaining: Number(elig.free_remaining ?? 0),
          })
          return
        }
        const { data: setting } = await supabase
          .from('app_settings').select('value').eq('key', 'free_featured_enabled').maybeSingle()
        const freeOn = setting ? (setting.value === true || setting.value === 'true') : true
        if (!freeOn) {
          if (!cancelled) setFreeInfo({ loading: false, hasFree: false, remaining: 0 })
          return
        }
        const { count } = await supabase
          .from('listing_promotions')
          .select('id', { count: 'exact', head: true })
          .eq('seller_id', user.id)
          .eq('promotion_type', 'featured')
          .eq('price_mwk', 0)
        const remaining = Math.max(0, 5 - (count || 0))
        if (!cancelled) setFreeInfo({ loading: false, hasFree: remaining > 0, remaining })
      } catch {
        if (!cancelled) {
          setFreeInfo({ loading: false, hasFree: false, remaining: 0 })
          setActiveCount(0)
        }
      }
    })()
    return () => { cancelled = true }
  }, [user?.id])

  const hasListings = (activeCount ?? 0) > 0
  const needsPost = !!user?.id && activeCount !== null && !hasListings

  const goFeature = () => {
    if (!user) {
      navigate('/login')
      return
    }
    if (needsPost) {
      navigate('/post')
      return
    }
    navigate('/profile?tab=selling')
  }

  const priceMk = `MK ${Number(FEATURED_PRICE_MWK).toLocaleString()}`

  // Premium modern icons (stroke, refined)
  const Ico = {
    sparkle: (s = 18) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 2.5l1.2 5.1c.2.9.9 1.6 1.8 1.8L20.5 11l-5.5 1.6c-.9.2-1.6.9-1.8 1.8L12 20.5l-1.2-5.1c-.2-.9-.9-1.6-1.8-1.8L3.5 11l5.5-1.6c.9-.2 1.6-.9 1.8-1.8L12 2.5z" fill="currentColor" opacity="0.95"/>
        <path d="M19 3.5l.45 1.85c.08.35.35.62.7.7L22 6.5l-1.85.45c-.35.08-.62.35-.7.7L19 9.5l-.45-1.85a.9.9 0 0 0-.7-.7L16 6.5l1.85-.45c.35-.08.62-.35.7-.7L19 3.5z" fill="currentColor" opacity="0.75"/>
      </svg>
    ),
    packagePlus: (s = 16) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M16.5 9.4 7.55 4.24"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
        <path d="M3.29 7 12 12l8.71-5"/><path d="M12 22V12"/><path d="M12 8v4"/><path d="M10 10h4"/>
      </svg>
    ),
    listing: (s = 15) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
        <rect x="3" y="14" width="7" height="7" rx="1.5"/><path d="M17.5 14v7"/><path d="M14 17.5h7"/>
      </svg>
    ),
    shop: (s = 13) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
        <path d="M10 22V12h4v10"/><path d="M2 7h20"/><path d="M12 7v5"/>
      </svg>
    ),
    requests: (s = 13) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
        <path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
      </svg>
    ),
    stories: (s = 13) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>
      </svg>
    ),
    bolt: (s = 14) => (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M13 2 4.5 13.5h6L10 22l9.5-12h-6L13 2z"/>
      </svg>
    ),
  }

  const soon = [
    { icon: Ico.shop, label: 'Shops' },
    { icon: Ico.requests, label: 'Requests' },
    { icon: Ico.stories, label: 'Stories' },
  ]

  const title = needsPost
    ? 'Post a listing. Get Featured.'
    : 'Get Featured. Get Results.'

  const subtitle = needsPost
    ? 'You have no active listings yet — post one, then feature it on the homepage'
    : (
      <>
        Listings only for now · shops, requests & stories later
        {user && freeInfo.hasFree && !freeInfo.loading && (
          <span style={{ color: T.amberD, fontWeight: 700 }}>
            {' · '}{freeInfo.remaining} free left
          </span>
        )}
      </>
    )

  const priceLine = needsPost
    ? `Then feature · ${priceMk} · ${FEATURED_DURATION_DAYS} days`
    : freeInfo.hasFree
      ? `FREE · ${freeInfo.remaining} left · ${FEATURED_DURATION_DAYS} days`
      : `${priceMk} · ${FEATURED_DURATION_DAYS} days`

  const ctaLabel = !user
    ? 'Get started'
    : needsPost
      ? 'Post & get featured'
      : freeInfo.hasFree
        ? 'Claim free feature'
        : 'Feature a listing'

  // Featured CTA stays amber/gold (premium), not green — green reserved for brand/sell
  const ctaGold = true

  return (
    <section style={{ padding: '16px 20px 0' }} aria-label="Get featured pricing">
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div className="soko-featured-banner" style={{
          background: 'linear-gradient(90deg, #fdf6e3, #fdf1d6, #fdf6e3)',
          border: `1px solid ${T.amber}33`,
          borderRadius: 16,
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          flexWrap: 'wrap',
        }}>
          {/* Left: title */}
          <div
            className="soko-feat-banner-title"
            style={{ display: 'flex', alignItems: 'center', gap: 10, flex: '1 1 200px', minWidth: 0, cursor: 'pointer' }}
            onClick={goFeature}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goFeature() } }}
          >
            <div style={{
              width: 36, height: 36, borderRadius: 11, flexShrink: 0,
              background: 'linear-gradient(145deg, #F9AB00 0%, #e09800 55%, #c98500 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#1a0a00',
              boxShadow: '0 2px 10px rgba(249,171,0,0.4), inset 0 1px 0 rgba(255,255,255,0.35)',
            }}>
              {needsPost ? Ico.packagePlus(17) : Ico.sparkle(17)}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.gray900, lineHeight: 1.2 }}>
                {title}
              </div>
              <div style={{ fontSize: 11.5, color: T.gray600, marginTop: 2, lineHeight: 1.35 }}>
                {subtitle}
              </div>
            </div>
          </div>

          {/* Middle: live product pricing (all breakpoints) + soon (desktop) */}
          <div className="soko-feat-banner-pricing" style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="soko-feat-price-chip"
              onClick={goFeature}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                background: '#fff', border: `1.5px solid ${T.amber}55`,
                borderRadius: 12, padding: '7px 12px', cursor: 'pointer',
                fontFamily: 'inherit', boxShadow: '0 1px 6px rgba(249,171,0,0.12)',
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: 'linear-gradient(135deg, #fff8e6, #fde9b0)',
                color: T.amberD, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {needsPost ? Ico.packagePlus(14) : Ico.listing(14)}
              </span>
              <div style={{ textAlign: 'left', minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 800, color: T.gray900, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                  {needsPost ? 'Post a listing' : 'Featured Listings'}
                  <span style={{
                    fontSize: 9, fontWeight: 900, textTransform: 'uppercase', letterSpacing: 0.4,
                    background: needsPost ? '#fff7ed' : T.amberL,
                    color: needsPost ? '#c2410c' : T.amberD,
                    borderRadius: 999, padding: '2px 6px',
                  }}>
                    {needsPost ? 'Start here' : 'Live'}
                  </span>
                </div>
                <div
                  className="soko-feat-price-amount"
                  style={{
                    fontSize: 12, fontWeight: 800, marginTop: 2,
                    color: freeInfo.hasFree && !needsPost ? T.amberD : T.gray800,
                    letterSpacing: '-0.2px',
                  }}
                >
                  {freeInfo.loading && !needsPost ? '…' : priceLine}
                </div>
              </div>
            </button>

            {soon.map(s => (
              <div
                key={s.label}
                className="soko-nav-desktop"
                style={{ display: 'flex', alignItems: 'center', gap: 6, opacity: 0.5, whiteSpace: 'nowrap' }}
                title="Coming in the long run"
              >
                <span style={{ color: T.gray500, display: 'flex' }}>{s.icon(13)}</span>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: T.gray600 }}>{s.label}</div>
                  <div style={{ fontSize: 9.5, fontWeight: 800, color: T.gray400, textTransform: 'uppercase', letterSpacing: 0.3 }}>Soon</div>
                </div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <button
            type="button"
            className="soko-feat-banner-cta"
            onClick={goFeature}
            style={{
              flexShrink: 0, marginLeft: 'auto',
              background: ctaGold
                ? `linear-gradient(135deg, ${T.amber}, #e09800)`
                : `linear-gradient(135deg, ${T.gray900}, #000)`,
              color: ctaGold ? '#1a0a00' : '#fff',
              border: 'none', borderRadius: 12, padding: '10px 16px',
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
              boxShadow: ctaGold
                ? '0 2px 12px rgba(249,171,0,0.35)'
                : '0 2px 12px rgba(0,0,0,0.2)',
              fontFamily: 'inherit',
            }}
          >
            <span style={{ display: 'flex', opacity: 0.95 }}>
              {needsPost ? Ico.packagePlus(15) : Ico.bolt(14)}
            </span>
            {ctaLabel}
          </button>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   SECTION HEADER
───────────────────────────────────────────────────────────────────────────── */
function SectionHeader({ title, subtitle, action }) {
  return (
    <div className="soko-section-header" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
      <div>
        <h2 className="soko-section-title" style={{ fontFamily: T.fontDisplay, fontSize: 'clamp(19px, 2.4vw, 25px)', fontWeight: 800, color: T.gray900, letterSpacing: '-0.6px', marginBottom: 4 }}>{title}</h2>
        {subtitle && <p className="soko-web-only" style={{ fontSize: 13.5, color: T.gray600 }}>{subtitle}</p>}
      </div>
      {action && (
        <button onClick={action.onClick} className="soko-section-action" style={{ background: 'none', border: `1.5px solid ${T.gray200}`, borderRadius: 50, padding: '7px 16px', fontSize: 13, fontWeight: 600, color: T.gray800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.gray800; e.currentTarget.style.color = T.gray900 }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.gray200; e.currentTarget.style.color = T.gray800 }}
        >{action.label} {Icon.chevR(14)}</button>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   PRODUCT CARD QUICK ACTIONS — Save (heart) + Chat + optional Call
   Fixed action-row height keeps Featured / Latest cards equal-sized.
───────────────────────────────────────────────────────────────────────────── */
function listingAllowsCall(listing) {
  if (!listing?.call_number) return false
  const methods = listing.contact_methods
  if (Array.isArray(methods)) {
    if (methods.length === 0) return false
    return methods.map(String).map(m => m.toLowerCase()).includes('call')
  }
  if (typeof methods === 'string') return methods.toLowerCase().includes('call')
  // Legacy rows with a number but no methods array — treat as call-enabled
  return true
}

function ProductCardSaveBtn({ saved, busy, onToggle }) {
  return (
    <button
      type="button"
      className={`soko-product-card-save${saved ? ' is-saved' : ''}`}
      onClick={e => { e.stopPropagation(); onToggle?.(e) }}
      disabled={busy}
      aria-label={saved ? 'Remove from saved' : 'Save listing'}
      aria-pressed={!!saved}
    >
      {Icon.heart(14, saved ? 'currentColor' : 'none')}
    </button>
  )
}

function ProductCardActions({ listing, user, navigate }) {
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
    <div className="soko-product-card-actions" onClick={e => e.stopPropagation()}>
      <button type="button" className="soko-pca-chat" onClick={handleChat}>
        {Icon.chat(13)}
        <span>{isOwner ? 'View' : 'Chat'}</span>
      </button>
      {canCall && !isOwner && (
        <button type="button" className="soko-pca-call" onClick={handleCall} aria-label="Call seller">
          {Icon.phoneCall(14)}
        </button>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   LISTING CARD — "featured" gets a visibly larger gold-bordered treatment
   per the brief ("Featured Listings: Large premium cards. Bigger than
   normal listings. Gold featured badge.")
───────────────────────────────────────────────────────────────────────────── */
function PremiumListingCard({ listing, onClick, delay = 0, user, navigate, saved, onToggleSave }) {
  const [hov, setHov] = useState(false)
  const [imgErr, setImgErr] = useState(false)
  const [imgReady, setImgReady] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)

  const price   = isFlashActive(listing) ? listing.flash_sale_price : listing.price
  const isFlash = isFlashActive(listing)
  const isVerif = listing.seller_verified || listing.shop_is_verified
  const isFeat  = isListingFeatured(listing)

  async function handleSave(e) {
    e.stopPropagation()
    if (saveBusy) return
    setSaveBusy(true)
    try { await onToggleSave?.(listing.id) } finally { setSaveBusy(false) }
  }

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      className={`soko-product-card soko-card-bg${isFeat && isFlash ? ' soko-dual-badge-card' : ''}`}
      style={{
        border: isFeat && isFlash
          ? `1.5px solid ${hov ? T.red : '#f0a8a0'}`
          : isFeat
            ? `1.5px solid ${hov ? T.amber : '#e8d9a8'}`
            : isFlash
              ? `1.5px solid ${T.red}55`
              : `1px solid ${hov ? T.gray200 : T.gray100}`,
        boxShadow: hov ? T.shadowMd : T.shadow,
        transform: hov ? 'translateY(-3px)' : 'none',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        animation: `fadeUp 0.4s ease ${delay}s both`,
      }}
    >
      <div className="soko-product-card-media" style={{ background: '#eef1f3' }}>
        {listing.images?.[0] && !imgErr
          ? <img
              src={listing.images[0]}
              alt={listing.title}
              loading="lazy"
              decoding="async"
              onLoad={() => setImgReady(true)}
              onError={() => setImgErr(true)}
              style={{
                opacity: imgReady ? 1 : 0,
                transform: hov ? 'scale(1.05)' : 'scale(1)',
                transition: 'opacity 0.35s ease, transform 0.45s cubic-bezier(0.34,1.2,0.64,1)',
              }}
            />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, color: T.gray400 }}>{catIcon(listing.category).emoji}</div>
        }
        <div style={{ position: 'absolute', top: 8, left: 8, display: 'flex', flexDirection: 'column', gap: 4, zIndex: 2 }}>
          {isFeat && isFlash ? (
            <div className="soko-hotdeal-pulse" style={{ background: `linear-gradient(135deg,${T.red},#c62828)`, color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(234,67,53,0.5)' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
                <path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z"/>
              </svg>
            </div>
          ) : (
            <>
              {isFlash && (
                <div className="soko-hotdeal-pulse" style={{ background: `linear-gradient(135deg,${T.red},#c62828)`, color: '#fff', borderRadius: '50%', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(234,67,53,0.5)' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
                    <path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z"/>
                  </svg>
                </div>
              )}
            </>
          )}
        </div>
        <ProductCardSaveBtn saved={saved} busy={saveBusy} onToggle={handleSave} />
      </div>

      <div className="soko-product-card-body">
        <div className="soko-product-card-title">{listing.title}</div>
        <div className="soko-product-card-price" style={{ color: isFlash ? T.red : T.greenD }}>
          {formatPrice(price)}
          {isFlash && listing.price > price && (
            <span style={{ marginLeft: 5, fontSize: 11, fontWeight: 600, color: T.gray500, textDecoration: 'line-through' }}>{formatPrice(listing.price)}</span>
          )}
        </div>
        <div className="soko-product-card-meta">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ color: T.gray500, flexShrink: 0, display: 'flex' }}>{Icon.pin(11)}</span>
            {listing.city || 'Malawi'}
          </span>
          {isVerif && <span style={{ flexShrink: 0, display: 'flex' }} title="Verified seller">{Icon.verify(12)}</span>}
        </div>
      </div>
      <ProductCardActions listing={listing} user={user} navigate={navigate} />
    </div>
  )
}

function SkeletonListingCard() {
  return (
    <div
      className="soko-product-card soko-card-bg"
      style={{ border: `1px solid ${T.gray100}`, boxShadow: T.shadow }}
      aria-hidden="true"
    >
      <div className="soko-product-card-media skeleton-soft" />
      <div className="soko-product-card-body">
        <div className="skeleton" style={{ height: 12, width: '90%', borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 12, width: '58%', borderRadius: 6, marginTop: 6 }} />
        <div className="skeleton" style={{ height: 15, width: '42%', borderRadius: 6, marginTop: 8 }} />
        <div className="skeleton" style={{ height: 10, width: '36%', borderRadius: 6, marginTop: 'auto' }} />
      </div>
      <div className="soko-product-card-actions">
        <div className="skeleton" style={{ flex: 1, height: 32, borderRadius: 10 }} />
        <div className="skeleton" style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0 }} />
      </div>
    </div>
  )
}

/** Full home rail placeholder while listings boot */
function HomeSectionSkeleton({ titleW = '38%', cards = 5, cardW = 160 }) {
  return (
    <section style={{ padding: '20px 0 8px', background: '#fff' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <div className="skeleton" style={{ height: 20, width: titleW, borderRadius: 8 }} />
          <div className="skeleton" style={{ height: 14, width: 72, borderRadius: 8 }} />
        </div>
        <div className="soko-scroll" style={{ display: 'flex', gap: 12, overflow: 'hidden' }}>
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} style={{ flex: `0 0 ${cardW}px`, width: cardW }}>
              <SkeletonListingCard />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   LIVE STORIES CARD — compact boxed card matching the reference exactly:
   circular avatars in a row, "View all" link, "Create Story" CTA. This is
   a thin presentational wrapper around the same fetchAllActiveStories data
   HomeStatusRow uses, but sized for the side-column slot next to Featured
   Listings rather than HomeStatusRow's full-width dark bar (which has
   200×340px cards and wouldn't fit this slot).
   Status section now uses HomeStatusSection (StatusPage-style with rings + tiles).
───────────────────────────────────────────────────────────────────────────── */
/* ─────────────────────────────────────────────────────────────────────────────
   FEATURED LISTINGS — full-width rail (stories section lives below)
───────────────────────────────────────────────────────────────────────────── */
/** Max cards on the featured rail — enough for a full horizontal scroll, not a dump */
const FEATURED_HOME_CAP = 12

function FeaturedListingsRow({ listings, navigate, loading, user, savedIds, onToggleSave }) {
  // Phase 3.1: dedicated featured rows only — never derived from latest posts
  const featured = useMemo(
    () => (listings || []).filter(l => isListingFeatured(l)).slice(0, FEATURED_HOME_CAP),
    [listings],
  )
  if (!loading && featured.length === 0) return null
  return (
    <section className="soko-section-pad soko-featured-section" style={{ padding: '24px 20px 4px', background: '#fff' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', minWidth: 0 }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 14, gap: 12,
        }}>
          <span className="soko-section-title" style={{ fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 800, color: T.gray900 }}>
            Featured Listings 🔥
          </span>
          <button
            type="button"
            onClick={() => navigate('/listings')}
            className="soko-link-quiet"
            style={{ flexShrink: 0 }}
          >
            View all
          </button>
        </div>

        <div style={{ minWidth: 0, maxWidth: '100%', overflow: 'hidden' }}>
          <div
            className="soko-scroll soko-featured-rail"
            style={{
              gap: 12,
              paddingTop: 4,
              paddingBottom: 8,
            }}
          >
            {loading
              ? [1, 2, 3, 4, 5, 6].map(i => (
                <div key={i} className="soko-featured-card-wrap">
                  <SkeletonListingCard />
                </div>
              ))
              : featured.map((l, i) => (
                <div key={l.id} className="soko-featured-card-wrap">
                  <PremiumListingCard
                    listing={l}
                    delay={Math.min(i, 6) * 0.02}
                    onClick={() => navigate('/listing/' + l.id)}
                    user={user}
                    navigate={navigate}
                    saved={savedIds?.has?.(l.id)}
                    onToggleSave={onToggleSave}
                  />
                </div>
              ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   LATEST LISTINGS — premium discovery grid. Distinct card language from
   PremiumListingCard's dense scroll-rail style: bigger photo stage (1:1),
   floating circular wishlist control, soft-glass meta row instead of a
   gradient-on-image footer, and a "Posted Xh ago" line for freshness scent.
   "New" (<24h) and "Verified" are separate badge slots so they can co-occur
   without colliding. 4 / 2 / 1 responsive grid via .soko-latest-grid.
───────────────────────────────────────────────────────────────────────────── */
function timeSincePosted(ts) {
  if (!ts) return ''
  const diffMs = Date.now() - new Date(ts).getTime()
  const mins = Math.floor(diffMs / 60000)
  const hrs  = Math.floor(diffMs / 3600000)
  const days = Math.floor(diffMs / 86400000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  if (hrs < 24)   return `${hrs}h ago`
  if (days < 7)   return `${days}d ago`
  return `${Math.floor(days / 7)}w ago`
}

/* Category label shown as a chip on the card — reuses catIcon() emoji/colors
   already defined for CAT_ICON, mapped to the short display label requested
   (Vehicle, Electronics, Property, Fashion, etc.) */
function categoryChipLabel(cat) {
  const map = {
    Vehicles: 'Vehicle', Electronics: 'Electronics', Property: 'Property',
    Clothing: 'Fashion', Agriculture: 'Agriculture', Furniture: 'Furniture',
    Food: 'Food', Services: 'Services', Jobs: 'Jobs',
  }
  return map[cat] || cat || 'Other'
}

function LatestListingCard({ listing, delay = 0, onClick, user, navigate, saved, onToggleSave }) {
  const [hov, setHov]       = useState(false)
  const [imgErr, setImgErr] = useState(false)
  const [saveBusy, setSaveBusy] = useState(false)

  const isVerif = listing.seller_verified || listing.shop_is_verified
  const isNew   = listing.created_at && (Date.now() - new Date(listing.created_at).getTime()) < 86400000
  const isFeat  = isListingFeatured(listing)
  const isFlash = isFlashActive(listing)
  const meta    = catIcon(listing.category)
  const price   = isFlash ? (listing.flash_sale_price ?? listing.price) : listing.price
  const trustCount = listing.view_count ?? listing.inquiry_count ?? null

  async function handleSave(e) {
    e.stopPropagation()
    if (saveBusy) return
    setSaveBusy(true)
    try { await onToggleSave?.(listing.id) } finally { setSaveBusy(false) }
  }

  return (
    <div
      className={`soko-product-card soko-latest-card soko-card-bg${isFeat && isFlash ? ' soko-dual-badge-card' : ''}`}
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        border: isFeat && isFlash
          ? `1.5px solid ${hov ? T.red : T.amber}`
          : isFeat ? `1.5px solid ${hov ? T.amber : '#f5dfa3'}`
          : isFlash ? `1.5px solid ${T.red}44`
          : `1px solid ${hov ? '#cdeedc' : T.gray100}`,
        boxShadow: hov ? T.shadowMd : T.shadow,
        transform: hov ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'transform 0.28s cubic-bezier(0.22,1,0.36,1), box-shadow 0.28s ease, border-color 0.28s ease',
        animation: `fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}s both`,
      }}
    >
      {/* Square media — aspect-ratio keeps every card equal regardless of image shape */}
      <div className="soko-product-card-media soko-latest-photo">
        {listing.images?.[0] && !imgErr ? (
          <img
            src={listing.images[0]}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            onError={() => setImgErr(true)}
            style={{
              transform: hov ? 'scale(1.05)' : 'scale(1)',
              transition: 'transform 0.45s cubic-bezier(0.22,1,0.36,1)',
            }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36, color: T.gray400 }}>
            {meta.emoji}
          </div>
        )}

        <div className="soko-latest-badge-stack" style={{ position: 'absolute', top: 8, left: 8, zIndex: 3, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {isFeat && isFlash ? (
            <span className="soko-hotdeal-pulse" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(135deg,${T.red},#c62828)`, color: '#fff', borderRadius: '50%',
              width: 24, height: 24, boxShadow: '0 3px 10px rgba(234,67,53,0.5)',
            }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
                <path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z"/>
              </svg>
            </span>
          ) : (
            <>
              {isFlash && (
                <span className="soko-hotdeal-pulse" style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: `linear-gradient(135deg,${T.red},#c62828)`, color: '#fff', borderRadius: '50%',
                  width: 24, height: 24, boxShadow: '0 3px 10px rgba(234,67,53,0.5)',
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff">
                    <path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z"/>
                  </svg>
                </span>
              )}
            </>
          )}
          {isNew && !isFeat && !isFlash && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', width: 'fit-content',
              height: 20, boxSizing: 'border-box',
              background: T.blue, color: '#fff', borderRadius: 50,
              padding: '0 8px', fontSize: 9.5, fontWeight: 800, lineHeight: 1,
              letterSpacing: 0.3, boxShadow: '0 2px 8px rgba(26,115,232,0.3)',
              whiteSpace: 'nowrap', gap: 4,
            }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', animation: 'pulse 1.8s ease-in-out infinite' }} />
              NEW
            </span>
          )}
        </div>

        <ProductCardSaveBtn saved={saved} busy={saveBusy} onToggle={handleSave} />
      </div>

      {/* Fixed body structure — same slots on every card so row heights match */}
      <div className="soko-product-card-body soko-latest-body">
        <div className="soko-product-card-title soko-latest-title">{listing.title}</div>

        <div className="soko-product-card-price soko-latest-price" style={{ color: isFlash ? T.red : T.greenD }}>
          {formatPrice(price)}
          {isFlash && listing.price > price && (
            <span style={{ marginLeft: 5, fontSize: 11, fontWeight: 600, color: T.gray500, textDecoration: 'line-through' }}>
              {formatPrice(listing.price)}
            </span>
          )}
        </div>

        <div className="soko-product-card-meta soko-latest-meta">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ color: T.gray500, flexShrink: 0, display: 'flex' }}>{Icon.pin(11)}</span>
            {listing.city || 'Malawi'}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, color: T.gray500 }}>
            {isVerif && <span title="Verified seller" style={{ display: 'flex' }}>{Icon.verify(12)}</span>}
            {trustCount != null
              ? <><span style={{ display: 'flex' }}>{Icon.eye(10)}</span>{Number(trustCount).toLocaleString()}</>
              : <><span style={{ display: 'flex' }}>{Icon.clock(10)}</span>{timeSincePosted(listing.created_at)}</>
            }
          </span>
        </div>
      </div>
      <ProductCardActions listing={listing} user={user} navigate={navigate} />
    </div>
  )
}

function SkeletonLatestCard() {
  return (
    <div className="soko-product-card soko-latest-card soko-card-bg" style={{ border: `1px solid ${T.gray100}`, boxShadow: T.shadow }}>
      <div className="soko-product-card-media skeleton" style={{ animation: 'none' }} />
      <div className="soko-product-card-body">
        <div className="skeleton" style={{ height: 14, width: '90%', borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 14, width: '72%', borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 16, width: '46%', borderRadius: 4, marginTop: 2 }} />
        <div className="skeleton" style={{ height: 11, width: '55%', borderRadius: 4, marginTop: 'auto' }} />
      </div>
      <div className="soko-product-card-actions">
        <div className="skeleton" style={{ flex: 1, height: 32, borderRadius: 10 }} />
      </div>
    </div>
  )
}

/**
 * Home latest grid — one solid first paint (not tiny 8-item stacks).
 * HOME_LATEST_COUNT fills complete rows: 4×3 desktop / 2×6 mobile.
 * No infinite "show more" on home — that was stacking the page taller forever.
 * Browse the rest on /listings.
 */
const HOME_LATEST_COUNT = 12
const HOME_LATEST_SKELETONS = 8

function LatestListingsSection({ listings, navigate, loading, user, savedIds, onToggleSave, excludeIds }) {
  const sorted = useMemo(() => {
    const exclude = excludeIds instanceof Set ? excludeIds : new Set(excludeIds || [])
    return [...(listings || [])]
      .filter(l => l?.id && !exclude.has(l.id))
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }, [listings, excludeIds])

  // Full first batch at once — no progressive append that stacks the home page
  const latest = sorted.slice(0, HOME_LATEST_COUNT)
  const hasMoreElsewhere = sorted.length > HOME_LATEST_COUNT

  if (!loading && latest.length === 0) return null

  return (
    <section className="soko-latest-section" style={{ padding: '0 20px clamp(28px,4.5vw,48px) 20px', background: T.gray50 }}>
      <style>{`
        @media (max-width: 768px) {
          .soko-latest-head {
            margin-bottom: 12px !important;
            align-items: center !important;
            flex-wrap: nowrap !important;
            gap: 8px !important;
          }
          .soko-latest-head h2 { font-size: 17px !important; margin-bottom: 0 !important; }
          .soko-latest-head p,
          .soko-latest-head > div > div:first-child { display: none !important; }
          .soko-latest-viewall {
            width: auto !important;
            flex-shrink: 0;
            justify-content: center !important;
            min-height: 36px !important;
            padding: 7px 12px !important;
            font-size: 12px !important;
            margin-top: 0 !important;
          }
        }
      `}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto', minWidth: 0 }}>
        <div className="soko-latest-head" style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          marginBottom: 24, flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ minWidth: 0, flex: '1 1 180px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.amber, boxShadow: `0 0 0 4px ${T.amberL}` }} />
              <span style={{ fontSize: 11.5, fontWeight: 800, color: T.amberD, letterSpacing: 0.8, textTransform: 'uppercase' }}>Updated daily</span>
            </div>
            <h2 style={{ fontFamily: T.fontDisplay, fontSize: 'clamp(20px, 2.6vw, 27px)', fontWeight: 800, color: T.gray900, letterSpacing: '-0.6px', marginBottom: 5 }}>
              Latest Listings
            </h2>
            <p style={{ fontSize: 13.5, color: T.gray600 }}>Fresh products added across Malawi</p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/listings')}
            className="soko-btn-dark soko-latest-viewall"
            style={{ fontSize: 13.5, padding: '11px 22px', flexShrink: 0 }}
          >
            View All Listings {Icon.chevR(15)}
          </button>
        </div>

        <div className="soko-latest-grid">
          {loading
            ? Array.from({ length: HOME_LATEST_SKELETONS }).map((_, i) => (
                <div key={i} className="soko-latest-card-wrap"><SkeletonLatestCard /></div>
              ))
            : latest.map((l, i) => (
                <div key={l.id} className="soko-latest-card-wrap">
                  <LatestListingCard
                    listing={l}
                    delay={Math.min(i, 8) * 0.015}
                    onClick={() => navigate('/listing/' + l.id)}
                    user={user}
                    navigate={navigate}
                    saved={savedIds?.has?.(l.id)}
                    onToggleSave={onToggleSave}
                  />
                </div>
              ))
          }
        </div>

        {!loading && hasMoreElsewhere && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
            <button
              type="button"
              onClick={() => navigate('/listings')}
              className="soko-btn-outline"
              style={{
                background: '#fff', color: T.gray800, border: `1.5px solid ${T.gray200}`,
                minHeight: 44, padding: '11px 28px', fontSize: 13.5, fontWeight: 700,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.gray800; e.currentTarget.style.color = T.gray900 }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.gray200; e.currentTarget.style.color = T.gray800 }}
            >
              Browse all products {Icon.chevR(14)}
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   LISTINGS SECTION (tabbed) — "Marketplace Listings"
───────────────────────────────────────────────────────────────────────────── */


/**
 * LookingForSection — drop-in replacement
 * Icons replaced with inline SVGs matching the reference image exactly.
 * Replace everything from `function RequestCard` through closing `}` of
 * `function LookingForSection` in Home.jsx.
 */

/* ── Inline SVG icon set matching the reference ─────────────────────────── */
const CatSVG = {
  all: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/>
      <rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
    </svg>
  ),
  Vehicles: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h14l3 4v4a2 2 0 0 1-2 2h-2"/>
      <circle cx="7.5" cy="17.5" r="2.5"/><circle cx="17.5" cy="17.5" r="2.5"/>
    </svg>
  ),
  Electronics: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="7" y="2" width="10" height="20" rx="2.2"/><line x1="11" y1="18" x2="13" y2="18"/>
    </svg>
  ),
  Property: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 2.5L2 11h3v9h6v-6h2v6h6v-9h3z"/>
    </svg>
  ),
  Clothing: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3L4 6l1.5 3L8 7.5V21h8V7.5l2.5 1.5L20 6l-4-3-2 2h-4z"/>
    </svg>
  ),
  Agriculture: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 21c0-9 5-15 14-16-1 9-7 14-16 16z"/>
      <path d="M5 21c2-4 5-7 9-9"/>
    </svg>
  ),
  Furniture: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h18v10H3z"/><path d="M5 17v2"/><path d="M19 17v2"/><path d="M3 12h18"/>
    </svg>
  ),
  Food: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/>
      <line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/>
    </svg>
  ),
  Services: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
    </svg>
  ),
  Jobs: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    </svg>
  ),
  Other: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="3"/><circle cx="12" cy="12" r="3"/>
    </svg>
  ),
}

function getCatSVG(cat) { return CatSVG[cat] || CatSVG.Other }

function getPriority(r) {
  if (r.urgency === 'urgent') return 'urgent'
  if (r.budget && Number(r.budget) >= 300_000) return 'highbudget'
  return 'new'
}

function expiryInfo(r) {
  const exp = r.expires_at || r.deadline
  if (!exp) return { label: 'Open', muted: true }
  const days = Math.ceil((new Date(exp) - Date.now()) / 86400000)
  if (days <= 0)  return { label: 'Closes today', urgent: true }
  if (days === 1) return { label: 'Closes in 1 day', urgent: true }
  if (days <= 3)  return { label: 'Closing soon', warn: true }
  return { label: `${days}d left`, muted: true }
}

/* Category colors for chips & card badges */
function catColors(cat) {
  const m = {
    Vehicles:    { bg:'#e0f2fe', fg:'#0369a1' },
    Electronics: { bg:'#eff6ff', fg:'#2563eb' },
    Property:    { bg:'#fff7ed', fg:'#ea580c' },
    Clothing:    { bg:'#fdf4ff', fg:'#9333ea' },
    Agriculture: { bg:'#ecfdf5', fg:'#0f766e' },
    Furniture:   { bg:'#fffbeb', fg:'#d97706' },
    Food:        { bg:'#fff1f2', fg:'#e11d48' },
    Services:    { bg:'#f1f5f9', fg:'#475569' },
    Jobs:        { bg:'#eff6ff', fg:'#2563eb' },
  }
  return m[cat] || { bg:'#f8fafc', fg:'#64748b' }
}

/* Category filter tabs */
const CAT_FILTERS = [
  { key: 'all',         label: 'All Requests' },
  { key: 'Vehicles',    label: 'Vehicles'     },
  { key: 'Electronics', label: 'Electronics'  },
  { key: 'Property',    label: 'Property'     },
  { key: 'Clothing',    label: 'Fashion'      },
  { key: 'Agriculture', label: 'Agriculture'  },
]

function catLabel(cat) {
  const m = { Vehicles:'Vehicles', Electronics:'Electronics', Property:'Property', Clothing:'Fashion & Home', Agriculture:'Agriculture', Furniture:'Furniture', Food:'Food', Services:'Services', Jobs:'Jobs' }
  return m[cat] || cat || 'Other'
}

/* ── Expiry clock SVG ── */
const ClockSVG = ({ color }) => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round">
    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
  </svg>
)
/* ── Chat SVG ── */
const ChatSVG = ({ color = '#fff', size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)
/* ── Pin SVG ── */
const PinSVG = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="#64748b">
    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
  </svg>
)
/* ── Checkmark SVG ── */
const CheckSVG = ({ color = '#16a34a', size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.8" strokeLinecap="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
/* ── Verified shield-check SVG ── */
const VerifiedSVG = () => (
  <svg width="13" height="13" viewBox="0 0 24 24">
    <path fill="#16a34a" d="M12 0a4 4 0 0 1 3.2 1.6 4 4 0 0 1 3.6 1 4 4 0 0 1 1 3.6A4 4 0 0 1 21.4 9.4a4 4 0 0 1 0 5.2A4 4 0 0 1 19.8 17.8a4 4 0 0 1-1 3.6 4 4 0 0 1-3.6 1A4 4 0 0 1 12 24a4 4 0 0 1-3.2-1.6 4 4 0 0 1-3.6-1 4 4 0 0 1-1-3.6A4 4 0 0 1 2.6 14.6a4 4 0 0 1 0-5.2A4 4 0 0 1 4.2 6.2a4 4 0 0 1 1-3.6 4 4 0 0 1 3.6-1A4 4 0 0 1 12 0Z"/>
    <path d="m7.5 12.5 3 3 6-7" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
/* ── Offer bubble SVG ── */
const OfferSVG = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
  </svg>
)
/* ── Heart SVG ── */
const HeartSVG = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round">
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
  </svg>
)
/* ── Shield check (trust banner) ── */
const ShieldCheckSVG = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#64748b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
)
/* ─────────────────────────────────────────────────────────────────────────── */

function RequestCard({ request: r, delay = 0, navigate }) {
  const [hov, setHov] = React.useState(false)
  const priority = getPriority(r)
  const expiry   = expiryInfo(r)
  const isVerified = r.buyer_verified || r.requester_verified
  const cc = catColors(r.category)
  const city = (r.cities?.[0] || r.city) || 'Malawi'
  const budgetLabel = r.budget
    ? `MK ${Number(r.budget).toLocaleString('en-US')}`
    : 'Negotiable'

  const priorityLabel =
    priority === 'urgent' ? 'Urgent'
    : priority === 'highbudget' ? 'High budget'
    : 'New'

  return (
    <article
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => navigate('/looking-for')}
      style={{
        flexShrink: 0,
        width: 260,
        maxWidth: 'min(260px, 82vw)',
        background: '#fff',
        borderRadius: 14,
        border: `1px solid ${hov ? '#d1d5db' : '#e8eaed'}`,
        boxShadow: hov
          ? '0 12px 28px rgba(15,23,42,0.10)'
          : '0 1px 2px rgba(15,23,42,0.04), 0 4px 12px rgba(15,23,42,0.04)',
        transform: hov ? 'translateY(-3px)' : 'none',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease',
        animation: `fadeUp 0.4s ease ${Math.min(delay, 0.35)}s both`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {/* Media */}
      <div style={{
        position: 'relative', width: '100%', height: 128,
        background: cc.bg, flexShrink: 0, overflow: 'hidden',
      }}>
        {r.image_url ? (
          <img
            src={r.image_url}
            alt=""
            loading="lazy"
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              transform: hov ? 'scale(1.03)' : 'scale(1)',
              transition: 'transform 0.4s ease',
            }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 8,
            color: cc.fg,
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 12,
              background: 'rgba(255,255,255,0.7)',
              display: 'grid', placeItems: 'center',
              border: '1px solid rgba(0,0,0,0.04)',
            }}>
              {React.cloneElement(getCatSVG(r.category), { width: 20, height: 20 })}
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.75 }}>{catLabel(r.category)}</span>
          </div>
        )}

        <div style={{
          position: 'absolute', inset: 0,
          background: r.image_url
            ? 'linear-gradient(180deg, rgba(0,0,0,0.18) 0%, transparent 45%)'
            : 'none',
          pointerEvents: 'none',
        }} />

        <div style={{
          position: 'absolute', top: 10, left: 10, right: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6,
        }}>
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: 0.2,
            padding: '4px 8px', borderRadius: 999,
            background: priority === 'urgent'
              ? 'rgba(17,24,39,0.88)'
              : 'rgba(255,255,255,0.94)',
            color: priority === 'urgent' ? '#fff' : '#374151',
            border: priority === 'urgent' ? 'none' : '1px solid rgba(0,0,0,0.06)',
            backdropFilter: 'blur(6px)',
          }}>
            {priorityLabel}
          </span>
          {isVerified && (
            <span title="Verified buyer" style={{
              width: 26, height: 26, borderRadius: '50%',
              background: 'rgba(255,255,255,0.95)',
              display: 'grid', placeItems: 'center',
              border: '1px solid rgba(0,0,0,0.05)',
              boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            }}>
              <VerifiedSVG />
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{
        padding: '14px 14px 12px',
        display: 'flex', flexDirection: 'column', flex: 1, gap: 8,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 600, color: '#6b7280',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ color: cc.fg, display: 'flex' }}>
            {React.cloneElement(getCatSVG(r.category), { width: 12, height: 12 })}
          </span>
          {catLabel(r.category)}
          <span style={{ color: '#d1d5db' }}>·</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{city}</span>
        </div>

        <h3 style={{
          margin: 0, fontSize: 15, fontWeight: 700, color: '#111827',
          lineHeight: 1.3, letterSpacing: '-0.2px',
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          minHeight: 39,
        }}>
          {r.title}
        </h3>

        <div>
          <div style={{
            fontFamily: T.fontDisplay, fontSize: 17, fontWeight: 800,
            color: '#0a7a44', letterSpacing: '-0.3px', lineHeight: 1.15,
          }}>
            {budgetLabel}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2, fontWeight: 500 }}>
            {r.is_monthly ? 'Monthly budget' : 'Budget'}
            {expiry.label ? ` · ${expiry.label}` : ''}
          </div>
        </div>

        <div style={{
          marginTop: 'auto', paddingTop: 10,
          borderTop: '1px solid #f3f4f6',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <span style={{ fontSize: 11.5, color: '#6b7280', fontWeight: 500 }}>
            {timeSincePosted(r.created_at) || 'Recently'}
            {r.offer_count != null ? ` · ${r.offer_count} offers` : ''}
          </span>
          <button
            type="button"
            onClick={e => { e.stopPropagation(); navigate('/looking-for') }}
            style={{
              background: hov ? '#000' : '#202124',
              color: '#fff', border: 'none', borderRadius: 8,
              padding: '7px 12px', fontSize: 12, fontWeight: 700,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
              transition: 'background 0.15s', whiteSpace: 'nowrap',
            }}
          >
            <ChatSVG size={12} />
            Respond
          </button>
        </div>
      </div>
    </article>
  )
}

function LookingForSection({ navigate, requests, loading, userLat, userLng, activeDistrict, viewerLocation: viewerLocationProp }) {
  const scrollRef = React.useRef(null)
  const [canLeft,      setCanLeft]      = React.useState(false)
  const [canRight,     setCanRight]     = React.useState(false)
  const [viewerLoc,    setViewerLoc]    = React.useState(viewerLocationProp || null)
  const [detectingGps, setDetectingGps] = React.useState(!viewerLocationProp)
  const [gpsError,     setGpsError]     = React.useState(null)

  // Same GPS pipeline as Looking For page: reverse-geocode → area + district
  async function detectGps(force = false) {
    setDetectingGps(true)
    setGpsError(null)
    try {
      const gps = await getGPSLocation()
      if (gps?.lat != null || gps?.label || gps?.district) {
        setViewerLoc(gps)
        try {
          sessionStorage.setItem('userCoords', JSON.stringify({ lat: gps.lat, lng: gps.lng }))
          sessionStorage.setItem('soko_gps_location', JSON.stringify(gps))
        } catch { /* ignore */ }
        setDetectingGps(false)
        return gps
      }
      if (Number.isFinite(userLat) && Number.isFinite(userLng)) {
        // Coords known but reverse-geocode failed — still usable for km distance
        const fallback = {
          lat: userLat,
          lng: userLng,
          label: activeDistrict && activeDistrict !== 'All Districts' ? activeDistrict : null,
          district: activeDistrict && activeDistrict !== 'All Districts' ? activeDistrict : null,
          city: activeDistrict && activeDistrict !== 'All Districts' ? activeDistrict : null,
        }
        setViewerLoc(fallback)
        setDetectingGps(false)
        return fallback
      }
      if (activeDistrict && activeDistrict !== 'All Districts') {
        const d = { label: activeDistrict, district: activeDistrict, city: activeDistrict }
        setViewerLoc(d)
        setDetectingGps(false)
        return d
      }
      if (force) setGpsError('Could not detect GPS. Allow location access.')
      setDetectingGps(false)
      return null
    } catch {
      setDetectingGps(false)
      if (force) setGpsError('Could not detect GPS.')
      return null
    }
  }

  React.useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Prefer parent-provided GPS (Home boot) if fresh
      if (viewerLocationProp?.lat != null || viewerLocationProp?.district) {
        if (!cancelled) {
          setViewerLoc(viewerLocationProp)
          setDetectingGps(false)
        }
        return
      }
      // Cached full GPS object from prior detect
      try {
        const cached = sessionStorage.getItem('soko_gps_location')
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed?.lat != null || parsed?.district) {
            if (!cancelled) {
              setViewerLoc(parsed)
              setDetectingGps(false)
            }
            // Refresh in background
            detectGps(false)
            return
          }
        }
      } catch { /* ignore */ }
      if (!cancelled) await detectGps(false)
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewerLocationProp])

  // When header district changes and we still have no GPS, use district as area hint
  React.useEffect(() => {
    if (viewerLoc?.lat != null) return
    if (activeDistrict && activeDistrict !== 'All Districts') {
      setViewerLoc(prev => prev?.district === activeDistrict ? prev : {
        label: activeDistrict,
        district: activeDistrict,
        city: activeDistrict,
        lat: prev?.lat,
        lng: prev?.lng,
      })
    }
  }, [activeDistrict])

  function checkScroll() {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 8)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8)
  }

  // Nearest looking-for first + distance labels (same helpers as Looking For page)
  const ranked = React.useMemo(() => {
    const open = (requests || []).filter(r => r.status !== 'fulfilled')
    const loc = viewerLoc
      || (Number.isFinite(userLat) && Number.isFinite(userLng)
        ? { lat: userLat, lng: userLng, district: activeDistrict !== 'All Districts' ? activeDistrict : null }
        : null)
      || (activeDistrict && activeDistrict !== 'All Districts'
        ? { label: activeDistrict, district: activeDistrict, city: activeDistrict }
        : null)
    const byArea = sortRequestsByViewerLocation(open, loc, 'recent')
    const withDist = withDistanceToBuyer(byArea, loc)
    return [...withDist].sort((a, b) => {
      const sa = a._locScore || 0
      const sb = b._locScore || 0
      if (sb !== sa) return sb - sa
      const da = a._distanceKm != null ? a._distanceKm : 1e9
      const db = b._distanceKm != null ? b._distanceKm : 1e9
      if (da !== db) return da - db
      return new Date(b.created_at || 0) - new Date(a.created_at || 0)
    })
  }, [requests, viewerLoc, userLat, userLng, activeDistrict])

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setTimeout(checkScroll, 100)
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => { el.removeEventListener('scroll', checkScroll); window.removeEventListener('resize', checkScroll) }
  }, [ranked])

  function scrollBy(dir) { scrollRef.current?.scrollBy({ left: dir * 540, behavior: 'smooth' }) }

  const filtered = ranked
  const placeLabel =
    viewerLoc?.district ||
    viewerLoc?.city ||
    viewerLoc?.label ||
    (activeDistrict && activeDistrict !== 'All Districts' ? activeDistrict : null)
  const nearCount = filtered.filter(r => (r._locScore || 0) >= 85).length

  const ArrowL = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
  const ArrowR = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>

  return (
    <section className="soko-section-pad soko-lf-section" style={{ padding: '22px 20px 16px', background: '#fafbfa' }}>
      <style>{`
        ${LOOKING_FOR_CARD_CSS}
        .soko-lf-section .soko-lf-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px 16px;
          margin-bottom: 12px;
          flex-wrap: nowrap;
        }
        .soko-lf-section .soko-lf-head-left {
          min-width: 0;
          flex: 1 1 auto;
        }
        .soko-lf-section .soko-lf-eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 800;
          color: #c88a00;
          letter-spacing: 0.55px;
          text-transform: uppercase;
          margin-bottom: 6px;
        }
        .soko-lf-section .soko-lf-title {
          font-family: ${T.fontDisplay};
          font-size: clamp(18px, 2.2vw, 24px);
          font-weight: 800;
          color: #111827;
          letter-spacing: -0.45px;
          margin: 0;
          line-height: 1.2;
        }
        .soko-lf-section .soko-lf-sub {
          font-size: 13px;
          color: #6b7280;
          margin: 4px 0 0;
          line-height: 1.4;
          font-weight: 500;
        }
        .soko-lf-section .soko-lf-head-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-shrink: 0;
        }
        .soko-lf-section .soko-lf-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 5px;
          border-radius: 10px;
          padding: 9px 14px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          font-family: inherit;
          white-space: nowrap;
          min-height: 40px;
          transition: background 0.15s, border-color 0.15s, color 0.15s;
        }
        .soko-lf-section .soko-lf-btn-ghost {
          background: #fff;
          border: 1px solid #e5e7eb;
          color: #374151;
        }
        .soko-lf-section .soko-lf-btn-ghost:hover {
          border-color: #3c4043;
          color: #202124;
        }
        .soko-lf-section .soko-lf-btn-primary {
          background: #202124;
          border: 1px solid #202124;
          color: #fff;
        }
        .soko-lf-section .soko-lf-btn-primary:hover { background: #000; }
        .soko-lf-gps {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 14px;
          padding: 10px 12px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          min-width: 0;
        }
        .soko-lf-gps-ico {
          width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
          background: #fff; border: 1px solid #e2e8f0;
          display: flex; align-items: center; justify-content: center;
        }
        .soko-lf-gps-text { min-width: 0; flex: 1; }
        .soko-lf-gps-title {
          font-size: 12.5px; font-weight: 800; color: #334155;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .soko-lf-gps-sub {
          font-size: 11.5px; color: #5f6368; font-weight: 600;
          margin-top: 1px; line-height: 1.35;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }
        .soko-lf-gps-btn {
          flex-shrink: 0;
          border: 1.5px solid #cbd5e1;
          background: #fff;
          color: #334155;
          border-radius: 10px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 800;
          cursor: pointer;
          font-family: inherit;
          min-height: 36px;
        }
        .soko-lf-gps-btn:disabled { opacity: 0.65; cursor: default; }
        .lf3-arrow {
          position:absolute; top:50%; transform:translateY(-50%); z-index:10;
          width:36px; height:36px; border-radius:50%;
          background:#fff; border:1px solid #e5e7eb;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; box-shadow:0 2px 8px rgba(0,0,0,0.08);
          color:#374151; transition:all 0.15s; flex-shrink:0;
        }
        .lf3-arrow:hover { background:#202124; border-color:#202124; color:#fff; }
        .lf3-arrow.hide  { opacity:0; pointer-events:none; }
        .lf3-scroll {
          display:flex; gap:12px; overflow-x:auto;
          padding: 2px 2px 10px;
          scrollbar-width:none; -ms-overflow-style:none;
          -webkit-overflow-scrolling:touch;
          align-items:stretch;
          scroll-snap-type: x mandatory;
        }
        .lf3-scroll::-webkit-scrollbar { display:none; }
        .lf3-scroll > .lf-card.is-carousel {
          scroll-snap-align: start;
        }
        @media (max-width: 768px) {
          .soko-lf-section { padding: 16px 14px 12px !important; }
          .soko-lf-section .soko-lf-head {
            flex-wrap: wrap !important;
            align-items: flex-start !important;
            gap: 10px !important;
            margin-bottom: 10px !important;
          }
          .soko-lf-section .soko-lf-head-left { width: 100%; flex: 1 1 100% !important; }
          .soko-lf-section .soko-lf-title {
            font-size: 17px !important;
            letter-spacing: -0.3px !important;
          }
          .soko-lf-section .soko-lf-sub { display: none !important; }
          .soko-lf-section .soko-lf-head-actions {
            width: 100% !important;
            display: grid !important;
            grid-template-columns: 1fr 1.2fr;
            gap: 8px !important;
          }
          .soko-lf-section .soko-lf-btn {
            width: 100%;
            min-height: 42px;
            font-size: 12.5px;
            padding: 10px 12px;
          }
          .soko-lf-gps {
            padding: 9px 10px !important;
            gap: 8px !important;
            margin-bottom: 12px !important;
          }
          .soko-lf-gps-ico { width: 28px; height: 28px; border-radius: 8px; }
          .soko-lf-gps-sub {
            white-space: normal !important;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
          }
          .soko-lf-gps-btn {
            padding: 7px 10px;
            font-size: 11.5px;
            min-height: 34px;
          }
          .lf3-arrow { display: none !important; }
          .lf3-scroll {
            gap: 10px !important;
            margin: 0 -14px;
            padding-left: 14px !important;
            padding-right: 14px !important;
            scroll-padding-inline: 14px;
          }
        }
      `}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* Header: title left · actions right (one clean row on desktop) */}
        <div className="soko-lf-head">
          <div className="soko-lf-head-left">
            <div className="soko-lf-eyebrow">
              <span style={{
                width: 7, height: 7, borderRadius: '50%', background: '#F9AB00',
                boxShadow: '0 0 0 3px rgba(249,171,0,0.22)',
              }} />
              Looking For
              {filtered.length > 0 && (
                <span style={{
                  marginLeft: 4, fontSize: 10, fontWeight: 800, color: '#6b7280',
                  background: '#f3f4f6', borderRadius: 999, padding: '2px 7px',
                  letterSpacing: 0, textTransform: 'none',
                }}>
                  {filtered.length}
                </span>
              )}
            </div>
            <h2 className="soko-lf-title">Buyers are ready. Be the first to sell.</h2>
            <p className="soko-lf-sub soko-web-only">
              Real demand near you · free to post · sellers respond fast
            </p>
          </div>
          <div className="soko-lf-head-actions">
            <button type="button" className="soko-lf-btn soko-lf-btn-ghost" onClick={() => navigate('/looking-for')}>
              View all <ArrowR />
            </button>
            <button type="button" className="soko-lf-btn soko-lf-btn-primary" onClick={() => navigate('/looking-for')}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" aria-hidden><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              Post a request
            </button>
          </div>
        </div>

        {/* Compact GPS strip */}
        <div className="soko-lf-gps">
          <span className="soko-lf-gps-ico" aria-hidden>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" /><circle cx="12" cy="10" r="2.2" />
            </svg>
          </span>
          <div className="soko-lf-gps-text">
            <div className="soko-lf-gps-title">
              {detectingGps
                ? 'Detecting your location…'
                : placeLabel
                  ? `Near you · ${placeLabel}`
                  : 'Location not detected'}
            </div>
            <div className="soko-lf-gps-sub">
              {gpsError
                ? gpsError
                : placeLabel
                  ? nearCount > 0
                    ? `${nearCount} near you first · distance on cards`
                    : 'Nearest buyer demand first'
                  : 'Allow GPS to prioritise nearby requests'}
            </div>
          </div>
          <button
            type="button"
            className="soko-lf-gps-btn"
            onClick={() => detectGps(true)}
            disabled={detectingGps}
          >
            {detectingGps ? '…' : 'Update GPS'}
          </button>
        </div>

        {/* Horizontal request cards */}
        {loading ? (
          <div className="lf3-scroll">
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{
                flexShrink: 0, width: 260, height: 300, borderRadius: 14,
                background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)',
                backgroundSize: '600px 100%', animation: 'shimmer 1.4s infinite',
                border: '1px solid #eee',
              }} />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div style={{ position: 'relative' }}>
            <button type="button" className={`lf3-arrow${canLeft ? '' : ' hide'}`} style={{ left: -18 }} onClick={() => scrollBy(-1)} aria-label="Scroll left"><ArrowL /></button>
            <button type="button" className={`lf3-arrow${canRight ? '' : ' hide'}`} style={{ right: -18 }} onClick={() => scrollBy(1)} aria-label="Scroll right"><ArrowR /></button>
            <div ref={scrollRef} className="lf3-scroll">
              {filtered.map(r => (
                <LookingForRequestCard
                  key={r.id}
                  req={r}
                  carousel
                  compactCta
                  isNearYou={(r._locScore || 0) >= 85}
                  onViewDetails={() => navigate(`/looking-for?request=${r.id}`)}
                  onOffer={() => navigate(`/looking-for?request=${r.id}`)}
                />
              ))}
            </div>
          </div>
        ) : (
          <div style={{
            textAlign: 'center', padding: '32px 20px',
            border: '1px solid #e8eaed', borderRadius: 14, background: '#fff',
          }}>
            <p style={{ fontSize: 14.5, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>
              No open requests yet
            </p>
            <p style={{ fontSize: 13, color: '#6b7280', margin: '0 0 14px' }}>
              Be the first to post what you need.
            </p>
            <button
              type="button"
              className="soko-lf-btn soko-lf-btn-primary"
              onClick={() => navigate('/looking-for')}
              style={{ margin: '0 auto' }}
            >
              Post a request
            </button>
          </div>
        )}
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   FEATURED SHOPS — business directory; premium shops surface first
───────────────────────────────────────────────────────────────────────────── */
function ShopsSection({ navigate, shops, loading }) {
  const scrollRef = useRef(null)
  const [canLeft, setCanLeft]   = useState(false)
  const [canRight, setCanRight] = useState(false)

  function checkScroll() {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 8)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8)
  }

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setTimeout(checkScroll, 100)
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => { el.removeEventListener('scroll', checkScroll); window.removeEventListener('resize', checkScroll) }
  }, [shops])

  function scrollBy(dir) { scrollRef.current?.scrollBy({ left: dir * 560, behavior: 'smooth' }) }

  

  const trustItems = [
    { icon: Icon.shieldCheck, label: 'Verified Shops', sub: 'Trusted and vetted' },
    { icon: Icon.chat,        label: 'Fast Response',  sub: 'Active sellers'      },
    { icon: Icon.check,       label: 'Quality Assured', sub: 'Reviewed products'  },
    { icon: Icon.layers,      label: 'Secure Marketplace', sub: 'Safe to transact' },
  ]

  return (
    <section style={{ padding: '0 20px clamp(32px,4.5vw,52px) 20px', background: 'linear-gradient(to bottom, #fff 0%, #f9fafb 60%)' }}>
      <style>{`
        .shops-scroll::-webkit-scrollbar { display: none; }
        .shops-scroll { -ms-overflow-style: none; scrollbar-width: none; }
        .shop-arrow {
          position: absolute; top: 50%; transform: translateY(-50%); z-index: 10;
          width: 40px; height: 40px; border-radius: 50%;
          background: #fff; border: 1.5px solid #e5e7eb;
          display: flex; align-items: center; justify-content: center;
          cursor: pointer; box-shadow: 0 2px 12px rgba(0,0,0,0.12);
          color: #374151; transition: all 0.2s; flex-shrink: 0;
        }
        .shop-arrow:hover { background: #202124; border-color: #202124; color: #fff; box-shadow: 0 4px 18px rgba(0,0,0,0.2); transform: translateY(-50%) scale(1.08); }
        .shop-arrow.hidden { opacity: 0; pointer-events: none; }
        .shop-card {
          flex-shrink: 0; width: 210px; background: #fff;
          border-radius: 18px; border: 1px solid #e5e7eb;
          box-shadow: 0 2px 8px rgba(0,0,0,0.07);
          overflow: hidden; cursor: pointer;
          transition: transform 0.28s cubic-bezier(0.22,1,0.36,1), box-shadow 0.28s ease;
          display: flex; flex-direction: column;
        }
        .shop-card:hover { transform: translateY(-6px); box-shadow: 0 18px 44px rgba(0,0,0,0.14); }
        .shop-logo-wrap { transition: transform 0.28s cubic-bezier(0.22,1,0.36,1); }
        .shop-card:hover .shop-logo-wrap { transform: scale(1.08); }
        .visit-btn {
          width: 100%; background: #202124; color: #fff; border: none;
          padding: 11px 0; font-size: 13.5px; font-weight: 700; cursor: pointer;
          transition: background 0.15s;
        }
        .visit-btn:hover { background: #000; }
        @media (max-width: 768px) { .shop-arrow { display: none !important; } }
      `}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h2 style={{ fontFamily: T.fontDisplay, fontSize: 'clamp(20px,2.6vw,27px)', fontWeight: 800, color: T.gray900, letterSpacing: '-0.6px', marginBottom: 5 }}>
              Featured Shops
            </h2>
            <p style={{ fontSize: 13.5, color: T.gray600 }}>Trusted shops with great products and reliable service.</p>
          </div>
          <button
            onClick={() => navigate('/shops')}
            style={{ background: '#fff', border: `1.5px solid ${T.gray200}`, borderRadius: 50, padding: '9px 20px', fontSize: 13.5, fontWeight: 600, color: T.gray800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.green; e.currentTarget.style.color = T.green }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.gray200; e.currentTarget.style.color = T.gray800 }}
          >
            View all Shops {Icon.chevR(15)}
          </button>
        </div>

        {/* ── Carousel ── */}
        {loading ? (
          <div style={{ display: 'flex', gap: 16 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ flexShrink: 0, width: 210, borderRadius: 18, overflow: 'hidden', border: `1px solid ${T.gray100}` }}>
                <div className="skeleton" style={{ width: '100%', height: 120 }} />
                <div style={{ padding: '44px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div className="skeleton" style={{ height: 14, width: '70%', borderRadius: 6 }} />
                  <div className="skeleton" style={{ height: 11, width: '50%', borderRadius: 6 }} />
                  <div className="skeleton" style={{ height: 11, width: '60%', borderRadius: 6 }} />
                  <div className="skeleton" style={{ height: 36, borderRadius: 8, marginTop: 8 }} />
                </div>
              </div>
            ))}
          </div>
        ) : shops.length > 0 ? (
          <div style={{ position: 'relative' }}>
            <button className={`shop-arrow${canLeft ? '' : ' hidden'}`} style={{ left: -20 }} onClick={() => scrollBy(-1)} aria-label="Scroll left">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
            <button className={`shop-arrow${canRight ? '' : ' hidden'}`} style={{ right: -20 }} onClick={() => scrollBy(1)} aria-label="Scroll right">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>

            <div ref={scrollRef} className="shops-scroll" style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 8, paddingTop: 4 }}>
              {shops.map((s, i) => (
                <div key={s.id} className="shop-card" onClick={() => navigate('/shop/' + s.slug)}>

                  {/* Cover image */}
                  <div style={{ position: 'relative', width: '100%', height: 120, flexShrink: 0, overflow: 'hidden', background: T.gray100 }}>
                    {s.cover_url ? (
                      <img
                        src={s.cover_url}
                        alt=""
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={e => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : s.logo_url ? (
                      <>
                        <img
                          src={s.logo_url}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'blur(4px) saturate(1.4) brightness(0.85)', transform: 'scale(1.08)' }}
                          onError={e => { e.currentTarget.style.display = 'none' }}
                        />
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.15)' }} />
                      </>
                    ) : (
                      <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, #1e293b 0%, #334155 55%, ${T.amber}55 100%)` }} />
                    )}
                    {/* Gradient overlay at bottom for logo overlap */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.18))' }} />
                  </div>

                  {/* Logo — overlapping cover */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: -28, marginBottom: 10, position: 'relative', zIndex: 2 }}>
                    <div className="shop-logo-wrap" style={{
                      width: 56, height: 56, borderRadius: '50%',
                      border: '3px solid #fff',
                      background: s.logo_url ? 'transparent' : `linear-gradient(135deg, #334155, #1e293b)`,
                      overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 800, fontSize: 20,
                      boxShadow: '0 2px 10px rgba(0,0,0,0.15)',
                    }}>
                      {s.logo_url
                        ? <img src={s.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (s.name?.[0] || 'S').toUpperCase()
                      }
                    </div>
                  </div>

                  {/* Body */}
                  <div style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>

                    {/* Verified badge */}
                    {s.is_verified && (
                      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 2 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: '#dcfce7', color: '#15803d', borderRadius: 50, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>
                          {Icon.verify(11)} Verified Shop
                        </span>
                      </div>
                    )}

                    {/* Name + category */}
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: T.gray900, marginBottom: 2 }}>{s.name}</div>
                      <div style={{ fontSize: 11.5, color: T.gray600 }}>{s.category}</div>
                    </div>

                    {/* Rating */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 12, color: T.gray700 }}>
                      {Icon.star(12)}
                      <span style={{ fontWeight: 700 }}>{s.rating || '—'}</span>
                      <span style={{ color: T.gray500 }}>
                        {s.review_count > 0 ? `(${s.review_count} reviews)` : 'No reviews yet'}
                      </span>
                    </div>

                    {/* Location */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, fontSize: 11.5, color: T.gray600 }}>
                      {Icon.pin(11)} {s.city || 'Malawi'}
                    </div>

                    {/* Product count */}
                    <div style={{ textAlign: 'center', fontSize: 12, color: T.gray600, marginBottom: 10 }}>
                      {s.listing_count || 0}+ products
                    </div>

                    {/* Visit button */}
                    <button
                      className="visit-btn"
                      style={{ borderRadius: 10 }}
                      onClick={e => { e.stopPropagation(); navigate('/shop/' + s.slug) }}
                    >
                      Visit Shop
                    </button>
                  </div>
                </div>
              ))}

              {/* Create shop CTA card */}
              <div className="shop-card" onClick={() => navigate('/shop-setup')} style={{ border: `2px dashed ${T.gray200}`, background: T.gray50, justifyContent: 'center', alignItems: 'center', minHeight: 300 }}>
                <div style={{ textAlign: 'center', padding: '20px 16px' }}>
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: T.amberL, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: T.amberD }}>
                    {Icon.plus(22)}
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.gray800, marginBottom: 6 }}>Open Your Shop</div>
                  <div style={{ fontSize: 11.5, color: T.gray600, lineHeight: 1.5, marginBottom: 14 }}>Reach buyers across all of Malawi</div>
                  <span style={{ background: T.gray900, color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 12.5, fontWeight: 700 }}>Get Started</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px 24px', border: `1.5px dashed ${T.gray200}`, borderRadius: 18 }}>
            <p style={{ fontSize: 14, color: T.gray600, marginBottom: 14 }}>No shops yet — open the first one.</p>
            <button className="soko-btn-primary" onClick={() => navigate('/shop-setup')}>Create My Shop</button>
          </div>
        )}

        

      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   JOBS + SERVICES — side by side
───────────────────────────────────────────────────────────────────────────── */
function JobsServicesSection({ navigate, jobs, services, loading }) {
  return (
    <section style={{ padding: 'clamp(24px,4vw,40px) 20px', background: '#fff' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div className="soko-jobs-services" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

          <div>
            <SectionHeader title="Jobs Near You" subtitle="Recent vacancies" action={{ label: 'View all jobs', onClick: () => navigate('/jobs') }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loading
                ? [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 58, borderRadius: 14 }} />)
                : jobs.length > 0
                  ? jobs.map(j => (
                    <div key={j.id} onClick={() => navigate('/jobs')} className="soko-card-bg soko-card-hover" style={{ background: '#fff', border: `1px solid ${T.gray200}`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: T.blueL, color: T.blue, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{Icon.briefcase(17)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.gray900 }}>{j.title}</div>
                        <div style={{ fontSize: 11.5, color: T.gray600 }}>{j.company || j.city} · {j.type || 'Full-time'}</div>
                      </div>
                      {Icon.chevR(15)}
                    </div>
                  ))
                  : <EmptyMini text="No jobs posted yet." cta="Post a Job" onClick={() => navigate('/jobs')} />
              }
            </div>
          </div>

          <div>
            <SectionHeader title="Services Near You" subtitle="Available service providers" action={{ label: 'View all services', onClick: () => navigate('/services') }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loading
                ? [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 58, borderRadius: 14 }} />)
                : services.length > 0
                  ? services.map(s => (
                    <div key={s.id} onClick={() => navigate('/services')} className="soko-card-bg soko-card-hover" style={{ background: '#fff', border: `1px solid ${T.gray200}`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: T.violetL, color: T.violet, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{Icon.wrench(17)}</div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.gray900 }}>{s.name}</div>
                        <div style={{ fontSize: 11.5, color: T.gray600 }}>{s.category || s.city || 'Malawi'}</div>
                      </div>
                      {Icon.chevR(15)}
                    </div>
                  ))
                  : <EmptyMini text="No services listed yet." cta="Offer a Service" onClick={() => navigate('/services')} />
              }
            </div>
          </div>

        </div>
      </div>
    </section>
  )
}

/** Horizontal media card for jobs / services on Home */
function HomeWorkCard({
  title,
  sub,
  meta,
  image,
  fallbackIcon,
  accentBg,
  accentFg,
  onClick,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="soko-work-card"
      style={{
        flexShrink: 0,
        width: 220,
        maxWidth: 'min(220px, 72vw)',
        border: `1px solid ${T.gray200}`,
        borderRadius: 14,
        overflow: 'hidden',
        background: '#fff',
        cursor: 'pointer',
        padding: 0,
        textAlign: 'left',
        fontFamily: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: T.shadow,
        scrollSnapAlign: 'start',
      }}
    >
      <div style={{
        position: 'relative', width: '100%', height: 100, flexShrink: 0,
        background: accentBg, overflow: 'hidden',
      }}>
        {image ? (
          <img
            src={image}
            alt=""
            loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { e.currentTarget.style.display = 'none' }}
          />
        ) : (
          <div style={{
            width: '100%', height: '100%', display: 'flex', alignItems: 'center',
            justifyContent: 'center', color: accentFg, opacity: 0.85,
          }}>
            {fallbackIcon}
          </div>
        )}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.45) 100%)',
          pointerEvents: 'none',
        }} />
      </div>
      <div style={{ padding: '10px 12px 12px', display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 800, color: T.gray900, lineHeight: 1.25,
          overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
        }}>
          {title}
        </div>
        {sub && (
          <div style={{
            fontSize: 11.5, color: T.gray600, fontWeight: 600,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {sub}
          </div>
        )}
        {meta && (
          <div style={{
            marginTop: 'auto', paddingTop: 6, fontSize: 11, color: T.gray500, fontWeight: 600,
            display: 'flex', alignItems: 'center', gap: 4,
          }}>
            {Icon.pin(10)} {meta}
          </div>
        )}
      </div>
    </button>
  )
}

function ShopsJobsServicesRow({ navigate, shops, jobs, services, loading }) {
  const shopsRail = useRef(null)
  const jobsRail = useRef(null)
  const servicesRail = useRef(null)

  return (
    <section className="soko-shops-jobs-section" style={{ padding: '22px 20px 18px', background: '#fff' }}>
      <style>{`
        .soko-sjs-block { margin-bottom: 22px; }
        .soko-sjs-block:last-child { margin-bottom: 0; }
        .soko-sjs-head {
          display: flex; align-items: center; justify-content: space-between;
          gap: 12px; margin-bottom: 12px;
        }
        .soko-sjs-title {
          font-family: ${T.fontDisplay}; font-size: 18px; font-weight: 800;
          color: ${T.gray900}; letter-spacing: -0.35px; margin: 0;
        }
        .soko-sjs-link {
          background: none; border: none; font-size: 13px; font-weight: 700;
          color: ${T.gray700}; cursor: pointer; font-family: inherit;
          display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0;
          min-height: 36px;
          transition: color 0.15s;
        }
        .soko-sjs-link:hover { color: ${T.gray900}; }
        .soko-sjs-rail {
          display: flex; gap: 12px; overflow-x: auto;
          padding: 2px 2px 8px;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none; -ms-overflow-style: none;
        }
        .soko-sjs-rail::-webkit-scrollbar { display: none; }
        .soko-shop-card-home {
          flex-shrink: 0;
          width: 200px;
          max-width: min(200px, 68vw);
          background: #fff;
          border-radius: 16px;
          border: 1px solid ${T.gray200};
          box-shadow: ${T.shadow};
          overflow: hidden;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          scroll-snap-align: start;
          text-align: left;
          padding: 0;
          font-family: inherit;
          transition: transform 0.2s ease, box-shadow 0.2s ease;
        }
        .soko-shop-card-home:hover {
          transform: translateY(-3px);
          box-shadow: ${T.shadowMd};
        }
        .soko-shop-card-home:active { transform: scale(0.98); }
        @media (max-width: 768px) {
          .soko-shops-jobs-section { padding: 16px 14px 12px !important; }
          .soko-sjs-title { font-size: 16px !important; }
          .soko-sjs-rail {
            margin: 0 -14px;
            padding-left: 14px !important;
            padding-right: 14px !important;
            scroll-padding-inline: 14px;
            gap: 10px !important;
          }
          .soko-sjs-block { margin-bottom: 18px; }
        }
      `}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* ── Shops (cover + logo) ── */}
        <div className="soko-sjs-block">
          <div className="soko-sjs-head">
            <h2 className="soko-sjs-title">Featured Shops</h2>
            <button type="button" className="soko-sjs-link" onClick={() => navigate('/shops')}>
              View all {Icon.chevR(14)}
            </button>
          </div>

          {loading ? (
            <div className="soko-sjs-rail">
              {[1, 2, 3, 4].map(i => (
                <div key={i} style={{ flexShrink: 0, width: 200, borderRadius: 16, overflow: 'hidden', border: `1px solid ${T.gray100}` }}>
                  <div className="skeleton" style={{ width: '100%', height: 96 }} />
                  <div style={{ padding: '28px 12px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="skeleton" style={{ height: 13, width: '70%', borderRadius: 4, margin: '0 auto' }} />
                    <div className="skeleton" style={{ height: 11, width: '50%', borderRadius: 4, margin: '0 auto' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : shops.length > 0 ? (
            <div ref={shopsRail} className="soko-sjs-rail">
              {shops.map(s => (
                <button
                  key={s.id}
                  type="button"
                  className="soko-shop-card-home"
                  onClick={() => navigate('/shop/' + s.slug)}
                >
                  {/* Cover photo */}
                  <div style={{ position: 'relative', width: '100%', height: 96, flexShrink: 0, overflow: 'hidden', background: T.gray100 }}>
                    {s.cover_url ? (
                      <img
                        src={s.cover_url}
                        alt=""
                        loading="lazy"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                        onError={e => { e.currentTarget.style.display = 'none' }}
                      />
                    ) : s.logo_url ? (
                      <>
                        <img
                          src={s.logo_url}
                          alt=""
                          style={{
                            width: '100%', height: '100%', objectFit: 'cover',
                            filter: 'blur(8px) saturate(1.3) brightness(0.8)', transform: 'scale(1.15)',
                          }}
                        />
                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(6,30,18,0.25)' }} />
                      </>
                    ) : (
                      <div style={{
                        width: '100%', height: '100%',
                        background: `linear-gradient(135deg, #1e293b 0%, #475569 55%, ${T.amber}55 100%)`,
                      }} />
                    )}
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0, height: 40,
                      background: 'linear-gradient(to top, rgba(0,0,0,0.35), transparent)',
                    }} />
                    {s.is_verified && (
                      <span style={{
                        position: 'absolute', top: 8, left: 8,
                        display: 'inline-flex', alignItems: 'center', gap: 3,
                        background: 'rgba(255,255,255,0.95)', color: '#15803d',
                        borderRadius: 999, padding: '3px 8px', fontSize: 10, fontWeight: 800,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.12)',
                      }}>
                        {Icon.verify(10)} Verified
                      </span>
                    )}
                  </div>

                  {/* Logo over cover */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: -22, position: 'relative', zIndex: 2 }}>
                    <div style={{
                      width: 44, height: 44, borderRadius: '50%',
                      border: '2.5px solid #fff',
                      background: s.logo_url ? '#fff' : `linear-gradient(135deg, #334155, #1e293b)`,
                      overflow: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#fff', fontWeight: 800, fontSize: 16,
                      boxShadow: '0 2px 10px rgba(0,0,0,0.14)',
                    }}>
                      {s.logo_url
                        ? <img src={s.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (s.name?.[0] || 'S').toUpperCase()}
                    </div>
                  </div>

                  <div style={{ padding: '6px 12px 12px', display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'center', textAlign: 'center', flex: 1 }}>
                    <div style={{
                      fontSize: 13.5, fontWeight: 800, color: T.gray900, lineHeight: 1.25,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%',
                    }}>
                      {s.name}
                    </div>
                    <div style={{ fontSize: 11, color: T.gray600, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                      {s.category || 'Shop'}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: T.gray700, marginTop: 2 }}>
                      {Icon.star(11)}
                      <span style={{ fontWeight: 700 }}>{s.rating ? Number(s.rating).toFixed(1) : 'New'}</span>
                      {s.review_count > 0 && <span style={{ color: T.gray500 }}>({s.review_count})</span>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: T.gray500, marginTop: 1 }}>
                      {Icon.pin(10)} {s.city || 'Malawi'}
                      <span style={{ color: T.gray300 }}>·</span>
                      {s.listing_count || 0} products
                    </div>
                  </div>
                </button>
              ))}

              <button
                type="button"
                className="soko-shop-card-home"
                onClick={() => navigate('/shop-setup')}
                style={{
                  border: `2px dashed ${T.gray200}`,
                  background: T.gray50,
                  boxShadow: 'none',
                  minHeight: 220,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <div style={{ textAlign: 'center', padding: 16 }}>
                  <div style={{
                    width: 42, height: 42, borderRadius: '50%', background: T.amberL,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    margin: '0 auto 10px', color: T.amberD,
                  }}>
                    {Icon.plus(18)}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: T.gray800, marginBottom: 4 }}>Open a shop</div>
                  <div style={{ fontSize: 11, color: T.gray600, lineHeight: 1.4 }}>Reach buyers nationwide</div>
                </div>
              </button>
            </div>
          ) : (
            <EmptyMini text="No shops yet — open the first one." cta="Create My Shop" onClick={() => navigate('/shop-setup')} />
          )}
        </div>

        {/* ── Jobs ── */}
        <div className="soko-sjs-block">
          <div className="soko-sjs-head">
            <h2 className="soko-sjs-title">Jobs</h2>
            <button type="button" className="soko-sjs-link" onClick={() => navigate('/jobs')}>
              View all {Icon.chevR(14)}
            </button>
          </div>
          {loading ? (
            <div className="soko-sjs-rail">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ flexShrink: 0, width: 220, height: 160, borderRadius: 14 }} />
              ))}
            </div>
          ) : jobs.length > 0 ? (
            <div ref={jobsRail} className="soko-sjs-rail">
              {jobs.map(j => (
                <HomeWorkCard
                  key={j.id}
                  title={j.title}
                  sub={[j.company, j.type || 'Full-time', j.salary].filter(Boolean).join(' · ')}
                  meta={j.city || 'Malawi'}
                  image={j.cover_image_url || j.logo_url || null}
                  fallbackIcon={Icon.briefcase(28)}
                  accentBg={T.blueL}
                  accentFg={T.blue}
                  onClick={() => navigate(`/jobs?job=${j.id}`)}
                />
              ))}
            </div>
          ) : (
            <EmptyMini text="No jobs posted yet." cta="Post a Job" onClick={() => navigate('/jobs')} />
          )}
        </div>

        {/* ── Services ── */}
        <div className="soko-sjs-block">
          <div className="soko-sjs-head">
            <h2 className="soko-sjs-title">Services</h2>
            <button type="button" className="soko-sjs-link" onClick={() => navigate('/services')}>
              View all {Icon.chevR(14)}
            </button>
          </div>
          {loading ? (
            <div className="soko-sjs-rail">
              {[1, 2, 3].map(i => (
                <div key={i} className="skeleton" style={{ flexShrink: 0, width: 220, height: 160, borderRadius: 14 }} />
              ))}
            </div>
          ) : services.length > 0 ? (
            <div ref={servicesRail} className="soko-sjs-rail">
              {services.map(s => (
                <HomeWorkCard
                  key={s.id}
                  title={s.name}
                  sub={[s.category || 'Service', s.rate].filter(Boolean).join(' · ')}
                  meta={s.city || 'Malawi'}
                  image={(Array.isArray(s.media_urls) ? s.media_urls[0] : null) || null}
                  fallbackIcon={Icon.wrench(28)}
                  accentBg={T.violetL}
                  accentFg={T.violet}
                  onClick={() => navigate(`/services?service=${s.id}`)}
                />
              ))}
            </div>
          ) : (
            <EmptyMini text="No services listed yet." cta="Offer a Service" onClick={() => navigate('/services')} />
          )}
        </div>
      </div>
    </section>
  )
}

function EmptyMini({ text, cta, onClick }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 16px', border: `1.5px dashed ${T.gray200}`, borderRadius: 14 }}>
      <p style={{ fontSize: 13, color: T.gray600, marginBottom: 10 }}>{text}</p>
      <button onClick={onClick} style={{ background: T.gray900, color: '#fff', border: 'none', borderRadius: 10, padding: '7px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{cta}</button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   SELL BANNER — compact single-shot strip (~160px)
───────────────────────────────────────────────────────────────────────────── */

const BOTTOM_BANNER_CSS = `
  .soko-bb {
    max-width: 1400px;
    margin: 0 auto;
    border-radius: 18px;
    overflow: hidden;
    position: relative;
    /* Target height: marketing strips should stay ~140–180px desktop */
    min-height: 0;
    box-shadow: 0 12px 32px rgba(0,0,0,0.18);
  }
  .soko-bb-inner {
    position: relative;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 16px 24px;
    padding: 18px 22px;
    min-height: 148px;
  }
  .soko-bb-copy {
    flex: 1 1 280px;
    min-width: 0;
  }
  .soko-bb-eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border-radius: 999px;
    padding: 3px 10px 3px 7px;
    font-size: 10.5px;
    font-weight: 800;
    letter-spacing: 0.5px;
    text-transform: uppercase;
    margin-bottom: 8px;
  }
  .soko-bb-title {
    font-family: ${T.fontDisplay};
    font-size: clamp(18px, 2.1vw, 24px);
    font-weight: 800;
    letter-spacing: -0.45px;
    line-height: 1.18;
    margin: 0 0 4px;
    color: #fff;
  }
  .soko-bb-title em {
    font-style: normal;
  }
  .soko-bb-sub {
    font-size: 12.5px;
    line-height: 1.4;
    margin: 0 0 12px;
    color: rgba(255,255,255,0.72);
    font-weight: 500;
    max-width: 420px;
  }
  .soko-bb-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .soko-bb-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    border-radius: 11px;
    padding: 9px 16px;
    font-size: 13px;
    font-weight: 800;
    font-family: inherit;
    cursor: pointer;
    min-height: 40px;
    border: none;
    transition: transform 0.12s, box-shadow 0.12s, background 0.12s;
  }
  .soko-bb-btn:hover { transform: translateY(-1px); }
  .soko-bb-btn:active { transform: scale(0.98); }
  .soko-bb-btn-light {
    background: #fff;
    color: ${T.gray900};
    box-shadow: 0 4px 14px rgba(0,0,0,0.15);
  }
  .soko-bb-btn-gold {
    background: linear-gradient(135deg, ${T.amber}, #e09800);
    color: #1a0a00;
    box-shadow: 0 6px 18px rgba(249,171,0,0.35);
  }
  .soko-bb-btn-ghost {
    background: rgba(255,255,255,0.08);
    color: #fff;
    border: 1.5px solid rgba(255,255,255,0.22);
  }
  .soko-bb-side {
    flex: 0 1 auto;
    display: flex;
    align-items: stretch;
    gap: 8px;
    flex-wrap: wrap;
    justify-content: flex-end;
    max-width: 52%;
  }
  .soko-bb-stat {
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.12);
    border-radius: 12px;
    padding: 10px 12px;
    min-width: 96px;
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
  }
  .soko-bb-stat-num {
    font-family: ${T.fontDisplay};
    font-size: 17px;
    font-weight: 800;
    color: #fff;
    letter-spacing: -0.3px;
    line-height: 1.1;
  }
  .soko-bb-stat-lbl {
    font-size: 10.5px;
    font-weight: 600;
    color: rgba(255,255,255,0.58);
    margin-top: 2px;
    white-space: nowrap;
  }
  .soko-bb-cta-card {
    background: rgba(0,0,0,0.22);
    border: 1px solid rgba(255,255,255,0.14);
    border-radius: 14px;
    padding: 12px 14px;
    display: flex;
    align-items: center;
    gap: 12px;
    min-width: 220px;
    max-width: 280px;
    backdrop-filter: blur(10px);
    -webkit-backdrop-filter: blur(10px);
  }
  .soko-bb-cta-card p {
    margin: 0;
    font-size: 11.5px;
    color: rgba(255,255,255,0.62);
    line-height: 1.35;
    font-weight: 500;
  }
  .soko-bb-cta-card strong {
    display: block;
    font-size: 13px;
    font-weight: 800;
    color: #fff;
    margin-bottom: 2px;
  }
  @media (max-width: 900px) {
    .soko-bb-inner {
      flex-direction: column;
      align-items: stretch;
      padding: 16px 14px;
      min-height: 0;
      gap: 12px;
    }
    .soko-bb-side {
      max-width: 100%;
      justify-content: flex-start;
    }
    .soko-bb-stat { flex: 1 1 0; min-width: 0; }
    .soko-bb-cta-card {
      width: 100%;
      max-width: none;
      flex-wrap: wrap;
    }
    .soko-bb-actions { width: 100%; }
    .soko-bb-btn { flex: 1 1 auto; }
    .soko-bb-title { font-size: 18px !important; }
    .soko-bb-sub { margin-bottom: 10px; font-size: 12px; }
  }
`

function SellCtaBanner({ navigate }) {
  const perks = [
    { label: 'Free to list', icon: Icon.plus },
    { label: 'Nationwide', icon: Icon.pin },
    { label: '0% fees', icon: Icon.check },
    { label: 'In-app chat', icon: Icon.chat },
  ]

  return (
    <section className="soko-sell-cta" style={{ padding: '8px 20px 28px', background: '#0a0f0c' }}>
      <style>{BOTTOM_BANNER_CSS}</style>
      <div
        className="soko-bb"
        style={{
          background: `
            radial-gradient(ellipse 45% 100% at 0% 50%, rgba(15,157,88,0.35) 0%, transparent 55%),
            radial-gradient(ellipse 40% 90% at 100% 20%, rgba(249,171,0,0.22) 0%, transparent 50%),
            linear-gradient(105deg, #03140b 0%, #063d23 45%, #0a2818 100%)
          `,
          boxShadow: '0 0 0 1px rgba(255,255,255,0.06), 0 16px 40px rgba(0,0,0,0.35)',
        }}
      >
        <div className="soko-bb-inner">
          <div className="soko-bb-copy">
            <div className="soko-bb-eyebrow" style={{
              background: 'rgba(249,171,0,0.16)',
              color: T.amber,
              border: '1px solid rgba(249,171,0,0.35)',
            }}>
              {Icon.lightning(11)} Free forever · 0% commission
            </div>
            <h2 className="soko-bb-title">
              Have something to{' '}
              <em style={{
                background: `linear-gradient(90deg, ${T.amber}, #ffe08a)`,
                WebkitBackgroundClip: 'text', backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}>
                sell?
              </em>
            </h2>
            <p className="soko-bb-sub">
              List in minutes, chat with buyers, keep 100% of what you earn.
            </p>
            <div className="soko-bb-actions">
              <button type="button" className="soko-bb-btn soko-bb-btn-gold" onClick={() => navigate('/post')}>
                Sell Now {Icon.chevR(14)}
              </button>
              <button type="button" className="soko-bb-btn soko-bb-btn-ghost" onClick={() => navigate('/listings')}>
                See listings
              </button>
            </div>
          </div>

          <div className="soko-bb-side">
            {perks.map(p => (
              <div key={p.label} className="soko-bb-stat" style={{ minWidth: 88, textAlign: 'center', padding: '10px 10px' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8, margin: '0 auto 6px',
                  background: 'rgba(249,171,0,0.18)', color: T.amber,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {p.icon(14)}
                </div>
                <div className="soko-bb-stat-lbl" style={{ color: 'rgba(255,255,255,0.85)', fontWeight: 700, whiteSpace: 'normal', lineHeight: 1.25 }}>
                  {p.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   FOOTER
───────────────────────────────────────────────────────────────────────────── */
function SokoFooter({ navigate }) {
  const links = {
    'Marketplace': [['Buy Listings','/'],['Sell Now','/post'],['Categories','/'],['Shops','/shops'],['Looking For','/looking-for']],
    'Work':        [['Jobs','/jobs'],['Services','/services'],['Stories','/status'],['Verification','/profile']],
    'Company':     [['About SokoMW','/'],['Contact Us','/'],['Help Center','/']],
    'Legal':       [['Privacy Policy','/'],['Terms of Service','/'],['Safety Tips','/'],['Report Abuse','/']],
  }
  return (
    <footer className="soko-footer" style={{ background: '#0d1410', color: 'rgba(255,255,255,0.7)', padding: 'clamp(32px,5vw,56px) 20px 28px' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div className="soko-footer-grid" style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr', gap: 36, marginBottom: 40 }}>
          <div>
            <div style={{ fontFamily: T.fontDisplay, fontSize: 24, fontWeight: 800, color: T.green, marginBottom: 10, letterSpacing: '-0.5px' }}>
              Soko<span style={{ color: T.amber }}>MW</span>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: 'rgba(255,255,255,0.5)', maxWidth: 240 }}>
              Connecting buyers and sellers across Malawi — no payments processed on the platform, you deal directly.
            </p>
          </div>
          {Object.entries(links).map(([group, items]) => (
            <div key={group}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>{group}</div>
              <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 9 }}>
                {items.map(([label, path]) => (
                  <li key={label}><span onClick={() => navigate(path)} style={{ fontSize: 13, color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.color = '#fff'} onMouseLeave={e => e.currentTarget.style.color = 'rgba(255,255,255,0.5)'}
                  >{label}</span></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.35)' }}>© 2026 SokoMW. All rights reserved. Made in Malawi 🇲🇼</div>
        </div>
      </div>
    </footer>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   EARLY ACCESS STRIP
───────────────────────────────────────────────────────────────────────────── */
function EarlyAccessStrip() {
  const [vis, setVis] = useState(true)
  if (!vis) return null
  return (
    <div className="soko-early-access" style={{ background: 'linear-gradient(90deg, #f59e0b11, #f59e0b22, #f59e0b11)', borderBottom: `1px solid ${T.amber}44`, padding: '9px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={T.amberD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 3h6l1 8H8L9 3z"/><path d="M6.5 11l-2 7a1 1 0 0 0 1 1.3h9a1 1 0 0 0 1-1.3l-2-7"/><line x1="10" y1="7" x2="10" y2="11"/><line x1="14" y1="7" x2="14" y2="11"/></svg>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: T.amberD }}>Early access — you're testing SokoMW. Official launch date coming soon.</span>
      <button onClick={() => setVis(false)} style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', color: T.amberD, display: 'flex', alignItems: 'center' }}>{Icon.x(12)}</button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   MAIN HOME COMPONENT
   Mobile bottom nav is mounted once in App.jsx (Home / Explore / Sell / Chats / Profile).
───────────────────────────────────────────────────────────────────────────── */
export default function Home() {
  const navigate = useNavigate()

  // ── Auth & listings (preserved from prior version) ───────
  const [listings,   setListings]   = useState([])
  // Phase 3.1 — dedicated active featured pool (featured_until > now), not recent posts
  const [featuredListings, setFeaturedListings] = useState([])
  const [loading,    setLoading]    = useState(true)

  // Phase 3.2 — re-rotate featured order every 30s (equal product inclusion)
  useEffect(() => {
    const t = setInterval(() => {
      setFeaturedListings(prev => {
        if (!prev?.length) return prev
        return rotateFeaturedFairly(prev, {
          intervalMs: 30_000,
          maxPerSeller: Number.POSITIVE_INFINITY,
        })
      })
    }, 30_000)
    return () => clearInterval(t)
  }, [])
  const [user,       setUser]       = useState(null)
  const [notifCount, setNotifCount] = useState(0)
  const [unreadChats, setUnreadChats] = useState(0)
  const [search, setSearch] = useState('')
  const [imageSearchBusy, setImageSearchBusy] = useState(false)
  /**
   * Smart progressive load:
   * - Page chrome + skeletons paint immediately
   * - Thin top progress tracks real fetch stages
   * - Listings & aux sections load in parallel (not sequential)
   */
  const [loadProgress, setLoadProgress] = useState(12)
  const [showLoadBar, setShowLoadBar] = useState(true)
  const loadFlags = useRef({ auth: false, listings: false, sections: false })
  /** Set of listing ids the signed-in user has saved (listing_saves). */
  const [savedIds, setSavedIds] = useState(() => new Set())

  function handleSearch(val) {
    setSearch(val)
    if (val.trim()) {
      trackSearch(val, user?.id)
      navigate(`/search?q=${encodeURIComponent(val.trim())}`)
    }
  }

  // Load saved listings for heart state on product cards
  useEffect(() => {
    let cancelled = false
    if (!user?.id) {
      setSavedIds(new Set())
      return undefined
    }
    ;(async () => {
      try {
        const { data, error } = await supabase
          .from('listing_saves')
          .select('listing_id')
          .eq('user_id', user.id)
          .limit(500)
        if (cancelled || error) return
        setSavedIds(new Set((data || []).map(r => r.listing_id).filter(Boolean)))
      } catch { /* table may not exist on older envs */ }
    })()
    return () => { cancelled = true }
  }, [user?.id])

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
    // Optimistic UI
    setSavedIds(prev => {
      const next = new Set(prev)
      if (wasSaved) next.delete(listingId)
      else next.add(listingId)
      return next
    })
    try {
      const { data, error } = await supabase.rpc('toggle_listing_save', { p_listing_id: listingId })
      if (error) throw error
      // RPC returns true when now saved, false when removed
      setSavedIds(prev => {
        const next = new Set(prev)
        if (data === true) next.add(listingId)
        else if (data === false) next.delete(listingId)
        return next
      })
    } catch {
      // Revert on failure
      setSavedIds(prev => {
        const next = new Set(prev)
        if (wasSaved) next.add(listingId)
        else next.delete(listingId)
        return next
      })
    }
  }

  const [activeCategory, setActiveCategory] = useState('All')
  function handleCategoryChange(cat) { setActiveCategory(cat) }
  const [activeDistrict, setActiveDistrict] = useState('All Districts')
  const [homeGpsLocation, setHomeGpsLocation] = useState(null)

  // ── New sections' data ────────────────────────────────────
  const [shops,    setShops]    = useState([])
  const [jobs,     setJobs]     = useState([])
  const [services, setServices] = useState([])
  const [requests, setRequests] = useState([])
  const [sectionsLoading, setSectionsLoading] = useState(true)

  // Boot GPS early (same reverse-geocode as Looking For page)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const cached = sessionStorage.getItem('soko_gps_location')
        if (cached) {
          const parsed = JSON.parse(cached)
          if (parsed?.lat != null || parsed?.district) {
            if (!cancelled) setHomeGpsLocation(parsed)
          }
        }
      } catch { /* ignore */ }
      const gps = await getGPSLocation()
      if (cancelled || !gps) return
      setHomeGpsLocation(gps)
      try {
        sessionStorage.setItem('soko_gps_location', JSON.stringify(gps))
        if (gps.lat != null && gps.lng != null) {
          sessionStorage.setItem('userCoords', JSON.stringify({ lat: gps.lat, lng: gps.lng }))
        }
      } catch { /* ignore */ }
      // Optionally align district filter with GPS when still on "All"
      if (gps.district && activeDistrict === 'All Districts') {
        // Don't auto-force filter — only store location for ranking
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])


  // ── Stories (compact LiveStoriesCard + viewer/upload) ─────
  const [stories, setStories] = useState([])
  const [storiesLoading, setStoriesLoading] = useState(true)

  // ── Animation / location (preserved) ──────────────────────
  const [isFocused, setIsFocused] = useState(false)
  const { animKeywords, animIdx } = useSearchAnimation({ listings, search, isFocused })
  const { lat: userLat, lng: userLng } = useUserLocation()

  useEffect(() => { init() }, [])

  const isFirstDistrictRender = useRef(true)
  useEffect(() => {
    if (isFirstDistrictRender.current) {
      isFirstDistrictRender.current = false
      return
    }
    loadListings()
    loadAuxSections()
  }, [activeDistrict])

  // Stories: fetch + realtime subscription, same pattern HomeStatusRow uses
  // internally — replicated here (rather than reused) because the compact
  // LiveStoriesCard needs the raw story list, not HomeStatusRow's own
  // internal state.
  useEffect(() => {
    if (!user?.id) { setStoriesLoading(false); return }
    let ch
    setStoriesLoading(true)
    fetchAllActiveStories(user.id, 'All').then(data => { setStories(data); setStoriesLoading(false) })

    ch = supabase.channel(`home-live-stories-${user.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'user_statuses' }, () => {
        fetchAllActiveStories(user.id, 'All').then(setStories)
      })
      .subscribe()
    return () => { if (ch) supabase.removeChannel(ch) }
  }, [user?.id])

  function handleCreateStory() {
    if (!user) { navigate('/login'); return }
  }

  /** Map completed stages → progress % (auth 28, listings 68, sections 100) */
  function bumpLoadProgress(flag) {
    loadFlags.current[flag] = true
    const { auth, listings, sections } = loadFlags.current
    let p = 12
    if (auth) p = 28
    if (listings) p = Math.max(p, 68)
    if (sections) p = 100
    // If both data stages done without auth race, still complete
    if (listings && sections) p = 100
    setLoadProgress(prev => Math.max(prev, p))
  }

  // Hide progress bar after both primary streams settle
  useEffect(() => {
    if (loading || sectionsLoading) return undefined
    setLoadProgress(100)
    const t = setTimeout(() => setShowLoadBar(false), 420)
    return () => clearTimeout(t)
  }, [loading, sectionsLoading])

  // Safety: never leave the bar stuck
  useEffect(() => {
    const t = setTimeout(() => {
      setLoadProgress(100)
      setShowLoadBar(false)
      setLoading(false)
      setSectionsLoading(false)
    }, 8000)
    return () => clearTimeout(t)
  }, [])

  async function init() {
    // Kick data fetches immediately in parallel — don't wait for profile enrichment
    const listingsPromise = loadListings()
    const sectionsPromise = loadAuxSections()

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // Profile enrichment in parallel with marketplace data
        const [profileRes, shopRes] = await Promise.all([
          supabase.from('profiles')
            .select('id, avatar_url, full_name, city, account_type, is_verified').eq('id', user.id).maybeSingle(),
          supabase.from('shops')
            .select('id, slug, name, is_verified').eq('owner_id', user.id).maybeSingle(),
        ])
        const profile = profileRes.data
        const shop = shopRes.data
        setUser({
          ...user,
          avatar_url: profile?.avatar_url || null,
          account_type: profile?.account_type,
          shop_slug: shop?.slug || null,
          is_verified: !!(profile?.is_verified || shop?.is_verified),
        })
        loadNotifs(user.id)
        loadUnreadChats(user.id)
      }
    } catch { /* auth optional for browsing */ }
    bumpLoadProgress('auth')

    await Promise.all([listingsPromise, sectionsPromise])
  }

  async function loadListings() {
    setLoading(true)
    try {
      // Phase 3.1 — featured discovery is a dedicated query only (featured_until > now).
      // Recent posts feed is separate and never used as the featured source.
      const LISTING_SELECT =
        'id, title, price, price_type, images, city, category, condition, featured, is_featured, featured_until, flash_sale_price, flash_sale_expires_at, promo_badge, bulk_pricing, stock_qty, created_at, seller_id, shop_id, latitude, longitude, status, description, tags, contact_methods, call_number'
      const nowIso = new Date().toISOString()
      // Live listings may be `published` or `active` depending on env/admin path
      const LIVE = ['published', 'active']
      // Fetch only what Home can show cleanly (not 60 that stack via Show more)
      const FEATURED_FETCH = FEATURED_HOME_CAP
      const LATEST_FETCH = HOME_LATEST_COUNT + FEATURED_HOME_CAP + 8

      let featuredQuery = supabase
        .from('listings')
        .select(LISTING_SELECT)
        .in('status', LIVE)
        .gt('featured_until', nowIso)
      let recentQuery = supabase
        .from('listings')
        .select(LISTING_SELECT)
        .in('status', LIVE)

      if (activeDistrict !== 'All Districts') {
        featuredQuery = featuredQuery.eq('city', activeDistrict)
        recentQuery = recentQuery.eq('city', activeDistrict)
      }

      featuredQuery = featuredQuery.order('featured_until', { ascending: false }).limit(FEATURED_FETCH)
      recentQuery = recentQuery.order('created_at', { ascending: false }).limit(LATEST_FETCH)

      const [{ data: featuredRows }, { data: recentRows }] = await Promise.all([featuredQuery, recentQuery])

      async function enrichListingRows(rows) {
        let withShopRatings = rows || []
        const shopIds = [...new Set(withShopRatings.map(l => l.shop_id).filter(Boolean))]
        const sellerIds = [...new Set(withShopRatings.map(l => l.seller_id).filter(Boolean))]

        if (shopIds.length > 0) {
          const { data: shopsData } = await supabase.from('shops').select('id, rating, review_count, is_verified').in('id', shopIds)
          const shopMap = {}
          shopsData?.forEach(s => { shopMap[s.id] = s })
          withShopRatings = withShopRatings.map(l => ({
            ...l,
            shop_rating: l.shop_id ? shopMap[l.shop_id]?.rating : null,
            shop_review_count: l.shop_id ? shopMap[l.shop_id]?.review_count : null,
            shop_is_verified: l.shop_id ? shopMap[l.shop_id]?.is_verified : false,
          }))
        }
        if (sellerIds.length > 0) {
          const { data: profilesData } = await supabase.from('profiles').select('id, is_verified').in('id', sellerIds)
          const profileMap = {}
          profilesData?.forEach(p => { profileMap[p.id] = p })
          withShopRatings = withShopRatings.map(l => ({
            ...l,
            seller_verified: l.seller_id ? profileMap[l.seller_id]?.is_verified : false,
          }))
        }

        let blocked = []
        try { blocked = JSON.parse(localStorage.getItem('soko_blocked_shops') || '[]') } catch { /* ignore */ }
        const blockedStr = blocked.map(id => String(id))
        if (blockedStr.length === 0) return withShopRatings
        return withShopRatings.filter(l => !l.shop_id || !blockedStr.includes(String(l.shop_id)))
      }

      const [featuredEnriched, recentEnriched] = await Promise.all([
        enrichListingRows(featuredRows || []),
        enrichListingRows(recentRows || []),
      ])

      // Featured section: dedicated query + equal product rotation (Phase 3.2)
      setFeaturedListings(
        rotateFeaturedFairly(
          featuredEnriched.filter(l => isListingFeatured(l)),
          { intervalMs: 30_000, maxPerSeller: Number.POSITIVE_INFINITY },
        ),
      )

      // Latest / general feed: recent posts only (not used for featured discovery)
      const { data: { user: authUser } } = await supabase.auth.getUser()
      const sorted = await sortProductsSmart(recentEnriched, userLat, userLng, authUser?.id)
      setListings(sorted)
    } catch (e) {
      console.error('loadListings:', e)
    } finally {
      setLoading(false)
      bumpLoadProgress('listings')
    }
  }

  // Auxiliary sections: shops, jobs, services, looking-for requests, trust
  // stats. Each query is wrapped so a missing table (e.g. on a fresh DB, or
  // if a table name differs) can't crash the homepage — it just renders the
  // section's empty state instead.
  async function loadAuxSections() {
    setSectionsLoading(true)
    try {
    await Promise.all([
      (async () => {
        try {
          let shopsQuery = supabase.from('shops')
            .select('id, name, slug, category, logo_url, cover_url, city, rating, review_count, listing_count, is_verified, follower_count')
            .eq('is_active', true)
          if (activeDistrict !== 'All Districts') shopsQuery = shopsQuery.eq('city', activeDistrict)
          const { data, error } = await shopsQuery
            .order('follower_count', { ascending: false, nullsFirst: false })
            .limit(8)
          if (error) console.error('shops query error:', error)
          setShops(data || [])
        } catch (e) { console.error('shops catch:', e); setShops([]) }
      })(),
      (async () => {
        try {
          // Jobs use status 'active' (PostJobForm / Jobs index) — not 'published'
          const today = new Date().toISOString().split('T')[0]
          const jobSelect = 'id, title, company, city, type, created_at, deadline, cover_image_url, logo_url, salary'
          let jobsQuery = supabase.from('jobs')
            .select(jobSelect)
            .eq('status', 'active')
            .or(`deadline.is.null,deadline.gte.${today}`)
          if (activeDistrict !== 'All Districts') jobsQuery = jobsQuery.eq('city', activeDistrict)
          let { data, error } = await jobsQuery
            .order('created_at', { ascending: false })
            .limit(8)
          if (error && /cover_image_url|logo_url|salary|column/i.test(error.message || '')) {
            ;({ data, error } = await supabase.from('jobs')
              .select('id, title, company, city, type, created_at, deadline')
              .eq('status', 'active')
              .or(`deadline.is.null,deadline.gte.${today}`)
              .order('created_at', { ascending: false })
              .limit(8))
          }
          // Fallback: include published if any legacy rows use that status
          if (!error && (!data || data.length === 0)) {
            const alt = await supabase.from('jobs')
              .select(jobSelect)
              .in('status', ['active', 'published'])
              .or(`deadline.is.null,deadline.gte.${today}`)
              .order('created_at', { ascending: false })
              .limit(8)
            if (!alt.error && alt.data?.length) data = alt.data
            else if (alt.error && /cover_image_url|logo_url|salary|column/i.test(alt.error.message || '')) {
              const bare = await supabase.from('jobs')
                .select('id, title, company, city, type, created_at, deadline')
                .in('status', ['active', 'published'])
                .or(`deadline.is.null,deadline.gte.${today}`)
                .order('created_at', { ascending: false })
                .limit(8)
              if (!bare.error) data = bare.data
            }
          }
          if (error) console.error('jobs query error:', error)
          setJobs(data || [])
        } catch (e) { console.error('jobs catch:', e); setJobs([]) }
      })(),
      (async () => {
        try {
          // Services use status 'active' (ServiceForm / ServicesPage) — not 'published'
          let servicesQuery = supabase.from('services')
            .select('id, name, category, city, created_at, media_urls, rate, rating, verified')
            .eq('status', 'active')
          if (activeDistrict !== 'All Districts') servicesQuery = servicesQuery.eq('city', activeDistrict)
          let { data, error } = await servicesQuery
            .order('created_at', { ascending: false })
            .limit(8)
          if (error && /media_urls|rate|rating|verified|column/i.test(error.message || '')) {
            ;({ data, error } = await supabase.from('services')
              .select('id, name, category, city, created_at, media_urls, rate')
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(8))
          }
          if (error && /media_urls|rate|column/i.test(error.message || '')) {
            ;({ data, error } = await supabase.from('services')
              .select('id, name, category, city, created_at')
              .eq('status', 'active')
              .order('created_at', { ascending: false })
              .limit(8))
          }
          if (!error && (!data || data.length === 0)) {
            const alt = await supabase.from('services')
              .select('id, name, category, city, created_at, media_urls, rate')
              .in('status', ['active', 'published'])
              .order('created_at', { ascending: false })
              .limit(8)
            if (!alt.error && alt.data?.length) data = alt.data
          }
          if (error) console.error('services query error:', error)
          setServices(data || [])
        } catch (e) { console.error('services catch:', e); setServices([]) }
      })(),
      (async () => {
        try {
          let { data, error } = await supabase.from('buyer_requests')
            .select('id, title, description, category, city, cities, created_at, budget, offer_count, view_count, urgency, image_url, image_urls, expires_at, lat, lng, user_id')
            .not('status', 'eq', 'fulfilled')
            .order('created_at', { ascending: false })
            .limit(40)
          if (error && /lat|lng|column/i.test(error.message || '')) {
            ;({ data } = await supabase.from('buyer_requests')
              .select('id, title, description, category, city, cities, created_at, budget, offer_count, view_count, urgency, image_url, image_urls, expires_at, user_id, profiles:user_id(full_name,avatar_url,is_verified)')
              .not('status', 'eq', 'fulfilled')
              .order('created_at', { ascending: false })
              .limit(40))
          }
          setRequests(data || [])
        } catch { setRequests([]) }
      })(),
    ])
    } catch (e) {
      console.error('loadAuxSections:', e)
    } finally {
      setSectionsLoading(false)
      bumpLoadProgress('sections')
    }
  }

  async function loadNotifs(uid) {
    try {
      const { count } = await supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('read', false)
      setNotifCount(count || 0)
    } catch {}
  }

  async function loadUnreadChats(uid) {
    try {
      const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('to_user', uid).eq('read', false)
      setUnreadChats(count || 0)
    } catch {}
  }

  // ── Image search (preserved hook point — wire in existing handler) ──
  async function handleImageFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''

    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.')
      return
    }
    if (file.size > 8 * 1024 * 1024) {
      alert('Image is too large — please choose one under 8MB.')
      return
    }

    setImageSearchBusy(true)
    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result.split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(file)
      })

      const { data, error } = await supabase.functions.invoke('image-search', {
        body: { base64, mediaType: file.type },
      })

      if (error) throw error
      const term = data?.term
      if (!term) {
        alert('Could not identify the item in that photo — try a clearer image.')
        return
      }
      navigate(`/search?q=${encodeURIComponent(term)}`)
    } catch (err) {
      console.error('image search failed:', err)
      alert('Image search failed. Please try again.')
    } finally {
      setImageSearchBusy(false)
    }
  }

  const pageBusy = loading || sectionsLoading

  // Dedupe: don't re-stack the same featured products in Latest
  const featuredIdSet = useMemo(
    () => new Set((featuredListings || []).map(l => l.id).filter(Boolean)),
    [featuredListings],
  )

  return (
    <div className="soko-v3">
      <GlobalStyles />

      {/* Deterministic top progress — tracks real fetch stages, never blocks the page */}
      {(showLoadBar || pageBusy) && (
        <div
          className={`soko-loadbar${!pageBusy && loadProgress >= 100 ? ' is-done' : ''}`}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(loadProgress)}
          aria-label="Loading marketplace"
        >
          <div className="soko-loadbar-track">
            <div className="soko-loadbar-fill" style={{ width: `${Math.min(100, loadProgress)}%` }} />
          </div>
        </div>
      )}

      {/* Chrome first — interactive immediately while data streams in */}
     <SokoNav
  user={user} notifCount={notifCount} search={search} setSearch={handleSearch}
  navigate={navigate} onImageFile={handleImageFile} animKeywords={animKeywords} animIdx={animIdx}
  activeDistrict={activeDistrict} onDistrictChange={setActiveDistrict} onFocusChange={setIsFocused}
  activePillar="marketplace"
  ctaLabel="Sell Now"
  onCta={() => navigate('/post')}
  imageSearchBusy={imageSearchBusy}
/>
      {user?.id && (
        <div className="soko-settle soko-settle-d1">
          <VerificationAttentionBanner userId={user.id} />
        </div>
      )}

      <div className="soko-settle soko-settle-d2">
        <EarlyAccessStrip />
      </div>

      {/* Static / local sections paint immediately */}
      <div className="soko-settle soko-settle-d2">
        <AdHeroBanner navigate={navigate} />
      </div>

      <div className="soko-settle soko-settle-d3">
        <CategoryGrid navigate={navigate} onCategoryChange={handleCategoryChange} />
      </div>

      <div className="soko-settle soko-settle-d3">
        <FeaturedRevenueBanner navigate={navigate} user={user} />
      </div>

      {/* Data sections: skeleton in place → content swap (no remount keys — those stacked thrash) */}
      <div className={!loading ? 'soko-swap-in' : undefined}>
        <FeaturedListingsRow
          listings={featuredListings} navigate={navigate} loading={loading}
          user={user}
          savedIds={savedIds}
          onToggleSave={toggleListingSave}
        />
      </div>

      <div className={!storiesLoading ? 'soko-swap-in' : undefined}>
        <HomeStatusSection
          navigate={navigate}
          stories={stories}
          loading={storiesLoading}
          onCreateStory={handleCreateStory}
          currentUserId={user?.id}
        />
      </div>

      <div className={!loading ? 'soko-swap-in' : undefined}>
        <LatestListingsSection
          listings={listings}
          navigate={navigate}
          loading={loading}
          user={user}
          savedIds={savedIds}
          onToggleSave={toggleListingSave}
          excludeIds={featuredIdSet}
        />
      </div>

      <div className={!sectionsLoading ? 'soko-swap-in' : undefined}>
        <LookingForSection
          navigate={navigate}
          requests={requests}
          loading={sectionsLoading}
          userLat={userLat}
          userLng={userLng}
          activeDistrict={activeDistrict}
          viewerLocation={homeGpsLocation}
        />
      </div>

      <div className={!sectionsLoading ? 'soko-swap-in' : undefined}>
        <ShopsJobsServicesRow navigate={navigate} shops={shops} jobs={jobs} services={services} loading={sectionsLoading} />
      </div>

      <div className="soko-settle soko-settle-d8">
        <SellCtaBanner navigate={navigate} />
      </div>

      <SokoFooter navigate={navigate} />

      {/* Mobile bottom nav: mounted once in App.jsx (Home / Explore / Sell / Chats / Profile) */}


    </div>
  )
}