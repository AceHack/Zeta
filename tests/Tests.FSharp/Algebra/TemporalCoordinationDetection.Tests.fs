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


// ─── phaseLockingValue ─────────

[<Fact>]
let ``phaseLockingValue of identical phase series is 1`` () =
    let phases = [ 0.0; 0.5; 1.0; 1.5; 2.0 ]
    TemporalCoordinationDetection.phaseLockingValue phases phases
    |> Option.map (fun v -> Math.Round(v, 9))
    |> should equal (Some 1.0)

[<Fact>]
let ``phaseLockingValue with constant phase offset is 1 (perfect locking)`` () =
    // Constant offset of pi/4 — the complex phase-difference
    // vector is the same unit vector every step, so magnitude = 1.
    let a = [ 0.0; 0.3; 0.6; 0.9; 1.2 ]
    let offset = Math.PI / 4.0
    let b = a |> List.map (fun x -> x + offset)
    TemporalCoordinationDetection.phaseLockingValue a b
    |> Option.map (fun v -> Math.Round(v, 9))
    |> should equal (Some 1.0)

[<Fact>]
let ``phaseLockingValue of empty series is None`` () =
    TemporalCoordinationDetection.phaseLockingValue [] [] |> should equal (None: double option)

[<Fact>]
let ``phaseLockingValue on mismatched-length series is None`` () =
    // PLV is undefined for mismatched pairs. Silently truncating
    // would mask a caller bug; None surfaces it.
    let a = [ 0.0; 0.5; 1.0 ]
    let b = [ 0.0; 0.5 ]
    TemporalCoordinationDetection.phaseLockingValue a b |> should equal (None: double option)

[<Fact>]
let ``phaseLockingValue of anti-phase series is 1 (locking at pi offset)`` () =
    // Two phase series that differ by exactly pi every step are
    // perfectly anti-phase-locked; PLV measures the magnitude of
    // the mean complex vector, which is 1 when the offset is
    // constant (regardless of offset value).
    let a = [ 0.0; 0.5; 1.0; 1.5 ]
    let b = a |> List.map (fun x -> x + Math.PI)
    TemporalCoordinationDetection.phaseLockingValue a b
    |> Option.map (fun v -> Math.Round(v, 9))
    |> should equal (Some 1.0)

[<Fact>]
let ``phaseLockingValue of uniformly-distributed differences is near 0`` () =
    // Evenly-spaced phase differences spanning [0, 2*pi); the
    // complex vectors sum to approximately zero by symmetry.
    // Large N for the cancellation to be numerically clean.
    let n = 360
    let a = [ for _ in 0 .. n - 1 -> 0.0 ]
    let b = [ for i in 0 .. n - 1 -> 2.0 * Math.PI * double i / double n ]
    let plv =
        TemporalCoordinationDetection.phaseLockingValue a b
        |> Option.defaultValue -1.0
    plv |> should (be lessThan) 1e-9

[<Fact>]
let ``phaseLockingValue is commutative`` () =
    // Swapping arguments flips the sign of every phase difference,
    // which negates sin but leaves cos unchanged; the magnitude of
    // the mean complex vector is invariant.
    let a = [ 0.0; 0.4; 0.8; 1.2; 1.6 ]
    let b = [ 0.1; 0.3; 0.7; 1.4; 1.5 ]
    let ab = TemporalCoordinationDetection.phaseLockingValue a b
    let ba = TemporalCoordinationDetection.phaseLockingValue b a
    ab |> Option.map (fun v -> Math.Round(v, 12))
    |> should equal (ba |> Option.map (fun v -> Math.Round(v, 12)))

[<Fact>]
let ``phaseLockingValue handles single-element series`` () =
    // N=1 is a degenerate case: the single complex vector has
    // magnitude 1 regardless of phase. Not useful as a detector
    // at that size (no statistical power), but the function
    // must not crash and must return a defined value.
    let a = [ 0.0 ]
    let b = [ 0.0 ]
    TemporalCoordinationDetection.phaseLockingValue a b
    |> Option.map (fun v -> Math.Round(v, 9))
    |> should equal (Some 1.0)

// ─── meanPhaseOffset ─────────

[<Fact>]
let ``meanPhaseOffset of identical phase series is 0`` () =
    let phases = [ 0.0; 0.5; 1.0; 1.5; 2.0 ]
    TemporalCoordinationDetection.meanPhaseOffset phases phases
    |> Option.map (fun v -> Math.Round(v, 9))
    |> should equal (Some 0.0)

