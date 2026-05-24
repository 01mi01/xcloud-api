const repo = require("../repositories/user.repository");

class UserNotFoundError    extends Error { constructor(m) { super(m); this.name = "UserNotFoundError"; } }
class AlreadyFollowingError extends Error { constructor(m) { super(m); this.name = "AlreadyFollowingError"; } }
class NotFollowingError     extends Error { constructor(m) { super(m); this.name = "NotFollowingError"; } }

const getByHandle = async (handle) => {
    const user = await repo.findByHandle(handle);
    if (!user) throw new UserNotFoundError(`User '${handle}' not found`);
    return user;
};

const updateProfile = async (userId, handle, fields) => {
    // Upsert ensures the profile row exists (created on first PUT /me)
    await repo.upsert(userId, handle);
    const user = await repo.update(userId, fields);
    if (!user) throw new UserNotFoundError("User not found");
    return user;
};

const follow = async (followerId, followingId) => {
    const target = await repo.findById(followingId);
    if (!target) throw new UserNotFoundError("Target user not found");

    const already = await repo.followExists(followerId, followingId);
    if (already) throw new AlreadyFollowingError("Already following this user");

    await repo.insertFollow(followerId, followingId);
};

const unfollow = async (followerId, followingId) => {
    const deleted = await repo.deleteFollow(followerId, followingId);
    if (!deleted) throw new NotFollowingError("Follow relationship not found");
};

module.exports = { getByHandle, updateProfile, follow, unfollow, UserNotFoundError, AlreadyFollowingError, NotFollowingError };
