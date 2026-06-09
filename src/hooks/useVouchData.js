// src/hooks/useVouchData.js
// Single hook that loads all vouch-related data for a profile view.

import { useEffect, useState } from 'react'
import {
  resolveVouchChain,
  getVouchers,
  getTrustScore,
  getConfirmedDealCount,
  getVouchStatus,
} from '../utils/vouchUtils'

/**
 * @param {string} targetUserId  — the profile being viewed
 * @param {string} viewerUserId  — the logged-in user (null if same person)
 */
export function useVouchData(targetUserId, viewerUserId) {
  const [trustScore,    setTrustScore]    = useState(null)
  const [dealCount,     setDealCount]     = useState(0)
  const [vouchesIn,     setVouchesIn]     = useState([])
  const [vouchChain,    setVouchChain]    = useState(null)   // { degree, connector }
  const [vouchBudget,   setVouchBudget]   = useState(null)   // { used, remaining } — viewer's budget
  const [alreadyVouched, setAlreadyVouched] = useState(false)
  const [canVouch,      setCanVouch]      = useState(false)  // has confirmed deal
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    if (!targetUserId) return
    load()
  }, [targetUserId, viewerUserId])

  async function load() {
    setLoading(true)
    const isOwnProfile = targetUserId === viewerUserId

    const [ts, dc, vi] = await Promise.all([
      getTrustScore(targetUserId),
      getConfirmedDealCount(targetUserId),
      getVouchers(targetUserId),
    ])

    setTrustScore(ts)
    setDealCount(dc)
    setVouchesIn(vi)

    if (viewerUserId && !isOwnProfile) {
      const [chain, vouched] = await Promise.all([
        resolveVouchChain(viewerUserId, targetUserId),
        getVouchStatus(viewerUserId, targetUserId),
      ])
      setVouchChain(chain)
      setVouchBudget(null)
      setAlreadyVouched(vouched?.status === 'active')
      // canVouch: viewer can vouch if they haven't already
      setCanVouch(!vouched || vouched.status !== 'active')
    }

    setLoading(false)
  }

  return {
    trustScore,
    dealCount,
    vouchesIn,
    vouchChain,
    vouchBudget,
    alreadyVouched,
    canVouch,
    loading,
    reload: load,
  }
}