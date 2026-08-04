/**
 * CallDataMeter — user-friendly Call Budget Assistant pill for the in-call UI.
 * Shows only three things: remaining budget ("18.4 MB remaining"), a progress
 * bar (green → amber at 75% → red at 90%), and estimated time left ("~14 min
 * left"). Renders nothing when no budget is set (standard call). Never shows
 * raw bytes or networking jargon. Read-only; fed the running `bytesUsed`
 * total, the user's `budgetMb`, and `callType` (picks the right consumption
 * rate for the estimate). No enforcement.
 *
 * Glass pill floats top-center. Fades out after 3s of no change and comes
 * back on tap (or whenever the budget figures change).
 */
import { memo, useEffect, useRef, useState } from 'react'
import { Gauge } from 'lucide-react'
import {
  getCallBudgetPref,
  estimateDuration,
  shouldAutoLowData,
} from '../lib/callBudgetPrefs'

const MB = 1024 * 1024
const HIDE_DELAY = 3000

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

const wrapStyle = {
  position: 'relative',
  display: 'flex',
  justifyContent: 'center',
  width: '100%',
  maxWidth: 230,
  boxSizing: 'border-box',
  flexShrink: 0,
}

const pillStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 7,
  background: 'rgba(10, 18, 13, 0.5)',
  border: '1px solid rgba(255, 255, 255, 0.14)',
  borderRadius: 999,
  padding: '9px 16px',
  width: '100%',
  boxSizing: 'border-box',
  backdropFilter: 'blur(14px)',
  WebkitBackdropFilter: 'blur(14px)',
  boxShadow: '0 6px 24px rgba(0, 0, 0, 0.35)',
  pointerEvents: 'none',
  textAlign: 'left',
  transition: 'opacity 0.35s ease, transform 0.35s ease',
}

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  flexWrap: 'wrap',
}

const labelStyle = {
  fontSize: 13,
  fontWeight: 700,
  color: '#fff',
  letterSpacing: '0.01em',
}

const timeStyle = {
  fontSize: 11.5,
  fontWeight: 600,
  color: 'rgba(255, 255, 255, 0.62)',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
}

const trackStyle = {
  display: 'block',
  width: '100%',
  height: 4,
  borderRadius: 2,
  background: 'rgba(255, 255, 255, 0.18)',
  overflow: 'hidden',
}

const fillStyle = {
  display: 'block',
  height: '100%',
  borderRadius: 2,
  transition: 'width 0.4s ease, background 0.4s ease',
}

function CallDataMeter({
  bytesUsed = 0,
  budgetMb = null,
  callType = 'voice',
  style,
}) {
  const hasBudget = Number.isFinite(budgetMb) && budgetMb > 0
  const [visible, setVisible] = useState(true)
  const hideTimer = useRef(null)

  // Bring the pill back and restart the 3s fade whenever the figures change.
  useEffect(() => {
    if (!hasBudget) return undefined
    const show = setTimeout(() => {
      setVisible(true)
      hideTimer.current = setTimeout(() => setVisible(false), HIDE_DELAY)
    }, 0)
    return () => {
      clearTimeout(show)
      if (hideTimer.current) {
        clearTimeout(hideTimer.current)
        hideTimer.current = null
      }
    }
  }, [bytesUsed, budgetMb, hasBudget])

  useEffect(
    () => () => {
      if (hideTimer.current) clearTimeout(hideTimer.current)
    },
    []
  )

  function showAndSchedule() {
    setVisible(true)
    if (hideTimer.current) clearTimeout(hideTimer.current)
    hideTimer.current = setTimeout(() => setVisible(false), HIDE_DELAY)
  }

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
    <div style={{ ...wrapStyle, ...(style || {}) }}>
      <button
        type="button"
        aria-label="Show call data usage"
        onClick={showAndSchedule}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 56,
          background: 'transparent',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
        }}
      />
      <div
        style={{
          ...pillStyle,
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(-8px)',
        }}
        title={label}
        aria-label={`${label}, ${timeLabel}`}
      >
        <div style={rowStyle}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Gauge size={14} strokeWidth={2.2} color={color} aria-hidden />
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
    </div>
  )
}

export default memo(CallDataMeter)
