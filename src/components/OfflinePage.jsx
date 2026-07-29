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
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] bg-green-600 text-white px-4 py-2 rounded-full shadow-lg text-sm font-medium animate-in fade-in slide-in-from-top-2">
        You're back online
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-[9998] bg-white flex flex-col items-center justify-center px-6 text-center">
      <div className="w-14 h-14 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center mb-6">
        <WifiOff className="w-6 h-6 text-gray-500" />
      </div>
      <h1 className="text-[17px] font-medium text-gray-900 mb-2">
        {reconnecting ? 'Reconnecting...' : "You're offline"}
      </h1>
      <p className="text-[13px] text-gray-500 leading-relaxed mb-8 max-w-[280px]">
        {reconnecting
          ? 'Checking your connection, hang tight.'
          : "Check your Wi-Fi or mobile data. SokoMW will reconnect automatically once you're back."}
      </p>
      <div className="flex gap-2.5">
        <button
          onClick={() => NM.forceCheck()}
          className="flex items-center gap-2 px-[18px] py-2 rounded-lg bg-gray-900 text-white text-[13px] font-medium hover:bg-gray-800 transition"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </button>
        <a
          href="/"
          className="flex items-center gap-2 px-[18px] py-2 rounded-lg border border-gray-300 text-gray-500 text-[13px] font-medium hover:bg-gray-50 transition"
        >
          <Home className="w-3.5 h-3.5" />
          Go home
        </a>
      </div>
    </div>
  )
}