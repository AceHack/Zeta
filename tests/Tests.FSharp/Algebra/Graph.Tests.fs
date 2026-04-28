module Zeta.Tests.Algebra.GraphTests

open FsUnit.Xunit
open global.Xunit
open Zeta.Core
open Zeta.Core.StakeCovariance


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


// ─── map / filter / distinct / union / difference / modularity ─────────

[<Fact>]
let ``map relabels nodes`` () =
    let g = Graph.fromEdgeSeq [ (1, 2, 3L); (2, 3, 1L) ]
    let g' = Graph.map (fun n -> n * 10) g
    Graph.edgeWeight 10 20 g' |> should equal 3L
    Graph.edgeWeight 20 30 g' |> should equal 1L

[<Fact>]
let ``filter keeps matching edges`` () =
    let g = Graph.fromEdgeSeq [ (1, 2, 3L); (2, 3, 1L); (3, 1, 5L) ]
    let g' = Graph.filter (fun (s, _) -> s > 1) g
    Graph.edgeCount g' |> should equal 2
    Graph.edgeWeight 1 2 g' |> should equal 0L

[<Fact>]
let ``distinct collapses multi-edges and drops anti-edges`` () =
    let (g1, _) = Graph.addEdge 1 2 3L Graph.empty
    let (g2, _) = Graph.addEdge 1 2 4L g1
    let g' = Graph.distinct g2
    Graph.edgeWeight 1 2 g' |> should equal 1L
    let (gNeg, _) = Graph.removeEdge 3 4 3L Graph.empty
    let gNeg' = Graph.distinct gNeg
    Graph.edgeWeight 3 4 gNeg' |> should equal 0L

[<Fact>]
let ``union + difference round-trip restores original`` () =
    let a = Graph.fromEdgeSeq [ (1, 2, 5L); (2, 3, 3L) ]
    let b = Graph.fromEdgeSeq [ (1, 2, 2L); (3, 4, 7L) ]
    let restored = Graph.difference (Graph.union a b) b
    Graph.edgeWeight 1 2 restored |> should equal 5L
    Graph.edgeWeight 2 3 restored |> should equal 3L
    Graph.edgeWeight 3 4 restored |> should equal 0L

[<Fact>]
let ``modularityScore returns None for empty graph`` () =
    (Graph.empty : Graph<int>) |> Graph.modularityScore Map.empty |> should equal (None: double option)

[<Fact>]
let ``modularityScore is high for well-separated communities`` () =
    let edges = [
        (1, 2, 10L); (2, 1, 10L); (2, 3, 10L); (3, 2, 10L); (3, 1, 10L); (1, 3, 10L)
        (4, 5, 10L); (5, 4, 10L); (5, 6, 10L); (6, 5, 10L); (6, 4, 10L); (4, 6, 10L)
        (3, 4, 1L); (4, 3, 1L)
    ]
    let g = Graph.fromEdgeSeq edges
    let partition = Map.ofList [ (1, 0); (2, 0); (3, 0); (4, 1); (5, 1); (6, 1) ]
    let q = Graph.modularityScore partition g |> Option.defaultValue 0.0
    q |> should (be greaterThan) 0.3

[<Fact>]
let ``modularityScore for single-community is 0`` () =
    let edges = [ (1,2,1L); (2,1,1L); (2,3,1L); (3,2,1L); (3,1,1L); (1,3,1L) ]
    let g = Graph.fromEdgeSeq edges
    let p = Map.ofList [ (1,0); (2,0); (3,0) ]
    let q = Graph.modularityScore p g |> Option.defaultValue nan
    abs q |> should (be lessThan) 1e-9


// ─── labelPropagation ─────────

[<Fact>]
let ``labelPropagation returns empty map for empty graph`` () =
    (Graph.empty : Graph<int>) |> Graph.labelPropagation 10 |> Map.count |> should equal 0

[<Fact>]
let ``labelPropagation converges two dense cliques to two labels`` () =
    // Two K3 cliques bridged by one thin edge. Label propagation
    // should settle with nodes {1,2,3} sharing one label and
    // nodes {4,5,6} sharing another.
    let edges = [
        (1, 2, 10L); (2, 1, 10L); (2, 3, 10L); (3, 2, 10L); (3, 1, 10L); (1, 3, 10L)
        (4, 5, 10L); (5, 4, 10L); (5, 6, 10L); (6, 5, 10L); (6, 4, 10L); (4, 6, 10L)
        (3, 4, 1L); (4, 3, 1L)
    ]
    let g = Graph.fromEdgeSeq edges
    let partition = Graph.labelPropagation 50 g
    let labelA = partition.[1]
    let labelB = partition.[4]
    // Both cliques share a label within themselves
    partition.[2] |> should equal labelA
    partition.[3] |> should equal labelA
    partition.[5] |> should equal labelB
    partition.[6] |> should equal labelB

