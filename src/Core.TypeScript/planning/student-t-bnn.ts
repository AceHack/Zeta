/**
 * student-t-bnn.ts — Student-t likelihood update for a non-Gaussian BNN.
 *
 * The Gaussian likelihood in MultilayerBnn assumes observation noise is Gaussian.
 * For heavy-tailed noise (outliers, non-Gaussian DLA amplitude measurements) the
 * Student-t likelihood is more robust: its influence function redescends, so no
 * single observation can drag the posterior arbitrarily far.
 *
 * ## What this module is
 *
 * A **sequential assumed-density filter** (ADF) over a Student-t likelihood.
 * One observation at a time:
 *
 *   1. the **cavity** is the current posterior — a fresh observation's own site
 *      message is uniform, so there is nothing to divide out;
 *   2. the **tilt** is `cavity(theta) * St(y; theta, sigma2_obs, nu)`;
 *   3. the **projection** back to a Gaussian is done by MATCHING THE FIRST TWO
 *      MOMENTS OF THE TILT, computed by quadrature (`tiltedMoments`).
 *
 * ADF is EP with each site visited exactly once, in arrival order (Minka 2001,
 * ch. 3; Opper 1998). Full EP revisits sites until the messages stop moving,
 * which requires storing one message per observation — a streaming fold cannot,
 * so this module does the single pass and says so.
 *
 * ## The defect this replaces (2026-08-14)
 *
 * The previous version stored ONE factor message and divided it out of the
 * posterior to form the cavity on every update. With a single message slot that
 * division undoes the previous observation exactly, so **each observation
 * replaced its predecessor instead of joining it**: measured, `[0.5, 3.0]` and
 * `[3.0]` produced bit-identical posteriors, and so did 100 copies of `0.5`
 * against one. Only `obsCount` moved. A fold that discards all but the last
 * observation is not merely lossy — it publishes a precision that the data it
 * ignored never justified.
 *
 * That was structural rather than a missing loop: the state had one site slot,
 * and one slot cannot accumulate. The repair is not "add a loop" but "stop
 * dividing" — under ADF the cavity for a new observation IS the posterior.
 *
 * Two further defects were found in the same read and are also fixed here:
 *
 * - **factor/posterior conflation.** The old step 4 computed the moment-matched
 *   POSTERIOR mean `m + v*w*z/s` and stored it as the FACTOR mean, then step 5
 *   combined the cavity with that "factor" again — counting the observation
 *   twice on the mean and once more on the precision.
 * - **the closed form was not the Student-t projection.** Graded against
 *   numerically exact tilted moments it missed the Gaussian limit outright: at
 *   `nu = 1e12`, prior `N(0,1)`, `sigma2_obs = 0.1`, `y = 1`, the exact posterior
 *   is `N(0.909091, 0.090909)` and it returned `N(0.474138, 0.478448)`. The
 *   header claimed "for nu to infinity we recover the Gaussian EP update"; it
 *   did not. STB-16 is that falsifier, and it fails against the old formula.
 *
 * ## Why quadrature and not a closed form
 *
 * The tilted normaliser `int N(theta; m, v) St(theta; y, sigma2, nu) dtheta` has
 * no closed form — it is a Gaussian convolved with a t. Two closed forms were
 * measured against a fine reference integral over a grid of
 * `(nu, v, sigma2_obs, y)` before this was written:
 *
 * - the **log-partition-derivative** form under `Z ~ St(y; m, v + sigma2, nu)` is
 *   accurate for small residuals and diverges for outliers, returning NEGATIVE
 *   variances (e.g. `-0.0094` at `nu=10, v=1, sigma2=0.01, y=0.5`). That negative
 *   variance is what the old `Math.max(1e-10, ...)` was catching, and clamping it
 *   published a precision of 1e10 that nothing measured;
 * - the **IRLS / EM scale-mixture** step (the shape `HeavyTailFold` uses for its
 *   batch fold) is exact in the Gaussian limit and always positive, but a SINGLE
 *   step lands between the two lobes of a bimodal tilt: at `nu=3, v=1,
 *   sigma2=0.01, y=10` it returns mean `7.97` where the exact tilted mean is
 *   `0.42` — 7.4 posterior standard deviations out, at a location carrying
 *   essentially no mass.
 *
 * Neither is shippable, and the failures are in exactly the heavy-tail-plus-
 * outlier regime the module exists to serve. So the moments are computed.
 *
 * ## Honest limits
 *
 * - **Single pass, so order matters.** ADF's answer depends on the order the
 *   observations arrive in; EP's fixed point does not. `inferStudentT` is a
 *   FILTER, not a commutative fold, and must not be used where a shared
 *   conclusion has to agree across nodes that received the stream in different
 *   orders (`local-time-never-enters-the-shared-fold`). The order-invariant
 *   treatment of the same likelihood is `src/Bayesian/HeavyTailFold.fs`, which
 *   folds a whole batch and reports basins.
 * - **A Gaussian summary of a bimodal tilt is a compromise, not a location.**
 *   When the prior and a far outlier both hold mass, the moment-matched Gaussian
 *   sits between them and is wide. That is the honest report of a two-lobed
 *   belief in a one-lobed family, not a claim that the truth is in the middle.
 * - **Quadrature is a truncation.** The panels cover fourteen scales around each
 *   of the three places the tilt can concentrate; mass outside is discarded.
 *   STB-17 grades the shipped rule against an independent dense reference.
 *
 * References:
 * - Minka (2001) "A family of algorithms for approximate Bayesian inference"
 *   (ch. 3 = ADF; ch. 4 = EP as its iterated form).
 * - Opper (1998) "A Bayesian approach to online learning" — the online/ADF form.
 * - Lange, Little and Taylor (1989) "Robust statistical modeling using the t
 *   distribution" — the scale mixture and the weight `(nu+1)/(nu+z^2)`.
 * - Rasmussen and Williams, GPML (2006) sec. 3.6 — non-Gaussian sites projected
 *   by quadrature rather than by a closed form.
 * - Dawid (1973), O'Hagan (1979) — conflict resolution needs regularly varying
 *   tails; the Gaussian compromises, the heavy tail rejects.
 * Cited from standing knowledge, not page-checked.
 */

