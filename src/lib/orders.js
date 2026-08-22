// src/lib/orders.js
// Order lifecycle helpers shared by buyer (OrdersPage) and seller (ShopDashboard) UIs.
import { supabase } from './supabase'

export const ORDER_STATUSES = ['pending', 'accepted', 'dispatched', 'delivered', 'rated', 'cancelled']

export const ORDER_STATUS_META = {
  pending:    { label: 'Pending',    buyerLabel: 'Waiting for seller', color: '#b45309', bg: '#fef3c7' },
  accepted:   { label: 'Accepted',   buyerLabel: 'Seller accepted',    color: '#1d4ed8', bg: '#dbeafe' },
  dispatched: { label: 'Dispatched', buyerLabel: 'On the way',         color: '#7c3aed', bg: '#ede9fe' },
  delivered:  { label: 'Delivered',  buyerLabel: 'Delivered',          color: '#15803d', bg: '#dcfce7' },
  rated:      { label: 'Completed',  buyerLabel: 'Completed',          color: '#15803d', bg: '#dcfce7' },
  cancelled:  { label: 'Cancelled',  buyerLabel: 'Cancelled',          color: '#dc2626', bg: '#fee2e2' },
}

export const STATUS_STEPS = ['pending', 'accepted', 'dispatched', 'delivered']

export const PAYMENT_METHODS = [
  { value: 'cash_on_delivery', label: 'Pay on delivery / pickup' },
  { value: 'mobile_money',     label: 'Mobile Money (Airtel / TNM Mpamba)' },
  { value: 'card',             label: 'Card (PayChangu)' },
  { value: 'other',            label: 'Other (agree with seller)' },
]

export const DELIVERY_METHODS = [
  { value: 'pickup',   label: 'Pickup in person' },
  { value: 'delivery', label: 'Delivery to my address' },
]

// Seller actions allowed per current status (state machine, mirrors update_order_status RPC)
export const SELLER_ACTIONS = {
  pending: ['accept', 'decline'],
  accepted: ['dispatch', 'decline'],
  dispatched: ['deliver'],
}

// Buyer may cancel while the order is not yet dispatched
export function buyerCanCancel(status) {
  return status === 'pending' || status === 'accepted'
}

export function buyerCanRate(status) {
  return status === 'delivered'
}

// Flash sale helper — writes go to flash_sale_expires_at; some legacy rows
// may carry flash_sale_ends_at, so check both (same rule the DB RPC uses).
export function isFlashActive(listing) {
  if (!listing?.flash_sale_price) return false
  const ends = listing.flash_sale_expires_at || listing.flash_sale_ends_at
  return ends ? new Date(ends) > new Date() : false
}

// Effective unit price for a quantity: flash → bulk tier → base price.
// Mirrors public.place_order() so the UI total always matches the DB total.
export function effectiveUnitPrice(listing, qty = 1) {
  if (!listing) return 0
  if (isFlashActive(listing)) return Number(listing.flash_sale_price)
  const tiers = Array.isArray(listing.price_tiers)
    ? listing.price_tiers
    : Array.isArray(listing?.tiers) ? listing.tiers : []
  const match = [...tiers]
    .filter(t => Number(t.min_qty) <= qty)
    .sort((a, b) => Number(b.min_qty) - Number(a.min_qty))[0]
  if (match) return Number(match.price)
  return Number(listing.price) || 0
}

export { formatPrice as formatMWK } from './format'

export function shortDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  const sameYear = d.getFullYear() === now.getFullYear()
  return d.toLocaleDateString('en-GB', sameYear
    ? { day: 'numeric', month: 'short', hour: undefined, minute: undefined }
    : { day: 'numeric', month: 'short', year: 'numeric' })
}

const ORDER_SELECT = `
  id, order_number, listing_id, shop_id, seller_id, buyer_id,
  quantity, unit_price, total_amount, currency, status,
  payment_method, delivery_method, delivery_address, buyer_phone, buyer_note,
  cancel_reason, rating, rating_comment,
  accepted_at, dispatched_at, delivered_at, cancelled_at,
  created_at, updated_at
`
const LISTING_JOIN = 'listings(id, title, price, images, stock_qty, city)'

