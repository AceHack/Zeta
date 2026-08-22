/**
 * monotone-metric-cencov-petz-check.ts — turns a CITED anchor into a CHECKED one (Lumen 2026-08-20).
 *
 * The claim under test (as written, cited-but-unchecked):
 *
 *   "Fisher-Rao's classical uniqueness is Cencov (1982) -- the only Riemannian metric invariant
 *    under sufficient statistics / Markov morphisms. Its quantum counterpart is the Bures /
 *    quantum-Fisher-information metric, with a matching uniqueness story (Petz 1996). Classical
 *    belief geometry and quantum information geometry are genuinely related as members of one
 *    monotone-metric family."
 *
 * Per .claude/rules/anchor-to-human-prior-art.md an anchor must be CHECKED (entailment), not
 * merely cited. Every number this file prints is computed here; nothing is asserted from memory.
 *
 * WHAT IS CHECKED, and what each check decides
 *
 *   A. Classical monotonicity IS the discriminator (the mechanical content of Cencov).
 *      A1 Fisher-Rao contracts under every Markov morphism.   -> holds
 *      A2 Euclidean-on-probability-vectors does not.          -> FAILS, with an exact counterexample
 *      A3 Monotonicity is blind to a positive scale factor.   -> "up to scale" is the real conclusion
 *      A4 On UNNORMALIZED measures (which is what our belief weights are) monotonicity admits a
 *         genuine one-parameter family (Campbell 1986), not a single metric. Uniqueness-up-to-scale
 *         is a statement about the SIMPLEX.
 *
 *   B. The quantum side is a CLASSIFICATION, not a uniqueness theorem (the crux).
 *      B1 In directions that COMMUTE with the state, every member of the Petz family collapses to
 *         one number, and that number is the classical Fisher-Rao form. -> spread exactly 0
 *      B2 In non-commuting directions the family genuinely spreads.     -> spread is large
 *      B3 SLD/Bures is the MINIMAL member and RLD the MAXIMAL one over random states/directions.
 *      B4 Every member contracts under a channel (that is what "monotone" means).
 *      B5 Full decoherence maps every member onto the SAME classical value -- the other face of B1.
 *      B6 Hilbert-Schmidt, the plausible-but-wrong quantum metric, is not monotone.
 *
 *   C. The bridge to OUR code. Kish's design effect, which src/Core.TypeScript/society/
 *      effective-agent-count.ts and src/Bayesian/LagrangeCondorcet.fs both use, is EXACTLY a Fisher
 *      information ratio in the equicorrelated Gaussian model: nEff = sigma^2 * (1' Sigma^-1 1).
 *      Checked against our own shipped function, not against a re-derivation.
 *
 * ANCHORS (each one used, not decorative)
 *   Rao (1945); Cencov/Chentsov, Statistical Decision Rules and Optimal Inference, AMS Transl. of
 *   Math. Monographs 53 (1982; Russian orig. 1972) -- classical uniqueness up to scale on finite
 *   sample spaces. Campbell, Proc. AMS 98 (1986) 135-141 -- the extension to unnormalized measures
 *   and the extra invariant term. Morozova & Chentsov (1989/91) -- posed the quantum problem.
 *   Petz, Linear Algebra Appl. 244 (1996) 81-96, "Monotone metrics on matrix spaces" -- the
 *   classification by operator monotone f. Kubo & Ando (1980) -- harmonic <= any normalized
 *   symmetric operator mean <= arithmetic, which is why SLD is minimal and RLD maximal.
 *   Bures (1969), Uhlmann (1976), Braunstein & Caves (1994) -- Bures = SLD-QFI. Ozawa,
 *   Phys. Lett. A 268 (2000) 158 -- Hilbert-Schmidt is not monotone. Kish, Survey Sampling (1965).
 *
 * REGISTER: the mathematics below is CHECKED. The mapping of any of it onto our substrate stays a
 * toy under .claude/rules/toy-is-free-metered-must-be-earned.md. This file is a falsifier for a
 * citation, not a metric implementation, and nothing here should be cited as "our metric".
 *
 * Run:  bun src/Core.TypeScript/research/monotone-metric-cencov-petz-check.ts
 */

import { effectiveTrialCount } from "../society/effective-agent-count.ts";

// -- deterministic RNG (DST: same seed, same numbers, every run, every machine) -------------------

