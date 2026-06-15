/**
 * Idempotent PostgreSQL schema bootstrap, run by the PG services on startup.
 *
 * In prod the RDS instance lives in private subnets (unreachable from a laptop),
 * so the services create their own tables at boot instead of an external script.
 * Mirrors db/init.sql — keep in sync.
 */

export interface SchemaRunner {
  query(sql: string): Promise<unknown>;
}

const STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS auth_users (
      user_id       UUID PRIMARY KEY,
      handle        VARCHAR(50)  UNIQUE NOT NULL,
      email         VARCHAR(255) UNIQUE NOT NULL,
      password_hash TEXT         NOT NULL,
      role          VARCHAR(20)  NOT NULL DEFAULT 'user',
      created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS users (
      user_id      UUID PRIMARY KEY,
      handle       VARCHAR(50)  UNIQUE NOT NULL,
      display_name VARCHAR(100) NOT NULL,
      bio          TEXT,
      avatar_url   TEXT,
      created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS follows (
      follower_id  UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      following_id UUID NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
      created_at   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
      PRIMARY KEY (follower_id, following_id)
  )`,
  `CREATE TABLE IF NOT EXISTS notifications (
      id                UUID PRIMARY KEY,
      recipient_user_id UUID        NOT NULL,
      actor_user_id     UUID        NOT NULL,
      type              VARCHAR(50) NOT NULL,
      ref_tweet_id      UUID,
      read              BOOLEAN     NOT NULL DEFAULT false,
      created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
  )`,
];

/**
 * Ensure all PostgreSQL tables exist. Retries to tolerate a cold RDS / brief
 * connectivity gaps at startup. Safe to call from every PG service (idempotent).
 */
export async function ensurePostgresSchema(runner: SchemaRunner, attempts = 5): Promise<void> {
  for (let i = 1; i <= attempts; i++) {
    try {
      for (const sql of STATEMENTS) await runner.query(sql);
      console.log('[schema] PostgreSQL schema ensured');
      return;
    } catch (err) {
      if (i === attempts) {
        console.error('[schema] Failed to ensure PostgreSQL schema:', (err as Error).message);
        return;
      }
      const delay = i * 2000;
      console.warn(`[schema] ensure attempt ${i} failed, retrying in ${delay / 1000}s...`);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}
