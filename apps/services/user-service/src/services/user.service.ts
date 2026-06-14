import * as repo from "../repositories/user.repository";
import { User } from "../models/user.model";
import { UpdateFields } from "../repositories/user.repository";
import { publishUserUpdated } from "../events/user.producer";

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

export const updateProfile = async (userId: string, handle: string, fields: UpdateFields): Promise<User> => {
    await repo.upsert(userId, handle);
    const user = await repo.update(userId, fields);
    if (!user) throw new UserNotFoundError("User not found");
    await publishUserUpdated(user);
    return user;
};

export const follow = async (followerId: string, followingId: string): Promise<void> => {
    const target = await repo.findById(followingId);
    if (!target) throw new UserNotFoundError("Target user not found");

    const already = await repo.followExists(followerId, followingId);
    if (already) throw new AlreadyFollowingError("Already following this user");

    await repo.insertFollow(followerId, followingId);
};

export const unfollow = async (followerId: string, followingId: string): Promise<void> => {
    const deleted = await repo.deleteFollow(followerId, followingId);
    if (!deleted) throw new NotFollowingError("Follow relationship not found");
};
