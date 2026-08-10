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

export function CallIcon({ name, size = 22, color = 'currentColor', strokeWidth = 2.2 }) {
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
          <span style={{ ...rippleStyle, animationDelay: '0.7s' }} />
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
          boxShadow: '0 18px 56px rgba(15,157,88,0.45), 0 0 0 2px rgba(255,255,255,0.12)',
        }}
      >
        {url ? (
          <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <span style={{ fontSize: size * 0.38, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em' }}>
            {(initial || '?').slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>
    </div>
  )
}

/** Circular glass control button — premium polished style */
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
    dangerActive: 'rgba(239,68,68,0.92)',
    successPulse: CALL_GREEN,
  }[variant] || 'rgba(255,255,255,0.14)'

  const shadow = {
    glass: '0 8px 28px rgba(0,0,0,0.45), 0 0 0 1px rgba(255,255,255,0.06) inset',
    danger: '0 10px 36px rgba(239,68,68,0.65), 0 0 0 1px rgba(255,255,255,0.1) inset',
    success: '0 10px 36px rgba(15,157,88,0.55), 0 0 0 1px rgba(255,255,255,0.1) inset',
    dangerActive: '0 8px 28px rgba(239,68,68,0.55), 0 0 0 1px rgba(255,255,255,0.08) inset',
    successPulse: '0 10px 36px rgba(15,157,88,0.55), 0 0 0 1px rgba(255,255,255,0.1) inset',
  }[variant]

  return (
    <button
      type="button"
      className="call-ctrl"
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel || label || 'Call control'}
      title={label || ariaLabel}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: variant === 'glass' ? '1px solid rgba(255,255,255,0.16)' : 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bg,
        color: '#fff',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        boxShadow: shadow,
        opacity: disabled ? 0.5 : 1,
        transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
        animation: variant === 'successPulse' ? 'callPulse 1.6s ease-in-out infinite' : undefined,
        flexShrink: 1,
        minWidth: 44,
        minHeight: 44,
      }}
    >
      {children}
    </button>
  )
}

export function CallStatusPill({ children, live = false }) {
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 9,
        background: 'rgba(11,14,20,0.75)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderRadius: 999,
        padding: '9px 18px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.04) inset',
      }}
    >
      {live && (
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#4ade80',
            boxShadow: '0 0 0 3px rgba(74,222,128,0.25), 0 1px 3px rgba(0,0,0,0.3)',
            animation: 'callBlink 1.4s ease infinite',
          }}
        />
      )}
      <span style={{
        fontSize: 14,
        color: 'rgba(255,255,255,0.97)',
        fontWeight: 750,
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: '-0.01em',
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

/** Full-screen dim backdrop for ring / incoming — premium polished */
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
        background: 'radial-gradient(ellipse 65% 45% at 50% 28%, #1a3328 0%, #0B0E14 58%, #060809 100%)',
        overflow: 'hidden',
      }}
    >
      {/* Premium ambient lighting */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background:
          'radial-gradient(circle at 22% 78%, rgba(15,157,88,0.18) 0%, transparent 38%),' +
          'radial-gradient(circle at 78% 22%, rgba(26,122,74,0.12) 0%, transparent 32%)',
      }} />
      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: 440, padding: '40px 28px', textAlign: 'center' }}>
        {children}
      </div>
      <style>{CALL_KEYFRAMES}</style>
    </div>
  )
}

export function CallTitle({ children }) {
  return (
    <h2 style={{
      margin: '22px 0 10px',
      fontSize: 28,
      fontWeight: 800,
      color: '#fff',
      letterSpacing: '-0.04em',
      lineHeight: 1.15,
    }}>
      {children}
    </h2>
  )
}

export function CallSubtitle({ children }) {
  return (
    <p style={{
      margin: '0 0 10px',
      fontSize: 15,
      color: 'rgba(255,255,255,0.6)',
      fontWeight: 600,
      lineHeight: 1.45,
    }}>
      {children}
    </p>
  )
}

