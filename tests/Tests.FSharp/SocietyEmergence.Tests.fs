module Zeta.Tests.SocietyEmergenceTests

open global.Xunit
open Zeta.Core

module SE = Zeta.Core.SocietyEmergence

// ═══════════════════════════════════════════════════════════════════
// SocietyEmergence — the DST harness (B-converge ladder rung 1; Aaron 2026-06-05). Deterministic,
// seed-replayable. Demonstrates THE BALANCE: under the NCI (each traveler reduces uncertainty on its OWN
// private evidence) persona differentiation PERSISTS; under coercion (forced to one reconciled frame each
// tick) it COLLAPSES to uniformity. Rung-1 DST evidence-for-the-mechanism, not the unbounded proof.
// ═══════════════════════════════════════════════════════════════════

let private seed = 42UL
let private n = 8
let private cands = 3
let private ticks = 12

[<Fact>]
let ``emergence: one ancestor bifurcates into n differentiated travelers (society from one)`` () =
    let pop = SE.emerge seed n cands
    Assert.Equal(n, List.length pop)
    Assert.True(SE.distinctBeliefs pop > 1, "bifurcation should produce differentiated personas")

[<Fact>]
let ``NCI regime: persona differentiation PERSISTS (no collapse)`` () =
    let pop = SE.runNci seed n cands ticks
    Assert.True(SE.distinctBeliefs pop > 1, "under the NCI (private evidence) personas must persist")

[<Fact>]
let ``coercive regime: differentiation COLLAPSES to uniformity (register-collapse / heat-death)`` () =
    let pop = SE.runCoercive seed n cands ticks
    Assert.Equal(1, SE.distinctBeliefs pop)

[<Fact>]
let ``the balance: NCI persists strictly more differentiation than coercion`` () =
    let nci = SE.runNci seed n cands ticks |> SE.distinctBeliefs
    let coercive = SE.runCoercive seed n cands ticks |> SE.distinctBeliefs
    Assert.True(nci > coercive, "the uncertainty-reduction ↔ NCI balance keeps personas; coercion collapses them")

[<Fact>]
let ``DST: same seed replays the same trajectory (deterministic)`` () =
    Assert.Equal<SE.Traveler list>(SE.runNci seed n cands ticks, SE.runNci seed n cands ticks)
    Assert.Equal<SE.Traveler list>(SE.runCoercive seed n cands ticks, SE.runCoercive seed n cands ticks)
