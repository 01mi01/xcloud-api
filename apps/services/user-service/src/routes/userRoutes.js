const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const {
    getUserByHandle,
    updateUser,
    followUser,
    unfollowUser,
} = require("../services/userService");

// GET /v1/users/:handle — get user profile by handle (public)
router.get("/:handle", async (req, res) => {
    const { handle } = req.params;

    try {
        const user = await getUserByHandle(handle);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(200).json({ user });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});

// PUT /v1/users/me — update own profile (protected)
router.put("/me", verifyToken, async (req, res) => {
    const { displayName, bio, avatarUrl } = req.body;
    const userId = req.user.sub;

    if (!displayName && !bio && !avatarUrl) {
        return res.status(400).json({ message: "At least one field is required: displayName, bio, avatarUrl" });
    }

    try {
        const user = await updateUser(userId, { displayName, bio, avatarUrl });
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        return res.status(200).json({ user });
    } catch (err) {
        return res.status(500).json({ message: err.message });
    }
});

// POST /v1/users/:userId/follow — follow a user (protected)
router.post("/:userId/follow", verifyToken, async (req, res) => {
    const { userId } = req.params;
    const followerId = req.user.sub;

    if (followerId === userId) {
        return res.status(400).json({ message: "You cannot follow yourself" });
    }

    try {
        await followUser(followerId, userId);
        return res.status(200).json({ message: "User followed successfully" });
    } catch (err) {
        if (err.message === "User not found") {
            return res.status(404).json({ message: err.message });
        }
        if (err.message === "Already following this user") {
            return res.status(409).json({ message: err.message });
        }
        return res.status(500).json({ message: err.message });
    }
});

// DELETE /v1/users/:userId/follow — unfollow a user (protected)
router.delete("/:userId/follow", verifyToken, async (req, res) => {
    const { userId } = req.params;
    const followerId = req.user.sub;

    try {
        await unfollowUser(followerId, userId);
        return res.status(200).json({ message: "User unfollowed successfully" });
    } catch (err) {
        if (err.message === "User not found") {
            return res.status(404).json({ message: err.message });
        }
        return res.status(500).json({ message: err.message });
    }
});

module.exports = router;
