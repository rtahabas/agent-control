#!/usr/bin/env bash
# agent-control — build once, then serve the prebuilt output on :PORT.
#
# Why this exists: `next dev` (Turbopack) keeps the whole module graph + file
# watchers resident and compiles on-demand, which exhausts RAM on small boxes
# and freezes the machine. `next build` + `next start` compiles once (batch,
# ~10s, light) then serves the static output with a tiny footprint. Use this.
#
#   bash scripts/serve.sh              # build, then start
#   bash scripts/serve.sh --no-build   # skip build, just start (already built)
#   PORT=4000 bash scripts/serve.sh    # override port (default 3005)
set -euo pipefail
cd "$(dirname "$0")/.."
PORT="${PORT:-3005}"

# Free the port first — a previous start can leave a child process holding it.
pids=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$pids" ]; then
  echo "> freeing port $PORT (killing: $pids)"
  kill -9 $pids 2>/dev/null || true
  sleep 1
fi

if [ "${1:-}" != "--no-build" ]; then
  echo "> building (next build) ..."
  npx next build
fi

echo "> serving on port $PORT  (Ctrl+C to stop)"
exec npx next start -p "$PORT"
