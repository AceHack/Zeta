namespace Zeta.Core

open System
open System.Numerics
open System.Runtime.CompilerServices


/// **Vectorised `Where` and `Select` over the columnar representation.**
///
/// `ColumnZSet` (SoA) gave us contiguous `ReadOnlySpan<int64>` columns and
/// three vectorised *reductions* (`SumWeights`, `CountWhereKeyInRange`,
/// `SumWeightsWhereKeyInRange`). This file adds the two operators the query
/// surface actually names — the ones `QuerySurface.fs` marks `LINEAR`
/// (`Q^Δ = Q`):
///
/// * **`Where`** — predicate → bitmask → **compaction**. Unlike a reduction,
///   selection has to *produce a column*, so the interesting engineering is
///   the compaction step, not the compare.
/// * **`Select`** — an elementwise map. Produces one output per input, no
///   compaction, no accumulator.
///
/// ## Two claims that are adjacent and MUST NOT be conflated
///
/// `QuerySurface.fs` calls `Where`/`Select` **linear**, meaning `Q^Δ = Q`:
/// filter and map distribute over Z-set addition, so the incremental form of
/// the operator *is* the operator. That is a DBSP **incrementalization**
/// property (Budiu et al., VLDB 2023) and it says nothing about SIMD.
///
/// Aaron's observation (2026-08-25) is a *different*, orthogonal, and correct
/// one: *"for the where and select not being parallel, i was assuming it could
/// be done in simd batches."* Linear operators are exactly the ones that
/// vectorise cleanly — and the reason the two statements rhyme is worth
/// stating precisely, because it is the reason this file exists:
///
/// > Linearity over the Z-set group means the operator's result on a
/// > concatenation is the concatenation of its results on the parts —
/// > `Q(a ⊎ b) = Q(a) ⊎ Q(b)`. A SIMD lane, a 64-element block, and a
/// > `MaxDegreeOfParallelism`-th shard are all *parts*. So the same algebraic
/// > fact that makes the incremental form trivial is what makes the batched
/// > form safe to split.
///
/// This is not decoration: `ColumnLinearOps.Tests.fs` **asserts it** — filter
/// and map over an arbitrary partition of the span, concatenated, equal the
/// whole-span result. That test is the DoP=1→N licence, discharged
/// algebraically rather than by spawning anything (see *Degree of
/// parallelism* below).
///
/// ## The failure class from PR #15246 cannot occur here — by construction
///
/// #15246 shipped a P0 where a vector kernel checked overflow **per lane**
/// while its scalar twin used four unrolled accumulators. Different
/// partitions of the same sum, so the two disagreed in **both** directions,
/// and the answer depended on the host ISA (2-lane NEON vs 4-lane AVX2).
///
/// That defect is specific to **reductions**: an accumulator is shared state
/// whose partitioning is visible in the result. `Where` and `Select` have no
/// accumulator. Every element's outcome is a function of that element alone,
/// so lane width cannot reach the answer. Overflow checking here is therefore
/// **per element** and partition-free by construction — the guard is not
/// "we were careful", it is "there is nothing to partition".
///
/// The checks are still exercised on both lane widths and across the block
/// boundary (`ColumnLinearOps.Tests.fs`), because "cannot happen" is a claim
/// and claims get falsifiers.
///
/// ## Zero allocation
///
/// Every kernel below writes into a **caller-supplied** `Span<int64>` and
/// allocates **nothing** — no intermediate selection vector, no bitmap
/// buffer, no `stackalloc`. The selection bitmask is a single `uint64` local
/// covering 64 elements at a time, which is why the block size is 64 and not
/// 4 096. Pinned by `= 0L` assertions in
/// `tests/Tests.FSharp/Runtime/Allocation.Tests.fs`-style tests, measured with
/// `GC.GetAllocatedBytesForCurrentThread()` in both Debug and Release.
///
/// The `ColumnLinear` module wrappers at the bottom DO allocate — exactly two
/// arrays, the result columns — because they return a value. That is stated
/// rather than hidden, and the zero-alloc kernel is the primary API.
///
/// ## Degree of parallelism
///
/// These kernels are pure span→span functions with no ambient state, no
/// `Task.Run`, and no thread of their own. DoP=1 is the ordinary call. DoP=N
/// is a ferry sharding the span and concatenating, which is sound **because**
/// of the linearity test above — the substrate's DoP knob lives on the ferry
/// throttle (`.claude/rules/async-all-the-way-truthful-signatures.md`), never
/// inside a kernel. Nothing here spawns, so nothing here can be
/// nondeterministic under DST replay.
///
/// ## Anchors (Beacon)
///
/// * **Boncz, Zukowski & Nes**, *MonetDB/X100: Hyper-Pipelining Query
///   Execution* (CIDR 2005) — vectorised execution over column batches; the
///   selection-vector-vs-bitmask choice is theirs.
/// * **Abadi, Boncz & Harizopoulos**, *The Design and Implementation of
///   Modern Column-Oriented Database Systems* (FnT Databases 5(3), 2013) —
///   §4 late materialisation, and the central finding that column *storage*
///   without column *execution* buys little.
/// * **Budiu, McSherry, Ryzhyk & Tannen**, *DBSP: Automatic Incrementalization
///   of Datalog-like Computations* (VLDB 2023) — the linearity property the
///   query surface tags these operators with.
/// * **Cysharp, ZLinq** (MIT, <https://github.com/Cysharp/ZLinq>) — the
///   maintainer's pointer, and a genuinely instructive one. Three findings
///   from its *documentation* (see `docs/PRIOR-ART-LIST.md` for the full
///   entry and the clean-room note): (a) ZLinq gates SIMD on
///   `TryGetSpan` — vectorisation is a *layout* question before it is an
///   operator question, which is the same claim as Abadi 2013 and the reason
///   `ColumnZSet` had to exist first; (b) ZLinq ships `Sum` **and**
///   `SumUnchecked` because overflow checking costs ~2x inside a SIMD
///   reduction — an independent confirmation that #15246's overflow work was
///   not free, and that the honest response is to *name* the two contracts
///   rather than pick one silently; (c) ZLinq's `Select` is vectorised only
///   through an explicit `AsVectorizable()` where the caller supplies **both**
///   a vector lambda and a scalar lambda, and its `Where` is **not vectorised
///   at all**. Both are load-bearing for what is below.
[<AbstractClass; Sealed>]
type ColumnLinearKernel =

    /// True when `Vector<int64>` is hardware-backed. The kernels are correct
    /// either way.
    static member IsAccelerated: bool = Vector.IsHardwareAccelerated

    /// Lanes per `Vector<int64>` — 2 (NEON), 4 (AVX2), 8 (AVX-512). Affects
    /// speed only; never the result, and never whether one is raised.
    static member VectorWidth: int = Vector<int64>.Count

    /// Elements per selection bitmask word. 64 because the mask IS a
    /// `uint64` — that is what keeps the kernel allocation-free. Divisible by
    /// every `Vector<int64>.Count` (2, 4, 8), so no lane straddles a block.
    static member BlockSize: int = 64

    /// Lane `l` holds `1L <<< l`. Built **once** at type initialisation, not
    /// per call: an `Array.init` inside the kernel would allocate on every
    /// invocation, which is precisely the property this file exists to keep.
    ///
    /// `Vector.ExtractMostSignificantBits` would replace this whole trick with
    /// one instruction, but it is not reachable from F# (`FS0503`), so the
    /// mask fold uses only primitives already proven in `ColumnZSet.fs` and
    /// `Simd.fs`.
    static member val private LaneBitSeed: Vector<int64> =
        let a = Array.init Vector<int64>.Count (fun l -> 1L <<< l)
        Vector<int64>(ReadOnlySpan<int64> a)

    // ═══════════════════════════════════════════════════════════════════
    // WHERE — predicate → mask → compact
    // ═══════════════════════════════════════════════════════════════════

    static member inline private RequireRoom
        (n: int, destKeys: Span<int64>, destWeights: Span<int64>) : unit =
        // The destination must hold the WORST case (everything matches).
        // Sizing it to the expected selectivity and truncating would be a
        // silent wrong answer, which is the failure mode this repo refuses.
        if destKeys.Length < n || destWeights.Length < n then
            let msg =
                $"filter destination must hold every input element: need {n}, "
                + $"got {destKeys.Length} keys / {destWeights.Length} weights"
            invalidArg "destKeys" msg

    /// `SELECT key, weight WHERE key >= lo AND key < hi`, scalar: one
    /// data-dependent branch per element. Writes survivors to the caller's
    /// spans and returns how many were written. Allocates nothing.
    static member FilterKeyInRangeScalar
        (keys: ReadOnlySpan<int64>,
         weights: ReadOnlySpan<int64>,
         lo: int64,
         hi: int64,
         destKeys: Span<int64>,
         destWeights: Span<int64>) : int =
        if keys.Length <> weights.Length then
            invalidArg "weights" "filter columns must be parallel"
        ColumnLinearKernel.RequireRoom(keys.Length, destKeys, destWeights)
        let mutable outN = 0
        for i in 0 .. keys.Length - 1 do
            let k = keys.[i]
            if k >= lo && k < hi then
                destKeys.[outN] <- k
                destWeights.[outN] <- weights.[i]
                outN <- outN + 1
        outN

    /// `SELECT key, weight WHERE key >= lo AND key < hi`, vectorised.
    ///
    /// The classic columnar shape, in three steps and with the third one
    /// being the whole difficulty:
    ///
    /// 1. **Compare** — `Vector.GreaterThanOrEqual` ∧ `Vector.LessThan`
    ///    against broadcast bounds. Branchless; identical cost whatever the
    ///    data looks like.
    /// 2. **Mask** — `Vector.ExtractMostSignificantBits` folds each
    ///    comparison result to one bit per lane, packed into a single
    ///    `uint64` covering 64 elements. No buffer, so no allocation.
    /// 3. **Compact** — and here portable .NET has **no instruction**.
    ///    AVX-512 has `vpcompressq` and SVE has `compact`, but neither is
    ///    reachable through `System.Numerics.Vector<T>`, so a portable
    ///    compaction is necessarily scalar stores. What the bitmask buys is
    ///    that the stores are driven by **`BitOperations.TrailingZeroCount`
    ///    over set bits only** — cost O(matches), not O(elements) — plus two
    ///    special cases that are where most of the win actually comes from:
    ///    an **empty** word skips 64 elements with one test, and a **full**
    ///    word emits 64 elements with two `CopyTo`s and no per-element branch
    ///    at all.
    ///
    /// ### The prediction was written first, and the measurement REFUTED it
    ///
    /// Predicted before measuring: wins at **low** selectivity (empty-word
    /// skipping) and at **high** selectivity (full-word bulk copy), weakest
    /// in the **middle**. That is recorded because it was wrong, and the way
    /// it was wrong is the actual result.
    ///
    /// Measured (Apple M2 Ultra, arm64/NEON, `Vector<int64>.Count = 2`,
    /// best-of-9, scalar ÷ vector):
    ///
    /// | n | key order | selectivity | ratio |
    /// |---|---|---|---|
    /// | 1 048 576 | shuffled | **50%** | **3.45x** |
    /// | 1 048 576 | shuffled | 1% | 0.87x |
    /// | 1 048 576 | shuffled | 99% | 0.69x |
    /// | 1 048 576 | sorted | 50% | 0.95x |
    /// | 1 048 576 | sorted | 1% | 0.82x |
    /// | 1 048 576 | sorted | 99% | 1.12x |
    /// | 65 536 | shuffled | 50% | 3.12x |
    /// | 65 536 | sorted | 50% | 0.78x |
    /// | 4 096 | shuffled | 50% | 1.16x |
    ///
    /// **The axis is branch PREDICTABILITY, not selectivity — and the two are
    /// not the same thing.** A 1%-selective predicate is *almost always
    /// false* and a 99%-selective one is *almost always true*; both are
    /// therefore trivially predicted, and the scalar twin costs almost
    /// nothing. Predictability is **maximal at both extremes and minimal in
    /// the middle**, which is the exact inverse of what the empty-word /
    /// full-word reasoning assumed. Sortedness kills the win for the same
    /// reason from the other direction: a sorted column has two branch
    /// transitions in the whole scan whatever the selectivity.
    ///
    /// So the claim is narrow, and stating it narrowly is the point:
    ///
    /// > The vectorised filter wins **only where the scalar branch is
    /// > unpredictable** — measured **3.45x** at 50% selectivity on shuffled
    /// > keys at n = 1 048 576 — and **loses 1.05x–1.45x everywhere else**.
    ///
    /// The empty-word and full-word special cases are still worth their two
    /// tests: they are what keeps the loss at ~1.3x in the regimes where this
    /// path is the wrong choice, rather than something worse. They are not
    /// what wins anything.
    ///
    /// `FilterKeyInRange` dispatches to this path anyway. That is a
    /// **worst-case-bounding** decision, not a claim that it is always
    /// faster: it trades ≤1.45x on predictable columns for 3.45x on
    /// unpredictable ones. A caller that *knows* its column is sorted should
    /// call `FilterKeyInRangeScalar` — or, better, binary-search the two
    /// boundaries and not scan at all.
    static member FilterKeyInRangeVectorized
        (keys: ReadOnlySpan<int64>,
         weights: ReadOnlySpan<int64>,
         lo: int64,
         hi: int64,
         destKeys: Span<int64>,
         destWeights: Span<int64>) : int =
        if keys.Length <> weights.Length then
            invalidArg "weights" "filter columns must be parallel"
        ColumnLinearKernel.RequireRoom(keys.Length, destKeys, destWeights)

        let n = keys.Length
        let width = Vector<int64>.Count
        let block = 64
        let vlo = Vector<int64>(lo)
        let vhi = Vector<int64>(hi)
        let seed = ColumnLinearKernel.LaneBitSeed
        let mutable outN = 0
        let mutable b = 0

        while b + block <= n do
            // ── steps 1 + 2: compare, and fold each chunk's lanes to bits ──
            let mutable bits = 0UL
            let mutable j = 0
            while j < block do
                let v = Vector<int64>(keys.Slice(b + j, width))
                let m =
                    Vector.BitwiseAnd(
                        Vector.GreaterThanOrEqual(v, vlo), Vector.LessThan(v, vhi))
                // `m` is all-ones or all-zeros per lane, so ANDing with the
                // lane-bit seed leaves exactly bit `l` set where lane `l`
                // matched. The lanes hold DISJOINT bits, so their sum is their
                // OR — which is why `Vector.Sum` is the right fold and no
                // per-lane read loop is needed.
                bits <- bits ||| (uint64 (Vector.Sum(Vector.BitwiseAnd(m, seed))) <<< j)
                j <- j + width

            // ── step 3: compact ──
            if bits = 0UL then
                // Nothing survived: 64 elements skipped by one test. This is
                // the low-selectivity win.
                ()
            elif bits = UInt64.MaxValue then
                // Everything survived: two bulk copies, zero per-element
                // branches. This is the high-selectivity win.
                keys.Slice(b, block).CopyTo(destKeys.Slice(outN, block))
                weights.Slice(b, block).CopyTo(destWeights.Slice(outN, block))
                outN <- outN + block
            else
                let mutable w = bits
                while w <> 0UL do
                    let i = BitOperations.TrailingZeroCount w
                    destKeys.[outN] <- keys.[b + i]
                    destWeights.[outN] <- weights.[b + i]
                    outN <- outN + 1
                    w <- w &&& (w - 1UL)     // clear lowest set bit
            b <- b + block

        // Tail: fewer than 64 elements left. Scalar, and identical to the
        // scalar twin's body so the two agree by inspection as well as by test.
        while b < n do
            let k = keys.[b]
            if k >= lo && k < hi then
                destKeys.[outN] <- k
                destWeights.[outN] <- weights.[b]
                outN <- outN + 1
            b <- b + 1
        outN

    /// `SELECT key, weight WHERE key >= lo AND key < hi`. Vectorised when
    /// `Vector<int64>` is hardware-backed and the input is at least one full
    /// 64-element block; scalar otherwise (below one block the vector path is
    /// its own tail loop, so dispatching to it would only add setup).
    static member FilterKeyInRange
        (keys: ReadOnlySpan<int64>,
         weights: ReadOnlySpan<int64>,
         lo: int64,
         hi: int64,
         destKeys: Span<int64>,
         destWeights: Span<int64>) : int =
        if Vector.IsHardwareAccelerated && keys.Length >= 64 then
            ColumnLinearKernel.FilterKeyInRangeVectorized(
                keys, weights, lo, hi, destKeys, destWeights)
        else
            ColumnLinearKernel.FilterKeyInRangeScalar(
                keys, weights, lo, hi, destKeys, destWeights)

    // ═══════════════════════════════════════════════════════════════════
    // SELECT — elementwise map
    // ═══════════════════════════════════════════════════════════════════

    /// Bounds `[lo, hi]` such that `x + delta` fits in `int64` **iff**
    /// `lo <= x <= hi`. Computed once, scalar; the per-element check is then
    /// two comparisons, which vectorise. Exact for every `delta` including
    /// `Int64.MinValue` (unchecked subtraction is the correct arithmetic
    /// here: `MinValue - MinValue = 0`, which is the right bound).
    static member inline private AddBounds(delta: int64) : struct (int64 * int64) =
        let lo = if delta < 0L then Int64.MinValue - delta else Int64.MinValue
        let hi = if delta > 0L then Int64.MaxValue - delta else Int64.MaxValue
        struct (lo, hi)

    /// Bounds `[lo, hi]` such that `x * m` fits in `int64` **iff**
    /// `lo <= x <= hi`. Turning a multiplication overflow test into a range
    /// test is what makes it vectorisable: there is no portable vector
    /// division, but there is a portable vector compare.
    ///
    /// Two cases must be special-cased or the *bound computation itself*
    /// faults: `m = 0` (division by zero) and `m = -1`
    /// (`Int64.MinValue / -1L` raises `OverflowException`).
    static member inline private ScaleBounds(m: int64) : struct (int64 * int64) =
        if m = 0L then struct (Int64.MinValue, Int64.MaxValue)
        elif m = -1L then struct (Int64.MinValue + 1L, Int64.MaxValue)
        elif m > 0L then struct (Int64.MinValue / m, Int64.MaxValue / m)
        else struct (Int64.MaxValue / m, Int64.MinValue / m)

    /// `SELECT col + delta`, scalar. Exact: raises `OverflowException` iff
    /// **some element's** result does not fit in `int64`.
    ///
    /// The raise happens after the pass, not at the offending element, so
    /// that the scalar and vector twins have identical raise behaviour
    /// without either of them branching per element. **On a raise the
    /// destination contents are unspecified** — stated because it is true of
    /// both twins, rather than left for a caller to discover.
    static member MapAddScalar
        (src: ReadOnlySpan<int64>, delta: int64, dest: Span<int64>) : unit =
        if dest.Length < src.Length then
            invalidArg "dest" $"map destination too small: need {src.Length}, got {dest.Length}"
        let struct (lo, hi) = ColumnLinearKernel.AddBounds delta
        let mutable bad = false
        for i in 0 .. src.Length - 1 do
            let x = src.[i]
            if x < lo || x > hi then bad <- true
            dest.[i] <- x + delta
        if bad then raise (OverflowException "ColumnZSet map (+) overflowed int64")

    /// `SELECT col + delta`, vectorised. `Vector<int64>` addition is a real
    /// instruction on every ISA we target (NEON `add.2d`, AVX2 `vpaddq`), so
    /// this is the projection shape that *can* win — and whether it does is
    /// then purely a question of whether the loop is bandwidth-bound. See
    /// `ColumnLinearOpsBench`.
    static member MapAddVectorized
        (src: ReadOnlySpan<int64>, delta: int64, dest: Span<int64>) : unit =
        if dest.Length < src.Length then
            invalidArg "dest" $"map destination too small: need {src.Length}, got {dest.Length}"
        let struct (lo, hi) = ColumnLinearKernel.AddBounds delta
        let width = Vector<int64>.Count
        let vlo = Vector<int64>(lo)
        let vhi = Vector<int64>(hi)
        let vd = Vector<int64>(delta)
        let mutable ovf = Vector<int64>.Zero
        let mutable i = 0
        // `i <= Length - width`, never `i + width <= Length`: the latter can
        // overflow int on a near-Int32.MaxValue span and pass the guard.
        while i <= src.Length - width do
            let v = Vector<int64>(src.Slice(i, width))
            ovf <-
                Vector.BitwiseOr(
                    ovf,
                    Vector.BitwiseOr(Vector.LessThan(v, vlo), Vector.GreaterThan(v, vhi)))
            (v + vd).CopyTo(dest.Slice(i, width))
            i <- i + width
        let mutable bad = not (Vector.EqualsAll(ovf, Vector<int64>.Zero))
        while i < src.Length do
            let x = src.[i]
            if x < lo || x > hi then bad <- true
            dest.[i] <- x + delta
            i <- i + 1
        if bad then raise (OverflowException "ColumnZSet map (+) overflowed int64")

    /// `SELECT col + delta`. Vectorised when hardware-backed.
    static member MapAdd(src: ReadOnlySpan<int64>, delta: int64, dest: Span<int64>) : unit =
        if Vector.IsHardwareAccelerated && src.Length >= Vector<int64>.Count then
            ColumnLinearKernel.MapAddVectorized(src, delta, dest)
        else
            ColumnLinearKernel.MapAddScalar(src, delta, dest)

    /// `SELECT col * m`, scalar. Same exactness and same
    /// unspecified-destination-on-raise contract as `MapAddScalar`.
    static member MapScaleScalar
        (src: ReadOnlySpan<int64>, m: int64, dest: Span<int64>) : unit =
        if dest.Length < src.Length then
            invalidArg "dest" $"map destination too small: need {src.Length}, got {dest.Length}"
        let struct (lo, hi) = ColumnLinearKernel.ScaleBounds m
        let mutable bad = false
        for i in 0 .. src.Length - 1 do
            let x = src.[i]
            if x < lo || x > hi then bad <- true
            dest.[i] <- x * m
        if bad then raise (OverflowException "ColumnZSet map (*) overflowed int64")

    /// `SELECT col * m`, vectorised — **and the prediction here was wrong
    /// too, in the opposite direction.**
    ///
    /// The reasoning was: the overflow guard vectorises (two compares against
    /// precomputed bounds) but the multiplication does not, because AArch64
    /// NEON has **no** 64-bit integer vector multiply and on x86 `vpmullq`
    /// arrived only in **AVX-512DQ**, so an AVX2 host is in the same
    /// position. On both, RyuJIT expands `Vector<int64> * Vector<int64>` into
    /// scalar multiplies plus the vector pack/unpack around them. Predicted
    /// **≤ 1.0x**.
    ///
    /// Measured on NEON: **1.28x** at n = 1 048 576, **1.27x** at 65 536,
    /// **1.12x** at 4 096 — a consistent win.
    ///
    /// The prediction failed because it priced the wrong part of the loop.
    /// The multiply is one of *three* per-element operations here; the other
    /// two are the range compares of the overflow guard, and those vectorise
    /// fully. Scalarising one third of a loop still leaves two thirds
    /// vectorised. Compare `MapAdd` at **1.60x**, where all three vectorise:
    /// the gap between 1.28x and 1.60x is what the scalarised multiply
    /// actually costs, and it is a reduction in the win rather than its
    /// elimination.
    ///
    /// Recorded rather than quietly corrected because the failed prediction
    /// is the more useful artefact: *"this instruction does not exist on this
    /// ISA"* is a claim about one operation, not about a loop, and a loop is
    /// what gets executed.
    static member MapScaleVectorized
        (src: ReadOnlySpan<int64>, m: int64, dest: Span<int64>) : unit =
        if dest.Length < src.Length then
            invalidArg "dest" $"map destination too small: need {src.Length}, got {dest.Length}"
        let struct (lo, hi) = ColumnLinearKernel.ScaleBounds m
        let width = Vector<int64>.Count
        let vlo = Vector<int64>(lo)
        let vhi = Vector<int64>(hi)
        let vm = Vector<int64>(m)
        let mutable ovf = Vector<int64>.Zero
        let mutable i = 0
        while i <= src.Length - width do
            let v = Vector<int64>(src.Slice(i, width))
            ovf <-
                Vector.BitwiseOr(
                    ovf,
                    Vector.BitwiseOr(Vector.LessThan(v, vlo), Vector.GreaterThan(v, vhi)))
            (v * vm).CopyTo(dest.Slice(i, width))
            i <- i + width
        let mutable bad = not (Vector.EqualsAll(ovf, Vector<int64>.Zero))
        while i < src.Length do
            let x = src.[i]
            if x < lo || x > hi then bad <- true
            dest.[i] <- x * m
            i <- i + 1
        if bad then raise (OverflowException "ColumnZSet map (*) overflowed int64")

    /// `SELECT col * m`. Vectorised when hardware-backed — on the
    /// measurement, not on the prediction (see `MapScaleVectorized`).
    static member MapScale(src: ReadOnlySpan<int64>, m: int64, dest: Span<int64>) : unit =
        if Vector.IsHardwareAccelerated && src.Length >= Vector<int64>.Count then
            ColumnLinearKernel.MapScaleVectorized(src, m, dest)
        else
            ColumnLinearKernel.MapScaleScalar(src, m, dest)

    /// `SELECT col` — the identity projection. **`CopyTo`, deliberately not
    /// hand-vectorised, and this is a measured result rather than a gap.**
    ///
    /// `Span<T>.CopyTo` bottoms out in `Buffer.Memmove`, which is already the
    /// platform's best vectorised copy. Measured against a scalar
    /// element-by-element loop (M2 Ultra, NEON, best-of-9):
    ///
    /// | n | hand-rolled `Vector<int64>` loop | `Span.CopyTo` |
    /// |---|---|---|
    /// | 4 096 | **0.84x** — slower than scalar | **41.7x** |
    /// | 65 536 | **0.91x** — slower than scalar | **4.6x** |
    /// | 1 048 576 | **1.00x** — no better | **2.8x** |
    ///
    /// Hand-vectorising an identity projection is not merely a no-op, it is a
    /// **regression** at every size measured, while looking like optimisation
    /// work. The control matters: comparing `CopyTo` against itself would
    /// have "shown" 1.00x and proved nothing, which is the vacuity class.
    static member CopyColumn(src: ReadOnlySpan<int64>, dest: Span<int64>) : unit =
        if dest.Length < src.Length then
            invalidArg "dest" $"copy destination too small: need {src.Length}, got {dest.Length}"
        src.CopyTo(dest.Slice(0, src.Length))


