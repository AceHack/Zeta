/**
 * society-heat-readout.ts -- what the society may honestly SAY about its own BNN.
 *
 * Split out of `society-evolution-runner.ts` because the runner is a CLI shell and
 * these are pure folds: the shell does I/O, the fold makes claims, and only the fold
 * needs a falsifier. Everything here is a total function of a `DimensionalBnn`.
 */

/**
 * ## The three defects this module exists to answer (all measured 2026-08-14)
 *
 * ### 1. A prior published under a name that promises a posterior
 *
 * The runner built a fresh `createDimensionalBnn()` and published its posteriors as
 * `PriorHint`s on every 30-minute tick. Nothing had ever been absorbed into it, so
 * every hint carried `mu = 0, sigma2 = 1, obsCount = 0` -- the constructor's prior,
 * verbatim. All 567 `mu` values across the 82 evolution events already on `main` are
 * `0`; not one of them is a measurement.
 *
 * That is not a wiring defect in the sense of "observations exist and never arrive".
 * It was checked: `absorbError` is called only from `ace/ace-cli.ts`,
 * `discovery/zeta-transport-cell.ts` and `discovery/udp-lossy-transport.ts`, each into
 * a BNN private to ITS OWN process, and `bayesian/bnn-persistence.ts` -- whose header
 * names `docs/observe-events/bnn-state.json` as living "in the same G-set as the
 * society evolution events" -- had ZERO callers of `saveBnnState` or `loadBnnState`.
 * The path is now soldered at both ends by `society-bnn.ts` (081M005CGB7). The feed
 * is this generation, not a re-fold of the event log.
 *
 * So "PriorHint" is an honest NAME for a prior, and the defect is downstream: the
 * receiver credited it as evidence. `mergePriorHint` weighted the hint by `1/sigma2`
 * alone and ignored `obsCount` entirely, so a zero-observation hint injected real
 * precision. Measured, receiver at `N(0,1)`, `trustWeight = 0.5`:
 *
 * | zero-observation hints merged | sigma  | precision |
 * |---|---|---|
 * | 1  | 0.816497 | 1.5  |
 * | 10 | 0.408248 | 6.0  |
 * | 82 (the count already on main) | 0.154303 | 42.0 |
 *
 * Unbounded, and the heartbeat runs every 30 minutes forever. That guard now lives in
 * `mergePriorHint`; this module closes the producer side by refusing to SEND a hint
 * that no observation supports, and by reading `obsCount` from the state instead of
 * writing the literal `0` the runner used to hardcode.
 *
 * ### 2. `mu` is not a rate, so `mu * 1e6` is not a ppm
 *
 * The old readout computed `transportPpm = round(mu * 1_000_000)` and called it a
 * transport error rate. `mu` is the posterior mean of the EP parameter whose
 * observation alphabet is `SEVERITY_Z` (info 0.5, warn 1, error 2, fatal 4). It is
 * not a probability and it is not bounded by 1. Measured on this exact BNN
 * (`nu = 3`, prior `N(0,1)`, `obsVariance = 1.0`), transport dimension:
 *
 * | stream | mu | sigma |
 * |---|---|---|
 * | 6x warn  | 0.871518 | 0.375379 |
 * | 6x error | 1.769272 | 0.404178 |
 * | 20x error| 1.940259 | 0.206826 |
 * | 100x warn| 0.992991 | 0.087849 |
 *
 * A steady stream of ordinary `error`s therefore published **1,940,259 ppm** -- 194%
 * of a fraction, against a `MAX_TEMPERATURE_PPM` of 1,000,000. The repair divides by
 * `MAX_SEVERITY_Z`, a number that comes from the alphabet rather than from taste, so
 * both sides of the ratio are severity z-scores and the quotient is dimensionless.
 *
 * ### 3. Four thresholds, of which one was inert and two produced unreachable bands
 *
 * The old code fed a synthetic `BatchSummary` to `batchTemperatureBand`:
 *
 *     { failedItems: mu > 0.1 ? 1 : 0, unaccountedHeat: mu > 0.5 ? 1 : 0 }
 *
 * `unaccountedHeatPpm` returns 0 when `unaccountedHeat <= 0`, before `failedItems` is
 * ever read; when it is 1, `failedItems` only sets a denominator that is already
 * clamped to `max(1, ...)`. Swept over `mu` in [0, 4] at 1e-3 resolution, forcing
 * `failedItems` to 1 or to 0 changed the band at NO value of `mu`. The 0.1 cut was
 * dead. And the reachable set was `{cold: mu <= 0.5, critical: mu > 0.5}`:
 * **`warm` and `hot` were structurally unreachable**, against a comment advertising
 * "cold -> warm -> hot -> critical". A warn-only stream and a fatal-only stream both
 * read `critical`. That is the #10553 shape exactly -- an unreachable verdict that
 * looks like a property of the model and is a property of the bug.
 *
 * ## Bands narrower than the error bar: refuse, and say what you refused
 *
 * The four old cut-points 0.1 / 0.4 / 0.5 / 0.6 sat 0.1 apart in `mu`. Against the
 * `sigma` this BNN actually publishes that is 0.265 sigma at six observations
 * (sigma 0.377964) and 0.100 sigma at the prior (sigma 1.0) -- the verdict flips on
 * movement several times smaller than its own error bar.
 *
 * Widening the bands would have been a second unmeasured vote. Instead the band is
 * declared only when the +/-1 sigma interval does not straddle a band edge:
 * `band(mu - sigma) === band(mu) === band(mu + sigma)`, otherwise `indeterminate`.
 * This is `tailSensitivity`'s gate in a different unit -- a SYSTEMATIC compared with
 * a STATISTICAL, both in ppm -- and it adds no free constant, because the edges are
 * the heat module's existing `WARM_/HOT_TEMPERATURE_MAX_PPM`.
 *
 * The point estimate is still reported (`pointBand`) alongside the interval endpoints,
 * so a consumer that needs a band unconditionally is not broken by the refusal; it just
 * has to ask for the un-declared number by its honest name. No current consumer reads
 * either -- checked: nothing parses `heatReadout` back out of `docs/observe-events`,
 * and `darkhall-ui`'s `HeatReadout` is a different, unrelated type.
 *
 * ## Reported, not fixed (discovery/ was held by another agent)
 *
 * `discovery/zeta-transport-cell.ts` `mergePriorHints` computes `mergePriorHint(...)`
 * into `merged`, uses `merged` ONLY to format a log string, and then absorbs an
 * envelope with `severity: "info"` — a constant 0.5 — so a hint saying `mu = 4` and a
 * hint saying `mu = 0` land identically. The EP arithmetic is computed and discarded.
 * Filed as 081M005CBQ6087G0R003N21Z9J with the falsifier the fix must carry.
 */

