const svc = require("../services/tweet.service");

const createTweet = async (req, res) => {
    const { content, mediaUrls, replyToTweetId } = req.body;

    if (!content || content.trim().length === 0)
        return res.status(400).json({ message: "content is required" });

    if (content.length > 280)
        return res.status(400).json({ message: "content must be 280 characters or less" });

    try {
        const tweet = await svc.createTweet(req.user.sub, { content, mediaUrls, replyToTweetId });
        return res.status(201).json({ tweet });
    } catch (err) {
        return res.status(500).json({ message: "Internal server error" });
    }
};

const getTweet = async (req, res) => {
    try {
        const tweet = await svc.getTweet(req.params.tweetId);
        return res.status(200).json({ tweet });
    } catch (err) {
        if (err.name === "TweetNotFoundError") return res.status(404).json({ message: err.message });
        return res.status(500).json({ message: "Internal server error" });
    }
};

const deleteTweet = async (req, res) => {
    try {
        await svc.deleteTweet(req.params.tweetId, req.user.sub);
        return res.status(204).send();
    } catch (err) {
        if (err.name === "TweetNotFoundError") return res.status(404).json({ message: err.message });
        if (err.name === "ForbiddenError")     return res.status(403).json({ message: err.message });
        return res.status(500).json({ message: "Internal server error" });
    }
};

const likeTweet = async (req, res) => {
    try {
        await svc.likeTweet(req.user.sub, req.params.tweetId);
        return res.status(204).send();
    } catch (err) {
        if (err.name === "TweetNotFoundError") return res.status(404).json({ message: err.message });
        if (err.name === "AlreadyLikedError")  return res.status(409).json({ message: err.message });
        return res.status(500).json({ message: "Internal server error" });
    }
};

const unlikeTweet = async (req, res) => {
    try {
        await svc.unlikeTweet(req.user.sub, req.params.tweetId);
        return res.status(204).send();
    } catch (err) {
        if (err.name === "TweetNotFoundError") return res.status(404).json({ message: err.message });
        if (err.name === "NotLikedError")      return res.status(404).json({ message: err.message });
        return res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = { createTweet, getTweet, deleteTweet, likeTweet, unlikeTweet };
