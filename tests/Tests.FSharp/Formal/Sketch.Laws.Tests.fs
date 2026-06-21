module Zeta.Tests.Formal.SketchLawsTests

open FsCheck
open FsCheck.Xunit
open global.Xunit
open Zeta.Core

// 081KT7YW00008QG0R002T1XNWT floor #6 — the SKETCH merge-laws (math leg), at STATE level (not the
// observable .Estimate — Amara's blade). InternalsVisibleTo lets us compare the
// real register/counter arrays. Two sub-families of "mergeable aggregation":
//   - HLL.Union     = register-wise MAX  → IDEMPOTENT join-semilattice (a CRDT).
//   - CMS.Union     = elementwise SUM    → commutative MONOID, NOT idempotent.
// (Bloom OR-merge is the same idempotent-join family; deferred — needs a bit-state
//  accessor for a state-level check.)

// ── HyperLogLog: register-max is an idempotent join-semilattice ──
let private hll (hs: uint64 list) =
    let h = HyperLogLog(8)
    for x in hs do h.AddHash x
    h

[<Property>]
let ``HLL Union is idempotent at register state (a ⊔ a = a)`` (xs: uint64 list) =
    let a = hll xs
    let snap = Array.copy a.Buckets
    a.Union(hll xs)
    a.Buckets = snap

[<Property>]
let ``HLL Union is commutative at register state`` (xs: uint64 list) (ys: uint64 list) =
    let ab = hll xs in ab.Union(hll ys)
    let ba = hll ys in ba.Union(hll xs)
    ab.Buckets = ba.Buckets

[<Property>]
let ``HLL Union is associative at register state`` (xs: uint64 list) (ys: uint64 list) (zs: uint64 list) =
    let left = hll xs in left.Union(hll ys); left.Union(hll zs)
    let right = hll ys in right.Union(hll zs); let r0 = hll xs in r0.Union(right)
    left.Buckets = r0.Buckets

[<Property>]
let ``HLL Union is an upper bound (registers only grow under merge)`` (xs: uint64 list) (ys: uint64 list) =
    let a = hll xs
    let before = Array.copy a.Buckets
    a.Union(hll ys)
    Array.forall2 (fun (b: byte) (after: byte) -> after >= b) before a.Buckets


// ── HyperMinHash: slot-max is an idempotent join-semilattice ──
let private hmh (xs: uint64 list) =
    let h = HyperMinHash(8)
    for x in xs do h.AddHash x
    h

[<Property>]
let ``HyperMinHash Union is idempotent at slot state (a ⊔ a = a)`` (xs: uint64 list) =
    let a = hmh xs
    let snap = Array.copy a.Slots
    a.Union(hmh xs)
    a.Slots = snap

[<Property>]
let ``HyperMinHash Union is commutative at slot state`` (xs: uint64 list) (ys: uint64 list) =
    let ab = hmh xs in ab.Union(hmh ys)
    let ba = hmh ys in ba.Union(hmh xs)
    ab.Slots = ba.Slots

[<Property>]
let ``HyperMinHash Union is associative at slot state`` (xs: uint64 list) (ys: uint64 list) (zs: uint64 list) =
    let left = hmh xs in left.Union(hmh ys); left.Union(hmh zs)
    let right = hmh ys in right.Union(hmh zs); let r0 = hmh xs in r0.Union(right)
    left.Slots = r0.Slots

[<Property>]
let ``HyperMinHash Union is an upper bound (slots only grow under merge)`` (xs: uint64 list) (ys: uint64 list) =
    let a = hmh xs
    let before = Array.copy a.Slots
    a.Union(hmh ys)
    Array.forall2 (fun (b: uint32) (after: uint32) -> after >= b) before a.Slots


// ── Count-Min: elementwise sum is a commutative MONOID, NOT idempotent ──
let private cms (items: uint64 list) =
    let c = CountMinSketch(4, 16, 99L)
    for h in items do c.Add(h, 1L)
    c

[<Property>]
let ``CMS Union is commutative at table state`` (xs: uint64 list) (ys: uint64 list) =
    let ab = cms xs in ab.Union(cms ys)
    let ba = cms ys in ba.Union(cms xs)
    ab.Table = ba.Table

