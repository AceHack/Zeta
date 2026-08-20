/**
 * campbell-cone-vs-simplex-belief-fold-check.ts -- does the monotonicity claim on our belief fold
 * survive on the CONE, or does it require the normalization quotient? (Soraya 2026-08-20)
 *
 * ROUTED FROM: PR #12809 monotone-metric-cencov-petz-check.ts (Lumen), whose A4/A4x established
 * that on unnormalized measures Campbell (1986) admits g_Fisher + c*(mass) for every c >= 0, and
 * that the freedom vanishes on the simplex. The handed-over question was whether that freedom
 * touches src/Core/BeliefConvergence.fs, which folds UNNORMALIZED int64[] weights.
 *
 * WHAT THE CLAIM ACTUALLY IS (found, not invented). BeliefConvergence.fs makes NO metric claim.
 * The claim lives in exactly three prose surfaces, all downstream of one sentence:
 *   - docs/research/2026-08-18-falsifier-1-fails-no-levi-civita-analogue-*.md section 1
 *   - docs/FROZEN-CORE-AND-CONJECTURE-REGISTER.md section B-torsion, item 1
 *   - the header of src/Core.TypeScript/research/information-geometry-contortion-falsifier.ts
 * each saying: the manifold of the fold is the categorical exponential family, Fisher-Rao is its
 * metric, and the Cencov theorem makes that metric essentially unique. The word "monotone" never
 * appears; "invariant under sufficient statistics" is the same theorem under its older name.
 *
 * WHAT THIS FILE CHECKS. Six paired checks. Every positive assertion is paired with a negative
 * computed by the SAME function, so nothing can pass by being vacuous.
 *
 *   D1  Fisher-Rao is monotone on the CONE (genuinely unnormalized p), not only on the simplex.
 *       negative: Euclidean, same scan, same morphisms, expands.
 *   D2  The mass term is EXACTLY invariant on the cone -- so c is a free parameter there.
 *       negative: the same term is identically zero on zero-sum tangents, so after the quotient c
 *       is UNOBSERVABLE. That is why nobody would notice choosing it.
 *   D3  Every c >= 0 is monotone and positive definite; the admissible range is c > -1, and the
 *       endpoint c = -1 degenerates EXACTLY on the radial direction v proportional to p.
 *       negative: c = -1.5 admits a tangent of negative squared length. That endpoint IS the
 *       normalization quotient, computed rather than asserted.
 *   D4  A choice of c CHANGES WHICH BELIEF IS CLOSER. Random tangent pairs on the cone are
 *       order-flippable by some c >= 0 at a measurable rate, crossing c* solved and verified.
 *       negative: the same scan on zero-sum (normalized) tangents flips zero pairs.
 *   D5  What "invariant under sufficient statistics" means FOR THE FOLD: coarse-graining commutes
 *       with observe exactly (int64, BigInt here) iff the likelihood is block-constant.
 *       negative: a non-block-constant likelihood, exact integer counterexample.
 *   D6  The geometry numbers quoted in FROZEN-CORE section B-torsion MOVE with c on the cone.
 *       negative: the antisymmetric part stays exactly zero for every c, so the "contortion is
 *       identically zero" REFUTATION survives the c-freedom even though the magnitude does not.
 *       Closed-form Christoffels cross-checked against central differences of the metric.
 *
 * THE GEOMETRY, STATED ONCE. On the cone C = R^n_{>0} of positive measures, in the log-weight
 * chart theta_i = log p_i -- the chart in which observe is exactly translation, with no quotient
 * needed, unlike the reduced softmax chart the contortion falsifier uses -- the Campbell family is
 *
 *     g^(c)_p(u,v) = sum_i u_i v_i / p_i  +  c * (sum u)(sum v) / (sum p)
 *
 * and in theta-coordinates that is  G^(c)_ij = delta_ij p_i + c p_i p_j / S,  S = sum p.
 * Cauchy-Schwarz gives (sum v)^2 <= S * sum v_i^2/p_i with equality iff v is proportional to p, so
 * the family is positive definite for c > -1 and degenerates at c = -1 exactly along the scaling
 * direction. Quotienting that direction out IS normalization.
 *
 * HONEST LIMIT, stated before the numbers. The Campbell theorem allows both coefficients to be
 * functions of the total mass; only the constant-coefficient sub-family is checked here, and
 * uniqueness itself (that nothing outside the family is invariant) is the Campbell proof, cited
 * and not checked -- the same limit A1-A4 carries in #12809. Nothing here is a metric
 * implementation, and nothing here should be cited as "our metric".
 *
 * REGISTER: the mathematics is CHECKED. Every mapping onto our substrate stays a toy under
 * .claude/rules/toy-is-free-metered-must-be-earned.md.
 *
 * ANCHORS. Rao (1945) -- the Fisher metric as a Riemannian metric. Cencov/Chentsov, Statistical
 * Decision Rules and Optimal Inference, AMS Transl. Math. Monographs 53 (1982) -- uniqueness up to
 * scale on the SIMPLEX. Campbell, An extended Cencov characterisation of the information metric,
 * Proc. AMS 98 (1986) 135-141 -- the cone, and the extra invariant. Amari and Nagaoka, Methods of
 * Information Geometry (2000) -- alpha-connections. Fisher (1922) -- sufficient statistics, which
 * is what D5 tests in the exact algebra the fold runs.
 *
 * Run:  bun src/Core.TypeScript/research/campbell-cone-vs-simplex-belief-fold-check.ts
 */

