/**
 * priority-ferry-throttler.property.test.ts — property-based tests (fast-check)
 * for PriorityFerryThrottler.
 *
 * Properties verified:
 * 1. Strict priority drain ordering
 * 3. DST-replayable determinism
 * 7. Per-lane backpressure isolation
 * 8. No-drop under backpressure
 * 11. Config serialization round-trip
 * 12. Invalid priority rejection
 */
import { describe, expect, it } from "bun:test";
import fc from "fast-check";
import { PriorityFerryThrottler } from "./priority-ferry-throttler.js";
import { serializeConfig, deserializeConfig } from "./priority-config.js";
// ─── Property 1: Strict priority drain ordering ─────────────────────────────
describe("Property 1: Strict priority drain ordering", () => {
    it("no item from a lower-priority lane processes while a higher-priority lane has pending items", async () => {
        await fc.assert(fc.asyncProperty(fc.integer({ min: 5, max: 50 }), fc.integer({ min: 2, max: 3 }), fc.infiniteStream(fc.nat({ max: 99 })), async (numItems, numLanes, priorityStream) => {
            // Generate distinct priorities for lanes (sorted ascending = higher priority first)
            const priorities = [];
            const seen = new Set();
            const iter = priorityStream[Symbol.iterator]();
            while (priorities.length < numLanes) {
                const { value } = iter.next();
                if (value !== undefined && !seen.has(value)) {
                    seen.add(value);
                    priorities.push(value);
                }
            }
            priorities.sort((a, b) => a - b);
            const config = {
                maxDegreeOfParallelism: 1,
                defaultMaxBatchSize: 256,
                defaultMaxBatchBytes: undefined,
                lanes: priorities.map((p) => ({ priority: p })),
                defaultPriority: priorities[0],
                drainingPolicy: { kind: "strict" },
            };
            const processed = [];
            const processBatch = async (boat) => {
                for (const item of boat)
                    processed.push(item);
            };
            const throttler = new PriorityFerryThrottler(config, processBatch);
            // Generate items with random lane assignments
            const items = [];
            for (let i = 0; i < numItems; i++) {
                const laneIdx = i % numLanes;
                const priority = priorities[laneIdx];
                items.push({ id: i, priority });
            }
            // Enqueue all items via tryEnqueue
            for (const item of items) {
                throttler.tryEnqueue(item, item.priority);
            }
            await throttler.complete();
            // Verify strict ordering: for each processed item, all items with
            // higher priority (lower number) that were enqueued should have been
            // processed before it.
            const processedOrder = new Map();
            for (let i = 0; i < processed.length; i++) {
                processedOrder.set(processed[i].id, i);
            }
            for (let i = 0; i < processed.length; i++) {
                const current = processed[i];
                // Check that no higher-priority item appears after this one
                for (let j = i + 1; j < processed.length; j++) {
                    const later = processed[j];
                    // If later has a strictly higher priority (lower number), that's a violation
                    if (later.priority < current.priority) {
                        // This would mean a higher-priority item was processed after a lower-priority one
                        expect(later.priority).toBeGreaterThanOrEqual(current.priority);
                    }
                }
            }
        }), { numRuns: 100 });
    });
});
// ─── Property 3: DST-replayable determinism ─────────────────────────────────
describe("Property 3: DST-replayable determinism", () => {
    it("same enqueue sequence produces identical drain order across two runs", async () => {
        await fc.assert(fc.asyncProperty(fc.array(fc.record({ id: fc.nat({ max: 10000 }), lane: fc.nat({ max: 1 }) }), {
            minLength: 1,
            maxLength: 40,
        }), async (sequence) => {
            const config = {
                maxDegreeOfParallelism: 1,
                defaultMaxBatchSize: 256,
                defaultMaxBatchBytes: undefined,
                lanes: [{ priority: 0 }, { priority: 1 }],
                defaultPriority: 1,
                drainingPolicy: { kind: "strict" },
            };
            async function run() {
                const order = [];
                const processBatch = async (boat) => {
                    for (const item of boat)
                        order.push(item.id);
                };
                const throttler = new PriorityFerryThrottler(config, processBatch);
                for (const item of sequence) {
                    throttler.tryEnqueue(item, item.lane);
                }
                await throttler.complete();
                return order;
            }
            const run1 = await run();
            const run2 = await run();
            expect(run1).toEqual(run2);
        }), { numRuns: 100 });
    });
});
// ─── Property 7: Per-lane backpressure isolation ────────────────────────────
describe("Property 7: Per-lane backpressure isolation", () => {
    it("filling one lane does not prevent enqueue to a different lane", async () => {
        await fc.assert(fc.asyncProperty(fc.integer({ min: 1, max: 10 }), async (fillCount) => {
            const maxQueueSize = 2;
            const config = {
                maxDegreeOfParallelism: 1,
                defaultMaxBatchSize: 256,
                defaultMaxBatchBytes: undefined,
                lanes: [
                    { priority: 0 }, // lane 0: unbounded
                    { priority: 1, maxQueueSize }, // lane 1: bounded
                ],
                defaultPriority: 1,
                drainingPolicy: { kind: "strict" },
            };
            // Block processing so items stay in queue
            let unblock;
            const gate = new Promise((r) => { unblock = r; });
            const processBatch = async () => {
                await gate;
            };
            const throttler = new PriorityFerryThrottler(config, processBatch);
            // Fill lane 1 to its capacity
            for (let i = 0; i < maxQueueSize; i++) {
                const accepted = throttler.tryEnqueue(i, 1);
                expect(accepted).toBe(true);
            }
            // Lane 1 should now reject
            const overflowResult = throttler.tryEnqueue(999, 1);
            expect(overflowResult).toBe(false);
            // Lane 0 should still accept (isolation)
            const isolatedResult = throttler.tryEnqueue(fillCount, 0);
            expect(isolatedResult).toBe(true);
            unblock?.();
            await throttler.complete();
        }), { numRuns: 100 });
    });
});
// ─── Property 8: No-drop under backpressure ─────────────────────────────────
describe("Property 8: No-drop under backpressure", () => {
    it("all enqueued items are processed even with small bounded queues", async () => {
        await fc.assert(fc.asyncProperty(fc.array(fc.record({ id: fc.nat({ max: 50000 }), lane: fc.nat({ max: 1 }) }), {
            minLength: 1,
            maxLength: 30,
        }), async (items) => {
            const config = {
                maxDegreeOfParallelism: 1,
                defaultMaxBatchSize: 256,
                defaultMaxBatchBytes: undefined,
                lanes: [
                    { priority: 0, maxQueueSize: 3 },
                    { priority: 1, maxQueueSize: 3 },
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
            // Use await enqueue — backpressure will make some wait
            for (const item of items) {
                await throttler.enqueue(item, item.lane);
            }
            await throttler.complete();
            // All items must be processed (no drops)
            expect(processed.length).toBe(items.length);
            // Verify set equality
            const processedIds = new Set(processed.map((p) => p.id));
            const inputIds = new Set(items.map((i) => i.id));
            expect(processedIds).toEqual(inputIds);
        }), { numRuns: 100 });
    });
});
// ─── Property 11: Config serialization round-trip ───────────────────────────
describe("Property 11: Config serialization round-trip", () => {
    it("serialize then deserialize yields structurally equal config", async () => {
        // Arbitrary for a valid PriorityFerryThrottlerConfig
        const arbLaneConfig = (priority, needsWeight) => fc.record({
            priority: fc.constant(priority),
            maxBatchSize: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
            maxBatchBytes: fc.option(fc.integer({ min: 1, max: 100000 }), { nil: undefined }),
            maxQueueSize: fc.option(fc.integer({ min: 1, max: 1000 }), { nil: undefined }),
            weight: needsWeight
                ? fc.integer({ min: 1, max: 100 }).map((w) => w)
                : fc.option(fc.integer({ min: 1, max: 100 }), { nil: undefined }),
        });
        const arbConfig = fc
            .integer({ min: 1, max: 4 })
            .chain((numLanes) => fc.boolean().chain((isWeighted) => {
            // Generate distinct priorities
            return fc
                .uniqueArray(fc.nat({ max: 99 }), { minLength: numLanes, maxLength: numLanes })
                .chain((priorities) => {
                const sortedPriorities = [...priorities].sort((a, b) => a - b);
                const lanes = fc.tuple(...sortedPriorities.map((p) => arbLaneConfig(p, isWeighted)));
                return lanes.chain((laneConfigs) => {
                    const defaultPriorityArb = fc.constantFrom(...sortedPriorities);
                    const policyArb = isWeighted
                        ? fc.constant({
                            kind: "weighted-fair",
                            weights: new Map(laneConfigs.map((l) => [l.priority, l.weight ?? 1])),
                        })
                        : fc.constant({ kind: "strict" });
                    return fc.record({
                        maxDegreeOfParallelism: fc.integer({ min: 1, max: 8 }),
                        defaultMaxBatchSize: fc.integer({ min: 1, max: 1000 }),
                        defaultMaxBatchBytes: fc.option(fc.integer({ min: 1, max: 100000 }), {
                            nil: undefined,
                        }),
                        lanes: fc.constant(laneConfigs),
                        defaultPriority: defaultPriorityArb,
                        drainingPolicy: policyArb,
                    });
                });
            });
        }));
        await fc.assert(fc.asyncProperty(arbConfig, async (config) => {
            const json = serializeConfig(config);
            const restored = deserializeConfig(json);
            // Structural equality checks
            expect(restored.maxDegreeOfParallelism).toBe(config.maxDegreeOfParallelism);
            expect(restored.defaultMaxBatchSize).toBe(config.defaultMaxBatchSize);
            expect(restored.defaultMaxBatchBytes).toBe(config.defaultMaxBatchBytes);
            expect(restored.defaultPriority).toBe(config.defaultPriority);
            expect(restored.lanes.length).toBe(config.lanes.length);
            for (let i = 0; i < config.lanes.length; i++) {
                const orig = config.lanes[i];
                const rest = restored.lanes[i];
                expect(rest.priority).toBe(orig.priority);
                expect(rest.maxBatchSize).toBe(orig.maxBatchSize);
                expect(rest.maxBatchBytes).toBe(orig.maxBatchBytes);
                expect(rest.maxQueueSize).toBe(orig.maxQueueSize);
                expect(rest.weight).toBe(orig.weight);
            }
            expect(restored.drainingPolicy.kind).toBe(config.drainingPolicy.kind);
            if (config.drainingPolicy.kind === "weighted-fair" &&
                restored.drainingPolicy.kind === "weighted-fair") {
                for (const [key, value] of config.drainingPolicy.weights) {
                    expect(restored.drainingPolicy.weights.get(key)).toBe(value);
                }
                expect(restored.drainingPolicy.weights.size).toBe(config.drainingPolicy.weights.size);
            }
        }), { numRuns: 100 });
    });
});
// ─── Property 12: Invalid priority rejection ────────────────────────────────
describe("Property 12: Invalid priority rejection", () => {
    it("enqueue/tryEnqueue with unconfigured priority throws RangeError", async () => {
        await fc.assert(fc.asyncProperty(fc.uniqueArray(fc.nat({ max: 50 }), { minLength: 1, maxLength: 4 }), fc.nat({ max: 99 }), async (configuredPriorities, rawBadPriority) => {
            // Ensure badPriority is NOT in the configured set
            const configSet = new Set(configuredPriorities);
            let badPriority = rawBadPriority;
            while (configSet.has(badPriority)) {
                badPriority = (badPriority + 1) % 100;
            }
            // If we wrapped around and still in set, skip (extremely unlikely with max 4 lanes)
            if (configSet.has(badPriority))
                return;
            const sorted = [...configuredPriorities].sort((a, b) => a - b);
            const config = {
                maxDegreeOfParallelism: 1,
                defaultMaxBatchSize: 256,
                defaultMaxBatchBytes: undefined,
                lanes: sorted.map((p) => ({ priority: p })),
                defaultPriority: sorted[0],
                drainingPolicy: { kind: "strict" },
            };
            const processBatch = async () => { };
            const throttler = new PriorityFerryThrottler(config, processBatch);
            // tryEnqueue should throw RangeError
            expect(() => throttler.tryEnqueue(42, badPriority)).toThrow(RangeError);
            // enqueue should reject with RangeError
            await expect(throttler.enqueue(42, badPriority)).rejects.toBeInstanceOf(RangeError);
            throttler.dispose();
        }), { numRuns: 100 });
    });
});
