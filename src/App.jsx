import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Home from './pages/Home'
import ListingDetail from './pages/ListingDetail'
import PostListing from './pages/PostListing'
import Chat from './pages/Chat'
import ChatList from './pages/ChatList'
import Profile from './pages/Profile'
import Jobs from './pages/Jobs'
import Services from './pages/ServicesPage'
import Admin from './pages/Admin'
import GlobalCallListener from './components/GlobalCallListener'
import { CallProvider } from './context/CallContext'
import { useGlobalPresence } from './hooks/usePresence'
import PublicProfile from './pages/PublicProfile'
import { registerPushNotifications, listenForServiceWorkerMessages } from './lib/pushNotifications'

function stopRingtone() {
  if (window._ringtoneAudio) {
    window._ringtoneAudio.pause()
    window._ringtoneAudio.currentTime = 0
    window._ringtoneAudio = null
  }
}

function playRingtone() {
  stopRingtone()
  try {
    const audio = new Audio('/ringtone.mp3')
    audio.loop = true
    audio.volume = 1.0
    audio.play().catch(e => console.log('[ringtone] play blocked:', e))
    window._ringtoneAudio = audio
  } catch (e) {
    console.log('[ringtone] error:', e)
  }
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [role, setRole] = useState(undefined)

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) {
        fetchRole(session.user.id)
        setupPush(session)
      } else {
        setRole(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  function setupPush(session) {
    if (!session?.user) return
    registerPushNotifications(session.user.id, supabase)
    listenForServiceWorkerMessages({
      onIncomingCall: ({ callId, fromUser, chatId, callType, callerName }) => {
        console.log('[app] INCOMING_CALL from SW — playing ringtone')
        playRingtone()
      },
      onAnswer: (fromUser, callId, chatId) => {
        stopRingtone()
        const url = chatId ? `/chat/${chatId}` : `/chat/${fromUser}`
        window.location.href = url
      },
      onDecline: () => {
        stopRingtone()
      },
    })
  }

  async function fetchRole(userId) {
    const { data } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single()
    setRole(data?.role ?? 'user')
  }

  useGlobalPresence(session?.user?.id ?? null)

  if (session === undefined || (session && role === undefined)) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#637068' }}>
      Loading...
    </div>
  )

  const isAdmin = role === 'admin'

  return (
    <CallProvider>
      <BrowserRouter>
        {session && <GlobalCallListener />}
        <Routes>
          <Route path="/login" element={!session ? <Login /> : <Navigate to={isAdmin ? '/admin' : '/'} />} />
          <Route path="/admin/*" element={
            !session ? <Navigate to="/login" /> :
            isAdmin ? <Admin /> :
            <Navigate to="/" />
          } />
          <Route path="/" element={session ? (isAdmin ? <Navigate to="/admin" /> : <Home />) : <Navigate to="/login" />} />
          <Route path="/listing/:id" element={session ? <ListingDetail /> : <Navigate to="/login" />} />
          <Route path="/post" element={session ? <PostListing /> : <Navigate to="/login" />} />
          <Route path="/chats" element={session ? <ChatList /> : <Navigate to="/login" />} />
          <Route path="/chat/:userId/:listingId" element={session ? <Chat /> : <Navigate to="/login" />} />
          <Route path="/chat/:userId" element={session ? <Chat /> : <Navigate to="/login" />} />
          <Route path="/profile" element={session ? <Profile /> : <Navigate to="/login" />} />
          <Route path="/jobs" element={session ? <Jobs /> : <Navigate to="/login" />} />
          <Route path="/services" element={session ? <Services /> : <Navigate to="/login" />} />
          <Route path="/profile/:id" element={session ? <PublicProfile /> : <Navigate to="/login" />} />
          <Route path="/post/edit/:id" element={session ? <PostListing /> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </CallProvider>
  )
}