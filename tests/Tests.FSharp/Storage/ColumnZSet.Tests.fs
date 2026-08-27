module Zeta.Tests.Storage.ColumnZSetTests
#nowarn "0893"

open System
open System.Buffers
open System.Buffers.Binary
open System.Diagnostics
open System.Numerics
open FsUnit.Xunit
open global.Xunit
open Zeta.Tests.Support
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// ═ ColumnZSet — struct-of-arrays sibling of the row-store ZSet.
// ═
// ═ Two jobs here, and they are different kinds of check:
// ═   1. CORRECTNESS — every vectorised kernel has a scalar twin and the
// ═      two must agree on every input. This is a real falsifier: it fails
// ═      if either path is wrong.
// ═   2. VECTORISATION — a timing gate. The only honest way to show a
// ═      vector path is actually taken is to show it is faster, because a
// ═      correct scalar rewrite of it passes every correctness test by
// ═      construction. See the note above that test for what it can and
// ═      cannot prove.
// ═══════════════════════════════════════════════════════════════════


let private randomPairs (seed: int) (n: int) =
    let rng = Random seed
    [ for _ in 1 .. n -> int64 (rng.Next(0, 1_000_000)), int64 (rng.Next(-1000, 1000)) ]
    |> List.filter (fun (_, w) -> w <> 0L)


// ─── representation: shredding is lossless ──────────────────────────

[<Fact>]
let ``ColumnZSet round-trips through the row store unchanged`` () =
    for seed in 1 .. 12 do
        let z = ZSet.ofSeq (randomPairs seed (seed * 37))
        let c = ColumnZSet.ofZSet z
        c.Count |> should equal z.Count
        ColumnZSet.toZSet c |> should equal z


[<Fact>]
let ``ColumnZSet columns carry the row store's keys and weights in order`` () =
    let z = ZSet.ofSeq (randomPairs 99 500)
    let c = ColumnZSet.ofZSet z
    let rows = z.AsSpan()
    let keys = c.KeySpan()
    let weights = c.WeightSpan()
    keys.Length |> should equal rows.Length
    for i in 0 .. rows.Length - 1 do
        keys.[i] |> should equal rows.[i].Key
        weights.[i] |> should equal rows.[i].Weight


[<Fact>]
let ``ColumnZSet empty is empty in both directions`` () =
    ColumnZSet.empty.IsEmpty |> should equal true
    ColumnZSet.empty.Count |> should equal 0
    ColumnZSet.ofZSet ZSet<int64>.Empty |> ColumnZSet.toZSet |> should equal ZSet<int64>.Empty
    ColumnZSet.weightedCount ColumnZSet.empty |> should equal 0L


// ─── correctness: each vector kernel agrees with its scalar twin ──────
//
// Sizes deliberately straddle the vector width so the head/tail remainder
// handling is exercised: a kernel that only handles whole vectors passes at
// n = 64 and fails at n = 65.

[<Fact>]
let ``ColumnZSet vectorized weight sum equals the scalar sum`` () =
    for n in [ 0; 1; 2; 3; 7; 8; 9; 63; 64; 65; 1000; 4097 ] do
        let rng = Random(n + 5)
        let weights = Array.init n (fun _ -> int64 (rng.Next(-10000, 10000)))
        let span = ReadOnlySpan weights
        ColumnKernel.SumWeightsVectorized span
        |> should equal (ColumnKernel.SumWeightsScalar span)


[<Fact>]
let ``ColumnZSet vectorized range count equals the scalar range count`` () =
    for n in [ 0; 1; 2; 3; 7; 8; 9; 63; 64; 65; 1000; 4097 ] do
        let rng = Random(n + 11)
        let keys = Array.init n (fun _ -> int64 (rng.Next(0, 1000))) |> Array.sort
        let span = ReadOnlySpan keys
        for (lo, hi) in [ 0L, 1000L; 250L, 750L; 0L, 0L; 999L, 1000L; -5L, 5L; 2000L, 3000L ] do
            ColumnKernel.CountWhereKeyInRangeVectorized(span, lo, hi)
            |> should equal (ColumnKernel.CountWhereKeyInRangeScalar(span, lo, hi))


