#!/usr/bin/env bash
# tools/hygiene/audit-memory-references.sh
#
# Detects broken memory-file references in `memory/MEMORY.md`:
# every `](foo.md)` link target MUST resolve to an actual
# file under `memory/`. Amara's 4th-ferry (PR #221 absorb)
# named this as a Determinize-stage item:
#
#   "inferred paths instead of verified paths, inferred gates
#    instead of verified gates, prose summaries that are not
#    reconciled against live sources..."
#
# Her commit samples show repeated cleanup passes for
# "memory paths that didn't exist" — the class this tool
# prevents from regressing.
#
# Sibling to:
#   - tools/hygiene/audit-memory-index-duplicates.sh (AceHack
#     PR #12, pending Aaron merge) — same-pattern lint for
#     duplicate targets
#   - .github/workflows/memory-index-integrity.yml (LFG PR
#     #220, merged) — same-commit-pairing between memory/*.md
#     changes and memory/MEMORY.md updates
#
# Together they form three-part memory-index hygiene:
#   1. Every memory file change updates MEMORY.md (#220)
#   2. MEMORY.md has no duplicate link targets (#12)
#   3. Every MEMORY.md link target resolves to an actual
#      file (this tool)
#
# Usage:
#   tools/hygiene/audit-memory-references.sh                 # default: memory/MEMORY.md
#   tools/hygiene/audit-memory-references.sh --file PATH     # custom file
#   tools/hygiene/audit-memory-references.sh --base DIR      # base dir for resolution (default: memory/)
#   tools/hygiene/audit-memory-references.sh --enforce       # exit 2 on any broken ref
#
# Exit codes:
#   0 — all references resolve (or --enforce not set)
#   2 — broken references found and --enforce set

set -euo pipefail

target="memory/MEMORY.md"
base_dir="memory"
enforce=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file)
      if [[ -z "${2:-}" ]]; then
        echo "error: --file requires a path" >&2
        exit 64
      fi
      target="$2"
      shift 2
      ;;
    --base)
      if [[ -z "${2:-}" ]]; then
        echo "error: --base requires a directory" >&2
        exit 64
      fi
      base_dir="$2"
      shift 2
      ;;
    --enforce)
      enforce=true
      shift
      ;;
    -h|--help)
      grep '^#' "$0" | grep -v '^#!' | sed 's/^# //;s/^#//'
      exit 0
      ;;
    *)
      echo "unknown arg: $1" >&2
      exit 64
      ;;
  esac
done

if [[ ! -f "$target" ]]; then
  echo "error: target file not found: $target" >&2
  exit 64
fi

if [[ ! -d "$base_dir" ]]; then
  echo "error: base directory not found: $base_dir" >&2
  exit 64
fi

# Extract link targets of the form `](foo.md)` or `](subdir/foo.md)`
# matching a memory-index-entry shape (relative paths ending in .md).
# We deliberately scope to relative paths; absolute http(s) URLs are
# out of scope (they're external refs, not memory-file pointers).
refs=$(grep -oE '\]\([a-zA-Z_0-9./-]+\.md\)' "$target" \
       | sed 's|^](||; s|)$||' \
       | sort -u || true)

if [[ -z "$refs" ]]; then
  echo "no memory-index link targets in $target; nothing to check" >&2
  exit 0
fi

broken=""
ok_count=0
while IFS= read -r ref; do
  # Resolve in two passes:
  # 1. file-relative (standard markdown): base_dir/ref
  # 2. workspace-root (legacy convention): ref directly
  # Accept either — both forms are in use across MEMORY.md history; the
  # standard-markdown form is preferred for browser/IDE rendering, the
  # workspace-root form is preferred for grep/audit tooling. Codex flagged
  # the discrepancy on PR #506; this dual-resolution unblocks both.
  full_filerel="$base_dir/$ref"
  if [[ -f "$full_filerel" ]]; then
    ok_count=$((ok_count + 1))
  elif [[ "$ref" == */* ]] && [[ -f "$ref" ]]; then
    ok_count=$((ok_count + 1))
  else
    broken+="  $ref -> $full_filerel (not found)"$'\n'
  fi
done <<< "$refs"

total=$(wc -l <<< "$refs" | tr -d ' ')

echo "memory-reference audit on $target" >&2
echo "  base dir: $base_dir" >&2
echo "  refs checked: $total" >&2
echo "  resolved:     $ok_count" >&2

if [[ -z "$broken" ]]; then
  echo "  broken:       0" >&2
  echo "" >&2
  echo "all memory-index link targets resolve to existing files" >&2
  exit 0
fi

broken_count=$((total - ok_count))

echo "  broken:       $broken_count" >&2
echo "" >&2
echo "broken references:" >&2
echo "" >&2
printf '%s' "$broken" >&2
echo "" >&2
echo "These link targets in $target do not resolve to files" >&2
echo "under $base_dir/. Either the file was renamed / moved /" >&2
echo "deleted, or the path was typed incorrectly at index-add time." >&2
echo "" >&2
echo "To fix: either restore the file, correct the path, or" >&2
echo "remove the broken row from the index." >&2

if $enforce; then
  exit 2
fi

exit 0
