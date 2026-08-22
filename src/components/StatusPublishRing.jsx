/**
 * StatusPublishRing — floating progress ring for background status publishing.
 *
 * Renders nothing until a background publish is running. Shows a compact ring
 * with a progress arc + phase label (Trimming → Uploading → Publishing) pinned
 * to the top-right corner of the bottom nav so it never shades the content. Flips
 * to a checkmark once published; the store auto-clears the success state so it
 * disappears by itself. It can be dismissed any time — tapping the pill or its
 * ✕ button hides it without cancelling the posting.
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

const SIZE = 24
const R = (SIZE - 6) / 2
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
      aria-label={`Status publish: ${label}. Tap to dismiss.`}
      className="spr-pill"
    >
      <style>{`
        .spr-pill {
          position: fixed;
          right: 8px;
          bottom: calc(70px + env(safe-area-inset-bottom, 0px));
          z-index: 12000;
          display: flex;
          align-items: center;
          gap: 6px;
          max-width: min(160px, calc(100vw - 40px));
          padding: 3px 5px 3px 3px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.14);
          background: rgba(10,18,14,0.92);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          box-shadow: 0 8px 26px rgba(0,0,0,0.4);
          font-family: 'DM Sans', system-ui, sans-serif;
          cursor: pointer;
          color: #fff;
          animation: sprPop 0.25s cubic-bezier(0.16,1,0.3,1);
        }
        @media (min-width: 769px) {
          .spr-pill { right: 16px; bottom: 16px; }
        }
        .spr-ring {
          position: relative;
          width: ${SIZE}px;
          height: ${SIZE}px;
          flex-shrink: 0;
          display: grid;
          place-items: center;
        }
        .spr-glyph {
          position: absolute;
          inset: 0;
          display: grid;
          place-items: center;
        }
        .spr-label {
          font-size: 10px;
          font-weight: 700;
          line-height: 1.1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .spr-x {
          flex-shrink: 0;
          width: 15px;
          height: 15px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          font-size: 8px;
          font-weight: 700;
          color: rgba(255,255,255,0.75);
          background: rgba(255,255,255,0.1);
          line-height: 1;
        }
        @keyframes sprPop {
          from { opacity: 0; transform: translateY(10px) scale(0.92); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>

      <span className="spr-ring">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke="rgba(255,255,255,0.16)"
            strokeWidth="3"
          />
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            fill="none"
            stroke={arcColor}
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={CIRC}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            style={{ transition: 'stroke-dashoffset 0.3s linear, stroke 0.2s ease' }}
          />
        </svg>
        {isError ? (
          <span className="spr-glyph" style={{ color: '#f87171', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>✕</span>
        ) : isDone ? (
          <span className="spr-glyph" style={{ color: '#22c55e', fontSize: 10, fontWeight: 800, lineHeight: 1 }}>✓</span>
        ) : null}
      </span>

      <span className="spr-label">{label}</span>

      <span
        className="spr-x"
        role="img"
        aria-hidden="true"
      >
        ✕
      </span>
    </button>
  )
}
