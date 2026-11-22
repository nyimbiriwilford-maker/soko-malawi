import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { initiateDeal, confirmDeal, getPendingDeal } from '../utils/vouchUtils'
import { AlertTriangle, Check, CheckCircle2, Handshake, X } from 'lucide-react'

const BAR_STYLES = `
.dcb-bar,.dcb-sheet{font-family:'DM Sans',Inter,system-ui,sans-serif;color:#202124}
.dcb-bar{width:100%;background:#fff;border-top:1px solid #e8eaed;padding:10px 14px;display:flex;align-items:center;gap:10px;flex-shrink:0}
.dcb-bar-title{font-size:13px;font-weight:700;line-height:1.3;flex:1;min-width:0}
.dcb-bar-copy{font-size:12px;line-height:1.4;color:#5f6368}
.dcb-icon{display:inline-flex;align-items:center;justify-content:center;flex:0 0 26px;width:26px;height:26px;border-radius:8px;background:#e6f6ed;color:#0F9D58}
.dcb-icon.is-waiting{background:#fff8e1;color:#b06000}
.dcb-icon.is-danger{background:#fdecea;color:#d93025}
.dcb-primary{display:inline-flex;align-items:center;justify-content:center;gap:6px;min-height:44px;padding:0 14px;border:0;border-radius:12px;background:#0F9D58;color:#fff;font-family:inherit;font-size:13px;font-weight:700;white-space:nowrap;cursor:pointer}
.dcb-primary:disabled{opacity:.65;cursor:default}
.dcb-ghost{display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:0 14px;border:1px solid #e8eaed;border-radius:12px;background:#fff;color:#5f6368;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer}
.dcb-steps{display:flex;align-items:center;gap:6px;width:100%}
.dcb-step{display:flex;align-items:center;gap:5px;flex:1;min-width:0;font-size:11px;font-weight:600;color:#80868b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dcb-step-dot{display:inline-flex;align-items:center;justify-content:center;flex:0 0 18px;width:18px;height:18px;border:1px solid #dadce0;border-radius:999px;background:#fff;font-size:10px;color:#80868b}
.dcb-step.is-done{color:#0F9D58}
.dcb-step.is-done .dcb-step-dot{border-color:#0F9D58;background:#e6f6ed;color:#0F9D58}
.dcb-step.is-current{color:#202124}
.dcb-step.is-current .dcb-step-dot{border-color:#0F9D58;background:#0F9D58;color:#fff}
.dcb-expiry{font-size:11px;color:#80868b;white-space:nowrap}
.dcb-notice{display:flex;align-items:flex-start;gap:6px;margin-top:2px;font-size:12px;line-height:1.4;font-weight:600;color:#0F9D58}
.dcb-notice.is-error{color:#d93025}
.dcb-backdrop{position:fixed;inset:0;z-index:1200;display:flex;align-items:flex-end;justify-content:center;background:rgba(0,0,0,.4)}
.dcb-sheet{width:100%;max-height:86dvh;overflow-y:auto;padding:16px 16px calc(16px + env(safe-area-inset-bottom,0px));border-radius:16px 16px 0 0;background:#fff;box-shadow:0 -8px 30px rgba(16,24,40,.18)}
.dcb-sheet-handle{width:36px;height:4px;margin:0 auto 12px;border-radius:999px;background:#dadce0}
.dcb-sheet-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.dcb-sheet-title{font-size:16px;font-weight:700}
.dcb-sheet-close{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;margin:-10px -10px 0 0;border:0;border-radius:50%;background:transparent;color:#5f6368;cursor:pointer}
.dcb-sheet-actions{display:flex;gap:8px;margin-top:14px}
.dcb-sheet-actions .dcb-primary{flex:1;margin-top:0}
@media(min-width:769px){.dcb-backdrop{align-items:center}.dcb-sheet{width:420px;max-width:calc(100% - 32px);border-radius:16px;padding-bottom:16px}.dcb-sheet-handle{display:none}}
@media(max-width:399px){.dcb-step{font-size:10px}.dcb-expiry{display:none}}
`

function DealSteps({ steps, activeIndex }) {
  return (
    <div className="dcb-steps">
      {steps.map((step, index) => (
        <div
          key={step}
          className={[
            'dcb-step',
            index < activeIndex ? 'is-done' : '',
            index === activeIndex ? 'is-current' : '',
          ].filter(Boolean).join(' ')}
        >
          <span className="dcb-step-dot">{index < activeIndex ? <Check size={11} strokeWidth={2.5} /> : index + 1}</span>
          <span>{step}</span>
        </div>
      ))}
    </div>
  )
}

