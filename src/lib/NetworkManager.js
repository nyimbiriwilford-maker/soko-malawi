/**
 * NetworkManager — singleton
 * Uses navigator.onLine + browser online/offline events — no network request.
 */

const ONLINE_POLL_INTERVAL_MS = 15000
const OFFLINE_POLL_INTERVAL_MS = 500
const CONSECUTIVE_SUCCESS_THRESHOLD = 2
const CONSECUTIVE_FAILURE_THRESHOLD = 1
const CHECK_COOLDOWN_MS = 5000
const MAX_CONSECUTIVE_FAILURES = 5

class NetworkManager {
  constructor() {
    this.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
    this.isOffline = !this.isOnline
    this.isChecking = false
    this.reconnecting = false
    this.lastConnectionTime = this.isOnline ? Date.now() : null

    this._lastCheckTime = 0

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
    this._abortController = null

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
    return this._healthCheck(true)
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
    this._consecutiveSuccesses = 0
    this._consecutiveFailures = 0
    this._emit('reconnecting')
    this._restartPolling(OFFLINE_POLL_INTERVAL_MS)
  }

  _handleBrowserOffline() {
    this._goOffline()
  }

  _goOffline() {
    this._consecutiveSuccesses = 0
    if (this.isOffline) {
      if (this._consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        this._stopPolling()
      } else {
        this._restartPolling(OFFLINE_POLL_INTERVAL_MS)
      }
      return
    }
    this.isOnline = false
    this.isOffline = true
    this.reconnecting = false
    this._emit('offline')
    if (this._consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
      this._stopPolling()
    } else {
      this._restartPolling(OFFLINE_POLL_INTERVAL_MS)
    }
  }

  _goOnline() {
    const wasOffline = this.isOffline
    this.isOnline = true
    this.isOffline = false
    this.reconnecting = false
    this._consecutiveSuccesses = 0
    this._consecutiveFailures = 0
    this.lastConnectionTime = Date.now()
    if (wasOffline) {
      this._restartPolling(ONLINE_POLL_INTERVAL_MS)
      this._emit('online')
      this._flushQueue()
    }
  }

  _startPolling() {
    const interval = this.isOffline ? OFFLINE_POLL_INTERVAL_MS : ONLINE_POLL_INTERVAL_MS
    this._healthCheck()
    this._pollTimer = setInterval(() => {
      if (this._shouldStopPolling()) {
        this._stopPolling()
        return
      }
      this._healthCheck()
    }, interval)
  }

  _shouldStopPolling() {
    return this._consecutiveFailures >= MAX_CONSECUTIVE_FAILURES && this.isOffline
  }

  _restartPolling(intervalMs) {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
    }
    this._healthCheck()
    this._pollTimer = setInterval(() => this._healthCheck(), intervalMs)
  }

  _stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer)
      this._pollTimer = null
    }
  }

  async _healthCheck(force = false) {
    if (this.isChecking) return

    const now = Date.now()
    if (!force && (now - this._lastCheckTime < CHECK_COOLDOWN_MS)) return

    if (this._abortController) {
      this._abortController.abort()
    }

    this._lastCheckTime = now
    this.isChecking = true
    this._emit('checking')

    try {
      const alive = typeof navigator !== 'undefined' ? navigator.onLine : true

      if (alive) {
        this._consecutiveSuccesses += 1
        this._consecutiveFailures = 0
        if (this._consecutiveSuccesses >= CONSECUTIVE_SUCCESS_THRESHOLD) {
          this._goOnline()
        }
      } else {
        this._consecutiveSuccesses = 0
        this._consecutiveFailures += 1

        if (this._consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
          if (!this.isOffline) {
            this._goOffline()
          } else {
            this._stopPolling()
          }
        } else if (this._consecutiveFailures >= CONSECUTIVE_FAILURE_THRESHOLD) {
          this._goOffline()
        }
      }
    } finally {
      this.isChecking = false
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
