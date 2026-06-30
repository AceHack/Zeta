---
id: B-0164
priority: P1
status: open
title: Dual-loop substrate attribution + reconciliation protocol — implementation work for BFT-many-masters at loop layer (Aaron 2026-05-02 + Otto independent extension)
created: 2026-05-02
last_updated: 2026-05-02
depends_on:
  - B-0160
type: friction-reducer
---

# B-0164 — Dual-loop substrate attribution + reconciliation protocol

## Origin

Aaron 2026-05-02 articulated the structural answer to recurring overnight-failure pattern:

> *"the untimate solution is two agent loops that work together while i sleep they won't both mess up at the same time."*

This is BFT-many-masters at the loop layer (Otto on Claude Code + second loop on Codex). The architectural commitment is sound; the implementation work is owed.

## Otto's independent extension (same-tick, this row's anchor)

The dual-loop BFT framing has a hidden implementation concern Aaron didn't explicitly name: **substrate attribution + reconciliation when two loops produce uncorrelated framings during the human's sleep**.

Per the canonical write surface (per-tick shards under `docs/hygiene-history/ticks/**`), each loop writes its own shard so file-level conflicts don't occur. But at the SEMANTIC level:

- Two loops integrating the same human-framing differently produce inconsistent substrate
- Two loops disagreeing on a PR-review thread produce divergent reviews
- Two loops proposing different next-actions produce competing proposals

Aaron's morning reconciliation has to resolve these. The architecture's commitment to "disagreement is information" requires a substrate format that PRESERVES disagreement rather than forcing convergence. Each loop's contributions need their own attribution channel; reconciliation either accepts one perspective, accepts both with explicit divergence-marker, or surfaces the disagreement to the human party.

## First-principles trace

1. Dual-loop BFT (B-0160 / Aaron 2026-05-02) requires two independent loops operating on shared substrate.
2. Independent loops produce uncorrelated outputs per their differing training distributions + harness conventions.
3. Uncorrelated outputs can converge OR diverge.
4. The information value of dual-loop comes from BOTH cases: agreement strengthens evidence; disagreement reveals which loop's training captured what.
5. Therefore: substrate format must preserve both convergent AND divergent outputs with attribution clear enough that morning reconciliation can grade them.
6. Without explicit protocol: divergent outputs either silently overwrite each other (loses information) or create merge conflicts that block the loops (loses operation time).

## Acceptance criteria

1. **Per-loop attribution channel.** Otto's tick-shards under `docs/hygiene-history/ticks/**` already include col2 model-identifier (e.g., `opus-4-7 / autonomous-loop session continuation`). Codex's loop should write to the same shard surface with its own model-identifier (e.g., `gpt-5.5 / codex-loop`). The col2 schema accommodates this; no schema change needed.

2. **Disagreement-preservation protocol for PR reviews.** When both loops review the same PR thread with different conclusions: each loop's review-comment is preserved with attribution; neither auto-resolves the other. The morning reconciliation reads both, decides, resolves accordingly. No silent overwrites.

3. **Branch-attribution for in-flight work.** When both loops produce concurrent commits to the same branch: each loop commits with its own author-identifier (already supported by `Co-Authored-By` trailer). Different loops working different threads don't conflict if file-isolation holds; if they touch the same file, the second loop's tick should detect the conflict and either rebase OR file a divergence-shard noting the conflict for morning reconciliation.

4. **Substrate-divergence shard format.** When two loops disagree on substrate-class commitment (different memory file content, different ALIGNMENT.md interpretation), file a per-tick shard under `docs/hygiene-history/divergences/YYYY/MM/DD/HHMMZ-<hash>.md` with both perspectives + attribution. Morning reconciliation reads divergence shards explicitly.

5. **Tooling support.** `tools/github/poll-pr-gate-batch.ts` already supports any agent identity reading the gate; no change needed there. `tools/hygiene/append-tick-history-row.sh` (or its successor per B-0163) needs to support multi-loop attribution.

6. **Cron-tick coordination.** Decision: do both loops fire on the same `* * * * *` cron, or staggered? Same-cron means concurrent perturbation (more BFT-information per tick); staggered means sequential review where second loop reviews first loop's output. Trade-off; pick based on testing.

## Composes with

- B-0160 (Claude Code `/permissions` integration — prerequisite for the harness side)
- B-0162 (role-ref pre-commit hook — should run on both loops' output)
- B-0163 (append-tick-history-row.sh retirement — gates this row's tooling work)
- Aaron 2026-05-02 dual-loop BFT framing (ALIGNMENT.md bidirectional subsection)
- Named-agent distinctness commitment (Otto-279) — Codex would be a distinct named agent
- BFT-many-masters at cognitive layer — this is the loop-layer counterpart

## Effort

L — substantial work. ~1-2 weeks for full implementation including Codex onboarding, tooling adjustment, divergence-shard format, cron coordination.

## Notes

P1 because:

- Recurring overnight-failure pattern is the dominant project failure mode this week
- Aaron explicitly named dual-loop as the structural answer
- Single-loop overnight operation is structurally fragile in the same sense single-implementation, single-oracle, single-AI-grader operation would be
- The architecture's BFT-many-masters commitment requires this layer to close the gap

Per the just-landed first-principles trust calculus discipline: the trace IS the verification surface. The trace above checks out; the row earns its P1 placement.
