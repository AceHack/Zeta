/**
 * Gromov delta-hyperbolicity + degree-distribution measurement, with the null models that
 * make the numbers mean something (Lumen, 2026-08-20).
 *
 * ## Why this file exists
 *
 * The claim under test is: "our tower/hierarchy structure is hyperbolic, so a hyperbolic
 * (Poincare / hyperboloid) embedding is its natural home." That claim is CHECKABLE, and a
 * bare delta is not the check. Under `.claude/rules/numerology-vs-number-theory.md`, a small
 * measured delta identifies NOTHING on its own, because at least three unrelated structures
 * produce a small delta:
 *
 *   1. a genuinely tree-like / negatively-curved graph            (the hypothesis)
 *   2. ANY small-diameter graph -- delta <= diam/2 always, and a
 *      random graph has diam ~ log n / log(np)                    (Erdos-Renyi null)
 *   3. any graph with a dominant hub, where nearly all pairs are
 *      at distance <= 2 through it                                (configuration-model null)
 *
 * So every measurement here is reported against BOTH nulls at matched size, and the
 * degree-preserving null is the sharp one: if a graph's delta matches its own
 * degree-sequence-randomised twin, the hyperbolicity is fully explained by the degree
 * sequence and a hyperbolic embedding buys nothing that a degree model does not already give.
 *
 * ## The one-way inference (this is load-bearing, state it before reading any number)
 *
 * Exact delta_max is O(n^4). We SAMPLE quadruples, so the reported delta is a strict LOWER
 * BOUND on delta_max (Fournier, Ismail & Vigneron 2015 give the approximation-hardness
 * context; Cohen, Coudert & Lancin 2015 the practical exact algorithms). Therefore:
 *
 *   - a LARGE sampled delta CONVICTS: the graph is provably not delta'-hyperbolic for
 *     delta' < the witness found. This direction is sound.
 *   - a SMALL sampled delta NEVER ACQUITS: it is consistent with a large delta_max hiding in
 *     the unsampled quadruples.
 *
 * Same shape as `.claude/rules/dual-use-detection-is-neutral-oracle-decides.md`'s note that
 * one-way inference convicts but never acquits. Read every "small delta" below as "no witness
 * found at this sample size", never as "hyperbolic".
 *
 * ## Register
 *
 * The GRAPH ALGORITHMS here are standard and their implementations are pinned by tests against
 * structures with known closed-form answers (a tree is exactly 0-hyperbolic; the n x n grid has
 * delta growing like n). Those are `metered`. Any INTERPRETATION of a repo graph's delta as a
 * statement about Zeta's architecture is `toy` under
 * `.claude/rules/toy-is-free-metered-must-be-earned.md` and must say so at the point of use.
 *
 * ## Anchors (checked, not merely cited)
 *
 * - Gromov, "Hyperbolic groups", in Essays in Group Theory (1987) -- the four-point condition
 *   used verbatim in `quadrupleDelta` below.
 * - Krioukov, Papadopoulos, Kitsak, Vahdat & Boguna, "Hyperbolic geometry of complex networks",
 *   Phys. Rev. E 82, 036106 (2010) -- power-law degree and negative curvature as two faces of
 *   one latent geometry. This is precisely why the CONFIGURATION-MODEL null is the honest
 *   control and the ER null is not sufficient: under Krioukov the degree sequence is not a
 *   confound to be removed, it is the signature itself, so the interesting question is whether
 *   anything survives ABOVE it.
 * - Clauset, Shalizi & Newman, "Power-law distributions in empirical data", SIAM Review 51(4),
 *   661-703 (2009) -- MLE for alpha with x_min chosen by KS minimisation. Their thesis is this
 *   file's thesis one level down: a straight line on a log-log plot identifies nothing.
 * - Sarkar, "Low distortion Delaunay embedding of trees in hyperbolic plane", GD 2011 -- trees
 *   embed in H^2 with arbitrarily low distortion.
 * - Nickel & Kiela, "Poincare embeddings for learning hierarchical representations", NeurIPS
 *   2017 -- the applied form of Sarkar for real hierarchies.
 * - Maslov & Sneppen, Science 296 (2002) -- double-edge-swap randomisation preserving the
 *   degree sequence exactly, which is the `configurationNull` below.
 */

import { mix } from "../splitmix64/splitmix64.ts";

// ---------------------------------------------------------------------------------------------
// Deterministic PRNG. DST discipline: every sampled number below replays from the seed.
// ---------------------------------------------------------------------------------------------