/** mulberry32 -- 32-bit deterministic PRNG. Seeded from the common seed S = 4. */
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

// -- A. the classical side -----------------------------------------------------------------------

export type Vec = readonly number[];
/** Column-stochastic Markov morphism: `T[j][i] = P(out = j | in = i)`, every COLUMN sums to 1. */
export type Markov = readonly (readonly number[])[];

function el(a: Vec, i: number): number {
  return a[i] ?? 0;
}

export function pushforward(t: Markov, x: Vec): number[] {
  return t.map((row) => row.reduce((s, tji, i) => s + tji * el(x, i), 0));
}

/** Fisher-Rao quadratic form g_p(v,v) = sum v_i^2 / p_i (the Hessian of KL at p). */
export function fisherQuad(p: Vec, v: Vec): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) s += (el(v, i) * el(v, i)) / el(p, i);
  return s;
}

/** The plausible-but-wrong candidate: plain Euclidean on probability vectors. */
export function euclidQuad(_p: Vec, v: Vec): number {
  let s = 0;
  for (const x of v) s += x * x;
  return s;
}

/** Campbell's extra invariant term on the CONE of positive measures: (sum v)^2 / (sum p). */
export function massQuad(p: Vec, v: Vec): number {
  let sv = 0;
  let sp = 0;
  for (const x of v) sv += x;
  for (const x of p) sp += x;
  return (sv * sv) / sp;
}

/** Fisher-Rao geodesic distance on the simplex: 2 arccos(sum sqrt(p_i q_i)). */
export function fisherRaoDistance(p: Vec, q: Vec): number {
  let bc = 0;
  for (let i = 0; i < p.length; i++) bc += Math.sqrt(el(p, i) * el(q, i));
  return 2 * Math.acos(Math.min(1, Math.max(-1, bc)));
}

export function euclidDistance(p: Vec, q: Vec): number {
  let s = 0;
  for (let i = 0; i < p.length; i++) {
    const d = el(p, i) - el(q, i);
    s += d * d;
  }
  return Math.sqrt(s);
}

function randSimplex(rng: () => number, n: number): number[] {
  const v = Array.from({ length: n }, () => -Math.log(1 - rng()) + 1e-3);
  const z = v.reduce((a, b) => a + b, 0);
  return v.map((x) => x / z);
}

/** A random Markov morphism from n inputs to m outputs (each column an independent Dirichlet draw). */
function randMarkov(rng: () => number, n: number, m: number): number[][] {
  const cols = Array.from({ length: n }, () => randSimplex(rng, m));
  return Array.from({ length: m }, (_, j) => Array.from({ length: n }, (_, i) => el(cols[i] ?? [], j)));
}

/** A random tangent vector; `zeroSum` selects the simplex (mass-preserving) vs the full cone. */
function randTangent(rng: () => number, n: number, zeroSum: boolean): number[] {
  const v = Array.from({ length: n }, () => rng() * 2 - 1);
  if (!zeroSum) return v;
  const mean = v.reduce((a, b) => a + b, 0) / n;
  return v.map((x) => x - mean);
}

export interface MonotonicityReport {
  readonly trials: number;
  readonly violations: number;
  readonly worstRatio: number;
}

/**
 * Push `trials` random (p, v, T) through a candidate quadratic form and report the worst
 * expansion ratio g_{Tp}(Tv,Tv) / g_p(v,v). Monotone <=> worstRatio <= 1.
 */
