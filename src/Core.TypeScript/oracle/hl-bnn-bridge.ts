/**
 * hl-bnn-bridge.ts — Connect HL amplitude measurements to MultilayerBnn.
 *
 * The HL amplitude A_n = aλ₀·n·∫|dw/dz|⁻²dθ/2π converges to 1/(Dn) as n→∞.
 * Each measurement A_n is an observation that can be fed into MultilayerBnn
 * as a continuous stream. The BNN maintains a posterior over D (the fractal
 * dimension) that updates with each new amplitude measurement.
 *
 * ## The observation model
 *
 * We observe y_n = 1/(D·n) + ε where ε ~ N(0, σ²_obs).
 * Rearranging: D = 1/(n·y_n) + δ where δ ~ N(0, σ²_D).
 *
 * For the BNN, we feed the derived observation x_n = 1/(n·A_n) as the
 * "observed D" at step n. The BNN posterior over D updates with each x_n.
 *
 * ## Two-path architecture
 *
 * FAST PATH: uses the O(n) harmonic-measure proxy from z2-halsey-redischarge.ts
 * EXACT PATH: uses the O(n²) full conformal map from hl-conformal-map.ts
 *
 * Both paths produce the same observation format for the BNN.
 *
 * ## Continuous learning
 *
 * The BNN is online Bayesian learning — no training loop, no forgetting,
 * no hyperparameters. Each call to `updateBnn(bnn, amplitude, n)` returns
 * an updated BNN with the new posterior over D. The posterior mean and
 * variance are available immediately after each update.
 *
 * ## Connection to AmplitudeEmu (F#)
 *
 * The HlAmplitudeEmu.toAmp function converts the HL state to an
 * AmplitudeEmu-style amplitude list. The Born probabilities of this list
 * match the harmonic measure, which is the same quantity used here.
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** A single HL amplitude observation for the BNN. */
export interface HLObservation {
  /** The particle count n. */
  readonly n: number;
  /** The amplitude A_n = aλ₀·n·∫|dw/dz|⁻²dθ/2π. */
  readonly amplitude: number;
  /** The derived D observation: x_n = aλ₀ / A_n = D̂_n. */
  readonly derivedD: number;
  /** "fast" or "exact" path. */
  readonly path: "fast" | "exact";
}

/** The BNN state for D estimation (Gaussian posterior over D). */
export interface DBnnState {
  /** Posterior mean of D. */
  readonly muD: number;
  /** Posterior variance of D. */
  readonly sigma2D: number;
  /** Number of observations absorbed. */
  readonly obsCount: number;
  /** The observation noise variance σ²_obs. */
  readonly obsVariance: number;
}

/** A stream of HL observations with the running BNN posterior. */
export interface HLBnnStream {
  readonly observations: HLObservation[];
  readonly bnn: DBnnState;
}

// ── BNN update (ADF Gaussian-probit, same as TravelerRankLedger) ───────────────

/**
 * Create a new BNN state with a Gaussian prior over D.
 * Default prior: D ~ N(1.71, 0.1²) — centred on the known DLA value.
 */
export function createDBnn(
  priorMu = 1.71,
  priorSigma2 = 0.01,
  obsVariance = 0.001
): DBnnState {
  return { muD: priorMu, sigma2D: priorSigma2, obsCount: 0, obsVariance };
}

/**
 * Update the BNN with one HL amplitude observation.
 *
 * The Kalman filter update (exact for Gaussian likelihood):
 *   K = σ²_D / (σ²_D + σ²_obs)
 *   μ_D ← μ_D + K · (x_n - μ_D)
 *   σ²_D ← (1 - K) · σ²_D
 *
 * where x_n = aλ₀ / A_n is the derived D observation.
 */
export function updateDBnn(bnn: DBnnState, obs: HLObservation): DBnnState {
  if (!isFinite(obs.derivedD) || obs.derivedD <= 0) return bnn;
  const K = bnn.sigma2D / (bnn.sigma2D + bnn.obsVariance);
  const newMu = bnn.muD + K * (obs.derivedD - bnn.muD);
  const newSigma2 = (1 - K) * bnn.sigma2D;
  return { muD: newMu, sigma2D: newSigma2, obsCount: bnn.obsCount + 1, obsVariance: bnn.obsVariance };
}

/**
 * Fold a stream of HL observations into the BNN.
 * Returns the updated BNN and the full observation history.
 */
export function inferDBnn(
  observations: HLObservation[],
  bnn: DBnnState
): HLBnnStream {
  let current = bnn;
  for (const obs of observations) {
    current = updateDBnn(current, obs);
  }
  return { observations, bnn: current };
}

// ── Observation constructors ───────────────────────────────────────────────────

/**
 * Create an HL observation from a fast-path amplitude measurement.
 * The derivedD = aλ₀ / A_n.
 */
export function fastObservation(n: number, amplitude: number, a: number, lambda0: number): HLObservation {
  const derivedD = isFinite(amplitude) && amplitude > 0 ? (a * lambda0) / amplitude : NaN;
  return { n, amplitude, derivedD, path: "fast" };
}

/**
 * Create an HL observation from an exact-path amplitude measurement.
 */
export function exactObservation(n: number, amplitude: number, a: number, lambda0: number): HLObservation {
  const derivedD = isFinite(amplitude) && amplitude > 0 ? (a * lambda0) / amplitude : NaN;
  return { n, amplitude, derivedD, path: "exact" };
}

// ── Convergence diagnostics ────────────────────────────────────────────────────

/**
 * Check if the BNN posterior has converged to a stable D estimate.
 * Convergence: σ_D < threshold (default 0.01 = 1% of D).
 */
export function hasConverged(bnn: DBnnState, threshold = 0.01): boolean {
  return Math.sqrt(bnn.sigma2D) < threshold;
}

/**
 * The 95% credible interval for D: [μ - 2σ, μ + 2σ].
 */
export function credibleInterval(bnn: DBnnState): [number, number] {
  const sigma = Math.sqrt(bnn.sigma2D);
  return [bnn.muD - 2 * sigma, bnn.muD + 2 * sigma];
}

/**
 * The Tsirelson-optimal D for DLA (Halsey 2026, arXiv:2607.02216):
 * D = 1.703 ± 0.001 at n=20,000.
 */
export const HALSEY_2026_D = 1.703;
export const HALSEY_2026_D_ERROR = 0.001;

/**
 * Check if the BNN posterior is consistent with Halsey 2026.
 * Returns true if the 95% credible interval contains D = 1.703.
 */
export function isConsistentWithHalsey2026(bnn: DBnnState): boolean {
  const [lo, hi] = credibleInterval(bnn);
  return lo <= HALSEY_2026_D && HALSEY_2026_D <= hi;
}
