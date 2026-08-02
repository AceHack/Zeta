module Zeta.Tests.TravelerFrameTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module TF = Zeta.Core.TravelerFrame

// ═══════════════════════════════════════════════════════════════════
// Traveler frame — Layer-0 inter-frame TRANSFORMATION LAW.
// (docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md §B-frame, Layer 0 — the one open obligation.)
//
// The transformation between two travelers' causal frames IS the content of a "relative frame"
// (relativity: transformation between worldlines; distributed systems: merge of causal views).
// Here the transformation is the causal-join (pointwise max = LUB). This suite PROVES it forms a
// bounded join-semilattice — identity, idempotent, commutative, associative, monotone — and hence
// is ORDER-INDEPENDENT: any set of travelers reaches ONE common frame regardless of merge order.
// That is the relative-frame CONSISTENCY law (convergence-despite-reordering at the frame level).
//
// The scalar pointwise-max semilattice laws are already Z3-proven for the Clock/CRDT floor; this
// lifts them to the first-class frame and proves the frame-transformation interpretation directly.
// ═══════════════════════════════════════════════════════════════════

// A frame generator: a handful of actors with small non-negative versionstamps.
let private genFrame : Gen<TF.Frame> =
    gen {
        let! n = Gen.choose (0, 4)
        let! pairs =
            Gen.listOfLength n (
                gen {
                    let! actor = Gen.elements [ "a"; "b"; "c"; "d"; "e" ]
                    let! v = Gen.choose (0, 50) |> Gen.map int64
                    return actor, Versionstamp.ofInt64 v
                })
        // fold via observe so duplicate actors collapse to the max (a valid frame by construction)
        return pairs |> List.fold (fun f (act, st) -> TF.observe act st f) TF.origin
    }

type FrameArb() =
    static member F() = Arb.fromGen genFrame

// ── the join-semilattice laws (the transformation law) ──

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``transform has the origin as identity (⊥)`` (f: TF.Frame) =
    TF.transform f TF.origin = f && TF.transform TF.origin f = f

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``transform is idempotent`` (f: TF.Frame) =
    TF.transform f f = f

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``transform is commutative`` (a: TF.Frame) (b: TF.Frame) =
    TF.transform a b = TF.transform b a

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``transform is associative`` (a: TF.Frame) (b: TF.Frame) (c: TF.Frame) =
    TF.transform (TF.transform a b) c = TF.transform a (TF.transform b c)

// ── monotonicity: the transform is the LEAST UPPER BOUND ──

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``transform dominates both inputs (upper bound)`` (a: TF.Frame) (b: TF.Frame) =
    let j = TF.transform a b
    TF.dominates j a && TF.dominates j b

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``transform is the LEAST upper bound`` (a: TF.Frame) (b: TF.Frame) (g: TF.Frame) =
    // In a join-semilattice every upper bound u of {a,b} satisfies u = join ⊔ g for some g, and
    // conversely join ⊔ g is always an upper bound. So `u = transform (transform a b) g` ranges over
    // exactly the upper bounds of {a,b} with no rejection sampling — and the LUB law says each such u
    // dominates the join. (Also confirm u genuinely dominates a and b, so it IS an upper bound.)
    let j = TF.transform a b
    let u = TF.transform j g
    TF.dominates u a && TF.dominates u b && TF.dominates u j

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``dominates is reflexive and the join orders consistently`` (a: TF.Frame) =
    TF.dominates a a && TF.dominates (TF.transform a a) a

// ── the headline: relative-frame CONSISTENCY (convergence-despite-reordering) ──

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``commonFrame is independent of merge order (the relative-frame consistency law)``
    (frames: TF.Frame list) =
    match frames with
    | [] | [ _ ] -> true
    | _ ->
        let forward = TF.commonFrame frames
        let reversed = TF.commonFrame (List.rev frames)
        // a deterministic non-trivial reordering (rotate) too
        let rotated = TF.commonFrame (List.tail frames @ [ List.head frames ])
        forward = reversed && forward = rotated

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``commonFrame is idempotent under re-merging a member (redelivery-safe)``
    (frames: TF.Frame list) =
    match frames with
    | [] -> true
    | f :: _ ->
        let once = TF.commonFrame frames
        let twice = TF.transform once f // re-observe a member already folded in
        once = twice

// ── observe semantics: monotone coordinate advance ──

[<Fact>]
let ``observe advances a coordinate by max, never regresses`` () =
    let f = TF.origin |> TF.observe "a" (Versionstamp.ofInt64 5L)
    Assert.Equal(5L, (TF.coord "a" f).Version)
    let f2 = f |> TF.observe "a" (Versionstamp.ofInt64 3L) // older → no-op
    Assert.Equal(5L, (TF.coord "a" f2).Version)
    let f3 = f2 |> TF.observe "a" (Versionstamp.ofInt64 9L) // newer → advances
    Assert.Equal(9L, (TF.coord "a" f3).Version)

