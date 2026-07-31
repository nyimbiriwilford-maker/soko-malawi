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
 * Low/Medium auto-reduce video; High and all voice stay uncapped.
 * @param {'voice'|'video'} callType
 * @param {'low'|'medium'|'high'|'custom'} preset
 * @returns {boolean}
 */
export function shouldAutoLowData(callType, preset) {
  return callType === 'video' && (preset === 'low' || preset === 'medium')
}
