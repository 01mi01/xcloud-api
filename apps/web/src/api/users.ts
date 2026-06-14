import { apiFetch } from "./client";
import type { User } from "../types";

export function getUser(handle: string): Promise<User> {
  return apiFetch<User>(`/v1/users/${encodeURIComponent(handle)}`, { auth: false });
}

export function getUserById(userId: string): Promise<User> {
  return apiFetch<User>(`/v1/users/by-id/${encodeURIComponent(userId)}`);
}

export function updateMe(input: { displayName?: string; bio?: string; avatarUrl?: string }): Promise<User> {
  return apiFetch<User>("/v1/users/me", { method: "PUT", body: input });
}

export function followUser(userId: string): Promise<void> {
  return apiFetch<void>(`/v1/users/${encodeURIComponent(userId)}/follow`, { method: "POST" });
}

export function unfollowUser(userId: string): Promise<void> {
  return apiFetch<void>(`/v1/users/${encodeURIComponent(userId)}/follow`, { method: "DELETE" });
}
