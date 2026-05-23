const fromRow = (row) => ({
    tweetId:         row.tweet_id,
    content:         row.content,
    authorId:        row.author_id,
    mediaUrls:       row.media_urls ?? [],
    replyToTweetId:  row.reply_to_tweet_id ?? null,
    likesCount:      parseInt(row.likes_count ?? 0),
    retweetCount:    parseInt(row.retweet_count ?? 0),
    createdAt:       row.created_at,
});

module.exports = { fromRow };
