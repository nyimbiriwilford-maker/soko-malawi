/**
 * Floating mini call bar — stays on screen when user navigates the app
 * or backgrounds the tab. Expands back to full call UI.
 */

import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Mic, MicOff, PhoneOff, Maximize2, Phone, Video } from 'lucide-react'
import { useCall } from '../context/CallContext'
import { formatTime } from '../hooks/useWebRTC'
import { CALL_GREEN } from './call/CallUI'

export default function MiniCallBar() {
  const navigate = useNavigate()
  const {
    activeCall,
    callUiMode,
    expandCall,
    mediaControlsRef,
    remoteMediaStreamRef,
    localStreamRef,
  } = useCall() || {}

  const audioRef = useRef(null)

  // Keep remote audio playing even when full video UI is unmounted
  useEffect(() => {
    const el = audioRef.current
    const stream = remoteMediaStreamRef?.current
    if (!el || !stream) return
    // Avoid re-attaching every duration tick (causes audio/video glitches)
    if (el.srcObject !== stream) el.srcObject = stream
    if (el.paused) el.play().catch(() => {})
  }, [activeCall?.status, remoteMediaStreamRef])

  // Background / home screen: Media Session + keep tracks live + optional PiP
  useEffect(() => {
    if (!activeCall || activeCall.status === 'idle') return undefined

    const applyMediaSession = () => {
      if (!('mediaSession' in navigator)) return
      try {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: activeCall.peerName || 'SokoMw Call',
          artist: activeCall.callType === 'video' ? 'Video call' : 'Voice call',
          album: 'SokoMw',
        })
        navigator.mediaSession.playbackState = 'playing'
        navigator.mediaSession.setActionHandler?.('hangup', () => {
          mediaControlsRef?.current?.hangUp?.()
        })
        navigator.mediaSession.setActionHandler?.('togglecamera', () => {
          mediaControlsRef?.current?.toggleCam?.()
        })
        navigator.mediaSession.setActionHandler?.('togglemicrophone', () => {
          mediaControlsRef?.current?.toggleMute?.()
        })
      } catch (_) {}
    }
    applyMediaSession()

    let wakeLock = null
    const requestWake = async () => {
      try {
        if (navigator.wakeLock?.request) {
          wakeLock = await navigator.wakeLock.request('screen')
        }
      } catch (_) {}
    }
    requestWake()

    const onVisibility = async () => {
      if (document.hidden) {
        // Ensure audio tracks stay enabled in background
        try {
          remoteMediaStreamRef?.current?.getAudioTracks?.().forEach((t) => {
            t.enabled = true
          })
          localStreamRef?.current?.getAudioTracks?.().forEach((t) => {
            // keep user's mute preference
          })
        } catch (_) {}

        // Video PiP when available (Chrome / Edge / Android)
        if (activeCall.callType === 'video') {
          try {
            const vids = document.querySelectorAll('video.call-remote-pip-source')
            const v = vids[vids.length - 1]
            if (v && document.pictureInPictureEnabled && !document.pictureInPictureElement) {
              await v.requestPictureInPicture()
            }
          } catch (_) {}
        }
      } else {
        requestWake()
        if (document.pictureInPictureElement) {
          try { await document.exitPictureInPicture() } catch (_) {}
        }
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      try { wakeLock?.release?.() } catch (_) {}
      try {
        if ('mediaSession' in navigator) {
          navigator.mediaSession.setActionHandler?.('hangup', null)
          navigator.mediaSession.setActionHandler?.('togglecamera', null)
          navigator.mediaSession.setActionHandler?.('togglemicrophone', null)
        }
      } catch (_) {}
    }
  }, [activeCall, mediaControlsRef, remoteMediaStreamRef, localStreamRef])

  // Always keep a hidden audio element while a call is active (survives UI mode)
  const audioSink = (
    <audio ref={audioRef} autoPlay playsInline style={{ display: 'none' }} />
  )

  if (!activeCall || activeCall.status === 'idle') return null

  if (callUiMode !== 'mini') {
    return audioSink
  }

  const isVideo = activeCall.callType === 'video'
  const muted = !!activeCall.isMuted
  const status = activeCall.status
  const label =
    status === 'calling' || status === 'ringing'
      ? (isVideo ? 'Calling…' : 'Calling…')
      : formatTime(activeCall.duration || 0)

  const onExpand = () => {
    expandCall?.()
    if (activeCall.chatPath) {
      try { navigate(activeCall.chatPath) } catch (_) {}
    }
  }

  return (
    <>
      {audioSink}
      <div
        role="region"
        aria-label="Active call"
        style={{
          position: 'fixed',
          top: 'max(12px, env(safe-area-inset-top))',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9500,
          width: 'min(420px, calc(100vw - 24px))',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 12px',
          borderRadius: 18,
          background: 'rgba(10, 18, 14, 0.92)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: '1px solid rgba(255,255,255,0.12)',
          boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
          fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, sans-serif',
        }}
      >
        <button
          type="button"
          onClick={onExpand}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            flex: 1,
            minWidth: 0,
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            textAlign: 'left',
            color: '#fff',
          }}
        >
          <div style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            background: `linear-gradient(145deg, #22a05e, ${CALL_GREEN})`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            overflow: 'hidden',
          }}>
            {activeCall.peerAvatar ? (
              <img src={activeCall.peerAvatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : isVideo ? (
              <Video size={18} color="#fff" strokeWidth={2.2} />
            ) : (
              <Phone size={18} color="#fff" strokeWidth={2.2} />
            )}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{
              fontSize: 14,
              fontWeight: 750,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {activeCall.peerName || 'On call'}
            </div>
            <div style={{
              fontSize: 12,
              color: '#4ade80',
              fontWeight: 650,
              fontVariantNumeric: 'tabular-nums',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: '#4ade80',
                display: 'inline-block',
              }} />
              {label}
            </div>
          </div>
        </button>

        <button
          type="button"
          aria-label={muted ? 'Unmute' : 'Mute'}
          onClick={() => mediaControlsRef?.current?.toggleMute?.()}
          style={iconBtn(muted ? 'rgba(239,68,68,0.9)' : 'rgba(255,255,255,0.12)')}
        >
          {muted
            ? <MicOff size={18} color="#fff" strokeWidth={2.2} />
            : <Mic size={18} color="#fff" strokeWidth={2.2} />}
        </button>

        <button
          type="button"
          aria-label="Expand call"
          onClick={onExpand}
          style={iconBtn('rgba(255,255,255,0.12)')}
        >
          <Maximize2 size={17} color="#fff" strokeWidth={2.2} />
        </button>

        <button
          type="button"
          aria-label="End call"
          onClick={() => mediaControlsRef?.current?.hangUp?.()}
          style={iconBtn('#ef4444')}
        >
          <PhoneOff size={18} color="#fff" strokeWidth={2.2} />
        </button>
      </div>
    </>
  )
}

function iconBtn(bg) {
  return {
    width: 40,
    height: 40,
    borderRadius: 12,
    border: 'none',
    background: bg,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
  }
}
