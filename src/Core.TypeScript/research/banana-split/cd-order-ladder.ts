// cd-order-ladder.ts — is the A2/D4/E8 "ladder" ONE catamorphism, or a banana split?
//
// THE QUESTION, stated so it can fail. PR #15417 computed that the lattice ladder does not
// commute with Cayley-Dickson doubling: doubling the Gaussian order gives the Lipschitz order
// at index 2 inside Hurwitz, doubling Hurwitz gives D4 (+) D4 at index 4 inside E8. That makes
// the ladder look like TWO operations -- `double`, then `complete to a maximal order`. Meijer,
// Fokkinga & Paterson's BANANA SPLIT law (1991) is the tool that decides whether two operations
// over one carrier fuse into one catamorphism or genuinely split into a pair:
//
//     (|f|) /\ (|g|)  =  (|(f . F pi1) /\ (g . F pi2)|)
//
// Read backwards -- which is the direction we need -- the law says a catamorphism into a PRODUCT
// carrier factors into a pair of independent catamorphisms EXACTLY WHEN each projection of the
// step is a function of the corresponding projection of its input:
//
//     pi1 . chi = phi . F pi1        and        pi2 . chi = psi . F pi2      (the SPLIT CONDITION)
//
// If the second component reads the first, the fold is still a single catamorphism, but it is a
// ZYGOMORPHISM (Malcolm 1990; Fokkinga's law of zygomorphism), not a banana split. So the question
// "one object or several?" has a mechanical answer here:
//
//     does the lattice step depend only on the LATTICE, or does it read the ALGEBRA?
//
// This module answers that by computation. Everything is exact rational arithmetic over BigInt;
// no floating point appears anywhere, so no result below is a rounding artefact.
//
// WHAT IS COMPUTED (each is a falsifier for a sentence in the companion research document):
//
//   1. The Cayley-Dickson tower itself, generated from R by iterating D(A) = A (+) A with
//      (a,b)(c,d) = (ac - conj(d) b, d a + b conj(c)). Commutativity / associativity /
//      alternativity are MEASURED, never assumed.
//   2. `integralOverlattices` -- given an ambient composition algebra and an order inside it,
//      enumerate EVERY integral overlattice (equivalently: every isotropic subgroup of the
//      discriminant group) and report which are closed under multiplication. This is the
//      "take a maximal order" step, computed rather than cited.
//   3. The SPLIT-CONDITION falsifier: the same Z-module Z^4, with the same quadratic form
//      Q = 2*sum(x_i^2), sitting in two different ambient algebras (Hamilton quaternions vs the
//      commutative split algebra C x C), completes to two DIFFERENT lattices. Same pi2 input,
//      different pi2 output => `pi2 . chi = psi . F pi2` is unsatisfiable => NOT a banana split.
//   4. The rank-16 control that PR #15415 asked for and nobody had run: the CD double of the
//      octavian order is E8 (+) E8, which is ALREADY unimodular, so the completion step has
//      nothing to do. The glue-index sequence is 1, 2, 4, 1 -- and the last "1" is it going vacuous.
//   5. Root-system component counts, which is the invariant that makes "the join fuses the
//      generator's output" a measurement rather than a slogan: 4 -> 1, 2 -> 1, then 2 -> 2.
//
// REGISTER (`.claude/rules/toy-is-free-metered-must-be-earned.md`): every number produced here has
// a falsifier in `cd-order-ladder.test.ts`, which runs in CI. Claims in the companion document
// that are NOT computed here are labelled UNVERIFIED there.
//
// Anchors (Beacon): Meijer, Fokkinga & Paterson, "Functional Programming with Bananas, Lenses,
// Envelopes and Barbed Wire", FPCA 1991 (banana split, law 2.10) - Malcolm, "Algebraic Data Types
// and Program Transformation" (1990) and Fokkinga, "Law and Order in Algorithmics" (1992)
// (zygomorphism / mutumorphism) - Hurwitz (1898), normed division algebras - Coxeter, "Integral
// Cayley numbers", Duke Math. J. 13 (1946) - Conway & Smith, "On Quaternions and Octonions" (2003)
// ch. 9-11 - Conway & Sloane, SPLAG ch. 4 (glue theory), ch. 7 - Nikulin (1979), discriminant forms.

// ---------------------------------------------------------------------------------------------
// Exact rationals. BigInt numerator/denominator, always normalised, denominator always positive.
// ---------------------------------------------------------------------------------------------

export interface Rat {
  readonly n: bigint;
  readonly d: bigint;
}

function bgcd(a: bigint, b: bigint): bigint {
  let x = a < 0n ? -a : a;
  let y = b < 0n ? -b : b;
  while (y) {
    const t = x % y;
    x = y;
    y = t;
  }
  return x;
}

export function rat(n: bigint | number, d: bigint | number = 1n): Rat {
  let nn = BigInt(n);
  let dd = BigInt(d);
  if (dd === 0n) throw new Error("rat: zero denominator");
  if (dd < 0n) {
    nn = -nn;
    dd = -dd;
  }
  if (nn === 0n) return { n: 0n, d: 1n };
  const g = bgcd(nn, dd);
  return { n: nn / g, d: dd / g };
}

export const R0 = rat(0);
export const R1 = rat(1);