export type Vec = readonly number[];
/** Column-stochastic Markov morphism: T[j][i] = P(out = j | in = i), every COLUMN sums to 1. */
export type Markov = readonly (readonly number[])[];

function el(a: Vec, i: number): number {
  return a[i] ?? 0;
}

/** mulberry32 -- deterministic PRNG seeded from the common seed S = 4 (DST: same numbers always). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pushforward(t: Markov, x: Vec): number[] {
  return t.map((row) => row.reduce((s, tji, i) => s + tji * el(x, i), 0));
}

/** Fisher-Rao quadratic form, valid on the whole cone: sum v_i^2 / p_i. */
export function fisherQuad(p: Vec, v: Vec): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) s += (el(v, i) * el(v, i)) / el(p, i);
  return s;
}

/** The Campbell invariant on the cone: (sum v)^2 / (sum p). Identically 0 on the simplex. */
export function massQuad(p: Vec, v: Vec): number {
  let sv = 0;
  let sp = 0;
  for (const x of v) sv += x;
  for (const x of p) sp += x;
  return (sv * sv) / sp;
}

/** The Campbell member indexed by c. c = 0 is Fisher-Rao; c = -1 is the degenerate quotient map. */
export function campbellQuad(c: number): (p: Vec, v: Vec) => number {
  return (p, v) => fisherQuad(p, v) + c * massQuad(p, v);
}

export function euclidQuad(_p: Vec, v: Vec): number {
  let s = 0;
  for (const x of v) s += x * x;
  return s;
}

/** A genuinely UNNORMALIZED positive measure: total mass drawn in [0.2, 20]. */
function randCone(rng: () => number, n: number): number[] {
  const v = Array.from({ length: n }, () => -Math.log(1 - rng()) + 1e-3);
  const z = v.reduce((a, b) => a + b, 0);
  const mass = 0.2 + 19.8 * rng();
  return v.map((x) => (mass * x) / z);
}

function randMarkov(rng: () => number, n: number, m: number): number[][] {
  const cols = Array.from({ length: n }, () => {
    const v = Array.from({ length: m }, () => -Math.log(1 - rng()) + 1e-3);
    const z = v.reduce((a, b) => a + b, 0);
    return v.map((x) => x / z);
  });
  return Array.from({ length: m }, (_, j) => Array.from({ length: n }, (_, i) => el(cols[i] ?? [], j)));
}

