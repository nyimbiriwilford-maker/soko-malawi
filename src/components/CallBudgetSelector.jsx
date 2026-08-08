import { useState } from 'react'
import { Check, Video, Phone, Sparkles, Leaf, Gauge, Crown, SlidersHorizontal } from 'lucide-react'
import {
  BUDGET_PRESETS, getCallBudgetPref, setCallBudgetPref,
  effectiveEstimateDuration, shouldAutoLowData, getCallUsageLog,
} from '../lib/callBudgetPrefs'

const KEYS  = ['low', 'medium', 'high']
const NAMES = { low: 'Economy', medium: 'Balanced', high: 'Premium' }
const DESC  = {
  low:    'Best for quick calls when data is tight.',
  medium: 'A good everyday amount for most calls.',
  high:   'Plenty for long, high-quality calls.',
  custom: 'Set your own amount — any size you like.',
}
const TIERS = {
  low:    { icon: Leaf,              color: '#34D399', tint: 'rgba(52,211,153,.13)',  ring: 'rgba(52,211,153,.28)'  },
  medium: { icon: Gauge,             color: '#60A5FA', tint: 'rgba(96,165,250,.13)',  ring: 'rgba(96,165,250,.28)'  },
  high:   { icon: Crown,             color: '#C084FC', tint: 'rgba(192,132,252,.13)', ring: 'rgba(192,132,252,.28)' },
  custom: { icon: SlidersHorizontal, color: '#F9AB00', tint: 'rgba(249,171,0,.12)',   ring: 'rgba(249,171,0,.28)'   },
}
const P = {
  backdrop: 'rgba(9,14,11,0.76)',
  surface:  '#111714',
  up:       '#192019',
  border:   '#24302a',
  borderUp: '#2d3d30',
  text:     '#e2ede4',
  sub:      '#9fb0a3',
  dim:      '#677870',
  green:    '#0F9D58',
  greenTint:'rgba(15,157,88,.14)',
  greenRing:'rgba(15,157,88,.4)',
  yellow:   '#F9AB00',
}

