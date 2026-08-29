import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import SafeAvatar from './SafeAvatar'
import {
  conversationKey,
  sourceFromMessage,
  contextIdFromMessage,
  sourceMeta,
  loadDeletedChatKeys,
} from '../utils/chatSources'
import {
  forwardMessages,
  forwardPreviewLabel,
  FORWARD_TARGET_LIMIT,
} from '../utils/forwardMessage'

/**
 * Mirrors Chat.jsx's DM accept gate: the receiver of a first direct message
 * has to continue the chat before they can send into it.
 */
function dmAccepted(myId, otherId) {
  try {
    return localStorage.getItem(`soko_dm_accept_${myId}_${otherId}`) === '1'
  } catch {
    return false
  }
}

/**
 * "Forward to…" bottom sheet.
 *
 * Lists the signed-in user's existing conversations (person × context, same
 * grouping as the chat list), lets them pick up to FORWARD_TARGET_LIMIT of
 * them, and copies the given messages into each one.
 */
export default function ForwardSheet({
  currentUserId,
  messages = [],
  plainBody = (m) => m?.body || '',
  currentKey = null,
  senderName = 'Someone',
  onClose,
  onSent,
}) {
  const [chats, setChats] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState([]) // conversation keys, in tap order
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const aliveRef = useRef(true)

  useEffect(() => () => { aliveRef.current = false }, [])

  useEffect(() => {
    if (!currentUserId) return
    let cancelled = false

    async function loadTargets() {
      const { data: rows, error: loadErr } = await supabase
        .from('messages')
        .select('id,from_user,to_user,created_at,chat_source,listing_id,service_id,job_id,shop_id,request_id')
        .or(`from_user.eq.${currentUserId},to_user.eq.${currentUserId}`)
        .order('created_at', { ascending: false })

      if (cancelled) return
      if (loadErr) { setError('Could not load your chats'); setLoading(false); return }

      const deleted = loadDeletedChatKeys(currentUserId)
      const convos = new Map()
      for (const row of rows || []) {
        const otherId = row.from_user === currentUserId ? row.to_user : row.from_user
        if (!otherId || otherId === currentUserId) continue
        const source = sourceFromMessage(row)
        const contextId = contextIdFromMessage(row)
        const key = conversationKey(otherId, source, contextId)
        if (deleted.has(key)) continue
        const mine = row.from_user === currentUserId
        const existing = convos.get(key)
        if (!existing) {
          convos.set(key, {
            key,
            otherId,
            source,
            contextId,
            lastAt: row.created_at,
            iSent: mine,
            theySent: !mine,
          })
        } else {
          if (mine) existing.iSent = true
          else existing.theySent = true
        }
      }

      const list = [...convos.values()]
      const ids = [...new Set(list.map(c => c.otherId))]
      const bySource = (src) => list.filter(c => c.source === src && c.contextId).map(c => c.contextId)
      const listingIds = bySource('listing')
      const serviceIds = bySource('service')
      const shopIds = bySource('shop')
      const jobIds = bySource('job')
      const requestIds = bySource('request')
      const maybe = (cond, q) => (cond.length ? q : Promise.resolve({ data: [] }))

      const [profiles, listings, services, shops, jobs, requests] = await Promise.all([
        ids.length
          ? supabase.from('profiles').select('id,full_name,avatar_url,is_verified').in('id', ids)
          : Promise.resolve({ data: [] }),
        maybe(listingIds, supabase.from('listings').select('id,title').in('id', listingIds)),
        maybe(serviceIds, supabase.from('services').select('id,name').in('id', serviceIds)),
        maybe(shopIds, supabase.from('shops').select('id,name').in('id', shopIds)),
        maybe(jobIds, supabase.from('jobs').select('id,title').in('id', jobIds)),
        maybe(requestIds, supabase.from('buyer_requests').select('id,title').in('id', requestIds)),
      ])

      if (cancelled) return

      const profileMap = Object.fromEntries((profiles.data || []).map(p => [p.id, p]))
      const titleMap = {
        listing: Object.fromEntries((listings.data || []).map(l => [l.id, l.title])),
        service: Object.fromEntries((services.data || []).map(s => [s.id, s.name])),
        shop: Object.fromEntries((shops.data || []).map(s => [s.id, s.name])),
        job: Object.fromEntries((jobs.data || []).map(j => [j.id, j.title])),
        request: Object.fromEntries((requests.data || []).map(r => [r.id, r.title])),
      }

      setChats(list.map(c => {
        const profile = profileMap[c.otherId] || {}
        const meta = sourceMeta(c.source)
        // Unaccepted incoming DMs stay gated: you have to open the chat and
        // press "Continue the chat" before anything can be sent there.
        const needsAccept = c.source === 'direct'
          && c.theySent
          && !c.iSent
          && !dmAccepted(currentUserId, c.otherId)
        return {
          ...c,
          needsAccept,
          displayName: profile.full_name || 'User',
          avatarUrl: profile.avatar_url || null,
          isVerified: !!profile.is_verified,
          sourceLabel: meta.label,
          sourceColor: meta.color,
          sourceBg: meta.bg,
          contextTitle: c.contextId ? (titleMap[c.source]?.[c.contextId] || null) : null,
        }
      }))
      setLoading(false)
    }

    loadTargets()
    return () => { cancelled = true }
  }, [currentUserId])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return chats
    return chats.filter(c =>
      c.displayName.toLowerCase().includes(q)
      || (c.contextTitle || '').toLowerCase().includes(q)
      || c.sourceLabel.toLowerCase().includes(q)
    )
  }, [chats, query])

  const itemsLabel = messages.length > 1
    ? `${messages.length} messages`
    : forwardPreviewLabel(messages[0], plainBody(messages[0]))

  function toggle(key) {
    const chat = chats.find(c => c.key === key)
    if (chat?.needsAccept) return
    setSelected(prev => {
      if (prev.includes(key)) return prev.filter(k => k !== key)
      if (prev.length >= FORWARD_TARGET_LIMIT) return prev
      return [...prev, key]
    })
  }

  async function handleSend() {
    if (!selected.length || sending) return
    setSending(true)
    setError(null)
    const targets = selected
      .map(key => chats.find(c => c.key === key))
      .filter(Boolean)

    const result = await forwardMessages({
      fromUserId: currentUserId,
      senderName,
      messages,
      targets,
      plainBody,
    })

    if (!aliveRef.current) return
    setSending(false)
    if (!result.sent) {
      setError('Could not forward. Please try again.')
      return
    }
    onSent?.({ ...result, targets })
  }

  return (
    <div className="chat-action-scrim" onClick={onClose} role="presentation">
      <div
        className="chat-action-sheet fwd-sheet"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-label="Forward to"
      >
        <div className="chat-action-handle" />

        <div className="fwd-head">
          <div>
            <div className="fwd-title">Forward to…</div>
            <div className="fwd-sub">{itemsLabel}</div>
          </div>
          {selected.length > 0 && (
            <span className="fwd-count">{selected.length}/{FORWARD_TARGET_LIMIT}</span>
          )}
        </div>

        <input
          className="fwd-search"
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search chats"
          aria-label="Search chats"
        />

        <div className="fwd-list">
          {loading && <div className="fwd-empty">Loading your chats…</div>}
          {!loading && !filtered.length && (
            <div className="fwd-empty">
              {chats.length ? 'No chats match that search.' : 'No other chats yet.'}
            </div>
          )}
          {!loading && filtered.map(chat => {
            const isSelected = selected.includes(chat.key)
            const atLimit = !isSelected && selected.length >= FORWARD_TARGET_LIMIT
            return (
              <button
                key={chat.key}
                type="button"
                className={`fwd-row${isSelected ? ' is-selected' : ''}`}
                onClick={() => toggle(chat.key)}
                disabled={atLimit || chat.needsAccept}
                title={chat.needsAccept ? 'Open this chat and continue it first' : undefined}
                aria-pressed={isSelected}
              >
                <SafeAvatar url={chat.avatarUrl} name={chat.displayName} size={38} />
                <span className="fwd-row-txt">
                  <span className="fwd-row-name">
                    {chat.displayName}
                    {chat.isVerified && <span className="fwd-verified" aria-label="Verified">✓</span>}
                    {chat.key === currentKey && <span className="fwd-here">This chat</span>}
                  </span>
                  <span className="fwd-row-sub">
                    <span
                      className="fwd-badge"
                      style={{ color: chat.sourceColor, background: chat.sourceBg }}
                    >
                      {chat.sourceLabel}
                    </span>
                    {chat.needsAccept
                      ? <span className="fwd-ctx">Continue this chat first</span>
                      : chat.contextTitle && <span className="fwd-ctx">{chat.contextTitle}</span>}
                  </span>
                </span>
                <span className={`fwd-check${isSelected ? ' is-on' : ''}`} aria-hidden>
                  {isSelected ? '✓' : ''}
                </span>
              </button>
            )
          })}
        </div>

        {error && <div className="fwd-error" role="alert">{error}</div>}

        <button
          type="button"
          className="dm-btn dm-btn-continue fwd-send"
          disabled={!selected.length || sending}
          onClick={handleSend}
        >
          {sending
            ? 'Forwarding…'
            : selected.length
              ? `Forward to ${selected.length} chat${selected.length > 1 ? 's' : ''}`
              : 'Select chats'}
        </button>
        <button type="button" className="chat-action-cancel" onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}
