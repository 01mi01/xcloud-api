#!/usr/bin/env bash
# Start all xcloud microservices + web SPA in development mode.
# Each process runs in the background; logs go to logs/<service>.log.
# Run from the repo root. Press Ctrl+C to stop everything.

set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
LOGS="$ROOT/logs"
mkdir -p "$LOGS"

SERVICES=(
  auth-service
  user-service
  tweet-service
  feed-service
  notification-service
  search-service
  media-service
  fanout-service
)

PIDS=()

cleanup() {
  echo ""
  echo "Stopping all processes..."
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null
  echo "Done."
}
trap cleanup INT TERM

echo "==> Starting backend services..."
for svc in "${SERVICES[@]}"; do
  log="$LOGS/$svc.log"
  npm run dev --workspace="apps/services/$svc" > "$log" 2>&1 &
  PIDS+=($!)
  echo "    $svc  (pid $!, log: logs/$svc.log)"
done

echo ""
echo "==> Starting web SPA..."
log="$LOGS/web.log"
npm run dev --workspace=apps/web > "$log" 2>&1 &
PIDS+=($!)
echo "    web  (pid $!, log: logs/web.log)"

echo ""
echo "All processes started. Logs in ./logs/"
echo "Press Ctrl+C to stop everything."
echo ""

wait
