import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { sendMessageReply } from '../utils/sendMessageReply'
import { T } from '../constants/tokens'
import {
  MessageCircle, Phone, VideoOff, Tag, Eye, MessageSquare, CheckCircle2,
  Heart, X, Handshake, Star, Package, Truck, Bell, AlertTriangle,
  ArrowLeftRight, Undo2, Clock, CircleDollarSign, PenLine, Briefcase,
} from 'lucide-react'

const NOTIF_ICON_MAP = {
  new_message: MessageCircle, missed_call: Phone, missed_video: VideoOff,
  listing_offer: Tag, listing_view: Eye, listing_comment: MessageSquare,
  listing_sold: CheckCircle2, listing_liked: Heart,
  offer_new: CircleDollarSign, offer_counter: ArrowLeftRight,
  offer_accepted: CheckCircle2, offer_declined: X,
  offer_withdrawn: Undo2, offer_edited: PenLine, offer_expired: Clock, offer_expiring: Clock,
  deal_ready: Handshake, deal_request: Handshake, deal_confirmed: CheckCircle2,
  deal_declined: X, deal_vouching: Star, new_vouch: Star,
  order_placed: Package, order_shipped: Truck, order_delivered: CheckCircle2,
  order_cancelled: X, system: Bell, warning: AlertTriangle,
  job_match: Briefcase,
}

const TYPE_COLORS = {
  new_message: T.blue, missed_call: T.red, missed_video: T.red,
  listing_offer: T.amber, listing_sold: T.green, deal_ready: T.green,
  deal_request: T.amber, deal_confirmed: T.green, deal_declined: T.red,
  offer_new: T.green, offer_counter: T.blue, offer_accepted: T.green,
  offer_declined: T.red, offer_withdrawn: T.gray600, offer_edited: T.blue,
  offer_expired: T.red, offer_expiring: T.amber, job_match: '#7c3aed',
}

function getIcon(type) {
  const Icon = NOTIF_ICON_MAP[type]
  return Icon ? <Icon size={12} strokeWidth={2.5} /> : <Bell size={12} strokeWidth={2.5} />
}

function getAccent(type) { return TYPE_COLORS[type] || T.gray600 }

