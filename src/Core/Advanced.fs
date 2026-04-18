namespace Zeta.Core

open System
open System.Collections.Generic
open System.Runtime.CompilerServices
open System.Runtime.InteropServices
open System.Threading
open System.Threading.Tasks


// ════════════════════════════════════════════════════════════════════════
// ═══ Core missing operators ═════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════


/// `Inspect` — side-effecting pass-through. Forwards its input unchanged and
/// invokes `sink` with each tick's value for logging, metrics, or tap-style
/// debugging. The `Action` is always called synchronously inside the tick.
[<Sealed>]
type internal InspectOp<'T>(input: Op<'T>, sink: Action<'T>) =
    inherit Op<'T>()
    let inputs = [| input :> Op |]
    override _.Name = "inspect"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        this.Value <- input.Value
        sink.Invoke this.Value
        ValueTask.CompletedTask


/// `Index` — re-key a Z-set by computing a new key function. Equivalent to
/// `SELECT keyFn(row), row FROM input`. Linear in the input.
[<Sealed>]
type internal IndexOp<'A, 'K when 'A : comparison and 'K : comparison>
    (input: Op<ZSet<'A>>, key: Func<'A, 'K>) =
    inherit Op<ZSet<'K * 'A>>()
    let inputs = [| input :> Op |]
    override _.Name = "index"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let span = input.Value.AsSpan()
        if span.IsEmpty then
            this.Value <- ZSet<'K * 'A>.Empty
        else
            let rented = Pool.Rent<ZEntry<'K * 'A>> span.Length
            try
                for i in 0 .. span.Length - 1 do
                    let k = key.Invoke span.[i].Key
                    rented.[i] <- ZEntry((k, span.[i].Key), span.[i].Weight)
                let live = ZSetBuilder.sortAndConsolidate (Span<_>(rented, 0, span.Length))
                this.Value <-
                    if live = 0 then ZSet<'K * 'A>.Empty
                    else ZSet(Pool.FreezeSlice(rented, live))
            finally
                Pool.Return rented
        ValueTask.CompletedTask


/// `Consolidate` — forces a materialization of the input. No-op semantically
/// but emits a canonicalized Z-set and gives the planner a fence point.
[<Sealed>]
type internal ConsolidateOp<'K when 'K : comparison>(input: Op<ZSet<'K>>) =
    inherit Op<ZSet<'K>>()
    let inputs = [| input :> Op |]
    override _.Name = "consolidate"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        this.Value <- input.Value  // already canonicalized by upstream
        ValueTask.CompletedTask


// ════════════════════════════════════════════════════════════════════════
// ═══ Outer joins (left / right / full) ══════════════════════════════════
// ════════════════════════════════════════════════════════════════════════


/// Left outer join — for every row in `a`, emit its join with all matching
/// `b` rows. Rows of `a` with no match get paired with the `defaultB` value
/// (NULL in SQL). Bilinear-ish; implemented as inner-join ∪ (a − semijoin(a,b))·default.
[<Sealed>]
type internal LeftOuterJoinOp<'A, 'B, 'K, 'C
    when 'A : comparison and 'B : comparison and 'K : comparison and 'C : comparison and 'K : not null>
    (a: Op<ZSet<'A>>,
     b: Op<ZSet<'B>>,
     keyA: Func<'A, 'K>,
     keyB: Func<'B, 'K>,
     combine: Func<'A, 'B, 'C>,
     defaultB: 'B) =
    inherit Op<ZSet<'C>>()
    let inputs = [| a :> Op; b :> Op |]
    override _.Name = "leftOuterJoin"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let sa = a.Value.AsSpan()
        let sb = b.Value.AsSpan()
        if sa.IsEmpty then
            this.Value <- ZSet<'C>.Empty
        else
            // Build `b` bucket index once. `heads.ContainsKey` serves as
            // our presence check — no separate `HashSet` needed.
            let heads = Dictionary<'K, int>(sb.Length, EqualityComparer<'K>.Default)
            let nextIdx = if sb.IsEmpty then Array.Empty<int>() else Pool.Rent<int> sb.Length
            try
                for j in 0 .. sb.Length - 1 do
                    let k = keyB.Invoke sb.[j].Key
                    let mutable head = -1
                    if heads.TryGetValue(k, &head) then
                        nextIdx.[j] <- head
                        heads.[k] <- j
                    else
                        nextIdx.[j] <- -1
                        heads.[k] <- j

                // Int64-promoted capacity guard — see ZSet.fs:join. The
                // outer-join worst case is (sa × sb) matched + sa unmatched.
                let cap64 = int64 sa.Length * int64 (max 1 sb.Length) + int64 sa.Length
                if cap64 > int64 System.Array.MaxLength then
                    invalidOp $"left-outer-join output would exceed Array.MaxLength (%d{sa.Length} × %d{sb.Length})"
                let rented = Pool.Rent<ZEntry<'C>> (int cap64)
                try
                    let mutable k = 0
                    for i in 0 .. sa.Length - 1 do
                        let kA = keyA.Invoke sa.[i].Key
                        let mutable head = -1
                        if heads.TryGetValue(kA, &head) then
                            let mutable j = head
                            while j >= 0 do
                                // Checked multiply — see ZSet.fs:cartesian.
                                let w = Checked.(*) sa.[i].Weight sb.[j].Weight
                                if w <> 0L then
                                    rented.[k] <- ZEntry(combine.Invoke(sa.[i].Key, sb.[j].Key), w)
                                    k <- k + 1
                                j <- nextIdx.[j]
                        if not (heads.ContainsKey kA) then
                            // Unmatched left row → pair with defaultB.
                            rented.[k] <- ZEntry(combine.Invoke(sa.[i].Key, defaultB), sa.[i].Weight)
                            k <- k + 1
                    if k = 0 then this.Value <- ZSet<'C>.Empty
                    else
                        let live = ZSetBuilder.sortAndConsolidate (Span<_>(rented, 0, k))
                        this.Value <-
                            if live = 0 then ZSet<'C>.Empty
                            else ZSet(Pool.FreezeSlice(rented, live))
                finally
                    Pool.Return rented
            finally
                if nextIdx.Length > 0 then Pool.Return nextIdx
        ValueTask.CompletedTask


// ════════════════════════════════════════════════════════════════════════
// ═══ Average aggregate ══════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════


/// `AVG(value) GROUP BY key`. Emits `(key, average)` with average as a float.
/// Incremental but recomputed per tick since division is nonlinear.
[<Sealed>]
type internal AverageOp<'K, 'G
    when 'K : comparison and 'G : comparison and 'G : not null>
    (input: Op<ZSet<'K>>, key: Func<'K, 'G>, value: Func<'K, int64>) =
    inherit Op<ZSet<'G * float>>()
    let inputs = [| input :> Op |]
    override _.Name = "average"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let span = input.Value.AsSpan()
        if span.IsEmpty then
            this.Value <- ZSet<'G * float>.Empty
        else
            let sums = Dictionary<'G, struct (int64 * int64)>(span.Length)
            for i in 0 .. span.Length - 1 do
                if span.[i].Weight > 0L then
                    let g = key.Invoke span.[i].Key
                    // Checked multiplies — user-controlled value × weight.
                    let v = Checked.(*) (value.Invoke span.[i].Key) span.[i].Weight
                    let mutable cur = struct (0L, 0L)
                    if sums.TryGetValue(g, &cur) then
                        let struct (s, c) = cur
                        sums.[g] <-
                            struct (Checked.(+) s v, Checked.(+) c span.[i].Weight)
                    else
                        sums.[g] <- struct (v, span.[i].Weight)
            let rented = Pool.Rent<ZEntry<'G * float>> sums.Count
            try
                let mutable k = 0
                for kv in sums do
                    let struct (s, c) = kv.Value
                    if c <> 0L then
                        rented.[k] <- ZEntry((kv.Key, float s / float c), 1L)
                        k <- k + 1
                if k = 0 then this.Value <- ZSet<'G * float>.Empty
                else
                    let live = ZSetBuilder.sortAndConsolidate (Span<_>(rented, 0, k))
                    this.Value <-
                        if live = 0 then ZSet<'G * float>.Empty
                        else ZSet(Pool.FreezeSlice(rented, live))
            finally
                Pool.Return rented
        ValueTask.CompletedTask


// ════════════════════════════════════════════════════════════════════════
// ═══ Generic fold ═══════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════


/// Generic scalar fold over a Z-set. Not incremental — the entire input is
/// refolded each tick. Use for one-shot reducers where the closed form
/// (like sum/count) is unavailable.
[<Sealed>]
type internal ScalarFoldOp<'K, 'S when 'K : comparison>
    (input: Op<ZSet<'K>>, initial: 'S, fold: Func<'S, 'K, int64, 'S>) =
    inherit Op<'S>()
    let inputs = [| input :> Op |]
    override _.Name = "scalarFold"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let span = input.Value.AsSpan()
        let mutable acc = initial
        for i in 0 .. span.Length - 1 do
            acc <- fold.Invoke(acc, span.[i].Key, span.[i].Weight)
        this.Value <- acc
        ValueTask.CompletedTask


// ════════════════════════════════════════════════════════════════════════
// ═══ Sliding window ═════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════


/// Sliding window — for each input row with time `t`, emit one tagged row
/// per window that contains `t`. With `windowSize = 10`, `slide = 5`, a row
/// with `t = 12` belongs to windows `[5..15)` and `[10..20)` and so emits
/// `(5, row)` and `(10, row)`. The `slide` param generalises the tumbling
/// window (when `slide = windowSize`) to hopping/sliding variants.
[<Sealed>]
type internal SlidingWindowOp<'K when 'K : comparison>
    (input: Op<ZSet<'K>>, timeOf: Func<'K, int64>, windowSize: int64, slide: int64) =
    inherit Op<ZSet<int64 * 'K>>()
    do
        if windowSize <= 0L then invalidArg "windowSize" "must be positive"
        if slide <= 0L then invalidArg "slide" "must be positive"
        // Cap windowsPer so a pathological user config (windowSize=2^62,
        // slide=1) can't explode into a trillion-element intermediate
        // allocation. The cap at 1024 matches Flink's sliding-window
        // bounds — beyond that, users should move to a session window.
        let est = windowSize / slide + (if windowSize % slide = 0L then 0L else 1L)
        if est > 1024L then
            invalidArg "windowSize" $"windowsPer ({est}) exceeds 1024 cap — reduce ratio windowSize/slide or use a tumbling/session window instead"
    let inputs = [| input :> Op |]
    let windowsPer = int (windowSize / slide) + (if windowSize % slide = 0L then 0 else 1)
    override _.Name = "slidingWindow"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let span = input.Value.AsSpan()
        if span.IsEmpty then
            this.Value <- ZSet<int64 * 'K>.Empty
        else
            // Checked multiply — span.Length × windowsPer could still
            // overflow int for very large spans, which would wrap to a
            // negative value and throw a less-helpful exception later.
            let capExact = Checked.(*) span.Length (max 1 windowsPer)
            let rented = Pool.Rent<ZEntry<int64 * 'K>> capExact
            try
                let mutable k = 0
                for i in 0 .. span.Length - 1 do
                    let t = timeOf.Invoke span.[i].Key
                    // First window start that contains t.
                    let firstStart = (t / slide) * slide
                    let mutable ws = firstStart
                    while ws > t - windowSize do
                        rented.[k] <- ZEntry((ws, span.[i].Key), span.[i].Weight)
                        k <- k + 1
                        ws <- ws - slide
                let live = ZSetBuilder.sortAndConsolidate (Span<_>(rented, 0, k))
                this.Value <-
                    if live = 0 then ZSet<int64 * 'K>.Empty
                    else ZSet(Pool.FreezeSlice(rented, live))
            finally
                Pool.Return rented
        ValueTask.CompletedTask


// ════════════════════════════════════════════════════════════════════════
// ═══ LAG / LEAD ═════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════


/// LAG by one tick — at tick `t`, emits the Z-set from tick `t-1`. Equivalent
/// to `DelayZSet` but named after its SQL analogue. Strict.
[<Sealed>]
type internal Lag1Op<'K when 'K : comparison>(input: Op<ZSet<'K>>) =
    inherit Op<ZSet<'K>>()
    let inputs = [| input :> Op |]
    let mutable state = ZSet<'K>.Empty
    override _.Name = "lag1"
    override _.Inputs = inputs
    override _.IsStrict = true
    override this.StepAsync(_: CancellationToken) =
        this.Value <- state
        ValueTask.CompletedTask
    override this.AfterStepAsync(_: CancellationToken) =
        state <- input.Value
        ValueTask.CompletedTask


// ════════════════════════════════════════════════════════════════════════
// ═══ Approximate distinct via HyperLogLog ══════════════════════════════
// ════════════════════════════════════════════════════════════════════════


/// Scalar approximate-distinct over a Z-set. Accumulates keys into a
/// `HyperLogLog` sketch and emits the cardinality estimate. Memory is
/// O(2^logBuckets) regardless of input size.
[<Sealed>]
type internal ApproxDistinctOp<'K when 'K : comparison>(input: Op<ZSet<'K>>, logBuckets: int) =
    inherit Op<int64>()
    let inputs = [| input :> Op |]
    let hll = HyperLogLog logBuckets
    override _.Name = "approxDistinct"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let span = input.Value.AsSpan()
        for i in 0 .. span.Length - 1 do
            if span.[i].Weight > 0L then hll.Add span.[i].Key
        this.Value <- hll.Estimate()
        ValueTask.CompletedTask


// ════════════════════════════════════════════════════════════════════════
// ═══ Extension surface ═════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════


[<Extension>]
type AdvancedExtensions =

    /// Side-effecting pass-through: forwards input, calls `sink` per tick.
    [<Extension>]
    static member Inspect<'T>(this: Circuit, s: Stream<'T>, sink: Action<'T>) : Stream<'T> =
        this.RegisterStream (InspectOp(s.Op, sink))

    /// Re-key a Z-set: emits `(key(x), x)` tuples.
    [<Extension>]
    static member Index<'A, 'K when 'A : comparison and 'K : comparison>
        (this: Circuit, s: Stream<ZSet<'A>>, key: Func<'A, 'K>) : Stream<ZSet<'K * 'A>> =
        this.RegisterStream (IndexOp(s.Op, key))

    /// Canonicalise the stream (no-op semantically; fences the planner).
    [<Extension>]
    static member Consolidate<'K when 'K : comparison>
        (this: Circuit, s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        this.RegisterStream (ConsolidateOp(s.Op))

    /// Left outer join — emits `combine(a, match)` for every match, plus
    /// `combine(a, defaultB)` for every unmatched `a`.
    [<Extension>]
    static member LeftOuterJoin<'A, 'B, 'K, 'C
        when 'A : comparison and 'B : comparison and 'K : comparison and 'C : comparison and 'K : not null>
        (this: Circuit,
         a: Stream<ZSet<'A>>, b: Stream<ZSet<'B>>,
         keyA: Func<'A, 'K>, keyB: Func<'B, 'K>,
         combine: Func<'A, 'B, 'C>,
         defaultB: 'B) : Stream<ZSet<'C>> =
        this.RegisterStream (LeftOuterJoinOp(a.Op, b.Op, keyA, keyB, combine, defaultB))

    /// Right outer join by swapping sides.
    [<Extension>]
    static member RightOuterJoin<'A, 'B, 'K, 'C
        when 'A : comparison and 'B : comparison and 'K : comparison and 'C : comparison and 'K : not null>
        (this: Circuit,
         a: Stream<ZSet<'A>>, b: Stream<ZSet<'B>>,
         keyA: Func<'A, 'K>, keyB: Func<'B, 'K>,
         combine: Func<'A, 'B, 'C>,
         defaultA: 'A) : Stream<ZSet<'C>> =
        let swapped = Func<'B, 'A, 'C>(fun b a -> combine.Invoke(a, b))
        this.RegisterStream (LeftOuterJoinOp(b.Op, a.Op, keyB, keyA, swapped, defaultA))

    /// `AVG(value) GROUP BY key` — returns `(key, avg)`.
    [<Extension>]
    static member GroupByAverage<'K, 'G
        when 'K : comparison and 'G : comparison and 'G : not null>
        (this: Circuit, s: Stream<ZSet<'K>>, key: Func<'K, 'G>, value: Func<'K, int64>)
            : Stream<ZSet<'G * float>> =
        this.RegisterStream (AverageOp(s.Op, key, value))

    /// Scalar fold — reduces the whole Z-set to a single value per tick.
    [<Extension>]
    static member ScalarFold<'K, 'S when 'K : comparison>
        (this: Circuit, s: Stream<ZSet<'K>>, initial: 'S, fold: Func<'S, 'K, int64, 'S>) : Stream<'S> =
        this.RegisterStream (ScalarFoldOp(s.Op, initial, fold))

    /// Sliding window (`slide = windowSize` reduces to tumbling).
    [<Extension>]
    static member SlidingWindow<'K when 'K : comparison>
        (this: Circuit, s: Stream<ZSet<'K>>, timeOf: Func<'K, int64>,
         windowSize: int64, slide: int64) : Stream<ZSet<int64 * 'K>> =
        if windowSize <= 0L then invalidArg (nameof windowSize) "must be positive"
        if slide <= 0L then invalidArg (nameof slide) "must be positive"
        this.RegisterStream (SlidingWindowOp(s.Op, timeOf, windowSize, slide))

    /// LAG(1) — emits the previous tick's Z-set. Named after SQL.
    [<Extension>]
    static member Lag1<'K when 'K : comparison>
        (this: Circuit, s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        this.RegisterStream (Lag1Op(s.Op))

    /// Approximate distinct count via HyperLogLog. `logBuckets = 12` gives
    /// ~1.6% error for 4 KB sketch; range [4, 16].
    [<Extension>]
    static member ApproxDistinct<'K when 'K : comparison>
        (this: Circuit, s: Stream<ZSet<'K>>, logBuckets: int) : Stream<int64> =
        this.RegisterStream (ApproxDistinctOp(s.Op, logBuckets))


// ════════════════════════════════════════════════════════════════════════
// ═══ DOT visualisation ═════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════════


[<Extension>]
type ExplainExtensions =

    /// Produce a GraphViz DOT representation of the circuit's operator
    /// graph. Useful for debugging complex plans and in-browser rendering
    /// (e.g., copy-paste into https://dreampuf.github.io/GraphvizOnline/).
    [<Extension>]
    static member ToDot(this: Circuit) : string =
        this.Build()
        let sb = System.Text.StringBuilder()
        sb.AppendLine "digraph DbspCircuit {" |> ignore
        sb.AppendLine "  rankdir=LR;" |> ignore
        sb.AppendLine "  node [shape=box, style=filled, fillcolor=\"#e8f0ff\", fontname=Helvetica];" |> ignore
        sb.AppendLine "  edge [fontname=Helvetica, fontsize=10];" |> ignore
        let ops = this.Ops
        for op in ops do
            let color =
                if op.IsStrict then "\"#fff4d6\""
                elif op.Inputs.Length = 0 then "\"#d6f4d6\""
                else "\"#e8f0ff\""
            sb.AppendLine(
                $"  n%d{op.Id} [label=\"%s{op.Name}#%d{op.Id}\", fillcolor=%s{color}];") |> ignore
        for op in ops do
            for dep in op.Inputs do
                let style = if op.IsStrict then " [style=dashed, label=\"z⁻¹\"]" else ""
                sb.AppendLine $"  n%d{dep.Id} -> n%d{op.Id}%s{style};" |> ignore
        sb.AppendLine "}" |> ignore
        sb.ToString()
