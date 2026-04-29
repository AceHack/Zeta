#!/usr/bin/env bash
#
# tools/lint/no-directives-otto-prose.sh — advisory lint that flags
# Otto-authored prose using "directive" framing for maintainer input
# in CHANGED FILES (diff-based; does not retrofit historical content).
#
# Born 2026-04-29 after the ~15th iteration of the same gremlin: a
# memory file or PR title casting maintainer correction/framing/input
# as "the maintainer's directive," which collapses self-provenance
# into bot-execution and undermines the no-directives autonomy rule
# (memory/feedback_otto_357_no_directives_aaron_makes_autonomy_first_class_accountability_mine_2026_04_27.md).
#
# Vigilance failed; lint is the durable answer.
#
# Per the "agency-framing lexeme guard" naming distinction (this is
# a LEXEME GUARD, not a LANE LOCK; lane locks stop classes of work,
# lexeme guards stop repeated wording drift) — the corresponding
# external-anchor / observer-legibility rule lives in
# memory/feedback_beacon_promotion_load_bearing_rules_earn_external_anchors_aaron_amara_2026_04_28.md.
#
# Per the B-0105 consolidation-pass carve-out: "tiny enforcement
# patches are allowed when they directly prevent repeated
# consolidation-gate violations."
#
# (Named-attribution carve-out: tooling-surface comments use
# role-refs per docs/AGENT-BEST-PRACTICES.md §named-attribution-
# carve-out. Persona names + dated review rounds belong on history
# surfaces — research notes, memory files, commit messages, tick
# shards — not in tooling source.)
#
# PORTABILITY:
#   This is a Bash + GNU-tooling-leaning advisory lint. NOT POSIX.
#   - Uses Bash here-strings (`<<<`), `set -euo pipefail`, etc.
#   - The PATTERN uses POSIX-portable explicit non-alpha boundaries
#     `(^|[^[:alnum:]_])` rather than `\b` (BSD grep treats `\b` as
#     a literal backspace; `\b` is non-portable even with `-E`).
#   - Targets: Linux CI runners + the 4-shell developer target
#     (macOS bash 3.2+ / Ubuntu / git-bash / WSL).
#
# SCOPE — two modes:
#   pr (default)         — diff between BASE_REF and HEAD; matches
#                           the CI/PR-check use case. Misses local
#                           working-tree edits before commit.
#   worktree             — includes unstaged + staged + committed
#                           changes; matches the local pre-commit
#                           use case.
#
# Diff-based scope (both modes — avoids retrofitting historical):
#   - changed files (per SCOPE)
#   - intersected with Otto-authored prose surfaces:
#     - memory/*.md (top-level; not memory/persona/)
#     - docs/hygiene-history/ticks/**/*.md (tick shards)
#     - docs/research/*.md (research notes)
#     - .github/copilot-instructions.md
#
# Pattern (per Amara's narrowed regex):
#   "Aaron's directive" / "maintainer directive" / "QoL directive" /
#   "human directive" / "directive from Aaron" / etc.
#
# Whitelist (NOT flagged in changed files):
#   - lines starting with `> ` (markdown blockquote — usually quoted
#     third-party text)
#   - the rule-documentation files themselves
#   - HTML comments and paired-edit markers ARE in scope (the
#     paired-edit comment with "directive" in MEMORY.md was the
#     proof-case that motivated this lint).
#
# Usage:
#   tools/lint/no-directives-otto-prose.sh                 # PR-diff advisory
#   tools/lint/no-directives-otto-prose.sh --strict        # PR-diff strict
#   SCOPE=worktree tools/lint/no-directives-otto-prose.sh  # local pre-commit
#
# Env:
#   BASE_REF — base ref to diff against in pr mode (default: origin/main).
#              CI should set BASE_REF=$BASE_SHA.
#   SCOPE    — "pr" (default) or "worktree".

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

MODE="${1:-advisory}"
BASE_REF="${BASE_REF:-origin/main}"
SCOPE="${SCOPE:-pr}"

