import { supabase } from './supabase'
import { fmtMWK } from '../utils/lookingFor'

export async function makeOffer(req, { user, navigate, onOfferStarted }) {
  if (!user) { navigate('/login'); return }
  if (!req || req.user_id === user.id) return

  const looking = (req.cities?.length ? req.cities.join(', ') : '') || req.city || ''
  const msg = `Hi, I can help with your request: "${req.title}"${req.budget ? `\nBudget: ${fmtMWK(req.budget)}` : ''}${req.city ? `\nBuyer stays: ${req.city}` : ''}${looking ? `\nLooking in: ${looking}` : ''}\n\nI have exactly what you need. Let's discuss!`

  const { error: offerErr } = await supabase.from('buyer_request_offers')
    .insert({ request_id: req.id, seller_id: user.id })

  console.log('Offer insert result:', offerErr?.message || 'success')

  if (!offerErr) {
    const { error: updateErr } = await supabase.rpc('increment_offer_count', { request_id: req.id })
    console.log('Count update:', updateErr?.message || 'success')
    onOfferStarted?.(req, true)
  } else if (offerErr.code === '23505') {
    onOfferStarted?.(req, false)
  } else {
    console.error('Offer error:', offerErr.message)
  }

  navigate(`/chat/${req.user_id}/${req.id}?src=request`, {
    state: {
      source: 'request',
      isRequest: true,
      prefillMessage: msg,
      requestTitle: req.title,
    },
  })
}
