/**
 * spec-weight-view.ts — ranked-surprisal view over the entropy tracker.
 *
 * The entropy tracker counts branches as flat +1. This view projects that same
 * stream into RANKED weights: the nth branch carries weight n (surprisal
 * proportional to rank). The accumulated weighted potential is the triangular
 * number T(n) = n(n-1)/2 — the same closed form CostRecurrence.lean proves.
 *
 * This is a VIEW (Rx materialized dimension), not a change to the tracker.
 * The underlying ledger stays flat; this projection adds a meta-dimension
 * that gives the weighted accumulation for scheduling/potential computations.
 *
 * Why: Soraya's research (2026-07-03) showed that flat branches can't produce
 * zeta-regularizable sums (nothing divergent to regularize). But ranked branches
 * (Eₙ ∝ n) do — the partial sum 1+2+3+...+N = N(N+1)/2, and its GROWTH RATE
 * matches the structure that ζ(-1) = -1/12 describes in physics. Whether you
 * care about the zeta interpretation or not, the weighted view gives a richer
 * potential function for scheduling decisions (how much "weight" is accumulated
 * in the soft lane, not just how many bits).
 *
 * Composes with:
 *   - src/Core.TypeScript/algebra/entropy-tracker.ts (the source)
 *   - src/Core.Lean4/Lean4/CostRecurrence.lean (proves T(n) = n(n-1)/2)
 *   - src/Core.TypeScript/ferry-throttler/ (scheduling decisions use the potential)
 *   - The bonsai meta-dimension pattern (views that grow/trim without touching source)
 */

import type { EntropyTracker } from "./entropy-tracker";

// ═══ The Spec-Weight View ══════════════════════════════════════════════════════

export interface SpecWeightState {
  /** Number of branches observed (the rank counter). */
  readonly branches: number;
  /** Accumulated weighted potential: T(n) = n(n-1)/2 (triangular number). */
  readonly weightedPotential: number;
  /** The weight of the LAST branch (= its rank = n). */
  readonly lastWeight: number;
  /** The average weight per branch (= (n-1)/2 for n branches, or 0). */
  readonly averageWeight: number;
}

export interface SpecWeightView {
  /** Current state of the weighted projection. */
  readonly state: SpecWeightState;
  /** Record a branch event from the entropy tracker. Rank = nth branch. */
  recordBranch(): void;
  /**
   * Record a measurement (flush). Resets the accumulation window **only if bits were actually
   * erased** — a zero-bit measurement pays nothing, so it discharges nothing.
   *
   * The parameter was previously ignored (`_bitsErased`), so `measure(0)` wiped the accumulated
   * potential exactly as hard as `measure(1000)`. That mattered little while every caller passed a
   * positive literal; it matters now that reversible operations charge a derived 0
   * (`erasure-derivation.ts`) — the whole point of a derived zero is that nothing was paid, and a
   * window that discharges on it is back to accounting by convention.
   */
  recordFlush(bitsErased: number): void;
  /** The current weighted potential (T(n) = n(n-1)/2). */
  readonly potential: number;
  /** Reset the view (new accumulation window). */
  reset(): void;
}

/**
 * Create a spec-weight view over an entropy tracker's branch events.
 *
 * Each branch is assigned weight = its rank (1st branch = 1, 2nd = 2, ...).
 * The accumulated potential is the triangular number T(n) = n(n-1)/2.
 * On flush (measurement), the window resets — the committed potential is
 * "paid" and the next accumulation starts from rank 1 again.
 */
export function createSpecWeightView(): SpecWeightView {
  let branches = 0;

  // T(n) = n*(n-1)/2 — the closed form (CostRecurrence.lean: eqCount_closed_form)
  const triangular = (n: number): number => n < 2 ? 0 : (n * (n - 1)) / 2;

  return {
    get state(): SpecWeightState {
      return {
        branches,
        weightedPotential: triangular(branches),
        lastWeight: branches,
        averageWeight: branches > 0 ? (branches - 1) / 2 : 0,
      };
    },

    get potential(): number {
      return triangular(branches);
    },

    recordBranch(): void {
      branches += 1;
    },

    recordFlush(bitsErased: number): void {
      // The flush "pays" the accumulated potential — but only a flush that actually erased
      // something has paid anything. A derived-zero measurement (a reversible operation) leaves
      // the window standing.
      if (bitsErased > 0) branches = 0;
    },

    reset(): void {
      branches = 0;
    },
  };
}

// ═══ Composed View: wraps an EntropyTracker with spec-weight projection ════════

export interface MeteredSpecWeightTracker {
  /** The underlying entropy tracker (flat ledger). */
  readonly tracker: EntropyTracker;
  /** The spec-weight view (ranked projection). */
  readonly view: SpecWeightView;
  /** Branch: +1 flat bit on tracker, +rank on view. */
  branch(): void;
  /** Observe: Adj, no change to view (only branches carry weight). */
  observe(): void;
  /** Measure: pay Landauer on tracker, flush the view window. */
  measure(bitsErased: number): void;
  /** Permutation: no-op on both. */
  permutation(): void;
}

/**
 * Compose an entropy tracker with a spec-weight view. The tracker is the source
 * of truth (flat ledger); the view is a derived projection (ranked weights).
 * Both update together — one call, two perspectives.
 */
export function createMeteredSpecWeightTracker(tracker: EntropyTracker): MeteredSpecWeightTracker {
  const view = createSpecWeightView();

  return {
    tracker,
    view,

    branch(): void {
      tracker.branch();       // flat: +1 bit
      view.recordBranch();    // ranked: +n (nth branch)
    },

    observe(): void {
      tracker.observe();      // Adj, free
      // view: no change (observations don't carry branch weight)
    },

    measure(bitsErased: number): void {
      tracker.measure(bitsErased);  // Landauer: transfer to heat
      view.recordFlush(bitsErased); // window resets (potential paid)
    },

    permutation(): void {
      tracker.permutation();  // no-op
      // view: no-op
    },
  };
}
