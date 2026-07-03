module Zeta.Bayesian.AttentionRouter

open System
open Zeta.Bayesian

// ---------------------------------------------------------------------------
// KL divergence between two Gaussians (exact, closed-form)
// KL(p || q) = 0.5 * [ log(σ_q²/σ_p²) + σ_p²/σ_q² + (μ_p - μ_q)²/σ_q² - 1 ]
// In natural parameters (τ = precision, η = precision-mean):
//   μ = η/τ,  σ² = 1/τ
// ---------------------------------------------------------------------------
let klDivergence (p: Gaussian) (q: Gaussian) : float =
    if not (Gaussian.isProper p) || not (Gaussian.isProper q) then
        Double.PositiveInfinity
    else
        let muP = p.PrecisionMean / p.Precision
        let muQ = q.PrecisionMean / q.Precision
        let varP = 1.0 / p.Precision
        let varQ = 1.0 / q.Precision
        0.5 * (log (varQ / varP) + varP / varQ + (muP - muQ) ** 2.0 / varQ - 1.0)

/// Symmetric KL divergence (Jensen-Shannon style, but using sum not average)
/// This is the "information distance" between two agents' beliefs.
let symmetricKL (p: Gaussian) (q: Gaussian) : float =
    klDivergence p q + klDivergence q p

// ---------------------------------------------------------------------------
// Trajectory: the momentum vector of a belief — how it changed last tick.
// Represented as the delta in natural parameters (Δη, Δτ).
// ---------------------------------------------------------------------------
type BeliefTrajectory = { DeltaPrecisionMean: float; DeltaPrecision: float }

let private trajectoryDot (a: BeliefTrajectory) (b: BeliefTrajectory) : float =
    a.DeltaPrecisionMean * b.DeltaPrecisionMean + a.DeltaPrecision * b.DeltaPrecision

let private trajectoryNorm (t: BeliefTrajectory) : float =
    sqrt (t.DeltaPrecisionMean ** 2.0 + t.DeltaPrecision ** 2.0)

/// Cosine similarity of two trajectory vectors: 1.0 = same direction, -1.0 = opposite.
let trajectoryAlignment (a: BeliefTrajectory) (b: BeliefTrajectory) : float =
    let normA = trajectoryNorm a
    let normB = trajectoryNorm b
    if normA < 1e-12 || normB < 1e-12 then 0.0  // stationary agent — neutral
    else trajectoryDot a b / (normA * normB)

// ---------------------------------------------------------------------------
// RoutingWeight: the combined weight for a directed edge i → j.
//
// The weight has two components:
//   1. Information value: how much does j have to learn from i?
//      = KL(i || j) — high when i is confident about something j is uncertain about.
//   2. Trajectory alignment: are i and j moving in the same direction?
//      = cosine similarity of their momentum vectors.
//
// Combined weight = informationValue * (1 + alignment) / 2
//   - alignment = 1.0  (same direction): full weight — amplify each other
//   - alignment = 0.0  (orthogonal):     half weight — inform each other
//   - alignment = -1.0 (opposite):       zero weight — attenuate (productive tension
//                                        is handled by the factor graph itself)
//
// This is the "shared momentum" routing: agents with aligned trajectories
// and high information value are strongly connected.
// ---------------------------------------------------------------------------
type RoutingWeight = { From: string; To: string; Weight: float }

let routingWeight
    (fromId: string) (fromBelief: Gaussian) (fromTraj: BeliefTrajectory)
    (toId:   string) (toBelief:   Gaussian) (toTraj:   BeliefTrajectory)
    : RoutingWeight =
    let infoValue = klDivergence fromBelief toBelief
    let alignment = trajectoryAlignment fromTraj toTraj
    let weight    = infoValue * (1.0 + alignment) / 2.0
    { From = fromId; To = toId; Weight = max 0.0 weight }

// ---------------------------------------------------------------------------
// RoutingMatrix: the full n×n routing weight matrix for a society.
// ---------------------------------------------------------------------------
type AgentState =
    { Id:         string
      Belief:     Gaussian
      Trajectory: BeliefTrajectory }

/// Compute the full routing matrix for a set of agents.
/// Returns a list of (from, to, weight) triples, excluding self-loops.
let routingMatrix (agents: AgentState list) : RoutingWeight list =
    [ for a in agents do
        for b in agents do
            if a.Id <> b.Id then
                yield routingWeight a.Id a.Belief a.Trajectory
                                    b.Id b.Belief b.Trajectory ]

