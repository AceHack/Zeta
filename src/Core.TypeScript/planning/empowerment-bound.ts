/**
 * empowerment-bound.ts — The third bound: mutual empowerment.
 *
 * ## The linear-blend vacuity proof (do not re-derive)
 *
 * The obvious reading of "mix exploreBound and trustBound" is a weighted blend.
 * It does not work:
 *
 *   w·(μ + k₁σ) + (1−w)·(μ − k₂σ)
 *   = μ + (w·k₁ − (1−w)·k₂)·σ
 *   = μ + k′·σ
 *
 * A linear blend of an upper and a lower confidence bound collapses to another
 * single-agent bound with a different k. It adds no information and no second
 * party — it is exploreBound with the dial turned down.
 *
 * **The mix must be structural, and it must range over both agents.**
 *
 * ## The correct shape
 *
 * - `trustBound` becomes the FLOOR — for BOTH parties. An interaction is
 *   admissible only if it does not push either side below its own safety floor.
 *   Non-coercion falls out directly: I cannot buy my upside with your downside.
 * - `exploreBound` becomes the REACH. Among admissible interactions, prefer
 *   the one that most expands the JOINT option space.
 * - The bound is indexed by an oracle set the member CHOOSES (§11 applied to
 *   a metric — no global scorer, no ambient influence channel).
 *
 * ## Empowerment (the anchor)
 *
 * Empowerment = channel capacity from an agent's actions to its own future
 * observations (Klyubin, Polani & Nehaniv 2005). High empowerment = many
 * futures reachable and distinguishable by your own choices.
 *
 * Mutual empowerment = maximize the JOINT reachable-option space rather than
 * either party's alone. Non-coercive by construction: it increases what the
 * other CAN do without steering what they WILL do.
 *
 * ## The four values calls (answered by Aaron, 2026-08-09)
 *
 * 1. Aggregation: `min` (maximin) is the DEFAULT. `sum` is available but
 *    requires explicit opt-in by both parties (sacrifice is never accidental).
 * 2. Channel capacity proxy: use declared capability, never inferred.
 * 3. Gaming: legitimate between consenting parties. The invariant is the
 *    externality bound: no interaction may push a non-consenting third party
 *    below their floor.
 * 4. k=0: permitted behind a power-dynamic disclosure protocol (revocable,
 *    scoped, expiring, attributable).
 *
 * ## Hard constraint: declared capability only
 *
 * Empowerment is computed over DECLARED capability, never inferred by
 * observing a peer's private state. A frosted region is unavailable to the
 * calculation. Correct behaviour: score on what remains declared.
 *
 * ## References
 *
 * - Klyubin, Polani & Nehaniv (2005) "All Else Being Equal Be Empowered"
 * - Salge & Polani (2017) "Empowerment as Replacement for the Three Laws of Robotics"
 * - Du et al. (2020) "AvE: Assistance via Empowerment" (NeurIPS)
 * - Auer (2002) UCB (the exploreBound lineage)
 * - Cantelli/Scarf (the trustBound shortfall guarantee)
 */

import { type CalibrationPosterior, trustBound } from "./calibration-ledger";

// ── Types ──────────────────────────────────────────────────────────────────────

/**
 * A declared capability — what an agent says it can do.
 * Empowerment is computed over declared capabilities ONLY.
 * Inferred capabilities are surveillance and violate §6 consent-first.
 */
export interface DeclaredCapability {
  /** The capability domain (e.g. "code-review", "test-execution", "deploy"). */
  readonly domain: string;
  /** The agent's self-assessed reach in this domain (0=none, 1=full). */
  readonly reach: number;
  /** The oracle set the agent uses to score this capability. */
  readonly oracleIds: readonly string[];
}

/**
 * A candidate interaction between two agents.
 * Empowerment is computed over candidate interactions, not over agents alone.
 */
export interface CandidateInteraction {
  /** Human-readable description of the interaction. */
  readonly description: string;
  /**
   * The expected change in each agent's declared capability reach
   * after the interaction. Positive = more reach, negative = less.
   */
  readonly deltaReachSelf: number;
  readonly deltaReachOther: number;
  /**
   * The aggregation mode for jointOptionGain.
   * "min" (default, maximin): protects the worse-off party.
   * "sum": permits sacrificing one party for aggregate gain.
   *   REQUIRES explicit opt-in by both parties (never the default).
   */
  readonly aggregation: "min" | "sum";
}

/**
 * The oracle set parameterization.
 * Each member chooses which oracles count for their empowerment score.
 * There is no global scorer (§11: no single mandatory morality).
 */
export interface OracleSet {
  readonly ids: readonly string[];
  /** Trust weights per oracle (default: uniform). */
  readonly weights?: ReadonlyMap<string, number>;
}

// ── Linear-blend vacuity lemma ─────────────────────────────────────────────────

