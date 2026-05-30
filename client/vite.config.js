import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1000,
  },
  server: {
    port: 5173,
    proxy: {
      '/chat/ai': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/brandhive-api': {
        target: 'https://brandhive-apis-production.up.railway.app',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/brandhive-api/, ''),
      }
    }
  }
})
