#!/usr/bin/env bash
# snapshot-burn.sh — capture a point-in-time LFG cost/burn snapshot and
# append it to docs/budget-history/snapshots.jsonl as a single JSON
# line. Append-only; git is the time-series storage.
#
# Why this exists: Aaron 2026-04-22 scoped the three-repo-split Stage 1
# gate as evidence-based budget tracking — *"i want evidence based
# budgiting so you might have to build some observaiblity first or run
# some gh commands even if gh commands work we want some amount of
# price history in git, maybe just looking like before and after PRs
# on LFG and those measurements might be enough"*. The live cost graphs
# on github.com are for humans and disappear the moment we stop
# looking; the factory needs persisted evidence to project mid-swap
# credit-exhaustion risk. See docs/budget-history/README.md for the
# methodology + projection approach.
#
# Usage:
#   tools/budget/snapshot-burn.sh              # append a snapshot
#   tools/budget/snapshot-burn.sh --dry-run    # print only, no append
#   tools/budget/snapshot-burn.sh --note "TEXT" # attach a human note
#
# Scopes required (current gh token has these): read:org, repo, workflow.
# admin:org scope would unlock /settings/billing/{actions,packages,
# shared-storage} too — if Aaron runs `gh auth refresh -s admin:org`
# we can add those axes (see tools/budget/README notes), but the
# script is designed to work without them.
#
# Exit codes: 0 success, 2 on CLI-argument errors, non-zero if any
# required gh/jq step fails.

set -uo pipefail

org="Lucent-Financial-Group"
repos=("Lucent-Financial-Group/Zeta")  # extend when Forge + ace stand up
dry_run="false"
note=""

while [ $# -gt 0 ]; do
  case "$1" in
    --dry-run) dry_run="true"; shift ;;
    --note)
      if [ $# -lt 2 ]; then
        echo "error: --note requires TEXT argument" >&2
        exit 2
      fi
      note="$2"; shift 2 ;;
    -h|--help)
      sed -n '2,30p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)
      echo "error: unknown argument '$1'" >&2
      exit 2 ;;
  esac
done

for cmd in gh jq git; do
  if ! command -v "$cmd" >/dev/null 2>&1; then
    echo "error: '$cmd' required but not on PATH" >&2
    exit 1
  fi
done

ts="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
git_sha="$(git -C "$(dirname "$0")/../.." rev-parse HEAD 2>/dev/null || echo "unknown")"

# 1) Copilot seats (read:org sufficient)
copilot_raw="$(gh api "/orgs/${org}/copilot/billing" 2>/dev/null || echo "{}")"

# 2) Per-repo run timing summary over the last 20 runs.
#    Per-run /actions/runs/<id>/timing returns run_duration_ms +
#    billable{UBUNTU,MACOS,WINDOWS}.total_ms. For public repos the
#    billable totals are typically zero (included minutes) — we still
#    capture run_duration_ms because it is the consumption signal
#    regardless of who is being billed.
repo_stats=""
for r in "${repos[@]}"; do
  runs_json="$(gh api "/repos/${r}/actions/runs?per_page=20" 2>/dev/null || echo '{"workflow_runs":[]}')"
  per_run="$(echo "$runs_json" | jq -c '[.workflow_runs[] | {id, name, conclusion, run_started_at, updated_at}]')"
  run_ids="$(echo "$runs_json" | jq -r '.workflow_runs[].id')"
  timings="[]"
  for id in $run_ids; do
    t="$(gh api "/repos/${r}/actions/runs/${id}/timing" 2>/dev/null || echo '{}')"
    timings="$(echo "$timings" | jq --argjson entry "{\"id\":$id,\"timing\":$t}" '. + [$entry]')"
  done
  agg="$(echo "$timings" | jq '
    { total_runs: length,
      total_duration_ms: ([.[].timing.run_duration_ms // 0] | add),
      billable_ubuntu_ms: ([.[].timing.billable.UBUNTU.total_ms // 0] | add),
      billable_macos_ms: ([.[].timing.billable.MACOS.total_ms // 0] | add),
      billable_windows_ms: ([.[].timing.billable.WINDOWS.total_ms // 0] | add) }')"
  pr_stats="$(gh api "/repos/${r}/pulls?state=closed&per_page=10" 2>/dev/null \
    | jq '[.[] | select(.merged_at != null)] | { recent_merged: length, last_merged_at: (.[0].merged_at // null) }' || echo '{}')"
  entry="$(jq -n --arg repo "$r" \
                 --argjson agg "$agg" \
                 --argjson runs "$per_run" \
                 --argjson pr "$pr_stats" \
                 '{repo: $repo, agg: $agg, pr: $pr, last_20_runs: $runs}')"
  if [ -z "$repo_stats" ]; then
    repo_stats="[$entry"
  else
    repo_stats="${repo_stats},$entry"
  fi
done
repo_stats="${repo_stats}]"

# 3) Compose the snapshot. One JSON object per line (JSONL).
snapshot="$(jq -n \
  --arg ts "$ts" \
  --arg sha "$git_sha" \
  --arg org "$org" \
  --arg note "$note" \
  --argjson copilot "$copilot_raw" \
  --argjson repos "$repo_stats" \
  '{
    ts: $ts,
    factory_git_sha: $sha,
    org: $org,
    note: ($note | select(. != "") // null),
    copilot_billing: $copilot,
    repos: $repos,
    scope_coverage: {
      has_read_org: true,
      has_admin_org: false,
      covered: ["copilot-seats", "actions-runs-per-run-timing"],
      missing_requires_admin_org: ["actions-billing", "packages-billing", "shared-storage-billing"]
    }
  }')"

line="$(echo "$snapshot" | jq -c '.')"

if [ "$dry_run" = "true" ]; then
  echo "$line" | jq '.'
  exit 0
fi

out="$(dirname "$0")/../../docs/budget-history/snapshots.jsonl"
printf '%s\n' "$line" >> "$out"
echo "appended snapshot to $out"
echo "$line" | jq '{ts, org, copilot_seats: .copilot_billing.seat_breakdown.total, repos: [.repos[] | {repo, last_20_total_ms: .agg.total_duration_ms, recent_merged: .pr.recent_merged}]}'
