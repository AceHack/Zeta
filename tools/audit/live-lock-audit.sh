#!/usr/bin/env bash
# live-lock-audit.sh — classify the last N commits on origin/main into
# external (src/tests/samples/bench), internal-factory (tick-history /
# BACKLOG / round-history / .claude), or speculative (research / memory /
# DECISIONS), and flag the live-lock smell when the external ratio is
# overwhelmed.
#
# Aaron's 2026-04-23 directive (live-lock smell):
#   *"on some cadence look at the last few things that went into master
#   and make sure its not overwhelemginly speculative. thats a smell that
#   our software factor is live locked."*
#
# Factory-health signal: external-code motion (product surface changes)
# should not be zero over a rolling window. When it is, the factory is
# spinning on process work without shipping — live-lock.
#
# Usage: tools/audit/live-lock-audit.sh [N]
#   N defaults to 25.
# Exit 0 if healthy, 1 if smell firing (for CI / hook wiring).

set -euo pipefail

WINDOW="${1:-25}"
THRESHOLD_EXT_PCT="${LIVELOCK_MIN_EXT_PCT:-20}"  # minimum healthy external-commit %

# Validate WINDOW is a positive integer. Without this, a caller passing
# a non-integer (or 0 / negative) would either error cryptically inside
# `git log -"$WINDOW"` or silently process zero commits.
if ! [[ "$WINDOW" =~ ^[1-9][0-9]*$ ]]; then
    echo "usage: $0 [N]" >&2
    echo "error: WINDOW must be a positive integer, got '$WINDOW'." >&2
    exit 2
fi

# Fetch so we are measuring against a fresh view, not stale local.
git fetch origin main --quiet 2>/dev/null || true

# Verify origin/main resolves before we try to read from it. A shallow
# clone, missing remote, or failed fetch would otherwise cause the
# `git log` below to yield zero commits and this script to report
# healthy — silently disabling the live-lock gate in CI.
if ! git rev-parse --verify --quiet origin/main >/dev/null; then
    echo "error: cannot resolve origin/main (shallow clone, missing remote, or failed fetch)." >&2
    echo "refusing to report audit result — unresolved ref cannot be treated as healthy." >&2
    exit 2
fi

ext=0
intl=0
spec=0
other=0
lines=""

while IFS= read -r sha; do
    [ -z "$sha" ] && continue
    # First-parent semantics on merge commits: a merge commit's
    # "landing" content is what came in from the feature branch,
    # not the union of both parents. Using `-m --first-parent`
    # yields only the diff against parent 1 so merges classify by
    # what they actually *introduced* to origin/main, preventing
    # the `-m` union from pulling in files only on the other
    # parent and inflating (or deflating) EXT/INTL/SPEC ratios
    # (Codex P1 on PR #147).
    files=$(git log -1 -m --first-parent --name-only --format= "$sha" 2>/dev/null \
        | grep -v '^$' || true)
    subj=$(git log -1 --format="%s" "$sha" | cut -c1-72)

    src=$(printf '%s\n' "$files" | grep -cE "^(src/|tests/|samples/|bench/)" || true)
    research=$(printf '%s\n' "$files" | grep -cE "^docs/research/|^memory/|^docs/DECISIONS/" || true)
    meta=$(printf '%s\n' "$files" | grep -cE "^docs/ROUND-HISTORY|^docs/hygiene-history/|^\\.claude/|^docs/BACKLOG" || true)

    if   [ "$src"      -gt 0 ]; then cat="EXT "; ext=$((ext+1))
    elif [ "$meta"     -gt 0 ] && [ "$research" -le "$meta" ]; then cat="INTL"; intl=$((intl+1))
    elif [ "$research" -gt 0 ]; then cat="SPEC"; spec=$((spec+1))
    else cat="OTHR"; other=$((other+1))
    fi

    lines="${lines}${cat}  ${subj}
"
done < <(git log origin/main -"$WINDOW" --format="%H")

total=$((ext + intl + spec + other))
if [ "$total" -eq 0 ]; then
    # Unreachable under normal use (origin/main is resolved above and
    # WINDOW is a positive integer). If it does fire, treat it as an
    # error — zero commits is not a healthy audit result.
    echo "error: no commits found in window of $WINDOW on origin/main." >&2
    exit 2
fi

ext_pct=$(( 100 * ext / total ))
intl_pct=$(( 100 * intl / total ))
spec_pct=$(( 100 * spec / total ))

echo "Live-lock audit — last $WINDOW commits on origin/main"
echo "======================================================"
printf '%s' "$lines"
echo ""
echo "Category totals:"
printf "  EXT  (src/tests/samples/bench) : %2d   %3d%%\n" "$ext" "$ext_pct"
printf "  INTL (tick-history/BACKLOG/...) : %2d   %3d%%\n" "$intl" "$intl_pct"
printf "  SPEC (research/memory/ADR)      : %2d   %3d%%\n" "$spec" "$spec_pct"
printf "  OTHR (uncategorised)            : %2d   %3d%%\n" "$other" "$(( 100 * other / total ))"
echo ""
echo "Healthy threshold: EXT >= ${THRESHOLD_EXT_PCT}%"
echo ""

if [ "$ext_pct" -lt "$THRESHOLD_EXT_PCT" ]; then
    echo "SMELL FIRING: external-commit ratio ${ext_pct}% < threshold ${THRESHOLD_EXT_PCT}%."
    echo "Factory may be live-locked — spinning on process work without product motion."
    echo "Response: pause speculative, ship one external-priority increment, re-measure."
    exit 1
fi

echo "Healthy: external-commit ratio ${ext_pct}% >= threshold ${THRESHOLD_EXT_PCT}%."
exit 0
