import React, { useState } from 'react'
import { supabase } from '../lib/supabase'

const T = {
  green: '#0F9D58', greenD: '#0a7a44', greenL: '#e8f5ee',
  amber: '#F9AB00', blue: '#1A73E8', blueL: '#e8f0fe',
  gray100: '#f1f3f4', gray200: '#e8eaed', gray600: '#80868b',
  gray900: '#202124', red: '#ea4335', white: '#ffffff',
}

export default function VerificationModal({ user, onClose, onSuccess }) {
  const [step, setStep]           = useState(1) // 1=info, 2=payment, 3=done
  const [method, setMethod]       = useState('pachangu')
  const [paymentRef, setPaymentRef] = useState('')
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')

  const FEE = 'MK 5,000'
const PACHANGU_NUMBER = '0882 123 456' // replace with your real Pachangu number

  async function submit() {
    if (!paymentRef.trim()) { setError('Enter your payment reference'); return }
    setLoading(true)
    setError('')
    try {
      // check no pending request already
      const { data: existing } = await supabase
        .from('verification_requests')
        .select('id, status')
        .eq('seller_id', user.id)
        .in('status', ['pending', 'approved'])
        .maybeSingle()

      if (existing?.status === 'approved') {
        setError('Your account is already verified!'); setLoading(false); return
      }
      if (existing?.status === 'pending') {
        setError('You already have a pending request.'); setLoading(false); return
      }

      const { error: err } = await supabase.from('verification_requests').insert({
        seller_id: user.id,
        payment_ref: paymentRef.trim(),
        payment_method: method,
        amount_paid: 5000,
      })
      if (err) throw err
      setStep(3)
    } catch (e) {
      setError(e.message)
    }
    setLoading(false)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: T.white, borderRadius: 24, width: '100%', maxWidth: 460,
        padding: 28, boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
        animation: 'fadeUp 0.25s ease',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: T.blueL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20,
            }}>✅</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, color: T.gray900 }}>Get Verified</div>
              <div style={{ fontSize: 12, color: T.gray600 }}>Verified sellers get 3× more views</div>
            </div>
          </div>
          <button onClick={onClose} style={{
            background: T.gray100, border: 'none', borderRadius: '50%',
            width: 32, height: 32, cursor: 'pointer', fontSize: 16,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>×</button>
        </div>

        {step === 1 && (
          <>
            {/* Benefits */}
            <div style={{
              background: T.greenL, borderRadius: 14, padding: '14px 16px', marginBottom: 18,
              border: `1px solid ${T.green}33`,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: T.green, marginBottom: 8 }}>
                ✓ VERIFICATION BENEFITS
              </div>
              {[
                '✅ Verified badge on all your listings',
                '📈 Priority placement in search results',
                '💬 "Verified Seller" trust label in chats',
                '🔔 Buyers filter by Verified — you get found',
              ].map(b => (
                <div key={b} style={{ fontSize: 13, color: '#2d6a4f', marginBottom: 4, lineHeight: 1.5 }}>{b}</div>
              ))}
            </div>

            {/* Fee */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: T.gray100, borderRadius: 12, padding: '12px 16px', marginBottom: 20,
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: T.gray900 }}>One-time verification fee</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: T.amber }}>{FEE}</span>
            </div>

            <button onClick={() => setStep(2)} style={{
              width: '100%', padding: '13px 0', borderRadius: 14,
              background: `linear-gradient(135deg, ${T.green}, ${T.greenD})`,
              border: 'none', color: '#fff', fontSize: 15, fontWeight: 800,
              cursor: 'pointer', boxShadow: '0 4px 16px rgba(15,157,88,0.3)',
            }}>
              Continue to Payment →
            </button>
          </>
        )}

        {step === 2 && (
          <>
            {/* Pachangu instructions */}
            <div style={{
              background: '#f0f7ff', border: '1.5px solid #93c5fd',
              borderRadius: 14, padding: '14px 16px', marginBottom: 16,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <div style={{
                  width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                  background: 'linear-gradient(135deg,#2563eb,#1d4ed8)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 15,
                }}>💸</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1e3a8a' }}>Pay via Pachangu</div>
                  <div style={{ fontSize: 11, color: '#3b82f6' }}>Accepts Airtel Money & TNM Mpamba</div>
                </div>
              </div>
              <div style={{ fontSize: 13, lineHeight: 1.8, color: '#1e3a8a' }}>
                <strong>Amount:</strong> {FEE}<br />
                <strong>Pachangu number:</strong> {PACHANGU_NUMBER}<br />
                <strong>Reference:</strong> Your phone number
              </div>
              <div style={{
                marginTop: 10, background: '#dbeafe', borderRadius: 8,
                padding: '8px 12px', fontSize: 12, color: '#1d4ed8', fontWeight: 500,
              }}>
                💡 Send via *419# (Airtel) or *115# (TNM), enter the Pachangu number above
              </div>
            </div>

            {/* Payment ref input */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: T.gray900, display: 'block', marginBottom: 6 }}>
                Transaction Reference / Receipt Number *
              </label>
              <input
                value={paymentRef}
                onChange={e => setPaymentRef(e.target.value)}
                placeholder="e.g. AIR-20250613-XXXX"
                style={{
                  width: '100%', padding: '11px 14px', borderRadius: 12,
                  border: `1.5px solid ${error ? T.red : T.gray200}`,
                  fontSize: 14, outline: 'none', boxSizing: 'border-box',
                  fontFamily: 'inherit',
                }}
              />
              {error && <div style={{ fontSize: 12, color: T.red, marginTop: 5 }}>{error}</div>}
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setStep(1)} style={{
                flex: 1, padding: '12px 0', borderRadius: 14,
                background: T.gray100, border: 'none',
                fontSize: 14, fontWeight: 600, cursor: 'pointer', color: T.gray600,
              }}>← Back</button>
              <button onClick={submit} disabled={loading} style={{
                flex: 2, padding: '12px 0', borderRadius: 14,
                background: loading ? T.gray200 : `linear-gradient(135deg, ${T.green}, ${T.greenD})`,
                border: 'none', color: loading ? T.gray600 : '#fff',
                fontSize: 14, fontWeight: 800, cursor: loading ? 'not-allowed' : 'pointer',
              }}>
                {loading ? 'Submitting...' : 'Submit for Review ✓'}
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center', padding: '10px 0 6px' }}>
            <div style={{ fontSize: 52, marginBottom: 14 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: T.gray900, marginBottom: 8 }}>
              Request Submitted!
            </div>
            <div style={{ fontSize: 14, color: T.gray600, lineHeight: 1.7, marginBottom: 22 }}>
              Your payment is being reviewed by our team. You'll receive a notification once verified — usually within <strong>24 hours</strong>.
            </div>
            <button onClick={onSuccess || onClose} style={{
              width: '100%', padding: '13px 0', borderRadius: 14,
              background: `linear-gradient(135deg, ${T.green}, ${T.greenD})`,
              border: 'none', color: '#fff', fontSize: 15, fontWeight: 800, cursor: 'pointer',
            }}>Done</button>
          </div>
        )}
      </div>
    </div>
  )
}