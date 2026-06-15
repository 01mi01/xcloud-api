import { apiFetch } from "./client";
import type { RawTweet } from "../types";

export interface CreateTweetInput {
  content: string;
  mediaUrls?: string[];
  replyToTweetId?: string;
}

export function createTweet(input: CreateTweetInput): Promise<{ tweet: RawTweet }> {
  return apiFetch<{ tweet: RawTweet }>("/v1/tweets", { method: "POST", body: input });
}

export function getTweet(tweetId: string): Promise<{ tweet: RawTweet }> {
  return apiFetch<{ tweet: RawTweet }>(`/v1/tweets/${encodeURIComponent(tweetId)}`);
}

export function deleteTweet(tweetId: string): Promise<void> {
  return apiFetch<void>(`/v1/tweets/${encodeURIComponent(tweetId)}`, { method: "DELETE" });
}

export function likeTweet(tweetId: string): Promise<void> {
  return apiFetch<void>(`/v1/tweets/${encodeURIComponent(tweetId)}/like`, { method: "POST" });
}

export function unlikeTweet(tweetId: string): Promise<void> {
  return apiFetch<void>(`/v1/tweets/${encodeURIComponent(tweetId)}/like`, { method: "DELETE" });
}

export function getReplies(tweetId: string): Promise<{ replies: RawTweet[] }> {
  return apiFetch(`/v1/tweets/${encodeURIComponent(tweetId)}/replies`);
}

export function getLikeStatus(tweetId: string): Promise<{ liked: boolean }> {
  return apiFetch<{ liked: boolean }>(`/v1/tweets/${encodeURIComponent(tweetId)}/like`);
}

export function getTweetsByAuthor(authorId: string): Promise<{ tweets: RawTweet[] }> {
  return apiFetch(`/v1/tweets/by-author/${encodeURIComponent(authorId)}`);
}

export function getLikedByUser(userId: string): Promise<{ tweets: RawTweet[] }> {
  return apiFetch(`/v1/tweets/liked-by/${encodeURIComponent(userId)}`);
}

export function getRetweetStatus(tweetId: string): Promise<{ retweeted: boolean }> {
  return apiFetch<{ retweeted: boolean }>(`/v1/tweets/${encodeURIComponent(tweetId)}/retweet`);
}

export function retweetTweet(tweetId: string): Promise<void> {
  return apiFetch<void>(`/v1/tweets/${encodeURIComponent(tweetId)}/retweet`, { method: "POST" });
}

export function unretweetTweet(tweetId: string): Promise<void> {
  return apiFetch<void>(`/v1/tweets/${encodeURIComponent(tweetId)}/retweet`, { method: "DELETE" });
}

/** Per-viewer like/retweet state for a batch of tweets (authed, non-modeled). */
export async function getInteractions(
  tweetIds: string[],
): Promise<{ liked: string[]; retweeted: string[] }> {
  if (tweetIds.length === 0) return { liked: [], retweeted: [] };
  return apiFetch<{ liked: string[]; retweeted: string[] }>("/v1/tweets/interactions", {
    method: "POST",
    body: { tweetIds },
  });
}