const CSS = `
  @keyframes bsSlideUp { from{opacity:0;transform:translateY(20px) scale(.98)} to{opacity:1;transform:translateY(0) scale(1)} }
  @keyframes bsCheck   { 0%{transform:scale(.3);opacity:0} 60%{transform:scale(1.25)} 100%{transform:scale(1);opacity:1} }
  .bs-card:hover  { transform:translateY(-2px)!important; }
  .bs-card:active { transform:scale(.982)!important; }
  .bs-btn:active  { transform:scale(.97); }
  .bs-check { animation:bsCheck .22s ease forwards; }
  @media (max-width:519px){
    .bs-overlay { align-items:flex-end!important; padding:0!important; }
    .bs-sheet   { border-radius:22px 22px 0 0!important; max-height:92vh; width:100%!important; }
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

function TierIcon({ tierKey }) {
  const t = TIERS[tierKey]
  const Icon = t.icon
  return (
    <span style={{ display:'inline-flex', alignItems:'center', justifyContent:'center',
      width:40, height:40, borderRadius:12, flexShrink:0,
      background:t.tint, color:t.color, boxShadow:`0 0 0 1px ${t.ring}` }}>
      <Icon size={19} strokeWidth={2.2} aria-hidden />
    </span>
  )
}

export default function CallBudgetSelector({ callType, onConfirm, onCancel }) {
  const saved = getCallBudgetPref(callType)
  const savedIsCustom = saved?.preset === 'custom'
  const [selectedKey, setSelectedKey] = useState(
    savedIsCustom ? 'custom' : (saved && KEYS.includes(saved.preset)) ? saved.preset : 'medium'
  )
  const [customMb, setCustomMb] = useState(savedIsCustom ? saved.mb : 30)

  const [recommendation] = useState(() => {
    const log = getCallUsageLog().filter((r) => r?.callType === callType).slice(-3)
    if (log.length < 3) return null
    let totalBytes = 0, totalSec = 0
    for (const r of log) { totalBytes += Number(r.bytesUsed)||0; totalSec += Number(r.durationSec)||0 }
    if (totalSec <= 0) return null
    const avgMb = (totalBytes / totalSec) * (60 / (1024 * 1024)) * (totalSec / log.length / 60)
    return avgMb <= BUDGET_PRESETS[callType].low
      ? 'Your recent calls suggest Economy is enough'
      : 'Based on your recent calls, Balanced suits you'
  })

  const isCustom    = selectedKey === 'custom'
  const validCustom = Number.isFinite(customMb) && customMb > 0
  const canSave     = !isCustom || validCustom

  function durations(key) {
    const mb = BUDGET_PRESETS[callType][key]
    return {
      video: estimateDuration('video', mb, callType === 'video' && shouldAutoLowData('video', key)),
      audio: estimateDuration('voice', mb, false),
    }
  }
  const customD = isCustom && validCustom
    ? { video: estimateDuration('video', customMb, false), audio: estimateDuration('voice', customMb, false) }
    : null

  function handleSave() {
    if (isCustom) {
      if (!validCustom) return
      setCallBudgetPref(callType, { preset: 'custom', mb: Math.round(customMb * 10) / 10 })
      onConfirm?.('custom')
    } else {
      setCallBudgetPref(callType, { preset: selectedKey, mb: BUDGET_PRESETS[callType][selectedKey] })
      onConfirm?.(selectedKey)
    }
  }

  const cardSt = (sel) => ({
    display:'flex', width:'100%', boxSizing:'border-box', textAlign:'left',
    cursor:'pointer', fontFamily:'inherit', color:P.text,
    background: sel ? P.greenTint : P.up,
    border: `1.5px solid ${sel ? P.green : P.border}`,
    borderRadius:14, padding:'14px 16px',
    boxShadow: sel ? `0 0 0 1px ${P.greenRing},0 10px 28px rgba(0,0,0,.4)` : 'none',
    transform: sel ? 'translateY(-1px)' : undefined,
    transition:'border-color .22s,background .22s,transform .18s,box-shadow .22s',
  })

  return (
    <div className="bs-overlay" onClick={onCancel}
      style={{ position:'fixed', inset:0, zIndex:9500, background:P.backdrop,
        display:'flex', alignItems:'center', justifyContent:'center',
        padding:20, fontFamily:"'Sora','DM Sans',system-ui,sans-serif" }}>
      <div className="bs-sheet"
        role="dialog" aria-modal="true" aria-label={`${callType} call data budget`}
        onClick={(e) => e.stopPropagation()}
        style={{ width:'min(420px,100%)', maxHeight:'90vh', overflowY:'auto',
          background:P.surface, border:`1px solid ${P.border}`,
          borderRadius:20, padding:22,
          boxShadow:'0 28px 64px rgba(0,0,0,.6)',
          animation:'bsSlideUp .26s ease' }}>

        <div style={{ color:P.text, fontSize:18, fontWeight:800, marginBottom:4 }}>Call data budget</div>
        <div style={{ color:P.dim, fontSize:13, lineHeight:1.4, marginBottom:18 }}>
          Pick how much data to set aside. Each option shows how long it lasts on video and voice calls.
        </div>

        {recommendation && (
          <div role="status" aria-live="polite"
            style={{ display:'flex', alignItems:'center', gap:8,
              background:'rgba(15,157,88,.10)', border:'1px solid rgba(15,157,88,.32)',
              borderRadius:999, padding:'8px 14px', marginBottom:16,
              color:P.green, fontSize:13, fontWeight:600, lineHeight:1.35 }}>
            <Sparkles size={13} strokeWidth={2.5} aria-hidden />
            {recommendation}
          </div>
        )}

        <div role="radiogroup" aria-label="Budget options"
          style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:18 }}>
          {KEYS.map((key) => {
            const mb  = BUDGET_PRESETS[callType][key]
            const d   = durations(key)
            const sel = key === selectedKey
            return (
              <button key={key} type="button" className="bs-card" role="radio" aria-checked={sel}
                onClick={() => setSelectedKey(key)} style={cardSt(sel)}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:12, width:'100%' }}>
                  <TierIcon tierKey={key} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:2 }}>
                      <span style={{ fontSize:15, fontWeight:800 }}>{NAMES[key]}</span>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:8, flexShrink:0 }}>
                        {sel && <span className="bs-check" style={{ display:'inline-flex', alignItems:'center',
                          justifyContent:'center', width:20, height:20, borderRadius:'50%',
                          background:P.green, color:'#fff' }}><Check size={12} strokeWidth={3.2}/></span>}
                        <span style={{ fontSize:16, fontWeight:800, color:P.yellow }}>{mb} MB</span>
                      </span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginTop:4 }}>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4, color:P.sub, fontSize:12, fontWeight:600 }}>
                        <Video size={12} aria-hidden />{fmt(d.video)}
                      </span>
                      <span style={{ display:'inline-flex', alignItems:'center', gap:4, color:P.sub, fontSize:12, fontWeight:600 }}>
                        <Phone size={12} aria-hidden />{fmt(d.audio)}
                      </span>
                    </div>
                    <div style={{ fontSize:12, color:P.dim, lineHeight:1.4, marginTop:5 }}>{DESC[key]}</div>
                  </div>
                </div>
              </button>
            )
          })}

          {/* Custom */}
          <div className="bs-card" role="radio" aria-checked={isCustom} tabIndex={0}
            onClick={() => setSelectedKey('custom')}
            onKeyDown={(e) => { if (e.key==='Enter'||e.key===' ') setSelectedKey('custom') }}
            style={cardSt(isCustom)}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:12, width:'100%' }}>
              <TierIcon tierKey="custom" />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:2 }}>
                  <span style={{ fontSize:15, fontWeight:800 }}>Custom</span>
                  <span style={{ display:'inline-flex', alignItems:'center', gap:8, flexShrink:0 }}>
                    {isCustom && <span className="bs-check" style={{ display:'inline-flex', alignItems:'center',
                      justifyContent:'center', width:20, height:20, borderRadius:'50%',
                      background:P.green, color:'#fff' }}><Check size={12} strokeWidth={3.2}/></span>}
                    <span style={{ fontSize:16, fontWeight:800, color:P.yellow }}>
                      {validCustom ? `${customMb} MB` : '— MB'}
                    </span>
                  </span>
                </div>
                <div style={{ fontSize:12, color:P.dim, lineHeight:1.4, marginTop:4 }}>{DESC.custom}</div>
                {isCustom && (
                  <div onClick={(e) => e.stopPropagation()} style={{ marginTop:12 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                      <input type="number" min="1"
                        value={Number.isFinite(customMb) ? customMb : ''}
                        onChange={(e) => setCustomMb(Number(e.target.value))}
                        aria-label="Custom budget in megabytes"
                        placeholder="e.g. 20"
                        style={{ flex:1, minWidth:0, background:P.surface,
                          border:`1.5px solid ${P.green}`, borderRadius:10,
                          padding:'10px 12px', color:P.text, fontSize:15,
                          fontWeight:700, fontFamily:'inherit', outline:'none' }} />
                      <span style={{ fontSize:13, fontWeight:700, color:P.dim }}>MB</span>
                    </div>
                    {customD && (
                      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap', marginTop:8 }}>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4, color:P.sub, fontSize:12, fontWeight:600 }}>
                          <Video size={12} aria-hidden />{fmt(customD.video)}
                        </span>
                        <span style={{ display:'inline-flex', alignItems:'center', gap:4, color:P.sub, fontSize:12, fontWeight:600 }}>
                          <Phone size={12} aria-hidden />{fmt(customD.audio)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div style={{ display:'flex', gap:10 }}>
          <button type="button" className="bs-btn" onClick={handleSave} disabled={!canSave}
            style={{ flex:1, background: canSave ? P.green : P.up,
              color: canSave ? '#fff' : P.dim,
              border:'none', borderRadius:12, padding:'13px 0',
              fontSize:15, fontWeight:700, cursor: canSave ? 'pointer' : 'not-allowed',
              fontFamily:'inherit', transition:'all .2s' }}>
            Save &amp; call
          </button>
          <button type="button" className="bs-btn" onClick={() => onConfirm?.(null)}
            style={{ flex:1, background:'transparent', color:P.sub,
              border:`1px solid ${P.border}`, borderRadius:12, padding:'13px 0',
              fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              transition:'all .2s' }}>
            Cancel / Skip
          </button>
        </div>
        <div style={{ marginTop:12, color:P.dim, fontSize:12, lineHeight:1.45 }}>
          Skip keeps the last saved budget. With none saved, the call runs at full quality.
        </div>
      </div>
      <style>{CSS}</style>
    </div>
  )
}
