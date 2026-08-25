// **Rank 16 — the discriminating test the rank-8 agreement could not be.**
//
// The executable half of
// `docs/research/2026-08-25-rank-16-is-where-the-e8-routes-disagree-*.md`.
//
// ── WHY THIS MODULE EXISTS ──────────────────────────────────────────────────────────────────
// Four in-tree routes reach E8 and agree. That agreement carries **zero** evidential weight,
// because there is exactly ONE even unimodular positive-definite lattice of rank 8 (Mordell
// 1938; Witt). Every route that lands anywhere in that family lands on the same point. The
// routes agree by a theorem about the TARGET, not by a shared mechanism.
//
// Rank 16 is the first place the target is not unique: there are exactly TWO even unimodular
// lattices (E8+E8 and D16+) and exactly TWO doubly-even self-dual ("Type II") binary codes of
// length 16. So at rank 16 the routes CAN disagree, and whether they do is information.
//
// ── WHAT IS COMPUTED, AND WHAT EACH COMPUTATION COULD HAVE SAID INSTEAD ─────────────────────
//   * `typeIIClassCount16` — the classification, by MASS FORMULA against computed |Aut| values.
//     Could have come out 1, or 3, or failed to balance.
//   * `thetaSeries` — pointed at both rank-16 lattices. Could have separated them. It does NOT:
//     the two series are identical (Milnor's isospectral pair). So the in-tree
//     `ConstructionATheta.fs` route has no discriminating power at rank 16 — and therefore
//     never had any at rank 8 either; there it identified E8 only by *invoking* Mordell.
//   * `rootSystemComponents` — the invariant that DOES separate them. Both lattices have 480
//     minimal vectors; a matching count is not an identification (`numerology-vs-number-theory`).
//     The excluding invariant is connectivity: 2 components of rank 8, versus 1 of rank 16.
//   * `findSimpleSystem` + `versorClosure` — the Clifford/versor route (`CliffordE8Roots.fs`)
//     re-run at rank 16. The route takes a Cartan matrix as INPUT. Feed it E8+E8 and it returns
//     E8+E8; feed it D16 and it returns D16. It selects nothing.
//   * `doubledModuleChain` — the Cayley-Dickson doubling's actual lattice-level shadow. The CD
//     norm form is N(a,b) = N(a) + N(b), i.e. an ORTHOGONAL DIRECT SUM, so the doubled module is
//     L _|_ L. Its kissing number is exactly 2x the previous at every rung. The claimed chain
//     A2 -> D4 -> E8 goes 6 -> 24 -> 240. It is not a doubling.
//
// ── SCOPE, so nothing is rounded up ─────────────────────────────────────────────────────────
// This module counts and compares. It proves no theorem by itself; it supplies the computed
// PREMISES for the short structural arguments in the research document, each of which is
// written out there with its own citation.
//
// Anchors (Beacon): L. J. Mordell (1938) and E. Witt — uniqueness of E8 at rank 8.
// J. H. Conway & N. J. A. Sloane, *Sphere Packings, Lattices and Groups* (Construction A ch. 5;
// even unimodular lattices of rank 16 ch. 4 s.11; Barnes-Wall ch. 4 s.10; mass formulae ch. 19).
// V. Pless (1972), *A classification of self-orthogonal codes over GF(2)*. A. M. Gleason (1971)
// — the weight enumerator of a Type II code is forced. J. Milnor (1964) — E8+E8 and D16+ are the
// isospectral non-isometric pair. E. S. Barnes & G. E. Wall (1959). P.-P. Dechant (2016, 2017) —
// the Clifford versor route this module re-runs. A. B. Zamolodchikov (1989) — the E8 mass
// spectrum, used here only as an external anchor on the Perron-Frobenius computation.

const POP = new Uint8Array(1 << 16);
for (let i = 1; i < 1 << 16; i++) POP[i] = POP[i >> 1]! + (i & 1);

/** Population count of a 16-bit codeword mask. */
export const weight = (v: number): number => POP[v]!;

