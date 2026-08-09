/**
 * affective-propagation.ts — Friedkin-Johnsen affective belief propagation.
 *
 * ## Model: Friedkin-Johnsen (1990)
 *
 * v_i(t+1) = λ_i · Σ_j W_ij · trust_j · v_j(t)  +  (1 − λ_i) · v_i(0)
 *
 * where:
 *   λ_i ∈ [0,1] = openness (susceptibility to influence, 1 − stubbornness)
 *   W_ij = edge weight from j to i (unnormalised — NOT row-normalised)
 *   trust_j = trustWeight of source agent j
 *   v_i(0) = initial valence (stubbornness anchor)
 *
 * ## Why Friedkin-Johnsen over DeGroot
 *
 * DeGroot (1974) naive consensus uses row-normalisation: the influence of
 * each source is divided by the total trust mass. This makes trust cancel
 * when there is only one source — an untrusted stranger moves your mood
 * exactly as much as a trusted friend (trust affects only the relative mix,
 * not the absolute susceptibility). This is the wrong semantics for emotional
 * contagion.
 *
 * Friedkin-Johnsen fixes this: trust has absolute effect. A lone untrusted
 * source (low trust_j) pulls weakly; a lone trusted source pulls strongly.
 * The stubbornness anchor (1 − λ_i) · v_i(0) prevents runaway convergence.
 *
 * ## Beacon anchor
 *
 * Friedkin, N.E. & Johnsen, E.C. (1990). "Social influence and opinions."
 * Journal of Mathematical Sociology, 15(3-4), 193-206.
 *
 * ## Connection to TravelerRankLedger
 *
 * trustWeight = trustBandOf(rankLedger, zid, hatId) — the EP ranking's
 * trust band is the natural input for the Friedkin-Johnsen trust weight.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AffectiveState {
  valence: number;  // [-1, 1]: negative to positive
  arousal: number;  // [-1, 1]: calm to excited
}

export interface AffectiveAgent {
  id: string;
  state: AffectiveState;
  initialState: AffectiveState;  // stubbornness anchor (v_i(0))
  trustWeight: number;           // [0, 1]: how much others trust this agent
  openness: number;              // λ_i ∈ [0,1]: susceptibility to influence
}

export interface AffectiveNetwork {
  agents: Map<string, AffectiveAgent>;
  graph: Map<string, Map<string, number>>;  // graph[from][to] = edge weight
  tick: number;
}

// ── Constructors ───────────────────────────────────────────────────────────────

export function neutralState(): AffectiveState {
  return { valence: 0.0, arousal: 0.0 };
}

/** Create an empty affective network. */
export function createNetwork(): AffectiveNetwork {
  return { agents: new Map(), graph: new Map(), tick: 0 };
}

/**
 * Add an agent to the network.
 * @param openness λ_i ∈ [0,1] — susceptibility to influence (default 0.5)
 * @param trustWeight how much others trust this agent (default 0.5)
 */
export function addAgent(
  net: AffectiveNetwork,
  id: string,
  state: AffectiveState = neutralState(),
  trustWeight = 0.5,
  openness = 0.5,
): AffectiveNetwork {
  const agent: AffectiveAgent = {
    id,
    state,
    initialState: { ...state },  // stubbornness anchor
    trustWeight,
    openness,
  };
  const agents = new Map(net.agents);
  agents.set(id, agent);
  return { ...net, agents };
}

/** Add a directed edge from → to with weight. */
export function addEdge(
  net: AffectiveNetwork,
  from: string,
  to: string,
  weight = 1.0,
): AffectiveNetwork {
  const graph = new Map(net.graph);
  if (!graph.has(from)) graph.set(from, new Map());
  const outEdges = new Map(graph.get(from)!);
  outEdges.set(to, weight);
  graph.set(from, outEdges);
  return { ...net, graph };
}

// ── Friedkin-Johnsen propagation ───────────────────────────────────────────────

/**
 * One tick of Friedkin-Johnsen affective propagation.
 *
 * v_i(t+1) = clamp(λ_i · Σ_j W_ij · trust_j · v_j(t)  +  (1−λ_i) · v_i(0))
 *
 * Key difference from DeGroot: NO row-normalisation.
 * Trust has absolute effect — a lone untrusted source pulls weakly.
 */
export function propagate(net: AffectiveNetwork): AffectiveNetwork {
  const { agents, graph } = net;
  const newAgents = new Map<string, AffectiveAgent>();

  for (const [id, agent] of agents) {
    // Accumulate incoming influence (unnormalised — Friedkin-Johnsen)
    let dv = 0.0;
    let da = 0.0;

    for (const [fromId, outEdges] of graph) {
      const w = outEdges.get(id);
      if (w !== undefined) {
        const n = agents.get(fromId);
        if (n) {
          // Absolute trust effect: W_ij · trust_j · v_j
          dv += w * n.trustWeight * n.state.valence;
          da += w * n.trustWeight * n.state.arousal;
        }
      }
    }

    // Friedkin-Johnsen update: λ_i · influence + (1 − λ_i) · v_i(0)
    const lam = agent.openness;
    const newV = Math.max(-1, Math.min(1,
      lam * dv + (1 - lam) * agent.initialState.valence
    ));
    const newA = Math.max(-1, Math.min(1,
      lam * da + (1 - lam) * agent.initialState.arousal
    ));

    newAgents.set(id, { ...agent, state: { valence: newV, arousal: newA } });
  }

  return { ...net, agents: newAgents, tick: net.tick + 1 };
}

/** Run N ticks of propagation. */
export function propagateN(net: AffectiveNetwork, n: number): AffectiveNetwork {
  let current = net;
  for (let i = 0; i < n; i++) current = propagate(current);
  return current;
}

/** The network mean affective state. */
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
