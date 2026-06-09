#!/usr/bin/env bash
# Runs the Smithy Gradle build from api-model/ and copies generated
# TypeScript server contracts into packages/sdk-server/src/generated/
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
API_MODEL_DIR="$REPO_ROOT/api-model"
OUTPUT_DIR="$REPO_ROOT/packages/sdk-server/src/generated"

echo "Building Smithy model..."
cd "$API_MODEL_DIR"
./gradlew build

echo "Copying generated server contracts to $OUTPUT_DIR ..."
rm -rf "$OUTPUT_DIR"
cp -r build/smithyprojections/x-api/typescript-server/typescript-codegen "$OUTPUT_DIR"

echo "Done — sdk-server generated."
