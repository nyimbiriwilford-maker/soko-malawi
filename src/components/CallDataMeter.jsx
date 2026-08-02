/**
 * CallDataMeter — user-friendly Call Budget Assistant pill for the in-call UI.
 * Speaks plain language: remaining budget ("28.4 MB remaining") and estimated
 * time left ("~12 min left"). Never shows raw bytes or networking jargon.
 * Read-only; fed the running `bytesUsed` total, the user's `budgetMb`, and
 * `callType` (picks the right consumption rate for the estimate). No enforcement.
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

/** Friendly data figure — MB only, never KB/bytes. */
function formatFriendlyMb(mb) {
  if (mb <= 0) return '0 MB'
  if (mb < 0.1) return '0.1 MB'
  return `${mb.toFixed(1)} MB`
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
  const used = Number.isFinite(bytesUsed) && bytesUsed > 0 ? bytesUsed : 0
  const hasBudget = Number.isFinite(budgetMb) && budgetMb > 0

  let label
  let timeLabel = null
  let pct = 0
  let status = 'ok'
  let reached

  if (hasBudget) {
    const budgetBytes = budgetMb * MB
    const ratio = Math.min(1, used / budgetBytes)
    const remainingMb = Math.max(0, budgetMb - used / MB)
    reached = remainingMb < 0.1
    status = reached ? 'danger' : statusFor(ratio)

    if (reached) {
      label = 'Budget reached'
    } else {
      label = `${remainingMb.toFixed(1)} MB remaining`
      const pref = getCallBudgetPref(callType)
      const lowDataMode = pref ? shouldAutoLowData(callType, pref.preset) : false
      const remainingSeconds = estimateDuration(callType, remainingMb, lowDataMode)
      timeLabel = `${formatRemainingTime(remainingSeconds)} left`
    }
    pct = Math.min(100, Math.max(0, ratio * 100))
  } else {
    label = `You've used ${formatFriendlyMb(used / MB)}`
  }

  const color = COLORS[status]

  return (
    <div
      style={{ ...pillStyle, ...(style || {}) }}
      title={label}
      aria-label={hasBudget ? `${label}${timeLabel ? `, ${timeLabel}` : ''}` : label}
    >
      <div style={rowStyle}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Gauge size={15} strokeWidth={2.2} color={color} aria-hidden />
          <span style={labelStyle}>{label}</span>
        </span>
        {timeLabel ? <span style={timeStyle}>{timeLabel}</span> : null}
      </div>
      {hasBudget && (
        <span
          style={trackStyle}
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
        >
          <span style={{ ...fillStyle, width: `${pct}%`, background: color }} />
        </span>
      )}
    </div>
  )
}

export default memo(CallDataMeter)
