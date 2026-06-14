import { apiFetch } from "./client";
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
 * Full-text tweet search. The search index stores text + ids only (not live
 * like/retweet counts), so those default to 0 here; the author profile is
 * joined client-side via hydrateTweets.
 */
export async function searchTweets(q: string): Promise<RawTweet[]> {
  const res = await apiFetch<SearchResponse<TweetSearchHit>>("/v1/search", {
    auth: false,
    query: { q, type: "tweets" },
  });
  return res.results.map((r) => ({
    tweetId: r.tweetId,
    content: r.content,
    authorId: r.authorId,
    mediaUrls: [],
    likesCount: 0,
    retweetCount: 0,
    createdAt: r.createdAt,
    replyToTweetId: null,
  }));
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
