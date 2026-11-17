import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isServiceVerified } from '../lib/serviceRanking'
import { SERVICE_CATS, avatarColor, initials } from './serviceData'
import { formatWhatsApp } from './services/serviceData'
import ServiceForm from './ServiceForm'
import { ArrowLeft, BadgeCheck, CheckCircle2, Eye, Flag, Lightbulb, MapPin, MessageCircle, Pencil, Phone, PlayCircle, Share2, Star, Wrench, X } from 'lucide-react'

const CSS = `
  .sd-page { background:#f8f9fa; color:#202124; min-height:100vh; font-family:inherit; padding-bottom:calc(92px + env(safe-area-inset-bottom, 0px)); }
  .sd-wrap { max-width:1100px; margin:0 auto; padding:14px; }
  @media (min-width:1100px) { .sd-wrap { padding:24px; } .sd-page { padding-bottom:40px; } }
  .sd-cols { display:block; min-width:0; }
  .sd-main { min-width:0; }
  .sd-side { display:none; }
  @media (min-width:1100px) {
    .sd-cols { display:grid; grid-template-columns:minmax(0,2fr) minmax(0,1fr); gap:24px; align-items:start; }
    .sd-side { display:block; position:sticky; top:88px; }
  }

  .sd-gallery { position:relative; border-radius:16px; overflow:hidden; background:#e6f6ed; aspect-ratio:4/3; }
  .sd-track { display:flex; height:100%; overflow-x:auto; scroll-snap-type:x mandatory; scrollbar-width:none; -ms-overflow-style:none; }
  .sd-track::-webkit-scrollbar { display:none; }
  .sd-slide { position:relative; flex:0 0 100%; height:100%; scroll-snap-align:start; cursor:pointer; }
  .sd-slide img, .sd-slide video { width:100%; height:100%; object-fit:cover; display:block; }
  .sd-slide-empty { width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#e6f6ed; color:#0F9D58; }
  .sd-slide-play { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; pointer-events:none; }
  .sd-dots { display:flex; justify-content:center; align-items:center; gap:6px; padding:10px 0 0; }
  .sd-dot { width:8px; height:8px; border-radius:50%; border:none; padding:0; background:#c7cdd2; cursor:pointer; }
  .sd-dot.active { width:18px; border-radius:4px; background:#0F9D58; }
  .sd-overlay-btn { width:44px; height:44px; border:none; border-radius:50%; background:rgba(0,0,0,.45); color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; }
  .sd-overlay-left { position:absolute; top:12px; left:12px; z-index:2; }
  .sd-overlay-tools { position:absolute; top:12px; right:12px; display:flex; gap:8px; z-index:2; }

  .sd-title { font-size:20px; font-weight:800; line-height:1.25; margin:16px 0 8px; }
  .sd-pill { display:inline-flex; align-items:center; gap:5px; background:#e6f6ed; color:#0F9D58; border-radius:999px; padding:4px 10px; font-size:12px; font-weight:700; }
  .sd-provider { display:flex; align-items:center; gap:10px; margin:14px 0 0; }
  .sd-avatar { width:36px; height:36px; border-radius:50%; color:#fff; display:flex; align-items:center; justify-content:center; font-size:13px; font-weight:800; flex:0 0 36px; }
  .sd-provider-name { display:flex; align-items:center; gap:4px; font-size:14px; font-weight:700; }
  .sd-member { font-size:12px; color:#5f6368; margin-top:1px; }
  .sd-meta { display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-top:10px; font-size:13px; color:#5f6368; }
  .sd-meta b { color:#202124; }
  .sd-new { background:#f1f3f4; border-radius:999px; padding:1px 8px; font-size:12px; font-weight:700; color:#5f6368; }
  .sd-meta-item { display:inline-flex; align-items:center; gap:3px; }
  .sd-sep { color:#9aa0a6; }

  .sd-stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:8px; margin-top:16px; }
  .sd-stat { background:#fff; border:1px solid #e8eaed; border-radius:12px; padding:12px 8px; text-align:center; }
  .sd-stat-val { font-size:15px; font-weight:800; line-height:1.3; word-break:break-word; }
  .sd-stat-lab { font-size:11px; color:#5f6368; margin-top:2px; }

  .sd-section { margin-top:22px; }
  .sd-h2 { font-size:15px; font-weight:800; margin:0 0 10px; }
  .sd-text { font-size:14px; line-height:1.75; color:#202124; margin:0; }
  .sd-chips { display:flex; flex-wrap:wrap; gap:6px; }
  .sd-chip { background:#e6f6ed; color:#0F9D58; border-radius:8px; padding:5px 10px; font-size:12px; font-weight:600; }
  .sd-inline-icon { display:inline-flex; align-items:center; gap:5px; font-size:14px; line-height:1.7; }

  .sd-contact { background:#fff; border:1px solid #e8eaed; border-radius:14px; padding:14px; display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  .sd-contact-num { font-size:16px; font-weight:800; }
  .sd-contact-sub { font-size:12px; color:#5f6368; margin-top:1px; }
  .sd-contact-actions { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  .sd-chip-btn { min-height:44px; border:none; border-radius:10px; background:#e6f6ed; color:#0F9D58; font-size:13px; font-weight:700; font-family:inherit; padding:0 12px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; gap:5px; }
  .sd-wa-btn { min-height:44px; border:none; border-radius:10px; background:#e7f9ee; color:#128c3e; font-size:13px; font-weight:700; font-family:inherit; padding:0 14px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
  .sd-icon-btn { width:44px; min-width:44px; height:44px; border:none; border-radius:10px; background:#e6f6ed; color:#0F9D58; display:inline-flex; align-items:center; justify-content:center; cursor:pointer; }

  .sd-tip { display:flex; gap:8px; align-items:flex-start; background:#fffbe6; border:1px solid #fde68a; border-radius:12px; padding:12px 14px; font-size:12px; line-height:1.7; color:#7a5a00; margin-top:22px; }
  .sd-tip svg { flex:0 0 auto; margin-top:2px; }

  .sd-rail { display:flex; gap:12px; overflow-x:auto; scroll-snap-type:x proximity; padding-bottom:4px; scrollbar-width:none; -ms-overflow-style:none; }
  .sd-rail::-webkit-scrollbar { display:none; }
  .sd-sim-card { flex:0 0 220px; width:220px; background:#fff; border:1px solid #e8eaed; border-radius:16px; overflow:hidden; padding:0; text-align:left; font-family:inherit; cursor:pointer; display:flex; flex-direction:column; scroll-snap-align:start; }
  .sd-sim-cover { position:relative; height:110px; background:#e6f6ed; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .sd-sim-cover img { width:100%; height:110px; object-fit:cover; display:block; }
  .sd-sim-cat { position:absolute; top:8px; left:8px; max-width:calc(100% - 16px); background:#fff; color:#0F9D58; border-radius:999px; padding:4px 8px; font-size:11px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .sd-sim-body { padding:12px; display:flex; flex-direction:column; gap:4px; flex:1; }
  .sd-sim-title { font-size:14px; font-weight:700; line-height:1.3; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .sd-sim-meta { display:flex; align-items:center; gap:4px; font-size:12px; color:#5f6368; min-width:0; white-space:nowrap; overflow:hidden; }
  .sd-sim-meta b { color:#202124; }
  .sd-sim-city { overflow:hidden; text-overflow:ellipsis; }
  .sd-sim-price { font-size:13px; font-weight:800; color:#0F9D58; margin-top:2px; min-height:18px; }
  .sd-sim-view { margin-top:auto; height:40px; border-radius:10px; background:#e6f6ed; color:#0F9D58; font-size:12px; font-weight:700; display:flex; align-items:center; justify-content:center; }
  @media (min-width:1100px) {
    .sd-sim-card { transition:transform .15s ease, box-shadow .15s ease; }
    .sd-sim-card:hover { transform:translateY(-2px); box-shadow:0 6px 16px rgba(0,0,0,.08); }
  }

  .sd-bar { position:fixed; left:0; right:0; bottom:0; z-index:1100; background:#fff; border-top:1px solid #e8eaed; padding:12px 14px calc(12px + env(safe-area-inset-bottom, 0px)); display:flex; align-items:center; justify-content:space-between; gap:12px; }
  .sd-bar-price { font-size:16px; font-weight:800; color:#202124; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .sd-bar-actions { display:flex; align-items:center; gap:8px; flex:0 0 auto; }
  .sd-bar-icon { width:44px; height:44px; border-radius:12px; border:none; background:#e6f6ed; color:#0F9D58; display:flex; align-items:center; justify-content:center; cursor:pointer; }
  .sd-bar-book { min-height:44px; border:none; border-radius:12px; background:#0F9D58; color:#fff; font-size:14px; font-weight:700; font-family:inherit; padding:0 18px; cursor:pointer; }
  .sd-bar-yours { font-size:12px; font-weight:700; color:#5f6368; }
  @media (min-width:1100px) { .sd-bar { display:none; } }

  .sd-side-card { background:#fff; border:1px solid #e8eaed; border-radius:16px; padding:18px; box-shadow:0 1px 3px rgba(0,0,0,.05); }
  .sd-side-price { font-size:26px; font-weight:800; color:#0F9D58; line-height:1.2; }
  .sd-side-yours { background:#f1f3f4; border-radius:10px; padding:10px; text-align:center; font-size:13px; font-weight:700; color:#5f6368; margin-bottom:10px; }
  .sd-side-actions { display:flex; flex-direction:column; gap:8px; margin-top:14px; }
  .sd-side-btn { min-height:46px; border:none; border-radius:12px; background:#0F9D58; color:#fff; font-size:14px; font-weight:700; font-family:inherit; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; }
  .sd-side-btn.alt { background:#e6f6ed; color:#0F9D58; }
  .sd-side-btn.wa { background:#e7f9ee; color:#128c3e; }
  .sd-side-divider { height:1px; background:#e8eaed; margin:16px 0; }
  .sd-side-rating { display:flex; align-items:center; gap:6px; font-size:13px; color:#5f6368; }
  .sd-side-rating b { color:#202124; font-size:15px; }
  .sd-side-note { font-size:12px; line-height:1.6; color:#5f6368; margin-top:10px; }

  .sd-toast { position:fixed; left:50%; bottom:96px; transform:translateX(-50%); z-index:2500; background:#202124; color:#fff; border-radius:999px; padding:10px 16px; font-size:13px; font-weight:600; box-shadow:0 8px 24px rgba(0,0,0,.2); }
  @media (min-width:1100px) { .sd-toast { bottom:24px; } }

  .sd-modal { position:fixed; inset:0; z-index:2000; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:16px; }
  .sd-modal-card { background:#fff; border-radius:18px; width:100%; max-width:340px; padding:22px; }
  .sd-modal-title { font-size:16px; font-weight:800; margin:0 0 6px; display:flex; align-items:center; gap:6px; }
  .sd-modal-sub { font-size:13px; color:#5f6368; margin:0 0 14px; line-height:1.5; }
  .sd-reason { width:100%; text-align:left; background:#f8f9fa; border:1.5px solid transparent; border-radius:10px; padding:10px 12px; margin-bottom:6px; font-size:13px; font-family:inherit; cursor:pointer; color:#202124; }
  .sd-reason.active { background:#fef0f0; border-color:#c0392b; color:#c0392b; font-weight:700; }
  .sd-modal-actions { display:flex; gap:10px; margin-top:12px; }
  .sd-modal-actions .sd-btn-outline, .sd-modal-actions .sd-btn-primary { flex:1; }
  .sd-danger { min-height:44px; border:none; border-radius:12px; background:#c0392b; color:#fff; font-size:13px; font-weight:700; font-family:inherit; cursor:pointer; padding:0 14px; }
  .sd-danger:disabled { opacity:.4; }

  .sd-lightbox { position:fixed; inset:0; z-index:2200; background:rgba(0,0,0,.95); display:flex; align-items:center; justify-content:center; }
  .sd-lightbox img, .sd-lightbox video { max-width:95vw; max-height:90vh; border-radius:12px; object-fit:contain; }
  .sd-lightbox-close { position:absolute; top:16px; right:16px; width:44px; height:44px; border:none; border-radius:50%; background:rgba(255,255,255,.15); color:#fff; display:flex; align-items:center; justify-content:center; cursor:pointer; }

  .sd-edit-overlay { position:fixed; inset:0; z-index:2100; background:rgba(0,0,0,.55); display:flex; align-items:flex-start; justify-content:center; padding:16px; overflow-y:auto; }
  .sd-edit-sheet { background:#fff; border-radius:18px; width:100%; max-width:640px; max-height:92vh; overflow-y:auto; }

  .sd-skel { background:#e8eaed; border-radius:8px; animation: sd-pulse 1.4s ease-in-out infinite; }
  @keyframes sd-pulse { 0%,100%{opacity:.75} 50%{opacity:.45} }
  .sd-skel-gallery { width:100%; aspect-ratio:4/3; border-radius:16px; background:#e6f6ed; }
  .sd-notfound { max-width:420px; margin:12vh auto 0; background:#fff; border:1px solid #e8eaed; border-radius:18px; padding:32px 24px; text-align:center; }
  .sd-nf-icon { width:64px; height:64px; border-radius:50%; background:#e6f6ed; color:#0F9D58; display:flex; align-items:center; justify-content:center; margin:0 auto 14px; }
  .sd-nf-title { font-size:20px; font-weight:800; margin:0 0 6px; }
  .sd-nf-sub { font-size:14px; color:#5f6368; margin:0 0 20px; line-height:1.6; }
  .sd-btn-primary { min-height:44px; border:none; border-radius:12px; background:#0F9D58; color:#fff; font-size:14px; font-weight:700; font-family:inherit; cursor:pointer; padding:0 18px; display:inline-flex; align-items:center; justify-content:center; gap:6px; }
  .sd-btn-outline { min-height:44px; border:1px solid #e8eaed; border-radius:12px; background:#fff; color:#202124; font-size:14px; font-weight:700; font-family:inherit; cursor:pointer; padding:0 18px; display:inline-flex; align-items:center; justify-content:center; gap:6px; }

  .sd-rev-summary { display:flex; gap:16px; background:#fff; border:1px solid #e8eaed; border-radius:14px; padding:14px; align-items:center; flex-wrap:wrap; }
  .sd-rev-left { flex:0 0 110px; text-align:center; }
  .sd-rev-avg { font-size:32px; font-weight:800; line-height:1.1; }
  .sd-rev-total { font-size:12px; color:#5f6368; margin-top:4px; }
  .sd-rev-bars { flex:1 1 180px; min-width:160px; display:flex; flex-direction:column; gap:4px; }
  .sd-rev-bar-row { display:flex; align-items:center; gap:8px; font-size:11px; color:#5f6368; }
  .sd-rev-bar-lab { width:10px; text-align:right; }
  .sd-rev-bar { flex:1; height:8px; background:#f1f3f4; border-radius:999px; overflow:hidden; }
  .sd-rev-bar-fill { display:block; height:100%; background:#F9AB00; border-radius:999px; }
  .sd-rev-bar-count { width:22px; text-align:right; }
  .sd-rev-note { font-size:12px; color:#5f6368; line-height:1.6; margin:10px 0 0; }
  .sd-rev-cta { display:flex; align-items:center; justify-content:space-between; gap:10px; flex-wrap:wrap; background:#fff; border:1px solid #e8eaed; border-radius:14px; padding:12px 14px; margin-top:12px; font-size:13px; color:#202124; }
  .sd-rev-cta > span { display:inline-flex; align-items:center; gap:6px; flex-wrap:wrap; }
  .sd-rev-form { background:#fff; border:1px solid #e8eaed; border-radius:14px; padding:14px; margin-top:12px; }
  .sd-rev-form-title { font-size:13px; font-weight:700; margin-bottom:6px; }
  .sd-stars-input { display:flex; gap:4px; margin-bottom:8px; }
  .sd-star-btn { width:44px; height:44px; border:none; background:none; padding:0; display:flex; align-items:center; justify-content:center; cursor:pointer; }
  .sd-rev-textarea { width:100%; min-height:96px; border:1px solid #e8eaed; border-radius:12px; padding:10px 12px; font-family:inherit; font-size:13px; line-height:1.6; resize:vertical; box-sizing:border-box; color:#202124; }
  .sd-rev-textarea:focus { outline:2px solid #0F9D58; outline-offset:1px; }
  .sd-rev-form-foot { display:flex; align-items:center; justify-content:space-between; gap:10px; margin-top:8px; }
  .sd-rev-counter { font-size:11px; color:#5f6368; }
  .sd-rev-error { font-size:12px; color:#c0392b; margin-top:8px; }
  .sd-rev-list { display:flex; flex-direction:column; gap:10px; margin-top:14px; }
  .sd-rev-card { background:#fff; border:1px solid #e8eaed; border-radius:14px; padding:14px; }
  .sd-rev-head { display:flex; align-items:center; gap:10px; }
  .sd-rev-who { min-width:0; flex:1; }
  .sd-rev-name { font-size:13px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .sd-rev-sub { display:flex; align-items:center; gap:5px; font-size:11px; color:#5f6368; margin-top:2px; }
  .sd-rev-del { border:none; background:none; color:#c0392b; font-size:12px; font-weight:700; font-family:inherit; cursor:pointer; padding:6px 8px; min-height:32px; }
  .sd-rev-link { border:none; background:none; color:#0F9D58; font-size:12px; font-weight:700; font-family:inherit; cursor:pointer; padding:4px 0; }
  .sd-rev-comment { font-size:13px; line-height:1.65; margin:8px 0 0; white-space:pre-wrap; overflow-wrap:anywhere; }
  .sd-rev-comment.clamp { display:-webkit-box; -webkit-line-clamp:4; -webkit-box-orient:vertical; overflow:hidden; }
  .sd-rev-more { min-height:44px; border:1px solid #e8eaed; border-radius:12px; background:#fff; color:#202124; font-size:13px; font-weight:700; font-family:inherit; cursor:pointer; }
`

