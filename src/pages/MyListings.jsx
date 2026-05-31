import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { SERVICE_CATS, S, avatarColor, initials, renderStars } from './serviceData'

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

  if (myServices.length === 0) {
    return (
      <div style={S.feed}>
        <div style={S.empty}>
          <div style={S.emptyIcon}>🔧</div>
          <p style={S.emptyTitle}>No listings yet</p>
          <p style={S.emptySub}>List your service and start getting customers across Malawi</p>
          <button style={S.postFirstBtn} onClick={onPostNew}>+ List a Service</button>
        </div>
      </div>
    )
  }

  return (
    <div style={S.feed}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={S.sectionLabel}>
          My Listings <span style={S.countBadge}>{myServices.length}</span>
        </div>
        <button
          style={{ background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: '10px', padding: '7px 14px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', fontFamily: 'inherit' }}
          onClick={onPostNew}
        >
          + Add
        </button>
      </div>

      {myServices.map(svc => {
        const isActive = svc.status === 'active'
        return (
          <div key={svc.id} style={S.myServiceCard}>

            {/* Header */}
            <div style={S.myServiceHeader}>
              <div style={{ ...S.myServiceAvatar, background: avatarColor(svc.name) }}>
                {initials(svc.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={S.myServiceName}>{svc.name}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>
                  {SERVICE_CATS.find(c => c.name === svc.category)?.icon} {svc.category} · 📍 {svc.city}
                </div>
                {svc.rating > 0 && (
                  <div style={{ fontSize: '11px', color: '#f0c040', marginTop: '2px' }}>
                    {renderStars(svc.rating)} {svc.rating}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={S.myServiceRate}>{svc.rate}</div>
                <div style={{ fontSize: '10px', color: isActive ? '#5de89e' : '#f0a500', marginTop: '3px' }}>
                  {isActive ? '● Active' : '⏸ Paused'}
                </div>
              </div>
            </div>

            <div style={S.myServiceBody}>
              {/* Stats: views + contact */}
              <div style={S.myServiceStats}>
                <div style={S.myServiceStat}>
                  <div style={S.myServiceStatVal}>{svc.views || 0}</div>
                  <div style={S.myServiceStatLabel}>Profile views</div>
                </div>
                <div style={S.myServiceStat}>
                  <div style={{ ...S.myServiceStatVal, fontSize: '13px', wordBreak: 'break-all' }}>
                    {svc.contact || '—'}
                  </div>
                  <div style={S.myServiceStatLabel}>Contact shown</div>
                </div>
              </div>

              {/* Description preview */}
              {svc.description && (
                <p style={{ fontSize: '12px', color: '#637068', lineHeight: '1.5', marginBottom: '10px' }}>
                  {svc.description.slice(0, 120)}{svc.description.length > 120 ? '…' : ''}
                </p>
              )}

              {/* Skills */}
              {svc.skills?.length > 0 && (
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginBottom: '10px' }}>
                  {svc.skills.slice(0, 5).map(sk => (
                    <span key={sk} style={{ background: '#e6f7ee', color: '#1a7a4a', borderRadius: '6px', padding: '2px 7px', fontSize: '10px', fontWeight: '500' }}>
                      {sk}
                    </span>
                  ))}
                  {svc.skills.length > 5 && (
                    <span style={{ background: '#f0f4f1', color: '#888', borderRadius: '6px', padding: '2px 7px', fontSize: '10px' }}>
                      +{svc.skills.length - 5}
                    </span>
                  )}
                </div>
              )}

              {/* Media thumbnails */}
              {(svc.media_urls || []).length > 0 && (
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', overflowX: 'auto' }}>
                  {(svc.media_urls || []).slice(0, 6).map((url, i) => (
                    url.match(/\.(mp4|mov)$/i)
                      ? <video key={i} src={url} style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} muted />
                      : <img key={i} src={url} alt="" style={{ width: '50px', height: '50px', objectFit: 'cover', borderRadius: '8px', flexShrink: 0 }} />
                  ))}
                  {(svc.media_urls || []).length > 6 && (
                    <div style={{ width: '50px', height: '50px', background: '#f0f4f1', borderRadius: '8px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: '700', color: '#888' }}>
                      +{(svc.media_urls || []).length - 6}
                    </div>
                  )}
                </div>
              )}

              {/* Paused warning */}
              {!isActive && (
                <div style={{ background: '#fff8e6', borderRadius: '10px', padding: '8px 12px', marginBottom: '10px', fontSize: '12px', color: '#d4920a', fontWeight: '600' }}>
                  ⏸ Your listing is paused — customers cannot see it
                </div>
              )}

              {/* Actions */}
              <div style={S.myServiceActions}>
                <button style={S.myServiceEditBtn} onClick={() => onEdit(svc)}>✏️ Edit</button>
                <button
                  style={{ ...S.myServicePauseBtn, opacity: toggling === svc.id ? 0.6 : 1 }}
                  onClick={() => toggleStatus(svc)}
                  disabled={toggling === svc.id}
                >
                  {isActive ? '⏸ Pause' : '▶ Activate'}
                </button>
                <button style={S.myServiceDeleteBtn} onClick={() => setDeleteConfirm(svc.id)}>🗑</button>
              </div>
            </div>
          </div>
        )
      })}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px', width: '280px', textAlign: 'center', margin: '0 16px' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '36px', marginBottom: '10px' }}>🗑️</div>
            <div style={{ fontSize: '16px', fontWeight: '800', marginBottom: '6px' }}>Delete listing?</div>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={{ flex: 1, background: '#f0f4f1', border: 'none', borderRadius: '12px', padding: '11px', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }} onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button style={{ flex: 1, background: '#e74c3c', border: 'none', borderRadius: '12px', padding: '11px', fontSize: '14px', fontWeight: '700', color: '#fff', cursor: 'pointer' }} onClick={() => deleteService(deleteConfirm)}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
