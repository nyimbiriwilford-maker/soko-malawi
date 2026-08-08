import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft, Check, Video, Phone,
  Leaf, Gauge, Crown, SlidersHorizontal, Sparkles,
} from 'lucide-react'
import {
  BUDGET_PRESETS, getCallBudgetPref, setCallBudgetPref,
  effectiveEstimateDuration, shouldAutoLowData, getLearnedRateInfo,
} from '../../lib/callBudgetPrefs'

const KEYS = ['low', 'medium', 'high']
const NAMES = { low: 'Economy', medium: 'Balanced', high: 'Premium' }
const DESC = {
  low:    'Best for quick calls when data is tight.',
  medium: 'A good everyday amount for most calls.',
  high:   'Plenty for long, high-quality calls.',
  custom: 'Set your own amount — any size you like.',
}
const QUALITIES = [
  { id: 'saver',    label: 'Data Saver',   detail: '40 kbit/s'  },
  { id: 'balanced', label: 'Balanced',     detail: '200 kbit/s' },
  { id: 'high',     label: 'High Quality', detail: 'no cap'     },
]
const TIERS = {
  low:    { icon: Leaf,              color: '#34D399', tint: 'rgba(52,211,153,.13)',  ring: 'rgba(52,211,153,.28)'  },
  medium: { icon: Gauge,             color: '#60A5FA', tint: 'rgba(96,165,250,.13)',  ring: 'rgba(96,165,250,.28)'  },
  high:   { icon: Crown,             color: '#C084FC', tint: 'rgba(192,132,252,.13)', ring: 'rgba(192,132,252,.28)' },
  custom: { icon: SlidersHorizontal, color: '#F9AB00', tint: 'rgba(249,171,0,.12)',   ring: 'rgba(249,171,0,.28)'   },
}
const P = {
  page:      '#f4f8f5',
  surface:   '#ffffff',
  up:        '#f4f8f5',
  hi:        '#edf5f0',
  border:    '#d8e5dc',
  borderUp:  '#c8dbd0',
  text:      '#0f1410',
  sub:       '#637068',
  dim:       '#8fa897',
  green:     '#0F9D58',
  greenTint: 'rgba(15,157,88,.08)',
  greenRing: 'rgba(15,157,88,.35)',
  yellow:    '#d4920a',
}

const CSS = `
  @keyframes bpFadeUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes bpPulse  { 0%,100%{box-shadow:0 0 0 0 rgba(15,157,88,.5)} 50%{box-shadow:0 0 0 11px rgba(15,157,88,0)} }
  @keyframes bpCheck  { 0%{transform:scale(.3);opacity:0} 60%{transform:scale(1.25)} 100%{transform:scale(1);opacity:1} }
  .bp-card:hover  { transform:translateY(-2px)!important; }
  .bp-card:active { transform:scale(.982)!important; }
  .bp-back:hover  { background:${P.hi}!important; }
  .bp-check { animation:bpCheck .22s ease forwards; }
  .bp-pulse { animation:bpPulse 2s ease-in-out infinite; }
  .bp-pulse:active { animation:none; }
  .bp-start:hover:not(:disabled) { filter:brightness(1.1); }
  @media (min-width:520px){
    .bp-content { padding:26px 26px 12px!important; }
    .bp-grid    { display:grid!important; grid-template-columns:1fr 1fr!important; gap:14px!important; }
    .bp-custom  { grid-column:1/-1; }
  }
  @media (min-width:720px){
    .bp-root  { display:flex; justify-content:center; align-items:flex-start; padding:40px 16px 0; }
    .bp-shell { max-width:560px; width:100%; border-radius:24px; overflow:hidden; border:1px solid ${P.border}; }
  }
`

function fmt(seconds) {
  const t = Math.max(0, Math.round(Number(seconds) || 0))
  if (t < 60) return 'under 1 min'
  const m = Math.round(t / 60)
  if (m < 60) return `~${m} min`
  const h = Math.floor(m / 60), r = m % 60
  return r ? `~${h} hr ${r} min` : `~${h} hr`
}

