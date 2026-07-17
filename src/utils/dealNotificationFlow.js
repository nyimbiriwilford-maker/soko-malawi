/**
 * Deal confirmation flow lives entirely in Notifications.
 * Chat only calls maybePromptDealReady after enough messages.
 *
 * Flow:
 *  1. Seller & buyer exchange ≥ MIN_DEAL_MESSAGES on a listing chat
 *  2. Seller gets deal_ready notification
 *  3. Seller sends request → buyer gets deal_request
 *  4. Buyer confirms/declines → deal_confirmed / deal_declined
 *  5. Buyer may get deal_vouching; either party can vouch from notifications
 */

import { supabase } from '../lib/supabase'
import {
  sendDealRequest,
  confirmDeal,
  getPendingDeal,
} from './vouchUtils'

/** Same anti-fraud threshold as sendDealRequest */
export const MIN_DEAL_MESSAGES = 4

/**
 * After a listing chat has enough real messages, notify the seller
 * that they can start deal confirmation in Notifications.
 * No UI in chat — silent side-effect only.
 */
export async function maybePromptDealReady({
  listing,
  currentUserId,
  otherUserId,
  messageCount,
  otherName = null,
}) {
  try {
    if (!listing?.id || !currentUserId || !otherUserId) return { prompted: false }
    // Only the listing seller is prompted to start the deal
    if (listing.seller_id !== currentUserId) return { prompted: false }
    if ((messageCount || 0) < MIN_DEAL_MESSAGES) return { prompted: false }

    const existingDeal = await getPendingDeal(listing.id, currentUserId, otherUserId)
    if (existingDeal) return { prompted: false }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recent } = await supabase
      .from('notifications')
      .select('id, data, type')
      .eq('user_id', currentUserId)
      .in('type', ['deal_ready', 'deal_request'])
      .gte('created_at', sevenDaysAgo)
      .limit(30)

    const alreadyPrompted = (recent || []).some((n) => {
      const d = n.data || {}
      return d.listing_id === listing.id && (d.buyer_id === otherUserId || d.other_user_id === otherUserId)
    })
    if (alreadyPrompted) return { prompted: false }

    let buyerLabel = otherName
    if (!buyerLabel) {
      const { data: prof } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', otherUserId)
        .maybeSingle()
      buyerLabel = prof?.full_name || 'this buyer'
    }

    const title = 'Ready to confirm this deal?'
    const body = `You and ${buyerLabel} have been chatting about "${listing.title}". If the sale happened, confirm the deal in Notifications.`

    const { error } = await supabase.from('notifications').insert({
      user_id: currentUserId,
      type: 'deal_ready',
      title: '🤝 ' + title,
      body,
      message: body,
      data: {
        listing_id: listing.id,
        listing_title: listing.title,
        listing_price: listing.price ?? null,
        buyer_id: otherUserId,
        buyer_name: buyerLabel,
        seller_id: currentUserId,
        other_user_id: otherUserId,
        message_count: messageCount,
        context_id: listing.id,
        context_type: 'listing',
      },
      read: false,
    })

    if (error) {
      console.warn('[dealNotificationFlow] deal_ready insert failed:', error.message)
      return { prompted: false, error }
    }
    return { prompted: true }
  } catch (e) {
    console.warn('[dealNotificationFlow] maybePromptDealReady', e)
    return { prompted: false, error: e }
  }
}

/**
 * Seller sends deal confirmation request from Notifications (no chat message).
 */
export async function sendDealFromNotification({
  sellerId,
  buyerId,
  listingId,
  listingTitle,
  listingPrice,
  messageCount,
  sellerName,
}) {
  const { deal, error } = await sendDealRequest({
    sellerId,
    buyerId,
    listingId,
    messageCount: messageCount ?? MIN_DEAL_MESSAGES,
  })
  if (error) return { deal: null, error }

  const title = 'Deal confirmation request'
  const body = `${sellerName || 'Seller'} wants to confirm the deal for "${listingTitle || 'a listing'}"`

  try {
    await supabase.from('notifications').insert({
      user_id: buyerId,
      type: 'deal_request',
      title: '🤝 ' + title,
      body,
      message: body,
      data: {
        deal_id: deal.id,
        seller_id: sellerId,
        seller_name: sellerName || null,
        buyer_id: buyerId,
        listing_id: listingId,
        listing_title: listingTitle || null,
        listing_price: listingPrice ?? null,
        context_id: listingId,
        context_type: 'listing',
      },
      read: false,
    })
  } catch (e) {
    console.warn('[dealNotificationFlow] buyer deal_request notif failed', e)
  }

  return { deal, error: null }
}

