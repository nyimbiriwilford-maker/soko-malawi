import { createContext, useContext, useEffect, useState } from 'react'
import NM from '../lib/NetworkManager'

const NetworkContext = createContext(null)

export function NetworkProvider({ children }) {
  const [state, setState] = useState({
    isOnline: NM.isOnline,
    isOffline: NM.isOffline,
    isChecking: NM.isChecking,
    reconnecting: NM.reconnecting,
    lastConnectionTime: NM.lastConnectionTime,
  })

  useEffect(() => {
    const update = (snapshot) => setState(snapshot)

    const offOnline = NM.on('online', update)
    const offOffline = NM.on('offline', update)
    const offReconnecting = NM.on('reconnecting', update)
    const offChecking = NM.on('checking', update)

    return () => {
      offOnline()
      offOffline()
      offReconnecting()
      offChecking()
    }
  }, [])

  return (
    <NetworkContext.Provider value={state}>{children}</NetworkContext.Provider>
  )
}

export function useNetwork() {
  const ctx = useContext(NetworkContext)
  if (!ctx) {
    throw new Error('useNetwork() must be used inside a <NetworkProvider>')
  }
  return ctx
}
