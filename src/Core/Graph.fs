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

    /// **Label propagation community detector.**
    ///
    /// A simple, non-spectral community detection algorithm. Each
    /// node starts in its own community. Each iteration, every
    /// node adopts the label that appears with greatest weighted
    /// frequency among its neighbors (ties broken by lowest
    /// community id for determinism). The algorithm stops when
    /// no node changes label in a pass, or when `maxIterations`
    /// is reached.
    ///
    /// Returns `Map<'N, int>` — node → community label. Empty
    /// map on empty graph.
    ///
    /// **Trade-offs (documented to calibrate expectations):**
    /// * Fast: O(iterations × edges), works without dense matrix.
    /// * Quality: below Louvain / spectral methods for complex
    ///   structures, but catches obvious dense cliques reliably —
    ///   exactly the trivial-cartel-detect case.
    /// * Determinism: tie-break by lowest community id (stable
    ///   across runs given same input).
    /// * NOT a replacement for Louvain; a dependency-free first
    ///   pass. Future graduation: `Graph.louvain` using the
    ///   full modularity-optimizing procedure.
    ///
    /// Provenance: 12th ferry §5 + 13th ferry §2 "community
    /// detection" + 14th ferry alert row "Modularity Q jump >
    /// 0.1 or Q > 0.4 (community-detection-based)".
    let labelPropagation
            (maxIterations: int)
            (g: Graph<'N>)
            : Map<'N, int> =
        let nodeList = nodes g |> Set.toList
        let n = nodeList.Length
        if n = 0 then Map.empty
        else
            let nodeArr = List.toArray nodeList
            let idx =
                nodeList
                |> List.mapi (fun i node -> node, i)
                |> Map.ofList
            // Initial labels: each node in its own community
            let labels = Array.init n id
            // Pre-compute neighbor-list (combined in+out, weighted
            // sum). For cartel detection we symmetrize.
            let neighbors = Array.init n (fun _ -> ResizeArray<int * int64>())
            let span = g.Edges.AsSpan()
            for k in 0 .. span.Length - 1 do
                let entry = span.[k]
                let (s, t) = entry.Key
                let si = idx.[s]
                let ti = idx.[t]
                if entry.Weight <> 0L && si <> ti then
                    neighbors.[si].Add(ti, entry.Weight)
                    neighbors.[ti].Add(si, entry.Weight)
            let mutable iter = 0
            let mutable stable = false
            while not stable && iter < maxIterations do
                stable <- true
                // Iterate nodes in fixed order for determinism
                for i in 0 .. n - 1 do
                    let nbrs = neighbors.[i]
                    if nbrs.Count > 0 then
                        // Count weighted votes per label
                        let votes = System.Collections.Generic.Dictionary<int, int64>()
                        for (ni, w) in nbrs do
                            let lbl = labels.[ni]
                            let cur =
                                match votes.TryGetValue(lbl) with
                                | true, v -> v
                                | false, _ -> 0L
                            votes.[lbl] <- cur + (if w > 0L then w else 0L)
                        // Pick label with highest vote; tie-break by
                        // lowest id for determinism
                        let mutable bestLbl = labels.[i]
                        let mutable bestVote = -1L
                        for kvp in votes do
                            if kvp.Value > bestVote ||
                               (kvp.Value = bestVote && kvp.Key < bestLbl) then
                                bestLbl <- kvp.Key
                                bestVote <- kvp.Value
                        if labels.[i] <> bestLbl then
                            labels.[i] <- bestLbl
                            stable <- false
                iter <- iter + 1
            // Build result map
            let mutable result = Map.empty
            for i in 0 .. n - 1 do
                result <- Map.add nodeArr.[i] labels.[i] result
            result

    /// **Coordination risk score (composite).**
    ///
    /// Combines multiple detection signals into a single
    /// scalar risk score for an `attacked` graph relative to
    /// a `baseline` graph. Higher scores indicate stronger
    /// evidence of coordinated structure that wasn't present
    /// in the baseline.
    ///
    /// Composite formula (MVP):
    /// ```
    ///   risk = alpha * Δλ₁_rel + beta * ΔQ
    /// ```
    /// where:
    /// * `Δλ₁_rel = (λ₁(attacked) - λ₁(baseline)) / max(λ₁(baseline), eps)`
    ///   — relative growth of principal eigenvalue
    /// * `ΔQ = Q(attacked, LP(attacked)) - Q(baseline, LP(baseline))`
    ///   — modularity gain with label-propagation-derived
    ///   partitions on each graph independently
    ///
    /// Both signals fire when a dense subgraph (cartel clique)
    /// is injected into a previously sparse baseline:
    /// `λ₁` grows because the cartel adjacency has a high
    /// leading eigenvalue; `Q` grows because LP finds the
    /// cartel as its own community and modularity evaluates
    /// that partition highly.
    ///
    /// Returns `None` when any underlying computation is
    /// undefined (empty graphs, iteration failure, degenerate
    /// cases). Returns `Some score` otherwise.
    ///
    /// **Calibration note (per Amara Otto-132 Part 2
    /// correction #4 — robust statistics):** this MVP uses
    /// simple linear weighting over raw differences. A full
    /// `CoordinationRiskScore` (per Amara's 17th-ferry
    /// corrected composite) uses robust z-scores
    /// `(x - median(baseline)) / (1.4826 * MAD(baseline))` over
    /// each metric, combined with tunable weights. That version
    /// is a future graduation once baseline-null-distribution
    /// calibration machinery ships.
    ///
    /// **Weight defaults (per Amara 17th-ferry initial priors):**
    /// * `alpha = 0.5` — spectral growth half-weight
    /// * `beta = 0.5` — modularity-shift half-weight
    /// Callers override when composite weighting is tuned
    /// against labelled examples.
    ///
    /// Provenance: 12th + 13th + 14th + 17th-ferry composite
    /// score formulations. Otto's 14th graduation — first
    /// full integration ship using four Graph primitives
    /// (`largestEigenvalue` + `labelPropagation` +
    /// `modularityScore` + this composer).
    let coordinationRiskScore
            (alpha: double)
            (beta: double)
            (eigenTol: double)
            (eigenIter: int)
            (lpIter: int)
            (baseline: Graph<'N>)
            (attacked: Graph<'N>)
            : double option =
        let lambdaBaseline = largestEigenvalue eigenTol eigenIter baseline
        let lambdaAttacked = largestEigenvalue eigenTol eigenIter attacked
        match lambdaBaseline, lambdaAttacked with
        | Some lb, Some la when lb > 1e-12 || la > 1e-12 ->
            let partitionBaseline = labelPropagation lpIter baseline
            let partitionAttacked = labelPropagation lpIter attacked
            let qBaseline =
                modularityScore partitionBaseline baseline
                |> Option.defaultValue 0.0
            let qAttacked =
                modularityScore partitionAttacked attacked
                |> Option.defaultValue 0.0
            let eps = 1e-12
            let spectralGrowth = (la - lb) / (max lb eps)
            let modularityShift = qAttacked - qBaseline
            Some (alpha * spectralGrowth + beta * modularityShift)
        | _ -> None

    /// **Robust-z-score variant of coordinationRiskScore.**
    ///
    /// Upgrades the MVP composite from raw linear differences
    /// (per PR #328) to robust standardized scores per Amara
    /// 17th-ferry correction #4 (robust statistics for
    /// adversarial data).
    ///
    /// Formula:
    /// ```
    ///   risk = alpha * Z(λ₁_attacked; baselineLambdas)
    ///        + beta  * Z(Q_attacked;  baselineQs)
    /// ```
    /// where `Z(x; baseline) = (x - median(baseline)) /
    /// (1.4826 * MAD(baseline))`.
    ///
    /// Caller provides `baselineLambdas` + `baselineQs` —
    /// sequences of metric values computed across many
    /// known-null baseline samples. The `double seq` type
    /// is materialized once inside `robustZScore` (see
    /// RobustStats), so callers may pass arrays, lists,
    /// or any `seq` form without re-enumeration cost. The
    /// distributions calibrate thresholds from data rather
    /// than hard-coding them.
    ///
    /// Returns `None` when any underlying computation is
    /// undefined (empty baselines, iteration failure, etc.).
    ///
    /// Future expansion: the full 6-term CoordinationRiskScore
    /// from Amara's 17th ferry adds Sync_S + Exclusivity_S +
    /// Influence_S terms. This MVP covers λ₁ + Q — the two
    /// signals with shipped primitives. Additional terms land
    /// as their primitives mature.
    ///
    /// Provenance: external AI collaborator's 17th
    /// courier ferry Part 2 correction #4 (robust
    /// z-scores for adversarial data) plus the corrected
    /// composite-score formula. Eighteenth graduation
    /// under the Otto-105 cadence.
    let coordinationRiskScoreRobust
            (alpha: double)
            (beta: double)
            (eigenTol: double)
            (eigenIter: int)
            (lpIter: int)
            (baselineLambdas: double seq)
            (baselineQs: double seq)
            (attacked: Graph<'N>)
            : double option =
        match largestEigenvalue eigenTol eigenIter attacked with
        | None -> None
        | Some lambdaAttacked ->
            let partition = labelPropagation lpIter attacked
            match modularityScore partition attacked with
            | None -> None
            | Some qAttacked ->
                match RobustStats.robustZScore baselineLambdas lambdaAttacked,
                      RobustStats.robustZScore baselineQs qAttacked with
                | Some zLambda, Some zQ ->
                    Some (alpha * zLambda + beta * zQ)
                | _ -> None

    /// **Internal density of a node subset S.** Ratio of
    /// internal edge weight to max ordered-pair count
    /// `|S|·(|S|-1)`, which counts ordered distinct pairs
    /// only. Self-loops (`s = t`) are excluded from the
    /// numerator to keep the metric consistent with that
    /// denominator. Returns None when |S| < 2.
    let internalDensity (subset: Set<'N>) (g: Graph<'N>) : double option =
        let size = subset.Count
        if size < 2 then None
        else
            let mutable acc = 0.0
            let span = g.Edges.AsSpan()
            for k in 0 .. span.Length - 1 do
                let entry = span.[k]
                let (s, t) = entry.Key
                if s <> t && subset.Contains s && subset.Contains t then
                    acc <- acc + double entry.Weight
            let pairs = double size * double (size - 1)
            Some (acc / pairs)

    /// **Exclusivity of a node subset S.** Internal / total-
    /// outgoing weight. Near 1 = cartel isolated. Returns None
    /// on empty S or zero outgoing weight.
    let exclusivity (subset: Set<'N>) (g: Graph<'N>) : double option =
        if subset.Count = 0 then None
        else
            let mutable internalWeight = 0.0
            let mutable totalWeight = 0.0
            let span = g.Edges.AsSpan()
            for k in 0 .. span.Length - 1 do
                let entry = span.[k]
                let (s, t) = entry.Key
                let w = double entry.Weight
                if subset.Contains s then
                    totalWeight <- totalWeight + w
                    if subset.Contains t then
                        internalWeight <- internalWeight + w
            if totalWeight = 0.0 then None
            else Some (internalWeight / totalWeight)

    /// **Conductance of a node subset S.** cut(S, V\S) /
    /// min(vol(S), vol(V\S)). Low = tight isolation. Returns
    /// None on empty, full (S ⊇ V), or zero-volume degenerate
    /// cases. The full-subset check intersects S with the
    /// graph's node set rather than comparing cardinalities,
    /// because S may contain nodes that don't appear in any
    /// edge — count equality alone is not set equality.
    let conductance (subset: Set<'N>) (g: Graph<'N>) : double option =
        if subset.Count = 0 then None
        else
            let allNodes = nodes g
            let inGraph = Set.intersect subset allNodes
            if inGraph.Count = allNodes.Count then None
            else
                let mutable cut = 0.0
                let mutable volS = 0.0
                let mutable volRest = 0.0
                let span = g.Edges.AsSpan()
                for k in 0 .. span.Length - 1 do
                    let entry = span.[k]
                    let (s, t) = entry.Key
                    let w = double entry.Weight
                    let sIn = subset.Contains s
                    let tIn = subset.Contains t
                    if sIn then volS <- volS + w
                    if tIn then volS <- volS + w
                    if not sIn then volRest <- volRest + w
                    if not tIn then volRest <- volRest + w
                    if sIn <> tIn then cut <- cut + w
                let denom = min volS volRest
                if denom <= 0.0 then None
                else Some (cut / denom)


/// **StakeCovariance — windowed pairwise stake-motion
/// covariance + acceleration.**
///
/// Cross-sectional covariance `C(t) = Cov({s_i(t)},
/// {s_j(t)})` is undefined at a single timepoint. The
/// well-defined formulation uses the stake-delta series
/// `Δs_i(t) = s_i(t) - s_i(t-1)` and computes covariance over
/// a sliding window:
///
/// ```
/// C_ij(t) = Cov_{τ ∈ [t-w+1, t]}(Δs_i(τ), Δs_j(τ))
/// A_ij(t) = C_ij(t) - 2·C_ij(t-1) + C_ij(t-2)     (2nd diff)
/// A_S(t)  = mean over pairs (i, j) ⊂ S of A_ij(t)
/// ```
///
/// Cartel-detection use: synchronized stake-motion (all-bond
/// or all-unbond simultaneously) produces a sharp positive
/// acceleration in pairwise covariance, catching cartels that
/// coordinate economically even when their graph structure
/// looks ordinary.
module StakeCovariance =

    /// Pairwise (population) covariance of stake-delta series
    /// over the trailing `windowSize` values. Divides by
    /// `windowSize` (population covariance) — appropriate when
    /// the window IS the population for that point in time, not
    /// a sample drawn from a larger one.
    ///
    /// Returns None only when `windowSize < 2`, when the two
    /// series have different lengths, or when either series has
    /// fewer than `windowSize` points. Equal lengths are
    /// required so the trailing window aligns by time index in
    /// both series; mismatched lengths are an alignment error,
    /// not a silent-truncate.
    ///
    /// Constant or otherwise zero-covariance windows return
    /// `Some 0.0` — covariance is well-defined and zero in
    /// those cases, not undefined.
    let windowedDeltaCovariance
            (windowSize: int)
            (deltasA: double[])
            (deltasB: double[])
            : double option =
        if deltasA.Length <> deltasB.Length then None
        else
            let n = deltasA.Length
            if windowSize < 2 || n < windowSize then None
            else
                let start = n - windowSize
                let mutable meanA = 0.0
                let mutable meanB = 0.0
                for i in 0 .. windowSize - 1 do
                    meanA <- meanA + deltasA.[start + i]
                    meanB <- meanB + deltasB.[start + i]
                meanA <- meanA / double windowSize
                meanB <- meanB / double windowSize
                let mutable cov = 0.0
                for i in 0 .. windowSize - 1 do
                    cov <- cov + (deltasA.[start + i] - meanA) *
                                 (deltasB.[start + i] - meanB)
                Some (cov / double windowSize)

    /// 2nd-difference acceleration `A_ij(t) = C(t) - 2·C(t-1) + C(t-2)`
    /// given three consecutive covariance values. Returns None when
    /// any input is None (can't compute acceleration across a
    /// missing measurement).
    let covarianceAcceleration
            (cNow: double option)
            (cPrev: double option)
            (cPrevPrev: double option)
            : double option =
        match cNow, cPrev, cPrevPrev with
        | Some c0, Some c1, Some c2 -> Some (c0 - 2.0 * c1 + c2)
        | _ -> None

    /// Aggregate pairwise acceleration across a candidate subset
    /// using the symmetric mean `A_S(t) = (2 / |S|(|S|-1)) · Σ_{i<j}
    /// A_ij(t)`. Input map: `(i, j)` with `i < j` → acceleration
    /// value. Generic over the node-key type so the API stays
    /// consistent with `Graph<'N>`. Returns None when the input
    /// map is empty.
    let aggregateAcceleration<'N when 'N : comparison>
            (pairAccelerations: Map<'N * 'N, double>)
            : double option =
        if pairAccelerations.IsEmpty then None
        else
            let sum, count =
                pairAccelerations
                |> Map.fold
                    (fun (s, c) _ value -> s + value, c + 1)
                    (0.0, 0)
            Some (sum / double count)
