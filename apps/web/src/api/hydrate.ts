import type { RawTweet, Tweet, User } from "../types";
import { apiFetch, getToken } from "./client";
import { getInteractions } from "./tweets";

/**
 * Fetch a user by `userId`. The user-service does not expose this directly
 * (it serves GET /v1/users/:handle), so we provide a graceful fallback that
 * synthesizes a minimal `User` object when the lookup is not available.
 */
export async function getUserById(userId: string): Promise<User | null> {
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

  // Author profiles + the viewer's like/retweet state, fetched in parallel.
  const [fetched, interactions] = await Promise.all([
    Promise.all(uniqueAuthorIds.map((id) => getUserById(id))),
    raw.length && getToken()
      ? getInteractions(raw.map((t) => t.tweetId)).catch(() => ({ liked: [], retweeted: [] }))
      : Promise.resolve({ liked: [], retweeted: [] }),
  ]);

  const byId = new Map<string, User>();
  uniqueAuthorIds.forEach((id, i) => {
    byId.set(id, fetched[i] ?? fallbackUser(id));
  });

  void currentUserId; // viewer is now identified by the JWT sent with getInteractions
  const likedSet = new Set(interactions.liked);
  const retweetedSet = new Set(interactions.retweeted);

  return raw.map((t) => ({
    tweetId:        t.tweetId,
    content:        t.content,
    author:         byId.get(t.authorId) ?? fallbackUser(t.authorId),
    mediaUrls:      t.mediaUrls ?? [],
    likesCount:     t.likesCount ?? 0,
    retweetCount:   t.retweetCount ?? 0,
    repliesCount:   t.repliesCount ?? 0,
    createdAt:      t.createdAt,
    replyToTweetId: t.replyToTweetId ?? null,
    liked:          likedSet.has(t.tweetId),
    retweeted:      retweetedSet.has(t.tweetId),
  }));
}