function randTangent(rng: () => number, n: number, zeroSum: boolean): number[] {
  const v = Array.from({ length: n }, () => rng() * 2 - 1);
  if (!zeroSum) return v;
  const mean = v.reduce((a, b) => a + b, 0) / n;
  return v.map((x) => x - mean);
}

export interface ScanReport {
  readonly trials: number;
  readonly violations: number;
  readonly worstRatio: number;
}

/**
 * Worst expansion ratio g_{Tp}(Tv,Tv) / g_p(v,v) over random (p, v, T) on the CONE.
 * Monotone <=> worstRatio <= 1. Here p is unnormalized, which is the whole point.
 */
export function coneMonotonicityScan(
  quad: (p: Vec, v: Vec) => number,
  opts: {
    readonly trials: number;
    readonly seed: number;
    readonly n: number;
    readonly m: number;
    readonly zeroSum: boolean;
  },
): ScanReport {
  const rng = mulberry32(opts.seed);
  let violations = 0;
  let worst = 0;
  for (let k = 0; k < opts.trials; k++) {
    const p = randCone(rng, opts.n);
    const v = randTangent(rng, opts.n, opts.zeroSum);
    const t = randMarkov(rng, opts.n, opts.m);
    const before = quad(p, v);
    const after = quad(pushforward(t, p), pushforward(t, v));
    const ratio = before === 0 ? 0 : after / before;
    if (ratio > 1 + 1e-9) violations++;
    if (ratio > worst) worst = ratio;
  }
  return { trials: opts.trials, violations, worstRatio: worst };
}

export interface FlipReport {
  readonly pairs: number;
  readonly flippable: number;
  readonly medianCrossing: number;
}

/**
 * For tangents u, v at p the order of g^(c)(u,u) vs g^(c)(v,v) flips at
 *   cStar = (F_u - F_v) / (M_v - M_u)
 * where F is the Fisher part and M the mass part. Returns the crossing, or -1 when no
 * non-negative c reorders them. cStar is solved and then VERIFIED by evaluating both forms on
 * either side of it, so the sign change is measured rather than assumed.
 */
export function orderCrossing(p: Vec, u: Vec, v: Vec): number {
  const fu = fisherQuad(p, u);
  const fv = fisherQuad(p, v);
  const mu = massQuad(p, u);
  const mv = massQuad(p, v);
  const den = mv - mu;
  if (Math.abs(den) < 1e-15) return -1;
  const cStar = (fu - fv) / den;
  if (!(cStar > 0) || !Number.isFinite(cStar)) return -1;
  const lo = campbellQuad(cStar * 0.5);
  const hi = campbellQuad(cStar * 1.5);
  const signLo = Math.sign(lo(p, u) - lo(p, v));
  const signHi = Math.sign(hi(p, u) - hi(p, v));
  return signLo !== 0 && signHi !== 0 && signLo !== signHi ? cStar : -1;
}

export function flipScan(opts: {
  readonly pairs: number;
  readonly seed: number;
  readonly n: number;
  readonly zeroSum: boolean;
}): FlipReport {
  const rng = mulberry32(opts.seed);
  const crossings: number[] = [];
  for (let k = 0; k < opts.pairs; k++) {
    const p = randCone(rng, opts.n);
    const u = randTangent(rng, opts.n, opts.zeroSum);
    const v = randTangent(rng, opts.n, opts.zeroSum);
    const c = orderCrossing(p, u, v);
    if (c > 0) crossings.push(c);
  }
  crossings.sort((a, b) => a - b);
  const mid = crossings.length === 0 ? 0 : (crossings[Math.floor(crossings.length / 2)] ?? 0);
  return { pairs: opts.pairs, flippable: crossings.length, medianCrossing: mid };
}

/** BeliefConvergence.observe: pointwise product of unnormalized weights. int64 -> BigInt here. */
export function observeExact(likelihood: readonly bigint[], belief: readonly bigint[]): bigint[] {
  return belief.map((b, i) => b * (likelihood[i] ?? 1n));
}

