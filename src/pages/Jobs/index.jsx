import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { JOB_TYPES, CITIES, CATEGORIES } from './jobsConstants'
import JobCard from './JobCard'
import JobModal from './JobModal'
import PostJobForm from './PostJobForm'
import MyJobs from './MyJobs'
import JobAlerts from './JobAlerts'
import SokoNav from '../../components/SokoNav'
import './Jobs.css'

const TABS = [
  { id: 'browse', label: 'Browse' },
  { id: 'post',   label: 'Post Job' },
  { id: 'saved',  label: 'Saved' },
  { id: 'mine',   label: 'My Listings' },
]

export default function Jobs() {
  const navigate = useNavigate()
  const [tab, setTab] = useState(() => new URLSearchParams(window.location.search).get('tab') || 'browse')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [navUser, setNavUser] = useState(null)
  const [notifCount, setNotifCount] = useState(0)
  const [navSearch, setNavSearch] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)

  // Filters
  const [search, setSearch] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterCat, setFilterCat] = useState('')

  // Saved jobs (stored in localStorage for quick access, synced with DB if user is logged in)
  const [savedIds, setSavedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('saved_jobs') || '[]') } catch { return [] }
  })

  // ── Init ────────────────────────────────────────────────
  useEffect(() => {
    init()
  }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    await loadJobs()
    if (user) {
      loadNavProfile(user)
      loadSavedFromDB(user.id)
    }
  }

  async function loadNavProfile(user) {
    const [{ data: profile }, { data: shop }, { count }] = await Promise.all([
      supabase.from('profiles').select('full_name, avatar_url, account_type').eq('id', user.id).maybeSingle(),
      supabase.from('shops').select('slug').eq('owner_id', user.id).maybeSingle(),
      supabase.from('notifications').select('*', { count: 'exact', head: true }).eq('user_id', user.id).eq('read', false),
    ])
    setNavUser({
      ...user,
      full_name: profile?.full_name || null,
      avatar_url: profile?.avatar_url || null,
      account_type: profile?.account_type,
      shop_slug: shop?.slug || null,
    })
    setNotifCount(count || 0)
  }

  async function loadJobs() {
    setLoading(true)
    const today = new Date().toISOString().split('T')[0]
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'active')
      .or(`deadline.is.null,deadline.gte.${today}`)
      .order('created_at', { ascending: false })
    setJobs(data || [])
    setLoading(false)
  }

  // Open a specific job modal when arriving via a job_match notification
  // (/jobs?job_id=…). Runs once after the list has loaded.
  const openedJobRef = useRef(false)
  useEffect(() => {
    if (openedJobRef.current) return
    const jobId = new URLSearchParams(window.location.search).get('job_id')
    if (!jobId) return
    openedJobRef.current = true
    const target = jobs.find(j => j.id === jobId)
    if (target) setTimeout(() => setSelectedJob(target), 0)
  }, [jobs])

  async function loadSavedFromDB(uid) {
    const { data } = await supabase
      .from('saved_jobs')
      .select('job_id')
      .eq('user_id', uid)
    if (data) {
      const ids = data.map(r => r.job_id)
      setSavedIds(ids)
      localStorage.setItem('saved_jobs', JSON.stringify(ids))
    }
  }

  // ── Toggle Save ─────────────────────────────────────────
  async function toggleSave(jobId) {
    const isSaved = savedIds.includes(jobId)
    const next = isSaved ? savedIds.filter(id => id !== jobId) : [...savedIds, jobId]
    setSavedIds(next)
    localStorage.setItem('saved_jobs', JSON.stringify(next))

    if (currentUser) {
      if (isSaved) {
        await supabase.from('saved_jobs').delete()
          .eq('user_id', currentUser.id).eq('job_id', jobId)
      } else {
       await supabase.from('saved_jobs').upsert(
  { user_id: currentUser.id, job_id: jobId },
  { onConflict: 'user_id,job_id', ignoreDuplicates: true }
)
      }
    }
  }

  // ── Filter ──────────────────────────────────────────────
  const filtered = jobs.filter(j => {
    if (filterCity && j.city !== filterCity) return false
    if (filterType && j.type !== filterType) return false
    if (filterCat && j.category !== filterCat) return false
    if (search) {
      const q = search.toLowerCase()
      const match = j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q) || j.city.toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

  const savedJobs = jobs.filter(j => savedIds.includes(j.id))

  const hasActiveFilters = filterCity || filterType || filterCat || search

  function clearFilters() {
    setSearch('')
    setFilterCity('')
    setFilterType('')
    setFilterCat('')
  }

  // ─────────────────────────────────────────────────────────
  return (
    <div className="jobs-page">
      <SokoNav
        user={navUser}
        notifCount={notifCount}
        search={navSearch}
        setSearch={setNavSearch}
        navigate={navigate}
        activePillar="jobs"
        ctaLabel="Post Job"
        onCta={() => setTab('post')}
      />

      {/* ── Sub-header + tabs ── */}
      <div className="jobs-header">
        <div className="jobs-header-inner">
          <div className="jobs-header-top">
            <div style={{ minWidth: 0 }}>
              <h1 className="jobs-header-title">Jobs</h1>
              <div className="jobs-header-sub">
                {loading ? 'Loading…' : `${jobs.length} open position${jobs.length !== 1 ? 's' : ''} across Malawi`}
              </div>
            </div>
            <button
              type="button"
              className="jobs-post-btn"
              onClick={() => setTab(tab === 'post' ? 'browse' : 'post')}
            >
              {tab === 'post' ? '← Back' : '+ Post Job'}
            </button>
          </div>

          <div className="jobs-tabs">
            {TABS.map(t => (
              <button
                key={t.id}
                type="button"
                className={`jobs-tab ${tab === t.id ? 'active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {t.id === 'saved' && savedIds.length > 0 && (
                  <span className="jobs-tab-badge">{savedIds.length}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── BROWSE TAB ── */}
      {tab === 'browse' && (
        <div className="jobs-browse-body">
          <div className="jobs-search-wrap">
            <div className="jobs-search-box">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="2.5" strokeLinecap="round">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                placeholder="Search job title, company, city…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                enterKeyHint="search"
                autoComplete="off"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, padding: '0 2px' }}
                  aria-label="Clear search"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          <div className="jobs-filter-row">
            <select
              className={`jobs-filter-select ${filterType ? 'active' : ''}`}
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="">All types</option>
              {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              className={`jobs-filter-select ${filterCity ? 'active' : ''}`}
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
            >
              <option value="">All cities</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              className={`jobs-filter-select ${filterCat ? 'active' : ''}`}
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
            >
              <option value="">All sectors</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {hasActiveFilters && (
              <button
                type="button"
                className="jobs-filter-select"
                onClick={clearFilters}
                style={{ color: 'var(--red)', borderColor: '#fad0ca', background: 'var(--red-bg)', paddingRight: 12 }}
              >
                ✕ Clear
              </button>
            )}
          </div>

          {!loading && (
            <div className="jobs-results-count">
              {filtered.length === jobs.length
                ? `${filtered.length} jobs found`
                : `${filtered.length} of ${jobs.length} jobs`}
            </div>
          )}

          <div className="jobs-list">
            {loading && [1, 2, 3].map(i => <div key={i} className="job-skeleton" />)}

            {!loading && filtered.length === 0 && (
              <div className="jobs-empty">
                <div className="jobs-empty-icon">🔍</div>
                <p className="jobs-empty-title">No jobs found</p>
                <p className="jobs-empty-sub">
                  {hasActiveFilters
                    ? 'Try adjusting your search or filters to find more results.'
                    : 'No active listings yet. Be the first to post!'}
                </p>
                {hasActiveFilters
                  ? <button type="button" className="jobs-empty-btn" onClick={clearFilters}>Clear Filters</button>
                  : <button type="button" className="jobs-empty-btn" onClick={() => setTab('post')}>Post a Job</button>
                }
              </div>
            )}

            {!loading && filtered.map((job, i) => (
              <JobCard
                key={job.id}
                job={job}
                index={i}
                savedIds={savedIds}
                onToggleSave={toggleSave}
                onClick={setSelectedJob}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── POST TAB ── */}
      {tab === 'post' && (
        <PostJobForm
          onSuccess={() => {
            loadJobs()
            setTab('browse')
          }}
        />
      )}

      {/* ── SAVED TAB ── */}
      {tab === 'saved' && (
        <>
          <div style={{ padding: '14px 14px 8px' }}>
            <p style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
              {savedIds.length} saved job{savedIds.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="jobs-list">
            {savedJobs.length === 0 && (
              <div className="jobs-empty">
                <div className="jobs-empty-icon">🔖</div>
                <p className="jobs-empty-title">No saved jobs yet</p>
                <p className="jobs-empty-sub">Tap the 🏷️ icon on any job to bookmark it for later.</p>
                <button className="jobs-empty-btn" onClick={() => setTab('browse')}>Browse Jobs</button>
              </div>
            )}
            {savedJobs.map((job, i) => (
              <JobCard
                key={job.id}
                job={job}
                index={i}
                savedIds={savedIds}
                onToggleSave={toggleSave}
                onClick={setSelectedJob}
              />
            ))}
          </div>
        </>
      )}

      {/* ── MY LISTINGS TAB ── */}
      {tab === 'mine' && (
        <>
          <JobAlerts currentUser={currentUser} />
          <MyJobs
            currentUser={currentUser}
            onViewJob={setSelectedJob}
          />
        </>
      )}

      {/* ── Job Detail Modal ── */}
      {selectedJob && (
        <JobModal
          job={selectedJob}
          savedIds={savedIds}
          onToggleSave={toggleSave}
          onClose={() => setSelectedJob(null)}
        />
      )}

      {/* ── Bottom Nav ── */}
    </div>
  )
}