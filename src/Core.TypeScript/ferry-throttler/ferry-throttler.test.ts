/**
 * ferry-throttler.test.ts — TS reference tests for FerryThrottler port.
 *
 * Mirrors the F# test suite at `tests/Tests.FSharp/Runtime/FerryThrottler.Tests.fs`
 * for byte-locked cross-language parity. Each test name maps to its F# counterpart.
 */

import { describe, expect, it } from "bun:test";
import {
  DETERMINISTIC_CONFIG,
  FerryThrottler,
  FerryThrottlerWithResult,
  withFerries,
  type FerryThrottlerConfig,
  type ProcessBatch,
  type ProcessBatchWithResult,
} from "./ferry-throttler";

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Collect every item processed + boat sizes, drive all items through, complete. */
async function runCollecting(
  config: FerryThrottlerConfig,
  items: number[],
): Promise<{ processed: number[]; boatSizes: number[] }> {
  const processed: number[] = [];
  const boatSizes: number[] = [];
  const processBatch: ProcessBatch<number> = async (boat) => {
    boatSizes.push(boat.length);
    for (const item of boat) processed.push(item);
  };
  const throttler = new FerryThrottler(config, processBatch);
  for (const x of items) {
    await throttler.enqueue(x);
  }
  await throttler.complete();
  return { processed, boatSizes };
}

function range(start: number, end: number): number[] {
  const result: number[] = [];
  for (let i = start; i <= end; i++) result.push(i);
  return result;
}

// ─── Fire-and-forget arity ──────────────────────────────────────────────────

describe("FerryThrottler — fire-and-forget", () => {
  it("DoP=1 processes every item exactly once, in order", async () => {
    const items = range(1, 100);
    const { processed } = await runCollecting(DETERMINISTIC_CONFIG, items);
    expect(processed).toEqual(items);
  });

  it("slow traffic ships boats of one — no artificial batching delay", async () => {
    const processed: number[] = [];
    const boats: number[] = [];
    let resolveGate: (() => void) | undefined;

    const processBatch: ProcessBatch<number> = async (boat) => {
      boats.push(boat.length);
      for (const item of boat) processed.push(item);
      resolveGate?.();
    };

    const throttler = new FerryThrottler(DETERMINISTIC_CONFIG, processBatch);

    for (const x of [10, 20, 30]) {
      const gate = new Promise<void>((r) => { resolveGate = r; });
      await throttler.enqueue(x);
      await gate; // wait for this item's boat to be processed
    }

    await throttler.complete();
    expect(processed).toEqual([10, 20, 30]);
    expect(boats.every((n) => n === 1)).toBe(true);
  });

  it("bursty traffic coalesces into larger boats up to MaxBatchSize", async () => {
    const config: FerryThrottlerConfig = { ...DETERMINISTIC_CONFIG, maxBatchSize: 4 };
    const { processed, boatSizes } = await runCollecting(config, range(1, 50));
    expect(boatSizes.reduce((a, b) => a + b, 0)).toBe(50);
    expect(boatSizes.every((n) => n >= 1 && n <= 4)).toBe(true);
    // All items present
    expect(new Set(processed)).toEqual(new Set(range(1, 50)));
  });

  it("DoP=N processes every item exactly once (set-equal; order not guaranteed)", async () => {
    const items = range(1, 500);
    const { processed } = await runCollecting(withFerries(4), items);
    expect(processed.length).toBe(500);
    expect(new Set(processed)).toEqual(new Set(items));
  });

  it("bounded queue applies backpressure without dropping work", async () => {
    const processed: number[] = [];
    const processBatch: ProcessBatch<number> = async (boat) => {
      await new Promise((r) => setTimeout(r, 1));
      for (const item of boat) processed.push(item);
    };
    const config: FerryThrottlerConfig = { ...DETERMINISTIC_CONFIG, maxQueueSize: 2 };
    const throttler = new FerryThrottler(config, processBatch);
    for (const x of range(1, 30)) {
      await throttler.enqueue(x);
    }
    await throttler.complete();
    expect(processed.length).toBe(30);
    expect(new Set(processed)).toEqual(new Set(range(1, 30)));
  });

  it("byte budget closes boats to match serialization size", async () => {
    const boats: number[] = [];
    const processed: number[] = [];
    const processBatch: ProcessBatch<number> = async (boat) => {
      boats.push(boat.length);
      for (const item of boat) processed.push(item);
    };
    const config: FerryThrottlerConfig = {
      ...DETERMINISTIC_CONFIG,
      maxBatchSize: 100,
      maxBatchBytes: 25,
    };
    const throttler = new FerryThrottler(config, processBatch, () => 10);
    for (const x of range(1, 10)) await throttler.enqueue(x);
    await throttler.complete();
    expect(new Set(processed)).toEqual(new Set(range(1, 10)));
    // Each item is 10 bytes; budget 25 → boats of at most 2 items
    expect(boats.every((n) => n >= 1 && n <= 2)).toBe(true);
  });

  it("a single oversized item still ships alone", async () => {
    const processed: number[] = [];
    const processBatch: ProcessBatch<number> = async (boat) => {
      for (const item of boat) processed.push(item);
    };
    const config: FerryThrottlerConfig = { ...DETERMINISTIC_CONFIG, maxBatchBytes: 25 };
    const throttler = new FerryThrottler(config, processBatch, () => 100);
    await throttler.enqueue(42);
    await throttler.complete();
    expect(processed).toEqual([42]);
  });

  it("MaxBatchBytes without a sizer is rejected", () => {
    const noop: ProcessBatch<number> = async () => {};
    expect(
      () => new FerryThrottler({ ...DETERMINISTIC_CONFIG, maxBatchBytes: 10 }, noop),
    ).toThrow();
  });

  it("invalid configuration is rejected at construction", () => {
    const noop: ProcessBatch<number> = async () => {};
    expect(
      () => new FerryThrottler({ ...DETERMINISTIC_CONFIG, maxDegreeOfParallelism: 0 }, noop),
    ).toThrow();
    expect(
      () => new FerryThrottler({ ...DETERMINISTIC_CONFIG, maxBatchSize: 0 }, noop),
    ).toThrow();
  });
});

