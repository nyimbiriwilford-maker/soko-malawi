import { useEffect, useRef, useState } from 'react'
import { stopLowDataCap, applyMaxBitrateToVideoSender } from '../lib/callBitrateCap'

/** Adaptive video-quality steps: maxBitrate in bits/sec per step (0 = normal). */
const ADAPTIVE_CAPS = { 0: null, 1: 200000, 2: 80000, 3: 40000 }

export default function useCallBudgetManager({
  bytesUsed,
  budgetMb,
  callType,
  callState,
  pcRef,
  hangUp,
  clearActiveCall,
  boundChat,
  stickyRef,
}) {
  // Live, extendable budget — starts from the saved pref but can grow mid-call
  // via the +5/+10/+20 MB and "Extend +10 MB" actions.
  const [liveBudgetMb, setLiveBudgetMb] = useState(budgetMb)

  // Budget lifecycle stage: null | 'toast' (80%) | 'panel' (90%) | 'countdown' (98%)
  const [stage, setStage] = useState(null)
  const [countdown, setCountdown] = useState(10)
  const stageRef = useRef(null)
  const budgetSessionRef = useRef(null)
  const lowToastFiredRef = useRef(false)
  const autoHangupFiredRef = useRef(false)
  const extendedRef = useRef(false)

  // Adaptive video quality — steps down as the budget depletes (video calls only)
  const [qualityToast, setQualityToast] = useState(false)
  const qualityStepRef = useRef(0)
  const adaptiveStepsFiredRef = useRef({ medium: false, low: false, ultraLow: false })
  const adaptiveCapIntervalRef = useRef(null)
  const qualitySessionRef = useRef(null)
  const qualityLockedRef = useRef(false)

  const budgetBytes = liveBudgetMb > 0 ? liveBudgetMb * 1024 * 1024 : 0

  useEffect(() => { stageRef.current = stage }, [stage])

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

  function autoHangup() {
    if (autoHangupFiredRef.current) return
    autoHangupFiredRef.current = true
    setStage(null)
    setCountdown(10)
    ;(async () => {
      await hangUp()
      clearActiveCall?.()
      if (!boundChat) stickyRef.current = null
    })()
  }

  function handleBudgetAction(action, mb) {
    if (action !== 'extend') return
    const amount = Number.isFinite(mb) && mb > 0 ? mb : 10
    extendedRef.current = true
    setLiveBudgetMb((m) => m + amount)
    setCountdown(10)
    // Countdown extend resets to the 90% panel; panel extend dismisses it
    setStage((s) => (s === 'countdown' ? 'panel' : null))
  }

  // Clear any manual/adaptive cap interval once the call is over
  useEffect(() => {
    if (callState === 'in-call') return
    stopLowDataCap(adaptiveCapIntervalRef.current)
    adaptiveCapIntervalRef.current = null
  }, [callState])

  // Budget lifecycle: 80% toast → 90% extend panel → 98% countdown → 100% hangup.
  // A new RTCPeerConnection means a new call, so reset the fired flags then.
  useEffect(() => {
    if (callState !== 'in-call') return
    // Seed the live budget from the saved pref on each new connection. This
    // reset branch must run even while liveBudgetMb is still 0 (its app-mount
    // default) — budgetBytes derives from liveBudgetMb, so gating on it here
    // would self-block the seed and disable all enforcement below.
    if (budgetSessionRef.current !== pcRef.current) {
      budgetSessionRef.current = pcRef.current
      lowToastFiredRef.current = false
      autoHangupFiredRef.current = false
      extendedRef.current = false
      setLiveBudgetMb(budgetMb)
      setStage(null)
      setCountdown(10)
      return
    }
    // Standard (unmetered) call — no budget to enforce.
    if (budgetBytes <= 0) return
    const ratio = bytesUsed / budgetBytes
    if (ratio >= 1) {
      if (stageRef.current !== null) setStage(null)
      autoHangup()
      return
    }
    if (ratio >= 0.98) {
      if (stageRef.current !== 'countdown') {
        setCountdown(10)
        setStage('countdown')
      }
      return
    }
    if (ratio >= 0.9) {
      if (stageRef.current !== 'panel') setStage('panel')
      return
    }
    if (ratio >= 0.8 && !lowToastFiredRef.current) {
      lowToastFiredRef.current = true
      if (stageRef.current === null) setStage('toast')
    }
  }, [bytesUsed, callState, budgetBytes, budgetMb]) // eslint-disable-line react-hooks/exhaustive-deps

  // 80% toast auto-dismisses; the panel and countdown persist until acted on
  useEffect(() => {
    if (stage !== 'toast') return undefined
    const t = setTimeout(() => setStage((s) => (s === 'toast' ? null : s)), 4000)
    return () => clearTimeout(t)
  }, [stage])

  // 98% countdown ticks down to 0, then hangs up
  useEffect(() => {
    if (stage !== 'countdown') return undefined
    if (countdown <= 0) {
      if (stageRef.current !== null) setStage(null)
      autoHangup()
      return undefined
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [stage, countdown]) // eslint-disable-line react-hooks/exhaustive-deps

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

  const budgetWarning =
    stage === 'toast'
      ? { level: 'low' }
      : stage === 'panel'
        ? { level: 'panel' }
        : stage === 'countdown'
          ? { level: 'countdown', seconds: countdown }
          : null

  return {
    budgetWarning,
    qualityToast,
    handleBudgetAction,
    liveBudgetMb,
    isBudgetExtended: () => extendedRef.current,
  }
}
