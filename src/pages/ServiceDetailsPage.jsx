import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Wrench } from 'lucide-react'

const CSS = `
  .sd-page { background:#f8f9fa; color:#202124; min-height:100vh; padding-bottom:24px; font-family:inherit; }
  .sd-wrap { max-width:1100px; margin:0 auto; padding:14px; }
  @media (min-width:1100px) { .sd-wrap { padding:24px; } }
  .sd-skel { background:#e8eaed; border-radius:8px; animation: sd-pulse 1.4s ease-in-out infinite; }
  @keyframes sd-pulse { 0%,100%{opacity:.75} 50%{opacity:.45} }
  .sd-skel-gallery { width:100%; aspect-ratio:4/3; border-radius:16px; background:#e6f6ed; }
  .sd-notfound { max-width:420px; margin:12vh auto 0; background:#fff; border:1px solid #e8eaed; border-radius:18px; padding:32px 24px; text-align:center; }
  .sd-nf-icon { width:64px; height:64px; border-radius:50%; background:#e6f6ed; color:#0F9D58; display:flex; align-items:center; justify-content:center; margin:0 auto 14px; }
  .sd-nf-title { font-size:20px; font-weight:800; margin:0 0 6px; }
  .sd-nf-sub { font-size:14px; color:#5f6368; margin:0 0 20px; line-height:1.6; }
  .sd-btn-primary { min-height:44px; border:none; border-radius:12px; background:#0F9D58; color:#fff; font-size:14px; font-weight:700; font-family:inherit; cursor:pointer; padding:0 18px; display:inline-flex; align-items:center; justify-content:center; gap:6px; }
  .sd-btn-outline { min-height:44px; border:1px solid #e8eaed; border-radius:12px; background:#fff; color:#202124; font-size:14px; font-weight:700; font-family:inherit; cursor:pointer; padding:0 18px; display:inline-flex; align-items:center; justify-content:center; gap:6px; }
`

function DetailsSkeleton() {
  return (
    <div aria-hidden="true">
      <div className="sd-skel sd-skel-gallery" />
      <div className="sd-skel" style={{ width: '62%', height: 24, marginTop: 18 }} />
      <div className="sd-skel" style={{ width: '26%', height: 18, marginTop: 10 }} />
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 16 }}>
        <div className="sd-skel" style={{ width: 36, height: 36, borderRadius: 18 }} />
        <div style={{ flex: 1 }}>
          <div className="sd-skel" style={{ width: '42%', height: 14 }} />
          <div className="sd-skel" style={{ width: '28%', height: 12, marginTop: 6 }} />
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 18 }}>
        {[0, 1, 2].map(n => <div key={n} className="sd-skel" style={{ height: 64, borderRadius: 12 }} />)}
      </div>
      <div className="sd-skel" style={{ width: '35%', height: 16, marginTop: 24 }} />
      <div className="sd-skel" style={{ width: '100%', height: 12, marginTop: 10 }} />
      <div className="sd-skel" style={{ width: '92%', height: 12, marginTop: 6 }} />
      <div className="sd-skel" style={{ width: '80%', height: 12, marginTop: 6 }} />
    </div>
  )
}

export default function ServiceDetailsPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [checking, setChecking] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let active = true
    setChecking(true)
    setNotFound(false)
    supabase
      .from('services')
      .select('id, status')
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return
        if (error || !data || (data.status && data.status !== 'active')) setNotFound(true)
        setChecking(false)
      })
    return () => { active = false }
  }, [id])

  function goBack() {
    const idx = window.history.state?.idx
    if (typeof idx === 'number' && idx > 0) navigate(-1)
    else navigate('/services')
  }

  if (checking) {
    return (
      <div className="sd-page">
        <style>{CSS}</style>
        <div className="sd-wrap"><DetailsSkeleton /></div>
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="sd-page">
        <style>{CSS}</style>
        <div className="sd-wrap">
          <div className="sd-notfound">
            <div className="sd-nf-icon"><Wrench size={28} strokeWidth={1.8} /></div>
            <h1 className="sd-nf-title">Service not found</h1>
            <p className="sd-nf-sub">This service may have been removed or is no longer available.</p>
            <button type="button" className="sd-btn-primary" onClick={() => navigate('/services')}>Browse services</button>
            <div style={{ marginTop: 10 }}>
              <button type="button" className="sd-btn-outline" onClick={goBack}>Go back</button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sd-page">
      <style>{CSS}</style>
      <div className="sd-wrap"><DetailsSkeleton /></div>
    </div>
  )
}
