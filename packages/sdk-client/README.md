# @xcloud/sdk-client

Typed HTTP client for the Twitter API, **generated from the Smithy model**
(`api-model/model/*.smithy`) via the Smithy CLI. Consumed by `apps/web`.

The client is generated for the aggregate `com.twitter#TwitterService`, so it
covers the **modelled** operations only: tweets, users, feed (incl. like /
follow). Auth, notifications and search are **not in the model** and remain
hand-written in `apps/web/src/api/`.

## Generating

Sources (`src/`, `tsconfig*.json`) and build output (`dist-*`) are **git-ignored
and produced on demand** — they are not committed.

```bash
# Prereq: Smithy CLI  →  brew install smithy-cli
npm run generate            # from this package, or:
npm run generate -w @xcloud/sdk-client   # from the repo root
```

`generate` runs `smithy build`, copies the generated TypeScript into `src/`, and
builds `dist-{cjs,es,types}`. Re-run it whenever an `api-model/*.smithy` file
changes. Do **not** hand-edit `src/` — it is overwritten on every generate.

## Using it

`apps/web` wraps this with a configured singleton (endpoint + Bearer auth) in
[`apps/web/src/api/twitter-client.ts`](../../apps/web/src/api/twitter-client.ts):

```ts
import { TwitterServiceClient, CreateTweetCommand } from "@xcloud/sdk-client";
```
