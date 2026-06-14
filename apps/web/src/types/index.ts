// Core data types used across the app

export interface User {
  userId: string;
  handle: string;
  displayName: string;
  bio: string;
  avatarUrl: string;
  followersCount: number;
  followingCount: number;
  createdAt: string;
}

/**
 * Raw tweet as returned by the tweet-service and the feed-service.
 * Has only `authorId`; the author profile must be fetched separately
 * (via user-service) if a UI needs displayName/handle/avatar.
 */
export interface RawTweet {
  tweetId: string;
  content: string;
  authorId: string;
  mediaUrls: string[];
  likesCount: number;
  retweetCount: number;
  createdAt: string;
  replyToTweetId: string | null;
  repliesCount?: number;
  replyToAuthorHandle?: string | null;
}

/**
 * Tweet enriched with author profile + per-viewer flags. Built on the client
 * by joining a `RawTweet` with the author `User` from user-service.
 */
export interface Tweet {
  tweetId: string;
  content: string;
  author: User;
  mediaUrls: string[];
  likesCount: number;
  retweetCount: number;
  repliesCount: number;
  createdAt: string;
  replyToTweetId: string | null;
  liked: boolean;
  retweeted: boolean;
  bookmarked: boolean;
  replyToAuthorHandle: string | null;
}

/**
 * Identity claims of the currently authenticated user, as returned by
 * GET /v1/auth/me (extended with the handle decoded from the JWT).
 */
export interface AuthIdentity {
  userId: string;
  email: string;
  handle: string | null;
  role: string;
}

// Notification as displayed in the UI — enriched with actor name and tweet excerpt
export interface Notification {
  id: string;
  type: "like" | "retweet" | "follow" | "mention";
  actorName: string;
  actorHandle: string;
  excerpt?: string;
  read: boolean;
  createdAt: string;
}