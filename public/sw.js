self.addEventListener('push', event => {
  const data = event.data?.json() || {}

  const options = {
    body: `${data.callerName} is calling you`,
    icon: data.callerAvatar || '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'incoming-call',          // replaces duplicate notifications
    renotify: true,                // re-rings even if tag exists
    requireInteraction: true,      // keeps notification visible (doesn't auto-dismiss)
    vibrate: [200, 100, 200, 100, 200],  // vibration pattern
    data: {
      callId: data.callId,
      fromUser: data.fromUser,
      callType: data.callType,
      url: `/chat/${data.fromUser}`  // where to go on tap
    },
    actions: [
      { action: 'answer', title: '✅ Answer' },
      { action: 'decline', title: '❌ Decline' }
    ]
  }

  event.waitUntil(
    self.registration.showNotification(`Incoming ${data.callType} Call`, options)
  )
})

// Handle notification button clicks
self.addEventListener('notificationclick', event => {
  event.notification.close()

  if (event.action === 'answer') {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    )
  } else if (event.action === 'decline') {
    // optionally send a decline signal here
    console.log('Call declined')
  } else {
    // tapped the notification body
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    )
  }
})