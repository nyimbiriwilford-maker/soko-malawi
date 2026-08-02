/**
 * Shared modern call UI primitives (Lucide icons + glass controls).
 * Used by CallOverlay, GlobalCallListener, ChatCallHost.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Phone,
  PhoneOff,
  PhoneIncoming,
  PhoneCall,
  Video,
  VideoOff,
  Mic,
  MicOff,
  SwitchCamera,
  AlertTriangle,
  Loader2,
  Circle,
  Minimize2,
} from 'lucide-react'
import CallDataMeter from '../CallDataMeter'

export const CALL_GREEN = '#0F9D58'
export const CALL_GREEN_SOFT = '#22a05e'
export const CALL_RED = '#ef4444'
export const CALL_AMBER = '#F9AB00'

export function CallIcon({ name, size = 22, color = 'currentColor', strokeWidth = 2 }) {
  const props = { size, strokeWidth, color, 'aria-hidden': true }
  switch (name) {
    case 'phone': return <Phone {...props} />
    case 'phoneOff': return <PhoneOff {...props} />
    case 'phoneIncoming': return <PhoneIncoming {...props} />
    case 'phoneCall': return <PhoneCall {...props} />
    case 'video': return <Video {...props} />
    case 'videoOff': return <VideoOff {...props} />
    case 'mic': return <Mic {...props} />
    case 'micOff': return <MicOff {...props} />
    case 'switchCamera': return <SwitchCamera {...props} />
    case 'alert': return <AlertTriangle {...props} />
    case 'loader': return <Loader2 {...props} className="call-spin" />
    case 'live': return <Circle {...props} fill={color} strokeWidth={0} size={size * 0.55} />
    default: return <Phone {...props} />
  }
}

export function CallAvatar({ url, initial, size = 96, pulse = false }) {
  return (
    <div
      style={{
        position: 'relative',
        width: size,
        height: size,
        margin: '0 auto',
        flexShrink: 0,
      }}
    >
      {pulse && (
        <>
          <span style={{ ...rippleStyle, animationDelay: '0s' }} />
          <span style={{ ...rippleStyle, animationDelay: '0.55s' }} />
        </>
      )}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: size,
          height: size,
          borderRadius: '50%',
          overflow: 'hidden',
          background: `linear-gradient(145deg, ${CALL_GREEN_SOFT}, ${CALL_GREEN})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 12px 40px rgba(15,157,88,0.35), 0 0 0 3px rgba(255,255,255,0.12)',
        }}
      >
        {url ? (
          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: size * 0.36, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>
            {(initial || '?').slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  )
}

/** Circular glass control button */
export function CallControlBtn({
  onClick,
  label,
  variant = 'glass', // glass | danger | success | dangerActive
  disabled = false,
  size = 56,
  children,
  ariaLabel,
}) {
  const bg = {
    glass: 'rgba(255,255,255,0.14)',
    danger: CALL_RED,
    success: CALL_GREEN,
    dangerActive: 'rgba(239,68,68,0.95)',
    successPulse: CALL_GREEN,
  }[variant] || 'rgba(255,255,255,0.14)'

  const shadow = {
    glass: '0 4px 20px rgba(0,0,0,0.35)',
    danger: '0 8px 28px rgba(239,68,68,0.55)',
    success: '0 8px 28px rgba(15,157,88,0.5)',
    dangerActive: '0 4px 20px rgba(239,68,68,0.45)',
    successPulse: '0 8px 28px rgba(15,157,88,0.5)',
  }[variant]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, minWidth: 64 }}>
      <button
        type="button"
        className="call-ctrl"
        onClick={onClick}
        disabled={disabled}
        aria-label={ariaLabel || label}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          border: variant === 'glass' ? '1px solid rgba(255,255,255,0.18)' : 'none',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: bg,
          color: '#fff',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: shadow,
          opacity: disabled ? 0.55 : 1,
          transition: 'transform 0.15s ease, background 0.2s ease, box-shadow 0.2s ease',
          animation: variant === 'successPulse' ? 'callPulse 1.6s ease-in-out infinite' : undefined,
        }}
      >
        {children}
      </button>
      {label ? (
        <span style={{
          color: 'rgba(255,255,255,0.72)',
          fontSize: 11,
          fontWeight: 600,
          letterSpacing: '0.02em',
        }}>
          {label}
        </span>
      ) : null}
    </div>
  )
}

