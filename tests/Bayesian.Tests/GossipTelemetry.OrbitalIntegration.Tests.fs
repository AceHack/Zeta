namespace Zeta.Bayesian.Tests

open Xunit
open Zeta.Bayesian

/// GossipTelemetry orbital integration tests — Earth-Mars scenario.
/// These tests prove that the caveat-b fix (δ_max widen-cone) is live in the
/// gossip layer and prevents false OutOfCone convictions on asymmetric paths.
///
/// All physics values are computed dynamically from OrbitalAsymmetryBudget
/// so the tests are correct at any orbital phase.
module GossipTelemetryOrbitalIntegrationTests =

    // ── Helpers ───────────────────────────────────────────────────────────────

    let private crossing a b rtt observer =
        GossipTelemetry.Heard
            { GossipTelemetry.Crossing.NodeA = a
              GossipTelemetry.Crossing.NodeB = b
              GossipTelemetry.Crossing.RttMs = rtt
              GossipTelemetry.Crossing.Observer = observer }

    let private hearAll rumors =
        rumors |> List.fold GossipTelemetry.hear GossipTelemetry.empty

    // Fixed JD for deterministic tests: 2022-01-01 (near Mars opposition, ~100M km)
    let private testJd = 2459580.5

    // Compute actual physics at the test JD
    let private actualOneWayMs = int (OrbitalAsymmetryBudget.oneWayMs "earth" "mars" testJd)
    let private actualRttMs    = int (OrbitalAsymmetryBudget.rttMs    "earth" "mars" testJd)
    let private actualDeltaMs  = int (OrbitalAsymmetryBudget.deltaMaxMs "earth" "mars" testJd)
    let private bestOneWayMs   = actualRttMs / 2  // what BusRegime.regimeOf uses

    // OrbitalLink for Earth-Mars at the test JD
    let private earthMarsLink : ReticulumBusMeter.OrbitalLink option =
        Some { ReticulumBusMeter.OrbitalLink.LocalBody = "earth"
               ReticulumBusMeter.OrbitalLink.RemoteBody = "mars"
               ReticulumBusMeter.OrbitalLink.ObservationJd = testJd }

    // tightDeadline: in the window (bestOneWay - δ_max, bestOneWay)
    // → terrestrial: OutOfCone (bestOneWay > tightDeadline)
    // → orbital:     InCone    (bestOneWay ≤ tightDeadline + δ_max)
    // Guard: only valid when actualDeltaMs ≥ 2
    let private tightDeadline = bestOneWayMs - (max 1 (actualDeltaMs / 2))

    // ── GT-OI-1: Terrestrial — tight deadline is OutOfCone ───────────────────

    [<Fact>]
    let ``GT-OI-1: terrestrial regimeOfPair — tight deadline is OutOfCone`` () =
        let salon = hearAll [ crossing "earth" "mars" actualRttMs "witness" ]
        let regime = GossipTelemetry.regimeOfPair salon "earth" "mars" tightDeadline
        Assert.Equal(BusRegime.OutOfCone, regime)

    // ── GT-OI-2: Orbital — δ_max widens cone, prevents false conviction ───────

    [<Fact>]
    let ``GT-OI-2: regimeOfPairOrbital — δ_max widens cone, prevents false OutOfCone`` () =
        let salon = hearAll [ crossing "earth" "mars" actualRttMs "witness" ]
        let terrestrial = GossipTelemetry.regimeOfPair salon "earth" "mars" tightDeadline
        let orbital = GossipTelemetry.regimeOfPairOrbital salon "earth" "mars" tightDeadline earthMarsLink
        Assert.Equal(BusRegime.OutOfCone, terrestrial)  // false conviction without δ_max
        Assert.Equal(BusRegime.InCone, orbital)          // correct with δ_max

    // ── GT-OI-3: No-link (None) → identical to terrestrial ───────────────────

    [<Fact>]
    let ``GT-OI-3: regimeOfPairOrbital with None link → identical to regimeOfPair`` () =
        let salon = hearAll [ crossing "earth" "mars" actualRttMs "witness" ]
        let terrestrial = GossipTelemetry.regimeOfPair salon "earth" "mars" tightDeadline
        let orbital = GossipTelemetry.regimeOfPairOrbital salon "earth" "mars" tightDeadline None
        Assert.Equal(terrestrial, orbital)

    // ── GT-OI-4: regimeWithGossipOrbital — combined local + gossip with δ_max ─

    [<Fact>]
    let ``GT-OI-4: regimeWithGossipOrbital — local meter + gossip + δ_max`` () =
        let salon = hearAll [ crossing "earth" "mars" actualRttMs "witness" ]
        let terrestrial = GossipTelemetry.regimeWithGossip BusRegime.empty salon "earth" "mars" tightDeadline
        let orbital = GossipTelemetry.regimeWithGossipOrbital BusRegime.empty salon "earth" "mars" tightDeadline earthMarsLink
        Assert.Equal(BusRegime.OutOfCone, terrestrial)
        Assert.Equal(BusRegime.InCone, orbital)

    // ── GT-OI-5: Very tight deadline — OutOfCone even with δ_max ─────────────

    [<Fact>]
    let ``GT-OI-5: very tight deadline — OutOfCone even with δ_max`` () =
        let veryTight = bestOneWayMs - (actualDeltaMs * 10)
        let salon = hearAll [ crossing "earth" "mars" actualRttMs "witness" ]
        let orbital = GossipTelemetry.regimeOfPairOrbital salon "earth" "mars" veryTight earthMarsLink
        Assert.Equal(BusRegime.OutOfCone, orbital)

    // ── GT-OI-6: Unmeasured pairs stay Unmeasured ─────────────────────────────

    [<Fact>]
    let ``GT-OI-6: unheard pairs stay Unmeasured with orbital link`` () =
        let salon = hearAll [ crossing "earth" "mars" actualRttMs "witness" ]
        let regime = GossipTelemetry.regimeOfPairOrbital salon "earth" "venus" actualOneWayMs earthMarsLink
        Assert.Equal(BusRegime.Unmeasured, regime)

    // ── GT-OI-7: Monotone — orbital can only widen, never tighten ─────────────

    [<Fact>]
    let ``GT-OI-7: orbital δ_max is monotone — can only widen cone, never tighten`` () =
        let salon = hearAll [ crossing "earth" "mars" actualRttMs "witness" ]
        let deadlines =
            [ bestOneWayMs - actualDeltaMs * 10
              tightDeadline
              bestOneWayMs
              bestOneWayMs + 100
              actualRttMs ]
        for deadline in deadlines do
            let terrestrial = GossipTelemetry.regimeOfPair salon "earth" "mars" deadline
            let orbital = GossipTelemetry.regimeOfPairOrbital salon "earth" "mars" deadline earthMarsLink
            if terrestrial = BusRegime.InCone then
                Assert.Equal(BusRegime.InCone, orbital)
            if terrestrial = BusRegime.Unmeasured then
                Assert.Equal(BusRegime.Unmeasured, orbital)

    // ── GT-OI-8: Earth-Moon — δ_max is small, terrestrial and orbital agree ───

    [<Fact>]
    let ``GT-OI-8: Earth-Moon — δ_max is small, terrestrial and orbital agree for most deadlines`` () =
        let moonRttMs    = int (OrbitalAsymmetryBudget.rttMs    "earth" "moon" testJd)
        let moonOneWayMs = int (OrbitalAsymmetryBudget.oneWayMs "earth" "moon" testJd)
        let moonLink : ReticulumBusMeter.OrbitalLink option =
            Some { ReticulumBusMeter.OrbitalLink.LocalBody = "earth"
                   ReticulumBusMeter.OrbitalLink.RemoteBody = "moon"
                   ReticulumBusMeter.OrbitalLink.ObservationJd = testJd }
        let salon = hearAll [ crossing "earth" "moon" moonRttMs "witness" ]
        let deadline = moonOneWayMs + 100
        let terrestrial = GossipTelemetry.regimeOfPair salon "earth" "moon" deadline
        let orbital = GossipTelemetry.regimeOfPairOrbital salon "earth" "moon" deadline moonLink
        Assert.Equal(BusRegime.InCone, terrestrial)
        Assert.Equal(BusRegime.InCone, orbital)
