#!/usr/bin/env bash
#
# tools/lint/doc-comment-history-audit.sh — scan source doc comments
# for factory-process tokens that belong in PR descriptions, history
# files, or round-notes rather than in code.
#
# The rule: a code-file comment (`///`, `//`, `#`) should explain
# what the code DOES — math, invariants, input contracts,
# composition guidance. It should not carry process-lineage tags
# (which round shipped it, which external collaborator formalised
# it, which correction number motivated a tweak, which persona
# takes credit). That content belongs in the PR description, the
# commit message, `docs/hygiene-history/**`, or memory files.
#
# Scope:
#   - src/**/*.fs, src/**/*.cs
#   - tests/**/*.fs, tests/**/*.cs
#   - bench/**/*.fs
#   - tools/**/*.sh, tools/**/*.ts, tools/**/*.fs
#
# NOT scanned (these legitimately carry history):
#   - docs/hygiene-history/**, docs/DECISIONS/**, docs/ROUND-HISTORY.md
#   - openspec/** (spec files — history is part of the spec)
#   - memory/** (memory is by design historical)
#   - .git/, bin/, obj/, vendored mirrors
#
# Flagged tokens are defined in TOKEN_PATTERN below. Each token is
# chosen for high signal + low false-positive rate: factory-process
# terms (round tags, personas by name, cadence jargon) and
# attribution-paragraph headers. If a token produces false
# positives in legitimate code, tighten the regex rather than
# allowlisting the file.
#
# Only scans COMMENT LINES (lines whose first non-whitespace is one
# of `///`, `//`, `#`). Prose matching in code bodies is not a
# concern — if a flagged token appears in a string literal or
# variable name that's a separate conversation.
#
# Usage:
#   tools/lint/doc-comment-history-audit.sh
#                         # audit mode: print violations, exit 1 if
#                         # any violation is NOT in the baseline
#   tools/lint/doc-comment-history-audit.sh --list
#                         # print every violation file:line:token,
#                         # exit 0 regardless of baseline
#   tools/lint/doc-comment-history-audit.sh --fail-any
#                         # strict mode: exit 1 on ANY violation
#                         # (for post-cleanup use once baseline is
#                         # empty)
#   tools/lint/doc-comment-history-audit.sh --regenerate-baseline
#                         # overwrite the baseline with current
#                         # state; use only when a PR legitimately
#                         # shuffles allowlisted lines
#
# Baseline: tools/lint/doc-comment-history-audit.baseline — one
# entry per line in `file:line:token` form. Represents violations
# that exist TODAY; the lint fails only on violations that don't
# appear there, so existing debt doesn't block commits while
# cleanup PRs drain it.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO_ROOT"

BASELINE_FILE="tools/lint/doc-comment-history-audit.baseline"
MODE="${1:-check}"

# ---- Token list --------------------------------------------------------------
# Alternation of tokens. Word-boundary handling is done inside awk
# (portable across GNU awk and BSD awk) rather than via `\b`, which
# is not portable in ERE (`grep -E`) — BSD grep treats `\b` as a
# literal `b`, silently missing matches on macOS. The awk loop in
# `collect_violations` checks that the character before and after
# each match is a non-word character (`[^A-Za-z0-9_]`) for tokens
# that need word-boundary protection. Tokens ending in `:` (e.g.
# `Provenance:`, `Attribution:`) do not need a trailing boundary.
TOKEN_PATTERN='(Otto-[0-9]+|Amara|Aaron|ferry|courier|graduation|Provenance:|Attribution:)'

# ---- Files to scan -----------------------------------------------------------
scan_files() {
  # Use find with explicit includes; exclude vendored / build / spec
  # / history trees where factory-history tokens are legitimate.
  find src tests bench tools \
    \( -name '*.fs' -o -name '*.cs' -o -name '*.sh' -o -name '*.ts' \) \
    -not -path '*/bin/*' \
    -not -path '*/obj/*' \
    -not -path '*/.venv/*' \
    -not -path '*/node_modules/*' \
    -type f \
    2>/dev/null
}

