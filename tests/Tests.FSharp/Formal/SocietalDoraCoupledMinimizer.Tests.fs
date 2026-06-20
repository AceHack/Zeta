module Zeta.Tests.Formal.SocietalDoraCoupledMinimizerTests

open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════════
// Societal DORA — the COUPLED-EMPOWERMENT MINIMIZER cross-check (row 6 of
// docs/handoffs/2026-06-19-otto-to-math-team-…). The empirical evidence leg
// for: "mutual-empowerment = the coupled-empowerment minimizer, and the
// manipulation/capture pattern is exposed by it." The formal Lean
// optimization proof stays the math team's; this triangulates it on the
// ACTUAL code (`SocietalDora.coupledGain c = min(c.Self, c.Other)`).
//
// Distinct from Formal/SocietalDora.Tests.fs: that file proves the bound
// (g <= self, g <= other) and the one-sided Goodhart guard (other <= 0 ⇒
// not empowering). Here we prove the COMPLEMENTARY directions left open:
//   1. the FORCING direction — a high coupled gain forces BOTH high (you
//      cannot fake it by maxing one side);
//   2. the full capture/empowerment dichotomy on the min;
//   3. Goodhart-resistance as a MONOTONICITY fact — gaming one metric past
//      the binding point cannot lift the coupled score.
//
// NormalFloat ⇒ finite, non-NaN deltas (NaN broke an earlier SocietalDora
// property; empowerment values are finite reals).
// ═══════════════════════════════════════════════════════════════════════

let private eps = 1e-9
let private c s o : SocietalDora.Coupled = { Self = s; Other = o }

let private mkEdge name rho (ints: (float * float) list) : SocietalDora.EdgeHealth =
    { Edge = name
      RhoOwe = rho
      Interactions = ints |> List.map (fun (s, o) -> c s o) }

// ── Property 1: min is the BINDING gain — high coupled gain FORCES both high ──

[<Property>]
let ``the minimizer is binding: a coupled gain >= t forces BOTH sides >= t`` (s: NormalFloat) (o: NormalFloat) (t: NormalFloat) =
    // The forcing direction (the converse of the bound proved in SocietalDora.Tests):
    // you cannot fake a high coupled gain by maxing one side — if min >= t, both >= t.
    let s, o, t = s.Get, o.Get, t.Get
    let g = SocietalDora.coupledGain (c s o)
    (g >= t) ==> lazy (s >= t && o >= t)

[<Property>]
let ``maxing one side alone cannot lift coupled gain above the other side`` (self: NormalFloat) (other: NormalFloat) =
    // Drive Self arbitrarily high; the coupled gain is still capped at Other.
    // This is "you cannot fake mutual empowerment by being generous to yourself."
    let self, other = self.Get, other.Get
    let huge = abs self + abs other + 1e6
    SocietalDora.coupledGain (c huge other) <= other + eps

// ── Property 2: manipulation/capture is EXPOSED by the minimizer ──────────────

[<Property>]
let ``capture pattern (Self > 0, Other <= 0) collapses coupled gain to <= 0`` (self: NormalFloat) (other: NormalFloat) =
    // The manipulation/capture pattern: I gain, you do not. min collapses to the
    // non-gaining side ⇒ coupled gain <= 0 ⇒ not mutually empowering, however large
    // my own gain is.
    let self = abs self.Get + 1.0 // Self > 0
    let other = - abs other.Get // Other <= 0
    let g = SocietalDora.coupledGain (c self other)
    g <= 0.0 && not (SocietalDora.isEmpowering (c self other))

[<Property>]
let ``mutual empowerment (both > 0) yields strictly positive coupled gain`` (self: NormalFloat) (other: NormalFloat) =
    // The dual of capture: when BOTH strictly gain, the min is strictly positive ⇒
    // mutually empowering. Together with the capture property this is the full
    // dichotomy: isEmpowering ⇔ both sides strictly positive.
    let self = abs self.Get + 1.0 // Self > 0
    let other = abs other.Get + 1.0 // Other > 0
    let g = SocietalDora.coupledGain (c self other)
    g > 0.0 && SocietalDora.isEmpowering (c self other)

[<Property>]
let ``isEmpowering exactly characterizes both-sides-strictly-positive`` (s: NormalFloat) (o: NormalFloat) =
    // The capture-exposure stated as an iff on arbitrary finite deltas.
    let s, o = s.Get, o.Get
    SocietalDora.isEmpowering (c s o) = (s > 0.0 && o > 0.0)

// ── Property 3: Goodhart-resistance as MONOTONICITY (gaming one metric fails) ──

