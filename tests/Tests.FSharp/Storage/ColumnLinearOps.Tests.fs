module Zeta.Tests.Storage.ColumnLinearOpsTests
#nowarn "0893"

open System
open System.Buffers
open System.Diagnostics
open System.Numerics
open FsUnit.Xunit
open global.Xunit
open Zeta.Tests.Support
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// ═ Vectorised Where / Select over ColumnZSet columns.
// ═
// ═ Four kinds of check here, and they prove different things:
// ═   1. CORRECTNESS  — vector kernel vs scalar twin, on every input,
// ═      with `n` crossing the 64-element BLOCK boundary. A real falsifier.
// ═   2. LINEARITY    — filter/map over an arbitrary PARTITION of the span,
// ═      concatenated, equals the whole-span result. This is the DoP=1→N
// ═      licence: it is why a ferry may shard these kernels across cores
// ═      and still get the DoP=1 answer. Discharged algebraically; nothing
// ═      is spawned, so nothing here can be nondeterministic under DST.
// ═   3. ALLOCATION   — GC.GetAllocatedBytesForCurrentThread() = 0 for the
// ═      kernels, and for a Where→Select PIPELINE over pooled buffers.
// ═      Composition is tested, not only the pieces: two zero-allocation
// ═      stages that allocate between them would defeat the whole design.
// ═   4. VECTORISATION — a timing gate. Correctness tests structurally
// ═      cannot detect a bypassed vector path, because a scalar rewrite
// ═      passes all of them by construction. See the note above that test.
// ═══════════════════════════════════════════════════════════════════


/// Sizes that straddle BOTH boundaries that matter: the vector width (2 on
/// NEON, 4 on AVX2, 8 on AVX-512) and the 64-element bitmask block. A kernel
/// that only handles whole blocks passes at 64/128 and fails at 65/191.
///
/// PR #15246's differential test capped `n` at 40 — one chunk — and therefore
/// could not see a real chunk-boundary defect. That is why 65, 127, 128, 129,
/// 191 and 4097 are all here rather than a single round number.
let private sizes = [ 0; 1; 2; 3; 7; 8; 9; 63; 64; 65; 127; 128; 129; 191; 1000; 4097 ]


let private measureAlloc (warmup: int) (action: unit -> unit) : int64 =
    for _ in 1 .. warmup do action ()
    GC.Collect()
    GC.WaitForPendingFinalizers()
    GC.Collect()
    let before = GC.GetAllocatedBytesForCurrentThread()
    action ()
    GC.GetAllocatedBytesForCurrentThread() - before


// ───────────────────── WHERE: correctness ──────────────────────────

[<Fact>]
let ``ColumnLinear vectorized filter equals the scalar filter`` () =
    for n in sizes do
        let rng = Random(n + 17)
        let keys = Array.init n (fun _ -> int64 (rng.Next(0, 1000)))
        let weights = Array.init n (fun _ -> int64 (rng.Next(-10000, 10000)))
        let ks = ReadOnlySpan keys
        let ws = ReadOnlySpan weights
        // Ranges chosen to hit every selectivity regime the kernel special-cases:
        // empty (nothing survives), full (everything survives, bulk-copy path),
        // and the mixed middle (the trailing-zero-count compaction path).
        for (lo, hi) in
            [ 0L, 1000L        // full   — exercises the bits = MaxValue branch
              2000L, 3000L     // empty  — exercises the bits = 0 branch
              250L, 750L       // ~50%   — exercises the compaction loop
              0L, 10L          // ~1%    — mostly-empty words
              10L, 1000L       // ~99%   — mostly-full words
              0L, 0L ] do      // degenerate empty range
            let sk = Array.zeroCreate<int64> n
            let sw = Array.zeroCreate<int64> n
            let vk = Array.zeroCreate<int64> n
            let vw = Array.zeroCreate<int64> n
            let sn =
                ColumnLinearKernel.FilterKeyInRangeScalar(
                    ks, ws, lo, hi, Span<int64> sk, Span<int64> sw)
            let vn =
                ColumnLinearKernel.FilterKeyInRangeVectorized(
                    ks, ws, lo, hi, Span<int64> vk, Span<int64> vw)
            Assert.True(
                (sn = vn),
                $"n={n} [{lo},{hi}): scalar wrote {sn}, vector wrote {vn} "
                + $"(VectorWidth={ColumnLinearKernel.VectorWidth})")
            // Contents, not only the count — a kernel that returns the right
            // number of wrong rows is the failure this actually guards.
            Assert.Equal<int64 array>(Array.sub sk 0 sn, Array.sub vk 0 vn)
            Assert.Equal<int64 array>(Array.sub sw 0 sn, Array.sub vw 0 vn)