function DealNotice({ text, tone }) {
  if (!text) return null
  return (
    <div className={`dcb-notice ${tone === 'error' ? 'is-error' : ''}`}>
      {tone === 'error' ? <AlertTriangle size={14} strokeWidth={2} /> : <CheckCircle2 size={14} strokeWidth={2} />}
      <span>{text}</span>
    </div>
  )
}

function DealSheet({ children, onClose, labelId }) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  return (
    <div className="dcb-backdrop" onClick={onClose}>
      <div
        className="dcb-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelId}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="dcb-sheet-handle" aria-hidden="true" />
        {children}
      </div>
    </div>
  )
}

export default function DealConfirmBar({ currentUser, otherUserId, listing, onDealConfirmed }) {
  const [deal, setDeal] = useState(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [showInit, setShowInit] = useState(false)
  const [showConfirmSheet, setShowConfirmSheet] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgTone, setMsgTone] = useState('success')

  async function loadDeal() {
    const nextDeal = await getPendingDeal(listing.id, currentUser.id, otherUserId)
    setDeal(nextDeal)
    setLoading(false)
  }

  useEffect(() => {
    if (!listing?.id || !currentUser?.id || !otherUserId) {
      const timer = setTimeout(() => setLoading(false), 0)
      return () => clearTimeout(timer)
    }
    loadDeal()
  }, [listing?.id, currentUser?.id, otherUserId])

  async function handleInitiate() {
    if (!listing?.id) return
    setWorking(true)
    setMsg('')

    const isSeller = listing.seller_id === currentUser.id
    const buyerId = isSeller ? otherUserId : currentUser.id
    const sellerId = isSeller ? currentUser.id : otherUserId

    const { data, error } = await initiateDeal({
      listingId: listing.id,
      buyerId,
      sellerId,
      initiatedBy: currentUser.id,
    })

    if (error) {
      setMsg('Failed to initiate: ' + error.message)
      setMsgTone('error')
      setWorking(false)
      return
    }

    setDeal(data)
    setShowInit(false)

    try {
      const { data: myProf } = await supabase.from('profiles').select('full_name').eq('id', currentUser.id).single()
      const name = myProf?.full_name || 'Your contact'
      await supabase.from('notifications').insert({
        user_id: otherUserId,
        type: 'deal_initiated',
        title: '🤝 Deal confirmation request',
        body: `${name} wants to confirm the deal for "${listing.title}"`,
        message: `${name} wants to confirm the deal for "${listing.title}"`,
        data: { deal_id: data.id, listing_id: listing.id, listing_title: listing.title },
        read: false,
      })
    } catch (_) {}

    setWorking(false)
  }

  async function handleConfirm() {
    if (!deal?.id) return
    setWorking(true)
    setMsg('')
    const { data, error } = await confirmDeal(deal.id, currentUser.id)
    if (error) {
      setMsg(error.message)
      setMsgTone('error')
      setWorking(false)
      return
    }

    setDeal(data)
    setMsgTone('success')

    if (data.status === 'confirmed') {
      setMsg('Deal confirmed. You can now vouch for each other.')
      onDealConfirmed?.()
      try {
        const { data: myProf } = await supabase.from('profiles').select('full_name').eq('id', currentUser.id).single()
        await supabase.from('notifications').insert({
          user_id: otherUserId,
          type: 'deal_confirmed',
          title: '✅ Deal confirmed',
          body: `Your deal for "${listing.title}" has been confirmed by both parties.`,
          message: `Deal confirmed for "${listing.title}"`,
          data: { deal_id: data.id, listing_id: listing.id },
          read: false,
        })
      } catch (_) {}
    } else {
      setMsg('Your confirmation was recorded. Waiting for the other party.')
    }
    setWorking(false)
  }

  if (loading || !listing?.id) return null

  if (!deal) {
    return (
      <>
        <style>{BAR_STYLES}</style>
        {!showInit && (
          <div className="dcb-bar">
            <span className="dcb-icon"><Handshake size={16} strokeWidth={1.75} /></span>
            <span className="dcb-bar-title">Deal done in person?</span>
            <button type="button" className="dcb-primary" onClick={() => setShowInit(true)}>
              Mark deal as done
            </button>
          </div>
        )}
        {showInit && (
          <DealSheet labelId="dcb-init-title" onClose={() => setShowInit(false)}>
            <div className="dcb-sheet-head">
              <div>
                <div id="dcb-init-title" className="dcb-sheet-title">Confirm deal for</div>
                <div className="dcb-bar-copy">{listing.title}</div>
              </div>
              <button
                type="button"
                className="dcb-sheet-close"
                aria-label="Close deal confirmation sheet"
                onClick={() => setShowInit(false)}
              >
                <X size={20} strokeWidth={1.75} />
              </button>
            </div>
            <div className="dcb-bar-copy" style={{ marginTop: 10 }}>
              Both parties must confirm. The other person will receive a notification.
            </div>
            <DealSteps steps={['Open the request', 'Send to buyer', 'Buyer confirms']} activeIndex={0} />
            <DealNotice text={msg} tone={msgTone} />
            <div className="dcb-sheet-actions">
              <button type="button" className="dcb-ghost" onClick={() => setShowInit(false)}>Cancel</button>
              <button type="button" className="dcb-primary" onClick={handleInitiate} disabled={working}>
                {working ? 'Sending…' : 'Send confirmation request'}
              </button>
            </div>
          </DealSheet>
        )}
      </>
    )
  }

  const isBuyer = deal.buyer_id === currentUser.id
  const myConfirmed = isBuyer ? deal.buyer_confirmed : deal.seller_confirmed
  const theyConfirmed = isBuyer ? deal.seller_confirmed : deal.buyer_confirmed
  const expiryText = deal.expires_at
    ? new Date(deal.expires_at).toLocaleDateString()
    : ''

  return (
    <>
      <style>{BAR_STYLES}</style>
      {deal.status === 'confirmed' && (
        <div className="dcb-bar">
          <span className="dcb-icon"><CheckCircle2 size={16} strokeWidth={1.75} /></span>
          <span className="dcb-bar-title">Deal confirmed. You can now vouch for each other on the profile page.</span>
        </div>
      )}

      {deal.status === 'disputed' && (
        <div className="dcb-bar">
          <span className="dcb-icon is-danger"><AlertTriangle size={16} strokeWidth={1.75} /></span>
          <span className="dcb-bar-title">Deal disputed — under review.</span>
        </div>
      )}

      {!['confirmed', 'disputed'].includes(deal.status) && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="dcb-bar">
            <span className="dcb-icon is-waiting"><Handshake size={16} strokeWidth={1.75} /></span>
            <span className="dcb-bar-title">Deal confirmation pending</span>
            {expiryText && <span className="dcb-expiry">Expires {expiryText}</span>}
          </div>
          <div className="dcb-bar" style={{ paddingTop: 0, flexDirection: 'column', alignItems: 'stretch' }}>
            <DealSteps
              steps={[myConfirmed ? 'You confirmed' : 'You confirm', theyConfirmed ? 'They confirmed' : 'They confirm', 'Vouch']}
              activeIndex={myConfirmed ? (theyConfirmed ? 2 : 1) : 0}
            />
            {!myConfirmed && (
              <button type="button" className="dcb-primary" style={{ width: '100%', marginTop: 8 }} onClick={() => setShowConfirmSheet(true)}>
                Confirm my side
              </button>
            )}
            <DealNotice text={msg} tone={msgTone} />
          </div>
        </div>
      )}

      {showConfirmSheet && (
        <DealSheet labelId="dcb-confirm-title" onClose={() => setShowConfirmSheet(false)}>
          <div className="dcb-sheet-head">
            <div>
              <div id="dcb-confirm-title" className="dcb-sheet-title">Confirm your side</div>
              <div className="dcb-bar-copy">{listing.title}</div>
            </div>
            <button
              type="button"
              className="dcb-sheet-close"
              aria-label="Close deal confirmation sheet"
              onClick={() => setShowConfirmSheet(false)}
            >
              <X size={20} strokeWidth={1.75} />
            </button>
          </div>
          <div className="dcb-bar-copy" style={{ marginTop: 10 }}>
            Confirm only after the sale is complete. Both people must confirm before the deal is done.
          </div>
          <DealSteps steps={['You confirm', 'They confirm', 'Vouch']} activeIndex={0} />
          <DealNotice text={msg} tone={msgTone} />
          <div className="dcb-sheet-actions">
            <button type="button" className="dcb-ghost" onClick={() => setShowConfirmSheet(false)}>Cancel</button>
            <button
              type="button"
              className="dcb-primary"
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
