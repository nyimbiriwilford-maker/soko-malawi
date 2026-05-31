import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { TYPE_COLORS } from './jobsConstants'
import { timeAgo, formatDeadline, gradientFromName, getInitials } from './jobsUtils'

export default function MyJobs({ currentUser, onViewJob }) {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [closing, setClosing] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  useEffect(() => {
    if (currentUser) loadMyJobs()
  }, [currentUser])

  async function loadMyJobs() {
    setLoading(true)
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .eq('poster_id', currentUser.id)
      .order('created_at', { ascending: false })
    setJobs(data || [])
    setLoading(false)
  }

  async function closeJob(id) {
    setClosing(id)
    await supabase.from('jobs').update({ status: 'closed' }).eq('id', id)
    setJobs(j => j.map(job => job.id === id ? { ...job, status: 'closed' } : job))
    setClosing(null)
  }

  async function reactivateJob(id) {
    await supabase.from('jobs').update({ status: 'active' }).eq('id', id)
    setJobs(j => j.map(job => job.id === id ? { ...job, status: 'active' } : job))
  }

  async function deleteJob(id) {
    setDeleting(id)
    await supabase.from('jobs').delete().eq('id', id)
    setJobs(j => j.filter(job => job.id !== id))
    setDeleting(null)
    setConfirmDelete(null)
  }

  if (!currentUser) {
    return (
      <div className="my-jobs-wrap">
        <div className="my-jobs-empty">
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔒</div>
          <p style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 6 }}>Sign in required</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>Sign in to manage your job listings.</p>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="my-jobs-wrap">
        {[1,2].map(i => <div key={i} className="job-skeleton" style={{ marginBottom: 10 }} />)}
      </div>
    )
  }

  if (jobs.length === 0) {
    return (
      <div className="my-jobs-wrap">
        <div className="my-jobs-empty">
          <div style={{ fontSize: 44, marginBottom: 12 }}>📋</div>
          <p style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: 16, marginBottom: 6 }}>No listings yet</p>
          <p style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.6 }}>
            You haven't posted any jobs. Switch to the Post tab to create your first listing.
          </p>
        </div>
      </div>
    )
  }

  const activeJobs = jobs.filter(j => j.status === 'active')
  const closedJobs = jobs.filter(j => j.status !== 'active')

  return (
    <div className="my-jobs-wrap">
      {/* Summary banner */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-md)',
        padding: '14px 16px',
        marginBottom: 16,
        display: 'flex',
        gap: 20,
      }}>
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--green)' }}>{activeJobs.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 2 }}>Active</div>
        </div>
        <div style={{ width: 1, background: 'var(--border)' }} />
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text-primary)' }}>{jobs.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 2 }}>Total</div>
        </div>
        <div style={{ width: 1, background: 'var(--border)' }} />
        <div style={{ textAlign: 'center', flex: 1 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--orange)' }}>{closedJobs.length}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', marginTop: 2 }}>Closed</div>
        </div>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <div style={{
          background: 'var(--red-bg)',
          border: '1.5px solid #fad0ca',
          borderRadius: 12,
          padding: '14px 16px',
          marginBottom: 12,
        }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--red)', marginBottom: 10 }}>
            ⚠ Delete this job listing permanently?
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              className="my-job-btn delete"
              style={{ flex: 1 }}
              onClick={() => deleteJob(confirmDelete)}
              disabled={deleting === confirmDelete}
            >
              {deleting === confirmDelete ? 'Deleting…' : 'Yes, Delete'}
            </button>
            <button
              className="my-job-btn view"
              style={{ flex: 1 }}
              onClick={() => setConfirmDelete(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {jobs.map((job, i) => {
        const colors = TYPE_COLORS[job.type] || { bg: '#f0f0f0', text: '#555', dot: '#999' }
        const isActive = job.status === 'active'

        return (
          <div
            key={job.id}
            className="my-job-item"
            style={{
              animationDelay: `${i * 0.05}s`,
              opacity: isActive ? 1 : 0.7,
            }}
          >
            <div className="my-job-header">
              <div
                className="job-card-logo"
                style={{ background: gradientFromName(job.company), width: 38, height: 38, borderRadius: 9, fontSize: 14 }}
              >
                {getInitials(job.company)}
              </div>
              <div className="my-job-info">
                <div className="my-job-title">{job.title}</div>
                <div className="my-job-company">{job.company} · {job.city}</div>
              </div>
              <span
                className="type-badge"
                style={{
                  background: isActive ? colors.bg : '#f0f0f0',
                  color: isActive ? colors.text : '#999',
                }}
              >
                {isActive ? '● Active' : '○ Closed'}
              </span>
            </div>

            {/* Meta */}
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <span>📅 Posted {timeAgo(job.created_at)}</span>
              {job.deadline && <span>⏰ Deadline: {formatDeadline(job.deadline)}</span>}
            </div>

            {/* Actions */}
            <div className="my-job-actions">
              <button className="my-job-btn view" onClick={() => onViewJob(job)}>👁 Preview</button>
              {isActive
                ? (
                  <button
                    className="my-job-btn close"
                    onClick={() => closeJob(job.id)}
                    disabled={closing === job.id}
                  >
                    {closing === job.id ? '…' : '⏸ Close'}
                  </button>
                )
                : (
                  <button className="my-job-btn view" onClick={() => reactivateJob(job.id)}>
                    ▶ Reactivate
                  </button>
                )
              }
              <button
                className="my-job-btn delete"
                onClick={() => setConfirmDelete(job.id)}
              >
                🗑 Delete
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}