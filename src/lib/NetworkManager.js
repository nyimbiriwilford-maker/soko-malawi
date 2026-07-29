/**
 * NetworkManager — singleton
 * Runs a continuous background heartbeat (both online and offline states)
 * against cross-origin endpoints that a service worker cannot intercept,
 * so DNS/connectivity failures are caught even when the browser never
 * fires a native 'offline' event.
 *
 * Tries multiple well-known connectivity-check URLs (used by Android,
 * ChromeOS, and Apple) so that a single blocked CDN doesn't cause a
 * false offline reading.  Never falls back to same-origin URLs because
 * the service worker would serve a cached response and lie that the
 * network is alive.
 *
 * Uses a failure threshold so transient DNS blips don't falsely declare
 * offline, and a success threshold so we don't declare online until the
 * connection is confirmed stable.
 */

const HEALTH_CHECK_URLS = [
  'https://www.gstatic.com/generate_204',
  'https://connectivitycheck.gstatic.com/generate_204',
  'https://clients3.google.com/generate_204',
]

const ONLINE_POLL_INTERVAL_MS = 15000
const OFFLINE_POLL_INTERVAL_MS = 7000
const CONSECUTIVE_SUCCESS_THRESHOLD = 2
const CONSECUTIVE_FAILURE_THRESHOLD = 2
const HEALTH_CHECK_TIMEOUT_MS = 5000

class NetworkManager {
  constructor() {
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    this.isOffline = !this.isOnline
    this.isChecking = false
    this.reconnecting = false
    this.lastConnectionTime = this.isOnline ? Date.now() : null

    this._listeners = {
      online: new Set(),
      offline: new Set(),
      reconnecting: new Set(),
      checking: new Set(),
    }

    this._consecutiveSuccesses = 0
    this._consecutiveFailures = 0
    this._pollTimer = null
    this._queue = []

    this._handleBrowserOnline = this._handleBrowserOnline.bind(this)
    this._handleBrowserOffline = this._handleBrowserOffline.bind(this)

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this._handleBrowserOnline)
      window.addEventListener('offline', this._handleBrowserOffline)
    }

    this._startPolling()
  }

  // ---- public API ----------------------------------------------------

  on(event, cb) {
    if (!this._listeners[event]) return () => {}
    this._listeners[event].add(cb)
    return () => this._listeners[event].delete(cb)
  }

  off(event, cb) {
    this._listeners[event]?.delete(cb)
  }

  forceCheck() {
    return this._healthCheck()
  }

  enqueue(config) {
    this._queue.push(config)
  }

  // ---- internals -------------------------------------------------------

  _emit(event) {
    this._listeners[event]?.forEach((cb) => {
      try {
        cb(this._snapshot())
      } catch (err) {
        console.error('[NetworkManager] listener error:', err)
      }
    })
  }

  _snapshot() {
    return {
      isOnline: this.isOnline,
      isOffline: this.isOffline,
      isChecking: this.isChecking,
      reconnecting: this.reconnecting,
      lastConnectionTime: this.lastConnectionTime,
    }
  }

  _handleBrowserOnline() {
    this.reconnecting = true
    this._emit('reconnecting')
    this._consecutiveSuccesses = 0
    this._consecutiveFailures = 0
    this._restartPolling(OFFLINE_POLL_INTERVAL_MS)
  }

  _handleBrowserOffline() {
    this._goOffline()
  }

  _goOffline() {
    this._consecutiveSuccesses = 0
    if (this.isOffline) {
      this._restartPolling(OFFLINE_POLL_INTERVAL_MS)
      return
    }
    this.isOnline = false
    this.isOffline = true
    this.reconnecting = false
    this._emit('offline')
    this._restartPolling(OFFLINE_POLL_INTERVAL_MS)
  }

  _goOnline() {
    const wasOffline = this.isOffline
    this.isOnline = true
    this.isOffline = false
    this.reconnecting = false
    this._consecutiveFailures = 0
    this.lastConnectionTime = Date.now()
    this._restartPolling(ONLINE_POLL_INTERVAL_MS)
    if (wasOffline) {
      this._emit('online')
      this._flushQueue()
    }
  }

  _startPolling() {
    const interval = this.isOffline ? OFFLINE_POLL_INTERVAL_MS : ONLINE_POLL_INTERVAL_MS
    this._healthCheck()
    this._pollTimer = setInterval(() => this._healthCheck(), interval)
  }

  _restartPolling(intervalMs) {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
    }
    this._pollTimer = setInterval(() => this._healthCheck(), intervalMs)
  }

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
      this._pollTimer = null
    }
  }

  _fetchWithTimeout(url, mode) {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS)
    const bustUrl = `${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`

    return fetch(bustUrl, {
      method: 'GET',
      mode,
      cache: 'no-store',
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout))
  }

  async _healthCheck() {
    if (this.isChecking) return
    this.isChecking = true
    this._emit('checking')

    let alive = false
    for (const url of HEALTH_CHECK_URLS) {
      try {
        await this._fetchWithTimeout(url, 'no-cors')
        alive = true
        break
      } catch {
        // try next endpoint
      }
    }

    this.isChecking = false

    if (alive) {
      this._consecutiveSuccesses += 1
      this._consecutiveFailures = 0
      if (this._consecutiveSuccesses >= CONSECUTIVE_SUCCESS_THRESHOLD) {
        this._goOnline()
      }
    } else {
      this._consecutiveSuccesses = 0
      this._consecutiveFailures += 1
      if (this._consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD) {
        this._goOffline()
      }
    }
  }

  async _flushQueue() {
    const jobs = this._queue.splice(0, this._queue.length)
    for (const config of jobs) {
      try {
        if (typeof config === 'function') {
          await config()
        } else if (config && typeof config.retry === 'function') {
          await config.retry()
        }
      } catch (err) {
        console.error('[NetworkManager] queued job failed:', err)
      }
    }
  }
}

const instance = new NetworkManager()
export default instance
