import { useNavigate } from 'react-router-dom'
import { S, STATUS_COLORS, timeAgo, playConfirmSound } from './serviceData'

export default function BookingsTabs({ tab, myBookings, incomingBookings, bookingsLoading, onUpdateStatus, onTabChange, newBookingNotif, onDismissNotif }) {
  const navigate = useNavigate()

  function chatWith(booking) {
    // For customer: chat with provider. Use service_id as listing context.
    navigate(`/chat/${booking.provider_id}/${booking.service_id}`)
  }

  function chatWithCustomer(booking) {
    navigate(`/chat/${booking.customer_id}/${booking.service_id}`)
  }

  return (
    <>
      {tab === 'bookings' && (
        <div style={S.feed}>
          <div style={S.sectionLabel}>Your Bookings</div>
          {bookingsLoading && [1, 2].map(i => <div key={i} style={S.skeleton} />)}
          {!bookingsLoading && myBookings.length === 0 && (
            <div style={S.empty}>
              <div style={S.emptyIcon}>📅</div>
              <p style={S.emptyTitle}>No bookings yet</p>
              <p style={S.emptySub}>Browse services and book a provider</p>
              <button style={S.postFirstBtn} onClick={() => onTabChange('browse')}>Browse Services</button>
            </div>
          )}
          {!bookingsLoading && myBookings.map(b => {
            const st = STATUS_COLORS[b.status] || STATUS_COLORS.pending
            return (
              <div key={b.id} style={S.bookingCard}>
                <div style={S.bookingCardTop}>
                  <div style={S.bookingCardIcon}>
                    {b.status === 'confirmed' ? '✅' : b.status === 'completed' ? '🏁' : b.status === 'cancelled' ? '❌' : '📅'}
                  </div>
                  <div style={S.bookingCardInfo}>
                    <div style={S.bookingCardTitle}>{b.services?.name || 'Service'}</div>
                    <div style={S.bookingCardMeta}>
                      {b.services?.category && <span>{b.services.category}</span>}
                      {b.services?.city && <span> · 📍 {b.services.city}</span>}
                      {b.date && <span> · 📆 {b.date}</span>}
                    </div>
                  </div>
                  <span style={{ ...S.statusBadge, background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                {b.description && <p style={S.bookingDesc}>"{b.description}"</p>}
                {b.services?.rate && <div style={S.bookingRate}>💰 {b.services.rate}</div>}

                {b.status === 'confirmed' && (
                  <div style={{ background: '#e6f7ee', borderRadius: '10px', padding: '10px 12px', marginTop: '8px', fontSize: '12px', color: '#1a7a4a', lineHeight: '1.6' }}>
                    ✅ <strong>Confirmed!</strong> Pay the 50% deposit to lock your slot, then pay the rest on completion.
                  </div>
                )}

                {/* Chat button — available once confirmed */}
                {(b.status === 'confirmed' || b.status === 'completed') && (
                  <button style={S.chatWithBtn} onClick={() => chatWith(b)}>
                    💬 Chat with provider
                  </button>
                )}

                {b.status === 'pending' && (
                  <button style={S.cancelBookingBtn} onClick={() => onUpdateStatus(b.id, 'cancelled')}>Cancel booking</button>
                )}
                {b.status === 'confirmed' && (
                  <button style={S.completeBtn} onClick={() => onUpdateStatus(b.id, 'completed')}>Mark as completed ✓</button>
                )}
                <div style={S.bookingDate}>Booked {timeAgo(b.created_at)}</div>
              </div>
            )
          })}
        </div>
      )}

      {tab === 'incoming' && (
        <div style={S.feed}>
          {newBookingNotif && (
            <div style={S.notifBanner}>
              <span style={{ fontSize: '20px' }}>🔔</span>
              <span style={S.notifText}>New booking request received!</span>
              <button style={S.notifDismiss} onClick={onDismissNotif}>Dismiss</button>
            </div>
          )}
          <div style={S.sectionLabel}>
            Booking Requests
            {incomingBookings.filter(b => b.status === 'pending').length > 0 && (
              <span style={S.countBadge}>{incomingBookings.filter(b => b.status === 'pending').length} pending</span>
            )}
          </div>
          {incomingBookings.length === 0 && (
            <div style={S.empty}>
              <div style={S.emptyIcon}>📋</div>
              <p style={S.emptyTitle}>No requests yet</p>
              <p style={S.emptySub}>Booking requests from customers will appear here</p>
            </div>
          )}
          {incomingBookings.map(b => {
            const st = STATUS_COLORS[b.status] || STATUS_COLORS.pending
            return (
              <div key={b.id} style={{ ...S.bookingCard, borderLeft: b.status === 'pending' ? '3px solid #1a7a4a' : '3px solid transparent' }}>
                <div style={S.bookingCardTop}>
                  <div style={S.bookingCardIcon}>👤</div>
                  <div style={S.bookingCardInfo}>
                    <div style={S.bookingCardTitle}>{b.status === 'pending' ? '🔔 New booking request' : 'Booking request'}</div>
                    <div style={S.bookingCardMeta}>{b.date && <span>📆 Requested for {b.date}</span>}</div>
                  </div>
                  <span style={{ ...S.statusBadge, background: st.bg, color: st.color }}>{st.label}</span>
                </div>
                {b.description && <p style={S.bookingDesc}>"{b.description}"</p>}

                {b.status === 'pending' && (
                  <div style={S.incomingActions}>
                    <button style={S.confirmBtn} onClick={() => { onUpdateStatus(b.id, 'confirmed'); playConfirmSound() }}>✅ Confirm</button>
                    <button style={S.declineBtn} onClick={() => onUpdateStatus(b.id, 'cancelled')}>❌ Decline</button>
                  </div>
                )}

                {(b.status === 'confirmed' || b.status === 'completed') && (
                  <button style={S.chatWithBtn} onClick={() => chatWithCustomer(b)}>
                    💬 Chat with customer
                  </button>
                )}

                {b.status === 'confirmed' && (
                  <button style={S.completeBtn} onClick={() => onUpdateStatus(b.id, 'completed')}>Mark as completed ✓</button>
                )}
                <div style={S.bookingDate}>Received {timeAgo(b.created_at)}</div>
              </div>
            )
          })}
        </div>
      )}
    </>
  )
}