/** A splitmix64 stream, reusing the repo's byte-locked `mix`. Deterministic by construction. */
export class Rng {
  private state: bigint;

  constructor(seed: bigint) {
    this.state = BigInt.asUintN(64, seed);
  }

  /** Next raw 64-bit value. */
  next(): bigint {
    this.state = BigInt.asUintN(64, this.state + 0x9e3779b97f4a7c15n);
    return mix(this.state);
  }

  /** Uniform integer in `[0, n)`. Rejection-free modulo is fine at our n (bias < 2^-40). */
  nextInt(n: number): number {
    if (n <= 0) throw new Error(`nextInt requires n > 0, got ${n}`);
    return Number(this.next() % BigInt(n));
  }

  /** Uniform float in `[0, 1)`, from the top 53 bits. */
  nextFloat(): number {
    return Number(this.next() >> 11n) / 2 ** 53;
  }
}

// ---------------------------------------------------------------------------------------------
// Graph
// ---------------------------------------------------------------------------------------------

/** An undirected simple graph on `0..n-1`, stored as sorted adjacency lists. */
export interface Graph {
  readonly n: number;
  readonly adj: readonly (readonly number[])[];
  /** Optional human-readable names, index-aligned with the node ids. */
  readonly labels?: readonly string[];
}

/**
 * Build an undirected simple graph from labelled edges. Self-loops and duplicates are dropped:
 * both are invisible to shortest-path distance, and leaving them in would inflate the degree
 * sequence that the configuration null is supposed to preserve.
 */
export function graphFromEdges(
  edges: readonly (readonly [string, string])[],
  extraNodes: readonly string[] = [],
): Graph {
  const index = new Map<string, number>();
  const labels: string[] = [];
  const idOf = (name: string): number => {
    const existing = index.get(name);
    if (existing !== undefined) return existing;
    const id = labels.length;
    index.set(name, id);
    labels.push(name);
    return id;
  };
  for (const name of extraNodes) idOf(name);
  const sets: Set<number>[] = [];
  const ensure = (id: number): Set<number> => {
    while (sets.length <= id) sets.push(new Set<number>());
    return sets[id]!;
  };
  for (const [a, b] of edges) {
    const u = idOf(a);
    const v = idOf(b);
    ensure(u);
    ensure(v);
    if (u === v) continue;
    sets[u]!.add(v);
    sets[v]!.add(u);
  }
  while (sets.length < labels.length) sets.push(new Set<number>());
  return {
    n: labels.length,
    adj: sets.map((s) => [...s].sort((x, y) => x - y)),
    labels,
  };
}

/** Number of undirected edges. */
export function edgeCount(g: Graph): number {
  let d = 0;
  for (const a of g.adj) d += a.length;
  return d / 2;
}

/** BFS single-source distances. Unreachable nodes get `-1`. */
export function bfs(g: Graph, source: number): Int32Array {
  const dist = new Int32Array(g.n).fill(-1);
  dist[source] = 0;
  const queue = new Int32Array(g.n);
  let head = 0;
  let tail = 0;
  queue[tail++] = source;
  while (head < tail) {
    const u = queue[head++]!;
    const du = dist[u]!;
    for (const v of g.adj[u]!) {
      if (dist[v] === -1) {
        dist[v] = du + 1;
        queue[tail++] = v;
      }
    }
  }
  return dist;
}

/** Connected components as arrays of node ids, largest first. */
export function components(g: Graph): number[][] {
  const seen = new Uint8Array(g.n);
  const out: number[][] = [];
  for (let s = 0; s < g.n; s++) {
    if (seen[s]) continue;
    const comp: number[] = [];
    const stack = [s];
    seen[s] = 1;
    while (stack.length > 0) {
      const u = stack.pop()!;
      comp.push(u);
      for (const v of g.adj[u]!) {
        if (!seen[v]) {
          seen[v] = 1;
          stack.push(v);
        }
      }
    }
    out.push(comp);
  }
  out.sort((a, b) => b.length - a.length);
  return out;
}

/** The induced subgraph on the largest connected component, relabelled to `0..k-1`. */
export function largestComponent(g: Graph): Graph {
  const comps = components(g);
  if (comps.length === 0) return { n: 0, adj: [], labels: [] };
  const keep = comps[0]!;
  const remap = new Int32Array(g.n).fill(-1);
  keep.forEach((u, i) => {
    remap[u] = i;
  });
  const adj = keep.map((u) =>
    g.adj[u]!.map((v) => remap[v]!)
      .filter((v) => v >= 0)
      .sort((a, b) => a - b),
  );
  // `exactOptionalPropertyTypes` is on: an optional property must be OMITTED, not set to
  // undefined. Spreading a conditional object is the form that satisfies it.
  return {
    n: keep.length,
    adj,
    ...(g.labels ? { labels: keep.map((u) => g.labels![u]!) } : {}),
  };
}

