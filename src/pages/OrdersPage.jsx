// Buyer order tracking page: place/cancel orders, track status, rate deliveries.
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import SokoNav from '../components/SokoNav'
import {
  fetchOrders, cancelOrder, rateOrder, buyerCanCancel, buyerCanRate,
  ORDER_STATUS_META, STATUS_STEPS, PAYMENT_METHODS, DELIVERY_METHODS,
  shortDate,
} from '../lib/orders'
import { formatPrice } from '../lib/format'
import { ShoppingBag, Package, Star, MessageCircle, MapPin } from 'lucide-react'
import { T } from '../constants/shopTokens'

const TABS = [
  { id: 'active', label: 'Active' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
]

const ACTIVE_STATUSES = ['pending', 'accepted', 'dispatched']
const COMPLETED_STATUSES = ['delivered', 'rated']

export default function OrdersPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('active')
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchOrders({ role: 'buyer', status: 'all' })
      setOrders(data)
    } catch (e) {
      setError(e.message || 'Failed to load orders.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load()
  }, [load])

  useEffect(() => {
    const channel = supabase
      .channel('orders-buyer-page')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [load])

  const filtered = orders.filter(o =>
    tab === 'active' ? ACTIVE_STATUSES.includes(o.status)
    : tab === 'completed' ? COMPLETED_STATUSES.includes(o.status)
    : o.status === 'cancelled'
  )

  const counts = {
    active: orders.filter(o => ACTIVE_STATUSES.includes(o.status)).length,
    completed: orders.filter(o => COMPLETED_STATUSES.includes(o.status)).length,
    cancelled: orders.filter(o => o.status === 'cancelled').length,
  }

  return (
    <div style={S.page}>
      <style>{globalCss}</style>
      <SokoNav navigate={navigate} />

      <div style={S.wrap}>
        <div style={S.header}>
          <h1 style={S.h1}>My Orders</h1>
          <p style={S.sub}>Track purchases, confirm delivery, and rate sellers</p>
        </div>

        <div style={S.tabRow}>
          {TABS.map(t => (
            <button key={t.id} style={{ ...S.tab, ...(tab === t.id ? S.tabActive : {}) }} onClick={() => setTab(t.id)}>
              {t.label}{counts[t.id] > 0 && <span style={S.tabCount}>{counts[t.id]}</span>}
            </button>
          ))}
        </div>

        {loading && orders.length === 0 && <div style={S.empty}>Loading your orders…</div>}
        {error && <div style={{ ...S.empty, color: '#dc2626' }}>{error}</div>}

        {!loading && !error && filtered.length === 0 && (
          <div style={S.empty}>
            <div style={{ marginBottom: 10, display: 'flex', justifyContent: 'center' }}>
              <ShoppingBag size={38} strokeWidth={1.5} color={T.textLight} />
            </div>
            {tab === 'active' ? 'No active orders yet. Browse a shop and tap "Place Order" on a product.' :
             tab === 'completed' ? 'No completed orders yet.' : 'No cancelled orders.'}
            {tab === 'active' && (
              <button style={S.browseBtn} onClick={() => navigate('/shops')}>Browse Shops</button>
            )}
          </div>
        )}

        {filtered.map(order => (
          <BuyerOrderCard key={order.id} order={order} onChanged={load} navigate={navigate} />
        ))}
      </div>
    </div>
  )
}

