/**
 * Modern Looking For request composer — bottom sheet.
 * Duration, urgency, photos, location, modern SVG icons.
 */
import { useRef } from 'react'
import { T } from '../../constants/tokens'
import { CATEGORIES, URGENCY_OPTIONS, DURATION_OPTIONS } from '../../constants/lookingFor'
import { MALAWI_DISTRICTS } from '../../constants/malawiDistricts'
import { Icon } from './Icons'

const G = T.green

// ── Extra icons ──────────────────────────────────────────────────────────────
const Ic = {
  camera: (s = 22, c = G) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3l2-3h8l2 3h3a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  ),
  image: (s = 16, c = G) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="3" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <path d="M21 15l-5-5L5 21" />
    </svg>
  ),
  clock: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  zap: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  ),
  tag: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20.6 13.4l-7.2 7.2a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
      <circle cx="7.5" cy="7.5" r="1.2" fill={c} stroke="none" />
    </svg>
  ),
  wallet: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 7H4a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2z" />
      <path d="M16 3H8v4h8V3z" />
      <circle cx="16" cy="13" r="1.2" fill={c} stroke="none" />
    </svg>
  ),
  map: (s = 14, c = 'currentColor') => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  ),
  send: (s = 16) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M22 2L11 13" />
      <path d="M22 2l-7 20-4-9-9-4 20-7z" />
    </svg>
  ),
  spark: (s = 18) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
    </svg>
  ),
  star: (s = 11) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2.5l2.9 6.1 6.6.9-4.8 4.6 1.2 6.5L12 17.3 6.1 20.6l1.2-6.5L2.5 9.5l6.6-.9L12 2.5z" />
    </svg>
  ),
}

function FieldLabel({ icon, children, optional }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      fontSize: 11, fontWeight: 800, color: T.gray600,
      textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8,
    }}>
      {icon}
      {children}
      {optional && (
        <span style={{ fontWeight: 600, color: T.gray400, textTransform: 'none', letterSpacing: 0 }}>
          · optional
        </span>
      )}
    </div>
  )
}

