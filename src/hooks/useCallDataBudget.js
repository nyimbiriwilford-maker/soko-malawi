import { useRef, useState } from 'react'

const ROLLING_WINDOW_MS = 25000 // 25 seconds

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
  const samplesRef = useRef([]) // { timestamp: number, bytes: number }[]

  async function sampleUsage() {
    const pc = pcRef?.current
    if (!pc) return 0

    // A new RTCPeerConnection instance means a new call — reset the running total.
    if (sampledPcRef.current !== pc) {
      sampledPcRef.current = pc
      runningTotalRef.current = 0
      samplesRef.current = []
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

      // Add to rolling window
      const now = Date.now()
      samplesRef.current.push({ timestamp: now, bytes: sum })

      // Remove samples outside the window
      const cutoff = now - ROLLING_WINDOW_MS
      samplesRef.current = samplesRef.current.filter(s => s.timestamp >= cutoff)

      return runningTotalRef.current
    } catch (err) {
      console.warn('[CallDataBudget] getStats failed:', err)
      return runningTotalRef.current
    }
  }

  /**
   * Calculate current measured bytes per second from recent samples.
   * Returns null if insufficient data exists.
   */
  function getMeasuredRate() {
    const samples = samplesRef.current
    if (samples.length < 2) return null

    const oldest = samples[0]
    const newest = samples[samples.length - 1]
    const deltaBytes = newest.bytes - oldest.bytes
    const deltaMs = newest.timestamp - oldest.timestamp

    if (deltaMs < 5000) return null // Need at least 5s of data

    return (deltaBytes / deltaMs) * 1000 // Convert to bytes/sec
  }

  return { bytesUsed, sampleUsage, getMeasuredRate }
}
