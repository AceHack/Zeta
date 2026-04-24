namespace Zeta.Core


/// **Graph — ZSet-backed retraction-native graph substrate.**
///
/// A `Graph<'N>` is a structural wrapper around `ZSet<'N * 'N>`:
/// every edge is an entry in the underlying ZSet with a signed
/// `Weight`. Add-edge is a ZSet add; remove-edge is a ZSet sub.
/// Net-zero entries compact by the existing ZSet consolidation
/// pass (Spine-backed when persisted).
///
/// **Design contract:** `docs/DECISIONS/2026-04-24-graph-
/// substrate-zset-backed-retraction-native.md` (Otto-123 ADR)
/// codifies the 5 tightness properties: ZSet-backed, first-class
/// event support, retractable, storage-format tight, operator-
/// algebra composable.
///
/// **Attribution.**
/// * Aaron — design bar ("tight in all aspects") Otto-121
/// * Amara — formalization (11th + 12th + 13th + 14th ferries
///   + validation-bar Otto-122 "can it detect a dumb cartel in
///   a toy simulation?")
/// * Otto — implementation (8th graduation under Otto-105
///   cadence; first module that completes a cross-ferry arc
///   from concept to running substrate)
///
/// **Scope of this first graduation.** Core type + minimal
/// mutation operators + node/edge accessors + retraction-
/// conservation property test. Detection primitives
/// (`largestEigenvalue`, `modularityScore`) and toy cartel
/// detector ship in follow-up PRs composing on this
/// foundation. Splitting across multiple PRs per Otto-105
/// small-graduation cadence; the ADR's single-PR preference
/// defers to cadence discipline.
///
/// **Graph event semantics.** Directed edges by default. Multi-
/// edges supported by ZSet weight (weight = count). Self-loops
/// allowed (source = target is a legal edge). Nodes derived
/// from edge-endpoint set — MVP; standalone-node tracking
/// deferred to future graduation if needed.
[<AutoOpen>]
module Graph =

    /// A directed-edge event emitted when a graph mutates.
    /// Subscribers consume this via Zeta's existing Circuit /
    /// Stream machinery — no graph-specific event plumbing.
    type GraphEvent<'N> =
        | EdgeAdded of source:'N * target:'N * weight:int64
        | EdgeRemoved of source:'N * target:'N * weight:int64

    /// `Graph<'N>` — a directed graph with signed-weight edges.
    /// Internal representation is `ZSet<'N * 'N>` so that every
    /// existing ZSet operator composes automatically.
    type Graph<'N when 'N : comparison> =
        internal
            { Edges: ZSet<'N * 'N> }

    /// Empty graph — no edges, no nodes.
    [<GeneralizableValue>]
    let empty<'N when 'N : comparison> : Graph<'N> =
        { Edges = ZSet.empty<'N * 'N> }

    /// `isEmpty g` — true when the graph has no edges with
    /// non-zero weight.
    let isEmpty (g: Graph<'N>) : bool = ZSet.isEmpty g.Edges

    /// `edgeCount g` — number of distinct edges with non-zero
    /// weight (multi-edges count as one; weight is not the
    /// count here — `edgeWeight` exposes the multiplicity).
    let edgeCount (g: Graph<'N>) : int = ZSet.count g.Edges

    /// `edgeWeight g source target` — the signed multiplicity
    /// of the edge `source → target`. Returns 0 when the edge
    /// is absent or has been fully retracted.
    let edgeWeight (source: 'N) (target: 'N) (g: Graph<'N>) : int64 =
        ZSet.lookup (source, target) g.Edges

    /// `addEdge g source target weight` — add `weight` to the
    /// multiplicity of the edge `source → target`. Returns the
    /// updated graph AND the emitted event. Weight of zero is
    /// a no-op and emits no event.
    let addEdge
            (source: 'N)
            (target: 'N)
            (weight: int64)
            (g: Graph<'N>)
            : Graph<'N> * GraphEvent<'N> list =
        if weight = 0L then (g, [])
        else
            let delta = ZSet.singleton (source, target) weight
            let merged = ZSet.add g.Edges delta
            ({ Edges = merged }, [ EdgeAdded(source, target, weight) ])

    /// `removeEdge g source target weight` — subtract `weight`
    /// from the multiplicity of the edge. NON-DESTRUCTIVE:
    /// emits a negative-weight ZSet delta; if the result
    /// net-zeros, ZSet consolidation drops the entry but the
    /// Spine trace preserves the history. Weight of zero is
    /// a no-op.
    let removeEdge
            (source: 'N)
            (target: 'N)
            (weight: int64)
            (g: Graph<'N>)
            : Graph<'N> * GraphEvent<'N> list =
        if weight = 0L then (g, [])
        else
            let delta = ZSet.singleton (source, target) (-weight)
            let merged = ZSet.add g.Edges delta
            ({ Edges = merged }, [ EdgeRemoved(source, target, weight) ])

    /// `fromEdgeSeq edges` — build a graph from an unordered
    /// sequence of `(source, target, weight)` triples.
    /// Duplicates sum via the underlying ZSet; zero-weight
    /// triples are dropped.
    let fromEdgeSeq (edges: ('N * 'N * int64) seq) : Graph<'N> =
        let pairs = edges |> Seq.map (fun (s, t, w) -> (s, t), w)
        { Edges = ZSet.ofSeq pairs }

    /// `nodes g` — the set of nodes that appear as an endpoint
    /// of any edge with non-zero weight. Derived from the edge
    /// set; standalone-node tracking is a future graduation
    /// candidate.
    let nodes (g: Graph<'N>) : Set<'N> =
        let mutable acc = Set.empty
        let span = g.Edges.AsSpan()
        for i in 0 .. span.Length - 1 do
            let entry = span.[i]
            let (s, t) = entry.Key
            acc <- acc.Add s |> Set.add t
        acc

    /// `nodeCount g` — `|nodes g|`.
    let nodeCount (g: Graph<'N>) : int = (nodes g).Count

    /// `outNeighbors source g` — for each `(source, t, w)` in
    /// the graph with non-zero `w`, return `(t, w)`. Does not
    /// traverse; direct lookup against the edge set.
    let outNeighbors (source: 'N) (g: Graph<'N>) : ('N * int64) list =
        let span = g.Edges.AsSpan()
        let mutable acc = []
        for i in 0 .. span.Length - 1 do
            let entry = span.[i]
            let (s, t) = entry.Key
            if s = source && entry.Weight <> 0L then
                acc <- (t, entry.Weight) :: acc
        List.rev acc

    /// `inNeighbors target g` — dual of `outNeighbors`, edges
    /// where `_ → target`.
    let inNeighbors (target: 'N) (g: Graph<'N>) : ('N * int64) list =
        let span = g.Edges.AsSpan()
        let mutable acc = []
        for i in 0 .. span.Length - 1 do
            let entry = span.[i]
            let (s, t) = entry.Key
            if t = target && entry.Weight <> 0L then
                acc <- (s, entry.Weight) :: acc
        List.rev acc

    /// `degree n g` — total in-degree + out-degree of `n`
    /// (counting each edge-weight once). Self-loops count
    /// twice (once as in-edge, once as out-edge).
    let degree (n: 'N) (g: Graph<'N>) : int64 =
        let span = g.Edges.AsSpan()
        let mutable acc = 0L
        for i in 0 .. span.Length - 1 do
            let entry = span.[i]
            let (s, t) = entry.Key
            if s = n then acc <- acc + entry.Weight
            if t = n then acc <- acc + entry.Weight
        acc

    /// **Largest eigenvalue (λ₁) via power iteration.**
    ///
    /// Computes an approximation of the principal eigenvalue of
    /// the symmetrized adjacency matrix `A_sym = (A + A^T) / 2`
    /// (weighted by edge multiplicity). For directed graphs we
    /// symmetrize; for undirected graphs this is the exact
    /// adjacency matrix. Weights coerce to `double`; negative
    /// weights (anti-edges) are included as signed entries.
    ///
    /// Returns `None` when the graph is empty or the iteration
    /// fails to converge within `maxIterations`. Returns
    /// `Some lambda_1` otherwise.
    ///
    /// **Method:** standard power iteration with L2
    /// normalization. Start with the all-ones vector (a
    /// non-pathological seed that avoids the zero-vector trap);
    /// iterate `v ← A_sym · v; v ← v / ||v||`; stop when
    /// `|λ_k - λ_{k-1}| / (|λ_k| + ε) < tolerance` or
    /// `k = maxIterations`. Final eigenvalue is the Rayleigh
    /// quotient `(v^T · A_sym · v) / (v^T · v)`.
    ///
    /// **Cartel-detection use:** a sharp jump in `λ₁` between
    /// a baseline graph and an injected-cartel graph indicates
    /// a dense subgraph formed. The 11th-ferry / 13th-ferry /
    /// 14th-ferry spec treats this as the first trivial-cartel
    /// warning signal.
    ///
    /// **Performance note:** builds a dense
    /// `IReadOnlyDictionary<'N, Dictionary<'N, double>>` as the
    /// adjacency representation. Suitable for MVP / toy
    /// simulations (50-500 nodes). For larger graphs, a
    /// Lanczos-based incremental spectral method is the next
    /// graduation; documented as future work.
    ///
    /// Provenance: concept Aaron; formalization Amara (11th
    /// ferry §2 + 13th ferry §2); implementation Otto (10th
    /// graduation).
    let largestEigenvalue
            (tolerance: double)
            (maxIterations: int)
            (g: Graph<'N>)
            : double option =
        let nodeList = nodes g |> Set.toList
        let n = nodeList.Length
        if n = 0 || maxIterations < 1 then None
        else
            // Build adjacency map with symmetrized weights.
            // A_sym[i, j] = (A[i, j] + A[j, i]) / 2
            let idx =
                nodeList
                |> List.mapi (fun i node -> node, i)
                |> Map.ofList
            let adj = Array2D.create n n 0.0
            let span = g.Edges.AsSpan()
            for k in 0 .. span.Length - 1 do
                let entry = span.[k]
                let (s, t) = entry.Key
                let i = idx.[s]
                let j = idx.[t]
                let w = double entry.Weight
                adj.[i, j] <- adj.[i, j] + w
            // Symmetrize: A_sym[i, j] = (A[i, j] + A[j, i]) / 2
            let sym = Array2D.create n n 0.0
            for i in 0 .. n - 1 do
                for j in 0 .. n - 1 do
                    sym.[i, j] <- (adj.[i, j] + adj.[j, i]) / 2.0

            let matVec (m: double[,]) (v: double[]) : double[] =
                let out = Array.zeroCreate n
                for i in 0 .. n - 1 do
                    let mutable acc = 0.0
                    for j in 0 .. n - 1 do
                        acc <- acc + m.[i, j] * v.[j]
                    out.[i] <- acc
                out

            let l2Norm (v: double[]) : double =
                let mutable acc = 0.0
                for i in 0 .. v.Length - 1 do
                    acc <- acc + v.[i] * v.[i]
                sqrt acc

            let normalize (v: double[]) : double[] =
                let norm = l2Norm v
                if norm = 0.0 then v
                else v |> Array.map (fun x -> x / norm)

            let rayleigh (v: double[]) : double =
                let av = matVec sym v
                let mutable num = 0.0
                let mutable den = 0.0
                for i in 0 .. n - 1 do
                    num <- num + v.[i] * av.[i]
                    den <- den + v.[i] * v.[i]
                if den = 0.0 then 0.0 else num / den

            let mutable v = Array.create n 1.0
            v <- normalize v
            let mutable lambda = rayleigh v
            let mutable converged = false
            let mutable iter = 0
            while not converged && iter < maxIterations do
                let v' = normalize (matVec sym v)
                let lambda' = rayleigh v'
                let delta = abs (lambda' - lambda) / (abs lambda' + 1e-12)
                if delta < tolerance then converged <- true
                v <- v'
                lambda <- lambda'
                iter <- iter + 1
            if converged then Some lambda
            else if iter >= maxIterations then Some lambda
            else None

    /// `map f g` — relabel nodes via `f`. Wraps `ZSet.map` with
    /// projection over the node-tuple. Operator-algebra
    /// composition per ADR property 5.
    let map (f: 'N -> 'M) (g: Graph<'N>) : Graph<'M> when 'M : comparison =
        { Edges = ZSet.map (fun (s, t) -> (f s, f t)) g.Edges }

    /// `filter predicate g` — keep only edges matching the
    /// predicate. Delegates to `ZSet.filter`.
    let filter (predicate: 'N * 'N -> bool) (g: Graph<'N>) : Graph<'N> =
        { Edges = ZSet.filter predicate g.Edges }

    /// `distinct g` — collapse multi-edges to multiplicity 1;
    /// drop anti-edges. Delegates to `ZSet.distinct`.
    let distinct (g: Graph<'N>) : Graph<'N> =
        { Edges = ZSet.distinct g.Edges }

    /// `union a b` — add edge weights across graphs. Wraps
    /// `ZSet.add`.
    let union (a: Graph<'N>) (b: Graph<'N>) : Graph<'N> =
        { Edges = ZSet.add a.Edges b.Edges }

    /// `difference a b` — subtract b from a. Wraps `ZSet.sub`.
    let difference (a: Graph<'N>) (b: Graph<'N>) : Graph<'N> =
        { Edges = ZSet.sub a.Edges b.Edges }

    /// **Modularity score (Q)** for a node partition. Newman's
    /// formula over the symmetrized adjacency. Returns Some Q
    /// in [-0.5, 1]; None for empty graph or zero total weight.
    ///
    /// Formula: Q = (1/2m) * sum_{i,j} [A_sym[i,j] - k_i*k_j/(2m)] * delta(c_i, c_j)
    ///
    /// Nodes missing from `partition` are treated as singleton
    /// groups (each in a unique community, no shared label).
    ///
    /// Provenance: 11th + 13th + 14th ferries Graph metric §.
    let modularityScore
            (partition: Map<'N, int>)
            (g: Graph<'N>)
            : double option =
        let nodeList = nodes g |> Set.toList
        let n = nodeList.Length
        if n = 0 then None
        else
            let idx = nodeList |> List.mapi (fun i node -> node, i) |> Map.ofList
            let adj = Array2D.create n n 0.0
            let span = g.Edges.AsSpan()
            for k in 0 .. span.Length - 1 do
                let entry = span.[k]
                let (s, t) = entry.Key
                adj.[idx.[s], idx.[t]] <- adj.[idx.[s], idx.[t]] + double entry.Weight
            let sym = Array2D.create n n 0.0
            for i in 0 .. n - 1 do
                for j in 0 .. n - 1 do
                    sym.[i, j] <- (adj.[i, j] + adj.[j, i]) / 2.0
            let k = Array.create n 0.0
            for i in 0 .. n - 1 do
                let mutable acc = 0.0
                for j in 0 .. n - 1 do
                    acc <- acc + sym.[i, j]
                k.[i] <- acc
            let twoM = Array.sum k
            if twoM = 0.0 then None
            else
                let community i =
                    let node = nodeList.[i]
                    match Map.tryFind node partition with
                    | Some c -> c
                    | None -> -(i + 1)
                let mutable q = 0.0
                for i in 0 .. n - 1 do
                    for j in 0 .. n - 1 do
                        if community i = community j then
                            q <- q + (sym.[i, j] - (k.[i] * k.[j]) / twoM)
                Some (q / twoM)
