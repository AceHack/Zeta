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
// ─── StrictPriorityScheduler ────────────────────────────────────────────────
/**
 * Stateless strict-priority scheduler. Iterates lanes in index order (assumes lanes
 * are pre-sorted by priority ascending = higher priority first) and returns the first
 * index where `hasWork === true`.
 */
class StrictPriorityScheduler {
    selectLane(lanes) {
        for (let i = 0; i < lanes.length; i++) {
            const lane = lanes[i];
            if (lane !== undefined && lane.hasWork) {
                return i;
            }
        }
        return -1;
    }
    recordDrain(_laneIndex, _batchSize, _batchBytes) {
        // Stateless — no-op.
    }
}
// ─── WeightedFairScheduler (Deficit Round Robin) ────────────────────────────
/**
 * Deficit Round Robin scheduler. Each lane accumulates a deficit proportional to its
 * normalized weight; among lanes with work, the one with the highest deficit is selected.
 * Ties broken by lower index (= higher priority).
 */
class WeightedFairScheduler {
    normalizedWeights;
    deficits;
    constructor(weights) {
        if (weights.length === 0) {
            throw new Error("WeightedFairScheduler: weights must not be empty");
        }
        for (let i = 0; i < weights.length; i++) {
            const w = weights[i];
            if (w === undefined || w <= 0) {
                throw new Error(`WeightedFairScheduler: weight at index ${String(i)} must be positive, got ${String(w)}`);
            }
        }
        const sum = weights.reduce((acc, w) => acc + w, 0);
        this.normalizedWeights = weights.map((w) => w / sum);
        this.deficits = new Array(weights.length).fill(0);
    }
    selectLane(lanes) {
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
    recordDrain(laneIndex, _batchSize, _batchBytes) {
        // Subtract 1.0 from the selected lane's deficit.
        if (laneIndex >= 0 && laneIndex < this.deficits.length) {
            this.deficits[laneIndex] = (this.deficits[laneIndex] ?? 0) - 1.0;
        }
    }
}
// ─── Factory functions ──────────────────────────────────────────────────────
export function createStrictPriorityScheduler() {
    return new StrictPriorityScheduler();
}
export function createWeightedFairScheduler(weights) {
    return new WeightedFairScheduler(weights);
}
