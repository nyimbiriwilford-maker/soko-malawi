import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  getVerificationAnomalies,
  adminScanAnomalies,
  adminUpdateAnomaly,
  stageOfStatus,
} from '../lib/verification'

const SEVERITY_STYLES = {
  info: { bg: '#eff6ff', color: '#1d4ed8', border: '#bfdbfe' },
  warning: { bg: '#fef3c7', color: '#b45309', border: '#fde68a' },
  error: { bg: '#fee2e2', color: '#dc2626', border: '#fecaca' },
  critical: { bg: '#fce7f3', color: '#be185d', border: '#fbcfe8' },
}

const STATUS_FILTERS = ['open', 'acked', 'resolved', 'ignored', 'all']
const SEVERITY_FILTERS = ['all', 'critical', 'error', 'warning', 'info']
const SOURCE_FILTERS = ['all', 'client', 'edge', 'db']

/**
 * Developer-review tab for verification anomalies.
 * Filters, expandable context JSON, Take/Resolve/Ignore, Run scan, CSV export.
 */
export default function AdminVerificationAnomalies({ onOpenRequest }) {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [statusFilter, setStatusFilter] = useState('open')
  const [severityFilter, setSeverityFilter] = useState('all')
  const [sourceFilter, setSourceFilter] = useState('all')
  const [expanded, setExpanded] = useState(null)
  const [busy, setBusy] = useState(null)
  const [scanMsg, setScanMsg] = useState('')

  const load = useCallback(async (status = statusFilter) => {
    setLoading(true)
    setError('')
    try {
      const list = await getVerificationAnomalies({ status, limit: 300 })
      setRows(list)
    } catch (e) {
      setError(e?.message || 'Could not load anomalies')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    void load(statusFilter)
  }, [load, statusFilter])

  const filtered = useMemo(() => rows.filter((r) => {
    if (severityFilter !== 'all' && r.severity !== severityFilter) return false
    if (sourceFilter !== 'all' && r.source !== sourceFilter) return false
    return true
  }), [rows, severityFilter, sourceFilter])

  async function act(row, nextStatus, note = null) {
    setBusy(row.id)
    try {
      await adminUpdateAnomaly(row.id, nextStatus, note)
      setRows((rs) => rs.map((r) => (r.id === row.id
        ? { ...r, status: nextStatus, resolved_at: nextStatus === 'open' ? null : new Date().toISOString() }
        : r)))
      setScanMsg(nextStatus === 'acked' ? 'Taken for review.' : `Marked ${nextStatus}.`)
    } catch (e) {
      setScanMsg(e?.message || 'Action failed')
    } finally {
      setBusy(null)
    }
  }

  async function runScan() {
    setBusy('scan')
    setScanMsg('')
    try {
      const n = await adminScanAnomalies()
      setScanMsg(`Scan complete — ${n} new anomaly row${n === 1 ? '' : 's'} created.`)
      await load(statusFilter)
    } catch (e) {
      setScanMsg(e?.message || 'Scan failed. Ensure the anomalies migration is applied.')
    } finally {
      setBusy(null)
    }
  }

  function exportCsv() {
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const header = ['id', 'created_at', 'source', 'severity', 'status', 'category', 'message', 'request_id', 'seller_id']
    const lines = [header.join(',')]
    filtered.forEach((r) => {
      lines.push([
        esc(r.id), esc(r.created_at), esc(r.source), esc(r.severity), esc(r.status),
        esc(r.category), esc(r.message), esc(r.request_id || ''), esc(r.seller_id || ''),
      ].join(','))
    })
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `verification-anomalies-${statusFilter}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.toolbar}>
        <div style={styles.filterGroup}>
          {STATUS_FILTERS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
              style={{ ...styles.chipBtn, ...(statusFilter === s ? styles.chipActive : {}) }}
            >
              {s}
            </button>
          ))}
        </div>
        <select style={styles.select} value={severityFilter} onChange={(e) => setSeverityFilter(e.target.value)}>
          {SEVERITY_FILTERS.map((s) => <option key={s} value={s}>severity: {s}</option>)}
        </select>
        <select style={styles.select} value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)}>
          {SOURCE_FILTERS.map((s) => <option key={s} value={s}>source: {s}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button type="button" style={styles.secondaryBtn} onClick={exportCsv} disabled={!filtered.length}>
          Export CSV
        </button>
        <button type="button" style={styles.primaryBtn} onClick={runScan} disabled={busy === 'scan'}>
          {busy === 'scan' ? 'Scanning…' : 'Run scan'}
        </button>
        <button type="button" style={styles.secondaryBtn} onClick={() => void load(statusFilter)} disabled={loading}>
          Refresh
        </button>
      </div>

      {scanMsg && <div style={styles.scanMsg}>{scanMsg}</div>}
      {loading && <div style={styles.empty}>Loading anomalies…</div>}
      {!loading && error && <div style={styles.errorMsg}>{error}</div>}
      {!loading && !error && filtered.length === 0 && (
        <div style={styles.empty}>No anomalies match the current filters.</div>
      )}

      {filtered.map((a) => {
        const sev = SEVERITY_STYLES[a.severity] || SEVERITY_STYLES.warning
        const isOpen = expanded === a.id
        return (
          <div key={a.id} style={styles.row}>
            <div style={styles.rowTop}>
              <span style={{ ...styles.pill, background: sev.bg, color: sev.color, border: `1px solid ${sev.border}` }}>
                {a.severity}
              </span>
              <span style={{ ...styles.pill, background: '#f3f4f6', color: '#555' }}>{a.source}</span>
              <span style={styles.category}>{a.category}</span>
              <span style={styles.meta}>{fmtDate(a.created_at)}</span>
              <span style={{ ...styles.pill, background: a.status === 'open' ? '#fee2e2' : '#f3f4f6' }}>
                {a.status}
              </span>
            </div>
            <div style={styles.message}>{a.message}</div>
            <div style={styles.rowActions}>
              <button
                type="button"
                style={styles.linkBtn}
                onClick={() => setExpanded(isOpen ? null : a.id)}
              >
                {isOpen ? 'Hide context' : 'Show context'}
              </button>
              {a.request_id && onOpenRequest && (
                <button
                  type="button"
                  style={styles.linkBtn}
                  onClick={() => onOpenRequest(a.request_id)}
                >
                  Open request
                </button>
              )}
              <div style={{ flex: 1 }} />
              {a.status === 'open' && (
                <button type="button" style={styles.secondaryBtn} disabled={!!busy} onClick={() => act(a, 'acked')}>
                  {busy === a.id ? '…' : 'Take'}
                </button>
              )}
              {a.status !== 'resolved' && (
                <button type="button" style={styles.primaryBtn} disabled={!!busy} onClick={() => act(a, 'resolved')}>
                  {busy === a.id ? '…' : 'Resolve'}
                </button>
              )}
              {a.status !== 'ignored' && a.status !== 'resolved' && (
                <button type="button" style={styles.ghostBtn} disabled={!!busy} onClick={() => act(a, 'ignored')}>
                  Ignore
                </button>
              )}
            </div>
            {isOpen && (
              <pre style={styles.contextPre}>{formatContext(a)}</pre>
            )}
          </div>
        )
      })}
    </div>
  )
}

function formatContext(a) {
  try {
    return JSON.stringify({
      context: a.context || {},
      request_id: a.request_id,
      seller_id: a.seller_id,
      dedupe_hash: a.dedupe_hash,
      stage: a.context?.request_status ? stageOfStatus(a.context.request_status) : null,
    }, null, 2)
  } catch {
    return String(a.context || '')
  }
}

function fmtDate(v) {
  if (!v) return '—'
  try { return new Date(v).toLocaleString() } catch { return '—' }
}

const styles = {
  wrap: { display: 'flex', flexDirection: 'column', gap: 10 },
  toolbar: { display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' },
  filterGroup: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chipBtn: {
    border: '1px solid #e8f0ec', borderRadius: 999, padding: '6px 12px',
    fontSize: 12, fontWeight: 700, background: '#fff', color: '#555',
    cursor: 'pointer', fontFamily: 'inherit', textTransform: 'capitalize',
  },
  chipActive: { background: '#1a7a4a', color: '#fff', borderColor: '#1a7a4a' },
  select: {
    border: '1px solid #e8f0ec', borderRadius: 10, padding: '6px 10px',
    fontSize: 12, fontFamily: 'inherit', background: '#fff', color: '#555',
    textTransform: 'capitalize',
  },
  primaryBtn: {
    background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: 10,
    padding: '8px 14px', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit',
  },
  secondaryBtn: {
    background: '#fff', color: '#1a7a4a', border: '1px solid #1a7a4a', borderRadius: 10,
    padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  },
  ghostBtn: {
    background: 'transparent', color: '#6b7280', border: '1px solid #e5e7eb', borderRadius: 10,
    padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  },
  linkBtn: {
    background: 'none', border: 'none', color: '#1a7a4a', fontSize: 12, fontWeight: 700,
    cursor: 'pointer', fontFamily: 'inherit', padding: '4px 0',
  },
  scanMsg: {
    background: '#f0f9ff', border: '1px solid #bae6fd', color: '#0369a1',
    borderRadius: 10, padding: '8px 12px', fontSize: 12, fontWeight: 600,
  },
  empty: { padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 13 },
  errorMsg: {
    background: '#fee2e2', border: '1px solid #fecaca', color: '#b91c1c',
    borderRadius: 10, padding: '8px 12px', fontSize: 12,
  },
  row: {
    background: '#fff', border: '1px solid #e8f0ec', borderRadius: 12,
    padding: 12, display: 'flex', flexDirection: 'column', gap: 8,
  },
  rowTop: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  pill: {
    fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999,
    textTransform: 'uppercase', letterSpacing: 0.4,
  },
  category: { fontSize: 12, fontWeight: 800, color: '#0f1410' },
  meta: { fontSize: 11, color: '#9ca3af' },
  message: { fontSize: 13, color: '#374151', lineHeight: 1.45, wordBreak: 'break-word' },
  rowActions: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },
  contextPre: {
    background: '#0f1410', color: '#d1fae5', borderRadius: 10, padding: 12,
    fontSize: 11, overflowX: 'auto', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all',
  },
}
