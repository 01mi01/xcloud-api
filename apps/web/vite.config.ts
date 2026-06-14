import { defineConfig, type ProxyOptions } from 'vite'
import react from '@vitejs/plugin-react'

// Each backend microservice has its own port. The dev proxy below maps
// /api/v1/<service>/* → http://localhost:<port>/v1/<service>/*
// so the SPA can use same-origin requests and no CORS is needed.
const SERVICE_PORTS: Record<string, number> = {
  auth:          3000,
  users:         3001,
  tweets:        3002,
  feed:          3003,
  notifications: 3004,
  search:        3005,
}

const proxy: Record<string, ProxyOptions> = Object.fromEntries(
  Object.entries(SERVICE_PORTS).map(([name, port]) => [
    `/api/v1/${name}`,
    {
      target:       `http://localhost:${port}`,
      changeOrigin: true,
      rewrite:      (path: string) => path.replace(/^\/api/, ''),
    },
  ]),
)

// Real-time notifications channel: proxy the WebSocket upgrade at /ws to the
// notification-service so the SPA can use a same-origin ws:// URL.
proxy['/ws'] = {
  target: `ws://localhost:${SERVICE_PORTS.notifications}`,
  ws:     true,
  changeOrigin: true,
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy,
  },
})
