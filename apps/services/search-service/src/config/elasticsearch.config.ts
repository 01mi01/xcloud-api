import path from "path";
import dotenv from "dotenv";
import { Client } from "@opensearch-project/opensearch";
import { AwsSigv4Signer } from "@opensearch-project/opensearch/aws";
import { defaultProvider } from "@aws-sdk/credential-provider-node";

dotenv.config({ path: path.resolve(__dirname, "../../../../../.env") });

const isProd = process.env.NODE_ENV === "production";
const region = process.env.AWS_REGION || "us-east-1";

/**
 * Build the search client.
 *
 * We use the OpenSearch JS client in BOTH environments (not @elastic/elasticsearch)
 * because the elastic v8 client performs a "product check" on its first request and
 * THROWS when the server isn't Elasticsearch — which is exactly what an AWS managed
 * OpenSearch domain is. The OpenSearch client has no such check and still speaks to
 * the local Elasticsearch 8 container for the basic ops we use (indices.exists/create,
 * index, search).
 *
 * - production → AWS OpenSearch domain. Requests must be SigV4-signed; the signer
 *   uses the ECS task role's credentials (defaultProvider picks up the container
 *   credentials automatically). `service: "es"` is the SigV4 signing name for a
 *   managed OpenSearch/Elasticsearch domain (it would be "aoss" for Serverless).
 *   OPENSEARCH_ENDPOINT is the bare host the CDK search stack outputs.
 * - local dev → the Elasticsearch container over plain HTTP, no auth.
 */
const buildClient = (): Client => {
    if (isProd) {
        const endpoint = process.env.OPENSEARCH_ENDPOINT || "";
        const node = endpoint.startsWith("http") ? endpoint : `https://${endpoint}`;
        return new Client({
            ...AwsSigv4Signer({
                region,
                service: "es",
                getCredentials: () => defaultProvider()(),
            }),
            node,
        });
    }

    return new Client({
        node: process.env.ELASTICSEARCH_URL || "http://localhost:9200",
    });
};

const esClient = buildClient();

export const TWEET_INDEX = "tweets";
export const USER_INDEX  = "users";

export default esClient;
