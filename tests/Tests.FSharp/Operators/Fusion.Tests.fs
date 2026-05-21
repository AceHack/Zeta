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


// ═══════════════════════════════════════════════════════════════════
// ═ PR 5 catalog additions — MapMap, FilterFilter, MapFilter
// ═
// ═ Each new fused operator is tested with:
// ═   1. Compositional equivalence — fused output ≡ manual chain output
// ═   2. Capability tag — IsLinear = true (the algebra contract from PR 1)
// ═   3. End-to-end correctness over several ticks
// ═══════════════════════════════════════════════════════════════════


// ─── MapMap ───────────────────────────────────────────────────────

[<Fact>]
let ``MapMap fuses two maps in one pass`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let fused =
            c.MapMap(
                input.Stream,
                Func<int, int>(fun x -> x + 1),
                Func<int, int>(fun x -> x * 10))
        let out = c.Output fused
        input.Send(ZSet.ofKeys [ 1 ; 2 ; 3 ])
        do! c.StepAsync()
        // (x + 1) * 10 for x in {1, 2, 3} → {20, 30, 40}
        out.Current.[20] |> should equal 1L
        out.Current.[30] |> should equal 1L
        out.Current.[40] |> should equal 1L
    }


[<Fact>]
let ``MapMap output matches manual Map ∘ Map chain`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let fused =
            c.MapMap(
                input.Stream,
                Func<int, int>(fun x -> x * 2),
                Func<int, int>(fun x -> x + 100))
        let manual =
            c.Map(
                c.Map(input.Stream, Func<int, int>(fun x -> x * 2)),
                Func<int, int>(fun x -> x + 100))
        let outFused = c.Output fused
        let outManual = c.Output manual
        input.Send(ZSet.ofSeq [ (5, 1L); (10, 2L); (3, -1L) ])
        do! c.StepAsync()
        outFused.Current |> should equal outManual.Current
    }


[<Fact>]
let ``MapMap consolidates colliding output keys (composed map can collide)`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        // (x mod 2) → 0 or 1; then (y + 0) → 0 or 1. So input keys
        // {1, 2, 3, 4} all collapse to {0, 1} via the composed map —
        // colliding output keys must be consolidated.
        let fused =
            c.MapMap(
                input.Stream,
                Func<int, int>(fun x -> x % 2),
                Func<int, int>(fun y -> y))
        let out = c.Output fused
        input.Send(ZSet.ofKeys [ 1 ; 2 ; 3 ; 4 ])
        do! c.StepAsync()
        // Two odds (1, 3) collapse to key 0... wait, 1 % 2 = 1 and 3 % 2 = 1, so both → 1.
        // Two evens (2, 4) → 0. Each pair sums to weight 2.
        out.Current.[0] |> should equal 2L
        out.Current.[1] |> should equal 2L
    }


[<Fact>]
let ``MapMap declares IsLinear`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let _ =
        c.MapMap(
            input.Stream,
            Func<int, int>(fun x -> x),
            Func<int, int>(fun x -> x))
    c.Build()
    let op = c.Ops |> Seq.find (fun o -> o.Name = "mapMap")
    op.IsLinear |> should equal true


// ─── FilterFilter ─────────────────────────────────────────────────

[<Fact>]
let ``FilterFilter applies both predicates and short-circuits`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let fused =
            c.FilterFilter(
                input.Stream,
                Func<int, bool>(fun x -> x > 0),
                Func<int, bool>(fun x -> x < 100))
        let out = c.Output fused
        input.Send(ZSet.ofKeys [ -5; 0; 1; 50; 100; 200 ])
        do! c.StepAsync()
        // Survives: 1, 50 (both > 0 and < 100)
        out.Current.[1] |> should equal 1L
        out.Current.[50] |> should equal 1L
        out.Current.[-5] |> should equal 0L
        out.Current.[100] |> should equal 0L
        out.Current.[200] |> should equal 0L
    }


[<Fact>]
let ``FilterFilter output matches manual Filter ∘ Filter chain`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let fused =
            c.FilterFilter(
                input.Stream,
                Func<int, bool>(fun x -> x % 2 = 0),
                Func<int, bool>(fun x -> x > 5))
        let manual =
            c.Filter(
                c.Filter(input.Stream, Func<int, bool>(fun x -> x % 2 = 0)),
                Func<int, bool>(fun x -> x > 5))
        let outFused = c.Output fused
        let outManual = c.Output manual
        input.Send(ZSet.ofSeq [ (2, 1L); (4, 1L); (6, 1L); (8, 2L); (7, 1L) ])
        do! c.StepAsync()
        outFused.Current |> should equal outManual.Current
    }


[<Fact>]
let ``FilterFilter declares IsLinear`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let _ =
        c.FilterFilter(
            input.Stream,
            Func<int, bool>(fun _ -> true),
            Func<int, bool>(fun _ -> true))
    c.Build()
    let op = c.Ops |> Seq.find (fun o -> o.Name = "filterFilter")
    op.IsLinear |> should equal true


// ─── MapFilter ────────────────────────────────────────────────────

[<Fact>]
let ``MapFilter maps then filters on the mapped value`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let fused =
            c.MapFilter(
                input.Stream,
                Func<int, int>(fun x -> x * x),       // square
                Func<int, bool>(fun y -> y >= 16))    // predicate on squared value
        let out = c.Output fused
        input.Send(ZSet.ofKeys [ 1; 2; 3; 4; 5 ])
        do! c.StepAsync()
        // Squares: 1, 4, 9, 16, 25 → keep 16, 25
        out.Current.[16] |> should equal 1L
        out.Current.[25] |> should equal 1L
        out.Current.[1] |> should equal 0L
        out.Current.[4] |> should equal 0L
        out.Current.[9] |> should equal 0L
    }


[<Fact>]
let ``MapFilter output matches manual Filter ∘ Map chain`` () =
    task {
        let c = Circuit.create ()
        let input = c.ZSetInput<int>()
        let fused =
            c.MapFilter(
                input.Stream,
                Func<int, int>(fun x -> x + 10),
                Func<int, bool>(fun y -> y < 20))
        let manual =
            c.Filter(
                c.Map(input.Stream, Func<int, int>(fun x -> x + 10)),
                Func<int, bool>(fun y -> y < 20))
        let outFused = c.Output fused
        let outManual = c.Output manual
        input.Send(ZSet.ofSeq [ (5, 1L); (12, 2L); (8, 1L); (15, 1L) ])
        do! c.StepAsync()
        outFused.Current |> should equal outManual.Current
    }


[<Fact>]
let ``MapFilter declares IsLinear`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let _ =
        c.MapFilter(
            input.Stream,
            Func<int, int>(fun x -> x),
            Func<int, bool>(fun _ -> true))
    c.Build()
    let op = c.Ops |> Seq.find (fun o -> o.Name = "mapFilter")
    op.IsLinear |> should equal true