// -- Types --------------------------------------------------------------------

/** Gaussian belief: mean and variance. */
export interface GaussianBelief {
  readonly mu: number;
  readonly sigma2: number;
}

/** Student-t BNN state: posterior + last site message + hyperparameters. */
export interface StudentTState {
  /** Posterior belief over the parameter. */
  readonly posterior: GaussianBelief;
  /**
   * The EP site message left by the MOST RECENTLY absorbed observation, computed
   * as `posterior / cavity`.
   *
   * DIAGNOSTIC ONLY. It is never divided back out of the posterior — doing that
   * with a single slot is what made the fold discard every observation but the
   * last. It is kept because a future refinement pass (real EP, which needs one
   * message per site) would start from messages of exactly this shape, and
   * because persistence already round-trips it.
   *
   * A site variance is legitimately NEGATIVE when an observation sharpened the
   * belief less than a Gaussian would have, and `Infinity` when it changed the
   * precision not at all. Both are represented rather than clamped.
   */
  readonly factorMu: number;
  readonly factorSigma2: number;
  /** Degrees of freedom nu (nu=1: Cauchy, nu to infinity: Gaussian). */
  readonly nu: number;
  /** Observation noise variance sigma2_obs. */
  readonly obsVariance: number;
  /** Number of observations absorbed. */
  readonly obsCount: number;
}

