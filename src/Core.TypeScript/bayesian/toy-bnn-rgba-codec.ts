// TOY — BNN posterior <-> RGBA texel codec, round-trip harness.
//
// REGISTER: `toy` per `.claude/rules/toy-is-free-metered-must-be-earned.md`. Nothing here is
// metered. It exists to put a NUMBER on one question: can a BNN weight posterior survive an
// encode/decode through a 4-channel texel, and at what precision?
//
// It is deliberately NOT a GPU kernel and NOT an evolutionary engine. It is the smallest thing
// that can kill or earn the direction. See
// docs/research/2026-08-23-toy-encoding-a-bnn-posterior-into-rgba-*.md
//
// Two candidate encodings are implemented so they can be compared on the same falsifier:
//
//   NP2  — Gaussian in NATURAL parameters (eta = mu*tau, tau = 1/sigma^2). This is already the
//          in-tree representation: `src/Bayesian/Message.fs` `Gaussian` stores `PrecisionMean`
//          and `Precision`, and its `( * )` is componentwise ADD. Two weights per RGBA texel.
//
//   NG4  — Normal-Gamma in natural parameters. FOUR natural parameters, one weight per texel,
//          and the induced marginal on the weight is a Student-t (heavy tailed). Also an
//          exponential family, so fusion is again componentwise ADD.

/** Gaussian in natural parameters — the shape `src/Bayesian/Message.fs` already uses. */
export interface GaussianNp {
  /** precision-mean, eta = mu * tau */
  readonly eta: number;
  /** precision, tau = 1 / sigma^2 */
  readonly tau: number;
}

export const npFromMoments = (mu: number, sigma2: number): GaussianNp => ({
  eta: mu / sigma2,
  tau: 1 / sigma2,
});
export const npToMoments = (g: GaussianNp): { mu: number; sigma2: number } => ({
  mu: g.eta / g.tau,
  sigma2: 1 / g.tau,
});

/** Message product = add natural parameters. The in-tree `( * )`, restated here. */
export const npFuse = (a: GaussianNp, b: GaussianNp): GaussianNp => ({
  eta: a.eta + b.eta,
  tau: a.tau + b.tau,
});

/** Fusion expressed in MOMENTS, without carrying the weights — the naive "average the means"
 *  form. Present ONLY so the associativity falsifier has something to fail. */
export const momentFuseNaive = (
  a: { mu: number; sigma2: number },
  b: { mu: number; sigma2: number },
): { mu: number; sigma2: number } => ({
  mu: 0.5 * (a.mu + b.mu),
  sigma2: 0.5 * (a.sigma2 + b.sigma2),
});

// ── Normal-Gamma ────────────────────────────────────────────────────────────────────────────
//
// p(mu, tau | m, lambda, alpha, beta) = N(mu | m, (lambda*tau)^-1) * Gamma(tau | alpha, beta)
//
// Sufficient statistic  T = (tau, tau*mu, tau*mu^2, log tau)
// Natural parameter     h = ( -(beta + lambda*m^2/2),  lambda*m,  -lambda/2,  alpha - 1/2 )
//
// Marginal on the weight mu is Student-t:  nu = 2*alpha, loc = m, scale^2 = beta / (alpha*lambda)

export interface NormalGamma {
  readonly m: number;
  readonly lambda: number;
  readonly alpha: number;
  readonly beta: number;
}

/** Natural-parameter coordinates. Vector addition here IS Bayesian conjugate update. */
export interface NormalGammaNp {
  readonly h1: number;
  readonly h2: number;
  readonly h3: number;
  readonly h4: number;
}

export const ngToNp = (p: NormalGamma): NormalGammaNp => ({
  h1: -(p.beta + (p.lambda * p.m * p.m) / 2),
  h2: p.lambda * p.m,
  h3: -p.lambda / 2,
  h4: p.alpha - 0.5,
});

export const ngFromNp = (h: NormalGammaNp): NormalGamma => {
  const lambda = -2 * h.h3;
  const m = h.h2 / lambda;
  const alpha = h.h4 + 0.5;
  // beta = -h1 - lambda*m^2/2. Written this way rather than as `-h1 + h2^2/(4*h3)` because both
  // forms are a DIFFERENCE OF LIKE-SIGNED QUANTITIES and cancel catastrophically for large |m|.
  // The harness measures that; it is not hidden.
  const beta = -h.h1 - (lambda * m * m) / 2;
  return { m, lambda, alpha, beta };
};

export const ngFuse = (a: NormalGammaNp, b: NormalGammaNp): NormalGammaNp => ({
  h1: a.h1 + b.h1,
  h2: a.h2 + b.h2,
  h3: a.h3 + b.h3,
  h4: a.h4 + b.h4,
});

/** The Student-t the Normal-Gamma induces on the weight. This is the object that must survive. */
export const ngStudentT = (p: NormalGamma): { nu: number; loc: number; scale: number } => ({
  nu: 2 * p.alpha,
  loc: p.m,
  scale: Math.sqrt(p.beta / (p.alpha * p.lambda)),
});

// ── Exponential-family divergence (the honest error metric — NOT an L2 on channels) ─────────

const LOG_2PI = Math.log(2 * Math.PI);

/** log Gamma — Lanczos. */
export const lgamma = (x: number): number => {
  const g = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313,
    -176.61502916214059, 12.507343278686905, -0.13857109526572012,
    9.9843695780195716e-6, 1.5056327351493116e-7,
  ];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  const z = x - 1;
  let a = 0.99999999999980993;
  for (let i = 0; i < g.length; i++) a += g[i]! / (z + i + 1);
  const t = z + g.length - 0.5;
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
};