[<Fact>]
let ``ColumnZSet vectorized ranged weight sum equals the scalar ranged sum`` () =
    for n in [ 0; 1; 2; 3; 7; 8; 9; 63; 64; 65; 1000; 4097 ] do
        let rng = Random(n + 23)
        let keys = Array.init n (fun _ -> int64 (rng.Next(0, 1000))) |> Array.sort
        let weights = Array.init n (fun _ -> int64 (rng.Next(-10000, 10000)))
        let ks = ReadOnlySpan keys
        let ws = ReadOnlySpan weights
        for (lo, hi) in [ 0L, 1000L; 250L, 750L; 0L, 0L; 999L, 1000L; 2000L, 3000L ] do
            ColumnKernel.SumWeightsWhereKeyInRangeVectorized(ks, ws, lo, hi)
            |> should equal (ColumnKernel.SumWeightsWhereKeyInRangeScalar(ks, ws, lo, hi))


[<Fact>]
let ``ColumnZSet weightedCount agrees with the row store's weightedCount`` () =
    for seed in 1 .. 10 do
        let z = ZSet.ofSeq (randomPairs seed (seed * 53))
        ColumnZSet.weightedCount (ColumnZSet.ofZSet z)
        |> should equal (ZSet.weightedCount z)


[<Fact>]
let ``ColumnZSet range predicates agree with a row-store scan`` () =
    let z = ZSet.ofSeq (randomPairs 7 3000)
    let c = ColumnZSet.ofZSet z
    let rows = z.AsSpan().ToArray()
    for (lo, hi) in [ 0L, 1_000_000L; 250_000L, 750_000L; 0L, 1L; 999_999L, 1_000_000L ] do
        let expectedCount = rows |> Array.filter (fun e -> e.Key >= lo && e.Key < hi) |> Array.length
        let expectedSum =
            rows |> Array.filter (fun e -> e.Key >= lo && e.Key < hi) |> Array.sumBy (fun e -> e.Weight)
        ColumnZSet.countKeysInRange lo hi c |> should equal expectedCount
        ColumnZSet.weightedCountInRange lo hi c |> should equal expectedSum


// ─── overflow: EXACT, and identical on every vector width ───────────
//
// The first version of these kernels checked overflow per lane and diverged
// from its scalar twin in BOTH directions -- and the divergence depended on
// Vector<int64>.Count, so the same bytes threw on NEON and returned 0 on AVX2.
// These witnesses are the ones that caught it; they are pinned so it cannot
// come back. Nothing in the rest of the suite reaches this magnitude class.

[<Fact>]
let ``ColumnZSet sums are exact where partial sums would wrap`` () =
    let mx = Int64.MaxValue
    let mn = Int64.MinValue
    // Every one of these has a true sum that FITS in int64, reached only by
    // passing through a partial sum that does not. Neither path may raise.
    for (name, weights, expected) in
        [ "[MX; MX; -MX; -MX]", [| mx; mx; -mx; -mx |], 0L
          "[MX; -MX; MX; -MX]", [| mx; -mx; mx; -mx |], 0L
          "[MX/2+1; MX/2+1; -MX; 0]", [| mx / 2L + 1L; mx / 2L + 1L; -mx; 0L |], 1L
          "[MN; MN; MX; MX]", [| mn; mn; mx; mx |], -2L ] do
        let scalar = ColumnKernel.SumWeightsScalar(ReadOnlySpan weights)
        let vector = ColumnKernel.SumWeightsVectorized(ReadOnlySpan weights)
        Assert.True((scalar = expected), $"{name}: scalar gave {scalar}, expected {expected}")
        Assert.True((vector = expected), $"{name}: vector gave {vector}, expected {expected}")


[<Fact>]
let ``ColumnZSet sums still raise when the TRUE sum exceeds int64`` () =
    // The exactness above must not have cost the no-silent-wraparound guarantee.
    for weights in
        [ Array.create 64 (Int64.MaxValue / 4L)
          [| Int64.MinValue; -1L |]
          [| Int64.MaxValue; 1L |]
          [| Int64.MinValue; Int64.MinValue |] ] do
        (fun () -> ColumnKernel.SumWeightsScalar(ReadOnlySpan weights) |> ignore)
        |> should throw typeof<OverflowException>
        (fun () -> ColumnKernel.SumWeightsVectorized(ReadOnlySpan weights) |> ignore)
        |> should throw typeof<OverflowException>


