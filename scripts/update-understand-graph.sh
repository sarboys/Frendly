#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
PLUGIN_ROOT="${UA_PLUGIN_ROOT:-$HOME/.codex/understand-anything/understand-anything-plugin}"
CORE_DIST="$PLUGIN_ROOT/packages/core/dist/index.js"

if ! command -v node >/dev/null 2>&1; then
  echo "Missing node. Install Node.js >= 22." >&2
  exit 1
fi

if ! command -v pnpm >/dev/null 2>&1; then
  echo "Missing pnpm. Install pnpm >= 10." >&2
  exit 1
fi

if [ ! -f "$PLUGIN_ROOT/package.json" ] || [ ! -f "$PLUGIN_ROOT/pnpm-workspace.yaml" ]; then
  echo "Cannot find understand-anything plugin root: $PLUGIN_ROOT" >&2
  echo "Set UA_PLUGIN_ROOT=/path/to/understand-anything-plugin if needed." >&2
  exit 1
fi

if [ "${UA_SKIP_CORE_BUILD:-0}" != "1" ] || [ ! -f "$CORE_DIST" ]; then
  cd "$PLUGIN_ROOT"
  pnpm install --frozen-lockfile >/dev/null
  pnpm --filter @understand-anything/core build >/dev/null
fi

cd "$PROJECT_ROOT"
node "$SCRIPT_DIR/update-understand-graph.mjs" "$PROJECT_ROOT" "$PLUGIN_ROOT"