function LocationPicker({
  label,
  hint,
  icon,
  value, // string for single, or unused when multi
  multi = false,
  selected = [],
  onSelect,
  onRemove,
  search,
  onSearch,
  options = [],
  detecting,
  placeholder,
}) {
  const q = (search || '').trim().toLowerCase()
  const pool = [...new Set([...(options || []), ...MALAWI_DISTRICTS])]
  const filtered = pool
    .filter(c => !q || c.toLowerCase().includes(q))
    .filter(c => multi ? !selected.includes(c) : c.toLowerCase() !== String(value || '').toLowerCase())
    .slice(0, 8)
  const custom = (search || '').trim()
    && !pool.some(c => c.toLowerCase() === (search || '').trim().toLowerCase())
    && !(multi && selected.includes((search || '').trim()))
    ? (search || '').trim()
    : null

  return (
    <div style={{ marginBottom: 16 }}>
      <FieldLabel icon={icon}>{label}</FieldLabel>
      {hint && (
        <div style={{ fontSize: 11, color: T.gray400, fontWeight: 600, marginBottom: 8, marginTop: -4 }}>
          {hint}
        </div>
      )}
      {detecting && (
        <div style={{ fontSize: 11, color: G, marginBottom: 6, fontWeight: 600 }}>
          Detecting your location…
        </div>
      )}
      {multi && selected.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {selected.map(city => (
            <div
              key={city}
              style={{
                background: `linear-gradient(135deg,${G},${T.greenD})`,
                color: '#fff', borderRadius: 999, padding: '6px 12px',
                fontSize: 12, fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              {Ic.map(11, '#fff')}
              {city}
              <button
                type="button"
                onClick={() => onRemove?.(city)}
                style={{
                  background: 'rgba(255,255,255,0.2)', border: 'none',
                  color: '#fff', cursor: 'pointer', width: 18, height: 18,
                  borderRadius: '50%', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', padding: 0,
                }}
              >
                {Icon.x(10)}
              </button>
            </div>
          ))}
        </div>
      )}
      {!multi && value && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8,
          background: T.greenL, border: `1.5px solid ${G}`, borderRadius: 999,
          padding: '6px 12px', fontSize: 12, fontWeight: 700, color: G,
        }}>
          {Ic.map(12, G)} {value}
          <button type="button" onClick={() => onSelect?.('')} style={{
            background: 'none', border: 'none', color: G, cursor: 'pointer', padding: 0,
            display: 'flex',
          }}>{Icon.x(11)}</button>
        </div>
      )}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        border: `1.5px solid ${T.gray200}`, borderRadius: 12,
        padding: '10px 12px', background: T.gray50,
      }}>
        {Ic.map(14, T.gray400)}
        <input
          placeholder={placeholder}
          value={search}
          onChange={e => onSearch?.(e.target.value)}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 13, color: T.gray900, fontFamily: 'inherit',
          }}
        />
      </div>
      {((search || '').trim() && (filtered.length > 0 || custom)) && (
        <div style={{
          background: T.white, border: `1px solid ${T.gray200}`,
          borderRadius: 12, maxHeight: 160, overflowY: 'auto',
          marginTop: 6, boxShadow: T.shadowMd,
        }}>
          {custom && (
            <button
              type="button"
              onClick={() => { onSelect?.(custom); onSearch?.('') }}
              style={{
                width: '100%', textAlign: 'left', border: 'none',
                borderBottom: `1px solid ${T.gray50}`,
                background: T.greenL, padding: '11px 14px',
                fontSize: 13, fontWeight: 700, color: G, cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Use “{custom}”
            </button>
          )}
          {filtered.map(city => (
            <button
              key={city}
              type="button"
              onClick={() => { onSelect?.(city); onSearch?.('') }}
              style={{
                width: '100%', textAlign: 'left', border: 'none',
                borderBottom: `1px solid ${T.gray50}`,
                background: T.white, padding: '10px 14px',
                fontSize: 13, cursor: 'pointer', color: T.gray900,
                fontWeight: 600, fontFamily: 'inherit',
                display: 'flex', alignItems: 'center', gap: 8,
              }}
            >
              {Ic.map(12, T.gray400)} {city}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function RequestComposer({
  open,
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
  onRedetectGps,
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
  const fileRef = useRef()

  function handleFileChange(e) {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    onImageChange?.(files)
    e.target.value = ''
  }

  const durationMode = form.durationDays
  const isCustomDuration = durationMode === 'custom'
  const isNoExpiry = durationMode == null || durationMode === 'none'
  const durationDays = isCustomDuration
    ? (Number(form.customDays) || '')
    : (isNoExpiry ? null : (Number(durationMode) || 7))
  const canPost = !!form.title?.trim() && !!(homeLocation || '').trim() && selectedCities.length > 0 && !posting

  return (
    <>
      {open && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 400,
            background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(6px)',
          }}
        />
      )}

      <div style={{
        position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 401,
        transform: open ? 'translateY(0)' : 'translateY(110%)',
        transition: 'transform 0.38s cubic-bezier(0.32,0.72,0,1)',
        background: T.white,
        borderRadius: '22px 22px 0 0',
        boxShadow: '0 -12px 48px rgba(0,0,0,0.18)',
        maxHeight: '94vh',
        overflowY: 'auto',
        fontFamily: T.font,
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '12px 0 4px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.gray200 }} />
        </div>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '8px 18px 14px', borderBottom: `1px solid ${T.gray100}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <div style={{
              width: 40, height: 40, borderRadius: 12,
              background: `linear-gradient(135deg,${G},${T.greenD})`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(15,157,88,0.35)',
            }}>
              {Ic.spark(18)}
            </div>
            <div>
              <div style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 800, color: T.gray900 }}>
                Post a request
              </div>
              <div style={{ fontSize: 11, color: T.gray400, fontWeight: 600, marginTop: 1 }}>
                Sellers will see what you need
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              background: T.gray100, border: 'none', borderRadius: '50%',
              width: 34, height: 34, cursor: 'pointer', color: T.gray600,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            {Icon.x(14)}
          </button>
        </div>

        <div style={{ padding: '16px 18px 28px' }}>
          {/* ── Photos ── */}
          <div style={{ marginBottom: 18 }}>
            <FieldLabel icon={Ic.image(13, T.gray600)} optional>Reference photos</FieldLabel>
            {images.length === 0 ? (
              <div
                onClick={() => fileRef.current?.click()}
                style={{
                  width: '100%', borderRadius: 16,
                  border: `2px dashed ${T.gray200}`,
                  background: 'linear-gradient(160deg,#f8f9fa 0%,#e8f5ee 100%)',
                  padding: '22px 16px',
                  cursor: 'pointer', textAlign: 'center',
                }}
              >
                <div style={{
                  width: 48, height: 48, borderRadius: 14, margin: '0 auto 10px',
                  background: '#fff', boxShadow: '0 4px 14px rgba(15,157,88,0.12)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {Ic.camera(24)}
                </div>
                <div style={{ fontSize: 13, fontWeight: 800, color: G }}>Add photos</div>
                <div style={{ fontSize: 11, color: T.gray400, marginTop: 3, fontWeight: 600 }}>
                  Optional · up to 5 images
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {images.map((img, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'relative', width: 84, height: 84, borderRadius: 12,
                      overflow: 'hidden',
                      border: coverIndex === i ? `2.5px solid ${G}` : `1.5px solid ${T.gray200}`,
                      boxShadow: coverIndex === i ? '0 4px 12px rgba(15,157,88,0.2)' : 'none',
                    }}
                  >
                    <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    {coverIndex === i ? (
                      <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'rgba(15,157,88,0.9)', fontSize: 9, fontWeight: 800,
                        color: '#fff', textAlign: 'center', padding: '3px 0',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                      }}>
                        {Ic.star(9)} COVER
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSetCover?.(i)}
                        style={{
                          position: 'absolute', bottom: 0, left: 0, right: 0,
                          background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff',
                          fontSize: 9, fontWeight: 700, cursor: 'pointer', padding: '4px 0',
                        }}
                      >
                        Set cover
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onImageRemove?.(i)}
                      style={{
                        position: 'absolute', top: 5, right: 5,
                        background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff',
                        width: 22, height: 22, borderRadius: '50%', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      {Icon.x(10)}
                    </button>
                  </div>
                ))}
                {images.length < 5 && (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    style={{
                      width: 84, height: 84, borderRadius: 12,
                      border: `1.5px dashed ${T.gray200}`, background: T.gray50,
                      cursor: 'pointer', display: 'flex', flexDirection: 'column',
                      alignItems: 'center', justifyContent: 'center', gap: 4,
                      color: G, fontFamily: 'inherit',
                    }}
                  >
                    {Icon.plus(18)}
                    <span style={{ fontSize: 10, fontWeight: 700 }}>Add</span>
                  </button>
                )}
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileChange} />
          </div>

          {/* ── Title ── */}
          <div style={{ marginBottom: 16 }}>
            <FieldLabel icon={Ic.tag(13, T.gray600)}>What are you looking for?</FieldLabel>
            <input
              className="lf-input"
              placeholder="e.g. Second-hand Samsung A15, or driver in Blantyre"
              value={form.title || ''}
              onChange={e => onFormChange?.({ title: e.target.value })}
              style={{
                width: '100%', border: `1.5px solid ${T.gray200}`, borderRadius: 12,
                padding: '12px 14px', fontSize: 14, outline: 'none',
                background: T.gray50, fontFamily: 'inherit', color: T.gray900,
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* ── Budget + Category ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            <div>
              <FieldLabel icon={Ic.wallet(13, T.gray600)}>Budget (MK)</FieldLabel>
              <input
                type="number"
                placeholder="150,000"
                value={form.budget || ''}
                onChange={e => onFormChange?.({ budget: e.target.value })}
                style={{
                  width: '100%', border: `1.5px solid ${T.gray200}`, borderRadius: 12,
                  padding: '12px 14px', fontSize: 14, outline: 'none',
                  background: T.gray50, fontFamily: 'inherit', color: T.gray900,
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div>
              <FieldLabel icon={Ic.tag(13, T.gray600)}>Category</FieldLabel>
              <div style={{ position: 'relative' }}>
                <select
                  value={form.category || 'Electronics'}
                  onChange={e => onFormChange?.({ category: e.target.value })}
                  style={{
                    width: '100%', border: `1.5px solid ${T.gray200}`, borderRadius: 12,
                    padding: '12px 32px 12px 14px', fontSize: 13, outline: 'none',
                    background: T.gray50, fontFamily: 'inherit', color: T.gray900,
                    appearance: 'none', cursor: 'pointer', boxSizing: 'border-box',
                  }}
                >
                  {CATEGORIES.filter(c => c !== 'All').map(c => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
                <span style={{
                  position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)',
                  pointerEvents: 'none', color: T.gray400,
                }}>
                  {Icon.chevD(12)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Duration ── */}
          <div style={{ marginBottom: 16 }}>
            <FieldLabel icon={Ic.clock(13, T.gray600)}>How long should this stay up?</FieldLabel>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {DURATION_OPTIONS.map(opt => {
                const key = opt.days === null ? 'none' : String(opt.days)
                const active = opt.days === null
                  ? isNoExpiry
                  : opt.days === 'custom'
                    ? isCustomDuration
                    : Number(durationMode) === opt.days
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => onFormChange?.({
                      durationDays: opt.days,
                      customDays: opt.days === 'custom' ? (form.customDays || '10') : form.customDays,
                    })}
                    style={{
                      flex: '1 1 28%',
                      minWidth: 88,
                      border: `1.5px solid ${active ? G : T.gray200}`,
                      background: active ? T.greenL : T.gray50,
                      borderRadius: 12,
                      padding: '10px 8px',
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      textAlign: 'center',
                      boxShadow: active ? '0 2px 10px rgba(15,157,88,0.18)' : 'none',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{
                      fontSize: 13, fontWeight: 800,
                      color: active ? G : T.gray800,
                    }}>
                      {opt.label}
                    </div>
                    <div style={{
                      fontSize: 10, fontWeight: 600, marginTop: 2,
                      color: active ? G : T.gray400,
                    }}>
                      {opt.hint}
                    </div>
                  </button>
                )
              })}
            </div>
            {isCustomDuration && (
              <div style={{
                marginTop: 10, display: 'flex', alignItems: 'center', gap: 10,
                background: T.gray50, border: `1.5px solid ${T.gray200}`,
                borderRadius: 12, padding: '10px 12px',
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: T.gray600 }}>Days</span>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={form.customDays || ''}
                  onChange={e => onFormChange?.({ customDays: e.target.value, durationDays: 'custom' })}
                  placeholder="e.g. 10"
                  style={{
                    width: 90, border: `1.5px solid ${T.gray200}`, borderRadius: 10,
                    padding: '8px 10px', fontSize: 14, fontWeight: 700,
                    outline: 'none', fontFamily: 'inherit', color: T.gray900,
                  }}
                />
                <span style={{ fontSize: 12, color: T.gray400, fontWeight: 600 }}>
                  1–365 days
                </span>
              </div>
            )}
            <div style={{
              marginTop: 8, fontSize: 11, color: T.gray400, fontWeight: 600,
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              {Ic.clock(12, T.gray400)}
              {isNoExpiry
                ? 'Prefer not to say · no auto-expiry · stays until you mark fulfilled or delete'
                : isCustomDuration
                  ? `Custom · expires after ${form.customDays || '…'} day(s) · you can mark fulfilled earlier`
                  : `Expires after ${durationDays} day${durationDays === 1 ? '' : 's'} · you can mark fulfilled earlier`}
            </div>
          </div>

          {/* ── Urgency ── */}
          <div style={{ marginBottom: 16 }}>
            <FieldLabel icon={Ic.zap(13, T.gray600)}>How soon?</FieldLabel>
            <div style={{ display: 'flex', gap: 8 }}>
              {URGENCY_OPTIONS.map(({ value, label, color, bg, border }) => {
                const active = form.urgency === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onFormChange?.({ urgency: value })}
                    style={{
                      flex: 1,
                      background: active ? bg : T.gray50,
                      border: `1.5px solid ${active ? border : T.gray200}`,
                      borderRadius: 12,
                      padding: '11px 6px',
                      fontSize: 12.5, fontWeight: 800,
                      cursor: 'pointer',
                      color: active ? color : T.gray400,
                      fontFamily: 'inherit',
                      transition: 'all 0.15s',
                    }}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* ── Where I stay (home) — GPS area + district, editable ── */}
          {(gpsDetected || detectingCity) && (
            <div style={{
              marginBottom: 12, padding: '12px 14px', borderRadius: 14,
              background: detectingCity ? T.gray50 : T.greenL,
              border: `1.5px solid ${detectingCity ? T.gray200 : G}`,
            }}>
              <div style={{
                display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: 10, fontWeight: 800, color: detectingCity ? T.gray400 : G,
                    textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4,
                  }}>
                    {detectingCity ? 'Detecting GPS…' : 'Detected where you stay'}
                  </div>
                  {!detectingCity && gpsDetected && (
                    <>
                      <div style={{ fontSize: 14, fontWeight: 800, color: T.gray900 }}>
                        {homeLocation || gpsDetected.label}
                      </div>
                      {(gpsDetected.area || gpsDetected.district) && (
                        <div style={{ fontSize: 11, color: T.gray600, fontWeight: 600, marginTop: 3 }}>
                          {[gpsDetected.area && `Area: ${gpsDetected.area}`, gpsDetected.district && `District: ${gpsDetected.district}`]
                            .filter(Boolean).join(' · ')}
                        </div>
                      )}
                      {homeLocation && homeLocation !== gpsDetected.label && (
                        <div style={{ fontSize: 11, color: T.amber, fontWeight: 700, marginTop: 4 }}>
                          Changed from GPS: {gpsDetected.label}
                        </div>
                      )}
                    </>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={() => {
                      onHomeLocationChange?.('')
                      onHomeSearch?.('')
                    }}
                    disabled={detectingCity}
                    style={{
                      border: `1.5px solid ${T.gray200}`, background: '#fff',
                      color: T.gray700, borderRadius: 10, padding: '8px 10px',
                      fontSize: 11, fontWeight: 800, cursor: detectingCity ? 'default' : 'pointer',
                      fontFamily: 'inherit', opacity: detectingCity ? 0.6 : 1,
                    }}
                  >
                    Change
                  </button>
                  <button
                    type="button"
                    onClick={() => onRedetectGps?.()}
                    disabled={detectingCity}
                    style={{
                      border: `1.5px solid ${G}`, background: '#fff',
                      color: G, borderRadius: 10, padding: '8px 10px',
                      fontSize: 11, fontWeight: 800, cursor: detectingCity ? 'default' : 'pointer',
                      fontFamily: 'inherit', opacity: detectingCity ? 0.6 : 1,
                    }}
                  >
                    {detectingCity ? '…' : 'Re-detect'}
                  </button>
                </div>
              </div>
            </div>
          )}
          <LocationPicker
            label="Where do you stay?"
            hint="GPS fills area & district — tap Change, or search/type a different place"
            icon={Ic.map(13, T.gray600)}
            value={homeLocation}
            onSelect={(v) => onHomeLocationChange?.(v)}
            search={homeSearch}
            onSearch={onHomeSearch}
            options={dbCities}
            detecting={detectingCity && !gpsDetected}
            placeholder="Type area or district to change stay location…"
          />

          {/* ── Looking for product in (search areas) ── */}
          <LocationPicker
            label="Where are you looking?"
            hint="Areas where you want the product or service — add one or more"
            icon={Ic.map(13, T.gray600)}
            multi
            selected={selectedCities}
            onSelect={(v) => onAddCity?.(v)}
            onRemove={onRemoveCity}
            search={citySearch}
            onSearch={onCitySearch}
            options={dbCities}
            placeholder="e.g. Blantyre, Limbe market, Mzuzu…"
          />
          {!selectedCities.length && (
            <div style={{ fontSize: 11, color: T.amber, fontWeight: 700, marginTop: -10, marginBottom: 14 }}>
              Add at least one area where you’re looking
            </div>
          )}
          {!(homeLocation || '').trim() && (
            <div style={{ fontSize: 11, color: T.amber, fontWeight: 700, marginTop: -8, marginBottom: 14 }}>
              Tell sellers where you stay
            </div>
          )}

          {/* ── Description ── */}
          <div style={{ marginBottom: 20 }}>
            <FieldLabel icon={Icon.edit(13)} optional>Details</FieldLabel>
            <textarea
              placeholder="Brand, condition, specs, when you need it…"
              value={form.description || ''}
              onChange={e => onFormChange?.({ description: e.target.value })}
              rows={3}
              maxLength={300}
              style={{
                width: '100%', border: `1.5px solid ${T.gray200}`, borderRadius: 12,
                padding: '12px 14px', fontSize: 13, outline: 'none',
                background: T.gray50, fontFamily: 'inherit', color: T.gray900,
                resize: 'none', lineHeight: 1.55, boxSizing: 'border-box',
              }}
            />
            <div style={{ textAlign: 'right', fontSize: 10, color: T.gray400, fontWeight: 600, marginTop: 4 }}>
              {(form.description || '').length}/300
            </div>
          </div>

          {/* Submit */}
          <button
            type="button"
            onClick={onPost}
            disabled={!canPost}
            style={{
              width: '100%',
              padding: '14px',
              border: 'none',
              borderRadius: 14,
              background: canPost
                ? `linear-gradient(135deg,${G},${T.greenD})`
                : T.gray200,
              color: canPost ? '#fff' : T.gray400,
              fontSize: 15, fontWeight: 800,
              cursor: canPost ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              boxShadow: canPost ? '0 4px 18px rgba(15,157,88,0.35)' : 'none',
              fontFamily: 'inherit',
            }}
          >
            {posting ? (
              'Posting…'
            ) : (
              <>
                {Ic.send(16)}
                Post request{isNoExpiry ? '' : isCustomDuration ? ` · ${form.customDays || '…'}d` : ` · ${durationDays}d`}
              </>
            )}
          </button>
          {!canPost && !posting && (
            <div style={{ textAlign: 'center', fontSize: 11, color: T.gray400, fontWeight: 600, marginTop: 8 }}>
              Need: title · where you stay · where you’re looking
            </div>
          )}
        </div>
      </div>
    </>
  )
}
