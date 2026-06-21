---
id: 081KR7JY10008QG0R0035GWRQ0
priority: P1
status: open
title: "Cron-tick coordination for dual-loop operation (dual-loop AC #6)"
effort: S
created: 2026-05-10
last_updated: 2026-05-31
depends_on:
  - 081KR7JY10008QG0R000MH7PJT
parent: 081KQJZR90008QG0R002GJAJ19
classification: blocked
decomposition: atomic
owners: [architect]
type: friction-reducer
tags: [dual-loop, bft, cron, coordination, tick-cadence]
---

# 081KR7JY10008QG0R0035GWRQ0 — Cron-tick coordination for dual-loop operation

## Context

Extracted from 081KQJZR90008QG0R002GJAJ19 AC #6 during decomposition (2026-05-10).

When two loops are running, both firing on `* * * * *` cron, the question
of **when each fires relative to the other** has nontrivial consequences for
the quality of the BFT signal. This row closes the open decision and its
implementation.

## The decision

Two coordination topologies:

**Same-cron (concurrent):** Both loops fire at the same minute mark. Each
operates on the same world state independently. Disagreements surface as true
independent perturbations. More BFT-information per tick because the loops
genuinely did not see each other's output. Downside: if they both try to
push to the same branch in the same minute, a conflict arises.

**Staggered (sequential):** One loop fires at `:00`, the other at `:30`
(or similar). The second loop reads the first loop's output before acting.
The second loop can catch errors in the first's tick output. Less
BFT-independence but more error-recovery coverage. Downside: the second loop
can be biased by the first's framing ("anchor effect").

Aaron's 2026-05-02 framing did not specify topology; the choice is open.
The trade-off maps to what failure mode is higher-priority:

- *Correlated failure*: both loops drift in the same wrong direction → same-cron catches this better (independent perturbations)
- *Cascade error*: loop A's wrong output feeds loop B → staggered catches this better (loop B reviews loop A)

## What

1. **Decision**: pick one topology (same-cron or staggered) based on current
   dual-loop risk profile. Document the reasoning in an ADR.
2. **Implementation**: wire the chosen topology into `CronCreate` calls at
   each loop's harness startup. If staggered: offset by 30s (`*/1 * * * *`
   at second 0 vs. second 30 or equivalent — note CronCreate uses `* * * * *`
   granularity; sub-minute stagger requires process-level sleep at harness startup).
3. **Divergence-shard integration**: when concurrent ticks collide on the
   same write target, the divergence-shard protocol (081KR7JY10008QG0R000MH7PJT / 081KQJZR90008QG0R002GJAJ19 AC #4)
   governs resolution.

## Acceptance criteria

1. Topology decision documented in an ADR
   (`docs/DECISIONS/YYYY-MM-DD-dual-loop-cron-coordination-topology.md`).
2. Both loops fire at the chosen offset, verified by a 5-minute observation
   window of tick shard timestamps.
3. No silent overwrites: if both loops write to the same target in the same
   tick, the conflict is detected and a divergence shard is filed.
4. The chosen topology is documented in `docs/AUTONOMOUS-LOOP.md` with a note
   on the trade-off rationale.

## Blocker

081KQJZR90008QG0R000FTJ1TC is closed, so the harness-side prerequisite is no longer the active
blocker. This row now waits on 081KR7JY10008QG0R000MH7PJT's live PR-review caller wiring: the
cron topology decision should observe a system where differing loop conclusions
on the same PR review thread can actually file a divergence shard.

## Composes with

- 081KQJZR90008QG0R000FTJ1TC (dual-loop harness integration — closed prerequisite)
- 081KQJZR90008QG0R002GJAJ19 (parent — divergence-shard schema)
- 081KR7JY10008QG0R000MH7PJT (PR-review disagreement protocol — affected by topology choice)
- 081KR7JY10008QG0R000HEPQ8Y (tick-tooling attribution — concurrent writes need write-safety audit)
- `docs/AUTONOMOUS-LOOP.md` (authoritative loop documentation)