[<Fact>]
let ``ColumnLinear filter agrees with a naive Array filter`` () =
    // An INDEPENDENT oracle, not the scalar twin: if both kernels shared a
    // misreading of the half-open range convention, the differential test
    // above would pass and this one would not.
    let n = 5000
    let rng = Random 808
    let keys = Array.init n (fun _ -> int64 (rng.Next(0, 1000)))
    let weights = Array.init n (fun _ -> int64 (rng.Next(-100, 100)))
    for (lo, hi) in [ 0L, 1000L; 250L, 750L; 0L, 1L; 999L, 1000L; 5L, 5L ] do
        let expected =
            Array.zip keys weights |> Array.filter (fun (k, _) -> k >= lo && k < hi)
        let dk = Array.zeroCreate<int64> n
        let dw = Array.zeroCreate<int64> n
        let got =
            ColumnLinearKernel.FilterKeyInRange(
                ReadOnlySpan keys, ReadOnlySpan weights, lo, hi, Span<int64> dk, Span<int64> dw)
        got |> should equal expected.Length
        Assert.Equal<(int64 * int64) array>(
            expected, Array.zip (Array.sub dk 0 got) (Array.sub dw 0 got))


[<Fact>]
let ``ColumnLinear filter REFUSES a destination that cannot hold the worst case`` () =
    // Silent truncation here would be a wrong answer that reads as success —
    // the caller gets a short count and no indication rows were dropped.
    let keys = Array.init 100 int64
    let weights = Array.create 100 1L
    let small = Array.zeroCreate<int64> 99
    let ok = Array.zeroCreate<int64> 100
    (fun () ->
        ColumnLinearKernel.FilterKeyInRangeScalar(
            ReadOnlySpan keys, ReadOnlySpan weights, 0L, 1000L, Span<int64> small, Span<int64> ok)
        |> ignore)
    |> should throw typeof<ArgumentException>
    (fun () ->
        ColumnLinearKernel.FilterKeyInRangeVectorized(
            ReadOnlySpan keys, ReadOnlySpan weights, 0L, 1000L, Span<int64> ok, Span<int64> small)
        |> ignore)
    |> should throw typeof<ArgumentException>


[<Fact>]
let ``ColumnLinear filter refuses non-parallel columns`` () =
    let keys = Array.init 10 int64
    let weights = Array.create 9 1L
    let dk = Array.zeroCreate<int64> 10
    let dw = Array.zeroCreate<int64> 10
    (fun () ->
        ColumnLinearKernel.FilterKeyInRangeScalar(
            ReadOnlySpan keys, ReadOnlySpan weights, 0L, 5L, Span<int64> dk, Span<int64> dw)
        |> ignore)
    |> should throw typeof<ArgumentException>


// ───────────────────── SELECT: correctness ─────────────────────────