/** Coarse-grain (a deterministic Markov morphism): sum the weights inside each block. */
export function coarseGrain(blocks: readonly (readonly number[])[], x: readonly bigint[]): bigint[] {
  return blocks.map((idx) => idx.reduce((s, i) => s + (x[i] ?? 0n), 0n));
}

/** A likelihood is block-constant when it is constant on every block of the coarse-graining. */
export function isBlockConstant(blocks: readonly (readonly number[])[], l: readonly bigint[]): boolean {
  return blocks.every((idx) => idx.every((i) => (l[i] ?? 0n) === (l[idx[0] ?? 0] ?? 0n)));
}

export interface Tensor3 {
  readonly d: number;
  readonly v: readonly number[];
}

export function at3(t: Tensor3, i: number, j: number, k: number): number {
  return el(t.v, (i * t.d + j) * t.d + k);
}

export function maxAbs(t: Tensor3): number {
  let m = 0;
  for (const x of t.v) m = Math.max(m, Math.abs(x));
  return m;
}

/** G^(c)_ij(theta) = delta_ij p_i + c p_i p_j / S, with p_i = exp(theta_i), S = sum p. */
export function campbellMetricTheta(theta: Vec, c: number): number[][] {
  const p = theta.map((t) => Math.exp(t));
  const s = p.reduce((a, b) => a + b, 0);
  return p.map((pi, i) => p.map((pj, j) => (i === j ? pi : 0) + (c * pi * pj) / s));
}

/**
 * Christoffel symbols of the FIRST kind for g^(c) in the log-weight chart, CLOSED FORM.
 * With d_k p_i = delta_ik p_i and d_k S = p_k:
 *   d_k G_ij = delta_ij delta_ik p_i
 *              + c [ delta_ik p_i p_j / S + delta_jk p_i p_j / S - p_i p_j p_k / S^2 ]
 *   Gamma_{ij,k} = (1/2)( d_i G_jk + d_j G_ik - d_k G_ij )
 * The connection the fold transports along is IDENTICALLY ZERO in this chart (it translates
 * theta), so this tensor IS the deviation of the fold from the Levi-Civita reference of g^(c).
 */
export function campbellChristoffelClosed(theta: Vec, c: number): Tensor3 {
  const d = theta.length;
  const p = theta.map((t) => Math.exp(t));
  const s = p.reduce((a, b) => a + b, 0);
  const dG = (k: number, i: number, j: number): number => {
    const diag = i === j && i === k ? el(p, i) : 0;
    const cross = (i === k ? el(p, i) * el(p, j) : 0) + (j === k ? el(p, i) * el(p, j) : 0);
    return diag + (c * cross) / s - (c * el(p, i) * el(p, j) * el(p, k)) / (s * s);
  };
  const v: number[] = [];
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      for (let k = 0; k < d; k++) v.push(0.5 * (dG(i, j, k) + dG(j, i, k) - dG(k, i, j)));
    }
  }
  return { d, v };
}

/** The same Christoffels from CENTRAL DIFFERENCES of the metric -- the cross-check on the above. */
export function campbellChristoffelNumeric(theta: Vec, c: number, h = 1e-6): Tensor3 {
  const d = theta.length;
  const dG = (k: number, i: number, j: number): number => {
    const up = theta.map((t, n) => (n === k ? t + h : t));
    const dn = theta.map((t, n) => (n === k ? t - h : t));
    const gu = campbellMetricTheta(up, c)[i]?.[j] ?? 0;
    const gd = campbellMetricTheta(dn, c)[i]?.[j] ?? 0;
    return (gu - gd) / (2 * h);
  };
  const v: number[] = [];
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      for (let k = 0; k < d; k++) v.push(0.5 * (dG(i, j, k) + dG(j, i, k) - dG(k, i, j)));
    }
  }
  return { d, v };
}