export async function placeOrder({ listingId, quantity, paymentMethod, deliveryMethod, deliveryAddress, buyerPhone, buyerNote }) {
  const { data, error } = await supabase.rpc('place_order', {
    p_listing_id: listingId,
    p_quantity: quantity,
    p_payment_method: paymentMethod || 'cash_on_delivery',
    p_delivery_method: deliveryMethod || 'pickup',
    p_delivery_address: deliveryAddress || null,
    p_buyer_phone: buyerPhone || null,
    p_buyer_note: buyerNote || null,
  })
  if (error) throw new Error(friendlyRpcError(error))
  return data
}

export async function updateOrderStatus(orderId, action, reason = null) {
  const { error } = await supabase.rpc('update_order_status', {
    p_order_id: orderId,
    p_action: action,
    p_reason: reason,
  })
  if (error) throw new Error(friendlyRpcError(error))
}

export async function cancelOrder(orderId, reason = null) {
  const { error } = await supabase.rpc('cancel_order', { p_order_id: orderId, p_reason: reason })
  if (error) throw new Error(friendlyRpcError(error))
}

export async function rateOrder(orderId, rating, comment = null) {
  const { error } = await supabase.rpc('rate_order', { p_order_id: orderId, p_rating: rating, p_comment: comment })
  if (error) throw new Error(friendlyRpcError(error))
}

// role: 'buyer' | 'seller'
export async function fetchOrders({ role, status = null, shopId = null, limit = 50 } = {}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  let q = supabase
    .from('orders')
    .select(`${ORDER_SELECT}, ${LISTING_JOIN}`)
    .order('created_at', { ascending: false })
    .limit(limit)

  // Seller view: scoped to their shop when provided, otherwise to their own user id
  if (role === 'seller' && shopId) {
    q = q.eq('shop_id', shopId)
  } else {
    q = q.eq(role === 'seller' ? 'seller_id' : 'buyer_id', user.id)
  }

  if (status && status !== 'all') q = q.eq('status', status)

  const { data, error } = await q
  if (error) throw error

  const orders = data || []

  // Batch-fetch the counter-party profile (sellers see buyers, buyers see sellers)
  const counterKey = role === 'seller' ? 'buyer_id' : 'seller_id'
  const ids = [...new Set(orders.map(o => o[counterKey]).filter(Boolean))]
  const profileMap = {}
  if (ids.length) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, name, avatar_url, phone')
      .in('id', ids.slice(0, 200))
    for (const p of profiles || []) profileMap[p.id] = p
  }

  const withProfiles = orders.map(o => ({
    ...o,
    [role === 'seller' ? 'buyer' : 'seller']: profileMap[o[counterKey]] || null,
  }))

  // Attach the user's shop when seller placed the order with shop scope unknown
  if (role === 'seller') return withProfiles
  const shopIds = [...new Set(withProfiles.map(o => o.shop_id).filter(Boolean))]
  if (shopIds.length) {
    const { data: shops } = await supabase
      .from('shops')
      .select('id, name, slug, logo_url')
      .in('id', shopIds.slice(0, 200))
    const shopMap = {}
    for (const s of shops || []) shopMap[s.id] = s
    return withProfiles.map(o => ({ ...o, shop: o.shop_id ? shopMap[o.shop_id] || null : null }))
  }
  return withProfiles
}

export async function fetchPendingCount(shopId = null) {
  let q = supabase.from('orders').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  if (shopId) q = q.eq('shop_id', shopId)
  const { count } = await q
  return count || 0
}

export async function fetchShopAnalytics(shopId) {
  if (!shopId) return null
  const { data, error } = await supabase.rpc('get_shop_analytics', { p_shop_id: shopId })
  if (error) return null
  return data
}

function friendlyRpcError(error) {
  const msg = error?.message || 'Something went wrong'
  // Postgres RAISE EXCEPTION surfaces in error.message without a code field
  return msg.replace(/^error:\s*/i, '').replace(/^\w+:\s*/, (m) => (m.startsWith('PGRST') ? m : ''))
}
