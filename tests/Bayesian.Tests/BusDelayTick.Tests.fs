module Zeta.Bayesian.Tests.BusDelayTickTests

open Xunit
open Zeta.Core
open Zeta.Bayesian

// ── Helpers ──────────────────────────────────────────────────────────────────────────────────────

/// A Gaussian sensory input with given precision-mean and precision.
let private g pm p : Gaussian = { Gaussian.PrecisionMean = pm; Precision = p }

/// A standard observation: mean = 1.0, precision = 1.0.
let private obs = g 1.0 1.0

// ── BDT-1: Fresh tick source has rhoCount = 1.0 (no observations yet) ────────────────────────────

[<Fact>]
let ``BDT-1: fresh tick source has rhoCount = 1.0 (all cells at zero AccumulatedIV)`` () =
    // A fresh ensemble has all cells with AccumulatedIV = 0.
    // rhoCount = 1.0 because mean = 0 → the "all-zero" degenerate case.
    let src = BusDelayTick.create ()
    Assert.Equal(1.0, src.RhoCount)
    Assert.Equal(0, src.TickCount)
    Assert.Equal(0, src.ReseedCount)

// ── BDT-2: Broadcast tick increments TickCount and updates the ensemble ───────────────────────────

[<Fact>]
let ``BDT-2: broadcast tick (busDelayCell = None) increments TickCount and all cells observe`` () =
    let src = BusDelayTick.create ()
    let (src1, _) = BusDelayTick.tick obs None src
    Assert.Equal(1, src1.TickCount)
    // After one broadcast, the ensemble's totalIV > 0 (at least one cell observed).
    // Note: a broadcast to a fresh ensemble triggers rhoCount = 1.0 (all cells synchronized
    // at IV=1.0), which fires the Tsirelson reseed. The reseed replaces the least-experienced
    // cell (index 0, tie-broken by index) with a fresh cell. So totalIV = 15 (not 16).
    // The correct invariant is: totalIV > 0, not that every cell has IV > 0.
    let totalIV = YinYangEnsemble.totalIV src1.Ensemble
    Assert.True(totalIV > 0.0, sprintf "totalIV should be > 0 after a broadcast tick, got %f" totalIV)

// ── BDT-3: Single-cell tick only updates the target cell ─────────────────────────────────────────

[<Fact>]
let ``BDT-3: single-cell tick (busDelayCell = Some 5) only updates cell 5`` () =
    // Use cell 5 (not cell 0) to avoid the tie-breaking reseed that replaces cell 0.
    // After one single-cell tick to cell 5:
    //   - Cell 5 has IV > 0; all others have IV = 0.
    //   - rhoCount = 1.0 (degenerate: mean = IV_5/16 but 15 cells have 0 → mean > 0 but CV > 0).
    //   - The reseed guard (hasObservations = totalIV > 0) fires, but rhoCount check:
    //     rhoCount = 1 - CV(counts), where 15 cells have 0 and 1 has IV_5.
    //     CV = std/mean = high → rhoCount < 1.0 → no reseed triggered.
    let src = BusDelayTick.create ()
    let (src1, _) = BusDelayTick.tick obs (Some 5) src
    Assert.Equal(1, src1.TickCount)
    // The target cell should have IV > 0
    let targetObserved = float src1.Ensemble.Cells.[5].Column.AccumulatedIV > 0.0
    Assert.True(targetObserved, "Cell 5 should have observed after a single-cell tick")
    // All other cells should still have IV = 0
    let othersUnchanged =
        src1.Ensemble.Cells
        |> Array.indexed
        |> Array.filter (fun (i, _) -> i <> 5)
        |> Array.forall (fun (_, cell) -> float cell.Column.AccumulatedIV = 0.0)
    Assert.True(othersUnchanged, "All other cells should be unchanged after a single-cell tick")

// ── BDT-4: rhoCountMultiplier is 1.0 at Tsirelson operating point ────────────────────────────────

[<Fact>]
let ``BDT-4: rhoCountMultiplier = 1.0 when rhoCount = tsirelsonThreshold`` () =
    // Construct a tick source where rhoCount is exactly at the Tsirelson threshold.
    // We do this by directly building a TickSource with the desired rhoCount.
    // The multiplier formula is: rhoCount / tsirelsonThreshold, clamped to [minFactor, maxFactor].
    // At rhoCount = tsirelsonThreshold: multiplier = 1.0 exactly.
    let src = BusDelayTick.create ()
    // Manually set rhoCount to tsirelsonThreshold for the test
    let srcAtTsirelson = { src with RhoCount = YinYangEnsemble.tsirelsonThreshold }
    let mult = BusDelayTick.rhoCountMultiplier 0.1 10.0 srcAtTsirelson
    Assert.Equal(1.0, mult, 6)

// ── BDT-5: Bus delay (single-cell ticks) lowers rhoCount over time ───────────────────────────────

[<Fact>]
let ``BDT-5: repeated single-cell ticks to different cells lowers rhoCount (temporal diversity)`` () =
    // Deliver observations to cells 0..7 one at a time (simulating bus delay).
    // After 8 ticks, cells 0..7 have 1 observation each; cells 8..15 have 0.
    // This creates temporal diversity: rhoCount should be < 1.0.
    let src = BusDelayTick.create ()
    let mutable current = src
    for i in 0 .. 7 do
        let (next, _) = BusDelayTick.tick obs (Some i) current
        current <- next
    // rhoCount should now be < 1.0 because half the cells have observations and half don't
    Assert.True(current.RhoCount < 1.0,
        sprintf "rhoCount should be < 1.0 after bus-delayed delivery, got %f" current.RhoCount)
    Assert.Equal(8, current.TickCount)

// ── BDT-6: reseedRate is 0.0 when no reseeds have occurred ───────────────────────────────────────

[<Fact>]
let ``BDT-6: reseedRate = 0.0 on fresh tick source`` () =
    let src = BusDelayTick.create ()
    Assert.Equal(0.0, BusDelayTick.reseedRate src)

// ── BDT-7: isInQuantumRegime is true when rhoCount <= tsirelsonThreshold ─────────────────────────

[<Fact>]
let ``BDT-7: isInQuantumRegime is true when rhoCount <= tsirelsonThreshold`` () =
    let src = BusDelayTick.create ()
    // rhoCount = 1.0 on a fresh source → NOT in quantum regime
    Assert.False(BusDelayTick.isInQuantumRegime src)
    // Set rhoCount to 0.0 → in quantum regime
    let srcLow = { src with RhoCount = 0.0 }
    Assert.True(BusDelayTick.isInQuantumRegime srcLow)
    // Set rhoCount to tsirelsonThreshold exactly → in quantum regime (≤)
    let srcAtT = { src with RhoCount = YinYangEnsemble.tsirelsonThreshold }
    Assert.True(BusDelayTick.isInQuantumRegime srcAtT)
