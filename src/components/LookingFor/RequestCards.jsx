import { useState } from 'react'
import { T } from '../../constants/tokens'
import { URGENCY_OPTIONS } from '../../constants/lookingFor'
import { getDemandLevel, getMatchScore, timeAgo, fmtMWK } from '../../utils/lookingFor'
import { Icon } from './Icons'
import { InfoChip } from './Primitives'

/* ── Featured horizontal card ───────────────────────────────── */
export function FeaturedCard({ req, user, myListings, onOffer }) {
  const isOwn  = req.user_id === user?.id
  const demand = getDemandLevel(req)
  const match  = !isOwn ? getMatchScore(req, myListings) : null
  const urgOpt = URGENCY_OPTIONS.find(u => u.value === req.urgency)
  const [hov, setHov] = useState(false)

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{ flexShrink: 0, width: 220, background: T.white, borderRadius: 18, border: `1px solid ${hov ? T.gray200 : T.gray100}`, overflow: 'hidden', boxShadow: hov ? T.shadowMd : T.shadow, transform: hov ? 'translateY(-4px) scale(1.01)' : 'none', transition: 'all 0.22s cubic-bezier(0.34,1.2,0.64,1)' }}
    >
      {req.image_url && <img src={req.image_url} alt="" style={{ width: '100%', height: 96, objectFit: 'cover' }} />}
      <div style={{ padding: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
          <span style={{ fontSize: 10, fontWeight: 800, color: demand.color, background: demand.bg, borderRadius: 50, padding: '2px 9px' }}>{demand.label}</span>
          {match && <span style={{ fontSize: 10, fontWeight: 800, color: T.green, background: T.greenL, borderRadius: 50, padding: '2px 9px' }}>{match}% match</span>}
        </div>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: T.gray900, marginBottom: 5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.3 }}>
          {req.title}
        </div>
        {req.budget && <div style={{ fontSize: 13, fontWeight: 800, color: T.green, marginBottom: 6 }}>{fmtMWK(req.budget)}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: T.gray600, marginBottom: 9 }}>
          <span>💬 {req.offer_count || 0}</span>
          <span>👁 {req.view_count || 0}</span>
          {urgOpt && req.urgency !== 'flexible' && <span style={{ color: urgOpt.color, fontWeight: 700 }}>{urgOpt.label}</span>}
        </div>
        {!isOwn && (
          <button onClick={() => onOffer(req)} className="lf-btn-primary" style={{ width: '100%', padding: '8px', fontSize: 12.5, borderRadius: 9, justifyContent: 'center' }}>
            Send Offer
          </button>
        )}
      </div>
    </div>
  )
}



