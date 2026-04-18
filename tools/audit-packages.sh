#!/usr/bin/env bash
# Checks every `Directory.Packages.props` entry against the NuGet feed.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PROPS="$REPO_ROOT/Directory.Packages.props"

echo "=== Dbsp package audit ==="
printf "%-35s %-15s %-15s %s\n" "Package" "Pinned" "Latest" "Status"
printf "%-35s %-15s %-15s %s\n" "-------" "------" "------" "------"

pkgs=$(grep -oE 'PackageVersion Include="[^"]+" Version="[^"]+"' "$PROPS" \
  | sed -E 's/PackageVersion Include="([^"]+)" Version="([^"]+)"/\1|\2/')

status=0
while IFS= read -r line; do
  [ -z "$line" ] && continue
  pkg="${line%%|*}"
  pinned="${line##*|}"
  # `dotnet package search <id> --exact-match` prints a table with the
  # "Latest Version" column at column N — pull with awk on the data row.
  # `dotnet package search` prints a markdown-ish table with pipe-
  # separated columns. Grab the last version row that matches the
  # exact id (final table entry is the latest version).
  latest=$(dotnet package search "$pkg" --exact-match 2>/dev/null \
    | awk -F'|' -v p="$pkg" '
        $2 ~ p {
          # trim the version column and remember the last one
          gsub(/^[ \t]+|[ \t]+$/, "", $3)
          v = $3
        }
        END { if (v != "") print v }')
  latest="${latest:-?}"

  if [ "$latest" = "$pinned" ]; then
    marker="✓ up-to-date"
  elif [ "$latest" = "?" ]; then
    marker="? couldn't query"
  else
    marker="⚠ bump available"
    status=1
  fi
  printf "%-35s %-15s %-15s %s\n" "$pkg" "$pinned" "$latest" "$marker"
done <<< "$pkgs"

echo ""
if [ $status -eq 0 ]; then
  echo "✓ All queryable packages on latest."
else
  echo "⚠ Bumps available — update Directory.Packages.props and re-run tests."
fi
