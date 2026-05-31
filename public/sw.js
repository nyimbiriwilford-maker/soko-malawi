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
  const { callId, fromUser, chatId } = event.notification.data

  if (event.action === 'decline') return

  // chatId may contain slashes (e.g. uuid/uuid) so use it as-is
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
      return self.clients.openWindow(url)
    })
  )
})