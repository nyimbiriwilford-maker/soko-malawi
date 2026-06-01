const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  return new Uint8Array([...rawData].map(c => c.charCodeAt(0)))
}

export async function registerPushNotifications(userId, supabase) {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.log('Push not supported')
    return null
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js')
    await navigator.serviceWorker.ready

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.log('Push permission denied')
      return null
    }

    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })
    }

    const subJson = sub.toJSON()
    await supabase.from('push_subscriptions').upsert({
      user_id: userId,
      endpoint: subJson.endpoint,
      p256dh: subJson.keys.p256dh,
      auth: subJson.keys.auth,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' })

    console.log('[push] subscribed')
    return sub
  } catch (e) {
    console.error('[push] registration error:', e)
    return null
  }
}

export async function listenForServiceWorkerMessages(handlers) {
  if (!('serviceWorker' in navigator)) return

  navigator.serviceWorker.addEventListener('message', e => {
    const { type, callId, fromUser, chatId, callType, callerName } = e.data || {}

    if (type === 'INCOMING_CALL' && handlers.onIncomingCall) {
      handlers.onIncomingCall({ callId, fromUser, chatId, callType, callerName })
    }
    if (type === 'ANSWER_CALL' && handlers.onAnswer) {
      handlers.onAnswer(fromUser, callId, chatId)
    }
    if (type === 'DECLINE_CALL' && handlers.onDecline) {
      handlers.onDecline(fromUser, callId)
    }
  })
}