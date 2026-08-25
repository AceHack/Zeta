module Zeta.Tests.Storage.ColumnZSetTests
#nowarn "0893"

open System
open System.Buffers
open System.Diagnostics
open System.Numerics
open FsUnit.Xunit
open global.Xunit
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


// ─── the checked-arithmetic guarantee survives vectorisation ─────────

[<Fact>]
let ``ColumnZSet vectorized sums raise on int64 overflow rather than wrapping`` () =
    // Every lane gets a huge positive weight, so whichever lane the vector
    // path accumulates into overflows. The scalar twin must agree.
    let weights = Array.create 64 (Int64.MaxValue / 4L)
    let span = ReadOnlySpan weights
    (fun () -> ColumnKernel.SumWeightsVectorized span |> ignore) |> should throw typeof<OverflowException>
    (fun () -> ColumnKernel.SumWeightsScalar span |> ignore) |> should throw typeof<OverflowException>


[<Fact>]
let ``ColumnZSet vectorized ranged sum raises on int64 overflow`` () =
    let keys = Array.init 64 int64
    let weights = Array.create 64 (Int64.MaxValue / 4L)
    let ks = ReadOnlySpan keys
    let ws = ReadOnlySpan weights
    (fun () -> ColumnKernel.SumWeightsWhereKeyInRangeVectorized(ks, ws, 0L, 64L) |> ignore)
    |> should throw typeof<OverflowException>


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
        Assert.True(
            speedup >= 1.5,
            $"vectorised predicate scan should be >= 1.5x the scalar scan on {n} unpredictable keys, "
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
    ColumnZSetArrow.ReadIpc(ReadOnlySpan [||]) |> ColumnZSet.isEmpty |> should equal true


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