/** All codewords of the GF(2)-span of `basis`, as bitmasks (bit `i` = coordinate `i`). */
export function spanBits(basis: number[]): number[] {
  let out = [0];
  for (const g of basis) out = out.concat(out.map((c) => c ^ g));
  return out;
}

/** GF(2) rank of a set of bitmasks. */
export function gfRank(vs: number[]): number {
  const b: number[] = [];
  for (const v0 of vs) {
    let v = v0;
    for (const x of b) {
      const h = 31 - Math.clz32(x);
      if ((v >> h) & 1) v ^= x;
    }
    if (v) {
      b.push(v);
      b.sort((p, q) => q - p);
    }
  }
  return b.length;
}

export interface CodeFacts {
  size: number;
  dimension: number;
  doublyEven: boolean;
  selfOrthogonal: boolean;
  selfDual: boolean;
  /** Codeword counts by Hamming weight, index = weight. */
  weightEnumerator: number[];
  /** Number of weight-4 codewords ("tetrads"). */
  tetradCount: number;
  /** GF(2) dimension of the span of the tetrads — a code-level invariant separating the two. */
  tetradSpanDimension: number;
  /** Connected components of the graph on coordinates joined by shared tetrads. */
  tetradComponents: number[];
}

/** Everything about a binary code that this module needs, all of it computed. */
export function codeFacts(basis: number[], n: number): CodeFacts {
  const words = spanBits(basis);
  const weightEnumerator = new Array(n + 1).fill(0);
  for (const w of words) weightEnumerator[POP[w]!]++;
  const doublyEven = words.every((w) => POP[w]! % 4 === 0);
  const selfOrthogonal = words.every((a) => words.every((b) => (POP[a & b]! & 1) === 0));
  const tet = words.filter((w) => POP[w] === 4);
  const par = [...Array(n).keys()];
  const find = (x: number): number => (par[x] === x ? x : (par[x] = find(par[x]!)));
  for (const t of tet) {
    const pts = [...Array(n).keys()].filter((i) => (t >> i) & 1);
    for (const p of pts.slice(1)) par[find(p)] = find(pts[0]!);
  }
  const comp = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    comp.set(r, (comp.get(r) ?? 0) + 1);
  }
  return {
    size: words.length,
    dimension: Math.log2(words.length),
    doublyEven,
    selfOrthogonal,
    selfDual: selfOrthogonal && words.length === 1 << (n / 2),
    weightEnumerator,
    tetradCount: tet.length,
    tetradSpanDimension: gfRank(tet),
    tetradComponents: [...comp.values()].sort((a, b) => b - a),
  };
}

// ── THE THREE CODES ─────────────────────────────────────────────────────────────────────────

/**
 * The `[8,4]` extended Hamming code — `AdinkraCode.generator`, transcribed to bitmasks.
 * The unique Type II code of length 8 (this module's `n = 8` run recomputes that uniqueness).
 */
export const E8_CODE: number[] = [
  [1, 0, 0, 0, 0, 1, 1, 1],
  [0, 1, 0, 0, 1, 0, 1, 1],
  [0, 0, 1, 0, 1, 1, 0, 1],
  [0, 0, 0, 1, 1, 1, 1, 0],
].map((r) => r.reduce((a, b, i) => a | (b << i), 0));

/** `e8 (+) e8` — the two extended Hamming codes on disjoint halves. The DECOMPOSABLE Type II code. */
export const CODE_E8_PLUS_E8: number[] = [...E8_CODE, ...E8_CODE.map((g) => g << 8)];

/**
 * `d16+` — the INDECOMPOSABLE Type II code of length 16, by an explicit canonical construction
 * rather than a magic constant: **seven overlapping "domino" tetrads `{2i, 2i+1, 2i+2, 2i+3}`
 * for `i = 0..6`, glued by the alternating weight-8 vector `(10)^8`.**
 *
 * Nothing here is asserted. `codeFacts` checks that this is doubly-even and self-dual, and the
 * pair (tetrad span dimension 7, tetrad graph connected) separates it from `CODE_E8_PLUS_E8`
 * (span dimension 8, two components) — which, given that there are exactly two classes, is a
 * complete identification.
 */
