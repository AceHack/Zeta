namespace Zeta.Core

open System
open System.Collections.Generic
open System.Runtime.CompilerServices
open System.Threading
open System.Threading.Tasks


[<Sealed>]
type internal MapZSetOp<'A, 'B when 'A : comparison and 'B : comparison>(input: Op<ZSet<'A>>, f: Func<'A, 'B>) =
    inherit Op<ZSet<'B>>()
    let inputs = [| input :> Op |]
    override _.Name = "map"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        this.Value <- ZSet.map f.Invoke input.Value
        ValueTask.CompletedTask


[<Sealed>]
type internal FilterZSetOp<'K when 'K : comparison>(input: Op<ZSet<'K>>, predicate: Func<'K, bool>) =
    inherit Op<ZSet<'K>>()
    let inputs = [| input :> Op |]
    override _.Name = "filter"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        this.Value <- ZSet.filter predicate.Invoke input.Value
        ValueTask.CompletedTask


[<Sealed>]
type internal FlatMapZSetOp<'A, 'B when 'A : comparison and 'B : comparison>
    (input: Op<ZSet<'A>>, f: Func<'A, ZSet<'B>>) =
    inherit Op<ZSet<'B>>()
    let inputs = [| input :> Op |]
    override _.Name = "flatMap"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        this.Value <- ZSet.flatMap f.Invoke input.Value
        ValueTask.CompletedTask


[<Sealed>]
type internal PlusZSetOp<'K when 'K : comparison>(a: Op<ZSet<'K>>, b: Op<ZSet<'K>>) =
    inherit Op<ZSet<'K>>()
    let inputs = [| a :> Op; b :> Op |]
    override _.Name = "plus"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        this.Value <- ZSet.add a.Value b.Value
        ValueTask.CompletedTask


[<Sealed>]
type internal MinusZSetOp<'K when 'K : comparison>(a: Op<ZSet<'K>>, b: Op<ZSet<'K>>) =
    inherit Op<ZSet<'K>>()
    let inputs = [| a :> Op; b :> Op |]
    override _.Name = "minus"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        this.Value <- ZSet.sub a.Value b.Value
        ValueTask.CompletedTask


[<Sealed>]
type internal NegZSetOp<'K when 'K : comparison>(a: Op<ZSet<'K>>) =
    inherit Op<ZSet<'K>>()
    let inputs = [| a :> Op |]
    override _.Name = "neg"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        this.Value <- ZSet.neg a.Value
        ValueTask.CompletedTask


[<Sealed>]
type internal DistinctZSetOp<'K when 'K : comparison>(input: Op<ZSet<'K>>) =
    inherit Op<ZSet<'K>>()
    let inputs = [| input :> Op |]
    override _.Name = "distinct"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        this.Value <- ZSet.distinct input.Value
        ValueTask.CompletedTask


[<Sealed>]
type internal DistinctIncrementalOp<'K when 'K : comparison>(integralPrev: Op<ZSet<'K>>, delta: Op<ZSet<'K>>) =
    inherit Op<ZSet<'K>>()
    let inputs = [| integralPrev :> Op; delta :> Op |]
    override _.Name = "distinctIncremental"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        this.Value <- ZSet.distinctIncremental integralPrev.Value delta.Value
        ValueTask.CompletedTask


[<Sealed>]
type internal JoinZSetOp<'A, 'B, 'K, 'C
    when 'A : comparison and 'B : comparison and 'K : comparison and 'C : comparison and 'K : not null>
    (a: Op<ZSet<'A>>,
     b: Op<ZSet<'B>>,
     keyA: Func<'A, 'K>,
     keyB: Func<'B, 'K>,
     combine: Func<'A, 'B, 'C>) =
    inherit Op<ZSet<'C>>()
    let inputs = [| a :> Op; b :> Op |]
    override _.Name = "join"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        this.Value <-
            ZSet.join
                keyA.Invoke
                keyB.Invoke
                (fun x y -> combine.Invoke(x, y))
                a.Value b.Value
        ValueTask.CompletedTask


[<Sealed>]
type internal CartesianZSetOp<'A, 'B when 'A : comparison and 'B : comparison>
    (a: Op<ZSet<'A>>, b: Op<ZSet<'B>>) =
    inherit Op<ZSet<'A * 'B>>()
    let inputs = [| a :> Op; b :> Op |]
    override _.Name = "cartesian"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        this.Value <- ZSet.cartesian a.Value b.Value
        ValueTask.CompletedTask


[<Sealed>]
type internal GroupBySumOp<'K, 'G when 'K : comparison and 'G : comparison and 'G : not null>
    (input: Op<ZSet<'K>>, key: Func<'K, 'G>, value: Func<'K, int64>) =
    inherit Op<ZSet<'G * int64>>()
    let inputs = [| input :> Op |]
    override _.Name = "groupBySum"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let span = input.Value.AsSpan()
        if span.IsEmpty then
            this.Value <- ZSet<'G * int64>.Empty
        else
            let sums = Dictionary<'G, int64>(span.Length)
            for i in 0 .. span.Length - 1 do
                let g = key.Invoke span.[i].Key
                // Checked × — user value × weight.
                let v = Checked.(*) (value.Invoke span.[i].Key) span.[i].Weight
                let mutable existing = 0L
                if sums.TryGetValue(g, &existing) then
                    sums.[g] <- Checked.(+) existing v
                else
                    sums.[g] <- v
            let rented = Pool.Rent<ZEntry<'G * int64>> sums.Count
            try
                let mutable k = 0
                for kv in sums do
                    if kv.Value <> 0L then
                        rented.[k] <- ZEntry((kv.Key, kv.Value), 1L)
                        k <- k + 1
                if k = 0 then
                    this.Value <- ZSet<'G * int64>.Empty
                else
                    let live = ZSetBuilder.sortAndConsolidate (Span<_>(rented, 0, k))
                    this.Value <-
                        if live = 0 then ZSet<'G * int64>.Empty
                        else ZSet(Pool.FreezeSlice(rented, live))
            finally
                Pool.Return rented
        ValueTask.CompletedTask


[<Sealed>]
type internal IndexWithOp<'A, 'K, 'V
    when 'A : comparison and 'K : comparison and 'V : comparison and 'K : not null>
    (input: Op<ZSet<'A>>, key: Func<'A, 'K>, value: Func<'A, 'V>) =
    inherit Op<IndexedZSet<'K, 'V>>()
    let inputs = [| input :> Op |]
    override _.Name = "indexWith"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        this.Value <- IndexedZSet.indexWith key.Invoke value.Invoke input.Value
        ValueTask.CompletedTask


[<Sealed>]
type internal IndexedJoinOp<'K, 'VA, 'VB, 'C
    when 'K : comparison and 'VA : comparison and 'VB : comparison and 'C : comparison and 'K : not null>
    (a: Op<IndexedZSet<'K, 'VA>>,
     b: Op<IndexedZSet<'K, 'VB>>,
     combine: Func<'K, 'VA, 'VB, 'C>) =
    inherit Op<ZSet<'C>>()
    let inputs = [| a :> Op; b :> Op |]
    override _.Name = "indexedJoin"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        this.Value <-
            IndexedZSet.join
                (fun k va vb -> combine.Invoke(k, va, vb))
                a.Value b.Value
        ValueTask.CompletedTask


/// Linear/bilinear operator builders exposed as extension methods on `Circuit`.
[<Extension>]
type OperatorExtensions =

    [<Extension>]
    static member Map<'A, 'B when 'A : comparison and 'B : comparison>
        (this: Circuit, s: Stream<ZSet<'A>>, f: Func<'A, 'B>) : Stream<ZSet<'B>> =
        this.RegisterStream (MapZSetOp(s.Op, f))

    [<Extension>]
    static member Filter<'K when 'K : comparison>
        (this: Circuit, s: Stream<ZSet<'K>>, predicate: Func<'K, bool>) : Stream<ZSet<'K>> =
        this.RegisterStream (FilterZSetOp(s.Op, predicate))

    [<Extension>]
    static member FlatMap<'A, 'B when 'A : comparison and 'B : comparison>
        (this: Circuit, s: Stream<ZSet<'A>>, f: Func<'A, ZSet<'B>>) : Stream<ZSet<'B>> =
        this.RegisterStream (FlatMapZSetOp(s.Op, f))

    [<Extension>]
    static member Plus<'K when 'K : comparison>
        (this: Circuit, a: Stream<ZSet<'K>>, b: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        this.RegisterStream (PlusZSetOp(a.Op, b.Op))

    [<Extension>]
    static member Minus<'K when 'K : comparison>
        (this: Circuit, a: Stream<ZSet<'K>>, b: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        this.RegisterStream (MinusZSetOp(a.Op, b.Op))

    [<Extension>]
    static member Negate<'K when 'K : comparison>
        (this: Circuit, s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        this.RegisterStream (NegZSetOp(s.Op))

    [<Extension>]
    static member Distinct<'K when 'K : comparison>
        (this: Circuit, s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        this.RegisterStream (DistinctZSetOp(s.Op))

    [<Extension>]
    static member DistinctIncremental<'K when 'K : comparison>
        (this: Circuit, integralPrev: Stream<ZSet<'K>>, delta: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        this.RegisterStream (DistinctIncrementalOp(integralPrev.Op, delta.Op))

    [<Extension>]
    static member Join<'A, 'B, 'K, 'C
        when 'A : comparison and 'B : comparison and 'K : comparison and 'C : comparison and 'K : not null>
        (this: Circuit,
         a: Stream<ZSet<'A>>,
         b: Stream<ZSet<'B>>,
         keyA: Func<'A, 'K>,
         keyB: Func<'B, 'K>,
         combine: Func<'A, 'B, 'C>) : Stream<ZSet<'C>> =
        this.RegisterStream (JoinZSetOp(a.Op, b.Op, keyA, keyB, combine))

    [<Extension>]
    static member Cartesian<'A, 'B when 'A : comparison and 'B : comparison>
        (this: Circuit, a: Stream<ZSet<'A>>, b: Stream<ZSet<'B>>) : Stream<ZSet<'A * 'B>> =
        this.RegisterStream (CartesianZSetOp(a.Op, b.Op))

    [<Extension>]
    static member GroupBySum<'K, 'G when 'K : comparison and 'G : comparison and 'G : not null>
        (this: Circuit,
         s: Stream<ZSet<'K>>,
         key: Func<'K, 'G>,
         value: Func<'K, int64>) : Stream<ZSet<'G * int64>> =
        this.RegisterStream (GroupBySumOp(s.Op, key, value))

    [<Extension>]
    static member IndexWith<'A, 'K, 'V
        when 'A : comparison and 'K : comparison and 'V : comparison and 'K : not null>
        (this: Circuit,
         s: Stream<ZSet<'A>>,
         key: Func<'A, 'K>,
         value: Func<'A, 'V>) : Stream<IndexedZSet<'K, 'V>> =
        this.RegisterStream (IndexWithOp(s.Op, key, value))

    [<Extension>]
    static member IndexedJoin<'K, 'VA, 'VB, 'C
        when 'K : comparison and 'VA : comparison and 'VB : comparison and 'C : comparison and 'K : not null>
        (this: Circuit,
         a: Stream<IndexedZSet<'K, 'VA>>,
         b: Stream<IndexedZSet<'K, 'VB>>,
         combine: Func<'K, 'VA, 'VB, 'C>) : Stream<ZSet<'C>> =
        this.RegisterStream (IndexedJoinOp(a.Op, b.Op, combine))
