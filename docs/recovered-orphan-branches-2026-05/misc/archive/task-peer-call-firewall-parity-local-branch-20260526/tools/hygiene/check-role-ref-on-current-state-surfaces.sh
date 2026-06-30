#!/usr/bin/env bash
#
# tools/hygiene/check-role-ref-on-current-state-surfaces.sh —
# validates that current-state surfaces (CLAUDE.md, AGENTS.md,
# GOVERNANCE.md, ALIGNMENT.md, etc.) use role-refs rather than
# direct name attribution per the Otto-279 carve-out documented at
# docs/AGENT-BEST-PRACTICES.md.
#
# Why this exists (B-0162; 5 catches on PR #1202 alone):
#   The role-ref convention failure mode recurred 5 times in one
#   session (H0Ro / H1ws / H3eE / H8A0+A5 / H9dy on PR #1202).
#   Each catch cost ~5-10 minutes thread-resolution work. Total
#   spent: ~25-50 min. Mechanization estimate: ~30-60 min. Past
#   breakeven; pre-commit catch is faster than post-commit Copilot
#   catch.
#
#   Per Otto-341 (mechanism over vigilance) + Otto-346 (recurring
#   pattern → substrate primitive missing): the right shape is a
#   CI lint that fails when a current-state surface contains direct
#   name attribution for known persona / human-maintainer / external-
#   AI-instance names.
#
# What this checks:
#   For every file in the closed current-state-surface list:
#   - Scan for `\b<Name>\b` patterns where <Name> is in the
#     known-roster (parsed from docs/EXPERT-REGISTRY.md +
#     hardcoded human-maintainer / external-AI names)
#   - Distinguish attribution (Name + date OR Name + ' grants ' / 'said'
#     etc.) from rule-references (Name-NN, Name's <noun-phrase>)
#   - Report violations with file/line/suggested-fix
#   - Exit non-zero on any violation
#
# What this does NOT do:
#   - Does NOT scan history surfaces (memory/, docs/research/**,
#     docs/ROUND-HISTORY.md, docs/DECISIONS/**, docs/aurora/**,
#     docs/hygiene-history/**, commit messages)
#   - Does NOT auto-fix
#   - Does NOT enforce on lines that legitimately reference names
#     (rule references like "Otto-279" or quoted material)
#
# Composes with:
#   - docs/AGENT-BEST-PRACTICES.md (Otto-279 carve-out)
#   - tools/hygiene/audit-orphan-role-refs.sh (post-strip lint)
#   - tools/hygiene/check-archive-header-section33.ts (sibling pattern;
#     .sh removed 2026-05-03 after #1380 .sh→.ts CI conversion)
#   - .github/workflows/gate.yml (wired as a lint job — TODO)
#
# Self-test:
#   $ tools/hygiene/check-role-ref-on-current-state-surfaces.sh
#     → exit 0 if all current-state surfaces are clean
#     → exit 1 with per-file diagnostic if any direct name
#       attribution is found

set -euo pipefail

# Soft-launch flag: when set, exit 0 even on violations (warnings printed
# but build doesn't fail). Per B-0162 acceptance criteria:
#   "Soft-launch: ship as warning-only first, then promote to error after
#   a soak period (existing pattern per check-tick-history-shard-schema.sh)."
SOFT_LAUNCH="${ROLE_REF_CHECK_SOFT_LAUNCH:-1}"

# CLI flag override
if [[ "${1:-}" == "--strict" ]]; then
  SOFT_LAUNCH=0
fi

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$REPO_ROOT"

# Closed-list of current-state surfaces (per Otto-279 carve-out: any
# surface NOT in the history-surface allow-list)
CURRENT_STATE_SURFACES=(
  "CLAUDE.md"
  "AGENTS.md"
  "GOVERNANCE.md"
  "docs/ALIGNMENT.md"
  "docs/CONFLICT-RESOLUTION.md"
  "docs/AGENT-BEST-PRACTICES.md"
  "docs/GLOSSARY.md"
  "docs/WONT-DO.md"
  "docs/VISION.md"
  "docs/ROADMAP.md"
  ".claude/skills/**/SKILL.md"
  ".claude/agents/*.md"
)

# Parse persona-roster from docs/EXPERT-REGISTRY.md
# Format expected: lines containing | **Role** | **Name** | ... |
# Extract the bolded name in column 2.
ROSTER_NAMES=()
if [[ -f "docs/EXPERT-REGISTRY.md" ]]; then
  while IFS= read -r name; do
    [[ -n "$name" ]] && ROSTER_NAMES+=("$name")
  done < <(
    grep -E '^\| \*\*[A-Za-z][^|]*\*\* \| \*\*[A-Z][a-z]+\*\* \|' docs/EXPERT-REGISTRY.md \
      | sed -E 's/^\| \*\*[^|]+\*\* \| \*\*([A-Z][a-z]+)\*\* \|.*/\1/'
  )
fi

# Plus persona names that don't appear in EXPERT-REGISTRY but are
# load-bearing in this project's substrate
EXTRA_PERSONAS=("Otto" "Amara" "Ani" "Sova" "Rodney" "Nazar" "Ilyana")

# Plus human-maintainer names (CURRENT-*.md filenames define this)
HUMAN_NAMES=("Aaron" "Max")

