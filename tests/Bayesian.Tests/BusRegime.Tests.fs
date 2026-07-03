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
        Assert.Equal(BusRegime.Unmeasured, BusRegime.regimeOf BusRegime.empty 1000)
        let m = foldAll [ 80; 40; 120; 60 ]
        Assert.Equal(Some 20, BusRegime.bestOneWayMs m)
        Assert.Equal(BusRegime.InCone, BusRegime.regimeOf m 20)
        Assert.Equal(BusRegime.OutOfCone, BusRegime.regimeOf m 19)

    [<Fact>]
    let ``BR-2: one fast crossing kills out-of-cone; window aging restores it`` () =
        let slow = foldAll (List.replicate (BusRegime.SampleCap - 1) 500)
        Assert.Equal(BusRegime.OutOfCone, BusRegime.regimeOf slow 100)
        let breached = BusRegime.foldSample slow 10
        Assert.Equal(BusRegime.InCone, BusRegime.regimeOf breached 100)
        // cap pushes the stale fast sample out
        let aged = (breached, List.replicate BusRegime.SampleCap 500) ||> List.fold BusRegime.foldSample
        Assert.Equal(BusRegime.OutOfCone, BusRegime.regimeOf aged 100)

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
