// src/components/DealPillButton.jsx
// DEPRECATED: Deal confirmation now lives in Notifications (dealNotificationFlow.js).
// Chat no longer mounts this component. Kept for reference / emergency rollback only.
// Floating green pill shown to seller above input bar when there are messages.
// Tapping it opens the DealEducationModal.

import { useState } from 'react'
import DealEducationModal from './DealEducationModal'
import { sendDealRequest } from '../utils/vouchUtils'
import { supabase } from '../lib/supabase'

export default function DealPillButton({
  currentUser,
  otherProfile,
  listing,
  messages,
  isSeller,         // true if currentUser is the seller of this listing
  onRequestSent,    // callback(dealId) after request is sent into chat
}) {
  const [showModal, setShowModal] = useState(false)
  const [sent, setSent]           = useState(false)
  const [sending, setSending]     = useState(false)
  const [error, setError]         = useState('')

  // Only show if: there are messages AND user is seller AND listing exists
  if (!listing || !isSeller || messages.length < 4) return null
  // Hide once request has been sent this session
  if (sent) return (
    <div style={sentPill}>
      <span style={{ fontSize: 14 }}>✅</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#15803d' }}>
        Deal request sent · waiting for buyer
      </span>
      <div style={waitDot} />
    </div>
  )

  async function handleSend() {
    setSending(true)
    setError('')

    const actualBuyerId = otherProfile?.id
    if (!actualBuyerId) {
      setError('Could not identify buyer. Please try again.')
      setSending(false)
      return
    }
    console.log('[DealPill] sending:', { sellerId: currentUser.id, buyerId: actualBuyerId, listingId: listing.id, messageCount: messages.length })

    const { deal, error: err } = await sendDealRequest({
      sellerId:     currentUser.id,
      buyerId:      actualBuyerId,
      listingId:    listing.id,
      messageCount: messages.length,
    })

    if (err) {
      console.error('[DealPill] error:', err.message)
      setError(err.message)
      setSending(false)
      // Keep modal open so user sees the error
      return
    }

    // Insert a special message into the chat so buyer sees the card
    await supabase.from('messages').insert({
      from_user:  currentUser.id,
      to_user:    actualBuyerId,
      body:       deal.id,          // deal ID stored in body
      media_type: 'deal_request',
      listing_id: listing.id,
      read:       false,
    })

    // Notify buyer
    try {
      const { data: myProf } = await supabase
        .from('profiles').select('full_name').eq('id', currentUser.id).single()
      await supabase.from('notifications').insert({
        user_id: actualBuyerId,
        type:    'deal_request',
        title:   '🤝 Deal confirmation request',
        body:    `${myProf?.full_name || 'Seller'} wants to confirm the deal for "${listing.title}"`,
        message: `Deal confirmation request for "${listing.title}"`,
        data: {
          deal_id:       deal.id,
          seller_id:     currentUser.id,
          seller_name:   myProf?.full_name,
          listing_id:    listing.id,
          listing_title: listing.title,
          context_id:    listing.id,
        },
        read: false,
      })
    } catch (_) {}

    setSending(false)
    setShowModal(false)
    setSent(true)
    onRequestSent?.(deal.id)
  }

  return (
    <>
      {/* Error toast — sits above everything, always visible */}
      {error && (
        <div style={errorToast}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>🚫</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#dc2626' }}>Cannot send request</div>
            <div style={{ fontSize: 12, color: '#991b1b', marginTop: 2, lineHeight: 1.4 }}>{error}</div>
          </div>
          <button
            onClick={() => setError('')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#dc2626', fontSize: 18, padding: 0, flexShrink: 0 }}
          >✕</button>
        </div>
      )}

      <div style={pillWrap}>
        <button style={pill} onClick={() => { setError(''); setShowModal(true) }}>
          <span style={{ fontSize: 16 }}>🤝</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
            Confirm deal
          </span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="18 15 12 9 6 15"/>
          </svg>
        </button>
      </div>

      {showModal && (
        <DealEducationModal
          currentUser={currentUser}
          otherProfile={otherProfile}
          listing={listing}
          sending={sending}
          onSend={handleSend}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}

const pillWrap = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  padding: '6px 12px 2px',
  background: '#fff',
  borderTop: '1px solid #e8f0eb',
}

const pill = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  background: 'linear-gradient(135deg,#1a7a4a,#22a05e)',
  border: 'none',
  borderRadius: 24,
  padding: '9px 20px',
  cursor: 'pointer',
  boxShadow: '0 3px 12px rgba(26,122,74,0.35)',
  animation: 'slideUp 0.25s ease',
}

const sentPill = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  background: '#f0fdf4',
  border: '1px solid #b8d8c4',
  borderRadius: 24,
  padding: '8px 16px',
  margin: '6px 12px 2px',
}

const waitDot = {
  width: 8,
  height: 8,
  borderRadius: '50%',
  background: '#f59e0b',
  marginLeft: 'auto',
  animation: 'pulse 1.5s infinite',
}

const errorNote = {
  fontSize: 11,
  color: '#dc2626',
  fontWeight: 600,
  background: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: 8,
  padding: '5px 10px',
  marginBottom: 6,
  textAlign: 'center',
}
const errorToast = {
  position: 'fixed',
  bottom: 90,
  left: 16,
  right: 16,
  maxWidth: 448,
  margin: '0 auto',
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  background: '#fef2f2',
  border: '1.5px solid #fecaca',
  borderRadius: 14,
  padding: '12px 14px',
  boxShadow: '0 4px 20px rgba(220,38,38,0.2)',
  zIndex: 600,
  animation: 'slideUp 0.25s ease',
}