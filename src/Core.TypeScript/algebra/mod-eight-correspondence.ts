// mod-eight-correspondence.ts — WHICH EIGHTS ARE THE SAME EIGHT.
//
// The repo keeps meeting the integer 8: Clifford/Atiyah-Bott-Shapiro periodicity, doubly-even
// self-dual binary codes, even unimodular lattices, Legendre's three-square theorem, adinkra
// closure at N = 8, real Bott periodicity. A shared integer is not a connection
// (`.claude/rules/numerology-vs-number-theory.md`), so this module COMPUTES the bridges rather
// than asserting them, and computes one clean NEGATIVE.
//
// Full write-up, with the verdict per pair and the citations:
//   docs/research/2026-08-18-which-eights-are-the-same-eight-the-mod-8-correspondence-matrix.md
//
// WHAT IS DELIBERATELY NOT HERE. A check that `e^{i pi n / 4} === 1` exactly when `8` divides
// `n` would be a tautology: both sides are the same modular arithmetic wearing different
// notation. Same for comparing `admitsDoublyEvenSelfDualCode` with
// `admitsEvenUnimodularLattice` in `CliffordPeriodicity.fs` — both are literally `n % 8 === 0`,
// so their agreement is a restatement and constrains nothing. The checks below were chosen
// because each one computes its answer from data that does NOT already contain the answer.
//
// Anchors: Conway and Sloane, *Sphere Packings, Lattices and Groups*, ch. 7 (Construction A);
// Milnor and Husemoller, *Symmetric Bilinear Forms*, ch. II and appendix 4 (Milgram's formula);
// Serre, *A Course in Arithmetic*, ch. V; Wall, *Graded Brauer groups*, J. reine angew. Math.
// 213 (1964); Atiyah, Bott and Shapiro, *Clifford Modules*, Topology 3 (1964); Hurwitz (1923)
// and Radon (1922); Doran, Faux, Gates, Huebsch, Iga and Landweber, arXiv:0806.0051.

export type Matrix = number[][];

/** Exact integer determinant by Bareiss fraction-free elimination. */
export function determinant(m: Matrix): number {
  const n = m.length;
  const a = m.map((r) => r.slice());
  let sign = 1;
  let prev = 1;
  for (let k = 0; k <= n - 2; k++) {
    if (a[k]![k]! === 0) {
      let swapRow = -1;
      for (let i = k + 1; i <= n - 1; i++) {
        if (a[i]![k]! !== 0) {
          swapRow = i;
          break;
        }
      }
      if (swapRow < 0) return 0;
      const t = a[k]!;
      a[k] = a[swapRow]!;
      a[swapRow] = t;
      sign = -sign;
    }
    for (let i = k + 1; i <= n - 1; i++) {
      for (let j = k + 1; j <= n - 1; j++) {
        a[i]![j] = (a[i]![j]! * a[k]![k]! - a[i]![k]! * a[k]![j]!) / prev;
      }
    }
    prev = a[k]![k]!;
  }
  return sign * a[n - 1]![n - 1]!;
}

/** Adjugate, so that `adjugate(m) * m === determinant(m) * I` over the integers. */
export function adjugate(m: Matrix): Matrix {
  const n = m.length;
  if (n === 1) return [[1]];
  const out: Matrix = Array.from({ length: n }, () => new Array<number>(n).fill(0));
  for (let i = 0; i <= n - 1; i++) {
    for (let j = 0; j <= n - 1; j++) {
      const minor = m.filter((_, r) => r !== i).map((row) => row.filter((_, c) => c !== j));
      const sign = (i + j) % 2 === 0 ? 1 : -1;
      out[j]![i] = sign * determinant(minor);
    }
  }
  return out;
}

/** Orthogonal direct sum of two Gram matrices. */
export function directSum(a: Matrix, b: Matrix): Matrix {
  const n = a.length;
  const m = b.length;
  const out: Matrix = Array.from({ length: n + m }, () => new Array<number>(n + m).fill(0));
  for (let i = 0; i <= n - 1; i++) for (let j = 0; j <= n - 1; j++) out[i]![j] = a[i]![j]!;
  for (let i = 0; i <= m - 1; i++) for (let j = 0; j <= m - 1; j++) out[n + i]![n + j] = b[i]![j]!;
  return out;
}

