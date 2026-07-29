import { useState, useEffect } from 'react'
import { WifiOff, X } from 'lucide-react'
import { useNetwork } from '../context/NetworkContext'

export default function OfflineBanner({ message = 'You are offline. Some features may not work.' }) {
  const { isOffline } = useNetwork()
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    if (isOffline) setDismissed(false)
  }, [isOffline])

  if (!isOffline || dismissed) return null

  return (
    <div className="flex items-center justify-between gap-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm px-3 py-2 rounded-lg mb-3">
      <div className="flex items-center gap-2">
        <WifiOff className="w-4 h-4 shrink-0" />
        <span>{message}</span>
      </div>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss offline warning"
        className="text-amber-600 hover:text-amber-900"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
