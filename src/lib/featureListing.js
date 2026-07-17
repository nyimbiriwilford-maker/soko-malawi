/**
 * Phase 4.2 — Feature an existing listing (same activation as post-publish).
 * Free: request_feature_listing · Paid: request_feature_listing_payment → PayChangu → confirm_feature_payment
 */
import { supabase } from './supabase'
import {
  FEATURED_DURATION_DAYS,
  FEATURED_PRICE_MWK,
} from '../constants/featuredPricing'
import { isListingFeatured } from '../utils/homeUtils'

const FREE_FEATURE_LIMIT = 5

function errMsg(error, fallback = 'Request failed') {
  if (!error) return fallback
  if (typeof error === 'string') return error
  return error.message || error.error_description || error.details || fallback
}

/** Pull checkout URL from PayChangu / edge response shapes */
function pickCheckoutUrl(fnData) {
  if (!fnData || typeof fnData !== 'object') return null
  return (
    fnData?.data?.checkout_url
    || fnData?.checkout_url
    || fnData?.data?.data?.checkout_url
    || fnData?.data?.url
    || fnData?.url
    || null
  )
}

async function hasFreeFeatureEntitlement(userId, listingId = undefined) {
  // 1) Preferred: server eligibility RPC (omit null arg — PostgREST 400s on null uuid)
  const eligArgs = listingId ? { p_listing_id: listingId } : {}
  const { data: elig, error: eligErr } = await supabase.rpc('get_feature_eligibility', eligArgs)
  if (!eligErr && elig && typeof elig === 'object') {
    return elig.has_free_left === true
  }
  if (eligErr) {
    console.warn('[featureListing] get_feature_eligibility:', eligErr.message)
  }

  // 2) Fallback: app_settings + free promo count (same idea as PostListing)
  const { data: setting } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', 'free_featured_enabled')
    .maybeSingle()

  const freeOn = setting ? (setting.value === true || setting.value === 'true') : true
  if (!freeOn) return false

  const { count, error: countErr } = await supabase
    .from('listing_promotions')
    .select('id', { count: 'exact', head: true })
    .eq('seller_id', userId)
    .eq('promotion_type', 'featured')
    .eq('price_mwk', 0)

  if (countErr) {
    // Seller may not be able to count all promos under RLS — try without head count fail → no free
    console.warn('[featureListing] free count failed', countErr.message)
    return false
  }
  return (count || 0) < FREE_FEATURE_LIMIT
}

/**
 * @param {{
 *   listing: { id: string, seller_id?: string, status?: string, featured_until?: string, featured?: boolean, is_featured?: boolean },
 *   user: { id: string, email?: string },
 *   profileName?: string,
 * }} opts
 */
export async function featureExistingListing({ listing, user, profileName }) {
  if (!user?.id) throw new Error('Sign in to feature a listing.')
  if (!listing?.id) throw new Error('Listing is required.')
  if (listing.seller_id && listing.seller_id !== user.id) {
    throw new Error('You can only feature your own listings.')
  }
  if (listing.status === 'sold' || listing.status === 'deleted' || listing.status === 'draft') {
    throw new Error('Only published or active listings can be featured.')
  }
  if (isListingFeatured(listing)) {
    throw new Error('This listing is already featured.')
  }

  let useFree = false
  try {
    useFree = await hasFreeFeatureEntitlement(user.id, listing.id)
  } catch (e) {
    console.warn('[featureListing] eligibility check failed', e)
    useFree = false
  }

  if (useFree) {
    const { data, error } = await supabase.rpc('request_feature_listing', {
      p_listing_id: listing.id,
      p_duration_days: FEATURED_DURATION_DAYS,
    })
    if (error) {
      // Fall through to paid if free path rejects (limit, toggle, etc.)
      console.warn('[featureListing] free RPC failed, trying paid:', error.message)
    } else {
      return { free: true, data }
    }
  }

  // Paid path — create pending promotion then PayChangu checkout
  const { data: reqData, error: reqErr } = await supabase.rpc('request_feature_listing_payment', {
    p_listing_id: listing.id,
    p_duration_days: FEATURED_DURATION_DAYS,
  })
  if (reqErr) {
    throw new Error(errMsg(reqErr, 'Could not start feature payment. Try again or contact support.'))
  }
  if (!reqData?.tx_ref) {
    throw new Error('Could not create payment reference. Ensure feature payment RPCs are deployed.')
  }

  const nameParts = String(profileName || '').trim().split(/\s+/).filter(Boolean)
  const email = (user.email && String(user.email).includes('@'))
    ? user.email
    : 'seller@sokomw.app'
  const baseUrl = window.location.origin
  const amount = Number(reqData.price ?? FEATURED_PRICE_MWK)

  const { data: fnData, error: fnErr } = await supabase.functions.invoke('initiate-payment', {
    body: {
      seller_id: user.id,
      email,
      first_name: nameParts[0] || 'Seller',
      last_name: nameParts.slice(1).join(' ') || 'User',
      tx_ref: reqData.tx_ref,
      callback_url: `${baseUrl}/verify-payment`,
      return_url: `${baseUrl}/verify-payment`,
      amount,
      purpose: 'featured_listing',
      title: 'SokoMW Featured Listing',
      description: `Feature listing for ${FEATURED_DURATION_DAYS} days`,
      listing_id: listing.id,
    },
  })

  if (fnErr) {
    let detail = errMsg(fnErr, 'Payment service error')
    try {
      // FunctionsHttpError sometimes carries response body
      if (fnErr.context && typeof fnErr.context.json === 'function') {
        const body = await fnErr.context.json()
        detail = body?.error || body?.message || body?.data?.message || detail
      }
    } catch { /* ignore */ }
    console.error('[featureListing] initiate-payment failed', fnErr, fnData)
    throw new Error(detail)
  }

  const checkoutUrl = pickCheckoutUrl(fnData)
  if (!checkoutUrl) {
    const payMsg =
      fnData?.message
      || fnData?.error
      || fnData?.data?.message
      || fnData?.data?.error
      || 'No checkout URL returned from payment provider.'
    console.error('[featureListing] no checkout_url', fnData)
    throw new Error(
      typeof payMsg === 'string'
        ? `Payment redirect failed: ${payMsg}`
        : 'Payment redirect failed. Check PayChangu configuration.',
    )
  }

  window.location.assign(checkoutUrl)
  return { redirecting: true }
}
