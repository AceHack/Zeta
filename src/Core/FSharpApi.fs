namespace Zeta.Core

open System
open System.Collections.Generic
open System.Runtime.CompilerServices
open System.Threading
open System.Threading.Tasks


/// F#-idiomatic pipe-friendly API over the core Circuit/Stream/Op model.
/// Where `Operators.fs` / `Dsl.fs` / `Query.fs` are the C#-shaped
/// extension-method surface, this module is "what the F# surface would
/// look like if we didn't care about C# callers".
///
/// **Argument order** follows the F# Seq/List/Array convention —
/// transform first, then data last — so `|>` composes:
///
/// ```fsharp
/// open Zeta.Core
/// let pipeline c input =
///     input
///     |> Pipeline.filter c (fun x -> x > 0)
///     |> Pipeline.map c (fun x -> x * 2)
///     |> Pipeline.distinct c
///     |> Pipeline.count c
/// ```
///
/// C# callers keep the existing `.Map(...)/.Filter(...)` extension
/// methods on `Circuit` — no change there. F# users can pick whichever
/// style fits a given expression.
[<RequireQualifiedAccess>]
module Pipeline =

    let inline map (c: Circuit) ([<InlineIfLambda>] f: 'A -> 'B) (s: Stream<ZSet<'A>>) : Stream<ZSet<'B>> =
        c.Map(s, Func<_, _>(f))

    let inline filter (c: Circuit) ([<InlineIfLambda>] p: 'K -> bool) (s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        c.Filter(s, Func<_, _>(p))

    let inline flatMap (c: Circuit) ([<InlineIfLambda>] f: 'A -> ZSet<'B>) (s: Stream<ZSet<'A>>) : Stream<ZSet<'B>> =
        c.FlatMap(s, Func<_, _>(f))

    let plus (c: Circuit) (a: Stream<ZSet<'K>>) (b: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        c.Plus(a, b)

    let minus (c: Circuit) (a: Stream<ZSet<'K>>) (b: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        c.Minus(a, b)

    let distinct (c: Circuit) (s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        c.Distinct s

    let integrate (c: Circuit) (s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        c.IntegrateZSet s

    let differentiate (c: Circuit) (s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        c.DifferentiateZSet s

    let delay (c: Circuit) (s: Stream<ZSet<'K>>) : Stream<ZSet<'K>> =
        c.DelayZSet s

    let count (c: Circuit) (s: Stream<ZSet<'K>>) : Stream<int64> =
        c.ScalarCount s

    let inline join
        (c: Circuit)
        ([<InlineIfLambda>] keyA: 'A -> 'K)
        ([<InlineIfLambda>] keyB: 'B -> 'K)
        ([<InlineIfLambda>] combine: 'A -> 'B -> 'C)
        (a: Stream<ZSet<'A>>)
        (b: Stream<ZSet<'B>>)
        : Stream<ZSet<'C>> when 'K : not null =
        c.Join(a, b, Func<_, _>(keyA), Func<_, _>(keyB), Func<_, _, _>(combine))

    let output (c: Circuit) (s: Stream<'T>) : OutputHandle<'T> = c.Output s

    /// `groupBy keyFn s` — produces a stream of `(group, count)` pairs.
    /// Shortcut for `c.GroupByCount`.
    let inline groupByCount
        (c: Circuit)
        ([<InlineIfLambda>] keyFn: 'K -> 'G)
        (s: Stream<ZSet<'K>>)
        : Stream<ZSet<'G * int64>>
        when 'G : comparison and 'G : not null =
        c.GroupByCount(s, Func<_, _>(keyFn))

    /// `groupBySum keyFn valueFn s` — total of `valueFn` per group.
    let inline groupBySum
        (c: Circuit)
        ([<InlineIfLambda>] keyFn: 'K -> 'G)
        ([<InlineIfLambda>] valueFn: 'K -> int64)
        (s: Stream<ZSet<'K>>)
        : Stream<ZSet<'G * int64>>
        when 'G : comparison and 'G : not null =
        c.GroupBySum(s, Func<_, _>(keyFn), Func<_, _>(valueFn))

    /// Total `Σ valueFn(k) · weight(k)` as a scalar stream.
    let inline sum
        (c: Circuit)
        ([<InlineIfLambda>] valueFn: 'K -> int64)
        (s: Stream<ZSet<'K>>)
        : Stream<int64> =
        c.ScalarSum(s, Func<_, _>(valueFn))

    /// `any s` — `true` iff `|s| > 0`. Emitted as a scalar count stream
    /// the caller can threshold. (A dedicated `Stream<bool>` operator
    /// needs a `Map` primitive on scalar streams — roadmap.)
    let any (c: Circuit) (s: Stream<ZSet<'K>>) : Stream<int64> =
        c.ScalarCount s

    /// `all predicate s` — emits the number of rows that *violate*
    /// `predicate`. Caller checks `== 0L`.
    let inline all
        (c: Circuit)
        ([<InlineIfLambda>] predicate: 'K -> bool)
        (s: Stream<ZSet<'K>>)
        : Stream<int64> =
        let violations = c.Filter(s, Func<_, _>(fun x -> not (predicate x)))
        c.ScalarCount violations


/// Convert an `OutputHandle<'T>` to an `IAsyncEnumerable<'T>` that yields
/// one element per circuit tick. Lets F# and C# callers consume stream
/// output with `await foreach` / `for await` without manually polling
/// `.Current` after every `StepAsync`.
///
/// **Honesty check on "async":** this adapter is **truly async** — it
/// does not wrap a synchronous call in a Task to pretend. The circuit's
/// `StepAsync` already has a sync fast path that returns a completed
/// `Task` when every operator is synchronous; in that case we return a
/// synchronously-completed `ValueTask<bool>` (zero allocation). When
/// any operator in the circuit is genuinely async (disk I/O, channels,
/// external sinks), we fall through to a real `task { ... }` state
/// machine that properly awaits and propagates exceptions. Previous
/// revision of this file used `ContinueWith` which **silently swallowed
/// faults** and returned `true` anyway — that was the lie this comment
/// ensures doesn't happen again.
///
/// **Caveat:** this is a driver-side adapter — you give it the circuit
/// plus the number of ticks to drive, it yields the snapshots. It does
/// *not* wrap an externally-driven circuit where ticks come from
/// somewhere else.
[<RequireQualifiedAccess>]
module AsyncStream =

    /// Yield one snapshot per tick for `count` ticks.
    let forCount<'T> (circuit: Circuit) (handle: OutputHandle<'T>) (count: int) : IAsyncEnumerable<'T> =
        { new IAsyncEnumerable<'T> with
            member _.GetAsyncEnumerator(ct) =
                let mutable tick = 0
                let mutable current = Unchecked.defaultof<'T>
                { new IAsyncEnumerator<'T> with
                    member _.Current = current
                    member _.MoveNextAsync() =
                        if tick >= count then ValueTask<bool>(false)
                        else
                            let t = circuit.StepAsync ct
                            if t.IsCompletedSuccessfully then
                                current <- handle.Current
                                tick <- tick + 1
                                ValueTask<bool>(true)
                            else
                                // Real async path — fault propagation via the
                                // `task { }` CE, not a silent-swallow ContinueWith.
                                ValueTask<bool>(task {
                                    do! t
                                    current <- handle.Current
                                    tick <- tick + 1
                                    return true
                                })
                    member _.DisposeAsync() = ValueTask.CompletedTask } }

    /// Yield snapshots indefinitely until the cancellation token fires.
    let forever<'T> (circuit: Circuit) (handle: OutputHandle<'T>) : IAsyncEnumerable<'T> =
        { new IAsyncEnumerable<'T> with
            member _.GetAsyncEnumerator(ct) =
                let mutable current = Unchecked.defaultof<'T>
                { new IAsyncEnumerator<'T> with
                    member _.Current = current
                    member _.MoveNextAsync() =
                        if ct.IsCancellationRequested then ValueTask<bool>(false)
                        else
                            let t = circuit.StepAsync ct
                            if t.IsCompletedSuccessfully then
                                current <- handle.Current
                                ValueTask<bool>(true)
                            else
                                ValueTask<bool>(task {
                                    do! t
                                    current <- handle.Current
                                    return true
                                })
                    member _.DisposeAsync() = ValueTask.CompletedTask } }