export function monotonicityScan(
  quad: (p: Vec, v: Vec) => number,
  opts: {
    readonly trials: number;
    readonly seed: number;
    readonly n: number;
    readonly m: number;
    readonly zeroSum: boolean;
  },
): MonotonicityReport {
  const rng = mulberry32(opts.seed);
  let violations = 0;
  let worst = 0;
  for (let k = 0; k < opts.trials; k++) {
    const p = randSimplex(rng, opts.n);
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

/**
 * The exact counterexample that kills Euclidean, stated once so it is reproducible by hand.
 * p and q differ on four outcomes; the morphism merges {1,3} and {2,4}.
 */
export const MERGE_COUNTEREXAMPLE = {
  p: [0.5, 0, 0.5, 0] as const,
  q: [0, 0.5, 0, 0.5] as const,
  t: [
    [1, 0, 1, 0],
    [0, 1, 0, 1],
  ] as const,
};

// -- B. the quantum side: the Petz family on a qubit ---------------------------------------------

/** A Hermitian 2x2 written in the eigenbasis of the state. Tangent vectors have a11 + a22 = 0. */
export interface Herm2 {
  readonly a11: number;
  readonly a22: number;
  readonly re12: number;
  readonly im12: number;
}

/** A member of the Petz family: an operator monotone f with f(1)=1, f(t)=t f(1/t), and its mean. */
export interface PetzMember {
  readonly name: string;
  /** f(t) -- the operator monotone function the Petz classification indexes the metric by. */
  readonly f: (t: number) => number;
  /** m_f(x,y) = y f(x/y) -- the operator mean the metric divides by. */
  readonly mean: (x: number, y: number) => number;
}

const EQ = 1e-12;

function member(name: string, f: (t: number) => number, mean: (x: number, y: number) => number): PetzMember {
  return { name, f, mean };
}

/**
 * Five members of the Petz family. Each f is operator monotone on (0, inf), f(1) = 1, f(t) = t f(1/t).
 * The metric divides by the associated operator mean m_f(x,y) = y f(x/y), so a LARGER mean gives a
 * SMALLER metric -- which is why the arithmetic mean (SLD/Bures) is minimal and the harmonic (RLD)
 * is maximal, by the Kubo-Ando bounds harmonic <= m_f <= arithmetic.
 */
export const PETZ: readonly PetzMember[] = [
  member("SLD / Bures (arith)", (t) => (1 + t) / 2, (x, y) => (x + y) / 2),
  member("Wigner-Yanase", (t) => ((1 + Math.sqrt(t)) * (1 + Math.sqrt(t))) / 4, (x, y) => ((Math.sqrt(x) + Math.sqrt(y)) / 2) ** 2),
  member(
    "Kubo-Mori / BKM (log)",
    (t) => (Math.abs(t - 1) < EQ ? 1 : (t - 1) / Math.log(t)),
    (x, y) => (Math.abs(x - y) < EQ * Math.max(x, y) ? x : (x - y) / Math.log(x / y)),
  ),
  member("geometric", (t) => Math.sqrt(t), (x, y) => Math.sqrt(x * y)),
  member("RLD (harmonic)", (t) => (2 * t) / (1 + t), (x, y) => (2 * x * y) / (x + y)),
];

/**
 * The Petz monotone metric in the eigenbasis of rho:
 *   K_f(A,A) = sum over i,j of |A_ij|^2 / m_f(lambda_i, lambda_j)
 * Diagonal terms use m_f(x,x) = x for EVERY f (because f(1) = 1) -- the content of check B1.
 */
export function petzQuad(lambda: readonly [number, number], a: Herm2, m: PetzMember): number {
  const l1 = lambda[0];
  const l2 = lambda[1];
  const off = a.re12 * a.re12 + a.im12 * a.im12;
  return (a.a11 * a.a11) / m.mean(l1, l1) + (a.a22 * a.a22) / m.mean(l2, l2) + (2 * off) / m.mean(l1, l2);
}

/** The classical Fisher-Rao form of the DIAGONAL part alone -- the commutative shadow. */
export function classicalShadow(lambda: readonly [number, number], a: Herm2): number {
  return (a.a11 * a.a11) / lambda[0] + (a.a22 * a.a22) / lambda[1];
}

/** Hilbert-Schmidt: the plausible-but-wrong quantum metric. Sum of |A_ij|^2, ignores rho entirely. */
export function hilbertSchmidtQuad(_lambda: readonly [number, number], a: Herm2): number {
  return a.a11 * a.a11 + a.a22 * a.a22 + 2 * (a.re12 * a.re12 + a.im12 * a.im12);
}

export interface QState {
  readonly lambda: readonly [number, number];
  readonly a: Herm2;
}

/** Depolarizing channel on a qubit: rho -> p rho + (1-p) I/2, tangent A -> p A. */
export function depolarize(lambda: readonly [number, number], a: Herm2, p: number): QState {
  const out: readonly [number, number] = [p * lambda[0] + (1 - p) / 2, p * lambda[1] + (1 - p) / 2];
  return { lambda: out, a: { a11: p * a.a11, a22: p * a.a22, re12: p * a.re12, im12: p * a.im12 } };
}

/** Full decoherence in the eigenbasis of rho: off-diagonals to zero, state unchanged. */
export function decohere(lambda: readonly [number, number], a: Herm2): QState {
  return { lambda, a: { a11: a.a11, a22: a.a22, re12: 0, im12: 0 } };
}

// -- C. the bridge to our own shipped code -------------------------------------------------------

/**
 * Fisher information about the common mean mu in the equicorrelated Gaussian model
 *   X ~ N(mu * ones, sigma^2 [(1-rho) I + rho J]),  I(mu) = 1^T Sigma^-1 1
 * computed by an actual linear solve, so the identity below is measured rather than agreed with.
 */
export function fisherInfoEquicorrelatedMean(n: number, rho: number, sigma2: number): number {
  const a: number[][] = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (j === n ? 1 : sigma2 * ((i === j ? 1 - rho : 0) + rho))),
  );
  for (let c = 0; c < n; c++) {
    let piv = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(el(a[r] ?? [], c)) > Math.abs(el(a[piv] ?? [], c))) piv = r;
    const tmp = a[c] ?? [];
    a[c] = a[piv] ?? [];
    a[piv] = tmp;
    const rowC = a[c] ?? [];
    const d = el(rowC, c);
    for (let j = c; j <= n; j++) rowC[j] = el(rowC, j) / d;
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const rowR = a[r] ?? [];
      const factor = el(rowR, c);
      if (factor === 0) continue;
      for (let j = c; j <= n; j++) rowR[j] = el(rowR, j) - factor * el(rowC, j);
    }
  }
  let s = 0;
  for (let i = 0; i < n; i++) s += el(a[i] ?? [], n);
  return s;
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

