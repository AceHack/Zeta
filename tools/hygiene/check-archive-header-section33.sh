#!/usr/bin/env bash
#
# tools/hygiene/check-archive-header-section33.sh — validates that
# courier-ferry / external-conversation imports under `docs/research/**`
# carry the 4-field archive boundary header in the first 20 lines per
# GOVERNANCE.md §33.
#
# Why this exists (Otto-346 pattern; observed 2026-04-26):
#   The §33 archive header was the most-common review finding across
#   the 11-Amara-refinement courier-ferry lineage this session: PR #560
#   / #562 / #563 / #565 / #566 / #568 / #569 / #570 / #553 each had
#   to be retrofitted with the header AFTER review. Recurring identical
#   review finding = signal that the discipline lacks automated
#   enforcement.
#
#   Per Otto-346 (recurring pattern → substrate primitive missing) +
#   Otto-341 (mechanism over vigilance), the right shape is a CI lint
#   check that fails the build when a courier-ferry import lands
#   without the §33 header — instead of waiting for human / advisory-AI
#   review to flag it on every doc.
#
# What this checks:
#   For every file under `docs/research/**.md` that matches the
#   courier-ferry import pattern (filename or content contains
#   "courier-ferry" / "cross-substrate" / "external conversation"):
#   - First 20 lines contain ALL four required §33 labels:
#     * `Scope:` (literal label, NOT bold-styled `**Scope**:`)
#     * `Attribution:`
#     * `Operational status:`
#     * `Non-fusion disclaimer:`
#   - Reports every failing file with a per-file diagnostic line, then
#     a summary line with the total count. Multi-violation reporting is
#     intentional: agents can fix all violations in a single pass instead
#     of running the lint repeatedly to discover them serially.
#   - Exits non-zero on any failure
#
# What this does NOT do:
#   - Does NOT validate the CONTENT of each header field (that's a
#     judgment call the author makes)
#   - Does NOT auto-fix; the fix is the author's responsibility (the
#     CI failure points at the missing labels)
#   - Does NOT enforce §33 on docs OUTSIDE `docs/research/**` (other
#     surfaces have different governance per AGENTS.md)
#
# Composes with:
#   - GOVERNANCE.md §33 (the rule this lints)
#   - tools/hygiene/check-tick-history-order.sh (pattern: structural-
#     prevention via lint, not vigilance)
#   - .github/workflows/gate.yml (wired as a lint job)
#
# Self-test:
#   $ tools/hygiene/check-archive-header-section33.sh
#     → exit 0 if all courier-ferry research docs have §33 headers
#     → exit 1 with diagnostic if any are missing

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
RESEARCH_DIR="${REPO_ROOT}/docs/research"

if [[ ! -d "$RESEARCH_DIR" ]]; then
  echo "OK: docs/research/ does not exist; nothing to check"
  exit 0
fi

# Required §33 labels as literal strings. Bold-styled forms like
# `**Scope**:` are NOT acceptable per the discovery in PR #570 P0:
# header-format linting may not recognize bold-styled labels.
required_labels=(
  "Scope:"
  "Attribution:"
  "Operational status:"
  "Non-fusion disclaimer:"
)

# A courier-ferry / external-conversation import is identified by
# specific structural-marker patterns in filename or first-20-line
# content. Patterns are role-ref-based (NOT name-attribution) per
# the "No name attribution in code, docs, or skills" rule:
# we look for the structural-shape markers like 'courier-ferry'
# and 'cross-substrate', not personal names. Empty match = file is
# NOT in scope, skip silently.
#
# Content signals are scoped to the first 20 lines (the §33 header
# region itself) to AVOID false positives where a doc merely
# mentions an external system in its body. The narrow lookback
# also makes the lint cheaper.
is_courier_ferry_import() {
  local file="$1"
  # Filename signals — structural markers only (no personal names)
  if [[ "$file" =~ courier-ferry|cross-substrate|external-import|cross-ferry ]]; then
    return 0
  fi
  # Content signals scanned in the §33 header region (first 20 lines).
  # Patterns target structural phrases — courier-ferry process,
  # external-conversation status — NOT mere mentions of external
  # systems. Matches like 'chatgpt' / 'google search ai' alone are
  # too broad and produce false positives on internal research docs
  # (Copilot P0 finding: PR #571 review).
  if head -20 "$file" 2>/dev/null | grep -qiE 'courier.ferry|external conversation|external collaborator|external research agent|courier-ferry capture'; then
    return 0
  fi
  return 1
}

