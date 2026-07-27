import React, { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { T } from '../constants/tokens'

const sw = 1.75
const Icon = {
  bell:     (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M6.5 8.5a5.5 5.5 0 0 1 11 0c0 6 2.5 7.5 2.5 7.5H4s2.5-1.5 2.5-7.5"/><path d="M10 19a2 2 0 0 0 4 0"/></svg>,
  bellOff:  (s=18) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8.7 3A6 6 0 0 1 18 8c0 2.8.7 4.8 1.4 6.2M6.3 6.3C6.1 6.8 6 7.4 6 8c0 7-3 9-3 9h13.5"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/><path d="m2 2 20 20"/></svg>,
  x:        (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M18 6 6 18M6 6l12 12"/></svg>,
  sparkles: (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m12 3 1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"/><path d="M5 3v4M19 17v4M3 5h4M17 19h4"/></svg>,
  list:     (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>,
  tag:      (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2H2v10l9.3 9.3a1 1 0 0 0 1.4 0l7.6-7.6a1 1 0 0 0 0-1.4L12 2z"/><circle cx="7" cy="7" r="1.2" fill="currentColor" stroke="none"/></svg>,
  plus:     (s=16) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14"/></svg>,
  sliders:  (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4"/></svg>,
  chevDown: (s=12) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6"/></svg>,
  mail:     (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>,
  check:    (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 6 9 17l-5-5"/></svg>,
  eye:      (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>,
  layers:   (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m12 2 10 5.5-10 5.5L2 7.5 12 2z"/><path d="m2 12.5 10 5.5 10-5.5"/><path d="m2 17.5 10 5.5 10-5.5"/></svg>,
  pin:      (s=13) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="2.5"/></svg>,
  cash:     (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/></svg>,
  pause:    (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" aria-hidden><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>,
  play:     (s=14) => <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d="M8 5.5v13l11-6.5L8 5.5z"/></svg>,
  spinner:  (s=15) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ animation:'spin .8s linear infinite' }} aria-hidden><path d="M12 3a9 9 0 0 1 9 9"/></svg>,
}

const ALERT_SUGGESTIONS = ['iPhone', 'Toyota', 'Laptop', 'Land', 'Solar', 'Fridge', 'House rent', 'Generator']

function parseKeywordList(str) {
  if (!str) return []
  return String(str).split(/[,;\n]+/).map(k => k.trim()).filter(Boolean)
}

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

const ALL_DISTRICTS = [
  'All Districts','Lilongwe','Blantyre','Mzuzu','Zomba','Kasungu',
  'Mangochi','Salima','Dedza','Ntchisi','Dowa','Karonga',
  'Nkhata Bay','Rumphi','Mzimba','Nkhotakota','Ntcheu',
  'Balaka','Machinga','Chiradzulu','Thyolo','Mulanje','Phalombe',
  'Chikwawa','Nsanje','Mwanza','Neno','Likoma',
]

export default function NotifyMeModal({ query, onClose, user }) {
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
                  Watch the marketplace - we ping you when a match lands.
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
          {/* -- CREATE -- */}
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
                    placeholder={tags.length ? 'Add another...' : 'e.g. iPhone 13, Toyota Hilux...'}
                    style={{ flex:1, minWidth:120, border:'none', outline:'none', fontSize:13.5, color:T.gray900, background:'transparent', fontFamily:'inherit', padding:'4px 2px' }}
                  />
                </div>
                <div style={{ fontSize:11.5, color:T.gray500, marginTop:6, display:'flex', alignItems:'center', gap:5 }}>
                  {Icon.sparkles(11)} Press Enter or comma to add - up to 12 keywords
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
                          <span key={k}>{i > 0 ? ', ' : ''}"{k}"</span>
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
                            ? `MK ${Number(minPrice).toLocaleString()} - ${Number(maxPrice).toLocaleString()}`
                            : maxPrice
                              ? `<= MK ${Number(maxPrice).toLocaleString()}`
                              : `>= MK ${Number(minPrice).toLocaleString()}`}
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

          {/* -- SUCCESS -- */}
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
                We'll watch for{' '}
                <strong style={{ color:T.gray900 }}>
                  {tags.map((k, i) => (i ? ', ' : '') + `"${k}"`)}
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

          {/* -- MANAGE -- */}
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
                    Create a smart alert and we'll watch the marketplace for you.
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
                    {alerts.filter(a => a.active).length} active - {alerts.length} total
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
                              {a.budget_max != null && <span style={{ display:'inline-flex', alignItems:'center', gap:3 }}>{Icon.cash(11)} {'<='} MK {Number(a.budget_max).toLocaleString()}</span>}
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
              {saving ? <>{Icon.spinner(16)} Activating...</> : <>{Icon.bell(16)} Activate smart alert</>}
            </button>
            <div style={{ fontSize:11, color:T.gray500, textAlign:'center', marginTop:8, lineHeight:1.4 }}>
              Free - Instant when matches post - Pause anytime
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
