namespace Zeta.Core


/// Structure fingerprinting for codebase shapes.
///
/// A `StructureFingerprint` classifies a graph into one of
/// several canonical architecture patterns — operator algebra,
/// state machine, pipeline, pub/sub, tree hierarchy, layered
/// DAG, star topology, ring, bipartite, or unknown. The
/// classification uses structural signals from the graph
/// (degree distribution, cycle presence, layer count, etc.)
/// without requiring labels on nodes or edges.
///
/// This is the first child (081KR2E4K0008QG0R0031E5PR8) of the structure recognizer
/// (081KQZVQW0008QG0R002QZAFB2). It provides the F# types and recognition functions;
/// the parent's spectral/topological fingerprinting layers
/// compose over these results.
[<RequireQualifiedAccess>]
module StructureFingerprint =

    /// Canonical architecture shapes recognized by the fingerprinter.
    type Shape =
        | OperatorAlgebra
        | StateMachine
        | Pipeline
        | PubSub
        | TreeHierarchy
        | LayeredDag
        | StarTopology
        | Ring
        | Bipartite
        | Unknown

    /// Structural signals extracted from a graph before classification.
    type StructuralSignals =
        { NodeCount: int
          EdgeCount: int
          MaxInDegree: int64
          MaxOutDegree: int64
          HasCycles: bool
          LayerCount: int
          RootCount: int
          LeafCount: int
          IsBipartite: bool }

    /// A fingerprint result: the recognized shape plus the
    /// confidence score (0.0 to 1.0) and the signals used.
    type Fingerprint =
        { Shape: Shape
          Confidence: float
          Signals: StructuralSignals }

    /// Detect whether the graph has a cycle via iterative DFS.
    let private hasCycle (g: Graph<'N>) : bool =
        let allNodes = Graph.nodes g
        if allNodes.Count = 0 then false
        else
            let mutable visiting = Set.empty
            let mutable visited = Set.empty
            let mutable found = false
            for start in allNodes do
                if not found && not (visited.Contains start) then
                    let stack = System.Collections.Generic.Stack<'N * bool>()
                    stack.Push(start, false)
                    while stack.Count > 0 && not found do
                        let (node, processed) = stack.Pop()
                        if processed then
                            visiting <- visiting.Remove node
                            visited <- visited.Add node
                        elif visited.Contains node then
                            ()
                        elif visiting.Contains node then
                            found <- true
                        else
                            visiting <- visiting.Add node
                            stack.Push(node, true)
                            for (neighbor, _w) in Graph.outNeighbors node g do
                                if visiting.Contains neighbor then
                                    found <- true
                                elif not (visited.Contains neighbor) then
                                    stack.Push(neighbor, false)
            found

    /// Compute topological layers via Kahn's algorithm using longest-path
    /// DP. Returns the number of layers (max depth + 1). Nodes with
    /// multiple predecessor paths get depth = max(predecessor depth) + 1,
    /// so skip-edges like A->B->C + A->C are counted correctly (3 layers, not 2).
    /// Returns 0 for cyclic graphs or graphs with no roots.
    let private layerCount (g: Graph<'N>) : int =
        if hasCycle g then 0
        else
            let allNodes = Graph.nodes g
            if allNodes.IsEmpty then 0
            else
                let inDeg = System.Collections.Generic.Dictionary<'N, int>()
                let depth = System.Collections.Generic.Dictionary<'N, int>()
                for n in allNodes do
                    inDeg.[n] <- 0
                    depth.[n] <- 0
                for n in allNodes do
                    for (nb, _w) in Graph.outNeighbors n g do
                        inDeg.[nb] <- inDeg.[nb] + 1
                let queue = System.Collections.Generic.Queue<'N>()
                for n in allNodes do
                    if inDeg.[n] = 0 then queue.Enqueue n
                if queue.Count = 0 then 0
                else
                    let mutable maxD = 0
                    while queue.Count > 0 do
                        let node = queue.Dequeue()
                        let d = depth.[node]
                        if d > maxD then maxD <- d
                        for (nb, _w) in Graph.outNeighbors node g do
                            if depth.[nb] < d + 1 then depth.[nb] <- d + 1
                            inDeg.[nb] <- inDeg.[nb] - 1
                            if inDeg.[nb] = 0 then queue.Enqueue nb
                    maxD + 1

    /// Check bipartiteness via 2-coloring BFS.
    let private isBipartite (g: Graph<'N>) : bool =
        let allNodes = Graph.nodes g
        if allNodes.Count <= 1 then true
        else
            let color = System.Collections.Generic.Dictionary<'N, int>()
            let mutable ok = true
            for start in allNodes do
                if ok && not (color.ContainsKey start) then
                    color.[start] <- 0
                    let queue = System.Collections.Generic.Queue<'N>()
                    queue.Enqueue start
                    while queue.Count > 0 && ok do
                        let node = queue.Dequeue()
                        let c = color.[node]
                        let neighbors =
                            (Graph.outNeighbors node g |> List.map fst)
                            @ (Graph.inNeighbors node g |> List.map fst)
                            |> List.distinct
                        for nb in neighbors do
                            match color.TryGetValue nb with
                            | true, nc -> if nc = c then ok <- false
                            | false, _ ->
                                color.[nb] <- 1 - c
                                queue.Enqueue nb
            ok

    /// Extract structural signals from a graph.
    let extractSignals (g: Graph<'N>) : StructuralSignals =
        let allNodes = Graph.nodes g
        let mutable maxIn = 0L
        let mutable maxOut = 0L
        let mutable rootCount = 0
        let mutable leafCount = 0
        for n in allNodes do
            let inD = int64 (List.length (Graph.inNeighbors n g))
            let outD = int64 (List.length (Graph.outNeighbors n g))
            if inD > maxIn then maxIn <- inD
            if outD > maxOut then maxOut <- outD
            if inD = 0L then rootCount <- rootCount + 1
            if outD = 0L then leafCount <- leafCount + 1
        { NodeCount = allNodes.Count
          EdgeCount = Graph.edgeCount g
          MaxInDegree = maxIn
          MaxOutDegree = maxOut
          HasCycles = hasCycle g
          LayerCount = layerCount g
          RootCount = rootCount
          LeafCount = leafCount
          IsBipartite = isBipartite g }

    /// Classify a graph into a canonical shape from its signals.
    let classify (signals: StructuralSignals) : Shape * float =
        let n = signals.NodeCount
        let e = signals.EdgeCount
        if n = 0 then (Unknown, 0.0)
        else

        // Star: one hub with high degree, acyclic, rest have degree 1-ish
        let starScore =
            if n >= 3
               && not signals.HasCycles
               && (signals.MaxInDegree >= int64 (n - 1)
                   || signals.MaxOutDegree >= int64 (n - 1))
            then 0.9
            else 0.0

        // Pipeline: linear chain, no branching
        let pipelineScore =
            if not signals.HasCycles
               && signals.RootCount = 1
               && signals.LeafCount = 1
               && e = n - 1
               && signals.MaxInDegree <= 1L
               && signals.MaxOutDegree <= 1L
            then 0.95
            else 0.0

        // Ring: every node has exactly 1 in-edge and 1 out-edge, cycle present
        let ringScore =
            if signals.HasCycles
               && e = n
               && signals.MaxInDegree = 1L
               && signals.MaxOutDegree = 1L
               && signals.RootCount = 0
               && signals.LeafCount = 0
            then 0.9
            else 0.0

        // Tree hierarchy: DAG with single root, branching
        let treeScore =
            if not signals.HasCycles
               && signals.RootCount = 1
               && e = n - 1
               && signals.MaxOutDegree > 1L
            then 0.9
            else 0.0

        // State machine: cycles present, moderate connectivity
        let stateScore =
            if signals.HasCycles && n >= 2 && e > n then 0.7
            elif signals.HasCycles && n >= 2 then 0.5
            else 0.0

        // Layered DAG: multiple layers, no cycles, more edges than a tree
        let layeredScore =
            if not signals.HasCycles
               && signals.LayerCount >= 3
               && e > n - 1
            then 0.8
            else 0.0

        // Pub/sub: one or few sources fan out to many sinks
        let pubsubScore =
            if not signals.HasCycles
               && signals.RootCount >= 1
               && signals.LeafCount >= 3
               && signals.MaxOutDegree >= int64 (max 2 (signals.LeafCount / 2))
            then 0.75
            else 0.0

        // Operator algebra: bidirectional / dense connections, cycles
        let algebraScore =
            if signals.HasCycles
               && float e > 1.5 * float n
               && signals.IsBipartite
            then 0.75
            elif signals.HasCycles
                 && float e > 2.0 * float n
            then 0.7
            else 0.0

        // Bipartite
        let bipartiteScore =
            if signals.IsBipartite && n >= 4 && not signals.HasCycles then 0.6
            elif signals.IsBipartite && n >= 4 then 0.5
            else 0.0

        let candidates =
            [ (StarTopology, starScore)
              (Pipeline, pipelineScore)
              (Ring, ringScore)
              (TreeHierarchy, treeScore)
              (LayeredDag, layeredScore)
              (PubSub, pubsubScore)
              (OperatorAlgebra, algebraScore)
              (StateMachine, stateScore)
              (Bipartite, bipartiteScore) ]

        let best =
            candidates
            |> List.maxBy snd

        if snd best > 0.0 then best
        else (Unknown, 0.0)

    /// Compute a full fingerprint for a graph.
    let fingerprint (g: Graph<'N>) : Fingerprint =
        let signals = extractSignals g
        let (shape, confidence) = classify signals
        { Shape = shape
          Confidence = confidence
          Signals = signals }

    /// Compare two fingerprints for similarity.
    /// Returns 1.0 for identical shapes, 0.4–0.5 for related shapes,
    /// 0.1 when either shape is Unknown, 0.0 for unrelated shapes.
    let similarity (a: Fingerprint) (b: Fingerprint) : float =
        if a.Shape = b.Shape then 1.0
        else
            match a.Shape, b.Shape with
            | Pipeline, LayeredDag | LayeredDag, Pipeline -> 0.5
            | TreeHierarchy, LayeredDag | LayeredDag, TreeHierarchy -> 0.5
            | StateMachine, Ring | Ring, StateMachine -> 0.4
            | PubSub, StarTopology | StarTopology, PubSub -> 0.5
            | PubSub, TreeHierarchy | TreeHierarchy, PubSub -> 0.4
            | _, Unknown | Unknown, _ -> 0.1
            | _ -> 0.0

    /// Human-readable label for a shape.
    let shapeLabel (shape: Shape) : string =
        match shape with
        | OperatorAlgebra -> "operator-algebra"
        | StateMachine -> "state-machine"
        | Pipeline -> "pipeline"
        | PubSub -> "pub-sub"
        | TreeHierarchy -> "tree-hierarchy"
        | LayeredDag -> "layered-dag"
        | StarTopology -> "star-topology"
        | Ring -> "ring"
        | Bipartite -> "bipartite"
        | Unknown -> "unknown"
