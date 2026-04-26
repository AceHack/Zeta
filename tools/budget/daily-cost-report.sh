#!/usr/bin/env bash
# tools/budget/daily-cost-report.sh — daily cost-monitoring entry point.
#
# Wraps snapshot-burn.sh + project-runway.sh + writes the human-readable
# projection to docs/budget-history/latest-report.md. Designed to be the
# single entry point for the daily /schedule remote-trigger routine
# (task #287 visibility surface for the human maintainer).
#
# Why this exists (the human maintainer 2026-04-26):
#   "we need to get that resource/costs monitoring done in the next
#   few days ... so we can see the costs"
#
# The two existing tools (snapshot-burn.sh + project-runway.sh) are
# correct primitives but require manual orchestration to produce a
# glanceable surface. This wrapper produces docs/budget-history/
# latest-report.md so the maintainer can `cat` / preview that one
# file to see runway state.
#
# Usage:
#   tools/budget/daily-cost-report.sh                  # full run, writes report
#   tools/budget/daily-cost-report.sh --dry-run        # snapshot dry-run; still
#                                                     # writes the report from
#                                                     # whatever snapshots exist
#   tools/budget/daily-cost-report.sh --skip-snapshot  # only regenerate the
#                                                     # report from existing
#                                                     # snapshots (for testing)
#
# Exit codes:
#   0 success
#   1 if any wrapped step fails (snapshot-burn.sh or project-runway.sh)
#   2 on CLI-argument errors
#
# Composes with:
#   - tools/budget/snapshot-burn.sh (data-capture primitive)
#   - tools/budget/project-runway.sh (projection primitive)
#   - docs/budget-history/README.md (methodology + field reference)
#   - docs/budget-history/snapshots.jsonl (append-only data store)
#   - docs/budget-history/latest-report.md (the visibility surface this
#     wrapper produces; OVERWRITTEN each run, not append-only)

set -uo pipefail

snapshot_args=""
skip_snapshot="false"

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) snapshot_args="--dry-run"; shift ;;
    --skip-snapshot) skip_snapshot="true"; shift ;;
    -h|--help)
      sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)
      echo "error: unknown argument '$1'" >&2
      exit 2 ;;
  esac
done

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
report_path="$repo_root/docs/budget-history/latest-report.md"
snapshots_path="$repo_root/docs/budget-history/snapshots.jsonl"

# Step 1 — capture snapshot (unless skipped)
if [ "$skip_snapshot" = "false" ]; then
  echo "==> snapshot-burn.sh $snapshot_args"
  if [ -n "$snapshot_args" ]; then
    "$script_dir/snapshot-burn.sh" $snapshot_args || {
      echo "error: snapshot-burn.sh failed (exit $?)" >&2
      exit 1
    }
  else
    "$script_dir/snapshot-burn.sh" || {
      echo "error: snapshot-burn.sh failed (exit $?)" >&2
      exit 1
    }
  fi
else
  echo "==> snapshot-burn.sh SKIPPED per --skip-snapshot"
fi

# Step 2 — run projection (text mode)
if [ ! -f "$snapshots_path" ]; then
  echo "==> project-runway.sh SKIPPED (no snapshots yet); writing bootstrap report"
  projection="No snapshots captured yet. The first snapshot-burn.sh run will append a baseline row to docs/budget-history/snapshots.jsonl. Once N >= 2 snapshots exist across LFG merges, projection becomes available."
else
  echo "==> project-runway.sh"
  projection="$("$script_dir/project-runway.sh" 2>&1)" || {
    echo "error: project-runway.sh failed (exit $?)" >&2
    exit 1
  }
fi

# Step 3 — write the report (overwrite, not append)
ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
git_sha="$(git -C "$repo_root" rev-parse HEAD 2>/dev/null || echo unknown)"

cat > "$report_path" <<EOF
# Latest cost projection — auto-generated

**Generated:** \`$ts\`
**Factory git SHA:** \`$git_sha\`
**Source:** \`tools/budget/daily-cost-report.sh\` (wraps snapshot-burn.sh + project-runway.sh)

This file is **OVERWRITTEN** on each daily run. Historical snapshots live in
\`docs/budget-history/snapshots.jsonl\` (append-only); historical projections
can be reconstructed from any snapshot subset via \`tools/budget/project-runway.sh\`.

---

## Projection text

\`\`\`text
$projection
\`\`\`

---

## How to read this

- **\`Actions billable_ms cumulative\`** — cumulative GitHub-Actions billable runtime across captured snapshots. On public repos this is typically 0 (included minutes); meaningful for macOS / private-repo / Enterprise-plan accounts.
- **\`Per-PR Actions ms (naive)\`** — rolling-window estimate of per-merged-PR Actions cost. Caveats in the projection text below; treat as proxy until \`N \\geq 3\` cumulative snapshots exist.
- **\`Actions fit\`** — whether projected Stages 1-4 burn fits the configured free-tier allowance. If \`EXCEEDS\`, the gate-conditions section names escape valves.
- **\`Copilot projected USD\`** — assumed-30-day span at the current seat count and rate. Re-run with \`--copilot-rate\` to model rate changes.

---

## Source data

- Snapshots: \`docs/budget-history/snapshots.jsonl\`
- Methodology: \`docs/budget-history/README.md\`
- Wrapper: \`tools/budget/daily-cost-report.sh\` (this run)
- Capture script: \`tools/budget/snapshot-burn.sh\`
- Projection script: \`tools/budget/project-runway.sh\`
EOF

echo "==> wrote $report_path"
echo "OK: daily cost report regenerated"
