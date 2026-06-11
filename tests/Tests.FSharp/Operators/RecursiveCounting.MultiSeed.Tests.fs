module Zeta.Tests.Operators.RecursiveCountingMultiSeedTests
// FS57 suppressed knowingly: these tests EXERCISE the experimental combinator (incl. the pinned refutation witness).
#nowarn "57"
#nowarn "0893"

open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ═══════════════════════════════════════════════════════════════════
// Multi-tick-seed correctness for `RecursiveCounting` /
// `CountingClosureTable`.
//
// `docs/BUGS.md` (round 20): the round-19 tests covered the one-shot
// seed path only. The docstring on `RecursiveCounting` narrowed the
// supported shape to "one-shot seed; multi-tick is open research".
// These tests DO the research: they exercise multi-tick seed
// deltas — insert-then-insert, insert-then-retract,
// insert-iterate-insert, and a random FsCheck oracle check against
// the set-semantics `ClosureTable` after clamping weights via
// `Distinct`.
//
// Intent: either lock in the multi-tick behaviour we expect, or
// turn up a genuine bug. A failing test here IS the research
// finding — we document it rather than hide it.
// ═══════════════════════════════════════════════════════════════════


/// `Distinct`-style clamp — every positive weight becomes 1, every
/// non-positive weight becomes 0. Matches the set-semantics oracle
/// produced by `ClosureTable`.
let private clampToSet (z: ZSet<ClosurePair<int>>) : Map<ClosurePair<int>, Weight> =
    z
    |> Seq.filter (fun (e: ZEntry<ClosurePair<int>>) -> e.Weight > 0L)
    |> Seq.map (fun e -> e.Key, 1L)
    |> Map.ofSeq


// ─── Test 1: Insert-then-insert seed across two ticks ───────────────

[<Fact>]
let ``CountingClosureTable integrates multi-tick insert seed into closure`` () =
    // tick 0: seed {(a,b)}          → closure {(a,b,1)}
    // tick 1: seed += {(b,c)}       → closure {(a,b,1), (b,c,1), (a,c,2)}
    // All three pairs with weight 1 (each has exactly one derivation).
    let c = Circuit()
    let edges = c.ZSetInput<struct (int * int)>()
    let closure = c.CountingClosureTable(edges.Stream)
    let out = OutputHandle closure.Op
    c.Build()

    // tick 0: insert edge (a,b) → a=1, b=2.
    edges.Send (ZSet.ofKeys [ struct (1, 2) ])
    let struct (_, conv0) = c.IterateToFixedPoint(closure, 20)
    conv0 |> should be True
    let after0 = out.Current
    after0.Count |> should equal 1
    after0.[ClosurePair<int>(1, 2, 1)] |> should equal 1L

    // tick 1: insert edge (b,c) → b=2, c=3.
    edges.Send (ZSet.ofKeys [ struct (2, 3) ])
    let struct (_, conv1) = c.IterateToFixedPoint(closure, 20)
    conv1 |> should be True
    let after1 = out.Current
    // Expect three closure rows, each with weight 1.
    after1.Count |> should equal 3
    after1.[ClosurePair<int>(1, 2, 1)] |> should equal 1L
    after1.[ClosurePair<int>(2, 3, 1)] |> should equal 1L
    after1.[ClosurePair<int>(1, 3, 2)] |> should equal 1L


// ─── Test 2: Insert-then-retract seed cancels cleanly ───────────────

[<Fact>]
let ``CountingClosureTable cancels an insert+retract pair across ticks`` () =
    // tick 0: seed = {(a,b) +1}     → closure {(a,b,1):1}
    // tick 1: seed += {(a,b) -1}    → closure ∅  (single edge retracted)
    let c = Circuit()
    let edges = c.ZSetInput<struct (int * int)>()
    let closure = c.CountingClosureTable(edges.Stream)
    let out = OutputHandle closure.Op
    c.Build()

    edges.Send (ZSet.ofKeys [ struct (1, 2) ])
    let struct (_, conv0) = c.IterateToFixedPoint(closure, 20)
    conv0 |> should be True
    out.Current.[ClosurePair<int>(1, 2, 1)] |> should equal 1L

    // Retract the edge.
    edges.Send (ZSet.ofSeq [ struct (1, 2), -1L ])
    let struct (_, conv1) = c.IterateToFixedPoint(closure, 20)
    conv1 |> should be True
    let after1 = out.Current
    // Consolidated Z-set should be empty (weight 0 entries drop).
    after1
    |> Seq.filter (fun (e: ZEntry<ClosurePair<int>>) -> e.Weight <> 0L)
    |> Seq.length
    |> should equal 0


// ─── Test 3: Insert, iterate to fixed point, then insert again ──────

