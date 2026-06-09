// src/components/DealEducationModal.jsx
// Shown to seller when they tap the deal pill button.
// Educates them about deal confirmation, shows their current score,
// then lets them send the request.

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { getTrustScore, getConfirmedDealCount } from '../utils/vouchUtils'

const TIERS = [
  { min: 0,  max: 4,  icon: '👤', label: 'New Seller',   color: '#6b7280', bg: '#f3f4f6' },
  { min: 5,  max: 14, icon: '🔰', label: 'Rising',       color: '#0f766e', bg: '#ccfbf1' },
  { min: 15, max: 29, icon: '✅', label: 'Established',  color: '#1d4ed8', bg: '#dbeafe' },
  { min: 30, max: 59, icon: '🛡️', label: 'Trusted',      color: '#1a7a4a', bg: '#e6f4ec' },
  { min: 60, max: Infinity, icon: '⭐', label: 'Elite',  color: '#b45309', bg: '#fef3c7' },
]

function getTier(score) {
  return TIERS.find(t => score >= t.min && score <= t.max) || TIERS[0]
}

function getNextTier(score) {
  const idx = TIERS.findIndex(t => score >= t.min && score <= t.max)
  return idx < TIERS.length - 1 ? TIERS[idx + 1] : null
}

export default function DealEducationModal({ currentUser, otherProfile, listing, sending: sendingProp, error, onSend, onClose }) {
  const [trustScore, setTrustScore] = useState(null)
  const [dealCount,  setDealCount]  = useState(0)
  const sending = sendingProp ?? false
  const [step, setStep] = useState('educate') // educate | confirm

  // Jump to confirm step automatically when an error arrives
  useEffect(() => {
    if (error) setStep('confirm')
  }, [error])

  useEffect(() => { loadScore() }, [])

  async function loadScore() {
    const [ts, dc] = await Promise.all([
      getTrustScore(currentUser.id),
      getConfirmedDealCount(currentUser.id),
    ])
    setTrustScore(ts)
    setDealCount(dc)
  }

  async function handleSend() {
    try {
      await onSend()
    } catch (e) {
      console.error('[Modal] send error:', e)
    }
  }

  const score    = trustScore?.total_score ?? 0
  const tier     = getTier(score)
  const nextTier = getNextTier(score)
  const toNext   = nextTier ? nextTier.min - score : 0
  const otherName = otherProfile?.full_name || 'the buyer'

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>

        {/* Handle bar */}
        <div style={handle} />

        {step === 'educate' ? (
          <>
            {/* Header */}
            <div style={headerRow}>
              <span style={{ fontSize: 28 }}>🤝</span>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0f1410' }}>
                  Confirm this deal
                </div>
                <div style={{ fontSize: 12, color: '#637068', marginTop: 2 }}>
                  Tsimikizirani mgwirizano
                </div>
              </div>
            </div>

            {/* Current tier card */}
            <div style={{ ...tierCard, background: tier.bg, border: `1.5px solid ${tier.color}33` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ ...tierCircle, border: `3px solid ${tier.color}` }}>
                  <span style={{ fontSize: 18, fontWeight: 900, color: tier.color }}>
                    {Math.round(score)}
                  </span>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 16 }}>{tier.icon}</span>
                    <span style={{ fontSize: 14, fontWeight: 800, color: tier.color }}>
                      {tier.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: '#637068', marginTop: 2 }}>
                    {dealCount} confirmed deal{dealCount !== 1 ? 's' : ''} so far
                  </div>
                </div>
                {dealCount === 0 && (
                  <div style={newBadge}>First deal!</div>
                )}
              </div>

              {/* Progress to next tier */}
              {nextTier && (
                <div style={progressSection}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: '#637068', fontWeight: 600 }}>
                      {toNext} more deal{toNext !== 1 ? 's' : ''} to reach {nextTier.icon} {nextTier.label}
                    </span>
                  </div>
                  <div style={progressBar}>
                    <div style={{
                      ...progressFill,
                      width: `${Math.min(100, ((score - tier.min) / (nextTier.min - tier.min)) * 100)}%`,
                      background: tier.color,
                    }} />
                  </div>
                </div>
              )}
            </div>

            {/* Why it matters */}
            <div style={whySection}>
              <div style={whyTitle}>Why confirm deals? / Chifukwa chake:</div>
              {[
                { icon: '📈', text: 'Your trust score grows with every confirmed deal', sw: 'Ulemu wanu ukukula' },
                { icon: '🛒', text: 'Buyers trust sellers with confirmed deals more', sw: 'Alipitsi akukhulupirira ogulitsa' },
                { icon: '🌟', text: 'Unlock higher tiers and more visibility', sw: 'Peza udindo wapamwamba' },
              ].map((item, i) => (
                <div key={i} style={whyItem}>
                  <span style={{ fontSize: 16, flexShrink: 0 }}>{item.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, color: '#0f1410', fontWeight: 600 }}>{item.text}</div>
                    <div style={{ fontSize: 11, color: '#888', fontStyle: 'italic' }}>{item.sw}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* All tiers preview */}
            <div style={tiersRow}>
              {TIERS.map((t, i) => (
                <div key={i} style={{
                  ...tierPill,
                  background: t.bg,
                  border: `1.5px solid ${score >= t.min ? t.color + '66' : '#e0ebe3'}`,
                  opacity: score >= t.min ? 1 : 0.5,
                }}>
                  <span style={{ fontSize: 14 }}>{t.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: t.color }}>{t.label}</span>
                </div>
              ))}
            </div>

            <button style={primaryBtn} onClick={() => setStep('confirm')}>
              <span style={{ fontSize: 16 }}>🤝</span>
              Send deal confirmation to {otherName}
            </button>

            <button style={ghostBtn} onClick={onClose}>
              Maybe later
            </button>
          </>
        ) : (
          <>
            {/* Confirm step */}
            <div style={headerRow}>
              <span style={{ fontSize: 28 }}>📋</span>
              <div>
                <div style={{ fontSize: 17, fontWeight: 800, color: '#0f1410' }}>
                  Confirm send request
                </div>
                <div style={{ fontSize: 12, color: '#637068', marginTop: 2 }}>
                  Only send if a real deal happened
                </div>
              </div>
            </div>

            {/* Deal summary */}
            {listing && (
              <div style={dealSummary}>
                {listing.images?.[0] && (
                  <img src={listing.images[0]} alt="" style={{ width: 52, height: 52, borderRadius: 10, objectFit: 'cover', flexShrink: 0 }} />
                )}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#0f1410', marginBottom: 3 }}>
                    {listing.title}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#1a7a4a' }}>
                    MWK {Number(listing.price || 0).toLocaleString()}
                  </div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    Buyer: {otherName}
                  </div>
                </div>
              </div>
            )}

            <div style={warningNote}>
              <span style={{ fontSize: 16 }}>⚠️</span>
              <span style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                Only confirm real transactions. Fake confirmations will be detected and your account may be suspended.
              </span>
            </div>

            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 10,
                background: '#fef2f2',
                border: '1.5px solid #fecaca',
                borderRadius: 12, padding: '12px 14px',
                marginBottom: 14,
              }}>
                <span style={{ fontSize: 18, flexShrink: 0 }}>🚫</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#dc2626', marginBottom: 2 }}>
                    Cannot send request
                  </div>
                  <div style={{ fontSize: 12, color: '#991b1b', lineHeight: 1.5 }}>
                    {error}
                  </div>
                </div>
              </div>
            )}

            <button style={{
              ...primaryBtn,
              ...(error ? { background: '#9ca3af', boxShadow: 'none', cursor: 'not-allowed' } : {}),
            }} onClick={error ? undefined : handleSend} disabled={sending || !!error}>
              {sending
                ? <div style={spinner} />
                : <><span style={{ fontSize: 16 }}>✅</span> Send confirmation request</>
              }
            </button>

            <button style={ghostBtn} onClick={() => setStep('educate')}>
              ← Back
            </button>
          </>
        )}
      </div>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
