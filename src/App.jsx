/* global __BUILD_ID__ */
import { useEffect, useLayoutEffect, useState, useRef, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase, isSupabaseConfigured } from './lib/supabase'
import BottomNav from './components/BottomNav'
const StatusPage          = lazyRetry(() => import('./pages/StatusPage'))
const StoryViewerPage     = lazyRetry(() => import('./pages/StoryViewerPage'))
const SavedStatusesPage   = lazyRetry(() => import('./pages/SavedStatusesPage'))
const LookingFor = lazyRetry(() => import('./pages/LookingFor/LookingFor'))

// ── Eagerly loaded (needed immediately on first paint) ────
import Login        from './pages/Login'
import AuthCallback from './pages/AuthCallback'

// ── Lazy loaded (only fetched when route is visited) ──────
const Home          = lazyRetry(() => import('./pages/Home'))
const ListingDetail = lazyRetry(() => import('./pages/ListingDetail'))
const PostListing   = lazyRetry(() => import('./pages/PostListing'))
const ChatsLayout   = lazyRetry(() => import('./pages/ChatsLayout'))
const Profile       = lazyRetry(() => import('./pages/Profile'))
const Services      = lazyRetry(() => import('./pages/ServicesPage'))
const Admin         = lazyRetry(() => import('./pages/Admin'))
const PublicProfile = lazyRetry(() => import('./pages/PublicProfile'))
const ResetPassword   = lazyRetry(() => import('./pages/ResetPassword'))
const Notifications   = lazyRetry(() => import('./pages/Notifications'))
const VerifyPayment   = lazyRetry(() => import('./pages/VerifyPayment'))
const Onboarding       = lazyRetry(() => import('./pages/Onboarding'))
const ShopSetup        = lazyRetry(() => import('./pages/ShopSetup'))
const ShopPage          = lazyRetry(() => import('./pages/ShopPage'))
const ShopsPage         = lazyRetry(() => import('./pages/ShopsPage'))
const SearchPage        = lazyRetry(() => import('./pages/SearchPage'))
const ExplorePage       = lazyRetry(() => import('./pages/ExplorePage'))
const ListingsPage      = lazyRetry(() => import('./pages/ListingsPage'))
const CallBudgetPage    = lazyRetry(() => import('./pages/CallBudget'))
const SafetyPage        = lazyRetry(() => import('./pages/SafetyPage'))
const ServiceDetailsPage = lazyRetry(() => import('./pages/ServiceDetailsPage'))

import ErrorBoundary from './components/ErrorBoundary'
import AdminGate from './components/AdminGate'
import OfflinePage from './components/OfflinePage'
import GlobalCallListener from './components/GlobalCallListener'
import FloatingIncomingCall from './components/FloatingIncomingCall'
import NotificationToast from './components/NotificationToast'
import PersistentCallShell from './components/PersistentCallShell'
import MiniCallBar from './components/MiniCallBar'
import StatusPublishRing from './components/StatusPublishRing'
import SokoLoader from './components/SokoLoader'
import { CallProvider }   from './context/CallContext'
import { NetworkProvider } from './context/NetworkContext'
import { useGlobalPresence } from './hooks/usePresence'
import { registerPushNotifications, listenForServiceWorkerMessages } from './lib/pushNotifications'

const INSTALL_DISMISS_KEY = 'soko-install-dismissed-at'
const INSTALL_INSTALLED_KEY = 'soko-install-installed'
const INSTALL_DISMISS_MS = 14 * 24 * 60 * 60 * 1000