const SIMPLEX_SCAN = { trials: 20000, seed: 4, n: 5, m: 3, zeroSum: true } as const;
const CONE_SCAN = { trials: 20000, seed: 4, n: 5, m: 3, zeroSum: false } as const;

function partA(): void {
  const fisher = monotonicityScan(fisherQuad, SIMPLEX_SCAN);
  const fisherNums = { trials: fisher.trials, violations: fisher.violations, worstExpansionRatio: fisher.worstRatio };
  record("A1", "Fisher-Rao contracts under every random Markov morphism", fisher.violations === 0, fisherNums);

  const euclid = monotonicityScan(euclidQuad, SIMPLEX_SCAN);
  const euclidNums = { trials: euclid.trials, violations: euclid.violations, worstExpansionRatio: euclid.worstRatio };
  record("A2", "plain Euclidean on probability vectors FAILS monotonicity", euclid.violations > 0, euclidNums);

  const cp = MERGE_COUNTEREXAMPLE;
  const tp = pushforward(cp.t, cp.p);
  const tq = pushforward(cp.t, cp.q);
  const frBefore = fisherRaoDistance(cp.p, cp.q);
  const frAfter = fisherRaoDistance(tp, tq);
  const euBefore = euclidDistance(cp.p, cp.q);
  const euAfter = euclidDistance(tp, tq);
  const mergeNums = {
    fisherRaoBefore: frBefore,
    fisherRaoAfter: frAfter,
    fisherRaoRatio: frAfter / frBefore,
    euclidBefore: euBefore,
    euclidAfter: euAfter,
    euclidRatio: euAfter / euBefore,
  };
  const mergeOk = frAfter <= frBefore + 1e-12 && euAfter > euBefore + 1e-12;
  record("A2x", "the exact counterexample: merge outcome 1 with 3 and outcome 2 with 4", mergeOk, mergeNums);

  const scaled = monotonicityScan((pp, vv) => 7.3 * fisherQuad(pp, vv), SIMPLEX_SCAN);
  const scaleGap = Math.abs(scaled.worstRatio - fisher.worstRatio);
  const scaleNums = { unscaledWorst: fisher.worstRatio, scaledWorst: scaled.worstRatio, difference: scaleGap };
  const scaleOk = scaled.violations === fisher.violations && scaleGap < 1e-15;
  record("A3", "monotonicity is blind to a positive scale factor, so no unit is fixed", scaleOk, scaleNums);

  const massOnly = monotonicityScan(massQuad, CONE_SCAN);
  const campbell = monotonicityScan((pp, vv) => fisherQuad(pp, vv) + 5 * massQuad(pp, vv), CONE_SCAN);
  const coneNums = {
    massTermWorstRatio: massOnly.worstRatio,
    massTermViolations: massOnly.violations,
    campbellWorstRatio: campbell.worstRatio,
    campbellViolations: campbell.violations,
  };
  const coneOk = massOnly.violations === 0 && Math.abs(massOnly.worstRatio - 1) < 1e-9 && campbell.violations === 0;
  record("A4", "on UNNORMALIZED measures the mass term is exactly invariant, so Fisher plus c times mass is monotone for every c", coneOk, coneNums);

  const rngZ = mulberry32(4);
  let maxSimplexGap = 0;
  for (let k = 0; k < 5000; k++) {
    const pp = randSimplex(rngZ, 5);
    const vv = randTangent(rngZ, 5, true);
    maxSimplexGap = Math.max(maxSimplexGap, Math.abs(massQuad(pp, vv)));
  }
  const simplexNums = { maxAbsoluteMassTerm: maxSimplexGap, tangents: 5000 };
  record("A4x", "that extra freedom vanishes on the simplex, which is where up-to-scale uniqueness holds", maxSimplexGap < 1e-25, simplexNums);
}

