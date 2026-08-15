import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { SERVICE_CATS, S, avatarColor, initials } from './serviceData'
import { Plus, Pencil, Pause, Play, Trash2, X, MapPin, Loader2 } from 'lucide-react'

const C = {
  card:      { background: '#fff', border: '1px solid #eef3ef', borderRadius: 12, marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)', overflow: 'hidden' },
  row:       { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px' },
  avatar:    { width: 36, height: 36, borderRadius: '50%', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, flexShrink: 0 },
  name:      { fontSize: 14, fontWeight: 700, color: '#0f1410', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  meta:      { fontSize: 11, color: '#888', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  rate:      { fontSize: 13, fontWeight: 800, color: '#1a7a4a', whiteSpace: 'nowrap' },
  status:    { fontSize: 10, fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap' },
  actions:   { display: 'flex', gap: 6, padding: '0 12px 10px' },
  btn:       { display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  editBtn:   { background: '#eef6f1', color: '#1a7a4a' },
  pauseBtn:  { background: '#fff8e6', color: '#d4920a' },
  delBtn:    { background: '#fef0f0', color: '#c0392b' },
}

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={S.sectionLabel}>
          My Listings <span style={S.countBadge}>{myServices.length}</span>
        </div>
        <button
          style={{ background: '#1a7a4a', color: '#fff', border: 'none', borderRadius: 9, padding: '7px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}
          onClick={onPostNew}
        >
          <Plus size={13} strokeWidth={2.5} /> Add
        </button>
      </div>

      {myServices.map(svc => {
        const isActive = svc.status === 'active'
        const cat = SERVICE_CATS.find(c => c.name === svc.category)
        return (
          <div key={svc.id} style={C.card}>

            <div style={C.row}>
              <div style={{ ...C.avatar, background: avatarColor(svc.name) }}>
                {initials(svc.name)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={C.name}>{svc.name}</div>
                <div style={{ ...C.meta, display: 'flex', alignItems: 'center', gap: 4 }}>
                  {cat?.emoji} {svc.category}{svc.city ? <><MapPin size={10} strokeWidth={2.2} /> {svc.city}</> : ''}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div style={C.rate}>{svc.rate}</div>
                <div style={{ ...C.status, color: isActive ? '#1a7a4a' : '#d4920a' }}>
                  {isActive ? '● Active' : '⏸ Paused'}
                </div>
              </div>
            </div>

            <div style={C.actions}>
              <button style={{ ...C.btn, ...C.editBtn, display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => onEdit(svc)}><Pencil size={12} /> Edit</button>
              <button
                style={{ ...C.btn, ...C.pauseBtn, opacity: toggling === svc.id ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                onClick={() => toggleStatus(svc)}
                disabled={toggling === svc.id}
              >
                {toggling === svc.id ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : isActive ? <Pause size={12} /> : <Play size={12} />}
                {isActive ? 'Pause' : 'Activate'}
              </button>
              <button style={{ ...C.btn, ...C.delBtn, display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => setDeleteConfirm(svc.id)}><Trash2 size={12} /> Delete</button>
            </div>
          </div>
        )
      })}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000 }} onClick={() => setDeleteConfirm(null)}>
          <div style={{ background: '#fff', borderRadius: '20px', padding: '24px', width: '280px', textAlign: 'center', margin: '0 16px' }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 52, height: 52, borderRadius: '50%', background: '#fef0f0', color: '#c0392b', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><Trash2 size={24} strokeWidth={1.8} /></div>
            <div style={{ fontSize: '16px', fontWeight: '800', marginBottom: '6px' }}>Delete listing?</div>
            <p style={{ fontSize: '13px', color: '#888', marginBottom: '20px' }}>This cannot be undone.</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button style={{ flex: 1, background: '#f0f4f1', border: 'none', borderRadius: '12px', padding: '11px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }} onClick={() => setDeleteConfirm(null)}><X size={13} /> Cancel</button>
              <button style={{ flex: 1, background: '#e74c3c', border: 'none', borderRadius: '12px', padding: '11px', fontSize: '14px', fontWeight: '700', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }} onClick={() => deleteService(deleteConfirm)}><Trash2 size={13} /> Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