const INSTALL_BAR_CSS = `
body.install-bar-visible {
  padding-bottom: calc(64px + env(safe-area-inset-bottom, 0px));
}
.soko-install-bar {
  position: fixed;
  left: 12px;
  right: 12px;
  bottom: 0;
  z-index: 999;
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 10px;
  min-height: 64px;
  max-height: 64px;
  padding: 0 16px;
  border-radius: 16px;
  border: 1px solid #e0ebe3;
  background: #fff;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.18);
  font-family: inherit;
}
.soko-install-logo {
  width: 36px;
  height: 36px;
  flex: none;
  border-radius: 8px;
}
.soko-install-copy {
  flex: 1 1 auto;
  min-width: 0;
}
.soko-install-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #0a1a0f;
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
}
.soko-install-sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #7b8a80;
  font-size: 12px;
  line-height: 1.3;
}
.soko-install-actions {
  display: flex;
  flex: none;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 8px;
}
.soko-install-dismiss,
.soko-install-button {
  flex: none;
  height: 40px;
  white-space: nowrap;
  cursor: pointer;
  font-family: inherit;
}
.soko-install-dismiss {
  padding: 0 10px;
  border: none;
  background: transparent;
  color: #637068;
  font-size: 13px;
  font-weight: 600;
}
.soko-install-button {
  padding: 0 18px;
  border: none;
  border-radius: 999px;
  background: #0F9D58;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}
@media (max-width: 768px) {
  body.install-bar-visible {
    padding-bottom: calc(144px + env(safe-area-inset-bottom, 0px));
  }
  .soko-install-bar {
    left: 0;
    right: 0;
    bottom: calc(var(--bottom-nav-h, 60px) + env(safe-area-inset-bottom, 0px));
    z-index: 999;
    min-height: 56px;
    max-height: 56px;
    padding: 0 12px;
    border-radius: 0;
    border-right: none;
    border-bottom: none;
    border-left: none;
  }
  .soko-install-actions {
    gap: 4px;
  }
  .soko-install-dismiss {
    padding: 0 6px;
    font-size: 12px;
  }
  .soko-install-button {
    padding: 0 14px;
    font-size: 12px;
  }
}
`

function isInstallSuppressed() {
  try {
    if (localStorage.getItem(INSTALL_INSTALLED_KEY) === '1') return true
    const dismissedAt = Number(localStorage.getItem(INSTALL_DISMISS_KEY))
    if (dismissedAt && Date.now() - dismissedAt < INSTALL_DISMISS_MS) return true
  } catch (err) {
    console.warn('[SokoMw] install preference read failed', err)
  }
  try {
    if (window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone) return true
  } catch (err) {
    console.warn('[SokoMw] install mode check failed', err)
  }
  return false
}

function markInstallDismissed() {
  try {
    localStorage.setItem(INSTALL_DISMISS_KEY, String(Date.now()))
  } catch (err) {
    console.warn('[SokoMw] install dismissal save failed', err)
  }
}

function markInstalled() {
  try {
    localStorage.setItem(INSTALL_INSTALLED_KEY, '1')
  } catch (err) {
    console.warn('[SokoMw] install state save failed', err)
  }
}

// ── Branded page loader ────────────────────────────────────
function PageLoader() {
  return <SokoLoader />
}

function BootLoaderHider() {
  const location = useLocation()
  useEffect(() => {
    const hide = window.__hideBootLoader
    if (typeof hide !== 'function') return
    let r1 = 0, r2 = 0
    r1 = requestAnimationFrame(() => { r2 = requestAnimationFrame(() => { hide() }) })
    if (import.meta.env.DEV) {
      const path = location.pathname
      setTimeout(() => {
        const el = document.getElementById('boot-loader')
        if (el && !el.dataset.hiding) {
          console.warn('[SokoMw] route rendered without hiding boot loader:', path)
        }
      }, 1000)
    }
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
  }, [location.pathname])
  return null
}

/** Home-style bottom nav for mobile across authenticated marketplace pages */
function AppMobileBottomNav({ enabled }) {
  const location = useLocation()
  if (!enabled) return null
  const p = location.pathname
  // Hide on auth, admin, onboarding, payment, and open chat threads
  if (
    p.startsWith('/login') ||
    p.startsWith('/auth') ||
    p.startsWith('/reset-password') ||
    p.startsWith('/admin') ||
    p.startsWith('/onboarding') ||
    p.startsWith('/verify-payment') ||
    p.startsWith('/call-budget') ||
    p.startsWith('/services/') ||
    p.startsWith('/chat/')
  ) {
    return null
  }
  return <BottomNav />
}

