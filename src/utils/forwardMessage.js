/**
 * Forwarding messages between chats.
 *
 * A forwarded message is a brand-new `messages` row addressed to the target
 * conversation. Body and media are copied verbatim, reply metadata is dropped
 * (it points at a message the new recipient can't see) and a marker prefix is
 * added so the bubble can render a "Forwarded" label.
 *
 * Marker: \x02FWD\x03<body> — control characters, so it stays invisible in any
 * consumer that hasn't been taught to strip it.
 */

import { supabase } from '../lib/supabase'
import { messageContextFields } from './chatSources'

export const FORWARD_MARK = '\x02FWD\x03'

// eslint-disable-next-line no-control-regex
const FORWARD_RE = /^(?:\x02FWD\x03)+/

/** Max chats a single forward can fan out to. */
export const FORWARD_TARGET_LIMIT = 10

/** Add the forwarded marker (idempotent — never stacks). */
export function encodeForward(body) {
  const raw = stripForwardMark(body).body
  return `${FORWARD_MARK}${raw ?? ''}`
}

/** Remove the forwarded marker. Returns { body, isForwarded }. */
export function stripForwardMark(body) {
  if (!body || typeof body !== 'string') return { body, isForwarded: false }
  if (!FORWARD_RE.test(body)) return { body, isForwarded: false }
  return { body: body.replace(FORWARD_RE, ''), isForwarded: true }
}

/**
 * Offers, call logs and deal cards carry conversation-specific state, so they
 * can't be handed to a different chat. Everything else forwards.
 */
export function canForwardMessage(msg) {
  if (!msg) return false
  if (msg.deleted_at) return false
  if (msg.call_type || msg.call_status) return false
  if (msg.media_type === 'offer' || msg.media_type === 'deal_request') return false
  if (String(msg.id).startsWith('temp_') || String(msg.id).startsWith('pending_group_')) return false
  if (msg._status === 'sending' || msg._status === 'failed') return false
  return !!(msg.media_url || String(msg.body || '').trim())
}

/** Short human label for a message, used in pickers and notifications. */
export function forwardPreviewLabel(msg, plainBody = '') {
  const text = String(plainBody || '').trim()
  if (text) return text.slice(0, 80)
  switch (msg?.media_type) {
    case 'image': return '📷 Photo'
    case 'video': return '🎥 Video'
    case 'audio': return '🎤 Voice note'
    case 'file': return '📎 File'
    default: return 'Message'
  }
}

/**
 * Insert one forwarded row. Retries without the newer source columns when the
 * database hasn't been migrated yet (mirrors Chat.jsx sendMessage).
 */
async function insertForwardRow(row) {
  let res = await supabase.from('messages').insert(row).select('*').single()
  if (res.error && /chat_source|job_id|shop_id|request_id|column/i.test(res.error.message || '')) {
    const legacy = { ...row }
    delete legacy.chat_source
    delete legacy.job_id
    delete legacy.shop_id
    delete legacy.request_id
    res = await supabase.from('messages').insert(legacy).select('*').single()
  }
  return res
}

/**
 * Forward messages to one or more conversations.
 *
 * @param {object}   params
 * @param {string}   params.fromUserId
 * @param {string}   [params.senderName]
 * @param {Array}    params.messages  message rows to forward, oldest first
 * @param {Array}    params.targets   [{ otherId, source, contextId }]
 * @param {function} [params.plainBody] (msg) => body with reply/forward markers stripped
 * @returns {Promise<{ sent: number, failed: number, rowsByTarget: Object }>}
 */
export async function forwardMessages({
  fromUserId,
  senderName = 'Someone',
  messages = [],
  targets = [],
  plainBody = (m) => m?.body || '',
}) {
  if (!fromUserId || !messages.length || !targets.length) {
    return { sent: 0, failed: 0, rowsByTarget: {} }
  }

  const forwardable = messages.filter(canForwardMessage)
  if (!forwardable.length) return { sent: 0, failed: 0, rowsByTarget: {} }

  let sent = 0
  let failed = 0
  const rowsByTarget = {}

  for (const target of targets.slice(0, FORWARD_TARGET_LIMIT)) {
    if (!target?.otherId) continue
    const contextFields = messageContextFields(target.source, target.contextId)
    const inserted = []

    for (const msg of forwardable) {
      const row = {
        from_user: fromUserId,
        to_user: target.otherId,
        body: encodeForward(plainBody(msg)),
        media_url: msg.media_url || null,
        media_type: msg.media_type || 'text',
        read: false,
        ...contextFields,
      }
      const { data, error } = await insertForwardRow(row)
      if (error) {
        failed += 1
        console.warn('Forward failed:', error.message)
        continue
      }
      sent += 1
      inserted.push(data)
    }

    if (!inserted.length) continue
    rowsByTarget[target.key || `${target.source}:${target.otherId}:${target.contextId || ''}`] = inserted

    // One notification per target, previewing the last forwarded item.
    try {
      const last = forwardable[forwardable.length - 1]
      const base = forwardPreviewLabel(last, plainBody(last))
      const preview = inserted.length > 1
        ? `Forwarded ${inserted.length} messages`
        : `↪ ${base}`
      await supabase.from('notifications').insert({
        user_id: target.otherId,
        type: 'new_message',
        title: senderName,
        body: preview.slice(0, 80),
        message: preview.slice(0, 80),
        data: {
          sender_id: fromUserId,
          sender_name: senderName,
          context_id: target.contextId || null,
          message_id: inserted[inserted.length - 1]?.id || null,
          chat_source: target.source || 'direct',
          forwarded: true,
        },
        read: false,
      })
    } catch (err) {
      console.warn('Forward notification error:', err)
    }
  }

  try {
    window.dispatchEvent(new Event('soko:messages-updated'))
  } catch { /* ignore */ }

  return { sent, failed, rowsByTarget }
}
