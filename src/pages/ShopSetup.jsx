import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { uploadToR2, getR2Url, deleteFromR2 } from '../lib/r2'

/* ── Design tokens (aligned with marketplace) ── */
const T = {
  green: '#0F9D58',
  greenD: '#0a7a44',
  greenL: '#e8f5ee',
  amber: '#F9AB00',
  amberD: '#c88a00',
  amberL: '#fff8e6',
  dark: '#0f172a',
  white: '#ffffff',
  gray50: '#f8fafc',
  gray100: '#f1f5f9',
  gray200: '#e2e8f0',
  gray400: '#94a3b8',
  gray500: '#64748b',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1e293b',
  gray900: '#0f172a',
  red: '#dc2626',
  redL: '#fef2f2',
  shadow: '0 1px 3px rgba(0,0,0,.06), 0 8px 24px rgba(0,0,0,.04)',
  shadowMd: '0 4px 16px rgba(0,0,0,.08)',
}

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

const THEMES = [
  { id: 'green', label: 'Forest', color: '#0F9D58' },
  { id: 'gold', label: 'Gold', color: '#F9AB00' },
  { id: 'dark', label: 'Slate', color: '#1e293b' },
]

const STEPS = [
  { n: 1, label: 'Basics', short: 'Info' },
  { n: 2, label: 'Contact', short: 'Contact' },
  { n: 3, label: 'Branding', short: 'Brand' },
  { n: 4, label: 'Launch', short: 'Launch' },
]

/* Minimal icons */
const Icon = {
  check: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  chevL: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  chevR: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m9 18 6-6-6-6" />
    </svg>
  ),
  shop: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m2 7 4-4h12l4 4" /><path d="M3 7v13a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V7" /><path d="M16 11a4 4 0 0 1-8 0" />
    </svg>
  ),
  user: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="8" r="4" /><path d="M4 20a8 8 0 0 1 16 0" />
    </svg>
  ),
  building: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18" /><path d="M6 12h12" /><path d="M6 16h12" /><path d="M10 6h4" /><path d="M2 22h20" />
    </svg>
  ),
  pin: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z" /><circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
  phone: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z" />
    </svg>
  ),
  image: (s = 20) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="9" cy="9" r="2" /><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21" />
    </svg>
  ),
  rocket: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4.5 16.5c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8 1-2 1-2l-4-4s-1.2.3-2 1z" /><path d="m12 15-3-3a22 22 0 0 1 2-3.9A12.4 12.4 0 0 1 22 2c0 2.7-.6 5.4-2.1 7.6A22 22 0 0 1 16 12l-4 3z" /><path d="M9 12H4s.5-3 2-5c1.5 0 3 .5 4 2" /><path d="M12 15v5s3-.5 5-2c0-1.5-.5-3-2-4" />
    </svg>
  ),
  sparkles: (s = 22) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" /><path d="M5 3v4M19 17v4M3 5h4M17 19h4" />
    </svg>
  ),
  tag: (s = 14) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l7.6-7.6a1 1 0 0 0 0-1.4L12 2z" /><circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none" />
    </svg>
  ),
}