export const radd = (a: Rat, b: Rat): Rat => rat(a.n * b.d + b.n * a.d, a.d * b.d);
export const rsub = (a: Rat, b: Rat): Rat => rat(a.n * b.d - b.n * a.d, a.d * b.d);
export const rmul = (a: Rat, b: Rat): Rat => rat(a.n * b.n, a.d * b.d);
export const rdiv = (a: Rat, b: Rat): Rat => {
  if (b.n === 0n) throw new Error("rdiv: division by zero");
  return rat(a.n * b.d, a.d * b.n);
};
export const rneg = (a: Rat): Rat => ({ n: -a.n, d: a.d });
export const req = (a: Rat, b: Rat): boolean => a.n === b.n && a.d === b.d;
export const isInt = (a: Rat): boolean => a.d === 1n;
/** Is this rational an even integer? (Evenness of Q is what makes a lattice EVEN.) */
export const isEvenInt = (a: Rat): boolean => a.d === 1n && a.n % 2n === 0n;
export const rstr = (a: Rat): string => (a.d === 1n ? `${a.n}` : `${a.n}/${a.d}`);

export type Vec = readonly Rat[];

export const vadd = (a: Vec, b: Vec): Vec => a.map((x, i) => radd(x, b[i]!));
export const vsub = (a: Vec, b: Vec): Vec => a.map((x, i) => rsub(x, b[i]!));
export const vscale = (s: Rat, a: Vec): Vec => a.map((x) => rmul(s, x));
export const vzero = (n: number): Vec => Array.from({ length: n }, () => R0);
/** Ordinary Euclidean dot product (NOT the lattice form; see `qform` / `bform`). */
export const vdot = (a: Vec, b: Vec): Rat => a.reduce((acc, x, i) => radd(acc, rmul(x, b[i]!)), R0);
export const vkey = (a: Vec): string => a.map(rstr).join(",");

// ---------------------------------------------------------------------------------------------
// The Cayley-Dickson generator. This is the `phi` half of the fold: a total, uniform step that
// reads only the algebra. D(A) = A (+) A with (a,b)(c,d) = (ac - conj(d) b, d a + b conj(c)).
// The tower R, C, H, O, S is D^n(R) -- i.e. an ITERATOR out of N, which is a catamorphism for
// F(X) = 1 + X. Nothing here is a lookup table; the octonion product is derived at every call.
// ---------------------------------------------------------------------------------------------

/** Conjugation on the CD algebra of dimension `a.length` (a power of two). */
export function cdConj(a: Vec): Vec {
  if (a.length === 1) return a;
  return a.map((x, i) => (i === 0 ? x : rneg(x)));
}

/** The Cayley-Dickson product. `sigma = -1` is the classical (division-algebra) branch. */
export function cdMul(a: Vec, b: Vec, sigma: -1 | 1 = -1): Vec {
  const n = a.length;
  if (n !== b.length) throw new Error("cdMul: dimension mismatch");
  if (n === 1) return [rmul(a[0]!, b[0]!)];
  const h = n / 2;
  const p = a.slice(0, h);
  const q = a.slice(h);
  const r = b.slice(0, h);
  const s = b.slice(h);
  const sg = rat(sigma);
  // (p,q)(r,s) = (pr + sigma * conj(s) q ,  s p + q conj(r))
  const left = vadd(cdMul(p, r, sigma), vscale(sg, cdMul(cdConj(s), q, sigma)));
  const right = vadd(cdMul(s, p, sigma), cdMul(q, cdConj(r), sigma));
  return [...left, ...right];
}

/** N(x) = x conj(x) = sum of squares. The composition-algebra norm on R, C, H, O. */
export const cdNorm = (a: Vec): Rat => vdot(a, a);
/** Tr(x) = x + conj(x) = 2 * x_0. */
export const cdTrace = (a: Vec): Rat => radd(a[0]!, a[0]!);

/**
 * Coxeter's integrality criterion for a composition algebra: x satisfies
 * x^2 - Tr(x) x + N(x) = 0, so x is an algebraic integer iff Tr(x) and N(x) are both in Z.
 * This is the definition used for the Hurwitz and Cayley (octavian) integers.
 */
export const cdIsIntegral = (a: Vec): boolean => isInt(cdTrace(a)) && isInt(cdNorm(a));

export const cdBasis = (dim: number): Vec[] =>
  Array.from({ length: dim }, (_, i) => Array.from({ length: dim }, (_, j) => (i === j ? R1 : R0)));

/** Measured, not assumed: does this CD rung commute / associate / alternate? */
export interface AlgebraProfile {
  readonly dim: number;
  readonly commutative: boolean;
  readonly associative: boolean;
  readonly alternative: boolean;
  /** No zero divisors among basis-supported test elements -- a necessary condition for division. */
  readonly normMultiplicative: boolean;
}

/**
 * Test elements: the basis PLUS every sum e_i + e_j.
 *
 * Basis elements alone are a check that cannot fail. On basis vectors N = 1 always, so
 * N(xy) = N(x)N(y) holds in the SEDENIONS too -- which have zero divisors -- and (e_i e_i) e_j
 * agrees with e_i (e_i e_j) there as well. Restricting to basis elements would report the
 * sedenions as a normed alternative algebra, which is false. The sums are what make the test bite;
 * the sedenion zero divisors live on exactly such sums.
 */
function profileTestElements(dim: number): Vec[] {
  const e = cdBasis(dim);
  const out: Vec[] = [...e];
  for (let i = 0; i < dim; i++) for (let j = i + 1; j < dim; j++) out.push(vadd(e[i]!, e[j]!));
  return out;
}

