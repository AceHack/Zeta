/**
 * Falsifier for "the substrate's causal order is Lorentzian geometry"
 * (docs/research/2026-08-20-clifford-signature-audit-cl13-vs-cl31-is-inert-*.md, sections 7.3 / 9).
 *
 * ## The theorem this module tests against
 *
 * In 1+1 Minkowski space use light-cone coordinates u = t + x, v = t - x. Then
 *
 *     p <= q   iff   u_p <= u_q  AND  v_p <= v_q
 *
 * which is exactly a two-element REALIZER of the order. So a finite poset embeds in the causal
 * order of 1+1 Minkowski space if and only if its ORDER DIMENSION is at most 2 (Dushnik-Miller
 * 1941 for the dimension notion). The converse direction is equally two lines: given a realizer
 * L1, L2, set u and v to the ranks and read off t = (u+v)/2, x = (u-v)/2.
 *
 * That turns a geometric question into a combinatorial one that can be decided by exhaustion on
 * small posets -- no metric, no signature, no numerics.
 *
 * ## What is falsified
 *
 * A perfectly ordinary six-process message pattern under standard vector-clock semantics
 * (Lamport 1978; Mattern 1988; Fidge 1988) realizes the standard example S_3, whose order
 * dimension is 3. Therefore the happens-before order of a reachable configuration does NOT embed
 * in 1+1 Minkowski, and no O(1,1) boost can act on it as a causal symmetry.
 *
 * The result does NOT generalize upward: S_3 does embed in 2+1 Minkowski, and
 * `embedsInMinkowski2Plus1` exhibits the embedding. Both halves are kept so the negative is not
 * over-read.
 *
 * Register (.claude/rules/toy-is-free-metered-must-be-earned.md): METERED. Every claim here has a
 * falsifier in the paired .test.ts, and the exhaustive search cannot pass vacuously -- it either
 * produces a witness pair of linear extensions or proves none exists.
 */

/** A vector clock: one non-negative counter per process. */
export type VectorClock = readonly number[];

const at = (c: VectorClock, i: number): number => c[i] ?? 0;

/** Componentwise <=. */
export function clockLeq(a: VectorClock, b: VectorClock): boolean {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) if (at(a, i) > at(b, i)) return false;
  return true;
}

/** Lamport happens-before: strictly less in the componentwise order. */
export function happensBefore(earlier: VectorClock, later: VectorClock): boolean {
  if (!clockLeq(earlier, later)) return false;
  return !clockLeq(later, earlier);
}

/** Local event on process `p`: increment own slot. */
export function tick(c: VectorClock, p: number): VectorClock {
  const d = [...c];
  while (d.length <= p) d.push(0);
  d[p] = (d[p] ?? 0) + 1;
  return d;
}

/** Receive `msgs` at process `p`: componentwise max, then a local tick. */
export function receive(local: VectorClock, msgs: readonly VectorClock[], p: number): VectorClock {
  const n = Math.max(local.length, p + 1, ...msgs.map((m) => m.length));
  const d: number[] = [];
  for (let i = 0; i < n; i++) {
    let x = at(local, i);
    for (const m of msgs) x = Math.max(x, at(m, i));
    d.push(x);
  }
  return tick(d, p);
}

/**
 * A reachable six-process configuration realizing the standard example S_3:
 * a_i on process i, and b_j on process 3+j having received from both a_i with i != j.
 * Returned in the order [a0, a1, a2, b0, b1, b2].
 */
export function standardExampleS3Clocks(): VectorClock[] {
  const width = 6;
  const zero: VectorClock = Array.from({ length: width }, () => 0);
  const a = [0, 1, 2].map((i) => tick(zero, i));
  const b = [0, 1, 2].map((j) => {
    const from = [0, 1, 2].filter((i) => i !== j).map((i) => a[i] ?? zero);
    return receive(zero, from, 3 + j);
  });
  return [...a, ...b];
}

