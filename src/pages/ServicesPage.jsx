import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { SERVICE_CATS, CITIES, avatarColor, initials } from './serviceData'
import ServiceForm from './ServiceForm'
import ProviderModal from './ProviderModal'
import SokoNav from '../components/SokoNav'
import { Search, X, MapPin, Wrench, Pencil, Pause, Play, Trash2, Loader2, BadgeCheck, ChevronDown, Filter, ArrowUpDown, LayoutGrid } from 'lucide-react'

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
    padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
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
  .svc-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-top: 12px; }
  @media (min-width: 768px) { .svc-grid { grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; } }
  @media (min-width: 1100px) { .svc-grid { grid-template-columns: repeat(4, 1fr); gap: 20px; margin-top: 20px; } }

  /* Card */
  .svc-card {
    background: #fff; border: 1px solid #e8eaed; border-radius: 16px;
    box-shadow: 0 1px 3px rgba(0,0,0,.04); overflow: visible;
    transition: transform .2s ease, box-shadow .2s ease;
    display: flex; flex-direction: column; text-align: left;
    font-family: inherit; cursor: pointer; animation: svc-fadeUp .4s ease both;
    padding: 0;
  }
  .svc-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,.08); }
  .svc-card:active { transform: translateY(0); }
  .svc-card-img {
    position: relative; width: 100%; aspect-ratio: 16 / 10; overflow: hidden;
    border-radius: 16px 16px 0 0; background: linear-gradient(135deg, #e6f6ed, #f8f9fa);
    display: flex; align-items: center; justify-content: center;
  }
  .svc-card-img img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .svc-card-icon { color: #0F9D58; opacity: .7; }
  .svc-cat-pill {
    position: absolute; bottom: 8px; left: 8px;
    background: rgba(255,255,255,.85); color: #0F9D58;
    font-size: 11px; font-weight: 700; padding: 4px 8px; border-radius: 999px;
    backdrop-filter: blur(4px); max-width: calc(100% - 16px);
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  }
  .svc-card-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; min-width: 0; }
  .svc-card-title { font-size: 15px; font-weight: 700; color: #202124; line-height: 1.3; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .svc-provider { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .svc-avatar {
    width: 22px; height: 22px; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 9px; font-weight: 800; color: #fff; overflow: hidden;
    background: #0F9D58;
  }
  .svc-avatar img { width: 100%; height: 100%; object-fit: cover; }
  .svc-provider-info { display: flex; flex-direction: column; gap: 2px; min-width: 0; flex: 1; }
  .svc-provider-name { font-size: 12px; color: #5f6368; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .svc-verified { color: #1A73E8; display: inline-flex; align-items: center; }
  .svc-location { font-size: 12px; color: #80868b; display: inline-flex; align-items: center; gap: 4px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .svc-location svg { flex-shrink: 0; }
  .svc-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  @media (max-width: 767px) { .svc-card-footer { flex-direction: column; align-items: stretch; } }
  .svc-price { font-size: 15px; font-weight: 700; color: #202124; }
  .svc-price-unit { font-size: 12px; color: #80868b; margin-left: 2px; font-weight: 500; }
  .svc-book-btn {
    height: 34px; padding: 0 14px; border: none; border-radius: 10px;
    background: #0F9D58; color: #fff; font-size: 13px; font-weight: 700;
    cursor: pointer; display: inline-flex; align-items: center; justify-content: center;
    gap: 4px; flex-shrink: 0; font-family: inherit;
  }
  @media (max-width: 767px) { .svc-book-btn { width: 100%; } }

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
  .svc-empty-icon { color: #9aa0a6; margin-bottom: 4px; }
  .svc-empty-title { font-size: 16px; font-weight: 700; color: #202124; }
  .svc-empty-sub { font-size: 13px; color: #5f6368; }
  .svc-clear-btn {
    height: 40px; padding: 0 16px; border: 1.5px solid #0F9D58; background: transparent;
    color: #0F9D58; border-radius: 10px; font-size: 13px; font-weight: 700;
    cursor: pointer; margin-top: 8px; font-family: inherit;
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

  button { font-family: inherit; cursor: pointer; }
  input, select { font-family: inherit; }
`

function formatPrice(rate) {
  if (!rate) return { amount: '', unit: '' }
  const s = String(rate).trim()
  const slashIdx = s.indexOf('/')
  const amountPart = slashIdx >= 0 ? s.slice(0, slashIdx).trim() : s
  const unitPart = slashIdx >= 0 ? '/' + s.slice(slashIdx + 1).trim() : ''
  const formattedAmount = amountPart.replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
  return { amount: formattedAmount, unit: unitPart }
}

function ServiceCard({ svc, delay, onClick, onBook, isMine, onEdit, onToggle, toggling, onDelete }) {
  const [imgErr, setImgErr] = useState(false)
  const profile = svc.profile
  const catUi = SERVICE_CATS.find(c => c.name === svc.category)
  const heroMedia = svc.media_urls?.[0]
  const rawTitle = svc.title || svc.name
  const providerName = profile?.shop_name || profile?.full_name
  const title = rawTitle || providerName || 'Service'
  const showProvider = !!rawTitle && !!providerName
  const avatarUrl = profile?.avatar_url
  const avatarName = providerName || title
  const avatarInitials = initials(avatarName)
  const avatarBg = avatarColor(avatarName)
  const verified = svc.verified || profile?.verified
  const districtLabel = profile?.district || svc.city || 'Malawi'
  const price = formatPrice(svc.rate)

  function handleBook(e) {
    e.stopPropagation()
    if (onBook) onBook(e)
  }

  return (
    <button type="button" className="svc-card" style={{ animationDelay: `${delay}s` }} onClick={onClick}>
      <div className="svc-card-img">
        {heroMedia && !imgErr ? (
          <img src={heroMedia} alt="" loading="lazy" onError={() => setImgErr(true)} />
        ) : (
          <div className="svc-card-icon">
            {catUi ? <catUi.icon size={32} strokeWidth={1.8} /> : <Wrench size={32} strokeWidth={2} />}
          </div>
        )}
        {svc.category && <span className="svc-cat-pill">{svc.category}</span>}
      </div>
      <div className="svc-card-body">
        <h3 className="svc-card-title">{title}</h3>
        {showProvider && (
          <div className="svc-provider">
            <div className="svc-avatar" style={{ background: avatarUrl ? 'transparent' : avatarBg }}>
              {avatarUrl ? <img src={avatarUrl} alt="" /> : avatarInitials}
            </div>
            <div className="svc-provider-info">
              <span className="svc-provider-name">
                {providerName}
                {verified && <span className="svc-verified"><BadgeCheck size={12} strokeWidth={2.5} /></span>}
              </span>
              <span className="svc-location"><MapPin size={12} strokeWidth={2.2} /> {districtLabel}</span>
            </div>
          </div>
        )}
        <div className="svc-card-footer">
          <div className="svc-price">
            {price.amount}
            {price.unit && <span className="svc-price-unit">{price.unit}</span>}
          </div>
          {!isMine && (
            <button type="button" className="svc-book-btn" onClick={handleBook}>Book now</button>
          )}
        </div>
        {isMine && (
          <div className="svc-card-actions">
            <button type="button" className="svc-action svc-action-edit" onClick={(e) => { e.stopPropagation(); onEdit?.() }}>
              <Pencil size={12} /> Edit
            </button>
            <button type="button" className="svc-action svc-action-pause" onClick={(e) => { e.stopPropagation(); onToggle?.() }} disabled={toggling}>
              {toggling ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : (svc.status === 'active' ? <Pause size={12} /> : <Play size={12} />)}
              {svc.status === 'active' ? 'Pause' : 'Activate'}
            </button>
            <button type="button" className="svc-action svc-action-delete" onClick={(e) => { e.stopPropagation(); onDelete?.() }}>
              <Trash2 size={12} /> Delete
            </button>
          </div>
        )}
      </div>
    </button>
  )
}

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
  const [verifiedOnly, setVerifiedOnly] = useState(false)
  const [sortBy, setSortBy] = useState('newest')
  const [togglingId, setTogglingId] = useState(null)

  const [cityOpen, setCityOpen] = useState(false)
  const [cityQuery, setCityQuery] = useState('')
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [draftVerified, setDraftVerified] = useState(false)
  const [draftCat, setDraftCat] = useState('')
  const [draftCity, setDraftCity] = useState('All')
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < 1100 : true))

  const touchStartY = useRef(0)

  useEffect(() => { init() }, [])

  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 1100)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

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

    setServices(list.map(s => ({
      ...s,
      profile: profileMap[s.provider_id] || null,
    })))
    setLoading(false)
  }

  let filtered = services.filter(s => {
    if (activeCat && s.category !== activeCat) return false
    if (activeCity !== 'All' && s.city !== activeCity) return false
    if (verifiedOnly && !(s.verified || s.profile?.verified)) return false
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
  if (sortBy === 'verified') {
    filtered = [...filtered].sort((a, b) => {
      const av = (a.verified || a.profile?.verified) ? 1 : 0
      const bv = (b.verified || b.profile?.verified) ? 1 : 0
      if (bv !== av) return bv - av
      return new Date(b.created_at) - new Date(a.created_at)
    })
  } else {
    filtered = [...filtered].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
  }

  const catCounts = {}
  services.forEach(s => { catCounts[s.category] = (catCounts[s.category] || 0) + 1 })
  const cityCounts = {}
  services.forEach(s => { if (s.city) cityCounts[s.city] = (cityCounts[s.city] || 0) + 1 })
  const myServices = services.filter(s => s.provider_id === currentUser?.id)

  const n = filtered.length
  const resultText = `${n} service${n !== 1 ? 's' : ''}${activeCity !== 'All' ? ` in ${activeCity}` : ''}`
  const filterActive = verifiedOnly || activeCat !== '' || activeCity !== 'All'

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
            <div className="svc-search">
              <Search size={16} strokeWidth={2.2} style={{ color: '#9aa0a6', flexShrink: 0 }} />
              <input
                placeholder="What do you need? e.g. plumber, tutor, photographer"
                value={search}
                onChange={e => setSearch(e.target.value)}
                autoComplete="off"
              />
              {search && (
                <button type="button" className="svc-search-clear" onClick={() => setSearch('')} aria-label="Clear search">
                  <X size={16} strokeWidth={2.5} />
                </button>
              )}
            </div>

            <div className="svc-city-wrap">
              <button type="button" className="svc-city-pill" onClick={() => setCityOpen(v => !v)}>
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
                <button type="button" className={`svc-seg${tab === 'browse' ? ' active' : ''}`} onClick={() => setTab('browse')}>
                  All Services
                </button>
                <button type="button" className={`svc-seg${tab === 'mine' ? ' active' : ''}`} onClick={() => setTab('mine')}>
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
                      <option value="newest">Newest</option>
                      <option value="verified">Verified first</option>
                    </select>
                  </div>
                )}
              </div>
            </div>

            {loading && (
              <div className="svc-grid">
                {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="skeleton" />)}
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="svc-empty">
                <div className="svc-empty-icon"><Search size={32} strokeWidth={1.5} /></div>
                <p className="svc-empty-title">No services found</p>
                <p className="svc-empty-sub">Try another category or city</p>
                <button type="button" className="svc-clear-btn" onClick={() => { setActiveCat(''); setActiveCity('All'); setSearch('') }}>
                  Clear filters
                </button>
              </div>
            )}

            {!loading && filtered.length > 0 && (
              <div className="svc-grid">
                {filtered.map((svc, i) => (
                  <ServiceCard
                    key={svc.id}
                    svc={svc}
                    delay={i * 0.03}
                    onClick={() => setSelectedProvider(svc)}
                    onBook={() => {
                      if (currentUser) navigate(`/chat/${svc.provider_id}/${svc.id}?src=service`, { state: { source: 'service' } })
                    }}
                    isMine={false}
                  />
                ))}
              </div>
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
              <button type="button" className={`svc-seg${tab === 'browse' ? ' active' : ''}`} onClick={() => setTab('browse')}>
                All Services
              </button>
              <button type="button" className={`svc-seg${tab === 'mine' ? ' active' : ''}`} onClick={() => setTab('mine')}>
                My Services ({myServices.length})
              </button>
            </div>
            {myServices.length === 0 ? (
              <div className="svc-empty">
                <div className="svc-empty-icon"><Wrench size={32} strokeWidth={1.5} /></div>
                <p className="svc-empty-title">No services found</p>
                <p className="svc-empty-sub">Try another category or city</p>
                <button type="button" className="svc-clear-btn" onClick={() => { setEditingService(null); setTab('post') }}>
                  List Service
                </button>
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
                    onEdit={() => { setEditingService(svc); setTab('post') }}
                    onToggle={async () => {
                      setTogglingId(svc.id)
                      const ns = svc.status === 'active' ? 'paused' : 'active'
                      await supabase.from('services').update({ status: ns }).eq('id', svc.id)
                      setTogglingId(null)
                      loadServices()
                    }}
                    toggling={togglingId === svc.id}
                    onDelete={async () => {
                      await supabase.from('services').delete().eq('id', svc.id)
                      loadServices()
                    }}
                  />
                ))}
              </div>
            )}
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
