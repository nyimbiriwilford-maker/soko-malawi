// src/components/DealRequestCard.jsx
// Renders inside the chat message list as a special card.
// Shown to buyer as a confirmation request, to seller as status tracker.
// After confirmation, shows vouch prompt and trust score update.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { confirmDeal } from '../utils/vouchUtils'

const TIERS = [
  { min: 0,  max: 4,  icon: '👤', label: 'New Seller',  color: '#6b7280' },
  { min: 5,  max: 14, icon: '🔰', label: 'Rising',      color: '#0f766e' },
  { min: 15, max: 29, icon: '✅', label: 'Established', color: '#1d4ed8' },
  { min: 30, max: 59, icon: '🛡️', label: 'Trusted',     color: '#1a7a4a' },
  { min: 60, max: Infinity, icon: '⭐', label: 'Elite',  color: '#b45309' },
]
function getTier(score) { return TIERS.find(t => score >= t.min && score <= t.max) || TIERS[0] }

export default function DealRequestCard({ msg, currentUser, otherProfile, listing }) {
  const navigate  = useNavigate()
  const dealId    = msg.body
  const isSeller  = msg.from_user === currentUser?.id

  const [deal,       setDeal]       = useState(null)
  const [working,    setWorking]    = useState(false)
  const [feedback,   setFeedback]   = useState('')
  const [newScore,   setNewScore]   = useState(null)
  const [alreadyVouched, setAlreadyVouched] = useState(false)

  useEffect(() => { if (dealId) loadDeal() }, [dealId])

  useEffect(() => {
    if (!dealId) return
    const channel = supabase
      .channel(`deal_${dealId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'deal_confirmations', filter: `id=eq.${dealId}` },
        payload => {
          if (payload.new) {
            setDeal(payload.new)
            if (payload.new.status === 'confirmed') loadPostConfirmData(payload.new)
          }
        }
      )
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [dealId])

 async function loadDeal() {
    const { data } = await supabase
      .from('deal_confirmations')
      .select('*')
      .eq('id', dealId)
      .maybeSingle()
    if (data) {
      setDeal(data)
      if (data.status === 'confirmed') await loadPostConfirmData(data)
    } else if (!deal) setDeal(null)
  }

  async function loadPostConfirmData(confirmedDeal) {
    const { data: ts } = await supabase
      .from('trust_scores')
      .select('total_score')
      .eq('user_id', confirmedDeal.seller_id)
      .maybeSingle()
    if (ts) setNewScore(Math.round(ts.total_score))

    const { data: v } = await supabase
      .from('vouches')
      .select('id')
      .eq('voucher_id', currentUser.id)
      .eq('vouchee_id', confirmedDeal.seller_id)
      .maybeSingle()
    if (v) setAlreadyVouched(true)
  }
  async function handleConfirm() {
    if (!deal) return
    setWorking(true)
    setFeedback('')
    const { deal: updated, error } = await confirmDeal(deal.id, currentUser.id)
    if (error) { setFeedback(error.message); setWorking(false); return }
    setDeal(updated)

    if (updated.status === 'confirmed') {
      await loadPostConfirmData(updated)

      // Notify seller
      try {
        const { data: myProf } = await supabase
          .from('profiles').select('full_name').eq('id', currentUser.id).single()
        await supabase.from('notifications').insert({
          user_id: msg.from_user,
          type:    'deal_confirmed',
          title:   '🎉 Deal confirmed!',
          body:    `${myProf?.full_name || 'Buyer'} confirmed the deal for "${listing?.title || 'your listing'}"`,
          message: `Deal confirmed`,
          data: {
            deal_id:       updated.id,
            listing_id:    listing?.id,
            listing_title: listing?.title,
            buyer_id:      currentUser.id,
            buyer_name:    myProf?.full_name,
            seller_id:     updated.seller_id,
            context_id:    listing?.id,
          },
          read: false,
        })
      } catch (_) {}
    }
    setWorking(false)
  }

  if (!deal) return null

  const isConfirmed  = deal.status === 'confirmed'
  const isDisputed   = deal.status === 'disputed'
  const isExpired    = deal.status === 'expired'
  const myConfirmed  = isSeller ? deal.seller_confirmed : deal.buyer_confirmed
  const theyConfirmed = isSeller ? deal.buyer_confirmed : deal.seller_confirmed
  const otherName    = otherProfile?.full_name || 'the other party'
  const score        = newScore || 0
  const tier         = getTier(score)

  // ── Expired ──
  if (isExpired) {
    return (
      <div style={card('#f9fafb', '#e5e7eb')}>
        <div style={row}>
          <span style={{ fontSize: 20 }}>⏰</span>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280' }}>Deal request expired</div>
        </div>
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>Seller can send a new request if needed.</div>
      </div>
    )
  }

  // ── Disputed ──
  if (isDisputed) {
    return (
      <div style={card('#fef2f2', '#fecaca')}>
        <div style={row}>
          <span style={{ fontSize: 20 }}>⚠️</span>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#dc2626' }}>Deal disputed</div>
        </div>
        <div style={{ fontSize: 11, color: '#637068', marginTop: 4 }}>This deal has been flagged for admin review.</div>
      </div>
    )
  }

  // ── Confirmed ──
  if (isConfirmed) {
    return (
      <div style={card('#e6f4ec', '#b8d8c4')}>
        <div style={{ ...row, marginBottom: 10 }}>
          <span style={{ fontSize: 22 }}>🤝</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#15803d' }}>Deal Confirmed!</div>
            <div style={{ fontSize: 11, color: '#637068', marginTop: 1 }}>
              {new Date(deal.buyer_confirmed_at || deal.seller_confirmed_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
            </div>
          </div>
          <div style={confirmedBadge}>✓ Done</div>
        </div>

        {listing && (
          <div style={listingRow}>
            {listing.images?.[0] && <img src={listing.images[0]} alt="" style={thumb} />}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0f1410', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{listing.title}</div>
              <div style={{ fontSize: 11, color: '#1a7a4a', fontWeight: 700 }}>MWK {Number(listing.price || 0).toLocaleString()}</div>
            </div>
          </div>
        )}

        {/* Trust score update — shown to seller */}
        {isSeller && newScore != null && (
          <div style={scoreRow}>
            <span style={{ fontSize: 13 }}>{tier.icon}</span>
            <span style={{ fontSize: 12, color: tier.color, fontWeight: 700 }}>
              {newScore > 0
                ? `Trust score updated · ${tier.label} · ${newScore} pts`
                : `Trust score · ${tier.label}`}
            </span>
          </div>
        )}

        {/* Vouch prompt — shown to buyer */}
        {!isSeller && (
          alreadyVouched ? (
            <div style={alreadyVouchedNote}>
              <span style={{ fontSize: 13 }}>✅</span>
              <span style={{ fontSize: 12, color: '#15803d', fontWeight: 600 }}>
                You already vouched for {otherName}
              </span>
            </div>
          ) : (
            <button style={vouchBtn} onClick={() => navigate(`/profile/${deal?.seller_id || msg.from_user}?vouch=1`)}>
              <span style={{ fontSize: 16 }}>🌟</span>
              <div style={{ textAlign: 'left', flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1a7a4a' }}>Vouch for {otherName}</div>
                <div style={{ fontSize: 11, color: '#637068' }}>Your vouch helps them get more buyers · Ulemu wao ukukula</div>
              </div>
              <span style={{ fontSize: 14, color: '#1a7a4a' }}>→</span>
            </button>
          )
        )}

        {/* Seller prompt */}
        {isSeller && (
          <div style={sellerNote}>
            <span style={{ fontSize: 13 }}>💬</span>
            <span style={{ fontSize: 11, color: '#637068', lineHeight: 1.5 }}>
              Ask {otherName} to vouch for you on your profile to grow your reputation.
            </span>
          </div>
        )}
      </div>
    )
  }

  // ── Pending — seller view ──
  if (isSeller) {
    return (
      <div style={card('#f0fdf4', '#d4ead9')}>
        <div style={{ ...row, marginBottom: 10 }}>
          <span style={{ fontSize: 20 }}>🤝</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: '#1a7a4a' }}>Deal confirmation sent</div>
            <div style={{ fontSize: 11, color: '#637068', marginTop: 1 }}>Waiting for {otherName} to confirm</div>
          </div>
          <div style={pulseDot('#f59e0b')} />
        </div>

        <div style={progressRow}>
          <div style={progressChip(true, '#1a7a4a')}>✓ You requested</div>
          <span style={{ fontSize: 12, color: '#aaa' }}>→</span>
          <div style={progressChip(theyConfirmed, '#1a7a4a')}>
            {theyConfirmed ? '✓' : '⏳'} {otherName}
          </div>
        </div>

        <div style={{ fontSize: 10, color: '#aaa', marginTop: 8, textAlign: 'center' }}>
          Expires {new Date(deal.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
        </div>
      </div>
    )
  }

  // ── Pending — buyer view ──
  return (
    <div style={card('#fffbeb', '#fde68a')}>
      <div style={{ ...row, marginBottom: 10 }}>
        <span style={{ fontSize: 22 }}>🤝</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 800, color: '#0f1410' }}>Deal confirmation request</div>
          <div style={{ fontSize: 11, color: '#637068', marginTop: 1 }}>{otherName} wants to confirm this deal</div>
        </div>
      </div>

      {listing && (
        <div style={listingRow}>
          {listing.images?.[0] && <img src={listing.images[0]} alt="" style={thumb} />}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#0f1410', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>{listing.title}</div>
            <div style={{ fontSize: 11, color: '#1a7a4a', fontWeight: 700 }}>MWK {Number(listing.price || 0).toLocaleString()}</div>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12, color: '#637068', margin: '6px 0 10px', lineHeight: 1.5 }}>
        Confirming helps {otherName} build their reputation on SokoMW.
        Only confirm if you genuinely completed this transaction.
      </div>

      {!myConfirmed ? (
        <button style={confirmBtn} onClick={handleConfirm} disabled={working}>
          {working
            ? <div style={spinner} />
            : <><span style={{ fontSize: 15 }}>✅</span> Confirm Deal</>}
        </button>
      ) : (
        <div style={waitingNote}>
          <span style={{ fontSize: 13 }}>⏳</span>
          <span style={{ fontSize: 12, color: '#637068', fontWeight: 600 }}>
            Your confirmation recorded. Waiting for {otherName}.
          </span>
        </div>
      )}

      {feedback && (
        <div style={{ fontSize: 12, color: '#dc2626', marginTop: 8, fontWeight: 600 }}>{feedback}</div>
      )}
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const card = (bg, border) => ({
  background: bg,
  border: `1.5px solid ${border}`,
  borderRadius: 16,
  padding: '13px',
  maxWidth: 280,
  width: '100%',
})

const row = { display: 'flex', alignItems: 'center', gap: 10 }

const listingRow = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: 'rgba(255,255,255,0.65)',
  borderRadius: 10, padding: '7px 10px', marginBottom: 10,
}

const thumb = { width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }

const confirmBtn = {
  width: '100%',
  background: 'linear-gradient(135deg,#1a7a4a,#22a05e)',
  color: '#fff', border: 'none', borderRadius: 12, padding: '11px',
  fontSize: 14, fontWeight: 700, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
}

const vouchBtn = {
  width: '100%', background: '#fff',
  border: '1.5px solid #b8d8c4',
  borderRadius: 12, padding: '10px 12px',
  display: 'flex', alignItems: 'center', gap: 10,
  cursor: 'pointer', marginTop: 8,
}

const confirmedBadge = {
  background: '#15803d', color: '#fff',
  fontSize: 10, fontWeight: 800,
  borderRadius: 20, padding: '3px 8px', flexShrink: 0,
}

const scoreRow = {
  display: 'flex', alignItems: 'center', gap: 6,
  background: 'rgba(255,255,255,0.6)',
  borderRadius: 8, padding: '6px 10px', marginBottom: 8,
}

const sellerNote = {
  display: 'flex', alignItems: 'flex-start', gap: 8,
  background: 'rgba(255,255,255,0.5)',
  borderRadius: 10, padding: '8px 10px', marginTop: 8,
}

const alreadyVouchedNote = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: 'rgba(255,255,255,0.6)',
  borderRadius: 10, padding: '8px 10px', marginTop: 6,
}

const progressRow = {
  display: 'flex', alignItems: 'center', gap: 6, marginTop: 4,
}

const progressChip = (done, color) => ({
  flex: 1, textAlign: 'center',
  padding: '5px 6px', borderRadius: 8,
  fontSize: 11, fontWeight: 700,
  background: done ? '#e6f4ec' : '#f4f8f5',
  color: done ? color : '#888',
})

const pulseDot = (color) => ({
  width: 10, height: 10, borderRadius: '50%',
  background: color, marginLeft: 'auto', flexShrink: 0,
  animation: 'pulse 1.5s infinite',
})

const waitingNote = {
  display: 'flex', alignItems: 'center', gap: 8,
  background: 'rgba(255,255,255,0.6)',
  borderRadius: 10, padding: '8px 10px', marginTop: 4,
}

const spinner = {
  width: 16, height: 16,
  border: '2px solid rgba(255,255,255,0.4)',
  borderTopColor: '#fff', borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
}