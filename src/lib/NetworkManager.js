/**
 * NetworkManager — singleton
 * Runs a continuous background heartbeat (both online and offline states)
 * against a cross-origin, no-cache endpoint that a service worker cannot
 * intercept, so DNS/connectivity failures are caught even when the browser
 * never fires a native 'offline' event.
 */

// Cross-origin, cache-proof connectivity probe (same technique Chromium/
// Android use internally). Swap for your own backend host if you'd rather
// test reachability to Supabase specifically, e.g.
// `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`
const HEALTH_CHECK_URL = 'https://www.gstatic.com/generate_204'

const ONLINE_POLL_INTERVAL_MS = 15000   // heartbeat while believed online
const OFFLINE_POLL_INTERVAL_MS = 7000   // faster retry while offline
const CONSECUTIVE_SUCCESS_THRESHOLD = 2
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
    this._pollTimer = null
    this._queue = []

    this._handleBrowserOnline = this._handleBrowserOnline.bind(this)
    this._handleBrowserOffline = this._handleBrowserOffline.bind(this)

    if (typeof window !== 'undefined') {
      window.addEventListener('online', this._handleBrowserOnline)
      window.addEventListener('offline', this._handleBrowserOffline)
    }

    // Always run the heartbeat, regardless of current believed state —
    // this is the fix: we no longer wait for a browser 'offline' event
    // before we start actively checking.
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
    // Don't trust the browser event blindly — verify with a real request.
    this.reconnecting = true
    this._emit('reconnecting')
    this._consecutiveSuccesses = 0
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

  async _healthCheck() {
    if (this.isChecking) return
    this.isChecking = true
    this._emit('checking')

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS)
    const bustUrl = `${HEALTH_CHECK_URL}${HEALTH_CHECK_URL.includes('?') ? '&' : '?'}_=${Date.now()}`

    try {
      // no-cors: we can't read the response body/status cross-origin, but a
      // resolved promise means the network path (DNS + TCP + TLS) is alive.
      // A DNS failure or dead connection rejects the promise, which is all
      // we need to detect.
      await fetch(bustUrl, {
        method: 'GET',
        mode: 'no-cors',
        cache: 'no-store',
        signal: controller.signal,
      })
      clearTimeout(timeout)
      this.isChecking = false

      this._consecutiveSuccesses += 1
      if (this._consecutiveSuccesses >= CONSECUTIVE_SUCCESS_THRESHOLD) {
        this._goOnline()
      }
    } catch (err) {
      clearTimeout(timeout)
      this.isChecking = false
      this._goOffline()
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

// Singleton instance
const instance = new NetworkManager()
export default instance