[<Property>]
let ``Goodhart: once Self >= Other, raising Self alone does not raise coupled gain`` (other: NormalFloat) (d1: NormalFloat) (d2: NormalFloat) =
    // Hold Other fixed. Pick two Self values BOTH at or above Other (the binding
    // point). The coupled gain is pinned to Other for both ⇒ gaming Self can't lift
    // the coupled score. This is the discrete optimization fact behind "coupled
    // empowerment is Goodhart-resistant": Self is not the active variable once it
    // is no longer the minimizer.
    let other = other.Get
    let self1 = other + abs d1.Get // >= Other
    let self2 = other + abs d2.Get // >= Other
    let g1 = SocietalDora.coupledGain (c self1 other)
    let g2 = SocietalDora.coupledGain (c self2 other)
    abs (g1 - g2) < eps && abs (g1 - other) < eps

[<Property>]
let ``coupled gain is monotone non-decreasing in Self and never exceeds Other`` (self1: NormalFloat) (self2: NormalFloat) (other: NormalFloat) =
    // Monotone but SATURATING: raising Self never lowers the coupled gain, yet the
    // gain can never be pushed past Other by Self. So Self is a one-way ratchet that
    // tops out at the other party's gain — the formal shape of "can't game it."
    let other = other.Get
    let lo = min self1.Get self2.Get
    let hi = max self1.Get self2.Get
    let gLo = SocietalDora.coupledGain (c lo other)
    let gHi = SocietalDora.coupledGain (c hi other)
    gHi >= gLo - eps && gHi <= other + eps

// ── Optional metrics tie: capture-heavy inputs → low gain + high capture ──────

[<Property>]
let ``capture-heavy input drives MeanCoupledGain <= 0 and CaptureRate = 1`` (rows: (NormalFloat * NormalFloat) list) =
    // Build an all-capture interaction list from arbitrary finite magnitudes:
    // every interaction is (Self > 0, Other <= 0). compute over it must report
    // full capture and a non-positive mean coupled gain — the metric layer surfaces
    // the same exposure the per-interaction min does.
    not (List.isEmpty rows)
    ==> lazy
        (let captureRows =
            rows |> List.map (fun (s, o) -> (abs s.Get + 1.0, - abs o.Get))
         let edge = mkEdge "capture" 1.0 captureRows
         let m = SocietalDora.compute 0.5 [ edge ]
         abs (m.CaptureRate - 1.0) < eps
         && abs (m.EmpowermentFrequency - 0.0) < eps
         && m.MeanCoupledGain <= eps)

[<Property>]
let ``all-mutual input drives MeanCoupledGain > 0 and EmpowermentFrequency = 1`` (rows: (NormalFloat * NormalFloat) list) =
    // The dual at the metric layer: an all-mutual list reports full empowerment and
    // a strictly positive mean coupled gain.
    not (List.isEmpty rows)
    ==> lazy
        (let mutualRows =
            rows |> List.map (fun (s, o) -> (abs s.Get + 1.0, abs o.Get + 1.0))
         let edge = mkEdge "mutual" 1.0 mutualRows
         let m = SocietalDora.compute 0.5 [ edge ]
         abs (m.EmpowermentFrequency - 1.0) < eps
         && abs (m.CaptureRate - 0.0) < eps
         && m.MeanCoupledGain > 0.0)

// ── Fact: the headline triangulation, concrete and legible ───────────────────

[<Fact>]
let ``a capture-heavy graph scores low MeanCoupledGain and high CaptureRate; the mutual one inverts it`` () =
    // The manipulation pattern (one side extracts) vs mutual empowerment, side by
    // side — the empirical cross-check of the minimizer claim in one picture.
    let capture =
        mkEdge "capture" 1.0 [ (10.0, -1.0); (8.0, -3.0); (5.0, 0.0) ] // Self gains, Other does not
    let mutual =
        mkEdge "mutual" 1.0 [ (1.0, 2.0); (3.0, 1.0); (0.5, 0.5) ] // both gain

    let mc = SocietalDora.compute 0.5 [ capture ]
    mc.CaptureRate |> should (equalWithin eps) 1.0
    mc.EmpowermentFrequency |> should (equalWithin eps) 0.0
    mc.MeanCoupledGain |> should be (lessThanOrEqualTo 0.0)

    let mm = SocietalDora.compute 0.5 [ mutual ]
    mm.EmpowermentFrequency |> should (equalWithin eps) 1.0
    mm.CaptureRate |> should (equalWithin eps) 0.0
    mm.MeanCoupledGain |> should be (greaterThan 0.0)
