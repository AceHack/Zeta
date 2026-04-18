namespace Zeta.Core

open System
open System.Collections.Generic
open System.Runtime.CompilerServices
open System.Threading
open System.Threading.Tasks


/// As-of join — for each left row, match the right row with the **largest**
/// timestamp ≤ the left row's timestamp, joined on a shared partition key.
/// Classic for event-correlation ("enrich each trade with the quote in
/// effect at that moment"). Behaves like a left-outer join when no right
/// row exists at or before the left row's time.
///
/// This is a non-streaming implementation — every tick recomputes from
/// the full integrated relations. For streaming-incremental versions see
/// `SpineAsofJoin` in a future extension.
[<Sealed>]
type internal AsofJoinOp<'A, 'B, 'K, 'C
    when 'A : comparison and 'B : comparison and 'K : comparison and 'C : comparison and 'K : not null>
    (a: Op<ZSet<'A>>,
     b: Op<ZSet<'B>>,
     keyA: Func<'A, 'K>,
     keyB: Func<'B, 'K>,
     timeA: Func<'A, int64>,
     timeB: Func<'B, int64>,
     combine: Func<'A, 'B, 'C>,
     defaultB: 'B) =
    inherit Op<ZSet<'C>>()
    let inputs = [| a :> Op; b :> Op |]
    override _.Name = "asofJoin"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let sa = a.Value.AsSpan()
        let sb = b.Value.AsSpan()
        if sa.IsEmpty then
            this.Value <- ZSet<'C>.Empty
        else
            // Bucket b by key, sort each bucket by time ascending so we can
            // binary-search for the latest row with `time ≤ t_a`.
            let byKey = Dictionary<'K, ResizeArray<struct (int64 * 'B * Weight)>>(sb.Length, EqualityComparer.Default)
            for j in 0 .. sb.Length - 1 do
                if sb.[j].Weight > 0L then
                    let k = keyB.Invoke sb.[j].Key
                    let lst =
                        match byKey.TryGetValue k with
                        | true, l -> l
                        | _ ->
                            let l = ResizeArray()
                            byKey.[k] <- l
                            l
                    lst.Add(struct (timeB.Invoke sb.[j].Key, sb.[j].Key, sb.[j].Weight))
            for lst in byKey.Values do
                lst.Sort(Comparison<_>(fun struct (t1, _, _) struct (t2, _, _) -> compare t1 t2))
            let rented = Pool.Rent<ZEntry<'C>> sa.Length
            try
                let mutable n = 0
                for i in 0 .. sa.Length - 1 do
                    if sa.[i].Weight > 0L then
                        let kA = keyA.Invoke sa.[i].Key
                        let tA = timeA.Invoke sa.[i].Key
                        let mutable picked = defaultB
                        match byKey.TryGetValue kA with
                        | true, lst ->
                            // Binary search for largest index with t ≤ tA.
                            let mutable lo = 0
                            let mutable hi = lst.Count - 1
                            let mutable bestIdx = -1
                            while lo <= hi do
                                let mid = lo + ((hi - lo) >>> 1)
                                let struct (tm, _, _) = lst.[mid]
                                if tm <= tA then bestIdx <- mid; lo <- mid + 1
                                else hi <- mid - 1
                            if bestIdx >= 0 then
                                let struct (_, v, _) = lst.[bestIdx]
                                picked <- v
                        | _ -> ()
                        // Emit either matched row or defaultB pairing.
                        rented.[n] <- ZEntry(combine.Invoke(sa.[i].Key, picked), sa.[i].Weight)
                        n <- n + 1
                if n = 0 then this.Value <- ZSet<'C>.Empty
                else
                    let live = ZSetBuilder.sortAndConsolidate (Span<_>(rented, 0, n))
                    this.Value <-
                        if live = 0 then ZSet<'C>.Empty
                        else ZSet(Pool.FreezeSlice(rented, live))
            finally
                Pool.Return rented
        ValueTask.CompletedTask


