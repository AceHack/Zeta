#!/usr/bin/env bash
#
# tools/hygiene/audit-tick-history-bounded-growth.sh — checks whether
# docs/hygiene-history/loop-tick-history.md is within its bounded-
# growth threshold.
#
# Ships the detection side of FACTORY-HYGIENE row #49. The prevention
# side is the archive-action the file header already documents
# ("first 80% of rows move to loop-tick-history-YYYY-QN-archive.md");
# this script does not archive, it only surfaces when archival is due.
#
# ─── Mini-ADR (inline decision record, per mini-ADR pattern) ──────
#   date:          2026-04-22
#   context:       Aaron flagged the file for unbounded growth; header
#                  stated 5000-line threshold; no enforcement existed;
#                  every tick-close reads the file for the append,
#                  paying a per-tick context cost that scales with
#                  file size.
#   decision:      Default threshold 500 lines (not 5000).
#   alternatives:  5000 (original paper bound) — rejected because
#                  read-every-tick cost makes the pain point arrive
#                  before the paper bound; 1000 (mid-option) — kept
#                  available via --threshold override; 0 (always
#                  warn) — rejected as noise.
#   supersedes:    The 5000-line number stated in
#                  docs/hygiene-history/loop-tick-history.md header
#                  ("Pruning is allowed ONCE the log exceeds ~5000
#                  lines"). File header updated in same commit.
#   expires-when:  (a) append-without-reading refactor lands — then
#                  per-tick cost stops scaling with file size and the
#                  threshold can rise back toward the paper bound,
#                  since the constraint becomes grep-ergonomics /
#                  storage rather than context burn; or (b) tick
#                  cadence changes materially; or (c) archive action
#                  itself gets automated, at which point the
#                  threshold becomes a rotation cadence rather than
#                  an alert.
# ──────────────────────────────────────────────────────────────────
#
# Self-referential note: this script is itself bash. Exception label:
# "bash scaffolding" per docs/POST-SETUP-SCRIPT-STACK.md Q3 — the
# hygiene tooling has to exist before bun+TS tooling ships. Queued
# for bun+TS migration alongside other hygiene audits in
# docs/BACKLOG.md "Migrate remaining bash audit scripts to bun +
# TypeScript".
#
# Usage:
#   tools/hygiene/audit-tick-history-bounded-growth.sh [--summary] [--threshold N]
#
# Exit codes:
#   0    file within threshold
#   1    usage error
#   2    threshold exceeded (archive action due)

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TARGET_FILE="$REPO_ROOT/docs/hygiene-history/loop-tick-history.md"
DEFAULT_THRESHOLD=500
THRESHOLD=$DEFAULT_THRESHOLD
SUMMARY=0

while [ $# -gt 0 ]; do
    case "$1" in
        --summary)
            SUMMARY=1
            shift
            ;;
        --threshold)
            if [ $# -lt 2 ]; then
                echo "error: --threshold requires a value" >&2
                exit 1
            fi
            THRESHOLD=$2
            shift 2
            ;;
        -h|--help)
            sed -n '/^# Usage:/,/^# *$/p' "$0" | sed 's/^# \{0,1\}//'
            exit 0
            ;;
        *)
            echo "error: unknown argument: $1" >&2
            exit 1
            ;;
    esac
done

if ! [ -f "$TARGET_FILE" ]; then
    echo "error: target file not found: $TARGET_FILE" >&2
    exit 1
fi

LINE_COUNT=$(wc -l < "$TARGET_FILE" | tr -d ' ')
REMAINING=$((THRESHOLD - LINE_COUNT))
PCT=$(( (LINE_COUNT * 100) / THRESHOLD ))

if [ $SUMMARY -eq 1 ]; then
    echo "tick-history-bounded-growth audit"
    echo "  target:           $TARGET_FILE"
    echo "  line count:       $LINE_COUNT"
    echo "  threshold:        $THRESHOLD"
    echo "  remaining room:   $REMAINING lines ($((100 - PCT))%)"
    if [ "$LINE_COUNT" -gt "$THRESHOLD" ]; then
        echo "  status:           OVER THRESHOLD — archive action due"
    elif [ "$PCT" -ge 80 ]; then
        echo "  status:           approaching threshold ($PCT%)"
    else
        echo "  status:           within bounds ($PCT%)"
    fi
    if [ "$LINE_COUNT" -gt "$THRESHOLD" ]; then exit 2; else exit 0; fi
fi

# Default (non-summary) mode: terse, machine-friendly
if [ "$LINE_COUNT" -gt "$THRESHOLD" ]; then
    printf 'OVER threshold: %d/%d lines (%d%%). Archive action due.\n' \
        "$LINE_COUNT" "$THRESHOLD" "$PCT"
    printf 'Expected action: move first 80%% of rows to docs/hygiene-history/loop-tick-history-YYYY-QN-archive.md and leave a pointer.\n'
    exit 2
fi

if [ $PCT -ge 80 ]; then
    printf 'APPROACHING threshold: %d/%d lines (%d%%).\n' \
        "$LINE_COUNT" "$THRESHOLD" "$PCT"
    exit 0
fi

printf 'within bounds: %d/%d lines (%d%%).\n' \
    "$LINE_COUNT" "$THRESHOLD" "$PCT"
exit 0