/** Result of one Student-t update. */
export interface StudentTUpdateResult {
  readonly state: StudentTState;
  /**
   * The scale-mixture weight `w = (nu+1)/(nu+z^2)` at the cavity residual
   * (Lange-Little-Taylor 1989). `w < 1` means the observation looked like an
   * outlier and the t discounted it.
   *
   * This is a DIAGNOSTIC about the observation, not a term in the update: the
   * posterior comes from the tilted moments, not from a weighted Gaussian step.
   * A one-step weighted update was measured and rejected — see the header.
   */
  readonly robustnessWeight: number;
  /** The standardised residual `z = (y - m_cav) / sqrt(v_cav + sigma2_obs)`. */
  readonly standardisedResidual: number;
  /** Whether the observation was treated as an outlier (|z| > 2). */
  readonly isOutlier: boolean;
  /**
   * True when the projected variance had to be put on `EP_VARIANCE_FLOOR`, i.e.
   * the quadrature did not return a usable second moment. A posterior carrying
   * this flag has a precision that was manufactured by a clamp, and no check may
   * read its variance as an error bar. Reported by the producer instead of being
   * sniffed by the consumer.
   */
  readonly varianceOnFloor: boolean;
}

// -- Constructor --------------------------------------------------------------

/**
 * Create a new Student-t BNN state with a Gaussian prior.
 *
 * ## Why `nu` comes first and has no default
 *
 * It used to be the third parameter with a default of `4.0`, documented as "robust
 * but not too heavy-tailed". That is a **silent vote**. `nu` is not a cosmetic knob:
 * it decides which observation the posterior believes when observations conflict.
 * Measured on the sibling society fold (`src/Bayesian/HeavyTailFold.fs`), five
 * members agreeing at 10 against one overconfident member at 0 resolve to the
 * quorum's answer for `nu` below 23.389306 and to the overconfident member's answer
 * above it. The constant chose the winner, and nobody measured the constant.
 *
 * So it is required, it is the first argument, and it is validated. A guess is still
 * legal — pass one — but it can no longer be made by saying nothing. The defensible
 * form of the assumption is an INTERVAL whose verdict does not move across it, plus
 * a coverage check; `tailSensitivity` below is this module's version of that test,
 * and `HeavyTailFold` is the full treatment.
 *
 * @param nu Degrees of freedom. REQUIRED. `nu=1` is Cauchy, `nu` to infinity is
 *   Gaussian. Must be finite and positive. Note that the modelled noise has no
 *   fourth moment for `nu <= 4`, so the old default sat exactly on the pole of the
 *   kurtosis `6/(nu-4)` — any method-of-moments estimate of `nu` is undefined there.
 * @param priorMu Prior mean (default 0)
 * @param priorSigma2 Prior variance (default 1). Must be finite and positive.
 * @param obsVariance Observation noise scale sigma2_obs (default 0.1). Must be
 *   finite and positive: at zero the likelihood is a point mass and the projection
 *   is not defined.
 */
export function createStudentTState(
  nu: number,
  priorMu = 0.0,
  priorSigma2 = 1.0,
  obsVariance = 0.1
): StudentTState {
  if (!Number.isFinite(nu) || nu <= 0) {
    throw new RangeError(
      `nu must be finite and > 0 (a tail assumption, stated explicitly); got ${String(nu)}`
    );
  }
  if (!Number.isFinite(priorSigma2) || priorSigma2 <= 0) {
    throw new RangeError(`priorSigma2 must be finite and > 0; got ${String(priorSigma2)}`);
  }
  if (!Number.isFinite(obsVariance) || obsVariance <= 0) {
    throw new RangeError(`obsVariance must be finite and > 0; got ${String(obsVariance)}`);
  }
  if (!Number.isFinite(priorMu)) {
    throw new RangeError(`priorMu must be finite; got ${String(priorMu)}`);
  }
  return {
    posterior: { mu: priorMu, sigma2: priorSigma2 },
    // no observation has been absorbed, so there is no site message yet:
    // infinite variance is the uniform message, stated exactly rather than as 1e10
    factorMu: priorMu,
    factorSigma2: Number.POSITIVE_INFINITY,
    nu,
    obsVariance,
    obsCount: 0,
  };
}

