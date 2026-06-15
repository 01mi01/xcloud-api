import type { RawTweet, Tweet, User } from "../types";
import { apiFetch, getToken } from "./client";
import { getInteractions } from "./tweets";

const BOOKMARK_KEY = "xcloud_bookmarks";
function getBookmarkedIds(): Set<string> {
  try {
    const ids: string[] = JSON.parse(localStorage.getItem(BOOKMARK_KEY) ?? "[]");
    return new Set(ids);
  } catch { return new Set(); }
}

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

  const bookmarkedIds = getBookmarkedIds();

  // Resolve replyToAuthorHandle: for reply tweets, fetch the parent tweet's authorId
  // then look up their handle from the already-built user map (or fetch if not cached)
  const replyToHandles = await Promise.all(
    raw.map(async (t) => {
      if (!t.replyToTweetId) return null;
      try {
        const parent = await apiFetch<{ tweet: { authorId: string } }>(
          `/v1/tweets/${encodeURIComponent(t.replyToTweetId)}`
        );
        const parentAuthorId = parent.tweet.authorId;
        const user = byId.get(parentAuthorId) ?? await getUserById(parentAuthorId);
        return user?.handle ?? null;
      } catch { return null; }
    })
  );

  return raw.map((t, i) => ({
    tweetId:             t.tweetId,
    content:             t.content,
    author:              byId.get(t.authorId) ?? fallbackUser(t.authorId),
    mediaUrls:           t.mediaUrls ?? [],
    likesCount:          t.likesCount ?? 0,
    retweetCount:        t.retweetCount ?? 0,
    repliesCount:        t.repliesCount ?? 0,
    createdAt:           t.createdAt,
    replyToTweetId:      t.replyToTweetId ?? null,
    liked:               likedSet.has(t.tweetId),
    retweeted:           retweetedSet.has(t.tweetId),
    bookmarked:          bookmarkedIds.has(t.tweetId),
    replyToAuthorHandle: replyToHandles[i],
  }));
}
