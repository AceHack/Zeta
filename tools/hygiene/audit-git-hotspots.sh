#!/usr/bin/env bash
# tools/hygiene/audit-git-hotspots.sh
#
# Identifies high-churn files in the repo over a configurable
# window — the "hotspots" the human maintainer named on
# 2026-04-23 Otto-54:
#
# > cadence for checking github hotspots too this is a hygene
# > issues points of friction and bottlenecks, we are
# > frictionless... git hotspots i mean... we are gitnative
# > with github as our first host
#
# High-churn shared files are the paradigmatic friction surface
# (routine merge conflicts, reviewer burden, serialization
# bottleneck). The audit surfaces candidates; the action
# (split / freeze / archive / watch) is a judgment call the
# author or architect makes from the report.
#
# Part of the Otto-54 directive cluster in BACKLOG.md §
# "P1 — Git-native hygiene cadences". Composes with:
# (The verbatim quote above is preserved as attribution —
# the quoted directive IS attribution, which is the narrow
# name-attribution exemption. Outside the quote block this
# prose uses role references per the no-name-attribution
# rule.)
# - BACKLOG-per-swim-lane split row (one remediation option)
# - CURRENT-maintainer freshness audit row (one remediation
#   option for memory/MEMORY.md hotspots)
#
# Usage:
#   tools/hygiene/audit-git-hotspots.sh               # default window: 60 days, top 20
#   tools/hygiene/audit-git-hotspots.sh --window 30d  # custom window
#   tools/hygiene/audit-git-hotspots.sh --top 40      # show more rows
#   tools/hygiene/audit-git-hotspots.sh --report PATH # write markdown report
#
# Exit codes:
#   0 — always (detect-only, no enforcement yet; see Otto-54
#       NOT-list: detection-first, action-second)

set -euo pipefail

window="60 days"
top=20
report=""

require_value() {
  # require_value FLAG VALUE — aborts with a clear message if VALUE is empty.
  if [[ -z "${2:-}" ]]; then
    echo "error: $1 requires a value" >&2
    exit 64
  fi
}

require_positive_int() {
  # require_positive_int FLAG VALUE — aborts with exit 64 if VALUE is not a positive integer.
  if ! [[ "${2:-}" =~ ^[1-9][0-9]*$ ]]; then
    echo "error: $1 requires a positive integer, got: ${2:-<empty>}" >&2
    exit 64
  fi
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --window)
      require_value "$1" "${2:-}"
      window="$2"
      shift 2
      ;;
    --top)
      require_value "$1" "${2:-}"
      require_positive_int "$1" "${2:-}"
      top="$2"
      shift 2
      ;;
    --report)
      require_value "$1" "${2:-}"
      report="$2"
      shift 2
      ;;
    -h|--help)
      # Skip the shebang line so --help output doesn't start with
      # `!/usr/bin/env bash`. The sed rewrite strips the leading
      # `# ` / `#` markers so the doc block reads as plain prose.
      grep '^#' "$0" | grep -v '^#!' | sed 's/^# //;s/^#//'
      exit 0
      ;;
    *)
      echo "unknown arg: $1" >&2
      exit 64
      ;;
  esac
done

# Count per-file touches in the window, excluding paths we
# deliberately expect to be hot:
# - docs/hygiene-history/**: append-only fire logs; churn is
#   by design (one row per tick).
# - openspec/changes/**: OpenSpec staging surface (by design
#   high-churn during spec backfill).
# - references/upstreams/**: vendored external repos; not
#   ours to audit.
excluded_prefixes=(
  'docs/hygiene-history/'
  'openspec/changes/'
  'references/upstreams/'
)

# Guard: the audit must run inside a git worktree. Without this
# check a `git log` failure (missing worktree, corrupt repo,
# unreadable objects) would be masked by `|| true` downstream
# and produce a misleading "no commits" report while exiting 0.
if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "error: tools/hygiene/audit-git-hotspots.sh must run inside a git worktree" >&2
  exit 128
fi

# Count touches: one row per (commit, file) pair. Note that
# `git log --name-only` also lists files touched by deletion
# commits (the path appears even though the file no longer
# exists at HEAD). That's correct for a hotspot report —
# frequent deletion of a path is still friction — so we
# deliberately include deletions in the count rather than
# filter them out.
#
# `sed '/^$/d'` (rather than `grep -v '^$' || true`) is used so
# the empty-output case is handled by sed returning exit 0 with
# an empty string, and any real `git log` failure propagates via
# `set -euo pipefail` instead of being masked by `|| true`.
raw=$(git log --since="$window" --pretty=format: --name-only \
      | sed '/^$/d')

# If the window is empty (new repo, tight window), bail
# gracefully rather than aborting under `set -euo pipefail`.
if [[ -z "$raw" ]]; then
  echo "no commits in window '$window' (or all filtered)" >&2
fi

# Apply exclusions.
filtered="$raw"
for prefix in "${excluded_prefixes[@]}"; do
  filtered=$(printf '%s\n' "$filtered" | grep -v "^$prefix" || true)
done

