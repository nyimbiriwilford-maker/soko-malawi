/**
 * SokoMW â€” SearchPage.jsx
 * Modern multi-pillar search: Marketplace, Shops, Looking For, Jobs, Services.
 * Reads `?q=` from URL; filters + live overlay; Lucide-style icon system.
 */

import React, {
  useEffect, useState, useMemo, useCallback, useRef,
} from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isListingFeatured, rotateFeaturedFairly } from '../utils/homeUtils'
import SokoNav from '../components/SokoNav'

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   DESIGN TOKENS
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const T = {
  green:   '#0F9D58',
  greenD:  '#0a7a44',
  greenDk: '#063d23',
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
  shadow:   '0 1px 3px rgba(0,0,0,0.08), 0 4px 16px rgba(0,0,0,0.04)',
  shadowMd: '0 4px 12px rgba(0,0,0,0.1), 0 8px 28px rgba(0,0,0,0.06)',
  shadowLg: '0 8px 24px rgba(0,0,0,0.12), 0 16px 48px rgba(0,0,0,0.08)',
  radius:   '20px',
  radiusSm: '14px',
  font:        "'Inter', 'DM Sans', system-ui, sans-serif",
  fontDisplay: "'Sora', 'Inter', system-ui, sans-serif",
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   MODERN ICONS â€” Lucide-style (stroke 1.75, round caps)
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const sw = 1.75
const Icon = {
  search:   (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="11" cy="11" r="7.5"/><path d="m20 20-3.5-3.5"/></svg>,
  bell:     (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6.5 8.5a5.5 5.5 0 0 1 11 0c0 6 2.5 7.5 2.5 7.5H4s2.5-1.5 2.5-7.5"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>,
  bellOff:  (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8.7 3A6 6 0 0 1 18 8c0 2.8.7 4.8 1.4 6.2M6.3 6.3C6.1 6.8 6 7.4 6 8c0 7-3 9-3 9h13.5"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="m2 2 20 20"/></svg>,
  mail:     (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>,
  pause:    (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>,
  play:     (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5.5v13l11-6.5L8 5.5z"/></svg>,
  sliders:  (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4"/></svg>,
  tag:      (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l7.6-7.6a1 1 0 0 0 0-1.4L12 2z"/><circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none"/></svg>,
  cash:     (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>,
  award:    (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="8" r="5.5"/><path d="M8.2 13.9 7 22l5-2.5L17 22l-1.2-8.1"/></svg>,
  shield:   (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>,
  map:      (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15M15 6v15"/></svg>,
  target:   (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none"/></svg>,
  crosshair:(s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/></svg>,
  spinner:  (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation:'spin .8s linear infinite' }} aria-hidden><path d="M12 3a9 9 0 0 1 9 9"/></svg>,
  chat:     (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22z"/></svg>,
  user:     (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/></svg>,
  users:    (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="3.5"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a3.5 3.5 0 0 1 0 6.74"/></svg>,
  plus:     (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14"/></svg>,
  heart:    (s=16, fill='none') => <svg width={s} height={s} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M19.5 12.6 12 20l-7.5-7.4a4.6 4.6 0 0 1 6.5-6.5l1 1 1-1a4.6 4.6 0 0 1 6.5 6.5z"/></svg>,
  verify:   (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" aria-hidden><path fill="#16a34a" d="M12 0a4 4 0 0 1 3.2 1.6 4 4 0 0 1 3.6 1 4 4 0 0 1 1 3.6A4 4 0 0 1 21.4 9.4a4 4 0 0 1 0 5.2A4 4 0 0 1 19.8 17.8a4 4 0 0 1-1 3.6 4 4 0 0 1-3.6 1A4 4 0 0 1 12 24a4 4 0 0 1-3.2-1.6 4 4 0 0 1-3.6-1 4 4 0 0 1-1-3.6A4 4 0 0 1 2.6 14.6a4 4 0 0 1 0-5.2A4 4 0 0 1 4.2 6.2a4 4 0 0 1 1-3.6 4 4 0 0 1 3.6-1A4 4 0 0 1 12 0Z"/><path d="m7.5 12.5 3 3 6-7" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round"/></svg>,
  clock:    (s=13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  pin:      (s=13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="2.5"/></svg>,
  chevR:    (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m9 18 6-6-6-6"/></svg>,
  chevL:    (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6"/></svg>,
  x:        (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12"/></svg>,
  check:    (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5"/></svg>,
  grid:     (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5"/></svg>,
  list:     (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>,
  shop:     (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m2 7 4-4h12l4 4"/><path d="M3 7v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7"/><path d="M16 11a4 4 0 0 1-8 0"/></svg>,
  chevDown: (s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6"/></svg>,
  fire:     (s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 12c1-3 2.5-4.5 3.5-6.5A7 7 0 0 1 19 12a7 7 0 1 1-14 0c0-2 1-4 3-6 0 2 1 3 2 4 1-2 2-3 2-4.5 1.5 1.5 2 3.5 2 5.5z"/></svg>,
  filter:   (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 3H2l8 9.5V19l4 2v-8.5L22 3z"/></svg>,
  briefcase:(s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/><path d="M2 13h20"/></svg>,
  wrench:   (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.1-3.1a5.5 5.5 0 0 1-7.3 7.3l-6.1 6.1a2.1 2.1 0 0 1-3-3l6.1-6.1a5.5 5.5 0 0 1 7.3-7.3l-3.1 3.1z"/></svg>,
  handshake:(s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m11 17 2 2a1 1 0 1 0 3-3"/><path d="m14 14 2.5 2.5a1 1 0 1 0 3-3l-3.9-3.9a2 2 0 0 0-2.8 0L12 11"/><path d="M2 15l6 6"/><path d="M7 8 3.5 4.5a1 1 0 0 1 0-1.4l1.1-1.1a1 1 0 0 1 1.4 0L9 5"/></svg>,
  star:     (s=13, fill='#F9AB00') => <svg width={s} height={s} viewBox="0 0 24 24" fill={fill} stroke={fill === 'none' ? 'currentColor' : fill} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1L12 17.3 6.6 19.8l1-6.1L3.2 9.4l6.1-.9L12 3z"/></svg>,
  eye:      (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>,
  phone:    (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>,
  package:  (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m16.5 9.4-9-5.2M21 16V8a2 2 0 0 0-1-1.7l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.7l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5M12 22V12"/></svg>,
  home:     (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m3 11 9-8 9 8"/><path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10"/></svg>,
  sparkles: (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/><path d="M5 3v4M19 17v4M3 5h4M17 19h4"/></svg>,
  truck:    (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.6a1 1 0 0 0-.3-.7l-3.4-3.4A1 1 0 0 0 17.6 9H14"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>,
  layers:   (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m12 2 10 5.5-10 5.5L2 7.5 12 2z"/><path d="m2 12.5 10 5.5 10-5.5"/><path d="m2 17.5 10 5.5 10-5.5"/></svg>,
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   HELPERS
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   SEARCH TABS â€” one per SokoMW pillar. Each tab queries its own table;
   counts are fetched in parallel up front so badges populate without
   forcing a tab switch.
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const SEARCH_TABS = [
  { key: 'listings',   label: 'Marketplace',         icon: Icon.home },
  { key: 'shops',      label: 'Shops',               icon: Icon.shop },
  { key: 'lookingfor', label: 'People Looking For',  icon: Icon.users },
  { key: 'jobs',       label: 'Jobs',                icon: Icon.briefcase },
  { key: 'services',   label: 'Services',            icon: Icon.wrench },
]

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   CATEGORIES (nested for sidebar checkbox tree)
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   GLOBAL STYLES
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function GlobalStyles() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600;700&display=swap');
      *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
      body { background: #f8f9fa; }
      .sp-root {
        font-family: ${T.font}; background: #f8f9fa; color: ${T.gray900};
        min-height: 100vh; min-height: 100dvh;
        overflow-x: clip; width: 100%;
      }
      @media (max-width: 900px) {
        .sp-root {
          padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
        }
      }
      .sp-root button { font-family: inherit; -webkit-tap-highlight-color: transparent; }
      .sp-root input, .sp-root select, .sp-root textarea {
        font-family: inherit;
        font-size: 16px; /* prevents iOS focus zoom */
      }
      .sp-page {
        max-width: 1400px; margin: 0 auto; padding: 0 20px;
        width: 100%; box-sizing: border-box;
      }
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
        background: rgba(255,255,255,.96); border-bottom:1px solid rgba(0,0,0,.07);
        box-shadow: 0 1px 0 rgba(0,0,0,.04), 0 4px 20px rgba(0,0,0,.04);
        padding-top: env(safe-area-inset-top, 0px);
      }
      .sp-nav-desktop { display: flex; }
      .sp-nav-mobile  { display: none; }
      .sp-nav-pillars { display: block; }
        .sp-search-tabs-mobile { display: flex; }
      .sp-search-field {
        flex:1; display:flex; align-items:center;
        background:${T.gray100}; border:1.5px solid transparent; border-radius:50px;
        padding:4px 4px 4px 14px; min-height:42px; min-width:0;
        transition: border-color .2s, background .2s, box-shadow .2s;
      }
      .sp-search-field.is-focused {
        background:#fff; border-color:${T.green};
        box-shadow: 0 0 0 3px rgba(15,157,88,0.10);
      }
      .sp-search-field input {
        flex:1; border:none; background:transparent; outline:none;
        font-size:16px; color:${T.gray900}; min-width:0; width:100%;
      }
      .sp-search-go {
        flex-shrink:0; background:${T.green}; color:#fff; border:none; border-radius:50px;
        height:34px; padding:0 16px; font-size:13.5px; font-weight:700; cursor:pointer;
      }
      .sp-search-go-icon {
        display:none; flex-shrink:0; width:36px; height:36px; border-radius:50%;
        background:${T.green}; color:#fff; border:none; align-items:center; justify-content:center; cursor:pointer;
      }
      @media (max-width:900px) {
        .sp-search-go { display: none !important; }
        .sp-search-go-icon { display: flex !important; }
        .sp-search-field {
          min-height: 44px;
          padding: 4px 4px 4px 12px;
          border-radius: 14px;
        }
      }

      /* Modern pill tabs */
      .sp-tabs-row {
        display:flex; gap:8px; overflow-x:auto; padding:4px 2px 2px;
        scrollbar-width:none; -ms-overflow-style:none;
      }
      .sp-tabs-row::-webkit-scrollbar { display:none; }
      .sp-search-tab {
        display:inline-flex; align-items:center; gap:8px;
        padding:10px 16px; border-radius:999px;
        background:#fff; border:1.5px solid ${T.gray200};
        cursor:pointer; font-size:13px; font-weight:600; color:${T.gray700};
        white-space:nowrap; flex-shrink:0;
        transition: background .15s, border-color .15s, color .15s, box-shadow .15s, transform .12s;
        box-shadow: 0 1px 2px rgba(0,0,0,.04);
      }
      .sp-search-tab .sp-tab-ico {
        display:flex; align-items:center; justify-content:center;
        width:28px; height:28px; border-radius:9px;
        background:${T.gray50}; color:${T.gray600}; flex-shrink:0;
        transition: background .15s, color .15s;
      }
      .sp-search-tab:hover:not(.active) {
        border-color:${T.gray300}; color:${T.gray900}; transform:translateY(-1px);
      }
      .sp-search-tab.active {
        background:${T.gray900}; border-color:${T.gray900}; color:#fff;
        box-shadow: 0 4px 14px rgba(0,0,0,.16);
      }
      .sp-search-tab.active .sp-tab-ico {
        background:rgba(255,255,255,.14); color:#fff;
      }
      .sp-tab-count {
        background:${T.gray100}; color:${T.gray700}; border-radius:50px;
        padding:2px 8px; font-size:11px; font-weight:700; min-width:22px; text-align:center;
      }
      .sp-search-tab.active .sp-tab-count {
        background:rgba(255,255,255,.18); color:#fff;
      }

      /* Results grid â€” marketplace product cards */
      .sp-results-grid.grid-modern {
        display:grid;
        grid-template-columns: repeat(4, minmax(0, 1fr));
        gap:16px;
      }
      @media (max-width:1100px) {
        .sp-results-grid.grid-modern { grid-template-columns: repeat(3, minmax(0, 1fr)); gap:14px; }
      }
      @media (max-width:900px) {
        .sp-results-grid.grid-modern { grid-template-columns: repeat(2, minmax(0, 1fr)); gap:12px; }
      }

      .sp-summary-card {
        background:#fff; border:1px solid ${T.gray100}; border-radius:16px;
        padding:16px 18px; box-shadow:${T.shadow};
        display:flex; align-items:center; justify-content:space-between;
        flex-wrap:wrap; gap:12px;
      }
      .sp-toolbar {
        display:flex; align-items:center; justify-content:space-between;
        margin-bottom:16px; flex-wrap:wrap; gap:10px;
        background:#fff; border:1px solid ${T.gray100}; border-radius:14px;
        padding:10px 12px; box-shadow:0 1px 2px rgba(0,0,0,.03);
      }

      /* filter sidebar */
      .sp-sidebar { width: 250px; flex-shrink: 0; }
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
        background:#fff; border-radius:16px; overflow:hidden;
        border:1px solid ${T.gray100};
        box-shadow:${T.shadow};
        cursor:pointer; display:flex; flex-direction:column;
        transition: transform .22s cubic-bezier(.34,1.2,.64,1), box-shadow .22s ease, border-color .22s ease;
        animation: fadeUp .4s ease both;
        height:100%;
      }
      .sp-card:hover {
        transform:translateY(-4px);
        box-shadow:${T.shadowMd};
        border-color:${T.gray200};
      }
      .sp-card:hover .sp-card-img { transform:scale(1.05); }
      .sp-card-img { transition:transform .45s cubic-bezier(.22,1,.36,1); width:100%; height:100%; object-fit:cover; display:block; }
      .sp-fb-actions {
        display:flex; align-items:center; gap:6px;
        border-top:1px solid ${T.gray100}; padding-top:10px; margin-top:2px;
      }
      .sp-fb-act {
        flex:1; min-width:0; height:32px;
        display:inline-flex; align-items:center; justify-content:center; gap:5px;
        border:none; border-radius:10px; background:${T.gray100}; color:${T.gray800};
        font-size:11.5px; font-weight:700; font-family:inherit; cursor:pointer;
        transition: background .15s, color .15s, transform .1s;
      }
      .sp-fb-act:hover { background:${T.blueL}; color:${T.blueD}; }
      .sp-fb-act:active { transform:scale(.98); }
      .sp-fb-act-call {
        flex:0 0 32px; width:32px; padding:0;
        border:1px solid ${T.gray200}; background:#fff; color:${T.gray800};
      }
      .sp-fb-act-call:hover { border-color:${T.gray400}; background:${T.gray50}; color:${T.gray900}; }

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
        position:relative; z-index:1; width:300px; height:100%;
        background:#fff; overflow-y:auto; padding:20px 18px 80px;
        box-shadow:4px 0 32px rgba(0,0,0,.18);
        animation: slideInLeft .25s cubic-bezier(.22,1,.36,1);
        -webkit-overflow-scrolling: touch;
      }
      @keyframes slideInLeft { from { transform:translateX(-100%); } to { transform:translateX(0); } }
      @keyframes slideInUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
      @media (max-width:900px) {
        .sp-filter-drawer-panel {
          animation: slideInUp .28s cubic-bezier(.22,1,.36,1) !important;
          box-shadow: 0 -8px 32px rgba(0,0,0,.18) !important;
        }
      }

      @media(max-width:900px) {
        .sp-sidebar { display:none !important; }
        .sp-mobile-filter-btn { display:inline-flex !important; }
        .sp-results-grid.grid-4 { grid-template-columns:repeat(2,1fr) !important; }
        .sp-summary-card {
          padding:12px 14px !important; border-radius:14px !important;
          flex-direction: column !important; align-items: stretch !important; gap:12px !important;
        }
        .sp-summary-actions { width: 100%; }
        .sp-summary-actions button { width: 100%; justify-content: center; min-height: 44px; }
        .sp-toolbar {
          padding:8px 10px !important; gap:8px !important;
          flex-wrap: wrap !important;
        }
        .sp-page { padding: 0 14px !important; }
        .sp-nav-desktop { display: none !important; }
        .sp-nav-mobile  { display: flex !important; }
        .sp-main-cols { gap: 0 !important; padding-top: 12px !important; padding-bottom: 24px !important; }
        .sp-filter-drawer-panel {
          width: min(100%, 100vw) !important;
          max-width: 100% !important;
          border-radius: 18px 18px 0 0 !important;
          margin-top: auto;
          height: min(88dvh, 100%) !important;
          padding: 16px 16px calc(24px + env(safe-area-inset-bottom, 0px)) !important;
        }
        .sp-filter-drawer {
          flex-direction: column !important;
          justify-content: flex-end !important;
        }
        .sp-card-list {
          flex-direction: column !important;
        }
        .sp-card-list > div:first-child {
          width: 100% !important;
          height: 160px !important;
        }
        .sp-live-grid { grid-template-columns: 1fr !important; }
        .sp-fb-act { font-size: 11px !important; height: 34px !important; }
      }
      @media(max-width:540px) {
        .sp-results-grid.grid-4,
        .sp-results-grid.grid-modern {
          grid-template-columns: repeat(2, minmax(0,1fr)) !important;
          gap: 8px !important;
        }
        .sp-results-grid.list-mode { grid-template-columns:1fr !important; }
        .sp-tabs-row {
          margin-left: -14px; margin-right: -14px;
          padding-left: 14px !important; padding-right: 14px !important;
          gap: 6px !important;
        }
        .sp-search-tab {
          padding: 8px 11px !important; font-size: 12px !important; gap: 6px !important;
          min-height: 40px;
        }
        .sp-search-tab .sp-tab-ico { width:22px !important; height:22px !important; border-radius:7px !important; }
        .sp-tab-count { padding: 1px 6px !important; font-size: 10px !important; }
        .sp-summary-title { font-size: 15px !important; white-space: normal !important; }
        .sp-summary-meta { padding-left: 0 !important; font-size: 12.5px !important; }
        .sp-summary-ico { display: none !important; }
        .sp-page-btn { width: 40px; height: 40px; }
        .sp-row-card { padding: 12px !important; gap: 10px !important; }
        /* Compact product card body on phones */
        .sp-fb-body { padding: 10px 10px 10px !important; }
        .sp-fb-price { font-size: 15px !important; }
        .sp-fb-title { font-size: 12.5px !important; min-height: 2.5em !important; }
        .sp-fb-seller { display: none !important; }
        .sp-fb-rating, .sp-fb-views { display: none !important; }
      }
    `}</style>
  )
}

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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   CATEGORY CHECKBOX TREE â€” recursive
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   FILTER SIDEBAR CONTENT
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:14, fontWeight:800, color:T.gray900 }}>
          <span style={{ display:'flex', width:28, height:28, borderRadius:9, background:T.gray100, color:T.gray700, alignItems:'center', justifyContent:'center' }}>{Icon.sliders(14)}</span>
          Filters
        </div>
        <button type="button" onClick={onClearAll} style={{ background:'none', border:'none', color:T.red, fontSize:12.5, fontWeight:700, cursor:'pointer' }}>Clear all</button>
      </div>

      {/* NEAR ME */}
      <div className="sp-filter-section" style={{ marginTop:0, paddingTop:0, borderTop:'none' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div className="sp-filter-head" style={{ marginBottom:0 }}>
            <span className="sp-filter-icon-badge" style={{ background:T.blueL, color:T.blue }}>{locating ? Icon.spinner(14) : Icon.crosshair(14)}</span>
            <span className="sp-filter-title">Near me</span>
          </div>
          <div className={`sp-toggle-track${nearMe ? ' on' : ''}`} onClick={() => !locating && setNearMe()} role="switch" aria-checked={nearMe}>
            <div className="sp-toggle-thumb" />
          </div>
        </div>
        {locating && <div style={{ fontSize:11.5, color:T.gray500, marginTop:8, paddingLeft:37 }}>Finding your locationâ€¦</div>}
      </div>

      {/* CATEGORIES */}
      <div className="sp-filter-section">
        <div className="sp-filter-head">
          <span className="sp-filter-icon-badge" style={{ background:'#f1ebfd', color:'#7c3aed' }}>{Icon.layers(14)}</span>
          <span className="sp-filter-title">Categories</span>
        </div>
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

      {/* PRICE RANGE */}
      <div className="sp-filter-section">
        <div className="sp-filter-head">
          <span className="sp-filter-icon-badge" style={{ background:T.greenL, color:T.greenD }}>{Icon.cash(14)}</span>
          <span className="sp-filter-title">Price range</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <div className="sp-range-wrap">
            <span className="sp-range-prefix">MK</span>
            <input className="sp-range-input" type="number" placeholder="Min" value={priceMin} onChange={e => setPriceMin(e.target.value)} />
          </div>
          <span style={{ color:T.gray400, fontSize:12, fontWeight:600 }}>â€“</span>
          <div className="sp-range-wrap">
            <span className="sp-range-prefix">MK</span>
            <input className="sp-range-input" type="number" placeholder="Max" value={priceMax} onChange={e => setPriceMax(e.target.value)} />
          </div>
        </div>
      </div>

      {/* LOCATION */}
      <div className="sp-filter-section">
        <div className="sp-filter-head">
          <span className="sp-filter-icon-badge" style={{ background:'#fff7ed', color:'#ea580c' }}>{Icon.pin(14)}</span>
          <span className="sp-filter-title">Location</span>
        </div>
        <div style={{ position:'relative' }}>
          <select value={district} onChange={e => setDistrict(e.target.value)} className="sp-sort-select" style={{ width:'100%', paddingRight:32 }}>
            {ALL_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* CONDITION */}
      <div className="sp-filter-section">
        <div className="sp-filter-head">
          <span className="sp-filter-icon-badge" style={{ background:T.amberL, color:T.amberD }}>{Icon.tag(14)}</span>
          <span className="sp-filter-title">Condition</span>
        </div>
        {CONDITIONS.map(c => (
          <Checkbox key={c.key} checked={conditions.has(c.key)} onChange={() => onToggleCondition(c.key)} label={c.label} />
        ))}
      </div>

      {/* VERIFIED */}
      <div className="sp-filter-section">
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div className="sp-filter-head" style={{ marginBottom:0 }}>
            <span className="sp-filter-icon-badge" style={{ background:T.greenL, color:T.green }}>{Icon.shield(14)}</span>
            <span className="sp-filter-title">Verified sellers</span>
          </div>
          <div className={`sp-toggle-track${verifiedOnly ? ' on' : ''}`} onClick={() => setVerifiedOnly()} role="switch" aria-checked={verifiedOnly}>
            <div className="sp-toggle-thumb" />
          </div>
        </div>
      </div>

      {/* DELIVERY */}
      <div className="sp-filter-section">
        <div className="sp-filter-head">
          <span className="sp-filter-icon-badge" style={{ background:T.blueL, color:T.blue }}>{Icon.truck(14)}</span>
          <span className="sp-filter-title">Delivery</span>
        </div>
        <div style={{ display:'flex', flexWrap:'wrap', gap:7 }}>
          {['Delivery Available','Pickup Only'].map(d => (
            <button key={d} type="button" className={`sp-chip${delivery.has(d) ? ' active' : ''}`} onClick={() => onToggleDelivery(d)}>
              {delivery.has(d) && Icon.check(11)} {d}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   RESULT CARD â€” GRID mode (Marketplace / listings tab)
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:T.gray400 }}>{Icon.package(36)}</div>
        }
        {isFeat && (
          <div style={{ position:'absolute', top:10, left:10, background:`linear-gradient(135deg,${T.amber},#e09800)`, color:'#1a0a00', borderRadius:50, padding:'3px 10px', fontSize:9.5, fontWeight:900, boxShadow:'0 2px 8px rgba(249,171,0,0.4)', display:'flex', alignItems:'center', gap:4 }}>{Icon.sparkles(10)} FEATURED</div>
        )}
        {isNew && !isFeat && (
          <div style={{ position:'absolute', top:10, left:10, background:T.blue, color:'#fff', borderRadius:50, padding:'3px 10px', fontSize:9.5, fontWeight:800 }}>NEW</div>
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   RESULT CARD â€” LIST mode (Marketplace / listings tab)
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:T.gray400 }}>{Icon.package(28)}</div>
        }
        {isFeat && <div style={{ position:'absolute', top:8, left:8, background:`linear-gradient(135deg,${T.amber},#e09800)`, color:'#1a0a00', borderRadius:50, padding:'3px 8px', fontSize:9, fontWeight:900, display:'flex' }}>{Icon.sparkles(10)}</div>}
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   SHOP RESULT CARD â€” Shops tab
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   JOB RESULT CARD â€” Jobs tab
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   SERVICE RESULT CARD â€” Services tab
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function ServiceResultCard({ service, delay, onClick }) {
  return (
    <div className="sp-row-card" style={{ animationDelay:`${delay}s` }} onClick={onClick}>
      <div style={{ width:42, height:42, borderRadius:10, background:T.violetL, color:T.violet, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{Icon.wrench(18)}</div>
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   REQUEST RESULT CARD â€” People Looking For tab
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   SKELETON CARDS
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function SkeletonCard() {
  return (
    <div style={{ background:'#fff', borderRadius:16, overflow:'hidden', border:`1px solid ${T.gray100}` }}>
      <div className="skeleton" style={{ width:'100%', aspectRatio:'4/3' }} />
      <div style={{ padding:'12px', display:'flex', flexDirection:'column', gap:8 }}>
        <div className="skeleton" style={{ height:16, width:'42%', borderRadius:6 }} />
        <div className="skeleton" style={{ height:13, width:'88%', borderRadius:6 }} />
        <div className="skeleton" style={{ height:13, width:'60%', borderRadius:6 }} />
        <div className="skeleton" style={{ height:32, width:'100%', borderRadius:10, marginTop:4 }} />
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   EMPTY STATE
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function EmptyState({ query, onClearFilters, label = 'results' }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', padding:'56px 24px', textAlign:'center', background:'#fff', borderRadius:20, border:`1px solid ${T.gray100}`, boxShadow:T.shadow }}>
      <div style={{ width:72, height:72, borderRadius:20, background:T.gray50, border:`1px solid ${T.gray100}`, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:18, color:T.gray500 }}>
        {Icon.search(30)}
      </div>
      <div style={{ fontFamily:T.fontDisplay, fontSize:18, fontWeight:800, color:T.gray900, marginBottom:8, letterSpacing:'-0.3px' }}>
        No {label} for â€œ{query || 'your search'}â€
      </div>
      <div style={{ fontSize:14, color:T.gray600, marginBottom:22, maxWidth:340, lineHeight:1.5 }}>
        Try different keywords, switch tabs, or clear filters to broaden results.
      </div>
      <button type="button" onClick={onClearFilters} style={{ background:T.gray900, color:'#fff', border:'none', borderRadius:12, padding:'12px 26px', fontSize:14, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:8 }}>
        {Icon.sliders(15)} Clear filters
      </button>
    </div>
  )
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   SEE MORE â€” cumulative load (20 at a time), no numbered page grid
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const PAGE_SIZE = 20

function SeeMoreButton({ onClick, loading, remaining }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, padding:'28px 0 12px' }}>
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="sp-see-more"
        style={{
          minWidth: 200, minHeight: 46, padding: '12px 28px',
          borderRadius: 14, border: `1.5px solid ${T.gray200}`,
          background: '#fff', color: T.gray900,
          fontSize: 14, fontWeight: 800, fontFamily: 'inherit',
          cursor: loading ? 'wait' : 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          boxShadow: '0 1px 3px rgba(0,0,0,.06)',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? (
          <>{Icon.spinner(15)} Loadingâ€¦</>
        ) : (
          <>See more{remaining > 0 ? ` (${Math.min(PAGE_SIZE, remaining)})` : ''}</>
        )}
      </button>
      {remaining > 0 && !loading && (
        <div style={{ fontSize: 12, color: T.gray500, fontWeight: 600 }}>
          {remaining.toLocaleString()} more available
        </div>
      )}
    </div>
  )
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   MAIN SEARCH PAGE COMPONENT
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   LIVE SEARCH OVERLAY
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
        +{extra} more {label} â†’
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
        <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 14px', borderBottom:`1px solid ${T.gray100}`, paddingTop:'calc(14px + env(safe-area-inset-top, 0px))' }}>
          <span style={{ color:T.green, display:'flex', flexShrink:0 }}>{Icon.search(20)}</span>
          <input
            ref={inputRef}
            value={liveQuery}
            onChange={e => setLiveQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commit(liveQuery); if (e.key === 'Escape') onClose() }}
            placeholder="Search listings, shops, jobsâ€¦"
            enterKeyHint="search"
            autoComplete="off"
            style={{ flex:1, border:'none', outline:'none', fontSize:16, fontWeight:500, color:T.gray900, background:'transparent', minWidth:0 }}
          />
          {liveQuery && (
            <button type="button" onClick={() => setLiveQuery('')} aria-label="Clear" style={{ background:T.gray200, border:'none', borderRadius:'50%', width:28, height:28, display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:T.gray600, flexShrink:0 }}>{Icon.x(12)}</button>
          )}
          <button type="button" onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:T.gray700, fontSize:14, fontWeight:700, flexShrink:0, padding:'8px 6px', minHeight:40 }}>Cancel</button>
        </div>

        {/* Results scroll area */}
        <div style={{ overflowY:'auto', flex:1 }}>
          {!liveQuery.trim() && (
            <div style={{ padding:'32px 20px', textAlign:'center', color:T.gray500, fontSize:14 }}>
              Start typing to search across all of SokoMWâ€¦
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
              <div style={{ width:48, height:48, borderRadius:14, background:T.gray50, color:T.gray500, display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>{Icon.search(22)}</div>
              <div style={{ fontSize:15, fontWeight:700, color:T.gray800, marginBottom:6 }}>No results for â€œ{liveQuery}â€</div>
              <div style={{ fontSize:13, color:T.gray500 }}>Try different keywords or check the spelling</div>
            </div>
          )}

          {liveQuery.trim() && !liveLoading && total > 0 && (
            <div style={{ padding:'8px 0 16px' }}>

              {/* Listings */}
              {liveResults.listings.length > 0 && (
                <Section label="Marketplace" iconNode={Icon.home(14)}>
                  <div className="sp-live-grid" style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10, padding:'0 14px' }}>
                    {liveResults.listings.map(l => (
                      <div key={l.id} onClick={() => { navigate('/listing/'+l.id); onClose() }}
                        style={{ display:'flex', gap:10, alignItems:'center', cursor:'pointer', padding:'8px 10px', borderRadius:12, transition:'background .15s' }}
                        onMouseEnter={e => e.currentTarget.style.background = T.gray50}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <div style={{ width:48, height:48, borderRadius:10, overflow:'hidden', background:T.gray100, flexShrink:0, color:T.gray400, display:'flex', alignItems:'center', justifyContent:'center' }}>
                          {l.images?.[0]
                            ? <img src={l.images[0]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            : Icon.package(20)
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
                <Section label="Shops" iconNode={Icon.shop(14)}>
                  {liveResults.shops.map(s => (
                    <LiveRow key={s.id} onClick={() => { navigate('/shop/'+s.slug); onClose() }}
                      avatar={s.logo_url ? <img src={s.logo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }} /> : <span style={{ color:T.gray600, display:'flex' }}>{Icon.shop(18)}</span>}
                      title={s.name} sub={[s.category, s.city].filter(Boolean).join(' Â· ')}
                    />
                  ))}
                  <MoreHint shown={liveResults.shops.length} total={liveResults.shopsTotal} label="shops" onClick={() => { commit(liveQuery) }} />
                </Section>
              )}

              {/* Jobs */}
              {liveResults.jobs.length > 0 && (
                <Section label="Jobs" iconNode={Icon.briefcase(14)}>
                  {liveResults.jobs.map(j => (
                    <LiveRow key={j.id} onClick={() => { navigate('/jobs'); onClose() }}
                      avatar={<span style={{ color:T.blue, display:'flex' }}>{Icon.briefcase(18)}</span>}
                      title={j.title} sub={[j.company, j.city].filter(Boolean).join(' Â· ')}
                    />
                  ))}
                  <MoreHint shown={liveResults.jobs.length} total={liveResults.jobsTotal} label="jobs" onClick={() => { navigate('/jobs'); onClose() }} />
                </Section>
              )}

              {/* Services */}
              {liveResults.services.length > 0 && (
                <Section label="Services" iconNode={Icon.wrench(14)}>
                  {liveResults.services.map(s => (
                    <LiveRow key={s.id} onClick={() => { navigate('/services'); onClose() }}
                      avatar={<span style={{ color:T.violet, display:'flex' }}>{Icon.wrench(18)}</span>}
                      title={s.name} sub={[s.category, s.city].filter(Boolean).join(' Â· ')}
                    />
                  ))}
                  <MoreHint shown={liveResults.services.length} total={liveResults.servicesTotal} label="services" onClick={() => { navigate('/services'); onClose() }} />
                </Section>
              )}

              {/* Buyer requests */}
              {liveResults.requests.length > 0 && (
                <Section label="People Looking For" iconNode={Icon.users(14)}>
                  {liveResults.requests.map(r => (
                    <LiveRow key={r.id} onClick={() => { navigate('/looking-for'); onClose() }}
                      avatar={<span style={{ color:T.violet, display:'flex' }}>{Icon.users(18)}</span>}
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
                  See all results for "{liveQuery}" â†’
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function Section({ label, icon, iconNode, children }) {
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 18px 6px', fontSize:11.5, fontWeight:800, color:T.gray500, textTransform:'uppercase', letterSpacing:'0.06em' }}>
        <span style={{ display:'flex', color:T.gray600 }}>{iconNode || icon}</span>{label}
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   NOTIFY ME â€” modern advanced alert builder + manager
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const ALERT_SUGGESTIONS = ['iPhone', 'Toyota', 'Laptop', 'Land', 'Solar', 'Fridge', 'House rent', 'Generator']

function parseKeywordList(str) {
  if (!str) return []
  return String(str).split(/[,;\n]+/).map(k => k.trim()).filter(Boolean)
}

function NotifyMeModal({ query, onClose, user }) {
  const [tab, setTab] = useState('create')
  const [email, setEmail] = useState(user?.email || '')
  const [keywordInput, setKeywordInput] = useState('')
  const [tags, setTags] = useState(() => parseKeywordList(query).slice(0, 8))
  const [maxPrice, setMaxPrice] = useState('')
  const [minPrice, setMinPrice] = useState('')
  const [category, setCategory] = useState('')
  const [district, setDistrict] = useState('')
  const [notifyEmail, setNotifyEmail] = useState(true)
  const [notifyPush, setNotifyPush] = useState(true)
  const [submitted, setSubmitted] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [alerts, setAlerts] = useState([])
  const [loadingAlerts, setLoadingAlerts] = useState(false)
  const [deletingId, setDeletingId] = useState(null)
  const [togglingId, setTogglingId] = useState(null)
  const keywordRef = useRef(null)

  useEffect(() => {
    if (tab === 'manage') loadAlerts()
  }, [tab])

  // Prefetch alert count for the tab badge when signed in
  useEffect(() => {
    if (user?.id || email.trim()) loadAlerts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  function addTag(raw) {
    const next = String(raw || '').trim().replace(/^,+|,+$/g, '')
    if (!next) return
    setTags(prev => {
      const lower = next.toLowerCase()
      if (prev.some(t => t.toLowerCase() === lower)) return prev
      if (prev.length >= 12) return prev
      return [...prev, next]
    })
    setKeywordInput('')
    setError('')
  }

  function removeTag(tag) {
    setTags(prev => prev.filter(t => t !== tag))
  }

  function onKeywordKeyDown(e) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      addTag(keywordInput)
    } else if (e.key === 'Backspace' && !keywordInput && tags.length) {
      setTags(prev => prev.slice(0, -1))
    }
  }

  async function loadAlerts() {
    setLoadingAlerts(true)
    try {
      let q = supabase.from('wanted_alerts').select('*').order('created_at', { ascending: false })
      if (user?.id) {
        q = q.eq('user_id', user.id)
      } else if (email.trim()) {
        q = q.eq('email', email.trim())
      } else {
        setAlerts([])
        setLoadingAlerts(false)
        return
      }
      const { data, error: err } = await q
      if (err) console.error(err)
      setAlerts(data || [])
    } catch (e) { console.error(e) }
    setLoadingAlerts(false)
  }

  async function handleSave() {
    const finalTags = [...tags]
    if (keywordInput.trim()) {
      finalTags.push(keywordInput.trim())
    }
    const keywords = [...new Set(finalTags.map(t => t.trim()).filter(Boolean))]
    if (!keywords.length) {
      setError('Add at least one keyword so we know what to watch for.')
      keywordRef.current?.focus()
      return
    }
    if (notifyEmail && !email.trim()) {
      setError('Add an email address or turn off email notifications.')
      return
    }
    if (!notifyEmail && !notifyPush) {
      setError('Pick at least one channel: Email or Push.')
      return
    }
    if (minPrice && maxPrice && Number(minPrice) > Number(maxPrice)) {
      setError('Min budget cannot be higher than max budget.')
      return
    }

    setSaving(true)
    setError('')
    try {
      const { error: err } = await supabase.from('wanted_alerts').insert({
        user_id: user?.id || null,
        keywords,
        active: true,
        notify_email: notifyEmail,
        notify_push: notifyPush,
        email: email.trim() || null,
        category: category || null,
        district: district || null,
        budget_max: maxPrice ? Number(maxPrice) : null,
      })
      if (err) {
        console.error(err)
        setError(err.message || 'Could not save alert. Try again.')
        setSaving(false)
        return
      }
      setTags(keywords)
      setKeywordInput('')
      setSubmitted(true)
    } catch (e) {
      console.error(e)
      setError('Something went wrong. Please try again.')
    }
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

  const previewKeywords = tags.length ? tags : (keywordInput.trim() ? [keywordInput.trim()] : [])
  const canSave = previewKeywords.length > 0 && (notifyEmail || notifyPush) && !saving

  const fieldLabel = { fontSize:12, fontWeight:700, color:T.gray700, display:'block', marginBottom:6, letterSpacing:'0.01em' }
  const fieldInput = {
    width:'100%', border:`1.5px solid ${T.gray200}`, borderRadius:12,
    padding:'11px 12px', fontSize:13.5, color:T.gray900, outline:'none',
    boxSizing:'border-box', background:'#fff', fontFamily:'inherit',
    transition:'border-color .15s, box-shadow .15s',
  }

  return (
    <div className="sp-alert-overlay" style={{ position:'fixed', inset:0, zIndex:320, display:'flex', alignItems:'flex-end', justifyContent:'center', padding:0 }} role="dialog" aria-modal="true" aria-labelledby="sp-alert-title">
      <style>{`
        .sp-alert-overlay { animation: spAlertFade .2s ease both; }
        @keyframes spAlertFade { from { opacity:0 } to { opacity:1 } }
        .sp-alert-sheet {
          animation: spAlertUp .32s cubic-bezier(.22,1,.36,1) both;
          width:100%; max-width:560px; max-height:min(92vh, 820px);
          background:#fff; border-radius:22px 22px 0 0;
          box-shadow: 0 -8px 40px rgba(0,0,0,.18);
          display:flex; flex-direction:column; position:relative; z-index:1;
          overflow:hidden;
        }
        @keyframes spAlertUp { from { transform:translateY(28px); opacity:.6 } to { transform:translateY(0); opacity:1 } }
        @media (min-width:640px) {
          .sp-alert-overlay { align-items:center; padding:24px; }
          .sp-alert-sheet {
            border-radius:22px; max-height:min(88vh, 780px);
            box-shadow: 0 24px 64px rgba(0,0,0,.22);
          }
        }
        .sp-alert-hero {
          background:
            radial-gradient(ellipse 80% 120% at 100% 0%, rgba(249,171,0,.22) 0%, transparent 55%),
            radial-gradient(ellipse 70% 100% at 0% 100%, rgba(15,157,88,.2) 0%, transparent 50%),
            linear-gradient(145deg, #0b1220 0%, #152033 50%, #0f1a14 100%);
          color:#fff; padding:20px 20px 18px; flex-shrink:0;
        }
        .sp-alert-body { overflow-y:auto; flex:1; padding:18px 20px 12px; -webkit-overflow-scrolling:touch; }
        .sp-alert-footer { flex-shrink:0; padding:12px 20px 18px; border-top:1px solid ${T.gray100}; background:rgba(255,255,255,.96); backdrop-filter:blur(8px); }
        .sp-alert-tabs {
          display:flex; gap:4px; background:rgba(255,255,255,.1); border-radius:12px; padding:4px; margin-top:14px;
        }
        .sp-alert-tab {
          flex:1; display:inline-flex; align-items:center; justify-content:center; gap:6px;
          padding:9px 8px; border:none; border-radius:9px; font-size:12.5px; font-weight:700;
          font-family:inherit; cursor:pointer; color:rgba(255,255,255,.7); background:transparent;
          transition: background .15s, color .15s;
        }
        .sp-alert-tab.is-on { background:#fff; color:${T.gray900}; box-shadow:0 2px 10px rgba(0,0,0,.12); }
        .sp-kw-box {
          display:flex; flex-wrap:wrap; gap:6px; align-items:center;
          min-height:48px; padding:8px 10px; border:1.5px solid ${T.gray200};
          border-radius:14px; background:#fff; cursor:text;
          transition: border-color .15s, box-shadow .15s;
        }
        .sp-kw-box:focus-within {
          border-color:${T.green}; box-shadow:0 0 0 3px rgba(15,157,88,.12);
        }
        .sp-kw-chip {
          display:inline-flex; align-items:center; gap:4px;
          background:${T.gray900}; color:#fff; border-radius:999px;
          padding:5px 8px 5px 11px; font-size:12px; font-weight:700;
          animation: fadeUp .25s ease both;
        }
        .sp-kw-chip button {
          display:flex; border:none; background:rgba(255,255,255,.18); color:#fff;
          width:18px; height:18px; border-radius:50%; align-items:center; justify-content:center;
          cursor:pointer; padding:0;
        }
        .sp-kw-chip button:hover { background:rgba(255,255,255,.3); }
        .sp-channel {
          display:flex; align-items:flex-start; gap:12px; text-align:left;
          padding:12px 13px; border-radius:14px; border:1.5px solid ${T.gray200};
          background:#fff; cursor:pointer; transition: border-color .15s, background .15s, box-shadow .15s;
          width:100%; font-family:inherit;
        }
        .sp-channel.is-on {
          border-color:${T.green}; background:${T.greenL};
          box-shadow:0 0 0 1px rgba(15,157,88,.12);
        }
        @media (max-width:480px) {
          .sp-channel-grid { grid-template-columns: 1fr !important; }
          .sp-alert-body { padding: 14px 14px 10px !important; }
          .sp-alert-footer { padding: 10px 14px calc(14px + env(safe-area-inset-bottom, 0px)) !important; }
          .sp-alert-hero { padding: 16px 14px 14px !important; }
          .sp-alert-sheet .sp-scope-grid { grid-template-columns: 1fr !important; }
        }
        .sp-channel-ico {
          width:36px; height:36px; border-radius:11px; flex-shrink:0;
          display:flex; align-items:center; justify-content:center;
          background:${T.gray100}; color:${T.gray700};
        }
        .sp-channel.is-on .sp-channel-ico { background:#fff; color:${T.greenD}; }
        .sp-suggest {
          display:inline-flex; align-items:center; gap:4px;
          border:1px solid ${T.gray200}; background:${T.gray50}; color:${T.gray700};
          border-radius:999px; padding:6px 11px; font-size:12px; font-weight:600;
          cursor:pointer; font-family:inherit; transition: border-color .12s, background .12s;
        }
        .sp-suggest:hover { border-color:${T.gray400}; background:#fff; }
        .sp-preview {
          border-radius:16px; border:1px solid ${T.gray100};
          background: linear-gradient(165deg, #f8fafc 0%, #fff 60%);
          padding:14px 14px 12px; box-shadow:0 1px 3px rgba(0,0,0,.04);
        }
        .sp-alert-card {
          border-radius:16px; border:1.5px solid ${T.gray100}; background:#fff;
          padding:14px; display:flex; flex-direction:column; gap:10px;
          box-shadow:0 1px 3px rgba(0,0,0,.04);
          transition: border-color .15s, box-shadow .15s;
        }
        .sp-alert-card.is-active { border-color:#c6e9d6; background:linear-gradient(180deg, #f4fbf7 0%, #fff 55%); }
        .sp-alert-card.is-paused { opacity:.88; }
      `}</style>

      <div onClick={onClose} style={{ position:'absolute', inset:0, background:'rgba(10,15,20,.55)', backdropFilter:'blur(5px)' }} />

      <div className="sp-alert-sheet">
        {/* Hero header */}
        <div className="sp-alert-hero">
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:12, minWidth:0 }}>
              <div style={{
                width:44, height:44, borderRadius:14, flexShrink:0,
                background:'linear-gradient(135deg, rgba(15,157,88,.35), rgba(249,171,0,.35))',
                border:'1px solid rgba(255,255,255,.15)',
                display:'flex', alignItems:'center', justifyContent:'center', color:'#fff',
              }}>
                {Icon.bell(20)}
              </div>
              <div style={{ minWidth:0 }}>
                <div id="sp-alert-title" style={{ fontFamily:T.fontDisplay, fontSize:18, fontWeight:800, letterSpacing:'-0.4px', lineHeight:1.2 }}>
                  Smart listing alerts
                </div>
                <div style={{ fontSize:12.5, color:'rgba(255,255,255,.68)', marginTop:4, lineHeight:1.4, fontWeight:500 }}>
                  Watch the marketplace â€” we ping you when a match lands.
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close"
              style={{ width:34, height:34, borderRadius:10, border:'1px solid rgba(255,255,255,.15)', background:'rgba(255,255,255,.08)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', flexShrink:0 }}>
              {Icon.x(16)}
            </button>
          </div>

          {!submitted && (
            <div className="sp-alert-tabs" role="tablist">
              {[
                { key: 'create', label: 'Create alert', icon: Icon.sparkles },
                { key: 'manage', label: 'My alerts', icon: Icon.list, badge: alerts.length || null },
              ].map(t => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  className={`sp-alert-tab${tab === t.key ? ' is-on' : ''}`}
                  onClick={() => { setTab(t.key); setError('') }}
                >
                  {t.icon(13)}
                  {t.label}
                  {t.key === 'manage' && alerts.length > 0 && (
                    <span style={{
                      fontSize:10, fontWeight:800, borderRadius:999, padding:'1px 6px',
                      background: tab === 'manage' ? T.gray900 : 'rgba(255,255,255,.2)',
                      color: tab === 'manage' ? '#fff' : '#fff',
                    }}>{alerts.length}</span>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Body */}
        <div className="sp-alert-body">
          {/* â”€â”€ CREATE â”€â”€ */}
          {tab === 'create' && !submitted && (
            <div style={{ display:'flex', flexDirection:'column', gap:18 }}>
              {/* Keywords */}
              <div>
                <label style={fieldLabel}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>
                    {Icon.tag(12)} Keywords <span style={{ color:T.red }}>*</span>
                  </span>
                </label>
                <div className="sp-kw-box" onClick={() => keywordRef.current?.focus()}>
                  {tags.map(tag => (
                    <span key={tag} className="sp-kw-chip">
                      {tag}
                      <button type="button" onClick={e => { e.stopPropagation(); removeTag(tag) }} aria-label={`Remove ${tag}`}>
                        {Icon.x(10)}
                      </button>
                    </span>
                  ))}
                  <input
                    ref={keywordRef}
                    value={keywordInput}
                    onChange={e => setKeywordInput(e.target.value)}
                    onKeyDown={onKeywordKeyDown}
                    onBlur={() => { if (keywordInput.trim()) addTag(keywordInput) }}
                    placeholder={tags.length ? 'Add anotherâ€¦' : 'e.g. iPhone 13, Toyota Hiluxâ€¦'}
                    style={{ flex:1, minWidth:120, border:'none', outline:'none', fontSize:13.5, color:T.gray900, background:'transparent', fontFamily:'inherit', padding:'4px 2px' }}
                  />
                </div>
                <div style={{ fontSize:11.5, color:T.gray500, marginTop:6, display:'flex', alignItems:'center', gap:5 }}>
                  {Icon.sparkles(11)} Press Enter or comma to add Â· up to 12 keywords
                </div>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:10 }}>
                  {ALERT_SUGGESTIONS.filter(s => !tags.some(t => t.toLowerCase() === s.toLowerCase())).slice(0, 6).map(s => (
                    <button key={s} type="button" className="sp-suggest" onClick={() => addTag(s)}>
                      {Icon.plus(11)} {s}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scope */}
              <div>
                <div style={{ ...fieldLabel, marginBottom:8 }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>{Icon.sliders(12)} Scope</span>
                </div>
                <div className="sp-scope-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <div>
                    <label style={{ ...fieldLabel, fontWeight:600, color:T.gray600, fontSize:11.5 }}>Category</label>
                    <div style={{ position:'relative' }}>
                      <select
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                        style={{ ...fieldInput, appearance:'none', paddingRight:32, cursor:'pointer' }}
                      >
                        <option value="">Any category</option>
                        {CATEGORY_TREE.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                      <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:T.gray500, pointerEvents:'none' }}>{Icon.chevDown(12)}</span>
                    </div>
                  </div>
                  <div>
                    <label style={{ ...fieldLabel, fontWeight:600, color:T.gray600, fontSize:11.5 }}>District</label>
                    <div style={{ position:'relative' }}>
                      <select
                        value={district}
                        onChange={e => setDistrict(e.target.value)}
                        style={{ ...fieldInput, appearance:'none', paddingRight:32, cursor:'pointer' }}
                      >
                        {ALL_DISTRICTS.map(d => (
                          <option key={d} value={d === 'All Districts' ? '' : d}>{d}</option>
                        ))}
                      </select>
                      <span style={{ position:'absolute', right:12, top:'50%', transform:'translateY(-50%)', color:T.gray500, pointerEvents:'none' }}>{Icon.chevDown(12)}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginTop:10 }}>
                  <div>
                    <label style={{ ...fieldLabel, fontWeight:600, color:T.gray600, fontSize:11.5 }}>Min budget (MK)</label>
                    <input type="number" min="0" value={minPrice} onChange={e => setMinPrice(e.target.value)} placeholder="Optional" style={fieldInput} />
                  </div>
                  <div>
                    <label style={{ ...fieldLabel, fontWeight:600, color:T.gray600, fontSize:11.5 }}>Max budget (MK)</label>
                    <input type="number" min="0" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="e.g. 500000" style={fieldInput} />
                  </div>
                </div>
              </div>

              {/* Channels */}
              <div>
                <div style={{ ...fieldLabel, marginBottom:8 }}>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>{Icon.bell(12)} Notify me via</span>
                </div>
                <div className="sp-channel-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                  <button
                    type="button"
                    className={`sp-channel${notifyEmail ? ' is-on' : ''}`}
                    onClick={() => setNotifyEmail(v => !v)}
                    aria-pressed={notifyEmail}
                  >
                    <span className="sp-channel-ico">{Icon.mail(16)}</span>
                    <span style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:T.gray900 }}>Email</div>
                      <div style={{ fontSize:11, color:T.gray600, marginTop:2, lineHeight:1.3 }}>Inbox alerts</div>
                    </span>
                    <span style={{ marginLeft:'auto', flexShrink:0, color: notifyEmail ? T.green : T.gray300 }}>
                      {notifyEmail ? Icon.check(16) : <span style={{ width:16, height:16, borderRadius:4, border:`1.5px solid ${T.gray300}`, display:'block' }} />}
                    </span>
                  </button>
                  <button
                    type="button"
                    className={`sp-channel${notifyPush ? ' is-on' : ''}`}
                    onClick={() => setNotifyPush(v => !v)}
                    aria-pressed={notifyPush}
                  >
                    <span className="sp-channel-ico">{Icon.bell(16)}</span>
                    <span style={{ minWidth:0 }}>
                      <div style={{ fontSize:13, fontWeight:800, color:T.gray900 }}>Push</div>
                      <div style={{ fontSize:11, color:T.gray600, marginTop:2, lineHeight:1.3 }}>In-app pings</div>
                    </span>
                    <span style={{ marginLeft:'auto', flexShrink:0, color: notifyPush ? T.green : T.gray300 }}>
                      {notifyPush ? Icon.check(16) : <span style={{ width:16, height:16, borderRadius:4, border:`1.5px solid ${T.gray300}`, display:'block' }} />}
                    </span>
                  </button>
                </div>
                {notifyEmail && (
                  <div style={{ marginTop:10 }}>
                    <label style={{ ...fieldLabel, fontWeight:600, color:T.gray600, fontSize:11.5 }}>Delivery email</label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      style={fieldInput}
                    />
                  </div>
                )}
              </div>

              {/* Live preview */}
              <div className="sp-preview">
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:10 }}>
                  <span style={{ fontSize:11.5, fontWeight:800, color:T.gray500, textTransform:'uppercase', letterSpacing:'0.06em', display:'inline-flex', alignItems:'center', gap:6 }}>
                    {Icon.eye(12)} Alert preview
                  </span>
                  <span style={{ fontSize:10.5, fontWeight:800, background:T.greenL, color:T.greenD, borderRadius:999, padding:'3px 8px' }}>LIVE</span>
                </div>
                {previewKeywords.length === 0 ? (
                  <div style={{ fontSize:13, color:T.gray500, lineHeight:1.45 }}>
                    Add keywords to see what this alert will match.
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize:14, fontWeight:800, color:T.gray900, marginBottom:6, lineHeight:1.35 }}>
                      Watching for{' '}
                      <span style={{ color:T.greenD }}>
                        {previewKeywords.map((k, i) => (
                          <span key={k}>{i > 0 ? ', ' : ''}â€œ{k}â€</span>
                        ))}
                      </span>
                    </div>
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, fontSize:11.5, color:T.gray600 }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#fff', border:`1px solid ${T.gray200}`, borderRadius:999, padding:'4px 9px' }}>
                        {Icon.layers(11)} {category || 'Any category'}
                      </span>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#fff', border:`1px solid ${T.gray200}`, borderRadius:999, padding:'4px 9px' }}>
                        {Icon.pin(11)} {district || 'All districts'}
                      </span>
                      {(minPrice || maxPrice) && (
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#fff', border:`1px solid ${T.gray200}`, borderRadius:999, padding:'4px 9px' }}>
                          {Icon.cash(11)}{' '}
                          {minPrice && maxPrice
                            ? `MK ${Number(minPrice).toLocaleString()} â€“ ${Number(maxPrice).toLocaleString()}`
                            : maxPrice
                              ? `â‰¤ MK ${Number(maxPrice).toLocaleString()}`
                              : `â‰¥ MK ${Number(minPrice).toLocaleString()}`}
                        </span>
                      )}
                      {notifyEmail && (
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#fff', border:`1px solid ${T.gray200}`, borderRadius:999, padding:'4px 9px' }}>
                          {Icon.mail(11)} Email
                        </span>
                      )}
                      {notifyPush && (
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4, background:'#fff', border:`1px solid ${T.gray200}`, borderRadius:999, padding:'4px 9px' }}>
                          {Icon.bell(11)} Push
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>

              {error && (
                <div style={{
                  display:'flex', alignItems:'flex-start', gap:8,
                  background:'#fef2f2', border:'1px solid #fecaca', borderRadius:12,
                  padding:'10px 12px', fontSize:12.5, color:'#b91c1c', fontWeight:600, lineHeight:1.4,
                }}>
                  <span style={{ flexShrink:0, marginTop:1 }}>{Icon.x(14)}</span>
                  {error}
                </div>
              )}
            </div>
          )}

          {/* â”€â”€ SUCCESS â”€â”€ */}
          {submitted && (
            <div style={{ textAlign:'center', padding:'12px 4px 8px' }}>
              <div style={{
                width:76, height:76, borderRadius:22, margin:'0 auto 16px',
                background:'linear-gradient(135deg, #e8f5ee, #fff8e6)',
                border:'1px solid #d1e7dd',
                display:'flex', alignItems:'center', justifyContent:'center', color:T.greenD,
                boxShadow:'0 8px 24px rgba(15,157,88,.12)',
              }}>
                {Icon.sparkles(32)}
              </div>
              <div style={{ fontFamily:T.fontDisplay, fontSize:20, fontWeight:800, color:T.gray900, marginBottom:8, letterSpacing:'-0.4px' }}>
                Alert is live
              </div>
              <div style={{ fontSize:14, color:T.gray600, marginBottom:8, lineHeight:1.55, maxWidth:340, marginLeft:'auto', marginRight:'auto' }}>
                Weâ€™ll watch for{' '}
                <strong style={{ color:T.gray900 }}>
                  {tags.map((k, i) => (i ? ', ' : '') + `â€œ${k}â€`)}
                </strong>
                {' '}and notify you as soon as something matches.
              </div>
              <div style={{ fontSize:12.5, color:T.gray500, marginBottom:20 }}>
                Pause or delete anytime from My alerts.
              </div>
              <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                <button
                  type="button"
                  onClick={() => { setSubmitted(false); setTab('manage'); loadAlerts() }}
                  style={{ background:'#fff', color:T.gray900, border:`1.5px solid ${T.gray200}`, borderRadius:12, padding:'11px 18px', fontSize:13.5, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:6 }}
                >
                  {Icon.list(14)} My alerts
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  style={{ background:T.gray900, color:'#fff', border:'none', borderRadius:12, padding:'11px 22px', fontSize:13.5, fontWeight:700, cursor:'pointer' }}
                >
                  Done
                </button>
              </div>
            </div>
          )}

          {/* â”€â”€ MANAGE â”€â”€ */}
          {tab === 'manage' && !submitted && (
            <div>
              {loadingAlerts ? (
                <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                  {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height:96, borderRadius:16 }} />)}
                </div>
              ) : alerts.length === 0 ? (
                <div style={{ textAlign:'center', padding:'36px 16px' }}>
                  <div style={{
                    width:64, height:64, borderRadius:18, background:T.gray50, border:`1px solid ${T.gray100}`,
                    display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 14px', color:T.gray400,
                  }}>
                    {Icon.bellOff(26)}
                  </div>
                  <div style={{ fontSize:15, fontWeight:800, color:T.gray900, marginBottom:6 }}>No alerts yet</div>
                  <div style={{ fontSize:13, color:T.gray500, marginBottom:18, lineHeight:1.45, maxWidth:280, marginLeft:'auto', marginRight:'auto' }}>
                    Create a smart alert and weâ€™ll watch the marketplace for you.
                  </div>
                  <button
                    type="button"
                    onClick={() => setTab('create')}
                    style={{ background:T.gray900, color:'#fff', border:'none', borderRadius:12, padding:'11px 22px', fontSize:13.5, fontWeight:700, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:7 }}
                  >
                    {Icon.sparkles(14)} Create alert
                  </button>
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  <div style={{ fontSize:12.5, color:T.gray600, fontWeight:600, marginBottom:2 }}>
                    {alerts.filter(a => a.active).length} active Â· {alerts.length} total
                  </div>
                  {alerts.map(a => {
                    const kw = Array.isArray(a.keywords) ? a.keywords : parseKeywordList(a.keywords)
                    const title = kw.length ? kw.join(', ') : (a.category || 'Alert')
                    return (
                      <div key={a.id} className={`sp-alert-card${a.active ? ' is-active' : ' is-paused'}`}>
                        <div style={{ display:'flex', alignItems:'flex-start', gap:10 }}>
                          <div style={{
                            width:40, height:40, borderRadius:12, flexShrink:0,
                            background: a.active ? T.greenL : T.gray100,
                            color: a.active ? T.greenD : T.gray500,
                            display:'flex', alignItems:'center', justifyContent:'center',
                          }}>
                            {a.active ? Icon.bell(18) : Icon.bellOff(18)}
                          </div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', marginBottom:4 }}>
                              <span style={{ fontSize:14, fontWeight:800, color:T.gray900, lineHeight:1.3 }}>{title}</span>
                              <span style={{
                                fontSize:10, fontWeight:800, borderRadius:999, padding:'3px 8px', letterSpacing:'0.04em',
                                background: a.active ? T.green : T.gray200,
                                color: a.active ? '#fff' : T.gray600,
                              }}>
                                {a.active ? 'ACTIVE' : 'PAUSED'}
                              </span>
                            </div>
                            <div style={{ display:'flex', flexWrap:'wrap', gap:6, fontSize:11.5, color:T.gray600 }}>
                              <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>{Icon.layers(11)} {a.category || 'Any category'}</span>
                              {a.district && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>{Icon.pin(11)} {a.district}</span>}
                              {a.budget_max != null && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>{Icon.cash(11)} â‰¤ MK {Number(a.budget_max).toLocaleString()}</span>}
                              {a.notify_email && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>{Icon.mail(11)} Email</span>}
                              {a.notify_push && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>{Icon.bell(11)} Push</span>}
                            </div>
                          </div>
                        </div>
                        <div style={{ display:'flex', gap:8, paddingTop:2 }}>
                          <button
                            type="button"
                            onClick={() => handleToggle(a)}
                            disabled={togglingId === a.id}
                            style={{
                              flex:1, height:38, borderRadius:11, border:`1.5px solid ${a.active ? T.gray200 : T.green}`,
                              background: a.active ? '#fff' : T.greenL, color: a.active ? T.gray800 : T.greenD,
                              fontSize:12.5, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
                              display:'inline-flex', alignItems:'center', justifyContent:'center', gap:6,
                            }}
                          >
                            {togglingId === a.id ? Icon.spinner(13) : a.active ? Icon.pause(13) : Icon.play(13)}
                            {a.active ? 'Pause' : 'Resume'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(a.id)}
                            disabled={deletingId === a.id}
                            style={{
                              width:42, height:38, borderRadius:11, border:`1.5px solid #fecaca`,
                              background:'#fff', color:T.red, cursor:'pointer',
                              display:'inline-flex', alignItems:'center', justifyContent:'center',
                            }}
                            title="Delete alert"
                            aria-label="Delete alert"
                          >
                            {deletingId === a.id ? Icon.spinner(13) : Icon.x(14)}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sticky footer CTA for create */}
        {tab === 'create' && !submitted && (
          <div className="sp-alert-footer">
            <button
              type="button"
              onClick={handleSave}
              disabled={!canSave}
              style={{
                width:'100%', height:48, border:'none', borderRadius:14,
                background: canSave ? `linear-gradient(135deg, ${T.green}, ${T.greenD})` : T.gray200,
                color: canSave ? '#fff' : T.gray500,
                fontSize:14.5, fontWeight:800, cursor: canSave ? 'pointer' : 'not-allowed',
                fontFamily:'inherit',
                boxShadow: canSave ? '0 6px 20px rgba(15,157,88,.28)' : 'none',
                display:'inline-flex', alignItems:'center', justifyContent:'center', gap:8,
                transition:'opacity .15s',
              }}
            >
              {saving ? <>{Icon.spinner(16)} Activatingâ€¦</> : <>{Icon.bell(16)} Activate smart alert</>}
            </button>
            <div style={{ fontSize:11, color:T.gray500, textAlign:'center', marginTop:8, lineHeight:1.4 }}>
              Free Â· Instant when matches post Â· Pause anytime
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
   FACEBOOK-STYLE LISTING CARD
â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
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
      {/* Image â€” 4:3 ratio */}
      <div style={{ position:'relative', width:'100%', paddingBottom:'75%', background:T.gray100, overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0 }}>
          {listing.images?.[0] && !imgErr
            ? <img src={listing.images[0]} alt={listing.title} onError={() => setImgErr(true)}
                style={{ width:'100%', height:'100%', objectFit:'cover', transition:'transform .45s cubic-bezier(.22,1,.36,1)', transform: hov ? 'scale(1.05)' : 'scale(1)' }}
              />
            : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', color:T.gray400 }}>{Icon.package(36)}</div>
          }
        </div>

        {isFeat && (
          <div style={{ position:'absolute', top:10, left:10, display:'flex', alignItems:'center', gap:5, background:'#FF7A1A', color:'#fff', padding:'5px 11px', fontSize:10.5, fontWeight:800, borderRadius:50, boxShadow:'0 3px 10px rgba(255,122,26,0.4)', zIndex:2 }}>
            {Icon.sparkles(11)} Featured
          </div>
        )}

        <button type="button" onClick={e => { e.stopPropagation(); setLiked(l => !l) }}
          style={{ position:'absolute', top:9, right:9, width:30, height:30, borderRadius:'50%', border:'none', background:'rgba(255,255,255,.94)', backdropFilter:'blur(6px)', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color: liked ? T.red : T.gray600, boxShadow:'0 2px 8px rgba(0,0,0,.12)', zIndex:2 }}>
          {Icon.heart(14, liked ? 'currentColor' : 'none')}
        </button>

        {listing.category && (
          <div style={{ position:'absolute', bottom:9, left:9, background:'rgba(255,255,255,.96)', color:catStyleObj.color, borderRadius:50, padding:'3px 10px', fontSize:10.5, fontWeight:700, zIndex:2, boxShadow:'0 1px 4px rgba(0,0,0,.08)' }}>
            {listing.category}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="sp-fb-body" style={{ padding:'12px 13px 12px', display:'flex', flexDirection:'column', gap:0 }}>
        <div className="sp-fb-price" style={{ fontFamily:T.fontDisplay, fontSize:17, fontWeight:800, color:T.greenD, letterSpacing:'-0.3px', marginBottom:4 }}>
          {formatPrice(listing.price)}
        </div>

        <div className="sp-fb-title" style={{ fontSize:13.5, fontWeight:700, color:T.gray900, marginBottom:8, overflow:'hidden', display:'-webkit-box', WebkitLineClamp:2, WebkitBoxOrient:'vertical', lineHeight:1.3, minHeight:'2.6em' }}>
          {listing.title}
        </div>

        {/* Seller row */}
        <div className="sp-fb-seller" style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
          <div style={{ width:26, height:26, borderRadius:'50%', flexShrink:0, overflow:'hidden', background:`linear-gradient(135deg, #334155, #1e293b)`, display:'flex', alignItems:'center', justifyContent:'center', color:'#fff', fontWeight:800, fontSize:11 }}>
            {listing.shop_logo_url || listing.seller_avatar_url
              ? <img src={listing.shop_logo_url || listing.seller_avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
              : sellerName[0]?.toUpperCase()}
          </div>
          <span style={{ display:'flex', alignItems:'center', gap:4, fontSize:12, fontWeight:700, color:T.gray800, overflow:'hidden', minWidth:0, flex:1 }}>
            <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{sellerName}</span>
            {isVerif && <span style={{ flexShrink:0, display:'flex' }}>{Icon.verify(13)}</span>}
          </span>
          <span style={{ display:'flex', alignItems:'center', gap:3, fontSize:10.5, color:T.gray500, flexShrink:0 }}>
            {Icon.clock(11)} {timeAgo(listing.created_at)}
          </span>
        </div>

        <div className="sp-fb-rating" style={{ display:'flex', alignItems:'center', gap:4, fontSize:11.5, color:T.gray600, marginBottom:5, minHeight:15 }}>
          {rating != null
            ? <>{Icon.star(11)} <span style={{ fontWeight:700, color:T.gray800 }}>{Number(rating).toFixed(1)}</span> {reviews != null && `(${reviews})`}</>
            : <span style={{ color:T.gray400 }}>No ratings yet</span>}
        </div>

        <div style={{ display:'flex', alignItems:'center', gap:4, fontSize:11.5, color:T.gray500, marginBottom: listing._distanceKm != null || views != null || chats != null ? 6 : 10 }}>
          <span style={{ display:'flex', color:T.gray500 }}>{Icon.pin(12)}</span>
          <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {[listing.district, listing.city].filter(Boolean).join(' â€¢ ') || 'Malawi'}
          </span>
        </div>

        {listing._distanceKm != null && (
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:T.gray500, marginBottom:6 }}>
            <span
              onClick={e => {
                if (!listing._isPrecise) return
                e.stopPropagation()
                const dst = `${listing.latitude},${listing.longitude}`
                window.open(`https://www.google.com/maps/dir/?api=1&destination=${dst}&travelmode=driving`, '_blank')
              }}
              style={{ display:'flex', alignItems:'center', gap:3, color: listing._isPrecise ? T.blue : T.gray500, fontWeight:600, cursor: listing._isPrecise ? 'pointer' : 'default' }}
            >
              {Icon.crosshair(12)} {listing._distanceKm < 1 ? `${Math.round(listing._distanceKm * 1000)}m` : `${listing._distanceKm.toFixed(1)}km`} away
            </span>
          </div>
        )}

        {(views != null || chats != null) && (
          <div className="sp-fb-views" style={{ display:'flex', alignItems:'center', gap:12, fontSize:11, color:T.gray500, marginBottom:10 }}>
            {views != null && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                {Icon.eye(13)} {views}
              </span>
            )}
            {chats != null && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>
                {Icon.chat(13)} {chats}
              </span>
            )}
          </div>
        )}

        <div className="sp-fb-actions">
          <button type="button" className="sp-fb-act" onClick={e => { e.stopPropagation(); onClick() }}>
            {Icon.eye(13)} View
          </button>
          <button type="button" className="sp-fb-act" onClick={e => e.stopPropagation()}>
            {Icon.chat(13)} Chat
          </button>
          {listing.contact_methods?.includes('call') && listing.call_number && (
            <button
              type="button"
              className="sp-fb-act sp-fb-act-call"
              title="Call"
              onClick={e => {
                e.stopPropagation()
                window.open(`tel:${listing.call_number}`, '_self')
              }}
            >
              {Icon.phone(14)}
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

  // â”€â”€ Active tab â”€â”€
  const [activeTab, setActiveTab] = useState('listings')
  const [tabCounts, setTabCounts] = useState({ listings: null, shops: null, lookingfor: null, jobs: null, services: null })

  // â”€â”€ Results state â”€â”€
  const [allResults, setAllResults] = useState([])
  const [loading, setLoading]       = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [totalCount, setTotalCount] = useState(0)
  /** Cumulative page: page 1 = 20, page 2 = 40, etc. (See more, not numbered grid) */
  const [page, setPage]             = useState(1)

  // â”€â”€ Filter state (Marketplace tab only) â”€â”€
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

  // â”€â”€ Applied (committed) filters â€” only change on "Apply" â”€â”€
  const [applied, setApplied] = useState({
    cats: new Set(), priceMin:'', priceMax:'', district:'All Districts',
    conditions: new Set(), delivery: new Set(), verifiedOnly: false,
    featuredOnly: false, nearMe: false, userCoords: null,
  })
  // Incrementing this guarantees the search useEffect re-fires even when
  // applied looks structurally identical (e.g. clearing already-empty filters)
  const [searchTick, setSearchTick] = useState(0)

  /* Sync URL â†’ search input */
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

  /* Near Me â€” request geolocation once when toggled on, then search
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

  /* Live search â€” fires 300 ms after the user stops typing */
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

  /* â”€â”€ doSearch: dispatches to the right table for the active tab â”€â”€
     Cumulative pages: page N shows first N * PAGE_SIZE results (See more). */
  async function doSearch(tab, filters, currentSort, currentPage) {
    if (currentPage <= 1) setLoading(true)
    else setLoadingMore(true)
    try {
      if (tab === 'listings')        await searchListings(filters, currentSort, currentPage)
      else if (tab === 'shops')      await searchShops(currentSort, currentPage)
      else if (tab === 'lookingfor') await searchLookingFor(currentSort, currentPage)
      else if (tab === 'jobs')       await searchJobs(currentSort, currentPage)
      else if (tab === 'services')   await searchServices(currentSort, currentPage)
    } catch (err) {
      console.error('Search error:', err)
      if (currentPage <= 1) {
        setAllResults([])
        setTotalCount(0)
      }
    }
    setLoading(false)
    setLoadingMore(false)
  }

  /* â”€â”€ Marketplace listings â”€â”€ */
  async function searchListings(filters, currentSort, currentPage) {
    let query = supabase
      .from('listings')
      .select('id, title, price, images, city, district, category, condition, featured, is_featured, featured_until, created_at, seller_id, shop_id, description, latitude, longitude, precise_location, contact_methods, whatsapp_number, call_number', { count: 'exact' })
      .eq('status', 'published')

    // Only filter by title when there's an actual search term â€” an empty
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

    // Near Me â€” compute distance and sort by it, overriding other sort modes
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

    let merged = [...featured, ...sortedRegular]

    // Enrich sellers/shops for the cumulative window (and full pool if filtering verified)
    const enrichIds = filters.verifiedOnly ? merged : merged.slice(0, currentPage * PAGE_SIZE)
    const shopIds   = [...new Set(enrichIds.map(l => l.shop_id).filter(Boolean))]
    const sellerIds = [...new Set(enrichIds.map(l => l.seller_id).filter(Boolean))]

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

    const enrich = (l) => {
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
    }

    if (filters.verifiedOnly) {
      merged = merged.map(enrich).filter(l => l.seller_verified || l.shop_is_verified)
    }

    // Cumulative: first page*PAGE_SIZE rows (See more raises page)
    const results = (filters.verifiedOnly ? merged : merged.map(enrich))
      .slice(0, currentPage * PAGE_SIZE)

    setAllResults(results)
    setTotalCount(filters.verifiedOnly ? merged.length : merged.length)
  }

  /* â”€â”€ Shops tab â€” searches shops.name, scoped to active shops â”€â”€ */
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

    // Cumulative fetch: first page*PAGE_SIZE rows
    query = query.range(0, currentPage * PAGE_SIZE - 1)

    const { data, count, error } = await query
    if (error) throw error

    setAllResults(data || [])
    setTotalCount(count || 0)
  }

  /* â”€â”€ People Looking For tab â€” searches buyer_requests.title â”€â”€ */
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

    query = query.range(0, currentPage * PAGE_SIZE - 1)

    const { data, count, error } = await query
    if (error) throw error

    setAllResults(data || [])
    setTotalCount(count || 0)
  }

  /* â”€â”€ Jobs tab â€” searches jobs.title, scoped to active + non-expired â”€â”€ */
  async function searchJobs(currentSort, currentPage) {
    const today = new Date().toISOString().split('T')[0]
    let query = supabase
      .from('jobs')
      .select('id, title, company, city, type, created_at, deadline', { count: 'exact' })
      .eq('status', 'active')
      .or(`deadline.is.null,deadline.gte.${today}`)
      .ilike('title', `%${queryParam}%`)
      .order('created_at', { ascending: false })

    query = query.range(0, currentPage * PAGE_SIZE - 1)

    const { data, count, error } = await query
    if (error) throw error

    setAllResults(data || [])
    setTotalCount(count || 0)
  }

  /* â”€â”€ Services tab â€” searches services.name, scoped to active â”€â”€ */
  async function searchServices(currentSort, currentPage) {
    let query = supabase
      .from('services')
      .select('id, name, category, city, created_at', { count: 'exact' })
      .eq('status', 'active')
      .ilike('name', `%${queryParam}%`)
      .order('created_at', { ascending: false })

    query = query.range(0, currentPage * PAGE_SIZE - 1)

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
  // Verified) â€” takes explicit overrides so it doesn't depend on React
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

  const hasMore = allResults.length < totalCount
  const remaining = Math.max(0, totalCount - allResults.length)
  const showFilterSidebar = activeTab === 'listings'

  // Toggle handlers that update local state AND search immediately â€”
  // used for Near Me / Featured / Verified, which feel better as instant
  // switches rather than requiring a separate "Apply" tap.
  function toggleNearMeInstant() {
    const next = !nearMe
    setNearMe(next)
    // If turning on and we don't have coords yet, the geolocation effect
    // will fire and call applyFiltersInstant itself once coords resolve
    // (see Patch 3) â€” don't search yet with stale/no coords.
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

  // Keep live overlay in sync with shared SokoNav search input
  function handleNavSearch(val) {
    setSearch(val)
    setLiveQuery(val)
    if (val?.trim()) setSearchOpen(true)
    try { window.__sokoSearchInput__ = val } catch { /* ignore */ }
  }

  // Open live overlay when nav focuses search (?focus=1)
  useEffect(() => {
    if (searchParams.get('focus') === '1') {
      setSearchOpen(true)
      setLiveQuery(searchParams.get('q') || search || '')
    }
  }, [searchParams])

  return (
    <div className="sp-root">
      <GlobalStyles />

      <SokoNav
        user={user}
        notifCount={notifCount}
        search={search}
        setSearch={handleNavSearch}
        navigate={navigate}
        activeDistrict={district}
        onDistrictChange={(d) => {
          setDistrict(d)
          setPage(1)
          applyFiltersInstant({ district: d })
        }}
        activePillar="marketplace"
        ctaLabel="Sell Now"
        onCta={() => navigate('/post')}
        onFocusChange={(focused) => {
          if (focused) {
            setLiveQuery(search)
            setSearchOpen(true)
          }
        }}
      />

      {searchOpen && (
        <LiveSearchOverlay
          liveQuery={liveQuery}
          setLiveQuery={(q) => {
            setLiveQuery(q)
            setSearch(q)
          }}
          liveResults={liveResults}
          liveLoading={liveLoading}
          onClose={() => {
            setSearchOpen(false)
            // If they typed something, commit it as the real search
            if (liveQuery.trim()) {
              setSearch(liveQuery.trim())
              setSearchParams({ q: liveQuery.trim() })
            } else {
              // Drop focus flag from URL when closing empty
              const next = new URLSearchParams(searchParams)
              next.delete('focus')
              setSearchParams(next, { replace: true })
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

      <div className="sp-page">

        {/* â”€â”€ Search summary â”€â”€ */}
        <div className="sp-summary-card" style={{ marginTop:14 }}>
          <div style={{ minWidth:0, flex:1 }}>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4 }}>
              <span className="sp-summary-ico" style={{ display:'flex', width:32, height:32, borderRadius:10, background:T.gray100, color:T.gray700, alignItems:'center', justifyContent:'center', flexShrink:0 }}>{Icon.search(16)}</span>
              <div className="sp-summary-title" style={{ fontFamily:T.fontDisplay, fontSize:18, fontWeight:800, color:T.gray900, letterSpacing:'-0.4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {queryParam ? <>Results for <span style={{ color:T.greenD }}>â€œ{queryParam}â€</span></> : 'Browse marketplace'}
              </div>
            </div>
            <div className="sp-summary-meta" style={{ fontSize:13.5, color:T.gray600, fontWeight:500, paddingLeft:40 }}>
              {loading ? (
                <span style={{ display:'inline-flex', alignItems:'center', gap:6 }}>{Icon.spinner(13)} Searchingâ€¦</span>
              ) : (
                `${totalCount.toLocaleString()} ${resultsLabel} found`
              )}
            </div>
          </div>
          <div className="sp-summary-actions">
            <button
              type="button"
              onClick={() => setNotifyOpen(true)}
              style={{ display:'flex', alignItems:'center', gap:7, background:T.gray900, color:'#fff', border:'none', borderRadius:50, padding:'10px 16px', fontSize:13, fontWeight:700, cursor:'pointer', whiteSpace:'nowrap' }}
            >
              {Icon.bell(14)} Notify me
            </button>
          </div>
        </div>

        {/* â”€â”€ Pillar tabs â”€â”€ */}
       <div className="sp-scroll sp-tabs-scroll" style={{ display:'flex', gap:4, overflowX:'auto', marginTop:12, borderBottom:`1px solid ${T.gray200}`, WebkitOverflowScrolling:'touch' }}>
          {SEARCH_TABS.map(t => {
            const count = tabCounts[t.key]
            return (
              <button
                key={t.key}
                type="button"
                className={`sp-search-tab${activeTab === t.key ? ' active' : ''}`}
                onClick={() => handleTabChange(t.key)}
              >
                <span className="sp-tab-ico">{t.icon(15)}</span>
                {t.label}
                {count != null && <span className="sp-tab-count">{count}</span>}
              </button>
            )
          })}
        </div>

        <div className="sp-main-cols" style={{ display:'flex', gap:22, alignItems:'flex-start', paddingTop:18, paddingBottom:40 }}>

          {/* â”€â”€ LEFT SIDEBAR â€” desktop only, Marketplace tab â”€â”€ */}
          {showFilterSidebar && (
            <div className="sp-sidebar" style={{ alignSelf:'flex-start', position:'sticky', top:90, width:250 }}>
              <div
                className="sp-sidebar-panel sp-sidebar-scroll"
                style={{
                  background:'#fff', borderRadius:16, border:`1px solid ${T.gray100}`,
                  boxShadow:T.shadow, padding:'16px 14px',
                  maxHeight:'calc(100vh - 110px)', overflowY:'auto',
                }}
              >
                <FilterPanel {...filterProps} />
              </div>
            </div>
          )}

          {/* â”€â”€ RIGHT COLUMN â”€â”€ */}
          <div style={{ flex:1, minWidth:0 }}>

            {/* Sort + view toolbar */}
            <div className="sp-toolbar">
              <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                {showFilterSidebar && (
                  <button
                    type="button"
                    className="sp-mobile-filter-btn"
                    style={{ display:'none', alignItems:'center', gap:6, background:T.gray50, border:`1.5px solid ${T.gray200}`, borderRadius:10, padding:'8px 14px', fontSize:13, fontWeight:600, color:T.gray800, cursor:'pointer' }}
                    onClick={() => setMobileFilterOpen(true)}
                  >
                    {Icon.filter(15)} Filters
                    {(applied.cats.size > 0 || applied.priceMin || applied.priceMax || applied.verifiedOnly || applied.conditions.size > 0) && (
                      <span style={{ background:T.gray900, color:'#fff', borderRadius:'50%', width:18, height:18, fontSize:10, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {applied.cats.size + (applied.verifiedOnly ? 1 : 0) + applied.conditions.size}
                      </span>
                    )}
                  </button>
                )}

                <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                  <span style={{ display:'flex', color:T.gray500 }}>{Icon.sliders(14)}</span>
                  <select className="sp-sort-select" value={sortBy} onChange={e => { setSortBy(e.target.value); setPage(1) }} aria-label="Sort results">
                    <option value="relevance">Relevance</option>
                    <option value="newest">Newest first</option>
                    {activeTab === 'listings' && <option value="price_asc">Price: Low to High</option>}
                    {activeTab === 'listings' && <option value="price_desc">Price: High to Low</option>}
                    {activeTab === 'lookingfor' && <option value="price_asc">Budget: Low to High</option>}
                    {activeTab === 'lookingfor' && <option value="price_desc">Budget: High to Low</option>}
                  </select>
                </div>
              </div>

              {activeTab === 'listings' && (
                <div style={{ display:'flex', gap:6, background:T.gray50, padding:4, borderRadius:12, border:`1px solid ${T.gray100}` }}>
                  <button type="button" className={`sp-view-btn${viewMode === 'grid' ? ' active' : ''}`} onClick={() => setViewMode('grid')} title="Grid view" aria-label="Grid view">
                    {Icon.grid(15)}
                  </button>
                  <button type="button" className={`sp-view-btn${viewMode === 'list' ? ' active' : ''}`} onClick={() => setViewMode('list')} title="List view" aria-label="List view">
                    {Icon.list(15)}
                  </button>
                </div>
              )}
            </div>

            {/* â”€â”€ Results â”€â”€ */}
            {loading ? (
              activeTab === 'listings' ? (
                <div className="sp-results-grid grid-modern">
                  {Array.from({ length: Math.min(PAGE_SIZE, 12) }).map((_, i) => <SkeletonCard key={i} />)}
                </div>
              ) : (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {Array.from({ length: 5 }).map((_, i) => <SkeletonRowCard key={i} />)}
                </div>
              )
            ) : allResults.length === 0 ? (
              <EmptyState query={queryParam} onClearFilters={clearFiltersAndSearch} label={resultsLabel} />
            ) : activeTab === 'listings' ? (
              viewMode === 'list' ? (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {allResults.map((l) => (
                    <ResultCardList key={l.id} listing={l} delay={0} onClick={() => navigate(resultHref('listings', l))} />
                  ))}
                </div>
              ) : (
                <div className="sp-results-grid grid-modern">
                  {allResults.map((l) => (
                    <FBListingCard key={l.id} listing={l} onClick={() => navigate(resultHref('listings', l))} />
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

            {/* â”€â”€ See more (20 at a time) â€” no numbered page grid â”€â”€ */}
            {!loading && allResults.length > 0 && hasMore && (
              <SeeMoreButton
                loading={loadingMore}
                remaining={remaining}
                onClick={() => setPage(p => p + 1)}
              />
            )}
          </div>
        </div>
      </div>

      {/* â”€â”€ Notify Me modal â”€â”€ */}
      {notifyOpen && (
        <NotifyMeModal query={queryParam} user={user} onClose={() => setNotifyOpen(false)} />
      )}

      {/* â”€â”€ Mobile filter drawer â€” Marketplace tab only â”€â”€ */}
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
