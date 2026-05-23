-- xcloud Cassandra schema (mirrors Amazon Keyspaces in production)

CREATE KEYSPACE IF NOT EXISTS xcloud
    WITH replication = {'class': 'SimpleStrategy', 'replication_factor': 1};

USE xcloud;

CREATE TABLE IF NOT EXISTS tweets (
    tweet_id          UUID,
    author_id         UUID,
    content           TEXT,
    media_urls        LIST<TEXT>,
    reply_to_tweet_id UUID,
    likes_count       INT,
    retweet_count     INT,
    created_at        TIMESTAMP,
    PRIMARY KEY (tweet_id)
);

-- Partition by author for efficient "tweets by user" queries
CREATE TABLE IF NOT EXISTS tweets_by_author (
    author_id  UUID,
    created_at TIMESTAMP,
    tweet_id   UUID,
    content    TEXT,
    PRIMARY KEY (author_id, created_at, tweet_id)
) WITH CLUSTERING ORDER BY (created_at DESC);

CREATE TABLE IF NOT EXISTS likes (
    tweet_id   UUID,
    user_id    UUID,
    created_at TIMESTAMP,
    PRIMARY KEY (tweet_id, user_id)
);

-- Reverse index to check if a user liked a tweet efficiently
CREATE TABLE IF NOT EXISTS likes_by_user (
    user_id    UUID,
    tweet_id   UUID,
    created_at TIMESTAMP,
    PRIMARY KEY (user_id, tweet_id)
);
