// Seller order management: lists shop orders, accept/decline/dispatch/deliver,
// realtime updates via Supabase channel.
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import {
  fetchOrders, updateOrderStatus,
  ORDER_STATUS_META, SELLER_ACTIONS, PAYMENT_METHODS, DELIVERY_METHODS,
  formatMWK, shortDate,
} from '../lib/orders'
import { T } from '../constants/shopTokens'

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'pending', label: 'New' },
  { id: 'accepted', label: 'Accepted' },
  { id: 'dispatched', label: 'Dispatched' },
  { id: 'delivered', label: 'Delivered' },
  { id: 'cancelled', label: 'Cancelled' },
]

const ACTION_META = {
  accept:   { label: 'Accept Order',   bg: T.green, color: T.white },
  decline:  { label: 'Decline',        bg: '#fff',  color: '#dc2626', border: '#fecaca' },
  dispatch: { label: 'Mark Dispatched', bg: '#7c3aed', color: T.white },
  deliver:  { label: 'Mark Delivered',  bg: '#15803d', color: T.white },
}

export default function OrderManager({ shopId, pendingBadge }) {
  const [tab, setTab] = useState('all')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState(null)
  const [error, setError] = useState(null)

  const load = useCallback(async (status) => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchOrders({ role: 'seller', status: status || 'all', shopId })
      setOrders(data)
    } catch (e) {
      setError(e.message || 'Failed to load orders.')
    } finally {
      setLoading(false)
    }
  }, [shopId])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(tab === 'all' ? null : tab) }, [tab, load])

  // Realtime: refresh when any order for this shop changes
  useEffect(() => {
    if (!shopId) return
    const channel = supabase
      .channel(`orders_shop_${shopId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `shop_id=eq.${shopId}` }, () => {
        load(tab === 'all' ? null : tab)
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [shopId, tab, load])

  async function handleAction(order, action) {
    setBusyId(order.id)
    try {
      await updateOrderStatus(order.id, action)
      await notifyBuyer(order, action)
      await load(tab === 'all' ? null : tab)
      pendingBadge?.() // refresh dashboard pending count
    } catch (e) {
      setError(e.message || 'Action failed.')
    } finally {
      setBusyId(null)
    }
  }

  async function notifyBuyer(order, action) {
    try {
      const msg = {
        accept: `✅ Your order ${order.order_number} for "${order.listings?.title}" was accepted.`,
        decline: `❌ Your order ${order.order_number} for "${order.listings?.title}" was declined.`,
        dispatch: `🚚 Your order ${order.order_number} for "${order.listings?.title}" is on the way.`,
        deliver: `🎉 Your order ${order.order_number} for "${order.listings?.title}" was delivered. Rate it in My Orders!`,
      }[action]
      if (!msg || !order.buyer_id) return
      await supabase.from('notifications').insert({
        user_id: order.buyer_id,
        type: 'order_update',
        title: '🛒 Order update',
        body: msg,
        message: msg,
        data: { order_id: order.id, listing_id: order.listing_id },
        read: false,
      })
    } catch { /* best-effort */ }
  }

  if (loading && orders.length === 0) {
    return <div style={S.empty}>Loading orders…</div>
  }

  if (error) {
    return (
      <div style={{ ...S.empty, color: '#dc2626' }}>
        {error}
        <button style={S.retryBtn} onClick={() => load(tab === 'all' ? null : tab)}>Try again</button>
      </div>
    )
  }

  return (
    <div>
      <div style={S.tabRow}>
        {TABS.map(t => (
          <button key={t.id} style={{ ...S.tab, ...(tab === t.id ? S.tabActive : {}) }} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {orders.length === 0 ? (
        <div style={S.empty}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🛒</div>
          {tab === 'pending' ? 'No new orders yet. When a buyer places an order, it appears here.' : 'No orders here yet.'}
        </div>
      ) : (
        orders.map(order => (
          <OrderCard
            key={order.id}
            order={order}
            busy={busyId === order.id}
            onAction={handleAction}
          />
        ))
      )}
    </div>
  )
}

function OrderCard({ order, busy, onAction }) {
  const [expanded, setExpanded] = useState(false)
  const meta = ORDER_STATUS_META[order.status] || ORDER_STATUS_META.pending
  const actions = SELLER_ACTIONS[order.status] || []
  const listing = order.listings
  const buyerName = order.buyer?.full_name || order.buyer?.name || 'Buyer'
  const payLabel = PAYMENT_METHODS.find(m => m.value === order.payment_method)?.label || order.payment_method
  const delLabel = DELIVERY_METHODS.find(m => m.value === order.delivery_method)?.label || order.delivery_method

  return (
    <div style={S.card}>
      <div style={S.cardHead} onClick={() => setExpanded(x => !x)}>
        <div style={S.thumb}>
          {listing?.images?.[0]
            ? <img src={listing.images[0]} alt="" style={S.thumbImg} />
            : <span style={{ fontSize: 20 }}>📦</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.cardTitle}>{listing?.title || 'Listing removed'}</div>
          <div style={S.cardMeta}>
            {order.order_number} · × {order.quantity} · {shortDate(order.created_at)}
          </div>
          <div style={S.cardBuyer}>Buyer: {buyerName}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={S.cardTotal}>{formatMWK(order.total_amount)}</div>
          <span style={{ ...S.statusPill, color: meta.color, background: meta.bg }}>{meta.label}</span>
        </div>
      </div>

      {expanded && (
        <div style={S.cardBody}>
          <div style={S.detailRow}><span style={S.detailKey}>Payment</span><span>{payLabel}</span></div>
          <div style={S.detailRow}><span style={S.detailKey}>Handover</span><span>{delLabel}</span></div>
          {order.delivery_address && (
            <div style={S.detailRow}><span style={S.detailKey}>Address</span><span>{order.delivery_address}</span></div>
          )}
          {order.buyer_phone && (
            <div style={S.detailRow}><span style={S.detailKey}>Phone</span><a style={S.phoneLink} href={`tel:${order.buyer_phone}`}>{order.buyer_phone}</a></div>
          )}
          {order.buyer_note && (
            <div style={S.detailRow}><span style={S.detailKey}>Note</span><span>"{order.buyer_note}"</span></div>
          )}
          {order.cancel_reason && (
            <div style={S.detailRow}><span style={S.detailKey}>Reason</span><span>{order.cancel_reason}</span></div>
          )}
          {order.rating != null && (
            <div style={S.detailRow}><span style={S.detailKey}>Rating</span><span>{'★'.repeat(order.rating)}{'☆'.repeat(5 - order.rating)}{order.rating_comment ? ` — "${order.rating_comment}"` : ''}</span></div>
          )}
        </div>
      )}

      {actions.length > 0 && (
        <div style={S.actionRow}>
          {actions.map(action => {
            const am = ACTION_META[action]
            return (
              <button
                key={action}
                style={{ ...S.actionBtn, background: am.bg, color: am.color, ...(am.border ? { border: `1.5px solid ${am.border}` } : {}), opacity: busy ? .6 : 1 }}
                disabled={busy}
                onClick={() => onAction(order, action)}>
                {busy ? '…' : am.label}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

const S = {
  tabRow: { display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 14, paddingBottom: 2 },
  tab: { fontSize: 12.5, fontWeight: 700, color: T.textMuted, background: T.white, border: `1px solid ${T.border}`, borderRadius: 20, padding: '7px 14px', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'inherit' },
  tabActive: { color: T.white, background: T.green, borderColor: T.green },
  card: { background: T.white, border: `1px solid ${T.border}`, borderRadius: 14, padding: 14, marginBottom: 10 },
  cardHead: { display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' },
  thumb: { width: 48, height: 48, borderRadius: 10, background: T.gray100, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cardTitle: { fontSize: 13.5, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 },
  cardMeta: { fontSize: 11.5, color: T.textLight, marginTop: 2 },
  cardBuyer: { fontSize: 12, color: T.textMuted, marginTop: 2, fontWeight: 600 },
  cardTotal: { fontSize: 14, fontWeight: 800, color: T.text },
  statusPill: { display: 'inline-block', fontSize: 10.5, fontWeight: 800, borderRadius: 20, padding: '3px 9px', marginTop: 4 },
  cardBody: { borderTop: `1px solid ${T.gray100}`, marginTop: 10, paddingTop: 10 },
  detailRow: { display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12.5, color: T.text, padding: '4px 0' },
  detailKey: { color: T.textLight, fontWeight: 600, flexShrink: 0 },
  phoneLink: { color: T.greenDark, fontWeight: 700, textDecoration: 'none' },
  actionRow: { display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  actionBtn: { fontSize: 13, fontWeight: 700, border: 'none', borderRadius: 10, padding: '10px 16px', cursor: 'pointer', fontFamily: 'inherit', flex: 1, minWidth: 120 },
  empty: { background: T.white, border: `1.5px dashed ${T.border}`, borderRadius: 14, padding: '36px 20px', textAlign: 'center', color: T.textMuted, fontSize: 13.5 },
  retryBtn: { display: 'block', margin: '10px auto 0', background: T.greenLight, color: T.greenDark, border: 'none', borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' },
}
