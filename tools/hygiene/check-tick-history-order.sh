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

# Always strict. The earlier --strict opt-in design was a
# self-deception: default-quiet on historical disorder was a
# noise-suppression cheat (Otto-341). Aaron 2026-04-26:
# *"ignoring them to make the noise go away is a selfish time
# saving effort... Adding an opt-in --strict mode; default is
# quiet on history."* — the second sentence quoted my decision
# back as the wrong move.
#
# The right move was to FIX historical disorder (Otto-229
# one-case override authorized: *"we have git history to keep
# us honest so no risk of permanat loss"*), which the same PR
# that ships this fix does — historical rows re-ordered to
# canonical chronological order; 5 exact-duplicate rows
# removed.
#
# Now default-strict: any out-of-order row fails the build.
# No opt-in suppression of any kind — Otto-341 forbids it.

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
TICK_FILE="${1:-${REPO_ROOT}/docs/hygiene-history/loop-tick-history.md}"

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
  prev_ts="$ts"
  prev_line="$line_num"
done

# Default-strict: ANY out-of-order row fails the build. There
# is no "advisory historical violation" tier — that was the
# Otto-341 self-deception design. If history is disordered,
# fix it (Otto-229 one-case override, justified because git
# preserves the audit trail).

if [[ $violations -gt 0 ]]; then
  echo "" >&2
  echo "FAIL: $violations row(s) out of chronological order in $TICK_FILE" >&2
  echo "" >&2
  echo "How to fix:" >&2
  echo "  - For NEW rows: revert and re-append using bash heredoc" >&2
  echo "    (cat >> file << EOF) or tools/hygiene/append-tick-history-row.sh" >&2
  echo "  - For HISTORICAL disorder: Otto-229 one-case override is" >&2
  echo "    authorized (Aaron 2026-04-26: 'we have git history to" >&2
  echo "    keep us honest so no risk of permanat loss'). Re-order" >&2
  echo "    rows physically; git preserves the prior state." >&2
  echo "  - Do NOT add an opt-in flag to suppress these violations." >&2
  echo "    That is the Otto-341 self-deception pattern Aaron caught." >&2
  exit 1
fi

echo "OK: ${#rows[@]} tick-history rows in non-decreasing chronological order"
exit 0
