module Zeta.Bayesian.SparseSocietyNetwork

open Zeta.Bayesian
open Zeta.Bayesian.AttentionRouter

// ---------------------------------------------------------------------------
// SparseSocietyNetwork: a society network where the factor graph is rebuilt
// each round using the attention router's routing decisions.
//
// In the fully-connected SocietyNetwork, every agent talks to every other
// agent with equal weight. Here, the routing matrix is computed from the
// current belief states and trajectories, and only the propagating edges
// are included in the factor graph for that round.
//
// This models the Hawkins voting mechanism: only the frames that are
// genuinely informative to each other exchange messages each tick.
// ---------------------------------------------------------------------------

type SparseAgentState =
    { Id:         string
      Prior:      Gaussian
      Current:    Gaussian
      Trajectory: BeliefTrajectory }

type SparseRoundResult =
    { Round:            int
      AgentStates:      Map<string, SparseAgentState>
      RoutingDecisions: RoutingDecision list
      ActiveEdges:      int
      TotalEdges:       int
      JointMarginal:    Gaussian }

type SparseSocietyResult =
    { Rounds:              int
      Converged:           bool
      FinalJointMarginal:  Gaussian
      FinalAgentStates:    Map<string, SparseAgentState>
      RoundHistory:        SparseRoundResult list
      IsProper:            bool
      MutualEmpowerment:   float }

// ---------------------------------------------------------------------------
// Build a factor graph from the active routing edges.
// Each active edge (i → j) contributes an equality factor between i and j,
// weighted by the effective routing weight (used as a precision scale).
// ---------------------------------------------------------------------------
let private buildWeightedAgents
    (agents: SparseAgentState list)
    (activeEdges: (string * string * float) list)
    : ReferenceFrameAgent list =
    // Compute weighted beliefs based on incoming routing attention.
    //
    // Weighted fusion: agent j's effective prior = j.Current * (sum of incoming weights from i)
    // This is the attention mechanism: agents that receive more attention from others
    // contribute more to the joint posterior.
    let agentMap = agents |> List.map (fun a -> a.Id, a) |> Map.ofList
    // Compute effective precision scale for each agent based on incoming routing weights
    let incomingWeights =
        activeEdges
        |> List.groupBy (fun (_, toId, _) -> toId)
        |> List.map (fun (toId, edges) ->
            let totalWeight = edges |> List.sumBy (fun (_, _, w) -> w)
            (toId, totalWeight))
        |> Map.ofList
    // Build weighted beliefs: scale precision by (1 + incoming weight)
    // This means agents that are "attended to" by many others have more influence
    let weightedBeliefs =
        agents
        |> List.map (fun a ->
            let inWeight = incomingWeights |> Map.tryFind a.Id |> Option.defaultValue 0.0
            let scale = 1.0 + inWeight
            let weighted =
                { PrecisionMean = a.Current.PrecisionMean * scale
                  Precision     = a.Current.Precision * scale }
            (a.Id, weighted))
    // Build a list of weighted ReferenceFrameAgents for SocietyNetwork.run
    // Each agent is its OWN evidence source here: the sparse network derives one
    // belief per agent id from that agent own trajectory, so the ids are distinct
    // by construction and nothing is double-counted at admission.
    weightedBeliefs
    |> List.map (fun (id, belief) -> ReferenceFrameAgent.attested id id belief)

// ---------------------------------------------------------------------------
// One round of the sparse society network:
// 1. Compute routing decisions from current agent states
// 2. Build sparse factor graph from active edges
// 3. Run one pass of message passing
// 4. Update agent states with new beliefs and trajectories
// ---------------------------------------------------------------------------
let private oneRound
    (config: AttentionRouterConfig)
    (round: int)
    (agents: SparseAgentState list)
    : SparseRoundResult * SparseAgentState list =
    // Compute routing decisions
    let agentStates =
        agents
        |> List.map (fun a ->
            { Id = a.Id; Belief = a.Current; Trajectory = a.Trajectory })
    let decisions = route config agentStates
    let active    = propagatingEdges decisions
    let totalEdges = agents.Length * (agents.Length - 1)
    // Build weighted agents and run one full convergence pass
    let weightedAgents = buildWeightedAgents agents active
    let societyResult  = SocietyNetwork.run 50 1e-6 weightedAgents
    // Extract new marginals for each agent from the society result
    let newMarginals =
        agents
        |> List.map (fun a ->
            let solo = societyResult.SoloPosteriors |> Map.tryFind a.Id
            let newBelief =
                match solo with
                | Some s -> s  // use the society-updated belief
                | None   -> a.Current
            (a.Id, newBelief))
        |> Map.ofList
    // Update agent states with new beliefs and trajectories
    let newAgents =
        agents
        |> List.map (fun a ->
            let newBelief = newMarginals.[a.Id]
            let traj =
                { DeltaPrecisionMean = newBelief.PrecisionMean - a.Current.PrecisionMean
                  DeltaPrecision     = newBelief.Precision     - a.Current.Precision }
            { a with Current = newBelief; Trajectory = traj })
    // Compute joint marginal (product of all current beliefs)
    let joint =
        newAgents
        |> List.map (fun a -> a.Current)
        |> List.reduce (fun acc b -> acc * b)
    let result =
        { Round            = round
          AgentStates      = newAgents |> List.map (fun a -> a.Id, a) |> Map.ofList
          RoutingDecisions = decisions
          ActiveEdges      = active.Length
          TotalEdges       = totalEdges
          JointMarginal    = joint }
    result, newAgents

