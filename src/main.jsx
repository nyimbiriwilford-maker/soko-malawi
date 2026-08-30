import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import '@fontsource/dm-sans/400.css'
import '@fontsource/dm-sans/500.css'
import '@fontsource/dm-sans/700.css'
import '@fontsource/sora/700.css'
import '@fontsource/sora/800.css'
// Register the service worker only in production builds.
// In Vite dev, an SW intercepts /@vite/client and /src/* and returns 504s → blank page.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
      // Page loaded fine — after 15s clear the bail-out flag so a future
      // stale-shell incident can still recover.
      setTimeout(() => {
        try { sessionStorage.removeItem('sokomw-shell-reload') } catch { /* ignore */ }
      }, 15000)
    })
    window.addEventListener('error', e => {
      // Stale cached shell referencing purged bundles → recover instead of
      // sitting on a blank white page (esp. mobile PWA). Reload at most once
      // per 15s window to avoid a reload loop while a deploy propagates.
      const src = e?.target?.src || e?.target?.href
      if (!src || !/\/assets\/|\.js($|\?)|\.css($|\?)/.test(src)) return
      try {
        if (sessionStorage.getItem('sokomw-shell-reload') === '1') return
        sessionStorage.setItem('sokomw-shell-reload', '1')
      } catch { /* ignore */ }
      window.location.reload()
    }, true)
  } else {
    // Kill any leftover SW from a previous production/PWA session on localhost
    window.addEventListener('load', async () => {
      try {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map(r => r.unregister()))
        if (window.caches?.keys) {
          const keys = await caches.keys()
          await Promise.all(keys.map(k => caches.delete(k)))
        }
      } catch {
        /* ignore */
      }
    })
  }
}
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)