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
  const colors = ['#1a7a4a', '#0f766e', '#15803d', '#1d4ed8', '#7c3aed', '#b45309']
  const bg = colors[initial.charCodeAt(0) % colors.length]

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: bg, flexShrink: 0, overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      border: '2px solid #fff', boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    }}>
      {profile?.avatar_url && !err
        ? (
          <img
            src={profile.avatar_url}
            alt=""
            onError={() => setErr(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        )
        : <span style={{ fontSize: size * 0.38, fontWeight: 800, color: '#fff' }}>{initial}</span>}
    </div>
  )
}

/**
 * @param {object} props
 * @param {string} props.targetUserId
 * @param {string} [props.viewerUserId]
 * @param {boolean} [props.embedded] - hide outer chrome when nested in Trust panel
 */
export default function VouchSection({ targetUserId, viewerUserId, embedded = false }) {
  const {
    trustScore, dealCount, vouchesIn,
    vouchChain, vouchBudget,
    alreadyVouched, canVouch,
    loading, reload,
  } = useVouchData(targetUserId, viewerUserId)

  const [working, setWorking] = useState(false)
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
      setFeedback(alreadyVouched ? 'Vouch withdrawn.' : 'Vouch sent — thank you for building trust.')
      reload()
      if (!alreadyVouched) {
        try {
          const { supabase } = await import('../lib/supabase')
          const { data: myProf } = await supabase
            .from('profiles').select('full_name, avatar_url').eq('id', viewerUserId).single()
          await supabase.from('notifications').insert({
            user_id: targetUserId, type: 'new_vouch',
            title: 'Someone vouched for you!',
            body: `${myProf?.full_name || 'Someone'} vouched for you — your reputation is growing.`,
            message: `${myProf?.full_name || 'Someone'} vouched for you`,
            data: {
              voucher_id: viewerUserId,
              voucher_name: myProf?.full_name || null,
              voucher_avatar: myProf?.avatar_url || null,
            },
            read: false,
          })
        } catch (_) { /* non-blocking */ }
      }
    }
    setWorking(false)
  }

  if (loading) {
    return (
      <div style={{ padding: embedded ? '8px 0' : '12px 14px', color: '#9ca3af', fontSize: 12, fontWeight: 500 }}>
        Loading community trust…
      </div>
    )
  }

  const count = vouchesIn.length
  const visibleVouches = expanded ? vouchesIn : vouchesIn.slice(0, 3)
  const leadNames = vouchesIn
    .slice(0, 2)
    .map((v) => v.profiles?.full_name?.split(' ')[0])
    .filter(Boolean)
  const socialLine = count === 0
    ? null
    : count === 1 && leadNames[0]
      ? `${leadNames[0]} trusts this seller`
      : count === 2 && leadNames.length === 2
        ? `${leadNames[0]} and ${leadNames[1]} trust this seller`
        : leadNames[0]
          ? `${leadNames[0]} and ${count - 1} others trust this seller`
          : `${count} people trust this seller`

  const shell = {
    margin: embedded ? 0 : '0 14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: embedded ? 12 : 10,
  }

  return (
    <div style={shell}>
      {/* Compact tier badge — skip when parent panel already shows score */}
      {!embedded && (
        <TrustBadge trustScore={trustScore} dealCount={dealCount} />
      )}

      {/* Personal connection signal (highest trust for viewer) */}
      {!isOwnProfile && vouchChain && (
        <VouchChainBanner vouchChain={vouchChain} loading={false} />
      )}

      {/* Social proof — real vouchers */}
      {count > 0 ? (
        <div style={{
          background: '#fff',
          border: '1px solid #E5E7EB',
          borderRadius: 16,
          overflow: 'hidden',
          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
        }}>
          {/* Proof header */}
          <div style={{
            padding: '14px 14px 12px',
            background: 'linear-gradient(180deg, #F0FDF4 0%, #FFFFFF 100%)',
            borderBottom: '1px solid #F3F4F6',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {vouchesIn.slice(0, 4).map((v, i) => (
                  <div
                    key={v.id}
                    style={{
                      marginLeft: i === 0 ? 0 : -10,
                      zIndex: 5 - i,
                      boxShadow: '0 0 0 2px #fff',
                      borderRadius: '50%',
                    }}
                  >
                    <Avatar profile={v.profiles} size={36} />
                  </div>
                ))}
                {count > 4 && (
                  <div style={{
                    marginLeft: -10,
                    zIndex: 0,
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: '#ECFDF5',
                    border: '2px solid #fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 11,
                    fontWeight: 800,
                    color: '#065F46',
                  }}>
                    +{count - 4}
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#111827',
                  letterSpacing: '-0.02em',
                  lineHeight: 1.25,
                }}>
                  {socialLine}
                </div>
                <div style={{
                  fontSize: 12,
                  color: '#6B7280',
                  marginTop: 3,
                  lineHeight: 1.4,
                  fontWeight: 500,
                }}>
                  Independent vouchers after real marketplace activity
                </div>
              </div>
            </div>

            {/* Trust metrics strip */}
            <div style={{
              display: 'flex',
              gap: 8,
              marginTop: 12,
              flexWrap: 'wrap',
            }}>
              <span style={metricPill}>
                <strong style={{ color: '#065F46' }}>{count}</strong>
                &nbsp;{count === 1 ? 'vouch' : 'vouches'}
              </span>
              {(dealCount || 0) > 0 && (
                <span style={metricPill}>
                  <strong style={{ color: '#065F46' }}>{dealCount}</strong>
                  &nbsp;confirmed deal{dealCount === 1 ? '' : 's'}
                </span>
              )}
              <span style={{ ...metricPill, background: '#FFFBEB', borderColor: '#FDE68A', color: '#92400E' }}>
                Verified by community
              </span>
            </div>
          </div>

          {/* Endorsement list */}
          <div>
            {visibleVouches.map((v, i) => {
              const name = v.profiles?.full_name || 'Community member'
              const when = new Date(v.created_at).toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
              return (
                <div
                  key={v.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 14px',
                    borderBottom: i < visibleVouches.length - 1 ? '1px solid #F3F4F6' : 'none',
                    background: i % 2 === 0 ? '#fff' : '#FAFFFE',
                  }}
                >
                  <Avatar profile={v.profiles} size={40} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      flexWrap: 'wrap',
                    }}>
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: '#111827' }}>
                        {name}
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: '#15803d',
                        background: '#ECFDF5',
                        border: '1px solid #A7F3D0',
                        borderRadius: 999,
                        padding: '2px 8px',
                      }}>
                        Stands behind this seller
                      </span>
                    </div>
                    <p style={{
                      margin: '6px 0 0',
                      fontSize: 13,
                      color: '#4B5563',
                      lineHeight: 1.45,
                      fontWeight: 500,
                    }}>
                      “I trust this seller on SokoMw.”
                    </p>
                    <div style={{
                      marginTop: 6,
                      fontSize: 11,
                      color: '#9CA3AF',
                      fontWeight: 500,
                    }}>
                      Vouched {when}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {count > 3 && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              style={{
                width: '100%',
                border: 'none',
                borderTop: '1px solid #F3F4F6',
                background: '#FAFAFA',
                padding: '11px 14px',
                fontSize: 13,
                fontWeight: 700,
                color: '#0F9D58',
                cursor: 'pointer',
              }}
            >
              {expanded ? 'Show fewer vouchers' : `See all ${count} vouchers`}
            </button>
          )}
        </div>
      ) : (
        <div style={{
          background: 'linear-gradient(180deg, #F9FAFB 0%, #fff 100%)',
          border: '1px solid #E5E7EB',
          borderRadius: 16,
          padding: '16px 14px',
          textAlign: 'left',
        }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
            Building community trust
          </div>
          <div style={{ fontSize: 12.5, color: '#6B7280', lineHeight: 1.5, fontWeight: 500 }}>
            No public vouches yet. Vouches come from real people after marketplace activity —
            when they appear here, you can buy with more confidence.
          </div>
        </div>
      )}

      {/* Why vouches matter */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 8,
      }}>
        {[
          { t: 'Real people', d: 'Named profiles, not anonymous reviews' },
          { t: 'Accountable', d: 'Vouchers risk their own reputation' },
        ].map((item) => (
          <div
            key={item.t}
            style={{
              background: '#FAFAFA',
              border: '1px solid #E5E7EB',
              borderRadius: 12,
              padding: '10px 11px',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>{item.t}</div>
            <div style={{ fontSize: 11, color: '#6B7280', marginTop: 3, lineHeight: 1.35 }}>{item.d}</div>
          </div>
        ))}
      </div>

      {/* Vouch CTA */}
      {!isOwnProfile && viewerUserId && (
        <div>
          {canVouch ? (
            <button
              type="button"
              onClick={handleVouch}
              disabled={working}
              style={{
                width: '100%',
                background: alreadyVouched ? '#fff' : '#0F9D58',
                color: alreadyVouched ? '#DC2626' : '#fff',
                border: alreadyVouched ? '1.5px solid #FECACA' : 'none',
                borderRadius: 12,
                padding: '13px 14px',
                fontSize: 14,
                fontWeight: 700,
                cursor: working ? 'wait' : 'pointer',
                letterSpacing: '-0.01em',
                boxShadow: alreadyVouched ? 'none' : '0 1px 2px rgba(15,157,88,0.25)',
              }}
            >
              {working
                ? 'Working…'
                : alreadyVouched
                  ? 'Withdraw your vouch'
                  : 'Vouch for this seller'}
            </button>
          ) : (
            <div style={{
              background: '#F8FAFC',
              border: '1px solid #E5E7EB',
              borderRadius: 12,
              padding: '12px 14px',
              fontSize: 12.5,
              color: '#4B5563',
              textAlign: 'left',
              lineHeight: 1.5,
              fontWeight: 500,
            }}>
              <strong style={{ color: '#111827', fontWeight: 700 }}>Want to vouch?</strong>
              {' '}
              Complete a confirmed deal with this seller first. That keeps vouches meaningful and protects buyers.
            </div>
          )}
          {feedback && (
            <div style={{
              marginTop: 8,
              fontSize: 12.5,
              fontWeight: 600,
              textAlign: 'center',
              color: feedback.toLowerCase().includes('withdraw') || feedback.toLowerCase().includes('error') || feedback.toLowerCase().includes('fail')
                ? (feedback.toLowerCase().includes('withdraw') && !feedback.toLowerCase().includes('error') ? '#6B7280' : '#DC2626')
                : '#0F9D58',
            }}>
              {feedback}
            </div>
          )}
          {canVouch && !alreadyVouched && vouchBudget != null && (
            <div style={{
              marginTop: 8,
              fontSize: 11,
              color: '#9CA3AF',
              textAlign: 'center',
              fontWeight: 500,
            }}>
              Your vouch strengthens their reputation with future buyers.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const metricPill = {
  display: 'inline-flex',
  alignItems: 'center',
  fontSize: 11.5,
  fontWeight: 600,
  color: '#374151',
  background: '#ECFDF5',
  border: '1px solid #D1FAE5',
  borderRadius: 999,
  padding: '4px 10px',
}