// ─── Request/response arity ─────────────────────────────────────────────────

describe("FerryThrottlerWithResult — request/response", () => {
  it("result arity returns one aligned result per item", async () => {
    const processBatch: ProcessBatchWithResult<number, number> = async (boat) => {
      return boat.map((x) => x * 10);
    };
    const throttler = new FerryThrottlerWithResult(DETERMINISTIC_CONFIG, processBatch);
    const tasks = range(1, 20).map((x) => throttler.process(x));
    const results = await Promise.all(tasks);
    await throttler.complete();
    expect(results).toEqual(range(1, 20).map((x) => x * 10));
  });

  it("result arity faults entire boat on result-length mismatch", async () => {
    const processBatch: ProcessBatchWithResult<number, number> = async () => {
      return []; // wrong length
    };
    const config: FerryThrottlerConfig = { ...DETERMINISTIC_CONFIG, maxBatchSize: 4 };
    const throttler = new FerryThrottlerWithResult(config, processBatch);
    const tasks = range(1, 4).map((x) => throttler.process(x));

    const results = await Promise.allSettled(tasks);
    await throttler.complete();

    for (const r of results) {
      expect(r.status).toBe("rejected");
      if (r.status === "rejected") {
        expect((r.reason as Error).message).toContain("result count mismatch");
      }
    }
  });

  it("result arity faults every item when processor throws", async () => {
    const processBatch: ProcessBatchWithResult<number, number> = async () => {
      throw new Error("boom");
    };
    const throttler = new FerryThrottlerWithResult(DETERMINISTIC_CONFIG, processBatch);
    const tasks = range(1, 3).map((x) => throttler.process(x));

    const results = await Promise.allSettled(tasks);
    await throttler.complete();

    for (const r of results) {
      expect(r.status).toBe("rejected");
      if (r.status === "rejected") {
        expect((r.reason as Error).message).toBe("boom");
      }
    }
  });

  it("result arity cancels queued item before shipping", async () => {
    const processed: number[] = [];
    let resolveGate: (() => void) | undefined;
    const gate = new Promise<void>((r) => { resolveGate = r; });
    let entered = false;

    const processBatch: ProcessBatchWithResult<number, number> = async (boat) => {
      processed.push(boat[0]!);
      if (!entered) {
        entered = true;
        await gate;
      }
      return [boat[0]!];
    };

    const config: FerryThrottlerConfig = { ...DETERMINISTIC_CONFIG, maxBatchSize: 1 };
    const throttler = new FerryThrottlerWithResult(config, processBatch);

    const first = throttler.process(1);

    // Wait for first to enter the processor
    await new Promise((r) => setTimeout(r, 10));

    const controller = new AbortController();
    const second = throttler.process(2, controller.signal);
    controller.abort();

    resolveGate?.();
    const firstResult = await first;
    expect(firstResult).toBe(1);

    const secondResult = await Promise.allSettled([second]);
    expect(secondResult[0]!.status).toBe("rejected");
    await throttler.complete();
    expect(processed).toEqual([1]);
  });

  it("result arity honors byte budget while preserving aligned results", async () => {
    const boats: number[] = [];
    const processBatch: ProcessBatchWithResult<number, number> = async (boat) => {
      boats.push(boat.length);
      return boat.map((x) => x + 1);
    };
    const config: FerryThrottlerConfig = {
      ...DETERMINISTIC_CONFIG,
      maxBatchSize: 100,
      maxBatchBytes: 25,
    };
    const throttler = new FerryThrottlerWithResult(config, processBatch, () => 10);
    const tasks = range(1, 10).map((x) => throttler.process(x));
    const results = await Promise.all(tasks);
    await throttler.complete();
    expect(results).toEqual(range(1, 10).map((x) => x + 1));
    expect(boats.every((n) => n >= 1 && n <= 2)).toBe(true);
  });

  it("result arity faults request when byte sizer throws", async () => {
    const processed: number[] = [];
    const processBatch: ProcessBatchWithResult<number, number> = async (boat) => {
      for (const item of boat) processed.push(item);
      return boat.map((x) => x);
    };
    const config: FerryThrottlerConfig = {
      ...DETERMINISTIC_CONFIG,
      maxBatchSize: 4,
      maxBatchBytes: 100,
    };
    const sizer = (item: number): number => {
      if (item === 2) throw new Error("size failed");
      return 10;
    };
    const throttler = new FerryThrottlerWithResult(config, processBatch, sizer);

    const ok1 = throttler.process(1);
    const bad = throttler.process(2);
    const ok3 = throttler.process(3);

    const [r1, rBad, r3] = await Promise.allSettled([ok1, bad, ok3]);
    await throttler.complete();

    expect(r1!.status).toBe("fulfilled");
    if (r1!.status === "fulfilled") expect(r1!.value).toBe(1);

    expect(rBad!.status).toBe("rejected");
    if (rBad!.status === "rejected") {
      expect((rBad!.reason as Error).message).toBe("size failed");
    }

    expect(r3!.status).toBe("fulfilled");
    if (r3!.status === "fulfilled") expect(r3!.value).toBe(3);

    expect(processed).toEqual([1, 3]);
  });

  it("dispose cancels queued caller tasks", async () => {
    let resolveEntered: (() => void) | undefined;
    const entered = new Promise<void>((r) => { resolveEntered = r; });
    const neverResolve = new Promise<void>(() => {});

    const processBatch: ProcessBatchWithResult<number, number> = async (boat, signal) => {
      resolveEntered?.();
      await new Promise<void>((resolve, reject) => {
        signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        void neverResolve.then(resolve);
      });
      return [boat[0]!];
    };

    const config: FerryThrottlerConfig = { ...DETERMINISTIC_CONFIG, maxBatchSize: 1 };
    const throttler = new FerryThrottlerWithResult(config, processBatch);

    const first = throttler.process(1);
    await entered;
    const second = throttler.process(2);

    throttler.dispose();

    const [r1, r2] = await Promise.allSettled([first, second]);
    expect(r1!.status).toBe("rejected");
    expect(r2!.status).toBe("rejected");
  });
});
