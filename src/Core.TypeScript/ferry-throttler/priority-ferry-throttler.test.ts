/**
 * priority-ferry-throttler.test.ts — tests for PriorityFerryThrottler (fire-and-forget arity).
 *
 * Covers strict priority ordering, default priority, invalid priority rejection,
 * DoP=N set-equal, per-lane backpressure, single-lane equivalence, byte budget
 * per lane, complete drains all lanes, and dispose aborts.
 */

import { describe, expect, it } from "bun:test";
import { PriorityFerryThrottler } from "./priority-ferry-throttler.ts";
import { DETERMINISTIC_CONFIG, FerryThrottler } from "./ferry-throttler.ts";
import type { ProcessBatch } from "./ferry-throttler.ts";
import type { PriorityFerryThrottlerConfig } from "./priority-config.ts";
import { deferred } from "../testing/deterministic-async";

// ─── Helpers ────────────────────────────────────────────────────────────────

function range(start: number, end: number): number[] {
  const result: number[] = [];
  for (let i = start; i <= end; i++) result.push(i);
  return result;
}

/** A strict two-lane config: priority 0 (high) and priority 1 (low). DoP=1. */
const STRICT_TWO_LANE: PriorityFerryThrottlerConfig = {
  maxDegreeOfParallelism: 1,
  defaultMaxBatchSize: 256,
  defaultMaxBatchBytes: undefined,
  lanes: [
    { priority: 0 },
    { priority: 1 },
  ],
  defaultPriority: 1,
  drainingPolicy: { kind: "strict" },
};

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("PriorityFerryThrottler", () => {
  it("strict priority ordering (DoP=1): high-priority items all process before low-priority", async () => {
    const processed: Array<{ priority: number; value: number }> = [];
    const processBatch: ProcessBatch<{ priority: number; value: number }> = async (boat) => {
      for (const item of boat) processed.push(item);
    };

    const throttler = new PriorityFerryThrottler(STRICT_TWO_LANE, processBatch);

    // Enqueue low-priority items first
    for (const v of range(1, 5)) {
      throttler.tryEnqueue({ priority: 1, value: v }, 1);
    }
    // Then enqueue high-priority items
    for (const v of range(10, 14)) {
      throttler.tryEnqueue({ priority: 0, value: v }, 0);
    }

    await throttler.complete();

    // All high-priority items should appear before any low-priority item
    const highIndices = processed
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.priority === 0)
      .map(({ idx }) => idx);
    const lowIndices = processed
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.priority === 1)
      .map(({ idx }) => idx);

    const maxHighIndex = Math.max(...highIndices);
    const minLowIndex = Math.min(...lowIndices);
    expect(maxHighIndex).toBeLessThan(minLowIndex);
  });

  it("default priority: enqueue without specifying priority goes to default lane", async () => {
    const processed: number[] = [];
    const processBatch: ProcessBatch<number> = async (boat) => {
      for (const item of boat) processed.push(item);
    };

    const config: PriorityFerryThrottlerConfig = {
      ...STRICT_TWO_LANE,
      defaultPriority: 0,
    };

    const throttler = new PriorityFerryThrottler(config, processBatch);

    // Enqueue without priority — should go to defaultPriority (0 = high)
    await throttler.enqueue(42);
    await throttler.complete();

    expect(processed).toEqual([42]);
  });

  it("invalid priority rejection: enqueue with non-configured priority throws RangeError", async () => {
    const processBatch: ProcessBatch<number> = async () => {};
    const throttler = new PriorityFerryThrottler(STRICT_TWO_LANE, processBatch);

    await expect(throttler.enqueue(1, 99)).rejects.toBeInstanceOf(RangeError);
    expect(() => throttler.tryEnqueue(1, 99)).toThrow(RangeError);

    throttler.dispose();
  });

  it("DoP=N set-equal: 4 ferries, items across lanes, all items processed", async () => {
    const processed: number[] = [];
    const processBatch: ProcessBatch<number> = async (boat) => {
      for (const item of boat) processed.push(item);
    };

    const config: PriorityFerryThrottlerConfig = {
      maxDegreeOfParallelism: 4,
      defaultMaxBatchSize: 16,
      defaultMaxBatchBytes: undefined,
      lanes: [
        { priority: 0 },
        { priority: 1 },
        { priority: 2 },
      ],
      defaultPriority: 1,
      drainingPolicy: { kind: "strict" },
    };

    const throttler = new PriorityFerryThrottler(config, processBatch);

    const items = range(1, 100);
    for (const x of items) {
      const priority = x % 3; // distribute across lanes
      await throttler.enqueue(x, priority);
    }
    await throttler.complete();

    expect(processed.length).toBe(100);
    expect(new Set(processed)).toEqual(new Set(items));
  });

  it("per-lane backpressure: bounded low-priority lane full, high-priority lane still accepts", async () => {
    let resolveGate: (() => void) | undefined;
    const gate = new Promise<void>((r) => { resolveGate = r; });
    let processCalled = false;

    const processBatch: ProcessBatch<number> = async (boat, _signal) => {
      processCalled = true;
      await gate;
      void boat;
    };

    const config: PriorityFerryThrottlerConfig = {
      maxDegreeOfParallelism: 1,
      defaultMaxBatchSize: 256,
      defaultMaxBatchBytes: undefined,
      lanes: [
        { priority: 0 },  // high, unbounded
        { priority: 1, maxQueueSize: 2 },  // low, bounded to 2
      ],
      defaultPriority: 1,
      drainingPolicy: { kind: "strict" },
    };

    const throttler = new PriorityFerryThrottler(config, processBatch);

    // Fill the low-priority lane
    const accepted1 = throttler.tryEnqueue(1, 1);
    const accepted2 = throttler.tryEnqueue(2, 1);
    const accepted3 = throttler.tryEnqueue(3, 1); // should fail — lane is full

    expect(accepted1).toBe(true);
    expect(accepted2).toBe(true);
    expect(accepted3).toBe(false);

    // High-priority lane should still accept
    const acceptedHigh = throttler.tryEnqueue(100, 0);
    expect(acceptedHigh).toBe(true);

    resolveGate?.();
    await throttler.complete();
    expect(processCalled).toBe(true);
  });

  it("single-lane equivalence: single-lane PriorityFerryThrottler behaves like plain FerryThrottler", async () => {
    const priorityProcessed: number[] = [];
    const plainProcessed: number[] = [];

    const priorityProcess: ProcessBatch<number> = async (boat) => {
      for (const item of boat) priorityProcessed.push(item);
    };
    const plainProcess: ProcessBatch<number> = async (boat) => {
      for (const item of boat) plainProcessed.push(item);
    };

    const singleLaneConfig: PriorityFerryThrottlerConfig = {
      maxDegreeOfParallelism: 1,
      defaultMaxBatchSize: 256,
      defaultMaxBatchBytes: undefined,
      lanes: [{ priority: 0 }],
      defaultPriority: 0,
      drainingPolicy: { kind: "strict" },
    };

    const priorityThrottler = new PriorityFerryThrottler(singleLaneConfig, priorityProcess);
    const plainThrottler = new FerryThrottler(DETERMINISTIC_CONFIG, plainProcess);

    const items = range(1, 50);
    for (const x of items) {
      await priorityThrottler.enqueue(x);
      await plainThrottler.enqueue(x);
    }

    await priorityThrottler.complete();
    await plainThrottler.complete();

    expect(priorityProcessed).toEqual(plainProcessed);
    expect(priorityProcessed).toEqual(items);
  });

  it("byte budget per lane: lane with maxBatchBytes creates appropriately-sized boats", async () => {
    const boats: number[][] = [];
    const processBatch: ProcessBatch<number> = async (boat) => {
      boats.push([...boat]);
    };

    const config: PriorityFerryThrottlerConfig = {
      maxDegreeOfParallelism: 1,
      defaultMaxBatchSize: 100,
      defaultMaxBatchBytes: undefined,
      lanes: [
        { priority: 0, maxBatchBytes: 25 },  // Each item is 10 bytes → max 2 per boat
      ],
      defaultPriority: 0,
      drainingPolicy: { kind: "strict" },
    };

    const sizer = (_item: number): number => 10;
    const throttler = new PriorityFerryThrottler(config, processBatch, sizer);

    for (const x of range(1, 10)) {
      throttler.tryEnqueue(x, 0);
    }

    await throttler.complete();

    // Every boat should have at most 2 items (10 bytes each, budget 25)
    for (const boat of boats) {
      expect(boat.length).toBeGreaterThanOrEqual(1);
      expect(boat.length).toBeLessThanOrEqual(2);
    }
    // All items processed
    const allItems = boats.flat();
    expect(new Set(allItems)).toEqual(new Set(range(1, 10)));
  });

  it("complete drains all lanes: items in both lanes, complete(), verify all processed", async () => {
    const processed: number[] = [];
    const processBatch: ProcessBatch<number> = async (boat) => {
      for (const item of boat) processed.push(item);
    };

    const throttler = new PriorityFerryThrottler(STRICT_TWO_LANE, processBatch);

    // Put items in both lanes
    for (const x of range(1, 10)) {
      await throttler.enqueue(x, 0);
    }
    for (const x of range(11, 20)) {
      await throttler.enqueue(x, 1);
    }

    await throttler.complete();

    expect(processed.length).toBe(20);
    expect(new Set(processed)).toEqual(new Set(range(1, 20)));
  });

  it("dispose aborts: items in queue, dispose(), ferries stop", async () => {
    let processCount = 0;
    const neverResolve = new Promise<void>(() => {});

    // The ferry can SAY when it has picked up work; it does not need to be guessed at.
    const ferryStarted = deferred();
    const processBatch: ProcessBatch<number> = async (_boat, signal) => {
      processCount++;
      ferryStarted.resolve();
      await new Promise<void>((resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason as unknown), { once: true });
        void neverResolve.then(resolve);
      });
    };

    const throttler = new PriorityFerryThrottler(STRICT_TWO_LANE, processBatch);

    // Enqueue some items
    for (const x of range(1, 10)) {
      throttler.tryEnqueue(x, 0);
    }

    // Wait for the ferry to pick up work. WAS a 10ms sleep, which on a loaded runner could
    // return before the ferry had started -- and the test would still pass, because of the
    // assertion below.
    await ferryStarted.promise;

    throttler.dispose();

    // ASSERTION STRENGTHENED, deliberately and in the open. This read
    // `expect(processCount).toBeGreaterThanOrEqual(0)` -- a count is a non-negative integer,
    // so that assertion held for every possible execution including one where the ferry never
    // ran at all. It is the vacuity class: the comment beside it said "processCount can be >= 1"
    // while the code checked >= 0. Removing the sleep is what makes >= 1 safe to assert, because
    // the barrier GUARANTEES the ferry started rather than hoping 10ms was enough.
    expect(processCount).toBeGreaterThanOrEqual(1);
  });
});
