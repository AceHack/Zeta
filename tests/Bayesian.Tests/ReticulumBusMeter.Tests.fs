namespace Zeta.Bayesian.Tests

open Xunit
open Zeta.Bayesian
open Zeta.Core

/// ReticulumBusMeter — real telemetry arms the readout end-to-end: the F# completion of
/// "metering the bus arms the readout" (TS living-node twin), on Lumen's transport types.
module ReticulumBusMeterTests =

    let private makeBelief mean = { Gaussian.PrecisionMean = mean * 1.0; Precision = 1.0 }

    let private telemetry rttSeconds =
        { MeshLatencyModel.LinkTelemetry.RttSeconds = rttSeconds
          MeshLatencyModel.LinkTelemetry.Snr = 10.0
          MeshLatencyModel.LinkTelemetry.Rssi = -60.0
          MeshLatencyModel.LinkTelemetry.CapacityBps = 1_000_000.0 }

    let private snapshot links =
        { MeshLatencyModel.MeshSnapshot.LocalNodeId = "local"
          MeshLatencyModel.MeshSnapshot.ActiveLinks = Map.ofList links }

    [<Fact>]
    let ``RBM-1: empty snapshot is honestly Unmeasured — never upgrades to evidence`` () =
        let empty = snapshot []
        Assert.Equal(BusRegime.Unmeasured, ReticulumBusMeter.regimeOfSnapshot empty 100)

    [<Fact>]
    let ``RBM-2: regime follows the fastest link this node can see (min crossing rules)`` () =
        // links at 800ms and 3s RTT: fastest one-way = 400ms
        let slow = snapshot [ ("a", telemetry 0.8); ("b", telemetry 3.0) ]
        Assert.Equal(BusRegime.OutOfCone, ReticulumBusMeter.regimeOfSnapshot slow 100)
        // add ONE fast link (80ms RTT → 40ms one-way ≤ τ): in-cone, evidence dies
        let mixed = snapshot [ ("a", telemetry 0.8); ("b", telemetry 3.0); ("c", telemetry 0.08) ]
        Assert.Equal(BusRegime.InCone, ReticulumBusMeter.regimeOfSnapshot mixed 100)

    [<Fact>]
    let ``RBM-3: negative/garbage RTT clamps to zero — and zero is in-cone (conservative)`` () =
        let garbage = snapshot [ ("a", telemetry -5.0) ]
        Assert.Equal(BusRegime.InCone, ReticulumBusMeter.regimeOfSnapshot garbage 100)

    [<Fact>]
    let ``RBM-4: end-to-end — the same clone flips Evidential/FakeableInCone with the real mesh`` () =
        let prior = makeBelief 0.0
        let newBelief = makeBelief 5.0
        let sender = [ makeBelief 1.0; makeBelief 2.0; makeBelief 3.0; makeBelief 4.0 ]
        let society = [ { AntiSybil.StreamHistory.AgentId = "clone"; AntiSybil.StreamHistory.Beliefs = sender } ]

        let slowMesh = snapshot [ ("a", telemetry 0.8) ] // one-way 400ms > τ=100
        let fastMesh = snapshot [ ("a", telemetry 0.08) ] // one-way 40ms ≤ τ=100

        let ivSlow, vSlow = ReticulumBusMeter.priceAgainstSocietyOnMesh prior newBelief sender society slowMesh 100
        let ivFast, vFast = ReticulumBusMeter.priceAgainstSocietyOnMesh prior newBelief sender society fastMesh 100

        // money math regime-independent: clone earns zero on any mesh
        Assert.Equal(0.0, float ivSlow, 5)
        Assert.Equal(0.0, float ivFast, 5)
        // meaning flips with the measured wire
        Assert.True(vSlow.Evidential, "slow mesh: correlation exceeds what the visible wire explains")
        Assert.False(vFast.Evidential, "fast mesh: fakeable — no conviction")
        Assert.True(vFast.FakeableInCone)
