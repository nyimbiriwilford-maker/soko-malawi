// src/utils/offerMessage.js
// Centralized parsing, validation, and formatting for the structured Price Offer
// message type (media_type === 'offer'). The offer payload is stored as JSON in the
// message body so Phase 1 stays migration-free. A future phase can move this data to
// a jsonb column / offers table without touching this module's API or the UI.

export const OFFER_TYPE = 'offer'
export const OFFER_VERSION = 1
export const OFFER_DEFAULT_CURRENCY = 'MWK'

// Lifecycle statuses. Phase 2 responses move an offer out of 'pending' exactly once
// (accept / decline); Phase 3 introduces 'superseded' for offers that were replaced by
// a counter offer — only one offer stays active ('pending') per negotiation chain.
// 'countered' is a legacy Phase 2 status rendered identically to 'superseded'.
export const OFFER_STATUS = Object.freeze({
  pending: 'pending',
  accepted: 'accepted',
  declined: 'declined',
  countered: 'countered',
  superseded: 'superseded',
  withdrawn: 'withdrawn',
  expired: 'expired',
})

const STATUS_LABELS = {
  pending: 'Pending',
  accepted: 'Accepted',
  declined: 'Declined',
  countered: 'Superseded',
  superseded: 'Superseded',
  withdrawn: 'Withdrawn',
  expired: 'Expired',
}

export function offerStatusLabel(status) {
  return STATUS_LABELS[status] || STATUS_LABELS.pending
}

// An offer expires when it stays pending beyond this window — it becomes read-only.
// Computed client-side (no cron/migration needed); both parties see the same result
// from the same created_at + wall clock.
export const OFFER_EXPIRY_MS = 72 * 60 * 60 * 1000

// Phase 9 — the sender picks how long a pending offer stays active.
// `hours: 0` means "Never" (persisted as expires_in_hours: 0 so it is distinct from
// legacy payloads that omit the field entirely and keep the default window).
export const OFFER_EXPIRY_OPTIONS = [
  { key: '24h',   label: '24 hours', hours: 24 },
  { key: '3d',    label: '3 days',   hours: 72 },
  { key: '7d',    label: '7 days',   hours: 168 },
  { key: 'never', label: 'Never',    hours: 0 },
]
export const OFFER_DEFAULT_EXPIRY_HOURS = 72

/**
 * Milliseconds a pending offer stays active.
 *  - expires_in_hours set (> 0) → that many hours
 *  - expires_in_hours === 0        → never expires
 *  - field absent (legacy)         → Phase-4 default (72 h)
 */
export function offerExpiryMs(offer) {
  if (!offer) return OFFER_EXPIRY_MS
  const raw = offer.expires_in_hours
  if (raw == null) return OFFER_EXPIRY_MS
  const hrs = Number(raw)
  if (!Number.isFinite(hrs) || hrs <= 0) return 0
  return hrs * 60 * 60 * 1000
}

/** Absolute expiry timestamp (ISO) for a pending offer, or null if it never expires. */
export function offerExpiresAt(offer) {
  if (!offer || !offer.created_at) return null
  const ms = offerExpiryMs(offer)
  if (ms <= 0) return null
  const t = new Date(offer.created_at).getTime()
  if (!Number.isFinite(t)) return null
  return new Date(t + ms).toISOString()
}

/** A pending offer is expired once its created_at is older than its chosen window. */
export function isOfferExpired(offer, now = Date.now()) {
  if (!offer || offer.status !== OFFER_STATUS.pending || !offer.created_at) return false
  const ms = offerExpiryMs(offer)
  if (ms <= 0) return false
  const t = new Date(offer.created_at).getTime()
  if (!Number.isFinite(t)) return false
  return now - t > ms
}

/** Stable, unique offer id. Client-generated so child offers can backlink before the
 *  message row exists. Falls back for non-secure contexts. */