/**
 * Column-style Hermite normal form: lower triangular with positive diagonal, generating the
 * same column lattice. Used only to enumerate `Z^n / G Z^n` in `product(diagonal)` steps
 * instead of `|det G|^n`, which is the difference between milliseconds and exhausting memory.
 */
export function hermiteColumns(g: Matrix): Matrix {
  const n = g.length;
  const h = g.map((r) => r.slice());
  const subtractCol = (j: number, k: number, q: number) => {
    for (let i = 0; i <= n - 1; i++) h[i]![j] = h[i]![j]! - q * h[i]![k]!;
  };
  const swapCols = (j: number, k: number) => {
    for (let i = 0; i <= n - 1; i++) {
      const t = h[i]![j]!;
      h[i]![j] = h[i]![k]!;
      h[i]![k] = t;
    }
  };
  for (let i = 0; i <= n - 1; i++) {
    for (let j = i + 1; j <= n - 1; j++) {
      while (h[i]![j]! !== 0) {
        if (h[i]![i]! === 0) {
          swapCols(i, j);
          continue;
        }
        subtractCol(j, i, Math.trunc(h[i]![j]! / h[i]![i]!));
        if (h[i]![j]! !== 0) swapCols(i, j);
      }
    }
    if (h[i]![i]! < 0) for (let r = 0; r <= n - 1; r++) h[r]![i] = -h[r]![i]!;
  }
  return h;
}

/**
 * **The bridge, computed.** Gauss-Milgram: for an even lattice `L` with discriminant form
 * `(A, q)`, the normalised Gauss sum over `A` equals `exp(2 pi i sigma / 8)` where `sigma` is
 * the SIGNATURE of `L`.
 *
 * This is the load-bearing computation of the whole module, and it is non-tautological in a
 * specific way worth stating: the input is a finite abelian group with a `Q/Z`-valued quadratic
 * form — purely 2-adic, arithmetic, finite data with no notion of "positive" or "negative"
 * anywhere in it — and the output is an eighth root of unity that reads off an ARCHIMEDEAN
 * invariant. That eighth root of unity is the Weil index of `L` tensor `R`, which is the same
 * order-8 cyclic group as the Brauer-Wall group `BW(R)` that Atiyah-Bott-Shapiro periodicity
 * lives in. So this function is where the lattice eight and the Clifford eight touch.
 *
 * Returns the sum as `[re, im]`; the caller compares it against `exp(2 pi i sigma / 8)`.
 */
export function gaussMilgramSum(gram: Matrix): { re: number; im: number; order: number } {
  const n = gram.length;
  const d = determinant(gram);
  const adj = adjugate(gram);
  const hnf = hermiteColumns(gram);
  let reps: number[][] = [[]];
  for (let i = 0; i <= n - 1; i++) {
    const next: number[][] = [];
    for (const p of reps) for (let v = 0; v <= hnf[i]![i]! - 1; v++) next.push([...p, v]);
    reps = next;
  }
  let re = 0;
  let im = 0;
  for (const z of reps) {
    let num = 0;
    for (let i = 0; i <= n - 1; i++) for (let j = 0; j <= n - 1; j++) num += z[i]! * adj[i]![j]! * z[j]!;
    const q = num / (2 * d);
    const theta = 2 * Math.PI * (q - Math.floor(q));
    re += Math.cos(theta);
    im += Math.sin(theta);
  }
  const scale = Math.sqrt(reps.length);
  return { re: re / scale, im: im / scale, order: reps.length };
}

/** `exp(2 pi i sigma / 8)` — the eighth root of unity the Gauss sum must land on. */
export function eighthRootOfUnity(sigma: number): { re: number; im: number } {
  const theta = (2 * Math.PI * sigma) / 8;
  return { re: Math.cos(theta), im: Math.sin(theta) };
}

/** A binary linear code as its generator rows, each a `0/1` array of length `n`. */
export type BinaryCode = number[][];

