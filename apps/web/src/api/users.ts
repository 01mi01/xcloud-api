import {
  GetUserCommand,
  UpdateUserCommand,
  FollowUserCommand,
  UnfollowUserCommand,
} from "@xcloud/sdk-client";
import { twitterClient, toApiError, toUser } from "./twitter-client";
import { apiFetch } from "./client";
import type { User } from "../types";

export async function getUser(handle: string): Promise<User> {
  try {
    return toUser(await twitterClient.send(new GetUserCommand({ handle })));
  } catch (err) {
    throw toApiError(err);
  }
}

type RawUser = Parameters<typeof toUser>[0];

/** Users that `userId` follows. Public, non-modeled route. */
export async function getFollowing(userId: string): Promise<User[]> {
  const res = await apiFetch<{ users: RawUser[] }>(
    `/v1/users/${encodeURIComponent(userId)}/following`,
    { auth: false },
  );
  return res.users.map(toUser);
}

/** Users that follow `userId`. Public, non-modeled route. */
export async function getFollowers(userId: string): Promise<User[]> {
  const res = await apiFetch<{ users: RawUser[] }>(
    `/v1/users/${encodeURIComponent(userId)}/followers`,
    { auth: false },
  );
  return res.users.map(toUser);
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

export async function updateMe(input: { displayName?: string; bio?: string; avatarUrl?: string }): Promise<User> {
  try {
    return toUser(await twitterClient.send(new UpdateUserCommand(input)));
  } catch (err) {
    throw toApiError(err);
  }
}

export async function followUser(userId: string): Promise<void> {
  try {
    await twitterClient.send(new FollowUserCommand({ userId }));
  } catch (err) {
    throw toApiError(err);
  }
}

export async function unfollowUser(userId: string): Promise<void> {
  try {
    await twitterClient.send(new UnfollowUserCommand({ userId }));
  } catch (err) {
    throw toApiError(err);
  }
}