// -- The projection: tilted moments by quadrature ------------------------------

/**
 * 8-point Gauss-Legendre abscissae on [-1, 1], positive half (the rule is
 * symmetric). The table is not trusted on sight: STB-15 grades the whole rule
 * against the closed-form Gaussian conjugate posterior, and STB-17 against an independent dense reference.
 */
const GL8_ABSCISSA: readonly number[] = [
  0.1834346424956498, 0.5255324099163290, 0.7966664774136267, 0.9602898564975363,
];

/** The matching 8-point Gauss-Legendre weights (positive half). */
const GL8_WEIGHT: readonly number[] = [
  0.3626837833783620, 0.3137066458778873, 0.2223810344533745, 0.1012285362903763,
];

/**
 * Panel edges, in units of the local scale, laid out around each place the tilt
 * can concentrate. Geometric rather than uniform so a narrow feature gets narrow
 * panels and the far tail does not get thousands of them.
 */
const PANEL_LADDER: readonly number[] = [
  0, 0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 9, 14,
];

/** How many scales out the integration range extends before the mass is dropped. */
const PANEL_REACH = 14;

/** Moments of the tilted distribution, plus whether they are usable. */
export interface TiltedMoments {
  readonly mu: number;
  readonly sigma2: number;
  /** log of the tilted normaliser, up to the Gaussian and t constants. */
  readonly logZ: number;
  /** False when the quadrature produced a non-finite or non-positive variance. */
  readonly usable: boolean;
}

/**
 * Real stationary points of the log-tilt.
 *
 * `d/dtheta [ log N(theta; m, v) + log St(theta; y, s2obs, nu) ] = 0` clears to a
 * CUBIC in theta:
 *
 *   theta^3 - (2y+m) theta^2
 *     + (y^2 + 2my + nu*s2obs + v(nu+1)) theta
 *     - (m y^2 + nu*s2obs*m + v(nu+1) y) = 0
 *
 * so the tilt has at most three stationary points and they are available in closed
 * form. That matters because the tilt's mode is NOT in general at the cavity mean,
 * at the observation, or at their Gaussian combination: measured, for
 * `m=0, v=0.01, y=25, s2obs=0.001, nu=5000` the mode is at `theta = 2.17` while
 * those three candidates sit at `0`, `25` and `22.7`. Panelling on the candidates
 * alone left the only peak inside a coarse panel and the projection declined.
 *
 * Solved by Cardano rather than by iteration: closed form is exact, costs nothing,
 * and has no data-dependent stopping rule to diverge across oracles (DST).
 */
function tiltStationaryPoints(
  m: number,
  v: number,
  y: number,
  s2obs: number,
  nu: number
): number[] {
  const b = -(2 * y + m);
  const c = y * y + 2 * m * y + nu * s2obs + v * (nu + 1);
  const d = -(m * y * y + nu * s2obs * m + v * (nu + 1) * y);
  const p = c - (b * b) / 3;
  const q = (2 * b * b * b) / 27 - (b * c) / 3 + d;
  const shift = -b / 3;
  const disc = (q / 2) * (q / 2) + (p / 3) * (p / 3) * (p / 3);
  const out: number[] = [];
  if (disc > 0) {
    const r = Math.sqrt(disc);
    const u = Math.cbrt(-q / 2 + r);
    const w = Math.cbrt(-q / 2 - r);
    out.push(u + w + shift);
  } else if (p < 0) {
    const rad = 2 * Math.sqrt(-p / 3);
    const arg = Math.max(-1, Math.min(1, ((3 * q) / (2 * p)) * Math.sqrt(-3 / p)));
    const phi = Math.acos(arg) / 3;
    for (let k = 0; k < 3; k++) {
      out.push(rad * Math.cos(phi - (2 * Math.PI * k) / 3) + shift);
    }
  } else {
    out.push(shift);
  }
  return out.filter((t) => Number.isFinite(t));
}

