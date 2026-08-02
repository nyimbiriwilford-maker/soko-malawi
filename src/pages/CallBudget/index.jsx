import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { ArrowLeft, Check, Video, Phone } from 'lucide-react'
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

const PALETTE = {
  page: '#0d1210',
  surface: '#161b17',
  surfaceRaised: '#1e2520',
  border: '#2a342c',
  text: '#e8efe9',
  textDim: '#93a39a',
  green: '#0F9D58',
  yellow: '#F9AB00',
}

const KEYFRAMES = `
  @keyframes budgetPageFadeUp {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }
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

const headerStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  marginBottom: 6,
}

const backBtnStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 38,
  height: 38,
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
  fontSize: 22,
  fontWeight: 800,
  lineHeight: 1.2,
}

const subtitleStyle = {
  color: PALETTE.textDim,
  fontSize: 13,
  lineHeight: 1.5,
  marginBottom: 22,
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
  borderRadius: 14,
  padding: '14px 16px',
  cursor: 'pointer',
  color: PALETTE.text,
  fontFamily: 'inherit',
  transition: 'border-color 0.25s ease, background 0.25s ease, transform 0.2s ease, box-shadow 0.25s ease',
}

const cardSelected = {
  borderColor: PALETTE.green,
  background: 'rgba(15, 157, 88, 0.14)',
  boxShadow: '0 0 0 1px rgba(15,157,88,0.4), 0 10px 30px rgba(0,0,0,0.35)',
}

const cardTop = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
}

const cardName = {
  fontSize: 16,
  fontWeight: 800,
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

const statsRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 16,
  marginTop: 8,
  flexWrap: 'wrap',
}

const mbBadge = {
  fontSize: 20,
  fontWeight: 800,
  color: PALETTE.yellow,
  fontVariantNumeric: 'tabular-nums',
}

const statItem = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  color: PALETTE.textDim,
  fontSize: 13,
  fontWeight: 600,
  whiteSpace: 'nowrap',
}

const descStyle = {
  fontSize: 12,
  color: PALETTE.textDim,
  marginTop: 8,
  lineHeight: 1.45,
}

const customInputRow = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  marginTop: 12,
}

const customInputStyle = {
  flex: 1,
  minWidth: 0,
  background: PALETTE.surface,
  border: `1px solid ${PALETTE.green}`,
  borderRadius: 10,
  padding: '10px 12px',
  color: PALETTE.text,
  fontSize: 16,
  fontWeight: 700,
  fontFamily: 'inherit',
  outline: 'none',
}

const customUnitStyle = {
  fontSize: 13,
  fontWeight: 700,
  color: PALETTE.textDim,
}

const qualityLabelStyle = {
  marginTop: 14,
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
  gap: 2,
  background: PALETTE.surface,
  border: `1px solid ${PALETTE.border}`,
  borderRadius: 10,
  padding: '9px 6px',
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
  background: PALETTE.page,
  padding: '16px 0 8px',
  marginTop: 'auto',
}

const startBtnStyle = {
  width: '100%',
  background: PALETTE.green,
  color: '#ffffff',
  border: 'none',
  borderRadius: 14,
  padding: '15px 0',
  fontSize: 16,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
  opacity: 1,
  transition: 'opacity 0.2s ease, transform 0.15s ease',
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
  const onStart = state.onStart || state.returnStartCall || null

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
    onStart?.()
    navigate(-1)
  }

  function renderCheck(selected) {
    return selected ? (
      <span style={checkBadge} aria-hidden>
        <Check size={13} strokeWidth={3} />
      </span>
    ) : null
  }

  const customD = isCustom ? customDurations() : null

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
      <div style={{ flex: 1, padding: '20px 18px 0', animation: 'budgetPageFadeUp 0.25s ease' }}>
        <div style={headerStyle}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            style={backBtnStyle}
          >
            <ArrowLeft size={19} strokeWidth={2.2} aria-hidden />
          </button>
          <div>
            <div style={pageTitleStyle}>Call data budget</div>
            <div style={{ color: PALETTE.textDim, fontSize: 13, fontWeight: 600, textTransform: 'capitalize' }}>
              {callType} call
            </div>
          </div>
        </div>

        <div style={subtitleStyle}>
          Pick how much data to set aside. Each option shows how long it lasts
          on video and voice calls.
        </div>

        <div role="radiogroup" aria-label="Budget options" style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 12 }}>
          {KEYS.map((key) => {
            const mb = BUDGET_PRESETS[callType][key]
            const d = presetDurations(key)
            const selected = key === selectedKey
            return (
              <button
                key={key}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSelectedKey(key)}
                style={selected ? { ...cardBase, ...cardSelected } : cardBase}
              >
                <div style={cardTop}>
                  <span style={cardName}>{NAMES[key]}</span>
                  {renderCheck(selected)}
                </div>
                <div style={statsRow}>
                  <span style={mbBadge}>{mb} MB</span>
                  <span style={statItem}>
                    <Video size={13} color={PALETTE.textDim} aria-hidden />
                    {formatDuration(d.video)}
                  </span>
                  <span style={statItem}>
                    <Phone size={13} color={PALETTE.textDim} aria-hidden />
                    {formatDuration(d.audio)}
                  </span>
                </div>
                <div style={descStyle}>{DESCRIPTIONS[key]}</div>
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
            <div style={cardTop}>
              <span style={cardName}>Custom</span>
              {renderCheck(isCustom)}
            </div>
            <div style={statsRow}>
              <span style={mbBadge}>{validCustom ? customMb : '—'} MB</span>
            </div>
            <div style={descStyle}>{DESCRIPTIONS.custom}</div>

            {isCustom && (
              <>
                <div style={customInputRow} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="number"
                    min="1"
                    value={Number.isFinite(customMb) ? customMb : ''}
                    onChange={(e) => setCustomMb(Number(e.target.value))}
                    aria-label="Custom budget in megabytes"
                    style={customInputStyle}
                    placeholder="e.g. 20"
                  />
                  <span style={customUnitStyle}>MB</span>
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
                        onClick={() => setQuality(q.id)}
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
              </>
            )}
          </div>
        </div>
      </div>

      <div style={footerStyle}>
        <button
          type="button"
          onClick={handleStart}
          disabled={!canStart}
          style={canStart ? startBtnStyle : startBtnDisabledStyle}
        >
          Start {callType} call
        </button>
        <div style={{ textAlign: 'center', color: PALETTE.textDim, fontSize: 11, marginTop: 10 }}>
          Data is only used while the call is active.
        </div>
      </div>
      <style>{KEYFRAMES}</style>
    </div>
  )
}
