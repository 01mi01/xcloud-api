const fromRow = (row) => ({
    tweetId:          row.tweet_id?.toString()          ?? null,
    content:          row.content,
    authorId:         row.author_id?.toString()         ?? null,
    mediaUrls:        row.media_urls                    ?? [],
    replyToTweetId:   row.reply_to_tweet_id?.toString() ?? null,
    likesCount:       row.likes_count   ?? 0,
    retweetCount:     row.retweet_count ?? 0,
    createdAt:        row.created_at,
});

module.exports = { fromRow };
