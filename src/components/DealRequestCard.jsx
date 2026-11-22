import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { confirmDeal } from '../utils/vouchUtils'
import { AlertTriangle, Check, CheckCircle2, Clock, Handshake, Star, X } from 'lucide-react'

const TIERS = [
  { min: 0, max: 4, label: 'New Seller', color: '#6b7280' },
  { min: 5, max: 14, label: 'Rising', color: '#0f766e' },
  { min: 15, max: 29, label: 'Established', color: '#1d4ed8' },
  { min: 30, max: 59, label: 'Trusted', color: '#1a7a4a' },
  { min: 60, max: Infinity, label: 'Elite', color: '#b45309' },
]

const SHEET_STYLES = `
.drm-card,.drm-sheet{font-family:'DM Sans',Inter,system-ui,sans-serif;color:#202124}
.drm-card{width:100%;max-width:320px;background:#fff;border:1px solid #e8eaed;border-radius:16px;padding:14px;box-shadow:0 4px 16px rgba(16,24,40,.06)}
.drm-card-header{display:flex;align-items:flex-start;gap:10px}
.drm-card-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 34px;width:34px;height:34px;border-radius:10px;background:#e6f6ed;color:#0F9D58}
.drm-card-icon.is-waiting{background:#fff8e1;color:#b06000}
.drm-card-icon.is-danger{background:#fdecea;color:#d93025}
.drm-card-title{font-size:14px;font-weight:700;line-height:1.25}
.drm-card-subtitle{margin-top:2px;font-size:12px;line-height:1.35;color:#5f6368}
.drm-list-row{display:flex;align-items:center;gap:8px;margin-top:10px;padding:8px;border:1px solid #e8eaed;border-radius:12px;background:#f8f9fa}
.drm-list-thumb{width:34px;height:34px;border-radius:8px;object-fit:cover;background:#f1f3f4;flex:0 0 34px}
.drm-list-text{min-width:0;flex:1}
.drm-list-title{font-size:12px;font-weight:700;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
.drm-list-price{margin-top:2px;font-size:11px;font-weight:700;color:#0F9D58}
.drm-steps{display:grid;gap:0;margin-top:12px;padding:0;list-style:none}
.drm-step{display:flex;align-items:center;gap:8px;position:relative;min-height:30px;font-size:12px;line-height:1.3;color:#80868b}
.drm-step:not(:last-child)::after{content:'';position:absolute;left:10px;top:24px;bottom:-6px;width:1px;background:#e8eaed}
.drm-step.is-done,.drm-step.is-current{color:#202124}
.drm-step-dot{display:inline-flex;align-items:center;justify-content:center;flex:0 0 21px;width:21px;height:21px;border:1px solid #dadce0;border-radius:999px;background:#fff;font-size:10px;font-weight:700;color:#80868b}
.drm-step.is-done .drm-step-dot{border-color:#0F9D58;background:#e6f6ed;color:#0F9D58}
.drm-step.is-current .drm-step-dot{border-color:#0F9D58;background:#0F9D58;color:#fff}
.drm-hint{margin-top:10px;font-size:12px;line-height:1.4;color:#5f6368}
.drm-expiry{display:flex;align-items:center;gap:6px;margin-top:10px;font-size:11px;color:#80868b}
.drm-primary{display:inline-flex;align-items:center;justify-content:center;gap:8px;width:100%;min-height:44px;margin-top:12px;padding:0 14px;border:0;border-radius:12px;background:#0F9D58;color:#fff;font-family:inherit;font-size:14px;font-weight:700;cursor:pointer}
.drm-primary:disabled{opacity:.65;cursor:default}
.drm-ghost{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 14px;border:1px solid #e8eaed;border-radius:12px;background:#fff;color:#5f6368;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer}
.drm-note{display:flex;align-items:flex-start;gap:8px;margin-top:10px;padding:8px 10px;border-radius:10px;background:#f8f9fa;font-size:11px;line-height:1.4;color:#5f6368}
.drm-note.is-success{background:#e6f6ed;color:#0F9D58}
.drm-note.is-error{background:#fdecea;color:#d93025}
.drm-backdrop{position:fixed;inset:0;z-index:1200;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.4)}
.drm-sheet{width:100%;max-height:86dvh;overflow-y:auto;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));border-radius:16px 16px 0 0;background:#fff;box-shadow:0 -8px 30px rgba(16,24,40,.18)}
.drm-sheet-handle{width:36px;height:4px;margin:0 auto 12px;border-radius:999px;background:#dadce0}
.drm-sheet-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.drm-sheet-close{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;margin:-10px -10px 0 0;border:0;border-radius:50%;background:transparent;color:#5f6368;cursor:pointer}
.drm-sheet-actions{display:flex;gap:8px;margin-top:14px}
.drm-sheet-actions .drm-primary{margin-top:0;flex:1}
@media(min-width:769px){.drm-backdrop{align-items:center}.drm-sheet{width:420px;max-width:calc(100% - 32px);border-radius:16px;padding-bottom:16px}.drm-sheet-handle{display:none}}
@media(max-width:399px){.drm-card{padding:12px}.drm-card-title{font-size:13px}}
`

