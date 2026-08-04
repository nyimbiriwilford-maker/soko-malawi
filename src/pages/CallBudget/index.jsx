import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Video,
  Phone,
  Leaf,
  Gauge,
  Crown,
  SlidersHorizontal,
} from 'lucide-react'
import {
  BUDGET_PRESETS,
  getCallBudgetPref,
  setCallBudgetPref,
  estimateDuration,
  shouldAutoLowData,
} from '../../lib/callBudgetPrefs'

const KEYS = ['low', 'medium', 'high']

const NAMES = { low: 'Economy', medium: 'Balanced', high: 'Premium' }
const DESCRIPTIONS = {
  low: 'Best for quick calls when data is tight.',
  medium: 'A good everyday amount for most calls.',
  high: 'Plenty for long, high-quality calls.',
  custom: 'Set your own amount — any size you like.',
}

const QUALITIES = [
  { id: 'saver', label: 'Data Saver', detail: '40 kbit/s' },
  { id: 'balanced', label: 'Balanced', detail: '200 kbit/s' },
  { id: 'high', label: 'High Quality', detail: 'no cap' },
]

const TIERS = {
  low: {
    name: NAMES.low,
    icon: Leaf,
    color: '#34D399',
    tint: 'rgba(52, 211, 153, 0.15)',
  },
  medium: {
    name: NAMES.medium,
    icon: Gauge,
    color: '#60A5FA',
    tint: 'rgba(96, 165, 250, 0.15)',
  },
  high: {
    name: NAMES.high,
    icon: Crown,
    color: '#C084FC',
    tint: 'rgba(192, 132, 252, 0.15)',
  },
}

const CUSTOM_TIER = {
  icon: SlidersHorizontal,
  color: '#F9AB00',
  tint: 'rgba(249, 171, 0, 0.12)',
}

const PALETTE = {
  page: '#0d1210',
  surface: '#161b17',
  surfaceRaised: '#1e2520',
  border: '#2a342c',
  text: '#e8efe9',
  textDim: '#93a39a',
  green: '#0F9D58',
  greenTint: 'rgba(15, 157, 88, 0.14)',
  yellow: '#F9AB00',
}

const KEYFRAMES = `
  @keyframes budgetPageFadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes budgetStartPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(15, 157, 88, 0.45); }
    50% { box-shadow: 0 0 0 9px rgba(15, 157, 88, 0); }
  }
  .budget-start-pulse { animation: budgetStartPulse 1.8s ease-in-out infinite; }
  .budget-start-pulse:active { animation: none; }
`

