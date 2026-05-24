# ADR-001 — Replace Amazon MSK (Kafka) with Amazon SQS

| Field | Value |
|-------|-------|
| **Status** | Accepted |
| **Date** | 2026-05-24 |
| **Deciders** | Engineering team |
| **Supersedes** | — |

---

## Context

The original architecture specified Apache Kafka via Amazon MSK for the following use cases:

- **Fanout service**: consuming `tweet-created` events to write to follower feed caches
- **Notification service**: consuming `like` and `follow` events to push WebSocket notifications
- **Search service**: consuming `tweet-created` events to index tweets in OpenSearch

MSK requires a minimum of **3 brokers** for production-grade high availability, which costs approximately **$300–450/month** at the `kafka.t3.small` tier. This cost is not justified for a demo or early-stage project where message volume is low and SLA requirements are relaxed.

---

## Decision

Replace Amazon MSK with **Amazon SQS** (standard queues).

Each Kafka topic is replaced by one or more SQS queues:

| Kafka topic (original) | SQS queue (new) |
|------------------------|-----------------|
| `tweet-created` | `xcloud-tweet-created.fifo` |
| `like-event` | `xcloud-like-event` |
| `follow-event` | `xcloud-follow-event` |
| `tweet-index` | `xcloud-tweet-index` |

Producers (tweet-service, user-service) call `sqs.sendMessage()` instead of the Kafka producer.
Consumers (fanout-service, notification-service, search-service) poll SQS via `sqs.receiveMessage()` in a simple loop or via AWS Lambda triggers.

---

## Consequences

### Positive
- **Cost**: SQS first 1M requests/month are always free; $0.40 per million thereafter — effectively zero cost for demo scale.
- **Operational simplicity**: no broker cluster to manage, scale, or monitor.
- **Native AWS integration**: works out of the box with IAM, CloudWatch, and Lambda.
- **Dead-letter queues (DLQ)** are available natively for failed message handling.

### Negative / Trade-offs
- **No consumer groups / offset management**: each consumer service must track its own processing state. SQS visibility timeout replaces Kafka's offset commit model.
- **No log compaction or replay**: SQS messages are deleted after consumption. If re-processing past events is needed, the original Kafka approach or EventBridge Pipes should be revisited.
- **FIFO ordering** is available via FIFO queues but with a throughput cap of 3,000 messages/second (sufficient for demo scale).
- **Fan-out to multiple consumers**: a single SQS queue delivers to one consumer group. If the same event needs to reach multiple independent consumers (e.g., both fanout-service and search-service consume `tweet-created`), use **Amazon SNS** as a pub/sub layer with SQS subscriptions. This should be implemented when the second consumer is built.

### Migration path back to Kafka
If the project outgrows SQS limits, the interface layer in each service (producer/consumer classes) should be abstracted behind a `MessageBus` interface so the underlying transport can be swapped without touching business logic.

---

## Alternatives Considered

| Option | Reason rejected |
|--------|----------------|
| MSK (Kafka) | ~$300–450/month minimum, too costly for early stage |
| Single-broker Kafka on EC2 | Still requires EC2 cost + ops overhead; no HA |
| EventBridge | Better for cross-account/SaaS events; more complex routing rules than needed here |
