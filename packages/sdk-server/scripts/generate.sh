#!/usr/bin/env bash
# Generates the TypeScript server SDK (SSDK) from the Smithy model using the
# Smithy CLI (no Gradle), copies the generated sources into packages/sdk-server/,
# and builds it to dist-{cjs,types}. The generated src/ + tsconfig*.json + dist-*
# are git-ignored (see .gitignore) — only package.json, this script, .gitignore
# and README.md are committed.
#
# Requires the Smithy CLI: https://smithy.io/2.0/guides/smithy-cli/cli_installation.html
#   brew install smithy-cli
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
API_MODEL_DIR="$REPO_ROOT/api-model"
PKG_DIR="$REPO_ROOT/packages/sdk-server"
GEN_DIR="$API_MODEL_DIR/build/smithy/typescript-server/typescript-ssdk-codegen"

if ! command -v smithy >/dev/null 2>&1; then
  echo "ERROR: the Smithy CLI is not installed. Run: brew install smithy-cli" >&2
  exit 1
fi

echo "[sdk-server] Building Smithy model (Smithy CLI)..."
( cd "$API_MODEL_DIR" && smithy build )

if [ ! -d "$GEN_DIR/src" ]; then
  echo "ERROR: expected generated output at $GEN_DIR/src — did the typescript-server projection run?" >&2
  exit 1
fi

echo "[sdk-server] Copying generated sources into $PKG_DIR ..."
rm -rf "$PKG_DIR/src" \
       "$PKG_DIR/tsconfig.json" "$PKG_DIR/tsconfig.cjs.json" \
       "$PKG_DIR/tsconfig.es.json" "$PKG_DIR/tsconfig.types.json"
cp -R "$GEN_DIR/src" "$PKG_DIR/src"
cp "$GEN_DIR/tsconfig.json" "$GEN_DIR/tsconfig.cjs.json" \
   "$GEN_DIR/tsconfig.types.json" "$PKG_DIR/"

echo "[sdk-server] Installing workspace deps..."
( cd "$REPO_ROOT" && npm install )

echo "[sdk-server] Building dist-{cjs,types}..."
( cd "$PKG_DIR" && npm run build )

echo "[sdk-server] Done."