/**
 * Panel edges for the quadrature.
 *
 * Ladders of geometrically-spaced edges are laid around every place the tilt can
 * concentrate, each in its own local scale:
 *
 * - the cavity `m` at scale `sqrt(v)` — the prior lobe;
 * - the observation `y` at scale `sqrt(s2obs)` — where the likelihood peaks;
 * - their Gaussian combination — the single lobe when the two agree;
 * - every real stationary point of the tilt, at its own curvature scale — which is
 *   where the mass actually is, including the second lobe of a bimodal tilt.
 *
 * Plus a uniform backstop so no region of the range is left unsampled. The whole
 * layout is a closed-form function of the four parameters: fixed cost, no
 * adaptivity, no data-dependent stopping rule (DST).
 */
function panelEdges(m: number, v: number, y: number, s2obs: number, nu: number): number[] {
  const sv = Math.sqrt(v);
  const so = Math.sqrt(s2obs);
  const precC = 1 / v + 1 / s2obs;
  const sc = Math.sqrt(1 / precC);
  const mc = (m / v + y / s2obs) / precC;
  const reach = PANEL_REACH * Math.max(sv, so);
  const lo = Math.min(m, y) - reach;
  const hi = Math.max(m, y) + reach;
  const centres: number[] = [m, y, mc];
  const scales: number[] = [sv, so, sc];
  for (const t of tiltStationaryPoints(m, v, y, s2obs, nu)) {
    const r = t - y;
    const den = nu * s2obs + r * r;
    const curvature = 1 / v + ((nu + 1) * (nu * s2obs - r * r)) / (den * den);
    if (curvature > 0) {
      centres.push(t);
      scales.push(Math.sqrt(1 / curvature));
    }
  }
  const raw: number[] = [lo, hi];
  const BACKSTOP = 32;
  for (let i = 1; i < BACKSTOP; i++) raw.push(lo + ((hi - lo) * i) / BACKSTOP);
  for (let i = 0; i < centres.length; i++) {
    const ci = centres[i] as number;
    const si = scales[i] as number;
    if (!Number.isFinite(ci) || !Number.isFinite(si) || si <= 0) continue;
    for (const a of PANEL_LADDER) raw.push(ci - a * si, ci + a * si);
  }
  const inside = raw.filter((e) => Number.isFinite(e) && e >= lo && e <= hi);
  inside.sort((p, q) => p - q);
  const span = hi - lo;
  const edges: number[] = [];
  for (const e of inside) {
    const last = edges[edges.length - 1];
    if (last === undefined || e - last > span * 1e-12) edges.push(e);
  }
  return edges;
}

/**
 * Log of the unnormalised tilt: `log N(theta; m, v) + log St(y; theta, s2obs, nu)`,
 * with the theta-independent constants dropped.
 */
function logTilt(
  theta: number,
  m: number,
  v: number,
  y: number,
  s2obs: number,
  nu: number
): number {
  const d = theta - m;
  const r = theta - y;
  return -0.5 * (d * d) / v - ((nu + 1) / 2) * Math.log1p((r * r) / (nu * s2obs));
}

/**
 * **The projection.** First two moments of `N(theta; m, v) * St(theta; y, s2obs, nu)`,
 * by panelled Gauss-Legendre quadrature.
 *
 * Evaluated in log space with the maximum subtracted, because the normaliser is
 * legitimately of order `exp(-500)` when an observation is far from the cavity, and
 * a linear-space sum underflows to zero there and reports whatever noise survives.
 *
 * The variance is accumulated about the computed mean rather than as
 * `E[x^2] - E[x]^2`, which cancels catastrophically once the posterior is sharp.
 */
