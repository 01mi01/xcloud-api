import { apiFetch } from "./client";
import type { User } from "../types";

export function getUser(handle: string): Promise<User> {
  return apiFetch<User>(`/v1/users/${encodeURIComponent(handle)}`, { auth: false });
}

export function getUserById(userId: string): Promise<User> {
  return apiFetch<User>(`/v1/users/by-id/${encodeURIComponent(userId)}`);
}

/** Users that `userId` follows. Public, non-modeled route. */
export async function getFollowing(userId: string): Promise<User[]> {
  const res = await apiFetch<{ users: User[] }>(
    `/v1/users/${encodeURIComponent(userId)}/following`,
    { auth: false },
  );
  return res.users;
}

/** Users that follow `userId`. Public, non-modeled route. */
export async function getFollowers(userId: string): Promise<User[]> {
  const res = await apiFetch<{ users: User[] }>(
    `/v1/users/${encodeURIComponent(userId)}/followers`,
    { auth: false },
  );
  return res.users;
}

/** Of `userIds`, which the current viewer follows (for follow buttons). Authed, non-modeled. */
export async function getFollowingStatus(userIds: string[]): Promise<string[]> {
  if (userIds.length === 0) return [];
  const res = await apiFetch<{ following: string[] }>("/v1/users/following-status", {
    method: "POST",
    body: { userIds },
  });
  return res.following;
}

export function updateMe(input: { displayName?: string; bio?: string; avatarUrl?: string; bannerUrl?: string }): Promise<User> {
  return apiFetch<User>("/v1/users/me", { method: "PUT", body: input });
}

export function followUser(userId: string): Promise<void> {
  return apiFetch<void>(`/v1/users/${encodeURIComponent(userId)}/follow`, { method: "POST" });
}

export function unfollowUser(userId: string): Promise<void> {
  return apiFetch<void>(`/v1/users/${encodeURIComponent(userId)}/follow`, { method: "DELETE" });
}
