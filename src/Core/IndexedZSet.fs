namespace Zeta.Core

open System
open System.Collections.Generic
open System.Collections.Immutable
open System.Runtime.CompilerServices
open System.Runtime.InteropServices

/// A per-key group inside an `IndexedZSet`. Immutable struct, span-friendly.
[<Struct; IsReadOnly; NoComparison>]
type KeyGroup<'K, 'V when 'K : comparison and 'V : comparison> =
    val Key: 'K
    val Values: ZSet<'V>
    new(key, values) = { Key = key; Values = values }


[<Struct; NoComparison; NoEquality>]
type KeyGroupComparer<'K, 'V when 'K : comparison and 'V : comparison> =
    interface IComparer<KeyGroup<'K, 'V>> with
        member _.Compare(a: KeyGroup<'K, 'V>, b: KeyGroup<'K, 'V>) =
            Comparer<'K>.Default.Compare(a.Key, b.Key)


/// `IndexedZSet<'K,'V>` is conceptually `Z[K × V]` but stored as a sorted run
/// of `KeyGroup<'K,'V>` giving O(log k) key lookup for joins and span-friendly
/// merges.
[<Struct; IsReadOnly; CustomEquality; NoComparison>]
type IndexedZSet<'K, 'V when 'K : comparison and 'V : comparison> =
    val internal groups: ImmutableArray<KeyGroup<'K, 'V>>

    /// Construct from an already-sorted-by-key run of per-key groups. Callers
    /// are responsible for the invariant; prefer `IndexedZSet.indexWith`.
    new(groups: ImmutableArray<KeyGroup<'K, 'V>>) = { groups = groups }

    static member Empty : IndexedZSet<'K, 'V> =
        IndexedZSet(ImmutableArray<KeyGroup<'K, 'V>>.Empty)

    member this.KeyCount =
        if this.groups.IsDefault then 0 else this.groups.Length

    member this.IsEmpty = this.groups.IsDefaultOrEmpty

    member this.AsSpan() : ReadOnlySpan<KeyGroup<'K, 'V>> =
        if this.groups.IsDefault then ReadOnlySpan.Empty
        else this.groups.AsSpan()

    member this.Item
        with get (key: 'K) : ZSet<'V> =
            let span = this.AsSpan()
            if span.IsEmpty then ZSet<'V>.Empty
            else
                let cmp = Comparer<'K>.Default
                let mutable lo = 0
                let mutable hi = span.Length - 1
                let mutable result = ZSet<'V>.Empty
                let mutable found = false
                while not found && lo <= hi do
                    let mid = lo + ((hi - lo) >>> 1)
                    let c = cmp.Compare(span.[mid].Key, key)
                    if c = 0 then result <- span.[mid].Values; found <- true
                    elif c < 0 then lo <- mid + 1
                    else hi <- mid - 1
                result

    member this.GetEnumerator() =
        (if this.groups.IsDefault then ImmutableArray<KeyGroup<'K, 'V>>.Empty else this.groups).GetEnumerator()

    interface IEquatable<IndexedZSet<'K, 'V>> with
        member this.Equals(that) =
            let a = this.AsSpan()
            let b = that.AsSpan()
            if a.Length <> b.Length then false
            else
                let cmp = EqualityComparer<'K>.Default
                let mutable i = 0
                let mutable eq = true
                while eq && i < a.Length do
                    if not (cmp.Equals(a.[i].Key, b.[i].Key)) ||
                       not ((a.[i].Values :> IEquatable<ZSet<'V>>).Equals(b.[i].Values)) then
                        eq <- false
                    i <- i + 1
                eq

    override this.Equals(other: obj) =
        match other with
        | :? IndexedZSet<'K, 'V> as that ->
            (this :> IEquatable<IndexedZSet<'K, 'V>>).Equals that
        | _ -> false

    override this.GetHashCode() =
        let mutable h = HashCode()
        let span = this.AsSpan()
        for i in 0 .. span.Length - 1 do
            h.Add span.[i].Key
            h.Add span.[i].Values
        h.ToHashCode()


[<RequireQualifiedAccess>]
[<CompilationRepresentation(CompilationRepresentationFlags.ModuleSuffix)>]
module IndexedZSet =

    [<GeneralizableValue>]
    let empty<'K, 'V when 'K : comparison and 'V : comparison> : IndexedZSet<'K, 'V> =
        IndexedZSet<'K, 'V>.Empty

    let inline isEmpty (i: IndexedZSet<'K, 'V>) = i.IsEmpty
    let inline keyCount (i: IndexedZSet<'K, 'V>) = i.KeyCount

    /// Index a Z-set by extracting a key and a value from each entry.
    /// Implements a bucket-chained index: `bucketHead[k] = first i`;
    /// `nextIdx[i] = next i`. No `List<_>` per key is allocated.
    let inline indexWith<'A, 'K, 'V
        when 'A : comparison and 'K : comparison and 'V : comparison and 'K : not null>
        ([<InlineIfLambda>] key: 'A -> 'K)
        ([<InlineIfLambda>] value: 'A -> 'V)
        (z: ZSet<'A>)
        : IndexedZSet<'K, 'V> =
        let span = z.AsSpan()
        if span.IsEmpty then IndexedZSet<'K, 'V>.Empty
        else
            let bucketHead = Dictionary<'K, int>(span.Length, EqualityComparer<'K>.Default)
            let nextIdx = Pool.Rent<int> span.Length
            let keys = Pool.Rent<'K> span.Length
            let values = Pool.Rent<'V> span.Length
            let weights = Pool.Rent<Weight> span.Length
            try
                for i in 0 .. span.Length - 1 do
                    let k = key span.[i].Key
                    keys.[i] <- k
                    values.[i] <- value span.[i].Key
                    weights.[i] <- span.[i].Weight
                    let mutable head = -1
                    if bucketHead.TryGetValue(k, &head) then
                        nextIdx.[i] <- head
                        bucketHead.[k] <- i
                    else
                        nextIdx.[i] <- -1
                        bucketHead.[k] <- i

                if bucketHead.Count = 0 then IndexedZSet<'K, 'V>.Empty
                else
                    let kbuf = Pool.Rent<'K> bucketHead.Count
                    try
                        let mutable ki = 0
                        for kv in bucketHead do
                            kbuf.[ki] <- kv.Key
                            ki <- ki + 1
                        let keysSpan = Span<'K>(kbuf, 0, bucketHead.Count)
                        keysSpan.Sort<'K>()

                        let groupArr = Pool.AllocateExact<KeyGroup<'K, 'V>> bucketHead.Count
                        let valueBuf = Pool.Rent<ZEntry<'V>> span.Length
                        try
                            let mutable gi = 0
                            for sIdx in 0 .. bucketHead.Count - 1 do
                                let k = keysSpan.[sIdx]
                                let mutable j = bucketHead.[k]
                                let mutable vcount = 0
                                while j >= 0 do
                                    valueBuf.[vcount] <- ZEntry(values.[j], weights.[j])
                                    vcount <- vcount + 1
                                    j <- nextIdx.[j]
                                let live = ZSetBuilder.sortAndConsolidate (Span<_>(valueBuf, 0, vcount))
                                if live > 0 then
                                    groupArr.[gi] <- KeyGroup(k, ZSet(Pool.FreezeSlice(valueBuf, live)))
                                    gi <- gi + 1
                            if gi = 0 then IndexedZSet<'K, 'V>.Empty
                            elif gi = bucketHead.Count then
                                IndexedZSet(Pool.Freeze groupArr)
                            else
                                IndexedZSet(Pool.FreezeSlice(groupArr, gi))
                        finally
                            Pool.Return valueBuf
                    finally
                        Pool.Return kbuf
            finally
                Pool.Return nextIdx
                Pool.Return keys
                Pool.Return values
                Pool.Return weights

    let tupleCount (i: IndexedZSet<'K, 'V>) : int =
        let span = i.AsSpan()
        let mutable n = 0
        for idx in 0 .. span.Length - 1 do n <- n + span.[idx].Values.Count
        n

    let toZSet (i: IndexedZSet<'K, 'V>) : ZSet<'K * 'V> =
        let gs = i.AsSpan()
        if gs.IsEmpty then ZSet<'K * 'V>.Empty
        else
            let total = tupleCount i
            let rented = Pool.Rent<ZEntry<'K * 'V>> total
            try
                let mutable k = 0
                for idx in 0 .. gs.Length - 1 do
                    let group = gs.[idx]
                    let vs = group.Values.AsSpan()
                    for j in 0 .. vs.Length - 1 do
                        rented.[k] <- ZEntry((group.Key, vs.[j].Key), vs.[j].Weight)
                        k <- k + 1
                if k = 0 then ZSet<'K * 'V>.Empty else ZSet(Pool.FreezeSlice(rented, k))
            finally
                Pool.Return rented

    let add (a: IndexedZSet<'K, 'V>) (b: IndexedZSet<'K, 'V>) : IndexedZSet<'K, 'V> =
        if a.IsEmpty then b
        elif b.IsEmpty then a
        else
            let ga = a.AsSpan()
            let gb = b.AsSpan()
            let cap = ga.Length + gb.Length
            let rented = Pool.Rent<KeyGroup<'K, 'V>> cap
            try
                let cmp = Comparer<'K>.Default
                let mutable i = 0
                let mutable j = 0
                let mutable k = 0
                while i < ga.Length && j < gb.Length do
                    let c = cmp.Compare(ga.[i].Key, gb.[j].Key)
                    if c < 0 then rented.[k] <- ga.[i]; i <- i + 1; k <- k + 1
                    elif c > 0 then rented.[k] <- gb.[j]; j <- j + 1; k <- k + 1
                    else
                        let merged = ZSet.add ga.[i].Values gb.[j].Values
                        if not merged.IsEmpty then
                            rented.[k] <- KeyGroup(ga.[i].Key, merged)
                            k <- k + 1
                        i <- i + 1; j <- j + 1
                while i < ga.Length do rented.[k] <- ga.[i]; i <- i + 1; k <- k + 1
                while j < gb.Length do rented.[k] <- gb.[j]; j <- j + 1; k <- k + 1
                if k = 0 then IndexedZSet<'K, 'V>.Empty
                else IndexedZSet(Pool.FreezeSlice(rented, k))
            finally
                Pool.Return rented

    let neg (a: IndexedZSet<'K, 'V>) : IndexedZSet<'K, 'V> =
        let span = a.AsSpan()
        if span.IsEmpty then a
        else
            let arr = Pool.AllocateExact<KeyGroup<'K, 'V>> span.Length
            for i in 0 .. span.Length - 1 do
                arr.[i] <- KeyGroup(span.[i].Key, ZSet.neg span.[i].Values)
            IndexedZSet(Pool.Freeze arr)

    let inline sub (a: IndexedZSet<'K, 'V>) (b: IndexedZSet<'K, 'V>) : IndexedZSet<'K, 'V> =
        add a (neg b)

    let inline join
        ([<InlineIfLambda>] combine: 'K -> 'VA -> 'VB -> 'C)
        (a: IndexedZSet<'K, 'VA>)
        (b: IndexedZSet<'K, 'VB>)
        : ZSet<'C> =
        let ga = a.AsSpan()
        let gb = b.AsSpan()
        if ga.IsEmpty || gb.IsEmpty then ZSet<'C>.Empty
        else
            let cmp = Comparer<'K>.Default
            // Accumulate cap in int64 to avoid 2^31 wrap on wide joins.
            let mutable cap64 = 0L
            let mutable i = 0
            let mutable j = 0
            while i < ga.Length && j < gb.Length do
                let c = cmp.Compare(ga.[i].Key, gb.[j].Key)
                if c < 0 then i <- i + 1
                elif c > 0 then j <- j + 1
                else
                    cap64 <- cap64 + int64 ga.[i].Values.Count * int64 gb.[j].Values.Count
                    i <- i + 1; j <- j + 1
            if cap64 = 0L then ZSet<'C>.Empty
            elif cap64 > int64 System.Array.MaxLength then
                invalidOp $"indexed-join output would exceed Array.MaxLength ({cap64})"
            else
                let rented = Pool.Rent<ZEntry<'C>> (int cap64)
                try
                    let mutable ii = 0
                    let mutable jj = 0
                    let mutable k = 0
                    while ii < ga.Length && jj < gb.Length do
                        let c = cmp.Compare(ga.[ii].Key, gb.[jj].Key)
                        if c < 0 then ii <- ii + 1
                        elif c > 0 then jj <- jj + 1
                        else
                            let va = ga.[ii].Values.AsSpan()
                            let vb = gb.[jj].Values.AsSpan()
                            for x in 0 .. va.Length - 1 do
                                for y in 0 .. vb.Length - 1 do
                                    // Checked multiply — see ZSet.fs:cartesian.
                                    let w = Checked.(*) va.[x].Weight vb.[y].Weight
                                    if w <> 0L then
                                        rented.[k] <- ZEntry(combine ga.[ii].Key va.[x].Key vb.[y].Key, w)
                                        k <- k + 1
                            ii <- ii + 1; jj <- jj + 1
                    if k = 0 then ZSet<'C>.Empty
                    else
                        let live = ZSetBuilder.sortAndConsolidate (Span<_>(rented, 0, k))
                        if live = 0 then ZSet<'C>.Empty
                        else ZSet(Pool.FreezeSlice(rented, live))
                finally
                    Pool.Return rented
