#!/usr/bin/env bash
# tools/hygiene/audit-memory-index-duplicates.sh
#
# Detects duplicate link targets (same `.md` file referenced
# more than once) in a MEMORY.md-shaped index. An index with
# duplicate entries is a discoverability defect — fresh
# sessions can't tell which entry is authoritative; external
# reviewers miss the newest-first ordering because duplicates
# break the implicit "one row per memory" invariant.
#
# Companion to:
#   - `.github/workflows/memory-index-integrity.yml` — checks
#     that every memory/*.md change also updates MEMORY.md.
#     This tool checks that MEMORY.md doesn't list the same
#     file twice.
#   - FACTORY-HYGIENE row #11 (MEMORY.md cap enforcement) —
#     this tool extends that cap discipline to also enforce
#     no-duplicate-entries.
#
# Detection strategy:
#   Line-grep the target file for `](filename.md)` link
#   targets, normalize equivalent paths (strip leading
#   `./`), tally by normalized filename. Any count > 1 is
#   a duplicate.
#
#   This catches:
#     - Exact duplicate entries (same file linked twice)
#     - Old + new pointer to same file (forgot to dedupe
#       after an edit)
#     - Equivalent paths that look different
#       (`feedback_x.md` vs `./feedback_x.md`)
#
#   This does NOT catch:
#     - Substantially similar descriptions of different
#       files (judgment call requiring content review,
#       not a mechanical check).
#     - External links (http://...) — the regex requires
#       a `.md` suffix and excludes URL characters, so
#       in practice only repo-local `.md` link targets
#       match.
#     - `.md` link targets inside fenced code blocks —
#       the grep is line-level, not block-aware. This is
#       acceptable because the intended target
#       (`memory/MEMORY.md` — a flat link list) does not
#       use fenced code blocks. If applied to a target
#       file that does, false positives are possible;
#       for that case the caller should pre-strip code
#       fences.
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
# foo.md matches a memory-index entry shape. Normalize equivalent
# paths (`./feedback_x.md` -> `feedback_x.md`) so duplicates that
# differ only in the `./` prefix get tallied together. Then tally
# by normalized target.
#
# `grep || true` swallows the no-match exit (status 1) under
# `set -euo pipefail` — without it, an empty / link-free target
# file would abort the script before the empty-result check
# below.
dups=$( { grep -oE '\]\([a-zA-Z_0-9./-]+\.md\)' "$target" || true; } \
       | sed 's|\](\./|](|' \
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
