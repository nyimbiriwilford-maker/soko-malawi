import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function VerifyPayment() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    handle()
  }, [])

  async function handle() {
    const tx_ref = params.get('tx_ref')
    const payStatus = params.get('status')

    if (!tx_ref) { setStatus('failed'); return }

    // get current user
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setStatus('failed'); return }

    const isFeature = tx_ref.startsWith('SOKO-FEATURE-')

    if (payStatus === 'cancelled') {
      if (isFeature) {
        await supabase.from('listing_promotions').delete().eq('seller_id', user.id).eq('tx_ref', tx_ref)
      } else {
        await supabase.from('verification_requests').delete().eq('seller_id', user.id).eq('payment_ref', tx_ref)
      }
      setStatus('cancelled')
      return
    }

    // Verify with PayChangu directly — never trust the URL's status param
    const { data: verifyData, error: verifyErr } = await supabase.functions.invoke('verify-transaction', {
      body: { tx_ref },
    })
    if (verifyErr || !verifyData?.confirmed) { setStatus('failed'); return }

    if (isFeature) {
      const { data: confirmData, error: confirmErr } = await supabase.rpc('confirm_feature_payment', { p_tx_ref: tx_ref })
      if (confirmErr || !confirmData) { setStatus('failed'); return }
      setStatus('success')
      return
    }

    const { error, data } = await supabase.from('verification_requests')
      .update({ status: 'approved', reviewed_at: new Date().toISOString() })
      .eq('seller_id', user.id)
      .eq('payment_ref', tx_ref)
      .select()

    if (error || !data || data.length === 0) { setStatus('failed'); return }
    setStatus('success')
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: '#f0f4f1', padding: 20,
    }}>
      {status === 'checking' && (
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 36, height: 36, border: '3px solid #e0ebe3',
            borderTopColor: '#1a7a4a', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 12px',
          }} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
          <p style={{ color: '#637068', fontSize: 14 }}>Confirming payment…</p>
        </div>
      )}

      {status === 'success' && (
        <div style={{
          background: '#fff', borderRadius: 20, padding: 32,
          textAlign: 'center', maxWidth: 360, boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
        }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🎉</div>
          <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: '#0f1410' }}>
            You're Verified!
          </div>
          <p style={{ fontSize: 14, color: '#637068', marginBottom: 22, lineHeight: 1.6 }}>
            Your seller account is now verified. Your listings will show the ✅ Verified Seller badge.
          </p>
          <button onClick={() => navigate('/profile')} style={{
            width: '100%', background: '#1a7a4a', color: '#fff', border: 'none',
            borderRadius: 12, padding: '13px 28px', fontSize: 15, fontWeight: 700, cursor: 'pointer',
          }}>Go to Profile</button>
        </div>
      )}

      {status === 'cancelled' && (
        <div style={{
          background: '#fff', borderRadius: 20, padding: 32,
          textAlign: 'center', maxWidth: 360,
        }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>↩️</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Payment Cancelled</div>
          <p style={{ fontSize: 14, color: '#637068', marginBottom: 22 }}>
            No payment was made. You can try again anytime.
          </p>
          <button onClick={() => navigate('/profile')} style={{
            width: '100%', background: '#637068', color: '#fff', border: 'none',
            borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>Back to Profile</button>
        </div>
      )}

      {status === 'failed' && (
        <div style={{
          background: '#fff', borderRadius: 20, padding: 32,
          textAlign: 'center', maxWidth: 360,
        }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>❌</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Something went wrong</div>
          <p style={{ fontSize: 14, color: '#637068', marginBottom: 22 }}>
            Please contact support if you were charged.
          </p>
          <button onClick={() => navigate('/profile')} style={{
            width: '100%', background: '#e74c3c', color: '#fff', border: 'none',
            borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>Back to Profile</button>
        </div>
      )}
    </div>
  )
}