#!/usr/bin/env bash
#
# tools/hygiene/audit-post-setup-script-stack.sh — detects bash /
# PowerShell scripts under `tools/` that live outside the exempt
# paths declared in `docs/POST-SETUP-SCRIPT-STACK.md`. These are
# post-setup-stack-rule violations: post-setup tooling should be
# bun + TypeScript by default.
#
# Ships the detection side of the post-setup-stack hygiene layer
# (FACTORY-HYGIENE row #46). The prevention side is the author-time
# decision-flow doc `docs/POST-SETUP-SCRIPT-STACK.md`; this script
# does not prevent, it detects.
#
# Classification:
#   - exempt    path matches an exempt pattern (tools/setup/**,
#               .claude/skills/**/scripts/**, tools/_deprecated/**)
#   - labelled  bash script with a header comment block naming
#               one of the five exception categories from
#               docs/POST-SETUP-SCRIPT-STACK.md Q3:
#                 * bun+TS migration candidate
#                 * bash scaffolding
#                 * thin wrapper over existing CLI
#                 * trivial find-xargs pipeline
#                 * stay bash forever (recorded decision)
#   - violation bash / PowerShell under tools/ outside exempt
#               paths, without an exception label
#
# Usage:
#   tools/hygiene/audit-post-setup-script-stack.sh [--summary]
#
# Exit codes:
#   0    no new violations (labelled + exempt are acceptable)
#   1    usage error
#   2    one or more new violations surfaced
#
# Self-referential note: this script is itself bash. Exception
# label: "bash scaffolding" — the hygiene tooling has to exist
# before bun+TS tooling ships, so the audit can run. Queued for
# bun+TS migration alongside backfill_dv2_frontmatter.sh in
# docs/BACKLOG.md.

set -euo pipefail

SUMMARY=0
case "${1:-}" in
  --summary) SUMMARY=1 ;;
  -h|--help)
    sed -n '3,33p' "$0"
    exit 0
    ;;
  "") ;;
  *)
    echo "error: unknown arg: $1" >&2
    exit 1
    ;;
esac

# Collect every shell / PowerShell script under tools/. Use
# `git ls-files` so vendored / gitignored build caches (e.g.,
# tools/lean4/.lake/packages/**) are excluded — they are upstream
# third-party code, not factory-authored. Use while-read rather
# than mapfile for bash 3.2 (macOS default) compatibility.
# NUL-delimited to tolerate whitespace in paths.
ALL_SCRIPTS=()
while IFS= read -r -d '' f; do
  ALL_SCRIPTS+=("$f")
done < <(git ls-files -z 'tools/*.sh' 'tools/*.ps1' 'tools/**/*.sh' 'tools/**/*.ps1' | sort -z)

EXEMPT=()
LABELLED=()
VIOLATIONS=()

# is_exempt PATH -> 0 if path is in an exempt subtree.
is_exempt() {
  case "$1" in
    tools/setup/*) return 0 ;;
    tools/_deprecated/*) return 0 ;;
    *) return 1 ;;
  esac
}

# has_label PATH -> 0 if the file's first ~60 lines carry an
# exception label matching the allowed patterns. 60 rather than
# 40 to accommodate scripts with long usage/rationale headers.
has_label() {
  head -60 "$1" | grep -qE '(bun\+TS migration candidate|bash scaffolding|thin wrapper over existing CLI|trivial find-xargs pipeline|stay bash forever)'
}

for s in "${ALL_SCRIPTS[@]}"; do
  if is_exempt "$s"; then
    EXEMPT+=("$s")
  elif has_label "$s"; then
    LABELLED+=("$s")
  else
    VIOLATIONS+=("$s")
  fi
done

if [[ $SUMMARY -eq 1 ]]; then
  printf 'exempt:     %d\n' "${#EXEMPT[@]}"
  printf 'labelled:   %d\n' "${#LABELLED[@]}"
  printf 'violations: %d\n' "${#VIOLATIONS[@]}"
else
  echo "# Post-setup script stack audit"
  echo
  echo "Run: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
  echo "Authoritative rule: docs/POST-SETUP-SCRIPT-STACK.md"
  echo
  echo "## Exempt (${#EXEMPT[@]})"
  if [[ ${#EXEMPT[@]} -gt 0 ]]; then
    printf -- '- %s\n' "${EXEMPT[@]}"
  else
    echo "- (none)"
  fi
  echo
  echo "## Labelled exceptions (${#LABELLED[@]})"
  if [[ ${#LABELLED[@]} -gt 0 ]]; then
    printf -- '- %s\n' "${LABELLED[@]}"
  else
    echo "- (none)"
  fi
  echo
  echo "## Violations (${#VIOLATIONS[@]})"
  if [[ ${#VIOLATIONS[@]} -gt 0 ]]; then
    printf -- '- %s\n' "${VIOLATIONS[@]}"
    echo
    echo "Each violation must either (a) gain an exception label"
    echo "header comment (see docs/POST-SETUP-SCRIPT-STACK.md Q3"
    echo "exceptions), (b) migrate to bun + TypeScript under"
    echo "tools/**/*.ts, or (c) move to tools/_deprecated/ if"
    echo "unused."
  else
    echo "- (none — clean)"
  fi
fi

if [[ ${#VIOLATIONS[@]} -gt 0 ]]; then
  exit 2
fi
exit 0