[<Property>]
let ``CMS Union has the empty sketch as identity`` (xs: uint64 list) =
    let a = cms xs
    let snap = Array.copy a.Table
    a.Union(cms [])
    a.Table = snap

[<Property>]
let ``CMS Union is associative at table state`` (xs: uint64 list) (ys: uint64 list) (zs: uint64 list) =
    let left = cms xs in left.Union(cms ys); left.Union(cms zs)
    let right = cms ys in right.Union(cms zs); let r0 = cms xs in r0.Union(right)
    left.Table = r0.Table

[<Property>]
let ``CMS Union is NOT idempotent (sum doubles) — it is a monoid, not a join`` (xs: uint64 list) =
    // honest negative law: re-merging a non-empty sketch with itself changes state
    let nonEmpty = if List.isEmpty xs then [ 1UL ] else xs
    let a = cms nonEmpty
    let snap = Array.copy a.Table
    a.Union(cms nonEmpty)
    a.Table <> snap


// ── Deterministic error-DIRECTION guarantees (the safe half of the bounds).
//    The probabilistic MAGNITUDE bounds (Bloom FP-rate, CMS ε/δ) are proven separately:
//    empirically in Metric.MagnitudeBounds.Tests.fs (deterministic measured-vs-bound) and
//    formally in Formal/Metric.Bounds.Tests.fs (Z3-verified ε/δ derivation, premises named).
//    These one-sided laws are deterministic and always hold. ──

let private bloom (xs: uint64 list) =
    let b = BlockedBloomFilter(64, 4)
    for x in xs do b.Add(x)
    b

[<Property>]
let ``Bloom never gives a false negative (added keys always MayContain)`` (xs: uint64 list) =
    let b = bloom xs
    List.forall (fun (x: uint64) -> b.MayContain(x)) xs

[<Property>]
let ``Bloom MergeFrom is idempotent at bit state (OR join)`` (xs: uint64 list) =
    let a = bloom xs
    let snap = Array.copy a.Table
    a.MergeFrom(bloom xs)
    a.Table = snap

[<Property>]
let ``Bloom MergeFrom is commutative at bit state`` (xs: uint64 list) (ys: uint64 list) =
    let ab = bloom xs in ab.MergeFrom(bloom ys)
    let ba = bloom ys in ba.MergeFrom(bloom xs)
    ab.Table = ba.Table

[<Property>]
let ``Bloom merge preserves membership of BOTH inputs (union upper bound)`` (xs: uint64 list) (ys: uint64 list) =
    let a = bloom xs
    a.MergeFrom(bloom ys)
    List.forall (fun (x: uint64) -> a.MayContain(x)) xs && List.forall (fun (y: uint64) -> a.MayContain(y)) ys


// ── Counting Bloom Filter: retraction identity ──
[<Property>]
let ``CountingBloomFilter returns to empty state after complete retraction`` (xs: uint64 list) =
    let cb = CountingBloomFilter(64, 4)
    for x in xs do cb.Add(x)
    for x in xs do cb.Remove(x)
    List.forall (fun (x: uint64) -> not (cb.MayContain(x))) xs

[<Property>]
let ``CMS never undercounts (estimate ≥ true frequency — one-sided error)`` (items: uint64 list) =
    let c = CountMinSketch(8, 64, 7L)
    for h in items do c.Add(h, 1L)
    items
    |> List.distinct
    |> List.forall (fun h ->
        let trueCount = items |> List.filter ((=) h) |> List.length |> int64
        c.Estimate(h) >= trueCount)

// DIMENSIONALITY GUARD (Lior review 2026-06-04, gap #3): an OR-join is only valid
// when BOTH params match (m AND k). Merging mismatched shapes must THROW, not
// silently produce a meaningless filter.
[<Fact>]
let ``Bloom MergeFrom rejects a mismatched probe count (k)`` () =
    let a = BlockedBloomFilter(64, 4)
    let b = BlockedBloomFilter(64, 8) // same m, different k
    Assert.Throws<System.ArgumentException>(fun () -> a.MergeFrom(b)) |> ignore

[<Fact>]
let ``Bloom MergeFrom rejects a mismatched table length (m)`` () =
    let a = BlockedBloomFilter(64, 4)
    let b = BlockedBloomFilter(128, 4)
    Assert.Throws<System.ArgumentException>(fun () -> a.MergeFrom(b)) |> ignore