/* ── Full request card ───────────────────────────────────────── */
export function RequestCard({ req, user, myListings, onOffer, onSave, onNotify, onFulfill, onDelete, saved, notify, isOwn: forcedOwn, highlight, delay = 0 }) {
  const isOwn   = forcedOwn || req.user_id === user?.id
  const name    = req.profiles?.full_name || 'Buyer'
  const avatar  = req.profiles?.avatar_url
  const initial = name[0]?.toUpperCase() || 'B'
  const demand  = getDemandLevel(req)
  const match   = !isOwn ? getMatchScore(req, myListings) : null
  const urgOpt  = URGENCY_OPTIONS.find(u => u.value === req.urgency)
  const [hov, setHov] = useState(false)

  const categoryEmoji = {
    Electronics: '📱', Services: '🔧', Jobs: '💼',
    Vehicles: '🚗', Fashion: '👗', Food: '🍱',
  }[req.category] || '🛍️'

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: T.white, borderRadius: 18,
        border: `1px solid ${highlight ? '#d1fae5' : hov ? T.gray200 : T.gray100}`,
        overflow: 'hidden', animation: `fadeUp 0.35s ease ${delay}s both`,
        boxShadow: hov ? T.shadowMd : T.shadow,
        transform: hov ? 'translateY(-2px)' : 'none',
        transition: 'all 0.2s ease',
      }}
    >
      {/* Image or emoji banner */}
      <div style={{ position: 'relative', height: 90, overflow: 'hidden' }}>
        {req.image_url
          ? <img src={req.image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          : (
            <div style={{
              width: '100%', height: '100%',
              background: `linear-gradient(135deg, ${demand.bg} 0%, ${T.greenL} 100%)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 34,
            }}>
              {categoryEmoji}
            </div>
          )
        }
        {/* Demand badge top-left */}
        <span style={{
          position: 'absolute', top: 8, left: 8,
          fontSize: 9, fontWeight: 800, color: demand.color,
          background: demand.bg, borderRadius: 50, padding: '2px 8px',
          backdropFilter: 'blur(4px)',
        }}>{demand.label}</span>
        {/* Match badge top-right */}
        {match !== null && (
          <span style={{
            position: 'absolute', top: 8, right: 8,
            fontSize: 9, fontWeight: 800, color: T.green,
            background: T.greenL, borderRadius: 50, padding: '2px 8px',
          }}>{match}% match</span>
        )}
      </div>

      <div style={{ padding: '11px 12px' }}>
        {/* Avatar + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
          <div style={{
            width: 24, height: 24, borderRadius: '50%',
            background: avatar ? 'transparent' : T.gray900,
            overflow: 'hidden', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 800, color: '#fff',
            border: `1.5px solid ${T.gray200}`,
          }}>
            {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: T.gray700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isOwn ? 'You' : name}
          </div>
          <div style={{ fontSize: 10, color: T.gray400, flexShrink: 0 }}>{timeAgo(req.created_at)}</div>
        </div>

        {/* Title */}
        <div style={{
          fontSize: 13.5, fontWeight: 800, color: T.gray900,
          marginBottom: 5, lineHeight: 1.3,
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {req.title}
        </div>

        {/* Budget + urgency row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
          {req.budget && (
            <span style={{ fontSize: 12.5, fontWeight: 800, color: T.green }}>{fmtMWK(req.budget)}</span>
          )}
          {urgOpt && req.urgency !== 'flexible' && (
            <span style={{ fontSize: 10, fontWeight: 700, color: urgOpt.color, background: urgOpt.bg, borderRadius: 50, padding: '1px 7px' }}>
              {urgOpt.label}
            </span>
          )}
          <span style={{ marginLeft: 'auto', fontSize: 10, color: T.gray500 }}>
            💬 {req.offer_count || 0} · 👁 {req.view_count || 0}
          </span>
        </div>

        {/* Location */}
        {(req.cities?.length > 0 || req.city) && (
          <div style={{ fontSize: 10.5, color: T.gray500, marginBottom: 9, display: 'flex', alignItems: 'center', gap: 4 }}>
            {Icon.pin(10)}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {req.cities?.length > 0 ? req.cities.join(', ') : req.city}
            </span>
          </div>
        )}

        {/* Actions */}
        {isOwn ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onFulfill(req.id)} className="lf-btn-secondary" style={{ flex: 1, justifyContent: 'center', fontSize: 11, padding: '7px' }}>
              {Icon.check(11)} Fulfilled
            </button>
            <button onClick={() => onDelete(req.id)} style={{ flex: 1, background: '#fff', border: '1.5px solid #fecaca', borderRadius: 10, padding: '7px', fontSize: 11, fontWeight: 700, color: T.red, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
              {Icon.trash(11)} Delete
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => onOffer(req)} className="lf-btn-primary" style={{ flex: 1, justifyContent: 'center', fontSize: 12, padding: '8px' }}>
              Send Offer
            </button>
            <button onClick={() => onSave(req.id)} style={{ width: 34, height: 34, background: saved ? '#fef2f2' : T.gray50, border: `1.5px solid ${saved ? '#fecaca' : T.gray200}`, borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {saved ? Icon.heart(13, T.red) : Icon.heart(13)}
            </button>
            <button onClick={() => onNotify(req.id)} style={{ width: 34, height: 34, background: notify ? T.greenL : T.gray50, border: `1.5px solid ${notify ? '#a7f3d0' : T.gray200}`, borderRadius: 9, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ fontSize: 13 }}>{notify ? '🔔' : '🔕'}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

  