/** The `[8,4]` extended Hamming code — `AdinkraCode.generator` in `src/Core/AdinkraCode.fs`. */
export const EXTENDED_HAMMING_8_4: BinaryCode = [
  [1, 0, 0, 0, 0, 1, 1, 1],
  [0, 1, 0, 0, 1, 0, 1, 1],
  [0, 0, 1, 0, 1, 1, 0, 1],
  [0, 0, 0, 1, 1, 1, 1, 0],
];

/**
 * `i2^4` — the OTHER self-dual binary code of length 8, four copies of `{00, 11}`. Self-dual
 * but only SINGLY even (weights 0, 2, 4, 6, 8). It is the negative control: it isolates
 * "doubly even" as the hypothesis that does the work in Construction A.
 */
export const SINGLY_EVEN_SELF_DUAL_8: BinaryCode = [
  [1, 1, 0, 0, 0, 0, 0, 0],
  [0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0],
  [0, 0, 0, 0, 0, 0, 1, 1],
];

/** All codewords of the code spanned by `generators`, over GF(2). */
export function codewords(generators: BinaryCode): number[][] {
  const n = generators[0]!.length;
  const out: number[][] = [];
  const count = Math.pow(2, generators.length);
  for (let m = 0; m <= count - 1; m++) {
    const c = new Array<number>(n).fill(0);
    for (let i = 0; i <= generators.length - 1; i++) {
      if (Math.floor(m / Math.pow(2, i)) % 2 === 1) {
        for (let j = 0; j <= n - 1; j++) c[j] = (c[j]! + generators[i]![j]!) % 2;
      }
    }
    out.push(c);
  }
  return out;
}

const weight = (c: number[]): number => c.reduce((a, b) => a + b, 0);

/** Pivot columns of the generator matrix after GF(2) row reduction. */
function pivotColumns(generators: BinaryCode): number[] {
  const n = generators[0]!.length;
  const rows = generators.map((r) => r.slice());
  const piv: number[] = [];
  let r = 0;
  for (let c = 0; c <= n - 1; c++) {
    if (r >= rows.length) break;
    let src = -1;
    for (let i = r; i <= rows.length - 1; i++) {
      if (rows[i]![c]! === 1) {
        src = i;
        break;
      }
    }
    if (src < 0) continue;
    const t = rows[r]!;
    rows[r] = rows[src]!;
    rows[src] = t;
    for (let i = 0; i <= rows.length - 1; i++) {
      if (i === r) continue;
      if (rows[i]![c]! === 1) for (let j = 0; j <= n - 1; j++) rows[i]![j] = (rows[i]![j]! + rows[r]![j]!) % 2;
    }
    piv.push(c);
    r++;
  }
  return piv;
}

export interface ConstructionAResult {
  /** Determinant of the Gram matrix. `1` (up to sign) means UNIMODULAR. */
  readonly gramDeterminant: number;
  /** All Gram entries integral. */
  readonly integral: boolean;
  /** All diagonal Gram entries even. This is the EVEN condition, and it is the whole point. */
  readonly evenDiagonal: boolean;
  /** Vectors of norm 1. Zero for an even lattice; nonzero exposes an ODD one. */
  readonly norm1: number;
  /** Vectors of norm 2. `240` identifies E8 among rank-8 even unimodular lattices. */
  readonly norm2: number;
}

/**
 * **Construction A, executed** (Conway-Sloane ch. 7). Lift a binary code `C` of length `n` to
 * the lattice of integer vectors congruent to a codeword mod 2, with the form half the sum of
 * squares.
 *
 * Two hypotheses, two independent consequences, and separating them is the reason this
 * function exists rather than a comment asserting the theorem:
 *
 *   - `C` SELF-DUAL   gives a UNIMODULAR lattice (determinant 1).
 *   - `C` DOUBLY EVEN gives an EVEN lattice (integral norms, even diagonal).
 *
 * Run it on the in-tree `[8,4]` extended Hamming code and you get E8. Run it on `i2^4` —
 * equally self-dual, only singly even — and you get a unimodular lattice that is ODD, with 16
 * vectors of norm 1. That second run is the falsifier: the mod-8 obstruction rides on DOUBLY
 * even, not on self-duality, so the eight in Gleason's theorem is inherited from the lattice
 * side rather than being a separate fact.
 */