/** Strict-order relation matrix induced by happens-before. */
export function strictOrderMatrix(clocks: readonly VectorClock[]): boolean[][] {
  return clocks.map((x) => clocks.map((y) => happensBefore(x, y)));
}

/** Is `rel` exactly S_n: elements 0..n-1 below elements n..2n-1, with a_i < b_j iff i != j? */
export function isStandardExample(rel: readonly (readonly boolean[])[], n: number): boolean {
  if (rel.length !== 2 * n) return false;
  for (let i = 0; i < 2 * n; i++) {
    const row = rel[i];
    if (row?.length !== 2 * n) return false;
    for (let j = 0; j < 2 * n; j++) {
      const want = i < n && j >= n && i !== j - n;
      if ((row[j] ?? false) !== want) return false;
    }
  }
  return true;
}

/** All linear extensions of the strict order `rel`, as arrays of element indices. */
export function linearExtensions(rel: readonly (readonly boolean[])[]): number[][] {
  const n = rel.length;
  const out: number[][] = [];
  const strictlyBelow = (lower: number, upper: number): boolean => rel[lower]?.[upper] ?? false;
  // An element is placeable only once every element below it is already placed.
  const placeable = (candidate: number, left: readonly number[]): boolean =>
    !left.some((other) => other !== candidate && strictlyBelow(other, candidate));
  const walk = (cur: number[], left: readonly number[]): void => {
    if (left.length === 0) {
      out.push([...cur]);
      return;
    }
    for (const x of left) {
      if (!placeable(x, left)) continue;
      walk(
        [...cur, x],
        left.filter((y) => y !== x),
      );
    }
  };
  walk(
    [],
    Array.from({ length: n }, (_, i) => i),
  );
  return out;
}

/**
 * Exhaustive decision: is the order dimension of `rel` at most 2 -- equivalently, does it embed
 * in the causal order of 1+1 Minkowski space? Returns the witnessing pair of linear extensions
 * when it does, and `null` when it provably does not.
 *
 * Exponential in |rel|; intended for the small hand-built posets this module reasons about.
 */
/**
 * Does the intersection of the two linear orders given by rank vectors `rs`, `rt` reproduce
 * `rel` exactly? This is the definition of `{rs, rt}` being a realizer.
 */
function intersectionEqualsOrder(
  rel: readonly (readonly boolean[])[],
  rs: readonly number[],
  rt: readonly number[],
): boolean {
  const n = rel.length;
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const both = (rs[i] ?? 0) < (rs[j] ?? 0) && (rt[i] ?? 0) < (rt[j] ?? 0);
      if (both !== (rel[i]?.[j] ?? false)) return false;
    }
  }
  return true;
}

export function twoDimensionalRealizer(rel: readonly (readonly boolean[])[]): [number[], number[]] | null {
  const n = rel.length;
  const exts = linearExtensions(rel);
  const ranks = exts.map((ext) => {
    const r: number[] = Array.from({ length: n }, () => 0);
    ext.forEach((e, k) => {
      r[e] = k;
    });
    return r;
  });
  for (let s = 0; s < ranks.length; s++) {
    for (let t = s; t < ranks.length; t++) {
      const rs = ranks[s];
      const rt = ranks[t];
      const es = exts[s];
      const et = exts[t];
      if (rs === undefined || rt === undefined || es === undefined || et === undefined) continue;
      if (intersectionEqualsOrder(rel, rs, rt)) return [es, et];
    }
  }
  return null;
}

/** Equivalent to `twoDimensionalRealizer(rel) !== null`, named for what it means geometrically. */
export function embedsInMinkowski1Plus1(rel: readonly (readonly boolean[])[]): boolean {
  return twoDimensionalRealizer(rel) !== null;
}

/**
 * Explicit 2+1 Minkowski embedding of S_3, showing the 1+1 negative does not generalize upward:
 * a_i at the vertices of a unit equilateral triangle at t = 0, b_j at the midpoint of the
 * opposite edge at t = lapse. Causal iff spatial distance <= lapse.
 */
