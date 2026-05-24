import * as svc from "../src/services/notification.service";
import * as repo from "../src/repositories/notification.repository";
import * as wsPublisher from "../src/websocket/ws.publisher";

jest.mock("../src/repositories/notification.repository");
jest.mock("../src/websocket/ws.publisher");

const mockRepo = repo as jest.Mocked<typeof repo>;
const mockWs   = wsPublisher as jest.Mocked<typeof wsPublisher>;

const mockNotification: repo.Notification = {
    id: "notif-1", recipientUserId: "user-b", actorUserId: "user-a",
    type: "like", refTweetId: "tweet-1", read: false, createdAt: new Date().toISOString(),
};

beforeEach(() => jest.clearAllMocks());

describe("processLikeEvent", () => {
    it("creates notification and pushes to WebSocket", async () => {
        mockRepo.insert.mockResolvedValue(mockNotification);
        await svc.processLikeEvent({ tweetId: "tweet-1", userId: "user-a", timestamp: "" }, "user-b");
        expect(mockRepo.insert).toHaveBeenCalledWith("user-b", "user-a", "like", "tweet-1");
        expect(mockWs.pushToUser).toHaveBeenCalledWith("user-b", mockNotification);
    });

    it("skips notification when user likes their own tweet", async () => {
        await svc.processLikeEvent({ tweetId: "tweet-1", userId: "user-a", timestamp: "" }, "user-a");
        expect(mockRepo.insert).not.toHaveBeenCalled();
    });
});

describe("processFollowEvent", () => {
    it("creates follow notification", async () => {
        const followNotif = { ...mockNotification, type: "follow", refTweetId: null };
        mockRepo.insert.mockResolvedValue(followNotif);
        await svc.processFollowEvent({ followerId: "user-a", followingId: "user-b", timestamp: "" });
        expect(mockRepo.insert).toHaveBeenCalledWith("user-b", "user-a", "follow", null);
    });
});
