#!/usr/bin/env bash
# Launcher for the Agent Control Plane (Next.js dev server).
# Usage:
#   agent-control                 # default port 3000
#   PORT=4000 agent-control
#   agent-control build           # production build
#   agent-control start           # production server (after build)
set -e
cd "$(dirname "$(readlink -f "$0" 2>/dev/null || echo "$0")")"

case "${1:-dev}" in
  dev)   exec npm run dev ;;
  build) exec npm run build ;;
  start) exec npm run start ;;
  *)     echo "unknown command: $1 (dev|build|start)"; exit 2 ;;
esac
