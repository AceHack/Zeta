module Zeta.Tests.ComputeReceiptTests

// ═══════════════════════════════════════════════════════════════════
// ComputeReceipt tests — thermodynamic accounting for compute allocation.
//
// Design: Eve's small-rooms law (2026-07-04):
//   "Rooms should be small so you can know easily what went wrong and was uncertain."
// Each test is ONE property. One failure = one clear cause.
//
// Properties proven:
//   CR-1  DeltaU = IV − DeltaJ (the accounting identity)
//   CR-2  Heat = DeltaJ when IV ≈ 0 (wasted compute is tracked)
//   CR-3  Heat = 0 when IV > 0 (no waste when information is purchased)
//   CR-4  LandauerRatio = DeltaJ / IV (efficiency vs. limit)
//   CR-5  Entropy = H(posterior) (remaining uncertainty is correct)
//   CR-6  compute returns None for empty prior (degenerate guard)
//   CR-7  compute returns None for empty posterior (degenerate guard)
//   CR-6b/7b non-degenerate pair returns Some (negative control for CR-6/CR-7)
//   CR-8  summarize returns None for empty list (degenerate guard)
//   CR-9  summarize TotalIV = sum of individual IVs (aggregation correct)
//   CR-10 summarize TotalHeat = sum of individual heats (aggregation correct)
//   CR-11 zero-budget receipt: DeltaJ = 0, DeltaU = IV, Heat = 0 (zero cost)
//   CR-12 FsCheck: DeltaU = IV − DeltaJ for arbitrary valid inputs
// ═══════════════════════════════════════════════════════════════════

open global.Xunit
open Zeta.Core
open FsCheck
open FsCheck.Xunit

module CR = Zeta.Core.ComputeReceipt

// ── Helpers ──────────────────────────────────────────────────────────────────

/// Build a SoftValue with a single candidate at weight 1.0 (point mass = zero entropy).
let private pointMass (v: int64) : SoftValue.SoftValue =
    SoftValue.ofWeighted [ DynamicValue.Int v, 1.0 ] |> Option.get

/// Build a uniform SoftValue over two candidates (maximum entropy for 2 candidates).
let private uniform2 (a: int64) (b: int64) : SoftValue.SoftValue =
    SoftValue.ofWeighted [ DynamicValue.Int a, 0.5; DynamicValue.Int b, 0.5 ] |> Option.get

[<Literal>]
let private EPS = 1e-9

// ── CR-1: DeltaU = IV − DeltaJ ───────────────────────────────────────────────
[<Fact>]
let ``CR-1 DeltaU equals IV minus DeltaJ`` () =
    let prior = uniform2 0L 1L
    let posterior = pointMass 0L
    let r = (CR.compute prior posterior 10 100L).Value
    Assert.Equal(r.IV - r.DeltaJ, r.DeltaU, 6)

// ── CR-2: Heat = DeltaJ when IV ≈ 0 (no information purchased) ───────────────
[<Fact>]
let ``CR-2 Heat equals DeltaJ when posterior equals prior (no information purchased)`` () =
    // Prior = posterior = same uniform distribution → IV = KL(p‖p) = 0 → all compute is heat
    let sv = uniform2 0L 1L
    let r = (CR.compute sv sv 10 100L).Value
    Assert.True(r.IV < EPS, sprintf "Expected IV ≈ 0 but got %f" r.IV)
    Assert.Equal(r.DeltaJ, r.Heat, 6)

// ── CR-3: Heat = 0 when IV > 0 (information was purchased) ───────────────────
[<Fact>]
let ``CR-3 Heat is zero when posterior is sharper than prior (information purchased)`` () =
    let prior = uniform2 0L 1L
    let posterior = pointMass 0L  // sharp posterior → IV > 0
    let r = (CR.compute prior posterior 10 100L).Value
    Assert.True(r.IV > EPS, sprintf "Expected IV > 0 but got %f" r.IV)
    Assert.Equal(0.0, r.Heat, 6)

// ── CR-4: LandauerRatio = DeltaJ / IV ────────────────────────────────────────
[<Fact>]
let ``CR-4 LandauerRatio equals DeltaJ divided by IV`` () =
    let prior = uniform2 0L 1L
    let posterior = pointMass 0L
    let r = (CR.compute prior posterior 10 100L).Value
    let expected : float = r.DeltaJ / r.IV
    Assert.Equal(expected, r.LandauerRatio, 6)

// ── CR-5: Entropy = H(posterior) ─────────────────────────────────────────────
[<Fact>]
let ``CR-5 Entropy equals Shannon entropy of posterior`` () =
    let prior = uniform2 0L 1L
    let posterior = pointMass 0L
    let r = (CR.compute prior posterior 10 100L).Value
    let expected : float = SoftValue.entropy posterior
    Assert.Equal(expected, r.Entropy, 6)

