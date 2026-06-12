/**
 * drain-scheduler.ts — lane selection strategies for multi-lane priority ferry throttler.
 *
 * Two scheduling disciplines:
 * 1. StrictPriority — stateless, always drains the highest-priority lane with work.
 * 2. WeightedFair (Deficit Round Robin) — proportional lane selection preventing starvation.
 *
 * The `LaneSnapshot` interface is intentionally richer than strict-priority needs so the
 * future soft-priority layer (coupled-oscillator / per-lane pressure) can observe without
 * a separate observation channel. See design.md §"Drain Scheduler (internal)".
 */

// ─── Interfaces ─────────────────────────────────────────────────────────────

/** Per-lane snapshot exposed to the scheduler. */
export interface LaneSnapshot {
  readonly hasWork: boolean;
  readonly queueDepth: number;
  readonly bytesQueued: number;
  readonly drainCount: number;
}

/** Strategy for selecting which lane to drain next when a ferry becomes free. */
export interface DrainScheduler {
  /** Returns the lane index to drain next, or -1 if all lanes are empty. */
  selectLane(lanes: readonly LaneSnapshot[]): number;
  /** Record that a drain happened from this lane (batch size + bytes for soft accounting). */
  recordDrain(laneIndex: number, batchSize: number, batchBytes: number): void;
}

// ─── StrictPriorityScheduler ────────────────────────────────────────────────

/**
 * Stateless strict-priority scheduler. Iterates lanes in index order (assumes lanes
 * are pre-sorted by priority ascending = higher priority first) and returns the first
 * index where `hasWork === true`.
 */
class StrictPriorityScheduler implements DrainScheduler {
  selectLane(lanes: readonly LaneSnapshot[]): number {
    for (let i = 0; i < lanes.length; i++) {
      const lane = lanes[i];
      if (lane !== undefined && lane.hasWork) {
        return i;
      }
    }
    return -1;
  }

  recordDrain(_laneIndex: number, _batchSize: number, _batchBytes: number): void {
    // Stateless — no-op.
  }
}

// ─── WeightedFairScheduler (Deficit Round Robin) ────────────────────────────

/**
 * Deficit Round Robin scheduler. Each lane accumulates a deficit proportional to its
 * normalized weight; among lanes with work, the one with the highest deficit is selected.
 * Ties broken by lower index (= higher priority).
 */
class WeightedFairScheduler implements DrainScheduler {
  private readonly normalizedWeights: readonly number[];
  private readonly deficits: number[];

  constructor(weights: readonly number[]) {
    if (weights.length === 0) {
      throw new Error("WeightedFairScheduler: weights must not be empty");
    }
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i];
      if (w === undefined || w <= 0) {
        throw new Error(
          `WeightedFairScheduler: weight at index ${String(i)} must be positive, got ${String(w)}`,
        );
      }
    }

    const sum = weights.reduce((acc, w) => acc + w, 0);
    this.normalizedWeights = weights.map((w) => w / sum);
    this.deficits = new Array<number>(weights.length).fill(0);
  }

  selectLane(lanes: readonly LaneSnapshot[]): number {
    // (1) Add each lane's normalized weight to its deficit.
    for (let i = 0; i < this.deficits.length; i++) {
      const nw = this.normalizedWeights[i];
      if (nw !== undefined) {
        this.deficits[i] = (this.deficits[i] ?? 0) + nw;
      }
    }

    // (2) Among lanes with work, select the one with the highest deficit.
    //     Ties broken by lower index (= higher priority).
    let bestIndex = -1;
    let bestDeficit = -Infinity;

    for (let i = 0; i < lanes.length && i < this.deficits.length; i++) {
      const lane = lanes[i];
      if (lane !== undefined && lane.hasWork) {
        const deficit = this.deficits[i] ?? 0;
        if (deficit > bestDeficit) {
          bestDeficit = deficit;
          bestIndex = i;
        }
      }
    }

    return bestIndex;
  }

  recordDrain(laneIndex: number, _batchSize: number, _batchBytes: number): void {
    // Subtract 1.0 from the selected lane's deficit.
    if (laneIndex >= 0 && laneIndex < this.deficits.length) {
      this.deficits[laneIndex] = (this.deficits[laneIndex] ?? 0) - 1.0;
    }
  }
}

// ─── Factory functions ──────────────────────────────────────────────────────

export function createStrictPriorityScheduler(): DrainScheduler {
  return new StrictPriorityScheduler();
}

export function createWeightedFairScheduler(weights: readonly number[]): DrainScheduler {
  return new WeightedFairScheduler(weights);
}
