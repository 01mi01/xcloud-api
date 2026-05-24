const svc = require("../src/services/tweet.service");
const repo = require("../src/repositories/tweet.repository");
const producer = require("../src/events/tweet.producer");

jest.mock("../src/repositories/tweet.repository");
jest.mock("../src/events/tweet.producer");

const mockTweet = {
    tweetId:        "tweet-uuid-1",
    content:        "Hello world",
    authorId:       "user-uuid-1",
    mediaUrls:      [],
    replyToTweetId: null,
    likesCount:     0,
    retweetCount:   0,
    createdAt:      new Date().toISOString(),
};

beforeEach(() => jest.clearAllMocks());

describe("createTweet", () => {
    it("inserts tweet and publishes event", async () => {
        repo.insert.mockResolvedValue(mockTweet);
        producer.publishTweetCreated.mockResolvedValue();
        const result = await svc.createTweet("user-uuid-1", { content: "Hello world" });
        expect(result).toEqual(mockTweet);
        expect(producer.publishTweetCreated).toHaveBeenCalledWith(mockTweet);
    });
});

describe("getTweet", () => {
    it("returns tweet when found", async () => {
        repo.findById.mockResolvedValue(mockTweet);
        const result = await svc.getTweet("tweet-uuid-1");
        expect(result).toEqual(mockTweet);
    });

    it("throws TweetNotFoundError when not found", async () => {
        repo.findById.mockResolvedValue(null);
        await expect(svc.getTweet("ghost")).rejects.toMatchObject({ name: "TweetNotFoundError" });
    });
});

describe("deleteTweet", () => {
    it("deletes tweet when requester is the author", async () => {
        repo.findById.mockResolvedValue(mockTweet);
        repo.remove.mockResolvedValue(true);
        await expect(svc.deleteTweet("tweet-uuid-1", "user-uuid-1")).resolves.toBeUndefined();
    });

    it("throws ForbiddenError when requester is not the author", async () => {
        repo.findById.mockResolvedValue(mockTweet);
        await expect(svc.deleteTweet("tweet-uuid-1", "other-user")).rejects.toMatchObject({ name: "ForbiddenError" });
    });

    it("throws TweetNotFoundError when tweet does not exist", async () => {
        repo.findById.mockResolvedValue(null);
        await expect(svc.deleteTweet("ghost", "user-uuid-1")).rejects.toMatchObject({ name: "TweetNotFoundError" });
    });
});

describe("likeTweet", () => {
    it("inserts like and publishes event", async () => {
        repo.findById.mockResolvedValue(mockTweet);
        repo.likeExists.mockResolvedValue(false);
        repo.insertLike.mockResolvedValue();
        producer.publishTweetLiked.mockResolvedValue();
        await expect(svc.likeTweet("user-uuid-2", "tweet-uuid-1")).resolves.toBeUndefined();
        expect(repo.insertLike).toHaveBeenCalledWith("user-uuid-2", "tweet-uuid-1");
    });

    it("throws AlreadyLikedError when already liked", async () => {
        repo.findById.mockResolvedValue(mockTweet);
        repo.likeExists.mockResolvedValue(true);
        await expect(svc.likeTweet("user-uuid-2", "tweet-uuid-1")).rejects.toMatchObject({ name: "AlreadyLikedError" });
    });

    it("throws TweetNotFoundError when tweet does not exist", async () => {
        repo.findById.mockResolvedValue(null);
        await expect(svc.likeTweet("user-uuid-2", "ghost")).rejects.toMatchObject({ name: "TweetNotFoundError" });
    });
});

describe("unlikeTweet", () => {
    it("deletes like when it exists", async () => {
        repo.findById.mockResolvedValue(mockTweet);
        repo.deleteLike.mockResolvedValue(true);
        await expect(svc.unlikeTweet("user-uuid-2", "tweet-uuid-1")).resolves.toBeUndefined();
    });

    it("throws NotLikedError when like does not exist", async () => {
        repo.findById.mockResolvedValue(mockTweet);
        repo.deleteLike.mockResolvedValue(false);
        await expect(svc.unlikeTweet("user-uuid-2", "tweet-uuid-1")).rejects.toMatchObject({ name: "NotLikedError" });
    });
});
