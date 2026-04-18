module Zeta.Tests.Operators.JoinTests
#nowarn "0893"

open System
open System.Threading.Tasks
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// ═ AsofJoin / RangeJoin (moved from InfrastructureTests / CoverageTests2)
// ═══════════════════════════════════════════════════════════════════


[<Fact>]
let ``AsofJoin matches latest right row with time ≤ left time`` () =
    task {
        let c = Circuit.create ()
        let trades = c.ZSetInput<int * int64> ()   // (symbol, time)
        let quotes = c.ZSetInput<int * int64 * int64> ()  // (symbol, time, price)
        let joined =
            c.AsofJoin(
                trades.Stream, quotes.Stream,
                Func<_, _>(fun (s, _) -> s),
                Func<_, _>(fun (s, _, _) -> s),
                Func<_, _>(fun (_, t) -> t),
                Func<_, _>(fun (_, t, _) -> t),
                Func<_, _, _>(fun (s, t) (_, _, p) -> struct (s, t, p)),
                (0, 0L, -1L))
        let out = c.Output joined
        trades.Send(ZSet.ofKeys [ 1, 100L ; 1, 200L ])
        quotes.Send(ZSet.ofKeys [ 1, 50L, 42L ; 1, 150L, 99L ])
        do! c.StepAsync()

        // At t=100, latest quote ≤ 100 is 50 with price=42.
        out.Current.[struct (1, 100L, 42L)] |> should equal 1L
        // At t=200, latest quote ≤ 200 is 150 with price=99.
        out.Current.[struct (1, 200L, 99L)] |> should equal 1L
    }


[<Fact>]
let ``RangeJoin matches rows within time interval`` () =
    task {
        let c = Circuit.create ()
        let events = c.ZSetInput<int * int64> ()
        let news = c.ZSetInput<int * int64> ()
        let joined =
            c.RangeJoin(
                events.Stream, news.Stream,
                Func<_, _>(fst), Func<_, _>(fst),
                Func<_, _>(snd), Func<_, _>(snd),
                -5L, 5L,   // within ±5 seconds
                Func<_, _, _>(fun (k, t1) (_, t2) -> struct (k, t1, t2)))
        let out = c.Output joined
        events.Send(ZSet.ofKeys [ 1, 100L ])
        news.Send(ZSet.ofKeys [ 1, 98L ; 1, 102L ; 1, 110L ])
        do! c.StepAsync()
        out.Current.[struct (1, 100L, 98L)]  |> should equal 1L
        out.Current.[struct (1, 100L, 102L)] |> should equal 1L
        out.Current.[struct (1, 100L, 110L)] |> should equal 0L   // outside ±5
    }


// ─── AsofJoin / RangeJoin edge cases (moved from CoverageTests2) ────

[<Fact>]
let ``AsofJoin emits default when right side is empty`` () =
    task {
        let c = Circuit.create ()
        let t = c.ZSetInput<int * int64>()
        let q = c.ZSetInput<int * int64 * int64>()
        let j =
            c.AsofJoin(t.Stream, q.Stream,
                Func<_, _>(fst), Func<_, _>(fun (s, _, _) -> s),
                Func<_, _>(snd), Func<_, _>(fun (_, tm, _) -> tm),
                Func<_, _, _>(fun (s, time) (_, _, p) -> struct (s, time, p)),
                (0, 0L, -1L))
        let out = c.Output j
        t.Send(ZSet.ofKeys [ 1, 100L ])
        do! c.StepAsync()
        // No quotes for trade (1, 100) → paired with default.
        out.Current.[struct (1, 100L, -1L)] |> should equal 1L
    }


[<Fact>]
let ``AsofJoin empty left produces nothing`` () =
    task {
        let c = Circuit.create ()
        let t = c.ZSetInput<int * int64>()
        let q = c.ZSetInput<int * int64 * int64>()
        let j =
            c.AsofJoin(t.Stream, q.Stream,
                Func<_, _>(fst), Func<_, _>(fun (s, _, _) -> s),
                Func<_, _>(snd), Func<_, _>(fun (_, tm, _) -> tm),
                Func<_, _, _>(fun (s, time) (_, _, p) -> struct (s, time, p)),
                (0, 0L, -1L))
        let out = c.Output j
        do! c.StepAsync()
        out.Current.IsEmpty |> should be True
    }


