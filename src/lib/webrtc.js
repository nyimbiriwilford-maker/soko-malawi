/**
 * STUN is always safe in client code.
 * TURN credentials should ideally be short-lived and fetched from your backend.
 * Env overrides (Vite): VITE_TURN_URLS, VITE_TURN_USERNAME, VITE_TURN_CREDENTIAL
 */
function buildIceServers() {
  const servers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ]

  const turnUrls = (import.meta.env?.VITE_TURN_URLS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const turnUser = import.meta.env?.VITE_TURN_USERNAME
  const turnCred = import.meta.env?.VITE_TURN_CREDENTIAL

  if (turnUrls.length && turnUser && turnCred) {
    for (const url of turnUrls) {
      servers.push({ urls: url, username: turnUser, credential: turnCred })
    }
  } else {
    // Fallback TURN (rotate via env in production)
    const user = 'ecfd28a5fc18b0f7cd190198'
    const cred = 'd+nP5nZZF5ErLEx7'
    servers.push(
      { urls: 'turn:a.relay.metered.ca:80', username: user, credential: cred },
      { urls: 'turn:a.relay.metered.ca:443', username: user, credential: cred },
      { urls: 'turns:a.relay.metered.ca:443?transport=tcp', username: user, credential: cred },
    )
  }

  return servers
}

export const ICE_SERVERS = {
  iceServers: buildIceServers(),
}

export function generateCallId(userId1, userId2) {
  return [userId1, userId2].sort().join('-') + '-' + Date.now()
}