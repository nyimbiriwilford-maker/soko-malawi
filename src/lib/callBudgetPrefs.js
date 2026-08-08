/**
 * Call Data Budget — preference storage and estimation logic.
 * Standalone pure-logic module; no UI, no call-behavior changes.
 */

import { ADAPTIVE_CAPS, ADAPTIVE_THRESHOLDS } from './callBudgetConstants'

/** Preset data-budget sizes in MB, per call type. */
export const BUDGET_PRESETS = {
  video: { low: 10, medium: 30, high: 75 },
  voice: { low: 5, medium: 15, high: 40 },
}

/** Estimated media rates in bytes/sec, used for duration projections. */
const RATES = {
  video: { normal: 265000, lowData: 5000 },   // lowData: 40 kbit/s; normal: ~265 KB/s
  voice: { normal: 10000,  lowData: 10000 },  // ~80 kbit/s Opus + overhead
}

/**
 * Read the stored budget preference for a call type.
 * @param {'voice'|'video'} callType
 * @returns {{ preset: 'low'|'medium'|'high'|'custom', mb: number, quality?: string } | null}
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
      return {
        preset: parsed.preset,
        mb: parsed.mb,
        quality: parsed.quality || 'balanced'
      }
    }
    return null
  } catch {
    return null
  }
}

/**
 * Persist a budget preference for a call type.
 * @param {'voice'|'video'} callType
 * @param {{ preset: 'low'|'medium'|'high'|'custom', mb: number, quality?: string }} pref
 */