[<Fact>]
let ``RangeJoin empty inputs`` () =
    task {
        let c = Circuit.create ()
        let e = c.ZSetInput<int * int64>()
        let n = c.ZSetInput<int * int64>()
        let j =
            c.RangeJoin(e.Stream, n.Stream,
                Func<_, _>(fst), Func<_, _>(fst),
                Func<_, _>(snd), Func<_, _>(snd),
                -5L, 5L,
                Func<_, _, _>(fun (k, t1) (_, t2) -> struct (k, t1, t2)))
        let out = c.Output j
        do! c.StepAsync()
        out.Current.IsEmpty |> should be True
    }


// ─── Cartesian / IndexWith + IndexedJoin (moved from CoverageTests) ──

[<Fact>]
let ``Cartesian via circuit`` () =
    task {
        let c = Circuit.create ()
        let a = c.ZSetInput<int>()
        let b = c.ZSetInput<string>()
        let prod = c.Cartesian(a.Stream, b.Stream)
        let out = c.Output prod
        a.Send(ZSet.ofKeys [ 1 ])
        b.Send(ZSet.ofKeys [ "x" ])
        do! c.StepAsync()
        out.Current.[(1, "x")] |> should equal 1L
    }


[<Fact>]
let ``IndexWith and IndexedJoin`` () =
    task {
        let c = Circuit.create ()
        let a = c.ZSetInput<int * string>()
        let b = c.ZSetInput<int * int>()
        let ai = c.IndexWith(a.Stream, Func<_, _>(fst), Func<_, _>(snd))
        let bi = c.IndexWith(b.Stream, Func<_, _>(fst), Func<_, _>(snd))
        let joined = c.IndexedJoin(ai, bi, Func<_, _, _, _>(fun k s v -> struct (k, s, v)))
        let out = c.Output joined
        a.Send(ZSet.ofKeys [ 1, "alice" ])
        b.Send(ZSet.ofKeys [ 1, 100 ])
        do! c.StepAsync()
        out.Current.[struct (1, "alice", 100)] |> should equal 1L
    }


// ─── Outer joins (moved from AdvancedTests / CoverageTests) ────────

[<Fact>]
let ``LeftOuterJoin emits unmatched left rows with default`` () =
    task {
        let c = Circuit.create ()
        let l = c.ZSetInput<int * string> ()
        let r = c.ZSetInput<int * int> ()
        let joined =
            c.LeftOuterJoin(
                l.Stream, r.Stream,
                Func<_, _>(fst), Func<_, _>(fst),
                Func<_, _, _>(fun (k, s) (_, v) -> (k, s, v)),
                (0, -1))   // default right (unused id, -1 sentinel)
        let out = c.Output joined
        l.Send(ZSet.ofKeys [ 1, "alice" ; 2, "bob" ; 3, "carol" ])
        r.Send(ZSet.ofKeys [ 1, 100 ; 3, 300 ])
        do! c.StepAsync ()
        out.Current.[(1, "alice", 100)] |> should equal 1L   // matched
        out.Current.[(2, "bob", -1)]    |> should equal 1L   // unmatched → default
        out.Current.[(3, "carol", 300)] |> should equal 1L   // matched
    }


[<Fact>]
let ``RightOuterJoin emits unmatched right rows`` () =
    task {
        let c = Circuit.create ()
        let l = c.ZSetInput<int * string>()
        let r = c.ZSetInput<int * int>()
        let j =
            c.RightOuterJoin(
                l.Stream, r.Stream,
                Func<_, _>(fst), Func<_, _>(fst),
                Func<_, _, _>(fun (k, s) (_, v) -> (k, s, v)),
                (0, "?"))
        let out = c.Output j
        l.Send(ZSet.ofKeys [ 1, "alice" ])
        r.Send(ZSet.ofKeys [ 1, 10 ; 2, 20 ])
        do! c.StepAsync()
        out.Current.[(1, "alice", 10)] |> should equal 1L
        // Unmatched right (key=2) pairs with defaultA=(0, "?") so combine
        // produces (0, "?", 20) — classic SQL right-outer semantics.
        out.Current.[(0, "?", 20)]     |> should equal 1L
    }
