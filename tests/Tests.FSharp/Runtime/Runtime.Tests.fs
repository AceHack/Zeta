module Zeta.Tests.Runtime.RuntimeTests
#nowarn "0893"

open System
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// ═ Multi-worker Runtime (moved from NestedAndRuntimeTests /
// ═ NewFeatureTests / Round6Tests / Round8Tests / InfrastructureTests)
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``DbspRuntime shards a workload across workers and gathers`` () =
    task {
        use rt =
            new DbspRuntime<int>(
                shardCount = 4,
                build = Func<_, _, _>(fun c input ->
                    // Each shard doubles its input and outputs.
                    let doubled = c.Map(input.Stream, Func<_, _>(fun x -> x * 2))
                    c.Output doubled))
        do! rt.SendAsync(ZSet.ofKeys [ 1 ; 2 ; 3 ; 4 ; 5 ; 6 ; 7 ; 8 ])
        do! rt.StepAsync()
        let gathered = rt.Gather()
        gathered.[2]  |> should equal 1L
        gathered.[4]  |> should equal 1L
        gathered.[6]  |> should equal 1L
        gathered.[8]  |> should equal 1L
        gathered.[10] |> should equal 1L
        gathered.[12] |> should equal 1L
        gathered.[14] |> should equal 1L
        gathered.[16] |> should equal 1L
    }


// ─── Work-stealing runtime (moved from NewFeatureTests) ───────────

[<Fact>]
let ``WorkStealingRuntime shards and processes`` () =
    task {
        use rt =
            new WorkStealingRuntime<int>(
                shardCount = 4,
                build = Func<_, _, _>(fun c input ->
                    let doubled = c.Map(input.Stream, Func<_, _>(fun x -> x * 2))
                    c.Output doubled),
                maxDegreeOfParallelism = 4)
        do! rt.SendAsync(ZSet.ofKeys [ 1 ; 2 ; 3 ; 4 ; 5 ; 6 ; 7 ; 8 ])
        do! rt.StepAsync()
        let gathered = rt.Gather()
        gathered.Count |> should be (greaterThan 0)
    }


// ═══════════════════════════════════════════════════════════════════
// ═ F# idiomatic Pipeline module (moved from Round6Tests / Round8Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``Pipeline.map + filter + distinct chain`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let result =
            input.Stream
            |> Pipeline.filter c (fun x -> x > 0)
            |> Pipeline.map c (fun x -> x * 2)
            |> Pipeline.distinct c
        let out = Pipeline.output c result
        input.Send (ZSet.ofKeys [ -1; 1; 2; 3 ])
        do! c.StepAsync()
        // Positives {1,2,3} → {2,4,6}.
        out.Current.Count |> should equal 3
    }


[<Fact>]
let ``Pipeline.count returns scalar`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let n = input.Stream |> Pipeline.count c
        let out = Pipeline.output c n
        input.Send (ZSet.ofKeys [ 1; 2; 3 ])
        do! c.StepAsync()
        out.Current |> should equal 3L
    }


// ─── Pipeline.groupByCount / any / all (moved from Round8Tests) ────

[<Fact>]
let ``Pipeline.groupByCount groups correctly`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let grouped = input.Stream |> Pipeline.groupByCount c (fun x -> x % 2)
        let out = Pipeline.output c grouped
        input.Send (ZSet.ofKeys [ 1; 2; 3; 4; 5 ])
        do! c.StepAsync()
        out.Current.Count |> should equal 2   // keys: (0, 2), (1, 3)
    }


[<Fact>]
let ``Pipeline.any returns 0 for empty`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let n = input.Stream |> Pipeline.any c
        let out = Pipeline.output c n
        do! c.StepAsync()
        out.Current |> should equal 0L
    }


[<Fact>]
let ``Pipeline.all counts violations`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let violations = input.Stream |> Pipeline.all c (fun x -> x > 0)
        let out = Pipeline.output c violations
        input.Send (ZSet.ofKeys [ 1; -5; 2 ])
        do! c.StepAsync()
        out.Current |> should equal 1L   // one violation (-5)
    }


// ─── Pipeline branch coverage (moved from Round8Tests) ─────────────

[<Fact>]
let ``Pipeline.plus adds streams`` () =
    task {
        let c = Circuit.create ()
        let a = c.ZSetInput<int>()
        let b = c.ZSetInput<int>()
        let u = Pipeline.plus c a.Stream b.Stream
        let out = Pipeline.output c u
        a.Send (ZSet.ofKeys [ 1; 2 ])
        b.Send (ZSet.ofKeys [ 3 ])
        do! c.StepAsync()
        out.Current.Count |> should equal 3
    }