function ratingOf(svc) {
  const count = Number(svc?.rating_count ?? svc?.review_count ?? 0) || 0
  const avg = svc?.rating_avg != null ? Number(svc.rating_avg) : (svc?.rating != null ? Number(svc.rating) : NaN)
  if (count > 0 && Number.isFinite(avg)) return { avg, count }
  if (Number.isFinite(avg) && avg > 0) return { avg, count: count || 0 }
  return null
}

function formatRate(rate) {
  if (!rate && rate !== 0) return ''
  const s = String(rate).trim()
  if (!s) return ''
  const slashIdx = s.indexOf('/')
  const amountPart = slashIdx >= 0 ? s.slice(0, slashIdx).trim() : s
  let unit = slashIdx >= 0 ? '/' + s.slice(slashIdx + 1).trim() : ''
  if (/^\/hour$/i.test(unit)) unit = '/hr'
  const cleaned = amountPart.replace(/mwk|mk/gi, '').trim()
  const numMatch = cleaned.match(/[\d,]+/)
  let amount
  if (numMatch) {
    const digits = numMatch[0].replace(/,/g, '')
    amount = /^\d+$/.test(digits) ? 'MK ' + Number(digits).toLocaleString('en-US') : 'MK ' + cleaned
  } else if (cleaned) {
    amount = 'MK ' + cleaned
  } else {
    return ''
  }
  return amount + unit
}

