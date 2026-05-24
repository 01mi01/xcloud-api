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

-- tweets and likes live in Cassandra (see db/cassandra-init.cql)


-- Notifications table (used by Notification Service)
CREATE TABLE IF NOT EXISTS notifications (
    id                UUID PRIMARY KEY,
    recipient_user_id UUID        NOT NULL,
    actor_user_id     UUID        NOT NULL,
    type              VARCHAR(50) NOT NULL,
    ref_tweet_id      UUID,
    read              BOOLEAN     NOT NULL DEFAULT false,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);