violations=0
violation_files=()

# Iterate all .md files under docs/research/ recursively. The
# enforcement scope must match the documented scope ('docs/research/**');
# subdirectories like docs/research/claims/ exist today and any
# courier-ferry doc placed in one would bypass a single-level glob.
# Codex P2 finding (PR #571 review): use recursive walk via 'find'
# instead of '*.md' single-level glob.
shopt -s nullglob
while IFS= read -r -d '' file; do
  if ! is_courier_ferry_import "$file"; then
    continue
  fi

  header_region=$(head -20 "$file")
  missing=()
  for label in "${required_labels[@]}"; do
    # Anchor label search to start-of-line. The labels are positional
    # — they should be at start-of-line, not buried mid-line. A fixed-
    # string search would accept `- Operational status:` (mid-list-item)
    # which is structurally wrong (Copilot P1 finding: PR #575 review).
    if ! echo "$header_region" | grep -qE "^$label"; then
      missing+=("$label")
    fi
  done

  # Operational status VALUE validation per GOVERNANCE.md §33 lines
  # 777-780: enum is strict — `research-grade` or `operational`,
  # nothing else. Free-form values (e.g. `research-grade specification
  # with implementation-ready type signatures...`) violate the spec
  # and would fail downstream tooling that parses this field.
  #
  # Codex P2 finding (PR #572 review): catch the value-discipline at
  # lint-time, not only label-presence.
  bad_value=""
  if echo "$header_region" | grep -qE '^Operational status:'; then
    op_line=$(echo "$header_region" | grep -m1 -E '^Operational status:')
    # Strict-enum regex anchored to start AND end. Use POSIX ERE
    # character class [[:space:]]* — `\s` is NOT POSIX ERE; with
    # `grep -E` `\s` matches a literal `s`, not whitespace (Copilot
    # P0 finding: PR #575 review).
    if ! echo "$op_line" | grep -qE '^Operational status: (research-grade|operational)[[:space:]]*$'; then
      bad_value="$op_line"
    fi
  fi

  if [[ ${#missing[@]} -gt 0 || -n "$bad_value" ]]; then
    violations=$((violations + 1))
    violation_files+=("$file")
    if [[ ${#missing[@]} -gt 0 ]]; then
      echo "VIOLATION: ${file#"$REPO_ROOT/"} missing §33 labels: ${missing[*]}" >&2
    fi
    if [[ -n "$bad_value" ]]; then
      echo "VIOLATION: ${file#"$REPO_ROOT/"} 'Operational status:' value not enum-strict (must be 'research-grade' or 'operational' alone): ${bad_value}" >&2
    fi
  fi
done < <(find "$RESEARCH_DIR" -type f -name '*.md' -print0)

if [[ $violations -gt 0 ]]; then
  echo "" >&2
  echo "FAIL: $violations courier-ferry research-doc(s) missing GOVERNANCE.md §33 archive header(s)" >&2
  echo "" >&2
  echo "Required header (literal label form, NOT bold-styled) in first 20 lines:" >&2
  echo "  Scope: <one-line scope>" >&2
  echo "  Attribution: <named entities + first-name attribution per Otto-279>" >&2
  echo "  Operational status: <research-grade vs operational-policy>" >&2
  echo "  Non-fusion disclaimer: <attribution boundary preservation>" >&2
  echo "" >&2
  echo "Pattern reference: see PR #570 / #566 / #563 §33-header fixes for examples." >&2
  exit 1
fi

echo "OK: all courier-ferry research docs have §33 archive headers"
exit 0
