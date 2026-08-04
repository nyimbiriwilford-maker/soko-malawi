/**
 * Call Data Budget — preference storage and estimation logic.
 * Standalone pure-logic module; no UI, no call-behavior changes.
 */

/** Preset data-budget sizes in MB, per call type. */
export const BUDGET_PRESETS = {
  video: { low: 10, medium: 30, high: 75 },
  voice: { low: 5, medium: 15, high: 40 },
}

/** Estimated media rates in bytes/sec, used for duration projections. */
const RATES = {
  video: { normal: 265000, lowData: 28000 },
  voice: { normal: 10500, lowData: 10500 }, // voice unaffected by low-data mode for now
}

/**
 * Read the stored budget preference for a call type.
 * @param {'voice'|'video'} callType
 * @returns {{ preset: 'low'|'medium'|'high'|'custom', mb: number } | null}
 *   Parsed preference object, or null if unset / malformed.
 */
export function getCallBudgetPref(callType) {
  try {
    const raw = localStorage.getItem(`soko_call_budget_${callType}`)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === 'object' &&
      ['low', 'medium', 'high', 'custom'].includes(parsed.preset) &&
      typeof parsed.mb === 'number'
    ) {
      return { preset: parsed.preset, mb: parsed.mb }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Persist a budget preference for a call type.
 * @param {'voice'|'video'} callType
 * @param {{ preset: 'low'|'medium'|'high'|'custom', mb: number }} pref
 */
export function setCallBudgetPref(callType, { preset, mb }) {
  localStorage.setItem(`soko_call_budget_${callType}`, JSON.stringify({ preset, mb }))
}

/**
 * Estimate how long a call can last before hitting the budget.
 * @param {'voice'|'video'} callType
 * @param {number} mb - budget in megabytes
 * @param {boolean} lowDataMode - whether low-data quality is active
 * @returns {number} estimated seconds
 */
export function estimateDuration(callType, mb, lowDataMode) {
  const rate = RATES[callType][lowDataMode ? 'lowData' : 'normal']
  return (mb * 1024 * 1024) / rate
}

/**
 * Whether a preset should automatically reduce video quality.
 * Previously low/medium video presets ran under a fixed 40 kbit/s cap
 * (measured ~28 KB/s). That fixed cap was removed and replaced by adaptive
 * quality steps that engage only as the budget depletes, so no preset
 * auto-reduces at call start anymore — estimates must use the measured
 * normal video rate (~265 KB/s) or they are wildly optimistic.
 * @returns {boolean} always false — no preset auto-reduces quality
 */
export function shouldAutoLowData() {
  return false
}

const CALL_USAGE_LOG_KEY = 'soko_call_usage_log'
const CALL_USAGE_LOG_MAX = 10

/**
 * Read the recorded usage log (oldest first).
 * @returns {Array<{ callType: 'voice'|'video', bytesUsed: number, durationSec: number }>}
 */
export function getCallUsageLog() {
  try {
    const raw = localStorage.getItem(CALL_USAGE_LOG_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/**
 * Record data used by a finished call, for future budget recommendations.
 * @param {'voice'|'video'} callType
 * @param {number} bytesUsed
 * @param {number} durationSec
 */
export function saveCallUsageRecord(callType, bytesUsed, durationSec) {
  const log = getCallUsageLog()
  log.push({ callType, bytesUsed, durationSec })
  const trimmed = log.length > CALL_USAGE_LOG_MAX
    ? log.slice(log.length - CALL_USAGE_LOG_MAX)
    : log
  localStorage.setItem(CALL_USAGE_LOG_KEY, JSON.stringify(trimmed))
}
