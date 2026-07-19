/**
 * Status location: pick any Malawi district OR type a custom place.
 */
import { useMemo, useState, useRef, useEffect } from 'react'
import { MALAWI_DISTRICTS } from '../constants/malawiDistricts'

const G = '#1a7a4a'

function IconMapPin({ size = 14, color = '#64748b' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z" />
      <circle cx="12" cy="10" r="2.2" />
    </svg>
  )
}

function IconSearch({ size = 14, color = '#94a3b8' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="M20 20l-3.5-3.5" />
    </svg>
  )
}

function IconX({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

/**
 * @param {object} props
 * @param {string} props.value - current location string
 * @param {(v: string) => void} props.onChange
 * @param {string} [props.placeholder]
 * @param {boolean} [props.compact]
 */
export default function StatusLocationField({
  value = '',
  onChange,
  placeholder = 'District or type your area…',
  compact = false,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(value || '')
  const wrapRef = useRef(null)
  const inputRef = useRef(null)

  // Keep input in sync when parent sets value (e.g. user city default)
  useEffect(() => {
    setQuery(value || '')
  }, [value])

  useEffect(() => {
    function onDoc(e) {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return MALAWI_DISTRICTS
    return MALAWI_DISTRICTS.filter(d => d.toLowerCase().includes(q))
  }, [query])

  const exactMatch = MALAWI_DISTRICTS.some(
    d => d.toLowerCase() === query.trim().toLowerCase(),
  )

  function commit(val) {
    const next = (val || '').trim()
    setQuery(next)
    onChange?.(next)
    setOpen(false)
  }

  function onInputChange(e) {
    const v = e.target.value
    setQuery(v)
    onChange?.(v)
    setOpen(true)
  }

  function pickDistrict(d) {
    commit(d)
  }

  function useTyped() {
    commit(query)
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <div style={{
        fontSize: 10, fontWeight: 800, color: '#64748b',
        textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 6,
        display: 'flex', alignItems: 'center', gap: 5,
      }}>
        <IconMapPin size={12} /> Location
      </div>

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: compact ? '9px 12px' : '11px 13px',
        borderRadius: 12,
        border: `1.5px solid ${open ? G : '#e2e8f0'}`,
        background: '#f8fafc',
        boxShadow: open ? '0 0 0 3px rgba(26,122,74,0.12)' : 'none',
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}>
        <IconSearch size={15} color={open ? G : '#94a3b8'} />
        <input
          ref={inputRef}
          value={query}
          onChange={onInputChange}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault()
              if (filtered.length === 1) pickDistrict(filtered[0])
              else useTyped()
            }
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder={placeholder}
          maxLength={80}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontSize: 13, color: '#0f172a', fontFamily: 'inherit', minWidth: 0,
          }}
          aria-label="Status location"
          autoComplete="off"
        />
        {query ? (
          <button
            type="button"
            onClick={() => commit('')}
            aria-label="Clear location"
            style={{
              border: 'none', background: '#e2e8f0', color: '#64748b',
              width: 22, height: 22, borderRadius: '50%', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
            }}
          >
            <IconX size={11} />
          </button>
        ) : null}
      </div>

      <div style={{
        fontSize: 10, color: '#94a3b8', fontWeight: 600, marginTop: 5,
      }}>
        Pick a district or type your own place (area, market, town)
      </div>

      {open && (
        <div style={{
          position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 6,
          zIndex: 40,
          background: '#fff',
          border: '1.5px solid #e2e8f0',
          borderRadius: 14,
          boxShadow: '0 12px 40px rgba(15,23,42,0.14)',
          maxHeight: 240,
          overflowY: 'auto',
          overflowX: 'hidden',
        }}>
          {/* Custom typed location */}
          {query.trim() && !exactMatch && (
            <button
              type="button"
              onClick={useTyped}
              style={{
                width: '100%', textAlign: 'left', border: 'none',
                borderBottom: '1px solid #f1f5f9',
                background: 'linear-gradient(90deg,#f0fdf4,#fff)',
                padding: '11px 14px', cursor: 'pointer', fontFamily: 'inherit',
              }}
            >
              <div style={{ fontSize: 11, fontWeight: 800, color: G, marginBottom: 2 }}>
                Use custom location
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0f172a' }}>
                “{query.trim()}”
              </div>
            </button>
          )}

          <div style={{
            padding: '8px 14px 4px',
            fontSize: 10, fontWeight: 800, color: '#94a3b8',
            letterSpacing: 0.6, textTransform: 'uppercase',
          }}>
            All districts ({filtered.length})
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: '12px 14px 16px', fontSize: 12, color: '#94a3b8', fontWeight: 600 }}>
              No district matches — press Enter to use “{query.trim()}”
            </div>
          ) : (
            filtered.map(d => {
              const selected = value && d.toLowerCase() === value.trim().toLowerCase()
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => pickDistrict(d)}
                  style={{
                    width: '100%', textAlign: 'left', border: 'none',
                    background: selected ? '#f0fdf4' : '#fff',
                    padding: '10px 14px',
                    fontSize: 13, fontWeight: selected ? 800 : 600,
                    color: selected ? G : '#0f172a',
                    cursor: 'pointer', fontFamily: 'inherit',
                    display: 'flex', alignItems: 'center', gap: 8,
                    borderBottom: '1px solid #f8fafc',
                  }}
                  onMouseEnter={e => {
                    if (!selected) e.currentTarget.style.background = '#f8fafc'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = selected ? '#f0fdf4' : '#fff'
                  }}
                >
                  <IconMapPin size={13} color={selected ? G : '#94a3b8'} />
                  {d}
                  {selected && (
                    <span style={{ marginLeft: 'auto', fontSize: 11, fontWeight: 800, color: G }}>✓</span>
                  )}
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}
