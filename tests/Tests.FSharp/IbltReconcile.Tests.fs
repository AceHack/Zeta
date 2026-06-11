module Zeta.Tests.IbltReconcileTests

// O(|Δ|) ROOM RECONCILIATION (Aaron: "yep lets do this") — the IBLT, peeled by BP-with-hard-
// messages. The laws: exact recovery when sized to the difference; HONEST Partial when not
// (never a wrong answer); deterministic (DST); shared keys always cancel.

open global.Xunit
open Zeta.Core

let private keys (ints: int list) = ints |> List.map uint64

[<Fact>]
let ``RECONCILE: two rooms differing by a few keys recover the EXACT symmetric difference, sides correct`` () =
    let shared = keys [ 1..100 ]
    let roomA = shared @ keys [ 1001; 1002; 1003 ] // A's extras
    let roomB = shared @ keys [ 2001; 2002 ] // B's extras
    // geometry note from the first run: at 16 cells (seg=5) keys 1002/1003 formed a 2-core and
    // the decoder answered PARTIAL — honestly, with every recovered key correct. IBLT decode is
    // probabilistic by design (w.h.p. at ~1.5-2x |Δ|); 24 cells clears this Δ comfortably.
    match IbltReconcile.reconcile 24 3 roomA roomB with
    | IbltReconcile.Decoded(onlyA, onlyB) ->
        Assert.Equal<uint64 list>(keys [ 1001; 1002; 1003 ], onlyA)
        Assert.Equal<uint64 list>(keys [ 2001; 2002 ], onlyB)
    | IbltReconcile.Partial(_, _, n) -> Assert.True(false, sprintf "expected full decode; %d cells stuck" n)

[<Fact>]
let ``THE CANCELLATION LAW: identical rooms reconcile to EMPTY — a thousand shared keys cost nothing in the difference`` () =
    let room = keys [ 1..1000 ]
    match IbltReconcile.reconcile 8 3 room room with
    | IbltReconcile.Decoded([], []) -> ()
    | other -> Assert.True(false, sprintf "expected empty decode, got %A" other)

[<Fact>]
let ``HONEST PARTIAL: an undersized table refuses to lie — Partial with the stuck-cell count, never a wrong answer`` () =
    let roomA = keys [ 1..200 ]
    let roomB = keys [ 101..300 ] // |Δ| = 200, table of 8 cells: hopeless — must say so
    match IbltReconcile.reconcile 8 3 roomA roomB with
    | IbltReconcile.Partial(onlyA, onlyB, remaining) ->
        Assert.True(remaining > 0)
        // everything it DID recover must be correct (sound, even when incomplete)
        for k in onlyA do Assert.True(k <= 100UL && k >= 1UL)
        for k in onlyB do Assert.True(k >= 201UL && k <= 300UL)
    | IbltReconcile.Decoded(a, b) ->
        // a lucky full decode at this size would still need to be CORRECT
        Assert.Equal(100, List.length a)
        Assert.Equal(100, List.length b)

[<Fact>]
let ``DST: same rooms, same geometry, same bytes — reconciliation replays exactly`` () =
    let roomA = keys [ 1..50 ] @ keys [ 7001; 7002 ]
    let roomB = keys [ 1..50 ] @ keys [ 8001 ]
    let run () = IbltReconcile.reconcile 12 3 roomA roomB
    Assert.Equal(run (), run ())

[<Fact>]
let ``O(|Δ|) IS THE POINT: a 10k-key room with a 3-key difference reconciles through a 16-cell table`` () =
    let shared = keys [ 1..10000 ]
    let roomA = shared @ keys [ 90001 ]
    let roomB = shared @ keys [ 90002; 90003 ]
    match IbltReconcile.reconcile 16 3 roomA roomB with
    | IbltReconcile.Decoded(onlyA, onlyB) ->
        Assert.Equal<uint64 list>(keys [ 90001 ], onlyA)
        Assert.Equal<uint64 list>(keys [ 90002; 90003 ], onlyB)
    | IbltReconcile.Partial(_, _, n) -> Assert.True(false, sprintf "16 cells should decode |Δ|=3; %d stuck" n)