[<Fact>]
let ``CountingClosureTable integrates an insert after an iterated seed`` () =
    // tick 0: seed {(a,b)}, iterate to fixed point → closure {(a,b,1)}.
    // tick N: seed += {(b,c)}, iterate again       → closure with
    //         (a,b,1), (b,c,1), (a,c,2) all with weight 1.
    let c = Circuit()
    let edges = c.ZSetInput<struct (int * int)>()
    let closure = c.CountingClosureTable(edges.Stream)
    let out = OutputHandle closure.Op
    c.Build()

    // Insert first edge + iterate to stable.
    edges.Send (ZSet.ofKeys [ struct (1, 2) ])
    let struct (_, conv0) = c.IterateToFixedPoint(closure, 20)
    conv0 |> should be True
    out.Current.Count |> should equal 1

    // Insert second edge *after* the first has fully propagated.
    edges.Send (ZSet.ofKeys [ struct (2, 3) ])
    let struct (_, conv1) = c.IterateToFixedPoint(closure, 20)
    conv1 |> should be True
    let after1 = out.Current
    after1.Count |> should equal 3
    after1.[ClosurePair<int>(1, 2, 1)] |> should equal 1L
    after1.[ClosurePair<int>(2, 3, 1)] |> should equal 1L
    after1.[ClosurePair<int>(1, 3, 2)] |> should equal 1L


// ─── Test 4: FsCheck property — counting closure clamps to set oracle

// Delta applied at one outer tick — a pair-and-weight (+1 insert,
// -1 retract). `MultiTickDeltas` is a sequence of such per-tick
// batches. FsCheck drives insert / retract proportions randomly.
type EdgeDelta = { U: int; V: int; Weight: int64 }

type MultiTickEdges =
    { /// `Ticks[i]` is the batch of edge-deltas applied at outer tick i.
      Ticks: EdgeDelta list list }


/// Ensure every retraction has been preceded by an insert of the same
/// edge — pruning lets FsCheck's input shape stay simple while we
/// still avoid negative integrated edge weights (which the boolean
/// `ClosureTable` oracle doesn't model).
let private prune (ticks: EdgeDelta list list) : EdgeDelta list list =
    let mutable live : Map<struct (int * int), int64> = Map.empty
    ticks
    |> List.map (fun tick ->
        tick
        |> List.choose (fun d ->
            let e = struct (d.U, d.V)
            let cur = Map.tryFind e live |> Option.defaultValue 0L
            let newWeight = cur + d.Weight
            if newWeight < 0L then None
            else
                live <- Map.add e newWeight live
                Some d))


type MultiTickArb() =
    static member Gen() : Arbitrary<MultiTickEdges> =
        let edgeDeltaGen =
            gen {
                let! u = Gen.choose (0, 4)
                let! v = Gen.choose (u + 1, 5)
                let! w = Gen.frequency [ 3, Gen.constant 1L
                                         1, Gen.constant -1L ]
                return { U = u; V = v; Weight = w }
            }
        let tickGen = Gen.listOfLength 2 edgeDeltaGen
        let ticksGen = gen {
            let! numTicks = Gen.choose (1, 3)
            let! rawTicks = Gen.listOfLength numTicks tickGen
            return { Ticks = prune rawTicks }
        }
        Arb.fromGen ticksGen


/// Turn a tick's worth of `EdgeDelta`s into a Z-set delta.
let private buildDelta (ops: EdgeDelta list) : ZSet<struct (int * int)> =
    ops
    |> List.map (fun d -> struct (d.U, d.V), d.Weight)
    |> ZSet.ofSeq


// ─── The multi-tick FsCheck property was REMOVED here (Aaron 2026-06-13: "why do we have a
// skipped test? we should fix or remove that"). Removed, not fixed, because its job is DONE:
// the divergence it found is pinned as the deterministic, UNSKIPPED `REFUTATION WITNESS` Fact
// below — a Skip'd property was a zombie guarding knowledge the witness already gates. The
// property RETURNS (unskipped) when the signed-delta combinator lands
// (docs/research/retraction-safe-semi-naive.md §7); its text lives in git history at this file,
// and the witness Fact's header says exactly when to resurrect it. ───

