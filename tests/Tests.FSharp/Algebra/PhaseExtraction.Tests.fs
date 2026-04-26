module Zeta.Tests.Algebra.PhaseExtractionTests

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ─── epochPhase ─────────

[<Fact>]
let ``epochPhase of sample at t=0 is 0`` () =
    let phases = PhaseExtraction.epochPhase 10.0 [| 0.0 |]
    abs phases.[0] |> should (be lessThan) 1e-9

[<Fact>]
let ``epochPhase at half-period is pi`` () =
    // Period 10; t=5 → phase = 2π · 5/10 = π
    let phases = PhaseExtraction.epochPhase 10.0 [| 5.0 |]
    abs (phases.[0] - Math.PI) |> should (be lessThan) 1e-9

[<Fact>]
let ``epochPhase wraps at period boundary`` () =
    // t = period returns to phase 0
    let phases = PhaseExtraction.epochPhase 10.0 [| 10.0; 20.0 |]
    abs phases.[0] |> should (be lessThan) 1e-9
    abs phases.[1] |> should (be lessThan) 1e-9

[<Fact>]
let ``epochPhase handles negative sample times`` () =
    // t = -5, period 10 → mod = 5 → phase = π
    let phases = PhaseExtraction.epochPhase 10.0 [| -5.0 |]
    abs (phases.[0] - Math.PI) |> should (be lessThan) 1e-9

[<Fact>]
let ``epochPhase returns empty on invalid period`` () =
    PhaseExtraction.epochPhase 0.0 [| 1.0; 2.0 |] |> should equal ([||]: double[])
    PhaseExtraction.epochPhase -1.0 [| 1.0 |] |> should equal ([||]: double[])


// ─── interEventPhase ─────────

[<Fact>]
let ``interEventPhase returns empty on fewer than 2 events`` () =
    PhaseExtraction.interEventPhase [| 5.0 |] [| 3.0 |] |> should equal ([||]: double[])
    PhaseExtraction.interEventPhase [||] [| 3.0 |] |> should equal ([||]: double[])

[<Fact>]
let ``interEventPhase at start of interval is 0`` () =
    // Events at t=0, 10. Sample at t=0 → phase 0 (start of first interval).
    let phases = PhaseExtraction.interEventPhase [| 0.0; 10.0 |] [| 0.0 |]
    abs phases.[0] |> should (be lessThan) 1e-9

[<Fact>]
let ``interEventPhase at midpoint is pi`` () =
    // Events at 0, 10. Sample at 5 → phase = 2π · 5/10 = π
    let phases = PhaseExtraction.interEventPhase [| 0.0; 10.0 |] [| 5.0 |]
    abs (phases.[0] - Math.PI) |> should (be lessThan) 1e-9

[<Fact>]
let ``interEventPhase adapts to varying intervals`` () =
    // Events at 0, 4, 10. Sample at 2 → phase in [0,4] interval
    // = 2π · 2/4 = π. Sample at 7 → phase in [4,10] interval
    // = 2π · 3/6 = π.
    let phases = PhaseExtraction.interEventPhase [| 0.0; 4.0; 10.0 |] [| 2.0; 7.0 |]
    abs (phases.[0] - Math.PI) |> should (be lessThan) 1e-9
    abs (phases.[1] - Math.PI) |> should (be lessThan) 1e-9

[<Fact>]
let ``interEventPhase returns 0 before first and after last event`` () =
    // Events at 10, 20. Sample at 5 (before first) and 25
    // (after last) both return 0.
    let phases = PhaseExtraction.interEventPhase [| 10.0; 20.0 |] [| 5.0; 25.0 |]
    abs phases.[0] |> should (be lessThan) 1e-9
    abs phases.[1] |> should (be lessThan) 1e-9


// ─── composes with phaseLockingValue ─────────

[<Fact>]
let ``epochPhase output feeds phaseLockingValue for synchronized sources`` () =
    // Two nodes with identical period-10 cadence, same sample
    // times → identical phases → PLV = 1.
    let samples = [| 1.0; 3.0; 5.0; 7.0; 9.0; 11.0; 13.0 |]
    let phasesA = PhaseExtraction.epochPhase 10.0 samples
    let phasesB = PhaseExtraction.epochPhase 10.0 samples
    let plv =
        TemporalCoordinationDetection.phaseLockingValue phasesA phasesB
        |> Option.defaultValue 0.0
    abs (plv - 1.0) |> should (be lessThan) 1e-9

[<Fact>]
let ``epochPhase output feeds phaseLockingValue for constant-offset sources`` () =
    // Node A period 10; Node B same period, offset by +2 seconds.
    // Phase difference is constant → PLV = 1 (perfect locking at
    // a non-zero offset).
    let samples = [| 1.0; 3.0; 5.0; 7.0; 9.0 |]
    let phasesA = PhaseExtraction.epochPhase 10.0 samples
    let phasesB = PhaseExtraction.epochPhase 10.0 (samples |> Array.map (fun t -> t + 2.0))
    let plv =
        TemporalCoordinationDetection.phaseLockingValue phasesA phasesB
        |> Option.defaultValue 0.0
    abs (plv - 1.0) |> should (be lessThan) 1e-9
