module Zeta.Tests.Algebra.GraphTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core


// ─── empty + basic accessors ─────────

[<Fact>]
let ``empty graph has zero edges and zero nodes`` () =
    let g : Graph<int> = Graph.empty
    Graph.isEmpty g |> should equal true
    Graph.edgeCount g |> should equal 0
    Graph.nodeCount g |> should equal 0

[<Fact>]
let ``edgeWeight returns 0 for absent edge`` () =
    let g : Graph<int> = Graph.empty
    Graph.edgeWeight 1 2 g |> should equal 0L


// ─── addEdge ─────────

[<Fact>]
let ``addEdge sets edge weight and emits EdgeAdded event`` () =
    let (g, events) = Graph.addEdge 1 2 5L Graph.empty
    Graph.edgeWeight 1 2 g |> should equal 5L
    events |> should equal [ EdgeAdded(1, 2, 5L) ]

[<Fact>]
let ``addEdge with zero weight is a no-op`` () =
    let (g, events) = Graph.addEdge 1 2 0L Graph.empty
    Graph.isEmpty g |> should equal true
    events |> should equal ([]: GraphEvent<int> list)

[<Fact>]
let ``addEdge accumulates multi-edge weight`` () =
    // Multi-edges are supported via ZSet signed-weight:
    // two adds on the same edge sum to multiplicity 7.
    let (g1, _) = Graph.addEdge 1 2 3L Graph.empty
    let (g2, _) = Graph.addEdge 1 2 4L g1
    Graph.edgeWeight 1 2 g2 |> should equal 7L
    Graph.edgeCount g2 |> should equal 1


// ─── removeEdge / retraction-native ─────────

[<Fact>]
let ``removeEdge subtracts weight and emits EdgeRemoved event`` () =
    let (g1, _) = Graph.addEdge 1 2 5L Graph.empty
    let (g2, events) = Graph.removeEdge 1 2 5L g1
    Graph.edgeWeight 1 2 g2 |> should equal 0L
    Graph.isEmpty g2 |> should equal true
    events |> should equal [ EdgeRemoved(1, 2, 5L) ]

[<Fact>]
let ``removeEdge partial retraction leaves remainder`` () =
    // Retraction-native: remove 3 from an edge of weight 5
    // leaves weight 2, not "edge deleted".
    let (g1, _) = Graph.addEdge 1 2 5L Graph.empty
    let (g2, _) = Graph.removeEdge 1 2 3L g1
    Graph.edgeWeight 1 2 g2 |> should equal 2L
    Graph.edgeCount g2 |> should equal 1

[<Fact>]
let ``retraction-conservation: addEdge then removeEdge restores empty`` () =
    // The load-bearing property from the ADR: apply(delta)
    // followed by apply(-delta) restores prior state modulo
    // compaction metadata.
    let (g1, _) = Graph.addEdge 1 2 7L Graph.empty
    let (g2, _) = Graph.removeEdge 1 2 7L g1
    Graph.isEmpty g2 |> should equal true

[<Fact>]
let ``removeEdge on absent edge produces net-negative weight`` () =
    // Remove-before-add is legal — ZSet signed-weight means
    // the result is an anti-edge (negative multiplicity).
    // Adding it later will cancel. This is what makes
    // retraction-native counterfactuals O(|delta|).
    let (g, _) = Graph.removeEdge 1 2 3L Graph.empty
    Graph.edgeWeight 1 2 g |> should equal -3L


// ─── nodes + neighbors ─────────

[<Fact>]
let ``nodes derives from edge endpoints`` () =
    let g =
        Graph.fromEdgeSeq [
            (1, 2, 1L)
            (2, 3, 1L)
            (3, 1, 1L)
        ]
    Graph.nodes g |> should equal (Set.ofList [1; 2; 3])
    Graph.nodeCount g |> should equal 3

[<Fact>]
let ``outNeighbors lists target nodes and weights`` () =
    let g =
        Graph.fromEdgeSeq [
            (1, 2, 3L)
            (1, 3, 5L)
            (2, 3, 1L)
        ]
    let ns = Graph.outNeighbors 1 g
    ns |> should equal [ (2, 3L); (3, 5L) ]

[<Fact>]
let ``inNeighbors is dual of outNeighbors`` () =
    let g =
        Graph.fromEdgeSeq [
            (1, 3, 5L)
            (2, 3, 1L)
        ]
    let ns = Graph.inNeighbors 3 g
    ns |> List.sortBy fst |> should equal [ (1, 5L); (2, 1L) ]

