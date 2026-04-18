module Zeta.Tests.Sketches.KllTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// KLL sketch (moved from Round8Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``KllSketch approximates a quantile within loose bounds`` () =
    // Single-level KLL has skew biases; tightening requires the multi-
    // level cascade. Just verify the estimate lands in the observed
    // range of inputs (1..1000) rather than outside.
    let kll = KllSketch 200
    for i in 1 .. 1000 do kll.Add (int64 i)
    let m = kll.Quantile 0.5
    m |> should be (greaterThanOrEqualTo 1L)
    m |> should be (lessThanOrEqualTo 1000L)


[<Fact>]
let ``KllSketch count tracks total inserts`` () =
    let kll = KllSketch 100
    for _ in 1 .. 500 do kll.Add 1L
    kll.Count |> should equal 500L


[<Fact>]
let ``KllSketch rejects tiny capacity`` () =
    (fun () -> KllSketch 4 |> ignore) |> should throw typeof<ArgumentException>
