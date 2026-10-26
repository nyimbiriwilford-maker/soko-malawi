import { defineConfig, loadEnv } from 'vite'
import fs from 'node:fs'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const BUILD_ID = String(Date.now())

function versionPlugin() {
  return {
    name: 'version-json',
    buildStart() {
      try { fs.writeFileSync('public/version.json', JSON.stringify({ buildId: BUILD_ID })) } catch { /* ignore */ }
    },
    config() {
      return { define: { __BUILD_ID__: JSON.stringify(BUILD_ID) } }
    },
  }
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    server: {
      allowedHosts: 'all',
      proxy: {
        // Forward /api/* to the Vercel functions in dev. Set VITE_API_PROXY to
        // your Vercel deployment URL (e.g. https://soko-malawi.vercel.app), or
        // leave it unset to use `vercel dev` locally (defaults to :3000).
        '/api': {
          target: env.VITE_API_PROXY || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
    plugins: [react(), tailwindcss(), versionPlugin()],
    preview: {
      port: 4173,
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('react-router-dom') || id.includes('react-dom') || id.includes('node_modules/react/')) {
              return 'vendor-react'
            }
            if (id.includes('@supabase')) {
              return 'vendor-supabase'
            }
            if (id.includes('node_modules')) {
              return 'vendor'
            }
          }
        }
      },
      chunkSizeWarningLimit: 500,
    },
  }
})