function stopRingtone() {
  if (window._ringtoneAudio) {
    window._ringtoneAudio.pause()
    window._ringtoneAudio.currentTime = 0
    window._ringtoneAudio = null
  }
}

function playRingtone() {
  if (window._ringtoneAudio) return  // already playing — don't restart
  try {
    const audio = new Audio('/ringtone.mp3')
    audio.loop = true
    audio.volume = 1.0
    window._ringtoneAudio = audio
    audio.play().catch(e => console.log('[ringtone] play blocked:', e))
  } catch (e) {
    console.log('[ringtone] error:', e)
  }
}

async function recoverStaleBuild() {
  try {
    if (sessionStorage.getItem('chunk-reloaded') === '1') return false
    sessionStorage.setItem('chunk-reloaded', '1')
  } catch { /* ignore */ }
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map(r => r.unregister()))
    }
  } catch { /* ignore */ }
  try {
    if (window.caches) {
      const keys = await caches.keys()
      await Promise.all(keys.map(k => caches.delete(k)))
    }
  } catch { /* ignore */ }
  try { location.reload() } catch { /* ignore */ }
  return true
}

function isStaleChunkError(err) {
  const msg = String(err?.message || err || '')
  return /dynamically imported module|Failed to fetch|Importing a module script failed/i.test(msg)
}

function lazyRetry(factory) {
  return lazy(async () => {
    try {
      const mod = await factory()
      try { sessionStorage.removeItem('chunk-reloaded') } catch { /* ignore */ }
      return mod
    } catch {
      await new Promise(r => setTimeout(r, 300))
      try {
        const mod = await factory()
        try { sessionStorage.removeItem('chunk-reloaded') } catch { /* ignore */ }
        return mod
      } catch (secondErr) {
        if (isStaleChunkError(secondErr)) {
          const reloaded = await recoverStaleBuild()
          if (reloaded) {
            return new Promise(() => {})
          }
        }
        throw secondErr
      }
    }
  })
}

function VersionWatcher() {
  const location = useLocation()
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const shownRef = useRef(false)
  const reloadedRef = useRef(false)

  useEffect(() => {
    const BUILD_ID = __BUILD_ID__
    let interval
    const check = async () => {
      try {
        const res = await fetch('/version.json', { cache: 'no-store' })
        if (!res.ok) return
        const data = await res.json()
        if (data?.buildId && data.buildId !== BUILD_ID && !shownRef.current) {
          shownRef.current = true
          setUpdateAvailable(true)
        }
      } catch { /* ignore */ }
    }
    check()
    interval = setInterval(check, 5 * 60 * 1000)
    const onFocus = () => check()
    const onVis = () => { if (document.visibilityState === 'visible') check() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(interval)
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  useEffect(() => {
    if (!updateAvailable || reloadedRef.current) return
    reloadedRef.current = true
    // auto-reload on next route navigation
  }, [location.pathname, updateAvailable])

  // trigger reload on navigation
  useEffect(() => {
    if (!updateAvailable || !reloadedRef.current) return
    // already handled by setting reloadedRef; reload now
  }, [location.pathname])

  // We need actual reload when navigating after update:
  const prevPathRef = useRef(location.pathname)
  useEffect(() => {
    if (updateAvailable && location.pathname !== prevPathRef.current && !reloadedRef.current) {
      reloadedRef.current = true
      reloadAll()
    }
    prevPathRef.current = location.pathname
  }, [location.pathname, updateAvailable])

  async function reloadAll() {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.unregister()))
      }
    } catch { /* ignore */ }
    try {
      if (window.caches) {
        const keys = await caches.keys()
        await Promise.all(keys.map(k => caches.delete(k)))
      }
    } catch { /* ignore */ }
    try { sessionStorage.removeItem('chunk-reloaded') } catch { /* ignore */ }
    window.location.reload()
  }

  if (!updateAvailable) return null
  return (
    <div style={{
      position: 'fixed', bottom: 80, left: '50%', transform: 'translateX(-50%)',
      zIndex: 9999, background: '#0f1410', color: '#fff',
      padding: '10px 14px', borderRadius: 12, display: 'flex', gap: 10,
      alignItems: 'center', boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 13,
    }}>
      <span>New version available. Reload</span>
      <button
        onClick={reloadAll}
        style={{ background: '#0F9D58', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontFamily: 'inherit' }}
      >
        Reload
      </button>
    </div>
  )
}

