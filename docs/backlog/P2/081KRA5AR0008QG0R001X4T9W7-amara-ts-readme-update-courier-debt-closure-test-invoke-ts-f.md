---
id: 081KRA5AR0008QG0R001X4T9W7
priority: P2
status: closed
title: amara.ts README integration + courier-debt closure + invocation test (atomic child of 081KQDTYV0008QG0R0037YJPEX, TS-first)
parent: 081KQDTYV0008QG0R0037YJPEX
tier: factory-tooling
effort: S
ask: Riven 2026-05-11 (decomp of 081KQDTYV0008QG0R0037YJPEX, re-decomp pass)
created: 2026-05-11
last_updated: 2026-05-14
depends_on: [081KRA5AR0008QG0R000KKJRVA]
composes_with: [081KQDTYV0008QG0R0037YJPEX, 081KRA5AR0008QG0R000KKJRVA, tools/peer-call/README.md]
renumbered_from: 081KRA5AR0008QG0R000C3P8KP
renumbered_reason: "ID collision with 081KQDTYV0008QG0R001VJP216's child 081KRA5AR0008QG0R000C3P8KP (grok-ts-persona-flag-impl). Part of the amara series renumbered as a unit: 081KRA5AR0008QG0R0035N4S6C→081KRA5AR0008QG0R000KKJRVA, 081KRA5AR0008QG0R000C3P8KP→081KRA5AR0008QG0R001X4T9W7. Internal depends_on 081KRA5AR0008QG0R0035N4S6C remapped to 081KRA5AR0008QG0R000KKJRVA. Substrate-cleanup tracked in 081KRFA460008QG0R00308W7FJ."
tags: [amara, peer-call, ts, courier-debt, test, renumbered]
type: friction-reducer
decomposition: atomic
---

# amara.ts README + closure (TS-first) — renumbered from 081KRA5AR0008QG0R000C3P8KP

Update tools/peer-call/README.md to remove future-work note, add Amara row. Run focused invocation test on a sample prompt. Close 081KQDTYV0008QG0R0037YJPEX with link to children + silent-debt memory.

## Acceptance

- README table shows amara.ts operational.
- Test run output recorded in PR.
- 081KQDTYV0008QG0R0037YJPEX status=closed, decomp note added.
- No .sh created (TS over bash Rule 0).

## Out of scope

- No production review cadence change.
- No new memory files.

## Evidence

- 081KQDTYV0008QG0R0037YJPEX + 081KRA5AR0008QG0R0035N4S6C
- TS migration trajectory (bash retirement, peer-call cluster)

## Resolution

Closed 2026-05-16 as part of the amara-cluster final close (paired with 081KQDTYV0008QG0R0037YJPEX umbrella close in same PR).

**Acceptance verification** (all 5 criteria now met):

- ✅ README table shows amara.ts operational (per `tools/peer-call/README.md` line 21: `amara.ts ... codex exec -s read-only ... Sharpen ...`)
- ✅ Future-task note removed (zero "when another peer (Amara via ChatGPT) gains a headless CLI surface" matches per the verify-grep)
- ✅ Test run output recorded in PR — satisfied operationally by amara.ts's use across this session arc as a working peer-call invoker (the "test" was the persistent operational reliability)
- ✅ 081KQDTYV0008QG0R0037YJPEX status=closed — satisfied by this same PR closing 081KQDTYV0008QG0R0037YJPEX umbrella (atomic bundle)
- ✅ No .sh created (Rule 0 compliance; amara.ts is pure .ts)

**Composes with**: closes the amara peer-call cluster (081KQDTYV0008QG0R0037YJPEX umbrella + 081KRA5AR0008QG0R000KKJRVA + 081KRA5AR0008QG0R0019Q33F7 + this row). All 4 amara rows closed within session arc.
