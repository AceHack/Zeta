# PR #423 drain log — drain follow-up to #406 + #407: CodeQL xref + GOVERNANCE §24 truth-update

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/423>
Branch: `drain/406-407-followup`
Drain session: 2026-04-25 (Otto, sustained-drain-wave during maintainer-
asleep window; pre-summary-checkpoint earlier in this session)
Thread count at drain: 2 Codex post-merge threads + 1 downstream typo,
across the parent #406 / #407 pair.
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full record of the post-merge cascade
findings on the CodeQL workflow + GOVERNANCE §24 audit pair.

This PR is the **post-merge cascade** to two parent PRs simultaneously:
#406 (CodeQL workflow audit) and #407 (GOVERNANCE §24 truth-update).
The cascade caught two specific findings + one downstream typo that
surfaced after the parent merges landed.

---

## Threads

### Thread 1 — Inline `brew install codeql` reflow

- Reviewer: chatgpt-codex-connector
- Severity: P2 (markdown rendering)
- Finding: inline code span `brew install codeql` was split across a
  newline inside the backticks, breaking GFM rendering as two
  adjacent code spans rather than one command.
- Outcome: **FIX** — reflowed to single line per CommonMark §6.1
  (code spans cannot contain newlines). Same fix template as the
  inline-code-span line-wrap class observed across the corpus
  (#191, #195, #219).

### Thread 2 — Stable-identifier xref instead of brittle line-number

- Reviewer: chatgpt-codex-connector
- Severity: P2 (cross-reference robustness)
- Finding: parent had a "near line 4167" line-number xref to a
  CodeQL-workflow checkbox-item. Line-number xrefs decay rapidly as
  the cited file evolves; reviewer suggested switching to a stable
  identifier — the **CodeQL workflow** checkbox-item name.
- Outcome: **FIX** — replaced "near line 4167" with the stable
  identifier (CodeQL workflow checkbox-item name). Stable-identifier
  xrefs decay only when the identifier itself is renamed; line-
  number xrefs decay on every adjacent edit.

### Thread 3 — Downstream typo

- Reviewer: copilot-pull-request-reviewer
- Severity: P2 (typo)
- Finding: downstream prose typo in the parent's GOVERNANCE §24
  truth-update text.
- Outcome: **FIX** — typo corrected.

---

## Pattern observations (Otto-250 training-signal class)

1. **Stable-identifier-vs-line-number xref is its own findings
   class.** Line-number cross-references decay rapidly as the cited
   file evolves; even single-line additions or formatting edits
   shift every line below. Stable identifiers (heading text,
   section anchors, checkbox-item names, function/type names)
   decay only when the identifier itself is renamed. Fix template:
   when citing a specific element of a long file, prefer the
   element's name over its line number. Pre-commit-lint candidate:
   regex check on `near line N` / `at line N` patterns suggesting
   stable-identifier alternatives.

2. **Inline-code-span line-wrap is the most-recurring formatting
   bug in this drain corpus** (now observed on #191, #195, #219,
   #423). The fix template is uniform: reflow to single line or
   convert to a markdown link. Pre-commit-lint candidate: regex
   check for backtick spans crossing newlines.

3. **Multi-parent cascade is its own PR-mechanics class.** #423
   was a follow-up to TWO parent PRs simultaneously (#406 + #407).
   When two related parent PRs merge in close proximity, post-merge
   reviewer cascade can surface findings spanning both — the
   follow-up PR can address both in one commit + one merge gate
   rather than serializing into two separate cascades.

## Final resolution

All 3 threads resolved at SHA `a924ebf` (the PR's only commit).
PR auto-merge SQUASH armed; CI cleared; merged to main as
`a0c6425`.

Drained by: Otto, sustained-drain-wave during maintainer-asleep
window 2026-04-25, cron heartbeat `f38fa487` (`* * * * *`).
