import { useRef } from 'react'
import { T } from '../../constants/tokens'
import { CATEGORIES, URGENCY_OPTIONS } from '../../constants/lookingFor'
import { Icon } from './Icons'
import { ComposerField } from './Primitives'

/**
 * RequestComposer — slide-up bottom sheet for posting a new buyer request.
 *
 * Props:
 *   open            bool
 *   onClose         () => void
 *   form            { title, category, budget, description, urgency }
 *   onFormChange    (patch) => void
 *   imagePreview    string | null
 *   onImageChange   (file, previewUrl) => void
 *   onImageClear    () => void
 *   selectedCities  string[]
 *   onAddCity       (city) => void
 *   onRemoveCity    (city) => void
 *   dbCities        string[]
 *   citySearch      string
 *   onCitySearch    (val) => void
 *   detectingCity   bool
 *   posting         bool
 *   onPost          () => void
 */
export default function RequestComposer({
  open,
  onClose,
  form,
  onFormChange,
  images,
  coverIndex,
  onImageChange,
  onImageRemove,
  onSetCover,
  selectedCities,
  onAddCity,
  onRemoveCity,
  dbCities,
  citySearch,
  onCitySearch,
  detectingCity,
  posting,
  onPost,
}) {
 const fileRef = useRef()

function handleFileChange(e) {
  const files = Array.from(e.target.files)
  if (!files.length) return
  onImageChange(files)
}
  return (
    <>
      {/* Backdrop */}
      {open && <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }} />}

      {/* Sheet */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 401, transform: open ? 'translateY(0)' : 'translateY(110%)', transition: 'transform 0.38s cubic-bezier(0.32,0.72,0,1)', background: T.white, borderRadius: '24px 24px 0 0', boxShadow: '0 -6px 40px rgba(0,0,0,0.18)', maxHeight: '92vh', overflowY: 'auto' }}>
        {/* Drag handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 2px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.gray200 }} />
        </div>

        {/* Sheet header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 20px 14px', borderBottom: `1px solid ${T.gray100}` }}>
          <div style={{ fontFamily: T.fontDisplay, fontSize: 16, fontWeight: 800, color: T.gray900 }}>Post a Request</div>
          <button onClick={onClose} style={{ background: T.gray100, border: 'none', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 14, color: T.gray600, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {Icon.x(13)}
          </button>
        </div>

        <div style={{ padding: '16px 20px 32px' }}>
          {/* Image upload */}
          <div style={{ marginBottom: 16 }}>
            {/* Upload button */}
            <div
              onClick={() => fileRef.current?.click()}
              style={{ width: '100%', height: images.length ? 72 : 100, borderRadius: 14, border: `1.5px dashed ${T.gray200}`, background: T.gray50, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginBottom: images.length ? 10 : 0 }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: 20, marginBottom: 2 }}>📎</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: T.gray600 }}>Add reference photos</div>
                <div style={{ fontSize: 10.5, color: T.gray400, marginTop: 2 }}>optional · up to 5 images</div>
              </div>
            </div>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={handleFileChange} />

            {/* Thumbnails */}
            {images.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {images.map((img, i) => (
                  <div key={i} style={{ position: 'relative', width: 80, height: 80, borderRadius: 10, overflow: 'hidden', border: coverIndex === i ? `2.5px solid ${T.green}` : `2px solid ${T.gray200}` }}>
                    <img src={img.preview} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />

                    {/* Cover badge */}
                    {coverIndex === i && (
                      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(34,197,94,0.85)', fontSize: 9, fontWeight: 800, color: '#fff', textAlign: 'center', padding: '2px 0' }}>
                        COVER
                      </div>
                    )}

                    {/* Set cover button */}
                    {coverIndex !== i && (
                      <button
                        onClick={() => onSetCover(i)}
                        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', fontSize: 9, fontWeight: 700, cursor: 'pointer', padding: '3px 0' }}
                      >
                        Set cover
                      </button>
                    )}

                    {/* Remove button */}
                    <button
                      onClick={() => onImageRemove(i)}
                      style={{ position: 'absolute', top: 4, right: 4, background: 'rgba(0,0,0,0.6)', border: 'none', color: '#fff', width: 20, height: 20, borderRadius: '50%', fontSize: 10, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >
                      {Icon.x(9)}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Title */}
          <ComposerField label="What are you looking for?">
            <input className="lf-input" placeholder="e.g. Second-hand Samsung A15" value={form.title} onChange={e => onFormChange({ title: e.target.value })} />
          </ComposerField>

          {/* Budget + Category */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <ComposerField label="Budget (MK)">
              <input className="lf-input" type="number" placeholder="e.g. 150,000" value={form.budget} onChange={e => onFormChange({ budget: e.target.value })} />
            </ComposerField>
            <ComposerField label="Category">
              <div style={{ position: 'relative' }}>
                <select className="lf-select" value={form.category} onChange={e => onFormChange({ category: e.target.value })}>
                  {CATEGORIES.filter(c => c !== 'All').map(c => <option key={c}>{c}</option>)}
                </select>
                <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none', color: T.gray400 }}>
                  {Icon.chevD(12)}
                </span>
              </div>
            </ComposerField>
          </div>

          {/* Urgency */}
          <ComposerField label="How soon?">
            <div style={{ display: 'flex', gap: 8 }}>
              {URGENCY_OPTIONS.map(({ value, label, color, bg, border }) => (
                <button
                  key={value}
                  onClick={() => onFormChange({ urgency: value })}
                  style={{ flex: 1, background: form.urgency === value ? bg : T.gray50, border: `1.5px solid ${form.urgency === value ? border : T.gray200}`, borderRadius: 10, padding: '9px 4px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', color: form.urgency === value ? color : T.gray400, transition: 'all 0.15s' }}
                >
                  {label}
                </button>
              ))}
            </div>
          </ComposerField>

          {/* Cities */}
          <ComposerField label="Cities">
            {detectingCity && <div style={{ fontSize: 11, color: T.green, marginBottom: 6, fontWeight: 600 }}>Detecting location…</div>}
            {selectedCities.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {selectedCities.map(city => (
                  <div key={city} style={{ background: T.gray900, color: '#fff', borderRadius: 50, padding: '4px 11px', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {city}
                    <button onClick={() => onRemoveCity(city)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: 14, padding: 0, display: 'flex', alignItems: 'center' }}>
                      {Icon.x(11)}
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input className="lf-input" placeholder="Search or type city…" value={citySearch} onChange={e => onCitySearch(e.target.value)} />
            {citySearch.trim() && (
              <div style={{ background: T.white, border: `1px solid ${T.gray200}`, borderRadius: 12, maxHeight: 140, overflowY: 'auto', marginTop: 4, boxShadow: T.shadowMd }}>
                {[
                  ...dbCities.filter(c => c.toLowerCase().includes(citySearch.toLowerCase()) && !selectedCities.includes(c)),
                  ...(!dbCities.some(c => c.toLowerCase() === citySearch.toLowerCase()) && citySearch.trim() ? [citySearch.trim()] : []),
                ].slice(0, 6).map(city => (
                  <div
                    key={city}
                    onClick={() => { onAddCity(city); onCitySearch('') }}
                    style={{ padding: '10px 14px', fontSize: 13, cursor: 'pointer', borderBottom: `1px solid ${T.gray50}`, color: T.gray900, fontWeight: 500 }}
                  >
                    {Icon.pin(12)} {city}
                  </div>
                ))}
              </div>
            )}
          </ComposerField>

          {/* Description */}
          <ComposerField label="Description">
            <textarea
              className="lf-input"
              placeholder="Describe exactly what you need — brand, condition, specs…"
              value={form.description}
              onChange={e => onFormChange({ description: e.target.value })}
              rows={3}
              maxLength={300}
              style={{ resize: 'none', lineHeight: 1.6 }}
            />
          </ComposerField>

          {/* Submit */}
          <button
            onClick={onPost}
            disabled={!form.title.trim() || posting}
            className="lf-btn-primary"
            style={{ width: '100%', padding: '13px', fontSize: 14.5, borderRadius: 14, opacity: form.title.trim() ? 1 : 0.5, justifyContent: 'center' }}
          >
            {posting ? 'Posting…' : 'Post Request'}
          </button>
        </div>
      </div>
    </>
  )
}