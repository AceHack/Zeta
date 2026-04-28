# PR #429 drain log — drain follow-up to #270: auto-memory vs git-tracked disambiguation + CRITICAL bolding

PR: <https://github.com/Lucent-Financial-Group/Zeta/pull/429>
Branch: `drain/270-followup-memory-substrate-clarification`
Drain session: 2026-04-25 (Otto, sustained-drain-wave during maintainer-
asleep window; pre-summary-checkpoint earlier in this session)
Thread count at drain: substantive Codex follow-up findings on the
parent #270 multi-Claude peer-harness experiment design PR.
Rebase context: clean rebase onto `origin/main`; no conflicts.

Per Otto-250 (PR review comments + responses + resolutions are
high-quality training signals): full record of the substantive
substrate-clarification + formatting fixes captured in the parent
+ this follow-up drain pair.

This PR is the **post-merge cascade** to #270 (research: multi-Claude
peer-harness experiment design — "Otto-iterates-to-bullet-proof;
Aaron-validates-once-on-Windows"). The earlier wave drained 5 first-
wave threads on the parent; this cascade caught two specific Codex
P1/P2 findings that surfaced after #270's merge.

---

## Threads

### Thread 1 — Auto-memory (`~/.claude/projects/<slug>/memory/`) vs git-tracked `memory/` disambiguation

- Reviewer: chatgpt-codex-connector
- Severity: P1 (substrate-correctness)
- Finding: parent doc described "memory" without distinguishing
  between Anthropic AutoMemory (per-user, out-of-repo at
  `~/.claude/projects/<slug>/memory/`) and the in-repo `memory/`
  tree (the forward-mirror substrate landed via Otto-114). The two
  are distinct: AutoMemory is the live Anthropic harness layer;
  in-repo `memory/` is the git-tracked mirror that survives session
  boundaries + cross-harness handoffs. Conflating them in the
  experiment-design surface would skew the failure-mode detection
  proposal (different hash-compare strategies apply per layer).
- Outcome: **FIX** — added explicit disambiguation: AutoMemory is
  the Anthropic-harness-managed per-user layer at
  `~/.claude/projects/<slug>/memory/`; the in-repo `memory/` tree
  is the git-tracked substrate that mirrors AutoMemory forward.
  Failure-mode detection split per surface: git diff/reflog for
  `memory/`; filesystem hash compare for AutoMemory. Reviewer can
  now verify which surface each detection mechanism targets.

### Thread 2 — Bolding the third CRITICAL severity for consistency

- Reviewer: chatgpt-codex-connector
- Severity: P2 (formatting)
- Finding: experiment-design doc had three CRITICAL severities
  flagged via `**CRITICAL**` markdown but the third instance had
  inconsistent bolding (one or both asterisks missing or
  surrounding-text formatting different). Visual inconsistency
  reduces grep-ability + at-a-glance severity scanning.
- Outcome: **FIX** — bolded the third CRITICAL consistently with
  the other two; all three CRITICAL severities now render uniformly
  in the doc. Future grep `grep -n '\*\*CRITICAL\*\*'` returns all
  three uniformly.

---

## Pattern observations (Otto-250 training-signal class)

1. **Memory-substrate disambiguation is a recurring class.**
   AutoMemory (out-of-repo, per-user) vs git-tracked in-repo
   `memory/` is a load-bearing distinction in any doc discussing
   memory mechanisms. Conflation produces design-correctness gaps
   downstream (e.g., wrong detection mechanism per surface). The
   fix template: name both surfaces explicitly + name the
   forward-mirror relationship + name the per-surface mechanism
   (git diff vs filesystem hash). Same shape as the
   implementation-vs-math-definition tension on #206 (Tropical
   ℝ vs Zeta ℤ).

2. **Severity-bolding consistency is a markdown-rendering class.**
   When a doc uses bold for severity flags, the rendering
   uniformity matters for at-a-glance scanning + grep-ability.
   Future doc-lint candidate: regex check on severity tokens
   (`CRITICAL` / `IMPORTANT` / `WATCH` / `DISMISS` per Aminata's
   four-class severity taxonomy) for uniform bold formatting.

3. **Experiment-design docs benefit from per-surface mechanism
   tables.** When a doc proposes detection / verification
   mechanisms, splitting into a per-surface table makes the
   coverage-by-surface explicit + catches missing-mechanism gaps.
   This is structurally similar to the parity-matrix pattern on
   #231 — table-form documents that have rows/columns reduce the
   surface for omission-class findings.

## Final resolution

All threads resolved; PR auto-merge SQUASH armed; CI cleared; PR
merged to main as `4838850`.

Drained by: Otto, sustained-drain-wave during maintainer-asleep
window 2026-04-25, cron heartbeat `f38fa487` (`* * * * *`).