/** digamma — asymptotic with recurrence shift. */
export const digamma = (x0: number): number => {
  let x = x0;
  let r = 0;
  while (x < 6) {
    r -= 1 / x;
    x += 1;
  }
  const f = 1 / (x * x);
  return (
    r +
    Math.log(x) -
    0.5 / x +
    f * (-1 / 12 + f * (1 / 120 + f * (-1 / 252 + f * (1 / 240 + f * (-1 / 132)))))
  );
};

/** Log-partition A(h) for the Normal-Gamma in natural coordinates. */
export const ngLogPartition = (h: NormalGammaNp): number => {
  const p = ngFromNp(h);
  return lgamma(p.alpha) - p.alpha * Math.log(p.beta) - 0.5 * Math.log(p.lambda) + 0.5 * LOG_2PI;
};

/** E_h[T] — the mean of the sufficient statistic, i.e. grad A. */
export const ngExpectedT = (h: NormalGammaNp): [number, number, number, number] => {
  const p = ngFromNp(h);
  const eTau = p.alpha / p.beta;
  return [
    eTau,
    p.m * eTau,
    1 / p.lambda + p.m * p.m * eTau,
    digamma(p.alpha) - Math.log(p.beta),
  ];
};

/** KL( P_h0 || P_h1 ) for the Normal-Gamma, exactly, in natural coordinates.
 *  KL = A(h1) - A(h0) - (h1 - h0) . E_h0[T] */
export const ngKl = (h0: NormalGammaNp, h1: NormalGammaNp): number => {
  const t = ngExpectedT(h0);
  const d = [h1.h1 - h0.h1, h1.h2 - h0.h2, h1.h3 - h0.h3, h1.h4 - h0.h4];
  let dot = 0;
  for (let i = 0; i < 4; i++) dot += d[i]! * t[i]!;
  return ngLogPartition(h1) - ngLogPartition(h0) - dot;
};

/** KL( N0 || N1 ) for Gaussians given in natural parameters. */
export const npKl = (a: GaussianNp, b: GaussianNp): number => {
  const { mu: m0, sigma2: v0 } = npToMoments(a);
  const { mu: m1, sigma2: v1 } = npToMoments(b);
  return 0.5 * (v0 / v1 + ((m0 - m1) * (m0 - m1)) / v1 - 1 + Math.log(v1 / v0));
};

// ── Channel storage formats ─────────────────────────────────────────────────────────────────

/** rgba32float — 4 x IEEE binary32. */
export const asF32 = (x: number): number => Math.fround(x);

/** Round-to-nearest-even to an integer. */
const rne = (y: number): number => {
  const f = Math.floor(y);
  const r = y - f;
  if (r > 0.5) return f + 1;
  if (r < 0.5) return f;
  return f % 2 === 0 ? f : f + 1;
};

/** rgba16float — 4 x IEEE binary16, round-to-nearest-even, overflow to Infinity.
 *
 *  Converts DIRECTLY from the double. An earlier version routed through `Float32Array` first and
 *  was wrong on 4 of 20012 probes by one ulp — classic DOUBLE ROUNDING (double -> f32 -> f16 is
 *  not the same as double -> f16). It is recorded here rather than quietly fixed because the
 *  self-check below is the only reason it was caught, and that is the point of having one.
 *
 *  Not `Math.f16round` because that needs an `es2025` lib; `f16RoundSelfCheck` compares against it
 *  where the runtime has it. */
export const asF16 = (x: number): number => {
  if (!Number.isFinite(x) || x === 0) return x;
  const s = x < 0 ? -1 : 1;
  const ax = Math.abs(x);
  let e = Math.floor(Math.log2(ax));
  // guard against log2 landing on the wrong side of a power of two
  if (2 ** e > ax) e -= 1;
  else if (2 ** (e + 1) <= ax) e += 1;

  if (e < -14) {
    // subnormal binary16: value = M * 2^-24. M >= 1024 promotes to the smallest normal, correctly.
    const m = rne(ax * 2 ** 24);
    return s * m * 2 ** -24;
  }
  // normal binary16: 11 significant bits, M in [1024, 2048)
  let m = rne(ax * 2 ** (10 - e));
  if (m === 2048) { m = 1024; e += 1; }
  if (e > 15) return s * Infinity;
  return s * m * 2 ** (e - 10);
};

/** Cross-check `asF16` against the platform's `Math.f16round` when the runtime has one.
 *  Returns the number of disagreements over the supplied probes (0 = agrees). */
export const f16RoundSelfCheck = (probes: readonly number[]): number => {
  const intrinsic = (Math as unknown as { f16round?: (x: number) => number }).f16round;
  if (typeof intrinsic !== "function") return -1; // not available: nothing checked, say so
  let bad = 0;
  for (const p of probes) {
    const a = asF16(p);
    const b = intrinsic(p);
    if (!(a === b || (Number.isNaN(a) && Number.isNaN(b)))) bad++;
  }
  return bad;
};

/** rgba8unorm — what `OracleRGBA.tsx` actually writes today (`createImageData`). */
export const asU8 = (x: number, lo: number, hi: number): number => {
  const t = (x - lo) / (hi - lo);
  const q = Math.max(0, Math.min(255, Math.round(t * 255)));
  return lo + (q / 255) * (hi - lo);
};
