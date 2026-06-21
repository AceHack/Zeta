---
name: Audit-first-then-decide — three-way pivot between mechanical-fix / row-file / quiet-checkpoint
description: When parallel-work-while-CI runs, the substrate-honest pattern is to FIRST run an audit tool, THEN let the audit result determine the action. Audit findings split cleanly into three classes — mechanical (fix this tick), content-judgment (file as backlog row), or null actionable (quiet shard). This composes razor-discipline (no manufactured findings) with never-be-idle (speculative work is productive) at per-tick scope.
type: feedback
caused_by:
  - "Otto-CLI 23-tick session 2026-05-15 (1718Z–2038Z) empirically validated the pattern. The session produced 4 catch-once-then-lint cluster siblings + 17 Otto-279 per-name-attribution fixes + 3 substrate-honest residual rows (081KRMEXM0008QG0R000HHAG77, 081KRMEXM0008QG0R001BH94PS, 081KRMEXM0008QG0R0034SS319). Each tick was either: substantive PR (Slice A/B mechanization, batched fixes), backlog row filing (residual capture), or quiet checkpoint (1919Z, 1952Z, 2038Z when audits produced no single-tick-scope work)."
  - "Tension between three composing rules: never-be-idle (speculative work over waiting), razor-discipline (operational claims only; manufactured findings is the failure mode), holding-without-named-dependency-is-standing-by-failure (Holding emission without a real wait IS the failure pattern). Naive readings produce contradiction; audit-first-then-decide resolves it: the audit determines whether there IS work."
composes_with:
  - .claude/rules/razor-discipline.md
  - .claude/rules/no-op-cadence-failure-mode.md
  - .claude/rules/holding-without-named-dependency-is-standing-by-failure.md
  - .claude/rules/never-be-idle.md
  - .claude/rules/encoding-rules-without-mechanizing.md
  - .claude/rules/substrate-or-it-didnt-happen.md
---

# Audit-first-then-decide — three-way pivot pattern

## Rule

When parallel-work-while-CI runs or when "what should I do this tick?" surfaces, **run an audit FIRST**, then let the audit result determine the action.

Three-way classification of audit findings:

| Audit result | Action | Example |
|---|---|---|
| **Mechanical fix-class** (clear substitution, batch <30 lines) | Fix this tick as small atomic PR | Otto-279 "Per Aaron 2026-" → "Per the human maintainer 2026-" (17 hits, 4 batches, 1959Z-2020Z) |
| **Content-judgment class** (per-occurrence, requires careful editing) | File as backlog row capturing the work | orphan-ferry-ref cleanup (081KRMEXM0008QG0R001BH94PS); MEMORY.md long-entry cleanup (081KRMEXM0008QG0R0034SS319) |
| **Null actionable** (audit clean, OR findings too big for single-tick) | Write quiet checkpoint shard | 1919Z, 1952Z, 2038Z |

## Why this rule exists

Three pairs of rules appear to be in tension:

- **never-be-idle** says: don't wait; do speculative work
- **razor-discipline** says: don't manufacture findings to keep busy
- **holding-without-named-dependency-is-standing-by-failure** says: brief "Holding" without a real wait IS the failure pattern

Naive reading produces paralysis: any quiet shard might be Standing-by; any audit-driven fix might be manufactured-finding; any wait might be idle.

The audit-first-then-decide pivot resolves the tension: **the audit OUTPUT determines which discipline applies**.

- If audit produces real mechanical findings → never-be-idle wins (fix this tick)
- If audit produces real content-judgment findings too big for single tick → substrate-or-it-didn't-happen wins (file as row)
- If audit produces null actionable → razor-discipline wins (quiet shard is appropriate)

This is the substrate-honest alternative to "guess from the chair" what discipline applies.

## Operational instance — 2026-05-15 session arc

Across 23 ticks (1718Z–2038Z, ~3 hours wall-clock), the pattern produced:

**Substantive code PRs (mechanical fix-class)** (10+):
- 081KRMEXM0008QG0R000K25MXS §33 dead-xref scanner + cleanup + gate (PRs #3548, #3552, #3555)
- 081KRMEXM0008QG0R000HHAG77 backlog ID-uniqueness gate (PR #3565)
- 081KRMEXM0008QG0R003FZNK3E hard-error parent-child status mismatch (PR #3567)
- Otto-279 4-batch cleanup (PRs #3570, #3572, #3574, #3576)
- 2 narrow xref-fix PRs (#3526, #3529, #3535, #3558)

**Backlog rows (content-judgment class)** (3):
- 081KRMEXM0008QG0R000HHAG77, 081KRMEXM0008QG0R001BH94PS, 081KRMEXM0008QG0R0034SS319 (each captures a class of cleanup work + future gate-wiring plan)

**Quiet checkpoints (null actionable)** (3):
- 1919Z, 1952Z, 2038Z

**4 of 4 catch-once-then-lint cluster siblings now live on `main`**:
- `lint-archive-header-section33`
- `lint-section-33-migration-xrefs`
- `lint-backlog-id-uniqueness`
- `lint-backlog-parent-child-status`

## Failure modes the pattern catches

1. **Manufactured findings** — when bored, would invent low-value substrate work. Audit-first means findings have to be REAL audit hits, not invented.

2. **Standing-by emission** — brief "Holding" without real dependency. Audit-first replaces this with concrete audit output to drive decision.

3. **No-op cadence** — multi-hour idle. Audit-first guarantees per-tick action (fix, row, or shard).

4. **Compulsive backlog inflation** — filing rows just to look productive. Audit-first uses the audit findings as the row-filing source, not just "ideas I had."

5. **Confused-by-rule-conflict paralysis** — when never-be-idle, razor-discipline, and no-op-cadence-failure-mode appear to conflict. Audit-first dissolves the apparent conflict by letting the audit output route the decision.

## When to apply

When ANY of these triggers fires at a tick boundary:

- "what should I do this tick?"
- "am I being idle?"
- "should I write a quiet shard?"
- "should I file a backlog row?"
- "the cluster is complete — now what?"

→ Run an audit FIRST. Let the result decide.

## Anti-pattern: tick-driven audit-running

The pattern is NOT: "every tick, must run audit." The pattern is: "when uncertain what to do, audit-first." A tick that obviously needs to continue prior work (CI-wait + scope clear) shouldn't pause to audit.

## Composes with substrate

- PR #3548–#3568 (081KRMEXM0008QG0R000K25MXS cluster arc — empirical evidence the audit-discipline-row triad cascades cleanly)
- PR #3570–#3576 (Otto-279 cleanup arc — empirical evidence the mechanical fix-class scales linearly)
- PR #3578, #3580 (081KRMEXM0008QG0R001BH94PS + 081KRMEXM0008QG0R0034SS319 — empirical evidence content-judgment routes to backlog row)
- 1919Z, 1952Z, 2038Z shards (empirical evidence quiet-checkpoint discipline is sustainable)

## Authored origin

Discovered as an explicit pattern during Otto-CLI 2038Z tick. Prior to that, the pattern was implicit (1919Z + 1952Z shards both did audit-first then declared null, but didn't name the discipline). 2038Z shard explicitly named the discipline; this feedback file captures it as named substrate.
