module Zeta.Tests.Support.CartelInjector

open Zeta.Core


/// **CartelInjector** — test-only red-team synthetic cartel
/// generator. Lives in `tests/Tests.FSharp/_Support/` per Otto-118
/// discipline: adversarial tooling is NOT shipped as Zeta public
/// API. Purpose: validate detectors, not attack production systems.
///
/// Provenance: 13th ferry §3 (Synthetic Cartel Injector) + 14th
/// ferry §Adversarial Simulation Loop + Amara Otto-122 validation
/// bar (toy cartel at 50 validators + 5-node cartel).


/// Build a baseline synthetic validator network with random-ish
/// sparse edges. The call sweeps source indices `0 .. nodeCount - 1`
/// and for each source emits up to `avgDegree` outbound edges to
/// random targets drawn uniformly from the same index range; weight
/// is `1`. The resulting graph's node set is derived from the edges
/// actually emitted (self-edges are skipped, and isolated indices
/// never appear as endpoints), so `Graph.nodes baseline` may be a
/// **strict subset** of `0 .. nodeCount - 1`. The baseline has no
/// deliberate community structure — a "null" input the detector
/// should NOT flag.
let buildBaseline (rng: System.Random) (nodeCount: int) (avgDegree: int) : Graph<int> =
    let edges =
        [ for s in 0 .. nodeCount - 1 do
              for _ in 1 .. avgDegree do
                  let t = rng.Next(nodeCount)
                  if t <> s then yield (s, t, 1L) ]
    Graph.fromEdgeSeq edges


/// Inject a dense cartel clique of `cartelSize` nodes picked
/// uniformly at random from the **baseline's actual node set**
/// (`Graph.nodes baseline`), not from a precomputed index range —
/// otherwise the cartel could land on indices that never appeared
/// as endpoints in `baseline`. Every ordered pair within the cartel
/// gets an edge of weight `cartelWeight`. Lower `cartelWeight` =
/// stealthier cartel; higher = louder.
///
/// Returns the attacked graph + the set of cartel node-IDs so
/// the test can verify detection correctness.
let injectCartel
        (rng: System.Random)
        (baseline: Graph<int>)
        (cartelSize: int)
        (cartelWeight: int64)
        (_nodeCount: int)
        : Graph<int> * Set<int> =
    let cartelNodes =
        let shuffled = Graph.nodes baseline |> Set.toArray
        // Fisher-Yates shuffle
        for i in shuffled.Length - 1 .. -1 .. 1 do
            let j = rng.Next(i + 1)
            let tmp = shuffled.[i]
            shuffled.[i] <- shuffled.[j]
            shuffled.[j] <- tmp
        shuffled |> Array.take (min cartelSize shuffled.Length) |> Set.ofArray
    let cartelEdges =
        [ for s in cartelNodes do
              for t in cartelNodes do
                  if s <> t then yield (s, t, cartelWeight) ]
    let attacked =
        let combined =
            List.append
                (baseline.Edges.AsSpan().ToArray()
                 |> Array.map (fun entry ->
                     let (s, t) = entry.Key
                     (s, t, entry.Weight))
                 |> Array.toList)
                cartelEdges
        Graph.fromEdgeSeq combined
    attacked, cartelNodes