export function profileCdRung(dim: number, sigma: -1 | 1 = -1): AlgebraProfile {
  const t = profileTestElements(dim);
  const e = cdBasis(dim);
  let commutative = true;
  let associative = true;
  let alternative = true;
  let normMultiplicative = true;
  for (const x of t) {
    // Once every property THIS loop can refute has been refuted there is nothing left to learn;
    // stop. `associative` is deliberately NOT part of this test: it is decided by the basis loop
    // below, so it is still `true` here -- including it made the condition unsatisfiable and the
    // shortcut dead code. (Still a performance shortcut only -- it can never turn a `false` into
    // a `true`.)
    if (!commutative && !alternative && !normMultiplicative) break;
    for (const y of t) {
      const xy = cdMul(x, y, sigma);
      if (vkey(xy) !== vkey(cdMul(y, x, sigma))) commutative = false;
      if (!req(cdNorm(xy), rmul(cdNorm(x), cdNorm(y)))) normMultiplicative = false;
      // left alternativity  (xx)y = x(xy)   and   right alternativity  (yx)x = y(xx)
      if (vkey(cdMul(cdMul(x, x, sigma), y, sigma)) !== vkey(cdMul(x, cdMul(x, y, sigma), sigma))) alternative = false;
      if (vkey(cdMul(cdMul(y, x, sigma), x, sigma)) !== vkey(cdMul(y, cdMul(x, x, sigma), sigma))) alternative = false;
    }
  }
  // Associativity on the basis is decisive (it is a trilinear identity), so the cheap loop suffices.
  for (let i = 0; i < dim && associative; i++)
    for (let j = 0; j < dim && associative; j++)
      for (let k = 0; k < dim && associative; k++) {
        const a1 = cdMul(cdMul(e[i]!, e[j]!, sigma), e[k]!, sigma);
        const a2 = cdMul(e[i]!, cdMul(e[j]!, e[k]!, sigma), sigma);
        if (vkey(a1) !== vkey(a2)) associative = false;
      }
  return { dim, commutative, associative, alternative, normMultiplicative };
}

// ---------------------------------------------------------------------------------------------
// Lattices. A lattice is given by a basis of rational vectors in R^n. The quadratic form is the
// EVEN normalisation Q(x) = 2 N(x), so a unit of the order (N = 1) is a ROOT (Q = 2) and the
// Hurwitz order is D4 with min 2, det 4; the octavian order is E8 with min 2, det 1.
// ---------------------------------------------------------------------------------------------

export const qform = (x: Vec): Rat => rmul(rat(2), vdot(x, x));
export const bform = (x: Vec, y: Vec): Rat => rmul(rat(2), vdot(x, y));

export const gram = (basis: readonly Vec[]): Rat[][] => basis.map((u) => basis.map((v) => bform(u, v)));

/** Exact fraction-free determinant (Gaussian elimination over Q; the entries are already exact). */
export function detRat(m: readonly (readonly Rat[])[]): Rat {
  const n = m.length;
  const a = m.map((row) => [...row]);
  let det = R1;
  for (let c = 0; c < n; c++) {
    let p = -1;
    for (let r = c; r < n; r++)
      if (a[r]![c]!.n !== 0n) {
        p = r;
        break;
      }
    if (p < 0) return R0;
    if (p !== c) {
      const t = a[p]!;
      a[p] = a[c]!;
      a[c] = t;
      det = rneg(det);
    }
    const piv = a[c]![c]!;
    det = rmul(det, piv);
    for (let r = c + 1; r < n; r++) {
      const f = rdiv(a[r]![c]!, piv);
      if (f.n === 0n) continue;
      for (let k = c; k < n; k++) a[r]![k] = rsub(a[r]![k]!, rmul(f, a[c]![k]!));
    }
  }
  return det;
}

/**
 * Coordinates of `x` in the given basis, exactly. Throws if `x` is outside the basis's span.
 * (Used both for lattice membership and for computing discriminant-group classes.)
 */
export function coordsInBasis(basis: readonly Vec[], x: Vec): Rat[] {
  const n = basis.length;
  const dim = x.length;
  // Solve  sum_i c_i * basis[i] = x   (an over-determined system when n < dim; we verify at the end).
  const aug: Rat[][] = Array.from({ length: dim }, (_, r) => [...basis.map((b) => b[r]!), x[r]!]);
  const piv: number[] = [];
  let row = 0;
  for (let col = 0; col < n && row < dim; col++) {
    let p = -1;
    for (let r = row; r < dim; r++)
      if (aug[r]![col]!.n !== 0n) {
        p = r;
        break;
      }
    if (p < 0) continue;
    const t = aug[p]!;
    aug[p] = aug[row]!;
    aug[row] = t;
    const pv = aug[row]![col]!;
    for (let k = col; k <= n; k++) aug[row]![k] = rdiv(aug[row]![k]!, pv);
    for (let r = 0; r < dim; r++) {
      if (r === row) continue;
      const f = aug[r]![col]!;
      if (f.n === 0n) continue;
      for (let k = col; k <= n; k++) aug[r]![k] = rsub(aug[r]![k]!, rmul(f, aug[row]![k]!));
    }
    piv.push(col);
    row++;
  }
  const c: Rat[] = Array.from({ length: n }, () => R0);
  piv.forEach((col, i) => {
    c[col] = aug[i]![n]!;
  });
  for (let r = row; r < dim; r++) if (aug[r]![n]!.n !== 0n) throw new Error("coordsInBasis: not in span");
  return c;
}

export const inLattice = (basis: readonly Vec[], x: Vec): boolean => {
  try {
    return coordsInBasis(basis, x).every(isInt);
  } catch {
    return false;
  }
};

/**
 * A reusable membership test for one fixed basis. `coordsInBasis` re-runs Gaussian elimination on
 * every call, which dominates the root search; this factors the elimination out by inverting the
 * basis once. Same answers, same exact arithmetic -- the test suite checks the two agree.
 */
