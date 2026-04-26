#!/usr/bin/env bash
# audit-agencysignature-main-tip.sh — post-merge auditor for the
# AgencySignature Convention v1 trailer block. Pairs with
# validate-agencysignature-pr-body.sh (task #298) as the post-merge half
# of the ferry-7 enforcement-instrument set per Amara ferry-7 ("stop
# designing, instrument enforcement").
#
# Usage:
#   tools/hygiene/audit-agencysignature-main-tip.sh                   # audit HEAD
#   tools/hygiene/audit-agencysignature-main-tip.sh --commit <SHA>    # audit specific commit
#   tools/hygiene/audit-agencysignature-main-tip.sh --max 10          # audit last N commits on HEAD branch
#   tools/hygiene/audit-agencysignature-main-tip.sh --since 2026-04-26 # audit commits since DATE (YYYY-MM-DD)
#   tools/hygiene/audit-agencysignature-main-tip.sh --branch main     # audit a specific branch's tip
#   tools/hygiene/audit-agencysignature-main-tip.sh --v1-ship-date <DATE>
#                                                                    # override auto-detected v1 ship date
#
# Spec source (the canonical convention):
#   docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-
#   attribution-convention-validation-and-refinement.md Section 10
#
# Per Aaron 2026-04-26 "don't copy paste / make sure you understand and
# write our own" — this implementation is authored from the v1 spec, not
# transcribed from Gemini ferry-8's example draft. Zeta-specific shape:
#  - Three-state classification (per task #299 spec, beyond Gemini's draft):
#    LEGACY (pre-v1-ship-date; no trailer expected; not regression)
#    CORRECT (post-v1-ship-date with trailer; properly attributed)
#    REGRESSION (post-v1-ship-date without trailer + Co-authored-by signal)
#    HUMAN-AUTHORED-EXEMPT (post-v1-ship-date without trailer + no Co-authored-by)
#  - Auto-detect v1 ship date as first commit reachable from current branch
#    carrying Agency-Signature-Version: 1 trailer. Override via --v1-ship-date.
#  - Otto-235 4-shell bash compat (verified on macOS bash 3.2.57): no
#    associative arrays; portable git commands; printf for stdout.
#  - Glass Halo radical-honesty register: no emoji; structured per-commit
#    output with status + commit SHA + reason; aggregate summary at end.
#
# Exit codes:
#   0 — no regressions found (LEGACY / CORRECT / HUMAN-AUTHORED-EXEMPT only)
#   1 — at least one REGRESSION found
#   2 — tooling / input error

set -uo pipefail

spec_doc="docs/research/2026-04-26-gemini-deep-think-agencysignature-commit-attribution-convention-validation-and-refinement.md"

if ! command -v git >/dev/null 2>&1; then
  echo "error: git not found on PATH" >&2
  exit 2
fi

mode="head"          # head | commit | max | since
commit_sha=""
max_n=""
since_date=""
branch=""
v1_ship_date=""

while [ $# -gt 0 ]; do
  case "$1" in
    --commit)
      if [ $# -lt 2 ]; then echo "error: --commit requires SHA" >&2; exit 2; fi
      mode="commit"; commit_sha="$2"; shift 2;;
    --max)
      if [ $# -lt 2 ]; then echo "error: --max requires N" >&2; exit 2; fi
      mode="max"; max_n="$2"; shift 2;;
    --since)
      if [ $# -lt 2 ]; then echo "error: --since requires DATE (YYYY-MM-DD)" >&2; exit 2; fi
      mode="since"; since_date="$2"; shift 2;;
    --branch)
      if [ $# -lt 2 ]; then echo "error: --branch requires NAME" >&2; exit 2; fi
      branch="$2"; shift 2;;
    --v1-ship-date)
      if [ $# -lt 2 ]; then echo "error: --v1-ship-date requires DATE" >&2; exit 2; fi
      v1_ship_date="$2"; shift 2;;
    -h|--help)
      sed -n '2,30p' "$0" | sed 's/^# \?//'; exit 0;;
    *) echo "error: unknown arg: $1" >&2; exit 2;;
  esac
done

# Resolve target rev.
if [ -n "$branch" ]; then
  target_rev="$branch"
else
  target_rev="HEAD"
fi

if ! git rev-parse --verify "$target_rev" >/dev/null 2>&1; then
  echo "error: cannot resolve target rev: $target_rev" >&2
  exit 2
fi