export function CallStatusPill({ children, live = false }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        background: 'rgba(0,0,0,0.4)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 999,
        padding: '7px 16px',
      }}
    >
      {live && (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#4ade80',
            boxShadow: '0 0 0 3px rgba(74,222,128,0.25)',
            animation: 'callBlink 1.4s ease infinite',
          }}
        />
      )}
      <span style={{
        fontSize: 14,
        color: 'rgba(255,255,255,0.95)',
        fontWeight: 650,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '0.02em',
      }}>
        {children}
      </span>
    </div>
  )
}

export function CallTypeBadge({ isVideo }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        background: 'rgba(255,255,255,0.1)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 999,
        padding: '5px 12px',
        color: 'rgba(255,255,255,0.8)',
        fontSize: 12,
        fontWeight: 650,
      }}
    >
      <CallIcon name={isVideo ? 'video' : 'phone'} size={14} color="rgba(255,255,255,0.85)" />
      {isVideo ? 'Video' : 'Voice'}
    </div>
  )
}

/** Full-screen dim backdrop for ring / incoming */
export function CallShell({ children, zIndex = 3000 }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        background: 'radial-gradient(ellipse 80% 60% at 50% 30%, #143d28 0%, #0a1410 55%, #050a08 100%)',
        overflow: 'hidden',
      }}
    >
      {/* Soft ambient orbs */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background:
          'radial-gradient(circle at 20% 80%, rgba(15,157,88,0.18) 0%, transparent 40%),' +
          'radial-gradient(circle at 80% 20%, rgba(26,122,74,0.12) 0%, transparent 35%)',
      }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 420, padding: '32px 24px', textAlign: 'center' }}>
        {children}
      </div>
      <style>{CALL_KEYFRAMES}</style>
    </div>
  )
}

export function CallTitle({ children }) {
  return (
    <h2 style={{
      margin: '20px 0 8px',
      fontSize: 26,
      fontWeight: 800,
      color: '#fff',
      letterSpacing: '-0.03em',
      lineHeight: 1.2,
    }}>
      {children}
    </h2>
  )
}

export function CallSubtitle({ children }) {
  return (
    <p style={{
      margin: '0 0 8px',
      fontSize: 15,
      color: 'rgba(255,255,255,0.55)',
      fontWeight: 500,
      lineHeight: 1.4,
    }}>
      {children}
    </p>
  )
}

/** In-call bottom control bar */
export function InCallControls({
  isVideo,
  isMuted,
  isCamOff,
  onMute,
  onCam,
  onHangUp,
  onFlip,
  onMinimize,
  onSwitchType,
  switching = false,
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: 10,
        width: '100%',
        maxWidth: 500,
        padding: '0 12px',
        boxSizing: 'border-box',
      }}
    >
      {onMinimize && (
        <CallControlBtn
          label="Browse"
          variant="glass"
          onClick={onMinimize}
          ariaLabel="Minimize call and browse app"
        >
          <Minimize2 size={22} color="#fff" strokeWidth={2} aria-hidden />
        </CallControlBtn>
      )}

      <CallControlBtn
        label={isMuted ? 'Unmute' : 'Mute'}
        variant={isMuted ? 'dangerActive' : 'glass'}
        onClick={onMute}
        ariaLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
      >
        <CallIcon name={isMuted ? 'micOff' : 'mic'} size={22} color="#fff" />
      </CallControlBtn>

      {isVideo && (
        <CallControlBtn
          label={isCamOff ? 'Cam on' : 'Camera'}
          variant={isCamOff ? 'dangerActive' : 'glass'}
          onClick={onCam}
          ariaLabel={isCamOff ? 'Turn camera on' : 'Turn camera off'}
        >
          <CallIcon name={isCamOff ? 'videoOff' : 'video'} size={22} color="#fff" />
        </CallControlBtn>
      )}

      {onSwitchType && (
        <CallControlBtn
          label={switching ? 'Switching…' : (isVideo ? 'Switch to Audio' : 'Switch to Video')}
          variant="glass"
          disabled={switching}
          onClick={onSwitchType}
          ariaLabel={switching ? 'Switching call type' : (isVideo ? 'Switch to audio only' : 'Switch to video')}
        >
          <CallIcon name={switching ? 'loader' : (isVideo ? 'phone' : 'video')} size={22} color="#fff" />
        </CallControlBtn>
      )}

      <CallControlBtn
        label="End"
        variant="danger"
        size={68}
        onClick={onHangUp}
        ariaLabel="End call"
      >
        <CallIcon name="phoneOff" size={26} color="#fff" />
      </CallControlBtn>

      {isVideo && (
        <CallControlBtn
          label="Flip"
          variant="glass"
          onClick={onFlip}
          ariaLabel="Switch camera"
        >
          <CallIcon name="switchCamera" size={22} color="#fff" />
        </CallControlBtn>
      )}
    </div>
  )
}

