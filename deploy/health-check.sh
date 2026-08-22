#!/usr/bin/env sh
set -eu

engine_url="${TRADING_ENGINE_HEALTH_URL:-http://127.0.0.1:8081/health/ready}"
backend_url="${BACKEND_HEALTH_URL:-http://127.0.0.1:4000/api/health}"
failures=""

if ! curl --fail --silent --show-error --max-time 8 "$engine_url" >/dev/null; then
  failures="trading-engine readiness failed"
fi
if ! curl --fail --silent --show-error --max-time 8 "$backend_url" >/dev/null; then
  if [ -n "$failures" ]; then failures="$failures; "; fi
  failures="${failures}backend health failed"
fi

if [ -z "$failures" ]; then
  logger -t kriptokeyfi-health "healthy"
  exit 0
fi

logger -p user.err -t kriptokeyfi-health "$failures"
if [ -n "${ALERT_WEBHOOK_URL:-}" ]; then
  escaped=$(printf '%s' "$failures" | sed 's/\\/\\\\/g; s/"/\\"/g')
  curl --fail --silent --show-error --max-time 8 -H 'Content-Type: application/json' -d "{\"text\":\"KriptoKeyfi alarm: $escaped\"}" "$ALERT_WEBHOOK_URL" >/dev/null || true
fi
exit 1