export function membershipTester(basis: readonly Vec[]): (x: Vec) => boolean {
  const n = basis.length;
  const dim = basis[0]!.length;
  // Row-reduce [B^T | I] where B^T has the basis vectors as COLUMNS, keeping track of a left
  // inverse on the pivot rows; for our square-or-thin cases this yields coordinates directly.
  const rows: Rat[][] = Array.from({ length: dim }, (_, r) => [
    ...basis.map((b) => b[r]!),
    ...Array.from({ length: dim }, (_, k) => (k === r ? R1 : R0)),
  ]);
  const pivotCols: number[] = [];
  let row = 0;
  for (let col = 0; col < n && row < dim; col++) {
    let p = -1;
    for (let r = row; r < dim; r++)
      if (rows[r]![col]!.n !== 0n) {
        p = r;
        break;
      }
    if (p < 0) continue;
    const t = rows[p]!;
    rows[p] = rows[row]!;
    rows[row] = t;
    const pv = rows[row]![col]!;
    for (let k = 0; k < n + dim; k++) rows[row]![k] = rdiv(rows[row]![k]!, pv);
    for (let r = 0; r < dim; r++) {
      if (r === row) continue;
      const f = rows[r]![col]!;
      if (f.n === 0n) continue;
      for (let k = 0; k < n + dim; k++) rows[r]![k] = rsub(rows[r]![k]!, rmul(f, rows[row]![k]!));
    }
    pivotCols.push(col);
    row++;
  }
  if (pivotCols.length !== n) throw new Error("membershipTester: basis is not independent");
  const solveRows = rows.slice(0, n).map((r) => r.slice(n));
  const nullRows = rows.slice(n).map((r) => r.slice(n));
  return (x: Vec): boolean => {
    // Outside the span?
    for (const nr of nullRows) {
      let acc = R0;
      for (let k = 0; k < dim; k++) if (nr[k]!.n !== 0n) acc = radd(acc, rmul(nr[k]!, x[k]!));
      if (acc.n !== 0n) return false;
    }
    for (const sr of solveRows) {
      let acc = R0;
      for (let k = 0; k < dim; k++) if (sr[k]!.n !== 0n) acc = radd(acc, rmul(sr[k]!, x[k]!));
      if (!isInt(acc)) return false;
    }
    return true;
  };
}

// ---------------------------------------------------------------------------------------------
// THE COMPLETION STEP ("take a maximal order"), computed.
//
// An integral overlattice L' of L satisfies L subset L' subset L*, so it is determined by an
// isotropic subgroup of the discriminant group L-star / L. All the discriminant groups on this ladder
// are 2-elementary (verified at call time), so 2 L* subset L and every coset of L-star / L has a
// representative (1/2) * sum(c_i b_i) with c in {0,1}^n. That makes the enumeration finite and
// exhaustive -- this routine does not sample, it decides.
// ---------------------------------------------------------------------------------------------

export interface GlueClass {
  /** A representative vector of the coset, in ambient coordinates. */
  readonly rep: Vec;
  /** The class as an F2 vector: (2 * coords mod 2) in the L-basis. Identifies the coset. */
  readonly tag: string;
  /** Q of the representative. Well-defined mod 2Z on the coset when L is even. */
  readonly q: Rat;
}

/** Every coset of L-star / L, assuming (and CHECKING) that the discriminant group is 2-elementary. */
export function discriminantClasses(basis: readonly Vec[]): GlueClass[] {
  const n = basis.length;
  if (n > 12) throw new Error("discriminantClasses: rank too large for exhaustive 2-elementary scan");
  const half = rat(1, 2);
  const out: GlueClass[] = [];
  const seen = new Set<string>();
  for (let mask = 0; mask < 1 << n; mask++) {
    let v: Vec = vzero(basis[0]!.length);
    for (let i = 0; i < n; i++) if (mask & (1 << i)) v = vadd(v, vscale(half, basis[i]!));
    // In L* iff <v, b_j> is an integer for every basis vector b_j.
    if (!basis.every((b) => isInt(bform(v, b)))) continue;
    const tag = Array.from({ length: n }, (_, i) => ((mask >> i) & 1).toString()).join("");
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push({ rep: v, tag, q: qform(v) });
  }
  return out;
}

export interface Overlattice {
  /** Generators of the glue subgroup (excluding 0). */
  readonly glue: readonly GlueClass[];
  /** |L'/L|. */
  readonly index: number;
  /** det of the Gram of L'. */
  readonly det: Rat;
  /** Is every element integral in the ambient composition algebra (Tr, N in Z)? */
  readonly allIntegral: boolean;
  /** Is L' closed under the ambient product? (i.e. is it a RING, hence an order) */
  readonly multiplicativelyClosed: boolean;
  /** A basis of L'. */
  readonly basis: readonly Vec[];
}

const babs = (x: bigint): bigint => (x < 0n ? -x : x);

/**
 * Basis for L' = L + <glue reps>, by integer Hermite normal form.
 *
 * The work is done in L-COORDINATES, where L is Z^n and every glue vector lies in (1/2) Z^n.
 * Doubling the coordinates gives an integer module M with 2 Z^n subset M subset Z^n; HNF of the
 * generating set is a basis of M, and halving maps it back to a basis of L'. Exact, and it does
 * not care about the ambient dimension.
 */