export function setCallBudgetPref(callType, { preset, mb, quality }) {
  const obj = { preset, mb }
  if (quality) obj.quality = quality
  localStorage.setItem(`soko_call_budget_${callType}`, JSON.stringify(obj))
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
 * Check if Data Saver quality mode is active for a call type.
 * Returns true when the user has explicitly selected Data Saver quality.
 * The adaptive budget system can further reduce quality as budget depletes.
 * @param {'voice'|'video'} callType
 * @returns {boolean} true if Data Saver is selected
 */
export function shouldAutoLowData(callType) {
  const pref = getCallBudgetPref(callType)
  return pref?.quality === 'saver'
}

const CALL_USAGE_LOG_KEY = 'soko_call_usage_log'
const CALL_USAGE_LOG_MAX = 10

/**
 * Read the recorded usage log (oldest first).
 * @returns {Array<{ callType: 'voice'|'video', bytesUsed: number, durationSec: number, budgetCapped?: boolean }>}
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
 * @param {boolean} budgetCapped - whether the call was terminated by budget enforcement
 */
export function saveCallUsageRecord(callType, bytesUsed, durationSec, budgetCapped = false) {
  const log = getCallUsageLog()
  const record = { callType, bytesUsed, durationSec, budgetCapped }
  console.log('[saveCallUsageRecord] Adding record:', record)
  log.push(record)
  const trimmed = log.length > CALL_USAGE_LOG_MAX
    ? log.slice(log.length - CALL_USAGE_LOG_MAX)
    : log
  localStorage.setItem(CALL_USAGE_LOG_KEY, JSON.stringify(trimmed))
  console.log('[saveCallUsageRecord] Saved to localStorage. Total records:', trimmed.length)
}

/**
 * Derive per-type byte/sec from recent valid completed calls.
 * Uses median of valid samples to avoid outlier sensitivity.
 * Requires ≥2 valid samples per type to activate.
 * @returns {{ voice: number|null, video: number|null }}
 */
export function getLearnedRates() {
  const log = getCallUsageLog()
  console.log('[getLearnedRates] Full usage log:', log)
  const result = { voice: null, video: null }
  for (const type of ['voice', 'video']) {
    const records = log
      .filter(r =>
        r.callType === type &&
        r.bytesUsed > 0 &&
        r.durationSec >= 60 &&    // ignore calls shorter than 60s
        !r.budgetCapped            // ignore budget-capped calls
      )
      .slice(-5)                   // most recent 5 valid calls
    console.log(`[getLearnedRates] Valid ${type} records:`, records)
    if (records.length < 2) {
      console.log(`[getLearnedRates] Not enough ${type} records (need ≥2, have ${records.length})`)
      continue
    }

    // Calculate rate per call, then take median
    const rates = records.map(r => r.bytesUsed / r.durationSec)
    rates.sort((a, b) => a - b)
    const median = rates.length % 2 === 0
      ? (rates[rates.length / 2 - 1] + rates[rates.length / 2]) / 2
      : rates[Math.floor(rates.length / 2)]

    console.log(`[getLearnedRates] ${type} rates:`, rates, '→ median:', median, 'bytes/sec')

    // Sanity bounds: 1 kbit/s – 10 Mbit/s
    if (median > 125 && median < 1250000) {
      result[type] = median
      console.log(`[getLearnedRates] ✅ ${type} learned rate accepted:`, median, 'bytes/sec')
    } else {
      console.log(`[getLearnedRates] ❌ ${type} median out of bounds (125–1250000):`, median)
    }
  }
  console.log('[getLearnedRates] Final result:', result)
  return result
}

/**
 * How many recent samples exist and whether learning is active for a call type.
 * @param {'voice'|'video'} callType
 * @returns {{ count: number, isActive: boolean }}
 */
export function getLearnedRateInfo(callType) {
  const log = getCallUsageLog()
  const records = log
    .filter(r =>
      r.callType === callType &&
      r.bytesUsed > 0 &&
      r.durationSec >= 60 &&
      !r.budgetCapped
    )
    .slice(-5)
  return { count: records.length, isActive: records.length >= 2 }
}

/**
 * Like estimateDuration but uses the learned rate when ≥2 samples exist.
 * Now uses learned rates for ALL quality tiers (saver/balanced/high) when available,
 * falling back to theoretical rates only when insufficient samples exist.
 * @param {'voice'|'video'} callType
 * @param {number} mb - budget in megabytes
 * @param {string|null} qualityHint - 'saver' | 'balanced' | null (high/normal)
 * @returns {number} estimated seconds
 */
export function effectiveEstimateDuration(callType, mb, qualityHint = null) {
  // Quality-specific fallback rates (theoretical targets)
  const fallbackRates = {
    saver: 5000,      // 40 kbit/s target
    balanced: 25000,  // 200 kbit/s target
    normal: RATES[callType].normal,  // 265 KB/s for video, 10 KB/s for voice
  }

  const fallback = qualityHint ? (fallbackRates[qualityHint] ?? RATES[callType].normal) : RATES[callType].normal

  // Try to use learned rate for this call type, regardless of quality tier
  const learned = getLearnedRates()
  const rate = learned[callType] ?? fallback

  console.log('[effectiveEstimateDuration]', {
    callType,
    mb,
    qualityHint,
    learnedRate: learned[callType],
    fallbackRate: fallback,
    usedRate: rate,
    usingLearned: learned[callType] !== undefined,
    estimatedSeconds: (mb * 1024 * 1024) / rate,
  })

  return (mb * 1024 * 1024) / rate
}

/**
 * Estimate duration for a budgeted video call accounting for adaptive bitrate.
 * As budget depletes, quality steps down: normal → 200k → 80k → 40k.
 * @param {number} remainingMb - remaining budget in MB
 * @param {number} usedMb - already consumed MB
 * @param {number} totalBudgetMb - total budget in MB
 * @param {number} baseRate - current consumption rate in bytes/sec
 * @returns {number} estimated seconds remaining
 */
export function estimateAdaptiveDuration(remainingMb, usedMb, totalBudgetMb, baseRate) {
  if (remainingMb <= 0 || totalBudgetMb <= 0) return 0

  const remainingBytes = remainingMb * 1024 * 1024
  const fraction = remainingMb / totalBudgetMb

  // If no adaptive caps exist or we're voice, use flat rate
  if (!ADAPTIVE_CAPS || !ADAPTIVE_THRESHOLDS) {
    return remainingBytes / baseRate
  }

  // Determine current step based on remaining fraction
  let currentStep = 0
  if (fraction <= 0.1) currentStep = 3      // 40 kbit/s
  else if (fraction <= 0.25) currentStep = 2 // 80 kbit/s
  else if (fraction <= 0.5) currentStep = 1  // 200 kbit/s
  else currentStep = 0                       // normal

  // Simple piecewise: walk through each future step
  let bytesLeft = remainingBytes
  let timeAccum = 0

  for (let step = currentStep; step <= 3 && bytesLeft > 0; step++) {
    const capBits = ADAPTIVE_CAPS[step]
    const rate = capBits ? capBits / 8 : baseRate // bits/sec → bytes/sec

    // Budget fraction at which this step activates
    const nextThreshold = step < 3 ? ADAPTIVE_THRESHOLDS[step + 1] : 0
    const thresholdBytes = nextThreshold * totalBudgetMb * 1024 * 1024

    // How many bytes can we consume at this step?
    const stepBytes = Math.min(bytesLeft, bytesLeft - thresholdBytes)

    if (stepBytes > 0) {
      timeAccum += stepBytes / rate
      bytesLeft -= stepBytes
    }
  }

  // Consume any remaining at the lowest rate
  if (bytesLeft > 0) {
    const lowestRate = ADAPTIVE_CAPS[3] / 8
    timeAccum += bytesLeft / lowestRate
  }

  return timeAccum
}

