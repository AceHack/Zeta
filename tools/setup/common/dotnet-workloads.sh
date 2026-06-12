#!/usr/bin/env bash
#
# tools/setup/common/dotnet-workloads.sh — installs dotnet WORKLOADS from
# manifests/dotnet-workloads and brings installed ones to latest. Sibling of
# dotnet-tools.sh; same idempotent shape. SDK selection itself stays declarative
# in global.json (rollForward: latestFeature).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/tools/setup/manifests/dotnet-workloads"

if ! command -v dotnet >/dev/null 2>&1; then
  echo "error: dotnet not on PATH (mise should have put it there)"
  exit 1
fi

if [ -f "$MANIFEST" ]; then
  MANIFEST_LINES="$(mktemp)"
  trap 'rm -f "$MANIFEST_LINES"' EXIT
  awk '
    { sub(/#.*$/, ""); gsub(/^[[:space:]]+|[[:space:]]+$/, "") }
    NF > 0 { print }
  ' "$MANIFEST" > "$MANIFEST_LINES"

  while IFS= read -r workload || [ -n "$workload" ]; do
    workload="$(echo "$workload" | awk '{print $1}')"
    [ -z "$workload" ] && continue
    echo "↓ dotnet workload install $workload..."
    dotnet workload install "$workload" --skip-sign-check 2>/dev/null \
      || dotnet workload install "$workload"
  done < "$MANIFEST_LINES"
fi

# Bring whatever is installed up to the SDK's matching versions (no-op when none).
echo "↻ dotnet workload update..."
dotnet workload update >/dev/null 2>&1 || echo "  (workload update skipped: $?)"
echo "✓ dotnet workloads in sync"