export function tiltedMoments(
  m: number,
  v: number,
  y: number,
  s2obs: number,
  nu: number
): TiltedMoments {
  const bad: TiltedMoments = { mu: m, sigma2: v, logZ: Number.NEGATIVE_INFINITY, usable: false };
  if (!Number.isFinite(m) || !Number.isFinite(y)) return bad;
  if (!Number.isFinite(v) || v <= 0) return bad;
  if (!Number.isFinite(s2obs) || s2obs <= 0) return bad;
  if (!Number.isFinite(nu) || nu <= 0) return bad;

  const edges = panelEdges(m, v, y, s2obs, nu);
  if (edges.length < 2) return bad;

  const nodes: number[] = [];
  const scaledWeights: number[] = [];
  const logs: number[] = [];
  let maxLog = Number.NEGATIVE_INFINITY;

  for (let p = 0; p + 1 < edges.length; p++) {
    const a = edges[p] as number;
    const b = edges[p + 1] as number;
    const half = 0.5 * (b - a);
    const mid = 0.5 * (a + b);
    if (!(half > 0)) continue;
    for (let k = 0; k < GL8_ABSCISSA.length; k++) {
      const x = GL8_ABSCISSA[k] as number;
      const w = (GL8_WEIGHT[k] as number) * half;
      const left = mid - half * x;
      const right = mid + half * x;
      const lL = logTilt(left, m, v, y, s2obs, nu);
      const lR = logTilt(right, m, v, y, s2obs, nu);
      nodes.push(left, right);
      scaledWeights.push(w, w);
      logs.push(lL, lR);
      if (lL > maxLog) maxLog = lL;
      if (lR > maxLog) maxLog = lR;
    }
  }

  if (!Number.isFinite(maxLog)) return bad;

  let z = 0;
  let z1 = 0;
  for (let i = 0; i < nodes.length; i++) {
    const f = Math.exp((logs[i] as number) - maxLog) * (scaledWeights[i] as number);
    z += f;
    z1 += f * (nodes[i] as number);
  }
  if (!(z > 0) || !Number.isFinite(z) || !Number.isFinite(z1)) return bad;

  const mu = z1 / z;
  let z2 = 0;
  for (let i = 0; i < nodes.length; i++) {
    const f = Math.exp((logs[i] as number) - maxLog) * (scaledWeights[i] as number);
    const d = (nodes[i] as number) - mu;
    z2 += f * d * d;
  }
  const sigma2 = z2 / z;
  if (!Number.isFinite(mu) || !Number.isFinite(sigma2) || sigma2 <= 0) {
    return { mu: Number.isFinite(mu) ? mu : m, sigma2: v, logZ: maxLog + Math.log(z), usable: false };
  }
  return { mu, sigma2, logZ: maxLog + Math.log(z), usable: true };
}

// -- The update ---------------------------------------------------------------

/**
 * The floor a projected variance is put on when the quadrature cannot return a
 * usable second moment. A posterior sitting on it is a DEGENERATE fit, not a
 * precise one, and the result carries `varianceOnFloor` to say so — reading its
 * variance as an error bar grades a conclusion against an artifact.
 *
 * Note what no longer reaches it: the old closed form's factor-variance update
 * went NEGATIVE for small `nu` and the clamp caught it routinely, publishing a
 * precision of 1e10 from a formula that had failed. The moments are computed now,
 * so a genuine variance is positive by construction and the floor is a guard
 * against numerical breakdown rather than a routine occurrence. STB-19 measures
 * how often it fires.
 */
export const EP_VARIANCE_FLOOR = 1e-10;

/**
 * Absorb one observation `y`. The cavity is the CURRENT posterior — a fresh
 * observation's site message is uniform, so nothing is divided out. That is the
 * whole repair: the old code divided out the single stored site message, which
 * undid the previous observation and made the fold reflect only the last one.
 */