function partB(): void {
  const lam: readonly [number, number] = [0.9, 0.1];

  const commuting: Herm2 = { a11: 0.3, a22: -0.3, re12: 0, im12: 0 };
  const commutingValues = PETZ.map((m) => petzQuad(lam, commuting, m));
  const shadow = classicalShadow(lam, commuting);
  const spreadCommuting = Math.max(...commutingValues) - Math.min(...commutingValues);
  const b1Nums: Record<string, number> = { spreadAcrossFamily: spreadCommuting, classicalFisherRao: shadow };
  PETZ.forEach((m, i) => {
    b1Nums[m.name] = commutingValues[i] ?? 0;
  });
  const b1Ok = spreadCommuting < 1e-12 && Math.abs((commutingValues[0] ?? 0) - shadow) < 1e-12;
  record("B1", "in a COMMUTING direction every Petz member gives one number, and it is classical Fisher-Rao", b1Ok, b1Nums);

  const offDiag: Herm2 = { a11: 0, a22: 0, re12: 1, im12: 0 };
  const offValues = PETZ.map((m) => petzQuad(lam, offDiag, m));
  const sld = offValues[0] ?? 0;
  const rld = offValues[offValues.length - 1] ?? 0;
  const b2Nums: Record<string, number> = { ratioRldOverSld: rld / sld };
  PETZ.forEach((m, i) => {
    b2Nums[m.name] = offValues[i] ?? 0;
  });
  record("B2", "in a NON-COMMUTING direction the family genuinely spreads, so there is no quantum uniqueness", rld / sld > 2, b2Nums);

  const rngQ = mulberry32(4);
  let minRatioToSld = Infinity;
  let maxRatioToRld = 0;
  let ordViolations = 0;
  for (let k = 0; k < 20000; k++) {
    const l1 = 0.02 + 0.96 * rngQ();
    const l: readonly [number, number] = [l1, 1 - l1];
    const d = rngQ() * 2 - 1;
    const a: Herm2 = { a11: d, a22: -d, re12: rngQ() * 2 - 1, im12: rngQ() * 2 - 1 };
    const vals = PETZ.map((m) => petzQuad(l, a, m));
    const kSld = vals[0] ?? 0;
    const kRld = vals[vals.length - 1] ?? 0;
    for (const v of vals) {
      if (v < kSld - 1e-12) ordViolations++;
      if (v > kRld + 1e-12) ordViolations++;
      minRatioToSld = Math.min(minRatioToSld, v / kSld);
      maxRatioToRld = Math.max(maxRatioToRld, v / kRld);
    }
  }
  const b3Nums = { samples: 20000, orderViolations: ordViolations, minRatioToSld, maxRatioToRld };
  record("B3", "SLD/Bures is the MINIMAL member and RLD the MAXIMAL one (Kubo-Ando bounds)", ordViolations === 0, b3Nums);

  const rngC = mulberry32(4);
  let worstChannelRatio = 0;
  let channelViolations = 0;
  for (let k = 0; k < 20000; k++) {
    const l1 = 0.02 + 0.96 * rngC();
    const l: readonly [number, number] = [l1, 1 - l1];
    const d = rngC() * 2 - 1;
    const a: Herm2 = { a11: d, a22: -d, re12: rngC() * 2 - 1, im12: rngC() * 2 - 1 };
    const out = depolarize(l, a, rngC());
    for (const m of PETZ) {
      const ratio = petzQuad(out.lambda, out.a, m) / petzQuad(l, a, m);
      if (ratio > 1 + 1e-9) channelViolations++;
      worstChannelRatio = Math.max(worstChannelRatio, ratio);
    }
  }
  const b4Nums = { samples: 20000, members: PETZ.length, violations: channelViolations, worstRatio: worstChannelRatio };
  record("B4", "every member contracts under a depolarizing channel, so monotone is checked not assumed", channelViolations === 0, b4Nums);

  const mixed: Herm2 = { a11: 0.3, a22: -0.3, re12: 0.5, im12: -0.2 };
  const dec = decohere(lam, mixed);
  const beforeDec = PETZ.map((m) => petzQuad(lam, mixed, m));
  const afterDec = PETZ.map((m) => petzQuad(dec.lambda, dec.a, m));
  const spreadAfter = Math.max(...afterDec) - Math.min(...afterDec);
  const b5Nums: Record<string, number> = { spreadAfterDecoherence: spreadAfter, classicalFisherRao: classicalShadow(lam, mixed) };
  PETZ.forEach((m, i) => {
    b5Nums[m.name] = beforeDec[i] ?? 0;
  });
  const b5Ok =
    spreadAfter < 1e-12 &&
    Math.abs((afterDec[0] ?? 0) - classicalShadow(lam, mixed)) < 1e-12 &&
    afterDec.every((v, i) => v <= (beforeDec[i] ?? 0) + 1e-12);
  record("B5", "full decoherence maps EVERY member onto the same classical number, the other face of B1", b5Ok, b5Nums);

  const hsIgnoresState = hilbertSchmidtQuad(lam, mixed);
  const cp = MERGE_COUNTEREXAMPLE;
  const hsBefore = euclidDistance(cp.p, cp.q) ** 2;
  const hsAfter = euclidDistance(pushforward(cp.t, cp.p), pushforward(cp.t, cp.q)) ** 2;
  const b6Nums = { squaredHsBefore: hsBefore, squaredHsAfter: hsAfter, hsFormAtAnyState: hsIgnoresState };
  record("B6", "Hilbert-Schmidt is NOT monotone: the A2 counterexample embedded as diagonal density matrices", hsAfter > hsBefore + 1e-12, b6Nums);
}

