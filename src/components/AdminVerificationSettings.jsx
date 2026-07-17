import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getVerificationSettings,
  getActiveVerificationTypes,
  getVerificationPaymentMethods,
  adminUpdateVerificationSettings,
  adminUpdateVerificationType,
  adminUpdatePaymentMethod,
  adminManualVerificationAction,
  getVerificationAnalytics,
  adminListVerificationProfiles,
  getVerificationAdminAudit,
  formatFee,
  resolveEffectiveFee,
  getUserFacingReviewEstimate,
  getValidityLabel,
  docTypeLabel,
  statusLabel,
  clearVerificationSettingsCache,
  friendlyVerificationError,
} from '../lib/verification'

const SECTIONS = [
  { id: 'general', label: 'General' },
  { id: 'fees', label: 'Fees' },
  { id: 'payments', label: 'Payment methods' },
  { id: 'documents', label: 'Documents' },
  { id: 'process', label: 'Process' },
  { id: 'validity', label: 'Validity' },
  { id: 'manual', label: 'Manual management' },
  { id: 'analytics', label: 'Analytics' },
]

const DOC_CATALOG = [
  'national_id', 'passport', 'drivers_license', 'selfie',
  'business_registration', 'proof_of_address', 'tax_document',
  'shop_license', 'other',
]

/**
 * Verification Settings module — lives inside existing Admin panel.
 */