function formatExperience(value) {
  if (value == null || value === '') return '—'
  const s = String(value).trim()
  if (/^\d+(\.\d+)?$/.test(s)) return `${s} yrs`
  return s
}

function monthYear(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function maskContact(contact) {
  const s = String(contact || '').replace(/\s+/g, '')
  if (!s) return ''
  return `${s.slice(0, 4)} *** ***`
}

function titleName(name) {
  const s = String(name || '').trim()
  if (!s) return 'Customer'
  return s.split(/\s+/).map(w => (w ? w[0].toUpperCase() + w.slice(1) : '')).join(' ')
}

function reviewDate(value) {
  if (!value) return ''
  const then = new Date(value)
  if (Number.isNaN(then.getTime())) return ''
  const mins = Math.floor((Date.now() - then.getTime()) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} minute${mins === 1 ? '' : 's'} ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs} hour${hrs === 1 ? '' : 's'} ago`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`
  if (days < 30) {
    const weeks = Math.floor(days / 7)
    return `${weeks} week${weeks === 1 ? '' : 's'} ago`
  }
  if (days < 365) {
    const months = Math.floor(days / 30)
    return `${months} month${months === 1 ? '' : 's'} ago`
  }
  const years = Math.floor(days / 365)
  return `${years} year${years === 1 ? '' : 's'} ago`
}

