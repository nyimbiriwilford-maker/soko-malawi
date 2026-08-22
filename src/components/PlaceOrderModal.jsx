// Buyer modal: confirms order details and creates an order via place_order RPC.
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  placeOrder, isFlashActive, effectiveUnitPrice,
  PAYMENT_METHODS, DELIVERY_METHODS,
} from '../lib/orders'
import { formatPrice } from '../lib/format'
import { T } from '../constants/shopTokens'
import { Package, Banknote, Eye, Star } from 'lucide-react'

export default function PlaceOrderModal({ listing, quantity, seller, onClose, onPlaced, onQtyChange, initialTotal }) {
  const [deliveryMethod, setDeliveryMethod] = useState('pickup')
  const [paymentMethod, setPaymentMethod] = useState('cash_on_delivery')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const qty = Math.max(1, quantity || 1)
  const unitPrice = effectiveUnitPrice(listing, qty)
  const total = initialTotal != null ? initialTotal : unitPrice * qty
  const flash = isFlashActive(listing)
  const stock = listing.stock_qty != null ? Number(listing.stock_qty) : null
  const needAddress = deliveryMethod === 'delivery'

  async function handleSubmit() {
    if (needAddress && !address.trim()) { setError('Please enter a delivery address.'); return }
    if (paymentMethod === 'mobile_money' && !phone.trim() && !needAddress) {
      // phone optional overall, but required for mobile money coordination
    }
    setSubmitting(true)
    setError(null)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const result = await placeOrder({
        listingId: listing.id,
        quantity: qty,
        paymentMethod,
        deliveryMethod,
        deliveryAddress: needAddress ? address.trim() : null,
        buyerPhone: phone.trim() || null,
        buyerNote: note.trim() || null,
      })
      await notifySeller(user)
      onPlaced?.(result)
    } catch (e) {
      setError(e.message || 'Could not place order. Please try again.')
      setSubmitting(false)
    }
  }

  async function notifySeller(user) {
    try {
      if (!user || user.id === listing.seller_id) return
      const { data: prof } = await supabase.from('profiles').select('full_name').eq('id', user.id).maybeSingle()
      const name = prof?.full_name || 'A buyer'
      await supabase.from('notifications').insert({
        user_id: listing.seller_id,
        type: 'new_order',
        title: '🛒 New order received',
        body: `${name} ordered "${listing.title}" (${qty} × ${formatPrice(unitPrice)})`,
        message: `${name} ordered "${listing.title}" (${qty} × ${formatPrice(unitPrice)})`,
        data: { listing_id: listing.id, listing_title: listing.title, quantity: qty },
        read: false,
      })
    } catch { /* notifications best-effort */ }
  }

  const S = styles
  return (
    <div style={S.overlay} onClick={() => !submitting && onClose()}>
      <div style={S.modal} onClick={e => e.stopPropagation()}>
        <div style={S.handle} />
        <div style={S.title}>Place Order</div>

        {/* Item summary */}
        <div style={S.itemRow}>
          <div style={S.thumb}>
            {listing.images?.[0]
              ? <img src={listing.images[0]} alt="" style={S.thumbImg} />
              : <Package size={22} strokeWidth={1.5} color={T.textLight} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={S.itemTitle}>{listing.title}</div>
            <div style={S.itemMeta}>
              {seller?.full_name || seller?.name || 'Seller'}
              {stock != null && <span> · {stock} in stock</span>}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={S.itemQty}>× {qty}</div>
            {flash && <div style={S.flashTag}>Flash sale</div>}
          </div>
        </div>

        {/* Quantity selector (only when stock tracked) */}
        {stock != null && (
          <div style={S.qtyRow}>
            <span style={S.label}>Quantity</span>
            <div style={S.qtyCtrl}>
              <button style={S.qtyBtn} onClick={() => onQtyChange?.(-1)} disabled={qty <= 1}>−</button>
              <span style={S.qtyVal}>{qty}</span>
              <button style={S.qtyBtn} disabled={qty >= stock} onClick={() => onQtyChange?.(1)}>+</button>
            </div>
          </div>
        )}

        {/* Delivery method */}
        <div style={S.field}>
          <div style={S.label}>How will you get it?</div>
          <div style={S.chipRow}>
            {DELIVERY_METHODS.map(m => (
              <button key={m.value}
                style={{ ...S.chip, ...(deliveryMethod === m.value ? S.chipActive : {}) }}
                onClick={() => setDeliveryMethod(m.value)}>
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {needAddress && (
          <div style={S.field}>
            <div style={S.label}>Delivery address</div>
            <input style={S.input} value={address} onChange={e => setAddress(e.target.value)}
              placeholder="Area, city, landmark…" />
          </div>
        )}

        {/* Payment method */}
        <div style={S.field}>
          <div style={S.label}>Payment</div>
          <select style={S.select} value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}>
            {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <div style={S.payNote}>
            {paymentMethod === 'cash_on_delivery' && 'Pay the seller when you receive or pick up the item.'}
            {paymentMethod === 'mobile_money' && 'Send via Airtel Money or TNM Mpamba — the seller will share their number in chat.'}
            {paymentMethod === 'card' && 'Card checkout is coming soon. You will be able to pay securely here.'}
            {paymentMethod === 'other' && 'Agree on payment with the seller in chat after the order is placed.'}
          </div>
        </div>

        <div style={S.field}>
          <div style={S.label}>Your phone number <span style={S.optional}>(optional)</span></div>
          <input style={S.input} value={phone} onChange={e => setPhone(e.target.value)}
            placeholder="+265 …" inputMode="tel" />
        </div>

        <div style={S.field}>
          <div style={S.label}>Note to seller <span style={S.optional}>(optional)</span></div>
          <textarea style={{ ...S.input, minHeight: 60, resize: 'vertical' }} value={note}
            onChange={e => setNote(e.target.value)} placeholder="e.g. call me before delivery" />
        </div>

        {/* Assurance line */}
        <div style={S.assureRow}>
          {[
            { icon: Banknote, label: 'Pay on delivery' },
            { icon: Eye, label: 'Inspect before paying' },
            { icon: Star, label: 'Rate after delivery' },
          ].map(a => (
            <span key={a.label} style={S.assureItem}>
              <a.icon size={12} strokeWidth={2.2} color={T.greenDark} />{a.label}
            </span>
          ))}
        </div>

        {/* Total */}
        <div style={S.totalRow}>
          <div>
            <div style={S.totalLabel}>Total</div>
            <div style={S.totalSub}>{qty} × {formatPrice(unitPrice)}{flash && listing.price != null && (
              <span style={{ textDecoration: 'line-through', color: T.textLight, marginLeft: 6, fontSize: 12 }}>
                {formatPrice(Number(listing.price) * qty)}
              </span>
            )}</div>
          </div>
          <div style={S.totalAmt}>{formatPrice(total)}</div>
        </div>

        {error && <div style={S.error}>{error}</div>}

        <button style={S.submit} disabled={submitting} onClick={handleSubmit}>
          {submitting ? 'Placing order…' : `Place Order · ${formatPrice(total)}`}
        </button>
        <button style={S.cancel} disabled={submitting} onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

// Local qty changes handled by parent via key remount if needed

const styles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,20,16,.55)', backdropFilter: 'blur(4px)', zIndex: 300, display: 'flex', alignItems: 'flex-end', justifyContent: 'center', animation: 'poFadeIn .15s ease' },
  modal: { background: T.white, borderRadius: '22px 22px 0 0', width: '100%', maxWidth: 480, maxHeight: '92vh', maxHeightWebkit: '92dvh', overflowY: 'auto', padding: '10px 20px 24px', animation: 'poSlideUp .25s ease', fontFamily: T.font },
  handle: { width: 42, height: 4, borderRadius: 2, background: T.gray200, margin: '6px auto 14px' },
  title: { fontSize: 18, fontWeight: 800, color: T.text, marginBottom: 14 },
  itemRow: { display: 'flex', alignItems: 'center', gap: 12, background: T.offwhite, border: `1px solid ${T.border}`, borderRadius: 12, padding: 12, marginBottom: 14 },
  thumb: { width: 56, height: 56, borderRadius: 10, background: T.gray100, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', flexShrink: 0 },
  thumbImg: { width: '100%', height: '100%', objectFit: 'cover' },
  itemTitle: { fontSize: 14, fontWeight: 700, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 },
  itemMeta: { fontSize: 12, color: T.textMuted, marginTop: 2 },
  itemQty: { fontSize: 14, fontWeight: 800, color: T.text },
  flashTag: { fontSize: 10, fontWeight: 800, color: '#dc2626', background: '#fee2e2', borderRadius: 20, padding: '2px 7px', marginTop: 4 },
  qtyRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  qtyCtrl: { display: 'flex', alignItems: 'center', gap: 12 },
  qtyBtn: { width: 32, height: 32, borderRadius: 8, background: T.greenLight, border: `1.5px solid ${T.greenLight}`, color: T.greenDark, fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  qtyVal: { fontSize: 17, fontWeight: 800, color: T.text, minWidth: 22, textAlign: 'center' },
  field: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 6, display: 'block' },
  optional: { fontWeight: 500, color: T.textLight },
  chipRow: { display: 'flex', gap: 8, flexWrap: 'wrap' },
  chip: { fontSize: 13, fontWeight: 600, color: T.textMuted, background: T.white, border: `1.5px solid ${T.border}`, borderRadius: 20, padding: '8px 14px', cursor: 'pointer', fontFamily: 'inherit' },
  chipActive: { color: T.greenDark, background: T.greenLight, borderColor: T.green },
  input: { width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '11px 13px', fontSize: 14, color: T.text, fontFamily: 'inherit', background: T.white, boxSizing: 'border-box' },
  select: { width: '100%', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '11px 13px', fontSize: 14, color: T.text, fontFamily: 'inherit', background: T.white, boxSizing: 'border-box' },
  payNote: { fontSize: 12, color: T.textMuted, marginTop: 6, lineHeight: 1.5 },
  assureRow: { display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '6px 14px', padding: '9px 10px', background: T.offwhite, border: `1px solid ${T.border}`, borderRadius: 10, marginBottom: 12 },
  assureItem: { display: 'inline-flex', alignItems: 'center', gap: 4.5, fontSize: 11, fontWeight: 600, color: T.textMuted },
  totalRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: T.greenLight, border: `1px solid ${T.greenLight}`, borderRadius: 12, padding: '12px 14px', marginBottom: 14 },
  totalLabel: { fontSize: 13, fontWeight: 800, color: T.greenDark },
  totalSub: { fontSize: 11.5, color: T.textMuted, marginTop: 2 },
  totalAmt: { fontSize: 19, fontWeight: 800, color: T.greenDark },
  error: { fontSize: 13, color: '#dc2626', background: '#fee2e2', borderRadius: 10, padding: '10px 12px', marginBottom: 12, fontWeight: 600 },
  submit: { width: '100%', background: T.green, color: T.white, border: 'none', borderRadius: 12, padding: '14px', fontSize: 15, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', boxShadow: '0 4px 14px rgba(15,157,88,.3)' },
  cancel: { width: '100%', background: 'transparent', color: T.textMuted, border: 'none', borderRadius: 12, padding: '12px', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginTop: 8 },
}
