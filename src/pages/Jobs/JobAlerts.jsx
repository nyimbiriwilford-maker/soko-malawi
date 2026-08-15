import { useState, useEffect, useRef, useCallback } from 'react'
import { supabase } from '../../lib/supabase'

const MAX_KEYWORDS = 20

/**
 * JobAlertWizard — full modal wizard for setting up / managing job alerts.
 */
export function JobAlertWizard({ currentUser, onClose, onSave }) {
  const [step, setStep] = useState(1) // 1 = intro, 2 = keywords, 3 = done
  const [keywords, setKeywords] = useState([])
  const [input, setInput] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [clearingAll, setClearingAll] = useState(false)
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
      if (!cancelled && data?.keywords?.length) {
        setKeywords(data.keywords)
        setStep(2) // skip intro if already has keywords
      }
    })()
    return () => { cancelled = true }
  }, [currentUser])

  function addKeyword() {
    setError('')
    const raw = input.trim()
    if (!raw) return
    if (keywords.length >= MAX_KEYWORDS) {
      setError(`Maximum ${MAX_KEYWORDS} keywords allowed.`)
      return
    }
    if (keywords.some(k => k.toLowerCase() === raw.toLowerCase())) {
      setError(`"${raw}" is already in your alerts.`)
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
    if (e.key === 'Enter') { e.preventDefault(); addKeyword() }
  }

  async function handleSave() {
    if (!currentUser) return
    setSaving(true)
    setError('')

    const clean = keywords.map(k => k.trim()).filter(Boolean)

    if (clean.length === 0) {
      // Delete alerts if all keywords removed
      const { error: dbError } = await supabase
        .from('job_alerts')
        .delete()
        .eq('user_id', currentUser.id)
      setSaving(false)
      if (dbError) {
        setError(dbError.message || 'Failed to save.')
        return
      }
      setStep(3)
      onSave?.([])
      return
    }

    const { error: dbError } = await supabase
      .from('job_alerts')
      .upsert({ user_id: currentUser.id, keywords: clean }, { onConflict: 'user_id' })
    setSaving(false)
    if (dbError) {
      setError(dbError.message || 'Failed to save.')
      return
    }
    setStep(3)
    onSave?.(clean)
  }

  async function handleClearAll() {
    if (!currentUser) return
    if (!window.confirm('Remove all your job alerts?')) return
    setClearingAll(true)
    await supabase.from('job_alerts').delete().eq('user_id', currentUser.id)
    setKeywords([])
    setClearingAll(false)
    setStep(3)
    onSave?.([])
  }

  const hasExisting = keywords.length > 0

  if (!currentUser) return null

  return (
    <div className="jaw-overlay" onClick={onClose}>
      <div className="jaw-modal" onClick={e => e.stopPropagation()}>
        {/* Close */}
        <button className="jaw-close" onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>

        {/* ── Step 1: Intro (first time only) ── */}
        {step === 1 && (
          <div className="jaw-step">
            <div className="jaw-step-icon jaw-step-icon--intro">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
              </svg>
            </div>
            <h2 className="jaw-title">Never miss the right job</h2>
            <p className="jaw-desc">
              Set up keyword alerts and we'll notify you the moment a matching job is posted on SokoMw.
            </p>
            <div className="jaw-examples">
              <span className="jaw-example-chip">accountant</span>
              <span className="jaw-example-chip">developer</span>
              <span className="jaw-example-chip">Lilongwe</span>
              <span className="jaw-example-chip">NGO</span>
              <span className="jaw-example-chip">internship</span>
            </div>
            <button className="jaw-btn-primary" onClick={() => setStep(2)}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
              Add Keywords
            </button>
          </div>
        )}

        {/* ── Step 2: Keywords Manager ── */}
        {step === 2 && (
          <div className="jaw-step">
            {/* Header */}
            <div className="jaw-step-header">
              <div className="jaw-step-icon jaw-step-icon--keywords">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                  <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <h2 className="jaw-title jaw-title--sm">
                  {hasExisting ? 'Manage Your Alerts' : 'Set Up Job Alerts'}
                </h2>
                <p className="jaw-desc jaw-desc--sm">
                  {hasExisting
                    ? `${keywords.length} keyword${keywords.length !== 1 ? 's' : ''} active — add, remove, or save changes.`
                    : 'Add keywords and we\'ll notify you when matching jobs appear.'}
                </p>
              </div>
            </div>

            {/* Input */}
            <div className="jaw-input-row">
              <div className="jaw-input-wrap">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" className="jaw-input-icon">
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  ref={inputRef}
                  className="jaw-input"
                  placeholder="Type a keyword and press Enter..."
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={onInputKey}
                  maxLength={60}
                />
              </div>
              <button className="jaw-add-btn" onClick={addKeyword} disabled={!input.trim()}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
                </svg>
                Add
              </button>
            </div>

            {/* Chips */}
            <div className="jaw-chips">
              {keywords.length === 0 ? (
                <div className="jaw-chips-empty">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" style={{ opacity: 0.35 }}>
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  No keywords yet — add at least one to start receiving alerts.
                </div>
              ) : keywords.map(kw => (
                <span key={kw} className="jaw-chip">
                  <span className="jaw-chip-dot" />
                  {kw}
                  <button className="jaw-chip-x" onClick={() => removeKeyword(kw)} aria-label={`Remove ${kw}`}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                </span>
              ))}
            </div>

            {error && <div className="jaw-toast jaw-toast--error">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
              {error}
            </div>}

            {/* Footer: count + clear + save */}
            <div className="jaw-footer-row">
              <span className="jaw-count">{keywords.length} / {MAX_KEYWORDS}</span>
              {hasExisting && (
                <button
                  className="jaw-btn-ghost"
                  onClick={handleClearAll}
                  disabled={saving || clearingAll}
                >
                  {clearingAll ? '...' : 'Clear All'}
                </button>
              )}
              <button
                className="jaw-btn-primary jaw-btn-primary--sm"
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <><span className="jaw-spinner" /> Saving...</>
                ) : (
                  <>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    Save
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Success ── */}
        {step === 3 && (
          <div className="jaw-step jaw-step--center">
            <div className="jaw-step-icon jaw-step-icon--done">
              <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
                <polyline points="22 4 12 14.01 9 11.01"/>
              </svg>
            </div>
            <h2 className="jaw-title">
              {keywords.length > 0 ? "You're all set!" : "Alerts cleared"}
            </h2>
            <p className="jaw-desc">
              {keywords.length > 0
                ? <>We'll notify you when a job matches <strong>{keywords.length}</strong> keyword{keywords.length !== 1 ? 's' : ''}.</>
                : 'Your job alerts have been removed.'}
            </p>
            <button className="jaw-btn-primary" onClick={onClose}>
              {keywords.length > 0 ? 'Done' : 'Close'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * JobAlertTrigger — compact icon+label button placed in the hero.
 * Shows active badge if keywords exist. Auto-refreshes after wizard saves.
 */
export default function JobAlertTrigger({ currentUser, onClick }) {
  const [count, setCount] = useState(0)
  const [loaded, setLoaded] = useState(false)

  const fetchCount = useCallback(async () => {
    if (!currentUser) return
    const { data } = await supabase
      .from('job_alerts')
      .select('keywords')
      .eq('user_id', currentUser.id)
      .maybeSingle()
    setCount(data?.keywords?.length || 0)
    setLoaded(true)
  }, [currentUser])

  useEffect(() => { fetchCount() }, [fetchCount])

  // Expose refresh so parent can call after wizard saves
  useEffect(() => {
    if (!currentUser) return
    window.__jobAlertTriggerRefresh = fetchCount
    return () => { delete window.__jobAlertTriggerRefresh }
  }, [currentUser, fetchCount])

  return (
    <button className="ja-trigger" onClick={onClick}>
      <div className="ja-trigger-icon">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
          <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
        </svg>
        {count > 0 && <span className="ja-trigger-badge">{count}</span>}
      </div>
      <span className="ja-trigger-label">
        {count > 0 ? `${count} Alert${count !== 1 ? 's' : ''} On` : 'Set Alerts'}
      </span>
    </button>
  )
}
