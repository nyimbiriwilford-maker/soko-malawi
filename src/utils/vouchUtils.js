// src/utils/vouchUtils.js
// All vouching + deal confirmation logic for SokoMW

import { supabase } from '../lib/supabase'

// ── TRUST SCORE ──────────────────────────────────────────────────────────────

export async function getTrustScore(userId) {
  const { data } = await supabase
    .from('trust_scores')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  return data
}

export async function getConfirmedDealCount(userId) {
  const { count } = await supabase
    .from('deal_confirmations')
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', userId)
    .eq('status', 'confirmed')
  return count || 0
}

// ── DEAL CONFIRMATIONS ───────────────────────────────────────────────────────

/**
 * Fetch the most recent active deal between two users for a listing.
 * Returns pending/confirmed/disputed within 30 days.
 * After 30 days a new deal can start.
 */
export async function getPendingDeal(listingId, userId, otherId) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data } = await supabase
    .from('deal_confirmations')
    .select('*')
    .eq('listing_id', listingId)
    .in('status', ['pending', 'confirmed', 'disputed'])
    .gte('created_at', thirtyDaysAgo)
    .or(`and(buyer_id.eq.${userId},seller_id.eq.${otherId}),and(buyer_id.eq.${otherId},seller_id.eq.${userId})`)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data
}

/**
 * Seller sends a deal confirmation request.
 * Anti-fraud: requires minimum messages, listing must exist, no existing active deal.
 * Returns { deal, error }
 */
export async function sendDealRequest({ sellerId, buyerId, listingId, messageCount }) {
  // Anti-fraud: minimum 4 messages

  // Check listing is at least 24hrs old
  const { data: listing } = await supabase
    .from('listings')
    .select('created_at, title, price, images')
    .eq('id', listingId)
    .maybeSingle()

  if (!listing) {
    return { deal: null, error: { message: 'Listing not found.' } }
  }

  const listingAge = Date.now() - new Date(listing.created_at)
  if (listingAge < 24 * 60 * 60 * 1000) {
    return { deal: null, error: { message: 'This listing must be at least 24 hours old before confirming a deal.' } }
  }

  // Anti-fraud: minimum 4 messages required
  if (messageCount < 4) {
    return { deal: null, error: { message: 'You need at least 4 messages with the buyer before confirming a deal.' } }
  }

  // Check no existing active deal
  const existing = await getPendingDeal(listingId, sellerId, buyerId)
  if (existing && existing.status === 'pending') {
    return { deal: existing, error: { message: 'A deal request is already pending.' } }
  }
  if (existing && existing.status === 'confirmed') {
    return { deal: existing, error: { message: 'This deal was already confirmed.' } }
  }

  // Anti-fraud: block if seller has 5+ deals in last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { count: recentCount } = await supabase
    .from('deal_confirmations')
    .select('*', { count: 'exact', head: true })
    .eq('seller_id', sellerId)
    .gte('created_at', sevenDaysAgo)
  if ((recentCount || 0) >= 5) {
    return { deal: null, error: { message: 'Too many deal requests this week. Please contact support if this is unexpected.' } }
  }

  // Create deal
  const { data: deal, error } = await supabase
    .from('deal_confirmations')
    .insert({
      listing_id:        listingId,
      seller_id:         sellerId,
      buyer_id:          buyerId,
      initiated_by:      sellerId,
      initiated_by_role: 'seller',
      seller_confirmed:  true,
      seller_confirmed_at: new Date().toISOString(),
      message_count:     messageCount,
      status:            'pending',
      expires_at:        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    })
    .select()
    .single()

  if (error) return { deal: null, error }
  return { deal, error: null }
}

/**
 * Buyer confirms a deal.
 * Returns { deal, error }
 */
export async function confirmDeal(dealId, buyerId) {
  // Load deal first
  const { data: deal } = await supabase
    .from('deal_confirmations')
    .select('*')
    .eq('id', dealId)
    .maybeSingle()

  if (!deal) return { deal: null, error: { message: 'Deal not found.' } }
  if (deal.buyer_id !== buyerId) return { deal: null, error: { message: 'Not authorised.' } }
  if (deal.status === 'confirmed') return { deal, error: null }
  if (deal.status === 'expired') return { deal: null, error: { message: 'This deal request has expired.' } }

  const now = new Date().toISOString()
  const bothConfirmed = deal.seller_confirmed // seller already confirmed on send

  const { data: updated, error } = await supabase
    .from('deal_confirmations')
    .update({
      buyer_confirmed:    true,
      buyer_confirmed_at: now,
      status:             bothConfirmed ? 'confirmed' : 'pending',
    })
    .eq('id', dealId)
    .select()
    .single()

  if (error) return { deal: null, error }

  // If fully confirmed, update trust scores and buyer wall
  if (updated.status === 'confirmed') {
    await _onDealFullyConfirmed(updated)
  }

  return { deal: updated, error: null }
}

