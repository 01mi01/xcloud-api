import { apiFetch } from "./client";
import type { RawTweet } from "../types";

export interface FeedResponse {
  tweets: RawTweet[];
  nextCursor: string | null;
}

export function getFeed(opts: { cursor?: string; limit?: number } = {}): Promise<FeedResponse> {
  return apiFetch<FeedResponse>("/v1/feed", {
    query: { cursor: opts.cursor, limit: opts.limit },
  });
}