/** In-call bottom control bar — premium polished design */
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
  // Responsive sizes — scale down on narrow phones so the bar never overflows.
  // 6 buttons (video) at max size = ~478px; clamp shrinks them to fit ≥320px.
  const btnSize = 'clamp(48px, 13vw, 60px)'
  const endBtnSize = 'clamp(54px, 15vw, 68px)'
  const iconSize = 'clamp(19px, 5vw, 23px)'
  const endIconSize = 'clamp(21px, 5.6vw, 26px)'
  const smallIconSize = 'clamp(18px, 4.8vw, 22px)'

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'clamp(8px, 2.6vw, 14px)',
        width: '100%',
        maxWidth: 520,
        padding: '0 clamp(10px, 3vw, 20px)',
        boxSizing: 'border-box',
        flexWrap: 'nowrap',
      }}
    >
      {/* Primary controls group */}
      {onMinimize && (
        <CallControlBtn
          label=""
          variant="glass"
          size={btnSize}
          onClick={onMinimize}
          ariaLabel="Minimize call and browse app"
        >
          <Minimize2 size={smallIconSize} color="#fff" strokeWidth={2.2} aria-hidden />
        </CallControlBtn>
      )}

      <CallControlBtn
        label=""
        variant={isMuted ? 'dangerActive' : 'glass'}
        size={btnSize}
        onClick={onMute}
        ariaLabel={isMuted ? 'Unmute microphone' : 'Mute microphone'}
      >
        <CallIcon name={isMuted ? 'micOff' : 'mic'} size={iconSize} color="#fff" strokeWidth={2.2} />
      </CallControlBtn>

      {isVideo && (
        <CallControlBtn
          label=""
          variant={isCamOff ? 'dangerActive' : 'glass'}
          size={btnSize}
          onClick={onCam}
          ariaLabel={isCamOff ? 'Turn camera on' : 'Turn camera off'}
        >
          <CallIcon name={isCamOff ? 'videoOff' : 'video'} size={iconSize} color="#fff" strokeWidth={2.2} />
        </CallControlBtn>
      )}

      {/* End call — prominent premium button */}
      <CallControlBtn
        label=""
        variant="danger"
        size={endBtnSize}
        onClick={onHangUp}
        ariaLabel="End call"
      >
        <CallIcon name="phoneOff" size={endIconSize} color="#fff" strokeWidth={2.5} />
      </CallControlBtn>

      {/* Secondary controls */}
      {isVideo && (
        <CallControlBtn
          label=""
          variant="glass"
          size={btnSize}
          onClick={onFlip}
          ariaLabel="Switch camera"
        >
          <CallIcon name="switchCamera" size={smallIconSize} color="#fff" strokeWidth={2.2} />
        </CallControlBtn>
      )}

      {onSwitchType && (
        <CallControlBtn
          label=""
          variant="glass"
          size={btnSize}
          disabled={switching}
          onClick={onSwitchType}
          ariaLabel={switching ? 'Switching call type' : (isVideo ? 'Switch to audio only' : 'Switch to video')}
        >
          <CallIcon name={switching ? 'loader' : (isVideo ? 'phone' : 'video')} size={smallIconSize} color="#fff" strokeWidth={2.2} />
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
    bg: 'rgba(15, 157, 88, 0.16)',
    border: 'rgba(15, 157, 88, 0.5)',
    color: '#a7f3d0',
  },
  quality: {
    text: 'Video quality reduced to save data',
    bg: 'rgba(59, 130, 246, 0.18)',
    border: 'rgba(59, 130, 246, 0.5)',
    color: '#bfdbfe',
  },
}

