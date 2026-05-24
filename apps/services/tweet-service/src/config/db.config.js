require("dotenv").config({ path: require("path").resolve(__dirname, "../../../../.env") });
const cassandra = require("cassandra-driver");

const client = new cassandra.Client({
    contactPoints: (process.env.CASSANDRA_CONTACT_POINTS || "localhost").split(","),
    localDataCenter: process.env.CASSANDRA_DC || "datacenter1",
    keyspace: process.env.CASSANDRA_KEYSPACE || "xcloud",
});

module.exports = client;
