#!/usr/bin/env bash
# project-runway.sh — read docs/budget-history/snapshots.jsonl and
# project Stages 1-4 three-repo-split burn against remaining
# free-credit runway. Companion to snapshot-burn.sh. Self-contained:
# works with N=1 (reports "insufficient data for delta; baseline
# only"), grows more useful as cadence accumulates.
#
# Aaron 2026-04-22: *"i want evidence based budgiting ... we want
# some amount of price history in git ... If i need more credits i
# can buy enterprise"*. This script is the projection layer that
# turns persisted history into a decision-ready summary for Aaron.
# It never initiates an upgrade — it only surfaces the projection
# so Aaron's call is evidence-driven.
#
# Usage:
#   tools/budget/project-runway.sh
#   tools/budget/project-runway.sh --stages 20
#   tools/budget/project-runway.sh --json
#   tools/budget/project-runway.sh --file docs/budget-history/snapshots.jsonl
#
# Defaults (rationale in docs/budget-history/README.md):
#   --stages 20            estimated extra PRs for Stages 1-4 of
#                          the three-repo split. Stage 1 ~5 PRs
#                          (Forge+ace scaffolding), Stage 2 ~10
#                          (factory path moves), Stage 3 ~10+
#                          (ace bootstrap, deferred), Stage 4 ~3.
#                          Conservative: 20 covers Stages 1-2
#                          with buffer.
#   --copilot-rate 19      Copilot Business monthly seat rate USD.
#   --actions-free-ms 180000000  GitHub Team plan includes 3000
#                                min/month = 180 000 000 ms.
#                                Override with --actions-free-ms
#                                to model Enterprise plan (50000 min).
#
# Exit codes: 0 success, 2 on CLI-argument errors, 1 if the history
# file is missing or malformed.

set -uo pipefail

script_dir="$(cd "$(dirname "$0")" && pwd)"
repo_root="$(cd "$script_dir/../.." && pwd)"
default_file="$repo_root/docs/budget-history/snapshots.jsonl"

file="$default_file"
stages=20
copilot_rate=19
actions_free_ms=180000000
emit_json="false"

while [ $# -gt 0 ]; do
  case "$1" in
    --file)
      if [ $# -lt 2 ]; then echo "error: --file requires PATH" >&2; exit 2; fi
      file="$2"; shift 2 ;;
    --stages)
      if [ $# -lt 2 ]; then echo "error: --stages requires INT" >&2; exit 2; fi
      stages="$2"; shift 2 ;;
    --copilot-rate)
      if [ $# -lt 2 ]; then echo "error: --copilot-rate requires USD" >&2; exit 2; fi
      copilot_rate="$2"; shift 2 ;;
    --actions-free-ms)
      if [ $# -lt 2 ]; then echo "error: --actions-free-ms requires INT" >&2; exit 2; fi
      actions_free_ms="$2"; shift 2 ;;
    --json) emit_json="true"; shift ;;
    -h|--help)
      sed -n '2,35p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)
      echo "error: unknown argument '$1'" >&2
      exit 2 ;;
  esac
done

if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq required but not on PATH" >&2
  exit 1
fi

if [ ! -f "$file" ]; then
  echo "error: snapshot file not found: $file" >&2
  exit 1
fi

# Count samples.
n="$(wc -l < "$file" | tr -d ' ')"
if [ "$n" -lt 1 ]; then
  echo "error: snapshot file is empty: $file" >&2
  exit 1
fi

# Parse first and last snapshots.
first="$(head -n 1 "$file")"
last="$(tail -n 1 "$file")"

first_ts="$(echo "$first" | jq -r '.ts')"
last_ts="$(echo "$last" | jq -r '.ts')"
last_copilot_seats="$(echo "$last" | jq -r '.copilot_billing.seat_breakdown.total // 0')"
last_plan="$(echo "$last" | jq -r '.copilot_billing.plan_type // "unknown"')"
last_total_ms="$(echo "$last" | jq -r '[.repos[].agg.total_duration_ms // 0] | add')"
last_recent_merged="$(echo "$last" | jq -r '[.repos[].pr.recent_merged // 0] | add')"
last_sha="$(echo "$last" | jq -r '.factory_git_sha')"

