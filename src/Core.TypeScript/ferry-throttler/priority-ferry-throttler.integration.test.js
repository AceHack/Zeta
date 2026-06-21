/**
 * priority-ferry-throttler.integration.test.ts — integration smoke tests.
 *
 * 1. Observe loop simulation (strict): HIGH items before LOW items.
 * 2. Weighted-fair gives proportional drain.
 * 3. Regression: existing FerryThrottler tests still pass (meta-check).
 */
import { describe, expect, it } from "bun:test";
import { PriorityFerryThrottler } from "./priority-ferry-throttler.js";
// ─── Test 1: Observe loop simulation (strict) ───────────────────────────────
describe("Integration: Observe loop simulation (strict)", () => {
    it("all HIGH items processed before any LOW item", async () => {
        const config = {
            maxDegreeOfParallelism: 1,
            defaultMaxBatchSize: 256,
            defaultMaxBatchBytes: undefined,
            lanes: [
                { priority: 0 }, // HIGH = critical signals
                { priority: 1 }, // LOW = background refresh
            ],
            defaultPriority: 1,
            drainingPolicy: { kind: "strict" },
        };
        const processed = [];
        const processBatch = async (boat) => {
            for (const item of boat)
                processed.push(item);
        };
        const throttler = new PriorityFerryThrottler(config, processBatch);
        // Enqueue 10 LOW items first
        for (let i = 0; i < 10; i++) {
            throttler.tryEnqueue({ tag: "LOW", id: i }, 1);
        }
        // Then enqueue 5 HIGH items
        for (let i = 0; i < 5; i++) {
            throttler.tryEnqueue({ tag: "HIGH", id: i }, 0);
        }
        await throttler.complete();
        // All 15 items processed
        expect(processed.length).toBe(15);
        // All HIGH items should appear before any LOW item
        const highIndices = processed
            .map((item, idx) => ({ item, idx }))
            .filter(({ item }) => item.tag === "HIGH")
            .map(({ idx }) => idx);
        const lowIndices = processed
            .map((item, idx) => ({ item, idx }))
            .filter(({ item }) => item.tag === "LOW")
            .map(({ idx }) => idx);
        expect(highIndices.length).toBe(5);
        expect(lowIndices.length).toBe(10);
        const maxHighIndex = Math.max(...highIndices);
        const minLowIndex = Math.min(...lowIndices);
        expect(maxHighIndex).toBeLessThan(minLowIndex);
    });
});
// ─── Test 2: Weighted-fair gives proportional drain ─────────────────────────
describe("Integration: Weighted-fair gives proportional drain", () => {
    it("drain proportions are within ±15% of expected weights [6, 3, 1]", async () => {
        const weights = [6, 3, 1];
        const totalWeight = weights.reduce((a, b) => a + b, 0); // 10
        const expectedProportions = weights.map((w) => w / totalWeight); // [0.6, 0.3, 0.1]
        const config = {
            maxDegreeOfParallelism: 1,
            defaultMaxBatchSize: 1, // batch size 1 to get fine-grained scheduling
            defaultMaxBatchBytes: undefined,
            lanes: [
                { priority: 0, weight: 6 },
                { priority: 1, weight: 3 },
                { priority: 2, weight: 1 },
            ],
            defaultPriority: 0,
            drainingPolicy: {
                kind: "weighted-fair",
                weights: new Map([
                    [0, 6],
                    [1, 3],
                    [2, 1],
                ]),
            },
        };
        // Track processing order by lane
        const drainOrder = [];
        const processBatch = async (boat) => {
            for (const item of boat)
                drainOrder.push(item.lane);
        };
        const throttler = new PriorityFerryThrottler(config, processBatch);
        // Enqueue 100 items to each lane
        for (let i = 0; i < 100; i++) {
            throttler.tryEnqueue({ lane: 0, id: i }, 0);
            throttler.tryEnqueue({ lane: 1, id: i }, 1);
            throttler.tryEnqueue({ lane: 2, id: i }, 2);
        }
        await throttler.complete();
        // All 300 items should be processed
        expect(drainOrder.length).toBe(300);
        // Measure actual proportions
        const counts = [0, 0, 0];
        for (const lane of drainOrder) {
            counts[lane]++;
        }
        // Each lane should have processed all 100 items
        expect(counts[0]).toBe(100);
        expect(counts[1]).toBe(100);
        expect(counts[2]).toBe(100);
        // Check proportional drain ordering in the first 100 drain events
        // (while all lanes have work, the scheduler should approximate the weights)
        const firstNDrains = drainOrder.slice(0, 100);
        const firstCounts = [0, 0, 0];
        for (const lane of firstNDrains) {
            firstCounts[lane]++;
        }
        const actualProportions = firstCounts.map((c) => c / 100);
        for (let i = 0; i < 3; i++) {
            const expected = expectedProportions[i];
            const actual = actualProportions[i];
            const diff = Math.abs(actual - expected);
            // Within ±15%
            expect(diff).toBeLessThanOrEqual(0.15);
        }
    });
});
// ─── Test 3: Regression — existing FerryThrottler tests still pass ──────────
describe("Integration: Regression check", () => {
    it("existing FerryThrottler tests pass (meta-check via import)", async () => {
        // This is a structural meta-check: importing the existing FerryThrottler
        // and verifying its basic operation still works after priority layer addition.
        const { FerryThrottler, DETERMINISTIC_CONFIG } = await import("./ferry-throttler.js");
        const processed = [];
        const processBatch = async (boat) => {
            for (const item of boat)
                processed.push(item);
        };
        const throttler = new FerryThrottler(DETERMINISTIC_CONFIG, processBatch);
        for (let i = 1; i <= 20; i++) {
            await throttler.enqueue(i);
        }
        await throttler.complete();
        expect(processed).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    });
});