export function constructionA(generators: BinaryCode): ConstructionAResult {
  const n = generators[0]!.length;
  const piv = pivotColumns(generators);
  const basis: number[][] = generators.map((g) => g.slice());
  for (let j = 0; j <= n - 1; j++) {
    if (piv.includes(j)) continue;
    const row = new Array<number>(n).fill(0);
    row[j] = 2;
    basis.push(row);
  }
  const gram: Matrix = basis.map((bi) =>
    basis.map((bj) => {
      let s = 0;
      for (let t = 0; t <= n - 1; t++) s += bi[t]! * bj[t]!;
      return s / 2;
    }),
  );
  const integral = gram.every((r) => r.every((v) => Number.isInteger(v)));
  const evenDiagonal = gram.every((r, i) => r[i]! % 2 === 0);
  // Minimal vectors, enumerated over the code rather than over Z^n. With the half-sum-of-
  // squares form, a vector of norm 1 has exactly two odd coordinates of absolute value 1 (an
  // odd entry of absolute value 3 already overshoots, and even entries contribute 0 or at
  // least 4), so its parity pattern is a weight-2 codeword and each such codeword contributes
  // 4 sign choices. A vector of norm 2 is either a single plus-or-minus 2 on the zero codeword
  // (2n of them) or four coordinates of absolute value 1 on a weight-4 codeword (16 sign
  // choices each). Both counts are therefore read straight off the weight distribution.
  let weight2Words = 0;
  let weight4Words = 0;
  for (const c of codewords(generators)) {
    const w = weight(c);
    if (w === 2) weight2Words++;
    if (w === 4) weight4Words++;
  }
  const norm1 = 4 * weight2Words;
  const norm2 = 2 * n + 16 * weight4Words;
  return { gramDeterminant: determinant(gram), integral, evenDiagonal, norm1, norm2 };
}

/**
 * `S`, the weight enumerator evaluated at `(1, i)`: the sum of `i` to the power of each
 * codeword weight.
 *
 * For a SELF-DUAL code, MacWilliams duality gives `S = exp(i pi n / 4) * conj(S)`. If the code
 * is also DOUBLY even then every weight is divisible by 4, every term is 1, so `S` equals the
 * code size — real and positive — and the identity collapses to `exp(i pi n / 4) = 1`, i.e. 8
 * divides `n`. That is Gleason's constraint proved with no lattice and no Clifford algebra,
 * and the phase it turns on is the same eighth root of unity `gaussMilgramSum` produces.
 *
 * The singly-even control returns `S = 0`, where the identity says nothing — which is exactly
 * why singly-even self-dual codes exist at lengths not divisible by 8.
 */
export function weightEnumeratorAtI(generators: BinaryCode): { re: number; im: number } {
  const reTable = [1, 0, -1, 0];
  const imTable = [0, 1, 0, -1];
  let re = 0;
  let im = 0;
  for (const c of codewords(generators)) {
    const w = weight(c) % 4;
    re += reTable[w]!;
    im += imTable[w]!;
  }
  return { re, im };
}

/**
 * Maximum dimension of a doubly-even binary linear code of length `n`, by exhaustive search.
 *
 * One computation, two consumers, which is why it earns its place:
 *
 *   - GLEASON. A doubly-even SELF-DUAL code of length `n` exists exactly when this equals
 *     `n / 2`. Searching for that is a real falsifier: it would find one at a length not
 *     divisible by 8 if the theorem were false.
 *   - ADINKRA. The Doran-Faux-Gates-Huebsch-Iga-Landweber correspondence makes an `N`-colour
 *     adinkra a quotient of the `N`-cube by a doubly-even code, so the MINIMAL adinkra has
 *     `2^(N - k - 1)` bosons for `k` maximal. Compare that against `radonHurwitzMinimalDim`,
 *     which is computed from the Clifford side and knows nothing about codes.
 *
 * Doubly-even is equivalent to a generating set with all weights divisible by 4 and all
 * pairwise intersections even, so the search branches over increasing chains of such vectors.
 * Cost grows fast: `n = 10` is milliseconds, `n = 12` is minutes.
 */