const css = `
  @import url('https://fonts.googleapis.com/css2?family=Sora:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  @keyframes ss-fade {
    from { opacity: 0; transform: translateY(10px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes ss-spin { to { transform: rotate(360deg); } }
  @keyframes ss-pop {
    0% { transform: scale(.92); opacity: 0; }
    100% { transform: scale(1); opacity: 1; }
  }

  .ss-root {
    font-family: 'Inter', system-ui, sans-serif;
    min-height: 100vh;
    min-height: 100dvh;
    background:
      radial-gradient(ellipse 80% 50% at 50% -10%, rgba(15,157,88,.08) 0%, transparent 55%),
      ${T.gray50};
    color: ${T.gray900};
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 20px 16px calc(40px + env(safe-area-inset-bottom, 0px));
    overflow-x: clip;
  }

  .ss-shell {
    width: 100%;
    max-width: 520px;
  }

  .ss-topbar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 18px;
  }
  .ss-brand {
    font-family: 'Sora', Inter, sans-serif;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: ${T.green};
    cursor: pointer;
  }
  .ss-brand span { color: ${T.amber}; }
  .ss-exit {
    border: 1.5px solid ${T.gray200};
    background: ${T.white};
    color: ${T.gray600};
    border-radius: 10px;
    padding: 8px 12px;
    font-size: 12.5px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
  }
  .ss-exit:hover { background: ${T.gray100}; color: ${T.gray900}; }

  /* Step rail */
  .ss-steps {
    display: flex;
    gap: 0;
    margin-bottom: 20px;
    background: ${T.white};
    border: 1px solid ${T.gray200};
    border-radius: 16px;
    padding: 10px 8px;
    box-shadow: ${T.shadow};
  }
  .ss-step {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    min-width: 0;
    position: relative;
  }
  .ss-step:not(:last-child)::after {
    content: '';
    position: absolute;
    top: 14px;
    left: calc(50% + 16px);
    right: calc(-50% + 16px);
    height: 2px;
    background: ${T.gray200};
    z-index: 0;
  }
  .ss-step.is-done:not(:last-child)::after { background: ${T.green}; }
  .ss-step-dot {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 11.5px;
    font-weight: 800;
    background: ${T.gray100};
    color: ${T.gray500};
    border: 2px solid ${T.gray200};
    z-index: 1;
    transition: all .2s;
  }
  .ss-step.is-active .ss-step-dot {
    background: ${T.green};
    border-color: ${T.green};
    color: #fff;
    box-shadow: 0 0 0 4px rgba(15,157,88,.15);
  }
  .ss-step.is-done .ss-step-dot {
    background: ${T.greenL};
    border-color: ${T.green};
    color: ${T.greenD};
  }
  .ss-step-name {
    font-size: 10.5px;
    font-weight: 700;
    color: ${T.gray500};
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 100%;
  }
  .ss-step.is-active .ss-step-name { color: ${T.gray900}; }
  .ss-step.is-done .ss-step-name { color: ${T.greenD}; }

  .ss-card {
    background: ${T.white};
    border: 1px solid ${T.gray200};
    border-radius: 20px;
    padding: 24px 22px 22px;
    box-shadow: ${T.shadow};
    animation: ss-fade .32s cubic-bezier(.22,1,.36,1) both;
  }

  .ss-head { margin-bottom: 20px; }
  .ss-head h1 {
    font-family: 'Sora', Inter, sans-serif;
    font-size: 21px;
    font-weight: 800;
    letter-spacing: -0.5px;
    color: ${T.gray900};
    line-height: 1.2;
  }
  .ss-head p {
    font-size: 13.5px;
    color: ${T.gray500};
    margin-top: 6px;
    line-height: 1.5;
  }

  .ss-field { margin-bottom: 16px; }
  .ss-label {
    display: block;
    font-size: 12.5px;
    font-weight: 700;
    color: ${T.gray800};
    margin-bottom: 7px;
  }
  .ss-label .req { color: ${T.red}; margin-left: 2px; }
  .ss-hint {
    font-size: 12px;
    color: ${T.gray400};
    margin-top: 6px;
    line-height: 1.45;
  }

  .ss-input, .ss-select, .ss-textarea {
    width: 100%;
    border: 1.5px solid ${T.gray200};
    border-radius: 12px;
    padding: 12px 14px;
    font-size: 16px; /* iOS no-zoom */
    font-weight: 500;
    font-family: inherit;
    color: ${T.gray900};
    background: ${T.white};
    transition: border-color .15s, box-shadow .15s;
    -webkit-appearance: none;
    appearance: none;
  }
  .ss-input::placeholder, .ss-textarea::placeholder { color: ${T.gray400}; }
  .ss-input:focus, .ss-select:focus, .ss-textarea:focus {
    outline: none;
    border-color: ${T.green};
    box-shadow: 0 0 0 3px rgba(15,157,88,.12);
  }
  .ss-textarea { resize: vertical; min-height: 80px; line-height: 1.45; font-size: 15px; }
  .ss-select {
    background-image: url("data:image/svg+xml,%3Csvg width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2364748b' stroke-width='2.5'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    padding-right: 36px;
    cursor: pointer;
  }

  .ss-wa {
    display: flex;
    gap: 8px;
    align-items: stretch;
  }
  .ss-wa-prefix {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 12px;
    border: 1.5px solid ${T.gray200};
    border-radius: 12px;
    font-size: 14px;
    font-weight: 700;
    color: ${T.gray600};
    background: ${T.gray50};
    flex-shrink: 0;
    white-space: nowrap;
  }

  /* Type cards */
  .ss-type-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  @media (max-width: 420px) {
    .ss-type-grid { grid-template-columns: 1fr; }
  }
  .ss-type-card {
    border: 1.5px solid ${T.gray200};
    border-radius: 14px;
    padding: 14px 12px;
    cursor: pointer;
    transition: all .15s;
    text-align: left;
    background: ${T.white};
    font-family: inherit;
    width: 100%;
  }
  .ss-type-card:hover { border-color: ${T.gray400}; }
  .ss-type-card.active {
    border-color: ${T.green};
    background: ${T.greenL};
    box-shadow: 0 0 0 3px rgba(15,157,88,.1);
  }
  .ss-type-ico {
    width: 36px; height: 36px; border-radius: 10px;
    display: flex; align-items: center; justify-content: center;
    background: ${T.gray100}; color: ${T.gray700};
    margin-bottom: 10px;
  }
  .ss-type-card.active .ss-type-ico {
    background: #fff; color: ${T.greenD};
  }
  .ss-type-card h4 {
    font-size: 13.5px;
    font-weight: 800;
    color: ${T.gray900};
    margin-bottom: 4px;
  }
  .ss-type-card p {
    font-size: 11.5px;
    color: ${T.gray500};
    line-height: 1.4;
  }

  /* Logo / cover */
  .ss-logo-row {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .ss-logo-preview {
    width: 72px; height: 72px;
    border-radius: 18px;
    background: linear-gradient(135deg, ${T.greenL}, #fff);
    border: 1.5px solid ${T.gray200};
    display: flex; align-items: center; justify-content: center;
    font-size: 22px; font-weight: 800; color: ${T.greenD};
    overflow: hidden; flex-shrink: 0;
  }
  .ss-logo-preview img { width: 100%; height: 100%; object-fit: cover; }
  .ss-logo-actions { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .ss-upload-btn {
    font-size: 13px; font-weight: 700; font-family: inherit;
    color: ${T.greenD}; background: ${T.greenL};
    border: none; border-radius: 10px;
    padding: 9px 14px; cursor: pointer; width: fit-content;
  }
  .ss-upload-btn:hover { filter: brightness(.97); }
  .ss-remove-btn {
    font-size: 12px; font-weight: 600; font-family: inherit;
    color: ${T.gray500}; background: none; border: none;
    cursor: pointer; width: fit-content; text-align: left;
  }
  .ss-remove-btn:hover { color: ${T.red}; }

  .ss-cover-drop {
    border: 1.5px dashed ${T.gray300};
    border-radius: 14px;
    height: 120px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    transition: border-color .15s, background .15s;
    background: ${T.gray50};
    overflow: hidden;
  }
  .ss-cover-drop:hover { border-color: ${T.green}; background: ${T.greenL}; }
  .ss-cover-drop img { width: 100%; height: 100%; object-fit: cover; }
  .ss-cover-ph {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    color: ${T.gray500}; font-size: 12.5px; font-weight: 600; padding: 12px; text-align: center;
  }
  .ss-cover-ph strong { color: ${T.gray700}; font-size: 13px; }

  .ss-theme-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .ss-theme-swatch {
    border: 1.5px solid ${T.gray200};
    border-radius: 14px;
    padding: 14px 8px;
    text-align: center;
    cursor: pointer;
    transition: all .15s;
    background: ${T.white};
    font-family: inherit;
  }
  .ss-theme-swatch.active {
    border-color: ${T.green};
    box-shadow: 0 0 0 3px rgba(15,157,88,.1);
  }
  .ss-theme-dot {
    width: 28px; height: 28px;
    border-radius: 50%;
    margin: 0 auto 8px;
    box-shadow: inset 0 0 0 2px rgba(255,255,255,.3);
  }
  .ss-theme-swatch span {
    font-size: 12px; font-weight: 700; color: ${T.gray800};
  }

  /* Confirm summary (no shop preview mock) */
  .ss-summary {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 8px;
  }
  .ss-summary-row {
    display: flex;
    align-items: flex-start;
    gap: 12px;
    padding: 12px 12px;
    border-radius: 14px;
    background: ${T.gray50};
    border: 1px solid ${T.gray100};
  }
  .ss-summary-ico {
    width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
    background: ${T.white};
    border: 1px solid ${T.gray200};
    display: flex; align-items: center; justify-content: center;
    color: ${T.gray600};
  }
  .ss-summary-row strong {
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: ${T.gray500};
    text-transform: uppercase;
    letter-spacing: .04em;
    margin-bottom: 3px;
  }
  .ss-summary-row span {
    font-size: 14px;
    font-weight: 600;
    color: ${T.gray900};
    line-height: 1.35;
    word-break: break-word;
  }
  .ss-summary-row .muted { color: ${T.gray400}; font-weight: 500; }

  .ss-launch-note {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 12px 14px;
    border-radius: 12px;
    background: ${T.amberL};
    border: 1px solid #fde68a;
    font-size: 12.5px;
    color: ${T.gray700};
    line-height: 1.45;
    margin-top: 14px;
  }

  .ss-nav {
    display: flex;
    gap: 10px;
    margin-top: 22px;
  }
  .ss-btn {
    border: none;
    border-radius: 12px;
    padding: 13px 18px;
    font-size: 14.5px;
    font-weight: 700;
    font-family: inherit;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    transition: transform .12s, box-shadow .15s, background .15s;
    min-height: 48px;
    -webkit-tap-highlight-color: transparent;
  }
  .ss-btn:active { transform: scale(.98); }
  .ss-btn:disabled { opacity: .6; cursor: not-allowed; transform: none; }
  .ss-btn-primary {
    flex: 1;
    background: ${T.green};
    color: #fff;
    box-shadow: 0 4px 14px rgba(15,157,88,.28);
  }
  .ss-btn-primary:hover:not(:disabled) { background: ${T.greenD}; }
  .ss-btn-launch {
    flex: 1;
    background: linear-gradient(135deg, ${T.amber}, ${T.amberD});
    color: ${T.gray900};
    box-shadow: 0 4px 16px rgba(249,171,0,.3);
  }
  .ss-btn-back {
    background: ${T.white};
    color: ${T.gray800};
    border: 1.5px solid ${T.gray200};
    padding: 13px 16px;
  }
  .ss-btn-back:hover:not(:disabled) { background: ${T.gray50}; }

  .ss-spinner {
    width: 16px; height: 16px;
    border-radius: 50%;
    border: 2.2px solid rgba(15,27,14,.15);
    border-top-color: ${T.gray900};
    animation: ss-spin .6s linear infinite;
  }

  .ss-error {
    background: ${T.redL};
    border: 1px solid #fecaca;
    color: ${T.red};
    border-radius: 12px;
    padding: 11px 14px;
    font-size: 13px;
    font-weight: 600;
    margin-bottom: 16px;
    line-height: 1.4;
  }

  .ss-success {
    text-align: center;
    padding: 36px 16px 28px;
    animation: ss-pop .4s cubic-bezier(.34,1.4,.64,1) both;
  }
  .ss-success-ico {
    width: 72px; height: 72px; border-radius: 20px;
    margin: 0 auto 16px;
    background: linear-gradient(135deg, ${T.greenL}, ${T.amberL});
    border: 1px solid ${T.gray200};
    display: flex; align-items: center; justify-content: center;
    color: ${T.greenD};
  }
  .ss-success h2 {
    font-family: 'Sora', Inter, sans-serif;
    font-size: 20px; font-weight: 800; color: ${T.gray900};
    letter-spacing: -.4px;
  }
  .ss-success p {
    font-size: 14px; color: ${T.gray500}; margin-top: 8px; line-height: 1.45;
  }

  @media (max-width: 480px) {
    .ss-card { padding: 20px 16px 18px; border-radius: 18px; }
    .ss-head h1 { font-size: 19px; }
    .ss-step-name { font-size: 10px; }
    .ss-steps { padding: 8px 4px; }
  }
`

