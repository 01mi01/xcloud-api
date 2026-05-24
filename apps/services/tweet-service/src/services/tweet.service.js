const { v4: uuidv4 } = require("uuid");
const repo = require("../repositories/tweet.repository");
const producer = require("../events/tweet.producer");

class TweetNotFoundError extends Error { constructor(m) { super(m); this.name = "TweetNotFoundError"; } }
class ForbiddenError     extends Error { constructor(m) { super(m); this.name = "ForbiddenError"; } }
class AlreadyLikedError  extends Error { constructor(m) { super(m); this.name = "AlreadyLikedError"; } }
class NotLikedError      extends Error { constructor(m) { super(m); this.name = "NotLikedError"; } }

const createTweet = async (authorId, { content, mediaUrls, replyToTweetId }) => {
    const tweet = await repo.insert({
        tweetId: uuidv4(),
        authorId,
        content,
        mediaUrls,
        replyToTweetId,
    });
    await producer.publishTweetCreated(tweet);
    return tweet;
};

const getTweet = async (tweetId) => {
    const tweet = await repo.findById(tweetId);
    if (!tweet) throw new TweetNotFoundError(`Tweet '${tweetId}' not found`);
    return tweet;
};

const deleteTweet = async (tweetId, requesterId) => {
    const tweet = await repo.findById(tweetId);
    if (!tweet) throw new TweetNotFoundError(`Tweet '${tweetId}' not found`);
    if (tweet.authorId !== requesterId) throw new ForbiddenError("You can only delete your own tweets");
    await repo.remove(tweetId);
};

const likeTweet = async (userId, tweetId) => {
    const tweet = await repo.findById(tweetId);
    if (!tweet) throw new TweetNotFoundError(`Tweet '${tweetId}' not found`);

    const already = await repo.likeExists(userId, tweetId);
    if (already) throw new AlreadyLikedError("Already liked this tweet");

    await repo.insertLike(userId, tweetId);
    await producer.publishTweetLiked({ tweetId, userId });
};

const unlikeTweet = async (userId, tweetId) => {
    const tweet = await repo.findById(tweetId);
    if (!tweet) throw new TweetNotFoundError(`Tweet '${tweetId}' not found`);

    const deleted = await repo.deleteLike(userId, tweetId);
    if (!deleted) throw new NotLikedError("You have not liked this tweet");
};

module.exports = {
    createTweet, getTweet, deleteTweet, likeTweet, unlikeTweet,
    TweetNotFoundError, ForbiddenError, AlreadyLikedError, NotLikedError,
};