// ---------------------------------------------------------------------------------------------
// Gromov four-point delta
// ---------------------------------------------------------------------------------------------

/**
 * Gromov's four-point condition on one quadruple, verbatim (Gromov 1987).
 *
 * With the three pairings
 *   S1 = d(x,y) + d(z,w),  S2 = d(x,z) + d(y,w),  S3 = d(x,w) + d(y,z)
 * sorted to `L >= M >= S`, the quadruple's delta is `(L - M) / 2`.
 *
 * A geodesic space is delta-hyperbolic iff this is <= delta for every quadruple. Note the
 * SMALLEST of the three sums never enters -- a common transcription error, and the reason
 * the grid test below is a real falsifier rather than a tautology.
 */
export function quadrupleDelta(dxy: number, dzw: number, dxz: number, dyw: number, dxw: number, dyz: number): number {
  const s = [dxy + dzw, dxz + dyw, dxw + dyz].sort((a, b) => b - a);
  return (s[0]! - s[1]!) / 2;
}

export interface DeltaResult {
  /** Largest delta witnessed. A LOWER BOUND on delta_max -- see the header's one-way note. */
  readonly deltaMaxObserved: number;
  /** Mean delta over sampled quadruples with all six distances finite. */
  readonly deltaMean: number;
  /** Largest pairwise distance seen while sampling. A lower bound on the diameter. */
  readonly diameterObserved: number;
  /**
   * `2 * deltaMaxObserved / diameterObserved`. The scale-free comparator: delta itself has
   * units of graph distance, so comparing raw deltas across graphs of different diameter is a
   * dimensional error. 0 is a tree; 1 is as far from hyperbolic as a graph of that diameter
   * can be.
   */
  readonly deltaRelative: number;
  /** Quadruples that contributed (all four nodes mutually reachable and distinct). */
  readonly sampled: number;
  /** The witnessing quadruple for `deltaMaxObserved`, as node ids. */
  readonly witness: readonly [number, number, number, number] | null;
}

/**
 * Sample `samples` random quadruples from a pool of BFS sources and report delta statistics.
 *
 * All four nodes are drawn from the SAME pool, which is what makes all six pairwise distances
 * available: a quadruple needs `d(z,w)` too, so drawing z and w from outside the pool would
 * discard nearly every sample. The pool is drawn uniformly without replacement, so the estimator
 * is unbiased for the pool-induced subgraph metric -- and because distances are the AMBIENT
 * graph distances (BFS runs on the whole graph, not the induced subgraph), no shortcut through
 * a non-pool node is lost.
 *
 * Cost is `poolSize` BFS runs, i.e. O(poolSize * m), then O(samples) constant-time lookups.
 */
export function sampleDelta(g: Graph, samples: number, seed: bigint, sourcePool = 256): DeltaResult {
  const rng = new Rng(seed);
  if (g.n < 4) {
    return { deltaMaxObserved: 0, deltaMean: 0, diameterObserved: 0, deltaRelative: 0, sampled: 0, witness: null };
  }
  const poolSize = Math.min(sourcePool, g.n);
  const order = Array.from({ length: g.n }, (_, i) => i);
  for (let i = g.n - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [order[i], order[j]] = [order[j]!, order[i]!];
  }
  const sources = order.slice(0, poolSize);
  const rows = sources.map((s) => bfs(g, s));

  let deltaMax = 0;
  let deltaSum = 0;
  let counted = 0;
  let diameter = 0;
  let witness: [number, number, number, number] | null = null;

  for (let t = 0; t < samples; t++) {
    const i = rng.nextInt(poolSize);
    const j = rng.nextInt(poolSize);
    const k = rng.nextInt(poolSize);
    const l = rng.nextInt(poolSize);
    if (i === j || i === k || i === l || j === k || j === l || k === l) continue;
    const x = sources[i]!;
    const y = sources[j]!;
    const z = sources[k]!;
    const w = sources[l]!;
    const dxy = rows[i]![y]!;
    const dxz = rows[i]![z]!;
    const dxw = rows[i]![w]!;
    const dyz = rows[j]![z]!;
    const dyw = rows[j]![w]!;
    const dzw = rows[k]![w]!;
    if (dxy < 0 || dxz < 0 || dxw < 0 || dyz < 0 || dyw < 0 || dzw < 0) continue;
    const del = quadrupleDelta(dxy, dzw, dxz, dyw, dxw, dyz);
    deltaSum += del;
    counted++;
    diameter = Math.max(diameter, dxy, dxz, dxw, dyz, dyw, dzw);
    if (del > deltaMax) {
      deltaMax = del;
      witness = [x, y, z, w];
    }
  }
  return {
    deltaMaxObserved: deltaMax,
    deltaMean: counted > 0 ? deltaSum / counted : 0,
    diameterObserved: diameter,
    deltaRelative: diameter > 0 ? (2 * deltaMax) / diameter : 0,
    sampled: counted,
    witness,
  };
}

