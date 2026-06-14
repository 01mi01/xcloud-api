import { createConsumer } from "@xcloud/shared";
import { indexUser, UserEvent } from "../services/search.service";

// Two events feed the user search index:
//   - user.created  (auth-service, on registration)
//   - user.updated  (user-service, on profile update)
// Both re-index by userId, so the document stays current.
// local: Kafka topics; prod: SQS queues USER_CREATED_QUEUE_URL / USER_UPDATED_QUEUE_URL.
const createdConsumer = createConsumer({ clientId: "search-service", groupId: "search-service-user-created-group" });
const updatedConsumer = createConsumer({ clientId: "search-service", groupId: "search-service-user-updated-group" });

export const startUserIndexConsumers = async (): Promise<void> => {
    console.log("[search-service] User index consumers starting (user.created, user.updated)");
    // In prod each consume() is an infinite SQS long-poll loop that never resolves,
    // so the two MUST run concurrently — awaiting them sequentially would start
    // only user.created and never user.updated (which is what the reindex backfill
    // publishes). Promise.all invokes both consume() calls before awaiting, so both
    // loops run. (Locally, Kafka's consume() resolves and this still works.)
    await Promise.all([
        createdConsumer.consume(
            { event: "user.created", queueUrl: process.env.USER_CREATED_QUEUE_URL },
            async (event: UserEvent) => {
                console.log(`[search-service] Indexing user (created) ${event.userId}`);
                await indexUser(event);
            },
        ),
        updatedConsumer.consume(
            { event: "user.updated", queueUrl: process.env.USER_UPDATED_QUEUE_URL },
            async (event: UserEvent) => {
                console.log(`[search-service] Indexing user (updated) ${event.userId}`);
                await indexUser(event);
            },
        ),
    ]);
};
