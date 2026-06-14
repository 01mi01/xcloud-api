import { GetFeedCommand } from "@xcloud/sdk-client";
import { twitterClient, toApiError, toRawTweet } from "./twitter-client";
import type { RawTweet } from "../types";

export interface FeedResponse {
  tweets: RawTweet[];
  nextCursor: string | null;
}

export async function getFeed(opts: { cursor?: string; limit?: number } = {}): Promise<FeedResponse> {
  try {
    const out = await twitterClient.send(
      new GetFeedCommand({ cursor: opts.cursor, limit: opts.limit }),
    );
    return {
      tweets: (out.tweets ?? []).map(toRawTweet),
      nextCursor: out.nextCursor ?? null,
    };
  } catch (err) {
    throw toApiError(err);
  }
}
