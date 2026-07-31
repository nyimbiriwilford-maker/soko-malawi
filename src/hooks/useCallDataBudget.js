import { useRef, useState } from 'react'

/**
 * Read-only WebRTC data usage meter for the Call Data Budget feature.
 * Measurement only — no UI, no enforcement, no signaling changes.
 *
 * Polling is driven externally via sampleUsage() (the caller wires it into
 * its existing call timer); this hook does not run its own interval.
 */
export function useCallDataBudget(pcRef) {
  const [bytesUsed, setBytesUsed] = useState(0)
  const runningTotalRef = useRef(0)
  const sampledPcRef = useRef(null)

  async function sampleUsage() {
    const pc = pcRef?.current
    if (!pc) return 0

    // A new RTCPeerConnection instance means a new call — reset the running total.
    if (sampledPcRef.current !== pc) {
      sampledPcRef.current = pc
      runningTotalRef.current = 0
      setBytesUsed(0)
    }

    try {
      const stats = await pc.getStats()
      let sum = 0
      // Transport reports already include total bytes sent/received for the
      // connection (media + RTCP). Summing inbound-rtp/outbound-rtp on top
      // would double-count media bytes, so use transport only.
      let transportFound = false
      stats.forEach((report) => {
        if (report.type === 'transport') {
          transportFound = true
          sum += (report.bytesSent || 0) + (report.bytesReceived || 0)
        }
      })
      // Fallback for older browsers / edge cases with no transport report:
      // sum inbound-rtp + outbound-rtp INSTEAD of transport (not in addition).
      if (!transportFound) {
        stats.forEach((report) => {
          if (report.type === 'inbound-rtp') {
            sum += report.bytesReceived || 0
          } else if (report.type === 'outbound-rtp') {
            sum += report.bytesSent || 0
          }
        })
      }
      // transport/rtp stats are cumulative since connection start — assign,
      // never increment, or the running total compounds (quadratic growth).
      runningTotalRef.current = sum
      setBytesUsed(runningTotalRef.current)
      return runningTotalRef.current
    } catch (err) {
      console.warn('[CallDataBudget] getStats failed:', err)
      return runningTotalRef.current
    }
  }

  return { bytesUsed, sampleUsage }
}
