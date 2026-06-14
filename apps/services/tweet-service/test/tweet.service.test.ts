import * as svc from "../src/services/tweet.service";
import * as repo from "../src/repositories/tweet.repository";
import * as producer from "../src/events/tweet.producer";
import { Tweet } from "../src/models/tweet.model";

jest.mock("../src/repositories/tweet.repository");
jest.mock("../src/events/tweet.producer");

const mockRepo     = repo     as jest.Mocked<typeof repo>;
const mockProducer = producer as jest.Mocked<typeof producer>;

const mockTweet: Tweet = {
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
        mockRepo.insert.mockResolvedValue(mockTweet);
        mockProducer.publishTweetCreated.mockResolvedValue();
        const result = await svc.createTweet("user-uuid-1", { content: "Hello world" });
        expect(result).toEqual(mockTweet);
        expect(mockProducer.publishTweetCreated).toHaveBeenCalledWith(mockTweet);
    });
});

describe("getTweet", () => {
    it("returns tweet when found", async () => {
        mockRepo.findById.mockResolvedValue(mockTweet);
        const result = await svc.getTweet("tweet-uuid-1");
        expect(result).toEqual(mockTweet);
    });

    it("throws TweetNotFoundError when not found", async () => {
        mockRepo.findById.mockResolvedValue(null);
        await expect(svc.getTweet("ghost")).rejects.toMatchObject({ name: "TweetNotFoundError" });
    });
});

describe("deleteTweet", () => {
    it("deletes tweet when requester is the author", async () => {
        mockRepo.findById.mockResolvedValue(mockTweet);
        mockRepo.remove.mockResolvedValue(true);
        await expect(svc.deleteTweet("tweet-uuid-1", "user-uuid-1")).resolves.toBeUndefined();
    });

    it("throws ForbiddenError when requester is not the author", async () => {
        mockRepo.findById.mockResolvedValue(mockTweet);
        await expect(svc.deleteTweet("tweet-uuid-1", "other-user")).rejects.toMatchObject({ name: "ForbiddenError" });
    });

    it("throws TweetNotFoundError when tweet does not exist", async () => {
        mockRepo.findById.mockResolvedValue(null);
        await expect(svc.deleteTweet("ghost", "user-uuid-1")).rejects.toMatchObject({ name: "TweetNotFoundError" });
    });
});

describe("likeTweet", () => {
    it("inserts like and publishes event", async () => {
        mockRepo.findById.mockResolvedValue(mockTweet);
        mockRepo.likeExists.mockResolvedValue(false);
        mockRepo.insertLike.mockResolvedValue();
        mockProducer.publishTweetLiked.mockResolvedValue();
        await expect(svc.likeTweet("user-uuid-2", "tweet-uuid-1")).resolves.toBeUndefined();
        expect(mockRepo.insertLike).toHaveBeenCalledWith("user-uuid-2", "tweet-uuid-1");
    });

    it("throws AlreadyLikedError when already liked", async () => {
        mockRepo.findById.mockResolvedValue(mockTweet);
        mockRepo.likeExists.mockResolvedValue(true);
        await expect(svc.likeTweet("user-uuid-2", "tweet-uuid-1")).rejects.toMatchObject({ name: "AlreadyLikedError" });
    });

    it("throws TweetNotFoundError when tweet does not exist", async () => {
        mockRepo.findById.mockResolvedValue(null);
        await expect(svc.likeTweet("user-uuid-2", "ghost")).rejects.toMatchObject({ name: "TweetNotFoundError" });
    });
});

describe("unlikeTweet", () => {
    it("deletes like when it exists", async () => {
        mockRepo.findById.mockResolvedValue(mockTweet);
        mockRepo.deleteLike.mockResolvedValue(true);
        await expect(svc.unlikeTweet("user-uuid-2", "tweet-uuid-1")).resolves.toBeUndefined();
    });

    it("throws NotLikedError when like does not exist", async () => {
        mockRepo.findById.mockResolvedValue(mockTweet);
        mockRepo.deleteLike.mockResolvedValue(false);
        await expect(svc.unlikeTweet("user-uuid-2", "tweet-uuid-1")).rejects.toMatchObject({ name: "NotLikedError" });
    });
});

describe("retweetTweet", () => {
    it("inserts retweet and publishes event", async () => {
        mockRepo.findById.mockResolvedValue(mockTweet);
        mockRepo.retweetExists.mockResolvedValue(false);
        mockRepo.insertRetweet.mockResolvedValue();
        mockProducer.publishTweetRetweeted.mockResolvedValue();
        await expect(svc.retweetTweet("user-uuid-2", "tweet-uuid-1")).resolves.toBeUndefined();
        expect(mockRepo.insertRetweet).toHaveBeenCalledWith("user-uuid-2", "tweet-uuid-1");
        expect(mockProducer.publishTweetRetweeted).toHaveBeenCalledWith({
            tweetId: "tweet-uuid-1", retweeterId: "user-uuid-2", authorId: "user-uuid-1",
        });
    });

    it("throws AlreadyRetweetedError when already retweeted", async () => {
        mockRepo.findById.mockResolvedValue(mockTweet);
        mockRepo.retweetExists.mockResolvedValue(true);
        await expect(svc.retweetTweet("user-uuid-2", "tweet-uuid-1")).rejects.toMatchObject({ name: "AlreadyRetweetedError" });
    });

    it("throws TweetNotFoundError when tweet does not exist", async () => {
        mockRepo.findById.mockResolvedValue(null);
        await expect(svc.retweetTweet("user-uuid-2", "ghost")).rejects.toMatchObject({ name: "TweetNotFoundError" });
    });
});

describe("unretweetTweet", () => {
    it("deletes retweet when it exists", async () => {
        mockRepo.findById.mockResolvedValue(mockTweet);
        mockRepo.deleteRetweet.mockResolvedValue(true);
        await expect(svc.unretweetTweet("user-uuid-2", "tweet-uuid-1")).resolves.toBeUndefined();
    });

    it("throws NotRetweetedError when retweet does not exist", async () => {
        mockRepo.findById.mockResolvedValue(mockTweet);
        mockRepo.deleteRetweet.mockResolvedValue(false);
        await expect(svc.unretweetTweet("user-uuid-2", "tweet-uuid-1")).rejects.toMatchObject({ name: "NotRetweetedError" });
    });
});
