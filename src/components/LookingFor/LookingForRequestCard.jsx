/**
 * Shared Looking For request card — used on Looking For page + Home section.
 */
import { Icon, CatIcon } from './Icons'
import { URGENCY_OPTIONS } from '../../constants/lookingFor'
import { timeAgo, fmtMWK } from '../../utils/lookingFor'

const C = {
  green: '#0F9D58',
  greenL: '#e8f5ee',
  border: '#e8eaed',
  bg: '#f8f9fa',
  text: '#202124',
  textSub: '#5f6368',
  gray1: '#5f6368',
  gray2: '#80868b',
  gray3: '#9aa0a6',
  red: '#ea4335',
}

/** CSS for .lf-card* — inject once via <style>{LOOKING_FOR_CARD_CSS}</style> */
export const LOOKING_FOR_CARD_CSS = `
  .lf-card {
    background: #fff;
    border: 1px solid ${C.border};
    border-radius: 14px;
    overflow: hidden;
    cursor: pointer;
    display: flex;
    flex-direction: column;
    height: 100%;
    min-height: 0;
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  }
  .lf-card:hover {
    border-color: #22c55e;
    box-shadow: 0 6px 18px rgba(15,157,88,0.12);
    transform: translateY(-1px);
  }
  .lf-card.is-near {
    border-color: ${C.green};
    box-shadow: 0 0 0 1px rgba(15,157,88,0.1);
  }
  .lf-card-media {
    position: relative;
    height: 148px;
    min-height: 148px;
    max-height: 148px;
    background: ${C.bg};
    flex-shrink: 0;
    overflow: hidden;
  }
  .lf-card-img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .lf-card-media-empty {
    width: 100%; height: 100%;
    display: flex; align-items: center; justify-content: center;
    background: linear-gradient(145deg, #e8f5ee, #f8faf9);
  }
  .lf-card-media-top {
    position: absolute; top: 8px; left: 8px; right: 8px;
    display: flex; align-items: flex-start; justify-content: space-between; gap: 6px;
  }
  .lf-card-media-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
  .lf-card-media-bottom {
    position: absolute; bottom: 8px; left: 8px; right: 8px;
    display: flex; flex-wrap: wrap; gap: 5px; justify-content: flex-end;
  }
  .lf-card-chip {
    font-size: 10px; font-weight: 800; border-radius: 999px; padding: 4px 9px;
    line-height: 1.2; white-space: nowrap; max-width: 72%;
    overflow: hidden; text-overflow: ellipsis;
    display: inline-flex; align-items: center; gap: 4px;
  }
  .lf-card-chip-dark {
    background: rgba(15,23,42,0.62); color: #fff;
    backdrop-filter: blur(8px); max-width: 78%;
  }
  .lf-card-chip-green { background: rgba(15,157,88,0.95); color: #fff; }
  .lf-card-save {
    width: 30px; height: 30px; border-radius: 50%; border: none;
    background: rgba(255,255,255,0.94);
    box-shadow: 0 1px 4px rgba(0,0,0,0.12);
    cursor: pointer; display: flex; align-items: center; justify-content: center;
    flex-shrink: 0; padding: 0; color: ${C.gray1};
  }
  .lf-card-save.is-saved { color: ${C.red}; }
  .lf-card-body {
    padding: 10px 12px 11px;
    display: flex; flex-direction: column; gap: 6px;
    flex: 1; min-width: 0;
  }
  .lf-card-user {
    display: flex; align-items: center; justify-content: space-between;
    gap: 8px; min-width: 0; height: 22px; flex-shrink: 0;
  }
  .lf-card-user-left {
    display: flex; align-items: center; gap: 6px; min-width: 0; flex: 1;
  }
  .lf-card-avatar {
    width: 22px; height: 22px; border-radius: 50%; object-fit: cover; flex-shrink: 0;
  }
  .lf-card-avatar-fallback {
    background: ${C.green}; color: #fff; font-size: 10px; font-weight: 800;
    display: flex; align-items: center; justify-content: center;
  }
  .lf-card-name {
    font-size: 12px; font-weight: 700; color: ${C.textSub};
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0;
  }
  .lf-card-verified { display: flex; flex-shrink: 0; }
  .lf-card-time {
    font-size: 11px; color: ${C.gray3}; font-weight: 600;
    flex-shrink: 0; white-space: nowrap; margin-left: 8px;
  }
  .lf-card-flags {
    display: flex; align-items: center; flex-wrap: wrap; gap: 5px;
    min-height: 20px; flex-shrink: 0;
  }
  .lf-card-flags.is-empty { min-height: 0; height: 0; overflow: hidden; margin: 0; gap: 0; }
  .lf-card-urg {
    font-size: 10px; font-weight: 800; border-radius: 999px; padding: 3px 8px;
    flex-shrink: 0; white-space: nowrap; display: inline-flex; align-items: center; gap: 3px;
  }
  .lf-card-days { color: ${C.green}; background: ${C.greenL}; }
  .lf-card-title {
    font-size: 14px; font-weight: 800; color: ${C.text}; margin: 0; line-height: 1.3;
    min-height: 1.3em; max-height: 2.6em;
    display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
    overflow: hidden; word-break: break-word; flex-shrink: 0;
  }
  .lf-card-meta {
    display: grid; grid-template-columns: minmax(0,1fr) minmax(0,1fr);
    align-items: center; column-gap: 10px; min-width: 0; flex-shrink: 0;
  }
  .lf-card-budget {
    font-size: 13px; font-weight: 800; color: ${C.green};
    display: flex; align-items: center; gap: 5px; min-width: 0;
  }
  .lf-card-budget-ico { display: flex; flex-shrink: 0; }
  .lf-card-budget-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lf-card-loc {
    display: flex; align-items: center; justify-content: flex-end; gap: 4px;
    min-width: 0; font-size: 12px; font-weight: 600; color: ${C.textSub};
  }
  .lf-card-loc-ico { flex-shrink: 0; display: flex; }
  .lf-card-loc-text {
    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right;
  }
  .lf-card-foot {
    display: flex; align-items: center; justify-content: space-between; gap: 8px;
    margin-top: auto; padding-top: 8px; border-top: 1px solid ${C.border}; flex-shrink: 0;
  }
  .lf-card-counts {
    font-size: 11px; color: ${C.gray2}; font-weight: 600; white-space: nowrap;
    display: inline-flex; align-items: center; min-width: 72px;
  }
  .lf-card-count-item { display: inline-flex; align-items: center; gap: 3px; }
  .lf-card-dot { margin: 0 5px; color: ${C.gray3}; }
  .lf-card-actions { display: flex; gap: 6px; flex-shrink: 0; align-items: center; }
  .lf-card-btn {
    border-radius: 8px; font-size: 11.5px; font-weight: 700; height: 28px;
    min-width: 64px; padding: 0 10px; cursor: pointer; font-family: inherit;
    line-height: 1; white-space: nowrap; display: inline-flex; align-items: center;
    justify-content: center; gap: 4px; box-sizing: border-box;
  }
  .lf-card-btn-ico { display: inline-flex; }
  .lf-card-btn-ghost {
    background: transparent; border: 1px solid ${C.border}; color: ${C.textSub};
  }
  .lf-card-btn-primary {
    background: ${C.green}; border: 1px solid ${C.green}; color: #fff; min-width: 72px;
  }
  .lf-card-btn-primary.is-done {
    background: ${C.border}; border-color: ${C.border}; color: ${C.textSub};
  }
  .lf-card-btn-danger {
    background: transparent; border: 1px solid #fca5a5; color: #dc2626;
    min-width: 36px; padding: 0 8px;
  }
  /* Compact carousel width when used on Home */
  .lf-card.is-carousel {
    flex-shrink: 0;
    width: 248px;
    max-width: min(248px, 78vw);
    height: auto;
    min-height: 0;
  }
  .lf-card.is-carousel .lf-card-media {
    height: 118px; min-height: 118px; max-height: 118px;
  }
  .lf-card.is-carousel .lf-card-body {
    padding: 10px 11px 11px;
    gap: 5px;
  }
  .lf-card.is-carousel .lf-card-title {
    font-size: 13.5px;
    min-height: 1.3em;
    max-height: 2.6em;
  }
  .lf-card.is-carousel .lf-card-foot {
    padding-top: 7px;
    gap: 6px;
  }
  .lf-card.is-carousel .lf-card-btn-primary {
    min-width: 0;
    flex: 1;
  }
  .lf-card.is-carousel .lf-card-counts {
    min-width: 0;
  }
  /* Distance chip sits in body — not stacked on the photo */
  .lf-card-dist-row {
    display: flex;
    flex-wrap: wrap;
    gap: 5px;
    min-height: 0;
    flex-shrink: 0;
  }
  .lf-card-dist-row.is-empty { display: none; }
  .lf-card-dist-chip {
    font-size: 10px; font-weight: 800; border-radius: 999px;
    padding: 3px 8px; line-height: 1.2; white-space: nowrap;
    display: inline-flex; align-items: center; gap: 3px;
    background: ${C.greenL}; color: ${C.green};
    max-width: 100%;
    overflow: hidden; text-overflow: ellipsis;
  }
  @media (max-width: 640px) {
    .lf-card-media { height: 124px; min-height: 124px; max-height: 124px; }
    .lf-card.is-carousel {
      width: min(236px, 74vw);
      max-width: min(236px, 74vw);
    }
    .lf-card.is-carousel .lf-card-media {
      height: 108px; min-height: 108px; max-height: 108px;
    }
  }
`

