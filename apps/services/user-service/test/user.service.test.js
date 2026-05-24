const svc = require("../src/services/user.service");
const repo = require("../src/repositories/user.repository");

jest.mock("../src/repositories/user.repository");

const mockUser = {
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
        repo.findByHandle.mockResolvedValue(mockUser);
        const result = await svc.getByHandle("testuser");
        expect(result).toEqual(mockUser);
    });

    it("throws UserNotFoundError when not found", async () => {
        repo.findByHandle.mockResolvedValue(null);
        await expect(svc.getByHandle("ghost")).rejects.toMatchObject({ name: "UserNotFoundError" });
    });
});

describe("updateProfile", () => {
    it("upserts and updates the user", async () => {
        repo.upsert.mockResolvedValue(mockUser);
        repo.update.mockResolvedValue({ ...mockUser, displayName: "New Name" });
        const result = await svc.updateProfile("uuid-1", "testuser", { displayName: "New Name" });
        expect(result.displayName).toBe("New Name");
    });

    it("throws UserNotFoundError when update returns null", async () => {
        repo.upsert.mockResolvedValue(mockUser);
        repo.update.mockResolvedValue(null);
        await expect(svc.updateProfile("uuid-x", "ghost", { bio: "hi" })).rejects.toMatchObject({ name: "UserNotFoundError" });
    });
});

describe("follow", () => {
    it("inserts follow when target exists and not already following", async () => {
        repo.findById.mockResolvedValue(mockUser);
        repo.followExists.mockResolvedValue(false);
        repo.insertFollow.mockResolvedValue();
        await expect(svc.follow("uuid-2", "uuid-1")).resolves.toBeUndefined();
        expect(repo.insertFollow).toHaveBeenCalledWith("uuid-2", "uuid-1");
    });

    it("throws UserNotFoundError when target does not exist", async () => {
        repo.findById.mockResolvedValue(null);
        await expect(svc.follow("uuid-2", "uuid-x")).rejects.toMatchObject({ name: "UserNotFoundError" });
    });

    it("throws AlreadyFollowingError when already following", async () => {
        repo.findById.mockResolvedValue(mockUser);
        repo.followExists.mockResolvedValue(true);
        await expect(svc.follow("uuid-2", "uuid-1")).rejects.toMatchObject({ name: "AlreadyFollowingError" });
    });
});

describe("unfollow", () => {
    it("deletes follow when relationship exists", async () => {
        repo.deleteFollow.mockResolvedValue(true);
        await expect(svc.unfollow("uuid-2", "uuid-1")).resolves.toBeUndefined();
    });

    it("throws NotFollowingError when relationship does not exist", async () => {
        repo.deleteFollow.mockResolvedValue(false);
        await expect(svc.unfollow("uuid-2", "uuid-x")).rejects.toMatchObject({ name: "NotFollowingError" });
    });
});
