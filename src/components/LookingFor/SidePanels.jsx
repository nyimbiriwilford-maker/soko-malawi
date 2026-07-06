import { T } from '../../constants/tokens'
import { CAT_EMOJI } from '../../constants/lookingFor'
import { Icon } from './Icons'
import { SectionLabel } from './Primitives'

/**
 * TrendingDemand — shows top categories by request count.
 */
export function TrendingDemand({ trendingDemand, onCategoryClick }) {
  if (!trendingDemand?.length) return null
  return (
    <div className="lf-card" style={{ padding: 20, marginTop: 24 }}>
      <SectionLabel label="Trending Demand" sub="Most requested categories right now" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {trendingDemand.map(([cat, count], i) => (
          <div
            key={cat}
            onClick={() => onCategoryClick(cat)}
            style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer', padding: '8px 0', borderBottom: i < trendingDemand.length - 1 ? `1px solid ${T.gray100}` : 'none' }}
          >
            <div style={{ width: 32, height: 32, borderRadius: 10, background: T.gray100, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, flexShrink: 0 }}>
              {CAT_EMOJI[cat] || '📦'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.gray900 }}>{cat}</div>
              <div style={{ fontSize: 11, color: T.gray600 }}>{count} active requests</div>
            </div>
            <div style={{ width: 64, height: 5, borderRadius: 50, background: T.gray100, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, (count / (trendingDemand[0][1] || 1)) * 100)}%`, background: `linear-gradient(90deg,${T.green},${T.greenD})`, borderRadius: 50, transition: 'width 0.8s ease' }} />
            </div>
            <div style={{ fontSize: 11, fontWeight: 700, color: T.green, minWidth: 24, textAlign: 'right' }}>{count}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * RecentlyFulfilled — shows last 5 fulfilled requests.
 */
export function RecentlyFulfilled({ fulfilledReqs }) {
  if (!fulfilledReqs?.length) return null
  return (
    <div className="lf-card" style={{ padding: 20, marginTop: 16, marginBottom: 24 }}>
      <SectionLabel label="Recently Fulfilled" sub="Successful transactions on SokoMW" />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
        {fulfilledReqs.map(r => (
          <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 12px', background: T.greenL, borderRadius: 12, border: '1px solid #d1fae5' }}>
            <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.green, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: '#fff', flexShrink: 0 }}>✓</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: T.gray900, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
              <div style={{ fontSize: 11, color: T.gray600 }}>{r.profiles?.full_name || 'Buyer'} · {r.category}</div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: T.green, background: '#d1fae5', borderRadius: 50, padding: '2px 9px', flexShrink: 0 }}>FULFILLED</div>
          </div>
        ))}
      </div>
    </div>
  )
}