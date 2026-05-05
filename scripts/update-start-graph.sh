#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="${UA_GRAPH_DIR:-$(cd "$SCRIPT_DIR/.." && pwd)}"
DASHBOARD_DIR="${UA_DASHBOARD_DIR:-$HOME/.codex/understand-anything/understand-anything-plugin/packages/dashboard}"
HOST="${UA_DASHBOARD_HOST:-127.0.0.1}"
PORT="${UA_DASHBOARD_PORT:-5173}"

if [ ! -d "$PROJECT_ROOT" ]; then
  echo "Project root not found: $PROJECT_ROOT" >&2
  exit 1
fi

if [ ! -d "$DASHBOARD_DIR" ]; then
  echo "Dashboard directory not found: $DASHBOARD_DIR" >&2
  exit 1
fi

if [ "${UA_START_GRAPH_DRY_RUN:-0}" = "1" ]; then
  echo "GRAPH_DIR=$PROJECT_ROOT"
  echo "DASHBOARD_DIR=$DASHBOARD_DIR"
  echo "URL=http://${HOST}:${PORT}"
  exit 0
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm is required to start the graph dashboard." >&2
  exit 1
fi

PORT="$(node - "$HOST" "$PORT" <<'NODE'
const net = require("node:net");

const host = process.argv[2];
let port = Number(process.argv[3]);

function isFree(candidate) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(candidate, host);
  });
}

(async () => {
  while (port < 65535) {
    if (await isFree(port)) {
      console.log(port);
      return;
    }
    port += 1;
  }
  process.exit(1);
})();
NODE
)"
URL="http://${HOST}:${PORT}"

echo "Starting Understand Anything dashboard"
echo "GRAPH_DIR=$PROJECT_ROOT"
echo "URL=$URL"

if command -v open >/dev/null 2>&1; then
  (sleep 2 && open "$URL") >/dev/null 2>&1 &
fi

cd "$DASHBOARD_DIR"
exec env GRAPH_DIR="$PROJECT_ROOT" pnpm exec vite --host "$HOST" --port "$PORT" --strictPort