export const CODE_D16_PLUS: number[] = [
  ...Array.from({ length: 7 }, (_, i) => (0b1111 << (2 * i)) & 0xffff),
  0b1010101010101010,
];

// ── CONSTRUCTION A ──────────────────────────────────────────────────────────────────────────

/**
 * Minimal vectors of `L_A(C) = { x in Z^n : x mod 2 in C }` for a Type II code C: the vectors of
 * squared length 4. Exactly `2n + 16 * A_4` of them — `+-2 e_i` from the zero codeword, and the
 * `2^4` sign patterns on the support of each weight-4 codeword. Integer arithmetic throughout.
 */
export function constructionAMinimalVectors(basis: number[], n: number): number[][] {
  const out: number[][] = [];
  for (let i = 0; i < n; i++)
    for (const s of [2, -2]) {
      const v = new Array(n).fill(0);
      v[i] = s;
      out.push(v);
    }
  for (const w of spanBits(basis)) {
    if (POP[w] !== 4) continue;
    const sup: number[] = [];
    for (let i = 0; i < n; i++) if ((w >> i) & 1) sup.push(i);
    for (let m = 0; m < 16; m++) {
      const v = new Array(n).fill(0);
      sup.forEach((p, k) => {
        v[p] = (m >> k) & 1 ? -1 : 1;
      });
      out.push(v);
    }
  }
  return out;
}

/** Standard integer inner product. */
export const dot = (a: number[], b: number[]): number => a.reduce((s, x, i) => s + x * b[i]!, 0);

/** Rank over Q of a set of integer vectors (Gaussian elimination in floating point, exact inputs). */
export function realRank(vs: number[][], n: number): number {
  const m = vs.map((v) => v.map(Number));
  let r = 0;
  for (let c = 0; c < n && r < m.length; c++) {
    let p = -1;
    for (let i = r; i < m.length; i++)
      if (Math.abs(m[i]![c]!) > 1e-9) {
        p = i;
        break;
      }
    if (p < 0) continue;
    const swap = m[r]!;
    m[r] = m[p]!;
    m[p] = swap;
    for (let i = 0; i < m.length; i++)
      if (i !== r && Math.abs(m[i]![c]!) > 1e-9) {
        const f = m[i]![c]! / m[r]![c]!;
        for (let j = 0; j < n; j++) m[i]![j]! -= f * m[r]![j]!;
      }
    r++;
  }
  return r;
}

/**
 * **The invariant that separates the two rank-16 lattices.** Decompose the minimal vectors into
 * connected components under "non-orthogonal", and report each component's size and rank.
 *
 * Both lattices have 480 minimal vectors, so the COUNT identifies nothing. Connectivity does:
 * `E8+E8` gives `[{480/2 = 240, rank 8}, {240, rank 8}]`; `D16+` gives `[{480, rank 16}]`.
 */
export function rootSystemComponents(roots: number[][], n: number): { size: number; rank: number }[] {
  const N = roots.length;
  const par = [...Array(N).keys()];
  const find = (x: number): number => (par[x] === x ? x : (par[x] = find(par[x]!)));
  for (let i = 0; i < N; i++)
    for (let j = i + 1; j < N; j++) if (dot(roots[i]!, roots[j]!) !== 0) par[find(i)] = find(j);
  const comp = new Map<number, number[][]>();
  for (let i = 0; i < N; i++) {
    const r = find(i);
    comp.set(r, [...(comp.get(r) ?? []), roots[i]!]);
  }
  return [...comp.values()]
    .map((c) => ({ size: c.length, rank: realRank(c, n) }))
    .sort((a, b) => b.size - a.size || b.rank - a.rank);
}

/**
 * Theta series of a Construction-A lattice by convolution — the same algorithm as Route C of
 * `ConstructionATheta.fs`, generalised to any length. Exact `bigint` counts indexed by squared
 * length. Pointed at the two rank-16 lattices it returns the SAME series; that is the finding.
 */
