module Zeta.Tests.UncertainClockTests

open global.Xunit
open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open Zeta.Core

module UC = Zeta.Core.UncertainClock

// ═══════════════════════════════════════════════════════════════════
// UncertainClock — the clock-with-uncertainty leg of the traveler frame (Layer 0 sub-leg).
// (docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md §B-frame.)
//
// CockroachDB-style HLC + uncertainty window ε: true time ∈ [Physical, Physical+ε]. Order becomes
// PARTIAL — disjoint windows ⇒ definite order; overlapping windows ⇒ genuinely uncertain (the frame
// must not invent an order; a SoftValue carries both). Proven here: definitelyBefore is a strict
// partial order; trichotomy with the uncertain zone; uncertain is reflexive+symmetric; definite order
// REFINES the HLC total order (never contradicts the clock); ε=0 collapses to exact order; the HLC
// receive/send rules are monotone (bounded divergence — the causal-merge half of TravelerFrame).
// ═══════════════════════════════════════════════════════════════════

// Narrow ranges on purpose: windows must overlap AND separate often, so the `==>` preconditions
// (definitelyBefore / uncertain) are well-sampled rather than almost-always-discarded.
let private genHlc : Gen<UC.Hlc> =
    gen {
        let! p = Gen.choose (0, 30) |> Gen.map int64
        let! l = Gen.choose (0, 5) |> Gen.map int64
        return { UC.Physical = p; UC.Logical = l }
    }

let private genU : Gen<UC.Uncertain> =
    gen {
        let! c = genHlc
        let! e = Gen.choose (0, 15) |> Gen.map int64
        return UC.make c e
    }

type ClockArb() =
    static member H() = Arb.fromGen genHlc
    static member U() = Arb.fromGen genU

// ── definitelyBefore is a strict partial order ──

[<Property(Arbitrary = [| typeof<ClockArb> |])>]
let ``definitelyBefore is irreflexive`` (a: UC.Uncertain) =
    not (UC.definitelyBefore a a)

[<Property(Arbitrary = [| typeof<ClockArb> |])>]
let ``definitelyBefore is asymmetric`` (a: UC.Uncertain) (b: UC.Uncertain) =
    not (UC.definitelyBefore a b && UC.definitelyBefore b a)

[<Property(Arbitrary = [| typeof<ClockArb> |])>]
let ``definitelyBefore is transitive (constructed chain — exhaustion-proof)``
    (a: UC.Uncertain) (eb: NonNegativeInt) (ec: NonNegativeInt) (g1: NonNegativeInt) (g2: NonNegativeInt) =
    // Build b strictly after a's window and c strictly after b's window, so the antecedents hold by
    // construction (no `==>` discard); then a < c is the transitive conclusion we're checking.
    let b = UC.make { UC.Physical = UC.hi a + 1L + int64 g1.Get; UC.Logical = 0L } (int64 eb.Get)
    let c = UC.make { UC.Physical = UC.hi b + 1L + int64 g2.Get; UC.Logical = 0L } (int64 ec.Get)
    UC.definitelyBefore a b && UC.definitelyBefore b c && UC.definitelyBefore a c

// ── trichotomy with the uncertain zone ──

[<Property(Arbitrary = [| typeof<ClockArb> |])>]
let ``exactly one of before/after/uncertain holds (trichotomy)`` (a: UC.Uncertain) (b: UC.Uncertain) =
    let ab = UC.definitelyBefore a b
    let ba = UC.definitelyBefore b a
    let un = UC.uncertain a b
    // exactly one true
    (if ab then 1 else 0) + (if ba then 1 else 0) + (if un then 1 else 0) = 1

[<Property(Arbitrary = [| typeof<ClockArb> |])>]
let ``uncertain is reflexive`` (a: UC.Uncertain) =
    UC.uncertain a a

[<Property(Arbitrary = [| typeof<ClockArb> |])>]
let ``uncertain is symmetric`` (a: UC.Uncertain) (b: UC.Uncertain) =
    UC.uncertain a b = UC.uncertain b a

// ── soundness: definite order never contradicts the clock; never falsely certain ──

[<Property(Arbitrary = [| typeof<ClockArb> |])>]
let ``definite order refines the HLC total order`` (a: UC.Uncertain) (b: UC.Uncertain) =
    // if we are CERTAIN a precedes b, the underlying HLC agrees (a.Clock < b.Clock)
    UC.definitelyBefore a b ==> (UC.compareHlc a.Clock b.Clock < 0)

[<Property(Arbitrary = [| typeof<ClockArb> |])>]
let ``the uncertain zone is never falsely certain (SoftValue calibration)`` (a: UC.Uncertain) (b: UC.Uncertain) =
    // in the uncertain zone we assert NEITHER order — the temporal analogue of SoftValue's
    // "resolve only above threshold; never claim certainty you don't have".
    UC.uncertain a b ==> (not (UC.definitelyBefore a b) && not (UC.definitelyBefore b a))

// ── ε = 0 collapses to the exact (certain) clock TravelerFrame already uses ──

[<Property(Arbitrary = [| typeof<ClockArb> |])>]
let ``with zero uncertainty, definite order is exact physical order`` (a: UC.Hlc) (b: UC.Hlc) =
    let ua = UC.make a 0L
    let ub = UC.make b 0L
    UC.definitelyBefore ua ub = (a.Physical < b.Physical)

[<Fact>]
let ``zero-uncertainty overlap is exactly equal physical time`` () =
    let mk p = UC.make { UC.Physical = p; UC.Logical = 0L } 0L
    Assert.True(UC.uncertain (mk 5L) (mk 5L))   // equal physical ⇒ overlap (can't order)
    Assert.False(UC.uncertain (mk 5L) (mk 6L))  // distinct ⇒ definite order

[<Fact>]
let ``overlapping windows are uncertain even at different readings`` () =
    let a = UC.make { UC.Physical = 10L; UC.Logical = 0L } 5L  // window [10,15]
    let b = UC.make { UC.Physical = 12L; UC.Logical = 0L } 5L  // window [12,17] — overlaps
    let c = UC.make { UC.Physical = 100L; UC.Logical = 0L } 5L // window [100,105] — disjoint
    Assert.True(UC.uncertain a b)
    Assert.True(UC.definitelyBefore a c)
    Assert.False(UC.uncertain a c)

// ── HLC receive/send monotonicity (bounded divergence; the causal-merge half) ──

[<Property(Arbitrary = [| typeof<ClockArb> |])>]
let ``send is strictly monotone`` (c: UC.Hlc) (now: int64) =
    UC.compareHlc (UC.send c now) c > 0

[<Property(Arbitrary = [| typeof<ClockArb> |])>]
let ``receive dominates both the local and the message clock`` (c: UC.Hlc) (msg: UC.Hlc) (now: int64) =
    let r = UC.receive c msg now
    UC.compareHlc r c >= 0 && UC.compareHlc r msg >= 0

[<Property(Arbitrary = [| typeof<ClockArb> |])>]
let ``receive never moves physical time backwards`` (c: UC.Hlc) (msg: UC.Hlc) (now: int64) =
    let r = UC.receive c msg now
    r.Physical >= c.Physical && r.Physical >= msg.Physical && r.Physical >= now
