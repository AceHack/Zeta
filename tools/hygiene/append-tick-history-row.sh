#!/usr/bin/env bash
#
# tools/hygiene/append-tick-history-row.sh — appends a row to
# docs/hygiene-history/loop-tick-history.md using bash heredoc
# (which naturally produces chronological tail-append).
#
# Why this exists (Aaron 2026-04-26):
#   The Edit-tool default with old_string=existing-line tends to
#   insert NEW content BEFORE the matched line, producing
#   reverse-chronological order. This script wraps the correct
#   pattern (`cat >> file`) so the bug shape can't occur via this
#   entrypoint.
#
# Usage:
#   tools/hygiene/append-tick-history-row.sh "FULL_ROW_TEXT"
#
# The argument is the entire row including leading `| ` and
# trailing `|`. Caller is responsible for row content; this
# script is dumb-pipe.
#
# What this validates:
#   - Argument starts with `| YYYY-MM-DDTHH:MM:SSZ (`
#   - The timestamp is >= the latest existing row timestamp
#     (otherwise reject — chronological discipline)
#
# What this does NOT do:
#   - Does NOT format the row for you. The caller decides
#     content (this is signal-in-signal-out per
#     memory/feedback_signal_in_signal_out_clean_or_better_dsp_discipline.md)
#   - Does NOT commit. The caller stages + commits.
#
# Composes with:
#   - tools/hygiene/check-tick-history-order.sh (CI gate
#     that catches violations from any append path, not
#     just this one)

set -euo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: $0 \"<full row text including leading | and trailing |>\"" >&2
  exit 2
fi

ROW="$1"
REPO_ROOT="$(git rev-parse --show-toplevel)"
TICK_FILE="${REPO_ROOT}/docs/hygiene-history/loop-tick-history.md"

# Extract candidate timestamp from row
if [[ ! "$ROW" =~ ^\|\ ([0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z) ]]; then
  echo "ERROR: row must start with '| YYYY-MM-DDTHH:MM:SSZ '" >&2
  echo "got: ${ROW:0:80}..." >&2
  exit 1
fi
NEW_TS="${BASH_REMATCH[1]}"

# Find latest existing timestamp
LATEST_TS=$(
  grep -oE '^\| [0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z' "$TICK_FILE" \
    | sed 's/^| //' \
    | sort \
    | tail -1
)

if [[ -n "$LATEST_TS" && "$NEW_TS" < "$LATEST_TS" ]]; then
  echo "ERROR: new row timestamp $NEW_TS is BEFORE latest existing $LATEST_TS" >&2
  echo "" >&2
  echo "Tick-history is append-only with non-decreasing timestamps." >&2
  echo "If your row is for a past tick, you have to either:" >&2
  echo "  (a) update the timestamp to current UTC (preferred)," >&2
  echo "  (b) file an ADR explaining the back-dated correction" >&2
  echo "      and use a correction-row pattern per Otto-229." >&2
  exit 1
fi

# Append using heredoc (the whole point of this script — bash
# heredoc is the canonical chronological-tail-append pattern)
cat >> "$TICK_FILE" << EOF
$ROW
EOF

echo "OK: appended row at $NEW_TS"
