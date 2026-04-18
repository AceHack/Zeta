module Zeta.Tests.Storage.ClosureTableTests
#nowarn "0893"

open FsCheck
open FsCheck.FSharp
open FsCheck.Xunit
open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ─── ClosurePair equality / hash contract ───────────────────────────

[<Fact>]
let ``ClosurePair Equals agrees with GetHashCode`` () =
    // Two ClosurePair with equal fields must hash identically
    // (round-17 Equals/GetHashCode symmetry fix).
    let a = ClosurePair<int>(1, 2, 3)
    let b = ClosurePair<int>(1, 2, 3)
    a.Equals(box b) |> should be True
    a.GetHashCode() |> should equal (b.GetHashCode())


[<Fact>]
let ``ClosurePair Equals rejects different fields`` () =
    let a = ClosurePair<int>(1, 2, 3)
    let b = ClosurePair<int>(1, 2, 4)
    a.Equals(box b) |> should be False


[<Property>]
let ``ClosurePair equals implies hashes equal (property)``
    (anc: int) (dsc: int) (d: int) =
    let a = ClosurePair<int>(anc, dsc, d)
    let b = ClosurePair<int>(anc, dsc, d)
    a.Equals(box b) && a.GetHashCode() = b.GetHashCode()


// ─── ClosureTable closure computation ───────────────────────────────

[<Fact>]
let ``ClosureTable builds depth-1 closure for single edge`` () =
    let c = Circuit()
    let edges = c.ZSetInput<struct (int * int)>()
    let closure = c.ClosureTable(edges.Stream)
    let out = OutputHandle closure.Op
    c.Build()
    edges.Send (ZSet.ofKeys [ struct (1, 2) ])
    c.Step()
    out.Current.Count |> should equal 1


[<Fact>]
let ``ClosureTable transitively closes a chain 1->2->3`` () =
    let c = Circuit()
    let edges = c.ZSetInput<struct (int * int)>()
    let closure = c.ClosureTable(edges.Stream)
    let out = OutputHandle closure.Op
    c.Build()
    edges.Send (ZSet.ofKeys [ struct (1, 2); struct (2, 3) ])
    let struct (_, converged) = c.IterateToFixedPointWithConvergence(closure, 20)
    converged |> should be True
    // Expect {(1,2,1), (2,3,1), (1,3,2)} — three closure rows.
    out.Current.Count |> should equal 3


// ─── CountingClosureTable (round-19, option-4 counting algorithm) ───
//
// `CountingClosureTable` wraps `RecursiveCounting`: weights flow
// without `Distinct` inside the feedback loop so the output carries
// derivation-count multiplicities rather than {0, 1} set-membership.
// On trees / DAGs where each (ancestor, descendant, depth) triple has
// exactly one derivation, the counting variant agrees with the
// boolean `ClosureTable` row-for-row with weight 1.


let private runClosure
    (wire: Circuit -> Stream<ZSet<struct (int * int)>> -> Stream<ZSet<ClosurePair<int>>>)
    (input: struct (int * int) list) : ZSet<ClosurePair<int>> =
    let c = Circuit()
    let edges = c.ZSetInput<struct (int * int)>()
    let closure = wire c edges.Stream
    let out = OutputHandle closure.Op
    c.Build()
    edges.Send (ZSet.ofKeys input)
    let struct (_, converged) = c.IterateToFixedPointWithConvergence(closure, 20)
    converged |> should be True
    out.Current


[<Fact>]
let ``CountingClosureTable matches ClosureTable on chain 1->2->3`` () =
    // Oracle parity: on a chain every closure pair has a unique
    // derivation path, so multiplicities equal 1 and the two
    // combinators must produce the same integrated Z-set.
    let chain = [ struct (1, 2); struct (2, 3) ]
    let expected = runClosure (fun c s -> c.ClosureTable s) chain
    let counting = runClosure (fun c s -> c.CountingClosureTable s) chain
    counting |> should equal expected


[<Fact>]
let ``CountingClosureTable on a tree matches ClosureTable row-for-row`` () =
    //      1
    //     / \
    //    2   3
    //   /
    //  4
    // Edges: 1->2, 1->3, 2->4. Every (ancestor, descendant, depth)
    // triple has a unique derivation path → counting weights equal 1.
    let tree = [ struct (1, 2); struct (1, 3); struct (2, 4) ]
    let expected = runClosure (fun c s -> c.ClosureTable s) tree
    let counting = runClosure (fun c s -> c.CountingClosureTable s) tree
    counting |> should equal expected


