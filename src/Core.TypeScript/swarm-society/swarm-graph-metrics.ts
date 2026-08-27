// Small-world / interaction-topology metrics for the agent-swarm graph
// (081-swarm-observability). These are DELIBERATELY distinct from DORA
// (`backlog/dora-metrics.ts` — factory velocity) and from the society rho /
// effective-agent-count health metrics (`society/*`): those answer "is the
// society healthy / are agents independent". This module answers a different,
// non-judgmental question — "what does the communication TOPOLOGY look like",
// so a swarm can be troubleshot by its interaction shape (who talks to whom,
// how clustered, how many hops apart), the way the METR/OpenAI Hugging Face
// incident had to be reconstructed forensically after the fact
// (docs/ip-questionable/2026-08-27-metr-openai-hugging-face-swarm-incident-...).
//
// Pure functions only — no I/O. The fold that reads real substrate lives in
// `swarm-graph.ts`; keeping the math here makes every metric a unit-test target
// against graphs with known topology (triangle, star, path).

/** An undirected, weighted edge between two distinct node ids. */
export interface MetricEdge {
  readonly source: string;
  readonly target: string;
  /** Interaction count on this edge (drives visual thickness). Ignored by pure
   * topology metrics below except `meanEdgeWeight`; kept so callers can pass one
   * edge list. */
  readonly weight: number;
}

export interface SwarmTopologyMetrics {
  readonly nodeCount: number;
  /** Distinct unordered pairs that share at least one edge (multi-channel
   * collapses to one topological edge). */
  readonly edgeCount: number;
  /** 2E / N(N-1): fraction of possible pairs that actually interact. */
  readonly density: number;
  readonly meanDegree: number;
  readonly maxDegree: number;
  readonly meanEdgeWeight: number;
  /** Global transitivity: 3·triangles / connected-triples. 0..1. NaN-safe → 0
   * when there are no connected triples. High clustering is the "small-world"
   * signature (cliques of collaborators). */
  readonly clusteringCoefficient: number;
  /** Mean shortest-path length over the LARGEST connected component only
   * (an averaged distance across components is undefined). null when the
   * largest component has < 2 nodes. Small values with high clustering =
   * small-world. */
  readonly averagePathLength: number | null;
  /** Longest shortest-path within the largest component (its diameter). */
  readonly largestComponentDiameter: number | null;
  readonly componentCount: number;
  readonly largestComponentSize: number;
}

/** Per-node topology summary (drives node size / labels in the UI). */
export interface NodeDegree {
  readonly id: string;
  /** Distinct neighbours. */
  readonly degree: number;
  /** Sum of incident edge weights (total interaction volume touching the node). */
  readonly strength: number;
}

function undirectedKey(a: string, b: string): string {
  return a < b ? `${a}\u0000${b}` : `${b}\u0000${a}`;
}

/**
 * Collapse a (possibly multi-channel, possibly directed) edge list into an
 * undirected adjacency map keyed by node id → set of neighbour ids. Self-loops
 * (source === target, e.g. a broadcast an agent sent to "*") are dropped from
 * topology — they carry no pairwise reachability.
 */
export function buildAdjacency(nodeIds: readonly string[], edges: readonly MetricEdge[]): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  for (const id of nodeIds) adj.set(id, new Set<string>());
  for (const e of edges) {
    if (e.source === e.target) continue;
    if (!adj.has(e.source)) adj.set(e.source, new Set<string>());
    if (!adj.has(e.target)) adj.set(e.target, new Set<string>());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);
  }
  return adj;
}

/** Distinct-neighbour degree + weighted strength per node. */
export function nodeDegrees(nodeIds: readonly string[], edges: readonly MetricEdge[]): NodeDegree[] {
  const adj = buildAdjacency(nodeIds, edges);
  const strength = new Map<string, number>();
  for (const id of nodeIds) strength.set(id, 0);
  for (const e of edges) {
    if (e.source === e.target) continue;
    strength.set(e.source, (strength.get(e.source) ?? 0) + e.weight);
    strength.set(e.target, (strength.get(e.target) ?? 0) + e.weight);
  }
  return nodeIds.map((id) => ({
    id,
    degree: adj.get(id)?.size ?? 0,
    strength: strength.get(id) ?? 0,
  }));
}

/**
 * Global clustering coefficient (transitivity): 3·triangles / connected-triples.
 * A connected triple is a node with an unordered pair of neighbours; a triangle
 * is such a pair that are themselves adjacent. Returns 0 when there are no
 * triples (a graph with no node of degree ≥ 2 has no clustering to speak of).
 */
export function clusteringCoefficient(nodeIds: readonly string[], edges: readonly MetricEdge[]): number {
  const adj = buildAdjacency(nodeIds, edges);
  let triangleTimes3 = 0;
  let triples = 0;
  for (const [, neighbours] of adj) {
    const nbrs = [...neighbours];
    const k = nbrs.length;
    if (k < 2) continue;
    triples += (k * (k - 1)) / 2;
    for (let i = 0; i < k; i++) {
      for (let j = i + 1; j < k; j++) {
        if (adj.get(nbrs[i]!)?.has(nbrs[j]!)) triangleTimes3 += 1;
      }
    }
  }
  // triangleTimes3 counts each triangle's closing edge once per apex → each
  // triangle is counted 3× across the three apices, matching the 3·triangles
  // numerator of the transitivity definition.
  if (triples === 0) return 0;
  return triangleTimes3 / triples;
}

