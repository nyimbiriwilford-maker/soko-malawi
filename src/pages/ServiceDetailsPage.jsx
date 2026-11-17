import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { isServiceVerified } from '../lib/serviceRanking'
import { avatarColor, initials } from './serviceData'
import { Wrench, BadgeCheck, Star, MapPin, Eye } from 'lucide-react'

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

function ratingOf(svc) {
  const count = Number(svc?.rating_count ?? svc?.review_count ?? 0) || 0
  const avg = svc?.rating_avg != null ? Number(svc.rating_avg) : (svc?.rating != null ? Number(svc.rating) : NaN)
  if (count > 0 && Number.isFinite(avg)) return { avg, count }
  if (Number.isFinite(avg) && avg > 0) return { avg, count: count || 0 }
  return null
}

function formatRate(rate) {
  if (!rate && rate !== 0) return ''
  const s = String(rate).trim()
  if (!s) return ''
  const slashIdx = s.indexOf('/')
  const amountPart = slashIdx >= 0 ? s.slice(0, slashIdx).trim() : s
  let unit = slashIdx >= 0 ? '/' + s.slice(slashIdx + 1).trim() : ''
  if (/^\/hour$/i.test(unit)) unit = '/hr'
  const cleaned = amountPart.replace(/mwk|mk/gi, '').trim()
  const numMatch = cleaned.match(/[\d,]+/)
  let amount
  if (numMatch) {
    const digits = numMatch[0].replace(/,/g, '')
    amount = /^\d+$/.test(digits) ? 'MK ' + Number(digits).toLocaleString('en-US') : 'MK ' + cleaned
  } else if (cleaned) {
    amount = 'MK ' + cleaned
  } else {
    return ''
  }
  return amount + unit
}

function formatExperience(value) {
  if (value == null || value === '') return '—'
  const s = String(value).trim()
  if (/^\d+(\.\d+)?$/.test(s)) return `${s} yrs`
  return s
}

