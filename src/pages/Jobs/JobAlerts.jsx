import { useState, useEffect, useRef } from 'react'
import { supabase } from '../../lib/supabase'

const MAX_KEYWORDS = 20

export default function JobAlerts({ currentUser }) {
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const [keywords, setKeywords] = useState([])
  const [input, setInput] = useState('')
  const inputRef = useRef()

  useEffect(() => {
    if (!currentUser) return
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('job_alerts')
        .select('keywords')
        .eq('user_id', currentUser.id)
        .maybeSingle()
      if (!cancelled) {
        if (data && Array.isArray(data.keywords)) setKeywords(data.keywords)
        setLoaded(true)
      }
    })()
    return () => { cancelled = true }
  }, [currentUser])

  const loading = !!currentUser && !loaded

  function addKeyword() {
    setError('')
    const raw = input.trim()
    if (!raw) return
    if (keywords.length >= MAX_KEYWORDS) {
      setError(`You can save up to ${MAX_KEYWORDS} keywords.`)
      return
    }
    const key = raw.toLowerCase()
    if (keywords.some(k => k.toLowerCase() === key)) {
      setError(`"${raw}" is already added.`)
      return
    }
    setKeywords(k => [...k, raw])
    setInput('')
    inputRef.current?.focus()
  }

  function removeKeyword(kw) {
    setError('')
    setKeywords(k => k.filter(k2 => k2 !== kw))
  }

  function onInputKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      addKeyword()
    }
  }

  async function save() {
    if (!currentUser) return
    setSaving(true)
    setError('')
    setSaved(false)
    const clean = keywords.map(k => k.trim()).filter(Boolean)
    const { error: dbError } = await supabase
      .from('job_alerts')
      .upsert({ user_id: currentUser.id, keywords: clean }, { onConflict: 'user_id' })
    setSaving(false)
    if (dbError) {
      setError(dbError.message || 'Could not save your job alerts.')
      return
    }
    setKeywords(clean)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  if (!currentUser) {
    return (
      <div className="ja-panel">
        <div className="ja-empty">
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
          <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Sign in required</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sign in to set up keyword alerts and get notified when matching jobs are posted.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="ja-panel">
        <div className="job-skeleton" style={{ height: 120 }} />
      </div>
    )
  }

  return (
    <div className="ja-panel">
      <div className="ja-head">
        <div>
          <div className="ja-title">🔔 Job Alerts</div>
          <div className="ja-sub">
            Add keywords and we&apos;ll notify you when a new job matches them.
          </div>
        </div>
      </div>

      <div className="ja-input-row">
        <input
          ref={inputRef}
          className="ja-input"
          placeholder="e.g. React, accounting, Lilongwe…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onInputKey}
          enterKeyHint="done"
          maxLength={60}
        />
        <button type="button" className="ja-add-btn" onClick={addKeyword} disabled={!input.trim() || saving}>
          + Add
        </button>
      </div>

      <div className="ja-row">
        {keywords.length === 0 ? (
          <span className="ja-empty-hint">No keywords yet — add at least one to start receiving alerts.</span>
        ) : (
          keywords.map(kw => (
            <span key={kw} className="ja-chip">
              {kw}
              <button
                type="button"
                className="ja-chip-x"
                onClick={() => removeKeyword(kw)}
                disabled={saving}
                aria-label={`Remove ${kw}`}
              >
                ✕
              </button>
            </span>
          ))
        )}
      </div>

      {error && <div className="ja-error">⚠ {error}</div>}
      {saved && <div className="ja-saved">✓ Saved — you&apos;ll be notified on new matching jobs.</div>}

      <button
        type="button"
        className="ja-save-btn"
        onClick={save}
        disabled={saving || keywords.length === 0}
      >
        {saving ? 'Saving…' : 'Save Alerts'}
      </button>
    </div>
  )
}
