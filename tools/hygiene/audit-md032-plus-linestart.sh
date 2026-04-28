#!/usr/bin/env bash
# tools/hygiene/audit-md032-plus-linestart.sh
#
# Detects markdown files where a line starts with `+ ` inside
# a paragraph (no blank line above, previous line is not itself
# a `+ `-list continuation) — the pattern that markdownlint
# MD032 treats as "list item missing blank line" and that caused
# Otto-35 + Otto-38 regressions in the autonomous-loop session
# 2026-04-23.
#
# The pattern triggers when an author writes prose continuation
# like:
#
#   Full treatment in the DBSP paper
#   + `docs/ARCHITECTURE.md` §operator-algebra.
#
# Markdownlint parses the second line as an unordered list
# item (unexpectedly) and flags MD032 ("list not surrounded
# by blank lines"). The author-time fix is to use "and" or
# similar continuation instead of `+`.
#
# Post-setup stack: bash scaffolding — the audit ships under
# `tools/hygiene/` and has to exist in bash while the bun+TS
# post-setup migration is mid-flight (same exception as
# `audit-cross-platform-parity.sh`, `audit-missing-prevention-
# layers.sh`, and `audit-post-setup-script-stack.sh`). Queued
# for bun+TS migration alongside them in docs/BACKLOG.md.
#
# Detection shape (CommonMark-aware):
#   * Scans each line matching `^ {0,3}\+ ` (CommonMark allows
#     up to 3 leading spaces on list-marker lines).
#   * Flags a gap only when the previous line is **not blank**
#     (after stripping all whitespace: spaces, tabs, CR) **and**
#     the previous line is itself **not** a `^ {0,3}\+ ` line
#     (a contiguous list is not a gap).
#   * No file-level skip heuristic — every candidate line is
#     judged on its own per-line context, so files that mostly
#     use `+` as a list marker still get checked for stray
#     prose-continuation `+`.
#
# FACTORY-HYGIENE row #56 (cadenced on-touch + round-cadence).
#
# Usage:
#   tools/hygiene/audit-md032-plus-linestart.sh              # summary
#   tools/hygiene/audit-md032-plus-linestart.sh --list       # list offending lines
#   tools/hygiene/audit-md032-plus-linestart.sh --enforce    # exit 2 on any gap
#
# Exit codes:
#   0 — no offending `+ `-at-line-start patterns (or --enforce
#       not set and gaps found)
#   2 — gaps found and --enforce was set

set -euo pipefail

mode="${1:-summary}"

# Resolve every markdown path from the repo root, not from the
# caller's current directory. `git ls-files` emits paths relative
# to the repo root regardless of $PWD, so we cd there before
# reading files. Staying at repo-root also keeps `sed` / `read`
# paths consistent if the caller invokes the script from a sub-
# directory.
repo_root=$(git rev-parse --show-toplevel)
cd "$repo_root"

# Exclusion: audit-trail surfaces whose `+ `-at-line-start lines
# are historical record, not fixable. Also self-exclude.
exclude_pattern='^(docs/ROUND-HISTORY\.md|docs/hygiene-history/|docs/DECISIONS/|tools/hygiene/audit-md032-plus-linestart\.sh)'

gap_count=0
gap_lines=()

# Match CommonMark-compliant `+ `-list-marker lines: up to 3
# leading spaces allowed before the `+ ` token. Used both for
# "is this line a candidate?" and "is the previous line a list
# continuation?" checks.
plus_marker_re='^ {0,3}\+ '

# Iterate tracked `.md` files via NUL-delimited read — matches
# the sibling hygiene-script convention (audit-cross-platform-
# parity.sh, audit-post-setup-script-stack.sh) and is safe for
# paths containing spaces / tabs / newlines.
while IFS= read -r -d '' file; do
  if [[ "$file" =~ $exclude_pattern ]]; then
    continue
  fi

  # Read the whole file into an array once — avoids an O(N) `sed`
  # per candidate line, and makes the "previous line" lookup a
  # plain array index. Uses a `while read` loop rather than
  # `mapfile` so the script runs on macOS bash 3.2 (no `mapfile`)
  # in addition to Linux bash 4+. A trailing IFS=$'\n' read may
  # miss a file whose last line has no newline, so we also
  # capture any trailing partial line.
  lines=()
  while IFS= read -r line || [[ -n "$line" ]]; do
    lines+=("$line")
  done < "$file"

  lineno=0
  for line in "${lines[@]}"; do
    lineno=$((lineno + 1))

    # Candidate: `^ {0,3}\+ ` anywhere in the file.
    if [[ ! "$line" =~ $plus_marker_re ]]; then
      continue
    fi

    # First line of file can't have a non-blank predecessor.
    if (( lineno == 1 )); then
      continue
    fi

    prev_line="${lines[lineno - 2]}"

    # Strip ALL whitespace (spaces, tabs, carriage returns) to
    # decide if the previous line is "blank" in markdownlint's
    # sense. Tab-only or CR-only lines count as blank.
    prev_stripped="${prev_line//[[:space:]]/}"
    if [[ -z "$prev_stripped" ]]; then
      continue
    fi

    # Contiguous `+ `-list: previous line is itself a `+ `-marker
    # line. Not a gap — legitimate list continuation.
    if [[ "$prev_line" =~ $plus_marker_re ]]; then
      continue
    fi

    # MD032 risk: non-blank previous line that is not a list
    # continuation.
    gap_count=$((gap_count + 1))
    gap_lines+=("$file:$lineno")
  done
done < <(git ls-files -z '*.md')

case "$mode" in
  --list)
    if (( gap_count > 0 )); then
      printf '%s\n' "${gap_lines[@]}"
    fi
    ;;
  --enforce)
    if (( gap_count > 0 )); then
      echo "MD032 '+'-at-line-start gaps: $gap_count"
      printf '  %s\n' "${gap_lines[@]}"
      echo ""
      echo "Fix: replace '+' at line start with 'and' or similar prose"
      echo "continuation, OR add a blank line before the '+' to make it"
      echo "an intentional list (which markdownlint accepts)."
      exit 2
    fi
    echo "MD032 '+'-at-line-start gaps: 0 (clean)"
    ;;
  *)
    if (( gap_count > 0 )); then
      echo "MD032 '+'-at-line-start gaps: $gap_count"
      echo "run with --list to see offending file:line locations"
    else
      echo "MD032 '+'-at-line-start gaps: 0 (clean)"
    fi
    ;;
esac
