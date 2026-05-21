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
    /// Linear: filter ∘ map is the composition of two linear ops —
    /// distributes over Z-set addition. The fused implementation
    /// preserves linearity by construction.
    override _.IsLinear = true
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
    /// Linear: same reasoning as FilterMapOp — the choose-shaped
    /// `pickMap` is equivalent to a filter+map composition.
    override _.IsLinear = true
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


/// Fused `map g ∘ map f` — one pass, one allocation, one sort. Saves
/// the intermediate `ZSet<'B>` materialization between the two maps,
/// matching what rustc gets for free via iterator monomorphization.
[<Sealed>]
type internal MapMapOp<'A, 'B, 'C when 'A : comparison and 'B : comparison and 'C : comparison>
    (input: Op<ZSet<'A>>, f: Func<'A, 'B>, g: Func<'B, 'C>) =
    inherit Op<ZSet<'C>>()
    let inputs = [| input :> Op |]
    override _.Name = "mapMap"
    override _.Inputs = inputs
    /// Linear: composition of two linear maps is linear; distributes
    /// over Z-set addition.
    override _.IsLinear = true
    override this.StepAsync(_: CancellationToken) =
        let span = input.Value.AsSpan()
        if span.IsEmpty then
            this.Value <- ZSet<'C>.Empty
        else
            // One allocation for the output, no intermediate.
            let rented = Pool.Rent<ZEntry<'C>> span.Length
            try
                for i in 0 .. span.Length - 1 do
                    // Compose f then g in one expression so the JIT
                    // can keep the intermediate 'B value in a
                    // register; no heap traffic.
                    let mapped = g.Invoke (f.Invoke span.[i].Key)
                    rented.[i] <- ZEntry(mapped, span.[i].Weight)
                // The composed map may collide on output keys
                // (different 'A keys → same 'C key), so we still need
                // to sort+consolidate. Matches what two separate maps
                // would have done across two ticks.
                let live = ZSetBuilder.sortAndConsolidate (Span<_>(rented, 0, span.Length))
                this.Value <-
                    if live = 0 then ZSet<'C>.Empty
                    else ZSet(Pool.FreezeSlice(rented, live))
            finally
                Pool.Return rented
        ValueTask.CompletedTask


/// Fused `filter p₂ ∘ filter p₁` — one pass that applies both
/// predicates short-circuit-style. Filter preserves keys, so no
/// sort/consolidate is required: the input is already a valid Z-set
/// and the filtered subset stays a valid Z-set.
[<Sealed>]
type internal FilterFilterOp<'K when 'K : comparison>
    (input: Op<ZSet<'K>>, p1: Func<'K, bool>, p2: Func<'K, bool>) =
    inherit Op<ZSet<'K>>()
    let inputs = [| input :> Op |]
    override _.Name = "filterFilter"
    override _.Inputs = inputs
    /// Linear: filter is linear, composition is linear.
    override _.IsLinear = true
    override this.StepAsync(_: CancellationToken) =
        let span = input.Value.AsSpan()
        if span.IsEmpty then
            this.Value <- input.Value
        else
            let rented = Pool.Rent<ZEntry<'K>> span.Length
            try
                let mutable n = 0
                for i in 0 .. span.Length - 1 do
                    let k = span.[i].Key
                    // Short-circuit: if p1 fails, skip p2 entirely.
                    if p1.Invoke k && p2.Invoke k then
                        rented.[n] <- span.[i]
                        n <- n + 1
                if n = 0 then this.Value <- ZSet<'K>.Empty
                elif n = span.Length then this.Value <- input.Value
                else this.Value <- ZSet(Pool.FreezeSlice(rented, n))
            finally
                Pool.Return rented
        ValueTask.CompletedTask


/// Fused `filter p ∘ map f` — map every entry, then filter on the
/// mapped value. Different from `FilterMapOp` (which is `map f ∘
/// filter p`): here we map first and the predicate sees `'B` not `'A`.
/// Saves the intermediate `ZSet<'B>` materialization plus the
/// downstream filter's separate sort pass.
[<Sealed>]
type internal MapFilterOp<'A, 'B when 'A : comparison and 'B : comparison>
    (input: Op<ZSet<'A>>, f: Func<'A, 'B>, p: Func<'B, bool>) =
    inherit Op<ZSet<'B>>()
    let inputs = [| input :> Op |]
    override _.Name = "mapFilter"
    override _.Inputs = inputs
    /// Linear: map is linear, filter is linear, composition is linear.
    override _.IsLinear = true
    override this.StepAsync(_: CancellationToken) =
        let span = input.Value.AsSpan()
        if span.IsEmpty then
            this.Value <- ZSet<'B>.Empty
        else
            let rented = Pool.Rent<ZEntry<'B>> span.Length
            try
                let mutable n = 0
                for i in 0 .. span.Length - 1 do
                    let mapped = f.Invoke span.[i].Key
                    if p.Invoke mapped then
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

    /// Fused `map g ∘ map f` — one pass, one sort, one allocation.
    /// Equivalent to `circuit.Map(circuit.Map(s, f), g)` but saves the
    /// intermediate `ZSet<'B>` allocation and one scheduler dispatch.
    [<Extension>]
    static member MapMap<'A, 'B, 'C when 'A : comparison and 'B : comparison and 'C : comparison>
        (this: Circuit, s: Stream<ZSet<'A>>,
         f: Func<'A, 'B>, g: Func<'B, 'C>) : Stream<ZSet<'C>> =
        this.RegisterStream (MapMapOp(s.Op, f, g))

    /// Fused `filter p₂ ∘ filter p₁` — one pass, short-circuits when
    /// `p₁` fails. Equivalent to `circuit.Filter(circuit.Filter(s, p1), p2)`
    /// but no intermediate Z-set is materialized.
    [<Extension>]
    static member FilterFilter<'K when 'K : comparison>
        (this: Circuit, s: Stream<ZSet<'K>>,
         p1: Func<'K, bool>, p2: Func<'K, bool>) : Stream<ZSet<'K>> =
        this.RegisterStream (FilterFilterOp(s.Op, p1, p2))

    /// Fused `filter p ∘ map f` — map then filter in one pass.
    /// Different from `FilterMap` (which filters first, then maps).
    /// Useful when the predicate depends on the mapped value `'B`.
    [<Extension>]
    static member MapFilter<'A, 'B when 'A : comparison and 'B : comparison>
        (this: Circuit, s: Stream<ZSet<'A>>,
         f: Func<'A, 'B>, p: Func<'B, bool>) : Stream<ZSet<'B>> =
        this.RegisterStream (MapFilterOp(s.Op, f, p))
