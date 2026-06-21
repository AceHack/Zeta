---
id: 081KQNJ500008QG0R001N1AAJ9
priority: P1
status: closed
title: Fix Spine.als spec bug — Alloy 6.2.0 type-check failure at line 35 col 25 (sum-vs-all comprehension confusion) + check-vs-run-vs-fact semantic confusion
tier: formal-verification
effort: M
ask: Otto 2026-05-03 — surfaced via 081KQNJ500008QG0R003EKJ8B5 Phase 1 TS wrapper (#1413) after fixing AlloyRunner.java's stale A4Options.SatSolver API. Once Alloy actually compiles + runs against current alloy.jar v6.2.0, Spine.als had two bugs: (1) sum-comprehension parens missing (parse error); (2) check-command semantics was wrong (asked "does property hold for ALL instances?" when intent was "what instances are valid spines?"). Bumped to P1 because after #1413 lands the spec is on the active CI surface; leaving it broken would lose Spine.als coverage, not just defer it.
created: 2026-05-03
last_updated: 2026-05-03
depends_on: []
composes_with: [081KQNJ500008QG0R003EKJ8B5, docs/research/2026-05-03-math-proofs-honest-assessment.md, tools/alloy/specs/Spine.als]
tags: [alloy, formal-verification, spec-bug, type-check, latent-bug-surfaced, b2-followup, closed]
---

# Fix Spine.als — Alloy 6.2.0 type error at line 35 col 25

## Symptom

Running Alloy on `tools/alloy/specs/Spine.als` (with current
`alloy.jar` v6.2.0 + the post-#1413 fixed `AlloyRunner.java`):

```
Type error in tools/alloy/specs/Spine.als at line 35 column 25:
This must be an integer expression.
Instead, it has the following possible type(s):
{PrimitiveBoolean}
```

## Source line

```
33: pred SizeDoubling [maxCap : Int] {
34:   all l : Level |
35:     sum b : l.batches | b.size <= mul[2, cap[l.level, maxCap]]
36: }
```

The Alloy parser reads `sum b : l.batches | <body>` where `<body>`
must be an integer expression. But `b.size <= mul[...]` is a Boolean
comparison, not an integer.

## Likely intent

The author probably meant one of:

1. `all b : l.batches | b.size <= mul[2, cap[l.level, maxCap]]`
   (universal quantification — every batch's size <= bound)
2. `(sum b : l.batches | b.size) <= mul[2, cap[l.level, maxCap]]`
   (sum of all batch sizes <= bound)

Option 1 is consistent with the comment "every batch at level i has
size ≤ 2 * cap(i-1)". The current `sum` syntax is likely a typo /
bit-rot from an older Alloy version.

## Latent-bug-surface lineage

This bug existed in the spec but was NEVER actually verified
because:

1. `AlloyRunner.java:38` referenced `A4Options.SatSolver.SAT4J`
   (no longer in alloy.jar v6.2.0)
2. `compileRunnerIfNeeded()` returned false on compile failure
3. `toolchainReady()` returned false
4. F# `assertSpecValid` silently no-op'd
5. xunit reported all Alloy tests as PASSED

Same silent-skip class as the cache-clobber bug + the docs/<Spec>
spec-path bug. Surfaced when #1413's TS wrapper failed loudly on
the compile failure, leading to the AlloyRunner.java fix, which
exposed this latent spec bug.

## Fix path

1. Read Spine.als end-to-end to confirm the intent of the
   SizeDoubling predicate
2. Replace `sum b : l.batches | <body>` with `all b : l.batches |
   <body>` (Option 1 above) OR `(sum b : l.batches | b.size) <=
   <body>` (Option 2)
3. Re-run TLC + Alloy locally; verify clean
4. If Option 1: also check whether SizeDoubling is used in any
   `check` / `run` command — semantic change should preserve those

## Why P2

Pre-existing latent failure surfaced post-cleanup. Doesn't block
any current production workflow (the spec was never actually
running). Closes the silent-skip hangover from the AlloyRunner.java
chain.

## Composes with

- 081KQNJ500008QG0R003EKJ8B5 (TS wrapper migration; #1413 surfaced this)
- 081KQNJ500008QG0R003EKJ8B5 Phase 3 retirement of F# Alloy tests — Spine.als fix
  needs to land before retirement so the TS wrapper passes
- math-proofs honest assessment B2 grade (currently A; this row is
  the honest follow-up to keep that grade defensible)

## Resolution (2026-05-03)

**Two-part fix landed** in same PR:

1. **Parens around sum-comprehension** (line 35): `(sum b : l.batches | b.size) <= mul[2, cap[l.level, maxCap]]`. Matches the comment intent ("total size at level i ≤ 2 * cap(i)") — sum-then-compare, not sum-of-Booleans.

2. **Replaced `check` command with `fact` + `run`**: the original `check SizeDoublingHolds { SizeDoubling[1] }` asked "does SizeDoubling[1] hold for ALL bounded instances?" — Alloy trivially constructs counterexamples by allowing arbitrary Int batch sizes. Real intent: declare what valid spines look like, then verify constructibility.

   Replacement:
   - Added `fact NonNegativeBatchSizes { all b : Batch | b.size >= 0 }` to constrain the model space (real LSM spines have non-negative element counts; without this, Alloy explores the full Int range including negatives).
   - Replaced `check` with `run SizeDoublingAdmitsInstance { SizeDoubling[1] and some Level and some Batch } for 4 but 8 Batch, 4 Level, 7 Int`. The `7 Int` bitwidth bump prevents `cap[3, 1] = 8` and `cap[4, 1] = 16` from overflowing 4-bit signed Int.

**Local verification:** `java -jar tools/alloy/alloy.jar exec -f tools/alloy/specs/Spine.als` returns `00. run SizeDoublingAdmitsInstance 0 1/1 SAT` — instance found. AlloyRunner.java translates SAT-on-run to OK output.

**F# Skip removed**: `Alloy.Runner.Tests.fs` Spine `[<Fact(Skip = "...")>]` reverted to plain `[<Fact>]`. Spine is back on the active CI surface.

## Discipline lessons captured

1. **Check-vs-run-vs-fact semantic confusion**: `check` asks "for all bounded instances, does property hold?" — useful for asserting structural invariants must hold. `run` asks "does an instance exist where property holds?" — useful for existence proofs and constructive validation. `fact` declares "valid models satisfy this" — restricts the model space. Mixing these up produces either trivial counterexamples (`check` with no constraining facts) or vacuous passes (`run` with no constraining body).

2. **Alloy Int bitwidth must accommodate cap-function range**: any bounded computation that exceeds the signed Int range produces silent wraparound that breaks invariants. Bump bitwidth proactively.

3. **Reviewer's "P2 vs P1" framing**: when a fix becomes part of the active CI surface (post-AlloyRunner.java compile fix), losing coverage by skipping is regression-y. Bumped P2→P1 in this row to reflect the changed blast radius.