export function thetaSeries(basis: number[], n: number, maxNormSq: number): bigint[] {
  const series = (parity: number): bigint[] => {
    const s = new Array<bigint>(maxNormSq + 1).fill(0n);
    for (let m = -Math.ceil(Math.sqrt(maxNormSq)) - 1; m <= Math.ceil(Math.sqrt(maxNormSq)) + 1; m++) {
      if (((m % 2) + 2) % 2 !== parity) continue;
      const q = m * m;
      if (q <= maxNormSq) s[q]! += 1n;
    }
    return s;
  };
  const f = [series(0), series(1)];
  const total = new Array<bigint>(maxNormSq + 1).fill(0n);
  for (const w of spanBits(basis)) {
    let acc = new Array<bigint>(maxNormSq + 1).fill(0n);
    acc[0] = 1n;
    for (let i = 0; i < n; i++) {
      const g = f[(w >> i) & 1]!;
      const nx = new Array<bigint>(maxNormSq + 1).fill(0n);
      for (let a = 0; a <= maxNormSq; a++) {
        if (acc[a] === 0n) continue;
        for (let b = 0; a + b <= maxNormSq; b++) if (g[b]!) nx[a + b]! += acc[a]! * g[b]!;
      }
      acc = nx;
    }
    for (let a = 0; a <= maxNormSq; a++) total[a]! += acc[a]!;
  }
  return total;
}

// ── THE CLIFFORD / VERSOR ROUTE, RE-RUN AT RANK 16 ──────────────────────────────────────────

/**
 * The Clifford reflection on grade-1 elements: `s_r(x) = -r x r / (r.r) = x - 2(x.r)/(r.r) r`.
 * With `r.r = 4` and `x.r` even this is exact integer arithmetic — the same versor sandwich
 * `CliffordE8Roots.reflect` performs, at rank 16 instead of rank 8.
 */
export const reflect = (r: number[], x: number[]): number[] => {
  const c = dot(x, r) / 2;
  return x.map((xi, i) => xi - c * r[i]!);
};

/** Orbit of a simple system under its own reflections — the versor closure. */
export function versorClosure(simple: number[][]): number[][] {
  const key = (v: number[]) => v.join(",");
  const seen = new Map<string, number[]>();
  const stack: number[][] = [];
  for (const s of simple) {
    seen.set(key(s), s);
    stack.push(s);
  }
  while (stack.length) {
    const x = stack.pop() as number[];
    for (const s of simple) {
      const y = reflect(s, x);
      const k = key(y);
      if (!seen.has(k)) {
        seen.set(k, y);
        stack.push(y);
      }
    }
  }
  return [...seen.values()];
}

/** Dynkin diagram of type `A_m` (a path), 0-indexed. */
export const dynkinA = (m: number): [number, number][] =>
  Array.from({ length: m - 1 }, (_, i) => [i, i + 1] as [number, number]);
/** Dynkin diagram of type `D_m`: a path on `0..m-2` with node `m-1` attached to node `m-3`. */
export const dynkinD = (m: number): [number, number][] => [
  ...Array.from({ length: m - 2 }, (_, i) => [i, i + 1] as [number, number]),
  [m - 3, m - 1],
];
/** Dynkin diagram of `E8` (Bourbaki): chain 0-2-3-4-5-6-7 with node 1 hung off node 3. */
export const DYNKIN_E8: [number, number][] = [
  [0, 2],
  [2, 3],
  [3, 4],
  [4, 5],
  [5, 6],
  [6, 7],
  [1, 3],
];
/** `E8 + E8` — two disjoint copies. */
export const DYNKIN_E8_PLUS_E8: [number, number][] = [
  ...DYNKIN_E8,
  ...DYNKIN_E8.map(([a, b]) => [a + 8, b + 8] as [number, number]),
];

export interface SimpleSystemSearch {
  found: boolean;
  simple: number[][] | null;
  /** Search-tree nodes visited. */
  nodes: number;
  /** `true` if the search space was fully explored. A `false` here with `found: false` is INCONCLUSIVE. */
  exhausted: boolean;
}

