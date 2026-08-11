/**
 * heat-aware-scheduler.ts — DrainScheduler wrapper that applies TemperatureBand
 * backpressure from batch-heat-bridge to lane selection.
 *
 * ## Design
 *
 * The drain scheduler decides which lane to drain next. When a batch fails with
 * a high `unaccountedHeat` ratio (hot/critical), the transport is losing information
 * faster than it can teach — the four-corner feedback loop is heating up. The
 * HeatAwareScheduler responds by reducing that lane's effective weight, which
 * throttles it relative to cooler lanes (backpressure from heat).
 *
 * This is the same principle as TCP AIMD (Additive Increase, Multiplicative Decrease)
 * but driven by thermodynamic heat rather than packet loss:
 *   - cold/warm:    weight unchanged (full throughput)
 *   - hot:          weight × HOT_FACTOR   (0.5 — halve throughput)
 *   - critical:     weight × CRITICAL_FACTOR (0.1 — near-stall)
 *
 * The weight recovers additively on each successful drain (no failure → +RECOVERY_STEP
 * per drain, capped at 1.0). This mirrors AIMD: multiplicative decrease on heat,
 * additive increase on success.
 *
 * ## Anchors
 * - Vera's TemperatureBand: src/Core/Heat.fs (WarmMaxPpm=333_333, HotMaxPpm=666_666)
 * - batch-heat-bridge.ts: converts BatchTeachingEnvelope → TemperatureReadout
 * - network-transport.ts: SendOutcome.temperatureReadout (the heat signal)
 * - TCP AIMD: RFC 5681 §3.1 (multiplicative decrease on congestion)
 * - Four-corner feedback: DBSP/AGM/bitemporal/Stückelberg — heat is the retraction signal
 *
 * ## Anti-self-certifying discipline
 * Tests inject fault: a lane that receives a critical heat signal MUST be throttled
 * relative to a cold lane. The throttle is observable (lower selection frequency),
 * not just a weight change in internal state.
 */

import type { DrainScheduler, LaneSnapshot } from "./drain-scheduler";
import type { TemperatureBand } from "../protocol/batch-heat-bridge";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Multiplicative decrease factor for hot lanes (TCP AIMD analogue). */
const HOT_FACTOR = 0.5;
/** Multiplicative decrease factor for critical lanes. */
const CRITICAL_FACTOR = 0.1;
/** Additive increase per successful drain (recovery). */
const RECOVERY_STEP = 0.05;
/** Minimum weight floor — never fully starve a lane (prevents deadlock). */
const MIN_WEIGHT = 0.05;

// ─── HeatAwareScheduler ─────────────────────────────────────────────────────

/**
 * Wraps any DrainScheduler and adjusts per-lane heat weights based on
 * TemperatureBand signals from failed batches.
 *
 * Usage:
 *   const base = createWeightedFairScheduler([1, 1, 1]);
 *   const scheduler = createHeatAwareScheduler(base, 3);
 *   // On batch failure: scheduler.recordHeat(laneIndex, "hot");
 *   // On batch success: scheduler.recordDrain(laneIndex, batchSize, batchBytes);
 */
export interface HeatAwareScheduler extends DrainScheduler {
  /**
   * Record a heat signal from a failed batch on this lane.
   * Reduces the lane's effective weight multiplicatively.
   * cold/warm → no change; hot → ×0.5; critical → ×0.1.
   */
  recordHeat(laneIndex: number, band: TemperatureBand): void;
  /**
   * Reset all lane weights to 1.0 (full throughput).
   * Useful after a transport outage clears or for testing.
   * Also resets skip counters to 0.
   */
  resetHeat(): void;
  /** Current heat weights (1.0 = full throughput, 0.05 = near-stall). */
  readonly heatWeights: readonly number[];
}

class HeatAwareSchedulerImpl implements HeatAwareScheduler {
  private readonly _base: DrainScheduler;
  private readonly _weights: number[];

  constructor(base: DrainScheduler, laneCount: number) {
    this._base = base;
    this._weights = new Array<number>(laneCount).fill(1.0);
    this._skipCounters = new Array<number>(laneCount).fill(0);
  }

  get heatWeights(): readonly number[] {
    return this._weights;
  }

  recordHeat(laneIndex: number, band: TemperatureBand): void {
    if (laneIndex < 0 || laneIndex >= this._weights.length) return;
    const current = this._weights[laneIndex] ?? 1.0;
    if (band === "hot") {
      this._weights[laneIndex] = Math.max(MIN_WEIGHT, current * HOT_FACTOR);
    } else if (band === "critical") {
      this._weights[laneIndex] = Math.max(MIN_WEIGHT, current * CRITICAL_FACTOR);
    }
    // cold/warm: no change (system is working correctly)
  }

  /**
   * Skip counters: a lane with weight w is skipped every ceil(1/w) - 1 calls.
   * weight=1.0 → never skipped; weight=0.5 → skipped every other call;
   * weight=0.1 → skipped 9 out of 10 calls.
   * This is deterministic (no randomness) and composable with any base scheduler.
   */
  private readonly _skipCounters: number[];

  selectLane(lanes: readonly LaneSnapshot[]): number {
    // Increment skip counters and mask lanes that are due for skipping
    const adjusted = lanes.map((lane, i) => {
      const w = this._weights[i] ?? 1.0;
      if (w >= 1.0) return lane; // full weight — never skip
      const threshold = Math.round(1.0 / w) - 1; // e.g. w=0.5 → skip every 1 call
      this._skipCounters[i] = (this._skipCounters[i] ?? 0) + 1;
      if ((this._skipCounters[i] ?? 0) % (threshold + 1) !== 0) {
        // Skip this call for this lane
        return { ...lane, hasWork: false };
      }
      return lane;
    });
    const selected = this._base.selectLane(adjusted);
    // If all lanes were skipped, fall back to the un-gated base
    if (selected === -1) {
      return this._base.selectLane(lanes);
    }
    return selected;
  }

  recordDrain(laneIndex: number, batchSize: number, batchBytes: number): void {
    // Additive recovery on successful drain
    if (laneIndex >= 0 && laneIndex < this._weights.length) {
      const current = this._weights[laneIndex] ?? 1.0;
      this._weights[laneIndex] = Math.min(1.0, current + RECOVERY_STEP);
    }
    this._base.recordDrain(laneIndex, batchSize, batchBytes);
  }
  /**
   * Reset all lane weights to 1.0 and skip counters to 0.
   * Call after a transport outage clears, or in tests to start from a known state.
   */
  resetHeat(): void {
    for (let i = 0; i < this._weights.length; i++) {
      this._weights[i] = 1.0;
      this._skipCounters[i] = 0;
    }
  }
}

// ─── Factory ────────────────────────────────────────────────────────────────

/**
 * Create a HeatAwareScheduler wrapping the given base scheduler.
 * @param base       Any DrainScheduler (strict-priority or weighted-fair).
 * @param laneCount  Number of lanes (must match the lanes array passed to selectLane).
 */
export function createHeatAwareScheduler(
  base: DrainScheduler,
  laneCount: number,
): HeatAwareScheduler {
  return new HeatAwareSchedulerImpl(base, laneCount);
}

// ─── Convenience re-exports ─────────────────────────────────────────────────

export { HOT_FACTOR, CRITICAL_FACTOR, RECOVERY_STEP, MIN_WEIGHT };
