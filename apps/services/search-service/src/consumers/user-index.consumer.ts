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
    await createdConsumer.consume(
        { event: "user.created", queueUrl: process.env.USER_CREATED_QUEUE_URL },
        async (event: UserEvent) => {
            console.log(`[search-service] Indexing user (created) ${event.userId}`);
            await indexUser(event);
        },
    );
    await updatedConsumer.consume(
        { event: "user.updated", queueUrl: process.env.USER_UPDATED_QUEUE_URL },
        async (event: UserEvent) => {
            console.log(`[search-service] Indexing user (updated) ${event.userId}`);
            await indexUser(event);
        },
    );
    console.log("[search-service] User index consumers wired (user.created, user.updated)");
};