# Determine v1 ship date: first commit reachable from target_rev whose
# trailers PARSE (via git interpret-trailers) and contain
# Agency-Signature-Version: 1. Auto-detect unless overridden.
#
# Important: use trailer-parser, not text-grep. A commit body can contain
# the literal string "Agency-Signature-Version: 1" without it being a
# parseable trailer (e.g., when GitHub squash-merge inserts a blank line
# between the AgencySignature block and Co-authored-by, breaking
# contiguity). Real ship status requires actual parseable presence —
# this distinction itself was the discovery from the auditor's first
# run that caught PR #20's squash-merge regression. See
# docs/research/2026-04-26-squash-merge-blank-line-trailer-stripping-...
detect_v1_ship() {
  # Iterate commits oldest-first; return first one whose parsed trailers
  # contain the version line. Limit to a sensible window so we do not
  # scan the entire repo history per invocation; 5000 commits is ample
  # for any reasonable ship-date detection.
  git log --reverse --max-count=5000 --pretty='%H %cI' "$target_rev" 2>/dev/null \
    | while IFS=' ' read -r sha cdate; do
        if git log -1 --pretty='%(trailers)' "$sha" 2>/dev/null \
            | grep -iq '^Agency-Signature-Version: 1'; then
          printf '%s %s\n' "$sha" "$cdate"
          return 0
        fi
      done | head -1
}

if [ -z "$v1_ship_date" ]; then
  ship_line="$(detect_v1_ship)"
  if [ -n "$ship_line" ]; then
    v1_ship_sha="$(printf '%s' "$ship_line" | awk '{print $1}')"
    v1_ship_date="$(printf '%s' "$ship_line" | awk '{print $2}')"
  fi
fi

# Build commit list per mode.
case "$mode" in
  head)
    commits="$(git rev-parse "$target_rev")"
    ;;
  commit)
    if ! git rev-parse --verify "$commit_sha" >/dev/null 2>&1; then
      echo "error: cannot resolve commit: $commit_sha" >&2
      exit 2
    fi
    commits="$(git rev-parse "$commit_sha")"
    ;;
  max)
    case "$max_n" in
      ''|*[!0-9]*) echo "error: --max value must be a positive integer" >&2; exit 2;;
    esac
    commits="$(git log --max-count="$max_n" --pretty='%H' "$target_rev")"
    ;;
  since)
    commits="$(git log --since="$since_date" --pretty='%H' "$target_rev")"
    if [ -z "$commits" ]; then
      printf '%s\n' "no commits since $since_date on $target_rev — nothing to audit"
      exit 0
    fi
    ;;
esac

# classify_commit SHA -> echoes "STATUS REASON" on stdout.
classify_commit() {
  local sha="$1"
  local trailers
  trailers="$(git log -1 --pretty='%(trailers)' "$sha" 2>/dev/null || true)"

  local has_v1=false
  local has_coauthor=false
  if printf '%s\n' "$trailers" | grep -iq '^Agency-Signature-Version: 1'; then
    has_v1=true
  fi
  if printf '%s\n' "$trailers" | grep -iq '^Co-authored-by: Claude'; then
    has_coauthor=true
  fi

  # Pre-v1-ship-date check: if we have a v1 ship date AND this commit is
  # strictly older than that ship date, classify as LEGACY.
  #
  # Compare via Unix timestamps (committer date %ct) because ISO-8601
  # string compare breaks with mixed timezone formats (e.g.,
  # "2026-04-26T15:15:53-04:00" vs "2026-04-26T19:00:00Z" — same UTC
  # moment but lexicographically misordered). Discovered while testing
  # the auditor against c4400cb on 2026-04-26.
  if [ -n "$v1_ship_date" ]; then
    local commit_ts
    local ship_ts
    commit_ts="$(git log -1 --pretty='%ct' "$sha")"
    # Convert v1_ship_date (ISO-8601) to Unix timestamp via git's
    # date parser if not already numeric. Cache via $v1_ship_ts_cached
    # for repeated calls.
    if [ -z "${v1_ship_ts_cached:-}" ]; then
      # Use date(1) to convert; both BSD and GNU date support `-d` /
      # `-j -f` differently. Critical macOS-specific gotcha: BSD `date
      # -j -f` ignores the timezone suffix in the input string and
      # parses the digits as local time. Force UTC interpretation via
      # TZ=UTC so a `Z` suffix actually means UTC, not local. (Tested
      # on macOS bash 3.2.57 + EDT-localized system 2026-04-26.)
      ship_ts="$(date -d "$v1_ship_date" +%s 2>/dev/null \
        || TZ=UTC date -j -f '%Y-%m-%dT%H:%M:%SZ' "$v1_ship_date" +%s 2>/dev/null \
        || TZ=UTC date -j -f '%Y-%m-%dT%H:%M:%S%z' "$v1_ship_date" +%s 2>/dev/null \
        || echo '')"
      if [ -z "$ship_ts" ]; then
        printf 'ERROR cannot parse v1-ship-date as timestamp: %s\n' "$v1_ship_date"
        return
      fi
      # Cache (function-local; persists for this invocation only)
      v1_ship_ts_cached="$ship_ts"
    else
      ship_ts="$v1_ship_ts_cached"
    fi
    if [ "$commit_ts" -lt "$ship_ts" ]; then
      printf 'LEGACY pre-v1-ship-date (%s < %s)\n' \
        "$(git log -1 --pretty='%cI' "$sha")" "$v1_ship_date"
      return
    fi
  else
    # No v1 ship found in branch history at all -> all commits are LEGACY.
    printf 'LEGACY v1 not yet shipped on this branch\n'
    return
  fi

  # Post-v1-ship classification.
  if [ "$has_v1" = "true" ]; then
    printf 'CORRECT trailer present\n'
  elif [ "$has_coauthor" = "true" ]; then
    printf 'REGRESSION agent commit (Co-authored-by present) missing AgencySignature\n'
  else
    printf 'HUMAN-AUTHORED-EXEMPT no Co-authored-by signal; assuming human-authored\n'
  fi
}

