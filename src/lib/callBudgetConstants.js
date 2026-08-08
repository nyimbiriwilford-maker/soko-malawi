/**
 * Shared call budget constants — enforcement and estimation must agree.
 */

/** Adaptive video-quality steps: maxBitrate in bits/sec per step (0 = normal). */
export const ADAPTIVE_CAPS = { 0: null, 1: 200000, 2: 80000, 3: 40000 }

/** Thresholds for adaptive quality steps (fraction of budget remaining). */
export const ADAPTIVE_THRESHOLDS = {
  0: 1.0,    // normal quality: > 50% remaining
  1: 0.5,    // 200 kbit/s: 25%-50% remaining
  2: 0.25,   // 80 kbit/s: 10%-25% remaining
  3: 0.1,    // 40 kbit/s: < 10% remaining
}