export function maxDoublyEvenDim(n: number): number {
  const cap = Math.floor(n / 2);
  const all: number[] = [];
  const popcount = (x: number): number => {
    let c = 0;
    let v = x;
    while (v !== 0) {
      c += v % 2;
      v = Math.floor(v / 2);
    }
    return c;
  };
  for (let v = 1; v <= Math.pow(2, n) - 1; v++) if (popcount(v) % 4 === 0) all.push(v);
  let best = 0;
  const pivots: number[] = [];
  const reduce = (x: number): number => {
    let v = x;
    for (const p of pivots) {
      const hb = Math.floor(Math.log2(p));
      if (Math.floor(v / Math.pow(2, hb)) % 2 === 1) v = xorInts(v, p);
    }
    return v;
  };
  const dfs = (pool: number[], depth: number): void => {
    if (depth > best) best = depth;
    if (best === cap) return;
    if (depth + pool.length <= best) return;
    for (let i = 0; i <= pool.length - 1; i++) {
      if (depth + (pool.length - i) <= best) return;
      const v = pool[i]!;
      const r = reduce(v);
      if (r === 0) continue;
      const next: number[] = [];
      for (let j = i + 1; j <= pool.length - 1; j++) {
        if (popcount(andInts(pool[j]!, v)) % 2 === 0) next.push(pool[j]!);
      }
      pivots.push(r);
      dfs(next, depth + 1);
      pivots.pop();
      if (best === cap) return;
    }
  };
  dfs(all, 0);
  return best;
}

/** Bitwise XOR, named so the search above reads as GF(2) vector addition. */
function xorInts(a: number, b: number): number {
  let result = 0;
  let x = a;
  let y = b;
  let bit = 1;
  while (x !== 0 || y !== 0) {
    if (x % 2 !== y % 2) result += bit;
    x = Math.floor(x / 2);
    y = Math.floor(y / 2);
    bit *= 2;
  }
  return result;
}

/** Bitwise AND, named so the search above reads as codeword-support intersection. */
function andInts(a: number, b: number): number {
  let result = 0;
  let x = a;
  let y = b;
  let bit = 1;
  while (x !== 0 && y !== 0) {
    if (x % 2 === 1 && y % 2 === 1) result += bit;
    x = Math.floor(x / 2);
    y = Math.floor(y / 2);
    bit *= 2;
  }
  return result;
}

/**
 * The Hurwitz-Radon function. Writing `d = 2^(4a+b) * odd` with `b` in `0..3`, the maximum
 * number of anticommuting orthogonal `d x d` real matrices is `8a + 2^b`. Radon (1922),
 * Hurwitz (1923); the modern proof is exactly the real Clifford module classification, which
 * is why this is item (1) of the correspondence matrix wearing a different hat.
 */
export function hurwitzRadon(d: number): number {
  let exponent = 0;
  let m = d;
  while (m % 2 === 0) {
    m = m / 2;
    exponent++;
  }
  const a = Math.floor(exponent / 4);
  const b = exponent % 4;
  return 8 * a + Math.pow(2, b);
}

/**
 * Minimal `d` admitting an `N`-member Hurwitz-Radon family: the smallest boson multiplet an
 * `N`-extended supermultiplet can have. Computed purely from the Clifford side.
 */
export function radonHurwitzMinimalDim(n: number): number {
  let d = 1;
  while (hurwitzRadon(d) < n) d = d * 2;
  return d;
}

/**
 * Minimal adinkra boson count from the CODE side: `2^(N - k - 1)` with `k` the maximal
 * doubly-even code dimension at length `N`.
 *
 * The point of having both is that they share no inputs. Agreement across a range of `N` is
 * evidence that the adinkra eight and the Clifford eight are one eight; disagreement anywhere
 * would have refuted it.
 */
export function adinkraMinimalDimFromCodes(n: number): number {
  return Math.pow(2, n - maxDoublyEvenDim(n) - 1);
}

/** Brute force: is `n` a sum of three integer squares? */
export function isSumOfThreeSquares(n: number): boolean {
  for (let a = 0; a * a <= n; a++) {
    for (let b = a; a * a + b * b <= n; b++) {
      const r = n - a * a - b * b;
      const c = Math.round(Math.sqrt(r));
      if (c * c === r) return true;
    }
  }
  return false;
}

