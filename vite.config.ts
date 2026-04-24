import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        // Pull recharts (and its d3 deps) out of AnalyticsPage's chunk so the
        // library can be cached independently. AnalyticsPage is lazy-loaded,
        // so this doesn't change first-paint for most users — it just means a
        // returning-visitor gets a ~300kB chunk they already have on disk.
        // Also splits Supabase + TanStack Query for the same reason.
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-')) return 'charts'
            if (id.includes('@supabase')) return 'supabase'
            if (id.includes('@tanstack/react-query')) return 'query'
          }
        },
      },
    },
  },
})