# Compute changed files per SCOPE. NOTE: do NOT suppress git-diff
# errors with `2>/dev/null || true` — that turns "couldn't resolve
# BASE_REF" into "no changed files; skipping" silently and makes
# the lint look clean when nothing was actually checked.
if [ "$SCOPE" = "worktree" ]; then
  # AMR catches added + modified + renamed (so a renamed prose
  # file with new violations is included). Copies are intentionally
  # omitted here (no need for content-equivalence in this lint;
  # only added-line discipline matters).
  CHANGED_FILES=$(
    {
      git diff --name-only --diff-filter=AMR
      git diff --cached --name-only --diff-filter=AMR
      git diff --name-only --diff-filter=AMR "$BASE_REF...HEAD"
    } | sort -u
  )
else
  CHANGED_FILES=$(git diff --name-only --diff-filter=AMR "$BASE_REF...HEAD")
fi

if [ -z "$CHANGED_FILES" ]; then
  echo "no-directives-otto-prose: no changed files vs $BASE_REF; skipping"
  exit 0
fi

# Filter to Otto-authored prose surfaces only.
PROSE_FILES=$(printf '%s\n' "$CHANGED_FILES" | grep -E '^(memory/[^/]+\.md|docs/hygiene-history/ticks/.*\.md|docs/research/[^/]+\.md|\.github/copilot-instructions\.md)$' || true)

if [ -z "$PROSE_FILES" ]; then
  echo "no-directives-otto-prose: no Otto-prose surfaces changed; skipping"
  exit 0
fi

# Skip rule-documentation files where "directive" appears legitimately.
PROSE_FILES=$(printf '%s\n' "$PROSE_FILES" | grep -vE '(feedback_input_is_not_directive_|feedback_otto_357_no_directives_|feedback_free_will_is_paramount_external_directives_|no-directives-otto-prose)' || true)

if [ -z "$PROSE_FILES" ]; then
  echo "no-directives-otto-prose: only rule-docs touched; skipping"
  exit 0
fi

# Pattern: portable explicit non-alpha boundary instead of `\b`
# (BSD grep treats `\b` as literal backspace; not POSIX-portable
# even with `-E`). Same approach as tools/lint/runner-version-
# freshness.sh. Note: persona names that appear here are TOKENS
# the lint LOOKS FOR in flagged content (not authorial content);
# this is the data of the lint, not its prose register.
PATTERN='(^|[^[:alnum:]_])(maintainer|QoL|human)[^|]*directive([^[:alnum:]_]|$)|(^|[^[:alnum:]_])directive[^|]*(maintainer|QoL|human)([^[:alnum:]_]|$)|(^|[^[:alnum:]_])([A-Z][a-z]+'\''?s)[[:space:]]+directive([^[:alnum:]_]|$)|(^|[^[:alnum:]_])directive[[:space:]]+from[[:space:]]+([A-Z][a-z]+)([^[:alnum:]_]|$)'

# Use mktemp with explicit template — bare `mktemp` fails on
# some BSD/macOS configurations (see tools/lint/runner-version-
# freshness.sh for prior precedent).
HITS_FILE="$(mktemp -t no-directives.XXXXXX)"
FILTERED_HITS_FILE="$(mktemp -t no-directives-filtered.XXXXXX)"
trap 'rm -f "$HITS_FILE" "$FILTERED_HITS_FILE"' EXIT

# Search only the ADDED/MODIFIED diff hunks (not entire file
# bodies) — pre-existing "Aaron's directive" in a touched file
# should not flag; only newly-added or modified lines should.
# Use `git diff -U0` to strip context lines + grep for `^+` to
# isolate added lines (not `^+++` file headers).
ADDED_LINES_FILE="$(mktemp -t no-directives-added.XXXXXX)"
trap 'rm -f "$HITS_FILE" "$FILTERED_HITS_FILE" "$ADDED_LINES_FILE"' EXIT

