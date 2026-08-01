import { useEffect, useRef, useState } from 'react'
import { startLowDataCap, stopLowDataCap, applyMaxBitrateToVideoSender } from '../lib/callBitrateCap'

/** Adaptive video-quality steps: maxBitrate in bits/sec per step (0 = normal). */
const ADAPTIVE_CAPS = { 0: null, 1: 200000, 2: 80000, 3: 40000 }

export default function useCallBudgetManager({
  bytesUsed,
  budgetMb,
  callType,
  callState,
  pcRef,
  localStreamRef,
  hangUp,
  clearActiveCall,
  toggleCam,
  isCamOff,
  boundChat,
  stickyRef,
}) {
  // Progressive budget warnings — each threshold fires exactly once per call
  const [budgetWarning, setBudgetWarning] = useState(null)
  const budgetWarningsFiredRef = useRef({ half: false, low: false, critical: false, exhausted: false })
  const budgetCapIntervalRef = useRef(null)
  const budgetSessionRef = useRef(null)

  // Adaptive video quality — steps down as the budget depletes (video calls only)
  const [qualityToast, setQualityToast] = useState(false)
  const qualityStepRef = useRef(0)
  const adaptiveStepsFiredRef = useRef({ medium: false, low: false, ultraLow: false })
  const adaptiveCapIntervalRef = useRef(null)
  const qualitySessionRef = useRef(null)
  const qualityLockedRef = useRef(false)

  const budgetBytes = budgetMb > 0 ? budgetMb * 1024 * 1024 : 0

  function adaptiveStepForRemaining(remaining) {
    if (remaining > 0.5) return 0
    if (remaining > 0.25) return 1
    if (remaining > 0.1) return 2
    return 3
  }

  function applyAdaptiveCap(step) {
    const pc = pcRef.current
    const bits = ADAPTIVE_CAPS[step]
    if (!pc || !bits) return
    applyMaxBitrateToVideoSender(pc, bits)
  }

  function ensureAdaptiveInterval() {
    if (adaptiveCapIntervalRef.current) return
    adaptiveCapIntervalRef.current = setInterval(() => {
      applyAdaptiveCap(qualityStepRef.current)
    }, 5000)
  }

  function restoreNormalQuality() {
    qualityStepRef.current = 0
    stopLowDataCap(adaptiveCapIntervalRef.current)
    adaptiveCapIntervalRef.current = null
  }

  // Clear any manual/adaptive cap interval once the call is over
  useEffect(() => {
    if (callState === 'in-call') return
    stopLowDataCap(budgetCapIntervalRef.current)
    budgetCapIntervalRef.current = null
    stopLowDataCap(adaptiveCapIntervalRef.current)
    adaptiveCapIntervalRef.current = null
  }, [callState])

  // Fire warnings as the budget ratio crosses 50 / 75 / 90 / 100%.
  // A new RTCPeerConnection means a new call, so reset the fired refs then.
  useEffect(() => {
    if (callState !== 'in-call' || budgetBytes <= 0) return
    if (budgetSessionRef.current !== pcRef.current) {
      budgetSessionRef.current = pcRef.current
      budgetWarningsFiredRef.current = { half: false, low: false, critical: false, exhausted: false }
      setBudgetWarning(null)
      return
    }
    const fired = budgetWarningsFiredRef.current
    const ratio = bytesUsed / budgetBytes
    if (ratio >= 0.5 && !fired.half) {
      fired.half = true
      setBudgetWarning({ level: 'half' })
    }
    if (ratio >= 0.75 && !fired.low) {
      fired.low = true
      setBudgetWarning({ level: 'low' })
    }
    if (ratio >= 0.9 && !fired.critical) {
      fired.critical = true
      setBudgetWarning({ level: 'critical' })
    }
    if (ratio >= 1 && !fired.exhausted) {
      fired.exhausted = true
      setBudgetWarning({ level: 'exhausted' })
    }
  }, [bytesUsed, callState, budgetBytes])

  // Adaptive video quality — video calls only; steps down as remaining budget
  // falls (normal > 200k > 80k > 40k). Never auto-restores up; a new
  // RTCPeerConnection means a new call, so reset the step tracking then.
  useEffect(() => {
    if (callState !== 'in-call' || budgetBytes <= 0 || callType !== 'video') return
    if (qualitySessionRef.current !== pcRef.current) {
      qualitySessionRef.current = pcRef.current
      qualityStepRef.current = 0
      adaptiveStepsFiredRef.current = { medium: false, low: false, ultraLow: false }
      qualityLockedRef.current = false
      restoreNormalQuality()
      setQualityToast(false)
      return
    }
    if (qualityLockedRef.current) return
    const remaining = 1 - bytesUsed / budgetBytes
    const target = adaptiveStepForRemaining(remaining)
    if (target > qualityStepRef.current) {
      qualityStepRef.current = target
      const fired = adaptiveStepsFiredRef.current
      if (target >= 1 && !fired.medium) fired.medium = true
      if (target >= 2 && !fired.low) fired.low = true
      if (target >= 3 && !fired.ultraLow) fired.ultraLow = true
      applyAdaptiveCap(target)
      ensureAdaptiveInterval()
      setQualityToast(true)
    }
  }, [bytesUsed, callState, budgetBytes, callType]) // eslint-disable-line react-hooks/exhaustive-deps

  // Quality-step toast auto-dismisses
  useEffect(() => {
    if (!qualityToast) return undefined
    const t = setTimeout(() => setQualityToast(false), 4000)
    return () => clearTimeout(t)
  }, [qualityToast])

  // Toast warnings auto-dismiss; the exhausted modal stays until an action
  useEffect(() => {
    if (!budgetWarning || budgetWarning.level === 'exhausted') return undefined
    const t = setTimeout(() => setBudgetWarning(null), 4000)
    return () => clearTimeout(t)
  }, [budgetWarning])

  function handleBudgetAction(action) {
    if (action === 'continue') {
      setBudgetWarning(null)
      // Manual restore: undo any adaptive cap and stop further auto step-downs
      restoreNormalQuality()
      qualityLockedRef.current = true
      return
    }
    if (action === 'reduceVideo') {
      if (pcRef.current) {
        const intervalId = startLowDataCap(pcRef.current, callType)
        if (intervalId) {
          stopLowDataCap(budgetCapIntervalRef.current)
          budgetCapIntervalRef.current = intervalId
        } else {
          applyMaxBitrateToVideoSender(pcRef.current)
        }
      }
      setBudgetWarning(null)
      return
    }
    if (action === 'audioOnly') {
      const stream = localStreamRef.current
      if (stream) {
        stream.getVideoTracks().forEach((t) => {
          t.stop()
          stream.removeTrack(t)
        })
      }
      if (!isCamOff) toggleCam?.()
      setBudgetWarning(null)
      return
    }
    if (action === 'endCall') {
      setBudgetWarning(null)
      ;(async () => {
        await hangUp()
        clearActiveCall?.()
        if (!boundChat) stickyRef.current = null
      })()
    }
  }

  return { budgetWarning, qualityToast, handleBudgetAction }
}