export function embedsInMinkowski2Plus1(lapse = 0.6): boolean {
  const h = (Math.sqrt(3) / 2) * 1;
  const A: readonly (readonly [number, number])[] = [
    [0, 0],
    [1, 0],
    [0.5, h],
  ];
  const mid = (p: readonly [number, number], q: readonly [number, number]): [number, number] => [
    (p[0] + q[0]) / 2,
    (p[1] + q[1]) / 2,
  ];
  const B = [0, 1, 2].map((j) => {
    const others = [0, 1, 2].filter((i) => i !== j);
    const p = A[others[0] ?? 0] ?? ([0, 0] as const);
    const q = A[others[1] ?? 0] ?? ([0, 0] as const);
    return mid(p, q);
  });
  for (let i = 0; i < 3; i++) {
    for (let j = 0; j < 3; j++) {
      const a = A[i] ?? ([0, 0] as const);
      const b = B[j] ?? ([0, 0] as const);
      const causal = Math.hypot(a[0] - b[0], a[1] - b[1]) <= lapse;
      if (causal !== (i !== j)) return false;
    }
  }
  return true;
}

/**
 * Concurrency width of a causal set given as (element, parents) pairs in any order:
 * elements / longest-chain. This is 1 / z, where z is the order-intrinsic lapse of section 8 --
 * the metric-free form of "phase time slowing inside heavy consensus". Both quantities are pure
 * order invariants; neither needs a signature.
 *
 * Width 1 means a chain: no spacelike pairs at all, hence nothing for a light cone to say.
 */
interface CausalNode {
  id: string;
  parents: readonly string[];
}

/** Kahn topological order over the sub-DAG induced by the given nodes. */
function topologicalOrder(nodes: readonly CausalNode[], known: ReadonlySet<string>): string[] {
  const indegree = new Map<string, number>();
  const children = new Map<string, string[]>();
  for (const n of nodes) {
    indegree.set(n.id, n.parents.filter((p) => known.has(p)).length);
    for (const p of n.parents) {
      if (known.has(p)) children.set(p, [...(children.get(p) ?? []), n.id]);
    }
  }
  const queue = nodes.filter((n) => (indegree.get(n.id) ?? 0) === 0).map((n) => n.id);
  // The array iterator re-reads `length` each step, so elements appended below are visited.
  for (const id of queue) {
    for (const c of children.get(id) ?? []) {
      const remaining = (indegree.get(c) ?? 0) - 1;
      indegree.set(c, remaining);
      if (remaining === 0) queue.push(c);
    }
  }
  return queue;
}

/**
 * Concurrency width of a causal set given as (element, parents) pairs in any order:
 * elements / longest-chain. This is 1 / z, where z is the order-intrinsic lapse of section 8 --
 * the metric-free form of "phase time slowing inside heavy consensus". Both quantities are pure
 * order invariants; neither needs a signature.
 *
 * Width 1 means a chain: no spacelike pairs at all, hence nothing for a light cone to say.
 */
export function concurrencyWidth(nodes: readonly CausalNode[]): {
  elements: number;
  longestChain: number;
  width: number;
} {
  const known = new Set(nodes.map((n) => n.id));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const depth = new Map<string, number>();
  for (const id of topologicalOrder(nodes, known)) {
    let d = 0;
    for (const p of byId.get(id)?.parents ?? []) {
      if (known.has(p)) d = Math.max(d, (depth.get(p) ?? 0) + 1);
    }
    depth.set(id, d);
  }
  const ds = [...depth.values()];
  const longestChain = ds.length === 0 ? 0 : Math.max(...ds) - Math.min(...ds);
  return {
    elements: nodes.length,
    longestChain,
    width: longestChain === 0 ? nodes.length : nodes.length / longestChain,
  };
}
