module Zeta.Tests.Algebra.RobustStatsTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ─── Core: median on odd / even / empty ─────────

[<Fact>]
let ``median of empty sequence is None`` () =
    RobustStats.median [] |> should equal (None: double option)

[<Fact>]
let ``median of single element returns that element`` () =
    RobustStats.median [ 42.0 ] |> should equal (Some 42.0)

[<Fact>]
let ``median of odd-length sample picks middle element after sort`` () =
    RobustStats.median [ 3.0; 1.0; 2.0 ] |> should equal (Some 2.0)

[<Fact>]
let ``median of even-length sample averages two centre elements`` () =
    RobustStats.median [ 4.0; 2.0; 1.0; 3.0 ] |> should equal (Some 2.5)


// ─── MAD properties ─────────

[<Fact>]
let ``mad of empty sequence is None`` () =
    RobustStats.mad [] |> should equal (None: double option)

[<Fact>]
let ``mad of constant sample is zero`` () =
    RobustStats.mad [ 5.0; 5.0; 5.0; 5.0 ] |> should equal (Some 0.0)

[<Fact>]
let ``mad of 1 2 3 4 5 equals 1`` () =
    // median = 3, deviations = 2,1,0,1,2, median of devs = 1.
    RobustStats.mad [ 1.0; 2.0; 3.0; 4.0; 5.0 ] |> should equal (Some 1.0)


// ─── robustAggregate: the load-bearing behaviour ─────────

[<Fact>]
let ``robustAggregate of empty sequence is None`` () =
    RobustStats.robustAggregate [] |> should equal (None: double option)

[<Fact>]
let ``robustAggregate of single element returns that element`` () =
    RobustStats.robustAggregate [ 7.0 ] |> should equal (Some 7.0)

[<Fact>]
let ``robustAggregate of constant sample returns the constant`` () =
    // MAD = 0 here; MadFloor prevents the filter from collapsing.
    RobustStats.robustAggregate [ 5.0; 5.0; 5.0; 5.0; 5.0 ] |> should equal (Some 5.0)

[<Fact>]
let ``robustAggregate survives a single extreme outlier`` () =
    // The mean of [1;2;3;4;5;1000] is 169.2 — a single adversarial
    // sample has moved the answer beyond any legitimate reading. The
    // robust aggregate discards the outlier and returns the median
    // of the kept set.
    let xs = [ 1.0; 2.0; 3.0; 4.0; 5.0; 1000.0 ]
    let result = RobustStats.robustAggregate xs
    // median = 3.5; MAD ≈ 1.5; threshold = 4.5; 1000 is dropped;
    // kept = [1;2;3;4;5]; median of kept = 3.
    result |> should equal (Some 3.0)

[<Fact>]
let ``robustAggregate keeps values within three MAD of the median`` () =
    // median = 3, MAD = 1, threshold = 3. Values 1..5 all satisfy
    // |x - 3| <= 3; no outlier to drop. Kept-median = 3.
    RobustStats.robustAggregate [ 1.0; 2.0; 3.0; 4.0; 5.0 ] |> should equal (Some 3.0)

[<Fact>]
let ``robustAggregate is unaffected by adding a mirrored outlier pair`` () =
    // Symmetric extreme pair on both sides of the sample.
    let baseline = RobustStats.robustAggregate [ 1.0; 2.0; 3.0; 4.0; 5.0 ]
    let withOutliers = RobustStats.robustAggregate [ -1000.0; 1.0; 2.0; 3.0; 4.0; 5.0; 1000.0 ]
    withOutliers |> should equal baseline