export function updateStudentT(state: StudentTState, y: number): StudentTUpdateResult {
  const { posterior, nu, obsVariance } = state;

  const vCav = posterior.sigma2;
  const mCav = posterior.mu;
  const z = (y - mCav) / Math.sqrt(vCav + obsVariance);
  const w = (nu + 1) / (nu + z * z);

  const refuse = (reason: boolean): StudentTUpdateResult => ({
    state,
    robustnessWeight: 1.0,
    standardisedResidual: 0.0,
    isOutlier: false,
    varianceOnFloor: reason,
  });

  // A non-finite observation is not evidence. It does not move the belief and it
  // does not count.
  if (!Number.isFinite(y)) return refuse(false);

  const projected = tiltedMoments(mCav, vCav, y, obsVariance, nu);
  if (!projected.usable) {
    // The projection failed. Absorbing a manufactured posterior would be worse
    // than declining, so the belief stands and the failure is reported.
    return {
      state: { ...state, obsCount: state.obsCount + 1 },
      robustnessWeight: w,
      standardisedResidual: z,
      isOutlier: Math.abs(z) > 2.0,
      varianceOnFloor: true,
    };
  }

  const vPost = Math.max(EP_VARIANCE_FLOOR, projected.sigma2);
  const varianceOnFloor = projected.sigma2 <= EP_VARIANCE_FLOOR;

  // The site message this observation leaves behind: posterior / cavity, in
  // natural parameters. Negative precision is a legitimate site and is kept as a
  // negative variance rather than clamped; it is never divided back out.
  const sitePrec = 1 / vPost - 1 / vCav;
  const siteSigma2 = sitePrec === 0 ? Number.POSITIVE_INFINITY : 1 / sitePrec;
  const siteMu =
    sitePrec === 0 ? projected.mu : (projected.mu / vPost - mCav / vCav) / sitePrec;

  return {
    state: {
      posterior: { mu: projected.mu, sigma2: vPost },
      factorMu: Number.isFinite(siteMu) ? siteMu : projected.mu,
      factorSigma2: siteSigma2,
      nu,
      obsVariance,
      obsCount: state.obsCount + 1,
    },
    robustnessWeight: w,
    standardisedResidual: z,
    isOutlier: Math.abs(z) > 2.0,
    varianceOnFloor,
  };
}

/**
 * Fold a stream of observations into the Student-t BNN.
 *
 * This is a FILTER, not a commutative fold: each observation is projected against
 * the belief the ones before it produced, so the answer depends on arrival order.
 * See the header's honest limits, and `src/Bayesian/HeavyTailFold.fs` for the
 * order-invariant batch treatment of the same likelihood.
 */
export function inferStudentT(
  observations: readonly number[],
  state: StudentTState
): { state: StudentTState; results: StudentTUpdateResult[] } {
  let current = state;
  const results: StudentTUpdateResult[] = [];
  for (const y of observations) {
    const result = updateStudentT(current, y);
    current = result.state;
    results.push(result);
  }
  return { state: current, results };
}

/**
 * The effective sample size: the sum of the robustness weights, each NORMALISED
 * by its peak `(nu+1)/nu` so an observation sitting exactly on the belief weighs
 * exactly 1.
 *
 * Without that normalisation the raw weight peaks at `(nu+1)/nu > 1` and a run of
 * well-behaved observations sums to MORE than its own count — an "effective
 * sample size" larger than the sample, which is the same class of overclaim as a
 * precision nothing measured. `HeavyTailFold.Mode.Weights` carries the identical
 * correction, for the identical reason.
 *
 * For Gaussian noise (no outliers): ESS is close to obsCount.
 * For heavy-tailed noise: ESS < obsCount (outliers are downweighted).
 */
export function effectiveSampleSize(results: readonly StudentTUpdateResult[]): number {
  return results.reduce((s, r) => {
    const nu = r.state.nu;
    const peak = (nu + 1) / nu;
    return s + r.robustnessWeight / peak;
  }, 0);
}