function getTier(score) {
  return TIERS.find((tier) => score >= tier.min && score <= tier.max) || TIERS[0]
}

function DealSteps({ steps, activeIndex }) {
  return (
    <ol className="drm-steps">
      {steps.map((step, index) => (
        <li
          key={step}
          className={[
            'drm-step',
            index < activeIndex ? 'is-done' : '',
            index === activeIndex ? 'is-current' : '',
          ].filter(Boolean).join(' ')}
        >
          <span className="drm-step-dot">{index < activeIndex ? <Check size={12} strokeWidth={2.5} /> : index + 1}</span>
          <span>{step}</span>
        </li>
      ))}
    </ol>
  )
}

function DealNotice({ text, tone }) {
  if (!text) return null
  return (
    <div className={`drm-note ${tone === 'error' ? 'is-error' : 'is-success'}`}>
      {tone === 'error' ? <AlertTriangle size={14} strokeWidth={2} /> : <CheckCircle2 size={14} strokeWidth={2} />}
      <span>{text}</span>
    </div>
  )
}

function DealSheet({ children, onClose }) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  return (
    <div className="drm-backdrop" onClick={onClose}>
      <div
        className="drm-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="drm-confirm-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drm-sheet-handle" aria-hidden="true" />
        {children}
      </div>
    </div>
  )
}

