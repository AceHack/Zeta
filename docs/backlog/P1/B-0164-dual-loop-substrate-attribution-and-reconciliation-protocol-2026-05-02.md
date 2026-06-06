---
id: B-0164
zetaid: 081KQJZR90008QG0R002GJAJ19
priority: P1
status: open
title: Dual-loop substrate attribution + reconciliation protocol — implementation work for BFT-many-masters at loop layer (Aaron 2026-05-02 + Otto independent extension)
created: 2026-05-02
last_updated: 2026-05-31
depends_on:
  - B-0160
children:
  - B-0164.1
  - B-0164.2
  - B-0164.3
decomposition: decomposed
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

1. **Per-loop attribution channel.** ✅ SATISFIED BY EXISTING SUBSTRATE — Otto's tick-shards under `docs/hygiene-history/ticks/**` already include col2 model-identifier (e.g., `opus-4-7 / autonomous-loop session continuation`). Codex's loop should write to the same shard surface with its own model-identifier (e.g., `gpt-5.5 / codex-loop`). The col2 schema accommodates this; no schema change needed.

2. **Disagreement-preservation protocol for PR reviews.** ⏳ PARTIAL — B-0164.1 has landed the pure detector/writer, divergence-shard builder, pending-shard reader, and reconcile CLI. Remaining work: wire a live PR-review workflow path so two loop observations on the same GitHub review thread actually invoke `fileReviewThreadDisagreement` when their conclusions differ.

3. **Branch-attribution for in-flight work.** ✅ SATISFIED BY EXISTING SUBSTRATE — When both loops produce concurrent commits to the same branch: each loop commits with its own author-identifier (already supported by `Co-Authored-By` trailer). Different loops working different threads don't conflict if file-isolation holds; if they touch the same file, the second loop's tick should detect the conflict and either rebase OR file a divergence-shard noting the conflict for morning reconciliation.

