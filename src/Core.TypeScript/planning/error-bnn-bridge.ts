/**
 * error-bnn-bridge.ts — Wire error envelopes as EP observations into the StudentTBnn.
 *
 * ## R4: Errors as EP observations (Otto's fourth round)
 *
 * Each error envelope is one observation absorbed by EP:
 * - `dimension` names the factor to update (not the whole model).
 * - `severity` maps to the observation z-score (the magnitude of the surprise).
 * - The StudentTBnn robustness weight w = (ν+1)/(ν+z²) downweights hostile
 *   or badly-calibrated teachers automatically — no special case needed.
 *
 * ## The retraction path (cheap) vs erasure path (expensive)
 *
 * - Teaching error (retractableBeliefId set): emit a −1 retraction.
 *   The BNN posterior updates; the old belief is retracted, not overwritten.
 *   No Landauer floor is paid for the correction itself.
 * - Bare error (no retractableBeliefId): the receiver must discard and redo.
 *   The BNN posterior smears probability across the whole model.
 *   The Landauer floor IS paid (kT ln 2 per bit erased).
 *
 * ## Preserve uncertainty
 *
 * An error updates a posterior; it must never collapse one.
 * The StudentTBnn keeps (mu, sigma²) — a distribution, not a point estimate.
 * A peer driven to certainty has destroyed the information the next update needs.
 *
 * ## Trust-weighting
 *
 * Error-derived updates are trust-weighted per receiver:
 * - A peer that teaches badly degrades its own trustBound.
 * - The robustness weight w handles hostile teachers automatically.
 * - The idempotency guard (EnvelopeIdempotencyGuard) prevents double-updates.
 *
 * ## References
 *
 * - Minka (2001) EP — "training and inference are the same message pass"
 * - Shannon (1948) — information as reduction in uncertainty
 * - Landauer (1961) — kT ln 2 floor for erasure
 * - Bennett (1973) — retraction vs erasure
 */

import {
  updateStudentT,
  createStudentTState,
  EP_VARIANCE_FLOOR,
  type StudentTState,
  type StudentTUpdateResult,
  type TailVerdict,
} from "./student-t-bnn";
import {
  ERROR_DIMENSIONS,
  toEpObservation,
  EnvelopeIdempotencyGuard,
  type ErrorEnvelope,
  type ErrorDimension,
} from "../protocol/error-envelope";

export const ALL_DIMENSIONS: readonly ErrorDimension[] = ERROR_DIMENSIONS;

// ── The tail assumption ────────────────────────────────────────────────────────

/**
 * The finite `nu` this module uses to mean "Gaussian".
 *
 * `HeavyTailFold.TailInterval` admits `Hi = infinity` and evaluates the Gaussian
 * exactly. The TypeScript filter cannot: `createStudentTState` rejects a
 * non-finite `nu` and the quadrature needs `nu * sigma2_obs` to be a number. So
 * the light endpoint is a finite stand-in, and it is a CHECKED one rather than a
 * round number — EBB-4 folds a stream at this `nu` and grades it against the
 * closed-form Gaussian conjugate posterior, which it reproduces exactly in double
 * precision. (`student-t-bnn.test.ts` already used `1e12` for `nu -> infinity` on
 * the same grounds; this names the constant instead of repeating the literal.)
 */
export const GAUSSIAN_LIMIT_NU = 1e12;

/**
 * A DECLARED tail assumption: an interval, never a point.
 *
 * The TypeScript twin of `HeavyTailFold.TailInterval` (`src/Bayesian/HeavyTailFold.fs`).
 * Deliberately named to match, so that drift between the two is visible rather
 * than tacit — see the "what does not cross the language boundary" note on
 * `dimensionVerdict`.
 */
export interface TailInterval {
  /** The heaviest admissible tail. This is the endpoint whose answer is published. */
  readonly nuLo: number;
  /** The lightest admissible tail (`GAUSSIAN_LIMIT_NU` = "or the noise is Gaussian"). */
  readonly nuHi: number;
  /** Why this interval is believed. Prose, addressed to the next reader. */
  readonly reason: string;
  /** Whether a party other than the author could check it. `declareTail` gives `false`. */
  readonly checked: boolean;
}

