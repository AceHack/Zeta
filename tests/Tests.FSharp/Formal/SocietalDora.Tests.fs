module Zeta.Tests.Formal.SocietalDoraTests

open FsCheck
open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core

// ═══════════════════════════════════════════════════════════════════
// Societal DORA (`src/Core/SocietalDora.fs`) — DORA-for-society health
// metrics over the ρ_owe estimator. Goodhart-resistant by construction
// (coupled gain = min, so a self-only gain scores as capture).
// Scoping: docs/research/2026-06-19-bayesian-emotional-propagation-…;
//          memory/feedback_societal_dora_…
// ═══════════════════════════════════════════════════════════════════

let private eps = 1e-9
let private c s o : SocietalDora.Coupled = { Self = s; Other = o }

let private mkEdge name rho (ints: (float * float) list) : SocietalDora.EdgeHealth =
    { Edge = name
      RhoOwe = rho
      Interactions = ints |> List.map (fun (s, o) -> c s o) }

// ── Properties ────────────────────────────────────────────────────────

[<Property>]
let ``coupled gain is min(self, other) — symmetric and a lower bound`` (s: NormalFloat) (o: NormalFloat) =
    // NormalFloat ⇒ finite, non-NaN deltas (empowerment values are finite reals).
    let s, o = s.Get, o.Get
    let g = SocietalDora.coupledGain (c s o)
    g = SocietalDora.coupledGain (c o s) && g <= s && g <= o

[<Property>]
let ``Goodhart guard: if the other party does not gain, it is never mutually empowering`` (self: float) (other: float) =
    // Even an arbitrarily large self-gain cannot make it empowering if the other ≤ 0.
    let other' = - abs other // force other ≤ 0
    not (SocietalDora.isEmpowering (c (abs self + 1.0) other'))

[<Property>]
let ``rates are in [0,1] and frequency + capture = 1 (when non-empty)`` (rows: (float * float) list) =
    let edge = mkEdge "e" 1.0 rows
    let m = SocietalDora.compute 0.5 [ edge ]
    let inRange x = x >= -eps && x <= 1.0 + eps
    inRange m.EmpowermentFrequency
    && inRange m.CaptureRate
    && inRange m.MirrorRate
    && m.MeanRecoveryLength >= -eps
    && (List.isEmpty rows || abs (m.EmpowermentFrequency + m.CaptureRate - 1.0) < 1e-9)

[<Property>]
let ``mirror rate counts edges below the rho_owe threshold`` (rho: float) =
    let r = abs rho % 1.0 // into [0,1)
    let edge = mkEdge "e" r [ (1.0, 1.0) ]
    let m = SocietalDora.compute 0.5 [ edge ]
    // exactly one edge: mirror iff rho < 0.5
    (m.MirrorRate = 1.0) = (r < 0.5)

// ── Facts: extremes, recovery, and the ρ_owe integration ──────────────

[<Fact>]
let ``all-empowering graph: frequency 1, capture 0, no recovery needed, positive gain`` () =
    let edge = mkEdge "e" 1.0 [ (2.0, 1.0); (1.0, 3.0); (0.5, 0.5) ]
    let m = SocietalDora.compute 0.5 [ edge ]
    m.EmpowermentFrequency |> should (equalWithin eps) 1.0
    m.CaptureRate |> should (equalWithin eps) 0.0
    m.MeanRecoveryLength |> should (equalWithin eps) 0.0
    m.MeanCoupledGain |> should be (greaterThan 0.0)

[<Fact>]
let ``all-capture graph: frequency 0, capture 1`` () =
    let edge = mkEdge "e" 1.0 [ (5.0, -1.0); (-2.0, 3.0) ] // each has one party not gaining
    let m = SocietalDora.compute 0.5 [ edge ]
    m.EmpowermentFrequency |> should (equalWithin eps) 0.0
    m.CaptureRate |> should (equalWithin eps) 1.0

[<Fact>]
let ``recovery length = mean capture-streak length, in temporal order`` () =
    // sequence: emp, cap, cap, emp, cap  → streaks of length [2; 1] → mean 1.5
    let edge =
        mkEdge "e" 1.0 [ (1.0, 1.0); (-1.0, 1.0); (1.0, -1.0); (1.0, 1.0); (-1.0, 1.0) ]
    let m = SocietalDora.compute 0.5 [ edge ]
    m.MeanRecoveryLength |> should (equalWithin eps) 1.5

[<Fact>]
let ``edgeHealth integrates rho_owe: a mirror edge (A = U) is flagged; an independent edge is not`` () =
    // Mirror: agent's action = the other's state ⇒ ρ_owe = 0 < τ ⇒ MirrorRate counts it.
    let mirrorSamples = [ for u in 0..3 -> (u, u, 0) ] // (a = u)
    let mirror = SocietalDora.edgeHealth "mirror" mirrorSamples [ c 1.0 1.0 ]
    mirror.RhoOwe |> should (equalWithin eps) 0.0

    // Independent: uniform A×U grid ⇒ ρ_owe = 1 ≥ τ ⇒ not a mirror.
    let indepSamples =
        [ for a in 0..2 do
              for u in 0..2 -> (a, u, 0) ]
    let indep = SocietalDora.edgeHealth "indep" indepSamples [ c 1.0 1.0 ]
    indep.RhoOwe |> should (equalWithin 1e-9) 1.0

    let m = SocietalDora.compute 0.5 [ mirror; indep ]
    m.MirrorRate |> should (equalWithin eps) 0.5 // one of two edges is a mirror

[<Fact>]
let ``propagation chain: Aaron->girl->audience, all mutually empowering and non-mirror, is fully healthy`` () =
    // The consent-discharging case: empowerment propagates down the chain, every edge a genuine other.
    let indep =
        [ for a in 0..2 do
              for u in 0..2 -> (a, u, 0) ]
    let edges =
        [ SocietalDora.edgeHealth "aaron->girl" indep [ c 1.0 1.0; c 1.0 2.0 ]
          SocietalDora.edgeHealth "girl->audience" indep [ c 1.0 1.0; c 2.0 1.0 ] ]
    let m = SocietalDora.compute 0.5 edges
    m.EmpowermentFrequency |> should (equalWithin eps) 1.0
    m.MirrorRate |> should (equalWithin eps) 0.0
    m.CaptureRate |> should (equalWithin eps) 0.0

[<Fact>]
let ``empty graph is all-zero (no false health)`` () =
    let m = SocietalDora.compute 0.5 []
    m.EmpowermentFrequency |> should (equalWithin eps) 0.0
    m.CaptureRate |> should (equalWithin eps) 0.0
    m.MirrorRate |> should (equalWithin eps) 0.0
    m.MeanRecoveryLength |> should (equalWithin eps) 0.0
    m.MeanCoupledGain |> should (equalWithin eps) 0.0
