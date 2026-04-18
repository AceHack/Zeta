namespace Zeta.Core

open System
open System.Runtime.CompilerServices
open System.Threading
open System.Threading.Tasks


/// Fused `map ⨾ filter ⨾ map` — single-pass operator that combines two
/// maps and a filter into one traversal. Saves two intermediate Z-set
/// allocations and one scheduler dispatch per tick. Novel vs Feldera
/// which keeps each node separate and relies on Rust monomorphization.
[<Sealed>]
type internal FilterMapOp<'A, 'B when 'A : comparison and 'B : comparison>
    (input: Op<ZSet<'A>>, predicate: Func<'A, bool>, map: Func<'A, 'B>) =
    inherit Op<ZSet<'B>>()
    let inputs = [| input :> Op |]
    override _.Name = "filterMap"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let span = input.Value.AsSpan()
        if span.IsEmpty then
            this.Value <- ZSet<'B>.Empty
        else
            let rented = Pool.Rent<ZEntry<'B>> span.Length
            try
                let mutable n = 0
                for i in 0 .. span.Length - 1 do
                    if predicate.Invoke span.[i].Key then
                        rented.[n] <- ZEntry(map.Invoke span.[i].Key, span.[i].Weight)
                        n <- n + 1
                if n = 0 then this.Value <- ZSet<'B>.Empty
                else
                    let live = ZSetBuilder.sortAndConsolidate (Span<_>(rented, 0, n))
                    this.Value <-
                        if live = 0 then ZSet<'B>.Empty
                        else ZSet(Pool.FreezeSlice(rented, live))
            finally
                Pool.Return rented
        ValueTask.CompletedTask


/// Optional type-agnostic map/filter chain combiner — the user hands us a
/// predicate and a transform; we fuse them into one pass. If the predicate
/// is omitted we emit every mapped entry (equivalent to pure `Map`).
[<Sealed>]
type internal FilterMapOptionalOp<'A, 'B when 'A : comparison and 'B : comparison>
    (input: Op<ZSet<'A>>, pickMap: Func<'A, struct (bool * 'B)>) =
    inherit Op<ZSet<'B>>()
    let inputs = [| input :> Op |]
    override _.Name = "filterMap"
    override _.Inputs = inputs
    override this.StepAsync(_: CancellationToken) =
        let span = input.Value.AsSpan()
        if span.IsEmpty then
            this.Value <- ZSet<'B>.Empty
        else
            let rented = Pool.Rent<ZEntry<'B>> span.Length
            try
                let mutable n = 0
                for i in 0 .. span.Length - 1 do
                    let struct (keep, mapped) = pickMap.Invoke span.[i].Key
                    if keep then
                        rented.[n] <- ZEntry(mapped, span.[i].Weight)
                        n <- n + 1
                if n = 0 then this.Value <- ZSet<'B>.Empty
                else
                    let live = ZSetBuilder.sortAndConsolidate (Span<_>(rented, 0, n))
                    this.Value <-
                        if live = 0 then ZSet<'B>.Empty
                        else ZSet(Pool.FreezeSlice(rented, live))
            finally
                Pool.Return rented
        ValueTask.CompletedTask


[<Extension>]
type FusionExtensions =

    /// Fused `filter + map` in a single traversal.
    [<Extension>]
    static member FilterMap<'A, 'B when 'A : comparison and 'B : comparison>
        (this: Circuit, s: Stream<ZSet<'A>>,
         predicate: Func<'A, bool>, map: Func<'A, 'B>) : Stream<ZSet<'B>> =
        this.RegisterStream (FilterMapOp(s.Op, predicate, map))

    /// Mono-lambda variant: the function returns `(keep, mappedValue)`.
    /// Equivalent to `ZSet |> Seq.choose` but runs in one pass with no
    /// intermediate allocations.
    [<Extension>]
    static member Choose<'A, 'B when 'A : comparison and 'B : comparison>
        (this: Circuit, s: Stream<ZSet<'A>>, pickMap: Func<'A, struct (bool * 'B)>)
        : Stream<ZSet<'B>> =
        this.RegisterStream (FilterMapOptionalOp(s.Op, pickMap))
