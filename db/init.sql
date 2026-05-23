-- xcloud database schema

-- Auth table (local dev — replaced by Cognito in production)
CREATE TABLE IF NOT EXISTS auth_users (
    user_id       UUID PRIMARY KEY,
    handle        VARCHAR(50)  UNIQUE NOT NULL,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT         NOT NULL,
    role          VARCHAR(20)  NOT NULL DEFAULT 'user',
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
    user_id      UUID PRIMARY KEY,
    handle       VARCHAR(50)  UNIQUE NOT NULL,
    display_name VARCHAR(100) NOT NULL,
    bio          TEXT,
    avatar_url   TEXT,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS follows (
    follower_id  UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS tweets (
    tweet_id         UUID PRIMARY KEY,
    author_id        UUID NOT NULL,
    content          VARCHAR(280) NOT NULL,
    media_urls       TEXT[]       NOT NULL DEFAULT '{}',
    reply_to_tweet_id UUID,
    likes_count      INTEGER      NOT NULL DEFAULT 0,
    retweet_count    INTEGER      NOT NULL DEFAULT 0,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tweets_author_id ON tweets(author_id);
CREATE INDEX IF NOT EXISTS idx_tweets_created_at ON tweets(created_at DESC);

CREATE TABLE IF NOT EXISTS likes (
    user_id    UUID NOT NULL,
    tweet_id   UUID NOT NULL REFERENCES tweets(tweet_id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, tweet_id)
);