/**
 * Declare a tail interval. **A point is refused.**
 *
 * That refusal is the whole repair in one line, and it is the same line
 * `HeavyTailFold.Tail.declare` draws: a verdict that depends on a single
 * unmeasured number cannot be falsified, so the single unmeasured number is not
 * constructible and cannot be reached by passing the same value twice.
 *
 * A guess is still legal — that is what this function is for — but it is a guess
 * with an extent, and `dimensionVerdict` refuses to publish anything that moves
 * across that extent by more than its own error bar.
 */
export function declareTail(reason: string, nuLo: number, nuHi: number): TailInterval {
  if (!Number.isFinite(nuLo) || nuLo <= 0) {
    throw new RangeError(`nuLo must be finite and > 0; got ${String(nuLo)}`);
  }
  if (!Number.isFinite(nuHi) || !(nuHi > nuLo)) {
    throw new RangeError(
      `nuHi must be finite and strictly greater than nuLo - a POINT tail index is not constructible, because a verdict that depends on it cannot be falsified; got [${String(nuLo)}, ${String(nuHi)}]`
    );
  }
  if (reason.trim().length === 0) {
    throw new RangeError("a declared tail interval must carry a reason");
  }
  return { nuLo, nuHi, reason, checked: false };
}

/**
 * The tail interval this consumer folds error severities under, when a caller
 * declares nothing.
 *
 * ## Why there is a default at all, and why it is an interval
 *
 * The previous default was the POINT `nu = 3`, which is the defect
 * `HeavyTailFold` was written to remove: an unmeasured constant that selects the
 * verdict. Measured on this consumer's own observation alphabet (`SEVERITY_Z`:
 * info 0.5, warn 1, error 2, fatal 4) with this consumer's own configuration
 * (prior `N(0,1)`, `obsVariance = 1.0`):
 *
 * | stream            | mu at nu=3 | mu at Gaussian | tightest sigma | gate           |
 * |-------------------|-----------|----------------|----------------|----------------|
 * | one fatal         | 0.970171  | 2.000000       | 0.707107       | TAIL-DEPENDENT |
 * | 5 warn + 1 fatal  | 1.014924  | 1.285714       | 0.377964       | independent    |
 * | 5 info + 1 fatal  | 0.571172  | 0.928571       | 0.377964       | independent    |
 * | all warn          | 0.871518  | 0.857143       | 0.375379       | independent    |
 *
 * The first row is the MODAL case for the `ace` CLI BNN — one failed install is
 * one fatal error on one dimension — and there the constant moved the published
 * posterior mean by a factor of two, well past the posterior's own error bar. So
 * this was a live silent vote, not a latent one. (For the second row the critical
 * `nu` is 13.004776: the direct analogue of the society fold's 23.389306.)
 *
 * ## Why 3 is still the heavy endpoint — and why that is not a re-vote
 *
 * `nuLo = 3` reproduces the number this module published yesterday, so no
 * behaviour is silently renumbered; what changed is that the number is now the
 * *conservative endpoint of a declared range* rather than the whole assumption,
 * and any answer that depends on where in the range you stand is refused instead
 * of published. `HeavyTailFold` publishes at `NuLo` for the same reason: observed
 * information is smallest where outliers are rejected hardest, so the heavy end
 * is the least confident and therefore the honest place to report from.
 *
 * `nuHi = GAUSSIAN_LIMIT_NU` is the widest honest statement available — "heavier
 * than Gaussian, and I do not know by how much." It is also the statement most
 * likely to earn a refusal, which is the incentive: narrowing it costs a
 * measurement, and this consumer cannot currently pay (see `dimensionVerdict`).
 *
 * `checked` is `false`. It is an assumption, it says so, and `dimensionVerdict`
 * carries it to every reader.
 */
