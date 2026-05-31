self.addEventListener('push', event => {
  const data = event.data?.json() || {}

  const options = {
    body: `${data.callerName} is calling you`,
    icon: data.callerAvatar || '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'incoming-call',
    renotify: true,
    requireInteraction: true,
    vibrate: [500, 200, 500, 200, 500, 200, 500, 200, 500, 200, 500],
    data: {
      callId: data.callId,
      fromUser: data.fromUser,
      callType: data.callType,
      chatId: data.chatId,
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
      // Forward to app if open so it can play ringtone
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        clientList.forEach(client => {
          client.postMessage({ type: 'INCOMING_CALL', ...data })
        })
      })
    ])
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const { callId, fromUser, chatId } = event.notification.data

  if (event.action === 'decline') {
    // Notify app to stop ringtone
    event.waitUntil(
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
        clientList.forEach(c => c.postMessage({ type: 'DECLINE_CALL', callId, fromUser }))
      })
    )
    return
  }

  const url = chatId ? `/chat/${chatId}` : `/chat/${fromUser}`

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus()
          client.postMessage({ type: 'ANSWER_CALL', callId, fromUser, chatId })
          return
        }
      }
      // App is closed — open it, call will be handled via restorePendingCall
      return self.clients.openWindow(url)
    })
  )
})