export default function App() {
  const [session,    setSession]    = useState(undefined)
  const [role,       setRole]       = useState(undefined)
  const [isRecovery, setIsRecovery] = useState(false)
const [installPrompt, setInstallPrompt] = useState(null)

  // Central boot-loader hide: fires after first commit of any route/gate state.
  useLayoutEffect(() => {
    let r1 = 0, r2 = 0
    r1 = requestAnimationFrame(() => {
      r2 = requestAnimationFrame(() => {
        const hide = window.__hideBootLoader
        if (typeof hide === 'function') hide()
      })
    })
    return () => { cancelAnimationFrame(r1); cancelAnimationFrame(r2) }
  }, [])

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Avoid infinite PageLoader when Vercel build is missing VITE_ env vars
      setSession(null)
      setRole(null)
      return undefined
    }

    supabase.auth.getSession()
      .then(({ data }) => {
        setSession(data.session)
        if (data.session) {
          fetchRole(data.session.user.id)
          setupPush(data.session)
        } else {
          setRole(null)
        }
      })
      .catch((err) => {
        console.error('[SokoMw] getSession failed', err)
        setSession(null)
        setRole(null)
      })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        setIsRecovery(true)
        setSession(session)
        setRole(null)
        return
      }

      if (event === 'SIGNED_IN' && isRecovery) {
        setIsRecovery(false)
        return
      }

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session) {
          fetchRole(session.user.id)
          setupPush(session)
        }
        setSession(session)
        return
      }

      if (event === 'SIGNED_OUT') {
        setSession(null)
        setRole(null)
        setIsRecovery(false)
        // Don't navigate — if disabled, window.location.href already redirected with ?disabled=1
        return
      }

      setSession(session)
      if (session) {
        fetchRole(session.user.id)
        setupPush(session)
      } else {
        setRole(null)
        setIsRecovery(false)
      }
    })

    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onBeforeInstallPrompt = (e) => {
      e.preventDefault()
      if (isInstallSuppressed()) return
      setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
  }, [])

  useEffect(() => {
    document.body.classList.toggle('install-bar-visible', !!installPrompt)
    return () => document.body.classList.remove('install-bar-visible')
  }, [installPrompt])

  useEffect(() => {
    // Slide the fixed bottom nav off-screen while the on-screen keyboard
    // covers it (visualViewport shrinks on iOS + Android overlay mode).
    const vv = window.visualViewport
    if (!vv) return
    let noKeyboard = vv.height
    const update = () => {
      const now = vv.height
      const keyboardLikely = now < noKeyboard - 120 || now < window.innerHeight * 0.7
      document.body.classList.toggle('keyboard-open', keyboardLikely)
      if (!keyboardLikely) noKeyboard = now
    }
    vv.addEventListener('resize', update)
    window.addEventListener('resize', update)
    update()
    return () => {
      vv.removeEventListener('resize', update)
      window.removeEventListener('resize', update)
    }
  }, [])

  function setupPush(session) {
    if (!session?.user) return
    registerPushNotifications(session.user.id, supabase)
    listenForServiceWorkerMessages({
      onIncomingCall: ({ callId, fromUser, chatId, callType, callerName }) => {
        console.log('[app] INCOMING_CALL from SW — playing ringtone')
        // Deduplicate — SW sometimes fires multiple times for same call
        const dedupKey = `${fromUser}`
        if (window.__lastSwCall?.[dedupKey] && Date.now() - window.__lastSwCall[dedupKey] < 35000) return
        window.__lastSwCall = { ...(window.__lastSwCall || {}), [dedupKey]: Date.now() }
        setTimeout(() => { if (window.__lastSwCall) delete window.__lastSwCall[dedupKey] }, 60000)

        playRingtone()
        window.dispatchEvent(new CustomEvent('sw-incoming-call', {
          detail: { callId, fromUser, chatId, callType, callerName }
        }))
      },
      onAnswer: (fromUser, callId, chatId) => {
        stopRingtone()
        // If GlobalCallListener is already answering this call in-app, don't
        // steal it with a hard navigation (which would wipe its in-memory
        // call-stack claim mid-answer).
        const globalActive = sessionStorage.getItem('__globalCallActive')
        if (globalActive && String(globalActive) === String(callId)) {
          return
        }
        // chatId is "callerId" or "callerId/listingId" (never the callee's self-chat)
        const cleaned = chatId
          ? String(chatId).replace(/^\/chat\//, '').replace(/^\//, '')
          : ''
        const url = cleaned
          ? `/chat/${cleaned}`
          : (fromUser ? `/chat/${fromUser}` : '/chats')
        window.location.href = url
      },
      onDecline: () => { stopRingtone() },
    })
  }

  async function handleInstall() {
    if (!installPrompt) return
    try {
      await installPrompt.prompt()
      const { outcome } = await installPrompt.userChoice
      console.log('[app] install prompt outcome:', outcome)
      if (outcome === 'accepted') markInstalled()
    } catch (err) {
      console.warn('[app] install prompt failed', err)
    } finally {
      // Clear either way — the event is single-use, so a spent prompt must
      // not remain tappable.
      setInstallPrompt(null)
    }
  }

  async function fetchRole(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('role, is_disabled, onboarded, onboarding_skipped')
      .eq('id', userId)
      .single()
    if (data?.is_disabled) {
      await supabase.auth.signOut()
      setSession(null)
      setRole(null)
      window.location.replace('/login?disabled=1')
      return
    }
    setRole(data?.role ?? 'user')
    const needsOnboarding = data && !data.onboarded && !data.onboarding_skipped
    if (needsOnboarding && window.location.pathname !== '/onboarding') {
      window.location.replace('/onboarding')
    }
  }

  useGlobalPresence(session?.user?.id ?? null)

  if (session === undefined || (session && !isRecovery && role === undefined)) {
    return <PageLoader />
  }

  const isAdmin = role === 'admin'
  const authed  = !!session && !isRecovery

  return (
    <CallProvider>
    <NetworkProvider>
      <OfflinePage />
      {installPrompt && (
        <div className="soko-install-bar">
          <style>{INSTALL_BAR_CSS}</style>
          <img className="soko-install-logo" src="/icons/icon-192.png" alt="" />
          <div className="soko-install-copy">
            <div className="soko-install-title">Install SokoMw</div>
            <div className="soko-install-sub">Add to home screen for quick access</div>
          </div>
          <div className="soko-install-actions">
            <button
              type="button"
              className="soko-install-dismiss"
              onClick={() => {
                markInstallDismissed()
                setInstallPrompt(null)
              }}
            >Not now</button>
            <button type="button" className="soko-install-button" onClick={handleInstall}>Install</button>
          </div>
        </div>
      )}
       <BrowserRouter>
        <BootLoaderHider />
        <VersionWatcher />
        {authed && <GlobalCallListener />}
{authed && <FloatingIncomingCall />}
{authed && <NotificationToast />}
        {authed && <PersistentCallShell />}
        {authed && <MiniCallBar />}
        {authed && <StatusPublishRing />}
        <Suspense fallback={<PageLoader />}>
          <ErrorBoundary>
          <Routes>
            {/* ── Auth routes ───────────────────────────── */}
            <Route path="/login"          element={!authed ? <Login /> : <Navigate to={isAdmin ? '/admin' : '/'} />} />
            <Route path="/auth/callback"  element={<AuthCallback />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* ── Admin ─────────────────────────────────── */}
            <Route path="/admin/*" element={<AdminGate />} />

            {/* ── Public service details ────────────────── */}
            <Route path="/services/:id" element={<ServiceDetailsPage />} />

            {/* ── Protected routes ──────────────────────── */}
            <Route path="/"                        element={authed ? (isAdmin ? <Navigate to="/admin" /> : <Home />)      : <Navigate to="/login" />} />
            <Route path="/listing/:id"             element={authed ? <ListingDetail />  : <Navigate to="/login" />} />
            <Route path="/post"                    element={authed ? <PostListing />    : <Navigate to="/login" />} />
            <Route path="/chats"                   element={authed ? <ChatsLayout />    : <Navigate to="/login" />} />
            <Route path="/chat/:userId/:listingId" element={authed ? <ChatsLayout />    : <Navigate to="/login" />} />
            <Route path="/chat/:userId"            element={authed ? <ChatsLayout />    : <Navigate to="/login" />} />
            <Route path="/profile"                 element={authed ? <Profile />        : <Navigate to="/login" />} />
            <Route path="/services"                element={<Services />} />
            <Route path="/profile/:id"             element={authed ? <PublicProfile />  : <Navigate to="/login" />} />
            <Route path="/post/edit/:id"           element={authed ? <PostListing />    : <Navigate to="/login" />} />
            <Route path="/status"          element={authed ? <StatusPage />        : <Navigate to="/login" />} />
            <Route path="/status/:statusId" element={authed ? <StatusPage />       : <Navigate to="/login" />} />
            <Route path="/story/:storyId"   element={authed ? <StoryViewerPage />   : <Navigate to="/login" />} />
            <Route path="/saved-statuses"  element={authed ? <SavedStatusesPage /> : <Navigate to="/login" />} />
            <Route path="/notifications"           element={authed ? <Notifications />  : <Navigate to="/login" />} />
            <Route path="/looking-for"             element={authed ? <LookingFor />     : <Navigate to="/login" />} />
            <Route path="/verify-payment"          element={<VerifyPayment />} />
            <Route path="/onboarding"              element={authed ? <Onboarding />     : <Navigate to="/login" />} />
            <Route path="/shop-setup"              element={authed ? <ShopSetup />      : <Navigate to="/login" />} />
            <Route path="/shop/:slug"              element={authed ? <ShopPage />       : <Navigate to="/login" />} />
            <Route path="/shops"                   element={authed ? <ShopsPage />      : <Navigate to="/login" />} />
            <Route path="/search"                  element={authed ? <SearchPage />     : <Navigate to="/login" />} />
<Route path="/explore"                 element={authed ? <ExplorePage />    : <Navigate to="/login" />} />
            <Route path="/listings"                element={authed ? <ListingsPage />   : <Navigate to="/login" />} />
            <Route path="/safety"                  element={authed ? <SafetyPage />    : <Navigate to="/login" />} />
            <Route path="/call-budget"             element={authed ? <CallBudgetPage /> : <Navigate to="/login" />} />
            <Route path="/jobs"                    element={<Navigate to="/" replace />} />
            <Route path="/jobs/*"                  element={<Navigate to="/" replace />} />
            <Route path="*"                        element={<Navigate to="/" />} />
          </Routes>
          </ErrorBoundary>
        </Suspense>
        {/* Single mobile bottom nav for the whole marketplace app */}
        <AppMobileBottomNav enabled={authed && !isAdmin && !isRecovery} />
      </BrowserRouter>
    </NetworkProvider>
    </CallProvider>
  )
}
