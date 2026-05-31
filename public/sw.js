self.addEventListener('push', event => {
  const data = event.data?.json() || {}

  const options = {
    body: `${data.callerName} is calling you`,
    icon: data.callerAvatar || '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'incoming-call',
    renotify: true,
    requireInteraction: true,
    vibrate: [500, 200, 500, 200, 500, 200, 500],
    data: {
      callId: data.callId,
      fromUser: data.fromUser,
      callType: data.callType,
      chatId: data.chatId,        // make sure you pass this from the caller
    },
    actions: [
      { action: 'answer', title: '✅ Answer' },
      { action: 'decline', title: '❌ Decline' }
    ]
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(
        `📞 Incoming ${data.callType || 'Video'} Call from ${data.callerName}`,
        options
      ),
      // Play ringtone by opening a silent client-side action
      self.clients.matchAll({ type: 'window' }).then(clientList => {
        clientList.forEach(client => {
          client.postMessage({ type: 'INCOMING_CALL', ...data })
        })
      })
    ])
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const { callId, fromUser, chatId, callType } = event.notification.data

  let url = '/'
  if (event.action === 'answer' || event.action === '') {
    // Go to the correct chat — use chatId if available, else fromUser
    url = chatId ? `/chat/${chatId}` : `/chat/${fromUser}`
  }

  if (event.action === 'decline') {
    // Just close, optionally post a decline message
    return
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes('/chat/') && 'focus' in client) {
          client.focus()
          client.postMessage({ type: 'ANSWER_CALL', callId, fromUser, chatId })
          return
        }
      }
      // Otherwise open the app
      return self.clients.openWindow(url)
    })
  )
})