import path from "path";
import dotenv from "dotenv";
import cassandra from "cassandra-driver";

dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });

// Local dev → self-managed Cassandra (Docker, plain 9042).
// Production → Amazon Keyspaces: TLS on 9142, SigV4 auth via the task IAM role
// (tweet-service's ECS task role already has cassandra:* — see EcsStack), and the
// AWS region as the "data center".
const isProd = process.env.NODE_ENV === "production";
const region = process.env.AWS_REGION || "us-east-1";

function buildClient(): cassandra.Client {
    const base = {
        contactPoints: (process.env.CASSANDRA_CONTACT_POINTS || "localhost").split(","),
        keyspace: process.env.CASSANDRA_KEYSPACE || "xcloud",
    };

    if (!isProd) {
        return new cassandra.Client({ ...base, localDataCenter: process.env.CASSANDRA_DC || "datacenter1" });
    }

    // Lazy require so local/dev (and tests) never need the plugin installed.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { SigV4AuthProvider } = require("aws-sigv4-auth-cassandra-plugin");
    return new cassandra.Client({
        ...base,
        localDataCenter: process.env.CASSANDRA_DC || region,
        authProvider: new SigV4AuthProvider({ region }),
        // CA is Amazon Trust Services (in Node's bundle); the driver connects to
        // resolved IPs, so skip the IP↔hostname identity check (CA still validated).
        sslOptions: { rejectUnauthorized: true, checkServerIdentity: () => undefined },
        protocolOptions: { port: 9142 },
        // Keyspaces only supports LOCAL_QUORUM for writes (driver default is LOCAL_ONE).
        // Set it as the default for all queries; reads accept LOCAL_QUORUM too.
        queryOptions: { consistency: cassandra.types.consistencies.localQuorum },
    });
}

const client = buildClient();

export default client;
