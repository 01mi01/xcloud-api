import path from "path";
import dotenv from "dotenv";
import { Client } from "@opensearch-project/opensearch";

dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });

// Prod (CDK): OPENSEARCH_ENDPOINT is the bare domain host → needs https://.
// Local dev: ELASTICSEARCH_URL points at the OpenSearch docker on http://localhost:9200.
const node = process.env.OPENSEARCH_ENDPOINT
    ? `https://${process.env.OPENSEARCH_ENDPOINT}`
    : process.env.OPENSEARCH_URL || process.env.ELASTICSEARCH_URL || "http://localhost:9200";

const osClient = new Client({ node });

export const TWEET_INDEX = "tweets";
export const USER_INDEX  = "users";

export default osClient;
