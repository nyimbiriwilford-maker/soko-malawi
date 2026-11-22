import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CATEGORIES, URGENCY_OPTIONS, DURATION_OPTIONS, expiresAtFromDays } from '../../constants/lookingFor'
import { MALAWI_DISTRICTS } from '../../constants/malawiDistricts'
import { Icon } from './Icons'
import './RequestComposer.css'

const Ic = {
  map: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  ),
  zap: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  star: (s = 11, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c} aria-hidden>
      <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.5L12 17.3 6.1 20.6l1.2-6.5L2.5 9.5l6.6-.9L12 2.5z" />
    </svg>
  ),
}

function budgetDigits(value) {
  return String(value ?? '').replace(/\D/g, '')
}

function budgetDisplay(value) {
  const digits = budgetDigits(value)
  return digits ? Number(digits).toLocaleString('en-US') : ''
}

function durationLabel(days) {
  if (days === 'custom') return 'Custom'
  if (days == null) return 'No expiry'
  return `${days} day${days === 1 ? '' : 's'}`
}

function expiryText(days) {
  if (days == null) return 'No expiry. You can mark it fulfilled earlier.'
  const n = Number(days)
  if (!Number.isFinite(n) || n < 1) return 'Choose a custom duration. You can mark it fulfilled earlier.'
  const iso = expiresAtFromDays(n)
  const date = iso
    ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
    : ''
  return `Expires ${date}. You can mark it fulfilled earlier.`
}

function draftSnapshot(form, homeLocation, selectedCities) {
  return JSON.stringify({ form, homeLocation, selectedCities })
}

function FieldLabel({ htmlFor, children, optional }) {
  return (
    <label className="lf-label" htmlFor={htmlFor}>
      {children}
      {optional && <span className="lf-optional">Optional</span>}
    </label>
  )
}

function revealFocused(event) {
  window.setTimeout(() => {
    event.target?.scrollIntoView?.({ block: 'nearest', behavior: 'smooth' })
  }, 120)
}

function LocationPicker({
  label,
  hint,
  icon,
  value,
  multi = false,
  selected = [],
  onSelect,
  onRemove,
  search = '',
  onSearch,
  options = [],
  detecting,
  placeholder,
  inputId,
  error,
}) {
  const q = String(search || '').trim().toLowerCase()
  const pool = [...new Set([...(options || []), ...MALAWI_DISTRICTS])]
  const filtered = pool
    .filter(c => !q || c.toLowerCase().includes(q))
    .filter(c => multi ? !selected.includes(c) : c.toLowerCase() !== String(value || '').toLowerCase())
    .slice(0, 8)
  const custom = q && !pool.some(c => c.toLowerCase() === q) && !(multi && selected.some(c => c.toLowerCase() === q))
    ? String(search).trim()
    : ''

  return (
    <div className={`lf-field${error ? ' has-error' : ''}`} data-error={error ? 'true' : undefined}>
      <FieldLabel htmlFor={inputId}>{label}</FieldLabel>
      {hint && <div className="lf-hint">{hint}</div>}
      {detecting && <div className="lf-detecting">Detecting your location…</div>}

      {multi && selected.length > 0 && (
        <div className="lf-chip-row">
          {selected.map(city => (
            <span className="lf-chip" key={city}>
              {icon}
              {city}
              <button type="button" onClick={() => onRemove?.(city)} aria-label={`Remove ${city}`}>
                {Icon.x(10)}
              </button>
            </span>
          ))}
        </div>
      )}

      {!multi && value && (
        <div className="lf-value-chip">
          {icon}
          <span>{value}</span>
          <button type="button" onClick={() => onSelect?.('')} aria-label="Clear location">
            {Icon.x(11)}
          </button>
        </div>
      )}

      <div className={`lf-search-field${error ? ' is-error' : ''}`}>
        {icon}
        <input
          id={inputId}
          value={search || ''}
          placeholder={placeholder}
          onChange={e => onSearch?.(e.target.value)}
          onFocus={revealFocused}
          autoComplete="off"
        />
      </div>

      {(search || '').trim() && (filtered.length > 0 || custom) && (
        <div className="lf-suggestions">
          {custom && (
            <button
              type="button"
              className="lf-suggestion is-custom"
              onClick={() => { onSelect?.(custom); onSearch?.('') }}
            >
              Use “{custom}”
            </button>
          )}
          {filtered.map(city => (
            <button
              key={city}
              type="button"
              className="lf-suggestion"
              onClick={() => { onSelect?.(city); onSearch?.('') }}
            >
              {icon}
              {city}
            </button>
          ))}
        </div>
      )}
      {error && <div className="lf-error">{error}</div>}
    </div>
  )
}