[<Fact>]
let ``meanPhaseOffset with constant pi/4 offset returns -pi/4`` () =
    // b = a + pi/4, so phase difference a - b = -pi/4.
    // atan2 reads the mean vector angle; the sign is the
    // *difference* direction, consistent with PLV's
    // a-minus-b convention.
    let a = [ 0.0; 0.3; 0.6; 0.9; 1.2 ]
    let offset = Math.PI / 4.0
    let b = a |> List.map (fun x -> x + offset)
    TemporalCoordinationDetection.meanPhaseOffset a b
    |> Option.map (fun v -> Math.Round(v, 9))
    |> should equal (Some (Math.Round(-offset, 9)))

[<Fact>]
let ``meanPhaseOffset distinguishes anti-phase from in-phase`` () =
    // This is the 18th-ferry correction #6 regression test.
    // Two series with pi offset have PLV = 1 (perfectly
    // locked), but the offset tells us they are ANTI-phase,
    // not same-time. Downstream detectors that rely on
    // PLV = 1 => synchronized would misclassify this.
    let a = [ 0.0; 0.5; 1.0; 1.5 ]
    let b = a |> List.map (fun x -> x + Math.PI)
    let antiPhaseOffset =
        TemporalCoordinationDetection.meanPhaseOffset a b
        |> Option.defaultValue 0.0
    // a - b = -pi for every element; atan2(0, -1) = pi
    Math.Round(abs antiPhaseOffset, 6) |> should equal (Math.Round(Math.PI, 6))

    // Same-time locking has offset near 0 — contrast case
    let c = a |> List.map id
    TemporalCoordinationDetection.meanPhaseOffset a c
    |> Option.map (fun v -> Math.Round(v, 9))
    |> should equal (Some 0.0)

[<Fact>]
let ``meanPhaseOffset is None when mean vector has zero magnitude`` () =
    // Uniformly-distributed phase differences sum to the
    // zero vector; direction is undefined, so None.
    let n = 360
    let a = [ for _ in 0 .. n - 1 -> 0.0 ]
    let b = [ for i in 0 .. n - 1 -> 2.0 * Math.PI * double i / double n ]
    TemporalCoordinationDetection.meanPhaseOffset a b
    |> should equal (None: double option)

[<Fact>]
let ``meanPhaseOffset of empty series is None`` () =
    TemporalCoordinationDetection.meanPhaseOffset [] []
    |> should equal (None: double option)

[<Fact>]
let ``meanPhaseOffset on mismatched-length series is None`` () =
    let a = [ 0.0; 0.5; 1.0 ]
    let b = [ 0.0; 0.5 ]
    TemporalCoordinationDetection.meanPhaseOffset a b
    |> should equal (None: double option)

// ─── phaseLockingWithOffset ─────────

[<Fact>]
let ``phaseLockingWithOffset returns magnitude and offset together`` () =
    let a = [ 0.0; 0.3; 0.6; 0.9; 1.2 ]
    let offset = Math.PI / 6.0
    let b = a |> List.map (fun x -> x + offset)
    match TemporalCoordinationDetection.phaseLockingWithOffset a b with
    | Some (struct (magnitude, observedOffset)) ->
        Math.Round(magnitude, 9) |> should equal 1.0
        Math.Round(observedOffset, 9) |> should equal (Math.Round(-offset, 9))
    | None ->
        failwith "expected Some tuple"

[<Fact>]
let ``phaseLockingWithOffset magnitude matches phaseLockingValue`` () =
    // Consistency property: the magnitude field must be
    // identical (within FP rounding) to the standalone
    // phaseLockingValue result. If the two primitives
    // disagree, downstream score vectors will silently
    // carry inconsistent values depending on which primitive
    // the caller happened to invoke.
    let a = [ 0.1; 0.4; 0.9; 1.3; 1.7 ]
    let b = [ 0.2; 0.5; 0.95; 1.4; 1.8 ]
    // Explicit pattern-match + fail on None rather than
    // using sentinel -1.0 with Option.defaultValue. Prior
    // sentinel form would silently pass the equality
    // assertion if BOTH primitives returned None, masking
    // a real regression. Per reviewer thread 59WGi9:
    // report the actual regression, don't paper over it.
    match TemporalCoordinationDetection.phaseLockingWithOffset a b,
          TemporalCoordinationDetection.phaseLockingValue a b with
    | Some (struct (magnitudeFromPair, _)), Some magnitudeFromPlv ->
        Math.Round(magnitudeFromPair, 12)
        |> should equal (Math.Round(magnitudeFromPlv, 12))
    | None, _ ->
        failwith "phaseLockingWithOffset returned None on valid input"
    | _, None ->
        failwith "phaseLockingValue returned None on valid input"

