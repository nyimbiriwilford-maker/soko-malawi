/**
 * Shared Looking For request card — used on Looking For page + Home section.
 */
import { Icon } from './Icons'
import { URGENCY_OPTIONS, CAT_EMOJI } from '../../constants/lookingFor'
import { timeAgo, fmtMWK } from '../../utils/lookingFor'

const C = {
  green: '#0F9D58',
  greenL: '#e6f6ed',
  border: '#e8eaed',
  text: '#202124',
  textSub: '#5f6368',
  gray: '#80868b',
  amber: '#92400e',
  amberBg: '#fef3c7',
  blue: '#1A73E8',
}

/** CSS for .lf-card* — inject once via <style>{LOOKING_FOR_CARD_CSS}</style> */
export const LOOKING_FOR_CARD_CSS = `
  .lf-card {
    background: #fff;
    border: 1px solid ${C.border};
    border-radius: 16px;
    padding: 12px;
    cursor: pointer;
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 12px;
    box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.04);
    transition: box-shadow 0.15s, transform 0.15s, border-color 0.15s;
    box-sizing: border-box;
  }
  .lf-card:active { transform: scale(0.98); background: #f8f9fa; }
  .lf-card-media {
    position: relative;
    width: 84px;
    height: 84px;
    flex-shrink: 0;
    border-radius: 12px;
    overflow: hidden;
    background: ${C.greenL};
  }
  .lf-card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .lf-card-media-empty {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    font-size: 36px;
    background: ${C.greenL};
  }
  .lf-card-urgent {
    position: absolute; top: 6px; left: 6px;
    font-size: 11px; font-weight: 700; line-height: 1.2;
    color: ${C.amber}; background: ${C.amberBg};
    border-radius: 999px; padding: 3px 8px;
    white-space: nowrap;
  }
  .lf-card-body {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column; gap: 4px;
  }
  .lf-card-title {
    font-size: 15px; font-weight: 700; color: ${C.text}; margin: 0; line-height: 1.3;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden; word-break: break-word;
  }
  .lf-card-budget-row {
    display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap;
  }
  .lf-card-budget {
    font-size: 16px; font-weight: 800; color: ${C.green}; line-height: 1.2;
  }
  .lf-card-budget-label {
    font-size: 12px; font-weight: 500; color: ${C.gray}; line-height: 1.2;
  }
  .lf-card-meta {
    display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
    font-size: 12px; color: ${C.textSub}; line-height: 1.3;
  }
  .lf-card-meta-pin { display: inline-flex; align-items: center; gap: 3px; }
  .lf-card-chip-more {
    display: inline-flex; align-items: center;
    font-size: 11px; font-weight: 700; color: ${C.green};
    background: ${C.greenL}; border-radius: 999px; padding: 1px 7px;
  }
  .lf-card-meta-dot { color: ${C.gray}; }
  .lf-card-bottom {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    margin: 0;
  }
  .lf-card-buyer {
    display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1;
    font-size: 12px; color: ${C.textSub};
  }
  .lf-card-buyer-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 96px; font-weight: 600; }
  .lf-card-tick { display: inline-flex; flex-shrink: 0; }
  .lf-card-msg {
    display: inline-flex; align-items: center; gap: 3px; flex-shrink: 0;
    font-size: 12px; color: ${C.textSub};
  }
  .lf-card-btn {
    background: ${C.green}; color: #fff; border: none;
    font-size: 14px; font-weight: 700;
    height: 44px; border-radius: 12px; padding: 0 16px;
    cursor: pointer; font-family: inherit; white-space: nowrap;
    display: inline-flex; align-items: center; justify-content: center; gap: 6px;
    flex-shrink: 0;
  }
  .lf-card-btn.is-done {
    background: ${C.border}; color: ${C.textSub};
  }
  /* Tablet + laptop: vertical layout */
  @media (min-width: 768px) {
    .lf-card {
      flex-direction: column;
      align-items: stretch;
      gap: 0;
    }
    .lf-card-media {
      width: 100%;
      height: 132px;
      border-radius: 12px;
    }
    .lf-card-body { gap: 6px; }
    .lf-card-bottom {
      flex-direction: column;
      gap: 10px;
      margin: 0;
    }
    .lf-card-buyer {
      justify-content: space-between;
      flex: none;
      width: 100%;
    }
    .lf-card-btn { width: 100%; box-sizing: border-box; margin: 0; }
  }
  @media (min-width: 1100px) {
    .lf-card-media { height: 148px; }
    @media (hover: hover) and (pointer: fine) {
      .lf-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 8px 24px rgba(15,157,88,0.12);
        border-color: #bbf7d0;
      }
    }
  }
`