/** Subtle in-call toast — slides in from the top, auto-dismisses. Premium refined */
export function BudgetToast({ level, style }) {
  const toast = BUDGET_TOASTS[level] || BUDGET_TOASTS.low
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDismissed(true), 4500)
    return () => clearTimeout(t)
  }, [level])

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 20,
        left: 0,
        right: 0,
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
          gap: 9,
          background: toast.bg,
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: `1px solid ${toast.border}`,
          borderRadius: 999,
          padding: '11px 20px',
          color: toast.color,
          fontSize: 14,
          fontWeight: 700,
          letterSpacing: '-0.01em',
          boxShadow: '0 10px 32px rgba(0,0,0,0.45)',
          opacity: dismissed ? 0 : 1,
          transform: dismissed ? 'translateY(-16px)' : 'translateY(0)',
          transition: 'opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1), transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
          animation: dismissed ? 'none' : 'budgetToastDropIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
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
  minHeight: 52,
  background: 'rgba(15, 157, 88, 0.16)',
  border: '1.5px solid rgba(15, 157, 88, 0.5)',
  borderRadius: 999,
  padding: '13px 0',
  color: '#a7f3d0',
  fontSize: 16,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: 'inherit',
  transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s ease, border-color 0.2s ease',
  letterSpacing: '-0.01em',
}

