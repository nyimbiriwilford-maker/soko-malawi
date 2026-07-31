import { useState } from 'react'
import {
  BUDGET_PRESETS,
  getCallBudgetPref,
  setCallBudgetPref,
  estimateDuration,
  shouldAutoLowData,
} from '../lib/callBudgetPrefs'

const KEYS = ['low', 'medium', 'high']

const PALETTE = {
  backdrop: 'rgba(9, 12, 10, 0.72)',
  surface: '#161b17',
  surfaceRaised: '#1e2520',
  border: '#2a342c',
  text: '#e8efe9',
  textDim: '#93a39a',
  green: '#0F9D58',
  greenDark: '#0b7a43',
  yellow: '#F9AB00',
}

function formatDuration(seconds) {
  const total = Math.max(0, Math.round(Number(seconds) || 0))
  if (total < 60) return `${total}s`
  const mins = Math.floor(total / 60)
  const secs = total % 60
  return secs ? `${mins}m ${secs}s` : `${mins}m`
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
  width: 'min(360px, 100%)',
  background: PALETTE.surface,
  border: `1px solid ${PALETTE.border}`,
  borderRadius: 18,
  padding: 22,
  boxShadow: '0 24px 60px rgba(0,0,0,0.55)',
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
  gap: 10,
  marginBottom: 18,
}

const optionStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  background: PALETTE.surfaceRaised,
  border: `1px solid ${PALETTE.border}`,
  borderRadius: 12,
  padding: '12px 14px',
  cursor: 'pointer',
  color: PALETTE.text,
  textAlign: 'left',
  fontFamily: 'inherit',
  transition: 'border-color 0.15s ease, background 0.15s ease',
}

const optionSelectedStyle = {
  borderColor: PALETTE.green,
  background: 'rgba(15, 157, 88, 0.14)',
}

const optionNameStyle = {
  fontSize: 15,
  fontWeight: 700,
  flex: 1,
}

const optionMbStyle = {
  fontSize: 14,
  fontWeight: 700,
  color: PALETTE.yellow,
  marginRight: 14,
}

const optionDurStyle = {
  fontSize: 12,
  color: PALETTE.textDim,
  whiteSpace: 'nowrap',
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
}

const skipHintStyle = {
  marginTop: 12,
  color: PALETTE.textDim,
  fontSize: 11.5,
  lineHeight: 1.45,
}

export default function CallBudgetSelector({ callType, onConfirm, onCancel }) {
  const saved = getCallBudgetPref(callType)
  const [selectedKey, setSelectedKey] = useState(
    saved && KEYS.includes(saved.preset) ? saved.preset : 'medium'
  )

  function handleSave() {
    setCallBudgetPref(callType, {
      preset: selectedKey,
      mb: BUDGET_PRESETS[callType][selectedKey],
    })
    onConfirm?.(selectedKey)
  }

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
          Pick how much data this {callType} call may use before we cap quality.
        </div>

        <div style={optionsWrapStyle}>
          {KEYS.map((key) => {
            const mb = BUDGET_PRESETS[callType][key]
            const seconds = estimateDuration(callType, mb, shouldAutoLowData(callType, key))
            const selected = key === selectedKey
            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedKey(key)}
                style={selected ? { ...optionStyle, ...optionSelectedStyle } : optionStyle}
                aria-pressed={selected}
              >
                <span style={optionNameStyle}>{key[0].toUpperCase() + key.slice(1)}</span>
                <span style={optionMbStyle}>{mb} MB</span>
                <span style={optionDurStyle}>~{formatDuration(seconds)}</span>
              </button>
            )
          })}
        </div>

        <div style={btnRowStyle}>
          <button type="button" onClick={handleSave} style={saveBtnStyle}>
            Save & call
          </button>
          <button type="button" onClick={() => onConfirm?.(null)} style={skipBtnStyle}>
            Cancel / Skip
          </button>
        </div>
        <div style={skipHintStyle}>
          Skip keeps the last saved budget. With none saved, the call runs at full quality.
        </div>
      </div>
    </div>
  )
}
