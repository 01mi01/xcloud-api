import * as svc from "../src/services/search.service";
import * as esRepo from "../src/repositories/opensearch.repository";

jest.mock("../src/repositories/opensearch.repository");

const mockEsRepo = esRepo as jest.Mocked<typeof esRepo>;

const mockTweetDoc: esRepo.TweetDocument = {
    tweetId:   "tweet-1",
    authorId:  "author-1",
    content:   "Hello world #testing",
    createdAt: new Date().toISOString(),
};

beforeEach(() => jest.clearAllMocks());

describe("indexTweet", () => {
    it("indexes a tweet document in OpenSearch", async () => {
        mockEsRepo.indexTweet.mockResolvedValue();
        await svc.indexTweet({ tweetId: "tweet-1", authorId: "author-1", content: "Hello world #testing", createdAt: mockTweetDoc.createdAt });
        expect(mockEsRepo.indexTweet).toHaveBeenCalledWith(expect.objectContaining({ tweetId: "tweet-1", content: "Hello world #testing" }));
    });
});

describe("searchTweets", () => {
    it("returns search results from OpenSearch", async () => {
        mockEsRepo.searchTweets.mockResolvedValue({ results: [mockTweetDoc], total: 1 });
        const result = await svc.searchTweets("hello", 20, 0);
        expect(result.results).toHaveLength(1);
        expect(result.results[0].tweetId).toBe("tweet-1");
    });

    it("returns empty results for no matches", async () => {
        mockEsRepo.searchTweets.mockResolvedValue({ results: [], total: 0 });
        const result = await svc.searchTweets("nonexistent", 20, 0);
        expect(result.results).toHaveLength(0);
    });
});
