namespace Zeta.Bayesian

open Zeta.Core

/// **`LocalConsensus` — the Arrow-escape mechanism for binary decisions.**
///
/// Arrow's Impossibility Theorem states that no social welfare function can aggregate
/// ordinal preferences into a collective ranking without violating non-dictatorship,
/// Pareto efficiency, or independence of irrelevant alternatives (IIA).
///
/// Zeta escapes Arrow by refusing to compute a global social welfare function.
/// Instead, binary decisions are made **locally**, within **entangled subgraphs**
/// (clusters of agents with high mutual memory and shared priors).
///
/// The mechanism is not a vote; it is **posterior convergence**. When an entangled
/// cluster exchanges beliefs, their joint posterior naturally sharpens. If the
/// precision of the joint posterior crosses a critical threshold, the cluster has
/// reached a "local consensus."
///
/// Arrow does not apply because:
/// 1. **Partial domain**: The consensus is only defined for the entangled subgraph.
///    Agents outside the graph are not overruled; they are simply not in the domain.
/// 2. **Cardinal, not ordinal**: The input is Gaussian beliefs, not preference rankings.
/// 3. **No irrelevant alternatives**: An agent outside the memory graph is not an
///    alternative that can enter the race; it physically does not exist in the
///    decision space until a memory edge is formed.
[<RequireQualifiedAccess>]
module LocalConsensus =

    /// A binary question that a cluster is trying to resolve.
    /// The state space is represented as a Gaussian centered at 1.0 (Yes) or -1.0 (No).
    type BinaryQuestion =
        { Id: string
          /// The prior belief before the cluster aggregates evidence.
          Prior: Gaussian }

    /// The state of a local consensus process.
    type ConsensusState =
        | /// The joint posterior is too diffuse; no consensus yet.
          Undecided of jointPosterior: Gaussian
        | /// The joint posterior has sharpened around 1.0 (Yes).
          ResolvedYes of jointPosterior: Gaussian
        | /// The joint posterior has sharpened around -1.0 (No).
          ResolvedNo of jointPosterior: Gaussian

    /// Compute the local consensus for a cluster of agents.
    /// - `question`: The binary question being resolved.
    /// - `agentBeliefs`: The current Gaussian beliefs of the agents in the entangled cluster.
    /// - `precisionThreshold`: The minimum precision required to declare consensus.
    ///
    /// The aggregation is simply the EP product (sum of natural parameters).
    let evaluate (question: BinaryQuestion) (agentBeliefs: Gaussian list) (precisionThreshold: float) : ConsensusState =
        // The joint posterior is the product of the prior and all agent beliefs.
        let joint = 
            agentBeliefs
            |> List.fold (fun acc g -> acc * g) question.Prior

        if joint.Precision < precisionThreshold then
            Undecided joint
        else
            // We have enough precision. Which way is it leaning?
            // μ = η / τ
            let mu = joint.PrecisionMean / joint.Precision
            if mu > 0.0 then
                ResolvedYes joint
            else
                ResolvedNo joint

    /// Determines if an agent is part of the "entangled subgraph" for a given question.
    /// In a real system, this is defined by the memory graph (in-degree / reachability).
    /// Here we model it as a boolean predicate: does this agent have a memory edge
    /// connecting it to the cluster discussing this question?
    let isEntangled (agentId: string) (memoryGraph: Map<string, string list>) (clusterRootId: string) : bool =
        // Simple reachability: is agentId in the memory graph of the cluster root?
        // (In a full implementation, this would be a transitive closure or PageRank-like depth).
        match Map.tryFind clusterRootId memoryGraph with
        | Some neighbors -> List.contains agentId neighbors
        | None -> agentId = clusterRootId // The root is always in its own cluster

    /// Evaluate consensus only over the reachable entangled subgraph.
    /// This explicitly violates Arrow's "unrestricted domain" axiom by excluding
    /// agents that are not in the memory graph.
    let evaluateLocal
        (question: BinaryQuestion)
        (allAgents: (string * Gaussian) list)
        (memoryGraph: Map<string, string list>)
        (clusterRootId: string)
        (precisionThreshold: float)
        : ConsensusState =
        
        let entangledBeliefs =
            allAgents
            |> List.filter (fun (id, _) -> isEntangled id memoryGraph clusterRootId)
            |> List.map snd

        evaluate question entangledBeliefs precisionThreshold