# Plus external-AI-instance names (when used as instance attribution,
# NOT as tool/SDK references)
EXTERNAL_AI_NAMES=("Claude.ai" "Codex" "Gemini")

ALL_NAMES=("${ROSTER_NAMES[@]}" "${EXTRA_PERSONAS[@]}" "${HUMAN_NAMES[@]}" "${EXTERNAL_AI_NAMES[@]}")

VIOLATIONS=0

# Expand the surface list — entries containing glob characters
# (`*` / `?`) are expanded via `find` so the script stays portable
# across macOS bash 3.2 / Ubuntu / git-bash / WSL (Otto-235 4-shell
# compat target). Literal entries pass through unchanged.
#
# Recognised glob shapes:
#   - "<dir>/**/<name>" → recursive find for files named <name> under <dir>
#   - "<dir>/*<suffix>" → non-recursive find at depth 1 matching <suffix>
#   - "<dir>/*"         → all files at depth 1 under <dir>
EXPANDED_SURFACES=()
for entry in "${CURRENT_STATE_SURFACES[@]}"; do
  if [[ "$entry" == *'**'* ]]; then
    # Recursive form: split on '**'
    prefix="${entry%%/\*\*/*}"
    leaf="${entry##*/\*\*/}"
    if [[ -d "$prefix" ]]; then
      while IFS= read -r m; do
        [[ -n "$m" && -f "$m" ]] && EXPANDED_SURFACES+=("$m")
      done < <(find "$prefix" -type f -name "$leaf" 2>/dev/null)
    fi
  elif [[ "$entry" == *'*'* || "$entry" == *'?'* ]]; then
    # Non-recursive form
    dir="${entry%/*}"
    pat="${entry##*/}"
    if [[ -d "$dir" ]]; then
      while IFS= read -r m; do
        [[ -n "$m" && -f "$m" ]] && EXPANDED_SURFACES+=("$m")
      done < <(find "$dir" -maxdepth 1 -type f -name "$pat" 2>/dev/null)
    fi
  else
    EXPANDED_SURFACES+=("$entry")
  fi
done

for surface in "${EXPANDED_SURFACES[@]}"; do
  [[ ! -f "$surface" ]] && continue

  for name in "${ALL_NAMES[@]}"; do
    # Skip empty names
    [[ -z "$name" ]] && continue

    # Pattern: word-boundary name followed by attribution context.
    # Attribution-context patterns that indicate violation:
    #   - "Name YYYY-MM-DD" (date-stamped attribution)
    #   - "Per Name" (per-attribution)
    #   - "Name's <verb>" (Name's said/grants/proposed/etc.)
    #
    # Exclude (rule references, NOT violations):
    #   - "Name-NN" (Otto-279, Otto-340 — rule numbers)
    #   - Inline code: `Name` in backticks
    #
    # The grep pattern below captures attribution forms.
    # For Claude.ai we need a slightly different boundary handling
    # because of the dot.

    if [[ "$name" == "Claude.ai" ]]; then
      pattern="\\bClaude\\.ai( 2026|: |[ '][a-z])"
    else
      pattern="\\b${name}( 2026| 2027|'s [a-z]| said| grants| proposed| asked| corrected| confirmed| disclosed)"
    fi

    # grep for the pattern, exclude inline-code lines (start with ` or contain `<name>`)
    matches=$(grep -nE "$pattern" "$surface" 2>/dev/null \
      | grep -v -E '^[0-9]+:\s*```' \
      | grep -v -F "\`${name}\`" \
      || true)

    if [[ -n "$matches" ]]; then
      while IFS= read -r line; do
        # Extract line number for clearer reporting
        echo "VIOLATION: ${surface}: direct name attribution '${name}' on current-state surface" >&2
        echo "  ${line}" >&2
        echo "  Fix: replace with role-ref (e.g., 'the human maintainer', 'the architect')" >&2
        echo "       OR move to history surface (memory/, docs/research/**, etc.)" >&2
        VIOLATIONS=$((VIOLATIONS + 1))
      done <<< "$matches"
    fi
  done
done

echo "" >&2
echo "checked ${#EXPANDED_SURFACES[@]} current-state surfaces (from ${#CURRENT_STATE_SURFACES[@]} patterns); ${VIOLATIONS} violations" >&2

if [[ $VIOLATIONS -gt 0 ]]; then
  echo "" >&2
  echo "Per docs/AGENT-BEST-PRACTICES.md Otto-279 carve-out:" >&2
  echo "  current-state surfaces use role-refs ('the maintainer', 'the architect')" >&2
  echo "  persona / human / external-AI names are reserved for history surfaces" >&2
  echo "  (memory/**, docs/research/**, docs/ROUND-HISTORY.md, docs/DECISIONS/**," >&2
  echo "   docs/aurora/**, docs/hygiene-history/**, commit messages)" >&2
  if [[ "$SOFT_LAUNCH" == "1" ]]; then
    echo "" >&2
    echo "[SOFT-LAUNCH MODE: exit 0 despite violations. Set --strict OR" >&2
    echo " ROLE_REF_CHECK_SOFT_LAUNCH=0 to enforce.]" >&2
    exit 0
  fi
  exit 1
fi

exit 0