// ── CR-6: None for empty prior ────────────────────────────────────────────────
//
// REWRITTEN 2026-08-18 (Soraya). CR-6 and CR-7 used to route through
// `SoftValue.ofWeighted []` and pattern-match on the result. `ofWeighted` returns
// `None` for the empty list UNCONDITIONALLY, so the `Some` arm was dead code and
// the only reachable statement in either test was `Assert.True(true)`. Both tests
// were named for the degenerate guard at `ComputeReceipt.compute` and neither one
// executed it: deleting the guard left both of them green. That is the vacuity
// class — a check that did not run, reported as one that passed.
//
// `SoftValue` is a public record, so the empty value the smart constructor refuses
// to build can still be constructed directly, which is exactly the state the guard
// is defending against. These two now reach line 81 of ComputeReceipt.fs and fail
// if it is removed.
[<Fact>]
let ``CR-6 compute returns None for empty prior`` () =
    let valid = uniform2 0L 1L
    // `ofWeighted` refuses to build this; `unnormalized` is the named route that does not.
    // The guard exists for values that arrive by any route, so the test uses the route that
    // actually produces one.
    let empty : SoftValue.SoftValue = SoftValue.unnormalized []
    Assert.True((SoftValue.ofWeighted []).IsNone, "precondition: ofWeighted still refuses the empty list")
    Assert.Equal(None, CR.compute empty valid 10 100L)

// ── CR-7: None for empty posterior ───────────────────────────────────────────
[<Fact>]
let ``CR-7 compute returns None for empty posterior`` () =
    let valid = uniform2 0L 1L
    let empty : SoftValue.SoftValue = SoftValue.unnormalized []
    Assert.Equal(None, CR.compute valid empty 10 100L)

// ── CR-6b/CR-7b: the guard is not vacuous — a NON-empty pair does produce a receipt.
// Without this negative control, CR-6/CR-7 would still pass if `compute` returned
// `None` for every input, which would satisfy both while proving nothing.
[<Fact>]
let ``CR-6b/CR-7b compute returns Some for a non-degenerate pair (negative control)`` () =
    let prior = uniform2 0L 1L
    let posterior = pointMass 0L
    Assert.True((CR.compute prior posterior 10 100L).IsSome)

// ── CR-8: summarize returns None for empty list ───────────────────────────────
[<Fact>]
let ``CR-8 summarize returns None for empty list`` () =
    Assert.Equal(None, CR.summarize [])

// ── CR-9: summarize TotalIV = sum of individual IVs ──────────────────────────
[<Fact>]
let ``CR-9 summarize TotalIV equals sum of individual IVs`` () =
    let prior = uniform2 0L 1L
    let posterior = pointMass 0L
    let r1 = (CR.compute prior posterior 5 100L).Value
    let r2 = (CR.compute prior posterior 10 200L).Value
    let summary = (CR.summarize [ r1; r2 ]).Value
    Assert.Equal(r1.IV + r2.IV, summary.TotalIV, 6)

// ── CR-10: summarize TotalHeat = sum of individual heats ─────────────────────
[<Fact>]
let ``CR-10 summarize TotalHeat equals sum of individual heats`` () =
    let sv = uniform2 0L 1L
    let r1 = (CR.compute sv sv 5 100L).Value   // heat: prior = posterior
    let r2 = (CR.compute sv sv 10 200L).Value  // heat: prior = posterior
    let summary = (CR.summarize [ r1; r2 ]).Value
    Assert.Equal(r1.Heat + r2.Heat, summary.TotalHeat, 6)

// ── CR-11: zero-budget receipt ────────────────────────────────────────────────
[<Fact>]
let ``CR-11 zero-budget receipt has DeltaJ=0 DeltaU=IV Heat=0`` () =
    let prior = uniform2 0L 1L
    let posterior = pointMass 0L
    let r = (CR.compute prior posterior 0 0L).Value
    Assert.Equal(0.0, r.DeltaJ, 6)
    Assert.Equal(r.IV, r.DeltaU, 6)
    Assert.Equal(0.0, r.Heat, 6)

// ── CR-12: FsCheck — DeltaU = IV − DeltaJ for arbitrary valid inputs ─────────
[<Property>]
let ``CR-12 DeltaU always equals IV minus DeltaJ`` (ticks: NonNegativeInt) (bpt: NonNegativeInt) =
    let prior = uniform2 0L 1L
    let posterior = pointMass 0L
    let receipt = CR.compute prior posterior ticks.Get (int64 bpt.Get)
    match receipt with
    | None -> true  // degenerate case is handled
    | Some r -> abs (r.DeltaU - (r.IV - r.DeltaJ)) < EPS
