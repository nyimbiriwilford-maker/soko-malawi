/**
 * statusPublishStore — tiny pub/sub store for background status publishing.
 * The modal dismisses instantly on Publish; the trim/compress/upload/insert
 * keeps running in the background and reports progress to a floating ring.
 * Dismissing the ring never cancels the posting.
 */
let state = null
const listeners = new Set()

export function getStatusPublishState() {
  return state
}

export function subscribeStatusPublish(fn) {
  listeners.add(fn)
  if (state) fn(state)
  return () => listeners.delete(fn)
}

function emit() {
  listeners.forEach((fn) => {
    try { fn(state) } catch (e) { /* ignore subscriber errors */ }
  })
}

/** Begin a background publish. Returns a session token the background job holds. */
export function startStatusPublish() {
  const token = { dismissed: false }
  state = { token, active: true, phase: 'preparing', pct: 0, error: false, message: null }
  emit()
  return token
}

/** Progress update from the background job. Ignored once dismissed. */
export function updateStatusPublish(token, next) {
  if (!token || token.dismissed) return
  if (state?.token !== token) return
  state = { ...state, ...next, token }
  emit()
}

/** Finish a background publish: ok -> success ring that auto-dismisses; fail -> error ring. */
export function completeStatusPublish(token, ok, message) {
  if (!token || token.dismissed) return
  if (state?.token !== token) return
  if (ok) {
    state = { token, active: false, done: true, phase: 'success', pct: 100, error: false, message: null }
    emit()
    setTimeout(() => {
      if (state?.token === token) {
        state = null
        emit()
      }
    }, 1900)
  } else {
    state = { token, active: false, error: true, phase: 'error', pct: null, message }
    emit()
  }
}

/** User dismissed the floating ring. Posting keeps going in the background. */
export function dismissStatusPublish() {
  if (state?.token) state.token.dismissed = true
  state = null
  emit()
}