export default function DealRequestCard({ msg, currentUser, otherProfile, listing }) {
  const navigate = useNavigate()
  const dealId = msg.body
  const isSeller = msg.from_user === currentUser?.id

  const [deal, setDeal] = useState(null)
  const [working, setWorking] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [feedbackTone, setFeedbackTone] = useState('success')
  const [newScore, setNewScore] = useState(null)
  const [alreadyVouched, setAlreadyVouched] = useState(false)
  const [showConfirmSheet, setShowConfirmSheet] = useState(false)

  useEffect(() => { if (dealId) loadDeal() }, [dealId])

  useEffect(() => {
    if (!dealId) return undefined
    const channel = supabase
      .channel(`deal_${dealId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'deal_confirmations', filter: `id=eq.${dealId}` },
        (payload) => {
          if (payload.new) {
            setDeal(payload.new)
            if (payload.new.status === 'confirmed') loadPostConfirmData(payload.new)
          }
        },
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
    if (error) {
      setFeedback(error.message)
      setFeedbackTone('error')
      setWorking(false)
      return
    }
    setDeal(updated)
    setFeedbackTone('success')

    if (updated.status === 'confirmed') {
      await loadPostConfirmData(updated)
      setFeedback('Deal confirmed. You can now vouch for each other.')

      try {
        const { data: myProf } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', currentUser.id)
          .single()
        await supabase.from('notifications').insert({
          user_id: msg.from_user,
          type: 'deal_confirmed',
          title: '🎉 Deal confirmed!',
          body: `${myProf?.full_name || 'Buyer'} confirmed the deal for "${listing?.title || 'your listing'}"`,
          message: 'Deal confirmed',
          data: {
            deal_id: updated.id,
            listing_id: listing?.id,
            listing_title: listing?.title,
            buyer_id: currentUser.id,
            buyer_name: myProf?.full_name,
            seller_id: updated.seller_id,
            context_id: listing?.id,
          },
          read: false,
        })
      } catch (_) {}
    } else {
      setFeedback('Your confirmation was recorded. Waiting for the other party.')
    }
    setWorking(false)
  }

  if (!deal) return null

  const isConfirmed = deal.status === 'confirmed'
  const isDisputed = deal.status === 'disputed'
  const isExpired = deal.status === 'expired'
  const myConfirmed = isSeller ? deal.seller_confirmed : deal.buyer_confirmed
  const theyConfirmed = isSeller ? deal.buyer_confirmed : deal.seller_confirmed
  const otherName = otherProfile?.full_name || 'the other party'
  const score = newScore || 0
  const tier = getTier(score)
  const listingPrice = `MWK ${Number(listing?.price || 0).toLocaleString()}`
  const expiryText = deal.expires_at
    ? new Date(deal.expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : ''

  const listingRow = listing && (
    <div className="drm-list-row">
      {listing.images?.[0] && <img src={listing.images[0]} alt="" className="drm-list-thumb" />}
      <div className="drm-list-text">
        <div className="drm-list-title">{listing.title}</div>
        <div className="drm-list-price">{listingPrice}</div>
      </div>
    </div>
  )

  return (
    <>
      <style>{SHEET_STYLES}</style>
      {isExpired && (
        <div className="drm-card">
          <div className="drm-card-header">
            <span className="drm-card-icon is-waiting"><Clock size={18} strokeWidth={1.75} /></span>
            <div>
              <div className="drm-card-title">Deal request expired</div>
              <div className="drm-card-subtitle">The seller can send a new request if needed.</div>
            </div>
          </div>
        </div>
      )}

      {isDisputed && (
        <div className="drm-card">
          <div className="drm-card-header">
            <span className="drm-card-icon is-danger"><AlertTriangle size={18} strokeWidth={1.75} /></span>
            <div>
              <div className="drm-card-title">Deal disputed</div>
              <div className="drm-card-subtitle">This deal has been flagged for admin review.</div>
            </div>
          </div>
        </div>
      )}

      {isConfirmed && (
        <div className="drm-card">
          <div className="drm-card-header">
            <span className="drm-card-icon"><Handshake size={18} strokeWidth={1.75} /></span>
            <div style={{ flex: 1 }}>
              <div className="drm-card-title">Deal confirmed</div>
              <div className="drm-card-subtitle">
                {new Date(deal.buyer_confirmed_at || deal.seller_confirmed_at).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </div>
            </div>
            <span className="drm-card-icon"><CheckCircle2 size={18} strokeWidth={1.75} /></span>
          </div>
          {listingRow}
          <DealSteps steps={['Request sent', 'Both parties confirmed', 'Vouch for each other']} activeIndex={3} />
          {isSeller && newScore != null && (
            <div className="drm-note">
              <CheckCircle2 size={14} strokeWidth={2} />
              <span style={{ color: tier.color }}>
                {newScore > 0
                  ? `Trust score updated · ${tier.label} · ${newScore} pts`
                  : `Trust score · ${tier.label}`}
              </span>
            </div>
          )}
          {!isSeller && (
            alreadyVouched ? (
              <div className="drm-note is-success">
                <CheckCircle2 size={14} strokeWidth={2} />
                <span>You already vouched for {otherName}</span>
              </div>
            ) : (
              <button
                type="button"
                className="drm-primary"
                onClick={() => navigate(`/profile/${deal?.seller_id || msg.from_user}?vouch=1`)}
              >
                <Star size={16} strokeWidth={1.75} />
                Vouch for {otherName}
              </button>
            )
          )}
          {isSeller && (
            <div className="drm-note">
              <span>Ask {otherName} to vouch for you on your profile to grow your reputation.</span>
            </div>
          )}
        </div>
      )}

      {!isConfirmed && !isDisputed && !isExpired && isSeller && (
        <div className="drm-card">
          <div className="drm-card-header">
            <span className="drm-card-icon is-waiting"><Clock size={18} strokeWidth={1.75} /></span>
            <div style={{ flex: 1 }}>
              <div className="drm-card-title">Deal request sent</div>
              <div className="drm-card-subtitle">Waiting for {otherName} to confirm</div>
            </div>
          </div>
          {listingRow}
          <DealSteps
            steps={['You sent the request', `${otherName} confirms`, 'You can both vouch']}
            activeIndex={theyConfirmed ? 2 : 1}
          />
          {expiryText && (
            <div className="drm-expiry"><Clock size={13} strokeWidth={2} /> Expires {expiryText}</div>
          )}
          <DealNotice text={feedback} tone={feedbackTone} />
        </div>
      )}

      {!isConfirmed && !isDisputed && !isExpired && !isSeller && (
        <div className="drm-card">
          <div className="drm-card-header">
            <span className="drm-card-icon is-waiting"><Handshake size={18} strokeWidth={1.75} /></span>
            <div>
              <div className="drm-card-title">Deal confirmation request</div>
              <div className="drm-card-subtitle">{otherName} says the sale is complete</div>
            </div>
          </div>
          {listingRow}
          <DealSteps
            steps={['Seller sent request', 'You confirm the sale', 'You can both vouch']}
            activeIndex={myConfirmed ? 2 : 1}
          />
          <div className="drm-hint">
            Only confirm if you received the item as agreed. Your confirmation helps {otherName} build trust.
          </div>
          {!myConfirmed ? (
            <button type="button" className="drm-primary" onClick={() => setShowConfirmSheet(true)}>
              Review and confirm
            </button>
          ) : (
            <div className="drm-note">
              <Clock size={14} strokeWidth={2} />
              <span>Your confirmation was recorded. Waiting for {otherName}.</span>
            </div>
          )}
          <DealNotice text={feedback} tone={feedbackTone} />
        </div>
      )}

      {showConfirmSheet && (
        <DealSheet onClose={() => setShowConfirmSheet(false)}>
          <div className="drm-sheet-head">
            <div>
              <div id="drm-confirm-title" className="drm-card-title">Confirm this deal</div>
              <div className="drm-card-subtitle">One tap records your side of the deal.</div>
            </div>
            <button
              type="button"
              className="drm-sheet-close"
              aria-label="Close confirmation sheet"
              onClick={() => setShowConfirmSheet(false)}
            >
              <X size={20} strokeWidth={1.75} />
            </button>
          </div>
          {listingRow}
          <div className="drm-hint">
            Confirm only after the sale is complete. Both people must confirm before the deal is marked done.
          </div>
          <DealSteps steps={['Seller sent request', 'You confirm the sale', 'You can both vouch']} activeIndex={1} />
          <div className="drm-sheet-actions">
            <button type="button" className="drm-ghost" onClick={() => setShowConfirmSheet(false)}>Cancel</button>
            <button
              type="button"
              className="drm-primary"
              disabled={working}
              onClick={() => { setShowConfirmSheet(false); handleConfirm() }}
            >
              {working ? 'Confirming…' : 'Confirm deal'}
            </button>
          </div>
        </DealSheet>
      )}
    </>
  )
}