/// The exact witness for the chunk-narrowing bug: two 4 096-element chunks
/// that individually blow past int64 in opposite directions, whose true sum is
/// 0. Any implementation that narrows per chunk raises here.
[<Fact>]
let ``ColumnZSet ranged sum spanning chunks is exact when chunks individually overflow`` () =
    let half = 4096
    let big = Int64.MaxValue / 2L
    let n = half * 2
    let keys = Array.init n int64
    let weights = Array.init n (fun i -> if i < half then big else -big)
    let expected = 0L
    ColumnKernel.SumWeightsWhereKeyInRangeScalar(
        ReadOnlySpan keys, ReadOnlySpan weights, 0L, int64 n)
    |> should equal expected
    ColumnKernel.SumWeightsWhereKeyInRangeVectorized(
        ReadOnlySpan keys, ReadOnlySpan weights, 0L, int64 n)
    |> should equal expected
    // Same shape for the unpredicated sum.
    ColumnKernel.SumWeightsScalar(ReadOnlySpan weights) |> should equal expected
    ColumnKernel.SumWeightsVectorized(ReadOnlySpan weights) |> should equal expected


[<Fact>]
let ``ColumnZSet ranged sums are exact and raise identically`` () =
    let mx = Int64.MaxValue
    let keys = [| 0L; 1L; 2L; 3L |]
    for (weights, expected) in
        [ [| mx; -mx; mx; -mx |], Some 0L
          [| mx; mx; -mx; -mx |], Some 0L
          [| mx; mx; mx; mx |], None ] do
        let run (f: unit -> int64) = try Some(f ()) with :? OverflowException -> None
        let scalar =
            run (fun () ->
                ColumnKernel.SumWeightsWhereKeyInRangeScalar(
                    ReadOnlySpan keys, ReadOnlySpan weights, 0L, 4L))
        let vector =
            run (fun () ->
                ColumnKernel.SumWeightsWhereKeyInRangeVectorized(
                    ReadOnlySpan keys, ReadOnlySpan weights, 0L, 4L))
        scalar |> should equal expected
        vector |> should equal expected


/// Differential test over the magnitude class the fixed-seed tests never
/// reach. Weights are drawn deliberately from {near MaxValue, near MinValue,
/// tiny, MaxValue/k} so that partial sums wrap constantly — that is the only
/// region where the two paths could disagree, and the contract says they never
/// do, on either the value or the raise.
///
/// `n` deliberately spans the 4 096-element CHUNK boundary of the vectorised
/// kernels. An earlier version of this test capped n at 40 — one chunk — and
/// therefore could not see a real bug where the wrapping-lane fallback
/// narrowed each chunk to int64 and raised whenever a single chunk exceeded
/// int64, even though the whole sum fit. Multi-chunk coverage is the point.
[<Fact>]
let ``ColumnZSet scalar and vector sums agree under extreme magnitudes`` () =
    let mx = Int64.MaxValue
    let mn = Int64.MinValue
    let rng = Random 99
    let run (f: unit -> int64) = try Ok(f ()) with :? OverflowException -> Error "overflow"
    let mutable disagreements = 0
    for trial in 1 .. 5000 do
        // Mostly small, but every 50th trial straddles the chunk boundary.
        let n = if trial % 50 = 0 then rng.Next(4000, 9000) else rng.Next(0, 40)
        let weights =
            Array.init n (fun _ ->
                match rng.Next 4 with
                | 0 -> mx - int64 (rng.Next 4)
                | 1 -> mn + int64 (rng.Next 4)
                | 2 -> int64 (rng.Next(-5, 5))
                | _ -> (if rng.Next 2 = 0 then 1L else -1L) * (mx / int64 (rng.Next(1, 5))))
        let scalar = run (fun () -> ColumnKernel.SumWeightsScalar(ReadOnlySpan weights))
        let vector = run (fun () -> ColumnKernel.SumWeightsVectorized(ReadOnlySpan weights))
        if scalar <> vector then disagreements <- disagreements + 1
    disagreements |> should equal 0


// ─── the vectorisation falsifier ────────────────────────────────────
//
// WHAT THIS PROVES: that `CountWhereKeyInRangeVectorized` is materially
// faster than the scalar twin on data whose branches cannot be predicted.
// Replace its body with the scalar loop and this test fails (the ratio goes
// to ~1.0); that is the regression it is here to catch.
//
// WHAT IT DOES NOT PROVE: that any particular instruction was emitted. There
// is no supported way to assert on JIT output from a unit test, so a timing
// gate is the honest instrument, and it is a weak one — it is stated as such
// rather than dressed up.
//
// Measured on an Apple M2 Ultra (arm64/NEON, 2 lanes): 10.8x. The gate is set
// at 1.5x, ~7x below the measurement, so it discriminates a bypassed vector
// path (1.0x) without being a flake risk on a loaded CI runner. Each path is
// timed best-of-9 with the rounds interleaved, so thermal drift hits both.