[<Fact>]
let ``ColumnLinear vectorized map (+) equals the scalar map`` () =
    for n in sizes do
        let rng = Random(n + 29)
        let src = Array.init n (fun _ -> int64 (rng.Next(-100000, 100000)))
        for delta in [ 0L; 1L; -1L; 1000L; -1000L; Int64.MaxValue; Int64.MinValue ] do
            let sd = Array.zeroCreate<int64> n
            let vd = Array.zeroCreate<int64> n
            let run f = try Ok(f (): unit) with :? OverflowException -> Error "overflow"
            let s = run (fun () -> ColumnLinearKernel.MapAddScalar(ReadOnlySpan src, delta, Span<int64> sd))
            let v = run (fun () -> ColumnLinearKernel.MapAddVectorized(ReadOnlySpan src, delta, Span<int64> vd))
            Assert.True((s = v), $"n={n} delta={delta}: scalar {s}, vector {v}")
            if s = Ok() then
                // COUNTED SELF-COMPARISON (check-arity census, R2). `sd` and `vd` have
                // IDENTICAL initialisers, so the audit's binding-inliner normalises both
                // sides to `Array.zeroCreate<int64> n`. What varies is not the expression
                // but WHICH KERNEL WROTE THE BUFFER: `sd` by the scalar twin, `vd` by the
                // vector kernel. That is the audit's "mutation-mediated" class -- the two
                // executions differ in what happened between them.
                // Earned, not asserted: mutating `MapAddVectorized` to write `x+delta+1`
                // fails this assertion. It is a live check, not a tautology.
                Assert.Equal<int64 array>(sd, vd)
                // INDEPENDENT ORACLE. The twin comparison alone cannot see a fault that
                // hits BOTH paths (a shared helper like `AddBounds`), and if neither path
                // wrote anything both buffers would be zeros and match. `Array.map` is a
                // third, unrelated implementation, so it constrains what the twins agree ON
                // and not merely that they agree. The filter tests already had such an
                // oracle; the map tests did not, which was an asymmetry rather than a choice.
                Assert.Equal<int64 array>(Array.map (fun x -> x + delta) src, sd)


[<Fact>]
let ``ColumnLinear vectorized map (*) equals the scalar map`` () =
    for n in sizes do
        let rng = Random(n + 31)
        let src = Array.init n (fun _ -> int64 (rng.Next(-100000, 100000)))
        for m in [ 0L; 1L; -1L; 2L; -2L; 1000L; Int64.MaxValue; Int64.MinValue ] do
            let sd = Array.zeroCreate<int64> n
            let vd = Array.zeroCreate<int64> n
            let run f = try Ok(f (): unit) with :? OverflowException -> Error "overflow"
            let s = run (fun () -> ColumnLinearKernel.MapScaleScalar(ReadOnlySpan src, m, Span<int64> sd))
            let v = run (fun () -> ColumnLinearKernel.MapScaleVectorized(ReadOnlySpan src, m, Span<int64> vd))
            Assert.True((s = v), $"n={n} m={m}: scalar {s}, vector {v}")
            if s = Ok() then
                // COUNTED SELF-COMPARISON (check-arity census, R2) -- same shape as the
                // `map (+)` test above. Both sides normalise to `Array.zeroCreate<int64> n`;
                // the varied dimension is WHICH KERNEL WROTE THE BUFFER (scalar twin vs
                // vector kernel), not the expression.
                // Earned: mutating `MapScaleVectorized` to write `x*m+1` fails this.
                Assert.Equal<int64 array>(sd, vd)
                // Independent oracle, for the same reason as above.
                Assert.Equal<int64 array>(Array.map (fun x -> x * m) src, sd)


