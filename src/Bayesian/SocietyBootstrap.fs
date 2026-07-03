namespace Zeta.Bayesian

open Zeta.Bayesian

/// **SocietyBootstrap — the minimal working mutual-empowerment network.**
///
/// A society of ReferenceFrameAgents, each holding a local Gaussian belief over
/// a shared latent variable, connected through a factor graph. The network
/// demonstrates the Condorcet / mutual-empowerment property at runtime:
///
///   1. The joint posterior is strictly more precise than any single agent's posterior.
///   2. Removing any agent degrades the joint — every frame is load-bearing.
///   3. The network always converges to a proper Gaussian (soft-mode invariant).
///
/// This is the Hawkins-Zeta synthesis: a deployed, algebraically sound network of
/// reference-frame models that vote through EP message passing with no central executive.
///
/// References: Hawkins (2021) A Thousand Brains; Minka (2001) EP; Kschischang-Frey-Loeliger (2001).

/// A single reference-frame agent: a named identity with a local Gaussian prior
/// over a shared latent variable.
type ReferenceFrameAgent =
    { /// Unique identity of this frame.
      Id       : string
      /// The agent's local prior belief over the shared latent variable.
      /// Encodes what this frame "knows" independently.
      Prior    : Gaussian
      /// Variable index in the society factor graph (assigned by SocietyNetwork).
      VarIndex : int }

/// The result of running the society network to fixpoint.
type SocietyResult =
    { /// The joint posterior marginal over the shared latent variable.
      JointMarginal     : Gaussian
      /// Each agent's solo posterior (prior only, no society influence).
      SoloPosteriors    : Map<string, Gaussian>
      /// Each agent's contribution: precision gain from joining the society.
      PrecisionGains    : Map<string, float>
      /// Number of EP rounds to convergence.
      Rounds            : int
      /// True iff the joint marginal is proper (soft-mode invariant holds).
      IsProper          : bool }

/// A network of reference-frame agents connected through a shared factor graph.
/// The topology is a star: all agents share a single latent variable node,
/// each connected by an equality factor. This is the minimal topology that
/// demonstrates mutual empowerment.
[<RequireQualifiedAccess>]
module SocietyNetwork =

    /// Build a star-topology factor graph for n agents sharing a latent variable.
    /// Variable 0 = the shared latent; variables 1..n = agent observation nodes.
    /// Factor layout:
    ///   - Factor 0..n-1: prior factors (one per agent, on variable 1..n)
    ///   - Factor n..2n-1: equality factors (variable i+1 ↔ variable 0)
    let private buildGraph (agents: ReferenceFrameAgent list) : FactorGraph<Gaussian> =
        let alg = Gaussian.algebra
        let mutable g = FactorGraph.empty alg
        // Add prior factors: each agent's prior is pinned to its own variable node
        for agent in agents do
            let priorFactor = Factor.prior agent.VarIndex agent.Prior
            g <- FactorGraph.addFactor agent.VarIndex priorFactor g
        // Add equality factors: each agent variable is connected to the shared latent (var 0)
        for agent in agents do
            let eqFactor = Factor.equality alg [0; agent.VarIndex]
            g <- FactorGraph.addFactor (1000 + agent.VarIndex) eqFactor g
        g

    /// Assign variable indices to agents (1-based; 0 is the shared latent).
    let private assignIndices (agents: ReferenceFrameAgent list) : ReferenceFrameAgent list =
        agents |> List.mapi (fun i a -> { a with VarIndex = i + 1 })

    /// Run the society network to fixpoint and return the mutual-empowerment result.
    let run (maxRounds: int) (tol: float) (agents: ReferenceFrameAgent list) : SocietyResult =
        let indexed = assignIndices agents
        let g = buildGraph indexed
        let alg = Gaussian.algebra
        let (final, rounds, _converged) = FactorGraph.runToFixpoint Gaussian.distance tol maxRounds g
        let joint = FactorGraph.marginal 0 final
        // Solo posteriors: each agent's prior alone (no society influence)
        let solos =
            indexed
            |> List.map (fun a -> a.Id, a.Prior)
            |> Map.ofList
        // Precision gains: how much more precise is the joint vs each agent's solo
        let gains =
            indexed
            |> List.map (fun a ->
                let soloPrecision = a.Prior.Precision
                let gain = joint.Precision - soloPrecision
                a.Id, gain)
            |> Map.ofList
        { JointMarginal  = joint
          SoloPosteriors = solos
          PrecisionGains = gains
          Rounds         = rounds
          IsProper       = Gaussian.isProper joint }

    /// Run the society with one agent removed and return the degraded joint precision.
    /// This is the operational definition of mutual empowerment: every frame is load-bearing.
    let runWithout (maxRounds: int) (tol: float) (agentId: string) (agents: ReferenceFrameAgent list) : Gaussian =
        let reduced = agents |> List.filter (fun a -> a.Id <> agentId)
        if reduced.IsEmpty then Gaussian.One
        else
            let result = run maxRounds tol reduced
            result.JointMarginal

    /// The mutual empowerment score: the minimum precision loss when any single agent is removed.
    /// A positive score means every agent is genuinely load-bearing.
    let mutualEmpowermentScore (maxRounds: int) (tol: float) (agents: ReferenceFrameAgent list) : float =
        let full = run maxRounds tol agents
        let fullPrecision = full.JointMarginal.Precision
        agents
        |> List.map (fun a ->
            let reduced = runWithout maxRounds tol a.Id agents
            fullPrecision - reduced.Precision)
        |> List.min

    /// Pretty-print the society result for demo output.
    let describe (result: SocietyResult) : string =
        let sb = System.Text.StringBuilder()
        sb.AppendLine("=== Society Bootstrap Result ===") |> ignore
        sb.AppendLine(sprintf "Joint marginal:  τ=%.4f  τμ=%.4f  proper=%b  rounds=%d"
            result.JointMarginal.Precision
            result.JointMarginal.PrecisionMean
            result.IsProper
            result.Rounds) |> ignore
        sb.AppendLine("") |> ignore
        sb.AppendLine("Per-agent solo posteriors and precision gains:") |> ignore
        for KeyValue(id, solo) in result.SoloPosteriors do
            let gain = result.PrecisionGains.[id]
            sb.AppendLine(sprintf "  %-20s solo τ=%.4f  gain=%.4f  (%s)"
                id solo.Precision gain
                (if gain > 0.0 then "empowered ✓" else "no gain")) |> ignore
        sb.ToString()
