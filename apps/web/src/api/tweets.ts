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
import type { RawTweet } from "../types";

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
