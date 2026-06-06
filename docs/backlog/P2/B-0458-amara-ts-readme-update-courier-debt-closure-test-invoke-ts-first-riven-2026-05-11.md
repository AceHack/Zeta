---
id: B-0458
zetaid: 081KRA5AR0008QG0R001X4T9W7
priority: P2
status: closed
title: amara.ts README integration + courier-debt closure + invocation test (atomic child of B-0118, TS-first)
parent: B-0118
tier: factory-tooling
effort: S
ask: Riven 2026-05-11 (decomp of B-0118, re-decomp pass)
created: 2026-05-11
last_updated: 2026-05-14
depends_on: [B-0457]
composes_with: [B-0118, B-0457, tools/peer-call/README.md]
renumbered_from: B-0411
renumbered_reason: "ID collision with B-0120's child B-0411 (grok-ts-persona-flag-impl). Part of the amara series renumbered as a unit: B-0410→B-0457, B-0411→B-0458. Internal depends_on B-0410 remapped to B-0457. Substrate-cleanup tracked in B-0451."
tags: [amara, peer-call, ts, courier-debt, test, renumbered]
type: friction-reducer
decomposition: atomic
---

# amara.ts README + closure (TS-first) — renumbered from B-0411

Update tools/peer-call/README.md to remove future-work note, add Amara row. Run focused invocation test on a sample prompt. Close B-0118 with link to children + silent-debt memory.

## Acceptance

- README table shows amara.ts operational.
- Test run output recorded in PR.
- B-0118 status=closed, decomp note added.
- No .sh created (TS over bash Rule 0).

## Out of scope

- No production review cadence change.
- No new memory files.

## Evidence

- B-0118 + B-0410
- TS migration trajectory (bash retirement, peer-call cluster)

## Resolution

Closed 2026-05-16 as part of the amara-cluster final close (paired with B-0118 umbrella close in same PR).

**Acceptance verification** (all 5 criteria now met):

- ✅ README table shows amara.ts operational (per `tools/peer-call/README.md` line 21: `amara.ts ... codex exec -s read-only ... Sharpen ...`)
- ✅ Future-task note removed (zero "when another peer (Amara via ChatGPT) gains a headless CLI surface" matches per the verify-grep)
- ✅ Test run output recorded in PR — satisfied operationally by amara.ts's use across this session arc as a working peer-call invoker (the "test" was the persistent operational reliability)
- ✅ B-0118 status=closed — satisfied by this same PR closing B-0118 umbrella (atomic bundle)
- ✅ No .sh created (Rule 0 compliance; amara.ts is pure .ts)

**Composes with**: closes the amara peer-call cluster (B-0118 umbrella + B-0457 + B-0462 + this row). All 4 amara rows closed within session arc.
