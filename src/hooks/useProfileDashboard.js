/**
 * useProfileDashboard — live Supabase data for Profile module
 * Soft-fails when RPCs/tables are not migrated yet so UI stays usable.
 */
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const emptyStats = {
  active_listings: null,
  sold_listings: null,
  followers: null,
  following: null,
  deals: null,
  profile_views: null,
  listing_views: null,
  sales_rate_pct: null,
  avg_listing_age_days: null,
  trust_score: null,
}

export function useProfileDashboard(userId) {
  const [dashboardStats, setDashboardStats] = useState(emptyStats)
  const [analyticsSeries, setAnalyticsSeries] = useState([])
  const [achievements, setAchievements] = useState(null) // null = use client fallback
  const [activityFeed, setActivityFeed] = useState([])
  const [trustEvents, setTrustEvents] = useState([])
  const [securityEvents, setSecurityEvents] = useState([])
  const [sessions, setSessions] = useState([])
  const [suggestions, setSuggestions] = useState([])
  const [recommended, setRecommended] = useState([])
  const [recentlyViewed, setRecentlyViewed] = useState([])
  const [jobApps, setJobApps] = useState(null)
  const [serviceReqs, setServiceReqs] = useState(null)
  const [loadingExtra, setLoadingExtra] = useState(false)
  const [ready, setReady] = useState(false)

  const refresh = useCallback(async () => {
    if (!userId) return
    setLoadingExtra(true)

    // Dashboard stats RPC
    try {
      const { data, error } = await supabase.rpc('get_seller_dashboard_stats', { p_user_id: userId })
      if (!error && data && typeof data === 'object') {
        setDashboardStats({ ...emptyStats, ...data })
      }
    } catch { /* RPC missing */ }

    // Analytics series (14 days)
    try {
      const { data, error } = await supabase.rpc('get_seller_analytics_series', {
        p_days: 14,
        p_user_id: userId,
      })
      if (!error && Array.isArray(data)) setAnalyticsSeries(data)
    } catch { /* ignore */ }

    // Achievements: recompute then load
    try {
      await supabase.rpc('recompute_user_achievements', { p_user_id: userId })
      const { data, error } = await supabase.rpc('get_user_achievements', { p_user_id: userId })
      if (!error && Array.isArray(data) && data.length) {
        setAchievements(
          data.map((a) => ({
            id: a.id,
            icon: a.icon || 'star',
            name: a.name,
            desc: a.description,
            unlocked: !!a.unlocked,
            req: a.requirement,
            unlocked_at: a.unlocked_at,
            placeholder: false,
          }))
        )
      }
    } catch { /* use client fallback */ }

    // Marketplace activity
    try {
      const { data, error } = await supabase.rpc('get_recent_activity', {
        p_user_id: userId,
        p_limit: 20,
      })
      if (!error && Array.isArray(data)) setActivityFeed(data)
    } catch {
      try {
        const { data } = await supabase
          .from('marketplace_activity')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })
          .limit(20)
        if (data) setActivityFeed(data)
      } catch { /* ignore */ }
    }

    // Trust events
    try {
      const { data } = await supabase
        .from('trust_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (data) setTrustEvents(data)
    } catch { /* ignore */ }

    // Security events + sessions
    try {
      const { data } = await supabase
        .from('security_events')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) setSecurityEvents(data)
    } catch { /* ignore */ }

    try {
      const { data } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .is('revoked_at', null)
        .order('last_active_at', { ascending: false })
        .limit(12)
      if (data) setSessions(data)
    } catch { /* ignore */ }

    // People you may know
    try {
      const { data, error } = await supabase.rpc('get_people_you_may_know', { p_limit: 8 })
      if (!error && Array.isArray(data)) setSuggestions(data)
    } catch { /* ignore */ }

    // Recommended listings (not own, active, prefer same city later)
    try {
      const { data } = await supabase
        .from('listings')
        .select('id, title, price, images, district, city, category, created_at, status, seller_id')
        .neq('seller_id', userId)
        .neq('status', 'sold')
        .neq('status', 'deleted')
        .order('created_at', { ascending: false })
        .limit(8)
      if (data) setRecommended(data)
    } catch { /* ignore */ }

    // Recently viewed by this user
    try {
      const { data: views } = await supabase
        .from('listing_views')
        .select('listing_id, created_at')
        .eq('viewer_id', userId)
        .order('created_at', { ascending: false })
        .limit(12)
      if (views?.length) {
        const ids = [...new Set(views.map((v) => v.listing_id))].slice(0, 8)
        const { data: rows } = await supabase
          .from('listings')
          .select('id, title, price, images, district, city, status')
          .in('id', ids)
        if (rows) {
          const order = new Map(ids.map((id, i) => [id, i]))
          setRecentlyViewed(
            [...rows].sort((a, b) => (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99))
          )
        }
      } else {
        setRecentlyViewed([])
      }
    } catch { /* ignore */ }

    // Job applications / service requests — soft counts
    try {
      const { count } = await supabase
        .from('job_applications')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      setJobApps(count ?? 0)
    } catch {
      try {
        const { count } = await supabase
          .from('job_applications')
          .select('id', { count: 'exact', head: true })
          .eq('applicant_id', userId)
        setJobApps(count ?? 0)
      } catch {
        setJobApps(null)
      }
    }

    try {
      const { count } = await supabase
        .from('service_requests')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', userId)
      setServiceReqs(count ?? 0)
    } catch {
      setServiceReqs(null)
    }

    setLoadingExtra(false)
    setReady(true)
  }, [userId])

  useEffect(() => {
    refresh()
  }, [refresh])

  /** Record this browser session (best-effort) and refresh list */
  const touchSession = useCallback(async () => {
    if (!userId || typeof navigator === 'undefined') return
    try {
      const ua = navigator.userAgent || ''
      const parsed = parseDeviceFromUserAgent(ua)
      const label = parsed.label
      const uaKey = ua.slice(0, 200)

      // Prefer exact-ish UA match, then fall back to device_label
      let existing = null
      const { data: byUa } = await supabase
        .from('user_sessions')
        .select('id, user_agent, device_label')
        .eq('user_id', userId)
        .is('revoked_at', null)
        .order('last_active_at', { ascending: false })
        .limit(12)

      if (Array.isArray(byUa) && byUa.length) {
        existing =
          byUa.find((s) => s.user_agent && uaKey && s.user_agent.slice(0, 80) === uaKey.slice(0, 80))
          || byUa.find((s) => s.device_label === label)
          || null
      }

      const now = new Date().toISOString()
      if (existing?.id) {
        await supabase
          .from('user_sessions')
          .update({
            last_active_at: now,
            device_label: label.slice(0, 120),
            user_agent: ua.slice(0, 400),
          })
          .eq('id', existing.id)
      } else {
        await supabase.from('user_sessions').insert({
          user_id: userId,
          device_label: label.slice(0, 120),
          user_agent: ua.slice(0, 400),
          last_active_at: now,
        })
      }

      // Refresh sessions for UI
      const { data: fresh } = await supabase
        .from('user_sessions')
        .select('*')
        .eq('user_id', userId)
        .is('revoked_at', null)
        .order('last_active_at', { ascending: false })
        .limit(12)
      if (fresh) setSessions(fresh)

      await supabase
        .from('profiles')
        .update({
          last_seen: now,
          last_login_at: now,
        })
        .eq('id', userId)
    } catch { /* columns/tables may be missing */ }
  }, [userId])

  /** Revoke a session (other devices / this one) */
  const revokeSession = useCallback(async (sessionId) => {
    if (!userId || !sessionId) return false
    try {
      const { error } = await supabase
        .from('user_sessions')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', sessionId)
        .eq('user_id', userId)
      if (error) throw error
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
      return true
    } catch {
      return false
    }
  }, [userId])

  useEffect(() => {
    touchSession()
  }, [touchSession])

  return {
    dashboardStats,
    analyticsSeries,
    achievements,
    activityFeed,
    trustEvents,
    securityEvents,
    sessions,
    suggestions,
    recommended,
    recentlyViewed,
    jobApps,
    serviceReqs,
    loadingExtra,
    ready,
    refresh,
    touchSession,
    revokeSession,
  }
}