import {
  temperatureBand,
  MAX_TEMPERATURE_PPM,
  WARM_TEMPERATURE_MAX_PPM,
  type TemperatureBand,
} from "../darkhall-ui/heat";
import { MAX_SEVERITY_Z, ERROR_DIMENSIONS, type ErrorDimension } from "../protocol/error-envelope";
import type { PriorHint } from "../protocol/batch-teaching-envelope";
import type { DimensionalBnn } from "./error-bnn-bridge";

/** A band, or the refusal to name one. `indeterminate` is NOT a fifth temperature. */
export type DeclaredBand = TemperatureBand | "indeterminate";

/** A direction of travel, or the refusal to name one. */
export type Trend = "warming" | "recovering" | "stable" | "indeterminate";

/** Whether a published belief rests on observations or only on the constructor. */
export type EvidenceTier = "prior" | "posterior";

/** One dimension's belief, WITH the two things a claim about it needs: its error bar and its evidence count. */
export interface DimensionBelief {
  readonly dimension: ErrorDimension;
  readonly mu: number;
  readonly sigma2: number;
  /** `sqrt(sigma2)`. Carried explicitly so no consumer has to remember to take the root. */
  readonly sigma: number;
  readonly robustnessWeight: number;
  /** Observations absorbed. `0` means this is the constructor's prior. */
  readonly obsCount: number;
  readonly evidence: EvidenceTier;
}

