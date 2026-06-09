import path from "path";
import dotenv from "dotenv";
import cassandra from "cassandra-driver";

dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });

const client = new cassandra.Client({
    contactPoints: (process.env.CASSANDRA_CONTACT_POINTS || "localhost").split(","),
    localDataCenter: process.env.CASSANDRA_DC || "datacenter1",
    keyspace: process.env.CASSANDRA_KEYSPACE || "xcloud",
});

export default client;