export default function AdminVerificationSettings({ adminName = '', onToast }) {
  const [section, setSection] = useState('general')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [settings, setSettings] = useState(null)
  const [types, setTypes] = useState([])
  const [methods, setMethods] = useState([])
  const [analytics, setAnalytics] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [profileFilter, setProfileFilter] = useState('verified')
  const [audit, setAudit] = useState([])
  const [manualNote, setManualNote] = useState('')
  const [error, setError] = useState('')

  const toast = (msg) => onToast?.(msg)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      clearVerificationSettingsCache()
      const [s, t, m, a, prof, au] = await Promise.all([
        getVerificationSettings({ force: true }),
        getActiveVerificationTypes(),
        getVerificationPaymentMethods(),
        getVerificationAnalytics().catch(() => null),
        adminListVerificationProfiles(profileFilter).catch(() => []),
        getVerificationAdminAudit(40).catch(() => []),
      ])
      // Also load inactive types for admin editing
      let allTypes = t || []
      try {
        const { supabase } = await import('../lib/supabase')
        const { data } = await supabase.from('verification_types').select('*').order('sort_order')
        if (data?.length) allTypes = data
      } catch { /* keep active */ }

      let allMethods = m || []
      try {
        const { supabase } = await import('../lib/supabase')
        const { data } = await supabase.from('verification_payment_methods').select('*').order('sort_order')
        if (data?.length) allMethods = data
      } catch { /* keep */ }

      setSettings(s)
      setTypes(allTypes)
      setMethods(allMethods)
      setAnalytics(a)
      setProfiles(prof || [])
      setAudit(au || [])
    } catch (e) {
      setError(friendlyVerificationError(e) || 'Could not load settings')
    } finally {
      setLoading(false)
    }
  }, [profileFilter])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- load admin settings on mount/filter change
    void load()
  }, [load])

  const promo = settings?.extra?.promotion || {
    enabled: false,
    amount: '',
    start_date: '',
    end_date: '',
    by_type: {},
  }

  async function saveSettings(patch, successMsg = 'Settings saved') {
    setSaving(true)
    setError('')
    try {
      const updated = await adminUpdateVerificationSettings(patch)
      setSettings((prev) => ({ ...prev, ...updated }))
      toast(`✅ ${successMsg}`)
      await load()
    } catch (e) {
      setError(friendlyVerificationError(e) || e.message)
      toast(`❌ ${e.message || 'Save failed'}`)
    } finally {
      setSaving(false)
    }
  }

  async function saveType(code, patch) {
    setSaving(true)
    try {
      await adminUpdateVerificationType({
        code,
        name: patch.name,
        description: patch.description,
        defaultFeeAmount: patch.default_fee_amount,
        requiredDocumentTypes: patch.required_document_types,
        isActive: patch.is_active,
        sortOrder: patch.sort_order,
        meta: patch.meta,
      })
      toast('✅ Verification type updated')
      await load()
    } catch (e) {
      toast(`❌ ${e.message || 'Type update failed'}`)
    } finally {
      setSaving(false)
    }
  }

  async function saveMethod(code, patch) {
    setSaving(true)
    try {
      await adminUpdatePaymentMethod({
        code,
        isActive: patch.is_active,
        instructions: patch.instructions,
        name: patch.name,
        meta: patch.meta,
      })
      // Sync supported list from active methods
      const nextActive = methods
        .map((m) => (m.code === code ? { ...m, is_active: patch.is_active ?? m.is_active } : m))
        .filter((m) => m.is_active)
        .map((m) => m.code)
      await adminUpdateVerificationSettings({ supported_payment_methods: nextActive })
      toast('✅ Payment method updated')
      await load()
    } catch (e) {
      toast(`❌ ${e.message || 'Method update failed'}`)
    } finally {
      setSaving(false)
    }
  }

  async function runManual(action, sellerId, requestId = null) {
    if (!manualNote.trim() && ['remove_badge', 'suspend', 'reject', 'reverify'].includes(action)) {
      toast('❌ Note / reason is required for this action')
      return
    }
    if (!window.confirm(`Confirm action: ${action}?`)) return
    setSaving(true)
    try {
      await adminManualVerificationAction({
        action,
        sellerId,
        requestId,
        note: manualNote.trim() || `Action by ${adminName || 'admin'}`,
      })
      toast(`✅ ${action.replace(/_/g, ' ')} completed`)
      setManualNote('')
      await load()
    } catch (e) {
      toast(`❌ ${e.message || 'Action failed'}`)
    } finally {
      setSaving(false)
    }
  }

  const estimatePreview = useMemo(() => getUserFacingReviewEstimate(settings), [settings])
  const validityPreview = useMemo(() => getValidityLabel(settings), [settings])

  if (loading && !settings) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
        Loading verification settings…
      </div>
    )
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ marginBottom: 16 }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: '#0f1410' }}>Verification Settings</h2>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6b7280' }}>
          Control fees, requirements, payment methods, validity, and manual verification — without editing the database.
        </p>
      </div>

      {error && (
        <div style={{
          background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c',
          borderRadius: 12, padding: '10px 12px', marginBottom: 12, fontSize: 13,
        }}>
          {error}
        </div>
      )}

      {/* Section nav */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setSection(s.id)}
            style={{
              padding: '7px 14px', borderRadius: 20, border: 'none', cursor: 'pointer',
              fontSize: 12, fontWeight: 700,
              background: section === s.id ? '#1a7a4a' : '#f0f5f2',
              color: section === s.id ? '#fff' : '#555',
              fontFamily: 'inherit',
            }}
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          onClick={load}
          disabled={saving}
          style={{
            marginLeft: 'auto', padding: '7px 14px', borderRadius: 20, border: 'none',
            cursor: 'pointer', fontSize: 12, fontWeight: 700, background: '#e6f4ec', color: '#1a7a4a',
            fontFamily: 'inherit',
          }}
        >
          Refresh
        </button>
      </div>

      {/* GENERAL */}
      {section === 'general' && (
        <Card title="General settings">
          <Row label="Verification system">
            <Toggle
              on={settings?.is_enabled !== false}
              label={settings?.is_enabled !== false ? 'Enabled' : 'Disabled'}
              disabled={saving}
              onChange={(on) => saveSettings({ is_enabled: on }, on ? 'Verification enabled' : 'Verification disabled')}
            />
          </Row>
          <p style={hint}>
            When disabled, sellers see: &quot;Verification services are temporarily unavailable.&quot;
            and cannot start Get Verified.
          </p>
          <Row label="Require documents">
            <Toggle
              on={settings?.require_documents !== false}
              label={settings?.require_documents !== false ? 'Required' : 'Optional'}
              disabled={saving}
              onChange={(on) => saveSettings({ require_documents: on })}
            />
          </Row>
          <Row label="Auto under-review after payment">
            <Toggle
              on={settings?.auto_submit_on_payment !== false}
              label={settings?.auto_submit_on_payment !== false ? 'On' : 'Off'}
              disabled={saving}
              onChange={(on) => saveSettings({ auto_submit_on_payment: on })}
            />
          </Row>
          <Row label="Default type code">
            <input
              style={input}
              defaultValue={settings?.default_verification_type_code || 'seller'}
              onBlur={(e) => {
                if (e.target.value !== settings?.default_verification_type_code) {
                  saveSettings({ default_verification_type_code: e.target.value.trim() || 'seller' })
                }
              }}
            />
          </Row>
        </Card>
      )}

      {/* FEES */}
      {section === 'fees' && (
        <>
          <Card title="Default fee (fallback)">
            <Row label="Default amount (MWK)">
              <input
                type="number"
                style={input}
                defaultValue={settings?.fee_amount ?? 5000}
                onBlur={(e) => {
                  const n = Number(e.target.value)
                  if (!Number.isNaN(n) && n !== Number(settings?.fee_amount)) {
                    saveSettings({ fee_amount: n })
                  }
                }}
              />
            </Row>
            <p style={hint}>Used when a type has no specific fee. Seller-facing amounts prefer type fees.</p>
          </Card>

          <Card title="Fees by verification type">
            {types.map((t) => (
              <div key={t.code} style={subCard}>
                <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 8 }}>
                  {t.name} <span style={{ color: '#9ca3af', fontWeight: 600 }}>({t.code})</span>
                </div>
                <Row label="Fee (MWK)">
                  <input
                    type="number"
                    style={input}
                    defaultValue={t.default_fee_amount ?? settings?.fee_amount ?? 5000}
                    onBlur={(e) => {
                      const n = Number(e.target.value)
                      if (!Number.isNaN(n) && n !== Number(t.default_fee_amount)) {
                        saveType(t.code, { default_fee_amount: n })
                      }
                    }}
                  />
                </Row>
                <p style={{ ...hint, margin: 0 }}>
                  Effective now: {formatFee(settings, resolveEffectiveFee(t, settings))}
                </p>
              </div>
            ))}
          </Card>

          <Card title="Promotional pricing (optional)">
            <Row label="Promotion active">
              <Toggle
                on={!!promo.enabled}
                label={promo.enabled ? 'On' : 'Off'}
                disabled={saving}
                onChange={(on) => saveSettings({
                  extra: {
                    ...(settings?.extra || {}),
                    promotion: { ...promo, enabled: on },
                  },
                })}
              />
            </Row>
            <Row label="Promo amount (MWK)">
              <input
                type="number"
                style={input}
                defaultValue={promo.amount ?? ''}
                placeholder="e.g. 2500"
                onBlur={(e) => {
                  const val = e.target.value === '' ? null : Number(e.target.value)
                  saveSettings({
                    extra: {
                      ...(settings?.extra || {}),
                      promotion: { ...promo, amount: val },
                    },
                  })
                }}
              />
            </Row>
            <Row label="Start date">
              <input
                type="date"
                style={input}
                defaultValue={(promo.start_date || '').slice(0, 10)}
                onBlur={(e) => saveSettings({
                  extra: {
                    ...(settings?.extra || {}),
                    promotion: { ...promo, start_date: e.target.value || null },
                  },
                })}
              />
            </Row>
            <Row label="End date">
              <input
                type="date"
                style={input}
                defaultValue={(promo.end_date || '').slice(0, 10)}
                onBlur={(e) => saveSettings({
                  extra: {
                    ...(settings?.extra || {}),
                    promotion: { ...promo, end_date: e.target.value || null },
                  },
                })}
              />
            </Row>
            <p style={hint}>Optional per-type promo amounts can be set under type meta later; global promo amount applies when active.</p>
          </Card>
        </>
      )}

      {/* PAYMENT METHODS */}
      {section === 'payments' && (
        <Card title="Payment methods">
          <p style={hint}>Enable/disable rails and set pay-to numbers or bank details (shown in method instructions).</p>
          {methods.map((m) => (
            <div key={m.code} style={subCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                <strong style={{ fontSize: 13 }}>{m.name || docTypeLabel(m.code)}</strong>
                <Toggle
                  on={m.is_active !== false}
                  label={m.is_active !== false ? 'Enabled' : 'Disabled'}
                  disabled={saving}
                  onChange={(on) => saveMethod(m.code, { is_active: on })}
                />
              </div>
              <Row label="Instructions / pay details">
                <textarea
                  style={{ ...input, minHeight: 72, resize: 'vertical' }}
                  defaultValue={m.instructions || ''}
                  placeholder={
                    m.code === 'airtel_money' ? 'Airtel number: 099… · Account name…'
                      : m.code === 'tnm_mpamba' ? 'Mpamba number: 088… · Account name…'
                        : m.code === 'bank_transfer' ? 'Bank: … · Account: … · Name: …'
                          : 'Instructions for sellers'
                  }
                  onBlur={(e) => {
                    if (e.target.value !== (m.instructions || '')) {
                      saveMethod(m.code, { instructions: e.target.value })
                    }
                  }}
                />
              </Row>
              {(m.code === 'airtel_money' || m.code === 'tnm_mpamba' || m.code === 'bank_transfer') && (
                <Row label="Pay-to number / account (meta)">
                  <input
                    style={input}
                    defaultValue={m.meta?.account_number || m.meta?.phone || ''}
                    placeholder="Stored in method meta"
                    onBlur={(e) => {
                      const v = e.target.value.trim()
                      if (v !== (m.meta?.account_number || m.meta?.phone || '')) {
                        saveMethod(m.code, {
                          meta: {
                            ...(m.meta || {}),
                            account_number: v,
                            phone: v,
                          },
                        })
                      }
                    }}
                  />
                </Row>
              )}
            </div>
          ))}
        </Card>
      )}

      {/* DOCUMENTS */}
      {section === 'documents' && (
        <Card title="Document requirements by type">
          <p style={hint}>Add or remove required document codes per verification type. Sellers see this list before and during verification.</p>
          {types.map((t) => {
            const required = Array.isArray(t.required_document_types) ? t.required_document_types : []
            return (
              <div key={t.code} style={subCard}>
                <strong style={{ fontSize: 13 }}>{t.name}</strong>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                  {DOC_CATALOG.map((doc) => {
                    const on = required.includes(doc)
                    return (
                      <button
                        key={doc}
                        type="button"
                        disabled={saving}
                        onClick={() => {
                          const next = on
                            ? required.filter((d) => d !== doc)
                            : [...required, doc]
                          saveType(t.code, { required_document_types: next })
                        }}
                        style={{
                          padding: '6px 10px', borderRadius: 999, border: 'none', cursor: 'pointer',
                          fontSize: 11, fontWeight: 700,
                          background: on ? '#e6f4ec' : '#f3f4f6',
                          color: on ? '#1a7a4a' : '#6b7280',
                          fontFamily: 'inherit',
                        }}
                      >
                        {on ? '✓ ' : '+ '}{docTypeLabel(doc)}
                      </button>
                    )
                  })}
                </div>
                <p style={{ ...hint, marginTop: 8 }}>
                  Required: {required.length ? required.map(docTypeLabel).join(', ') : 'None'}
                </p>
              </div>
            )
          })}
        </Card>
      )}

      {/* PROCESS */}
      {section === 'process' && (
        <Card title="Verification process">
          <Row label="Typical review (hours)">
            <select
              style={input}
              value={settings?.review_period_hours ?? 24}
              onChange={(e) => saveSettings({ review_period_hours: Number(e.target.value) })}
            >
              {[24, 48, 72, 168].map((h) => (
                <option key={h} value={h}>
                  {h === 24 ? '24 hours' : h === 48 ? '48 hours' : h === 72 ? '3 days' : '7 days'}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Maximum review (hours)">
            <input
              type="number"
              style={input}
              defaultValue={settings?.extra?.max_review_hours ?? 72}
              onBlur={(e) => saveSettings({
                extra: {
                  ...(settings?.extra || {}),
                  max_review_hours: Number(e.target.value) || 72,
                },
              })}
            />
          </Row>
          <Row label="User-facing estimate text">
            <textarea
              style={{ ...input, minHeight: 64, resize: 'vertical' }}
              defaultValue={settings?.extra?.user_facing_estimate || estimatePreview}
              onBlur={(e) => saveSettings({
                extra: {
                  ...(settings?.extra || {}),
                  user_facing_estimate: e.target.value.trim(),
                },
              })}
            />
          </Row>
          <Row label="Additional-info deadline (days)">
            <input
              type="number"
              style={input}
              defaultValue={settings?.additional_info_deadline_days ?? 7}
              onBlur={(e) => {
                const n = Number(e.target.value)
                if (!Number.isNaN(n)) saveSettings({ additional_info_deadline_days: n })
              }}
            />
          </Row>
          <div style={{ ...subCard, background: '#f0faf4' }}>
            <strong style={{ fontSize: 12, color: '#1a7a4a' }}>Seller preview</strong>
            <p style={{ margin: '6px 0 0', fontSize: 13 }}>{estimatePreview}</p>
          </div>
        </Card>
      )}

      {/* VALIDITY */}
      {section === 'validity' && (
        <Card title="Verification validity">
          <Row label="Validity period">
            <select
              style={input}
              value={
                settings?.verification_validity_days == null || settings?.verification_validity_days === ''
                  ? 'never'
                  : String(settings.verification_validity_days)
              }
              onChange={(e) => {
                const v = e.target.value
                saveSettings({
                  verification_validity_days: v === 'never' ? null : Number(v),
                })
              }}
            >
              <option value="never">Never expires</option>
              <option value="365">1 year</option>
              <option value="730">2 years</option>
              <option value="1095">3 years</option>
            </select>
          </Row>
          <Row label="Require re-verification on expiry">
            <Toggle
              on={!!settings?.extra?.require_reverification_on_expiry}
              label={settings?.extra?.require_reverification_on_expiry ? 'Yes' : 'No'}
              disabled={saving}
              onChange={(on) => saveSettings({
                extra: {
                  ...(settings?.extra || {}),
                  require_reverification_on_expiry: on,
                },
              })}
            />
          </Row>
          <div style={{ ...subCard, background: '#f0faf4' }}>
            <strong style={{ fontSize: 12, color: '#1a7a4a' }}>Seller preview</strong>
            <p style={{ margin: '6px 0 0', fontSize: 13 }}>Verification validity: {validityPreview}</p>
          </div>
        </Card>
      )}

      {/* MANUAL */}
      {section === 'manual' && (
        <>
          <Card title="Manual verification management">
            <Row label="Internal note / reason (required for remove/reject)">
              <textarea
                style={{ ...input, minHeight: 64, resize: 'vertical' }}
                value={manualNote}
                onChange={(e) => setManualNote(e.target.value)}
                placeholder="e.g. Fraud / fake documents / user requested removal / account violation"
              />
            </Row>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              {['verified', 'rejected', 'all'].map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setProfileFilter(f)}
                  style={{
                    padding: '5px 12px', borderRadius: 20, border: 'none', cursor: 'pointer',
                    fontSize: 11, fontWeight: 700,
                    background: profileFilter === f ? '#1a7a4a' : '#f0f5f2',
                    color: profileFilter === f ? '#fff' : '#555',
                    fontFamily: 'inherit',
                  }}
                >
                  {f}
                </button>
              ))}
            </div>
            {profiles.length === 0 && (
              <p style={{ color: '#9ca3af', fontSize: 13 }}>No profiles for this filter.</p>
            )}
            {profiles.map((p) => (
              <div key={p.id} style={{ ...subCard, display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 160 }}>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{p.full_name || 'Unknown'}</div>
                  <div style={{ fontSize: 11, color: '#6b7280' }}>
                    {p.city || '—'} · {p.is_verified ? 'Verified' : statusLabel(p.verification_status || 'none')}
                    {p.verified_at ? ` · ${new Date(p.verified_at).toLocaleDateString()}` : ''}
                  </div>
                  {p.rejection_reason && (
                    <div style={{ fontSize: 11, color: '#dc2626', marginTop: 2 }}>{p.rejection_reason}</div>
                  )}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  <ActionBtn onClick={() => runManual('approve', p.id)} bg="#e6f4ec" color="#1a7a4a">Approve</ActionBtn>
                  <ActionBtn onClick={() => runManual('reject', p.id)} bg="#fee2e2" color="#dc2626">Reject</ActionBtn>
                  <ActionBtn onClick={() => runManual('remove_badge', p.id)} bg="#ffedd5" color="#c2410c">Remove badge</ActionBtn>
                  <ActionBtn onClick={() => runManual('suspend', p.id)} bg="#f3f4f6" color="#555">Suspend</ActionBtn>
                  <ActionBtn onClick={() => runManual('reverify', p.id)} bg="#dbeafe" color="#1d4ed8">Re-verify</ActionBtn>
                  <ActionBtn onClick={() => runManual('reactivate', p.id)} bg="#e6f4ec" color="#1a7a4a">Reactivate</ActionBtn>
                </div>
              </div>
            ))}
          </Card>

          <Card title="Recent admin audit log">
            {audit.length === 0 && <p style={{ color: '#9ca3af', fontSize: 13 }}>No audit entries yet (apply migration).</p>}
            {audit.map((a) => (
              <div key={a.id} style={{ padding: '8px 0', borderBottom: '1px solid #f0f5f2', fontSize: 12 }}>
                <strong>{a.action}</strong>
                <span style={{ color: '#6b7280' }}> · {a.entity_type} {a.entity_id || ''}</span>
                <div style={{ color: '#555' }}>{a.note}</div>
                <div style={{ color: '#9ca3af' }}>{a.created_at ? new Date(a.created_at).toLocaleString() : ''}</div>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* ANALYTICS */}
      {section === 'analytics' && (
        <Card title="Verification analytics">
          {!analytics && <p style={{ color: '#9ca3af', fontSize: 13 }}>Analytics unavailable — apply admin settings migration.</p>}
          {analytics && (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 12,
            }}>
              {[
                ['Total requests', analytics.total_requests],
                ['Approved', analytics.approved],
                ['Rejected', analytics.rejected],
                ['Pending', analytics.pending],
                ['Under review', analytics.under_review],
                ['Need info', analytics.additional_info],
                ['Expired', analytics.expired],
                ['Draft', analytics.draft],
                ['Verified profiles', analytics.verified_profiles],
                ['Today', analytics.today_requests],
                ['This month', analytics.month_requests],
                ['Approval rate', `${analytics.approval_rate ?? 0}%`],
                ['Revenue (MWK)', Number(analytics.total_revenue || 0).toLocaleString()],
                ['Manually removed', analytics.manually_removed],
              ].map(([label, val]) => (
                <div key={label} style={{
                  background: '#f9fbfa', border: '1px solid #e8f0ec', borderRadius: 12, padding: 12,
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', textTransform: 'uppercase' }}>{label}</div>
                  <div style={{ fontSize: 20, fontWeight: 900, color: '#0f1410', marginTop: 4 }}>{val ?? 0}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {saving && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: '#0f1f16', color: '#5de89e', padding: '10px 16px', borderRadius: 999, fontSize: 12, fontWeight: 700 }}>
          Saving…
        </div>
      )}
    </div>
  )
}

function Card({ title, children }) {
  return (
    <div style={{
      background: '#fff', borderRadius: 16, border: '1px solid #e8f0ec',
      padding: 16, marginBottom: 14,
    }}>
      <h3 style={{
        margin: '0 0 14px', fontSize: 12, fontWeight: 800, textTransform: 'uppercase',
        letterSpacing: 0.6, color: '#555',
      }}>
        {title}
      </h3>
      {children}
    </div>
  )
}

function Row({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#637068', marginBottom: 6 }}>{label}</div>
      {children}
    </div>
  )
}

function Toggle({ on, label, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange?.(!on)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        border: 'none', background: 'transparent', cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit', padding: 0,
      }}
    >
      <span style={{
        width: 44, height: 26, borderRadius: 999,
        background: on ? '#1a7a4a' : '#d1d5db',
        position: 'relative', transition: 'background .15s',
      }}>
        <span style={{
          position: 'absolute', top: 3, left: on ? 22 : 3,
          width: 20, height: 20, borderRadius: '50%', background: '#fff',
          transition: 'left .15s', boxShadow: '0 1px 3px rgba(0,0,0,.2)',
        }} />
      </span>
      <span style={{ fontSize: 13, fontWeight: 700, color: on ? '#1a7a4a' : '#6b7280' }}>{label}</span>
    </button>
  )
}

function ActionBtn({ children, onClick, bg, color }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '5px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
        fontSize: 11, fontWeight: 700, background: bg, color, fontFamily: 'inherit',
      }}
    >
      {children}
    </button>
  )
}

const input = {
  width: '100%',
  boxSizing: 'border-box',
  border: '1.5px solid #e0e8e2',
  borderRadius: 10,
  padding: '9px 12px',
  fontSize: 13,
  fontFamily: 'inherit',
  background: '#fff',
}

const hint = { fontSize: 12, color: '#9ca3af', margin: '0 0 12px', lineHeight: 1.45 }

const subCard = {
  background: '#f9fbfa',
  border: '1px solid #e8f0ec',
  borderRadius: 12,
  padding: 12,
  marginBottom: 10,
}
