#!/usr/bin/env bash
# SHIM — the infinite-loop pattern is now handled by launchd/systemd via the
# unified service system. This script exists for backward compatibility only.
#
# New installations:
#   bun src/Core.TypeScript/service/service-manager-cli.ts install --persona lior
#
# The service manager installs a launchd plist (macOS) or systemd timer (Linux)
# that calls `bun loop-tick.ts --persona lior` every 60 seconds. No infinite
# loop shell script needed.

set -euo pipefail
export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$HOME/.bun/bin"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

exec bun "$REPO_ROOT/src/Core.TypeScript/service/loop-tick.ts" --persona lior
