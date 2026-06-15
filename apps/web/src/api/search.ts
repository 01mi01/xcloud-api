import { apiFetch } from "./client";
import { getTweet } from "./tweets";
import type { RawTweet, User } from "../types";

// search-service is NOT in the Smithy model, so (like auth/notifications) it is
// called through the hand-written apiFetch client and the Vite `search` proxy.

interface TweetSearchHit {
  tweetId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

interface UserSearchHit {
  userId: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  followersCount: number;
  followingCount: number;
  createdAt: string;
}

interface SearchResponse<T> {
  results: T[];
  nextCursor: string | null;
}

/**
 * Full-text tweet search. The search index stores text + ids only, so each hit
 * is hydrated via tweet-service GET /v1/tweets/:id to get live counts + media.
 * Tweets deleted since indexing 404 and are dropped from the results.
 */
export async function searchTweets(q: string): Promise<RawTweet[]> {
  const res = await apiFetch<SearchResponse<TweetSearchHit>>("/v1/search", {
    auth: false,
    query: { q, type: "tweets" },
  });
  const full = await Promise.all(
    res.results.map((r) => getTweet(r.tweetId).then((x) => x.tweet).catch(() => null)),
  );
  return full.filter((t): t is RawTweet => t !== null);
}

/** User search by handle / display name / bio. */
export async function searchUsers(q: string): Promise<User[]> {
  const res = await apiFetch<SearchResponse<UserSearchHit>>("/v1/search", {
    auth: false,
    query: { q, type: "users" },
  });
  return res.results.map((u) => ({
    userId: u.userId,
    handle: u.handle,
    displayName: u.displayName,
    bio: u.bio ?? "",
    avatarUrl: u.avatarUrl ?? "",
    followersCount: u.followersCount ?? 0,
    followingCount: u.followingCount ?? 0,
    createdAt: u.createdAt,
  }));
}
