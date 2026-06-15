import * as svc from "../src/services/feed.service";
import * as cacheRepo from "../src/repositories/feed.cache.repository";
import * as dbRepo from "../src/repositories/feed.db.repository";
import * as tweetClient from "../src/grpc/tweet.client";
import { HydratedTweet } from "../src/grpc/tweet.client";

jest.mock("../src/repositories/feed.cache.repository");
jest.mock("../src/repositories/feed.db.repository");
jest.mock("../src/grpc/tweet.client");

const mockCacheRepo   = cacheRepo   as jest.Mocked<typeof cacheRepo>;
const mockDbRepo      = dbRepo      as jest.Mocked<typeof dbRepo>;
const mockTweetClient = tweetClient as jest.Mocked<typeof tweetClient>;

const mockTweet: HydratedTweet = {
    tweetId:        "tweet-uuid-1",
    content:        "Hello world",
    authorId:       "author-uuid-1",
    mediaUrls:      [],
    replyToTweetId: null,
    likesCount:     5,
    retweetCount:   1,
    repliesCount:   0,
    createdAt:      new Date().toISOString(),
};

beforeEach(() => jest.clearAllMocks());

describe("getFeed", () => {
    it("returns feed from cache when cache exists (cache HIT)", async () => {
        mockCacheRepo.feedExists.mockResolvedValue(true);
        mockCacheRepo.getFeedTweetIds.mockResolvedValue(["tweet-uuid-1"]);
        mockTweetClient.getTweetsByIds.mockResolvedValue([mockTweet]);

        const result = await svc.getFeed("user-uuid-1");

        expect(mockCacheRepo.feedExists).toHaveBeenCalledWith("user-uuid-1");
        expect(mockCacheRepo.getFeedTweetIds).toHaveBeenCalledWith("user-uuid-1", 0, 20);
        expect(mockTweetClient.getTweetsByIds).toHaveBeenCalledWith(["tweet-uuid-1"]);
        expect(result.tweets).toEqual([mockTweet]);
    });

    it("rebuilds feed from DB on cache MISS and caches result", async () => {
        mockCacheRepo.feedExists.mockResolvedValue(false);
        mockDbRepo.getFollowingIds.mockResolvedValue(["author-uuid-1"]);
        mockDbRepo.rebuildFeedFromDb.mockResolvedValue(["tweet-uuid-1"]);
        mockCacheRepo.setFeedTweetIds.mockResolvedValue();
        mockTweetClient.getTweetsByIds.mockResolvedValue([mockTweet]);

        const result = await svc.getFeed("user-uuid-1");

        expect(mockDbRepo.getFollowingIds).toHaveBeenCalledWith("user-uuid-1");
        // El rebuild incluye al propio usuario (ve sus propios tweets) además de sus followings.
        expect(mockDbRepo.rebuildFeedFromDb).toHaveBeenCalledWith(["user-uuid-1", "author-uuid-1"], 800);
        expect(mockCacheRepo.setFeedTweetIds).toHaveBeenCalledWith("user-uuid-1", ["tweet-uuid-1"]);
        expect(result.tweets).toEqual([mockTweet]);
    });

    it("returns empty feed when user follows nobody", async () => {
        mockCacheRepo.feedExists.mockResolvedValue(false);
        mockDbRepo.getFollowingIds.mockResolvedValue([]);
        mockDbRepo.rebuildFeedFromDb.mockResolvedValue([]);
        mockCacheRepo.setFeedTweetIds.mockResolvedValue();

        const result = await svc.getFeed("user-uuid-lonely");

        expect(result.tweets).toEqual([]);
        expect(result.nextCursor).toBeNull();
    });

    it("returns nextCursor when more tweets are available", async () => {
        const tweetIds = Array.from({ length: 20 }, (_, i) => `tweet-${i}`);
        const tweets   = tweetIds.map((id) => ({ ...mockTweet, tweetId: id }));

        mockCacheRepo.feedExists.mockResolvedValue(true);
        mockCacheRepo.getFeedTweetIds.mockResolvedValue(tweetIds);
        mockTweetClient.getTweetsByIds.mockResolvedValue(tweets);

        const result = await svc.getFeed("user-uuid-1", "0", 20);

        expect(result.nextCursor).toBe("20");
    });

    it("returns null nextCursor when fewer tweets than limit", async () => {
        mockCacheRepo.feedExists.mockResolvedValue(true);
        mockCacheRepo.getFeedTweetIds.mockResolvedValue(["tweet-uuid-1"]);
        mockTweetClient.getTweetsByIds.mockResolvedValue([mockTweet]);

        const result = await svc.getFeed("user-uuid-1", "0", 20);

        expect(result.nextCursor).toBeNull();
    });

    it("respects cursor pagination", async () => {
        mockCacheRepo.feedExists.mockResolvedValue(true);
        mockCacheRepo.getFeedTweetIds.mockResolvedValue(["tweet-uuid-5"]);
        mockTweetClient.getTweetsByIds.mockResolvedValue([{ ...mockTweet, tweetId: "tweet-uuid-5" }]);

        const result = await svc.getFeed("user-uuid-1", "40", 20);

        expect(mockCacheRepo.getFeedTweetIds).toHaveBeenCalledWith("user-uuid-1", 40, 20);
        expect(result.tweets[0].tweetId).toBe("tweet-uuid-5");
    });

    it("clamps limit to MAX_LIMIT (100)", async () => {
        mockCacheRepo.feedExists.mockResolvedValue(true);
        mockCacheRepo.getFeedTweetIds.mockResolvedValue([]);
        mockTweetClient.getTweetsByIds.mockResolvedValue([]);

        await svc.getFeed("user-uuid-1", "0", 999);

        expect(mockCacheRepo.getFeedTweetIds).toHaveBeenCalledWith("user-uuid-1", 0, 100);
    });
});