// ---------------------------------------------------------------------------------------------
// Null models -- the part that makes a delta mean something
// ---------------------------------------------------------------------------------------------

/** Erdos-Renyi G(n, m): same node and edge count, no other structure preserved. */
export function erdosRenyiNull(n: number, m: number, seed: bigint): Graph {
  const rng = new Rng(seed);
  const seen = new Set<number>();
  const edges: [string, string][] = [];
  let guard = 0;
  while (edges.length < m && guard < m * 200) {
    guard++;
    const u = rng.nextInt(n);
    const v = rng.nextInt(n);
    if (u === v) continue;
    const key = u < v ? u * n + v : v * n + u;
    if (seen.has(key)) continue;
    seen.add(key);
    edges.push([`${u}`, `${v}`]);
  }
  return graphFromEdges(
    edges,
    Array.from({ length: n }, (_, i) => `${i}`),
  );
}

/**
 * Degree-preserving randomisation by double-edge swaps (Maslov & Sneppen 2002).
 *
 * This is the sharp null: it holds the degree sequence EXACTLY and destroys everything else.
 * If a repo graph's delta matches this twin, then whatever hyperbolicity it has is a function
 * of its degree sequence alone -- which under Krioukov et al. (2010) is expected, and which
 * means a hyperbolic embedding adds no information a degree model does not already carry.
 */
export function configurationNull(g: Graph, seed: bigint, swapsPerEdge = 20): Graph {
  const rng = new Rng(seed);
  const edges: [number, number][] = [];
  for (let u = 0; u < g.n; u++) for (const v of g.adj[u]!) if (u < v) edges.push([u, v]);
  const present = new Set<number>();
  const key = (a: number, b: number): number => (a < b ? a * g.n + b : b * g.n + a);
  for (const [a, b] of edges) present.add(key(a, b));

  const target = edges.length * swapsPerEdge;
  for (let t = 0; t < target; t++) {
    const i = rng.nextInt(edges.length);
    const j = rng.nextInt(edges.length);
    if (i === j) continue;
    const [a, b] = edges[i]!;
    const [c, d] = edges[j]!;
    if (a === c || a === d || b === c || b === d) continue;
    // swap to (a,d) and (c,b); reject if it would create a duplicate
    if (present.has(key(a, d)) || present.has(key(c, b))) continue;
    present.delete(key(a, b));
    present.delete(key(c, d));
    present.add(key(a, d));
    present.add(key(c, b));
    edges[i] = [a, d];
    edges[j] = [c, b];
  }
  return graphFromEdges(
    edges.map(([a, b]) => [`${a}`, `${b}`] as [string, string]),
    Array.from({ length: g.n }, (_, i) => `${i}`),
  );
}

/** Calibration anchor: a balanced tree of the given branching factor and depth. Exactly 0-hyperbolic. */
export function balancedTree(branching: number, depth: number): Graph {
  const edges: [string, string][] = [];
  let frontier = ["r"];
  for (let d = 0; d < depth; d++) {
    const next: string[] = [];
    for (const p of frontier) {
      for (let b = 0; b < branching; b++) {
        const child = `${p}.${b}`;
        edges.push([p, child]);
        next.push(child);
      }
    }
    frontier = next;
  }
  return graphFromEdges(edges, ["r"]);
}

/** Calibration anchor: the `k x k` grid. delta grows linearly in k -- the NOT-hyperbolic anchor. */
export function grid(k: number): Graph {
  const edges: [string, string][] = [];
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      if (i + 1 < k) edges.push([`${i},${j}`, `${i + 1},${j}`]);
      if (j + 1 < k) edges.push([`${i},${j}`, `${i},${j + 1}`]);
    }
  }
  return graphFromEdges(edges);
}

