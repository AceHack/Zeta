module Zeta.Tests.Formal.NonRegisterCollapseCrossVerifyTests

open FsCheck.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// BP-16 Leg 3 (empirical) for NON-REGISTER-COLLAPSE — FsCheck over the DEPLOYED CRDT register
// merge `GCounter.Merge` (src/Core/Crdt.fs), a grow-only per-replica counter = a weight-free
// per-traveler standing/budget register.
//
// Corroborates (independent instrument + surface) the proven floors:
//   * Lean   Facet-2  tools/lean4/Safety/NonRegisterCollapse.lean  (`non_collapse`: under commons
//            convergence via a commutative CRDT join, distinct standing registers survive merge
//            UNTOUCHED — distinctness preserved under merge).
//   * TLA+   Facet-1  tools/tla/specs/NonRegisterCollapse.tla      (no-capture; NOT witnessed here —
//            the consent-guard / capture-unreachability dimension has no runtime analogue).
//
// Soraya-routed (formal-verification-expert, 2026-06-07): target GCounter.Merge (genuinely deployed,
// no new prod code — merging Binding.Standing would collapse witness and subject into one commit).
// HONEST SCOPE (analogue, not replay): GCounter is a PURE register with no commons/standing split,
// so "distinct standing registers survive merge" is witnessed STRUCTURALLY (disjoint keys preserved)
// not SEMANTICALLY (no deployed commons-vs-standing partition exists to merge). The Lean proof stays
// the source of truth for the standing-locus claim; this leg is independent-instrument corroboration
// of its CRDT-join PREMISES over shipped F#. Triage: a counterexample ⇒ GCounter.Merge drifted from
// the join-semilattice law the Lean `non_collapse` rests on (081KT07NV0008QG0R001YDB73K is the live precedent — ordinal
// vs culture-sensitive sort once broke max-merge ASSOCIATIVITY on special keys).
//
// The bare ACI semilattice laws on GCounter STATE also live in Crdt.Laws.Tests.fs (the 081KT7YW00008QG0R002T1XNWT
// floor); they are restated here so this BP-16 leg is a self-contained witness of `non_collapse`'s
// premises, and (d) associativity is kept per Soraya as the exact 081KT07NV0008QG0R001YDB73K failure class.
// ═══════════════════════════════════════════════════════════════════

/// Ordinal-safe replica key in a small shared namespace (collisions AND distinct keys).
let private replica (d: int) = sprintf "r%d" (((d % 5) + 5) % 5)
/// Non-negative delta (GCounter.Increment rejects negatives), no abs/overflow.
let private delta (d: int) = int64 (((d % 1000) + 1000) % 1000)

let private build (ops: (int * int) list) (pick: int -> bool) : GCounter =
    ops
    |> List.indexed
    |> List.filter (fun (i, _) -> pick i)
    |> List.fold (fun (c: GCounter) (_, (_, d)) -> c.Increment(replica d, delta d)) GCounter.Empty

let private keysOf (c: GCounter) = c.Counts |> Seq.map (fun e -> e.Key) |> Set.ofSeq

// ── (a)+(b) THE CHARACTERIZING LAW: elementwise-max per key. Subsumes per-key independence
//    (disjoint keys preserved pointwise) AND no cross-key capture (a key's merged value depends
//    ONLY on the two values at THAT key, never on any other traveler's register). This IS the
//    empirical form of "distinct standing registers survive merge untouched". ──
[<Property>]
let ``Elementwise-max law: (Merge a b)[k] = max a[k] b[k] for every key (per-key independence + no cross-key capture)`` (ops: (int * int) list) =
    let a = build ops (fun i -> i % 2 = 0)
    let b = build ops (fun i -> i % 2 = 1)
    let m = GCounter.Merge a b
    Set.union (keysOf a) (keysOf b)
    |> Set.forall (fun k -> m.Counts.[k] = max (a.Counts.[k]) (b.Counts.[k]))

// ── NON-COLLAPSE (the literal witness): two DISTINCT travelers (disjoint key namespaces) merge to a
//    counter holding BOTH registers intact — neither register is overwritten/collapsed into the
//    other. This is `non_collapse` over deployed code: distinct registers survive merge untouched. ──
[<Property>]
let ``Non-collapse: distinct travelers' registers both survive merge untouched`` (xs: int list) (ys: int list) =
    let mk (prefix: string) (ds: int list) =
        ds |> List.fold (fun (c: GCounter) d -> c.Increment(prefix + replica d, delta d)) GCounter.Empty
    let a = mk "t1_" xs
    let b = mk "t2_" ys   // disjoint namespaces ⇒ genuinely distinct travelers
    let m = GCounter.Merge a b
    let aSurvives = a.Counts |> Seq.forall (fun e -> m.Counts.[e.Key] = e.Weight)
    let bSurvives = b.Counts |> Seq.forall (fun e -> m.Counts.[e.Key] = e.Weight)
    aSurvives && bSurvives

// ── NO-CAPTURE (weight-free): merging another traveler's register NEVER lowers a traveler's own
//    standing — a's own-key values are monotone under merge (max ⇒ ≥). No foreign capture. ──
[<Property>]
let ``No-capture: a traveler's own standing never decreases under merge (weight-free)`` (ops: (int * int) list) =
    let a = build ops (fun i -> i % 2 = 0)
    let b = build ops (fun i -> i % 2 = 1)
    let m = GCounter.Merge a b
    a.Counts |> Seq.forall (fun e -> m.Counts.[e.Key] >= e.Weight)

// ── (c)+(d) THE JOIN-SEMILATTICE PREMISES the Lean convergence rests on: commutative + idempotent
//    + ASSOCIATIVE over per-replica STATE (not just .Value). Associativity is the 081KT07NV0008QG0R001YDB73K class. ──
[<Property>]
let ``Join premises: GCounter.Merge is commutative, idempotent, associative over per-replica state`` (ops: (int * int) list) =
    let a = build ops (fun i -> i % 3 = 0)
    let b = build ops (fun i -> i % 3 = 1)
    let c = build ops (fun i -> i % 3 = 2)
    let commutative = (GCounter.Merge a b).Counts = (GCounter.Merge b a).Counts
    let idempotent  = (GCounter.Merge a a).Counts = a.Counts
    let associative = (GCounter.Merge (GCounter.Merge a b) c).Counts = (GCounter.Merge a (GCounter.Merge b c)).Counts
    commutative && idempotent && associative