/** Bottom-sheet style panel shown at 90%: quick budget extensions — premium polished */
export function BudgetExtendPanel({ onExtend }) {
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 'calc(150px + env(safe-area-inset-bottom, 0px))',
        zIndex: 3100,
        display: 'flex',
        justifyContent: 'center',
        padding: '0 20px',
      }}
    >
      <div
        style={{
          width: 'min(440px, 100%)',
          boxSizing: 'border-box',
          background: 'rgba(11,14,20,0.96)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 22,
          padding: '16px 22px 20px',
          boxShadow: '0 24px 72px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04) inset',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          textAlign: 'center',
          animation: 'budgetExtendUp 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <span
          aria-hidden
          style={{
            display: 'block',
            width: 44,
            height: 5,
            borderRadius: 2.5,
            background: 'rgba(255, 255, 255, 0.16)',
            margin: '0 auto 16px',
          }}
        />
        <div style={{ color: '#ffe08a', fontSize: 15, fontWeight: 750, marginBottom: 16, letterSpacing: '-0.01em' }}>
          Running low on data — extend?
        </div>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
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

/** Full-attention countdown at 98% — red pulsing edge + center countdown. Premium urgent state */
export function BudgetCountdownToast({ seconds, onExtend }) {
  return (
    <div
      role="alert"
      aria-live="assertive"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 3200,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(5, 8, 6, 0.5)',
        backdropFilter: 'blur(3px)',
        WebkitBackdropFilter: 'blur(3px)',
        pointerEvents: 'none',
        animation: 'budgetDangerIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 12,
          borderRadius: 28,
          border: '3px solid rgba(239, 68, 68, 0.7)',
          pointerEvents: 'none',
          animation: 'budgetDangerPulse 1.5s ease-in-out infinite',
        }}
      />
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          pointerEvents: 'auto',
          textAlign: 'center',
          padding: '0 28px',
          maxWidth: 440,
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            fontSize: 13,
            fontWeight: 750,
            color: '#fecaca',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          Call budget almost gone
        </div>
        <div
          style={{
            fontSize: 72,
            fontWeight: 800,
            color: '#fff',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
            margin: '8px 0 4px',
            letterSpacing: '-0.04em',
          }}
        >
          {seconds}
        </div>
        <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.8)', fontWeight: 650, marginBottom: 24 }}>
          seconds before the call ends
        </div>
        <button
          type="button"
          className="call-btn"
          onClick={onExtend}
          aria-label="Extend call budget by 10 MB"
          style={{
            minHeight: 54,
            background: CALL_GREEN,
            border: 'none',
            borderRadius: 999,
            padding: '14px 36px',
            color: '#fff',
            fontSize: 16,
            fontWeight: 800,
            cursor: 'pointer',
            fontFamily: 'inherit',
            boxShadow: '0 12px 36px rgba(15,157,88,0.6)',
            transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), background 0.2s ease',
            letterSpacing: '-0.01em',
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
  measuredRate,
  zIndex = 3000,
}) {
  // Stable callback refs — inline parent callbacks remount media every second
  const setRemoteVideo = useStableMediaRef(remoteVideoRef)
  const setLocalVideo = useStableMediaRef(localVideoRef)

  // Auto-hide UI after inactivity — smarter premium behavior
  const [uiVisible, setUiVisible] = useState(true)
  const hideTimerRef = useRef(null)
  const containerRef = useRef(null)

  const showUI = useCallback(() => {
    setUiVisible(true)
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    hideTimerRef.current = setTimeout(() => setUiVisible(false), 5000)
  }, [])

  useEffect(() => {
    showUI()
    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    }
  }, [showUI])

  const handleInteraction = useCallback(() => {
    showUI()
  }, [showUI])

  // Keep UI visible during budget warnings or low budget
  useEffect(() => {
    if (budgetMb > 0 && bytesUsed !== undefined) {
      const ratio = bytesUsed / (budgetMb * 1024 * 1024)
      if (ratio >= 0.75) {
        setUiVisible(true)
        if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
      }
    }
  }, [bytesUsed, budgetMb])

  return (
    <div
      ref={containerRef}
      onClick={handleInteraction}
      onTouchStart={handleInteraction}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex,
        fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        background: '#0B0E14',
        overflow: 'hidden',
        cursor: 'pointer',
      }}
    >
      {/* Remote video — full priority */}
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
            ? '#0B0E14'
            : 'radial-gradient(ellipse at center, #1a3328 0%, #0B0E14 70%)',
        }}
      />

      {/* Subtle gradients — premium scrim for readability, never obstruct face */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 220,
        background: 'linear-gradient(to top, rgba(11,14,20,0.96) 0%, rgba(11,14,20,0.7) 40%, rgba(11,14,20,0.2) 80%, transparent 100%)',
        pointerEvents: 'none',
        opacity: uiVisible ? 1 : 0,
        transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }} />

      {/* Top info gradient — premium auto-hide */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 140,
        background: 'linear-gradient(to bottom, rgba(11,14,20,0.88) 0%, rgba(11,14,20,0.4) 60%, rgba(11,14,20,0.1) 85%, transparent 100%)',
        pointerEvents: 'none',
        opacity: uiVisible ? 1 : 0,
        transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }} />

      {/* Self-view PiP — premium floating window */}
      {isVideo ? (
        <div style={{
          position: 'absolute',
          top: 'max(20px, env(safe-area-inset-top, 20px))',
          right: 16,
          width: 'clamp(90px, 20vw, 130px)',
          height: 'clamp(120px, 26.7vw, 173px)',
          borderRadius: 14,
          overflow: 'hidden',
          border: '2px solid rgba(255,255,255,0.18)',
          background: '#0B0E14',
          boxShadow: '0 14px 48px rgba(0,0,0,0.65), 0 0 0 1px rgba(255,255,255,0.05) inset',
          zIndex: 5,
          opacity: uiVisible ? 1 : 0.3,
          transition: 'opacity 0.4s ease, transform 0.4s ease',
          transform: uiVisible ? 'scale(1)' : 'scale(0.92)',
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

      {/* Browse warning — premium hint bar */}
      {warning ? (
        <div style={{
          position: 'absolute',
          top: 'max(16px, env(safe-area-inset-top, 16px))',
          left: 16,
          right: isVideo ? 'clamp(140px, 24vw, 180px)' : 16,
          display: 'flex',
          justifyContent: 'center',
          zIndex: 4,
          opacity: uiVisible ? 0.92 : 0,
          transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: uiVisible ? 'translateY(0)' : 'translateY(-8px)',
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(249,171,0,0.16)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(249,171,0,0.4)',
            borderRadius: 12,
            padding: '8px 14px',
            color: '#ffe08a',
            fontSize: 12,
            fontWeight: 700,
            maxWidth: '100%',
            boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
          }}>
            <CallIcon name="alert" size={14} color="#ffe08a" />
            {warning}
          </div>
        </div>
      ) : null}

      {/* Caller info — top center, premium subtle */}
      <div style={{
        position: 'absolute',
        top: 'max(20px, calc(env(safe-area-inset-top, 0px) + 20px))',
        left: 0,
        right: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        zIndex: 3,
        padding: '0 20px',
        opacity: uiVisible ? 1 : 0,
        transform: uiVisible ? 'translateY(0)' : 'translateY(-16px)',
        transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: 'none',
      }}>
        {!isVideo && (
          <>
            <CallAvatar url={avatarUrl} initial={avatarInitial} size={96} pulse={false} />
            <div style={{
              fontSize: 24,
              fontWeight: 800,
              color: '#fff',
              textShadow: '0 3px 20px rgba(0,0,0,0.75)',
              letterSpacing: '-0.04em',
            }}>
              {name}
            </div>
          </>
        )}
        {isVideo && name ? (
          <div style={{
            fontSize: 15,
            fontWeight: 700,
            color: '#fff',
            textShadow: '0 2px 14px rgba(0,0,0,0.85)',
            background: 'rgba(11,14,20,0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            padding: '7px 16px',
            borderRadius: 999,
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            {name}
          </div>
        ) : null}
        <CallStatusPill live>{durationLabel}</CallStatusPill>
      </div>

      {/* Data budget — smart floating indicator, never blocks video */}
      {bytesUsed !== undefined && budgetMb > 0 && (
        <div style={{
          position: 'absolute',
          top: isVideo
            ? 'max(190px, calc(env(safe-area-inset-top, 0px) + 190px))'
            : 'max(240px, calc(env(safe-area-inset-top, 0px) + 240px))',
          left: 0,
          right: 0,
          display: 'flex',
          justifyContent: 'center',
          zIndex: 3,
          padding: '0 20px',
          opacity: uiVisible ? 1 : 0,
          transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          transform: uiVisible ? 'translateY(0)' : 'translateY(-12px)',
          pointerEvents: uiVisible ? 'auto' : 'none',
        }}>
          <CallDataMeter
            bytesUsed={bytesUsed}
            budgetMb={budgetMb}
            callType={isVideo ? 'video' : 'voice'}
            measuredRate={measuredRate}
          />
        </div>
      )}

      {/* Controls — premium bottom bar with safe area */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 10,
        paddingBottom: 'max(36px, calc(env(safe-area-inset-bottom, 0px) + 16px))',
        paddingTop: 24,
        display: 'flex',
        justifyContent: 'center',
        opacity: uiVisible ? 1 : 0,
        transform: uiVisible ? 'translateY(0)' : 'translateY(24px)',
        transition: 'opacity 0.4s cubic-bezier(0.16, 1, 0.3, 1), transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        pointerEvents: uiVisible ? 'auto' : 'none',
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
    0% { transform: scale(1); opacity: 0.7; }
    100% { transform: scale(1.9); opacity: 0; }
  }
  @keyframes callPulse {
    0%, 100% { transform: scale(1); box-shadow: 0 10px 36px rgba(15,157,88,0.55); }
    50% { transform: scale(1.06); box-shadow: 0 12px 44px rgba(15,157,88,0.8); }
  }
  @keyframes callBlink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.35; }
  }
  @keyframes callSpin {
    to { transform: rotate(360deg); }
  }
  @keyframes budgetToastIn {
    from { opacity: 0; transform: translateY(12px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes budgetToastDropIn {
    from { opacity: 0; transform: translateY(-18px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes budgetExtendUp {
    from { opacity: 0; transform: translateY(28px) scale(0.97); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes budgetDangerIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  @keyframes budgetDangerPulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
    50% { box-shadow: 0 0 0 20px rgba(239, 68, 68, 0); }
  }
  @keyframes budgetModalIn {
    from { opacity: 0; transform: translateY(16px) scale(0.96); }
    to { opacity: 1; transform: translateY(0) scale(1); }
  }
  .call-spin { animation: callSpin 0.8s linear infinite; }
  .call-ctrl:hover:not(:disabled) {
    transform: scale(1.08);
  }
  .call-ctrl:active:not(:disabled) {
    transform: scale(0.94);
  }
  .call-btn:active { transform: scale(0.96); }

  @media (hover: hover) {
    .call-ctrl:hover:not(:disabled) {
      transform: scale(1.08);
      box-shadow: 0 12px 40px rgba(0,0,0,0.6);
    }
  }

  @media (max-width: 640px) {
    .call-ctrl {
      -webkit-tap-highlight-color: transparent;
    }
  }
`
