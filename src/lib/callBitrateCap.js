import { getCallBudgetPref, shouldAutoLowData } from './callBudgetPrefs'

/**
 * Apply a soft max bitrate cap to the video sender of an RTCPeerConnection.
 * `maxBitrate` is in BITS/sec (RTCRtpEncodingParameters.maxBitrate) and is a
 * soft ceiling the encoder does not strictly obey: Task 3 measured ~25-30KB/s
 * real-world from a 40000 bits/sec (40kbit/s) cap (~5x overshoot), which is
 * what RATES.video.lowData (28000 bytes/sec) records as the Low-data estimate.
 */
export async function applyMaxBitrateToVideoSender(pc, maxBitrate = 40000) {
  const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
  if (!sender) return false
  try {
    const params = sender.getParameters()
    if (params.encodings?.length) {
      params.encodings = params.encodings.map((enc) => ({ ...enc, maxBitrate }))
    } else {
      params.encodings = [{ maxBitrate }]
    }
    await sender.setParameters(params)
    return true
  } catch (e) {
    console.warn('[CallDataBudget] setParameters failed:', e.message)
    return false
  }
}

/**
 * If the user has a low/medium video budget preference, apply the low-data cap
 * immediately and re-apply it every 5s (browsers drift away from a one-time
 * cap). No-op for voice / high / unset prefs.
 * @returns {number|null} the repeating interval id (or null if not applied) so
 *   the caller can store it and stop it in teardown.
 */
export function startLowDataCap(pc, type) {
  const pref = getCallBudgetPref(type === 'video' ? 'video' : 'voice')
  if (!pref || !shouldAutoLowData(type, pref.preset)) return null
  applyMaxBitrateToVideoSender(pc)
  return setInterval(() => {
    applyMaxBitrateToVideoSender(pc)
  }, 5000)
}

/** Stop a low-data cap interval started by startLowDataCap. */
export function stopLowDataCap(intervalId) {
  if (intervalId) clearInterval(intervalId)
}
