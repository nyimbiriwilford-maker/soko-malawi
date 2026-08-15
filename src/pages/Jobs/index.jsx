import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { JOB_TYPES, CITIES, CATEGORIES } from './jobsConstants'
import JobCard from './JobCard'
import JobModal from './JobModal'
import JobAlertTrigger, { JobAlertWizard } from './JobAlerts'
import SokoNav from '../../components/SokoNav'
import { Search, SlidersHorizontal, X, ChevronRight, Briefcase, Bookmark, Lock, SearchX } from 'lucide-react'
import './Jobs.css'

const TABS = [
  { id: 'browse', label: 'Browse All' },
  { id: 'saved',  label: 'Saved' },
]

export default function Jobs() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('browse')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [navUser, setNavUser] = useState(null)
  const [notifCount, setNotifCount] = useState(0)
  const [navSearch, setNavSearch] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)
  const [alertOpen, setAlertOpen] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [filterCity, setFilterCity] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterCat, setFilterCat] = useState('')

  // Saved jobs
  const [savedIds, setSavedIds] = useState(() => {
    try { return JSON.parse(localStorage.getItem('saved_jobs') || '[]') } catch { return [] }
  })

  // ── Init ────────────────────────────────────────────────
  useEffect(() => { init() }, [])

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

  const INITIAL_LIMIT = 20
  const LOAD_MORE = 10
  const [showCount, setShowCount] = useState(INITIAL_LIMIT)
  const [loadingMore, setLoadingMore] = useState(false)

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
    setShowCount(INITIAL_LIMIT)
    setLoading(false)
  }

  function loadMore() {
    setLoadingMore(true)
    setTimeout(() => {
      setShowCount(c => c + LOAD_MORE)
      setLoadingMore(false)
    }, 400)
  }

  // Open specific job via URL param
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
  const allFiltered = jobs.filter(j => {
    if (filterCity && j.city !== filterCity) return false
    if (filterType && j.type !== filterType) return false
    if (filterCat && j.category !== filterCat) return false
    if (search) {
      const q = search.toLowerCase()
      const match = j.title?.toLowerCase().includes(q) ||
                    j.company?.toLowerCase().includes(q) ||
                    j.city?.toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })

  const today = new Date().toISOString().split('T')[0]
  const savedJobs = jobs.filter(j => {
    if (!savedIds.includes(j.id)) return false
    if (j.deadline && j.deadline < today) return false
    return true
  })
  const hasActiveFilters = filterCity || filterType || filterCat || search
  const filtered = allFiltered.slice(0, showCount)
  const hasMore = showCount < allFiltered.length

  function clearFilters() {
    setSearch('')
    setFilterCity('')
    setFilterType('')
    setFilterCat('')
  }

  // Stats
  const activeCount = jobs.length
  const citiesCount = new Set(jobs.map(j => j.city)).size

  // Rotating headline words
  const rotateWords = useMemo(() => ['opportunity', 'career', 'future'], [])
  const [wordIdx, setWordIdx] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setWordIdx(i => (i + 1) % rotateWords.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [rotateWords.length])

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
        hideCta
      />

      {/* ── Hero Section ── */}
      <div className="jobs-hero">
        <div className="jobs-hero-dots" />
        <div className="jobs-hero-inner">
          <h1 className="hero-headline">
            Your next <span className="hero-headline-green" key={rotateWords[wordIdx]}>{rotateWords[wordIdx]}</span><br />
            starts here.
          </h1>

          <div className="hero-accent" />

          <p className="hero-support">
            Find verified jobs from trusted employers across Malawi. Apply directly. It's free.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button className="hero-cta" onClick={() => document.querySelector('.jobs-search-card')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>
              <Briefcase size={16} strokeWidth={2.5} />
              Browse Jobs Now
              <ChevronRight size={16} strokeWidth={2.5} />
            </button>
            <JobAlertTrigger currentUser={currentUser} onClick={() => setAlertOpen(true)} />
          </div>
        </div>
      </div>

      {/* ── Job Alert Wizard Modal ── */}
      {alertOpen && (
        <JobAlertWizard
          currentUser={currentUser}
          onClose={() => setAlertOpen(false)}
          onSave={() => {
            // Refresh the trigger badge count
            window.__jobAlertTriggerRefresh?.()
          }}
        />
      )}

      {/* ── Search Card ── */}
      <div className="jobs-controls">
        <div className="jobs-search-card">
          <div className="jobs-search-inner">
            <div className="jobs-search-icon">
              <Search size={18} strokeWidth={2.5} />
            </div>
            <input
              className="jobs-search-input"
              placeholder="Search job title, company, city..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              enterKeyHint="search"
              autoComplete="off"
            />
            {search && (
              <button className="jobs-search-clear" onClick={() => setSearch('')} aria-label="Clear search">✕</button>
            )}
          </div>

          {/* Filter chips */}
          <div className="jobs-filters">
            <select
              className={`jobs-filter-chip${filterType ? ' active' : ''}`}
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
            >
              <option value="">All types</option>
              {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select
              className={`jobs-filter-chip${filterCity ? ' active' : ''}`}
              value={filterCity}
              onChange={e => setFilterCity(e.target.value)}
            >
              <option value="">All cities</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              className={`jobs-filter-chip${filterCat ? ' active' : ''}`}
              value={filterCat}
              onChange={e => setFilterCat(e.target.value)}
            >
              <option value="">All sectors</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {hasActiveFilters && (
              <button className="jobs-filter-clear" onClick={clearFilters}>✕ Clear</button>
            )}
          </div>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="jobs-tabs-wrap">
        <div className="jobs-tabs">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              className={`jobs-tab${tab === t.id ? ' active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {t.id === 'saved' && savedJobs.length > 0 && (
                <span className="jobs-tab-badge">{savedJobs.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Results Count ── */}
      {tab === 'browse' && !loading && (
        <div className="jobs-results">
          <div className="jobs-results-count">
            <strong>{filtered.length}</strong> job{filtered.length !== 1 ? 's' : ''} found
          </div>
        </div>
      )}

      {/* ── Browse Tab ── */}
      {tab === 'browse' && (
        <div className="jobs-grid">
          {loading && [1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="job-skeleton" style={{ animationDelay: `${i * 0.08}s` }} />
          ))}

          {!loading && filtered.length === 0 && (
            <div className="jobs-empty">
              <div className="jobs-empty-icon"><SearchX size={32} strokeWidth={1.5} /></div>
              <p className="jobs-empty-title">No jobs found</p>
              <p className="jobs-empty-sub">
                {hasActiveFilters
                  ? 'Try adjusting your search or filters to find more results.'
                  : 'No active job listings yet. Check back soon!'}
              </p>
              {hasActiveFilters && (
                <button className="jobs-empty-btn" onClick={clearFilters}>Clear Filters</button>
              )}
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

          {!loading && hasMore && (
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'center', padding: '8px 0 16px' }}>
              <button
                className="jobs-empty-btn"
                onClick={loadMore}
                disabled={loadingMore}
                style={{ minWidth: 160 }}
              >
                {loadingMore ? 'Loading...' : `Show More (${allFiltered.length - showCount} left)`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Saved Tab ── */}
      {tab === 'saved' && (
        <div className="jobs-grid">
          {!currentUser ? (
            <div className="jobs-empty">
              <div className="jobs-empty-icon"><Lock size={32} strokeWidth={1.5} /></div>
              <p className="jobs-empty-title">Sign in required</p>
              <p className="jobs-empty-sub">Sign in to save and manage your favorite job listings.</p>
            </div>
          ) : savedJobs.length === 0 ? (
            <div className="jobs-empty">
              <div className="jobs-empty-icon"><Bookmark size={32} strokeWidth={1.5} /></div>
              <p className="jobs-empty-title">No saved jobs yet</p>
              <p className="jobs-empty-sub">Tap the bookmark icon on any job to save it for later.</p>
              <button className="jobs-empty-btn" onClick={() => setTab('browse')}>Browse Jobs</button>
            </div>
          ) : (
            savedJobs.map((job, i) => (
              <JobCard
                key={job.id}
                job={job}
                index={i}
                savedIds={savedIds}
                onToggleSave={toggleSave}
                onClick={setSelectedJob}
              />
            ))
          )}
        </div>
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
    </div>
  )
}
