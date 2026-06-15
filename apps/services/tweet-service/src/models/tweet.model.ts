export interface Tweet {
    tweetId:          string | null;
    content:          string;
    authorId:         string | null;
    mediaUrls:        string[];
    replyToTweetId:   string | null;
    likesCount:       number;
    retweetCount:     number;
    repliesCount:     number;
    createdAt:        Date | string;
}

export interface TweetRow {
    tweet_id?:          { toString(): string } | null;
    content:            string;
    author_id?:         { toString(): string } | null;
    media_urls?:        string[] | null;
    reply_to_tweet_id?: { toString(): string } | null;
    likes_count?:       number | null;
    retweet_count?:     number | null;
    replies_count?:     number | null;
    created_at:         Date | string;
}

export const fromRow = (row: TweetRow): Tweet => ({
    tweetId:          row.tweet_id?.toString()          ?? null,
    content:          row.content,
    authorId:         row.author_id?.toString()         ?? null,
    mediaUrls:        row.media_urls                    ?? [],
    replyToTweetId:   row.reply_to_tweet_id?.toString() ?? null,
    likesCount:       row.likes_count    ?? 0,
    retweetCount:     row.retweet_count  ?? 0,
    repliesCount:     row.replies_count  ?? 0,
    createdAt:        row.created_at,
});