/// The overflow contract, at the exact boundary in both directions and for
/// every multiplier whose BOUND COMPUTATION is itself a trap: `m = 0` divides
/// by zero and `m = -1` makes `Int64.MinValue / m` raise. Getting the bounds
/// wrong for those two would fault before the kernel ever ran.
[<Fact>]
let ``ColumnLinear map raises exactly at the int64 boundary`` () =
    let mx = Int64.MaxValue
    let mn = Int64.MinValue
    let over (f: unit -> unit) = try f (); false with :? OverflowException -> true
    let dest = Array.zeroCreate<int64> 8

    let mapAdd (src: int64 array) d =
        over (fun () -> ColumnLinearKernel.MapAddScalar(ReadOnlySpan src, d, Span<int64> dest))
    let mapAddV (src: int64 array) d =
        over (fun () -> ColumnLinearKernel.MapAddVectorized(ReadOnlySpan src, d, Span<int64> dest))
    let mapMul (src: int64 array) m =
        over (fun () -> ColumnLinearKernel.MapScaleScalar(ReadOnlySpan src, m, Span<int64> dest))
    let mapMulV (src: int64 array) m =
        over (fun () -> ColumnLinearKernel.MapScaleVectorized(ReadOnlySpan src, m, Span<int64> dest))

    // (+) — the last value that fits, and the first that does not.
    mapAdd [| mx - 1L |] 1L |> should equal false
    mapAdd [| mx |] 1L |> should equal true
    mapAdd [| mn + 1L |] -1L |> should equal false
    mapAdd [| mn |] -1L |> should equal true
    mapAdd [| 0L |] mn |> should equal false
    mapAdd [| -1L |] mn |> should equal true
    // Identity offsets never raise, for any input.
    mapAdd [| mx; mn; 0L |] 0L |> should equal false

    // (*) — including the two multipliers whose bounds computation faults naively.
    mapMul [| mx; mn |] 0L |> should equal false          // m = 0 : never overflows
    mapMul [| mx; mn + 1L |] -1L |> should equal false    // m = -1: all but MinValue
    mapMul [| mn |] -1L |> should equal true              // m = -1: MinValue alone
    mapMul [| mx / 2L |] 2L |> should equal false
    mapMul [| mx / 2L + 1L |] 2L |> should equal true
    mapMul [| mn / 2L |] 2L |> should equal false
    mapMul [| mn / 2L - 1L |] 2L |> should equal true
    mapMul [| 1L |] mn |> should equal false              // 1 * MinValue = MinValue
    mapMul [| -1L |] mn |> should equal true              // -1 * MinValue overflows

    // And the vector twins agree on every one of those, on this host's lane width.
    for (src, d) in [ [| mx - 1L |], 1L; [| mx |], 1L; [| mn |], -1L; [| 0L |], mn; [| -1L |], mn ] do
        mapAddV src d |> should equal (mapAdd src d)
    for (src, m) in
        [ [| mx; mn |], 0L; [| mn |], -1L; [| mx / 2L + 1L |], 2L; [| -1L |], mn; [| 1L |], mn ] do
        mapMulV src m |> should equal (mapMul src m)


/// The #15246 class, stated as a property rather than as a hope.
///
/// That P0 was a REDUCTION whose overflow check partitioned differently in the
/// two paths, so the answer depended on `Vector<int64>.Count` — the same bytes
/// threw on NEON and returned 0 on AVX2. `Where`/`Select` have no accumulator,
/// so lane width cannot reach the answer. This test is what makes that a
/// checked claim: the result is compared against a lane-width-independent
/// oracle over inputs whose alignment relative to both the vector width and
/// the 64-element block is deliberately varied.
[<Fact>]
let ``ColumnLinear results do not depend on lane width or block alignment`` () =
    let rng = Random 5150
    let baseN = 300
    let keys = Array.init baseN (fun _ -> int64 (rng.Next(0, 100)))
    let weights = Array.init baseN (fun _ -> int64 (rng.Next(-50, 50)))
    // Slice at every offset in [0, 64+width): every possible alignment of the
    // data relative to both the lane boundary and the block boundary.
    for off in 0 .. 64 + ColumnLinearKernel.VectorWidth do
        let k = Array.sub keys off (baseN - off)
        let w = Array.sub weights off (baseN - off)
        let n = k.Length
        let expected = Array.zip k w |> Array.filter (fun (key, _) -> key >= 25L && key < 75L)
        let dk = Array.zeroCreate<int64> n
        let dw = Array.zeroCreate<int64> n
        let got =
            ColumnLinearKernel.FilterKeyInRangeVectorized(
                ReadOnlySpan k, ReadOnlySpan w, 25L, 75L, Span<int64> dk, Span<int64> dw)
        Assert.Equal<(int64 * int64) array>(
            expected, Array.zip (Array.sub dk 0 got) (Array.sub dw 0 got))


// ───────────── LINEARITY: the DoP = 1 → N licence ──────────────────

