import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  preview: {
    port: 4173,
  },
  build: {
    // Split chunks so each page loads only what it needs
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React — always needed
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Supabase — loaded once on auth
          'vendor-supabase': ['@supabase/supabase-js'],
        },
      },
    },
    // Warn if any chunk exceeds 500kb
    chunkSizeWarningLimit: 500,
  },
})