/** Keep object/callback refs stable across parent re-renders (duration ticks). */
function useStableMediaRef(videoRef) {
  const holder = useRef(videoRef)
  holder.current = videoRef
  return useCallback((el) => {
    const r = holder.current
    if (typeof r === 'function') r(el)
    else if (r && typeof r === 'object') r.current = el
  }, [])
}

const BUDGET_TOASTS = {
  low: {
    text: 'Running low on data',
    bg: 'rgba(249, 171, 0, 0.18)',
    border: 'rgba(249, 171, 0, 0.55)',
    color: '#ffe08a',
  },
  quality: {
    text: 'Video quality reduced to save data',
    bg: 'rgba(59, 130, 246, 0.18)',
    border: 'rgba(59, 130, 246, 0.5)',
    color: '#bfdbfe',
  },
}

/** Subtle in-call toast for the low-budget warning / quality steps. */
export function BudgetToast({ level, style }) {
  const toast = BUDGET_TOASTS[level] || BUDGET_TOASTS.low
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 132,
        zIndex: 3100,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 20px',
        pointerEvents: 'none',
        ...(style || {}),
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 8,
          background: toast.bg,
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          border: `1px solid ${toast.border}`,
          borderRadius: 999,
          padding: '10px 18px',
          color: toast.color,
          fontSize: 13,
          fontWeight: 650,
          letterSpacing: '0.01em',
          boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
          animation: 'budgetToastIn 0.3s ease',
          maxWidth: '100%',
          textAlign: 'center',
        }}
      >
        {toast.text}
      </div>
    </div>
  )
}

const extendBtnStyle = {
  flex: 1,
  background: 'rgba(15, 157, 88, 0.16)',
  border: '1px solid rgba(15, 157, 88, 0.5)',
  borderRadius: 10,
  padding: '10px 0',
  color: '#a7f3d0',
  fontSize: 14,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'transform 0.15s ease, background 0.2s ease',
}

