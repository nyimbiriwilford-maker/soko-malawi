import { useEffect, useState, useRef } from 'react'
import { WifiOff, RefreshCw, Home } from 'lucide-react'
import { useNetwork } from '../context/NetworkContext'
import NM from '../lib/NetworkManager'

export default function OfflinePage() {
  const { isOffline, reconnecting } = useNetwork()
  const [showBackOnlineToast, setShowBackOnlineToast] = useState(false)
  const wasOffline = useRef(false)

  useEffect(() => {
    if (isOffline) {
      wasOffline.current = true
    } else if (wasOffline.current) {
      wasOffline.current = false
      setShowBackOnlineToast(true)
    }
  }, [isOffline])

  useEffect(() => {
    if (!showBackOnlineToast) return
    const t = setTimeout(() => setShowBackOnlineToast(false), 3000)
    return () => clearTimeout(t)
  }, [showBackOnlineToast])

  if (!isOffline && !showBackOnlineToast) return null

  if (showBackOnlineToast) {
    return (
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-[#1a7a4a] text-white px-5 py-2.5 rounded-full shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2 flex items-center gap-2">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
        You're back online
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[9998] bg-[#f4f8f5] flex flex-col items-center justify-center px-8 pb-[env(safe-area-inset-bottom,24px)] text-center">
      <div className="mb-6" style={{ fontFamily: "'Sora', 'Inter', system-ui, sans-serif", fontSize: 26, fontWeight: 800, color: '#1a7a4a', letterSpacing: '-0.5px', lineHeight: 1 }}>
        Soko<span style={{ color: '#d4920a' }}>Mw</span>
      </div>

      <div className="w-16 h-16 rounded-full bg-[#e6f7ee] flex items-center justify-center mb-5">
        <WifiOff className="w-7 h-7 text-[#1a7a4a]" />
      </div>

      <h1 className="text-xl font-bold text-[#0f1410] mb-2" style={{ fontFamily: "'Sora', 'DM Sans', system-ui, sans-serif", letterSpacing: '-0.3px' }}>
        {reconnecting ? 'Reconnecting…' : "You're offline"}
      </h1>
      <p className="text-[15px] text-[#637068] leading-relaxed mb-10 max-w-[320px]">
        {reconnecting
          ? 'Hang tight while we check your connection.'
          : "Check your Wi-Fi or mobile data. We'll reconnect you automatically."}
      </p>

      <div className="flex flex-col items-center gap-3 w-full max-w-[280px]">
        <button
          onClick={() => NM.forceCheck()}
          className="flex items-center justify-center gap-2 w-full min-h-[48px] rounded-xl bg-[#1a7a4a] text-white text-[15px] font-semibold hover:bg-[#0d4a2c] transition-all active:scale-[0.97]"
        >
          <RefreshCw className="w-4 h-4" />
          Retry
        </button>
        <a
          href="/"
          className="flex items-center justify-center gap-2 w-full min-h-[44px] rounded-xl border border-[#d8e5dc] text-[#637068] text-[15px] font-medium hover:bg-white hover:text-[#0f1410] hover:border-[#b8cdc0] transition-all"
        >
          <Home className="w-4 h-4" />
          Go Home
        </a>
      </div>
    </div>
  )
}
