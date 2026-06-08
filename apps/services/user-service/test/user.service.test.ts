import * as svc from "../src/services/user.service";
import * as repo from "../src/repositories/user.repository";
import { User } from "../src/models/user.model";

jest.mock("../src/repositories/user.repository");

const mockRepo = repo as jest.Mocked<typeof repo>;

const mockUser: User = {
    userId:         "uuid-1",
    handle:         "testuser",
    displayName:    "Test User",
    bio:            null,
    avatarUrl:      null,
    followersCount: 0,
    followingCount: 0,
    createdAt:      new Date().toISOString(),
};

beforeEach(() => jest.clearAllMocks());

describe("getByHandle", () => {
    it("returns user when found", async () => {
        mockRepo.findByHandle.mockResolvedValue(mockUser);
        const result = await svc.getByHandle("testuser");
        expect(result).toEqual(mockUser);
    });

    it("throws UserNotFoundError when not found", async () => {
        mockRepo.findByHandle.mockResolvedValue(null);
        await expect(svc.getByHandle("ghost")).rejects.toMatchObject({ name: "UserNotFoundError" });
    });
});

describe("updateProfile", () => {
    it("upserts and updates the user", async () => {
        mockRepo.upsert.mockResolvedValue(mockUser);
        mockRepo.update.mockResolvedValue({ ...mockUser, displayName: "New Name" });
        const result = await svc.updateProfile("uuid-1", "testuser", { displayName: "New Name" });
        expect(result.displayName).toBe("New Name");
    });

    it("throws UserNotFoundError when update returns null", async () => {
        mockRepo.upsert.mockResolvedValue(mockUser);
        mockRepo.update.mockResolvedValue(null);
        await expect(svc.updateProfile("uuid-x", "ghost", { bio: "hi" })).rejects.toMatchObject({ name: "UserNotFoundError" });
    });
});

describe("follow", () => {
    it("inserts follow when target exists and not already following", async () => {
        mockRepo.findById.mockResolvedValue(mockUser);
        mockRepo.followExists.mockResolvedValue(false);
        mockRepo.insertFollow.mockResolvedValue();
        await expect(svc.follow("uuid-2", "uuid-1")).resolves.toBeUndefined();
        expect(mockRepo.insertFollow).toHaveBeenCalledWith("uuid-2", "uuid-1");
    });

    it("throws UserNotFoundError when target does not exist", async () => {
        mockRepo.findById.mockResolvedValue(null);
        await expect(svc.follow("uuid-2", "uuid-x")).rejects.toMatchObject({ name: "UserNotFoundError" });
    });

    it("throws AlreadyFollowingError when already following", async () => {
        mockRepo.findById.mockResolvedValue(mockUser);
        mockRepo.followExists.mockResolvedValue(true);
        await expect(svc.follow("uuid-2", "uuid-1")).rejects.toMatchObject({ name: "AlreadyFollowingError" });
    });
});

describe("unfollow", () => {
    it("deletes follow when relationship exists", async () => {
        mockRepo.deleteFollow.mockResolvedValue(true);
        await expect(svc.unfollow("uuid-2", "uuid-1")).resolves.toBeUndefined();
    });

    it("throws NotFollowingError when relationship does not exist", async () => {
        mockRepo.deleteFollow.mockResolvedValue(false);
        await expect(svc.unfollow("uuid-2", "uuid-x")).rejects.toMatchObject({ name: "NotFollowingError" });
    });
});