/**
 * Human-readable device info from a User-Agent string.
 * Returns { label, browser, os, kind: 'desktop'|'mobile'|'tablet' }
 */
export function parseDeviceFromUserAgent(ua = '') {
  const s = String(ua || '')
  const lower = s.toLowerCase()

  let browser = 'Browser'
  if (/edg\//i.test(s)) browser = 'Edge'
  else if (/opr\/|opera/i.test(s)) browser = 'Opera'
  else if (/chrome|crios/i.test(s) && !/edg\//i.test(s)) browser = 'Chrome'
  else if (/firefox|fxios/i.test(s)) browser = 'Firefox'
  else if (/safari/i.test(s) && !/chrome|crios|android/i.test(s)) browser = 'Safari'
  else if (/samsungbrowser/i.test(s)) browser = 'Samsung Internet'

  let os = 'Device'
  if (/windows nt/i.test(s)) os = 'Windows'
  else if (/android/i.test(s)) os = 'Android'
  else if (/iphone|ipad|ipod/i.test(s)) os = /ipad/i.test(s) ? 'iPadOS' : 'iOS'
  else if (/mac os x|macintosh/i.test(s)) os = 'macOS'
  else if (/cros/i.test(s)) os = 'ChromeOS'
  else if (/linux/i.test(s)) os = 'Linux'

  let kind = 'desktop'
  if (/ipad|tablet|playbook|silk/i.test(s) || ( /android/i.test(s) && !/mobile/i.test(s) )) {
    kind = 'tablet'
  } else if (/mobi|iphone|ipod|android.*mobile|windows phone/i.test(s)) {
    kind = 'mobile'
  }

  // Fallback when UA is empty / sparse
  if (!s) {
    if (typeof navigator !== 'undefined') {
      os = navigator.platform || os
      browser = 'Web'
    }
  }

  // Clean legacy labels that stored "Win32 · Mozilla/5.0..."
  if (/mozilla\//i.test(s) === false && / · /.test(s) && s.length < 80) {
    // already a short custom label
    return { label: s.slice(0, 80), browser, os, kind }
  }

  const label = `${browser} · ${os}`
  return { label, browser, os, kind, raw: lower }
}

/** Persist profile completion % when columns exist */
export async function syncProfileCompletion(userId, pct, sellerLevel) {
  if (!userId) return
  try {
    const payload = {
      profile_completion_pct: pct,
      updated_at: new Date().toISOString(),
    }
    if (sellerLevel?.tier != null) {
      payload.seller_level_tier = sellerLevel.tier
      payload.seller_level_name = sellerLevel.name
    }
    await supabase.from('profiles').update(payload).eq('id', userId)
  } catch { /* ignore */ }
}

export async function recordListingShare(listingId, channel = 'link') {
  if (!listingId) return
  try {
    await supabase.rpc('record_listing_share', {
      p_listing_id: listingId,
      p_channel: channel,
    })
  } catch { /* ignore */ }
}

export async function blockUser(blockedId, reason = null) {
  const { error } = await supabase.rpc('block_user', {
    p_blocked_id: blockedId,
    p_reason: reason,
  })
  if (error) throw error
}

export async function bulkListingStatus(ids, status) {
  const { data, error } = await supabase.rpc('bulk_update_listing_status', {
    p_listing_ids: ids,
    p_status: status,
  })
  if (error) throw error
  return data
}

export async function bulkListingDelete(ids) {
  const { data, error } = await supabase.rpc('bulk_delete_listings', {
    p_listing_ids: ids,
  })
  if (error) throw error
  return data
}

export async function followSeller(sellerId, followerId) {
  if (!sellerId || !followerId || sellerId === followerId) return
  const { error } = await supabase.from('seller_follows').insert({
    seller_id: sellerId,
    follower_id: followerId,
  })
  if (error && !String(error.message || '').toLowerCase().includes('duplicate')) throw error
}

export default useProfileDashboard