const MU_CRIT = 0.03852;

function partC(): void {
  const sigma2 = 1.7;
  let worstKishErr = 0;
  for (const n of [2, 5, 26, 100]) {
    for (const rho of [0.0, MU_CRIT, 0.2, 0.7]) {
      const info = fisherInfoEquicorrelatedMean(n, rho, sigma2);
      const ours = effectiveTrialCount(n, rho);
      const err = Math.abs(sigma2 * info - ours) / Math.max(1, ours);
      worstKishErr = Math.max(worstKishErr, err);
    }
  }
  const nums = {
    worstRelativeError: worstKishErr,
    sigma2TimesFisherInfo_n26_rhoMuCrit: sigma2 * fisherInfoEquicorrelatedMean(26, MU_CRIT, sigma2),
    kishNEff_n26_rhoMuCrit: effectiveTrialCount(26, MU_CRIT),
    sigma2TimesFisherInfo_n26_rho07: sigma2 * fisherInfoEquicorrelatedMean(26, 0.7, sigma2),
    kishNEff_n26_rho07: effectiveTrialCount(26, 0.7),
    limitOneOverMuCrit: 1 / MU_CRIT,
  };
  record("C1", "our own effectiveTrialCount equals sigma squared times the quadratic form for the equicorrelated Gaussian mean", worstKishErr < 1e-9, nums);
}

function main(): void {
  partA();
  partB();
  partC();
  console.log(JSON.stringify(results, null, 2));
  const bad = results.filter((r) => !r.ok);
  const summary = { checks: results.length, failed: bad.length, failedIds: bad.map((r) => r.id) };
  console.log(JSON.stringify(summary));
  if (bad.length > 0) process.exit(1);
}

if (import.meta.main) main();