function Stars({ value, size = 16 }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }} aria-hidden="true">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} size={size} color="#F9AB00" fill={n <= Math.round(value || 0) ? '#F9AB00' : 'none'} strokeWidth={1.5} />
      ))}
    </span>
  )
}

function Section({ title, children }) {
  return (
    <section className="sd-section">
      <h2 className="sd-h2">{title}</h2>
      {children}
    </section>
  )
}

function SimilarCard({ svc, onOpen }) {
  const image = Array.isArray(svc.media_urls) && svc.media_urls.length ? svc.media_urls[0] : null
  const rating = ratingOf(svc)
  return (
    <button type="button" className="sd-sim-card" onClick={onOpen}>
      <div className="sd-sim-cover">
        {image ? <img src={image} alt="" loading="lazy" /> : <Wrench size={26} color="#0F9D58" strokeWidth={1.8} />}
        {svc.category && <span className="sd-sim-cat">{svc.category}</span>}
      </div>
      <div className="sd-sim-body">
        <div className="sd-sim-title">{svc.name || svc.title || 'Service'}</div>
        <div className="sd-sim-meta">
          {rating ? (
            <>
              <Star size={12} color="#F9AB00" fill="#F9AB00" />
              <b>{rating.avg.toFixed(1)}</b>
              <span>({rating.count})</span>
            </>
          ) : (
            <span className="sd-new">New</span>
          )}
          <span className="sd-sep">·</span>
          <span className="sd-sim-city">{svc.city || 'Malawi'}</span>
        </div>
        <div className="sd-sim-price">{formatRate(svc.rate) || 'Contact for price'}</div>
        <div className="sd-sim-view">View service</div>
      </div>
    </button>
  )
}

function DetailsSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="sd-skel sd-skel-gallery" />
      <div className="sd-skel" style={{ width: '62%', height: 24, marginTop: 18 }} />
      <div className="sd-skel" style={{ width: '26%', height: 18, marginTop: 10 }} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16 }}>
        <div className="sd-skel" style={{ width: 36, height: 36, borderRadius: 18 }} />
        <div style={{ flex: 1 }}>
          <div className="sd-skel" style={{ width: '42%', height: 14 }} />
          <div className="sd-skel" style={{ width: '28%', height: 12, marginTop: 6 }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 18 }}>
        {[0, 1, 2].map(n => <div key={n} className="sd-skel" style={{ height: 64, borderRadius: 12 }} />)}
      </div>
      <div className="sd-skel" style={{ width: '35%', height: 16, marginTop: 24 }} />
      <div className="sd-skel" style={{ width: '100%', height: 12, marginTop: 10 }} />
      <div className="sd-skel" style={{ width: '92%', height: 12, marginTop: 6 }} />
      <div className="sd-skel" style={{ width: '80%', height: 12, marginTop: 6 }} />
    </div>
  )
}

