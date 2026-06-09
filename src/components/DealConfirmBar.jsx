// src/components/DealConfirmBar.jsx
// Drop this inside Chat.jsx, just above the {!recording && callState === 'idle' && ( input bar )}
//
// Required props:
//   currentUser, otherUserId, listing (the listing object already loaded in Chat)
//   onDealConfirmed — callback after both sides confirm (to refresh any UI)

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { initiateDeal, confirmDeal, getPendingDeal } from '../utils/vouchUtils'

export default function DealConfirmBar({ currentUser, otherUserId, listing, onDealConfirmed }) {
  const [deal,      setDeal]      = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [working,   setWorking]   = useState(false)
  const [showInit,  setShowInit]  = useState(false)
  const [msg,       setMsg]       = useState('')

  useEffect(() => {
    if (!listing?.id || !currentUser?.id || !otherUserId) { setLoading(false); return }
    loadDeal()
  }, [listing?.id, currentUser?.id, otherUserId])

  async function loadDeal() {
    const d = await getPendingDeal(listing.id, currentUser.id, otherUserId)
    setDeal(d)
    setLoading(false)
  }

  async function handleInitiate() {
    if (!listing?.id) return
    setWorking(true)
    setMsg('')

    // Determine roles: if current user is the seller, they initiate as seller
    const isSeller = listing.seller_id === currentUser.id
    const buyerId  = isSeller ? otherUserId  : currentUser.id
    const sellerId = isSeller ? currentUser.id : otherUserId

    const { data, error } = await initiateDeal({
      listingId:   listing.id,
      buyerId,
      sellerId,
      initiatedBy: currentUser.id,
    })

    if (error) { setMsg('Failed to initiate: ' + error.message); setWorking(false); return }

    setDeal(data)
    setShowInit(false)

    // Notify the other party
    try {
      const { data: myProf } = await supabase.from('profiles').select('full_name').eq('id', currentUser.id).single()
      const name = myProf?.full_name || 'Your contact'
      await supabase.from('notifications').insert({
        user_id: otherUserId,
        type:    'deal_initiated',
        title:   '🤝 Deal confirmation request',
        body:    `${name} wants to confirm the deal for "${listing.title}"`,
        message: `${name} wants to confirm the deal for "${listing.title}"`,
        data:    { deal_id: data.id, listing_id: listing.id, listing_title: listing.title },
        read:    false,
      })
    } catch (_) {}

    setWorking(false)
  }

  async function handleConfirm() {
    if (!deal?.id) return
    setWorking(true)
    setMsg('')
    const { data, error } = await confirmDeal(deal.id, currentUser.id)
    if (error) { setMsg(error.message); setWorking(false); return }

    setDeal(data)

    if (data.status === 'confirmed') {
      setMsg('✅ Deal confirmed! You can now vouch for each other.')
      onDealConfirmed?.()
      // Notify other party
      try {
        const { data: myProf } = await supabase.from('profiles').select('full_name').eq('id', currentUser.id).single()
        await supabase.from('notifications').insert({
          user_id: otherUserId,
          type:    'deal_confirmed',
          title:   '✅ Deal confirmed',
          body:    `Your deal for "${listing.title}" has been confirmed by both parties.`,
          message: `Deal confirmed for "${listing.title}"`,
          data:    { deal_id: data.id, listing_id: listing.id },
          read:    false,
        })
      } catch (_) {}
    } else {
      setMsg('✔ Your confirmation recorded. Waiting for the other party.')
    }
    setWorking(false)
  }

  if (loading || !listing?.id) return null

  // No deal exists yet — show initiate prompt
  if (!deal) {
    if (!showInit) {
      return (
        <div style={bar}>
          <span style={{ fontSize: 13, color: '#637068', flex: 1 }}>Deal done in person?</span>
          <button style={greenBtn} onClick={() => setShowInit(true)}>
            🤝 Mark deal as done
          </button>
        </div>
      )
    }
    return (
      <div style={{ ...bar, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#0f1410' }}>
          Confirm deal for: <em style={{ color: '#1a7a4a' }}>{listing.title}</em>
        </div>
        <div style={{ fontSize: 12, color: '#637068' }}>
          Both parties must confirm. The other person will receive a notification.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button style={ghostBtn} onClick={() => setShowInit(false)}>Cancel</button>
          <button style={{ ...greenBtn, flex: 1 }} onClick={handleInitiate} disabled={working}>
            {working ? 'Sending…' : 'Send confirmation request'}
          </button>
        </div>
      </div>
    )
  }

  // Deal exists — show status
  const isBuyer      = deal.buyer_id  === currentUser.id
  const myConfirmed  = isBuyer ? deal.buyer_confirmed  : deal.seller_confirmed
  const theyConfirmed = isBuyer ? deal.seller_confirmed : deal.buyer_confirmed

  if (deal.status === 'confirmed') {
    return (
      <div style={{ ...bar, background: '#e6f4ec', borderColor: '#b8d8c4' }}>
        <span style={{ fontSize: 16 }}>✅</span>
        <span style={{ fontSize: 13, color: '#15803d', fontWeight: 700, flex: 1 }}>
          Deal confirmed! You can now vouch for each other on the profile page.
        </span>
      </div>
    )
  }

  if (deal.status === 'disputed') {
    return (
      <div style={{ ...bar, background: '#fef2f2', borderColor: '#fecaca' }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <span style={{ fontSize: 13, color: '#dc2626', fontWeight: 700, flex: 1 }}>
          Deal disputed — under review.
        </span>
      </div>
    )
  }

  return (
    <div style={{ ...bar, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 16 }}>🤝</span>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0f1410', flex: 1 }}>
          Deal confirmation pending
        </span>
        <span style={{ fontSize: 10, color: '#aaa' }}>
          Expires {new Date(deal.expires_at).toLocaleDateString()}
        </span>
      </div>

      {/* Progress */}
      <div style={{ display: 'flex', gap: 8 }}>
        <div style={{
          flex: 1, padding: '5px 10px', borderRadius: 8,
          background: myConfirmed ? '#e6f4ec' : '#f4f8f5',
          border: `1px solid ${myConfirmed ? '#b8d8c4' : '#e0ebe3'}`,
          fontSize: 11, fontWeight: 700,
          color: myConfirmed ? '#15803d' : '#888',
          textAlign: 'center',
        }}>
          {myConfirmed ? '✓ You confirmed' : 'You — pending'}
        </div>
        <div style={{
          flex: 1, padding: '5px 10px', borderRadius: 8,
          background: theyConfirmed ? '#e6f4ec' : '#f4f8f5',
          border: `1px solid ${theyConfirmed ? '#b8d8c4' : '#e0ebe3'}`,
          fontSize: 11, fontWeight: 700,
          color: theyConfirmed ? '#15803d' : '#888',
          textAlign: 'center',
        }}>
          {theyConfirmed ? '✓ They confirmed' : 'Them — pending'}
        </div>
      </div>

      {!myConfirmed && (
        <button style={{ ...greenBtn, marginTop: 2 }} onClick={handleConfirm} disabled={working}>
          {working ? 'Confirming…' : '✓ Confirm my side'}
        </button>
      )}

      {msg && <div style={{ fontSize: 12, color: '#1a7a4a', fontWeight: 600 }}>{msg}</div>}
    </div>
  )
}

const bar = {
  background: '#fff',
  borderTop: '1px solid #e8f0eb',
  padding: '10px 14px',
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexShrink: 0,
}

const greenBtn = {
  background: '#1a7a4a',
  color: '#fff',
  border: 'none',
  borderRadius: 10,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  whiteSpace: 'nowrap',
}

const ghostBtn = {
  background: '#f4f8f5',
  color: '#637068',
  border: '1px solid #e0ebe3',
  borderRadius: 10,
  padding: '8px 14px',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}