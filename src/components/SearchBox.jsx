import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../lib/supabase'
import { isJobListing } from '../utils/homeUtils'
import NotifyMeModal from './NotifyMeModal'

const css = `
  .hsb-root { position: relative; width: 100%; box-sizing: border-box; }
  .hsb-form { display: flex; align-items: center; width: 100%; box-sizing: border-box; }
  .hsb-input { flex: 1; min-width: 0; border: none; outline: none; background: transparent; padding: 0; font-family: inherit; cursor: text; }
  .hsb-submit { flex: 0 0 auto; border: none; background: #0F9D58; color: #fff; font-weight: 700; cursor: pointer; font-family: inherit; }
  .hsb-header-form { padding: 4px 4px 4px 14px; border-radius: 999px; border: 1.5px solid transparent; background: #F1F3F4; transition: border-color .2s, background .2s, box-shadow .2s; }
  .hsb-header-form.is-focused { background: #fff; border-color: #0F9D58; box-shadow: 0 0 0 3px rgba(15,157,88,.10); }
  .hsb-header-icon { display: flex; align-items: center; flex: 0 0 auto; margin-right: 8px; color: #5F6368; }
  .hsb-header-input { font-size: 13.5px; color: #202124; }
  .hsb-clear { width: 44px; height: 44px; flex: 0 0 auto; display: flex; align-items: center; justify-content: center; border: none; background: transparent; cursor: pointer; border-radius: 50%; padding: 0; }
  .hsb-clear-dot { width: 18px; height: 18px; display: flex; align-items: center; justify-content: center; border-radius: 50%; background: #E8EAED; color: #5F6368; }
  .hsb-header-submit { height: 44px; padding: 0 20px; font-size: 13.5px; border-radius: 999px; }
  .hsb-hero-form { background: transparent; align-items: stretch; }
  .hsb-hero-input { background: #fff; border: 1px solid #E8EAED; border-right: none; border-radius: 14px 0 0 14px; padding: 0 14px; font-size: 14px; color: #111827; }
  .hsb-hero-submit { border-radius: 0 14px 14px 0; padding: 0 20px; font-size: 14px; }
  .hsb-dropdown { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 1300; background: #fff; border: 1px solid #E8EAED; border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.12); padding: 8px 0; max-height: 400px; overflow-y: auto; box-sizing: border-box; }
  .hsb-label { padding: 0 16px 8px; font-size: 11px; font-weight: 700; color: #9CA3AF; text-transform: uppercase; letter-spacing: .5px; }
  .hsb-label-bordered { border-top: 1px solid #F3F4F6; padding-top: 8px; }
  .hsb-row { display: flex; align-items: center; gap: 10px; width: 100%; text-align: left; padding: 7px 16px; border: none; background: transparent; cursor: pointer; font-family: inherit; min-height: 44px; box-sizing: border-box; }
  .hsb-row:hover { background: #F3F4F6; }
  .hsb-thumb { width: 32px; height: 32px; border-radius: 8px; background: #F3F4F6; overflow: hidden; flex: 0 0 auto; }
  .hsb-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
  .hsb-row-body { flex: 1; min-width: 0; }
  .hsb-row-title { font-size: 13px; font-weight: 600; color: #111827; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hsb-row-meta { font-size: 11px; color: #6B7280; margin-top: 2px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .hsb-skeleton-wrap { padding: 16px 16px 12px; }
  .hsb-skeleton-row { display: flex; align-items: center; gap: 10px; padding: 8px 0; min-height: 44px; }
  .hsb-skeleton { background: #E5E7EB; border-radius: 8px; }
  .hsb-empty { padding: 20px 16px 16px; }
  .hsb-empty-title { font-size: 13px; font-weight: 700; color: #374151; margin-bottom: 4px; }
  .hsb-empty-hint { font-size: 11px; font-weight: 600; color: #9CA3AF; margin-bottom: 12px; }
  .hsb-empty-list { margin: 0 0 14px; padding: 0 0 0 16px; font-size: 11px; color: #6B7280; line-height: 1.8; }
  .hsb-notify { width: 100%; border: none; background: #0F9D58; border-radius: 8px; padding: 9px 12px; font-size: 12px; font-weight: 800; color: #fff; cursor: pointer; font-family: inherit; margin-bottom: 10px; display: flex; align-items: center; justify-content: center; gap: 6px; min-height: 44px; }
  .hsb-empty-actions { display: flex; gap: 8px; }
  .hsb-secondary, .hsb-tertiary { flex: 1; border-radius: 8px; padding: 8px 12px; font-size: 11px; font-weight: 700; cursor: pointer; font-family: inherit; min-height: 44px; }
  .hsb-secondary { border: 1px solid #D1D5DB; background: #fff; color: #374151; }
  .hsb-tertiary { border: none; background: #374151; color: #fff; }
`

function SearchIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  )
}

function CloseIcon({ size = 9 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

export default function SearchBox({
  value = '',
  onChange,
  onSubmit,
  onSelect,
  onNotify,
  onFocusChange,
  navigate,
  user,
  placeholder = 'Search for anything...',
  variant = 'header',
  height = 44,
  style,
}) {
  const rootRef = useRef(null)
  const inputRef = useRef(null)
  const [focused, setFocusedState] = useState(false)
  const [results, setResults] = useState(null)
  const [loading, setLoading] = useState(false)
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [notifyQuery, setNotifyQuery] = useState('')

  const trimmed = value.trim()
  const showDropdown = focused && trimmed.length >= 2
  const isHeader = variant === 'header'

  function setFocused(next) {
    setFocusedState(next)
    onFocusChange?.(next)
  }

  useEffect(() => {
    const q = trimmed.toLowerCase()
    if (!focused || q.length < 2) return
    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const [listingsData, shopsData] = await Promise.all([
          supabase.from('listings')
            .select('id,title,price,images,city')
            .in('status', ['published', 'active'])
            .ilike('title', `%${q}%`)
            .order('created_at', { ascending: false })
            .limit(5),
          supabase.from('shops')
            .select('id,name,slug,logo_url,city')
            .eq('is_active', true)
            .ilike('name', `%${q}%`)
            .limit(3),
        ])
        if (cancelled) return
        setResults({
          listings: (listingsData.data || []).filter(l => !isJobListing(l)),
          shops: shopsData.data || [],
        })
      } catch (error) {
        console.error('Live search error:', error)
        if (!cancelled) setResults({ listings: [], shops: [] })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }, 300)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [trimmed, focused])

  useEffect(() => {
    function onDown(e) {
      if (rootRef.current && !rootRef.current.contains(e.target)) setFocused(false)
    }
    function onKey(e) {
      if (e.key === 'Escape') setFocused(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  })

  function submit() {
    if (!trimmed) return
    onSubmit?.(trimmed)
    setFocused(false)
  }

  function select(term) {
    onChange?.(term)
    onSelect?.(term)
    setFocused(false)
  }

  function openNotify(query) {
    setFocused(false)
    onNotify?.(query)
    setNotifyQuery(query)
    setNotifyOpen(true)
  }

  function go(path) {
    setFocused(false)
    navigate?.(path)
  }

  return (
    <div className="hsb-root" ref={rootRef} style={style}>
      <style>{css}</style>
      <div className={`hsb-form ${isHeader ? 'hsb-header-form' : 'hsb-hero-form'}${focused && isHeader ? ' is-focused' : ''}`} style={{ minHeight: isHeader ? height + 8 : height }}>
        {isHeader && <span className="hsb-header-icon"><SearchIcon /></span>}
        <input
          ref={inputRef}
          className={`hsb-input ${isHeader ? 'hsb-header-input' : 'hsb-hero-input'}`}
          type="text"
          value={value}
          onChange={e => { onChange?.(e.target.value); setLoading(true) }}
          onFocus={() => { setFocused(true); if (value.trim().length >= 2) setLoading(true) }}
          onKeyDown={e => { if (e.key === 'Enter') submit() }}
          placeholder={placeholder}
          aria-label="Search marketplace"
          style={{ height }}
        />
        {isHeader && !!value && (
          <button
            type="button"
            className="hsb-clear"
            aria-label="Clear search"
            onClick={() => { onChange?.(''); inputRef.current?.focus() }}
          >
            <span className="hsb-clear-dot"><CloseIcon /></span>
          </button>
        )}
        <button type="button" className={`hsb-submit ${isHeader ? 'hsb-header-submit' : 'hsb-hero-submit'}`} onClick={submit} style={{ height }}>Search</button>
      </div>

      {showDropdown && (
        <div className="hsb-dropdown">
          {loading ? (
            <div className="hsb-skeleton-wrap">
              <div className="hsb-label">Searching products...</div>
              {[1, 2, 3].map(i => (
                <div key={i} className="hsb-skeleton-row">
                  <div className="hsb-skeleton" style={{ width: 32, height: 32, flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="hsb-skeleton" style={{ width: `${60 + i * 10}%`, height: 12, marginBottom: 6 }} />
                    <div className="hsb-skeleton" style={{ width: `${30 + i * 5}%`, height: 10 }} />
                  </div>
                </div>
              ))}
            </div>
          ) : results ? (
            <>
              {results.listings.length > 0 && (
                <>
                  <div className="hsb-label">Products</div>
                  {results.listings.map(item => (
                    <button key={item.id} type="button" className="hsb-row" onClick={() => select(item.title)}>
                      <div className="hsb-thumb">
                        {item.images?.[0] && <img src={item.images[0]} alt="" />}
                      </div>
                      <div className="hsb-row-body">
                        <div className="hsb-row-title">{item.title}</div>
                        <div className="hsb-row-meta">
                          {item.price ? `MK ${Number(item.price).toLocaleString()}` : ''}{item.city ? ` · ${item.city}` : ''}
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}
              {results.shops.length > 0 && (
                <>
                  <div className={`hsb-label${results.listings.length > 0 ? ' hsb-label-bordered' : ''}`}>Shops</div>
                  {results.shops.map(shop => (
                    <button key={shop.id} type="button" className="hsb-row" onClick={() => select(shop.name)}>
                      <div className="hsb-thumb">
                        {shop.logo_url && <img src={shop.logo_url} alt="" />}
                      </div>
                      <div className="hsb-row-body">
                        <div className="hsb-row-title">{shop.name}</div>
                        <div className="hsb-row-meta">{shop.city || 'Shop'}</div>
                      </div>
                    </button>
                  ))}
                </>
              )}
              {results.listings.length === 0 && results.shops.length === 0 && (
                <div className="hsb-empty">
                  <div className="hsb-empty-title">No products found for &ldquo;{trimmed}&rdquo;</div>
                  <div className="hsb-empty-hint">Try:</div>
                  <ul className="hsb-empty-list">
                    <li>Different spelling</li>
                    <li>Browse categories</li>
                    <li>View latest listings</li>
                  </ul>
                  <button type="button" className="hsb-notify" onClick={() => openNotify(trimmed)}>
                    Notify me when &ldquo;{trimmed}&rdquo; is available
                  </button>
                  <div className="hsb-empty-actions">
                    <button type="button" className="hsb-secondary" onClick={() => go('/search')}>Explore Categories</button>
                    <button type="button" className="hsb-tertiary" onClick={() => go('/search?sort=newest')}>View Latest Products</button>
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}

      {notifyOpen && typeof document !== 'undefined' && createPortal(
        <div style={{ position: 'fixed', inset: 0, zIndex: 1400 }}>
          <NotifyMeModal query={notifyQuery} user={user} onClose={() => setNotifyOpen(false)} />
        </div>,
        document.body,
      )}
    </div>
  )
}