[<Fact>]
let ``labelPropagation produces partition consumable by modularityScore`` () =
    // The composition that enables a full cartel detector: LP
    // produces a partition, modularityScore evaluates it. High
    // modularity means LP found real community structure.
    let edges = [
        (1, 2, 10L); (2, 1, 10L); (2, 3, 10L); (3, 2, 10L); (3, 1, 10L); (1, 3, 10L)
        (4, 5, 10L); (5, 4, 10L); (5, 6, 10L); (6, 5, 10L); (6, 4, 10L); (4, 6, 10L)
        (3, 4, 1L); (4, 3, 1L)
    ]
    let g = Graph.fromEdgeSeq edges
    let partition = Graph.labelPropagation 50 g
    let q = Graph.modularityScore partition g |> Option.defaultValue 0.0
    q |> should (be greaterThan) 0.3


// ─── coordinationRiskScore (composite) ─────────

[<Fact>]
let ``coordinationRiskScore returns None on empty-input pair`` () =
    let empty : Graph<int> = Graph.empty
    Graph.coordinationRiskScore 0.5 0.5 1e-9 200 50 empty empty
    |> should equal (None: double option)

[<Fact>]
let ``coordinationRiskScore is high when cartel is injected`` () =
    // Baseline: sparse 5-node graph.
    // Attacked: baseline + K4 clique among new nodes.
    let baselineEdges = [
        (1, 2, 1L); (2, 1, 1L)
        (3, 4, 1L); (4, 3, 1L)
        (2, 5, 1L); (5, 2, 1L)
    ]
    let cartelEdges = [
        for s in [6; 7; 8; 9] do
            for t in [6; 7; 8; 9] do
                if s <> t then yield (s, t, 10L)
    ]
    let baseline = Graph.fromEdgeSeq baselineEdges
    let attacked = Graph.fromEdgeSeq (List.append baselineEdges cartelEdges)
    let score =
        Graph.coordinationRiskScore 0.5 0.5 1e-9 500 50 baseline attacked
        |> Option.defaultValue 0.0
    // Composite should be clearly positive — both signals fire.
    score |> should (be greaterThan) 1.0

[<Fact>]
let ``coordinationRiskScore is near zero when attacked == baseline`` () =
    // If the "attacked" graph is identical to the baseline, no
    // new structure was added; composite should be near zero.
    let edges = [
        (1, 2, 1L); (2, 1, 1L)
        (3, 4, 1L); (4, 3, 1L)
        (2, 5, 1L); (5, 2, 1L)
    ]
    let g = Graph.fromEdgeSeq edges
    let score =
        Graph.coordinationRiskScore 0.5 0.5 1e-9 500 50 g g
        |> Option.defaultValue nan
    abs score |> should (be lessThan) 0.2


// ─── coordinationRiskScoreRobust + RobustStats.robustZScore ─────────

[<Fact>]
let ``robustZScore returns None on empty baseline`` () =
    RobustStats.robustZScore [] 1.0 |> should equal (None: double option)

[<Fact>]
let ``robustZScore of measurement equal to baseline median is 0`` () =
    // Baseline [1,2,3,4,5]; median = 3; measurement 3 → z = 0
    let z = RobustStats.robustZScore [1.0; 2.0; 3.0; 4.0; 5.0] 3.0 |> Option.defaultValue 999.0
    abs z |> should (be lessThan) 1e-9

[<Fact>]
let ``robustZScore scales MAD by 1.4826 for Gaussian consistency`` () =
    // Baseline [1,2,3,4,5]; median=3; MAD=1; scale = 1.4826.
    // Measurement 4: z = (4-3)/1.4826 ≈ 0.674.
    let z = RobustStats.robustZScore [1.0; 2.0; 3.0; 4.0; 5.0] 4.0 |> Option.defaultValue 0.0
    abs (z - 0.6744763) |> should (be lessThan) 0.001

[<Fact>]
let ``coordinationRiskScoreRobust fires strongly on cartel-injected graph`` () =
    // Gather baseline samples: 5 sparse graphs with varying
    // small lambdas and modularities. Build each as a slightly
    // perturbed 5-node random graph.
    let rng = System.Random(42)
    let baselineGraphs =
        [| for _ in 1 .. 5 ->
               [ for _ in 1 .. 5 do
                     let s = rng.Next(5)
                     let t = rng.Next(5)
                     if s <> t then yield (s, t, 1L) ]
               |> Graph.fromEdgeSeq |]
    let baselineLambdas =
        baselineGraphs
        |> Array.choose (fun g -> Graph.largestEigenvalue 1e-9 200 g)
    let baselineQs =
        baselineGraphs
        |> Array.choose (fun g ->
            let p = Graph.labelPropagation 30 g
            Graph.modularityScore p g)
    // Now build the attacked graph with K4 cartel.
    let cartelEdges = [
        for s in [6; 7; 8; 9] do
            for t in [6; 7; 8; 9] do
                if s <> t then yield (s, t, 10L)
    ]
    let attacked =
        [ yield! [(0, 1, 1L); (1, 2, 1L); (3, 4, 1L)]
          yield! cartelEdges ]
        |> Graph.fromEdgeSeq
    let risk =
        Graph.coordinationRiskScoreRobust
            0.5 0.5 1e-9 500 50
            baselineLambdas baselineQs attacked
        |> Option.defaultValue 0.0
    // Robust score: we expect a clear positive signal when
    // lambda and/or Q jumps substantially beyond the baseline
    // MAD. With K4 injected, lambda_attacked is much larger
    // than any baseline value.
    risk |> should (be greaterThan) 1.0

