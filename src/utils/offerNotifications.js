// src/utils/offerNotifications.js
// Complete in-app offer notification system.
//
// Replaces the old ad-hoc offer notification flow (generic `new_message` rows for
// offer bubbles + the `listing_offer` "new inquiry" insert) with dedicated offer
// event types that deep-link straight into the negotiation chat:
//
//   offer_new        – a new offer was sent            (→ recipient)
//   offer_counter    – a counter offer was sent        (→ recipient)
//   offer_accepted   – an offer was accepted           (→ original offerer)
//   offer_declined   – an offer was declined           (→ original offerer)
//   offer_withdrawn  – an offer was withdrawn          (→ offer recipient)
//   offer_expired    – a pending offer passed deadline (→ both parties)
//   offer_expiring   – approaching deadline reminder   (→ both parties)
//
// Reminder rules (client-side, mirroring the in-chat Ticker):
//   * offers that run for MORE than 24h  → "1 day remaining"  notification
//   * offers that run for <= 24h          → "1 hour remaining" notification
//
// Every notification row carries enough data to deep-link into the chat via
// /chat/{other_user_id}/{context_id} and scroll to the exact offer message.
// Inserts are de-duplicated on offer_id so reminders / expiry fire exactly once.

import { supabase } from '../lib/supabase'
import {
  OFFER_STATUS,
  formatOfferAmount,
  parseOfferMessage,
  offerExpiryMs,
  offerExpiresAt,
} from './offerMessage'

const HOUR_MS = 60 * 60 * 1000

async function resolveName(userId, fallback) {
  if (fallback) return fallback
  if (!userId) return 'Someone'
  try {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle()
    return data?.full_name || 'Someone'
  } catch {
    return 'Someone'
  }
}

/** Build the shared data bag every offer notification deep-links into. */
function buildData({
  offer,
  actorId,
  actorName,
  listingId,
  listingTitle,
  contextId,
  messageId,
}) {
  return {
    role: 'offer',
    actor_id: actorId,
    actor_name: actorName,
    // Party the recipient should open the chat with (deep-link target)
    other_user_id: actorId,
    offer_id: offer?.offer_id || null,
    parent_offer_id: offer?.parent_offer_id || null,
    amount: offer?.amount ?? null,
    currency: offer?.currency || 'MWK',
    expires_in_hours: offer?.expires_in_hours ?? null,
    expires_at: offerExpiresAt(offer) || null,
    listing_id: listingId || offer?.listing_id || null,
    listing_title: listingTitle || null,
    context_id: contextId || listingId || offer?.listing_id || null,
    context_type: 'listing',
    message_id: messageId || null,
  }
}

function listingSuffix(title) {
  return title ? ` for "${title}"` : ''
}

function amountText(offer) {
  return formatOfferAmount(offer)
}

/** Single insert point. Skips self-notifications and missing recipients. */
async function insertNotification({ key, toUserId, actorId, title, body, data }) {
  if (!toUserId || !actorId) return { error: { message: 'Missing user ids' } }
  if (toUserId === actorId) return { error: null, skipped: true }
  const actorName = data.actor_name || (await resolveName(actorId))
  const { error } = await supabase.from('notifications').insert({
    user_id: toUserId,
    type: key,
    title,
    body,
    message: body,
    data: { ...data, actor_id: actorId, actor_name: actorName },
    read: false,
  })
  if (error) console.warn(`[offerNotifications] ${key} insert failed:`, error.message)
  return { error }
}

// ── Lifecycle events (fired by the Chat page at the exact negotiation change) ──

export async function notifyOfferNew({ toUserId, actorId, actorName, offer, listingTitle, listingId, contextId, messageId }) {
  const actor = actorName || (await resolveName(actorId))
  return insertNotification({
    key: 'offer_new',
    toUserId,
    actorId,
    title: '💵 New offer',
    body: `${actor} offered ${amountText(offer)}${listingSuffix(listingTitle)}`,
    data: buildData({ offer, actorId, actorName, listingId, listingTitle, contextId, messageId }),
  })
}

