#!/usr/bin/env bash
#
# tools/skill-catalog/backfill_dv2_frontmatter.sh — mechanical DV-2.0
# frontmatter backfill for SKILL.md files.
#
# Phase-1 deliverable of the BACKLOG row "Data Vault 2.0 provenance as
# scope-universal indexing substrate — rollout beyond the skill catalog"
# (landed 2026-04-22, commit a103f08). An audit on the same day found
# 214 of 216 .claude/skills/**/SKILL.md files missing all five DV-2.0
# fields required by .claude/skills/skill-documentation-standard/SKILL.md:
#
#   record_source    "author, round N" — from first-land commit
#   load_datetime    YYYY-MM-DD — first-land commit date
#   last_updated     YYYY-MM-DD — most-recent change date
#   status           active | draft | stub | dormant | retired  (default: active)
#   bp_rules_cited   [BP-NN, ...] — regex of BP-NN mentions in body
#
# This script is the mechanical cascade: pass any SKILL.md path and the
# missing fields are computed from git history and injected before the
# closing frontmatter fence. Already-present fields are preserved (the
# script is idempotent — re-running on a compliant file is a no-op).
#
# Usage:
#   tools/skill-catalog/backfill_dv2_frontmatter.sh [--dry-run] <path>...
#   tools/skill-catalog/backfill_dv2_frontmatter.sh [--dry-run] --all
#
# Flags:
#   --dry-run    Print the proposed frontmatter to stdout without writing.
#   --all        Process every .claude/skills/**/SKILL.md non-recursively.
#
# Exit codes:
#   0    success (all files processed or already compliant)
#   1    usage error
#   2    a file was malformed (no closing frontmatter fence found)
#
# Intentional non-goals:
#   - Does NOT infer status beyond the safe "active" default. A skill that
#     is actually "stub" or "dormant" keeps the default until a human or
#     skill-improver review flips it. This preserves honesty: the default
#     is load-bearing, not a guess.
#   - Does NOT touch the description field. If the description is stale
#     or wrong, that is a skill-tune-up finding, not a mechanical fix.
#   - Does NOT delete any existing field. Only appends missing ones.
#   - Does NOT run git commit. The caller decides batching and commit
#     messages; this script just rewrites files.

set -euo pipefail

DRY_RUN=0
ALL=0
FILES=()

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run) DRY_RUN=1; shift ;;
    --all)     ALL=1; shift ;;
    -h|--help)
      sed -n '3,46p' "$0"
      exit 0
      ;;
    -*)
      echo "error: unknown flag: $1" >&2
      exit 1
      ;;
    *)
      FILES+=("$1"); shift
      ;;
  esac
done

