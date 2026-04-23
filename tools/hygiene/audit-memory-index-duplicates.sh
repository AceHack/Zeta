#!/usr/bin/env bash
# tools/hygiene/audit-memory-index-duplicates.sh
#
# Detects duplicate link targets (same `.md` file referenced
# more than once) in a MEMORY.md-shaped index. Amara's 2026-
# 04-23 decision-proxy + technical review (PR #219) flagged
# the pattern: an index with duplicate entries is a
# discoverability defect — fresh sessions can't tell which
# entry is authoritative; external reviewers miss the newest-
# first ordering because duplicates break the implicit
# "one row per memory" invariant.
#
# Companion to:
#   - `.github/workflows/memory-index-integrity.yml` — checks
#     that every memory/*.md change also updates MEMORY.md.
#     This tool checks that MEMORY.md doesn't list the same
#     file twice.
#   - FACTORY-HYGIENE row #11 (MEMORY.md cap enforcement) —
#     this tool is the extension Amara named.
#
# Detection strategy:
#   Grep for link targets matching `[text](filename.md)`
#   at the index level (outside code blocks / other noise).
#   Tally by filename. Any count > 1 is a duplicate.
#
#   This catches:
#     - Exact duplicate entries (same file linked twice)
#     - Old + new pointer to same file (forgot to dedupe
#       after an edit)
#
#   This does NOT catch:
#     - Substantially similar descriptions of different
#       files (that's a judgment call requiring content
#       review, not a mechanical check)
#     - External links (http://...) — deliberately scoped
#       to in-repo memory files
#
# Usage:
#   tools/hygiene/audit-memory-index-duplicates.sh              # in-repo memory/MEMORY.md
#   tools/hygiene/audit-memory-index-duplicates.sh --file PATH  # custom path
#   tools/hygiene/audit-memory-index-duplicates.sh --enforce    # exit 2 on any dup
#
# Exit codes:
#   0 — no duplicates (or --enforce not set)
#   2 — duplicates found and --enforce set

set -euo pipefail

target="memory/MEMORY.md"
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

# Extract link targets: anything of the form `](foo.md)` where
# foo.md matches a memory-index entry shape. Tally by target.
dups=$(grep -oE '\]\([a-zA-Z_0-9./-]+\.md\)' "$target" \
       | sort | uniq -c | sort -rn | awk '$1 > 1')

if [[ -z "$dups" ]]; then
  echo "no duplicate memory-index links in $target" >&2
  exit 0
fi

echo "duplicate memory-index links in $target:" >&2
echo "" >&2
printf '  count  target\n' >&2
printf '  -----  ------\n' >&2
echo "$dups" >&2
echo "" >&2
echo "Each row shows how many times the target appears." >&2
echo "Expected: every in-repo memory file listed exactly once" >&2
echo "in newest-first order. Duplicates typically mean an" >&2
echo "edit pass added a new pointer without removing the old." >&2
echo "" >&2
echo "To fix: open $target and remove the older entry for each" >&2
echo "duplicated target, keeping the newest-first-ordered one." >&2

if $enforce; then
  exit 2
fi

exit 0
