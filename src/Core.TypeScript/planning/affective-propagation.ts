/**
 * affective-propagation.ts — Valence-arousal emotional state propagation.
 *
 * Based on: "How Affect Propagates among LLM Agents: Emergent Emotional
 * Contagion in Crowd Simulation" (2026) and "Modeling emotional dynamics in
 * social networks" (2025).
 *
 * ## The model
 *
 * Each agent has an affective state (v, a) ∈ [-1,1]² where:
 *   v = valence (negative ↔ positive)
 *   a = arousal (calm ↔ excited)
 *
 * Emotional contagion propagates via belief propagation on a social graph:
 *   v_i(t+1) = (1-α)·v_i(t) + α·Σ_j w_ij·v_j(t) + ε_v
 *   a_i(t+1) = (1-α)·a_i(t) + α·Σ_j w_ij·a_j(t) + ε_a
 *
 * where α ∈ [0,1] is the contagion rate and w_ij is the social weight.
 *
 * ## Connection to the Zeta system
 *
 * The affective state (v, a) is a 2D extension of the CalibrationLedger's
 * trustBand. A high-trust agent (trustBand > 0.7) with positive valence
 * and high arousal is an "excited expert" — their emotional state propagates
 * more strongly through the network.
 *
 * The contagion matrix w_ij can be derived from the TravelerRankLedger:
 *   w_ij = trustBand(j) · domainOverlap(i, j)
 *
 * This creates a trust-weighted emotional propagation network.
 *
 * ## Honest scope boundary
 *
 * The contagion matrix is assumed stationary (constant w_ij). For rapidly
 * shifting social contexts, the matrix should be updated dynamically.
 * The noise terms ε_v, ε_a are Gaussian — for heavy-tailed emotional
 * shocks, use the Student-t variant (student-t-bnn.ts).
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** Valence-arousal affective state. */
export interface AffectiveState {
  /** Valence ∈ [-1, 1]: negative (distress) ↔ positive (joy). */
  readonly valence: number;
  /** Arousal ∈ [-1, 1]: calm (relaxed) ↔ excited (activated). */
  readonly arousal: number;
}

/** An agent in the affective network. */
export interface AffectiveAgent {
  readonly id: string;
  readonly state: AffectiveState;
  /** Trust weight ∈ [0,1] — from TravelerRankLedger.trustBandOf. */
  readonly trustWeight: number;
}

/** The social graph: adjacency weights w_ij. */
export type SocialGraph = Map<string, Map<string, number>>;

/** The full affective network state. */
export interface AffectiveNetwork {
  readonly agents: Map<string, AffectiveAgent>;
  readonly graph: SocialGraph;
  /** Contagion rate α ∈ [0,1]. */
  readonly alpha: number;
  /** Tick count. */
  readonly tick: number;
}

// ── Constructors ───────────────────────────────────────────────────────────────

export function neutralState(): AffectiveState {
  return { valence: 0.0, arousal: 0.0 };
}

export function createNetwork(alpha = 0.3): AffectiveNetwork {
  return { agents: new Map(), graph: new Map(), alpha, tick: 0 };
}

export function addAgent(
  net: AffectiveNetwork,
  id: string,
  state: AffectiveState = neutralState(),
  trustWeight = 0.5
): AffectiveNetwork {
  const agents = new Map(net.agents);
  agents.set(id, { id, state, trustWeight });
  return { ...net, agents };
}

export function addEdge(
  net: AffectiveNetwork,
  from: string,
  to: string,
  weight: number
): AffectiveNetwork {
  const graph = new Map(net.graph);
  if (!graph.has(from)) graph.set(from, new Map());
  graph.get(from)!.set(to, weight);
  return { ...net, graph };
}

// ── Propagation step ───────────────────────────────────────────────────────────

/**
 * One tick of affective propagation.
 * v_i(t+1) = clamp((1-α)·v_i(t) + α·Σ_j w_ij·trustWeight_j·v_j(t))
 * a_i(t+1) = clamp((1-α)·a_i(t) + α·Σ_j w_ij·trustWeight_j·a_j(t))
 */
export function propagate(net: AffectiveNetwork): AffectiveNetwork {
  const { agents, graph, alpha } = net;
  const newAgents = new Map<string, AffectiveAgent>();

  for (const [id, agent] of agents) {
    // Find all INCOMING neighbors: j where graph[j][id] exists
    let dv = 0.0;
    let da = 0.0;
    let totalW = 0.0;

    for (const [fromId, outEdges] of graph) {
      const w = outEdges.get(id);
      if (w !== undefined) {
        const n = agents.get(fromId);
        if (n) {
          const tw = w * n.trustWeight;
          dv += tw * n.state.valence;
          da += tw * n.state.arousal;
          totalW += tw;
        }
      }
    }

    const normV = totalW > 0 ? dv / totalW : 0;
    const normA = totalW > 0 ? da / totalW : 0;

    const newV = Math.max(-1, Math.min(1,
      (1 - alpha) * agent.state.valence + alpha * normV
    ));
    const newA = Math.max(-1, Math.min(1,
      (1 - alpha) * agent.state.arousal + alpha * normA
    ));

    newAgents.set(id, { ...agent, state: { valence: newV, arousal: newA } });
  }

  return { ...net, agents: newAgents, tick: net.tick + 1 };
}

/**
 * Run N ticks of propagation.
 */
export function propagateN(net: AffectiveNetwork, n: number): AffectiveNetwork {
  let current = net;
  for (let i = 0; i < n; i++) current = propagate(current);
  return current;
}

/**
 * The network mean affective state.
 */
export function meanState(net: AffectiveNetwork): AffectiveState {
  if (net.agents.size === 0) return neutralState();
  let sumV = 0, sumA = 0;
  for (const a of net.agents.values()) {
    sumV += a.state.valence;
    sumA += a.state.arousal;
  }
  return {
    valence: sumV / net.agents.size,
    arousal: sumA / net.agents.size,
  };
}

/**
 * Emotional entropy: H = -Σ p_i log p_i over the valence distribution.
 * High entropy = diverse emotional states. Low entropy = convergence.
 */
export function emotionalEntropy(net: AffectiveNetwork, bins = 10): number {
  if (net.agents.size === 0) return 0;
  const counts = new Array(bins).fill(0);
  for (const a of net.agents.values()) {
    const bin = Math.min(bins - 1, Math.floor((a.state.valence + 1) / 2 * bins));
    counts[bin]++;
  }
  const n = net.agents.size;
  return -counts.reduce((s, c) => {
    if (c === 0) return s;
    const p = c / n;
    return s + p * Math.log(p);
  }, 0);
}