export const DEFAULT_ERROR_TAIL: TailInterval = {
  nuLo: 3,
  nuHi: GAUSSIAN_LIMIT_NU,
  reason:
    "UNMEASURED. Error severities are folded by an ADF filter that keeps a Gaussian summary and discards the observations, so no atom store exists to infer a tail index from -- route 1 of the HeavyTailFold discipline is unavailable here, not merely underpowered. Declared as the widest honest range: heavier-than-Gaussian from nu=3 (the value the retired point default published, kept so no number is silently renumbered) up to the Gaussian limit.",
  checked: false,
};

/**
 * The `nu` values a BNN folds at, swept uniformly in `1/nu`.
 *
 * `1/nu` is the coordinate, not `nu` — the Gaussian sits at `1/nu = 0` and the
 * likelihood is smooth there, so a `nu`-uniform sweep spends most of its points
 * where nothing happens. `HeavyTailFold.sweep` makes the same choice for the same
 * reason.
 *
 * Rung 0 is always `nuLo` (the published rung); the last is always `nuHi`.
 */
export function tailRungs(tail: TailInterval, rungCount: number): number[] {
  if (!Number.isInteger(rungCount) || rungCount < 2) {
    throw new RangeError(`rungCount must be an integer >= 2; got ${String(rungCount)}`);
  }
  const invLo = 1 / tail.nuLo;
  const invHi = 1 / tail.nuHi;
  return Array.from({ length: rungCount }, (_, k) => {
    const inv = invLo + (invHi - invLo) * (k / (rungCount - 1));
    return 1 / inv;
  });
}

// ── Per-dimension BNN state ────────────────────────────────────────────────────

/**
 * A per-dimension BNN: one StudentTState per error dimension.
 *
 * Named dimensions (from ErrorDimension) update the right factor instead of
 * smearing probability across the whole model. A bare "unknown" dimension
 * updates a catch-all factor.
 *
 * This is the key insight from the ferry doc:
 * "an error that names its dimension updates the right factor rather than
 * smearing probability over the whole model. A bare failure is an uninformative
 * likelihood — it barely moves the posterior."
 */
export interface DimensionalBnn {
  /**
   * The PUBLISHED rung: one state per dimension, folded at the heaviest
   * admissible tail (`tail.nuLo`). This is what `serializeBnn` persists and what
   * `dimensionPosterior().mu` reports.
   */
  readonly states: ReadonlyMap<ErrorDimension, StudentTState>;
  /**
   * The SHADOW rungs: the same stream folded at every other `nu` in the declared
   * interval. They exist only to be compared against the published rung — a
   * verdict that moves across them is a verdict that belongs to the assumption.
   * Empty for a dimension whose tail could not be bracketed (see
   * `deserializeBnn`), which `dimensionVerdict` reports as `not-gradable` rather
   * than passing.
   */
  readonly shadowRungs: ReadonlyMap<ErrorDimension, readonly StudentTState[]>;
  readonly robustnessWeights: ReadonlyMap<ErrorDimension, number>;
  /**
   * Sticky per-dimension flag: some update on some rung could not return a usable
   * second moment and put its variance on `EP_VARIANCE_FLOOR`. Reported by the
   * producer rather than sniffed by the consumer from the value — a posterior
   * whose precision was manufactured by a clamp must not be graded as though it
   * were measured.
   */
  readonly varianceOnFloorSeen: ReadonlyMap<ErrorDimension, boolean>;
  readonly guard: EnvelopeIdempotencyGuard;
  /** The declared tail assumption every rung of this BNN stands on. */
  readonly tail: TailInterval;
}

/**
 * Create a fresh DimensionalBnn with one Student-t rung ladder per error dimension.
 * All states start at the prior (mu=0, sigma²=1).
 *
 * @param tail The DECLARED tail interval. Defaults to `DEFAULT_ERROR_TAIL`, which
 *   says out loud that it is unmeasured. It is an interval rather than the point
 *   `nu = 3` it replaced, because a point tail index selects the verdict and
 *   cannot be falsified — see `DEFAULT_ERROR_TAIL` for the measurements.
 * @param obsVariance Observation noise scale, shared by every rung.
 * @param rungCount How many `nu` values to fold at, swept uniformly in `1/nu`.
 *   Two (the endpoints) is the cheap form `tailSensitivity` already ships. This
 *   knob is NOT a second silent vote: adding rungs can only widen the observed
 *   spread and tighten the yardstick, so the gate is monotone in it — more rungs
 *   can turn a pass into a refusal but never a refusal into a pass (EBB-8).
 */