/** The outlier fraction: fraction of observations with |z| > 2. */
export function outlierFraction(results: readonly StudentTUpdateResult[]): number {
  if (results.length === 0) return 0;
  return results.filter((r) => r.isOutlier).length / results.length;
}

// -- The falsifier the tail assumption has to carry ---------------------------

/** What a tail-sensitivity check found. Three states, and the third is the honest one. */
export type TailVerdict =
  /** The declared interval moves the answer by less than the answer's own error bar. */
  | "tail-independent"
  /** The answer belongs to the assumption. No single nu inside the interval may be published. */
  | "tail-dependent"
  /**
   * At least one endpoint produced a posterior with no trustworthy error bar — the
   * projection declined, or the variance ended on the EP floor. NOT a pass and NOT
   * a failure: the check declines, which is the only claim it is entitled to make.
   */
  | "not-gradable";

export interface TailSensitivity {
  /** Posterior mean when the stream is folded at the heaviest admissible tail. */
  readonly muAtHeavyTail: number;
  /** Posterior mean when the stream is folded at the lightest admissible tail. */
  readonly muAtLightTail: number;
  /** The tightest posterior standard deviation either fold would publish. */
  readonly tightestSigma: number;
  readonly verdict: TailVerdict;
}

/**
 * Fold the same observation stream at both endpoints of a declared nu-interval and
 * compare how far the posterior mean moves against the posterior's own standard
 * deviation.
 *
 * This is the cheap, local form of the scheme-independence gate in
 * `src/Bayesian/HeavyTailFold.fs`. The comparison is between a *systematic* (how much
 * the assumption moves the answer) and a *statistical* (how precisely the answer is
 * known), both in the units of the parameter, so it introduces no new free constant to
 * replace the one the required-`nu` change removed. A POINT interval is refused for the
 * same reason `HeavyTailFold` refuses one: a verdict that depends on a single unmeasured
 * number cannot be falsified.
 *
 * Degeneracy is now read from the folds themselves (`varianceOnFloor` on any update)
 * rather than inferred by comparing the published variance against a constant. A
 * producer that knows it manufactured a number should say so; a consumer guessing from
 * the value is one threshold away from grading an artifact.
 */
export function tailSensitivity(
  nuLo: number,
  nuHi: number,
  observations: readonly number[],
  priorMu = 0.0,
  priorSigma2 = 1.0,
  obsVariance = 0.1
): TailSensitivity {
  if (!(nuHi > nuLo)) {
    throw new RangeError(
      `nuHi must be strictly greater than nuLo - a POINT tail index is not a checkable assumption; got [${String(nuLo)}, ${String(nuHi)}]`
    );
  }
  const heavy = inferStudentT(
    observations,
    createStudentTState(nuLo, priorMu, priorSigma2, obsVariance)
  );
  const light = inferStudentT(
    observations,
    createStudentTState(nuHi, priorMu, priorSigma2, obsVariance)
  );
  const declined =
    heavy.results.some((r) => r.varianceOnFloor) || light.results.some((r) => r.varianceOnFloor);
  const s2Heavy = heavy.state.posterior.sigma2;
  const s2Light = light.state.posterior.sigma2;
  const tightestSigma = Math.sqrt(Math.min(s2Heavy, s2Light));
  const onFloor = s2Heavy <= EP_VARIANCE_FLOOR * 10 || s2Light <= EP_VARIANCE_FLOOR * 10;
  const moved = Math.abs(heavy.state.posterior.mu - light.state.posterior.mu);
  const verdict: TailVerdict =
    declined || onFloor ? "not-gradable" : moved > tightestSigma ? "tail-dependent" : "tail-independent";
  return {
    muAtHeavyTail: heavy.state.posterior.mu,
    muAtLightTail: light.state.posterior.mu,
    tightestSigma,
    verdict,
  };
}
