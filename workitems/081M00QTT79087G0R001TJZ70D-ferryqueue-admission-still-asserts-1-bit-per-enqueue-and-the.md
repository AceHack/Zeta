---
id: 081M00QTT79087G0R001TJZ70D
type: task
state: backlog
priority: P2
slug: ferryqueue-admission-still-asserts-1-bit-per-enqueue-and-the
title: "FerryQueue admission still asserts 1 bit per enqueue, and the tracker has no reversible-egress door"
created: 2026-08-14T18:16:31.209Z
depends_on: []
composes_with: []
---

# FerryQueue admission still asserts 1 bit per enqueue, and the tracker has no reversible-egress door

Residual from deriving the `measure(bitsErased)` inputs (081M00CPFNA087G0R0031M5ZBF). Two
things were named and deliberately left rather than fixed under the same change.

## 1. The admission side is still asserted

`physics-traits.ts` `createFerryQueue.enqueue` calls `tracker.branch()` — a flat +1 bit per
item. That is the same defect class the erasure side just had, on the other ledger: the
queue does not know how many bits an item carries, so `1` is a counting unit wearing an
information-theoretic name. Deriving it needs a declared item domain (`itemDomainBits`, the
sibling of the `valueDomainBits` that `createNonAdjMap` now takes), and no shipped caller
supplies one — `createFerryQueue` currently has no production callers at all.

## 2. The tracker has no reversible-egress door

`EntropyTracker` has an admission door (`branch`) and an erasure door (`measure`), and
nothing in between. A queue that hands its items back has moved information OUT of its state
without destroying it, and there is nowhere to record that — so after `flush()`,
`entropy_state` still reports the admitted bits while `q.pending` is 0. This is asserted in
`physics-traits.test.ts` ("Ledger A retains the admitted bits after a drain") so the gap is
visible rather than folded away. The previous code hid it by charging heat for a bijection,
which balanced the ledger at the cost of the ledger being false.

Candidate shape: `release(bits)` — bits leave Ledger A with no heat, giving the conservation
law `bits_admitted = bits_released + bits_erased + entropy_state`. Not landed, because the
interface change touches every `EntropyTracker` implementor and the balance it buys is not
needed by any shipped caller today.

## 3. Also unresolved: operation-level vs per-instance erasure

`erasure-derivation.ts` computes the **operation-level** figure (worst case over the swept
domain). A finer per-instance figure exists — writing into an empty map slot destroys less
than writing over an occupied one — but it requires modelling caller-retained side
information, which the two-ledger tracker does not carry. The boundary is stated in the
module header; picking one reading silently is how a bit count becomes a guess again.

## Anchors

Landauer 1961; Bennett 1973; `src/Core.TypeScript/algebra/erasure-derivation.ts`;
`tests/Tests.FSharp/Formal/WSet.ErasureClassification.Laws.Tests.fs` (PR #10611).