export function createDimensionalBnn(
  tail: TailInterval = DEFAULT_ERROR_TAIL,
  obsVariance = 1.0,
  rungCount = 2,
): DimensionalBnn {
  const nus = tailRungs(tail, rungCount);
  const states = new Map<ErrorDimension, StudentTState>();
  const shadowRungs = new Map<ErrorDimension, readonly StudentTState[]>();
  const robustnessWeights = new Map<ErrorDimension, number>();
  const varianceOnFloorSeen = new Map<ErrorDimension, boolean>();
  for (const dim of ALL_DIMENSIONS) {
    states.set(dim, createStudentTState(nus[0] as number, 0, 1, obsVariance));
    shadowRungs.set(
      dim,
      nus.slice(1).map((nu) => createStudentTState(nu, 0, 1, obsVariance)),
    );
    robustnessWeights.set(dim, 1);
    varianceOnFloorSeen.set(dim, false);
  }
  return {
    states,
    shadowRungs,
    robustnessWeights,
    varianceOnFloorSeen,
    guard: new EnvelopeIdempotencyGuard(),
    tail,
  };
}

/**
 * Absorb one error envelope as an EP observation into the DimensionalBnn.
 *
 * Returns the update result (or null if the envelope is a duplicate).
 * The update is trust-weighted: the robustness weight w downweights
 * hostile/badly-calibrated teachers automatically.
 *
 * @param bnn - The DimensionalBnn to update.
 * @param envelope - The error envelope to absorb.
 * @returns { result, dimension, isRetraction } or null if duplicate.
 */
export function absorbError(
  bnn: DimensionalBnn,
  envelope: ErrorEnvelope,
): {
  readonly result: StudentTUpdateResult;
  readonly dimension: ErrorDimension;
  readonly isRetraction: boolean;
  /** Whether the updated dimension's posterior survives its own tail assumption. */
  readonly tailVerdict: DimensionVerdict["kind"];
} | null {
  // Idempotency: drop duplicates (same error delivered twice = one update)
  if (!bnn.guard.absorb(envelope)) return null;

  const obs = toEpObservation(envelope);
  const state = bnn.states.get(obs.dimension);
  if (!state) return null; // should never happen (all dimensions pre-created)

  // The EP update: x is the z-score of the error severity.
  // The StudentTBnn robustness weight w = (ν+1)/(ν+z²) downweights outliers.
  const result = updateStudentT(state, obs.x);

  // The same observation is absorbed by every shadow rung. They see the identical
  // stream and differ only in the tail index, which is what makes their
  // disagreement attributable to the assumption and to nothing else.
  const shadows = bnn.shadowRungs.get(obs.dimension) ?? [];
  const shadowResults = shadows.map((s) => updateStudentT(s, obs.x));

  // Update the state in-place (the Map is mutable even though the interface is readonly)
  (bnn.states as Map<ErrorDimension, StudentTState>).set(obs.dimension, result.state);
  (bnn.shadowRungs as Map<ErrorDimension, readonly StudentTState[]>).set(
    obs.dimension,
    shadowResults.map((r) => r.state),
  );
  (bnn.robustnessWeights as Map<ErrorDimension, number>).set(obs.dimension, result.robustnessWeight);
  if (result.varianceOnFloor || shadowResults.some((r) => r.varianceOnFloor)) {
    (bnn.varianceOnFloorSeen as Map<ErrorDimension, boolean>).set(obs.dimension, true);
  }

  return {
    result,
    dimension: obs.dimension,
    isRetraction: obs.isRetraction,
    tailVerdict: dimensionVerdict(bnn, obs.dimension).kind,
  };
}

