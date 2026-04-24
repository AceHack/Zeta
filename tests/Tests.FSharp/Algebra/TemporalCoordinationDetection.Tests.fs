module Zeta.Tests.Algebra.TemporalCoordinationDetectionTests

open System
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ─── crossCorrelation at lag 0 ─────────

[<Fact>]
let ``crossCorrelation of identical series is 1 at lag 0`` () =
    let xs = [ 1.0; 2.0; 3.0; 4.0; 5.0 ]
    TemporalCoordinationDetection.crossCorrelation xs xs 0
    |> Option.map (fun v -> Math.Round(v, 9))
    |> should equal (Some 1.0)

[<Fact>]
let ``crossCorrelation of negated series is -1 at lag 0`` () =
    let xs = [ 1.0; 2.0; 3.0; 4.0; 5.0 ]
    let ys = xs |> List.map (fun v -> -v)
    TemporalCoordinationDetection.crossCorrelation xs ys 0
    |> Option.map (fun v -> Math.Round(v, 9))
    |> should equal (Some -1.0)

[<Fact>]
let ``crossCorrelation of constant series is None (undefined variance)`` () =
    // A flat series has zero variance; Pearson correlation is
    // undefined. Detectors must get None, not NaN or 0.0.
    let xs = [ 5.0; 5.0; 5.0; 5.0 ]
    let ys = [ 1.0; 2.0; 3.0; 4.0 ]
    TemporalCoordinationDetection.crossCorrelation xs ys 0 |> should equal (None: double option)


// ─── crossCorrelation at nonzero lag ─────────

[<Fact>]
let ``crossCorrelation detects a one-step lag alignment`` () =
    // ys is xs shifted right by 1. At tau=1, the aligned windows
    // are the same shape, so correlation should be 1.
    let xs = [ 1.0; 2.0; 3.0; 4.0; 5.0 ]
    let ys = [ 0.0; 1.0; 2.0; 3.0; 4.0 ]
    TemporalCoordinationDetection.crossCorrelation xs ys 1
    |> Option.map (fun v -> Math.Round(v, 9))
    |> should equal (Some 1.0)

[<Fact>]
let ``crossCorrelation at negative lag aligns x ahead of y`` () =
    // Same series, probed at tau=-1: the aligned windows are
    // xs[1..] vs ys[..], both length 4, identical shape within
    // their respective slices when xs = ys.
    let xs = [ 1.0; 2.0; 3.0; 4.0; 5.0 ]
    TemporalCoordinationDetection.crossCorrelation xs xs -1
    |> Option.map (fun v -> Math.Round(v, 9))
    |> should equal (Some 1.0)


// ─── crossCorrelation edge cases ─────────

[<Fact>]
let ``crossCorrelation with single-element overlap is None`` () =
    // Overlap of 1 is below the 2-sample minimum; must return None.
    let xs = [ 1.0; 2.0 ]
    let ys = [ 1.0; 2.0 ]
    TemporalCoordinationDetection.crossCorrelation xs ys 1 |> should equal (None: double option)

[<Fact>]
let ``crossCorrelation with lag larger than series returns None`` () =
    let xs = [ 1.0; 2.0; 3.0 ]
    let ys = [ 1.0; 2.0; 3.0 ]
    TemporalCoordinationDetection.crossCorrelation xs ys 10 |> should equal (None: double option)


// ─── crossCorrelationProfile ─────────

[<Fact>]
let ``crossCorrelationProfile returns 2 maxLag + 1 entries`` () =
    let xs = [ 1.0; 2.0; 3.0; 4.0; 5.0; 6.0 ]
    let ys = [ 1.0; 2.0; 3.0; 4.0; 5.0; 6.0 ]
    let profile = TemporalCoordinationDetection.crossCorrelationProfile xs ys 2
    profile.Length |> should equal 5
    profile |> Array.map fst |> should equal [| -2; -1; 0; 1; 2 |]

[<Fact>]
let ``crossCorrelationProfile identical series peaks at lag 0`` () =
    // Zero-lag correlation of a series with itself is 1.0.
    let xs = [ 1.0; 2.0; 3.0; 4.0; 5.0; 6.0; 7.0; 8.0 ]
    let profile = TemporalCoordinationDetection.crossCorrelationProfile xs xs 3
    let zeroLagCorr =
        profile
        |> Array.find (fun (lag, _) -> lag = 0)
        |> snd
    zeroLagCorr
    |> Option.map (fun v -> Math.Round(v, 9))
    |> should equal (Some 1.0)

[<Fact>]
let ``crossCorrelationProfile with negative maxLag returns empty array`` () =
    let xs = [ 1.0; 2.0; 3.0 ]
    let ys = [ 1.0; 2.0; 3.0 ]
    TemporalCoordinationDetection.crossCorrelationProfile xs ys -1 |> should equal ([||]: (int * double option) array)
