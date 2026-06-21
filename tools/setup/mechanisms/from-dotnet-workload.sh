#!/usr/bin/env bash
#
# tools/setup/mechanisms/from-dotnet-workload.sh — installs dotnet WORKLOADS from
# manifests/from-dotnet-workload and brings installed ones to latest. Sibling of
# dotnet-tools.sh; same idempotent shape. SDK selection itself stays declarative
# in global.json (rollForward: latestFeature).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/tools/setup/manifests/from-dotnet-workload"

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

# Bring installed workloads to the SDK's matching versions — ONLY when something is actually
# installed. `dotnet workload update` is NOT a local no-op on an empty machine: it resolves
# workload manifests over NuGet, and on a constrained runner that network stall can hang the
# whole install step (live failure 2026-06-12: the low-memory CI lane wedged twice at 20-65min
# inside install.sh on this line, with output swallowed so the hang was invisible). Skip-by-
# default unless we positively see an installed workload or this run just installed one.
manifest_entries=0
if [ -f "$MANIFEST" ]; then
  manifest_entries="$(grep -cvE '^(#|$)' "$MANIFEST" || true)"
fi
# installed = any table row between the dashed header and the next blank line ("no installed
# workloads" sentinel text varies by SDK; the empty table is the stable signal).
installed_count="$(dotnet workload list 2>/dev/null | awk '/^-+$/{t=1;next} t&&NF{c++} t&&!NF{t=0} END{print c+0}')"
if [ "$manifest_entries" -gt 0 ] || [ "$installed_count" -gt 0 ]; then
  echo "↻ dotnet workload update..."
  dotnet workload update || echo "  (workload update failed: $? — not fatal; manifests stay pinned by global.json)"
else
  echo "✓ no workloads installed and manifest empty — skipping workload update (no idle network call)"
fi
echo "✓ dotnet workloads in sync"
