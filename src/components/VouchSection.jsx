// src/components/VouchSection.jsx
import { useState } from 'react'
import { useVouchData } from '../hooks/useVouchData'
import TrustBadge from './TrustBadge'
import VouchChainBanner from './VouchChainBanner'
import { submitVouch, withdrawVouch } from '../utils/vouchUtils'

function Avatar({ profile, size = 32 }) {
  const [err, setErr] = useState(false)
  const name = profile?.full_name || 'U'
  const initial = name[0].toUpperCase()
  const colors = ['#1a7a4a','#0f766e','#15803d','#1d4ed8','#7c3aed','#b45309']
  const bg = colors[initial.charCodeAt(0) % colors.length]

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, flexShrink: 0, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    }}>
      {profile?.avatar_url && !err
        ? <img src={profile.avatar_url} alt="" onError={() => setErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span style={{ fontSize: size * 0.38, fontWeight: 800, color: '#fff' }}>{initial}</span>
      }
    </div>
  )
}

export default function VouchSection({ targetUserId, viewerUserId }) {
  const {
    trustScore, dealCount, vouchesIn,
    vouchChain, vouchBudget,
    alreadyVouched, canVouch,
    loading, reload,
  } = useVouchData(targetUserId, viewerUserId)

  const [working, setWorking]   = useState(false)
  const [feedback, setFeedback] = useState('')
  const [expanded, setExpanded] = useState(false)
  const isOwnProfile = targetUserId === viewerUserId

  async function handleVouch() {
    setWorking(true)
    setFeedback('')
    const fn = alreadyVouched
      ? () => withdrawVouch(viewerUserId, targetUserId)
      : () => submitVouch(viewerUserId, targetUserId)
    const { error } = await fn()
    if (error) {
      setFeedback(error.message)
    } else {
      setFeedback(alreadyVouched ? 'Vouch withdrawn.' : '🎉 Vouch sent!')
      reload()
      if (!alreadyVouched) {
        try {
          const { supabase } = await import('../lib/supabase')
          const { data: myProf } = await supabase
            .from('profiles').select('full_name, avatar_url').eq('id', viewerUserId).single()
          await supabase.from('notifications').insert({
            user_id: targetUserId, type: 'new_vouch',
            title: '🌟 Someone vouched for you!',
            body: `${myProf?.full_name || 'Someone'} vouched for you — your reputation is growing.`,
            message: `${myProf?.full_name || 'Someone'} vouched for you`,
            data: { voucher_id: viewerUserId, voucher_name: myProf?.full_name || null,
                    voucher_avatar: myProf?.avatar_url || null },
            read: false,
          })
        } catch (_) {}
      }
    }
    setWorking(false)
  }

  if (loading) return (
    <div style={{ padding: '12px 14px', color: '#aaa', fontSize: 12 }}>Loading…</div>
  )

  const visibleVouches = expanded ? vouchesIn : vouchesIn.slice(0, 3)

  return (
    <div style={{ margin: '0 14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Row 1: compact trust badge ── */}
      <TrustBadge trustScore={trustScore} dealCount={dealCount} />

      {/* ── Row 2: vouch chain banner ── */}
      {!isOwnProfile && vouchChain && (
        <VouchChainBanner vouchChain={vouchChain} loading={false} />
      )}

      {/* ── Row 3: vouch social proof block ── */}
      {vouchesIn.length > 0 ? (
        <div style={{
          background: '#fff',
          border: '1.5px solid #e6f0ea',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg,#1a7a4a,#22a05e)',
            padding: '10px 14px',
            display: 'flex', alignItems: 'center', gap: 10,
          }}>
            {/* Avatar stack */}
            <div style={{ display: 'flex', marginRight: 4 }}>
              {vouchesIn.slice(0, 4).map((v, i) => (
                <div key={v.id} style={{ marginLeft: i === 0 ? 0 : -8, zIndex: 4 - i }}>
                  <Avatar profile={v.profiles} size={28} />
                </div>
              ))}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.2 }}>
                {vouchesIn.length} {vouchesIn.length === 1 ? 'person has' : 'people have'} vouched
              </div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.8)', marginTop: 1 }}>
                Real buyers who trust this seller
              </div>
            </div>
            <button onClick={() => setExpanded(v => !v)} style={{
              background: 'rgba(255,255,255,0.2)', border: 'none',
              color: '#fff', fontSize: 11, fontWeight: 700,
              borderRadius: 20, padding: '4px 10px', cursor: 'pointer',
            }}>
              {expanded ? 'Less ▲' : 'See all ▼'}
            </button>
          </div>

          {/* Vouch list */}
          <div>
            {visibleVouches.map((v, i) => (
              <div key={v.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 14px',
                borderBottom: i < visibleVouches.length - 1 ? '1px solid #f0f4f1' : 'none',
              }}>
                <Avatar profile={v.profiles} size={34} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f1410' }}>
                    {v.profiles?.full_name || 'Anonymous'}
                  </div>
                  <div style={{ fontSize: 10.5, color: '#9ca3af' }}>
                    Vouched {new Date(v.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </div>
                </div>
                <span style={{
                  fontSize: 10, fontWeight: 700, color: '#15803d',
                  background: '#f0faf4', border: '1px solid #a3d4b0',
                  borderRadius: 20, padding: '3px 8px',
                }}>✓ Trusted</span>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div style={{
          background: '#f9fafb', border: '1px dashed #d4ead9',
          borderRadius: 12, padding: '12px 14px',
          textAlign: 'center', fontSize: 12, color: '#9ca3af',
        }}>
          🌱 No vouches yet — be the first to vouch after a confirmed deal.
        </div>
      )}

      {/* ── Row 4: vouch / withdraw button ── */}
      {!isOwnProfile && viewerUserId && (
        <div>
          {canVouch ? (
            <button onClick={handleVouch} disabled={working} style={{
              width: '100%',
              background: alreadyVouched
                ? '#fef2f2'
                : 'linear-gradient(135deg,#1a7a4a,#22a05e)',
              color: alreadyVouched ? '#dc2626' : '#fff',
              border: alreadyVouched ? '1.5px solid #fecaca' : 'none',
              borderRadius: 12, padding: '12px',
              fontSize: 14, fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              {working ? 'Working…' : alreadyVouched ? '↩ Withdraw vouch' : '🛡️ Vouch for this seller'}
            </button>
          ) : (
            <div style={{
              background: '#f4f8f5', border: '1px dashed #d4ead9',
              borderRadius: 12, padding: '11px 14px',
              fontSize: 12, color: '#637068', textAlign: 'center', lineHeight: 1.6,
            }}>
              🔒 Complete a confirmed deal to unlock vouching.
            </div>
          )}
          {feedback && (
            <div style={{
              marginTop: 7, fontSize: 12, fontWeight: 600, textAlign: 'center',
              color: feedback.startsWith('🎉') ? '#1a7a4a' : '#dc2626',
            }}>{feedback}</div>
          )}
        </div>
      )}
    </div>
  )
}