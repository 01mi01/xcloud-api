# @xcloud/sdk-server

Smithy-generated **server SDK** (SSDK) for the aggregate `com.twitter#TwitterService`,
consumed by the backend services (CommonJS).

It provides, per modeled operation:
- **Typed handlers** (`getGetUserHandler(...)`, etc.) that own URL matching,
  request deserialization, input validation and response/error serialization —
  the service supplies only the business logic. Used by **user-service**
  (full-SSDK pilot, see `apps/services/user-service/src/smithy/`).
- **Contract types + validators** (`CreateTweetServerInput`, `GetFeedServerOutput`,
  …) used as compile-time contracts by tweet-service and feed-service.

## Generating

The generated sources (`src/`, `tsconfig*.json`) and build output (`dist-cjs`,
`dist-types`) are **git-ignored and produced on demand** — they are not
committed. Only `package.json`, `scripts/generate.sh`, `.gitignore` and this
README are tracked.

```bash
# Prereq: Smithy CLI  →  brew install smithy-cli
npm run generate     # from this package, or `npm run generate` at the repo root
```

The script runs `smithy build` in `api-model/` (the `typescript-server`
projection in `api-model/smithy-build.json`), copies the generated TypeScript
into `src/`, and builds `dist-cjs` + `dist-types` (the services are CommonJS).

Re-run after editing any `api-model/model/*.smithy`. Do **not** hand-edit `src/`.

## Notes

- The projection sets `"disableDefaultValidation": true` because the model uses
  a custom `com.twitter#ValidationException` (not `smithy.framework#ValidationException`).
  Handlers therefore take a `ValidationCustomizer` that maps validation failures
  to our exception.
- The SSDK runtime (`@aws-smithy/server-common`) is **1.0.0-alpha** — fine for
  this course project, but pinned exactly.
- Built with `tsc --noCheck` for the same reason as `@xcloud/sdk-client`: the
  machine-generated internals drift against newer `@smithy/*` minors; the public
  types we consume are unaffected (see `docs/sdk-generation.md`).