4. **Substrate-divergence shard format.** ✅ DONE (PR #2475, 2026-05-10) — `docs/hygiene-history/divergences/` created with README (schema + naming + frontmatter + reconciliation protocol + worked example). When two loops disagree on substrate-class commitment (different memory file content, different ALIGNMENT.md interpretation), file a per-tick shard under `docs/hygiene-history/divergences/YYYY/MM/DD/HHMMSSZ-<hash>.md` with both perspectives + attribution. Morning reconciliation reads divergence shards explicitly.

5. **Tooling support.** ⏳ BLOCKED (gated by B-0163) — `tools/github/poll-pr-gate-batch.ts` already supports any agent identity reading the gate; no change needed there. `tools/hygiene/append-tick-history-row.sh` (or its successor per B-0163) needs to support multi-loop attribution.

6. **Cron-tick coordination.** ⏳ BLOCKED — requires dual-loop running. Decision: do both loops fire on the same `* * * * *` cron, or staggered? Same-cron means concurrent perturbation (more BFT-information per tick); staggered means sequential review where second loop reviews first loop's output. Trade-off; pick based on testing.

## Composes with

- B-0160 (Claude Code `/permissions` integration — prerequisite for the harness side)
- B-0162 (role-ref pre-commit hook — should run on both loops' output)
- B-0163 (append-tick-history-row.sh retirement — gates this row's tooling work)
- Aaron 2026-05-02 dual-loop BFT framing (ALIGNMENT.md bidirectional subsection)
- Named-agent distinctness commitment (Otto-279) — Codex would be a distinct named agent
- BFT-many-masters at cognitive layer — this is the loop-layer counterpart

## Pre-start checklist (2026-05-10, fix/B-0164-divergence-shard-schema)

**Slice**: AC #4 only — substrate-divergence shard schema (`docs/hygiene-history/divergences/` README)

### 1. Prior-art search

- `wake-time-substrate`: tick shard README at `docs/hygiene-history/ticks/README.md` — no divergence directory or schema found
- `skill-router`: no skill named "divergence-shard" or "dual-loop"
- `orthogonal-axes` / `tools/hygiene/LOST-FILES-LOCATIONS.md`: no existing divergence surface
- `Otto-364` (search-first): `docs/backlog/P1/B-0164-*.md` is the only source naming the `divergences/` path
- `PR #1701` prior-art grep: `grep -r "divergences/" docs/` returns only the B-0164 row itself
- `decision-archaeology` via `git log --all --oneline -- docs/hygiene-history/divergences/`: no history
- **Result**: no prior art found; directory does not exist; safe to create

### 2. Dependency restructure

- `depends_on: B-0160` — B-0160 is P0 (`docs/backlog/P0/B-0160-*.md`); the divergence-shard schema (AC #4) does not depend on B-0160's harness integration; AC #4 is schema-only, safe to land independently
- `composes_with: B-0162, B-0163` — B-0162 (pre-commit hook, P1) and B-0163 (append-tick-history-row.sh retirement, P3) are independent; no pointer update needed for this slice
- `composes_with: ticks/README.md` — reciprocal pointer added in divergences/README.md

### 3. Proof of isolation

ACs #1 (attribution channel), #3 (branch attribution) are already satisfied by existing substrate. AC #2 (PR review protocol) and AC #6 (cron coordination) require dual-loop running. AC #5 (tooling) is gated by B-0163. AC #4 is the only AC deliverable without those dependencies.

## Pre-start checklist (2026-05-10, fix/B-0164-ticks-readme-divergence-pointer)

**Slice**: Reciprocal pointer — add "Composition with divergence shards" section to `docs/hygiene-history/ticks/README.md` + update AC status markers in this row.

### 1. Prior-art search

- `divergences/README.md` → already references `docs/hygiene-history/ticks/README.md` (outgoing pointer exists)
- `ticks/README.md` → no reference to `docs/hygiene-history/divergences/` found (incoming pointer missing)
- `grep -r "divergences" docs/hygiene-history/ticks/`: zero results — confirms the gap
- **Result**: reciprocal pointer is missing; safe to add

### 2. Dependency restructure

- No new dependencies introduced; this is additive documentation only
- `composes_with: ticks/README.md` — this slice completes the reciprocal-pointer pair

### 3. Proof of isolation

This is a pure documentation update: one new section in `ticks/README.md` + AC status markers on this backlog row. No code, no schema, no tooling. Isolated from all blocked ACs.

## Effort

L — substantial work. ~1-2 weeks for full implementation including Codex onboarding, tooling adjustment, divergence-shard format, cron coordination.

## Notes

P1 because:

- Recurring overnight-failure pattern is the dominant project failure mode this week
- Aaron explicitly named dual-loop as the structural answer
- Single-loop overnight operation is structurally fragile in the same sense single-implementation, single-oracle, single-AI-grader operation would be
- The architecture's BFT-many-masters commitment requires this layer to close the gap

Per the just-landed first-principles trust calculus discipline: the trace IS the verification surface. The trace above checks out; the row earns its P1 placement.

## Decomposition (2026-05-10)

ACs #1, #3, #4 are closed. Remaining open work extracted as atomic child rows:

| Child | AC | Blocker | File |
|-------|----|---------|------|
| B-0164.1 | AC #2 — PR-review disagreement-preservation | Live PR-review caller wiring | `B-0164.1-pr-review-disagreement-preservation-protocol.md` |
| B-0164.2 | AC #5 — Multi-loop tick-tooling attribution | B-0163 (tooling retirement) | `B-0164.2-multi-loop-tick-tooling-attribution.md` |
| B-0164.3 | AC #6 — Cron-tick coordination | B-0164.1 live caller + topology observation | `B-0164.3-cron-tick-coordination-dual-loop.md` |

**Dependency order:**

```
B-0160 (closed) ──→  B-0164.1 caller wiring  ──→  B-0164.3
B-0163  ──→  B-0164.2  ──→  (B-0164.3 write-safety audit)
```

B-0164 itself closes when all three children are resolved.