/// **This is the parallelism proof, and it is algebraic on purpose.**
///
/// `QuerySurface.fs` tags `Where`/`Select` LINEAR — `Q(a ⊎ b) = Q(a) ⊎ Q(b)`.
/// A SIMD lane, a 64-element block, and a ferry shard are all *parts* of such
/// a decomposition, so if the property holds for an ARBITRARY partition then
/// sharding these kernels across a `MaxDegreeOfParallelism` knob returns the
/// DoP=1 answer by construction.
///
/// Discharged this way rather than by spawning threads deliberately: a test
/// that started tasks would be nondeterministic under DST replay and would
/// prove less. Nothing in these kernels spawns; the DoP knob lives on the
/// ferry throttle, never inside a kernel
/// (`.claude/rules/async-all-the-way-truthful-signatures.md`).
[<Fact>]
let ``ColumnLinear filter over any partition concatenates to the whole`` () =
    let rng = Random 271828
    let n = 1000
    let keys = Array.init n (fun _ -> int64 (rng.Next(0, 1000)))
    let weights = Array.init n (fun _ -> int64 (rng.Next(-99, 99)))
    let lo, hi = 100L, 600L

    let filterRange (a: int) (len: int) =
        let dk = Array.zeroCreate<int64> len
        let dw = Array.zeroCreate<int64> len
        let m =
            ColumnLinearKernel.FilterKeyInRange(
                ReadOnlySpan(keys, a, len), ReadOnlySpan(weights, a, len),
                lo, hi, Span<int64> dk, Span<int64> dw)
        Array.zip (Array.sub dk 0 m) (Array.sub dw 0 m)

    let whole = filterRange 0 n

    // Partitions at cut points that are, in turn: block-aligned, lane-aligned,
    // and aligned to nothing at all. Shard counts stand in for DoP=1..8.
    for shards in [ 1; 2; 3; 4; 7; 8 ] do
        for skew in [ 0; 1; 5; 64 ] do
            let cuts =
                [ 0 ]
                @ [ for s in 1 .. shards - 1 -> min n (s * n / shards + skew) ]
                @ [ n ]
                |> List.distinct
                |> List.sort
            let parts =
                cuts
                |> List.pairwise
                |> List.collect (fun (a, b) -> filterRange a (b - a) |> Array.toList)
                |> List.toArray
            Assert.Equal<(int64 * int64) array>(whole, parts)


[<Fact>]
let ``ColumnLinear map over any partition concatenates to the whole`` () =
    let rng = Random 314159
    let n = 777
    let src = Array.init n (fun _ -> int64 (rng.Next(-1000, 1000)))
    let whole = Array.zeroCreate<int64> n
    ColumnLinearKernel.MapAdd(ReadOnlySpan src, 42L, Span<int64> whole)
    for shards in [ 1; 2; 3; 5; 8 ] do
        let parts = Array.zeroCreate<int64> n
        let step = (n + shards - 1) / shards
        let mutable a = 0
        while a < n do
            let len = min step (n - a)
            ColumnLinearKernel.MapAdd(
                ReadOnlySpan(src, a, len), 42L, Span<int64>(parts, a, len))
            a <- a + len
        // COUNTED SELF-COMPARISON (check-arity census, R2) -- and the one that is a
        // genuine 2-safety property rather than a mutation-mediated pair. `whole` and
        // `parts` share an initialiser, so the audit normalises both sides to
        // `Array.zeroCreate<int64> 777`. What varies is THE PARTITION: `whole` is one
        // MapAdd over the entire span, `parts` is `shards` MapAdd calls over disjoint
        // sub-spans. Asserting they agree is exactly `Q(a ⊎ b) = Q(a) ⊎ Q(b)`, which is
        // the licence for sharding this kernel across a DoP knob.
        // Earned, and ISOLATED: adding a per-CALL position-0 bump to the `MapAdd`
        // DISPATCHER fails this assertion while BOTH differential tests above still
        // pass -- so the dimension this check constrains really is the partition, and
        // nothing else in the file covers it.
        Assert.Equal<int64 array>(whole, parts)


// ───────────────────── ALLOCATION ──────────────────────────────────
//
// Allocation is build-configuration-dependent: the F#/JIT layout differs
// between Debug and Release, so an unconditional exact golden ping-pongs
// across environments. These kernels are the fortunate case — they take a
// caller-supplied destination and build no intermediate, so the honest guard
// is `= 0L` and it holds in BOTH configurations. Where that is not achievable
// (the allocating module wrappers) the budget is NAMED and the reason for the
// non-zero value is stated, rather than a number picked to make it pass.

