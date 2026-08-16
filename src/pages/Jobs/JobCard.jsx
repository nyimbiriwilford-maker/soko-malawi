import { TYPE_COLORS, CATEGORY_ICONS } from './jobsConstants'
import { timeAgo, daysLeft, gradientFromName, getInitials } from './jobsUtils'

export default function JobCard({ job, index, savedIds, onToggleSave, onClick }) {
  const colors = TYPE_COLORS[job.type] || { bg: '#f0f0f0', text: '#555', dot: '#999' }
  const dl = daysLeft(job.deadline)
  const isSaved = savedIds?.includes(job.id)
  const catIcon = CATEGORY_ICONS[job.category] || '📋'

  return (
    <article
      className="job-card"
      style={{ animationDelay: `${index * 0.05}s` }}
      onClick={() => onClick(job)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick(job)
        }
      }}
      aria-label={`Open job details for ${job.title || 'job'}`}
    >
      <div className="job-card-media" aria-hidden="true">
        {job.cover_image_url ? (
          <img src={job.cover_image_url} alt="" className="job-card-media-img" />
        ) : job.logo_url ? (
          <img src={job.logo_url} alt="" className="job-card-media-logo" />
        ) : (
          <div className="job-card-media-fallback" style={{ background: gradientFromName(job.company) }}>
            {getInitials(job.company)}
          </div>
        )}
      </div>

      <div className="job-card-main">
        <div className="job-card-top">
          <div className="job-card-info">
            <div className="job-card-title">{job.title}</div>
            <div className="job-card-company">{job.company}</div>
            {job.address && <div className="job-card-address">📍 {job.address}</div>}
          </div>

          <button
            type="button"
            className={`job-bookmark-btn${isSaved ? ' saved' : ''}`}
            onClick={e => { e.stopPropagation(); onToggleSave?.(job.id) }}
            title={isSaved ? 'Remove bookmark' : 'Save job'}
            aria-label={isSaved ? 'Remove bookmark' : 'Save job'}
          >
            {isSaved ? '🔖' : '🏷️'}
          </button>
        </div>

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

        <p className="job-card-desc">{job.overview || job.description}</p>

        <div className="job-card-footer">
          <span className="job-card-date">{timeAgo(job.created_at)}</span>
          <span className="job-card-cta">View details →</span>
        </div>
      </div>
    </article>
  )
}