/** Friendly duration label, e.g. "~45 min", "~1 hr 5 min". */
function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  if (total < 60) return 'under 1 min'
  const mins = Math.round(total / 60)
  if (mins < 60) return `~${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `~${hrs} hr ${rem} min` : `~${hrs} hr`
}

/** Video-seconds for a custom budget under a given quality level. */
function customVideoSeconds(mb, qualityId) {
  if (qualityId === 'saver') return estimateDuration('video', mb, true)
  if (qualityId === 'balanced') return (mb * 1024 * 1024) / 140000
  return estimateDuration('video', mb, false)
}

const stickyHeaderStyle = {
  position: 'sticky',
  top: 0,
  zIndex: 5,
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  background: 'rgba(13, 18, 16, 0.92)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderBottom: '1px solid rgba(42, 52, 44, 0.6)',
  padding: '12px 18px',
}

const backBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 44,
  height: 44,
  borderRadius: '50%',
  background: PALETTE.surfaceRaised,
  border: `1px solid ${PALETTE.border}`,
  color: PALETTE.text,
  cursor: 'pointer',
  flexShrink: 0,
  transition: 'background 0.15s ease, transform 0.12s ease',
}

const pageTitleStyle = {
  color: PALETTE.text,
  fontSize: 20,
  fontWeight: 800,
  lineHeight: 1.2,
}

const headerSubStyle = {
  color: PALETTE.textDim,
  fontSize: 12,
  fontWeight: 600,
  textTransform: 'capitalize',
  lineHeight: 1.3,
}

const contentStyle = {
  flex: 1,
  padding: '20px 18px 8px',
  animation: 'budgetPageFadeUp 0.25s ease',
}

const sectionLabelStyle = {
  color: PALETTE.textDim,
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  margin: '0 0 10px',
}

const cardBase = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  width: '100%',
  boxSizing: 'border-box',
  textAlign: 'left',
  background: PALETTE.surfaceRaised,
  border: `1px solid ${PALETTE.border}`,
  borderRadius: 16,
  padding: '16px',
  cursor: 'pointer',
  color: PALETTE.text,
  fontFamily: 'inherit',
  transition: 'border-color 0.25s ease, background 0.25s ease, transform 0.2s ease, box-shadow 0.25s ease',
}

const cardSelected = {
  borderColor: PALETTE.green,
  background: PALETTE.greenTint,
  boxShadow: '0 0 0 1px rgba(15,157,88,0.4), 0 10px 30px rgba(0,0,0,0.35)',
  transform: 'scale(1.01)',
}

const tierIconStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 44,
  height: 44,
  borderRadius: 14,
  flexShrink: 0,
}

const cardName = {
  fontSize: 16,
  fontWeight: 800,
  color: PALETTE.text,
}

const checkBadge = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  borderRadius: '50%',
  background: PALETTE.green,
  color: '#ffffff',
  flexShrink: 0,
}

const mbBadge = {
  fontSize: 15,
  fontWeight: 800,
  color: PALETTE.yellow,
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}

const descStyle = {
  fontSize: 12,
  color: PALETTE.textDim,
  marginTop: 2,
  lineHeight: 1.45,
}

const statsRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  marginTop: 8,
  flexWrap: 'wrap',
}

const statItem = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  color: PALETTE.textDim,
  fontSize: 12,
  fontWeight: 600,
  whiteSpace: 'nowrap',
}

const customSliderWrap = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginTop: 14,
}

const sliderStyle = {
  flex: 1,
  minWidth: 0,
  height: 4,
  accentColor: PALETTE.green,
  cursor: 'pointer',
}

const customInputStyle = {
  width: 64,
  boxSizing: 'border-box',
  textAlign: 'center',
  background: PALETTE.surface,
  border: `1px solid ${PALETTE.green}`,
  borderRadius: 10,
  padding: '9px 6px',
  color: PALETTE.text,
  fontSize: 15,
  fontWeight: 700,
  fontFamily: 'inherit',
  outline: 'none',
}

const customUnitStyle = {
  fontSize: 12,
  fontWeight: 700,
  color: PALETTE.textDim,
}

const sliderHints = {
  display: 'flex',
  justifyContent: 'space-between',
  fontSize: 10,
  color: PALETTE.textDim,
  marginTop: 2,
}

const qualityLabelStyle = {
  marginTop: 16,
  color: PALETTE.textDim,
  fontSize: 12,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
}

const qualityRowStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(3, 1fr)',
  gap: 8,
  marginTop: 8,
}

const qualityBtnBase = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 2,
  minHeight: 46,
  background: PALETTE.surface,
  border: `1px solid ${PALETTE.border}`,
  borderRadius: 999,
  padding: '8px 6px',
  color: PALETTE.textDim,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'center',
  transition: 'border-color 0.2s ease, color 0.2s ease, background 0.2s ease',
}

const qualityBtnSelected = {
  borderColor: PALETTE.green,
  background: 'rgba(15, 157, 88, 0.12)',
  color: PALETTE.text,
}

const qualityNameStyle = {
  fontSize: 12,
  fontWeight: 700,
  lineHeight: 1.25,
}

const qualityDetailStyle = {
  fontSize: 10,
  color: PALETTE.textDim,
}

const footerStyle = {
  position: 'sticky',
  bottom: 0,
  zIndex: 5,
  background: 'rgba(13, 18, 16, 0.95)',
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  borderTop: '1px solid rgba(42, 52, 44, 0.6)',
  padding: '14px 18px calc(14px + env(safe-area-inset-bottom, 0px))',
  marginTop: 'auto',
}

const startBtnStyle = {
  width: '100%',
  minHeight: 52,
  background: PALETTE.green,
  color: '#ffffff',
  border: 'none',
  borderRadius: 14,
  padding: '0 18px',
  fontSize: 15,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'opacity 0.2s ease, transform 0.15s ease, background 0.2s ease',
}

const startBtnDisabledStyle = {
  ...startBtnStyle,
  opacity: 0.45,
  cursor: 'not-allowed',
}

export default function CallBudgetPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const state = location.state || {}
  const callType = state.callType === 'voice' ? 'voice' : 'video'

  const saved = getCallBudgetPref(callType)
  const savedIsCustom = saved && saved.preset === 'custom'
  const [selectedKey, setSelectedKey] = useState(
    savedIsCustom
      ? 'custom'
      : saved && KEYS.includes(saved.preset)
        ? saved.preset
        : 'medium'
  )
  const [customMb, setCustomMb] = useState(
    savedIsCustom && saved ? saved.mb : 30
  )
  const [quality, setQuality] = useState('balanced')

  const isCustom = selectedKey === 'custom'
  const validCustom = Number.isFinite(customMb) && customMb > 0
  const canStart = !isCustom || validCustom

  function presetDurations(key) {
    const mb = BUDGET_PRESETS[callType][key]
    const videoLowData = callType === 'video' && shouldAutoLowData('video', key)
    return {
      video: estimateDuration('video', mb, videoLowData),
      audio: estimateDuration('voice', mb, false),
    }
  }

  function customDurations() {
    if (!validCustom) return null
    return {
      video: customVideoSeconds(customMb, quality),
      audio: estimateDuration('voice', customMb, false),
    }
  }

  function handleStart() {
    if (isCustom) {
      if (!validCustom) return
      setCallBudgetPref(callType, { preset: 'custom', mb: Math.round(customMb * 10) / 10 })
    } else {
      setCallBudgetPref(callType, {
        preset: selectedKey,
        mb: BUDGET_PRESETS[callType][selectedKey],
      })
    }
    // Only auto-start when this flow began from a chat (soko_pending_call set).
    const pending = sessionStorage.getItem('soko_pending_call')
    sessionStorage.removeItem('soko_pending_call')
    if (pending) {
      sessionStorage.setItem('soko_start_call_on_return', callType)
    }
    navigate(-1)
  }

  function startSummary() {
    if (isCustom) {
      if (!validCustom) return 'Start call'
      const d = customD
      const est = callType === 'voice' ? formatDuration(d.audio) : formatDuration(d.video)
      return `Start call · Custom · ${est}`
    }
    const d = presetDurations(selectedKey)
    const est = callType === 'voice' ? formatDuration(d.audio) : formatDuration(d.video)
    return `Start call · ${NAMES[selectedKey]} · ${est}`
  }

  const customD = isCustom ? customDurations() : null
  const sliderValue = Number.isFinite(customMb) ? Math.min(200, Math.max(1, customMb)) : 1

  return (
    <div
      style={{
        minHeight: '100vh',
        background: PALETTE.page,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: "'Sora', 'Inter', system-ui, sans-serif",
      }}
    >
      <div style={stickyHeaderStyle}>
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          style={backBtnStyle}
        >
          <ArrowLeft size={19} strokeWidth={2.2} aria-hidden />
        </button>
        <div>
          <div style={pageTitleStyle}>Call Budget</div>
          <div style={headerSubStyle}>{callType} call</div>
        </div>
      </div>

      <div style={contentStyle}>
        <div style={sectionLabelStyle}>Pick a budget</div>

        <div role="radiogroup" aria-label="Budget options" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
          {KEYS.map((key) => {
            const mb = BUDGET_PRESETS[callType][key]
            const d = presetDurations(key)
            const selected = key === selectedKey
            const tier = TIERS[key]
            const Icon = tier.icon
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSelectedKey(key)}
                style={selected ? { ...cardBase, ...cardSelected } : cardBase}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, width: '100%' }}>
                  <span style={{ ...tierIconStyle, background: tier.tint, color: tier.color }}>
                    <Icon size={22} strokeWidth={2.2} aria-hidden />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                      <span style={cardName}>{tier.name}</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                        {selected && (
                          <span style={checkBadge} aria-hidden>
                            <Check size={13} strokeWidth={3} />
                          </span>
                        )}
                        <span style={mbBadge}>{mb} MB</span>
                      </span>
                    </div>
                    <div style={descStyle}>{DESCRIPTIONS[key]}</div>
                    <div style={statsRow}>
                      <span style={statItem}>
                        <Video size={13} color={PALETTE.textDim} aria-hidden />
                        {formatDuration(d.video)}
                      </span>
                      <span style={statItem}>
                        <Phone size={13} color={PALETTE.textDim} aria-hidden />
                        {formatDuration(d.audio)}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            )
          })}

          <div
            role="radio"
            aria-checked={isCustom}
            tabIndex={0}
            onClick={() => setSelectedKey('custom')}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') setSelectedKey('custom')
            }}
            style={isCustom ? { ...cardBase, ...cardSelected } : cardBase}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, width: '100%' }}>
              <span style={{ ...tierIconStyle, background: CUSTOM_TIER.tint, color: CUSTOM_TIER.color }}>
                <CUSTOM_TIER.icon size={22} strokeWidth={2.2} aria-hidden />
              </span>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <span style={cardName}>Custom</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {isCustom && (
                      <span style={checkBadge} aria-hidden>
                        <Check size={13} strokeWidth={3} />
                      </span>
                    )}
                    <span style={mbBadge}>{validCustom ? customMb : '—'} MB</span>
                  </span>
                </div>
                <div style={descStyle}>{DESCRIPTIONS.custom}</div>

                {isCustom && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <div style={customSliderWrap}>
                      <input
                        type="range"
                        min="1"
                        max="200"
                        step="1"
                        value={sliderValue}
                        onChange={(e) => setCustomMb(Number(e.target.value))}
                        aria-label="Custom budget in megabytes"
                        style={sliderStyle}
                      />
                      <input
                        type="number"
                        min="1"
                        max="200"
                        value={Number.isFinite(customMb) ? customMb : ''}
                        onChange={(e) => setCustomMb(Number(e.target.value))}
                        aria-label="Custom budget amount in megabytes"
                        style={customInputStyle}
                      />
                      <span style={customUnitStyle}>MB</span>
                    </div>
                    <div style={sliderHints}>
                      <span>1 MB</span>
                      <span>200 MB</span>
                    </div>

                    <div style={qualityLabelStyle}>Video quality</div>
                    <div role="radiogroup" aria-label="Video quality" style={qualityRowStyle}>
                      {QUALITIES.map((q) => {
                        const selected = q.id === quality
                        return (
                          <button
                            key={q.id}
                            type="button"
                            role="radio"
                            aria-checked={selected}
                            onClick={(e) => {
                              e.stopPropagation()
                              setQuality(q.id)
                            }}
                            style={selected ? { ...qualityBtnBase, ...qualityBtnSelected } : qualityBtnBase}
                          >
                            <span style={qualityNameStyle}>{q.label}</span>
                            <span style={qualityDetailStyle}>{q.detail}</span>
                          </button>
                        )
                      })}
                    </div>

                    {customD && (
                      <div style={statsRow}>
                        <span style={statItem}>
                          <Video size={13} color={PALETTE.textDim} aria-hidden />
                          {formatDuration(customD.video)}
                        </span>
                        <span style={statItem}>
                          <Phone size={13} color={PALETTE.textDim} aria-hidden />
                          {formatDuration(customD.audio)}
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={footerStyle}>
        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          className={canStart ? 'budget-start-pulse' : undefined}
          style={canStart ? startBtnStyle : startBtnDisabledStyle}
        >
          {startSummary()}
        </button>
        <div style={{ textAlign: 'center', color: PALETTE.textDim, fontSize: 11, marginTop: 10 }}>
          Data is only used while the call is active.
        </div>
      </div>
      <style>{KEYFRAMES}</style>
    </div>
  )
}
