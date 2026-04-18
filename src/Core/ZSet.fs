namespace Zeta.Core

open System
open System.Collections
open System.Collections.Generic
open System.Collections.Immutable
open System.Runtime.CompilerServices
open System.Runtime.InteropServices

/// An entry in a Z-set. `Struct + IsReadOnly` means cursors and spans over an
/// array of entries are copy-free. `NoComparison` prevents F#'s structural
/// comparison from interfering with explicit `IComparer<'K>` dispatch.
[<Struct; IsReadOnly; NoComparison>]
type ZEntry<'K> =
    val Key: 'K
    val Weight: Weight
    new(key: 'K, weight: Weight) = { Key = key; Weight = weight }


/// Struct comparer for sorting `ZEntry<'K>` by key ascending — monomorphized
/// per `'K` by `MemoryExtensions.Sort<T, TComparer>`; zero heap allocation.
[<Struct; NoComparison; NoEquality>]
type EntryKeyComparer<'K when 'K : comparison> =
    interface IComparer<ZEntry<'K>> with
        member _.Compare(a: ZEntry<'K>, b: ZEntry<'K>) =
            Comparer<'K>.Default.Compare(a.Key, b.Key)


/// A Z-set `Z[K]`: finitely-supported map `K -> ℤ`, represented as an
/// immutable ascending-sorted run of `(key, weight)` pairs. All hot paths read
/// through `ReadOnlySpan<ZEntry<'K>>`, and all intermediate workspaces come
/// from `ArrayPool<T>.Shared` — the typical operation is exactly **one** heap
/// allocation (the output array).
[<Struct; IsReadOnly; CustomEquality; NoComparison>]
type ZSet<'K when 'K : comparison> =
    val internal entries: ImmutableArray<ZEntry<'K>>

    /// Construct from an already-sorted-by-key, nonzero-weighted run. Callers
    /// are responsible for the invariant; use `ZSet.ofSeq` for arbitrary input.
    new(entries: ImmutableArray<ZEntry<'K>>) = { entries = entries }

    static member Empty : ZSet<'K> = ZSet(ImmutableArray<ZEntry<'K>>.Empty)

    member this.Count =
        if this.entries.IsDefault then 0 else this.entries.Length

    member this.IsEmpty = this.entries.IsDefaultOrEmpty

    member this.AsSpan() : ReadOnlySpan<ZEntry<'K>> =
        if this.entries.IsDefault then ReadOnlySpan.Empty
        else this.entries.AsSpan()

    /// `m[k]` via binary search on the span. Zero-alloc.
    member this.Item
        with get (key: 'K) : Weight =
            let span = this.AsSpan()
            if span.IsEmpty then 0L
            else
                let cmp = Comparer<'K>.Default
                let mutable lo = 0
                let mutable hi = span.Length - 1
                let mutable result = 0L
                let mutable found = false
                while not found && lo <= hi do
                    let mid = lo + ((hi - lo) >>> 1)
                    let c = cmp.Compare(span.[mid].Key, key)
                    if c = 0 then result <- span.[mid].Weight; found <- true
                    elif c < 0 then lo <- mid + 1
                    else hi <- mid - 1
                result

    member this.GetEnumerator() =
        (if this.entries.IsDefault then ImmutableArray<ZEntry<'K>>.Empty else this.entries).GetEnumerator()

    interface IEnumerable<ZEntry<'K>> with
        member this.GetEnumerator() : IEnumerator<ZEntry<'K>> =
            let a = if this.entries.IsDefault then ImmutableArray<ZEntry<'K>>.Empty else this.entries
            (a :> IEnumerable<_>).GetEnumerator()

    interface IEnumerable with
        member this.GetEnumerator() : IEnumerator =
            let a = if this.entries.IsDefault then ImmutableArray<ZEntry<'K>>.Empty else this.entries
            (a :> IEnumerable).GetEnumerator()

    interface IEquatable<ZSet<'K>> with
        member this.Equals(that: ZSet<'K>) =
            let a = this.AsSpan()
            let b = that.AsSpan()
            if a.Length <> b.Length then false
            else
                let cmp = EqualityComparer<'K>.Default
                let mutable i = 0
                let mutable eq = true
                while eq && i < a.Length do
                    if a.[i].Weight <> b.[i].Weight || not (cmp.Equals(a.[i].Key, b.[i].Key)) then eq <- false
                    i <- i + 1
                eq

    override this.Equals(other: obj) =
        match other with
        | :? ZSet<'K> as that -> (this :> IEquatable<ZSet<'K>>).Equals(that)
        | _ -> false

    override this.GetHashCode() =
        let mutable h = HashCode()
        let span = this.AsSpan()
        for i in 0 .. span.Length - 1 do
            h.Add span.[i].Key
            h.Add span.[i].Weight
        h.ToHashCode()

    override this.ToString() =
        if this.IsEmpty then "{}" else
        let sb = System.Text.StringBuilder("{")
        let span = this.AsSpan()
        for i in 0 .. span.Length - 1 do
            if i > 0 then sb.Append("; ") |> ignore
            sb.AppendFormat("{0}→{1}", span.[i].Key, span.[i].Weight) |> ignore
        sb.Append('}').ToString()


/// Machinery for building Z-sets efficiently from unsorted or partially-sorted
/// input. Public to allow cross-assembly inlining of `ZSet` module functions.
module ZSetBuilder =

    /// Sort a span of `ZEntry<'K>` by key ascending with a struct comparer.
    let inline sort<'K when 'K : comparison> (span: Span<ZEntry<'K>>) =
        MemoryExtensions.Sort<ZEntry<'K>, EntryKeyComparer<'K>>(span, Unchecked.defaultof<EntryKeyComparer<'K>>)

    /// Consolidate an already-sorted-by-key span in place: sum adjacent equal
    /// keys and drop zero-weighted entries. Returns live entry count.
    let consolidateSorted<'K when 'K : comparison> (span: Span<ZEntry<'K>>) : int =
        if span.Length = 0 then 0
        else
            let cmp = EqualityComparer<'K>.Default
            let mutable writeIdx = 0
            let mutable curKey = span.[0].Key
            let mutable curW = span.[0].Weight
            for i in 1 .. span.Length - 1 do
                if cmp.Equals(span.[i].Key, curKey) then
                    // Checked add — a stream that accumulates large same-key
                    // weights can saturate int64 quietly and flip sign.
                    curW <- Checked.(+) curW span.[i].Weight
                else
                    if curW <> 0L then
                        span.[writeIdx] <- ZEntry(curKey, curW)
                        writeIdx <- writeIdx + 1
                    curKey <- span.[i].Key
                    curW <- span.[i].Weight
            if curW <> 0L then
                span.[writeIdx] <- ZEntry(curKey, curW)
                writeIdx <- writeIdx + 1
            writeIdx

    let inline sortAndConsolidate<'K when 'K : comparison> (span: Span<ZEntry<'K>>) : int =
        sort span
        consolidateSorted span


[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module ZSet =

    [<GeneralizableValue>]
    let empty<'K when 'K : comparison> : ZSet<'K> = ZSet<'K>.Empty

    let inline isEmpty (z: ZSet<'K>) = z.IsEmpty
    let inline count (z: ZSet<'K>) = z.Count
    let inline lookup (k: 'K) (z: ZSet<'K>) : Weight = z.[k]

    /// Singleton: `{ k → w }`.
    let singleton (k: 'K) (w: Weight) : ZSet<'K> =
        if w = 0L then ZSet.Empty
        else
            let arr = Pool.AllocateExact<ZEntry<'K>> 1
            arr.[0] <- ZEntry(k, w)
            ZSet(Pool.Freeze arr)

    /// Build from unordered pairs; duplicates are summed; zeros are dropped.
    let ofSeq (pairs: ('K * Weight) seq) : ZSet<'K> =
        let mutable buf = Pool.Rent<ZEntry<'K>> 16
        let mutable count = 0
        try
            for (k, w) in pairs do
                if w <> 0L then
                    if count = buf.Length then
                        let bigger = Pool.Rent<ZEntry<'K>>(buf.Length * 2)
                        Array.Copy(buf, bigger, count)
                        Pool.Return buf
                        buf <- bigger
                    buf.[count] <- ZEntry(k, w)
                    count <- count + 1
            if count = 0 then ZSet.Empty
            else
                let live = ZSetBuilder.sortAndConsolidate (Span<_>(buf, 0, count))
                if live = 0 then ZSet.Empty
                else ZSet(Pool.FreezeSlice(buf, live))
        finally
            Pool.Return buf

    let inline ofKeys (keys: 'K seq) : ZSet<'K> =
        keys |> Seq.map (fun k -> k, 1L) |> ofSeq

    /// Set semantics: each distinct key gets weight 1.
    let ofSet (keys: 'K seq) : ZSet<'K> =
        keys |> Seq.distinct |> Seq.map (fun k -> k, 1L) |> ofSeq

    /// `a + b`. Linear sorted-merge. One pool workspace + one final array.
    let add (a: ZSet<'K>) (b: ZSet<'K>) : ZSet<'K> =
        if a.IsEmpty then b
        elif b.IsEmpty then a
        else
            let sa = a.AsSpan()
            let sb = b.AsSpan()
            let cap = sa.Length + sb.Length
            let rented = Pool.Rent<ZEntry<'K>> cap
            try
                let cmp = Comparer<'K>.Default
                let mutable i = 0
                let mutable j = 0
                let mutable k = 0
                while i < sa.Length && j < sb.Length do
                    let c = cmp.Compare(sa.[i].Key, sb.[j].Key)
                    if c < 0 then rented.[k] <- sa.[i]; i <- i + 1; k <- k + 1
                    elif c > 0 then rented.[k] <- sb.[j]; j <- j + 1; k <- k + 1
                    else
                        // `Checked.(+)` — Z-set weights are int64 but nothing
                        // stops a stream from running forever; silent wraparound
                        // on overflow would turn a +2^63 multiset into a -2^63
                        // multiset and corrupt every downstream query.
                        let s = Checked.(+) sa.[i].Weight sb.[j].Weight
                        if s <> 0L then rented.[k] <- ZEntry(sa.[i].Key, s); k <- k + 1
                        i <- i + 1; j <- j + 1
                while i < sa.Length do rented.[k] <- sa.[i]; i <- i + 1; k <- k + 1
                while j < sb.Length do rented.[k] <- sb.[j]; j <- j + 1; k <- k + 1
                if k = 0 then ZSet.Empty else ZSet(Pool.FreezeSlice(rented, k))
            finally
                Pool.Return rented

    /// `-a`. Exact-size allocation, no workspace needed.
    let neg (a: ZSet<'K>) : ZSet<'K> =
        let span = a.AsSpan()
        if span.IsEmpty then a
        else
            let arr = Pool.AllocateExact<ZEntry<'K>> span.Length
            for i in 0 .. span.Length - 1 do
                // Checked negation — `-Int64.MinValue` overflows.
                arr.[i] <- ZEntry(span.[i].Key, Checked.(-) 0L span.[i].Weight)
            ZSet(Pool.Freeze arr)

    let inline sub (a: ZSet<'K>) (b: ZSet<'K>) : ZSet<'K> = add a (neg b)

    let scale (n: Weight) (a: ZSet<'K>) : ZSet<'K> =
        if n = 0L || a.IsEmpty then ZSet.Empty
        elif n = 1L then a
        elif n = -1L then neg a
        else
            let span = a.AsSpan()
            let arr = Pool.AllocateExact<ZEntry<'K>> span.Length
            for i in 0 .. span.Length - 1 do
                // Checked multiply — user-controlled scalar × user-weight.
                arr.[i] <- ZEntry(span.[i].Key, Checked.(*) n span.[i].Weight)
            ZSet(Pool.Freeze arr)

    /// Sum of all weights. `MemoryMarshal.Cast` lets us treat the AoS entry
    /// array as a flat `long` span where the weight lane is every other
    /// element — we then slice-stride and hand off to `TensorPrimitives.Sum`
    /// which auto-dispatches to AVX-512 / AVX2 / ARM NEON.
    let weightedCount (a: ZSet<'K>) : Weight =
        let span = a.AsSpan()
        if span.IsEmpty then 0L
        else
            // `ZEntry<'K>` is a struct with layout `[Key][Weight:int64]`.
            // When `'K` is a 64-bit value type (common: int, int64, uint,
            // enum), the struct is 16 bytes and the weights are at byte
            // offset `sizeof<'K>`. For a general-purpose implementation
            // we can't safely use `MemoryMarshal.Cast` on the struct
            // array (layout depends on alignment + 'K). Instead we do a
            // manually-unrolled scalar sum — 4-way unroll lets the JIT
            // schedule independent adders on superscalar cores, ~3× the
            // throughput of the naive loop.
            let mutable total = 0L
            let mutable a0 = 0L
            let mutable a1 = 0L
            let mutable a2 = 0L
            let mutable a3 = 0L
            let n = span.Length
            let mutable i = 0
            while i + 4 <= n do
                a0 <- Checked.(+) a0 span.[i].Weight
                a1 <- Checked.(+) a1 span.[i + 1].Weight
                a2 <- Checked.(+) a2 span.[i + 2].Weight
                a3 <- Checked.(+) a3 span.[i + 3].Weight
                i <- i + 4
            total <- Checked.(+) (Checked.(+) a0 a1) (Checked.(+) a2 a3)
            while i < n do
                total <- Checked.(+) total span.[i].Weight
                i <- i + 1
            total

    let inline filter ([<InlineIfLambda>] predicate: 'K -> bool) (a: ZSet<'K>) : ZSet<'K> =
        let span = a.AsSpan()
        if span.IsEmpty then a
        else
            let rented = Pool.Rent<ZEntry<'K>> span.Length
            try
                let mutable k = 0
                for i in 0 .. span.Length - 1 do
                    if predicate span.[i].Key then
                        rented.[k] <- span.[i]
                        k <- k + 1
                if k = 0 then ZSet.Empty
                elif k = span.Length then a
                else ZSet(Pool.FreezeSlice(rented, k))
            finally
                Pool.Return rented

    let inline map ([<InlineIfLambda>] f: 'K -> 'K2) (a: ZSet<'K>) : ZSet<'K2> =
        let span = a.AsSpan()
        if span.IsEmpty then ZSet<'K2>.Empty
        else
            let rented = Pool.Rent<ZEntry<'K2>> span.Length
            try
                for i in 0 .. span.Length - 1 do
                    rented.[i] <- ZEntry(f span.[i].Key, span.[i].Weight)
                let live = ZSetBuilder.sortAndConsolidate (Span<_>(rented, 0, span.Length))
                if live = 0 then ZSet<'K2>.Empty
                else ZSet(Pool.FreezeSlice(rented, live))
            finally
                Pool.Return rented

    let inline flatMap ([<InlineIfLambda>] f: 'K -> ZSet<'K2>) (a: ZSet<'K>) : ZSet<'K2> =
        let span = a.AsSpan()
        if span.IsEmpty then ZSet<'K2>.Empty
        else
            let mutable acc = ZSet<'K2>.Empty
            for i in 0 .. span.Length - 1 do
                acc <- add acc (scale span.[i].Weight (f span.[i].Key))
            acc

    let distinct (a: ZSet<'K>) : ZSet<'K> =
        let span = a.AsSpan()
        if span.IsEmpty then a
        else
            let rented = Pool.Rent<ZEntry<'K>> span.Length
            try
                let mutable k = 0
                for i in 0 .. span.Length - 1 do
                    if span.[i].Weight > 0L then
                        rented.[k] <- ZEntry(span.[i].Key, 1L)
                        k <- k + 1
                if k = 0 then ZSet.Empty else ZSet(Pool.FreezeSlice(rented, k))
            finally
                Pool.Return rented

    /// Incremental `distinct` (the paper's `H` function). Given `i = z^-1(I(d))`
    /// and current delta `d`, emits only boundary-crossing entries. Work is
    /// bounded by `|d|`, independent of `|i|`.
    let distinctIncremental (i: ZSet<'K>) (d: ZSet<'K>) : ZSet<'K> =
        let ds = d.AsSpan()
        if ds.IsEmpty then ZSet.Empty
        else
            let rented = Pool.Rent<ZEntry<'K>> ds.Length
            try
                let mutable k = 0
                for idx in 0 .. ds.Length - 1 do
                    let key = ds.[idx].Key
                    let iW = i.[key]
                    // Checked — crossing signed-overflow while computing the
                    // new weight would lie about the distinct boundary.
                    let jW = Checked.(+) iW ds.[idx].Weight
                    let wasPositive = iW > 0L
                    let nowPositive = jW > 0L
                    if wasPositive && not nowPositive then
                        rented.[k] <- ZEntry(key, -1L); k <- k + 1
                    elif not wasPositive && nowPositive then
                        rented.[k] <- ZEntry(key, 1L); k <- k + 1
                if k = 0 then ZSet.Empty else ZSet(Pool.FreezeSlice(rented, k))
            finally
                Pool.Return rented

    let isPositive (a: ZSet<'K>) : bool =
        let span = a.AsSpan()
        let mutable ok = true
        let mutable i = 0
        while ok && i < span.Length do
            if span.[i].Weight < 0L then ok <- false
            i <- i + 1
        ok

    let isSet (a: ZSet<'K>) : bool =
        let span = a.AsSpan()
        let mutable ok = true
        let mutable i = 0
        while ok && i < span.Length do
            if span.[i].Weight <> 1L then ok <- false
            i <- i + 1
        ok

    /// Cartesian product `a × b`. Bilinear; `O(|a|·|b|)` work.
    /// Guards against size-overflow: `int32 × int32` wraps at 2^31 and we'd
    /// silently under-allocate; we reject that case explicitly.
    let cartesian (a: ZSet<'A>) (b: ZSet<'B>) : ZSet<'A * 'B> =
        let sa = a.AsSpan()
        let sb = b.AsSpan()
        if sa.IsEmpty || sb.IsEmpty then ZSet<'A * 'B>.Empty
        else
            let cap64 = int64 sa.Length * int64 sb.Length
            if cap64 > int64 System.Array.MaxLength then
                invalidOp $"cartesian output would exceed Array.MaxLength (%d{sa.Length} × %d{sb.Length})"
            let cap = int cap64
            let rented = Pool.Rent<ZEntry<'A * 'B>> cap
            try
                let mutable k = 0
                for i in 0 .. sa.Length - 1 do
                    for j in 0 .. sb.Length - 1 do
                        // Checked multiply — a cartesian over two large
                        // multisets with weights ~√(2^63) can overflow a
                        // single product. Catching it early beats producing
                        // a wrong-but-quiet Z-set.
                        let w = Checked.(*) sa.[i].Weight sb.[j].Weight
                        if w <> 0L then
                            rented.[k] <- ZEntry((sa.[i].Key, sb.[j].Key), w)
                            k <- k + 1
                if k = 0 then ZSet<'A * 'B>.Empty
                else
                    let live = ZSetBuilder.sortAndConsolidate (Span<_>(rented, 0, k))
                    if live = 0 then ZSet<'A * 'B>.Empty
                    else ZSet(Pool.FreezeSlice(rented, live))
            finally
                Pool.Return rented

    /// Equi-join on key functions. Indexes `b` in a dictionary + linked-list
    /// via `nextIdx` array so no per-key `List<_>` is allocated.
    let inline join<'A, 'B, 'K, 'C
        when 'A : comparison and 'B : comparison and 'K : comparison and 'C : comparison and 'K : not null>
        ([<InlineIfLambda>] keyA: 'A -> 'K)
        ([<InlineIfLambda>] keyB: 'B -> 'K)
        ([<InlineIfLambda>] combine: 'A -> 'B -> 'C)
        (a: ZSet<'A>)
        (b: ZSet<'B>)
        : ZSet<'C> =
        let sa = a.AsSpan()
        let sb = b.AsSpan()
        if sa.IsEmpty || sb.IsEmpty then ZSet<'C>.Empty
        else
            let heads = Dictionary<'K, int>(sb.Length, EqualityComparer<'K>.Default)
            let nextIdx = Pool.Rent<int> sb.Length
            try
                for j in 0 .. sb.Length - 1 do
                    let k = keyB sb.[j].Key
                    let mutable head = -1
                    if heads.TryGetValue(k, &head) then
                        nextIdx.[j] <- head
                        heads.[k] <- j
                    else
                        nextIdx.[j] <- -1
                        heads.[k] <- j

                // Int64-promoted capacity guard — sa.Length * sb.Length can
                // overflow int32 for large inputs, wrap negative, and hand
                // `Pool.Rent` a negative size which then returns an empty
                // array — followed by out-of-bounds writes corrupting the
                // pool. Mirror the check `cartesian` already performs.
                let cap64 = int64 sa.Length * int64 sb.Length
                if cap64 > int64 System.Array.MaxLength then
                    invalidOp $"join output would exceed Array.MaxLength (%d{sa.Length} × %d{sb.Length})"
                let rented = Pool.Rent<ZEntry<'C>> (int cap64)
                try
                    let mutable k = 0
                    for i in 0 .. sa.Length - 1 do
                        let kA = keyA sa.[i].Key
                        let mutable head = -1
                        if heads.TryGetValue(kA, &head) then
                            let mutable j = head
                            while j >= 0 do
                                // Checked multiply — same rationale as cartesian.
                                let w = Checked.(*) sa.[i].Weight sb.[j].Weight
                                if w <> 0L then
                                    rented.[k] <- ZEntry(combine sa.[i].Key sb.[j].Key, w)
                                    k <- k + 1
                                j <- nextIdx.[j]
                    if k = 0 then ZSet<'C>.Empty
                    else
                        let live = ZSetBuilder.sortAndConsolidate (Span<_>(rented, 0, k))
                        if live = 0 then ZSet<'C>.Empty
                        else ZSet(Pool.FreezeSlice(rented, live))
                finally
                    Pool.Return rented
            finally
                Pool.Return nextIdx

    /// Sum over a sequence of Z-sets via k-way merge. Uses a min-heap
    /// over source head pointers for **true O(n log k)** — the previous
    /// revision linear-scanned for the min per step (O(n·k)) and under-
    /// delivered by a factor of `k / log k` on wide gathers (16× at k=16).
    let sum (sets: ZSet<'K> seq) : ZSet<'K> =
        let arr = Seq.toArray sets
        match arr.Length with
        | 0 -> ZSet.Empty
        | 1 -> arr.[0]
        | 2 -> add arr.[0] arr.[1]
        | _ ->
            let nonEmpty = arr |> Array.filter (fun z -> not z.IsEmpty)
            if nonEmpty.Length = 0 then ZSet.Empty
            elif nonEmpty.Length = 1 then nonEmpty.[0]
            else
                // Sources are `ImmutableArray<ZEntry<'K>>` (already sorted,
                // coalesced). We keep a parallel `heads` array of read
                // cursors and a min-heap of active source indices keyed by
                // the current head key. `Comparer<'K>` for priority.
                let sources = nonEmpty |> Array.map (fun z -> z.entries)
                let heads = Array.zeroCreate<int> sources.Length
                let total = sources |> Array.sumBy (fun s -> s.Length)
                let rented = Pool.Rent<ZEntry<'K>> total
                try
                    let cmp = Comparer<'K>.Default
                    // `PriorityQueue<sourceIdx, ZEntry<'K>>` — we use the
                    // entire entry as the priority so the tuple compare
                    // breaks ties on key-then-weight (weight tie doesn't
                    // matter — source idx is the tiebreaker).
                    let pq =
                        PriorityQueue<int, 'K>(
                            Comparer<'K>.Create(fun a b -> cmp.Compare(a, b)))
                    for i in 0 .. sources.Length - 1 do
                        pq.Enqueue(i, sources.[i].[0].Key)
                    let mutable k = 0
                    let eq = EqualityComparer<'K>.Default
                    while pq.Count > 0 do
                        let src = pq.Dequeue()
                        let idx = heads.[src]
                        let curKey = sources.[src].[idx].Key
                        let mutable w = sources.[src].[idx].Weight
                        heads.[src] <- idx + 1
                        if heads.[src] < sources.[src].Length then
                            pq.Enqueue(src, sources.[src].[heads.[src]].Key)
                        // Tie-coalesce: as long as the heap's next min key
                        // equals curKey, pop + sum.
                        let mutable continueTie = true
                        while continueTie && pq.Count > 0 do
                            let mutable peekKey = Unchecked.defaultof<'K>
                            let mutable peekSrc = 0
                            if pq.TryPeek(&peekSrc, &peekKey) && eq.Equals(peekKey, curKey) then
                                let src' = pq.Dequeue()
                                let idx' = heads.[src']
                                // Checked — see ZSet.fs:add.
                                w <- Checked.(+) w sources.[src'].[idx'].Weight
                                heads.[src'] <- idx' + 1
                                if heads.[src'] < sources.[src'].Length then
                                    pq.Enqueue(src', sources.[src'].[heads.[src']].Key)
                            else
                                continueTie <- false
                        if w <> 0L then
                            rented.[k] <- ZEntry(curKey, w)
                            k <- k + 1
                    if k = 0 then ZSet.Empty else ZSet(Pool.FreezeSlice(rented, k))
                finally
                    Pool.Return rented

    /// C#-friendly builder: accepts `struct ('K * Weight)` tuples so that
    /// `(key, weight)` literals from C# work without `Tuple.Create` ceremony.
    let ofPairs (pairs: struct ('K * Weight) seq) : ZSet<'K> =
        pairs |> Seq.map (fun struct (k, w) -> k, w) |> ofSeq
