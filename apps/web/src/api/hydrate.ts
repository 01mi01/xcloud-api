import type { RawTweet, Tweet, User } from "../types";
import { apiFetch } from "./client";
import { getLikeStatus } from "./tweets";

/**
 * Fetch a user by `userId`. The user-service does not expose this directly
 * (it serves GET /v1/users/:handle), so we provide a graceful fallback that
 * synthesizes a minimal `User` object when the lookup is not available.
 */
async function getUserById(userId: string): Promise<User | null> {
  try {
    return await apiFetch<User>(`/v1/users/by-id/${encodeURIComponent(userId)}`);
  } catch {
    return null;
  }
}

function fallbackUser(userId: string): User {
  return {
    userId,
    handle: userId.slice(0, 8),
    displayName: "Unknown user",
    bio: "",
    avatarUrl: "",
    followersCount: 0,
    followingCount: 0,
    createdAt: new Date(0).toISOString(),
  };
}

/**
 * Joins raw tweets with their author profiles. Authors are fetched in parallel
 * and deduplicated by userId. Missing profiles are replaced with a placeholder
 * so the UI keeps rendering rather than crashing.
 */
export async function hydrateTweets(raw: RawTweet[], currentUserId?: string): Promise<Tweet[]> {
  const uniqueAuthorIds = Array.from(new Set(raw.map((t) => t.authorId)));
  const fetched = await Promise.all(uniqueAuthorIds.map((id) => getUserById(id)));
  const byId = new Map<string, User>();
  uniqueAuthorIds.forEach((id, i) => {
    byId.set(id, fetched[i] ?? fallbackUser(id));
  });

  // Fetch like status for each tweet in parallel when user is logged in
  const likeStatuses = currentUserId
    ? await Promise.all(raw.map((t) => getLikeStatus(t.tweetId).then((r) => r.liked).catch(() => false)))
    : raw.map(() => false);

  return raw.map((t, i) => ({
    tweetId:        t.tweetId,
    content:        t.content,
    author:         byId.get(t.authorId) ?? fallbackUser(t.authorId),
    mediaUrls:      t.mediaUrls ?? [],
    likesCount:     t.likesCount ?? 0,
    retweetCount:   t.retweetCount ?? 0,
    repliesCount:   t.repliesCount ?? 0,
    createdAt:      t.createdAt,
    replyToTweetId: t.replyToTweetId ?? null,
    liked:          likeStatuses[i],
    retweeted:      false,
  }));
}
