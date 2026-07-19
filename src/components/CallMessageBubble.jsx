/**
 * In-thread call history bubble — modern Lucide icons.
 */

import { Phone, PhoneMissed, PhoneOff, Video } from 'lucide-react'
import { formatTime } from '../hooks/useWebRTC'

/**
 * @param {object} props
 * @param {object} props.msg
 * @param {boolean} props.isMine
 */
export default function CallMessageBubble({ msg, isMine }) {
  const isVideo = msg.call_type === 'video'
  const status = msg.call_status
  const missed = status === 'missed'
  const declined = status === 'declined'
  const ended = status === 'ended' || status === 'answered'
  if (!missed && !declined && !ended) return null

  let subtitle = 'Ended'
  let Icon = isVideo ? Video : Phone
  let iconColor = isMine ? 'rgba(255,255,255,0.9)' : '#0F9D58'
  let subtitleColor = isMine ? 'rgba(255,255,255,0.55)' : '#888'

  if (missed) {
    subtitle = 'Missed'
    Icon = PhoneMissed
    iconColor = '#ef4444'
    subtitleColor = '#ef4444'
  } else if (declined) {
    subtitle = 'Declined'
    Icon = PhoneOff
    iconColor = '#d97706'
    subtitleColor = '#d97706'
  } else if (msg.call_duration) {
    subtitle = formatTime(msg.call_duration)
  } else if (status === 'answered') {
    subtitle = 'Connected'
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        borderRadius: 14,
        padding: '10px 12px',
        minWidth: 168,
        background: isMine
          ? 'rgba(255,255,255,0.12)'
          : 'linear-gradient(145deg, #f4fbf7 0%, #eaf6ef 100%)',
        border: isMine ? '1px solid rgba(255,255,255,0.1)' : '1px solid #d7ebdf',
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 11,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          background: isMine ? 'rgba(255,255,255,0.14)' : 'rgba(15,157,88,0.12)',
        }}
      >
        <Icon size={17} strokeWidth={2.15} color={iconColor} aria-hidden />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: isMine ? '#fff' : '#0f1410',
            letterSpacing: '-0.015em',
          }}
        >
          {isVideo ? 'Video call' : 'Voice call'}
        </div>
        <div style={{ fontSize: 11, fontWeight: 600, color: subtitleColor, marginTop: 2 }}>
          {subtitle}
        </div>
      </div>
    </div>
  )
}