[<Fact>]
let ``phaseLockingWithOffset flags zero-magnitude with nan offset`` () =
    // Zero-magnitude mean vector: magnitude near 0, offset = nan.
    // Caller's reliable "offset is undefined" signal is the
    // near-zero magnitude, not the nan per se.
    let n = 360
    let a = [ for _ in 0 .. n - 1 -> 0.0 ]
    let b = [ for i in 0 .. n - 1 -> 2.0 * Math.PI * double i / double n ]
    match TemporalCoordinationDetection.phaseLockingWithOffset a b with
    | Some (struct (magnitude, offset)) ->
        magnitude |> should (be lessThan) 1e-9
        System.Double.IsNaN(offset) |> should equal true
    | None ->
        failwith "expected Some tuple with nan offset on zero-magnitude mean"

[<Fact>]
let ``phaseLockingWithOffset returns None on empty or mismatched inputs`` () =
    TemporalCoordinationDetection.phaseLockingWithOffset [] []
    |> should equal (None: struct (double * double) option)
    TemporalCoordinationDetection.phaseLockingWithOffset [ 0.0 ] [ 0.0; 1.0 ]
    |> should equal (None: struct (double * double) option)

// ─── significantLags ─────────

[<Fact>]
let ``significantLags picks only above-threshold entries`` () =
    let profile =
        [| (-2, Some 0.2)
           (-1, Some 0.5)
           ( 0, Some 0.9)
           ( 1, Some 0.8)
           ( 2, Some 0.1) |]
    TemporalCoordinationDetection.significantLags profile 0.7
    |> should equal [| 0; 1 |]

[<Fact>]
let ``significantLags picks strong negative correlation by absolute value`` () =
    // Perfect anti-correlation at lag 0 is coordination, just
    // inverse. |corr| = 1 >= threshold.
    let profile =
        [| (-1, Some 0.1)
           ( 0, Some -0.95)
           ( 1, Some 0.1) |]
    TemporalCoordinationDetection.significantLags profile 0.8
    |> should equal [| 0 |]

[<Fact>]
let ``significantLags skips None entries`` () =
    // None correlations are undefined; never count as significant.
    let profile =
        [| (-1, None)
           ( 0, Some 0.99)
           ( 1, None) |]
    TemporalCoordinationDetection.significantLags profile 0.5
    |> should equal [| 0 |]

[<Fact>]
let ``significantLags returns empty when threshold above all values`` () =
    let profile =
        [| (-1, Some 0.3); (0, Some 0.4); (1, Some 0.2) |]
    TemporalCoordinationDetection.significantLags profile 0.95
    |> should equal ([||]: int array)


// ─── burstAlignment ─────────

[<Fact>]
let ``burstAlignment groups contiguous lags into single run`` () =
    let profile =
        [| (-2, Some 0.2); (-1, Some 0.9); (0, Some 0.95); (1, Some 0.85); (2, Some 0.1) |]
    TemporalCoordinationDetection.burstAlignment profile 0.7
    |> should equal [| (-1, 1) |]

[<Fact>]
let ``burstAlignment separates non-contiguous significant lags into distinct runs`` () =
    let profile =
        [| (-3, Some 0.9); (-2, Some 0.2); (-1, Some 0.1); (0, Some 0.85); (1, Some 0.9); (2, Some 0.3) |]
    TemporalCoordinationDetection.burstAlignment profile 0.7
    |> should equal [| (-3, -3); (0, 1) |]

[<Fact>]
let ``burstAlignment returns empty when no significant lags`` () =
    let profile =
        [| (-1, Some 0.2); (0, Some 0.3); (1, Some 0.2) |]
    TemporalCoordinationDetection.burstAlignment profile 0.9
    |> should equal ([||]: (int * int) array)

[<Fact>]
let ``burstAlignment handles a single significant lag as isolated run`` () =
    let profile = [| (5, Some 0.99) |]
    TemporalCoordinationDetection.burstAlignment profile 0.8
    |> should equal [| (5, 5) |]

[<Fact>]
let ``burstAlignment ignores None entries when forming runs`` () =
    // (-1, None) breaks contiguity between -2 and 0 even if they're
    // both significant — significantLags discards None entries, so
    // the run-detector sees only lags [-2; 0] which are not
    // consecutive, producing two separate runs.
    let profile =
        [| (-2, Some 0.9); (-1, None); (0, Some 0.9) |]
    TemporalCoordinationDetection.burstAlignment profile 0.7
    |> should equal [| (-2, -2); (0, 0) |]