export default function ServiceDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const galleryRef = useRef(null)
  const [currentUser, setCurrentUser] = useState(null)
  const [service, setService] = useState(null)
  const [profile, setProfile] = useState(null)
  const [shopName, setShopName] = useState('')
  const [reviews, setReviews] = useState([])
  const [similar, setSimilar] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [activeMedia, setActiveMedia] = useState(0)
  const [lightboxMedia, setLightboxMedia] = useState(null)
  const [showContact, setShowContact] = useState(false)
  const [showReport, setShowReport] = useState(false)
  const [reportReason, setReportReason] = useState('')
  const [reportSent, setReportSent] = useState(false)
  const [toast, setToast] = useState('')
  const [showEdit, setShowEdit] = useState(false)
  const [messaged, setMessaged] = useState(false)
  const [myRating, setMyRating] = useState(0)
  const [reviewText, setReviewText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [deletingReviewId, setDeletingReviewId] = useState(null)
  const [reviewError, setReviewError] = useState('')
  const [showAllReviews, setShowAllReviews] = useState(false)
  const [expandedReviews, setExpandedReviews] = useState([])

  const media = Array.isArray(service?.media_urls) ? service.media_urls : []
  const isOwner = !!currentUser && !!service && currentUser.id === service.provider_id
  const providerName = shopName || profile?.full_name || ''
  const verified = isServiceVerified(service, profile)
  const serviceRating = ratingOf(service)
  const reviewAvg = reviews.length
    ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length
    : 0
  const displayAvg = serviceRating ? serviceRating.avg : reviewAvg
  const ratingCount = serviceRating ? serviceRating.count : 0
  const totalReviews = Math.max(ratingCount, reviews.length)
  const rateText = formatRate(service?.rate)
  const completed = Number(service?.completed_count ?? service?.jobs_done ?? 0) || 0
  const views = Number(service?.views) || 0
  const catInfo = SERVICE_CATS.find(c => c.name === service?.category)
  const myReview = currentUser ? reviews.find(r => r.reviewer_id === currentUser.id) : null
  const starCounts = [5, 4, 3, 2, 1].map(n => reviews.filter(r => Number(r.rating) === n).length)
  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 3)

  useEffect(() => {
    let active = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset page state when the service id changes
    setLoading(true)
    setNotFound(false)
    setService(null)
    setProfile(null)
    setShopName('')
    setReviews([])
    setSimilar([])
    setActiveMedia(0)
    setLightboxMedia(null)
    setShowContact(false)
    setShowReport(false)
    setReportReason('')
    setReportSent(false)
    setShowEdit(false)
    setMessaged(false)
    setMyRating(0)
    setReviewText('')
    setSubmitting(false)
    setDeletingReviewId(null)
    setReviewError('')
    setShowAllReviews(false)
    setExpandedReviews([])
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      setCurrentUser(user || null)

      const { data: svc, error } = await supabase
        .from('services')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (!active) return
      if (error || !svc || (svc.status && svc.status !== 'active')) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setService(svc)

      const profilePromise = (async () => {
        if (!svc.provider_id) return null
        let res = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, is_verified, created_at')
          .eq('id', svc.provider_id)
          .maybeSingle()
        if (res.error) {
          res = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('id', svc.provider_id)
            .maybeSingle()
        }
        return res.data || null
      })()

      const shopPromise = svc.provider_id
        ? supabase.from('shops').select('name').eq('owner_id', svc.provider_id).maybeSingle()
        : Promise.resolve({ data: null })

      const reviewsPromise = supabase
        .from('reviews')
        .select('*')
        .eq('service_id', id)
        .order('created_at', { ascending: false })
        .limit(50)

      const similarPromise = svc.category
        ? supabase
          .from('services')
          .select('*')
          .eq('category', svc.category)
          .eq('status', 'active')
          .neq('id', id)
          .order('created_at', { ascending: false })
          .limit(8)
        : Promise.resolve({ data: [] })

      const eligibilityPromise = user && user.id !== svc.provider_id
        ? supabase
          .from('messages')
          .select('id')
          .eq('service_id', svc.id)
          .eq('from_user', user.id)
          .eq('to_user', svc.provider_id)
          .limit(1)
        : Promise.resolve({ data: [] })

      const [prof, shop, rev, sim, elig] = await Promise.all([
        profilePromise,
        shopPromise,
        reviewsPromise,
        similarPromise,
        eligibilityPromise,
      ])
      if (!active) return
      setProfile(prof)
      setShopName(shop?.data?.name || '')
      setReviews(rev?.data || [])
      setSimilar(sim?.data || [])
      setMessaged(!!(elig?.data && elig.data.length))
      setLoading(false)

      if (user && user.id !== svc.provider_id) {
        const key = `svc_viewed_${svc.id}`
        try {
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1')
            supabase
              .rpc('increment_service_stat', { p_service_id: svc.id, p_stat: 'views' })
              .then(() => {})
              .catch(() => {})
          }
        } catch { /* ignore */ }
      }
    })()
    return () => { active = false }
  }, [id])

  useEffect(() => {
    if (!service?.name) return
    const prev = document.title
    document.title = `${service.name} - SokoMW`
    return () => { document.title = prev }
  }, [service?.name])

  useEffect(() => {
    if (!toast) return
    const t = setTimeout(() => setToast(''), 2000)
    return () => clearTimeout(t)
  }, [toast])

  function goBack() {
    const idx = window.history.state?.idx
    if (typeof idx === 'number' && idx > 0) navigate(-1)
    else navigate('/services')
  }

  function goChat() {
    if (!currentUser) {
      navigate('/login')
      return
    }
    if (!isOwner) {
      const key = `svc_chatted_${service.id}`
      try {
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, '1')
          supabase
            .rpc('increment_service_stat', { p_service_id: service.id, p_stat: 'chats_count' })
            .then(() => {})
            .catch(() => {})
        }
      } catch { /* ignore */ }
    }
    navigate(`/chat/${service.provider_id}/${service.id}?src=service`, {
      state: { source: 'service' },
    })
  }

  function doCall() {
    if (service?.contact) window.location.href = `tel:${service.contact}`
  }

  function doWhatsApp() {
    if (service?.contact) {
      window.open(formatWhatsApp(service.contact, service.name, service.category), '_blank')
    }
  }

  async function shareService() {
    const url = window.location.href
    const text = `Check out ${service?.name || 'this service'} on Soko Malawi`
    if (navigator.share) {
      try { await navigator.share({ title: service?.name || 'SokoMW service', text, url }) } catch { /* cancelled */ }
      return
    }
    try {
      await navigator.clipboard.writeText(url)
      setToast('Link copied')
    } catch {
      setToast('Could not copy link')
    }
  }

  async function submitReport() {
    if (!reportReason) return
    await supabase.from('reports').insert({
      service_id: service.id,
      reporter_id: currentUser?.id || null,
      reason: reportReason,
    })
    setReportSent(true)
  }

  async function refreshService() {
    const { data } = await supabase.from('services').select('*').eq('id', id).maybeSingle()
    if (data) setService(data)
  }

  async function loadReviews() {
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('service_id', id)
      .order('created_at', { ascending: false })
      .limit(50)
    setReviews(data || [])
  }

  async function submitReview() {
    if (!currentUser || !service) return
    if (!myRating) {
      setReviewError('Please select a star rating')
      return
    }
    setSubmitting(true)
    setReviewError('')
    const { error } = await supabase.from('reviews').insert({
      service_id: service.id,
      provider_id: service.provider_id,
      reviewer_id: currentUser.id,
      reviewer_name: currentUser.user_metadata?.full_name || profile?.full_name || currentUser.email?.split('@')[0] || 'Customer',
      rating: myRating,
      comment: reviewText.trim(),
    })
    setSubmitting(false)
    if (error) {
      setReviewError(error.code === '23505' ? 'You already reviewed this service.' : (error.message || 'Could not submit your review.'))
      return
    }
    setMyRating(0)
    setReviewText('')
    setToast('Review added')
    await Promise.all([loadReviews(), refreshService()])
  }

  async function deleteReview(review) {
    if (!currentUser || review.reviewer_id !== currentUser.id) return
    setDeletingReviewId(review.id)
    const { error } = await supabase
      .from('reviews')
      .delete()
      .eq('id', review.id)
      .eq('reviewer_id', currentUser.id)
    setDeletingReviewId(null)
    if (error) {
      setToast('Could not delete review')
      return
    }
    setToast('Review deleted')
    setExpandedReviews(prev => prev.filter(rid => rid !== review.id))
    await Promise.all([loadReviews(), refreshService()])
  }

  function toggleExpanded(reviewId) {
    setExpandedReviews(prev => (
      prev.includes(reviewId) ? prev.filter(rid => rid !== reviewId) : [...prev, reviewId]
    ))
  }

  function goToMedia(index) {
    const el = galleryRef.current
    if (!el) return
    el.scrollTo({ left: index * el.clientWidth, behavior: 'smooth' })
    setActiveMedia(index)
  }

  function onGalleryScroll(e) {
    const el = e.currentTarget
    if (!el.clientWidth || !media.length) return
    const index = Math.round(el.scrollLeft / el.clientWidth)
    setActiveMedia(Math.max(0, Math.min(media.length - 1, index)))
  }

  function toggleReport() {
    setReportSent(false)
    setReportReason('')
    setShowReport(true)
  }

  if (loading) {
    return (
      <div className="sd-page">
        <style>{CSS}</style>
        <div className="sd-wrap"><DetailsSkeleton /></div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="sd-page">
        <style>{CSS}</style>
        <div className="sd-wrap">
          <div className="sd-notfound">
            <div className="sd-nf-icon"><Wrench size={28} strokeWidth={1.8} /></div>
            <h1 className="sd-nf-title">Service not found</h1>
            <p className="sd-nf-sub">This service may have been removed or is no longer available.</p>
            <button type="button" className="sd-btn-primary" onClick={() => navigate('/services')}>Browse services</button>
            <div style={{ marginTop: 10 }}>
              <button type="button" className="sd-btn-outline" onClick={goBack}>Go back</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const heroTools = (
    <div className="sd-overlay-tools">
      <button type="button" className="sd-overlay-btn" onClick={shareService} aria-label="Share service"><Share2 size={18} /></button>
      {!isOwner && (
        <button type="button" className="sd-overlay-btn" onClick={toggleReport} aria-label="Report service"><Flag size={18} /></button>
      )}
    </div>
  )

  const gallery = (
    <>
      <div className="sd-gallery">
        <div className="sd-track" ref={galleryRef} onScroll={onGalleryScroll}>
          {media.length === 0 ? (
            <div className="sd-slide" style={{ cursor: 'default' }}>
              <div className="sd-slide-empty">
                {catInfo ? <catInfo.icon size={48} strokeWidth={1.6} /> : <Wrench size={48} strokeWidth={1.6} />}
              </div>
            </div>
          ) : media.map((url, index) => {
            const isVideo = /\.(mp4|mov|webm)$/i.test(url)
            return (
              <div
                key={`${url}-${index}`}
                className="sd-slide"
                onClick={() => setLightboxMedia(url)}
                role="button"
                tabIndex={0}
                onKeyDown={e => { if (e.key === 'Enter') setLightboxMedia(url) }}
                aria-label={`Open media ${index + 1}`}
              >
                {isVideo ? (
                  <>
                    <video src={url} muted playsInline preload="metadata" />
                    <div className="sd-slide-play"><PlayCircle size={44} color="#fff" fill="rgba(0,0,0,.35)" /></div>
                  </>
                ) : (
                  <img src={url} alt="" loading={index === 0 ? 'eager' : 'lazy'} />
                )}
              </div>
            )
          })}
        </div>
        <button type="button" className="sd-overlay-btn sd-overlay-left" onClick={goBack} aria-label="Go back"><ArrowLeft size={18} /></button>
        {heroTools}
      </div>
      {media.length > 1 && (
        <div className="sd-dots">
          {media.map((_, index) => (
            <button
              key={index}
              type="button"
              className={`sd-dot${activeMedia === index ? ' active' : ''}`}
              onClick={() => goToMedia(index)}
              aria-label={`Show media ${index + 1}`}
            />
          ))}
        </div>
      )}
    </>
  )

  const headerBlock = (
    <div>
      <h1 className="sd-title">{service?.name || service?.title || 'Service'}</h1>
      {service?.category && (
        <span className="sd-pill">
          {catInfo ? <catInfo.icon size={13} strokeWidth={2} /> : <Wrench size={13} strokeWidth={2} />}
          {service.category}
        </span>
      )}
      <div className="sd-provider">
        <div className="sd-avatar" style={{ background: avatarColor(providerName || service?.name) }}>
          {initials(providerName || service?.name || 'S')}
        </div>
        <div>
          <div className="sd-provider-name">
            {providerName || 'Service provider'}
            {verified && <BadgeCheck size={16} color="#1A73E8" aria-label="Verified provider" />}
          </div>
          {profile?.created_at && (
            <div className="sd-member">Member since {monthYear(profile.created_at)}</div>
          )}
        </div>
      </div>
      <div className="sd-meta">
        {totalReviews > 0 ? (
          <>
            <Star size={14} color="#F9AB00" fill="#F9AB00" />
            <b>{displayAvg.toFixed(1)}</b>
            <span>({totalReviews})</span>
          </>
        ) : (
          <span className="sd-new">New</span>
        )}
        {service?.city && (
          <>
            <span className="sd-sep">·</span>
            <span className="sd-meta-item"><MapPin size={12} /> {service.city}</span>
          </>
        )}
        <span className="sd-sep">·</span>
        <span className="sd-meta-item"><Eye size={12} /> {views} view{views === 1 ? '' : 's'}</span>
      </div>
      <div className="sd-stats">
        <div className="sd-stat">
          <div className="sd-stat-val">{formatExperience(service?.experience)}</div>
          <div className="sd-stat-lab">Experience</div>
        </div>
        <div className="sd-stat">
          <div className="sd-stat-val">{rateText || '—'}</div>
          <div className="sd-stat-lab">Rate</div>
        </div>
        <div className="sd-stat">
          <div className="sd-stat-val">{completed}</div>
          <div className="sd-stat-lab">Completed</div>
        </div>
      </div>
    </div>
  )

  const skills = Array.isArray(service?.skills) ? service.skills : []

  const infoSections = (
    <>
      {service?.description && (
        <Section title="About">
          <p className="sd-text">{service.description}</p>
        </Section>
      )}
      {skills.length > 0 && (
        <Section title="Skills">
          <div className="sd-chips">
            {skills.map(skill => <span key={skill} className="sd-chip">{skill}</span>)}
          </div>
        </Section>
      )}
      {service?.coverage && (
        <Section title="Coverage area">
          <p className="sd-inline-icon"><MapPin size={15} /> {service.coverage}</p>
        </Section>
      )}
      {service?.contact && (
        <Section title="Contact">
          <div className="sd-contact">
            <div>
              <div className="sd-contact-num">{showContact ? service.contact : maskContact(service.contact)}</div>
              <div className="sd-contact-sub">Call or WhatsApp</div>
            </div>
            <div className="sd-contact-actions">
              {!showContact && (
                <button type="button" className="sd-chip-btn" onClick={() => setShowContact(true)}>Show contact</button>
              )}
              <button type="button" className="sd-icon-btn" onClick={doCall} aria-label="Call provider"><Phone size={18} /></button>
              <button type="button" className="sd-wa-btn" onClick={doWhatsApp}>WhatsApp</button>
            </div>
          </div>
        </Section>
      )}
      <div className="sd-tip">
        <Lightbulb size={16} />
        <span>
          <strong>How to connect:</strong> Message or call {providerName || 'the provider'} directly to discuss your needs, agree on a price, and arrange the work.
        </span>
      </div>
    </>
  )

  const reviewsSection = (
    <Section title="Reviews">
      <div className="sd-rev-summary">
        <div className="sd-rev-left">
          <div className="sd-rev-avg">{totalReviews > 0 ? displayAvg.toFixed(1) : '—'}</div>
          <Stars value={displayAvg} size={15} />
          <div className="sd-rev-total">{totalReviews} review{totalReviews === 1 ? '' : 's'}</div>
        </div>
        <div className="sd-rev-bars">
          {starCounts.map((count, index) => {
            const star = 5 - index
            const pct = reviews.length ? Math.round((count / reviews.length) * 100) : 0
            return (
              <div key={star} className="sd-rev-bar-row">
                <span className="sd-rev-bar-lab">{star}</span>
                <span className="sd-rev-bar"><span className="sd-rev-bar-fill" style={{ width: `${pct}%` }} /></span>
                <span className="sd-rev-bar-count">{count}</span>
              </div>
            )
          })}
        </div>
      </div>
      {totalReviews > 50 && <p className="sd-rev-note">Based on the latest 50 reviews</p>}

      {isOwner ? (
        <p className="sd-rev-note">Customers can leave a review after messaging you about this service.</p>
      ) : !currentUser ? (
        <div className="sd-rev-cta">
          <span>Log in to write a review</span>
          <button type="button" className="sd-btn-primary" onClick={() => navigate('/login')}>Log in</button>
        </div>
      ) : myReview ? (
        <div className="sd-rev-cta">
          <span>You reviewed this service <Stars value={Number(myReview.rating) || 0} size={13} /></span>
          <button
            type="button"
            className="sd-rev-link"
            onClick={() => deleteReview(myReview)}
            disabled={deletingReviewId === myReview.id}
          >
            {deletingReviewId === myReview.id ? 'Removing…' : 'Delete my review'}
          </button>
        </div>
      ) : !messaged ? (
        <div className="sd-rev-cta">
          <span>Chat with this provider to leave a review</span>
          <button type="button" className="sd-btn-outline" onClick={goChat}>Chat</button>
        </div>
      ) : (
        <div className="sd-rev-form">
          <div className="sd-rev-form-title">Rate this service</div>
          <div className="sd-stars-input">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                type="button"
                className="sd-star-btn"
                onClick={() => { setMyRating(n); setReviewError('') }}
                aria-label={`${n} star${n === 1 ? '' : 's'}`}
                aria-pressed={n <= myRating}
              >
                <Star size={30} color={n <= myRating ? '#F9AB00' : '#c7cdd2'} fill={n <= myRating ? '#F9AB00' : 'none'} strokeWidth={1.5} />
              </button>
            ))}
          </div>
          <textarea
            className="sd-rev-textarea"
            value={reviewText}
            maxLength={1000}
            placeholder="Share your experience with this service"
            onChange={e => setReviewText(e.target.value)}
          />
          <div className="sd-rev-form-foot">
            <span className="sd-rev-counter">{reviewText.length}/1000</span>
            <button type="button" className="sd-btn-primary" onClick={submitReview} disabled={submitting || !myRating}>
              {submitting ? 'Posting…' : 'Post review'}
            </button>
          </div>
          {reviewError && <div className="sd-rev-error">{reviewError}</div>}
        </div>
      )}

      {reviews.length === 0 ? (
        <p className="sd-text" style={{ color: '#5f6368', marginTop: 14 }}>No reviews yet.</p>
      ) : (
        <div className="sd-rev-list">
          {visibleReviews.map(review => {
            const name = titleName(review.reviewer_name)
            const expanded = expandedReviews.includes(review.id)
            const isLong = String(review.comment || '').length > 220
            const mine = !!currentUser && review.reviewer_id === currentUser.id
            return (
              <div key={review.id} className="sd-rev-card">
                <div className="sd-rev-head">
                  <div className="sd-avatar" style={{ background: avatarColor(name) }}>{initials(name)}</div>
                  <div className="sd-rev-who">
                    <div className="sd-rev-name">{name}</div>
                    <div className="sd-rev-sub">
                      <Stars value={Number(review.rating) || 0} size={12} />
                      <span>·</span>
                      <span>{reviewDate(review.created_at)}</span>
                    </div>
                  </div>
                  {mine && (
                    <button
                      type="button"
                      className="sd-rev-del"
                      onClick={() => deleteReview(review)}
                      disabled={deletingReviewId === review.id}
                    >
                      {deletingReviewId === review.id ? '…' : 'Delete'}
                    </button>
                  )}
                </div>
                {review.comment && (
                  <>
                    <p className={`sd-rev-comment${!expanded && isLong ? ' clamp' : ''}`}>{review.comment}</p>
                    {isLong && (
                      <button type="button" className="sd-rev-link" onClick={() => toggleExpanded(review.id)}>
                        {expanded ? 'Show less' : 'Read more'}
                      </button>
                    )}
                  </>
                )}
              </div>
            )
          })}
          {reviews.length > 3 && (
            <button type="button" className="sd-rev-more" onClick={() => setShowAllReviews(value => !value)}>
              {showAllReviews ? 'Show fewer reviews' : `See all ${reviews.length} reviews`}
            </button>
          )}
        </div>
      )}
    </Section>
  )

  const similarSection = similar.length > 0 && (
    <Section title="Similar services">
      <div className="sd-rail">
        {similar.map(svc => (
          <SimilarCard key={svc.id} svc={svc} onOpen={() => navigate(`/services/${svc.id}`)} />
        ))}
      </div>
    </Section>
  )

  const sideCard = (
    <div className="sd-side-card">
      <div className="sd-side-price">{rateText || 'Contact for price'}</div>
      {isOwner ? (
        <>
          <div className="sd-side-yours" style={{ marginTop: 12 }}>This is your service</div>
          <div className="sd-side-actions">
            <button type="button" className="sd-side-btn alt" onClick={() => setShowEdit(true)}><Pencil size={16} /> Edit</button>
            <button type="button" className="sd-side-btn alt" onClick={shareService}><Share2 size={16} /> Share</button>
          </div>
        </>
      ) : (
        <div className="sd-side-actions">
          <button type="button" className="sd-side-btn" onClick={goChat}>Book now</button>
          <button type="button" className="sd-side-btn alt" onClick={goChat}><MessageCircle size={16} /> Chat</button>
          {service?.contact && <button type="button" className="sd-side-btn alt" onClick={doCall}><Phone size={16} /> Call</button>}
          {service?.contact && <button type="button" className="sd-side-btn wa" onClick={doWhatsApp}>WhatsApp</button>}
        </div>
      )}
      <div className="sd-side-divider" />
      <div className="sd-side-rating">
        {totalReviews > 0 ? (
          <>
            <Stars value={displayAvg} size={14} />
            <b>{displayAvg.toFixed(1)}</b>
            <span>({totalReviews})</span>
          </>
        ) : (
          <span className="sd-new">New</span>
        )}
      </div>
      <div className="sd-side-note">
        {isOwner
          ? 'Customers see this page when they open your service.'
          : 'Chat with the provider to confirm availability and agree on a price.'}
      </div>
    </div>
  )

  const bottomBar = (
    <div className="sd-bar">
      <div className="sd-bar-price">{rateText || 'Contact for price'}</div>
      <div className="sd-bar-actions">
        {isOwner ? (
          <>
            <span className="sd-bar-yours">This is your service</span>
            <button type="button" className="sd-bar-icon" onClick={() => setShowEdit(true)} aria-label="Edit service"><Pencil size={19} /></button>
            <button type="button" className="sd-bar-icon" onClick={shareService} aria-label="Share service"><Share2 size={19} /></button>
          </>
        ) : (
          <>
            <button type="button" className="sd-bar-icon" onClick={goChat} aria-label="Chat with provider"><MessageCircle size={20} /></button>
            <button type="button" className="sd-bar-book" onClick={goChat}>Book now</button>
          </>
        )}
      </div>
    </div>
  )

  return (
    <div className="sd-page">
      <style>{CSS}</style>
      <div className="sd-wrap">
        <div className="sd-cols">
          <main className="sd-main">
            {gallery}
            {headerBlock}
            {infoSections}
            {reviewsSection}
            {similarSection}
          </main>
          <aside className="sd-side">{sideCard}</aside>
        </div>
      </div>
      {bottomBar}

      {lightboxMedia && (
        <div className="sd-lightbox" onClick={() => setLightboxMedia(null)}>
          <button type="button" className="sd-lightbox-close" onClick={() => setLightboxMedia(null)} aria-label="Close media"><X size={20} /></button>
          {/\.(mp4|mov|webm)$/i.test(lightboxMedia) ? (
            <video src={lightboxMedia} controls autoPlay onClick={e => e.stopPropagation()} />
          ) : (
            <img src={lightboxMedia} alt="" onClick={e => e.stopPropagation()} />
          )}
        </div>
      )}

      {showReport && (
        <div className="sd-modal" onClick={() => setShowReport(false)}>
          <div className="sd-modal-card" onClick={e => e.stopPropagation()}>
            {reportSent ? (
              <div style={{ textAlign: 'center' }}>
                <CheckCircle2 size={40} color="#0F9D58" strokeWidth={1.8} />
                <div className="sd-modal-title" style={{ justifyContent: 'center', marginTop: 10 }}>Report submitted</div>
                <p className="sd-modal-sub">We will review this listing.</p>
                <button type="button" className="sd-btn-primary" onClick={() => setShowReport(false)}>Done</button>
              </div>
            ) : (
              <>
                <div className="sd-modal-title"><Flag size={16} color="#c0392b" /> Report listing</div>
                <p className="sd-modal-sub">Why are you reporting this?</p>
                {['Fake or scam', 'Inappropriate content', 'Wrong category', 'Duplicate listing', 'Other'].map(reason => (
                  <button
                    key={reason}
                    type="button"
                    className={`sd-reason${reportReason === reason ? ' active' : ''}`}
                    onClick={() => setReportReason(reason)}
                  >
                    {reason}
                  </button>
                ))}
                <div className="sd-modal-actions">
                  <button type="button" className="sd-btn-outline" onClick={() => setShowReport(false)}>Cancel</button>
                  <button type="button" className="sd-danger" disabled={!reportReason} onClick={submitReport}>Submit</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {showEdit && (
        <div className="sd-edit-overlay" onClick={() => setShowEdit(false)}>
          <div className="sd-edit-sheet" onClick={e => e.stopPropagation()}>
            <ServiceForm
              editingService={service}
              onSuccess={() => { setShowEdit(false); refreshService() }}
              onCancel={() => setShowEdit(false)}
            />
          </div>
        </div>
      )}

      {toast && <div className="sd-toast">{toast}</div>}
    </div>
  )
}