[<Fact>]
let ``ColumnZSet vectorized predicate scan is measurably faster than the scalar scan`` () =
    if not ColumnKernel.IsAccelerated then
        // No hardware vectors: the kernels are still correct (covered above),
        // there is simply no speed claim to check. Skipping is honest here;
        // asserting a speedup that the machine cannot deliver would not be.
        ()
    else
        let n = 1_000_000
        let rng = Random 4242
        let keys = Array.init n (fun _ -> int64 (rng.Next(0, 1_000_000)))
        let lo, hi = 250_000L, 750_000L
        let scalarRun () =
            ColumnKernel.CountWhereKeyInRangeScalar(ReadOnlySpan keys, lo, hi)
        let vectorRun () =
            ColumnKernel.CountWhereKeyInRangeVectorized(ReadOnlySpan keys, lo, hi)

        // Agreement first — a fast wrong answer is not a speedup.
        vectorRun () |> should equal (scalarRun ())

        // Warm up / tier up both paths before timing either.
        let mutable sink = 0
        for _ in 1 .. 5 do
            sink <- sink + scalarRun ()
            sink <- sink + vectorRun ()

        let mutable bestScalar = Double.MaxValue
        let mutable bestVector = Double.MaxValue
        for _ in 1 .. 9 do
            let sw = Stopwatch.StartNew()
            sink <- sink + scalarRun ()
            sw.Stop()
            bestScalar <- min bestScalar sw.Elapsed.TotalMilliseconds
            let sw2 = Stopwatch.StartNew()
            sink <- sink + vectorRun ()
            sw2.Stop()
            bestVector <- min bestVector sw2.Elapsed.TotalMilliseconds
        sink |> should be (greaterThan 0)

        let speedup = bestScalar / bestVector
        // Emitted BEFORE the assertion, and on both outcomes — see the note in ColumnLinearOps.
        // This gate is a bare literal rather than a per-config `gate` binding, so the literal is
        // passed to both the ledger and the assertion from ONE place: they cannot drift apart.
        let gate = 1.5
        PerfObservation.emit
            "Zeta.Tests.Storage.ColumnZSetTests.ColumnZSet vectorized predicate scan is measurably faster than the scalar scan"
            "speedup" speedup gate (speedup >= gate)
        Assert.True(
            speedup >= gate,
            $"vectorised predicate scan should be >= {gate}x the scalar scan on {n} unpredictable keys, "
            + $"measured {speedup:F2}x (scalar {bestScalar:F3} ms, vector {bestVector:F3} ms, "
            + $"Vector<int64>.Count = {ColumnKernel.VectorWidth}). A ratio near 1.0 means the vector "
            + "path is no longer vectorised.")


// ─── Arrow ──────────────────────────────────────────────────────────

[<Fact>]
let ``ColumnZSet round-trips through Arrow IPC`` () =
    for seed in 1 .. 8 do
        let z = ZSet.ofSeq (randomPairs seed (seed * 61))
        let c = ColumnZSet.ofZSet z
        let bytes = ColumnZSetArrow.WriteIpc c
        let back = ColumnZSetArrow.ReadIpc(ReadOnlySpan bytes)
        back.Count |> should equal c.Count
        ColumnZSet.toZSet back |> should equal z


[<Fact>]
let ``ColumnZSet Arrow round-trip preserves negative weights`` () =
    // Retraction-native: a Z-set is not a multiset, and a serializer that
    // quietly drops or clamps negative weights would pass a positives-only test.
    let z = ZSet.ofSeq [ 1L, -5L; 2L, 7L; 3L, -1L; 4L, Int64.MinValue + 1L ]
    let c = ColumnZSet.ofZSet z
    ColumnZSetArrow.ReadIpc(ReadOnlySpan(ColumnZSetArrow.WriteIpc c))
    |> ColumnZSet.toZSet
    |> should equal z


[<Fact>]
let ``ColumnZSet Arrow round-trips the empty Z-set`` () =
    let bytes = ColumnZSetArrow.WriteIpc ColumnZSet.empty
    ColumnZSetArrow.ReadIpc(ReadOnlySpan bytes) |> ColumnZSet.isEmpty |> should equal true
    // A zero-length span means "nothing was written" -- the one benign case.
    ColumnZSetArrow.ReadIpc(ReadOnlySpan [||]) |> ColumnZSet.isEmpty |> should equal true