/** Antisymmetric part in the first two slots -- the torsion of a first-kind connection. */
export function antisymmetricPart(g: Tensor3): Tensor3 {
  const d = g.d;
  const v: number[] = [];
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      for (let k = 0; k < d; k++) v.push(at3(g, i, j, k) - at3(g, j, i, k));
    }
  }
  return { d, v };
}

/** Symmetric part in the first two slots -- reported so the antisymmetric zero is not vacuous. */
export function symmetricPart(g: Tensor3): Tensor3 {
  const d = g.d;
  const v: number[] = [];
  for (let i = 0; i < d; i++) {
    for (let j = 0; j < d; j++) {
      for (let k = 0; k < d; k++) v.push(at3(g, i, j, k) + at3(g, j, i, k));
    }
  }
  return { d, v };
}

export interface CheckResult {
  readonly id: string;
  readonly says: string;
  readonly ok: boolean;
  readonly numbers: Record<string, number>;
}

const results: CheckResult[] = [];

function record(id: string, says: string, ok: boolean, numbers: Record<string, number>): void {
  results.push({ id, says, ok, numbers });
}

const CONE = { trials: 20000, seed: 4, n: 5, m: 3, zeroSum: false } as const;
const C_VALUES = [0, 0.5, 1, 5, 100] as const;

function d1(): void {
  const fisher = coneMonotonicityScan(fisherQuad, CONE);
  const euclid = coneMonotonicityScan(euclidQuad, CONE);
  record(
    "D1",
    "Fisher-Rao is monotone on the CONE of unnormalized measures, not only on the simplex",
    fisher.violations === 0 && fisher.worstRatio <= 1 + 1e-9,
    { trials: fisher.trials, violations: fisher.violations, worstExpansionRatio: fisher.worstRatio },
  );
  record(
    "D1n",
    "NEGATIVE, same scan and the same morphisms: Euclidean expands on the cone, so D1 is not vacuous",
    euclid.violations > 0 && euclid.worstRatio > 1,
    { trials: euclid.trials, violations: euclid.violations, worstExpansionRatio: euclid.worstRatio },
  );
}

function d2(): void {
  const mass = coneMonotonicityScan(massQuad, CONE);
  record(
    "D2",
    "the mass term is EXACTLY invariant on the cone, so c is a genuinely free parameter there. NOTE, checked by mutation: this pins INVARIANCE, not the specific form -- any function of the two preserved scalars passes it. The specific (sum v)^2/(sum p) normalization is pinned by D3n, where a mutation to (sum p)^2 goes red.",
    mass.violations === 0 && Math.abs(mass.worstRatio - 1) < 1e-9,
    {
      trials: mass.trials,
      violations: mass.violations,
      worstRatio: mass.worstRatio,
      deviationFromOne: Math.abs(mass.worstRatio - 1),
    },
  );

  const rng = mulberry32(4);
  let maxOnCone = 0;
  let maxOnSimplex = 0;
  for (let k = 0; k < 20000; k++) {
    const p = randCone(rng, 5);
    maxOnCone = Math.max(maxOnCone, Math.abs(massQuad(p, randTangent(rng, 5, false))));
    maxOnSimplex = Math.max(maxOnSimplex, Math.abs(massQuad(p, randTangent(rng, 5, true))));
  }
  record(
    "D2n",
    "NEGATIVE, same term: on zero-sum tangents the mass term is identically zero, so after the normalization quotient c is UNOBSERVABLE",
    maxOnSimplex < 1e-25 && maxOnCone > 1e-3,
    { maxMassTermOnCone: maxOnCone, maxMassTermOnSimplex: maxOnSimplex, tangents: 20000 },
  );
}