/** Calibration anchor: the cycle `C_k`. delta ~ k/4 -- flat, the other not-hyperbolic anchor. */
export function cycle(k: number): Graph {
  const edges: [string, string][] = [];
  for (let i = 0; i < k; i++) edges.push([`${i}`, `${(i + 1) % k}`]);
  return graphFromEdges(edges);
}

// ---------------------------------------------------------------------------------------------
// Degree distribution -- Clauset-Shalizi-Newman
// ---------------------------------------------------------------------------------------------

/** Upper end of the alpha search grid. A fit landing here is reported as `diverged`. */
export const ALPHA_MAX = 6.0;

export interface PowerLawFit {
  /** MLE exponent alpha for the discrete tail above `xMin`. */
  readonly alpha: number;
  /** Lower cutoff chosen by KS minimisation. */
  readonly xMin: number;
  /** KS distance between the empirical tail and the fitted power law. */
  readonly ks: number;
  /** Number of observations in the fitted tail. */
  readonly nTail: number;
  /** Standard error on alpha, `(alpha - 1) / sqrt(nTail)` (CSN eq. 3.2, continuous form). */
  readonly alphaStdErr: number;
  /**
   * True when the MLE ran to the top of the search grid, meaning the likelihood is still
   * increasing at `ALPHA_MAX` and no interior maximum exists. Such a "fit" must not be read as
   * a power-law exponent -- it is the fitter reporting that the tail is not power-law shaped.
   */
  readonly diverged: boolean;
}

/** Hurwitz zeta `sum_{k>=x} k^-a`, truncated with an Euler-Maclaurin tail. */
function hurwitzZeta(a: number, x: number, terms = 4000): number {
  let s = 0;
  let k = x;
  for (; k < x + terms; k++) s += k ** -a;
  // integral tail + half the boundary term
  s += k ** (1 - a) / (a - 1) - 0.5 * k ** -a;
  return s;
}

/**
 * CSN discrete power-law fit: for each candidate `xMin`, take the MLE alpha by direct
 * likelihood maximisation over a grid, then keep the `xMin` with the smallest KS distance.
 *
 * The point of returning `ks` alongside `alpha` is exactly CSN's thesis: an alpha with a large
 * KS distance is a fitted line through data that is not a power law. Reporting alpha alone
 * would be the numerology failure this whole file exists to avoid.
 */
export function fitPowerLaw(data: readonly number[]): PowerLawFit | null {
  const xs = data.filter((x) => x >= 1).sort((a, b) => a - b);
  if (xs.length < 20) return null;
  const candidates = [...new Set(xs)].filter((x) => x >= 1);
  let best: PowerLawFit | null = null;
  for (const xMin of candidates) {
    const tail = xs.filter((x) => x >= xMin);
    if (tail.length < 15) continue;
    // A tail with fewer than three distinct values has no power law to fit: the MLE diverges
    // (alpha -> infinity concentrates all mass on xMin, and the KS distance goes to 0, so the
    // fit LOOKS perfect). That is the vacuity class -- a fit that cannot fail. Refuse it.
    if (new Set(tail).size < 3) continue;
    // MLE over a grid, refined -- the discrete MLE has no closed form (CSN section 3.3).
    let bestAlpha = 2;
    let bestLL = -Infinity;
    const logSum = tail.reduce((acc, x) => acc + Math.log(x), 0);
    const evalLL = (a: number): number => -tail.length * Math.log(hurwitzZeta(a, xMin)) - a * logSum;
    for (let a = 1.05; a <= ALPHA_MAX; a += 0.01) {
      const ll = evalLL(a);
      if (ll > bestLL) {
        bestLL = ll;
        bestAlpha = a;
      }
    }
    // The refinement bound is CAPTURED before the loop. Reading `bestAlpha` in the loop
    // condition while the body assigns to it is a runaway: on a degenerate tail the likelihood
    // increases monotonically in alpha, so the bound advances every iteration and the loop only
    // stops at float saturation (observed: alpha = 112.25 on the balanced-tree anchor, from a
    // grid that caps at 6.0). Pinned by a regression test.
    const centre = bestAlpha;
    for (let a = centre - 0.01; a <= centre + 0.01; a += 0.0005) {
      const ll = evalLL(a);
      if (ll > bestLL) {
        bestLL = ll;
        bestAlpha = a;
      }
    }
    // KS distance
    const z = hurwitzZeta(bestAlpha, xMin);
    let ks = 0;
    let cum = 0;
    const uniq = [...new Set(tail)].sort((a, b) => a - b);
    let idx = 0;
    for (const v of uniq) {
      while (idx < tail.length && tail[idx]! <= v) idx++;
      const empirical = idx / tail.length;
      cum += v ** -bestAlpha / z;
      // model CDF at v = 1 - P(X > v); accumulate pmf from xMin
      ks = Math.max(ks, Math.abs(empirical - cum));
    }
    if (best === null || ks < best.ks) {
      best = {
        alpha: bestAlpha,
        xMin,
        ks,
        nTail: tail.length,
        alphaStdErr: (bestAlpha - 1) / Math.sqrt(tail.length),
        diverged: bestAlpha >= ALPHA_MAX - 0.02,
      };
    }
  }
  return best;
}

