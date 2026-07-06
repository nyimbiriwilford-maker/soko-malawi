import { T } from '../../constants/tokens'
import { CATEGORIES, CAT_EMOJI } from '../../constants/lookingFor'
import { Icon } from './Icons'

/**
 * WantedAlerts — full panel for creating and managing seller Wanted Alerts.
 *
 * Props:
 *   alertForm        { category, cities, minBudget, maxBudget, notifyEmail, notifyPush }
 *   onAlertForm      (patch) => void
 *   alertCityInput   string
 *   onAlertCityInput (val) => void
 *   savingAlert      bool
 *   onSaveAlert      () => void
 *   myAlerts         Alert[]
 *   onDeleteAlert    (id) => void
 */
export default function WantedAlerts({
  alertForm,
  onAlertForm,
  alertCityInput,
  onAlertCityInput,
  savingAlert,
  onSaveAlert,
  myAlerts,
  onDeleteAlert,
}) {
  return (
    <div style={{ animation: 'fadeUp 0.3s ease both' }}>

      {/* ── Hero banner ── */}
      <div style={{ borderRadius: 20, padding: '24px', marginBottom: 20, background: `linear-gradient(135deg, ${T.gray900} 0%, #1a2535 100%)`, border: '1px solid rgba(255,255,255,0.07)', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: '60%', background: `radial-gradient(ellipse at 80% 50%, rgba(15,157,88,0.18) 0%, transparent 70%)`, pointerEvents: 'none' }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{ width: 42, height: 42, borderRadius: 14, background: 'rgba(249,171,0,0.15)', border: '1px solid rgba(249,171,0,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>🔔</div>
            <div>
              <div style={{ fontFamily: T.fontDisplay, fontSize: 17, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>Wanted Alerts</div>
              <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', marginTop: 1 }}>Get notified the moment a matching buyer posts a request</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {[
              { icon: '⚡', text: 'Instant notifications' },
              { icon: '🎯', text: 'Category & budget filters' },
              { icon: '📍', text: 'City-specific alerts' },
            ].map(({ icon, text }) => (
              <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>
                <span>{icon}</span>{text}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Create new alert ── */}
      <div className="lf-card" style={{ padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 18 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: T.green, animation: 'pulse 2s infinite' }} />
          <span style={{ fontFamily: T.fontDisplay, fontSize: 15, fontWeight: 800, color: T.gray900 }}>Create New Alert</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Category */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.gray600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Category *</label>
            <div style={{ position: 'relative' }}>
              <select className="lf-select" value={alertForm.category} onChange={e => onAlertForm({ category: e.target.value })}>
                {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
              </select>
              <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.gray400 }}>
                {Icon.chevD(12)}
              </span>
            </div>
          </div>

          {/* Cities */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.gray600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Cities (optional)</label>
            <input
              className="lf-input"
              placeholder="Add city, press Enter…"
              value={alertCityInput}
              onChange={e => onAlertCityInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && alertCityInput.trim()) {
                  onAlertForm({ cities: [...new Set([...alertForm.cities, alertCityInput.trim()])] })
                  onAlertCityInput('')
                }
              }}
            />
            {alertForm.cities.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                {alertForm.cities.map(c => (
                  <div key={c} style={{ display: 'flex', alignItems: 'center', gap: 4, background: T.gray900, color: '#fff', borderRadius: 50, padding: '3px 10px', fontSize: 12, fontWeight: 600 }}>
                    {c}
                    <button onClick={() => onAlertForm({ cities: alertForm.cities.filter(x => x !== c) })} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 0 }}>
                      {Icon.x(11)}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Min budget */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.gray600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Min Budget (MK)</label>
            <input className="lf-input" type="number" placeholder="e.g. 50,000" value={alertForm.minBudget} onChange={e => onAlertForm({ minBudget: e.target.value })} />
          </div>

          {/* Max budget */}
          <div>
            <label style={{ fontSize: 11, fontWeight: 700, color: T.gray600, textTransform: 'uppercase', letterSpacing: 0.5, display: 'block', marginBottom: 5 }}>Max Budget (MK)</label>
            <input className="lf-input" type="number" placeholder="e.g. 500,000" value={alertForm.maxBudget} onChange={e => onAlertForm({ maxBudget: e.target.value })} />
          </div>
        </div>

        {/* Notification prefs */}
        <div style={{ display: 'flex', gap: 14, margin: '14px 0', flexWrap: 'wrap' }}>
          {[
            { key: 'notifyPush',  label: 'In-app notification', icon: '📱' },
            { key: 'notifyEmail', label: 'Email notification',   icon: '📧' },
          ].map(({ key, label, icon }) => (
            <label key={key} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, fontWeight: 600, color: T.gray800 }}>
              <div
                onClick={() => onAlertForm({ [key]: !alertForm[key] })}
                style={{ width: 38, height: 22, borderRadius: 50, background: alertForm[key] ? T.green : T.gray200, position: 'relative', cursor: 'pointer', transition: 'background 0.2s', flexShrink: 0 }}
              >
                <div style={{ position: 'absolute', top: 3, left: alertForm[key] ? 18 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' }} />
              </div>
              {icon} {label}
            </label>
          ))}
        </div>

        <button onClick={onSaveAlert} disabled={savingAlert} className="lf-btn-primary" style={{ width: '100%', padding: '12px', fontSize: 14, borderRadius: 12 }}>
          {savingAlert ? 'Saving…' : `${Icon.bell(14)} Create Alert for ${alertForm.category}`}
        </button>
      </div>

      {/* ── Active alerts list ── */}
      {myAlerts.length > 0 && (
        <div>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 14, fontWeight: 800, color: T.gray900, marginBottom: 12 }}>
            Your Active Alerts ({myAlerts.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myAlerts.map(alert => (
              <div key={alert.id} className="lf-card" style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: 14, background: T.greenL, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                  {CAT_EMOJI[alert.category] || '🔔'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: T.gray900, marginBottom: 3 }}>{alert.category}</div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 11.5, color: T.gray600 }}>
                    {alert.cities?.length > 0 && <span>{Icon.pin(11)} {alert.cities.slice(0, 2).join(', ')}{alert.cities.length > 2 ? ` +${alert.cities.length - 2}` : ''}</span>}
                    {alert.min_budget && <span>Min: MK {alert.min_budget.toLocaleString()}</span>}
                    {alert.max_budget && <span>Max: MK {alert.max_budget.toLocaleString()}</span>}
                    {!alert.min_budget && !alert.max_budget && !alert.cities?.length && <span>Any budget · Nationwide</span>}
                  </div>
                  <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                    {alert.notify_push  && <span style={{ fontSize: 10, fontWeight: 700, color: T.green, background: T.greenL, borderRadius: 50, padding: '2px 8px' }}>📱 In-app</span>}
                    {alert.notify_email && <span style={{ fontSize: 10, fontWeight: 700, color: T.blue, background: T.blueL, borderRadius: 50, padding: '2px 8px' }}>📧 Email</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: T.green, animation: 'pulse 2s infinite', marginTop: 2, alignSelf: 'flex-start' }} />
                  <button
                    onClick={() => onDeleteAlert(alert.id)}
                    style={{ width: 34, height: 34, borderRadius: 10, background: '#fef2f2', border: '1px solid #fecaca', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: T.red }}
                  >
                    {Icon.trash(14)}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {myAlerts.length === 0 && (
        <div style={{ textAlign: 'center', padding: '36px 24px', background: T.white, borderRadius: 20, border: `1px dashed ${T.gray200}` }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🔔</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.gray900, marginBottom: 5 }}>No alerts yet</div>
          <div style={{ fontSize: 13, color: T.gray600 }}>Create your first alert above and never miss a matching buyer.</div>
        </div>
      )}
    </div>
  )
}