/**
 * @param {object} props
 * @param {object} props.req
 * @param {object} [props.user]
 * @param {boolean} [props.saved]
 * @param {boolean} [props.isNearYou]
 * @param {boolean} [props.carousel] fixed width for horizontal home carousel
 * @param {function} [props.onOffer]
 * @param {function} [props.onSave]
 * @param {function} [props.onFulfill]
 * @param {function} [props.onDelete]
 * @param {function} [props.onViewDetails]
 * @param {function} [props.onHelp] primary CTA label override for home ("Respond")
 */
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
  onViewDetails,
  compactCta = false,
}) {
  const isOwn = user?.id && req.user_id === user.id
  const urgOpt = (URGENCY_OPTIONS || []).find(u => u.value === req.urgency)
  const budget = req.budget ? fmtMWK(req.budget) : 'Negotiable'
  const stayHere = req.city || null
  const lookingAreas = (req.cities?.length ? req.cities : []).filter(Boolean)
  const lookingLabel = lookingAreas.length
    ? (lookingAreas.length === 1 ? lookingAreas[0] : `${lookingAreas[0]} +${lookingAreas.length - 1}`)
    : (stayHere || 'Remote')
  const daysLeft = req.expires_at
    ? (() => {
        const ms = new Date(req.expires_at) - Date.now()
        if (ms <= 0) return null
        return Math.ceil(ms / 86400000)
      })()
    : null
  const showUrgency = !!(urgOpt && req.urgency !== 'flexible')
  const hasFlags = showUrgency || daysLeft != null
  const profile = Array.isArray(req.profiles) ? req.profiles[0] : req.profiles

  async function shareRequest(e) {
    e?.stopPropagation?.()
    e?.preventDefault?.()
    const url = `${window.location.origin}/looking-for?request=${req.id}`
    const text = `Looking for on SokoMw: ${req.title || 'Request'}${budget ? ` · ${budget}` : ''}`
    const isMobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '')
    try {
      if (isMobile && navigator.share) {
        await navigator.share({ title: req.title || 'Looking For', text, url })
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url)
      } else {
        window.prompt('Copy this link', url)
      }
    } catch { /* cancelled */ }
  }

  return (
    <article
      className={`lf-card${isNearYou ? ' is-near' : ''}${carousel ? ' is-carousel' : ''}`}
      onClick={() => onViewDetails?.(req)}
    >
      <div className="lf-card-media">
        {req.image_url
          ? <img src={req.image_url} alt="" className="lf-card-img" loading="lazy" />
          : (
            <div className="lf-card-media-empty">
              <CatIcon category={req.category} size={28} color={C.green} />
            </div>
          )}
        <div className="lf-card-media-top">
          <span className="lf-card-chip lf-card-chip-dark">
            <CatIcon category={req.category} size={11} color="#fff" />
            <span>{req.category || 'Request'}</span>
          </span>
          <div className="lf-card-media-actions" onClick={e => e.stopPropagation()}>
            <button type="button" className="lf-card-save" onClick={shareRequest} aria-label="Share" title="Share">
              {Icon.share(13, C.gray1)}
            </button>
            {onSave && (
              <button
                type="button"
                className={`lf-card-save${saved ? ' is-saved' : ''}`}
                onClick={e => { e.stopPropagation(); e.preventDefault(); onSave(req.id) }}
                onMouseDown={e => e.stopPropagation()}
                aria-label={saved ? 'Unsave' : 'Save'}
              >
                {Icon.bookmark(14, saved, saved ? C.red : C.gray1)}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="lf-card-body">
        <div className="lf-card-user">
          <div className="lf-card-user-left">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="" className="lf-card-avatar" />
              : (
                <div className="lf-card-avatar lf-card-avatar-fallback">
                  {(profile?.full_name || 'U')[0].toUpperCase()}
                </div>
              )}
            <span className="lf-card-name" title={profile?.full_name || 'User'}>
              {profile?.full_name || 'User'}
            </span>
            {profile?.is_verified === true && (
              <span className="lf-card-verified">{Icon.verified(13)}</span>
            )}
          </div>
          <span className="lf-card-time">{timeAgo(req.created_at)}</span>
        </div>

        <h3 className="lf-card-title" title={req.title || ''}>
          {req.title || 'Untitled request'}
        </h3>

        {/* Single combined near/distance chip — avoids stacked green pills on the photo */}
        <div className={`lf-card-dist-row${(isNearYou || req._distanceLabel) ? '' : ' is-empty'}`}>
          {(isNearYou || req._distanceLabel) && (
            <span
              className="lf-card-dist-chip"
              title={req._distanceApprox ? 'Estimated distance' : 'GPS distance'}
            >
              {Icon.nav(10, C.green)}
              {isNearYou && req._distanceLabel
                ? `Near you · ${req._distanceLabel}`
                : isNearYou
                  ? 'Near you'
                  : req._distanceLabel}
            </span>
          )}
        </div>

        <div className={`lf-card-flags${hasFlags ? '' : ' is-empty'}`}>
          {showUrgency && (
            <span className="lf-card-urg" style={{ color: urgOpt.color, background: urgOpt.bg }}>
              {urgOpt.label}
            </span>
          )}
          {daysLeft != null && (
            <span className="lf-card-urg lf-card-days">
              {Icon.clock(10, C.green)} {daysLeft}d left
            </span>
          )}
        </div>

        <div className="lf-card-meta">
          <div className="lf-card-budget" title={budget}>
            <span className="lf-card-budget-ico">{Icon.wallet(12, C.green)}</span>
            <span className="lf-card-budget-text">{budget}</span>
          </div>
          <div className="lf-card-loc" title={`Looking: ${lookingLabel}${stayHere ? ` · Stays: ${stayHere}` : ''}`}>
            <span className="lf-card-loc-ico">{Icon.pin(11, C.gray2)}</span>
            <span className="lf-card-loc-text">{lookingLabel}</span>
          </div>
        </div>

        <div className="lf-card-foot">
          <span className="lf-card-counts">
            <span className="lf-card-count-item">{Icon.users(11, C.gray2)} {req.offer_count || 0}</span>
            <span className="lf-card-dot">·</span>
            <span className="lf-card-count-item">{Icon.eye(11, C.gray2)} {req.view_count || 0}</span>
          </span>
          <div className="lf-card-actions" onClick={e => e.stopPropagation()}>
            {isOwn && onFulfill ? (
              <>
                <button type="button" className="lf-card-btn lf-card-btn-ghost" onClick={() => onFulfill(req.id)}>
                  {Icon.check(12)} Done
                </button>
                {onDelete && (
                  <button type="button" className="lf-card-btn lf-card-btn-danger" onClick={() => onDelete(req.id)}>
                    {Icon.trash(12, C.red)}
                  </button>
                )}
              </>
            ) : compactCta ? (
              <button
                type="button"
                className="lf-card-btn lf-card-btn-primary"
                onClick={() => (onOffer ? onOffer(req) : onViewDetails?.(req))}
              >
                <span className="lf-card-btn-ico">{Icon.send(12, '#fff')}</span>
                Respond
              </button>
            ) : (
              <>
                <button type="button" className="lf-card-btn lf-card-btn-ghost" onClick={() => onViewDetails?.(req)}>
                  Details
                </button>
                <button
                  type="button"
                  className={`lf-card-btn lf-card-btn-primary${req.user_has_offered ? ' is-done' : ''}`}
                  onClick={() => onOffer?.(req)}
                >
                  {req.user_has_offered ? (
                    <><span className="lf-card-btn-ico">{Icon.check(12, '#5f6368')}</span> Offered</>
                  ) : (
                    <><span className="lf-card-btn-ico">{Icon.send(12, '#fff')}</span> {req.category === 'Jobs' ? 'Apply' : 'Offer'}</>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