async function _onDealFullyConfirmed(deal) {
  // Check account age — accounts under 30 days get half score weight
  const { data: sellerProfile } = await supabase
    .from('profiles')
    .select('created_at')
    .eq('id', deal.seller_id)
    .maybeSingle()
  const accountAge = sellerProfile?.created_at
    ? Date.now() - new Date(sellerProfile.created_at)
    : Infinity
  const scoreWeight = accountAge < 30 * 24 * 60 * 60 * 1000 ? 0.5 : 1.0

  // 1. Update seller trust score via SQL function
  await supabase.rpc('update_trust_score_on_deal', {
    p_seller_id:    deal.seller_id,
    p_buyer_id:     deal.buyer_id,
    p_score_weight: scoreWeight,
  })

  // 2. Add to buyer wall
  await supabase
    .from('buyer_wall')
    .upsert({
      seller_id:            deal.seller_id,
      buyer_id:             deal.buyer_id,
      listing_id:           deal.listing_id,
      deal_confirmation_id: deal.id,
      visible:              true,
    }, { onConflict: 'seller_id,buyer_id,listing_id' })

  // 3. Update trading circle (increment, not overwrite)
  await supabase.rpc('increment_trading_circle', {
    p_user_id:    deal.seller_id,
    p_partner_id: deal.buyer_id,
  })
  await supabase.rpc('increment_trading_circle', {
    p_user_id:    deal.buyer_id,
    p_partner_id: deal.seller_id,
  })
}

// ── VOUCHING ─────────────────────────────────────────────────────────────────

export async function getVouchStatus(voucherId, voucheeId) {
  if (!voucherId || !voucheeId) return null
  const { data } = await supabase
    .from('vouches')
    .select('*')
    .eq('voucher_id', voucherId)
    .eq('vouchee_id', voucheeId)
    .maybeSingle()
  return data
}

export async function getVouchers(userId, limit = 5) {
  const { data } = await supabase
    .from('vouches')
    .select('*, profiles!voucher_id(id, full_name, avatar_url, city)')
    .eq('vouchee_id', userId)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}

export async function submitVouch(voucherId, voucheeId) {
  const { data, error } = await supabase
    .from('vouches')
    .upsert({ voucher_id: voucherId, vouchee_id: voucheeId, weight: 1.0, status: 'active' })
    .select()
    .single()
  if (error) return { vouch: null, error }

  // Apply mutual vouch penalty if needed
  await supabase.rpc('apply_mutual_vouch_penalty', {
    p_voucher_id: voucherId,
    p_vouchee_id: voucheeId,
  })

  // Update vouch score for vouchee
  const { data: vouches } = await supabase
    .from('vouches')
    .select('weight')
    .eq('vouchee_id', voucheeId)
    .eq('status', 'active')

  const vouchScore = (vouches || []).reduce((sum, v) => sum + (v.weight || 1), 0)

  await supabase
    .from('trust_scores')
    .upsert({ user_id: voucheeId, vouch_score: vouchScore }, { onConflict: 'user_id' })
    .eq('user_id', voucheeId)

  return { vouch: data, error: null }
}

export async function withdrawVouch(voucherId, voucheeId) {
  const { error } = await supabase
    .from('vouches')
    .update({ status: 'withdrawn' })
    .eq('voucher_id', voucherId)
    .eq('vouchee_id', voucheeId)
  return { error }
}

// ── VOUCH CHAIN ───────────────────────────────────────────────────────────────

/**
 * Resolve how the viewer is connected to the target.
 * Returns: { degree: 1|2|null, connector: profile|null }
 */
export async function resolveVouchChain(viewerId, targetId) {
  if (!viewerId || !targetId || viewerId === targetId) return { degree: null, connector: null }

  // 1st degree: viewer directly vouched for target
  const direct = await getVouchStatus(viewerId, targetId)
  if (direct?.status === 'active') return { degree: 1, connector: null }

  // 2nd degree: someone viewer vouched for has vouched for target
  const { data: myVouchees } = await supabase
    .from('vouches')
    .select('vouchee_id')
    .eq('voucher_id', viewerId)
    .eq('status', 'active')
    .limit(50)

  if (!myVouchees?.length) return { degree: null, connector: null }

  const ids = myVouchees.map(v => v.vouchee_id)
  const { data: secondDeg } = await supabase
    .from('vouches')
    .select('voucher_id, profiles!voucher_id(id, full_name, avatar_url)')
    .eq('vouchee_id', targetId)
    .eq('status', 'active')
    .in('voucher_id', ids)
    .limit(1)

  if (secondDeg?.length) {
    return { degree: 2, connector: secondDeg[0].profiles }
  }

  return { degree: null, connector: null }
}

// ── BUYER WALL ────────────────────────────────────────────────────────────────

export async function getBuyerWall(sellerId, limit = 10) {
  const { data } = await supabase
    .from('buyer_wall')
    .select('*, profiles!buyer_id(id, full_name, avatar_url)')
    .eq('seller_id', sellerId)
    .eq('visible', true)
    .order('created_at', { ascending: false })
    .limit(limit)
  return data || []
}