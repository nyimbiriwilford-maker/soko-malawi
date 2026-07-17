import { useEffect, useState, lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { supabase } from './lib/supabase'
import BottomNav from './components/BottomNav'
const StatusPage          = lazy(() => import('./pages/StatusPage'))
const SavedStatusesPage   = lazy(() => import('./pages/SavedStatusesPage'))
const LookingFor = lazy(() => import('./pages/LookingFor/LookingFor'))

// ── Eagerly loaded (needed immediately on first paint) ────
import Login        from './pages/Login'
import AuthCallback from './pages/AuthCallback'

// ── Lazy loaded (only fetched when route is visited) ──────
const Home          = lazy(() => import('./pages/Home'))
const ListingDetail = lazy(() => import('./pages/ListingDetail'))
const PostListing   = lazy(() => import('./pages/PostListing'))
const ChatsLayout   = lazy(() => import('./pages/ChatsLayout'))
const Profile       = lazy(() => import('./pages/Profile'))
const Jobs          = lazy(() => import('./pages/Jobs'))
const Services      = lazy(() => import('./pages/ServicesPage'))
const Admin         = lazy(() => import('./pages/Admin'))
const PublicProfile = lazy(() => import('./pages/PublicProfile'))
const ResetPassword   = lazy(() => import('./pages/ResetPassword'))
const Notifications   = lazy(() => import('./pages/Notifications'))
const VerifyPayment   = lazy(() => import('./pages/VerifyPayment'))
const Onboarding       = lazy(() => import('./pages/Onboarding'))
const ShopSetup        = lazy(() => import('./pages/ShopSetup'))
const ShopPage          = lazy(() => import('./pages/ShopPage'))
const ShopsPage         = lazy(() => import('./pages/ShopsPage'))
const SearchPage        = lazy(() => import('./pages/SearchPage'))
const ListingsPage      = lazy(() => import('./pages/ListingsPage'))

import GlobalCallListener from './components/GlobalCallListener'
import { CallProvider }   from './context/CallContext'
import { useGlobalPresence } from './hooks/usePresence'
import { registerPushNotifications, listenForServiceWorkerMessages } from './lib/pushNotifications'

// ── Spinner shown while lazy chunks download ──────────────
function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100vh', background: '#0f1410',
    }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{
          width: 36, height: 36,
          border: '3px solid #1a7a4a',
          borderTopColor: '#5de89e',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
          margin: '0 auto 12px',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
        <p style={{ color: '#637068', fontSize: 13 }}>Loading…</p>
      </div>
    </div>
  )
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

export default function App() {
  const [session,    setSession]    = useState(undefined)
  const [role,       setRole]       = useState(undefined)
  const [isRecovery, setIsRecovery] = useState(false)
const [installPrompt, setInstallPrompt] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) {
        fetchRole(data.session.user.id)
        setupPush(data.session)
      } else {
        setRole(null)
      }
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
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault()
      setInstallPrompt(e)
    })
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
        const url = chatId ? `/chat/${chatId}` : `/chat/${fromUser}`
        window.location.href = url
      },
      onDecline: () => { stopRingtone() },
    })
  }

  async function handleInstall() {
    if (!installPrompt) return
    await installPrompt.prompt()
    setInstallPrompt(null)
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
      {installPrompt && (
        <div style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
          background: '#1a1f1b', borderTop: '1px solid #2e7d32',
          padding: '12px 16px', display: 'flex',
          alignItems: 'center', justifyContent: 'space-between', gap: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <img src="/icons/icon-192.png" style={{ width: 36, height: 36, borderRadius: 8 }} />
            <div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>Install SokoMw</div>
              <div style={{ color: '#8a9e8f', fontSize: 12 }}>Add to home screen for quick access</div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setInstallPrompt(null)} style={{
              background: 'transparent', border: '1px solid #3a4a3d',
              color: '#8a9e8f', borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
            }}>Not now</button>
            <button onClick={handleInstall} style={{
              background: '#2e7d32', border: 'none',
              color: '#fff', borderRadius: 20, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            }}>Install</button>
          </div>
        </div>
      )}
      <BrowserRouter>
        {authed && <GlobalCallListener />}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* ── Auth routes ───────────────────────────── */}
            <Route path="/login"          element={!authed ? <Login /> : <Navigate to={isAdmin ? '/admin' : '/'} />} />
            <Route path="/auth/callback"  element={<AuthCallback />} />
            <Route path="/reset-password" element={<ResetPassword />} />

            {/* ── Admin ─────────────────────────────────── */}
            <Route path="/admin/*" element={
              !authed ? <Navigate to="/login" /> :
              isAdmin ? <Admin />               :
                        <Navigate to="/" />
            } />

            {/* ── Protected routes ──────────────────────── */}
            <Route path="/"                        element={authed ? (isAdmin ? <Navigate to="/admin" /> : <Home />)      : <Navigate to="/login" />} />
            <Route path="/listing/:id"             element={authed ? <ListingDetail />  : <Navigate to="/login" />} />
            <Route path="/post"                    element={authed ? <PostListing />    : <Navigate to="/login" />} />
            <Route path="/chats"                   element={authed ? <ChatsLayout />    : <Navigate to="/login" />} />
            <Route path="/chat/:userId/:listingId" element={authed ? <ChatsLayout />    : <Navigate to="/login" />} />
            <Route path="/chat/:userId"            element={authed ? <ChatsLayout />    : <Navigate to="/login" />} />
            <Route path="/profile"                 element={authed ? <Profile />        : <Navigate to="/login" />} />
            <Route path="/jobs"                    element={authed ? <Jobs />           : <Navigate to="/login" />} />
            <Route path="/services"                element={authed ? <Services />       : <Navigate to="/login" />} />
            <Route path="/profile/:id"             element={authed ? <PublicProfile />  : <Navigate to="/login" />} />
            <Route path="/post/edit/:id"           element={authed ? <PostListing />    : <Navigate to="/login" />} />
            <Route path="/status"          element={authed ? <StatusPage />        : <Navigate to="/login" />} />
            <Route path="/saved-statuses"  element={authed ? <SavedStatusesPage /> : <Navigate to="/login" />} />
            <Route path="/notifications"           element={authed ? <Notifications />  : <Navigate to="/login" />} />
            <Route path="/looking-for"             element={authed ? <LookingFor />     : <Navigate to="/login" />} />
            <Route path="/verify-payment"          element={<VerifyPayment />} />
            <Route path="/onboarding"              element={authed ? <Onboarding />     : <Navigate to="/login" />} />
            <Route path="/shop-setup"              element={authed ? <ShopSetup />      : <Navigate to="/login" />} />
            <Route path="/shop/:slug"              element={authed ? <ShopPage />       : <Navigate to="/login" />} />
            <Route path="/shops"                   element={authed ? <ShopsPage />      : <Navigate to="/login" />} />
            <Route path="/search"                  element={authed ? <SearchPage />     : <Navigate to="/login" />} />
            <Route path="/listings"                element={authed ? <ListingsPage />   : <Navigate to="/login" />} />
            <Route path="*"                        element={<Navigate to="/" />} />
          </Routes>
        </Suspense>
        {/* Single mobile bottom nav for the whole marketplace app */}
        <AppMobileBottomNav enabled={authed && !isAdmin && !isRecovery} />
      </BrowserRouter>
    </CallProvider>
  )
}