/**
 * Search a root set for a simple system realising a given Dynkin diagram, then (caller's job)
 * close it under `versorClosure`. This is `CliffordE8Roots.simpleSystem` generalised: note that
 * the DIAGRAM IS AN INPUT. That is the point of the module — the route cannot pick a lattice,
 * because the thing that picks the lattice is handed to it.
 *
 * Two sound prunes, both of which can only discard non-solutions:
 *   1. simple roots are linearly INDEPENDENT, so the running Gram-Schmidt basis must grow;
 *   2. `firstRoots` may be restricted to one representative per irreducible component of the
 *      ambient system, because a simply-laced Weyl group is transitive on the roots of each
 *      component and its elements are isometries carrying type-X simple systems to type-X ones.
 */
export function findSimpleSystem(
  roots: number[][],
  edges: [number, number][],
  nNodes: number,
  firstRoots?: number[][],
  cap = 5e7,
): SimpleSystemSearch {
  const adj: boolean[][] = Array.from({ length: nNodes }, () => new Array(nNodes).fill(false));
  for (const [a, b] of edges) {
    adj[a]![b]! = true;
    adj[b]![a]! = true;
  }
  const order: number[] = [];
  const placed = new Set<number>();
  while (order.length < nNodes) {
    let next = -1;
    for (let v = 0; v < nNodes && next < 0; v++)
      if (!placed.has(v))
        for (const u of order)
          if (adj[v]![u]!) {
            next = v;
            break;
          }
    if (next < 0)
      for (let v = 0; v < nNodes; v++)
        if (!placed.has(v)) {
          next = v;
          break;
        }
    order.push(next);
    placed.add(next);
  }
  const chosen: number[][] = new Array(nNodes);
  const gs: number[][] = [];
  let nodes = 0;
  let exhausted = true;
  const rec = (k: number): boolean => {
    if (k === nNodes) return true;
    const v = order[k];
    const cands = k === 0 && firstRoots ? firstRoots : roots;
    for (const r of cands) {
      if (++nodes > cap) {
        exhausted = false;
        return false;
      }
      let ok = true;
      for (let j = 0; j < k; j++) {
        const u = order[j];
        if (dot(r, chosen[u!]!) !== (adj[v!]![u!]! ? -2 : 0)) {
          ok = false;
          break;
        }
      }
      if (!ok) continue;
      const w = r.map(Number);
      for (const g of gs) {
        const c = dot(w, g) / dot(g, g);
        for (let i = 0; i < w.length; i++) w[i]! -= c * g[i]!;
      }
      if (dot(w, w) < 1e-9) continue;
      chosen[v!] = r;
      gs.push(w);
      if (rec(k + 1)) return true;
      gs.pop();
    }
    return false;
  };
  const found = rec(0);
  return {
    found,
    simple: found ? [...Array(nNodes).keys()].map((i) => chosen[i]!) : null,
    nodes,
    exhausted,
  };
}

/** One root per irreducible component — the sound `firstRoots` reduction for `findSimpleSystem`. */
export function componentRepresentatives(roots: number[][]): number[][] {
  const N = roots.length;
  const par = [...Array(N).keys()];
  const find = (x: number): number => (par[x] === x ? x : (par[x] = find(par[x]!)));
  for (let i = 0; i < N; i++)
    for (let j = i + 1; j < N; j++) if (dot(roots[i]!, roots[j]!) !== 0) par[find(i)] = find(j);
  const reps = new Map<number, number[]>();
  for (let i = 0; i < N; i++) if (!reps.has(find(i))) reps.set(find(i), roots[i]!);
  return [...reps.values()];
}

// ── THE CAYLEY-DICKSON DOUBLED MODULE ───────────────────────────────────────────────────────

export type Gram = number[][];

export const gramDirectSum = (a: Gram, b: Gram): Gram => {
  const n = a.length;
  const m = b.length;
  const g: Gram = Array.from({ length: n + m }, () => new Array(n + m).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) g[i]![j]! = a[i]![j]!;
  for (let i = 0; i < m; i++) for (let j = 0; j < m; j++) g[n + i]![n + j]! = b[i]![j]!;
  return g;
};

