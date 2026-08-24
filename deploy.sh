#!/usr/bin/env bash
set -Eeuo pipefail

# Stable repository-root entrypoint. The implementation lives under backend so
# older VPS instructions (`bash deploy.sh`) and direct backend invocation share
# exactly the same production-safe deployment flow.
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PROJECT_DIR
exec bash "$PROJECT_DIR/backend/deploy.sh" "$@"
