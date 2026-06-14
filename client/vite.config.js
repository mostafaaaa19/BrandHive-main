import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const apiTarget =
    env.VITE_API_PROXY || 'https://brandhive-apis-production.up.railway.app'
  const chatTarget = env.VITE_CHAT_PROXY || 'http://localhost:3000'

  return {
    plugins: [react()],
    build: {
      chunkSizeWarningLimit: 1000,
    },
    server: {
      port: 5173,
      strictPort: false,
      proxy: {
        '/chat/ai': {
          target: chatTarget,
          changeOrigin: true,
          secure: false,
          timeout: 60000,
        },
        '/support-local': {
          target: chatTarget,
          changeOrigin: true,
          secure: false,
          timeout: 60000,
          rewrite: (path) => path.replace(/^\/support-local/, '/support/chat'),
        },
        '/orders-local': {
          target: chatTarget,
          changeOrigin: true,
          secure: false,
          timeout: 60000,
          rewrite: (path) => path.replace(/^\/orders-local/, '/orders/seller-mirror'),
        },
        '/payouts-local': {
          target: chatTarget,
          changeOrigin: true,
          secure: false,
          timeout: 60000,
          rewrite: (path) => path.replace(/^\/payouts-local/, '/payouts/seller'),
        },
        '/brandhive-api': {
          target: apiTarget,
          changeOrigin: true,
          secure: apiTarget.startsWith('https'),
          timeout: 60000,
          proxyTimeout: 60000,
          rewrite: (path) => path.replace(/^\/brandhive-api/, ''),
          configure: (proxy) => {
            proxy.on('error', (err, _req, res) => {
              console.warn('[vite proxy]', err.message);
              if (res && !res.headersSent) {
                res.writeHead(503, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'API temporarily unavailable' }));
              }
            });
          },
        },
      },
    },
  }
})
