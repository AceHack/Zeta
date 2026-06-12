/**
 * ferry-throttler.ts — a degree-of-parallelism-knobbed work queue whose batching
 * core is the *Flux Capacitor* (Mirror codename): it accumulates queued items and
 * discharges them as a *boat* (batch) the instant a ferry is free, carrying
 * whatever is waiting. This is **self-clocked, anti-Nagle** batching — unlike
 * Nagle's algorithm it adds **no artificial timer/delay**: under slow traffic a
 * boat of one item sails immediately (zero added latency); under bursts boats
 * grow up to `maxBatchSize`. Self-clocking is Van Jacobson's ACK-clocking idea
 * (TCP congestion avoidance, 1988) applied to work batching.
 *
 * At `maxDegreeOfParallelism = 1` this is a single deterministic ferry — the
 * FoundationDB single-thread run-loop shape — and the same type scales to N.
 *
 * Prior art / human anchor: the maintainer's Itron `Platform.DotNet`
 * `Threading.Tasks.Throttling` (`IThrottler`, `MaxDegreeOfParallelism`).
 *
 * Port of `src/Core/FerryThrottler.fs` — byte-locked cross-language parity.
 */

import { createInternalChannel } from "./internal-channel.ts";
import type { InternalChannel } from "./internal-channel.ts";

// ─── Types ──────────────────────────────────────────────────────────────────

/**
 * Configuration for a FerryThrottler.
 *
 * The defaults are the *deterministic* defaults: one ferry. A throttler built
 * with `DETERMINISTIC_CONFIG` runs as a single cooperative loop — beautiful on
 * one thread, DST-replayable, the FoundationDB shape — and the SAME code scales
 * to N ferries by raising `maxDegreeOfParallelism`.
 */
export interface FerryThrottlerConfig {
  /**
   * Number of ferries (concurrent boat processors). **1 → a single deterministic
   * cooperative loop** (no cross-ferry interleaving, replays from a seed); **N → N
   * ferries** draining the same queue for throughput.
   */
  readonly maxDegreeOfParallelism: number;
  /**
   * Maximum items a single boat carries per `processBatch` call. This is a
   * *capacity cap, not a delay* — a boat sails with whatever is queued right now,
   * up to this many. It NEVER waits to fill the boat.
   */
  readonly maxBatchSize: number;
  /**
   * Optional *byte budget* per boat. `undefined` → count-only batching. When set,
   * a boat also closes once adding the next item would exceed this many bytes, so
   * boats stay matched to serialization / buffer / wire sizes. Requires an
   * `itemSizeBytes` function at construction. A single item larger than the budget
   * still ships alone — the budget is a target that yields to progress, never a
   * wall that strands one oversized item.
   */
  readonly maxBatchBytes?: number | undefined;
  /**
   * Bounded queue size for backpressure. `undefined` → unbounded (enqueue never
   * blocks). When set, `enqueue` asynchronously waits once N items are in flight
   * (cooperative backpressure, no dropped work).
   */
  readonly maxQueueSize?: number | undefined;
}

/** Deterministic default: one ferry, 256-item boat cap, unbounded queue. */
export const DETERMINISTIC_CONFIG: FerryThrottlerConfig = {
  maxDegreeOfParallelism: 1,
  maxBatchSize: 256,
  maxBatchBytes: undefined,
  maxQueueSize: undefined,
};

/** Scale-out: `ferries` ferries, otherwise the deterministic defaults. */
export function withFerries(ferries: number): FerryThrottlerConfig {
  return { ...DETERMINISTIC_CONFIG, maxDegreeOfParallelism: Math.max(1, ferries) };
}

/**
 * Callback that processes one boat (batch) of items. Receives a readonly array
 * of items and an `AbortSignal` for cooperative cancellation.
 */
export type ProcessBatch<T> = (
  boat: readonly T[],
  signal: AbortSignal,
) => Promise<void>;

/**
 * Callback that processes one boat and returns one result per item (aligned by
 * index). Receives a readonly array of items and an `AbortSignal`.
 */
export type ProcessBatchWithResult<T, R> = (
  boat: readonly T[],
  signal: AbortSignal,
) => Promise<R[]>;

/** Measures the byte size of one item (required when `maxBatchBytes` is set). */
export type ItemSizeBytes<T> = (item: T) => number;

// ─── Internal: async channel (imported from shared module) ──────────────────

// ─── FerryThrottler (fire-and-forget) ───────────────────────────────────────

/**
 * **FerryThrottler** — self-clocked anti-Nagle batching with a DoP knob.
 *
 * At `maxDegreeOfParallelism = 1` this is a single deterministic cooperative
 * loop (DST-replayable). The same code scales to N ferries.
 *
 * Ferries are genuine async loops (no thread-per-item; cooperative yielding while
 * idle). `processBatch` receives each boat.
 */
export class FerryThrottler<T> {
  private readonly _inbox: InternalChannel<T>;
  private readonly _abortController: AbortController;
  private readonly _ferryTasks: Promise<void>[];
  private readonly _sizeOf: ItemSizeBytes<T>;
  private readonly _config: FerryThrottlerConfig;