[<Fact>]
let ``ColumnLinear filter kernels allocate nothing`` () =
    let n = 4096
    let rng = Random 2024
    let keys = Array.init n (fun _ -> int64 (rng.Next(0, 1000)))
    let weights = Array.init n (fun _ -> int64 (rng.Next(-99, 99)))
    let dk = Array.zeroCreate<int64> n
    let dw = Array.zeroCreate<int64> n
    for (name, run) in
        [ "vectorized",
          fun () ->
            ColumnLinearKernel.FilterKeyInRangeVectorized(
                ReadOnlySpan keys, ReadOnlySpan weights, 250L, 750L,
                Span<int64> dk, Span<int64> dw) |> ignore
          "scalar",
          fun () ->
            ColumnLinearKernel.FilterKeyInRangeScalar(
                ReadOnlySpan keys, ReadOnlySpan weights, 250L, 750L,
                Span<int64> dk, Span<int64> dw) |> ignore ] do
        let bytes = measureAlloc 5 run
        Assert.True((bytes = 0L), $"filter {name} allocated {bytes} bytes, expected 0")


[<Fact>]
let ``ColumnLinear map kernels allocate nothing`` () =
    let n = 4096
    let src = Array.init n int64
    let dest = Array.zeroCreate<int64> n
    for (name, run) in
        [ "add-vector", fun () -> ColumnLinearKernel.MapAddVectorized(ReadOnlySpan src, 7L, Span<int64> dest)
          "add-scalar", fun () -> ColumnLinearKernel.MapAddScalar(ReadOnlySpan src, 7L, Span<int64> dest)
          "scale-vector", fun () -> ColumnLinearKernel.MapScaleVectorized(ReadOnlySpan src, 3L, Span<int64> dest)
          "scale-scalar", fun () -> ColumnLinearKernel.MapScaleScalar(ReadOnlySpan src, 3L, Span<int64> dest)
          "copy", fun () -> ColumnLinearKernel.CopyColumn(ReadOnlySpan src, Span<int64> dest) ] do
        let bytes = measureAlloc 5 run
        Assert.True((bytes = 0L), $"map {name} allocated {bytes} bytes, expected 0")


/// **The composition test, and it is the one that matters.**
///
/// Two individually-zero-allocation stages that allocate *between* them is
/// exactly the failure this API shape exists to prevent — and it is invisible
/// to per-operator tests. A `Where` → `Select` pipeline over `ArrayPool`
/// buffers must allocate zero bytes end to end, with the rented buffers
/// hoisted out of the measured region as any real pipeline would hoist them.
[<Fact>]
let ``ColumnLinear Where then Select pipeline allocates nothing end to end`` () =
    let n = 8192
    let rng = Random 6006
    let keys = Array.init n (fun _ -> int64 (rng.Next(0, 1000)))
    let weights = Array.init n (fun _ -> int64 (rng.Next(-99, 99)))
    let pool = ArrayPool<int64>.Shared
    // Rented once, as a pipeline would: renting inside the loop measures the
    // pool, not the operators.
    let midK = pool.Rent n
    let midW = pool.Rent n
    let outW = pool.Rent n
    try
        let mutable produced = 0
        let pipeline () =
            // WHERE key in [250, 750)
            let m =
                ColumnLinearKernel.FilterKeyInRange(
                    ReadOnlySpan keys, ReadOnlySpan weights, 250L, 750L,
                    Span<int64>(midK, 0, n), Span<int64>(midW, 0, n))
            // SELECT weight * 3 over exactly the surviving rows
            ColumnLinearKernel.MapScale(
                ReadOnlySpan(midW, 0, m), 3L, Span<int64>(outW, 0, m))
            produced <- m
        let bytes = measureAlloc 5 pipeline
        Assert.True(
            (bytes = 0L),
            $"Where->Select pipeline allocated {bytes} bytes over {n} rows, expected 0")
        // Non-vacuity: the pipeline must actually have done work. A pipeline
        // that filtered everything away would allocate nothing too.
        produced |> should be (greaterThan 0)
        // ... and produced the right answer, so "zero bytes" is not being
        // bought with a no-op.
        let expected =
            Array.zip keys weights
            |> Array.filter (fun (k, _) -> k >= 250L && k < 750L)
            |> Array.map (fun (_, w) -> w * 3L)
        Assert.Equal<int64 array>(expected, Array.sub outW 0 produced)
    finally
        pool.Return midK
        pool.Return midW
        pool.Return outW


