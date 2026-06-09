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
npm run generate            # root → runs packages/sdk-client generate
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

## `@xcloud/sdk-server` — still DEFERRED

`packages/sdk-server` remains a skeleton. The aggregate model maps to one
service, while the runtime is 6–7 microservices, so the Smithy SSDK (which owns
routing/serialization for a single service) doesn't fit cleanly over Express +
the multi-service split. Adopting shared *types* (not the full SSDK) in a pilot
service is the likely next step. Server codegen also needs
`"disableDefaultValidation": true` (the model uses a custom `ValidationException`,
not `smithy.framework#ValidationException`).
