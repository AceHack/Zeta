module Zeta.Tests.Operators.FusionTests
#nowarn "0893"

open System
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// ═ Fusion (FilterMap / Choose / FlatMap / Minus / Negate)
// ═ (moved from InfrastructureTests / CoverageTests / CoverageTests2)
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``FilterMap fuses filter and map`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let fused =
            c.FilterMap(
                input.Stream,
                Func<_, _>(fun x -> x > 0),
                Func<_, _>(fun x -> x * 10))
        let out = c.Output fused
        input.Send(ZSet.ofKeys [ -1 ; 0 ; 1 ; 2 ; 3 ])
        do! c.StepAsync()
        out.Current.[10] |> should equal 1L
        out.Current.[20] |> should equal 1L
        out.Current.[30] |> should equal 1L
        out.Current.[-10] |> should equal 0L
    }


[<Fact>]
let ``Choose picks and transforms in one pass`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let chosen =
            c.Choose(input.Stream,
                Func<_, _>(fun x ->
                    if x > 0 then struct (true, x * x)
                    else struct (false, 0)))
        let out = c.Output chosen
        input.Send(ZSet.ofKeys [ -2 ; -1 ; 1 ; 2 ; 3 ])
        do! c.StepAsync()
        out.Current.[1] |> should equal 1L   // 1²
        out.Current.[4] |> should equal 1L   // 2²
        out.Current.[9] |> should equal 1L   // 3²
    }


// ─── Fusion edge cases (moved from CoverageTests2) ──

[<Fact>]
let ``FilterMap with all filtered out`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let fm =
            c.FilterMap(input.Stream,
                Func<_, _>(fun _ -> false),
                Func<_, _>(fun x -> x))
        let out = c.Output fm
        input.Send(ZSet.ofKeys [ 1 ; 2 ; 3 ])
        do! c.StepAsync()
        out.Current.IsEmpty |> should be True
    }


[<Fact>]
let ``FilterMap empty input`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let fm =
            c.FilterMap(input.Stream,
                Func<_, _>(fun _ -> true),
                Func<_, _>(fun x -> x + 1))
        let out = c.Output fm
        do! c.StepAsync()
        out.Current.IsEmpty |> should be True
    }


[<Fact>]
let ``Choose empty input`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let ch =
            c.Choose(input.Stream,
                Func<_, _>(fun x -> struct (true, x)))
        let out = c.Output ch
        do! c.StepAsync()
        out.Current.IsEmpty |> should be True
    }


// ─── Operator extensions (moved from CoverageTests) ──

[<Fact>]
let ``Minus subtracts`` () =
    task {
        let c = Circuit.create ()
        let a = c.ZSetInput<int>()
        let b = c.ZSetInput<int>()
        let diff = c.Minus(a.Stream, b.Stream)
        let out = c.Output diff
        a.Send(ZSet.ofKeys [ 1 ; 2 ])
        b.Send(ZSet.ofKeys [ 2 ])
        do! c.StepAsync()
        out.Current.[1] |> should equal 1L
        out.Current.[2] |> should equal 0L
    }


[<Fact>]
let ``Negate flips weights`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let n = c.Negate input.Stream
        let out = c.Output n
        input.Send(ZSet.singleton 1 1L)
        do! c.StepAsync()
        out.Current.[1] |> should equal -1L
    }


[<Fact>]
let ``FlatMap fans out`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let fm = c.FlatMap(input.Stream,
                    Func<int, ZSet<int>>(fun k ->
                        ZSet.ofKeys [ k ; k * 10 ]))
        let out = c.Output fm
        input.Send(ZSet.singleton 5 1L)
        do! c.StepAsync()
        out.Current.[5]  |> should equal 1L
        out.Current.[50] |> should equal 1L
    }


[<Fact>]
let ``Constant emits the same value`` () =
    task {
        let c = Circuit.create ()
        let const42 = c.Constant 42
        let out = c.Output const42
        do! c.StepAsync()
        out.Current |> should equal 42
        do! c.StepAsync()
        out.Current |> should equal 42
    }


[<Fact>]
let ``Delay with custom initial`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let delayed = c.Delay(input.Stream, ZSet.singleton 99 1L)
        let out = c.Output delayed
        input.Send(ZSet.singleton 1 1L)
        do! c.StepAsync()
        // First tick emits the initial value.
        out.Current.[99] |> should equal 1L
    }
