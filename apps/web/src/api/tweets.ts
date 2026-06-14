import {
  CreateTweetCommand,
  GetTweetCommand,
  DeleteTweetCommand,
  LikeTweetCommand,
  UnlikeTweetCommand,
  RetweetTweetCommand,
  UnretweetTweetCommand,
} from "@xcloud/sdk-client";
import { twitterClient, toApiError, toRawTweet } from "./twitter-client";
import { apiFetch } from "./client";
import type { RawTweet } from "../types";

// Shape returned by tweet-service GET /v1/tweets/author/:authorId (not modeled in Smithy).
interface ServiceTweet {
  tweetId: string;
  content: string;
  authorId: string;
  mediaUrls?: string[];
  likesCount?: number;
  retweetCount?: number;
  createdAt: string;
  replyToTweetId?: string | null;
}

export interface CreateTweetInput {
  content: string;
  mediaUrls?: string[];
  replyToTweetId?: string;
}

export async function createTweet(input: CreateTweetInput): Promise<{ tweet: RawTweet }> {
  try {
    const out = await twitterClient.send(
      new CreateTweetCommand({
        content: input.content,
        mediaUrls: input.mediaUrls,
        replyToTweetId: input.replyToTweetId,
      }),
    );
    return { tweet: toRawTweet(out.tweet ?? {}) };
  } catch (err) {
    throw toApiError(err);
  }
}

export async function getTweet(tweetId: string): Promise<{ tweet: RawTweet }> {
  try {
    const out = await twitterClient.send(new GetTweetCommand({ tweetId }));
    return { tweet: toRawTweet(out.tweet ?? {}) };
  } catch (err) {
    throw toApiError(err);
  }
}

function mapServiceTweet(t: ServiceTweet): RawTweet {
  return {
    tweetId: t.tweetId,
    content: t.content,
    authorId: t.authorId,
    mediaUrls: t.mediaUrls ?? [],
    likesCount: t.likesCount ?? 0,
    retweetCount: t.retweetCount ?? 0,
    createdAt: t.createdAt,
    replyToTweetId: t.replyToTweetId ?? null,
  };
}

/** List a user's tweets (newest first) for their profile. Public, non-modeled route. */
export async function getTweetsByAuthor(authorId: string): Promise<RawTweet[]> {
  const res = await apiFetch<{ tweets: ServiceTweet[] }>(
    `/v1/tweets/author/${encodeURIComponent(authorId)}`,
    { auth: false },
  );
  return res.tweets.map(mapServiceTweet);
}

/** List the replies of a tweet (newest first). Public, non-modeled route. */
export async function getReplies(tweetId: string): Promise<RawTweet[]> {
  const res = await apiFetch<{ tweets: ServiceTweet[] }>(
    `/v1/tweets/${encodeURIComponent(tweetId)}/replies`,
    { auth: false },
  );
  return res.tweets.map(mapServiceTweet);
}

/** List the tweets a user has liked (for the profile Likes tab). Public, non-modeled. */
export async function getLikedTweets(userId: string): Promise<RawTweet[]> {
  const res = await apiFetch<{ tweets: ServiceTweet[] }>(
    `/v1/tweets/liked/${encodeURIComponent(userId)}`,
    { auth: false },
  );
  return res.tweets.map(mapServiceTweet);
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

export async function deleteTweet(tweetId: string): Promise<void> {
  try {
    await twitterClient.send(new DeleteTweetCommand({ tweetId }));
  } catch (err) {
    throw toApiError(err);
  }
}

export async function likeTweet(tweetId: string): Promise<void> {
  try {
    await twitterClient.send(new LikeTweetCommand({ tweetId }));
  } catch (err) {
    throw toApiError(err);
  }
}

export async function unlikeTweet(tweetId: string): Promise<void> {
  try {
    await twitterClient.send(new UnlikeTweetCommand({ tweetId }));
  } catch (err) {
    throw toApiError(err);
  }
}

export async function retweetTweet(tweetId: string): Promise<void> {
  try {
    await twitterClient.send(new RetweetTweetCommand({ tweetId }));
  } catch (err) {
    throw toApiError(err);
  }
}

export async function unretweetTweet(tweetId: string): Promise<void> {
  try {
    await twitterClient.send(new UnretweetTweetCommand({ tweetId }));
  } catch (err) {
    throw toApiError(err);
  }
}