function d3(): void {
  const nums: Record<string, number> = {};
  let allMonotone = true;
  for (const c of C_VALUES) {
    const r = coneMonotonicityScan(campbellQuad(c), CONE);
    nums["worstRatio_c_" + String(c)] = r.worstRatio;
    nums["violations_c_" + String(c)] = r.violations;
    if (r.violations !== 0) allMonotone = false;
  }
  record(
    "D3",
    "every c >= 0 in the Campbell family is monotone on the cone -- the freedom is real, not an artefact of one c",
    allMonotone,
    nums,
  );

  const rng = mulberry32(4);
  let minAt0 = Infinity;
  let minAtMinus1p5 = Infinity;
  let radialAtMinus1 = 0;
  let radialAt0 = Infinity;
  for (let k = 0; k < 20000; k++) {
    const p = randCone(rng, 5);
    const v = randTangent(rng, 5, false);
    minAt0 = Math.min(minAt0, campbellQuad(0)(p, v));
    minAtMinus1p5 = Math.min(minAtMinus1p5, campbellQuad(-1.5)(p, v));
    radialAtMinus1 = Math.max(radialAtMinus1, Math.abs(campbellQuad(-1)(p, p)));
    radialAt0 = Math.min(radialAt0, campbellQuad(0)(p, p));
  }
  record(
    "D3n",
    "NEGATIVE, same form: c = -1.5 admits NEGATIVE squared length, and the endpoint c = -1 degenerates EXACTLY on the radial direction v = p -- that endpoint IS the normalization quotient",
    minAtMinus1p5 < 0 && minAt0 > 0 && radialAtMinus1 < 1e-12 && radialAt0 > 0,
    {
      minSquaredLength_c_0: minAt0,
      minSquaredLength_c_minus1p5: minAtMinus1p5,
      maxAbsRadialLength_c_minus1: radialAtMinus1,
      minRadialLength_c_0: radialAt0,
    },
  );
}

function d4(): void {
  const cone = flipScan({ pairs: 20000, seed: 4, n: 5, zeroSum: false });
  const simplex = flipScan({ pairs: 20000, seed: 4, n: 5, zeroSum: true });

  const p = [1, 1, 1, 1] as const;
  const u = [1, -1, 1, -1] as const;
  const v = [0.9, 0.9, 0.9, 0.9] as const;
  const cStar = orderCrossing(p, u, v);
  const at0 = campbellQuad(0)(p, u) - campbellQuad(0)(p, v);
  const at5 = campbellQuad(5)(p, u) - campbellQuad(5)(p, v);

  record(
    "D4",
    "a choice of c CHANGES WHICH BELIEF IS CLOSER: random tangent pairs on the cone are order-flippable by some c >= 0, crossing solved then verified on both sides",
    cone.flippable > 0 && cStar > 0 && at0 > 0 && at5 < 0,
    {
      pairs: cone.pairs,
      flippablePairs: cone.flippable,
      flippableFraction: cone.flippable / cone.pairs,
      medianCrossingC: cone.medianCrossing,
      handInstanceCrossingC: cStar,
      handInstanceGapAtC0: at0,
      handInstanceGapAtC5: at5,
    },
  );
  record(
    "D4n",
    "NEGATIVE, same scan: after the normalization quotient (zero-sum tangents) NO c reorders any pair -- the choice is invisible exactly where the fold documents taking the quotient",
    simplex.flippable === 0 && cone.flippable > 0,
    {
      pairs: simplex.pairs,
      flippablePairs: simplex.flippable,
      flippableFraction: simplex.flippable / simplex.pairs,
    },
  );
}