/**
 * Read one dimension's belief off the BNN, `obsCount` included.
 *
 * `dimensionPosterior` deliberately does not return `obsCount`, and changing its
 * contract is #10563's named gap, so this reads `bnn.states` -- which is on the public
 * `DimensionalBnn` interface -- directly. That keeps this repair off the file #10563
 * is rewriting, and it is why `obsCount` can be truthful without a merge conflict.
 */
export function dimensionBelief(bnn: DimensionalBnn, dimension: ErrorDimension): DimensionBelief {
  const state = bnn.states.get(dimension);
  const mu = state ? state.posterior.mu : 0;
  const sigma2 = state ? state.posterior.sigma2 : 1;
  const obsCount = state ? state.obsCount : 0;
  return {
    dimension,
    mu,
    sigma2,
    sigma: Math.sqrt(sigma2),
    robustnessWeight: bnn.robustnessWeights.get(dimension) ?? 1,
    obsCount,
    evidence: obsCount > 0 ? "posterior" : "prior",
  };
}

/**
 * Map a severity-scale quantity into ppm on the heat scale.
 *
 * `MAX_SEVERITY_Z` (4.0, `fatal`) is the divisor because it is the largest value the
 * observation alphabet can express, so both sides of the ratio are severity z-scores
 * and the quotient is dimensionless. Clamped to [0, MAX_TEMPERATURE_PPM]: a posterior
 * mean above `fatal` is possible and means "worse than the worst thing the alphabet
 * can say", which saturates the scale rather than overflowing it.
 */
export function severityPpm(severityZ: number): number {
  if (!Number.isFinite(severityZ) || severityZ <= 0) return 0;
  const fraction = Math.min(1, severityZ / MAX_SEVERITY_Z);
  return Math.round(fraction * MAX_TEMPERATURE_PPM);
}

/** A band declaration: the verdict, the point estimate it came from, and the interval. */
export interface BandDeclaration {
  /** The band, or `indeterminate` when +/-1 sigma straddles an edge. */
  readonly band: DeclaredBand;
  /** The band at `mu` alone. ALWAYS present -- an un-declared number, named honestly. */
  readonly pointBand: TemperatureBand;
  /** The band at `mu - sigma`. */
  readonly lowBand: TemperatureBand;
  /** The band at `mu + sigma`. */
  readonly highBand: TemperatureBand;
  readonly ppm: number;
  readonly ppmSigma: number;
}

/**
 * Declare the band, or refuse.
 *
 * The refusal rule is agreement of the endpoints, not a comparison against a chosen
 * margin: if `band(mu - sigma)`, `band(mu)` and `band(mu + sigma)` are not all the
 * same, the band belongs to the uncertainty and no band is declared. Same shape as
 * `tailSensitivity`, which folds at both ends of a declared nu-interval and publishes
 * only when the ends agree, and as `HeavyTailFold`'s scheme-independence gate.
 */
export function declareBand(mu: number, sigma: number): BandDeclaration {
  const s = Number.isFinite(sigma) && sigma > 0 ? sigma : 0;
  const ppm = severityPpm(mu);
  const lowBand = temperatureBand(severityPpm(mu - s));
  const highBand = temperatureBand(severityPpm(mu + s));
  const pointBand = temperatureBand(ppm);
  const sameLow = lowBand === pointBand;
  const sameHigh = highBand === pointBand;
  const agreed = sameLow ? sameHigh : false;
  const band: DeclaredBand = agreed ? pointBand : "indeterminate";
  const ppmSigma = severityPpm(s);
  return { band, pointBand, lowBand, highBand, ppm, ppmSigma };
}

/**
 * Declare a direction of travel, or refuse.
 *
 * The old `trend` was `mu > 0.6 ? warming : mu < 0.4 ? recovering : stable` -- a LEVEL
 * read off one snapshot and reported as a derivative. One sample has no derivative;
 * the field named a rate of change that nothing in the process could have computed.
 *
 * The honest form needs two beliefs. The difference of two independent Gaussians has
 * `sigma_delta = sqrt(sigma_now^2 + sigma_prev^2)`, so a direction is declarable only
 * when `|delta| > sigma_delta`. And `stable` is a stronger claim than "no direction
 * declared": it asserts that a move worth noticing would have been SEEN, so it also
 * requires the error bar to be narrower than the narrowest band (`WARM_TEMPERATURE_MAX_PPM`).
 * Otherwise the answer is `indeterminate`. No constant is introduced by either test.
 */
