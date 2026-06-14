import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import type { ReactNode } from "react";
import * as notificationsApi from "../api/notifications";
import { getUserById } from "../api/hydrate";
import { getTweet } from "../api/tweets";
import { getToken } from "../api/client";
import { useAuth } from "./AuthContext";
import type { User } from "../types";

interface NotificationsContextValue {
  notifications: notificationsApi.Notification[];
  unreadCount: number;
  /** Resolved actor profiles keyed by userId (so the UI can show @handle / name). */
  actorProfiles: Record<string, User>;
  /** Tweet content preview keyed by tweetId (so the UI shows the tweet, not a UUID). */
  tweetPreviews: Record<string, string>;
  markRead: (id: string) => void;
  markAllRead: () => void;
}

const NotificationsContext = createContext<NotificationsContextValue | undefined>(undefined);

// Same-origin WS URL through the Vite proxy (/api/v1/notifications/ws → :3004).
function wsUrl(token: string): string {
  const proto = window.location.protocol === "https:" ? "wss" : "ws";
  return `${proto}://${window.location.host}/api/v1/notifications/ws?token=${encodeURIComponent(token)}`;
}

/**
 * Holds the notification list + unread count, seeded from REST and kept live by
 * a WebSocket to notification-service. Mounted once (inside AuthProvider) so the
 * sidebar badge and the Notifications page share one source of truth.
 */
export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  const [notifications, setNotifications] = useState<notificationsApi.Notification[]>([]);
  const [actorProfiles, setActorProfiles] = useState<Record<string, User>>({});
  const [tweetPreviews, setTweetPreviews] = useState<Record<string, string>>({});
  const wsRef = useRef<WebSocket | null>(null);
  const knownActors = useRef<Set<string>>(new Set());
  const knownTweets = useRef<Set<string>>(new Set());

  // Resolve actorId → profile once per id (cached), so notifications can show
  // a real name/@handle instead of a raw userId.
  const resolveActors = useCallback(async (ids: Array<string | undefined>) => {
    const missing = ids.filter((id): id is string => !!id && !knownActors.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => knownActors.current.add(id));
    const fetched = await Promise.all(
      missing.map((id) => getUserById(id).then((u) => [id, u] as const).catch(() => [id, null] as const)),
    );
    setActorProfiles((prev) => {
      const next = { ...prev };
      for (const [id, u] of fetched) if (u) next[id] = u;
      return next;
    });
  }, []);

  // Resolve targetId (tweetId) → content snippet once per id (cached).
  const resolveTweets = useCallback(async (ids: Array<string | null | undefined>) => {
    const missing = ids.filter((id): id is string => !!id && !knownTweets.current.has(id));
    if (missing.length === 0) return;
    missing.forEach((id) => knownTweets.current.add(id));
    const fetched = await Promise.all(
      missing.map((id) => getTweet(id).then((r) => [id, r.tweet.content] as const).catch(() => [id, null] as const)),
    );
    setTweetPreviews((prev) => {
      const next = { ...prev };
      for (const [id, content] of fetched) if (content) next[id] = content;
      return next;
    });
  }, []);

  useEffect(() => {
    if (status !== "authed") {
      setNotifications([]);
      setActorProfiles({});
      setTweetPreviews({});
      knownActors.current.clear();
      knownTweets.current.clear();
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }

    let cancelled = false;

    // Seed from REST (the durable history).
    notificationsApi
      .listNotifications()
      .then((res) => {
        if (cancelled) return;
        setNotifications(res.notifications);
        resolveActors(res.notifications.map((n) => n.actorId));
        resolveTweets(res.notifications.map((n) => n.targetId));
      })
      .catch(() => { if (!cancelled) setNotifications([]); });

    // Live updates over WebSocket.
    const token = getToken();
    if (!token) return;
    const ws = new WebSocket(wsUrl(token));
    wsRef.current = ws;
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string);
        if (!msg || msg.type === "connected") return; // handshake ack
        const notif: notificationsApi.Notification = {
          id:        msg.notifId ?? crypto.randomUUID(),
          type:      msg.type,
          actorId:   msg.actor,
          targetId:  msg.tweetId ?? null,
          read:      false,
          createdAt: new Date().toISOString(),
        };
        setNotifications((prev) => [notif, ...prev]);
        resolveActors([notif.actorId]);
        resolveTweets([notif.targetId]);
      } catch {
        /* ignore malformed frames */
      }
    };
    ws.onclose = () => { if (wsRef.current === ws) wsRef.current = null; };

    return () => {
      cancelled = true;
      ws.close();
    };
  }, [status, resolveActors, resolveTweets]);

  const markRead = useCallback((id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    notificationsApi.markRead(id).catch(() => {});
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => {
      prev.filter((n) => !n.read).forEach((n) => notificationsApi.markRead(n.id).catch(() => {}));
      return prev.map((n) => ({ ...n, read: true }));
    });
  }, []);

  const unreadCount = notifications.filter((n) => !n.read).length;

  // Reflect unread count in the browser tab title, e.g. "(3) X · clone".
  const baseTitle = useRef<string>(typeof document !== "undefined" ? document.title : "");
  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) ${baseTitle.current}` : baseTitle.current;
  }, [unreadCount]);

  return (
    <NotificationsContext.Provider value={{ notifications, unreadCount, actorProfiles, tweetPreviews, markRead, markAllRead }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) throw new Error("useNotifications must be used inside <NotificationsProvider>");
  return ctx;
}