const overlay = {
  position: 'fixed', inset: 0,
  background: 'rgba(0,0,0,0.5)',
  backdropFilter: 'blur(4px)',
  zIndex: 500,
  display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
}

const modal = {
  background: '#fff',
  borderRadius: '24px 24px 0 0',
  padding: '8px 20px 32px',
  width: '100%',
  maxWidth: 480,
  maxHeight: '90vh',
  overflowY: 'auto',
  animation: 'slideUp 0.3s ease',
}

const handle = {
  width: 36, height: 4,
  background: '#e0ebe3',
  borderRadius: 2,
  margin: '8px auto 20px',
}

const headerRow = {
  display: 'flex', alignItems: 'center', gap: 12,
  marginBottom: 16,
}

const tierCard = {
  borderRadius: 14,
  padding: '14px',
  marginBottom: 14,
}

const tierCircle = {
  width: 48, height: 48,
  borderRadius: '50%',
  background: '#fff',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  flexShrink: 0,
}

const newBadge = {
  marginLeft: 'auto',
  background: '#1a7a4a',
  color: '#fff',
  fontSize: 10,
  fontWeight: 800,
  borderRadius: 20,
  padding: '3px 8px',
}

const progressSection = {
  marginTop: 12,
  paddingTop: 10,
  borderTop: '1px solid rgba(0,0,0,0.06)',
}