[<Fact>]
let ``ColumnLinear module wrappers allocate only their result columns`` () =
    // These DO allocate, and the budget is named rather than hidden: filtering
    // 1 000 rows allocates one worst-case pair (2 x 1 000 x 8 B) plus, when the
    // result is smaller, one exact-size pair. Upper bound 4 x 8 KB + headers.
    // The guard is a bound rather than an exact golden precisely because the
    // exact-size second pair depends on the data's selectivity, which is a
    // property of the input and not of the build configuration.
    let z = ZSet.ofSeq [ for i in 0 .. 999 -> int64 i, int64 (i % 7 - 3) ] |> ColumnZSet.ofZSet
    let bytes = measureAlloc 3 (fun () -> ColumnLinear.filterKeysInRange 100L 600L z |> ignore)
    Assert.True((bytes < 33_000L), $"filterKeysInRange allocated {bytes} bytes, budget 33 000")


// ───────────── module wrappers: Z-set invariants survive ───────────

[<Fact>]
let ``ColumnLinear filterKeysInRange preserves the Z-set invariants`` () =
    let z = ZSet.ofSeq [ for i in 0 .. 499 -> int64 (i * 3), int64 (if i % 5 = 0 then -1 else 2) ]
    let c = ColumnZSet.ofZSet z
    for (lo, hi) in [ 0L, 1500L; 300L, 900L; 0L, 1L; 5000L, 6000L; 0L, 0L ] do
        let got = ColumnLinear.filterKeysInRange lo hi c
        let expected =
            z.AsSpan().ToArray()
            |> Array.filter (fun e -> e.Key >= lo && e.Key < hi)
        got.Count |> should equal expected.Length
        let keys = got.KeySpan().ToArray()
        let weights = got.WeightSpan().ToArray()
        for i in 0 .. expected.Length - 1 do
            keys.[i] |> should equal expected.[i].Key
            weights.[i] |> should equal expected.[i].Weight
        // Strictly ascending, no zero weights — the invariant the ctor documents.
        for i in 1 .. keys.Length - 1 do
            Assert.True((keys.[i] > keys.[i - 1]), "filter result must stay strictly ascending")
        for w in weights do
            Assert.True((w <> 0L), "filter result must not contain a zero weight")
        // And it is a real ZSet on the way back out.
        ColumnZSet.toZSet got |> ZSet.count |> should equal expected.Length


[<Fact>]
let ``ColumnLinear shiftKeys is order-preserving and round-trips`` () =
    let z = ZSet.ofSeq [ for i in 0 .. 99 -> int64 i, int64 (i + 1) ]
    let c = ColumnZSet.ofZSet z
    let shifted = ColumnLinear.shiftKeys 1_000_000L c
    let keys = shifted.KeySpan().ToArray()
    for i in 1 .. keys.Length - 1 do
        Assert.True((keys.[i] > keys.[i - 1]), "shiftKeys must preserve order")
    ColumnLinear.shiftKeys -1_000_000L shifted
    |> ColumnZSet.toZSet
    |> should equal z


[<Fact>]
let ``ColumnLinear scaleWeights refuses 0 rather than silently emptying the relation`` () =
    // Every weight would become zero, which is not a Z-set. Returning Empty
    // here would make "your filter matched nothing" indistinguishable from
    // "you multiplied by zero" — a success that is really a data loss.
    let c = ColumnZSet.ofZSet (ZSet.ofSeq [ 1L, 2L; 3L, 4L ])
    (fun () -> ColumnLinear.scaleWeights 0L c |> ignore) |> should throw typeof<ArgumentException>
    let doubled = ColumnLinear.scaleWeights 2L c
    doubled.WeightSpan().ToArray() |> should equal [| 4L; 8L |]
    doubled.KeySpan().ToArray() |> should equal [| 1L; 3L |]