/**
 * Assign a dimension's published (and shadow) posterior.
 *
 * This is NOT an EP observation. A peer PriorHint is a belief, not an
 * error: routing it through `absorbError` mapped every hint to the
 * constant `severity: "info"` z-score 0.5, so two hints that differed
 * only in `mu` left the receiver in the same state
 * (081M005CBQ6087G0R003N21Z9J). The merged Gaussian is written
 * directly. Shadows get the same (mu, sigma2) at their own `nu`,
 * because this is an assignment of a belief, not a stream fold.
 */
export function replaceDimensionPosterior(
  bnn: DimensionalBnn,
  dimension: ErrorDimension,
  belief: { readonly mu: number; readonly sigma2: number },
): void {
  const published = bnn.states.get(dimension);
  if (!published) return;
  const next = createStudentTState(published.nu, belief.mu, belief.sigma2, published.obsVariance);
  (bnn.states as Map<ErrorDimension, StudentTState>).set(dimension, next);
  const shadows = bnn.shadowRungs.get(dimension) ?? [];
  (bnn.shadowRungs as Map<ErrorDimension, readonly StudentTState[]>).set(
    dimension,
    shadows.map((s) => createStudentTState(s.nu, belief.mu, belief.sigma2, s.obsVariance)),
  );
}

// ── The verdict ────────────────────────────────────────────────────────────────

/**
 * What a dimension is entitled to say. Every case names a fact; none names a culprit.
 *
 * The TypeScript twin of `HeavyTailFold.FoldVerdict`. Two cases of that type have
 * no counterpart here and their absence is deliberate rather than an oversight:
 * `NoQuorum` and `NothingToFold` are properties of a BATCH of atoms with basins to
 * partition, and this is a sequential filter over one stream with no basins to
 * count. What does cross is gate 1, the scheme-independence gate, which is the
 * gate the unmeasured constant was defeating.
 */
export type DimensionVerdict =
  | {
      /** Invariant across the declared tail interval; safe to publish. */
      readonly kind: "tail-independent";
      readonly mu: number;
      readonly sigma2: number;
      readonly robustnessWeight: number;
      /** The tail index the published answer was folded at (the heavy endpoint). */
      readonly nu: number;
      readonly tail: TailInterval;
    }
  | {
      /**
       * The answer moves across the declared interval by more than the tightest
       * error bar the fold would publish anywhere on it. The answer belongs to the
       * assumption; no single `nu` inside the interval may be published.
       */
      readonly kind: "tail-dependent";
      readonly muAtHeavyTail: number;
      readonly muAtLightTail: number;
      readonly moved: number;
      readonly tightestSigma: number;
      readonly tail: TailInterval;
    }
  | {
      /**
       * The check declines. NOT a pass and NOT a failure — some rung has no
       * trustworthy error bar to grade against, or the tail could not be
       * bracketed at all.
       */
      readonly kind: "not-gradable";
      readonly reason: string;
      readonly tail: TailInterval;
    };

/**
 * **The verdict.** Grade one dimension's posterior against its own tail assumption.
 *
 * The comparison is a *systematic* (how far the assumption moves the answer)
 * against a *statistical* (how precisely the answer is known), both in the units
 * of the parameter — so it introduces no second free constant to replace the one
 * it removed, which is the obvious way to get this wrong. It is the same rule as
 * `HeavyTailFold.fold` gate 1 and `student-t-bnn.tailSensitivity`.
 *
 * ## What did NOT cross the language boundary, and what that costs
 *
 * `HeavyTailFold` removed the operation: there is no F# function that takes a bare
 * `nu` and returns a verdict, so the defect is unreachable rather than merely
 * detected. Here `dimensionPosterior` still returns an ungated `mu`, because two
 * consumers outside this change's blast radius
 * (`discovery/zeta-transport-cell.ts`, `society-evolution-runner.ts`) read that
 * field directly and breaking them was not on offer. So the TypeScript side gets
 * the MEASUREMENT and the refusal TYPE but not the unreachability, and a caller
 * that ignores `tailVerdict` can still act on a number the assumption chose. That
 * is a real and named gap, not a claim of parity.
 */