[<Fact>]
let ``CountingClosureTable retracts closure rows when edges are retracted`` () =
    // Insert a chain, iterate to fixed point, then retract one edge and
    // iterate again. The closure rows whose only derivations went
    // through the retracted edge must reach integrated weight 0 (and
    // therefore drop out of the consolidated Z-set).
    let c = Circuit()
    let edges = c.ZSetInput<struct (int * int)>()
    let closure = c.CountingClosureTable(edges.Stream)
    let out = OutputHandle closure.Op
    c.Build()
    // Insert chain 1->2->3.
    edges.Send (ZSet.ofKeys [ struct (1, 2); struct (2, 3) ])
    let struct (_, conv1) = c.IterateToFixedPointWithConvergence(closure, 20)
    conv1 |> should be True
    let after1 = out.Current
    after1.Count |> should equal 3
    // All weights should be 1 (each closure pair has a single derivation).
    after1.[ClosurePair<int>(1, 2, 1)] |> should equal 1L
    after1.[ClosurePair<int>(2, 3, 1)] |> should equal 1L
    after1.[ClosurePair<int>(1, 3, 2)] |> should equal 1L

    // Retract edge 2->3 (negative Z-weight). Two derivations disappear:
    //   (2,3,1) — direct edge
    //   (1,3,2) — chain via the retracted edge
    // Edge (1,2,1) survives since its derivation does not use (2,3).
    edges.Send (ZSet.ofSeq [ struct (2, 3), -1L ])
    let struct (_, conv2) = c.IterateToFixedPointWithConvergence(closure, 20)
    conv2 |> should be True
    let after2 = out.Current
    after2.Count |> should equal 1
    after2.[ClosurePair<int>(1, 2, 1)] |> should equal 1L
    // Retracted rows: absent from the consolidated Z-set → weight 0.
    after2.[ClosurePair<int>(2, 3, 1)] |> should equal 0L
    after2.[ClosurePair<int>(1, 3, 2)] |> should equal 0L


[<Fact>]
let ``CountingClosureTable counts multiple derivations of a closure pair`` () =
    // Diamond graph:
    //   1 -> 2 -> 4
    //   1 -> 3 -> 4
    // (1, 4, 2) has two distinct length-2 paths → weight 2.
    let c = Circuit()
    let edges = c.ZSetInput<struct (int * int)>()
    let closure = c.CountingClosureTable(edges.Stream)
    let out = OutputHandle closure.Op
    c.Build()
    edges.Send (ZSet.ofKeys [
        struct (1, 2); struct (1, 3);
        struct (2, 4); struct (3, 4)
    ])
    let struct (_, converged) = c.IterateToFixedPointWithConvergence(closure, 20)
    converged |> should be True
    // Depth-1 edges have weight 1 each.
    out.Current.[ClosurePair<int>(1, 2, 1)] |> should equal 1L
    out.Current.[ClosurePair<int>(1, 3, 1)] |> should equal 1L
    out.Current.[ClosurePair<int>(2, 4, 1)] |> should equal 1L
    out.Current.[ClosurePair<int>(3, 4, 1)] |> should equal 1L
    // Depth-2 pair (1, 4) has TWO derivations, hence weight 2.
    out.Current.[ClosurePair<int>(1, 4, 2)] |> should equal 2L


// ─── FsCheck property: non-negative integrated weights ──────────────
//
// Random sequences of insert / retract deltas on an acyclic edge set
// must never leave a present closure pair with a negative integrated
// weight. (A retraction that overshoots — removing an edge more times
// than it was inserted — is a legitimate way for Z-weights to go
// negative, but we paper over that by generating only insert-retract
// pairs where each retraction is matched by a prior insert.)


// Small acyclic-edge generator. Edges `(u, v)` with `u < v` on nodes
// `{0..7}`, generated as a list of positive inserts. The FsCheck
// property then replays the inserts, applies a retraction of a
// random **sub-multiset** of those edges, and asserts the resulting
// closure's weights are all ≥ 0.
type AcyclicEdges =
    { Inserts: struct (int * int) list }

type AcyclicArb() =
    static member Gen() : Arbitrary<AcyclicEdges> =
        let edgeGen =
            gen {
                let! u = Gen.choose (0, 6)
                let! v = Gen.choose (u + 1, 7)
                return struct (u, v)
            }
        let g =
            Gen.sized (fun size ->
                let n = min (max 1 size) 8
                Gen.listOfLength n edgeGen
                |> Gen.map (fun es -> { Inserts = es }))
        Arb.fromGen g


[<FsCheck.Xunit.Property(Arbitrary = [| typeof<AcyclicArb> |], MaxTest = 30)>]
let ``CountingClosureTable never emits negative weights on paired insert/retract``
    (edges: AcyclicEdges) =
    // Replay inserts in one tick, iterate to fixpoint, then retract a
    // prefix of the same edges and iterate again. Every surviving key
    // must have a non-negative integrated weight.
    let inserts = edges.Inserts
    if List.isEmpty inserts then true
    else
        let c = Circuit()
        let edgeIn = c.ZSetInput<struct (int * int)>()
        let closure = c.CountingClosureTable(edgeIn.Stream)
        let out = OutputHandle closure.Op
        c.Build()

        // Tick 1: insert all edges.
        edgeIn.Send (ZSet.ofKeys inserts)
        let struct (_, conv1) = c.IterateToFixedPointWithConvergence(closure, 32)
        // If the acyclic generator produced duplicates we might need
        // more iterations; bail out gently if convergence escapes.
        let insertedOk =
            conv1 &&
            out.Current
            |> Seq.forall (fun (e: ZEntry<ClosurePair<int>>) -> e.Weight >= 0L)

        // Tick 2: retract the first half of the inserts (matched deltas
        // so no over-subtract).
        let half = max 1 (List.length inserts / 2)
        let toRetract = inserts |> List.truncate half
        edgeIn.Send (ZSet.ofSeq (toRetract |> List.map (fun e -> e, -1L)))
        let struct (_, conv2) = c.IterateToFixedPointWithConvergence(closure, 32)
        let retractedOk =
            conv2 &&
            out.Current
            |> Seq.forall (fun (e: ZEntry<ClosurePair<int>>) -> e.Weight >= 0L)

        insertedOk && retractedOk
