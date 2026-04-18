module Zeta.Tests.Infra.WatermarkTests
#nowarn "0893"

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// Watermarks (moved from Round6Tests / Round8Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``WatermarkTracker monotonic never decreases`` () =
    let t = WatermarkTracker WatermarkStrategy.Monotonic
    t.Observe 100L |> should equal 100L
    t.Observe 50L |> should equal 100L   // no regression
    t.Observe 200L |> should equal 200L


[<Fact>]
let ``WatermarkTracker bounded-lateness subtracts allowance`` () =
    let t = WatermarkTracker (WatermarkStrategy.BoundedLateness (TimeSpan.FromMilliseconds 10.0))
    let wm = t.Observe 100L
    wm |> should equal 90L


[<Fact>]
let ``Watermark.isLate fires when eventTime <= watermark`` () =
    Watermark.isLate 100L 90L |> should be True
    Watermark.isLate 100L 100L |> should be True   // boundary
    Watermark.isLate 100L 150L |> should be False


[<Fact>]
let ``Watermark.combine takes min across sources`` () =
    Watermark.combine [ 100L; 50L; 200L ] |> should equal 50L


// ─── WatermarkStrategy branch coverage (moved from Round8Tests) ─────

[<Fact>]
let ``WatermarkStrategy.Periodic subtracts lateness`` () =
    let t = WatermarkTracker (WatermarkStrategy.Periodic (TimeSpan.FromSeconds 1.0, TimeSpan.FromMilliseconds 50.0))
    let wm = t.Observe 1000L
    wm |> should equal 950L