/// Normalize the routing weights so that each agent's outgoing weights sum to 1.
/// This ensures no agent "floods" the network — the total influence budget is fixed.
let normalizeOutgoing (weights: RoutingWeight list) : RoutingWeight list =
    let grouped = weights |> List.groupBy (fun w -> w.From)
    [ for (_, outgoing) in grouped do
        let total = outgoing |> List.sumBy (fun w -> w.Weight)
        if total > 1e-12 then
            for w in outgoing do
                yield { w with Weight = w.Weight / total }
        else
            // All weights are zero (stationary agent) — distribute uniformly
            let n = float outgoing.Length
            for w in outgoing do
                yield { w with Weight = 1.0 / n } ]

// ---------------------------------------------------------------------------
// NCI Propagation Rule (Non-Coercive Influence boundary):
//   A message from agent i to agent j propagates if and only if:
//   1. The message is a proper Gaussian (properness invariant — structural).
//   2. The routing weight w(i→j) > threshold (attention consent — economic).
//   3. The message does not increase j's precision by more than a factor of
//      maxPrecisionGainFactor (coercion bound — prevents any single agent
//      from collapsing j's belief by flooding it with certainty).
//
// Violation of rule 3 is the algebraic definition of coercion: forcing
// another agent's belief to collapse toward your own.
// ---------------------------------------------------------------------------
type PropagationDecision =
    | Propagate of dampedWeight: float
    | Attenuate of reason: string

let nciDecision
    (threshold: float)
    (maxPrecisionGainFactor: float)
    (weight: RoutingWeight)
    (senderBelief: Gaussian)
    (receiverBelief: Gaussian)
    : PropagationDecision =
    if not (Gaussian.isProper senderBelief) then
        Attenuate "improper message — structural rejection"
    elif weight.Weight < threshold then
        Attenuate (sprintf "weight %.4f below threshold %.4f — attention not granted" weight.Weight threshold)
    else
        // Check coercion bound: would this message increase receiver's precision
        // by more than maxPrecisionGainFactor?
        let projectedPrecision = receiverBelief.Precision + senderBelief.Precision
        let gainFactor = projectedPrecision / receiverBelief.Precision
        if gainFactor > maxPrecisionGainFactor then
            // Damp the message to stay within the coercion bound
            let dampedWeight = weight.Weight * (maxPrecisionGainFactor - 1.0) / (gainFactor - 1.0)
            Propagate (min weight.Weight dampedWeight)
        else
            Propagate weight.Weight

// ---------------------------------------------------------------------------
// AttentionRouter: the full routing policy for a society network.
// ---------------------------------------------------------------------------
type AttentionRouterConfig =
    { /// Minimum routing weight for a message to propagate.
      PropagationThreshold:    float
      /// Maximum precision gain factor per message (coercion bound).
      MaxPrecisionGainFactor:  float
      /// Whether to normalize outgoing weights to sum to 1.
      NormalizeOutgoing:       bool }

let defaultConfig : AttentionRouterConfig =
    { PropagationThreshold   = 0.05
      MaxPrecisionGainFactor = 3.0
      NormalizeOutgoing      = true }

type RoutingDecision =
    { Weight:    RoutingWeight
      Decision:  PropagationDecision }

/// Compute the full routing decisions for a society, given the current agent states.
let route
    (config: AttentionRouterConfig)
    (agents: AgentState list)
    : RoutingDecision list =
    let raw = routingMatrix agents
    let weights =
        if config.NormalizeOutgoing then normalizeOutgoing raw
        else raw
    let agentMap = agents |> List.map (fun a -> a.Id, a) |> Map.ofList
    [ for w in weights do
        let sender   = agentMap.[w.From]
        let receiver = agentMap.[w.To]
        let decision = nciDecision
                           config.PropagationThreshold
                           config.MaxPrecisionGainFactor
                           w
                           sender.Belief
                           receiver.Belief
        yield { Weight = w; Decision = decision } ]

/// Extract only the propagating edges and their effective weights.
let propagatingEdges (decisions: RoutingDecision list) : (string * string * float) list =
    [ for d in decisions do
        match d.Decision with
        | Propagate w -> yield (d.Weight.From, d.Weight.To, w)
        | Attenuate _ -> () ]

/// Describe the routing decisions for human inspection.
let describe (decisions: RoutingDecision list) : string =
    let lines =
        decisions
        |> List.map (fun d ->
            match d.Decision with
            | Propagate w ->
                sprintf "  %s → %s: PROPAGATE (weight=%.3f, effective=%.3f)"
                    d.Weight.From d.Weight.To d.Weight.Weight w
            | Attenuate reason ->
                sprintf "  %s → %s: ATTENUATE (%s)"
                    d.Weight.From d.Weight.To reason)
    String.concat "\n" lines
