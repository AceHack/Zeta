---
id: 081M07Z23EX087G0R003N676FT
type: task
state: done
priority: P2
slug: derive-heatsignal-ispressure-from-one-pressure-table-so-the
title: "Derive HeatSignal.isPressure from one pressure table so the bit is enumerated once, not twice-agreeing"
created: 2026-08-17T13:37:31.101Z
completed: 2026-08-17T15:00:01.953Z
depends_on: []
composes_with: []
---

# Derive HeatSignal.isPressure from one pressure table so the bit is enumerated once, not twice-agreeing

<!-- Work-item body. ZetaId-keyed (conflict-free, time-sortable). "Backlog" is a
     STATE = this folder; completion moves the file to workitems/done/YYYY/MM/.
     Identity is the zetaid prefix — resolve cross-refs by `081M07Z23EX087G0R003N676FT-*.md` glob. -->

**The residual of 081M010W1BP087G0R002M2BNVW.** Filed, not fixed — found while correcting the
structural model of `lint-heat-kind-classifier-agreement.ts` against what #10804 actually landed.

## Two tables still enumerate the pressure bit

`src/Core/Heat.fs` names which cases are pressure **twice**, over two different unions:

```fsharp
// HeatSignature.isPressureKind — keyed on KindClass
| KindClass.Backpressure
| KindClass.Denied -> true

// HeatSignal.isPressure — keyed on HeatSignal
| HeatSignal.Backpressure
| HeatSignal.Denied -> true
```

This is strictly milder than the original defect and it should be read that way. Post-#10804
both routes funnel through the single `classifyKind` chain, so the two tables **cannot disagree
on an input** — which is exactly what the original two classifiers did. What survives is that
they can disagree on **membership**: add a `KindClass`/`HeatSignal` case and mark it pressure in
one table only, and the kind-string route answers differently from the signal route again.

## Why this is still worth closing

The work-item this descends from was closed as *"one classifier, not two agreeing ones."* Two
agreeing tables is precisely the weaker property that phrasing rejected. The compiler forces
exhaustiveness so nobody can *forget* a case, but nothing forces the two `-> true` sets to
correspond.

## Shape of the fix (not prescribed)

Decide pressure once at the `KindClass` level and recover the class from the signal:

```fsharp
// HeatSignature
let isPressureClass = function KindClass.Backpressure | KindClass.Denied -> true | _ -> false
let isPressureKind = classifyKind >> isPressureClass

// HeatSignal
let classOf : HeatSignal -> HeatSignature.KindClass = ...   // recovers the class, decides nothing
let isPressure = classOf >> HeatSignature.isPressureClass
```

`classOf` is a total, mechanical case correspondence; it does not decide the pressure bit, so
the bit is enumerated exactly once. Note `HeatSignal.isPressure`'s signature must not change —
`DarkHallScheduler.fs:146`, `Heat.fs:250,279,486`, and `SchedulerShedHeat.Tests.fs` all call it.

## Interim guard (already shipped)

`src/Core.TypeScript/hygiene/lint-heat-kind-classifier-agreement.ts` PART B3 parses both tables
and the `ofKind` map between their domains, and fails on any membership split — including a
**miswired** `ofKind` arm. Demonstrated failing against the real `src/Core/Heat.fs`: dropping
`HeatSignal.Denied` from the signal table, and routing `KindClass.Denied -> HeatSignal.Forgotten`,
both exit 1. So the drift is caught; it is just caught by a lint rather than made
unrepresentable by the types, and the lint says so in its own header.

## How it was closed

The shape above, taken as filed. `HeatSignature.isPressureClass : KindClass -> bool` is now the
only place the bit is named; `isPressureKind = classifyKind >> isPressureClass` and
`HeatSignal.isPressure = classOf >> HeatSignature.isPressureClass`. `HeatSignal.isPressure`
keeps its `HeatSignal -> bool` signature, so no caller moved.

The direction of the derive is **forced, not chosen**: F# compiles `HeatSignature` before
`HeatSignal`, so the table cannot live on the signal side and call `ofKind`. Recorded because it
is the answer to "why not key the one table on `HeatSignal` and drop `classOf`?".

**What the derive trades, stated honestly.** The membership split is gone — there is no second
`-> true` to split from. What replaces it is a *miswire* risk in `classOf`
(`HeatSignal.Denied -> KindClass.Forgotten` is exhaustive and type-checks). That residual is
smaller and it is falsified twice, by construction rather than by inspection:

- `DarkHallScheduler.Tests.fs` — the round-trip law `classOf (ofKind k) = classifyKind k`, over
  one representative kind per class including `Other`.
- `lint-heat-kind-classifier-agreement.ts` PART **B3b** — parses `ofKind` and `classOf` out of
  the file and requires them to be **mutual inverses**.

**PART B3 was rewritten, not deleted, and not kept as-is** (the vacuity question the work-item
implies). With one table, "do the two tables agree?" can no longer fail — keeping it would have
been a check that cannot fail. What replaced it:

- **B3a** — exactly one `KindClass`-keyed pressure table and **zero** `HeatSignal`-keyed ones.
  A second table reappearing is now the failure itself, *even when it agrees*.
- **B3b** — the bijection check above. Strictly stronger than the old comparison, which only saw
  miswires on a *pressure* arm; B3b sees every arm (verified: swapping `Stale`/`Expired` in
  `classOf` fails B3b and would have passed the old B3).

## Related

- `081M010W1BP087G0R002M2BNVW` — the parent (two classifiers of one bit), closed by #10804.
- `081M00TNWM8087G0R0027ACGKY` — the real repair for the underlying defect: make
  deferral-vs-destruction a **typed field** rather than a substring match. If that lands first,
  this work-item likely dissolves rather than being done.
