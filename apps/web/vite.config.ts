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
  media:         3006,
}

// Point the SPA at a deployed environment by setting VITE_API_TARGET to the ALB
// URL (e.g. http://xcloud-beta-xxxx.us-east-2.elb.amazonaws.com). The ALB does
// path-based routing for every service, so all /api/v1/* go to the one target.
// Unset → local dev: each service proxied to its own localhost port.
const API_TARGET = process.env.VITE_API_TARGET

const proxy: Record<string, ProxyOptions> = Object.fromEntries(
  Object.entries(SERVICE_PORTS).map(([name, port]) => [
    `/api/v1/${name}`,
    {
      target:       API_TARGET || `http://localhost:${port}`,
      changeOrigin: true,
      // ws:true proxies the notification-service WebSocket (/api/v1/notifications/ws);
      // harmless for the HTTP-only services.
      ws:           true,
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
