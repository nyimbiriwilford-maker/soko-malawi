import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function VerifyPayment() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    const tx_ref = params.get('tx_ref')
    const payStatus = params.get('status')

    if (!tx_ref || payStatus === 'failed') {
      setStatus('failed')
      return
    }
    // Payment succeeded — the request is already in DB as 'pending'
    // Admin will approve it. Just show success.
    setStatus('success')
  }, [])

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f4f1', padding: 20 }}>
      {status === 'checking' && <div>Checking payment…</div>}
      {status === 'success' && (
        <div style={{ background: '#fff', borderRadius: 20, padding: 32, textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>🎉</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Payment Received!</div>
          <p style={{ fontSize: 14, color: '#637068', marginBottom: 22 }}>
            Your verification request is under review. You'll get a notification once approved — usually within 24 hours.
          </p>
          <button onClick={() => navigate('/profile')} style={{
            background: '#1a7a4a', color: '#fff', border: 'none',
            borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>Go to Profile</button>
        </div>
      )}
      {status === 'failed' && (
        <div style={{ background: '#fff', borderRadius: 20, padding: 32, textAlign: 'center', maxWidth: 360 }}>
          <div style={{ fontSize: 52, marginBottom: 14 }}>❌</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>Payment Failed</div>
          <button onClick={() => navigate('/profile')} style={{
            background: '#e74c3c', color: '#fff', border: 'none',
            borderRadius: 12, padding: '12px 28px', fontSize: 14, fontWeight: 700, cursor: 'pointer',
          }}>Try Again</button>
        </div>
      )}
    </div>
  )
}