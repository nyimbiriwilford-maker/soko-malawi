export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]
}

export function generateCallId(userId1, userId2) {
  return [userId1, userId2].sort().join('-') + '-' + Date.now()
}