export default function RequestComposer(props) {
  if (!props.open || typeof document === 'undefined') return null
  return createPortal(<RequestComposerSheet {...props} />, document.body)
}

function RequestComposerSheet({
  onClose,
  form,
  onFormChange,
  images = [],
  coverIndex = 0,
  onImageChange,
  onImageRemove,
  onSetCover,
  homeLocation = '',
  onHomeLocationChange,
  homeSearch = '',
  onHomeSearch,
  gpsDetected = null,
  gpsStatus = 'idle',
  onRedetectGps,
  onRetryGps,
  selectedCities = [],
  onAddCity,
  onRemoveCity,
  dbCities = [],
  citySearch = '',
  onCitySearch,
  detectingCity,
  posting,
  onPost,
}) {
  const fileRef = useRef(null)
  const bodyRef = useRef(null)
  const rootRef = useRef(null)
  const [viewport] = useState({
    height: typeof window === 'undefined' ? 0 : window.innerHeight,
    bottom: 0,
  })
  const [draft] = useState(() => draftSnapshot(form, homeLocation, selectedCities))
  const [confirmDiscard, setConfirmDiscard] = useState(false)
  const [showErrors, setShowErrors] = useState(false)

  const durationMode = form.durationDays
  const isCustomDuration = durationMode === 'custom'
  const isNoExpiry = durationMode == null || durationMode === 'none'
  const durationDays = isCustomDuration
    ? (Number(form.customDays) || '')
    : (isNoExpiry ? null : (Number(durationMode) || 7))
  const canPost = !!form.title?.trim() && !posting

  const currentDraft = draftSnapshot(form, homeLocation, selectedCities)
  const dirty = currentDraft !== draft

  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [])

  useEffect(() => {
    const vv = window.visualViewport
    const update = () => {
      const height = vv ? vv.height : window.innerHeight
      const offsetTop = vv ? vv.offsetTop : 0
      const bottom = Math.max(0, window.innerHeight - height - offsetTop)
      rootRef.current?.style.setProperty('--lf-vv-h', `${height}px`)
      rootRef.current?.style.setProperty('--lf-vv-bottom', `${bottom}px`)
    }
    update()
    vv?.addEventListener('resize', update)
    vv?.addEventListener('scroll', update)
    window.addEventListener('resize', update)
    return () => {
      vv?.removeEventListener('resize', update)
      vv?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  function requestClose() {
    if (dirty && !confirmDiscard) {
      setConfirmDiscard(true)
      return
    }
    setConfirmDiscard(false)
    onClose?.()
  }

  function keepEditing() {
    setConfirmDiscard(false)
  }

  function discardDraft() {
    setConfirmDiscard(false)
    onClose?.()
  }

  useEffect(() => {
    const onKeyDown = event => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (confirmDiscard) setConfirmDiscard(false)
      else if (dirty) setConfirmDiscard(true)
      else onClose?.()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmDiscard, dirty, onClose])

  function handleFileChange(event) {
    const files = Array.from(event.target.files || [])
    if (!files.length) return
    onImageChange?.(files)
    event.target.value = ''
  }

  function handleSubmit() {
    if (posting) return
    const customInvalid = isCustomDuration && (!Number(form.customDays) || Number(form.customDays) < 1)
    const missing = !(homeLocation || '').trim() || !selectedCities.length || customInvalid
    if (missing || !form.title?.trim()) {
      setShowErrors(true)
      window.requestAnimationFrame(() => {
        const target = bodyRef.current?.querySelector('[data-error="true"]')
        target?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        target?.querySelector('input, select, textarea')?.focus({ preventScroll: true })
      })
      return
    }
    setShowErrors(false)
    onPost?.()
  }

  const titleError = showErrors && !form.title?.trim() ? 'Enter what you are looking for' : ''
  const homeError = showErrors && !(homeLocation || '').trim() ? 'Tell sellers where you stay' : ''
  const citiesError = showErrors && !selectedCities.length ? 'Add at least one area where you are looking' : ''
  const customError = showErrors && isCustomDuration && (!Number(form.customDays) || Number(form.customDays) < 1)
    ? 'Enter a custom duration of at least 1 day'
    : ''

  const gpsText = gpsStatus === 'finding'
    ? 'Finding your location...'
    : gpsStatus === 'success'
      ? `Location captured · ${gpsDetected?.label || homeLocation || ''}`
      : "Couldn't get exact location. Your request will show the city only."

  const rootStyle = viewport.height
    ? { '--lf-vv-h': `${viewport.height}px`, '--lf-vv-bottom': `${viewport.bottom}px` }
    : undefined

  return (
    <div className="lf-composer-root" style={rootStyle} ref={rootRef}>
      <div className="lf-composer-backdrop" onClick={requestClose} />

      <section
        className="lf-composer-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="lf-composer-title"
      >
        <header className="lf-composer-header">
          <div className="lf-composer-handle"><span /></div>
          <div className="lf-composer-header-row">
            <div>
              <h2 id="lf-composer-title" className="lf-composer-title">Post a request</h2>
              <div className="lf-composer-subtitle">Tell sellers what you need</div>
            </div>
            <button type="button" className="lf-close" onClick={requestClose} aria-label="Close">
              {Icon.x(16)}
            </button>
          </div>
        </header>

        <div className="lf-composer-body" ref={bodyRef}>
          <div className={`lf-gps-line is-${gpsStatus}`}>
            <span className="lf-gps-dot" />
            <span className="lf-gps-text">{gpsText}</span>
            <span className="lf-gps-actions">
              {gpsStatus === 'error' && (
                <button
                  type="button"
                  onClick={() => onRetryGps?.()}
                  disabled={detectingCity}
                >
                  Try again
                </button>
              )}
              {gpsStatus === 'success' && (
                <>
                  <button
                    type="button"
                    onClick={() => { onHomeLocationChange?.(''); onHomeSearch?.('') }}
                    disabled={detectingCity}
                  >
                    Change
                  </button>
                  <button type="button" onClick={() => onRedetectGps?.()} disabled={detectingCity}>
                    {detectingCity ? '…' : 'Re-detect'}
                  </button>
                </>
              )}
            </span>
          </div>

          <div className={`lf-field${titleError ? ' has-error' : ''}`} data-error={titleError ? 'true' : undefined}>
            <FieldLabel htmlFor="lf-title">What are you looking for?</FieldLabel>
            <input
              id="lf-title"
              className="lf-input"
              placeholder="e.g. Second-hand Samsung A15, or driver in Blantyre"
              value={form.title || ''}
              maxLength={120}
              onChange={e => onFormChange?.({ title: e.target.value })}
              onFocus={revealFocused}
            />
            {titleError && <div className="lf-error">{titleError}</div>}
          </div>

          <div className="lf-field-pair">
            <div className="lf-field">
              <FieldLabel htmlFor="lf-budget">Budget (MK)</FieldLabel>
              <div className="lf-affix-input">
                <span>MK</span>
                <input
                  id="lf-budget"
                  className="lf-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  maxLength={15}
                  value={budgetDisplay(form.budget)}
                  onChange={e => onFormChange?.({ budget: budgetDigits(e.target.value) })}
                  onFocus={revealFocused}
                />
              </div>
              <div className="lf-hint">Optional</div>
            </div>
            <div className="lf-field">
              <FieldLabel htmlFor="lf-category">Category</FieldLabel>
              <div className="lf-select-wrap">
                <select
                  id="lf-category"
                  className="lf-input lf-select"
                  value={form.category || 'Electronics'}
                  onChange={e => onFormChange?.({ category: e.target.value })}
                  onFocus={revealFocused}
                >
                  {CATEGORIES.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                {Icon.chevD(12)}
              </div>
            </div>
          </div>

          <div className="lf-field">
            <FieldLabel>How long should this stay up?</FieldLabel>
            <div className="lf-duration-chips">
              {DURATION_OPTIONS.map(option => {
                const active = option.days === null
                  ? isNoExpiry
                  : option.days === 'custom'
                    ? isCustomDuration
                    : Number(durationMode) === option.days
                return (
                  <button
                    key={option.days === null ? 'none' : String(option.days)}
                    type="button"
                    className={`lf-duration-chip${active ? ' is-active' : ''}`}
                    onClick={() => onFormChange?.({
                      durationDays: option.days,
                      customDays: option.days === 'custom' ? (form.customDays || '10') : form.customDays,
                    })}
                  >
                    <span>{durationLabel(option.days)}</span>
                    {option.days === 7 && <span className="lf-rec">Recommended</span>}
                  </button>
                )
              })}
            </div>
            {isCustomDuration && (
              <div className={`lf-custom-days${customError ? ' has-error' : ''}`} data-error={customError ? 'true' : undefined}>
                <FieldLabel htmlFor="lf-custom-days">Custom duration (days)</FieldLabel>
                <input
                  id="lf-custom-days"
                  className="lf-input"
                  type="number"
                  min={1}
                  max={365}
                  placeholder="10"
                  value={form.customDays || ''}
                  onChange={e => onFormChange?.({ customDays: e.target.value, durationDays: 'custom' })}
                  onFocus={revealFocused}
                />
                {customError && <div className="lf-error">{customError}</div>}
              </div>
            )}
            <div className="lf-expiry-line">
              {Icon.clock(12)}
              <span>{expiryText(isNoExpiry ? null : durationDays)}</span>
            </div>
          </div>

          <div className="lf-field">
            <FieldLabel htmlFor="lf-description" optional>Description</FieldLabel>
            <textarea
              id="lf-description"
              className="lf-input lf-textarea"
              placeholder="Brand, condition, specs, when you need it…"
              value={form.description || ''}
              rows={3}
              maxLength={300}
              onChange={e => onFormChange?.({ description: e.target.value })}
              onFocus={revealFocused}
            />
            <div className="lf-counter">{(form.description || '').length}/300</div>
          </div>

          <div className="lf-field">
            <FieldLabel optional>Photos</FieldLabel>
            <div className="lf-photo-row">
              {images.map((img, i) => (
                <div
                  key={i}
                  className={`lf-thumb${coverIndex === i ? ' is-cover' : ''}`}
                >
                  <img src={img.preview} alt="" />
                  {coverIndex === i ? (
                    <span className="lf-cover-tag">{Ic.star(9, '#fff')} COVER</span>
                  ) : (
                    <button
                      type="button"
                      className="lf-set-cover"
                      onClick={() => onSetCover?.(i)}
                    >
                      Set cover
                    </button>
                  )}
                  <button
                    type="button"
                    className="lf-remove-photo"
                    onClick={() => onImageRemove?.(i)}
                    aria-label={`Remove photo ${i + 1}`}
                  >
                    {Icon.x(10)}
                  </button>
                </div>
              ))}
              {images.length < 5 && (
                <button type="button" className="lf-add-photo" onClick={() => fileRef.current?.click()}>
                  {Icon.plus(18)}
                  <span>Add</span>
                </button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                multiple
                className="lf-file-input"
                onChange={handleFileChange}
              />
            </div>
            <div className="lf-hint">Up to 5 images</div>
          </div>

          <LocationPicker
            label="Where do you stay?"
            hint="GPS fills area & district — tap Change, or search/type a different place"
            icon={Ic.map(13)}
            value={homeLocation}
            onSelect={v => onHomeLocationChange?.(v)}
            search={homeSearch}
            onSearch={onHomeSearch}
            options={dbCities}
            detecting={detectingCity && !gpsDetected}
            placeholder="Type area or district to change stay location…"
            inputId="lf-home-search"
            error={homeError}
          />

          <LocationPicker
            label="Where are you looking?"
            hint="Areas where you want the product or service — add one or more"
            icon={Ic.map(13)}
            multi
            selected={selectedCities}
            onSelect={v => onAddCity?.(v)}
            onRemove={onRemoveCity}
            search={citySearch}
            onSearch={onCitySearch}
            options={dbCities}
            placeholder="e.g. Blantyre, Limbe market, Mzuzu…"
            inputId="lf-city-search"
            error={citiesError}
          />

          <div className="lf-field">
            <FieldLabel>How soon?</FieldLabel>
            <div className="lf-urgency-row">
              {URGENCY_OPTIONS.map(({ value, label, color, bg, border }) => {
                const active = form.urgency === value
                return (
                  <button
                    key={value}
                    type="button"
                    className={`lf-urgency-chip${active ? ' is-active' : ''}`}
                    style={active ? { color, background: bg, borderColor: border } : undefined}
                    onClick={() => onFormChange?.({ urgency: value })}
                  >
                    {value === 'urgent' && Ic.zap(13)}
                    {label}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        <footer className="lf-composer-footer">
          <button
            type="button"
            className="lf-submit"
            onClick={handleSubmit}
            disabled={!canPost}
            aria-busy={posting ? 'true' : 'false'}
          >
            {posting
              ? <><span className="lf-spinner" />Posting...</>
              : 'Post request'}
          </button>
        </footer>
      </section>

      {confirmDiscard && (
        <div className="lf-confirm-backdrop" onClick={keepEditing}>
          <div
            className="lf-confirm"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="lf-confirm-title"
            onClick={e => e.stopPropagation()}
          >
            <div id="lf-confirm-title" className="lf-confirm-title">Discard this request?</div>
            <div className="lf-confirm-text">Your unsaved details will be lost.</div>
            <div className="lf-confirm-actions">
              <button type="button" className="lf-confirm-keep" onClick={keepEditing}>Keep editing</button>
              <button type="button" className="lf-confirm-discard" onClick={discardDraft}>Discard</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
