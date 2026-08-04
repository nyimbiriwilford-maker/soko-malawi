import { useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { uploadToR2, getR2Url, deleteFromR2 } from '../../lib/r2'
import { invokeApi } from '../../lib/apiServer'
import { JOB_TYPES, CITIES, CATEGORIES, EMPTY_JOB_FORM } from './jobsConstants'
import { validateJobForm } from './jobsUtils'

async function runJobAiFollowUps(jobId, fields) {
  try {
    const { data: tags, error: tagError } = await invokeApi('tag-job', {
      body: {
        title: fields.title || '',
        overview: fields.overview || '',
        description: fields.description || '',
        requirements: fields.requirements || '',
      },
    })
    if (tagError || !tags) {
      console.warn('[job-ai] tag-job skipped:', tagError?.message || 'no tags returned')
      return
    }
    await supabase
      .from('jobs')
      .update({
        required_skills: Array.isArray(tags.required_skills) ? tags.required_skills : [],
        sector: tags.sector || null,
        experience_level: tags.experience_level || null,
      })
      .eq('id', jobId)
      .eq('poster_id', fields.poster_id)

    invokeApi('match-job-alerts', { body: { job_id: jobId } })
      .then(r => { if (r.error) console.warn('[job-ai] match-job-alerts warn:', r.error.message) })
      .catch(err => console.warn('[job-ai] match-job-alerts failed:', err.message))
  } catch (err) {
    console.warn('[job-ai] background tagging failed (job still posted):', err.message)
  }
}

const JOB_FORM_KEYS = Object.keys(EMPTY_JOB_FORM)

// Only keep keys that exist in EMPTY_JOB_FORM and coerce all values to strings,
// so an unexpected Gemini shape can never break the form.
function pickJobFields(data) {
  const out = {}
  if (!data || typeof data !== 'object') return out
  for (const k of JOB_FORM_KEYS) {
    if (Object.prototype.hasOwnProperty.call(data, k)) {
      out[k] = String(data[k] ?? '')
    }
  }
  return out
}

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

  // AI "generate from text" state
  const [aiOpen, setAiOpen] = useState(false)
  const [aiText, setAiText] = useState('')
  const [aiBusy, setAiBusy] = useState(false)
  const [aiError, setAiError] = useState('')

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

  async function handleGenerate() {
    setAiError('')
    if (!aiText.trim()) { setAiError('Paste some raw job text first.'); return }

    const hasContent = Object.keys(form).some(k => typeof form[k] === 'string' && form[k].trim())
    if (hasContent && !window.confirm('This will replace your current draft with the generated job. Continue?')) return

    setAiBusy(true)
    try {
      const { data, error } = await invokeApi('generate-job-ad', {
        body: { rawText: aiText.trim() },
      })
      if (error) throw new Error(error.message || 'Failed to generate the job.')
      const picked = pickJobFields(data)
      if (Object.keys(picked).length === 0) throw new Error('No usable fields were generated.')
      setForm({ ...EMPTY_JOB_FORM, ...picked })
      setErrors({})
    } catch (err) {
      console.error('[job-ai] generate failed:', err)
      setAiError(err.message || 'Failed to generate the job. Please try again.')
    } finally {
      setAiBusy(false)
    }
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

    const { data: newJob, error } = await supabase.from('jobs').insert({
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
    }).select('id').single()

    setPosting(false)
    if (error) { setPostError(error.message); return }

    // Non-blocking AI follow-up: tag the job, then fire-and-forget CV matching.
    // The job is already live — a slow or failed tag must never block posting.
    if (newJob?.id) {
      runJobAiFollowUps(newJob.id, {
        poster_id:   user.id,
        title:       form.title,
        overview:    form.overview,
        description: form.description,
        requirements: form.requirements,
      })
    }

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

        {/* ── AI Generate from text ── */}
        <div className="post-form-ai">
          <button
            type="button"
            className="post-form-ai-toggle"
            onClick={() => setAiOpen(o => !o)}
          >
            <span>✨ Generate from text</span>
            <span>{aiOpen ? '▾' : '▸'}</span>
          </button>
          {aiOpen && (
            <div className="post-form-ai-panel">
              <p className="form-hint">
                Paste raw text (an advert, email or notes) and we'll structure it into the form below.
                Review and edit it, then click Post like normal — nothing is submitted automatically.
              </p>
              <textarea
                className="form-textarea"
                rows={4}
                placeholder="Paste job text here…"
                value={aiText}
                onChange={e => setAiText(e.target.value)}
              />
              {aiError && <p className="form-char-count" style={{ color: 'var(--red)' }}>⚠ {aiError}</p>}
              <button type="button" className="job-ai-gen-btn" onClick={handleGenerate} disabled={aiBusy}>
                {aiBusy ? <><span className="spinner" /> Generating…</> : '✨ Generate'}
              </button>
            </div>
          )}
        </div>

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