# Delta computation requires N >= 2.
delta_available="false"
per_pr_ms="null"
pr_delta="0"
if [ "$n" -ge 2 ]; then
  first_total_ms="$(echo "$first" | jq -r '[.repos[].agg.total_duration_ms // 0] | add')"
  first_recent_merged="$(echo "$first" | jq -r '[.repos[].pr.recent_merged // 0] | add')"
  # Note: recent_merged is a rolling-window count (last 10), not a
  # cumulative count. A robust per-PR-burn calc needs a cumulative
  # PR counter. For now use the naive proxy: if last_total_ms
  # increased, divide by max(1, abs(last - first merged count)).
  total_ms_delta=$((last_total_ms - first_total_ms))
  if [ "$total_ms_delta" -gt 0 ]; then
    pr_delta=$((last_recent_merged - first_recent_merged))
    if [ "$pr_delta" -lt 1 ]; then pr_delta=1; fi
    per_pr_ms=$((total_ms_delta / pr_delta))
    delta_available="true"
  fi
fi

# Projection.
# Actions: projected_ms = per_pr_ms * stages; remaining = free_ms - cumulative_billable.
# Copilot: constant $copilot_rate/month per seat; migration-span-months * seats * rate.
# Conservative bound: use last snapshot billable counters (sum of all OS) for cumulative.
last_billable_ms="$(echo "$last" | jq -r '[.repos[] | .agg.billable_ubuntu_ms + .agg.billable_macos_ms + .agg.billable_windows_ms] | add')"
remaining_free_ms=$((actions_free_ms - last_billable_ms))
projected_actions_ms=0
actions_fit="unknown (N<2)"
if [ "$delta_available" = "true" ] && [ "$per_pr_ms" != "null" ]; then
  projected_actions_ms=$((per_pr_ms * stages))
  if [ "$projected_actions_ms" -le "$remaining_free_ms" ]; then
    actions_fit="fits (with margin $((remaining_free_ms - projected_actions_ms)) ms)"
  else
    actions_fit="EXCEEDS by $((projected_actions_ms - remaining_free_ms)) ms"
  fi
fi

# Copilot cost over assumed 30-day migration span.
assumed_days=30
copilot_projected_usd=$((last_copilot_seats * copilot_rate * assumed_days / 30))

# Emit.
if [ "$emit_json" = "true" ]; then
  jq -n \
    --arg file "$file" \
    --arg first_ts "$first_ts" \
    --arg last_ts "$last_ts" \
    --argjson n "$n" \
    --argjson stages "$stages" \
    --argjson copilot_rate "$copilot_rate" \
    --argjson actions_free_ms "$actions_free_ms" \
    --argjson last_copilot_seats "$last_copilot_seats" \
    --arg last_plan "$last_plan" \
    --arg last_sha "$last_sha" \
    --argjson last_total_ms "$last_total_ms" \
    --argjson last_billable_ms "$last_billable_ms" \
    --arg delta_available "$delta_available" \
    --arg per_pr_ms "$per_pr_ms" \
    --argjson pr_delta "$pr_delta" \
    --argjson projected_actions_ms "$projected_actions_ms" \
    --argjson remaining_free_ms "$remaining_free_ms" \
    --arg actions_fit "$actions_fit" \
    --argjson copilot_projected_usd "$copilot_projected_usd" \
    --argjson assumed_days "$assumed_days" \
    '{
      input: {file: $file, samples: $n, first_ts: $first_ts, last_ts: $last_ts},
      parameters: {
        stages_extra_prs: $stages,
        copilot_rate_usd: $copilot_rate,
        actions_free_ms: $actions_free_ms,
        assumed_migration_days: $assumed_days
      },
      latest_snapshot: {
        ts: $last_ts,
        factory_git_sha: $last_sha,
        copilot: {seats: $last_copilot_seats, plan: $last_plan},
        actions: {total_ms_last_20_runs: $last_total_ms, billable_ms: $last_billable_ms}
      },
      projection: {
        delta_available: ($delta_available == "true"),
        per_pr_ms: (if $per_pr_ms == "null" then null else ($per_pr_ms | tonumber) end),
        pr_delta_window: $pr_delta,
        actions_projected_ms: $projected_actions_ms,
        actions_remaining_free_ms: $remaining_free_ms,
        actions_fit: $actions_fit,
        copilot_projected_usd_for_window: $copilot_projected_usd
      }
    }'
  exit 0
