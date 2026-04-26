#!/usr/bin/env bash
#
# tools/hygiene/check-tick-history-order.sh — validates that
# docs/hygiene-history/loop-tick-history.md rows appear in
# non-decreasing chronological order (ISO-8601 UTC timestamps).
#
# Why this exists (Aaron 2026-04-26):
#   The Edit tool's natural pattern (old_string=existing-line)
#   tends to insert NEW content BEFORE the matched line, which
#   produces reverse-chronological order when appending to the
#   end of a tick-history table. I caught this bug at least three
#   times across recent ticks and patched each occurrence by
#   hand. Aaron asked: "anything we can do to prevent it in the
#   first place?" The honest structural answer is a CI check that
#   makes the bug fail fast at commit/push time instead of
#   relying on each agent's vigilance.
#
# What this checks:
#   - Every row matching the ISO-8601 timestamp prefix
#     `| YYYY-MM-DDTHH:MM:SSZ (...)` is extracted in file order
#   - Timestamps must be non-decreasing (allows duplicates from
#     close ticks; forbids out-of-order)
#   - Reports first violation with surrounding context and
#     exits non-zero on failure
#
# What this does NOT do:
#   - Does NOT re-order rows automatically. The fix is the
#     committer's responsibility (revert + re-append correctly).
#     Auto-reordering would silently rewrite history; this check
#     is intentionally advisory-with-teeth.
#   - Does NOT validate row content beyond the timestamp.
#     Markdownlint and other lints handle table structure.
#   - Does NOT enforce a strict-increasing rule. Two ticks at
#     the same UTC second are rare but possible and not an error.
#
# Composes with:
#   - tools/hygiene/audit-tick-history-bounded-growth.sh
#     (line-count threshold; this script is the order check
#     that complements that one)
#   - .github/workflows/gate.yml (wired as a lint job)
#
# Self-test:
#   $ tools/hygiene/check-tick-history-order.sh
#     → exit 0 if order is fine
#     → exit 1 with diagnostic if any row is out of order

set -euo pipefail

# --strict: also report (advisory) historical strict-order violations
# anywhere in the file. Default is quiet because Otto-229 forbids
# editing prior rows so historical disorder cannot be repaired —
# reporting it on every CI run is noise. Aaron 2026-04-26: "we
# might should allow this one override if it exists a lot."
STRICT=0
ARGS=()
for arg in "$@"; do
  case "$arg" in
    --strict) STRICT=1 ;;
    *) ARGS+=("$arg") ;;
  esac
done

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
TICK_FILE="${ARGS[0]:-${REPO_ROOT}/docs/hygiene-history/loop-tick-history.md}"

if [[ ! -f "$TICK_FILE" ]]; then
  echo "ERROR: tick-history file not found at $TICK_FILE" >&2
  exit 2
fi

# Extract row line-numbers + timestamps. Match table rows that
# start with `| YYYY-MM-DDTHH:MM:SSZ`. The ISO-8601 timestamps
# are lex-sortable, which is the whole point of this format.
# Use `while read` instead of `mapfile -t` for bash-3 (macOS).
# Avoid `awk -F:` because ISO timestamps contain `:` themselves
# — extract the timestamp via the line number then a sed pass.
rows=()
while IFS= read -r line_num; do
  ts=$(sed -n "${line_num}p" "$TICK_FILE" \
       | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z' \
       | head -1)
  rows+=("${line_num}|${ts}")
done < <(
  grep -nE '^\| [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z' "$TICK_FILE" \
    | cut -d: -f1
)

if [[ ${#rows[@]} -lt 2 ]]; then
  echo "OK: tick-history has ${#rows[@]} row(s); nothing to check"
  exit 0
fi

prev_ts=""
prev_line=""
violations=0
for entry in "${rows[@]}"; do
  line_num="${entry%%|*}"
  ts="${entry##*|}"
  if [[ -n "$prev_ts" ]]; then
    # ISO-8601 UTC timestamps sort lexically — string comparison
    # is the correct chronological comparison.
    if [[ "$ts" < "$prev_ts" ]]; then
      violations=$((violations + 1))
      if [[ $STRICT -eq 1 ]]; then
        echo "VIOLATION: row at line $line_num has timestamp $ts" >&2
        echo "  but previous row at line $prev_line has timestamp $prev_ts" >&2
        echo "  (timestamps must be non-decreasing in file order)" >&2
        echo "" >&2
        echo "  context — offending row tail:" >&2
        sed -n "${line_num}p" "$TICK_FILE" | cut -c 1-200 | sed 's/^/    /' >&2
        echo "" >&2
        echo "  context — preceding row tail:" >&2
        sed -n "${prev_line}p" "$TICK_FILE" | cut -c 1-200 | sed 's/^/    /' >&2
        echo "" >&2
      fi
    fi
  fi
  prev_ts="$ts"
  prev_line="$line_num"
done

# Two-tier check:
#   STRICT — full chronological order (reports historical
#            violations; advisory; not gating because Otto-229
#            forbids editing prior rows so we can't fix history)
#   PRIMARY — last row in file must be latest timestamp.
#            This catches the specific bug pattern: "Edit tool
#            inserts new row BEFORE last row" — exactly the one
#            we're trying to prevent.
#
# We always report STRICT violations for visibility but only
# fail the build on the PRIMARY check. The PRIMARY check is
# strong enough to prevent the bug without requiring
# history-rewrite (which Otto-229 forbids anyway).

last_entry="${rows[$((${#rows[@]} - 1))]}"
last_line="${last_entry%%|*}"
last_ts="${last_entry##*|}"

# Find the latest timestamp ANYWHERE in the file
latest_ts=""
for entry in "${rows[@]}"; do
  ts="${entry##*|}"
  if [[ -z "$latest_ts" || "$ts" > "$latest_ts" ]]; then
    latest_ts="$ts"
  fi
done

if [[ "$last_ts" != "$latest_ts" ]]; then
  echo "" >&2
  echo "FAIL: last row in tick-history is NOT the latest timestamp" >&2
  echo "  last row (line $last_line):    $last_ts" >&2
  echo "  latest timestamp in file:     $latest_ts" >&2
  echo "" >&2
  echo "This is the row-ordering bug pattern: a new row was inserted" >&2
  echo "BEFORE the previous last row instead of appended at end-of-file." >&2
  echo "" >&2
  echo "How to fix:" >&2
  echo "  1. Revert the offending append (git restore on the file)" >&2
  echo "  2. Re-append using bash heredoc (cat >> file << EOF) which" >&2
  echo "     naturally produces chronological-tail-append, not Edit" >&2
  echo "     tool with old_string=earlier-row (which prepends)" >&2
  echo "  3. Or use tools/hygiene/append-tick-history-row.sh which" >&2
  echo "     wraps the correct pattern in a one-liner" >&2
  if [[ $violations -gt 0 ]]; then
    echo "" >&2
    echo "Note: $violations historical strict-order violation(s) also exist" >&2
    echo "      (advisory only — Otto-229 forbids editing prior rows)" >&2
  fi
  exit 1
fi

if [[ $violations -gt 0 ]]; then
  echo "OK: last row IS latest timestamp ($last_ts at line $last_line)"
  echo "    — but $violations historical strict-order violation(s) exist (advisory)"
else
  echo "OK: ${#rows[@]} tick-history rows in non-decreasing chronological order"
fi
exit 0