function overlatticeBasis(base: readonly Vec[], glue: readonly Vec[]): Vec[] {
  const n = base.length;
  const rows: bigint[][] = [];
  for (let i = 0; i < n; i++) rows.push(Array.from({ length: n }, (_, j) => (i === j ? 2n : 0n)));
  for (const g of glue) {
    const c = coordsInBasis(base, g);
    rows.push(
      c.map((x) => {
        const doubled = rmul(rat(2), x);
        if (!isInt(doubled)) throw new Error("overlatticeBasis: glue class is not 2-elementary");
        return doubled.n;
      }),
    );
  }
  let r = 0;
  for (let c = 0; c < n && r < rows.length; c++) {
    for (;;) {
      let piv = -1;
      for (let i = r; i < rows.length; i++)
        if (rows[i]![c] !== 0n && (piv < 0 || babs(rows[i]![c]!) < babs(rows[piv]![c]!))) piv = i;
      if (piv < 0) break;
      const t = rows[piv]!;
      rows[piv] = rows[r]!;
      rows[r] = t;
      let cleared = true;
      for (let i = r + 1; i < rows.length; i++) {
        if (rows[i]![c] === 0n) continue;
        const q = rows[i]![c]! / rows[r]![c]!;
        for (let k = c; k < n; k++) rows[i]![k] = rows[i]![k]! - q * rows[r]![k]!;
        if (rows[i]![c] !== 0n) cleared = false;
      }
      if (cleared) break;
    }
    if (rows[r] && rows[r]![c] !== 0n) r++;
  }
  const bas = rows.filter((row) => row.some((x) => x !== 0n)).slice(0, n);
  if (bas.length !== n) throw new Error("overlatticeBasis: rank collapsed");
  const half = rat(1, 2);
  return bas.map((row) => {
    let v: Vec = vzero(base[0]!.length);
    row.forEach((coef, i) => {
      if (coef !== 0n) v = vadd(v, vscale(rmul(half, rat(coef)), base[i]!));
    });
    return v;
  });
}

/**
 * Every integral overlattice of `base` inside the ambient algebra, with the ring test applied.
 * `sigma` selects the CD branch; `extraGens` are additional module generators (unused on the
 * classical ladder but kept so a caller can test a non-CD ambient).
 */
export function integralOverlattices(
  base: readonly Vec[],
  sigma: -1 | 1 = -1,
  mul: (a: Vec, b: Vec) => Vec = (a, b) => cdMul(a, b, sigma),
  isIntegral: (x: Vec) => boolean = cdIsIntegral,
): Overlattice[] {
  const classes = discriminantClasses(base);
  const nonzero = classes.filter((c) => c.tag.includes("1"));
  const n = base.length;

  // Enumerate every subgroup of the (elementary abelian) discriminant group by closing subsets.
  const byTag = new Map(classes.map((c) => [c.tag, c]));
  const addTags = (a: string, b: string): string =>
    Array.from({ length: n }, (_, i) => ((a[i] === "1" ? 1 : 0) ^ (b[i] === "1" ? 1 : 0) ? "1" : "0")).join("");
  const zeroTag = "0".repeat(n);

  const subgroups = new Map<string, GlueClass[]>();
  const record = (members: Set<string>): void => {
    const key = [...members].sort(ordinalCompare).join("|");
    if (subgroups.has(key)) return;
    subgroups.set(
      key,
      [...members].filter((t) => t !== zeroTag).map((t) => byTag.get(t)!),
    );
  };
  record(new Set([zeroTag]));
  // Close under addition starting from every subset of the nonzero classes (the groups here are
  // tiny -- order 16 at most -- so this is exhaustive, not heuristic).
  const gens = nonzero.map((c) => c.tag);
  const limit = 1 << gens.length;
  if (gens.length > 16) throw new Error("integralOverlattices: discriminant group too large");
  for (let mask = 1; mask < limit; mask++) {
    const members = new Set<string>([zeroTag]);
    for (let i = 0; i < gens.length; i++) if (mask & (1 << i)) members.add(gens[i]!);
    let grew = true;
    while (grew) {
      grew = false;
      for (const a of [...members])
        for (const b of [...members]) {
          const s = addTags(a, b);
          if (!byTag.has(s)) {
            members.clear();
            break;
          }
          if (!members.has(s)) {
            members.add(s);
            grew = true;
          }
        }
      if (members.size === 0) break;
    }
    if (members.size === 0) continue;
    record(members);
  }

  const out: Overlattice[] = [];
  for (const glue of subgroups.values()) {
    const b = overlatticeBasis(
      base,
      glue.map((g) => g.rep),
    );
    const g = gram(b);
    const det = detRat(g);
    // Integral (even) lattice test on a spanning set: Q even on generators and B integral on pairs.
    const span = [...base, ...glue.map((x) => x.rep)];
    const evenIntegral =
      span.every((v) => isEvenInt(qform(v))) && span.every((u) => span.every((v) => isInt(bform(u, v))));
    const allIntegral = span.every(isIntegral);
    let closed = true;
    for (const u of span) {
      for (const v of span) {
        if (!inLattice(b, mul(u, v))) {
          closed = false;
          break;
        }
      }
      if (!closed) break;
    }
    if (!evenIntegral) continue;
    // The discriminant group is elementary abelian, so |L'/L| = |subgroup| = (#nonzero) + 1.
    const index = glue.length + 1;
    // Cross-check against the determinant: det(L) = index^2 * det(L'). A mismatch means the
    // basis construction is wrong, so this assertion is a real guard, not decoration.
    if (!req(detRat(gram(base)), rmul(rat(index * index), det)))
      throw new Error(`integralOverlattices: index ${index} disagrees with det ratio`);
    out.push({ glue, index, det, allIntegral, multiplicativelyClosed: closed, basis: b });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------
// Roots and root-system components. This is the invariant that turns "the join FUSES what the
// generator produced" into a measurement: an orthogonal direct sum has >= 2 components; gluing
// is what can merge them into one.
// ---------------------------------------------------------------------------------------------

/**
 * All lattice vectors with Q = 2 (equivalently N = 1: the units of the order).
 * `denom` is a common denominator for the lattice's coordinates -- every vector of the lattice
 * lies in (1/denom) Z^dim -- so roots are found by an exhaustive DFS over integer vectors u with
 * sum(u_i^2) = denom^2, then filtered by lattice membership. Exhaustive, with pruning.
 */
export function roots(basis: readonly Vec[], denom: number): Vec[] {
  const dim = basis[0]!.length;
  const target = denom * denom; // N(x) = 1  <=>  sum((denom * x_i)^2) = denom^2
  const found: Vec[] = [];
  const member = membershipTester(basis);
  const u: number[] = Array.from({ length: dim }, () => 0);
  const dfs = (i: number, remaining: number): void => {
    if (i === dim) {
      if (remaining !== 0) return;
      const v: Vec = u.map((x) => rat(x, denom));
      if (member(v)) found.push(v);
      return;
    }
    const bound = Math.floor(Math.sqrt(remaining));
    for (let k = -bound; k <= bound; k++) {
      u[i] = k;
      dfs(i + 1, remaining - k * k);
    }
    u[i] = 0;
  };
  dfs(0, target);
  return found;
}

/** Number of connected components of the root system (edges = non-orthogonal pairs). */
export function rootComponents(rs: readonly Vec[]): number {
  const n = rs.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r]!;
    while (parent[x] !== r) {
      const nx = parent[x]!;
      parent[x] = r;
      x = nx;
    }
    return r;
  };
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (bform(rs[i]!, rs[j]!).n !== 0n) union(i, j);
  return new Set(Array.from({ length: n }, (_, i) => find(i))).size;
}