# Tally by file.
ranked=$(printf '%s\n' "$filtered" | sort | uniq -c | sort -rn)

# Unique author / PR-count per file — best-effort (may undercount
# in squash-merge workflow where PR number appears in the
# commit subject rather than the file touch).
file_summary() {
  local file="$1"
  local touches="$2"
  local authors_raw pr_raw authors pr_count
  # Let `git log` failures propagate — don't mask with `|| true`
  # or redirect stderr to /dev/null, both of which silently turn
  # partial-clone / missing-object errors into fabricated zeros.
  # The empty-match case (file not in window, or no PR tokens in
  # subjects) is handled by counting lines directly: `grep -c`
  # would exit 1 on no matches and trip pipefail, so we pipe
  # through `wc -l` which always exits 0.
  #
  # PR-count parses trailing `(#NNN)` squash-merge markers only.
  # Bare `#NNN` tokens in subjects (e.g. "row #58", "fix #213")
  # are intentionally not counted — they are row IDs / issue
  # refs, not PR numbers, and counting them inflates the metric.
  authors_raw=$(git log --since="$window" --pretty=format:'%an' -- "$file")
  if [[ -z "$authors_raw" ]]; then
    authors=0
  else
    authors=$(printf '%s\n' "$authors_raw" | sort -u | wc -l | tr -d ' ')
  fi
  # Capture subjects first (propagates git log failures under
  # pipefail), then run the grep filter in a context where a
  # no-match result (exit 1) is fine.
  local subjects
  subjects=$(git log --since="$window" --pretty=format:'%s' -- "$file")
  if [[ -z "$subjects" ]]; then
    pr_count=0
  else
    pr_raw=$(printf '%s\n' "$subjects" | grep -oE '\(#[0-9]+\)$' | sort -u || true)
    if [[ -z "$pr_raw" ]]; then
      pr_count=0
    else
      pr_count=$(printf '%s\n' "$pr_raw" | wc -l | tr -d ' ')
    fi
  fi
  printf '| %s | %s | %s | %s |\n' "$file" "$touches" "$authors" "$pr_count"
}

render() {
  printf '# Git hotspots report\n\n'
  printf -- '- **Window:** last %s\n' "$window"
  printf -- '- **Generated:** %s\n' "$(date -u '+%Y-%m-%dT%H:%M:%SZ')"
  printf -- '- **Top:** %s files by touch count\n' "$top"
  printf -- '- **Excluded prefixes:** %s\n\n' "${excluded_prefixes[*]}"

  printf '## Ranking\n\n'
  printf '| file | touches | unique authors | PR count |\n'
  printf '|---|---:|---:|---:|\n'

  # Stream the top-N rows without a `head` pipeline. Piping
  # `printf` into `head -n N` under `set -euo pipefail` can
  # surface as SIGPIPE 141 when `head` closes early on a long
  # ranked list, which would violate the "always exit 0"
  # contract. Iterate + counter instead.
  local count=0
  while IFS= read -r line; do
    [[ -z "$line" ]] && continue
    (( count >= top )) && break
    # Extract touch count (first whitespace-delimited field from
    # `uniq -c` output) without disturbing the rest of the row.
    # `awk '{$1=""; print}'` normalises internal whitespace —
    # that would corrupt filenames containing multiple spaces
    # or tabs. Use a regex that strips exactly the `uniq -c`
    # prefix (leading spaces + count + single space).
    touches=$(printf '%s' "$line" | awk '{print $1}')
    file=$(printf '%s' "$line" | sed -E 's/^[[:space:]]*[0-9]+[[:space:]]//')
    [[ -z "$file" ]] && continue
    file_summary "$file" "$touches"
    count=$((count + 1))
  done <<<"$ranked"

  printf '\n## Suggested actions\n\n'
  printf 'Detection-first. The action below is a prompt for human\n'
  printf 'or Architect judgment, not an enforcement.\n\n'
  printf -- '- **split** — file has become a shared bottleneck; consider\n'
  printf '  per-swim-lane / per-subsystem decomposition\n'
  printf -- '- **freeze** — historical content is append-only; freeze\n'
  printf '  older rows to an archive and keep recent rows hot\n'
  printf -- '- **audit** — hotness may reflect real work; investigate\n'
  printf '  whether churn is healthy or pathological\n'
  printf -- '- **watch** — hot but not yet a problem; leave for next\n'
  printf '  audit cadence\n\n'
  printf '## What this report is NOT\n\n'
  printf -- '- Not an enforcement. The audit exits 0 regardless of\n'
  printf '  findings.\n'
  printf -- '- Not a blame tool. Author counts are descriptive of\n'
  printf '  collaboration shape, not performance.\n'
  printf -- '- Not a complete merge-conflict predictor. Two PRs can\n'
  printf '  conflict on a rarely-touched file; conversely, a\n'
  printf '  very hot file with careful coordination (append-only\n'
  printf '  rows) may see zero conflicts.\n'
}

if [[ -n "$report" ]]; then
  render > "$report"
  echo "Report written: $report" >&2
else
  render
fi