[<Fact>]
let ``ColumnZSet Arrow REFUSES malformed bytes instead of reading them as empty`` () =
    // Returning Empty here would make a corrupt checkpoint indistinguishable
    // from a legitimately empty one: a silent failure that reads as success.
    let good = ColumnZSetArrow.WriteIpc(ColumnZSet.ofZSet (ZSet.ofSeq [ 1L, 2L; 3L, 4L ]))
    (fun () -> ColumnZSetArrow.ReadIpc(ReadOnlySpan [| 1uy; 2uy |]) |> ignore)
    |> should throw typeof<IO.InvalidDataException>          // shorter than the header
    (fun () -> ColumnZSetArrow.ReadIpc(ReadOnlySpan(Array.sub good 0 12)) |> ignore)
    |> should throw typeof<IO.InvalidDataException>          // truncated payload
    let negLen = Array.copy good
    BinaryPrimitives.WriteInt32LittleEndian(Span<byte>(negLen, 0, 4), -5)
    (fun () -> ColumnZSetArrow.ReadIpc(ReadOnlySpan negLen) |> ignore)
    |> should throw typeof<IO.InvalidDataException>          // negative declared length


[<Fact>]
let ``ColumnZSet Arrow REFUSES a batch that violates the Z-set invariant`` () =
    // The ColumnZSet ctor documents that the CALLER owns "keys strictly
    // ascending, weights non-zero". OfRecordBatch is where untrusted bytes
    // cross that line, so it is where the invariant is enforced -- otherwise
    // toZSet hands the engine a ZSet whose binary search silently lies.
    let batchOf (keys: int64 array) (weights: int64 array) =
        ColumnZSetArrow.ToRecordBatch(
            ColumnZSet(Pool.Freeze(Array.copy keys), Pool.Freeze(Array.copy weights)))
    use unsorted = batchOf [| 5L; 1L |] [| 1L; 1L |]
    (fun () -> ColumnZSetArrow.OfRecordBatch unsorted |> ignore) |> should throw typeof<ArgumentException>
    use duplicate = batchOf [| 2L; 2L |] [| 1L; 1L |]
    (fun () -> ColumnZSetArrow.OfRecordBatch duplicate |> ignore) |> should throw typeof<ArgumentException>
    use zeroWeight = batchOf [| 1L; 2L |] [| 1L; 0L |]
    (fun () -> ColumnZSetArrow.OfRecordBatch zeroWeight |> ignore) |> should throw typeof<ArgumentException>


[<Fact>]
let ``ColumnZSet refuses columns of unequal length`` () =
    // Mismatched columns do not fail here; without this check they fail much
    // later, deep inside a kernel Slice, or truncate silently.
    (fun () -> ColumnZSet(Pool.Freeze [| 1L; 2L |], Pool.Freeze [| 1L |]) |> ignore)
    |> should throw typeof<ArgumentException>


/// The strongest Arrow check available without a second Arrow library: the
/// **buffer** path (`ColumnZSetArrow`, column store, no builder) and the
/// **builder** path (`ArrowInt64Serializer`, row store) are two independent
/// Zeta implementations, and each must read what the other wrote. That is a
/// genuine cross-implementation check at the Zeta level.
///
/// It is NOT a cross-*library* check: both call `Apache.Arrow` 23.0.0, so it
/// says nothing about pyarrow or arrow-rs interop. See the `ColumnZSetArrow`
/// header for what closing that gap would take.
[<Fact>]
let ``ColumnZSet Arrow buffer path and the row-store builder path read each other`` () =
    let z = ZSet.ofSeq (randomPairs 31 400)
    let rowSerializer = ArrowInt64Serializer() :> ISerializer<int64>

    // builder path writes → buffer path reads
    let buffer = ArrayBufferWriter<byte>()
    rowSerializer.Write(buffer, z)
    ColumnZSetArrow.ReadIpc(buffer.WrittenSpan) |> ColumnZSet.toZSet |> should equal z

    // buffer path writes → builder path reads
    let bytes = ColumnZSetArrow.WriteIpc(ColumnZSet.ofZSet z)
    rowSerializer.Read(ReadOnlySpan bytes) |> should equal z
