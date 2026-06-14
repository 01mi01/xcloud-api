import { apiFetch } from "./client";

export interface Notification {
  id: string;
  type: string;
  actorId: string;
  targetId: string | null;
  read: boolean;
  createdAt: string;
}

// Wire shape from notification-service (snake-ish camelCase from the DB row).
interface RawNotification {
  id: string;
  actorUserId: string;
  type: string;
  refTweetId: string | null;
  read: boolean;
  createdAt: string;
}

export async function listNotifications(): Promise<{ notifications: Notification[] }> {
  const res = await apiFetch<{ notifications: RawNotification[] }>("/v1/notifications");
  return {
    notifications: res.notifications.map((n) => ({
      id: n.id,
      type: n.type,
      actorId: n.actorUserId,
      targetId: n.refTweetId,
      read: n.read,
      createdAt: n.createdAt,
    })),
  };
}

export function markRead(id: string): Promise<void> {
  return apiFetch<void>(`/v1/notifications/${encodeURIComponent(id)}/read`, { method: "PUT" });
}