// ---------------------------------------------------------------------------------------------
// The named orders on the ladder, each CONSTRUCTED (never tabulated).
// ---------------------------------------------------------------------------------------------

const e = (dim: number, i: number): Vec => cdBasis(dim)[i]!;

/** Z[i] inside C. */
export const gaussianOrder = (): Vec[] => [e(2, 0), e(2, 1)];

/** The Lipschitz order = the Cayley-Dickson double of Z[i], as a subset of H. */
export const lipschitzOrder = (): Vec[] => cdBasis(4);

/** The Hurwitz order: Lipschitz plus the half-unit omega = (1 + i + j + k)/2. */
export const hurwitzOrder = (): Vec[] => {
  const half = rat(1, 2);
  return [e(4, 0), e(4, 1), e(4, 2), [half, half, half, half]];
};

/** Embed a rank-`m` order into the first / second half of the CD double (dimension 2m). */
export const embedLow = (b: readonly Vec[], dim: number): Vec[] => b.map((v) => [...v, ...vzero(dim - v.length)]);
export const embedHigh = (b: readonly Vec[], dim: number): Vec[] => b.map((v) => [...vzero(dim - v.length), ...v]);

/** D(order) as a LATTICE: the orthogonal direct sum order (+) order*l inside the doubled algebra. */
export function cdDoubleOrder(b: readonly Vec[]): Vec[] {
  const m = b[0]!.length;
  return [...embedLow(b, 2 * m), ...embedHigh(b, 2 * m)];
}

// ---------------------------------------------------------------------------------------------
// The SPLIT-CONDITION falsifier: the same Z-module with the same quadratic form in two ambient
// algebras. `C x C` is the commutative split algebra R[x,y]/(x^2+1, y^2+1); its integral elements
// are exactly Z[i] x Z[i], so Z^4 is ALREADY maximal there. Inside H the same Z^4 is the Lipschitz
// order and is NOT maximal. Same pi2, different successor.
// ---------------------------------------------------------------------------------------------

/** Multiplication on C x C in the basis (1,0), (i,0), (0,1), (0,i). */
export function splitCCMul(a: Vec, b: Vec): Vec {
  const [a0, a1, a2, a3] = [a[0]!, a[1]!, a[2]!, a[3]!];
  const [b0, b1, b2, b3] = [b[0]!, b[1]!, b[2]!, b[3]!];
  return [
    rsub(rmul(a0, b0), rmul(a1, b1)),
    radd(rmul(a0, b1), rmul(a1, b0)),
    rsub(rmul(a2, b2), rmul(a3, b3)),
    radd(rmul(a2, b3), rmul(a3, b2)),
  ];
}

/** x = (z, w) in C x C is an algebraic integer iff each component is a Gaussian integer. */
export const splitCCIsIntegral = (x: Vec): boolean => {
  const trZ = radd(x[0]!, x[0]!);
  const nZ = radd(rmul(x[0]!, x[0]!), rmul(x[1]!, x[1]!));
  const trW = radd(x[2]!, x[2]!);
  const nW = radd(rmul(x[2]!, x[2]!), rmul(x[3]!, x[3]!));
  return isInt(trZ) && isInt(nZ) && isInt(trW) && isInt(nW);
};

// ---------------------------------------------------------------------------------------------
// The rank-16 control (PR #15415's unrun experiment). Both even unimodular rank-16 lattices have
// 480 roots -- the count does not discriminate -- so they are separated by root-system CONNECTIVITY.
// ---------------------------------------------------------------------------------------------

/** D16+ = D16 union (D16 + s), s = (1/2)^16, in the standard normalisation Q(x) = sum x_i^2. */
export function d16PlusRoots(): number[][] {
  const rs: number[][] = [];
  for (let i = 0; i < 16; i++)
    for (let j = i + 1; j < 16; j++)
      for (const si of [1, -1])
        for (const sj of [1, -1]) {
          const v = Array.from({ length: 16 }, () => 0);
          v[i] = si;
          v[j] = sj;
          rs.push(v);
        }
  return rs; // the half-vector s has Q = 4, so D16+ contributes no roots beyond D16's.
}

