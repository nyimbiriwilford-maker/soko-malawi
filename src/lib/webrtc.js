export const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    {
      urls: 'turn:a.relay.metered.ca:80',
      username: 'ecfd28a5fc18b0f7cd190198',
      credential: 'd+nP5nZZF5ErLEx7'
    },
    {
      urls: 'turn:a.relay.metered.ca:443',
      username: 'ecfd28a5fc18b0f7cd190198',
      credential: 'd+nP5nZZF5ErLEx7'
    },
    {
      urls: 'turns:a.relay.metered.ca:443?transport=tcp',
      username: 'ecfd28a5fc18b0f7cd190198',
      credential: 'd+nP5nZZF5ErLEx7'
    }
  ]
}

export function generateCallId(userId1, userId2) {
  return [userId1, userId2].sort().join('-') + '-' + Date.now()
}