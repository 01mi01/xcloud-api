import { apiFetch } from "./client";

export interface Notification {
  id: string;
  type: string;
  actorId: string;
  targetId: string | null;
  read: boolean;
  createdAt: string;
}

export function listNotifications(): Promise<{ notifications: Notification[] }> {
  return apiFetch<{ notifications: Notification[] }>("/v1/notifications");
}

export function markRead(id: string): Promise<void> {
  return apiFetch<void>(`/v1/notifications/${encodeURIComponent(id)}/read`, { method: "PUT" });
}