function getTitle(type) {
  if (type === 'new_message') return 'New Message'
  if (type === 'missed_call') return 'Missed Call'
  if (type === 'missed_video') return 'Missed Video Call'
  if (type === 'listing_sold') return 'Item Sold'
  if (type === 'listing_liked') return 'Listing Liked'
  if (type === 'listing_comment') return 'New Comment'
  if (type === 'listing_offer') return 'New Offer'
  if (type === 'offer_new') return 'New Offer'
  if (type === 'offer_counter') return 'Counter Offer'
  if (type === 'offer_accepted') return 'Offer Accepted'
  if (type === 'offer_declined') return 'Offer Declined'
  if (type === 'offer_withdrawn') return 'Offer Withdrawn'
  if (type === 'offer_edited') return 'Offer Updated'
  if (type === 'offer_expired') return 'Offer Expired'
  if (type === 'offer_expiring') return 'Offer Expiring Soon'
  if (type === 'listing_view') return 'Listing Viewed'
  if (type?.startsWith('deal_')) return 'Deal Update'
  if (type?.startsWith('order_')) return 'Order Update'
  if (type === 'system' || type === 'warning') return 'System Alert'
  if (type === 'job_match') return 'Job Match'
  return 'Notification'
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diffMs = now - d
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function useSenderProfile(senderId) {
  const [profile, setProfile] = useState(null)
  useEffect(() => {
    if (!senderId) return
    let cancelled = false
    supabase.from('profiles').select('full_name, avatar_url').eq('id', senderId).maybeSingle()
      .then(({ data }) => { if (!cancelled) setProfile(data) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [senderId])
  return profile
}

let _audioCtx
function playNotificationSound() {
  try {
    if (!_audioCtx) _audioCtx = new (window.AudioContext || window.webkitAudioContext)()
    if (_audioCtx.state === 'suspended') _audioCtx.resume()
    const now = _audioCtx.currentTime
    const osc1 = _audioCtx.createOscillator()
    const gain1 = _audioCtx.createGain()
    osc1.type = 'sine'
    osc1.frequency.setValueAtTime(880, now)
    gain1.gain.setValueAtTime(0.08, now)
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.12)
    osc1.connect(gain1).connect(_audioCtx.destination)
    osc1.start(now)
    osc1.stop(now + 0.12)
    const osc2 = _audioCtx.createOscillator()
    const gain2 = _audioCtx.createGain()
    osc2.type = 'sine'
    osc2.frequency.setValueAtTime(1108, now + 0.08)
    gain2.gain.setValueAtTime(0.06, now + 0.08)
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.25)
    osc2.connect(gain2).connect(_audioCtx.destination)
    osc2.start(now + 0.08)
    osc2.stop(now + 0.25)
  } catch {}
}

const SOUND_TYPES = new Set(Object.keys(NOTIF_ICON_MAP))

function Avatar({ src, name, size }) {
  const initial = (name || '?').charAt(0).toUpperCase()
  return (
    <div style={{ width: size, height: size, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: src ? 'transparent' : `linear-gradient(135deg, ${T.green}, ${T.greenD})`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: Math.round(size * 0.45), fontWeight: 700 }}>
      {src ? <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
    </div>
  )
}

export default function NotificationToast() {
  const navigate = useNavigate()
  const [queue, setQueue] = useState([])
  const [visible, setVisible] = useState(null)
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [replySent, setReplySent] = useState(false)
  const [interacting, setInteracting] = useState(false)
  const [replyExpanded, setReplyExpanded] = useState(false)
  const [show, setShow] = useState(false)
  const timerRef = useRef(null)
  const toastRef = useRef(null)
  const inputRef = useRef(null)
  const dragRef = useRef(null)
  const swipedRef = useRef(false)
  const [swipeX, setSwipeX] = useState(0)
  const [dragging, setDragging] = useState(false)

  const actorId = visible?.data?.sender_id || visible?.data?.caller_id || visible?.data?.decliner_id || visible?.data?.voucher_id || visible?.data?.viewer_id || visible?.data?.buyer_id || visible?.data?.seller_id || visible?.data?.user_id || visible?.data?.actor_id || null
  const senderProfile = useSenderProfile(actorId)

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

  const dismiss = useCallback((opts = {}) => {
    clearTimeout(timerRef.current)
    setShow(false)
    if (!opts.keepOffset) setSwipeX(0)
    setDragging(false)
    setTimeout(() => { setVisible(null); setReplyText(''); setReplySent(false); setInteracting(false); setReplyExpanded(false) }, 200)
  }, [])

  const AUTO_DISMISS_MS = 6000

  const startTimer = useCallback(() => {
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS)
  }, [dismiss])

  const clearTimer = useCallback(() => {
    clearTimeout(timerRef.current)
  }, [])

  useEffect(() => {
    if (visible || queue.length === 0) return
    const next = queue[0]
    setQueue((prev) => prev.slice(1))
    setVisible(next)
    setShow(true)
    setReplyText('')
    setReplySent(false)
    setInteracting(false)
    setReplyExpanded(false)
  }, [queue, visible])

  // Auto-dismiss timer — keyed ONLY on `visible` so the pump effect's own state
  // writes (queue/visible changes) can never trigger a cleanup that clears the
  // currently-visible toast's timer.
  useEffect(() => {
    if (!visible) return
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timerRef.current)
  }, [visible, dismiss])

  useEffect(() => () => clearTimeout(timerRef.current), [])

  useEffect(() => {
    if (replyExpanded) inputRef.current?.focus()
  }, [replyExpanded])

  useEffect(() => {
    if (visible && SOUND_TYPES.has(visible.type)) playNotificationSound()
  }, [visible])

  const isMessage = visible?.type === 'new_message'
  const accent = getAccent(visible?.type)
  const displayName = visible?.data?.sender_name || visible?.data?.caller_name || visible?.data?.decliner_name || visible?.data?.voucher_name || visible?.data?.viewer_name || visible?.data?.buyer_name || visible?.data?.seller_name || visible?.data?.actor_name || visible?.title || getTitle(visible?.type)

  async function handleSendReply() {
    const text = replyText.trim()
    if (!text || sending || !visible?.data?.sender_id) return
    setSending(true)
    const { error } = await sendMessageReply({
      toUserId: visible.data.sender_id,
      body: text,
      contextId: visible.data.context_id || visible.data.listing_id || null,
      listingTitle: visible.data.listing_title || null,
    })
    setSending(false)
    if (error) return
    setReplySent(true)
    clearTimeout(timerRef.current)
    setTimeout(dismiss, 1200)
  }

  function handleInputFocus() {
    setInteracting(true)
    clearTimer()
  }

  function handleInputBlur() {
    setInteracting(false)
    startTimer()
  }

  function handleMouseEnter() {
    clearTimer()
  }

  function handleMouseLeave() {
    if (!interacting) startTimer()
  }

  function handleToastClick(e) {
    if (e.target.closest('.toast-reply-area') || replySent) return
    // A swipe just happened — this click is the tail end of the drag, so don't
    // navigate to /notifications (the swipe already dismissed/replied).
    if (swipedRef.current) {
      swipedRef.current = false
      return
    }
    dismiss()
    navigate('/notifications')
  }

  function handleTouchStart(e) {
    // Swipe gestures apply ONLY to message notifications
    if (!isMessage) return
    if (e.target.closest('.toast-reply-area')) return
    const t = e.touches[0]
    dragRef.current = { startX: t.clientX, startY: t.clientY, dx: 0 }
    swipedRef.current = false
    setDragging(true)
  }

  function handleTouchMove(e) {
    const drag = dragRef.current
    if (!drag) return
    const t = e.touches[0]
    const dx = t.clientX - drag.startX
    const dy = t.clientY - drag.startY
    // Only treat clearly-horizontal movement as a swipe
    if (Math.abs(dx) < 10 || Math.abs(dx) <= Math.abs(dy)) return
    drag.dx = dx
    swipedRef.current = true
    setSwipeX(dx)
  }

  function endSwipe() {
    const drag = dragRef.current
    dragRef.current = null
    setDragging(false)
    if (!drag || drag.dx === 0) return
    const threshold = 70
    if (Math.abs(drag.dx) >= threshold) {
      if (drag.dx > 0) {
        // Swipe right on a message → quick reply
        setSwipeX(0)
        setReplyExpanded(true)
        setInteracting(true)
        clearTimer()
      } else {
        // Swipe left → dismiss (slide out to the left first)
        setSwipeX(-420)
        clearTimeout(timerRef.current)
        timerRef.current = setTimeout(() => dismiss({ keepOffset: true }), 200)
      }
    } else {
      setSwipeX(0)
    }
  }

  function handleTouchEnd() { endSwipe() }

  function handleTouchCancel() {
    dragRef.current = null
    setDragging(false)
    setSwipeX(0)
  }

  if (!visible && !show) return null

  return (
    <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', zIndex: 9998, maxWidth: 380, width: 'calc(100% - 32px)', fontFamily: T.font, animation: 'toastWrapperEnter 0.25s ease-out' }}>
      <div
        ref={toastRef}
        onClick={handleToastClick}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        role="alert"
        aria-live="polite"
        style={{
          background: T.white, borderRadius: 16, border: `1px solid ${T.gray200}`,
          boxShadow: T.shadowMd, overflow: 'hidden', cursor: replySent ? 'default' : 'pointer',
          transition: dragging ? 'none' : 'opacity 0.2s ease-in, transform 0.2s ease-in',
          animation: 'toastSlideIn 0.25s ease-out',
          opacity: show ? 1 : 0,
          transform: `translateX(${swipeX}px) ${show ? 'scale(1)' : 'scale(0.96)'}`,
          touchAction: 'pan-y',
          willChange: 'transform',
        }}
      >
        <div style={{ padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <div style={{ flexShrink: 0, position: 'relative' }}>
            <Avatar src={senderProfile?.avatar_url} name={displayName} size={40} />
            <div style={{
              position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderRadius: '50%',
              background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: T.white, lineHeight: 0, boxShadow: `0 0 0 2px ${T.white}`,
            }}>
              {getIcon(visible.type)}
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.gray900, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {displayName}
              </span>
              <span style={{ fontSize: 11, color: T.gray500, whiteSpace: 'nowrap', flexShrink: 0 }}>
                {formatTime(visible.created_at)}
              </span>
            </div>
            <div style={{ fontSize: 12, color: T.gray700, lineHeight: 1.35, marginTop: 3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {visible.body || visible.title || ''}
            </div>
          </div>
        </div>

        {isMessage && !replySent && (
          <div className="toast-reply-area">
            {replyExpanded ? (
              <div style={{ borderTop: `1px solid ${T.gray100}`, padding: '8px 12px 10px 12px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={replyText}
                  onChange={(e) => { setReplyText(e.target.value); setInteracting(true); clearTimer() }}
                  onFocus={handleInputFocus}
                  onBlur={handleInputBlur}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendReply() }}
                  placeholder="Quick reply..."
                  style={{
                    flex: 1, border: `1px solid ${T.gray300}`, borderRadius: 10, padding: '8px 12px',
                    fontSize: 13, fontFamily: 'inherit', outline: 'none', background: T.gray50,
                    color: T.gray900, minWidth: 0,
                  }}
                  maxLength={500}
                />
                <button
                  onClick={handleSendReply}
                  disabled={sending || !replyText.trim()}
                  style={{
                    background: sending || !replyText.trim() ? T.gray200 : T.green,
                    color: sending || !replyText.trim() ? T.gray500 : T.white,
                    border: 'none', borderRadius: 10, padding: '8px 14px', fontSize: 13, fontWeight: 700,
                    cursor: sending || !replyText.trim() ? 'default' : 'pointer', transition: 'background 0.15s',
                    whiteSpace: 'nowrap', flexShrink: 0,
                  }}
                >
                  {sending ? 'Sending...' : 'Send'}
                </button>
              </div>
            ) : (
              <div style={{ borderTop: `1px solid ${T.gray100}`, padding: '6px 12px', textAlign: 'center' }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setReplyExpanded(true); setInteracting(true); clearTimer() }}
                  style={{
                    background: 'none', border: 'none', color: T.green, fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', padding: '4px 12px', fontFamily: 'inherit',
                  }}
                >
                  <MessageCircle size={14} strokeWidth={2.5} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} />
                  Reply
                </button>
              </div>
            )}
          </div>
        )}

        {isMessage && replySent && (
          <div style={{ borderTop: `1px solid ${T.gray100}`, padding: '10px 16px', textAlign: 'center', fontSize: 13, color: T.green, fontWeight: 600 }}>
            <CheckCircle2 size={14} strokeWidth={2.5} style={{ display: 'inline', marginRight: 4, verticalAlign: -1 }} /> Reply sent
          </div>
        )}
      </div>
      <style>{`
        @keyframes toastWrapperEnter {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        @keyframes toastSlideIn {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .toast-reply-area input:focus {
          border-color: ${T.green} !important;
          box-shadow: 0 0 0 2px ${T.greenL} !important;
        }
      `}</style>
    </div>
  )
}