export function declareTrend(
  now: { readonly mu: number; readonly sigma: number },
  previous?: { readonly mu: number; readonly sigma: number },
): Trend {
  if (!previous) return "indeterminate";
  const delta = now.mu - previous.mu;
  const sigmaDelta = Math.hypot(now.sigma, previous.sigma);
  if (!Number.isFinite(delta)) return "indeterminate";
  if (!Number.isFinite(sigmaDelta)) return "indeterminate";
  if (delta > sigmaDelta) return "warming";
  if (-delta > sigmaDelta) return "recovering";
  const resolvable = severityPpm(sigmaDelta) < WARM_TEMPERATURE_MAX_PPM;
  return resolvable ? "stable" : "indeterminate";
}

/**
 * Build the PriorHints this BNN is ENTITLED to publish.
 *
 * A dimension with `obsCount === 0` is the constructor's prior and is withheld: a peer
 * cannot tell a prior from a posterior once it is on the wire, and `mergePriorHint`
 * used to credit it with precision. `obsCount` is read from the state rather than
 * written as the literal `0` the runner used to hardcode -- that literal was a second,
 * quieter defect, because it would have gone on reporting `0` after the BNN learned
 * something, disarming any receiver-side guard exactly when it started to matter.
 *
 * Returns `[]` when every dimension is still the constructor prior. After the
 * society BNN persists, `calibration` is withheld no longer — it has obsCount.
 */
export function evidenceBackedPriorHints(bnn: DimensionalBnn, senderZid: string): PriorHint[] {
  const hints: PriorHint[] = [];
  for (const dimension of ERROR_DIMENSIONS) {
    const belief = dimensionBelief(bnn, dimension);
    if (belief.obsCount <= 0) continue;
    hints.push({
      dimension,
      mu: belief.mu,
      sigma2: belief.sigma2,
      robustnessWeight: belief.robustnessWeight,
      obsCount: belief.obsCount,
      senderZid,
    });
  }
  return hints;
}

/** The transport-heat readout the society event carries. */
export interface SocietyHeatReadout {
  /** The declared band, or `indeterminate`. */
  readonly band: DeclaredBand;
  /** The band at the point estimate. Never refused -- and never to be read as a verdict. */
  readonly pointBand: TemperatureBand;
  readonly lowBand: TemperatureBand;
  readonly highBand: TemperatureBand;
  readonly transportMu: number;
  readonly transportSigma: number;
  readonly transportPpm: number;
  readonly transportPpmSigma: number;
  readonly robustnessWeight: number;
  readonly obsCount: number;
  /** `prior` means NOTHING was absorbed; every number above is the constructor's. */
  readonly evidence: EvidenceTier;
  readonly trend: Trend;
}

/**
 * Assemble the transport-heat readout.
 *
 * `previous` is the transport belief from the restored file, and only when that
 * dimension has observations. A loaded BNN that has only seen `calibration`
 * ticks still has no transport derivative — `trend` stays `indeterminate`
 * rather than inventing one. Workitem: 081M005CGB7087G0R0031328CY.
 */
export function transportHeatReadout(
  bnn: DimensionalBnn,
  previous?: { readonly mu: number; readonly sigma: number },
): SocietyHeatReadout {
  const belief = dimensionBelief(bnn, "transport");
  const declared = declareBand(belief.mu, belief.sigma);
  const trend = declareTrend(belief, previous);
  return {
    band: declared.band,
    pointBand: declared.pointBand,
    lowBand: declared.lowBand,
    highBand: declared.highBand,
    transportMu: belief.mu,
    transportSigma: belief.sigma,
    transportPpm: declared.ppm,
    transportPpmSigma: declared.ppmSigma,
    robustnessWeight: belief.robustnessWeight,
    obsCount: belief.obsCount,
    evidence: belief.evidence,
    trend,
  };
}
