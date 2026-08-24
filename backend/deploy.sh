#!/usr/bin/env bash
set -Eeuo pipefail

# Backward-compatible entrypoint. The canonical deploy script is at the
# repository root so `bash deploy.sh` always builds backend, frontend and Go.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PROJECT_DIR
exec bash "$PROJECT_DIR/deploy.sh" "$@"