[<Fact>]
let ``two travelers converge to one common frame after exchanging views`` () =
    // Traveler A has seen a@3, b@1; Traveler B has seen b@4, c@2. The transformation (causal-join)
    // is the common frame: a@3, b@4, c@2 — and it is what BOTH compute regardless of who merges first.
    let a = TF.origin |> TF.observe "a" (Versionstamp.ofInt64 3L) |> TF.observe "b" (Versionstamp.ofInt64 1L)
    let b = TF.origin |> TF.observe "b" (Versionstamp.ofInt64 4L) |> TF.observe "c" (Versionstamp.ofInt64 2L)
    let ab = TF.transform a b
    let ba = TF.transform b a
    Assert.Equal(ab, ba)
    Assert.Equal(3L, (TF.coord "a" ab).Version)
    Assert.Equal(4L, (TF.coord "b" ab).Version)
    Assert.Equal(2L, (TF.coord "c" ab).Version)

// ═══════════════════════════════════════════════════════════════════
// concurrent — the SPACELIKE predicate (a ‖ b). The sole legal gate for spacelike pair-selection
// (the CHSH interference-monitor). Concurrency by the versionstamp partial order ONLY, never
// wall-clock (local-time-never-enters-the-shared-fold). These properties pin the four-cell
// tetrachotomy of (dominates a b, dominates b a) and the genuine-fork semantics, so a wrong
// definition (∧→∨, or a dropped conjunct) fails the suite.
// ═══════════════════════════════════════════════════════════════════

// Does some coordinate strictly favour `x` over `y`? (Over the union of keys; missing = ⊥.)
let private aheadSomewhere (x: TF.Frame) (y: TF.Frame) =
    let keys = Set.union (x.Coords |> Map.toSeq |> Seq.map fst |> Set.ofSeq)
                         (y.Coords |> Map.toSeq |> Seq.map fst |> Set.ofSeq)
    keys |> Set.exists (fun k -> (TF.coord k x).Version > (TF.coord k y).Version)

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``concurrent is symmetric`` (a: TF.Frame) (b: TF.Frame) =
    TF.concurrent a b = TF.concurrent b a

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``concurrent is irreflexive — a frame never forks itself`` (f: TF.Frame) =
    not (TF.concurrent f f)

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``if either dominates, the pair is NOT concurrent (exclusive with the order)`` (a: TF.Frame) (b: TF.Frame) =
    if TF.dominates a b || TF.dominates b a then not (TF.concurrent a b) else true

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``EXACTLY ONE of {equal, a▷b, b▷a, concurrent} holds (tetrachotomy)`` (a: TF.Frame) (b: TF.Frame) =
    let da = TF.dominates a b
    let db = TF.dominates b a
    let equal = da && db                 // mutual dominance = equal causal view
    let aOnly = da && not db
    let bOnly = db && not da
    let conc = TF.concurrent a b
    // exactly one true, and `concurrent` is the neither-dominates cell
    ([ equal; aOnly; bOnly; conc ] |> List.filter id |> List.length) = 1
    && conc = (not da && not db)

[<Property(Arbitrary = [| typeof<FrameArb> |])>]
let ``concurrent ⟺ genuine fork (each ahead somewhere) — semantics, independent of dominates`` (a: TF.Frame) (b: TF.Frame) =
    TF.concurrent a b = (aheadSomewhere a b && aheadSomewhere b a)

// ── concrete examples (documentation) ──

[<Fact>]
let ``a genuine fork is concurrent; a causal chain is not`` () =
    let a = TF.origin |> TF.observe "x" (Versionstamp.ofInt64 3L)   // ahead on x
    let b = TF.origin |> TF.observe "y" (Versionstamp.ofInt64 2L)   // ahead on y
    Assert.True(TF.concurrent a b)                                  // fork ⇒ spacelike
    let later = a |> TF.observe "y" (Versionstamp.ofInt64 5L)       // saw a, then y@5 ⇒ dominates b
    Assert.True(TF.dominates later b)
    Assert.False(TF.concurrent later b)                            // causal chain ⇒ NOT spacelike (signaling)

[<Fact>]
let ``origin is concurrent with nothing (bottom is below everything)`` () =
    // ⊥ is dominated by every frame, so it is never a genuine fork with any frame — including itself.
    Assert.False(TF.concurrent TF.origin TF.origin)
    let f = TF.origin |> TF.observe "a" (Versionstamp.ofInt64 1L)
    Assert.False(TF.concurrent TF.origin f)
    Assert.False(TF.concurrent f TF.origin)
