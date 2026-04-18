# F# DSL — `circuit { }` Computation Expression

The `Dsl` module provides a monadic builder for constructing DBSP
circuits in F#-idiomatic style. Every combinator is `inline` with
`[<InlineIfLambda>]`, so at graph-build time the CE flattens to the
underlying method calls — no `FSharpFunc` allocations.

## Imports

```fsharp
open Dbsp.Core
open Dbsp.Core.Dsl
```

## Example 1 — simple map + filter

```fsharp
let build : CircuitM<ZSetInputHandle<int> * OutputHandle<ZSet<int>>> =
    circuit {
        let! input    = zsetInput<int>
        let! doubled  = input.Stream |> map (fun x -> x * 2)
        let! filtered = doubled      |> filter (fun x -> x > 10)
        let! out      = filtered     |> output
        return input, out
    }

// Wire up:
let c = Circuit.create ()
let input, view = build.Invoke c
c.Build ()
input.Send(ZSet.ofKeys [ 1 ; 5 ; 10 ; 20 ])
do! c.StepAsync ()
// view.Current.[40] = 1L   (20 * 2 passed both filter + map)
```

## Example 2 — GROUP BY SUM

```fsharp
circuit {
    let! orders   = zsetInput<string * int64>
    let! snapshot = orders.Stream |> integrate
    let! totals =
        CircuitM(fun c ->
            c.GroupBySum(
                snapshot,
                Func<_, _>(fst),
                Func<_, _>(snd)))
    return! totals |> output
}
```

## Example 3 — recursive transitive closure (Datalog)

```fsharp
circuit {
    let! edges   = zsetInput<int * int>
    let! edgeRel = edges.Stream |> integrate
    let! reach =
        CircuitM(fun c ->
            c.RecursiveSemiNaive(
                edgeRel,
                Func<_, _>(fun reachSoFar ->
                    c.Join(
                        reachSoFar, edgeRel,
                        Func<_, _>(snd),
                        Func<_, _>(fst),
                        Func<_, _, _>(fun (a, _) (_, d) -> (a, d))))))
    return! reach |> output
}
```

## Example 4 — approximate distinct count (HyperLogLog)

```fsharp
circuit {
    let! events = zsetInput<int>
    let! unique =
        CircuitM(fun c -> c.ApproxDistinct(events.Stream, logBuckets = 12))
    return! unique |> output
}
```

## Example 5 — higher-order differentials (Δ²)

```fsharp
// Detect when a stream's second derivative (rate-of-change-of-
// rate-of-change) hits zero — signal for linear growth.
circuit {
    let! input = zsetInput<int>
    let! d2    =
        CircuitM(fun c -> c.Differentiate2ZSet input.Stream)
    return! d2 |> output
}
```

## Example 6 — transactional delay (exactly-once)

```fsharp
let c = Circuit.create ()
let input = c.ZSetInput<int>()
let tz = c.TransactionZ1 input.Stream     // returns TransactionHandle<_>
let view = c.Output tz.Stream

tz.BeginTransaction()
input.Send (ZSet.ofKeys [ 1 ; 2 ; 3 ])
do! c.StepAsync ()
// tz.Rollback() here discards the batch.
tz.Commit()                                // promote pending -> state
```

## Example 7 — sharded multi-worker runtime

```fsharp
use rt =
    new DbspRuntime<int>(
        shardCount = 8,
        build = Func<_, _, _>(fun c input ->
            // Each worker runs its own sub-circuit on its shard.
            let doubled = c.Map(input.Stream, Func<_, _>(fun x -> x * 2))
            c.Output doubled))

do! rt.SendAsync(ZSet.ofKeys [ 1 .. 10_000 ])
do! rt.StepAsync ()          // all 8 workers tick in parallel
let result = rt.Gather ()
```

## Example 8 — disk-backed spine (spill large state)

```fsharp
let store =
    DiskBackingStore<int>(
        workDir = "/var/tmp/dbsp-spine",
        inMemoryQuotaBytes = 1_000_000_000L)
    :> IBackingStore<int>
let spine = BackedSpine<int>(store)

spine.Insert(ZSet.ofKeys [ 1 ; 2 ; 3 ])
// … many more inserts that exceed the 1 GB in-memory quota; batches
// transparently spill to /var/tmp/dbsp-spine/spine-*.json.
let full = spine.Consolidate ()
```

## Why the CE?

Without the CE, the same pipeline reads as a long chain of explicit
`circuit.Map` / `circuit.Filter` calls threading the circuit instance.
The CE lifts `CircuitM<'T> = delegate of Circuit -> 'T` as a Reader
monad, so:

- The `circuit` parameter is implicit
- `let!` / `return!` chain naturally
- F#'s `InlineIfLambda` machinery guarantees the CE flattens to direct
  method calls at graph-build time (no per-call closures)
- The resulting `CircuitM<'T>` is a first-class reusable plan you can
  instantiate against multiple circuits

The imperative API (`circuit.Map(input, f)`) remains the primary surface
and is what C# callers use; the CE is an F# convenience.