function initials(name) {
  if (!name) return '?'
  const parts = name.trim().split(/\s+/)
  return parts.slice(0, 2).map(p => p[0]?.toUpperCase()).join('')
}

function slugify(name) {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
}

export default function ShopSetup() {
  const navigate = useNavigate()
  const logoInputRef = useRef(null)
  const coverInputRef = useRef(null)

  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [sellerType, setSellerType] = useState('individual')
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')

  const [district, setDistrict] = useState('')
  const [city, setCity] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [phone, setPhone] = useState('')
  const [address, setAddress] = useState('')

  const [logoFile, setLogoFile] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [coverFile, setCoverFile] = useState(null)
  const [coverPreview, setCoverPreview] = useState(null)
  const [theme, setTheme] = useState('green')

  function validateStep1() {
    if (!name.trim()) return 'Shop name is required'
    if (!category) return 'Please choose a category'
    return ''
  }
  function validateStep2() {
    if (!district) return 'Please choose a district'
    if (!whatsapp.trim()) return 'WhatsApp number is required'
    if (!/^[0-9+\s-]{7,15}$/.test(whatsapp.trim())) return 'Enter a valid WhatsApp number'
    return ''
  }

  function goNext() {
    let err = ''
    if (step === 1) err = validateStep1()
    if (step === 2) err = validateStep2()
    if (err) { setError(err); return }
    setError('')
    setStep(s => Math.min(s + 1, 4))
  }
  function goBack() {
    setError('')
    setStep(s => Math.max(s - 1, 1))
  }

  function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }
  function handleCoverChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setCoverFile(file)
    setCoverPreview(URL.createObjectURL(file))
  }

  async function uploadImage(file, prefix) {
    const ext = file.name.split('.').pop()
    const path = `${prefix}/${crypto.randomUUID()}.${ext}`
    const url = await uploadToR2(file, 'shop-images/' + path)
    if (!url) throw new Error('Upload failed')
    return url
  }

  async function handleLaunch() {
    setLoading(true)
    setError('')
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { navigate('/login'); return }

      let logo_url = null
      let cover_url = null
      if (logoFile) logo_url = await uploadImage(logoFile, 'logos')
      if (coverFile) cover_url = await uploadImage(coverFile, 'covers')

      const baseSlug = slugify(name) || 'shop'
      const slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`

      const { error: insertErr } = await supabase.from('shops').insert({
        owner_id: user.id,
        name: name.trim(),
        slug,
        category,
        description: description.trim() || null,
        seller_type: sellerType,
        district,
        city: city.trim() || null,
        whatsapp: whatsapp.trim(),
        phone: phone.trim() || null,
        address: address.trim() || null,
        logo_url,
        cover_url,
        theme,
      })
      if (insertErr) throw insertErr

      await supabase.from('profiles').update({
        onboarded: true,
        account_type: 'shop',
      }).eq('id', user.id)

      setStep(5)
      setTimeout(() => navigate(`/shop/${slug}`), 1600)
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="ss-root">
      <style>{css}</style>

      <div className="ss-shell">
        {step <= 4 && (
          <>
            <div className="ss-topbar">
              <div className="ss-brand" onClick={() => navigate('/')} role="link" tabIndex={0}>
                Soko<span>MW</span>
              </div>
              <button type="button" className="ss-exit" onClick={() => navigate(-1)}>
                Cancel
              </button>
            </div>

            <div className="ss-steps" aria-label="Setup progress">
              {STEPS.map(s => (
                <div
                  key={s.n}
                  className={`ss-step${step === s.n ? ' is-active' : ''}${step > s.n ? ' is-done' : ''}`}
                >
                  <div className="ss-step-dot">
                    {step > s.n ? Icon.check(13) : s.n}
                  </div>
                  <div className="ss-step-name">{s.short}</div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── STEP 1 ── */}
        {step === 1 && (
          <div className="ss-card">
            <div className="ss-head">
              <h1>Create your shop</h1>
              <p>Basics only — takes under a minute. You can edit everything later.</p>
            </div>

            {error && <div className="ss-error">{error}</div>}

            <div className="ss-field">
              <label className="ss-label">Shop type</label>
              <div className="ss-type-grid">
                <button
                  type="button"
                  className={`ss-type-card${sellerType === 'individual' ? ' active' : ''}`}
                  onClick={() => setSellerType('individual')}
                >
                  <div className="ss-type-ico">{Icon.user(18)}</div>
                  <h4>Individual seller</h4>
                  <p>Student, casual trader, or side hustle</p>
                </button>
                <button
                  type="button"
                  className={`ss-type-card${sellerType === 'business' ? ' active' : ''}`}
                  onClick={() => setSellerType('business')}
                >
                  <div className="ss-type-ico">{Icon.building(18)}</div>
                  <h4>Registered business</h4>
                  <p>Boutique, hardware, pharmacy, store</p>
                </button>
              </div>
            </div>

            <div className="ss-field">
              <label className="ss-label">Shop name<span className="req">*</span></label>
              <input
                className="ss-input"
                type="text"
                placeholder="e.g. Grace Fashion Boutique"
                value={name}
                onChange={e => setName(e.target.value)}
                autoComplete="organization"
              />
              <div className="ss-hint">Shown on your public shop page and listings</div>
            </div>

            <div className="ss-field">
              <label className="ss-label">Category<span className="req">*</span></label>
              <select className="ss-select" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">Select a category</option>
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="ss-field">
              <label className="ss-label">Short description</label>
              <textarea
                className="ss-textarea"
                placeholder="What do you sell? Quality, prices, delivery…"
                value={description}
                onChange={e => setDescription(e.target.value)}
              />
            </div>

            <div className="ss-nav">
              <button type="button" className="ss-btn ss-btn-primary" onClick={goNext}>
                Continue {Icon.chevR(16)}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 2 ── */}
        {step === 2 && (
          <div className="ss-card">
            <div className="ss-head">
              <h1>Location & contact</h1>
              <p>Help buyers find you and message you on WhatsApp.</p>
            </div>

            {error && <div className="ss-error">{error}</div>}

            <div className="ss-field">
              <label className="ss-label">District<span className="req">*</span></label>
              <select className="ss-select" value={district} onChange={e => setDistrict(e.target.value)}>
                <option value="">Select your district</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            <div className="ss-field">
              <label className="ss-label">City / trading centre</label>
              <input
                className="ss-input"
                type="text"
                placeholder="e.g. Area 25, Chinsapo, Mzuzu"
                value={city}
                onChange={e => setCity(e.target.value)}
              />
            </div>

            <div className="ss-field">
              <label className="ss-label">WhatsApp number<span className="req">*</span></label>
              <div className="ss-wa">
                <div className="ss-wa-prefix">🇲🇼 +265</div>
                <input
                  className="ss-input"
                  type="tel"
                  inputMode="tel"
                  placeholder="999 XXX XXX"
                  value={whatsapp}
                  onChange={e => setWhatsapp(e.target.value)}
                />
              </div>
              <div className="ss-hint">Most buyers message here — keep it active</div>
            </div>

            <div className="ss-field">
              <label className="ss-label">Phone (optional)</label>
              <input
                className="ss-input"
                type="tel"
                inputMode="tel"
                placeholder="If different from WhatsApp"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
            </div>

            <div className="ss-field">
              <label className="ss-label">Physical address (optional)</label>
              <input
                className="ss-input"
                type="text"
                placeholder="e.g. Opposite Chichiri Shopping Mall"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>

            <div className="ss-nav">
              <button type="button" className="ss-btn ss-btn-back" onClick={goBack}>
                {Icon.chevL(16)} Back
              </button>
              <button type="button" className="ss-btn ss-btn-primary" onClick={goNext}>
                Continue {Icon.chevR(16)}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3 ── */}
        {step === 3 && (
          <div className="ss-card">
            <div className="ss-head">
              <h1>Branding</h1>
              <p>Optional — logo and cover make your shop look professional. Add later anytime.</p>
            </div>

            <div className="ss-field">
              <label className="ss-label">Shop logo</label>
              <div className="ss-logo-row">
                <div className="ss-logo-preview">
                  {logoPreview ? <img src={logoPreview} alt="" /> : initials(name)}
                </div>
                <div className="ss-logo-actions">
                  <button type="button" className="ss-upload-btn" onClick={() => logoInputRef.current?.click()}>
                    Upload logo
                  </button>
                  {logoPreview && (
                    <button
                      type="button"
                      className="ss-remove-btn"
                      onClick={() => { setLogoFile(null); setLogoPreview(null) }}
                    >
                      Remove — use initials
                    </button>
                  )}
                </div>
                <input ref={logoInputRef} type="file" accept="image/*" hidden onChange={handleLogoChange} />
              </div>
              <div className="ss-hint">
                No logo? We’ll use initials ({initials(name) || '…'}).
              </div>
            </div>

            <div className="ss-field">
              <label className="ss-label">Cover photo</label>
              <div className="ss-cover-drop" onClick={() => coverInputRef.current?.click()} role="button" tabIndex={0}>
                {coverPreview ? (
                  <img src={coverPreview} alt="" />
                ) : (
                  <div className="ss-cover-ph">
                    {Icon.image(28)}
                    <strong>Tap to upload cover</strong>
                    <span>Storefront, products, or banner</span>
                  </div>
                )}
              </div>
              <input ref={coverInputRef} type="file" accept="image/*" hidden onChange={handleCoverChange} />
            </div>

            <div className="ss-field">
              <label className="ss-label">Shop theme</label>
              <div className="ss-theme-grid">
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    type="button"
                    className={`ss-theme-swatch${theme === t.id ? ' active' : ''}`}
                    onClick={() => setTheme(t.id)}
                  >
                    <div className="ss-theme-dot" style={{ background: t.color }} />
                    <span>{t.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="ss-nav">
              <button type="button" className="ss-btn ss-btn-back" onClick={goBack}>
                {Icon.chevL(16)} Back
              </button>
              <button type="button" className="ss-btn ss-btn-primary" onClick={goNext}>
                Continue {Icon.chevR(16)}
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 4: Confirm & launch (no shop preview mock) ── */}
        {step === 4 && (
          <div className="ss-card">
            <div className="ss-head">
              <h1>Confirm & launch</h1>
              <p>Double-check your details, then go live. You can edit anything later.</p>
            </div>

            {error && <div className="ss-error">{error}</div>}

            <div className="ss-summary">
              <div className="ss-summary-row">
                <div className="ss-summary-ico">{Icon.shop(16)}</div>
                <div>
                  <strong>Shop</strong>
                  <span>{name || '—'}</span>
                  <span className="muted" style={{ display: 'block', fontSize: 12.5, marginTop: 2 }}>
                    {sellerType === 'business' ? 'Registered business' : 'Individual seller'}
                    {category ? ` · ${category}` : ''}
                  </span>
                </div>
              </div>
              <div className="ss-summary-row">
                <div className="ss-summary-ico">{Icon.pin(16)}</div>
                <div>
                  <strong>Location</strong>
                  <span>
                    {city ? `${city}, ` : ''}{district || '—'}
                  </span>
                  {address ? (
                    <span className="muted" style={{ display: 'block', fontSize: 12.5, marginTop: 2 }}>{address}</span>
                  ) : null}
                </div>
              </div>
              <div className="ss-summary-row">
                <div className="ss-summary-ico">{Icon.phone(16)}</div>
                <div>
                  <strong>WhatsApp</strong>
                  <span>+265 {whatsapp || '—'}</span>
                  {phone ? (
                    <span className="muted" style={{ display: 'block', fontSize: 12.5, marginTop: 2 }}>Phone: {phone}</span>
                  ) : null}
                </div>
              </div>
              <div className="ss-summary-row">
                <div className="ss-summary-ico">{Icon.image(16)}</div>
                <div>
                  <strong>Branding</strong>
                  <span>
                    {logoPreview ? 'Logo uploaded' : 'Initials logo'}
                    {' · '}
                    {coverPreview ? 'Cover set' : 'No cover'}
                    {' · '}
                    {THEMES.find(t => t.id === theme)?.label || 'Theme'} theme
                  </span>
                </div>
              </div>
              {description.trim() ? (
                <div className="ss-summary-row">
                  <div className="ss-summary-ico">{Icon.tag(16)}</div>
                  <div>
                    <strong>About</strong>
                    <span style={{ fontWeight: 500, color: T.gray700 }}>{description.trim()}</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="ss-launch-note">
              <span style={{ flexShrink: 0, color: T.amberD }}>{Icon.sparkles(16)}</span>
              <span>
                Launching creates your public shop page. You can add products and polish branding from your dashboard right after.
              </span>
            </div>

            <div className="ss-nav">
              <button type="button" className="ss-btn ss-btn-back" onClick={goBack} disabled={loading}>
                {Icon.chevL(16)} Back
              </button>
              <button type="button" className="ss-btn ss-btn-launch" onClick={handleLaunch} disabled={loading}>
                {loading ? <div className="ss-spinner" /> : <>{Icon.rocket(16)} Launch shop</>}
              </button>
            </div>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {step === 5 && (
          <div className="ss-card">
            <div className="ss-success">
              <div className="ss-success-ico">{Icon.sparkles(32)}</div>
              <h2>Shop created!</h2>
              <p>Taking you to your new shop…</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