# ---- Violation extraction ----------------------------------------------------
# For each file: extract comment lines only (leading `///`, `//`, `#`),
# match tokens from TOKEN_PATTERN with explicit word-boundary checks
# (for portability between GNU awk and BSD awk — `\b` is not portable
# in POSIX ERE), and emit `file:line:token1,token2,...` tuples where
# the token list is sorted + deduplicated. Emitting every token per
# line (not just the first) ensures the baseline comparison in
# default mode catches the case where a baselined line gains a new
# forbidden token — the record changes, and the new record is flagged.
collect_violations() {
  local file
  while IFS= read -r file; do
    awk -v pat="$TOKEN_PATTERN" -v fname="$file" '
      # Is this a comment line? (F# ///, F#/C# //, shell # but not
      # shebang #!).
      function is_comment_line(s) {
        if (s ~ /^[[:space:]]*\/\/\//) return 1
        if (s ~ /^[[:space:]]*\/\//) return 1
        if (s ~ /^[[:space:]]*#!/) return 0
        if (s ~ /^[[:space:]]*#/) return 1
        return 0
      }
      # Non-word char boundary check: given position p in string s,
      # return 1 if char at p is a non-word character (or position
      # is out of bounds). Word chars are [A-Za-z0-9_].
      function is_boundary(s, p,    c) {
        if (p < 1 || p > length(s)) return 1
        c = substr(s, p, 1)
        return (c !~ /[A-Za-z0-9_]/)
      }
      {
        if (!is_comment_line($0)) next
        # Collect all token matches on the line with explicit
        # word-boundary validation. Tokens ending in ":" skip the
        # trailing boundary check (the ":" already isolates them).
        rest = $0
        offset = 0
        delete seen
        n = 0
        while (match(rest, pat)) {
          start = RSTART
          len = RLENGTH
          tok = substr(rest, start, len)
          absstart = offset + start
          absend = absstart + len - 1
          trailing_needs_boundary = (substr(tok, len, 1) != ":")
          if (is_boundary($0, absstart - 1) && \
              (!trailing_needs_boundary || is_boundary($0, absend + 1))) {
            if (!(tok in seen)) {
              seen[tok] = 1
              tokens[++n] = tok
            }
          }
          # Advance past this match to find further tokens on the
          # same line.
          rest = substr(rest, start + len)
          offset = offset + start + len - 1
        }
        if (n == 0) next
        # Sort tokens and join with comma (insertion sort — n is
        # tiny, typically 1).
        for (i = 2; i <= n; i++) {
          key = tokens[i]
          j = i - 1
          while (j >= 1 && tokens[j] > key) {
            tokens[j+1] = tokens[j]
            j--
          }
          tokens[j+1] = key
        }
        joined = tokens[1]
        for (i = 2; i <= n; i++) joined = joined "," tokens[i]
        printf "%s:%d:%s\n", fname, NR, joined
        delete tokens
      }
    ' "$file"
  done < <(scan_files)
}

# ---- Modes -------------------------------------------------------------------
case "$MODE" in
  --list)
    collect_violations | sort
    exit 0
    ;;
  --fail-any)
    violations=$(collect_violations | sort)
    if [ -n "$violations" ]; then
      echo "doc-comment-history-audit: violations found (strict mode):" >&2
      printf '%s\n' "$violations" >&2
      count=$(printf '%s\n' "$violations" | wc -l | tr -d ' ')
      echo "doc-comment-history-audit: $count violation(s); see" >&2
      echo "  memory/feedback_code_comments_explain_code_not_history_otto_220_2026_04_24.md" >&2
      exit 1
    fi
    echo "doc-comment-history-audit: no violations (strict mode clean)"
    exit 0
    ;;
  --regenerate-baseline)
    collect_violations | sort > "$BASELINE_FILE"
    count=$(wc -l < "$BASELINE_FILE" | tr -d ' ')
    echo "doc-comment-history-audit: baseline regenerated with $count entries" >&2
    echo "  -> $BASELINE_FILE" >&2
    exit 0
    ;;
  check|'')
    # Default mode: fail on violations not in baseline.
    if [ ! -f "$BASELINE_FILE" ]; then
      echo "doc-comment-history-audit: baseline missing at $BASELINE_FILE" >&2
      echo "  regenerate with: $0 --regenerate-baseline" >&2
      exit 2
    fi
    current=$(collect_violations | sort)
    # New violations = current minus baseline.
    new_violations=$(comm -23 <(printf '%s\n' "$current") <(sort "$BASELINE_FILE"))
    if [ -n "$new_violations" ]; then
      echo "doc-comment-history-audit: new violations not in baseline:" >&2
      printf '%s\n' "$new_violations" >&2
      count=$(printf '%s\n' "$new_violations" | wc -l | tr -d ' ')
      echo "doc-comment-history-audit: $count new violation(s); see" >&2
      echo "  memory/feedback_code_comments_explain_code_not_history_otto_220_2026_04_24.md" >&2
      echo "  to legitimize a moved line, run: $0 --regenerate-baseline" >&2
      exit 1
    fi
    baseline_count=$(wc -l < "$BASELINE_FILE" | tr -d ' ')
    echo "doc-comment-history-audit: no new violations ($baseline_count entries in baseline)"
    exit 0
    ;;
  *)
    echo "doc-comment-history-audit: unknown mode '$MODE'" >&2
    echo "usage: $0 [--list|--fail-any|--regenerate-baseline]" >&2
    exit 2
    ;;
esac