/** E8 (+) E8 roots in the standard normalisation, as integer vectors doubled (so half-ints are ints). */
export function e8PlusE8RootsDoubled(): number[][] {
  const e8: number[][] = [];
  // integer roots: +-e_i +-e_j  (doubled => entries +-2)
  for (let i = 0; i < 8; i++)
    for (let j = i + 1; j < 8; j++)
      for (const si of [2, -2])
        for (const sj of [2, -2]) {
          const v = Array.from({ length: 8 }, () => 0);
          v[i] = si;
          v[j] = sj;
          e8.push(v);
        }
  // half roots: (+-1/2)^8 with an even number of minus signs (doubled => entries +-1)
  for (let m = 0; m < 256; m++) {
    let neg = 0;
    const v = Array.from({ length: 8 }, (_, i) => {
      const s = (m >> i) & 1 ? -1 : 1;
      if (s < 0) neg++;
      return s;
    });
    if (neg % 2 === 0) e8.push(v);
  }
  const out: number[][] = [];
  for (const v of e8) out.push([...v, ...Array.from({ length: 8 }, () => 0)]);
  for (const v of e8) out.push([...Array.from({ length: 8 }, () => 0), ...v]);
  return out;
}

export function componentsOfIntegerRoots(rs: readonly number[][]): number {
  const n = rs.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r]!;
    return r;
  };
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++) {
      let d = 0;
      for (let k = 0; k < rs[i]!.length; k++) d += rs[i]![k]! * rs[j]![k]!;
      if (d !== 0) {
        const a = find(i);
        const b = find(j);
        if (a !== b) parent[a] = b;
      }
    }
  return new Set(Array.from({ length: n }, (_, i) => find(i))).size;
}

// ---------------------------------------------------------------------------------------------
// The ladder, assembled: one row per rung, every field measured.
// ---------------------------------------------------------------------------------------------

export interface Rung {
  readonly name: string;
  readonly rank: number;
  /** det of the generator's raw output (the CD double), before any completion. */
  readonly generatedDet: Rat;
  readonly generatedRoots: number;
  readonly generatedComponents: number;
  /** How many maximal integral ORDERS contain the generated lattice. */
  readonly maximalOrderCount: number;
  /** [L' : L] for the chosen completion. 1 means the completion step did NOTHING. */
  readonly glueIndex: number;
  readonly completedDet: Rat;
  readonly completedRoots: number;
  readonly completedComponents: number;
}

export function ladderRung(name: string, generated: readonly Vec[], denom: number): Rung {
  const overs = integralOverlattices(generated);
  const orders = overs.filter((o) => o.multiplicativelyClosed && o.allIntegral);
  // maximal = not properly contained in another order on the list
  const maximal = orders.filter(
    (o) => !orders.some((p) => p !== o && p.index > o.index && o.basis.every((v) => inLattice(p.basis, v))),
  );
  const best = maximal.reduce((a, b) => (b.index > a.index ? b : a), orders[0]!);
  const genRoots = roots(generated, denom);
  const compRoots = roots(best.basis, denom);
  return {
    name,
    rank: generated.length,
    generatedDet: detRat(gram(generated)),
    generatedRoots: genRoots.length,
    generatedComponents: rootComponents(genRoots),
    maximalOrderCount: maximal.length,
    glueIndex: best.index,
    completedDet: detRat(gram(best.basis)),
    completedRoots: compRoots.length,
    completedComponents: rootComponents(compRoots),
  };
}

// ---------------------------------------------------------------------------------------------
// WHY there are exactly three completions at the octonion rung, and what permutes them.
//
// D4's discriminant group is (Z/2)^2 with three nonzero classes (vector, spinor, cospinor), all of
// norm 1 mod 2Z. Gluing two copies to something unimodular therefore requires an ISOMORPHISM
// between the two discriminant groups, and there are |GL_2(F_2)| = |S_3| = 6 of them. Six gluings,
// all giving E8 as a lattice. The octonion product then cuts six to three -- and the invariant
// that decides which three is the PARITY of the induced permutation, which is computed here rather
// than asserted. (This is D4 TRIALITY, not the associativity boundary: it is a property of the
// discriminant form of D4, and it would be there whether or not the ambient algebra associated.)
// ---------------------------------------------------------------------------------------------

/** Split a rank-8 glue tag into (first-D4 part, second-D4 part). */
function splitTag(tag: string): [string, string] {
  const h = tag.length / 2;
  return [tag.slice(0, h), tag.slice(h)];
}

export interface GlueSignature {
  /** The induced bijection {A,B,C} -> {A',B',C'}, written as the image word. */
  readonly permutation: string;
  /** Parity of that permutation: 'even' (identity or 3-cycle) or 'odd' (transposition). */
  readonly parity: "even" | "odd";
}

/**
 * The permutation of D4 discriminant classes carried by a unimodular gluing of D4 (+) D4.
 * Returns null when the overlattice is not one of the index-4 unimodular ones.
 */
