import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const NOTIF_ICONS = {
  new_message: '💬', missed_call: '📞', missed_video: '📹',
  listing_offer: '💰', listing_view: '👁️', listing_comment: '💬',
  listing_sold: '🎉', listing_liked: '❤️', booking_request: '📅',
  booking_confirmed: '✅', booking_cancelled: '❌', booking_completed: '🏁',
  deal_ready: '🤝', deal_request: '🤝', deal_confirmed: '🎉',
  deal_declined: '❌', deal_vouching: '⭐', new_vouch: '⭐',
  order_placed: '📦', order_shipped: '🚚', order_delivered: '✅',
  order_cancelled: '❌', system: '⚙️', warning: '⚠️',
}

function getIcon(type) { return NOTIF_ICONS[type] || '🔔' }

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
    position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
    zIndex: 9998, maxWidth: 360, width: 'calc(100% - 32px)',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    animation: 'toastSlideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
  },
  toast: {
    background: '#ffffff', borderRadius: 14, border: '1px solid #d8e5dc',
    boxShadow: '0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
    padding: '14px 16px', display: 'flex', alignItems: 'center',
    gap: 12, cursor: 'pointer', transition: 'opacity 0.25s, transform 0.25s',
  },
  icon: {
    fontSize: 22, flexShrink: 0, width: 40, height: 40,
    borderRadius: 10, background: '#f4f8f5',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  body: { flex: 1, minWidth: 0 },
  title: { fontSize: 13, fontWeight: 700, color: '#0f1410', lineHeight: 1.3 },
  message: {
    fontSize: 12, color: '#4a5e4d', lineHeight: 1.3, marginTop: 2,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
}

export default function NotificationToast() {
  const navigate = useNavigate()
  const [queue, setQueue] = useState([])
  const [visible, setVisible] = useState(null)
  const timerRef = useRef(null)
  const toastRef = useRef(null)

  // Subscribe only after user is known
  useEffect(() => {
    let cancelled = false
    const channel = supabase.channel('notification-toast')

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return

      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          setQueue((prev) => [...prev, payload.new])
        }
      )
      channel.subscribe()
    })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [])

  const dismiss = useCallback(() => {
    clearTimeout(timerRef.current)
    if (toastRef.current) {
      toastRef.current.style.opacity = '0'
      toastRef.current.style.transform = 'translateY(-16px)'
    }
    setTimeout(() => setVisible(null), 250)
  }, [])

  useEffect(() => {
    if (visible || queue.length === 0) return
    const next = queue[0]
    setQueue((prev) => prev.slice(1))
    setVisible(next)
    timerRef.current = setTimeout(dismiss, 4000)
    return () => clearTimeout(timerRef.current)
  }, [queue, visible, dismiss])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  if (!visible) return null

  return (
    <div style={S.wrapper}>
      <div
        ref={toastRef}
        style={S.toast}
        onClick={() => { dismiss(); navigate('/notifications') }}
        role="alert"
        aria-live="polite"
      >
        <div style={S.icon}>{getIcon(visible.type)}</div>
        <div style={S.body}>
          <div style={S.title}>{getTitle(visible.type)}</div>
          {(visible.body || visible.title) && (
            <div style={S.message}>{visible.body || visible.title}</div>
          )}
        </div>
      </div>
      <style>{`
        @keyframes toastSlideIn {
          from { opacity: 0; transform: translateX(-50%) translateY(-20px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}