if [[ $ALL -eq 1 ]]; then
  if [[ ${#FILES[@]} -gt 0 ]]; then
    echo "error: --all is mutually exclusive with explicit paths" >&2
    exit 1
  fi
  while IFS= read -r -d '' f; do
    FILES+=("$f")
  done < <(find .claude/skills -maxdepth 2 -name 'SKILL.md' -type f -print0 | sort -z)
fi

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "usage: $0 [--dry-run] <SKILL.md path>... | --all" >&2
  exit 1
fi

TODAY="$(date -u +%Y-%m-%d)"

# field_present FIELD FILE -> 0 if the frontmatter already has this field.
field_present() {
  awk -v field="$1" '
    /^---$/ { dash++; if (dash == 2) exit 1; next }
    dash == 1 && $0 ~ "^" field ":" { found = 1; exit 0 }
    END { exit (found ? 0 : 1) }
  ' "$2"
}

# compute_record_source FILE -> "<author-heuristic>, round N"
compute_record_source() {
  local file="$1" subj
  subj=$(git log --reverse --format='%s' -- "$file" 2>/dev/null | head -n 1)
  if [[ "$subj" =~ [Rr]ound\ *([0-9]+) ]]; then
    echo "skill-creator, round ${BASH_REMATCH[1]}"
  else
    # No round marker found — still honest: cite the author and date only.
    local author_date
    author_date=$(git log --reverse --format='%an on %ai' -- "$file" 2>/dev/null | head -n 1 | awk '{print $1" "$2" on "$4}')
    echo "git: ${author_date:-unknown}"
  fi
}

# compute_load_datetime FILE -> YYYY-MM-DD of first-land commit
compute_load_datetime() {
  local file="$1"
  git log --reverse --format='%ai' -- "$file" 2>/dev/null | head -n 1 | awk '{print $1}'
}

# compute_last_updated FILE -> YYYY-MM-DD of most-recent commit touching it
compute_last_updated() {
  local file="$1"
  git log -1 --format='%ai' -- "$file" 2>/dev/null | awk '{print $1}'
}

# compute_bp_rules FILE -> [BP-NN, BP-NN, ...] (YAML inline list; empty list if none)
compute_bp_rules() {
  local file="$1" rules
  rules=$(grep -oE 'BP-[0-9]+' "$file" 2>/dev/null | sort -u | paste -sd, - | sed 's/,/, /g')
  if [[ -z "$rules" ]]; then
    echo "[]"
  else
    echo "[${rules}]"
  fi
}

# process_one FILE -> rewrite frontmatter (or dry-run-print)
process_one() {
  local file="$1"
  if [[ ! -f "$file" ]]; then
    echo "warn: skipping non-file: $file" >&2
    return 0
  fi

  # Verify frontmatter is well-formed: exactly two `---` fences near the top.
  local dash_count
  dash_count=$(awk '/^---$/ { n++ } END { print n+0 }' "$file")
  if [[ "$dash_count" -lt 2 ]]; then
    echo "error: $file has no closing frontmatter fence" >&2
    return 2
  fi

  # Compute each missing field.
  local -a inject=()
  if ! field_present "record_source" "$file"; then
    inject+=("record_source: \"$(compute_record_source "$file")\"")
  fi
  if ! field_present "load_datetime" "$file"; then
    inject+=("load_datetime: \"$(compute_load_datetime "$file")\"")
  fi
  if ! field_present "last_updated" "$file"; then
    local last_updated
    last_updated="$(compute_last_updated "$file")"
    inject+=("last_updated: \"${last_updated:-$TODAY}\"")
  fi
  if ! field_present "status" "$file"; then
    inject+=("status: active")
  fi
  if ! field_present "bp_rules_cited" "$file"; then
    inject+=("bp_rules_cited: $(compute_bp_rules "$file")")
  fi

  if [[ ${#inject[@]} -eq 0 ]]; then
    echo "ok   $file (already compliant)"
    return 0
  fi

  if [[ $DRY_RUN -eq 1 ]]; then
    echo "--- $file (dry-run, would inject ${#inject[@]} field(s)):"
    printf '    %s\n' "${inject[@]}"
    return 0
  fi

  # Inject the missing fields immediately before the closing `---`.
  # awk's `-v VAR=...` cannot accept multi-line values, so we pass the
  # blob via the environment and read ENVIRON["INJECT_BLOB"] inside awk.
  local tmp
  tmp=$(mktemp)
  INJECT_BLOB="$(printf '%s\n' "${inject[@]}")" awk '
    BEGIN { dash = 0; blob = ENVIRON["INJECT_BLOB"] }
    /^---$/ {
      dash++
      if (dash == 2) {
        # blob carries a trailing newline from printf; chop it so we do
        # not emit a blank line before the closing fence.
        sub(/\n$/, "", blob)
        print blob
        print
        next
      }
    }
    { print }
  ' "$file" > "$tmp"
  mv "$tmp" "$file"
  echo "wrote $file (${#inject[@]} field(s) added)"
}

RC=0
for f in "${FILES[@]}"; do
  process_one "$f" || RC=$?
done
exit "$RC"
