#!/usr/bin/env bash
# tools/hygiene/audit-machine-specific-content.sh
#
# Scans in-repo content for machine-specific patterns that
# should not appear in a portable factory substrate:
#
# - User-home paths: /Users/<username>/... , /home/<username>/...
# - Claude Code harness paths: ~/.claude/projects/<slug>/...
# - Other machine-name or hostname leaks
#
# Part of FACTORY-HYGIENE row #55 (machine-specific content
# scrubber) per Aaron 2026-04-23 Otto-27:
#
# > we can have a machine specific scrubber/lint hygene task
# > for anyting that makes it in by default. just run on a
# > cadence.
#
# Not a prevention-gate yet (detect-only first per row #23 +
# #47 pattern). Cadenced fire surfaces gaps; author-time
# remediation lands as opportunistic cleanup.
#
# Usage:
#   tools/hygiene/audit-machine-specific-content.sh          # summary
#   tools/hygiene/audit-machine-specific-content.sh --list   # list offending files
#   tools/hygiene/audit-machine-specific-content.sh --enforce # exit 2 on any gap
#
# Exit codes:
#   0 — no machine-specific content detected (or --enforce not set and gaps found)
#   2 — gaps found and --enforce was set

set -euo pipefail

mode="${1:-summary}"

# Patterns that indicate machine-specific content leakage.
# Each pattern is a grep -E extended regex.
patterns=(
  '/Users/[a-zA-Z0-9._-]+/'       # macOS home paths
  '/home/[a-zA-Z0-9._-]+/'        # Linux home paths
  'C:\\Users\\[a-zA-Z0-9._-]+'    # Windows home paths
  'C:/Users/[a-zA-Z0-9._-]+'      # Windows home paths (forward-slash form)
)

# Paths to audit. In-repo content only (tracked files).
# Exclude: historical docs that intentionally reference paths
# (ROUND-HISTORY, tick-history, fire-history files preserve
# their history verbatim per append-only discipline).
exclude_patterns=(
  'docs/ROUND-HISTORY.md'
  'docs/hygiene-history/'
  'docs/DECISIONS/'         # ADRs preserve their historical context
  'tools/hygiene/audit-machine-specific-content.sh'  # self (patterns are examples)
)

# Get all tracked files, filter out exclusions.
tracked_files=$(git ls-files)

# Build exclusion grep
exclude_grep=""
for p in "${exclude_patterns[@]}"; do
  if [[ -n "$exclude_grep" ]]; then
    exclude_grep+="|"
  fi
  exclude_grep+="$p"
done

files_to_check=$(echo "$tracked_files" | grep -vE "$exclude_grep" || true)

# Count gaps
gap_count=0
gap_files=()

for pattern in "${patterns[@]}"; do
  while IFS= read -r file; do
    [[ -z "$file" ]] && continue
    if grep -l -E "$pattern" "$file" > /dev/null 2>&1; then
      gap_files+=("$file:$pattern")
      gap_count=$((gap_count + 1))
    fi
  done <<< "$files_to_check"
done

# Report
case "$mode" in
  --list)
    if (( gap_count > 0 )); then
      printf '%s\n' "${gap_files[@]}"
    fi
    ;;
  --enforce)
    if (( gap_count > 0 )); then
      echo "machine-specific content gaps: $gap_count"
      printf '  %s\n' "${gap_files[@]}"
      exit 2
    fi
    echo "machine-specific content gaps: 0 (clean)"
    ;;
  *)
    if (( gap_count > 0 )); then
      echo "machine-specific content gaps: $gap_count"
      echo "run with --list to see offending files"
    else
      echo "machine-specific content gaps: 0 (clean)"
    fi
    ;;
esac