/// Range join — for each left row, emit one joined row per right row whose
/// timestamp falls in `[leftTime + lowerOffset, leftTime + upperOffset]` on
/// the matching partition key. Useful for "trades within 5 seconds of each
/// headline" kinds of queries.
[<Sealed>]
type internal RangeJoinOp<'A, 'B, 'K, 'C
    when 'A : comparison and 'B : comparison and 'K : comparison and 'C : comparison and 'K : not null>
    (a: Op<ZSet<'A>>, b: Op<ZSet<'B>>,
     keyA: Func<'A, 'K>, keyB: Func<'B, 'K>,
     timeA: Func<'A, int64>, timeB: Func<'B, int64>,
     lowerOffset: int64, upperOffset: int64,
     combine: Func<'A, 'B, 'C>) =
    inherit Op<ZSet<'C>>()
    let inputs = [| a :> Op; b :> Op |]
    override _.Name = "rangeJoin"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let sa = a.Value.AsSpan()
        let sb = b.Value.AsSpan()
        if sa.IsEmpty || sb.IsEmpty then
            this.Value <- ZSet<'C>.Empty
        else
            let byKey = Dictionary<'K, ResizeArray<struct (int64 * 'B * Weight)>>(sb.Length, EqualityComparer.Default)
            for j in 0 .. sb.Length - 1 do
                let k = keyB.Invoke sb.[j].Key
                let lst =
                    match byKey.TryGetValue k with
                    | true, l -> l
                    | _ ->
                        let l = ResizeArray()
                        byKey.[k] <- l
                        l
                lst.Add(struct (timeB.Invoke sb.[j].Key, sb.[j].Key, sb.[j].Weight))
            for lst in byKey.Values do
                lst.Sort(Comparison<_>(fun struct (t1, _, _) struct (t2, _, _) -> compare t1 t2))

            // Int64-promoted capacity guard — see ZSet.fs:join.
            let cap64 = int64 sa.Length * int64 sb.Length
            if cap64 > int64 System.Array.MaxLength then
                invalidOp $"range-join output would exceed Array.MaxLength (%d{sa.Length} × %d{sb.Length})"
            let rented = Pool.Rent<ZEntry<'C>> (int cap64)
            try
                let mutable n = 0
                for i in 0 .. sa.Length - 1 do
                    let kA = keyA.Invoke sa.[i].Key
                    let tA = timeA.Invoke sa.[i].Key
                    // Checked int64 add — attacker-controlled time + offset can
                    // overflow Int64.MaxValue; silent wrap breaks binary search.
                    let lo = Checked.(+) tA lowerOffset
                    let hi = Checked.(+) tA upperOffset
                    match byKey.TryGetValue kA with
                    | true, lst ->
                        // Binary-search the lower bound, then linear scan while ≤ hi.
                        let mutable l = 0
                        let mutable h = lst.Count - 1
                        let mutable startIdx = lst.Count
                        while l <= h do
                            let mid = l + ((h - l) >>> 1)
                            let struct (tm, _, _) = lst.[mid]
                            if tm >= lo then startIdx <- mid; h <- mid - 1
                            else l <- mid + 1
                        let mutable idx = startIdx
                        while idx < lst.Count && (let struct (tm, _, _) = lst.[idx] in tm <= hi) do
                            let struct (_, v, w) = lst.[idx]
                            // Checked multiply — see ZSet.fs:cartesian.
                            let outW = Checked.(*) sa.[i].Weight w
                            if outW <> 0L then
                                rented.[n] <- ZEntry(combine.Invoke(sa.[i].Key, v), outW)
                                n <- n + 1
                            idx <- idx + 1
                    | _ -> ()
                if n = 0 then this.Value <- ZSet<'C>.Empty
                else
                    let live = ZSetBuilder.sortAndConsolidate (Span<_>(rented, 0, n))
                    this.Value <-
                        if live = 0 then ZSet<'C>.Empty
                        else ZSet(Pool.FreezeSlice(rented, live))
            finally
                Pool.Return rented
        ValueTask.CompletedTask


[<Extension>]
type TimeSeriesExtensions =

    /// As-of join: each row of `a` matched with the latest row of `b` at
    /// or before its timestamp, per matching partition key. Unmatched `a`
    /// rows pair with `defaultB` (SQL NULL analogue).
    [<Extension>]
    static member AsofJoin<'A, 'B, 'K, 'C
        when 'A : comparison and 'B : comparison and 'K : comparison and 'C : comparison and 'K : not null>
        (this: Circuit,
         a: Stream<ZSet<'A>>, b: Stream<ZSet<'B>>,
         keyA: Func<'A, 'K>, keyB: Func<'B, 'K>,
         timeA: Func<'A, int64>, timeB: Func<'B, int64>,
         combine: Func<'A, 'B, 'C>,
         defaultB: 'B) : Stream<ZSet<'C>> =
        this.RegisterStream (AsofJoinOp(a.Op, b.Op, keyA, keyB, timeA, timeB, combine, defaultB))

    /// Range join: each row of `a` joined with rows of `b` whose timestamp
    /// falls in `[timeA + lowerOffset, timeA + upperOffset]` on the matching key.
    [<Extension>]
    static member RangeJoin<'A, 'B, 'K, 'C
        when 'A : comparison and 'B : comparison and 'K : comparison and 'C : comparison and 'K : not null>
        (this: Circuit,
         a: Stream<ZSet<'A>>, b: Stream<ZSet<'B>>,
         keyA: Func<'A, 'K>, keyB: Func<'B, 'K>,
         timeA: Func<'A, int64>, timeB: Func<'B, int64>,
         lowerOffset: int64, upperOffset: int64,
         combine: Func<'A, 'B, 'C>) : Stream<ZSet<'C>> =
        this.RegisterStream (
            RangeJoinOp(a.Op, b.Op, keyA, keyB, timeA, timeB, lowerOffset, upperOffset, combine))