fi

# Text output.
cat <<OUT
Budget projection — three-repo-split Stages 1-4
================================================

Evidence source:   $file
Samples (N):       $n
First snapshot:    $first_ts
Latest snapshot:   $last_ts
Latest factory SHA: $last_sha

Latest state
------------
  Copilot plan:    $last_plan
  Copilot seats:   $last_copilot_seats
  Actions total_duration_ms (last 20 runs, all repos):  $last_total_ms
  Actions billable_ms cumulative:  $last_billable_ms

Projection parameters
---------------------
  Estimated extra PRs for Stages 1-4:  $stages
  Copilot Business seat rate (USD/mo): \$$copilot_rate
  Actions free-tier allowance (ms):    $actions_free_ms
  Assumed migration span (days):       $assumed_days

Projection
----------
OUT

if [ "$delta_available" = "true" ]; then
  cat <<OUT
  Per-PR Actions ms (naive, from rolling window): $per_pr_ms
  Projected Stages 1-4 Actions ms:                $projected_actions_ms
  Remaining free-tier ms:                         $remaining_free_ms
  Actions fit:                                    $actions_fit
OUT
else
  cat <<OUT
  Per-PR Actions ms:         insufficient data (N<2 or no duration delta)
  Projected Actions ms:      unavailable
  Gate status:               cannot project — accumulate more snapshots
OUT
fi

cat <<OUT
  Copilot projected USD (single span):           \$$copilot_projected_usd

Aaron-decision surface
----------------------
OUT

if [ "$n" -lt 3 ]; then
  echo "  N=$n; BACKLOG row requires N>=3 across >=2 LFG merges before"
  echo "  projection is considered decision-ready. Keep accumulating."
elif [ "$delta_available" != "true" ]; then
  echo "  N=$n but no duration delta observed — cadence is hitting the"
  echo "  same 20-run window. Accumulate across more merges or extend"
  echo "  the snapshot window."
else
  echo "  Gate conditions (see ADR §Blockers):"
  echo "    (1) N>=3 samples:                 $( [ "$n" -ge 3 ] && echo yes || echo no )"
  echo "    (2) projection computed:          yes"
  echo "    (3) Aaron has seen projection:    (surface via Architect)"
  echo ""
  echo "  If Actions projection shows EXCEEDS, the escape valves are:"
  echo "    - Shrink Stage 1-4 workload (reduce --stages parameter)"
  echo "    - Wait for next free-credit cycle"
  echo "    - Aaron-decision: Enterprise upgrade (Trigger B per memory"
  echo "      feedback_lfg_paid_copilot_teams_throttled_experiments_allowed.md)"
fi

cat <<OUT

Caveats
-------
  * recent_merged is a rolling-window count (last 10 closed PRs),
    not a cumulative counter. Per-PR-ms uses it as a proxy —
    introduces error when the 20-run window doesn't roll forward
    between snapshots. A cumulative PR counter would be a
    substrate improvement (BACKLOG follow-up).
  * last_billable_ms on public repos is typically 0 (included
    minutes). Projection still meaningful for macOS runs and
    any future private-repo work.
  * Copilot projection assumes constant seat count over the span.
    Seat-count changes require rerunning projection.
OUT