  constructor(
    config: FerryThrottlerConfig,
    processBatch: ProcessBatch<T>,
    itemSizeBytes?: ItemSizeBytes<T>,
  ) {
    validateConfig(config, itemSizeBytes);
    this._config = config;
    this._sizeOf = itemSizeBytes ?? (() => 0);
    this._inbox = createInternalChannel<T>(config.maxQueueSize);
    this._abortController = new AbortController();

    this._ferryTasks = Array.from(
      { length: config.maxDegreeOfParallelism },
      () => this._runFerry(processBatch),
    );
  }

  private async _runFerry(processBatch: ProcessBatch<T>): Promise<void> {
    const signal = this._abortController.signal;
    const maxBatch = this._config.maxBatchSize;
    const byteBudget = this._config.maxBatchBytes;
    let pending: T | undefined;
    let hasPending = false;

    try {
      let running = true;
      while (running) {
        let haveWork = hasPending;
        if (!haveWork) {
          const more = await this._inbox.waitToRead(signal);
          haveWork = more;
          if (!more) running = false;
        }
        if (haveWork) {
          const boat: T[] = [];
          let bytes = 0;

          if (hasPending) {
            boat.push(pending as T);
            bytes = this._sizeOf(pending as T);
            hasPending = false;
            pending = undefined;
          }

          let draining = true;
          while (draining && boat.length < maxBatch) {
            const item = this._inbox.tryRead();
            if (item === undefined) {
              draining = false;
            } else {
              const sz = this._sizeOf(item);
              if (byteBudget !== undefined && boat.length > 0 && bytes + sz > byteBudget) {
                pending = item;
                hasPending = true;
                draining = false;
              } else {
                boat.push(item);
                bytes += sz;
              }
            }
          }

          if (boat.length > 0) {
            await processBatch(boat, signal);
          }
        }
      }
    } catch (e: unknown) {
      if (!isAbortError(e)) throw e;
    }
  }

  /**
   * Enqueue one item. Returns a promise that resolves when the item is accepted
   * into the queue — on a bounded throttler this cooperatively waits for room
   * (backpressure); on an unbounded one it resolves immediately. Does NOT wait
   * for the item to be *processed*.
   */
  async enqueue(item: T, signal?: AbortSignal): Promise<void> {
    await this._inbox.write(item, signal);
  }

  /** Try to enqueue without waiting. Returns false if a bounded queue is full. */
  tryEnqueue(item: T): boolean {
    return this._inbox.tryWrite(item);
  }

  /**
   * Signal that no more items will be enqueued, then await every ferry draining
   * the queue to completion. After this the throttler is finished.
   */
  async complete(): Promise<void> {
    this._inbox.complete();
    await Promise.all(this._ferryTasks);
  }

  /** Dispose: complete the channel, abort ferries, and wait briefly. */
  dispose(): void {
    this._inbox.complete();
    this._abortController.abort();
    // Fire-and-forget — ferries will catch the abort.
  }
}

// ─── FerryRequest (internal for request/response arity) ─────────────────────

interface FerryRequest<T, R> {
  readonly item: T;
  resolve: (result: R) => void;
  reject: (err: unknown) => void;
  cancelled: boolean;
}

// ─── FerryThrottlerWithResult (request/response arity) ──────────────────────

/**
 * Request/response FerryThrottler arity. Producers submit one item and receive
 * that item's result promise; the ferry still processes boats in batches and fans
 * aligned results back to the individual callers.
 *
 * At `maxDegreeOfParallelism = 1`, completion order is deterministic for
 * non-cancelled items because one ferry drains boats in FIFO order. With multiple
 * ferries, every item still receives exactly one result/fault/cancel, but
 * cross-ferry completion order is intentionally not specified.
 */
export class FerryThrottlerWithResult<T, R> {
  private readonly _inbox: InternalChannel<FerryRequest<T, R>>;
  private readonly _abortController: AbortController;
  private readonly _ferryTasks: Promise<void>[];
  private readonly _sizeOf: ItemSizeBytes<T>;
  private readonly _config: FerryThrottlerConfig;

  constructor(
    config: FerryThrottlerConfig,
    processBatch: ProcessBatchWithResult<T, R>,
    itemSizeBytes?: ItemSizeBytes<T>,
  ) {
    validateConfig(config, itemSizeBytes);
    this._config = config;
    this._sizeOf = itemSizeBytes ?? (() => 0);
    this._inbox = createInternalChannel<FerryRequest<T, R>>(config.maxQueueSize);
    this._abortController = new AbortController();

    this._ferryTasks = Array.from(
      { length: config.maxDegreeOfParallelism },
      () => this._runFerry(processBatch),
    );
  }

  private _tryTakeActive(): FerryRequest<T, R> | undefined {
    for (;;) {
      const req = this._inbox.tryRead();
      if (req === undefined) return undefined;
      if (req.cancelled) continue; // skip cancelled
      return req;
    }
  }

  private _trySizeRequest(req: FerryRequest<T, R>): number | undefined {
    try {
      return this._sizeOf(req.item);
    } catch (e: unknown) {
      req.reject(e);
      return undefined;
    }
  }