// ---------------------------------------------------------------------------
// Run the sparse society network to convergence.
// ---------------------------------------------------------------------------
let run
    (config: AttentionRouterConfig)
    (maxRounds: int)
    (tol: float)
    (agents: ReferenceFrameAgent list)
    : SparseSocietyResult =
    // Initialize agent states with zero trajectory
    let zeroTraj = { DeltaPrecisionMean = 0.0; DeltaPrecision = 0.0 }
    let initStates =
        agents
        |> List.map (fun a ->
            { Id = a.Id; Prior = a.Prior; Current = a.Prior; Trajectory = zeroTraj })
    let mutable states    = initStates
    let mutable round     = 0
    let mutable converged = false
    let mutable history   = []
    while round < maxRounds && not converged do
        let (result, newStates) = oneRound config (round + 1) states
        history <- history @ [result]
        // Convergence: max change in any agent's precision-mean or precision
        let maxChange =
            List.zip states newStates
            |> List.map (fun (old, nw) ->
                max (abs (nw.Current.PrecisionMean - old.Current.PrecisionMean))
                    (abs (nw.Current.Precision     - old.Current.Precision)))
            |> List.max
        converged <- maxChange < tol
        states <- newStates
        round  <- round + 1
    // Final joint marginal
    let finalJoint =
        states
        |> List.map (fun a -> a.Current)
        |> List.reduce (fun acc b -> acc * b)
    // Mutual empowerment: joint precision - max solo precision
    let maxSoloPrecision = states |> List.map (fun a -> a.Prior.Precision) |> List.max
    let empowerment = finalJoint.Precision - maxSoloPrecision
    { Rounds             = round
      Converged          = converged
      FinalJointMarginal = finalJoint
      FinalAgentStates   = states |> List.map (fun a -> a.Id, a) |> Map.ofList
      RoundHistory       = history
      IsProper           = Gaussian.isProper finalJoint
      MutualEmpowerment  = empowerment }

/// Describe the final result for human inspection.
let describe (result: SparseSocietyResult) : string =
    let lines = System.Collections.Generic.List<string>()
    lines.Add(sprintf "=== Sparse Society Network (%d rounds, converged=%b) ===" result.Rounds result.Converged)
    lines.Add(sprintf "  Joint marginal: τ=%.4f, η=%.4f, μ=%.4f"
        result.FinalJointMarginal.Precision
        result.FinalJointMarginal.PrecisionMean
        (result.FinalJointMarginal.PrecisionMean / result.FinalJointMarginal.Precision))
    lines.Add(sprintf "  Mutual empowerment: +%.4f precision over best solo" result.MutualEmpowerment)
    lines.Add("")
    lines.Add("  Agent final states:")
    for KeyValue(id, state) in result.FinalAgentStates do
        lines.Add(sprintf "    %s: prior τ=%.3f → final τ=%.3f (Δτ=%.3f)"
            id state.Prior.Precision state.Current.Precision
            (state.Current.Precision - state.Prior.Precision))
    if not result.RoundHistory.IsEmpty then
        let lastRound = result.RoundHistory |> List.last
        lines.Add("")
        lines.Add(sprintf "  Last round routing (%d/%d edges active):"
            lastRound.ActiveEdges lastRound.TotalEdges)
        lines.Add(AttentionRouter.describe lastRound.RoutingDecisions)
    System.String.Join("\n", lines)
