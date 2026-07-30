import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { uploadToR2, getR2Url, deleteFromR2 } from '../../lib/r2'
import { JOB_TYPES, CITIES, CATEGORIES, EMPTY_JOB_FORM } from './jobsConstants'
import { validateJobForm } from './jobsUtils'

function ImageUploadField({ label, hint, value, preview, onFileChange, onRemove, uploading, accept = 'image/*', icon = '🖼️', fieldName }) {
  const inputRef = useRef()
  return (
    <div className="img-upload-area">
      {preview || value ? (
        <div className="img-preview-wrap">
          <img src={preview || value} alt={`${label} preview`} className="img-preview-img" />
          <div className="img-preview-meta">
            <span className="img-preview-label">{label}</span>
            {uploading && <span className="img-uploading-label">⏳ Uploading…</span>}
            {!uploading && value && <span className="img-uploaded-label">✓ Uploaded</span>}
            <button className="img-remove-btn" onClick={onRemove} type="button">✕ Remove</button>
          </div>
        </div>
      ) : (
        <button type="button" className="img-upload-btn" onClick={() => inputRef.current?.click()}>
          <span className="img-upload-icon">{icon}</span>
          <span className="img-upload-text">Upload {label}</span>
          <span className="img-upload-hint">{hint}</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={onFileChange} />
    </div>
  )
}

export default function PostJobForm({ onSuccess }) {
  const [form, setForm] = useState(EMPTY_JOB_FORM)
  const [errors, setErrors] = useState({})
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const [success, setSuccess] = useState(false)

  // Logo state
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoUploading, setLogoUploading] = useState(false)

  // Cover image state
  const [coverPreview, setCoverPreview] = useState(null)
  const [coverUploading, setCoverUploading] = useState(false)

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
    if (errors[field]) setErrors(e => ({ ...e, [field]: '' }))
  }

  async function uploadImage(file, folder, setUploading, setPreview, formField) {
    const reader = new FileReader()
    reader.onload = ev => setPreview(ev.target.result)
    reader.readAsDataURL(file)

    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
    const url = await uploadToR2(file, 'job-assets/' + path)
    setUploading(false)

    if (url) {
      set(formField, url)
    }
  }

  function handleLogoChange(e) {
    const file = e.target.files?.[0]
    if (file) uploadImage(file, 'logos', setLogoUploading, setLogoPreview, 'logo_url')
  }

  function handleCoverChange(e) {
    const file = e.target.files?.[0]
    if (file) uploadImage(file, 'covers', setCoverUploading, setCoverPreview, 'cover_image_url')
  }

  function removeLogo() { setLogoPreview(null); set('logo_url', '') }
  function removeCover() { setCoverPreview(null); set('cover_image_url', '') }

  async function handlePost() {
    setPostError('')
    const errs = validateJobForm(form)
    if (Object.keys(errs).length > 0) { setErrors(errs); return }

    setPosting(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setPostError('You must be signed in to post a job.'); setPosting(false); return }

    const { error } = await supabase.from('jobs').insert({
      poster_id:       user.id,
      title:           form.title.trim(),
      company:         form.company.trim(),
      logo_url:        form.logo_url || null,
      cover_image_url: form.cover_image_url || null,
      overview:        form.overview.trim() || null,
      description:     form.description.trim(),
      job_purpose:     form.job_purpose.trim() || null,
      responsibilities:form.responsibilities.trim() || null,
      requirements:    form.requirements.trim() || null,
      salary:          form.salary.trim() || null,
      type:            form.type,
      category:        form.category || null,
      city:            form.city,
      address:         form.address.trim() || null,
      contact:         form.contact.trim() || null,
      contact_name:    form.contact_name.trim() || null,
      contact_address: form.contact_address.trim() || null,
      deadline:        form.deadline || null,
      disclaimer:      form.disclaimer.trim() || null,
      status:          'active'
    })

    setPosting(false)
    if (error) { setPostError(error.message); return }

    setSuccess(true)
    setForm(EMPTY_JOB_FORM)
    setErrors({})
    setLogoPreview(null)
    setCoverPreview(null)
    setTimeout(() => { setSuccess(false); onSuccess?.() }, 1800)
  }

  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="post-form-wrap">
      <div className="post-form-card">
        <div className="post-form-title">📢 Post a Job</div>
        <div className="post-form-sub">Reach thousands of job seekers across Malawi — it's free.</div>

        {/* ── SECTION 1: Organisation ── */}
        <div className="form-section-title">Organisation</div>

        <label className="form-label">Company / Organisation Logo</label>
        <ImageUploadField
          label="Logo"
          hint="PNG, JPG or SVG · max 2MB · square works best"
          preview={logoPreview}
          value={form.logo_url}
          onFileChange={handleLogoChange}
          onRemove={removeLogo}
          uploading={logoUploading}
          icon="🏢"
        />

        <label className="form-label">Company / Organisation Name <span className="form-required">*</span></label>
        <input
          className={`form-input ${errors.company ? 'error' : ''}`}
          placeholder="e.g. VisionFund Malawi, Airtel Malawi"
          value={form.company}
          onChange={e => set('company', e.target.value)}
        />
        {errors.company && <p className="form-error-msg">⚠ {errors.company}</p>}

        <label className="form-label">Physical Address / Location</label>
        <input
          className="form-input"
          placeholder="e.g. Head Office, Area 3, Lilongwe"
          value={form.address}
          onChange={e => set('address', e.target.value)}
        />

        <label className="form-label">Organisation Overview</label>
        <textarea
          className="form-textarea"
          rows={3}
          placeholder="Brief description of the organisation — mission, sector, what it does…"
          value={form.overview}
          onChange={e => set('overview', e.target.value)}
        />
        <p className="form-hint">Appears at the top of the listing so applicants understand the organisation context.</p>

        {/* ── SECTION 2: Position ── */}
        <div className="form-section-title">Position</div>

        <label className="form-label">Job Title <span className="form-required">*</span></label>
        <input
          className={`form-input ${errors.title ? 'error' : ''}`}
          placeholder="e.g. Internal Auditor, Software Developer, Nurse"
          value={form.title}
          onChange={e => set('title', e.target.value)}
        />
        {errors.title && <p className="form-error-msg">⚠ {errors.title}</p>}

        <div className="form-row">
          <div className="form-half">
            <label className="form-label">Job Type <span className="form-required">*</span></label>
            <select className={`form-select ${errors.type ? 'error' : ''}`} value={form.type} onChange={e => set('type', e.target.value)}>
              <option value="">Select type…</option>
              {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            {errors.type && <p className="form-error-msg">⚠ {errors.type}</p>}
          </div>
          <div className="form-half">
            <label className="form-label">Sector</label>
            <select className="form-select" value={form.category} onChange={e => set('category', e.target.value)}>
              <option value="">Select sector…</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-half">
            <label className="form-label">City <span className="form-required">*</span></label>
            <select className={`form-select ${errors.city ? 'error' : ''}`} value={form.city} onChange={e => set('city', e.target.value)}>
              <option value="">Select city…</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {errors.city && <p className="form-error-msg">⚠ {errors.city}</p>}
          </div>
          <div className="form-half">
            <label className="form-label">Salary / Rate</label>
            <input className="form-input" placeholder="e.g. MWK 200,000/mo" value={form.salary} onChange={e => set('salary', e.target.value)} />
          </div>
        </div>

        <label className="form-label">Application Deadline</label>
        <input className="form-input" type="date" min={today} value={form.deadline} onChange={e => set('deadline', e.target.value)} />
        <p className="form-hint">Leave blank if no specific deadline. The listing auto-expires after this date.</p>

        {/* ── SECTION 3: Job Purpose ── */}
        <div className="form-section-title">Job Purpose</div>

        <label className="form-label">Role Summary & Reporting Line</label>
        <textarea
          className="form-textarea" rows={3}
          placeholder="e.g. Reporting to the Internal Audit Manager, the Internal Auditor will provide independent assurance on governance, risk management, and internal controls…"
          value={form.job_purpose}
          onChange={e => set('job_purpose', e.target.value)}
        />
        <p className="form-hint">Who does this role report to? What is its primary objective?</p>

        <label className="form-label">Brief Description <span className="form-required">*</span></label>
        <textarea
          className={`form-textarea ${errors.description ? 'error' : ''}`} rows={3}
          placeholder="Short summary of what the role involves day-to-day…"
          value={form.description}
          onChange={e => set('description', e.target.value)}
        />
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          {errors.description ? <p className="form-error-msg">⚠ {errors.description}</p> : <span />}
          <span className="form-char-count">{form.description.length} chars</span>
        </div>

        {/* ── SECTION 4: Responsibilities ── */}
        <div className="form-section-title">Key Responsibilities</div>
        <label className="form-label">Responsibilities</label>
        <textarea
          className="form-textarea" rows={7}
          placeholder={"Enter each responsibility on a new line:\n- Plan and execute risk-based audit assignments\n- Review adequacy of accounting systems and internal controls\n- Conduct branch audits, client visits, and loan file reviews"}
          value={form.responsibilities}
          onChange={e => set('responsibilities', e.target.value)}
        />
        <p className="form-hint">One per line. Bullet points (- or •) are optional — auto-formatted on display.</p>

        {/* ── SECTION 5: Qualifications ── */}
        <div className="form-section-title">Minimum Qualifications & Experience</div>
        <label className="form-label">Requirements</label>
        <textarea
          className="form-textarea" rows={6}
          placeholder={"Enter each requirement on a new line:\n- Bachelor's Degree in Accounting, Finance, or related field\n- Minimum 3 years' experience in internal or external audit\n- Strong analytical and report-writing skills\n- Proficiency in Microsoft Office"}
          value={form.requirements}
          onChange={e => set('requirements', e.target.value)}
        />
        <p className="form-hint">One per line. Bullet points optional.</p>

        {/* ── SECTION 6: Application Process ── */}
        <div className="form-section-title">Application Process</div>

        <label className="form-label">Contact Person / Department</label>
        <input
          className="form-input"
          placeholder="e.g. The People, Culture & Administration Manager"
          value={form.contact_name}
          onChange={e => set('contact_name', e.target.value)}
        />

        <label className="form-label">Postal / Physical Address for Applications</label>
        <textarea
          className="form-textarea" rows={3}
          placeholder={"e.g.\nVisionFund Malawi\nPrivate Bag A231\nLilongwe, Malawi"}
          value={form.contact_address}
          onChange={e => set('contact_address', e.target.value)}
        />

        <label className="form-label">Email / Phone / Website</label>
        <input
          className="form-input"
          placeholder="e.g. recruitment@company.org  |  +265 991 234 567"
          value={form.contact}
          onChange={e => set('contact', e.target.value)}
        />
        <p className="form-hint">Primary contact for applications — email, phone, or website link.</p>

        {/* ── SECTION 7: Cover Image / Artwork ── */}
        <div className="form-section-title">
          Cover Image / Artwork
          <span className="form-section-optional">optional</span>
        </div>

        <label className="form-label">Job Poster, Flyer or Related Image</label>
        <ImageUploadField
          label="Cover Image"
          hint="PNG, JPG · max 5MB · landscape or portrait works · appears at the top of the listing"
          preview={coverPreview}
          value={form.cover_image_url}
          onFileChange={handleCoverChange}
          onRemove={removeCover}
          uploading={coverUploading}
          icon="🎨"
        />
        <p className="form-hint">Upload a job poster, company flyer, event graphic, or any related artwork. It will be shown prominently at the top of your listing.</p>

        {/* ── SECTION 8: Disclaimer ── */}
        <div className="form-section-title">
          Disclaimer
          <span className="form-section-optional">optional</span>
        </div>
        <label className="form-label">Important Notice</label>
        <textarea
          className="form-textarea" rows={3}
          placeholder="e.g. We do not charge any fees at any stage of recruitment. Only shortlisted candidates will be contacted."
          value={form.disclaimer}
          onChange={e => set('disclaimer', e.target.value)}
        />

        {/* Errors & Success */}
        {postError && <p className="form-error-banner">⚠ {postError}</p>}
        {success && <div className="form-success-banner"><span>✅</span> Job posted successfully! Redirecting…</div>}

        <button className="form-submit-btn" onClick={handlePost} disabled={posting || success}>
          {posting ? <><span className="spinner" /> Posting…</> : '📢 Post Job Listing'}
        </button>
      </div>
    </div>
  )
}