/** Legendre's criterion: the excluded numbers are exactly those of the form `4^a (8b + 7)`. */
export function legendreExcluded(n: number): boolean {
  let m = n;
  while (m % 4 === 0) m = m / 4;
  return m % 8 === 7;
}

export interface ResidueTally {
  readonly excluded: number[];
  readonly total: number[];
  readonly partialResidues: number[];
}

/**
 * **THE CLEAN NEGATIVE.** Tally the Legendre-excluded integers by residue class mod 8.
 * `excluded[r]` and `total[r]` count members of residue class `r`; `partialResidues` lists the
 * classes that are excluded only in part.
 *
 * The three-square theorem is always quoted with an 8 in it, which invites reading its eight as
 * the periodicity eight of items 1 to 3. This function refutes that reading in the most direct
 * way available: it asks whether the excluded set is a union of residue classes mod 8 at all.
 * It is not. Residue 7 is excluded entirely, but residues 4 and 0 are excluded only in PART,
 * because of the factor of a power of four: 28 is excluded and is 4 mod 8, 112 is excluded and
 * is 0 mod 8, while 4 and 8 themselves are not excluded.
 *
 * So Legendre's obstruction is not a congruence condition on `n` mod 8 at all; it is a 2-adic
 * condition whose customary statement happens to mention 8. Contrast items 2 and 3, where
 * "length divisible by 8" IS literally a union of residue classes. Different kind of object,
 * and `partialResidues` is the discriminator that says so.
 */
export function legendreResidueTally(limit: number): ResidueTally {
  const excluded = new Array<number>(8).fill(0);
  const total = new Array<number>(8).fill(0);
  for (let n = 1; n <= limit; n++) {
    const r = n % 8;
    total[r] = total[r]! + 1;
    if (legendreExcluded(n)) excluded[r] = excluded[r]! + 1;
  }
  const partialResidues: number[] = [];
  for (let r = 0; r <= 7; r++) {
    if (excluded[r]! === 0) continue;
    if (excluded[r]! === total[r]!) continue;
    partialResidues.push(r);
  }
  return { excluded, total, partialResidues };
}

/**
 * Ungraded Morita shape of the real Clifford algebra at clock position `s`, matrix size
 * stripped: the ground division algebra, plus a marker when the algebra splits into two
 * summands. This is what `CliffordPeriodicity.classify` returns, reduced to the part that is
 * invariant under Morita equivalence.
 */
const UNGRADED_SHAPE = ["R", "Rsum", "R", "C", "H", "Hsum", "H", "C"];

export function ungradedShapeAt(s: number): string {
  const k = ((s % 8) + 8) % 8;
  return UNGRADED_SHAPE[k]!;
}

/**
 * How many DISTINCT ungraded shapes the eight clock positions actually take, and how many
 * distinct values the PAIR of shapes (the algebra and its even subalgebra) takes.
 *
 * This is a finding about our own module rather than about the literature. The even subalgebra
 * of a Clifford algebra sits one tick forward on the clock, so the pair at position `s` is
 * `(shape(s), shape(s + 1))`. The counts come out 5 and 8: the ungraded shape COLLIDES at
 * positions 0 with 2, 4 with 6, and 3 with 7, so `classify` on its own separates only five of
 * the eight positions and cannot witness an order-8 structure. Adding the even subalgebra
 * separates all eight.
 *
 * The moral, which is the honest reading of item 1: the eight is a GRADED phenomenon. The
 * ungraded Brauer group of the reals has order 2; it is the Brauer-Wall group of Z/2-graded
 * algebras (Wall 1964) that is cyclic of order 8. So "Clifford periodicity is mod 8" is a
 * statement about SUPER algebra, which is also why it is the adinkra's eight: supersymmetry is
 * the grading.
 */
export function clockSeparation(): { ungraded: number; withEvenSubalgebra: number } {
  const shapes: string[] = [];
  const pairs: string[] = [];
  for (let s = 0; s <= 7; s++) {
    shapes.push(ungradedShapeAt(s));
    pairs.push(ungradedShapeAt(s).concat(" then ", ungradedShapeAt(s + 1)));
  }
  return { ungraded: new Set(shapes).size, withEvenSubalgebra: new Set(pairs).size };
}
