/**
 * optimal-cadence.ts — thermodynamically optimal commit interval (τ* = L/√α).
 *
 * Soraya derived (2026-07-03): the total cost of a ferry commit is
 *   C(τ) = L²/τ + α·τ
 * where:
 *   L² = thermodynamic length squared (the finite-time excess numerator)
 *   τ  = erasure window (time between commits)
 *   α  = queue pressure (cost of holding uncommitted items per unit time)
 *
 * Minimizing C(τ) by AM-GM: L²/τ + α·τ ≥ 2√(L²·α) = 2L√α,
 * with equality when L²/τ = α·τ, i.e. τ* = L/√α.
 *
 * This gives the OPTIMAL commit cadence:
 *   - Too short (τ < τ*): finite-time excess dominates (rushed commits, high heat)
 *   - Too long (τ > τ*): queue pressure dominates (items waiting too long)
 *   - At τ*: perfectly balanced (AM-GM optimum)
 *
 * The self-claims reliability multiplier modulates α: a highly reliable agent
 * has less queue pressure (peers trust their timeline → less urgency to commit).
 *
 * Composes with:
 *   - src/Core.TypeScript/ferry-throttler/ferry-throttler.ts (the drain scheduler)
 *   - src/Core.TypeScript/algebra/entropy-tracker.ts (accountFerryCommit)
 *   - src/Core.TypeScript/observe/self-claims.ts (reliability → windowMultiplier)
 *   - src/Core.Lean4/Lean4/LandauerFloor.lean (larger_window_less_excess)
 *   - src/Core.TLA/specs/PredictiveLookahead.tla (bounded model)
 */

// ═══ The Optimal Cadence Formula ═══════════════════════════════════════════════

export interface CadenceParams {
  /** L² — thermodynamic length squared. Measures the "distance" of the commit from
   *  equilibrium. Higher L² = more excess per unit time (hotter commits). */
  readonly thermLength: number;
  /** α — queue pressure. Cost per unit time of holding uncommitted items.
   *  Higher α = more urgency to commit (items are "expensive" to hold). */
  readonly queuePressure: number;
}

export interface CadenceResult {
  /** τ* — the optimal commit interval (ticks or ms, same units as L² and α). */
  readonly optimalWindow: number;
  /** C(τ*) — the minimum total cost at the optimum (= 2L√α by AM-GM). */
  readonly minCost: number;
  /** The excess component at τ* (= L²/τ* = L√α). */
  readonly excessAtOptimum: number;
  /** The pressure component at τ* (= α·τ* = L√α). Equal to excess at optimum. */
  readonly pressureAtOptimum: number;
}

/**
 * Compute the optimal commit cadence: τ* = L/√α.
 *
 * Returns the optimal window and the minimum cost. If α = 0 (no queue pressure),
 * the optimal window is infinite (never commit — no reason to). If L² = 0
 * (zero thermodynamic length — quasi-static), the optimal window is 0 (commit
 * immediately — no excess cost either way).
 */
export function computeOptimalCadence(params: CadenceParams): CadenceResult {
  const { thermLength, queuePressure } = params;

  // Edge cases
  if (queuePressure <= 0) {
    // No pressure to commit — optimal is to wait forever (infinite window)
    return {
      optimalWindow: Infinity,
      minCost: 0,
      excessAtOptimum: 0,
      pressureAtOptimum: 0,
    };
  }
  if (thermLength <= 0) {
    // Zero thermodynamic length — commits are free (no excess). Commit immediately.
    return {
      optimalWindow: 0,
      minCost: 0,
      excessAtOptimum: 0,
      pressureAtOptimum: 0,
    };
  }

  // τ* = L / √α  (where L = √(L²) = √thermLength)
  const L = Math.sqrt(thermLength);
  const sqrtAlpha = Math.sqrt(queuePressure);
  const optimalWindow = L / sqrtAlpha;

  // C(τ*) = 2L√α (the AM-GM minimum)
  const minCost = 2 * L * sqrtAlpha;

  // At the optimum, excess = pressure (that's what AM-GM equality means)
  const component = L * sqrtAlpha;

  return {
    optimalWindow,
    minCost,
    excessAtOptimum: component,
    pressureAtOptimum: component,
  };
}

/**
 * Compute the total cost at a given window τ (for comparison with the optimum).
 *   C(τ) = L²/τ + α·τ
 */
export function totalCostAtWindow(params: CadenceParams, window: number): number {
  if (window <= 0) return Infinity; // immediate commit has infinite excess (L²/0)
  return params.thermLength / window + params.queuePressure * window;
}

/**
 * Adjust queue pressure by reliability: a highly reliable agent has less effective
 * pressure (peers trust them, less urgency). The windowMultiplier from self-claims
 * scales the effective pressure INVERSELY: more trust → less pressure → larger τ*.
 */
export function adjustPressureByReliability(
  basePressure: number,
  windowMultiplier: number,
): number {
  // windowMultiplier > 1 → less effective pressure (agent is trusted, can wait longer)
  // windowMultiplier < 1 → more effective pressure (agent is unreliable, commit sooner)
  return basePressure / (windowMultiplier * windowMultiplier);
}