function monthYear(value) {
  if (!value) return ''
  return new Date(value).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

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
  const [currentUser, setCurrentUser] = useState(null)
  const [service, setService] = useState(null)
  const [profile, setProfile] = useState(null)
  const [shopName, setShopName] = useState('')
  const [reviews, setReviews] = useState([])
  const [similar, setSimilar] = useState([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  const media = Array.isArray(service?.media_urls) ? service.media_urls : []
  const isOwner = !!currentUser && !!service && currentUser.id === service.provider_id
  const providerName = shopName || profile?.full_name || ''
  const verified = isServiceVerified(service, profile)
  const serviceRating = ratingOf(service)
  const reviewAvg = reviews.length
    ? reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length
    : 0
  const displayAvg = serviceRating ? serviceRating.avg : reviewAvg
  const ratingCount = serviceRating ? serviceRating.count : 0
  const totalReviews = Math.max(ratingCount, reviews.length)
  const rateText = formatRate(service?.rate)
  const completed = Number(service?.completed_count ?? service?.jobs_done ?? 0) || 0
  const views = Number(service?.views) || 0

  useEffect(() => {
    let active = true
    setLoading(true)
    setNotFound(false)
    setService(null)
    setProfile(null)
    setShopName('')
    setReviews([])
    setSimilar([])
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!active) return
      setCurrentUser(user || null)

      const { data: svc, error } = await supabase
        .from('services')
        .select('*')
        .eq('id', id)
        .maybeSingle()
      if (!active) return
      if (error || !svc || (svc.status && svc.status !== 'active')) {
        setNotFound(true)
        setLoading(false)
        return
      }
      setService(svc)

      const profilePromise = (async () => {
        if (!svc.provider_id) return null
        let res = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, is_verified, created_at')
          .eq('id', svc.provider_id)
          .maybeSingle()
        if (res.error) {
          res = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url')
            .eq('id', svc.provider_id)
            .maybeSingle()
        }
        return res.data || null
      })()

      const shopPromise = svc.provider_id
        ? supabase.from('shops').select('name').eq('owner_id', svc.provider_id).maybeSingle()
        : Promise.resolve({ data: null })

      const reviewsPromise = supabase
        .from('reviews')
        .select('*')
        .eq('service_id', id)
        .order('created_at', { ascending: false })
        .limit(50)

      const similarPromise = svc.category
        ? supabase
          .from('services')
          .select('*')
          .eq('category', svc.category)
          .eq('status', 'active')
          .neq('id', id)
          .order('created_at', { ascending: false })
          .limit(8)
        : Promise.resolve({ data: [] })

      const [prof, shop, rev, sim] = await Promise.all([
        profilePromise,
        shopPromise,
        reviewsPromise,
        similarPromise,
      ])
      if (!active) return
      setProfile(prof)
      setShopName(shop?.data?.name || '')
      setReviews(rev?.data || [])
      setSimilar(sim?.data || [])
      setLoading(false)

      if (user && user.id !== svc.provider_id) {
        const key = `svc_viewed_${svc.id}`
        try {
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1')
            supabase
              .rpc('increment_service_stat', { p_service_id: svc.id, p_stat: 'views' })
              .then(() => {})
              .catch(() => {})
          }
        } catch { /* ignore */ }
      }
    })()
    return () => { active = false }
  }, [id])

  useEffect(() => {
    if (!service?.name) return
    const prev = document.title
    document.title = `${service.name} - SokoMW`
    return () => { document.title = prev }
  }, [service?.name])

  function goBack() {
    const idx = window.history.state?.idx
    if (typeof idx === 'number' && idx > 0) navigate(-1)
    else navigate('/services')
  }

  if (loading) {
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
      <div className="sd-wrap">
        <button type="button" className="sd-btn-outline" onClick={goBack}>Back</button>
        <h1 style={{ fontSize: 20, fontWeight: 800, margin: '16px 0 4px' }}>{service?.name || service?.title || 'Service'}</h1>
        <div style={{ fontSize: 13, color: '#5f6368' }}>
          {service?.category}
          {service?.city ? ` · ${service.city}` : ''}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <div style={{ width: 36, height: 36, borderRadius: 18, background: avatarColor(providerName), color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800 }}>
            {initials(providerName)}
          </div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
              {providerName || 'Service provider'}
              {verified && <BadgeCheck size={16} color="#1A73E8" aria-label="Verified provider" />}
            </div>
            {profile?.created_at && (
              <div style={{ fontSize: 12, color: '#5f6368' }}>Member since {monthYear(profile.created_at)}</div>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13, color: '#5f6368', flexWrap: 'wrap' }}>
          {totalReviews > 0 ? (
            <>
              <Star size={14} color="#F9AB00" fill="#F9AB00" />
              <strong style={{ color: '#202124' }}>{displayAvg.toFixed(1)}</strong>
              <span>({totalReviews})</span>
            </>
          ) : (
            <span style={{ background: '#f1f3f4', borderRadius: 999, padding: '1px 8px', fontSize: 12, fontWeight: 700 }}>New</span>
          )}
          {service?.city && <><span>·</span><span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><MapPin size={12} /> {service.city}</span></>}
          <span>·</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Eye size={12} /> {views} views</span>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 16 }}>
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{formatExperience(service?.experience)}</div>
            <div style={{ fontSize: 11, color: '#5f6368' }}>Experience</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{rateText || '—'}</div>
            <div style={{ fontSize: 11, color: '#5f6368' }}>Rate</div>
          </div>
          <div style={{ background: '#fff', border: '1px solid #e8eaed', borderRadius: 12, padding: 12, textAlign: 'center' }}>
            <div style={{ fontSize: 15, fontWeight: 800 }}>{completed}</div>
            <div style={{ fontSize: 11, color: '#5f6368' }}>Completed</div>
          </div>
        </div>
        {service?.description && <p style={{ marginTop: 18, fontSize: 14, lineHeight: 1.7 }}>{service.description}</p>}
        <div style={{ marginTop: 14, fontSize: 13, color: '#5f6368' }}>
          {reviews.length} loaded review{reviews.length === 1 ? '' : 's'} · {similar.length} similar service{similar.length === 1 ? '' : 's'}
          {isOwner ? ' · Owner view' : ''}
          {media.length ? ` · ${media.length} media` : ''}
        </div>
      </div>
    </div>
  )
}