const progressBar = {
  height: 6, borderRadius: 3,
  background: 'rgba(0,0,0,0.08)',
  overflow: 'hidden',
}

const progressFill = {
  height: '100%',
  borderRadius: 3,
  transition: 'width 0.4s ease',
}

const whySection = {
  background: '#f8fbf9',
  border: '1px solid #e0ebe3',
  borderRadius: 14,
  padding: '12px 14px',
  marginBottom: 14,
}

const whyTitle = {
  fontSize: 11,
  fontWeight: 800,
  color: '#888',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 10,
}

const whyItem = {
  display: 'flex', alignItems: 'flex-start',
  gap: 10, marginBottom: 10,
}

const tiersRow = {
  display: 'flex', gap: 6,
  overflowX: 'auto',
  marginBottom: 16,
  paddingBottom: 2,
}

const tierPill = {
  display: 'flex', flexDirection: 'column',
  alignItems: 'center', gap: 3,
  borderRadius: 10, padding: '8px 10px',
  flexShrink: 0, minWidth: 64,
}

const dealSummary = {
  display: 'flex', alignItems: 'center', gap: 12,
  background: '#f4f8f5',
  border: '1px solid #e0ebe3',
  borderRadius: 14, padding: '12px',
  marginBottom: 14,
}

const warningNote = {
  display: 'flex', alignItems: 'flex-start', gap: 10,
  background: '#fffbeb',
  border: '1px solid #fde68a',
  borderRadius: 12, padding: '10px 12px',
  marginBottom: 14,
}

const primaryBtn = {
  width: '100%',
  background: 'linear-gradient(135deg,#1a7a4a,#22a05e)',
  color: '#fff', border: 'none',
  borderRadius: 14, padding: '14px',
  fontSize: 15, fontWeight: 700,
  cursor: 'pointer',
  display: 'flex', alignItems: 'center',
  justifyContent: 'center', gap: 8,
  marginBottom: 10,
}

const ghostBtn = {
  width: '100%',
  background: 'transparent',
  color: '#888', border: 'none',
  borderRadius: 14, padding: '11px',
  fontSize: 14, fontWeight: 600,
  cursor: 'pointer',
}

const spinner = {
  width: 18, height: 18,
  border: '2px solid rgba(255,255,255,0.4)',
  borderTopColor: '#fff',
  borderRadius: '50%',
  animation: 'spin 0.8s linear infinite',
}