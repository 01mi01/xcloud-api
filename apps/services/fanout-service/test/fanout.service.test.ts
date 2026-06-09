import * as svc from "../src/services/fanout.service";
import * as followerRepo from "../src/repositories/follower.repository";
import * as feedCacheRepo from "../src/repositories/feed.cache.repository";

jest.mock("../src/repositories/follower.repository");
jest.mock("../src/repositories/feed.cache.repository");

const mockFollowerRepo  = followerRepo  as jest.Mocked<typeof followerRepo>;
const mockFeedCacheRepo = feedCacheRepo as jest.Mocked<typeof feedCacheRepo>;

const mockEvent: svc.TweetCreatedEvent = {
    tweetId:   "tweet-uuid-1",
    authorId:  "author-uuid-1",
    content:   "Hello world",
    createdAt: new Date().toISOString(),
};

beforeEach(() => jest.clearAllMocks());

describe("processTweetCreated", () => {
    it("writes tweetId to feed cache of each follower", async () => {
        mockFollowerRepo.getFollowerIds.mockResolvedValue(["user-1", "user-2", "user-3"]);
        mockFeedCacheRepo.prependToFeed.mockResolvedValue();

        await svc.processTweetCreated(mockEvent);

        expect(mockFollowerRepo.getFollowerIds).toHaveBeenCalledWith("author-uuid-1");
        expect(mockFeedCacheRepo.prependToFeed).toHaveBeenCalledTimes(3);
        expect(mockFeedCacheRepo.prependToFeed).toHaveBeenCalledWith("user-1", "tweet-uuid-1");
        expect(mockFeedCacheRepo.prependToFeed).toHaveBeenCalledWith("user-2", "tweet-uuid-1");
        expect(mockFeedCacheRepo.prependToFeed).toHaveBeenCalledWith("user-3", "tweet-uuid-1");
    });

    it("skips fan-out when author has no followers", async () => {
        mockFollowerRepo.getFollowerIds.mockResolvedValue([]);

        await svc.processTweetCreated(mockEvent);

        expect(mockFollowerRepo.getFollowerIds).toHaveBeenCalledWith("author-uuid-1");
        expect(mockFeedCacheRepo.prependToFeed).not.toHaveBeenCalled();
    });

    it("handles fan-out to a single follower", async () => {
        mockFollowerRepo.getFollowerIds.mockResolvedValue(["user-solo"]);
        mockFeedCacheRepo.prependToFeed.mockResolvedValue();

        await svc.processTweetCreated(mockEvent);

        expect(mockFeedCacheRepo.prependToFeed).toHaveBeenCalledTimes(1);
        expect(mockFeedCacheRepo.prependToFeed).toHaveBeenCalledWith("user-solo", "tweet-uuid-1");
    });
});
