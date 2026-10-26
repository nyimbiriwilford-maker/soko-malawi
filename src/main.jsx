import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/sora/700.css'
import '@fontsource/sora/800.css'
async function recoverStaleBuildMain() {
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

function isStaleChunkErrorMain(err) {
  const msg = String(err?.message || err || '')
  return /dynamically imported module|Failed to fetch|Importing a module script failed/i.test(msg)
}

// Global stale-chunk recovery
window.addEventListener('vite:preloadError', async (e) => {
  try { e.preventDefault() } catch { /* ignore */ }
  await recoverStaleBuildMain()
})
window.addEventListener('unhandledrejection', async (e) => {
  if (!isStaleChunkErrorMain(e?.reason)) return
  const reloaded = await recoverStaleBuildMain()
  if (reloaded) try { e.preventDefault() } catch { /* ignore */ }
})

// Register the service worker only in production builds.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    let refreshing = false
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return
      refreshing = true
      window.location.reload()
    })

    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js')
        if (reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' })
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing
          if (!nw) return
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              nw.postMessage({ type: 'SKIP_WAITING' })
            }
          })
        })
      } catch { /* ignore */ }
      setTimeout(() => {
        try { sessionStorage.removeItem('chunk-reloaded') } catch { /* ignore */ }
      }, 15000)
    })

    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState !== 'visible') return
      try {
        const reg = await navigator.serviceWorker.getRegistration()
        if (reg) await reg.update()
      } catch { /* ignore */ }
    })
  } else {
    window.addEventListener('load', async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.unregister()))
        if (window.caches?.keys) {
          const keys = await caches.keys()
          await Promise.all(keys.map(k => caches.delete(k)))
        }
      } catch { /* ignore */ }
    })
  }
}
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)