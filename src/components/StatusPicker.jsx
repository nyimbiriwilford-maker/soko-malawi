import { useState } from 'react'
import { useStatuses } from '../hooks/useStatuses'

const AVAILABILITY_TEMPLATES = [
  'Available today — can meet in Blantyre CBD',
  'Available today — can meet in Lilongwe City',
  'Negotiable on prices today',
  'Just restocked — new items listed',
  'Busy this week, responding slowly',
  'Away until Friday',
]

const LISTING_TEMPLATES = [
  'Still available — can meet today',
  'Price dropped — see new price',
  'Two people interested — first to confirm gets it',
  'Reserved — deal not confirmed yet',
  'Available for pickup now',
]

const WORK_TEMPLATES = [
  'Available for work this week',
  'Available for jobs — contact me',
  'Fully booked until next week',
]

function TemplateList({ templates, onSelect, selected }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
      {templates.map(t => (
        <button key={t} onClick={() => onSelect(t)} style={{
          background: selected === t ? '#e8f5e9' : '#f9fafb',
          border: `1.5px solid ${selected === t ? '#a5d6a7' : '#e5e7eb'}`,
          borderRadius: 10, padding: '9px 12px',
          fontSize: 13, fontWeight: selected === t ? 700 : 500,
          color: selected === t ? '#2e7d32' : '#374151',
          cursor: 'pointer', textAlign: 'left', lineHeight: 1.4,
          transition: 'all 0.15s',
        }}>
          {selected === t && <span style={{ marginRight: 6 }}>✓</span>}
          {t}
        </button>
      ))}
    </div>
  )
}

export default function StatusPicker({ userId, listingId = null, onDone }) {
  const { statuses, postStatus, deleteStatus, loading } = useStatuses(userId)
  const [tab, setTab]         = useState(listingId ? 'listing' : 'availability')
  const [selected, setSelected] = useState('')
  const [custom, setCustom]   = useState('')
  const [posting, setPosting] = useState(false)
  const [msg, setMsg]         = useState('')

  const activeStatus = statuses[0] || null

  const templates =
    tab === 'availability' ? AVAILABILITY_TEMPLATES :
    tab === 'listing'      ? LISTING_TEMPLATES :
    WORK_TEMPLATES

  const content = custom.trim() || selected

  async function handlePost() {
    if (!content) return
    setPosting(true)
    const expiryKey =
      tab === 'listing' &&
      (content.includes('Two people') || content.includes('first to confirm') || content.includes('Price drop'))
        ? 'listing_urgency'
        : tab === 'work_ping' ? 'work_ping'
        : 'availability'

    const { error } = await postStatus({
      content,
      status_type: tab === 'listing' ? 'listing_update' : tab,
      listing_id: tab === 'listing' ? listingId : null,
      expiryKey,
    })
    setPosting(false)
    if (error) { setMsg('Error posting status'); return }
    setMsg('Status posted!')
    setSelected(''); setCustom('')
    setTimeout(() => { setMsg(''); onDone?.() }, 1200)
  }

  const tabStyle = (t) => ({
    flex: 1, background: tab === t ? '#2e7d32' : 'transparent',
    color: tab === t ? '#fff' : '#637068',
    border: 'none', borderRadius: 8, padding: '7px 0',
    fontSize: 12, fontWeight: 700, cursor: 'pointer',
  })

  return (
    <div style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      {/* Active status strip */}
      {activeStatus && (
        <div style={{
          background: '#f0faf4', border: '1.5px solid #a5d6a7',
          borderRadius: 12, padding: '10px 12px', marginBottom: 14,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
        }}>
          <div style={{ fontSize: 13, color: '#2e7d32', fontWeight: 600, flex: 1 }}>
            ✅ Active: {activeStatus.content}
          </div>
          <button onClick={() => deleteStatus(activeStatus.id)} style={{
            background: 'none', border: 'none', color: '#9ca3af',
            fontSize: 16, cursor: 'pointer', padding: '0 2px', lineHeight: 1,
          }}>✕</button>
        </div>
      )}

      {/* Tabs — hide listing tab if no listingId */}
      <div style={{
        display: 'flex', background: '#f3f4f6',
        borderRadius: 10, padding: 3, marginBottom: 14, gap: 3,
      }}>
        <button style={tabStyle('availability')} onClick={() => { setTab('availability'); setSelected(''); setCustom('') }}>
          Availability
        </button>
        {listingId && (
          <button style={tabStyle('listing')} onClick={() => { setTab('listing'); setSelected(''); setCustom('') }}>
            This Listing
          </button>
        )}
        <button style={tabStyle('work_ping')} onClick={() => { setTab('work_ping'); setSelected(''); setCustom('') }}>
          Work
        </button>
      </div>

      {/* Templates */}
      <TemplateList templates={templates} onSelect={t => { setSelected(t); setCustom('') }} selected={selected} />

      {/* Custom input */}
      <div style={{ marginTop: 10 }}>
        <input
          placeholder="Or type a custom status…"
          value={custom}
          onChange={e => { setCustom(e.target.value); setSelected('') }}
          maxLength={120}
          style={{
            width: '100%', border: '1.5px solid #e5e7eb',
            borderRadius: 10, padding: '9px 12px', fontSize: 13,
            color: '#111', background: '#fafafa', boxSizing: 'border-box',
            outline: 'none',
          }}
        />
        {custom && (
          <div style={{ textAlign: 'right', fontSize: 11, color: '#9ca3af', marginTop: 3 }}>
            {custom.length}/120
          </div>
        )}
      </div>

      {/* Expiry hint */}
      {content && (
        <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>
          ⏱ Expires in{' '}
          {tab === 'listing' && (content.includes('Two people') || content.includes('Price drop')) ? '6 hours' :
           tab === 'work_ping' ? '48 hours' : '24 hours'}
        </div>
      )}

      {/* Post button */}
      <button
        onClick={handlePost}
        disabled={!content || posting}
        style={{
          width: '100%', marginTop: 12,
          background: content ? '#2e7d32' : '#e5e7eb',
          color: content ? '#fff' : '#9ca3af',
          border: 'none', borderRadius: 12, padding: '12px',
          fontSize: 14, fontWeight: 700, cursor: content ? 'pointer' : 'default',
          transition: 'all 0.15s',
        }}
      >
        {posting ? 'Posting…' : msg || 'Post Status'}
      </button>
    </div>
  )
}