export async function notifyOfferCounter({ toUserId, actorId, actorName, offer, listingTitle, listingId, contextId, messageId }) {
  const actor = actorName || (await resolveName(actorId))
  return insertNotification({
    key: 'offer_counter',
    toUserId,
    actorId,
    title: '🔄 Counter offer',
    body: `${actor} sent a counter offer of ${amountText(offer)}${listingSuffix(listingTitle)}`,
    data: buildData({ offer, actorId, actorName, listingId, listingTitle, contextId, messageId }),
  })
}

export async function notifyOfferAccepted({ toUserId, actorId, actorName, offer, listingTitle, listingId, contextId, messageId }) {
  const actor = actorName || (await resolveName(actorId))
  return insertNotification({
    key: 'offer_accepted',
    toUserId,
    actorId,
    title: '✅ Offer accepted',
    body: `${actor} accepted your offer of ${amountText(offer)}${listingSuffix(listingTitle)}`,
    data: buildData({ offer, actorId, actorName, listingId, listingTitle, contextId, messageId }),
  })
}

export async function notifyOfferDeclined({ toUserId, actorId, actorName, offer, listingTitle, listingId, contextId, messageId }) {
  const actor = actorName || (await resolveName(actorId))
  return insertNotification({
    key: 'offer_declined',
    toUserId,
    actorId,
    title: '❌ Offer declined',
    body: `${actor} declined your offer of ${amountText(offer)}${listingSuffix(listingTitle)}`,
    data: buildData({ offer, actorId, actorName, listingId, listingTitle, contextId, messageId }),
  })
}

export async function notifyOfferWithdrawn({ toUserId, actorId, actorName, offer, listingTitle, listingId, contextId, messageId }) {
  const actor = actorName || (await resolveName(actorId))
  return insertNotification({
    key: 'offer_withdrawn',
    toUserId,
    actorId,
    title: '↩️ Offer withdrawn',
    body: `${actor} withdrew their offer of ${amountText(offer)}${listingSuffix(listingTitle)}`,
    data: buildData({ offer, actorId, actorName, listingId, listingTitle, contextId, messageId }),
  })
}

export async function notifyOfferEdited({ toUserId, actorId, actorName, offer, listingTitle, listingId, contextId, messageId }) {
  const actor = actorName || (await resolveName(actorId))
  return insertNotification({
    key: 'offer_edited',
    toUserId,
    actorId,
    title: '✏️ Offer updated',
    body: `${actor} updated their offer to ${amountText(offer)}${listingSuffix(listingTitle)}`,
    data: buildData({ offer, actorId, actorName, listingId, listingTitle, contextId, messageId }),
  })
}

// ── Expiry + approaching-deadline reminders (fired by the in-chat Ticker) ──

/**
 * Notify a party that their (or the other party's) pending offer expired.
 * Fired client-side exactly when the in-chat Ticker flips an offer to expired.
 */
export async function notifyOfferExpired({
  toUserId,
  actorId,
  actorName,
  offer,
  listingTitle,
  listingId,
  contextId,
  messageId,
  isOfferer, // does toUserId own the offer (sender) or receive it?
}) {
  const actor = actorName || (await resolveName(actorId))
  const amount = amountText(offer)
  const suffix = listingSuffix(listingTitle)
  const body = isOfferer
    ? `Your offer of ${amount}${suffix} has expired`
    : `The offer of ${amount}${suffix} has expired`
  return insertNotification({
    key: 'offer_expired',
    toUserId,
    actorId,
    title,
    body,
    data: { ...buildData({ offer, actorId, actorName, listingId, listingTitle, contextId, messageId }), is_offerer: !!isOfferer },
  })
}

/**
 * Approaching-deadline reminder. `windowHours` is the offer's total window:
 *   > 24h  → fires when 1 day remains
 *   <= 24h → fires when 1 hour remains
 * Sends to BOTH parties (each gets their own context-specific copy).
 */
