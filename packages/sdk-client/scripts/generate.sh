#!/usr/bin/env bash
# Runs the Smithy Gradle build from api-model/ and copies generated
# TypeScript client output into packages/sdk-client/src/generated/
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
API_MODEL_DIR="$REPO_ROOT/api-model"
OUTPUT_DIR="$REPO_ROOT/packages/sdk-client/src/generated"

echo "Building Smithy model..."
cd "$API_MODEL_DIR"
./gradlew build

echo "Copying generated client to $OUTPUT_DIR ..."
rm -rf "$OUTPUT_DIR"
cp -r build/smithyprojections/x-api/typescript-client/typescript-codegen "$OUTPUT_DIR"

echo "Done — sdk-client generated."
