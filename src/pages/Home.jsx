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
 */

import React, {
  useEffect, useState, useMemo, useRef,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase }              from '../lib/supabase'
import useSearchAnimation        from '../hooks/useSearchAnimation'
import { useUserLocation }       from '../hooks/useUserLocation'
import { fetchAllActiveStories } from '../hooks/useStatuses'
import StoryViewer                from '../components/StoryViewer'
import StatusUploadModal          from '../components/StatusUploadModal'
import VerificationAttentionBanner from '../components/VerificationAttentionBanner'
import {
  ALL_CATEGORIES,
} from '../constants/homeConstants'
import {
  isFlashActive, isListingFeatured, rotateFeaturedFairly, sortProductsSmart, trackSearch,
} from '../utils/homeUtils'
import {
  FEATURED_DURATION_DAYS,
  FEATURED_PRICE_MWK,
} from '../constants/featuredPricing'

/* ─────────────────────────────────────────────────────────────────────────────
   DESIGN TOKENS
   Kept the established SokoMW identity (deep green + gold — already brand
   equity from the broadcast emails / verification badges) rather than
   introducing a new palette. Sora/Inter pairing kept for the same reason.
───────────────────────────────────────────────────────────────────────────── */
const T = {
  green:   '#0F9D58',
  greenD:  '#0a7a44',
  greenDk: '#063d23',   // deep green for hero/dark surfaces
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
  gray500: '#9aa0a6',
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
  Property:    { emoji: '🏡', bg: '#f0fdf4', fg: '#16a34a' },
  Clothing:    { emoji: '👔', bg: '#fdf4ff', fg: '#9333ea' },
  Agriculture: { emoji: '🌿', bg: '#f0fdf4', fg: '#15803d' },
  Furniture:   { emoji: '🛋️', bg: '#fffbeb', fg: '#d97706' },
  Food:        { emoji: '🍜', bg: '#fff1f2', fg: '#e11d48' },
  Services:    { emoji: '⚡', bg: '#f0fdf4', fg: '#0a7a44' },
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
        background: linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%);
        background-size: 600px 100%; animation: shimmer 1.4s infinite; border-radius:10px;
      }

      .soko-tab {
        padding:8px 16px; border-radius:50px; border:1.5px solid ${T.gray200};
        background:#fff; font-size:13px; font-weight:600; color:${T.gray600};
        cursor:pointer; transition: all .15s; white-space:nowrap;
      }
      .soko-tab.active { background:${T.green} !important; border-color:${T.green} !important; color:#fff !important; box-shadow:0 2px 10px rgba(15,157,88,.3); }
      .soko-tab:hover { border-color:${T.green}; color:${T.green}; background:${T.greenL}; }

      .soko-nav-glass {
        position: sticky; top:0; z-index:100;
        backdrop-filter: blur(20px) saturate(1.8); -webkit-backdrop-filter: blur(20px) saturate(1.8);
        background: rgba(255,255,255,.92); border-bottom:1px solid rgba(0,0,0,.07);
        box-shadow: 0 1px 0 rgba(0,0,0,.04), 0 4px 20px rgba(0,0,0,.04);
      }

      .soko-pillar-link { transition: background .15s, color .15s, transform .15s; }
      .soko-pillar-link:hover { background:${T.greenL}; transform: translateY(-1px); }

      .soko-cat-tile:hover { border-color:${T.gray200} !important; box-shadow:${T.shadow}; transform: translateY(-3px); }
      .soko-cat-tile:active { transform: translateY(-1px); }

      @media (max-width: 980px) {
        .soko-hero-grid { grid-template-columns: 1fr !important; }
        .soko-hero-desktop-carousel { display: none !important; }
        .soko-hero-mobile-carousel { display: block !important; }
        .soko-trust-grid { grid-template-columns: repeat(2,1fr) !important; }
        .soko-jobs-services { grid-template-columns: 1fr 1fr !important; }
        .soko-footer-grid { grid-template-columns: 1fr 1fr !important; }
        .soko-cat-grid { grid-template-columns: repeat(5,1fr) !important; }
        .soko-featured-stories-grid { grid-template-columns: 1fr !important; }
      }
      @media (min-width: 981px) {
        .soko-hero-mobile-carousel { display: none !important; }
      }
      @media (max-width: 768px) {
        .soko-v3 {
          padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
        }
        .soko-jobs-services { grid-template-columns: 1fr !important; gap: 16px !important; }
        .soko-cat-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr)) !important;
          gap: 8px !important;
        }
        .soko-listings-grid {
          grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          gap: 10px !important;
        }
        .soko-nav-desktop { display: none !important; }
        .soko-nav-mobile  { display: flex !important; }
        .soko-pillar-row  { display: none !important; }
        .soko-hero-headline {
          font-size: clamp(22px, 6vw, 28px) !important;
          line-height: 1.2 !important;
          letter-spacing: -0.5px !important;
        }
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

        /* Hero — compact mobile fit (marketing + product rail, not a long page) */
        .soko-hero-section {
          min-height: 0 !important;
        }
        .soko-hero-fx-heavy { display: none !important; }
        .soko-hero-grid {
          padding: 12px 14px 14px !important;
          gap: 10px !important;
        }
        .soko-hero-copy {
          display: flex !important;
          flex-direction: column !important;
          gap: 0 !important;
        }
        .soko-hero-badge {
          margin-bottom: 8px !important;
          padding: 3px 10px !important;
        }
        .soko-hero-headline {
          font-size: 18px !important;
          line-height: 1.25 !important;
          letter-spacing: -0.4px !important;
          margin-bottom: 4px !important;
        }
        .soko-hero-headline br { display: none; }
        .soko-hero-sub { display: none !important; }
        .soko-hero-benefits { display: none !important; }
        .soko-hero-cta-row {
          flex-wrap: nowrap !important;
          gap: 8px !important;
          margin-top: 10px !important;
        }
        .soko-hero-cta-row .soko-btn-primary {
          flex: 1 1 auto;
          justify-content: center;
          min-height: 40px !important;
          padding: 9px 14px !important;
          font-size: 12.5px !important;
          border-radius: 12px !important;
          animation: none !important;
        }
        .soko-hero-cta-learn { display: none !important; }
        .soko-hero-mobile-carousel {
          margin-top: 2px;
          width: 100%;
          min-width: 0;
        }
        .soko-hero-mobile-head {
          margin-bottom: 8px !important;
        }
        .soko-hero-mobile-rail {
          display: flex !important;
          gap: 10px !important;
          overflow-x: auto !important;
          overflow-y: visible !important;
          padding: 6px 2px 10px !important;
          scroll-snap-type: x mandatory;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          scroll-behavior: smooth;
        }
        .soko-hero-mobile-rail::-webkit-scrollbar { display: none; }
        .soko-hero-mobile-card {
          flex: 0 0 min(196px, 58vw) !important;
          width: min(196px, 58vw) !important;
          height: 186px !important;
          scroll-snap-align: start;
          border-radius: 14px !important;
        }
        .soko-hero-mobile-card.is-active {
          transform: translateY(-2px);
          z-index: 2;
          box-shadow: 0 10px 28px rgba(0,0,0,0.42) !important;
        }
        .soko-hero-mobile-card .soko-hero-card-title {
          font-size: 12px !important;
          -webkit-line-clamp: 1 !important;
          margin-bottom: 3px !important;
        }
        /* Full prices on mobile — allow wrap, never clip with ellipsis */
        .soko-hero-mobile-card .soko-hero-card-price {
          font-size: 12.5px !important;
          line-height: 1.2 !important;
          margin-bottom: 2px !important;
          white-space: normal !important;
          overflow: visible !important;
          text-overflow: unset !important;
          word-break: break-word !important;
          letter-spacing: -0.35px !important;
        }
        .soko-hero-mobile-card .soko-hero-card-meta {
          font-size: 10px !important;
        }
        .soko-hero-mobile-card .soko-hero-card-body {
          padding: 8px 9px 10px !important;
        }
        /* Latest grid + featured rail: full price visible on phone */
        .soko-latest-card .soko-latest-price,
        .soko-featured-card-wrap .soko-card-bg {
          overflow: visible;
        }
        .soko-latest-card .soko-latest-price {
          font-size: 13px !important;
          line-height: 1.2 !important;
          white-space: normal !important;
          word-break: break-word !important;
        }
        .soko-hero-mobile-empty {
          width: 100%;
          padding: 12px !important;
        }
        .soko-hero-mobile-dots {
          display: flex;
          justify-content: center;
          flex-wrap: wrap;
          gap: 4px;
          margin-top: 2px;
          max-width: 100%;
          padding: 0;
        }

        /* Category tiles */
        .soko-cat-section {
          padding: 16px 14px 4px !important;
        }
        .soko-cat-tile {
          padding: 12px 4px 10px !important;
          border-radius: 12px !important;
          gap: 8px !important;
        }
        .soko-cat-tile > div:first-child {
          width: 40px !important;
          height: 40px !important;
        }
        .soko-cat-tile .soko-cat-sub { display: none !important; }
        .soko-cat-tile .soko-cat-label {
          font-size: 11.5px !important;
          line-height: 1.2 !important;
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
        .soko-hero-section {
          min-height: unset !important;
        }
        .soko-hero-benefits > div div {
          white-space: normal !important;
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
        .soko-featured-card-wrap {
          width: 148px !important;
        }
        .soko-featured-card-wrap .soko-card-bg {
          height: 200px !important;
        }

        /* Live stories mobile strip */
        .soko-stories-mobile {
          display: block !important;
          margin-top: 14px !important;
        }
        .soko-stories-mobile .soko-scroll {
          padding-left: 0 !important;
          padding-right: 0 !important;
          scroll-padding-inline: 0;
          gap: 10px !important;
        }

        /* Latest listings 2-col marketplace grid */
        .soko-latest-section {
          padding-left: 14px !important;
          padding-right: 14px !important;
          padding-bottom: 24px !important;
        }
        .soko-latest-card-wrap {
          width: 100% !important;
          min-width: 0 !important;
          flex-shrink: 1 !important;
        }
        .soko-latest-card .soko-latest-photo {
          height: 132px !important;
        }
        .soko-latest-card .soko-latest-body {
          padding: 10px 10px 12px !important;
          gap: 5px !important;
        }
        .soko-latest-card .soko-latest-title {
          font-size: 12.5px !important;
        }
        .soko-latest-card .soko-latest-price {
          font-size: 14.5px !important;
        }
        .soko-latest-card .soko-latest-meta {
          font-size: 10px !important;
        }
        .soko-latest-card .soko-latest-badge-stack {
          top: 8px !important;
          left: 8px !important;
          gap: 4px !important;
        }
        .soko-latest-card .soko-latest-wish {
          top: 7px !important;
          right: 7px !important;
          width: 28px !important;
          height: 28px !important;
        }

        /* Looking-for header: stack CTAs on small screens */
        .soko-lf-head {
          flex-direction: column !important;
          align-items: stretch !important;
          gap: 12px !important;
          margin-bottom: 14px !important;
        }
        .soko-lf-head-actions {
          width: 100% !important;
          align-items: stretch !important;
        }
        .soko-lf-head-actions > div {
          display: flex !important;
          flex-direction: column !important;
          gap: 8px !important;
          width: 100% !important;
        }
        .soko-lf-head-actions button {
          width: 100% !important;
          justify-content: center !important;
          min-height: 44px;
        }
        .lf3-scroll {
          margin: 0 -14px;
          padding-left: 14px !important;
          padding-right: 14px !important;
          scroll-padding-inline: 14px;
          -webkit-overflow-scrolling: touch;
        }
        .lf3-chips {
          margin: 0 -14px;
          padding-left: 14px !important;
          padding-right: 14px !important;
        }

        /* Shops / jobs / sell CTA sections */
        .soko-shops-section,
        .soko-trust-section,
        .soko-sell-cta {
          padding-left: 14px !important;
          padding-right: 14px !important;
        }

        /* Footer compress */
        .soko-footer {
          padding: 28px 14px 24px !important;
        }
        .soko-footer-grid {
          font-size: 13px;
        }
      }
      @media (max-width: 380px) {
        .soko-cat-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr)) !important;
        }
        .soko-listings-grid {
          gap: 8px !important;
        }
        .soko-featured-card-wrap {
          width: 136px !important;
        }
        .soko-latest-card .soko-latest-photo {
          height: 118px !important;
        }
      }
      @media (hover: none) {
        .soko-card-hover:hover { transform: none; box-shadow: inherit !important; }
      }
      @media (min-width: 769px) {
        .soko-nav-mobile { display:none !important; }
        .soko-bottom-nav-mobile { display:none !important; }
        .soko-stories-mobile { display:none !important; }
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
const PILLARS = [
{ key: 'marketplace', label: 'Marketplace',  path: '/',            icon: (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12l9-9 9 9"/><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10"/></svg> },  { key: 'shops',       label: 'Shops',        path: '/shops',       icon: Icon.shop },
  { key: 'lookingfor',  label: 'People Looking For', path: '/looking-for', icon: (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a8 8 0 0 1 16 0v1"/></svg> },
  { key: 'jobs',        label: 'Jobs',         path: '/jobs',        icon: (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg> },
  { key: 'services',    label: 'Services',     path: '/services',   icon: (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg> },
  { key: 'stories',     label: 'Statuses (Stories)', path: '/status', icon: (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
  { key: 'verify',      label: 'Verification', path: '/profile',    icon: (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></svg> },
]

function SokoNav({
  user, notifCount, search, setSearch,
  navigate, onImageFile, animKeywords, animIdx,
  listings, activeCategory, onCategoryChange,
  activeDistrict, onDistrictChange, onFocusChange,
}) {
  const [focused, setFocusedRaw]    = useState(false)
  function setFocused(v) { setFocusedRaw(v); onFocusChange?.(v) }
  const [distOpen, setDistOpen]     = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const district = activeDistrict || 'All Districts'
  const fileRef  = useRef(null)
  const inputRef = useRef(null)

  const districts = ['All Districts','Lilongwe','Blantyre','Mzuzu','Zomba','Kasungu','Mangochi','Salima','Dedza','Ntchisi','Dowa']
  const kw = animKeywords?.length > 0 ? animKeywords[animIdx % animKeywords.length] : 'Samsung Galaxy A57'

  function handleKey(e) { if (e.key === 'Enter' && search.trim()) navigate(`/search?q=${encodeURIComponent(search.trim())}`) }

  return (
    <nav className="soko-nav-glass">
      {/* ── Row 1: brand · district · search · actions ── */}
      <div className="soko-nav-row1" style={{
        maxWidth: 1400, margin: '0 auto', padding: '10px 20px',
        display: 'flex', alignItems: 'center', gap: 14, minHeight: 70,
      }}>

        <div onClick={() => navigate('/')} className="soko-nav-brand" style={{ cursor: 'pointer', flexShrink: 0, userSelect: 'none' }}>
          <div className="soko-nav-brand-mark" style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 800, color: T.green, letterSpacing: '-0.5px', lineHeight: 1.1 }}>
            Soko<span style={{ color: T.amber }}>Mw</span>
          </div>
          <div className="soko-nav-desktop" style={{ fontSize: 10.5, color: T.gray600, fontWeight: 500, whiteSpace: 'nowrap' }}>
            Buy. Sell. Find. Anywhere in Malawi.
          </div>
        </div>

        {/* Desktop: district selector */}
        <div className="soko-nav-desktop" style={{ position: 'relative', flexShrink: 0 }}>
          <button onClick={() => setDistOpen(d => !d)} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '7px 12px', borderRadius: 50,
            background: '#fff', border: `1.5px solid ${T.gray200}`,
            fontSize: 13, fontWeight: 600, color: T.gray800,
            cursor: 'pointer', whiteSpace: 'nowrap',
          }}>
            {Icon.pin(13)}
            <span style={{ color: district !== 'All Districts' ? T.amber : T.green, fontWeight: district !== 'All Districts' ? 800 : 600 }}>{district}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="6 9 12 15 18 9"/></svg>
            {district !== 'All Districts' && (
              <span onClick={e => { e.stopPropagation(); onDistrictChange('All Districts') }} style={{ marginLeft: 2, color: T.gray400, fontSize: 11, lineHeight: 1 }}>✕</span>
            )}
          </button>
          {distOpen && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0,
              background: T.white, borderRadius: 16, padding: '8px 0',
              boxShadow: T.shadowLg, minWidth: 200,
              border: `1px solid ${T.gray200}`, zIndex: 200, animation: 'fadeUp 0.18s ease',
            }}>
              {districts.map(d => (
                <button key={d} onClick={() => { onDistrictChange(d); setDistOpen(false) }} style={{
                  display: 'block', width: '100%', padding: '9px 16px', textAlign: 'left',
                  background: d === district ? T.greenL : 'transparent', border: 'none',
                  fontSize: 13.5, fontWeight: d === district ? 700 : 500,
                  color: d === district ? T.green : T.gray800, cursor: 'pointer',
                }}>{d}</button>
              ))}
            </div>
          )}
        </div>

       {/* Search bar (desktop) */}
        <div className="soko-nav-desktop" style={{
          flex: 1, display: 'flex', alignItems: 'center',
          background: focused ? '#fff' : T.gray100,
          border: `1.5px solid ${focused ? T.green : 'transparent'}`,
          borderRadius: 50, padding: '4px 4px 4px 14px', gap: 0,
          transition: 'border-color 0.2s, background 0.2s',
          boxShadow: focused ? `0 0 0 3px rgba(15,157,88,0.10)` : 'none',
          minHeight: 42,
        }}>
          <span style={{ color: T.gray500, flexShrink: 0, display: 'flex', alignItems: 'center', marginRight: 8 }}>{Icon.search(15)}</span>
          <input
            ref={inputRef} value={search}
            onChange={e => {
              const val = e.target.value
              setSearch(val)
              navigate(`/search?q=${encodeURIComponent(val)}&focus=1`)
            }}
            onFocus={() => { setFocused(true); navigate('/search?focus=1') }}
            onBlur={() => setFocused(false)}
            onKeyDown={handleKey}
            placeholder="Search for anything (e.g. iPhone, Toyota, jobs, services...)"
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: 13.5, color: T.gray900, outline: 'none', padding: '0', minWidth: 0, cursor: 'text' }}
          />
          {search && (
            <button onClick={() => setSearch('')} style={{ background: T.gray300, border: 'none', borderRadius: '50%', width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.gray600, flexShrink: 0, marginRight: 6 }}>{Icon.x(9)}</button>
          )}
          <button onClick={() => { if (search.trim()) navigate(`/search?q=${encodeURIComponent(search.trim())}`) }} style={{
            flexShrink: 0, background: T.green, color: '#fff', border: 'none',
            borderRadius: 50, height: 34, padding: '0 20px',
            fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
            transition: 'background 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = T.greenD}
            onMouseLeave={e => e.currentTarget.style.background = T.green}
          >
            Search
          </button>
          <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={onImageFile} />
        </div>

        {/* Desktop actions */}
        <div className="soko-nav-desktop" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <NavIconBtn icon={Icon.chat(18)} label="Chats" onClick={() => navigate('/chats')} />
          <div style={{ position: 'relative' }}>
            <NavIconBtn icon={Icon.bell(18)} label="Alerts" onClick={() => navigate('/notifications')} />
            {notifCount > 0 && (
              <span style={{ position: 'absolute', top: 4, right: 6, background: T.red, color: '#fff', borderRadius: '50%', width: 17, height: 17, fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'badgePop 0.3s ease', border: '2px solid #fff' }}>{notifCount > 9 ? '9+' : notifCount}</span>
            )}
          </div>
           <button onClick={() => navigate('/post')} style={{
            height: 38, padding: '0 18px', fontSize: 13.5, fontWeight: 700,
            background: T.green, color: '#fff', border: 'none', borderRadius: 50,
            cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            whiteSpace: 'nowrap', transition: 'background 0.15s',
          }}
            onMouseEnter={e => e.currentTarget.style.background = T.greenD}
            onMouseLeave={e => e.currentTarget.style.background = T.green}
          >
            {Icon.plus(14)} Sell Now
          </button>
          <div style={{ position: 'relative' }}>
            <button onClick={() => setAvatarOpen(o => !o)} style={{
              width: 38, height: 38, borderRadius: '50%',
              background: user?.avatar_url ? 'transparent' : `linear-gradient(135deg, ${T.green}, ${T.greenD})`,
              border: `2px solid ${T.green}`, cursor: 'pointer', overflow: 'hidden',
              display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 14, fontWeight: 700, flexShrink: 0,
            }}>
              {user?.avatar_url ? <img src={user.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (user?.email?.[0] || 'S').toUpperCase()}
            </button>
            {avatarOpen && (
              <div style={{ position: 'absolute', top: 'calc(100% + 10px)', right: 0, background: T.white, borderRadius: 16, padding: '8px 0', boxShadow: T.shadowLg, minWidth: 190, border: `1px solid ${T.gray200}`, zIndex: 200, animation: 'fadeUp 0.18s ease' }}>
                {[
                  { label: 'My Profile', path: '/profile' },
                  ...(user?.shop_slug ? [{ label: 'My Shop', path: `/shop/${user.shop_slug}`, green: true, isShop: true }] : [{ label: 'Create My Shop', path: '/shop-setup', green: true, isShop: true }]),
                  { label: 'My Listings', path: '/my-listings' },
                  { label: 'My Chats', path: '/chats' },
                  { label: 'Settings', path: '/settings' },
                  { divider: true },
                  { label: 'Sign Out', path: '/logout', red: true },
                ].map((item, i) => item.divider
                  ? <div key={i} style={{ height: 1, background: T.gray200, margin: '4px 0' }} />
                  : <button key={i} onClick={() => { navigate(item.path); setAvatarOpen(false) }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '9px 16px', textAlign: 'left', background: 'transparent', border: 'none', fontSize: 13.5, fontWeight: item.green ? 700 : 500, color: item.red ? T.red : item.green ? T.green : T.gray800, cursor: 'pointer' }}>
                      {item.isShop && Icon.shop(13)}
                      {item.label}
                    </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Mobile top bar: search + alerts only (brand stays left) */}
        <div className="soko-nav-mobile" style={{ display: 'none', flex: 1, alignItems: 'center', gap: 8, minWidth: 0 }}>
          <div
            className="soko-nav-mobile-search"
            style={{
              flex: 1, display: 'flex', alignItems: 'center', gap: 8, minWidth: 0,
              background: T.gray100, borderRadius: 12, padding: '0 12px', minHeight: 40,
              border: `1px solid ${focused ? T.green : T.gray200}`, position: 'relative', cursor: 'pointer',
            }}
            onClick={() => navigate('/search?focus=1')}
          >
            <span style={{ color: focused ? T.green : T.gray400, flexShrink: 0, display: 'flex' }}>{Icon.search(16)}</span>
            <div style={{ flex: 1, position: 'relative', height: 22, minWidth: 0 }}>
              <input
                value={search}
                onChange={e => {
                  e.stopPropagation()
                  const val = e.target.value
                  setSearch(val)
                  navigate(`/search?q=${encodeURIComponent(val)}&focus=1`)
                }}
                onFocus={() => { setFocused(true); navigate('/search?focus=1') }}
                onBlur={() => setFocused(false)}
                aria-label="Search marketplace"
                style={{
                  position: 'absolute', inset: 0, width: '100%', border: 'none',
                  background: 'transparent', fontSize: 14, color: T.gray900, outline: 'none',
                  zIndex: search || focused ? 2 : 0,
                }}
              />
              {!search && !focused && (
                <div style={{
                  position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                  pointerEvents: 'none', fontSize: 13.5, color: T.gray400, overflow: 'hidden',
                }}>
                  Search&nbsp;
                  <span key={animIdx} style={{ color: T.green, fontWeight: 600, animation: 'wordSlide 3.5s ease forwards' }}>{kw}</span>
                </div>
              )}
            </div>
            {search && (
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setSearch('') }}
                style={{
                  background: T.gray200, border: 'none', borderRadius: '50%',
                  width: 22, height: 22, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', cursor: 'pointer', color: T.gray600, flexShrink: 0,
                }}
              >{Icon.x(10)}</button>
            )}
          </div>
          <button
            type="button"
            onClick={() => navigate('/notifications')}
            aria-label="Notifications"
            style={{
              width: 40, height: 40, borderRadius: 12, background: 'transparent', border: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
              color: T.gray700, flexShrink: 0, position: 'relative',
            }}
          >
            {Icon.bell(20)}
            {notifCount > 0 && (
              <span style={{
                position: 'absolute', top: 4, right: 4, background: T.red, color: '#fff',
                borderRadius: '50%', minWidth: 16, height: 16, fontSize: 9, fontWeight: 800,
                display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #fff',
                padding: '0 3px',
              }}>{notifCount > 9 ? '9+' : notifCount}</span>
            )}
          </button>
        </div>
      </div>

      {/* ── Row 2: Primary pillar navigation (desktop) ── */}
      <div className="soko-pillar-row soko-nav-desktop" style={{ borderTop: `1px solid ${T.gray100}` }}>
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '0 20px', display: 'flex', alignItems: 'center', gap: 0 }}>
          {PILLARS.map(p => {
            const isActive = p.key === 'marketplace'
            return (
              <button key={p.key} onClick={() => navigate(p.path)} style={{
                position: 'relative', display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 16px',
                background: 'none', border: 'none', borderBottom: isActive ? `2.5px solid ${T.green}` : '2.5px solid transparent',
                cursor: 'pointer', fontSize: 13.5, fontWeight: isActive ? 700 : 500,
                color: isActive ? T.green : T.gray700,
                transition: 'color 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (!isActive) { e.currentTarget.style.color = T.green } }}
              onMouseLeave={e => { if (!isActive) { e.currentTarget.style.color = T.gray700 } }}
              >
                <span style={{ color: isActive ? T.green : T.gray500, display: 'flex', alignItems: 'center' }}>{p.icon(15)}</span>
                {p.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Mobile: compact discover chips (Explore covers full search via bottom nav) ── */}
      <div className="soko-nav-mobile soko-nav-mobile-pillars" style={{ display: 'none', borderTop: `1px solid ${T.gray100}` }}>
        <div className="soko-scroll" style={{ display: 'flex', gap: 8, overflowX: 'auto' }}>
          {PILLARS.filter(p => p.key !== 'marketplace').map(p => (
            <button
              key={p.key}
              type="button"
              onClick={() => navigate(p.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0,
                background: T.gray100, border: 'none',
                borderRadius: 999, padding: '7px 12px', fontSize: 12, fontWeight: 600,
                color: T.gray800, cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', color: T.gray500 }}>{p.icon(13)}</span>
              {p.label}
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
}

function NavIconBtn({ icon, label, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 10px', borderRadius: 12, color: T.gray800, fontSize: 10, fontWeight: 600, transition: 'background 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.background = T.gray100} onMouseLeave={e => e.currentTarget.style.background = 'none'}
    >{icon}<span>{label}</span></button>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   REVENUE HERO
   Left: marketing message + two CTAs (Browse Listings / Post Request).
   Right: 3-card perspective carousel of FEATURED listings — this is the
   first monetization surface a visitor sees, framed as social proof
   ("Featured" badge visible) rather than an ad unit.
───────────────────────────────────────────────────────────────────────────── */
function RevenueHero({ navigate, listings }) {
  // Phase 3.1: `listings` is already the dedicated featured query result (not recent feed)
  // Include every active featured product with an image (no hard cap) so rotation covers all.
  const featured = useMemo(() =>
    (listings || []).filter(l => isListingFeatured(l) && l.images?.[0]),
  [listings])

  // Stable identity of the featured set (sorted) — ignore display order so
  // fair rotation reorders do not thrash carousel state every bucket.
  const featuredSetKey = useMemo(
    () => featured.map(f => f.id).filter(Boolean).slice().sort().join('|'),
    [featured],
  )

  const [page, setPage]     = useState(0)
  const [mobileIdx, setMobileIdx] = useState(0)
  const [paused, setPaused] = useState(false)
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 })
  const [visible, setVisible] = useState(false)
  const sectionRef = useRef(null)
  const mobileRailRef = useRef(null)
  const touchStartX = useRef(null)
  const perPage = 3
  const pageCount = Math.max(1, Math.ceil(featured.length / perPage) || 1)
  const mobileCount = featured.length
  const ROTATE_MS = 4200

  // Clamp indices when the pool shrinks (avoids empty slots / crashes)
  useEffect(() => {
    setPage(p => (pageCount < 1 ? 0 : Math.min(p, pageCount - 1)))
    setMobileIdx(i => (mobileCount < 1 ? 0 : Math.min(i, mobileCount - 1)))
  }, [pageCount, mobileCount, featuredSetKey])

  // Desktop: page through groups of 3 until every product has been shown
  useEffect(() => {
    if (paused || pageCount < 2) return undefined
    const t = setInterval(() => setPage(p => (p + 1) % pageCount), ROTATE_MS)
    return () => clearInterval(t)
  }, [paused, pageCount])

  // Mobile: advance one product at a time through the full featured list
  useEffect(() => {
    if (paused || mobileCount < 2) return undefined
    const t = setInterval(() => setMobileIdx(i => (i + 1) % mobileCount), ROTATE_MS)
    return () => clearInterval(t)
  }, [paused, mobileCount])

  // Smooth-scroll mobile rail to the active product
  useEffect(() => {
    const rail = mobileRailRef.current
    if (!rail || mobileCount < 1) return
    const card = rail.children[mobileIdx]
    if (!card || typeof card.offsetLeft !== 'number') return
    try {
      const left = card.offsetLeft - (rail.clientWidth - card.clientWidth) / 2
      rail.scrollTo({ left: Math.max(0, left), behavior: 'smooth' })
    } catch {
      /* ignore scroll errors on hidden/detached rails */
    }
  }, [mobileIdx, mobileCount])

  // Entrance animation observer
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true) }, { threshold: 0.1 })
    if (sectionRef.current) obs.observe(sectionRef.current)
    return () => obs.disconnect()
  }, [])

  // Parallax on mouse move
  function handleMouseMove(e) {
    const rect = sectionRef.current?.getBoundingClientRect()
    if (!rect) return
    setMousePos({
      x: ((e.clientX - rect.left) / rect.width - 0.5) * 20,
      y: ((e.clientY - rect.top)  / rect.height - 0.5) * 12,
    })
  }

  function goTo(i) { setPage(((i % pageCount) + pageCount) % pageCount) }
  function next() { setPage(p => (p + 1) % pageCount) }
  function prev() { setPage(p => ((p - 1) + pageCount) % pageCount) }
  function goToMobile(i) {
    if (mobileCount < 1) return
    setMobileIdx(((i % mobileCount) + mobileCount) % mobileCount)
  }
  function nextMobile() { setMobileIdx(i => (i + 1) % Math.max(1, mobileCount)) }
  function prevMobile() { setMobileIdx(i => ((i - 1) + Math.max(1, mobileCount)) % Math.max(1, mobileCount)) }

  function onMobileTouchStart(e) {
    touchStartX.current = e.touches?.[0]?.clientX ?? null
    setPaused(true)
  }
  function onMobileTouchEnd(e) {
    const start = touchStartX.current
    touchStartX.current = null
    const end = e.changedTouches?.[0]?.clientX
    if (start != null && end != null) {
      const dx = end - start
      if (Math.abs(dx) > 40) {
        if (dx < 0) nextMobile()
        else prevMobile()
      }
    }
    // resume auto-rotate shortly after interaction
    setTimeout(() => setPaused(false), 2800)
  }

  const visibleCards = featured.slice(page * perPage, page * perPage + perPage)

  /** One standard card design for all featured products (mobile + desktop). */
  function renderHeroCard(item, idx, { mobile = false } = {}) {
    const price = isFlashActive(item) ? (item.flash_sale_price ?? item.price) : item.price
    const flash = isFlashActive(item)
    const isActive = mobile && idx === mobileIdx
    const verified = !!(item.seller_verified || item.shop_is_verified)
    const pad = mobile ? '8px 9px 10px' : '14px 14px 16px'

    return (
      <div
        key={item.id}
        className={`${mobile ? 'soko-hero-mobile-card' : 'soko-hero-desk-card'}${isActive ? ' is-active' : ''}`}
        onClick={() => navigate('/listing/' + item.id)}
        role="button"
        tabIndex={0}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/listing/' + item.id) } }}
        style={{
          position: 'relative',
          height: mobile ? 186 : 230,
          borderRadius: mobile ? 14 : 18,
          overflow: 'hidden',
          cursor: 'pointer',
          flexShrink: mobile ? 0 : undefined,
          background: '#0b1410',
          border: isActive
            ? '1.5px solid rgba(255,255,255,0.55)'
            : '1px solid rgba(255,255,255,0.22)',
          boxShadow: isActive
            ? '0 12px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.12)'
            : mobile
              ? '0 8px 24px rgba(0,0,0,0.4)'
              : '0 10px 32px rgba(0,0,0,0.48)',
          transition: 'transform 0.3s ease, box-shadow 0.3s ease, border-color 0.2s ease',
          animation: visible && !mobile ? `cardSlideUp 0.5s ease ${0.1 + idx * 0.08}s both` : 'none',
        }}
        onMouseEnter={e => {
          if (mobile) return
          e.currentTarget.style.transform = 'translateY(-6px)'
          e.currentTarget.style.boxShadow = '0 18px 40px rgba(0,0,0,0.55)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.4)'
          const img = e.currentTarget.querySelector('img')
          if (img) img.style.transform = 'scale(1.05)'
        }}
        onMouseLeave={e => {
          if (mobile) return
          e.currentTarget.style.transform = 'none'
          e.currentTarget.style.boxShadow = '0 10px 32px rgba(0,0,0,0.48)'
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.22)'
          const img = e.currentTarget.querySelector('img')
          if (img) img.style.transform = 'scale(1)'
        }}
      >
        {item.images?.[0] ? (
          <img
            src={item.images[0]}
            alt={item.title}
            loading={mobile ? 'lazy' : 'eager'}
            decoding="async"
            style={{
              position: 'absolute', inset: 0, width: '100%', height: '100%',
              objectFit: 'cover', display: 'block',
              transition: 'transform 0.5s cubic-bezier(0.34,1.2,0.64,1)',
            }}
          />
        ) : (
          <div style={{
            position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.08)',
            display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.4)',
          }}>
            {Icon.star(mobile ? 22 : 28)}
          </div>
        )}

        {/* Stronger bottom scrim so title + full price stay readable */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(180deg, rgba(0,0,0,0.12) 0%, transparent 32%, rgba(0,0,0,0.55) 62%, rgba(0,0,0,0.88) 100%)',
        }} />

        <div style={{ position: 'absolute', top: mobile ? 8 : 10, left: mobile ? 8 : 10, zIndex: 5 }}>
          {flash ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              background: 'rgba(234,67,53,0.96)', color: '#fff',
              borderRadius: 999, padding: mobile ? '4px 8px' : '5px 10px',
              fontSize: mobile ? 9.5 : 10.5, fontWeight: 800,
              boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
            }}>Hot</span>
          ) : (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'rgba(255,255,255,0.96)', color: '#1a1a1a',
              borderRadius: 999, padding: mobile ? '4px 8px' : '5px 10px',
              fontSize: mobile ? 9.5 : 10.5, fontWeight: 800,
              boxShadow: '0 2px 10px rgba(0,0,0,0.22)',
            }}>
              <span style={{ display: 'flex', color: T.amber }}>{Icon.star(mobile ? 9 : 11, T.amber)}</span>
              Featured
            </span>
          )}
        </div>

        <div className="soko-hero-card-body" style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 5, padding: pad,
        }}>
          <div className="soko-hero-card-title" style={{
            fontSize: mobile ? 12.5 : 15, fontWeight: 700, color: '#fff',
            marginBottom: mobile ? 3 : 5, lineHeight: 1.25,
            textShadow: '0 1px 6px rgba(0,0,0,0.55)',
            overflow: 'hidden', display: '-webkit-box',
            WebkitLineClamp: mobile ? 1 : 2, WebkitBoxOrient: 'vertical',
          }}>
            {item.title}
          </div>
          <div className="soko-hero-card-price" style={{
            fontFamily: T.fontDisplay,
            fontSize: mobile ? 13 : 17,
            fontWeight: 800,
            color: flash ? '#ffb4ab' : '#ffd666',
            marginBottom: mobile ? 3 : 5,
            letterSpacing: '-0.3px',
            whiteSpace: 'normal',
            wordBreak: 'break-word',
            lineHeight: 1.2,
            textShadow: '0 1px 4px rgba(0,0,0,0.45)',
          }}>
            {formatPrice(price)}
          </div>
          <div className="soko-hero-card-meta" style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4,
          }}>
            <span style={{
              fontSize: mobile ? 10.5 : 11.5, color: 'rgba(255,255,255,0.82)',
              display: 'flex', alignItems: 'center', gap: 3, minWidth: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {Icon.pin(mobile ? 10 : 11)} {item.city || 'Malawi'}
            </span>
            {!mobile && verified && (
              <span style={{
                fontSize: 10.5, color: '#8aefb4', display: 'flex',
                alignItems: 'center', gap: 3, fontWeight: 700, flexShrink: 0,
              }}>
                {Icon.verify(11)} Verified
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <section
      ref={sectionRef}
      className="soko-hero-section"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setMousePos({ x: 0, y: 0 })}
      style={{ position: 'relative', overflow: 'hidden', minHeight: 0 }}
    >
      {/* ── Injected keyframes ── */}
      <style>{`
        @keyframes blobFloat1 { 0%,100%{transform:translate(0,0) scale(1)} 33%{transform:translate(30px,-20px) scale(1.05)} 66%{transform:translate(-20px,15px) scale(0.97)} }
        @keyframes blobFloat2 { 0%,100%{transform:translate(0,0) scale(1)} 40%{transform:translate(-25px,18px) scale(1.04)} 70%{transform:translate(20px,-12px) scale(0.98)} }
        @keyframes blobFloat3 { 0%,100%{transform:translate(0,0) scale(1)} 30%{transform:translate(15px,22px) scale(1.06)} 60%{transform:translate(-18px,-10px) scale(0.96)} }
        @keyframes particleDrift { 0%{transform:translateY(0) translateX(0);opacity:0} 10%{opacity:1} 90%{opacity:1} 100%{transform:translateY(-120px) translateX(30px);opacity:0} }
        @keyframes badgeShimmer { 0%{background-position:-200% center} 100%{background-position:200% center} }
        @keyframes heroFadeUp { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes cardSlideUp { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
        @keyframes ctaPulse { 0%,100%{box-shadow:0 4px 18px rgba(249,171,0,0.4)} 50%{box-shadow:0 4px 28px rgba(249,171,0,0.72)} }
        @keyframes dotGrid { 0%,100%{opacity:0.35} 50%{opacity:0.55} }
      `}</style>

      {/* ── Layer 1: Deep base gradient ── */}
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(135deg, #040f07 0%, #071a0d 35%, #0a2015 60%, #060d18 100%)',
      }} />

      {/* ── Layer 2: Mesh (light) ── */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 70% 60% at 8% 90%, rgba(15,157,88,0.2) 0%, transparent 60%),
          radial-gradient(ellipse 55% 50% at 92% 8%,  rgba(15,157,88,0.14) 0%, transparent 55%),
          radial-gradient(ellipse 35% 45% at 78% 85%, rgba(249,171,0,0.08) 0%, transparent 55%)
        `,
      }} />

      {/* ── Desktop-only decorative layers ── */}
      <div className="soko-hero-fx-heavy soko-nav-desktop" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden',
        transform: `translate(${mousePos.x * 0.4}px, ${mousePos.y * 0.3}px)`,
        transition: 'transform 0.8s cubic-bezier(0.25,0.46,0.45,0.94)',
      }}>
        <div style={{ position: 'absolute', top: '-10%', left: '-8%', width: 420, height: 420, borderRadius: '50%', background: 'radial-gradient(circle, rgba(15,157,88,0.18) 0%, transparent 70%)', animation: 'blobFloat1 14s ease-in-out infinite', filter: 'blur(2px)' }} />
        <div style={{ position: 'absolute', bottom: '-15%', right: '-5%', width: 380, height: 380, borderRadius: '50%', background: 'radial-gradient(circle, rgba(15,157,88,0.14) 0%, transparent 70%)', animation: 'blobFloat2 18s ease-in-out infinite', filter: 'blur(2px)' }} />
      </div>
      <div className="soko-hero-fx-heavy soko-nav-desktop" style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        backgroundImage: `radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)`,
        backgroundSize: '28px 28px',
        animation: 'dotGrid 6s ease-in-out infinite',
      }} />
      <div className="soko-hero-fx-heavy soko-nav-desktop" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
        {[...Array(10)].map((_, i) => (
          <div key={i} style={{
            position: 'absolute', width: 2, height: 2, borderRadius: '50%',
            background: i % 2 === 0 ? 'rgba(249,171,0,0.35)' : 'rgba(15,157,88,0.35)',
            left: `${8 + (i * 9) % 85}%`, top: `${12 + (i * 11) % 75}%`,
            animation: `particleDrift ${7 + (i % 4) * 2}s linear ${i * 0.6}s infinite`,
          }} />
        ))}
      </div>

      {/* ── CONTENT ── */}
      <div className="soko-hero-grid" style={{
        position: 'relative', zIndex: 1, maxWidth: 1400, margin: '0 auto',
        display: 'grid', gridTemplateColumns: '34% 1fr', gap: 28,
        alignItems: 'center', padding: 'clamp(16px,3vw,28px) 20px',
      }}>

        {/* ── LEFT: marketing copy ── */}
        <div className="soko-hero-copy" style={{
          animation: visible ? 'heroFadeUp 0.65s ease both' : 'none',
        }}>

          <div className="soko-hero-badge" style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'linear-gradient(135deg, rgba(234,88,12,0.2), rgba(249,171,0,0.12))',
            border: '1px solid rgba(249,171,0,0.35)',
            borderRadius: 50, padding: '5px 12px', marginBottom: 14,
            width: 'fit-content',
          }}>
            <span style={{ color: T.red, display: 'flex' }}>{Icon.fire(12)}</span>
            <span style={{ fontSize: 10.5, fontWeight: 800, color: T.amber, letterSpacing: 0.6, textTransform: 'uppercase' }}>
              Featured
            </span>
          </div>

          <h1 className="soko-hero-headline" style={{
            fontFamily: T.fontDisplay, fontSize: 'clamp(24px, 2.6vw, 32px)',
            fontWeight: 800, color: '#fff', lineHeight: 1.15, letterSpacing: '-0.8px',
            marginBottom: 10,
          }}>
            Reach more buyers.{' '}
            <span style={{
              background: `linear-gradient(90deg, ${T.amber}, #ffce45)`,
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
            }}>Get Featured today!</span>
          </h1>

          <p className="soko-hero-sub" style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, maxWidth: 320, marginBottom: 18 }}>
            Stand out, get more views and sell faster.
          </p>

          <div className="soko-hero-benefits" style={{ display: 'flex', flexDirection: 'row', gap: 20, marginBottom: 20, flexWrap: 'nowrap' }}>
            {[
              { icon: Icon.star, color: T.amber, label: 'Top placement', sub: 'Be seen by more buyers' },
              { icon: Icon.eye, color: T.green, label: 'More views', sub: 'Increase your chances' },
              { icon: Icon.lightning, color: T.amber, label: 'Sell faster', sub: 'Get results quickly' },
            ].map(({ icon, color, label, sub }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ color, display: 'flex', flexShrink: 0 }}>{icon(15)}</span>
                <div>
                  <div style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.85)', whiteSpace: 'nowrap' }}>{label}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap' }}>{sub}</div>
                </div>
              </div>
            ))}
          </div>

          <div className="soko-hero-cta-row" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              className="soko-btn-primary"
              onClick={() => navigate('/profile?tab=selling')}
              style={{
                background: `linear-gradient(135deg, ${T.amber}, #e09800)`,
                color: '#1a0a00', fontSize: 14, padding: '11px 22px',
                animation: 'ctaPulse 2.8s ease-in-out infinite',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.animation='none'; e.currentTarget.style.boxShadow='0 8px 24px rgba(249,171,0,0.45)' }}
              onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.animation='ctaPulse 2.8s ease-in-out infinite'; e.currentTarget.style.boxShadow='' }}
            >
              Get Featured
            </button>
            <button
              type="button"
              onClick={() => navigate('/profile?tab=selling')}
              className="soko-btn-outline soko-hero-cta-learn"
              style={{ fontSize: 14, padding: '11px 22px', transition: 'all 0.25s' }}
              onMouseEnter={e => { e.currentTarget.style.transform='translateY(-2px)'; e.currentTarget.style.background='rgba(255,255,255,0.18)' }}
              onMouseLeave={e => { e.currentTarget.style.transform='none'; e.currentTarget.style.background='rgba(255,255,255,0.1)' }}
            >
              Learn More
            </button>
          </div>
        </div>

        {/* ── RIGHT: desktop 3-card carousel ── */}
        <div
          className="soko-hero-right soko-hero-desktop-carousel"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          style={{
            position: 'relative',
            animation: visible ? 'heroFadeUp 0.75s ease 0.15s both' : 'none',
            transform: `translate(${mousePos.x * 0.15}px, ${mousePos.y * 0.1}px)`,
            transition: 'transform 1s cubic-bezier(0.25,0.46,0.45,0.94)',
          }}
        >
          {featured.length === 0 ? (
            <div style={{ background: 'rgba(255,255,255,0.05)', border: '2px dashed rgba(255,255,255,0.12)', borderRadius: 16, padding: 28, textAlign: 'center', width: '100%', backdropFilter: 'blur(8px)' }}>
              <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'center' }}>{Icon.star(32)}</div>
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, marginBottom: 16 }}>
                No featured listings yet — be the first sellers see.
              </p>
              <button type="button" onClick={() => navigate('/post')} style={{ background: `linear-gradient(135deg,${T.amber},#e09800)`, border: 'none', borderRadius: 10, padding: '9px 20px', fontSize: 13, fontWeight: 800, color: '#1a0a00', cursor: 'pointer' }}>
                Feature My Listing
              </button>
            </div>
          ) : (
            <>
              {pageCount > 1 && (
                <button type="button" onClick={prev} aria-label="Previous featured" style={{ position: 'absolute', left: -16, top: '40%', transform: 'translateY(-50%)', zIndex: 20, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 17, backdropFilter: 'blur(8px)', transition: 'background 0.2s, transform 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background='rgba(15,157,88,0.7)'; e.currentTarget.style.transform='translateY(-50%) scale(1.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background='rgba(0,0,0,0.6)'; e.currentTarget.style.transform='translateY(-50%) scale(1)' }}
                >‹</button>
              )}
              {pageCount > 1 && (
                <button type="button" onClick={next} aria-label="Next featured" style={{ position: 'absolute', right: -16, top: '40%', transform: 'translateY(-50%)', zIndex: 20, width: 32, height: 32, borderRadius: '50%', background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.22)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#fff', fontSize: 17, backdropFilter: 'blur(8px)', transition: 'background 0.2s, transform 0.2s' }}
                  onMouseEnter={e => { e.currentTarget.style.background='rgba(15,157,88,0.7)'; e.currentTarget.style.transform='translateY(-50%) scale(1.1)' }}
                  onMouseLeave={e => { e.currentTarget.style.background='rgba(0,0,0,0.6)'; e.currentTarget.style.transform='translateY(-50%) scale(1)' }}
                >›</button>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${perPage}, 1fr)`, gap: 16 }}>
                {visibleCards.map((item, idx) => renderHeroCard(item, idx))}
                {visibleCards.length < perPage && Array.from({ length: perPage - visibleCards.length }).map((_, i) => <div key={`pad-${i}`} />)}
              </div>

              {pageCount > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginTop: 14 }}>
                  {Array.from({ length: pageCount }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => goTo(i)}
                      aria-label={`Featured page ${i + 1}`}
                      style={{
                        width: i === page ? 22 : 6, height: 6, borderRadius: 50, border: 'none', padding: 0,
                        background: i === page
                          ? `linear-gradient(90deg, ${T.amber}, #ffce45)`
                          : 'rgba(255,255,255,0.22)',
                        cursor: 'pointer',
                        transition: 'all 0.35s cubic-bezier(0.34,1.2,0.64,1)',
                        boxShadow: i === page ? '0 0 8px rgba(249,171,0,0.5)' : 'none',
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Mobile: horizontal featured product rail (swipe) ── */}
        <div className="soko-hero-mobile-carousel" style={{ display: 'none' }}>
          {featured.length === 0 ? (
            <div className="soko-hero-mobile-empty" style={{
              background: 'rgba(255,255,255,0.05)', border: '2px dashed rgba(255,255,255,0.14)',
              borderRadius: 14, padding: '18px 16px', textAlign: 'center', backdropFilter: 'blur(8px)',
            }}>
              <div style={{ marginBottom: 6, display: 'flex', justifyContent: 'center' }}>{Icon.star(24)}</div>
              <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', lineHeight: 1.5, marginBottom: 12 }}>
                No featured listings yet — be the first sellers see.
              </p>
              <button
                type="button"
                onClick={() => navigate('/post')}
                style={{
                  background: `linear-gradient(135deg,${T.amber},#e09800)`, border: 'none', borderRadius: 10,
                  padding: '10px 18px', fontSize: 13, fontWeight: 800, color: '#1a0a00', cursor: 'pointer', minHeight: 44,
                }}
              >
                Feature My Listing
              </button>
            </div>
          ) : (
            <>
              <div className="soko-hero-mobile-head" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'rgba(255,255,255,0.78)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: T.amber, boxShadow: '0 0 0 3px rgba(249,171,0,0.2)' }} />
                  Featured
                  {mobileCount > 1 && (
                    <span style={{ fontWeight: 600, color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}>
                      {mobileIdx + 1}/{mobileCount}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => navigate('/listings')}
                  style={{
                    background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: 999, color: 'rgba(255,255,255,0.88)',
                    fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                    padding: '5px 10px', minHeight: 30,
                  }}
                >
                  View all
                </button>
              </div>
              <div
                ref={mobileRailRef}
                className="soko-hero-mobile-rail"
                onTouchStart={onMobileTouchStart}
                onTouchEnd={onMobileTouchEnd}
                onMouseEnter={() => setPaused(true)}
                onMouseLeave={() => setPaused(false)}
              >
                {featured.map((item, idx) => renderHeroCard(item, idx, { mobile: true }))}
              </div>
              {mobileCount > 1 && (
                <div className="soko-hero-mobile-dots" role="tablist" aria-label="Featured products">
                  {featured.map((item, i) => (
                    <button
                      key={item.id}
                      type="button"
                      role="tab"
                      aria-selected={i === mobileIdx}
                      aria-label={`Show featured ${i + 1} of ${mobileCount}`}
                      onClick={() => { goToMobile(i); setPaused(true); setTimeout(() => setPaused(false), 2800) }}
                      style={{
                        width: i === mobileIdx ? 16 : 5,
                        height: 4,
                        borderRadius: 50,
                        border: 'none',
                        padding: 0,
                        cursor: 'pointer',
                        background: i === mobileIdx
                          ? `linear-gradient(90deg, ${T.amber}, #ffce45)`
                          : 'rgba(255,255,255,0.22)',
                        transition: 'all 0.3s ease',
                        flexShrink: 0,
                      }}
                    />
                  ))}
                </div>
              )}
            </>
          )}
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
  { key: 'all',         label: 'All Categories', sub: 'Browse all',        icon: Icon.grid,        fg: '#16a34a', bg: '#e8f7ee', isAll: true },
  { key: 'Vehicles',    label: 'Vehicles',       sub: 'Cars, bikes, more', icon: Icon.car,         fg: '#16a34a', bg: '#e9f7ec' },
  { key: 'Electronics', label: 'Electronics',    sub: 'Phones, laptops',   icon: Icon.phone,       fg: '#7c3aed', bg: '#f1ebfd' },
  { key: 'Clothing',    label: 'Fashion',        sub: 'Clothing, shoes',   icon: Icon.shirt,       fg: '#e0245e', bg: '#fdeaf0' },
  { key: 'Property',    label: 'Property',       sub: 'Houses, land',      icon: Icon.houseFilled, fg: '#ea580c', bg: '#fef0e6' },
  { key: 'Agriculture', label: 'Agriculture',    sub: 'Machinery, crops',  icon: Icon.leaf,        fg: '#16a34a', bg: '#e8f7ee' },
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
        <div className="soko-cat-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: 12 }}>
          {QUICK_CATEGORIES.map(item => (
            <button key={item.key} onClick={() => handleClick(item)} className="soko-cat-tile" style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              background: '#fff', border: `1px solid ${T.gray100}`, cursor: 'pointer', padding: '18px 8px 16px',
              borderRadius: 16, transition: 'border-color .15s, box-shadow .15s, transform .15s',
            }}>
              <div style={{ width: 44, height: 44, borderRadius: '50%', background: item.bg, color: item.fg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {item.icon(19)}
              </div>
              <div style={{ textAlign: 'center' }}>
                <div className="soko-cat-label" style={{ fontSize: 13, fontWeight: 700, color: T.gray900 }}>{item.label}</div>
                <div className="soko-cat-sub" style={{ fontSize: 10.5, color: T.gray600, marginTop: 1 }}>{item.sub}</div>
              </div>
            </button>
          ))}
          <button onClick={() => navigate('/categories')} className="soko-cat-tile" style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4,
            background: '#fdf6e8', border: `1.5px dashed ${T.amber}66`, cursor: 'pointer', padding: '18px 8px 16px',
            borderRadius: 16, transition: 'border-color .15s, box-shadow .15s, transform .15s',
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
          <span style={{ color: T.green, fontWeight: 700 }}>
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

  const ctaGreen = freeInfo.hasFree && !needsPost

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
                    background: needsPost ? '#fff7ed' : '#e6f4ec',
                    color: needsPost ? '#c2410c' : T.green,
                    borderRadius: 999, padding: '2px 6px',
                  }}>
                    {needsPost ? 'Start here' : 'Live'}
                  </span>
                </div>
                <div
                  className="soko-feat-price-amount"
                  style={{
                    fontSize: 12, fontWeight: 800, marginTop: 2,
                    color: freeInfo.hasFree && !needsPost ? T.green : T.amberD,
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
              background: ctaGreen
                ? `linear-gradient(135deg, ${T.green}, ${T.greenD})`
                : `linear-gradient(135deg, ${T.amber}, #e09800)`,
              color: ctaGreen ? '#fff' : '#1a0a00',
              border: 'none', borderRadius: 12, padding: '10px 16px',
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 7,
              boxShadow: ctaGreen
                ? '0 2px 12px rgba(15,157,88,0.3)'
                : '0 2px 12px rgba(249,171,0,0.35)',
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
    <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 8 }}>
      <div>
        <h2 style={{ fontFamily: T.fontDisplay, fontSize: 'clamp(19px, 2.4vw, 25px)', fontWeight: 800, color: T.gray900, letterSpacing: '-0.6px', marginBottom: 4 }}>{title}</h2>
        {subtitle && <p style={{ fontSize: 13.5, color: T.gray600 }}>{subtitle}</p>}
      </div>
      {action && (
        <button onClick={action.onClick} style={{ background: 'none', border: `1.5px solid ${T.gray200}`, borderRadius: 50, padding: '7px 16px', fontSize: 13, fontWeight: 600, color: T.gray800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = T.green; e.currentTarget.style.color = T.green }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = T.gray200; e.currentTarget.style.color = T.gray800 }}
        >{action.label} {Icon.chevR(14)}</button>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   LISTING CARD — "featured" gets a visibly larger gold-bordered treatment
   per the brief ("Featured Listings: Large premium cards. Bigger than
   normal listings. Gold featured badge.")
───────────────────────────────────────────────────────────────────────────── */
function PremiumListingCard({ listing, onClick, delay = 0, large = false }) {
  const [hov, setHov]     = useState(false)
  const [liked, setLiked] = useState(false)
  const [imgErr, setImgErr] = useState(false)

  const price   = isFlashActive(listing) ? listing.flash_sale_price : listing.price
  const isFlash = isFlashActive(listing)
  const isVerif = listing.seller_verified || listing.shop_is_verified
  const isFeat  = isListingFeatured(listing)

  function handleLike(e) { e.stopPropagation(); setLiked(l => !l) }

  return (
    <div onClick={onClick} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)} className={`soko-card-bg${isFeat && isFlash ? ' soko-dual-badge-card' : ''}`} style={{
      background: T.white, borderRadius: 12, overflow: 'hidden', cursor: 'pointer',
      border: isFeat && isFlash
        ? `1.5px solid ${hov ? T.red : '#f0a8a0'}`
        : isFeat
        ? `1.5px solid ${hov ? T.amber : '#e8d9a8'}`
        : isFlash
        ? `1.5px solid ${T.red}55`
        : `1px solid ${hov ? T.gray200 : T.gray100}`,
      boxShadow: isFeat && isFlash
        ? (hov ? '0 10px 28px rgba(234,67,53,0.28)' : '0 4px 16px rgba(0,0,0,0.1)')
        : hov
          ? (isFeat ? '0 10px 26px rgba(0,0,0,0.12)' : T.shadowMd)
          : isFeat
            ? '0 4px 16px rgba(0,0,0,0.1)'
            : T.shadow,
      transform: hov ? 'translateY(-3px)' : 'none',
      transition: 'all 0.2s ease', animation: `fadeUp 0.4s ease ${delay}s both`,
      display: 'flex', flexDirection: 'column', height: 220,
      position: 'relative',
    }}>
      <div style={{ width: '100%', height: '62%', flexShrink: 0, overflow: 'hidden', position: 'relative', background: T.gray100, borderRadius: '12px 12px 0 0' }}>
        {listing.images?.[0] && !imgErr
          ? <img src={listing.images[0]} alt={listing.title} onError={() => setImgErr(true)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: hov ? 'scale(1.07)' : 'scale(1)', transition: 'transform 0.5s cubic-bezier(0.34,1.2,0.64,1)' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, color: T.gray400, background: T.gray100 }}>{catIcon(listing.category).emoji}</div>
        }
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', flexDirection: 'column', gap: 5, zIndex: 2 }}>
          {isFeat && isFlash ? (
            <div className="soko-hotdeal-pulse" style={{ background: `linear-gradient(135deg,${T.red},#c62828)`, color: '#fff', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(234,67,53,0.5)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
                <path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z"/>
              </svg>
            </div>
          ) : (
            <>
              {isFeat && (
                <div style={{ display:'flex', alignItems:'center', gap:3, background:'#FF7A1A', color:'#fff', padding:'3px 8px', fontSize:9.5, fontWeight:800, borderRadius:50, boxShadow:'0 2px 6px rgba(255,122,26,0.4)', width:'fit-content' }}>
                  {Icon.star(9, '#fff')} Featured
                </div>
              )}
              {isFlash && (
                <div className="soko-hotdeal-pulse" style={{ background: `linear-gradient(135deg,${T.red},#c62828)`, color: '#fff', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(234,67,53,0.5)' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#fff">
                    <path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z"/>
                  </svg>
                </div>
              )}
            </>
          )}
        </div>

        
      </div>

      <div style={{ padding: '8px 10px 8px', background: '#fff', height: '38%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: T.gray900, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>{listing.title}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontSize: 13.5, fontWeight: 800, color: isFlash ? T.red : T.gray900, letterSpacing: '-0.3px', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.2 }}>{formatPrice(price)}</span>
          {isFlash && listing.price > price && (
            <>
              <span style={{ fontSize: 10.5, fontWeight: 600, color: T.gray500, textDecoration: 'line-through', whiteSpace: 'normal' }}>{formatPrice(listing.price)}</span>
              <span style={{ fontSize: 9.5, fontWeight: 800, color: T.red }}>-{Math.round((1 - price / listing.price) * 100)}%</span>
            </>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: T.gray600 }}>
            <span style={{ color: T.green }}>{Icon.pin(13)}</span>
            <span>{listing.city || 'Malawi'}</span>
          </div>
          {isVerif && Icon.verify(13)}
        </div>
      </div>
    </div>
  )
}

function SkeletonListingCard({ large = false }) {
  return (
    <div className="soko-card-bg" style={{ background: T.white, borderRadius: 12, overflow: 'hidden', border: `1px solid ${T.gray100}`, height: large ? 360 : 220, display: 'flex', flexDirection: 'column' }}>
      <div className="skeleton" style={{ width: '100%', height: '62%' }} />
      <div style={{ padding: '8px 10px', height: '38%', display: 'flex', flexDirection: 'column', gap: 6, background: '#fff', justifyContent: 'center' }}>
        <div className="skeleton" style={{ height: 12, width: '90%', borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 14, width: '50%', borderRadius: 4 }} />
        <div className="skeleton" style={{ height: 10, width: '40%', borderRadius: 4 }} />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   LIVE STORIES CARD — compact boxed card matching the reference exactly:
   circular avatars in a row, "View all" link, "Create Story" CTA. This is
   a thin presentational wrapper around the same fetchAllActiveStories data
   HomeStatusRow uses, but sized for the side-column slot next to Featured
   Listings rather than HomeStatusRow's full-width dark bar (which has
   200×340px cards and wouldn't fit this slot). Clicking a story or
   "Create Story" defers to the parent's handlers, which open the real
   StoryViewer / StatusUploadModal already wired up in HomeStatusRow.
───────────────────────────────────────────────────────────────────────────── */
function LiveStoriesCard({ navigate, stories, loading, onOpenStory, onCreateStory }) {
  const groups = useMemo(() => {
    const seen = new Map()
    for (const s of stories) {
      if (!seen.has(s.user_id)) seen.set(s.user_id, s)
    }
    return [...seen.values()].slice(0, 4)
  }, [stories])

  const RING_COLORS = ['linear-gradient(135deg,#0F9D58,#0a7a44)', '#ea4335', '#1A73E8', '#7c5cff']

  return (
    <div className="soko-card-bg" style={{ background: '#fff', borderRadius: 18, border: `1px solid ${T.gray200}`, boxShadow: T.shadow, padding: 18, height: '100%', display: 'flex', flexDirection: 'column' }}>
     

      <div style={{ display: 'flex', gap: 14, marginBottom: 16, flexWrap: 'wrap' }}>
        {loading
          ? [1,2,3,4].map(i => <div key={i} className="skeleton" style={{ width: 52, height: 52, borderRadius: '50%' }} />)
          : groups.length > 0
            ? groups.map((s, i) => (
              <button key={s.user_id} onClick={() => onOpenStory(s)} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, width: 56 }}>
                <div style={{ position:'relative', width:52, height:52 }}>
  <div style={{ width:52, height:52, borderRadius:'50%', padding:2, background:RING_COLORS[i % RING_COLORS.length], display:'flex', alignItems:'center', justifyContent:'center' }}>
    <div style={{ width:'100%', height:'100%', borderRadius:'50%', overflow:'hidden', border:'2px solid #fff', background:T.gray100, display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, color:T.gray600 }}>
      {s.profiles?.avatar_url
        ? <img src={s.profiles.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        : (s.profiles?.full_name?.[0] || 'S').toUpperCase()
      }
    </div>
  </div>
  {i === 0 && (
    <div style={{ position:'absolute', bottom:-6, left:'50%', transform:'translateX(-50%)', background:T.red, color:'#fff', fontSize:8, fontWeight:800, borderRadius:50, padding:'2px 5px', whiteSpace:'nowrap', border:'1.5px solid #fff' }}>+LIVE</div>
  )}
</div>
                <span style={{ fontSize: 10, fontWeight: 600, color: T.gray800, maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.profiles?.full_name?.split(' ')[0] || 'Seller'}
                </span>
              </button>
            ))
            : <p style={{ fontSize: 12.5, color: T.gray600 }}>No active stories right now.</p>
        }
      </div>

      <p style={{ fontSize: 12, color: T.gray600, lineHeight: 1.5, marginBottom: 14, textAlign: 'center' }}>
        Create a story to showcase your product. Stories disappear in 24 hours.
      </p>

      <button onClick={onCreateStory} className="soko-btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 'auto' }}>
        {Icon.plus(14)} Create Story
      </button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   FEATURED LISTINGS + LIVE STORIES — two-column row matching the reference:
   Featured Listings (wide, horizontal scroll) on the left, Live Stories
   (compact card) on the right.
───────────────────────────────────────────────────────────────────────────── */
function FeaturedListingsRow({ listings, navigate, loading, stories, storiesLoading, onOpenStory, onCreateStory }) {
  // Phase 3.1: dedicated featured rows only — never derived from latest posts
  const featured = useMemo(
    () => (listings || []).filter(l => isListingFeatured(l)),
    [listings],
  )
  if (!loading && featured.length === 0) return null
  return (
    <section className="soko-section-pad soko-featured-section" style={{ padding: '24px 20px 4px', background: '#fff' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 14, gap: 12,
        }}>
          <span className="soko-section-title" style={{ fontFamily: T.fontDisplay, fontSize: 18, fontWeight: 800, color: T.gray900 }}>
            Featured Listings
          </span>
          <button
            type="button"
            onClick={() => navigate('/listings')}
            style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: T.green, cursor: 'pointer', flexShrink: 0 }}
          >
            View all
          </button>
        </div>

        <div className="soko-featured-stories-grid" style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) 260px',
          gap: 16,
          alignItems: 'start',
        }}>

          {/* Featured listings — horizontal snap rail (padding keeps top yellow edge visible) */}
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div className="soko-scroll soko-featured-rail" style={{
              display: 'flex', gap: 12, overflowX: 'auto',
              paddingTop: 4,
              paddingBottom: 8,
              width: '100%',
              scrollSnapType: 'x mandatory',
              WebkitOverflowScrolling: 'touch',
            }}>
              {loading
                ? [1, 2, 3, 4].map(i => (
                  <div key={i} className="soko-featured-card-wrap" style={{ flexShrink: 0, width: 175, scrollSnapAlign: 'start' }}>
                    <SkeletonListingCard />
                  </div>
                ))
                : featured.slice(0, 10).map((l, i) => (
                  <div key={l.id} className="soko-featured-card-wrap" style={{ flexShrink: 0, width: 175, scrollSnapAlign: 'start' }}>
                    <PremiumListingCard
                      listing={l}
                      delay={i * 0.04}
                      onClick={() => navigate('/listing/' + l.id)}
                    />
                  </div>
                ))}
            </div>
          </div>

          {/* Live Stories — desktop only in this column */}
          <div className="soko-nav-desktop" style={{ width: 260, flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 800, color: T.gray900 }}>Live Stories</span>
              <button type="button" onClick={() => navigate('/status')} style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: T.green, cursor: 'pointer' }}>View all</button>
            </div>
            <LiveStoriesCard
              navigate={navigate} stories={stories}
              loading={storiesLoading} onOpenStory={onOpenStory}
              onCreateStory={onCreateStory}
            />
          </div>
        </div>

        {/* Mobile: compact stories strip (desktop uses right column) */}
        <div className="soko-stories-mobile" style={{ display: 'none', marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
            <span className="soko-section-title" style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 800, color: T.gray900 }}>Live Stories</span>
            <button type="button" onClick={() => navigate('/status')} style={{ background: 'none', border: 'none', fontSize: 13, fontWeight: 600, color: T.green, cursor: 'pointer', minHeight: 44, minWidth: 44 }}>View all</button>
          </div>
          <div className="soko-scroll" style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 4, WebkitOverflowScrolling: 'touch' }}>
            <button
              type="button"
              onClick={onCreateStory}
              style={{
                flexShrink: 0, width: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              }}
            >
              <div style={{
                width: 56, height: 56, borderRadius: '50%', border: `2px dashed ${T.gray300}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: T.green, background: T.gray50,
              }}>
                {Icon.plus(18)}
              </div>
              <span style={{ fontSize: 10, fontWeight: 600, color: T.gray700 }}>Yours</span>
            </button>
            {storiesLoading
              ? [1, 2, 3, 4].map(i => (
                <div key={i} className="skeleton" style={{ flexShrink: 0, width: 56, height: 56, borderRadius: '50%' }} />
              ))
              : (stories || []).slice(0, 12).map((s, i) => (
                <button
                  key={s.id || i}
                  type="button"
                  onClick={() => onOpenStory?.(s, i)}
                  style={{
                    flexShrink: 0, width: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                  }}
                >
                  <div style={{
                    width: 56, height: 56, borderRadius: '50%', padding: 2,
                    background: `linear-gradient(135deg, ${T.amber}, ${T.green})`,
                  }}>
                    <div style={{
                      width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden',
                      border: '2px solid #fff', background: T.gray100,
                    }}>
                      {s.profiles?.avatar_url || s.media_url
                        ? <img src={s.profiles?.avatar_url || s.media_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 700, color: T.gray500 }}>
                            {(s.profiles?.full_name || 'S')[0]}
                          </div>}
                    </div>
                  </div>
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: T.gray800, maxWidth: 60,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {s.profiles?.full_name?.split(' ')[0] || 'Seller'}
                  </span>
                </button>
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

function LatestListingCard({ listing, delay = 0, onClick }) {
  const [hov, setHov]       = useState(false)
  const [liked, setLiked]   = useState(false)
  const [imgErr, setImgErr] = useState(false)

  const isVerif = listing.seller_verified || listing.shop_is_verified
  const isNew   = listing.created_at && (Date.now() - new Date(listing.created_at).getTime()) < 86400000
  const isFeat  = isListingFeatured(listing)
  const isFlash = isFlashActive(listing)
  const meta    = catIcon(listing.category)
  const trustCount = listing.view_count ?? listing.inquiry_count ?? null

  function handleLike(e) {
    e.stopPropagation()
    setLiked(l => !l)
  }

  return (
    <div
      className="soko-latest-card"
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.white,
        borderRadius: T.radius,
        overflow: 'hidden',
        cursor: 'pointer',
        border: isFeat && isFlash
          ? `1.5px solid ${hov ? T.red : T.amber}`
          : isFeat ? `1.5px solid ${hov ? T.amber : '#f5dfa3'}`
          : isFlash ? `1.5px solid ${T.red}44`
          : `1px solid ${hov ? '#cdeedc' : T.gray100}`,
        boxShadow: isFeat && isFlash
          ? '0 10px 28px rgba(249,171,0,0.18), 0 4px 14px rgba(234,67,53,0.16)'
          : hov ? '0 18px 40px rgba(15,23,42,0.14), 0 6px 14px rgba(15,157,88,0.10)' : T.shadow,
        transform: hov ? 'translateY(-6px)' : 'translateY(0)',
        transition: 'transform 0.32s cubic-bezier(0.22,1,0.36,1), box-shadow 0.32s ease, border-color 0.32s ease',
        animation: `fadeUp 0.5s cubic-bezier(0.22,1,0.36,1) ${delay}s both`,
        display: 'flex', flexDirection: 'column',
        height: '100%',
        minWidth: 0,
      }}
    >
      {/* Photo stage — ~65% of card height via a fixed-height band rather than
          aspect-ratio, so the body (title/price/meta) keeps a consistent height
          across cards regardless of image shape. */}
      <div className="soko-latest-photo" style={{ position: 'relative', width: '100%', height: 168, flexShrink: 0, overflow: 'hidden', background: T.gray100 }}>
        {listing.images?.[0] && !imgErr ? (
          <img
            src={listing.images[0]}
            alt={listing.title}
            loading="lazy"
            decoding="async"
            onError={() => setImgErr(true)}
            style={{
              width: '100%', height: '100%', objectFit: 'cover',
              transform: hov ? 'scale(1.07)' : 'scale(1)',
              transition: 'transform 0.5s cubic-bezier(0.22,1,0.36,1)',
            }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 38, color: T.gray400 }}>
            {meta.emoji}
          </div>
        )}

        {/* Badge stack: Featured / Hot Deal take priority over NEW, since they
            carry monetization signal — but both can co-occur (stacked), and
            NEW still shows if there's room and nothing else present. */}
        <div className="soko-latest-badge-stack" style={{ position: 'absolute', top: 10, left: 10, zIndex: 3, display: 'flex', flexDirection: 'column', gap: 5 }}>
         {isFeat && isFlash ? (
            <span className="soko-hotdeal-pulse" style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: `linear-gradient(135deg,${T.red},#c62828)`, color: '#fff', borderRadius: '50%',
              width: 24, height: 24, boxShadow: '0 3px 10px rgba(234,67,53,0.5)',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff">
                <path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z"/>
              </svg>
            </span>
          ) : (
            <>
              {isFeat && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, width: 'fit-content',
                  background: '#FF7A1A', color: '#fff', borderRadius: 50,
                  padding: '6px 14px', fontSize: 11.5, fontWeight: 800, lineHeight: 1,
                  boxShadow: '0 3px 10px rgba(255,122,26,0.4)', whiteSpace: 'nowrap',
                }}>{Icon.star(12, '#fff')} Featured</span>
              )}
              {isFlash && (
                <span className="soko-hotdeal-pulse" style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  background: `linear-gradient(135deg,${T.red},#c62828)`, color: '#fff', borderRadius: '50%',
                  width: 24, height: 24, boxShadow: '0 3px 10px rgba(234,67,53,0.5)',
                }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#fff">
                    <path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z"/>
                  </svg>
                </span>
              )}
            </>
          )}
          {isNew && !isFeat && !isFlash && (
            <span style={{
              display: 'inline-flex', alignItems: 'center', width: 'fit-content',
              height: 21, boxSizing: 'border-box',
              background: T.green, color: '#fff', borderRadius: 50,
              padding: '0 9px 0 8px', fontSize: 9.5, fontWeight: 800, lineHeight: 1,
              letterSpacing: 0.4, boxShadow: '0 3px 10px rgba(15,157,88,0.4)',
              whiteSpace: 'nowrap',
            }}>
              <span style={{ width: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#fff', animation: 'pulse 1.8s ease-in-out infinite' }} />
              </span>
              NEW
            </span>
          )}
        </div>

        {/* Wishlist — floating circular, fills on like */}
        <button
          className="soko-latest-wish"
          onClick={handleLike}
          aria-label={liked ? 'Remove from wishlist' : 'Add to wishlist'}
          style={{
            position: 'absolute', top: 9, right: 9, zIndex: 4,
            width: 30, height: 30, borderRadius: '50%', border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: liked ? T.red : T.gray700,
            boxShadow: '0 3px 10px rgba(0,0,0,0.15)',
            transform: hov || liked ? 'scale(1)' : 'scale(0.92)',
            opacity: hov || liked ? 1 : 0.88,
            transition: 'transform 0.2s cubic-bezier(0.34,1.4,0.64,1), opacity 0.2s, color 0.2s',
          }}
        >
          {Icon.heart(14, liked ? 'currentColor' : 'none')}
        </button>
      </div>

      {/* Body — title first, then price, then location/time. Verified now lives
          here as a small inline mark next to the title, not a loud image badge. */}
      <div className="soko-latest-body" style={{ padding: '13px 14px 14px', display: 'flex', flexDirection: 'column', gap: 7, flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          <span className="soko-latest-title" style={{
            fontSize: 13.5, fontWeight: 700, color: T.gray900, lineHeight: 1.3,
            overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical',
            minWidth: 0,
          }}>
            {listing.title}
          </span>
          {isVerif && (
            <span title="Verified seller" style={{ flexShrink: 0, display: 'flex', opacity: 0.9 }}>
              {Icon.verify(13)}
            </span>
          )}
        </div>

        <div className="soko-latest-price" style={{ fontFamily: T.fontDisplay, fontSize: 16.5, fontWeight: 800, color: T.greenD, letterSpacing: '-0.3px', whiteSpace: 'normal', wordBreak: 'break-word', lineHeight: 1.2 }}>
          {formatPrice(listing.price)}
        </div>

        <div className="soko-latest-meta" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: T.gray600, gap: 4, minWidth: 0 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
            <span style={{ color: T.green, flexShrink: 0, display: 'flex' }}>{Icon.pin(11)}</span>
            {listing.city || 'Malawi'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, color: T.gray500 }}>
            {Icon.clock(10)} {timeSincePosted(listing.created_at)}
          </span>
        </div>

        {/* Trust indicator — views or inquiries, only renders if data exists */}
        {trustCount != null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: T.gray500, paddingTop: 2, borderTop: `1px solid ${T.gray100}`, marginTop: 1 }}>
            {Icon.eye(11)} {trustCount.toLocaleString()} {listing.view_count != null ? 'views' : 'inquiries'}
          </div>
        )}
      </div>
    </div>
  )
}

function SkeletonLatestCard() {
  return (
    <div className="soko-latest-card" style={{ background: T.white, borderRadius: T.radius, overflow: 'hidden', border: `1px solid ${T.gray100}`, height: '100%' }}>
      <div className="skeleton soko-latest-photo" style={{ width: '100%', height: 168 }} />
      <div className="soko-latest-body" style={{ padding: '13px 14px 14px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="skeleton" style={{ height: 14, width: '80%', borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 17, width: '45%', borderRadius: 6 }} />
        <div className="skeleton" style={{ height: 11, width: '60%', borderRadius: 6 }} />
      </div>
    </div>
  )
}

function LatestListingsSection({ listings, navigate, loading }) {
  const PAGE_SIZE = 8
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  const sorted = useMemo(() =>
    [...listings].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)),
  [listings])

  const latest = sorted.slice(0, visibleCount)
  const hasMore = visibleCount < sorted.length

  if (!loading && sorted.length === 0) return null

  return (
    <section className="soko-latest-section" style={{ padding: '0 20px clamp(28px,4.5vw,48px) 20px', background: T.gray50 }}>
      <style>{`
        .soko-latest-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 24px;
        }
        .soko-latest-card-wrap {
          min-width: 0;
          width: 100%;
        }
        @media (max-width: 980px) {
          .soko-latest-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 14px; }
        }
        @media (max-width: 560px) {
          .soko-latest-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
          .soko-latest-head { margin-bottom: 14px !important; align-items: stretch !important; }
          .soko-latest-head h2 { font-size: 18px !important; margin-bottom: 2px !important; }
          .soko-latest-head p { font-size: 12.5px !important; }
          .soko-latest-viewall {
            width: 100%;
            justify-content: center !important;
            min-height: 44px;
            margin-top: 4px;
          }
        }
      `}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div className="soko-latest-head" style={{
          display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
          marginBottom: 24, flexWrap: 'wrap', gap: 12,
        }}>
          <div style={{ minWidth: 0, flex: '1 1 180px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: T.green, boxShadow: `0 0 0 4px ${T.greenL}` }} />
              <span style={{ fontSize: 11.5, fontWeight: 800, color: T.green, letterSpacing: 0.8, textTransform: 'uppercase' }}>Updated daily</span>
            </div>
            <h2 style={{ fontFamily: T.fontDisplay, fontSize: 'clamp(20px, 2.6vw, 27px)', fontWeight: 800, color: T.gray900, letterSpacing: '-0.6px', marginBottom: 5 }}>
              Latest Listings
            </h2>
            <p style={{ fontSize: 13.5, color: T.gray600 }}>Fresh products added across Malawi</p>
          </div>

          <button
            type="button"
            onClick={() => navigate('/listings')}
            className="soko-btn-primary soko-latest-viewall"
            style={{ background: T.green, fontSize: 13.5, padding: '11px 22px', flexShrink: 0 }}
            onMouseEnter={e => e.currentTarget.style.background = T.greenD}
            onMouseLeave={e => e.currentTarget.style.background = T.green}
          >
            View All Listings {Icon.chevR(15)}
          </button>
        </div>

        <div className="soko-latest-grid">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="soko-latest-card-wrap"><SkeletonLatestCard /></div>
              ))
            : latest.map((l, i) => (
                <div key={l.id} className="soko-latest-card-wrap">
                  <LatestListingCard
                    listing={l}
                    delay={Math.min(i, 8) * 0.03}
                    onClick={() => navigate('/listing/' + l.id)}
                  />
                </div>
              ))
          }
        </div>

        {!loading && hasMore && (
          <div style={{ display: 'flex', justifyContent: 'center', marginTop: 20 }}>
            <button
              type="button"
              onClick={() => setVisibleCount(c => c + PAGE_SIZE)}
              className="soko-btn-outline"
              style={{
                background: '#fff', color: T.gray800, border: `1.5px solid ${T.gray200}`,
                minHeight: 44, padding: '11px 28px', fontSize: 13.5, fontWeight: 700,
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = T.green; e.currentTarget.style.color = T.green }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = T.gray200; e.currentTarget.style.color = T.gray800 }}
            >
              Show more listings
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

/* Fallback emoji for card image placeholder only */
const CAT_FALLBACK_EMOJI = {
  Vehicles:'🚘', Electronics:'📱', Property:'🏡', Clothing:'👔',
  Agriculture:'🌿', Furniture:'🛋️', Food:'🍜', Services:'⚡', Jobs:'💼',
}
function catFallbackEmoji(cat) { return CAT_FALLBACK_EMOJI[cat] || '📦' }

/* ── Priority badge config ───────────────────────────────────────────────── */
const PRIORITY = {
  urgent:     { label: 'Urgent',      badgeBg: '#ef4444', badgeFg: '#fff' },
  highbudget: { label: 'High Budget', badgeBg: '#7c3aed', badgeFg: '#fff' },
  new:        { label: 'New',         badgeBg: '#3b82f6', badgeFg: '#fff' },
}

function getPriority(r) {
  if (r.urgency === 'urgent') return 'urgent'
  if (r.budget && Number(r.budget) >= 300_000) return 'highbudget'
  return 'new'
}

function expiryInfo(r) {
  const exp = r.expires_at || r.deadline
  if (!exp) return { label: 'Open', color: '#16a34a', bg: '#f0fdf4', dotColor: '#16a34a' }
  const days = Math.ceil((new Date(exp) - Date.now()) / 86400000)
  if (days <= 0)  return { label: 'Closing today',    color: '#ef4444', bg: '#fef2f2', dotColor: '#ef4444' }
  if (days === 1) return { label: 'Closing in 1 day', color: '#ef4444', bg: '#fef2f2', dotColor: '#ef4444' }
  if (days <= 3)  return { label: 'Closing Soon',     color: '#f59e0b', bg: '#fffbeb', dotColor: '#f59e0b' }
  return { label: `Expires in ${days} days`, color: '#7c3aed', bg: '#faf5ff', dotColor: '#7c3aed' }
}

/* Category colors for chips & card badges */
function catColors(cat) {
  const m = {
    Vehicles:    { bg:'#e9f7ec', fg:'#16a34a' },
    Electronics: { bg:'#eff6ff', fg:'#2563eb' },
    Property:    { bg:'#fff7ed', fg:'#ea580c' },
    Clothing:    { bg:'#fdf4ff', fg:'#9333ea' },
    Agriculture: { bg:'#f0fdf4', fg:'#15803d' },
    Furniture:   { bg:'#fffbeb', fg:'#d97706' },
    Food:        { bg:'#fff1f2', fg:'#e11d48' },
    Services:    { bg:'#f0fdf4', fg:'#0a7a44' },
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
  <svg width="11" height="11" viewBox="0 0 24 24" fill="#0F9D58">
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
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#0F9D58" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
)
/* ── Urgent flame SVG ── */
const FlameSVG = () => (
  <svg width="11" height="11" viewBox="0 0 24 24" fill="#fff">
    <path d="M17.66 11.2C17.43 10.9 17.15 10.64 16.89 10.38C16.22 9.78 15.46 9.35 14.82 8.72C13.33 7.26 13 4.85 13.95 3C13 3.23 12.17 3.75 11.46 4.32C8.87 6.4 7.85 10.07 9.07 13.22C9.11 13.32 9.15 13.42 9.15 13.55C9.15 13.77 9 13.97 8.8 14.05C8.57 14.15 8.33 14.09 8.14 13.93C8.08 13.88 8.04 13.83 8 13.76C6.87 12.33 6.69 10.28 7.45 8.64C5.78 10 4.87 12.3 5 14.47C5.06 14.97 5.12 15.47 5.29 15.97C5.43 16.57 5.7 17.17 6 17.7C7.08 19.43 8.95 20.67 10.96 20.92C13.1 21.19 15.39 20.8 17.03 19.32C18.86 17.66 19.5 15 18.56 12.72L18.43 12.46C18.22 12 17.66 11.2 17.66 11.2Z"/>
  </svg>
)

/* ─────────────────────────────────────────────────────────────────────────── */

function RequestCard({ request: r, delay = 0, navigate }) {
  const [hov, setHov] = React.useState(false)
  const priority = getPriority(r)
  const pCfg     = PRIORITY[priority]
  const expiry   = expiryInfo(r)
  const isVerified = r.buyer_verified || r.requester_verified
  const cc = catColors(r.category)

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={() => navigate('/looking-for')}
      style={{
        flexShrink: 0,
        width: 238,
        maxWidth: 'min(238px, 78vw)',
        background: '#fff',
        borderRadius: 16,
        border: `1px solid ${hov ? '#d1d5db' : '#e5e7eb'}`,
        boxShadow: hov
          ? '0 20px 48px rgba(15,23,42,0.16), 0 4px 16px rgba(0,0,0,0.06)'
          : '0 1px 4px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)',
        transform: hov ? 'translateY(-6px) scale(1.012)' : 'translateY(0) scale(1)',
        transition: 'transform 0.28s cubic-bezier(0.22,1,0.36,1), box-shadow 0.28s ease, border-color 0.2s',
        animation: `fadeUp 0.45s cubic-bezier(0.22,1,0.36,1) ${delay}s both`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {/* ── Image + overlay badges ── */}
      <div style={{ position: 'relative', width: '100%', height: 162, background: '#f3f4f6', flexShrink: 0, overflow: 'hidden' }}>
        {r.image_url
          ? <img src={r.image_url} alt={r.title} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', transform: hov ? 'scale(1.06)' : 'scale(1)', transition: 'transform 0.5s cubic-bezier(0.22,1,0.36,1)' }} />
          : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 46, color: '#9ca3af' }}>
              {catFallbackEmoji(r.category)}
            </div>
        }

        {/* Priority badge — top left */}
        <div style={{ position: 'absolute', top: 10, left: 10, display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: pCfg.badgeBg, color: pCfg.badgeFg,
            borderRadius: 7, padding: '4px 9px',
            fontSize: 11, fontWeight: 700, lineHeight: 1,
            boxShadow: '0 2px 6px rgba(0,0,0,0.18)',
          }}>
            {priority === 'urgent' && <FlameSVG />}
            {pCfg.label}
          </span>
        </div>

        {/* Verified Buyer — top right */}
        <div style={{ position: 'absolute', top: 10, right: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            background: 'rgba(255,255,255,0.95)', backdropFilter: 'blur(4px)',
            borderRadius: 7, padding: '4px 8px',
            fontSize: 10.5, fontWeight: 700, color: '#15803d',
            boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
          }}>
            <VerifiedSVG />
            Verified Buyer
          </span>
        </div>

        {/* Category chip — bottom left of image */}
        <div style={{ position: 'absolute', bottom: 10, left: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            background: 'rgba(255,255,255,0.96)', backdropFilter: 'blur(4px)',
            borderRadius: 7, padding: '4px 9px',
            fontSize: 11, fontWeight: 700, color: cc.fg,
            boxShadow: '0 1px 6px rgba(0,0,0,0.10)',
          }}>
            <span style={{ color: cc.fg, display: 'flex', alignItems: 'center' }}>
              {React.cloneElement(getCatSVG(r.category), { width: 13, height: 13 })}
            </span>
            {catLabel(r.category)}
          </span>
        </div>
      </div>

      {/* ── Card body ── */}
      <div style={{ padding: '12px 13px 0 13px', display: 'flex', flexDirection: 'column', flex: 1 }}>

        {/* "LOOKING FOR" eyebrow */}
        <div style={{ fontSize: 9.5, fontWeight: 700, color: '#9ca3af', letterSpacing: 0.9, textTransform: 'uppercase', marginBottom: 4 }}>
          Looking For
        </div>

        {/* Title */}
        <div style={{ fontSize: 15, fontWeight: 700, color: '#111827', lineHeight: 1.3, marginBottom: 9, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical' }}>
          {r.title}
        </div>

        {/* Budget — HERO number */}
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontFamily: "'Sora','Inter',system-ui,sans-serif", fontSize: 20, fontWeight: 800, color: '#0F9D58', letterSpacing: '-0.4px', lineHeight: 1.1 }}>
            {r.budget ? `MK ${Number(r.budget).toLocaleString()}` : 'Negotiable'}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, marginTop: 2 }}>
            {r.is_monthly ? 'Monthly Budget' : 'Budget'}
          </div>
        </div>

        {/* Location + time */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 11, color: '#9ca3af', marginBottom: 9 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <PinSVG />
            {(r.cities?.[0] || r.city) || 'Malawi'}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <ClockSVG color="#9ca3af" />
            {timeSincePosted(r.created_at)}
          </span>
        </div>

        {/* Expiry pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600, color: expiry.color, background: expiry.bg, borderRadius: 7, padding: '5px 9px', marginBottom: 9 }}>
          {expiry.label === 'Open'
            ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: expiry.dotColor, flexShrink: 0, display: 'inline-block' }} />
            : <ClockSVG color={expiry.color} />
          }
          {expiry.label}
        </div>

        {/* Activity stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: '#6b7280', marginBottom: 12 }}>
          {r.offer_count != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <OfferSVG />
              <strong style={{ color: '#374151', fontWeight: 700 }}>{r.offer_count}</strong> Offers
            </span>
          )}
          {r.interested_count != null && (
            <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <HeartSVG />
              <strong style={{ color: '#374151', fontWeight: 700 }}>{r.interested_count}</strong> Interested
            </span>
          )}
          {/* fallback if neither field exists on DB row */}
          {r.offer_count == null && r.interested_count == null && (
            <span style={{ fontSize: 11, color: '#d1d5db' }}>No activity yet</span>
          )}
        </div>
      </div>

      {/* Contact Buyer CTA — full width, flush bottom */}
      <div style={{ padding: '0 13px 13px' }}>
        <button
          onClick={e => { e.stopPropagation(); navigate('/looking-for') }}
          style={{
            width: '100%', background: '#0F9D58', color: '#fff', border: 'none', borderRadius: 10,
            padding: '11px 0', fontSize: 13.5, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            transition: 'background 0.15s, transform 0.15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = '#0a7a44'; e.currentTarget.style.transform = 'translateY(-1px)' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#0F9D58'; e.currentTarget.style.transform = 'none' }}
        >
          <ChatSVG />
          Contact Buyer
        </button>
      </div>
    </div>
  )
}

function LookingForSection({ navigate, requests, loading }) {
  const scrollRef = React.useRef(null)
  const [canLeft,      setCanLeft]      = React.useState(false)
  const [canRight,     setCanRight]     = React.useState(false)
  const [activeFilter, setActiveFilter] = React.useState('all')

  function checkScroll() {
    const el = scrollRef.current
    if (!el) return
    setCanLeft(el.scrollLeft > 8)
    setCanRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 8)
  }

  React.useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setTimeout(checkScroll, 100)
    el.addEventListener('scroll', checkScroll, { passive: true })
    window.addEventListener('resize', checkScroll)
    return () => { el.removeEventListener('scroll', checkScroll); window.removeEventListener('resize', checkScroll) }
  }, [requests, activeFilter])

  function scrollBy(dir) { scrollRef.current?.scrollBy({ left: dir * 540, behavior: 'smooth' }) }

  const countFor = (key) => key === 'all' ? requests.length : requests.filter(r => r.category === key).length
  const filtered = (activeFilter === 'all' ? requests : requests.filter(r => r.category === activeFilter))
    .filter(r => r.status !== 'fulfilled')

  /* Arrow SVG inline */
  const ArrowL = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
  const ArrowR = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>

  return (
    <section className="soko-section-pad" style={{ padding: '0 20px 0 20px', background: '#fff' }}>
      <style>{`
        .lf3-arrow {
          position:absolute; top:50%; transform:translateY(-50%); z-index:10;
          width:38px; height:38px; border-radius:50%;
          background:#fff; border:1.5px solid #e5e7eb;
          display:flex; align-items:center; justify-content:center;
          cursor:pointer; box-shadow:0 2px 10px rgba(0,0,0,0.12);
          color:#374151; transition:all 0.2s; flex-shrink:0;
        }
        .lf3-arrow:hover { background:#0F9D58; border-color:#0F9D58; color:#fff; box-shadow:0 4px 16px rgba(15,157,88,0.35); transform:translateY(-50%) scale(1.08); }
        .lf3-arrow.hide  { opacity:0; pointer-events:none; }
        .lf3-chip {
          display:inline-flex; align-items:center; gap:7px;
          padding:7px 14px; border-radius:50px;
          border:1.5px solid #e5e7eb; background:#fff;
          font-size:13px; font-weight:600; color:#374151;
          cursor:pointer; white-space:nowrap; transition:all 0.15s;
          flex-shrink:0;
        }
        .lf3-chip.active { background:#0F9D58; border-color:#0F9D58; color:#fff; }
        .lf3-chip.active .lf3-chip-icon { color:#fff !important; }
        .lf3-chip:not(.active):hover { border-color:#0F9D58; color:#0F9D58; }
        .lf3-chip:not(.active):hover .lf3-chip-icon { color:#0F9D58 !important; }
        .lf3-count { background:#f3f4f6; color:#6b7280; border-radius:50px; padding:1px 8px; font-size:11px; font-weight:700; }
        .lf3-chip.active .lf3-count { background:rgba(255,255,255,0.22); color:#fff; }
        .lf3-scroll { display:flex; gap:16px; overflow-x:auto; padding-bottom:8px; padding-top:6px; padding-left:2px; padding-right:2px; scrollbar-width:none; -ms-overflow-style:none; -webkit-overflow-scrolling:touch; }
        .lf3-scroll::-webkit-scrollbar { display:none; }
        .lf3-chips { display:flex; gap:8px; overflow-x:auto; padding-bottom:2px; scrollbar-width:none; -ms-overflow-style:none; -webkit-overflow-scrolling:touch; }
        .lf3-chips::-webkit-scrollbar { display:none; }
        @media(max-width:768px){
          .lf3-arrow{display:none!important;}
          .lf3-chip { padding:8px 12px; font-size:12px; min-height:40px; }
          .lf3-scroll { gap:12px; }
        }
      `}</style>

      <div style={{ maxWidth: 1400, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div className="soko-lf-head" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 14 }}>
          <div style={{ minWidth: 0, flex: '1 1 200px' }}>
            <h2 style={{ fontFamily: "'Sora','Inter',system-ui,sans-serif", fontSize: 'clamp(20px,2.6vw,28px)', fontWeight: 800, color: '#111827', letterSpacing: '-0.6px', marginBottom: 6, lineHeight: 1.15 }}>
              People Looking For
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', margin: 0 }}>
              Connect with buyers actively searching for products and services.
            </p>
          </div>

          <div className="soko-lf-head-actions" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8, flexShrink: 0 }}>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              {/* View All */}
              <button
                type="button"
                onClick={() => navigate('/looking-for')}
                style={{ background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '10px 18px', fontSize: 13.5, fontWeight: 600, color: '#374151', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', transition: 'all 0.15s' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor='#0F9D58'; e.currentTarget.style.color='#0F9D58' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.color='#374151' }}
              >
                View All Requests
                <ArrowR />
              </button>

              {/* Post Request + FREE badge */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => navigate('/looking-for')}
                  style={{ background: '#0F9D58', color: '#fff', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap', transition: 'background 0.15s', boxShadow: '0 2px 10px rgba(15,157,88,0.3)' }}
                  onMouseEnter={e => e.currentTarget.style.background='#0a7a44'}
                  onMouseLeave={e => e.currentTarget.style.background='#0F9D58'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                  Post Request
                </button>
                <span style={{ position: 'absolute', top: -10, right: -10, background: '#F9AB00', color: '#1a0a00', fontSize: 9.5, fontWeight: 900, borderRadius: 50, padding: '2px 7px', letterSpacing: 0.4, border: '2px solid #fff', whiteSpace: 'nowrap', zIndex: 2 }}>
                  FREE
                </span>
              </div>
            </div>

            {/* Trust nudge */}
            <span style={{ fontSize: 11.5, color: '#9ca3af', display: 'flex', alignItems: 'center', gap: 4 }}>
              <CheckSVG color="#0F9D58" size={12} />
              Free to post · Get responses fast
            </span>
          </div>
        </div>

        {/* ── Category filter chips with SVG icons ── */}
        <div className="lf3-chips" style={{ marginBottom: 22 }}>
          {CAT_FILTERS.map(f => {
            const cc = catColors(f.key)
            const isActive = activeFilter === f.key
            return (
              <button
                key={f.key}
                className={`lf3-chip${isActive ? ' active' : ''}`}
                onClick={() => setActiveFilter(f.key)}
              >
                <span
                  className="lf3-chip-icon"
                  style={{
                    display: 'flex', alignItems: 'center',
                    color: isActive ? '#fff' : (f.key === 'all' ? '#0F9D58' : cc.fg),
                    transition: 'color 0.15s',
                  }}
                >
                  {React.cloneElement(
                    f.key === 'all' ? CatSVG.all : (CatSVG[f.key] || CatSVG.Other),
                    { width: 15, height: 15 }
                  )}
                </span>
                {f.label}
                <span className="lf3-count">{countFor(f.key)}</span>
              </button>
            )
          })}
          {/* Right arrow hint */}
          <button style={{ flexShrink: 0, background: '#fff', border: '1.5px solid #e5e7eb', borderRadius: '50%', width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', alignSelf: 'center', color: '#374151', transition: 'all 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor='#0F9D58'; e.currentTarget.style.color='#0F9D58' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor='#e5e7eb'; e.currentTarget.style.color='#374151' }}
          ><ArrowR /></button>
        </div>

        {/* ── Carousel ── */}
        {loading ? (
          <div style={{ display: 'flex', gap: 16 }}>
            {[1,2,3,4,5].map(i => (
              <div key={i} style={{ flexShrink: 0, width: 238, height: 430, borderRadius: 16, background: 'linear-gradient(90deg,#f0f0f0 25%,#e8e8e8 50%,#f0f0f0 75%)', backgroundSize: '600px 100%', animation: 'shimmer 1.4s infinite' }} />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div style={{ position: 'relative' }}>
            <button className={`lf3-arrow${canLeft ? '' : ' hide'}`} style={{ left: -20 }} onClick={() => scrollBy(-1)} aria-label="Scroll left"><ArrowL /></button>
            <button className={`lf3-arrow${canRight ? '' : ' hide'}`} style={{ right: -20 }} onClick={() => scrollBy(1)} aria-label="Scroll right"><ArrowR /></button>
            <div ref={scrollRef} className="lf3-scroll">
              {filtered.map((r, i) => (
                <RequestCard key={r.id} request={r} delay={i * 0.04} navigate={navigate} />
              ))}
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '52px 24px', border: '1.5px dashed #e5e7eb', borderRadius: 16, background: '#fafafa' }}>
            <div style={{ fontSize: 42, marginBottom: 12 }}>🛍️</div>
            <p style={{ fontSize: 14.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>No requests in this category yet.</p>
            <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 18 }}>Be the first to post what you need!</p>
            <button onClick={() => navigate('/looking-for')} style={{ background: '#0F9D58', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 24px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>
              Post a Request
            </button>
            <p style={{ fontSize: 11.5, color: '#9ca3af', marginTop: 9 }}>Free · Responses within minutes</p>
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
        .shop-arrow:hover { background: #0F9D58; border-color: #0F9D58; color: #fff; box-shadow: 0 4px 18px rgba(15,157,88,0.35); transform: translateY(-50%) scale(1.08); }
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
          width: 100%; background: #0F9D58; color: #fff; border: none;
          padding: 11px 0; font-size: 13.5px; font-weight: 700; cursor: pointer;
          transition: background 0.15s;
        }
        .visit-btn:hover { background: #0a7a44; }
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
                      <div style={{ width: '100%', height: '100%', background: `linear-gradient(135deg, ${T.greenDk} 0%, ${T.green} 60%, ${T.amber}44 100%)` }} />
                    )}
                    {/* Gradient overlay at bottom for logo overlap */}
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 48, background: 'linear-gradient(to bottom, transparent, rgba(0,0,0,0.18))' }} />
                  </div>

                  {/* Logo — overlapping cover */}
                  <div style={{ display: 'flex', justifyContent: 'center', marginTop: -28, marginBottom: 10, position: 'relative', zIndex: 2 }}>
                    <div className="shop-logo-wrap" style={{
                      width: 56, height: 56, borderRadius: '50%',
                      border: '3px solid #fff',
                      background: s.logo_url ? 'transparent' : `linear-gradient(135deg, ${T.green}, ${T.greenD})`,
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
                  <div style={{ width: 48, height: 48, borderRadius: '50%', background: T.greenL, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', color: T.green }}>
                    {Icon.plus(22)}
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 700, color: T.gray800, marginBottom: 6 }}>Open Your Shop</div>
                  <div style={{ fontSize: 11.5, color: T.gray600, lineHeight: 1.5, marginBottom: 14 }}>Reach buyers across all of Malawi</div>
                  <span style={{ background: T.green, color: '#fff', borderRadius: 8, padding: '8px 16px', fontSize: 12.5, fontWeight: 700 }}>Get Started</span>
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
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: T.greenL, color: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{Icon.wrench(17)}</div>
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

function ShopMiniCard({ shop, navigate }) {
  return (
    <div onClick={() => navigate('/shop/' + shop.slug)} className="soko-card-bg soko-card-hover" style={{ background: '#fff', border: `1px solid ${T.gray200}`, borderRadius: 14, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0, overflow: 'hidden',
        background: shop.logo_url ? 'transparent' : `linear-gradient(135deg, ${T.green}, ${T.greenD})`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 800, fontSize: 14,
      }}>
        {shop.logo_url ? <img src={shop.logo_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (shop.name?.[0] || 'S').toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: T.gray900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shop.name}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: T.gray600 }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {Icon.star(11)} {shop.rating ? Number(shop.rating).toFixed(1) : 'New'}
            {shop.review_count > 0 && <span style={{ color: T.gray500 }}>({shop.review_count})</span>}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, marginTop: 1 }}>
          <span style={{ color: T.gray500 }}>{shop.listing_count || 0} Listings</span>
          {shop.is_verified && <span style={{ color: T.green, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>{Icon.check(10)} Verified Shop</span>}
        </div>
      </div>
    </div>
  )
}

function ShopsJobsServicesRow({ navigate, shops, jobs, services, loading }) {
  return (
    <section style={{ padding: 'clamp(24px,4vw,40px) 20px', background: '#fff' }}>
      <div style={{ maxWidth: 1400, margin: '0 auto' }}>
        <div className="soko-jobs-services" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

          <div>
            <SectionHeader title="Shops & Shops" subtitle="Discover trusted sellers" action={{ label: 'View all shops', onClick: () => navigate('/shops') }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {loading
                ? [1,2,3].map(i => <div key={i} className="skeleton" style={{ height: 58, borderRadius: 14 }} />)
                : shops.length > 0
                  ? shops.slice(0, 4).map(s => <ShopMiniCard key={s.id} shop={s} navigate={navigate} />)
                  : <EmptyMini text="No shops yet." cta="Open a Shop" onClick={() => navigate('/shop-setup')} />
              }
            </div>
          </div>

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
                      <div style={{ width: 38, height: 38, borderRadius: 10, background: T.greenL, color: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{Icon.wrench(17)}</div>
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

function EmptyMini({ text, cta, onClick }) {
  return (
    <div style={{ textAlign: 'center', padding: '24px 16px', border: `1.5px dashed ${T.gray200}`, borderRadius: 14 }}>
      <p style={{ fontSize: 13, color: T.gray600, marginBottom: 10 }}>{text}</p>
      <button onClick={onClick} style={{ background: T.greenL, color: T.green, border: 'none', borderRadius: 10, padding: '7px 16px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>{cta}</button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   VERIFICATION TRUST SECTION
───────────────────────────────────────────────────────────────────────────── */
function VerificationTrustSection({ navigate, stats }) {
  return (
    <section style={{ padding: '20px 20px', background: '#fff', borderTop: `1px solid ${T.gray100}` }}>
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: '0 0 auto' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: T.greenL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {Icon.shieldCheck(26)}
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: T.gray900 }}>Trade with confidence</div>
            <div style={{ fontSize: 12.5, color: T.gray600 }}>
              <span style={{ textDecoration: 'underline', cursor: 'pointer', color: T.green }} onClick={() => navigate('/listings')}>Choose verified sellers</span> and shops for a safer experience.
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 32, flex: 1, flexWrap: 'wrap' }}>
          {[
            { stat: stats.sellers || '12K+', label: 'Verified Sellers' },
            { stat: stats.shops   || '850+', label: 'Verified Shops'   },
            { stat: stats.reviews || '98%',  label: 'Positive Reviews' },
          ].map(item => (
            <div key={item.label}>
              <div style={{ fontFamily: T.fontDisplay, fontSize: 22, fontWeight: 800, color: T.green }}>{item.stat}</div>
              <div style={{ fontSize: 12, color: T.gray600 }}>{item.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 14, background: T.gray50, border: `1px solid ${T.gray200}`, borderRadius: 14, padding: '14px 20px', flexShrink: 0 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: T.greenL, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {Icon.shieldCheck(20)}
          </div>
          <div>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.gray900 }}>Become a Verified Seller</div>
            <div style={{ fontSize: 12, color: T.gray600 }}>Build trust and sell more.</div>
          </div>
          <button onClick={() => navigate('/profile')} style={{ background: '#fff', border: `1.5px solid ${T.gray200}`, borderRadius: 50, padding: '9px 18px', fontSize: 13, fontWeight: 700, color: T.gray800, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
            Get Verified {Icon.check(14)}
          </button>
        </div>
      </div>
    </section>
  )
}

/* ─────────────────────────────────────────────────────────────────────────────
   SELLER CONVERSION SECTION
───────────────────────────────────────────────────────────────────────────── */
const SellCtaIcon = {
  free: (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9.5a2.5 2.5 0 0 1 5 0c0 1.5-2 2-2.5 3.2M12 17h.01"/></svg>,
  reach: (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18 14 14 0 0 1 0-18z"/></svg>,
  fast: (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h7l-1 8 10-12h-7z"/></svg>,
  noFee: (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9"/><path d="M9 9l6 6M15 9l-6 6"/></svg>,
}

function SellCtaBanner({ navigate }) {
  const benefits = [
    { icon: SellCtaIcon.free,  label: "It's Free",      sub: 'List in minutes'     },
    { icon: SellCtaIcon.reach, label: 'Reach Millions', sub: 'Nationwide exposure' },
    { icon: SellCtaIcon.fast,  label: 'Sell Faster',    sub: 'Get real results'    },
    { icon: SellCtaIcon.noFee, label: 'No Commission',  sub: 'Keep what you earn'  },
  ]
  return (
    <section style={{ padding: '20px 20px clamp(28px,4vw,40px) 20px', background: T.gray900 }}>
      <div style={{
        maxWidth: 1400, margin: '0 auto', background: T.greenDk, borderRadius: 20,
        padding: 'clamp(24px,3vw,36px) clamp(24px,3.5vw,40px)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 32, flexWrap: 'wrap', position: 'relative', overflow: 'hidden',
      }}>

        <div style={{ flex: '1 1 260px', position: 'relative', zIndex: 1 }}>
          <h2 style={{ fontFamily: T.fontDisplay, fontSize: 'clamp(22px,2.8vw,30px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.7px', marginBottom: 6 }}>
            Have something to sell?
          </h2>
          <p style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', marginBottom: 18 }}>
            Join thousands of sellers on SokoMW today.
          </p>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button className="soko-btn-primary" onClick={() => navigate('/post')} style={{ background: T.green, fontSize: 13.5, padding: '11px 24px' }}>
              Sell Now
            </button>
            <button onClick={() => navigate('/profile')} style={{ background: 'rgba(255,255,255,0.08)', border: '1.5px solid rgba(255,255,255,0.2)', borderRadius: 14, padding: '11px 20px', fontSize: 13.5, fontWeight: 700, color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              {Icon.plus ? null : null}▶ How it Works
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'clamp(16px,2.5vw,32px)', flexWrap: 'wrap', flex: '1 1 320px', justifyContent: 'center', position: 'relative', zIndex: 1 }}>
          {benefits.map(b => (
            <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 140 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', color: T.amber, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{b.icon(15)}</div>
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap' }}>{b.label}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', whiteSpace: 'nowrap' }}>{b.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Decorative shop/car illustration */}
        <div className="soko-nav-desktop" style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexShrink: 0, position: 'relative', zIndex: 1 }}>
          <svg width="54" height="54" viewBox="0 0 48 48" fill="none">
            <rect x="6" y="14" width="36" height="28" rx="3" fill="rgba(255,255,255,0.12)"/>
            <path d="M6 14l3-8h30l3 8" stroke="rgba(255,255,255,0.55)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <path d="M16 22a8 8 0 0 0 16 0" stroke="rgba(255,255,255,0.65)" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
            <rect x="6" y="14" width="36" height="2.4" fill="rgba(255,255,255,0.3)"/>
          </svg>
          <svg width="58" height="40" viewBox="0 0 58 36" fill="none">
            <path d="M5 24 9 12c1-3 3-4 6-4h18c3 0 5 1 6 4l4 12" stroke={T.amber} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" fill="rgba(249,171,0,0.14)"/>
            <rect x="2" y="22" width="54" height="9" rx="3.5" fill={T.amber} fillOpacity="0.9"/>
            <rect x="13" y="13" width="13" height="9" rx="1.5" fill="rgba(6,61,35,0.6)"/>
            <rect x="28" y="13" width="13" height="9" rx="1.5" fill="rgba(6,61,35,0.6)"/>
            <circle cx="13" cy="31" r="5" fill="#1a1a1a"/>
            <circle cx="13" cy="31" r="2" fill="#555"/>
            <circle cx="45" cy="31" r="5" fill="#1a1a1a"/>
            <circle cx="45" cy="31" r="2" fill="#555"/>
          </svg>
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
    <div style={{ background: 'linear-gradient(90deg, #f59e0b11, #f59e0b22, #f59e0b11)', borderBottom: `1px solid ${T.amber}44`, padding: '9px 20px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
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

  // Phase 3.2 — re-rotate featured order every 30s (no network; small n ≤ 24)
  useEffect(() => {
    const t = setInterval(() => {
      setFeaturedListings(prev => {
        if (!prev?.length) return prev
        return rotateFeaturedFairly(prev, { intervalMs: 30_000, maxPerSeller: 2 })
      })
    }, 30_000)
    return () => clearInterval(t)
  }, [])
  const [user,       setUser]       = useState(null)
  const [notifCount, setNotifCount] = useState(0)
  const [unreadChats, setUnreadChats] = useState(0)
  const [search, setSearch] = useState('')

  function handleSearch(val) {
    setSearch(val)
    if (val.trim()) {
      trackSearch(val, user?.id)
      navigate(`/search?q=${encodeURIComponent(val.trim())}`)
    }
  }

  const [activeCategory, setActiveCategory] = useState('All')
  function handleCategoryChange(cat) { setActiveCategory(cat) }
  const [activeDistrict, setActiveDistrict] = useState('All Districts')

  // ── New sections' data ────────────────────────────────────
  const [shops,    setShops]    = useState([])
  const [jobs,     setJobs]     = useState([])
  const [services, setServices] = useState([])
  const [requests, setRequests] = useState([])
  const [sectionsLoading, setSectionsLoading] = useState(true)
  const [trustStats, setTrustStats] = useState({ sellers: '—', shops: '—', reviews: '—' })

  // ── Stories (compact LiveStoriesCard + viewer/upload) ─────
  const [stories, setStories] = useState([])
  const [storiesLoading, setStoriesLoading] = useState(true)
  const [viewing, setViewing] = useState(null)
  const [viewerStories, setViewerStories] = useState([])
  const [showUpload, setShowUpload] = useState(false)

  // ── Animation / location (preserved) ──────────────────────
  const [isFocused, setIsFocused] = useState(false)
  const { animKeywords, animIdx } = useSearchAnimation({ listings, search, isFocused })
  const { lat: userLat, lng: userLng } = useUserLocation()

  useEffect(() => { init() }, [])

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

  function openStoryGroup(groupLeader) {
    const group = stories.filter(s => s.user_id === groupLeader.user_id)
    const ids = group.map(x => x.id)
    if (user?.id) {
      ids.forEach(id => {
        supabase.from('status_views')
          .upsert({ status_id: id, viewer_id: user.id })
          .then(() => {}, () => {})
      })
    }
    setViewerStories(group.length > 0 ? group : [groupLeader])
    setViewing(0)
  }

  function handleCreateStory() {
    if (!user) { navigate('/login'); return }
    setShowUpload(true)
  }

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase.from('profiles')
        .select('avatar_url, full_name, city, account_type').eq('id', user.id).maybeSingle()
      const { data: shop } = await supabase.from('shops')
        .select('slug').eq('owner_id', user.id).maybeSingle()
      setUser({ ...user, avatar_url: profile?.avatar_url || null, account_type: profile?.account_type, shop_slug: shop?.slug || null })
      loadNotifs(user.id)
      loadUnreadChats(user.id)
    }
    await loadListings()
    await loadAuxSections()
  }

  async function loadListings() {
    setLoading(true)
    // Phase 3.1 — featured discovery is a dedicated query only (featured_until > now).
    // Recent posts feed is separate and never used as the featured source.
    const LISTING_SELECT =
      'id, title, price, price_type, images, city, category, condition, featured, is_featured, featured_until, flash_sale_price, flash_sale_expires_at, promo_badge, bulk_pricing, stock_qty, created_at, seller_id, shop_id, latitude, longitude, status, description, tags'
    const nowIso = new Date().toISOString()

    const [{ data: featuredRows }, { data: recentRows }] = await Promise.all([
      supabase
        .from('listings')
        .select(LISTING_SELECT)
        .eq('status', 'published')
        .gt('featured_until', nowIso)
        .order('featured_until', { ascending: false })
        .limit(24),
      supabase
        .from('listings')
        .select(LISTING_SELECT)
        .eq('status', 'published')
        .order('created_at', { ascending: false })
        .limit(60),
    ])

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

    // Featured section: dedicated query only + fair multi-seller rotation (Phase 3.2)
    setFeaturedListings(
      rotateFeaturedFairly(
        featuredEnriched.filter(l => isListingFeatured(l)),
        { intervalMs: 30_000, maxPerSeller: 2 },
      ),
    )

    // Latest / general feed: recent posts only (not used for featured discovery)
    const { data: { user: authUser } } = await supabase.auth.getUser()
    const sorted = await sortProductsSmart(recentEnriched, userLat, userLng, authUser?.id)
    setListings(sorted)
    setLoading(false)
  }

  // Auxiliary sections: shops, jobs, services, looking-for requests, trust
  // stats. Each query is wrapped so a missing table (e.g. on a fresh DB, or
  // if a table name differs) can't crash the homepage — it just renders the
  // section's empty state instead.
  async function loadAuxSections() {
    setSectionsLoading(true)
    await Promise.all([
      (async () => {
        try {
          const { data, error, count } = await supabase.from('shops')
            .select('id, name, slug, category, logo_url, cover_url, city, rating, review_count, listing_count, is_verified, follower_count', { count: 'exact' })
            .eq('is_active', true)
            .order('follower_count', { ascending: false, nullsFirst: false })
            .limit(8)
          if (error) console.error('shops query error:', error)
          setShops(data || [])
          setTrustStats(s => ({ ...s, shops: count != null ? `${count}+` : s.shops }))
        } catch (e) { console.error('shops catch:', e); setShops([]) }
      })(),
      (async () => {
        try {
          const today = new Date().toISOString().split('T')[0]
          const { data, error } = await supabase.from('jobs')
            .select('id, title, company, city, type, created_at, deadline')
            .eq('status', 'published')
            .or(`deadline.is.null,deadline.gte.${today}`)
            .order('created_at', { ascending: false }).limit(4)
          if (error) console.error('jobs query error:', error)
          setJobs(data || [])
        } catch (e) { console.error('jobs catch:', e); setJobs([]) }
      })(),
      (async () => {
        try {
          const { data, error } = await supabase.from('services')
            .select('id, name, category, city, created_at')
            .eq('status', 'published')
            .order('created_at', { ascending: false }).limit(4)
          if (error) console.error('services query error:', error)
          setServices(data || [])
        } catch (e) { console.error('services catch:', e); setServices([]) }
      })(),
      (async () => {
        try {
          const { data } = await supabase.from('buyer_requests')
            .select('id, title, description, category, city, cities, created_at, budget, offer_count, urgency, image_url')
            .not('status', 'eq', 'fulfilled')
            .order('created_at', { ascending: false })
            .limit(20)
          setRequests(data || [])
        } catch { setRequests([]) }
      })(),
      (async () => {
        try {
          const { count: sellerCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('is_verified', true)
          const { count: reviewCount } = await supabase.from('reviews').select('*', { count: 'exact', head: true }).gte('rating', 4)
          setTrustStats(s => ({
            ...s,
            sellers: sellerCount != null ? `${sellerCount}+` : s.sellers,
            reviews: reviewCount != null ? `${reviewCount}+` : s.reviews,
          }))
        } catch {}
      })(),
    ])
    setSectionsLoading(false)
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
    // Existing image-search-by-photo logic from the previous Home.jsx
    // handleImageFile should be wired in here unchanged.
  }

  return (
    <div className="soko-v3">
      <GlobalStyles />

      <SokoNav
        user={user} notifCount={notifCount} search={search} setSearch={handleSearch}
        navigate={navigate} onImageFile={handleImageFile} animKeywords={animKeywords} animIdx={animIdx}
        listings={listings} activeCategory={activeCategory} onCategoryChange={handleCategoryChange}
        activeDistrict={activeDistrict} onDistrictChange={setActiveDistrict} onFocusChange={setIsFocused}
      />

      {/* Persistent verification action / review banner (seller) */}
      {user?.id && <VerificationAttentionBanner userId={user.id} />}

      <EarlyAccessStrip />

      {/* Revenue hero: marketing message + featured carousel (dedicated featured query) */}
      <RevenueHero navigate={navigate} listings={featuredListings} />

      {/* One-click category access */}
      <CategoryGrid navigate={navigate} onCategoryChange={handleCategoryChange} />

      {/* Monetization: premium Featured marketing strip (listings only for now) */}
      <FeaturedRevenueBanner navigate={navigate} user={user} />

      {/* Featured Listings (left) + Live Stories card (right) — not recent feed */}
      <FeaturedListingsRow
        listings={featuredListings} navigate={navigate} loading={loading}
        stories={stories} storiesLoading={storiesLoading}
        onOpenStory={openStoryGroup} onCreateStory={handleCreateStory}
      />

      {/* Latest Listings — just-posted rail (recent only) */}
      <LatestListingsSection listings={listings} navigate={navigate} loading={loading} />

      {/* People Looking For — buyer requests, "I Can Help" */}
      <LookingForSection navigate={navigate} requests={requests} loading={sectionsLoading} />

      {/* Shops + Jobs + Services — three column row matching reference */}
      <ShopsJobsServicesRow navigate={navigate} shops={shops} jobs={jobs} services={services} loading={sectionsLoading} />

      {/* Verification trust metrics */}
      <VerificationTrustSection navigate={navigate} stats={trustStats} />

      {/* Seller conversion CTA */}
      <SellCtaBanner navigate={navigate} />

      {/* Footer */}
      <SokoFooter navigate={navigate} />

      {/* Mobile bottom nav: mounted once in App.jsx (Home / Explore / Sell / Chats / Profile) */}

      {/* Story viewer + upload modal — same components HomeStatusRow uses */}
      {viewing !== null && (
        <StoryViewer stories={viewerStories} startIndex={viewing} currentUserId={user?.id} onClose={() => setViewing(null)} />
      )}
      {showUpload && (
        <StatusUploadModal
          user={user}
          onClose={() => setShowUpload(false)}
          onSuccess={() => {
            setShowUpload(false)
            if (user?.id) fetchAllActiveStories(user.id, 'All').then(setStories)
          }}
        />
      )}
    </div>
  )
}