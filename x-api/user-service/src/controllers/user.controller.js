const svc = require("../services/user.service");

const URL_REGEX = /^https?:\/\/.+/;

const getUser = async (req, res) => {
    try {
        const user = await svc.getByHandle(req.params.handle);
        return res.status(200).json(user);
    } catch (err) {
        if (err.name === "UserNotFoundError") return res.status(404).json({ message: err.message });
        return res.status(500).json({ message: "Internal server error" });
    }
};

const updateMe = async (req, res) => {
    const { displayName, bio, avatarUrl } = req.body;

    if (displayName !== undefined && displayName.length > 50)
        return res.status(400).json({ message: "displayName must be 50 characters or less" });

    if (bio !== undefined && bio.length > 160)
        return res.status(400).json({ message: "bio must be 160 characters or less" });

    if (avatarUrl !== undefined && !URL_REGEX.test(avatarUrl))
        return res.status(400).json({ message: "avatarUrl must be a valid URL" });

    if (displayName === undefined && bio === undefined && avatarUrl === undefined)
        return res.status(400).json({ message: "At least one field is required: displayName, bio, avatarUrl" });

    try {
        const handle = req.user.username ?? req.user["cognito:username"];
        const user = await svc.updateProfile(req.user.sub, handle, { displayName, bio, avatarUrl });
        return res.status(200).json(user);
    } catch (err) {
        if (err.name === "UserNotFoundError") return res.status(404).json({ message: err.message });
        return res.status(500).json({ message: "Internal server error" });
    }
};

const followUser = async (req, res) => {
    const followingId = req.params.userId;
    const followerId  = req.user.sub;

    if (followerId === followingId)
        return res.status(400).json({ message: "You cannot follow yourself" });

    try {
        await svc.follow(followerId, followingId);
        return res.status(204).send();
    } catch (err) {
        if (err.name === "UserNotFoundError")    return res.status(404).json({ message: err.message });
        if (err.name === "AlreadyFollowingError") return res.status(409).json({ message: err.message });
        return res.status(500).json({ message: "Internal server error" });
    }
};

const unfollowUser = async (req, res) => {
    const followingId = req.params.userId;
    const followerId  = req.user.sub;

    try {
        await svc.unfollow(followerId, followingId);
        return res.status(204).send();
    } catch (err) {
        if (err.name === "NotFollowingError") return res.status(404).json({ message: err.message });
        return res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = { getUser, updateMe, followUser, unfollowUser };