function customVideoSec(mb, qId) {
  // All quality tiers now use learned rates when available
  return effectiveEstimateDuration('video', mb, qId)
}

function TierIcon({ tierKey }) {
  const t = TIERS[tierKey]
  const Icon = t.icon
  return (
    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:46, height:46, borderRadius:14, flexShrink:0,
      background:t.tint, color:t.color, boxShadow:`0 0 0 1px ${t.ring}` }}>
      <Icon size={22} strokeWidth={2.2} aria-hidden />
    </span>
  )
}

export default function CallBudgetPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const callType = (location.state?.callType === 'voice') ? 'voice' : 'video'

  const saved = getCallBudgetPref(callType)
  const savedIsCustom = saved?.preset === 'custom'
  const [selectedKey, setSelectedKey] = useState(
    savedIsCustom ? 'custom' : (saved && KEYS.includes(saved.preset)) ? saved.preset : 'medium'
  )
  const [customMb, setCustomMb] = useState(savedIsCustom ? saved.mb : 30)
  const [quality,   setQuality]   = useState(saved?.quality || 'balanced')

  const isCustom   = selectedKey === 'custom'
  const validCustom = Number.isFinite(customMb) && customMb > 0
  const canStart   = !isCustom || validCustom
  const learnedInfo = getLearnedRateInfo(callType)

  function durations(key) {
    const mb = BUDGET_PRESETS[callType][key]
    const savedPref = getCallBudgetPref(callType)
    const qualityForThisPreset = savedPref?.preset === key ? savedPref.quality : 'balanced'
    return {
      video: effectiveEstimateDuration('video', mb, callType === 'video' ? qualityForThisPreset : null),
      audio: effectiveEstimateDuration('voice', mb, null),
    }
  }
  const customD = isCustom && validCustom
    ? { video: customVideoSec(customMb, quality), audio: effectiveEstimateDuration('voice', customMb, null) }
    : null
  const sliderVal = Math.min(200, Math.max(1, Number.isFinite(customMb) ? customMb : 1))

  function handleStart() {
    if (isCustom) {
      if (!validCustom) return
      setCallBudgetPref(callType, { preset: 'custom', mb: Math.round(customMb * 10) / 10, quality })
    } else {
      setCallBudgetPref(callType, { preset: selectedKey, mb: BUDGET_PRESETS[callType][selectedKey], quality })
    }
    const pending = sessionStorage.getItem('soko_pending_call')
    sessionStorage.removeItem('soko_pending_call')
    if (pending) sessionStorage.setItem('soko_start_call_on_return', callType)
    navigate(-1)
  }

  function startLabel() {
    if (isCustom) {
      if (!validCustom) return 'Start call'
      const est = fmt(callType === 'voice' ? customD.audio : customD.video)
      return `Start call · Custom · ${est}`
    }
    const d = durations(selectedKey)
    const est = fmt(callType === 'voice' ? d.audio : d.video)
    return `Start call · ${NAMES[selectedKey]} · ${est}`
  }

  const cardStyle = (sel) => ({
    display:'flex', flexDirection:'column', width:'100%', boxSizing:'border-box',
    textAlign:'left', cursor:'pointer', fontFamily:'inherit', color:P.text,
    background: sel ? P.greenTint : P.up,
    border: `1.5px solid ${sel ? P.green : P.border}`,
    borderRadius:16, padding:'16px',
    boxShadow: sel ? `0 0 0 1px ${P.greenRing},0 14px 36px rgba(0,0,0,.45)` : 'none',
    transform: sel ? 'translateY(-1px)' : undefined,
    transition:'border-color .22s,background .22s,transform .18s,box-shadow .22s',
  })

  function CheckBadge({ show }) {
    return show ? (
      <span className="bp-check" style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
        width:20, height:20, borderRadius:'50%', background:P.green, color:'#fff', flexShrink:0 }}>
        <Check size={12} strokeWidth={3.2} />
      </span>
    ) : null
  }

  function StatRow({ d }) {
    return (
      <div style={{ display:'flex', alignItems:'center', gap:14, flexWrap:'wrap', marginTop:8 }}>
        <span style={{ display:'inline-flex', alignItems:'center', gap:5, color:P.sub, fontSize:11.5, fontWeight:600 }}>
          <Video size={12} aria-hidden />{fmt(d.video)}
        </span>
        <span style={{ display:'inline-flex', alignItems:'center', gap:5, color:P.sub, fontSize:11.5, fontWeight:600 }}>
          <Phone size={12} aria-hidden />{fmt(d.audio)}
        </span>
      </div>
    )
  }

  return (
    <div className="bp-root" style={{ background:P.page, fontFamily:"'Sora','DM Sans',system-ui,sans-serif", minHeight:'100vh' }}>
      <div className="bp-shell" style={{ minHeight:'100vh', display:'flex', flexDirection:'column', background:P.page }}>

        {/* ── Header ── */}
        <div style={{ position:'sticky', top:0, zIndex:5, display:'flex', alignItems:'center', gap:14,
          background:'rgba(255,255,255,0.92)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)',
          borderBottom:`1px solid rgba(216,229,220,0.8)`, padding:'12px 18px' }}>
          <button type="button" onClick={() => navigate(-1)} aria-label="Go back" className="bp-back"
            style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
              width:42, height:42, borderRadius:'50%', background:P.up,
              border:`1px solid ${P.border}`, color:P.text, cursor:'pointer',
              flexShrink:0, transition:'background .15s' }}>
            <ArrowLeft size={18} strokeWidth={2.3} aria-hidden />
          </button>
          <div style={{ flex:1 }}>
            <div style={{ color:P.text, fontSize:19, fontWeight:800, lineHeight:1.2 }}>Call Budget</div>
            <div style={{ color:P.dim, fontSize:11, fontWeight:600, textTransform:'capitalize', letterSpacing:'0.04em' }}>
              {callType} call
            </div>
          </div>
        </div>

        {/* ── Content ── */}
        <div className="bp-content" style={{ flex:1, padding:'22px 18px 10px', animation:'bpFadeUp .28s ease' }}>
          <div style={{ color:P.dim, fontSize:11, fontWeight:700, textTransform:'uppercase',
            letterSpacing:'0.08em', marginBottom:14 }}>Choose a budget</div>

          <div role="radiogroup" aria-label="Budget options" className="bp-grid"
            style={{ display:'flex', flexDirection:'column', gap:12, marginBottom:12 }}>

            {/* Preset cards */}
            {KEYS.map((key) => {
              const mb  = BUDGET_PRESETS[callType][key]
              const d   = durations(key)
              const sel = key === selectedKey
              return (
                <button key={key} type="button" role="radio" aria-checked={sel}
                  onClick={() => setSelectedKey(key)} className="bp-card"
                  style={cardStyle(sel)}>
                  <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                    <TierIcon tierKey={key} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:15, fontWeight:800 }}>{NAMES[key]}</span>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:8, flexShrink:0 }}>
                          <CheckBadge show={sel} />
                          <span style={{ fontSize:14, fontWeight:800, color:P.yellow }}>{mb} MB</span>
                        </span>
                      </div>
                      <div style={{ fontSize:12, color:P.dim, lineHeight:1.45 }}>{DESC[key]}</div>
                      <StatRow d={d} />
                    </div>
                  </div>
                </button>
              )
            })}

            {/* Custom card */}
            <div role="radio" aria-checked={isCustom} tabIndex={0}
              onClick={() => setSelectedKey('custom')}
              onKeyDown={(e) => { if (e.key==='Enter'||e.key===' ') setSelectedKey('custom') }}
              className="bp-card bp-custom"
              style={cardStyle(isCustom)}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                <TierIcon tierKey="custom" />
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:3 }}>
                    <span style={{ fontSize:15, fontWeight:800 }}>Custom</span>
                    <span style={{ display:'inline-flex', alignItems:'center', gap:8, flexShrink:0 }}>
                      <CheckBadge show={isCustom} />
                      <span style={{ fontSize:14, fontWeight:800, color:P.yellow }}>{validCustom ? `${customMb} MB` : '— MB'}</span>
                    </span>
                  </div>
                  <div style={{ fontSize:12, color:P.dim, lineHeight:1.45, marginBottom: isCustom ? 14 : 0 }}>{DESC.custom}</div>

                  {isCustom && (
                    <div onClick={(e) => e.stopPropagation()}>
                      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
                        <input type="range" min="1" max="200" step="1" value={sliderVal}
                          onChange={(e) => setCustomMb(Number(e.target.value))}
                          aria-label="Custom budget in megabytes"
                          style={{ flex:1, minWidth:0, height:4, accentColor:P.green, cursor:'pointer' }} />
                        <input type="number" min="1" max="200"
                          value={Number.isFinite(customMb) ? customMb : ''}
                          onChange={(e) => setCustomMb(Number(e.target.value))}
                          aria-label="MB amount"
                          style={{ width:62, textAlign:'center', background:P.surface,
                            border:`1.5px solid ${P.green}`, borderRadius:10,
                            padding:'8px 4px', color:P.text, fontSize:14, fontWeight:700,
                            fontFamily:'inherit', outline:'none', boxSizing:'border-box' }} />
                        <span style={{ fontSize:11, fontWeight:700, color:P.dim }}>MB</span>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:P.dim, marginTop:3 }}>
                        <span>1 MB</span><span>200 MB</span>
                      </div>
                      <div style={{ marginTop:16, color:P.dim, fontSize:11, fontWeight:700,
                        textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Video quality</div>
                      <div role="radiogroup" aria-label="Video quality"
                        style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8 }}>
                        {QUALITIES.map((q) => {
                          const qs = q.id === quality
                          return (
                            <button key={q.id} type="button" role="radio" aria-checked={qs}
                              onClick={(e) => { e.stopPropagation(); setQuality(q.id) }}
                              className="bp-card"
                              style={{ display:'flex', flexDirection:'column', alignItems:'center',
                                justifyContent:'center', gap:2, minHeight:50,
                                background: qs ? P.greenTint : P.surface,
                                border:`1.5px solid ${qs ? P.green : P.border}`,
                                borderRadius:12, padding:'8px 4px',
                                color: qs ? P.text : P.sub, cursor:'pointer', fontFamily:'inherit' }}>
                              <span style={{ fontSize:11, fontWeight:700, lineHeight:1.3 }}>{q.label}</span>
                              <span style={{ fontSize:10, color:P.dim }}>{q.detail}</span>
                            </button>
                          )
                        })}
                      </div>
                      {customD && <StatRow d={customD} />}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {learnedInfo.isActive && (
            <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8,
              color:P.green, fontSize:11, fontWeight:600 }}>
              <Sparkles size={11} aria-hidden />
              Calibrated from your {learnedInfo.count} recent {callType} call{learnedInfo.count !== 1 ? 's' : ''}
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div style={{ position:'sticky', bottom:0, zIndex:5,
          background:'rgba(255,255,255,0.94)', backdropFilter:'blur(14px)', WebkitBackdropFilter:'blur(14px)',
          borderTop:`1px solid rgba(216,229,220,0.8)`,
          padding:'14px 18px calc(14px + env(safe-area-inset-bottom,0px))' }}>
          <button type="button" onClick={handleStart} disabled={!canStart}
            className={canStart ? 'bp-start bp-pulse' : 'bp-start'}
            style={{ width:'100%', minHeight:52,
              background: canStart ? P.green : P.up,
              color: canStart ? '#fff' : P.dim,
              border:'none', borderRadius:14, fontSize:15, fontWeight:800,
              cursor: canStart ? 'pointer' : 'not-allowed',
              fontFamily:'inherit', transition:'all .2s', letterSpacing:'0.01em' }}>
            {startLabel()}
          </button>
          <div style={{ textAlign:'center', color:P.dim, fontSize:11, marginTop:10 }}>
            Data is only used while the call is active.
          </div>
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  )
}