// ───────────────── the vectorisation falsifier ─────────────────────
//
// WHAT THIS PROVES: that `FilterKeyInRangeVectorized` is materially faster
// than its scalar twin on data whose branches cannot be predicted. Replace
// its body with the scalar loop and the ratio goes to ~1.0 and this fails.
//
// WHAT IT DOES NOT PROVE: that any particular instruction was emitted. There
// is no supported way to assert on JIT output from a unit test, so a timing
// gate is the honest instrument and it is a weak one — stated as such rather
// than dressed up.
//
// The gate is deliberately set BELOW the measured ratio by a wide margin so
// it discriminates a bypassed vector path (1.0x) without flaking on a loaded
// CI runner. Each path is timed best-of-9 with rounds interleaved, so thermal
// drift hits both.

[<Fact>]
let ``ColumnLinear vectorized filter is measurably faster on unpredictable data`` () =
    if not ColumnLinearKernel.IsAccelerated then
        // No hardware vectors: the kernels are still correct (covered above),
        // there is simply no speed claim to check. Asserting a speedup the
        // machine cannot deliver would not be honest.
        ()
    else
        let n = 1_000_000
        let rng = Random 9182
        let keys = Array.init n (fun _ -> int64 (rng.Next(0, 1_000_000)))
        let weights = Array.init n (fun _ -> int64 (rng.Next(-99, 99)))
        let dk = Array.zeroCreate<int64> n
        let dw = Array.zeroCreate<int64> n
        // 50% selectivity on SHUFFLED keys — the ONLY regime in which this
        // kernel wins, measured 3.45x here and 0.69x-1.12x everywhere else
        // (see ColumnLinearOps.fs for the full table). The gate therefore
        // says exactly what it can: "the vector path is still taken", not
        // "the vector path is always faster". Naming the regime in the
        // failure message is what keeps it from reading as the latter.
        let lo, hi = 250_000L, 750_000L
        let scalarRun () =
            ColumnLinearKernel.FilterKeyInRangeScalar(
                ReadOnlySpan keys, ReadOnlySpan weights, lo, hi, Span<int64> dk, Span<int64> dw)
        let vectorRun () =
            ColumnLinearKernel.FilterKeyInRangeVectorized(
                ReadOnlySpan keys, ReadOnlySpan weights, lo, hi, Span<int64> dk, Span<int64> dw)

        // Agreement first — a fast wrong answer is not a speedup.
        vectorRun () |> should equal (scalarRun ())

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

        // The gate is build-configuration-dependent for the same reason the
        // allocation goldens are: the JIT optimises both paths in Release and
        // neither in Debug, which COMPRESSES the ratio. Measured on this host:
        // Release 3.45x, Debug 1.37x. A single threshold covering both would
        // have to sit under 1.37 and would then be slack in Release, which is
        // the configuration that ships — so the threshold is exact per
        // configuration, matching `BenPort.Tests.fs`'s treatment of allocation
        // goldens. Both values still discriminate a bypassed vector path,
        // which measures 1.02x in Release and ~1.00x in Debug (mutation M1).
        //
        // Stated plainly: the DEBUG margin is thinner (1.15 gate against a
        // 1.37 measurement) than the Release one (1.5 against 3.45). If this
        // flakes on a loaded runner it will flake in Debug first, and the fix
        // is to skip it in Debug rather than to lower it further -- a gate
        // below ~1.05 could not tell a vector path from a scalar one and
        // would be a check that cannot fail.
#if DEBUG
        let gate = 1.15
#else
        let gate = 1.5
#endif
        let speedup = bestScalar / bestVector
        // Emitted BEFORE the assertion, and on both outcomes. A pass is an observation: without it
        // the ledger has a numerator over an unknown denominator and cannot tell a flake from a
        // regression. `pass` is the same expression the assertion uses, never re-derived.
        PerfObservation.emit
            "Zeta.Tests.Storage.ColumnLinearOpsTests.ColumnLinear vectorized filter is measurably faster on unpredictable data"
            "speedup" speedup gate (speedup >= gate)
        Assert.True(
            speedup >= gate,
            $"vectorised filter should be >= {gate}x the scalar filter on {n} unpredictable keys "
            + $"at 50%% selectivity, measured {speedup:F2}x (scalar {bestScalar:F3} ms, "
            + $"vector {bestVector:F3} ms, Vector<int64>.Count = {ColumnLinearKernel.VectorWidth}). "
            + "A ratio near 1.0 means the vector path is no longer vectorised.")