[<Fact>]
let ``Pipeline.minus subtracts streams`` () =
    task {
        let c = Circuit.create ()
        let a = c.ZSetInput<int>()
        let b = c.ZSetInput<int>()
        let d = Pipeline.minus c a.Stream b.Stream
        let out = Pipeline.output c d
        a.Send (ZSet.ofKeys [ 1; 2; 3 ])
        b.Send (ZSet.ofKeys [ 2 ])
        do! c.StepAsync()
        out.Current.[2] |> should equal 0L
    }


[<Fact>]
let ``Pipeline.integrate accumulates`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let integ = input.Stream |> Pipeline.integrate c
        let out = Pipeline.output c integ
        input.Send (ZSet.ofKeys [ 1; 2 ])
        do! c.StepAsync()
        out.Current.Count |> should equal 2
    }


[<Fact>]
let ``Pipeline.differentiate produces deltas`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let diff = input.Stream |> Pipeline.differentiate c
        let out = Pipeline.output c diff
        input.Send (ZSet.ofKeys [ 1 ])
        do! c.StepAsync()
        out.Current.Count |> should equal 1
    }


[<Fact>]
let ``Pipeline.delay shifts by one tick`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let dl = input.Stream |> Pipeline.delay c
        let out = Pipeline.output c dl
        input.Send (ZSet.ofKeys [ 7 ])
        do! c.StepAsync()
        // delay emits empty first tick; second tick emits the 7.
        out.Current.IsEmpty |> should be True
        input.Send ZSet.Empty
        do! c.StepAsync()
        out.Current.Count |> should equal 1
    }


[<Fact>]
let ``Pipeline.flatMap fans out`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let fm =
            input.Stream
            |> Pipeline.flatMap c (fun x -> ZSet.ofKeys [ x; x * 10 ])
        let out = Pipeline.output c fm
        input.Send (ZSet.ofKeys [ 1; 2 ])
        do! c.StepAsync()
        out.Current.Count |> should equal 4
    }


[<Fact>]
let ``Pipeline.join composes two streams`` () =
    task {
        let c = Circuit.create ()
        let a = c.ZSetInput<int>()
        let b = c.ZSetInput<string>()
        let j =
            Pipeline.join
                c
                (fun (x: int) -> x)
                (fun (s: string) -> s.Length)
                (fun x s -> $"{x}-{s}")
                a.Stream b.Stream
        let out = Pipeline.output c j
        a.Send (ZSet.ofKeys [ 3 ])
        b.Send (ZSet.ofKeys [ "abc" ])
        do! c.StepAsync()
        out.Current.Count |> should equal 1
    }


[<Fact>]
let ``Pipeline.sum returns weighted total`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let t = input.Stream |> Pipeline.sum c int64
        let out = Pipeline.output c t
        input.Send (ZSet.ofKeys [ 1; 2; 3 ])
        do! c.StepAsync()
        out.Current |> should equal 6L
    }


// ═══════════════════════════════════════════════════════════════════
// ═ IAsyncEnumerable AsyncStream adapter (moved from Round6Tests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``AsyncStream.forCount yields N snapshots`` () =
    task {
        let c = Circuit.create ()
        let input = c.ScalarInput<int>()
        let out = c.Output input.Stream
        let seen = ResizeArray<int>()
        let asyncSeq = AsyncStream.forCount c out 3
        input.Set 10
        let e = asyncSeq.GetAsyncEnumerator Threading.CancellationToken.None
        try
            let! first = e.MoveNextAsync().AsTask()
            let mutable more = first
            let mutable i = 0
            while more do
                seen.Add e.Current
                input.Set (i + 20)
                i <- i + 1
                let! m = e.MoveNextAsync().AsTask()
                more <- m
        finally
            (e.DisposeAsync().AsTask()).Wait()
        seen.Count |> should equal 3
    }


// ═══════════════════════════════════════════════════════════════════
// ═ PaddedCounter (moved from CoverageTests / InfrastructureTests)
// ═══════════════════════════════════════════════════════════════════

[<Fact>]
let ``PaddedCounter starts at zero and increments atomically`` () =
    let mutable c = PaddedCounter()
    c.Value |> should equal 0L
    Parallel.For(0, 100, (fun _ -> c.Increment())) |> ignore
    c.Value |> should equal 100L


[<Fact>]
let ``PaddedCounter increments atomically`` () =
    let mutable counter = PaddedCounter()
    counter.Increment()
    counter.Increment()
    counter.Increment()
    counter.Value |> should equal 3L