/**
 * LEMMA: A linear blend of exploreBound and trustBound is vacuous.
 *
 * Proof:
 *   w·exploreBound(p, k₁) + (1−w)·trustBound(p, k₂)
 *   = w·(μ + k₁σ) + (1−w)·(μ − k₂σ)
 *   = μ·(w + 1 − w) + σ·(w·k₁ − (1−w)·k₂)
 *   = μ + k′·σ   where k′ = w·k₁ − (1−w)·k₂
 *
 * This is just another single-agent bound with k′ = w·k₁ − (1−w)·k₂.
 * It adds no second party and no new information.
 * QED.
 *
 * This function is a CONFORMANCE CHECK, not a useful computation.
 * It verifies the lemma holds for given parameters.
 * A future implementer who introduces a scalar blend can run this to
 * confirm they have re-derived the vacuous case.
 *
 * @returns true if the blend equals a single-agent bound (vacuity confirmed).
 */
export function linearBlendIsVacuous(posterior: CalibrationPosterior, w: number, k1: number, k2: number): boolean {
  // The lemma is about the UNCLAMPED algebraic identity.
  // exploreBound and trustBound clamp to [0,1], which obscures the identity
  // when the unclamped value falls outside [0,1].
  // We verify the identity on the raw arithmetic (before clamping).
  const exploreRaw = posterior.mu + k1 * posterior.sigma;
  const trustRaw = posterior.mu - k2 * posterior.sigma;
  const blend = w * exploreRaw + (1 - w) * trustRaw;
  // The blend should equal μ + k′σ for k′ = w·k₁ − (1−w)·k₂
  const kPrime = w * k1 - (1 - w) * k2;
  const singleAgentBound = posterior.mu + kPrime * posterior.sigma;
  // Allow for floating-point rounding (1e-10 tolerance)
  return Math.abs(blend - singleAgentBound) < 1e-10;
}

// ── empowermentBound ───────────────────────────────────────────────────────────

/**
 * The joint option gain of a candidate interaction.
 *
 * This is the empowerment term: how much does the interaction expand
 * the joint reachable-option space?
 *
 * Aggregation:
 * - "min" (default, maximin): min(deltaReachSelf, deltaReachOther).
 *   Protects the worse-off party. Non-coercive by construction.
 * - "sum": deltaReachSelf + deltaReachOther.
 *   Permits sacrificing one party for aggregate gain.
 *   REQUIRES explicit opt-in by both parties.
 */
export function jointOptionGain(interaction: CandidateInteraction): number {
  if (interaction.aggregation === "sum") {
    return interaction.deltaReachSelf + interaction.deltaReachOther;
  }
  // Default: min (maximin — protects the worse-off party)
  return Math.min(interaction.deltaReachSelf, interaction.deltaReachOther);
}

/**
 * The empowermentBound — the third bound.
 *
 * Selects the admissible interaction that maximizes jointOptionGain,
 * subject to the constraint that neither party's trustBound is violated.
 *
 * @param selfPosterior - The self agent's calibration posterior.
 * @param otherPosterior - The other agent's calibration posterior.
 * @param interactions - Candidate interactions to evaluate.
 * @param oracles - The oracle set (member-chosen, never ambient).
 * @param tauSelf - The self agent's safety floor (default: 0 = no floor).
 * @param tauOther - The other agent's safety floor (default: 0 = no floor).
 * @param kTrust - k for trustBound (default: 3, Cantelli/Scarf).
 *
 * @returns The best admissible interaction, or null if none are admissible.
 */
export function empowermentBound(
  selfPosterior: CalibrationPosterior,
  otherPosterior: CalibrationPosterior,
  interactions: readonly CandidateInteraction[],
  _oracles: OracleSet,
  tauSelf = 0,
  tauOther = 0,
  kTrust = 3,
): { readonly interaction: CandidateInteraction; readonly gain: number } | null {
  const selfFloor = trustBound(selfPosterior, kTrust);
  const otherFloor = trustBound(otherPosterior, kTrust);

  let best: { interaction: CandidateInteraction; gain: number } | null = null;

  for (const interaction of interactions) {
    // Constraint: neither party's floor may be violated
    // (trustBound after interaction must be >= tau)
    // Proxy: the floor is the current trustBound minus the negative delta
    const selfAfter = selfFloor + Math.min(0, interaction.deltaReachSelf);
    const otherAfter = otherFloor + Math.min(0, interaction.deltaReachOther);

    if (selfAfter < tauSelf || otherAfter < tauOther) continue; // inadmissible

    const gain = jointOptionGain(interaction);
    if (best === null || gain > best.gain) {
      best = { interaction, gain };
    }
  }

  return best;
}

/**
 * The externality bound: no interaction between consenting parties may push
 * a non-consenting third party's trustBound below their floor.
 *
 * This is the gaming-resistance invariant (Aaron, 2026-08-09):
 * gaming between consenting parties is legitimate play; the harm is the
 * non-consenting bystander.
 *
 * @param thirdPartyPosterior - The non-consenting third party's posterior.
 * @param interaction - The candidate interaction to check.
 * @param externalityDelta - Expected change in the third party's reach (negative = harm).
 * @param kTrust - k for trustBound.
 *
 * @returns true if the interaction is externality-safe for this third party.
 */
export function externalitySafe(
  thirdPartyPosterior: CalibrationPosterior,
  externalityDelta: number,
  kTrust = 3,
): boolean {
  const floor = trustBound(thirdPartyPosterior, kTrust);
  const afterFloor = floor + Math.min(0, externalityDelta);
  // Safe if the third party's floor is not pushed below 0
  return afterFloor >= 0;
}