# Aggregate audit.
correct_count=0
legacy_count=0
human_count=0
regression_count=0
regressions=""

printf 'AgencySignature v1 main-tip audit\n'
printf '  target_rev:    %s (%s)\n' "$target_rev" "$(git rev-parse "$target_rev")"
if [ -n "$v1_ship_date" ]; then
  printf '  v1-ship-date:  %s' "$v1_ship_date"
  if [ -n "${v1_ship_sha:-}" ]; then
    printf ' (commit %s)' "$(printf '%s' "$v1_ship_sha" | cut -c1-12)"
  fi
  printf '\n'
else
  printf '  v1-ship-date:  not yet shipped on this branch (all commits LEGACY)\n'
fi
printf '  mode:          %s\n' "$mode"
printf '\n'

while IFS= read -r sha; do
  [ -z "$sha" ] && continue
  result="$(classify_commit "$sha")"
  status="$(printf '%s' "$result" | awk '{print $1}')"
  reason="$(printf '%s' "$result" | sed -E 's/^[A-Z-]+ //')"

  short="$(printf '%s' "$sha" | cut -c1-12)"
  subject="$(git log -1 --pretty='%s' "$sha")"
  printf '  [%-22s] %s — %s\n' "$status" "$short" "$subject"
  printf '    %s\n' "$reason"

  case "$status" in
    CORRECT)               correct_count=$((correct_count + 1));;
    LEGACY)                legacy_count=$((legacy_count + 1));;
    HUMAN-AUTHORED-EXEMPT) human_count=$((human_count + 1));;
    REGRESSION)
      regression_count=$((regression_count + 1))
      regressions="$regressions $short"
      ;;
  esac
done <<< "$commits"

printf '\nSummary:\n'
printf '  CORRECT:                %d\n' "$correct_count"
printf '  LEGACY:                 %d\n' "$legacy_count"
printf '  HUMAN-AUTHORED-EXEMPT:  %d\n' "$human_count"
printf '  REGRESSION:             %d\n' "$regression_count"

if [ "$regression_count" -gt 0 ]; then
  printf '\nFAIL: %d regression(s) found:%s\n' "$regression_count" "$regressions"
  printf '  Cause: agent-authored commits (Co-authored-by present) on or after v1\n'
  printf '         ship date are missing the Agency-Signature-Version: 1 trailer\n'
  printf '         block, indicating squash-merge stripped the trailers OR the PR\n'
  printf '         body did not carry the trailer block at the bottom.\n'
  printf '  Fix:   re-attach AgencySignature trailers to the next commit; ensure\n'
  printf '         future PR bodies include the trailer block at the body bottom\n'
  printf '         per the Squash-Merge Invariant rule (ferry-6/7).\n'
  printf '  Spec:  %s Section 7.5 + Section 10\n' "$spec_doc"
  exit 1
fi

printf '\nPASS: no regressions detected\n'
exit 0
