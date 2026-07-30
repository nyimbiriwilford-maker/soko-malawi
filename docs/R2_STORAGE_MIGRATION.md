# FloatingIncomingCall.jsx

```jsx
import { useEffect } from 'react'
import { useCall } from '../context/CallContext'

const S = {
  overlay: {
    position: 'fixed',
    top: 16,
    right: 16,
    zIndex: 9999,
    animation: 'slideInFloating 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  card: {
    width: 320,
    background: '#ffffff',
    borderRadius: 16,
    border: '1px solid #d8e5dc',
    boxShadow: '0 12px 40px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)',
    padding: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    objectFit: 'cover',
    flexShrink: 0,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: '#1a7a4a',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 20,
    fontWeight: 700,
    flexShrink: 0,
  },
  info: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
  },
  name: {
    fontSize: 15,
    fontWeight: 700,
    color: '#0f1410',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  type: {
    fontSize: 13,
    color: '#4a5e4d',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  actions: {
    display: 'flex',
    gap: 12,
  },
  answerBtn: {
    flex: 1,
    padding: '10px 0',
    background: '#1a7a4a',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  declineBtn: {
    flex: 1,
    padding: '10px 0',
    background: '#dc2626',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
}

export default function FloatingIncomingCall() {
  const { incomingCall, answerCall, declineCall, callUiMode } = useCall()

  if (!incomingCall || callUiMode !== 'hidden') return null

  const { callerName, callerAvatar, isVideo } = incomingCall

  return (
    <div style={S.overlay} role="alert" aria-live="assertive">
      <div style={S.card}>
        <div style={S.row}>
          {callerAvatar ? (
            <img src={callerAvatar} alt="" style={S.avatar} />
          ) : (
            <div style={S.avatarPlaceholder}>
              {(callerName || '?')[0].toUpperCase()}
            </div>
          )}
          <div style={S.info}>
            <div style={S.name}>{callerName || 'Unknown'}</div>
            <div style={S.type}>
              {isVideo ? '📹 Video Call' : '📞 Voice Call'}
            </div>
          </div>
        </div>
        <div style={S.actions}>
          <button
            style={S.declineBtn}
            onClick={declineCall}
            aria-label="Decline call"
          >
            Decline
          </button>
          <button
            style={S.answerBtn}
            onClick={answerCall}
            aria-label="Answer call"
          >
            Answer
          </button>
        </div>
      </div>
      <style>{`
        @keyframes slideInFloating {
          from { transform: translateY(-120%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
```

---

# NotificationToast.jsx

```jsx
import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const NOTIF_ICONS = {
  new_message: '💬',
  missed_call: '📞',
  missed_video: '📹',
  listing_offer: '💰',
  listing_view: '👁️',
  listing_comment: '💬',
  listing_sold: '🎉',
  listing_liked: '❤️',
  booking_request: '📅',
  booking_confirmed: '✅',
  booking_cancelled: '❌',
  booking_completed: '🏁',
  deal_ready: '🤝',
  deal_request: '🤝',
  deal_confirmed: '🎉',
  deal_declined: '❌',
  deal_vouching: '⭐',
  new_vouch: '⭐',
  order_placed: '📦',
  order_shipped: '🚚',
  order_delivered: '✅',
  order_cancelled: '❌',
  system: '⚙️',
  warning: '⚠️',
}

function getIcon(type) {
  return NOTIF_ICONS[type] || '🔔'
}

function getTitle(type) {
  if (type === 'new_message') return 'New Message'
  if (type === 'missed_call') return 'Missed Call'
  if (type === 'missed_video') return 'Missed Video Call'
  if (type === 'listing_sold') return 'Item Sold'
  if (type === 'listing_liked') return 'Listing Liked'
  if (type === 'listing_comment') return 'New Comment'
  if (type === 'listing_offer') return 'New Offer'
  if (type === 'listing_view') return 'Listing Viewed'
  if (type?.startsWith('booking_')) return 'Booking Update'
  if (type?.startsWith('deal_')) return 'Deal Update'
  if (type?.startsWith('order_')) return 'Order Update'
  if (type === 'system' || type === 'warning') return 'System Alert'
  return 'Notification'
}

const S = {
  wrapper: {
    position: 'fixed',
    top: 16,
    left: '50%',
    transform: 'translateX(-50%)',
    zIndex: 9998,
    maxWidth: 360,
    width: 'calc(100% - 32px)',
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  toast: {
    background: '#ffffff',
    borderRadius: 14,
    border: '1px solid #d8e5dc',
    boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
    padding: '14px 16px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    cursor: 'pointer',
    transition: 'opacity 0.25s, transform 0.25s',
  },
  icon: {
    fontSize: 22,
    flexShrink: 0,
    width: 40,
    height: 40,
    borderRadius: 10,
    background: '#f4f8f5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: 700,
    color: '#0f1410',
    lineHeight: 1.3,
  },
  message: {
    fontSize: 12,
    color: '#4a5e4d',
    lineHeight: 1.3,
    marginTop: 2,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
}

export default function NotificationToast() {
  const navigate = useNavigate()
  const [queue, setQueue] = useState([])
  const [visible, setVisible] = useState(null)
  const timerRef = useRef(null)
  const animRef = useRef(null)
  const userIdRef = useRef(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) userIdRef.current = user.id
    })
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('notification-toast')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userIdRef.current}`,
        },
        (payload) => {
          const row = payload.new
          setQueue((prev) => [...prev, row])
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const dismiss = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = null
    if (animRef.current) {
      animRef.current.style.opacity = '0'
      animRef.current.style.transform = 'translateY(-16px)'
    }
    setTimeout(() => {
      setVisible(null)
    }, 250)
  }, [])

  useEffect(() => {
    if (visible || queue.length === 0) return
    const next = queue[0]
    setQueue((prev) => prev.slice(1))
    setVisible(next)
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      dismiss()
    }, 4000)
    return () => clearTimeout(timerRef.current)
  }, [queue, visible, dismiss])

  useEffect(() => {
    return () => clearTimeout(timerRef.current)
  }, [])

  if (!visible) return null

  const icon = getIcon(visible.type)
  const title = getTitle(visible.type)
  const body = visible.body || visible.title || ''

  return (
    <div style={S.wrapper}>
      <div
        ref={animRef}
        style={S.toast}
        onClick={() => { dismiss(); navigate('/notifications') }}
        role="alert"
        aria-live="polite"
      >
        <div style={S.icon}>{icon}</div>
        <div style={S.body}>
          <div style={S.title}>{title}</div>
          {body && <div style={S.message}>{body}</div>}
        </div>
      </div>
      <style>{`
        @keyframes toastSlideIn {
          from { transform: translateY(-120%) translateX(-50%); opacity: 0; }
          to { transform: translateY(0) translateX(-50%); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
```
