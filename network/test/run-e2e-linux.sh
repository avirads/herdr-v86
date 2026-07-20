#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
ADMIN_TOKEN="${V86NET_ADMIN_TOKEN:-$(openssl rand -hex 32)}"
PORT="${V86NET_PORT:-8086}"
WEB_PORT="${V86NET_WEB_PORT:-8090}"
ORIGIN="http://127.0.0.1:$WEB_PORT"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "run as root; TAP and nftables require CAP_NET_ADMIN" >&2
  exit 1
fi
cleanup() {
  [[ -n "${GATEWAY_PID:-}" ]] && kill "$GATEWAY_PID" 2>/dev/null || true
  rm -f /tmp/v86net-gateway-e2e
  "$PROJECT_DIR/network/scripts/teardown-linux.sh" >/dev/null 2>&1 || true
}
trap cleanup EXIT

"$PROJECT_DIR/network/scripts/setup-linux.sh"
cd "$PROJECT_DIR/network"
go build -o /tmp/v86net-gateway-e2e ./cmd/v86net-gateway
/tmp/v86net-gateway-e2e -listen "0.0.0.0:$PORT" -tap v86tap0 -admin-token "$ADMIN_TOKEN" &
GATEWAY_PID=$!
for _ in $(seq 1 50); do curl -fsS "http://127.0.0.1:$PORT/health" >/dev/null && break; sleep .1; done

SESSION="$(curl -fsS -X POST "http://127.0.0.1:$PORT/v1/sessions" \
  -H "Authorization: Bearer $ADMIN_TOKEN" -H 'Content-Type: application/json' \
  --data "{\"origin\":\"$ORIGIN\",\"ttlSeconds\":300}")"
TOKEN="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["token"])' <<<"$SESSION")"
node "$PROJECT_DIR/network/test/e2e-runner.mjs" \
  --root="$PROJECT_DIR" --port="$WEB_PORT" \
  --gateway="ws://127.0.0.1:$PORT/v1/ethernet" --token="$TOKEN"
