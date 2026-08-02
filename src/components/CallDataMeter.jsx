/**
 * CallDataMeter — user-friendly Call Budget Assistant pill for the in-call UI.
 * Shows only three things: remaining budget ("18.4 MB remaining"), a progress
 * bar (green → amber at 75% → red at 90%), and estimated time left ("~14 min
 * left"). Renders nothing when no budget is set (standard call). Never shows
 * raw bytes or networking jargon. Read-only; fed the running `bytesUsed`
 * total, the user's `budgetMb`, and `callType` (picks the right consumption
 * rate for the estimate). No enforcement.
 */
import { memo } from 'react'
import { Gauge } from 'lucide-react'
import {
  getCallBudgetPref,
  estimateDuration,
  shouldAutoLowData,
} from '../lib/callBudgetPrefs'

const MB = 1024 * 1024

const COLORS = {
  ok: '#34D399',
  warn: '#F9AB00',
  danger: '#EF4444',
}

function statusFor(ratio) {
  if (ratio >= 0.9) return 'danger'
  if (ratio >= 0.75) return 'warn'
  return 'ok'
}

/** "~12 min", "~1 hr 5 min" — friendly, no jargon. */
function formatRemainingTime(seconds) {
  const s = Math.max(0, Math.round(seconds))
  if (!Number.isFinite(seconds) || s < 60) return '~1 min'
  const mins = Math.round(s / 60)
  if (mins < 60) return `~${mins} min`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `~${hrs} hr ${rem} min` : `~${hrs} hr`
}

const pillStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  background: 'rgba(0, 0, 0, 0.55)',
  border: '1px solid rgba(255, 255, 255, 0.14)',
  borderRadius: 16,
  padding: '10px 16px',
  width: '100%',
  maxWidth: 244,
  boxSizing: 'border-box',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
  pointerEvents: 'none',
  flexShrink: 0,
  textAlign: 'left',
}

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
}

const labelStyle = {
  fontSize: 14,
  fontWeight: 700,
  color: '#fff',
  letterSpacing: '0.01em',
}

const timeStyle = {
  fontSize: 12,
  fontWeight: 600,
  color: 'rgba(255, 255, 255, 0.62)',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}

const trackStyle = {
  width: '100%',
  height: 6,
  borderRadius: 3,
  background: 'rgba(255, 255, 255, 0.2)',
  overflow: 'hidden',
}

const fillStyle = {
  display: 'block',
  height: '100%',
  borderRadius: 3,
  transition: 'width 0.4s ease, background 0.4s ease',
}

function CallDataMeter({
  bytesUsed = 0,
  budgetMb = null,
  callType = 'voice',
  style,
}) {
  const hasBudget = Number.isFinite(budgetMb) && budgetMb > 0
  if (!hasBudget) return null

  const used = Number.isFinite(bytesUsed) && bytesUsed > 0 ? bytesUsed : 0
  const budgetBytes = budgetMb * MB
  const ratio = Math.min(1, used / budgetBytes)
  const remainingMb = Math.max(0, budgetMb - used / MB)
  const reached = remainingMb < 0.1
  const status = reached ? 'danger' : statusFor(ratio)
  const color = COLORS[status]
  const pct = Math.min(100, Math.max(0, ratio * 100))

  const label = reached ? 'Budget reached' : `${remainingMb.toFixed(1)} MB remaining`
  const pref = getCallBudgetPref(callType)
  const lowDataMode = pref ? shouldAutoLowData(callType, pref.preset) : false
  const remainingSeconds = estimateDuration(callType, remainingMb, lowDataMode)
  const timeLabel = `${formatRemainingTime(remainingSeconds)} left`

  return (
    <div
      style={{ ...pillStyle, ...(style || {}) }}
      title={label}
      aria-label={`${label}, ${timeLabel}`}
    >
      <div style={rowStyle}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Gauge size={15} strokeWidth={2.2} color={color} aria-hidden />
          <span style={labelStyle}>{label}</span>
        </span>
        <span style={timeStyle}>{timeLabel}</span>
      </div>
      <span
        style={trackStyle}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(pct)}
      >
        <span style={{ ...fillStyle, width: `${pct}%`, background: color }} />
      </span>
    </div>
  )
}

export default memo(CallDataMeter)