  private async _runFerry(processBatch: ProcessBatchWithResult<T, R>): Promise<void> {
    const signal = this._abortController.signal;
    const maxBatch = this._config.maxBatchSize;
    const byteBudget = this._config.maxBatchBytes;
    let pending: FerryRequest<T, R> | undefined;

    try {
      let running = true;
      while (running) {
        let haveWork = pending !== undefined;
        if (!haveWork) {
          const more = await this._inbox.waitToRead(signal);
          haveWork = more;
          if (!more) running = false;
        }
        if (haveWork) {
          const items: T[] = [];
          const requests: FerryRequest<T, R>[] = [];
          let bytes = 0;

          // Handle pending (deferred from previous boat)
          if (pending !== undefined) {
            if (pending.cancelled) {
              pending = undefined;
            } else {
              const sz = this._trySizeRequest(pending);
              if (sz !== undefined) {
                items.push(pending.item);
                requests.push(pending);
                bytes = sz;
              }
              pending = undefined;
            }
          }

          // Drain what's available NOW
          let draining = true;
          while (draining && items.length < maxBatch) {
            const req = this._tryTakeActive();
            if (req === undefined) {
              draining = false;
            } else {
              const sz = this._trySizeRequest(req);
              if (sz === undefined) continue; // sizer threw, request already rejected
              if (byteBudget !== undefined && items.length > 0 && bytes + sz > byteBudget) {
                pending = req;
                draining = false;
              } else {
                items.push(req.item);
                requests.push(req);
                bytes += sz;
              }
            }
          }

          if (items.length > 0) {
            try {
              const results = await processBatch(items, signal);
              if (results.length !== items.length) {
                const ex = new Error(
                  `FerryThrottler result count mismatch: processor returned ${results.length} results for ${items.length} items.`,
                );
                for (const r of requests) r.reject(ex);
              } else {
                for (let i = 0; i < results.length; i++) {
                  requests[i]!.resolve(results[i]!);
                }
              }
            } catch (e: unknown) {
              if (isAbortError(e)) {
                for (const r of requests) r.reject(new AbortError());
              } else {
                for (const r of requests) r.reject(e);
              }
            }
          }
        }
      }
    } catch (e: unknown) {
      // Ferry shutting down — cancel anything remaining
      if (isAbortError(e)) {
        this._cancelRemaining(pending);
      } else {
        throw e;
      }
    }
  }

  private _cancelRemaining(pending: FerryRequest<T, R> | undefined): void {
    if (pending !== undefined) {
      pending.reject(new AbortError());
    }
    for (;;) {
      const req = this._inbox.tryRead();
      if (req === undefined) break;
      req.reject(new AbortError());
    }
  }

  /**
   * Submit one item for batch processing. Returns a promise that resolves with
   * the item's aligned result once the boat containing it is processed.
   */
  process(item: T, signal?: AbortSignal): Promise<R> {
    if (signal?.aborted) {
      return Promise.reject(signal.reason);
    }

    return new Promise<R>((resolve, reject) => {
      const req: FerryRequest<T, R> = { item, resolve, reject, cancelled: false };

      if (signal) {
        signal.addEventListener(
          "abort",
          () => {
            req.cancelled = true;
            reject(signal.reason);
          },
          { once: true },
        );
      }

      this._inbox.write(req, signal).catch((err: unknown) => {
        req.cancelled = true;
        reject(err);
      });
    });
  }

  /**
   * Signal that no more items will be enqueued, then await every ferry draining
   * the queue to completion.
   */
  async complete(): Promise<void> {
    this._inbox.complete();
    await Promise.all(this._ferryTasks);
  }

  /** Dispose: complete the channel, abort ferries. */
  dispose(): void {
    this._inbox.complete();
    this._abortController.abort();
  }
}

// ─── Validation ─────────────────────────────────────────────────────────────

function validateConfig<T>(
  config: FerryThrottlerConfig,
  itemSizeBytes: ItemSizeBytes<T> | undefined,
): void {
  if (config.maxDegreeOfParallelism < 1) {
    throw new RangeError("maxDegreeOfParallelism must be >= 1");
  }
  if (config.maxBatchSize < 1) {
    throw new RangeError("maxBatchSize must be >= 1");
  }
  if (config.maxQueueSize !== undefined && config.maxQueueSize < 1) {
    throw new RangeError("maxQueueSize, if set, must be >= 1");
  }
  if (config.maxBatchBytes !== undefined && config.maxBatchBytes < 1) {
    throw new RangeError("maxBatchBytes, if set, must be >= 1");
  }
  if (config.maxBatchBytes !== undefined && itemSizeBytes === undefined) {
    throw new RangeError("itemSizeBytes is required when maxBatchBytes is set");
  }
}

// ─── Utilities ──────────────────────────────────────────────────────────────

class AbortError extends Error {
  override readonly name = "AbortError";
  constructor() {
    super("The operation was aborted");
  }
}

function isAbortError(e: unknown): boolean {
  if (e instanceof DOMException && e.name === "AbortError") return true;
  if (e instanceof AbortError) return true;
  if (e instanceof Error && e.name === "AbortError") return true;
  return false;
}
