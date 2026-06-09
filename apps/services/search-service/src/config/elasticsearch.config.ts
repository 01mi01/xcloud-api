import path from "path";
import dotenv from "dotenv";
import { Client } from "@elastic/elasticsearch";

dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });

const esClient = new Client({
    node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
});

export const TWEET_INDEX = "tweets";
export const USER_INDEX  = "users";

export default esClient;
