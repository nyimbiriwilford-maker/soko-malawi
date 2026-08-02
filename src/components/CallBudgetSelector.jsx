import { useState } from 'react'
import { Check, Video, Phone, Sparkles } from 'lucide-react'
import {
  BUDGET_PRESETS,
  getCallBudgetPref,
  setCallBudgetPref,
  estimateDuration,
  shouldAutoLowData,
  getCallUsageLog,
} from '../lib/callBudgetPrefs'

const KEYS = ['low', 'medium', 'high']

const NAMES = { low: 'Economy', medium: 'Balanced', high: 'Premium' }
const DESCRIPTIONS = {
  low: 'Best for quick calls when data is tight.',
  medium: 'A good everyday amount for most calls.',
  high: 'Plenty for long, high-quality calls.',
  custom: 'Set your own amount — any size you like.',
}

const PALETTE = {
  backdrop: 'rgba(9, 12, 10, 0.72)',
  surface: '#161b17',
  surfaceRaised: '#1e2520',
  border: '#2a342c',
  text: '#e8efe9',
  textDim: '#93a39a',
  green: '#0F9D58',
  yellow: '#F9AB00',
}

/** Friendly duration label, e.g. "~45 min", "~1 hr 5 min". No technical terms. */
function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  if (total < 60) return 'under 1 min'
  const mins = Math.round(total / 60)
  if (mins < 60) return `~${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `~${hrs} hr ${rem} min` : `~${hrs} hr`
}

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  zIndex: 9500,
  background: PALETTE.backdrop,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 20,
  fontFamily: "'Sora', 'Inter', system-ui, sans-serif",
}

const cardStyle = {
  width: 'min(400px, 100%)',
  maxHeight: '90vh',
  overflowY: 'auto',
  background: PALETTE.surface,
  border: `1px solid ${PALETTE.border}`,
  borderRadius: 18,
  padding: 22,
  boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
  animation: 'budgetFadeUp 0.25s ease',
}

const titleStyle = {
  color: PALETTE.text,
  fontSize: 18,
  fontWeight: 800,
  marginBottom: 4,
}

const subtitleStyle = {
  color: PALETTE.textDim,
  fontSize: 13,
  lineHeight: 1.4,
  marginBottom: 18,
}

const optionsWrapStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  marginBottom: 18,
}

const recChipStyle = {
  display: 'flex',
  alignItems: 'center',
  alignSelf: 'flex-start',
  gap: 8,
  background: 'rgba(15, 157, 88, 0.10)',
  border: '1px solid rgba(15, 157, 88, 0.35)',
  borderRadius: 999,
  padding: '7px 13px',
  marginBottom: 16,
  color: PALETTE.green,
  fontSize: 13,
  fontWeight: 600,
  lineHeight: 1.35,
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
  transform: 'scale(1.015)',
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
  marginTop: 10,
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

const btnRowStyle = {
  display: 'flex',
  gap: 10,
}

const saveBtnStyle = {
  flex: 1,
  background: PALETTE.green,
  color: '#ffffff',
  border: 'none',
  borderRadius: 12,
  padding: '13px 0',
  fontSize: 15,
  fontWeight: 700,
  cursor: 'pointer',
  fontFamily: 'inherit',
  opacity: 1,
  transition: 'opacity 0.2s ease, transform 0.15s ease',
}

const saveBtnDisabledStyle = {
  ...saveBtnStyle,
  opacity: 0.45,
  cursor: 'not-allowed',
}

const skipBtnStyle = {
  flex: 1,
  background: 'transparent',
  color: PALETTE.textDim,
  border: `1px solid ${PALETTE.border}`,
  borderRadius: 12,
  padding: '13px 0',
  fontSize: 15,
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'transform 0.15s ease',
}

const skipHintStyle = {
  marginTop: 12,
  color: PALETTE.textDim,
  fontSize: 12,
  lineHeight: 1.45,
}

const KEYFRAMES = `
  @keyframes budgetFadeUp {
    from { opacity: 0; transform: translateY(12px) scale(0.98); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes budgetPop {
    0% { transform: scale(0.4); opacity: 0; }
    60% { transform: scale(1.2); }
    100% { transform: scale(1); opacity: 1; }
  }
  .budget-check-pop { animation: budgetPop 0.25s ease forwards; }
  .budget-card:active { transform: scale(0.985); }
  .budget-btn:active { transform: scale(0.98); }
`

export default function CallBudgetSelector({ callType, onConfirm, onCancel }) {
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

  const [recommendation] = useState(() => {
    const matching = getCallUsageLog()
      .filter((r) => r && r.callType === callType)
      .slice(-3)
    if (matching.length < 3) return null
    let totalBytes = 0
    let totalSec = 0
    for (const r of matching) {
      totalBytes += Number(r.bytesUsed) || 0
      totalSec += Number(r.durationSec) || 0
    }
    if (totalSec <= 0) return null
    const avgMbPerMin = (totalBytes / totalSec) * (60 / (1024 * 1024))
    const avgCallMb = avgMbPerMin * (totalSec / matching.length / 60)
    return avgCallMb <= BUDGET_PRESETS[callType].low
      ? 'Your recent calls suggest Economy is enough'
      : 'Based on your recent calls, Balanced suits you'
  })

  const isCustom = selectedKey === 'custom'
  const validCustom = Number.isFinite(customMb) && customMb > 0
  const canSave = !isCustom || validCustom

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
      video: estimateDuration('video', customMb, false),
      audio: estimateDuration('voice', customMb, false),
    }
  }

  function handleSave() {
    if (isCustom) {
      if (!validCustom) return
      setCallBudgetPref(callType, { preset: 'custom', mb: Math.round(customMb * 10) / 10 })
      onConfirm?.('custom')
      return
    }
    setCallBudgetPref(callType, {
      preset: selectedKey,
      mb: BUDGET_PRESETS[callType][selectedKey],
    })
    onConfirm?.(selectedKey)
  }

  function renderCheck(selected) {
    return selected ? (
      <span style={checkBadge} className="budget-check-pop" aria-hidden>
        <Check size={13} strokeWidth={3} />
      </span>
    ) : null
  }

  const customD = isCustom ? customDurations() : null

  return (
    <div style={overlayStyle} onClick={onCancel}>
      <div
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-label={`${callType} call data budget`}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={titleStyle}>Call data budget</div>
        <div style={subtitleStyle}>
          Pick how much data to set aside. Each option shows how long it lasts
          on video and voice calls.
        </div>

        {recommendation && (
          <div style={recChipStyle} role="status" aria-live="polite">
            <Sparkles size={13} strokeWidth={2.5} aria-hidden />
            {recommendation}
          </div>
        )}

        <div style={optionsWrapStyle} role="radiogroup" aria-label="Budget options">
          {KEYS.map((key) => {
            const mb = BUDGET_PRESETS[callType][key]
            const d = presetDurations(key)
            const selected = key === selectedKey
            return (
              <button
                key={key}
                type="button"
                className="budget-card"
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
            className="budget-card"
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
            )}
            {isCustom && customD && (
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
        </div>

        <div style={btnRowStyle}>
          <button
            type="button"
            className="budget-btn"
            onClick={handleSave}
            disabled={!canSave}
            style={canSave ? saveBtnStyle : saveBtnDisabledStyle}
          >
            Save & call
          </button>
          <button type="button" className="budget-btn" onClick={() => onConfirm?.(null)} style={skipBtnStyle}>
            Cancel / Skip
          </button>
        </div>
        <div style={skipHintStyle}>
          Skip keeps the last saved budget. With none saved, the call runs at full quality.
        </div>
      </div>
      <style>{KEYFRAMES}</style>
    </div>
  )
}
