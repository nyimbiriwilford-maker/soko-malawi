import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import Login from './pages/Login'
import Home from './pages/Home'
import ListingDetail from './pages/ListingDetail'
import PostListing from './pages/PostListing'
import Chat from './pages/Chat'
import ChatList from './pages/ChatList'
import Profile from './pages/Profile'
import Jobs from './pages/Jobs'
import Services from './pages/Services'
import GlobalCallListener from './components/GlobalCallListener'
import { CallProvider } from './context/CallContext'

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#637068' }}>
      Loading...
    </div>
  )

  return (
    <CallProvider>
      <BrowserRouter>
        {session && <GlobalCallListener />}
        <Routes>
          <Route path="/login" element={!session ? <Login /> : <Navigate to="/" />} />
          <Route path="/" element={session ? <Home /> : <Navigate to="/login" />} />
          <Route path="/listing/:id" element={session ? <ListingDetail /> : <Navigate to="/login" />} />
          <Route path="/post" element={session ? <PostListing /> : <Navigate to="/login" />} />
          <Route path="/chats" element={session ? <ChatList /> : <Navigate to="/login" />} />
          <Route path="/chat/:userId/:listingId" element={session ? <Chat /> : <Navigate to="/login" />} />
          <Route path="/chat/:userId" element={session ? <Chat /> : <Navigate to="/login" />} />        
          <Route path="/profile" element={session ? <Profile /> : <Navigate to="/login" />} />
          <Route path="/jobs" element={session ? <Jobs /> : <Navigate to="/login" />} />
          <Route path="*" element={<Navigate to="/" />} />
          <Route path="/services" element={session ? <Services /> : <Navigate to="/login" />} />
        </Routes>
      </BrowserRouter>
    </CallProvider>
  )
}