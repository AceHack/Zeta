#!/usr/bin/env bash
#
# tools/hygiene/check-no-conflict-markers.sh — fails the build if
# any committed file contains git merge-conflict markers
# (`<<<<<<<`, `=======`, `>>>>>>>`).
#
# Why this exists (Aaron 2026-04-26):
#   "maybe we should hygene for <<<<<<< HEAD and >>>>>>> ======= things
#    like that in our files incase we ever accidently botch a merge,
#    happens to the best of us humans too."
#
#   Botched merges leak conflict markers into committed files. Per
#   Otto-339 anywhere-means-anywhere: those markers in substrate
#   would shift weights wrongly when read by AI. Per Otto-341
#   mechanism-not-vigilance: a CI check catches this regardless of
#   which agent / human / harness produced the merge.
#
# What this checks:
#   - All tracked files (via `git ls-files`) for the three conflict
#     marker patterns at line-start
#   - Reports first violations with file + line number
#   - Exits non-zero if any are found
#
# What this does NOT check:
#   - Other tools' specific conflict markers (Mercurial, etc.) —
#     repo is git, only git markers matter
#   - File content within blocks — only the markers at line-start
#   - Untracked files — only committed/staged matters
#
# Composes with:
#   - tools/hygiene/check-tick-history-order.sh (other substrate
#     integrity check)
#   - .github/workflows/gate.yml (wired as a lint job)
#
# Self-test:
#   $ tools/hygiene/check-no-conflict-markers.sh
#     → exit 0 if clean
#     → exit 1 with diagnostic if conflict markers found

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

# This script itself documents the conflict marker patterns. Skip
# self-match by excluding this file from the search.
SELF_PATH="tools/hygiene/check-no-conflict-markers.sh"

# Files where conflict-marker discussion is legitimate (e.g.,
# documentation explaining merge resolution, this script, or
# substrate captures of conflict-resolution work). Add here as
# needed; keep the list short and explicit.
ALLOWLIST=(
  "$SELF_PATH"
  # Substrate / research files documenting merge-conflict resolution
  # discipline. They legitimately contain the marker tokens as
  # examples. Allowed because the file body is meta-discussion not
  # accidental marker leakage.
  "memory/feedback_otto_341_lint_suppression_is_self_deception_noise_signal_or_underlying_fix_greenfield_large_refactors_welcome_training_data_human_shortcut_bias_2026_04_26.md"
)

is_allowed() {
  local path="$1"
  for allowed in "${ALLOWLIST[@]}"; do
    if [[ "$path" == "$allowed" ]]; then
      return 0
    fi
  done
  return 1
}

# Search at line-start (^) — accidental conflict markers are always
# at column 1. This also avoids false positives in legitimate
# content that mentions the marker tokens inline (in prose).
PATTERN='^(<<<<<<<[[:space:]]|=======$|>>>>>>>[[:space:]])'

violations=0
first_hit=""

while IFS= read -r file; do
  if is_allowed "$file"; then
    continue
  fi
  if [[ ! -f "$file" ]]; then
    continue
  fi
  # Use grep -E with line numbers; binary files quietly skipped.
  if hits=$(grep -nE "$PATTERN" "$file" 2>/dev/null); then
    while IFS= read -r line; do
      violations=$((violations + 1))
      if [[ -z "$first_hit" ]]; then
        first_hit="$file:$line"
      fi
      echo "VIOLATION: $file:$line" >&2
    done <<< "$hits"
  fi
done < <(git ls-files)

if [[ $violations -gt 0 ]]; then
  echo "" >&2
  echo "FAIL: $violations git merge-conflict marker line(s) found in committed files" >&2
  echo "" >&2
  echo "First hit: $first_hit" >&2
  echo "" >&2
  echo "How to fix:" >&2
  echo "  - Open each flagged file" >&2
  echo "  - Resolve the conflict (pick one side, both sides, or" >&2
  echo "    re-merge manually); REMOVE all marker lines" >&2
  echo "  - Verify by re-running this script (exit 0 = clean)" >&2
  echo "" >&2
  echo "If a file legitimately discusses these markers (docs about" >&2
  echo "merge resolution, this script itself, or substrate files" >&2
  echo "documenting merge-conflict-resolution work), add the path" >&2
  echo "to the ALLOWLIST in this script." >&2
  exit 1
fi

echo "OK: no git merge-conflict markers found in committed files"
exit 0
