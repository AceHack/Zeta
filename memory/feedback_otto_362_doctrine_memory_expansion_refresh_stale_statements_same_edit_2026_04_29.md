---
name: Otto-362 — Doctrine memory expansion refreshes stale statements in the SAME edit
description: When a memory file gets expanded with new sections that supersede earlier statements in the same file, refresh the now-stale statements in the same edit, not a follow-up tick. Internal contradictions within a single file are lying-by-omission. Pattern observed across 4 same-day doctrine PRs (2026-04-29) where multi-AI review caught the drift instead of pre-push self-audit.
type: feedback
---

# Otto-362 — Doctrine memory expansion refreshes stale statements in the same edit

## The carved sentence

*"When you add a section that supersedes an earlier statement in the same memory file, refresh the earlier statement in the same edit. Internal contradictions within one file are lying-by-omission."*

## What this codifies

A pattern observed across 4 same-day doctrine PRs (#850, #851, #852, #853) on 2026-04-29:

- v1 doctrine landed (~100 lines).
- v2 review-driven additions appended (~150 lines). Earlier "Status: Currently undefined" statements remained in place even though v2 specified the missing piece.
- v3 expansion appended (~340 lines). Earlier task-id citations remained even though v3 added new tasks.
- v4 expansion appended (~230 lines). Earlier task-range summaries remained even though v4 added more tasks.

Result: every doctrine PR had Copilot P1 / Codex P2 threads catching internal contradictions:

- "Tracked under follow-up tasks" vs "Untracked follow-up" (in same file)
- "Currently undefined" vs "Now specified" (for actor identity)
- "task #325-#334" vs "task #325 + #335" (after #335 was created)
- "v2 review-driven additions" header vs "v3 packet" content
- `request-agent-claim.md` vs `start-agent-claim.md` runbook path
- Mapping `Task → claim_id` vs example showing both `Task:` AND `Claim:`

All caught by external AI review; none caught by pre-push self-audit. Fix cadence was fast (one commit per thread cluster) but the **review iteration was a recurring tax** that compounded over four PRs.

## The rule

Before pushing a memory expansion that adds a new section:

1. **Search the file** for statements that the new section now supersedes (status fields, task ranges, file paths, claim states, mapping tables).
2. **Refresh them in the same edit**, not a follow-up tick.
3. **If the new section restates a vocabulary** (e.g. snake_case enum tokens), grep the rest of the file for the old vocabulary and refresh.
4. **If the new section adds tracking objects** (tasks, follow-ups), refresh the trailing "Composes with" / summary sections that cite the old set.
5. **If the new section reorders execution** (e.g. the v4 rollout reorder), refresh earlier "next PR" / "next layer" references that assumed the old order.

The discipline composes with `verify-before-deferring` (CLAUDE.md): the same way deferred targets must exist before the deferral ships, superseded statements must be refreshed before the supersession ships.

## Composes with

- **Same-tick update discipline** (`CLAUDE.md` "auto memory" section, CURRENT-file rule): "*when a new memory lands that updates a rule in a CURRENT file, edit CURRENT in the same tick. Skipping is lying-by-omission.*" — Otto-362 is the *intra-file* generalization of the same principle (*within* a single memory file, not across files).
- **Verify-before-deferring** (`memory/feedback_verify_target_exists_before_deferring.md`): same shape, applied to internal references rather than deferred work.
- **Future-self is not bound by past-self** (`memory/feedback_future_self_not_bound_by_past_decisions.md`): Otto-362 is the *editing* counterpart — when superseding past-self's statement, refresh it rather than leaving it ambient.
- **Memory-index-integrity** (`.github/workflows/memory-index-integrity.yml`): mechanical pairing between memory file and MEMORY.md. Otto-362 is the *unmechanized* pairing within a single file.

## Why not a CI lint instead

Internal contradictions are semantic, not syntactic. A lint can catch:

- A file path mentioned but missing (already done by `lint memory/MEMORY.md reference-existence`).
- A duplicate link target (already done by `lint memory/MEMORY.md for duplicate link targets`).
- A snake_case vs hyphen mismatch in known fields (already done by AgencySignature trailer field linter).

A lint **cannot** catch:

- "Currently undefined" + "Now specified" co-existing.
- "task #325-#334" + "tasks #325 + #335" co-existing (the lint doesn't know which one is the source of truth).
- A mapping table contradicting an example.

So Otto-362 is editing discipline, not mechanism. Mechanism beats vigilance (Otto-341), but for *semantic* contradictions, the only mechanism is a multi-AI review pass — which is already happening and is the current safety net.

## What this rule does NOT say

- Does NOT say "never expand a memory file across multiple PRs." Iterating on doctrine is correct.
- Does NOT say "every expansion must rewrite the whole file." Only refresh statements that are now stale.
- Does NOT say "review iterations are bad." They're the safety net; this rule reduces the *count* of iterations by catching the stale-statement class before push.
- Does NOT replace the multi-AI review safety net — multi-AI review still catches things this rule misses (semantic ambiguity, missing dependencies, factual errors). Otto-362 is *additive* to multi-AI review, not a replacement.

## Trigger memory

2026-04-29 doctrine cluster (#850 → #851 → #852 → #853). Four PRs in one afternoon, growing the agent-orchestra doctrine memory from ~100 lines to ~1080 lines through v1 → v2 → v3 → v4. Each PR triggered Copilot + Codex review threads catching internal contradictions of the kind described above.

The fix-cadence was fast (each thread resolved in one commit, often within minutes) but the *count* of internal-contradiction threads was disproportionate to the *substantive-error* count. That asymmetry is the smell. The substantive errors were caught and fixed; the internal-contradiction threads were avoidable with pre-push self-audit.

The pattern is general: any incrementally-edited substrate (memory files, doctrine docs, CONTRIBUTING.md, AGENTS.md, governance) is at risk of accumulating internal contradictions during expansion. The same-edit-refresh rule applies wherever supersession happens.

## The compact version

```text
When you supersede, refresh in place.
Internal contradiction within one file = lying-by-omission.
The reviewer who catches it is doing your job.
```
