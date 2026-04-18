namespace Zeta.Core

open System
open System.Collections.Generic
open System.Runtime.CompilerServices
open System.Runtime.InteropServices
open System.Threading
open System.Threading.Tasks


/// `COUNT(*) GROUP BY key` — emits `Z[K × int64]` with one entry per key.
[<Sealed>]
type internal CountOp<'K, 'G when 'K : comparison and 'G : comparison and 'G : not null>
    (input: Op<ZSet<'K>>, key: Func<'K, 'G>) =
    inherit Op<ZSet<'G * int64>>()
    let inputs = [| input :> Op |]
    override _.Name = "count"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let span = input.Value.AsSpan()
        if span.IsEmpty then
            this.Value <- ZSet<'G * int64>.Empty
        else
            let counts = Dictionary<'G, int64>(span.Length)
            for i in 0 .. span.Length - 1 do
                let g = key.Invoke span.[i].Key
                let mutable cur = 0L
                // Checked — a group that accumulates many same-key rows can
                // saturate int64.
                if counts.TryGetValue(g, &cur) then counts.[g] <- Checked.(+) cur span.[i].Weight
                else counts.[g] <- span.[i].Weight
            let rented = Pool.Rent<ZEntry<'G * int64>> counts.Count
            try
                let mutable k = 0
                for kv in counts do
                    if kv.Value <> 0L then
                        rented.[k] <- ZEntry((kv.Key, kv.Value), 1L)
                        k <- k + 1
                if k = 0 then this.Value <- ZSet<'G * int64>.Empty
                else
                    let live = ZSetBuilder.sortAndConsolidate (Span<_>(rented, 0, k))
                    this.Value <-
                        if live = 0 then ZSet<'G * int64>.Empty
                        else ZSet(Pool.FreezeSlice(rented, live))
            finally
                Pool.Return rented
        ValueTask.CompletedTask


/// Generic single-pass aggregate: min, max, or any other fold over a group.
/// Only defined on *positive* Z-sets; retracting an element requires recompute
/// which is expensive; the paper reserves this form for monotone aggregates.
[<Sealed>]
type internal MinMaxOp<'K, 'G, 'V
    when 'K : comparison and 'G : comparison and 'V : comparison and 'G : not null>
    (input: Op<ZSet<'K>>,
     key: Func<'K, 'G>,
     value: Func<'K, 'V>,
     combine: Func<'V, 'V, 'V>) =
    inherit Op<ZSet<'G * 'V>>()
    let inputs = [| input :> Op |]
    override _.Name = "minmax"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let span = input.Value.AsSpan()
        if span.IsEmpty then
            this.Value <- ZSet<'G * 'V>.Empty
        else
            let agg = Dictionary<'G, 'V>(span.Length)
            let seen = Dictionary<'G, bool>(span.Length)
            for i in 0 .. span.Length - 1 do
                if span.[i].Weight > 0L then
                    let g = key.Invoke span.[i].Key
                    let v = value.Invoke span.[i].Key
                    let mutable cur = Unchecked.defaultof<'V>
                    if agg.TryGetValue(g, &cur) then
                        agg.[g] <- combine.Invoke(cur, v)
                    else
                        agg.[g] <- v
                        seen.[g] <- true
            let rented = Pool.Rent<ZEntry<'G * 'V>> agg.Count
            try
                let mutable k = 0
                for kv in agg do
                    rented.[k] <- ZEntry((kv.Key, kv.Value), 1L)
                    k <- k + 1
                if k = 0 then this.Value <- ZSet<'G * 'V>.Empty
                else
                    let live = ZSetBuilder.sortAndConsolidate (Span<_>(rented, 0, k))
                    this.Value <-
                        if live = 0 then ZSet<'G * 'V>.Empty
                        else ZSet(Pool.FreezeSlice(rented, live))
            finally
                Pool.Return rented
        ValueTask.CompletedTask


/// `topK` — for each group, emit the top-K entries by a comparable order.
[<Sealed>]
type internal TopKOp<'K, 'G
    when 'K : comparison and 'G : comparison and 'G : not null>
    (input: Op<ZSet<'K>>, key: Func<'K, 'G>, k: int, compareDesc: Func<'K, 'K, int>) =
    inherit Op<ZSet<'K>>()
    let inputs = [| input :> Op |]
    override _.Name = "topK"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let span = input.Value.AsSpan()
        if span.IsEmpty || k <= 0 then
            this.Value <- ZSet<'K>.Empty
        else
            let groups = Dictionary<'G, ResizeArray<ZEntry<'K>>>(span.Length)
            for i in 0 .. span.Length - 1 do
                if span.[i].Weight > 0L then
                    let g = key.Invoke span.[i].Key
                    let bucket =
                        match groups.TryGetValue g with
                        | true, b -> b
                        | _ ->
                            let b = ResizeArray()
                            groups.[g] <- b
                            b
                    bucket.Add span.[i]
            let rented = Pool.Rent<ZEntry<'K>> (span.Length)
            try
                let mutable n = 0
                let cmp = Comparison<ZEntry<'K>>(fun a b -> compareDesc.Invoke(a.Key, b.Key))
                for bucket in groups.Values do
                    bucket.Sort cmp
                    let take = min k bucket.Count
                    for idx in 0 .. take - 1 do
                        rented.[n] <- bucket.[idx]
                        n <- n + 1
                if n = 0 then this.Value <- ZSet<'K>.Empty
                else
                    let live = ZSetBuilder.sortAndConsolidate (Span<_>(rented, 0, n))
                    this.Value <-
                        if live = 0 then ZSet<'K>.Empty
                        else ZSet(Pool.FreezeSlice(rented, live))
            finally
                Pool.Return rented
        ValueTask.CompletedTask


/// Antijoin: `a - σ_{key(a) ∈ keys(b)}(a)`. Emits rows of `a` whose key has
/// no match in `b`. Linear in `a`, bilinear overall.
[<Sealed>]
type internal AntijoinOp<'A, 'B, 'K
    when 'A : comparison and 'B : comparison and 'K : comparison and 'K : not null>
    (a: Op<ZSet<'A>>, b: Op<ZSet<'B>>, keyA: Func<'A, 'K>, keyB: Func<'B, 'K>) =
    inherit Op<ZSet<'A>>()
    let inputs = [| a :> Op; b :> Op |]
    override _.Name = "antijoin"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let sa = a.Value.AsSpan()
        let sb = b.Value.AsSpan()
        if sa.IsEmpty then
            this.Value <- ZSet<'A>.Empty
        elif sb.IsEmpty then
            this.Value <- a.Value
        else
            // Build presence set of b-keys.
            let present = HashSet<'K>(sb.Length, EqualityComparer<'K>.Default)
            for i in 0 .. sb.Length - 1 do
                if sb.[i].Weight > 0L then
                    present.Add(keyB.Invoke sb.[i].Key) |> ignore
            let rented = Pool.Rent<ZEntry<'A>> sa.Length
            try
                let mutable n = 0
                for i in 0 .. sa.Length - 1 do
                    if not (present.Contains(keyA.Invoke sa.[i].Key)) then
                        rented.[n] <- sa.[i]
                        n <- n + 1
                if n = 0 then this.Value <- ZSet<'A>.Empty
                elif n = sa.Length then this.Value <- a.Value
                else this.Value <- ZSet(Pool.FreezeSlice(rented, n))
            finally
                Pool.Return rented
        ValueTask.CompletedTask


/// Semijoin: rows of `a` whose key DOES match something in `b`. The dual of
/// antijoin; useful for `EXISTS` / `IN` subqueries.
[<Sealed>]
type internal SemijoinOp<'A, 'B, 'K
    when 'A : comparison and 'B : comparison and 'K : comparison and 'K : not null>
    (a: Op<ZSet<'A>>, b: Op<ZSet<'B>>, keyA: Func<'A, 'K>, keyB: Func<'B, 'K>) =
    inherit Op<ZSet<'A>>()
    let inputs = [| a :> Op; b :> Op |]
    override _.Name = "semijoin"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let sa = a.Value.AsSpan()
        let sb = b.Value.AsSpan()
        if sa.IsEmpty || sb.IsEmpty then
            this.Value <- ZSet<'A>.Empty
        else
            let present = HashSet<'K>(sb.Length, EqualityComparer<'K>.Default)
            for i in 0 .. sb.Length - 1 do
                if sb.[i].Weight > 0L then
                    present.Add(keyB.Invoke sb.[i].Key) |> ignore
            let rented = Pool.Rent<ZEntry<'A>> sa.Length
            try
                let mutable n = 0
                for i in 0 .. sa.Length - 1 do
                    if present.Contains(keyA.Invoke sa.[i].Key) then
                        rented.[n] <- sa.[i]
                        n <- n + 1
                if n = 0 then this.Value <- ZSet<'A>.Empty
                elif n = sa.Length then this.Value <- a.Value
                else this.Value <- ZSet(Pool.FreezeSlice(rented, n))
            finally
                Pool.Return rented
        ValueTask.CompletedTask


/// Sum across *all* keys — single-row aggregate, no group-by.
[<Sealed>]
type internal ScalarSumOp<'K when 'K : comparison>
    (input: Op<ZSet<'K>>, value: Func<'K, int64>) =
    inherit Op<int64>()
    let inputs = [| input :> Op |]
    override _.Name = "scalarSum"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let span = input.Value.AsSpan()
        let mutable total = 0L
        for i in 0 .. span.Length - 1 do
            // Checked × and + — user-controlled value × weight can overflow.
            let contrib = Checked.(*) (value.Invoke span.[i].Key) span.[i].Weight
            total <- Checked.(+) total contrib
        this.Value <- total
        ValueTask.CompletedTask


/// Scalar `COUNT(*)` — emits `int64`.
[<Sealed>]
type internal ScalarCountOp<'K when 'K : comparison>(input: Op<ZSet<'K>>) =
    inherit Op<int64>()
    let inputs = [| input :> Op |]
    override _.Name = "scalarCount"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        this.Value <- ZSet.weightedCount input.Value
        ValueTask.CompletedTask


[<Extension>]
type AggregateExtensions =

    /// `COUNT(*) GROUP BY key`.
    [<Extension>]
    static member GroupByCount<'K, 'G
        when 'K : comparison and 'G : comparison and 'G : not null>
        (this: Circuit, s: Stream<ZSet<'K>>, key: Func<'K, 'G>) : Stream<ZSet<'G * int64>> =
        this.RegisterStream (CountOp(s.Op, key))

    /// `MIN(value) GROUP BY key`. Requires positive Z-set (monotone input).
    [<Extension>]
    static member GroupByMin<'K, 'G, 'V
        when 'K : comparison and 'G : comparison and 'V : comparison and 'G : not null>
        (this: Circuit, s: Stream<ZSet<'K>>, key: Func<'K, 'G>, value: Func<'K, 'V>) : Stream<ZSet<'G * 'V>> =
        let cmp = Comparer<'V>.Default
        let min = Func<'V, 'V, 'V>(fun a b -> if cmp.Compare(a, b) <= 0 then a else b)
        this.RegisterStream (MinMaxOp(s.Op, key, value, min))

    /// `MAX(value) GROUP BY key`.
    [<Extension>]
    static member GroupByMax<'K, 'G, 'V
        when 'K : comparison and 'G : comparison and 'V : comparison and 'G : not null>
        (this: Circuit, s: Stream<ZSet<'K>>, key: Func<'K, 'G>, value: Func<'K, 'V>) : Stream<ZSet<'G * 'V>> =
        let cmp = Comparer<'V>.Default
        let max = Func<'V, 'V, 'V>(fun a b -> if cmp.Compare(a, b) >= 0 then a else b)
        this.RegisterStream (MinMaxOp(s.Op, key, value, max))

    /// `TOP-K` per group by custom descending comparator.
    [<Extension>]
    static member GroupByTopK<'K, 'G
        when 'K : comparison and 'G : comparison and 'G : not null>
        (this: Circuit, s: Stream<ZSet<'K>>, key: Func<'K, 'G>, k: int, compareDesc: Func<'K, 'K, int>) : Stream<ZSet<'K>> =
        this.RegisterStream (TopKOp(s.Op, key, k, compareDesc))

    /// Anti-join — rows of `a` whose key is *not* in `b`.
    [<Extension>]
    static member Antijoin<'A, 'B, 'K
        when 'A : comparison and 'B : comparison and 'K : comparison and 'K : not null>
        (this: Circuit,
         a: Stream<ZSet<'A>>, b: Stream<ZSet<'B>>,
         keyA: Func<'A, 'K>, keyB: Func<'B, 'K>) : Stream<ZSet<'A>> =
        this.RegisterStream (AntijoinOp(a.Op, b.Op, keyA, keyB))

    /// Semi-join — rows of `a` whose key IS in `b`.
    [<Extension>]
    static member Semijoin<'A, 'B, 'K
        when 'A : comparison and 'B : comparison and 'K : comparison and 'K : not null>
        (this: Circuit,
         a: Stream<ZSet<'A>>, b: Stream<ZSet<'B>>,
         keyA: Func<'A, 'K>, keyB: Func<'B, 'K>) : Stream<ZSet<'A>> =
        this.RegisterStream (SemijoinOp(a.Op, b.Op, keyA, keyB))

    /// Scalar `COUNT(*)` over a Z-set (emits `int64` stream).
    [<Extension>]
    static member ScalarCount<'K when 'K : comparison>
        (this: Circuit, s: Stream<ZSet<'K>>) : Stream<int64> =
        this.RegisterStream (ScalarCountOp(s.Op))

    /// Scalar `SUM(value)` over a Z-set (emits `int64` stream).
    [<Extension>]
    static member ScalarSum<'K when 'K : comparison>
        (this: Circuit, s: Stream<ZSet<'K>>, value: Func<'K, int64>) : Stream<int64> =
        this.RegisterStream (ScalarSumOp(s.Op, value))