export function glueSignature(o: Overlattice): GlueSignature | null {
  if (o.index !== 4 || o.glue.length !== 3) return null;
  const order = ["1100", "1010", "0110"]; // A, B, C in the D4 discriminant group
  const image: number[] = [-1, -1, -1];
  for (const g of o.glue) {
    const [lo, hi] = splitTag(g.tag);
    const i = order.indexOf(lo);
    const j = order.indexOf(hi);
    if (i < 0 || j < 0) return null;
    image[i] = j;
  }
  if (image.some((x) => x < 0)) return null;
  // parity by counting inversions
  let inv = 0;
  for (let i = 0; i < 3; i++) for (let j = i + 1; j < 3; j++) if (image[i]! > image[j]!) inv++;
  return {
    permutation: image.map((x) => "ABC"[x]!).join(""),
    parity: inv % 2 === 0 ? "even" : "odd",
  };
}

/**
 * Conjugation by a unit `u` of the Hurwitz order, extended to the Cayley-Dickson double.
 *
 * If psi is a *-automorphism of A then (a,b) |-> (psi a, psi b) is an automorphism of D(A),
 * because the CD formula uses only multiplication and conjugation. Taking u = omega cycles
 * i -> j -> k -> i, which is what exhibits the three completions as a single orbit: there is no
 * automorphism-invariant way to pick one, hence NO NATURAL choice, hence no natural transformation
 * `?` making the doubling square commute at the lattice level.
 */
export function conjugationAutomorphism(u: Vec): (v: Vec) => Vec {
  const uInv = cdConj(u); // valid when N(u) = 1
  if (!req(cdNorm(u), R1)) throw new Error("conjugationAutomorphism: u must be a unit");
  const half = (x: Vec): Vec => cdMul(cdMul(u, x), uInv);
  return (v: Vec): Vec => {
    const m = v.length / 2;
    return [...half(v.slice(0, m)), ...half(v.slice(m))];
  };
}

/**
 * Ordinal (code-unit) string comparison.
 *
 * NOT `localeCompare`, which is culture-SENSITIVE and forbidden by
 * `.claude/rules/culture-invariant-by-default.md` — the repo's `hygiene:no-culture-sensitive-collation`
 * lint caught exactly that call here on the first CI run of this file. The ordering below is the
 * one the rule prescribes, and for the ASCII `0`/`1` tags in use it is codepoint order.
 */
function ordinalCompare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The glue subgroup's tags, sorted ordinally and joined — a stable key for one overlattice. */
const glueKey = (o: Overlattice): string =>
  o.glue
    .map((g) => g.tag)
    .sort(ordinalCompare)
    .join("|");

/**
 * Every integral overlattice of D(Hurwitz), computed ONCE.
 *
 * The enumeration is exhaustive over the discriminant group with exact BigInt rationals and costs
 * several seconds; it is a pure function of no arguments, so recomputing it per caller is pure
 * waste. It was, and it is what reddened the hermetic tier: four tests each paid the full cost and
 * landed at 5.7-7.1s against bunfig's documented 5000ms per-test cap. Per that file's own rule --
 * "a test that is slow BY ACCIDENT gets made fast" -- the repeated work is cached here, and the
 * genuinely-slow-by-nature cases carry explicit per-test timeouts in the suite.
 *
 * The cache is safe because the computation is deterministic and argument-free (no ambient input,
 * no clock, no environment); a shallow copy is returned so a caller sorting or splicing the result
 * cannot corrupt it for the next one.
 */
let doubledHurwitzOverlatticesCache: Overlattice[] | null = null;

export function doubledHurwitzOverlattices(): Overlattice[] {
  doubledHurwitzOverlatticesCache ??= integralOverlattices(cdDoubleOrder(hurwitzOrder()));
  return [...doubledHurwitzOverlatticesCache];
}

/** The three ring-completions of D(Hurwitz), in a fixed, ordinal order of their glue tags. */
export function octavianCompletions(): Overlattice[] {
  return doubledHurwitzOverlattices()
    .filter((o) => o.index === 4 && o.multiplicativelyClosed && o.allIntegral)
    .sort((a, b) => ordinalCompare(glueKey(a), glueKey(b)));
}

/** Do two bases generate the same lattice? */
export const sameLattice = (a: readonly Vec[], b: readonly Vec[]): boolean =>
  a.every((v) => inLattice(b, v)) && b.every((v) => inLattice(a, v));

// ---------------------------------------------------------------------------------------------
// CONVENTION INDEPENDENCE. The count "three completions" would be worthless if it were an artefact
// of one Cayley-Dickson sign convention, so a second, genuinely different convention is provided
// and the count is re-run against it. (Baez, "The Octonions", Bull. AMS 39 (2002), §2 gives
// (a,b)(c,d) = (ac - d b*, a* d + c b); the module's default is the Conway-Smith-style
// (a,b)(c,d) = (ac - d* b, d a + b c*). They are different products, not a relabelling.)
// ---------------------------------------------------------------------------------------------

/** Baez's Cayley-Dickson convention: (a,b)(c,d) = (ac - d b*, a* d + c b). */
export function cdMulBaez(a: Vec, b: Vec): Vec {
  const n = a.length;
  if (n === 1) return [rmul(a[0]!, b[0]!)];
  const h = n / 2;
  const p = a.slice(0, h);
  const q = a.slice(h);
  const r = b.slice(0, h);
  const s = b.slice(h);
  const left = vsub(cdMulBaez(p, r), cdMulBaez(s, cdConj(q)));
  const right = vadd(cdMulBaez(cdConj(p), s), cdMulBaez(r, q));
  return [...left, ...right];
}

/** How many multiplicatively-closed unimodular completions does a given product admit? */
export function completionCount(mul: (a: Vec, b: Vec) => Vec): number {
  const dh = cdDoubleOrder(hurwitzOrder());
  return integralOverlattices(dh, -1, mul).filter((o) => o.index === 4 && o.multiplicativelyClosed && o.allIntegral)
    .length;
}
