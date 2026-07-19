/**
 * Unified chat source system for SokoMw.
 *
 * Six ways people start chatting:
 *  1. listings   — marketplace product
 *  2. services   — service provider
 *  3. jobs       — job poster
 *  4. shops      — shop owner
 *  5. request    — buyer “Looking For”
 *  6. direct     — people search / profile / status
 *
 * URL shape:
 *   /chat/:userId                    ?src=direct
 *   /chat/:userId/:contextId         ?src=listing|service|job|shop|request
 */

export const CHAT_SOURCES = {
  listing: {
    key: 'listing',
    label: 'Listing',
    short: 'Marketplace',
    filterKey: 'marketplace',
    color: '#2563eb',
    bg: '#eff6ff',
    emoji: '🛍️',
  },
  service: {
    key: 'service',
    label: 'Service',
    short: 'Services',
    filterKey: 'services',
    color: '#7c3aed',
    bg: '#f3e8ff',
    emoji: '🔧',
  },
  job: {
    key: 'job',
    label: 'Job',
    short: 'Jobs',
    filterKey: 'jobs',
    color: '#2563eb',
    bg: '#eff6ff',
    emoji: '💼',
  },
  shop: {
    key: 'shop',
    label: 'Shop',
    short: 'Shops',
    filterKey: 'shops',
    color: '#0891b2',
    bg: '#e0f7fa',
    emoji: '🏪',
  },
  request: {
    key: 'request',
    label: 'Looking For',
    short: 'Requests',
    filterKey: 'requests',
    color: '#c9820a',
    bg: '#fef3e0',
    emoji: '🔎',
  },
  direct: {
    key: 'direct',
    label: 'Direct',
    short: 'Direct',
    filterKey: 'direct',
    color: '#637068',
    bg: '#eef2ef',
    emoji: '💬',
  },
}

export const SOURCE_KEYS = Object.keys(CHAT_SOURCES)

/** Build a chat route with source identity preserved in the query string. */
export function buildChatPath(userId, { source = 'direct', contextId = null } = {}) {
  if (!userId) return '/chats'
  const src = CHAT_SOURCES[source] ? source : 'direct'
  const hasCtx = contextId && contextId !== 'undefined' && src !== 'direct'
  const base = hasCtx ? `/chat/${userId}/${contextId}` : `/chat/${userId}`
  const qs = new URLSearchParams({ src })
  return `${base}?${qs.toString()}`
}

/** Resolve source from URL search + location.state + optional contextId. */
export function resolveChatSource({ searchParams, locationState, contextId } = {}) {
  const fromState = locationState?.source || locationState?.src || locationState?.chatSource
  const fromQuery = searchParams?.get?.('src') || searchParams?.get?.('source')
  const raw = (fromState || fromQuery || '').toString().toLowerCase()

  if (CHAT_SOURCES[raw]) return raw
  // Legacy looking-for flag
  if (locationState?.isRequest) return 'request'
  // Context without explicit source → unknown (caller should detect)
  if (contextId && contextId !== 'undefined') return null
  return 'direct'
}

/**
 * Columns to set on a messages insert for a given source.
 * Safe to include extra keys; Chat.jsx strips unknowns if the DB rejects them.
 */
export function messageContextFields(source, contextId) {
  const src = CHAT_SOURCES[source] ? source : 'direct'
  const id = contextId && contextId !== 'undefined' ? contextId : null
  const base = { chat_source: src }

  if (!id || src === 'direct') {
    return { ...base, chat_source: 'direct' }
  }

  switch (src) {
    case 'listing':
      return { ...base, listing_id: id }
    case 'service':
      return { ...base, service_id: id }
    case 'job':
      return { ...base, job_id: id }
    case 'shop':
      return { ...base, shop_id: id }
    case 'request':
      return { ...base, request_id: id }
    default:
      return base
  }
}

/** Conversation grouping key used by the chat list. */
export function conversationKey(otherId, source, contextId) {
  const src = CHAT_SOURCES[source] ? source : 'direct'
  if (!contextId || src === 'direct') return `dir:${otherId}`
  const prefix = {
    listing: 'lst',
    service: 'svc',
    job: 'job',
    shop: 'shp',
    request: 'req',
  }[src] || 'ctx'
  return `${prefix}:${otherId}:${contextId}`
}

/** Infer source from a messages row (after optional chat_source column). */
export function sourceFromMessage(msg) {
  if (!msg) return 'direct'
  if (msg.chat_source && CHAT_SOURCES[msg.chat_source]) return msg.chat_source
  if (msg.service_id) return 'service'
  if (msg.job_id) return 'job'
  if (msg.shop_id) return 'shop'
  if (msg.request_id) return 'request'
  if (msg.listing_id) return 'listing'
  return 'direct'
}

export function contextIdFromMessage(msg) {
  if (!msg) return null
  const src = sourceFromMessage(msg)
  switch (src) {
    case 'service': return msg.service_id || null
    case 'job': return msg.job_id || null
    case 'shop': return msg.shop_id || null
    case 'request': return msg.request_id || null
    case 'listing': return msg.listing_id || null
    default: return null
  }
}

/** Deep-link back to the originating entity. */
export function sourceHref(source, entity) {
  if (!entity) return null
  switch (source) {
    case 'listing': return entity.id ? `/listing/${entity.id}` : null
    case 'service': return '/services'
    case 'job': return '/jobs'
    case 'shop': return entity.slug ? `/shop/${entity.slug}` : '/shops'
    case 'request': return '/looking-for'
    default: return null
  }
}

export function sourceMeta(source) {
  return CHAT_SOURCES[source] || CHAT_SOURCES.direct
}

// ── Per-user deleted / hidden conversations (client-side) ─────────────────

export function deletedChatsStorageKey(userId) {
  return userId ? `soko_deleted_chats_${userId}` : 'soko_deleted_chats'
}

export function loadDeletedChatKeys(userId) {
  try {
    const raw = localStorage.getItem(deletedChatsStorageKey(userId))
    const arr = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(arr) ? arr : [])
  } catch {
    return new Set()
  }
}

export function saveDeletedChatKeys(userId, keySet) {
  try {
    localStorage.setItem(deletedChatsStorageKey(userId), JSON.stringify([...keySet]))
  } catch { /* ignore */ }
}

export function markChatDeleted(userId, chatKey) {
  if (!userId || !chatKey) return
  const set = loadDeletedChatKeys(userId)
  set.add(chatKey)
  saveDeletedChatKeys(userId, set)
  try {
    window.dispatchEvent(new CustomEvent('soko:chats-deleted', { detail: { key: chatKey } }))
  } catch { /* ignore */ }
}

export function unmarkChatDeleted(userId, chatKey) {
  if (!userId || !chatKey) return
  const set = loadDeletedChatKeys(userId)
  set.delete(chatKey)
  saveDeletedChatKeys(userId, set)
}
