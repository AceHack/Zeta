/**
 * priority-ferry-throttler-with-result.test.ts — tests for PriorityFerryThrottlerWithResult.
 *
 * Covers result alignment, strict priority ordering with results, result count
 * mismatch faulting, processor throw faulting, cancelled request skipping, byte
 * sizer throw faulting a single item, byte budget with results, invalid priority
 * rejection, and dispose rejecting queued items.
 */

import { describe, expect, it } from "bun:test";
import { PriorityFerryThrottlerWithResult } from "./priority-ferry-throttler-with-result.ts";
import type { ProcessBatchWithResult, ItemSizeBytes } from "./ferry-throttler.ts";
import type { PriorityFerryThrottlerConfig } from "./priority-config.ts";

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

describe("PriorityFerryThrottlerWithResult", () => {
  it("result arity returns aligned results: items enqueued across lanes, each gets x*10 as result", async () => {
    const processBatch: ProcessBatchWithResult<number, number> = async (boat) => {
      return boat.map((x) => x * 10);
    };

    const throttler = new PriorityFerryThrottlerWithResult(STRICT_TWO_LANE, processBatch);

    const promises: Promise<number>[] = [];
    for (const x of range(1, 5)) {
      promises.push(throttler.process(x, 0)); // high priority
    }
    for (const x of range(6, 10)) {
      promises.push(throttler.process(x, 1)); // low priority
    }

    await throttler.complete();
    const results = await Promise.all(promises);

    // Each result is x*10
    expect(results).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it("strict priority ordering with results: high-priority items get results before low-priority", async () => {
    const resolveOrder: number[] = [];

    const processBatch: ProcessBatchWithResult<number, number> = async (boat) => {
      return boat.map((x) => x * 10);
    };

    const throttler = new PriorityFerryThrottlerWithResult(STRICT_TWO_LANE, processBatch);

    // Enqueue low-priority first, then high-priority
    const lowPromises: Promise<number>[] = [];
    for (const x of range(1, 5)) {
      lowPromises.push(
        throttler.process(x, 1).then((r) => {
          resolveOrder.push(x);
          return r;
        }),
      );
    }

    const highPromises: Promise<number>[] = [];
    for (const x of range(10, 14)) {
      highPromises.push(
        throttler.process(x, 0).then((r) => {
          resolveOrder.push(x);
          return r;
        }),
      );
    }

    await throttler.complete();
    await Promise.all([...highPromises, ...lowPromises]);

    // All high-priority items (10-14) should resolve before any low-priority (1-5)
    const highIndices = resolveOrder
      .map((val, idx) => ({ val, idx }))
      .filter(({ val }) => val >= 10)
      .map(({ idx }) => idx);
    const lowIndices = resolveOrder
      .map((val, idx) => ({ val, idx }))
      .filter(({ val }) => val < 10)
      .map(({ idx }) => idx);

    const maxHighIndex = Math.max(...highIndices);
    const minLowIndex = Math.min(...lowIndices);
    expect(maxHighIndex).toBeLessThan(minLowIndex);
  });

  it("result count mismatch faults entire boat: processor returns wrong-length array", async () => {
    const processBatch: ProcessBatchWithResult<number, number> = async (boat) => {
      // Return fewer results than items
      return boat.slice(0, 1).map((x) => x * 10);
    };

    const throttler = new PriorityFerryThrottlerWithResult(STRICT_TWO_LANE, processBatch);

    const promises = range(1, 3).map((x) => throttler.process(x, 0));
    await throttler.complete();

    for (const p of promises) {
      await expect(p).rejects.toThrow("result count mismatch");
    }
  });

  it("processor throw faults all items in boat: processor throws Error('boom')", async () => {
    const processBatch: ProcessBatchWithResult<number, number> = async (_boat) => {
      throw new Error("boom");
    };

    const throttler = new PriorityFerryThrottlerWithResult(STRICT_TWO_LANE, processBatch);

    const promises = range(1, 4).map((x) => throttler.process(x, 0));
    await throttler.complete();

    for (const p of promises) {
      await expect(p).rejects.toThrow("boom");
    }
  });

  it("cancelled request skipping: cancel one item mid-flight, others still process", async () => {
    let gate: (() => void) | undefined;
    const gatePromise = new Promise<void>((r) => { gate = r; });

    const processBatch: ProcessBatchWithResult<number, number> = async (boat) => {
      await gatePromise;
      return boat.map((x) => x * 10);
    };

    const config: PriorityFerryThrottlerConfig = {
      maxDegreeOfParallelism: 1,
      defaultMaxBatchSize: 256,
      defaultMaxBatchBytes: undefined,
      lanes: [{ priority: 0 }],
      defaultPriority: 0,
      drainingPolicy: { kind: "strict" },
    };

    const throttler = new PriorityFerryThrottlerWithResult(config, processBatch);

    const ac = new AbortController();
    const p1 = throttler.process(1, 0);
    const p2 = throttler.process(2, 0, ac.signal);
    const p3 = throttler.process(3, 0);

    // Give the ferry time to start processing the first boat (item 1)
    await new Promise((r) => setTimeout(r, 10));

    // Cancel item 2 before the ferry picks it up for boat assembly
    ac.abort();

    // Let the first boat complete
    gate!();

    await throttler.complete();

    const r1 = await p1;
    const r3 = await p3;
    expect(r1).toBe(10);
    expect(r3).toBe(30);

    // p2 should have been rejected due to cancellation
    await expect(p2).rejects.toBeDefined();
  });

  it("byte sizer throw faults single item: sizer throws for one item, others in same boat still work", async () => {
    const processBatch: ProcessBatchWithResult<number, number> = async (boat) => {
      return boat.map((x) => x * 10);
    };

    const sizer: ItemSizeBytes<number> = (item: number): number => {
      if (item === 3) throw new Error("sizer exploded");
      return 10;
    };

    const config: PriorityFerryThrottlerConfig = {
      maxDegreeOfParallelism: 1,
      defaultMaxBatchSize: 256,
      defaultMaxBatchBytes: 1000,
      lanes: [{ priority: 0 }],
      defaultPriority: 0,
      drainingPolicy: { kind: "strict" },
    };

    const throttler = new PriorityFerryThrottlerWithResult(config, processBatch, sizer);

    const p1 = throttler.process(1, 0);
    const p2 = throttler.process(2, 0);
    const p3 = throttler.process(3, 0); // sizer will throw for this
    const p4 = throttler.process(4, 0);

    await throttler.complete();

    expect(await p1).toBe(10);
    expect(await p2).toBe(20);
    expect(await p4).toBe(40);

    // p3 should be rejected with the sizer error
    await expect(p3).rejects.toThrow("sizer exploded");
  });

  it("byte budget with results: lane maxBatchBytes constrains boat size, results still aligned", async () => {
    const boatSizes: number[] = [];
    const processBatch: ProcessBatchWithResult<number, number> = async (boat) => {
      boatSizes.push(boat.length);
      return boat.map((x) => x * 10);
    };

    const sizer: ItemSizeBytes<number> = () => 10;

    const config: PriorityFerryThrottlerConfig = {
      maxDegreeOfParallelism: 1,
      defaultMaxBatchSize: 100,
      defaultMaxBatchBytes: undefined,
      lanes: [
        { priority: 0, maxBatchBytes: 25 }, // 10 bytes each → max 2 per boat
      ],
      defaultPriority: 0,
      drainingPolicy: { kind: "strict" },
    };

    const throttler = new PriorityFerryThrottlerWithResult(config, processBatch, sizer);

    const promises = range(1, 6).map((x) => throttler.process(x, 0));
    await throttler.complete();

    const results = await Promise.all(promises);

    // Results still aligned
    expect(results).toEqual([10, 20, 30, 40, 50, 60]);

    // Every boat should have at most 2 items (10 bytes each, budget 25)
    for (const sz of boatSizes) {
      expect(sz).toBeGreaterThanOrEqual(1);
      expect(sz).toBeLessThanOrEqual(2);
    }
  });

  it("invalid priority rejection: non-configured priority, assert RangeError", async () => {
    const processBatch: ProcessBatchWithResult<number, number> = async (boat) => {
      return boat.map((x) => x * 10);
    };

    const throttler = new PriorityFerryThrottlerWithResult(STRICT_TWO_LANE, processBatch);

    await expect(throttler.process(1, 99)).rejects.toBeInstanceOf(RangeError);

    throttler.dispose();
  });

  it("dispose rejects queued items: items in queue, dispose(), all rejected", async () => {
    const processBatch: ProcessBatchWithResult<number, number> = async (boat, signal) => {
      // Simulate a long-running batch that respects the abort signal
      await new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
          reject(signal.reason);
          return;
        }
        const timer = setTimeout(resolve, 5000);
        signal.addEventListener("abort", () => {
          clearTimeout(timer);
          reject(signal.reason);
        }, { once: true });
      });
      return boat.map((x) => x * 10);
    };

    const config: PriorityFerryThrottlerConfig = {
      maxDegreeOfParallelism: 1,
      defaultMaxBatchSize: 2,
      defaultMaxBatchBytes: undefined,
      lanes: [{ priority: 0 }],
      defaultPriority: 0,
      drainingPolicy: { kind: "strict" },
    };

    const throttler = new PriorityFerryThrottlerWithResult(config, processBatch);

    const p1 = throttler.process(1, 0);
    const p2 = throttler.process(2, 0);
    const p3 = throttler.process(3, 0);
    const p4 = throttler.process(4, 0);

    // Give ferry time to pick up the first boat (items 1,2) and queue items 3,4
    await new Promise((r) => setTimeout(r, 20));

    throttler.dispose();

    // All promises should reject
    const results = await Promise.allSettled([p1, p2, p3, p4]);
    for (const r of results) {
      expect(r.status).toBe("rejected");
    }
  });
});