export async function notifyOfferExpiring({
  toUserId,
  actorId,
  actorName,
  offer,
  listingTitle,
  listingId,
  contextId,
  messageId,
  windowHours,
  isOfferer,
}) {
  const actor = actorName || (await resolveName(actorId))
  const amount = amountText(offer)
  const suffix = listingSuffix(listingTitle)
  const oneDay = (windowHours || 0) > 24
  const horizonLabel = oneDay ? '1 day' : '1 hour'
  const title = oneDay ? '⏳ Offer expires in 1 day' : '⏳ Offer expires in 1 hour'
  const body = isOfferer
    ? `Your offer of ${amount}${suffix} expires in ${horizonLabel}`
    : `The offer of ${amount}${suffix} expires in ${horizonLabel}`
  return insertNotification({
    key: 'offer_expiring',
    toUserId,
    actorId,
    title,
    body,
    data: { ...buildData({ offer, actorId, actorName, listingId, listingTitle, contextId, messageId }), reminder_window_hours: windowHours, is_offerer: !!isOfferer },
  })
}

// ── Expiry / reminder scheduler (mirrors the in-chat Ticker cadence) ──────
// Scans the loaded message list for pending offers and, once per offer, pushes
// the expired + approaching-deadline notifications to both parties. De-dup uses
// a lookup on existing notifications so reminders fire exactly once per offer.

async function hasExistingOfferNotif({ offerId, userId, types }) {
  if (!offerId || !userId) return true
  try {
    const { data, error } = await supabase
      .from('notifications')
      .select('id, data')
      .eq('user_id', userId)
      .in('type', types)
      .order('created_at', { ascending: false })
      .limit(100)
    if (error) return true // be safe: skip if we can't verify
    return (data || []).some(n => n.data?.offer_id === offerId)
  } catch {
    return true
  }
}

/**
 * Given the raw message list, push expiry / approaching-deadline notifications.
 * Called from the Chat page's offer Ticker; de-duped so it is safe to run on
 * every tick. Notifies BOTH parties; the DB lookups prevent duplicate inserts
 * when both clients run the ticker.
 */
export async function scanOfferNotifications({ messages, currentUserId, contextId = null }) {
  if (!currentUserId || !Array.isArray(messages)) return
  const now = Date.now()
  for (const m of messages) {
    if (m.media_type !== 'offer') continue
    const parsed = parseOfferMessage(m.body)
    if (!parsed?.ok) continue
    const offer = parsed.offer
    if (!offer || offer.status !== OFFER_STATUS.pending) continue
    const at = offerExpiresAt(offer)
    if (!at) continue
    const deadline = new Date(at).getTime()
    const remaining = deadline - now
    const ms = offerExpiryMs(offer)
    const windowHours = ms > 0 ? ms / HOUR_MS : 0
    const listingId = m.listing_id || offer.listing_id || null
    const listingTitle = m.listing_title || null
    const otherUserId = m.from_user === currentUserId ? m.to_user : m.from_user
    const offerId = offer.offer_id || String(m.id)

    // Skip malformed conversations where we can't resolve both parties
    if (!m.to_user || !m.from_user || m.to_user === m.from_user) continue

    const parties = [
      { toUserId: m.from_user, isOfferer: true },
      { toUserId: m.to_user, isOfferer: false },
    ]

    // 1) Expired — notify both parties once
    if (remaining <= 0) {
      for (const { toUserId, isOfferer } of parties) {
        if (await hasExistingOfferNotif({ offerId, userId: toUserId, types: ['offer_expired'] })) continue
        await notifyOfferExpired({
          toUserId,
          actorId: otherUserId,
          offer,
          listingTitle,
          listingId,
          contextId: contextId || listingId,
          messageId: m.id,
          isOfferer,
        })
      }
      continue
    }

    // 2) Approaching deadline — only while the offer is still pending
    const shouldFire1d = windowHours > 24 && remaining <= 24 * HOUR_MS && remaining > HOUR_MS
    const shouldFire1h = windowHours > 0 && windowHours <= 24 && remaining <= HOUR_MS
    if (!shouldFire1d && !shouldFire1h) continue

    for (const { toUserId, isOfferer } of parties) {
      if (await hasExistingOfferNotif({ offerId, userId: toUserId, types: ['offer_expiring'] })) continue
      await notifyOfferExpiring({
        toUserId,
        actorId: otherUserId,
        offer,
        listingTitle,
        listingId,
        contextId: contextId || listingId,
        messageId: m.id,
        windowHours,
        isOfferer,
      })
    }
  }
}
