# Smithy SDK generation

## `@xcloud/sdk-client` — generated & wired (web)

`packages/sdk-client` is a **generated** TypeScript client for the aggregate
`com.twitter#TwitterService`, consumed by `apps/web`. It covers the operations
the model defines — **tweets, users, feed** (incl. like / follow). Auth,
notifications and search are **not in the model** and stay hand-written in
`apps/web/src/api/`.

### Generating

The generated sources (`src/`, `tsconfig*.json`) and build output (`dist-es`,
`dist-types`) are **git-ignored and produced on demand** — they are not
committed. Only `package.json`, `scripts/generate.sh`, `.gitignore` and
`README.md` are tracked.

```bash
# Prereq: Smithy CLI  →  brew install smithy-cli
npm run generate            # root → generates sdk-client AND sdk-server
```

`generate` (see `packages/sdk-client/scripts/generate.sh`):
1. `smithy build` in `api-model/` (the `typescript-client` projection in
   `api-model/smithy-build.json`, codegen deps declared in its `maven` block);
2. copies the generated TypeScript into `packages/sdk-client/src/`;
3. builds `dist-es` + `dist-types` (ESM; `apps/web` is a Vite/ESM consumer).

Re-run after editing any `api-model/*.smithy`. Do **not** hand-edit `src/`.

### How the web app uses it

`apps/web/src/api/twitter-client.ts` configures a singleton
`TwitterServiceClient` with `endpoint = <origin>/api` so operation URIs
(`/v1/tweets`, `/v1/feed`, `/v1/users/{handle}`) route through the existing Vite
proxy to the right microservice. The JWT is supplied via the model's
`@httpBearerAuth` `token` provider. `tweets.ts` / `users.ts` / `feed.ts` call the
generated `*Command`s and adapt outputs back to the app's `RawTweet` / `User`
types.

### Version notes (important)

- **Codegen version**: `smithy-typescript-codegen` + `smithy-aws-typescript-codegen`
  are pinned to **0.31.1** in `api-model/smithy-build.json`. The AWS codegen
  package is required because `restJson1` is an AWS protocol — without it the
  generated commands throw `"No supported protocol was found"` at runtime.
- **`--noCheck` build**: the generated client is built with `tsc --noCheck`. The
  machine-generated code is runtime-correct but its internal config types drift
  against newer `@smithy/*` minors; `--noCheck` emits JS + `.d.ts` without
  failing on that skew. The public command/input/output types we consume are
  unaffected.
- **`@smithy` consistency**: a clean `npm install` resolves the whole `@smithy`
  family to a single latest line (where subpath exports like `@smithy/core/endpoints`
  exist). If a future install produces a *mixed* set (a bundler error like
  `"./endpoints" is not exported from @smithy/core`), do a clean reinstall
  (`rm -rf node_modules package-lock.json && npm install`).

## `@xcloud/sdk-server` — generated & wired (backend)

`packages/sdk-server` is the **generated server SDK (SSDK)** for the same
aggregate `com.twitter#TwitterService` (the `typescript-server` projection,
plugin `typescript-ssdk-codegen`). Like the client, the generated sources and
build output are git-ignored — `npm run generate` produces them (the root
`generate` script runs both packages). It is built **CommonJS**
(`dist-cjs` + `dist-types`) because the services are CJS.

The earlier "one aggregate model vs 8 microservices" concern turned out to be a
non-issue: the SSDK generates **per-operation** handlers
(`getGetUserHandler(...)`, …), so each service imports only the handlers for
the operations it owns.

Two adoption levels are in place:

- **Full SSDK pilot — user-service** (`apps/services/user-service/src/smithy/`):
  `GetUser`, `UpdateUser`, `FollowUser`, `UnfollowUser` are served by generated
  handlers, which own URL matching, deserialization, modeled-constraint
  validation and response/error serialization. `express-adapter.ts` bridges
  Express ↔ the SSDK's `HttpRequest`/`HttpResponse` (the JWT payload from
  `verifyToken` rides in the handler `Context`); `operations.ts` supplies only
  business logic, delegating to the existing service layer and rethrowing
  domain errors as modeled exceptions (`UserNotFoundException`,
  `ConflictException`, `ValidationException`). The non-modeled
  `GET /by-id/:userId` route stays plain Express.
- **Contract types — tweet-service & feed-service**: controllers type their
  request payloads against the generated `*ServerInput` shapes (`import type`,
  declared as a devDependency) so model drift on requests breaks the build.
  Responses keep their tested hand-written shape for now (domain types use
  `null` where the contract has optional members) — aligning them is the next
  step if those services move to full SSDK.

Notes:
- The projection sets `"disableDefaultValidation": true` because the model uses
  a custom `com.twitter#ValidationException` (not
  `smithy.framework#ValidationException`); handlers take a
  `ValidationCustomizer` that maps constraint failures to our exception
  (see `operations.ts`).
- `FollowUser`/`UnfollowUser` are modeled with `code: 204` to match the
  services' actual (tested) success responses.
- The SSDK runtime `@aws-smithy/server-common` is **1.0.0-alpha.10** (pinned
  exactly). Fine for this course project; it is the least mature piece of the
  Smithy TypeScript story.
- Same `--noCheck` build rationale as the client (generated internals drift
  against newer `@smithy/*` minors; the public types we consume are fine).
