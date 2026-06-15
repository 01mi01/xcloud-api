/**
 * One-shot schema bootstrap for Amazon Keyspaces (the prod store for tweet-service).
 *
 * Mirrors db/cassandra-init.cql, but Keyspaces-flavoured:
 *   - keyspace uses SingleRegionStrategy (Keyspaces rejects SimpleStrategy)
 *   - DDL is asynchronous, so we poll system_schema_mcs.* until ACTIVE
 *
 * Run from a machine with AWS credentials that have Keyspaces access:
 *   AWS_REGION=us-east-1 AWS_PROFILE=personal \
 *   npm run bootstrap:keyspaces -w apps/services/tweet-service
 *
 * Auth is SigV4 (your AWS creds); TLS on 9142. Idempotent (IF NOT EXISTS).
 */
import cassandra from "cassandra-driver";
// The plugin ships no .d.ts; require it with a minimal shape (run via ts-node --transpile-only).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { SigV4AuthProvider } = require("aws-sigv4-auth-cassandra-plugin") as {
    SigV4AuthProvider: new (opts: { region: string }) => cassandra.auth.AuthProvider;
};

const region = process.env.AWS_REGION || "us-east-1";
const keyspace = process.env.CASSANDRA_KEYSPACE || "xcloud";
const contactPoints = (process.env.CASSANDRA_CONTACT_POINTS || `cassandra.${region}.amazonaws.com`).split(",");

function clientOptions(withKeyspace: boolean): cassandra.ClientOptions {
    return {
        contactPoints,
        localDataCenter: region,
        authProvider: new SigV4AuthProvider({ region }),
        // The driver connects to resolved IPs; Keyspaces' cert is for the hostname,
        // so skip the IP↔hostname identity check (CA chain is still validated).
        sslOptions: { rejectUnauthorized: true, checkServerIdentity: () => undefined },
        protocolOptions: { port: 9142 },
        ...(withKeyspace ? { keyspace } : {}),
    };
}

// Table DDL — mirrors db/cassandra-init.cql (keep in sync).
const TABLES: Record<string, string> = {
    tweets: `CREATE TABLE IF NOT EXISTS ${keyspace}.tweets (
        tweet_id UUID, author_id UUID, content TEXT, media_urls LIST<TEXT>,
        reply_to_tweet_id UUID, likes_count INT, retweet_count INT, created_at TIMESTAMP,
        PRIMARY KEY (tweet_id))`,
    tweets_by_author: `CREATE TABLE IF NOT EXISTS ${keyspace}.tweets_by_author (
        author_id UUID, created_at TIMESTAMP, tweet_id UUID, content TEXT,
        PRIMARY KEY (author_id, created_at, tweet_id)) WITH CLUSTERING ORDER BY (created_at DESC, tweet_id ASC)`,
    likes: `CREATE TABLE IF NOT EXISTS ${keyspace}.likes (
        tweet_id UUID, user_id UUID, created_at TIMESTAMP, PRIMARY KEY (tweet_id, user_id))`,
    likes_by_user: `CREATE TABLE IF NOT EXISTS ${keyspace}.likes_by_user (
        user_id UUID, tweet_id UUID, created_at TIMESTAMP, PRIMARY KEY (user_id, tweet_id))`,
    retweets: `CREATE TABLE IF NOT EXISTS ${keyspace}.retweets (
        tweet_id UUID, user_id UUID, created_at TIMESTAMP, PRIMARY KEY (tweet_id, user_id))`,
    retweets_by_user: `CREATE TABLE IF NOT EXISTS ${keyspace}.retweets_by_user (
        user_id UUID, tweet_id UUID, created_at TIMESTAMP, PRIMARY KEY (user_id, tweet_id))`,
    replies_by_tweet: `CREATE TABLE IF NOT EXISTS ${keyspace}.replies_by_tweet (
        reply_to_tweet_id UUID, created_at TIMESTAMP, tweet_id UUID,
        PRIMARY KEY (reply_to_tweet_id, created_at, tweet_id)) WITH CLUSTERING ORDER BY (created_at DESC, tweet_id ASC)`,
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitForKeyspace(client: cassandra.Client): Promise<void> {
    for (let i = 0; i < 20; i++) {
        const rs = await client.execute(
            "SELECT keyspace_name FROM system_schema_mcs.keyspaces WHERE keyspace_name = ?",
            [keyspace],
            { prepare: true },
        );
        if (rs.rowLength > 0) return;
        process.stdout.write("  waiting for keyspace…\n");
        await sleep(3000);
    }
    throw new Error(`Keyspace '${keyspace}' did not become available`);
}

async function waitForTablesActive(client: cassandra.Client, names: string[]): Promise<void> {
    for (let i = 0; i < 60; i++) {
        const rs = await client.execute(
            "SELECT table_name, status FROM system_schema_mcs.tables WHERE keyspace_name = ?",
            [keyspace],
            { prepare: true },
        );
        const status = new Map(rs.rows.map((r) => [String(r.table_name), String(r.status)]));
        const pending = names.filter((n) => status.get(n) !== "ACTIVE");
        if (pending.length === 0) return;
        process.stdout.write(`  waiting for tables: ${pending.join(", ")}\n`);
        await sleep(5000);
    }
    throw new Error("Timed out waiting for Keyspaces tables to become ACTIVE");
}

async function main(): Promise<void> {
    console.log(`Bootstrapping Amazon Keyspaces '${keyspace}' in ${region} via ${contactPoints.join(",")}`);

    // 1) Create the keyspace (connect without a keyspace first).
    const admin = new cassandra.Client(clientOptions(false));
    await admin.connect();
    await admin.execute(
        `CREATE KEYSPACE IF NOT EXISTS ${keyspace} WITH REPLICATION = {'class': 'SingleRegionStrategy'}`,
    );
    await waitForKeyspace(admin);
    console.log(`Keyspace '${keyspace}' ready.`);

    // 2) Create the tables.
    for (const [name, ddl] of Object.entries(TABLES)) {
        console.log(`Creating table ${name}…`);
        await admin.execute(ddl);
    }
    await waitForTablesActive(admin, Object.keys(TABLES));
    console.log("All tables ACTIVE.");

    await admin.shutdown();
    console.log("Done.");
}

main().catch((err) => {
    console.error("Keyspaces bootstrap failed:", err);
    process.exit(1);
});
