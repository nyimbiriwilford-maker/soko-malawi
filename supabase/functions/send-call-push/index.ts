import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import webpush from 'https://esm.sh/web-push@3.6.6'

const VAPID_PUBLIC  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_EMAIL   = Deno.env.get('VAPID_EMAIL')!

webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE)

serve(async req => {
  const { targetUserId, callerName, callerAvatar, callType, callId, fromUser } = await req.json()

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', targetUserId)

  if (!subs?.length) return new Response('no subscription', { status: 200 })

  const payload = JSON.stringify({ callerName, callerAvatar, callType, callId, fromUser })

  await Promise.all(subs.map(sub =>
    webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      payload
    ).catch(e => console.error('push error:', e))
  ))

  return new Response('ok', { status: 200 })
})