/** Non-blocking in-call panel shown at 90%: quick budget extensions. */
export function BudgetExtendPanel({ onExtend }) {
  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 132,
        zIndex: 3100,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 20px',
      }}
    >
      <div
        style={{
          width: 'min(340px, 100%)',
          boxSizing: 'border-box',
          background: '#161b17',
          border: '1px solid #2a342c',
          borderRadius: 16,
          padding: '12px 14px',
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          textAlign: 'center',
          animation: 'budgetToastIn 0.3s ease',
        }}
      >
        <div style={{ color: '#ffe08a', fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
          Running low on data — extend?
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          {[5, 10, 20].map((mb) => (
            <button
              key={mb}
              type="button"
              className="call-btn"
              onClick={() => onExtend(mb)}
              aria-label={`Extend call budget by ${mb} MB`}
              style={extendBtnStyle}
            >
              +{mb} MB
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Countdown toast shown at 98% with the +10 MB escape button. */
export function BudgetCountdownToast({ seconds, onExtend }) {
  return (
    <div
      role="alert"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 132,
        zIndex: 3100,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(239, 68, 68, 0.16)',
          border: '1px solid rgba(239, 68, 68, 0.55)',
          borderRadius: 999,
          padding: '8px 10px 8px 18px',
          color: '#fecaca',
          fontSize: 13,
          fontWeight: 700,
          boxShadow: '0 8px 28px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          maxWidth: '100%',
          animation: 'budgetToastIn 0.3s ease',
        }}
      >
        <span style={{ fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
          Call ends in {seconds}...
        </span>
        <button
          type="button"
          className="call-btn"
          onClick={onExtend}
          aria-label="Extend call budget by 10 MB"
          style={{
            background: CALL_RED,
            border: 'none',
            borderRadius: 999,
            padding: '7px 14px',
            color: '#fff',
            fontSize: 12,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
            transition: 'transform 0.15s ease',
          }}
        >
          Extend +10 MB
        </button>
      </div>
    </div>
  )
}

/** Fullscreen in-call chrome (shared layout) */
export function InCallStage({
  isVideo,
  name,
  avatarUrl,
  avatarInitial,
  durationLabel,
  remoteVideoRef,
  localVideoRef,
  warning,
  controls,
  bytesUsed,
  budgetMb,
  zIndex = 3000,
}) {
  // Stable callback refs — inline parent callbacks remount media every second
  const setRemoteVideo = useStableMediaRef(remoteVideoRef)
  const setLocalVideo = useStableMediaRef(localVideoRef)

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        background: '#0a0a0a',
        overflow: 'hidden',
      }}
    >
      <video
        ref={setRemoteVideo}
        autoPlay
        playsInline
        className="call-remote-pip-source"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          background: isVideo
            ? '#111'
            : 'radial-gradient(ellipse at center, #1a3328 0%, #0a0f0c 70%)',
        }}
      />

      {/* Gradients */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 240,
        background: 'linear-gradient(to top, rgba(0,0,0,0.92) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 140,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.65) 0%, transparent 100%)',
        pointerEvents: 'none',
      }} />

      {isVideo ? (
        <div style={{
          position: 'absolute',
          top: 20,
          right: 16,
          width: 96,
          height: 136,
          borderRadius: 16,
          overflow: 'hidden',
          border: '2px solid rgba(255,255,255,0.22)',
          background: '#111',
          boxShadow: '0 8px 32px rgba(0,0,0,0.55)',
          zIndex: 2,
        }}>
          <video
            ref={setLocalVideo}
            autoPlay
            playsInline
            muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>
      ) : (
        <video ref={setLocalVideo} autoPlay playsInline muted style={{ display: 'none' }} />
      )}

      {warning ? (
        <div style={{
          position: 'absolute',
          top: 16,
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          zIndex: 3,
          padding: '0 16px',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(249,171,0,0.16)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(249,171,0,0.4)',
            borderRadius: 12,
            padding: '8px 14px',
            color: '#ffe08a',
            fontSize: 12,
            fontWeight: 650,
            maxWidth: 360,
          }}>
            <CallIcon name="alert" size={15} color="#ffe08a" />
            {warning}
          </div>
        </div>
      ) : null}

      <div style={{
        position: 'absolute',
        top: warning ? 64 : 36,
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 10,
        zIndex: 2,
        padding: '0 20px',
      }}>
        {!isVideo && (
          <>
            <CallAvatar url={avatarUrl} initial={avatarInitial} size={88} pulse={false} />
            <div style={{
              fontSize: 22,
              fontWeight: 750,
              color: '#fff',
              textShadow: '0 2px 12px rgba(0,0,0,0.6)',
              letterSpacing: '-0.02em',
            }}>
              {name}
            </div>
          </>
        )}
        {isVideo && name ? (
          <div style={{
            fontSize: 16,
            fontWeight: 700,
            color: 'rgba(255,255,255,0.92)',
            textShadow: '0 2px 8px rgba(0,0,0,0.6)',
          }}>
            {name}
          </div>
        ) : null}
        <CallStatusPill live>{durationLabel}</CallStatusPill>
        {bytesUsed !== undefined && (
          <CallDataMeter
            bytesUsed={bytesUsed}
            budgetMb={budgetMb || 0}
            callType={isVideo ? 'video' : 'voice'}
          />
        )}
      </div>

      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        paddingBottom: 'max(36px, env(safe-area-inset-bottom))',
        paddingTop: 20,
        display: 'flex',
        justifyContent: 'center',
      }}>
        {controls}
      </div>
      <style>{CALL_KEYFRAMES}</style>
    </div>
  )
}

const MB = 1024 * 1024

function formatDataMb(mb) {
  if (!Number.isFinite(mb) || mb <= 0) return '0 MB'
  if (mb < 0.1) return '0.1 MB'
  if (mb >= 100) return `${Math.round(mb)} MB`
  return `${mb.toFixed(1)} MB`
}

function friendlyDuration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0))
  const m = Math.floor(s / 60)
  const r = s % 60
  if (m === 0) return `${r} sec`
  return r > 0 ? `${m} min ${r} sec` : `${m} min`
}

const summaryRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
}

const summaryLabelStyle = {
  fontSize: 13,
  fontWeight: 600,
  color: 'rgba(255,255,255,0.55)',
}

const summaryValueStyle = {
  fontSize: 15,
  fontWeight: 800,
  color: '#fff',
  fontVariantNumeric: 'tabular-nums',
}