export function gramDeterminant(m: Gram): number {
  const a = m.map((r) => r.slice());
  const n = a.length;
  let d = 1;
  for (let i = 0; i < n; i++) {
    let p = -1;
    for (let r = i; r < n; r++)
      if (Math.abs(a[r]![i]!) > 1e-9) {
        p = r;
        break;
      }
    if (p < 0) return 0;
    if (p !== i) {
      const swapRow = a[i]!;
      a[i] = a[p]!;
      a[p] = swapRow;
      d = -d;
    }
    d *= a[i]![i]!;
    for (let r = i + 1; r < n; r++) {
      const f = a[r]![i]! / a[i]![i]!;
      for (let c = i; c < n; c++) a[r]![c]! -= f * a[i]![c]!;
    }
  }
  return Math.round(d);
}

/** Count vectors of a given squared length by enumerating integer coefficient vectors in a box. */
export function gramKissing(g: Gram, minNorm: number, box = 2): number {
  const n = g.length;
  let count = 0;
  const v = new Array(n).fill(0);
  const rec = (i: number): void => {
    if (i === n) {
      let q = 0;
      for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) q += v[a] * g[a]![b]! * v[b];
      if (Math.abs(q - minNorm) < 1e-9) count++;
      return;
    }
    for (let x = -box; x <= box; x++) {
      v[i] = x;
      rec(i + 1);
    }
    v[i] = 0;
  };
  rec(0);
  return count;
}

export const GRAM_Z2: Gram = [
  [1, 0],
  [0, 1],
];
export const GRAM_A2: Gram = [
  [2, -1],
  [-1, 2],
];
export const GRAM_D4: Gram = [
  [2, -1, 0, 0],
  [-1, 2, -1, -1],
  [0, -1, 2, 0],
  [0, -1, 0, 2],
];

// ── PERRON-FROBENIUS: which E8 the physics uses ─────────────────────────────────────────────

/**
 * Perron-Frobenius eigenvector of a Dynkin diagram's ADJACENCY matrix, normalised so the
 * smallest component is 1. For E8 these ratios are Zamolodchikov's mass spectrum.
 *
 * **The shift is load-bearing, not defensive.** A Dynkin diagram is a tree, hence bipartite,
 * so its adjacency matrix has eigenvalues `+-lambda` and plain power iteration OSCILLATES
 * between the two eigenvectors rather than converging. Iterating `A + shift*I` moves the
 * spectrum positive. Written without the shift, this function returned a spectrum in which four
 * of the eight components were off by a common factor of 1.1106; Zamolodchikov's published
 * closed forms are what caught it.
 */
export function perronFrobeniusRatios(
  adj: number[][],
  shift = 2,
  iters = 60000,
): { ratios: number[]; eigenvalue: number } {
  const n = adj.length;
  let v = new Array(n).fill(0).map((_, i) => 1 + i * 1e-3);
  const mul = (x: number[]): number[] => {
    const w = new Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      w[i] = shift * x[i]!;
      for (let j = 0; j < n; j++) if (adj[i]![j]!) w[i] += x[j];
    }
    return w;
  };
  for (let t = 0; t < iters; t++) {
    const w = mul(v);
    const nrm = Math.hypot(...w);
    v = w.map((x) => x / nrm);
  }
  const w = mul(v);
  const eigenvalue = Math.hypot(...w) - shift;
  const abs = v.map(Math.abs);
  const min = Math.min(...abs);
  return { ratios: abs.map((x) => x / min).sort((a, b) => a - b), eigenvalue };
}

/** Adjacency matrix from an edge list. */
export function adjacency(n: number, edges: [number, number][]): number[][] {
  const a = Array.from({ length: n }, () => new Array(n).fill(0));
  for (const [i, j] of edges) {
    a[i]![j]! = 1;
    a[j]![i]! = 1;
  }
  return a;
}

// ── BARNES-WALL: the DENSITY route, which diverges from the unimodular route at 16 ──────────

