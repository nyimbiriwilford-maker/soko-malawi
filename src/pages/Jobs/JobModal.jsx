import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TYPE_COLORS } from './jobsConstants'
import { timeAgo, formatDeadline, daysLeft, gradientFromName, getInitials, isEmail, isPhone, isUrl, parseLines } from './jobsUtils'
import { buildChatPath } from '../../utils/chatSources'

function BulletList({ text }) {
  const lines = parseLines(text)
  if (!lines.length) return null
  return (
    <ul className="modal-bullet-list">
      {lines.map((line, i) => (
        <li key={i} className="modal-bullet-item">
          <span className="modal-bullet-dot" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  )
}

export default function JobModal({ job, savedIds, onToggleSave, onClose }) {
  const navigate = useNavigate()
  const [showApply, setShowApply] = useState(false)
  const [copied, setCopied] = useState(false)
  const [coverExpanded, setCoverExpanded] = useState(false)

  if (!job) return null

  const colors = TYPE_COLORS[job.type] || { bg: '#f0f0f0', text: '#555', dot: '#999' }
  const dl = daysLeft(job.deadline)
  const isSaved = savedIds?.includes(job.id)
  const contact = job.contact
  const posterId = job.poster_id

  function copyContact() {
    navigator.clipboard.writeText(contact).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  function messagePoster() {
    if (!posterId) return
    onClose?.()
    navigate(buildChatPath(posterId, { source: 'job', contextId: job.id }), {
      state: {
        source: 'job',
        prefillMessage: `Hi, I'm interested in the "${job.title}" role at ${job.company || 'your company'}.`,
      },
    })
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-drag-bar" />

        {/* ── Cover Image / Artwork ── */}
        {job.cover_image_url && (
          <div className={`modal-cover-wrap ${coverExpanded ? 'expanded' : ''}`}>
            <img
              src={job.cover_image_url}
              alt="Job cover"
              className="modal-cover-img"
              onClick={() => setCoverExpanded(v => !v)}
            />
            <button
              className="modal-cover-expand-btn"
              onClick={() => setCoverExpanded(v => !v)}
              title={coverExpanded ? 'Collapse' : 'Expand image'}
            >
              {coverExpanded ? '⊟' : '⊞'}
            </button>
          </div>
        )}

        {/* ── Header ── */}
        <div className="modal-header">
          {job.logo_url ? (
            <img className="modal-logo modal-logo--img" src={job.logo_url} alt={`${job.company} logo`} />
          ) : (
            <div className="modal-logo" style={{ background: gradientFromName(job.company) }}>
              {getInitials(job.company)}
            </div>
          )}
          <div className="modal-header-info">
            <div className="modal-title">{job.title}</div>
            <div className="modal-company">{job.company}</div>
            {job.address && <div className="modal-address">📍 {job.address}</div>}
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* ── Meta chips ── */}
        <div className="modal-meta">
          <span className="type-badge" style={{ background: colors.bg, color: colors.text }}>
            <span className="type-badge-dot" style={{ background: colors.dot }} />
            {job.type}
          </span>
          <span className="meta-chip">🏙️ {job.city}</span>
          {job.category && <span className="meta-chip">{job.category}</span>}
          {job.salary && <span className="meta-chip salary">💰 {job.salary}</span>}
          {job.deadline && (
            <span className={`meta-chip ${dl?.urgent ? 'urgent' : 'deadline'}`}>
              📅 {formatDeadline(job.deadline)}{dl && ` · ${dl.label}`}
            </span>
          )}
        </div>

        {/* ── OVERVIEW ── */}
        {job.overview && (
          <div className="modal-section">
            <div className="modal-section-title">Overview</div>
            <p className="modal-text">{job.overview}</p>
          </div>
        )}

        {/* ── JOB PURPOSE ── */}
        {(job.job_purpose || job.description) && (
          <div className="modal-section">
            <div className="modal-section-title">Job Purpose</div>
            {job.job_purpose && <p className="modal-text">{job.job_purpose}</p>}
            {job.description && job.description !== job.job_purpose && (
              <p className="modal-text" style={{ marginTop: job.job_purpose ? 8 : 0 }}>{job.description}</p>
            )}
          </div>
        )}

        {/* ── KEY RESPONSIBILITIES ── */}
        {job.responsibilities && (
          <div className="modal-section">
            <div className="modal-section-title">Key Responsibilities</div>
            <BulletList text={job.responsibilities} />
          </div>
        )}

        {/* ── QUALIFICATIONS ── */}
        {job.requirements && (
          <div className="modal-section">
            <div className="modal-section-title">Minimum Qualifications &amp; Experience</div>
            <BulletList text={job.requirements} />
          </div>
        )}

        {/* ── APPLICATION PROCESS ── */}
        {(contact || job.contact_name || job.contact_address) && !showApply && (
          <div className="modal-section">
            <div className="modal-section-title">Application Process</div>
            {job.contact_name && <p className="modal-text"><strong>Attn:</strong> {job.contact_name}</p>}
            {job.contact_address && (
              <div className="modal-address-block">
                {job.contact_address.split('\n').map((line, i) => <div key={i}>{line}</div>)}
              </div>
            )}
            {contact && (
              <p className="modal-text" style={{ color: 'var(--green)', fontWeight: 600, marginTop: 6 }}>
                {isEmail(contact) ? '📧' : isPhone(contact) ? '📞' : '🌐'} {contact}
              </p>
            )}
          </div>
        )}

        {/* ── DISCLAIMER ── */}
        {job.disclaimer && (
          <div className="modal-section modal-disclaimer">
            <div className="modal-section-title">⚠ Disclaimer</div>
            <p className="modal-text">{job.disclaimer}</p>
          </div>
        )}

        {/* ── Apply sheet ── */}
        {showApply && (
          <div className="apply-sheet">
            <div className="apply-sheet-header">
              <div className="apply-sheet-title">Apply for this Job</div>
              <button className="apply-sheet-close" onClick={() => setShowApply(false)}>✕</button>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 12 }}>
              Send your CV and cover letter to the contact below:
            </p>
            {(job.contact_name || job.contact_address) && (
              <div className="apply-address-block">
                {job.contact_name && <div style={{ fontWeight: 600, marginBottom: 4 }}>{job.contact_name}</div>}
                {job.contact_address && job.contact_address.split('\n').map((line, i) => (
                  <div key={i} style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{line}</div>
                ))}
              </div>
            )}
            {contact && (
              <div className="apply-contact-box">
                <div className="apply-contact-row">
                  <span className="apply-contact-icon">
                    {isEmail(contact) ? '📧' : isPhone(contact) ? '📞' : '🌐'}
                  </span>
                  <div style={{ flex: 1 }}>
                    <div className="apply-contact-label">
                      {isEmail(contact) ? 'Email Address' : isPhone(contact) ? 'Phone Number' : 'Website / Link'}
                    </div>
                    <div className="apply-contact-value">{contact}</div>
                  </div>
                  {isPhone(contact) ? (
                    <a href={`tel:${contact.replace(/\s/g, '')}`} className="apply-action-btn">Call</a>
                  ) : isUrl(contact) ? (
                    <a href={contact.startsWith('http') ? contact : `https://${contact}`} target="_blank" rel="noreferrer" className="apply-action-btn">Open</a>
                  ) : (
                    <button className={`apply-copy-btn ${copied ? 'copied' : ''}`} onClick={copyContact}>
                      {copied ? '✓ Copied!' : 'Copy'}
                    </button>
                  )}
                </div>
                {isEmail(contact) && (
                  <div className="apply-tip">
                    <span>💡</span>
                    <span>Copy the email and paste it into Gmail or your mail app to send your application.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        <div className="modal-footer">
          <span className="modal-date">Posted {timeAgo(job.created_at)}</span>
          <div className="modal-actions">
            <button className={`modal-save-btn ${isSaved ? 'saved' : ''}`} onClick={() => onToggleSave?.(job.id)}>
              {isSaved ? '🔖 Saved' : '🏷️ Save'}
            </button>
            {posterId && (
              <button
                className="modal-save-btn"
                type="button"
                onClick={messagePoster}
                title="Message the poster on SokoMw"
              >
                💬 Message
              </button>
            )}
            {(contact || job.contact_name || job.contact_address) && (
              <button className="modal-apply-btn" onClick={() => setShowApply(v => !v)}>
                {showApply ? 'Hide' : 'Apply Now →'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}