/** Full-screen Call Summary shown after a budgeted call ends. */
export function CallSummaryScreen({ summary, onDone }) {
  const [canDone, setCanDone] = useState(false)
  const [lockSecs, setLockSecs] = useState(3)

  useEffect(() => {
    const done = setTimeout(() => setCanDone(true), 3000)
    const ticker = setInterval(() => setLockSecs((s) => Math.max(0, s - 1)), 1000)
    return () => {
      clearTimeout(done)
      clearInterval(ticker)
    }
  }, [])

  const {
    duration = 0,
    bytesUsed = 0,
    budgetMb = null,
    wasExtended = false,
  } = summary || {}
  const usedMb = Number.isFinite(bytesUsed) && bytesUsed > 0 ? bytesUsed / MB : 0
  const hasBudget = Number.isFinite(budgetMb) && budgetMb > 0
  const remainingMb = hasBudget ? Math.max(0, budgetMb - usedMb) : 0

  // Summary is only captured for budgeted calls; stay defensive anyway
  if (!hasBudget) return null

  return (
    <CallShell zIndex={3000}>
      <div style={{ animation: 'budgetModalIn 0.3s ease' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }}>
          <div style={{
            width: 88,
            height: 88,
            borderRadius: '50%',
            background: 'rgba(239,68,68,0.14)',
            border: '1px solid rgba(239,68,68,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 36px rgba(0,0,0,0.45)',
          }}>
            <CallIcon name="phoneOff" size={36} color={CALL_RED} />
          </div>
        </div>
        <CallTitle>Call ended</CallTitle>
        <CallSubtitle>Call lasted {friendlyDuration(duration)}</CallSubtitle>

        <div style={{
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 16,
          padding: '14px 18px',
          margin: '20px 0 18px',
          textAlign: 'left',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
        }}>
          <div style={summaryRowStyle}>
            <span style={summaryLabelStyle}>Budget used</span>
            <span style={summaryValueStyle}>{formatDataMb(usedMb)} of {formatDataMb(budgetMb)} used</span>
          </div>
          <div style={{ ...summaryRowStyle, marginTop: 12 }}>
            <span style={summaryLabelStyle}>Remaining</span>
            <span style={summaryValueStyle}>{formatDataMb(remainingMb)} remaining</span>
          </div>
          {wasExtended && (
            <div style={{ ...summaryRowStyle, marginTop: 12 }}>
              <span style={summaryLabelStyle}>Budget extended once during this call</span>
            </div>
          )}
        </div>

        <button
          type="button"
          className="call-btn"
          onClick={onDone}
          disabled={!canDone}
          style={{
            width: '100%',
            border: 'none',
            borderRadius: 14,
            padding: '15px 0',
            fontSize: 16,
            fontWeight: 800,
            fontFamily: 'inherit',
            cursor: canDone ? 'pointer' : 'not-allowed',
            background: canDone ? CALL_GREEN : 'rgba(255,255,255,0.14)',
            color: '#fff',
            opacity: canDone ? 1 : 0.7,
            transition: 'background 0.2s ease, opacity 0.2s ease, transform 0.15s ease',
          }}
        >
          Done
        </button>
        {!canDone && (
          <p style={{ margin: '10px 0 0', fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: 600 }}>
            Done unlocks in {lockSecs}s
          </p>
        )}
      </div>
    </CallShell>
  )
}

const rippleStyle = {
  position: 'absolute',
  inset: -10,
  borderRadius: '50%',
  border: '2px solid rgba(15,157,88,0.45)',
  animation: 'callRipple 2s ease-out infinite',
  pointerEvents: 'none',
}

export const CALL_KEYFRAMES = `
  @keyframes callRipple {
    0% { transform: scale(1); opacity: 0.65; }
    100% { transform: scale(1.85); opacity: 0; }
  }
  @keyframes callPulse {
    0%, 100% { transform: scale(1); box-shadow: 0 8px 28px rgba(15,157,88,0.45); }
    50% { transform: scale(1.06); box-shadow: 0 8px 36px rgba(15,157,88,0.7); }
  }
  @keyframes callBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.45; }
  }
  @keyframes callSpin {
    to { transform: rotate(360deg); }
  }
  @keyframes budgetToastIn {
    from { opacity: 0; transform: translateY(10px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes budgetModalIn {
    from { opacity: 0; transform: translateY(12px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .call-spin { animation: callSpin 0.85s linear infinite; }
  .call-ctrl:active { transform: scale(0.92); }
  .call-btn:active { transform: scale(0.97); }
`