/** Reed-Muller `RM(1,4)` = `[16,5,8]`, generated by the four coordinate-bit functions plus all-ones. */
export function reedMuller14(): number[] {
  const gens: number[] = [];
  for (let b = 0; b < 4; b++) {
    let m = 0;
    for (let p = 0; p < 16; p++) if ((p >> b) & 1) m |= 1 << p;
    gens.push(m);
  }
  gens.push(0xffff);
  return gens;
}

/**
 * The Barnes-Wall lattice `Lambda_16` as Construction B over `RM(1,4)`:
 * `{ x in Z^16 : x mod 2 in RM(1,4),  sum(x) = 0 (mod 4) }`.
 * Returns its minimal-vector count and centre density, both computed.
 * (Reproducing the published `kissing = 4320`, `delta = 1/16` is the check on the construction.)
 */
export function barnesWall16(): { minNormSq: number; kissing: number; covolume: number; centreDensity: number } {
  const rm = spanBits(reedMuller14());
  let kissing = 0;
  for (let i = 0; i < 16; i++)
    for (let j = i + 1; j < 16; j++)
      for (const si of [2, -2]) for (const sj of [2, -2]) if ((((si + sj) % 4) + 4) % 4 === 0) kissing++;
  const w8 = rm.filter((w) => POP[w] === 8).length;
  let evenSignPatterns = 0;
  for (let m = 0; m < 256; m++) if (POP[m]! % 2 === 0) evenSignPatterns++;
  kissing += w8 * evenSignPatterns;
  const covolume = (Math.pow(2, 16) / rm.length) * 2;
  return { minNormSq: 8, kissing, covolume, centreDensity: Math.pow(Math.sqrt(8) / 2, 16) / covolume };
}

/** Centre density of a rank-16 lattice from its minimal norm and covolume. */
export const centreDensity16 = (minNormSq: number, covolume: number): number =>
  Math.pow(Math.sqrt(minNormSq) / 2, 16) / covolume;

// ── THE CLASSIFICATION, BY MASS FORMULA ─────────────────────────────────────────────────────

/**
 * Order of the permutation automorphism group of a binary code, by a stabiliser chain:
 * `|Aut| = prod_t |orbit of point t under the stabiliser of 0..t-1|`.
 *
 * The inner existence test backtracks over images, pruned by "every weight-4 codeword whose
 * support is already fully assigned must map to a weight-4 codeword", and then VERIFIES the
 * whole code at the leaf. The prune alone would be incomplete for `d16+`, whose tetrads span
 * only a dimension-7 subcode; the leaf verification is what makes the answer exact.
 */
export function automorphismOrder(n: number, basis: number[]): bigint {
  const words = spanBits(basis);
  const codeSet = new Set(words);
  const tet = words.filter((w) => POP[w] === 4);
  const tetSet = new Set(tet);
  const map = new Array(n).fill(-1);
  const used = new Array(n).fill(false);
  const image = (w: number): number => {
    let r = 0;
    for (let i = 0; i < n; i++) if ((w >> i) & 1) r |= 1 << map[i];
    return r;
  };
  const partialOk = (t: number): boolean => {
    for (const w of tet) {
      let r = 0;
      let full = true;
      for (let i = 0; i < n; i++)
        if ((w >> i) & 1) {
          if (i > t || map[i] < 0) {
            full = false;
            break;
          }
          r |= 1 << map[i];
        }
      if (full && !tetSet.has(r)) return false;
    }
    return true;
  };
  const rec = (t: number): boolean => {
    if (t === n) return words.every((w) => codeSet.has(image(w)));
    if (map[t] >= 0) return partialOk(t) && rec(t + 1);
    for (let p = 0; p < n; p++) {
      if (used[p]) continue;
      map[t] = p;
      used[p] = true;
      if (partialOk(t) && rec(t + 1)) {
        map[t] = -1;
        used[p] = false;
        return true;
      }
      map[t] = -1;
      used[p] = false;
    }
    return false;
  };
  let order = 1n;
  const prefix = new Array(n).fill(-1);
  for (let lvl = 0; lvl < n; lvl++) {
    let orbit = 0;
    for (let p = 0; p < n; p++) {
      if (prefix.indexOf(p) >= 0) continue;
      for (let i = 0; i < n; i++) map[i] = prefix[i];
      used.fill(false);
      for (let i = 0; i < n; i++) if (map[i] >= 0) used[map[i]] = true;
      map[lvl] = p;
      used[p] = true;
      if (rec(0)) orbit++;
      map[lvl] = -1;
      used[p] = false;
    }
    if (orbit === 0) break;
    order *= BigInt(orbit);
    prefix[lvl] = lvl;
  }
  return order;
}

