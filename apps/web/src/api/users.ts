import {
  GetUserCommand,
  UpdateUserCommand,
  FollowUserCommand,
  UnfollowUserCommand,
} from "@xcloud/sdk-client";
import { twitterClient, toApiError, toUser } from "./twitter-client";
import type { User } from "../types";

export async function getUser(handle: string): Promise<User> {
  try {
    return toUser(await twitterClient.send(new GetUserCommand({ handle })));
  } catch (err) {
    throw toApiError(err);
  }
}

export async function updateMe(input: { displayName?: string; bio?: string; avatarUrl?: string }): Promise<User> {
  try {
    return toUser(await twitterClient.send(new UpdateUserCommand(input)));
  } catch (err) {
    throw toApiError(err);
  }
}

export async function followUser(userId: string): Promise<void> {
  try {
    await twitterClient.send(new FollowUserCommand({ userId }));
  } catch (err) {
    throw toApiError(err);
  }
}

export async function unfollowUser(userId: string): Promise<void> {
  try {
    await twitterClient.send(new UnfollowUserCommand({ userId }));
  } catch (err) {
    throw toApiError(err);
  }
}
