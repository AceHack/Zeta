module Zeta.Tests.DebounceObservationTests

open System
open Xunit
open Zeta.Core.DebouncedOracle

/// THE FALSIFIER FOR A CLAIM THAT PREVIOUSLY HAD NONE.
///
/// `DebouncedOracle.EffectiveCorrelation` publishes ρ = 1/(1+MinDelay) — a pure function of
/// config. It never touches a reading, so no observed behaviour could contradict it. The module
/// that exists to GUARANTEE decorrelation asserted decorrelation with nothing able to refute it.
///
/// `DebounceObservation` is the measured counterpart. These tests exist to prove the measurement
/// can distinguish the cases the declared ρ cannot — in BOTH directions, because a check that
/// always reports "inert" would be as useless as one that never does.

let private cfg (minDelaySeconds: float) : DebouncedOracleConfig =
    { MinDelay = TimeSpan.FromSeconds minDelaySeconds
      SyncContext = None
      OracleIndex = 0 }

[<Fact>]
let ``empty observation reports nothing seen — NOT zero suppression`` () =
    let o = DebounceObservation.empty
    // The distinction this whole record exists to preserve: "nothing arrived" is a different
    // fact from "nothing was suppressed". Returning 0.0 here would conflate them.
    Assert.Equal(None, DebounceObservation.suppressionRate o)
    Assert.False(DebounceObservation.isInert o)   // no readings ⇒ not evidence of inertness

[<Fact>]
let ``isInert fires when readings arrived and NONE were suppressed`` () =
    let o = { DebounceObservation.empty with Accepted = 10; Suppressed = 0 }
    Assert.True(DebounceObservation.isInert o)
    Assert.Equal(Some 0.0, DebounceObservation.suppressionRate o)

[<Fact>]
let ``NEGATIVE CONTROL: isInert does NOT fire when suppression actually happened`` () =
    // Without this, an `isInert` that returned true unconditionally would pass the test above
    // and look like a working falsifier. Both directions must be pinned.
    let o = { DebounceObservation.empty with Accepted = 7; Suppressed = 3 }
    Assert.False(DebounceObservation.isInert o)
    Assert.Equal(Some 0.3, DebounceObservation.suppressionRate o)

[<Fact>]
let ``suppressionRate is the fraction of ALL readings, not of accepted`` () =
    let o = { DebounceObservation.empty with Accepted = 1; Suppressed = 3 }
    Assert.Equal(Some 0.75, DebounceObservation.suppressionRate o)
    Assert.Equal(4, DebounceObservation.total o)

[<Fact>]
let ``gateIsBinding is None when no gap was ever observed`` () =
    // Unmeasurable must stay distinct from measured-false — the same live/cold distinction the
    // rest of the substrate enforces on observability surfaces.
    Assert.Equal(None, DebounceObservation.gateIsBinding (cfg 1.0) DebounceObservation.empty)

[<Fact>]
let ``gateIsBinding is true when observed gaps sit near the configured MinDelay`` () =
    let o = { DebounceObservation.empty with Accepted = 2; MinObservedGap = Some 1.2 }
    Assert.Equal(Some true, DebounceObservation.gateIsBinding (cfg 1.0) o)

[<Fact>]
let ``gateIsBinding is FALSE when the source was already slower than the gate`` () =
    // The decorative case: every gap far exceeds MinDelay, so the debounce never had to act and
    // the declared ρ describes a gate that did nothing. Distinguishable only by measurement.
    let o = { DebounceObservation.empty with Accepted = 2; MinObservedGap = Some 600.0 }
    Assert.Equal(Some false, DebounceObservation.gateIsBinding (cfg 1.0) o)

[<Fact>]
let ``declared rho is independent of observation — which is exactly the problem`` () =
    // Pins the defect rather than hiding it: two oracles with identical config publish identical
    // ρ whether one suppressed everything and the other suppressed nothing. This test documents
    // WHY the observation record is needed, and will start failing the day ρ becomes measured.
    let c = cfg 3.0
    let declared = DebouncedOracleConfig.effectiveCorrelation c
    Assert.Equal(0.25, declared, 10)   // 1/(1+3)

    let busy   = { DebounceObservation.empty with Accepted = 5; Suppressed = 95 }
    let inert  = { DebounceObservation.empty with Accepted = 100; Suppressed = 0 }
    // Same declared ρ, opposite realities. The observation separates them; ρ cannot.
    Assert.True(DebounceObservation.isInert inert)
    Assert.False(DebounceObservation.isInert busy)
