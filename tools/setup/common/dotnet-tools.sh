#!/usr/bin/env bash
#
# tools/setup/common/dotnet-tools.sh — installs/updates dotnet global
# tools from the manifest. Idempotent: `dotnet tool install --global`
# on an already-installed tool errors, so we branch on `dotnet tool
# list -g`.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
MANIFEST="$REPO_ROOT/tools/setup/manifests/dotnet-tools"

if [ ! -f "$MANIFEST" ]; then
  echo "✓ no dotnet-tools manifest; skipping"
  exit 0
fi

if ! command -v dotnet >/dev/null 2>&1; then
  echo "error: dotnet not on PATH (mise should have put it there)"
  exit 1
fi

# Cache the current global-tool listing once. `dotnet tool list -g`
# prints a two-line header (`Package Id ... Version ... Commands`)
# followed by rows starting with the (lowercase) package id and
# whitespace. We extract just the first column from rows after the
# header; the grep below is exact-match against that set so tools
# sharing a name prefix (dotnet-ef vs dotnet-ef-tools) don't collide.
INSTALLED="$(dotnet tool list -g 2>/dev/null | awk 'NR>2 {print tolower($1)}' || echo '')"

MANIFEST_LINES="$(mktemp)"
trap 'rm -f "$MANIFEST_LINES"' EXIT
awk '
  { sub(/#.*$/, ""); gsub(/^[[:space:]]+|[[:space:]]+$/, "") }
  NF > 0 { print }
' "$MANIFEST" > "$MANIFEST_LINES"

while IFS= read -r line || [ -n "$line" ]; do
  # Manifest lines are "<tool> <version>" or just "<tool>".
  tool="$(echo "$line" | awk '{print $1}')"
  version="$(echo "$line" | awk '{print $2}')"
  tool_lc="$(echo "$tool" | tr '[:upper:]' '[:lower:]')"
  if echo "$INSTALLED" | grep -Fxq "$tool_lc"; then
    if [ -n "$version" ]; then
      dotnet tool update -g "$tool" --version "$version" >/dev/null 2>&1 || true
    else
      dotnet tool update -g "$tool" >/dev/null 2>&1 || true
    fi
    echo "✓ $tool already installed; updated if possible"
  else
    if [ -n "$version" ]; then
      dotnet tool install -g "$tool" --version "$version"
    else
      dotnet tool install -g "$tool"
    fi
    echo "✓ $tool installed"
  fi
done < "$MANIFEST_LINES"

echo "✓ dotnet global tools up to date"