// ─── THE PINNED WITNESS (Soraya's routing, math-team triage 2026-06-12) ─────
//
// A reliably-failing property is a REFUTATION, not open research: a correctness
// claim needs a proof; a falsity claim needs one witness, and FsCheck delivered
// it (pure inserts — no retraction subtlety involved). This Fact pins the named
// sequence as a DETERMINISTIC, UNSKIPPED gate asserting the divergence EXISTS —
// the witness lives in the gate, not in a comment (BP-16 for the negative claim:
// FsCheck found it; this Fact independently replays it). If this test ever FAILS
// (i.e. the two circuits agree), the defect was fixed — celebrate, then restore
// the property above to unskipped and delete this pin.
[<Fact>]
let ``REFUTATION WITNESS: multi-tick seed diverges from the ClosureTable oracle (known-incorrect, scoped out — not open research)`` () =
    let ticks =
        [ [ { U = 0; V = 6; Weight = 1L }; { U = 4; V = 5; Weight = 1L } ]
          [ { U = 5; V = 6; Weight = 1L }; { U = 2; V = 4; Weight = 1L } ]
          [ { U = 2; V = 3; Weight = 1L } ] ]

    let counting = Circuit()
    let countIn = counting.ZSetInput<struct (int * int)>()
    let countStream = counting.CountingClosureTable(countIn.Stream)
    let countOut = OutputHandle countStream.Op
    counting.Build()

    let oracle = Circuit()
    let oracleIn = oracle.ZSetInput<struct (int * int)>()
    let oracleStream = oracle.ClosureTable(oracleIn.Stream)
    let oracleOut = OutputHandle oracleStream.Op
    oracle.Build()

    let mutable diverged = false
    for tick in ticks do
        let delta = buildDelta tick
        countIn.Send delta
        oracleIn.Send delta
        let struct (_, convC) = counting.IterateToFixedPoint(countStream, 40)
        let struct (_, convO) = oracle.IterateToFixedPoint(oracleStream, 40)
        if convC && convO && clampToSet countOut.Current <> clampToSet oracleOut.Current then
            diverged <- true

    Assert.True(diverged, "the pinned multi-tick witness no longer diverges — the defect may be FIXED: restore the skipped property and retire this pin (see its header)")

// ─── RecursiveSignedDelta — the signed-delta combinator, SHIPPED (TLC-verified spec, 2026-06-13) ───
//
// The TLA+ spec's successor-chain body, in circuit form: body(T)[k] = T[k-1], keys bounded at 8.
// Z-linear (Map is linear; the bound is support filtering, not weight logic) — precondition P1-P3.

let private chainBody (c: Circuit) (s: Stream<ZSet<int>>) : Stream<ZSet<int>> =
    c.FlatMap(s, fun k -> if k < 8 then ZSet.ofSeq [ k + 1, 1L ] else ZSet<int>.Empty)

let private weightOf (z: ZSet<int>) (k: int) : int64 =
    z.AsSpan().ToArray() |> Array.sumBy (fun (e: ZEntry<int>) -> if e.Key = k then e.Weight else 0L)

[<Fact>]
let ``SIGNED-DELTA one-shot: the chain LFP from a single seed matches the hand oracle (S2, in code)`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let stream = c.RecursiveSignedDelta(input.Stream, fun s -> chainBody c s)
    let out = OutputHandle stream.Op
    c.Build()
    input.Send(ZSet.ofSeq [ 0, 1L ])
    let struct (_, converged) = c.IterateToFixedPoint(stream, 40)
    Assert.True(converged)
    // total = seed + body(total): keys 0..8 all weight 1 (the chain, exactly)
    for k in 0 .. 8 do
        Assert.Equal(1L, weightOf out.Current k)

[<Fact>]
let ``SIGNED-DELTA multi-tick INSERT: a seed arriving at a later tick joins the LFP exactly once (the refuted case, fixed)`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let stream = c.RecursiveSignedDelta(input.Stream, fun s -> chainBody c s)
    let out = OutputHandle stream.Op
    c.Build()
    input.Send(ZSet.ofSeq [ 0, 1L ])
    c.IterateToFixedPoint(stream, 40) |> ignore
    input.Send(ZSet.ofSeq [ 3, 1L ]) // mid-LFP second seed — THE multi-tick shape that refuted counting
    c.IterateToFixedPoint(stream, 40) |> ignore
    // keys 0..2: weight 1 (first chain only); keys 3..8: weight 2 (both chains pass through)
    for k in 0 .. 2 do
        Assert.Equal(1L, weightOf out.Current k)
    for k in 3 .. 8 do
        Assert.Equal(2L, weightOf out.Current k)

[<Fact>]
let ``SIGNED-DELTA RETRACTION: insert then retract converges to ZERO everywhere — the dip-and-recover discipline, no tombstones`` () =
    let c = Circuit()
    let input = c.ZSetInput<int>()
    let stream = c.RecursiveSignedDelta(input.Stream, fun s -> chainBody c s)
    let out = OutputHandle stream.Op
    c.Build()
    input.Send(ZSet.ofSeq [ 0, 1L ])
    c.IterateToFixedPoint(stream, 40) |> ignore
    input.Send(ZSet.ofSeq [ 0, -1L ]) // the retraction: a NEGATIVE delta through the same linear body
    c.IterateToFixedPoint(stream, 40) |> ignore
    for k in 0 .. 8 do
        Assert.Equal(0L, weightOf out.Current k) // every derivation cancelled exactly
