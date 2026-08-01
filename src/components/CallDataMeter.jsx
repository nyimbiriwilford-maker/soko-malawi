/**
 * CallDataMeter — compact live data-usage pill for the in-call UI.
 * Read-only display fed the running `bytesUsed` total (sampled from the
 * call's RTCPeerConnection by the call shell). Pass `budgetMb` (from
 * CallBudgetSelector) to render usage against the pre-call budget with a
 * color-shifting progress bar. No enforcement.
 */
import { ArrowDownUp } from 'lucide-react'

export function formatDataBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 KB'
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function usageColor(ratio) {
  if (ratio >= 1) return '#F87171'
  if (ratio >= 0.75) return '#FBBF24'
  return '#34D399'
}

const pillStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  background: 'rgba(12, 18, 14, 0.6)',
  borderRadius: 999,
  padding: '5px 11px',
  backdropFilter: 'blur(8px)',
  WebkitBackdropFilter: 'blur(8px)',
  pointerEvents: 'none',
  flexShrink: 0,
}

const textStyle = {
  fontSize: 11,
  fontWeight: 700,
  color: '#fff',
  fontVariantNumeric: 'tabular-nums',
  letterSpacing: 0.2,
  whiteSpace: 'nowrap',
}

const trackStyle = {
  width: 40,
  height: 3,
  borderRadius: 2,
  background: 'rgba(255, 255, 255, 0.28)',
  overflow: 'hidden',
  flexShrink: 0,
}

const fillStyle = {
  display: 'block',
  height: '100%',
  borderRadius: 2,
  transition: 'width 0.4s ease, background 0.4s ease',
}

export default function CallDataMeter({
  bytesUsed = 0,
  budgetMb = 0,
  style,
}) {
  const used = Number.isFinite(bytesUsed) && bytesUsed > 0 ? bytesUsed : 0
  const budgetBytes = Number.isFinite(budgetMb) && budgetMb > 0 ? budgetMb * 1024 * 1024 : 0

  const hasBudget = budgetBytes > 0
  const ratio = hasBudget ? used / budgetBytes : 0
  const color = hasBudget ? usageColor(ratio) : '#34D399'
  const pct = Math.min(100, Math.max(0, ratio * 100))

  const usedLabel = formatDataBytes(used)
  const label = hasBudget ? `${usedLabel} / ${formatDataBytes(budgetBytes)}` : usedLabel

  return (
    <div
      style={{ ...pillStyle, ...(style || {}) }}
      title="Data used this call"
    >
      <ArrowDownUp size={12} strokeWidth={2.2} color={color} aria-hidden />
      <span style={textStyle}>{label}</span>
      {hasBudget && (
        <span style={trackStyle} aria-hidden>
          <span style={{ ...fillStyle, width: `${pct}%`, background: color }} />
        </span>
      )}
    </div>
  )
}

