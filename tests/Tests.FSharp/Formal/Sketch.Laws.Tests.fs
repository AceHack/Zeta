module Zeta.Tests.Formal.SketchLawsTests

open FsCheck
open FsCheck.Xunit
open Zeta.Core

// B-1016 floor #6 — the SKETCH merge-laws (math leg), at STATE level (not the
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