/** Connected components over the undirected projection, largest first. */
export function connectedComponents(nodeIds: readonly string[], edges: readonly MetricEdge[]): string[][] {
  const adj = buildAdjacency(nodeIds, edges);
  const seen = new Set<string>();
  const components: string[][] = [];
  for (const start of nodeIds) {
    if (seen.has(start)) continue;
    const stack = [start];
    const comp: string[] = [];
    seen.add(start);
    while (stack.length > 0) {
      const cur = stack.pop()!;
      comp.push(cur);
      for (const nb of adj.get(cur) ?? []) {
        if (!seen.has(nb)) {
          seen.add(nb);
          stack.push(nb);
        }
      }
    }
    components.push(comp);
  }
  components.sort((a, b) => b.length - a.length);
  return components;
}

/** BFS distances from `start` over the adjacency map (unit edge weights). */
function bfsDistances(start: string, adj: Map<string, Set<string>>): Map<string, number> {
  const dist = new Map<string, number>([[start, 0]]);
  const queue: string[] = [start];
  let head = 0;
  while (head < queue.length) {
    const cur = queue[head++]!;
    const d = dist.get(cur)!;
    for (const nb of adj.get(cur) ?? []) {
      if (!dist.has(nb)) {
        dist.set(nb, d + 1);
        queue.push(nb);
      }
    }
  }
  return dist;
}

/**
 * Mean shortest-path length AND diameter over the largest connected component.
 * Both null when that component has fewer than two nodes.
 */
export function largestComponentPathStats(
  nodeIds: readonly string[],
  edges: readonly MetricEdge[],
): { averagePathLength: number | null; diameter: number | null; size: number } {
  const components = connectedComponents(nodeIds, edges);
  const largest = components[0] ?? [];
  if (largest.length < 2) return { averagePathLength: null, diameter: null, size: largest.length };
  const adj = buildAdjacency(largest, edges);
  let total = 0;
  let pairs = 0;
  let diameter = 0;
  for (const src of largest) {
    const dist = bfsDistances(src, adj);
    for (const node of largest) {
      if (node === src) continue;
      const d = dist.get(node);
      if (d === undefined) continue; // same component ⇒ reachable; guard anyway
      total += d;
      pairs += 1;
      if (d > diameter) diameter = d;
    }
  }
  return {
    averagePathLength: pairs === 0 ? null : total / pairs,
    diameter,
    size: largest.length,
  };
}

/**
 * Directed reciprocity: of all directed edges (ordered pairs that occurred),
 * the fraction whose reverse also occurred. 0..1; 0 when there are no directed
 * edges. A low reciprocity on a channel that SHOULD be a dialogue (e.g. bus
 * review-request ↔ reply) is a troubleshooting signal, not a health verdict.
 */
export function reciprocity(directedPairs: readonly { readonly from: string; readonly to: string }[]): number {
  const present = new Set<string>();
  for (const p of directedPairs) {
    if (p.from === p.to) continue;
    present.add(`${p.from}\u0000${p.to}`);
  }
  if (present.size === 0) return 0;
  let mutual = 0;
  for (const key of present) {
    const [from, to] = key.split("\u0000");
    if (present.has(`${to}\u0000${from}`)) mutual += 1;
  }
  return mutual / present.size;
}

/**
 * Heuristic small-world coefficient σ = (C/C_rand) / (L/L_rand), comparing the
 * graph's clustering and path length to an Erdős–Rényi random graph of the same
 * size and mean degree. σ > 1 is the classic small-world indicator. Returned as
 * a HINT (null when undefined — too few nodes, disconnected, or degenerate mean
 * degree); never a gate, matching the repo's "rho is not a gate" discipline.
 */
export function smallWorldSigma(metrics: SwarmTopologyMetrics): number | null {
  const { nodeCount, meanDegree, clusteringCoefficient: C, averagePathLength: L } = metrics;
  if (nodeCount < 3 || L === null || L <= 0 || meanDegree <= 1) return null;
  const cRand = meanDegree / (nodeCount - 1);
  const lRand = Math.log(nodeCount) / Math.log(meanDegree);
  if (cRand <= 0 || lRand <= 0 || C <= 0) return null;
  const gamma = C / cRand;
  const lambda = L / lRand;
  if (lambda <= 0) return null;
  return gamma / lambda;
}

/** Fold an edge list + node set into the full topology metric bundle. */
export function computeTopologyMetrics(
  nodeIds: readonly string[],
  edges: readonly MetricEdge[],
): SwarmTopologyMetrics {
  const n = nodeIds.length;
  const undirected = new Set<string>();
  let weightTotal = 0;
  for (const e of edges) {
    if (e.source === e.target) continue;
    undirected.add(undirectedKey(e.source, e.target));
    weightTotal += e.weight;
  }
  const edgeCount = undirected.size;
  const degrees = nodeDegrees(nodeIds, edges);
  const degreeValues = degrees.map((d) => d.degree);
  const meanDegree = n === 0 ? 0 : degreeValues.reduce((a, b) => a + b, 0) / n;
  const maxDegree = degreeValues.length === 0 ? 0 : Math.max(...degreeValues);
  const density = n < 2 ? 0 : (2 * edgeCount) / (n * (n - 1));
  const pathStats = largestComponentPathStats(nodeIds, edges);
  const components = connectedComponents(nodeIds, edges);
  return {
    nodeCount: n,
    edgeCount,
    density,
    meanDegree,
    maxDegree,
    meanEdgeWeight: edgeCount === 0 ? 0 : weightTotal / edgeCount,
    clusteringCoefficient: clusteringCoefficient(nodeIds, edges),
    averagePathLength: pathStats.averagePathLength,
    largestComponentDiameter: pathStats.diameter,
    componentCount: components.length,
    largestComponentSize: pathStats.size,
  };
}