/**
 * Buyer confirms deal from Notifications.
 */
export async function confirmDealFromNotification({
  dealId,
  buyerId,
  buyerName,
  listingTitle,
  sellerId,
  listingId,
}) {
  const { deal, error } = await confirmDeal(dealId, buyerId)
  if (error) return { deal: null, error }

  if (deal?.status === 'confirmed' && sellerId) {
    try {
      await supabase.from('notifications').insert({
        user_id: sellerId,
        type: 'deal_confirmed',
        title: '🎉 Deal confirmed!',
        body: `${buyerName || 'Buyer'} confirmed the deal for "${listingTitle || 'your listing'}"`,
        message: 'Deal confirmed',
        data: {
          deal_id: deal.id,
          listing_id: listingId || deal.listing_id,
          listing_title: listingTitle || null,
          buyer_id: buyerId,
          buyer_name: buyerName || null,
          seller_id: sellerId,
          context_id: listingId || deal.listing_id,
          context_type: 'listing',
        },
        read: false,
      })
    } catch (_) {}

    // Remind buyer they can vouch for the seller
    try {
      await supabase.from('notifications').insert({
        user_id: buyerId,
        type: 'deal_vouching',
        title: '🌟 Vouch for the seller?',
        body: `Your deal is confirmed. Vouching helps the seller grow their reputation.`,
        message: 'Vouch reminder',
        data: {
          deal_id: deal.id,
          seller_id: sellerId,
          listing_id: listingId || deal.listing_id,
          listing_title: listingTitle || null,
          context_id: listingId || deal.listing_id,
        },
        read: false,
      })
    } catch (_) {}
  }

  return { deal, error: null }
}

/**
 * Buyer declines a pending deal request.
 */
export async function declineDealFromNotification({
  dealId,
  buyerId,
  buyerName,
  listingTitle,
  sellerId,
}) {
  const { data: deal } = await supabase
    .from('deal_confirmations')
    .select('*')
    .eq('id', dealId)
    .maybeSingle()

  if (!deal) return { deal: null, error: { message: 'Deal not found.' } }
  if (deal.buyer_id !== buyerId) return { deal: null, error: { message: 'Not authorised.' } }
  if (deal.status !== 'pending') {
    return { deal, error: { message: 'This deal is no longer pending.' } }
  }

  const { data: updated, error } = await supabase
    .from('deal_confirmations')
    .update({
      status: 'expired',
      updated_at: new Date().toISOString(),
    })
    .eq('id', dealId)
    .select()
    .single()

  if (error) return { deal: null, error }

  if (sellerId) {
    try {
      await supabase.from('notifications').insert({
        user_id: sellerId,
        type: 'deal_declined',
        title: 'Deal declined',
        body: `${buyerName || 'Buyer'} declined the deal confirmation for "${listingTitle || 'your listing'}"`,
        message: 'Deal declined',
        data: {
          deal_id: dealId,
          buyer_id: buyerId,
          buyer_name: buyerName || null,
          seller_id: sellerId,
          listing_title: listingTitle || null,
          listing_id: deal.listing_id,
        },
        read: false,
      })
    } catch (_) {}
  }

  return { deal: updated, error: null }
}

/**
 * Mark a notification as handled (read + optional status in data).
 */
export async function markNotificationHandled(notifId, extraData = {}) {
  if (!notifId) return
  const { data: row } = await supabase
    .from('notifications')
    .select('data')
    .eq('id', notifId)
    .maybeSingle()

  await supabase
    .from('notifications')
    .update({
      read: true,
      data: { ...(row?.data || {}), ...extraData, handled: true },
    })
    .eq('id', notifId)
}