export function generateOfferId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `offer_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function isValidAmount(v) {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0
}

/**
 * Build a canonical offer payload (v1).
 * Every offer carries an `offer_id` (generated here) and a `parent_offer_id` link to
 * the offer it counters, so the full negotiation history is reconstructable.
 * Unknown/custom fields are NOT included here; senders may add their own and they
 * will be ignored by the parser (forward compatibility).
 */
export function buildOfferPayload({ amount, note = '', listingId = null, parentOfferId = null, expiresInHours }) {
  return {
    type: OFFER_TYPE,
    offer_id: generateOfferId(),
    listing_id: listingId || null,
    amount,
    currency: OFFER_DEFAULT_CURRENCY,
    note: note || '',
    status: 'pending',
    parent_offer_id: parentOfferId || null,
    // Phase 9 — the sender's chosen expiry. Absent (undefined) keeps the default window.
    expires_in_hours: Number.isFinite(expiresInHours) ? expiresInHours : undefined,
    created_at: new Date().toISOString(),
    version: OFFER_VERSION,
  }
}

/**
 * Parse + validate a message body into an offer. Returns
 *   { ok: true, offer }   for a valid v1 offer
 *   { ok: false, reason } for anything else (missing body, invalid JSON, wrong
 *                          type/version, missing/invalid amount).
 * Malformed input never throws. Unknown fields are ignored so future schema
 * extensions stay backward-compatible.
 */
export function parseOfferMessage(body) {
  if (typeof body !== 'string' || !body.trim()) {
    return { ok: false, reason: 'no-body' }
  }
  let parsed
  try {
    parsed = JSON.parse(body)
  } catch {
    return { ok: false, reason: 'invalid-json' }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, reason: 'not-object' }
  }
  if (parsed.type !== OFFER_TYPE) {
    return { ok: false, reason: 'not-offer' }
  }
  const version = parsed.version == null ? OFFER_VERSION : parsed.version
  if (version !== OFFER_VERSION) {
    return { ok: false, reason: 'unsupported-version' }
  }
  if (!isValidAmount(parsed.amount)) {
    return { ok: false, reason: 'invalid-amount' }
  }
  const str = (v) => (typeof v === 'string' && v ? v : null)
  return {
    ok: true,
    offer: {
      type: OFFER_TYPE,
      listing_id: parsed.listing_id != null ? String(parsed.listing_id) : null,
      amount: parsed.amount,
      currency: typeof parsed.currency === 'string' && parsed.currency
        ? parsed.currency
        : OFFER_DEFAULT_CURRENCY,
      note: typeof parsed.note === 'string' ? parsed.note : '',
      status: typeof parsed.status === 'string' && parsed.status ? parsed.status : 'pending',
      created_at: typeof parsed.created_at === 'string' ? parsed.created_at : '',
      // Phase 2/3 metadata
      offer_id: str(parsed.offer_id),
      parent_offer_id: str(parsed.parent_offer_id),
      responded_by: str(parsed.responded_by),
      responded_at: str(parsed.responded_at),
      counter_offer_id: str(parsed.counter_offer_id),
      // Phase 9 — chosen expiry (hours). 0 = never; absent/legacy = default window.
      expires_in_hours: (() => {
        const raw = parsed.expires_in_hours
        if (raw == null) return null
        const n = Number(raw)
        return Number.isFinite(n) ? n : null
      })(),
      version,
    },
  }
}

/** "MWK 145,000" style amount line for offer cards / list previews. */
export function formatOfferAmount(offer) {
  return `${(offer && offer.currency) || OFFER_DEFAULT_CURRENCY} ${Number(offer && offer.amount || 0).toLocaleString()}`
}

/**
 * Human-readable status line shown on the offer card.
 * `viewerId` is the current user id; `isMine` whether the current user *sent* the
 * offer. The spec examples ("Seller accepted/declined your offer") map to the buyer's
 * view (isMine). If the viewer was the one who responded, the line reflects that.
 */
export function offerStatusText(offer, viewer = null, isMine = false) {
  const s = (offer && offer.status) || OFFER_STATUS.pending
  if (s === OFFER_STATUS.pending) {
    return isMine ? 'Waiting for the other party to respond' : 'Offer awaiting your response'
  }
  const responded = !!viewer && offer.responded_by === viewer
  switch (s) {
    case OFFER_STATUS.accepted:
      return responded ? 'You accepted this offer' : isMine ? 'Seller accepted your offer' : 'Offer accepted'
    case OFFER_STATUS.declined:
      return responded ? 'You declined this offer' : isMine ? 'Seller declined your offer' : 'Offer declined'
    case OFFER_STATUS.superseded:
    case OFFER_STATUS.countered:
      return responded
        ? 'You made a counter offer'
        : isMine
          ? 'Superseded by a counter offer'
          : 'Superseded by a counter offer'
    case OFFER_STATUS.withdrawn:
      return responded ? 'You withdrew this offer' : isMine ? 'You withdrew this offer' : 'Buyer withdrew this offer'
    case OFFER_STATUS.expired:
      return isMine ? 'Your offer expired' : 'This offer expired'
    default:
      return STATUS_LABELS.pending
  }
}