export const factorial = (n: number): bigint => {
  let f = 1n;
  for (let i = 2n; i <= BigInt(n); i++) f *= i;
  return f;
};

/**
 * The number of LABELLED Type II codes of length `n` (`n = 0 mod 8`):
 * `N(n) = 2 * prod_{i=1}^{n/2-2} (2^i + 1)`.
 *
 * This is the one input taken from outside. It is not taken on faith: `N(8) = 30`, and an
 * independent exhaustive classification at length 8 (in the test) finds exactly one class with
 * `|Aut| = 1344`, i.e. `8!/1344 = 30`. A formula that reproduces the length-8 count is then
 * used at length 16, where the sum of the two computed class sizes must hit it exactly — and a
 * missing third class would show up as missing mass.
 */
export function typeIILabelledCount(n: number): bigint {
  let p = 2n;
  for (let i = 1n; i <= BigInt(n / 2 - 2); i++) p *= 2n ** i + 1n;
  return p;
}

/** Exhaustive classification of Type II codes of length `n` by dimension-wise extension. */
export function classifyTypeII(n: number): number[][] {
  const projKey = (words: number[], pos: number[]): string => {
    const t = new Map<number, number>();
    for (const w of words) {
      let p = 0;
      for (let i = 0; i < pos.length; i++) if ((w >> pos[i]!) & 1) p |= 1 << i;
      t.set(p, (t.get(p) ?? 0) + 1);
    }
    return [...t.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([k, v]) => `${k}.${v}`)
      .join(",");
  };
  const isomorphic = (w1: number[], w2: number[]): boolean => {
    const used = new Array(n).fill(false);
    const map = new Array(n).fill(-1);
    const src: number[] = [];
    const dst: number[] = [];
    const rec = (t: number): boolean => {
      if (t === n) return true;
      for (let p = 0; p < n; p++) {
        if (used[p]) continue;
        map[t] = p;
        used[p] = true;
        src.push(t);
        dst.push(p);
        if (projKey(w1, src) === projKey(w2, dst) && rec(t + 1)) return true;
        src.pop();
        dst.pop();
        used[p] = false;
        map[t] = -1;
      }
      return false;
    };
    return rec(0);
  };
  const deInDual = (basis: number[]): number[] => {
    const out: number[] = [];
    for (let v = 0; v < 1 << n; v++) {
      if (POP[v]! % 4) continue;
      let ok = true;
      for (const b of basis)
        if (POP[v & b]! & 1) {
          ok = false;
          break;
        }
      if (ok) out.push(v);
    }
    return out;
  };
  let level: { basis: number[]; words: number[] }[] = [{ basis: [], words: [0] }];
  for (let k = 0; k < n / 2; k++) {
    const buckets = new Map<string, { basis: number[]; words: number[] }[]>();
    for (const cls of level) {
      const inC = new Set(cls.words);
      for (const v of deInDual(cls.basis)) {
        if (inC.has(v)) continue;
        const basis = cls.basis.concat([v]);
        const words = spanBits(basis);
        const wd = new Array(n + 1).fill(0);
        for (const w of words) wd[POP[w]!]++;
        const key = wd.join(",");
        const b = buckets.get(key);
        if (!b) {
          buckets.set(key, [{ basis, words }]);
          continue;
        }
        if (!b.some((c) => isomorphic(words, c.words))) b.push({ basis, words });
      }
    }
    level = [...buckets.values()].flat();
  }
  return level.map((c) => c.basis);
}
