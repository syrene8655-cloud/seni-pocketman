#!/bin/zsh
set -e
SCRIPT_DIR="$(cd -- "$(dirname -- "$0")" && pwd)"
cd "$SCRIPT_DIR"
if [[ ! -d node_modules ]]; then
  npm ci --ignore-scripts --no-audit --no-fund
fi
export PORT="${PORT:-8768}"
unset WALKMAN_PUBLIC_ORIGIN
exec node server.cjs --open
