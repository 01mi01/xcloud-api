import { getToken } from "./client";

// Payload pushed by the notification-service over the WebSocket channel.
export interface NotificationPush {
  type: string;        // "like" | "follow" | "connected" | ...
  actor?: string;      // actor userId
  tweetId?: string;    // related tweet (likes)
  notifId?: string;    // notification id (matches the REST record)
}

// Opens the real-time notifications channel and invokes `onNotification` for
// each pushed event (the initial "connected" greeting is filtered out).
// Returns a cleanup function that closes the socket. Reconnects automatically
// on unexpected close while a token is present.
export function connectNotifications(onNotification: (n: NotificationPush) => void): () => void {
  let socket: WebSocket | null = null;
  let closedByCaller = false;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;

  const open = () => {
    const token = getToken();
    if (!token) return;

    // Same-origin ws:// URL — Vite (dev) and CloudFront/ALB (prod) proxy /ws.
    const scheme = window.location.protocol === "https:" ? "wss" : "ws";
    socket = new WebSocket(`${scheme}://${window.location.host}/ws?token=${encodeURIComponent(token)}`);

    socket.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as NotificationPush;
        if (data.type && data.type !== "connected") onNotification(data);
      } catch { /* ignore malformed frames */ }
    };

    socket.onclose = () => {
      if (closedByCaller) return;
      retryTimer = setTimeout(open, 3000); // reconnect with a small backoff
    };
  };

  open();

  return () => {
    closedByCaller = true;
    if (retryTimer) clearTimeout(retryTimer);
    socket?.close();
  };
}
