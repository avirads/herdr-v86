#!/usr/bin/env bash
set -euo pipefail

# Compatibility entry point. The former single network image is now the
# cumulative AI Tools tier; use build-tier-images.sh all for every tier.
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
exec bash "$SCRIPT_DIR/build-tier-images.sh" ai-tools
