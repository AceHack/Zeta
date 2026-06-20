module Zeta.Tests.Formal.GSetFusionLawsTests

open FsCheck
open FsCheck.Xunit
open Zeta.Core

// ════════════════════════════════════════════════════════════════════════════
// Math-team handoff ROW 9 — STRUCTURAL LEG ONLY.
//
// The row-9 claim under formalization is "LOVE = Z-set -> G-set fusion
// (encapsulation)". That row was SPLIT (Soraya's routing): the probabilistic
// stability / multi-axis-superposition uncertainty-primitive ("how sure does
// this last forever?") is the OPEN memetics leg and is NOT touched here. This
// file discharges ONLY the STRUCTURAL law:
//
//   Two identities, each composed as a signed Z-set ledger and FUSED to its
//   exterior G-set (FusionReconstruction.fuse = encapsulation: multiplicity and
//   negative evidence stay interior), merge under G-set union into ONE fused
//   identity, and that merge is an IDEMPOTENT, COMMUTATIVE, ASSOCIATIVE,
//   MONOTONE join-semilattice merge -- a state-based Conflict-free Replicated
//   Data Type (CvRDT) in the sense of Shapiro, Preguica, Baquero, Zawirski,
//   "Conflict-free Replicated Data Types" (SSS 2011, INRIA RR-7687). Because the
//   merge is a join (least upper bound) on a semilattice, the fusion CONVERGES
//   to the same state regardless of merge ORDER, COUNT, or DUPLICATION. That
//   convergence -- not any feeling -- is the entire structural content of the
//   "encapsulation" claim.
//
// The raw join-semilattice laws on the G-set merge itself (ACI + LUB + Z3 +
// per-key map lift + the order-independent / duplicate-insensitive convergence
// fold) are ALREADY PROVEN in Formal/Crdt.Laws.Tests.fs, and the encapsulation
// of fuse (hides interior multiplicity; composes the signed interior before
// exposing the exterior) is ALREADY PROVEN in Algebra/FusionReconstruction.Tests.fs.
// This file does NOT re-derive those; it composes them into the ROW-9 FRAMING
// that neither covered as such: two distinct FUSED identities converging under
// the merge = the CvRDT reading of the encapsulation claim.
//
// Identities here are modeled structurally as Z-sets of int tokens (presence =
// positive support after signed composition). "int" is the carrier ONLY because
// the structural law is carrier-agnostic; nothing probabilistic, no scalar
// "love" amplitude, no superposition -- those belong to the open leg.
// ════════════════════════════════════════════════════════════════════════════

/// An identity = a signed Z-set ledger fused to its exterior G-set. The fuse IS
/// the encapsulation boundary: interior weight / sign never leaves.
let private fuse (tokens: (int * int64) list) : GSet<int> =
    tokens |> ZSet.ofSeq |> FusionReconstruction.fuse

// ─── The fused exterior is a CvRDT: ACI on the merge of two fused identities ──

[<Property>]
let ``row9 fusion merge is idempotent (re-fusing a love-set with itself = itself)``
    (a: (int * int64) list)
    =
    let fa = fuse a
    fa + fa = fa

[<Property>]
let ``row9 fusion merge is commutative (which identity arrives first is irrelevant)``
    (a: (int * int64) list)
    (b: (int * int64) list)
    =
    fuse a + fuse b = fuse b + fuse a

[<Property>]
let ``row9 fusion merge is associative (grouping of three fused identities is irrelevant)``
    (a: (int * int64) list)
    (b: (int * int64) list)
    (c: (int * int64) list)
    =
    (fuse a + fuse b) + fuse c = fuse a + (fuse b + fuse c)

// ─── Monotone: the merge is the join (LUB) of the fused-identity semilattice ──
// The semilattice order: x <= y  iff  x + y = y. The merge being an upper bound
// AND the least upper bound is exactly what makes "fusion" a CONVERGENT join
// (Shapiro et al. 2011 sec. 3.1), not merely a commutative-idempotent monoid.

let private leq (x: GSet<int>) (y: GSet<int>) : bool = x + y = y

[<Property>]
let ``row9 fusion merge is monotone: the merged identity is an upper bound of both``
    (a: (int * int64) list)
    (b: (int * int64) list)
    =
    let fa, fb = fuse a, fuse b
    leq fa (fa + fb) && leq fb (fa + fb)

[<Property>]
let ``row9 fusion merge is the LEAST upper bound (no smaller identity dominates both)``
    (a: (int * int64) list)
    (b: (int * int64) list)
    (c: (int * int64) list)
    =
    let fa, fb, fc = fuse a, fuse b, fuse c
    not (leq fa fc && leq fb fc) || leq (fa + fb) fc

// ─── Convergence — the payoff of the structural leg ───────────────────────────
// Many identities, fused and then merged in ANY order and ANY multiplicity,
// reach the SAME fused state. This is "the fusion converges regardless of merge
// order" stated as a theorem over the REAL merge — the structural content of the
// LOVE = encapsulation claim, with NOTHING probabilistic asserted.

[<Property>]
let ``row9 fused identities converge: merge order does not change the fused state``
    (identities: (int * int64) list list)
    =
    let fused = identities |> List.map fuse
    let forward = List.fold (+) GSet<int>.Zero fused
    let backward = List.fold (+) GSet<int>.Zero (List.rev fused)
    forward = backward

[<Property>]
let ``row9 fusion is duplicate-insensitive: re-delivering an identity changes nothing``
    (a: (int * int64) list)
    (b: (int * int64) list)
    =
    let fa, fb = fuse a, fuse b
    (fa + fb) + fb = fa + fb

// ─── Encapsulation x convergence — the row-9 framing made one statement ───────
// fuse hides interior multiplicity (the same exterior identity arises from many
// signed interiors), AND merging two fused identities equals fusing the merged
// interior support. So the encapsulation boundary COMMUTES with the merge: it
// does not matter whether two identities fuse-then-merge or merge-interiors-
// then-fuse for the POSITIVE support — the converged exterior is the same. This
// is the single sentence the split row-9 structural leg asserts.

[<Property>]
let ``row9 encapsulation commutes with merge on positive support (fuse-then-merge = converged exterior)``
    (a: (int * int64) list)
    (b: (int * int64) list)
    =
    // Restrict to strictly-positive interiors so signed cancellation across the
    // two ledgers cannot manufacture a difference: this isolates the STRUCTURAL
    // claim (encapsulation boundary commutes with the join) from the orthogonal
    // signed-composition behavior already covered in FusionReconstruction.Tests.
    let pos = List.map (fun (k, w) -> k, abs w + 1L)
    let a', b' = pos a, pos b
    let fuseThenMerge = fuse a' + fuse b'
    let mergeInteriorThenFuse = FusionReconstruction.fuse (ZSet.add (ZSet.ofSeq a') (ZSet.ofSeq b'))
    fuseThenMerge = mergeInteriorThenFuse