function d5(): void {
  const blocks = [
    [0, 2],
    [1, 3],
  ] as const;
  const belief = [3n, 5n, 7n, 11n] as const;

  const good = [2n, 9n, 2n, 9n] as const;
  const goodCoarse = [2n, 9n] as const;
  const lhsGood = coarseGrain(blocks, observeExact(good, belief));
  const rhsGood = observeExact(goodCoarse, coarseGrain(blocks, belief));
  const gapGood = lhsGood.reduce((s, x, i) => s + Math.abs(Number(x - (rhsGood[i] ?? 0n))), 0);

  const bad = [2n, 9n, 4n, 9n] as const;
  const badCoarse = [2n, 9n] as const;
  const lhsBad = coarseGrain(blocks, observeExact(bad, belief));
  const rhsBad = observeExact(badCoarse, coarseGrain(blocks, belief));
  const gapBad = lhsBad.reduce((s, x, i) => s + Math.abs(Number(x - (rhsBad[i] ?? 0n))), 0);

  record(
    "D5",
    "what invariant-under-sufficient-statistics means FOR THE FOLD: coarse-graining commutes with observe EXACTLY in the integer algebra when the likelihood is block-constant",
    isBlockConstant(blocks, good) && gapGood === 0,
    {
      blockConstant: 1,
      exactGap: gapGood,
      lhs0: Number(lhsGood[0] ?? 0n),
      lhs1: Number(lhsGood[1] ?? 0n),
      rhs0: Number(rhsGood[0] ?? 0n),
      rhs1: Number(rhsGood[1] ?? 0n),
    },
  );
  record(
    "D5n",
    "NEGATIVE, same code path: a likelihood that is NOT block-constant breaks the commutation -- coarse-graining is a sufficient statistic for the fold only under that hypothesis",
    !isBlockConstant(blocks, bad) && gapBad > 0,
    {
      blockConstant: 0,
      exactGap: gapBad,
      lhs0: Number(lhsBad[0] ?? 0n),
      lhs1: Number(lhsBad[1] ?? 0n),
      rhs0: Number(rhsBad[0] ?? 0n),
      rhs1: Number(rhsBad[1] ?? 0n),
    },
  );
}

function d6(): void {
  const theta = [0.7, -0.4, 0.25] as const;
  const nums: Record<string, number> = {};
  let worstClosedVsNumeric = 0;
  const norms: number[] = [];
  for (const c of C_VALUES) {
    const closed = campbellChristoffelClosed(theta, c);
    const numeric = campbellChristoffelNumeric(theta, c);
    const gap = maxAbs({ d: closed.d, v: closed.v.map((x, i) => x - el(numeric.v, i)) });
    worstClosedVsNumeric = Math.max(worstClosedVsNumeric, gap);
    const nrm = maxAbs(closed);
    norms.push(nrm);
    nums["deviationNorm_c_" + String(c)] = nrm;
  }
  const lo = Math.min(...norms);
  const hi = Math.max(...norms);
  nums["closedFormVsCentralDifferenceGap"] = worstClosedVsNumeric;
  nums["spreadRatioMaxOverMin"] = hi / lo;
  record(
    "D6",
    "the deviation-from-Levi-Civita magnitude MOVES with c on the cone, so the geometry numbers quoted for our fold are convention-dependent rather than properties of the fold",
    hi / lo > 1.5 && worstClosedVsNumeric < 1e-5,
    nums,
  );

  let worstAnti = 0;
  let leastSym = Infinity;
  for (const c of C_VALUES) {
    const closed = campbellChristoffelClosed(theta, c);
    worstAnti = Math.max(worstAnti, maxAbs(antisymmetricPart(closed)));
    leastSym = Math.min(leastSym, maxAbs(symmetricPart(closed)));
  }
  record(
    "D6n",
    "NEGATIVE, same tensors: the antisymmetric part is exactly zero for EVERY c while the symmetric part is order one -- the contortion-is-identically-zero refutation survives the c-freedom even though its magnitude does not",
    worstAnti === 0 && leastSym > 0.1,
    { worstAntisymmetricPart: worstAnti, leastSymmetricPart: leastSym, cValuesTested: C_VALUES.length },
  );
}

function main(): void {
  d1();
  d2();
  d3();
  d4();
  d5();
  d6();
  console.log(JSON.stringify(results, null, 2));
  const bad = results.filter((r) => !r.ok);
  console.log(JSON.stringify({ checks: results.length, failed: bad.length, failedIds: bad.map((r) => r.id) }));
  if (bad.length > 0) process.exit(1);
}

if (import.meta.main) main();
