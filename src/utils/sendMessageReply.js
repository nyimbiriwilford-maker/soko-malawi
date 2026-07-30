import { supabase } from '../lib/supabase'
import { messageContextFields } from './chatSources'

function buildPreview(body, mediaUrl, mediaType) {
  let preview = body
  if (preview?.includes('|||')) {
    preview = preview.replace(/^\x02?\[/, '').split('|||')[0].trim()
  }
  if (!preview) {
    preview = mediaUrl
      ? (mediaType === 'image' ? '📷 Photo'
       : mediaType === 'video' ? '🎥 Video'
       : mediaType === 'audio' ? '🎤 Voice note'
       : '📎 File')
      : 'Sent a message'
  }
  return preview
}

export async function sendChatMessage({
  toUserId,
  body,
  mediaUrl,
  mediaType,
  chatSource,
  contextId,
  senderName,
  contextTitle,
  extraFields,
  skipNotification,
}) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: { message: 'Not authenticated' } }

  let name = senderName
  if (!name) {
    const { data: prof } = await supabase
      .from('profiles').select('full_name').eq('id', user.id).maybeSingle()
    name = prof?.full_name || 'Someone'
  }

  const contextFields = messageContextFields(chatSource || 'direct', contextId)

  const msgData = {
    from_user: user.id,
    to_user: toUserId,
    body: body || '',
    media_url: mediaUrl || null,
    media_type: mediaType || 'text',
    read: false,
    ...contextFields,
    ...extraFields,
  }

  let inserted = null
  let error = null

  {
    const res = await supabase.from('messages').insert(msgData).select('*').single()
    inserted = res.data
    error = res.error
  }
  if (error && /chat_source|job_id|shop_id|request_id|column/i.test(error.message || '')) {
    const legacy = { ...msgData }
    delete legacy.chat_source
    delete legacy.job_id
    delete legacy.shop_id
    delete legacy.request_id
    const res2 = await supabase.from('messages').insert(legacy).select('*').single()
    inserted = res2.data
    error = res2.error
  }

  if (error) return { error }

  if (!skipNotification) {
    const preview = buildPreview(body, mediaUrl, mediaType).slice(0, 80)

    await supabase.from('notifications').insert({
      user_id: toUserId,
      type: 'new_message',
      title: name,
      body: preview,
      message: preview,
      data: {
        sender_id: user.id,
        sender_name: name,
        context_id: contextId || null,
        message_id: inserted?.id || null,
        chat_source: chatSource || 'direct',
        listing_title: contextTitle || null,
      },
      read: false,
    })
  }

  window.dispatchEvent(new Event('soko:messages-updated'))

  return { data: inserted }
}

export async function sendMessageReply({ toUserId, body, contextId, listingTitle }) {
  return sendChatMessage({
    toUserId,
    body,
    mediaType: 'text',
    contextId,
    contextTitle: listingTitle,
  })
}