export default function LookingForRequestCard({
  req,
  user,
  saved = false,
  isNearYou = false,
  carousel = false,
  onOffer,
  onSave,
  onFulfill,
  onDelete,
  onReactivate,
  onViewDetails,
  compactCta = false,
}) {
  const isOwn = user?.id && req.user_id === user.id
  const urgOpt = (URGENCY_OPTIONS || []).find(u => u.value === req.urgency)
  const showUrgency = !!(urgOpt && req.urgency !== 'flexible')
  const budget = req.budget ? fmtMWK(req.budget) : 'Negotiable'
  const lookingAreas = (req.cities?.length ? req.cities : []).filter(Boolean)
  const firstCity = lookingAreas.length ? lookingAreas[0] : (req.city || 'Remote')
  const moreCount = Math.max(0, lookingAreas.length - 1)
  const daysAgo = timeAgo(req.created_at)
  const profile = Array.isArray(req.profiles) ? req.profiles[0] : req.profiles
  const rawBuyerName = (profile?.full_name || '').trim().split(/\s+/)[0] || 'Buyer'
  const buyerName = rawBuyerName.charAt(0).toUpperCase() + rawBuyerName.slice(1).toLowerCase()
  const isVerified = profile?.is_verified === true
  const offersCount = req.offer_count || 0
  const catEmoji = (CAT_EMOJI && CAT_EMOJI[req.category]) || '📋'
  const hasPhoto = !!req.image_url

  return (
    <article
      className={`lf-card${isNearYou ? ' is-near' : ''}${carousel ? ' is-carousel' : ''}`}
      role="link"
      tabIndex={0}
      onClick={() => onViewDetails?.(req) }
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onViewDetails?.(req)
        }
      }}
    >
      <div className="lf-card-media">
        {hasPhoto
          ? <img src={req.image_url} alt="" className="lf-card-img" loading="lazy" />
          : <div className="lf-card-media-empty">{catEmoji}</div>}
        {showUrgency && <span className="lf-card-urgent">{urgOpt?.label || 'Urgent'}</span>}
      </div>

      <div className="lf-card-body">
        <h3 className="lf-card-title" title={req.title || ''}>
          {req.title || 'Untitled request'}
        </h3>

        <div className="lf-card-budget-row">
          <span className="lf-card-budget">{budget}</span>
          <span className="lf-card-budget-label">Budget</span>
        </div>

        <div className="lf-card-meta">
          <span className="lf-card-meta-pin">
            {Icon.pin(11, C.textSub)}
            {firstCity}
          </span>
          {moreCount > 0 && <span className="lf-card-chip-more">+{moreCount}</span>}
          <span className="lf-card-meta-dot">·</span>
          <span>{daysAgo}</span>
          {req.expires_at && new Date(req.expires_at) <= new Date() && (
            <span style={{ fontSize: 11, fontWeight: 700, color: '#5f6368', background: '#f1f3f4', borderRadius: 999, padding: '2px 8px' }}>No longer active</span>
          )}
        </div>

        <div className="lf-card-bottom">
          <div className="lf-card-buyer">
            <span className="lf-card-buyer-name">{buyerName}</span>
            {isVerified && (
              <span className="lf-card-tick" style={{ color: C.blue }}>
                {Icon.check(12, C.blue)}
              </span>
            )}
            <span className="lf-card-msg">
              {Icon.message(12, C.textSub)}
              {offersCount}
            </span>
          </div>
          {isOwn && (req.expires_at && new Date(req.expires_at) <= new Date()) ? (
            <button
              type="button"
              className="lf-card-btn"
              style={{ background: '#0F9D58', color: '#fff', minHeight: 44 }}
              onClick={e => { e.stopPropagation(); e.preventDefault(); onReactivate?.(req.id) }}
            >
              Reactivate
            </button>
          ) : isOwn && onFulfill ? (
            <button
              type="button"
              className="lf-card-btn is-done"
              onClick={e => { e.stopPropagation(); e.preventDefault(); onFulfill(req.id) }}
            >
              Done
            </button>
          ) : isOwn ? null : (req.expires_at && new Date(req.expires_at) <= new Date()) ? null : (
            <button
              type="button"
              className={`lf-card-btn${req.user_has_offered ? ' is-done' : ''}`}
              onClick={e => { e.stopPropagation(); e.preventDefault(); (onOffer ? onOffer(req) : onViewDetails?.(req)) }}
            >
              {req.user_has_offered ? 'Offered' : 'Make offer'}
            </button>
          )}
        </div>
      </div>
    </article>
  )
}
