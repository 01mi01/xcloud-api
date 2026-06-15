import * as repo from "../repositories/user.repository";
import { User } from "../models/user.model";
import { UpdateFields } from "../repositories/user.repository";
import { publishUserUpdated } from "../events/user.producer";
import { publishUserFollowed } from "../events/follow.producer";

export class UserNotFoundError extends Error {
    constructor(m: string) { super(m); this.name = "UserNotFoundError"; }
}
export class AlreadyFollowingError extends Error {
    constructor(m: string) { super(m); this.name = "AlreadyFollowingError"; }
}
export class NotFollowingError extends Error {
    constructor(m: string) { super(m); this.name = "NotFollowingError"; }
}

export const getByHandle = async (handle: string): Promise<User> => {
    const user = await repo.findByHandle(handle);
    if (!user) throw new UserNotFoundError(`User '${handle}' not found`);
    return user;
};

export const getById = async (userId: string): Promise<User> => {
    const user = await repo.findById(userId);
    if (!user) throw new UserNotFoundError(`User '${userId}' not found`);
    return user;
};

export const getFollowing = async (userId: string): Promise<User[]> => repo.getFollowing(userId);
export const getFollowers = async (userId: string): Promise<User[]> => repo.getFollowers(userId);

// Which of `userIds` the viewer (followerId) follows — powers follow buttons.
export const getFollowingStatus = async (followerId: string, userIds: string[]): Promise<string[]> =>
    repo.getFollowedSubset(followerId, userIds);

export const updateProfile = async (userId: string, handle: string, fields: UpdateFields): Promise<User> => {
    await repo.upsert(userId, handle);
    const user = await repo.update(userId, fields);
    if (!user) throw new UserNotFoundError("User not found");
    await publishUserUpdated(user);
    return user;
};

/**
 * Re-publish user.updated for every user so search-service (re)indexes them.
 * Backfills the user search index — events only flow forward, so users created
 * before search went live (or before a fresh index) aren't searchable otherwise.
 * Returns how many users were republished.
 */
export const reindexAll = async (): Promise<number> => {
    const users = await repo.findAll();
    for (const user of users) {
        await publishUserUpdated(user);
    }
    return users.length;
};

export const search = async (query: string): Promise<User[]> => {
    return repo.search(query);
};

export const isFollowing = async (followerId: string, followingId: string): Promise<boolean> => {
    return repo.followExists(followerId, followingId);
};

export const follow = async (followerId: string, followingId: string): Promise<void> => {
    const target = await repo.findById(followingId);
    if (!target) throw new UserNotFoundError("Target user not found");

    const already = await repo.followExists(followerId, followingId);
    if (already) throw new AlreadyFollowingError("Already following this user");

    await repo.insertFollow(followerId, followingId);
    // Notifica al usuario seguido (notification-service consume user.followed).
    await publishUserFollowed(followerId, followingId);
};

export const unfollow = async (followerId: string, followingId: string): Promise<void> => {
    const deleted = await repo.deleteFollow(followerId, followingId);
    if (!deleted) throw new NotFollowingError("Follow relationship not found");
};
