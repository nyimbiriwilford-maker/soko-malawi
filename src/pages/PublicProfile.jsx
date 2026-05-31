import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

function getOnlineStatus(lastSeen) {
  if (!lastSeen) return { label: 'Offline', color: '#9ca3af' }
  const mins = Math.floor((Date.now() - new Date(lastSeen)) / 60000)
  if (mins < 5)  return { label: 'Online now',          color: '#15803d' }
  if (mins < 60) return { label: `Active ${mins}m ago`, color: '#d97706' }
  const hrs = Math.floor(mins / 60)
  if (hrs < 24)  return { label: `Active ${hrs}h ago`,  color: '#9ca3af' }
  return { label: 'Offline', color: '#9ca3af' }
}

export default function PublicProfile() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [listings, setListings] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => { load() }, [id])

  async function load() {
    const { data: p } = await supabase.from('profiles').select('*').eq('id', id).single()
    setProfile(p)
    const { data: l } = await supabase.from('listings').select('*')
      .eq('seller_id', id).eq('status', 'active').order('created_at', { ascending: false })
    setListings(l || [])
    setLoading(false)
  }

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ width:30, height:30, border:'3px solid #e0ebe3', borderTopColor:'#1a7a4a', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (!profile) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh' }}>
      <div style={{ fontSize:48, marginBottom:12 }}>👤</div>
      <div style={{ fontSize:18, fontWeight:700 }}>User not found</div>
      <button onClick={() => navigate(-1)} style={{ marginTop:16, background:'#1a7a4a', color:'#fff', border:'none', borderRadius:12, padding:'10px 24px', fontSize:14, fontWeight:700, cursor:'pointer' }}>Go Back</button>
    </div>
  )

  const status = getOnlineStatus(profile.last_seen)

  return (
    <div style={{ minHeight:'100vh', background:'#f0f4f1', fontFamily:'system-ui,sans-serif', maxWidth:480, margin:'0 auto', paddingBottom:40 }}>
      <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {/* Header */}
      <div style={{ background:'#fff', padding:'12px 14px', display:'flex', alignItems:'center', gap:12, borderBottom:'1px solid #e8f0eb', position:'sticky', top:0, zIndex:50 }}>
        <button onClick={() => navigate(-1)} style={{ width:36, height:36, borderRadius:10, background:'#f4f8f5', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2.5" strokeLinecap="round"><polyline points="15 18 9 12 15 6"/></svg>
        </button>
        <div style={{ fontSize:16, fontWeight:700, color:'#0f1410' }}>Seller Profile</div>
      </div>

      {/* Profile card */}
      <div style={{ background:'#fff', margin:14, borderRadius:20, padding:20, boxShadow:'0 2px 10px rgba(0,0,0,0.06)', textAlign:'center', animation:'fadeUp 0.3s ease both' }}>
        <div style={{ width:80, height:80, borderRadius:'50%', background:'linear-gradient(135deg,#1a7a4a,#22a05e)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px', overflow:'hidden', boxShadow:'0 4px 14px rgba(26,122,74,0.25)' }}>
          {profile.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
            : <span style={{ fontSize:32, fontWeight:800, color:'#fff' }}>{(profile.full_name || 'U')[0].toUpperCase()}</span>
          }
        </div>
        <div style={{ fontSize:20, fontWeight:800, color:'#0f1410', marginBottom:4 }}>{profile.full_name || 'Anonymous'}</div>
        {profile.city && <div style={{ fontSize:13, color:'#888', marginBottom:6 }}>📍 {profile.city}</div>}
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:13, fontWeight:600, color: status.color }}>
          <span style={{ width:8, height:8, borderRadius:'50%', background: status.color, display:'inline-block' }} />
          {status.label}
        </div>
      </div>

      {/* Stats */}
      <div style={{ background:'#fff', margin:'0 14px 14px', borderRadius:16, display:'flex', overflow:'hidden', boxShadow:'0 1px 6px rgba(0,0,0,0.05)' }}>
        <div style={{ flex:1, textAlign:'center', padding:'14px 0' }}>
          <div style={{ fontSize:22, fontWeight:800, color:'#0f1410' }}>{listings.length}</div>
          <div style={{ fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'0.4px' }}>Listings</div>
        </div>
        <div style={{ width:1, background:'#e8f0eb', margin:'10px 0' }} />
        <div style={{ flex:1, textAlign:'center', padding:'14px 0' }}>
          <div style={{ fontSize:22, fontWeight:800, color:'#0f1410' }}>{profile.city || '—'}</div>
          <div style={{ fontSize:11, color:'#888', textTransform:'uppercase', letterSpacing:'0.4px' }}>City</div>
        </div>
      </div>

      {/* Listings */}
      <div style={{ padding:'0 14px' }}>
        <div style={{ fontSize:13, fontWeight:700, color:'#637068', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:10 }}>
          Active Listings ({listings.length})
        </div>
        {listings.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px 0', color:'#aaa', fontSize:14 }}>No active listings</div>
        )}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          {listings.map((l, i) => (
            <div key={l.id} onClick={() => navigate('/listing/' + l.id)}
              style={{ background:'#fff', borderRadius:14, overflow:'hidden', cursor:'pointer', boxShadow:'0 1px 5px rgba(0,0,0,0.07)', border:'1px solid #eef3ef', animation:`fadeUp 0.3s ease ${i*0.05}s both` }}>
              <div style={{ height:110, background:'#f0f4f1', overflow:'hidden' }}>
                {l.images?.[0]
                  ? <img src={l.images[0]} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                  : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:32 }}>📦</div>
                }
              </div>
              <div style={{ padding:'8px 10px' }}>
                <div style={{ fontSize:13, fontWeight:700, color:'#0f1410', overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{l.title}</div>
                <div style={{ fontSize:13, fontWeight:800, color:'#1a7a4a', marginTop:2 }}>MWK {Number(l.price||0).toLocaleString()}</div>
                <div style={{ fontSize:11, color:'#888', marginTop:2 }}>📍 {l.city}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}