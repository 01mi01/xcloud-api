# Smithy SDK generation — DEFERRED

`packages/sdk-client` (ESM, for `apps/web`) and `packages/sdk-server` (CJS, for
backend services) are present as **skeletons only**. Their `src/generated/`
directories are empty and **no code imports them yet**.

This was a deliberate scoping decision for the cloud-migration milestone
(restructure + clean `cdk synth`): wiring generated SDKs into the working web
client and services (the guide's "Phase 9") is higher-risk and is tracked as a
separate follow-up.

## What's needed to enable them later

1. Add `typescript-client` / `typescript-server` projections to
   `api-model/smithy-build.json` and the codegen deps to `api-model/build.gradle`.
2. Run `npm run generate` (root) → populates `packages/sdk-*/src/generated/`.
3. Add a `build` script to each package and wire:
   - services: `import type { ... } from "@xcloud/sdk-server"`
   - web: `import { TwitterClient } from "@xcloud/sdk-client"` in
     `apps/web/src/services/api.client.ts`.

Until then these packages are inert (no `build` script → skipped by
`npm run build --workspaces --if-present`).