/** Degree sequence of a graph. */
export function degrees(g: Graph): number[] {
  return g.adj.map((a) => a.length);
}

// ---------------------------------------------------------------------------------------------
// Articulation points -- the EXACT answer to "routable-around vs must-route-through"
// ---------------------------------------------------------------------------------------------

/**
 * Articulation points (cut vertices) by Hopcroft & Tarjan's DFS lowpoint method, iterative.
 *
 * ## Why this lives in a file about hyperbolic geometry
 *
 * `.claude/rules/itron-hub-patent-boundary-p2p-is-the-upgrade.md` states the oracle/hub
 * discriminator as EXIT: "Can you defer elsewhere? Then it is an oracle... Must you route
 * through it? Then it is a hub." That is not a metric question and it does not need a curved
 * space to answer. It is exactly vertex connectivity:
 *
 *   - **Menger (1927):** the maximum number of internally vertex-disjoint s-t paths equals the
 *     minimum s-t vertex cut. "Routable-around" is literally "at least two disjoint paths".
 *   - A vertex `v` is a **hub in the strict sense** for some pair iff removing `v` disconnects
 *     that pair -- i.e. iff `v` is an articulation point.
 *   - Everything else, however high its degree, is an **oracle**: deference you can route
 *     around, hence deference you chose.
 *
 * So the rule's own discriminator has a classical, exact, linear-time answer. A hyperbolic
 * embedding would give an approximate one. Reaching for geometry here would be strictly worse,
 * which is why this function is the constructive half of the hyperbolicity result.
 *
 * Anchors: Menger, "Zur allgemeinen Kurventheorie", Fund. Math. 10 (1927), 96-115;
 * Hopcroft & Tarjan, "Algorithm 447: efficient algorithms for graph manipulation",
 * CACM 16(6) (1973), 372-378.
 *
 * Iterative rather than recursive on purpose: the commit DAG has depth ~13k and a recursive DFS
 * blows the stack there. A measurement that crashes on the largest real graph is not a measurement.
 */
export function articulationPoints(g: Graph): number[] {
  const disc = new Int32Array(g.n).fill(-1);
  const low = new Int32Array(g.n).fill(0);
  const parent = new Int32Array(g.n).fill(-1);
  const isCut = new Uint8Array(g.n);
  let timer = 0;

  for (let s = 0; s < g.n; s++) {
    if (disc[s] !== -1) continue;
    let rootChildren = 0;
    // stack frames: [node, index into its adjacency list]
    const stack: number[][] = [[s, 0]];
    disc[s] = low[s] = timer++;
    while (stack.length > 0) {
      const frame = stack[stack.length - 1]!;
      const u = frame[0]!;
      if (frame[1]! < g.adj[u]!.length) {
        const v = g.adj[u]![frame[1]!]!;
        frame[1]!++;
        if (disc[v] === -1) {
          parent[v] = u;
          disc[v] = low[v] = timer++;
          if (u === s) rootChildren++;
          stack.push([v, 0]);
        } else if (v !== parent[u]) {
          low[u] = Math.min(low[u]!, disc[v]!);
        }
      } else {
        stack.pop();
        const p = parent[u]!;
        if (p !== -1) {
          low[p] = Math.min(low[p]!, low[u]!);
          // Non-root p is a cut vertex if some child cannot reach above p.
          if (p !== s && low[u]! >= disc[p]!) isCut[p] = 1;
        }
      }
    }
    // The root is a cut vertex iff it has more than one DFS child.
    if (rootChildren > 1) isCut[s] = 1;
  }
  const out: number[] = [];
  for (let i = 0; i < g.n; i++) if (isCut[i]) out.push(i);
  return out;
}
