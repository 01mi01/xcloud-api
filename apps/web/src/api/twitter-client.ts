// Configured singleton for the Smithy-generated @xcloud/sdk-client.
//
// The generated client targets the aggregate `com.twitter#TwitterService`, whose
// operation URIs (/v1/tweets, /v1/feed, /v1/users/{handle}, ...) line up with the
// Vite dev proxy keys. Pointing `endpoint` at `<origin>/api` makes the client
// issue e.g. `/api/v1/tweets`, which the proxy (apps/web/vite.config.ts) routes
// to the right microservice port.
//
// Auth: the model declares `@httpBearerAuth`, but the generated bearer scheme
// *requires* a token even for public reads (it throws when logged out). To match
// the legacy apiFetch behaviour (send the header only when a token exists), we
// force the no-auth scheme and inject `Authorization: Bearer <jwt>` via a build
// middleware when a token is present.
import { TwitterServiceClient } from "@xcloud/sdk-client";
import { ApiError, getToken } from "./client";
import type { RawTweet, User } from "../types";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "/api";

export const twitterClient = new TwitterServiceClient({
  // Absolute endpoint with the `/api` base path so the Vite proxy can route by service.
  endpoint: `${window.location.origin}${BASE_URL}`,
  // Bypass the bearer auth scheme; we attach the JWT ourselves (below).
  httpAuthSchemeProvider: () => [{ schemeId: "smithy.api#noAuth" }],
});

// Attach the JWT exactly like the legacy apiFetch: only when a token exists.
twitterClient.middlewareStack.add(
  (next) => async (args) => {
    const token = getToken();
    const req = (args as { request: unknown }).request as { headers?: Record<string, string> } | undefined;
    if (token && req?.headers) {
      req.headers["authorization"] = `Bearer ${token}`;
    }
    return next(args);
  },
  { step: "build", name: "xcloudBearerAuth", override: true },
);

/**
 * Translate a thrown Smithy service exception into the app's `ApiError`, so
 * existing call sites keep their `{ status, message, body }` error contract.
 */
export function toApiError(err: unknown): ApiError {
  const e = err as { $metadata?: { httpStatusCode?: number }; message?: string };
  if (err instanceof ApiError) return err;
  return new ApiError(e?.$metadata?.httpStatusCode ?? 0, e?.message ?? "Request failed", err);
}

/** Adapt a generated `Tweet` (all fields optional) to the app's `RawTweet`. */
export function toRawTweet(t: {
  tweetId?: string;
  content?: string;
  authorId?: string;
  mediaUrls?: string[];
  replyToTweetId?: string;
  likesCount?: number;
  retweetCount?: number;
  repliesCount?: number;
  createdAt?: string;
}): RawTweet {
  return {
    tweetId: t.tweetId ?? "",
    content: t.content ?? "",
    authorId: t.authorId ?? "",
    mediaUrls: t.mediaUrls ?? [],
    likesCount: t.likesCount ?? 0,
    retweetCount: t.retweetCount ?? 0,
    createdAt: t.createdAt ?? "",
    replyToTweetId: t.replyToTweetId ?? null,
    repliesCount: t.repliesCount,
  };
}

/** Adapt a generated user output (flattened fields) to the app's `User`. */
export function toUser(u: {
  userId?: string;
  handle?: string;
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
  followersCount?: number;
  followingCount?: number;
  createdAt?: string;
}): User {
  return {
    userId: u.userId ?? "",
    handle: u.handle ?? "",
    displayName: u.displayName ?? "",
    bio: u.bio ?? "",
    avatarUrl: u.avatarUrl ?? "",
    followersCount: u.followersCount ?? 0,
    followingCount: u.followingCount ?? 0,
    createdAt: u.createdAt ?? "",
  };
}
