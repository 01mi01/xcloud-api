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
