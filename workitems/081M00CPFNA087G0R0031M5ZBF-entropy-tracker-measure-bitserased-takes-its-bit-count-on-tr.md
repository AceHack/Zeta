---
id: 081M00CPFNA087G0R0031M5ZBF
type: task
state: backlog
priority: P2
slug: entropy-tracker-measure-bitserased-takes-its-bit-count-on-tr
title: "entropy-tracker measure(bitsErased) takes its bit count on trust - derive it from the operation like the WSet erasure sweep does"
created: 2026-08-14T15:01:54.986Z
depends_on: []
composes_with: []
---

# entropy-tracker measure(bitsErased) takes its bit count on trust - derive it from the operation like the WSet erasure sweep does

Residual from the four-corner Landauer siting (PR for
`tests/Tests.FSharp/Formal/WSet.ErasureClassification.Laws.Tests.fs`).

## The gap

`src/Core.TypeScript/algebra/entropy-tracker.ts` is now sound — `verifyLandauer`'s
`x >= x` is gone and `auditEntropyLedger` reports each fact separately. But its
**input** is still asserted rather than measured:

```
measure(bitsErased: number): void   // caller supplies the bit count
```

Every caller hands it a constant. `physics-traits.ts` `createNonAdjMap` and
`src/Core.TypeScript/observe/event-sink-folder.ts` both call `measure(1)` — one bit per append, by
declaration. Nothing computes the bits an operation *actually* destroys, so the
ledger is only as honest as the constants feeding it. A sound meter with an
asserted input is the same defect one layer in.

## What "derived" looks like — the pattern already exists

`WSet.ErasureClassification.Laws.Tests.fs` derives the number instead of taking
it: sweep the operation over an enumerable domain, group by image, and read
`bitsErased = log2(largest fibre)`. That is the information-theoretic quantity
Landauer 1961 prices, computed from the operation itself. Measured values on the
ℤ corner: `consolidate` 3.459 bits, `discard` 3.907, `bornProb` 2.807, `tensor`
6.409, `plus` 1.585; `negate`/`copy`/`mapKeys`/`apply`(injective) all exactly 0.

## Candidate scope

- Give `measure` a derived-bits path for operations whose fibres are enumerable,
  and keep the asserted path clearly labelled as asserted where they are not.
- Check the `measure(1)`-per-append claim in `src/Core.TypeScript/observe/event-sink-folder.ts`: is one
  append really one bit erased, or is that a placeholder constant?

## Also noted while siting the meter (separate, smaller)

`src/Core/ToffoliGate.fs` carries the repo's bit-level reversibility model and
has **zero production callers** — only its own `Core.fsproj` entry and
`tests/Tests.FSharp/Formal/ToffoliGate.Laws.Tests.fs`. It is a well-tested model
that nothing in the substrate is checked against. Either bridge it to the ZSet
path or say plainly that it is a reference model. Not a defect; an unstated
status.

## Status 2026-08-14 — the derivation landed; two of six charges were on bijections

`src/Core.TypeScript/algebra/erasure-derivation.ts` now computes the figure by the same rule
the WSet sweep uses (group by observable output, `bits = log2(largest fibre)`), and every
`measure()` call site takes its number from it. Per call site:

| call site | was | derived | verdict |
|---|---|---|---|
| `key-erasure-meter.meterKeyErasure` | `record.bits` | `record.bits` | already derived — exact |
| `physics-traits` `NonAdjMap.put` / `.delete` | `1` | `log2(\|V\|+1)` | `1` was the FLOOR of an uncomputed quantity; exact once `valueDomainBits` is declared |
| `physics-traits` `FerryQueue.dequeue` | `1` | `0` | **meter on a bijection** — the item is returned |
| `physics-traits` `FerryQueue.flush` | `batchSize` | `0` | **meter on a bijection** — the batch is returned |
| `observe/event-sink-folder.append` | `1` | `0` | **meter on a bijection** — append-only G-Set; the erasure is the chooser's `log2(N)`, added as `decisionCandidates` |
| `spec-weight-view.measure` | pass-through | n/a | asserts nothing; separately fixed to stop discharging its window on a zero-bit measure |

Remaining: 081M00QTT79087G0R001TJZ70D (the queue's asserted `branch()` admission unit, the
missing reversible-egress door, and the operation-level vs per-instance boundary). The
ToffoliGate note below is untouched and still open.

## Anchors

Landauer 1961; Bennett 1973; `src/Core.Lean4/Lean4/LandauerFloor.lean` (§
"Faithfulness to the implementation", Soraya 2026-08-13, which found the
signed-ledger half of this same class of gap).