export function dimensionVerdict(bnn: DimensionalBnn, dimension: ErrorDimension): DimensionVerdict {
  const tail = bnn.tail;
  const published = bnn.states.get(dimension);
  const shadows = bnn.shadowRungs.get(dimension) ?? [];
  if (!published) {
    return { kind: "not-gradable", reason: `no state for dimension ${dimension}`, tail };
  }
  if (shadows.length === 0) {
    return {
      kind: "not-gradable",
      reason: `dimension ${dimension} has no shadow rung, so its tail assumption is a point and nothing brackets it`,
      tail,
    };
  }
  if (bnn.varianceOnFloorSeen.get(dimension) === true) {
    return {
      kind: "not-gradable",
      reason: `dimension ${dimension} absorbed an observation whose projection declined; its precision was manufactured by a clamp and is not an error bar`,
      tail,
    };
  }

  const mus = [published.posterior.mu, ...shadows.map((s) => s.posterior.mu)];
  const sigma2s = [published.posterior.sigma2, ...shadows.map((s) => s.posterior.sigma2)];
  const tightestSigma = Math.sqrt(Math.min(...sigma2s));
  if (sigma2s.some((v) => v <= EP_VARIANCE_FLOOR * 10)) {
    return {
      kind: "not-gradable",
      reason: `dimension ${dimension} has a rung sitting on the EP variance floor`,
      tail,
    };
  }
  const moved = Math.max(...mus) - Math.min(...mus);
  if (moved > tightestSigma) {
    return {
      kind: "tail-dependent",
      muAtHeavyTail: published.posterior.mu,
      muAtLightTail: (shadows[shadows.length - 1] as StudentTState).posterior.mu,
      moved,
      tightestSigma,
      tail,
    };
  }
  return {
    kind: "tail-independent",
    mu: published.posterior.mu,
    sigma2: published.posterior.sigma2,
    robustnessWeight: bnn.robustnessWeights.get(dimension) ?? 1,
    nu: published.nu,
    tail,
  };
}

/**
 * Get the current posterior for a given error dimension, folded at the HEAVIEST
 * admissible tail. Returns the prior if the dimension has never been observed.
 *
 * `mu` / `sigma2` / `robustnessWeight` are unchanged from before the tail interval
 * landed, so existing readers keep their numbers. `tailVerdict` is the new and
 * load-bearing field: when it is not `"tail-independent"`, `mu` is a value the
 * unmeasured assumption chose and reading it as the answer grades a conclusion
 * against an artifact. `dimensionVerdict` is the form that will not let you.
 */
export function dimensionPosterior(
  bnn: DimensionalBnn,
  dimension: ErrorDimension,
): {
  readonly mu: number;
  readonly sigma2: number;
  readonly robustnessWeight: number;
  readonly tailVerdict: TailVerdict;
  readonly tail: TailInterval;
} {
  const verdict = dimensionVerdict(bnn, dimension);
  // `TailVerdict` is student-t-bnn's already-shipped vocabulary for exactly this
  // three-way answer; reusing it keeps one word per state across the two modules.
  const tailVerdict: TailVerdict =
    verdict.kind === "tail-independent"
      ? "tail-independent"
      : verdict.kind === "tail-dependent"
        ? "tail-dependent"
        : "not-gradable";
  const state = bnn.states.get(dimension);
  if (!state) {
    return { mu: 0, sigma2: 1, robustnessWeight: 1, tailVerdict, tail: bnn.tail };
  }
  return {
    mu: state.posterior.mu,
    sigma2: state.posterior.sigma2,
    robustnessWeight: bnn.robustnessWeights.get(dimension) ?? 1,
    tailVerdict,
    tail: bnn.tail,
  };
}

/**
 * The "error richness" metric: how much information did this error carry?
 *
 * A named dimension (not "unknown") is rich: it updates the right factor.
 * An "unknown" dimension is bare: it smears probability across the model.
 *
 * Returns a value in [0, 1]: 1 = maximally informative, 0 = bare failure.
 */
export function errorRichness(envelope: ErrorEnvelope): number {
  if (envelope.mirror.dimension === "unknown") return 0;
  // Rich error: named dimension + retractable belief = maximum information
  if (envelope.mirror.retractableBeliefId) return 1;
  // Named dimension but no retraction: medium richness
  return 0.7;
}
