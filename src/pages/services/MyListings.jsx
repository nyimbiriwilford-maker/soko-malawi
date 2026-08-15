import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { SERVICE_CATS, avatarColor, initials, renderStars } from './serviceData'
import { Plus, Pencil, Pause, Play, Trash2, X, MapPin, Star, Eye, ChevronRight } from 'lucide-react'

export default function MyListings({ myServices, onEdit, onRefresh, onPostNew }) {
  const [deleteConfirm, setDeleteConfirm] = useState(null)
  const [toggling, setToggling] = useState(null)

  async function toggleStatus(svc) {
    setToggling(svc.id)
    const newStatus = svc.status === 'active' ? 'paused' : 'active'
    await supabase.from('services').update({ status: newStatus }).eq('id', svc.id)
    setToggling(null)
    onRefresh()
  }

  async function deleteService(id) {
    await supabase.from('services').delete().eq('id', id)
    setDeleteConfirm(null)
    onRefresh()
  }

  const activeCount = myServices.filter(s => s.status === 'active').length
  const pausedCount = myServices.filter(s => s.status !== 'active').length

  if (myServices.length === 0) {
    return (
      <div className="ml-empty">
        <div className="ml-empty-icon">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
            <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
          </svg>
        </div>
        <p className="ml-empty-title">No listings yet</p>
        <p className="ml-empty-sub">List your service and start getting customers across Malawi</p>
        <button className="ml-empty-btn" onClick={onPostNew}>
          <Plus size={14} strokeWidth={2.5} /> List a Service
        </button>
      </div>
    )
  }

  return (
    <div className="ml-wrap">
      {/* Header */}
      <div className="ml-header">
        <div className="ml-header-left">
          <h2 className="ml-title">My Listings</h2>
          <p className="ml-sub">{myServices.length} service{myServices.length !== 1 ? 's' : ''} · {activeCount} active</p>
        </div>
        <button className="ml-add-btn" onClick={onPostNew}>
          <Plus size={14} strokeWidth={2.5} /> New Service
        </button>
      </div>

      {/* Stats */}
      <div className="ml-stats">
        <div className="ml-stat">
          <div className="ml-stat-num">{activeCount}</div>
          <div className="ml-stat-label">Active</div>
        </div>
        <div className="ml-stat-divider" />
        <div className="ml-stat">
          <div className="ml-stat-num">{pausedCount}</div>
          <div className="ml-stat-label">Paused</div>
        </div>
        <div className="ml-stat-divider" />
        <div className="ml-stat">
          <div className="ml-stat-num">{myServices.reduce((a, s) => a + (s.views || 0), 0)}</div>
          <div className="ml-stat-label">Total Views</div>
        </div>
      </div>

      {/* Listings */}
      <div className="ml-list">
        {myServices.map(svc => {
          const isActive = svc.status === 'active'
          const catMeta = SERVICE_CATS.find(c => c.name === svc.category)

          return (
            <div key={svc.id} className={`ml-card${!isActive ? ' ml-card--paused' : ''}`}>
              <div className="ml-card-top">
                <div className="ml-card-avatar" style={{ background: avatarColor(svc.name) }}>
                  {initials(svc.name)}
                </div>
                <div className="ml-card-info">
                  <div className="ml-card-name">{svc.name}</div>
                  <div className="ml-card-meta">
                    {catMeta?.icon} {svc.category}
                    {svc.city && <><span className="ml-card-dot" /><MapPin size={10} strokeWidth={2.5} /> {svc.city}</>}
                  </div>
                </div>
                <div className="ml-card-right">
                  {svc.rate && <div className="ml-card-rate">{svc.rate}</div>}
                  <div className={`ml-card-status${isActive ? ' ml-card-status--active' : ''}`}>
                    <span className="ml-card-status-dot" />
                    {isActive ? 'Active' : 'Paused'}
                  </div>
                </div>
              </div>

              {/* Stats row */}
              <div className="ml-card-stats">
                <div className="ml-card-stat">
                  <Eye size={12} strokeWidth={2} />
                  <span>{svc.views || 0} views</span>
                </div>
                {svc.rating > 0 && (
                  <div className="ml-card-stat">
                    <Star size={12} strokeWidth={2} fill="#f59e0b" />
                    <span>{svc.rating} ({svc.jobs_done || 0} jobs)</span>
                  </div>
                )}
              </div>

              {/* Paused warning */}
              {!isActive && (
                <div className="ml-card-warning">
                  <Pause size={12} strokeWidth={2.5} />
                  Listing paused — customers cannot see it
                </div>
              )}

              {/* Actions */}
              <div className="ml-card-actions">
                <button className="ml-action ml-action--edit" onClick={() => onEdit(svc)}>
                  <Pencil size={13} strokeWidth={2.2} /> Edit
                </button>
                <button
                  className={`ml-action ml-action--toggle${toggling === svc.id ? ' ml-action--loading' : ''}`}
                  onClick={() => toggleStatus(svc)}
                  disabled={toggling === svc.id}
                >
                  {isActive ? <><Pause size={13} strokeWidth={2.2} /> Pause</> : <><Play size={13} strokeWidth={2.2} /> Activate</>}
                </button>
                <button className="ml-action ml-action--delete" onClick={() => setDeleteConfirm(svc.id)}>
                  <Trash2 size={13} strokeWidth={2.2} />
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Delete confirm modal */}
      {deleteConfirm && (
        <div className="ml-modal-overlay" onClick={() => setDeleteConfirm(null)}>
          <div className="ml-modal" onClick={e => e.stopPropagation()}>
            <button className="ml-modal-close" onClick={() => setDeleteConfirm(null)}>
              <X size={16} strokeWidth={2.5} />
            </button>
            <div className="ml-modal-icon">
              <Trash2 size={24} strokeWidth={1.5} />
            </div>
            <h3 className="ml-modal-title">Delete listing?</h3>
            <p className="ml-modal-desc">This cannot be undone. Your service will be permanently removed.</p>
            <div className="ml-modal-actions">
              <button className="ml-modal-cancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="ml-modal-delete" onClick={() => deleteService(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
