/**
 * CallDataMeter — compact call-budget chip for the in-call UI.
 * Single-line pill: gauge icon + "8.2 MB · ~12m". No progress bar, no
 * instructional text. Renders nothing when no budget is set (standard call).
 * Never shows raw bytes or networking jargon. Read-only; fed the running
 * `bytesUsed` total, the user's `budgetMb`, and `callType` (picks the right
 * consumption rate for the estimate). No enforcement.
 *
 * Low visual weight by default (small, translucent). Only shifts to amber/red
 * when the budget is genuinely running low (≥80% used). Fades out after 3s of
 * no change and comes back on tap (or whenever the budget figures change).
 */
import { memo, useEffect, useRef, useState } from 'react'
import { Gauge } from 'lucide-react'
import {
  getCallBudgetPref,
  effectiveEstimateDuration,
} from '../lib/callBudgetPrefs'

const MB = 1024 * 1024
const HIDE_DELAY = 3000

const COLORS = {
  ok:     'rgba(255, 255, 255, 0.82)',
  warn:   '#F9AB00',
  danger: '#EF4444',
}

function statusFor(ratio) {
  if (ratio >= 0.92) return 'danger'
  if (ratio >= 0.8) return 'warn'
  return 'ok'
}

/** "~12m", "~1h 5m" — compact, no jargon. */
function formatRemainingTime(seconds) {
  const s = Math.max(0, Math.round(seconds))
  if (!Number.isFinite(seconds) || s < 60) return '~1m'
  const mins = Math.round(s / 60)
  if (mins < 60) return `~${mins}m`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem > 0 ? `~${hrs}h ${rem}m` : `~${hrs}h`
}

function CallDataMeter({
  bytesUsed = 0,
  budgetMb = null,
  callType = 'voice',
  measuredRate = null,
  style,
}) {
  const hasBudget = Number.isFinite(budgetMb) && budgetMb > 0
  const [visible, setVisible] = useState(true)
  const hideTimer = useRef(null)

  // Bring the chip back and restart the 3s fade whenever the figures change.
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
  const isWarn = status !== 'ok'

  const mbLabel = reached ? '0 MB' : `${remainingMb.toFixed(1)} MB`
  const pref = getCallBudgetPref(callType)
  const qualityHint = pref?.quality || null

  // Use measured rate if available, otherwise fall back to estimate
  let remainingSeconds
  if (measuredRate && measuredRate > 0) {
    remainingSeconds = (remainingMb * MB) / measuredRate
  } else {
    remainingSeconds = effectiveEstimateDuration(callType, remainingMb, qualityHint)
  }
  const timeLabel = formatRemainingTime(remainingSeconds)
  const a11yLabel = reached
    ? 'Call data budget reached'
    : `${mbLabel} remaining, about ${timeLabel.replace('~', '')} left`

  return (
    <button
      type="button"
      onClick={showAndSchedule}
      aria-label={a11yLabel}
      title={a11yLabel}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: isWarn ? 'rgba(11,14,20,0.78)' : 'rgba(11,14,20,0.55)',
        border: `1px solid ${isWarn ? color : 'rgba(255, 255, 255, 0.14)'}`,
        borderRadius: 999,
        padding: '5px 11px',
        boxSizing: 'border-box',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.35)',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(-6px)',
        transition: 'opacity 0.45s cubic-bezier(0.16, 1, 0.3, 1), transform 0.45s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s ease, background 0.3s ease',
        ...(style || {}),
      }}
    >
      <Gauge size={12} strokeWidth={2.4} color={color} aria-hidden />
      <span
        style={{
          fontSize: 12,
          fontWeight: isWarn ? 750 : 650,
          color,
          letterSpacing: '-0.01em',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {mbLabel}
      </span>
      <span
        style={{
          fontSize: 11,
          fontWeight: 650,
          color: isWarn ? color : 'rgba(255, 255, 255, 0.6)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        · {timeLabel}
      </span>
    </button>
  )
}

export default memo(CallDataMeter)