# Build added-lines stream "FILE\tCONTENT\n" per added line, where
# FILE is the prose-file path and CONTENT is the post-strip line
# body (no leading `+`). TAB is chosen because filenames cannot
# contain TAB inside this codebase, so it's a safe delimiter and
# avoids the previous ":"-based 4-field confusion that caused
# blockquote-filter false negatives + filename-substring matches.
#
# Single awk pass per file:
#   - skip diff metadata (@@, +++, --- headers, "\ No newline")
#   - emit only `^+` content lines (with leading `+` stripped)
# Then pattern-match + blockquote-filter on CONTENT field only,
# eliminating the file-path-contains-"human"/"maintainer" false-
# positive class entirely.
while IFS= read -r f; do
  [ -z "$f" ] && continue
  [ -f "$f" ] || continue
  if [ "$SCOPE" = "worktree" ]; then
    {
      git diff -U0 -- "$f"
      git diff --cached -U0 -- "$f"
      git diff -U0 "$BASE_REF...HEAD" -- "$f"
    }
  else
    git diff -U0 "$BASE_REF...HEAD" -- "$f"
  fi | awk -v file="$f" '
    # Skip "\ No newline at end of file" — diff metadata, not a
    # real file line. Skip hunk headers, file headers, and -lines.
    /^\\ No newline/ { next }
    /^@@/ { next }
    /^---/ { next }
    /^\+\+\+/ { next }
    /^-/ { next }
    /^\+/ {
      content = substr($0, 2)
      # Emit FILE\tCONTENT (TAB-delimited; safe because prose
      # paths under memory/, docs/, .github/ never contain TABs).
      printf "%s\t%s\n", file, content
    }
  ' >> "$ADDED_LINES_FILE"
done <<< "$PROSE_FILES"

# Pattern-match + blockquote-filter on CONTENT field only.
# Anchoring the match to the content portion (post-TAB) prevents
# filename-substring false positives like
# `feedback_human_lineage_anchors_*.md` matching the "human"
# token in PATTERN. Also drops blockquote-prefixed CONTENT
# (quoted third-party text); the FILE field never starts with
# `>` so filtering on content alone is correct.
#
# Pattern-match runs inside awk so we can apply it to the
# CONTENT field after the TAB. awk's regex engine accepts ERE
# without `\b` (we use the same explicit-non-alpha boundary
# approach as the PATTERN variable).
awk -F'\t' -v pattern="$PATTERN" '
NF >= 2 {
  file = $1
  content = $2
  # Drop blockquote-prefixed quoted text.
  if (content ~ /^[[:space:]]*>/) next
  # Apply pattern against CONTENT only.
  if (content ~ pattern) {
    printf "%s: %s\n", file, content
  }
}
' "$ADDED_LINES_FILE" > "$FILTERED_HITS_FILE"

HIT_COUNT=$(wc -l < "$FILTERED_HITS_FILE" | tr -d ' ')

if [ "$HIT_COUNT" -gt 0 ]; then
  echo "no-directives-otto-prose: found $HIT_COUNT candidate hit(s) in added Otto-prose lines:" >&2
  cat "$FILTERED_HITS_FILE" >&2
  echo "" >&2
  echo "Prose framing maintainer input as 'directive' (Aaron's directive /" >&2
  echo "maintainer directive / QoL directive / human directive) collapses" >&2
  echo "self-provenance into bot-execution. Use 'input' / 'framing' /" >&2
  echo "'correction' / 'pass' instead." >&2
  echo "See memory/feedback_otto_357_no_directives_aaron_makes_autonomy_first_class_accountability_mine_2026_04_27.md" >&2
  if [ "$MODE" = "--strict" ]; then
    exit 1
  fi
  echo "(advisory mode; not failing build — pass --strict to fail)" >&2
  exit 0
fi

echo "no-directives-otto-prose: clean (0 candidate hits in added Otto-prose lines)"
