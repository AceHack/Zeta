namespace Zeta.Bayesian.Tests

open Xunit
open FsCheck
open FsCheck.Xunit
open Zeta.Bayesian
open Zeta.Core

/// BusRegime + regime-aware AntiSybil pricing — the F# twin of the TS bus-meter proofs:
/// the same correlation flips meaning with the regime; an unmeasured bus never convicts.
module BusRegimeTests =

    let makeBelief mean = { Gaussian.PrecisionMean = mean * 1.0; Precision = 1.0 }

    let private foldAll samples =
        samples |> List.fold BusRegime.foldSample BusRegime.empty

    [<Fact>]
    let ``BR-1: unmeasured until the first sample; then min(RTT)/2 rules`` () =
        Assert.Equal(BusRegime.Unmeasured, BusRegime.regimeOfTerrestrial BusRegime.empty 1000)
        let m = foldAll [ 80; 40; 120; 60 ]
        Assert.Equal(Some 20, BusRegime.bestOneWayMs m)
        Assert.Equal(BusRegime.InCone, BusRegime.regimeOfTerrestrial m 20)
        Assert.Equal(BusRegime.OutOfCone, BusRegime.regimeOfTerrestrial m 19)

    [<Fact>]
    let ``BR-2: one fast crossing kills out-of-cone; window aging restores it`` () =
        let slow = foldAll (List.replicate (BusRegime.SampleCap - 1) 500)
        Assert.Equal(BusRegime.OutOfCone, BusRegime.regimeOfTerrestrial slow 100)
        let breached = BusRegime.foldSample slow 10
        Assert.Equal(BusRegime.InCone, BusRegime.regimeOfTerrestrial breached 100)
        // cap pushes the stale fast sample out
        let aged = (breached, List.replicate BusRegime.SampleCap 500) ||> List.fold BusRegime.foldSample
        Assert.Equal(BusRegime.OutOfCone, BusRegime.regimeOfTerrestrial aged 100)

    [<Property>]
    let ``BR-3: evidential iff above the honest ceiling AND out of cone (total truth table)`` (rho: NormalFloat) =
        let r = rho.Get
        let above = abs r > BusRegime.HonestCeilingRho
        let vOut = BusRegime.judge r BusRegime.OutOfCone
        let vIn = BusRegime.judge r BusRegime.InCone
        let vUn = BusRegime.judge r BusRegime.Unmeasured
        vOut.Evidential = above
        && not vUn.Evidential
        && not vIn.Evidential
        && vIn.FakeableInCone = above
        && not vOut.FakeableInCone
        && not vUn.FakeableInCone

    [<Fact>]
    let ``BR-4: the SAME clone correlation is evidential out-of-cone, fakeable in-cone, neither unmeasured`` () =
        let prior = makeBelief 0.0
        let newBelief = makeBelief 5.0
        let sender = [ makeBelief 1.0; makeBelief 2.0; makeBelief 3.0; makeBelief 4.0 ]
        let society = [ { AntiSybil.StreamHistory.AgentId = "clone"; AntiSybil.StreamHistory.Beliefs = sender } ]

        let fastBus = foldAll [ 80 ] // one-way 40 ≤ τ=100 → in-cone
        let slowBus = foldAll [ 800 ] // one-way 400 > τ=100 → out-of-cone

        let ivOut, vOut = AntiSybil.priceAgainstSocietyMetered prior newBelief sender society slowBus 100
        let ivIn, vIn = AntiSybil.priceAgainstSocietyMetered prior newBelief sender society fastBus 100
        let ivUn, vUn = AntiSybil.priceAgainstSocietyMetered prior newBelief sender society BusRegime.empty 100

        // the money math is regime-independent: a clone earns zero everywhere
        Assert.Equal(0.0, float ivOut, 5)
        Assert.Equal(0.0, float ivIn, 5)
        Assert.Equal(0.0, float ivUn, 5)
        // the MEANING flips with the regime
        Assert.True(vOut.Evidential, "out-of-cone clone correlation is hard evidence")
        Assert.False(vIn.Evidential, "in-cone super-correlation is fakeable — no conviction")
        Assert.True(vIn.FakeableInCone)
        Assert.False(vUn.Evidential, "an unmeasured bus never upgrades to evidence")
        Assert.False(vUn.FakeableInCone)

    [<Fact>]
    let ``BR-5: an honestly-unique sender is never evidential in any regime`` () =
        let prior = makeBelief 0.0
        let newBelief = makeBelief 5.0
        let sender = [ makeBelief 1.0; makeBelief 2.0; makeBelief 3.0; makeBelief 4.0 ]
        // exactly orthogonal to the linear trend (Pearson ρ = 0): [+,−,−,+] vs [1,2,3,4].
        // NOTE: an oscillating [+,−,+,−] stream is NOT safe here — it anti-correlates at
        // |ρ| ≈ 0.447 > the honest ceiling, and `judge` reads |ρ| deliberately (CHSH-style:
        // perfect ANTI-correlation is also more agreement-with-a-script than two free
        // selves produce; the sign is choreography, the magnitude is the tell).
        let other = [ makeBelief 1.0; makeBelief -1.0; makeBelief -1.0; makeBelief 1.0 ]
        let society = [ { AntiSybil.StreamHistory.AgentId = "other"; AntiSybil.StreamHistory.Beliefs = other } ]
        let slowBus = foldAll [ 800 ]

        let iv, v = AntiSybil.priceAgainstSocietyMetered prior newBelief sender society slowBus 100
        Assert.True(float iv > 0.0, "unique stream earns IV")
        Assert.False(v.Evidential, "below the honest ceiling there is nothing to explain")

    // ── Caveat (b) fix: δ_max widen-cone tests ────────────────────────────────────────────────

    [<Fact>]
    let ``BR-6: regimeOf with deltaMaxMs=0 is identical to regimeOfTerrestrial`` () =
        // Regression: the new 3-arg regimeOf must be a strict superset of the old 2-arg behavior.
        let m = foldAll [ 80; 40; 120; 60 ] // bestOneWayMs = 20
        Assert.Equal(BusRegime.InCone,    BusRegime.regimeOf m 20 0)
        Assert.Equal(BusRegime.OutOfCone, BusRegime.regimeOf m 19 0)
        Assert.Equal(BusRegime.InCone,    BusRegime.regimeOfTerrestrial m 20)
        Assert.Equal(BusRegime.OutOfCone, BusRegime.regimeOfTerrestrial m 19)
        // Verify they agree for a range of deadlines
        for d in [ 0; 10; 19; 20; 21; 100; 1000 ] do
            Assert.Equal(BusRegime.regimeOfTerrestrial m d, BusRegime.regimeOf m d 0)

    [<Fact>]
    let ``BR-7: widen-cone-by-deltaMax suppresses false OutOfCone on asymmetric links`` () =
        // Scenario: bestOneWayMs = 120 (RTT = 240), deadline = 100.
        // Without the fix: 120 > 100 → OutOfCone (potentially false conviction on asymmetric link).
        // With deltaMaxMs = 20: effective threshold = 120; 120 ≤ 120 → InCone (conservative).
        let m = foldAll [ 240 ] // bestOneWayMs = 120
        Assert.Equal(BusRegime.OutOfCone, BusRegime.regimeOf m 100 0)   // old behavior preserved
        Assert.Equal(BusRegime.InCone,    BusRegime.regimeOf m 100 20)  // δ=20: 120 ≤ 120 → InCone
        Assert.Equal(BusRegime.InCone,    BusRegime.regimeOf m 100 30)  // δ=30: 120 ≤ 130 → InCone
        Assert.Equal(BusRegime.OutOfCone, BusRegime.regimeOf m 100 19)  // δ=19: 120 > 119 → OutOfCone

    [<Fact>]
    let ``BR-8: negative deltaMaxMs is clamped to 0 (no tightening of the cone)`` () =
        // The fix is conservative-only: a negative budget must not tighten the cone.
        let m = foldAll [ 200 ] // bestOneWayMs = 100
        Assert.Equal(BusRegime.InCone, BusRegime.regimeOf m 100 0)    // at boundary → InCone
        Assert.Equal(BusRegime.InCone, BusRegime.regimeOf m 100 -50)  // negative clamped to 0
        Assert.Equal(BusRegime.InCone, BusRegime.regimeOf m 100 -999)

    [<Fact>]
    let ``BR-9: Earth-Mars opposition scenario — deltaMaxMs=190 prevents false conviction`` () =
        // Earth–Mars opposition: RTT ≈ 22 min = 1,320,000 ms; deadline = 659,999 ms (1 ms below RTT/2).
        // bestOneWayMs = 660,000. Without fix: 660,000 > 659,999 → OutOfCone (false conviction).
        // With δ=190 ms budget: effective threshold = 660,189; 660,000 ≤ 660,189 → InCone (correct).
        let rtt = 1_320_000
        let deadline = 659_999 // 1 ms below the symmetric estimate
        let m = foldAll [ rtt ]
        Assert.Equal(BusRegime.OutOfCone, BusRegime.regimeOf m deadline 0)    // old: false conviction
        Assert.Equal(BusRegime.InCone,    BusRegime.regimeOf m deadline 190)  // fixed: InCone

    [<Property>]
    let ``BR-10: regimeOf is monotone in deltaMaxMs — more budget never tightens the cone`` (rttMs: PositiveInt) (deadlineMs: PositiveInt) =
        // For any fixed meter and deadline, increasing deltaMaxMs can only move OutOfCone → InCone,
        // never InCone → OutOfCone. This is the core safety property of Option 3.
        let m = foldAll [ rttMs.Get ]
        let r0   = BusRegime.regimeOf m deadlineMs.Get 0
        let r50  = BusRegime.regimeOf m deadlineMs.Get 50
        let r500 = BusRegime.regimeOf m deadlineMs.Get 500
        // If r0 = InCone, then r50 and r500 must also be InCone (monotone).
        // If r50 = OutOfCone, then r0 must also be OutOfCone.
        // Use boolean implication: (p ==> q) = (not p || q)
        let impl p q = not p || q
        impl (r0 = BusRegime.InCone) (r50 = BusRegime.InCone && r500 = BusRegime.InCone)
        && impl (r50 = BusRegime.OutOfCone) (r0 = BusRegime.OutOfCone)
        && impl (r500 = BusRegime.OutOfCone) (r50 = BusRegime.OutOfCone)