function BuyerOrderCard({ order, onChanged, navigate }) {
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)
  const [showRate, setShowRate] = useState(false)
  const [stars, setStars] = useState(5)
  const [comment, setComment] = useState('')

  const meta = ORDER_STATUS_META[order.status] || ORDER_STATUS_META.pending
  const listing = order.listings
  const sellerName = order.shop?.name || order.seller?.full_name || order.seller?.name || 'Seller'
  const payLabel = PAYMENT_METHODS.find(m => m.value === order.payment_method)?.label || order.payment_method
  const delLabel = DELIVERY_METHODS.find(m => m.value === order.delivery_method)?.label || order.delivery_method

  async function doCancel() {
    setBusy(true)
    try {
      await cancelOrder(order.id)
      await onChanged()
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Could not cancel.' })
    } finally {
      setBusy(false)
    }
  }

  async function doRate() {
    setBusy(true)
    try {
      await rateOrder(order.id, stars, comment.trim() || null)
      setShowRate(false)
      await onChanged()
    } catch (e) {
      setMsg({ type: 'error', text: e.message || 'Could not submit rating.' })
    } finally {
      setBusy(false)
    }
  }

  const stepIdx = STATUS_STEPS.indexOf(order.status)
  const progress = order.status === 'cancelled' ? -1
    : order.status === 'rated' ? STATUS_STEPS.length - 1
    : stepIdx

  return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={S.thumb} onClick={() => listing && navigate(`/listing/${listing.id}`)}>
          {listing?.images?.[0]
            ? <img src={listing.images[0]} alt="" style={S.thumbImg} />
            : <Package size={22} strokeWidth={1.5} color={T.textLight} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={S.cardTitle} onClick={() => listing && navigate(`/listing/${listing.id}`)}>
            {listing?.title || 'Listing removed'}
          </div>
          <div style={S.cardMeta}>
            {order.order_number} · {sellerName}
          </div>
          <div style={S.cardMeta}>{shortDate(order.created_at)} · × {order.quantity} · {payLabel} · {delLabel}</div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={S.total}>{formatPrice(order.total_amount)}</div>
          <span style={{ ...S.pill, color: meta.color, background: meta.bg }}>{meta.buyerLabel}</span>
        </div>
      </div>

      {/* Status stepper */}
      {order.status !== 'cancelled' && (
        <div style={S.stepper}>
          {STATUS_STEPS.map((step, i) => {
            const done = progress >= i
            const m = ORDER_STATUS_META[step]
            return (
              <div key={step} style={{ display: 'flex', alignItems: 'center', flex: i < STATUS_STEPS.length - 1 ? 1 : 'none' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{
                    width: 22, height: 22, borderRadius: '50%',
                    background: done ? T.green : T.gray100,
                    border: done ? 'none' : `1.5px solid ${T.gray200}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: T.white, fontSize: 11, fontWeight: 800,
                  }}>
                    {done ? '✓' : i + 1}
                  </div>
                  <span style={{ fontSize: 10, color: done ? T.greenDark : T.textLight, fontWeight: done ? 700 : 500 }}>{m.label}</span>
                </div>
                {i < STATUS_STEPS.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: progress > i ? T.green : T.gray200, margin: '0 4px', marginBottom: 16, borderRadius: 2 }} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {order.delivery_address && (
        <div style={S.infoLine}>
          <MapPin size={13} strokeWidth={2} color={T.textMuted} style={{ verticalAlign: '-2px', marginRight: 6 }} />
          {order.delivery_address}
        </div>
      )}
      {order.cancel_reason && order.status === 'cancelled' && (
        <div style={{ ...S.infoLine, color: '#dc2626' }}>{order.cancel_reason}</div>
      )}

      {/* Rating */}
      {order.status === 'rated' && order.rating != null && (
        <div style={S.ratedLine}>
          <span style={{ color: '#f59e0b' }}>{'★'.repeat(order.rating)}{'☆'.repeat(5 - order.rating)}</span>
          {order.rating_comment && <span style={{ color: T.textMuted }}> "{order.rating_comment}"</span>}
        </div>
      )}

      {showRate && (
        <div style={S.rateBox}>
          <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 8 }}>How was your experience?</div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 8, justifyContent: 'center' }}>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 26 }}
                onClick={() => setStars(n)}>
                <span style={{ color: n <= stars ? '#f59e0b' : T.gray200 }}>★</span>
              </button>
            ))}
          </div>
          <textarea style={S.rateInput} value={comment} onChange={e => setComment(e.target.value)}
            placeholder="Optional comment…" />
          <button style={S.rateSubmit} disabled={busy} onClick={doRate}>{busy ? 'Submitting…' : 'Submit Rating'}</button>
        </div>
      )}

      {msg && <div style={{ ...S.msgLine, color: msg.type === 'error' ? '#dc2626' : T.greenDark }}>{msg.text}</div>}

      <div style={S.actionRow}>
        {buyerCanCancel(order.status) && (
          <button style={S.cancelBtn} disabled={busy} onClick={doCancel}>{busy ? '…' : 'Cancel Order'}</button>
        )}
        {buyerCanRate(order.status) && !showRate && (
          <button style={S.primaryBtn} onClick={() => setShowRate(true)}>
            <Star size={15} strokeWidth={2.2} fill={T.white} /> Rate & Complete
          </button>
        )}
        {order.seller_id && (
          <button style={S.linkBtn} onClick={() => navigate(`/chat/${order.seller_id}`)}>
            <MessageCircle size={15} strokeWidth={2.2} /> Chat with Seller
          </button>
        )}
      </div>
    </div>
  )
}

const globalCss = `
  @keyframes opFade { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
`

const S = {
  page: { minHeight: '100vh', background: T.offwhite, fontFamily: T.font },
  wrap: { maxWidth: 760, margin: '0 auto', padding: '20px 16px 120px', animation: 'opFade .25s ease' },
  header: { marginBottom: 16 },
  h1: { fontSize: 22, fontWeight: 800, color: T.text, fontFamily: T.fontDisplay, margin: 0 },
  sub: { fontSize: 13, color: T.textMuted, marginTop: 4 },
  tabRow: { display: 'flex', gap: 8, marginBottom: 16 },
  tab: { flex: 1, fontSize: 13, fontWeight: 700, color: T.textMuted, background: T.white, border: `1px solid ${T.border}`, borderRadius: 12, padding: '10px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: 'inherit' },
  tabActive: { color: T.white, background: T.green, borderColor: T.green },
  tabCount: { fontSize: 11, fontWeight: 800, background: 'rgba(255,255,255,.25)', borderRadius: 20, padding: '1px 7px' },
  card: { background: T.white, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 12, animation: 'opFade .25s ease' },
  thumb: { width: 56, height: 56, borderRadius: 12, background: T.gray100, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0, cursor: 'pointer' },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  cardTitle: { fontSize: 14.5, fontWeight: 700, color: T.text, cursor: 'pointer' },
  cardMeta: { fontSize: 12, color: T.textLight, marginTop: 2 },
  total: { fontSize: 15, fontWeight: 800, color: T.text },
  pill: { display: 'inline-block', fontSize: 11, fontWeight: 800, borderRadius: 20, padding: '3px 10px', marginTop: 4 },
  stepper: { display: 'flex', alignItems: 'flex-start', marginTop: 16, padding: '0 4px' },
  infoLine: { fontSize: 12.5, color: T.textMuted, marginTop: 10, background: T.offwhite, borderRadius: 8, padding: '8px 10px' },
  ratedLine: { fontSize: 13, marginTop: 10 },
  rateBox: { marginTop: 12, background: T.offwhite, borderRadius: 12, padding: 14 },
  rateInput: { width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '10px 12px', fontSize: 13, fontFamily: 'inherit', minHeight: 56, resize: 'vertical', boxSizing: 'border-box', marginBottom: 8 },
  rateSubmit: { width: '100%', background: T.green, color: T.white, border: 'none', borderRadius: 10, padding: '11px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  msgLine: { fontSize: 12.5, fontWeight: 600, marginTop: 8 },
  actionRow: { display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  primaryBtn: { flex: 1, minWidth: 130, background: T.green, color: T.white, border: 'none', borderRadius: 10, padding: '11px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  cancelBtn: { flex: 1, minWidth: 110, background: T.white, color: '#dc2626', border: '1.5px solid #fecaca', borderRadius: 10, padding: '11px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  linkBtn: { flex: 1, minWidth: 110, background: T.white, color: T.textMuted, border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '11px 14px', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 },
  empty: { background: T.white, border: `1.5px dashed ${T.border}`, borderRadius: 16, padding: '44px 20px', textAlign: 'center', color: T.textMuted, fontSize: 14 },
  browseBtn: { marginTop: 14, background: T.green, color: T.white, border: 'none', borderRadius: 10, padding: '11px 22px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
}
