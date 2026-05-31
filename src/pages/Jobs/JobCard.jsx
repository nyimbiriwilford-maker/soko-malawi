import { TYPE_COLORS, CATEGORY_ICONS } from './jobsConstants'
import { timeAgo, daysLeft, gradientFromName, getInitials } from './jobsUtils'

export default function JobCard({ job, index, savedIds, onToggleSave, onClick }) {
  const colors = TYPE_COLORS[job.type] || { bg: '#f0f0f0', text: '#555', dot: '#999' }
  const dl = daysLeft(job.deadline)
  const isSaved = savedIds?.includes(job.id)
  const catIcon = CATEGORY_ICONS[job.category] || '📋'

  return (
    <div
      className="job-card"
      style={{ animationDelay: `${index * 0.04}s` }}
      onClick={() => onClick(job)}
    >
      {/* Cover image banner — shown if present */}
      {job.cover_image_url && (
        <div className="job-card-cover">
          <img src={job.cover_image_url} alt="Job cover" className="job-card-cover-img" />
        </div>
      )}

      {/* Header row */}
      <div className="job-card-top">
        {job.logo_url ? (
          <img className="job-card-logo job-card-logo--img" src={job.logo_url} alt={`${job.company} logo`} />
        ) : (
          <div className="job-card-logo" style={{ background: gradientFromName(job.company) }}>
            {getInitials(job.company)}
          </div>
        )}

        <div className="job-card-info">
          <div className="job-card-title">{job.title}</div>
          <div className="job-card-company">{job.company}</div>
          {job.address && <div className="job-card-address">📍 {job.address}</div>}
        </div>

        <button
          className="job-bookmark-btn"
          onClick={e => { e.stopPropagation(); onToggleSave?.(job.id) }}
          title={isSaved ? 'Remove bookmark' : 'Save job'}
        >
          {isSaved ? '🔖' : '🏷️'}
        </button>
      </div>

      {/* Meta chips */}
      <div className="job-card-meta">
        <span className="type-badge" style={{ background: colors.bg, color: colors.text }}>
          <span className="type-badge-dot" style={{ background: colors.dot }} />
          {job.type}
        </span>
        <span className="meta-chip">🏙️ {job.city}</span>
        {job.category && <span className="meta-chip">{catIcon} {job.category}</span>}
        {job.salary && <span className="meta-chip salary">💰 {job.salary}</span>}
        {dl && <span className={`meta-chip ${dl.urgent ? 'urgent' : 'deadline'}`}>⏰ {dl.label}</span>}
      </div>

      {/* Preview text */}
      <p className="job-card-desc">{job.overview || job.description}</p>

      {/* Footer */}
      <div className="job-card-footer">
        <span className="job-card-date">{timeAgo(job.created_at)}</span>
        <span className="job-card-cta">View details →</span>
      </div>
    </div>
  )
}