[<Fact>]
let ``coordinationRiskScoreRobust returns None when baselines empty`` () =
    let g = Graph.fromEdgeSeq [ (1, 2, 1L); (2, 1, 1L) ]
    Graph.coordinationRiskScoreRobust 0.5 0.5 1e-9 200 30 [||] [||] g
    |> should equal (None: double option)


// ─── internalDensity / exclusivity / conductance ─────────

[<Fact>]
let ``internalDensity returns None for subset of size < 2`` () =
    let g = Graph.fromEdgeSeq [ (1, 2, 1L); (2, 1, 1L) ]
    Graph.internalDensity (Set.singleton 1) g |> should equal (None: double option)

[<Fact>]
let ``internalDensity of K3 clique is high`` () =
    let edges = [
        (1, 2, 10L); (2, 1, 10L)
        (2, 3, 10L); (3, 2, 10L)
        (3, 1, 10L); (1, 3, 10L)
    ]
    let g = Graph.fromEdgeSeq edges
    let density =
        Graph.internalDensity (Set.ofList [1; 2; 3]) g
        |> Option.defaultValue 0.0
    abs (density - 10.0) |> should (be lessThan) 1e-9

[<Fact>]
let ``exclusivity is 1 for isolated K3`` () =
    let edges = [
        (1, 2, 5L); (2, 1, 5L); (2, 3, 5L); (3, 2, 5L)
        (3, 1, 5L); (1, 3, 5L)
    ]
    let g = Graph.fromEdgeSeq edges
    let e = Graph.exclusivity (Set.ofList [1; 2; 3]) g |> Option.defaultValue 0.0
    abs (e - 1.0) |> should (be lessThan) 1e-9

[<Fact>]
let ``conductance is low for well-isolated subset`` () =
    let edges = [
        (1, 2, 10L); (2, 1, 10L); (2, 3, 10L); (3, 2, 10L); (3, 1, 10L); (1, 3, 10L)
        (4, 5, 10L); (5, 4, 10L); (5, 6, 10L); (6, 5, 10L); (6, 4, 10L); (4, 6, 10L)
        (3, 4, 1L); (4, 3, 1L)
    ]
    let g = Graph.fromEdgeSeq edges
    let c = Graph.conductance (Set.ofList [1; 2; 3]) g |> Option.defaultValue nan
    c |> should (be lessThan) 0.1


// ─── StakeCovariance ─────────

[<Fact>]
let ``windowedDeltaCovariance returns None on too-small series`` () =
    windowedDeltaCovariance 5 [| 1.0; 2.0 |] [| 1.0; 2.0 |]
    |> should equal (None: double option)

[<Fact>]
let ``windowedDeltaCovariance detects synchronized motion`` () =
    // Two nodes moving stakes in perfect lockstep should show
    // positive covariance near the variance of each.
    let a = [| 1.0; -1.0; 1.0; -1.0; 1.0 |]
    let b = [| 1.0; -1.0; 1.0; -1.0; 1.0 |]  // identical
    let cov = windowedDeltaCovariance 5 a b |> Option.defaultValue 0.0
    cov |> should (be greaterThan) 0.5

[<Fact>]
let ``windowedDeltaCovariance detects anti-correlated motion`` () =
    // One moving up, other moving down in lockstep: negative
    // covariance.
    let a = [| 1.0; -1.0; 1.0; -1.0; 1.0 |]
    let b = [| -1.0; 1.0; -1.0; 1.0; -1.0 |]
    let cov = windowedDeltaCovariance 5 a b |> Option.defaultValue 0.0
    cov |> should (be lessThan) -0.5

[<Fact>]
let ``covarianceAcceleration = 2nd difference of covariance series`` () =
    // Covariances 0.0 → 0.5 → 2.0 gives acceleration
    // 2.0 - 2*0.5 + 0.0 = 1.0
    let a = covarianceAcceleration (Some 2.0) (Some 0.5) (Some 0.0)
    a |> Option.defaultValue 0.0 |> should equal 1.0

[<Fact>]
let ``covarianceAcceleration returns None when any input missing`` () =
    covarianceAcceleration (Some 1.0) None (Some 0.0)
    |> should equal (None: double option)

[<Fact>]
let ``aggregateAcceleration averages across pairs`` () =
    let pairs =
        Map.ofList [
            ((1, 2), 1.0)
            ((1, 3), 3.0)
            ((2, 3), 5.0)
        ]
    let agg = aggregateAcceleration pairs |> Option.defaultValue 0.0
    abs (agg - 3.0) |> should (be lessThan) 1e-9
