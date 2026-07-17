/**
 * Call-related notifications (missed / declined).
 *
 * Missed: only the *caller* notifies the *callee* (timeout / cancel without answer).
 * Declined: the *callee* notifies the *caller* that they rejected the call.
 */

import { supabase } from '../lib/supabase'

async function resolveName(userId, fallbackName) {
  if (fallbackName) return fallbackName
  if (!userId) return 'Someone'
  try {
    const { data } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle()
    return data?.full_name || 'Someone'
  } catch {
    return 'Someone'
  }
}

/**
 * Notify the callee that they missed an incoming call.
 * Caller → callee only.
 */
export async function notifyMissedCall({
  toUserId,
  callerId,
  callerName,
  callType = 'voice',
  contextId = null,
  messageId = null,
  listingTitle = null,
}) {
  if (!toUserId || !callerId) return { error: { message: 'Missing user ids' } }
  if (toUserId === callerId) return { error: { message: 'Invalid missed-call parties' } }

  const name = await resolveName(callerId, callerName)
  const isVideo = callType === 'video'
  const body = `You missed a ${isVideo ? 'video' : 'voice'} call from ${name}`

  const { error } = await supabase.from('notifications').insert({
    user_id: toUserId,
    type: isVideo ? 'missed_video' : 'missed_call',
    title: isVideo ? '📹 Missed video call' : '📞 Missed call',
    body,
    message: body,
    data: {
      caller_id: callerId,
      caller_name: name,
      context_id: contextId,
      message_id: messageId || null,
      listing_title: listingTitle || null,
    },
    read: false,
  })

  if (error) {
    console.warn('[callNotifications] notifyMissedCall failed:', error.message)
    return { error }
  }
  return { error: null }
}

/**
 * Notify the caller that the callee declined the call.
 * Callee → caller only.
 */
export async function notifyCallDeclined({
  toUserId,
  declinerId,
  declinerName,
  callType = 'voice',
  contextId = null,
  messageId = null,
  listingTitle = null,
}) {
  if (!toUserId || !declinerId) return { error: { message: 'Missing user ids' } }
  if (toUserId === declinerId) return { error: { message: 'Invalid decline parties' } }

  const name = await resolveName(declinerId, declinerName)
  const isVideo = callType === 'video'
  const body = `${name} declined your ${isVideo ? 'video' : 'voice'} call`

  const { error } = await supabase.from('notifications').insert({
    user_id: toUserId,
    type: 'missed_call', // reuse type so existing UI still surfaces it
    title: '📵 Call declined',
    body,
    message: body,
    data: {
      caller_id: toUserId,
      decliner_id: declinerId,
      decliner_name: name,
      declined: true,
      context_id: contextId,
      message_id: messageId || null,
      listing_title: listingTitle || null,
      call_type: callType,
    },
    read: false,
  })

  if (error) {
    console.warn('[callNotifications] notifyCallDeclined failed:', error.message)
    return { error }
  }
  return { error: null }
}

/**
 * Build the path the *receiver* should open to chat with the *caller*.
 * Always uses caller id first — never the callee's own id.
 *
 * @param {string} callerId
 * @param {string|null|undefined} listingOrServiceId
 * @returns {string} e.g. "callerUuid" or "callerUuid/listingUuid"
 */
export function buildReceiverChatId(callerId, listingOrServiceId) {
  if (!callerId) return ''
  if (listingOrServiceId && listingOrServiceId !== 'undefined') {
    return `${callerId}/${listingOrServiceId}`
  }
  return callerId
}

/**
 * Normalize a chatId / fromUser into a /chat/... path.
 */
export function chatPathFromCallIds(chatId, fromUser) {
  if (chatId) {
    const cleaned = String(chatId).replace(/^\/chat\//, '').replace(/^\//, '')
    return cleaned ? `/chat/${cleaned}` : (fromUser ? `/chat/${fromUser}` : '/chats')
  }
  return fromUser ? `/chat/${fromUser}` : '/chats'
}
