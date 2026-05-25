import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const JOB_TYPES = ['Full-time', 'Part-time', 'Contract', 'Internship', 'Volunteer']
const CITIES = ['Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Kasungu', 'Mangochi', 'Karonga', 'Salima']
const CATEGORIES = ['Technology', 'Education', 'Health', 'Finance', 'Agriculture', 'Construction', 'Transport', 'Hospitality', 'NGO', 'Other']

export default function Jobs() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('browse')
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentUser, setCurrentUser] = useState(null)
  const [filterCity, setFilterCity] = useState('')
  const [filterType, setFilterType] = useState('')
  const [filterCat, setFilterCat] = useState('')
  const [search, setSearch] = useState('')
  const [selectedJob, setSelectedJob] = useState(null)
  const [showApply, setShowApply] = useState(false)
  const [copied, setCopied] = useState(false)
  const [form, setForm] = useState({ title: '', company: '', description: '', requirements: '', salary: '', type: '', category: '', city: '', contact: '', deadline: '' })
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState('')
  const [postSuccess, setPostSuccess] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)

  useEffect(() => { init() }, [])

  async function init() {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)
    await loadJobs()
    if (user) loadUnread(user.id)
  }

  async function loadUnread(uid) {
    const { count } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('to_user', uid)
      .eq('read', false)
    setUnreadCount(count || 0)
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

  function set(field, value) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handlePost() {
    setPostError('')
    if (!form.title || !form.company || !form.description || !form.type || !form.city) {
      setPostError('Please fill in title, company, description, type, and city')
      return
    }
    setPosting(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('jobs').insert({
      poster_id: user.id,
      title: form.title,
      company: form.company,
      description: form.description,
      requirements: form.requirements,
      salary: form.salary,
      type: form.type,
      category: form.category,
      city: form.city,
      contact: form.contact,
      deadline: form.deadline || null,
      status: 'active'
    })
    setPosting(false)
    if (error) { setPostError(error.message); return }
    setPostSuccess(true)
    setForm({ title: '', company: '', description: '', requirements: '', salary: '', type: '', category: '', city: '', contact: '', deadline: '' })
    await loadJobs()
    setTimeout(() => { setPostSuccess(false); setTab('browse') }, 1500)
  }

  function closeJob() {
    setSelectedJob(null)
    setShowApply(false)
    setCopied(false)
  }

  function copyContact(text) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  function isEmail(c) { return c.includes('@') }
  function isPhone(c) { return !!c.match(/^\+?[\d\s\-()]+$/) }
  function isUrl(c) { return c.startsWith('http') || c.startsWith('www.') }

  function daysLeft(deadline) {
    if (!deadline) return null
    const diff = new Date(deadline) - new Date()
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24))
    if (days < 0) return null
    if (days === 0) return 'Closes today'
    if (days === 1) return '1 day left'
    return days + ' days left'
  }

  const filtered = jobs.filter(j => {
    if (filterCity && j.city !== filterCity) return false
    if (filterType && j.type !== filterType) return false
    if (filterCat && j.category !== filterCat) return false
    if (search && !j.title.toLowerCase().includes(search.toLowerCase()) && !j.company.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  return (
    <div style={S.page}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:translateY(0) } }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
        @keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
        input:focus, textarea:focus, select:focus { outline: none; border-color: #1a7a4a !important; box-shadow: 0 0 0 3px rgba(26,122,74,0.08); }
      `}</style>

      {/* Header */}
      <div style={S.header}>
        <div style={S.headerTop}>
          <div>
            <div style={S.headerTitle}>Jobs</div>
            <div style={S.headerSub}>{jobs.length} open positions in Malawi</div>
          </div>
          <button style={S.postJobBtn} onClick={() => setTab(tab === 'post' ? 'browse' : 'post')}>
            {tab === 'post' ? '← Browse' : '+ Post Job'}
          </button>
        </div>
        <div style={S.tabs}>
          <button style={{ ...S.tab, ...(tab === 'browse' ? S.tabActive : {}) }} onClick={() => setTab('browse')}>Browse Jobs</button>
          <button style={{ ...S.tab, ...(tab === 'post' ? S.tabActive : {}) }} onClick={() => setTab('post')}>Post a Job</button>
        </div>
      </div>

      {/* BROWSE TAB */}
      {tab === 'browse' && (
        <>
          <div style={S.searchWrap}>
            <div style={S.searchBox}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#888" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0 }}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
              <input style={S.searchInput} placeholder="Search job title or company..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          <div style={S.filterRow}>
            <select style={S.filterSelect} value={filterType} onChange={e => setFilterType(e.target.value)}>
              <option value="">All types</option>
              {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select style={S.filterSelect} value={filterCity} onChange={e => setFilterCity(e.target.value)}>
              <option value="">All cities</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select style={S.filterSelect} value={filterCat} onChange={e => setFilterCat(e.target.value)}>
              <option value="">All sectors</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={S.list}>
            {loading && [1, 2, 3].map(i => <div key={i} style={S.skeleton} />)}
            {!loading && filtered.length === 0 && (
              <div style={S.empty}>
                <div style={S.emptyIcon}>💼</div>
                <p style={S.emptyTitle}>No jobs found</p>
                <p style={S.emptySub}>Try adjusting your filters or be the first to post!</p>
                <button style={S.postFirstBtn} onClick={() => setTab('post')}>Post a Job</button>
              </div>
            )}
            {!loading && filtered.map((job, i) => {
              const dl = daysLeft(job.deadline)
              const urgent = job.deadline && new Date(job.deadline) - new Date() < 3 * 86400000
              return (
                <div key={job.id} style={{ ...S.card, animationDelay: i * 0.05 + 's' }} onClick={() => setSelectedJob(job)}>
                  <div style={S.cardTop}>
                    <div style={S.companyLogo}>{job.company[0].toUpperCase()}</div>
                    <div style={S.cardInfo}>
                      <div style={S.cardTitle}>{job.title}</div>
                      <div style={S.cardCompany}>{job.company}</div>
                    </div>
                    <span style={{ ...S.typeBadge, background: typeColor(job.type).bg, color: typeColor(job.type).text }}>
                      {job.type}
                    </span>
                  </div>
                  <div style={S.cardMeta}>
                    <span style={S.metaChip}>📍 {job.city}</span>
                    {job.category && <span style={S.metaChip}>🏷 {job.category}</span>}
                    {job.salary && <span style={{ ...S.metaChip, color: '#1a7a4a', fontWeight: '600' }}>💰 {job.salary}</span>}
                    {dl && (
                      <span style={{ ...S.metaChip, background: urgent ? '#fff0f0' : '#fff8e6', color: urgent ? '#c0392b' : '#e67e00', fontWeight: '700' }}>
                        ⏰ {dl}
                      </span>
                    )}
                  </div>
                  <p style={S.cardDesc}>{job.description.length > 120 ? job.description.slice(0, 120) + '…' : job.description}</p>
                  <div style={S.cardFooter}>
                    <span style={S.cardDate}>{timeAgo(job.created_at)}</span>
                    <span style={S.viewMore}>View details →</span>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}

      {/* POST TAB */}
      {tab === 'post' && (
        <div style={S.form}>
          <div style={S.formCard}>
            <div style={S.formTitle}>Post a Job Listing</div>
            <div style={S.formSub}>Reach thousands of job seekers across Malawi</div>

            <label style={S.label}>Job Title *</label>
            <input style={S.input} placeholder="e.g. Software Developer" value={form.title} onChange={e => set('title', e.target.value)} />

            <label style={S.label}>Company / Organisation *</label>
            <input style={S.input} placeholder="e.g. Airtel Malawi" value={form.company} onChange={e => set('company', e.target.value)} />

            <div style={S.row}>
              <div style={S.half}>
                <label style={S.label}>Job Type *</label>
                <select style={S.input} value={form.type} onChange={e => set('type', e.target.value)}>
                  <option value="">Select...</option>
                  {JOB_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div style={S.half}>
                <label style={S.label}>Sector</label>
                <select style={S.input} value={form.category} onChange={e => set('category', e.target.value)}>
                  <option value="">Select...</option>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={S.row}>
              <div style={S.half}>
                <label style={S.label}>City *</label>
                <select style={S.input} value={form.city} onChange={e => set('city', e.target.value)}>
                  <option value="">Select...</option>
                  {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={S.half}>
                <label style={S.label}>Salary / Rate</label>
                <input style={S.input} placeholder="e.g. MWK 200,000/mo" value={form.salary} onChange={e => set('salary', e.target.value)} />
              </div>
            </div>

            <label style={S.label}>Application Deadline</label>
            <input
              style={S.input}
              type="date"
              min={new Date().toISOString().split('T')[0]}
              value={form.deadline}
              onChange={e => set('deadline', e.target.value)}
            />
            <p style={S.fieldHint}>Leave blank if there's no deadline. Job disappears automatically after this date.</p>

            <label style={S.label}>Job Description *</label>
            <textarea style={S.textarea} rows={4} placeholder="Describe the role, responsibilities..." value={form.description} onChange={e => set('description', e.target.value)} />

            <label style={S.label}>Requirements</label>
            <textarea style={S.textarea} rows={3} placeholder="Qualifications, experience, skills needed..." value={form.requirements} onChange={e => set('requirements', e.target.value)} />

            <label style={S.label}>How to Apply / Contact</label>
            <input style={S.input} placeholder="e.g. email@company.com or phone number" value={form.contact} onChange={e => set('contact', e.target.value)} />

            {postError && <p style={S.error}>{postError}</p>}
            {postSuccess && <div style={S.successBanner}>✅ Job posted successfully! Redirecting…</div>}

            <button style={S.submitBtn} onClick={handlePost} disabled={posting}>
              {posting ? 'Posting…' : '📢 Post Job'}
            </button>
          </div>
        </div>
      )}

      {/* Job detail modal */}
      {selectedJob && (
        <div style={S.modalOverlay} onClick={closeJob}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <div style={S.modalLogo}>{selectedJob.company[0].toUpperCase()}</div>
              <div style={{ flex: 1 }}>
                <div style={S.modalTitle}>{selectedJob.title}</div>
                <div style={S.modalCompany}>{selectedJob.company}</div>
              </div>
              <button style={S.modalClose} onClick={closeJob}>✕</button>
            </div>

            <div style={S.modalMeta}>
              <span style={{ ...S.typeBadge, background: typeColor(selectedJob.type).bg, color: typeColor(selectedJob.type).text }}>{selectedJob.type}</span>
              <span style={S.metaChip}>📍 {selectedJob.city}</span>
              {selectedJob.category && <span style={S.metaChip}>{selectedJob.category}</span>}
              {selectedJob.salary && <span style={{ ...S.metaChip, color: '#1a7a4a', fontWeight: '700' }}>💰 {selectedJob.salary}</span>}
              {selectedJob.deadline && (
                <span style={{ ...S.metaChip, background: '#fff8e6', color: '#e67e00', fontWeight: '700' }}>
                  📅 Deadline: {new Date(selectedJob.deadline).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>

            <div style={S.modalSection}>
              <div style={S.modalSectionTitle}>About the Role</div>
              <p style={S.modalText}>{selectedJob.description}</p>
            </div>

            {selectedJob.requirements && (
              <div style={S.modalSection}>
                <div style={S.modalSectionTitle}>Requirements</div>
                <p style={S.modalText}>{selectedJob.requirements}</p>
              </div>
            )}

            {selectedJob.contact && (
              <div style={S.modalSection}>
                <div style={S.modalSectionTitle}>How to Apply</div>
                <p style={{ ...S.modalText, color: '#1a7a4a', fontWeight: '600' }}>{selectedJob.contact}</p>
              </div>
            )}

            <div style={S.modalFooter}>
              <span style={S.modalDate}>Posted {timeAgo(selectedJob.created_at)}</span>
              {selectedJob.contact && (
                <button style={S.applyBtn} onClick={() => setShowApply(true)}>
                  Apply Now →
                </button>
              )}
            </div>

            {showApply && (
              <div style={S.applySheet}>
                <div style={S.applySheetHeader}>
                  <div style={S.applySheetTitle}>How to Apply</div>
                  <button style={S.applySheetClose} onClick={() => setShowApply(false)}>✕</button>
                </div>
                <p style={S.applyInstructions}>
                  Send your CV and a short cover letter to the contact below.
                </p>
                <div style={S.contactBox}>
                  <div style={S.contactRow}>
                    <span style={S.contactIcon}>
                      {isEmail(selectedJob.contact) ? '📧' : isPhone(selectedJob.contact) ? '📞' : '🌐'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={S.contactLabel}>
                        {isEmail(selectedJob.contact) ? 'Email Address' : isPhone(selectedJob.contact) ? 'Phone Number' : 'Contact'}
                      </div>
                      <div style={{ ...S.contactValue, wordBreak: 'break-all' }}>{selectedJob.contact}</div>
                    </div>
                    {isPhone(selectedJob.contact) ? (
                      <a href={'tel:' + selectedJob.contact.replace(/\s/g, '')} style={S.actionBtn}>Call</a>
                    ) : isUrl(selectedJob.contact) ? (
                      <a href={selectedJob.contact.startsWith('http') ? selectedJob.contact : 'https://' + selectedJob.contact} target="_blank" rel="noreferrer" style={S.actionBtn}>Open</a>
                    ) : (
                      <button style={S.copyBtn} onClick={() => copyContact(selectedJob.contact)}>
                        {copied ? '✓ Copied' : 'Copy'}
                      </button>
                    )}
                  </div>
                  {isEmail(selectedJob.contact) && (
                    <div style={S.applyTip}>
                      💡 Copy the email above and paste it into Gmail or your email app to send your application.
                    </div>
                  )}
                </div>
                <button style={S.closeSheetBtn} onClick={() => setShowApply(false)}>Done</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bottom Nav */}
      <div style={S.nav}>
        <button style={S.navItem} onClick={() => navigate('/')}>
          <span style={S.navIcon}>🏠</span><span style={S.navLabel}>Home</span>
        </button>
        <button style={{ ...S.navItem, color: '#1a7a4a' }} onClick={() => navigate('/jobs')}>
          <span style={S.navIcon}>💼</span><span style={{ ...S.navLabel, color: '#1a7a4a', fontWeight: '700' }}>Jobs</span>
        </button>
        <button style={S.navPost} onClick={() => navigate('/post')}>+</button>
        <button style={{ ...S.navItem, position: 'relative' }} onClick={() => navigate('/chats')}>
          <span style={S.navIcon}>💬</span>
          <span style={S.navLabel}>Chats</span>
          {unreadCount > 0 && (
            <span style={S.unreadBadge}>{unreadCount > 9 ? '9+' : unreadCount}</span>
          )}
        </button>
        <button style={S.navItem} onClick={() => navigate('/profile')}>
          <span style={S.navIcon}>👤</span><span style={S.navLabel}>Me</span>
        </button>
      </div>
    </div>
  )
}

function typeColor(type) {
  const map = {
    'Full-time':  { bg: '#e6f7ee', text: '#1a7a4a' },
    'Part-time':  { bg: '#fff3e0', text: '#e67e00' },
    'Contract':   { bg: '#e8eaff', text: '#3b4dd4' },
    'Internship': { bg: '#fce4ec', text: '#c0255f' },
    'Volunteer':  { bg: '#f3e5f5', text: '#7b1fa2' },
  }
  return map[type] || { bg: '#f0f0f0', text: '#555' }
}

function timeAgo(date) {
  const diff = Date.now() - new Date(date)
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return mins + 'm ago'
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return hrs + 'h ago'
  const days = Math.floor(hrs / 24)
  if (days < 7) return days + 'd ago'
  return new Date(date).toLocaleDateString()
}

const S = {
  page: { minHeight: '100vh', background: '#f0f4f1', paddingBottom: '80px', fontFamily: 'system-ui, sans-serif' },
  header: { background: '#fff', borderBottom: '1px solid #e8f0eb', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  headerTop: { padding: '16px 16px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  headerTitle: { fontSize: '24px', fontWeight: '800', color: '#0f1410' },
  headerSub: { fontSize: '13px', color: '#888', marginTop: '2px' },
  postJobBtn: { background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '10px', padding: '8px 14px', fontSize: '13px', fontWeight: '700', cursor: 'pointer' },
  tabs: { display: 'flex', padding: '0 16px', marginTop: '12px' },
  tab: { flex: 1, background: 'none', border: 'none', borderBottom: '2px solid transparent', padding: '10px 0', fontSize: '14px', fontWeight: '600', color: '#888', cursor: 'pointer', transition: 'all 0.2s' },
  tabActive: { borderBottomColor: '#1a7a4a', color: '#1a7a4a' },
  searchWrap: { padding: '14px 14px 6px' },
  searchBox: { display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', border: '1.5px solid #e0ebe3', borderRadius: '14px', padding: '10px 14px' },
  searchInput: { flex: 1, border: 'none', outline: 'none', fontSize: '14px', background: 'transparent', color: '#0f1410' },
  filterRow: { display: 'flex', gap: '8px', padding: '0 14px 12px', overflowX: 'auto' },
  filterSelect: { border: '1.5px solid #e0ebe3', borderRadius: '10px', padding: '7px 10px', fontSize: '13px', background: '#fff', color: '#333', flexShrink: 0, cursor: 'pointer' },
  list: { padding: '0 14px', display: 'flex', flexDirection: 'column', gap: '12px' },
  skeleton: { height: '140px', background: 'linear-gradient(90deg,#e8f0eb 25%,#f4f8f5 50%,#e8f0eb 75%)', borderRadius: '16px', animation: 'pulse 1.5s infinite' },
  empty: { textAlign: 'center', padding: '60px 24px' },
  emptyIcon: { fontSize: '52px', marginBottom: '12px' },
  emptyTitle: { fontSize: '18px', fontWeight: '700', color: '#0f1410', marginBottom: '6px' },
  emptySub: { fontSize: '13px', color: '#888', marginBottom: '20px' },
  postFirstBtn: { background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '10px', padding: '10px 22px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  card: { background: '#fff', borderRadius: '16px', padding: '16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', cursor: 'pointer', animation: 'fadeUp 0.3s ease both', transition: 'box-shadow 0.2s', border: '1px solid #eef3ef' },
  cardTop: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' },
  companyLogo: { width: '44px', height: '44px', borderRadius: '12px', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '800', flexShrink: 0 },
  cardInfo: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: '15px', fontWeight: '700', color: '#0f1410', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  cardCompany: { fontSize: '13px', color: '#637068', marginTop: '2px' },
  typeBadge: { fontSize: '11px', fontWeight: '700', borderRadius: '8px', padding: '3px 9px', flexShrink: 0 },
  cardMeta: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' },
  metaChip: { fontSize: '12px', color: '#637068', background: '#f0f4f1', borderRadius: '6px', padding: '3px 8px' },
  cardDesc: { fontSize: '13px', color: '#555', lineHeight: '1.6', marginBottom: '10px' },
  cardFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontSize: '11px', color: '#aaa' },
  viewMore: { fontSize: '12px', color: '#1a7a4a', fontWeight: '700' },
  fieldHint: { fontSize: '11px', color: '#aaa', marginTop: '4px', marginBottom: '4px' },
  form: { padding: '16px' },
  formCard: { background: '#fff', borderRadius: '20px', padding: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)' },
  formTitle: { fontSize: '20px', fontWeight: '800', color: '#0f1410', marginBottom: '4px' },
  formSub: { fontSize: '13px', color: '#888', marginBottom: '20px' },
  label: { fontSize: '12px', fontWeight: '700', color: '#637068', display: 'block', marginBottom: '5px', marginTop: '14px', textTransform: 'uppercase', letterSpacing: '0.4px' },
  input: { width: '100%', border: '1.5px solid #e0ebe3', borderRadius: '12px', padding: '11px 14px', fontSize: '15px', background: '#fafcfb', boxSizing: 'border-box', transition: 'border-color 0.2s' },
  textarea: { width: '100%', border: '1.5px solid #e0ebe3', borderRadius: '12px', padding: '11px 14px', fontSize: '15px', background: '#fafcfb', resize: 'vertical', fontFamily: 'inherit', lineHeight: '1.5', boxSizing: 'border-box' },
  row: { display: 'flex', gap: '10px' },
  half: { flex: 1, minWidth: 0 },
  error: { color: '#c0392b', fontSize: '13px', marginTop: '10px', background: '#fef0f0', borderRadius: '8px', padding: '8px 12px' },
  successBanner: { background: '#e6f7ee', color: '#1a7a4a', fontWeight: '700', fontSize: '14px', borderRadius: '10px', padding: '12px', marginTop: '12px', textAlign: 'center' },
  submitBtn: { width: '100%', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff', border: 'none', borderRadius: '14px', padding: '15px', fontSize: '16px', fontWeight: '700', cursor: 'pointer', marginTop: '20px', boxShadow: '0 3px 10px rgba(26,122,74,0.3)' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#fff', borderRadius: '24px 24px 0 0', padding: '20px', width: '100%', maxWidth: '480px', maxHeight: '85vh', overflowY: 'auto', position: 'relative' },
  modalHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' },
  modalLogo: { width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px', fontWeight: '800', flexShrink: 0 },
  modalTitle: { fontSize: '18px', fontWeight: '800', color: '#0f1410' },
  modalCompany: { fontSize: '14px', color: '#637068', marginTop: '2px' },
  modalClose: { background: '#f4f8f5', border: 'none', borderRadius: '50%', width: '34px', height: '34px', fontSize: '16px', cursor: 'pointer', color: '#637068', flexShrink: 0 },
  modalMeta: { display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' },
  modalSection: { marginBottom: '16px' },
  modalSectionTitle: { fontSize: '12px', fontWeight: '800', color: '#637068', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' },
  modalText: { fontSize: '14px', color: '#333', lineHeight: '1.7', whiteSpace: 'pre-wrap' },
  modalFooter: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '16px', borderTop: '1px solid #eef3ef', marginTop: '8px' },
  modalDate: { fontSize: '12px', color: '#aaa' },
  applyBtn: { background: 'linear-gradient(135deg,#1a7a4a,#22a05e)', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px 20px', fontSize: '14px', fontWeight: '700', cursor: 'pointer' },
  applySheet: { background: '#fff', borderTop: '2px solid #e8f0eb', marginTop: '20px', padding: '20px 0 0', animation: 'slideUp 0.25s ease' },
  applySheetHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' },
  applySheetTitle: { fontSize: '17px', fontWeight: '800', color: '#0f1410' },
  applySheetClose: { background: '#f4f8f5', border: 'none', borderRadius: '50%', width: '30px', height: '30px', fontSize: '14px', cursor: 'pointer', color: '#637068' },
  applyInstructions: { fontSize: '13px', color: '#637068', lineHeight: '1.6', marginBottom: '16px' },
  contactBox: { background: '#f4f8f5', borderRadius: '14px', overflow: 'hidden', marginBottom: '16px' },
  contactRow: { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 16px' },
  contactIcon: { fontSize: '24px', flexShrink: 0 },
  contactLabel: { fontSize: '11px', color: '#888', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.3px', marginBottom: '3px' },
  contactValue: { fontSize: '15px', fontWeight: '600', color: '#0f1410' },
  copyBtn: { background: '#e6f7ee', color: '#1a7a4a', border: 'none', borderRadius: '8px', padding: '7px 13px', fontSize: '13px', fontWeight: '700', cursor: 'pointer', flexShrink: 0 },
  actionBtn: { background: '#1a7a4a', color: '#fff', borderRadius: '8px', padding: '7px 13px', fontSize: '13px', fontWeight: '700', textDecoration: 'none', flexShrink: 0 },
  applyTip: { fontSize: '12px', color: '#637068', background: '#fffbe6', borderTop: '1px solid #f0e8c0', padding: '10px 16px', lineHeight: '1.6' },
  closeSheetBtn: { width: '100%', background: '#f4f8f5', color: '#637068', border: 'none', borderRadius: '12px', padding: '13px', fontSize: '15px', fontWeight: '600', cursor: 'pointer' },
  nav: { position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)', width: '100%', maxWidth: '480px', background: '#fff', borderTop: '1px solid #eee', display: 'flex', alignItems: 'center', justifyContent: 'space-around', padding: '8px 0', zIndex: 100 },
  navItem: { background: 'none', border: 'none', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px', cursor: 'pointer' },
  navIcon: { fontSize: '20px' },
  navLabel: { fontSize: '10px', color: '#888' },
  navPost: { width: '48px', height: '48px', background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '50%', fontSize: '24px', cursor: 'pointer', marginTop: '-16px', boxShadow: '0 3px 10px rgba(26,122,74,0.4)' },
  unreadBadge: { position: 'absolute', top: '-2px', right: '-2px', background: '#e74c3c', color: '#fff', borderRadius: '50%', width: '16px', height: '16px', fontSize: '9px', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' },
}