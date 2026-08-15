/**
 * StatusPublishRing — floating progress ring for background status publishing.
 *
 * Renders nothing until a background publish is running. Shows a small circle
 * with a progress arc + phase label (Trimming → Uploading → Publishing) and
 * flips to a checkmark once published. The store auto-clears the success state
 * so the ring disappears by itself. Tapping the ring dismisses it without
 * cancelling the posting.
 */
import { useEffect, useState } from 'react'
import {
  getStatusPublishState,
  subscribeStatusPublish,
  dismissStatusPublish,
} from '../lib/statusPublishStore'

const PHASE_LABELS = {
  preparing: 'Preparing…',
  trimming: 'Trimming…',
  uploading: 'Uploading…',
  publishing: 'Publishing…',
  success: 'Published',
  error: 'Failed',
}

const SIZE = 58
const R = (SIZE - 10) / 2
const CIRC = 2 * Math.PI * R

export default function StatusPublishRing() {
  const [state, setState] = useState(getStatusPublishState)

  useEffect(() => subscribeStatusPublish(setState), [])

  if (!state) return null

  const { active, phase, pct, error } = state
  const pctVal = Math.max(0, Math.min(100, typeof pct === 'number' ? pct : 0))
  const isError = !!error || phase === 'error'
  const isDone = !active && !isError

  const label = isError
    ? (state.message || PHASE_LABELS.error)
    : (PHASE_LABELS[phase] || PHASE_LABELS.publishing)

  const arcColor = isError ? '#f87171' : isDone ? '#22c55e' : '#0F9D58'
  const dashOffset = CIRC * (1 - pctVal / 100)

  return (
    <button
      type="button"
      onClick={dismissStatusPublish}
      aria-label={`Status publish: ${label}`}
      style={{
        position: 'fixed',
        bottom: 'calc(88px + env(safe-area-inset-bottom, 0px))',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 12000,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '7px 16px 7px 7px',
        borderRadius: 999,
        border: '1px solid rgba(255,255,255,0.14)',
        background: 'rgba(10,18,14,0.94)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.45)',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        cursor: 'pointer',
        animation: 'sprPop 0.25s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      <style>{`
        @keyframes sprPop {
          from { opacity: 0; transform: translateX(-50%) translateY(12px) scale(0.92); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
        }
        @keyframes sprSpin { to { transform: rotate(360deg); } }
      `}</style>

      <span
        style={{
          position: 'relative',
          width: SIZE,
          height: SIZE,
          flexShrink: 0,
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} style={{ position: 'absolute', inset: 0 }}>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.14)"
            strokeWidth="5"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={arcColor}
            strokeWidth="5"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.2s ease' }}
          />
        </svg>

        {isError ? (
          <span style={{ color: '#f87171', fontSize: 20, fontWeight: 800, lineHeight: 1 }}>✕</span>
        ) : isDone ? (
          <span style={{ color: '#22c55e', fontSize: 20, fontWeight: 800, lineHeight: 1 }}>✓</span>
        ) : (
          <span
            style={{
              width: 16,
              height: 16,
              borderRadius: '50%',
              border: '2px solid rgba(255,255,255,0.28)',
              borderTopColor: '#22c55e',
              animation: 'sprSpin 0.7s linear infinite',
            }}
          />
        )}
      </span>

      <span style={{ fontSize: 13, fontWeight: 750, color: '#fff', whiteSpace: 'nowrap' }}>
        {label}
      </span>
    </button>
  )
}
