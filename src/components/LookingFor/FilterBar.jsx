import { T } from '../../constants/tokens'
import { CATEGORIES, SORT_OPTIONS } from '../../constants/lookingFor'

const TABS = [
  { id: 'all',    label: 'All' },
  { id: 'saved',  label: 'Saved' },
  { id: 'alerts', label: 'Alerts' },
]

export default function FilterBar({
  category, onCategory, sortBy, onSort,
  allCategories = new Set(),
  activeTab, counts = {}, onTab,
}) {
  const visibleCats = CATEGORIES.filter(c => c === 'All' || allCategories.has(c))

  return (
    <div style={{ marginBottom: 20, background: T.white, borderRadius: 18, border: `1px solid ${T.gray100}`, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>

      {/* ── Row 1: Tabs + Sort ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px', borderBottom: `1px solid ${T.gray100}` }}>

        {/* View tabs */}
        <div style={{ display: 'flex', gap: 4, background: T.gray100, borderRadius: 12, padding: 4 }}>
          {TABS.map(t => {
            const active = activeTab === t.id
            return (
              <button
                key={t.id}
                onClick={() => onTab(t.id)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 5,
                  padding: '6px 14px', borderRadius: 9,
                  border: 'none',
                  background: active ? T.white : 'transparent',
                  color: active ? T.gray900 : T.gray500,
                  fontSize: 12.5, fontWeight: active ? 700 : 500,
                  cursor: 'pointer',
                  boxShadow: active ? '0 1px 4px rgba(0,0,0,0.10)' : 'none',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
                {counts[t.id] > 0 && (
                  <span style={{
                    background: active ? T.green : T.gray200,
                    color: active ? '#fff' : T.gray600,
                    borderRadius: 50, padding: '1px 6px',
                    fontSize: 10, fontWeight: 800,
                  }}>
                    {counts[t.id]}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {/* Sort pills */}
        <div style={{ display: 'flex', gap: 5, alignItems: 'center' }}>
          <span style={{ fontSize: 10.5, color: T.gray400, fontWeight: 600, letterSpacing: '0.4px', textTransform: 'uppercase', marginRight: 2 }}>Sort</span>
          {SORT_OPTIONS.map(({ k, l }) => {
            const active = sortBy === k
            return (
              <button
                key={k}
                onClick={() => onSort(k)}
                style={{
                  padding: '5px 11px', borderRadius: 50,
                  border: `1.5px solid ${active ? T.green : T.gray200}`,
                  background: active ? T.green : 'transparent',
                  color: active ? '#fff' : T.gray600,
                  fontSize: 11, fontWeight: active ? 700 : 500,
                  cursor: 'pointer', transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {l}
              </button>
            )
          })}
        </div>
      </div>

      {/* ── Row 2: Category pills ── */}
      <div className="lf-scroll" style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '10px 16px' }}>
        {visibleCats.map(c => {
          const active = category === c
          return (
            <button
              key={c}
              onClick={() => onCategory(c)}
              style={{
                padding: '6px 16px', borderRadius: 50,
                border: `1.5px solid ${active ? T.green : T.gray200}`,
                background: active ? T.green : 'transparent',
                color: active ? '#fff' : T.gray700,
                fontSize: 12.5, fontWeight: active ? 700 : 500,
                cursor: 'pointer', transition: 'all 0.15s',
                whiteSpace: 'nowrap', flexShrink: 0,
                boxShadow: active ? '0 2px 8px rgba(15,157,88,0.22)' : 'none',
              }}
            >
              {c}
            </button>
          )
        })}
      </div>
    </div>
  )
}