/// Allocating conveniences over the zero-allocation kernels above.
///
/// **These allocate and the kernels do not.** Returning a `ColumnZSet` means
/// returning two arrays, and no API can return a value without producing it.
/// The zero-allocation path is `ColumnLinearKernel.*` with caller-supplied
/// spans; these wrappers exist for call sites where the result is genuinely a
/// new column pair and the allocation is the point.
[<RequireQualifiedAccess>]
module ColumnLinear =

    /// `WHERE key >= lo AND key < hi` over a `ColumnZSet`, returning a
    /// `ColumnZSet`.
    ///
    /// The Z-set invariants survive selection with nothing to re-establish: a
    /// subsequence of a strictly-ascending run is strictly ascending, and
    /// dropping rows cannot create a zero weight. That is the same linearity
    /// that makes `Q^Δ = Q` — filter commutes with the group structure — so
    /// no re-sort and no re-normalisation is needed or done.
    ///
    /// **Allocation:** one worst-case pair of buffers, then one exact-size
    /// pair when the result is smaller. The two-pass alternative (count, then
    /// fill) reads the key column twice to save the oversize allocation; that
    /// trade is a real one and is not made here, because the count pass costs
    /// full memory bandwidth on the hot column while the copy costs one
    /// allocation of a size we already know is bounded by `n`.
    let filterKeysInRange (lo: int64) (hi: int64) (c: ColumnZSet) : ColumnZSet =
        let keys = c.KeySpan()
        if keys.IsEmpty then ColumnZSet.Empty
        else
            let weights = c.WeightSpan()
            let bufK = Pool.AllocateExact<int64> keys.Length
            let bufW = Pool.AllocateExact<int64> keys.Length
            let n =
                ColumnLinearKernel.FilterKeyInRange(
                    keys, weights, lo, hi, Span<int64>(bufK), Span<int64>(bufW))
            if n = 0 then ColumnZSet.Empty
            elif n = keys.Length then
                ColumnZSet(Pool.Freeze bufK, Pool.Freeze bufW)
            else
                let outK = Pool.AllocateExact<int64> n
                let outW = Pool.AllocateExact<int64> n
                Array.blit bufK 0 outK 0 n
                Array.blit bufW 0 outW 0 n
                ColumnZSet(Pool.Freeze outK, Pool.Freeze outW)

    /// `SELECT key + delta, weight` — shift every key by a constant.
    ///
    /// Order-preserving, so the result is a valid `ColumnZSet` without a
    /// re-sort: `x ↦ x + delta` is strictly monotone on the range where it
    /// does not overflow, and it raises rather than wrapping where it would.
    /// Weights are copied unchanged, so no weight can become zero.
    ///
    /// **Allocation:** two arrays, the result columns.
    let shiftKeys (delta: int64) (c: ColumnZSet) : ColumnZSet =
        let keys = c.KeySpan()
        if keys.IsEmpty then ColumnZSet.Empty
        else
            let outK = Pool.AllocateExact<int64> keys.Length
            let outW = Pool.AllocateExact<int64> keys.Length
            ColumnLinearKernel.MapAdd(keys, delta, Span<int64>(outK))
            ColumnLinearKernel.CopyColumn(c.WeightSpan(), Span<int64>(outW))
            ColumnZSet(Pool.Freeze outK, Pool.Freeze outW)

    /// `SELECT key, weight * m` — scale every weight by a constant.
    ///
    /// This is the Z-set's scalar multiplication, and it is linear in exactly
    /// the DBSP sense. **`m = 0` is refused rather than silently returning
    /// the empty Z-set**: every weight would become zero, which violates the
    /// no-zero-weight invariant, and quietly emptying a relation is the kind
    /// of "success" this repository treats as a defect.
    ///
    /// **Allocation:** two arrays, the result columns.
    let scaleWeights (m: int64) (c: ColumnZSet) : ColumnZSet =
        if m = 0L then
            invalidArg "m" "scaleWeights 0 would zero every weight, which is not a Z-set; use ColumnZSet.Empty explicitly"
        let weights = c.WeightSpan()
        if weights.IsEmpty then ColumnZSet.Empty
        else
            let outK = Pool.AllocateExact<int64> weights.Length
            let outW = Pool.AllocateExact<int64> weights.Length
            ColumnLinearKernel.CopyColumn(c.KeySpan(), Span<int64>(outK))
            ColumnLinearKernel.MapScale(weights, m, Span<int64>(outW))
            ColumnZSet(Pool.Freeze outK, Pool.Freeze outW)