[<Fact>]
let ``degree sums in+out edge weights`` () =
    let g =
        Graph.fromEdgeSeq [
            (1, 2, 3L)    // out-edge for 1
            (2, 1, 4L)    // in-edge for 1
            (1, 3, 5L)    // out-edge for 1
        ]
    Graph.degree 1 g |> should equal (3L + 4L + 5L)


// ─── self-loop support ─────────

[<Fact>]
let ``self-loop is a legal edge (source = target)`` () =
    let (g, _) = Graph.addEdge 1 1 5L Graph.empty
    Graph.edgeCount g |> should equal 1
    Graph.edgeWeight 1 1 g |> should equal 5L

[<Fact>]
let ``self-loop counts twice in degree (once in, once out)`` () =
    let (g, _) = Graph.addEdge 1 1 3L Graph.empty
    Graph.degree 1 g |> should equal 6L  // 3 in + 3 out


// ─── fromEdgeSeq ─────────

[<Fact>]
let ``fromEdgeSeq sums duplicate edges`` () =
    let g =
        Graph.fromEdgeSeq [
            (1, 2, 3L)
            (1, 2, 4L)
        ]
    Graph.edgeWeight 1 2 g |> should equal 7L
    Graph.edgeCount g |> should equal 1

[<Fact>]
let ``fromEdgeSeq drops zero-weight triples`` () =
    let g =
        Graph.fromEdgeSeq [
            (1, 2, 0L)
            (2, 3, 1L)
            (3, 4, 0L)
        ]
    Graph.edgeCount g |> should equal 1
    Graph.edgeWeight 2 3 g |> should equal 1L


// ─── largestEigenvalue ─────────

[<Fact>]
let ``largestEigenvalue returns None for empty graph`` () =
    let g : Graph<int> = Graph.empty
    Graph.largestEigenvalue 1e-9 100 g |> should equal (None: double option)

[<Fact>]
let ``largestEigenvalue of complete bipartite-like 2-node graph approximates edge weight`` () =
    // Graph with single symmetric edge (1,2,5) + (2,1,5). After
    // symmetrization: A_sym = [[0, 5], [5, 0]]. Eigenvalues of
    // that 2x2 are ±5. Largest by magnitude = 5.
    let g =
        Graph.fromEdgeSeq [
            (1, 2, 5L)
            (2, 1, 5L)
        ]
    let lambda = Graph.largestEigenvalue 1e-9 1000 g
    match lambda with
    | Some v -> abs (v - 5.0) |> should (be lessThan) 1e-6
    | None -> failwith "expected Some"

[<Fact>]
let ``largestEigenvalue of K3 triangle (weight 1) approximates 2`` () =
    // Complete graph K3 with unit weights. Adjacency eigenvalues
    // of K_n are (n-1) and -1 (multiplicity n-1). So for K3,
    // lambda_1 = 2.
    let g =
        Graph.fromEdgeSeq [
            (1, 2, 1L); (2, 1, 1L)
            (2, 3, 1L); (3, 2, 1L)
            (3, 1, 1L); (1, 3, 1L)
        ]
    let lambda = Graph.largestEigenvalue 1e-9 1000 g
    match lambda with
    | Some v -> abs (v - 2.0) |> should (be lessThan) 1e-6
    | None -> failwith "expected Some"

[<Fact>]
let ``largestEigenvalue grows when a dense cartel clique is injected`` () =
    // Baseline: a 5-node graph with a few light connections.
    // Attack: add a 4-node clique with heavy weight 10. This is
    // the load-bearing cartel-detection signal — lambda_1
    // should grow noticeably.
    let baseline =
        Graph.fromEdgeSeq [
            (1, 2, 1L); (2, 1, 1L)
            (3, 4, 1L); (4, 3, 1L)
            (2, 5, 1L); (5, 2, 1L)
        ]
    let cartelEdges =
        [
            for s in [6; 7; 8; 9] do
                for t in [6; 7; 8; 9] do
                    if s <> t then yield (s, t, 10L)
        ]
    let attacked = Graph.fromEdgeSeq (List.append [ (1, 2, 1L); (2, 1, 1L); (3, 4, 1L); (4, 3, 1L); (2, 5, 1L); (5, 2, 1L) ] cartelEdges)
    let baselineLambda =
        Graph.largestEigenvalue 1e-9 1000 baseline
        |> Option.defaultValue 0.0
    let attackedLambda =
        Graph.largestEigenvalue 1e-9 1000 attacked
        |> Option.defaultValue 0.0
    // Baseline lambda on sparse 5-node graph is ~1 (max
    // single-edge weight).  Attacked lambda should be ~30
    // (K_4 with weight 10 has lambda_1 = 3*10 = 30, since
    // K_n has lambda_1 = n-1 scaled by weight).
    attackedLambda |> should (be greaterThan) (baselineLambda * 5.0)
