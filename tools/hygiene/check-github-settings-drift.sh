#!/usr/bin/env bash
# check-github-settings-drift.sh — diff the current GitHub settings of a
# repo against the checked-in expected snapshot. Detects click-ops drift
# for settings that GitHub does not expose as declarative config.
#
# Usage:
#   tools/hygiene/check-github-settings-drift.sh [--repo OWNER/NAME] [--expected PATH]
#
# Defaults:
#   --repo        $GH_REPO, else `gh repo view --json nameWithOwner`
#   --expected    tools/hygiene/github-settings.expected.json (next to this script)
#
# Exit codes:
#   0   — no drift
#   1   — drift detected (diff printed to stdout)
#   2   — tooling / input error
#
# Runs in CI via `.github/workflows/github-settings-drift.yml` on a weekly
# cadence + manual dispatch. Also safe to run locally before risky
# settings changes to capture a baseline.

set -uo pipefail

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo=""
expected="$script_dir/github-settings.expected.json"

while [ $# -gt 0 ]; do
  case "$1" in
    --repo)
      if [ $# -lt 2 ]; then
        echo "error: --repo requires OWNER/NAME argument" >&2
        exit 2
      fi
      repo="$2"; shift 2;;
    --expected)
      if [ $# -lt 2 ]; then
        echo "error: --expected requires PATH argument" >&2
        exit 2
      fi
      expected="$2"; shift 2;;
    *) echo "error: unknown arg: $1" >&2; exit 2;;
  esac
done

if [ -z "$repo" ]; then
  repo="${GH_REPO:-$(gh repo view --json nameWithOwner --jq '.nameWithOwner' 2>/dev/null || true)}"
fi
if [ -z "$repo" ]; then
  echo "error: cannot determine repo; pass --repo OWNER/NAME or set GH_REPO" >&2
  exit 2
fi

if [ ! -f "$expected" ]; then
  echo "error: expected snapshot not found: $expected" >&2
  exit 2
fi

tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT

"$script_dir/snapshot-github-settings.sh" --repo "$repo" > "$tmp" || {
  echo "error: snapshot failed" >&2
  exit 2
}

if diff -u "$expected" "$tmp"; then
  echo "github-settings-drift: no drift (repo=$repo)" >&2
  exit 0
else
  echo "" >&2
  echo "github-settings-drift: DRIFT DETECTED (repo=$repo)" >&2
  echo "  expected: $expected" >&2
  echo "  current : (live from gh api)" >&2
  echo "" >&2
  echo "Resolve options:" >&2
  echo "  1. Intentional change -> update expected snapshot:" >&2
  echo "     $script_dir/snapshot-github-settings.sh --repo $repo > $expected" >&2
  echo "     Then commit the diff with a message explaining the policy change." >&2
  echo "  2. Unintentional change -> revert the setting in GitHub UI/API" >&2
  echo "     and re-run this script to confirm." >&2
  exit 1
fi
