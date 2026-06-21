/**
 * drain-scheduler.test.ts — unit tests for DrainScheduler implementations.
 *
 * Covers StrictPriorityScheduler and WeightedFairScheduler (Deficit Round Robin).
 */
import { describe, expect, it } from "bun:test";
import { createStrictPriorityScheduler, createWeightedFairScheduler, } from "./drain-scheduler";
// ─── Helpers ────────────────────────────────────────────────────────────────
function lane(hasWork, queueDepth = 1, bytesQueued = 0, drainCount = 0) {
    return { hasWork, queueDepth, bytesQueued, drainCount };
}
// ─── StrictPriorityScheduler ────────────────────────────────────────────────
describe("StrictPriorityScheduler", () => {
    it("returns first lane with work (index 0 = highest priority)", () => {
        const scheduler = createStrictPriorityScheduler();
        const lanes = [lane(true), lane(true), lane(true)];
        expect(scheduler.selectLane(lanes)).toBe(0);
    });
    it("skips non-hasWork lanes and returns first with work", () => {
        const scheduler = createStrictPriorityScheduler();
        const lanes = [lane(false), lane(false), lane(true)];
        expect(scheduler.selectLane(lanes)).toBe(2);
    });
    it("returns -1 when all lanes are empty", () => {
        const scheduler = createStrictPriorityScheduler();
        const lanes = [lane(false), lane(false), lane(false)];
        expect(scheduler.selectLane(lanes)).toBe(-1);
    });
    it("returns -1 for an empty lanes array", () => {
        const scheduler = createStrictPriorityScheduler();
        expect(scheduler.selectLane([])).toBe(-1);
    });
    it("ignores non-hasWork lanes even if they have queueDepth", () => {
        const scheduler = createStrictPriorityScheduler();
        // Lane 0 has queueDepth but hasWork is false (e.g. paused)
        const lanes = [lane(false, 10), lane(true, 1)];
        expect(scheduler.selectLane(lanes)).toBe(1);
    });
    it("recordDrain is a no-op (stateless)", () => {
        const scheduler = createStrictPriorityScheduler();
        // Should not throw
        scheduler.recordDrain(0, 5, 1024);
        // Behavior unchanged after recordDrain
        const lanes = [lane(false), lane(true)];
        expect(scheduler.selectLane(lanes)).toBe(1);
    });
});
// ─── WeightedFairScheduler ──────────────────────────────────────────────────
describe("WeightedFairScheduler", () => {
    describe("validation", () => {
        it("throws on empty weights", () => {
            expect(() => createWeightedFairScheduler([])).toThrow("weights must not be empty");
        });
        it("throws on non-positive weight (zero)", () => {
            expect(() => createWeightedFairScheduler([1, 0, 2])).toThrow("must be positive");
        });
        it("throws on non-positive weight (negative)", () => {
            expect(() => createWeightedFairScheduler([1, -1, 2])).toThrow("must be positive");
        });
    });
    describe("proportional drain", () => {
        it("distributes drains proportionally with weights [3, 2, 1] over 100 iterations", () => {
            const scheduler = createWeightedFairScheduler([3, 2, 1]);
            const counts = [0, 0, 0];
            const lanes = [lane(true), lane(true), lane(true)];
            for (let i = 0; i < 100; i++) {
                const selected = scheduler.selectLane(lanes);
                expect(selected).toBeGreaterThanOrEqual(0);
                expect(selected).toBeLessThan(3);
                counts[selected]++;
                scheduler.recordDrain(selected, 1, 100);
            }
            // With weights [3, 2, 1] (sum=6), expected proportions: 50%, 33%, 17%
            // Allow ±5% tolerance for DRR rounding
            expect(counts[0]).toBeGreaterThanOrEqual(45);
            expect(counts[0]).toBeLessThanOrEqual(55);
            expect(counts[1]).toBeGreaterThanOrEqual(28);
            expect(counts[1]).toBeLessThanOrEqual(38);
            expect(counts[2]).toBeGreaterThanOrEqual(12);
            expect(counts[2]).toBeLessThanOrEqual(22);
        });
        it("no starvation: every lane with work gets at least one drain in 100 iterations", () => {
            const scheduler = createWeightedFairScheduler([10, 1, 1]);
            const counts = [0, 0, 0];
            const lanes = [lane(true), lane(true), lane(true)];
            for (let i = 0; i < 100; i++) {
                const selected = scheduler.selectLane(lanes);
                expect(selected).toBeGreaterThanOrEqual(0);
                counts[selected]++;
                scheduler.recordDrain(selected, 1, 50);
            }
            // Even the lowest-weight lane must receive some drains
            expect(counts[0]).toBeGreaterThan(0);
            expect(counts[1]).toBeGreaterThan(0);
            expect(counts[2]).toBeGreaterThan(0);
        });
    });
    describe("tie-breaking", () => {
        it("ties broken by lower index (= higher priority)", () => {
            // Equal weights → all deficits grow equally → first call picks index 0
            const scheduler = createWeightedFairScheduler([1, 1, 1]);
            const lanes = [lane(true), lane(true), lane(true)];
            // First selectLane: all deficits equal (1/3 each) → tie → index 0 wins
            const first = scheduler.selectLane(lanes);
            expect(first).toBe(0);
        });
    });
    describe("lane availability", () => {
        it("returns -1 when no lane has work", () => {
            const scheduler = createWeightedFairScheduler([1, 2, 3]);
            const lanes = [lane(false), lane(false), lane(false)];
            expect(scheduler.selectLane(lanes)).toBe(-1);
        });
        it("skips lanes without work even if they have high deficit", () => {
            const scheduler = createWeightedFairScheduler([1, 1]);
            // First select with both available
            const lanes1 = [lane(true), lane(true)];
            const first = scheduler.selectLane(lanes1);
            scheduler.recordDrain(first, 1, 0);
            // Now only lane 1 has work
            const lanes2 = [lane(false), lane(true)];
            const second = scheduler.selectLane(lanes2);
            expect(second).toBe(1);
        });
    });
});
